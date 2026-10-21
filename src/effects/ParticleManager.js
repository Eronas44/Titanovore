import { GAME_CONFIG } from '../config/game.js';
import { PRNG } from '../utils/prng.js';
import { EFFECTS_CONFIG } from '../config/effects.js';
import { LightPoolManager } from './LightPoolManager.js';

/**
 * High-Performance Particle & Glow Manager - Tahap 2B, 5A & 6B
 * Pre-allocated zero-GC object pools for debris shards, dust clouds, squish splatters,
 * rocket smoke trails, and additive ground light pools.
 * Mendukung 3 tingkat kualitas efek (rendah, sedang, tinggi).
 */
export class ParticleManager {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;
    this.prng = new PRNG(1337);

    // LightPoolManager untuk additive ground glow
    this.lightPoolManager = new LightPoolManager(scene);

    // Kualitas aktif
    this.currentQuality = EFFECTS_CONFIG.currentQuality;
    const qPreset = EFFECTS_CONFIG.qualityPresets[this.currentQuality] || EFFECTS_CONFIG.qualityPresets.high;
    this.particleMultiplier = qPreset.particleMultiplier || 1.0;

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

    // 3. Sparks & Blood Splatters Pool (Max 80)
    this.maxSparks = Math.max(80, maxBloodSparks || 50);
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

    // 4. Smoke Trail Puffs Pool (Max 80 - roket & asap kerusakan tubuh HP rendah)
    this.maxSmoke = 80;
    this.smokePool = [];
    this.freeSmokeIndices = [];
    for (let i = 0; i < this.maxSmoke; i++) {
      this.smokePool.push({
        active: false,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        radius: 2,
        maxRadius: 8,
        color: 0x64748b,
        alpha: 0.45,
        life: 0,
        maxLife: 0.6
      });
      this.freeSmokeIndices.push(i);
    }

