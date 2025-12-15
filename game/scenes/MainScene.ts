import Phaser from 'phaser';
import { Player } from '../objects/Player';
import { AssetGenerator } from '../utils/AssetGenerator';
import { EVENTS, GameStats, TileType, GameState, PlayerUpgrades } from '../../types';
import { GAME_CONFIG, COLORS, TILE_SIZE } from '../../constants';

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
  private beams!: Phaser.Physics.Arcade.Group;
  private artifact!: Phaser.Physics.Arcade.Sprite;
  private isGameOver: boolean = false;

  // Upgrades passed from React
  private upgrades: PlayerUpgrades = { oxygenLevel: 1, drillLevel: 1, speedLevel: 1, visionLevel: 1 };
  private difficulty: number = 1;

  constructor() {
    super('MainScene');
  }

  init(data: { upgrades: PlayerUpgrades, difficulty: number }) {
      if (data.upgrades) {
          this.upgrades = data.upgrades;
      }
      if (data.difficulty) {
          this.difficulty = data.difficulty;
      }
  }

  create() {
    this.isGameOver = false;
    
    // Apply upgrades to stats
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

    // Spawn player relative to the simplified map
    const startX = (this.map.widthInPixels / 2);
    const startY = TILE_SIZE * 3;
    
    if (this.layer) {
        const tileX = Math.floor(startX / TILE_SIZE);
        const tileY = Math.floor(startY / TILE_SIZE);
        this.layer.removeTileAt(tileX, tileY);
        this.layer.removeTileAt(tileX, tileY + 1);
    }

    this.player = new Player(this, startX, startY);
    
    // Apply Speed Upgrade
    const speed = GAME_CONFIG.playerSpeed + ((this.upgrades.speedLevel - 1) * 20);
    this.player.setMoveSpeed(speed);

    // Apply Vision Upgrade
    if ((this.player as any).light) {
        const radius = 250 + ((this.upgrades.visionLevel - 1) * 50);
        (this.player as any).light.setIntensity(2.0).setRadius(radius); 
    }
    
    this.cameras.main.startFollow(this.player, true, 0.1, 0.1);

    this.input.keyboard!.on('keydown-SPACE', this.fireBeam, this);
    this.input.keyboard!.on('keydown-ESC', () => {
        // Pause stub
    });

    this.enemies = this.physics.add.group();
    this.beams = this.physics.add.group();
    this.spawnEnemies();

    // Spawn Artifact at bottom
    const mapHeight = this.map.heightInPixels;
    this.artifact = this.physics.add.sprite(this.map.widthInPixels / 2, mapHeight - 100, 'artifact');
    this.artifact.setImmovable(true);
    // Add pulsing light to artifact
    this.lights.addLight(this.artifact.x, this.artifact.y, 150, 0x805ad5, 2);
    this.tweens.add({
        targets: this.artifact,
        scale: 1.1,
        alpha: 0.8,
        yoyo: true,
        repeat: -1,
        duration: 1000
    });

    this.oxygenTimer = this.time.addEvent({
        delay: 1000,
        callback: this.tickOxygen,
        callbackScope: this,
        loop: true
    });

    // Physics
    this.physics.add.collider(this.player, this.layer);
    this.physics.add.collider(this.enemies, this.layer);
    this.physics.add.overlap(this.beams, this.enemies, this.handleBeamHit, undefined, this);
    this.physics.add.collider(this.player, this.enemies, this.handlePlayerHit, undefined, this);
    this.physics.add.overlap(this.player, this.artifact, this.handleVictory, undefined, this);

    this.updateReactStats();

    this.events.off('collect-ore');
    this.events.on('collect-ore', (type: number) => {
        if (type === TileType.ICE) {
            this.stats.oxygen = Math.min(this.stats.oxygen + 20, this.stats.maxOxygen);
            const txt = this.add.text(this.player.x, this.player.y - 20, '+O2', { 
                fontSize: '16px', 
                color: '#a5f3fc',
                fontStyle: 'bold'
            }).setOrigin(0.5);
            this.tweens.add({
                targets: txt,
                y: txt.y - 30,
                alpha: 0,
                duration: 800,
                onComplete: () => txt.destroy()
            });
        } else {
            this.stats.resources.minerals++;
            this.stats.resources.shards += 5 * this.upgrades.drillLevel; // Shard multiplier
        }
        this.updateReactStats();
    });
  }

  update(time: number, delta: number) {
    if (this.isGameOver || this.stats.oxygen <= 0) return;

    this.player.update(time, delta, this.layer);
    this.updateEnemies();
    
    const currentDepth = Math.floor(this.player.y / TILE_SIZE);
    if (currentDepth !== this.stats.depth) {
        this.stats.depth = currentDepth;
        this.updateReactStats();
    }
  }

  private generateLevel() {
    const width = 40;
    // Difficulty Scaling: Map gets deeper every level
    const height = 100 + (this.difficulty * 20);
    
    if (!this.textures.exists('dynamic_tiles')) {
        const textureCanvas = document.createElement('canvas');
        textureCanvas.width = 256; 
        textureCanvas.height = 32;
        const ctx = textureCanvas.getContext('2d')!;
        
        const drawToCtx = (color: number, idx: number) => {
            const hex = '#' + color.toString(16).padStart(6, '0');
            ctx.fillStyle = hex;
            ctx.fillRect(idx * 32, 0, 32, 32);
            ctx.fillStyle = 'rgba(255,255,255,0.2)';
            ctx.fillRect(idx * 32, 0, 32, 4);
            ctx.fillRect(idx * 32, 0, 4, 32);
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(idx * 32 + 28, 0, 4, 32);
            ctx.fillRect(idx * 32, 28, 32, 4);
        };

        drawToCtx(COLORS.soil.soft, TileType.DIRT_SOFT);    
        drawToCtx(COLORS.soil.hard, TileType.DIRT_HARD);    
        drawToCtx(COLORS.soil.stone, TileType.STONE);       
        drawToCtx(COLORS.ore.copper, TileType.ORE_COPPER);  
        drawToCtx(COLORS.ore.lithium, TileType.ORE_LITHIUM);
        drawToCtx(COLORS.soil.ice, TileType.ICE);           
        drawToCtx(0x111111, TileType.BEDROCK);              

        this.textures.addCanvas('dynamic_tiles', textureCanvas);
    }

    const mapData: number[][] = [];

    for (let y = 0; y < height; y++) {
        const row: number[] = [];
        for (let x = 0; x < width; x++) {
            if (y < 2) {
                row.push(TileType.EMPTY);
                continue;
            }
            if (x === 0 || x === width - 1 || y === height - 1) {
                row.push(TileType.BEDROCK);
                continue;
            }

            // Clear area for Artifact at bottom
            if (y > height - 10 && x > (width/2 - 4) && x < (width/2 + 4)) {
                row.push(TileType.EMPTY);
                continue;
            }

            const noise = Math.random();
            if (noise > 0.88) {
                row.push(Math.random() > 0.5 ? TileType.ORE_COPPER : TileType.ORE_LITHIUM);
            } else if (noise > 0.82) {
                row.push(TileType.ICE);
            } else if (noise > 0.65) {
                row.push(TileType.DIRT_HARD);
            } else if (noise > 0.15) {
                row.push(TileType.DIRT_SOFT);
            } else {
                row.push(TileType.EMPTY);
            }
        }
        mapData.push(row);
    }

    this.map = this.make.tilemap({ data: mapData, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tiles = this.map.addTilesetImage('dynamic_tiles', 'dynamic_tiles', 32, 32);
    
    if (tiles) {
        this.layer = this.map.createLayer(0, tiles, 0, 0)!;
        this.layer.setCollisionByExclusion([-1]);
        this.layer.setPipeline('Light2D');
        this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
    }
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

  private spawnEnemies() {
      // Difficulty Scaling: More enemies per level
      const count = 10 + (this.difficulty * 5);

      for(let i=0; i<count; i++) {
          const x = Phaser.Math.Between(2, 38) * TILE_SIZE;
          const y = Phaser.Math.Between(20, (100 + this.difficulty * 20) - 10) * TILE_SIZE;
          const tile = this.layer.getTileAtWorldXY(x,y);
          if (!tile || tile.index === TileType.EMPTY) {
            const enemy = this.enemies.create(x, y, 'enemy');
            enemy.setTint(COLORS.enemy.pooka);
            enemy.setVelocity(Phaser.Math.Between(-30, 30), 0);
            enemy.setBounce(1);
            enemy.setCollideWorldBounds(true);
            (enemy.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            enemy.setData('inflation', 0);
          }
      }
  }

  // ... (Enemies update, Beam, Hit handlers same as before)
  private updateEnemies() {
      this.enemies.children.iterate((c) => {
          const enemy = c as Phaser.Physics.Arcade.Sprite;
          if(!enemy.active) return true;
          
          if (enemy.body?.blocked.left) enemy.setVelocityX(30);
          else if (enemy.body?.blocked.right) enemy.setVelocityX(-30);
          
          let inflation = enemy.getData('inflation') || 0;
          if (inflation > 0) {
              inflation -= 0.1;
              enemy.setData('inflation', inflation);
              enemy.setScale(1 + (inflation / 100));
              
              if (inflation > 20) {
                  enemy.setTint(0xffffff);
                  if (Math.floor(this.time.now / 100) % 2 === 0) enemy.setTint(COLORS.enemy.inflated);
              } else {
                  enemy.setTint(COLORS.enemy.inflated);
              }
          } else {
              enemy.clearTint();
              enemy.setScale(1);
          }

          return true;
      });
  }

  private fireBeam() {
      const facing = this.player.getFacing();
      let velocity = {x: 0, y: 0};
      let angle = 0;
      let offset = {x: 0, y: 0};

      if (facing === 'left') { velocity.x = -400; angle = 0; offset.x = -20; }
      else if (facing === 'right') { velocity.x = 400; angle = 0; offset.x = 20; }
      else if (facing === 'up') { velocity.y = -400; angle = 90; offset.y = -20; }
      else if (facing === 'down') { velocity.y = 400; angle = 90; offset.y = 20; }

      const beam = this.beams.create(this.player.x + offset.x, this.player.y + offset.y, facing === 'up' || facing === 'down' ? 'beam_v' : 'beam_h');
      beam.setVelocity(velocity.x, velocity.y);
      beam.setLifespan(300);
  }

  private handleBeamHit(beam: any, enemy: any) {
      beam.destroy();
      const e = enemy as Phaser.Physics.Arcade.Sprite;
      
      let inflation = e.getData('inflation') || 0;
      inflation += 34; // 3 shots to kill
      
      e.setVelocity(0);
      
      this.tweens.add({
          targets: e,
          scaleX: 1.2 + (inflation/100),
          scaleY: 1.2 + (inflation/100),
          duration: 50,
          yoyo: true,
          onComplete: () => {
              e.setScale(1 + (inflation / 100));
          }
      });
      
      if (inflation >= 100) {
          this.add.particles(0, 0, 'particle', {
            x: e.x,
            y: e.y,
            speed: 100,
            color: [0xff0000, 0xffff00],
            lifespan: 500
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
      
      this.stats.health -= 1;
      this.cameras.main.shake(200, 0.01);
      
      if (this.stats.health <= 0) {
          this.handleDeath("Killed by Creature");
      }
      this.updateReactStats();
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
      
      // FX
      this.cameras.main.flash(1000, 255, 255, 255);
      this.tweens.add({
          targets: artifact,
          scale: 3,
          alpha: 0,
          duration: 2000,
      });
      this.tweens.add({
          targets: player,
          alpha: 0,
          duration: 1000
      });

      this.time.delayedCall(1500, () => {
          this.scene.pause();
          window.dispatchEvent(new CustomEvent(EVENTS.VICTORY, { detail: { stats: this.stats }}));
      });
  }

  private updateReactStats() {
      window.dispatchEvent(new CustomEvent(EVENTS.STATS_UPDATE, { detail: this.stats }));
  }
}