/**
 * Effects Configuration - Tahap 6B
 * Konfigurasi terpusat untuk efek visual bercahaya, additive glow pools,
 * kualitas efek (rendah/sedang/tinggi), dan animasi reaksi tubuh Kaiju.
 */

export const EFFECT_QUALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
};

export const EFFECTS_CONFIG = {
  // Kualitas aktif default di desktop
  currentQuality: EFFECT_QUALITY.HIGH,

  // Pengaturan per tingkat kualitas (skalabilitas performa untuk mobile/low-end)
  qualityPresets: {
    low: {
      name: 'RENDAH',
      particleMultiplier: 0.3,
      maxLightPools: 15,
      maxSmokePuffs: 20,
      enableSecondaryEmbers: false,
      flameSubdivision: 4,
      lightningSegments: 2,
      glowAlphaMultiplier: 0.6
    },
    medium: {
      name: 'SEDANG',
      particleMultiplier: 0.65,
      maxLightPools: 30,
      maxSmokePuffs: 45,
      enableSecondaryEmbers: true,
      flameSubdivision: 7,
      lightningSegments: 3,
      glowAlphaMultiplier: 0.85
    },
    high: {
      name: 'TINGGI',
      particleMultiplier: 1.0,
      maxLightPools: 60,
      maxSmokePuffs: 90,
      enableSecondaryEmbers: true,
      flameSubdivision: 10,
      lightningSegments: 4,
      glowAlphaMultiplier: 1.0
    }
  },

  // Pengaturan Kolam Cahaya Tanah (Additive Ground Light Pools)
  lightPools: {
    depth: 11.5, // Di atas tanah (10) dan di bawah kaki (13) serta torso (15)
    defaultDuration: 0.45, // detik
    explosionDuration: 0.65,
    laserScorchDuration: 0.35,
    lightningDuration: 0.25,
    maxAlpha: 0.55 // Dibatasi agar tidak menyilaukan dan musuh tetap terbaca jelas
  },

  // Pengaturan Napas Api Berlapis
  fireBreath: {
    coreColor: 0xffffff,       // Inti putih panas
    innerColor: 0xfef08a,      // Kuning cerah
    midColor: 0xf97316,        // Oranye membara
    outerColor: 0xdc2626,      // Merah gelap
    smokeColor: 0x334155,      // Asap abu-abu
    groundGlowRadius: 40,
    groundGlowAlpha: 0.35
  },

  // Pengaturan Mata Laser
  laserEyes: {
    chargeTime: 0.25,          // Waktu pengisian cahaya sebelum tembak
    coreColor: 0xffffff,       // Inti putih death-ray
    beamColor: 0xef4444,       // Balok merah tajam
    glowColor: 0x9333ea,       // Pendar violet sekunder
    flareRadius: 10,
    impactSparks: 5
  },

  // Pengaturan Meriam Punggung & Turret
  backCannon: {
    recoilDistance: 4,         // Mundur 4px saat menembak
    recoilRecoverSpeed: 24,    // Kecepatan kembali ke posisi awal
    muzzleFlashDuration: 0.07, // 70ms kilatan moncong
    muzzleColor: 0x38bdf8      // Biru cyan plasma
  },

  // Pengaturan Roket Punggung
  backRockets: {
    tubeFlashDuration: 0.12,   // Kilat lubang roket saat diluncurkan
    smokeTrailInterval: 0.04,  // Interval jejak asap roket
    explosionRingSpeed: 140
  },

  // Pengaturan Reaksi Tubuh & Kerusakan Visual Kaiju
  kaijuReaction: {
    hitFlashColor: 0xff3333,   // Kilatan merah saat terkena damage
    hitFlashDuration: 0.08,    // 80ms
    lowHpThreshold: 0.30,      // Di bawah 30% HP memicu retakan tubuh menyala
    lowHpFissureColor: 0xef4444, // Celah merah menyala di tubuh
    lowHpSmokeInterval: 0.25,  // Asap keluar dari tubuh yang rusak
    layerEquipAnimationTime: 0.45 // Durasi animasi tumbuh/kilat saat kartu dipasang
  }
};
