import { SLOT_CONFIG } from '../assets/AssetManifest.js';

/**
 * LayerInspector.js - Tahap 6A: Alat Uji Debug Slot Mutasi (Tombol U)
 * Overlay layar penuh untuk inspeksi anatomi modular Kaiju Godzilla secara besar di tengah layar:
 * - Menampilkan garis titik tempel (anchor) dan crosshair ke setiap slot
 * - Penggantian mutasi visual per senjata dan per level tier (1, 3, 5)
 * - Slider live tuning: Offset X, Offset Y, Rotasi, dan Skala per slot
 * - Dapat dibuka/tutup dengan tombol [U] atau tombol Tutup
 */
export class LayerInspector {
  /**
   * @param {HTMLElement} rootElement 
   * @param {Object} gameScene 
   */
  constructor(rootElement, gameScene) {
    this.root = rootElement;
    this.scene = gameScene;
    this.isOpen = false;

    // Slot state for preview
    this.currentSlot = 'back_slot';
    this.currentWeapon = 'back_cannon';
    this.currentTier = 5;

    // Slot offsets override
    this.offsets = {
      body: { x: 0, y: 0, rot: 0, scale: 1.0 },
      head_slot: { x: 22, y: 0, rot: 0, scale: 1.0 },
      back_slot: { x: -6, y: 0, rot: 0, scale: 1.0 },
      skin_overlay: { x: 0, y: 0, rot: 0, scale: 1.0 },
      tail_slot: { x: -22, y: 0, rot: 0, scale: 1.0 }
    };

    this.weaponsList = [
      { id: 'claw', name: 'Cakar (Claw)', slot: 'body' },
      { id: 'back_cannon', name: 'Meriam Punggung (Back Cannon)', slot: 'back_slot' },
      { id: 'back_rockets', name: 'Roket Punggung (Back Rockets)', slot: 'back_slot' },
      { id: 'fire_breath', name: 'Napas Api (Fire Breath)', slot: 'head_slot' },
      { id: 'laser_eyes', name: 'Mata Laser (Laser Eyes)', slot: 'head_slot' },
      { id: 'body_spikes', name: 'Duri Tubuh (Body Spikes)', slot: 'skin_overlay' },
      { id: 'electric_skin', name: 'Kulit Listrik (Electric Skin)', slot: 'skin_overlay' },
      { id: 'quake_stomp', name: 'Injakan Getar (Quake Stomp)', slot: 'body' },
      { id: 'spiked_tail', name: 'Ekor Berduri (Spiked Tail)', slot: 'tail_slot' }
    ];

    this.createDOM();
  }

