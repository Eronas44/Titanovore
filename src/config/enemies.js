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
    }
  }
};
