/**
 * Weapons Configuration - Tahap 4B-1
 * Complete data definitions for all 9 Kaiju automatic weapons:
 * ID, Name, Icon, Base stats, Per-level scaling (1-5), Level 5 special abilities,
 * visual slot mapping ('body', 'back_slot', 'skin_overlay', 'head_slot', 'tail_slot'),
 * and targeting capabilities (canHitAir, canHitGround, buildingDamageMultiplier).
 */
export const WEAPON_CONFIG = {
  maxWeaponSlots: 6,
  maxProjectiles: 250,

  weapons: {
    // 1. Cakar (Claw) - Melee frontal arc
    claw: {
      id: 'claw',
      name: 'Cakar',
      slot: 'body',
      icon: 'icon_claw',
      canHitAir: false,
      canHitGround: true,
      buildingDamageMultiplier: 2.8,

      cooldown: 1.05,
      damage: 14,
      range: 52,
      arcAngle: 95,
      swipeDuration: 0.18,

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
          description: 'SPESIAL: Cakar Ganda! Menyapu dua kali berturut-turut dengan daya hancur brutal.',
          damage: 42,
          cooldown: 0.60,
          range: 86,
          arcAngle: 150,
          buildingDamageMultiplier: 4.8,
          isDoubleSwipe: true,
          doubleSwipeDelay: 0.12
        }
      ]
    },

    // 2. Meriam Punggung (Back Cannon) - Direct anti-air & ground artillery
    back_cannon: {
      id: 'back_cannon',
      name: 'Meriam Punggung',
      slot: 'back_slot',
      icon: 'icon_cannon',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 0.75,

      cooldown: 0.80,
      damage: 9,
      range: 165,
      projectileSpeed: 300,
      projectileCount: 1,
      projectileLife: 0.65,

      levels: [
        {
          level: 1,
          description: 'Menembak musuh terdekat (darat & udara) dengan peluru cepat akurat.',
          damage: 9,
          cooldown: 0.80,
          range: 165,
          projectileSpeed: 300,
          projectileCount: 1,
          dualDirection: false
        },
        {
          level: 2,
          description: '+30% Damage, jarak tembak bertambah.',
          damage: 13,
          cooldown: 0.72,
          range: 185,
          projectileSpeed: 320,
          projectileCount: 1,
          dualDirection: false
        },
        {
          level: 3,
          description: 'Menembak 2 peluru sekaligus dalam satu tembakan.',
          damage: 16,
          cooldown: 0.65,
          range: 200,
          projectileSpeed: 340,
          projectileCount: 2,
          dualDirection: false
        },
        {
          level: 4,
          description: '+30% Damage, kecepatan tembakan meningkat.',
          damage: 22,
          cooldown: 0.54,
          range: 215,
          projectileSpeed: 360,
          projectileCount: 2,
          dualDirection: false
        },
        {
          level: 5,
          description: 'SPESIAL: Salvo Dua Arah! Menembak 4 peluru ke depan dan belakang secara bersamaan.',
          damage: 28,
          cooldown: 0.44,
          range: 235,
          projectileSpeed: 390,
          projectileCount: 4,
          dualDirection: true
        }
      ]
    },

    // 3. Kulit Listrik (Electric Skin) - Close-quarters electrical aura & chain lightning
    electric_skin: {
      id: 'electric_skin',
      name: 'Kulit Listrik',
      slot: 'skin_overlay',
      icon: 'icon_electric',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 0.0,

      cooldown: 0.52,
      damage: 6,
      range: 60,

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
          cooldown: 0.48,
          range: 70,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 3,
          description: '+40% Damage, interval sengatan lebih rapat.',
          damage: 13,
          cooldown: 0.42,
          range: 78,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 4,
          description: '+45% Damage, radius sengatan masif.',
          damage: 18,
          cooldown: 0.36,
          range: 88,
          chainTargets: 0,
          chainRange: 0
        },
        {
          level: 5,
          description: 'SPESIAL: Petir Berantai! Menyambar melompat ke 2 musuh di dekatnya.',
          damage: 24,
          cooldown: 0.30,
          range: 100,
          chainTargets: 2,
          chainRange: 55
        }
      ]
    },

    // 4. Ekor Berduri (Spiked Tail) - Rear crowd clearing & building smash
    spiked_tail: {
      id: 'spiked_tail',
      name: 'Ekor Berduri',
      slot: 'tail_slot',
      icon: 'icon_spiked_tail',
      canHitAir: false,
      canHitGround: true,
      buildingDamageMultiplier: 3.2,

      cooldown: 1.20,
      damage: 18,
      range: 62,
      arcAngle: 160,

      levels: [
        {
          level: 1,
          description: 'Sapuan duri di belakang kaiju menghantam kerumunan musuh dan gedung.',
          damage: 18,
          cooldown: 1.20,
          range: 62,
          arcAngle: 160,
          isFullSpin: false
        },
        {
          level: 2,
          description: '+30% Damage, radius sapuan ekor lebih panjang.',
          damage: 24,
          cooldown: 1.10,
          range: 72,
          arcAngle: 170,
          isFullSpin: false
        },
        {
          level: 3,
          description: '+35% Damage, cooldown lebih cepat.',
          damage: 32,
          cooldown: 0.98,
          range: 80,
          arcAngle: 180,
          isFullSpin: false
        },
        {
          level: 4,
          description: '+40% Damage, daya hancur gedung meningkat drastis.',
          damage: 44,
          cooldown: 0.88,
          range: 90,
          arcAngle: 190,
          isFullSpin: false
        },
        {
          level: 5,
          description: 'SPESIAL: Putaran 360 Derajat! Ekor memutar penuh menyapu segala arah.',
          damage: 60,
          cooldown: 0.75,
          range: 100,
          arcAngle: 360,
          isFullSpin: true
        }
      ]
    },

    // 5. Duri Tubuh (Body Spikes) - Spikes along spine, contact revenge & volley
    body_spikes: {
      id: 'body_spikes',
      name: 'Duri Tubuh',
      slot: 'skin_overlay',
      icon: 'icon_body_spikes',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 1.2,

      cooldown: 0.40,
      damage: 12,
      range: 48,

      levels: [
        {
          level: 1,
          description: 'Duri punggung menusuk musuh yang mendekat dan membalas tembakan.',
          damage: 12,
          cooldown: 0.40,
          range: 48,
          burstOnDamage: false
        },
        {
          level: 2,
          description: '+35% Damage balas, jangkauan duri lebih panjang.',
          damage: 17,
          cooldown: 0.36,
          range: 56,
          burstOnDamage: false
        },
        {
          level: 3,
          description: '+40% Damage balas, musuh penembak terkena duri balik.',
          damage: 25,
          cooldown: 0.32,
          range: 64,
          burstOnDamage: false
        },
        {
          level: 4,
          description: '+40% Damage balas, radius perlindungan duri bertambah.',
          damage: 35,
          cooldown: 0.28,
          range: 72,
          burstOnDamage: false
        },
        {
          level: 5,
          description: 'SPESIAL: Erupsi Duri! Memuntahkan duri tajam ke 360 derajat saat terkena hit besar.',
          damage: 50,
          cooldown: 0.22,
          range: 82,
          burstOnDamage: true,
          burstSpikeCount: 16
        }
      ]
    },

    // 6. Napas Api (Fire Breath) - Frontal incendiary cone DoT, ignites buildings & air
    fire_breath: {
      id: 'fire_breath',
      name: 'Napas Api',
      slot: 'head_slot',
      icon: 'icon_fire_breath',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 3.6,

      cooldown: 4.0,
      activeDuration: 1.5,
      damage: 8, // Damage per tick (ticks 5 times/sec)
      range: 110,
      arcAngle: 45,

      levels: [
        {
          level: 1,
          description: 'Semburan api membakar gedung dan musuh darat/udara selama 1.5 detik.',
          damage: 8,
          cooldown: 4.0,
          activeDuration: 1.5,
          range: 110,
          arcAngle: 45,
          lingeringFire: false
        },
        {
          level: 2,
          description: '+30% Damage bakar, jangkauan semburan api lebih jauh.',
          damage: 11,
          cooldown: 3.7,
          activeDuration: 1.5,
          range: 130,
          arcAngle: 50,
          lingeringFire: false
        },
        {
          level: 3,
          description: '+35% Damage bakar, durasi semburan menjadi 1.8 detik.',
          damage: 15,
          cooldown: 3.4,
          activeDuration: 1.8,
          range: 145,
          arcAngle: 55,
          lingeringFire: false
        },
        {
          level: 4,
          description: '+40% Damage bakar, semburan api meluas dan membakar lebih cepat.',
          damage: 21,
          cooldown: 3.0,
          activeDuration: 2.0,
          range: 165,
          arcAngle: 60,
          lingeringFire: false
        },
        {
          level: 5,
          description: 'SPESIAL: Api Neraka! Api membakar tanah dan terus membara meninggalkan jejak lahar.',
          damage: 30,
          cooldown: 2.6,
          activeDuration: 2.2,
          range: 190,
          arcAngle: 68,
          lingeringFire: true
        }
      ]
    },

    // 7. Roket Punggung (Back Rockets) - Homing missiles with smoke & area explosion
    back_rockets: {
      id: 'back_rockets',
      name: 'Roket Punggung',
      slot: 'back_slot',
      icon: 'icon_back_rockets',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 3.2,

      cooldown: 2.50,
      damage: 32,
      range: 220,
      blastRadius: 28,
      rocketCount: 2,

      levels: [
        {
          level: 1,
          description: 'Menembakkan 2 roket berpencari yang meledak area di titik tabrak.',
          damage: 32,
          cooldown: 2.50,
          range: 220,
          blastRadius: 28,
          rocketCount: 2
        },
        {
          level: 2,
          description: '+30% Damage, radius ledakan roket meluas.',
          damage: 42,
          cooldown: 2.30,
          range: 240,
          blastRadius: 34,
          rocketCount: 2
        },
        {
          level: 3,
          description: 'Menembakkan 3 roket berpencari sekaligus.',
          damage: 55,
          cooldown: 2.10,
          range: 260,
          blastRadius: 38,
          rocketCount: 3
        },
        {
          level: 4,
          description: '+35% Damage, kecepatan luncur roket meningkat.',
          damage: 70,
          cooldown: 1.90,
          range: 280,
          blastRadius: 44,
          rocketCount: 4
        },
        {
          level: 5,
          description: 'SPESIAL: Salvo Badai Roket! Menembakkan 6 roket berpencari dalam satu salvo masif.',
          damage: 90,
          cooldown: 1.65,
          range: 300,
          blastRadius: 50,
          rocketCount: 6
        }
      ]
    },

    // 8. Injakan Getar (Quake Stomp) - Expanding seismic shockwave & crowd slow
    quake_stomp: {
      id: 'quake_stomp',
      name: 'Injakan Getar',
      slot: 'body',
      icon: 'icon_quake_stomp',
      canHitAir: false,
      canHitGround: true,
      buildingDamageMultiplier: 2.5,

      cooldown: 3.00,
      damage: 16,
      radius: 65,
      slowDuration: 1.5,
      slowFactor: 0.5,

      levels: [
        {
          level: 1,
          description: 'Gelombang kejut tiap 3 detik melukai, memperlambat musuh, dan meretakkan gedung.',
          damage: 16,
          cooldown: 3.00,
          radius: 65,
          slowDuration: 1.5,
          isDoubleQuake: false
        },
        {
          level: 2,
          description: '+30% Damage, radius gempa bertambah besar.',
          damage: 22,
          cooldown: 2.75,
          radius: 78,
          slowDuration: 1.8,
          isDoubleQuake: false
        },
        {
          level: 3,
          description: '+35% Damage, efek perlambatan gerak musuh lebih kuat.',
          damage: 30,
          cooldown: 2.50,
          radius: 92,
          slowDuration: 2.0,
          isDoubleQuake: false
        },
        {
          level: 4,
          description: '+40% Damage, daya rusak ke struktur kota berlipat.',
          damage: 42,
          cooldown: 2.20,
          radius: 108,
          slowDuration: 2.2,
          isDoubleQuake: false
        },
        {
          level: 5,
          description: 'SPESIAL: Gempa Susulan! Menghasilkan dua gelombang kejut beruntun dengan radius destruktif.',
          damage: 58,
          cooldown: 1.85,
          radius: 125,
          slowDuration: 2.6,
          isDoubleQuake: true,
          quakeDelay: 0.35
        }
      ]
    },

    // 9. Mata Laser (Laser Eyes) - Continuous piercing high-DPS beam
    laser_eyes: {
      id: 'laser_eyes',
      name: 'Mata Laser',
      slot: 'head_slot',
      icon: 'icon_laser_eyes',
      canHitAir: true,
      canHitGround: true,
      buildingDamageMultiplier: 2.8,

      cooldown: 3.20,
      beamDuration: 1.0,
      damage: 9, // Damage per tick (ticks 6 times/sec)
      range: 175,
      beamWidth: 5,

      levels: [
        {
          level: 1,
          description: 'Sinar laser crimson menembus lurus memotong musuh darat/udara dan gedung.',
          damage: 9,
          cooldown: 3.20,
          beamDuration: 1.0,
          range: 175,
          isDualBeam: false
        },
        {
          level: 2,
          description: '+30% Damage laser, jangkauan sinar memanjang.',
          damage: 13,
          cooldown: 2.90,
          beamDuration: 1.1,
          range: 200,
          isDualBeam: false
        },
        {
          level: 3,
          description: '+35% Damage laser, sinar lebih lebar dan membakar lebih kuat.',
          damage: 18,
          cooldown: 2.60,
          beamDuration: 1.2,
          range: 220,
          isDualBeam: false
        },
        {
          level: 4,
          description: '+40% Damage laser, durasi tembak menjadi 1.4 detik.',
          damage: 25,
          cooldown: 2.30,
          beamDuration: 1.4,
          range: 245,
          isDualBeam: false
        },
        {
          level: 5,
          description: 'SPESIAL: Sinar Ganda! Kedua mata menembakkan sinar laser paralel mematikan.',
          damage: 36,
          cooldown: 1.95,
          beamDuration: 1.6,
          range: 275,
          isDualBeam: true
        }
      ]
    }
  }
};
