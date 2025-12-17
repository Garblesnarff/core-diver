import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Boulder } from '../objects/Boulder';
import { Fygar } from '../objects/Fygar';
import { SoundManager } from '../utils/SoundManager';
import { EVENTS, GameStats, TileType, GameState, PlayerUpgrades } from '../../types';
import { GAME_CONFIG, COLORS, TILE_SIZE, BIOMES } from '../../constants';

export class MainScene extends Phaser.Scene {
  cameras!: Phaser.Cameras.Scene2D.CameraManager;
  lights!: Phaser.GameObjects.LightsManager;
  input!: Phaser.Input.InputPlugin;
  physics!: Phaser.Physics.Arcade.ArcadePhysics;
  time!: Phaser.Time.Clock;
  events!: Phaser.Events.EventEmitter;
  make!: Phaser.GameObjects.GameObjectCreator;
  textures!: Phaser.Textures.TextureManager;
  add!: Phaser.GameObjects.GameObjectFactory;
  scene!: Phaser.Scenes.ScenePlugin;
  tweens!: Phaser.Tweens.TweenManager;

  private player!: Player;
  private map!: Phaser.Tilemaps.Tilemap;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private stats: GameStats = {
    oxygen: 100,
    maxOxygen: 100,
    depth: 0,
    health: 3,
    resources: { shards: 0, minerals: 0 },
    powerCells: 0,
    powerCellsRequired: 3
  };
  private oxygenTimer!: Phaser.Time.TimerEvent;
  private enemies!: Phaser.Physics.Arcade.Group;
  private fygars!: Phaser.Physics.Arcade.Group;
  private boulders!: Phaser.Physics.Arcade.Group;
  private beams!: Phaser.Physics.Arcade.Group;
  private artifact!: Phaser.Physics.Arcade.Sprite;
  private powerCells!: Phaser.Physics.Arcade.Group;
  private artifactLocked: boolean = true;
  private isGameOver: boolean = false;
  
  private upgrades: PlayerUpgrades = { oxygenLevel: 1, drillLevel: 1, speedLevel: 1, visionLevel: 1 };
  private difficulty: number = 1;
  private soundManager!: SoundManager;

  // Minimap
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private exploredTiles: boolean[][] = [];

  constructor() {
    super('MainScene');
  }

  init(data: { upgrades: PlayerUpgrades, difficulty: number }) {
      if (data.upgrades) this.upgrades = data.upgrades;
      if (data.difficulty) this.difficulty = data.difficulty;
  }

  create() {
    this.soundManager = new SoundManager();
    this.isGameOver = false;
    
    // Apply upgrades
    const maxO2 = 100 + ((this.upgrades.oxygenLevel - 1) * 25);
    const requiredCells = 3;
    this.stats = {
      oxygen: maxO2,
      maxOxygen: maxO2,
      depth: 0,
      health: 3,
      resources: { shards: 0, minerals: 0 },
      powerCells: 0,
      powerCellsRequired: requiredCells
    };
    this.artifactLocked = true;

    this.cameras.main.setBackgroundColor(COLORS.background);

    // Enhanced lighting setup - darker ambient for more dramatic effect
    this.lights.enable().setAmbientColor(0x222233);

    // Groups - must be created before generateLevel() since power cells are spawned there
    this.enemies = this.physics.add.group();
    this.fygars = this.physics.add.group();
    this.boulders = this.physics.add.group();
    this.beams = this.physics.add.group();
    this.powerCells = this.physics.add.group();

    this.generateLevel();

    // Add atmospheric ambient particles
    this.createAtmosphericEffects();

    // Spawn player
    const startX = (this.map.widthInPixels / 2);
    const startY = TILE_SIZE * 3;

    // Clear start area (Safety Box)
    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    
    // We remove tiles 3x3 around spawn
    for(let lx = -2; lx <= 2; lx++) {
        for(let ly = -2; ly <= 2; ly++) {
            this.layer.removeTileAt(startTileX + lx, startTileY + ly);
        }
    }

    this.player = new Player(this, startX, startY);
    const speed = GAME_CONFIG.playerSpeed + ((this.upgrades.speedLevel - 1) * 20);
    this.player.setMoveSpeed(speed);

    if ((this.player as any).light) {
        const radius = 250 + ((this.upgrades.visionLevel - 1) * 50);
        (this.player as any).light.setIntensity(2.0).setRadius(radius); 
    }
    
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Inputs
    this.input.keyboard!.on('keydown-SPACE', this.fireBeam, this);
    this.events.on('play-sound', (key: string) => {
        if(key === 'fire') this.soundManager.playShoot();
        if(key === 'dig') this.soundManager.playDig();
        if(key === 'fire-breath') this.soundManager.playShoot(); // Reuse
    });
    this.events.on('player-damage', (amount: number) => {
        this.stats.health -= amount;
        this.soundManager.playBoulderLand(); 
        this.cameras.main.shake(100, 0.01);
        this.updateReactStats();
        if(this.stats.health <= 0) this.handleDeath("Killed by Hazard");
    });

    // Process map for entities
    this.spawnEntities();

    // Physics
    // Enemies and boulders collide with walls
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.fygars, this.layer);
    this.physics.add.collider(this.boulders, this.layer); 
    
