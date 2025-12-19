export enum GameState {
  HUB = 'HUB',
  PLAYING = 'PLAYING',
  GAME_OVER = 'GAME_OVER',
  VICTORY = 'VICTORY',
  PAUSED = 'PAUSED'
}

export interface AbilityCooldown {
  current: number;
  max: number;
  has: boolean;
}

export interface AbilityCooldowns {
  groundSlam: AbilityCooldown;
  proximityBombs: AbilityCooldown;
  energyBarrier: AbilityCooldown;
  grappleHook: AbilityCooldown;
  resourceBeacon: AbilityCooldown;
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
  abilityCooldowns?: AbilityCooldowns;
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

// ==================== SKILL TREE SYSTEM ====================

export type SkillBranch = 'excavator' | 'vanguard' | 'endurance' | 'mobility' | 'prospector';
export type SkillTier = 1 | 2 | 3;
export type SkillType = 'passive' | 'passive_major' | 'ability' | 'keystone';

export interface SkillEffect {
  type: 'stat_modifier' | 'ability_unlock' | 'special';
  // For stat_modifier
  stat?: string;
  value?: number;
  operation?: 'add' | 'multiply';
  // For ability_unlock
  abilityId?: string;
  // For special flags
  flag?: string;
}

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  branch: SkillBranch;
  tier: SkillTier;
  type: SkillType;
  cost: number;
  prerequisites: string[]; // skill IDs required
  position: { x: number; y: number }; // relative position for rendering
  effects: SkillEffect[];
  icon?: string; // optional custom icon identifier
}

export interface SkillTreeState {
  unlockedSkills: string[];
  totalSpent: number;
}

// Branch visual configuration
export const SKILL_BRANCH_CONFIG: Record<SkillBranch, { color: string; name: string; icon: string }> = {
  excavator: { color: '#f472b6', name: 'EXCAVATOR', icon: '⛏' },
  vanguard: { color: '#ef4444', name: 'VANGUARD', icon: '⚔' },
  endurance: { color: '#4ade80', name: 'ENDURANCE', icon: '🛡' },
  mobility: { color: '#fbbf24', name: 'MOBILITY', icon: '⚡' },
  prospector: { color: '#818cf8', name: 'PROSPECTOR', icon: '💎' }
};

// Computed player stats after applying upgrades + skills
export interface ComputedPlayerStats {
  // Base stats
  maxOxygen: number;
  maxHealth: number;
  moveSpeed: number;
  fireRate: number; // multiplier
  beamDamage: number; // multiplier
  dashCooldown: number; // seconds
  lightRadius: number;
  digSpeedBonus: number; // hits reduced

  // Multipliers
  shardMultiplier: number;
  o2ConsumptionMultiplier: number;
  pickupDurationMultiplier: number;

  // Ability flags
  hasGroundSlam: boolean;
  hasGrappleHook: boolean;
  hasProximityBombs: boolean;
  hasEnergyBarrier: boolean;
  hasResourceBeacon: boolean;
  canPhaseDash: boolean;
  hasPierceShot: boolean;
  hasSecondWind: boolean;
  hasSeismicSense: boolean;
  hasTreasureSense: boolean;
  startWithShield: boolean;

  // Keystone flags
  activeKeystone: string | null;
}