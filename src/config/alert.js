/**
 * Alert System Configuration - Tahap 3B
 * Meter 0-100 with 5 threat escalation levels.
 * Controls spawn tables, active enemy limits, alert gains, and decay rates.
 */
export const ALERT_CONFIG = {
  // Meter Range & Levels
  minAlert: 0,
  maxAlert: 100,
  levels: [
    { level: 1, min: 0, max: 20, name: 'SIAGA 1: DARURAT LOKAL' },
    { level: 2, min: 20, max: 40, name: 'SIAGA 2: RESPON POLISI' },
    { level: 3, min: 40, max: 60, name: 'SIAGA 3: MOBILISASI MILITER' },
    { level: 4, min: 60, max: 80, name: 'SIAGA 4: OPERASI SERBU UDARA' },
    { level: 5, min: 80, max: 100, name: 'SIAGA 5: DARURAT TOTAL' }
  ],

  // Decay Mechanics
  decayDelaySeconds: 5.0, // Decay begins after 5s without destructive action
  decayRatePerSecond: 1.6, // Rate of meter drop per second during inactivity
  levelFloorProtectionDuration: 20.0, // Meter cannot drop below newly reached level for 20s

  // Alert Gain Values
  gains: {
    cellDestroyed: 0.08, // Small gain per building cell crushed
    buildingDestroyed: 4.0, // Large bonus gain when full building collapses
    killCitizen: 0.20,
    killPolice: 0.35,
    killPoliceCar: 0.60,
    killSoldier: 0.50,
    killTank: 1.80,
    killHelicopter: 2.20,
    killDrone: 0.50,
    killArtillery: 1.80,
    killTruck: 0.80
  },

  // Level-specific Spawn Tables and Limits
  // Pool maximum capacity remains 600 in ENEMY_CONFIG
  spawnTables: {
    1: {
      maxActiveTotal: 40,
      spawnIntervalMs: 340,
      spawnBatchSize: 2,
      weights: {
        CITIZEN: 0.60,
        POLICE: 0.40,
        POLICE_CAR: 0.0,
        TANK: 0.0,
        SOLDIER: 0.0,
        HELICOPTER: 0.0,
        DRONE: 0.0,
        ARTILLERY: 0.0
      },
      typeLimits: {
        CITIZEN: 25,
        POLICE: 20,
        POLICE_CAR: 0,
        TANK: 0,
        SOLDIER: 0,
        HELICOPTER: 0,
        DRONE: 0,
        ARTILLERY: 0
      }
    },
    2: {
      maxActiveTotal: 80,
      spawnIntervalMs: 270,
      spawnBatchSize: 2,
      weights: {
        CITIZEN: 0.15,
        POLICE: 0.35,
        POLICE_CAR: 0.10,
        TANK: 0.08, // Tank pertama muncul
        SOLDIER: 0.32,
        HELICOPTER: 0.0,
        DRONE: 0.0,
        ARTILLERY: 0.0
      },
      typeLimits: {
        CITIZEN: 15,
        POLICE: 30,
        POLICE_CAR: 6,
        TANK: 3,
        SOLDIER: 35,
        HELICOPTER: 0,
        DRONE: 0,
        ARTILLERY: 0
      }
    },
    3: {
      maxActiveTotal: 140,
      spawnIntervalMs: 220,
      spawnBatchSize: 3,
      weights: {
        CITIZEN: 0.05,
        POLICE: 0.15,
        POLICE_CAR: 0.05,
        TANK: 0.22,
        SOLDIER: 0.38,
        HELICOPTER: 0.08, // Helikopter pertama muncul
        DRONE: 0.0,
        ARTILLERY: 0.07 // Artileri mulai muncul di Siaga 3
      },
      typeLimits: {
        CITIZEN: 10,
        POLICE: 20,
        POLICE_CAR: 5,
        TANK: 12,
        SOLDIER: 65,
        HELICOPTER: 4,
        DRONE: 0,
        ARTILLERY: 3
      }
    },
    4: {
      maxActiveTotal: 220,
      spawnIntervalMs: 175,
      spawnBatchSize: 4,
      weights: {
        CITIZEN: 0.02,
        POLICE: 0.08,
        POLICE_CAR: 0.03,
        TANK: 0.26,
        SOLDIER: 0.28,
        HELICOPTER: 0.10,
        DRONE: 0.14,
        ARTILLERY: 0.09
      },
      typeLimits: {
        CITIZEN: 6,
        POLICE: 15,
        POLICE_CAR: 4,
        TANK: 20,
        SOLDIER: 80,
        HELICOPTER: 6,
        DRONE: 20,
        ARTILLERY: 5
      }
    },
    5: {
      maxActiveTotal: 320, // Max for Siaga 5
      spawnIntervalMs: 135,
      spawnBatchSize: 5,
      weights: {
        CITIZEN: 0.02,
        POLICE: 0.06,
        POLICE_CAR: 0.02,
        TANK: 0.24,
        SOLDIER: 0.28,
        HELICOPTER: 0.11,
        DRONE: 0.16,
        ARTILLERY: 0.11 // Batas maksimal sekitar 6 sekaligus
      },
      typeLimits: {
        CITIZEN: 6,
        POLICE: 15,
        POLICE_CAR: 4,
        TANK: 28,
        SOLDIER: 95,
        HELICOPTER: 8,
        DRONE: 30,
        ARTILLERY: 6
      }
    }
  }
};
