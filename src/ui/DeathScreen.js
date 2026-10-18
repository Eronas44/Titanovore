import { ICONS } from './icons.js';

/**
 * DeathScreen.js - Tahap 4A-2
 * Clean, dark-futuristic HTML/CSS Death Screen ("KAIJU TUMBANG") for Titanovore.
 * Features:
 * - High-impact modal panel with red neon border and ambient glow
 * - Full run stats breakdown (Survival Time, Max Level, Total Kills, City Destruction %, Buildings Flattened, Total XP)
 * - Clickable "BANGKIT KEMBALI" button and [R] keyboard shortcut
 * - Clean event listener management with no leaks on repeated deaths/respawns
 */
export class DeathScreen {
  /**
   * @param {HTMLElement} rootElement - #ui-root container
   */
  constructor(rootElement) {
    this.root = rootElement;
    this.isOpen = false;
    this.onReviveCallback = null;

    this.boundKeyDownHandler = this.handleKeyDown.bind(this);

    this.mount();
  }

  /**
   * Creates death modal DOM structure
   */
  mount() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-overlay';
    this.modalEl.id = 'death-modal';

    this.modalEl.innerHTML = `
      <div class="death-card">
        <div class="death-title">KAIJU TUMBANG</div>
        <div style="font-size: 13px; color: #94a3b8; margin-top: -8px;">Statistik Invasi Kota</div>

        <div class="death-stats-grid" id="death-stats-grid">
          <div class="death-stat-box">
            <span class="death-stat-label">WAKTU BERTAHAN</span>
            <span class="death-stat-val" id="stat-survival-time">00:00</span>
          </div>
          <div class="death-stat-box">
            <span class="death-stat-label">LEVEL KAIJU</span>
            <span class="death-stat-val" style="color: var(--color-cyan);" id="stat-level">Lv 1</span>
          </div>
          <div class="death-stat-box">
            <span class="death-stat-label">MUSUH DIKALAHKAN</span>
            <span class="death-stat-val" style="color: var(--color-red);" id="stat-kills">0</span>
          </div>
          <div class="death-stat-box">
            <span class="death-stat-label">KERUSAKAN KOTA</span>
            <span class="death-stat-val" style="color: var(--color-amber);" id="stat-city-pct">0.0%</span>
          </div>
          <div class="death-stat-box">
            <span class="death-stat-label">GEDUNG DIHANCURKAN</span>
            <span class="death-stat-val" id="stat-bldgs">0</span>
          </div>
          <div class="death-stat-box">
            <span class="death-stat-label">TOTAL XP DIPEROLEH</span>
            <span class="death-stat-val" style="color: #67e8f9;" id="stat-xp">0</span>
          </div>
        </div>

        <button class="revive-btn interactive" id="death-revive-btn">
          BANGKIT KEMBALI [R]
        </button>
      </div>
    `;

    this.root.appendChild(this.modalEl);

    // Cache elements
    this.timeValEl = this.modalEl.querySelector('#stat-survival-time');
    this.levelValEl = this.modalEl.querySelector('#stat-level');
    this.killsValEl = this.modalEl.querySelector('#stat-kills');
    this.cityValEl = this.modalEl.querySelector('#stat-city-pct');
    this.bldgsValEl = this.modalEl.querySelector('#stat-bldgs');
    this.xpValEl = this.modalEl.querySelector('#stat-xp');
    this.reviveBtn = this.modalEl.querySelector('#death-revive-btn');

    this.reviveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerRevive();
    });
  }

  /**
   * Shows death modal with full run statistics
   * @param {Object} stats - Stats object
   * @param {Function} onRevive - Revive callback
   */
  show(stats, onRevive) {
    this.onReviveCallback = onRevive;

    // Format survival time MM:SS
    const mins = Math.floor((stats.survivalTime || 0) / 60);
    const secs = Math.floor((stats.survivalTime || 0) % 60);
    this.timeValEl.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    this.levelValEl.textContent = `Lv ${stats.level || 1}`;

    const totalKills = (stats.humansKilled || 0) +
      (stats.policeKilled || 0) +
      (stats.carsDestroyed || 0) +
      (stats.tanksDestroyed || 0) +
      (stats.soldiersKilled || 0) +
      (stats.helicoptersDestroyed || 0) +
      (stats.dronesDestroyed || 0);

    this.killsValEl.textContent = totalKills;
    this.cityValEl.textContent = `${stats.destructionPct || '0.0'}%`;
    this.bldgsValEl.textContent = `${stats.buildingsDestroyed || 0}`;
    this.xpValEl.textContent = `${Math.floor(stats.xp || 0)}`;

    // Listen for [R] key
    window.addEventListener('keydown', this.boundKeyDownHandler, true);

    this.isOpen = true;
    this.modalEl.classList.add('open');
  }

  /**
   * Keyboard shortcut [R] to revive
   */
  handleKeyDown(event) {
    if (!this.isOpen) return;

    if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerRevive();
    }
  }

  triggerRevive() {
    if (!this.isOpen) return;
    this.close();
    if (this.onReviveCallback) {
      this.onReviveCallback();
    }
  }

  /**
   * Closes the death modal and detaches keyboard listener
   */
  close() {
    this.isOpen = false;
    this.modalEl.classList.remove('open');
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);
  }

  /**
   * Clean up DOM and listeners
   */
  destroy() {
    this.close();
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
  }
}
