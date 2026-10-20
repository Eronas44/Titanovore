import { getIconSvg, ICONS } from './icons.js';
import { WEAPON_CONFIG } from '../config/weapons.js';

/**
 * Hud.js - Tahap 4A-2
 * High-performance, crisp HTML/CSS HUD overlay for Titanovore.
 * Features:
 * - Dynamic color gradient HP Bar (Emerald -> Amber -> Red)
 * - 5-segment glowing Siaga threat meter
 * - Survival timer and Kills counter
 * - City destruction % and building collapse tally
 * - Weapon slots with circular cooldown sweeps and level badges
 * - Passive perk slots with badges
 * - Wide XP progress bar at bottom screen
 * - Event pop banner ("SIAGA 2!", "KAIJU BERVOLUSI!")
 * - Screen vignette flash on danger/escalation
 * - F3 Technical telemetry panel
 * - Throttled DOM updates (10-15 Hz) with value caching to prevent reflows
 */
export class Hud {
  /**
   * @param {HTMLElement} rootElement - #ui-root container
   */
  constructor(rootElement) {
    this.root = rootElement;
    this.lastUpdateTime = 0;
    this.throttleInterval = 66; // ~15 FPS DOM update cap

    // Cached state to avoid unnecessary DOM writes
    this.cachedState = {
      hp: -1,
      maxHp: -1,
      alertVal: -1,
      alertLevel: -1,
      survivalTimeStr: '',
      totalKills: -1,
      destructionPct: '',
      bldgsCount: -1,
      districtName: '',
      districtDestructionPct: '',
      lastSavedStr: '',
      level: -1,
      xp: -1,
      targetXp: -1,
      weaponsHash: '',
      passivesHash: '',
      f3Visible: false,
      f3Text: ''
    };

    this.bannerTimeout = null;
    this.vignetteTimeout = null;

    this.mount();
  }

