import { CARD_CONFIG } from '../config/cards.js';
import { WEAPON_CONFIG } from '../config/weapons.js';
import { GAME_CONFIG } from '../config/game.js';

/**
 * CardSystem.js - Tahap 4A-2
 * Pure Rogue-lite logic engine for card selection, build progression, and passive perks.
 * All visual rendering and interactive DOM button events are now delegated to UIManager (HTML/CSS).
 *
 * Features:
 * - Queued level-ups for rapid multi-level handling
 * - Cohesive build biasing (owned weapons appear more frequently)
 * - Strict eligibility filtering (no maxed cards, weapon slot cap of 6)
 * - Reroll and Skip mechanics with compensations
 * - RunState lifecycle (clean reset on death/revival)
 */
export class CardSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} kaiju - Kaiju instance
   * @param {Object} weaponSystem - WeaponSystem instance
   * @param {Object} xpSystem - XpSystem instance
   */
  constructor(scene, kaiju, weaponSystem, xpSystem) {
    this.scene = scene;
    this.kaiju = kaiju;
    this.weaponSystem = weaponSystem;
    this.xpSystem = xpSystem;

    // Passive perk levels (1-5)
    this.passiveLevels = new Map();

    // Rerolls remaining for this run
    this.rerollsRemaining = CARD_CONFIG.rerollsPerRun;

    // Queue of pending level-ups
    this.levelUpQueue = [];
    this.isModalOpen = false;
    this.currentDisplayedCards = [];
  }

  /**
   * Enqueues a level-up event.
   * If modal is not currently open, opens it immediately.
   * @param {number} level - New Kaiju level
   */
  queueLevelUp(level) {
    this.levelUpQueue.push(level);
    if (!this.isModalOpen) {
      this.presentNextLevelUp();
    }
  }

  /**
   * Opens the card selection screen for the next pending level in the queue.
   */
  presentNextLevelUp() {
    if (this.levelUpQueue.length === 0) {
      this.closeModal();
      return;
    }

    const currentLevel = this.levelUpQueue.shift();
    this.isModalOpen = true;
    this.scene.isCardSelecting = true; // Pause gameplay updates

    const cards = this.rollCards();

    // Delegate presentation to HTML UIManager
    if (this.scene.uiManager) {
      this.scene.uiManager.showLevelUp(cards, {
        currentLevel,
        queueCount: this.levelUpQueue.length,
        rerollsRemaining: this.rerollsRemaining,
        onSelect: (index) => this.selectCard(index),
        onReroll: () => this.reroll(),
        onSkip: () => this.skip()
      });
    }
  }

  /**
   * Rolls 3 distinct eligible cards based on weights and build synergy.
   * @returns {Array} Selected eligible card entries
   */
  rollCards() {
    const eligibleCards = [];
    const equippedWeaponCount = this.weaponSystem ? this.weaponSystem.equippedWeapons.size : 0;

    for (const card of CARD_CONFIG.cards) {
      let currentLevel = 0;
      if (card.type === 'weapon') {
        currentLevel = this.weaponSystem.getWeaponLevel(card.weaponId);
      } else {
        currentLevel = this.passiveLevels.get(card.passiveKey) || 0;
      }

      // Check max level condition
      if (currentLevel >= card.maxLevel) continue;

      // Check 6 weapon slots cap condition
      if (card.type === 'weapon' && currentLevel === 0 && equippedWeaponCount >= WEAPON_CONFIG.maxWeaponSlots) {
        continue;
      }

      // Calculate weight based on rarity and owned build bonus
      const rarityData = CARD_CONFIG.rarities[card.rarity] || CARD_CONFIG.rarities.COMMON;
      let weight = rarityData.weight;

      if (card.type === 'weapon' && currentLevel > 0) {
        weight *= CARD_CONFIG.ownedWeaponWeightMultiplier;
      }

      eligibleCards.push({
        card,
        currentLevel,
        nextLevel: currentLevel + 1,
        weight,
        rarityData
      });
    }

    // Select up to 3 distinct cards using roulette wheel selection
    const chosen = [];
    const pool = [...eligibleCards];

    for (let c = 0; c < 3; c++) {
      if (pool.length === 0) break;

      let totalWeight = 0;
      for (const item of pool) totalWeight += item.weight;

      let r = Math.random() * totalWeight;
      let selectedIdx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) {
          selectedIdx = i;
          break;
        }
      }

      chosen.push(pool[selectedIdx]);
      pool.splice(selectedIdx, 1);
    }

    this.currentDisplayedCards = chosen;
    return chosen;
  }

  /**
   * Selects a card by index (0, 1, or 2)
   * @param {number} index 
   */
  selectCard(index) {
    if (!this.isModalOpen || index >= this.currentDisplayedCards.length) return;

    const chosen = this.currentDisplayedCards[index];
    this.applyCard(chosen.card, chosen.nextLevel);

    // Visual feedback in UI & particle effect
    if (this.scene.uiManager) {
      this.scene.uiManager.flashSlot(chosen.card.type, chosen.card.weaponId || chosen.card.passiveKey);
    }

    if (this.scene.particleManager) {
      this.scene.particleManager.emitDebris(this.kaiju.x, this.kaiju.y, chosen.rarityData.hex, 8, 45);
    }

    // Progress to next queued level or close
    this.presentNextLevelUp();
  }

  /**
   * Applies the chosen card's effects to Kaiju, WeaponSystem, or XpSystem.
   * @param {Object} card 
   * @param {number} level 
   */
  applyCard(card, level) {
    if (card.type === 'weapon') {
      this.weaponSystem.equipWeapon(card.weaponId, level);
    } else if (card.type === 'passive') {
      this.passiveLevels.set(card.passiveKey, level);
      const effect = card.effects[level - 1] || card.effects[0];

      if (card.passiveKey === 'ironSkin') {
        const bonusHp = Math.round(GAME_CONFIG.kaiju.maxHp * (1 + (level * 0.15)));
        this.kaiju.maxHp = bonusHp;
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + (effect.healAmount || 45));
      } else if (card.passiveKey === 'magnet') {
        this.xpSystem.magnetRadiusBonus = effect.radiusBonus || 0;
      } else if (card.passiveKey === 'swiftStride') {
        this.kaiju.speedMultiplier = effect.speedMultiplier || 1.15;
      } else if (card.passiveKey === 'colossus') {
        // Smoothly scale up Kaiju body & trample footprint
        const nextScale = 1.0 + (effect.scaleBonus || 0.15);
        this.kaiju.setKaijuScale(nextScale);
      } else if (card.passiveKey === 'carnage') {
        this.weaponSystem.damageMultiplier = effect.damageMultiplier || 1.2;
      } else if (card.passiveKey === 'rapidFire') {
        this.weaponSystem.cooldownMultiplier = effect.cooldownMultiplier || 0.85;
      } else if (card.passiveKey === 'demolisher') {
        this.weaponSystem.buildingDmgMultiplier = effect.buildingDmgMultiplier || 1.35;
      } else if (card.passiveKey === 'thornShield') {
        this.weaponSystem.thornDamage = effect.thornDamage || 25;
        this.weaponSystem.thornRadius = effect.thornRadius || 45;
      }
    }
  }

  /**
   * Rerolls currently offered cards if rerolls are available
   */
  reroll() {
    if (this.rerollsRemaining <= 0 || !this.isModalOpen) return;
    this.rerollsRemaining--;

    const cards = this.rollCards();
    if (this.scene.uiManager) {
      this.scene.uiManager.showLevelUp(cards, {
        currentLevel: this.xpSystem.level,
        queueCount: this.levelUpQueue.length,
        rerollsRemaining: this.rerollsRemaining,
        onSelect: (index) => this.selectCard(index),
        onReroll: () => this.reroll(),
        onSkip: () => this.skip()
      });
    }
  }

  /**
   * Skips card selection, awards compensation, and closes modal
   */
  skip() {
    if (!this.isModalOpen) return;

    // Award compensation: Heal 25 HP
    this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + CARD_CONFIG.skipRewardHp);

    this.presentNextLevelUp();
  }

  /**
   * Closes the card modal and unpauses the game
   */
  closeModal() {
    this.isModalOpen = false;
    this.scene.isCardSelecting = false;
    if (this.scene.uiManager) {
      this.scene.uiManager.closeLevelUp();
    }
  }

  /**
   * Per-frame update for active passives like Regeneration
   * @param {number} dt 
   */
  update(dt) {
    if (this.isModalOpen) return;

    // Passive: Regeneration
    const regenLevel = this.passiveLevels.get('regeneration') || 0;
    if (regenLevel > 0 && this.kaiju.hp < this.kaiju.maxHp) {
      const card = CARD_CONFIG.cards.find(c => c.id === 'regenerasi');
      if (card) {
        const hpPerSec = card.effects[regenLevel - 1].hpPerSec;
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + hpPerSec * dt);
      }
    }
  }

  /**
   * Resets all cards, passives, rerolls, and closes modal cleanly (RunState reset)
   */
  reset() {
    this.passiveLevels.clear();
    this.rerollsRemaining = CARD_CONFIG.rerollsPerRun;
    this.levelUpQueue = [];
    this.closeModal();

    if (this.kaiju) {
      this.kaiju.speedMultiplier = 1.0;
    }
  }

  /**
   * Destroys logic references
   */
  destroy() {
    this.reset();
  }
}
