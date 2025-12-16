import Phaser from 'phaser';
import { GAME_CONFIG, TILE_SIZE } from '../../constants';
import { TileType } from '../../types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private lastFacing: 'left' | 'right' | 'up' | 'down' = 'right';
  public light: Phaser.GameObjects.Light;
  private moveSpeed: number;
  private _scene: Phaser.Scene; // Explicit scene reference

  // Use declare for properties initialized by Phaser
  declare public body: Phaser.Physics.Arcade.Body;
  declare x: number;
  declare y: number;
  declare active: boolean;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');
    this._scene = scene;

    this.moveSpeed = GAME_CONFIG.playerSpeed;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCollideWorldBounds(true);
    (this as any).setOrigin(0.5, 0.5);
    this.body.setSize(24, 24); 

    if (scene.input && scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
        this.wasd = scene.input.keyboard.addKeys({
            up: Phaser.Input.Keyboard.KeyCodes.W,
            down: Phaser.Input.Keyboard.KeyCodes.S,
            left: Phaser.Input.Keyboard.KeyCodes.A,
            right: Phaser.Input.Keyboard.KeyCodes.D
        }) as any;
    }

    // Add Light
    this.light = this._scene.lights.addLight(x, y, 200).setColor(0xffffff).setIntensity(1.5);
  }

  public setMoveSpeed(speed: number) {
      this.moveSpeed = speed;
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.light) {
        this.light.setPosition(this.x, this.y);
    }
  }

  update(time: number, delta: number, layer: Phaser.Tilemaps.TilemapLayer) {
    if (!this.active) return;

    const speed = this.moveSpeed;
    
    this.body.setVelocity(0);

    let dx = 0;
    let dy = 0;

    // Guard against undefined input
    if (this.cursors && this.wasd) {
        const left = this.cursors.left.isDown || this.wasd.left.isDown;
        const right = this.cursors.right.isDown || this.wasd.right.isDown;
        const up = this.cursors.up.isDown || this.wasd.up.isDown;
        const down = this.cursors.down.isDown || this.wasd.down.isDown;

        if (left) {
          dx = -1;
          this.lastFacing = 'left';
        } else if (right) {
          dx = 1;
          this.lastFacing = 'right';
        } else if (up) {
          dy = -1;
          this.lastFacing = 'up';
        } else if (down) {
          dy = 1;
          this.lastFacing = 'down';
        }
    }

    // Digging Logic & Movement
    if (dx !== 0 || dy !== 0) {
      const checkDistance = 16; 
      const nextX = this.x + (dx * checkDistance); 
      const nextY = this.y + (dy * checkDistance);

      const tile = layer.getTileAtWorldXY(nextX, nextY);

      if (tile && tile.index !== TileType.EMPTY) {
        if (this.canDig(tile)) {
           // Resistance
           this.body.setVelocity(dx * (speed * 0.5), dy * (speed * 0.5));
           this.processDigging(tile, layer, time);
        } else {
           // Bedrock or other obstacle
           this.body.setVelocity(0);
        }
      } else {
        // Free movement
        this.body.setVelocity(dx * speed, dy * speed);
      }
      
      // Visual Rotation
      if (dx > 0) (this as any).angle = 90;
      else if (dx < 0) (this as any).angle = -90;
      else if (dy > 0) (this as any).angle = 180;
      else if (dy < 0) (this as any).angle = 0;

    }
  }

  private canDig(tile: Phaser.Tilemaps.Tile): boolean {
    return tile.index !== TileType.BEDROCK;
  }

  private processDigging(tile: Phaser.Tilemaps.Tile, layer: Phaser.Tilemaps.TilemapLayer, time: number) {
    // Use _scene to guarantee access
    if (this._scene) {
        const emitter = this._scene.add.particles(tile.getCenterX(), tile.getCenterY(), 'particle', {
            speed: { min: 50, max: 100 },
            scale: { start: 0.5, end: 0 },
            lifespan: 300,
            quantity: 5,
            tint: tile.tint
        });
        emitter.explode(5);
        this._scene.events.emit('play-sound', 'dig');
        
        // If Ore, collect it
        if (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM || tile.index === TileType.ICE) {
            this._scene.events.emit('collect-ore', tile.index);
        }
    }
    
    layer.removeTileAt(tile.x, tile.y);
  }

  public getFacing() {
      return this.lastFacing;
  }
}