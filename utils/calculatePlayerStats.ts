import { PlayerUpgrades, SkillTreeState, ComputedPlayerStats } from '../types';
import { SKILL_TREE_DATA, getSkillById } from '../skillTreeData';

// Base game constants
const BASE_OXYGEN = 100;
const BASE_HEALTH = 3;
const BASE_SPEED = 160;
const BASE_FIRE_RATE = 1; // multiplier
const BASE_BEAM_DAMAGE = 1; // multiplier
const BASE_DASH_COOLDOWN = 3; // seconds
const BASE_LIGHT_RADIUS = 250;

export function calculatePlayerStats(
  upgrades: PlayerUpgrades,
  skillTreeState: SkillTreeState
): ComputedPlayerStats {
  // Start with base stats modified by linear upgrades
  const stats: ComputedPlayerStats = {
    // Base stats from upgrades
    maxOxygen: BASE_OXYGEN + (upgrades.oxygenLevel - 1) * 25,
    maxHealth: BASE_HEALTH + (upgrades.armorLevel - 1),
    moveSpeed: BASE_SPEED + (upgrades.speedLevel - 1) * 20,
    fireRate: BASE_FIRE_RATE,
    beamDamage: BASE_BEAM_DAMAGE,
    dashCooldown: BASE_DASH_COOLDOWN,
    lightRadius: BASE_LIGHT_RADIUS + (upgrades.visionLevel - 1) * 50,
    digSpeedBonus: 0,

    // Multipliers
    shardMultiplier: upgrades.drillLevel + (upgrades.shardLevel - 1) * 0.15,
    o2ConsumptionMultiplier: Math.max(0.3, 1 - (upgrades.efficiencyLevel - 1) * 0.1),
    pickupDurationMultiplier: 1,

    // Ability flags (all false by default)
    hasGroundSlam: false,
    hasGrappleHook: false,
    hasProximityBombs: false,
    hasEnergyBarrier: false,
    hasResourceBeacon: false,
    canPhaseDash: false,
    hasPierceShot: false,
    hasSecondWind: false,
    hasSeismicSense: false,
    hasTreasureSense: false,
    startWithShield: false,

    // Keystone flags
    activeKeystone: null
  };

  // Apply skill tree effects
  for (const skillId of skillTreeState.unlockedSkills) {
    const skill = getSkillById(skillId);
    if (!skill) continue;

    for (const effect of skill.effects) {
      switch (effect.type) {
        case 'stat_modifier':
          applyStatModifier(stats, effect.stat!, effect.value!, effect.operation || 'add');
          break;

        case 'ability_unlock':
          applyAbilityUnlock(stats, effect.abilityId!);
          break;

        case 'special':
          applySpecialFlag(stats, effect.flag!);
          break;
      }
    }
  }

  return stats;
}

function applyStatModifier(
  stats: ComputedPlayerStats,
  stat: string,
  value: number,
  operation: 'add' | 'multiply'
): void {
  switch (stat) {
    case 'maxOxygen':
      stats.maxOxygen = operation === 'add' ? stats.maxOxygen + value : stats.maxOxygen * value;
      break;
    case 'maxHealth':
      stats.maxHealth = operation === 'add' ? stats.maxHealth + value : stats.maxHealth * value;
      break;
    case 'moveSpeed':
      stats.moveSpeed = operation === 'add' ? stats.moveSpeed + value : stats.moveSpeed * (1 + value);
      break;
    case 'fireRate':
      stats.fireRate = operation === 'add' ? stats.fireRate + value : stats.fireRate * value;
      break;
    case 'beamDamage':
      stats.beamDamage = operation === 'add' ? stats.beamDamage + value : stats.beamDamage * value;
      break;
    case 'dashCooldown':
      if (operation === 'add') {
        stats.dashCooldown += value;
      } else {
        stats.dashCooldown *= (1 + value); // -0.2 means 20% reduction
      }
      break;
    case 'lightRadius':
      stats.lightRadius = operation === 'add' ? stats.lightRadius + value : stats.lightRadius * value;
      break;
    case 'digSpeedBonus':
      stats.digSpeedBonus += value;
      break;
    case 'shardMultiplier':
      stats.shardMultiplier = operation === 'add' ? stats.shardMultiplier + value : stats.shardMultiplier * value;
      break;
    case 'o2ConsumptionMultiplier':
      stats.o2ConsumptionMultiplier = Math.max(0.1, stats.o2ConsumptionMultiplier + value);
      break;
    case 'pickupDurationMultiplier':
      stats.pickupDurationMultiplier += value;
      break;
    case 'oreShardBonus':
      // This is handled specially in the mining logic
      stats.shardMultiplier += value;
      break;
    case 'stoneDigBonus':
      // Additional bonus for stone specifically
      stats.digSpeedBonus += value;
      break;
    case 'magnetRadius':
      // Stored as a flag, not directly in stats
      break;
    case 'enemyShardMultiplier':
      // This is handled specially in enemy death logic
      break;
  }
}

function applyAbilityUnlock(stats: ComputedPlayerStats, abilityId: string): void {
  switch (abilityId) {
    case 'groundSlam':
      stats.hasGroundSlam = true;
      break;
    case 'grappleHook':
      stats.hasGrappleHook = true;
      break;
    case 'proximityBombs':
      stats.hasProximityBombs = true;
      break;
    case 'energyBarrier':
      stats.hasEnergyBarrier = true;
      break;
    case 'resourceBeacon':
      stats.hasResourceBeacon = true;
      break;
  }
}

function applySpecialFlag(stats: ComputedPlayerStats, flag: string): void {
  switch (flag) {
    case 'hasSeismicSense':
      stats.hasSeismicSense = true;
      break;
    case 'hasTreasureSense':
      stats.hasTreasureSense = true;
      break;
    case 'hasPierceShot':
      stats.hasPierceShot = true;
      break;
    case 'hasSecondWind':
      stats.hasSecondWind = true;
      break;
    case 'canPhaseDash':
      stats.canPhaseDash = true;
      break;
    case 'startWithShield':
      stats.startWithShield = true;
      break;
    case 'hasChainExtraction':
      // Handled in mining logic
      break;
    case 'hasOvercharge':
      // Handled in firing logic
      break;
    case 'hasMomentum':
      // Handled in movement logic
      break;

    // Keystones
    case 'keystoneCoreBreaker':
      stats.activeKeystone = 'coreBreaker';
      break;
    case 'keystoneBerserker':
      stats.activeKeystone = 'berserker';
      break;
    case 'keystoneIronclad':
      stats.activeKeystone = 'ironclad';
      break;
    case 'keystoneBlinkDrive':
      stats.activeKeystone = 'blinkDrive';
      break;
    case 'keystoneGoldenTouch':
      stats.activeKeystone = 'goldenTouch';
      break;
  }
}

// Helper to check if player has a specific skill unlocked
export function hasSkill(skillTreeState: SkillTreeState, skillId: string): boolean {
  return skillTreeState.unlockedSkills.includes(skillId);
}

// Get the number of skills unlocked in a specific branch
export function getUnlockedCountInBranch(skillTreeState: SkillTreeState, branch: string): number {
  return SKILL_TREE_DATA
    .filter(skill => skill.branch === branch)
    .filter(skill => skillTreeState.unlockedSkills.includes(skill.id))
    .length;
}
