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
    resources: { shards: 0, minerals: 0 }
  };
  private oxygenTimer!: Phaser.Time.TimerEvent;
  private enemies!: Phaser.Physics.Arcade.Group;
  private fygars!: Phaser.Physics.Arcade.Group;
  private boulders!: Phaser.Physics.Arcade.Group;
  private beams!: Phaser.Physics.Arcade.Group;
  private artifact!: Phaser.Physics.Arcade.Sprite;
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
    this.stats = {
      oxygen: maxO2,
      maxOxygen: maxO2,
      depth: 0,
      health: 3,
      resources: { shards: 0, minerals: 0 }
    };

    this.cameras.main.setBackgroundColor(COLORS.background);
    this.lights.enable().setAmbientColor(0x555555);

    this.generateLevel();

    // Spawn player
    const startX = (this.map.widthInPixels / 2);
    const startY = TILE_SIZE * 3;

    // Clear start area (Safety Box)
    const startTileX = Math.floor(startX / TILE_SIZE);
    const startTileY = Math.floor(startY / TILE_SIZE);
    for(let lx = -1; lx <= 1; lx++) {
        for(let ly = -1; ly <= 1; ly++) {
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
    });
    this.events.on('player-damage', (amount: number) => {
        this.stats.health -= amount;
        this.soundManager.playBoulderLand(); 
        this.cameras.main.shake(100, 0.01);
        this.updateReactStats();
        if(this.stats.health <= 0) this.handleDeath("Killed by Hazard");
    });

    // Groups
    this.enemies = this.physics.add.group();
    this.fygars = this.physics.add.group();
    this.boulders = this.physics.add.group();
    this.beams = this.physics.add.group();
    
    // Process map for entities
    this.spawnEntities();

    // Physics
    // CRITICAL FIX: Do NOT collide player with layer, let Player.ts handle digging/collision manually.
    // this.physics.add.collider(this.player, this.layer); 
    
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.collider(this.fygars, this.layer);
    this.physics.add.collider(this.boulders, this.layer); 
    
    // Player vs Walls (Boulders are solid)
    this.physics.add.collider(this.player, this.boulders);

    // Beam collisions
    this.physics.add.overlap(this.beams, this.enemies, this.handleBeamHit, undefined, this);
    this.physics.add.overlap(this.beams, this.fygars, this.handleBeamHit, undefined, this);
    
    // Player collisions
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerHit, undefined, this);
    this.physics.add.collider(this.player, this.fygars, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.boulders, this.enemies, this.handleBoulderCrush, undefined, this);
    this.physics.add.overlap(this.boulders, this.fygars, this.handleBoulderCrush, undefined, this);
    
    this.physics.add.overlap(this.player, this.artifact, this.handleVictory, undefined, this);

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
            this.stats.oxygen = Math.min(this.stats.oxygen + 20, this.stats.maxOxygen);
            const txt = this.add.text(this.player.x, this.player.y - 20, '+O2', { 
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
    this.boulders.children.iterate((b) => (b as Boulder).update(time, delta, this.layer));
    this.fygars.children.iterate((f) => (f as Fygar).update(time, delta));
    
    const currentDepth = Math.floor(this.player.y / TILE_SIZE);
    if (currentDepth !== this.stats.depth) {
        this.stats.depth = currentDepth;
        this.updateReactStats();
    }
    
    this.updateMinimap();
  }

  private generateLevel() {
    const width = 40;
    const height = 100 + (this.difficulty * 20);
    const mapData: number[][] = [];
    
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

        for (let x = 0; x < width; x++) {
            if (y < 2) { row.push(TileType.EMPTY); continue; }
            if (x === 0 || x === width - 1 || y === height - 1) { row.push(TileType.BEDROCK); continue; }
            if (y > height - 10 && x > (width/2 - 4) && x < (width/2 + 4)) { row.push(TileType.EMPTY); continue; }

            const noise = Math.random();
            // Generation logic per biome
            let tile = TileType.EMPTY;
            
            if (noise > 0.94) tile = TileType.ORE_LITHIUM;
            else if (noise > 0.88) tile = TileType.ORE_COPPER;
            else if (noise > 0.80 && biome.name === 'FROZEN DEPTHS') tile = TileType.ICE; // More ice in frozen
            else if (noise > 0.85 && biome.name !== 'FROZEN DEPTHS') tile = TileType.ICE; 
            else if (noise > 0.65) tile = TileType.DIRT_HARD;
            else if (noise > 0.15) tile = TileType.DIRT_SOFT;
            else if (noise > 0.05 && noise < 0.08) tile = TileType.BOULDER; // 3% Chance of Boulder
            
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
    });

    // Spawn Artifact
    const mapHeight = this.map.heightInPixels;
    this.artifact = this.physics.add.sprite(this.map.widthInPixels / 2, mapHeight - 100, 'artifact');
    this.artifact.setImmovable(true);
    this.lights.addLight(this.artifact.x, this.artifact.y, 150, 0x805ad5, 2);
  }

  private spawnEntities() {
      // Iterate tiles to replace Boulders and spawn enemies
      this.layer.forEachTile((tile) => {
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
                    enemy.setTint(COLORS.enemy.pooka);
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
              if (inflation > 20) {
                  enemy.setTint(0xffffff);
                  if (Math.floor(this.time.now / 100) % 2 === 0) enemy.setTint(COLORS.enemy.inflated);
              } else enemy.setTint(COLORS.enemy.inflated);
          } else {
              enemy.clearTint();
              enemy.setTint(COLORS.enemy.pooka);
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
      beam.setVelocity(velocity.x, velocity.y);
      beam.setLifespan(300);
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
      p.setVelocity(p.x < enemy.x ? -200 : 200, -200);
      this.events.emit('player-damage', 1);
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

  private handleDeath(reason: string) {
      if (this.isGameOver) return;
      this.isGameOver = true;
      this.scene.pause();
      window.dispatchEvent(new CustomEvent(EVENTS.GAME_OVER, { detail: { reason, stats: this.stats }}));
  }

  private handleVictory(player: any, artifact: any) {
      if (this.isGameOver) return;
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
}