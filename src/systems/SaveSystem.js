import { DISTRICTS_CONFIG } from '../config/districts.js';
import { WORLD_CONFIG } from '../config/world.js';
import { CELL_TYPES } from '../world/CityGrid.js';

/**
 * SaveSystem.js - Tahap 5A
 * Robust, asynchronous IndexedDB persistence engine for Titanovore WorldState.
 * Features:
 * - Ultra-compact 125 KB binary BitSet representing all 1,000,000 city destruction cells
 * - Non-blocking asynchronous transactions with in-memory fallback for private browsing
 * - Automatic versioning guard (saveVersion check with graceful discard on mismatch)
 * - 20s debounced auto-save, on-death save, visibilitychange & pagehide handlers
 * - Offline city reconstruction calculation (max 50% recovery cap)
 * - Full RunState vs WorldState separation: City damage stays, Kaiju level/weapons reset
 */
export class SaveSystem {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    this.dbName = DISTRICTS_CONFIG.save.dbName || 'TitanovoreWorldDB';
    this.storeName = DISTRICTS_CONFIG.save.storeName || 'worldState';
    this.saveKey = DISTRICTS_CONFIG.save.key || 'activeWorld';
    this.saveVersion = DISTRICTS_CONFIG.save.saveVersion || 1;

    this.isDirty = false;
    this.isSaving = false;
    this.lastSaveTime = 0;
    this.lastSaveTimestamp = 0; // Epoch ms of last successful save
    this.saveTimer = 0;

    // In-memory fallback if IndexedDB is blocked (e.g. private mode)
    this.memoryFallbackState = null;
    this.isIndexedDBAvailable = typeof window !== 'undefined' && 'indexedDB' in window;
    this.dbPromise = null;

    if (this.isIndexedDBAvailable) {
      this.initDB();
    }