    // Player vs Walls (Boulders are solid)
    this.physics.add.collider(this.player, this.boulders);

    // Beam collisions
    this.physics.add.overlap(this.beams, this.enemies, this.handleBeamHit, undefined, this);
    this.physics.add.overlap(this.beams, this.fygars, this.handleBeamHit, undefined, this);
    
    // Player collisions
    // Changed to OVERLAP to prevent physics vibration/jitter when touching enemies
    this.physics.add.overlap(this.player, this.enemies, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.fygars, this.handlePlayerHit, undefined, this);
    
    this.physics.add.overlap(this.boulders, this.enemies, this.handleBoulderCrush, undefined, this);
    this.physics.add.overlap(this.boulders, this.fygars, this.handleBoulderCrush, undefined, this);
    
    this.physics.add.overlap(this.player, this.artifact, this.handleVictory, undefined, this);
    this.physics.add.overlap(this.player, this.powerCells, this.handlePowerCellCollect, undefined, this);

    // Timers
    this.oxygenTimer = this.time.addEvent({
        delay: 1000,
        callback: this.tickOxygen,
        callbackScope: this,
        loop: true
    });

    // Minimap
    this.minimapGraphics = this.add.graphics().setScrollFactor(0).setDepth(100);
    this.updateReactStats();

