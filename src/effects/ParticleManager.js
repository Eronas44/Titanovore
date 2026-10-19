import { GAME_CONFIG } from '../config/game.js';
import { PRNG } from '../utils/prng.js';

/**
 * High-Performance Particle Manager - Tahap 2B & 5A
 * Pre-allocated zero-GC object pools for debris shards, dust clouds, and squish splatters.
 * Optimized with O(1) free index stacks to eliminate Array.find scans under heavy combat.
 * Rendered using dedicated pooled graphics batches to guarantee 0 GC pauses and 60 FPS.
 */
export class ParticleManager {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    this.prng = new PRNG(1337);

    const { maxDebrisParticles, maxDustParticles, maxBloodSparks } = GAME_CONFIG.destruction;

    // 1. Debris Particle Pool (Max 600)
    this.maxDebris = maxDebrisParticles || 600;
    this.debrisPool = [];
    this.freeDebrisIndices = [];
    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisPool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: 0xffffff,
        size: 2,
        alpha: 1.0,
        life: 0,
        maxLife: 1.0
      });
      this.freeDebrisIndices.push(i);
    }

    // 2. Dust Cloud Pool (Max 150)
    this.maxDust = maxDustParticles || 150;
    this.dustPool = [];
    this.freeDustIndices = [];
    for (let i = 0; i < this.maxDust; i++) {
      this.dustPool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 3,
        maxRadius: 12,
        color: 0x47424d,
        alpha: 0.5,
        life: 0,
        maxLife: 1.0
      });
      this.freeDustIndices.push(i);
    }

    // 3. Sparks & Blood Splatters Pool (Max 50)
    this.maxSparks = maxBloodSparks || 50;
    this.sparkPool = [];
    this.freeSparkIndices = [];
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        color: 0x8b1a1a,
        size: 2,
        alpha: 1.0,
        life: 0,
        maxLife: 0.5
      });
      this.freeSparkIndices.push(i);
    }

    // Dedicated Graphics GameObjects for zero-overhead batch drawing
    this.dustGraphics = this.scene.add.graphics().setDepth(16); // Above rubble & kaiju feet
    this.debrisGraphics = this.scene.add.graphics().setDepth(17); // Above dust
    this.sparkGraphics = this.scene.add.graphics().setDepth(18); // Topmost flash & blood
  }

  /**
   * Spawns colored debris shards radiating outward from (x, y)
   * @param {number} x 
   * @param {number} y 
   * @param {number|string} color - Hex color
   * @param {number} count 
   * @param {number} speedMax 
   */
  emitDebris(x, y, color, count = 4, speedMax = 70) {
    const numColor = typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color;

    for (let i = 0; i < count; i++) {
      if (this.freeDebrisIndices.length === 0) break;
      const idx = this.freeDebrisIndices.pop();
      const p = this.debrisPool[idx];

      const angle = this.prng.range(0, Math.PI * 2);
      const spd = this.prng.range(20, speedMax);

      p.active = true;
      p.x = x + this.prng.range(-2, 2);
      p.y = y + this.prng.range(-2, 2);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color = numColor;
      p.size = this.prng.rangeInt(1, 3);
      p.alpha = 1.0;
      p.maxLife = this.prng.range(0.3, 0.7);
      p.life = p.maxLife;
    }
  }

  /**
   * Spawns expanding, drifting dust clouds at (x, y)
   * @param {number} x 
   * @param {number} y 
   * @param {number} count 
   * @param {number} scaleFactor 
   */
  emitDust(x, y, count = 2, scaleFactor = 1.0) {
    const dustColors = [0x3c3845, 0x47424d, 0x585260, 0x2e2a35];

    for (let i = 0; i < count; i++) {
      if (this.freeDustIndices.length === 0) break;
      const idx = this.freeDustIndices.pop();
      const d = this.dustPool[idx];

      const angle = this.prng.range(0, Math.PI * 2);
      const spd = this.prng.range(6, 25) * scaleFactor;

      d.active = true;
      d.x = x + this.prng.range(-4, 4);
      d.y = y + this.prng.range(-4, 4);
      d.vx = Math.cos(angle) * spd;
      d.vy = Math.sin(angle) * spd - 6; // Slight upward drift
      d.radius = this.prng.range(2.5, 4.5);
      d.maxRadius = this.prng.range(8, 16) * scaleFactor;
      d.color = this.prng.choice(dustColors);
      d.alpha = 0.55;
      d.maxLife = this.prng.range(0.5, 0.95);
      d.life = d.maxLife;
    }
  }

  /**
   * Spawns small red splatter when a human is crushed
   */
  emitBloodSplatter(x, y) {
    for (let i = 0; i < 4; i++) {
      if (this.freeSparkIndices.length === 0) break;
      const idx = this.freeSparkIndices.pop();
      const s = this.sparkPool[idx];

      const angle = this.prng.range(0, Math.PI * 2);
      const spd = this.prng.range(15, 45);

      s.active = true;
      s.x = x;
      s.y = y;
      s.vx = Math.cos(angle) * spd;
      s.vy = Math.sin(angle) * spd;
      s.color = 0x8a1818; // Dark red
      s.size = 2;
      s.alpha = 1.0;
      s.maxLife = 0.4;
      s.life = s.maxLife;
    }
  }

  /**
   * Spawns brief orange additive fire spark / flash on major collapses
   */
  emitCollapseFlash(x, y, radius = 20) {
    if (this.freeSparkIndices.length === 0) return;
    const idx = this.freeSparkIndices.pop();
    const s = this.sparkPool[idx];

    s.active = true;
    s.x = x;
    s.y = y;
    s.vx = 0;
    s.vy = 0;
    s.color = 0xffa500;
    s.size = radius;
    s.alpha = 0.85;
    s.maxLife = 0.15;
    s.life = s.maxLife;
  }

  /**
   * Special dramatic effects when a building completely collapses
   * @param {number} x 
   * @param {number} y 
   * @param {string} baseColor 
   * @param {number} heightLevel 
   */
  emitFinalBuildingCollapse(x, y, baseColor, heightLevel = 2) {
    const scale = Math.max(1.0, heightLevel / 3);
    const debrisCount = Math.round(18 * scale);
    const dustCount = Math.round(8 * scale);

    this.emitDebris(x, y, baseColor, debrisCount, 90 * scale);
    this.emitDust(x, y, dustCount, 1.8 * scale);
    this.emitCollapseFlash(x, y, 28 * scale);
  }

  /**
   * Massive catastrophic death explosion when Kaiju HP reaches 0
   * @param {number} x 
   * @param {number} y 
   */
  emitKaijuDeathExplosion(x, y) {
    // 1. Shards of Kaiju scales, armor, and flesh radiating outwards
    this.emitDebris(x, y, 0x3fa66b, 25, 95); // Emerald scales
    this.emitDebris(x, y, 0x1f4d32, 20, 80); // Dark armor chunks
    this.emitDebris(x, y, 0x8b1a1a, 15, 65); // Blood / tissue
    this.emitDebris(x, y, 0xffd23f, 10, 110); // Yellow energy sparks

    // 2. Billowing massive dust & smoke plumes
    this.emitDust(x, y, 12, 2.5);
    this.emitDust(x + 10, y - 5, 8, 2.0);
    this.emitDust(x - 10, y + 5, 8, 2.0);

    // 3. Blinding additive light bursts
    this.emitCollapseFlash(x, y, 40);
    this.emitCollapseFlash(x, y, 25);
  }

  /**
   * Main per-frame update loop.
   * Updates particle physics and performs zero-overhead batch draw.
   * @param {number} dt - Frame delta in seconds
   */
  update(dt) {
    this.dustGraphics.clear();
    this.debrisGraphics.clear();
    this.sparkGraphics.clear();

    // 1. Update Dust Clouds
    for (let i = 0; i < this.maxDust; i++) {
      const d = this.dustPool[i];
      if (!d.active) continue;

      d.life -= dt;
      if (d.life <= 0) {
        d.active = false;
        this.freeDustIndices.push(i);
        continue;
      }

      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 0.94; // Drag
      d.vy *= 0.94;

      const progress = 1 - (d.life / d.maxLife);
      const currentRadius = d.radius + (d.maxRadius - d.radius) * progress;
      const currentAlpha = d.alpha * (1 - progress);

      this.dustGraphics.fillStyle(d.color, currentAlpha);
      this.dustGraphics.fillCircle(d.x, d.y, currentRadius);
    }

    // 2. Update Debris Shards
    for (let i = 0; i < this.maxDebris; i++) {
      const p = this.debrisPool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        this.freeDebrisIndices.push(i);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.90; // Heavy air drag
      p.vy *= 0.90;

      const progress = 1 - (p.life / p.maxLife);
      const currentAlpha = p.alpha * (1 - progress);

      this.debrisGraphics.fillStyle(p.color, currentAlpha);
      this.debrisGraphics.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }

    // 3. Update Sparks & Splatters
    for (let i = 0; i < this.maxSparks; i++) {
      const s = this.sparkPool[i];
      if (!s.active) continue;

      s.life -= dt;
      if (s.life <= 0) {
        s.active = false;
        this.freeSparkIndices.push(i);
        continue;
      }

      s.x += s.vx * dt;
      s.y += s.vy * dt;

      const progress = 1 - (s.life / s.maxLife);
      const currentAlpha = s.alpha * (1 - progress);

      this.sparkGraphics.fillStyle(s.color, currentAlpha);
      if (s.size > 4) {
        // Light flash circle
        this.sparkGraphics.fillCircle(s.x, s.y, s.size * (1 - progress * 0.5));
      } else {
        this.sparkGraphics.fillRect(s.x - 1, s.y - 1, s.size, s.size);
      }
    }
  }

  /**
   * Resets all particle pools cleanly
   */
  reset() {
    this.freeDebrisIndices = [];
    for (let i = 0; i < this.maxDebris; i++) {
      this.debrisPool[i].active = false;
      this.freeDebrisIndices.push(i);
    }

    this.freeDustIndices = [];
    for (let i = 0; i < this.maxDust; i++) {
      this.dustPool[i].active = false;
      this.freeDustIndices.push(i);
    }

    this.freeSparkIndices = [];
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparkPool[i].active = false;
      this.freeSparkIndices.push(i);
    }

    this.dustGraphics.clear();
    this.debrisGraphics.clear();
    this.sparkGraphics.clear();
  }

  destroy() {
    this.reset();
    this.dustGraphics.destroy();
    this.debrisGraphics.destroy();
    this.sparkGraphics.destroy();
  }
}
