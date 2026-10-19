import { CARD_CONFIG } from '../config/cards.js';
import { WEAPON_CONFIG } from '../config/weapons.js';
import { GAME_CONFIG } from '../config/game.js';
import { EvolutionSystem } from './EvolutionSystem.js';

/**
 * CardSystem.js - Tahap 4A-2 & 4B-2
 * Pure Rogue-lite logic engine for card selection, build progression, passive perks,
 * and weapon synergy evolutions.
 * All visual rendering and interactive DOM button events are now delegated to UIManager (HTML/CSS).
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

    // Synergy Evolution Engine (Tahap 4B-2)
    this.evolutionSystem = new EvolutionSystem(scene, kaiju, weaponSystem, this);

    // Passive perk levels (1-5)
    this.passiveLevels = new Map();

    // Dynamic passive combat buffs (Tahap 4B-1)
    this.vampirismHeal = 0;
    this.vampirismVehicleHeal = 0;

    this.bloodRageStacks = 0;
    this.bloodRageTimer = 0;
    this.bloodRageDmgPerStack = 0.04;
    this.bloodRageMaxStacks = 5;
    this.bloodRageDuration = 4.0;

    this.citySprinterTimer = 0;
    this.citySprinterSpeedBoost = 0;
    this.citySprinterDuration = 2.5;
    this.citySprinterHeal = 0;
    this.citySprinterActive = false;

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

    // Auto-advance if all cards are maxed and no evolution available
    if (cards.length === 0) {
      this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + CARD_CONFIG.skipRewardHp);
      this.presentNextLevelUp();
      return;
    }

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
  rollCards(preserveEvolution = false) {
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

      // Check for synergy hints (Tahap 4B-2)
      if (this.evolutionSystem) {
        const hints = this.evolutionSystem.getSynergyHints(card.weaponId || card.passiveKey);
        card.synergyHints = (hints && hints.length > 0) ? hints : null;
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

    const chosen = [];

    // Check if an evolution is eligible to be presented in slot 0 (Tahap 4B-2)
    const eligibleEvo = this.evolutionSystem ? this.evolutionSystem.getEligibleEvolution() : null;
    if (eligibleEvo) {
      chosen.push({
        isEvolution: true,
        card: {
          id: eligibleEvo.evolutionId,
          name: eligibleEvo.name,
          icon: eligibleEvo.icon,
          rarity: 'EVOLUTION',
          type: 'evolution',
          descriptions: [eligibleEvo.description],
          isEvolution: true,
          primaryIngredient: eligibleEvo.primaryIngredient,
          secondaryIngredient: eligibleEvo.secondaryIngredient,
          evoData: eligibleEvo.evoData
        },
        currentLevel: 1,
        nextLevel: 1,
        weight: 9999,
        rarityData: { name: 'EVOLUSI', color: '#ffd700', hex: 0xffd700 }
      });
    }

    const targetCount = 3;
    const pool = [...eligibleCards];

    while (chosen.length < targetCount && pool.length > 0) {
      // Filter candidates to prevent offering 3 cards with the exact same role
      let candidates = pool;
      if (chosen.length === 2 && chosen[0].card.role && chosen[0].card.role === chosen[1].card.role) {
        const bannedRole = chosen[0].card.role;
        const alternativePool = pool.filter(item => item.card.role !== bannedRole);
        if (alternativePool.length > 0) {
          candidates = alternativePool;
        }
      }

      let totalWeight = 0;
      for (const item of candidates) totalWeight += item.weight;

      let r = Math.random() * totalWeight;
      let selectedItem = candidates[0];
      for (let i = 0; i < candidates.length; i++) {
        r -= candidates[i].weight;
        if (r <= 0) {
          selectedItem = candidates[i];
          break;
        }
      }

      chosen.push(selectedItem);
      const poolIdx = pool.indexOf(selectedItem);
      if (poolIdx !== -1) {
        pool.splice(poolIdx, 1);
      }
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

    // Handle Evolution card selection (Tahap 4B-2)
    if (chosen.isEvolution || chosen.card?.isEvolution) {
      const evoId = chosen.card.id;
      const success = this.evolutionSystem ? this.evolutionSystem.applyEvolution(evoId) : false;
      if (success && this.scene.uiManager) {
        this.scene.uiManager.flashSlot('evolution', evoId);
      }
      this.presentNextLevelUp();
      return;
    }

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
        this.updateKaijuSpeed();
      } else if (card.passiveKey === 'colossus') {
        // Smoothly scale up Kaiju body & trample footprint
        const nextScale = 1.0 + (effect.scaleBonus || 0.15);
        this.kaiju.setKaijuScale(nextScale);
      } else if (card.passiveKey === 'carnage') {
        this.updateBloodRageBonus();
      } else if (card.passiveKey === 'rapidFire') {
        this.weaponSystem.cooldownMultiplier = effect.cooldownMultiplier || 0.85;
      } else if (card.passiveKey === 'demolisher') {
        this.weaponSystem.buildingDmgMultiplier = effect.buildingDmgMultiplier || 1.35;
      } else if (card.passiveKey === 'thornShield') {
        this.weaponSystem.thornDamage = effect.thornDamage || 25;
        this.weaponSystem.thornRadius = effect.thornRadius || 45;
      } else if (card.passiveKey === 'vampirism') {
        this.vampirismHeal = effect.healPerKill || 1.5;
        this.vampirismVehicleHeal = effect.vehicleHeal || 6.0;
      } else if (card.passiveKey === 'bloodRage') {
        this.bloodRageDmgPerStack = effect.dmgPerStack || 0.04;
        this.bloodRageMaxStacks = effect.maxStacks || 5;
        this.bloodRageDuration = effect.duration || 4.0;
      } else if (card.passiveKey === 'deflector') {
        if (this.kaiju) {
          this.kaiju.reflectChance = effect.reflectChance || 0.18;
          this.kaiju.reflectMultiplier = effect.reflectMult || 1.0;
        }
      } else if (card.passiveKey === 'energyShield') {
        if (this.kaiju) {
          this.kaiju.setEnergyShield(effect.shieldCapacity || 45, effect.rechargeDelay || 6.0);
        }
      } else if (card.passiveKey === 'scavenger') {
        if (this.xpSystem) {
          this.xpSystem.eliteXpMultiplier = effect.eliteXpMult || 1.35;
        }
      } else if (card.passiveKey === 'extendedReach') {
        if (this.weaponSystem) {
          this.weaponSystem.rangeMultiplier = effect.rangeMult || 1.16;
        }
      } else if (card.passiveKey === 'citySprinter') {
        this.citySprinterSpeedBoost = effect.speedBoost || 0.20;
        this.citySprinterDuration = effect.duration || 2.5;
        this.citySprinterHeal = effect.healAmount || 0;
      }
    }
  }

  /**
   * Updates Kaiju movement speed based on Swift Stride and City Sprinter buffs
   */
  updateKaijuSpeed() {
    let speedMult = 1.0;
    const swiftLvl = this.passiveLevels.get('swiftStride') || 0;
    if (swiftLvl > 0) {
      const card = CARD_CONFIG.cards.find(c => c.passiveKey === 'swiftStride');
      if (card && card.effects[swiftLvl - 1]) {
        speedMult = card.effects[swiftLvl - 1].speedMultiplier || 1.15;
      }
    }

    if (this.citySprinterActive) {
      speedMult += (this.citySprinterSpeedBoost || 0.20);
    }

    if (this.kaiju) {
      this.kaiju.speedMultiplier = speedMult;
    }
  }

  /**
   * Updates weapon system damage multiplier combining Carnage and Blood Rage stacks
   */
  updateBloodRageBonus() {
    let carnageMult = 1.0;
    const carnageLvl = this.passiveLevels.get('carnage') || 0;
    if (carnageLvl > 0) {
      const card = CARD_CONFIG.cards.find(c => c.passiveKey === 'carnage');
      if (card && card.effects[carnageLvl - 1]) {
        carnageMult = card.effects[carnageLvl - 1].damageMultiplier || 1.20;
      }
    }

    const bloodRageBonus = this.bloodRageStacks * (this.bloodRageDmgPerStack || 0.04);
    if (this.weaponSystem) {
      this.weaponSystem.damageMultiplier = carnageMult * (1.0 + bloodRageBonus);
    }
  }

  /**
   * Handles enemy kill events for Vampirism and Blood Rage
   * @param {number} eType 
   * @param {number} ex 
   * @param {number} ey 
   */
  handleEnemyKilled(eType, ex, ey) {
    if (!this.kaiju || this.kaiju.isDead) return;

    // 1. Vampirism / Regenerasi Agresif
    const vampLvl = this.passiveLevels.get('vampirism') || 0;
    if (vampLvl > 0) {
      const isVehicle = (eType === 1 || eType === 3 || eType === 5); // POLICE_CAR, TANK, HELICOPTER
      const heal = isVehicle ? (this.vampirismVehicleHeal || 6.0) : (this.vampirismHeal || 1.5);
      this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + heal);
    }

    // 2. Blood Rage / Haus Darah
    const rageLvl = this.passiveLevels.get('bloodRage') || 0;
    if (rageLvl > 0) {
      this.bloodRageStacks = Math.min(this.bloodRageMaxStacks || 5, this.bloodRageStacks + 1);
      this.bloodRageTimer = this.bloodRageDuration || 4.0;
      this.updateBloodRageBonus();
    }
  }

  /**
   * Handles building collapse event for City Sprinter / Pelari Kota
   */
  handleBuildingDestroyed() {
    const sprintLvl = this.passiveLevels.get('citySprinter') || 0;
    if (sprintLvl > 0) {
      this.citySprinterActive = true;
      this.citySprinterTimer = this.citySprinterDuration || 2.5;

      if (this.citySprinterHeal > 0 && this.kaiju && !this.kaiju.isDead) {
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + this.citySprinterHeal);
      }

      this.updateKaijuSpeed();
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
   * Per-frame update for active passives like Regeneration, Blood Rage, and City Sprinter
   * @param {number} dt 
   */
  update(dt) {
    if (this.isModalOpen) return;

    // Passive: Regeneration
    const regenLevel = this.passiveLevels.get('regeneration') || 0;
    if (regenLevel > 0 && this.kaiju && this.kaiju.hp < this.kaiju.maxHp) {
      const card = CARD_CONFIG.cards.find(c => c.id === 'regenerasi');
      if (card) {
        const hpPerSec = card.effects[regenLevel - 1].hpPerSec;
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + hpPerSec * dt);
      }
    }

    // Passive: Blood Rage decay
    if (this.bloodRageTimer > 0) {
      this.bloodRageTimer -= dt;
      if (this.bloodRageTimer <= 0) {
        this.bloodRageStacks = 0;
        this.updateBloodRageBonus();
      }
    }

    // Passive: City Sprinter decay
    if (this.citySprinterTimer > 0) {
      this.citySprinterTimer -= dt;
      if (this.citySprinterTimer <= 0) {
        this.citySprinterActive = false;
        this.updateKaijuSpeed();
      }
    }
  }

  /**
   * Resets all cards, passives, rerolls, and closes modal cleanly (RunState reset)
   */
  reset() {
    this.passiveLevels.clear();
    if (this.evolutionSystem) {
      this.evolutionSystem.reset();
    }
    this.rerollsRemaining = CARD_CONFIG.rerollsPerRun;
    this.levelUpQueue = [];
    this.closeModal();

    this.bloodRageStacks = 0;
    this.bloodRageTimer = 0;
    this.citySprinterTimer = 0;
    this.citySprinterActive = false;

    if (this.kaiju) {
      this.kaiju.speedMultiplier = 1.0;
      this.kaiju.reflectChance = 0;
      this.kaiju.reflectMultiplier = 1.0;
      this.kaiju.setEnergyShield(0);
    }
    if (this.weaponSystem) {
      this.weaponSystem.rangeMultiplier = 1.0;
      this.weaponSystem.damageMultiplier = 1.0;
    }
    if (this.xpSystem) {
      this.xpSystem.eliteXpMultiplier = 1.0;
    }
  }

  /**
   * Destroys logic references
   */
  destroy() {
    this.reset();
  }
}
