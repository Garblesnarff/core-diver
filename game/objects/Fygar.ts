import Phaser from 'phaser';
import { COLORS } from '../../constants';

export class Fygar extends Phaser.Physics.Arcade.Sprite {
    private direction: number = 1; 
    private moveTimer: number = 0;
    private state: 'MOVE' | 'PREPARE_FIRE' | 'FIRE' = 'MOVE';
    private stateTimer: number = 0;
    private target: Phaser.Physics.Arcade.Sprite;
    private _scene: Phaser.Scene;

    declare public body: Phaser.Physics.Arcade.Body;
    declare x: number;
    declare y: number;
    declare active: boolean;

    constructor(scene: Phaser.Scene, x: number, y: number, target: Phaser.Physics.Arcade.Sprite) {
        super(scene, x, y, 'fygar');
        this._scene = scene;
        this.target = target;
        
        scene.add.existing(this);
        scene.physics.add.existing(this);

        // Apply Light2D pipeline
        this.setPipeline('Light2D');

        this.body.setVelocityX(20);
        this.body.setBounce(1, 1);
        this.body.setCollideWorldBounds(true);
        this.body.allowGravity = false;
        (this as any).setData('hp', 4);
    }

    update(time: number, delta: number) {
        if (!this.active) return;
        
        if (this.state === 'MOVE') {
            this.handleMovement(time);
        } else if (this.state === 'PREPARE_FIRE') {
            this.body.setVelocity(0, 0);
            if (time > this.stateTimer) {
                this.fireBreath();
                this.state = 'FIRE';
                this.stateTimer = time + 1000;
            } else {
                // Flash effect when preparing to fire
                if (Math.floor(time / 100) % 2 === 0) this.setAlpha(0.7);
                else this.setAlpha(1);
            }
        } else if (this.state === 'FIRE') {
            if (time > this.stateTimer) {
                this.state = 'MOVE';
                this.setAlpha(1);
                this.body.setVelocityX(this.direction * 20);
            }
        }
    }

    private handleMovement(time: number) {
        if (this.body.blocked.right) { 
            this.direction = -1; 
            this.body.setVelocityX(-20); 
            (this as any).setFlipX(true); 
        } else if (this.body.blocked.left) { 
            this.direction = 1; 
            this.body.setVelocityX(20); 
            (this as any).setFlipX(false); 
        }

        if (Math.abs(this.y - this.target.y) < 16 && Math.abs(this.x - this.target.x) < 150) {
            const toPlayer = this.target.x - this.x;
            if ((toPlayer > 0 && this.direction === 1) || (toPlayer < 0 && this.direction === -1)) {
                this.state = 'PREPARE_FIRE';
                this.stateTimer = time + 1000;
            }
        }
    }

    private fireBreath() {
        for(let i=1; i<=3; i++) {
            const fireX = this.x + (this.direction * i * 32);
            if (this._scene) {
                const fire = this._scene.physics.add.sprite(fireX, this.y, 'fire');
                fire.setPipeline('Light2D');
                (fire.body as Phaser.Physics.Arcade.Body).allowGravity = false;

                // Add a light for the fire
                const fireLight = this._scene.lights.addLight(fireX, this.y, 80, 0xff6b35, 1);

                this._scene.physics.add.overlap(fire, this.target, (f, p) => {
                    this._scene.events.emit('player-damage', 1);
                    (f as any).destroy();
                    fireLight.setIntensity(0);
                });

                this._scene.tweens.add({
                    targets: fire,
                    alpha: 0,
                    duration: 500,
                    delay: 200,
                    onComplete: () => {
                        fire.destroy();
                        fireLight.setIntensity(0);
                    }
                });
            }
        }
        if (this._scene) this._scene.events.emit('play-sound', 'fire');
    }
}