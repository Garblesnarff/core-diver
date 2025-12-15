import Phaser from 'phaser';
import { COLORS, TILE_SIZE } from '../../constants';
import { TileType } from '../../types';

export class AssetGenerator {
  static generate(scene: Phaser.Scene) {
    // 1. Generate Grayscale Tile Textures (for Tinting)
    this.createTile(scene, 'tile_soft', 0xffffff); // White for tinting
    this.createTile(scene, 'tile_hard', 0xaaaaaa); // Light grey for tinting
    this.createTile(scene, 'tile_stone', COLORS.soil.stone); // Fixed color
    this.createTile(scene, 'tile_ice', COLORS.soil.ice); 
    this.createOreTile(scene, 'tile_copper', COLORS.ore.copper);
    this.createOreTile(scene, 'tile_lithium', COLORS.ore.lithium);
    this.createTile(scene, 'tile_bedrock', 0x111111);
    
    // Boulder texture
    this.createBoulderTile(scene, 'tile_boulder');

    // 2. Player Texture (Drone)
    const playerGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    playerGfx.fillStyle(COLORS.player.body);
    playerGfx.fillRoundedRect(4, 4, 24, 24, 8);
    playerGfx.fillStyle(COLORS.player.visor);
    playerGfx.fillRoundedRect(8, 8, 16, 10, 4);
    playerGfx.fillStyle(0x555555);
    playerGfx.fillRect(2, 6, 4, 20);
    playerGfx.fillRect(26, 6, 4, 20);
    playerGfx.generateTexture('player', 32, 32);

    // 3. Enemy: Pooka (Red)
    const pookaGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    pookaGfx.fillStyle(0xffffff); // White base for tinting
    pookaGfx.fillCircle(16, 16, 12);
    pookaGfx.fillStyle(0xffff00);
    pookaGfx.fillCircle(12, 12, 4);
    pookaGfx.fillCircle(20, 12, 4);
    pookaGfx.generateTexture('enemy', 32, 32);

    // 4. Enemy: Fygar (Dragon)
    const fygarGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    fygarGfx.fillStyle(0xffffff); // White base
    fygarGfx.fillRect(6, 10, 20, 16); // Body
    fygarGfx.fillTriangle(6, 10, 16, 4, 26, 10); // Spikes
    fygarGfx.fillStyle(0xffff00);
    fygarGfx.fillCircle(10, 16, 3);
    fygarGfx.fillCircle(22, 16, 3);
    fygarGfx.generateTexture('fygar', 32, 32);

    // 5. Fire Breath
    const fireGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    fireGfx.fillStyle(0xffa500);
    fireGfx.fillCircle(8, 8, 6);
    fireGfx.fillStyle(0xffff00);
    fireGfx.fillCircle(8, 8, 3);
    fireGfx.generateTexture('fire', 16, 16);

    // 6. Particles
    const pGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    pGfx.fillStyle(0xffffff);
    pGfx.fillCircle(4, 4, 4);
    pGfx.generateTexture('particle', 8, 8);
    
    // 7. Beam
    const beamGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    beamGfx.fillStyle(COLORS.ui.secondary); 
    beamGfx.fillRect(0, 0, 32, 8); 
    beamGfx.generateTexture('beam_h', 32, 8);
    beamGfx.clear();
    beamGfx.fillStyle(COLORS.ui.secondary);
    beamGfx.fillRect(0, 0, 8, 32); 
    beamGfx.generateTexture('beam_v', 8, 32);

    // 8. Core Artifact
    const coreGfx = scene.make.graphics({ x: 0, y: 0, add: false });
    coreGfx.fillStyle(0x805ad5); 
    coreGfx.fillCircle(32, 32, 30);
    coreGfx.fillStyle(0xd6bcfa); 
    coreGfx.fillCircle(32, 32, 20);
    coreGfx.fillStyle(0xffffff);
    coreGfx.fillCircle(32, 32, 10);
    coreGfx.generateTexture('artifact', 64, 64);

    // 9. Generate Tileset Bitmap
    this.createTilesetBitmap(scene);
  }

  private static createTilesetBitmap(scene: Phaser.Scene) {
     const textureCanvas = document.createElement('canvas');
     textureCanvas.width = 256; 
     textureCanvas.height = 32;
     const ctx = textureCanvas.getContext('2d')!;

     // Helper to draw existing textures onto the canvas strip
     const drawTexture = (key: string, idx: number) => {
         const tex = scene.textures.get(key).getSourceImage();
         ctx.drawImage(tex as CanvasImageSource, idx * 32, 0);
     };

     // Order must match TileType enum
     drawTexture('tile_soft', TileType.DIRT_SOFT);
     drawTexture('tile_hard', TileType.DIRT_HARD);
     drawTexture('tile_stone', TileType.STONE);
     drawTexture('tile_copper', TileType.ORE_COPPER);
     drawTexture('tile_lithium', TileType.ORE_LITHIUM);
     drawTexture('tile_ice', TileType.ICE);
     drawTexture('tile_bedrock', TileType.BEDROCK);
     drawTexture('tile_boulder', TileType.BOULDER);

     scene.textures.addCanvas('dynamic_tiles', textureCanvas);
  }

  private static createTile(scene: Phaser.Scene, key: string, color: number) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(color);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    gfx.fillStyle(0xffffff, 0.1);
    gfx.fillTriangle(0, 0, TILE_SIZE, 0, 0, TILE_SIZE);
    gfx.lineStyle(2, 0x000000, 0.1);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
  }

  private static createBoulderTile(scene: Phaser.Scene, key: string) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(COLORS.soil.stone);
    gfx.fillCircle(16, 16, 14);
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillCircle(12, 10, 4);
    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
  }

  private static createOreTile(scene: Phaser.Scene, key: string, oreColor: number) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    gfx.fillStyle(0xffffff); // White base
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    gfx.fillStyle(oreColor);
    gfx.fillTriangle(16, 4, 24, 16, 8, 16);
    gfx.fillTriangle(16, 28, 24, 16, 8, 16);
    gfx.fillStyle(0xffffff, 0.5);
    gfx.fillCircle(16, 16, 4);
    gfx.generateTexture(key, TILE_SIZE, TILE_SIZE);
  }
}