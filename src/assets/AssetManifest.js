/**
 * AssetManifest.js - Tahap 6A: Asset Pipeline
 * Satu-satunya tempat pendaftaran seluruh aset visual game Titanovore.
 * Menyimpan konfigurasi: key, file path, frame dimensions, frame count,
 * anchor pivot, display scale, orientasi hadap, dan slot attachment.
 */

export const ASSET_CATEGORIES = {
  KAIJU: 'kaiju',
  MUTATIONS: 'mutations',
  ENEMIES: 'enemies',
  BOSS: 'boss',
  FX: 'fx'
};

export const ASSET_TYPES = {
  IMAGE: 'image',
  SPRITESHEET: 'spritesheet',
  ATLAS: 'atlas'
};

/**
 * Konfigurasi Anchor & Transform per Slot Tubuh Kaiju
 * Digunakan untuk menempelkan layer visual mutasi/senjata dengan presisi.
 */
export const SLOT_CONFIG = {
  body: {
    slot: 'body',
    anchor: { x: 0, y: 0 },
    rotation: 0,
    scale: 1.0,
    depth: 15,
    canAim: false,
    description: 'Lapisan dasar torso kaiju dan mutasi cakar/stomp'
  },
  skin_overlay: {
    slot: 'skin_overlay',
    anchor: { x: 0, y: 0 },
    rotation: 0,
    scale: 1.0,
    depth: 16,
    canAim: false,
    description: 'Lapisan efek luar (kulit listrik, duri tubuh samping)'
  },
  head_slot: {
    slot: 'head_slot',
    anchor: { x: 22, y: 0 }, // Daerah kepala/moncong Godzilla (arah hadap kanan)
    rotation: 0,
    scale: 1.0,
    depth: 17,
    canAim: false,
    description: 'Slot kepala (tanduk napas api, lensa mata laser)'
  },
  back_slot: {
    slot: 'back_slot',
    anchor: { x: -6, y: 0 }, // Punggung tengah di atas tulang belakang
    rotation: 0,
    scale: 1.0,
    depth: 18,
    canAim: true, // Turret dapat berputar otomatis membidik target terdekat
    maxAimAngle: 0.65, // ~37 derajat batas putar turret dari arah hadap tubuh
    aimTurnSpeed: 6.0,
    description: 'Slot punggung (meriam punggung, pod roket, baterai railgun)'
  },
  tail_slot: {
    slot: 'tail_slot',
    anchor: { x: -22, y: 0 }, // Pangkal ekor
    rotation: 0,
    scale: 1.0,
    depth: 14,
    canAim: false,
    description: 'Slot ekor (gada berduri morningstar dan pelindung ekor)'
  }
};

/**
 * Daftar Manifest Seluruh Aset Gambar
 */
