/**
 * Titanovore Districts & Persistent World Configuration - Tahap 5A
 * Defines the 6 city districts, spawn weight multipliers, destruction thresholds,
 * rebuild rules, and persistent world state parameters.
 */
export const DISTRICTS_CONFIG = {
  // District Definitions
  districts: [
    {
      id: 'downtown',
      name: 'Pusat Kota',
      subtitle: 'Metropolis Inti',
      color: '#38bdf8', // Neon Sky Blue
      hexColor: 0x38bdf8,
      minimapColor: 'rgba(56, 189, 248, 0.22)',
      // Higher density of aerial threats (Helis, Drones) & Military
      spawnWeightMultipliers: {
        CITIZEN: 0.6,
        POLICE: 0.8,
        POLICE_CAR: 1.0,
        TANK: 1.0,
        SOLDIER: 1.3,
        HELICOPTER: 2.2,
        DRONE: 2.5,
        ARTILLERY: 1.0
      }
    },
    {
      id: 'commercial',
      name: 'Distrik Komersial',
      subtitle: 'Pusat Niaga & Pertokoan',
      color: '#f59e0b', // Amber
      hexColor: 0xf59e0b,
      minimapColor: 'rgba(245, 158, 11, 0.20)',
      // Mixed civilian & police presence with occasional military
      spawnWeightMultipliers: {
        CITIZEN: 1.2,
        POLICE: 1.4,
        POLICE_CAR: 1.3,
        TANK: 1.0,
        SOLDIER: 1.0,
        HELICOPTER: 1.0,
        DRONE: 0.9,
        ARTILLERY: 0.8
      }
    },
    {
      id: 'residential',
      name: 'Permukiman Warga',
      subtitle: 'Kawasan Perumahan Padat',
      color: '#10b981', // Emerald Green
      hexColor: 0x10b981,
      minimapColor: 'rgba(16, 185, 129, 0.18)',
      // High civilian & patrol police density, low military
      spawnWeightMultipliers: {
        CITIZEN: 2.2,
        POLICE: 1.7,
        POLICE_CAR: 1.4,
        TANK: 0.4,
        SOLDIER: 0.7,
        HELICOPTER: 0.6,
        DRONE: 0.5,
        ARTILLERY: 0.4
      }
    },
    {
      id: 'industrial',
      name: 'Kawasan Industri',
      subtitle: 'Pabrik & Kilang Minyak',
      color: '#ef4444', // Red
      hexColor: 0xef4444,
      minimapColor: 'rgba(239, 68, 68, 0.25)',
      // Heavy tanks, armored units, and mechanized soldiers
      spawnWeightMultipliers: {
        CITIZEN: 0.3,
        POLICE: 0.6,
        POLICE_CAR: 0.8,
        TANK: 2.5,
        SOLDIER: 1.9,
        HELICOPTER: 1.3,
        DRONE: 1.2,
        ARTILLERY: 2.5 // Significantly increased in Industrial district
      }
    },
    {
      id: 'canal_park',
      name: 'Taman & Kanal',
      subtitle: 'Kawasan Hijau & Bantaran Air',
      color: '#06b6d4', // Teal Cyan
      hexColor: 0x06b6d4,
      minimapColor: 'rgba(0, 182, 212, 0.20)',
      // Civilians relaxing, open airspace for helicopters
      spawnWeightMultipliers: {
        CITIZEN: 1.5,
        POLICE: 0.8,
        POLICE_CAR: 0.5,
        TANK: 0.5,
        SOLDIER: 0.9,
        HELICOPTER: 1.2,
        DRONE: 1.0,
        ARTILLERY: 0.5
      }
    },
    {
      id: 'suburbs',
      name: 'Pinggiran Kota',
      subtitle: 'Zona Luar Ring 3',
      color: '#a855f7', // Purple
      hexColor: 0xa855f7,
      minimapColor: 'rgba(168, 85, 247, 0.16)',
      // Easiest zone: low military threat, mostly panicking citizens
      spawnWeightMultipliers: {
        CITIZEN: 1.6,
        POLICE: 0.7,
        POLICE_CAR: 0.5,
        TANK: 0.3,
        SOLDIER: 0.5,
        HELICOPTER: 0.4,
        DRONE: 0.3,
        ARTILLERY: 0.3
      }
    }
  ],

  // District Destruction Milestone & Bonus
  milestones: {
    collapseRewardThreshold: 0.80, // 80% district destroyed
    collapseRewardAlertGain: 15, // Siaga boost on district leveling
    bannerDisplayDuration: 3000 // ms
  },

  // City Reconstruction / Rebuilding Rules
  rebuild: {
    enabled: true,
    delaySeconds: 360, // 6 minutes delay after Kaiju leaves area
    fastDelaySeconds: 10, // Accelerated debug delay with [T] key
    safeDistance: 1400, // Distance (px) from Kaiju to allow rebuilding (~1.5x viewport width)
    cellsPerFrameBudget: 3, // Max cells processed per frame
    rebuildIntervalMs: 250, // Interval between cell rebuild steps
    batchPctPerTick: 0.015, // ~1.5% cells restored per step
    scaffoldColor: '#f59e0b', // Construction scaffolding frame color (amber)
    scaffoldGlow: '#d97706',
    
    // Offline Rebuilding (when game tab was closed)
    offlineRecovery: {
      enabled: true,
      maxCityRecoveryPct: 0.50, // Cap: max 50% of destroyed city can be restored while offline
      pctRecoveredPerHour: 0.08 // 8% of rubble repaired per offline hour
    }
  },

  // Save System Settings
  save: {
    saveVersion: 1,
    dbName: 'TitanovoreWorldDB',
    storeName: 'worldState',
    key: 'activeWorld',
    autoSaveIntervalMs: 20000, // 20s debounced auto-save
    minSaveIntervalMs: 5000 // Throttled minimum gap between saves
  },

  // Minimap Settings
  minimap: {
    compactSize: 130, // px (width & height)
    expandedSize: 340, // px when [N] is toggled
    renderIntervalMs: 1000, // Update at 1 Hz for zero FPS overhead
    kaijuColor: '#22d3ee', // Glowing cyan dot
    enemyClusterColor: '#f87171', // Red dot for enemy presence
    rubbleColor: '#475569' // Slate gray for destroyed cells
  }
};
