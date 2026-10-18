/**
 * Weapons Configuration - Tahap 4A
 * Complete data definitions for all Kaiju automatic weapons:
 * ID, Name, Icon, Base stats, Per-level scaling (1-5), and Level 5 special abilities.
 */
export const WEAPON_CONFIG = {
  maxWeaponSlots: 6,
  maxProjectiles: 200,

  weapons: {
    claw: {
      id: 'claw',
      name: 'Cakar',
      icon: 'icon_claw',
      canHitAir: false,
      canHitGround: true,
      buildingDamageMultiplier: 2.8,

      // Base stats (Level 1)
      cooldown: 1.05, // Seconds between slashes
      damage: 14,
      range: 52, // Arc reach in px
      arcAngle: 95, // Degrees of frontal cone sweep
      swipeDuration: 0.18, // Visual slash animation duration in seconds

      // Per-level scaling definitions (Levels 1 to 5)
      levels: [
        {
          level: 1,
          description: 'Sapuan cakar tajam ke depan merusak musuh darat dan bangunan.',
          damage: 14,
          cooldown: 1.05,
          range: 52,
          arcAngle: 95,
          buildingDamageMultiplier: 2.8,
          isDoubleSwipe: false
        },
        {
          level: 2,
          description: '+25% Damage, jangkauan cakar lebih jauh.',
          damage: 18,
          cooldown: 0.95,
          range: 60,
          arcAngle: 105,
          buildingDamageMultiplier: 3.2,
          isDoubleSwipe: false
        },
        {
          level: 3,
          description: '+30% Damage, busur sapuan lebih lebar.',
          damage: 24,
          cooldown: 0.85,
          range: 68,
          arcAngle: 120,
          buildingDamageMultiplier: 3.6,
          isDoubleSwipe: false
        },
        {
          level: 4,
          description: '+35% Damage, cooldown lebih cepat.',
          damage: 32,
          cooldown: 0.72,
          range: 76,
          arcAngle: 135,
          buildingDamageMultiplier: 4.0,
          isDoubleSwipe: false
        },
        {
          level: 5,
          description: 'EFEK SPESIAL: Cakar Ganda! Menyapu dua kali berturut-turut dengan daya hancur brutal.',
          damage: 42,
          cooldown: 0.60,
          range: 86,
          arcAngle: 150,
          buildingDamageMultiplier: 4.8,
          isDoubleSwipe: true,
          doubleSwipeDelay: 0.12 // Second swipe delay in seconds
        }
      ]
    },

    back_cannon: {
      id: 'back_cannon',
      name: 'Meriam Punggung',
      icon: 'icon_cannon',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 0.75, // Light building damage

      // Base stats (Level 1)
      cooldown: 0.80,
      damage: 9,
      range: 165,
      projectileSpeed: 290,
      projectileCount: 1,
      projectileLife: 0.65,

      // Per-level scaling definitions
      levels: [
        {
          level: 1,
          description: 'Menembak musuh terdekat (darat & udara) dengan peluru cepat akurat.',
          damage: 9,
          cooldown: 0.80,
          range: 165,
          projectileSpeed: 290,
          projectileCount: 1,
          dualDirection: false
        },
        {
          level: 2,
          description: '+30% Damage, jarak tembak bertambah.',
          damage: 13,
          cooldown: 0.72,
          range: 185,
          projectileSpeed: 310,
          projectileCount: 1,
          dualDirection: false
        },
        {
          level: 3,
          description: 'Menembak 2 peluru sekaligus dalam satu tembakan.',
          damage: 16,
          cooldown: 0.65,
          range: 200,
          projectileSpeed: 330,
          projectileCount: 2,
          dualDirection: false
        },
        {
          level: 4,
          description: '+30% Damage, kecepatan tembakan meningkat.',
          damage: 22,
          cooldown: 0.54,
          range: 215,
          projectileSpeed: 350,
          projectileCount: 2,
          dualDirection: false
        },
        {
          level: 5,
          description: 'EFEK SPESIAL: Salvo Dua Arah! Menembak 4 peluru ke depan dan belakang secara bersamaan.',
          damage: 28,
          cooldown: 0.44,
          range: 235,
          projectileSpeed: 380,
          projectileCount: 4,
          dualDirection: true
        }
      ]
    },

    electric_skin: {
      id: 'electric_skin',
      name: 'Kulit Listrik',
      icon: 'icon_electric',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 0.0, // Does not harm structures

      // Base stats (Level 1)
      cooldown: 0.52,
      damage: 6,
      range: 60, // Aura radius around Kaiju body

      // Per-level scaling definitions
      levels: [
        {
          level: 1,
          description: 'Aura petir menyetrum semua musuh di sekitar kaiju (darat & udara).',
          damage: 6,
          cooldown: 0.52,
          range: 60,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 2,
          description: '+35% Damage, radius sengatan meluas.',
          damage: 9,
          cooldown: 0.46,
          range: 72,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 3,
          description: '+40% Damage, sengatan lebih rapat.',
          damage: 13,
          cooldown: 0.40,
          range: 84,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 4,
          description: '+45% Damage, radius sengatan masif.',
          damage: 18,
          cooldown: 0.34,
          range: 98,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 5,
          description: 'EFEK SPESIAL: Petir Berantai! Menyambar ke 2 musuh tambahan di dekat target.',
          damage: 24,
          cooldown: 0.28,
          range: 115,
          chainTargets: 2,
          chainRange: 55
        }
      ]
    }
  }
};
