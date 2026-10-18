import { XP_CONFIG } from '../config/xp.js';

/**
 * XpSystem - Tahap 4A
 * High-performance XP Crystal Pool and Progression Engine.
 * Features:
 * - Pre-allocated Structure-of-Arrays (SoA) for 300 crystals (zero runtime GC)
 * - Single-batch Graphics rendering at depth 11
 * - Proximity merging when pool gets crowded
 * - Dynamic magnetic attraction towards Kaiju with distance acceleration
 * - Progressive level curve (Level 2 in ~20s normal play)
 * - RunState lifecycle (cleanly resets on death/revival)
 */
export class XpSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Function} onLevelUpCallback - Called when Kaiju levels up: (newLevel) => void
   */
  constructor(scene, onLevelUpCallback) {
    this.scene = scene;
    this.onLevelUpCallback = onLevelUpCallback;

    // Progression state (RunState)
    this.level = 1;
    this.currentXp = 0;
    this.targetXp = XP_CONFIG.getXpRequiredForLevel(1);

    // Passive modifiers
    this.magnetRadiusBonus = 0;
    this.eliteXpMultiplier = 1.0;

    // Pre-allocated Crystal Pool (Capacity 300)
    this.maxCrystals = XP_CONFIG.maxCrystals;
    this.x = new Float32Array(this.maxCrystals);
    this.y = new Float32Array(this.maxCrystals);
    this.vx = new Float32Array(this.maxCrystals);
    this.vy = new Float32Array(this.maxCrystals);
    this.value = new Uint16Array(this.maxCrystals);
    this.active = new Uint8Array(this.maxCrystals);
    this.life = new Float32Array(this.maxCrystals);
    this.sparkleTimer = new Float32Array(this.maxCrystals);

    this.freeIndices = [];
    for (let i = this.maxCrystals - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
    this.activeCount = 0;

    // Batch Graphics for all crystals (Zero GC, Depth 11)
    this.graphics = this.scene.add.graphics().setDepth(11);
  }

  /**
   * Spawns an XP crystal at the specified world coordinate.
   * If the crystal pool is getting full, merges into a nearby crystal.
   * @param {number} x - World X
   * @param {number} y - World Y
   * @param {number} value - XP amount (1 for citizen, 2 for police, etc.)
   */
  spawnCrystal(x, y, value = 1) {
    if (value <= 0) return -1;

    // Apply Penjarah / Scavenger multiplier to vehicle/military drops (value >= 4)
    if (value >= 4 && this.eliteXpMultiplier > 1.0) {
      value = Math.round(value * this.eliteXpMultiplier);
    }

    // Proximity merge check: if pool is crowded, merge into closest crystal within radius
    if (this.activeCount >= XP_CONFIG.mergeThresholdCount) {
      const mergeR2 = XP_CONFIG.mergeRadius * XP_CONFIG.mergeRadius;
      for (let i = 0; i < this.maxCrystals; i++) {
        if (!this.active[i]) continue;
        const dx = this.x[i] - x;
        const dy = this.y[i] - y;
        if (dx * dx + dy * dy <= mergeR2) {
          this.value[i] += value;
          this.life[i] = XP_CONFIG.crystalLifetime; // Refresh life
          return i;
        }
      }
    }

    if (this.freeIndices.length === 0) {
      // Force merge with nearest crystal if pool is completely full
      let closestIdx = -1;
      let closestDistSq = Infinity;
      for (let i = 0; i < this.maxCrystals; i++) {
        if (!this.active[i]) continue;
        const dx = this.x[i] - x;
        const dy = this.y[i] - y;
        const d2 = dx * dx + dy * dy;
        if (d2 < closestDistSq) {
          closestDistSq = d2;
          closestIdx = i;
        }
      }
      if (closestIdx !== -1) {
        this.value[closestIdx] += value;
        return closestIdx;
      }
      return -1;
    }

    const idx = this.freeIndices.pop();
    this.active[idx] = 1;
    this.x[idx] = x;
    this.y[idx] = y;

    // Initial slight ejection pop
    const angle = Math.random() * Math.PI * 2;
    const speed = 18 + Math.random() * 22;
    this.vx[idx] = Math.cos(angle) * speed;
    this.vy[idx] = Math.sin(angle) * speed;

    this.value[idx] = value;
    this.life[idx] = XP_CONFIG.crystalLifetime;
    this.sparkleTimer[idx] = Math.random() * 2.0;
    this.activeCount++;

    return idx;
  }

  /**
   * Directly adds XP to player's bar without dropping crystals (used for cell/building damage)
   * @param {number} amount 
   */
  addDirectXp(amount) {
    if (amount <= 0) return;
    this.currentXp += amount;
    this.checkLevelUp();
  }

  /**
   * Checks if current XP meets or exceeds the target for next level(s)
   */
  checkLevelUp() {
    while (this.currentXp >= this.targetXp) {
      this.currentXp -= this.targetXp;
      this.level++;
      this.targetXp = XP_CONFIG.getXpRequiredForLevel(this.level);

      if (this.onLevelUpCallback) {
        this.onLevelUpCallback(this.level);
      }
    }
  }

  /**
   * Recycles a crystal slot cleanly back into the free list
   */
  despawnCrystal(idx) {
    if (!this.active[idx]) return;
    this.active[idx] = 0;
    this.freeIndices.push(idx);
    this.activeCount = Math.max(0, this.activeCount - 1);
  }

  /**
   * Per-frame update: moves crystals, handles magnetic pull, collects, and renders batch.
   * @param {number} dt - delta in seconds
   * @param {Object} kaiju - Kaiju instance
   * @param {Phaser.Cameras.Scene2D.Camera} camera 
   */
  update(dt, kaiju, camera) {
    this.graphics.clear();
    if (this.activeCount === 0) return;

    const kx = kaiju.x;
    const ky = kaiju.y;
    const effectiveMagnetRadius = (XP_CONFIG.magnet.baseRadius + this.magnetRadiusBonus) * kaiju.currentScale;
    const magnetR2 = effectiveMagnetRadius * effectiveMagnetRadius;
    const pickupR2 = XP_CONFIG.magnet.pickupDistance * XP_CONFIG.magnet.pickupDistance * (kaiju.currentScale * kaiju.currentScale);

    // Camera view bounds with margin for culling
    const margin = 32;
    const viewLeft = camera.worldView.x - margin;
    const viewRight = camera.worldView.right + margin;
    const viewTop = camera.worldView.y - margin;
    const viewBottom = camera.worldView.bottom + margin;

    for (let i = 0; i < this.maxCrystals; i++) {
      if (!this.active[i]) continue;

      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.despawnCrystal(i);
        continue;
      }

      this.sparkleTimer[i] += dt * 3.5;

      // Friction drag on initial ejection velocity
      this.vx[i] *= 0.88;
      this.vy[i] *= 0.88;

      const cx = this.x[i];
      const cy = this.y[i];
      const dx = kx - cx;
      const dy = ky - cy;
      const distSq = dx * dx + dy * dy;

      // 1. Pickup Check
      if (distSq <= pickupR2) {
        this.addDirectXp(this.value[i]);
        this.despawnCrystal(i);
        continue;
      }

      // 2. Magnetic Attraction
      if (distSq <= magnetR2) {
        const dist = Math.sqrt(distSq) || 1;
        // Closer crystals accelerate much faster into Kaiju
        const pullFactor = 1.0 - (dist / effectiveMagnetRadius);
        const currentPullSpeed = XP_CONFIG.magnet.pullSpeedBase + (XP_CONFIG.magnet.pullSpeedMax - XP_CONFIG.magnet.pullSpeedBase) * pullFactor;

        this.x[i] += (dx / dist) * currentPullSpeed * dt;
        this.y[i] += (dy / dist) * currentPullSpeed * dt;
      } else {
        // Natural idle glide
        this.x[i] += this.vx[i] * dt;
        this.y[i] += this.vy[i] * dt;
      }

      // 3. Render Batch (if inside camera frustum)
      const renderX = this.x[i];
      const renderY = this.y[i];

      if (renderX >= viewLeft && renderX <= viewRight && renderY >= viewTop && renderY <= viewBottom) {
        const isBig = this.value[i] >= 10;
        const sparkle = Math.sin(this.sparkleTimer[i]) > 0.4;

        if (isBig) {
          // Emerald / High Value Crystal (7x7 Diamond)
          this.graphics.fillStyle(0x047857, 0.95);
          this.graphics.fillRect(renderX - 3, renderY - 1, 6, 2);
          this.graphics.fillRect(renderX - 1, renderY - 3, 2, 6);

          this.graphics.fillStyle(sparkle ? 0x6ee7b7 : 0x10b981, 1.0);
          this.graphics.fillRect(renderX - 2, renderY - 2, 4, 4);

          this.graphics.fillStyle(0xffffff, sparkle ? 1.0 : 0.6);
          this.graphics.fillRect(renderX - 1, renderY - 1, 2, 2);
        } else {
          // Cyan Standard Crystal (5x5 Diamond)
          this.graphics.fillStyle(0x0891b2, 0.9);
          this.graphics.fillRect(renderX - 2, renderY - 1, 4, 2);
          this.graphics.fillRect(renderX - 1, renderY - 2, 2, 4);

          this.graphics.fillStyle(sparkle ? 0xa5f3fc : 0x22d3ee, 1.0);
          this.graphics.fillRect(renderX - 1, renderY - 1, 2, 2);

          this.graphics.fillStyle(0xffffff, sparkle ? 0.9 : 0.4);
          this.graphics.fillRect(renderX, renderY, 1, 1);
        }
      }
    }
  }

  /**
   * Resets progression and all active crystals cleanly (RunState reset)
   */
  reset() {
    this.level = 1;
    this.currentXp = 0;
    this.targetXp = XP_CONFIG.getXpRequiredForLevel(1);
    this.magnetRadiusBonus = 0;
    this.eliteXpMultiplier = 1.0;

    for (let i = 0; i < this.maxCrystals; i++) {
      this.active[i] = 0;
    }
    this.freeIndices = [];
    for (let i = this.maxCrystals - 1; i >= 0; i--) {
      this.freeIndices.push(i);
    }
    this.activeCount = 0;
    this.graphics.clear();
  }

  /**
   * Destroys resources
   */
  destroy() {
    this.reset();
    if (this.graphics) this.graphics.destroy();
  }
}
