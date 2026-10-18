/**
 * Titanovore World Configuration
 * Procedural generation seeds, chunk parameters, grid specs, crowd numbers.
 */
export const WORLD_CONFIG = {
  // World Dimensions
  worldWidth: 4000,
  worldHeight: 4000,
  seed: 948271, // Seed for pseudo-random procedural generation

  // Destruction / Spatial Grid (Phase 2 readiness)
  cellSize: 4, // 4x4 px per grid cell
  // Grid size: (4000 / 4) = 1000 x 1000 cells = 1,000,000 cells

  // Performance Chunking
  chunkSize: 256, // 256x256 px per render chunk (64x64 cells)
  chunksPerFrame: 2, // Progressive generation batch size to prevent frame drop

  // Road Network
  mainAvenueSpacing: 640, // Distance between wide avenues
  secondaryStreetSpacing: 200, // Distance between normal streets
  avenueWidth: 36, // Main road width in px
  streetWidth: 20, // Secondary street width in px
  sidewalkWidth: 4, // Sidewalk strip border
  laneMarkingLength: 8,
  laneMarkingGap: 8,

  // City Zonation (relative to map center [2000, 2000])
  downtownRadius: 900, // Tall skyscrapers, dense blocks, helipads
  midtownRadius: 1550, // Medium apartments, retail, parks, offices
  suburbRadius: 2000, // Sparse residential, small yards, houses

  // Building Sizes & Shadows
  buildingMinSize: 24,
  buildingMaxSize: 96,
  shadowOffsetX: 8, // Diagonal down-right shadow offset
  shadowOffsetY: 10,

  // Decorative Crowd (Performance Test)
  pedestrianCount: 400, // ~400 humans walking randomly
  carCount: 40, // ~40 cars moving on roads
  pedestrianSize: { width: 3, height: 4 }, // 3x4 px
  carSize: { width: 8, height: 4 }, // 8x4 px
  crowdCullPadding: 100 // Extra pixel margin outside viewport before culling updates
};
