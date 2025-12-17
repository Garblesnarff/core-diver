import Phaser from 'phaser';
import { COLORS, TILE_SIZE } from '../../constants';
import { TileType } from '../../types';

// Enhanced color palette
const PALETTE = {
  // Soil colors with depth
  soil: {
    soft: { base: 0x4a90d9, highlight: 0x6bb3ff, shadow: 0x2d5a8a },
    hard: { base: 0x3d7bc7, highlight: 0x5a9ae0, shadow: 0x264d80 },
    stone: { base: 0x3d4852, highlight: 0x5a6a78, shadow: 0x252d33 },
  },
  // Glowing ores
  ore: {
    copper: { base: 0x38b2ac, glow: 0x4fd1c5, core: 0x81e6d9 },
    lithium: { base: 0xd53f8c, glow: 0xed64a6, core: 0xf687b3 },
  },
  // Ice with crystalline effect
  ice: { base: 0x7dd3fc, highlight: 0xbae6fd, shadow: 0x38bdf8, glow: 0xe0f2fe },
  // Bedrock - impenetrable
  bedrock: { base: 0x1a1a2e, highlight: 0x2d2d44, pattern: 0x16161d },
  // Player colors
  player: {
    body: 0xf97316, // Orange
    accent: 0xfb923c,
    visor: 0x38bdf8,
    visorGlow: 0x7dd3fc,
    thruster: 0x3b82f6,
  },
  // Enemies
  enemy: {
    pooka: { body: 0xef4444, eye: 0xfef08a, highlight: 0xfca5a5 },
    fygar: { body: 0xf97316, scale: 0xfb923c, eye: 0xfef08a },
  }
};

export class AssetGenerator {
  static generate(scene: Phaser.Scene) {
    // Generate all tile textures
    this.createSoftDirtTile(scene);
    this.createHardDirtTile(scene);
    this.createStoneTile(scene);
    this.createIceTile(scene);
    this.createCopperOreTile(scene);
    this.createLithiumOreTile(scene);
    this.createBedrockTile(scene);
    this.createBoulderTexture(scene);

    // Generate character textures
    this.createPlayerTexture(scene);
    this.createPookaTexture(scene);
    this.createFygarTexture(scene);

    // Generate effects textures
    this.createFireTexture(scene);
    this.createParticleTexture(scene);
    this.createBeamTextures(scene);
    this.createArtifactTexture(scene);

    // Generate the tileset bitmap
    this.createTilesetBitmap(scene);
  }

  // ========== TILE TEXTURES ==========

