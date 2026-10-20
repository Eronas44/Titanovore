import { Hud } from './Hud.js';
import { CardScreen } from './CardScreen.js';
import { DeathScreen } from './DeathScreen.js';
import { RecipeBook } from './RecipeBook.js';
import { Minimap } from './Minimap.js';
import { LayerInspector } from './LayerInspector.js';

/**
 * UIManager.js - Tahap 4A-2, 5A & 6A
 * Master Coordinator for all HTML/CSS UI overlays in Titanovore.
 * Mounted onto <div id="ui-root"> above the Phaser canvas.
 * Manages:
 * - HUD (HP bar, Siaga meter, Timer, Kills, City destruction, Weapons/Passives slots, XP progress, Event banners, District badges)
 * - Minimap (Tactical city radar, district zones, rubble tracking, [N] key expand)
 * - CardScreen (Level-up modal with clickable cards, hotkeys [1, 2, 3, R, S], double-click guards)
 * - DeathScreen (Run summary panel and clickable [R] revive button)
 * - RecipeBook (Synergy evolution recipes & progression modal [TAB])
 * - LayerInspector (Godzilla mutation slots & anchor testing overlay [U])
 * - Clean lifecycle (no listener leaks on respawns or scene restart)
 */
export class UIManager {
  /**
   * @param {string} rootId - ID of DOM root element (default: 'ui-root')
   * @param {Function} getRecipeStatusCallback - Optional callback for live recipe status
   * @param {Object} scene - Reference to GameScene
   */
  constructor(rootId = 'ui-root', getRecipeStatusCallback = null, scene = null) {
    this.root = document.getElementById(rootId);
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = rootId;
      document.body.appendChild(this.root);
    }

    // Clear any residual child nodes
    this.root.innerHTML = '';
    this.scene = scene;
    this.getRecipeStatus = getRecipeStatusCallback;

    // Initialize sub-modules
    this.hud = new Hud(this.root);
    this.minimap = scene ? new Minimap(this.root, scene) : null;
    this.cardScreen = new CardScreen(this.root);
    this.deathScreen = new DeathScreen(this.root);
    this.recipeBook = new RecipeBook(this.root, () => {
      return this.getRecipeStatus ? this.getRecipeStatus() : [];
    });
    this.layerInspector = scene ? new LayerInspector(this.root, scene) : null;

    // Connect HUD recipe button to RecipeBook
    this.hud.onToggleRecipe = () => this.toggleRecipeBook();

