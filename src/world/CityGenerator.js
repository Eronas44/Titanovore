import { PALETTE } from '../config/palette.js';
import { WORLD_CONFIG } from '../config/world.js';
import { PRNG } from '../utils/prng.js';
import { CELL_TYPES } from './CityGrid.js';

/**
 * Procedural City Generator
 * Generates the road grid, zonation, blocks, buildings, parks, parking lots, and rooftop details.
 */
export class CityGenerator {
  constructor(seed = WORLD_CONFIG.seed) {
    this.seed = seed;
    this.prng = new PRNG(seed);

    // World geometry
    this.worldWidth = WORLD_CONFIG.worldWidth;
    this.worldHeight = WORLD_CONFIG.worldHeight;
    this.center = { x: this.worldWidth / 2, y: this.worldHeight / 2 };

    // Generated structural data
    this.roads = []; // { x, y, width, height, isAvenue, isHorizontal }
    this.blocks = []; // { x, y, width, height, zone }
    this.buildings = [];
    this.parks = [];
    this.parkingLots = [];
    this.roadLanes = []; // Centerlines for traffic/pedestrian navigation
  }

  /**
   * Generates the complete procedural city and populates the CityGrid.
   * @param {import('./CityGrid.js').CityGrid} cityGrid 
   */
  generate(cityGrid) {
    this.prng.reset(this.seed);

    this.generateRoadNetwork();
    this.generateBlocks();
    this.populateBlocks(cityGrid);

    return {
      roads: this.roads,
      blocks: this.blocks,
      buildings: this.buildings,
      parks: this.parks,
      parkingLots: this.parkingLots,
      roadLanes: this.roadLanes
    };
  }

  /**
   * Generates hierarchical road grid (Avenues & Secondary Streets)
   */
  generateRoadNetwork() {
    const { mainAvenueSpacing, secondaryStreetSpacing, avenueWidth, streetWidth } = WORLD_CONFIG;

    // Generate Vertical Road coordinates
    const vRoads = [];
    let x = 120;
    while (x < this.worldWidth - 100) {
      const isAvenue = Math.abs(x % mainAvenueSpacing) < 80;
      const width = isAvenue ? avenueWidth : streetWidth;
      vRoads.push({ x: x - width / 2, width, isAvenue });
      x += isAvenue ? (secondaryStreetSpacing + 10) : (secondaryStreetSpacing + this.prng.rangeInt(-15, 15));
    }

    // Generate Horizontal Road coordinates
    const hRoads = [];
    let y = 120;
    while (y < this.worldHeight - 100) {
      const isAvenue = Math.abs(y % mainAvenueSpacing) < 80;
      const height = isAvenue ? avenueWidth : streetWidth;
      hRoads.push({ y: y - height / 2, height, isAvenue });
      y += isAvenue ? (secondaryStreetSpacing + 10) : (secondaryStreetSpacing + this.prng.rangeInt(-15, 15));
    }

    // Build Road entries & Navigation lanes
    vRoads.forEach(vr => {
      this.roads.push({
        x: vr.x,
        y: 0,
        width: vr.width,
        height: this.worldHeight,
        isAvenue: vr.isAvenue,
        isHorizontal: false
      });
      this.roadLanes.push({
        x: vr.x + vr.width / 2,
        y1: 0,
        y2: this.worldHeight,
        isHorizontal: false,
        width: vr.width
      });
    });

    hRoads.forEach(hr => {
      this.roads.push({
        x: 0,
        y: hr.y,
        width: this.worldWidth,
        height: hr.height,
        isAvenue: hr.isAvenue,
        isHorizontal: true
      });
      this.roadLanes.push({
        y: hr.y + hr.height / 2,
        x1: 0,
        x2: this.worldWidth,
        isHorizontal: true,
        width: hr.height
      });
    });

    this.vRoads = vRoads;
    this.hRoads = hRoads;
  }

