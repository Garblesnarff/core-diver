import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from './game/CoreDiverGame';
import { GameState, EVENTS, GameStats, PlayerUpgrades } from './types';

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

const App: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.HUB);
  const [totalShards, setTotalShards] = useState<number>(0);
  const [difficulty, setDifficulty] = useState<number>(1);
  const [upgrades, setUpgrades] = useState<PlayerUpgrades>({
    oxygenLevel: 1,
    drillLevel: 1,
    speedLevel: 1,
    visionLevel: 1
  });
  const [stats, setStats] = useState<GameStats>({
    oxygen: 100,
    maxOxygen: 100,
    depth: 0,
    health: 3,
    resources: { shards: 0, minerals: 0 },
    powerCells: 0,
    powerCellsRequired: 3
  });
  const [deathReason, setDeathReason] = useState<string>('');
  const [isLoaded, setIsLoaded] = useState(false);

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
        mainScene.scene.restart({ upgrades, difficulty });
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

            {/* Resources Panel */}
            <div
              className="holo-panel holo-panel-pink p-4 animate-slide-right"
              style={{ animationDelay: '0.2s' }}
            >
              <div className="flex gap-8">
                <div className="text-center">
                  <div className="label-tech text-neon-orange mb-1">SHARDS</div>
                  <div className="value-display text-2xl text-neon-orange">{stats.resources.shards}</div>
                </div>
                <div className="text-center">
                  <div className="label-tech text-neon-pink mb-1">MINERALS</div>
                  <div className="value-display text-2xl text-neon-pink">{stats.resources.minerals}</div>
                </div>
              </div>
            </div>

            {/* Power Cells Indicator */}
            <div
              className={`holo-panel p-3 animate-slide-right ${stats.powerCells >= stats.powerCellsRequired ? 'holo-panel-green' : ''}`}
              style={{ animationDelay: '0.25s', borderColor: stats.powerCells >= stats.powerCellsRequired ? '#4ade80' : '#fbbf24' }}
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
          </div>

          {/* Bottom HUD Bar */}
          <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6 flex justify-between items-end">

            {/* Health Orbs */}
            <div className="flex gap-3 animate-float-up" style={{ animationDelay: '0.3s' }}>
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className={`health-orb ${i < stats.health ? 'active' : 'empty'}`}
                />
              ))}
            </div>

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
              </div>

              {/* Upgrades Grid */}
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
              </div>

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
                  [WASD/ARROWS] MOVE • [SPACE] FIRE BEAM
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
