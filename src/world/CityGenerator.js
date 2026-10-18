import { PALETTE } from '../config/palette.js';
import { WORLD_CONFIG } from '../config/world.js';
import { PRNG } from '../utils/prng.js';
import { CELL_TYPES } from './CityGrid.js';

/**
 * Procedural City Generator - Tahap 2A
 * Generates an authentic, atmospheric urban landscape:
 * - Varied roof styles (gabled with ridge line, stepped skyscrapers, green roofs, flat ACs, warehouses)
 * - Diverse color palettes (terracotta, concrete, teal patina, beige, moss green, wood, asphalt, steel blue)
 * - Districts / Zonations (Downtown, Residential, Commercial, Industrial, Park & Canal)
 * - Canal with bridges
 * - Street life: sidewalks, zebra crossings, street trees, street lamps with warm pools, parked cars, bus stops
 */
export class CityGenerator {
  constructor(seed = WORLD_CONFIG.seed) {
    this.seed = seed;
    this.prng = new PRNG(seed);

    this.worldWidth = WORLD_CONFIG.worldWidth;
    this.worldHeight = WORLD_CONFIG.worldHeight;
    this.center = { x: this.worldWidth / 2, y: this.worldHeight / 2 };

    // Generated structural collections
    this.canal = null; // Canal centerline points & bridges
    this.roads = [];
    this.vRoads = [];
    this.hRoads = [];
    this.intersections = [];
    this.zebraCrossings = [];
    this.bridges = [];
    this.streetLamps = [];
    this.streetTrees = [];
    this.parkedCars = [];
    this.blocks = [];
    this.buildings = [];
    this.parks = [];
    this.parkingLots = [];
    this.industrialYards = [];
    this.roadLanes = [];
    this.sidewalkPaths = []; // Navigable paths for pedestrians
  }

  generate(cityGrid) {
    this.prng.reset(this.seed);

    this.generateCanal(cityGrid);
    this.generateRoadNetwork(cityGrid);
    this.generateStreetLife();
    this.generateBlocks();
    this.populateBlocks(cityGrid);

    return {
      canal: this.canal,
      bridges: this.bridges,
      roads: this.roads,
      intersections: this.intersections,
      zebraCrossings: this.zebraCrossings,
      streetLamps: this.streetLamps,
      streetTrees: this.streetTrees,
      parkedCars: this.parkedCars,
      blocks: this.blocks,
      buildings: this.buildings,
      parks: this.parks,
      parkingLots: this.parkingLots,
      industrialYards: this.industrialYards,
      roadLanes: this.roadLanes,
      sidewalkPaths: this.sidewalkPaths
    };
  }

  /**
   * Generates a scenic winding canal with stone banks crossing the city
   */
  generateCanal(cityGrid) {
    const width = WORLD_CONFIG.canalWidth;
    const bankWidth = WORLD_CONFIG.canalBankWidth;
    const points = [];

    // Spline-like control points from top-right towards bottom-left
    const startX = 2400;
    const endX = 1300;
    const steps = 20;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const y = t * this.worldHeight;
      const wave = Math.sin(t * Math.PI * 3) * 160 + Math.cos(t * Math.PI * 2) * 80;
      const x = startX + (endX - startX) * t + wave;
      points.push({ x, y });
    }

    this.canal = {
      points,
      width,
      bankWidth,
      totalWidth: width + bankWidth * 2
    };