export const ASSET_MANIFEST = [
  // ==========================================
  // 1. KAIJU (Apex Predator Top-Down)
  // ==========================================
  {
    key: 'kaiju_body',
    path: 'assets/sprites/kaiju/kaiju_body.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 0.625, // 96px sumber -> ~60px display in-game
    facing: 'right', // 0 radian arah hadap bawaan
    rotationOffset: 0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Sprite torso, leher, kepala, dan duri punggung Godzilla'
  },
  {
    key: 'kaiju_walk',
    path: 'assets/sprites/kaiju/kaiju_walk.png',
    type: ASSET_TYPES.SPRITESHEET,
    frameWidth: 96,
    frameHeight: 96,
    frameCount: 4, // 4 frame siklus ayunan lengan dan kontraksi tubuh
    pivot: { x: 0.5, y: 0.5 },
    scale: 0.625,
    facing: 'right',
    rotationOffset: 0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Siklus gerak jalan 4-frame untuk lengan dan torso Kaiju'
  },
  {
    key: 'kaiju_foot',
    path: 'assets/sprites/kaiju/kaiju_foot.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 24,
    frameHeight: 18,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    facing: 'right',
    rotationOffset: 0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Kaki bercakar Godzilla untuk animasi langkah bergantian'
  },
  {
    key: 'kaiju_shadow',
    path: 'assets/sprites/kaiju/kaiju_shadow.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 40,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    facing: 'right',
    rotationOffset: 0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Bayangan elips tanah di bawah tubuh Kaiju'
  },
  {
    key: 'kaiju_footprint',
    path: 'assets/sprites/kaiju/kaiju_footprint.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 18,
    frameHeight: 14,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    facing: 'right',
    rotationOffset: 0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Jejak tapak cakar di tanah/puing runtuhan'
  },
  {
    key: 'kaiju_tail_0',
    path: 'assets/sprites/kaiju/kaiju_tail_0.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 32,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Segmen ekor 0 (pangkal leher ekor)'
  },
  {
    key: 'kaiju_tail_1',
    path: 'assets/sprites/kaiju/kaiju_tail_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 28,
    frameHeight: 28,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Segmen ekor 1'
  },
  {
    key: 'kaiju_tail_2',
    path: 'assets/sprites/kaiju/kaiju_tail_2.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 24,
    frameHeight: 24,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Segmen ekor 2'
  },
  {
    key: 'kaiju_tail_3',
    path: 'assets/sprites/kaiju/kaiju_tail_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 20,
    frameHeight: 20,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Segmen ekor 3'
  },
  {
    key: 'kaiju_tail_4',
    path: 'assets/sprites/kaiju/kaiju_tail_4.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 16,
    frameHeight: 16,
    frameCount: 1,
    pivot: { x: 0.5, y: 0.5 },
    scale: 1.0,
    category: ASSET_CATEGORIES.KAIJU,
    description: 'Segmen ekor 4 (ujung ekor cambuk)'
  },

  // ==========================================
  // 2. MUTATION LAYERS (Visual Weapons 1, 3, 5)
  // ==========================================
  // Cakar (Claw) - slot: body
  {
    key: 'mutation_claw_1',
    path: 'assets/sprites/mutations/mutation_claw_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Cakar Raptor Lv 1'
  },
  {
    key: 'mutation_claw_3',
    path: 'assets/sprites/mutations/mutation_claw_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Cakar Zamrud Tajam Lv 3'
  },
  {
    key: 'mutation_claw_5',
    path: 'assets/sprites/mutations/mutation_claw_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Cakar Sabit Giok Purba Raksasa Lv 5'
  },

  // Meriam Punggung (Back Cannon) - slot: back_slot
  {
    key: 'mutation_back_cannon_1',
    path: 'assets/sprites/mutations/mutation_back_cannon_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Meriam Ganda Baja Lv 1'
  },
  {
    key: 'mutation_back_cannon_3',
    path: 'assets/sprites/mutations/mutation_back_cannon_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Meriam Berat Artileri Lv 3'
  },
  {
    key: 'mutation_back_cannon_5',
    path: 'assets/sprites/mutations/mutation_back_cannon_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Baterai Railgun Plasma Bersinar Lv 5'
  },

  // Roket Punggung (Back Rockets) - slot: back_slot
  {
    key: 'mutation_back_rockets_1',
    path: 'assets/sprites/mutations/mutation_back_rockets_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Pod Roket Bahu Lv 1'
  },
  {
    key: 'mutation_back_rockets_3',
    path: 'assets/sprites/mutations/mutation_back_rockets_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Pod Quad Missile Laser-guided Lv 3'
  },
  {
    key: 'mutation_back_rockets_5',
    path: 'assets/sprites/mutations/mutation_back_rockets_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'back_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Pod Roket Heksagonal Reaktif Lv 5'
  },

  // Duri Tubuh (Body Spikes) - slot: skin_overlay
  {
    key: 'mutation_body_spikes_1',
    path: 'assets/sprites/mutations/mutation_body_spikes_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Duri Rusuk Bertulang Lv 1'
  },
  {
    key: 'mutation_body_spikes_3',
    path: 'assets/sprites/mutations/mutation_body_spikes_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Duri Karapas Kirmizi Tajam Lv 3'
  },
  {
    key: 'mutation_body_spikes_5',
    path: 'assets/sprites/mutations/mutation_body_spikes_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Karapas Magma Behemoth Lv 5'
  },

  // Napas Api (Fire Breath) - slot: head_slot
  {
    key: 'mutation_fire_breath_1',
    path: 'assets/sprites/mutations/mutation_fire_breath_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Tenggorokan Berpendar Magma Lv 1'
  },
  {
    key: 'mutation_fire_breath_3',
    path: 'assets/sprites/mutations/mutation_fire_breath_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Rahang Membara & Tanduk Obsidian Lv 3'
  },
  {
    key: 'mutation_fire_breath_5',
    path: 'assets/sprites/mutations/mutation_fire_breath_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Tanduk Naga Api Neraka & Rahang Meleleh Lv 5'
  },

  // Mata Laser (Laser Eyes) - slot: head_slot
  {
    key: 'mutation_laser_eyes_1',
    path: 'assets/sprites/mutations/mutation_laser_eyes_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Implan Okular Merah Lv 1'
  },
  {
    key: 'mutation_laser_eyes_3',
    path: 'assets/sprites/mutations/mutation_laser_eyes_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Lensa Delima Berpijar Lv 3'
  },
  {
    key: 'mutation_laser_eyes_5',
    path: 'assets/sprites/mutations/mutation_laser_eyes_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 64,
    frameHeight: 64,
    scale: 0.8,
    slot: 'head_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Sinar Kematian Fototermal Berinti Putih Lv 5'
  },

  // Injakan Getar (Quake Stomp) - slot: body
  {
    key: 'mutation_quake_stomp_1',
    path: 'assets/sprites/mutations/mutation_quake_stomp_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Plat Dada Tektonik Lv 1'
  },
  {
    key: 'mutation_quake_stomp_3',
    path: 'assets/sprites/mutations/mutation_quake_stomp_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Fisura Vulkanik Perut Lv 3'
  },
  {
    key: 'mutation_quake_stomp_5',
    path: 'assets/sprites/mutations/mutation_quake_stomp_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Inti Seismik Vulkanik Pijar Lv 5'
  },

  // Ekor Berduri (Spiked Tail) - slot: tail_slot
  {
    key: 'mutation_spiked_tail_1',
    path: 'assets/sprites/mutations/mutation_spiked_tail_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 24,
    frameHeight: 24,
    scale: 1.0,
    slot: 'tail_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Duri Ujung Ekor Tulang Lv 1'
  },
  {
    key: 'mutation_spiked_tail_3',
    path: 'assets/sprites/mutations/mutation_spiked_tail_3.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 32,
    scale: 1.0,
    slot: 'tail_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Bilah Ekor Samping Baja Lv 3'
  },
  {
    key: 'mutation_spiked_tail_5',
    path: 'assets/sprites/mutations/mutation_spiked_tail_5.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 32,
    scale: 1.0,
    slot: 'tail_slot',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Gada Morningstar Berduri Obsidian Amber Lv 5'
  },

  // Kulit Listrik (Electric Skin)
  {
    key: 'kaiju_electric_skin_0',
    path: 'assets/sprites/mutations/kaiju_electric_skin_0.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Kilatan Busur Listrik Frame 0'
  },
  {
    key: 'kaiju_electric_skin_1',
    path: 'assets/sprites/mutations/kaiju_electric_skin_1.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Kilatan Busur Listrik Frame 1'
  },
  {
    key: 'kaiju_electric_skin_2',
    path: 'assets/sprites/mutations/kaiju_electric_skin_2.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 96,
    frameHeight: 96,
    scale: 0.625,
    slot: 'skin_overlay',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Kilatan Busur Listrik Frame 2'
  },

  // Perisai Energi (Energy Shield Bubble)
  {
    key: 'energy_shield_bubble',
    path: 'assets/sprites/mutations/energy_shield_bubble.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 80,
    frameHeight: 80,
    scale: 1.0,
    slot: 'body',
    category: ASSET_CATEGORIES.MUTATIONS,
    description: 'Gelembung Kubah Pelindung Energi Berputar'
  },

  // ==========================================
  // 3. ENEMIES (Militer & Kendaraan)
  // ==========================================
  {
    key: 'enemy_tank',
    path: 'assets/sprites/enemies/enemy_tank.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 28,
    frameHeight: 18,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Tank Tempur Militer'
  },
  {
    key: 'enemy_helicopter',
    path: 'assets/sprites/enemies/enemy_helicopter.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 32,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Helikopter Serang Apache'
  },
  {
    key: 'enemy_drone',
    path: 'assets/sprites/enemies/enemy_drone.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 16,
    frameHeight: 16,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Drone Kamikaze Cepat'
  },
  {
    key: 'enemy_artillery',
    path: 'assets/sprites/enemies/enemy_artillery.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 20,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Kendaraan Peluncur Howitzer Artileri Bergerak'
  },
  {
    key: 'enemy_police',
    path: 'assets/sprites/enemies/enemy_police.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 18,
    frameHeight: 10,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Mobil Polisi Patroli'
  },
  {
    key: 'enemy_commando',
    path: 'assets/sprites/enemies/enemy_commando.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 12,
    frameHeight: 12,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.ENEMIES,
    description: 'Prajurit Komando Elit Roket'
  },

  // ==========================================
  // 4. BOSS (Mech-Titan)
  // ==========================================
  {
    key: 'boss_mech_titan',
    path: 'assets/sprites/boss/boss_mech_titan.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 72,
    frameHeight: 72,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.BOSS,
    description: 'Robot Raksasa Pertahanan Kota Mech-Titan'
  },

  // ==========================================
  // 5. FX (Efek Partikel & Retikel)
  // ==========================================
  {
    key: 'fx_laser_glow',
    path: 'assets/sprites/fx/fx_laser_glow.png',
    type: ASSET_TYPES.IMAGE,
    frameWidth: 32,
    frameHeight: 32,
    pivot: { x: 0.5, y: 0.5 },
    category: ASSET_CATEGORIES.FX,
    description: 'Kilau Pijar Laser Okular'
  }
];

/**
 * Peta pencarian cepat berdasarkan Key
 */
export const ASSET_MAP = new Map(ASSET_MANIFEST.map(item => [item.key, item]));

/**
 * Mengambil metadata aset berdasarkan key
 * @param {string} key 
 * @returns {Object|null}
 */
export function getAssetConfig(key) {
  return ASSET_MAP.get(key) || null;
}

/**
 * Mengambil konfigurasi slot dan titik tempel (anchor)
 * @param {string} slotName 
 * @returns {Object}
 */
export function getSlotConfig(slotName) {
  return SLOT_CONFIG[slotName] || SLOT_CONFIG.body;
}
