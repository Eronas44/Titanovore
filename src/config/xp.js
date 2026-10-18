/**
 * XP & Progression Configuration - Tahap 4A
 * All numbers controlling crystal pools, drops, magnet attraction, and level curves.
 */
export const XP_CONFIG = {
  // Crystal Pool Tuning
  maxCrystals: 300,
  mergeThresholdCount: 220, // Start aggressively merging nearby crystals when pool exceeds this
  mergeRadius: 20, // Distance in px to merge into higher value crystal
  crystalLifetime: 60.0, // Seconds before a lonely crystal fades (long enough not to frustrate)

  // Crystal Drops per Enemy Type
  drops: {
    CITIZEN: 1,
    POLICE: 2,
    POLICE_CAR: 3,
    SOLDIER: 4,
    TANK: 15,
    HELICOPTER: 20,
    DRONE: 2
  },

  // Direct XP (No crystals, directly added to XP bar)
  directXp: {
    cellDestroyed: 0.15,
    buildingCollapse: 3.0
  },

  // Magnet Tuning
  magnet: {
    baseRadius: 55, // Base pull radius in px
    pullSpeedBase: 90, // Initial acceleration px/sec
    pullSpeedMax: 320, // Maximum pull speed px/sec
    pickupDistance: 16 // Distance to Kaiju center for collection
  },

  // Level Curve (Level 2 reachable in ~20s normal play: ~25 XP)
  // Formula: level 1 -> 25 XP, then exponential scaling
  baseXpForLevel2: 25,
  levelScalingExponent: 1.45,

  /**
   * Calculates XP required to advance from current level to next level
   * @param {number} level - Current player level (1-indexed)
   * @returns {number}
   */
  getXpRequiredForLevel(level) {
    if (level <= 1) return 25;
    return Math.round(25 * Math.pow(level, 1.45));
  }
};
