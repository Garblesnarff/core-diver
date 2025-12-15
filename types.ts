export enum GameState {
  HUB = 'HUB',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  PAUSED = 'PAUSED'
}

export interface GameStats {
  oxygen: number;
  maxOxygen: number;
  depth: number;
  resources: {
    shards: number;
    minerals: number;
  };
  health: number;
}

export interface PlayerUpgrades {
  oxygenLevel: number;
  drillLevel: number;
  speedLevel: number;
  visionLevel: number;
}

// Optimized to match Texture Atlas indices directly
export enum TileType {
  EMPTY = -1,
  DIRT_SOFT = 0,
  DIRT_HARD = 1,
  STONE = 2,
  ORE_COPPER = 3,
  ORE_LITHIUM = 4,
  ICE = 5,
  BEDROCK = 6
}

// Events dispatched from Phaser to React
export const EVENTS = {
  STATS_UPDATE: 'core-diver-stats-update',
  GAME_OVER: 'core-diver-game-over',
  VICTORY: 'core-diver-victory',
  HIT_ENEMY: 'core-diver-hit-enemy'
};