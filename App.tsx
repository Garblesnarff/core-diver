import React, { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { createGame } from './game/CoreDiverGame';
import { GameState, EVENTS, GameStats, PlayerUpgrades } from './types';
import { COLORS } from './constants';

const App: React.FC = () => {
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>(GameState.HUB);
  
  // Persistent State (In a real app, use LocalStorage)
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
    resources: { shards: 0, minerals: 0 }
  });
  const [deathReason, setDeathReason] = useState<string>('');

  useEffect(() => {
    // Initialize Phaser only once
    if (!gameRef.current) {
      gameRef.current = createGame('game-container');
    }

    const handleStats = (e: any) => setStats({ ...e.detail });
    
    const handleGameOver = (e: any) => {
        setDeathReason(e.detail.reason);
        // On death, you keep 10% of shards? Or 0? Let's be nice, keep 50%
        setTotalShards(prev => prev + Math.floor(e.detail.stats.resources.shards * 0.5));
        setGameState(GameState.GAME_OVER);
    };

    const handleVictory = (e: any) => {
        setTotalShards(prev => prev + e.detail.stats.resources.shards + 200); // +200 Bonus
        setDifficulty(prev => prev + 1); // Increase difficulty
        setGameState(GameState.VICTORY);
    };

    window.addEventListener(EVENTS.STATS_UPDATE, handleStats);
    window.addEventListener(EVENTS.GAME_OVER, handleGameOver);
    window.addEventListener(EVENTS.VICTORY, handleVictory);

    return () => {
      window.removeEventListener(EVENTS.STATS_UPDATE, handleStats);
      window.removeEventListener(EVENTS.GAME_OVER, handleGameOver);
      window.removeEventListener(EVENTS.VICTORY, handleVictory);
      
      // Cleanup Phaser instance on unmount
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
            // Pass upgrades and difficulty to the scene
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

  return (
    <div className="relative w-full h-screen overflow-hidden text-white font-sans">
      {/* Phaser Container */}
      <div id="game-container" className="absolute inset-0 z-0" />

      {/* --- HUD (Visible while playing) --- */}
      {gameState === GameState.PLAYING && (
        <div className="absolute inset-0 z-10 pointer-events-none p-6 flex flex-col justify-between">
          
          {/* Top Bar */}
          <div className="flex justify-between items-start">
            {/* Oxygen Tank */}
            <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border-2 border-slate-700 w-64 shadow-xl">
              <div className="flex justify-between mb-2">
                <span className="text-cyan-300 font-bold tracking-wider">OXYGEN</span>
                <span className="font-mono">{Math.floor(stats.oxygen)} / {stats.maxOxygen}</span>
              </div>
              <div className="w-full h-4 bg-slate-800 rounded-full overflow-hidden">
                <div 
                    className={`h-full transition-all duration-300 ${stats.oxygen < 30 ? 'bg-red-500 animate-pulse' : 'bg-cyan-400'}`}
                    style={{ width: `${(stats.oxygen / stats.maxOxygen) * 100}%` }}
                />
              </div>
            </div>

            {/* Resources */}
            <div className="bg-slate-900/80 backdrop-blur-md p-4 rounded-2xl border-2 border-slate-700 flex gap-6 shadow-xl">
                <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-400 uppercase">Shards</span>
                    <span className="text-xl font-bold text-orange-400">{stats.resources.shards}</span>
                </div>
                <div className="flex flex-col items-center">
                    <span className="text-xs text-slate-400 uppercase">Minerals</span>
                    <span className="text-xl font-bold text-pink-400">{stats.resources.minerals}</span>
                </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="flex justify-between items-end">
             {/* Health */}
             <div className="flex gap-2">
                 {[...Array(3)].map((_, i) => (
                     <div 
                        key={i} 
                        className={`w-8 h-8 rounded-full border-2 border-white/20 transition-all ${i < stats.health ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)]' : 'bg-transparent'}`}
                    />
                 ))}
             </div>

             {/* Depth Meter */}
             <div className="bg-slate-900/80 backdrop-blur-md px-6 py-3 rounded-2xl border-2 border-slate-700">
                 <span className="text-slate-400 mr-2">DEPTH</span>
                 <span className="text-3xl font-bold font-mono text-white">-{stats.depth}m</span>
             </div>
          </div>
        </div>
      )}

      {/* --- HUB (Main Menu) --- */}
      {gameState === GameState.HUB && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
          <div className="max-w-4xl w-full bg-slate-800 p-8 rounded-3xl border-4 border-slate-600 shadow-2xl flex flex-col max-h-[90vh]">
            <div className="text-center mb-6">
                <h1 className="text-6xl font-black mb-2 text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                CORE DIVER
                </h1>
                <div className="flex justify-center gap-4 items-center">
                    <div className="bg-red-500/20 px-4 py-1 rounded border border-red-500/50 text-red-300 font-bold">
                        DANGER LEVEL {difficulty}
                    </div>
                    <div className="bg-slate-900 px-6 py-1 rounded-full border border-orange-500/30">
                        <span className="text-orange-400 font-bold text-xl">{totalShards} SHARDS</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8 overflow-y-auto pr-2">
                {/* Upgrade: Oxygen */}
                <div className="bg-slate-700 p-4 rounded-xl border border-slate-600 hover:border-cyan-400 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-cyan-300">OXYGEN TANK</span>
                        <span className="text-sm bg-slate-900 px-2 py-1 rounded">Lvl {upgrades.oxygenLevel}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 h-8">Increases max oxygen capacity +25%.</p>
                    <button 
                        onClick={() => buyUpgrade('oxygenLevel')}
                        disabled={totalShards < 100 * upgrades.oxygenLevel}
                        className={`w-full py-2 rounded font-bold uppercase ${totalShards >= 100 * upgrades.oxygenLevel ? 'bg-cyan-600 hover:bg-cyan-500' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
                    >
                        Upgrade ({100 * upgrades.oxygenLevel})
                    </button>
                </div>

                {/* Upgrade: Drill */}
                <div className="bg-slate-700 p-4 rounded-xl border border-slate-600 hover:border-pink-400 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-pink-300">DRILL EFFICIENCY</span>
                        <span className="text-sm bg-slate-900 px-2 py-1 rounded">Lvl {upgrades.drillLevel}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 h-8">Multiplies shard gain from all sources.</p>
                    <button 
                        onClick={() => buyUpgrade('drillLevel')}
                        disabled={totalShards < 100 * upgrades.drillLevel}
                        className={`w-full py-2 rounded font-bold uppercase ${totalShards >= 100 * upgrades.drillLevel ? 'bg-pink-600 hover:bg-pink-500' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
                    >
                        Upgrade ({100 * upgrades.drillLevel})
                    </button>
                </div>

                {/* Upgrade: Speed */}
                <div className="bg-slate-700 p-4 rounded-xl border border-slate-600 hover:border-green-400 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-green-300">THRUSTERS</span>
                        <span className="text-sm bg-slate-900 px-2 py-1 rounded">Lvl {upgrades.speedLevel}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 h-8">Increases movement speed.</p>
                    <button 
                        onClick={() => buyUpgrade('speedLevel')}
                        disabled={totalShards < 100 * upgrades.speedLevel}
                        className={`w-full py-2 rounded font-bold uppercase ${totalShards >= 100 * upgrades.speedLevel ? 'bg-green-600 hover:bg-green-500' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
                    >
                        Upgrade ({100 * upgrades.speedLevel})
                    </button>
                </div>

                 {/* Upgrade: Vision */}
                 <div className="bg-slate-700 p-4 rounded-xl border border-slate-600 hover:border-yellow-400 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-yellow-300">HI-BEAM LAMP</span>
                        <span className="text-sm bg-slate-900 px-2 py-1 rounded">Lvl {upgrades.visionLevel}</span>
                    </div>
                    <p className="text-xs text-slate-400 mb-4 h-8">Increases light radius in deep caves.</p>
                    <button 
                        onClick={() => buyUpgrade('visionLevel')}
                        disabled={totalShards < 100 * upgrades.visionLevel}
                        className={`w-full py-2 rounded font-bold uppercase ${totalShards >= 100 * upgrades.visionLevel ? 'bg-yellow-600 hover:bg-yellow-500' : 'bg-slate-600 opacity-50 cursor-not-allowed'}`}
                    >
                        Upgrade ({100 * upgrades.visionLevel})
                    </button>
                </div>
            </div>

            <button 
                onClick={startGame}
                className="w-full py-4 bg-gradient-to-r from-orange-500 to-pink-500 rounded-xl text-xl font-bold uppercase tracking-widest hover:scale-105 transition-transform shadow-lg shadow-orange-500/20 mt-auto"
            >
                Start Dive
            </button>
          </div>
        </div>
      )}

      {/* --- VICTORY SCREEN --- */}
      {gameState === GameState.VICTORY && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-purple-900/90 backdrop-blur-md">
           <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border-4 border-purple-400 shadow-[0_0_50px_rgba(168,85,247,0.4)] text-center">
                <h2 className="text-5xl font-black mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">MISSION SUCCESS</h2>
                <div className="text-lg text-slate-300 mb-8">
                    Artifact Retrieved!
                </div>

                <div className="space-y-4 mb-8 text-left bg-slate-800 p-6 rounded-xl border border-purple-500/30">
                    <div className="flex justify-between">
                        <span className="text-slate-400">Run Shards</span>
                        <span className="font-bold text-orange-400">+{stats.resources.shards}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Artifact Bonus</span>
                        <span className="font-bold text-yellow-400">+200</span>
                    </div>
                    <div className="border-t border-slate-700 pt-2 flex justify-between">
                        <span className="text-white font-bold">Total Earned</span>
                        <span className="font-bold text-green-400">+{stats.resources.shards + 200}</span>
                    </div>
                </div>

                <div className="mb-4 text-red-400 font-bold uppercase animate-pulse">
                    Danger Level Increased to {difficulty}
                </div>

                <button 
                    onClick={() => setGameState(GameState.HUB)}
                    className="w-full py-4 bg-purple-600 hover:bg-purple-500 rounded-xl text-xl font-bold uppercase tracking-widest transition-colors shadow-lg"
                >
                    Return to Hub
                </button>
           </div>
        </div>
      )}

      {/* --- GAME OVER --- */}
      {gameState === GameState.GAME_OVER && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-900/80 backdrop-blur-sm">
           <div className="max-w-md w-full bg-slate-900 p-8 rounded-3xl border-4 border-red-500 shadow-2xl text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-red-500 animate-pulse" />
                
                <h2 className="text-5xl font-black mb-4 text-red-500">CRITICAL FAILURE</h2>
                <div className="text-xl text-white mb-8 font-mono border border-red-500/30 bg-red-500/10 p-2 rounded">
                    CAUSE: {deathReason}
                </div>

                <div className="space-y-4 mb-8 text-left bg-slate-800 p-6 rounded-xl">
                    <div className="flex justify-between border-b border-slate-700 pb-2">
                        <span className="text-slate-400">Depth Reached</span>
                        <span className="font-bold text-white">-{stats.depth}m</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-slate-400">Shards Salvaged (50%)</span>
                        <span className="font-bold text-orange-400">+{Math.floor(stats.resources.shards * 0.5)}</span>
                    </div>
                </div>

                <button 
                    onClick={() => setGameState(GameState.HUB)}
                    className="w-full py-4 bg-slate-700 hover:bg-slate-600 rounded-xl text-xl font-bold uppercase tracking-widest transition-colors"
                >
                    Return to Surface
                </button>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;