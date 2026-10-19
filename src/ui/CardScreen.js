import { getIconSvg, ICONS } from './icons.js';

/**
 * CardScreen.js - Tahap 4A-2
 * Crisp, dark-futuristic HTML/CSS Level-Up Card Modal for Titanovore.
 * Features:
 * - Real, accessible HTML <button> elements guaranteed to receive clicks
 * - Keyboard hotkeys: [1], [2], [3] for cards, [R] for reroll, [S] for skip
 * - Keyboard listeners attached ONLY when modal is open and cleanly destroyed on close
 * - Protection against double-clicks and click-through
 * - Rarity colors (Common, Rare, Epic, Legendary) with neon borders & ambient glow
 * - SVG vector icons, level indicators (BARU / Lv X -> Y) and description
 * - Reroll and Skip buttons with dynamic counter and compensations
 * - Fully responsive (3 columns on desktop, clean column on mobile)
 */
export class CardScreen {
  /**
   * @param {HTMLElement} rootElement - #ui-root container
   */
  constructor(rootElement) {
    this.root = rootElement;
    this.isOpen = false;
    this.isSelecting = false; // Debounce guard against rapid double-clicks
    this.currentCards = [];
    this.onSelectCallback = null;
    this.onRerollCallback = null;
    this.onSkipCallback = null;

    // Bound keyboard handler reference for clean add/remove
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);

