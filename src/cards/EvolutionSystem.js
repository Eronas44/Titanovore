import { EVOLUTION_CONFIG } from '../config/evolutions.js';

/**
 * EvolutionSystem - Tahap 4B-2
 * Rogue-lite Synergy Evolution Logic Engine.
 * 
 * Features:
 * - Ingredient validation (weapons & passives with min levels)
 * - Priority evolution offering on level-up card selection
 * - Slot fusion: replaces two ingredients with 1 evolved weapon, freeing up a slot
 * - Recipe progression tracking for the in-game Recipe Book (Tab key)
 * - Dramatic presentation (gold screen flash, camera shake, floating banner)
 * - RunState lifecycle (cleanly resets on death/respawn)
 */
export class EvolutionSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} kaiju - Kaiju instance
   * @param {Object} weaponSystem - WeaponSystem instance
   * @param {Object} cardSystem - CardSystem instance
   */
  constructor(scene, kaiju, weaponSystem, cardSystem) {
    this.scene = scene;
    this.kaiju = kaiju;
    this.weaponSystem = weaponSystem;
    this.cardSystem = cardSystem;

    // Set of active / chosen evolutions for this run
    this.activeEvolutions = new Set();
  }

  /**
   * Checks if an evolution's recipe requirements are currently met
   * @param {Object|string} evoOrId 
   * @returns {boolean}
   */
  canEvolve(evoOrId) {
    const evo = typeof evoOrId === 'string'
      ? EVOLUTION_CONFIG.evolutions.find(e => e.id === evoOrId)
      : evoOrId;

    if (!evo) return false;
    if (this.activeEvolutions.has(evo.id)) return false;

    // 1. Check primary ingredient level
    let pLvl = 0;
    if (evo.primaryIngredient.type === 'weapon') {
      pLvl = this.weaponSystem ? this.weaponSystem.getWeaponLevel(evo.primaryIngredient.id) : 0;
    } else {
      pLvl = this.cardSystem ? (this.cardSystem.passiveLevels.get(evo.primaryIngredient.id) || 0) : 0;
    }
    if (pLvl < (evo.primaryIngredient.minLevel || 5)) return false;

    // 2. Check secondary ingredient level
    let sLvl = 0;
    if (evo.secondaryIngredient.type === 'weapon') {
      sLvl = this.weaponSystem ? this.weaponSystem.getWeaponLevel(evo.secondaryIngredient.id) : 0;
    } else {
      sLvl = this.cardSystem ? (this.cardSystem.passiveLevels.get(evo.secondaryIngredient.id) || 0) : 0;
    }
    if (sLvl < (evo.secondaryIngredient.minLevel || 3)) return false;

    return true;
  }

  /**
   * Returns the first eligible evolution card entry, or null if none are ready.
   * @returns {Object|null}
   */
  getEligibleEvolution() {
    for (const evo of EVOLUTION_CONFIG.evolutions) {
      if (this.canEvolve(evo)) {
        return {
          isEvolution: true,
          type: 'evolution',
          evolutionId: evo.id,
          name: evo.name,
          icon: evo.icon,
          role: evo.role,
          rarity: 'EVOLUTION',
          description: evo.description,
          primaryIngredient: evo.primaryIngredient,
          secondaryIngredient: evo.secondaryIngredient,
          evoData: evo
        };
      }
    }
    return null;
  }

  /**
   * Applies an evolution:
   * 1. Re-checks requirements safely
   * 2. Unequips both ingredients (freeing up 1 weapon slot)
   * 3. Equips the evolved weapon
   * 4. Triggers dramatic feedback (shake, flash, gold particles, banner)
   * @param {string} evolutionId 
   * @returns {boolean}
   */
  applyEvolution(evolutionId) {
    const evo = EVOLUTION_CONFIG.evolutions.find(e => e.id === evolutionId);
    if (!evo) {
      console.warn(`[EvolutionSystem] Unknown evolution ID: ${evolutionId}`);
      return false;
    }

    // Safety re-check
    if (!this.canEvolve(evo)) {
      console.warn(`[EvolutionSystem] Evolution ${evolutionId} requirements are no longer satisfied!`);
      return false;
    }

    this.activeEvolutions.add(evolutionId);

    // 1. Unequip Primary Ingredient
    if (evo.primaryIngredient.type === 'weapon') {
      if (this.weaponSystem) this.weaponSystem.unequipWeapon(evo.primaryIngredient.id);
    } else {
      if (this.cardSystem) this.cardSystem.passiveLevels.delete(evo.primaryIngredient.id);
    }

    // 2. Unequip Secondary Ingredient
    if (evo.secondaryIngredient.type === 'weapon') {
      if (this.weaponSystem) this.weaponSystem.unequipWeapon(evo.secondaryIngredient.id);
    } else {
      if (this.cardSystem) this.cardSystem.passiveLevels.delete(evo.secondaryIngredient.id);
    }

    // 3. Equip Evolved Weapon in WeaponSystem
    if (this.weaponSystem) {
      this.weaponSystem.equipEvolvedWeapon(evolutionId, evo);
    }

    // 4. Update visual mutation layer on Kaiju
    if (this.kaiju && typeof this.kaiju.setEvolutionVisual === 'function') {
      this.kaiju.setEvolutionVisual(evolutionId, evo.slot);
    }

    // 5. Dramatic presentation
    this.triggerEvolutionFX(evo);

    return true;
  }

  /**
   * Triggers visual & camera FX for evolution
   * @param {Object} evo 
   */
  triggerEvolutionFX(evo) {
    // Camera shake & golden flash
    if (this.scene && this.scene.cameras && this.scene.cameras.main) {
      this.scene.cameras.main.shake(
        EVOLUTION_CONFIG.cameraShakeDurationMs || 350,
        EVOLUTION_CONFIG.cameraShakeIntensity || 0.008
      );
      this.scene.cameras.main.flash(280, 255, 215, 0);
    }

    // Particle explosion on Kaiju body
    if (this.scene && this.scene.particleManager && this.kaiju) {
      this.scene.particleManager.emitDebris(this.kaiju.x, this.kaiju.y, 0xffd700, 16, 60);
      this.scene.particleManager.emitDebris(this.kaiju.x, this.kaiju.y, 0xff8c00, 10, 45);
      if (typeof this.scene.particleManager.emitCollapseFlash === 'function') {
        this.scene.particleManager.emitCollapseFlash(this.kaiju.x, this.kaiju.y, 30);
      }
    }

    // Show large floating banner via HTML UI
    if (this.scene && this.scene.uiManager && typeof this.scene.uiManager.showEvolutionBanner === 'function') {
      this.scene.uiManager.showEvolutionBanner(evo.name);
    }
  }

  /**
   * Retrieves status of all 6 recipes for the Recipe Book modal.
   * @returns {Array<Object>}
   */
  getAllRecipesStatus() {
    return EVOLUTION_CONFIG.evolutions.map(evo => {
      let pLvl = 0;
      if (evo.primaryIngredient.type === 'weapon') {
        pLvl = this.weaponSystem ? this.weaponSystem.getWeaponLevel(evo.primaryIngredient.id) : 0;
      } else {
        pLvl = this.cardSystem ? (this.cardSystem.passiveLevels.get(evo.primaryIngredient.id) || 0) : 0;
      }

      let sLvl = 0;
      if (evo.secondaryIngredient.type === 'weapon') {
        sLvl = this.weaponSystem ? this.weaponSystem.getWeaponLevel(evo.secondaryIngredient.id) : 0;
      } else {
        sLvl = this.cardSystem ? (this.cardSystem.passiveLevels.get(evo.secondaryIngredient.id) || 0) : 0;
      }

      const pMet = pLvl >= (evo.primaryIngredient.minLevel || 5);
      const sMet = sLvl >= (evo.secondaryIngredient.minLevel || 3);
      const isReady = pMet && sMet && !this.activeEvolutions.has(evo.id);
      const isActive = this.activeEvolutions.has(evo.id);

      return {
        id: evo.id,
        name: evo.name,
        icon: evo.icon,
        description: evo.description,
        primaryIngredient: {
          ...evo.primaryIngredient,
          currentLevel: pLvl,
          isMet: pMet
        },
        secondaryIngredient: {
          ...evo.secondaryIngredient,
          currentLevel: sLvl,
          isMet: sMet
        },
        isReady,
        isActive
      };
    });
  }

  /**
   * Returns synergy hints for a card to display in its description
   * @param {string} id - Weapon ID or Passive Key
   * @returns {Array<Object>} List of matching evolutions
   */
  getSynergyHints(id) {
    const hints = [];
    for (const evo of EVOLUTION_CONFIG.evolutions) {
      if (evo.primaryIngredient.id === id) {
        hints.push({
          evolutionName: evo.name,
          partnerName: evo.secondaryIngredient.name,
          isPrimary: true
        });
      } else if (evo.secondaryIngredient.id === id) {
        hints.push({
          evolutionName: evo.name,
          partnerName: evo.primaryIngredient.name,
          isPrimary: false
        });
      }
    }
    return hints;
  }

  /**
   * Resets evolution state (RunState reset)
   */
  reset() {
    this.activeEvolutions.clear();
  }

  /**
   * Destroys resources
   */
  destroy() {
    this.reset();
  }
}
