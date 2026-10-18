/**
 * Titanovore Color Palette
 * Pixel art dark, gritty & dramatic urban aesthetic.
 */
export const PALETTE = {
  // Environment / Terrain
  ground: 0x100e17,
  groundHex: '#100e17',

  // Water / Canal
  waterDeep: 0x0a161c,
  waterDeepHex: '#0a161c',
  waterMid: 0x0f232b,
  waterMidHex: '#0f232b',
  waterHighlight: 0x183742,
  waterHighlightHex: '#183742',
  canalBank: 0x222a30,
  canalBankHex: '#222a30',
  canalBorder: 0x343e47,
  canalBorderHex: '#343e47',
  
  // Roads & Sidewalks
  road: 0x1a1722,
  roadHex: '#1a1722',
  roadMarking: 0xbfa34c,
  roadMarkingHex: '#bfa34c',
  roadMarkingFaded: 0x6e5e34,
  roadMarkingFadedHex: '#6e5e34',
  zebraCross: 0xd4d0dc,
  zebraCrossHex: '#d4d0dc',
  
  sidewalk: 0x322d3f,
  sidewalkHex: '#322d3f',
  sidewalkLight: 0x3e384e,
  sidewalkLightHex: '#3e384e',
  sidewalkBorder: 0x48425a,
  sidewalkBorderHex: '#48425a',
  
  parkingLot: 0x16141f,
  parkingLotHex: '#16141f',
  parkingLine: 0x423c52,
  parkingLineHex: '#423c52',

  // Street Life & Street Lights
  streetLampPost: 0x5a5568,
  streetLampPostHex: '#5a5568',
  streetLightBulb: 0xffe89e,
  streetLightBulbHex: '#ffe89e',
  streetLightGlow: 'rgba(255, 215, 115, 0.16)', // Warm light pool on pavement
  streetBench: 0x4a3222,
  streetBenchHex: '#4a3222',
  busShelterRoof: 0x243542,
  busShelterRoofHex: '#243542',

  // Parks & Nature
  grassDark: 0x122419,
  grassDarkHex: '#122419',
  grassMid: 0x193623,
  grassMidHex: '#193623',
  grassLight: 0x254d33,
  grassLightHex: '#254d33',
  parkPath: 0x2a2721,
  parkPathHex: '#2a2721',
  pondWater: 0x0d1e21,
  pondWaterHex: '#0d1e21',
  
  // Tree variations
  treeDark: 0x0e1b12,
  treeDarkHex: '#0e1b12',
  treeMid: 0x1d3a27,
  treeMidHex: '#1d3a27',
  treeLight: 0x2f5a3c,
  treeLightHex: '#2f5a3c',
  // Conifer / Pine (pointy)
  pineDark: 0x0b171c,
  pineDarkHex: '#0b171c',
  pineMid: 0x153036,
  pineMidHex: '#153036',
  pineLight: 0x22484f,
  pineLightHex: '#22484f',

  // Sports Courts (Basketball / Tennis)
  courtSurfaceGreen: 0x1f422e,
  courtSurfaceGreenHex: '#1f422e',
  courtSurfaceTerracotta: 0x612f22,
  courtSurfaceTerracottaHex: '#612f22',
  courtLines: 0xe2e8f0,
  courtLinesHex: '#e2e8f0',

  // Building Shadows & Walls
  buildingShadow: 0x07060a,
  buildingShadowHex: '#07060a',
  buildingShadowAlpha: 0.68,
  buildingWallDark: 0x15131c,
  buildingWallDarkHex: '#15131c',

  // Rich Roof Color Palettes (Varied per building)
  roofPalettes: {
    // Terracotta / Red brick tiles
    terracotta: {
      base: '#6e2b20',
      light: '#87392c',
      dark: '#4f1d15',
      ridge: '#a34838'
    },
    // Concrete / Modern grey
    concrete: {
      base: '#3a3745',
      light: '#4d495c',
      dark: '#272530',
      ridge: '#605c73'
    },
    // Teal / Copper Patina
    patina: {
      base: '#234744',
      light: '#315e5a',
      dark: '#162e2c',
      ridge: '#427a75'
    },
    // Sandy Beige / Warm Stone
    beige: {
      base: '#595045',
      light: '#6e6356',
      dark: '#3d372f',
      ridge: '#857767'
    },
    // Moss Green / Slate Green
    moss: {
      base: '#26422f',
      light: '#35593f',
      dark: '#182b1e',
      ridge: '#477353'
    },
    // Wood Brown / Cedar Shingles
    wood: {
      base: '#4a3325',
      light: '#5e412f',
      dark: '#302118',
      ridge: '#73503a'
    },
    // Dark Tar / Asphalt
    asphalt: {
      base: '#24222c',
      light: '#353242',
      dark: '#17161c',
      ridge: '#484459'
    },
    // Steel Blue / Industrial Slate
    steelBlue: {
      base: '#293547',
      light: '#384861',
      dark: '#1b232f',
      ridge: '#495e7d'
    }
  },

  // Rooftop Details & Mechanicals
  solarPanel: 0x142038,
  solarPanelHex: '#142038',
  solarPanelGrid: 0x223c66,
  solarPanelGridHex: '#223c66',
  
  waterTankWood: 0x523924,
  waterTankWoodHex: '#523924',
  waterTankMetal: 0x4a4e59,
  waterTankMetalHex: '#4a4e59',
  
  skylightGlass: 0x243e4d,
  skylightGlassHex: '#243e4d',
  skylightFrame: 0x476a7d,
  skylightFrameHex: '#476a7d',

  roofDetailDark: 0x1c1a24,
  roofDetailDarkHex: '#1c1a24',
  roofDetailLight: 0x544e66,
  roofDetailLightHex: '#544e66',

  chimneySmoke: 'rgba(180, 190, 205, 0.25)',

  // Neon Billboards (Cyberpunk accent in Downtown)
  neonColors: [
    { main: '#ff2a85', glow: 'rgba(255, 42, 133, 0.4)' }, // Neon Pink
    { main: '#00e5ff', glow: 'rgba(0, 229, 255, 0.4)' },  // Neon Cyan
    { main: '#ffb703', glow: 'rgba(255, 183, 3, 0.4)' },   // Neon Amber
    { main: '#70e000', glow: 'rgba(112, 224, 0, 0.4)' }   // Neon Lime
  ],

  // Industrial Props (Shipping containers & Storage tanks)
  containerColors: [
    '#b91c1c', // Rust Red
    '#1d4ed8', // Freight Blue
    '#c2410c', // Safety Orange
    '#047857', // Cargo Green
    '#4b5563'  // Dark Silver
  ],
  tankMetal: 0x3d434d,
  tankMetalHex: '#3d434d',
  tankHighlight: 0x646c7a,
  tankHighlightHex: '#646c7a',

  // Helipad
  helipadRing: 0xc4b786,
  helipadRingHex: '#c4b786',
  helipadLetter: 0xe6d9a0,
  helipadLetterHex: '#e6d9a0',

  // Kaiju
  kaijuGreen: 0x3fa66b,
  kaijuGreenHex: '#3fa66b',
  kaijuGreenDark: 0x256e44,
  kaijuGreenDarkHex: '#256e44',
  kaijuGreenLight: 0x5cd992,
  kaijuGreenLightHex: '#5cd992',
  kaijuDorsalFin: 0x1e5434,
  kaijuDorsalFinHex: '#1e5434',
  kaijuEyeYellow: 0xffd23f,
  kaijuEyeYellowHex: '#ffd23f',
  kaijuEyePupil: 0x140d02,
  kaijuEyePupilHex: '#140d02',

  // Electric Skin Layer (Debug / Upgrade test)
  electricSparkLight: 0x7ef9ff,
  electricSparkLightHex: '#7ef9ff',
  electricSparkMid: 0x22d3ee,
  electricSparkMidHex: '#22d3ee',
  electricSparkDark: 0x0284c7,
  electricSparkDarkHex: '#0284c7',

  // Pedestrians
  pedestrianSkin: 0xd9a07e,
  pedestrianSkinHex: '#d9a07e',
  pedestrianClothes: [
    0x8b5cf6, 0x3b82f6, 0xef4444, 0x10b981, 0xf59e0b, 0x94a3b8, 0xe2e8f0, 0xec4899, 0x14b8a6
  ],

  // Vehicles
  carBodies: [
    0xef4444, // Red
    0x3b82f6, // Blue
    0xe2e8f0, // White
    0x64748b, // Grey
    0xeab308, // Taxi Yellow
    0x10b981, // Emerald
    0x8b5cf6, // Violet
    0xf97316  // Orange
  ],
  carWindow: 0x1e293b,
  carWindowHex: '#1e293b',
  carHeadlight: 0xfef08a,
  carHeadlightHex: '#fef08a',
  carHeadlightGlow: 'rgba(254, 240, 138, 0.28)',
  carTaillight: 0xb91c1c,
  carTaillightHex: '#b91c1c',

  // UI
  uiText: 0x38ef7d,
  uiTextHex: '#38ef7d',
  uiBg: 0x0b0a10,
  uiBgHex: '#0b0a10'
};
