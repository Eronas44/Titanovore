import Phaser from 'phaser';
import { BOSS_CONFIG } from '../config/boss.js';
import { CELL_TYPES } from '../world/CityGrid.js';
import { ENEMY_TYPES } from './EnemyManager.js';
import { XP_CONFIG } from '../config/xp.js';

/**
 * Boss.js - Tahap 5B-1: Mech-Titan
 * Implements the colossal military cyborg boss featuring:
 * - 3 Combat phases (100-66%, 66-33%, 33-0% HP) with distinct attack telegraphs
 * - 5 Telegraph-driven attacks: Stomp, Cannon Salvo, Missile Rain, Call Drones, Sweeping Laser
 * - Phase 3 Enrage mode (faster movement, shorter cooldowns, double attacks)
 * - Footprint building demolition (crushes city cells, never gets stuck)
 * - Safe pooled projectiles (max 40) and zero-overhead graphics batches
 * - Robust cleanup on Kaiju death, respawn, and scene reload
 * - Sound hooks for audio integration
 */
export class Boss {
  /**
   * @param {Phaser.Scene} scene 
   * @param {number} startX 
   * @param {number} startY 
   * @param {number} bossIndexInRun - 1 for 1st boss, 2 for 2nd, etc.
   */
  constructor(scene, startX, startY, bossIndexInRun = 1) {
    this.scene = scene;
    this.x = startX;
    this.y = startY;
    this.targetX = startX;
    this.targetY = startY;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.bossIndexInRun = bossIndexInRun;

    // Scaling based on n-th boss
    const hpScale = Math.pow(BOSS_CONFIG.hpScalePerBoss, bossIndexInRun - 1);
    const dmgScale = Math.pow(BOSS_CONFIG.damageScalePerBoss, bossIndexInRun - 1);
    this.maxHp = Math.round(BOSS_CONFIG.baseHp * hpScale);
    this.hp = this.maxHp;
    this.damageMultiplier = dmgScale;

    this.size = BOSS_CONFIG.size; // 56x56 px
    this.hitRadius = BOSS_CONFIG.hitRadius; // 28 px
    this.speed = BOSS_CONFIG.baseSpeed;
    this.isAlive = true;
    this.isSpawning = true;
    this.spawnTimer = BOSS_CONFIG.invulnerableEntryDuration;
    this.invulnerable = true;
    this.phase = 1;
    this.isEnraged = false;

    // State machine: 'idle' | 'telegraph' | 'executing' | 'recovery' | 'phase_transition' | 'dying'
    this.state = 'idle';
    this.currentAttack = null;
    this.lastAttackType = null;
    this.stateTimer = 1.2; // Initial grace period after entrance

    // Timers
    this.damageFlashTimer = 0;
    this.buildingCrushTimer = 0;
    this.walkAnimTimer = 0;
    this.walkAnimStep = 0; // alternating feet
    this.phaseRoarTimer = 0;
    this.deathTimer = 0;
    this.lastUpdateTimeMs = 0;

    // Sub-attack execution counters
    this.cannonShotsFired = 0;
    this.cannonIntervalTimer = 0;
    this.sweepingLaserTimer = 0;
    this.sweepingLaserStartAngle = 0;
    this.sweepingLaserCurrentAngle = 0;
    this.isDoubleAttackPending = false;

    // 1. Graphics Batches for Visuals & Attacks
    this.shadowGraphics = this.scene.add.graphics().setDepth(11);
    this.telegraphGraphics = this.scene.add.graphics().setDepth(13); // Beneath Boss, above ground
    this.bodyGraphics = this.scene.add.graphics().setDepth(16); // Boss body
    this.attackGraphics = this.scene.add.graphics().setDepth(22); // Projectiles & Lasers

    // 2. Pre-allocated Projectile Pool (Max 40)
    this.maxProjectiles = BOSS_CONFIG.maxProjectiles;
    this.projActive = new Uint8Array(this.maxProjectiles);
    this.projType = new Uint8Array(this.maxProjectiles); // 1 = Cannon, 2 = Missile, 3 = Shockwave
    this.projX = new Float32Array(this.maxProjectiles);
    this.projY = new Float32Array(this.maxProjectiles);
    this.projVx = new Float32Array(this.maxProjectiles);
    this.projVy = new Float32Array(this.maxProjectiles);
    this.projTargetX = new Float32Array(this.maxProjectiles);
    this.projTargetY = new Float32Array(this.maxProjectiles);
    this.projLife = new Float32Array(this.maxProjectiles);
    this.projMaxLife = new Float32Array(this.maxProjectiles);
    this.projDamage = new Float32Array(this.maxProjectiles);
    this.projRadius = new Float32Array(this.maxProjectiles);

    // 3. Register in EnemyManager so weapons track and target Mech-Titan
    if (this.scene.enemyManager && typeof this.scene.enemyManager.registerBoss === 'function') {
      this.scene.enemyManager.registerBoss(this);
    }
  }

  // =========================================================================
  // AUDIO HOOKS (Extensible for future sound engine)
  // =========================================================================
  playAudioHook(type, details = null) {
    if (this.scene && this.scene.sound && typeof this.scene.sound.play === 'function') {
      try {
        if (this.scene.sound.get(type)) {
          this.scene.sound.play(type);
          return;
        }
      } catch (e) {
        // Safe silent fallback
      }
    }
  }

