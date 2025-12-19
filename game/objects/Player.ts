import Phaser from 'phaser';
import { GAME_CONFIG, TILE_SIZE, TILE_HARDNESS } from '../../constants';
import { TileType } from '../../types';

export class Player extends Phaser.Physics.Arcade.Sprite {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { up: Phaser.Input.Keyboard.Key; down: Phaser.Input.Keyboard.Key; left: Phaser.Input.Keyboard.Key; right: Phaser.Input.Keyboard.Key };
  private shiftKey!: Phaser.Input.Keyboard.Key;
  public lastFacing: 'left' | 'right' | 'up' | 'down' = 'right';
  public light: Phaser.GameObjects.Light;
  private moveSpeed: number;
  private _scene: Phaser.Scene; // Explicit scene reference

  // Tile damage tracking
  private tileDamage: Map<string, number> = new Map();
  private lastDigTime: number = 0;
  private digCooldown: number = 150; // ms between dig hits

  // Dash ability
  private lastDashTime: number = 0;
  private dashCooldown: number = 3000; // 3 seconds cooldown
  private dashDistance: number = 80; // pixels
  private isDashing: boolean = false;

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

    // Apply Light2D pipeline to match tilemap lighting
    this.setPipeline('Light2D');

    this.body.setCollideWorldBounds(true);
    (this as any).setOrigin(0.5, 0.5);
    this.body.setSize(24, 24); 

    // Initialize input - with fallback for delayed keyboard availability
    this.initializeInput();

    // Fallback: If input wasn't ready, try again on first update
    if (!this.cursors || !this.wasd) {
      scene.events.once('update', () => {
        this.initializeInput();
      });
    }

