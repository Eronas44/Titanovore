/**
 * Evolution Configuration - Tahap 4B-2
 * Data definitions for all 6 weapon synergy evolutions:
 * ID, Name, Icon, Ingredients, Minimum Level Requirements, Slot,
 * Complete combat & destruction stats, and targeting flags.
 */
export const EVOLUTION_CONFIG = {
  defaultPrimaryMinLevel: 5,
  defaultSecondaryMinLevel: 3,

  // Animation & UI settings
  animationDurationMs: 1200,
  cameraShakeIntensity: 0.008,
  cameraShakeDurationMs: 350,

  evolutions: [
    // 1. BADAI PLASMA (Napas Api + Kulit Listrik)
    {
      id: 'plasma_storm',
      name: 'Badai Plasma',
      icon: 'plasma_storm',
      role: 'aura',
      primaryIngredient: {
        id: 'fire_breath',
        type: 'weapon',
        name: 'Napas Api',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'electric_skin',
        type: 'weapon',
        name: 'Kulit Listrik',
        minLevel: 3
      },
      slot: 'head_slot',
      description: 'Aura plasma raksasa terus menyambar & membakar musuh darat/udara dan gedung, ditambah sambaran petir plasma acak ke musuh terjauh.',
      stats: {
        auraDamage: 55, // DPS
        lightningDamage: 125,
        cooldown: 0.12, // aura tick
        lightningInterval: 0.9,
        radius: 125,
        lightningRange: 240,
        canHitAir: true,
        canHitGround: true,
        buildingDamageMultiplier: 3.2
      }
    },

    // 2. EKOR PETIR (Ekor Berduri + Kulit Listrik)
    {
      id: 'lightning_tail',
      name: 'Ekor Petir',
      icon: 'lightning_tail',
      role: 'rear',
      primaryIngredient: {
        id: 'spiked_tail',
        type: 'weapon',
        name: 'Ekor Berduri',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'electric_skin',
        type: 'weapon',
        name: 'Kulit Listrik',
        minLevel: 3
      },
      slot: 'tail_slot',
      description: 'Sapuan duri ekor 360° yang memicu petir berantai hingga 6 lompatan ke musuh sekitar (darat & udara).',
      stats: {
        damage: 65,
        chainDamage: 48,
        chainJumps: 6,
        jumpRadius: 95,
        cooldown: 1.15,
        range: 110,
        arcAngle: 360,
        canHitAir: true,
        canHitGround: true,
        buildingDamageMultiplier: 3.8
      }
    },

    // 3. ARTILERI BERAT (Meriam Punggung + Roket Punggung)
    {
      id: 'heavy_artillery',
      name: 'Artileri Berat',
      icon: 'heavy_artillery',
      role: 'artillery',
      primaryIngredient: {
        id: 'back_cannon',
        type: 'weapon',
        name: 'Meriam Punggung',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'back_rockets',
        type: 'weapon',
        name: 'Roket Punggung',
        minLevel: 3
      },
      slot: 'back_slot',
      description: 'Tembakan mortir raksasa berdaya ledak tinggi ke kerumunan terpadat, meratakan banyak gedung dan musuh darat/udara.',
      stats: {
        damage: 195,
        blastRadius: 80,
        range: 330,
        cooldown: 2.7,
        shellSpeed: 270,
        canHitAir: true,
        canHitGround: true,
        buildingDamageMultiplier: 5.8
      }
    },

    // 4. GEMPA BUMI (Injakan Getar + Cakar)
    {
      id: 'cataclysm_quake',
      name: 'Gempa Bumi',
      icon: 'cataclysm_quake',
      role: 'stomp',
      primaryIngredient: {
        id: 'quake_stomp',
        type: 'weapon',
        name: 'Injakan Getar',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'claw',
        type: 'weapon',
        name: 'Cakar',
        minLevel: 3
      },
      slot: 'body',
      description: 'Hantaman cakar memicu retakan tektonik lurus menyapu gedung & musuh di jalurnya, ditambah gelombang kejut gempa melingkar.',
      stats: {
        damage: 95,
        fissureLength: 170,
        fissureWidth: 36,
        shockwaveRadius: 105,
        cooldown: 1.75,
        slowFactor: 0.35,
        slowDuration: 2.2,
        canHitAir: false,
        canHitGround: true,
        buildingDamageMultiplier: 6.2
      }
    },

    // 5. LASER PENGHANCUR (Mata Laser + Meriam Punggung)
    {
      id: 'annihilation_laser',
      name: 'Laser Penghancur',
      icon: 'annihilation_laser',
      role: 'beam',
      primaryIngredient: {
        id: 'laser_eyes',
        type: 'weapon',
        name: 'Mata Laser',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'back_cannon',
        type: 'weapon',
        name: 'Meriam Punggung',
        minLevel: 3
      },
      slot: 'head_slot',
      description: 'Sinar laser lebar yang menyapu seperti kipas ke arah gerak/target selama 1.5 detik, menembus musuh darat/udara & gedung.',
      stats: {
        damagePerSec: 175,
        sweepDuration: 1.5,
        sweepArc: 75,
        range: 230,
        beamWidth: 9,
        cooldown: 3.1,
        canHitAir: true,
        canHitGround: true,
        buildingDamageMultiplier: 5.0
      }
    },

    // 6. BENTENG BERDURI (Duri Tubuh + Perisai Energi)
    {
      id: 'thorn_bastion',
      name: 'Benteng Berduri',
      icon: 'thorn_bastion',
      role: 'defense',
      primaryIngredient: {
        id: 'body_spikes',
        type: 'weapon',
        name: 'Duri Tubuh',
        minLevel: 5
      },
      secondaryIngredient: {
        id: 'energyShield',
        type: 'passive',
        name: 'Perisai Energi',
        minLevel: 3
      },
      slot: 'skin_overlay',
      description: 'Perisai kinetik memantulkan peluru musuh dan meledakkan erupsi 360° duri tajam saat pecah atau menerima hit besar, lalu mengisi ulang.',
      stats: {
        shieldCapacity: 300,
        rechargeDelay: 3.5,
        reflectChance: 0.70,
        reflectMultiplier: 2.2,
        eruptionDamage: 90,
        eruptionSpikes: 24,
        eruptionRadius: 95,
        passiveRetaliationDmg: 45,
        cooldown: 0.5,
        canHitAir: true,
        canHitGround: true,
        buildingDamageMultiplier: 3.2
      }
    }
  ]
};