  createDOM() {
    this.modal = document.createElement('div');
    this.modal.id = 'layer-inspector-modal';
    this.modal.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(7, 9, 14, 0.88);
      backdrop-filter: blur(8px);
      z-index: 9999;
      display: none;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      font-family: 'Rajdhani', -apple-system, sans-serif;
      color: #e2e8f0;
      user-select: none;
    `;

    this.modal.innerHTML = `
      <div style="width: 92%; max-width: 820px; height: 90%; max-height: 560px; background: #0f172a; border: 1px solid rgba(56, 189, 248, 0.35); border-radius: 8px; box-shadow: 0 0 30px rgba(0,0,0,0.85); display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="padding: 12px 18px; background: rgba(30, 41, 59, 0.6); border-bottom: 1px solid rgba(56, 189, 248, 0.2); display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 18px; font-weight: 800; letter-spacing: 2px; color: #38bdf8;">
              INSPEKTOR SLOT & TITIK TEMPEL MUTASI KAIJU [U]
            </div>
            <div style="font-size: 11px; color: #94a3b8;">
              Uji visual layer modular: garis titik tempel, orientasi, perputaran turret, dan skala Tubuh Raksasa.
            </div>
          </div>
          <button id="li-close-btn" style="background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ef4444; padding: 6px 14px; font-weight: bold; font-family: inherit; cursor: pointer; border-radius: 4px; transition: all 0.15s;">
            TUTUP [U]
          </button>
        </div>

        <!-- Body Content -->
        <div style="display: flex; flex: 1; overflow: hidden;">
          <!-- Canvas Viewport (Center Kaiju Preview) -->
          <div style="flex: 1.4; display: flex; flex-direction: column; align-items: center; justify-content: center; background: radial-gradient(circle at center, #1e293b 0%, #090d16 100%); position: relative; border-right: 1px solid rgba(56, 189, 248, 0.2);">
            <canvas id="li-canvas" width="340" height="340" style="background: transparent; image-rendering: pixelated;"></canvas>
            <div style="position: absolute; bottom: 10px; left: 14px; font-size: 11px; color: #64748b; font-family: monospace;">
              KUNING: TITIK TEMPEL ANCHOR | HIJAU: PUSAT TUBUH (0,0)
            </div>
          </div>

          <!-- Controls Panel -->
          <div style="flex: 1; padding: 14px; display: flex; flex-direction: column; gap: 10px; overflow-y: auto; background: #0c1220;">
            <!-- Slot Selector -->
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1px;">PILIH SLOT TUBUH</label>
              <select id="li-slot-select" style="width: 100%; margin-top: 4px; padding: 6px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; font-family: inherit; font-size: 12px; border-radius: 4px;">
                <option value="body">body (Torso / Cakar / Stomp)</option>
                <option value="head_slot">head_slot (Kepala / Api / Laser)</option>
                <option value="back_slot" selected>back_slot (Punggung / Meriam / Roket)</option>
                <option value="skin_overlay">skin_overlay (Kulit / Duri Tubuh)</option>
                <option value="tail_slot">tail_slot (Ekor / Gada Morningstar)</option>
              </select>
            </div>

            <!-- Weapon Mutation Selector -->
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1px;">SENJATA / LAYER MUTASI</label>
              <select id="li-weapon-select" style="width: 100%; margin-top: 4px; padding: 6px; background: #1e293b; border: 1px solid #334155; color: #f8fafc; font-family: inherit; font-size: 12px; border-radius: 4px;">
              </select>
            </div>

            <!-- Tier Selector -->
            <div>
              <label style="font-size: 11px; font-weight: 700; color: #38bdf8; letter-spacing: 1px;">TIER LEVEL SENJATA</label>
              <div style="display: flex; gap: 6px; margin-top: 4px;">
                <button class="li-tier-btn" data-tier="1" style="flex: 1; padding: 5px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-family: inherit; font-size: 11px; cursor: pointer; border-radius: 3px;">Lv 1-2</button>
                <button class="li-tier-btn" data-tier="3" style="flex: 1; padding: 5px; background: #1e293b; border: 1px solid #334155; color: #94a3b8; font-family: inherit; font-size: 11px; cursor: pointer; border-radius: 3px;">Lv 3-4</button>
                <button class="li-tier-btn active" data-tier="5" style="flex: 1; padding: 5px; background: rgba(56, 189, 248, 0.2); border: 1px solid #38bdf8; color: #38bdf8; font-weight: bold; font-family: inherit; font-size: 11px; cursor: pointer; border-radius: 3px;">Lv 5 (Maks)</button>
              </div>
            </div>

            <!-- Sliders for Live Tuning -->
            <div style="border-top: 1px solid #1e293b; padding-top: 8px;">
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="color: #94a3b8;">OFFSET X:</span>
                <span id="li-val-x" style="color: #4ade80; font-family: monospace;">-6 px</span>
              </div>
              <input type="range" id="li-range-x" min="-40" max="40" value="-6" style="width: 100%; margin-top: 2px;">
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="color: #94a3b8;">OFFSET Y:</span>
                <span id="li-val-y" style="color: #4ade80; font-family: monospace;">0 px</span>
              </div>
              <input type="range" id="li-range-y" min="-30" max="30" value="0" style="width: 100%; margin-top: 2px;">
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="color: #94a3b8;">ROTASI / TURRET AIM:</span>
                <span id="li-val-rot" style="color: #4ade80; font-family: monospace;">0°</span>
              </div>
              <input type="range" id="li-range-rot" min="-60" max="60" value="0" style="width: 100%; margin-top: 2px;">
            </div>

            <div>
              <div style="display: flex; justify-content: space-between; font-size: 11px;">
                <span style="color: #94a3b8;">SKALA LAYER:</span>
                <span id="li-val-scale" style="color: #4ade80; font-family: monospace;">1.00x</span>
              </div>
              <input type="range" id="li-range-scale" min="50" max="200" value="100" style="width: 100%; margin-top: 2px;">
            </div>

            <div style="margin-top: auto; padding-top: 6px;">
              <button id="li-apply-game-btn" style="width: 100%; padding: 8px; background: rgba(34, 197, 94, 0.2); border: 1px solid #22c55e; color: #4ade80; font-weight: bold; font-family: inherit; font-size: 12px; cursor: pointer; border-radius: 4px; transition: all 0.15s;">
                PASANG KE KAIJU DI GAME
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    this.root.appendChild(this.modal);

    // Bind DOM events
    this.modal.querySelector('#li-close-btn').onclick = () => this.close();

    const weaponSelect = this.modal.querySelector('#li-weapon-select');
    this.weaponsList.forEach(w => {
      const opt = document.createElement('option');
      opt.value = w.id;
      opt.textContent = w.name;
      weaponSelect.appendChild(opt);
    });

    weaponSelect.onchange = (e) => {
      this.currentWeapon = e.target.value;
      const wInfo = this.weaponsList.find(w => w.id === this.currentWeapon);
      if (wInfo) {
        this.currentSlot = wInfo.slot;
        this.modal.querySelector('#li-slot-select').value = this.currentSlot;
        this.syncSlidersFromSlot(this.currentSlot);
      }
      this.renderPreview();
    };

    const slotSelect = this.modal.querySelector('#li-slot-select');
    slotSelect.onchange = (e) => {
      this.currentSlot = e.target.value;
      this.syncSlidersFromSlot(this.currentSlot);
      this.renderPreview();
    };

    this.modal.querySelectorAll('.li-tier-btn').forEach(btn => {
      btn.onclick = () => {
        this.modal.querySelectorAll('.li-tier-btn').forEach(b => {
          b.style.background = '#1e293b';
          b.style.borderColor = '#334155';
          b.style.color = '#94a3b8';
        });
        btn.style.background = 'rgba(56, 189, 248, 0.2)';
        btn.style.borderColor = '#38bdf8';
        btn.style.color = '#38bdf8';
        this.currentTier = parseInt(btn.dataset.tier, 10);
        this.renderPreview();
      };
    });

    const rangeX = this.modal.querySelector('#li-range-x');
    rangeX.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      this.offsets[this.currentSlot].x = val;
      this.modal.querySelector('#li-val-x').textContent = `${val} px`;
      this.renderPreview();
    };

