import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from './game/CoreDiverGame';
import { GameState, EVENTS, GameStats, PlayerUpgrades, PickupType, ActivePickup, SkillTreeState, SkillDefinition, SKILL_BRANCH_CONFIG, SkillBranch } from './types';
import { SKILL_TREE_DATA, getSkillById, canUnlockSkill, getSkillConnections } from './skillTreeData';

// Icon components
const OxygenIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const DrillIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <path d="M14.5 4L20 9.5M9.5 9.5L4 15 9 20l5.5-5.5M9.5 9.5l5 5M9.5 9.5L15 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const SpeedIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const VisionIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8-10-8-10-8z" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
);

const ArmorIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <path d="M12 2L4 5v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V5l-8-3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

const EfficiencyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M12 6v6l4.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);

const ShardIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5">
    <path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5-6.5 4.5 2-7.5L2 9h7l3-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
  </svg>
);

// Pickup display info
const getPickupInfo = (type: PickupType): { name: string; color: string; icon: string } => {
  switch (type) {
    case PickupType.SPREAD_SHOT:
      return { name: 'SPREAD', color: '#818cf8', icon: '⟪⟫' };
    case PickupType.RAPID_FIRE:
      return { name: 'RAPID', color: '#fbbf24', icon: '⚡' };
    case PickupType.SHIELD:
      return { name: 'SHIELD', color: '#4ade80', icon: '🛡' };
    case PickupType.DRILL_BOOST:
      return { name: 'DRILL', color: '#f472b6', icon: '⛏' };
    case PickupType.MAGNET:
      return { name: 'MAGNET', color: '#ef4444', icon: '⊛' };
    default:
      return { name: '???', color: '#ffffff', icon: '?' };
  }
};

