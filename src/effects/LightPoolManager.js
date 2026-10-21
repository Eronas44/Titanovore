import { EFFECTS_CONFIG } from '../config/effects.js';

/**
 * LightPoolManager - Tahap 6B
 * Pengelola kolam cahaya tanah aditif (Additive Ground Light Pools).
 * Menggunakan sprite gradasi radial kecil yang dipakai ulang (zero GC object pool),
 * dirender dengan blend mode ADD pada depth 11.5 (di atas puing/tanah, di bawah kaki/torso).
 * Sangat murah, berperforma tinggi, dan menghasilkan pencahayaan dinamis tanpa shader berat.
 */
export class LightPoolManager {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;

    // Ambil batas dari preset kualitas aktif
    const preset = EFFECTS_CONFIG.qualityPresets[EFFECTS_CONFIG.currentQuality] || EFFECTS_CONFIG.qualityPresets.high;
    this.maxPools = preset.maxLightPools || 60;
    this.glowMultiplier = preset.glowAlphaMultiplier || 1.0;

    this.pool = [];
    this.freeIndices = [];

    // Pre-alokasi seluruh sprite kolam cahaya
    for (let i = 0; i < this.maxPools; i++) {
      const sprite = this.scene.add.sprite(0, 0, 'fx_glow_light_64');
      sprite.setDepth(EFFECTS_CONFIG.lightPools.depth || 11.5);
      sprite.setBlendMode(Phaser.BlendModes.ADD);
      sprite.setVisible(false);
      sprite.setAlpha(0);

      this.pool.push({
        active: false,
        sprite,
        x: 0,
        y: 0,
        radius: 32,
        baseScale: 1.0,
        color: 0xffffff,
        maxAlpha: 0.5,
        life: 0,
        maxLife: 0.5,
        expandRate: 0.1
      });

      this.freeIndices.push(i);
    }
  }

  /**
   * Menyesuaikan konfigurasi saat kualitas efek diubah (rendah, sedang, tinggi)
   * @param {string} qualityKey - 'low' | 'medium' | 'high'
   */
  setQuality(qualityKey) {
    const preset = EFFECTS_CONFIG.qualityPresets[qualityKey] || EFFECTS_CONFIG.qualityPresets.high;
    this.glowMultiplier = preset.glowAlphaMultiplier || 1.0;
  }

  /**
   * Memunculkan kolam cahaya di tanah
   * @param {number} x 
   * @param {number} y 
   * @param {number} radius - Radius cahaya dalam pixel
   * @param {number} color - Hex color (contoh: 0xf97316 untuk api, 0x38bdf8 untuk petir)
   * @param {number} duration - Durasi memudar dalam detik (default 0.45s)
   * @param {number} maxAlpha - Kecerahan puncak (0..1)
   * @param {boolean} expand - Apakah cahaya sedikit melebar saat memudar
   */
  spawnLightPool(x, y, radius = 32, color = 0xf97316, duration = 0.45, maxAlpha = 0.5, expand = true) {
    if (this.freeIndices.length === 0) return null;

    const idx = this.freeIndices.pop();
    const p = this.pool[idx];

    const finalAlpha = Math.min(0.65, maxAlpha * this.glowMultiplier);
    const baseScale = (radius * 2) / 64;

    p.active = true;
    p.x = x;
    p.y = y;
    p.radius = radius;
    p.baseScale = baseScale;
    p.color = color;
    p.maxAlpha = finalAlpha;
    p.life = duration;
    p.maxLife = duration;
    p.expandRate = expand ? 0.18 : 0;

    p.sprite.setPosition(x, y);
    p.sprite.setTint(color);
    p.sprite.setScale(baseScale);
    p.sprite.setAlpha(finalAlpha);
    p.sprite.setVisible(true);

    return idx;
  }

  /**
   * Update per-frame untuk memudarkan kolam cahaya
   * @param {number} dt - Frame delta in seconds
   */
  update(dt) {
    for (let i = 0; i < this.maxPools; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
        p.sprite.setVisible(false);
        p.sprite.setAlpha(0);
        this.freeIndices.push(i);
        continue;
      }

      const progress = 1 - (p.life / p.maxLife);
      const currentAlpha = p.maxAlpha * (1 - progress);
      const currentScale = p.baseScale * (1 + progress * p.expandRate);

      p.sprite.setAlpha(currentAlpha);
      p.sprite.setScale(currentScale);
    }
  }

  get activePools() {
    const active = [];
    for (let i = 0; i < this.maxPools; i++) {
      if (this.pool[i].active) active.push(this.pool[i]);
    }
    return active;
  }

  /**
   * Memunculkan cincin kejut cahaya di tanah
   */
  spawnShockwave(x, y, radius = 40, color = 0xf97316, duration = 0.28) {
    return this.spawnLightPool(x, y, radius, color, duration, 0.65, true);
  }

  /**
   * Mengembalikan jumlah kolam cahaya aktif saat ini (untuk HUD F3 telemetry)
   * @returns {number}
   */
  getActiveCount() {
    return this.maxPools - this.freeIndices.length;
  }

  /**
   * Reset bersih seluruh kolam cahaya (misalnya saat respawn / pergantian scene)
   */
  reset() {
    this.freeIndices = [];
    for (let i = 0; i < this.maxPools; i++) {
      const p = this.pool[i];
      p.active = false;
      if (p.sprite) {
        p.sprite.setVisible(false);
        p.sprite.setAlpha(0);
      }
      this.freeIndices.push(i);
    }
  }

  /**
   * Hancurkan seluruh game object tanpa membocorkan memori
   */
  destroy() {
    this.reset();
    for (let i = 0; i < this.maxPools; i++) {
      if (this.pool[i].sprite) {
        this.pool[i].sprite.destroy();
      }
    }
    this.pool = [];
    this.freeIndices = [];
  }
}
