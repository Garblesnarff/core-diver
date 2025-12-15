import Phaser from 'phaser';
import { COLORS, TILE_SIZE } from '../../constants';

export class AssetGenerator {
  static generate(scene: Phaser.Scene) {
    // 1. Generate Tile Textures
    this.createTile(scene, 'tile_dirt', COLORS.soil.soft);
    this.createTile(scene, 'tile_hard', COLORS.soil.hard);
    this.createTile(scene, 'tile_stone', COLORS.soil.stone);
    this.createTile(scene, 'tile_ice', COLORS.soil.ice); // New Ice Tile
    this.createOreTile(scene, 'tile_copper', COLORS.soil.soft, COLORS.ore.copper);
    this.createOreTile(scene, 'tile_lithium', COLORS.soil.hard, COLORS.ore.lithium);
    this.createTile(scene, 'tile_bedrock', 0x111111);

    // 2. Player Texture (Drone)
    const playerGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    playerGfx.fillStyle(COLORS.player.body);
    // Rounded body
    playerGfx.fillRoundedRect(4, 4, 24, 24, 8);
    // Visor
    playerGfx.fillStyle(COLORS.player.visor);
    playerGfx.fillRoundedRect(8, 8, 16, 10, 4);
    // Treads
    playerGfx.fillStyle(0x555555);
    playerGfx.fillRect(2, 6, 4, 20);
    playerGfx.fillRect(26, 6, 4, 20);
    playerGfx.generateTexture('player', 32, 32);

    // 3. Enemy Texture (Pooka style)
    const enemyGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    enemyGfx.fillStyle(COLORS.enemy.pooka);
    enemyGfx.fillCircle(16, 16, 12);
    // Goggles
    enemyGfx.fillStyle(0xffff00);
    enemyGfx.fillCircle(12, 12, 4);
    enemyGfx.fillCircle(20, 12, 4);
    enemyGfx.generateTexture('enemy', 32, 32);

    // 4. Rock/Boulder
    const rockGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    rockGfx.fillStyle(COLORS.soil.stone);
    rockGfx.fillCircle(16, 16, 14);
    rockGfx.fillStyle(0x555555); // Crater
    rockGfx.fillCircle(12, 10, 4);
    rockGfx.generateTexture('rock', 32, 32);

    // 5. Particles
    const pGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    pGfx.fillStyle(0xffffff);
    pGfx.fillCircle(4, 4, 4);
    pGfx.generateTexture('particle', 8, 8);
    
    // 6. Beam
    const beamGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    beamGfx.fillStyle(COLORS.ui.secondary); // Cyan
    beamGfx.fillRect(0, 0, 32, 8); // Horizontal segment
    beamGfx.generateTexture('beam_h', 32, 8);
    
    beamGfx.clear();
    beamGfx.fillStyle(COLORS.ui.secondary);
    beamGfx.fillRect(0, 0, 8, 32); // Vertical segment
    beamGfx.generateTexture('beam_v', 8, 32);

    // 7. Core Artifact (The Goal)
    const coreGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    // Outer ring
    coreGfx.fillStyle(0x805ad5); // Purple
    coreGfx.fillCircle(32, 32, 30);
    // Inner pulse
    coreGfx.fillStyle(0xd6bcfa); // Light Purple
    coreGfx.fillCircle(32, 32, 20);
    // Core
    coreGfx.fillStyle(0xffffff);
    coreGfx.fillCircle(32, 32, 10);
    coreGfx.generateTexture('artifact', 64, 64);
  }

  private static createTile(scene: Phaser.Scene, key: string, color: number) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // Add "Low Poly" highlight
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillTriangle(0, 0, TILE_SIZE, 0, 0, TILE_SIZE);
    
    // Add subtle border
    gfx.lineStyle(2, 0x000000, 0.1);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
  }

  private static createOreTile(scene: Phaser.Scene, key: string, baseColor: number, oreColor: number) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(baseColor);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    
    // Ore Crystal shapes
    gfx.fillStyle(oreColor);
    gfx.fillTriangle(16, 4, 24, 16, 8, 16);
    gfx.fillTriangle(16, 28, 24, 16, 8, 16);
    
    // Glow effect center
    gfx.fillStyle(0xffffff, 0.5);
    gfx.fillCircle(16, 16, 4);

    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
  }
}