    // Ore Event
    this.events.off('collect-ore');
    this.events.on('collect-ore', (type: number) => {
        this.soundManager.playCollect();
        if (type === TileType.ICE) {
            const o2Gain = 25; // More valuable ice
            this.stats.oxygen = Math.min(this.stats.oxygen + o2Gain, this.stats.maxOxygen);
            const txt = this.add.text(this.player.x, this.player.y - 20, `+${o2Gain} O2`, {
                fontSize: '16px', color: '#a5f3fc', fontStyle: 'bold'
            }).setOrigin(0.5);
            this.tweens.add({ targets: txt, y: txt.y - 30, alpha: 0, duration: 800, onComplete: () => txt.destroy() });
        } else {
            this.stats.resources.minerals++;
            this.stats.resources.shards += 5 * this.upgrades.drillLevel;
        }
        this.updateReactStats();
    });
  }

  update(time: number, delta: number) {
    if (this.isGameOver || this.stats.oxygen <= 0) return;

    this.player.update(time, delta, this.layer);
    this.updateEnemies();
    this.boulders.children.iterate((b) => {
      if (b && b.active) (b as Boulder).update(time, delta, this.layer);
      return true;
    });
    this.fygars.children.iterate((f) => {
      if (f && f.active) (f as Fygar).update(time, delta);
      return true;
    });
    
    const currentDepth = Math.floor(this.player.y / TILE_SIZE);
    if (currentDepth !== this.stats.depth) {
        this.stats.depth = currentDepth;
        this.updateReactStats();
    }
    
    this.updateMinimap();
  }

  private generateLevel() {
    const width = 40;
    const height = 150 + (this.difficulty * 30); // Deeper maps
    const mapData: number[][] = [];

    // Pre-calculate stone band positions (horizontal barriers)
    const stoneBands: number[] = [];
    for (let i = 1; i <= 4 + this.difficulty; i++) {
        const bandY = Math.floor((height / (5 + this.difficulty)) * i) + Phaser.Math.Between(-3, 3);
        stoneBands.push(bandY);
    }

    // Init explored array
    for(let y=0; y<height; y++) {
        this.exploredTiles[y] = [];
        for(let x=0; x<width; x++) this.exploredTiles[y][x] = false;
    }

    for (let y = 0; y < height; y++) {
        const row: number[] = [];
        // Determine Biome
        let biome = BIOMES[0];
        for(const b of BIOMES) { if(y >= b.start) biome = b; }

        // Check if this is a stone band row
        const isInStoneBand = stoneBands.some(bandY => Math.abs(y - bandY) <= 1);

        for (let x = 0; x < width; x++) {
            if (y < 2) { row.push(TileType.EMPTY); continue; }
            if (x === 0 || x === width - 1 || y === height - 1) { row.push(TileType.BEDROCK); continue; }
            if (y > height - 10 && x > (width/2 - 4) && x < (width/2 + 4)) { row.push(TileType.EMPTY); continue; }

            const noise = Math.random();
            let tile = TileType.EMPTY;

            // Stone bands - mostly stone with small gaps
            if (isInStoneBand) {
                // Create gaps every ~8-12 tiles for alternate routes
                const gapNoise = Math.sin(x * 0.5 + y * 0.3) * 0.5 + 0.5;
                if (gapNoise > 0.85) {
                    tile = TileType.DIRT_HARD; // Small gap (still 2 hits)
                } else if (noise > 0.95) {
                    tile = TileType.ORE_LITHIUM; // Rare ore in stone
                } else {
                    tile = TileType.STONE; // 3 hits to break
                }
            } else {
                // Normal generation
                if (noise > 0.94) tile = TileType.ORE_LITHIUM;
                else if (noise > 0.88) tile = TileType.ORE_COPPER;
                else if (noise > 0.75 && biome.name === 'FROZEN DEPTHS') tile = TileType.ICE; // More ice in frozen biome
                else if (noise > 0.82 && biome.name !== 'FROZEN DEPTHS') tile = TileType.ICE;
                else if (noise > 0.70) tile = TileType.DIRT_HARD;
                else if (noise > 0.60 && y > 40) tile = TileType.STONE; // Stone clusters deeper down
                else if (noise > 0.15) tile = TileType.DIRT_SOFT;
                else if (noise > 0.05 && noise < 0.08) tile = TileType.BOULDER;
            }

            row.push(tile);
        }
        mapData.push(row);
    }

    this.map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = this.map.addTilesetImage('dynamic_tiles', 'dynamic_tiles', 32, 32);
    this.layer = this.map.createLayer(0, tiles!, 0, 0)!;
    this.layer.setCollisionByExclusion([-1]);
    this.layer.setPipeline('Light2D');
    this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);

    // Apply Biome Tints
    this.layer.forEachTile((tile) => {
        let biome = BIOMES[0];
        for(const b of BIOMES) { if(tile.y >= b.start) biome = b; }

        if (tile.index === TileType.DIRT_SOFT) tile.tint = biome.colors.soft;
        if (tile.index === TileType.DIRT_HARD) tile.tint = biome.colors.hard;
        if (tile.index === TileType.STONE) tile.tint = 0x4a5568; // Grey stone
    });

    // Spawn Artifact
    const mapHeight = this.map.heightInPixels;
    this.artifact = this.physics.add.sprite(this.map.widthInPixels / 2, mapHeight - 100, 'artifact');
    this.artifact.setPipeline('Light2D');
    this.artifact.setImmovable(true);
    this.artifact.setAlpha(0.3); // Locked - faded
    this.lights.addLight(this.artifact.x, this.artifact.y, 150, 0x805ad5, 2);

    // Spawn Power Cells - scattered at different depths
    const cellCount = this.stats.powerCellsRequired;
    const mapWidth = this.map.widthInPixels;
    const sectionHeight = (mapHeight - 200) / cellCount; // Divide map into sections

    for (let i = 0; i < cellCount; i++) {
      // Each cell in a different horizontal third and vertical section
      const sectionY = 150 + (sectionHeight * i) + Phaser.Math.Between(50, sectionHeight - 50);
      const sectionX = ((mapWidth / 3) * (i % 3)) + Phaser.Math.Between(80, (mapWidth / 3) - 80);

      const cell = this.powerCells.create(sectionX, sectionY, 'power_cell');
      cell.setPipeline('Light2D');
      cell.setImmovable(true);

      // Add pulsing light
      const cellLight = this.lights.addLight(sectionX, sectionY, 100, 0xfbbf24, 1.5);
      this.tweens.add({
        targets: cellLight,
        intensity: { from: 1.0, to: 2.0 },
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Floating animation
      this.tweens.add({
        targets: cell,
        y: cell.y - 5,
        duration: 1500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Clear tiles around power cell
      const cellTileX = Math.floor(sectionX / TILE_SIZE);
      const cellTileY = Math.floor(sectionY / TILE_SIZE);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          this.layer.removeTileAt(cellTileX + dx, cellTileY + dy);
        }
      }
    }
  }

  private spawnEntities() {
      // Safety zone radius (tiles)
      const safeX = this.map.widthInPixels / 2 / TILE_SIZE;
      const safeY = 3;
      const safeRadius = 5;

      // Iterate tiles to replace Boulders and spawn enemies
      this.layer.forEachTile((tile) => {
          // Check safety distance
          const dist = Phaser.Math.Distance.Between(tile.x, tile.y, safeX, safeY);
          if (dist < safeRadius) return;

          if (tile.index === TileType.BOULDER) {
              // Replace tile with Sprite
              const b = new Boulder(this, tile.getCenterX(), tile.getCenterY() - 16, this.soundManager);
              this.boulders.add(b);
              this.layer.removeTileAt(tile.x, tile.y);
          } else if (tile.index === TileType.EMPTY) {
              // Chance to spawn enemy
              if (Math.random() < 0.02) {
                  // 30% chance Fygar, 70% Pooka
                  if (Math.random() < 0.3) {
                      const f = new Fygar(this, tile.getCenterX(), tile.getCenterY(), this.player);
                      this.fygars.add(f);
                  } else {
                    const enemy = this.enemies.create(tile.getCenterX(), tile.getCenterY(), 'enemy');
                    enemy.setPipeline('Light2D');
                    enemy.setVelocity(Phaser.Math.Between(-30, 30), 0);
                    enemy.setBounce(1);
                    enemy.setCollideWorldBounds(true);
                    (enemy.body as Phaser.Physics.Arcade.Body).allowGravity = false;
                  }
              }
          }
      });
  }

  private updateMinimap() {
      this.minimapGraphics.clear();
      
      // Minimap Background
      const size = 150;
      const margin = 20;
      const x = GAME_CONFIG.width - size - margin;
      const y = margin;
      
      this.minimapGraphics.fillStyle(0x000000, 0.5);
      this.minimapGraphics.fillRect(x, y, size, size);
      
      // Scale factor
      const scaleX = size / this.map.widthInPixels;
      const scaleY = size / this.map.heightInPixels;

      // Draw Artifact
      this.minimapGraphics.fillStyle(0xffff00, 1);
      this.minimapGraphics.fillCircle(x + this.artifact.x * scaleX, y + this.artifact.y * scaleY, 3);

      // Draw Player
      this.minimapGraphics.fillStyle(0x00ff00, 1);
      this.minimapGraphics.fillCircle(x + this.player.x * scaleX, y + this.player.y * scaleY, 2);

      // Draw Enemies
      this.minimapGraphics.fillStyle(0xff0000, 1);
      this.enemies.children.iterate((e: any) => {
          if (e.active) this.minimapGraphics.fillCircle(x + e.x * scaleX, y + e.y * scaleY, 2);
          return true;
      });
      this.fygars.children.iterate((e: any) => {
          if (e.active) this.minimapGraphics.fillCircle(x + e.x * scaleX, y + e.y * scaleY, 2);
          return true;
      });

      // Draw Power Cells (pulsing orange)
      const pulseAlpha = 0.6 + Math.sin(this.time.now / 200) * 0.4;
      this.minimapGraphics.fillStyle(0xfbbf24, pulseAlpha);
      this.powerCells.children.iterate((c: any) => {
          if (c.active) this.minimapGraphics.fillCircle(x + c.x * scaleX, y + c.y * scaleY, 3);
          return true;
      });
  }

  private tickOxygen() {
    if (this.isGameOver) return;
    if (this.stats.oxygen > 0) {
        this.stats.oxygen -= GAME_CONFIG.oxygenDepletionRate * 2;
        if (this.stats.oxygen <= 0) {
            this.stats.oxygen = 0;
            this.handleDeath("Asphyxiation");
        }
        this.updateReactStats();
    }
  }

  private updateEnemies() {
      this.enemies.children.iterate((c) => {
          const enemy = c as Phaser.Physics.Arcade.Sprite;
          if(!enemy.active) return true;
          if (enemy.body?.blocked.left) enemy.setVelocityX(30);
          else if (enemy.body?.blocked.right) enemy.setVelocityX(-30);

          let inflation = enemy.getData('inflation') || 0;
          if (inflation > 0) {
              inflation -= 0.2;
              enemy.setData('inflation', inflation);
              enemy.setScale(1 + (inflation / 100));
              // Flash effect when inflated
              if (inflation > 20) {
                  if (Math.floor(this.time.now / 100) % 2 === 0) enemy.setAlpha(0.6);
                  else enemy.setAlpha(1);
              } else {
                  enemy.setAlpha(0.8);
              }
          } else {
              enemy.setAlpha(1);
              enemy.setScale(1);
          }
          return true;
      });
  }

  private fireBeam() {
      this.soundManager.playShoot();
      const facing = this.player.getFacing();
      let velocity = {x: 0, y: 0};
      let offset = {x: 0, y: 0};

      if (facing === 'left') { velocity.x = -400; offset.x = -20; }
      else if (facing === 'right') { velocity.x = 400; offset.x = 20; }
      else if (facing === 'up') { velocity.y = -400; offset.y = -20; }
      else if (facing === 'down') { velocity.y = 400; offset.y = 20; }

      const beam = this.beams.create(this.player.x + offset.x, this.player.y + offset.y, facing === 'up' || facing === 'down' ? 'beam_v' : 'beam_h');
      beam.setPipeline('Light2D');
      beam.setVelocity(velocity.x, velocity.y);

      // Add a light to the beam
      const beamLight = this.lights.addLight(beam.x, beam.y, 60, 0x4fd1c5, 1.5);

      this.time.delayedCall(300, () => {
          if (beam.active) beam.destroy();
          beamLight.setIntensity(0);
      });
  }

  private handleBeamHit(beam: any, enemy: any) {
      beam.destroy();
      const e = enemy as Phaser.Physics.Arcade.Sprite;
      let inflation = e.getData('inflation') || 0;
      let hp = e.getData('hp') || 3;
      inflation += (100 / hp) + 2; 
      
      e.setVelocity(0);
      this.tweens.add({ targets: e, scale: 1.2 + (inflation/100), duration: 50, yoyo: true });
      
      if (inflation >= 100) {
          this.soundManager.playPop();
          this.add.particles(0, 0, 'particle', {
            x: e.x, y: e.y, speed: 100, color: [0xff0000, 0xffff00], lifespan: 500
          }).explode(20);
          e.destroy();
          this.stats.resources.shards += 10 * this.upgrades.drillLevel;
          this.updateReactStats();
      } else {
          e.setData('inflation', inflation);
      }
  }

  private handlePlayerHit(player: any, enemy: any) {
      if (this.isGameOver) return;
      if (enemy.getData('inflation') > 50) return;
      const p = player as Phaser.Physics.Arcade.Sprite;
      // Simple knockback - can be annoying if stuck
      // p.setVelocity(p.x < enemy.x ? -200 : 200, -200); 
      
      // Using overlap now, so just damage
      // Add cooldown
      if (!p.getData('hitCooldown')) {
          p.setData('hitCooldown', true);
          this.events.emit('player-damage', 1);
          p.setTint(0xff0000);
          this.time.delayedCall(200, () => p.clearTint());
          this.time.delayedCall(1000, () => p.setData('hitCooldown', false));
      }
  }

  private handleBoulderHit(player: any, boulder: any) {
      const b = boulder as Boulder;
      if ((b.body as Phaser.Physics.Arcade.Body).velocity.y > 100) {
          // Crushed by falling boulder
          this.events.emit('player-damage', 3); // Instakill usually
      }
  }

  private handleBoulderCrush(boulder: any, enemy: any) {
      if ((boulder.body as Phaser.Physics.Arcade.Body).velocity.y > 50) {
          this.soundManager.playPop();
          enemy.destroy();
          this.stats.resources.shards += 25 * this.upgrades.drillLevel;
          this.updateReactStats();
          // Visual pop
          this.add.particles(0, 0, 'particle', { x: enemy.x, y: enemy.y, speed: 100, color: [0xff0000], lifespan: 500 }).explode(20);
      }
  }

  private handlePowerCellCollect(player: any, cell: any) {
      this.soundManager.playCollect();

      // Visual feedback
      this.add.particles(0, 0, 'particle', {
        x: cell.x, y: cell.y, speed: 150, color: [0xfbbf24, 0xfde047, 0xffffff], lifespan: 600
      }).explode(25);

      cell.destroy();
      this.stats.powerCells++;
      this.updateReactStats();

      // Show collection text
      const txt = this.add.text(player.x, player.y - 30,
        `POWER CELL ${this.stats.powerCells}/${this.stats.powerCellsRequired}`, {
        fontSize: '14px',
        color: '#fbbf24',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5);
      this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, duration: 1500, onComplete: () => txt.destroy() });

      // Camera flash
      this.cameras.main.flash(200, 251, 191, 36, false);

      // Check if all cells collected
      if (this.stats.powerCells >= this.stats.powerCellsRequired) {
        this.artifactLocked = false;
        this.artifact.setAlpha(1);

        // Big notification
        const unlockTxt = this.add.text(this.cameras.main.scrollX + GAME_CONFIG.width / 2,
          this.cameras.main.scrollY + GAME_CONFIG.height / 2 - 50,
          'ARTIFACT UNLOCKED!', {
          fontSize: '32px',
          color: '#805ad5',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 4
        }).setOrigin(0.5).setScrollFactor(0).setDepth(200);

        this.tweens.add({
          targets: unlockTxt,
          scale: { from: 0.5, to: 1.2 },
          alpha: { from: 1, to: 0 },
          duration: 2000,
          ease: 'Back.out',
          onComplete: () => unlockTxt.destroy()
        });

        // Intensify artifact glow
        this.tweens.add({
          targets: this.artifact,
          scale: { from: 1, to: 1.3 },
          duration: 500,
          yoyo: true,
          repeat: 2
        });
      }
  }

  private handleDeath(reason: string) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.scene.pause();
      window.dispatchEvent(new CustomEvent(EVENTS.GAME_OVER, { detail: { reason, stats: this.stats }}));
  }

  private handleVictory(player: any, artifact: any) {
      if (this.isGameOver) return;

      // Check if artifact is still locked
      if (this.artifactLocked) {
        // Show "locked" feedback - only once per second
        if (!player.getData('lockedMsgCooldown')) {
          player.setData('lockedMsgCooldown', true);
          const lockTxt = this.add.text(artifact.x, artifact.y - 40,
            `NEED ${this.stats.powerCellsRequired - this.stats.powerCells} MORE POWER CELLS`, {
            fontSize: '12px',
            color: '#ff6b6b',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
          }).setOrigin(0.5);
          this.tweens.add({ targets: lockTxt, y: lockTxt.y - 20, alpha: 0, duration: 1000, onComplete: () => lockTxt.destroy() });
          this.time.delayedCall(1000, () => player.setData('lockedMsgCooldown', false));
        }
        return;
      }

      this.isGameOver = true;
      this.cameras.main.flash(1000, 255, 255, 255);
      this.tweens.add({ targets: artifact, scale: 3, alpha: 0, duration: 2000 });
      this.tweens.add({ targets: player, alpha: 0, duration: 1000 });
      this.time.delayedCall(1500, () => {
          this.scene.pause();
          window.dispatchEvent(new CustomEvent(EVENTS.VICTORY, { detail: { stats: this.stats }}));
      });
  }

  private updateReactStats() {
      window.dispatchEvent(new CustomEvent(EVENTS.STATS_UPDATE, { detail: this.stats }));
  }

  private createAtmosphericEffects() {
    // Floating dust particles throughout the level
    const mapWidth = this.map.widthInPixels;
    const mapHeight = this.map.heightInPixels;

    // Create ambient dust particles
    const dustEmitter = this.add.particles(0, 0, 'particle', {
      x: { min: 0, max: mapWidth },
      y: { min: 0, max: mapHeight },
      scale: { start: 0.3, end: 0.1 },
      alpha: { start: 0.3, end: 0 },
      speed: { min: 5, max: 20 },
      angle: { min: 250, max: 290 },
      lifespan: { min: 4000, max: 8000 },
      frequency: 200,
      quantity: 1,
      tint: [0x4a90d9, 0x7dd3fc, 0x38b2ac],
      blendMode: 'ADD'
    });
    dustEmitter.setDepth(-1);

    // Add some static ambient lights for ores/atmosphere
    // These will be scattered around to give depth
    const numAmbientLights = 8;
    const lightColors = [0x38b2ac, 0xd53f8c, 0x7dd3fc, 0x805ad5];

    for (let i = 0; i < numAmbientLights; i++) {
      const x = Phaser.Math.Between(100, mapWidth - 100);
      const y = Phaser.Math.Between(200, mapHeight - 200);
      const color = Phaser.Math.RND.pick(lightColors);
      const light = this.lights.addLight(x, y, 150, color, 0.5);

      // Subtle pulsing animation for ambient lights
      this.tweens.add({
        targets: light,
        intensity: { from: 0.3, to: 0.6 },
        duration: Phaser.Math.Between(2000, 4000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }
}