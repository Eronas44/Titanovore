import { GAME_CONFIG } from '../config/game.js';
import { PRNG } from '../utils/prng.js';

/**
 * High-Performance Particle Manager - Tahap 2B
 * Pre-allocated object pools for debris shards, dust clouds, and squish splatters.
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
    this.maxDebris = maxDebrisParticles;
    this.debrisPool = [];
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
    }

    // 2. Dust Cloud Pool (Max 150)
    this.maxDust = maxDustParticles;
    this.dustPool = [];
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
    }

    // 3. Sparks & Blood Splatters Pool (Max 50)
    this.maxSparks = maxBloodSparks;
    this.sparkPool = [];
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
      const p = this.debrisPool.find(item => !item.active);
      if (!p) break;

      const angle = this.prng.range(0, Math.PI * 2);
      const spd = this.prng.range(20, speedMax);

      p.active = true;
      p.x = x + this.prng.range(-2, 2);
      p.y = y + this.prng.range(-2, 2);
      p.vx = Math.cos(angle) * spd;
      p.vy = Math.sin(angle) * spd;
      p.color = numColor;
      p.size = this.prng.chance(0.4) ? 3 : 2;
      p.alpha = 1.0;
      p.maxLife = this.prng.range(0.35, 0.7);
      p.life = p.maxLife;
    }
  }

  /**
   * Spawns billowing pixel dust clouds (grayish-brown) expanding and dissipating
   * @param {number} x 
   * @param {number} y 
   * @param {number} count 
   * @param {number} scaleFactor - Scales with building height
   */
  emitDust(x, y, count = 3, scaleFactor = 1.0) {
    const dustColors = [0x3d3945, 0x4f4959, 0x5e5669, 0x332f3b];

    for (let i = 0; i < count; i++) {
      const d = this.dustPool.find(item => !item.active);
      if (!d) break;

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
      const s = this.sparkPool.find(item => !item.active);
      if (!s) break;

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
    const s = this.sparkPool.find(item => !item.active);
    if (s) {
      s.active = true;
      s.x = x;
      s.y = y;
      s.vx = 0;
      s.vy = 0;
      s.color = 0xf97316; // Vivid orange
      s.size = radius;
      s.alpha = 0.75;
      s.maxLife = 0.12; // Very brief flash
      s.life = s.maxLife;
    }
  }

  /**
   * Closing puff effect when the very last cell of a building is destroyed
   * @param {number} x 
   * @param {number} y 
   * @param {number|string} color 
   * @param {number} heightLevel 
   */
  emitFinalBuildingCollapse(x, y, color, heightLevel = 3) {
    const scale = Math.min(2.0, 1.0 + heightLevel * 0.1);
    this.emitDust(x, y, 6, scale);
    this.emitDebris(x, y, color, 8, 55);
    this.emitCollapseFlash(x, y, 14);
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
    this.debrisPool.forEach(p => { p.active = false; });
    this.dustPool.forEach(d => { d.active = false; });
    this.sparkPool.forEach(s => { s.active = false; });
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
