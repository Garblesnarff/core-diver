// Astroneer-inspired Palette
export const COLORS = {
  background: 0x1a1625, // Dark Purple Void
  soil: {
    soft: 0x63b3ed, // Light Blue soil
    hard: 0x4299e1, // Darker Blue soil
    stone: 0x2d3748, // Dark Grey
    ice: 0xa5f3fc, // Cyan/White for Oxygen
  },
  ore: {
    copper: 0x38b2ac, // Teal
    lithium: 0xd53f8c, // Pink
  },
  player: {
    body: 0xf6ad55, // Orange
    visor: 0x90cdf4, // Light Blue
    light: 0xffffaa,
  },
  enemy: {
    pooka: 0xf56565, // Red
    inflated: 0xfeb2b2, // Light Red
  },
  ui: {
    primary: '#f6ad55',
    secondary: '#4fd1c5',
    danger: '#fc8181',
    dark: '#1a202c'
  }
};

export const GAME_CONFIG = {
  width: window.innerWidth,
  height: window.innerHeight,
  gravity: 0, // Top down
  playerSpeed: 160,
  oxygenDepletionRate: 0.5, // Per second
  digSpeed: 200, // ms per tile
};

export const TILE_SIZE = 32;