    this.mount();
  }

  /**
   * Creates modal DOM structure
   */
  mount() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-overlay';
    this.modalEl.id = 'card-selection-modal';

    this.modalEl.innerHTML = `
      <div class="modal-card-wrapper">
        <div class="modal-header">
          <div class="modal-title" id="card-modal-title">KAIJU BERVOLUSI!</div>
          <div class="modal-subtitle" id="card-modal-subtitle">Pilih 1 peningkatan untuk memperkuat Kaiju [1, 2, 3]</div>
        </div>

        <div class="cards-grid" id="card-buttons-grid">
          <!-- 3 Card buttons populated on show() -->
        </div>

        <div class="modal-actions">
          <button class="action-btn interactive" id="card-reroll-btn">
            ${ICONS.reroll}
            <span id="reroll-btn-text">REROLL [R] (2)</span>
          </button>
          <button class="action-btn interactive" id="card-skip-btn">
            ${ICONS.skip}
            <span>LEWATI [S] (+25 HP)</span>
          </button>
        </div>
      </div>
    `;

    this.root.appendChild(this.modalEl);

    // Cache elements
    this.titleEl = this.modalEl.querySelector('#card-modal-title');
    this.subtitleEl = this.modalEl.querySelector('#card-modal-subtitle');
    this.gridEl = this.modalEl.querySelector('#card-buttons-grid');
    this.rerollBtn = this.modalEl.querySelector('#card-reroll-btn');
    this.rerollTextEl = this.modalEl.querySelector('#reroll-btn-text');
    this.skipBtn = this.modalEl.querySelector('#card-skip-btn');

    // Bind action button clicks
    this.rerollBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerReroll();
    });

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.triggerSkip();
    });
  }

  /**
   * Shows card selection modal with 3 cards
   * @param {Array} cards - Card objects with { card, currentLevel, nextLevel, rarityData }
   * @param {Object} options - { currentLevel, queueCount, rerollsRemaining, onSelect, onReroll, onSkip }
   */
  show(cards, options) {
    this.currentCards = cards;
    this.onSelectCallback = options.onSelect;
    this.onRerollCallback = options.onReroll;
    this.onSkipCallback = options.onSkip;
    this.isSelecting = false;

    // Update Header
    const lvl = options.currentLevel || 2;
    this.titleEl.textContent = `KAIJU BERVOLUSI · LEVEL ${lvl}`;
    if (options.queueCount > 0) {
      this.subtitleEl.textContent = `Pilih 1 peningkatan (+${options.queueCount} level lagi menanti)`;
    } else {
      this.subtitleEl.textContent = 'Pilih 1 peningkatan untuk memperkuat Kaiju [1, 2, 3]';
    }

    // Update Reroll Button state
    const rerolls = options.rerollsRemaining !== undefined ? options.rerollsRemaining : 2;
    this.rerollTextEl.textContent = `REROLL [R] (${rerolls})`;
    if (rerolls <= 0) {
      this.rerollBtn.disabled = true;
    } else {
      this.rerollBtn.disabled = false;
    }

    // Render Cards
    this.renderCards(cards);

    // Attach active keyboard listener
    window.addEventListener('keydown', this.boundKeyDownHandler, true);

    // Reveal modal
    this.isOpen = true;
    this.modalEl.classList.add('open');
  }

  /**
   * Populates the 3 card buttons
   */
  renderCards(cards) {
    this.gridEl.innerHTML = '';

    cards.forEach((item, index) => {
      const card = item.card;
      const btn = document.createElement('button');

      // 1. Dedicated Gold Evolution Card (Tahap 4B-2)
      if (item.isEvolution || card.isEvolution) {
        btn.className = 'card-btn card-evolution interactive';
        btn.setAttribute('type', 'button');
        btn.setAttribute('data-card-index', index);

        const p1 = card.primaryIngredient || { name: 'Bahan 1', minLevel: 5 };
        const p2 = card.secondaryIngredient || { name: 'Bahan 2', minLevel: 3 };

        btn.innerHTML = `
          <div class="card-top-row">
            <div style="display: flex; gap: 5px; align-items: center;">
              <span class="card-rarity-badge badge-gold-glow">⚗ EVOLUSI</span>
            </div>
            <span class="card-hotkey-badge gold">[ ${index + 1} ]</span>
          </div>

          <div class="card-icon-frame gold-glow">
            <div style="color: #ffd700; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
              ${getIconSvg(card.icon || card.id)}
            </div>
          </div>

          <div class="card-name gold-title">${card.name}</div>
          <div class="card-level-tag" style="color: #ffd700; font-weight: 700; letter-spacing: 1px;">SENJATA SINERGI</div>

          <div class="card-fusion-recipe">
            <div class="fusion-step">
              <span class="step-ing">${p1.name}</span>
              <span class="step-lvl">Lv ${p1.minLevel}</span>
            </div>
            <span class="fusion-symbol">+</span>
            <div class="fusion-step">
              <span class="step-ing">${p2.name}</span>
              <span class="step-lvl">Lv ${p2.minLevel}</span>
            </div>
            <span class="fusion-symbol arrow">➔</span>
            <div class="fusion-step result">
              <span class="step-ing result-text">${card.name}</span>
            </div>
          </div>

          <div class="card-desc gold-desc">${card.descriptions?.[0] || ''}</div>
        `;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.triggerSelect(index);
        });

        this.gridEl.appendChild(btn);
        return;
      }

      // 2. Regular Upgrade Card
      const rarity = item.rarityData || { name: 'Umum', color: '#94a3b8' };
      const rarityKey = (card.rarity || 'common').toLowerCase();

      btn.className = `card-btn rarity-${rarityKey} interactive`;
      btn.setAttribute('type', 'button');
      btn.setAttribute('data-card-index', index);

      // Status badge: "BARU" or "Lv 2 → 3"
      const statusStr = item.currentLevel === 0 ? 'BARU' : `Lv ${item.currentLevel} → ${item.nextLevel}`;
      const statusColor = item.currentLevel === 0 ? '#38bdf8' : '#facc15';

      // Description
      const desc = (card.descriptions && card.descriptions[item.nextLevel - 1]) || card.descriptions?.[0] || '';

      // Level progress pips (up to 5 pips)
      let pipsHtml = '<div style="display: flex; gap: 3px; margin-top: 2px;">';
      for (let p = 1; p <= 5; p++) {
        const isFilled = p <= item.nextLevel;
        const pipColor = isFilled ? statusColor : 'rgba(255,255,255,0.15)';
        pipsHtml += `<div style="width: 8px; height: 3px; background: ${pipColor}; border-radius: 1px;"></div>`;
      }
      pipsHtml += '</div>';

      const mutationBadgeHtml = card.isMutation
        ? `<span class="card-mutation-badge">${ICONS.dna} MUTASI</span>`
        : '';

      const synergyBadgeHtml = (card.synergyHints && card.synergyHints.length > 0)
        ? `<span class="card-synergy-badge" title="Bisa dievolusikan">${ICONS.flask} ⚗ EVOLUSI</span>`
        : '';

      let synergyHintHtml = '';
      if (card.synergyHints && card.synergyHints.length > 0) {
        const hint = card.synergyHints[0];
        synergyHintHtml = `<div class="card-synergy-hint">⚗ Sinergi: + ${hint.partnerName} ➔ <span>${hint.evolutionName}</span></div>`;
      }

      btn.innerHTML = `
        <div class="card-top-row">
          <div style="display: flex; gap: 5px; align-items: center; flex-wrap: wrap;">
            <span class="card-rarity-badge" style="color: ${rarity.color}; border-color: ${rarity.color};">${rarity.name}</span>
            ${mutationBadgeHtml}
            ${synergyBadgeHtml}
          </div>
          <span class="card-hotkey-badge">[ ${index + 1} ]</span>
        </div>

        <div class="card-icon-frame" style="border-color: ${rarity.color}40;">
          <div style="color: ${rarity.color}; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
            ${getIconSvg(card.id || card.weaponId || card.passiveKey)}
          </div>
        </div>

        <div class="card-name">${card.name}</div>
        <div class="card-level-tag" style="color: ${statusColor};">${statusStr}</div>
        ${pipsHtml}

        <div class="card-desc">${desc}</div>
        ${synergyHintHtml}
      `;

      // Real DOM button click event
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.triggerSelect(index);
      });

      this.gridEl.appendChild(btn);
    });
  }

  /**
   * Keyboard shortcuts [1], [2], [3], [R], [S]
   */
  handleKeyDown(event) {
    if (!this.isOpen || this.isSelecting) return;

    if (event.key === '1') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerSelect(0);
    } else if (event.key === '2') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerSelect(1);
    } else if (event.key === '3') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerSelect(2);
    } else if (event.key === 'r' || event.key === 'R') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerReroll();
    } else if (event.key === 's' || event.key === 'S') {
      event.preventDefault();
      event.stopPropagation();
      this.triggerSkip();
    }
  }

  /**
   * Selects a card by index with double-click guard
   */
  triggerSelect(index) {
    if (this.isSelecting || !this.isOpen || index >= this.currentCards.length) return;
    this.isSelecting = true;

    // Visually highlight chosen button and disable others
    const buttons = this.gridEl.querySelectorAll('.card-btn');
    buttons.forEach((b, i) => {
      b.disabled = true;
      if (i === index) {
        b.style.transform = 'translateY(-4px) scale(1.02)';
        b.style.borderColor = '#fbbf24';
        b.style.boxShadow = '0 0 25px rgba(251, 191, 36, 0.7)';
      } else {
        b.style.opacity = '0.4';
      }
    });

    if (this.onSelectCallback) {
      this.onSelectCallback(index);
    }
  }

  triggerReroll() {
    if (this.isSelecting || !this.isOpen || this.rerollBtn.disabled) return;
    if (this.onRerollCallback) {
      this.onRerollCallback();
    }
  }

  triggerSkip() {
    if (this.isSelecting || !this.isOpen) return;
    this.isSelecting = true;
    if (this.onSkipCallback) {
      this.onSkipCallback();
    }
  }

  /**
   * Closes the modal and detaches keyboard listeners
   */
  close() {
    this.isOpen = false;
    this.isSelecting = false;
    this.modalEl.classList.remove('open');
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);
  }

  /**
   * Cleans up DOM and listeners
   */
  destroy() {
    this.close();
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
  }
}
