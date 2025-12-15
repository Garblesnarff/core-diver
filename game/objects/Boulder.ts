import Phaser from 'phaser';
import { TILE_SIZE } from '../../constants';
import { TileType } from '../../types';
import { SoundManager } from '../utils/SoundManager';

export class Boulder extends Phaser.Physics.Arcade.Sprite {
    private isFalling: boolean = false;
    private wobbleTimer: number = 0;
    private fallDelay: number = 500; // ms before falling
    private startFallTime: number = 0;
    private soundManager: SoundManager;

    // Explicitly declare properties that TypeScript thinks are missing
    public body!: Phaser.Physics.Arcade.Body;
    public x!: number;
    public y!: number;
    public active!: boolean;
    public scene!: Phaser.Scene;

    constructor(scene: Phaser.Scene, x: number, y: number, soundManager: SoundManager) {
        super(scene, x, y, 'rock'); // Uses texture generated in AssetGenerator but we use tile for rendering usually. 
        // Actually, we spawn this as a sprite when the tile is "active". 
        // Strategy: The Map has BOULDER tiles. When map generates, we replace BOULDER tiles with Boulder Sprites.
        
        this.soundManager = soundManager;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        (this as any).setOrigin(0, 0); // Match tile origin
        this.body.setSize(30, 30);
        this.body.setOffset(1, 1);
        this.body.allowGravity = false;
        (this as any).setImmovable(true);
    }

    update(time: number, delta: number, layer: Phaser.Tilemaps.TilemapLayer) {
        if (!this.active) return;

        const tileX = Math.floor((this.x + 16) / TILE_SIZE);
        const tileY = Math.floor((this.y + 32 + 4) / TILE_SIZE); // Check below

        const tileBelow = layer.getTileAt(tileX, tileY);

        if (!this.isFalling) {
            // Check if ground below is gone
            if (!tileBelow || tileBelow.index === TileType.EMPTY) {
                if (this.startFallTime === 0) {
                    this.startFallTime = time;
                }

                // Wobble phase
                if (time - this.startFallTime < this.fallDelay) {
                    this.x += Math.sin(time / 20) * 1;
                } else {
                    // Start Falling
                    this.isFalling = true;
                    this.body.allowGravity = false; // We control movement manually for grid snap feel or use velocity
                    (this as any).setVelocityY(250);
                }
            } else {
                this.startFallTime = 0;
                this.x = tileX * TILE_SIZE; // Snap back to grid
            }
        } else {
            // Currently Falling
            if (tileBelow && tileBelow.index !== TileType.EMPTY && (this.y % TILE_SIZE < 5)) {
                // Hit ground
                this.isFalling = false;
                (this as any).setVelocityY(0);
                this.y = (tileY - 1) * TILE_SIZE; // Snap to top of tile
                this.soundManager.playBoulderLand();
                this.scene.cameras.main.shake(100, 0.005);
                
                // Turn back into a tile? Or stay as sprite? 
                // Dig Dug style: it breaks after falling once.
                (this as any).destroy(); 
                
                // Add dust effect
                const emitter = this.scene.add.particles(0, 0, 'particle', {
                    x: this.x + 16,
                    y: this.y + 32,
                    speed: 50,
                    lifespan: 400,
                    quantity: 10
                });
                emitter.explode();
            }
        }
    }
}