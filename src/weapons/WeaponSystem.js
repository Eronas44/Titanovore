import { WEAPON_CONFIG } from '../config/weapons.js';
import { CELL_TYPES } from '../world/CityGrid.js';

/**
 * WeaponSystem - Tahap 4A
 * High-performance, data-driven automatic weapon engine for the Kaiju.
 * Handles:
 * - Up to 6 equipped weapon slots with per-level progression (1-5) and Lv 5 specials
 * - Auto-targeting using EnemyManager's O(1) Spatial Hash Grid
 * - Pre-allocated 200-projectile pool (zero-GC SoA)
 * - Centralized damage routing to enemies & city grid
 * - Passive multiplier scaling (Carnage, Rapid Fire, Demolisher)
 * - Claw frontal arc swipe, Back Cannon ballistics, Electric Skin aura & chain lightning
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

    // Equipped weapons: Map<id, { id, level, timer, doubleSwipePending, doubleSwipeTimer }>
    this.equippedWeapons = new Map();

    // Passive modifiers
    this.damageMultiplier = 1.0;
    this.cooldownMultiplier = 1.0;
    this.buildingDmgMultiplier = 1.0;
    this.thornDamage = 0;
    this.thornRadius = 0;

    // 1. Pre-allocated Kaiju Projectile Pool (200 slots)
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

    this.freeProjIndices = [];
    for (let i = this.maxProjectiles - 1; i >= 0; i--) {
      this.freeProjIndices.push(i);
    }
    this.activeProjCount = 0;

    // 2. Dedicated Graphics Batches (Zero GC)
    this.attackGraphics = this.scene.add.graphics().setDepth(20); // Above Kaiju, below UI
    this.projGraphics = this.scene.add.graphics().setDepth(18); // Projectiles

    // 3. Transient visual effects queue (slash arcs, lightning bolts)
    this.visualEffects = [];

    // Equip default starting weapon: Claw Level 1
    this.equipWeapon('claw', 1);
  }

  /**
   * Equips a new weapon or upgrades an existing one.
   * @param {string} weaponId - 'claw', 'back_cannon', or 'electric_skin'
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
        timer: 0.1, // Attack soon after acquiring
        doubleSwipePending: false,
        doubleSwipeTimer: 0
      });
    } else {
      const entry = this.equippedWeapons.get(weaponId);
      entry.level = Math.min(5, Math.max(entry.level, level));
    }

    // Special visual layer activation for Electric Skin
    if (weaponId === 'electric_skin' && !this.kaiju.hasLayer('skin_overlay')) {
      this.kaiju.addLayer('skin_overlay', 'kaiju_electric_skin_0');
    }

    return true;
  }

  /**
   * Gets the current level of an equipped weapon (0 if not equipped)
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
   * Spawns a Kaiju projectile.
   */
  spawnProjectile(x, y, vx, vy, damage, canHitAir, canHitGround, buildingMult, color = 0x38bdf8, life = 0.7) {
    if (this.freeProjIndices.length === 0) return -1;
    const idx = this.freeProjIndices.pop();

    this.projActive[idx] = 1;
    this.projX[idx] = x;
    this.projY[idx] = y;
    this.projVx[idx] = vx;
    this.projVy[idx] = vy;
    this.projDamage[idx] = damage * this.damageMultiplier;
    this.projCanHitAir[idx] = canHitAir ? 1 : 0;
    this.projCanHitGround[idx] = canHitGround ? 1 : 0;
    this.projBuildingMult[idx] = buildingMult * this.buildingDmgMultiplier;
    this.projColor[idx] = color;
    this.projLife[idx] = life;
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
    // Clear transient visual graphics
    this.attackGraphics.clear();

    // 1. Update active weapons
    for (const [id, entry] of this.equippedWeapons.entries()) {
      const wDef = WEAPON_CONFIG.weapons[id];
      if (!wDef) continue;

      const lvlData = wDef.levels[entry.level - 1] || wDef.levels[0];
      const effectiveCooldown = lvlData.cooldown * this.cooldownMultiplier;

      // Handle Level 5 Double Swipe delay for Claw
      if (entry.doubleSwipePending) {
        entry.doubleSwipeTimer -= dt;
        if (entry.doubleSwipeTimer <= 0) {
          entry.doubleSwipePending = false;
          this.executeClawAttack(lvlData, true); // Second swipe
        }
      }

      entry.timer -= dt;
      if (entry.timer <= 0) {
        entry.timer = effectiveCooldown;

        if (id === 'claw') {
          this.executeClawAttack(lvlData, false);
          if (lvlData.isDoubleSwipe) {
            entry.doubleSwipePending = true;
            entry.doubleSwipeTimer = lvlData.doubleSwipeDelay || 0.12;
          }
        } else if (id === 'back_cannon') {
          this.executeBackCannonAttack(lvlData);
        } else if (id === 'electric_skin') {
          this.executeElectricSkinAttack(lvlData);
        }
      }
    }

    // 2. Render and age transient visual effects (slash arcs, lightning zaps)
    this.updateVisualEffects(dt);

    // 3. Update Kaiju projectiles
    this.updateProjectiles(dt);
  }

  /**
   * Executes CLAW attack:
   * Sweeps a frontal arc cone in the direction the Kaiju is facing,
   * damaging all ground enemies and smashing building cells in the arc.
   */
  executeClawAttack(lvlData, isSecondSwipe = false) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const angle = this.kaiju.rotation + (isSecondSwipe ? 0.15 : -0.15);
    const reach = lvlData.range * this.kaiju.currentScale;
    const halfArcRad = Phaser.Math.DegToRad(lvlData.arcAngle / 2);
    const damage = lvlData.damage * this.damageMultiplier;

    // 1. Damage ground enemies in frontal arc
    this.enemyManager.queryEnemiesInRadius(kx, ky, reach + 20, (idx, dx, dy, d2) => {
      if (!this.enemyManager.active[idx]) return;
      if (this.enemyManager.isAir[idx] === 1) return; // Claw cannot hit air

      const enemyAngle = Math.atan2(dy, dx);
      const angleDiff = Phaser.Math.Angle.Wrap(enemyAngle - angle);

      if (Math.abs(angleDiff) <= halfArcRad) {
        this.enemyManager.damageEnemy(idx, damage, false);
        this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0xf59e0b, 3, 40);
      }
    });

    // 2. Damage building cells in frontal arc
    const cg = this.cityGrid;
    const cellRadius = Math.ceil(reach / cg.cellSize);
    const centerCol = Math.floor(kx / cg.cellSize);
    const centerRow = Math.floor(ky / cg.cellSize);
    const cellDmg = damage * (lvlData.buildingDamageMultiplier || 2.8) * this.buildingDmgMultiplier * 0.22;

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
          const angleDiff = Phaser.Math.Angle.Wrap(cellAngle - angle);

          if (Math.abs(angleDiff) <= halfArcRad) {
            const res = cg.damageCell(col, row, cellDmg);
            if (res && res.destroyed && this.scene.onCellDestroyed) {
              this.scene.onCellDestroyed({ col, row, worldX: cellX, worldY: cellY }, res.building, false);
            }
          }
        }
      }
    }

    // 3. Queue slash visual effect
    this.visualEffects.push({
      type: 'claw_arc',
      x: kx,
      y: ky,
      angle: angle,
      radius: reach,
      arcAngle: Phaser.Math.DegToRad(lvlData.arcAngle),
      life: 0.14,
      maxLife: 0.14,
      isSecond: isSecondSwipe
    });

    // Subtle screen shake
    this.scene.cameras.main.shake(70, isSecondSwipe ? 0.0035 : 0.0022);
  }

  /**
   * Executes BACK CANNON attack:
   * Finds the nearest enemy in range (ground or air) and fires rapid ballistic projectiles.
   */
  executeBackCannonAttack(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const range = lvlData.range * this.kaiju.currentScale;
    const rangeSq = range * range;

    // Find nearest valid enemy (prioritizes air if close, else nearest ground/air)
    let targetIdx = -1;
    let closestDistSq = Infinity;

    this.enemyManager.queryEnemiesInRadius(kx, ky, range, (idx, dx, dy, d2) => {
      if (!this.enemyManager.active[idx]) return;
      if (d2 < closestDistSq) {
        closestDistSq = d2;
        targetIdx = idx;
      }
    });

    if (targetIdx === -1) return; // No targets in range

    const tx = this.enemyManager.x[targetIdx];
    const ty = this.enemyManager.y[targetIdx];
    const mainAngle = Math.atan2(ty - ky, tx - kx);

    // Muzzle position at Kaiju's dorsal spine
    const muzzleX = kx - Math.cos(this.kaiju.rotation) * 6;
    const muzzleY = ky - Math.sin(this.kaiju.rotation) * 6;

    const count = lvlData.projectileCount || 1;
    const speed = lvlData.projectileSpeed || 300;

    for (let p = 0; p < count; p++) {
      let fireAngle = mainAngle;

      if (lvlData.dualDirection && p >= count / 2) {
        // Level 5 special: fire rear salvo in opposite direction!
        fireAngle = mainAngle + Math.PI + (Math.random() - 0.5) * 0.3;
      } else if (count > 1) {
        // Spread shot
        fireAngle = mainAngle + (p - (count - 1) / 2) * 0.12;
      }

      const vx = Math.cos(fireAngle) * speed;
      const vy = Math.sin(fireAngle) * speed;

      this.spawnProjectile(
        muzzleX,
        muzzleY,
        vx,
        vy,
        lvlData.damage,
        true, // canHitAir
        true, // canHitGround
        lvlData.buildingDamageMultiplier || 0.75,
        0x38bdf8, // Sky blue tracer
        lvlData.projectileLife || 0.65
      );
    }

    // Muzzle flash particle
    this.particleManager.emitDebris(muzzleX, muzzleY, 0xf97316, 3, 35);
  }

  /**
   * Executes ELECTRIC SKIN attack:
   * Pulses an electric aura around the Kaiju, dealing instant damage to all enemies within radius.
   * At Level 5, arcs jump to 2 additional secondary targets in proximity!
   */
  executeElectricSkinAttack(lvlData) {
    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const radius = lvlData.range * this.kaiju.currentScale;
    const damage = lvlData.damage * this.damageMultiplier;

    const hitEnemies = [];

    // 1. Primary Zap: hit all targets within aura radius
    this.enemyManager.queryEnemiesInRadius(kx, ky, radius, (idx, dx, dy, d2) => {
      if (!this.enemyManager.active[idx]) return;

      this.enemyManager.damageEnemy(idx, damage, true); // canHitAir = true
      hitEnemies.push(idx);

      // Visual lightning bolt from Kaiju to primary target
      this.visualEffects.push({
        type: 'lightning_zap',
        x1: kx,
        y1: ky,
        x2: this.enemyManager.x[idx],
        y2: this.enemyManager.y[idx],
        life: 0.12,
        maxLife: 0.12,
        color: 0x38bdf8
      });

      this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0xfacc15, 2, 35);
    });

    // 2. Level 5 Special: Chain Lightning to secondary nearby enemies!
    if (lvlData.chainTargets > 0 && hitEnemies.length > 0) {
      for (const primaryIdx of hitEnemies) {
        if (!this.enemyManager.active[primaryIdx]) continue;
        const px = this.enemyManager.x[primaryIdx];
        const py = this.enemyManager.y[primaryIdx];
        let chainedCount = 0;

        this.enemyManager.queryEnemiesInRadius(px, py, lvlData.chainRange || 55, (secIdx, dx, dy, d2) => {
          if (chainedCount >= lvlData.chainTargets) return;
          if (secIdx === primaryIdx || !this.enemyManager.active[secIdx]) return;

          this.enemyManager.damageEnemy(secIdx, damage * 0.75, true);
          chainedCount++;

          this.visualEffects.push({
            type: 'lightning_zap',
            x1: px,
            y1: py,
            x2: this.enemyManager.x[secIdx],
            y2: this.enemyManager.y[secIdx],
            life: 0.10,
            maxLife: 0.10,
            color: 0xfacc15
          });

          this.particleManager.emitDebris(this.enemyManager.x[secIdx], this.enemyManager.y[secIdx], 0x38bdf8, 2, 30);
        });
      }
    }

    if (hitEnemies.length > 0) {
      this.scene.cameras.main.shake(60, 0.0018);
    }
  }

  /**
   * Triggers retaliation thorn burst when Kaiju takes damage (from Thorn Shield passive card)
   */
  triggerThornBurst() {
    if (this.thornDamage <= 0) return;

    const kx = this.kaiju.x;
    const ky = this.kaiju.y;
    const radius = this.thornRadius * this.kaiju.currentScale;

    this.enemyManager.queryEnemiesInRadius(kx, ky, radius, (idx, dx, dy, d2) => {
      if (!this.enemyManager.active[idx]) return;
      this.enemyManager.damageEnemy(idx, this.thornDamage * this.damageMultiplier, true);
      this.particleManager.emitDebris(this.enemyManager.x[idx], this.enemyManager.y[idx], 0xf43f5e, 2, 35);
    });

    this.visualEffects.push({
      type: 'thorn_ring',
      x: kx,
      y: ky,
      radius: radius,
      life: 0.12,
      maxLife: 0.12
    });

    this.particleManager.emitDebris(kx, ky, 0xf43f5e, 8, 50);
  }

  /**
   * Updates and draws all transient visual effects (slash sweeps, lightning arcs, thorn rings).
   */
  updateVisualEffects(dt) {
    for (let i = this.visualEffects.length - 1; i >= 0; i--) {
      const v = this.visualEffects[i];
      v.life -= dt;

      if (v.life <= 0) {
        this.visualEffects.splice(i, 1);
        continue;
      }

      const alpha = Math.max(0, v.life / v.maxLife);

      if (v.type === 'claw_arc') {
        // Draw sweeping claw slash arc
        const startAngle = v.angle - v.arcAngle / 2;
        const endAngle = v.angle + v.arcAngle / 2;
        const color = v.isSecond ? 0xf97316 : 0xfbbf24;

        this.attackGraphics.lineStyle(3, color, alpha * 0.95);
        this.attackGraphics.beginPath();
        this.attackGraphics.arc(v.x, v.y, v.radius, startAngle, endAngle, false);
        this.attackGraphics.strokePath();

        // Inner sharp white arc
        this.attackGraphics.lineStyle(1.5, 0xffffff, alpha * 0.9);
        this.attackGraphics.beginPath();
        this.attackGraphics.arc(v.x, v.y, v.radius - 4, startAngle + 0.1, endAngle - 0.1, false);
        this.attackGraphics.strokePath();
      } else if (v.type === 'lightning_zap') {
        // Draw jagged electric arc between two points
        this.attackGraphics.lineStyle(1.5, v.color || 0x38bdf8, alpha * 0.95);
        const midX = (v.x1 + v.x2) / 2 + (Math.random() - 0.5) * 8;
        const midY = (v.y1 + v.y2) / 2 + (Math.random() - 0.5) * 8;

        this.attackGraphics.beginPath();
        this.attackGraphics.moveTo(v.x1, v.y1);
        this.attackGraphics.lineTo(midX, midY);
        this.attackGraphics.lineTo(v.x2, v.y2);
        this.attackGraphics.strokePath();
      } else if (v.type === 'thorn_ring') {
        this.attackGraphics.lineStyle(2, 0xf43f5e, alpha * 0.9);
        this.attackGraphics.strokeCircle(v.x, v.y, v.radius);
      }
    }
  }

  /**
   * Updates all active Kaiju projectiles, checks collisions against enemies & city buildings.
   */
  updateProjectiles(dt) {
    this.projGraphics.clear();
    if (this.activeProjCount === 0) return;

    for (let i = 0; i < this.maxProjectiles; i++) {
      if (!this.projActive[i]) continue;

      this.projLife[i] -= dt;
      if (this.projLife[i] <= 0) {
        this.despawnProjectile(i);
        continue;
      }

      this.projX[i] += this.projVx[i] * dt;
      this.projY[i] += this.projVy[i] * dt;

      const px = this.projX[i];
      const py = this.projY[i];
      const canAir = this.projCanHitAir[i] === 1;
      const canGround = this.projCanHitGround[i] === 1;

      // 1. Collision with Enemies
      let hitEnemy = false;
      this.enemyManager.queryEnemiesInRadius(px, py, 14, (idx, dx, dy, d2) => {
        if (hitEnemy || !this.enemyManager.active[idx]) return;

        const isAir = this.enemyManager.isAir[idx] === 1;
        if ((isAir && canAir) || (!isAir && canGround)) {
          this.enemyManager.damageEnemy(idx, this.projDamage[i], canAir);
          this.particleManager.emitDebris(px, py, this.projColor[i], 3, 30);
          hitEnemy = true;
        }
      });

      if (hitEnemy) {
        this.despawnProjectile(i);
        continue;
      }

      // 2. Collision with Buildings
      const cell = this.cityGrid.getCellAt(px, py);
      if (cell && (cell.type === CELL_TYPES.BUILDING || cell.type === CELL_TYPES.BUILDING_DETAIL)) {
        const bDmg = this.projDamage[i] * this.projBuildingMult[i] * 0.25;
        const res = this.cityGrid.damageCell(cell.col, cell.row, bDmg);

        if (res && res.destroyed && this.scene.onCellDestroyed) {
          this.scene.onCellDestroyed({ col: cell.col, row: cell.row, worldX: px, worldY: py }, res.building, false);
        }
        this.particleManager.emitDebris(px, py, 0x94a3b8, 2, 25);
        this.despawnProjectile(i);
        continue;
      }

      // 3. Render Projectile Tracer
      this.projGraphics.fillStyle(this.projColor[i], 0.95);
      this.projGraphics.fillRect(px - 1.5, py - 1.5, 3, 3);
      this.projGraphics.fillStyle(0xffffff, 1.0);
      this.projGraphics.fillRect(px - 0.5, py - 0.5, 1, 1);
    }
  }

  /**
   * Resets all weapons back to starting state (Claw Lv 1) and clears modifiers (RunState reset)
   */
  reset() {
    this.equippedWeapons.clear();
    this.visualEffects = [];
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
    this.cooldownMultiplier = 1.0;
    this.buildingDmgMultiplier = 1.0;
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