  // =========================================================================
  // DAMAGE & HEALTH MANAGEMENT
  // =========================================================================
  /**
   * Applies damage to Boss from player weapons (ground or air)
   * @param {number} amount 
   * @param {boolean} canHitAir 
   * @returns {boolean} true if hit registered
   */
  takeDamage(amount, canHitAir = false) {
    if (!this.isAlive || this.invulnerable || this.state === 'dying') {
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.damageFlashTimer = 0.08; // Brief white flash

    // Check Phase Transitions
    const hpRatio = this.hp / this.maxHp;
    if (this.phase === 1 && hpRatio <= BOSS_CONFIG.phases.phase2.minHpRatio) {
      this.triggerPhaseTransition(2);
    } else if (this.phase === 2 && hpRatio <= BOSS_CONFIG.phases.phase3.minHpRatio) {
      this.triggerPhaseTransition(3);
    }

    // Death Trigger
    if (this.hp <= 0) {
      this.triggerDeath();
    }

    return true;
  }

  /**
   * Triggers dramatic phase transition
   * @param {number} newPhase 
   */
  triggerPhaseTransition(newPhase) {
    this.phase = newPhase;
    this.state = 'phase_transition';
    this.phaseRoarTimer = 1.25;
    this.stateTimer = 1.25;
    this.currentAttack = null;
    this.telegraphGraphics.clear();

    if (newPhase === 3) {
      this.isEnraged = true;
      this.speed = BOSS_CONFIG.baseSpeed * BOSS_CONFIG.enrageSpeedMultiplier;
    }

    // Visual Roar & Shockwave
    this.playAudioHook('boss_roar', { phase: newPhase });
    this.scene.cameras.main.shake(350, 0.012);

    if (this.scene.uiManager) {
      const pName = newPhase === 2 ? 'FASE 2 · ESKALASI ANCAMAN' : 'FASE 3 · MODE MARAH AKTIF!';
      this.scene.uiManager.showEventBanner('MECH-TITAN', pName, 2200);
      this.scene.uiManager.triggerRedVignetteFlash(500);
    }

    if (this.scene.particleManager) {
      this.scene.particleManager.emitCollapseFlash(this.x, this.y, 40);
      this.scene.particleManager.emitDebris(this.x, this.y, 0xef4444, 16, 80);
    }
  }

  // =========================================================================
  // MAIN UPDATE LOOP
  // =========================================================================
  update(dt, kaiju) {
    const t0 = performance.now();
    try {
      if (!this.isAlive && this.state !== 'dying') return;

      // 1. Spawning / Entry Animation Walk
      if (this.isSpawning) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
          this.isSpawning = false;
          this.invulnerable = false;
        }
      }

      // 2. Damage Flash Timer
      if (this.damageFlashTimer > 0) {
        this.damageFlashTimer = Math.max(0, this.damageFlashTimer - dt);
      }

      // 3. Update Dying Sequence
      if (this.state === 'dying') {
        this.updateDeathSequence(dt);
        this.render();
        this.lastUpdateTimeMs = performance.now() - t0;
        return;
      }

      // 4. Movement & Orientation towards Kaiju
      this.updateMovement(dt, kaiju);

      // 5. Footprint Building Demolition (Never Stuck)
      this.buildingCrushTimer += dt;
      if (this.buildingCrushTimer >= BOSS_CONFIG.buildingCrushInterval) {
        this.buildingCrushTimer = 0;
        this.crushFootprintBuildings();
      }

      // 6. Combat State Machine
      this.updateCombatStateMachine(dt, kaiju);

      // 7. Update Projectiles & Telegraphs
      this.updateProjectiles(dt, kaiju);

      // 8. Render Composite Mech Graphics
      this.render();

      // 9. Sync coordinates to EnemyManager for weapon collision
      if (this.scene.enemyManager && this.scene.enemyManager.bossIndex !== undefined) {
        const bIdx = this.scene.enemyManager.bossIndex;
        if (bIdx >= 0) {
          this.scene.enemyManager.x[bIdx] = this.x;
          this.scene.enemyManager.y[bIdx] = this.y;
          this.scene.enemyManager.hp[bIdx] = this.hp;
        }
      }
    } catch (err) {
      console.error('[Boss] Update loop error:', err);
    }