  /**
   * Partitions non-road space into city blocks
   */
  generateBlocks() {
    const sidewalk = WORLD_CONFIG.sidewalkWidth;

    for (let i = 0; i < this.vRoads.length - 1; i++) {
      const leftRoad = this.vRoads[i];
      const rightRoad = this.vRoads[i + 1];

      for (let j = 0; j < this.hRoads.length - 1; j++) {
        const topRoad = this.hRoads[j];
        const bottomRoad = this.hRoads[j + 1];

        const bx = leftRoad.x + leftRoad.width + sidewalk;
        const by = topRoad.y + topRoad.height + sidewalk;
        const bw = rightRoad.x - sidewalk - bx;
        const bh = bottomRoad.y - sidewalk - by;

        if (bw >= 32 && bh >= 32) {
          // Determine zone by distance to center
          const centerX = bx + bw / 2;
          const centerY = by + bh / 2;
          const distToCenter = Math.hypot(centerX - this.center.x, centerY - this.center.y);

          let zone = 'suburb';
          if (distToCenter < WORLD_CONFIG.downtownRadius) {
            zone = 'downtown';
          } else if (distToCenter < WORLD_CONFIG.midtownRadius) {
            zone = 'midtown';
          }

          this.blocks.push({
            id: `block_${i}_${j}`,
            x: bx,
            y: by,
            width: bw,
            height: bh,
            zone
          });
        }
      }
    }
  }

  /**
   * Fills city blocks with buildings, rooftop details, parks, and parking lots.
   */
  populateBlocks(cityGrid) {
    let buildingIdCounter = 1;

    this.blocks.forEach(block => {
      // Downtown: 92% buildings, 8% plaza/parking
      // Midtown: 70% buildings, 20% parking, 10% parks
      // Suburbs: 50% buildings (houses), 25% parks, 25% yards/empty
      const roll = this.prng.next();

      if (block.zone === 'suburb' && roll < 0.28) {
        // Create full park block
        this.createPark(block);
        return;
      }

      if (block.zone === 'midtown' && roll < 0.14) {
        this.createPark(block);
        return;
      }

      if (roll > 0.88 && block.zone !== 'downtown') {
        this.createParkingLot(block);
        return;
      }

      // Populate with buildings
      this.subdivideBlockIntoBuildings(block, cityGrid, () => buildingIdCounter++);
    });
  }

