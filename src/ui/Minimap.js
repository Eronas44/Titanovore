import { DISTRICTS_CONFIG } from '../config/districts.js';
import { WORLD_CONFIG } from '../config/world.js';
import { CELL_TYPES } from '../world/CityGrid.js';

/**
 * Minimap.js - Tahap 5A
 * Lightweight, high-performance tactical HTML5 Canvas minimap.
 * Features:
 * - 6 District color-coded zones with translucent overlays
 * - Real-time rubble and city destruction density rendering
 * - Kaiju GPS tracking with rotation indicator
 * - Military threat cluster heat dots
 * - Compact (130x130) and Expanded Tactical ([N] key, 340x340) modes
 * - 1 Hz throttled rendering for zero impact on 60 FPS gameplay
 */
export class Minimap {
  /**
   * @param {HTMLElement} rootElement 
   * @param {Object} scene 
   */
  constructor(rootElement, scene) {
    this.root = rootElement;
    this.scene = scene;
    this.worldWidth = WORLD_CONFIG.worldWidth;
    this.worldHeight = WORLD_CONFIG.worldHeight;

    this.isExpanded = false;
    this.lastRenderTime = 0;
    this.renderInterval = DISTRICTS_CONFIG.minimap.renderIntervalMs || 1000;

    this.mount();
  }

  /**
   * Builds the Minimap DOM elements inside #ui-root
   */
  mount() {
    this.container = document.createElement('div');
    this.container.className = 'minimap-wrapper';
    this.container.id = 'minimap-wrapper';
    this.container.innerHTML = `
      <div class="minimap-header">
        <span class="minimap-title">RADAR KOTA</span>
        <span class="minimap-hint">[N] PERBESAR</span>
      </div>
      <canvas id="minimap-canvas" class="minimap-canvas" width="130" height="130"></canvas>
      <div class="minimap-footer" id="minimap-current-district">PUSAT KOTA</div>
    `;

    this.root.appendChild(this.container);

    this.canvas = this.container.querySelector('#minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.districtLabel = this.container.querySelector('#minimap-current-district');
    this.hintLabel = this.container.querySelector('.minimap-hint');

    // Click handler to toggle expanded view
    this.container.addEventListener('click', () => {
      this.toggleExpanded();
    });
  }

  /**
   * Toggles between compact (130x130) and expanded (340x340) tactical radar
   */
  toggleExpanded() {
    this.isExpanded = !this.isExpanded;
    if (this.isExpanded) {
      this.container.classList.add('expanded');
      this.canvas.width = DISTRICTS_CONFIG.minimap.expandedSize || 340;
      this.canvas.height = DISTRICTS_CONFIG.minimap.expandedSize || 340;
      if (this.hintLabel) this.hintLabel.textContent = '[N] TUTUP';
    } else {
      this.container.classList.remove('expanded');
      this.canvas.width = DISTRICTS_CONFIG.minimap.compactSize || 130;
      this.canvas.height = DISTRICTS_CONFIG.minimap.compactSize || 130;
      if (this.hintLabel) this.hintLabel.textContent = '[N] PERBESAR';
    }
    this.renderNow();
  }

  /**
   * Per-frame update throttled to 1 Hz to guarantee 0 FPS overhead
   */
  update(time) {
    if (time - this.lastRenderTime >= this.renderInterval) {
      this.lastRenderTime = time;
      this.renderNow();
    }
  }

  /**
   * Renders radar view onto canvas
   */
  renderNow() {
    if (!this.ctx || !this.scene) return;

    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    const scaleX = w / this.worldWidth;
    const scaleY = h / this.worldHeight;

    // 1. Background Fill
    ctx.fillStyle = '#09080e';
    ctx.fillRect(0, 0, w, h);

    // 2. Render District Zones
    const districts = this.scene.districts;
    if (districts) {
      // Coarse 16x16 district sample overlay
      const sampleStep = 8;
      const stepWorld = this.worldWidth / sampleStep;
      for (let sy = 0; sy < sampleStep; sy++) {
        for (let sx = 0; sx < sampleStep; sx++) {
          const wx = (sx + 0.5) * stepWorld;
          const wy = (sy + 0.5) * stepWorld;
          const dId = districts.getDistrictIdAt(wx, wy);
          const d = districts.districtMap.get(dId);
          if (d) {
            ctx.fillStyle = d.minimapColor || 'rgba(56, 189, 248, 0.15)';
            ctx.fillRect(sx * (w / sampleStep), sy * (h / sampleStep), (w / sampleStep) + 0.5, (h / sampleStep) + 0.5);
          }
        }
      }

      // Draw Downtown & District Ring Outlines
      const cx = (this.worldWidth / 2) * scaleX;
      const cy = (this.worldHeight / 2) * scaleY;

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, WORLD_CONFIG.downtownRadius * scaleX, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(245, 158, 11, 0.25)';
      ctx.beginPath();
      ctx.arc(cx, cy, WORLD_CONFIG.commercialRadius * scaleX, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(16, 185, 129, 0.20)';
      ctx.beginPath();
      ctx.arc(cx, cy, WORLD_CONFIG.residentialRadius * scaleX, 0, Math.PI * 2);
      ctx.stroke();

      // Southeast Industrial boundary
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.30)';
      ctx.strokeRect(2100 * scaleX, 2000 * scaleY, (this.worldWidth - 2100) * scaleX, (this.worldHeight - 2000) * scaleY);
    }

    // 3. Render Canal Line
    const cityData = this.scene.cityData;
    if (cityData && cityData.canal && cityData.canal.points) {
      ctx.strokeStyle = '#0284c7';
      ctx.lineWidth = Math.max(1.5, (cityData.canal.width || 38) * scaleX);
      ctx.beginPath();
      const pts = cityData.canal.points;
      ctx.moveTo(pts[0].x * scaleX, pts[0].y * scaleY);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x * scaleX, pts[i].y * scaleY);
      }
      ctx.stroke();
    }