    const rangeY = this.modal.querySelector('#li-range-y');
    rangeY.oninput = (e) => {
      const val = parseInt(e.target.value, 10);
      this.offsets[this.currentSlot].y = val;
      this.modal.querySelector('#li-val-y').textContent = `${val} px`;
      this.renderPreview();
    };

    const rangeRot = this.modal.querySelector('#li-range-rot');
    rangeRot.oninput = (e) => {
      const deg = parseInt(e.target.value, 10);
      this.offsets[this.currentSlot].rot = (deg * Math.PI) / 180;
      this.modal.querySelector('#li-val-rot').textContent = `${deg}°`;
      this.renderPreview();
    };

    const rangeScale = this.modal.querySelector('#li-range-scale');
    rangeScale.oninput = (e) => {
      const sc = parseInt(e.target.value, 10) / 100;
      this.offsets[this.currentSlot].scale = sc;
      this.modal.querySelector('#li-val-scale').textContent = `${sc.toFixed(2)}x`;
      this.renderPreview();
    };

    this.modal.querySelector('#li-apply-game-btn').onclick = () => {
      if (this.scene && this.scene.kaiju) {
        this.scene.kaiju.setMutation(this.currentWeapon, this.currentTier);
        if (this.scene.uiManager) {
          this.scene.uiManager.showEventBanner('INSPEKSI SLOT', `MUTASI ${this.currentWeapon.toUpperCase()} TIER ${this.currentTier} DIPASANG!`, 1800);
        }
      }
      this.close();
    };
  }

  syncSlidersFromSlot(slot) {
    const off = this.offsets[slot] || { x: 0, y: 0, rot: 0, scale: 1.0 };
    this.modal.querySelector('#li-range-x').value = off.x;
    this.modal.querySelector('#li-val-x').textContent = `${off.x} px`;
    this.modal.querySelector('#li-range-y').value = off.y;
    this.modal.querySelector('#li-val-y').textContent = `${off.y} px`;
    const deg = Math.round((off.rot * 180) / Math.PI);
    this.modal.querySelector('#li-range-rot').value = deg;
    this.modal.querySelector('#li-val-rot').textContent = `${deg}°`;
    this.modal.querySelector('#li-range-scale').value = Math.round(off.scale * 100);
    this.modal.querySelector('#li-val-scale').textContent = `${off.scale.toFixed(2)}x`;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.modal.style.display = 'flex';
    this.syncSlidersFromSlot(this.currentSlot);
    this.renderPreview();
  }

  close() {
    this.isOpen = false;
    this.modal.style.display = 'none';
  }

  renderPreview() {
    const canvas = this.modal.querySelector('#li-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // Clear background
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw subtle grid
    ctx.strokeStyle = 'rgba(51, 65, 85, 0.4)';
    ctx.lineWidth = 1;
    const step = 20;
    for (let x = 0; x <= canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const zoom = 2.4; // 2.4x enlargement in inspector

    // 1. Draw Kaiju Body Texture from Phaser TextureManager
    if (this.scene && this.scene.textures && this.scene.textures.exists('kaiju_body')) {
      const tex = this.scene.textures.get('kaiju_body').getSourceImage();
      if (tex) {
        ctx.save();
        ctx.translate(cx, cy);
        const w = tex.width * zoom * 0.625;
        const h = tex.height * zoom * 0.625;
        ctx.drawImage(tex, -w / 2, -h / 2, w, h);
        ctx.restore();
      }
    }

    // 2. Draw active mutation layer on top
    const mutKey = `mutation_${this.currentWeapon}_${this.currentTier}`;
    if (this.scene && this.scene.textures && this.scene.textures.exists(mutKey)) {
      const mTex = this.scene.textures.get(mutKey).getSourceImage();
      if (mTex) {
        ctx.save();
        ctx.translate(cx, cy);

        // Apply slot anchor + live tuning offsets
        const curOff = this.offsets[this.currentSlot] || { x: 0, y: 0, rot: 0, scale: 1.0 };
        const drawX = curOff.x * zoom * 0.625;
        const drawY = curOff.y * zoom * 0.625;
        ctx.translate(drawX, drawY);
        ctx.rotate(curOff.rot);

        const mw = mTex.width * zoom * 0.625 * curOff.scale;
        const mh = mTex.height * zoom * 0.625 * curOff.scale;
        ctx.drawImage(mTex, -mw / 2, -mh / 2, mw, mh);
        ctx.restore();
      }
    }

    // 3. Draw Anchor Crosshairs & Attachment Lines
    ctx.save();
    ctx.translate(cx, cy);

    // Center Crosshair (Body 0, 0)
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-12, 0); ctx.lineTo(12, 0);
    ctx.moveTo(0, -12); ctx.lineTo(0, 12);
    ctx.stroke();

    // Draw all slot anchor points
    for (const [slotKey, sc] of Object.entries(SLOT_CONFIG)) {
      const anchor = sc.anchor || { x: 0, y: 0 };
      const ax = anchor.x * zoom * 0.625;
      const ay = anchor.y * zoom * 0.625;

      const isCurrent = (slotKey === this.currentSlot);

      // Line from body center to anchor
      ctx.strokeStyle = isCurrent ? '#facc15' : 'rgba(148, 163, 184, 0.45)';
      ctx.setLineDash(isCurrent ? [3, 2] : [2, 2]);
      ctx.lineWidth = isCurrent ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(ax, ay);
      ctx.stroke();
      ctx.setLineDash([]);

      // Anchor diamond indicator
      ctx.fillStyle = isCurrent ? '#facc15' : '#64748b';
      ctx.beginPath();
      ctx.arc(ax, ay, isCurrent ? 4.5 : 3, 0, Math.PI * 2);
      ctx.fill();

      // Text label
      ctx.font = '10px monospace';
      ctx.fillStyle = isCurrent ? '#fef08a' : '#94a3b8';
      ctx.fillText(slotKey, ax + 7, ay - 4);
    }

    ctx.restore();
  }
}