    this.lastUpdateTimeMs = performance.now() - t0;
  }

  // =========================================================================
  // MOVEMENT & PATHFINDING
  // =========================================================================
  updateMovement(dt, kaiju) {
    if (!kaiju) return;

    // Face towards Kaiju
    const dx = kaiju.x - this.x;
    const dy = kaiju.y - this.y;
    const distToKaiju = Math.hypot(dx, dy);
    const targetAngle = Math.atan2(dy, dx);
    this.rotation = Phaser.Math.Angle.RotateTo(this.rotation, targetAngle, 3.2 * dt);

    // Can only walk during idle or recovery states (stops to telegraph/execute attacks)
    const canMove = this.state === 'idle' || this.state === 'recovery' || this.isSpawning;
    if (!canMove || distToKaiju < 75) {
      this.vx = 0;
      this.vy = 0;
      return;
    }

    let moveX = Math.cos(targetAngle);
    let moveY = Math.sin(targetAngle);

    // Query vehicle flow field from NavGrid if available
    if (this.scene.navGrid && typeof this.scene.navGrid.getVehicleFlowVector === 'function') {
      const flow = this.scene.navGrid.getVehicleFlowVector(this.x, this.y);
      if (flow && (flow.vx !== 0 || flow.vy !== 0)) {
        // Blend 60% flow field + 40% direct Kaiju heading
        moveX = flow.vx * 0.6 + moveX * 0.4;
        moveY = flow.vy * 0.6 + moveY * 0.4;
        const len = Math.hypot(moveX, moveY);
        if (len > 0) {
          moveX /= len;
          moveY /= len;
        }
      }
    }

    const curSpeed = this.speed * (this.isSpawning ? 1.2 : 1.0);
    this.vx = moveX * curSpeed;
    this.vy = moveY * curSpeed;

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Bounds clamp
    this.x = Phaser.Math.Clamp(this.x, 30, this.scene.cityGrid.worldWidth - 30);
    this.y = Phaser.Math.Clamp(this.y, 30, this.scene.cityGrid.worldHeight - 30);

    // Walk cycle animation
    this.walkAnimTimer += dt * (curSpeed / 20);
    this.walkAnimStep = Math.sin(this.walkAnimTimer);
  }

  /**
   * Crushes all building cells under the Mech's massive 56x56 footprint
   */
  crushFootprintBuildings() {
    const cg = this.scene.cityGrid;
    if (!cg) return;

    const cellSize = cg.cellSize || 4;
    const halfSize = this.size / 2;
    const minCol = Math.max(0, Math.floor((this.x - halfSize) / cellSize));
    const maxCol = Math.min(cg.cols - 1, Math.floor((this.x + halfSize) / cellSize));
    const minRow = Math.max(0, Math.floor((this.y - halfSize) / cellSize));
    const maxRow = Math.min(cg.rows - 1, Math.floor((this.y + halfSize) / cellSize));

    let crushedAny = false;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        const idx = r * cg.cols + c;
        const cType = cg.types[idx];
        if (cType === CELL_TYPES.BUILDING || cType === CELL_TYPES.BUILDING_DETAIL || cType === CELL_TYPES.INDUSTRIAL) {
          const res = cg.damageCell(c, r, 20);
          if (res && res.destroyed) {
            crushedAny = true;
            const worldPos = cg.gridToWorld(c, r);
            if (this.scene.onCellDestroyed) {
              this.scene.onCellDestroyed({ col: c, row: r, worldX: worldPos.x, worldY: worldPos.y }, res.building, true);
            }
          }
        }
      }
    }

    if (crushedAny && this.scene.particleManager) {
      this.scene.particleManager.emitDust(this.x, this.y, 3, 1.0);
    }
  }

  // =========================================================================
  // COMBAT STATE MACHINE & ATTACK ROUTING
  // =========================================================================
  updateCombatStateMachine(dt, kaiju) {
    if (this.isSpawning || !kaiju) return;

    this.stateTimer -= dt;

    switch (this.state) {
      case 'idle':
        if (this.stateTimer <= 0) {
          this.pickNextAttack(kaiju);
        }
        break;

      case 'telegraph':
        this.renderTelegraph(kaiju);
        if (this.stateTimer <= 0) {
          this.executeCurrentAttack(kaiju);
        }
        break;

      case 'executing':
        this.updateAttackExecution(dt, kaiju);
        break;

      case 'recovery':
        this.telegraphGraphics.clear();
        if (this.stateTimer <= 0) {
          if (this.isDoubleAttackPending) {
            this.isDoubleAttackPending = false;
            this.pickNextAttack(kaiju);
          } else {
            this.state = 'idle';
            const minCd = this.isEnraged ? BOSS_CONFIG.enrageCooldownMin : BOSS_CONFIG.attackCooldownMin;
            const maxCd = this.isEnraged ? BOSS_CONFIG.enrageCooldownMax : BOSS_CONFIG.attackCooldownMax;
            this.stateTimer = Phaser.Math.FloatBetween(minCd, maxCd);
          }
        }
        break;

      case 'phase_transition':
        this.phaseRoarTimer -= dt;
        if (this.phaseRoarTimer <= 0) {
          this.state = 'idle';
          this.stateTimer = 0.6;
        }
        break;
    }
  }

  /**
   * Weighted attack picker that guarantees no immediate repeat
   */
  pickNextAttack(kaiju) {
    const candidates = [];

    // Phase 1 Attacks
    candidates.push({ type: 'stomp', weight: 45 });
    candidates.push({ type: 'cannon_salvo', weight: 55 });

    // Phase 2 Attacks
    if (this.phase >= 2) {
      candidates.push({ type: 'missile_rain', weight: 50 });
      candidates.push({ type: 'call_drones', weight: 35 });
    }

    // Phase 3 Attacks
    if (this.phase >= 3) {
      candidates.push({ type: 'sweeping_laser', weight: 55 });
    }

    // Filter out last attack to prevent immediate repetition
    let pool = candidates.filter(c => c.type !== this.lastAttackType);
    if (pool.length === 0) pool = candidates;

    let totalWeight = pool.reduce((acc, c) => acc + c.weight, 0);
    let rand = Math.random() * totalWeight;
    let chosen = pool[0].type;

    for (const c of pool) {
      rand -= c.weight;
      if (rand <= 0) {
        chosen = c.type;
        break;
      }
    }

    this.lastAttackType = chosen;
    this.currentAttack = chosen;
    this.state = 'telegraph';

    // Set telegraph duration based on attack config
    switch (chosen) {
      case 'stomp':
        this.stateTimer = BOSS_CONFIG.stomp.telegraphDuration;
        this.playAudioHook('stomp_telegraph');
        break;
      case 'cannon_salvo':
        this.stateTimer = BOSS_CONFIG.cannonSalvo.telegraphDuration;
        this.playAudioHook('cannon_charge');
        break;
      case 'missile_rain':
        this.stateTimer = BOSS_CONFIG.missileRain.telegraphDuration;
        this.playAudioHook('missile_launch');
        this.cacheMissileTargets(kaiju);
        break;
      case 'call_drones':
        this.stateTimer = BOSS_CONFIG.callDrones.telegraphDuration;
        this.playAudioHook('drone_call');
        break;
      case 'sweeping_laser':
        this.stateTimer = BOSS_CONFIG.sweepingLaser.telegraphDuration;
        this.sweepingLaserStartAngle = this.rotation - Phaser.Math.DegToRad(BOSS_CONFIG.sweepingLaser.arcDegrees / 2);
        this.playAudioHook('laser_charge');
        break;
    }

    this.telegraphDuration = this.stateTimer;
  }

  // =========================================================================
  // TELEGRAPH RENDERING
  // =========================================================================
  renderTelegraph(kaiju) {
    this.telegraphGraphics.clear();
    const progress = 1.0 - (this.stateTimer / (this.telegraphDuration || 1.0));

    switch (this.currentAttack) {
      case 'stomp': {
        const r = BOSS_CONFIG.stomp.radius;
        // Outer pulsing red circle
        this.telegraphGraphics.lineStyle(2, 0xef4444, 0.85);
        this.telegraphGraphics.strokeCircle(this.x, this.y, r);
        // Expanding inner fill representing countdown
        this.telegraphGraphics.fillStyle(0xef4444, 0.25);
        this.telegraphGraphics.fillCircle(this.x, this.y, r * progress);
        break;
      }

      case 'cannon_salvo': {
        // Red dashed line from cannon arm to Kaiju
        const angle = this.rotation;
        const armX = this.x + Math.cos(angle + 0.6) * 26;
        const armY = this.y + Math.sin(angle + 0.6) * 26;
        const targetX = kaiju.x;
        const targetY = kaiju.y;

        this.telegraphGraphics.lineStyle(1.5, 0xf97316, 0.4 + progress * 0.5);
        this.telegraphGraphics.lineBetween(armX, armY, targetX, targetY);
        this.telegraphGraphics.lineStyle(3, 0xef4444, 0.8);
        this.telegraphGraphics.strokeCircle(targetX, targetY, BOSS_CONFIG.cannonSalvo.blastRadius);
        break;
      }

      case 'missile_rain': {
        if (!this.cachedMissiles) break;
        for (const m of this.cachedMissiles) {
          this.telegraphGraphics.lineStyle(2, 0xf43f5e, 0.8);
          this.telegraphGraphics.strokeCircle(m.x, m.y, BOSS_CONFIG.missileRain.blastRadius);
          this.telegraphGraphics.fillStyle(0xf43f5e, 0.2 + progress * 0.3);
          this.telegraphGraphics.fillCircle(m.x, m.y, BOSS_CONFIG.missileRain.blastRadius * progress);
          // Crosshairs
          this.telegraphGraphics.lineBetween(m.x - 6, m.y, m.x + 6, m.y);
          this.telegraphGraphics.lineBetween(m.x, m.y - 6, m.x, m.y + 6);
        }
        break;
      }

      case 'call_drones': {
        this.telegraphGraphics.lineStyle(2, 0x38bdf8, 0.8);
        this.telegraphGraphics.strokeCircle(this.x, this.y, BOSS_CONFIG.callDrones.droneSpawnRadius * progress);
        break;
      }

      case 'sweepingLaser':
      case 'sweeping_laser': {
        const reach = BOSS_CONFIG.sweepingLaser.range;
        const arc = Phaser.Math.DegToRad(BOSS_CONFIG.sweepingLaser.arcDegrees);
        const startA = this.rotation - arc / 2;
        const endA = this.rotation + arc / 2;

        // Thin preview cone
        this.telegraphGraphics.lineStyle(1.5, 0xff1e42, 0.4 + progress * 0.5);
        this.telegraphGraphics.beginPath();
        this.telegraphGraphics.moveTo(this.x, this.y);
        this.telegraphGraphics.lineTo(this.x + Math.cos(startA) * reach, this.y + Math.sin(startA) * reach);
        this.telegraphGraphics.arc(this.x, this.y, reach, startA, endA);
        this.telegraphGraphics.closePath();
        this.telegraphGraphics.strokePath();
        this.telegraphGraphics.fillStyle(0xff1e42, 0.12 * progress);
        this.telegraphGraphics.fillPath();
        break;
      }
    }
  }

  cacheMissileTargets(kaiju) {
    this.cachedMissiles = [];
    const count = BOSS_CONFIG.missileRain.missileCount;
    const spread = BOSS_CONFIG.missileRain.spreadRadius;

    // First missile directly aims at Kaiju position
    this.cachedMissiles.push({ x: kaiju.x, y: kaiju.y });

    // Remaining missiles scattered in radius around Kaiju
    for (let i = 1; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * spread;
      this.cachedMissiles.push({
        x: kaiju.x + Math.cos(angle) * dist,
        y: kaiju.y + Math.sin(angle) * dist
      });
    }
  }

  // =========================================================================
  // ATTACK EXECUTION
  // =========================================================================
  executeCurrentAttack(kaiju) {
    this.telegraphGraphics.clear();
    this.state = 'executing';

    switch (this.currentAttack) {
      case 'stomp':
        this.executeStomp(kaiju);
        break;

      case 'cannon_salvo':
        this.cannonShotsFired = 0;
        this.cannonIntervalTimer = 0;
        this.stateTimer = 0.8;
        break;

      case 'missile_rain':
        this.executeMissileRain();
        this.stateTimer = 0.5;
        break;

      case 'call_drones':
        this.executeCallDrones();
        this.stateTimer = 0.4;
        break;

      case 'sweepingLaser':
      case 'sweeping_laser':
        this.sweepingLaserTimer = BOSS_CONFIG.sweepingLaser.sweepDuration;
        this.stateTimer = BOSS_CONFIG.sweepingLaser.sweepDuration;
        this.playAudioHook('laser_fire');
        break;
    }
  }

  updateAttackExecution(dt, kaiju) {
    switch (this.currentAttack) {
      case 'stomp':
        // Stomp executes instantly in 1 frame
        this.finishAttackExecution();
        break;

      case 'cannon_salvo': {
        this.cannonIntervalTimer -= dt;
        const maxShots = this.phase >= 2 ? BOSS_CONFIG.cannonSalvo.shotCountPhase2 : BOSS_CONFIG.cannonSalvo.shotCountPhase1;

        if (this.cannonIntervalTimer <= 0 && this.cannonShotsFired < maxShots) {
          this.cannonIntervalTimer = BOSS_CONFIG.cannonSalvo.shotInterval;
          this.fireCannonShot(kaiju);
          this.cannonShotsFired++;
        }

        if (this.cannonShotsFired >= maxShots) {
          this.finishAttackExecution();
        }
        break;
      }

      case 'missile_rain':
      case 'call_drones':
        if (this.stateTimer <= 0) {
          this.finishAttackExecution();
        }
        break;

      case 'sweepingLaser':
      case 'sweeping_laser': {
        this.sweepingLaserTimer -= dt;
        const totalDuration = BOSS_CONFIG.sweepingLaser.sweepDuration;
        const progress = 1.0 - (this.sweepingLaserTimer / totalDuration);
        const arc = Phaser.Math.DegToRad(BOSS_CONFIG.sweepingLaser.arcDegrees);
        this.sweepingLaserCurrentAngle = this.sweepingLaserStartAngle + (arc * progress);

        this.applySweepingLaserDamage(dt, kaiju);

        if (this.sweepingLaserTimer <= 0) {
          this.finishAttackExecution();
        }
        break;
      }
    }
  }

  finishAttackExecution() {
    this.state = 'recovery';
    this.stateTimer = this.isEnraged ? 0.8 : 1.2;

    // Chance of double attack in enrage mode
    if (this.isEnraged && Math.random() < BOSS_CONFIG.enrageDoubleAttackChance) {
      this.isDoubleAttackPending = true;
      this.stateTimer = 0.35; // Minimal pause before next attack
    }
  }

  // 1. Stomp Attack
  executeStomp(kaiju) {
    this.playAudioHook('stomp_impact');
    const r = BOSS_CONFIG.stomp.radius;
    const damage = BOSS_CONFIG.stomp.damage * this.damageMultiplier;

    // Camera shake
    this.scene.cameras.main.shake(220, 0.009);

    // Spawn expanding shockwave projectile
    this.spawnProjectile(3, this.x, this.y, 0, 0, this.x, this.y, 0.35, damage, r);

    // Damage buildings in radius
    if (this.scene.enemyManager && typeof this.scene.enemyManager.blastGroundArea === 'function') {
      this.scene.enemyManager.blastGroundArea(this.x, this.y, r, BOSS_CONFIG.stomp.buildingDamage);
    }

    // Direct Kaiju hit test
    const distToKaiju = Math.hypot(kaiju.x - this.x, kaiju.y - this.y);
    if (distToKaiju <= r) {
      kaiju.takeDamage(damage);
    }
  }

  // 2. Cannon Salvo
  fireCannonShot(kaiju) {
    this.playAudioHook('cannon_fire');
    const angle = this.rotation;
    const armX = this.x + Math.cos(angle + 0.6) * 26;
    const armY = this.y + Math.sin(angle + 0.6) * 26;

    // Lead target slightly
    const targetX = kaiju.x + (kaiju.vx || 0) * 0.2;
    const targetY = kaiju.y + (kaiju.vy || 0) * 0.2;
    const toAngle = Math.atan2(targetY - armY, targetX - armX);
    const spd = BOSS_CONFIG.cannonSalvo.bulletSpeed;

    const vx = Math.cos(toAngle) * spd;
    const vy = Math.sin(toAngle) * spd;
    const life = Math.hypot(targetX - armX, targetY - armY) / spd;
    const damage = BOSS_CONFIG.cannonSalvo.damage * this.damageMultiplier;

    this.spawnProjectile(1, armX, armY, vx, vy, targetX, targetY, life, damage, BOSS_CONFIG.cannonSalvo.blastRadius);

    if (this.scene.particleManager) {
      this.scene.particleManager.emitDebris(armX, armY, 0xf97316, 4, 35);
    }
  }

  // 3. Missile Rain
  executeMissileRain() {
    if (!this.cachedMissiles) return;
    const damage = BOSS_CONFIG.missileRain.damage * this.damageMultiplier;

    for (const m of this.cachedMissiles) {
      // Missile starts high above and drops down to target
      const startX = m.x + Phaser.Math.FloatBetween(-40, 40);
      const startY = m.y - 280;
      const spd = BOSS_CONFIG.missileRain.missileSpeed;
      const angle = Math.atan2(m.y - startY, m.x - startX);
      const vx = Math.cos(angle) * spd;
      const vy = Math.sin(angle) * spd;
      const life = Math.hypot(m.x - startX, m.y - startY) / spd;

      this.spawnProjectile(2, startX, startY, vx, vy, m.x, m.y, life, damage, BOSS_CONFIG.missileRain.blastRadius);
    }
  }

  // 4. Call Drones
  executeCallDrones() {
    if (!this.scene.enemyManager || typeof this.scene.enemyManager.spawnEnemy !== 'function') return;

    const count = Phaser.Math.Between(BOSS_CONFIG.callDrones.droneCountMin, BOSS_CONFIG.callDrones.droneCountMax);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const sx = this.x + Math.cos(angle) * BOSS_CONFIG.callDrones.droneSpawnRadius;
      const sy = this.y + Math.sin(angle) * BOSS_CONFIG.callDrones.droneSpawnRadius;
      this.scene.enemyManager.spawnEnemy(ENEMY_TYPES.DRONE, sx, sy, angle);
    }
  }

  // 5. Sweeping Laser Damage & Building Carving
  applySweepingLaserDamage(dt, kaiju) {
    const angle = this.sweepingLaserCurrentAngle;
    const reach = BOSS_CONFIG.sweepingLaser.range;
    const endX = this.x + Math.cos(angle) * reach;
    const endY = this.y + Math.sin(angle) * reach;

    // Check collision with Kaiju
    const kx = kaiju.x;
    const ky = kaiju.y;
    const distToLine = Phaser.Math.Distance.Between(
      kx,
      ky,
      Phaser.Math.Clamp(kx, Math.min(this.x, endX), Math.max(this.x, endX)),
      Phaser.Math.Clamp(ky, Math.min(this.y, endY), Math.max(this.y, endY))
    );

    if (distToLine <= 20) {
      kaiju.takeDamage(BOSS_CONFIG.sweepingLaser.dps * this.damageMultiplier * dt);
    }

    // Carve building cells along line
    const cg = this.scene.cityGrid;
    if (cg) {
      const steps = Math.floor(reach / cg.cellSize);
      for (let s = 2; s < steps; s++) {
        const px = this.x + Math.cos(angle) * (s * cg.cellSize);
        const py = this.y + Math.sin(angle) * (s * cg.cellSize);
        const col = Math.floor(px / cg.cellSize);
        const row = Math.floor(py / cg.cellSize);
        if (col >= 0 && col < cg.cols && row >= 0 && row < cg.rows) {
          const res = cg.damageCell(col, row, BOSS_CONFIG.sweepingLaser.buildingDamagePerSec * dt);
          if (res && res.destroyed && this.scene.onCellDestroyed) {
            this.scene.onCellDestroyed({ col, row, worldX: px, worldY: py }, res.building, false);
          }
        }
      }
    }
  }

  // =========================================================================
  // PROJECTILE POOL & COLLISION
  // =========================================================================
  spawnProjectile(type, x, y, vx, vy, targetX, targetY, life, damage, radius) {
    let slot = -1;
    for (let i = 0; i < this.maxProjectiles; i++) {
      if (!this.projActive[i]) {
        slot = i;
        break;
      }
    }
    if (slot === -1) return;

    this.projActive[slot] = 1;
    this.projType[slot] = type;
    this.projX[slot] = x;
    this.projY[slot] = y;
    this.projVx[slot] = vx;
    this.projVy[slot] = vy;
    this.projTargetX[slot] = targetX;
    this.projTargetY[slot] = targetY;
    this.projLife[slot] = life;
    this.projMaxLife[slot] = life;
    this.projDamage[slot] = damage;
    this.projRadius[slot] = radius;
  }

  updateProjectiles(dt, kaiju) {
    this.attackGraphics.clear();

    // Render Sweeping Laser if currently executing
    if (this.state === 'executing' && (this.currentAttack === 'sweepingLaser' || this.currentAttack === 'sweeping_laser')) {
      const reach = BOSS_CONFIG.sweepingLaser.range;
      const endX = this.x + Math.cos(this.sweepingLaserCurrentAngle) * reach;
      const endY = this.y + Math.sin(this.sweepingLaserCurrentAngle) * reach;

      this.attackGraphics.lineStyle(8, 0xff1e42, 0.4);
      this.attackGraphics.lineBetween(this.x, this.y, endX, endY);
      this.attackGraphics.lineStyle(4, 0xf43f5e, 0.85);
      this.attackGraphics.lineBetween(this.x, this.y, endX, endY);
      this.attackGraphics.lineStyle(1.5, 0xffffff, 1.0);
      this.attackGraphics.lineBetween(this.x, this.y, endX, endY);
    }

    for (let i = 0; i < this.maxProjectiles; i++) {
      if (!this.projActive[i]) continue;

      this.projLife[i] -= dt;

      // Projectile reached end of life -> impact explosion!
      if (this.projLife[i] <= 0) {
        this.detonateProjectile(i, kaiju);
        this.projActive[i] = 0;
        continue;
      }

      this.projX[i] += this.projVx[i] * dt;
      this.projY[i] += this.projVy[i] * dt;

      const px = this.projX[i];
      const py = this.projY[i];
      const pType = this.projType[i];

      if (pType === 1) {
        // Cannon Shell
        this.attackGraphics.fillStyle(0xf97316, 1.0);
        this.attackGraphics.fillCircle(px, py, 4);
        this.attackGraphics.fillStyle(0xffedd5, 1.0);
        this.attackGraphics.fillCircle(px, py, 2);
      } else if (pType === 2) {
        // Missile
        this.attackGraphics.fillStyle(0xf43f5e, 1.0);
        this.attackGraphics.fillCircle(px, py, 3.5);
        if (Math.random() < 0.3 && this.scene.particleManager) {
          this.scene.particleManager.emitDust(px, py, 1, 0.3);
        }
      } else if (pType === 3) {
        // Expanding Shockwave
        const prog = 1.0 - (this.projLife[i] / this.projMaxLife[i]);
        const curR = this.projRadius[i] * prog;
        this.attackGraphics.lineStyle(3, 0xef4444, 1.0 - prog);
        this.attackGraphics.strokeCircle(px, py, curR);
      }
    }
  }

  detonateProjectile(idx, kaiju) {
    const px = this.projTargetX[idx] || this.projX[idx];
    const py = this.projTargetY[idx] || this.projY[idx];
    const r = this.projRadius[idx];
    const dmg = this.projDamage[idx];
    const pType = this.projType[idx];

    if (pType === 1 || pType === 2) {
      // Area explosion
      if (this.scene.particleManager) {
        this.scene.particleManager.emitCollapseFlash(px, py, r);
        this.scene.particleManager.emitDebris(px, py, 0xf97316, 6, 45);
      }

      // Damage buildings
      if (this.scene.enemyManager && typeof this.scene.enemyManager.blastGroundArea === 'function') {
        this.scene.enemyManager.blastGroundArea(px, py, r, 3.5);
      }

      // Hit Kaiju
      if (kaiju && Math.hypot(kaiju.x - px, kaiju.y - py) <= r + 15) {
        kaiju.takeDamage(dmg);
      }
    }
  }

  // =========================================================================
  // DEATH SEQUENCE & REWARDS
  // =========================================================================
  triggerDeath() {
    this.isAlive = false;
    this.state = 'dying';
    this.deathTimer = 1.6;
    this.telegraphGraphics.clear();
    this.attackGraphics.clear();

    // 1. Slow-motion cinematic
    this.scene.time.timeScale = 0.35;
    this.scene.time.delayedCall(BOSS_CONFIG.deathSlowMoDurationMs, () => {
      this.scene.time.timeScale = 1.0;
    });

    this.playAudioHook('boss_explosion');
    this.scene.cameras.main.shake(600, 0.018);

    if (this.scene.uiManager) {
      this.scene.uiManager.showEventBanner('MECH-TITAN TUMBANG', 'CYBORG MILITER KOTA TELAH DIHANCURKAN!', 3200);
      this.scene.uiManager.triggerRedVignetteFlash(800);
    }

    // 2. Clear unregister in EnemyManager
    if (this.scene.enemyManager && typeof this.scene.enemyManager.unregisterBoss === 'function') {
      this.scene.enemyManager.unregisterBoss();
    }
  }

  updateDeathSequence(dt) {
    this.deathTimer -= dt;

    // Staged explosions across body points
    if (Math.random() < 0.4 && this.scene.particleManager) {
      const ox = this.x + Phaser.Math.FloatBetween(-25, 25);
      const oy = this.y + Phaser.Math.FloatBetween(-25, 25);
      this.scene.particleManager.emitCollapseFlash(ox, oy, 22);
      this.scene.particleManager.emitDebris(ox, oy, 0xf97316, 8, 60);
    }

    if (this.deathTimer <= 0) {
      this.finalizeDeath();
    }
  }

  finalizeDeath() {
    // Grand explosion
    if (this.scene.particleManager) {
      this.scene.particleManager.emitCollapseFlash(this.x, this.y, BOSS_CONFIG.deathGrandExplosionRadius);
      this.scene.particleManager.emitDebris(this.x, this.y, 0xef4444, 30, 95);
      this.scene.particleManager.emitDust(this.x, this.y, 12, 2.0);
    }

    // Crush surrounding cells to rubble leaving metallic wreck
    if (this.scene.enemyManager && typeof this.scene.enemyManager.blastGroundArea === 'function') {
      this.scene.enemyManager.blastGroundArea(this.x, this.y, 36, 15);
    }

    // Drop large XP crystal shower
    if (this.scene.xpSystem && typeof this.scene.xpSystem.spawnCrystal === 'function') {
      const crystalCount = 10;
      const crystalXp = Math.round(BOSS_CONFIG.rewards.xpTotal / crystalCount);
      for (let i = 0; i < crystalCount; i++) {
        const ox = this.x + Phaser.Math.FloatBetween(-30, 30);
        const oy = this.y + Phaser.Math.FloatBetween(-30, 30);
        this.scene.xpSystem.spawnCrystal(ox, oy, crystalXp);
      }
    }

    // Award bonus score / scrap
    if (this.scene.stats) {
      this.scene.stats.xp += BOSS_CONFIG.rewards.xpTotal;
    }

    // Award Bonus Card Screen
    if (this.scene.cardSystem && typeof this.scene.cardSystem.queueBonusCardScreen === 'function') {
      this.scene.cardSystem.queueBonusCardScreen('MECH-TITAN TUMBANG');
    }

    // Clean destruction
    this.destroy();
  }

  // =========================================================================
  // RENDERING COMPOSITE MECH-TITAN
  // =========================================================================
  render() {
    this.shadowGraphics.clear();
    this.bodyGraphics.clear();

    if (!this.isAlive && this.state !== 'dying') return;

    // 1. Large Drop Shadow
    this.shadowGraphics.fillStyle(0x020617, 0.45);
    this.shadowGraphics.fillEllipse(this.x, this.y + 6, 60, 42);

    // 2. Alternating Mech Feet / Treads
    const angle = this.rotation;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const perpCos = Math.cos(angle + Math.PI / 2);
    const perpSin = Math.sin(angle + Math.PI / 2);

    const stepOffset = (this.walkAnimStep || 0) * 8;
    const footW = 12;
    const footH = 22;

    // Left Foot
    const lx = this.x - perpCos * 18 + cos * stepOffset;
    const ly = this.y - perpSin * 18 + sin * stepOffset;
    this.bodyGraphics.fillStyle(0x334155, 1.0);
    this.bodyGraphics.fillRoundedRect(lx - footW / 2, ly - footH / 2, footW, footH, 3);

    // Right Foot
    const rx = this.x + perpCos * 18 - cos * stepOffset;
    const ry = this.y + perpSin * 18 - sin * stepOffset;
    this.bodyGraphics.fillStyle(0x334155, 1.0);
    this.bodyGraphics.fillRoundedRect(rx - footW / 2, ry - footH / 2, footW, footH, 3);

    // 3. Main Steel Chassis
    const flash = this.damageFlashTimer > 0;
    const chassisColor = flash ? 0xffffff : (this.isEnraged ? 0x27202b : 0x1e293b);
    const borderColor = flash ? 0xffffff : 0x475569;

    this.bodyGraphics.lineStyle(2, borderColor, 1.0);
    this.bodyGraphics.fillStyle(chassisColor, 1.0);
    this.bodyGraphics.fillRoundedRect(this.x - 20, this.y - 18, 40, 36, 4);
    this.bodyGraphics.strokeRoundedRect(this.x - 20, this.y - 18, 40, 36, 4);

    // Hazard Stripes & Reactor Core on Chest
    const coreColor = this.isEnraged ? 0xf97316 : 0xef4444;
    this.bodyGraphics.fillStyle(coreColor, 0.85);
    this.bodyGraphics.fillRect(this.x - 6, this.y - 4, 12, 8);
    this.bodyGraphics.fillStyle(0xfbbf24, 1.0);
    this.bodyGraphics.fillRect(this.x - 3, this.y - 2, 6, 4);

    // 4. Arms
    // Left Arm: Heavy Hydraulic Hammer
    const hx = this.x - perpCos * 24;
    const hy = this.y - perpSin * 24;
    this.bodyGraphics.fillStyle(0x475569, 1.0);
    this.bodyGraphics.fillRect(hx - 5, hy - 8, 10, 16);
    this.bodyGraphics.fillStyle(0xea580c, 1.0);
    this.bodyGraphics.fillRect(hx - 8, hy + 4, 16, 8); // Hammer head

    // Right Arm: Quad-Barrel Heavy Cannon
    const cx = this.x + perpCos * 24;
    const cy = this.y + perpSin * 24;
    this.bodyGraphics.fillStyle(0x334155, 1.0);
    this.bodyGraphics.fillRect(cx - 5, cy - 8, 10, 16);
    this.bodyGraphics.fillStyle(0x0f172a, 1.0);
    this.bodyGraphics.fillRect(cx - 3, cy - 14, 6, 8); // Cannon barrels

    // 5. Sensor Visor / Head
    const headX = this.x + cos * 14;
    const headY = this.y + sin * 14;
    this.bodyGraphics.fillStyle(0x0f172a, 1.0);
    this.bodyGraphics.fillCircle(headX, headY, 7);
    // Glowing Red Monocular Visor
    this.bodyGraphics.fillStyle(0xef4444, 1.0);
    this.bodyGraphics.fillCircle(headX + cos * 2, headY + sin * 2, 4);
    this.bodyGraphics.fillStyle(0xffffff, 1.0);
    this.bodyGraphics.fillCircle(headX + cos * 2, headY + sin * 2, 1.5);

    // Enrage Sparks
    if (this.isEnraged && Math.random() < 0.25 && this.scene.particleManager) {
      this.scene.particleManager.emitSparks(this.x, this.y, 0xf97316, 2, 25);
    }
  }

  // =========================================================================
  // CLEANUP & DESTRUCTION
  // =========================================================================
  destroy() {
    this.isAlive = false;
    if (this.shadowGraphics) this.shadowGraphics.destroy();
    if (this.telegraphGraphics) this.telegraphGraphics.destroy();
    if (this.bodyGraphics) this.bodyGraphics.destroy();
    if (this.attackGraphics) this.attackGraphics.destroy();
  }
}

