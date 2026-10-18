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
  spawnProjectile(x, y, vx, vy, damage, canHitAir, canHitGround, buildingMult, color = 0x38bdf8, life = 0.7, isRocket = false, blastRadius = 0) {
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
    this.activeProjCount++;

    return idx;
  }

  /**
   * Recycles a projectile slot back into the free list.
   */
  despawnProjectile(idx) {
    if (!this.projActive[idx]) return;
    this.projActive[idx] = 0;
    this.freeProjIndices.push(idx);
    this.activeProjCount = Math.max(0, this.activeProjCount - 1);
  }

  /**
   * Main per-frame update loop: drives weapon timers, auto-attacks, and updates projectiles.
   * @param {number} dt - delta in seconds
   */
  update(dt) {
    this.attackGraphics.clear();

    // 1. Update active weapons
    for (const [id, entry] of this.equippedWeapons.entries()) {
      const wDef = WEAPON_CONFIG.weapons[id];
      if (!wDef) continue;

      const lvlData = wDef.levels[entry.level - 1] || wDef.levels[0];
      const effectiveCooldown = lvlData.cooldown * this.cooldownMultiplier;

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
    }

    // 2. Update Burning Cells & Lingering Fire
    this.updateBurningCells(dt);
    this.updateFirePools(dt);

    // 3. Render and age transient visual effects
    this.updateVisualEffects(dt);

    // 4. Update Kaiju projectiles
    this.updateProjectiles(dt);
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
            if (cg.types[idx] >= CELL_TYPES.RESIDENTIAL_LOW && cg.types[idx] <= CELL_TYPES.LANDMARK && cg.hp[idx] > 0) {
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
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = lvlData.range * this.rangeMultiplier;
    const count = lvlData.rocketCount || 2;
    const damage = lvlData.damage;
    const blast = lvlData.blastRadius || 30;

    // Target nearest air or ground target
    const nearest = this.enemyManager.getNearestEnemyInRadius(kx, ky, range);
    let targetAngle = this.kaiju.rotation;
    if (nearest) {
      targetAngle = Math.atan2(nearest.y - ky, nearest.x - kx);
    }

    for (let i = 0; i < count; i++) {
      // Salvo spread angle
      const spread = (i - (count - 1) / 2) * 0.35;
      const angle = targetAngle + spread;
      const speed = 260 + (i % 2) * 20;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;

      // Spawn homing rocket
      this.spawnProjectile(kx, ky, vx, vy, damage, true, true, 3.0, 0xf97316, 1.1, true, blast);
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
  // UTILITY & PROJECTILE UPDATES
  // =========================================================================

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
        const nearest = this.enemyManager.getNearestEnemyInRadius(px, py, 180);
        if (nearest) {
          const targetAngle = Math.atan2(nearest.y - py, nearest.x - px);
          const curAngle = Math.atan2(this.projVy[i], this.projVx[i]);
          const angleDiff = Phaser.Math.Angle.Wrap(targetAngle - curAngle);
          const steerSpeed = 6.0 * dt;
          const newAngle = curAngle + Phaser.Math.Clamp(angleDiff, -steerSpeed, steerSpeed);
          const speed = Math.sqrt(this.projVx[i] * this.projVx[i] + this.projVy[i] * this.projVy[i]);
          this.projVx[i] = Math.cos(newAngle) * speed;
          this.projVy[i] = Math.sin(newAngle) * speed;
        }

        // Rocket smoke puff
        if (Math.random() < 0.3 && this.particleManager) {
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
            this.particleManager.emitDebris(this.projX[i], this.projY[i], this.projColor[i], 3, 30);
          }
        }
      });

      if (hit) {
        this.despawnProjectile(i);
        continue;
      }

      // Building hit test
      const col = Math.floor(this.projX[i] / cg.cellSize);
      const row = Math.floor(this.projY[i] / cg.cellSize);
      if (col >= 0 && col < cg.cols && row >= 0 && row < cg.rows) {
        const cellIdx = row * cg.cols + col;
        if (cg.types[cellIdx] >= CELL_TYPES.RESIDENTIAL_LOW && cg.types[cellIdx] <= CELL_TYPES.LANDMARK && cg.hp[cellIdx] > 0) {
          if (this.projIsRocket[i]) {
            this.explodeRocket(this.projX[i], this.projY[i], damage, this.projBlastRadius[i]);
          } else {
            const res = cg.damageCell(col, row, damage * this.projBuildingMult[i] * 0.25);
            if (res && res.destroyed && this.scene.onCellDestroyed) {
              this.scene.onCellDestroyed({ col, row, worldX: this.projX[i], worldY: this.projY[i] }, res.building, false);
            }
          }
          this.despawnProjectile(i);
          continue;
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
    const cg = this.cityGrid;
    const r = blastRadius || 30;

    // AOE damage to enemies
    this.enemyManager.queryEnemiesInRadius(x, y, r, (idx) => {
      if (!this.enemyManager.active[idx]) return;
      this.enemyManager.damageEnemy(idx, damage, true);
    });

    // Flatten building cells in blast radius
    const cellRadius = Math.ceil(r / cg.cellSize);
    const centerCol = Math.floor(x / cg.cellSize);
    const centerRow = Math.floor(y / cg.cellSize);

    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const c = centerCol + dx;
        const rw = centerRow + dy;
        if (c < 0 || c >= cg.cols || rw < 0 || rw >= cg.rows) continue;
        const cx = c * cg.cellSize + cg.cellSize / 2;
        const cy = rw * cg.cellSize + cg.cellSize / 2;
        if ((cx - x) * (cx - x) + (cy - y) * (cy - y) <= r * r) {
          const res = cg.damageCell(c, rw, damage * 0.35);
          if (res && res.destroyed && this.scene.onCellDestroyed) {
            this.scene.onCellDestroyed({ col: c, row: rw, worldX: cx, worldY: cy }, res.building, false);
          }
        }
      }
    }

    // Explosion visual & shockwave
    if (this.particleManager) {
      this.particleManager.emitCollapseFlash(x, y, r * 0.7);
      this.particleManager.emitDebris(x, y, 0xf97316, 8, 50);
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

    // Remove electric skin overlay if present
    if (this.kaiju && this.kaiju.hasLayer('skin_overlay')) {
      this.kaiju.removeLayer('skin_overlay');
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
