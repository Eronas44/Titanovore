/**
 * Titanovore Game Configuration
 * All gameplay tuning, engine parameters, entity stats, and destruction mechanics.
 */
export const GAME_CONFIG = {
  // Screen / Resolution
  width: 480,
  height: 270,
  pixelArt: true,
  roundPixels: true,
  backgroundColor: '#0b0a10',

  // Kaiju Parameters
  kaiju: {
    baseSize: 56, // 56x56 px
    initialScale: 1.0,
    maxSpeed: 105, // Movement speed px/sec
    acceleration: 300, // Acceleration px/sec^2 (heavy inertia)
    drag: 260, // Deceleration when no keys pressed
    turnSpeed: 0.14, // Angular lerp factor (smooth rotation towards move dir)
    stepDistance: 18, // Px moved per footstep cycle
    stepShakeIntensity: 0.0018, // Screen shake intensity per step
    stepShakeDuration: 65, // ms
    tail: {
      segmentCount: 5,
      segmentRadius: [12, 10, 8, 6, 4], // decreasing radii
      segmentDistance: 9, // spacing between segments
      followSpeed: 0.22, // inertia follow factor
      swayFrequency: 0.006, // idle sway freq
      swayAmplitude: 0.12 // sway angle radians
    },
    slots: ['body', 'back_slot', 'skin_overlay', 'head_slot', 'tail_slot'],

    // HP & Damage (Tahap 3A)
    maxHp: 300, // Default Kaiju HP
    invincibilityDuration: 0.1, // 100ms invulnerability window after taking damage
    flashDuration: 0.08 // 80ms white flash on hit
  },

  // Destruction Tuning (Tahap 2B)
  destruction: {
    // Body & Tail Trample Damage
    bodyDamageBase: 3.5, // Base damage applied to building cells underfoot per tick
    bodySpeedMultiplier: 0.03, // Extra damage from high movement speed
    tailDamageMultiplier: 0.55, // Tail sweeps deal 55% of body damage
    trampleTickInterval: 45, // ms between trample damage pulses

    // Dynamic Slowdown (Simulates crushing dense skyscrapers)
    maxSlowdownPercent: 0.25, // Up to 25% speed penalty when crushing dense structures
    slowdownRecoveryRate: 1.8, // Speed recovery factor per second back to 100%

    // Screen Shake & Hitstop
    trampleShakeIntensity: 0.0016, // Micro rumble while trampling
    trampleShakeDuration: 55,
    collapseShakeIntensityBase: 0.006, // Base shake on building collapse
    collapseShakeDuration: 220, // ms
    hitstopDurationMs: 65, // Brief freeze frame on large skyscraper collapse

    // Particle Object Pools (Performance caps)
    maxDebrisParticles: 600, // Debris shards pool cap
    maxDustParticles: 150, // Billowing dust clouds pool cap
    maxBloodSparks: 50, // Human squish / car spark pool cap

    // Human Panic / Fleeing
    humanFleeDistance: 110, // Distance (px) where pedestrians panic and flee
    humanFleeSpeedMultiplier: 2.2, // Pedestrian sprint speed while fleeing

    // Scoring / XP Counters
    xpPerCell: 5,
    xpPerBuildingCollapse: 120,
    xpPerHuman: 10,
    xpPerCar: 25
  },

  // Camera Settings
  camera: {
    initialZoom: 1.6, // Zoom factor (makes kaiju look big, city dense)
    followLerpX: 0.08, // Smooth follow X
    followLerpY: 0.08, // Smooth follow Y
    zoomTransitionSpeed: 0.05
  },

  // Performance / HUD
  hud: {
    showByDefault: true,
    toggleKey: 'F3',
    textColor: '#38ef7d',
    bgColor: 'rgba(11, 10, 16, 0.85)'
  }
};
