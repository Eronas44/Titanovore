/**
 * Titanovore Game Configuration
 * All gameplay tuning, engine parameters, and entity stats.
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
    slots: ['body', 'back_slot', 'skin_overlay', 'head_slot', 'tail_slot']
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
    bgColor: 'rgba(11, 10, 16, 0.75)'
  }
};
