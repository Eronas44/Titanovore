/**
 * Card System Configuration - Tahap 4A
 * 12 Cards with Rarity, Stats, Levels (1-5), and Upgrade Effects.
 */
export const CARD_CONFIG = {
  rerollsPerRun: 2,
  skipRewardHp: 25,
  skipRewardXp: 15,
  ownedWeaponWeightMultiplier: 1.45, // Slightly favors building owned weapons

  rarities: {
    COMMON: {
      id: 'common',
      name: 'Umum',
      color: '#94a3b8',
      hex: 0x94a3b8,
      weight: 60
    },
    RARE: {
      id: 'rare',
      name: 'Langka',
      color: '#38bdf8',
      hex: 0x38bdf8,
      weight: 26
    },
    EPIC: {
      id: 'epic',
      name: 'Epik',
      color: '#c084fc',
      hex: 0xc084fc,
      weight: 11
    },
    LEGENDARY: {
      id: 'legendary',
      name: 'Legendaris',
      color: '#fb923c',
      hex: 0xfb923c,
      weight: 3
    }
  },

  cards: [
    // --- 1. WEAPON CARDS ---
    {
      id: 'cakar',
      type: 'weapon',
      weaponId: 'claw',
      name: 'Cakar',
      icon: 'icon_claw',
      rarity: 'COMMON',
      maxLevel: 5,
      descriptions: [
        'Senjata cakar menyapu busur depan.',
        '+25% Damage dan jangkauan cakar lebih jauh.',
        '+30% Damage dan busur sapuan lebih lebar.',
        '+35% Damage dan cooldown berkurang drastis.',
        'SPESIAL: Cakar Ganda! Sapuan ganda berturut-turut.'
      ]
    },
    {
      id: 'meriam_punggung',
      type: 'weapon',
      weaponId: 'back_cannon',
      name: 'Meriam Punggung',
      icon: 'icon_cannon',
      rarity: 'RARE',
      maxLevel: 5,
      descriptions: [
        'Menembak musuh darat dan udara secara otomatis.',
        '+30% Damage dan jarak tembak meningkat.',
        'Menembak 2 peluru sekaligus dalam satu tembakan.',
        '+30% Damage dan kecepatan tembak lebih cepat.',
        'SPESIAL: Salvo Dua Arah! Menembak ke depan dan belakang.'
      ]
    },
    {
      id: 'kulit_listrik',
      type: 'weapon',
      weaponId: 'electric_skin',
      name: 'Kulit Listrik',
      icon: 'icon_electric',
      rarity: 'RARE',
      maxLevel: 5,
      descriptions: [
        'Aura petir menyetrum musuh di sekitar (darat & udara).',
        '+35% Damage dan radius sengatan bertambah.',
        '+40% Damage dan interval sengatan lebih cepat.',
        '+45% Damage dan radius sengatan masif.',
        'SPESIAL: Petir Berantai! Menyambar ke 2 musuh di sekitar.'
      ]
    },

    // --- 2. PASSIVE CARDS ---
    {
      id: 'kulit_baja',
      type: 'passive',
      passiveKey: 'ironSkin',
      name: 'Kulit Baja',
      icon: 'icon_iron_skin',
      rarity: 'COMMON',
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
      maxLevel: 5,
      descriptions: [
        'Memulihkan HP secara perlahan (+2 HP / detik).',
        'Regenerasi HP meningkat (+4 HP / detik).',
        'Regenerasi HP meningkat (+6 HP / detik).',
        'Regenerasi HP meningkat (+9 HP / detik).',
        'Regenerasi HP masif (+14 HP / detik).'
      ],
      effects: [
        { hpPerSec: 2.0 },
        { hpPerSec: 4.0 },
        { hpPerSec: 6.0 },
        { hpPerSec: 9.0 },
        { hpPerSec: 14.0 }
      ]
    },
    {
      id: 'magnet_xp',
      type: 'passive',
      passiveKey: 'magnet',
      name: 'Magnet XP',
      icon: 'icon_magnet',
      rarity: 'COMMON',
      maxLevel: 5,
      descriptions: [
        'Radius penarik kristal XP bertambah +35% (+20 px).',
        'Radius penarik kristal XP bertambah +35% (+20 px).',
        'Radius penarik kristal XP bertambah +35% (+20 px).',
        'Radius penarik kristal XP bertambah +35% (+25 px).',
        'Radius penarik kristal XP menyerap separuh layar (+60 px)!'
      ],
      effects: [
        { radiusBonus: 20 },
        { radiusBonus: 40 },
        { radiusBonus: 60 },
        { radiusBonus: 85 },
        { radiusBonus: 145 }
      ]
    },
    {
      id: 'kaki_perkasa',
      type: 'passive',
      passiveKey: 'swiftStride',
      name: 'Kaki Perkasa',
      icon: 'icon_swift',
      rarity: 'COMMON',
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
    }
  ]
};
