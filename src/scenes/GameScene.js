import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game.js';
import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';
import { CityGrid } from '../world/CityGrid.js';
import { CityGenerator } from '../world/CityGenerator.js';
import { ChunkRenderer } from '../world/ChunkRenderer.js';
import { Kaiju } from '../entities/Kaiju.js';
import { Crowd } from '../entities/Crowd.js';

/**
 * GameScene
 * Main gameplay scene orchestrating the Kaiju, procedural city chunks,
 * camera follow, decorative crowd, and debug HUD.
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // 1. Initialize Spatial Grid (4x4 px cells, typed array storage)
    this.cityGrid = new CityGrid(WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, WORLD_CONFIG.cellSize);

    // 2. Procedural City Generation (Roads, Blocks, Buildings, Parks)
    this.cityGenerator = new CityGenerator(WORLD_CONFIG.seed);
    this.cityData = this.cityGenerator.generate(this.cityGrid);

    // 3. Chunk Renderer (256x256 px chunks, progressive generation, camera culling)
    this.chunkRenderer = new ChunkRenderer(this, this.cityData);

    // 4. Spawn Kaiju in the center of the world (Downtown)
    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju = new Kaiju(this, spawnX, spawnY);

    // 5. Spawn Crowd (400 pedestrians + 40 vehicles)
    this.crowd = new Crowd(this, this.cityData);

    // 6. Camera Setup
    this.setupCamera();

    // 7. Minimal HUD (FPS & active chunk counter, toggleable with F3)
    // NOTE: To remove this HUD completely in production, delete or comment out this.setupHUD() and this.updateHUD().
    this.setupHUD();
  }

  /**
   * Configures camera following, boundaries, and zoom.
   */
  setupCamera() {
    const cam = this.cameras.main;

    // Constrain camera strictly inside 4000x4000 world bounds
    cam.setBounds(0, 0, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);

    // Smooth camera follow target
    cam.startFollow(
      this.kaiju.container,
      false,
      GAME_CONFIG.camera.followLerpX,
      GAME_CONFIG.camera.followLerpY
    );

    // Initial zoom (Kaiju looks large, city feels dense)
    cam.setZoom(GAME_CONFIG.camera.initialZoom);
  }

  /**
   * Smoothly interpolates camera zoom (ready for Kaiju size evolution in future phases).
   * @param {number} targetZoom 
   * @param {number} duration 
   */
  smoothZoomTo(targetZoom, duration = 1000) {
    this.cameras.main.zoomTo(targetZoom, duration, 'Sine.easeInOut');
  }

  /**
   * Spatial query shortcut delegating to CityGrid.
   * Prepared for Phase 2 destruction and hit detection.
   */
  getCellAt(worldX, worldY) {
    return this.cityGrid.getCellAt(worldX, worldY);
  }

  /**
   * Fast rectangle query returning intersecting buildings.
   */
  getBuildingsInRect(rect) {
    return this.cityGrid.getBuildingsInRect(rect);
  }

  /**
   * Minimal HUD (FPS, Active Chunks, Controls reminder)
   */
  setupHUD() {
    this.hudContainer = this.add.container(6, 6);
    this.hudContainer.setScrollFactor(0); // Fixed on screen
    this.hudContainer.setDepth(100);

    // Background panel
    this.hudBg = this.add.graphics();
    this.hudBg.fillStyle(0x0b0a10, 0.75);
    this.hudBg.fillRoundedRect(0, 0, 150, 48, 3);
    this.hudContainer.add(this.hudBg);

    // Stats Text
    this.hudText = this.add.text(6, 5, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: PALETTE.uiTextHex,
      lineSpacing: 2
    });
    this.hudContainer.add(this.hudText);

    this.isHudVisible = GAME_CONFIG.hud.showByDefault;
    this.hudContainer.setVisible(this.isHudVisible);

    // Toggle HUD with F3 key
    this.input.keyboard.on('keydown-F3', (event) => {
      event.preventDefault();
      this.isHudVisible = !this.isHudVisible;
      this.hudContainer.setVisible(this.isHudVisible);
    });
  }

  /**
   * Updates HUD telemetry counters
   */
  updateHUD() {
    if (!this.isHudVisible || !this.hudText) return;

    const fps = Math.round(this.game.loop.actualFps);
    const activeChunks = this.chunkRenderer.activeChunkCount;
    const totalChunks = this.chunkRenderer.totalChunks;
    const hasElectric = this.kaiju.hasLayer('skin_overlay') ? 'ON' : 'OFF';

    this.hudText.setText(
      `FPS: ${fps}\n` +
      `Chunks: ${activeChunks} / ${totalChunks}\n` +
      `Skin [E]: ${hasElectric} | [F3] HUD`
    );
  }

  /**
   * Main game loop
   */
  update(time, delta) {
    // 1. Update Kaiju physics, animations, and layered slots
    this.kaiju.update(time, delta);

    // 2. Update Chunk Renderer (progressive loading & frustum culling)
    this.chunkRenderer.update(this.cameras.main);

    // 3. Update Decorative Crowd (frustum culled)
    this.crowd.update(this.cameras.main, delta);

    // 4. Update HUD
    this.updateHUD();
  }
}
