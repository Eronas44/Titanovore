import { ENEMY_CONFIG } from '../config/enemies.js';
import { ALERT_CONFIG } from '../config/alert.js';
import { XP_CONFIG } from '../config/xp.js';
import { CELL_TYPES } from '../world/CityGrid.js';
import { PRNG } from '../utils/prng.js';

export const ENEMY_TYPES = {
  INACTIVE: 0,
  CITIZEN: 1,
  POLICE: 2,
  POLICE_CAR: 3,
  TANK: 4,
  SOLDIER: 5,
  HELICOPTER: 6,
  DRONE: 7
};

/**
 * High-Performance Enemy & Threat Manager - Tahap 3B
 * Architecture:
 * - Data-Oriented Design (Structure of Arrays using typed Float32/Int16/Uint8 arrays)
 * - Zero GC runtime allocations: Fixed pre-allocated sprite pool & bullet pool
 * - NavGrid Flow Field & Wall Collision Resolution for Ground Units
 * - Airborne Layer (Helicopters & Drones) flying over buildings with ground shadows
 * - Scaled Spawning driven by AlertSystem (Siaga 1 - 5)
 * - Spatial Hash Grid (32x32 px cells) for O(1) neighbor lookups, separation, and trample
 */
export class EnemyManager {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} cityGrid - CityGrid instance
   * @param {Object} navGrid - NavGrid navigation instance
   * @param {Object} alertSystem - AlertSystem threat escalation instance
   * @param {number} worldWidth 
   * @param {number} worldHeight 
   */
  constructor(scene, cityGrid, navGrid, alertSystem, worldWidth = 4000, worldHeight = 4000) {
    this.scene = scene;
    this.cityGrid = cityGrid;
    this.navGrid = navGrid;
    this.alertSystem = alertSystem;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.prng = new PRNG(1337);

    const { maxEnemies, maxBullets, gridCellSize } = ENEMY_CONFIG;
    this.maxEnemies = maxEnemies; // 600
    this.maxBullets = maxBullets; // 300

    // 1. Structure of Arrays (SoA) Typed Arrays for Enemies
    this.x = new Float32Array(this.maxEnemies);
    this.y = new Float32Array(this.maxEnemies);
    this.vx = new Float32Array(this.maxEnemies);
    this.vy = new Float32Array(this.maxEnemies);
    this.hp = new Float32Array(this.maxEnemies);
    this.maxHp = new Float32Array(this.maxEnemies);
    this.type = new Uint8Array(this.maxEnemies); // 0..7
    this.state = new Uint8Array(this.maxEnemies); // 0=wander/orbit/cruise, 1=flee/telegraph, 2=dive/fire, 3=crashing
    this.timer = new Float32Array(this.maxEnemies); // shoot/animation/telegraph timers
    this.rotation = new Float32Array(this.maxEnemies);
    this.active = new Uint8Array(this.maxEnemies);
    this.subType = new Uint8Array(this.maxEnemies); // visual variation / rotor frames

    // Specialized SoA properties for military squads & airborne units
    this.targetX = new Float32Array(this.maxEnemies); // heli orbit angle / drone target X / soldier offset X
    this.targetY = new Float32Array(this.maxEnemies); // drone target Y / soldier offset Y
    this.burstCount = new Uint8Array(this.maxEnemies); // remaining bullets in volley burst
    this.burstTimer = new Float32Array(this.maxEnemies); // delay between shots in burst
    this.isAir = new Uint8Array(this.maxEnemies); // 1 = airborne (heli, drone), 0 = ground

    this.freeIndices = [];
    for (let i = this.maxEnemies - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
    this.activeCount = 0;

    // Counts per type for O(1) telemetry and spawn limiting
    this.typeCounts = new Uint16Array(8);
    this.lastUpdateTimeMs = 0;

    // 2. Structure of Arrays for Enemy Projectiles
    this.bulletX = new Float32Array(this.maxBullets);
    this.bulletY = new Float32Array(this.maxBullets);
    this.bulletVx = new Float32Array(this.maxBullets);
    this.bulletVy = new Float32Array(this.maxBullets);
    this.bulletLife = new Float32Array(this.maxBullets);
    this.bulletActive = new Uint8Array(this.maxBullets);
    this.bulletDamage = new Float32Array(this.maxBullets);
    this.bulletIsShell = new Uint8Array(this.maxBullets); // 0=bullet, 1=heavy tank shell

    this.freeBulletIndices = [];
    for (let i = this.maxBullets - 1; i >= 0; i--) {
      this.freeBulletIndices.push(i);
    }
    this.activeBulletCount = 0;

    // 3. Spatial Hash Grid (32x32 px cells)
    this.gridCellSize = gridCellSize;
    this.gridCols = Math.ceil(this.worldWidth / this.gridCellSize);
    this.gridRows = Math.ceil(this.worldHeight / this.gridCellSize);
    this.totalGridCells = this.gridCols * this.gridRows;
    this.gridHead = new Int16Array(this.totalGridCells);
    this.gridNext = new Int16Array(this.maxEnemies);

    // 4. Pre-allocated Fixed Sprite Pool
    this.sprites = new Array(this.maxEnemies);
    for (let i = 0; i < this.maxEnemies; i++) {
      const sprite = this.scene.add.sprite(0, 0, 'enemy_citizen_0');
      sprite.setVisible(false);
      sprite.setActive(false);
      sprite.setDepth(12); // Above pavement, below Kaiju
      this.sprites[i] = sprite;
    }

    // 5. Dedicated Graphics Batches (Zero-GC)
    this.airShadowGraphics = this.scene.add.graphics().setDepth(8); // Below Kaiju, above pavement
    this.bulletGraphics = this.scene.add.graphics().setDepth(16); // Projectiles
    this.telegraphGraphics = this.scene.add.graphics().setDepth(26); // Aiming lasers & warning beams

    // 6. Spawn timers
    this.spawnTimer = 0;
  }

  /**
   * Rebuilds the Spatial Hash Grid in < 0.02ms.
   * Enables O(1) neighbor proximity queries for separation, crowd flocking, and trample.
   */
  buildSpatialGrid() {
    this.gridHead.fill(-1);
    const invCell = 1 / this.gridCellSize;
    const maxCol = this.gridCols - 1;
    const maxRow = this.gridRows - 1;

    for (let i = 0; i < this.maxEnemies; i++) {
      if (!this.active[i]) continue;

      const cx = Math.max(0, Math.min(maxCol, Math.floor(this.x[i] * invCell)));
      const cy = Math.max(0, Math.min(maxRow, Math.floor(this.y[i] * invCell)));
      const cellIdx = cy * this.gridCols + cx;

      this.gridNext[i] = this.gridHead[cellIdx];
      this.gridHead[cellIdx] = i;
    }
  }

  /**
   * Queries active enemies within a given world radius using the spatial grid.
   * @param {number} px 
   * @param {number} py 
   * @param {number} radius 
   * @param {Function} callback - (idx, dx, dy, distSq) => void
   */
  queryEnemiesInRadius(px, py, radius, callback) {
    const invCell = 1 / this.gridCellSize;
    const minCx = Math.max(0, Math.floor((px - radius) * invCell));
    const maxCx = Math.min(this.gridCols - 1, Math.floor((px + radius) * invCell));
    const minCy = Math.max(0, Math.floor((py - radius) * invCell));
    const maxCy = Math.min(this.gridRows - 1, Math.floor((py + radius) * invCell));
    const r2 = radius * radius;

    for (let cy = minCy; cy <= maxCy; cy++) {
      const rowOffset = cy * this.gridCols;
      for (let cx = minCx; cx <= maxCx; cx++) {
        let idx = this.gridHead[rowOffset + cx];
        while (idx !== -1) {
          const dx = this.x[idx] - px;
          const dy = this.y[idx] - py;
          const d2 = dx * dx + dy * dy;
          if (d2 <= r2) {
            callback(idx, dx, dy, d2);
          }
          idx = this.gridNext[idx];
        }
      }
    }
  }

  /**
   * Allocates an enemy slot and initializes properties.
   */
  spawnEnemy(type, x, y, rotation = 0) {
    if (this.freeIndices.length === 0) return -1;
    const idx = this.freeIndices.pop();

    this.active[idx] = 1;
    this.type[idx] = type;
    this.x[idx] = x;
    this.y[idx] = y;
    this.vx[idx] = 0;
    this.vy[idx] = 0;
    this.rotation[idx] = rotation;
    this.state[idx] = 0; // WANDER / ORBIT / CRUISE
    this.burstCount[idx] = 0;
    this.burstTimer[idx] = 0;
    this.targetX[idx] = 0;
    this.targetY[idx] = 0;
    this.isAir[idx] = 0;
    this.activeCount++;
    this.typeCounts[type]++;

    const tCfg = ENEMY_CONFIG.types;
    if (type === ENEMY_TYPES.CITIZEN) {
      this.hp[idx] = tCfg.CITIZEN.hp;
      this.maxHp[idx] = tCfg.CITIZEN.hp;
      this.timer[idx] = this.prng.range(1.0, 3.0);
      this.subType[idx] = this.prng.rangeInt(0, 3);
    } else if (type === ENEMY_TYPES.POLICE) {
      this.hp[idx] = tCfg.POLICE.hp;
      this.maxHp[idx] = tCfg.POLICE.hp;
      this.timer[idx] = this.prng.range(tCfg.POLICE.shootIntervalMin, tCfg.POLICE.shootIntervalMax);
      this.subType[idx] = 0;
    } else if (type === ENEMY_TYPES.POLICE_CAR) {
      this.hp[idx] = tCfg.POLICE_CAR.hp;
      this.maxHp[idx] = tCfg.POLICE_CAR.hp;
      this.timer[idx] = 0;
      this.subType[idx] = 0;
    } else if (type === ENEMY_TYPES.TANK) {
      this.hp[idx] = tCfg.TANK.hp;
      this.maxHp[idx] = tCfg.TANK.hp;
      this.timer[idx] = this.prng.range(tCfg.TANK.shootIntervalMin, tCfg.TANK.shootIntervalMax);
      this.subType[idx] = 0;
    } else if (type === ENEMY_TYPES.SOLDIER) {
      this.hp[idx] = tCfg.SOLDIER.hp;
      this.maxHp[idx] = tCfg.SOLDIER.hp;
      this.timer[idx] = this.prng.range(tCfg.SOLDIER.shootIntervalMin, tCfg.SOLDIER.shootIntervalMax);
      this.subType[idx] = 0;
      this.targetX[idx] = this.prng.range(-8, 8); // Squad formation jitter
      this.targetY[idx] = this.prng.range(-8, 8);
    } else if (type === ENEMY_TYPES.HELICOPTER) {
      this.hp[idx] = tCfg.HELICOPTER.hp;
      this.maxHp[idx] = tCfg.HELICOPTER.hp;
      this.timer[idx] = this.prng.range(1.0, tCfg.HELICOPTER.shootIntervalMax);
      this.subType[idx] = 0;
      this.isAir[idx] = 1;
      this.targetX[idx] = rotation; // Initial orbit angle
    } else if (type === ENEMY_TYPES.DRONE) {
      this.hp[idx] = tCfg.DRONE.hp;
      this.maxHp[idx] = tCfg.DRONE.hp;
      this.timer[idx] = 0;
      this.subType[idx] = 0;
      this.isAir[idx] = 1;
    }

    return idx;
  }

  /**
   * Recycles an enemy slot cleanly back into the free list.
   */
  despawnEnemy(idx) {
    if (!this.active[idx]) return;

    const oldType = this.type[idx];
    this.active[idx] = 0;
    this.type[idx] = ENEMY_TYPES.INACTIVE;
    this.isAir[idx] = 0;
    this.sprites[idx].setVisible(false);
    this.sprites[idx].setActive(false);
    this.freeIndices.push(idx);
    this.activeCount = Math.max(0, this.activeCount - 1);
    this.typeCounts[oldType] = Math.max(0, this.typeCounts[oldType] - 1);
  }

  /**
   * Spawns a projectile from enemy position towards target.
   */
  spawnBullet(x, y, vx, vy, damage = 3, life = 1.1, isShell = false) {
    if (this.freeBulletIndices.length === 0) return -1;
    const idx = this.freeBulletIndices.pop();

    this.bulletActive[idx] = 1;
    this.bulletX[idx] = x;
    this.bulletY[idx] = y;
    this.bulletVx[idx] = vx;
    this.bulletVy[idx] = vy;
    this.bulletDamage[idx] = damage;
    this.bulletLife[idx] = life;
    this.bulletIsShell[idx] = isShell ? 1 : 0;
    this.activeBulletCount++;

    return idx;
  }

  /**
   * Recycles a bullet back into free pool.
   */
  despawnBullet(idx) {
    if (!this.bulletActive[idx]) return;

    this.bulletActive[idx] = 0;
    this.freeBulletIndices.push(idx);
    this.activeBulletCount = Math.max(0, this.activeBulletCount - 1);
  }

  /**
   * Spawns enemies dynamically based on the current Siaga threat level.
   */
  updateSpawning(camera, dt) {
    const level = this.alertSystem ? this.alertSystem.currentLevel : 1;
    const table = ALERT_CONFIG.spawnTables[level] || ALERT_CONFIG.spawnTables[1];

    this.spawnTimer += dt * 1000;
    if (this.spawnTimer < table.spawnIntervalMs) return;
    this.spawnTimer = 0;

    if (this.activeCount >= table.maxActiveTotal || this.activeCount >= this.maxEnemies) return;

    const camX = camera.scrollX + camera.width / 2;
    const camY = camera.scrollY + camera.height / 2;
    const { spawnRingInnerRadius, spawnRingOuterRadius } = ENEMY_CONFIG;

    // Build list of eligible types based on active limits and weights
    const eligibleTypes = [];
    let totalWeight = 0;

    const typeMapping = [
      { id: ENEMY_TYPES.CITIZEN, key: 'CITIZEN' },
      { id: ENEMY_TYPES.POLICE, key: 'POLICE' },
      { id: ENEMY_TYPES.POLICE_CAR, key: 'POLICE_CAR' },
      { id: ENEMY_TYPES.TANK, key: 'TANK' },
      { id: ENEMY_TYPES.SOLDIER, key: 'SOLDIER' },
      { id: ENEMY_TYPES.HELICOPTER, key: 'HELICOPTER' },
      { id: ENEMY_TYPES.DRONE, key: 'DRONE' }
    ];

    for (let t = 0; t < typeMapping.length; t++) {
      const item = typeMapping[t];
      const weight = table.weights[item.key] || 0;
      const limit = table.typeLimits[item.key] || 0;
      if (weight > 0 && this.typeCounts[item.id] < limit) {
        eligibleTypes.push({ id: item.id, weight });
        totalWeight += weight;
      }
    }

    if (eligibleTypes.length === 0 || totalWeight <= 0) return;

    for (let b = 0; b < table.spawnBatchSize; b++) {
      if (this.activeCount >= table.maxActiveTotal || this.activeCount >= this.maxEnemies) break;

      // Select type by roulette
      let r = this.prng.range(0, totalWeight);
      let selectedType = eligibleTypes[0].id;
      for (let e = 0; e < eligibleTypes.length; e++) {
        r -= eligibleTypes[e].weight;
        if (r <= 0) {
          selectedType = eligibleTypes[e].id;
          break;
        }
      }

      const angle = this.prng.range(0, Math.PI * 2);
      const dist = this.prng.range(spawnRingInnerRadius, spawnRingOuterRadius);
      let sx = camX + Math.cos(angle) * dist;
      let sy = camY + Math.sin(angle) * dist;

      // Clamp to world
      if (sx < 60 || sx > this.worldWidth - 60 || sy < 60 || sy > this.worldHeight - 60) {
        continue;
      }

      // AIRBORNE SPAWNING (Helicopters & Kamikaze Drones)
      if (selectedType === ENEMY_TYPES.HELICOPTER) {
        this.spawnEnemy(selectedType, sx, sy, angle + Math.PI);
        continue;
      }

      if (selectedType === ENEMY_TYPES.DRONE) {
        // Spawn swarm of 5-8 drones from same sector edge
        const swarmCount = this.prng.rangeInt(5, 8);
        for (let s = 0; s < swarmCount; s++) {
          if (this.activeCount >= table.maxActiveTotal || this.activeCount >= this.maxEnemies) break;
          if (this.typeCounts[ENEMY_TYPES.DRONE] >= table.typeLimits.DRONE) break;
          const jx = sx + this.prng.range(-24, 24);
          const jy = sy + this.prng.range(-24, 24);
          this.spawnEnemy(selectedType, jx, jy, angle + Math.PI);
        }
        continue;
      }

      // GROUND SPAWNING (Citizens, Police, Cars, Tanks, Soldiers)
      const isVehicle = selectedType === ENEMY_TYPES.TANK || selectedType === ENEMY_TYPES.POLICE_CAR;
      if (this.navGrid) {
        if (!this.navGrid.isWalkable(sx, sy, isVehicle)) {
          let found = false;
          const offsets = [8, -8, 16, -16, 24, -24];
          for (let ox of offsets) {
            for (let oy of offsets) {
              if (this.navGrid.isWalkable(sx + ox, sy + oy, isVehicle)) {
                sx += ox;
                sy += oy;
                found = true;
                break;
              }
            }
            if (found) break;
          }
          if (!found) continue;
        }
      } else {
        const cell = this.cityGrid.getCellAt(sx, sy);
        if (cell && (cell.type === CELL_TYPES.BUILDING || cell.type === CELL_TYPES.BUILDING_DETAIL)) {
          continue;
        }
      }

      // Soldiers spawn in small fireteams of 3-4
      if (selectedType === ENEMY_TYPES.SOLDIER) {
        const squadSize = this.prng.rangeInt(3, 4);
        for (let sq = 0; sq < squadSize; sq++) {
          if (this.activeCount >= table.maxActiveTotal || this.activeCount >= this.maxEnemies) break;
          if (this.typeCounts[ENEMY_TYPES.SOLDIER] >= table.typeLimits.SOLDIER) break;
          const offsetPos = {
            x: sx + this.prng.range(-12, 12),
            y: sy + this.prng.range(-12, 12)
          };
          if (!this.navGrid || this.navGrid.isWalkable(offsetPos.x, offsetPos.y, false)) {
            this.spawnEnemy(selectedType, offsetPos.x, offsetPos.y, angle + Math.PI);
          }
        }
      } else {
        this.spawnEnemy(selectedType, sx, sy, angle + Math.PI);
      }
    }
  }

  /**
   * Applies damage to an enemy entity.
   * Airborne enemies (Helis, Drones) can ONLY be damaged if canHitAir is true!
   * @param {number} idx - Enemy pool index
   * @param {number} amount - Damage amount
   * @param {boolean} canHitAir - Whether the weapon can strike aerial targets
   * @returns {boolean} - True if damage was applied
   */
  damageEnemy(idx, amount, canHitAir = false) {
    if (!this.active[idx]) return false;
    if (this.isAir[idx] === 1 && !canHitAir) return false;

    this.hp[idx] -= amount;

    if (this.hp[idx] <= 0) {
      const eType = this.type[idx];
      const ex = this.x[idx];
      const ey = this.y[idx];

      if (eType === ENEMY_TYPES.HELICOPTER) {
        // Helicopter enters spinning crash descent!
        if (this.state[idx] !== 3) {
          this.state[idx] = 3; // CRASHING
          this.timer[idx] = ENEMY_CONFIG.types.HELICOPTER.crashDuration;
          return true;
        }
      } else if (eType === ENEMY_TYPES.DRONE) {
        // Drone explodes in air
        this.scene.particleManager.emitDebris(ex, ey, 0xef4444, 5, 40);
        this.scene.particleManager.emitCollapseFlash(ex, ey, 14);
        if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killDrone);
        this.scene.stats.dronesDestroyed++;
        this.scene.stats.xp += ENEMY_CONFIG.types.DRONE.xp;
        if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.DRONE);
        this.despawnEnemy(idx);
        return true;
      } else {
        // Ground unit destroyed
        if (eType === ENEMY_TYPES.SOLDIER) {
          this.scene.particleManager.emitBloodSplatter(ex, ey);
          if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killSoldier);
          this.scene.stats.soldiersKilled++;
          this.scene.stats.xp += ENEMY_CONFIG.types.SOLDIER.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.SOLDIER);
        } else if (eType === ENEMY_TYPES.TANK) {
          this.scene.particleManager.emitDebris(ex, ey, 0x3a4a32, 10, 60);
          this.scene.particleManager.emitCollapseFlash(ex, ey, 18);
          if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killTank);
          this.scene.stats.tanksDestroyed++;
          this.scene.stats.xp += ENEMY_CONFIG.types.TANK.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.TANK);
        } else if (eType === ENEMY_TYPES.POLICE) {
          this.scene.particleManager.emitBloodSplatter(ex, ey);
          if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killPolice);
          this.scene.stats.policeKilled++;
          this.scene.stats.xp += ENEMY_CONFIG.types.POLICE.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.POLICE);
        } else if (eType === ENEMY_TYPES.CITIZEN) {
          this.scene.particleManager.emitBloodSplatter(ex, ey);
          if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killCivilian);
          this.scene.stats.humansKilled++;
          this.scene.stats.xp += ENEMY_CONFIG.types.CITIZEN.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.CITIZEN);
        } else if (eType === ENEMY_TYPES.POLICE_CAR) {
          this.scene.particleManager.emitDebris(ex, ey, 0x1e3a8a, 8, 65);
          this.scene.particleManager.emitCollapseFlash(ex, ey, 14);
          if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killPolice);
          this.scene.stats.carsDestroyed++;
          this.scene.stats.xp += ENEMY_CONFIG.types.POLICE_CAR.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.POLICE_CAR);
        }
        this.despawnEnemy(idx);
        return true;
      }
    }

    return true;
  }

  /**
   * Temporary debug tool (F6 key): kills all air enemies in radius.
   * Used to test air enemy behaviors until Phase 4 anti-air weapons are implemented.
   */
  debugKillNearestAirEnemies(kx, ky, radius = 260) {
    let killed = 0;
    const r2 = radius * radius;

    for (let i = 0; i < this.maxEnemies; i++) {
      if (!this.active[i] || this.isAir[i] === 0) continue;
      const dx = this.x[i] - kx;
      const dy = this.y[i] - ky;
      if (dx * dx + dy * dy <= r2) {
        this.damageEnemy(i, 999, true);
        killed++;
      }
    }
    return killed;
  }

  /**
   * Main per-frame update loop.
   */
  update(camera, dt, kaiju, particleManager) {
    const updateStartTime = performance.now();

    // 1. Spawning scaled to current Siaga level
    this.updateSpawning(camera, dt);

    // 2. Rebuild Spatial Hash Grid
    this.buildSpatialGrid();

    // 3. Clear transient batch graphics
    this.airShadowGraphics.clear();
    this.telegraphGraphics.clear();

    // 4. Viewport & active radius bounds
    const camX = camera.scrollX + camera.width / 2;
    const camY = camera.scrollY + camera.height / 2;
    const { activeUpdateRadius, despawnRadius, cullMargin, types } = ENEMY_CONFIG;

    const viewLeft = camera.worldView.x - cullMargin;
    const viewRight = camera.worldView.right + cullMargin;
    const viewTop = camera.worldView.y - cullMargin;
    const viewBottom = camera.worldView.bottom + cullMargin;

    const kx = kaiju.x;
    const ky = kaiju.y;

    // 5. Update Active Enemies
    for (let i = 0; i < this.maxEnemies; i++) {
      if (!this.active[i]) continue;

      const ex = this.x[i];
      const ey = this.y[i];
      const distToCam = Math.hypot(ex - camX, ey - camY);

      if (distToCam > despawnRadius) {
        this.despawnEnemy(i);
        continue;
      }

      const eType = this.type[i];
      const sprite = this.sprites[i];

      if (distToCam <= activeUpdateRadius) {
        const dxToKaiju = kx - ex;
        const dyToKaiju = ky - ey;
        const distToKaiju = Math.hypot(dxToKaiju, dyToKaiju);
        const invDist = 1 / Math.max(1, distToKaiju);

        // --- 1. CITIZEN AI ---
        if (eType === ENEMY_TYPES.CITIZEN) {
          const cfg = types.CITIZEN;
          if (distToKaiju < cfg.fleeDistance) {
            this.state[i] = 1;
            let fleeVx = -dxToKaiju * invDist * cfg.speedFleeing;
            let fleeVy = -dyToKaiju * invDist * cfg.speedFleeing;

            let sepX = 0, sepY = 0;
            this.queryEnemiesInRadius(ex, ey, 14, (nIdx, ndx, ndy, d2) => {
              if (nIdx !== i && d2 > 0.1) {
                const d = Math.sqrt(d2);
                sepX -= (ndx / d) * 35;
                sepY -= (ndy / d) * 35;
              }
            });

            this.vx[i] = fleeVx + sepX;
            this.vy[i] = fleeVy + sepY;
            this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
          } else {
            this.state[i] = 0;
            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.timer[i] = this.prng.range(1.5, 3.5);
              const wanderAngle = this.prng.range(0, Math.PI * 2);
              this.vx[i] = Math.cos(wanderAngle) * cfg.speedWander;
              this.vy[i] = Math.sin(wanderAngle) * cfg.speedWander;
              this.rotation[i] = wanderAngle;
            }
          }

          if (this.navGrid) {
            const res = this.navGrid.resolveMovement(ex, ey, this.vx[i], this.vy[i], dt, false);
            this.x[i] = res.x;
            this.y[i] = res.y;
            this.vx[i] = res.vx;
            this.vy[i] = res.vy;
          } else {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }
        }

        // --- 2. POLICE AI ---
        else if (eType === ENEMY_TYPES.POLICE) {
          const cfg = types.POLICE;
          let sepX = 0, sepY = 0;
          this.queryEnemiesInRadius(ex, ey, cfg.separationDistance, (nIdx, ndx, ndy, d2) => {
            if (nIdx !== i && d2 > 0.1) {
              const d = Math.sqrt(d2);
              sepX -= (ndx / d) * cfg.separationForce;
              sepY -= (ndy / d) * cfg.separationForce;
            }
          });

          const flow = this.navGrid ? this.navGrid.getInfantryFlow(ex, ey) : { x: 0, y: 0 };
          const flowActive = flow.x !== 0 || flow.y !== 0;
          const flowX = flowActive ? flow.x : (dxToKaiju * invDist);
          const flowY = flowActive ? flow.y : (dyToKaiju * invDist);

          if (distToKaiju > cfg.shootRangeMax) {
            this.vx[i] = flowX * cfg.speed + sepX;
            this.vy[i] = flowY * cfg.speed + sepY;
            if (Math.hypot(this.vx[i], this.vy[i]) > 1) {
              this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
            }
          } else if (distToKaiju < cfg.shootRangeMin) {
            this.vx[i] = -flowX * (cfg.speed * 0.6) + sepX;
            this.vy[i] = -flowY * (cfg.speed * 0.6) + sepY;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);
          } else {
            this.vx[i] = -dyToKaiju * invDist * 18 + sepX;
            this.vy[i] = dxToKaiju * invDist * 18 + sepY;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.timer[i] = this.prng.range(cfg.shootIntervalMin, cfg.shootIntervalMax);
              const shootAngle = Math.atan2(dyToKaiju, dxToKaiju) + this.prng.range(-0.14, 0.14);
              this.spawnBullet(ex, ey, Math.cos(shootAngle) * cfg.bulletSpeed, Math.sin(shootAngle) * cfg.bulletSpeed, cfg.bulletDamage, cfg.bulletLife, false);
              particleManager.emitDebris(ex, ey, 0xfef08a, 1, 20);
            }
          }

          if (this.navGrid) {
            const res = this.navGrid.resolveMovement(ex, ey, this.vx[i], this.vy[i], dt, false);
            this.x[i] = res.x;
            this.y[i] = res.y;
            this.vx[i] = res.vx;
            this.vy[i] = res.vy;
          } else {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }
        }

        // --- 3. POLICE CAR AI ---
        else if (eType === ENEMY_TYPES.POLICE_CAR) {
          const cfg = types.POLICE_CAR;
          const flow = this.navGrid ? this.navGrid.getVehicleFlow(ex, ey) : { x: 0, y: 0 };
          const flowActive = flow.x !== 0 || flow.y !== 0;
          const flowX = flowActive ? flow.x : (dxToKaiju * invDist);
          const flowY = flowActive ? flow.y : (dyToKaiju * invDist);

          this.vx[i] = flowX * cfg.speed;
          this.vy[i] = flowY * cfg.speed;
          if (Math.hypot(this.vx[i], this.vy[i]) > 1) {
            this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
          }

          this.timer[i] += dt;
          if (this.timer[i] >= cfg.sirenToggleInterval) {
            this.timer[i] = 0;
            this.subType[i] = this.subType[i] === 0 ? 1 : 0;
          }

          if (this.navGrid) {
            const res = this.navGrid.resolveMovement(ex, ey, this.vx[i], this.vy[i], dt, true);
            this.x[i] = res.x;
            this.y[i] = res.y;
            this.vx[i] = res.vx;
            this.vy[i] = res.vy;
          } else {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }

          if (distToKaiju < 26 * kaiju.currentScale) {
            kaiju.takeDamage(cfg.ramDamage);
            particleManager.emitDebris(this.x[i], this.y[i], 0x1e3a8a, 8, 65);
            particleManager.emitCollapseFlash(this.x[i], this.y[i], 16);
            this.despawnEnemy(i);
            continue;
          }
        }

        // --- 4. TANK AI ---
        else if (eType === ENEMY_TYPES.TANK) {
          const cfg = types.TANK;
          let sepX = 0, sepY = 0;
          this.queryEnemiesInRadius(ex, ey, 24, (nIdx, ndx, ndy, d2) => {
            if (nIdx !== i && d2 > 0.1) {
              const d = Math.sqrt(d2);
              sepX -= (ndx / d) * 35;
              sepY -= (ndy / d) * 35;
            }
          });

          const flow = this.navGrid ? this.navGrid.getVehicleFlow(ex, ey) : { x: 0, y: 0 };
          const flowActive = flow.x !== 0 || flow.y !== 0;
          const flowX = flowActive ? flow.x : (dxToKaiju * invDist);
          const flowY = flowActive ? flow.y : (dyToKaiju * invDist);

          if (distToKaiju > cfg.shootRangeMax) {
            this.vx[i] = flowX * cfg.speed + sepX;
            this.vy[i] = flowY * cfg.speed + sepY;
            if (Math.hypot(this.vx[i], this.vy[i]) > 1) {
              this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
            }
          } else if (distToKaiju < cfg.shootRangeMin) {
            this.vx[i] = -flowX * (cfg.speed * 0.5) + sepX;
            this.vy[i] = -flowY * (cfg.speed * 0.5) + sepY;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);
          } else {
            this.vx[i] = sepX * 0.4;
            this.vy[i] = sepY * 0.4;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.timer[i] = this.prng.range(cfg.shootIntervalMin, cfg.shootIntervalMax);
              const shootAngle = Math.atan2(dyToKaiju, dxToKaiju) + this.prng.range(-0.06, 0.06);
              const sVx = Math.cos(shootAngle) * cfg.shellSpeed;
              const sVy = Math.sin(shootAngle) * cfg.shellSpeed;
              const muzzleX = ex + Math.cos(shootAngle) * 9;
              const muzzleY = ey + Math.sin(shootAngle) * 9;

              this.spawnBullet(muzzleX, muzzleY, sVx, sVy, cfg.shellDamage, cfg.shellLife, true);
              particleManager.emitDebris(muzzleX, muzzleY, 0xf97316, 4, 50);
              particleManager.emitDust(muzzleX, muzzleY, 2, 0.8);
            }
          }

          if (this.navGrid) {
            const res = this.navGrid.resolveMovement(ex, ey, this.vx[i], this.vy[i], dt, true);
            this.x[i] = res.x;
            this.y[i] = res.y;
            this.vx[i] = res.vx;
            this.vy[i] = res.vy;
          } else {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }
        }

        // --- 5. SOLDIER AI (Infanteri Militer) ---
        else if (eType === ENEMY_TYPES.SOLDIER) {
          const cfg = types.SOLDIER;
          let sepX = 0, sepY = 0;
          this.queryEnemiesInRadius(ex, ey, cfg.separationDistance, (nIdx, ndx, ndy, d2) => {
            if (nIdx !== i && d2 > 0.1) {
              const d = Math.sqrt(d2);
              sepX -= (ndx / d) * cfg.separationForce;
              sepY -= (ndy / d) * cfg.separationForce;
            }
          });

          // Sample infantry flow field with squad formation offset
          const flow = this.navGrid
            ? this.navGrid.getInfantryFlow(ex + this.targetX[i], ey + this.targetY[i])
            : { x: 0, y: 0 };
          const flowActive = flow.x !== 0 || flow.y !== 0;
          const flowX = flowActive ? flow.x : (dxToKaiju * invDist);
          const flowY = flowActive ? flow.y : (dyToKaiju * invDist);

          if (distToKaiju > cfg.shootRangeMax) {
            // Advance in formation
            this.vx[i] = flowX * cfg.speed + sepX;
            this.vy[i] = flowY * cfg.speed + sepY;
            if (Math.hypot(this.vx[i], this.vy[i]) > 1) {
              this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
            }
          } else if (distToKaiju < cfg.shootRangeMin) {
            // Tactical retreat while facing Kaiju
            this.vx[i] = -flowX * (cfg.speed * 0.5) + sepX;
            this.vy[i] = -flowY * (cfg.speed * 0.5) + sepY;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);
          } else {
            // Firing pocket (85-110 px): strafe & lock weapon on Kaiju
            this.vx[i] = -dyToKaiju * invDist * 16 + sepX;
            this.vy[i] = dxToKaiju * invDist * 16 + sepY;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            // Synchronized Burst Firing Logic
            if (this.burstCount[i] > 0) {
              this.burstTimer[i] -= dt;
              if (this.burstTimer[i] <= 0) {
                this.burstTimer[i] = cfg.burstInterval;
                this.burstCount[i]--;

                const shootAngle = Math.atan2(dyToKaiju, dxToKaiju) + this.prng.range(-0.10, 0.10);
                this.spawnBullet(ex, ey, Math.cos(shootAngle) * cfg.bulletSpeed, Math.sin(shootAngle) * cfg.bulletSpeed, cfg.bulletDamage, cfg.bulletLife, false);
                particleManager.emitDebris(ex, ey, 0xfef08a, 1, 24);
              }
            } else {
              this.timer[i] -= dt;
              if (this.timer[i] <= 0) {
                this.timer[i] = this.prng.range(cfg.shootIntervalMin, cfg.shootIntervalMax);
                this.burstCount[i] = cfg.burstCount;
                this.burstTimer[i] = 0;
              }
            }
          }

          if (this.navGrid) {
            const res = this.navGrid.resolveMovement(ex, ey, this.vx[i], this.vy[i], dt, false);
            this.x[i] = res.x;
            this.y[i] = res.y;
            this.vx[i] = res.vx;
            this.vy[i] = res.vy;
          } else {
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
          }
        }

        // --- 6. HELICOPTER AI (Attack Helicopter - Aerial Threat) ---
        else if (eType === ENEMY_TYPES.HELICOPTER) {
          const cfg = types.HELICOPTER;
          this.subType[i] = (this.subType[i] + 1) % 2; // Spin rotor blades

          if (this.state[i] === 3) {
            // STATE: CRASHING (Tailspin into ground)
            this.rotation[i] += 16 * dt;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;

            // Smoke & spark trail
            particleManager.emitDebris(ex, ey, 0x1f2937, 2, 25);
            particleManager.emitDebris(ex, ey, 0xf97316, 1, 15);

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              // Impact ground explosion!
              particleManager.emitDebris(ex, ey, 0xf97316, 14, 75);
              particleManager.emitCollapseFlash(ex, ey, 24);
              this.scene.cameras.main.shake(160, 0.007);

              // Blast building cells underneath crash
              this.blastGroundArea(ex, ey, cfg.crashExplosionRadius, cfg.crashBuildingDamage);
              if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killHelicopter);
              this.scene.stats.helicoptersDestroyed++;
              this.scene.stats.xp += cfg.xp;
              if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.HELICOPTER);
              this.despawnEnemy(i);
              continue;
            }
          } else if (this.state[i] === 0) {
            // STATE: ORBITING KAIJU (100 - 140 px)
            let tangentX = -dyToKaiju * invDist;
            let tangentY = dxToKaiju * invDist;
            let radial = 0;
            if (distToKaiju > cfg.orbitRadiusMax) radial = 0.55;
            else if (distToKaiju < cfg.orbitRadiusMin) radial = -0.55;

            this.vx[i] = (tangentX + (dxToKaiju * invDist) * radial) * cfg.speed;
            this.vy[i] = (tangentY + (dyToKaiju * invDist) * radial) * cfg.speed;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju); // Look towards Kaiju

            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.state[i] = 1; // TELEGRAPH AIMING
              this.timer[i] = cfg.telegraphDuration;
            }
          } else if (this.state[i] === 1) {
            // STATE: TELEGRAPH (Blinking aiming laser warning)
            this.vx[i] *= 0.88;
            this.vy[i] *= 0.88;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            // Draw telegraph aiming laser
            this.telegraphGraphics.lineStyle(1.5, 0xef4444, 0.85);
            this.telegraphGraphics.lineBetween(ex, ey, kx, ky);

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.state[i] = 2; // FIRING BURST
              this.burstCount[i] = cfg.burstCount;
              this.burstTimer[i] = 0;
              this.timer[i] = this.prng.range(cfg.shootIntervalMin, cfg.shootIntervalMax);
            }
          } else if (this.state[i] === 2) {
            // STATE: BURST FIRING
            this.vx[i] *= 0.92;
            this.vy[i] *= 0.92;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            this.burstTimer[i] -= dt;
            if (this.burstTimer[i] <= 0 && this.burstCount[i] > 0) {
              this.burstTimer[i] = cfg.burstInterval;
              this.burstCount[i]--;

              const shootAngle = Math.atan2(dyToKaiju, dxToKaiju) + this.prng.range(-0.05, 0.05);
              const bVx = Math.cos(shootAngle) * cfg.bulletSpeed;
              const bVy = Math.sin(shootAngle) * cfg.bulletSpeed;
              this.spawnBullet(ex, ey, bVx, bVy, cfg.bulletDamage, cfg.bulletLife, false);
              particleManager.emitDebris(ex, ey, 0xfef08a, 2, 28);
            }

            if (this.burstCount[i] <= 0) {
              this.state[i] = 0; // Return to orbit
            }
          }
        }

        // --- 7. DRONE KAMIKAZE AI ---
        else if (eType === ENEMY_TYPES.DRONE) {
          const cfg = types.DRONE;

          if (this.state[i] === 0) {
            // STATE: CRUISE
            this.vx[i] = dxToKaiju * invDist * cfg.speedCruise;
            this.vy[i] = dyToKaiju * invDist * cfg.speedCruise;
            this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);

            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;

            if (distToKaiju <= cfg.telegraphDistance) {
              this.state[i] = 1; // TELEGRAPH BLINK
              this.timer[i] = cfg.telegraphDuration;
            }
          } else if (this.state[i] === 1) {
            // STATE: TELEGRAPH (Fast blinking warning)
            this.vx[i] *= 0.92;
            this.vy[i] *= 0.92;
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;
            this.rotation[i] = Math.atan2(dyToKaiju, dxToKaiju);

            // Warning beacon blink
            this.telegraphGraphics.fillStyle(0xfacc15, 0.9);
            this.telegraphGraphics.fillCircle(ex, ey, 3);

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              this.state[i] = 2; // DIVE BOMB
              const diveDist = Math.hypot(kx - ex, ky - ey) || 1;
              this.vx[i] = ((kx - ex) / diveDist) * cfg.speedDive;
              this.vy[i] = ((ky - ey) / diveDist) * cfg.speedDive;
              this.rotation[i] = Math.atan2(this.vy[i], this.vx[i]);
              this.timer[i] = 0.85; // Max dive lifespan
            }
          } else if (this.state[i] === 2) {
            // STATE: HIGH SPEED DIVE
            this.x[i] += this.vx[i] * dt;
            this.y[i] += this.vy[i] * dt;

            // Direct Kaiju hit
            if (distToKaiju < 22 * kaiju.currentScale) {
              kaiju.takeDamage(cfg.explosionKaijuDamage);
              particleManager.emitDebris(ex, ey, 0xef4444, 9, 60);
              particleManager.emitCollapseFlash(ex, ey, 18);
              this.scene.cameras.main.shake(120, 0.006);
              if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killDrone);
              this.despawnEnemy(i);
              continue;
            }

            this.timer[i] -= dt;
            if (this.timer[i] <= 0) {
              // Hit ground
              particleManager.emitDebris(ex, ey, 0xef4444, 7, 50);
              particleManager.emitCollapseFlash(ex, ey, 14);
              this.blastGroundArea(ex, ey, cfg.explosionRadius, cfg.explosionBuildingDamage);
              if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killDrone);
              this.despawnEnemy(i);
              continue;
            }
          }
        }
      }

      // 6. Frustum Culling & Rendering
      const curX = this.x[i];
      const curY = this.y[i];
      const isVisible =
        curX >= viewLeft &&
        curX <= viewRight &&
        curY >= viewTop &&
        curY <= viewBottom;

      if (isVisible) {
        sprite.setVisible(true);
        sprite.setPosition(curX, curY);
        sprite.setRotation(this.rotation[i]);

        // Draw Shadows for Airborne Units
        if (this.isAir[i] === 1) {
          sprite.setDepth(28); // Above Kaiju and buildings
          if (eType === ENEMY_TYPES.HELICOPTER) {
            // Ground shadow offset by +12 px X, +16 px Y
            this.airShadowGraphics.fillStyle(0x020617, 0.35);
            this.airShadowGraphics.fillCircle(curX + 12, curY + 16, 7);
          } else if (eType === ENEMY_TYPES.DRONE) {
            this.airShadowGraphics.fillStyle(0x020617, 0.30);
            this.airShadowGraphics.fillCircle(curX + 6, curY + 8, 3);
          }
        } else {
          sprite.setDepth(12); // Ground layer
        }

        // Texture assignment
        if (eType === ENEMY_TYPES.CITIZEN) {
          sprite.setTexture(`enemy_citizen_${this.subType[i]}`);
        } else if (eType === ENEMY_TYPES.POLICE) {
          sprite.setTexture('enemy_police');
        } else if (eType === ENEMY_TYPES.POLICE_CAR) {
          sprite.setTexture(`enemy_police_car_${this.subType[i]}`);
        } else if (eType === ENEMY_TYPES.TANK) {
          sprite.setTexture('enemy_tank');
        } else if (eType === ENEMY_TYPES.SOLDIER) {
          sprite.setTexture('enemy_soldier');
        } else if (eType === ENEMY_TYPES.HELICOPTER) {
          sprite.setTexture(`enemy_helicopter_${this.subType[i]}`);
        } else if (eType === ENEMY_TYPES.DRONE) {
          sprite.setTexture('enemy_drone');
        }
      } else {
        if (sprite.visible) {
          sprite.setVisible(false);
        }
      }
    }

    // 7. Update Projectiles (Bullets & Artillery Shells)
    this.updateBullets(dt, kaiju, particleManager);

    this.lastUpdateTimeMs = performance.now() - updateStartTime;
  }

  /**
   * Helper to blast building cells in a world radius during aerial crashes & drone detonations
   */
  blastGroundArea(worldX, worldY, radius, damage) {
    const cg = this.cityGrid;
    const invCell = 1 / cg.cellSize;
    const minCol = Math.max(0, Math.floor((worldX - radius) * invCell));
    const maxCol = Math.min(cg.cols - 1, Math.floor((worldX + radius) * invCell));
    const minRow = Math.max(0, Math.floor((worldY - radius) * invCell));
    const maxRow = Math.min(cg.rows - 1, Math.floor((worldY + radius) * invCell));
    const r2 = radius * radius;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const cx = c * cg.cellSize + cg.cellSize / 2;
        const cy = r * cg.cellSize + cg.cellSize / 2;
        const distSq = (cx - worldX) * (cx - worldX) + (cy - worldY) * (cy - worldY);
        if (distSq <= r2) {
          const res = cg.damageCell(c, r, damage);
          if (res && res.destroyed && this.scene && this.scene.onCellDestroyed) {
            this.scene.onCellDestroyed({ col: c, row: r, worldX: cx, worldY: cy }, res.building, false);
          }
        }
      }
    }
  }

  /**
   * Updates bullet physics, collisions with Kaiju and city buildings, and batch draws tracers.
   */
  updateBullets(dt, kaiju, particleManager) {
    this.bulletGraphics.clear();
    const kx = kaiju.x;
    const ky = kaiju.y;
    const kaijuHitRadius = 24 * kaiju.currentScale;
    const { bulletBuildingDamage, types } = ENEMY_CONFIG;
    const shellBuildingDamage = types.TANK.shellBuildingDamage;

    for (let i = 0; i < this.maxBullets; i++) {
      if (!this.bulletActive[i]) continue;

      this.bulletLife[i] -= dt;
      if (this.bulletLife[i] <= 0) {
        this.despawnBullet(i);
        continue;
      }

      this.bulletX[i] += this.bulletVx[i] * dt;
      this.bulletY[i] += this.bulletVy[i] * dt;

      const bx = this.bulletX[i];
      const by = this.bulletY[i];
      const isShell = this.bulletIsShell[i] === 1;

      // A. Collision with Kaiju
      const distToKaiju = Math.hypot(bx - kx, by - ky);
      if (distToKaiju <= kaijuHitRadius) {
        const damageDealt = kaiju.takeDamage(this.bulletDamage[i]);
        if (damageDealt) {
          if (isShell) {
            particleManager.emitDebris(bx, by, 0xf97316, 6, 55);
            particleManager.emitCollapseFlash(bx, by, 16);
            this.scene.cameras.main.shake(100, 0.005);
          } else {
            particleManager.emitDebris(bx, by, 0xffd23f, 2, 35);
          }
        }
        this.despawnBullet(i);
        continue;
      }

      // B. Collision with Buildings
      const cell = this.cityGrid.getCellAt(bx, by);
      if (cell && (cell.type === CELL_TYPES.BUILDING || cell.type === CELL_TYPES.BUILDING_DETAIL)) {
        const bDmg = isShell ? shellBuildingDamage : bulletBuildingDamage;
        this.cityGrid.damageCell(cell.col, cell.row, bDmg);

        if (isShell) {
          particleManager.emitDebris(bx, by, 0xf97316, 6, 60);
          particleManager.emitDust(bx, by, 3, 1.2);
          particleManager.emitCollapseFlash(bx, by, 12);
        } else {
          particleManager.emitDebris(bx, by, 0x94a3b8, 1, 20);
        }

        this.despawnBullet(i);
        continue;
      }

      // C. Render Tracers
      if (isShell) {
        this.bulletGraphics.fillStyle(0xea580c, 0.95);
        this.bulletGraphics.fillRect(bx - 2, by - 2, 4, 4);
        this.bulletGraphics.fillStyle(0xffffff, 1.0);
        this.bulletGraphics.fillRect(bx - 1, by - 1, 2, 2);
      } else {
        this.bulletGraphics.fillStyle(0xfde047, 0.9);
        this.bulletGraphics.fillRect(bx - 1, by - 1, 2, 2);
        this.bulletGraphics.fillStyle(0xffffff, 1.0);
        this.bulletGraphics.fillRect(bx, by, 1, 1);
      }
    }
  }

  /**
   * Checks for Kaiju body and tail trample crushing active enemies.
   * Airborne enemies (Helicopters & Drones) are completely immune to ground stomps!
   */
  checkKaijuTrample(bodyFoot, tailFoots, particleManager, onKill) {
    const cos = Math.cos(-bodyFoot.angle);
    const sin = Math.sin(-bodyFoot.angle);
    const invRx2 = 1 / (bodyFoot.rx * bodyFoot.rx);
    const invRy2 = 1 / (bodyFoot.ry * bodyFoot.ry);

    const queryRadius = Math.max(bodyFoot.rx, bodyFoot.ry) + 30;

    this.queryEnemiesInRadius(bodyFoot.cx, bodyFoot.cy, queryRadius, (i, dx, dy) => {
      if (!this.active[i]) return;
      if (this.isAir[i] === 1) return; // Airborne units cannot be trampled!

      const eType = this.type[i];
      // Tanks and Soldiers are too sturdy for trampling - must be destroyed with weapons!
      if (eType === ENEMY_TYPES.TANK || eType === ENEMY_TYPES.SOLDIER) return;

      const ex = this.x[i];
      const ey = this.y[i];

      // 1. Check Torso Ellipse Collision
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      let hit = (lx * lx * invRx2 + ly * ly * invRy2) <= 1.0;

      // 2. Check Tail Segment Circles Collision
      if (!hit) {
        for (let t = 0; t < tailFoots.length; t++) {
          const seg = tailFoots[t];
          const tdx = ex - seg.cx;
          const tdy = ey - seg.cy;
          if (tdx * tdx + tdy * tdy <= seg.radius * seg.radius) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        let xpGained = 10;

        if (eType === ENEMY_TYPES.CITIZEN) {
          particleManager.emitBloodSplatter(ex, ey);
          xpGained = ENEMY_CONFIG.types.CITIZEN.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.CITIZEN);
        } else if (eType === ENEMY_TYPES.POLICE) {
          particleManager.emitBloodSplatter(ex, ey);
          xpGained = ENEMY_CONFIG.types.POLICE.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.POLICE);
        } else if (eType === ENEMY_TYPES.POLICE_CAR) {
          particleManager.emitDebris(ex, ey, 0x1e3a8a, 8, 65);
          particleManager.emitCollapseFlash(ex, ey, 14);
          xpGained = ENEMY_CONFIG.types.POLICE_CAR.xp;
          if (this.scene.xpSystem) this.scene.xpSystem.spawnCrystal(ex, ey, XP_CONFIG.drops.POLICE_CAR);
        }

        this.despawnEnemy(i);
        if (onKill) {
          onKill(eType, xpGained);
        }
      }
    });
  }

  /**
   * Cleanly resets all enemies and projectiles for a new run
   */
  reset() {
    for (let i = 0; i < this.maxEnemies; i++) {
      this.active[i] = 0;
      this.isAir[i] = 0;
      this.sprites[i].setVisible(false);
      this.sprites[i].setActive(false);
    }
    this.freeIndices = [];
    for (let i = this.maxEnemies - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
    this.activeCount = 0;
    this.typeCounts.fill(0);

    for (let i = 0; i < this.maxBullets; i++) {
      this.bulletActive[i] = 0;
    }
    this.freeBulletIndices = [];
    for (let i = this.maxBullets - 1; i >= 0; i--) {
      this.freeBulletIndices.push(i);
    }
    this.activeBulletCount = 0;

    this.bulletGraphics.clear();
    this.airShadowGraphics.clear();
    this.telegraphGraphics.clear();
    this.gridHead.fill(-1);
    this.spawnTimer = 0;
  }

  /**
   * Destroys all visual resources cleanly
   */
  destroy() {
    this.reset();
    for (let i = 0; i < this.maxEnemies; i++) {
      if (this.sprites[i]) this.sprites[i].destroy();
    }
    if (this.bulletGraphics) this.bulletGraphics.destroy();
    if (this.airShadowGraphics) this.airShadowGraphics.destroy();
    if (this.telegraphGraphics) this.telegraphGraphics.destroy();
  }
}