    this.setupWindowListeners();
  }

  /**
   * Initializes IndexedDB database and object store
   */
  async initDB() {
    if (!this.isIndexedDBAvailable) return null;
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      try {
        const req = window.indexedDB.open(this.dbName, this.saveVersion);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(this.storeName)) {
            db.createObjectStore(this.storeName);
          }
        };
        req.onsuccess = (e) => {
          resolve(e.target.result);
        };
        req.onerror = (e) => {
          console.warn('[SaveSystem] IndexedDB open error, falling back to in-memory:', e.target.error);
          this.isIndexedDBAvailable = false;
          resolve(null);
        };
      } catch (err) {
        console.warn('[SaveSystem] IndexedDB initialization exception:', err);
        this.isIndexedDBAvailable = false;
        resolve(null);
      }
    });

    return this.dbPromise;
  }

  /**
   * Registers automatic browser event handlers (visibilitychange & pagehide)
   */
  setupWindowListeners() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.isDirty) {
          this.saveNow();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        if (this.isDirty) {
          this.saveNow();
        }
      });
    }
  }

  /**
   * Marks WorldState as dirty (changes exist that need saving)
   */
  markDirty() {
    this.isDirty = true;
  }

  /**
   * Main per-frame update loop for debounced auto-saving
   * @param {number} dt - delta time in seconds
   */
  update(dt) {
    if (!this.isDirty) return;

    this.saveTimer += dt * 1000;
    const interval = DISTRICTS_CONFIG.save.autoSaveIntervalMs || 20000;

    if (this.saveTimer >= interval) {
      this.saveTimer = 0;
      this.saveNow();
    }
  }

  /**
   * Packs CityGrid destroyed cells into an ultra-compact binary BitSet.
   * 1,000,000 cells / 8 = 125,000 bytes (122 KB Uint8Array).
   * Bit = 1: Destroyed (Rubble), Bit = 0: Alive
   * @returns {Uint8Array}
   */
  packDestroyedCellsBitSet() {
    const grid = this.scene.cityGrid;
    if (!grid) return new Uint8Array(0);

    const totalCells = grid.totalCells;
    const byteLength = Math.ceil(totalCells / 8);
    const bitset = new Uint8Array(byteLength);

    for (let i = 0; i < totalCells; i++) {
      if (grid.types[i] === CELL_TYPES.RUBBLE) {
        const byteIdx = i >> 3; // Math.floor(i / 8)
        const bitIdx = i & 7;   // i % 8
        bitset[byteIdx] |= (1 << bitIdx);
      }
    }

    return bitset;
  }

  /**
   * Gathers full WorldState snapshot from current scene
   */
  collectWorldStateSnapshot() {
    const bitset = this.packDestroyedCellsBitSet();

    const districtsSnapshot = {};
    if (this.scene.districts) {
      this.scene.districts.districtMap.forEach((d, id) => {
        districtsSnapshot[id] = {
          destroyedBuildingCells: d.destroyedBuildingCells,
          is80PercentDestroyed: d.is80PercentDestroyed
        };
      });
    }

    const rebuildTimes = {};
    if (this.scene.rebuildSystem && this.scene.rebuildSystem.chunkRecords) {
      for (const [key, record] of this.scene.rebuildSystem.chunkRecords) {
        if (record.destroyedCells && record.destroyedCells.length > 0) {
          rebuildTimes[key] = record.lastDamageTime;
        }
      }
    }

    return {
      saveVersion: this.saveVersion,
      seed: WORLD_CONFIG.seed,
      timestamp: Date.now(),
      destroyedBitSet: bitset,
      districts: districtsSnapshot,
      rebuildTimes,
      stats: {
        totalBuildingsDestroyed: (this.scene.stats && this.scene.stats.buildingsDestroyed) || 0,
        totalHumansKilled: (this.scene.stats && this.scene.stats.humansKilled) || 0,
        totalPoliceKilled: (this.scene.stats && this.scene.stats.policeKilled) || 0,
        totalTanksDestroyed: (this.scene.stats && this.scene.stats.tanksDestroyed) || 0,
        totalSoldiersKilled: (this.scene.stats && this.scene.stats.soldiersKilled) || 0,
        totalHelicoptersDestroyed: (this.scene.stats && this.scene.stats.helicoptersDestroyed) || 0,
        totalDronesDestroyed: (this.scene.stats && this.scene.stats.dronesDestroyed) || 0,
        lifetimeDeaths: (this.scene.lifetimeDeaths || 0)
      }
    };
  }

  /**
   * Immediately saves WorldState to IndexedDB (or in-memory fallback).
   * Non-blocking and throttled.
   */
  async saveNow() {
    const now = Date.now();
    const minGap = DISTRICTS_CONFIG.save.minSaveIntervalMs || 4000;
    if (this.isSaving || (now - this.lastSaveTime < minGap && !document.hidden)) {
      return false;
    }

    this.isSaving = true;
    this.lastSaveTime = now;

    try {
      const state = this.collectWorldStateSnapshot();

      if (this.isIndexedDBAvailable) {
        const db = await this.initDB();
        if (db) {
          await new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.put(state, this.saveKey);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
          });
        } else {
          this.memoryFallbackState = state;
        }
      } else {
        this.memoryFallbackState = state;
      }

      this.isDirty = false;
      this.lastSaveTimestamp = now;
      return true;
    } catch (err) {
      console.warn('[SaveSystem] Save operation failed, maintaining memory state:', err);
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Loads saved WorldState from IndexedDB (or fallback).
   * Validates saveVersion and seed compatibility.
   * @returns {Promise<Object|null>}
   */
  async loadWorldState() {
    try {
      let state = null;

      if (this.isIndexedDBAvailable) {
        const db = await this.initDB();
        if (db) {
          state = await new Promise((resolve) => {
            const tx = db.transaction([this.storeName], 'readonly');
            const store = tx.objectStore(this.storeName);
            const req = store.get(this.saveKey);
            req.onsuccess = (e) => resolve(e.target.result || null);
            req.onerror = () => resolve(null);
          });
        }
      }

      if (!state && this.memoryFallbackState) {
        state = this.memoryFallbackState;
      }

      if (!state) return null;

      // Compatibility & version integrity checks
      if (state.saveVersion !== this.saveVersion || state.seed !== WORLD_CONFIG.seed) {
        console.warn('[SaveSystem] Save version or seed mismatch. Discarding stale save safely.');
        return null;
      }

      this.lastSaveTimestamp = state.timestamp || Date.now();
      return state;
    } catch (err) {
      console.warn('[SaveSystem] Error loading world state:', err);
      return null;
    }
  }

  /**
   * Applies loaded WorldState into scene:
   * - Marks destroyed cells on CityGrid and ChunkRenderer
   * - Restores NavGrid dirty walkability
   * - Restores District counters
   * - Restores RebuildSystem destroyed cell queues and timestamps
   * - Simulates offline rebuilding (up to 50% max)
   * @param {Object} state 
   * @param {Function} [onProgress] - Optional progress callback (0..1)
   */
  async applyWorldState(state, onProgress = null) {
    if (!state || !state.destroyedBitSet) return;

    const grid = this.scene.cityGrid;
    const nav = this.scene.navGrid;
    const districts = this.scene.districts;
    const chunkRenderer = this.scene.chunkRenderer;
    const rebuild = this.scene.rebuildSystem;

    const bitset = state.destroyedBitSet;
    const totalCells = Math.min(grid.totalCells, bitset.length * 8);

    // 1. Calculate Offline Time & Rebuild Rate
    const now = Date.now();
    const elapsedSeconds = Math.max(0, (now - (state.timestamp || now)) / 1000);
    const offlineCfg = DISTRICTS_CONFIG.rebuild.offlineRecovery;
    let offlineRecoveryChance = 0;

    if (offlineCfg && offlineCfg.enabled && elapsedSeconds > 60) {
      const elapsedHours = elapsedSeconds / 3600;
      const targetPct = Math.min(offlineCfg.maxCityRecoveryPct, elapsedHours * offlineCfg.pctRecoveredPerHour);
      offlineRecoveryChance = targetPct;
    }

    let appliedDestroyedCount = 0;
    const sliceSize = 250000;

    // 2. Unpack BitSet and Apply Cell Destruction
    for (let i = 0; i < totalCells; i++) {
      if (i > 0 && i % sliceSize === 0) {
        if (onProgress) onProgress(i / totalCells);
        await new Promise(r => setTimeout(r, 0));
      }

      const byteIdx = i >> 3;
      const bitIdx = i & 7;
      const isDestroyed = (bitset[byteIdx] & (1 << bitIdx)) !== 0;

      if (isDestroyed) {
        // If offline recovery rolls, restore this cell as intact
        if (offlineRecoveryChance > 0 && Math.random() < offlineRecoveryChance) {
          continue;
        }

        const col = i % grid.cols;
        const row = Math.floor(i / grid.cols);

        // Turn cell to rubble
        grid.types[i] = CELL_TYPES.RUBBLE;
        grid.hp[i] = 0;
        grid.totalDestroyedCells++;
        appliedDestroyedCount++;

        const worldPos = grid.gridToWorld(col, row);
        const bId = grid.buildingIds[i];
        const bldg = grid.buildings.get(bId) || null;
        if (bldg) {
          bldg.aliveCells = Math.max(0, bldg.aliveCells - 1);
        }

        const baseCol = bldg ? bldg.baseColor : '#4a4453';
        chunkRenderer.markCellAsRubble(worldPos.x, worldPos.y, baseCol, false);

        if (nav) {
          nav.markDirtyCell(worldPos.x, worldPos.y);
        }

        // Re-queue in RebuildSystem so persistent rubble can eventually rebuild
        if (rebuild) {
          rebuild.recordDestroyedCell(worldPos.x, worldPos.y, { col, row, idx: i }, bldg);
        }
      }
    }

    // 3. Restore RebuildSystem chunk damage timestamps
    if (state.rebuildTimes && rebuild) {
      for (const [key, time] of Object.entries(state.rebuildTimes)) {
        const rec = rebuild.chunkRecords.get(key);
        if (rec) {
          rec.lastDamageTime = time;
        }
      }
    }

    // 4. Restore Districts State
    if (districts && state.districts) {
      districts.loadFromSavedState(state.districts);
    }

    // 5. Restore Lifetime Stats
    if (state.stats && this.scene.stats) {
      this.scene.stats.buildingsDestroyed = state.stats.totalBuildingsDestroyed || 0;
      this.scene.lifetimeDeaths = state.stats.lifetimeDeaths || 0;
    }

    if (onProgress) onProgress(1.0);
  }

  /**
   * Completely clears and deletes saved WorldState (used for "Kota Baru" or Shift+R)
   */
  async clearSave() {
    this.memoryFallbackState = null;
    this.isDirty = false;
    this.lastSaveTimestamp = 0;

    if (this.isIndexedDBAvailable) {
      try {
        const db = await this.initDB();
        if (db) {
          await new Promise((resolve, reject) => {
            const tx = db.transaction([this.storeName], 'readwrite');
            const store = tx.objectStore(this.storeName);
            const req = store.delete(this.saveKey);
            req.onsuccess = () => resolve(true);
            req.onerror = (e) => reject(e.target.error);
          });
        }
      } catch (err) {
        console.warn('[SaveSystem] Error clearing save from IndexedDB:', err);
      }
    }
  }

  /**
   * Formats a human-friendly "Terakhir disimpan" string for the UI
   * @returns {string}
   */
  getLastSavedString() {
    if (!this.lastSaveTimestamp) return 'Belum pernah disimpan';

    const diffSecs = Math.max(0, Math.floor((Date.now() - this.lastSaveTimestamp) / 1000));
    if (diffSecs < 10) return 'Baru saja';
    if (diffSecs < 60) return `${diffSecs} detik lalu`;

    const mins = Math.floor(diffSecs / 60);
    if (mins < 60) return `${mins} menit lalu`;

    const d = new Date(this.lastSaveTimestamp);
    const hh = d.getHours().toString().padStart(2, '0');
    const mm = d.getMinutes().toString().padStart(2, '0');
    return `Pukul ${hh}:${mm}`;
  }
}
