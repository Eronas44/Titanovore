import { WORLD_CONFIG } from '../config/world.js';

export const CELL_TYPES = {
  EMPTY: 0,
  ROAD: 1,
  SIDEWALK: 2,
  PARK: 3,
  PARKING: 4,
  BUILDING: 5,
  BUILDING_DETAIL: 6
};

/**
 * CityGrid
 * High-performance 4x4 px cell typed array grid representing the city.
 * Prepared for Phase 2 voxel-like progressive building destruction.
 */
export class CityGrid {
  constructor(worldWidth = WORLD_CONFIG.worldWidth, worldHeight = WORLD_CONFIG.worldHeight, cellSize = WORLD_CONFIG.cellSize) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.cols = Math.floor(worldWidth / cellSize);
    this.rows = Math.floor(worldHeight / cellSize);
    this.totalCells = this.cols * this.rows;

    // Typed arrays for blazing-fast 60 FPS spatial access & memory efficiency
    this.types = new Uint8Array(this.totalCells); // Cell type (0-255)
    this.hp = new Uint8Array(this.totalCells); // Cell hit points (0-255)
    this.buildingIds = new Uint32Array(this.totalCells); // Associated building ID (0 = none)

    // Registry of all building metadata instances by ID
    this.buildings = new Map();
  }

  getIndex(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  worldToGrid(x, y) {
    return {
      col: Math.floor(x / this.cellSize),
      row: Math.floor(y / this.cellSize)
    };
  }

  gridToWorld(col, row) {
    return {
      x: col * this.cellSize,
      y: row * this.cellSize
    };
  }

  /**
   * Fast query for cell at world coordinates (x, y)
   * @param {number} worldX 
   * @param {number} worldY 
   * @returns {{ col: number, row: number, type: number, hp: number, buildingId: number } | null}
   */
  getCellAt(worldX, worldY) {
    if (worldX < 0 || worldX >= this.worldWidth || worldY < 0 || worldY >= this.worldHeight) {
      return null;
    }
    const col = Math.floor(worldX / this.cellSize);
    const row = Math.floor(worldY / this.cellSize);
    const idx = row * this.cols + col;
    return {
      col,
      row,
      type: this.types[idx],
      hp: this.hp[idx],
      buildingId: this.buildingIds[idx]
    };
  }

  /**
   * Sets cell properties at grid coordinates (col, row)
   */
  setCell(col, row, type, hp = 0, buildingId = 0) {
    const idx = this.getIndex(col, row);
    if (idx !== -1) {
      this.types[idx] = type;
      this.hp[idx] = hp;
      this.buildingIds[idx] = buildingId;
    }
  }

  /**
   * Registers a building object in the spatial registry
   * @param {Object} building 
   */
  registerBuilding(building) {
    this.buildings.set(building.id, building);

    // Rasterize building footprint into cell grid
    const minCol = Math.max(0, Math.floor(building.x / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((building.x + building.width) / this.cellSize));
    const minRow = Math.max(0, Math.floor(building.y / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((building.y + building.height) / this.cellSize));

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        // If building is L-shaped, skip cutout quadrant
        if (building.shape === 'l_shape' && building.cutout) {
          const cellWorld = this.gridToWorld(c, r);
          if (
            cellWorld.x >= building.cutout.x &&
            cellWorld.x < building.cutout.x + building.cutout.width &&
            cellWorld.y >= building.cutout.y &&
            cellWorld.y < building.cutout.y + building.cutout.height
          ) {
            continue;
          }
        }
        const idx = r * this.cols + c;
        this.types[idx] = CELL_TYPES.BUILDING;
        this.hp[idx] = building.cellHp || 100;
        this.buildingIds[idx] = building.id;
      }
    }
  }

  /**
   * Fast spatial query returning all unique buildings intersecting given rectangle.
   * Uses the cell grid for immediate lookup.
   * @param {{ x: number, y: number, width: number, height: number }} rect 
   * @returns {Array<Object>}
   */
  getBuildingsInRect(rect) {
    const minCol = Math.max(0, Math.floor(rect.x / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((rect.x + rect.width) / this.cellSize));
    const minRow = Math.max(0, Math.floor(rect.y / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((rect.y + rect.height) / this.cellSize));

    const foundIds = new Set();
    const result = [];

    // Step by 2 or 3 cells for high performance when checking larger rects
    const step = 2;
    for (let r = minRow; r <= maxRow; r += step) {
      for (let c = minCol; c <= maxCol; c += step) {
        const idx = r * this.cols + c;
        const bId = this.buildingIds[idx];
        if (bId > 0 && !foundIds.has(bId)) {
          foundIds.add(bId);
          const b = this.buildings.get(bId);
          if (b) result.push(b);
        }
      }
    }

    return result;
  }
}