// Load skill tree state from localStorage
const loadSkillTreeState = (): SkillTreeState => {
  try {
    const saved = localStorage.getItem('coreDiver_skillTree');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (e) {
    console.error('Failed to load skill tree state:', e);
  }
  return { unlockedSkills: [], totalSpent: 0 };
};

// Hub tab type
type HubTab = 'upgrades' | 'skills';

const App: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.HUB);
  const [totalShards, setTotalShards] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<number>(1);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>({
    oxygenLevel: 1,
    drillLevel: 1,
    speedLevel: 1,
    visionLevel: 1,
    armorLevel: 1,
    efficiencyLevel: 1,
    shardLevel: 1
  });
  const [stats, setStats] = useState<GameStats>({
    oxygen: 100,
    maxOxygen: 100,
    depth: 0,
    health: 3,
    maxHealth: 3,
    resources: { shards: 0, minerals: 0 },
    powerCells: 0,
    powerCellsRequired: 3
  });
  const [deathReason, setDeathReason] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

  // Skill tree state
  const [skillTreeState, setSkillTreeState] = useState<SkillTreeState>(loadSkillTreeState);
  const [hubTab, setHubTab] = useState<HubTab>('upgrades');
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

  // Save skill tree state to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('coreDiver_skillTree', JSON.stringify(skillTreeState));
  }, [skillTreeState]);

  // Unlock a skill
  const unlockSkill = (skillId: string) => {
    const skill = getSkillById(skillId);
    if (!skill) return;
    if (!canUnlockSkill(skillId, skillTreeState.unlockedSkills)) return;
    if (totalShards < skill.cost) return;

    setTotalShards(prev => prev - skill.cost);
    setSkillTreeState(prev => ({
      unlockedSkills: [...prev.unlockedSkills, skillId],
      totalSpent: prev.totalSpent + skill.cost
    }));
  };

  useEffect(() => {
    if (!gameRef.current) {
      gameRef.current = createGame('game-container');
    }

    // Trigger load animation
    setTimeout(() => setIsLoaded(true), 100);

    const handleStats = (e: any) => setStats({ ...e.detail });
    const handleGameOver = (e: any) => {
      setDeathReason(e.detail.reason);
      setTotalShards(prev => prev + Math.floor(e.detail.stats.resources.shards * 0.5));
      setGameState(GameState.GAME_OVER);
    };
    const handleVictory = (e: any) => {
      setTotalShards(prev => prev + e.detail.stats.resources.shards + 200);
      setDifficulty(prev => prev + 1);
      setGameState(GameState.VICTORY);
    };

    window.addEventListener(EVENTS.STATS_UPDATE, handleStats);
    window.addEventListener(EVENTS.GAME_OVER, handleGameOver);
    window.addEventListener(EVENTS.VICTORY, handleVictory);

    return () => {
      window.removeEventListener(EVENTS.STATS_UPDATE, handleStats);
      window.removeEventListener(EVENTS.GAME_OVER, handleGameOver);
      window.removeEventListener(EVENTS.VICTORY, handleVictory);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, []);

  const startGame = () => {
    setGameState(GameState.PLAYING);
    if (gameRef.current) {
      const mainScene = gameRef.current.scene.getScene('MainScene');
      if (mainScene) {
        mainScene.scene.restart({ upgrades, difficulty, skillTreeState });
      }
    }
  };

  const buyUpgrade = (type: keyof PlayerUpgrades) => {
    const cost = 100 * upgrades[type];
    if (totalShards >= cost) {
      setTotalShards(prev => prev - cost);
      setUpgrades(prev => ({ ...prev, [type]: prev[type] + 1 }));
    }
  };

  const oxygenPercent = (stats.oxygen / stats.maxOxygen) * 100;
  const isLowOxygen = stats.oxygen < 30;

  return (
    <div className="relative w-full h-screen overflow-hidden bg-void">
      {/* Phaser Game Container */}
      <div id="game-container" className="absolute inset-0 z-0" />

      {/* Scan Lines Overlay */}
      <div className="scan-lines" />

      {/* Vignette */}
      <div className="vignette" />

      {/* ==================== IN-GAME HUD ==================== */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 z-10 pointer-events-none p-4 md:p-6">

          {/* Top HUD Bar */}
          <div className="flex justify-between items-start gap-4">

            {/* Left Column: Oxygen + Power Cells + Resources */}
            <div className="flex flex-col gap-3">
              {/* Oxygen Panel */}
              <div
                className={`holo-panel p-4 w-64 animate-slide-left ${isLowOxygen ? 'holo-panel-orange' : ''}`}
                style={{ animationDelay: '0.1s' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={`${isLowOxygen ? 'text-neon-orange animate-pulse' : 'text-neon-cyan'}`}>
                      <OxygenIcon />
                    </div>
                    <span className="label-tech">OXYGEN SUPPLY</span>
                  </div>
                  <span className={`font-mono text-sm font-bold ${isLowOxygen ? 'text-neon-orange' : 'text-neon-cyan'}`}>
                    {Math.floor(stats.oxygen)}
                  </span>
                </div>

                <div className="progress-container">
                  <div
                    className={`progress-bar ${isLowOxygen ? 'progress-danger' : 'progress-cyan'}`}
                    style={{ width: `${oxygenPercent}%` }}
                  />
                </div>

                {isLowOxygen && (
                  <div className="mt-2 text-xs text-neon-orange font-mono animate-pulse tracking-wider">
                    ⚠ CRITICAL LEVEL
                  </div>
                )}
              </div>

              {/* Power Cells Indicator */}
              <div
                className={`holo-panel p-3 w-64 animate-slide-left ${stats.powerCells >= stats.powerCellsRequired ? 'holo-panel-green' : ''}`}
                style={{ animationDelay: '0.15s', borderColor: stats.powerCells >= stats.powerCellsRequired ? '#4ade80' : '#fbbf24' }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {[...Array(stats.powerCellsRequired)].map((_, i) => (
                      <div
                        key={i}
                        className={`w-4 h-6 rounded-sm transition-all ${
                          i < stats.powerCells
                            ? 'bg-yellow-400 shadow-lg shadow-yellow-400/50'
                            : 'bg-white/20 border border-white/30'
                        }`}
                      />
                    ))}
                  </div>
                  <div>
                    <div className="label-tech text-yellow-400 text-xs">POWER CELLS</div>
                    <div className={`font-mono text-sm font-bold ${stats.powerCells >= stats.powerCellsRequired ? 'text-green-400' : 'text-yellow-400'}`}>
                      {stats.powerCells}/{stats.powerCellsRequired}
                    </div>
                  </div>
                </div>
              </div>

              {/* Resources Panel */}
              <div
                className="holo-panel holo-panel-pink p-3 w-64 animate-slide-left"
                style={{ animationDelay: '0.2s' }}
              >
                <div className="flex justify-around">
                  <div className="text-center">
                    <div className="label-tech text-neon-orange mb-1 text-xs">SHARDS</div>
                    <div className="value-display text-xl text-neon-orange">{stats.resources.shards}</div>
                  </div>
                  <div className="text-center">
                    <div className="label-tech text-neon-pink mb-1 text-xs">MINERALS</div>
                    <div className="value-display text-xl text-neon-pink">{stats.resources.minerals}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom HUD Bar */}
          <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 flex justify-between items-end">

            {/* Health Orbs + Dash Indicator */}
            <div className="flex items-end gap-4 animate-float-up" style={{ animationDelay: '0.3s' }}>
              {/* Health Orbs */}
              <div className="flex gap-2">
                {[...Array(stats.maxHealth)].map((_, i) => (
                  <div
                    key={i}
                    className={`health-orb ${i < stats.health ? 'active' : 'empty'}`}
                  />
                ))}
              </div>

              {/* Dash Ability Indicator */}
              <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.dashCooldown === 1 ? '#4fd1c580' : '#ffffff40' }}>
                <span className="text-lg" style={{ color: stats.dashCooldown === 1 ? '#4fd1c5' : '#ffffff60' }}>⚡</span>
                <div className="flex flex-col">
                  <span className={`text-xs font-mono font-bold ${stats.dashCooldown === 1 ? 'text-neon-cyan' : 'text-white/40'}`}>
                    DASH
                  </span>
                  <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                    <div
                      className="h-full transition-all duration-100"
                      style={{
                        width: `${(stats.dashCooldown ?? 1) * 100}%`,
                        backgroundColor: stats.dashCooldown === 1 ? '#4fd1c5' : '#888'
                      }}
                    />
                  </div>
                </div>
                <span className="text-xs text-white/30 font-mono">[SHIFT]</span>
              </div>

              {/* Skill Tree Abilities */}
              {stats.abilityCooldowns && (
                <>
                  {stats.abilityCooldowns.groundSlam?.has && (
                    <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.abilityCooldowns.groundSlam.current === 0 ? '#f472b680' : '#ffffff40' }}>
                      <span className="text-lg" style={{ color: stats.abilityCooldowns.groundSlam.current === 0 ? '#f472b6' : '#ffffff60' }}>💥</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-mono font-bold ${stats.abilityCooldowns.groundSlam.current === 0 ? 'text-pink-400' : 'text-white/40'}`}>
                          SLAM
                        </span>
                        <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                          <div
                            className="h-full transition-all duration-100"
                            style={{
                              width: `${100 - (stats.abilityCooldowns.groundSlam.current / stats.abilityCooldowns.groundSlam.max) * 100}%`,
                              backgroundColor: stats.abilityCooldowns.groundSlam.current === 0 ? '#f472b6' : '#888'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/30 font-mono">[E]</span>
                    </div>
                  )}
                  {stats.abilityCooldowns.proximityBombs?.has && (
                    <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.abilityCooldowns.proximityBombs.current === 0 ? '#ef444480' : '#ffffff40' }}>
                      <span className="text-lg" style={{ color: stats.abilityCooldowns.proximityBombs.current === 0 ? '#ef4444' : '#ffffff60' }}>💣</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-mono font-bold ${stats.abilityCooldowns.proximityBombs.current === 0 ? 'text-red-400' : 'text-white/40'}`}>
                          BOMB
                        </span>
                        <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                          <div
                            className="h-full transition-all duration-100"
                            style={{
                              width: `${100 - (stats.abilityCooldowns.proximityBombs.current / stats.abilityCooldowns.proximityBombs.max) * 100}%`,
                              backgroundColor: stats.abilityCooldowns.proximityBombs.current === 0 ? '#ef4444' : '#888'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/30 font-mono">[Q]</span>
                    </div>
                  )}
                  {stats.abilityCooldowns.energyBarrier?.has && (
                    <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.abilityCooldowns.energyBarrier.current === 0 ? '#4ade8080' : '#ffffff40' }}>
                      <span className="text-lg" style={{ color: stats.abilityCooldowns.energyBarrier.current === 0 ? '#4ade80' : '#ffffff60' }}>🛡</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-mono font-bold ${stats.abilityCooldowns.energyBarrier.current === 0 ? 'text-green-400' : 'text-white/40'}`}>
                          BARRIER
                        </span>
                        <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                          <div
                            className="h-full transition-all duration-100"
                            style={{
                              width: `${100 - (stats.abilityCooldowns.energyBarrier.current / stats.abilityCooldowns.energyBarrier.max) * 100}%`,
                              backgroundColor: stats.abilityCooldowns.energyBarrier.current === 0 ? '#4ade80' : '#888'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/30 font-mono">[G]</span>
                    </div>
                  )}
                  {stats.abilityCooldowns.grappleHook?.has && (
                    <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.abilityCooldowns.grappleHook.current === 0 ? '#fbbf2480' : '#ffffff40' }}>
                      <span className="text-lg" style={{ color: stats.abilityCooldowns.grappleHook.current === 0 ? '#fbbf24' : '#ffffff60' }}>🪝</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-mono font-bold ${stats.abilityCooldowns.grappleHook.current === 0 ? 'text-yellow-400' : 'text-white/40'}`}>
                          GRAPPLE
                        </span>
                        <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                          <div
                            className="h-full transition-all duration-100"
                            style={{
                              width: `${100 - (stats.abilityCooldowns.grappleHook.current / stats.abilityCooldowns.grappleHook.max) * 100}%`,
                              backgroundColor: stats.abilityCooldowns.grappleHook.current === 0 ? '#fbbf24' : '#888'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/30 font-mono">[R]</span>
                    </div>
                  )}
                  {stats.abilityCooldowns.resourceBeacon?.has && (
                    <div className="holo-panel px-3 py-2 flex items-center gap-2" style={{ borderColor: stats.abilityCooldowns.resourceBeacon.current === 0 ? '#818cf880' : '#ffffff40' }}>
                      <span className="text-lg" style={{ color: stats.abilityCooldowns.resourceBeacon.current === 0 ? '#818cf8' : '#ffffff60' }}>📡</span>
                      <div className="flex flex-col">
                        <span className={`text-xs font-mono font-bold ${stats.abilityCooldowns.resourceBeacon.current === 0 ? 'text-purple-400' : 'text-white/40'}`}>
                          BEACON
                        </span>
                        <div className="w-10 h-1 bg-white/20 rounded overflow-hidden mt-1">
                          <div
                            className="h-full transition-all duration-100"
                            style={{
                              width: `${100 - (stats.abilityCooldowns.resourceBeacon.current / stats.abilityCooldowns.resourceBeacon.max) * 100}%`,
                              backgroundColor: stats.abilityCooldowns.resourceBeacon.current === 0 ? '#818cf8' : '#888'
                            }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-white/30 font-mono">[F]</span>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Active Pickups Display */}
            {stats.activePickups && stats.activePickups.length > 0 && (
              <div className="flex gap-2 animate-float-up" style={{ animationDelay: '0.35s' }}>
                {stats.activePickups.map((pickup, idx) => {
                  const info = getPickupInfo(pickup.type);
                  const durationPercent = pickup.duration ? Math.min(100, (pickup.duration / 15000) * 100) : 100;
                  return (
                    <div
                      key={`${pickup.type}-${idx}`}
                      className="holo-panel px-3 py-2 flex items-center gap-2"
                      style={{ borderColor: info.color + '80' }}
                    >
                      <span className="text-lg" style={{ color: info.color }}>{info.icon}</span>
                      <div className="flex flex-col">
                        <span className="text-xs font-mono font-bold" style={{ color: info.color }}>
                          {info.name}
                          {pickup.stacks && pickup.stacks > 1 ? ` x${pickup.stacks}` : ''}
                        </span>
                        {pickup.duration !== undefined && (
                          <div className="w-12 h-1 bg-white/20 rounded overflow-hidden mt-1">
                            <div
                              className="h-full transition-all duration-200"
                              style={{
                                width: `${durationPercent}%`,
                                backgroundColor: info.color
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Depth Meter */}
            <div
              className="holo-panel p-4 animate-float-up"
              style={{ animationDelay: '0.4s' }}
            >
              <div className="flex items-baseline gap-3">
                <span className="label-tech">DEPTH</span>
                <span className="value-display text-4xl text-white">
                  -{stats.depth}
                  <span className="text-lg text-neon-cyan ml-1">M</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== HUB SCREEN ==================== */}
      {gameState === GameState.HUB && (
        <div className="overlay-dark flex items-center justify-center p-4">
          <div className="hex-pattern" />
          <div className="grid-lines" />

          <div
            className={`relative max-w-5xl w-full transition-all duration-700 ${isLoaded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          >
            {/* Corner brackets */}
            <div className="corner-bracket tl" />
            <div className="corner-bracket tr" />
            <div className="corner-bracket bl" />
            <div className="corner-bracket br" />

            {/* Main content */}
            <div className="relative z-10 p-8 md:p-12">

              {/* Title Section */}
              <div className="text-center mb-10">
                <div className="title-sub mb-2 opacity-0 animate-float-up" style={{ animationDelay: '0.1s', animationFillMode: 'forwards' }}>
                  SUBTERRANEAN EXTRACTION PROTOCOL
                </div>
                <h1 className="title-massive glitch opacity-0 animate-float-up" data-text="CORE DIVER" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
                  CORE DIVER
                </h1>

                {/* Status indicators */}
                <div className="flex justify-center gap-4 mt-6 opacity-0 animate-float-up" style={{ animationDelay: '0.3s', animationFillMode: 'forwards' }}>
                  <div className="holo-panel-orange px-4 py-2 rounded flex items-center gap-2 border border-neon-orange/30 bg-neon-orange/10">
                    <div className="w-2 h-2 rounded-full bg-neon-orange animate-pulse" />
                    <span className="font-display text-sm text-neon-orange tracking-wider">
                      DANGER LEVEL {difficulty}
                    </span>
                  </div>
                  <div className="holo-panel px-5 py-2 rounded flex items-center gap-2">
                    <span className="font-mono text-lg font-bold text-neon-orange">{totalShards}</span>
                    <span className="label-tech">SHARDS</span>
                  </div>
                </div>

                {/* Tab Switcher */}
                <div className="flex justify-center gap-2 mt-6 opacity-0 animate-float-up" style={{ animationDelay: '0.35s', animationFillMode: 'forwards' }}>
                  <button
                    onClick={() => setHubTab('upgrades')}
                    className={`px-6 py-2 rounded font-display text-sm tracking-wider transition-all ${
                      hubTab === 'upgrades'
                        ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan'
                        : 'bg-white/5 border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40'
                    }`}
                  >
                    UPGRADES
                  </button>
                  <button
                    onClick={() => { setHubTab('skills'); setSelectedSkill(null); }}
                    className={`px-6 py-2 rounded font-display text-sm tracking-wider transition-all ${
                      hubTab === 'skills'
                        ? 'bg-neon-purple/20 border border-neon-purple text-neon-purple'
                        : 'bg-white/5 border border-white/20 text-white/50 hover:text-white/80 hover:border-white/40'
                    }`}
                  >
                    SKILL TREE
                    {skillTreeState.unlockedSkills.length > 0 && (
                      <span className="ml-2 px-1.5 py-0.5 rounded bg-neon-purple/30 text-xs">
                        {skillTreeState.unlockedSkills.length}
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Upgrades Grid (shown when upgrades tab is active) */}
              {hubTab === 'upgrades' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 max-h-[40vh] overflow-y-auto pr-2">

                {/* Oxygen Upgrade */}
                <div
                  className="upgrade-card oxygen opacity-0 animate-float-up"
                  style={{ animationDelay: '0.4s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-cyan/20 flex items-center justify-center text-neon-cyan">
                        <OxygenIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-neon-cyan tracking-wider">OXYGEN TANK</h3>
                        <p className="text-xs text-white/50 font-ui">Extended capacity reserves</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-neon-cyan">
                      LVL {upgrades.oxygenLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    Increases maximum oxygen capacity by 25% per level.
                  </p>
                  <button
                    onClick={() => buyUpgrade('oxygenLevel')}
                    disabled={totalShards < 100 * upgrades.oxygenLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.oxygenLevel
                        ? 'bg-neon-cyan/20 border border-neon-cyan text-neon-cyan hover:bg-neon-cyan hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.oxygenLevel} SHARDS
                  </button>
                </div>

                {/* Drill Upgrade */}
                <div
                  className="upgrade-card drill opacity-0 animate-float-up"
                  style={{ animationDelay: '0.5s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-pink/20 flex items-center justify-center text-neon-pink">
                        <DrillIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-neon-pink tracking-wider">DRILL CORE</h3>
                        <p className="text-xs text-white/50 font-ui">Enhanced extraction yield</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-neon-pink">
                      LVL {upgrades.drillLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    Multiplies shard gain from all extraction sources.
                  </p>
                  <button
                    onClick={() => buyUpgrade('drillLevel')}
                    disabled={totalShards < 100 * upgrades.drillLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.drillLevel
                        ? 'bg-neon-pink/20 border border-neon-pink text-neon-pink hover:bg-neon-pink hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.drillLevel} SHARDS
                  </button>
                </div>

                {/* Speed Upgrade */}
                <div
                  className="upgrade-card speed opacity-0 animate-float-up"
                  style={{ animationDelay: '0.6s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-neon-green/20 flex items-center justify-center text-neon-green">
                        <SpeedIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-neon-green tracking-wider">THRUSTERS</h3>
                        <p className="text-xs text-white/50 font-ui">Propulsion enhancement</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-neon-green">
                      LVL {upgrades.speedLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    Increases movement speed for faster traversal.
                  </p>
                  <button
                    onClick={() => buyUpgrade('speedLevel')}
                    disabled={totalShards < 100 * upgrades.speedLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.speedLevel
                        ? 'bg-neon-green/20 border border-neon-green text-neon-green hover:bg-neon-green hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.speedLevel} SHARDS
                  </button>
                </div>

                {/* Vision Upgrade */}
                <div
                  className="upgrade-card vision opacity-0 animate-float-up"
                  style={{ animationDelay: '0.7s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-amber-400/20 flex items-center justify-center text-amber-400">
                        <VisionIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-amber-400 tracking-wider">HI-BEAM</h3>
                        <p className="text-xs text-white/50 font-ui">Illumination array</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-amber-400">
                      LVL {upgrades.visionLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    Extends light radius in subterranean depths.
                  </p>
                  <button
                    onClick={() => buyUpgrade('visionLevel')}
                    disabled={totalShards < 100 * upgrades.visionLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.visionLevel
                        ? 'bg-amber-400/20 border border-amber-400 text-amber-400 hover:bg-amber-400 hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.visionLevel} SHARDS
                  </button>
                </div>

                {/* Armor Upgrade */}
                <div
                  className="upgrade-card armor opacity-0 animate-float-up"
                  style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-red-400/20 flex items-center justify-center text-red-400">
                        <ArmorIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-red-400 tracking-wider">ARMOR PLATING</h3>
                        <p className="text-xs text-white/50 font-ui">Reinforced hull</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-red-400">
                      LVL {upgrades.armorLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    +1 maximum health per level. Current: {2 + upgrades.armorLevel} HP
                  </p>
                  <button
                    onClick={() => buyUpgrade('armorLevel')}
                    disabled={totalShards < 100 * upgrades.armorLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.armorLevel
                        ? 'bg-red-400/20 border border-red-400 text-red-400 hover:bg-red-400 hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.armorLevel} SHARDS
                  </button>
                </div>

                {/* O2 Efficiency Upgrade */}
                <div
                  className="upgrade-card efficiency opacity-0 animate-float-up"
                  style={{ animationDelay: '0.85s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-sky-400/20 flex items-center justify-center text-sky-400">
                        <EfficiencyIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-sky-400 tracking-wider">O2 RECYCLER</h3>
                        <p className="text-xs text-white/50 font-ui">Atmospheric processor</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-sky-400">
                      LVL {upgrades.efficiencyLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    -10% oxygen drain per level. Current: {Math.max(30, 100 - (upgrades.efficiencyLevel - 1) * 10)}%
                  </p>
                  <button
                    onClick={() => buyUpgrade('efficiencyLevel')}
                    disabled={totalShards < 100 * upgrades.efficiencyLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.efficiencyLevel
                        ? 'bg-sky-400/20 border border-sky-400 text-sky-400 hover:bg-sky-400 hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.efficiencyLevel} SHARDS
                  </button>
                </div>

                {/* Shard Bonus Upgrade */}
                <div
                  className="upgrade-card shard opacity-0 animate-float-up"
                  style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-yellow-400/20 flex items-center justify-center text-yellow-400">
                        <ShardIcon />
                      </div>
                      <div>
                        <h3 className="font-display font-bold text-yellow-400 tracking-wider">LUCKY STRIKE</h3>
                        <p className="text-xs text-white/50 font-ui">Fortune amplifier</p>
                      </div>
                    </div>
                    <div className="px-2 py-1 rounded bg-abyss-deep text-xs font-mono text-yellow-400">
                      LVL {upgrades.shardLevel}
                    </div>
                  </div>
                  <p className="text-sm text-white/60 mb-4 font-ui">
                    +15% shard gain per level. Current: +{(upgrades.shardLevel - 1) * 15}%
                  </p>
                  <button
                    onClick={() => buyUpgrade('shardLevel')}
                    disabled={totalShards < 100 * upgrades.shardLevel}
                    className={`w-full py-2.5 rounded font-display text-sm tracking-wider transition-all
                      ${totalShards >= 100 * upgrades.shardLevel
                        ? 'bg-yellow-400/20 border border-yellow-400 text-yellow-400 hover:bg-yellow-400 hover:text-void'
                        : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'}`}
                  >
                    UPGRADE — {100 * upgrades.shardLevel} SHARDS
                  </button>
                </div>
              </div>
              )}

              {/* Skill Tree View (shown when skills tab is active) */}
              {hubTab === 'skills' && (
                <div className="mb-8">
                  <div className="flex gap-4">
                    {/* Skill Tree Canvas */}
                    <div className="flex-1 holo-panel p-4 relative overflow-hidden" style={{ minHeight: '400px' }}>
                      {/* SVG for connections */}
                      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 0 }}>
                        <g transform="translate(50%, 50%)" style={{ transform: 'translate(50%, 50%)' }}>
                          {getSkillConnections().map(({ from, to }) => {
                            const fromSkill = getSkillById(from);
                            const toSkill = getSkillById(to);
                            if (!fromSkill || !toSkill) return null;
                            const isActive = skillTreeState.unlockedSkills.includes(from) && skillTreeState.unlockedSkills.includes(to);
                            const branchColor = SKILL_BRANCH_CONFIG[toSkill.branch].color;
                            return (
                              <line
                                key={`${from}-${to}`}
                                x1={fromSkill.position.x}
                                y1={fromSkill.position.y}
                                x2={toSkill.position.x}
                                y2={toSkill.position.y}
                                stroke={branchColor}
                                strokeWidth={isActive ? 2 : 1}
                                opacity={isActive ? 0.8 : 0.2}
                                className="transition-all duration-300"
                              />
                            );
                          })}
                        </g>
                      </svg>

                      {/* Skill Nodes */}
                      <div className="relative w-full h-full" style={{ minHeight: '400px' }}>
                        {/* Center point */}
                        <div
                          className="absolute w-12 h-12 rounded-full bg-gradient-to-br from-neon-cyan to-neon-purple border-2 border-white/50 flex items-center justify-center"
                          style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
                        >
                          <span className="text-lg font-bold">C</span>
                        </div>

                        {/* Branch labels */}
                        {(Object.entries(SKILL_BRANCH_CONFIG) as [SkillBranch, typeof SKILL_BRANCH_CONFIG[SkillBranch]][]).map(([branch, config]) => {
                          const angle = { excavator: 90, vanguard: 162, endurance: 234, mobility: 306, prospector: 18 }[branch] * (Math.PI / 180);
                          const labelRadius = 180;
                          return (
                            <div
                              key={branch}
                              className="absolute text-xs font-display tracking-wider whitespace-nowrap"
                              style={{
                                left: `calc(50% + ${Math.cos(angle) * labelRadius}px)`,
                                top: `calc(50% - ${Math.sin(angle) * labelRadius}px)`,
                                transform: 'translate(-50%, -50%)',
                                color: config.color
                              }}
                            >
                              {config.icon} {config.name}
                            </div>
                          );
                        })}

                        {/* Skill Nodes */}
                        {SKILL_TREE_DATA.map(skill => {
                          const isUnlocked = skillTreeState.unlockedSkills.includes(skill.id);
                          const isAvailable = canUnlockSkill(skill.id, skillTreeState.unlockedSkills);
                          const isSelected = selectedSkill === skill.id;
                          const branchConfig = SKILL_BRANCH_CONFIG[skill.branch];

                          // Node size based on type
                          const nodeSize = skill.type === 'keystone' ? 36 : skill.type === 'ability' ? 28 : skill.type === 'passive_major' ? 24 : 20;

                          return (
                            <button
                              key={skill.id}
                              onClick={() => setSelectedSkill(skill.id)}
                              className={`absolute rounded-full transition-all duration-300 flex items-center justify-center
                                ${isUnlocked ? 'ring-2' : ''}
                                ${isAvailable && !isUnlocked ? 'animate-pulse cursor-pointer' : ''}
                                ${!isAvailable && !isUnlocked ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-pointer'}
                                ${isSelected ? 'ring-4 ring-white scale-125 z-10' : 'hover:scale-110'}
                              `}
                              style={{
                                left: `calc(50% + ${skill.position.x}px)`,
                                top: `calc(50% + ${skill.position.y}px)`,
                                transform: 'translate(-50%, -50%)',
                                width: nodeSize,
                                height: nodeSize,
                                backgroundColor: isUnlocked ? branchConfig.color : `${branchConfig.color}40`,
                                borderColor: branchConfig.color,
                                borderWidth: 2,
                                boxShadow: isUnlocked ? `0 0 12px ${branchConfig.color}` : 'none'
                              }}
                              title={skill.name}
                            >
                              {skill.type === 'keystone' && <span className="text-xs">K</span>}
                              {skill.type === 'ability' && <span className="text-xs">A</span>}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Skill Detail Panel */}
                    <div className="w-72 holo-panel p-4">
                      {selectedSkill ? (() => {
                        const skill = getSkillById(selectedSkill);
                        if (!skill) return null;
                        const branchConfig = SKILL_BRANCH_CONFIG[skill.branch];
                        const isUnlocked = skillTreeState.unlockedSkills.includes(skill.id);
                        const isAvailable = canUnlockSkill(skill.id, skillTreeState.unlockedSkills);
                        const canAfford = totalShards >= skill.cost;

                        return (
                          <div>
                            {/* Header */}
                            <div className="flex items-center gap-2 mb-3">
                              <span style={{ color: branchConfig.color }}>{branchConfig.icon}</span>
                              <span className="text-xs font-mono px-2 py-0.5 rounded" style={{ backgroundColor: `${branchConfig.color}30`, color: branchConfig.color }}>
                                {branchConfig.name}
                              </span>
                              <span className="text-xs text-white/40 font-mono ml-auto">
                                T{skill.tier} {skill.type.toUpperCase()}
                              </span>
                            </div>

                            {/* Name */}
                            <h3 className="font-display text-lg font-bold mb-2" style={{ color: branchConfig.color }}>
                              {skill.name}
                            </h3>

                            {/* Description */}
                            <p className="text-sm text-white/70 mb-4 font-ui">
                              {skill.description}
                            </p>

                            {/* Prerequisites */}
                            {skill.prerequisites.length > 0 && (
                              <div className="mb-4">
                                <div className="text-xs text-white/40 mb-1 font-mono">REQUIRES:</div>
                                <div className="flex flex-wrap gap-1">
                                  {skill.prerequisites.map(prereq => {
                                    const prereqSkill = getSkillById(prereq);
                                    const hasPrereq = skillTreeState.unlockedSkills.includes(prereq);
                                    return (
                                      <span
                                        key={prereq}
                                        className={`text-xs px-2 py-0.5 rounded ${hasPrereq ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}
                                      >
                                        {prereqSkill?.name || prereq}
                                      </span>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            {/* Status / Unlock Button */}
                            {isUnlocked ? (
                              <div className="w-full py-3 rounded bg-green-500/20 border border-green-500 text-green-400 text-center font-display tracking-wider">
                                UNLOCKED
                              </div>
                            ) : (
                              <button
                                onClick={() => unlockSkill(skill.id)}
                                disabled={!isAvailable || !canAfford}
                                className={`w-full py-3 rounded font-display tracking-wider transition-all ${
                                  isAvailable && canAfford
                                    ? 'border text-white hover:bg-white/10'
                                    : 'bg-white/5 border border-white/10 text-white/30 cursor-not-allowed'
                                }`}
                                style={isAvailable && canAfford ? { borderColor: branchConfig.color, color: branchConfig.color } : {}}
                              >
                                {!isAvailable ? 'LOCKED' : `UNLOCK — ${skill.cost} SHARDS`}
                              </button>
                            )}
                          </div>
                        );
                      })() : (
                        <div className="text-center text-white/40 py-8">
                          <div className="text-3xl mb-2">?</div>
                          <p className="font-ui text-sm">Select a skill node to view details</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Branch Legend */}
                  <div className="flex justify-center gap-4 mt-4">
                    {(Object.entries(SKILL_BRANCH_CONFIG) as [SkillBranch, typeof SKILL_BRANCH_CONFIG[SkillBranch]][]).map(([branch, config]) => {
                      const branchSkills = SKILL_TREE_DATA.filter(s => s.branch === branch);
                      const unlockedCount = branchSkills.filter(s => skillTreeState.unlockedSkills.includes(s.id)).length;
                      return (
                        <div key={branch} className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
                          <span className="text-white/60">{config.name}</span>
                          <span className="text-white/40">{unlockedCount}/{branchSkills.length}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Start Button */}
              <button
                onClick={startGame}
                className="btn-primary w-full py-5 text-lg opacity-0 animate-float-up"
                style={{ animationDelay: '0.8s', animationFillMode: 'forwards' }}
              >
                INITIATE DIVE SEQUENCE
              </button>

              {/* Controls hint */}
              <div className="mt-6 text-center opacity-0 animate-float-up" style={{ animationDelay: '0.9s', animationFillMode: 'forwards' }}>
                <span className="text-xs text-white/30 font-mono tracking-wider">
                  [WASD/ARROWS] MOVE • [SPACE] FIRE BEAM • [SHIFT] DASH
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VICTORY SCREEN ==================== */}
      {gameState === GameState.VICTORY && (
        <div className="overlay-dark overlay-victory flex items-center justify-center p-4">
          <div className="hex-pattern" style={{ opacity: 0.05 }} />

          <div className="relative max-w-lg w-full animate-float-up">
            <div className="corner-bracket tl" style={{ borderColor: '#bf5fff' }} />
            <div className="corner-bracket tr" style={{ borderColor: '#bf5fff' }} />
            <div className="corner-bracket bl" style={{ borderColor: '#bf5fff' }} />
            <div className="corner-bracket br" style={{ borderColor: '#bf5fff' }} />

            <div className="relative z-10 p-8 text-center">
              <div className="text-sm font-mono text-neon-purple tracking-widest mb-2">
                // EXTRACTION COMPLETE //
              </div>

              <h2 className="font-display text-5xl font-black mb-2 bg-gradient-to-r from-neon-purple via-neon-pink to-neon-purple bg-clip-text text-transparent">
                ARTIFACT SECURED
              </h2>

              <p className="text-white/60 mb-8 font-ui">
                Core sample successfully retrieved from depth -{stats.depth}m
              </p>

              {/* Stats breakdown */}
              <div className="holo-panel p-6 mb-6 text-left" style={{ borderColor: 'rgba(191, 95, 255, 0.3)' }}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60 font-ui">Run Shards</span>
                    <span className="font-mono font-bold text-neon-orange">+{stats.resources.shards}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60 font-ui">Artifact Bonus</span>
                    <span className="font-mono font-bold text-neon-purple">+200</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white font-display tracking-wider">TOTAL EARNED</span>
                    <span className="font-mono font-bold text-2xl text-neon-green">+{stats.resources.shards + 200}</span>
                  </div>
                </div>
              </div>

              <div className="mb-6 py-3 rounded bg-neon-orange/10 border border-neon-orange/30">
                <span className="font-display text-neon-orange tracking-wider animate-pulse">
                  ⚠ DANGER LEVEL INCREASED TO {difficulty}
                </span>
              </div>

              <button
                onClick={() => setGameState(GameState.HUB)}
                className="btn-secondary w-full py-4"
                style={{ borderColor: '#bf5fff', color: '#bf5fff' }}
              >
                RETURN TO HUB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================== GAME OVER SCREEN ==================== */}
      {gameState === GameState.GAME_OVER && (
        <div className="overlay-dark overlay-death flex items-center justify-center p-4">

          <div className="relative max-w-lg w-full animate-float-up">
            {/* Danger stripes at top */}
            <div className="absolute -top-1 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-danger-red to-transparent animate-pulse" />

            <div className="corner-bracket tl" style={{ borderColor: '#ff1744' }} />
            <div className="corner-bracket tr" style={{ borderColor: '#ff1744' }} />
            <div className="corner-bracket bl" style={{ borderColor: '#ff1744' }} />
            <div className="corner-bracket br" style={{ borderColor: '#ff1744' }} />

            <div className="relative z-10 p-8 text-center">
              <div className="text-sm font-mono text-danger-red tracking-widest mb-2 animate-pulse">
                // SYSTEM FAILURE //
              </div>

              <h2 className="font-display text-5xl font-black mb-4 text-danger-red glitch" data-text="MISSION FAILED">
                MISSION FAILED
              </h2>

              <div className="inline-block px-4 py-2 rounded bg-danger-red/20 border border-danger-red/50 mb-8">
                <span className="font-mono text-danger-red">
                  CAUSE: {deathReason.toUpperCase()}
                </span>
              </div>

              {/* Stats breakdown */}
              <div className="holo-panel p-6 mb-6 text-left" style={{ borderColor: 'rgba(255, 23, 68, 0.3)' }}>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-white/10">
                    <span className="text-white/60 font-ui">Final Depth</span>
                    <span className="font-mono font-bold text-white">-{stats.depth}m</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-white/60 font-ui">Shards Salvaged (50%)</span>
                    <span className="font-mono font-bold text-neon-orange">+{Math.floor(stats.resources.shards * 0.5)}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setGameState(GameState.HUB)}
                className="w-full py-4 rounded font-display tracking-wider transition-all bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white"
              >
                RETURN TO SURFACE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
