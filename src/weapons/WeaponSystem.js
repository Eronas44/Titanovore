import { WEAPON_CONFIG } from '../config/weapons.js';
import { CELL_TYPES } from '../world/CityGrid.js';

/**
 * WeaponSystem - Tahap 4B-1
 * High-performance, data-driven automatic weapon engine for the Kaiju.
 * Handles 9 distinct weapons, 6 active slot caps, visual mutation linking,
 * projectile pools, homing missiles, flame breath with burning cells,
 * laser death beams, and passive synergy scaling.
 */
export class WeaponSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} kaiju - Kaiju instance
   * @param {Object} enemyManager - EnemyManager instance
   * @param {Object} cityGrid - CityGrid spatial destruction grid
   * @param {Object} particleManager - ParticleManager instance
   */
  constructor(scene, kaiju, enemyManager, cityGrid, particleManager) {
    this.scene = scene;
    this.kaiju = kaiju;
    this.enemyManager = enemyManager;
    this.cityGrid = cityGrid;
    this.particleManager = particleManager;

    // Equipped weapons: Map<id, weaponEntry>
    this.equippedWeapons = new Map();

    // Passive modifiers
    this.damageMultiplier = 1.0;
    this.bloodRageMultiplier = 1.0;
    this.cooldownMultiplier = 1.0;
    this.buildingDmgMultiplier = 1.0;
    this.rangeMultiplier = 1.0;
    this.thornDamage = 0;
    this.thornRadius = 0;

    // 1. Pre-allocated Kaiju Projectile Pool (250 slots, zero-GC SoA)
    this.maxProjectiles = WEAPON_CONFIG.maxProjectiles;
    this.projX = new Float32Array(this.maxProjectiles);
    this.projY = new Float32Array(this.maxProjectiles);
    this.projVx = new Float32Array(this.maxProjectiles);
    this.projVy = new Float32Array(this.maxProjectiles);
    this.projLife = new Float32Array(this.maxProjectiles);
    this.projDamage = new Float32Array(this.maxProjectiles);
    this.projActive = new Uint8Array(this.maxProjectiles);
    this.projCanHitAir = new Uint8Array(this.maxProjectiles);
    this.projCanHitGround = new Uint8Array(this.maxProjectiles);
    this.projBuildingMult = new Float32Array(this.maxProjectiles);
    this.projColor = new Uint32Array(this.maxProjectiles);
    this.projIsRocket = new Uint8Array(this.maxProjectiles);
    this.projBlastRadius = new Float32Array(this.maxProjectiles);
    this.projTargetIdx = new Int16Array(this.maxProjectiles);
    this.projTargetId = new Uint32Array(this.maxProjectiles);
    this.projLastTargetX = new Float32Array(this.maxProjectiles);
    this.projLastTargetY = new Float32Array(this.maxProjectiles);
    this.projHasLastTarget = new Uint8Array(this.maxProjectiles);
    this.projTargetIdx.fill(-1);

    this.freeProjIndices = [];
    for (let i = this.maxProjectiles - 1; i >= 0; i--) {
      this.freeProjIndices.push(i);
    }
    this.activeProjCount = 0;

    // 2. Dedicated Graphics Batches (Zero GC)
    this.attackGraphics = this.scene.add.graphics().setDepth(20); // Above Kaiju, below UI
    this.projGraphics = this.scene.add.graphics().setDepth(18); // Projectiles

    // 3. Transient visual effects queue (slash arcs, lightning zaps, shockwaves)
    this.visualEffects = [];

    // 4. Burning cells tracking (capped at 200 active cells to prevent overhead)
    this.burningCells = [];
    this.maxBurningCells = 200;

    // 5. Lingering ground fire pools (from Lv 5 Fire Breath)
    this.firePools = [];

    // Equip default starting weapon: Claw Level 1
    this.equipWeapon('claw', 1);
  }

  /**
   * Equips a new weapon or upgrades an existing one.
   * Also triggers visual mutation layer changes on Kaiju.
   * @param {string} weaponId 
   * @param {number} level - Target level (1-5)
   */
  equipWeapon(weaponId, level = 1) {
    const wDef = WEAPON_CONFIG.weapons[weaponId];
    if (!wDef) {
      console.warn(`[WeaponSystem] Unknown weapon ID: ${weaponId}`);
      return false;
    }

    if (!this.equippedWeapons.has(weaponId)) {
      if (this.equippedWeapons.size >= WEAPON_CONFIG.maxWeaponSlots) {
        console.warn(`[WeaponSystem] Cannot equip ${weaponId}: all 6 slots are full!`);
        return false;
      }
      this.equippedWeapons.set(weaponId, {
        id: weaponId,
        level: Math.min(5, Math.max(1, level)),
        timer: 0.15, // Attack soon after acquiring
        firingTimer: 0, // For channeled attacks (Fire Breath, Laser Eyes)
        isFiring: false,
        doubleSwipePending: false,
        doubleSwipeTimer: 0,
        secondQuakePending: false,
        secondQuakeTimer: 0
      });
    } else {
      const entry = this.equippedWeapons.get(weaponId);
      entry.level = Math.min(5, Math.max(entry.level, level));
    }

    // Trigger visual mutation layer update on Kaiju
    const finalLevel = this.getWeaponLevel(weaponId);
    if (this.kaiju && this.kaiju.setMutation) {
      this.kaiju.setMutation(weaponId, finalLevel);
    }

    return true;
  }

  /**
   * Unequips a weapon, removing it from inventory and clearing visual mutations.
   * @param {string} weaponId 
   */
  unequipWeapon(weaponId) {
    if (this.equippedWeapons.has(weaponId)) {
      this.equippedWeapons.delete(weaponId);
    }
    if (this.kaiju) {
      if (typeof this.kaiju.removeMutation === 'function') {
        this.kaiju.removeMutation(weaponId);
      }
      if (weaponId === 'electric_skin' && this.kaiju.hasLayer && this.kaiju.hasLayer('skin_overlay')) {
        this.kaiju.removeLayer('skin_overlay');
      }
      if (weaponId === 'spiked_tail' && typeof this.kaiju.clearTailSpikes === 'function') {
        this.kaiju.clearTailSpikes();
      }
    }
    if (weaponId === 'body_spikes') {
      this.thornDamage = 0;
      this.thornRadius = 0;
    }
  }

  /**
   * Equips a synergy evolved weapon.
   * @param {string} evolutionId 
   * @param {Object} evoData 
   */
  equipEvolvedWeapon(evolutionId, evoData) {
    this.equippedWeapons.set(evolutionId, {
      id: evolutionId,
      isEvolution: true,
      level: 1,
      timer: 0.15,
      firingTimer: 0,
      isFiring: false,
      evoData: evoData,
      lightningTimer: 0,
      sweepAngle: 0,
      baseSweepAngle: 0
    });

    if (evolutionId === 'thorn_bastion') {
      if (this.kaiju) {
        this.kaiju.setEnergyShield(evoData.stats?.shieldCapacity || 300, evoData.stats?.rechargeDelay || 3.5);
        this.kaiju.reflectChance = evoData.stats?.reflectChance || 0.70;
        this.kaiju.reflectMultiplier = evoData.stats?.reflectMultiplier || 2.2;
      }
    }
  }

  /**
   * Gets current level of an equipped weapon (0 if not equipped)
   * @param {string} weaponId 
   * @returns {number}
   */
  getWeaponLevel(weaponId) {
    if (this.equippedWeapons.has(weaponId)) {
      return this.equippedWeapons.get(weaponId).level;
    }
    return 0;
  }

  /**
   * Total effective damage multiplier including Blood Rage stacks
   * @returns {number}
   */
  getEffectiveDamageMultiplier() {
    return this.damageMultiplier * this.bloodRageMultiplier;
  }

  /**
   * Spawns a Kaiju projectile.
   */
  spawnProjectile(
    x, y, vx, vy,
    damage,
    canHitAir, canHitGround,
    buildingMult,
    color = 0x38bdf8,
    life = 0.7,
    isRocket = false,
    blastRadius = 0,
    targetIdx = -1,
    targetId = 0,
    targetX = 0,
    targetY = 0
  ) {
    if (this.freeProjIndices.length === 0) return -1;
    const idx = this.freeProjIndices.pop();

    this.projActive[idx] = 1;
    this.projX[idx] = x;
    this.projY[idx] = y;
    this.projVx[idx] = vx;
    this.projVy[idx] = vy;
    this.projDamage[idx] = damage * this.getEffectiveDamageMultiplier();
    this.projCanHitAir[idx] = canHitAir ? 1 : 0;
    this.projCanHitGround[idx] = canHitGround ? 1 : 0;
    this.projBuildingMult[idx] = buildingMult * this.buildingDmgMultiplier;
    this.projColor[idx] = color;
    this.projLife[idx] = life;
    this.projIsRocket[idx] = isRocket ? 1 : 0;
    this.projBlastRadius[idx] = blastRadius;
    this.projTargetIdx[idx] = targetIdx;
    this.projTargetId[idx] = targetId;
    this.projLastTargetX[idx] = targetX;
    this.projLastTargetY[idx] = targetY;
    this.projHasLastTarget[idx] = (targetIdx >= 0 || targetX !== 0 || targetY !== 0) ? 1 : 0;
    this.activeProjCount++;

    return idx;
  }

  /**
   * Recycles a projectile slot back into the free list.
   */
  despawnProjectile(idx) {
    if (!this.projActive[idx]) return;
    this.projActive[idx] = 0;
    this.projTargetIdx[idx] = -1;
    this.projTargetId[idx] = 0;
    this.projHasLastTarget[idx] = 0;
    this.freeProjIndices.push(idx);
    this.activeProjCount = Math.max(0, this.activeProjCount - 1);
  }

  /**
   * Main per-frame update loop: drives weapon timers, auto-attacks, and updates projectiles.
   * @param {number} dt - delta in seconds
   */
  update(dt) {
    this.attackGraphics.clear();

    // 1. Update active weapons safely per-weapon
    for (const [id, entry] of this.equippedWeapons.entries()) {
      try {
        if (entry.isEvolution) {
          this.updateEvolution(id, entry, dt);
          continue;
        }

        const wDef = WEAPON_CONFIG.weapons[id];
        if (!wDef) continue;

        const lvlData = wDef.levels[entry.level - 1] || wDef.levels[0];
        const effectiveCooldown = (lvlData.cooldown || 1.0) * this.cooldownMultiplier;

        // Handle Claw Double Swipe delay
        if (entry.doubleSwipePending) {
          entry.doubleSwipeTimer -= dt;
          if (entry.doubleSwipeTimer <= 0) {
            entry.doubleSwipePending = false;
            this.executeClawAttack(lvlData, true);
          }
        }

        // Handle Quake Stomp Double Quake delay
        if (entry.secondQuakePending) {
          entry.secondQuakeTimer -= dt;
          if (entry.secondQuakeTimer <= 0) {
            entry.secondQuakePending = false;
            this.executeQuakeStomp(lvlData, true);
          }
        }

        // Handle Channeled continuous weapons (Fire Breath & Laser Eyes)
        if (id === 'fire_breath') {
          this.updateFireBreath(entry, lvlData, dt, effectiveCooldown);
          continue;
        }

        if (id === 'laser_eyes') {
          this.updateLaserEyes(entry, lvlData, dt, effectiveCooldown);
          continue;
        }

        // Discrete trigger weapons
        entry.timer -= dt;
        if (entry.timer <= 0) {
          entry.timer = effectiveCooldown;

          switch (id) {
            case 'claw':
              this.executeClawAttack(lvlData, false);
              if (lvlData.isDoubleSwipe) {
                entry.doubleSwipePending = true;
                entry.doubleSwipeTimer = lvlData.doubleSwipeDelay || 0.12;
              }
              break;
            case 'back_cannon':
              this.executeBackCannonAttack(lvlData);
              break;
            case 'electric_skin':
              this.executeElectricSkinAttack(lvlData);
              break;
            case 'spiked_tail':
              this.executeSpikedTailAttack(lvlData);
              break;
            case 'body_spikes':
              this.executeBodySpikesPassive(lvlData);
              break;
            case 'back_rockets':
              this.executeBackRocketsAttack(lvlData);
              break;
            case 'quake_stomp':
              this.executeQuakeStomp(lvlData, false);
              if (lvlData.isDoubleQuake) {
                entry.secondQuakePending = true;
                entry.secondQuakeTimer = lvlData.quakeDelay || 0.35;
              }
              break;
          }
        }
      } catch (err) {
        console.error(`[WeaponSystem] Error executing weapon "${id}":`, err);
      }
    }

    // 2. Update Burning Cells & Lingering Fire safely
    try {
      this.updateBurningCells(dt);
      this.updateFirePools(dt);
    } catch (e) {
      console.error('[WeaponSystem] Error updating fire effects:', e);
    }

    // 3. Render and age transient visual effects safely
    try {
      this.updateVisualEffects(dt);
    } catch (e) {
      console.error('[WeaponSystem] Error updating visual effects:', e);
    }

    // 4. Update Kaiju projectiles safely
    try {
      this.updateProjectiles(dt);
    } catch (e) {
      console.error('[WeaponSystem] Error updating projectiles:', e);
    }
  }

  // =========================================================================
  // 1. CLAW (Cakar)
  // =========================================================================
  executeClawAttack(lvlData, isSecondSwipe = false) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const angle = this.kaiju.rotation + (isSecondSwipe ? 0.15 : -0.15);
    const reach = lvlData.range * this.kaiju.currentScale * this.rangeMultiplier;
    const halfArcRad = Phaser.Math.DegToRad(lvlData.arcAngle / 2);
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier();

    // Damage ground enemies in frontal arc
    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 20, (idx, dx, dy) => {
      if (!this.enemyManager.active[idx]) return;
      if (this.enemyManager.isAir[idx] === 1) return;

      const enemyAngle = Math.atan2(dy, dx);
      const angleDiff = Phaser.Math.Angle.Wrap(enemyAngle - angle);

      if (Math.abs(angleDiff) <= halfArcRad) {
        this.enemyManager.damageEnemy(idx, damage, false);
        this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0xf59e0b, 3, 40);
      }
    });

    // Damage building cells in frontal arc
    this.damageBuildingsInArc(kx, ky, angle, reach, halfArcRad, damage * (lvlData.buildingDamageMultiplier || 2.8) * 0.22);

    // Visual slash arc
    this.visualEffects.push({
      type: 'claw',
      x: kx,
      y: ky,
      angle: angle,
      radius: reach,
      arcAngle: lvlData.arcAngle,
      life: lvlData.isDoubleSwipe ? 0.12 : 0.18,
      maxLife: lvlData.isDoubleSwipe ? 0.12 : 0.18,
      color: lvlData.isDoubleSwipe ? 0xfacc15 : 0x34d399
    });
  }

  // =========================================================================
  // 2. BACK CANNON (Meriam Punggung)
  // =========================================================================
  executeBackCannonAttack(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = lvlData.range * this.rangeMultiplier;
    const projSpeed = lvlData.projectileSpeed;
    const damage = lvlData.damage;
    const count = lvlData.projectileCount || 1;

    let targetX = 0;
    let targetY = 0;
    let hasTarget = false;

    // Target nearest air or ground threat
    const nearest = this.enemyManager.getNearestEnemyInRadius(kx, ky, range);
    if (nearest) {
      targetX = nearest.x;
      targetY = nearest.y;
      hasTarget = true;
    } else {
      targetX = kx + Math.cos(this.kaiju.rotation) * 100;
      targetY = ky + Math.sin(this.kaiju.rotation) * 100;
    }

    const baseAngle = Math.atan2(targetY - ky, targetX - kx);

    for (let i = 0; i < count; i++) {
      let fireAngle = baseAngle;
      if (count > 1) {
        fireAngle += (i - (count - 1) / 2) * 0.18;
      }

      const vx = Math.cos(fireAngle) * projSpeed;
      const vy = Math.sin(fireAngle) * projSpeed;
      this.spawnProjectile(kx, ky, vx, vy, damage, true, true, 0.8, 0x38bdf8, 0.65);
    }

    // Special Level 5: Dual Direction Salvo (fires rear shots as well)
    if (lvlData.dualDirection) {
      const rearAngle = baseAngle + Math.PI;
      for (let i = 0; i < 2; i++) {
        const rAngle = rearAngle + (i - 0.5) * 0.22;
        const vx = Math.cos(rAngle) * projSpeed;
        const vy = Math.sin(rAngle) * projSpeed;
        this.spawnProjectile(kx, ky, vx, vy, damage, true, true, 0.8, 0x38bdf8, 0.65);
      }
    }
  }

  // =========================================================================
  // 3. ELECTRIC SKIN (Kulit Listrik)
  // =========================================================================
  executeElectricSkinAttack(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = lvlData.range * this.kaiju.currentScale * this.rangeMultiplier;
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier();

    const hitEnemies = [];

    this.enemyManager.queryEnemiesInRadius(kx, ky, range, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      this.enemyManager.damageEnemy(idx, damage, true);
      hitEnemies.push({
        x: this.enemyManager.x[idx],
        y: this.enemyManager.y[idx]
      });
    });

    if (hitEnemies.length > 0) {
      const sample = hitEnemies.slice(0, 5);
      for (const target of sample) {
        this.visualEffects.push({
          type: 'lightning',
          startX: kx,
          startY: ky,
          endX: target.x,
          endY: target.y,
          life: 0.14,
          maxLife: 0.14,
          color: 0x67e8f9
        });
      }
    }
  }

  // =========================================================================
  // 4. SPIKED TAIL (Ekor Berduri)
  // =========================================================================
  executeSpikedTailAttack(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const reach = lvlData.range * this.kaiju.currentScale * this.rangeMultiplier;
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier();
    const isFullSpin = !!lvlData.isFullSpin;

    // Tail strikes behind Kaiju (rotation + PI), or full 360° spin at Lv 5
    const centerAngle = this.kaiju.rotation + Math.PI;
    const halfArc = isFullSpin ? Math.PI : Phaser.Math.DegToRad(lvlData.arcAngle / 2);

    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 15, (idx, dx, dy) => {
      if (!this.enemyManager.active[idx]) return;
      if (this.enemyManager.isAir[idx] === 1) return; // Tail is ground-only

      if (isFullSpin) {
        this.enemyManager.damageEnemy(idx, damage, false);
        this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0x38bdf8, 4, 50);
      } else {
        const enemyAngle = Math.atan2(dy, dx);
        const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(enemyAngle - centerAngle));
        if (angleDiff <= halfArc) {
          this.enemyManager.damageEnemy(idx, damage, false);
          this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0x38bdf8, 4, 50);
        }
      }
    });

    // Heavy structure smash behind Kaiju
    this.damageBuildingsInArc(kx, ky, centerAngle, reach, halfArc, damage * (lvlData.buildingDamageMultiplier || 3.2) * 0.25);

    // Visual sweep arc
    this.visualEffects.push({
      type: 'tail_sweep',
      x: kx,
      y: ky,
      angle: centerAngle,
      radius: reach,
      arcAngle: isFullSpin ? 360 : lvlData.arcAngle,
      life: 0.22,
      maxLife: 0.22,
      color: isFullSpin ? 0xfb923c : 0x7dd3fc
    });
  }

  // =========================================================================
  // 5. BODY SPIKES (Duri Tubuh)
  // =========================================================================
  executeBodySpikesPassive(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = lvlData.range * this.kaiju.currentScale * this.rangeMultiplier;
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier();

    this.enemyManager.queryEnemiesInRadius(kx, ky, range, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      this.enemyManager.damageEnemy(idx, damage, true);
    });
  }

  /**
   * Reactive burst triggered when Kaiju takes damage
   */
  triggerThornBurst(damageTaken = 20) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;

    // Check Thorn Bastion evolution first
    if (this.equippedWeapons.has('thorn_bastion')) {
      const evo = this.equippedWeapons.get('thorn_bastion');
      const stats = evo.evoData?.stats || {};
      const dmg = (stats.eruptionDamage || 90) * this.getEffectiveDamageMultiplier();
      const spikeCount = stats.eruptionSpikes || 24;
      const blastRadius = (stats.eruptionRadius || 95) * this.kaiju.currentScale;

      for (let s = 0; s < spikeCount; s++) {
        const angle = (s / spikeCount) * Math.PI * 2;
        const vx = Math.cos(angle) * 380;
        const vy = Math.sin(angle) * 380;
        this.spawnProjectile(kx, ky, vx, vy, dmg * 0.5, true, true, 2.0, 0x10b981, 0.55);
      }

      this.enemyManager.queryEnemiesInRadius(kx, ky, blastRadius, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        this.enemyManager.damageEnemy(idx, dmg, true);
      });

      this.visualEffects.push({
        type: 'shockwave',
        x: kx,
        y: ky,
        radius: blastRadius,
        life: 0.22,
        maxLife: 0.22,
        color: 0x10b981
      });

      if (this.particleManager) {
        this.particleManager.emitDebris(kx, ky, 0x10b981, 16, 75);
      }
      return;
    }

    // Check Body Spikes weapon level 5
    const bodySpikesLevel = this.getWeaponLevel('body_spikes');
    if (bodySpikesLevel >= 5) {
      // 360-degree 16-spike eruption
      const numSpikes = 16;
      for (let s = 0; s < numSpikes; s++) {
        const angle = (s / numSpikes) * Math.PI * 2;
        const vx = Math.cos(angle) * 320;
        const vy = Math.sin(angle) * 320;
        this.spawnProjectile(kx, ky, vx, vy, 45, true, true, 1.2, 0xff5c39, 0.45);
      }
      this.particleManager.emitDebris(kx, ky, 0xff5c39, 14, 70);
    }

    // Check passive Thorn Shield
    if (this.thornDamage > 0 && this.thornRadius > 0) {
      const radius = this.thornRadius * this.kaiju.currentScale * this.rangeMultiplier;
      const dmg = (this.thornDamage + damageTaken * 0.2) * this.getEffectiveDamageMultiplier();

      this.enemyManager.queryEnemiesInRadius(kx, ky, radius, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        this.enemyManager.damageEnemy(idx, dmg, true);
      });

      this.visualEffects.push({
        type: 'shockwave',
        x: kx,
        y: ky,
        radius: radius,
        life: 0.16,
        maxLife: 0.16,
        color: 0xf43f5e
      });
    }
  }

  // =========================================================================
  // 6. FIRE BREATH (Napas Api)
  // =========================================================================
  updateFireBreath(entry, lvlData, dt, effectiveCooldown) {
    if (!entry.isFiring) {
      entry.timer -= dt;
      if (entry.timer <= 0) {
        entry.isFiring = true;
        entry.firingTimer = lvlData.activeDuration || 1.5;
      }
      return;
    }

    // Active flame spew
    entry.firingTimer -= dt;
    if (entry.firingTimer <= 0) {
      entry.isFiring = false;
      entry.timer = effectiveCooldown;
      return;
    }

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const angle = this.kaiju.rotation;
    const reach = lvlData.range * this.kaiju.currentScale * this.rangeMultiplier;
    const halfArc = Phaser.Math.DegToRad((lvlData.arcAngle || 45) / 2);
    const dmg = lvlData.damage * this.getEffectiveDamageMultiplier() * dt * 5.0; // 5 ticks/sec

    // Damage enemies in flame cone
    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 10, (idx, dx, dy) => {
      if (!this.enemyManager.active[idx]) return;
      const enemyAngle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(enemyAngle - angle));
      if (angleDiff <= halfArc) {
        this.enemyManager.damageEnemy(idx, dmg, true); // Fire hits ground & air
      }
    });

    // Ignite building cells in cone
    this.igniteBuildingCellsInCone(kx, ky, angle, reach, halfArc);

    // Render continuous fire cone
    this.renderFireCone(kx, ky, angle, reach, halfArc, lvlData.lingeringFire);

    // Lv 5: leave lingering fire pool
    if (lvlData.lingeringFire && Math.random() < 0.25) {
      const dist = reach * (0.3 + Math.random() * 0.6);
      const spread = (Math.random() - 0.5) * halfArc;
      const px = kx + Math.cos(angle + spread) * dist;
      const py = ky + Math.sin(angle + spread) * dist;
      this.firePools.push({
        x: px,
        y: py,
        radius: 20,
        life: 2.5,
        maxLife: 2.5,
        damagePerSec: 18 * this.getEffectiveDamageMultiplier()
      });
    }
  }

  igniteBuildingCellsInCone(kx, ky, angle, reach, halfArc) {
    const cg = this.cityGrid;
    const cellRadius = Math.ceil(reach / cg.cellSize);
    const centerCol = Math.floor(kx / cg.cellSize);
    const centerRow = Math.floor(ky / cg.cellSize);

    for (let r = -cellRadius; r <= cellRadius; r++) {
      for (let c = -cellRadius; c <= cellRadius; c++) {
        const col = centerCol + c;
        const row = centerRow + r;
        if (col < 0 || col >= cg.cols || row < 0 || row >= cg.rows) continue;

        const cellX = col * cg.cellSize + cg.cellSize / 2;
        const cellY = row * cg.cellSize + cg.cellSize / 2;
        const dx = cellX - kx;
        const dy = cellY - ky;
        const distSq = dx * dx + dy * dy;

        if (distSq <= reach * reach) {
          const cellAngle = Math.atan2(dy, dx);
          const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(cellAngle - angle));
          if (angleDiff <= halfArc) {
            const idx = row * cg.cols + col;
            const cType = cg.types[idx];
            if ((cType === CELL_TYPES.BUILDING || cType === CELL_TYPES.BUILDING_DETAIL) && cg.hp[idx] > 0) {
              this.addBurningCell(col, row, idx, cellX, cellY);
            }
          }
        }
      }
    }
  }

  addBurningCell(col, row, idx, worldX, worldY) {
    if (this.burningCells.length >= this.maxBurningCells) return;
    for (let i = 0; i < this.burningCells.length; i++) {
      if (this.burningCells[i].idx === idx) return; // Already burning
    }
    this.burningCells.push({
      col,
      row,
      idx,
      worldX,
      worldY,
      burnTimer: 2.0,
      tickTimer: 0.25
    });
  }

  updateBurningCells(dt) {
    const cg = this.cityGrid;
    for (let i = this.burningCells.length - 1; i >= 0; i--) {
      const b = this.burningCells[i];
      b.burnTimer -= dt;
      b.tickTimer -= dt;

      if (b.tickTimer <= 0) {
        b.tickTimer = 0.25;
        const res = cg.damageCell(b.col, b.row, 1.2 * this.buildingDmgMultiplier);
        if (this.particleManager) {
          this.particleManager.emitSparks(b.worldX, b.worldY, 0xf97316, 2, 25);
        }
        if (res && res.destroyed && this.scene.onCellDestroyed) {
          this.scene.onCellDestroyed({ col: b.col, row: b.row, worldX: b.worldX, worldY: b.worldY }, res.building, false);
          this.burningCells.splice(i, 1);
          continue;
        }
      }

      if (b.burnTimer <= 0) {
        this.burningCells.splice(i, 1);
      }
    }
  }

  updateFirePools(dt) {
    for (let i = this.firePools.length - 1; i >= 0; i--) {
      const p = this.firePools[i];
      p.life -= dt;

      // Damage enemies stepping on molten patch
      this.enemyManager.queryEnemiesInRadius(p.x, p.y, p.radius, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        this.enemyManager.damageEnemy(idx, p.damagePerSec * dt, true);
      });

      // Render pool
      this.attackGraphics.fillStyle(0xea580c, 0.45 * (p.life / p.maxLife));
      this.attackGraphics.fillCircle(p.x, p.y, p.radius);
      this.attackGraphics.fillStyle(0xfde047, 0.7 * (p.life / p.maxLife));
      this.attackGraphics.fillCircle(p.x, p.y, p.radius * 0.5);

      if (p.life <= 0) {
        this.firePools.splice(i, 1);
      }
    }
  }

  renderFireCone(kx, ky, angle, reach, halfArc, isLingering) {
    const startAngle = angle - halfArc;
    const endAngle = angle + halfArc;

    this.attackGraphics.fillStyle(isLingering ? 0xea580c : 0xf97316, 0.35);
    this.attackGraphics.beginPath();
    this.attackGraphics.moveTo(kx, ky);
    this.attackGraphics.arc(kx, ky, reach, startAngle, endAngle);
    this.attackGraphics.closePath();
    this.attackGraphics.fill();

    // Hot inner core
    this.attackGraphics.fillStyle(0xfde047, 0.65);
    this.attackGraphics.beginPath();
    this.attackGraphics.moveTo(kx, ky);
    this.attackGraphics.arc(kx, ky, reach * 0.6, angle - halfArc * 0.6, angle + halfArc * 0.6);
    this.attackGraphics.closePath();
    this.attackGraphics.fill();
  }

  // =========================================================================
  // 7. BACK ROCKETS (Roket Punggung)
  // =========================================================================
  executeBackRocketsAttack(lvlData) {
    if (!this.kaiju) return;
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = (lvlData.range || 240) * this.rangeMultiplier;
    const count = lvlData.rocketCount || 2;
    const damage = lvlData.damage || 45;
    const blast = lvlData.blastRadius || 30;

    // Search nearest enemy target safely (ground or air)
    let targetIdx = -1;
    let targetId = 0;
    let targetX = 0;
    let targetY = 0;
    let targetAngle = this.kaiju.rotation || 0;

    if (this.enemyManager && typeof this.enemyManager.getNearestEnemy === 'function') {
      const nearest = this.enemyManager.getNearestEnemy(kx, ky, range);
      if (nearest) {
        const dx = nearest.x - kx;
        const dy = nearest.y - ky;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.001 && !isNaN(dx) && !isNaN(dy)) {
          targetAngle = Math.atan2(dy, dx);
          targetIdx = nearest.idx;
          targetId = nearest.id;
          targetX = nearest.x;
          targetY = nearest.y;
        }
      }
    }

    if (isNaN(targetAngle)) {
      targetAngle = this.kaiju.rotation || 0;
    }

    if (targetIdx === -1) {
      // No target in range: set straight line forward point
      targetX = kx + Math.cos(targetAngle) * range;
      targetY = ky + Math.sin(targetAngle) * range;
    }

    for (let i = 0; i < count; i++) {
      if (this.freeProjIndices.length === 0) break; // Pool full guard

      // Salvo spread angle
      const spread = count > 1 ? (i - (count - 1) / 2) * 0.28 : 0;
      const angle = targetAngle + spread;
      const speed = 250 + (i % 2) * 20;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // Spawn homing rocket (hits air & ground, AOE blast)
      this.spawnProjectile(
        kx, ky, vx, vy,
        damage,
        true, true,
        3.0,
        0xf97316,
        1.4,
        true,
        blast,
        targetIdx,
        targetId,
        targetX,
        targetY
      );
    }
  }

  // =========================================================================
  // 8. QUAKE STOMP (Injakan Getar)
  // =========================================================================
  executeQuakeStomp(lvlData, isSecondQuake = false) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const radius = lvlData.radius * this.kaiju.currentScale * this.rangeMultiplier * (isSecondQuake ? 1.15 : 1.0);
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier() * (isSecondQuake ? 0.75 : 1.0);
    const slowFactor = lvlData.slowFactor || 0.5;
    const slowDuration = lvlData.slowDuration || 1.5;

    // Damage and slow ground enemies
    this.enemyManager.queryEnemiesInRadius(kx, ky, radius, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      if (this.enemyManager.isAir[idx] === 1) return; // Quake hits ground only

      this.enemyManager.damageEnemy(idx, damage, false);

      // Apply slow factor by damping enemy velocity
      this.enemyManager.vx[idx] *= slowFactor;
      this.enemyManager.vy[idx] *= slowFactor;
    });

    // Fracture building cells in circle
    const cg = this.cityGrid;
    const cellRadius = Math.ceil(radius / cg.cellSize);
    const centerCol = Math.floor(kx / cg.cellSize);
    const centerRow = Math.floor(ky / cg.cellSize);
    const cellDmg = damage * (lvlData.buildingDamageMultiplier || 2.5) * 0.2;

    for (let r = -cellRadius; r <= cellRadius; r++) {
      for (let c = -cellRadius; c <= cellRadius; c++) {
        const col = centerCol + c;
        const row = centerRow + r;
        if (col < 0 || col >= cg.cols || row < 0 || row >= cg.rows) continue;

        const cellX = col * cg.cellSize + cg.cellSize / 2;
        const cellY = row * cg.cellSize + cg.cellSize / 2;
        const distSq = (cellX - kx) * (cellX - kx) + (cellY - ky) * (cellY - ky);

        if (distSq <= radius * radius) {
          const res = cg.damageCell(col, row, cellDmg);
          if (res && res.destroyed && this.scene.onCellDestroyed) {
            this.scene.onCellDestroyed({ col, row, worldX: cellX, worldY: cellY }, res.building, false);
          }
        }
      }
    }

    // Camera shake & visual expanding seismic ring
    this.scene.cameras.main.shake(140, 0.005);
    this.visualEffects.push({
      type: 'shockwave',
      x: kx,
      y: ky,
      radius: radius,
      life: 0.28,
      maxLife: 0.28,
      color: isSecondQuake ? 0xf59e0b : 0xeab308
    });
  }

  // =========================================================================
  // 9. LASER EYES (Mata Laser)
  // =========================================================================
  updateLaserEyes(entry, lvlData, dt, effectiveCooldown) {
    if (!entry.isFiring) {
      entry.timer -= dt;
      if (entry.timer <= 0) {
        entry.isFiring = true;
        entry.firingTimer = lvlData.beamDuration || 1.0;
      }
      return;
    }

    entry.firingTimer -= dt;
    if (entry.firingTimer <= 0) {
      entry.isFiring = false;
      entry.timer = effectiveCooldown;
      return;
    }

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const reach = lvlData.range * this.rangeMultiplier;
    const damage = lvlData.damage * this.getEffectiveDamageMultiplier() * dt * 6.0; // 6 ticks/sec
    const isDual = !!lvlData.isDualBeam;

    // Target nearest threat or face orientation
    let targetAngle = this.kaiju.rotation;
    const nearest = this.enemyManager.getNearestEnemyInRadius(kx, ky, reach);
    if (nearest) {
      targetAngle = Math.atan2(nearest.y - ky, nearest.x - kx);
    }

    if (!isDual) {
      this.firePiercingLaser(kx, ky, targetAngle, reach, damage, 0);
    } else {
      // Twin parallel death beams
      this.firePiercingLaser(kx, ky, targetAngle, reach, damage, -6);
      this.firePiercingLaser(kx, ky, targetAngle, reach, damage, 6);
    }
  }

  firePiercingLaser(kx, ky, angle, reach, damage, lateralOffset) {
    const perpAngle = angle + Math.PI / 2;
    const ox = kx + Math.cos(perpAngle) * lateralOffset;
    const oy = ky + Math.sin(perpAngle) * lateralOffset;
    const ex = ox + Math.cos(angle) * reach;
    const ey = oy + Math.sin(angle) * reach;

    // Render Laser Beam
    this.attackGraphics.lineStyle(4, 0xff1e42, 0.85);
    this.attackGraphics.lineBetween(ox, oy, ex, ey);
    this.attackGraphics.lineStyle(1.5, 0xffffff, 1.0);
    this.attackGraphics.lineBetween(ox, oy, ex, ey);

    // Damage enemies intersecting beam
    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 20, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      const tx = this.enemyManager.x[idx];
      const ty = this.enemyManager.y[idx];

      const distToLine = Phaser.Math.Distance.Between(
        tx,
        ty,
        Phaser.Math.Clamp(tx, Math.min(ox, ex), Math.max(ox, ex)),
        Phaser.Math.Clamp(ty, Math.min(oy, ey), Math.max(oy, ey))
      );

      if (distToLine <= 14) {
        this.enemyManager.damageEnemy(idx, damage, true);
        if (Math.random() < 0.2) {
          this.particleManager.emitSparks(tx, ty, 0xff1e42, 2, 20);
        }
      }
    });

    // Carve building cells along laser line
    const cg = this.cityGrid;
    const steps = Math.floor(reach / cg.cellSize);
    const dirX = Math.cos(angle);
    const dirY = Math.sin(angle);

    for (let s = 2; s < steps; s++) {
      const px = ox + dirX * s * cg.cellSize;
      const py = oy + dirY * s * cg.cellSize;
      const col = Math.floor(px / cg.cellSize);
      const row = Math.floor(py / cg.cellSize);

      if (col >= 0 && col < cg.cols && row >= 0 && row < cg.rows) {
        const res = cg.damageCell(col, row, damage * 0.25);
        if (res && res.destroyed && this.scene.onCellDestroyed) {
          this.scene.onCellDestroyed({ col, row, worldX: px, worldY: py }, res.building, false);
        }
      }
    }
  }

  // =========================================================================
  // EVOLUTION SYNERGY WEAPONS (Tahap 4B-2)
  // =========================================================================

  /**
   * Routes execution for synergy evolved weapons
   */
  updateEvolution(id, entry, dt) {
    switch (id) {
      case 'plasma_storm':
        this.updatePlasmaStorm(entry, dt);
        break;
      case 'lightning_tail':
        this.executeLightningTail(entry, dt);
        break;
      case 'heavy_artillery':
        this.executeHeavyArtillery(entry, dt);
        break;
      case 'cataclysm_quake':
        this.executeCataclysmQuake(entry, dt);
        break;
      case 'annihilation_laser':
        this.updateAnnihilationLaser(entry, dt);
        break;
      case 'thorn_bastion':
        this.updateThornBastion(entry, dt);
        break;
    }
  }

  // 1. BADAI PLASMA (Napas Api + Kulit Listrik)
  updatePlasmaStorm(entry, dt) {
    const stats = entry.evoData?.stats || {};
    const scale = this.kaiju.currentScale;
    const radius = (stats.radius || 125) * scale * this.rangeMultiplier;
    const auraDps = (stats.auraDamage || 55) * this.getEffectiveDamageMultiplier();
    const lDmg = (stats.lightningDamage || 125) * this.getEffectiveDamageMultiplier();
    const lRange = (stats.lightningRange || 240) * this.rangeMultiplier;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;

    // 1. Aura Tick (area burn)
    entry.timer -= dt;
    if (entry.timer <= 0) {
      const interval = stats.cooldown || 0.12;
      entry.timer = interval;
      const tickDmg = auraDps * interval;

      this.enemyManager.queryEnemiesInRadius(kx, ky, radius, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        this.enemyManager.damageEnemy(idx, tickDmg, true); // Ground & air
      });

      this.damageBuildingsInRadius(kx, ky, radius, tickDmg * (stats.buildingDamageMultiplier || 3.2) * 0.25);
    }

    // Render plasma aura rings
    this.attackGraphics.lineStyle(2.5, 0x06b6d4, 0.6);
    this.attackGraphics.strokeCircle(kx, ky, radius);
    this.attackGraphics.lineStyle(1.5, 0xd946ef, 0.5);
    this.attackGraphics.strokeCircle(kx, ky, radius * 0.72);

    // 2. Strongest bolt to furthest enemy in range
    entry.lightningTimer = (entry.lightningTimer || 0) - dt;
    if (entry.lightningTimer <= 0) {
      entry.lightningTimer = stats.lightningInterval || 0.9;

      let farthestEnemy = null;
      let farthestDistSq = 0;

      this.enemyManager.queryEnemiesInRadius(kx, ky, lRange, (idx, dx, dy) => {
        if (!this.enemyManager.active[idx]) return;
        const dSq = dx * dx + dy * dy;
        if (dSq > farthestDistSq) {
          farthestDistSq = dSq;
          farthestEnemy = { idx, x: this.enemyManager.x[idx], y: this.enemyManager.y[idx] };
        }
      });

      if (farthestEnemy) {
        this.enemyManager.damageEnemy(farthestEnemy.idx, lDmg, true);
        this.visualEffects.push({
          type: 'plasma_lightning',
          startX: kx,
          startY: ky,
          endX: farthestEnemy.x,
          endY: farthestEnemy.y,
          life: 0.22,
          maxLife: 0.22,
          color: 0xd946ef
        });
        if (this.particleManager) {
          this.particleManager.emitSparks(farthestEnemy.x, farthestEnemy.y, 0xd946ef, 8, 45);
        }
      }
    }
  }

  // 2. EKOR PETIR (Ekor Berduri + Kulit Listrik)
  executeLightningTail(entry, dt) {
    entry.timer -= dt;
    if (entry.timer > 0) return;

    const stats = entry.evoData?.stats || {};
    const cd = (stats.cooldown || 1.15) * this.cooldownMultiplier;
    entry.timer = cd;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const reach = (stats.range || 110) * this.kaiju.currentScale * this.rangeMultiplier;
    const damage = (stats.damage || 65) * this.getEffectiveDamageMultiplier();
    const chainDmg = (stats.chainDamage || 48) * this.getEffectiveDamageMultiplier();
    const maxJumps = stats.chainJumps || 6;
    const jumpRadius = stats.jumpRadius || 95;

    // 360 sweep around Kaiju
    let closestEnemy = null;
    let closestDistSq = Infinity;

    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 15, (idx, dx, dy) => {
      if (!this.enemyManager.active[idx]) return;
      this.enemyManager.damageEnemy(idx, damage, true);
      const dSq = dx * dx + dy * dy;
      if (dSq < closestDistSq) {
        closestDistSq = dSq;
        closestEnemy = { idx, x: this.enemyManager.x[idx], y: this.enemyManager.y[idx] };
      }
    });

    this.damageBuildingsInArc(kx, ky, 0, reach, Math.PI, damage * (stats.buildingDamageMultiplier || 3.8) * 0.25);

    this.visualEffects.push({
      type: 'shockwave',
      x: kx,
      y: ky,
      radius: reach,
      life: 0.2,
      maxLife: 0.2,
      color: 0x38bdf8
    });

    // Chain lightning from closest enemy
    if (closestEnemy) {
      const visited = new Set([closestEnemy.idx]);
      let currentSource = closestEnemy;

      for (let jump = 0; jump < maxJumps; jump++) {
        let nextTarget = null;
        let nextDistSq = Infinity;

        this.enemyManager.queryEnemiesInRadius(currentSource.x, currentSource.y, jumpRadius, (nIdx, dx, dy) => {
          if (!this.enemyManager.active[nIdx] || visited.has(nIdx)) return;
          const dSq = dx * dx + dy * dy;
          if (dSq < nextDistSq) {
            nextDistSq = dSq;
            nextTarget = { idx: nIdx, x: this.enemyManager.x[nIdx], y: this.enemyManager.y[nIdx] };
          }
        });

        if (!nextTarget) break;

        visited.add(nextTarget.idx);
        this.enemyManager.damageEnemy(nextTarget.idx, chainDmg, true);

        this.visualEffects.push({
          type: 'plasma_lightning',
          startX: currentSource.x,
          startY: currentSource.y,
          endX: nextTarget.x,
          endY: nextTarget.y,
          life: 0.16,
          maxLife: 0.16,
          color: 0x67e8f9
        });

        if (this.particleManager) {
          this.particleManager.emitSparks(nextTarget.x, nextTarget.y, 0x67e8f9, 4, 30);
        }

        currentSource = nextTarget;
      }
    }
  }

  // 3. ARTILERI BERAT (Meriam Punggung + Roket Punggung)
  executeHeavyArtillery(entry, dt) {
    entry.timer -= dt;
    if (entry.timer > 0) return;

    const stats = entry.evoData?.stats || {};
    const cd = (stats.cooldown || 2.7) * this.cooldownMultiplier;
    entry.timer = cd;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = (stats.range || 330) * this.rangeMultiplier;
    const damage = (stats.damage || 195) * this.getEffectiveDamageMultiplier();
    const blastRadius = stats.blastRadius || 80;

    // Find densest cluster within range
    let bestX = kx + Math.cos(this.kaiju.rotation || 0) * (range * 0.7);
    let bestY = ky + Math.sin(this.kaiju.rotation || 0) * (range * 0.7);
    let maxClusterCount = 0;

    if (this.enemyManager && typeof this.enemyManager.queryEnemiesInRadius === 'function') {
      const candidates = [];
      this.enemyManager.queryEnemiesInRadius(kx, ky, range, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        candidates.push({ x: this.enemyManager.x[idx], y: this.enemyManager.y[idx] });
      });

      if (candidates.length > 0) {
        for (let i = 0; i < Math.min(candidates.length, 12); i++) {
          const c = candidates[i];
          let neighborCount = 0;
          for (let j = 0; j < candidates.length; j++) {
            const dx = candidates[j].x - c.x;
            const dy = candidates[j].y - c.y;
            if (dx * dx + dy * dy <= 3600) neighborCount++;
          }
          if (neighborCount > maxClusterCount) {
            maxClusterCount = neighborCount;
            bestX = c.x;
            bestY = c.y;
          }
        }
      }
    }

    const angle = Math.atan2(bestY - ky, bestX - kx);
    const speed = stats.shellSpeed || 270;
    const dist = Math.hypot(bestX - kx, bestY - ky);
    const flightTime = Math.max(0.35, dist / speed);
    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    this.spawnProjectile(
      kx, ky, vx, vy,
      damage,
      true, true,
      stats.buildingDamageMultiplier || 5.8,
      0xf59e0b,
      flightTime,
      true,
      blastRadius,
      -1,
      0,
      bestX,
      bestY
    );

    if (this.particleManager) {
      this.particleManager.emitDebris(kx, ky, 0xf59e0b, 12, 60);
      if (typeof this.particleManager.emitCollapseFlash === 'function') {
        this.particleManager.emitCollapseFlash(kx, ky, 25);
      }
    }
  }

  // 4. GEMPA BUMI (Injakan Getar + Cakar)
  executeCataclysmQuake(entry, dt) {
    entry.timer -= dt;
    if (entry.timer > 0) return;

    const stats = entry.evoData?.stats || {};
    const cd = (stats.cooldown || 1.75) * this.cooldownMultiplier;
    entry.timer = cd;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const rot = this.kaiju.rotation || 0;
    const scale = this.kaiju.currentScale;
    const fLen = (stats.fissureLength || 170) * scale * this.rangeMultiplier;
    const fWidth = (stats.fissureWidth || 36) * scale;
    const shockRadius = (stats.shockwaveRadius || 105) * scale;
    const damage = (stats.damage || 95) * this.getEffectiveDamageMultiplier();
    const slowFactor = stats.slowFactor || 0.35;

    const endX = kx + Math.cos(rot) * fLen;
    const endY = ky + Math.sin(rot) * fLen;

    // Circular shockwave around Kaiju (ground only)
    this.enemyManager.queryEnemiesInRadius(kx, ky, shockRadius, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      if (this.enemyManager.isAir[idx] === 1) return;
      this.enemyManager.damageEnemy(idx, damage * 0.7, false);
      this.enemyManager.vx[idx] *= slowFactor;
      this.enemyManager.vy[idx] *= slowFactor;
    });

    this.visualEffects.push({
      type: 'shockwave',
      x: kx,
      y: ky,
      radius: shockRadius,
      life: 0.25,
      maxLife: 0.25,
      color: 0xf97316
    });

    // Fissure line through ground
    const dx = endX - kx;
    const dy = endY - ky;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq > 0) {
      this.enemyManager.queryEnemiesInRadius(kx + dx * 0.5, ky + dy * 0.5, fLen * 0.6 + 20, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        if (this.enemyManager.isAir[idx] === 1) return;
        const ex = this.enemyManager.x[idx];
        const ey = this.enemyManager.y[idx];
        const t = Math.max(0, Math.min(1, ((ex - kx) * dx + (ey - ky) * dy) / lineLenSq));
        const px = kx + t * dx;
        const py = ky + t * dy;
        const distSq = (ex - px) * (ex - px) + (ey - py) * (ey - py);
        if (distSq <= (fWidth * 0.5) * (fWidth * 0.5)) {
          this.enemyManager.damageEnemy(idx, damage, false);
          this.enemyManager.vx[idx] *= slowFactor;
          this.enemyManager.vy[idx] *= slowFactor;
        }
      });
    }

    this.damageBuildingsInLine(kx, ky, endX, endY, fWidth, damage * (stats.buildingDamageMultiplier || 6.2) * 0.25);

    this.visualEffects.push({
      type: 'fissure',
      startX: kx,
      startY: ky,
      endX,
      endY,
      width: fWidth,
      life: 0.55,
      maxLife: 0.55,
      color: 0xf97316
    });

    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(220, 0.007);
    }
  }

  // 5. LASER PENGHANCUR (Mata Laser + Meriam Punggung)
  updateAnnihilationLaser(entry, dt) {
    const stats = entry.evoData?.stats || {};
    const cd = (stats.cooldown || 3.1) * this.cooldownMultiplier;
    const sweepDuration = stats.sweepDuration || 1.5;
    const sweepArcDeg = stats.sweepArc || 75;
    const reach = (stats.range || 230) * this.rangeMultiplier;
    const dps = (stats.damagePerSec || 175) * this.getEffectiveDamageMultiplier();
    const beamWidth = stats.beamWidth || 9;

    if (!entry.isFiring) {
      entry.timer -= dt;
      if (entry.timer <= 0) {
        entry.isFiring = true;
        entry.firingTimer = sweepDuration;
        entry.baseSweepAngle = this.kaiju.rotation || 0;
      }
      return;
    }

    entry.firingTimer -= dt;
    if (entry.firingTimer <= 0) {
      entry.isFiring = false;
      entry.timer = cd;
      return;
    }

    const progress = 1 - (entry.firingTimer / sweepDuration);
    const sweepRad = Phaser.Math.DegToRad(sweepArcDeg);
    const currentAngle = entry.baseSweepAngle + (progress - 0.5) * sweepRad;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const endX = kx + Math.cos(currentAngle) * reach;
    const endY = ky + Math.sin(currentAngle) * reach;

    const dx = endX - kx;
    const dy = endY - ky;
    const lineLenSq = dx * dx + dy * dy;

    if (lineLenSq > 0) {
      const frameDmg = dps * dt;
      this.enemyManager.queryEnemiesInRadius(kx + dx * 0.5, ky + dy * 0.5, reach * 0.6 + 10, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        const ex = this.enemyManager.x[idx];
        const ey = this.enemyManager.y[idx];
        const t = Math.max(0, Math.min(1, ((ex - kx) * dx + (ey - ky) * dy) / lineLenSq));
        const px = kx + t * dx;
        const py = ky + t * dy;
        const distSq = (ex - px) * (ex - px) + (ey - py) * (ey - py);
        if (distSq <= (beamWidth + 10) * (beamWidth + 10)) {
          this.enemyManager.damageEnemy(idx, frameDmg, true);
        }
      });

      this.damageBuildingsInLine(kx, ky, endX, endY, beamWidth + 6, frameDmg * (stats.buildingDamageMultiplier || 5.0) * 0.35);
    }

    this.attackGraphics.lineStyle(beamWidth * 2.2, 0xec4899, 0.4);
    this.attackGraphics.lineBetween(kx, ky, endX, endY);
    this.attackGraphics.lineStyle(beamWidth, 0x8b5cf6, 0.85);
    this.attackGraphics.lineBetween(kx, ky, endX, endY);
    this.attackGraphics.lineStyle(Math.max(2, beamWidth * 0.3), 0xffffff, 1.0);
    this.attackGraphics.lineBetween(kx, ky, endX, endY);

    this.attackGraphics.fillStyle(0xec4899, 0.8);
    this.attackGraphics.fillCircle(endX, endY, 6);
    this.attackGraphics.fillStyle(0xffffff, 1.0);
    this.attackGraphics.fillCircle(endX, endY, 3);
  }

  // 6. BENTENG BERDURI (Duri Tubuh + Perisai Energi)
  updateThornBastion(entry, dt) {
    const stats = entry.evoData?.stats || {};
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;

    entry.timer -= dt;
    if (entry.timer <= 0) {
      entry.timer = 1.2 * this.cooldownMultiplier;

      const blastRadius = (stats.eruptionRadius || 95) * this.kaiju.currentScale;
      const pulseDmg = (stats.passiveRetaliationDmg || 45) * this.getEffectiveDamageMultiplier();

      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2;
        const vx = Math.cos(angle) * 340;
        const vy = Math.sin(angle) * 340;
        this.spawnProjectile(kx, ky, vx, vy, pulseDmg * 0.6, true, true, 1.5, 0x10b981, 0.45);
      }

      this.visualEffects.push({
        type: 'shockwave',
        x: kx,
        y: ky,
        radius: blastRadius,
        life: 0.18,
        maxLife: 0.18,
        color: 0x10b981
      });
    }

    if (this.kaiju && this.kaiju.maxShield < (stats.shieldCapacity || 300)) {
      this.kaiju.setEnergyShield(stats.shieldCapacity || 300, stats.rechargeDelay || 3.5);
      this.kaiju.reflectChance = stats.reflectChance || 0.70;
      this.kaiju.reflectMultiplier = stats.reflectMultiplier || 2.2;
    }
  }

  // =========================================================================
  // UTILITY & PROJECTILE UPDATES
  // =========================================================================

  damageBuildingsInLine(x1, y1, x2, y2, width, cellDmg) {
    if (!this.cityGrid) return;
    const cg = this.cityGrid;
    const cellSize = cg.cellSize || 4;
    const minX = Math.min(x1, x2) - width;
    const maxX = Math.max(x1, x2) + width;
    const minY = Math.min(y1, y2) - width;
    const maxY = Math.max(y1, y2) + width;
    const minCol = Math.max(0, Math.floor(minX / cellSize));
    const maxCol = Math.min(cg.cols - 1, Math.floor(maxX / cellSize));
    const minRow = Math.max(0, Math.floor(minY / cellSize));
    const maxRow = Math.min(cg.rows - 1, Math.floor(maxY / cellSize));

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lineLenSq = dx * dx + dy * dy;
    if (lineLenSq === 0) return;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellIdx = row * cg.cols + col;
        const cType = cg.types[cellIdx];
        if (cType !== CELL_TYPES.BUILDING && cType !== CELL_TYPES.BUILDING_DETAIL) continue;
        if (cg.hp[cellIdx] <= 0) continue;

        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const t = Math.max(0, Math.min(1, ((cx - x1) * dx + (cy - y1) * dy) / lineLenSq));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const distSq = (cx - projX) * (cx - projX) + (cy - projY) * (cy - projY);

        if (distSq <= (width * 0.5) * (width * 0.5)) {
          const res = cg.damageCell(col, row, cellDmg * this.buildingDmgMultiplier);
          if (res && res.destroyed && this.scene && typeof this.scene.onCellDestroyed === 'function') {
            this.scene.onCellDestroyed({ col, row, worldX: cx, worldY: cy }, res.building, false);
          }
        }
      }
    }
  }

  damageBuildingsInRadius(x, y, radius, cellDmg) {
    if (!this.cityGrid) return;
    const cg = this.cityGrid;
    const cellSize = cg.cellSize || 4;
    const cellRadius = Math.ceil(radius / cellSize);
    const centerCol = Math.floor(x / cellSize);
    const centerRow = Math.floor(y / cellSize);
    const minCol = Math.max(0, centerCol - cellRadius);
    const maxCol = Math.min(cg.cols - 1, centerCol + cellRadius);
    const minRow = Math.max(0, centerRow - cellRadius);
    const maxRow = Math.min(cg.rows - 1, centerRow + cellRadius);
    const r2 = radius * radius;

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellIdx = row * cg.cols + col;
        if (cellIdx < 0 || cellIdx >= cg.totalCells) continue;
        const cType = cg.types[cellIdx];
        if (cType !== CELL_TYPES.BUILDING && cType !== CELL_TYPES.BUILDING_DETAIL) continue;
        if (cg.hp[cellIdx] <= 0) continue;

        const cx = col * cellSize + cellSize / 2;
        const cy = row * cellSize + cellSize / 2;
        const distSq = (cx - x) * (cx - x) + (cy - y) * (cy - y);
        if (distSq <= r2) {
          const res = cg.damageCell(col, row, cellDmg * this.buildingDmgMultiplier);
          if (res && res.destroyed && this.scene && typeof this.scene.onCellDestroyed === 'function') {
            this.scene.onCellDestroyed({ col, row, worldX: cx, worldY: cy }, res.building, false);
          }
        }
      }
    }
  }

  damageBuildingsInArc(kx, ky, angle, reach, halfArc, cellDmg) {
    const cg = this.cityGrid;
    const cellRadius = Math.ceil(reach / cg.cellSize);
    const centerCol = Math.floor(kx / cg.cellSize);
    const centerRow = Math.floor(ky / cg.cellSize);

    for (let r = -cellRadius; r <= cellRadius; r++) {
      for (let c = -cellRadius; c <= cellRadius; c++) {
        const col = centerCol + c;
        const row = centerRow + r;
        if (col < 0 || col >= cg.cols || row < 0 || row >= cg.rows) continue;

        const cellX = col * cg.cellSize + cg.cellSize / 2;
        const cellY = row * cg.cellSize + cg.cellSize / 2;
        const dx = cellX - kx;
        const dy = cellY - ky;
        const distSq = dx * dx + dy * dy;

        if (distSq <= reach * reach) {
          const cellAngle = Math.atan2(dy, dx);
          const angleDiff = Math.abs(Phaser.Math.Angle.Wrap(cellAngle - angle));

          if (angleDiff <= halfArc) {
            const res = cg.damageCell(col, row, cellDmg * this.buildingDmgMultiplier);
            if (res && res.destroyed && this.scene.onCellDestroyed) {
              this.scene.onCellDestroyed({ col, row, worldX: cellX, worldY: cellY }, res.building, false);
            }
          }
        }
      }
    }
  }

  /**
   * Reflector passive: deflects enemy bullet into a friendly piercing bolt
   */
  reflectEnemyBullet(x, y, multiplier = 1.0) {
    const nearest = this.enemyManager.getNearestEnemyInRadius(x, y, 220);
    let angle = Math.random() * Math.PI * 2;
    if (nearest) {
      angle = Math.atan2(nearest.y - y, nearest.x - x);
    }
    const vx = Math.cos(angle) * 360;
    const vy = Math.sin(angle) * 360;
    this.spawnProjectile(x, y, vx, vy, 28 * multiplier, true, true, 1.5, 0x10b981, 0.7);

    if (this.particleManager) {
      this.particleManager.emitSparks(x, y, 0x10b981, 6, 40);
    }
  }

  updateVisualEffects(dt) {
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const fx = this.visualEffects[i];
      fx.life -= dt;
      const progress = 1 - (fx.life / fx.maxLife);

      if (fx.type === 'claw' || fx.type === 'tail_sweep') {
        const currentRadius = fx.radius * (0.8 + progress * 0.2);
        const startRad = fx.angle - Phaser.Math.DegToRad(fx.arcAngle / 2);
        const endRad = fx.angle + Phaser.Math.DegToRad(fx.arcAngle / 2);
        this.attackGraphics.lineStyle(3, fx.color, 1 - progress);
        this.attackGraphics.beginPath();
        this.attackGraphics.arc(fx.x, fx.y, currentRadius, startRad, endRad);
        this.attackGraphics.strokePath();
      } else if (fx.type === 'lightning') {
        this.attackGraphics.lineStyle(1.5, fx.color, 1 - progress);
        this.attackGraphics.lineBetween(fx.startX, fx.startY, fx.endX, fx.endY);
      } else if (fx.type === 'shockwave') {
        const currentR = fx.radius * progress;
        this.attackGraphics.lineStyle(2.5, fx.color, 1 - progress);
        this.attackGraphics.strokeCircle(fx.x, fx.y, currentR);
      } else if (fx.type === 'fissure') {
        const alpha = Math.max(0, 1 - progress);
        this.attackGraphics.lineStyle(Math.max(2, (fx.width || 20) * (1 - progress * 0.4)), fx.color || 0xf97316, alpha);
        this.attackGraphics.lineBetween(fx.startX, fx.startY, fx.endX, fx.endY);
        // Inner molten hot crack
        this.attackGraphics.lineStyle(Math.max(1, (fx.width || 20) * 0.25 * (1 - progress)), 0xfef08a, alpha);
        this.attackGraphics.lineBetween(fx.startX, fx.startY, fx.endX, fx.endY);
      } else if (fx.type === 'plasma_lightning') {
        const alpha = Math.max(0, 1 - progress);
        this.attackGraphics.lineStyle(2.5, fx.color || 0x38bdf8, alpha);
        // 2-segment jagged lightning
        const mx = (fx.startX + fx.endX) * 0.5 + (Math.sin(progress * 20) * 16);
        const my = (fx.startY + fx.endY) * 0.5 + (Math.cos(progress * 20) * 16);
        this.attackGraphics.beginPath();
        this.attackGraphics.moveTo(fx.startX, fx.startY);
        this.attackGraphics.lineTo(mx, my);
        this.attackGraphics.lineTo(fx.endX, fx.endY);
        this.attackGraphics.strokePath();
      }

      if (fx.life <= 0) {
        this.visualEffects.splice(i, 1);
      }
    }
  }

  updateProjectiles(dt) {
    this.projGraphics.clear();
    const cg = this.cityGrid;

    for (let i = 0; i < this.maxProjectiles; i++) {
      if (!this.projActive[i]) continue;

      this.projLife[i] -= dt;
      if (this.projLife[i] <= 0) {
        this.despawnProjectile(i);
        continue;
      }

      const px = this.projX[i];
      const py = this.projY[i];

      // Homing behavior for rockets
      if (this.projIsRocket[i]) {
        let hasTarget = false;
        let tx = 0;
        let ty = 0;
        const tIdx = this.projTargetIdx[i];
        const tId = this.projTargetId[i];

        if (tIdx >= 0 && this.enemyManager && typeof this.enemyManager.isTargetValid === 'function' && this.enemyManager.isTargetValid(tIdx, tId)) {
          tx = this.enemyManager.x[tIdx];
          ty = this.enemyManager.y[tIdx];
          this.projLastTargetX[i] = tx;
          this.projLastTargetY[i] = ty;
          this.projHasLastTarget[i] = 1;
          hasTarget = true;
        } else {
          // Target died or slot recycled! Retarget nearest active enemy within 220px
          let retarget = null;
          if (this.enemyManager && typeof this.enemyManager.getNearestEnemy === 'function') {
            retarget = this.enemyManager.getNearestEnemy(px, py, 220);
          }
          if (retarget) {
            this.projTargetIdx[i] = retarget.idx;
            this.projTargetId[i] = retarget.id;
            tx = retarget.x;
            ty = retarget.y;
            this.projLastTargetX[i] = tx;
            this.projLastTargetY[i] = ty;
            this.projHasLastTarget[i] = 1;
            hasTarget = true;
          } else if (this.projHasLastTarget[i]) {
            // Fly straight to last recorded target position, then detonate
            tx = this.projLastTargetX[i];
            ty = this.projLastTargetY[i];
            const distToLast = Math.hypot(tx - px, ty - py);
            if (distToLast <= 18) {
              this.explodeRocket(px, py, this.projDamage[i], this.projBlastRadius[i]);
              this.despawnProjectile(i);
              continue;
            }
            hasTarget = true;
          }
        }

        if (hasTarget) {
          const toTx = tx - px;
          const toTy = ty - py;
          const distToT = Math.hypot(toTx, toTy);
          if (distToT > 1.0 && !isNaN(distToT)) {
            const targetAngle = Math.atan2(toTy, toTx);
            const curVx = this.projVx[i];
            const curVy = this.projVy[i];
            const curSpeed = Math.hypot(curVx, curVy);
            const safeSpeed = (curSpeed > 10 && !isNaN(curSpeed)) ? curSpeed : 260;
            const curAngle = Math.atan2(curVy, curVx);
            const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - curAngle);
            const maxSteer = 6.5 * dt;
            const steer = Math.min(Math.abs(angleDiff), maxSteer) * Math.sign(angleDiff);
            const newAngle = curAngle + steer;
            this.projVx[i] = Math.cos(newAngle) * safeSpeed;
            this.projVy[i] = Math.sin(newAngle) * safeSpeed;
          }
        }

        // Rocket smoke puff
        if (Math.random() < 0.35 && this.particleManager && typeof this.particleManager.emitDust === 'function') {
          this.particleManager.emitDust(px, py, 1, 0.4);
        }
      }

      this.projX[i] += this.projVx[i] * dt;
      this.projY[i] += this.projVy[i] * dt;

      const canAir = this.projCanHitAir[i] === 1;
      const canGround = this.projCanHitGround[i] === 1;
      const damage = this.projDamage[i];

      // Enemy hit test
      let hit = false;
      if (this.enemyManager && typeof this.enemyManager.queryEnemiesInRadius === 'function') {
        this.enemyManager.queryEnemiesInRadius(this.projX[i], this.projY[i], 16, (enemyIdx) => {
          if (hit || !this.enemyManager.active[enemyIdx]) return;
          const isAir = this.enemyManager.isAir[enemyIdx] === 1;
          if ((isAir && canAir) || (!isAir && canGround)) {
            hit = true;

            if (this.projIsRocket[i]) {
              // AOE Blast
              this.explodeRocket(this.projX[i], this.projY[i], damage, this.projBlastRadius[i]);
            } else {
              this.enemyManager.damageEnemy(enemyIdx, damage, canAir);
              if (this.particleManager && typeof this.particleManager.emitDebris === 'function') {
                this.particleManager.emitDebris(this.projX[i], this.projY[i], this.projColor[i], 3, 30);
              }
            }
          }
        });
      }

      if (hit) {
        this.despawnProjectile(i);
        continue;
      }

      // Building hit test
      if (cg) {
        const col = Math.floor(this.projX[i] / cg.cellSize);
        const row = Math.floor(this.projY[i] / cg.cellSize);
        if (col >= 0 && col < cg.cols && row >= 0 && row < cg.rows) {
          const cellIdx = row * cg.cols + col;
          const cType = cg.types[cellIdx];
          if ((cType === CELL_TYPES.BUILDING || cType === CELL_TYPES.BUILDING_DETAIL) && cg.hp[cellIdx] > 0) {
            if (this.projIsRocket[i]) {
              this.explodeRocket(this.projX[i], this.projY[i], damage, this.projBlastRadius[i]);
            } else {
              const res = cg.damageCell(col, row, damage * this.projBuildingMult[i] * 0.25);
              if (res && res.destroyed && this.scene && typeof this.scene.onCellDestroyed === 'function') {
                this.scene.onCellDestroyed({ col, row, worldX: this.projX[i], worldY: this.projY[i] }, res.building, false);
              }
            }
            this.despawnProjectile(i);
            continue;
          }
        }
      }

      // Render Projectile Tracer
      if (this.projIsRocket[i]) {
        this.projGraphics.fillStyle(0xf97316, 1.0);
        this.projGraphics.fillRect(this.projX[i] - 2, this.projY[i] - 2, 4, 4);
      } else {
        this.projGraphics.fillStyle(this.projColor[i], 0.95);
        this.projGraphics.fillRect(this.projX[i] - 1.5, this.projY[i] - 1.5, 3, 3);
        this.projGraphics.fillStyle(0xffffff, 1.0);
        this.projGraphics.fillRect(this.projX[i] - 0.5, this.projY[i] - 0.5, 1, 1);
      }
    }
  }

  explodeRocket(x, y, damage, blastRadius) {
    const r = blastRadius || 30;

    // 1. Safe AOE damage to enemies (hits ground and air)
    if (this.enemyManager && typeof this.enemyManager.queryEnemiesInRadius === 'function') {
      this.enemyManager.queryEnemiesInRadius(x, y, r, (idx) => {
        if (!this.enemyManager.active[idx]) return;
        if (typeof this.enemyManager.damageEnemy === 'function') {
          this.enemyManager.damageEnemy(idx, damage, true);
        }
      });
    }

    // 2. Safe Flatten building cells in blast radius (with boundary checks)
    if (this.cityGrid) {
      const cg = this.cityGrid;
      const cellSize = cg.cellSize || 4;
      const cellRadius = Math.ceil(r / cellSize);
      const centerCol = Math.floor(x / cellSize);
      const centerRow = Math.floor(y / cellSize);
      const minCol = Math.max(0, centerCol - cellRadius);
      const maxCol = Math.min(cg.cols - 1, centerCol + cellRadius);
      const minRow = Math.max(0, centerRow - cellRadius);
      const maxRow = Math.min(cg.rows - 1, centerRow + cellRadius);
      const r2 = r * r;
      const cellDmg = damage * 0.35;

      for (let row = minRow; row <= maxRow; row++) {
        for (let col = minCol; col <= maxCol; col++) {
          const cellIdx = row * cg.cols + col;
          if (cellIdx < 0 || cellIdx >= cg.totalCells) continue;
          const cType = cg.types[cellIdx];
          if (cType !== CELL_TYPES.BUILDING && cType !== CELL_TYPES.BUILDING_DETAIL) continue;
          if (cg.hp[cellIdx] <= 0) continue;

          const cx = col * cellSize + cellSize / 2;
          const cy = row * cellSize + cellSize / 2;
          const distSq = (cx - x) * (cx - x) + (cy - y) * (cy - y);
          if (distSq <= r2) {
            const res = cg.damageCell(col, row, cellDmg);
            if (res && res.destroyed && this.scene && typeof this.scene.onCellDestroyed === 'function') {
              this.scene.onCellDestroyed({ col, row, worldX: cx, worldY: cy }, res.building, false);
            }
          }
        }
      }
    }

    // 3. Explosion visual & shockwave
    if (this.particleManager) {
      if (typeof this.particleManager.emitCollapseFlash === 'function') {
        this.particleManager.emitCollapseFlash(x, y, Math.min(r * 0.8, 35));
      }
      if (typeof this.particleManager.emitDebris === 'function') {
        this.particleManager.emitDebris(x, y, 0xf97316, 8, 55);
      }
    }

    // Safe optional audio hook
    if (this.scene && this.scene.audioManager && typeof this.scene.audioManager.play === 'function') {
      try { this.scene.audioManager.play('rocket_explosion'); } catch (_) {}
    }

    this.visualEffects.push({
      type: 'shockwave',
      x,
      y,
      radius: r,
      life: 0.2,
      maxLife: 0.2,
      color: 0xf97316
    });
  }

  /**
   * Resets all weapons back to starting state (Claw Lv 1) and clears modifiers (RunState reset)
   */
  reset() {
    this.equippedWeapons.clear();
    this.visualEffects = [];
    this.burningCells = [];
    this.firePools = [];
    this.attackGraphics.clear();
    this.projGraphics.clear();

    for (let i = 0; i < this.maxProjectiles; i++) {
      this.projActive[i] = 0;
      this.projTargetIdx[i] = -1;
      this.projTargetId[i] = 0;
      this.projHasLastTarget[i] = 0;
    }
    this.freeProjIndices = [];
    for (let i = this.maxProjectiles - 1; i >= 0; i--) {
      this.freeProjIndices.push(i);
    }
    this.activeProjCount = 0;

    this.damageMultiplier = 1.0;
    this.bloodRageMultiplier = 1.0;
    this.cooldownMultiplier = 1.0;
    this.buildingDmgMultiplier = 1.0;
    this.rangeMultiplier = 1.0;
    this.thornDamage = 0;
    this.thornRadius = 0;

    // Remove electric skin overlay and all visual mutations
    if (this.kaiju) {
      if (typeof this.kaiju.clearAllMutations === 'function') {
        this.kaiju.clearAllMutations();
      } else if (this.kaiju.hasLayer && this.kaiju.hasLayer('skin_overlay')) {
        this.kaiju.removeLayer('skin_overlay');
      }
      this.kaiju.reflectChance = 0;
      this.kaiju.reflectMultiplier = 1.0;
    }

    // Re-equip starting weapon
    this.equipWeapon('claw', 1);
  }

  /**
   * Destroys all visual resources
   */
  destroy() {
    this.reset();
    if (this.attackGraphics) this.attackGraphics.destroy();
    if (this.projGraphics) this.projGraphics.destroy();
  }
}
