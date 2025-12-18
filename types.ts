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
  maxHealth: number;
  powerCells: number;
  powerCellsRequired: number;
  activePickups?: ActivePickup[];
  dashCooldown?: number; // 0-1 representing cooldown progress (1 = ready)
  currentBiome?: string;
}

export interface PlayerUpgrades {
  oxygenLevel: number;
  drillLevel: number;
  speedLevel: number;
  visionLevel: number;
  armorLevel: number;      // +1 max health per level
  efficiencyLevel: number; // -10% O2 drain per level
  shardLevel: number;      // +15% shard gain per level
}

// Run pickups - temporary powerups found during dives
export enum PickupType {
  SPREAD_SHOT = 'spread_shot',     // Fire 3 beams in a cone
  RAPID_FIRE = 'rapid_fire',       // 2x fire rate
  SHIELD = 'shield',               // Block one hit
  EMERGENCY_O2 = 'emergency_o2',   // +50 O2 when collected
  DRILL_BOOST = 'drill_boost',     // Halve dig time temporarily
  MAGNET = 'magnet',               // Auto-collect nearby resources (visual effect)
}

export interface ActivePickup {
  type: PickupType;
  duration?: number;    // ms remaining, undefined = permanent until used
  stacks?: number;      // for stackable pickups like shield
}

export enum TileType {
  EMPTY = -1,
  DIRT_SOFT = 0,
  DIRT_HARD = 1,
  STONE = 2,
  ORE_COPPER = 3,
  ORE_LITHIUM = 4,
  ICE = 5,
  BEDROCK = 6,
  BOULDER = 7 // New Tile Type
}

export const EVENTS = {
  STATS_UPDATE: 'core-diver-stats-update',
  GAME_OVER: 'core-diver-game-over',
  VICTORY: 'core-diver-victory',
  HIT_ENEMY: 'core-diver-hit-enemy'
};