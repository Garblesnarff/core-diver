// Abyssal Neon Palette
export const COLORS = {
  background: 0x030308, // Void black - deep space
  soil: {
    soft: 0x4a90d9, // Soft blue soil
    hard: 0x3d7bc7, // Harder blue soil
    stone: 0x3d4852, // Grey stone
    ice: 0x7dd3fc, // Crystalline ice
  },
  ore: {
    copper: 0x38b2ac, // Teal glow
    lithium: 0xd53f8c, // Pink crystals
  },
  player: {
    body: 0xf97316, // Bright orange
    visor: 0x38bdf8, // Cyan visor
    light: 0x7dd3fc, // Soft cyan light
  },
  enemy: {
    pooka: 0xef4444, // Red blob
    fygar: 0xf97316, // Orange dragon
    inflated: 0xfca5a5, // Light red when inflating
  },
  ui: {
    primary: '#f97316',
    secondary: '#00f5ff',
    danger: '#ff1744',
    dark: '#030308'
  }
};

export const BIOMES = [
  { start: 0, end: 30, name: 'SURFACE', colors: { soft: 0x63b3ed, hard: 0x4299e1 } },
  { start: 30, end: 60, name: 'MINERAL CAVERNS', colors: { soft: 0xed8936, hard: 0xdd6b20 } },
  { start: 60, end: 90, name: 'FROZEN DEPTHS', colors: { soft: 0xa5f3fc, hard: 0x63b3ed } },
  { start: 90, end: 999, name: 'CORE ZONE', colors: { soft: 0x9f7aea, hard: 0x805ad5 } }
];

export const GAME_CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  gravity: 0, // Top down
  playerSpeed: 160,
  oxygenDepletionRate: 0.5, // Per second
  digSpeed: 200, // ms per tile
};

export const TILE_SIZE = 32;