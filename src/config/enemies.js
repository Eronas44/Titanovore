/**
 * Enemy & Threat Configuration - Tahap 3A
 * High-performance entity management constants for hundreds of active entities.
 */
export const ENEMY_CONFIG = {
  // Pool Capacities
  maxEnemies: 600, // Maximum active enemies in typed array pool
  maxBullets: 300, // Maximum active enemy projectiles in typed array pool

  // Spatial Hash Grid (for O(1) neighbor lookups, trample, and separation)
  gridCellSize: 32, // 32x32 px grid cell
  
  // Performance & Culling Radii (px around camera center)
  activeUpdateRadius: 420, // Full AI and movement updates inside this radius
  despawnRadius: 650, // Entities beyond this radius are recycled to free pool
  cullMargin: 40, // Frustum culling margin outside camera viewport for rendering

  // Spawn Timing & Ring
  spawnIntervalMs: 220, // Interval between spawn attempts
  spawnBatchSize: 3, // Entities spawned per tick
  spawnRingInnerRadius: 260, // Just outside screen boundary
  spawnRingOuterRadius: 360,

  // Navigation & Flow Field (Tahap 3A-2)
  navCellSize: 8, // 8x8 px navigation grid
  flowFieldUpdateInterval: 0.30, // Recalculate flow field every 0.3s

  // Projectile Tuning
  bulletBuildingDamage: 0.35, // Bullets that miss Kaiju damage city buildings

  // Enemy Types Definitions (Adjusted composition: more tanks, fewer citizens)
  types: {
    CITIZEN: {
      id: 1,
      name: 'Warga Panik',
      width: 3,
      height: 4,
      hp: 1,
      speedFleeing: 75, // Sprint speed when fleeing Kaiju
      speedWander: 28, // Casual walk speed
      fleeDistance: 130, // Distance to Kaiju triggering panic
      xp: 10,
      spawnWeight: 0.15 // Reduced (user: "terlalu banyak warga, seharusnya lebih banyak tank")
    },
    POLICE: {
      id: 2,
      name: 'Polisi',
      width: 4,
      height: 5,
      hp: 3,
      speed: 62,
      shootRangeMin: 70, // Min engagement distance
      shootRangeMax: 92, // Max engagement distance
      shootIntervalMin: 1.5, // Seconds between shots
      shootIntervalMax: 2.5,
      bulletSpeed: 170,
      bulletDamage: 3,
      bulletLife: 1.1, // Max lifetime in seconds
      separationDistance: 18, // Pushes other police away to form firing line
      separationForce: 45,
      xp: 25,
      spawnWeight: 0.45 // Tactical infantry squads
    },
    POLICE_CAR: {
      id: 3,
      name: 'Mobil Polisi',
      width: 9,
      height: 5,
      hp: 8,
      speed: 115,
      ramDamage: 6, // Damage dealt if car rams into Kaiju
      sirenToggleInterval: 0.12, // Flash rate between red & blue lightbars
      xp: 50,
      spawnWeight: 0.10
    },
    TANK: {
      id: 4,
      name: 'Tank Militer',
      width: 14,
      height: 10,
      hp: 25, // Heavily armored war machine
      speed: 46, // Slower tread movement
      shootRangeMin: 110,
      shootRangeMax: 170, // Long-range heavy artillery
      shootIntervalMin: 2.2,
      shootIntervalMax: 3.5,
      shellSpeed: 210,
      shellDamage: 12, // High damage to Kaiju
      shellBuildingDamage: 2.5, // Blasts chunks out of buildings!
      shellLife: 1.2,
      xp: 75,
      spawnWeight: 0.30 // Prominent armored division
    },
    SOLDIER: {
      id: 5,
      name: 'Tentara Militer',
      width: 4,
      height: 5,
      hp: 6, // More durable infantry
      speed: 68,
      shootRangeMin: 85,
      shootRangeMax: 110,
      burstCount: 3,
      burstInterval: 0.12,
      shootIntervalMin: 1.8,
      shootIntervalMax: 2.8,
      bulletSpeed: 215,
      bulletDamage: 4,
      bulletLife: 1.0,
      separationDistance: 16,
      separationForce: 40,
      xp: 40
    },
    HELICOPTER: {
      id: 6,
      name: 'Helikopter Tempur',
      width: 16,
      height: 16,
      hp: 20, // Armored airborne threat
      speed: 82,
      isAir: true,
      orbitRadiusMin: 100,
      orbitRadiusMax: 140,
      telegraphDuration: 0.45, // Aiming laser warning
      burstCount: 3,
      burstInterval: 0.10,
      shootIntervalMin: 2.4,
      shootIntervalMax: 3.4,
      bulletSpeed: 235,
      bulletDamage: 5,
      bulletLife: 1.2,
      crashDuration: 0.8,
      crashExplosionRadius: 20,
      crashBuildingDamage: 2.5,
      crashEnemyDamage: 30,
      maxActive: 8,
      xp: 120
    },
    DRONE: {
      id: 7,
      name: 'Drone Kamikaze',
      width: 6,
      height: 6,
      hp: 2, // Fragile swarmers
      speedCruise: 155,
      speedDive: 245, // High speed dive bomb
      isAir: true,
      telegraphDistance: 110,
      telegraphDuration: 0.50, // Rapid blinking telegraph
      explosionRadius: 18,
      explosionKaijuDamage: 15,
      explosionBuildingDamage: 2.0,
      explosionEnemyDamage: 25,
      maxActive: 30,
      xp: 20
    },
    ARTILLERY: {
      id: 9,
      name: 'Artileri Bergerak',
      width: 12,
      height: 8,
      hp: 30,
      speed: 36, // Slow armored mobile artillery
      minRange: 200, // Distance keeping
      maxRange: 260,
      retreatDistance: 190, // Retreats backwards if Kaiju gets closer than this
      shootIntervalMin: 3.6, // Staggered interval ~4.0s
      shootIntervalMax: 4.4,
      telegraphDuration: 1.2, // Red circle shrinking for 1.2s at impact point
      shellSpeed: 240, // Visual parabolic trajectory
      explosionRadius: 26, // Medium area explosion
      shellDamageKaiju: 14, // Medium damage to Kaiju
      shellBuildingDamage: 2.8, // Demolishes city buildings in impact radius
      shellEnemyDamage: 25, // Collateral damage to nearby enemies
      maxActive: 6,
      xp: 110
    },
    TRUCK: {
      id: 10,
      name: 'Truk Militer',
      width: 14,
      height: 8,
      hp: 20,
      speed: 55,
      soldierPayload: 4, // Soldiers emerging when destroyed
      xp: 60
    }
  },

  // Elite Enemy Modifiers (Tahap 5B-2)
  elite: {
    scale: 1.4,
    hpMultiplier: 4.0,
    damageMultiplier: 1.5,
    xpMultiplier: 8.0,
    maxActive: 3,
    // Spawn chance per Siaga level
    spawnChances: {
      1: 0.0,
      2: 0.08,
      3: 0.14,
      4: 0.20,
      5: 0.28
    },
    // Skills configuration
    skills: {
      SHIELD: {
        id: 1,
        name: 'Perisai',
        label: 'PERISAI',
        shieldHpRatio: 0.60 // Absorbs frontal damage up to 60% of base max HP
      },
      HEALER: {
        id: 2,
        name: 'Pemulih',
        label: 'PEMULIH',
        interval: 3.5,
        radius: 90,
        healRatio: 0.22 // Heals 22% max HP to nearby units
      },
      SPAWNER: {
        id: 3,
        name: 'Pemanggil',
        label: 'PEMANGGIL',
        interval: 4.5,
        countMin: 3,
        countMax: 4
      },
      BOMBER: {
        id: 4,
        name: 'Peledak',
        label: 'PELEDAK',
        explosionRadius: 55,
        damageKaiju: 20,
        damageBuilding: 3.5,
        damageEnemy: 60
      }
    },
    cardDropChance: 0.25,
    cardDropCooldownSeconds: 180 // Max once per 3 minutes
  }
};

