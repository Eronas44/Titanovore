/**
 * Titanovore World Configuration
 * Procedural generation seeds, chunk parameters, grid specs, crowd numbers, and destruction specs.
 */
export const WORLD_CONFIG = {
  // World Dimensions
  worldWidth: 4000,
  worldHeight: 4000,
  seed: 948271, // Deterministic procedural seed

  // Destruction / Spatial Grid (Phase 2)
  cellSize: 4, // 4x4 px per grid cell
  // Grid size: (4000 / 4) = 1000 x 1000 cells = 1,000,000 cells

  // Performance Chunking & Dirty Rect Budget
  chunkSize: 256, // 256x256 px per render chunk (64x64 cells)
  chunksPerFrame: 2, // Progressive generation batch size for new chunks
  maxDirtyChunkUpdatesPerFrame: 4, // Maximum dirty chunks to re-render per frame during heavy destruction

  // Building Cell Hit Points by Category
  cellHpByType: {
    residentialHouse: 1, // Small house gabled roof (crumbles fast)
    commercialRuko: 2, // Concrete shophouses / retail
    officeBlock: 3, // Mid-rise office block
    downtownTower: 4, // Reinforced steel skyscraper
    industrialWarehouse: 2, // Metal warehouse
    storageTank: 5, // Heavy steel industrial tank
    shippingContainer: 2
  },

  // Building Collapse Integrity
  collapseThreshold: 0.45, // Collapse triggered when > 45% of building cells destroyed
  debrisSpreadRadiusFactor: 1.3, // Outward debris splash radius = building heightLevel * factor

  // Road Network (Tighter, denser city grid)
  mainAvenueSpacing: 480, // Distance between wide avenues
  secondaryStreetSpacing: 140, // Distance between normal streets (smaller city blocks!)
  avenueWidth: 32, // Main road width in px
  streetWidth: 18, // Secondary street width in px
  sidewalkWidth: 4, // Sidewalk strip border
  laneMarkingLength: 8,
  laneMarkingGap: 8,
  zebraCrossWidth: 14, // Zebra crossing length at intersections

  // Canal / River Configuration
  canalWidth: 38, // Width of central winding canal
  canalBankWidth: 4, // Stone retaining wall border

  // City Zonation (Districts across 4000x4000 map)
  downtownRadius: 650, // High-rise towers, neon signs, stepped roofs, rooftop gardens
  commercialRadius: 1250, // Shophouses (ruko), retail, large parking lots, AC units
  residentialRadius: 1850, // Small houses with gabled roofs, yards, fences

  // Building Sizes & Heights
  buildingSizes: {
    residentialHouse: { min: 16, max: 28, heightLevels: [1, 2] },
    commercialRuko: { min: 24, max: 40, heightLevels: [2, 3, 4] },
    officeBlock: { min: 40, max: 72, heightLevels: [4, 6, 8] },
    downtownTower: { min: 52, max: 96, heightLevels: [8, 12, 16] },
    industrialWarehouse: { min: 44, max: 80, heightLevels: [2, 3] }
  },

  // Street Life Elements Spacing
  streetTreeSpacing: 36, // Px between trees along sidewalks
  streetLampSpacing: 56, // Px between street light posts
  streetLightRadius: 22, // Radius of warm ambient glow pool on ground
  parallelParkedCarChance: 0.28, // Chance of parked car per road curb segment

  // Decorative Crowd (Performance Test)
  pedestrianCount: 400, // ~400 humans restricted to sidewalks, zebra cross, and parks
  carCount: 40, // ~40 moving cars restricted to road lanes
  pedestrianSize: { width: 3, height: 4 }, // 3x4 px
  carSize: { width: 8, height: 4 }, // 8x4 px
  crowdCullPadding: 100 // Frustum culling margin outside viewport
};
