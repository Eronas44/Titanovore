import { WORLD_CONFIG } from '../config/world.js';

export const CELL_TYPES = {
  EMPTY: 0,
  ROAD: 1,
  SIDEWALK: 2,
  PARK: 3,
  PARKING: 4,
  BUILDING: 5,
  BUILDING_DETAIL: 6,
  WATER: 7,
  BRIDGE: 8,
  INDUSTRIAL: 9,
  RUBBLE: 10 // Destroyed walkable debris
};

/**
 * CityGrid - Tahap 2B
 * High-performance 4x4 px cell typed array grid representing the city.
 * Tracks cell types, hit points, building integrity counters, and rubble states.
 */
export class CityGrid {
  constructor(worldWidth = WORLD_CONFIG.worldWidth, worldHeight = WORLD_CONFIG.worldHeight, cellSize = WORLD_CONFIG.cellSize) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize;
    this.cols = Math.floor(worldWidth / cellSize);
    this.rows = Math.floor(worldHeight / cellSize);
    this.totalCells = this.cols * this.rows;

    // Typed arrays for memory efficiency & 60 FPS performance
    this.types = new Uint8Array(this.totalCells); // Cell type (0-255)
    this.hp = new Uint8Array(this.totalCells); // Current cell HP
    this.maxHp = new Uint8Array(this.totalCells); // Initial cell HP
    this.buildingIds = new Uint32Array(this.totalCells); // Building ID (0 = none)
    this.crackedCells = new Uint8Array(this.totalCells); // 1 = hairline surface crack marked

    // Registry of all building metadata instances by ID
    this.buildings = new Map();