  /**
   * Creates HUD HTML structure inside #ui-root
   */
  mount() {
    // 1. Red Vignette Flash
    this.vignetteEl = document.createElement('div');
    this.vignetteEl.className = 'screen-vignette-flash';
    this.root.appendChild(this.vignetteEl);

    // 2. Event Banner Pop Container
    this.bannerContainer = document.createElement('div');
    this.bannerContainer.className = 'event-banner-container';
    this.bannerContainer.innerHTML = `
      <div class="event-banner-title" id="hud-banner-title"></div>
      <div class="event-banner-subtitle" id="hud-banner-subtitle"></div>
    `;
    this.root.appendChild(this.bannerContainer);
    this.bannerTitleEl = this.bannerContainer.querySelector('#hud-banner-title');
    this.bannerSubtitleEl = this.bannerContainer.querySelector('#hud-banner-subtitle');

    // 3. F3 Telemetry Panel
    this.f3Panel = document.createElement('div');
    this.f3Panel.className = 'f3-telemetry-panel';
    this.root.appendChild(this.f3Panel);

    // 4. Main HUD Layer Container
    this.hudLayer = document.createElement('div');
    this.hudLayer.className = 'hud-layer';
    this.hudLayer.innerHTML = `
      <!-- Top Bar: Status, Timers, Destruction -->
      <div class="hud-top-bar">
        <!-- Top Left: HP & Siaga -->
        <div class="hud-top-left hud-panel">
          <div class="hud-hp-block">
            <div class="hud-hp-header">
              <span class="hud-hp-label">HP VITAL</span>
              <span class="hud-hp-values" id="hud-hp-text">100 / 100</span>
            </div>
            <div class="bar-track">
              <div class="bar-fill" id="hud-hp-bar"></div>
            </div>
          </div>

          <div class="hud-siaga-block">
            <div class="hud-siaga-header">
              <span class="siaga-badge" id="hud-siaga-badge">SIAGA 1 · AMAN</span>
              <span class="siaga-meter-val" id="hud-siaga-val">0 / 100</span>
            </div>
            <div class="siaga-segments" id="hud-siaga-segments">
              <div class="siaga-seg active-1"></div>
              <div class="siaga-seg"></div>
              <div class="siaga-seg"></div>
              <div class="siaga-seg"></div>
              <div class="siaga-seg"></div>
            </div>
          </div>

          <!-- Small Active Event Indicator under Siaga (Tahap 5B-2) -->
          <div class="hud-event-indicator" id="hud-event-indicator" style="display: none;">
            <span class="hud-event-icon">⚡</span>
            <span class="hud-event-name" id="hud-event-name">KEJADIAN KHUSUS</span>
            <span class="hud-event-timer" id="hud-event-timer">30s</span>
          </div>
        </div>

        <!-- Top Center: Survival Timer & Kills -->
        <div class="hud-top-center hud-panel">
          <div class="stat-item">
            <div class="stat-icon">${ICONS.clock}</div>
            <span class="stat-val large" id="hud-timer">00:00</span>
          </div>
          <div class="stat-item danger">
            <div class="stat-icon">${ICONS.skull}</div>
            <span class="stat-val large" id="hud-kills">0</span>
          </div>
        </div>

        <!-- Top Right: Districts, City Destruction & WorldState Menu -->
        <div class="hud-top-right hud-panel">
          <div class="hud-district-header">
            <span class="hud-district-badge" id="hud-district-badge">PUSAT KOTA</span>
            <span class="hud-district-pct" id="hud-district-pct">0.0% Distrik</span>
          </div>
          <div class="hud-city-destruction-row">
            <div class="stat-item">
              <div class="stat-icon" style="color: var(--color-amber);">${ICONS.city}</div>
              <span class="destruction-pct" id="hud-destruction">0.0% Kota</span>
            </div>
            <span class="bldg-count" id="hud-bldg-count">0 GEDUNG</span>
          </div>
          <div class="hud-save-row">
            <span class="hud-save-status" id="hud-save-status">Tersimpan</span>
            <button class="hud-new-city-btn interactive" id="hud-new-city-btn" title="Mulai kota baru (Reset WorldState)">KOTA BARU</button>
          </div>
        </div>
      </div>

      <!-- Broad Boss HP Bar overlay across top center -->
      <div class="hud-boss-bar-container" id="hud-boss-bar-container">
        <div class="boss-bar-header">
          <div class="boss-name-group">
            <span class="boss-hazard-icon">⚡</span>
            <span class="boss-title" id="boss-title">MECH-TITAN</span>
            <span class="boss-phase-badge" id="boss-phase-badge">FASE 1</span>
          </div>
          <span class="boss-hp-numbers" id="boss-hp-numbers">1200 / 1200</span>
        </div>
        <div class="boss-bar-track">
          <div class="boss-bar-fill" id="boss-bar-fill"></div>
          <div class="boss-marker marker-66" title="Ambang Fase 2 (66%)"></div>
          <div class="boss-marker marker-33" title="Ambang Fase 3 (33%)"></div>
        </div>
      </div>

      <!-- Bottom Bar: Weapons Inventory, Passives, Wide XP Progression -->
      <div class="hud-bottom-bar">
        <!-- Bottom Left: Weapons & Passives Inventory -->
        <div class="hud-inventory-panel hud-panel">
          <div class="inventory-header" style="display: flex; justify-content: space-between; align-items: center;">
            <span>SENJATA AKTIF (MAKS 6)</span>
            <button class="hud-recipe-btn interactive" id="hud-toggle-recipe-btn" title="Lihat Resep Evolusi [TAB]">
              ${ICONS.flask} RESEP [TAB]
            </button>
          </div>
          <div class="inventory-slots" id="hud-weapon-slots">
            <!-- 6 weapon boxes generated dynamically -->
          </div>
          <div class="inventory-header" style="margin-top: 2px;">PASIF AKTIF</div>
          <div class="inventory-slots" id="hud-passive-slots">
            <!-- Passive boxes generated dynamically -->
          </div>
        </div>

        <!-- Bottom Center: Wide XP Progress Bar -->
        <div class="hud-bottom-center">
          <div class="hud-xp-label">
            <span class="xp-lvl-badge" id="hud-xp-badge">LV 1</span>
            <span class="xp-val-text" id="hud-xp-val">0 / 20 XP</span>
          </div>
          <div class="xp-bar-track">
            <div class="xp-bar-fill" id="hud-xp-fill"></div>
          </div>
        </div>

        <!-- Placeholder for right balancing on large monitors -->
        <div style="width: clamp(140px, 15vw, 220px); pointer-events: none;"></div>
      </div>
    `;

    this.root.appendChild(this.hudLayer);

    // Cache element references for zero-query updates
    this.hpTextEl = this.hudLayer.querySelector('#hud-hp-text');
    this.hpBarEl = this.hudLayer.querySelector('#hud-hp-bar');
    this.siagaBadgeEl = this.hudLayer.querySelector('#hud-siaga-badge');
    this.siagaValEl = this.hudLayer.querySelector('#hud-siaga-val');
    this.siagaSegmentsEl = this.hudLayer.querySelector('#hud-siaga-segments');
    this.timerEl = this.hudLayer.querySelector('#hud-timer');
    this.killsEl = this.hudLayer.querySelector('#hud-kills');
    this.destructionEl = this.hudLayer.querySelector('#hud-destruction');
    this.bldgCountEl = this.hudLayer.querySelector('#hud-bldg-count');
    this.weaponSlotsEl = this.hudLayer.querySelector('#hud-weapon-slots');
    this.passiveSlotsEl = this.hudLayer.querySelector('#hud-passive-slots');
    this.xpBadgeEl = this.hudLayer.querySelector('#hud-xp-badge');
    this.xpValEl = this.hudLayer.querySelector('#hud-xp-val');
    this.xpFillEl = this.hudLayer.querySelector('#hud-xp-fill');
    this.recipeBtn = this.hudLayer.querySelector('#hud-toggle-recipe-btn');
    this.districtBadgeEl = this.hudLayer.querySelector('#hud-district-badge');
    this.districtPctEl = this.hudLayer.querySelector('#hud-district-pct');
    this.saveStatusEl = this.hudLayer.querySelector('#hud-save-status');
    this.newCityBtn = this.hudLayer.querySelector('#hud-new-city-btn');

    // Boss Bar elements
    this.bossContainer = this.hudLayer.querySelector('#hud-boss-bar-container');
    this.bossTitle = this.hudLayer.querySelector('#boss-title');
    this.bossPhaseBadge = this.hudLayer.querySelector('#boss-phase-badge');
    this.bossHpNumbers = this.hudLayer.querySelector('#boss-hp-numbers');
    this.bossBarFill = this.hudLayer.querySelector('#boss-bar-fill');

    // Special Event Indicator elements
    this.eventIndicatorEl = this.hudLayer.querySelector('#hud-event-indicator');
    this.eventNameEl = this.hudLayer.querySelector('#hud-event-name');
    this.eventTimerEl = this.hudLayer.querySelector('#hud-event-timer');

    if (this.newCityBtn) {
      this.newCityBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('Yakin ingin mereset kerusakan kota dan memulai kota baru dari awal?')) {
          if (this.onNewCity) this.onNewCity();
        }
      });
    }

    if (this.recipeBtn) {
      this.recipeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (this.onToggleRecipe) this.onToggleRecipe();
      });
    }

    // Pre-populate empty weapon slots
    this.initInventorySlots();
  }

  /**
   * Initializes 6 weapon slots and default passive slot grid
   */
  initInventorySlots() {
    this.weaponSlotsEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot-box empty';
      slot.id = `weapon-slot-${i}`;
      this.weaponSlotsEl.appendChild(slot);
    }

    this.passiveSlotsEl.innerHTML = '<span style="font-size: 10px; color: #64748b; font-style: italic;">Belum ada pasif</span>';
  }

  /**
   * Throttled update called from GameScene.update()
   * Only touches DOM ~15 times per second and only when values change.
   * @param {Object} state - Normalized game state
   * @param {boolean} force - Bypass throttle if true
   */
  update(state, force = false) {
    const now = performance.now();
    if (!force && now - this.lastUpdateTime < this.throttleInterval) {
      // Cooldown sweep can update smoothly every frame if weapon slots exist
      this.updateWeaponCooldowns(state.weapons);
      return;
    }
    this.lastUpdateTime = now;

    // 1. HP Bar Update
    const curHp = Math.max(0, Math.ceil(state.hp));
    const maxHp = Math.ceil(state.maxHp);
    if (this.cachedState.hp !== curHp || this.cachedState.maxHp !== maxHp) {
      this.cachedState.hp = curHp;
      this.cachedState.maxHp = maxHp;
      this.hpTextEl.textContent = `${curHp} / ${maxHp}`;

      const hpRatio = Math.max(0, Math.min(1.0, curHp / maxHp));
      this.hpBarEl.style.width = `${(hpRatio * 100).toFixed(1)}%`;

      this.hpBarEl.classList.remove('warning', 'danger');
      if (hpRatio < 0.28) {
        this.hpBarEl.classList.add('danger');
      } else if (hpRatio < 0.55) {
        this.hpBarEl.classList.add('warning');
      }
    }

    // 2. Siaga Threat Meter Update
    const alertVal = Math.round(state.alertVal || 0);
    const alertLevel = state.alertLevel || 1;
    if (this.cachedState.alertVal !== alertVal || this.cachedState.alertLevel !== alertLevel) {
      this.cachedState.alertVal = alertVal;
      this.cachedState.alertLevel = alertLevel;

      const levelNames = ['AMAN', 'WASPADA', 'MILITER', 'DARURAT', 'BENCANA'];
      const levelName = state.alertName || levelNames[alertLevel - 1] || 'DARURAT';
      this.siagaBadgeEl.textContent = `SIAGA ${alertLevel} · ${levelName}`;
      this.siagaValEl.textContent = `${alertVal} / 100`;

      // Update segment styles
      const segments = this.siagaSegmentsEl.children;
      for (let s = 0; s < 5; s++) {
        segments[s].className = 'siaga-seg';
        if (s < alertLevel) {
          segments[s].classList.add(`active-${alertLevel}`);
        }
      }
    }

    // 3. Survival Timer & Kills
    if (this.cachedState.survivalTimeStr !== state.survivalTimeStr) {
      this.cachedState.survivalTimeStr = state.survivalTimeStr;
      this.timerEl.textContent = state.survivalTimeStr;
    }

    if (this.cachedState.totalKills !== state.totalKills) {
      this.cachedState.totalKills = state.totalKills;
      this.killsEl.textContent = state.totalKills;
    }

    // 4. City Destruction Stats & District Telemetry
    if (state.districtName && (this.cachedState.districtName !== state.districtName || this.cachedState.districtDestructionPct !== state.districtDestructionPct)) {
      this.cachedState.districtName = state.districtName;
      this.cachedState.districtDestructionPct = state.districtDestructionPct;
      if (this.districtBadgeEl) {
        this.districtBadgeEl.textContent = state.districtName.toUpperCase();
        if (state.districtColor) this.districtBadgeEl.style.color = state.districtColor;
      }
      if (this.districtPctEl) {
        this.districtPctEl.textContent = `${state.districtDestructionPct}% Distrik`;
      }
    }

    if (state.lastSavedStr && this.cachedState.lastSavedStr !== state.lastSavedStr) {
      this.cachedState.lastSavedStr = state.lastSavedStr;
      if (this.saveStatusEl) {
        this.saveStatusEl.textContent = state.lastSavedStr;
      }
    }

    if (this.cachedState.destructionPct !== state.destructionPct) {
      this.cachedState.destructionPct = state.destructionPct;
      this.destructionEl.textContent = `${state.destructionPct}% Kota`;
    }

    if (this.cachedState.bldgsCount !== state.bldgsCount) {
      this.cachedState.bldgsCount = state.bldgsCount;
      this.bldgCountEl.textContent = `${state.bldgsCount} GEDUNG`;
    }

    // 5. XP Progress Bar
    const xp = Math.floor(state.xp || 0);
    const targetXp = Math.floor(state.targetXp || 20);
    const level = state.level || 1;
    if (this.cachedState.level !== level || this.cachedState.xp !== xp || this.cachedState.targetXp !== targetXp) {
      this.cachedState.level = level;
      this.cachedState.xp = xp;
      this.cachedState.targetXp = targetXp;

      this.xpBadgeEl.textContent = `LV ${level}`;
      this.xpValEl.textContent = `${xp} / ${targetXp} XP`;

      const xpRatio = Math.max(0, Math.min(1.0, xp / targetXp));
      this.xpFillEl.style.width = `${(xpRatio * 100).toFixed(1)}%`;
    }

    // 6. Weapons & Passives Inventory
    this.updateInventory(state.weapons, state.passives);

    // 7. F3 Telemetry Panel
    if (state.f3Visible !== this.cachedState.f3Visible || state.f3Text !== this.cachedState.f3Text) {
      this.cachedState.f3Visible = state.f3Visible;
      this.cachedState.f3Text = state.f3Text;
      if (state.f3Visible) {
        this.f3Panel.classList.add('visible');
        this.f3Panel.innerHTML = state.f3Text.replace(/\n/g, '<br>');
      } else {
        this.f3Panel.classList.remove('visible');
      }
    }

    // 8. Boss HP Bar
    if (state.boss && state.boss.active) {
      if (this.bossContainer && !this.bossContainer.classList.contains('visible')) {
        this.bossContainer.classList.add('visible');
      }
      if (this.bossTitle) this.bossTitle.textContent = state.boss.name || 'MECH-TITAN';
      if (this.bossPhaseBadge) {
        const pStr = state.boss.isEnraged ? 'FASE 3 · MODE MARAH' : `FASE ${state.boss.phase || 1}`;
        this.bossPhaseBadge.textContent = pStr;
        if (state.boss.isEnraged) {
          this.bossPhaseBadge.classList.add('enraged');
        } else {
          this.bossPhaseBadge.classList.remove('enraged');
        }
      }
      if (this.bossHpNumbers) {
        this.bossHpNumbers.textContent = `${Math.ceil(state.boss.hp)} / ${state.boss.maxHp}`;
      }
      if (this.bossBarFill) {
        const ratio = Math.max(0, Math.min(1.0, state.boss.hp / state.boss.maxHp));
        this.bossBarFill.style.width = `${(ratio * 100).toFixed(1)}%`;
      }
    } else {
      if (this.bossContainer && this.bossContainer.classList.contains('visible')) {
        this.bossContainer.classList.remove('visible');
      }
    }

    // 9. Active Event Indicator Badge
    if (state.eventData && state.eventData.activeEvent) {
      if (this.eventIndicatorEl) {
        this.eventIndicatorEl.style.display = 'inline-flex';
        const eType = state.eventData.activeEvent;
        let icon = '⚡';
        let name = 'KEJADIAN KHUSUS';
        if (eType === 'MILITARY_CONVOY') {
          icon = '🚚';
          name = 'KONVOI MILITER';
          this.eventIndicatorEl.className = 'hud-event-indicator convoy';
        } else if (eType === 'AIRSTRIKE') {
          icon = '✈️';
          name = 'SERANGAN UDARA';
          this.eventIndicatorEl.className = 'hud-event-indicator airstrike';
        } else if (eType === 'EVACUATION') {
          icon = '🏃';
          name = 'EVAKUASI WARGA';
          this.eventIndicatorEl.className = 'hud-event-indicator evac';
        }
        const iconEl = this.eventIndicatorEl.querySelector('.hud-event-icon');
        if (iconEl) iconEl.textContent = icon;
        if (this.eventNameEl) this.eventNameEl.textContent = name;
        if (this.eventTimerEl) this.eventTimerEl.textContent = `${state.eventData.eventTimer}s`;
      }
    } else {
      if (this.eventIndicatorEl) {
        this.eventIndicatorEl.style.display = 'none';
      }
    }
  }

  /**
   * Updates weapon and passive slots when inventory changes
   */
  updateInventory(weapons = [], passives = []) {
    // Generate simple hash to check if inventory items/levels/evolution changed
    const wHash = weapons.map(w => `${w.id}:${w.level}:${w.isEvolution ? 1 : 0}`).join('|');
    if (wHash !== this.cachedState.weaponsHash) {
      this.cachedState.weaponsHash = wHash;
      this.renderWeaponSlots(weapons);
    }

    const pHash = passives.map(p => `${p.key}:${p.level}`).join('|');
    if (pHash !== this.cachedState.passivesHash) {
      this.cachedState.passivesHash = pHash;
      this.renderPassiveSlots(passives);
    }
  }

  renderWeaponSlots(weapons) {
    this.weaponSlotsEl.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const slot = document.createElement('div');
      slot.className = 'slot-box';
      slot.id = `weapon-slot-${i}`;

      if (i < weapons.length) {
        const w = weapons[i];
        slot.setAttribute('data-weapon-id', w.id);
        if (w.isEvolution) {
          slot.classList.add('evolution-slot');
        }
        const badgeText = w.isEvolution ? 'EVO' : `L${w.level}`;
        const badgeClass = w.isEvolution ? 'slot-badge badge-gold' : 'slot-badge';

        slot.innerHTML = `
          <div class="slot-icon">${getIconSvg(w.id)}</div>
          <span class="${badgeClass}">${badgeText}</span>
          <div class="slot-cooldown-overlay" id="cd-overlay-${i}"></div>
        `;
      } else {
        slot.classList.add('empty');
      }

      this.weaponSlotsEl.appendChild(slot);
    }
  }

  /**
   * Smooth weapon cooldown overlay update (called per frame)
   */
  updateWeaponCooldowns(weapons) {
    if (!weapons || weapons.length === 0) return;
    for (let i = 0; i < weapons.length && i < 6; i++) {
      const w = weapons[i];
      const overlay = document.getElementById(`cd-overlay-${i}`);
      if (overlay) {
        const cdRatio = Math.max(0, Math.min(1.0, w.cdRatio || 0));
        if (cdRatio > 0.01) {
          overlay.style.display = 'block';
          // Sweep clockwise using polygon or linear clip
          const deg = cdRatio * 360;
          overlay.style.background = `conic-gradient(rgba(0, 0, 0, 0.75) ${deg}deg, transparent ${deg}deg)`;
        } else {
          overlay.style.display = 'none';
        }
      }
    }
  }

  renderPassiveSlots(passives) {
    if (!passives || passives.length === 0) {
      this.passiveSlotsEl.innerHTML = '<span style="font-size: 10px; color: #64748b; font-style: italic;">Belum ada pasif</span>';
      return;
    }

    this.passiveSlotsEl.innerHTML = '';
    for (const p of passives) {
      const slot = document.createElement('div');
      slot.className = 'slot-box passive';
      slot.setAttribute('data-passive-key', p.key);
      slot.innerHTML = `
        <div class="slot-icon">${getIconSvg(p.key)}</div>
        <span class="slot-badge">L${p.level}</span>
      `;
      this.passiveSlotsEl.appendChild(slot);
    }
  }

  /**
   * Triggers a brief highlight flash on an upgraded slot
   * @param {string} type - 'weapon' | 'passive'
   * @param {string} id 
   */
  flashSlot(type, id) {
    const selector = type === 'weapon'
      ? `.slot-box[data-weapon-id="${id}"]`
      : `.slot-box.passive[data-passive-key="${id}"]`;
    const slot = this.hudLayer.querySelector(selector);
    if (slot) {
      slot.classList.remove('slot-just-upgraded');
      void slot.offsetWidth; // Force reflow
      slot.classList.add('slot-just-upgraded');
    }
  }

  /**
   * Displays center screen banner with pop animation and auto fade-out
   * @param {string} title 
   * @param {string} subtitle 
   * @param {number} durationMs 
   */
  showEventBanner(title, subtitle = '', durationMs = 1800) {
    if (this.bannerTimeout) {
      clearTimeout(this.bannerTimeout);
    }

    this.bannerTitleEl.textContent = title;
    this.bannerSubtitleEl.textContent = subtitle;
    this.bannerContainer.classList.add('visible');

    this.bannerTimeout = setTimeout(() => {
      this.bannerContainer.classList.remove('visible');
      this.bannerTimeout = null;
    }, durationMs);
  }

  /**
   * Shows dedicated dramatic Evolution Banner
   * @param {string} name 
   */
  showEvolutionBanner(name) {
    this.showEventBanner('EVOLUSI SENJATA!', `SINERGI "${name.toUpperCase()}" TELAH AKTIF!`, 2200);
  }

  /**
   * Shows dedicated Boss HP bar
   */
  showBossBar(name = 'MECH-TITAN', maxHp = 1200) {
    if (this.bossContainer) this.bossContainer.classList.add('visible');
    if (this.bossTitle) this.bossTitle.textContent = name;
    if (this.bossHpNumbers) this.bossHpNumbers.textContent = `${maxHp} / ${maxHp}`;
    if (this.bossBarFill) this.bossBarFill.style.width = '100%';
  }

  /**
   * Hides Boss HP bar
   */
  hideBossBar() {
    if (this.bossContainer) this.bossContainer.classList.remove('visible');
  }

  /**
   * Pulses red screen vignette border
   * @param {number} durationMs 
   */
  triggerRedVignetteFlash(durationMs = 600) {
    if (this.vignetteTimeout) {
      clearTimeout(this.vignetteTimeout);
    }

    this.vignetteEl.classList.add('active');
    this.vignetteTimeout = setTimeout(() => {
      this.vignetteEl.classList.remove('active');
      this.vignetteTimeout = null;
    }, durationMs);
  }

  /**
   * Cleanup DOM elements
   */
  destroy() {
    if (this.bannerTimeout) clearTimeout(this.bannerTimeout);
    if (this.vignetteTimeout) clearTimeout(this.vignetteTimeout);
    if (this.vignetteEl && this.vignetteEl.parentNode) this.vignetteEl.parentNode.removeChild(this.vignetteEl);
    if (this.bannerContainer && this.bannerContainer.parentNode) this.bannerContainer.parentNode.removeChild(this.bannerContainer);
    if (this.f3Panel && this.f3Panel.parentNode) this.f3Panel.parentNode.removeChild(this.f3Panel);
    if (this.hudLayer && this.hudLayer.parentNode) this.hudLayer.parentNode.removeChild(this.hudLayer);
  }
}
