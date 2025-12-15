import Phaser from 'phaser';
import { TILE_SIZE, COLORS } from '../../constants';

export class Fygar extends Phaser.Physics.Arcade.Sprite {
    private direction: number = 1; // 1 right, -1 left
    private moveTimer: number = 0;
    private state: 'MOVE' | 'PREPARE_FIRE' | 'FIRE' = 'MOVE';
    private stateTimer: number = 0;
    private target: Phaser.Physics.Arcade.Sprite;

    // Explicitly declare properties that TypeScript thinks are missing
    public body!: Phaser.Physics.Arcade.Body;
    public x!: number;
    public y!: number;
    public active!: boolean;
    public scene!: Phaser.Scene;

    constructor(scene: Phaser.Scene, x: number, y: number, target: Phaser.Physics.Arcade.Sprite) {
        super(scene, x, y, 'fygar');
        this.target = target;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        (this as any).setTint(COLORS.enemy.fygar);
        (this as any).setVelocityX(20);
        (this as any).setBounce(1);
        (this as any).setCollideWorldBounds(true);
        this.body.allowGravity = false;
        (this as any).setData('hp', 4); // Harder to kill
    }

    update(time: number, delta: number) {
        if (!this.active) return;
        
        // Logic loop
        if (this.state === 'MOVE') {
            this.handleMovement(time);
        } else if (this.state === 'PREPARE_FIRE') {
            (this as any).setVelocity(0);
            if (time > this.stateTimer) {
                this.fireBreath();
                this.state = 'FIRE';
                this.stateTimer = time + 1000; // Fire lasts 1s
            } else {
                // Flash warning
                if (Math.floor(time / 100) % 2 === 0) (this as any).setTint(0xff0000);
                else (this as any).setTint(COLORS.enemy.fygar);
            }
        } else if (this.state === 'FIRE') {
            if (time > this.stateTimer) {
                this.state = 'MOVE';
                (this as any).clearTint();
                (this as any).setTint(COLORS.enemy.fygar);
                (this as any).setVelocityX(this.direction * 20);
            }
        }
    }

    private handleMovement(time: number) {
        if (this.body.blocked.right) { 
            this.direction = -1; 
            (this as any).setVelocityX(-20); 
            (this as any).setFlipX(true); 
        } else if (this.body.blocked.left) { 
            this.direction = 1; 
            (this as any).setVelocityX(20); 
            (this as any).setFlipX(false); 
        }

        // Check for player in line of sight
        if (Math.abs(this.y - this.target.y) < 16 && Math.abs(this.x - this.target.x) < 150) {
            // Facing player?
            const toPlayer = this.target.x - this.x;
            if ((toPlayer > 0 && this.direction === 1) || (toPlayer < 0 && this.direction === -1)) {
                // Attack!
                this.state = 'PREPARE_FIRE';
                this.stateTimer = time + 1000; // 1 sec warning
            }
        }
    }

    private fireBreath() {
        // Create 3 fire sprites
        for(let i=1; i<=3; i++) {
            const fireX = this.x + (this.direction * i * 32);
            const fire = this.scene.physics.add.sprite(fireX, this.y, 'fire');
            (fire.body as Phaser.Physics.Arcade.Body).allowGravity = false;
            
            // Damage player if overlaps
            this.scene.physics.add.overlap(fire, this.target, (f, p) => {
                this.scene.events.emit('player-damage', 1);
                (f as any).destroy();
            });

            this.scene.tweens.add({
                targets: fire,
                alpha: 0,
                duration: 500,
                delay: 200,
                onComplete: () => fire.destroy()
            });
        }
        this.scene.events.emit('play-sound', 'fire');
    }
}