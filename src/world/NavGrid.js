import { CELL_TYPES } from './CityGrid.js';
import { WORLD_CONFIG } from '../config/world.js';

/**
 * NavGrid - Tahap 3A-2
 * High-performance 8x8 px navigation & flow field system for city-wide enemy pathfinding.
 * Features:
 * - Dual Walkability Grids:
 *   1. walkableInfantry (pedestrians & police can squeeze through tight alleys & rubble)
 *   2. walkableVehicle (inflated 1-cell buffer so tanks & cruisers never scrape walls)
 * - Incremental dirty updates when building cells are crushed into rubble
 * - Local BFS Flow Field (computed in ~0.3ms every 0.3s within 1.5x camera radius)
 * - Wall collision resolution & sliding mechanics
 */
export class NavGrid {
  /**
   * @param {Object} cityGrid - CityGrid instance (4x4 px cells)
   * @param {number} worldWidth 
   * @param {number} worldHeight 
   * @param {number} cellSize - 8 px navigation cell size
   */
  constructor(cityGrid, worldWidth = WORLD_CONFIG.worldWidth, worldHeight = WORLD_CONFIG.worldHeight, cellSize = 8) {
    this.cityGrid = cityGrid;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.cellSize = cellSize; // 8 px

    this.cols = Math.floor(worldWidth / cellSize); // 500
    this.rows = Math.floor(worldHeight / cellSize); // 500
    this.totalCells = this.cols * this.rows; // 250,000

    // 1. Walkability Typed Arrays (1 = Walkable, 0 = Blocked)
    this.walkableInfantry = new Uint8Array(this.totalCells);
    this.walkableVehicle = new Uint8Array(this.totalCells); // Inflated grid

    // 2. Flow Field Vector Arrays (Direction towards Kaiju)
    this.flowInfantryX = new Float32Array(this.totalCells);
    this.flowInfantryY = new Float32Array(this.totalCells);
    this.flowVehicleX = new Float32Array(this.totalCells);
    this.flowVehicleY = new Float32Array(this.totalCells);

    // 3. BFS Working Memory (Reusable to guarantee 0 GC allocations)
    this.dist = new Int16Array(this.totalCells);
    this.dist.fill(-1);
    this.queue = new Int32Array(20000);

    // 4. Dirty tracking for dynamic rubble updates
    this.dirtyCells = new Set();
    this.needsFlowFieldUpdate = true;

    // 5. Timer for throttled flow field recalculation
    this.lastKaijuNavCol = -1;
    this.lastKaijuNavRow = -1;
    this.flowUpdateTimer = 0;
    this.flowUpdateInterval = 0.30; // ~3.3 updates per second

    // Initialize initial static city walkability
    this.initFromCityGrid();
  }

  getIndex(col, row) {
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return -1;
    return row * this.cols + col;
  }

  worldToNav(x, y) {
    return {
      col: Math.max(0, Math.min(this.cols - 1, Math.floor(x / this.cellSize))),
      row: Math.max(0, Math.min(this.rows - 1, Math.floor(y / this.cellSize)))
    };
  }

  navToWorld(col, row) {
    return {
      x: col * this.cellSize + this.cellSize / 2,
      y: row * this.cellSize + this.cellSize / 2
    };
  }

  /**
   * Initializes walkability by sampling the 4x4 subcells in CityGrid.
   * Each 8x8 nav cell contains four 4x4 city cells.
   */
  initFromCityGrid() {
    const cg = this.cityGrid;
    const invCgCell = 1 / cg.cellSize; // 1 / 4 = 0.25

    for (let r = 0; r < this.rows; r++) {
      const worldY = r * this.cellSize;
      for (let c = 0; c < this.cols; c++) {
        const worldX = c * this.cellSize;
        const navIdx = r * this.cols + c;

        // World borders are blocked
        if (c <= 1 || c >= this.cols - 2 || r <= 1 || r >= this.rows - 2) {
          this.walkableInfantry[navIdx] = 0;
          continue;
        }

        // Test four 4x4 subcells
        let blocked = false;
        for (let sy = 0; sy < 2; sy++) {
          for (let sx = 0; sx < 2; sx++) {
            const subX = worldX + sx * 4;
            const subY = worldY + sy * 4;
            const sc = Math.floor(subX * invCgCell);
            const sr = Math.floor(subY * invCgCell);
            const sIdx = sr * cg.cols + sc;

            if (sIdx >= 0 && sIdx < cg.totalCells) {
              const type = cg.types[sIdx];
              // Building with alive HP or deep water without bridge is blocked
              if (
                (type === CELL_TYPES.BUILDING || type === CELL_TYPES.BUILDING_DETAIL) &&
                cg.hp[sIdx] > 0
              ) {
                blocked = true;
                break;
              }
              if (type === CELL_TYPES.WATER) {
                blocked = true;
                break;
              }
            }
          }
          if (blocked) break;
        }

        this.walkableInfantry[navIdx] = blocked ? 0 : 1;
      }
    }

    // Build inflated grid for vehicles
    this.rebuildVehicleGrid();
  }

