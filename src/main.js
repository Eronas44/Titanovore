import Phaser from 'phaser';
import { GAME_CONFIG } from './config/game.js';
import { BootScene } from './scenes/BootScene.js';
import { GameScene } from './scenes/GameScene.js';

/**
 * Phaser 3 Game Configuration for Titanovore
 */
const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  pixelArt: GAME_CONFIG.pixelArt,
  roundPixels: GAME_CONFIG.roundPixels,
  backgroundColor: GAME_CONFIG.backgroundColor,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  },
  physics: {
    default: false // Custom lightweight physics for maximum performance with hundreds of entities
  },
  scene: [BootScene, GameScene]
};

// Start Titanovore
const game = new Phaser.Game(config);

// Expose game instance for console inspection if needed
window.__TITANOVORE__ = game;
