import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game.js';
import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';
import { CityGrid, CELL_TYPES } from '../world/CityGrid.js';
import { CityGenerator } from '../world/CityGenerator.js';
import { ChunkRenderer } from '../world/ChunkRenderer.js';
import { Kaiju } from '../entities/Kaiju.js';
import { Crowd } from '../entities/Crowd.js';
import { ParticleManager } from '../effects/ParticleManager.js';

/**
 * GameScene - Tahap 2B (Penghancuran Bangunan & Fisika Kerusakan)
 * Orchestrates:
 * - Kaiju body & tail trample damage on 4x4 px grid cells
 * - Building collapse dynamics (progressive wave shattering, falling debris splash, shockwaves)
 * - Particle effects (debris, billowing dust, blood splatters, collapse flashes)
 * - Crowd reactions (panic fleeing, squishing, car crushing)
 * - Dynamic Kaiju trampling resistance/slowdown
 * - Debug keys: [F] Scale Up, [R] Clean World Restart, [1-4] Zone Teleport, [F3] HUD Toggle
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // 1. Scoring & Telemetry Stats
    this.stats = {
      buildingsDestroyed: 0,
      humansKilled: 0,
      carsDestroyed: 0,
      xp: 0
    };

    // 2. Active collapse wave animations queue
    this.activeCollapses = [];
    this.hitstopTimer = 0;
    this.trampleTimer = 0;

    // 3. Initialize Particle Manager (Pre-allocated zero-GC pools)
    this.particleManager = new ParticleManager(this);

    // 4. Initialize Spatial Grid (4x4 px cells, typed array storage)
    this.cityGrid = new CityGrid(WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, WORLD_CONFIG.cellSize);

    // 5. Procedural City Generation (Roads, Blocks, Buildings, Parks, Canal)
    this.cityGenerator = new CityGenerator(WORLD_CONFIG.seed);
    this.cityData = this.cityGenerator.generate(this.cityGrid);

    // 6. Chunk Renderer (256x256 px chunks, dirty rect batch rendering, camera culling)
    this.chunkRenderer = new ChunkRenderer(this, this.cityData);

    // 7. Spawn Kaiju in the center of the world (Downtown)
    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju = new Kaiju(this, spawnX, spawnY);

    // 8. Spawn Crowd (400 pedestrians + 40 vehicles)
    this.crowd = new Crowd(this, this.cityData);

    // 9. Camera Setup
    this.setupCamera();

    // 10. HUD Setup
    this.setupHUD();

    // 11. Debug Hotkeys Setup (F: Grow, R: Reset, 1-4: Teleport, F3: HUD)
    this.setupDebugKeys();
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);
    cam.startFollow(
      this.kaiju.container,
      false,
      GAME_CONFIG.camera.followLerpX,
      GAME_CONFIG.camera.followLerpY
    );
    cam.setZoom(GAME_CONFIG.camera.initialZoom);
  }

  /**
   * Sets up debug hotkeys:
   * [F]: Increment Kaiju scale (+0.3 up to 3.0x)
   * [R]: Clean world restart
   * [1-4]: Teleport to districts
   * [F3]: Toggle HUD
   */
  setupDebugKeys() {
    // 1. [F] Key: Increment Kaiju scale
    this.input.keyboard.on('keydown-F', () => {
      let nextScale = this.kaiju.currentScale + 0.3;
      if (nextScale > 3.0) nextScale = 1.0; // Loop back
      this.kaiju.setKaijuScale(nextScale);
      // Adjust camera zoom smoothly to keep good visibility
      const targetZoom = Math.max(1.0, GAME_CONFIG.camera.initialZoom - (nextScale - 1.0) * 0.25);
      this.cameras.main.zoomTo(targetZoom, 400);
    });

    // 2. [R] Key: Clean World Restart (Destroys old textures, resets pools)
    this.input.keyboard.on('keydown-R', () => {
      this.restartCity();
    });

    // 3. [1-4] Keys: Zone Teleport
    this.currentZoneName = 'Downtown';
    const zones = [
      { key: 'ONE', name: 'Downtown', x: 2000, y: 2000 },
      { key: 'TWO', name: 'Residential', x: 1000, y: 1000 },
      { key: 'THREE', name: 'Industrial', x: 2700, y: 2700 },
      { key: 'FOUR', name: 'Park & Canal', x: 1610, y: 1980 }
    ];

    zones.forEach(z => {
      this.input.keyboard.on(`keydown-${z.key}`, () => {
        this.kaiju.x = z.x;
        this.kaiju.y = z.y;
        this.kaiju.vx = 0;
        this.kaiju.vy = 0;
        this.kaiju.container.setPosition(z.x, z.y);
        this.currentZoneName = z.name;
        this.chunkRenderer.update(this.cameras.main);
      });
    });

    // 4. [F3] Key: Toggle HUD
    this.input.keyboard.on('keydown-F3', (event) => {
      event.preventDefault();
      this.isHudVisible = !this.isHudVisible;
      this.hudContainer.setVisible(this.isHudVisible);
    });
  }

  /**
   * Performs a clean restart of the city without memory leaks or dangling listeners
   */
  restartCity() {
    // 1. Reset particle pools
    this.particleManager.reset();

    // 2. Clear active collapse animations
    this.activeCollapses = [];
    this.hitstopTimer = 0;

    // 3. Destroy old chunk textures & images
    this.chunkRenderer.destroy();

    // 4. Reset CityGrid
    this.cityGrid = new CityGrid(WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, WORLD_CONFIG.cellSize);

    // 5. Re-generate procedural city
    this.cityData = this.cityGenerator.generate(this.cityGrid);

    // 6. Re-create ChunkRenderer
    this.chunkRenderer = new ChunkRenderer(this, this.cityData);

    // 7. Reset Crowd
    this.crowd.reset();

    // 8. Reset Kaiju position and stats
    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju.resetPosition(spawnX, spawnY);
    this.kaiju.setKaijuScale(1.0);
    this.cameras.main.setZoom(GAME_CONFIG.camera.initialZoom);

    // 9. Reset stats
    this.stats = {
      buildingsDestroyed: 0,
      humansKilled: 0,
      carsDestroyed: 0,
      xp: 0
    };

    // Immediate view refresh
    this.chunkRenderer.update(this.cameras.main);
  }

  /**
   * Minimal HUD (Pixel font, destruction %, building/human kills, XP counter)
   */
  setupHUD() {
    this.hudContainer = this.add.container(6, 6);
    this.hudContainer.setScrollFactor(0);
    this.hudContainer.setDepth(100);

    // Crisp dark panel
    this.hudBg = this.add.graphics();
    this.hudBg.fillStyle(0x0b0a10, 0.85);
    this.hudBg.fillRoundedRect(0, 0, 168, 56, 3);
    this.hudContainer.add(this.hudBg);

    // Telemetry text
    this.hudText = this.add.text(6, 5, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: PALETTE.uiTextHex,
      lineSpacing: 2
    });
    this.hudContainer.add(this.hudText);

    this.isHudVisible = GAME_CONFIG.hud.showByDefault;
    this.hudContainer.setVisible(this.isHudVisible);
  }

  updateHUD() {
    if (!this.isHudVisible || !this.hudText) return;

    const fps = Math.round(this.game.loop.actualFps);
    const destructionPct = this.cityGrid.getDestructionPercentage().toFixed(1);
    const scale = this.kaiju.currentScale.toFixed(1);

    this.hudText.setText(
      `DESTRUCTION: ${destructionPct}% | XP: ${this.stats.xp}\n` +
      `BUILDINGS: ${this.stats.buildingsDestroyed} | KILLS: ${this.stats.humansKilled}\n` +
      `SCALE: ${scale}x | FPS: ${fps} [F3] HUD\n` +
      `[F] Grow | [R] Reset | [1-4] Zones`
    );
  }

  /**
   * Main game update loop
   */
  update(time, delta) {
    const dt = delta / 1000;

    // 1. Hitstop handling (brief pause frame on skyscraper collapses)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= delta;
      return; // Freeze update for hitstop duration
    }

    // 2. Update Kaiju physics & animation
    this.kaiju.update(time, delta);

    // 3. Process Trample Damage Pulses on 4x4 px grid
    this.trampleTimer += delta;
    if (this.trampleTimer >= GAME_CONFIG.destruction.trampleTickInterval) {
      this.trampleTimer = 0;
      this.handleKaijuTrampleDamage();
    }

    // 4. Process Progressive Building Collapse Waves
    this.updateCollapseWaves(dt);

    // 5. Update Crowd & Panic Fleeing
    this.crowd.update(this.cameras.main, delta, this.kaiju);

    // 6. Update Particle Manager
    this.particleManager.update(dt);

    // 7. Update Chunk Renderer (progressive loading & dirty rect batches)
    this.chunkRenderer.update(this.cameras.main);

    // 8. Update HUD Telemetry
    this.updateHUD();
  }

  /**
   * Evaluates Kaiju body footprint and sweeping tail segments against building cells.
   */
  handleKaijuTrampleDamage() {
    // Only apply trample damage when Kaiju is moving / walking through buildings
    if (!this.kaiju.isMoving && this.kaiju.currentSpeed < 4) return;

    const { bodyDamageBase, bodySpeedMultiplier, tailDamageMultiplier } = GAME_CONFIG.destruction;
    const bodyFoot = this.kaiju.getBodyFootprint();
    const tailFoots = this.kaiju.getTailFootprints();

    // Damage scales with speed and current Kaiju scale
    const baseDamage = (bodyDamageBase + this.kaiju.currentSpeed * bodySpeedMultiplier) * this.kaiju.currentScale;

    // 1. Process Body Footprint (Oriented Ellipse)
    const bodyCells = this.cityGrid.getCellsInEllipse(
      bodyFoot.cx,
      bodyFoot.cy,
      bodyFoot.rx,
      bodyFoot.ry,
      bodyFoot.angle
    );

    let crushedDenseCells = 0;

    for (let i = 0; i < bodyCells.length; i++) {
      const cell = bodyCells[i];
      const res = this.cityGrid.damageCell(cell.col, cell.row, baseDamage);

      if (res && res.damaged) {
        if (res.destroyed) {
          crushedDenseCells++;
          this.stats.xp += GAME_CONFIG.destruction.xpPerCell;

          // Replace cell on chunk canvas with textured dark rubble
          this.chunkRenderer.markCellAsRubble(cell.worldX, cell.worldY, res.building.baseColor, true);

          // Emit debris particles matching building color
          this.particleManager.emitDebris(cell.worldX, cell.worldY, res.building.baseColor, 2, 50);

          // Check Building Collapse
          this.checkBuildingCollapse(res.building, cell);
        }
      }
    }

    // 2. Apply dynamic slowdown when crushing dense buildings
    if (crushedDenseCells > 0) {
      this.kaiju.applyResistance(crushedDenseCells * 0.025);
      // Subtle continuous trample shake
      this.cameras.main.shake(
        GAME_CONFIG.destruction.trampleShakeDuration,
        GAME_CONFIG.destruction.trampleShakeIntensity
      );
    }

    // 3. Process Sweeping Tail Segments
    for (let t = 0; t < tailFoots.length; t++) {
      const seg = tailFoots[t];
      const tailDamage = baseDamage * tailDamageMultiplier * (1.0 - t * 0.1);
      const tailCells = this.cityGrid.getCellsInCircle(seg.cx, seg.cy, seg.radius);

      for (let i = 0; i < tailCells.length; i++) {
        const cell = tailCells[i];
        const res = this.cityGrid.damageCell(cell.col, cell.row, tailDamage);

        if (res && res.destroyed) {
          this.stats.xp += GAME_CONFIG.destruction.xpPerCell;
          this.chunkRenderer.markCellAsRubble(cell.worldX, cell.worldY, res.building.baseColor, false);
          this.particleManager.emitDebris(cell.worldX, cell.worldY, res.building.baseColor, 2, 40);
          this.checkBuildingCollapse(res.building, cell);
        }
      }
    }

    // 4. Process Crowd Trampling (Humans squished, cars crushed)
    this.crowd.checkKaijuTrample(
      bodyFoot,
      tailFoots,
      this.particleManager,
      () => {
        this.stats.humansKilled++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerHuman;
      },
      () => {
        this.stats.carsDestroyed++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerCar;
      }
    );
  }

  /**
   * Checks if a building's integrity has been breached (> 45% destroyed or center destroyed)
   */
  checkBuildingCollapse(building, hitCell) {
    if (!building || building.isCollapsed) return;

    const threshold = WORLD_CONFIG.collapseThreshold || 0.45;
    const ratioDestroyed = (building.totalCells - building.aliveCells) / building.totalCells;

    const isCenterHit = building.centerCell &&
      hitCell.col === building.centerCell.col &&
      hitCell.row === building.centerCell.row;

    if (ratioDestroyed >= threshold || isCenterHit) {
      this.triggerBuildingCollapse(building, hitCell);
    }
  }

  /**
   * Initiates the building collapse sequence (wave crumbling, shockwaves, falling debris splash)
   */
  triggerBuildingCollapse(building, epicenterCell) {
    building.isCollapsed = true;
    this.stats.buildingsDestroyed++;
    this.stats.xp += GAME_CONFIG.destruction.xpPerBuildingCollapse;

    const heightLevel = building.heightLevel || 3;
    const bCenterX = building.x + building.width / 2;
    const bCenterY = building.y + building.height / 2;

    // 1. Screen Shake proportional to building height
    const shakeMult = Math.min(2.5, heightLevel / 3.5);
    this.cameras.main.shake(
      GAME_CONFIG.destruction.collapseShakeDuration,
      GAME_CONFIG.destruction.collapseShakeIntensityBase * shakeMult
    );

    // 2. Skyscraper effects (Hitstop, fire flash, road cracks)
    if (heightLevel >= 8) {
      // Brief hitstop freeze frame
      this.hitstopTimer = GAME_CONFIG.destruction.hitstopDurationMs;

      // Additive light burst / orange flash
      this.particleManager.emitCollapseFlash(bCenterX, bCenterY, heightLevel * 3.5);

      // Fracture cracks on surrounding roads
      this.chunkRenderer.drawRoadCracks(bCenterX, bCenterY, building.width * 0.65);

      // Shockwave damage to nearby smaller buildings
      const shockwaveRadius = heightLevel * 3.2;
      const nearbyBuildings = this.cityGrid.getBuildingsInRect({
        x: bCenterX - shockwaveRadius,
        y: bCenterY - shockwaveRadius,
        width: shockwaveRadius * 2,
        height: shockwaveRadius * 2
      });

      nearbyBuildings.forEach(nb => {
        if (nb.id !== building.id && !nb.isCollapsed && nb.heightLevel < heightLevel) {
          // Damage perimeter cells
          const sampleCells = nb.cells.slice(0, Math.min(6, nb.cells.length));
          sampleCells.forEach(sc => {
            const res = this.cityGrid.damageCell(sc.col, sc.row, 1.5);
            if (res && res.destroyed) {
              this.chunkRenderer.markCellAsRubble(sc.col * 4, sc.row * 4, nb.baseColor, true);
            }
          });
        }
      });
    }

    // 3. Falling Debris Outward Splash (Crushes cars & humans within radius)
    const splashRadius = heightLevel * (WORLD_CONFIG.debrisSpreadRadiusFactor || 1.3) * 2;
    this.crowd.destroyEntitiesInRadius(
      bCenterX,
      bCenterY,
      splashRadius,
      this.particleManager,
      () => {
        this.stats.humansKilled++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerHuman;
      },
      () => {
        this.stats.carsDestroyed++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerCar;
      }
    );

    // 4. Create Progressive Outward Wave Crumble Rings (~0.5s animation)
    const epiX = epicenterCell ? epicenterCell.col * 4 : bCenterX;
    const epiY = epicenterCell ? epicenterCell.row * 4 : bCenterY;

    // Group remaining living cells by distance to epicenter into wave rings
    const remainingCells = building.cells.filter(c => this.cityGrid.hp[c.idx] > 0);
    const wavesMap = new Map(); // ringIndex -> [cells]

    remainingCells.forEach(c => {
      const cellWorld = this.cityGrid.gridToWorld(c.col, c.row);
      const dist = Math.hypot(cellWorld.x - epiX, cellWorld.y - epiY);
      const ring = Math.floor(dist / 8); // 8px per wave ring

      if (!wavesMap.has(ring)) wavesMap.set(ring, []);
      wavesMap.get(ring).push({ ...c, worldX: cellWorld.x, worldY: cellWorld.y });
    });

    const sortedRings = Array.from(wavesMap.keys()).sort((a, b) => a - b);
    const waveDelayStep = 0.08; // Seconds per ring step

    sortedRings.forEach((ring, idx) => {
      this.activeCollapses.push({
        timer: idx * waveDelayStep,
        cells: wavesMap.get(ring),
        building,
        heightLevel
      });
    });
  }

  /**
   * Updates progressive collapse wave timers and triggers cell shattering
   */
  updateCollapseWaves(dt) {
    for (let i = this.activeCollapses.length - 1; i >= 0; i--) {
      const item = this.activeCollapses[i];
      item.timer -= dt;

      if (item.timer <= 0) {
        // Shatter cells in this wave ring!
        item.cells.forEach(c => {
          this.cityGrid.hp[c.idx] = 0;
          this.cityGrid.types[c.idx] = CELL_TYPES.RUBBLE;
          this.cityGrid.totalDestroyedCells++;

          this.chunkRenderer.markCellAsRubble(c.worldX, c.worldY, item.building.baseColor, true);

          // Billowing dust clouds & debris proportional to building height
          this.particleManager.emitDebris(c.worldX, c.worldY, item.building.baseColor, 3, 60);
          this.particleManager.emitDust(c.worldX, c.worldY, 2, Math.min(2.2, item.heightLevel * 0.25));
        });

        this.activeCollapses.splice(i, 1);
      }
    }
  }
}