    // Mark water cells into grid
    const minX = Math.min(...points.map(p => p.x)) - width;
    const maxX = Math.max(...points.map(p => p.x)) + width;
    for (let r = 0; r < cityGrid.rows; r++) {
      const y = r * cityGrid.cellSize;
      const cx = this.getCanalXAt(y);
      if (cx !== null) {
        const leftCol = Math.max(0, Math.floor((cx - width / 2) / cityGrid.cellSize));
        const rightCol = Math.min(cityGrid.cols - 1, Math.floor((cx + width / 2) / cityGrid.cellSize));
        for (let c = leftCol; c <= rightCol; c++) {
          cityGrid.setCell(c, r, CELL_TYPES.WATER, 0, 0);
        }
      }
    }
  }

  getCanalXAt(y) {
    if (!this.canal || !this.canal.points) return null;
    const pts = this.canal.points;
    const total = pts.length;
    const stepY = this.worldHeight / (total - 1);
    const idx = Math.min(total - 2, Math.max(0, Math.floor(y / stepY)));
    const frac = (y - idx * stepY) / stepY;
    const p1 = pts[idx];
    const p2 = pts[idx + 1];
    return p1.x + (p2.x - p1.x) * frac;
  }

  isPointInCanal(x, y, margin = 0) {
    const cx = this.getCanalXAt(y);
    if (cx === null) return false;
    const halfW = (this.canal.width + this.canal.bankWidth * 2) / 2 + margin;
    return Math.abs(x - cx) <= halfW;
  }

  /**
   * Generates hierarchical road grid (Avenues & Secondary Streets)
   */
  generateRoadNetwork(cityGrid) {
    const { mainAvenueSpacing, secondaryStreetSpacing, avenueWidth, streetWidth } = WORLD_CONFIG;

    // Vertical Roads coordinates
    const vRoads = [];
    let x = 140;
    while (x < this.worldWidth - 120) {
      const isAvenue = Math.abs(x % mainAvenueSpacing) < 80;
      const width = isAvenue ? avenueWidth : streetWidth;
      vRoads.push({ x: x - width / 2, width, isAvenue });
      x += isAvenue ? (secondaryStreetSpacing + 12) : (secondaryStreetSpacing + this.prng.rangeInt(-12, 12));
    }

    // Horizontal Roads coordinates
    const hRoads = [];
    let y = 140;
    while (y < this.worldHeight - 120) {
      const isAvenue = Math.abs(y % mainAvenueSpacing) < 80;
      const height = isAvenue ? avenueWidth : streetWidth;
      hRoads.push({ y: y - height / 2, height, isAvenue });
      y += isAvenue ? (secondaryStreetSpacing + 12) : (secondaryStreetSpacing + this.prng.rangeInt(-12, 12));
    }

    this.vRoads = vRoads;
    this.hRoads = hRoads;

    // Build Road entries
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

    // Detect Canal Bridges (where roads intersect canal)
    const canalW = this.canal.width + this.canal.bankWidth * 2;
    hRoads.forEach(hr => {
      const cy = hr.y + hr.height / 2;
      const cx = this.getCanalXAt(cy);
      if (cx !== null) {
        this.bridges.push({
          x: cx - canalW / 2 - 6,
          y: hr.y - 2,
          width: canalW + 12,
          height: hr.height + 4,
          isHorizontal: true
        });
      }
    });

    vRoads.forEach(vr => {
      const cx = vr.x + vr.width / 2;
      for (let y = 0; y < this.worldHeight; y += 40) {
        const canalX = this.getCanalXAt(y);
        if (canalX !== null && Math.abs(cx - canalX) < vr.width / 2 + 10) {
          this.bridges.push({
            x: vr.x - 2,
            y: y - 20,
            width: vr.width + 4,
            height: 40,
            isHorizontal: false
          });
          break;
        }
      }
    });

    // Generate Intersections & Zebra Crossings
    vRoads.forEach(vr => {
      hRoads.forEach(hr => {
        const ix = vr.x;
        const iy = hr.y;
        const iw = vr.width;
        const ih = hr.height;

        this.intersections.push({
          x: ix,
          y: iy,
          width: iw,
          height: ih,
          trafficLight: this.prng.chance(0.65)
        });

        // 4 Zebra Crossings around intersection
        const zw = WORLD_CONFIG.zebraCrossWidth;
        // North approach
        this.zebraCrossings.push({
          x: ix,
          y: iy - zw - 1,
          width: iw,
          height: zw,
          isHorizontal: true
        });
        // South approach
        this.zebraCrossings.push({
          x: ix,
          y: iy + ih + 1,
          width: iw,
          height: zw,
          isHorizontal: true
        });
        // West approach
        this.zebraCrossings.push({
          x: ix - zw - 1,
          y: iy,
          width: zw,
          height: ih,
          isHorizontal: false
        });
        // East approach
        this.zebraCrossings.push({
          x: ix + iw + 1,
          y: iy,
          width: zw,
          height: ih,
          isHorizontal: false
        });
      });
    });
  }

  /**
   * Generates street lamps with warm ambient light pools, street trees, parked cars, and bus stops
   */
  generateStreetLife() {
    const sw = WORLD_CONFIG.sidewalkWidth;
    const { streetLampSpacing, streetTreeSpacing } = WORLD_CONFIG;

    // Place street lamps and street trees along road sidewalks
    this.vRoads.forEach(vr => {
      const leftCurbX = vr.x - sw / 2;
      const rightCurbX = vr.x + vr.width + sw / 2;

      for (let y = 40; y < this.worldHeight - 40; y += streetTreeSpacing) {
        // Skip intersections
        if (this.hRoads.some(hr => Math.abs(y - (hr.y + hr.height / 2)) < hr.height + 20)) continue;
        if (this.isPointInCanal(vr.x, y, 20)) continue;

        // Street Trees
        if (this.prng.chance(0.55)) {
          this.streetTrees.push({
            x: this.prng.chance(0.5) ? leftCurbX : rightCurbX,
            y,
            radius: this.prng.range(3.5, 5.5)
          });
        }

        // Parked Cars along curb
        if (this.prng.chance(WORLD_CONFIG.parallelParkedCarChance)) {
          const side = this.prng.chance(0.5);
          this.parkedCars.push({
            x: side ? vr.x + 4 : vr.x + vr.width - 4,
            y,
            rotation: Math.PI / 2,
            colorIdx: this.prng.rangeInt(0, PALETTE.carBodies.length - 1)
          });
        }
      }

      // Street Lamps
      for (let y = 60; y < this.worldHeight - 60; y += streetLampSpacing) {
        if (this.hRoads.some(hr => Math.abs(y - (hr.y + hr.height / 2)) < hr.height + 15)) continue;
        if (this.isPointInCanal(vr.x, y, 20)) continue;

        this.streetLamps.push({
          x: leftCurbX,
          y,
          radius: WORLD_CONFIG.streetLightRadius
        });
        this.streetLamps.push({
          x: rightCurbX,
          y: y + streetLampSpacing / 2,
          radius: WORLD_CONFIG.streetLightRadius
        });
      }
    });

    // Horizontal roads street lamps & parked cars
    this.hRoads.forEach(hr => {
      const topCurbY = hr.y - sw / 2;
      const bottomCurbY = hr.y + hr.height + sw / 2;

      for (let x = 40; x < this.worldWidth - 40; x += streetTreeSpacing) {
        if (this.vRoads.some(vr => Math.abs(x - (vr.x + vr.width / 2)) < vr.width + 20)) continue;
        if (this.isPointInCanal(x, hr.y, 20)) continue;

        if (this.prng.chance(0.45)) {
          this.streetTrees.push({
            x,
            y: this.prng.chance(0.5) ? topCurbY : bottomCurbY,
            radius: this.prng.range(3.5, 5.5)
          });
        }

        if (this.prng.chance(WORLD_CONFIG.parallelParkedCarChance)) {
          const side = this.prng.chance(0.5);
          this.parkedCars.push({
            x,
            y: side ? hr.y + 4 : hr.y + hr.height - 4,
            rotation: 0,
            colorIdx: this.prng.rangeInt(0, PALETTE.carBodies.length - 1)
          });
        }
      }

      for (let x = 60; x < this.worldWidth - 60; x += streetLampSpacing) {
        if (this.vRoads.some(vr => Math.abs(x - (vr.x + vr.width / 2)) < vr.width + 15)) continue;
        if (this.isPointInCanal(x, hr.y, 20)) continue;

        this.streetLamps.push({
          x,
          y: topCurbY,
          radius: WORLD_CONFIG.streetLightRadius
        });
      }
    });
  }

  /**
   * Partitions non-road space into smaller, denser city blocks with designated zonations
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

        if (bw >= 24 && bh >= 24) {
          const centerX = bx + bw / 2;
          const centerY = by + bh / 2;
          const distToCenter = Math.hypot(centerX - this.center.x, centerY - this.center.y);

          // Determine district / zonation
          let zone = 'residential';

          // Check if block intersects the canal
          const inCanal = this.isPointInCanal(centerX, centerY, 30);
          if (inCanal) {
            zone = 'park'; // Waterfront park alongside canal
          } else if (distToCenter < WORLD_CONFIG.downtownRadius) {
            zone = 'downtown';
          } else if (centerX > 2100 && centerY > 2000) {
            // Southeast sector: Industrial district
            zone = 'industrial';
          } else if (distToCenter < WORLD_CONFIG.commercialRadius) {
            // Mid ring: Commercial district
            zone = 'commercial';
          } else {
            // Outer sector: Residential suburbs or occasional sports park
            zone = this.prng.chance(0.12) ? 'park' : 'residential';
          }

          this.blocks.push({
            id: `block_${i}_${j}`,
            x: bx,
            y: by,
            width: bw,
            height: bh,
            zone
          });

          // Register sidewalk loop for pedestrian roaming
          this.sidewalkPaths.push({
            x1: bx,
            y1: by,
            x2: bx + bw,
            y2: by + bh
          });
        }
      }
    }
  }

  /**
   * Populates blocks with buildings, rooftop features, parks, or industrial yards
   */
  populateBlocks(cityGrid) {
    let buildingIdCounter = 1;
    let tallBuildingCount = 0; // Track for 1 in 25 helipad ratio

    this.blocks.forEach(block => {
      // If block touches the canal, ensure buildings don't overlap water
      if (block.zone === 'park') {
        this.createPark(block, true);
        return;
      }

      if (block.zone === 'industrial') {
        this.populateIndustrialBlock(block, cityGrid, () => buildingIdCounter++);
        return;
      }

      if (block.zone === 'commercial') {
        if (this.prng.chance(0.24)) {
          this.createParkingLot(block);
        } else {
          this.populateCommercialBlock(block, cityGrid, () => buildingIdCounter++);
        }
        return;
      }

      if (block.zone === 'residential') {
        if (this.prng.chance(0.08)) {
          this.createPark(block, false);
        } else {
          this.populateResidentialBlock(block, cityGrid, () => buildingIdCounter++);
        }
        return;
      }

      if (block.zone === 'downtown') {
        this.populateDowntownBlock(block, cityGrid, () => buildingIdCounter++, () => ++tallBuildingCount);
      }
    });
  }

  /**
   * PUSAT KOTA (Downtown): Dense, tall, stepped/setback roofs, neon signs, green roofs, 1/25 helipads
   */
  populateDowntownBlock(block, cityGrid, nextId, nextTallBuilding) {
    const margin = 2;
    const targetW = this.prng.rangeInt(48, 76);
    const targetH = this.prng.rangeInt(48, 76);

    const cols = Math.max(1, Math.floor(block.width / (targetW + margin)));
    const rows = Math.max(1, Math.floor(block.height / (targetH + margin)));

    const slotW = (block.width - (cols + 1) * margin) / cols;
    const slotH = (block.height - (rows + 1) * margin) / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const bx = Math.round(block.x + margin + c * (slotW + margin));
        const by = Math.round(block.y + margin + r * (slotH + margin));
        const bw = Math.round(slotW);
        const bh = Math.round(slotH);

        if (bw < 34 || bh < 34) continue;
        if (this.isPointInCanal(bx + bw / 2, by + bh / 2, 20)) continue;

        // Choose palette from modern concrete, patina teal, or night steel blue
        const palKey = this.prng.choice(['concrete', 'patina', 'steelBlue', 'beige']);
        const palette = PALETTE.roofPalettes[palKey];
        const heightLevel = this.prng.rangeInt(8, 16);
        const shadowDepth = Math.round(heightLevel * 1.3);

        const isStepped = bw >= 48 && bh >= 48 && this.prng.chance(0.45);
        const isGreenRoof = !isStepped && this.prng.chance(0.22);
        const roofType = isStepped ? 'stepped' : (isGreenRoof ? 'green_roof' : 'flat');

        const details = [];

        // Check Helipad (exactly 1 in 25 tall buildings)
        const tallIdx = nextTallBuilding();
        const hasHelipad = (tallIdx % 25 === 0) && bw >= 50 && bh >= 50 && !isGreenRoof;

        if (hasHelipad) {
          details.push({
            type: 'helipad',
            x: bx + bw / 2,
            y: by + bh / 2,
            radius: Math.min(bw, bh) * 0.26
          });
        } else {
          // AC chiller units
          const acCount = this.prng.rangeInt(2, 5);
          for (let a = 0; a < acCount; a++) {
            const acW = this.prng.rangeInt(6, 10);
            const acH = this.prng.rangeInt(4, 7);
            const acX = bx + 4 + (a * 12) % (bw - 16);
            const acY = by + 4 + Math.floor(a / 2) * 12;
            if (acX + acW < bx + bw - 4 && acY + acH < by + bh - 4) {
              details.push({ type: 'ac', x: acX, y: acY, width: acW, height: acH });
            }
          }

          // Water tank on roof
          if (this.prng.chance(0.4)) {
            details.push({
              type: 'water_tank',
              x: bx + bw - 10,
              y: by + 6,
              radius: 4
            });
          }

          // Antenna / Communications mast
          if (this.prng.chance(0.5)) {
            details.push({
              type: 'antenna',
              x: bx + 7,
              y: by + 7
            });
          }
        }

        // Rooftop Neon Billboard / Sign (cyberpunk accent on roof edges)
        if (this.prng.chance(0.55)) {
          const neonCol = this.prng.choice(PALETTE.neonColors);
          const edge = this.prng.choice(['top', 'bottom', 'left', 'right']);
          details.push({
            type: 'neon_sign',
            edge,
            color: neonCol.main,
            glow: neonCol.glow,
            length: Math.min(bw - 10, this.prng.rangeInt(14, 28))
          });
        }

        // Stepped receding tiers for skyscrapers
        const subTiers = [];
        if (isStepped) {
          const tierInset = Math.round(Math.min(bw, bh) * 0.18);
          subTiers.push({
            inset: tierInset,
            palette: PALETTE.roofPalettes[this.prng.choice(['concrete', 'steelBlue'])]
          });
        }

        const building = {
          id: nextId(),
          x: bx,
          y: by,
          width: bw,
          height: bh,
          shape: 'rect',
          zone: 'downtown',
          roofType,
          baseColor: palette.base,
          palette,
          heightLevel,
          shadowDepth,
          cellHp: 120 + heightLevel * 6,
          details,
          subTiers
        };

        this.buildings.push(building);
        cityGrid.registerBuilding(building);
      }
    }
  }

  /**
   * KOMERSIAL (Commercial): Ruko (shophouses) in tight rows with continuous roofs, large parking lots
   */
  populateCommercialBlock(block, cityGrid, nextId) {
    const margin = 2;
    // Divide into tight rows (ruko)
    const isHorizontalRow = block.width >= block.height;
    const rukoWidth = this.prng.rangeInt(24, 34);
    const rukoDepth = isHorizontalRow ? block.height - margin * 2 : block.width - margin * 2;

    const count = Math.max(1, Math.floor((isHorizontalRow ? block.width : block.height) / (rukoWidth + 1)));

    for (let i = 0; i < count; i++) {
      let bx, by, bw, bh;
      if (isHorizontalRow) {
        bx = Math.round(block.x + margin + i * (rukoWidth + 1));
        by = Math.round(block.y + margin);
        bw = Math.round(rukoWidth);
        bh = Math.round(rukoDepth);
      } else {
        bx = Math.round(block.x + margin);
        by = Math.round(block.y + margin + i * (rukoWidth + 1));
        bw = Math.round(rukoDepth);
        bh = Math.round(rukoWidth);
      }

      if (bw < 20 || bh < 20) continue;
      if (this.isPointInCanal(bx + bw / 2, by + bh / 2, 20)) continue;

      // Each ruko picks a varied commercial roof palette (terracotta, beige, patina, concrete)
      const palKey = this.prng.choice(['terracotta', 'beige', 'patina', 'concrete', 'asphalt']);
      const palette = PALETTE.roofPalettes[palKey];
      const heightLevel = this.prng.rangeInt(3, 6);
      const shadowDepth = Math.round(heightLevel * 1.2);

      const details = [];
      // Rooftop AC and skylights
      if (this.prng.chance(0.65)) {
        details.push({
          type: 'ac',
          x: bx + 4,
          y: by + 4,
          width: 5,
          height: 4
        });
      }
      if (this.prng.chance(0.35)) {
        details.push({
          type: 'skylight',
          x: bx + bw / 2 - 4,
          y: by + bh / 2 - 3,
          width: 8,
          height: 6
        });
      }

      const building = {
        id: nextId(),
        x: bx,
        y: by,
        width: bw,
        height: bh,
        shape: 'rect',
        zone: 'commercial',
        roofType: 'flat',
        baseColor: palette.base,
        palette,
        heightLevel,
        shadowDepth,
        cellHp: 75 + heightLevel * 5,
        details
      };

      this.buildings.push(building);
      cityGrid.registerBuilding(building);
    }
  }

  /**
   * PERMUKIMAN (Residential): Small houses (16-28 px) with gabled roofs (bubungan tengah), yards, fences
   */
  populateResidentialBlock(block, cityGrid, nextId) {
    const margin = 5;
    const targetW = this.prng.rangeInt(20, 28);
    const targetH = this.prng.rangeInt(20, 28);

    const cols = Math.max(1, Math.floor(block.width / (targetW + margin)));
    const rows = Math.max(1, Math.floor(block.height / (targetH + margin)));

    const slotW = (block.width - (cols + 1) * margin) / cols;
    const slotH = (block.height - (rows + 1) * margin) / rows;

    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Chance of leaving empty yard / garden
        if (this.prng.chance(0.2) && (cols > 1 || rows > 1)) continue;

        const slotX = Math.round(block.x + margin + c * (slotW + margin));
        const slotY = Math.round(block.y + margin + r * (slotH + margin));

        // House dimensions inside the lot
        const houseW = Math.round(this.prng.range(18, Math.min(28, slotW - 4)));
        const houseH = Math.round(this.prng.range(18, Math.min(28, slotH - 4)));
        const bx = slotX + 2;
        const by = slotY + 2;

        if (houseW < 16 || houseH < 16) continue;
        if (this.isPointInCanal(bx + houseW / 2, by + houseH / 2, 20)) continue;

        // Gabled roof palette (terracotta, wood, moss green, dark slate)
        const palKey = this.prng.choice(['terracotta', 'wood', 'moss', 'asphalt', 'beige']);
        const palette = PALETTE.roofPalettes[palKey];
        const heightLevel = this.prng.rangeInt(1, 3);
        const shadowDepth = Math.round(heightLevel * 1.4);

        // Gabled ridge orientation (horizontal vs vertical)
        const gabledOrientation = houseW >= houseH ? 'horizontal' : 'vertical';

        const details = [];
        // Small brick chimney with faint smoke
        if (this.prng.chance(0.55)) {
          details.push({
            type: 'chimney',
            x: bx + houseW - 4,
            y: by + 3
          });
        }

        const building = {
          id: nextId(),
          x: bx,
          y: by,
          width: houseW,
          height: houseH,
          shape: 'rect',
          zone: 'residential',
          roofType: 'gabled',
          gabledOrientation,
          baseColor: palette.base,
          palette,
          heightLevel,
          shadowDepth,
          cellHp: 50 + heightLevel * 5,
          details,
          // Yard metadata for green lawn & garden tree
          yard: {
            x: slotX,
            y: slotY,
            width: slotW,
            height: slotH
          }
        };

        this.buildings.push(building);
        cityGrid.registerBuilding(building);
      }
    }
  }

  /**
   * INDUSTRI (Industrial): Wide warehouses (44-80 px), cylindrical tanks, shipping containers
   */
  populateIndustrialBlock(block, cityGrid, nextId) {
    const margin = 4;
    if (this.isPointInCanal(block.x + block.width / 2, block.y + block.height / 2, 30)) {
      this.createPark(block, true);
      return;
    }

    // 50% Large Warehouse, 50% Container / Storage Yard
    if (this.prng.chance(0.55) && block.width >= 48 && block.height >= 40) {
      // Large warehouse
      const bw = Math.min(block.width - margin * 2, this.prng.rangeInt(48, 80));
      const bh = Math.min(block.height - margin * 2, this.prng.rangeInt(36, 64));
      const bx = Math.round(block.x + (block.width - bw) / 2);
      const by = Math.round(block.y + (block.height - bh) / 2);

      const palKey = this.prng.choice(['steelBlue', 'asphalt', 'concrete']);
      const palette = PALETTE.roofPalettes[palKey];
      const heightLevel = this.prng.rangeInt(2, 4);
      const shadowDepth = Math.round(heightLevel * 1.5);

      const details = [];
      // Industrial rooftop vents / skylight strip
      details.push({
        type: 'warehouse_ridge',
        x: bx,
        y: by + bh / 2,
        length: bw
      });
      // Smokestack
      if (this.prng.chance(0.6)) {
        details.push({
          type: 'smokestack',
          x: bx + bw - 6,
          y: by + 6,
          radius: 3
        });
      }

      const building = {
        id: nextId(),
        x: bx,
        y: by,
        width: bw,
        height: bh,
        shape: 'rect',
        zone: 'industrial',
        roofType: 'warehouse',
        baseColor: palette.base,
        palette,
        heightLevel,
        shadowDepth,
        cellHp: 95,
        details
      };

      this.buildings.push(building);
      cityGrid.registerBuilding(building);
    } else {
      // Industrial Storage Yard: Cylindrical Tanks & Shipping Containers
      const yardItems = [];
      // Tanks
      const numTanks = this.prng.rangeInt(1, 3);
      for (let t = 0; t < numTanks; t++) {
        const tr = this.prng.range(8, 14);
        const tx = block.x + tr + 6 + t * (tr * 2 + 8);
        const ty = block.y + block.height / 2;
        if (tx + tr < block.x + block.width - 6) {
          yardItems.push({
            type: 'storage_tank',
            x: tx,
            y: ty,
            radius: tr
          });
        }
      }

      // Shipping Containers
      const numContainers = this.prng.rangeInt(4, 10);
      const conW = 16;
      const conH = 8;
      for (let c = 0; c < numContainers; c++) {
        const cx = block.x + block.width - conW - 6 - (c % 3) * (conW + 2);
        const cy = block.y + 6 + Math.floor(c / 3) * (conH + 4);
        if (cx >= block.x + 6 && cy + conH < block.y + block.height - 6) {
          yardItems.push({
            type: 'container',
            x: cx,
            y: cy,
            width: conW,
            height: conH,
            color: this.prng.choice(PALETTE.containerColors)
          });
        }
      }

      this.industrialYards.push({
        x: block.x,
        y: block.y,
        width: block.width,
        height: block.height,
        items: yardItems
      });
    }
  }

  /**
   * TAMAN & KANAL: Lush parks with winding paths, ponds, sports courts, and oak/pine trees
   */
  createPark(block, isWaterfront = false) {
    const trees = [];
    const treeSpacing = 16;
    const cols = Math.floor((block.width - 10) / treeSpacing);
    const rows = Math.floor((block.height - 10) / treeSpacing);

    // Sports Court (Basketball / Tennis) in large non-waterfront parks
    let sportsCourt = null;
    if (!isWaterfront && block.width >= 48 && block.height >= 40 && this.prng.chance(0.45)) {
      sportsCourt = {
        x: block.x + 8,
        y: block.y + 8,
        width: 32,
        height: 22,
        type: this.prng.chance(0.5) ? 'basketball' : 'tennis'
      };
    }

    // Small pond in park
    let pond = null;
    if (block.width >= 44 && block.height >= 44 && !sportsCourt && this.prng.chance(0.4)) {
      pond = {
        x: block.x + block.width / 2,
        y: block.y + block.height / 2,
        radiusX: this.prng.range(10, 16),
        radiusY: this.prng.range(8, 12)
      };
    }

    // Trees (Round Oak & Pointy Pine)
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const tx = block.x + 6 + c * treeSpacing + this.prng.range(-3, 3);
        const ty = block.y + 6 + r * treeSpacing + this.prng.range(-3, 3);

        // Don't place tree on sports court or pond
        if (sportsCourt && tx >= sportsCourt.x && tx <= sportsCourt.x + sportsCourt.width &&
            ty >= sportsCourt.y && ty <= sportsCourt.y + sportsCourt.height) continue;
        if (pond && Math.hypot(tx - pond.x, ty - pond.y) < pond.radiusX + 4) continue;
        if (this.isPointInCanal(tx, ty, 6)) continue;

        if (this.prng.chance(0.6)) {
          trees.push({
            x: tx,
            y: ty,
            radius: this.prng.range(4, 7),
            isPine: this.prng.chance(0.35) // Pointy conifer tree
          });
        }
      }
    }

    this.parks.push({
      x: block.x,
      y: block.y,
      width: block.width,
      height: block.height,
      isWaterfront,
      sportsCourt,
      pond,
      trees
    });
  }

  /**
   * Parking Lot with stalls
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
