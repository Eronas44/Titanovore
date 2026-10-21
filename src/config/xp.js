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
    SOLDIER: 2, // Dituned dari 4 agar drop prajurit tidak berlebihan
    TANK: 6, // Dituned dari 15 agar tank tidak langsung memberi instan-level
    HELICOPTER: 8, // Dituned dari 20
    DRONE: 2
  },

  // Direct XP (No crystals, directly added to XP bar)
  directXp: {
    cellDestroyed: 0.02, // Dituned dari 0.15 agar jalan kaki di gedung tidak loncat level instan
    buildingCollapse: 1.0 // Dituned dari 3.0
  },

  // Magnet Tuning
  magnet: {
    baseRadius: 55, // Base pull radius in px
    pullSpeedBase: 90, // Initial acceleration px/sec
    pullSpeedMax: 320, // Maximum pull speed px/sec
    pickupDistance: 16 // Distance to Kaiju center for collection
  },

  // Level Curve (Level 2 tercapai di ~20s: 38 XP; lalu melambat ~1 level tiap 30-45s)
  baseXpForLevel2: 38,
  levelScalingExponent: 1.65,

  /**
   * Calculates XP required to advance from current level to next level
   * @param {number} level - Current player level (1-indexed)
   * @returns {number}
   */
  getXpRequiredForLevel(level) {
    if (level <= 1) return 38;
    return Math.round(38 * Math.pow(level, 1.65));
  }
};
