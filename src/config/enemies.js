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

  // Projectile Tuning
  bulletBuildingDamage: 0.35, // Bullets that miss Kaiju damage city buildings

  // Enemy Types Definitions
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
      spawnWeight: 0.60
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
      spawnWeight: 0.35
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
      spawnWeight: 0.05
    }
  }
};