    // Dedicated Graphics GameObjects for zero-overhead batch drawing
    this.dustGraphics = this.scene.add.graphics().setDepth(16); // Above rubble & kaiju feet
    this.debrisGraphics = this.scene.add.graphics().setDepth(17); // Above dust
    this.sparkGraphics = this.scene.add.graphics().setDepth(18); // Topmost flash & sparks
    this.smokeGraphics = this.scene.add.graphics().setDepth(16.5); // Smoke trails
  }

  /**
   * Mengatur kualitas efek (rendah, sedang, tinggi)
   * @param {string} qualityKey 
   */
  setQuality(qualityKey) {
    this.currentQuality = qualityKey;
    EFFECTS_CONFIG.currentQuality = qualityKey;
    const qPreset = EFFECTS_CONFIG.qualityPresets[qualityKey] || EFFECTS_CONFIG.qualityPresets.high;
    this.particleMultiplier = qPreset.particleMultiplier || 1.0;
    if (this.lightPoolManager) {
      this.lightPoolManager.setQuality(qualityKey);
    }
  }

  /**
   * Memunculkan kolam cahaya di tanah
   */
  spawnLightPool(x, y, radius, color, duration, maxAlpha, expand) {
    if (this.lightPoolManager) {
      return this.lightPoolManager.spawnLightPool(x, y, radius, color, duration, maxAlpha, expand);
    }
    return null;
  }

  /**
   * Memunculkan cincin kejut cahaya di tanah
   */
  spawnShockwave(x, y, radius, color, duration) {
    if (this.lightPoolManager) {
      return this.lightPoolManager.spawnShockwave(x, y, radius, color, duration);
    }
    return null;
  }

  /**
   * Kilatan keruntuhan bangunan atau ledakan unit
   */
  emitCollapseFlash(x, y, radius = 20) {
    if (this.lightPoolManager) {
      this.lightPoolManager.spawnLightPool(x, y, radius * 1.5, 0xffffff, 0.16, 0.65);
    }
    this.emitSparks(x, y, 0xffffff, 3, 35);
  }

  /**
   * Ledakan dramatis saat Kaiju tumbang / mati
   */
  emitKaijuDeathExplosion(x, y) {
    if (this.lightPoolManager) {
      this.lightPoolManager.spawnLightPool(x, y, 90, 0xef4444, 0.8, 0.75, true);
      this.lightPoolManager.spawnShockwave(x, y, 80, 0xf97316, 0.45);
    }
    this.emitDebris(x, y, 0x15803d, 24, 110);
    this.emitDebris(x, y, 0xef4444, 20, 95);
    this.emitSparks(x, y, 0xfde047, 24, 85);
    this.emitDust(x, y, 10, 1.4);
    for (let i = 0; i < 8; i++) {
      const ox = (Math.random() - 0.5) * 30;
      const oy = (Math.random() - 0.5) * 30;
      this.emitSmokeTrail(x + ox, y + oy);
    }
  }

  /**
   * Spawns colored debris shards radiating outward from (x, y)
   */
  emitDebris(x, y, color, count = 4, speedMax = 70) {
    const finalCount = Math.max(1, Math.round(count * this.particleMultiplier));
    const numColor = typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color;

    for (let i = 0; i < finalCount; i++) {
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
   */
  emitDust(x, y, count = 2, scaleFactor = 1.0) {
    const finalCount = Math.max(1, Math.round(count * this.particleMultiplier));
    const dustColors = [0x3c3845, 0x47424d, 0x585260, 0x2e2a35];

    for (let i = 0; i < finalCount; i++) {
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
      const spd = this.prng.range(15, 60);

      s.active = true;
      s.x = x;
      s.y = y;
      s.vx = Math.cos(angle) * spd;
      s.vy = Math.sin(angle) * spd;
      s.color = 0x8b1a1a;
      s.size = 2;
      s.alpha = 1.0;
      s.maxLife = this.prng.range(0.2, 0.45);
      s.life = s.maxLife;
    }
  }

  /**
   * Spawns sparks/embers at (x, y) with specific color
   */
  emitSparks(x, y, color = 0x38bdf8, count = 6, speed = 60) {
    const finalCount = Math.max(1, Math.round(count * this.particleMultiplier));
    const numColor = typeof color === 'string' ? parseInt(color.replace('#', '0x'), 16) : color;

    for (let i = 0; i < finalCount; i++) {
      if (this.freeSparkIndices.length === 0) break;
      const idx = this.freeSparkIndices.pop();
      const s = this.sparkPool[idx];

      const angle = this.prng.range(0, Math.PI * 2);
      const spd = this.prng.range(15, speed);

      s.active = true;
      s.x = x + this.prng.range(-2, 2);
      s.y = y + this.prng.range(-2, 2);
      s.vx = Math.cos(angle) * spd;
      s.vy = Math.sin(angle) * spd;
      s.color = numColor;
      s.size = this.prng.rangeInt(1, 3);
      s.alpha = 1.0;
      s.maxLife = this.prng.range(0.15, 0.45);
      s.life = s.maxLife;
    }
  }

  /**
   * Spawns subtle drifting smoke trail puff (misalnya di belakang roket)
   */
  emitSmokeTrail(x, y, scale = 1.0, color = 0x64748b) {
    if (this.freeSmokeIndices.length === 0) return;
    const idx = this.freeSmokeIndices.pop();
    const sm = this.smokePool[idx];

    sm.active = true;
    sm.x = x;
    sm.y = y;
    sm.vx = this.prng.range(-4, 4);
    sm.vy = this.prng.range(-8, -2); // Upward float
    sm.radius = 2.0 * scale;
    sm.maxRadius = this.prng.range(6, 12) * scale;
    sm.color = color;
    sm.alpha = 0.45;
    sm.maxLife = this.prng.range(0.4, 0.7);
    sm.life = sm.maxLife;
  }

  /**
   * Main per-frame update loop
   */
  update(time, delta) {
    const dt = delta / 1000;

    this.dustGraphics.clear();
    this.debrisGraphics.clear();
    this.sparkGraphics.clear();
    this.smokeGraphics.clear();

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
      d.vx *= 0.94;
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
      p.vx *= 0.90;
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
        this.sparkGraphics.fillCircle(s.x, s.y, s.size * (1 - progress * 0.5));
      } else {
        this.sparkGraphics.fillRect(s.x - 1, s.y - 1, s.size, s.size);
      }
    }

    // 4. Update Smoke Trails
    for (let i = 0; i < this.maxSmoke; i++) {
      const sm = this.smokePool[i];
      if (!sm.active) continue;

      sm.life -= dt;
      if (sm.life <= 0) {
        sm.active = false;
        this.freeSmokeIndices.push(i);
        continue;
      }

      sm.x += sm.vx * dt;
      sm.y += sm.vy * dt;

      const progress = 1 - (sm.life / sm.maxLife);
      const currentRadius = sm.radius + (sm.maxRadius - sm.radius) * progress;
      const currentAlpha = sm.alpha * (1 - progress);

      this.smokeGraphics.fillStyle(sm.color, currentAlpha);
      this.smokeGraphics.fillCircle(sm.x, sm.y, currentRadius);
    }

    // 5. Update LightPoolManager
    if (this.lightPoolManager) {
      this.lightPoolManager.update(dt);
    }
  }

  /**
   * Resets all particle & light pools cleanly
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

    this.freeSmokeIndices = [];
    for (let i = 0; i < this.maxSmoke; i++) {
      this.smokePool[i].active = false;
      this.freeSmokeIndices.push(i);
    }

    this.dustGraphics.clear();
    this.debrisGraphics.clear();
    this.sparkGraphics.clear();
    this.smokeGraphics.clear();

    if (this.lightPoolManager) {
      this.lightPoolManager.reset();
    }
  }

  destroy() {
    this.reset();
    this.dustGraphics.destroy();
    this.debrisGraphics.destroy();
    this.sparkGraphics.destroy();
    this.smokeGraphics.destroy();
    if (this.lightPoolManager) {
      this.lightPoolManager.destroy();
    }
  }
}
