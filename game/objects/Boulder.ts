import Phaser from 'phaser';
import { TILE_SIZE } from '../../constants';
import { TileType } from '../../types';
import { SoundManager } from '../utils/SoundManager';

export class Boulder extends Phaser.Physics.Arcade.Sprite {
    private isFalling: boolean = false;
    private wobbleTimer: number = 0;
    private fallDelay: number = 500;
    private startFallTime: number = 0;
    private soundManager: SoundManager;
    private _scene: Phaser.Scene;

    declare public body: Phaser.Physics.Arcade.Body;
    declare x: number;
    declare y: number;
    declare active: boolean;

    constructor(scene: Phaser.Scene, x: number, y: number, soundManager: SoundManager) {
        super(scene, x, y, 'rock');
        this._scene = scene;
        this.soundManager = soundManager;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Apply Light2D pipeline
        this.setPipeline('Light2D');

        (this as any).setOrigin(0, 0);
        this.body.setSize(30, 30);
        this.body.setOffset(1, 1);
        this.body.allowGravity = false;
        this.body.setImmovable(true);
    }

    update(time: number, delta: number, layer: Phaser.Tilemaps.TilemapLayer) {
        if (!this.active) return;

        const tileX = Math.floor((this.x + 16) / TILE_SIZE);
        const tileY = Math.floor((this.y + 32 + 4) / TILE_SIZE);

        const tileBelow = layer.getTileAt(tileX, tileY);

        if (!this.isFalling) {
            if (!tileBelow || tileBelow.index === TileType.EMPTY) {
                if (this.startFallTime === 0) {
                    this.startFallTime = time;
                }

                if (time - this.startFallTime < this.fallDelay) {
                    this.x += Math.sin(time / 20) * 1;
                } else {
                    this.isFalling = true;
                    this.body.setVelocityY(250);
                }
            } else {
                this.startFallTime = 0;
                this.x = tileX * TILE_SIZE; 
            }
        } else {
            if (tileBelow && tileBelow.index !== TileType.EMPTY && (this.y % TILE_SIZE < 5)) {
                this.isFalling = false;
                this.body.setVelocityY(0);
                this.y = (tileY - 1) * TILE_SIZE;
                this.soundManager.playBoulderLand();
                if (this._scene && this._scene.cameras && this._scene.cameras.main) {
                     this._scene.cameras.main.shake(100, 0.005);
                }
                
                (this as any).destroy(); 
                
                if (this._scene) {
                    const emitter = this._scene.add.particles(this.x + 16, this.y + 32, 'particle', {
                        speed: 50,
                        lifespan: 400,
                        quantity: 10
                    });
                    emitter.explode();
                }
            }
        }
    }
}