    // Add Light
    this.light = this._scene.lights.addLight(x, y, 200).setColor(0xffffff).setIntensity(1.5);
  }

  public setMoveSpeed(speed: number) {
      this.moveSpeed = speed;
  }

  private initializeInput() {
    if (this._scene.input && this._scene.input.keyboard && !this.cursors) {
      this.cursors = this._scene.input.keyboard.createCursorKeys();
      this.wasd = this._scene.input.keyboard.addKeys({
        up: Phaser.Input.Keyboard.KeyCodes.W,
        down: Phaser.Input.Keyboard.KeyCodes.S,
        left: Phaser.Input.Keyboard.KeyCodes.A,
        right: Phaser.Input.Keyboard.KeyCodes.D
      }) as any;
      this.shiftKey = this._scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }
  }

  preUpdate(time: number, delta: number) {
    super.preUpdate(time, delta);
    if (this.light) {
        this.light.setPosition(this.x, this.y);
    }
  }

  update(time: number, delta: number, layer: Phaser.Tilemaps.TilemapLayer) {
    if (!this.active) return;

    // Handle dash
    if (this.shiftKey?.isDown && !this.isDashing && time - this.lastDashTime >= this.dashCooldown) {
      this.performDash(time);
    }

    // Skip movement during dash
    if (this.isDashing) return;

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
           // Stop movement while digging - can't pass until tile is destroyed
           this.body.setVelocity(0);
           const tileDestroyed = this.processDigging(tile, layer, time);
           // Only allow movement if tile was just destroyed
           if (tileDestroyed) {
             this.body.setVelocity(dx * speed, dy * speed);
           }
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

  private processDigging(tile: Phaser.Tilemaps.Tile, layer: Phaser.Tilemaps.TilemapLayer, time: number): boolean {
    if (!this._scene) return false;

    // Check dig cooldown - halved if drill boost active
    const hasDrillBoost = (this._scene as any).hasDrillBoost?.() ?? false;
    const effectiveCooldown = hasDrillBoost ? this.digCooldown / 2 : this.digCooldown;
    if (time - this.lastDigTime < effectiveCooldown) return false;
    this.lastDigTime = time;

    // Get tile hardness
    const hardness = TILE_HARDNESS[tile.index] ?? 1;
    const tileKey = `${tile.x},${tile.y}`;

    // Get current damage (hits taken)
    let currentDamage = this.tileDamage.get(tileKey) || 0;
    currentDamage++;

    // Particle effect (smaller when just damaging)
    const particleCount = currentDamage >= hardness ? 8 : 3;
    const emitter = this._scene.add.particles(tile.getCenterX(), tile.getCenterY(), 'particle', {
        speed: { min: 50, max: 100 },
        scale: { start: 0.5, end: 0 },
        lifespan: 300,
        quantity: particleCount,
        tint: tile.tint
    });
    emitter.explode(particleCount);
    this._scene.events.emit('play-sound', 'dig');

    if (currentDamage >= hardness) {
        // Tile is broken - remove it
        this.tileDamage.delete(tileKey);

        // If Ore, collect it
        if (tile.index === TileType.ORE_COPPER || tile.index === TileType.ORE_LITHIUM || tile.index === TileType.ICE) {
            this._scene.events.emit('collect-ore', tile.index);
        }

        layer.removeTileAt(tile.x, tile.y);
        return true; // Tile was destroyed
    } else {
        // Tile is damaged but not broken - update damage tracking
        this.tileDamage.set(tileKey, currentDamage);

        // Visual feedback - darken tile and add cracks overlay
        const damagePercent = currentDamage / hardness;
        tile.setAlpha(1 - (damagePercent * 0.4)); // Fade slightly as damaged

        // Screen shake on hard materials
        if (hardness >= 2) {
            this._scene.cameras.main.shake(50, 0.002);
        }

        // Show damage indicator
        const dmgText = this._scene.add.text(tile.getCenterX(), tile.getCenterY() - 10,
            `${hardness - currentDamage}`, {
            fontSize: '12px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 2
        }).setOrigin(0.5);
        this._scene.tweens.add({
            targets: dmgText,
            y: dmgText.y - 15,
            alpha: 0,
            duration: 400,
            onComplete: () => dmgText.destroy()
        });
        return false; // Tile still exists
    }
  }

  public getFacing() {
      return this.lastFacing;
  }

  private performDash(time: number) {
    this.isDashing = true;
    this.lastDashTime = time;

    // Calculate dash direction based on facing
    let dashX = 0, dashY = 0;
    switch (this.lastFacing) {
      case 'left': dashX = -this.dashDistance; break;
      case 'right': dashX = this.dashDistance; break;
      case 'up': dashY = -this.dashDistance; break;
      case 'down': dashY = this.dashDistance; break;
    }

    // Visual effects
    this._scene.events.emit('play-sound', 'dig'); // Reuse dig sound for now

    // Create dash trail particles
    const trailColor = 0x4fd1c5;
    this._scene.add.particles(this.x, this.y, 'particle', {
      speed: { min: 30, max: 80 },
      scale: { start: 0.6, end: 0 },
      lifespan: 300,
      quantity: 10,
      tint: trailColor,
      blendMode: 'ADD'
    }).explode(10);

    // Tween the player position
    this._scene.tweens.add({
      targets: this,
      x: this.x + dashX,
      y: this.y + dashY,
      duration: 100,
      ease: 'Power2',
      onUpdate: () => {
        // Update light position during dash
        if (this.light) {
          this.light.setPosition(this.x, this.y);
        }
      },
      onComplete: () => {
        this.isDashing = false;
        // End trail particles
        this._scene.add.particles(this.x, this.y, 'particle', {
          speed: { min: 50, max: 100 },
          scale: { start: 0.4, end: 0 },
          lifespan: 200,
          quantity: 8,
          tint: trailColor,
          blendMode: 'ADD'
        }).explode(8);
      }
    });

    // Screen shake for impact feel
    this._scene.cameras.main.shake(50, 0.003);
  }

  // Getters for dash state (for UI)
  public getDashCooldownRemaining(currentTime: number): number {
    const timeSinceDash = currentTime - this.lastDashTime;
    return Math.max(0, this.dashCooldown - timeSinceDash);
  }

  public getDashCooldownTotal(): number {
    return this.dashCooldown;
  }

  public canDash(currentTime: number): boolean {
    return currentTime - this.lastDashTime >= this.dashCooldown;
  }
}