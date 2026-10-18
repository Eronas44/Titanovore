import { Hud } from './Hud.js';
import { CardScreen } from './CardScreen.js';
import { DeathScreen } from './DeathScreen.js';

/**
 * UIManager.js - Tahap 4A-2
 * Master Coordinator for all HTML/CSS UI overlays in Titanovore.
 * Mounted onto <div id="ui-root"> above the Phaser canvas.
 * Manages:
 * - HUD (HP bar, Siaga meter, Timer, Kills, City destruction, Weapons/Passives slots, XP progress, Event banners)
 * - CardScreen (Level-up modal with clickable cards, hotkeys [1, 2, 3, R, S], double-click guards)
 * - DeathScreen (Run summary panel and clickable [R] revive button)
 * - Clean lifecycle (no listener leaks on respawns or scene restart)
 */
export class UIManager {
  /**
   * @param {string} rootId - ID of DOM root element (default: 'ui-root')
   */
  constructor(rootId = 'ui-root') {
    this.root = document.getElementById(rootId);
    if (!this.root) {
      this.root = document.createElement('div');
      this.root.id = rootId;
      document.body.appendChild(this.root);
    }

    // Clear any residual child nodes
    this.root.innerHTML = '';

    // Initialize sub-modules
    this.hud = new Hud(this.root);
    this.cardScreen = new CardScreen(this.root);
    this.deathScreen = new DeathScreen(this.root);
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
   * Resets all UI modals and state on respawn
   */
  reset() {
    if (this.cardScreen) this.cardScreen.close();
    if (this.deathScreen) this.deathScreen.close();
  }

  /**
   * Clean destruction of all UI modules and DOM elements
   */
  destroy() {
    if (this.hud) this.hud.destroy();
    if (this.cardScreen) this.cardScreen.destroy();
    if (this.deathScreen) this.deathScreen.destroy();
    if (this.root) this.root.innerHTML = '';
  }
}