  /**
   * Subdivides a block rectangle into one or more buildings with varying shapes.
   */
  subdivideBlockIntoBuildings(block, cityGrid, nextId) {
    const { zone } = block;
    const margin = 3;

    let targetSize = 64;
    let minSize = 28;
    if (zone === 'downtown') {
      targetSize = this.prng.rangeInt(56, 92);
      minSize = 40;
    } else if (zone === 'midtown') {
      targetSize = this.prng.rangeInt(36, 60);
      minSize = 30;
    } else {
      targetSize = this.prng.rangeInt(24, 40);
      minSize = 22;
    }

    const cols = Math.max(1, Math.floor(block.width / (targetSize + margin)));
    const rows = Math.max(1, Math.floor(block.height / (targetSize + margin)));

    const slotW = (block.width - (cols + 1) * margin) / cols;
    const slotH = (block.height - (rows + 1) * margin) / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Chance to leave a gap for a small alley or yard in suburbs
        if (zone === 'suburb' && this.prng.chance(0.25) && (cols > 1 || rows > 1)) {
          continue;
        }

        const bx = Math.round(block.x + margin + c * (slotW + margin));
        const by = Math.round(block.y + margin + r * (slotH + margin));
        const bw = Math.round(slotW);
        const bh = Math.round(slotH);

        if (bw < minSize || bh < minSize) continue;

        // Shape: rectangular or L-shaped
        let shape = 'rect';
        let cutout = null;
        if (zone !== 'suburb' && bw >= 44 && bh >= 44 && this.prng.chance(0.35)) {
          shape = 'l_shape';
          const cutW = Math.round(bw * 0.45);
          const cutH = Math.round(bh * 0.45);
          // Cutout corner: top-right or bottom-right
          cutout = {
            x: bx + bw - cutW,
            y: this.prng.chance(0.5) ? by : by + bh - cutH,
            width: cutW,
            height: cutH
          };
        }

        // Color palette based on zone
        let roofColor = PALETTE.roofSuburbHex;
        let roofHighlight = PALETTE.roofSuburbHighlightHex;
        let roofDark = PALETTE.roofSuburbDarkHex;
        let shadowDepth = 6;
        let cellHp = 60;

        if (zone === 'downtown') {
          roofColor = PALETTE.roofDowntownHex;
          roofHighlight = PALETTE.roofDowntownHighlightHex;
          roofDark = PALETTE.roofDowntownDarkHex;
          shadowDepth = 12;
          cellHp = 120;
        } else if (zone === 'midtown') {
          roofColor = PALETTE.roofMidtownHex;
          roofHighlight = PALETTE.roofMidtownHighlightHex;
          roofDark = PALETTE.roofMidtownDarkHex;
          shadowDepth = 9;
          cellHp = 90;
        }

        // Rooftop details (AC, Antenna, Helipad)
        const details = [];

        // Helipad only on large downtown buildings
        if (zone === 'downtown' && bw >= 56 && bh >= 56 && shape === 'rect' && this.prng.chance(0.35)) {
          details.push({
            type: 'helipad',
            x: bx + bw / 2,
            y: by + bh / 2,
            radius: Math.min(bw, bh) * 0.26
          });
        } else {
          // AC units
          const acCount = this.prng.rangeInt(1, zone === 'downtown' ? 4 : 2);
          for (let a = 0; a < acCount; a++) {
            const acW = this.prng.rangeInt(5, 9);
            const acH = this.prng.rangeInt(4, 7);
            const acX = bx + 4 + (a * 14) % (bw - 14);
            const acY = by + 4 + Math.floor(a / 2) * 12;
            if (acX + acW < bx + bw - 3 && acY + acH < by + bh - 3) {
              details.push({ type: 'ac', x: acX, y: acY, width: acW, height: acH });
            }
          }

          // Antenna
          if (this.prng.chance(0.4)) {
            details.push({
              type: 'antenna',
              x: bx + bw - 7,
              y: by + 7
            });
          }
        }

        const building = {
          id: nextId(),
          x: bx,
          y: by,
          width: bw,
          height: bh,
          shape,
          cutout,
          zone,
          roofColor,
          roofHighlight,
          roofDark,
          shadowDepth,
          cellHp,
          details
        };

        this.buildings.push(building);
        cityGrid.registerBuilding(building);
      }
    }
  }

  /**
   * Generates a park with grass and tree clusters
   */
  createPark(block) {
    const trees = [];
    const treeSpacing = 16;
    const cols = Math.floor((block.width - 10) / treeSpacing);
    const rows = Math.floor((block.height - 10) / treeSpacing);

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (this.prng.chance(0.55)) {
          trees.push({
            x: block.x + 6 + c * treeSpacing + this.prng.range(-3, 3),
            y: block.y + 6 + r * treeSpacing + this.prng.range(-3, 3),
            radius: this.prng.range(4, 7)
          });
        }
      }
    }

    this.parks.push({
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      trees
    });
  }

  /**
   * Generates a parking lot with parking slot divider stripes
   */
  createParkingLot(block) {
    const bays = [];
    const bayW = 10;
    const bayH = 16;
    const cols = Math.floor((block.width - 8) / (bayW + 2));

    for (let c = 0; c < cols; c++) {
      bays.push({
        x: block.x + 4 + c * (bayW + 2),
        y: block.y + 4,
        width: bayW,
        height: bayH
      });
    }

    this.parkingLots.push({
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      bays
    });
  }
}