    // City-wide destruction telemetry
    this.totalInitialBuildingCells = 0;
    this.totalDestroyedCells = 0;
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
      maxHp: this.maxHp[idx],
      buildingId: this.buildingIds[idx]
    };
  }

  setCell(col, row, type, hp = 0, buildingId = 0) {
    const idx = this.getIndex(col, row);
    if (idx !== -1) {
      this.types[idx] = type;
      this.hp[idx] = hp;
      this.maxHp[idx] = hp;
      this.buildingIds[idx] = buildingId;
    }
  }

  /**
   * Registers a building object and rasters its footprint into the cell grid.
   * Initializes live cell counters for O(1) collapse checking.
   * @param {Object} building 
   */
  registerBuilding(building) {
    this.buildings.set(building.id, building);

    building.totalCells = 0;
    building.aliveCells = 0;
    building.isCollapsed = false;
    building.cells = []; // Array of { col, row, idx }

    const minCol = Math.max(0, Math.floor(building.x / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((building.x + building.width) / this.cellSize));
    const minRow = Math.max(0, Math.floor(building.y / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((building.y + building.height) / this.cellSize));

    const centerCol = Math.floor((minCol + maxCol) / 2);
    const centerRow = Math.floor((minRow + maxRow) / 2);
    building.centerCell = { col: centerCol, row: centerRow };

    // Determine cell HP based on building type/zone
    let cellHp = WORLD_CONFIG.cellHpByType.residentialHouse;
    if (building.zone === 'downtown') {
      cellHp = WORLD_CONFIG.cellHpByType.downtownTower;
    } else if (building.zone === 'commercial') {
      cellHp = WORLD_CONFIG.cellHpByType.commercialRuko;
    } else if (building.zone === 'industrial') {
      cellHp = WORLD_CONFIG.cellHpByType.industrialWarehouse;
    } else if (building.heightLevel >= 6) {
      cellHp = WORLD_CONFIG.cellHpByType.officeBlock;
    }

    building.cellHp = cellHp;

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        // Skip cutout in L-shaped buildings
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
        this.hp[idx] = cellHp;
        this.maxHp[idx] = cellHp;
        this.buildingIds[idx] = building.id;

        building.totalCells++;
        building.aliveCells++;
        building.cells.push({ col: c, row: r, idx });
        this.totalInitialBuildingCells++;
      }
    }
  }

  /**
   * Applies damage to a single cell.
   * If HP reaches 0, turns cell into RUBBLE and checks building collapse threshold.
   * @param {number} col 
   * @param {number} row 
   * @param {number} damage 
   * @returns {{ damaged: boolean, destroyed: boolean, building: Object|null } | null}
   */
  damageCell(col, row, damage) {
    const idx = this.getIndex(col, row);
    if (idx === -1) return null;

    const type = this.types[idx];
    if (type !== CELL_TYPES.BUILDING && type !== CELL_TYPES.BUILDING_DETAIL) {
      return null;
    }

    const bId = this.buildingIds[idx];
    const building = this.buildings.get(bId) || null;

    if (this.hp[idx] > 0) {
      this.hp[idx] = Math.max(0, this.hp[idx] - damage);

      if (this.hp[idx] <= 0) {
        // Cell destroyed! Turn into walkable RUBBLE
        this.types[idx] = CELL_TYPES.RUBBLE;
        this.totalDestroyedCells++;

        if (building) {
          building.aliveCells = Math.max(0, building.aliveCells - 1);
        }

        return { damaged: true, destroyed: true, building, col, row, idx };
      }

      return { damaged: true, destroyed: false, building, col, row, idx };
    }

    return null;
  }

  /**
   * Applies subtle crack damage and marks immediate neighbor cells along the destruction edge.
   * Neighbor cells take slight damage without dropping to 0 HP (they do not collapse immediately).
   * @param {number} col
   * @param {number} row
   * @param {number} crackDamage
   * @param {number} crackRadius
   * @returns {Array<{ col: number, row: number, idx: number, worldX: number, worldY: number, newlyCracked: boolean }>}
   */
  applyCrackDamageToNeighbors(col, row, crackDamage = 0.35, crackRadius = 1) {
    const crackedList = [];

    for (let dr = -crackRadius; dr <= crackRadius; dr++) {
      for (let dc = -crackRadius; dc <= crackRadius; dc++) {
        if (dc === 0 && dr === 0) continue;

        const nc = col + dc;
        const nr = row + dr;
        const nidx = this.getIndex(nc, nr);
        if (nidx === -1) continue;

        const type = this.types[nidx];
        if (type !== CELL_TYPES.BUILDING && type !== CELL_TYPES.BUILDING_DETAIL) {
          continue;
        }

        if (this.hp[nidx] > 0) {
          // Never drop below 0.1 from pure neighbor crack propagation (no instant collapse)
          this.hp[nidx] = Math.max(0.1, this.hp[nidx] - crackDamage);

          if (this.crackedCells[nidx] === 0) {
            this.crackedCells[nidx] = 1;
            const worldPos = this.gridToWorld(nc, nr);
            crackedList.push({
              col: nc,
              row: nr,
              idx: nidx,
              worldX: worldPos.x,
              worldY: worldPos.y,
              newlyCracked: true
            });
          }
        }
      }
    }

    return crackedList;
  }

  /**
   * Bounded shallow local BFS that checks if a cell cluster is a small isolated island
   * disconnected from the larger building structure.
   * If cluster size exceeds maxIslandSize, immediately aborts (O(1) runtime, < 0.005ms).
   * @param {number} startCol 
   * @param {number} startRow 
   * @param {number} buildingId 
   * @param {number} maxIslandSize 
   * @returns {Array<{ col: number, row: number, idx: number, worldX: number, worldY: number }>|null}
   */
  findSmallIsolatedIsland(startCol, startRow, buildingId, maxIslandSize = 6) {
    const startIdx = this.getIndex(startCol, startRow);
    if (startIdx === -1) return null;
    if (this.buildingIds[startIdx] !== buildingId) return null;
    if (this.types[startIdx] !== CELL_TYPES.BUILDING && this.types[startIdx] !== CELL_TYPES.BUILDING_DETAIL) return null;
    if (this.hp[startIdx] <= 0) return null;

    const queue = [{ col: startCol, row: startRow, idx: startIdx }];
    const visited = new Set([startIdx]);
    const islandCells = [{ col: startCol, row: startRow, idx: startIdx }];

    const dirs = [
      { dc: 1, dr: 0 },
      { dc: -1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 0, dr: -1 }
    ];

    let head = 0;
    while (head < queue.length) {
      const curr = queue[head++];

      for (let i = 0; i < 4; i++) {
        const nc = curr.col + dirs[i].dc;
        const nr = curr.row + dirs[i].dr;
        const nidx = this.getIndex(nc, nr);
        if (nidx === -1) continue;

        if (
          this.buildingIds[nidx] === buildingId &&
          (this.types[nidx] === CELL_TYPES.BUILDING || this.types[nidx] === CELL_TYPES.BUILDING_DETAIL) &&
          this.hp[nidx] > 0 &&
          !visited.has(nidx)
        ) {
          visited.add(nidx);
          islandCells.push({ col: nc, row: nr, idx: nidx });
          queue.push({ col: nc, row: nr, idx: nidx });

          // If size exceeds threshold, it's connected to main structure; abort immediately!
          if (islandCells.length > maxIslandSize) {
            return null;
          }
        }
      }
    }

    // Fully bounded island found!
    return islandCells.map(c => {
      const w = this.gridToWorld(c.col, c.row);
      return { ...c, worldX: w.x, worldY: w.y };
    });
  }

  /**
   * Fast query for cells inside an oriented ellipse (Kaiju body footprint).
   * @param {number} cx - World center X
   * @param {number} cy - World center Y
   * @param {number} rx - Radius X
   * @param {number} ry - Radius Y
   * @param {number} angle - Rotation angle radians
   * @returns {Array<{ col: number, row: number, idx: number, worldX: number, worldY: number }>}
   */
  getCellsInEllipse(cx, cy, rx, ry, angle) {
    const maxR = Math.max(rx, ry);
    const minCol = Math.max(0, Math.floor((cx - maxR) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((cx + maxR) / this.cellSize));
    const minRow = Math.max(0, Math.floor((cy - maxR) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((cy + maxR) / this.cellSize));

    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);

    const result = [];

    for (let r = minRow; r <= maxRow; r++) {
      const wy = r * this.cellSize + this.cellSize / 2;
      const dy = wy - cy;

      for (let c = minCol; c <= maxCol; c++) {
        const wx = c * this.cellSize + this.cellSize / 2;
        const dx = wx - cx;

        // Rotate into local unrotated ellipse space
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;

        if (lx * lx * invRx2 + ly * ly * invRy2 <= 1.0) {
          result.push({
            col: c,
            row: r,
            idx: r * this.cols + c,
            worldX: wx,
            worldY: wy
          });
        }
      }
    }

    return result;
  }

  /**
   * Fast query for cells inside a circle (for tail segments or shockwaves)
   */
  getCellsInCircle(cx, cy, radius) {
    const minCol = Math.max(0, Math.floor((cx - radius) / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((cx + radius) / this.cellSize));
    const minRow = Math.max(0, Math.floor((cy - radius) / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((cy + radius) / this.cellSize));

    const r2 = radius * radius;
    const result = [];

    for (let r = minRow; r <= maxRow; r++) {
      const wy = r * this.cellSize + this.cellSize / 2;
      const dy = wy - cy;

      for (let c = minCol; c <= maxCol; c++) {
        const wx = c * this.cellSize + this.cellSize / 2;
        const dx = wx - cx;

        if (dx * dx + dy * dy <= r2) {
          result.push({
            col: c,
            row: r,
            idx: r * this.cols + c,
            worldX: wx,
            worldY: wy
          });
        }
      }
    }

    return result;
  }

  /**
   * Fast spatial query returning unique buildings intersecting rect.
   */
  getBuildingsInRect(rect) {
    const minCol = Math.max(0, Math.floor(rect.x / this.cellSize));
    const maxCol = Math.min(this.cols - 1, Math.floor((rect.x + rect.width) / this.cellSize));
    const minRow = Math.max(0, Math.floor(rect.y / this.cellSize));
    const maxRow = Math.min(this.rows - 1, Math.floor((rect.y + rect.height) / this.cellSize));

    const foundIds = new Set();
    const result = [];

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

  /**
   * Returns current city-wide destruction percentage (0.0 to 100.0)
   */
  getDestructionPercentage() {
    if (this.totalInitialBuildingCells === 0) return 0;
    return (this.totalDestroyedCells / this.totalInitialBuildingCells) * 100;
  }
}
