import { EVENT_CONFIG } from '../config/events.js';
import { ENEMY_TYPES } from '../enemies/EnemyManager.js';
import { PRNG } from '../utils/prng.js';

/**
 * EventSystem.js - Tahap 5B-2
 * Manages city-wide dynamic special events:
 * 1. Military Convoy (Siaga 2+)
 * 2. Carpet Bombing Airstrike (Siaga 3+)
 * 3. Mass Civilian Evacuation (Siaga 1+)
 *
 * Characteristics:
 * - HTML warning banners & siren hooks
 * - Minimap radar markers
 * - Safe error handling (try/catch logging, 0 freezes)
 * - Clean teardown on kaiju death/respawn and boss spawn
 * - Adheres strictly to EnemyManager SoA pool and active caps
 */
export class EventSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} enemyManager 
   * @param {Object} alertSystem 
   * @param {Object} cityGrid 
   * @param {Object} navGrid 
   */
  constructor(scene, enemyManager, alertSystem, cityGrid, navGrid) {
    this.scene = scene;
    this.enemyManager = enemyManager;
    this.alertSystem = alertSystem;
    this.cityGrid = cityGrid;
    this.navGrid = navGrid;
    this.prng = new PRNG(4242);

    // Active state
    this.activeEvent = null; // null | 'MILITARY_CONVOY' | 'AIRSTRIKE' | 'EVACUATION'
    this.eventTimer = 0;
    this.cooldownTimer = EVENT_CONFIG.firstEventDelaySeconds; // 45s initial wait
    this.lastUpdateTimeMs = 0;
    this.debugRotationIndex = 0;

    // Dedicated graphics batches
    this.groundGraphics = scene.add.graphics().setDepth(10); // Below Kaiju, above rubble
    this.airGraphics = scene.add.graphics().setDepth(27); // Above buildings for shadows and bombers

    // Event 1: Military Convoy state
    this.convoyIndices = [];
    this.convoyTotalVehicles = 0;

    // Event 2: Airstrike state
    this.airstrikeWavesRemaining = 0;
    this.airstrikeWaveTimer = 0;
    this.airstrikeLine = null; // { x1, y1, x2, y2, angle, length }
    this.airstrikePhase = 'idle'; // 'telegraph' | 'shadow' | 'bombing'
    this.airstrikePhaseTimer = 0;
    this.airstrikeShadowProgress = 0;
    this.airstrikeBombsDropped = 0;
    this.kaijuHitDuringAirstrike = false;

    // Event 3: Evacuation state
    this.evacX = 0;
    this.evacY = 0;
    this.evacSpawnTimer = 0;
    this.evacCitizensSpawned = 0;
  }

  /**
   * Main per-frame update loop
   */
  update(dt, kaiju) {
    const startTime = performance.now();
    try {
      // 1. If Boss is active, abort or inhibit events
      if (this.scene.bossManager && this.scene.bossManager.isBossActive()) {
        if (this.activeEvent) {
          this.stopCurrentEvent(false);
        }
        this.lastUpdateTimeMs = performance.now() - startTime;
        return;
      }

      // 2. If Card modal or Death screen is open, pause timers
      if (this.scene.isCardSelecting || this.scene.isGameOver) {
        this.lastUpdateTimeMs = performance.now() - startTime;
        return;
      }

      // 3. Cooldown tick if no event is active
      if (!this.activeEvent) {
        this.cooldownTimer -= dt;
        if (this.cooldownTimer <= 0) {
          this.cooldownTimer = EVENT_CONFIG.minIntervalSeconds;
          this.triggerRandomEligibleEvent(kaiju);
        }
      } else {
        // 4. Update currently active event
        this.eventTimer -= dt;
        if (this.activeEvent === 'MILITARY_CONVOY') {
          this.updateConvoy(dt, kaiju);
        } else if (this.activeEvent === 'AIRSTRIKE') {
          this.updateAirstrike(dt, kaiju);
        } else if (this.activeEvent === 'EVACUATION') {
          this.updateEvacuation(dt, kaiju);
        }
      }
    } catch (err) {
      console.error('[EventSystem] Error in update loop:', err);
    }
    this.lastUpdateTimeMs = performance.now() - startTime;
  }

  /**
   * Rolls a random eligible event based on current Siaga threat level
   */
  triggerRandomEligibleEvent(kaiju) {
    const currentAlertLevel = this.alertSystem ? this.alertSystem.currentLevel : 1;
    const eligible = [];

    const cfg = EVENT_CONFIG.events;
    if (currentAlertLevel >= cfg.EVACUATION.minAlert) eligible.push('EVACUATION');
    if (currentAlertLevel >= cfg.MILITARY_CONVOY.minAlert) eligible.push('MILITARY_CONVOY');
    if (currentAlertLevel >= cfg.AIRSTRIKE.minAlert) eligible.push('AIRSTRIKE');

    if (eligible.length === 0) return;

    const chosen = eligible[this.prng.rangeInt(0, eligible.length - 1)];
    this.startEvent(chosen, kaiju);
  }

  /**
   * Starts an event by ID
   */
  startEvent(eventId, kaiju) {
    this.stopCurrentEvent(false);

    this.activeEvent = eventId;
    const cfg = EVENT_CONFIG.events[eventId];
    if (!cfg) return;

    this.eventTimer = cfg.duration || 45;

    // Banner & Audio Hook
    if (this.scene.uiManager) {
      this.scene.uiManager.showEventBanner(cfg.bannerTitle, cfg.bannerSubtitle, cfg.bannerDuration || 3000);
    }
    if (this.scene.events) {
      this.scene.events.emit('audio:hook', `event_start_${eventId.toLowerCase()}`);
    }

    if (eventId === 'MILITARY_CONVOY') {
      this.initConvoy(kaiju, cfg);
    } else if (eventId === 'AIRSTRIKE') {
      this.initAirstrike(kaiju, cfg);
    } else if (eventId === 'EVACUATION') {
      this.initEvacuation(kaiju, cfg);
    }
  }

  // =========================================================================
  // EVENT 1: MILITARY CONVOY
  // =========================================================================
  initConvoy(kaiju, cfg) {
    this.convoyIndices = [];
    const count = this.prng.rangeInt(cfg.vehicleCountMin, cfg.vehicleCountMax);
    this.convoyTotalVehicles = count;

    // Pick a spawn point along road network outside camera
    const kx = kaiju ? kaiju.x : 2000;
    const ky = kaiju ? kaiju.y : 2000;
    const spawnAngle = this.prng.range(0, Math.PI * 2);
    const spawnDist = 380;
    const originX = Math.max(100, Math.min(this.scene.worldWidth - 100, kx + Math.cos(spawnAngle) * spawnDist));
    const originY = Math.max(100, Math.min(this.scene.worldHeight - 100, ky + Math.sin(spawnAngle) * spawnDist));

    // Vehicle column spacing
    const dirX = Math.cos(spawnAngle + Math.PI);
    const dirY = Math.sin(spawnAngle + Math.PI);

    for (let i = 0; i < count; i++) {
      const vx = originX + dirX * (i * 26);
      const vy = originY + dirY * (i * 26);

      // Alternating Tank and Military Truck
      const vType = (i % 2 === 0) ? ENEMY_TYPES.TANK : ENEMY_TYPES.TRUCK;
      const idx = this.enemyManager.spawnEnemy(vType, vx, vy, spawnAngle + Math.PI);
      if (idx >= 0) {
        this.convoyIndices.push(idx);
      }
    }

    // Escort Infantry
    for (let s = 0; s < cfg.infantryEscortCount; s++) {
      const sx = originX + dirX * (s * 18) + (s % 2 === 0 ? 16 : -16);
      const sy = originY + dirY * (s * 18) + (s % 2 === 0 ? 16 : -16);
      this.enemyManager.spawnEnemy(ENEMY_TYPES.SOLDIER, sx, sy, spawnAngle + Math.PI);
    }
  }

  updateConvoy(dt, kaiju) {
    // Check remaining convoy vehicles
    let aliveCount = 0;
    for (let i = 0; i < this.convoyIndices.length; i++) {
      const idx = this.convoyIndices[i];
      if (this.enemyManager.active[idx] && this.enemyManager.hp[idx] > 0) {
        aliveCount++;
      }
    }

    // VICTORY: All convoy vehicles eliminated!
    if (aliveCount === 0 && this.convoyIndices.length > 0) {
      const cfg = EVENT_CONFIG.events.MILITARY_CONVOY;
      if (this.scene.stats) {
        this.scene.stats.xp = (this.scene.stats.xp || 0) + cfg.rewardXp;
      }
      if (this.scene.uiManager) {
        this.scene.uiManager.showEventBanner('KONVOI DIMUSNAHKAN!', `HADIAH MILITER: +${cfg.rewardXp} XP DIKUMPULKAN!`, 3000);
      }
      this.stopCurrentEvent(true);
      return;
    }

    // TIME OUT: Convoy escaped / dispersed
    if (this.eventTimer <= 0) {
      if (this.scene.uiManager) {
        this.scene.uiManager.showEventBanner('KONVOI BERHASIL LOLOS', 'Sisa kendaraan militer berhasil mundur dari kota.', 2500);
      }
      this.stopCurrentEvent(false);
    }
  }

  // =========================================================================
  // EVENT 2: CARPET BOMBING AIRSTRIKE
  // =========================================================================
  initAirstrike(kaiju, cfg) {
    this.airstrikeWavesRemaining = cfg.waves || 3;
    this.kaijuHitDuringAirstrike = false;
    this.startNextAirstrikeWave(kaiju, cfg);
  }

  startNextAirstrikeWave(kaiju, cfg) {
    if (this.airstrikeWavesRemaining <= 0) {
      // Completed all waves!
      if (!this.kaijuHitDuringAirstrike && this.scene.stats) {
        this.scene.stats.score = (this.scene.stats.score || 0) + cfg.survivalBonusScore;
        if (this.scene.uiManager) {
          this.scene.uiManager.showEventBanner('SERANGAN UDARA SELESAI', `BONUS SURVIVAL: +${cfg.survivalBonusScore} SKOR!`, 3000);
        }
      }
      this.stopCurrentEvent(true);
      return;
    }

    this.airstrikeWavesRemaining--;
    const kx = kaiju ? kaiju.x : 2000;
    const ky = kaiju ? kaiju.y : 2000;

    // Pick flight flight path crossing near Kaiju
    const angle = this.prng.range(0, Math.PI * 2);
    const flightLength = 700;
    const halfLen = flightLength / 2;
    // Offset slightly so it passes right across Kaiju's combat area
    const offsetX = this.prng.range(-40, 40);
    const offsetY = this.prng.range(-40, 40);
    const centerX = kx + offsetX;
    const centerY = ky + offsetY;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    this.airstrikeLine = {
      x1: centerX - cos * halfLen,
      y1: centerY - sin * halfLen,
      x2: centerX + cos * halfLen,
      y2: centerY + sin * halfLen,
      angle,
      length: flightLength
    };

    this.airstrikePhase = 'telegraph';
    this.airstrikePhaseTimer = cfg.telegraphDuration || 1.5;
    this.airstrikeShadowProgress = 0;
    this.airstrikeBombsDropped = 0;
  }

  updateAirstrike(dt, kaiju) {
    const cfg = EVENT_CONFIG.events.AIRSTRIKE;
    this.groundGraphics.clear();
    this.airGraphics.clear();

    if (!this.airstrikeLine) return;

    const line = this.airstrikeLine;
    const cos = Math.cos(line.angle);
    const sin = Math.sin(line.angle);

    if (this.airstrikePhase === 'telegraph') {
      this.airstrikePhaseTimer -= dt;

      // 1. Draw Red Ground Warning Strip along the bombing path
      const pulse = 0.5 + 0.5 * Math.sin(this.scene.time.now * 0.015);
      this.groundGraphics.lineStyle(24, 0xef4444, 0.28 * pulse);
      this.groundGraphics.lineBetween(line.x1, line.y1, line.x2, line.y2);

      // Warning center dashed line
      this.groundGraphics.lineStyle(3, 0xffffff, 0.8 * pulse);
      this.groundGraphics.lineBetween(line.x1, line.y1, line.x2, line.y2);

      // Border bounds
      const perpX = -sin * 16;
      const perpY = cos * 16;
      this.groundGraphics.lineStyle(1.5, 0xef4444, 0.9);
      this.groundGraphics.lineBetween(line.x1 + perpX, line.y1 + perpY, line.x2 + perpX, line.y2 + perpY);
      this.groundGraphics.lineBetween(line.x1 - perpX, line.y1 - perpY, line.x2 - perpX, line.y2 - perpY);

      if (this.airstrikePhaseTimer <= 0) {
        this.airstrikePhase = 'shadow';
        this.airstrikePhaseTimer = 1.0; // 1s bomber flyover
        this.airstrikeShadowProgress = 0;
        if (this.scene.events) {
          this.scene.events.emit('audio:hook', 'bomber_flyover');
        }
      }
    } else if (this.airstrikePhase === 'shadow') {
      this.airstrikePhaseTimer -= dt;
      this.airstrikeShadowProgress += dt * 1.35;

      const progress = Math.min(1.0, this.airstrikeShadowProgress);
      const curX = line.x1 + (line.x2 - line.x1) * progress;
      const curY = line.y1 + (line.y2 - line.y1) * progress;

      // Draw high-speed Stealth Bomber silhouette passing overhead
      this.airGraphics.fillStyle(0x000000, 0.42);
      this.airGraphics.fillCircle(curX, curY, 28);
      this.airGraphics.beginPath();
      this.airGraphics.moveTo(curX + cos * 45, curY + sin * 45);
      this.airGraphics.lineTo(curX - sin * 55 - cos * 20, curY + cos * 55 - sin * 20);
      this.airGraphics.lineTo(curX - cos * 10, curY - sin * 10);
      this.airGraphics.lineTo(curX + sin * 55 - cos * 20, curY - cos * 55 - sin * 20);
      this.airGraphics.closePath();
      this.airGraphics.fill();

      // Carpet bombs falling in succession along the path
      const bombCount = cfg.bombsPerWave || 9;
      const triggerIndex = Math.floor(progress * bombCount);

      while (this.airstrikeBombsDropped < triggerIndex && this.airstrikeBombsDropped < bombCount) {
        const bp = (this.airstrikeBombsDropped + 0.5) / bombCount;
        const bx = line.x1 + (line.x2 - line.x1) * bp;
        const by = line.y1 + (line.y2 - line.y1) * bp;

        this.detonateCarpetBomb(bx, by, cfg, kaiju);
        this.airstrikeBombsDropped++;
      }

      if (this.airstrikePhaseTimer <= 0 || progress >= 1.0) {
        // Drop any remaining bombs
        while (this.airstrikeBombsDropped < bombCount) {
          const bp = (this.airstrikeBombsDropped + 0.5) / bombCount;
          const bx = line.x1 + (line.x2 - line.x1) * bp;
          const by = line.y1 + (line.y2 - line.y1) * bp;
          this.detonateCarpetBomb(bx, by, cfg, kaiju);
          this.airstrikeBombsDropped++;
        }

        // Delay before next wave
        this.airstrikePhase = 'waiting';
        this.airstrikePhaseTimer = cfg.waveInterval || 3.5;
      }
    } else if (this.airstrikePhase === 'waiting') {
      this.airstrikePhaseTimer -= dt;
      if (this.airstrikePhaseTimer <= 0) {
        this.startNextAirstrikeWave(kaiju, cfg);
      }
    }
  }

  /**
   * Detonates an individual carpet bomb crater
   */
  detonateCarpetBomb(bx, by, cfg, kaiju) {
    const pm = this.scene.particleManager;
    if (pm) {
      pm.emitDebris(bx, by, 0xf97316, 12, 60);
      pm.emitCollapseFlash(bx, by, 26);
      pm.emitDust(bx, by, 4, 1.2);
    }

    // Demolish buildings in blast area
    if (this.enemyManager) {
      this.enemyManager.blastGroundArea(bx, by, cfg.bombExplosionRadius, cfg.bombBuildingDamage);
    }

    // Collateral damage to enemies caught in blast
    if (this.enemyManager) {
      this.enemyManager.queryEnemiesInRadius(bx, by, cfg.bombExplosionRadius, (idx) => {
        if (this.enemyManager.active[idx] && this.enemyManager.type[idx] !== ENEMY_TYPES.BOSS) {
          this.enemyManager.damageEnemy(idx, 40);
        }
      });
    }

    // Check Kaiju hit
    if (kaiju) {
      const dKaiju = Math.hypot(kaiju.x - bx, kaiju.y - by);
      if (dKaiju <= cfg.bombExplosionRadius + 16 * kaiju.currentScale) {
        kaiju.takeDamage(cfg.bombDamageKaiju);
        this.kaijuHitDuringAirstrike = true;
      }
    }
  }

  // =========================================================================
  // EVENT 3: MASS EVACUATION
  // =========================================================================
  initEvacuation(kaiju, cfg) {
    const kx = kaiju ? kaiju.x : 2000;
    const ky = kaiju ? kaiju.y : 2000;

    // Search for a walkable road intersection 240-340 px from Kaiju
    let foundX = kx + 260;
    let foundY = ky;

    if (this.navGrid) {
      const candidateAngles = [0, Math.PI * 0.5, Math.PI, Math.PI * 1.5, Math.PI * 0.25, Math.PI * 0.75];
      for (const ang of candidateAngles) {
        const tx = kx + Math.cos(ang) * 280;
        const ty = ky + Math.sin(ang) * 280;
        if (tx >= 120 && tx <= this.scene.worldWidth - 120 && ty >= 120 && ty <= this.scene.worldHeight - 120) {
          if (this.navGrid.isWalkable(tx, ty, false)) {
            foundX = tx;
            foundY = ty;
            break;
          }
        }
      }
    }

    this.evacX = foundX;
    this.evacY = foundY;
    this.evacSpawnTimer = 0;
    this.evacCitizensSpawned = 0;

    // Initial police escort units near evacuation point
    for (let p = 0; p < cfg.policeEscortCount; p++) {
      const px = this.evacX + this.prng.range(-30, 30);
      const py = this.evacY + this.prng.range(-30, 30);
      this.enemyManager.spawnEnemy(ENEMY_TYPES.POLICE, px, py, 0);
    }
  }

  updateEvacuation(dt, kaiju) {
    const cfg = EVENT_CONFIG.events.EVACUATION;
    this.groundGraphics.clear();

    // 1. Draw glowing green Evacuation Zone circle on ground
    const pulse = 0.8 + 0.2 * Math.sin(this.scene.time.now * 0.008);
    const r = cfg.zoneRadius * pulse;
    this.groundGraphics.lineStyle(3, 0x10b981, 0.9);
    this.groundGraphics.strokeCircle(this.evacX, this.evacY, r);
    this.groundGraphics.fillStyle(0x10b981, 0.20 * pulse);
    this.groundGraphics.fillCircle(this.evacX, this.evacY, r);

    // Evac cross marker in center
    this.groundGraphics.fillStyle(0xffffff, 0.9);
    this.groundGraphics.fillRect(this.evacX - 10, this.evacY - 2, 20, 4);
    this.groundGraphics.fillRect(this.evacX - 2, this.evacY - 10, 4, 20);

    // 2. Spawn continuous waves of fleeing citizens
    this.evacSpawnTimer -= dt;
    if (this.evacSpawnTimer <= 0 && this.evacCitizensSpawned < cfg.maxCitizensTotal) {
      this.evacSpawnTimer = cfg.spawnInterval || 1.2;
      const waveSize = cfg.citizensPerWave || 8;

      for (let w = 0; w < waveSize; w++) {
        if (this.enemyManager.activeCount >= this.enemyManager.maxEnemies - 10) break;

        // Spawn citizens outside evacuation point running toward it
        const ang = this.prng.range(0, Math.PI * 2);
        const dist = this.prng.range(160, 260);
        const sx = this.evacX + Math.cos(ang) * dist;
        const sy = this.evacY + Math.sin(ang) * dist;

        if (sx >= 60 && sx <= this.scene.worldWidth - 60 && sy >= 60 && sy <= this.scene.worldHeight - 60) {
          const idx = this.enemyManager.spawnEnemy(ENEMY_TYPES.CITIZEN, sx, sy, ang + Math.PI);
          if (idx >= 0) {
            this.evacCitizensSpawned++;
            // Tag citizen to give bonus XP when killed
            this.enemyManager.subType[idx] = 99; // 99 = marked as Evacuee
          }
        }
      }
    }

    // 3. Check if citizens entered the evacuation zone to safely escape
    const zoneR2 = cfg.zoneRadius * cfg.zoneRadius;
    this.enemyManager.queryEnemiesInRadius(this.evacX, this.evacY, cfg.zoneRadius, (idx, dx, dy, d2) => {
      if (this.enemyManager.active[idx] && this.enemyManager.type[idx] === ENEMY_TYPES.CITIZEN) {
        if (d2 <= zoneR2) {
          // Citizen safely evacuated!
          const ex = this.enemyManager.x[idx];
          const ey = this.enemyManager.y[idx];
          this.scene.particleManager.emitDebris(ex, ey, 0x10b981, 2, 20);
          this.enemyManager.despawnEnemy(idx);
        }
      }
    });

    // 4. Timer expiry
    if (this.eventTimer <= 0) {
      if (this.scene.uiManager) {
        this.scene.uiManager.showEventBanner('EVAKUASI SELESAI', 'Zona evakuasi ditutup! Warga yang tersisa berhamburan.', 2500);
      }
      this.stopCurrentEvent(true);
    }
  }

  // =========================================================================
  // LIFECYCLE & CLEANUP
  // =========================================================================
  /**
   * Stops the current active event and cleans up graphics
   */
  stopCurrentEvent(isNaturalEnd = false) {
    this.activeEvent = null;
    this.eventTimer = 0;
    this.groundGraphics.clear();
    this.airGraphics.clear();
    this.convoyIndices = [];
    this.airstrikeLine = null;
    this.airstrikePhase = 'idle';
  }

  /**
   * Resets entire event system (called on Kaiju respawn or city restart)
   */
  reset() {
    this.stopCurrentEvent(false);
    this.cooldownTimer = EVENT_CONFIG.firstEventDelaySeconds;
    this.debugRotationIndex = 0;
  }

  /**
   * Debug shortcut [G] key: triggers next event in rotation immediately
   */
  triggerNextEvent(kaiju) {
    const list = ['MILITARY_CONVOY', 'AIRSTRIKE', 'EVACUATION'];
    const chosen = list[this.debugRotationIndex % list.length];
    this.debugRotationIndex++;
    this.startEvent(chosen, kaiju);
    return chosen;
  }

  /**
   * Returns active event telemetry for UI and Minimap
   */
  getTelemetry() {
    return {
      activeEvent: this.activeEvent,
      eventTimer: Math.max(0, Math.ceil(this.eventTimer)),
      cooldownTimer: Math.max(0, Math.ceil(this.cooldownTimer)),
      updateTimeMs: this.lastUpdateTimeMs,
      evacX: this.evacX,
      evacY: this.evacY,
      airstrikeLine: this.airstrikeLine
    };
  }
}