    // Connect HUD Kota Baru button
    this.hud.onNewCity = () => {
      if (this.scene && typeof this.scene.startNewCity === 'function') {
        this.scene.startNewCity();
      }
    };
  }

  /**
   * Throttled frame update for HUD and active telemetry
   * @param {Object} state - Normalized game state
   * @param {boolean} force - Force update without throttle
   */
  update(state, force = false) {
    if (this.hud) {
      this.hud.update(state, force);
    }
    if (this.minimap) {
      this.minimap.update(performance.now());
    }
  }

  /**
   * Toggles Minimap expanded tactical view [N]
   */
  toggleMinimap() {
    if (this.minimap) {
      this.minimap.toggleExpanded();
    }
  }

  /**
   * Presents the Level-up card selection modal
   * @param {Array} cards - Eligible cards
   * @param {Object} options - { currentLevel, queueCount, rerollsRemaining, onSelect, onReroll, onSkip }
   */
  showLevelUp(cards, options) {
    if (this.cardScreen) {
      this.cardScreen.show(cards, options);
    }
  }

  /**
   * Closes level-up card selection
   */
  closeLevelUp() {
    if (this.cardScreen) {
      this.cardScreen.close();
    }
  }

  /**
   * Checks if level-up modal is currently open
   * @returns {boolean}
   */
  isCardModalOpen() {
    return this.cardScreen ? this.cardScreen.isOpen : false;
  }

  /**
   * Presents the Death Screen with run statistics
   * @param {Object} stats - Run statistics
   * @param {Function} onRevive - Revival callback
   */
  showDeath(stats, onRevive) {
    // If card modal is open when Kaiju dies, close it cleanly
    if (this.cardScreen && this.cardScreen.isOpen) {
      this.cardScreen.close();
    }

    if (this.deathScreen) {
      this.deathScreen.show(stats, onRevive);
    }
  }

  /**
   * Closes death screen
   */
  closeDeath() {
    if (this.deathScreen) {
      this.deathScreen.close();
    }
  }

  /**
   * Checks if death screen is open
   * @returns {boolean}
   */
  isDeathModalOpen() {
    return this.deathScreen ? this.deathScreen.isOpen : false;
  }

  /**
   * Toggles Recipe Book modal [TAB]
   */
  toggleRecipeBook() {
    if (this.recipeBook) {
      this.recipeBook.toggle();
    }
  }

  /**
   * Checks if recipe book modal is open
   * @returns {boolean}
   */
  isRecipeBookOpen() {
    return this.recipeBook ? this.recipeBook.isOpen : false;
  }

  /**
   * Toggles LayerInspector modal [U]
   */
  toggleLayerInspector() {
    if (this.layerInspector) {
      this.layerInspector.toggle();
    }
  }

  /**
   * Checks if layer inspector modal is open
   * @returns {boolean}
   */
  isLayerInspectorOpen() {
    return this.layerInspector ? this.layerInspector.isOpen : false;
  }

  /**
   * Shows large animated evolution banner
   * @param {string} name 
   */
  showEvolutionBanner(name) {
    if (this.hud && typeof this.hud.showEvolutionBanner === 'function') {
      this.hud.showEvolutionBanner(name);
    } else {
      this.showEventBanner('EVOLUSI SENJATA!', `SINERGI "${name.toUpperCase()}" TELAH AKTIF!`, 2200);
    }
  }

  /**
   * Shows animated center pop banner (e.g. "SIAGA 2!", "KAIJU BERVOLUSI!")
   * @param {string} title 
   * @param {string} subtitle 
   * @param {number} durationMs 
   */
  showEventBanner(title, subtitle = '', durationMs = 1800) {
    if (this.hud) {
      this.hud.showEventBanner(title, subtitle, durationMs);
    }
  }

  /**
   * Triggers red screen vignette flash
   * @param {number} durationMs 
   */
  triggerRedVignetteFlash(durationMs = 600) {
    if (this.hud) {
      this.hud.triggerRedVignetteFlash(durationMs);
    }
  }

  /**
   * Triggers a brief highlight flash on an upgraded weapon/passive slot
   * @param {string} type - 'weapon' | 'passive'
   * @param {string} id 
   */
  flashSlot(type, id) {
    if (this.hud) {
      this.hud.flashSlot(type, id);
    }
  }

  /**
   * Shows a brief futuristic loading screen with progress bar for WorldState loading
   * @param {string} title 
   * @param {number} initialProgress (0..1)
   */
  showLoadingScreen(title = 'MEMUAT KOTA PERSISTEN', initialProgress = 0) {
    if (this.loadingOverlay) {
      this.hideLoadingScreen();
    }

    this.loadingOverlay = document.createElement('div');
    this.loadingOverlay.className = 'save-load-overlay';
    this.loadingOverlay.id = 'save-load-overlay';
    this.loadingOverlay.innerHTML = `
      <div class="save-load-box">
        <div class="save-load-title">${title}</div>
        <div class="save-load-sub">Menerapkan kondisi kehancuran & distrik...</div>
        <div class="save-load-bar-track">
          <div class="save-load-bar-fill" id="save-load-fill" style="width: ${Math.round(initialProgress * 100)}%;"></div>
        </div>
        <div class="save-load-pct" id="save-load-pct">${Math.round(initialProgress * 100)}%</div>
      </div>
    `;

    this.root.appendChild(this.loadingOverlay);
    this.loadingFill = this.loadingOverlay.querySelector('#save-load-fill');
    this.loadingPct = this.loadingOverlay.querySelector('#save-load-pct');
  }

  /**
   * Updates loading screen progress (0..1)
   * @param {number} progress 
   */
  updateLoadingProgress(progress) {
    const pct = Math.min(100, Math.max(0, Math.round(progress * 100)));
    if (this.loadingFill) {
      this.loadingFill.style.width = `${pct}%`;
    }
    if (this.loadingPct) {
      this.loadingPct.textContent = `${pct}%`;
    }
  }

  /**
   * Smoothly hides and destroys the loading screen
   */
  hideLoadingScreen() {
    if (!this.loadingOverlay) return;
    const el = this.loadingOverlay;
    this.loadingOverlay = null;
    this.loadingFill = null;
    this.loadingPct = null;

    el.classList.add('fade-out');
    setTimeout(() => {
      if (el && el.parentNode) {
        el.parentNode.removeChild(el);
      }
    }, 280);
  }

  /**
   * Resets all UI modals and state on respawn
   */
  reset() {
    if (this.cardScreen) this.cardScreen.close();
    if (this.deathScreen) this.deathScreen.close();
    if (this.recipeBook) this.recipeBook.close();
    this.hideLoadingScreen();
  }

  /**
   * Clean destruction of all UI modules and DOM elements
   */
  destroy() {
    if (this.hud) this.hud.destroy();
    if (this.cardScreen) this.cardScreen.destroy();
    if (this.deathScreen) this.deathScreen.destroy();
    if (this.recipeBook) this.recipeBook.destroy();
    if (this.root) this.root.innerHTML = '';
  }
}
