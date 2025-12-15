import Phaser from 'phaser';
import { AssetGenerator } from '../utils/AssetGenerator';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // Generate procedural assets
    AssetGenerator.generate(this);
  }

  create() {
    (this as any).scene.start('MainScene');
  }
}