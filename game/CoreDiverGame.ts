import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainScene } from './scenes/MainScene';
import { GAME_CONFIG, COLORS } from '../constants';

export const createGame = (parent: string) => {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    parent: parent,
    width: GAME_CONFIG.width,
    height: GAME_CONFIG.height,
    backgroundColor: COLORS.background,
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: GAME_CONFIG.gravity },
        debug: false
      }
    },
    render: {
      pixelArt: false
    },
    // Explicitly enable lights for the Light2D pipeline
    // This fixes issues where tiles might render black/invisible on some systems
    lights: {
      active: true
    },
    scene: [BootScene, MainScene],
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH
    }
  };

  return new Phaser.Game(config);
};