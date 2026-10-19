import { getIconSvg, ICONS } from './icons.js';

/**
 * RecipeBook.js - Tahap 4B-2
 * Modal overlay displaying all 6 weapon synergy evolution recipes,
 * ingredient level requirements, current run progression, and unlock status.
 * Can be opened during gameplay, pause, or level-up selection screen via Tab or UI button.
 */
export class RecipeBook {
  /**
   * @param {HTMLElement} rootElement - #ui-root container
   * @param {Function} getStatusCallback - Callback returning status array from EvolutionSystem
   */
  constructor(rootElement, getStatusCallback) {
    this.root = rootElement;
    this.getStatus = getStatusCallback;
    this.isOpen = false;
    this.boundKeyDownHandler = this.handleKeyDown.bind(this);

    this.mount();
  }

  mount() {
    this.modalEl = document.createElement('div');
    this.modalEl.className = 'modal-overlay recipe-book-overlay';
    this.modalEl.id = 'recipe-book-modal';

    this.modalEl.innerHTML = `
      <div class="recipe-book-wrapper">
        <div class="modal-header recipe-header">
          <div>
            <div class="modal-title recipe-title">
              ${ICONS.flask} RESEP EVOLUSI SENJATA
            </div>
            <div class="modal-subtitle">
              Padukan dua kekuatan pada level syarat untuk melahirkan senjata pamungkas [TAB / ESC untuk tutup]
            </div>
          </div>
          <button class="recipe-close-btn interactive" id="recipe-book-close" title="Tutup [ESC / TAB]">
            ✕
          </button>
        </div>

        <div class="recipe-grid" id="recipe-grid-container">
          <!-- 6 Recipe Cards populated on show() -->
        </div>

        <div class="recipe-footer">
          <div class="recipe-legend">
            <span><span class="legend-dot ready"></span> Siap Evolusi</span>
            <span><span class="legend-dot active"></span> Aktif Terpasang</span>
            <span><span class="legend-dot pending"></span> Belum Memenuhi Syarat</span>
          </div>
          <button class="action-btn interactive" id="recipe-footer-close">
            TUTUP [TAB]
          </button>
        </div>
      </div>
    `;

    this.root.appendChild(this.modalEl);

    // Cache elements
    this.gridEl = this.modalEl.querySelector('#recipe-grid-container');
    this.closeBtn = this.modalEl.querySelector('#recipe-book-close');
    this.footerCloseBtn = this.modalEl.querySelector('#recipe-footer-close');

    // Click handlers
    this.closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    this.footerCloseBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.close();
    });

    // Close when clicking modal backdrop outside wrapper
    this.modalEl.addEventListener('click', (e) => {
      if (e.target === this.modalEl) {
        this.close();
      }
    });
  }

  /**
   * Opens or closes the modal
   */
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.show();
    }
  }

  /**
   * Shows recipe book
   */
  show() {
    this.renderRecipes();
    this.modalEl.classList.add('open');
    this.isOpen = true;
    window.addEventListener('keydown', this.boundKeyDownHandler, true);
  }

  /**
   * Closes recipe book
   */
  close() {
    this.modalEl.classList.remove('open');
    this.isOpen = false;
    window.removeEventListener('keydown', this.boundKeyDownHandler, true);
  }

  /**
   * Populates the 6 recipe cards
   */
  renderRecipes() {
    if (!this.getStatus) return;
    const recipes = this.getStatus() || [];
    this.gridEl.innerHTML = '';

    recipes.forEach((item) => {
      const card = document.createElement('div');
      let statusClass = 'pending';
      let statusBadgeText = 'BELUM MEMENUHI';
      let statusBadgeClass = 'badge-pending';

      if (item.isActive) {
        statusClass = 'active';
        statusBadgeText = 'AKTIF TERPASANG';
        statusBadgeClass = 'badge-active';
      } else if (item.isReady) {
        statusClass = 'ready';
        statusBadgeText = 'SIAP EVOLUSI!';
        statusBadgeClass = 'badge-ready';
      }

      card.className = `recipe-card recipe-${statusClass}`;

      const p1 = item.primaryIngredient;
      const p2 = item.secondaryIngredient;

      const p1Status = p1.isMet ? 'check met' : 'pending';
      const p2Status = p2.isMet ? 'check met' : 'pending';

      card.innerHTML = `
        <div class="recipe-card-header">
          <div class="recipe-icon-frame">
            ${getIconSvg(item.icon || item.id)}
          </div>
          <div class="recipe-info">
            <div class="recipe-name">${item.name}</div>
            <div class="recipe-status-badge ${statusBadgeClass}">${statusBadgeText}</div>
          </div>
        </div>

        <div class="recipe-formula-box">
          <div class="formula-ingredient ${p1Status}">
            <div class="ingredient-name">${p1.name}</div>
            <div class="ingredient-req">Lv ${p1.currentLevel} / ${p1.minLevel} ${p1.isMet ? '✓' : ''}</div>
          </div>
          <div class="formula-operator">+</div>
          <div class="formula-ingredient ${p2Status}">
            <div class="ingredient-name">${p2.name}</div>
            <div class="ingredient-req">Lv ${p2.currentLevel} / ${p2.minLevel} ${p2.isMet ? '✓' : ''}</div>
          </div>
          <div class="formula-operator arrow">➔</div>
          <div class="formula-result">
            <div class="result-name">${item.name}</div>
            <div class="result-tag">SENJATA SINERGI</div>
          </div>
        </div>

        <div class="recipe-desc">${item.description}</div>
      `;

      this.gridEl.appendChild(card);
    });
  }

  handleKeyDown(event) {
    if (!this.isOpen) return;

    if (event.key === 'Tab' || event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      this.close();
    }
  }

  destroy() {
    this.close();
    if (this.modalEl && this.modalEl.parentNode) {
      this.modalEl.parentNode.removeChild(this.modalEl);
    }
  }
}
