import Phaser from 'phaser';
import { GAME_CONFIG, TILE_SIZE } from '../../constants';
import { TileType } from '../../types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys;
  private isDigging: boolean = false;
  private digTimer: number = 0;
  private lastFacing: 'left' | 'right' | 'up' | 'down' = 'right';
  public light: Phaser.GameObjects.Light;
  private moveSpeed: number;
  
  // Explicitly declare properties that TypeScript thinks are missing
  public body!: Phaser.Physics.Arcade.Body;
  public x!: number;
  public y!: number;
  public active!: boolean;
  public scene!: Phaser.Scene;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'player');

    this.moveSpeed = GAME_CONFIG.playerSpeed;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Cast 'this' to any to access methods TS thinks are missing
    (this as any).setCollideWorldBounds(true);
    (this as any).setOrigin(0.5, 0.5);
    
    // Slightly smaller hitbox to fit in tunnels
    this.body!.setSize(24, 24); 

    if (scene.input.keyboard) {
        this.cursors = scene.input.keyboard.createCursorKeys();
    }

    // Add Light
    this.light = (scene as any).lights.addLight(x, y, 200).setColor(0xffffff).setIntensity(1.5);
  }

  public setMoveSpeed(speed: number) {
      this.moveSpeed = speed;
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    this.light.setPosition(this.x, this.y);
  }

  update(time: number, delta: number, layer: Phaser.Tilemaps.TilemapLayer) {
    if (!this.active) return;

    const speed = this.moveSpeed;
    const body = this.body as Phaser.Physics.Arcade.Body;
    
    body.setVelocity(0);

    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown) {
      dx = -1;
      this.lastFacing = 'left';
    } else if (this.cursors.right.isDown) {
      dx = 1;
      this.lastFacing = 'right';
    } else if (this.cursors.up.isDown) {
      dy = -1;
      this.lastFacing = 'up';
    } else if (this.cursors.down.isDown) {
      dy = 1;
      this.lastFacing = 'down';
    }

    // Digging Logic
    if (dx !== 0 || dy !== 0) {
      // Predict next position
      const nextX = this.x + (dx * 16); // Check half a tile ahead
      const nextY = this.y + (dy * 16);

      const tile = layer.getTileAtWorldXY(nextX, nextY);

      if (tile) {
        // Tile exists, we are digging
        if (this.canDig(tile)) {
           // Slow down while digging
           body.setVelocity(dx * (speed * 0.5), dy * (speed * 0.5));
           this.processDigging(tile, layer, time);
        } else {
           // Hard rock, stop
           body.setVelocity(0);
        }
      } else {
        // Empty space, move full speed
        body.setVelocity(dx * speed, dy * speed);
      }
      
      // Rotation visual
      if (dx > 0) (this as any).setAngle(90);
      else if (dx < 0) (this as any).setAngle(-90);
      else if (dy > 0) (this as any).setAngle(180);
      else if (dy < 0) (this as any).setAngle(0);

    } else {
        // Idle animation could go here
    }
  }

  private canDig(tile: Phaser.Tilemaps.Tile): boolean {
    // Bedrock cannot be dug
    return tile.index !== TileType.BEDROCK;
  }

  private processDigging(tile: Phaser.Tilemaps.Tile, layer: Phaser.Tilemaps.TilemapLayer, time: number) {
    // Simple instant dig for flow, could add delay
    // Play particle effect
    const emitter = (this.scene as any).add.particles(0, 0, 'particle', {
        x: tile.getCenterX(),
        y: tile.getCenterY(),
        speed: { min: 50, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 300,
        quantity: 5,
        tint: tile.tint
    });
    emitter.explode(5);

    // If Ore, collect it
    if (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM || tile.index === TileType.ICE) {
        (this.scene as any).events.emit('collect-ore', tile.index);
    }
    
    // Destroy tile
    layer.removeTileAt(tile.x, tile.y);
  }

  public getFacing() {
      return this.lastFacing;
  }
}