import { SkillDefinition, SkillBranch } from './types';

// Branch angle offsets for radial layout (in degrees, 0 = right, going counter-clockwise)
const BRANCH_ANGLES: Record<SkillBranch, number> = {
  excavator: 90,    // top
  vanguard: 162,    // top-left
  endurance: 234,   // bottom-left
  mobility: 306,    // bottom-right
  prospector: 18    // top-right
};

// Helper to position nodes radially within a branch
function branchPosition(branch: SkillBranch, tier: number, index: number, totalInTier: number): { x: number; y: number } {
  const baseAngle = BRANCH_ANGLES[branch] * (Math.PI / 180);
  const tierRadius = 80 + tier * 70; // distance from center based on tier

  // Spread nodes within tier
  const spreadAngle = 0.3; // radians spread
  const offsetAngle = totalInTier > 1
    ? (index - (totalInTier - 1) / 2) * (spreadAngle / Math.max(1, totalInTier - 1))
    : 0;

  const angle = baseAngle + offsetAngle;

  return {
    x: Math.cos(angle) * tierRadius,
    y: -Math.sin(angle) * tierRadius // negative because Y is inverted in screen coords
  };
}

export const SKILL_TREE_DATA: SkillDefinition[] = [
  // ==================== EXCAVATOR BRANCH (Mining) ====================
  {
    id: 'exc_efficient_extraction',
    name: 'Efficient Extraction',
    description: '+20% shard gain from ore deposits',
    branch: 'excavator',
    tier: 1,
    type: 'passive',
    cost: 150,
    prerequisites: [],
    position: branchPosition('excavator', 1, 0, 2),
    effects: [{ type: 'stat_modifier', stat: 'oreShardBonus', value: 0.2, operation: 'add' }]
  },
  {
    id: 'exc_hardened_drill',
    name: 'Hardened Drill Bit',
    description: 'Soft and hard dirt require 1 fewer hit to break',
    branch: 'excavator',
    tier: 1,
    type: 'passive',
    cost: 200,
    prerequisites: [],
    position: branchPosition('excavator', 1, 1, 2),
    effects: [{ type: 'stat_modifier', stat: 'digSpeedBonus', value: 1, operation: 'add' }]
  },
  {
    id: 'exc_seismic_sense',
    name: 'Seismic Sense',
    description: 'Ore deposits are highlighted through walls within 3 tiles',
    branch: 'excavator',
    tier: 2,
    type: 'passive_major',
    cost: 400,
    prerequisites: ['exc_efficient_extraction'],
    position: branchPosition('excavator', 2, 0, 3),
    effects: [{ type: 'special', flag: 'hasSeismicSense' }]
  },
  {
    id: 'exc_ground_slam',
    name: 'Ground Slam',
    description: 'Press [E] to slam the ground, destroying all tiles in a 2-tile radius. 8s cooldown.',
    branch: 'excavator',
    tier: 2,
    type: 'ability',
    cost: 600,
    prerequisites: ['exc_hardened_drill'],
    position: branchPosition('excavator', 2, 1, 3),
    effects: [{ type: 'ability_unlock', abilityId: 'groundSlam' }]
  },
  {
    id: 'exc_chain_extraction',
    name: 'Chain Extraction',
    description: 'Breaking ore has 30% chance to crack adjacent ore tiles',
    branch: 'excavator',
    tier: 2,
    type: 'passive_major',
    cost: 500,
    prerequisites: ['exc_efficient_extraction'],
    position: branchPosition('excavator', 2, 2, 3),
    effects: [{ type: 'special', flag: 'hasChainExtraction' }]
  },
  {
    id: 'exc_core_breaker',
    name: 'Core Breaker',
    description: 'KEYSTONE: Digging restores 1 O2 per tile. Stone requires 2 fewer hits.',
    branch: 'excavator',
    tier: 3,
    type: 'keystone',
    cost: 1500,
    prerequisites: ['exc_ground_slam', 'exc_seismic_sense'],
    position: branchPosition('excavator', 3, 0, 1),
    effects: [
      { type: 'special', flag: 'keystoneCoreBreaker' },
      { type: 'stat_modifier', stat: 'stoneDigBonus', value: 2, operation: 'add' }
    ]
  },

  // ==================== VANGUARD BRANCH (Combat) ====================
  {
    id: 'van_focused_beam',
    name: 'Focused Beam',
    description: '+15% beam damage against enemies',
    branch: 'vanguard',
    tier: 1,
    type: 'passive',
    cost: 150,
    prerequisites: [],
    position: branchPosition('vanguard', 1, 0, 2),
    effects: [{ type: 'stat_modifier', stat: 'beamDamage', value: 0.15, operation: 'add' }]
  },
  {
    id: 'van_rapid_targeting',
    name: 'Rapid Targeting',
    description: '-10% fire cooldown between shots',
    branch: 'vanguard',
    tier: 1,
    type: 'passive',
    cost: 200,
    prerequisites: [],
    position: branchPosition('vanguard', 1, 1, 2),
    effects: [{ type: 'stat_modifier', stat: 'fireRate', value: 0.1, operation: 'add' }]
  },
  {
    id: 'van_pierce_shot',
    name: 'Pierce Shot',
    description: 'Beams pierce through 1 additional enemy',
    branch: 'vanguard',
    tier: 2,
    type: 'passive_major',
    cost: 400,
    prerequisites: ['van_focused_beam'],
    position: branchPosition('vanguard', 2, 0, 3),
    effects: [{ type: 'special', flag: 'hasPierceShot' }]
  },
  {
    id: 'van_proximity_bombs',
    name: 'Proximity Bombs',
    description: 'Press [Q] to drop a bomb that detonates after 2s or on enemy contact. Max 3 active.',
    branch: 'vanguard',
    tier: 2,
    type: 'ability',
    cost: 700,
    prerequisites: ['van_rapid_targeting'],
    position: branchPosition('vanguard', 2, 1, 3),
    effects: [{ type: 'ability_unlock', abilityId: 'proximityBombs' }]
  },
  {
    id: 'van_overcharge',
    name: 'Overcharge',
    description: 'Holding fire charges beam for 2x damage burst',
    branch: 'vanguard',
    tier: 2,
    type: 'passive_major',
    cost: 350,
    prerequisites: ['van_focused_beam'],
    position: branchPosition('vanguard', 2, 2, 3),
    effects: [{ type: 'special', flag: 'hasOvercharge' }]
  },
  {
    id: 'van_berserker_protocol',
    name: 'Berserker Protocol',
    description: 'KEYSTONE: Below 30% O2: +50% fire rate, +30% damage. Enemies drop O2 orbs.',
    branch: 'vanguard',
    tier: 3,
    type: 'keystone',
    cost: 1500,
    prerequisites: ['van_pierce_shot', 'van_proximity_bombs'],
    position: branchPosition('vanguard', 3, 0, 1),
    effects: [{ type: 'special', flag: 'keystoneBerserker' }]
  },

  // ==================== ENDURANCE BRANCH (Survival) ====================
  {
    id: 'end_reinforced_hull',
    name: 'Reinforced Hull',
    description: '+1 maximum health',
    branch: 'endurance',
    tier: 1,
    type: 'passive',
    cost: 150,
    prerequisites: [],
    position: branchPosition('endurance', 1, 0, 2),
    effects: [{ type: 'stat_modifier', stat: 'maxHealth', value: 1, operation: 'add' }]
  },
  {
    id: 'end_efficient_rebreather',
    name: 'Efficient Rebreather',
    description: '-15% oxygen consumption rate',
    branch: 'endurance',
    tier: 1,
    type: 'passive',
    cost: 200,
    prerequisites: [],
    position: branchPosition('endurance', 1, 1, 2),
    effects: [{ type: 'stat_modifier', stat: 'o2ConsumptionMultiplier', value: -0.15, operation: 'add' }]
  },
  {
    id: 'end_emergency_reserves',
    name: 'Emergency Reserves',
    description: 'Start each run with 1 shield charge',
    branch: 'endurance',
    tier: 2,
    type: 'passive_major',
    cost: 450,
    prerequisites: ['end_reinforced_hull'],
    position: branchPosition('endurance', 2, 0, 3),
    effects: [{ type: 'special', flag: 'startWithShield' }]
  },
  {
    id: 'end_energy_barrier',
    name: 'Energy Barrier',
    description: 'Press [G] to deploy a stationary shield that blocks projectiles for 5s. 12s cooldown.',
    branch: 'endurance',
    tier: 2,
    type: 'ability',
    cost: 600,
    prerequisites: ['end_reinforced_hull', 'end_efficient_rebreather'],
    position: branchPosition('endurance', 2, 1, 3),
    effects: [{ type: 'ability_unlock', abilityId: 'energyBarrier' }]
  },
  {
    id: 'end_second_wind',
    name: 'Second Wind',
    description: 'First time O2 hits 0, restore to 30% instead of dying (once per run)',
    branch: 'endurance',
    tier: 2,
    type: 'passive_major',
    cost: 400,
    prerequisites: ['end_efficient_rebreather'],
    position: branchPosition('endurance', 2, 2, 3),
    effects: [{ type: 'special', flag: 'hasSecondWind' }]
  },
  {
    id: 'end_ironclad',
    name: 'Ironclad',
    description: 'KEYSTONE: +3 max health. Taking damage grants 1s invulnerability. Cannot use dash.',
    branch: 'endurance',
    tier: 3,
    type: 'keystone',
    cost: 1500,
    prerequisites: ['end_energy_barrier', 'end_second_wind'],
    position: branchPosition('endurance', 3, 0, 1),
    effects: [
      { type: 'stat_modifier', stat: 'maxHealth', value: 3, operation: 'add' },
      { type: 'special', flag: 'keystoneIronclad' }
    ]
  },

  // ==================== MOBILITY BRANCH (Movement) ====================
  {
    id: 'mob_swift_thrusters',
    name: 'Swift Thrusters',
    description: '+10% movement speed',
    branch: 'mobility',
    tier: 1,
    type: 'passive',
    cost: 150,
    prerequisites: [],
    position: branchPosition('mobility', 1, 0, 2),
    effects: [{ type: 'stat_modifier', stat: 'moveSpeed', value: 0.1, operation: 'multiply' }]
  },
  {
    id: 'mob_quick_recovery',
    name: 'Quick Recovery',
    description: '-20% dash cooldown',
    branch: 'mobility',
    tier: 1,
    type: 'passive',
    cost: 200,
    prerequisites: [],
    position: branchPosition('mobility', 1, 1, 2),
    effects: [{ type: 'stat_modifier', stat: 'dashCooldown', value: -0.2, operation: 'multiply' }]
  },
  {
    id: 'mob_grapple_hook',
    name: 'Grapple Hook',
    description: 'Press [R] to launch a grapple, pulling yourself to solid surfaces. 5s cooldown.',
    branch: 'mobility',
    tier: 2,
    type: 'ability',
    cost: 800,
    prerequisites: ['mob_swift_thrusters', 'mob_quick_recovery'],
    position: branchPosition('mobility', 2, 0, 3),
    effects: [{ type: 'ability_unlock', abilityId: 'grappleHook' }]
  },
  {
    id: 'mob_phase_dash',
    name: 'Phase Dash',
    description: 'Dash can pass through 1 tile of soft dirt',
    branch: 'mobility',
    tier: 2,
    type: 'passive_major',
    cost: 500,
    prerequisites: ['mob_quick_recovery'],
    position: branchPosition('mobility', 2, 1, 3),
    effects: [{ type: 'special', flag: 'canPhaseDash' }]
  },
  {
    id: 'mob_momentum',
    name: 'Momentum',
    description: 'Moving continuously builds speed (up to +20% after 3s)',
    branch: 'mobility',
    tier: 2,
    type: 'passive_major',
    cost: 350,
    prerequisites: ['mob_swift_thrusters'],
    position: branchPosition('mobility', 2, 2, 3),
    effects: [{ type: 'special', flag: 'hasMomentum' }]
  },
  {
    id: 'mob_blink_drive',
    name: 'Blink Drive',
    description: 'KEYSTONE: Dash teleports 3x distance and leaves a damaging trail. +1s cooldown.',
    branch: 'mobility',
    tier: 3,
    type: 'keystone',
    cost: 1500,
    prerequisites: ['mob_grapple_hook', 'mob_phase_dash'],
    position: branchPosition('mobility', 3, 0, 1),
    effects: [
      { type: 'special', flag: 'keystoneBlinkDrive' },
      { type: 'stat_modifier', stat: 'dashCooldown', value: 1, operation: 'add' }
    ]
  },

  // ==================== PROSPECTOR BRANCH (Resources/Luck) ====================
  {
    id: 'pro_lucky_find',
    name: 'Lucky Find',
    description: '+10% shard drops from all sources',
    branch: 'prospector',
    tier: 1,
    type: 'passive',
    cost: 150,
    prerequisites: [],
    position: branchPosition('prospector', 1, 0, 2),
    effects: [{ type: 'stat_modifier', stat: 'shardMultiplier', value: 0.1, operation: 'add' }]
  },
  {
    id: 'pro_extended_reach',
    name: 'Extended Reach',
    description: '+1 tile magnet radius when magnet pickup is active',
    branch: 'prospector',
    tier: 1,
    type: 'passive',
    cost: 200,
    prerequisites: [],
    position: branchPosition('prospector', 1, 1, 2),
    effects: [{ type: 'stat_modifier', stat: 'magnetRadius', value: 1, operation: 'add' }]
  },
  {
    id: 'pro_treasure_sense',
    name: 'Treasure Sense',
    description: 'Power cells are visible through walls',
    branch: 'prospector',
    tier: 2,
    type: 'passive_major',
    cost: 400,
    prerequisites: ['pro_lucky_find'],
    position: branchPosition('prospector', 2, 0, 3),
    effects: [{ type: 'special', flag: 'hasTreasureSense' }]
  },
  {
    id: 'pro_fortunes_favor',
    name: "Fortune's Favor",
    description: 'Pickups last 25% longer',
    branch: 'prospector',
    tier: 2,
    type: 'passive_major',
    cost: 350,
    prerequisites: ['pro_extended_reach'],
    position: branchPosition('prospector', 2, 1, 3),
    effects: [{ type: 'stat_modifier', stat: 'pickupDurationMultiplier', value: 0.25, operation: 'add' }]
  },
  {
    id: 'pro_resource_beacon',
    name: 'Resource Beacon',
    description: 'Press [F] to deploy a beacon that auto-collects resources in 4-tile radius for 15s. 30s cooldown.',
    branch: 'prospector',
    tier: 2,
    type: 'ability',
    cost: 600,
    prerequisites: ['pro_lucky_find', 'pro_extended_reach'],
    position: branchPosition('prospector', 2, 2, 3),
    effects: [{ type: 'ability_unlock', abilityId: 'resourceBeacon' }]
  },
  {
    id: 'pro_golden_touch',
    name: 'Golden Touch',
    description: 'KEYSTONE: Enemies drop 3x shards. 10% chance pickups are duplicated on collect.',
    branch: 'prospector',
    tier: 3,
    type: 'keystone',
    cost: 1500,
    prerequisites: ['pro_treasure_sense', 'pro_resource_beacon'],
    position: branchPosition('prospector', 3, 0, 1),
    effects: [
      { type: 'stat_modifier', stat: 'enemyShardMultiplier', value: 3, operation: 'multiply' },
      { type: 'special', flag: 'keystoneGoldenTouch' }
    ]
  }
];

// Get all skills for a specific branch
export function getSkillsByBranch(branch: SkillBranch): SkillDefinition[] {
  return SKILL_TREE_DATA.filter(skill => skill.branch === branch);
}

// Get a skill by ID
export function getSkillById(id: string): SkillDefinition | undefined {
  return SKILL_TREE_DATA.find(skill => skill.id === id);
}

// Check if a skill can be unlocked based on prerequisites
export function canUnlockSkill(skillId: string, unlockedSkills: string[]): boolean {
  const skill = getSkillById(skillId);
  if (!skill) return false;
  if (unlockedSkills.includes(skillId)) return false; // Already unlocked

  // Check all prerequisites are met
  return skill.prerequisites.every(prereq => unlockedSkills.includes(prereq));
}

// Get connection lines between skills for rendering
export function getSkillConnections(): Array<{ from: string; to: string }> {
  const connections: Array<{ from: string; to: string }> = [];

  for (const skill of SKILL_TREE_DATA) {
    for (const prereq of skill.prerequisites) {
      connections.push({ from: prereq, to: skill.id });
    }
  }

  return connections;
}
