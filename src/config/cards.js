/**
 * Card System Configuration - Tahap 4B-1
 * 25 Distinct Cards (9 Weapons + 16 Passives) with Rarity, Roles, Levels (1-5),
 * Mutation tags, and impactful gameplay upgrades.
 */
export const CARD_CONFIG = {
  rerollsPerRun: 2,
  skipRewardHp: 25,
  skipRewardXp: 15,
  ownedWeaponWeightMultiplier: 1.45,

  rarities: {
    COMMON: {
      id: 'common',
      name: 'Umum',
      color: '#94a3b8',
      hex: 0x94a3b8,
      weight: 55
    },
    RARE: {
      id: 'rare',
      name: 'Langka',
      color: '#38bdf8',
      hex: 0x38bdf8,
      weight: 28
    },
    EPIC: {
      id: 'epic',
      name: 'Epik',
      color: '#c084fc',
      hex: 0xc084fc,
      weight: 13
    },
    LEGENDARY: {
      id: 'legendary',
      name: 'Legendaris',
      color: '#fb923c',
      hex: 0xfb923c,
      weight: 4
    }
  },

  cards: [
    // =========================================================================
    // 1. WEAPON CARDS (9 WEAPONS - ALL TRIGGER VISUAL MUTATIONS)
    // =========================================================================
    {
      id: 'cakar',
      type: 'weapon',
      weaponId: 'claw',
      name: 'Cakar',
      icon: 'icon_claw',
      rarity: 'COMMON',
      role: 'melee',
      isMutation: true,
      slot: 'body',
      maxLevel: 5,
      descriptions: [
        'Cakar tajam menyapu busur depan merusak musuh dan gedung.',
        '+25% Damage dan jangkauan cakar lebih jauh.',
        '+30% Damage dan busur sapuan lebih lebar.',
        '+35% Damage dan cooldown berkurang drastis.',
        'MUTASI LEVEL 5: Cakar Ganda brutal! Sapuan ganda berturut-turut.'
      ]
    },
    {
      id: 'meriam_punggung',
      type: 'weapon',
      weaponId: 'back_cannon',
      name: 'Meriam Punggung',
      icon: 'icon_cannon',
      rarity: 'RARE',
      role: 'artillery',
      isMutation: true,
      slot: 'back_slot',
      maxLevel: 5,
      descriptions: [
        'Menembak musuh darat dan udara secara otomatis.',
        '+30% Damage dan jarak tembak meningkat.',
        'Menembak 2 peluru sekaligus dalam satu tembakan.',
        '+30% Damage dan kecepatan tembak lebih cepat.',
        'MUTASI LEVEL 5: Salvo Dua Arah! Menembak ke depan dan belakang.'
      ]
    },
    {
      id: 'kulit_listrik',
      type: 'weapon',
      weaponId: 'electric_skin',
      name: 'Kulit Listrik',
      icon: 'icon_electric',
      rarity: 'RARE',
      role: 'aura',
      isMutation: true,
      slot: 'skin_overlay',
      maxLevel: 5,
      descriptions: [
        'Aura petir menyetrum musuh di sekitar (darat & udara).',
        '+35% Damage dan radius sengatan bertambah.',
        '+40% Damage dan interval sengatan lebih cepat.',
        '+45% Damage dan radius sengatan masif.',
        'MUTASI LEVEL 5: Petir Berantai! Menyambar ke 2 musuh di dekatnya.'
      ]
    },
    {
      id: 'ekor_berduri',
      type: 'weapon',
      weaponId: 'spiked_tail',
      name: 'Ekor Berduri',
      icon: 'icon_spiked_tail',
      rarity: 'COMMON',
      role: 'rear',
      isMutation: true,
      slot: 'tail_slot',
      maxLevel: 5,
      descriptions: [
        'Sapuan duri di ekor menghancurkan kerumunan dan gedung di belakang.',
        '+30% Damage dan jangkauan sapuan ekor lebih jauh.',
        '+35% Damage dan interval serangan lebih cepat.',
        '+40% Damage dan daya hancur gedung meningkat pesat.',
        'MUTASI LEVEL 5: Putaran 360 Derajat! Ekor memutar penuh menyapu segala arah.'
      ]
    },
    {
      id: 'duri_tubuh',
      type: 'weapon',
      weaponId: 'body_spikes',
      name: 'Duri Tubuh',
      icon: 'icon_body_spikes',
      rarity: 'RARE',
      role: 'defense',
      isMutation: true,
      slot: 'skin_overlay',
      maxLevel: 5,
      descriptions: [
        'Duri tajam mencuat di punggung menusuk musuh dan membalas tembakan.',
        '+35% Damage balas dan jangkauan duri lebih panjang.',
        '+40% Damage balas dan musuh penembak terkena duri balik.',
        '+40% Damage balas dan radius perlindungan duri bertambah.',
        'MUTASI LEVEL 5: Erupsi Duri! Memuntahkan duri tajam ke 360° saat terkena hit besar.'
      ]
    },
    {
      id: 'napas_api',
      type: 'weapon',
      weaponId: 'fire_breath',
      name: 'Napas Api',
      icon: 'icon_fire_breath',
      rarity: 'EPIC',
      role: 'cone',
      isMutation: true,
      slot: 'head_slot',
      maxLevel: 5,
      descriptions: [
        'Semburan api membakar gedung dan musuh darat/udara selama 1.5 detik.',
        '+30% Damage bakar dan jarak jangkau api memanjang.',
        '+35% Damage bakar dan durasi semburan menjadi 1.8 detik.',
        '+40% Damage bakar dan sudut semburan api meluas.',
        'MUTASI LEVEL 5: Api Neraka! Api membakar tanah dan terus membara meninggalkan lahar.'
      ]
    },
    {
      id: 'roket_punggung',
      type: 'weapon',
      weaponId: 'back_rockets',
      name: 'Roket Punggung',
      icon: 'icon_back_rockets',
      rarity: 'EPIC',
      role: 'artillery',
      isMutation: true,
      slot: 'back_slot',
      maxLevel: 5,
      descriptions: [
        'Menembakkan 2 roket berpencari yang meledak area di titik tabrak.',
        '+30% Damage dan radius ledakan roket meluas.',
        'Menembakkan 3 roket berpencari sekaligus.',
        '+35% Damage dan kecepatan luncur roket meningkat.',
        'MUTASI LEVEL 5: Badai Salvo Roket! Menembakkan 6 roket berpencari dalam satu salvo.'
      ]
    },
    {
      id: 'injakan_getar',
      type: 'weapon',
      weaponId: 'quake_stomp',
      name: 'Injakan Getar',
      icon: 'icon_quake_stomp',
      rarity: 'COMMON',
      role: 'stomp',
      isMutation: true,
      slot: 'body',
      maxLevel: 5,
      descriptions: [
        'Gelombang kejut tiap 3 detik melukai, memperlambat musuh, dan meretakkan kota.',
        '+30% Damage dan radius gempa bertambah besar.',
        '+35% Damage dan efek perlambatan gerak musuh lebih kuat.',
        '+40% Damage dan daya rusak ke struktur kota berlipat.',
        'MUTASI LEVEL 5: Gempa Susulan! Menghasilkan dua gelombang kejut beruntun.'
      ]
    },
    {
      id: 'mata_laser',
      type: 'weapon',
      weaponId: 'laser_eyes',
      name: 'Mata Laser',
      icon: 'icon_laser_eyes',
      rarity: 'LEGENDARY',
      role: 'beam',
      isMutation: true,
      slot: 'head_slot',
      maxLevel: 5,
      descriptions: [
        'Sinar laser crimson menembus lurus memotong musuh darat/udara dan gedung.',
        '+30% Damage laser dan jangkauan sinar memanjang.',
        '+35% Damage laser dan sinar lebih tebal membakar lebih cepat.',
        '+40% Damage laser dan durasi tembak menjadi 1.4 detik.',
        'MUTASI LEVEL 5: Sinar Ganda! Kedua mata menembakkan sinar laser paralel mematikan.'
      ]
    },

    // =========================================================================
    // 2. PASSIVE CARDS (16 PASSIVES)
    // =========================================================================
    {
      id: 'kulit_baja',
      type: 'passive',
      passiveKey: 'ironSkin',
      name: 'Kulit Baja',
      icon: 'icon_iron_skin',
      rarity: 'COMMON',
      role: 'defense',
      maxLevel: 5,
      descriptions: [
        'HP Maksimal +15% dan memulihkan 45 HP seketika.',
        'HP Maksimal +15% dan memulihkan 45 HP seketika.',
        'HP Maksimal +15% dan memulihkan 55 HP seketika.',
        'HP Maksimal +15% dan memulihkan 65 HP seketika.',
        'HP Maksimal +25% dan memulihkan 100 HP seketika.'
      ],
      effects: [
        { maxHpPercent: 0.15, healAmount: 45 },
        { maxHpPercent: 0.15, healAmount: 45 },
        { maxHpPercent: 0.15, healAmount: 55 },
        { maxHpPercent: 0.15, healAmount: 65 },
        { maxHpPercent: 0.25, healAmount: 100 }
      ]
    },
    {
      id: 'regenerasi',
      type: 'passive',
      passiveKey: 'regeneration',
      name: 'Regenerasi',
      icon: 'icon_regen',
      rarity: 'RARE',
      role: 'utility',
      maxLevel: 5,
      descriptions: [
        'Memulihkan HP secara perlahan (+2.5 HP / detik).',
        'Regenerasi HP meningkat (+4.5 HP / detik).',
        'Regenerasi HP meningkat (+7.0 HP / detik).',
        'Regenerasi HP meningkat (+10.5 HP / detik).',
        'Regenerasi HP masif (+16.0 HP / detik).'
      ],
      effects: [
        { hpPerSec: 2.5 },
        { hpPerSec: 4.5 },
        { hpPerSec: 7.0 },
        { hpPerSec: 10.5 },
        { hpPerSec: 16.0 }
      ]
    },
    {
      id: 'magnet_xp',
      type: 'passive',
      passiveKey: 'magnet',
      name: 'Magnet XP',
      icon: 'icon_magnet',
      rarity: 'COMMON',
      role: 'utility',
      maxLevel: 5,
      descriptions: [
        'Radius penarik kristal XP bertambah +35% (+25 px).',
        'Radius penarik kristal XP bertambah +45 px.',
        'Radius penarik kristal XP bertambah +70 px.',
        'Radius penarik kristal XP bertambah +100 px.',
        'Radius penarik kristal XP menyerap separuh layar (+160 px)!'
      ],
      effects: [
        { radiusBonus: 25 },
        { radiusBonus: 45 },
        { radiusBonus: 70 },
        { radiusBonus: 100 },
        { radiusBonus: 160 }
      ]
    },
    {
      id: 'kaki_perkasa',
      type: 'passive',
      passiveKey: 'swiftStride',
      name: 'Kaki Perkasa',
      icon: 'icon_swift',
      rarity: 'COMMON',
      role: 'mobility',
      maxLevel: 5,
      descriptions: [
        'Kecepatan gerak Kaiju bertambah +15%.',
        'Kecepatan gerak Kaiju bertambah +12%.',
        'Kecepatan gerak Kaiju bertambah +12%.',
        'Kecepatan gerak Kaiju bertambah +12%.',
        'Kecepatan gerak Kaiju melesat cepat +20%!'
      ],
      effects: [
        { speedMultiplier: 1.15 },
        { speedMultiplier: 1.27 },
        { speedMultiplier: 1.39 },
        { speedMultiplier: 1.51 },
        { speedMultiplier: 1.71 }
      ]
    },
    {
      id: 'tubuh_raksasa',
      type: 'passive',
      passiveKey: 'colossus',
      name: 'Tubuh Raksasa',
      icon: 'icon_colossus',
      rarity: 'EPIC',
      role: 'mobility',
      maxLevel: 5,
      descriptions: [
        'Ukuran tubuh membesar +15%, memperluas area injakan.',
        'Ukuran tubuh membesar +15%, daya hancur meluas.',
        'Ukuran tubuh membesar +15%, jangkauan cakar membesar.',
        'Ukuran tubuh membesar +15%, tapak kaki menggetarkan kota.',
        'TITAN PURBA: Skala bertambah +25%! Menginjak segalanya.'
      ],
      effects: [
        { scaleBonus: 0.15 },
        { scaleBonus: 0.30 },
        { scaleBonus: 0.45 },
        { scaleBonus: 0.60 },
        { scaleBonus: 0.85 }
      ]
    },
    {
      id: 'pembunuh',
      type: 'passive',
      passiveKey: 'carnage',
      name: 'Pembunuh',
      icon: 'icon_carnage',
      rarity: 'RARE',
      role: 'offense',
      maxLevel: 5,
      descriptions: [
        'Semua serangan senjata menghasilkan damage +20%.',
        'Semua serangan senjata menghasilkan damage +20%.',
        'Semua serangan senjata menghasilkan damage +20%.',
        'Semua serangan senjata menghasilkan damage +25%.',
        'MALAPETAKA: Damage semua senjata berlipat ganda (+35%)!'
      ],
      effects: [
        { damageMultiplier: 1.20 },
        { damageMultiplier: 1.40 },
        { damageMultiplier: 1.60 },
        { damageMultiplier: 1.85 },
        { damageMultiplier: 2.20 }
      ]
    },
    {
      id: 'cepat_tembak',
      type: 'passive',
      passiveKey: 'rapidFire',
      name: 'Cepat Tembak',
      icon: 'icon_rapid',
      rarity: 'RARE',
      role: 'offense',
      maxLevel: 5,
      descriptions: [
        'Waktu cooldown semua senjata berkurang 15%.',
        'Waktu cooldown semua senjata berkurang 12%.',
        'Waktu cooldown semua senjata berkurang 12%.',
        'Waktu cooldown semua senjata berkurang 12%.',
        'BADAI SERANGAN: Waktu cooldown berkurang 18%!'
      ],
      effects: [
        { cooldownMultiplier: 0.85 },
        { cooldownMultiplier: 0.73 },
        { cooldownMultiplier: 0.61 },
        { cooldownMultiplier: 0.49 },
        { cooldownMultiplier: 0.35 }
      ]
    },
    {
      id: 'penghancur',
      type: 'passive',
      passiveKey: 'demolisher',
      name: 'Penghancur Kota',
      icon: 'icon_demolisher',
      rarity: 'COMMON',
      role: 'offense',
      maxLevel: 5,
      descriptions: [
        'Kerusakan senjata pada gedung +35%, gedung lebih cepat roboh.',
        'Kerusakan senjata pada gedung +35%.',
        'Kerusakan senjata pada gedung +35%.',
        'Kerusakan senjata pada gedung +40%.',
        'PERATA KOTA: Daya hancur gedung bertambah +60%!'
      ],
      effects: [
        { buildingDmgMultiplier: 1.35 },
        { buildingDmgMultiplier: 1.70 },
        { buildingDmgMultiplier: 2.05 },
        { buildingDmgMultiplier: 2.45 },
        { buildingDmgMultiplier: 3.05 }
      ]
    },
    {
      id: 'perisai_duri',
      type: 'passive',
      passiveKey: 'thornShield',
      name: 'Sisik Duri',
      icon: 'icon_thorns',
      rarity: 'EPIC',
      role: 'defense',
      maxLevel: 5,
      descriptions: [
        'Saat terkena damage, memancarkan ledakan duri ke sekitar (25 dmg).',
        'Duri balasan menghasilkan 38 damage.',
        'Duri balasan menghasilkan 55 damage.',
        'Duri balasan menghasilkan 75 damage.',
        'LEDAKAN DURI MAKSIMAL: 110 damage dan radius ledakan meluas!'
      ],
      effects: [
        { thornDamage: 25, thornRadius: 45 },
        { thornDamage: 38, thornRadius: 55 },
        { thornDamage: 55, thornRadius: 65 },
        { thornDamage: 75, thornRadius: 78 },
        { thornDamage: 110, thornRadius: 95 }
      ]
    },

    // --- NEW PASSIVES (TAHAP 4B-1) ---
    {
      id: 'regenerasi_agresif',
      type: 'passive',
      passiveKey: 'vampirism',
      name: 'Regenerasi Agresif',
      icon: 'icon_vampirism',
      rarity: 'RARE',
      role: 'utility',
      maxLevel: 5,
      descriptions: [
        'Memulihkan +1.5 HP setiap kali mengalahkan musuh.',
        'Pemulihan meningkat menjadi +2.5 HP per musuh.',
        'Pemulihan meningkat menjadi +4.0 HP per musuh.',
        'Pemulihan meningkat menjadi +6.0 HP per musuh.',
        'PEMANGSA MUTLAK: +9.0 HP per musuh dan +25 HP dari kendaraan/tank!'
      ],
      effects: [
        { healPerKill: 1.5, vehicleHeal: 6 },
        { healPerKill: 2.5, vehicleHeal: 10 },
        { healPerKill: 4.0, vehicleHeal: 15 },
        { healPerKill: 6.0, vehicleHeal: 20 },
        { healPerKill: 9.0, vehicleHeal: 30 }
      ]
    },
    {
      id: 'haus_darah',
      type: 'passive',
      passiveKey: 'bloodRage',
      name: 'Haus Darah',
      icon: 'icon_blood_rage',
      rarity: 'RARE',
      role: 'offense',
      maxLevel: 5,
      descriptions: [
        'Membunuh musuh memberi buff damage sementara +4% (maks 5 tumpukan).',
        'Buff damage +5% per kill (maks 6 tumpukan).',
        'Buff damage +6% per kill (maks 7 tumpukan).',
        'Buff damage +7% per kill (maks 8 tumpukan).',
        'AMUKAN BERSERKER: +9% damage per kill (maks 10 tumpukan = +90% Damage)!'
      ],
      effects: [
        { dmgPerStack: 0.04, maxStacks: 5, duration: 4.0 },
        { dmgPerStack: 0.05, maxStacks: 6, duration: 4.5 },
        { dmgPerStack: 0.06, maxStacks: 7, duration: 5.0 },
        { dmgPerStack: 0.07, maxStacks: 8, duration: 5.5 },
        { dmgPerStack: 0.09, maxStacks: 10, duration: 6.5 }
      ]
    },
    {
      id: 'reflektor',
      type: 'passive',
      passiveKey: 'deflector',
      name: 'Reflektor Peluru',
      icon: 'icon_deflector',
      rarity: 'EPIC',
      role: 'defense',
      maxLevel: 5,
      descriptions: [
        '18% peluang memantulkan peluru musuh menjadi tembakan balik.',
        'Peluang pantulan meningkat menjadi 28%.',
        'Peluang pantulan meningkat menjadi 38%.',
        'Peluang pantulan meningkat menjadi 48%.',
        'CERMIN KINETIK: 60% pantulan peluru dengan damage pantul 2x lipat!'
      ],
      effects: [
        { reflectChance: 0.18, reflectMult: 1.0 },
        { reflectChance: 0.28, reflectMult: 1.2 },
        { reflectChance: 0.38, reflectMult: 1.4 },
        { reflectChance: 0.48, reflectMult: 1.6 },
        { reflectChance: 0.60, reflectMult: 2.0 }
      ]
    },
    {
      id: 'perisai_energi',
      type: 'passive',
      passiveKey: 'energyShield',
      name: 'Perisai Energi',
      icon: 'icon_energy_shield',
      rarity: 'EPIC',
      role: 'defense',
      maxLevel: 5,
      descriptions: [
        'Membentuk kubah pelindung menyerap 45 damage, pulih setelah 6 detik tanpa terkena hit.',
        'Kapasitas perisai meningkat menjadi 75 damage.',
        'Kapasitas perisai meningkat menjadi 115 damage.',
        'Kapasitas perisai meningkat menjadi 165 damage.',
        'KUBHA AURA TITAN: Menyerap 230 damage dan waktu isi ulang menjadi 4 detik.'
      ],
      effects: [
        { shieldCapacity: 45, rechargeDelay: 6.0 },
        { shieldCapacity: 75, rechargeDelay: 5.5 },
        { shieldCapacity: 115, rechargeDelay: 5.0 },
        { shieldCapacity: 165, rechargeDelay: 4.5 },
        { shieldCapacity: 230, rechargeDelay: 4.0 }
      ]
    },
    {
      id: 'penjarah',
      type: 'passive',
      passiveKey: 'scavenger',
      name: 'Penjarah Bangkai',
      icon: 'icon_scavenger',
      rarity: 'COMMON',
      role: 'utility',
      maxLevel: 5,
      descriptions: [
        'Musuh kendaraan, tank, dan helikopter menjatuhkan XP ekstra +35%.',
        'Jatuhan XP dari musuh militer bertambah +55%.',
        'Jatuhan XP dari musuh militer bertambah +75%.',
        'Jatuhan XP dari musuh militer bertambah +100%.',
        'RAJA PENJARAH: +150% XP militer dan semua puing gedung memberi bonus XP!'
      ],
      effects: [
        { eliteXpMult: 1.35 },
        { eliteXpMult: 1.55 },
        { eliteXpMult: 1.75 },
        { eliteXpMult: 2.00 },
        { eliteXpMult: 2.50 }
      ]
    },
    {
      id: 'jangkauan_luas',
      type: 'passive',
      passiveKey: 'extendedReach',
      name: 'Jangkauan Luas',
      icon: 'icon_extended_reach',
      rarity: 'RARE',
      role: 'offense',
      maxLevel: 5,
      descriptions: [
        'Jangkauan serang semua senjata dan proyektil bertambah +16%.',
        'Jangkauan serang bertambah +28%.',
        'Jangkauan serang bertambah +40%.',
        'Jangkauan serang bertambah +52%.',
        'JANGKAUAN DOMINASI: +68% jangkauan semua senjata dan laser!'
      ],
      effects: [
        { rangeMult: 1.16 },
        { rangeMult: 1.28 },
        { rangeMult: 1.40 },
        { rangeMult: 1.52 },
        { rangeMult: 1.68 }
      ]
    },
    {
      id: 'pelari_kota',
      type: 'passive',
      passiveKey: 'citySprinter',
      name: 'Pelari Kota',
      icon: 'icon_city_sprinter',
      rarity: 'COMMON',
      role: 'mobility',
      maxLevel: 5,
      descriptions: [
        'Menghancurkan gedung memberi dorongan kecepatan +20% selama 2.5 detik.',
        'Dorongan kecepatan meningkat menjadi +28%.',
        'Dorongan kecepatan meningkat menjadi +36%.',
        'Dorongan kecepatan meningkat menjadi +45%.',
        'BADAI PENGHANCUR: +60% kecepatan lari dan merobohkan gedung memberi darah seketika!'
      ],
      effects: [
        { speedBoost: 0.20, duration: 2.5 },
        { speedBoost: 0.28, duration: 2.8 },
        { speedBoost: 0.36, duration: 3.0 },
        { speedBoost: 0.45, duration: 3.3 },
        { speedBoost: 0.60, duration: 4.0 }
      ]
    },
    {
      id: 'inti_reaktor',
      type: 'passive',
      passiveKey: 'reactorCore',
      name: 'Inti Reaktor',
      icon: 'icon_reactor',
      rarity: 'LEGENDARY',
      role: 'boss_relic',
      maxLevel: 1,
      descriptions: [
        'INTI MECH-TITAN: +20% Damage semua senjata dan -15% Cooldown tembak secara permanen!'
      ],
      effects: [
        { allDamageMult: 1.20, cooldownMult: 0.85 }
      ]
    }
  ]
};
