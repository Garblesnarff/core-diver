import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { Boulder } from '../objects/Boulder';
import { Fygar } from '../objects/Fygar';
import { SoundManager } from '../utils/SoundManager';
import { EVENTS, GameStats, TileType, GameState, PlayerUpgrades, PickupType, ActivePickup, SkillTreeState, ComputedPlayerStats } from '../../types';
import { GAME_CONFIG, COLORS, TILE_SIZE, BIOMES } from '../../constants';
import { calculatePlayerStats } from '../../utils/calculatePlayerStats';

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
    maxHealth: 3,
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
  private pickups!: Phaser.Physics.Arcade.Group;
  private activePickups: ActivePickup[] = [];
  private artifactLocked: boolean = true;
  private isGameOver: boolean = false;
  private lastFireTime: number = 0;
  private fireCooldown: number = 400; // ms between shots
  private currentBiome: string = 'SURFACE';
  private biomeParticleTimer: number = 0;

  private upgrades: PlayerUpgrades = { oxygenLevel: 1, drillLevel: 1, speedLevel: 1, visionLevel: 1, armorLevel: 1, efficiencyLevel: 1, shardLevel: 1 };
  private skillTreeState: SkillTreeState = { unlockedSkills: [], totalSpent: 0 };
  private computedStats!: ComputedPlayerStats;
  private difficulty: number = 1;
  private soundManager!: SoundManager;
  private secondWindUsed: boolean = false; // Track if Second Wind has been used this run

  // Skill tree ability cooldowns (in ms, 0 = ready)
  private abilityCooldowns = {
    groundSlam: 0,
    proximityBombs: 0,
    energyBarrier: 0,
    grappleHook: 0,
    resourceBeacon: 0
  };
  private activeBombs: Phaser.GameObjects.Sprite[] = [];
  private activeBarrier: Phaser.GameObjects.Sprite | null = null;
  private activeBeacon: Phaser.GameObjects.Sprite | null = null;

  // Minimap
  private minimapGraphics!: Phaser.GameObjects.Graphics;
  private exploredTiles: boolean[][] = [];

  constructor() {
    super('MainScene');
  }

  init(data: { upgrades: PlayerUpgrades, difficulty: number, skillTreeState?: SkillTreeState }) {
      if (data.upgrades) this.upgrades = data.upgrades;
      if (data.difficulty) this.difficulty = data.difficulty;
      if (data.skillTreeState) this.skillTreeState = data.skillTreeState;

      // Calculate computed stats from upgrades + skill tree
      this.computedStats = calculatePlayerStats(this.upgrades, this.skillTreeState);
      this.secondWindUsed = false;
  }

  create() {
    this.soundManager = new SoundManager();
    this.isGameOver = false;

    // Ensure computedStats exists (in case init wasn't called with skillTreeState)
    if (!this.computedStats) {
      this.computedStats = calculatePlayerStats(this.upgrades, this.skillTreeState);
    }

    // Apply computed stats from upgrades + skill tree
    const maxO2 = this.computedStats.maxOxygen;
    const maxHealth = this.computedStats.maxHealth;
    const requiredCells = 3;
    this.stats = {
      oxygen: maxO2,
      maxOxygen: maxO2,
      depth: 0,
      health: maxHealth,
      maxHealth: maxHealth,
      resources: { shards: 0, minerals: 0 },
      powerCells: 0,
      powerCellsRequired: requiredCells
    };
    this.artifactLocked = true;

    // Apply skill effects - start with shield if unlocked
    if (this.computedStats.startWithShield) {
      this.activePickups.push({ type: PickupType.SHIELD, stacks: 1 });
    }

    this.cameras.main.setBackgroundColor(COLORS.background);

    // Enhanced lighting setup - darker ambient for more dramatic effect
    this.lights.enable().setAmbientColor(0x222233);

    // Groups - must be created before generateLevel() since power cells are spawned there
    this.enemies = this.physics.add.group();
    this.fygars = this.physics.add.group();
    this.boulders = this.physics.add.group();
    this.beams = this.physics.add.group();
    this.powerCells = this.physics.add.group();
    this.pickups = this.physics.add.group();
    this.activePickups = [];

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
    this.player.setMoveSpeed(this.computedStats.moveSpeed);

    if ((this.player as any).light) {
        (this.player as any).light.setIntensity(2.0).setRadius(this.computedStats.lightRadius);
    }
    
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    // Inputs
    this.input.keyboard!.on('keydown-SPACE', this.fireBeam, this);

    // Skill tree ability inputs
    this.input.keyboard!.on('keydown-E', this.useGroundSlam, this);
    this.input.keyboard!.on('keydown-Q', this.useProximityBomb, this);
    this.input.keyboard!.on('keydown-G', this.useEnergyBarrier, this);
    this.input.keyboard!.on('keydown-R', this.useGrappleHook, this);
    this.input.keyboard!.on('keydown-F', this.useResourceBeacon, this);

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
    this.physics.add.overlap(this.player, this.pickups, this.handlePickupCollect, undefined, this);

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
            this.stats.resources.shards += this.calculateShards(5);
        }
        this.updateReactStats();
    });
  }

  update(time: number, delta: number) {
    if (this.isGameOver || this.stats.oxygen <= 0) return;

    this.player.update(time, delta, this.layer);
    this.updateEnemies();
    this.updatePickupDurations(delta);
    this.updateMagnetEffect();
    this.updateAbilityCooldowns(delta);
    this.updateAbilityEffects(delta);
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

    // Update biome and apply biome effects
    this.updateBiomeEffects(delta);

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

    // Spawn pickups scattered throughout the map
    this.spawnPickups(mapWidth, mapHeight);
  }

  private spawnPickups(mapWidth: number, mapHeight: number) {
    const pickupTypes = [
      { type: PickupType.SPREAD_SHOT, texture: 'pickup_spread', color: 0x818cf8 },
      { type: PickupType.RAPID_FIRE, texture: 'pickup_rapid', color: 0xfbbf24 },
      { type: PickupType.SHIELD, texture: 'pickup_shield', color: 0x4ade80 },
      { type: PickupType.EMERGENCY_O2, texture: 'pickup_o2', color: 0x38bdf8 },
      { type: PickupType.DRILL_BOOST, texture: 'pickup_drill', color: 0xf472b6 },
      { type: PickupType.MAGNET, texture: 'pickup_magnet', color: 0xef4444 },
    ];

    // Spawn 4-6 pickups per run, scattered at different depths
    const pickupCount = 4 + Math.floor(this.difficulty * 0.5);

    for (let i = 0; i < pickupCount; i++) {
      const pickupInfo = Phaser.Math.RND.pick(pickupTypes);

      // Spread pickups throughout the map depth
      const ySection = (mapHeight - 200) / pickupCount;
      const y = 120 + (ySection * i) + Phaser.Math.Between(30, ySection - 30);
      const x = Phaser.Math.Between(80, mapWidth - 80);

      const pickup = this.pickups.create(x, y, pickupInfo.texture);
      pickup.setPipeline('Light2D');
      pickup.setData('pickupType', pickupInfo.type);
      pickup.setImmovable(true);

      // Add glow
      const pickupLight = this.lights.addLight(x, y, 80, pickupInfo.color, 1.2);
      pickup.setData('light', pickupLight);

      // Floating animation
      this.tweens.add({
        targets: pickup,
        y: pickup.y - 4,
        duration: 1200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Pulsing light
      this.tweens.add({
        targets: pickupLight,
        intensity: { from: 0.8, to: 1.5 },
        duration: 800,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      // Clear tiles around pickup
      const pickupTileX = Math.floor(x / TILE_SIZE);
      const pickupTileY = Math.floor(y / TILE_SIZE);
      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          this.layer.removeTileAt(pickupTileX + dx, pickupTileY + dy);
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
              // Enemy spawn rate scales with depth
              const depthFactor = Math.min(tile.y / 100, 2); // 0 to 2x at depth 100+
              const baseSpawnChance = 0.015;
              const spawnChance = baseSpawnChance + (depthFactor * 0.015); // 1.5% to 4.5%

              if (Math.random() < spawnChance) {
                  // Fygar ratio increases with depth (30% -> 60%)
                  const fygarChance = 0.3 + (depthFactor * 0.15);

                  if (Math.random() < fygarChance) {
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
        // Use computed O2 consumption multiplier (includes skill tree bonuses)
        const efficiencyMult = this.computedStats.o2ConsumptionMultiplier;

        // Biome modifier for O2 drain
        let biomeMult = 1.0;
        switch (this.currentBiome) {
          case 'FROZEN DEPTHS':
            biomeMult = 0.8; // Cold preserves oxygen better
            break;
          case 'CORE ZONE':
            biomeMult = 1.5; // Heat/radiation burns through oxygen faster
            break;
        }

        this.stats.oxygen -= GAME_CONFIG.oxygenDepletionRate * 2 * efficiencyMult * biomeMult;
        if (this.stats.oxygen <= 0) {
            // Second Wind skill: restore to 30% instead of dying (once per run)
            if (this.computedStats.hasSecondWind && !this.secondWindUsed) {
                this.secondWindUsed = true;
                this.stats.oxygen = this.stats.maxOxygen * 0.3;
                // Visual feedback for Second Wind activation
                this.cameras.main.flash(500, 100, 200, 255);
                this.soundManager.playCollect();
            } else {
                this.stats.oxygen = 0;
                this.handleDeath("Asphyxiation");
            }
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
      // Check fire cooldown
      const currentTime = this.time.now;
      const cooldown = this.hasActivePickup(PickupType.RAPID_FIRE) ? this.fireCooldown / 2 : this.fireCooldown;
      if (currentTime - this.lastFireTime < cooldown) return;
      this.lastFireTime = currentTime;

      this.soundManager.playShoot();
      const facing = this.player.getFacing();
      const baseSpeed = 400;

      // Calculate base velocity and offset
      let velocity = {x: 0, y: 0};
      let offset = {x: 0, y: 0};

      if (facing === 'left') { velocity.x = -baseSpeed; offset.x = -20; }
      else if (facing === 'right') { velocity.x = baseSpeed; offset.x = 20; }
      else if (facing === 'up') { velocity.y = -baseSpeed; offset.y = -20; }
      else if (facing === 'down') { velocity.y = baseSpeed; offset.y = 20; }

      // Determine beam angles - spread shot fires 3 beams
      const angles: number[] = [0]; // Center beam
      if (this.hasActivePickup(PickupType.SPREAD_SHOT)) {
        angles.push(-25, 25); // Side beams at 25 degrees
      }

      for (const angle of angles) {
        // Rotate velocity by angle
        const rad = angle * (Math.PI / 180);
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        const rotatedVx = velocity.x * cos - velocity.y * sin;
        const rotatedVy = velocity.x * sin + velocity.y * cos;

        const beamTexture = facing === 'up' || facing === 'down' ? 'beam_v' : 'beam_h';
        const beam = this.beams.create(this.player.x + offset.x, this.player.y + offset.y, beamTexture);
        beam.setPipeline('Light2D');
        beam.setVelocity(rotatedVx, rotatedVy);

        // Rotate beam sprite to match direction
        if (angle !== 0) {
          beam.setAngle(angle);
        }

        // Add a light to the beam
        const beamLight = this.lights.addLight(beam.x, beam.y, 60, 0x4fd1c5, 1.5);

        this.time.delayedCall(300, () => {
            if (beam.active) beam.destroy();
            beamLight.setIntensity(0);
        });
      }
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
          this.stats.resources.shards += this.calculateShards(10);
          this.updateReactStats();
      } else {
          e.setData('inflation', inflation);
      }
  }

  private handlePlayerHit(player: any, enemy: any) {
      if (this.isGameOver) return;
      if (enemy.getData('inflation') > 50) return;
      const p = player as Phaser.Physics.Arcade.Sprite;

      // Add cooldown
      if (!p.getData('hitCooldown')) {
          p.setData('hitCooldown', true);

          // Check for shield pickup
          const shieldPickup = this.getActivePickup(PickupType.SHIELD);
          if (shieldPickup && shieldPickup.stacks && shieldPickup.stacks > 0) {
            // Shield absorbs the hit
            shieldPickup.stacks--;
            if (shieldPickup.stacks <= 0) {
              // Remove shield from active pickups
              const idx = this.activePickups.indexOf(shieldPickup);
              if (idx > -1) this.activePickups.splice(idx, 1);
            }
            // Visual feedback - green flash instead of red
            p.setTint(0x4ade80);
            this.soundManager.playCollect();
            // Show "BLOCKED" text
            const txt = this.add.text(p.x, p.y - 30, 'SHIELD!', {
              fontSize: '14px', color: '#4ade80', fontStyle: 'bold',
              stroke: '#000000', strokeThickness: 2
            }).setOrigin(0.5);
            this.tweens.add({ targets: txt, y: txt.y - 20, alpha: 0, duration: 600, onComplete: () => txt.destroy() });
          } else {
            // Take damage normally
            this.events.emit('player-damage', 1);
            p.setTint(0xff0000);
          }

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
          this.stats.resources.shards += this.calculateShards(25);
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

  private handlePickupCollect(player: any, pickup: any) {
    const pickupType = pickup.getData('pickupType') as PickupType;
    const pickupLight = pickup.getData('light');

    this.soundManager.playCollect();

    // Particle effect based on pickup type
    const colorMap: { [key: string]: number[] } = {
      [PickupType.SPREAD_SHOT]: [0x818cf8, 0xa5b4fc, 0xffffff],
      [PickupType.RAPID_FIRE]: [0xfbbf24, 0xfde047, 0xffffff],
      [PickupType.SHIELD]: [0x4ade80, 0x86efac, 0xffffff],
      [PickupType.EMERGENCY_O2]: [0x38bdf8, 0x7dd3fc, 0xffffff],
      [PickupType.DRILL_BOOST]: [0xf472b6, 0xf9a8d4, 0xffffff],
      [PickupType.MAGNET]: [0xef4444, 0xfca5a5, 0xffffff],
    };

    this.add.particles(0, 0, 'particle', {
      x: pickup.x, y: pickup.y, speed: 120, color: colorMap[pickupType] || [0xffffff], lifespan: 500
    }).explode(20);

    // Remove the light
    if (pickupLight) {
      pickupLight.setIntensity(0);
    }

    pickup.destroy();

    // Handle different pickup types
    let displayName = '';
    let duration: number | undefined;

    switch (pickupType) {
      case PickupType.SPREAD_SHOT:
        displayName = 'SPREAD SHOT';
        duration = 15000; // 15 seconds
        this.activePickups.push({ type: pickupType, duration });
        break;

      case PickupType.RAPID_FIRE:
        displayName = 'RAPID FIRE';
        duration = 12000; // 12 seconds
        this.activePickups.push({ type: pickupType, duration });
        break;

      case PickupType.SHIELD:
        displayName = 'SHIELD';
        // Check if already has shield, add stack
        const existingShield = this.activePickups.find(p => p.type === PickupType.SHIELD);
        if (existingShield) {
          existingShield.stacks = (existingShield.stacks || 1) + 1;
        } else {
          this.activePickups.push({ type: pickupType, stacks: 1 });
        }
        break;

      case PickupType.EMERGENCY_O2:
        displayName = '+50 OXYGEN';
        // Immediate effect - no duration
        this.stats.oxygen = Math.min(this.stats.oxygen + 50, this.stats.maxOxygen);
        this.updateReactStats();
        break;

      case PickupType.DRILL_BOOST:
        displayName = 'DRILL BOOST';
        duration = 20000; // 20 seconds
        this.activePickups.push({ type: pickupType, duration });
        break;

      case PickupType.MAGNET:
        displayName = 'MAGNET';
        duration = 25000; // 25 seconds
        this.activePickups.push({ type: pickupType, duration });
        break;
    }

    // Show collection text
    const txt = this.add.text(player.x, player.y - 30, displayName, {
      fontSize: '16px',
      color: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.tweens.add({ targets: txt, y: txt.y - 40, alpha: 0, duration: 1200, onComplete: () => txt.destroy() });

    // Camera effect
    this.cameras.main.flash(100, 255, 255, 255, false);
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
      // Calculate dash cooldown progress (0 = on cooldown, 1 = ready)
      const dashCooldown = this.player ?
        (this.player.canDash(this.time.now) ? 1 :
          1 - (this.player.getDashCooldownRemaining(this.time.now) / this.player.getDashCooldownTotal())) : 1;

      window.dispatchEvent(new CustomEvent(EVENTS.STATS_UPDATE, {
        detail: {
          ...this.stats,
          activePickups: this.activePickups,
          dashCooldown,
          currentBiome: this.currentBiome,
          abilityCooldowns: this.getAbilityCooldowns()
        }
      }));
  }

  private calculateShards(base: number): number {
      // Use computed shard multiplier (includes drill, shard level, and skill tree bonuses)
      return Math.floor(base * this.computedStats.shardMultiplier);
  }

  private updatePickupDurations(delta: number) {
    // Update durations and remove expired pickups
    for (let i = this.activePickups.length - 1; i >= 0; i--) {
      const pickup = this.activePickups[i];
      if (pickup.duration !== undefined) {
        pickup.duration -= delta;
        if (pickup.duration <= 0) {
          this.activePickups.splice(i, 1);
        }
      }
    }
  }

  private updateBiomeEffects(delta: number) {
    // Determine current biome
    const depth = Math.floor(this.player.y / TILE_SIZE);
    let biome = BIOMES[0];
    for (const b of BIOMES) {
      if (depth >= b.start) biome = b;
    }

    // Check if biome changed
    if (biome.name !== this.currentBiome) {
      this.currentBiome = biome.name;

      // Show biome transition notification
      const biomeTxt = this.add.text(
        this.cameras.main.scrollX + GAME_CONFIG.width / 2,
        this.cameras.main.scrollY + 80,
        `// ${biome.name} //`,
        {
          fontSize: '20px',
          color: '#' + biome.colors.soft.toString(16).padStart(6, '0'),
          fontStyle: 'bold',
          fontFamily: 'monospace',
          stroke: '#000000',
          strokeThickness: 3
        }
      ).setOrigin(0.5).setScrollFactor(0).setDepth(150);

      this.tweens.add({
        targets: biomeTxt,
        alpha: { from: 0, to: 1 },
        y: biomeTxt.y + 10,
        duration: 500,
        yoyo: true,
        hold: 1500,
        onComplete: () => biomeTxt.destroy()
      });
    }

    // Apply biome-specific gameplay modifiers
    const baseSpeed = this.computedStats.moveSpeed;

    switch (biome.name) {
      case 'FROZEN DEPTHS':
        // Cold slows movement by 20%
        this.player.setMoveSpeed(baseSpeed * 0.8);
        break;
      case 'CORE ZONE':
        // Heat speeds up (but also increases O2 drain - handled in tickOxygen)
        this.player.setMoveSpeed(baseSpeed * 1.1);
        break;
      default:
        this.player.setMoveSpeed(baseSpeed);
    }

    // Biome-specific particles around player
    this.biomeParticleTimer += delta;
    if (this.biomeParticleTimer > 500) { // Every 500ms
      this.biomeParticleTimer = 0;
      this.spawnBiomeParticles(biome);
    }
  }

  private spawnBiomeParticles(biome: typeof BIOMES[0]) {
    const px = this.player.x;
    const py = this.player.y;

    switch (biome.name) {
      case 'SURFACE':
        // Dust motes
        this.add.particles(px + Phaser.Math.Between(-50, 50), py + Phaser.Math.Between(-50, 50), 'particle', {
          speed: { min: 5, max: 15 },
          scale: { start: 0.2, end: 0 },
          lifespan: 2000,
          alpha: { start: 0.3, end: 0 },
          tint: 0x8b7355,
        }).explode(2);
        break;

      case 'MINERAL CAVERNS':
        // Ember particles
        this.add.particles(px + Phaser.Math.Between(-60, 60), py + Phaser.Math.Between(-60, 60), 'particle', {
          speed: { min: 10, max: 30 },
          scale: { start: 0.3, end: 0 },
          lifespan: 1500,
          alpha: { start: 0.6, end: 0 },
          tint: [0xed8936, 0xfbbf24, 0xef4444],
          blendMode: 'ADD'
        }).explode(3);
        break;

      case 'FROZEN DEPTHS':
        // Ice crystals / snowflakes
        this.add.particles(px + Phaser.Math.Between(-70, 70), py - 40, 'particle', {
          speedY: { min: 20, max: 40 },
          speedX: { min: -10, max: 10 },
          scale: { start: 0.25, end: 0.1 },
          lifespan: 2500,
          alpha: { start: 0.7, end: 0 },
          tint: [0xa5f3fc, 0x7dd3fc, 0xffffff],
        }).explode(4);
        break;

      case 'CORE ZONE':
        // Radioactive/heat particles
        this.add.particles(px + Phaser.Math.Between(-50, 50), py + Phaser.Math.Between(-50, 50), 'particle', {
          speed: { min: 20, max: 50 },
          scale: { start: 0.4, end: 0 },
          lifespan: 800,
          alpha: { start: 0.8, end: 0 },
          tint: [0x9f7aea, 0xd53f8c, 0xf472b6],
          blendMode: 'ADD'
        }).explode(5);
        break;
    }
  }

  private updateMagnetEffect() {
    if (!this.hasActivePickup(PickupType.MAGNET)) return;

    const magnetRadius = 3; // tiles
    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);

    // Check tiles in radius around player
    for (let dx = -magnetRadius; dx <= magnetRadius; dx++) {
      for (let dy = -magnetRadius; dy <= magnetRadius; dy++) {
        const tileX = playerTileX + dx;
        const tileY = playerTileY + dy;
        const tile = this.layer.getTileAt(tileX, tileY);

        if (tile && (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM)) {
          // Create attraction particle effect
          const centerX = tile.getCenterX();
          const centerY = tile.getCenterY();

          // Visual: particles flying toward player
          const color = tile.index === TileType.ORE_COPPER ? 0x22d3ee : 0xf472b6;
          this.add.particles(0, 0, 'particle', {
            x: centerX, y: centerY,
            moveToX: this.player.x,
            moveToY: this.player.y,
            speed: 200,
            scale: { start: 0.6, end: 0.2 },
            lifespan: 300,
            tint: color,
          }).explode(5);

          // Collect the ore
          this.soundManager.playCollect();
          this.stats.resources.minerals++;
          this.stats.resources.shards += this.calculateShards(5);
          this.layer.removeTileAt(tileX, tileY);
          this.updateReactStats();
        }
      }
    }
  }

  private hasActivePickup(type: PickupType): boolean {
    return this.activePickups.some(p => p.type === type);
  }

  private getActivePickup(type: PickupType): ActivePickup | undefined {
    return this.activePickups.find(p => p.type === type);
  }

  // Public method for Player to check drill boost status
  public hasDrillBoost(): boolean {
    return this.hasActivePickup(PickupType.DRILL_BOOST);
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

  // ==================== SKILL TREE ABILITIES ====================

  private updateAbilityCooldowns(delta: number) {
    // Reduce all cooldowns by delta time
    for (const key of Object.keys(this.abilityCooldowns) as (keyof typeof this.abilityCooldowns)[]) {
      if (this.abilityCooldowns[key] > 0) {
        this.abilityCooldowns[key] = Math.max(0, this.abilityCooldowns[key] - delta);
      }
    }
  }

  private updateAbilityEffects(delta: number) {
    // Update proximity bombs
    for (let i = this.activeBombs.length - 1; i >= 0; i--) {
      const bomb = this.activeBombs[i];
      if (!bomb.active) {
        this.activeBombs.splice(i, 1);
        continue;
      }

      // Check for enemy proximity
      let shouldExplode = false;
      const bombX = bomb.x;
      const bombY = bomb.y;

      this.enemies.children.iterate((e) => {
        const enemy = e as Phaser.Physics.Arcade.Sprite;
        if (enemy.active) {
          const dist = Phaser.Math.Distance.Between(bombX, bombY, enemy.x, enemy.y);
          if (dist < 40) shouldExplode = true;
        }
        return true;
      });

      this.fygars.children.iterate((f) => {
        const fygar = f as Phaser.Physics.Arcade.Sprite;
        if (fygar.active) {
          const dist = Phaser.Math.Distance.Between(bombX, bombY, fygar.x, fygar.y);
          if (dist < 40) shouldExplode = true;
        }
        return true;
      });

      // Timer-based explosion (2 seconds)
      const timer = bomb.getData('timer') - delta;
      bomb.setData('timer', timer);
      if (timer <= 0) shouldExplode = true;

      if (shouldExplode) {
        this.explodeBomb(bomb);
        this.activeBombs.splice(i, 1);
      }
    }

    // Update resource beacon collection
    if (this.activeBeacon && this.activeBeacon.active) {
      const beaconTimer = this.activeBeacon.getData('timer') - delta;
      this.activeBeacon.setData('timer', beaconTimer);

      if (beaconTimer <= 0) {
        this.activeBeacon.destroy();
        this.activeBeacon = null;
      } else {
        // Auto-collect resources in radius
        this.collectResourcesInRadius(this.activeBeacon.x, this.activeBeacon.y, 4 * TILE_SIZE);
      }
    }

    // Update energy barrier
    if (this.activeBarrier && this.activeBarrier.active) {
      const barrierTimer = this.activeBarrier.getData('timer') - delta;
      this.activeBarrier.setData('timer', barrierTimer);

      if (barrierTimer <= 0) {
        this.activeBarrier.destroy();
        this.activeBarrier = null;
      }
    }
  }

  // GROUND SLAM - [E] Destroys tiles in 2-tile radius
  private useGroundSlam() {
    if (!this.computedStats.hasGroundSlam) return;
    if (this.abilityCooldowns.groundSlam > 0) return;

    const cooldownMs = 8000; // 8 seconds
    this.abilityCooldowns.groundSlam = cooldownMs;

    const playerTileX = Math.floor(this.player.x / TILE_SIZE);
    const playerTileY = Math.floor(this.player.y / TILE_SIZE);
    const radius = 2;

    // Screen shake and flash
    this.cameras.main.shake(200, 0.02);
    this.cameras.main.flash(100, 255, 100, 50);
    this.soundManager.playBoulderLand();

    // Destroy tiles in radius
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        if (dx * dx + dy * dy <= radius * radius) {
          const tileX = playerTileX + dx;
          const tileY = playerTileY + dy;
          const tile = this.layer.getTileAt(tileX, tileY);

          if (tile && tile.index !== TileType.BEDROCK) {
            // Create destruction particles
            const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
            const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;

            this.add.particles(worldX, worldY, 'particle', {
              speed: { min: 50, max: 150 },
              angle: { min: 0, max: 360 },
              scale: { start: 0.5, end: 0 },
              lifespan: 400,
              tint: 0xf472b6, // Pink for excavator
              quantity: 3
            }).explode(3);

            // Give resources for ore tiles
            if (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM) {
              this.stats.resources.shards += this.calculateShards(5);
              this.stats.resources.minerals++;
            }

            this.layer.removeTileAt(tileX, tileY);
          }
        }
      }
    }

    // Damage enemies in radius
    const worldRadius = radius * TILE_SIZE;
    this.enemies.children.iterate((e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite;
      if (enemy.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, enemy.x, enemy.y);
        if (dist < worldRadius) {
          enemy.destroy();
          this.stats.resources.shards += this.calculateShards(10);
        }
      }
      return true;
    });

    this.fygars.children.iterate((f) => {
      const fygar = f as Phaser.Physics.Arcade.Sprite;
      if (fygar.active) {
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, fygar.x, fygar.y);
        if (dist < worldRadius) {
          fygar.destroy();
          this.stats.resources.shards += this.calculateShards(25);
        }
      }
      return true;
    });

    this.updateReactStats();
  }

  // PROXIMITY BOMBS - [Q] Drop a bomb that detonates on contact or after 2s
  private useProximityBomb() {
    if (!this.computedStats.hasProximityBombs) return;
    if (this.abilityCooldowns.proximityBombs > 0) return;
    if (this.activeBombs.length >= 3) return; // Max 3 active bombs

    const cooldownMs = 2000; // 2 seconds between drops
    this.abilityCooldowns.proximityBombs = cooldownMs;

    // Create bomb sprite
    const bomb = this.add.sprite(this.player.x, this.player.y, 'particle');
    bomb.setScale(1.5);
    bomb.setTint(0xef4444); // Red for vanguard
    bomb.setData('timer', 2000); // 2 second fuse

    // Pulsing animation
    this.tweens.add({
      targets: bomb,
      scale: { from: 1.2, to: 1.8 },
      duration: 200,
      yoyo: true,
      repeat: -1
    });

    this.activeBombs.push(bomb);
    this.soundManager.playDig();
  }

  private explodeBomb(bomb: Phaser.GameObjects.Sprite) {
    const bombX = bomb.x;
    const bombY = bomb.y;
    const radius = 1.5 * TILE_SIZE;

    // Explosion effect
    this.cameras.main.shake(100, 0.01);
    this.add.particles(bombX, bombY, 'particle', {
      speed: { min: 100, max: 200 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.8, end: 0 },
      lifespan: 300,
      tint: [0xef4444, 0xfbbf24, 0xffffff],
      quantity: 15
    }).explode(15);

    this.soundManager.playBoulderLand();

    // Damage enemies in radius
    this.enemies.children.iterate((e) => {
      const enemy = e as Phaser.Physics.Arcade.Sprite;
      if (enemy.active) {
        const dist = Phaser.Math.Distance.Between(bombX, bombY, enemy.x, enemy.y);
        if (dist < radius) {
          enemy.destroy();
          this.stats.resources.shards += this.calculateShards(10);
        }
      }
      return true;
    });

    this.fygars.children.iterate((f) => {
      const fygar = f as Phaser.Physics.Arcade.Sprite;
      if (fygar.active) {
        const dist = Phaser.Math.Distance.Between(bombX, bombY, fygar.x, fygar.y);
        if (dist < radius) {
          fygar.destroy();
          this.stats.resources.shards += this.calculateShards(25);
        }
      }
      return true;
    });

    // Destroy tiles in radius
    const tileCenterX = Math.floor(bombX / TILE_SIZE);
    const tileCenterY = Math.floor(bombY / TILE_SIZE);
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const tile = this.layer.getTileAt(tileCenterX + dx, tileCenterY + dy);
        if (tile && tile.index !== TileType.BEDROCK && tile.index !== TileType.STONE) {
          this.layer.removeTileAt(tileCenterX + dx, tileCenterY + dy);
        }
      }
    }

    bomb.destroy();
    this.updateReactStats();
  }

  // ENERGY BARRIER - [G] Deploy a shield that blocks projectiles
  private useEnergyBarrier() {
    if (!this.computedStats.hasEnergyBarrier) return;
    if (this.abilityCooldowns.energyBarrier > 0) return;
    if (this.activeBarrier) return; // Only one at a time

    const cooldownMs = 12000; // 12 seconds
    this.abilityCooldowns.energyBarrier = cooldownMs;

    // Create barrier sprite
    const barrier = this.add.sprite(this.player.x, this.player.y, 'particle');
    barrier.setScale(4);
    barrier.setTint(0x4ade80); // Green for endurance
    barrier.setAlpha(0.6);
    barrier.setData('timer', 5000); // 5 seconds duration

    // Add a light to the barrier
    const barrierLight = this.lights.addLight(barrier.x, barrier.y, 100, 0x4ade80, 1);
    barrier.setData('light', barrierLight);

    // Pulsing animation
    this.tweens.add({
      targets: barrier,
      alpha: { from: 0.4, to: 0.8 },
      scale: { from: 3.5, to: 4.5 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    this.activeBarrier = barrier;
    this.soundManager.playCollect();

    // Add overlap detection with fire breath projectiles
    // The barrier will be used in handlePlayerHit to block damage
  }

  // GRAPPLE HOOK - [R] Pull to solid surfaces
  private useGrappleHook() {
    if (!this.computedStats.hasGrappleHook) return;
    if (this.abilityCooldowns.grappleHook > 0) return;

    const cooldownMs = 5000; // 5 seconds

    // Find nearest solid tile in facing direction
    const facing = this.player.lastFacing || 'right';

    let dirX = 0, dirY = 0;
    switch (facing) {
      case 'left': dirX = -1; break;
      case 'right': dirX = 1; break;
      case 'up': dirY = -1; break;
      case 'down': dirY = 1; break;
    }

    // Raycast to find solid tile
    const maxRange = 8; // tiles
    let targetX = this.player.x;
    let targetY = this.player.y;
    let foundTarget = false;

    for (let i = 1; i <= maxRange; i++) {
      const checkX = Math.floor(this.player.x / TILE_SIZE) + dirX * i;
      const checkY = Math.floor(this.player.y / TILE_SIZE) + dirY * i;
      const tile = this.layer.getTileAt(checkX, checkY);

      if (tile && tile.index !== -1) {
        // Found solid tile, target the space just before it
        targetX = (checkX - dirX * 0.5) * TILE_SIZE + TILE_SIZE / 2;
        targetY = (checkY - dirY * 0.5) * TILE_SIZE + TILE_SIZE / 2;
        foundTarget = true;
        break;
      }
    }

    if (!foundTarget) return; // No valid target

    this.abilityCooldowns.grappleHook = cooldownMs;

    // Visual grapple line
    const line = this.add.graphics();
    line.lineStyle(2, 0xfbbf24, 1);
    line.beginPath();
    line.moveTo(this.player.x, this.player.y);
    line.lineTo(targetX, targetY);
    line.stroke();

    // Tween player to target
    this.tweens.add({
      targets: this.player,
      x: targetX,
      y: targetY,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        line.destroy();
      }
    });

    this.soundManager.playShoot();
  }

  // RESOURCE BEACON - [F] Deploy auto-collect beacon
  private useResourceBeacon() {
    if (!this.computedStats.hasResourceBeacon) return;
    if (this.abilityCooldowns.resourceBeacon > 0) return;
    if (this.activeBeacon) return; // Only one at a time

    const cooldownMs = 30000; // 30 seconds
    this.abilityCooldowns.resourceBeacon = cooldownMs;

    // Create beacon sprite
    const beacon = this.add.sprite(this.player.x, this.player.y, 'particle');
    beacon.setScale(2);
    beacon.setTint(0x818cf8); // Purple for prospector
    beacon.setData('timer', 15000); // 15 seconds duration

    // Add a light
    const beaconLight = this.lights.addLight(beacon.x, beacon.y, 150, 0x818cf8, 1.5);
    beacon.setData('light', beaconLight);

    // Rotating animation
    this.tweens.add({
      targets: beacon,
      angle: 360,
      duration: 2000,
      repeat: -1
    });

    // Pulsing ring effect
    this.time.addEvent({
      delay: 500,
      repeat: 29, // 15 seconds / 0.5s
      callback: () => {
        if (beacon.active) {
          const ring = this.add.circle(beacon.x, beacon.y, 10, 0x818cf8, 0.5);
          this.tweens.add({
            targets: ring,
            radius: 4 * TILE_SIZE,
            alpha: 0,
            duration: 500,
            onComplete: () => ring.destroy()
          });
        }
      }
    });

    this.activeBeacon = beacon;
    this.soundManager.playCollect();
  }

  private collectResourcesInRadius(x: number, y: number, radius: number) {
    // Auto-collect nearby ore tiles
    const centerTileX = Math.floor(x / TILE_SIZE);
    const centerTileY = Math.floor(y / TILE_SIZE);
    const tileRadius = Math.ceil(radius / TILE_SIZE);

    for (let dx = -tileRadius; dx <= tileRadius; dx++) {
      for (let dy = -tileRadius; dy <= tileRadius; dy++) {
        const dist = Math.sqrt(dx * dx + dy * dy) * TILE_SIZE;
        if (dist > radius) continue;

        const tileX = centerTileX + dx;
        const tileY = centerTileY + dy;
        const tile = this.layer.getTileAt(tileX, tileY);

        if (tile && (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM)) {
          // Auto-collect ore
          const worldX = tileX * TILE_SIZE + TILE_SIZE / 2;
          const worldY = tileY * TILE_SIZE + TILE_SIZE / 2;

          this.add.particles(worldX, worldY, 'particle', {
            moveToX: x,
            moveToY: y,
            speed: 150,
            scale: { start: 0.5, end: 0.1 },
            lifespan: 300,
            tint: 0x818cf8,
            quantity: 3
          }).explode(3);

          this.stats.resources.shards += this.calculateShards(5);
          this.stats.resources.minerals++;
          this.layer.removeTileAt(tileX, tileY);
        }
      }
    }

    this.updateReactStats();
  }

  // Get ability cooldowns for HUD display
  public getAbilityCooldowns() {
    return {
      groundSlam: { current: this.abilityCooldowns.groundSlam, max: 8000, has: this.computedStats?.hasGroundSlam },
      proximityBombs: { current: this.abilityCooldowns.proximityBombs, max: 2000, has: this.computedStats?.hasProximityBombs },
      energyBarrier: { current: this.abilityCooldowns.energyBarrier, max: 12000, has: this.computedStats?.hasEnergyBarrier },
      grappleHook: { current: this.abilityCooldowns.grappleHook, max: 5000, has: this.computedStats?.hasGrappleHook },
      resourceBeacon: { current: this.abilityCooldowns.resourceBeacon, max: 30000, has: this.computedStats?.hasResourceBeacon }
    };
  }
}