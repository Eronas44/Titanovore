/**
 * Special Events Configuration - Tahap 5B-2
 * Defines random city-wide special events: Military Convoy, Carpet Bombing Airstrike, and Mass Evacuation.
 */
export const EVENT_CONFIG = {
  // Global Trigger Timing
  minIntervalSeconds: 90, // Minimum cooldown between events
  firstEventDelaySeconds: 45, // Delay after game start before first event can trigger
  
  // Events Definition
  events: {
    MILITARY_CONVOY: {
      id: 'MILITARY_CONVOY',
      name: 'Konvoi Militer',
      minAlert: 2,
      weight: 1.0,
      duration: 45, // Seconds before convoy reaches target/disperses
      vehicleCountMin: 6,
      vehicleCountMax: 8,
      infantryEscortCount: 8,
      truckSoldierPayload: 4, // Infantry spawned when a truck is destroyed
      rewardXp: 850, // Granted if all convoy vehicles are eliminated before time expires
      bannerTitle: 'KONVOI MILITER BERGERAK',
      bannerSubtitle: 'Barisan logistik militer melintas! Hancurkan sebelum lolos!',
      bannerDuration: 3000,
      minimapColor: '#f97316' // Orange convoy marker
    },

    AIRSTRIKE: {
      id: 'AIRSTRIKE',
      name: 'Serangan Udara',
      minAlert: 3,
      weight: 1.0,
      waves: 3,
      waveInterval: 4.0, // Delay between consecutive bomber waves
      telegraphDuration: 1.5, // Red warning strip on ground before bombs hit
      shadowSpeed: 620, // High-speed bomber shadow passing overhead
      bombsPerWave: 9,
      bombSpacing: 42, // Distance between carpet bomb craters along flight line
      bombExplosionRadius: 28,
      bombDamageKaiju: 16,
      bombBuildingDamage: 3.2,
      survivalBonusScore: 600, // Bonus score awarded if Kaiju takes 0 damage during airstrike
      bannerTitle: 'SERANGAN UDARA: BOMBER TERDETEKSI',
      bannerSubtitle: 'Skuadron pembom mendekat! Hindari karpet bom di tanah!',
      bannerDuration: 3000,
      minimapColor: '#ef4444' // Red alert marker
    },

    EVACUATION: {
      id: 'EVACUATION',
      name: 'Evakuasi Masal',
      minAlert: 1,
      weight: 1.0,
      duration: 40, // 40 seconds evacuation window
      spawnInterval: 1.2, // Spawn waves of fleeing citizens
      citizensPerWave: 8,
      maxCitizensTotal: 70,
      policeEscortCount: 6,
      xpMultiplier: 2.5, // 2.5x XP when crushing evacuation citizens
      searchRadiusMin: 220, // Distance from Kaiju to locate evacuation point
      searchRadiusMax: 360,
      zoneRadius: 40, // Green circle radius on ground
      bannerTitle: 'EVAKUASI WARGA TERBUKA',
      bannerSubtitle: 'Warga melarikan diri ke titik evakuasi! Waktu terbatas!',
      bannerDuration: 3000,
      minimapColor: '#10b981' // Green evacuation point
    }
  }
};
