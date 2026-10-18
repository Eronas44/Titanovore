import Phaser from 'phaser';
import { TextureGenerator } from '../utils/textureGenerator.js';

/**
 * BootScene
 * Generates all programmatic pixel-art textures and launches GameScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  create() {
    // Generate all game textures in-memory
    TextureGenerator.generateAll(this);

    // Launch main gameplay scene
    this.scene.start('GameScene');
  }
}