  private static createSoftDirtTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, highlight, shadow } = PALETTE.soil.soft;

    // Base fill with gradient effect
    gfx.fillStyle(base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Add depth with diagonal highlight
    gfx.fillStyle(highlight, 0.3);
    gfx.fillTriangle(0, 0, TILE_SIZE, 0, 0, TILE_SIZE);

    // Add shadow in corner
    gfx.fillStyle(shadow, 0.4);
    gfx.fillTriangle(TILE_SIZE, TILE_SIZE, TILE_SIZE, 0, 0, TILE_SIZE);

    // Add noise/texture dots
    gfx.fillStyle(highlight, 0.2);
    for (let i = 0; i < 8; i++) {
      const x = Math.random() * TILE_SIZE;
      const y = Math.random() * TILE_SIZE;
      gfx.fillCircle(x, y, 1 + Math.random() * 2);
    }

    // Subtle border
    gfx.lineStyle(1, shadow, 0.3);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_soft', TILE_SIZE, TILE_SIZE);
  }

  private static createHardDirtTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, highlight, shadow } = PALETTE.soil.hard;

    // Base
    gfx.fillStyle(base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Diagonal striations for harder look
    gfx.lineStyle(2, highlight, 0.2);
    for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 8) {
      gfx.lineBetween(i, 0, i + TILE_SIZE, TILE_SIZE);
    }

    // Top highlight
    gfx.fillStyle(highlight, 0.25);
    gfx.fillRect(0, 0, TILE_SIZE, 4);

    // Bottom shadow
    gfx.fillStyle(shadow, 0.4);
    gfx.fillRect(0, TILE_SIZE - 4, TILE_SIZE, 4);

    // Border
    gfx.lineStyle(1, shadow, 0.4);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_hard', TILE_SIZE, TILE_SIZE);
  }

  private static createStoneTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, highlight, shadow } = PALETTE.soil.stone;

    // Base
    gfx.fillStyle(base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Rocky texture - irregular shapes
    gfx.fillStyle(highlight, 0.3);
    gfx.fillRoundedRect(4, 4, 12, 10, 2);
    gfx.fillRoundedRect(18, 6, 10, 8, 2);
    gfx.fillRoundedRect(6, 18, 14, 10, 2);
    gfx.fillRoundedRect(22, 20, 8, 8, 2);

    // Cracks
    gfx.lineStyle(1, shadow, 0.5);
    gfx.lineBetween(8, 0, 12, 16);
    gfx.lineBetween(24, 8, 20, TILE_SIZE);

    // Border
    gfx.lineStyle(1, shadow, 0.5);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_stone', TILE_SIZE, TILE_SIZE);
  }

  private static createIceTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, highlight, shadow, glow } = PALETTE.ice;

    // Base with gradient feel
    gfx.fillStyle(base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Crystalline facets
    gfx.fillStyle(highlight, 0.5);
    gfx.fillTriangle(0, 0, 16, 8, 0, 16);
    gfx.fillTriangle(TILE_SIZE, 0, 16, 8, TILE_SIZE, 16);

    // Inner glow effect
    gfx.fillStyle(glow, 0.3);
    gfx.fillCircle(16, 16, 10);

    // Crystalline highlights
    gfx.lineStyle(1, 0xffffff, 0.6);
    gfx.lineBetween(4, 4, 12, 12);
    gfx.lineBetween(20, 8, 28, 16);
    gfx.lineBetween(8, 20, 16, 28);

    // Sparkle points
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(8, 8, 2);
    gfx.fillCircle(24, 12, 1.5);
    gfx.fillCircle(12, 24, 1.5);

    // Border
    gfx.lineStyle(1, shadow, 0.4);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_ice', TILE_SIZE, TILE_SIZE);
  }

  private static createCopperOreTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, glow, core } = PALETTE.ore.copper;

    // Stone background
    gfx.fillStyle(PALETTE.soil.stone.base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Ore vein glow (outer)
    gfx.fillStyle(glow, 0.4);
    gfx.fillCircle(16, 16, 14);

    // Main ore deposit
    gfx.fillStyle(base);
    gfx.beginPath();
    gfx.moveTo(16, 4);
    gfx.lineTo(26, 12);
    gfx.lineTo(24, 24);
    gfx.lineTo(12, 28);
    gfx.lineTo(6, 18);
    gfx.lineTo(10, 8);
    gfx.closePath();
    gfx.fillPath();

    // Inner bright core
    gfx.fillStyle(core, 0.8);
    gfx.fillCircle(16, 16, 6);

    // Sparkle
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(14, 14, 2);

    // Border
    gfx.lineStyle(1, PALETTE.soil.stone.shadow, 0.5);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_copper', TILE_SIZE, TILE_SIZE);
  }

  private static createLithiumOreTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, glow, core } = PALETTE.ore.lithium;

    // Stone background
    gfx.fillStyle(PALETTE.soil.stone.base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Ore vein glow (outer) - pink glow
    gfx.fillStyle(glow, 0.4);
    gfx.fillCircle(16, 16, 14);

    // Crystal formation
    gfx.fillStyle(base);
    // Main crystal
    gfx.fillTriangle(16, 2, 24, 20, 8, 20);
    // Side crystals
    gfx.fillTriangle(6, 12, 12, 26, 2, 26);
    gfx.fillTriangle(26, 14, 30, 28, 20, 28);

    // Inner glow
    gfx.fillStyle(core, 0.7);
    gfx.fillTriangle(16, 8, 20, 18, 12, 18);

    // Sparkles
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(16, 10, 2);
    gfx.fillCircle(8, 18, 1.5);
    gfx.fillCircle(24, 20, 1.5);

    // Border
    gfx.lineStyle(1, PALETTE.soil.stone.shadow, 0.5);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_lithium', TILE_SIZE, TILE_SIZE);
  }

  private static createBedrockTile(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { base, highlight, pattern } = PALETTE.bedrock;

    // Dark base
    gfx.fillStyle(base);
    gfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);

    // Darker pattern overlay
    gfx.fillStyle(pattern);
    for (let y = 0; y < TILE_SIZE; y += 8) {
      for (let x = 0; x < TILE_SIZE; x += 8) {
        if ((x + y) % 16 === 0) {
          gfx.fillRect(x, y, 8, 8);
        }
      }
    }

    // Subtle highlights
    gfx.fillStyle(highlight, 0.3);
    gfx.fillRect(0, 0, TILE_SIZE, 2);
    gfx.fillRect(0, 0, 2, TILE_SIZE);

    // Warning stripes (diagonal)
    gfx.lineStyle(2, 0xfbbf24, 0.15);
    for (let i = -TILE_SIZE; i < TILE_SIZE * 2; i += 12) {
      gfx.lineBetween(i, 0, i + TILE_SIZE, TILE_SIZE);
    }

    // Border
    gfx.lineStyle(1, 0x000000, 0.8);
    gfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);

    gfx.generateTexture('tile_bedrock', TILE_SIZE, TILE_SIZE);
  }

  private static createBoulderTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Shadow underneath
    gfx.fillStyle(0x000000, 0.3);
    gfx.fillEllipse(16, 28, 24, 8);

    // Main boulder body
    gfx.fillStyle(PALETTE.soil.stone.base);
    gfx.fillCircle(16, 16, 14);

    // Highlight
    gfx.fillStyle(PALETTE.soil.stone.highlight, 0.5);
    gfx.fillCircle(12, 10, 8);

    // Details/cracks
    gfx.lineStyle(1, PALETTE.soil.stone.shadow, 0.5);
    gfx.lineBetween(10, 16, 14, 24);
    gfx.lineBetween(18, 8, 22, 18);

    // Bright spot
    gfx.fillStyle(0xffffff, 0.4);
    gfx.fillCircle(10, 8, 3);

    gfx.generateTexture('tile_boulder', TILE_SIZE, TILE_SIZE);

    // Also create 'rock' texture for Boulder sprite
    const rockGfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Shadow
    rockGfx.fillStyle(0x000000, 0.3);
    rockGfx.fillEllipse(16, 28, 26, 8);

    // Main body
    rockGfx.fillStyle(0x5a6a78);
    rockGfx.fillCircle(16, 15, 14);

    // Highlight gradient
    rockGfx.fillStyle(0x8899aa, 0.6);
    rockGfx.fillCircle(11, 10, 9);

    // Cracks and detail
    rockGfx.lineStyle(1, 0x3d4852, 0.6);
    rockGfx.lineBetween(8, 14, 12, 24);
    rockGfx.lineBetween(20, 8, 24, 20);

    // Specular
    rockGfx.fillStyle(0xffffff, 0.5);
    rockGfx.fillCircle(9, 8, 3);

    rockGfx.generateTexture('rock', TILE_SIZE, TILE_SIZE);
  }

  // ========== CHARACTER TEXTURES ==========

  private static createPlayerTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { body, accent, visor, visorGlow, thruster } = PALETTE.player;

    // Thruster glow (bottom)
    gfx.fillStyle(thruster, 0.3);
    gfx.fillCircle(16, 28, 6);

    // Main body - rounded rectangle
    gfx.fillStyle(body);
    gfx.fillRoundedRect(6, 4, 20, 24, 6);

    // Body accent stripe
    gfx.fillStyle(accent, 0.7);
    gfx.fillRoundedRect(8, 6, 16, 4, 2);

    // Visor glow
    gfx.fillStyle(visorGlow, 0.4);
    gfx.fillRoundedRect(7, 9, 18, 12, 4);

    // Visor main
    gfx.fillStyle(visor);
    gfx.fillRoundedRect(9, 11, 14, 8, 3);

    // Visor reflection
    gfx.fillStyle(0xffffff, 0.6);
    gfx.fillRoundedRect(10, 12, 6, 3, 1);

    // Side thrusters
    gfx.fillStyle(0x4b5563);
    gfx.fillRoundedRect(2, 10, 4, 12, 2);
    gfx.fillRoundedRect(26, 10, 4, 12, 2);

    // Thruster highlights
    gfx.fillStyle(thruster, 0.6);
    gfx.fillRect(2, 20, 4, 2);
    gfx.fillRect(26, 20, 4, 2);

    // Antenna
    gfx.fillStyle(0x9ca3af);
    gfx.fillRect(15, 0, 2, 5);
    gfx.fillStyle(0xef4444);
    gfx.fillCircle(16, 0, 2);

    gfx.generateTexture('player', TILE_SIZE, TILE_SIZE);
  }

  private static createPookaTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { body, eye, highlight } = PALETTE.enemy.pooka;

    // Body glow
    gfx.fillStyle(body, 0.3);
    gfx.fillCircle(16, 16, 14);

    // Main body
    gfx.fillStyle(body);
    gfx.fillCircle(16, 16, 12);

    // Body highlight
    gfx.fillStyle(highlight, 0.5);
    gfx.fillCircle(12, 12, 7);

    // Googly eyes - white
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(11, 13, 5);
    gfx.fillCircle(21, 13, 5);

    // Pupils
    gfx.fillStyle(0x000000);
    gfx.fillCircle(12, 14, 2);
    gfx.fillCircle(22, 14, 2);

    // Eye shine
    gfx.fillStyle(0xffffff, 0.9);
    gfx.fillCircle(10, 12, 1.5);
    gfx.fillCircle(20, 12, 1.5);

    // Little fangs
    gfx.fillStyle(0xffffff);
    gfx.fillTriangle(12, 20, 14, 24, 10, 24);
    gfx.fillTriangle(20, 20, 22, 24, 18, 24);

    gfx.generateTexture('enemy', TILE_SIZE, TILE_SIZE);
  }

  private static createFygarTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });
    const { body, scale, eye } = PALETTE.enemy.fygar;

    // Body glow
    gfx.fillStyle(body, 0.3);
    gfx.fillCircle(16, 18, 13);

    // Main body
    gfx.fillStyle(body);
    gfx.fillRoundedRect(6, 10, 20, 18, 4);

    // Head/snout
    gfx.fillStyle(body);
    gfx.fillTriangle(4, 16, 10, 12, 10, 20);

    // Spines on back
    gfx.fillStyle(scale);
    gfx.fillTriangle(10, 10, 14, 4, 18, 10);
    gfx.fillTriangle(16, 10, 20, 2, 24, 10);

    // Scales pattern
    gfx.fillStyle(scale, 0.5);
    gfx.fillCircle(12, 18, 3);
    gfx.fillCircle(18, 16, 3);
    gfx.fillCircle(22, 20, 2);

    // Eye
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(8, 14, 3);
    gfx.fillStyle(0x000000);
    gfx.fillCircle(7, 14, 1.5);

    // Nostril flame hint
    gfx.fillStyle(0xfbbf24, 0.6);
    gfx.fillCircle(4, 16, 2);

    gfx.generateTexture('fygar', TILE_SIZE, TILE_SIZE);
  }

  // ========== EFFECTS TEXTURES ==========

  private static createFireTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Outer glow
    gfx.fillStyle(0xff6b35, 0.3);
    gfx.fillCircle(8, 8, 8);

    // Main fire
    gfx.fillStyle(0xffa500);
    gfx.fillCircle(8, 8, 6);

    // Hot core
    gfx.fillStyle(0xffff00);
    gfx.fillCircle(8, 8, 3);

    // White center
    gfx.fillStyle(0xffffff, 0.8);
    gfx.fillCircle(8, 8, 1.5);

    gfx.generateTexture('fire', 16, 16);
  }

  private static createParticleTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Soft glow particle
    gfx.fillStyle(0xffffff, 0.3);
    gfx.fillCircle(4, 4, 4);
    gfx.fillStyle(0xffffff, 0.6);
    gfx.fillCircle(4, 4, 2.5);
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(4, 4, 1.5);

    gfx.generateTexture('particle', 8, 8);
  }

  private static createBeamTextures(scene: Phaser.Scene) {
    // Horizontal beam
    const beamH = scene.make.graphics({ x: 0, y: 0, add: false });

    // Glow
    beamH.fillStyle(0x4fd1c5, 0.3);
    beamH.fillRoundedRect(0, 0, 32, 8, 4);

    // Core
    beamH.fillStyle(0x4fd1c5);
    beamH.fillRoundedRect(2, 2, 28, 4, 2);

    // Hot center
    beamH.fillStyle(0xffffff, 0.7);
    beamH.fillRoundedRect(4, 3, 24, 2, 1);

    beamH.generateTexture('beam_h', 32, 8);

    // Vertical beam
    const beamV = scene.make.graphics({ x: 0, y: 0, add: false });

    // Glow
    beamV.fillStyle(0x4fd1c5, 0.3);
    beamV.fillRoundedRect(0, 0, 8, 32, 4);

    // Core
    beamV.fillStyle(0x4fd1c5);
    beamV.fillRoundedRect(2, 2, 4, 28, 2);

    // Hot center
    beamV.fillStyle(0xffffff, 0.7);
    beamV.fillRoundedRect(3, 4, 2, 24, 1);

    beamV.generateTexture('beam_v', 8, 32);
  }

  private static createArtifactTexture(scene: Phaser.Scene) {
    const gfx = scene.make.graphics({ x: 0, y: 0, add: false });

    // Outer glow rings
    gfx.fillStyle(0x805ad5, 0.2);
    gfx.fillCircle(32, 32, 30);
    gfx.fillStyle(0x805ad5, 0.3);
    gfx.fillCircle(32, 32, 25);

    // Main orb
    gfx.fillStyle(0x805ad5);
    gfx.fillCircle(32, 32, 20);

    // Inner glow
    gfx.fillStyle(0xd6bcfa);
    gfx.fillCircle(32, 32, 14);

    // Core
    gfx.fillStyle(0xfaf5ff);
    gfx.fillCircle(32, 32, 8);

    // Bright center
    gfx.fillStyle(0xffffff);
    gfx.fillCircle(32, 32, 4);

    // Sparkles around it
    gfx.fillStyle(0xffffff, 0.8);
    gfx.fillCircle(20, 20, 2);
    gfx.fillCircle(44, 24, 1.5);
    gfx.fillCircle(24, 44, 1.5);
    gfx.fillCircle(42, 42, 2);

    gfx.generateTexture('artifact', 64, 64);
  }

  // ========== TILESET BITMAP ==========

  private static createTilesetBitmap(scene: Phaser.Scene) {
    const textureCanvas = document.createElement('canvas');
    textureCanvas.width = 256;
    textureCanvas.height = 32;
    const ctx = textureCanvas.getContext('2d')!;

    const drawTexture = (key: string, idx: number) => {
      const tex = scene.textures.get(key).getSourceImage();
      ctx.drawImage(tex as CanvasImageSource, idx * 32, 0);
    };

    // Order must match TileType enum (EMPTY = -1, so DIRT_SOFT = 0, etc.)
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
}