  /**
   * Generates the inflated grid for tanks & vehicles (requires 1-cell clearance from obstacles).
   */
  rebuildVehicleGrid() {
    const cols = this.cols;
    const rows = this.rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const idx = r * cols + c;

        if (this.walkableInfantry[idx] === 0) {
          this.walkableVehicle[idx] = 0;
          continue;
        }

        // Must have all 8 immediate neighbors walkable for vehicle clearance
        let clear = true;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nc = c + dc;
            const nr = r + dr;
            if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) {
              clear = false;
              break;
            }
            if (this.walkableInfantry[nr * cols + nc] === 0) {
              clear = false;
              break;
            }
          }
          if (!clear) break;
        }

        this.walkableVehicle[idx] = clear ? 1 : 0;
      }
    }
  }

  /**
   * Marks a world coordinate as dirty when a building cell is crushed into rubble.
   * @param {number} worldX 
   * @param {number} worldY 
   */
  markDirtyCell(worldX, worldY) {
    const col = Math.floor(worldX / this.cellSize);
    const row = Math.floor(worldY / this.cellSize);
    if (col >= 0 && col < this.cols && row >= 0 && row < this.rows) {
      this.dirtyCells.add(row * this.cols + col);
    }
  }

  /**
   * Flushes dirty updates once per frame.
   * Re-evaluates walkability so newly razed buildings immediately become new shortcuts for enemies!
   */
  flushDirtyUpdates() {
    if (this.dirtyCells.size === 0) return;

    const cg = this.cityGrid;
    const invCgCell = 1 / cg.cellSize;
    const cols = this.cols;
    const rows = this.rows;
    const vehicleCheckSet = new Set();

    for (const navIdx of this.dirtyCells) {
      const r = Math.floor(navIdx / cols);
      const c = navIdx % cols;
      const worldX = c * this.cellSize;
      const worldY = r * this.cellSize;

      // World border edge checks
      if (c <= 1 || c >= cols - 2 || r <= 1 || r >= rows - 2) {
        this.walkableInfantry[navIdx] = 0;
        continue;
      }

      // Re-evaluate subcells
      let blocked = false;
      for (let sy = 0; sy < 2; sy++) {
        for (let sx = 0; sx < 2; sx++) {
          const subX = worldX + sx * 4;
          const subY = worldY + sy * 4;
          const sc = Math.floor(subX * invCgCell);
          const sr = Math.floor(subY * invCgCell);
          const sIdx = sr * cg.cols + sc;

          if (sIdx >= 0 && sIdx < cg.totalCells) {
            const type = cg.types[sIdx];
            if (
              (type === CELL_TYPES.BUILDING || type === CELL_TYPES.BUILDING_DETAIL) &&
              cg.hp[sIdx] > 0
            ) {
              blocked = true;
              break;
            }
            if (type === CELL_TYPES.WATER) {
              blocked = true;
              break;
            }
          }
        }
        if (blocked) break;
      }

      const prevWalkable = this.walkableInfantry[navIdx];
      const newWalkable = blocked ? 0 : 1;
      this.walkableInfantry[navIdx] = newWalkable;

      if (prevWalkable !== newWalkable) {
        this.needsFlowFieldUpdate = true;
        // Schedule neighborhood for vehicle grid update
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nc = c + dc;
            const nr = r + dr;
            if (nc >= 0 && nc < cols && nr >= 0 && nr < rows) {
              vehicleCheckSet.add(nr * cols + nc);
            }
          }
        }
      }
    }

    // Refresh affected vehicle cells
    for (const vIdx of vehicleCheckSet) {
      const vr = Math.floor(vIdx / cols);
      const vc = vIdx % cols;

      if (this.walkableInfantry[vIdx] === 0) {
        this.walkableVehicle[vIdx] = 0;
        continue;
      }

      let clear = true;
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nc = vc + dc;
          const nr = vr + dr;
          if (nc < 0 || nc >= cols || nr < 0 || nr >= rows || this.walkableInfantry[nr * cols + nc] === 0) {
            clear = false;
            break;
          }
        }
        if (!clear) break;
      }

      this.walkableVehicle[vIdx] = clear ? 1 : 0;
    }

    this.dirtyCells.clear();
  }

  /**
   * Computes the flow field BFS from Kaiju center within active radius (~450 px / 56 cells).
   * Runs in ~0.3ms every 0.3s when Kaiju moves or buildings are destroyed.
   * @param {number} kx - Kaiju world X
   * @param {number} ky - Kaiju world Y
   * @param {number} dt 
   */
  updateFlowField(kx, ky, dt) {
    this.flowUpdateTimer += dt;
    const targetNav = this.worldToNav(kx, ky);

    const kaijuMovedCell = targetNav.col !== this.lastKaijuNavCol || targetNav.row !== this.lastKaijuNavRow;
    if (this.flowUpdateTimer < this.flowUpdateInterval && !kaijuMovedCell && !this.needsFlowFieldUpdate) {
      return;
    }

    this.flowUpdateTimer = 0;
    this.needsFlowFieldUpdate = false;
    this.lastKaijuNavCol = targetNav.col;
    this.lastKaijuNavRow = targetNav.row;

    // Radius in nav cells (approx 450 px / 8 = 56 cells)
    const radiusCells = 56;
    const minCol = Math.max(1, targetNav.col - radiusCells);
    const maxCol = Math.min(this.cols - 2, targetNav.col + radiusCells);
    const minRow = Math.max(1, targetNav.row - radiusCells);
    const maxRow = Math.min(this.rows - 2, targetNav.row + radiusCells);

    // Compute Flow Field for Infantry
    this.computeBFSFlow(
      targetNav.col,
      targetNav.row,
      minCol,
      maxCol,
      minRow,
      maxRow,
      this.walkableInfantry,
      this.flowInfantryX,
      this.flowInfantryY
    );

    // Compute Flow Field for Vehicles (Tanks & Cruisers)
    this.computeBFSFlow(
      targetNav.col,
      targetNav.row,
      minCol,
      maxCol,
      minRow,
      maxRow,
      this.walkableVehicle,
      this.flowVehicleX,
      this.flowVehicleY
    );
  }

  /**
   * Core BFS Dijkstra wave across the active bounding box.
   */
  computeBFSFlow(centerCol, centerRow, minCol, maxCol, minRow, maxRow, walkableGrid, flowX, flowY) {
    const cols = this.cols;
    const dist = this.dist;
    const queue = this.queue;

    // 1. Reset distance in local bounding box
    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * cols;
      for (let c = minCol; c <= maxCol; c++) {
        dist[rowOffset + c] = -1;
      }
    }

    // 2. Find closest walkable target cell for Kaiju
    let startCol = centerCol;
    let startRow = centerRow;
    let startIdx = startRow * cols + startCol;

    if (walkableGrid[startIdx] === 0) {
      // Find nearest walkable neighbor
      let found = false;
      for (let r = 1; r <= 4 && !found; r++) {
        for (let dr = -r; dr <= r && !found; dr++) {
          for (let dc = -r; dc <= r && !found; dc++) {
            const tc = startCol + dc;
            const tr = startRow + dr;
            if (tc >= minCol && tc <= maxCol && tr >= minRow && tr <= maxRow) {
              const tidx = tr * cols + tc;
              if (walkableGrid[tidx] === 1) {
                startCol = tc;
                startRow = tr;
                startIdx = tidx;
                found = true;
              }
            }
          }
        }
      }
      if (!found) return; // Completely blocked
    }

    // 3. Run Breadth-First Search
    let head = 0;
    let tail = 0;

    dist[startIdx] = 0;
    queue[tail++] = startIdx;

    // 8-direction neighbor offsets (orthogonal cost 10, diagonal cost 14)
    const dirs = [
      { dc: 1, dr: 0, cost: 10 },
      { dc: -1, dr: 0, cost: 10 },
      { dc: 0, dr: 1, cost: 10 },
      { dc: 0, dr: -1, cost: 10 },
      { dc: 1, dr: 1, cost: 14 },
      { dc: -1, dr: 1, cost: 14 },
      { dc: 1, dr: -1, cost: 14 },
      { dc: -1, dr: -1, cost: 14 }
    ];

    while (head < tail) {
      const currIdx = queue[head++];
      const currRow = Math.floor(currIdx / cols);
      const currCol = currIdx % cols;
      const currDist = dist[currIdx];

      for (let d = 0; d < 8; d++) {
        const nc = currCol + dirs[d].dc;
        const nr = currRow + dirs[d].dr;

        if (nc < minCol || nc > maxCol || nr < minRow || nr > maxRow) continue;

        const nIdx = nr * cols + nc;
        if (walkableGrid[nIdx] === 0) continue;

        const nextDist = currDist + dirs[d].cost;
        if (dist[nIdx] === -1 || nextDist < dist[nIdx]) {
          dist[nIdx] = nextDist;
          if (tail < queue.length) {
            queue[tail++] = nIdx;
          }
        }
      }
    }

    // 4. Calculate Gradient Vector (Direction to best neighbor)
    for (let r = minRow; r <= maxRow; r++) {
      const rowOffset = r * cols;
      for (let c = minCol; c <= maxCol; c++) {
        const idx = rowOffset + c;

        if (idx === startIdx) {
          flowX[idx] = 0;
          flowY[idx] = 0;
          continue;
        }

        const myDist = dist[idx];
        if (myDist <= 0) {
          flowX[idx] = 0;
          flowY[idx] = 0;
          continue;
        }

        let bestDist = myDist;
        let bestDc = 0;
        let bestDr = 0;

        for (let d = 0; d < 8; d++) {
          const nc = c + dirs[d].dc;
          const nr = r + dirs[d].dr;
          if (nc < minCol || nc > maxCol || nr < minRow || nr > maxRow) continue;

          const nIdx = nr * cols + nc;
          const nd = dist[nIdx];
          if (nd !== -1 && nd < bestDist) {
            bestDist = nd;
            bestDc = dirs[d].dc;
            bestDr = dirs[d].dr;
          }
        }

        if (bestDc !== 0 || bestDr !== 0) {
          const len = Math.hypot(bestDc, bestDr);
          flowX[idx] = bestDc / len;
          flowY[idx] = bestDr / len;
        } else {
          flowX[idx] = 0;
          flowY[idx] = 0;
        }
      }
    }
  }

  /**
   * Samples infantry flow vector at world position (x, y)
   * @param {number} x 
   * @param {number} y 
   * @returns {{ x: number, y: number }}
   */
  getInfantryFlow(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return { x: 0, y: 0 };
    }
    const idx = row * this.cols + col;
    return { x: this.flowInfantryX[idx], y: this.flowInfantryY[idx] };
  }

  /**
   * Samples vehicle flow vector at world position (x, y)
   * @param {number} x 
   * @param {number} y 
   * @returns {{ x: number, y: number }}
   */
  getVehicleFlow(x, y) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) {
      return { x: 0, y: 0 };
    }
    const idx = row * this.cols + col;
    // Fall back to infantry flow if vehicle grid has no path in narrow corner
    if (this.flowVehicleX[idx] === 0 && this.flowVehicleY[idx] === 0) {
      return { x: this.flowInfantryX[idx], y: this.flowInfantryY[idx] };
    }
    return { x: this.flowVehicleX[idx], y: this.flowVehicleY[idx] };
  }

  /**
   * Tests if a world coordinate is walkable.
   * @param {number} x 
   * @param {number} y 
   * @param {boolean} isVehicle 
   */
  isWalkable(x, y, isVehicle = false) {
    const col = Math.floor(x / this.cellSize);
    const row = Math.floor(y / this.cellSize);
    if (col < 0 || col >= this.cols || row < 0 || row >= this.rows) return false;
    const idx = row * this.cols + col;
    return isVehicle ? this.walkableVehicle[idx] === 1 : this.walkableInfantry[idx] === 1;
  }

  /**
   * Resolves collision and slides along walls so entities never clip into intact buildings.
   * @param {number} x - Current X
   * @param {number} y - Current Y
   * @param {number} vx - Velocity X
   * @param {number} vy - Velocity Y
   * @param {number} dt - Frame delta
   * @param {boolean} isVehicle 
   * @returns {{ x: number, y: number, vx: number, vy: number }}
   */
  resolveMovement(x, y, vx, vy, dt, isVehicle = false) {
    const grid = isVehicle ? this.walkableVehicle : this.walkableInfantry;
    const invCell = 1 / this.cellSize;
    const cols = this.cols;
    const rows = this.rows;

    const nextX = x + vx * dt;
    const nextY = y + vy * dt;

    const currentC = Math.max(0, Math.min(cols - 1, Math.floor(x * invCell)));
    const currentR = Math.max(0, Math.min(rows - 1, Math.floor(y * invCell)));

    const nextC = Math.max(0, Math.min(cols - 1, Math.floor(nextX * invCell)));
    const nextR = Math.max(0, Math.min(rows - 1, Math.floor(nextY * invCell)));

    // 1. If destination cell is fully walkable, allow full movement
    if (grid[nextR * cols + nextC] === 1) {
      return { x: nextX, y: nextY, vx, vy };
    }

    // 2. Otherwise try sliding along X axis
    const canMoveX = grid[currentR * cols + nextC] === 1;
    // Try sliding along Y axis
    const canMoveY = grid[nextR * cols + currentC] === 1;

    let resX = x;
    let resY = y;
    let resVx = vx;
    let resVy = vy;

    if (canMoveX) {
      resX = nextX;
      resVy = 0; // Blocked in Y, slide on X
    } else if (canMoveY) {
      resY = nextY;
      resVx = 0; // Blocked in X, slide on Y
    } else {
      // Corner collision: stop movement
      resVx = 0;
      resVy = 0;
    }

    return { x: resX, y: resY, vx: resVx, vy: resVy };
  }
}