    // 4. Render Coarse Rubble / Destruction Map
    const grid = this.scene.cityGrid;
    if (grid) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.65)';
      const step = 20; // 50x50 coarse samples across 1000x1000 grid
      for (let r = 0; r < grid.rows; r += step) {
        for (let c = 0; c < grid.cols; c += step) {
          const idx = r * grid.cols + c;
          if (grid.types[idx] === CELL_TYPES.RUBBLE) {
            const rx = (c * grid.cellSize) * scaleX;
            const ry = (r * grid.cellSize) * scaleY;
            ctx.fillRect(rx, ry, Math.max(1.5, step * grid.cellSize * scaleX * 0.8), Math.max(1.5, step * grid.cellSize * scaleY * 0.8));
          }
        }
      }
    }

    // 5. Render Enemy Threat Clusters
    const enemyMgr = this.scene.enemyManager;
    if (enemyMgr && enemyMgr.activeCount > 0) {
      ctx.fillStyle = '#ef4444';
      // Sample active enemies with stride for extreme efficiency
      const stride = Math.max(1, Math.floor(enemyMgr.activeCount / 40));
      let count = 0;
      for (let i = 0; i < enemyMgr.maxEnemies; i++) {
        if (enemyMgr.active[i]) {
          count++;
          if (count % stride === 0) {
            const ex = enemyMgr.x[i] * scaleX;
            const ey = enemyMgr.y[i] * scaleY;
            ctx.fillRect(ex - 1, ey - 1, 2, 2);
          }
        }
      }
    }

    // 6. Render Kaiju GPS Marker with Direction Heading
    const kaiju = this.scene.kaiju;
    if (kaiju) {
      const kx = kaiju.x * scaleX;
      const ky = kaiju.y * scaleY;
      const heading = kaiju.rotation || 0;

      // Glow beacon
      ctx.fillStyle = 'rgba(34, 211, 238, 0.35)';
      ctx.beginPath();
      ctx.arc(kx, ky, 6, 0, Math.PI * 2);
      ctx.fill();

      // Heading Arrow
      ctx.fillStyle = '#22d3ee';
      ctx.beginPath();
      ctx.moveTo(kx + Math.cos(heading) * 6, ky + Math.sin(heading) * 6);
      ctx.lineTo(kx + Math.cos(heading + 2.4) * 4, ky + Math.sin(heading + 2.4) * 4);
      ctx.lineTo(kx + Math.cos(heading - 2.4) * 4, ky + Math.sin(heading - 2.4) * 4);
      ctx.closePath();
      ctx.fill();

      // Update current district label in footer
      if (this.districtLabel && districts) {
        const curD = districts.getCurrentDistrict();
        if (curD) {
          const dPct = districts.getDestructionPercentage(curD.id).toFixed(1);
          this.districtLabel.textContent = `${curD.name.toUpperCase()} · ${dPct}%`;
          this.districtLabel.style.color = curD.color;
        }
      }
    }

    // Border Frame
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  /**
   * Destroys DOM nodes cleanly
   */
  destroy() {
    if (this.container && this.container.parentNode) {
      this.container.parentNode.removeChild(this.container);
    }
  }
}
