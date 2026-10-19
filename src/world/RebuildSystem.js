import { DISTRICTS_CONFIG } from '../config/districts.js';
import { CELL_TYPES } from './CityGrid.js';

/**
 * RebuildSystem.js - Tahap 5A
 * Autonomous city reconstruction engine that prevents the persistent metropolis
 * from running out of buildings.
 * Features:
 * - Chunk-partitioned recovery queues with strict distance and combat cooldown guards
 * - Two-stage visual reconstruction: Scaffolding / Skeletal frame -> Complete restored building
 * - Budgeted time-sliced execution (< 0.1ms per frame) to prevent any frame drops
 * - Safety spatial checks: Never builds on cells occupied by Kaiju or active enemies
 * - Syncs NavGrid walkability, District destruction counters, and SaveSystem dirty flags
 * - Fast-forward debug toggle ([T] key) reducing cooldown from 360s to 10s
 */
export class RebuildSystem {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    this.chunkSize = scene.chunkRenderer ? scene.chunkRenderer.chunkSize : 256;

    // Map of chunk key "cx_cy" => ChunkRebuildRecord
    this.chunkRecords = new Map();

    this.isFastDebugMode = false;
    this.tickTimer = 0;
    this.activeRebuildingCount = 0;
  }

  /**
   * Gets or initializes the rebuild record for a given chunk
   */
  getChunkRecord(cx, cy) {
    const key = `${cx}_${cy}`;
    let record = this.chunkRecords.get(key);
    if (!record) {
      record = {
        key,
        cx,
        cy,
        centerX: cx * this.chunkSize + this.chunkSize / 2,
        centerY: cy * this.chunkSize + this.chunkSize / 2,
        destroyedCells: [], // Array of { col, row, idx, worldX, worldY, bId, maxHp, baseColor, stage: 0 }
        lastDamageTime: 0
      };
      this.chunkRecords.set(key, record);
    }
    return record;
  }

  /**
   * Records a destroyed cell into its corresponding chunk's rebuild queue
   * @param {number} worldX 
   * @param {number} worldY 
   * @param {Object} cell 
   * @param {Object|null} building 
   */
  recordDestroyedCell(worldX, worldY, cell, building) {
    const cx = Math.floor(worldX / this.chunkSize);
    const cy = Math.floor(worldY / this.chunkSize);
    const record = this.getChunkRecord(cx, cy);

    const now = Date.now();
    record.lastDamageTime = now;

    // Check if cell already queued
    const alreadyQueued = record.destroyedCells.some(c => c.idx === cell.idx);
    if (!alreadyQueued) {
      record.destroyedCells.push({
        col: cell.col,
        row: cell.row,
        idx: cell.idx,
        worldX,
        worldY,
        bId: building ? building.id : 0,
        maxHp: (building && building.cellHp) || 2,
        baseColor: building ? building.baseColor : '#4a4453',
        stage: 0 // 0 = rubble, 1 = scaffolding, 2 = restored
      });
    }
  }

  /**
   * Toggles accelerated debug rebuild delay (10s instead of 360s) via [T] key
   * @returns {boolean} current mode
   */
  toggleFastDebugMode() {
    this.isFastDebugMode = !this.isFastDebugMode;
    return this.isFastDebugMode;
  }

  /**
   * Main per-frame rebuild update loop
   * @param {number} dt - delta time in seconds
   * @param {Object} kaiju 
   * @param {Object} enemyManager 
   */
  update(dt, kaiju, enemyManager) {
    if (!DISTRICTS_CONFIG.rebuild.enabled) return;

    this.tickTimer += dt * 1000;
    const interval = DISTRICTS_CONFIG.rebuild.rebuildIntervalMs || 250;
    if (this.tickTimer < interval) return;
    this.tickTimer = 0;

    const now = Date.now();
    const delaySecs = this.isFastDebugMode
      ? DISTRICTS_CONFIG.rebuild.fastDelaySeconds
      : DISTRICTS_CONFIG.rebuild.delaySeconds;
    const delayMs = delaySecs * 1000;

    const safeDistance = DISTRICTS_CONFIG.rebuild.safeDistance || 1400;
    const kx = kaiju.x;
    const ky = kaiju.y;
    const kaijuSafeRadius = 48 * kaiju.currentScale;

    const grid = this.scene.cityGrid;
    const nav = this.scene.navGrid;
    const districts = this.scene.districts;
    const chunkRenderer = this.scene.chunkRenderer;
    const budget = DISTRICTS_CONFIG.rebuild.cellsPerFrameBudget || 3;

    let cellsProcessed = 0;

    for (const record of this.chunkRecords.values()) {
      if (record.destroyedCells.length === 0) continue;
      if (cellsProcessed >= budget) break;

      // 1. Guard: Cooldown after last damage
      if (now - record.lastDamageTime < delayMs) continue;

      // 2. Guard: Distance from Kaiju
      const distToKaiju = Math.hypot(record.centerX - kx, record.centerY - ky);
      if (distToKaiju < safeDistance) continue;

      // 3. Process a small batch of destroyed cells
      for (let i = 0; i < record.destroyedCells.length && cellsProcessed < budget; i++) {
        const item = record.destroyedCells[i];

        // Guard: Cell must not be occupied by Kaiju
        if (Math.hypot(item.worldX - kx, item.worldY - ky) < kaijuSafeRadius) {
          continue;
        }

        // Guard: Cell must not be occupied by nearby active ground enemies
        if (enemyManager && enemyManager.hasActiveGroundEnemyNear && enemyManager.hasActiveGroundEnemyNear(item.worldX, item.worldY, 20)) {
          continue;
        }

        cellsProcessed++;

        if (item.stage === 0) {
          // Stage 0 -> 1: Construct Scaffolding (Amber steel frame)
          item.stage = 1;
          grid.hp[item.idx] = Math.max(1, Math.floor(item.maxHp / 2));
          if (chunkRenderer && chunkRenderer.markCellAsScaffolding) {
            chunkRenderer.markCellAsScaffolding(item.worldX, item.worldY);
          }
        } else if (item.stage === 1) {
          // Stage 1 -> 2: Complete Building Restoration
          item.stage = 2;
          grid.types[item.idx] = CELL_TYPES.BUILDING;
          grid.hp[item.idx] = item.maxHp;
          grid.totalDestroyedCells = Math.max(0, grid.totalDestroyedCells - 1);

          const bldg = grid.buildings.get(item.bId);
          if (bldg) {
            bldg.aliveCells = Math.min(bldg.totalCells, bldg.aliveCells + 1);
            if (bldg.aliveCells > 0) {
              bldg.isFullyDestroyed = false;
            }
          }

          if (chunkRenderer && chunkRenderer.markCellAsRestored) {
            chunkRenderer.markCellAsRestored(item.worldX, item.worldY, item.baseColor);
          }

          // Dynamic NavGrid update: cell is no longer walkable rubble!
          if (nav) {
            nav.markDirtyCell(item.worldX, item.worldY);
          }

          // Districts counter update
          if (districts) {
            districts.onCellRebuilt(item.worldX, item.worldY, bldg ? bldg.districtId : null);
          }

          // Notify SaveSystem
          if (this.scene.saveSystem) {
            this.scene.saveSystem.markDirty();
          }

          // Remove from destroyed list
          record.destroyedCells.splice(i, 1);
          i--;
        }
      }
    }
  }

  /**
   * Resets all rebuild queues cleanly (used on hard restart)
   */
  reset() {
    this.chunkRecords.clear();
    this.isFastDebugMode = false;
    this.tickTimer = 0;
  }
}
