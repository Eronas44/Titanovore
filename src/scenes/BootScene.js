import Phaser from 'phaser';
import { ASSET_MANIFEST, ASSET_TYPES } from '../assets/AssetManifest.js';
import { TextureGenerator } from '../utils/textureGenerator.js';

/**
 * BootScene - Tahap 6A: Asset Pipeline & Preload
 * Memuat aset gambar dari AssetManifest dengan layar muat berprogres sci-fi.
 * Mendukung fallback prosedural otomatis jika gambar belum tersedia atau gagal dimuat,
 * tanpa crash dan tanpa kotak error.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
    this.failedKeys = new Set();
  }

  preload() {
    // 1. Tampilkan layar muat berprogres HTML
    this.createLoadingUI();

    // 2. Setup listener load error & progress
    this.load.on('loaderror', (file) => {
      this.failedKeys.add(file.key);
      console.warn(`[AssetPipeline] Aset tidak ditemukan / gagal dimuat: "${file.key}" (${file.src}). Mengaktifkan fallback generator prosedural.`);
    });

    this.load.on('progress', (value) => {
      this.updateLoadingProgress(value);
    });

    // 3. Muat seluruh aset dari AssetManifest
    for (const item of ASSET_MANIFEST) {
      if (!item.path) continue;

      if (item.type === ASSET_TYPES.SPRITESHEET) {
        this.load.spritesheet(item.key, item.path, {
          frameWidth: item.frameWidth || 96,
          frameHeight: item.frameHeight || 96,
          endFrame: item.frameCount ? item.frameCount - 1 : undefined
        });
      } else if (item.type === ASSET_TYPES.ATLAS) {
        this.load.atlas(item.key, item.path, item.atlasJson);
      } else {
        this.load.image(item.key, item.path);
      }
    }
  }

  create() {
    // 4. Jalankan generator prosedural untuk seluruh key yang belum ada teksturnya (fallback sempurna)
    TextureGenerator.generateAll(this);

    // 5. Pastikan semua tekstur menggunakan filter NEAREST untuk pixel art tajam tanpa blur
    const allKeys = this.textures.getTextureKeys();
    for (const k of allKeys) {
      if (k !== '__DEFAULT' && k !== '__MISSING') {
        const tex = this.textures.get(k);
        if (tex && typeof tex.setFilter === 'function') {
          tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }

    // 6. Hapus UI loading screen
    this.destroyLoadingUI();

    // 7. Mulai adegan utama gameplay
    this.scene.start('GameScene');
  }

  /**
   * Membuat layar muat HTML sci-fi dengan progress bar
   */
  createLoadingUI() {
    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.id = 'asset-boot-loader';
    this.loadingOverlay.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: radial-gradient(circle at center, #14121e 0%, #06050a 100%);
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 99999;
      font-family: 'Rajdhani', -apple-system, sans-serif;
      color: #f1f5f9;
      pointer-events: none;
    `;

    this.loadingOverlay.innerHTML = `
      <div style="text-align: center; max-width: 420px; width: 85%;">
        <div style="font-size: 26px; font-weight: 800; letter-spacing: 4px; color: #4ade80; text-shadow: 0 0 16px rgba(74, 222, 128, 0.4); margin-bottom: 4px;">
          TITANOVORE
        </div>
        <div style="font-size: 11px; font-weight: 600; letter-spacing: 2px; color: #94a3b8; margin-bottom: 24px; text-transform: uppercase;">
          MEMUAT PIPELINE ASET & INTI KAIJU
        </div>
        <div style="width: 100%; height: 6px; background: rgba(30, 41, 59, 0.8); border-radius: 3px; overflow: hidden; border: 1px solid rgba(74, 222, 128, 0.2); box-shadow: 0 0 10px rgba(0,0,0,0.6);">
          <div id="boot-load-bar" style="width: 0%; height: 100%; background: linear-gradient(90deg, #22c55e, #38bdf8); box-shadow: 0 0 8px #38bdf8; transition: width 0.08s ease;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 8px; font-size: 11px; color: #64748b; font-family: monospace;">
          <span id="boot-load-status">MEMERIKSA ASET GAMBAR...</span>
          <span id="boot-load-pct">0%</span>
        </div>
      </div>
    `;

    const root = document.getElementById('ui-root') || document.body;
    root.appendChild(this.loadingOverlay);

    this.progressBar = this.loadingOverlay.querySelector('#boot-load-bar');
    this.progressPct = this.loadingOverlay.querySelector('#boot-load-pct');
    this.progressStatus = this.loadingOverlay.querySelector('#boot-load-status');
  }

  /**
   * Update progress bar
   */
  updateLoadingProgress(val) {
    const pct = Math.min(100, Math.max(0, Math.round(val * 100)));
    if (this.progressBar) {
      this.progressBar.style.width = `${pct}%`;
    }
    if (this.progressPct) {
      this.progressPct.textContent = `${pct}%`;
    }
    if (this.progressStatus) {
      if (pct < 40) {
        this.progressStatus.textContent = 'MEMUAT SPRITE KAIJU...';
      } else if (pct < 80) {
        this.progressStatus.textContent = 'MENYIAPKAN LAYER MUTASI...';
      } else {
        this.progressStatus.textContent = 'MEMVALIDASI TEKSTUR...';
      }
    }
  }

  /**
   * Menghapus UI loading screen
   */
  destroyLoadingUI() {
    if (this.loadingOverlay && this.loadingOverlay.parentNode) {
      this.loadingOverlay.parentNode.removeChild(this.loadingOverlay);
      this.loadingOverlay = null;
    }
  }
}