/**
 * BossManager - Tahap 5B-1
 * Coordinates Mech-Titan lifecycle:
 * - Monitors Siaga threat level (triggers at Siaga 3 first time, Siaga 4 subsequently or after 5 mins)
 * - Manages 6s siren warning and safe world-edge entrance
 * - Camera zoom transition
 * - Freeze Siaga floor at >= 3 while Boss is active
 * - Clean teardown on Kaiju death, respawn, and scene reload
 */
export class BossManager {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    this.activeBoss = null;
    this.bossDefeatCount = 0;
    this.hasTriggeredFirstBoss = false;

    // Spawning states: 'idle' | 'warning' | 'active'
    this.spawnState = 'idle';
    this.warningTimer = 0;
    this.timeAtSiaga3Plus = 0;

    // Cache initial camera zoom
    this.initialCameraZoom = scene.cameras.main.zoom;
    this.isCameraZoomed = false;
  }

  /**
   * Main per-frame update loop
   * @param {number} dt 
   * @param {Object} kaiju 
   */
  update(dt, kaiju) {
    try {
      // 1. If Boss is currently active, update Boss
      if (this.activeBoss) {
        this.activeBoss.update(dt, kaiju);

        // Keep Siaga at minimum level 3 while Boss lives
        if (this.scene.alertSystem && this.scene.alertSystem.alert < 40.0) {
          this.scene.alertSystem.alert = 40.0;
          this.scene.alertSystem.currentLevel = Math.max(3, this.scene.alertSystem.getLevelForAlert(40.0));
        }

        // Camera zoom out smooth transition
        if (!this.isCameraZoomed && this.scene.cameras && this.scene.cameras.main) {
          this.isCameraZoomed = true;
          this.scene.cameras.main.zoomTo(this.initialCameraZoom * BOSS_CONFIG.cameraZoomOutFactor, BOSS_CONFIG.cameraZoomDurationMs);
        }

        if (!this.activeBoss.isAlive && this.activeBoss.state !== 'dying') {
          this.onBossDefeated();
        }
        return;
      }

      // Camera zoom reset if boss is no longer active
      if (this.isCameraZoomed && this.scene.cameras && this.scene.cameras.main) {
        this.isCameraZoomed = false;
        this.scene.cameras.main.zoomTo(this.initialCameraZoom, BOSS_CONFIG.cameraZoomDurationMs);
      }

      // 2. Warning countdown phase
      if (this.spawnState === 'warning') {
        this.warningTimer -= dt;
        if (this.warningTimer <= 0) {
          this.spawnBossNow(kaiju);
        }
        return;
      }

      // 3. Monitor Siaga Level to trigger Mech-Titan
      const alertSys = this.scene.alertSystem;
      const curLevel = alertSys ? alertSys.currentLevel : 1;

      if (curLevel >= 3) {
        this.timeAtSiaga3Plus += dt;
      }

      if (!this.hasTriggeredFirstBoss) {
        if (curLevel >= BOSS_CONFIG.triggerSiagaLevel) {
          this.startBossWarningSequence();
        }
      } else {
        // Subsequent bosses: at Siaga 4, or after 5 mins (300s) at Siaga 3+
        const cooldownMet = this.timeAtSiaga3Plus >= BOSS_CONFIG.subsequentCooldownSeconds;
        const siagaMet = curLevel >= BOSS_CONFIG.subsequentTriggerSiagaLevel;
        if (siagaMet || cooldownMet) {
          this.startBossWarningSequence();
        }
      }
    } catch (e) {
      console.error('[BossManager] Update error:', e);
    }
  }

  /**
   * Starts 6s warning siren sequence with HTML banner and screen vignette flash
   */
  startBossWarningSequence() {
    if (this.spawnState === 'warning' || this.activeBoss) return;

    this.spawnState = 'warning';
    this.warningTimer = BOSS_CONFIG.warningDelaySeconds;
    this.hasTriggeredFirstBoss = true;
    this.timeAtSiaga3Plus = 0;

    // Audio & Visual Warning
    if (this.scene.uiManager) {
      this.scene.uiManager.showEventBanner('PERINGATAN TINGGI!', 'MECH-TITAN SEDANG MENDEKAT!', 3000);
      this.scene.uiManager.triggerRedVignetteFlash(1000);
    }

    this.scene.cameras.main.shake(400, 0.008);
  }

  /**
   * Finds nearest passable world edge and spawns physical Mech-Titan
   */
  spawnBossNow(kaiju) {
    this.spawnState = 'active';

    const kx = kaiju ? kaiju.x : this.scene.cityGrid.worldWidth / 2;
    const ky = kaiju ? kaiju.y : this.scene.cityGrid.worldHeight / 2;
    const spawnPos = this.findNearestPassableWorldEdge(kx, ky);

    this.activeBoss = new Boss(this.scene, spawnPos.x, spawnPos.y, this.bossDefeatCount + 1);
    this.scene.boss = this.activeBoss;

    // Clean cancellation of projectiles and events on boss spawn
    if (this.scene.enemyManager && typeof this.scene.enemyManager.cancelAllArtilleryProjectiles === 'function') {
      this.scene.enemyManager.cancelAllArtilleryProjectiles();
    }
    if (this.scene.eventSystem && typeof this.scene.eventSystem.stopCurrentEvent === 'function') {
      this.scene.eventSystem.stopCurrentEvent(false);
    }

    // Connect to HUD Boss Bar
    if (this.scene.uiManager && this.scene.uiManager.hud) {
      this.scene.uiManager.hud.showBossBar('MECH-TITAN', this.activeBoss.maxHp);
    }
  }

  /**
   * Locates nearest passable road or street opening along the 4 world borders
   */
  findNearestPassableWorldEdge(kx, ky) {
    const w = this.scene.cityGrid.worldWidth;
    const h = this.scene.cityGrid.worldHeight;
    const grid = this.scene.cityGrid;

    // Distance to 4 borders
    const distLeft = kx;
    const distRight = w - kx;
    const distTop = ky;
    const distBottom = h - ky;

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);
    let edgeX = 60;
    let edgeY = 60;

    if (minDist === distLeft) {
      edgeX = 50;
      edgeY = ky;
    } else if (minDist === distRight) {
      edgeX = w - 50;
      edgeY = ky;
    } else if (minDist === distTop) {
      edgeX = kx;
      edgeY = 50;
    } else {
      edgeX = kx;
      edgeY = h - 50;
    }

    return { x: edgeX, y: edgeY };
  }

  onBossDefeated() {
    this.bossDefeatCount++;
    this.activeBoss = null;
    this.scene.boss = null;
    this.spawnState = 'idle';
    this.timeAtSiaga3Plus = 0;

    if (this.scene.uiManager && this.scene.uiManager.hud) {
      this.scene.uiManager.hud.hideBossBar();
    }
  }

  /**
   * Checks if Mech-Titan is currently active
   * @returns {boolean}
   */
  isBossActive() {
    return !!(this.activeBoss && this.activeBoss.isAlive);
  }

  /**
   * RunState reset: called when Kaiju dies and respawns.
   * Completely clears the boss and resets spawn counters.
   */
  resetRunState() {
    if (this.activeBoss) {
      this.activeBoss.destroy();
      this.activeBoss = null;
    }
    this.scene.boss = null;
    this.spawnState = 'idle';
    this.warningTimer = 0;
    this.timeAtSiaga3Plus = 0;
    this.hasTriggeredFirstBoss = false;
    this.bossDefeatCount = 0;

    if (this.isCameraZoomed && this.scene.cameras && this.scene.cameras.main) {
      this.isCameraZoomed = false;
      this.scene.cameras.main.setZoom(this.initialCameraZoom);
    }

    if (this.scene.uiManager && this.scene.uiManager.hud) {
      this.scene.uiManager.hud.hideBossBar();
    }
  }

  destroy() {
    this.resetRunState();
  }
}
