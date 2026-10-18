import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';

/**
 * High-Performance Chunk Renderer - Tahap 2A
 * Renders an authentic, vibrant, and gritty top-down city into 256x256 px chunk textures.
 * Features:
 * - Varied roof architectures (gabled, stepped, flat, green roofs, warehouses)
 * - Diverse roof color palettes per building
 * - Realistic street life (sidewalks, zebra cross, warm street light pools, street trees, parked cars)
 * - Canal with bridges & water reflections
 * - Parks with ponds, sports courts, and oak/pine trees
 * - Industrial storage tanks and shipping containers
 */
export class ChunkRenderer {
  constructor(scene, cityData) {
    this.scene = scene;
    this.cityData = cityData;

    this.chunkSize = WORLD_CONFIG.chunkSize; // 256 px
    this.worldWidth = WORLD_CONFIG.worldWidth;
    this.worldHeight = WORLD_CONFIG.worldHeight;

    this.cols = Math.ceil(this.worldWidth / this.chunkSize);
    this.rows = Math.ceil(this.worldHeight / this.chunkSize);
    this.totalChunks = this.cols * this.rows;

    this.chunks = new Map();
    this.generationQueue = [];
    this.activeChunkCount = 0;
    this.dirtyChunks = new Set(); // Chunks with modified rubble/cracks to refresh

    this.partitionWorldIntoChunks();
  }

  partitionWorldIntoChunks() {
    for (let cy = 0; cy < this.rows; cy++) {
      for (let cx = 0; cx < this.cols; cx++) {
        const chunkX = cx * this.chunkSize;
        const chunkY = cy * this.chunkSize;
        const chunkRect = {
          x: chunkX,
          y: chunkY,
          width: this.chunkSize,
          height: this.chunkSize
        };

        const key = `${cx}_${cy}`;
        const chunkData = {
          key,
          cx,
          cy,
          x: chunkX,
          y: chunkY,
          width: this.chunkSize,
          height: this.chunkSize,
          status: 'unrendered',
          image: null,
          hasCanal: false,
          bridges: [],
          roads: [],
          intersections: [],
          zebraCrossings: [],
          streetLamps: [],
          streetTrees: [],
          parkedCars: [],
          parks: [],
          parkingLots: [],
          industrialYards: [],
          buildings: []
        };

        // Check Canal intersection
        if (this.cityData.canal) {
          for (let y = chunkY; y <= chunkY + this.chunkSize; y += 16) {
            const canalX = this.getCanalXAt(y);
            if (canalX !== null && Math.abs(canalX - (chunkX + this.chunkSize / 2)) < this.chunkSize / 2 + 50) {
              chunkData.hasCanal = true;
              break;
            }
          }
        }

        // Bridges
        this.cityData.bridges.forEach(b => {
          if (this.rectIntersects(chunkRect, b)) chunkData.bridges.push(b);
        });

        // Roads
        this.cityData.roads.forEach(road => {
          if (this.rectIntersects(chunkRect, road)) chunkData.roads.push(road);
        });

        // Intersections & Zebra Crossings
        this.cityData.intersections.forEach(i => {
          if (this.rectIntersects(chunkRect, i)) chunkData.intersections.push(i);
        });
        this.cityData.zebraCrossings.forEach(z => {
          if (this.rectIntersects(chunkRect, z)) chunkData.zebraCrossings.push(z);
        });

        // Street Life
        const lampPad = WORLD_CONFIG.streetLightRadius + 10;
        const lampRect = { x: chunkX - lampPad, y: chunkY - lampPad, width: this.chunkSize + lampPad * 2, height: this.chunkSize + lampPad * 2 };
        this.cityData.streetLamps.forEach(lamp => {
          if (lamp.x >= lampRect.x && lamp.x <= lampRect.x + lampRect.width && lamp.y >= lampRect.y && lamp.y <= lampRect.y + lampRect.height) {
            chunkData.streetLamps.push(lamp);
          }
        });

        this.cityData.streetTrees.forEach(t => {
          if (t.x >= chunkX - 10 && t.x <= chunkX + this.chunkSize + 10 && t.y >= chunkY - 10 && t.y <= chunkY + this.chunkSize + 10) {
            chunkData.streetTrees.push(t);
          }
        });

        this.cityData.parkedCars.forEach(car => {
          if (car.x >= chunkX - 10 && car.x <= chunkX + this.chunkSize + 10 && car.y >= chunkY - 10 && car.y <= chunkY + this.chunkSize + 10) {
            chunkData.parkedCars.push(car);
          }
        });

        // Parks & Parking
        this.cityData.parks.forEach(park => {
          if (this.rectIntersects(chunkRect, park)) chunkData.parks.push(park);
        });
        this.cityData.parkingLots.forEach(parking => {
          if (this.rectIntersects(chunkRect, parking)) chunkData.parkingLots.push(parking);
        });
        this.cityData.industrialYards.forEach(yard => {
          if (this.rectIntersects(chunkRect, yard)) chunkData.industrialYards.push(yard);
        });

        // Buildings (including extended shadow margin)
        const shadowMargin = 32;
        const shadowRect = {
          x: chunkRect.x - shadowMargin,
          y: chunkRect.y - shadowMargin,
          width: chunkRect.width + shadowMargin,
          height: chunkRect.height + shadowMargin
        };
        this.cityData.buildings.forEach(building => {
          if (this.rectIntersects(shadowRect, building)) {
            chunkData.buildings.push(building);
          }
        });

        this.chunks.set(key, chunkData);
      }
    }
  }

  getCanalXAt(y) {
    if (!this.cityData.canal || !this.cityData.canal.points) return null;
    const pts = this.cityData.canal.points;
    const total = pts.length;
    const stepY = this.worldHeight / (total - 1);
    const idx = Math.min(total - 2, Math.max(0, Math.floor(y / stepY)));
    const frac = (y - idx * stepY) / stepY;
    const p1 = pts[idx];
    const p2 = pts[idx + 1];
    return p1.x + (p2.x - p1.x) * frac;
  }

  rectIntersects(r1, r2) {
    return !(
      r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y
    );
  }

  update(camera) {
    const worldView = camera.worldView;
    const padding = 32;

    const minCx = Math.max(0, Math.floor((worldView.x - padding) / this.chunkSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((worldView.right + padding) / this.chunkSize));
    const minCy = Math.max(0, Math.floor((worldView.y - padding) / this.chunkSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((worldView.bottom + padding) / this.chunkSize));

    let activeCount = 0;
    const priorityQueue = [];

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const key = `${cx}_${cy}`;
        const chunk = this.chunks.get(key);
        if (!chunk) continue;

        if (chunk.status === 'ready') {
          if (chunk.image) {
            chunk.image.setVisible(true);
            chunk.image.setActive(true);
            activeCount++;
          }
        } else if (chunk.status === 'unrendered') {
          priorityQueue.push(chunk);
        }
      }
    }

    // Hide off-screen ready chunks
    this.chunks.forEach(chunk => {
      if (chunk.status === 'ready' && chunk.image) {
        const isVisible =
          chunk.cx >= minCx &&
          chunk.cx <= maxCx &&
          chunk.cy >= minCy &&
          chunk.cy <= maxCy;

        if (!isVisible && chunk.image.visible) {
          chunk.image.setVisible(false);
          chunk.image.setActive(false);
        }
      }
    });

    this.activeChunkCount = activeCount;

    // Progressive rendering
    const chunksToProcess = WORLD_CONFIG.chunksPerFrame;
    let processed = 0;

    while (priorityQueue.length > 0 && processed < chunksToProcess) {
      const chunk = priorityQueue.shift();
      if (chunk.status === 'unrendered') {
        this.renderChunk(chunk);
        processed++;
      }
    }

    if (processed < chunksToProcess) {
      const radius = 3;
      const expandMinCx = Math.max(0, minCx - radius);
      const expandMaxCx = Math.min(this.cols - 1, maxCx + radius);
      const expandMinCy = Math.max(0, minCy - radius);
      const expandMaxCy = Math.min(this.rows - 1, maxCy + radius);

      for (let cy = expandMinCy; cy <= expandMaxCy && processed < chunksToProcess; cy++) {
        for (let cx = expandMinCx; cx <= expandMaxCx && processed < chunksToProcess; cx++) {
          const chunk = this.chunks.get(`${cx}_${cy}`);
          if (chunk && chunk.status === 'unrendered') {
            this.renderChunk(chunk);
            processed++;
          }
        }
      }
    }

    // 3. Process batch of dirty chunks modified by destruction (budgeted to avoid frame drops)
    if (this.dirtyChunks.size > 0) {
      const maxUpdates = WORLD_CONFIG.maxDirtyChunkUpdatesPerFrame || 4;
      let updated = 0;
      for (const chunk of this.dirtyChunks) {
        if (chunk.canvasTexture) {
          chunk.canvasTexture.refresh();
        }
        chunk.isDirty = false;
        this.dirtyChunks.delete(chunk);
        updated++;
        if (updated >= maxUpdates) break;
      }
    }
  }

  /**
   * Renders a single 256x256 chunk into an HTML5 Canvas texture
   */
  renderChunk(chunk) {
    chunk.status = 'ready';

    const canvas = document.createElement('canvas');
    canvas.width = this.chunkSize;
    canvas.height = this.chunkSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const ox = chunk.x;
    const oy = chunk.y;

    // 1. Terrain Base Fill
    ctx.fillStyle = PALETTE.groundHex;
    ctx.fillRect(0, 0, this.chunkSize, this.chunkSize);

    // 2. Render Canal (Water & Stone Banks)
    if (chunk.hasCanal && this.cityData.canal) {
      this.drawCanal(ctx, ox, oy);
    }

    // 3. Render Parks
    this.drawParks(ctx, chunk, ox, oy);

    // 4. Render Parking Lots & Industrial Yards
    this.drawParkingLots(ctx, chunk, ox, oy);
    this.drawIndustrialYards(ctx, chunk, ox, oy);

    // 5. Render Residential Yards (Green lawns & garden trees)
    this.drawResidentialYards(ctx, chunk, ox, oy);

    // 6. Render Roads, Sidewalks & Markings
    this.drawRoads(ctx, chunk, ox, oy);

    // 7. Render Canal Bridges
    this.drawBridges(ctx, chunk, ox, oy);

    // 8. Render Zebra Crossings
    this.drawZebraCrossings(ctx, chunk, ox, oy);

    // 9. Render Street Lamps & Warm Light Pools
    this.drawStreetLamps(ctx, chunk, ox, oy);

    // 10. Render Street Trees & Parked Cars
    this.drawStreetLife(ctx, chunk, ox, oy);

    // 11. Render Building Shadows (Proportional to height!)
    this.drawBuildingShadows(ctx, chunk, ox, oy);

    // 12. Render Building Walls & Roofs
    this.drawBuildings(ctx, chunk, ox, oy);

    // Register with Phaser texture manager
    const textureKey = `chunk_${chunk.key}`;
    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }
    this.scene.textures.addCanvas(textureKey, canvas);

    chunk.canvas = canvas;
    chunk.ctx = ctx;
    chunk.canvasTexture = this.scene.textures.get(textureKey);

    const img = this.scene.add.image(chunk.x, chunk.y, textureKey);
    img.setOrigin(0, 0);
    img.setDepth(0);
    chunk.image = img;
  }

  /**
   * Draws winding canal with stone retaining bank and murky water with ripples
   */
  drawCanal(ctx, ox, oy) {
    const { width, bankWidth } = this.cityData.canal;
    const totalW = width + bankWidth * 2;

    for (let ly = 0; ly < this.chunkSize; ly += 4) {
      const worldY = oy + ly;
      const canalX = this.getCanalXAt(worldY);
      if (canalX !== null) {
        const drawX = canalX - ox;

        // Stone Bank
        ctx.fillStyle = PALETTE.canalBankHex;
        ctx.fillRect(drawX - totalW / 2, ly, totalW, 4);

        // Stone Border Highlight
        ctx.fillStyle = PALETTE.canalBorderHex;
        ctx.fillRect(drawX - totalW / 2, ly, bankWidth, 4);
        ctx.fillRect(drawX + totalW / 2 - bankWidth, ly, bankWidth, 4);

        // Water Deep
        ctx.fillStyle = PALETTE.waterDeepHex;
        ctx.fillRect(drawX - width / 2, ly, width, 4);

        // Water Ripple Highlights
        if ((worldY % 18) < 4) {
          ctx.fillStyle = PALETTE.waterHighlightHex;
          ctx.fillRect(drawX - width / 4, ly + 1, width / 2, 1);
        }
      }
    }
  }

  /**
   * Draws Bridges crossing the canal
   */
  drawBridges(ctx, chunk, ox, oy) {
    chunk.bridges.forEach(b => {
      const bx = b.x - ox;
      const by = b.y - oy;

      // Concrete Bridge Structure
      ctx.fillStyle = PALETTE.sidewalkBorderHex;
      ctx.fillRect(bx, by, b.width, b.height);

      // Road Deck
      ctx.fillStyle = PALETTE.roadHex;
      ctx.fillRect(bx + 2, by + 2, b.width - 4, b.height - 4);

      // Parapet / Railing highlight
      ctx.fillStyle = PALETTE.sidewalkLightHex;
      if (b.isHorizontal) {
        ctx.fillRect(bx, by, b.width, 2);
        ctx.fillRect(bx, by + b.height - 2, b.width, 2);
      } else {
        ctx.fillRect(bx, by, 2, b.height);
        ctx.fillRect(bx + b.width - 2, by, 2, b.height);
      }
    });
  }

  /**
   * Draws Roads, Sidewalks, and Centerline dashes
   */
  drawRoads(ctx, chunk, ox, oy) {
    const sw = WORLD_CONFIG.sidewalkWidth;
    const dashLen = WORLD_CONFIG.laneMarkingLength;
    const dashGap = WORLD_CONFIG.laneMarkingGap;
    const step = dashLen + dashGap;

    chunk.roads.forEach(road => {
      const rx = road.x - ox;
      const ry = road.y - oy;

      // 1. Sidewalk Border & Surface (brightened, crisp)
      ctx.fillStyle = PALETTE.sidewalkBorderHex;
      if (road.isHorizontal) {
        ctx.fillRect(rx, ry - sw - 1, road.width, road.height + (sw + 1) * 2);
      } else {
        ctx.fillRect(rx - sw - 1, ry, road.width + (sw + 1) * 2, road.height);
      }

      ctx.fillStyle = PALETTE.sidewalkHex;
      if (road.isHorizontal) {
        ctx.fillRect(rx, ry - sw, road.width, road.height + sw * 2);
      } else {
        ctx.fillRect(rx - sw, ry, road.width + sw * 2, road.height);
      }

      // 2. Road Asphalt
      ctx.fillStyle = PALETTE.roadHex;
      ctx.fillRect(rx, ry, road.width, road.height);

      // 3. Centerline Dash Markings (Faded yellow)
      ctx.fillStyle = PALETTE.roadMarkingHex;
      if (road.isHorizontal) {
        const centerY = ry + road.height / 2;
        const startX = Math.floor(ox / step) * step;
        for (let lx = startX; lx < ox + this.chunkSize; lx += step) {
          ctx.fillRect(lx - ox, centerY - 1, dashLen, 2);
        }
      } else {
        const centerX = rx + road.width / 2;
        const startY = Math.floor(oy / step) * step;
        for (let ly = startY; ly < oy + this.chunkSize; ly += step) {
          ctx.fillRect(centerX - 1, ly - oy, 2, dashLen);
        }
      }
    });
  }

  /**
   * Draws Zebra Crossings at street intersections
   */
  drawZebraCrossings(ctx, chunk, ox, oy) {
    ctx.fillStyle = PALETTE.zebraCrossHex;
    chunk.zebraCrossings.forEach(z => {
      const zx = z.x - ox;
      const zy = z.y - oy;
      const stripeW = 3;
      const stripeGap = 3;

      if (z.isHorizontal) {
        // Stripes running vertically across horizontal road
        for (let sx = 0; sx < z.width - 2; sx += stripeW + stripeGap) {
          ctx.fillRect(zx + sx, zy, stripeW, z.height);
        }
      } else {
        // Stripes running horizontally across vertical road
        for (let sy = 0; sy < z.height - 2; sy += stripeW + stripeGap) {
          ctx.fillRect(zx, zy + sy, z.width, stripeW);
        }
      }
    });
  }

  /**
   * Draws Street Lamps with warm ambient light pools on the pavement
   */
  drawStreetLamps(ctx, chunk, ox, oy) {
    chunk.streetLamps.forEach(lamp => {
      const lx = lamp.x - ox;
      const ly = lamp.y - oy;

      // Warm radial light pool on pavement
      const rad = lamp.radius;
      const grad = ctx.createRadialGradient(lx, ly, 2, lx, ly, rad);
      grad.addColorStop(0, 'rgba(255, 230, 140, 0.22)');
      grad.addColorStop(0.5, 'rgba(255, 205, 100, 0.10)');
      grad.addColorStop(1, 'rgba(255, 180, 80, 0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lx, ly, rad, 0, Math.PI * 2);
      ctx.fill();

      // Lamp Post
      ctx.fillStyle = PALETTE.streetLampPostHex;
      ctx.fillRect(lx - 1, ly - 3, 2, 5);

      // Glowing Bulb
      ctx.fillStyle = PALETTE.streetLightBulbHex;
      ctx.fillRect(lx - 1, ly - 3, 2, 2);
    });
  }

  /**
   * Draws Street Trees & Parked Cars along sidewalks
   */
  drawStreetLife(ctx, chunk, ox, oy) {
    // 1. Street Trees
    chunk.streetTrees.forEach(t => {
      const tx = t.x - ox;
      const ty = t.y - oy;

      // Soil grate at base
      ctx.fillStyle = '#221e2a';
      ctx.fillRect(tx - 3, ty - 3, 6, 6);

      // Tree shadow
      ctx.fillStyle = 'rgba(7, 6, 10, 0.5)';
      ctx.beginPath();
      ctx.ellipse(tx + 2, ty + 2, t.radius, t.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();

      // Dark foliage
      ctx.fillStyle = PALETTE.treeDarkHex;
      ctx.beginPath();
      ctx.arc(tx, ty, t.radius, 0, Math.PI * 2);
      ctx.fill();

      // Mid foliage
      ctx.fillStyle = PALETTE.treeMidHex;
      ctx.beginPath();
      ctx.arc(tx - 1, ty - 1, t.radius * 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Highlight
      ctx.fillStyle = PALETTE.treeLightHex;
      ctx.beginPath();
      ctx.arc(tx - 2, ty - 2, t.radius * 0.4, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Parallel Parked Cars
    chunk.parkedCars.forEach(car => {
      const cx = car.x - ox;
      const cy = car.y - oy;
      const color = PALETTE.carBodies[car.colorIdx];
      const bodyHex = `#${color.toString(16).padStart(6, '0')}`;

      // Parked car shadow
      ctx.fillStyle = 'rgba(7, 6, 10, 0.6)';
      ctx.fillRect(cx - 3, cy - 1, 8, 5);

      if (car.rotation === 0) {
        // Horizontal parked car (8x4)
        ctx.fillStyle = bodyHex;
        ctx.fillRect(cx - 4, cy - 2, 8, 4);
        ctx.fillStyle = PALETTE.carWindowHex;
        ctx.fillRect(cx + 1, cy - 1, 1, 2);
        ctx.fillRect(cx - 2, cy - 1, 1, 2);
      } else {
        // Vertical parked car (4x8)
        ctx.fillStyle = bodyHex;
        ctx.fillRect(cx - 2, cy - 4, 4, 8);
        ctx.fillStyle = PALETTE.carWindowHex;
        ctx.fillRect(cx - 1, cy + 1, 2, 1);
        ctx.fillRect(cx - 1, cy - 2, 2, 1);
      }
    });
  }

  /**
   * Draws Parks, winding paths, ponds, and sports courts
   */
  drawParks(ctx, chunk, ox, oy) {
    chunk.parks.forEach(park => {
      const px = park.x - ox;
      const py = park.y - oy;

      // Dark grass base
      ctx.fillStyle = PALETTE.grassDarkHex;
      ctx.fillRect(px, py, park.width, park.height);

      // Mid grass interior
      ctx.fillStyle = PALETTE.grassMidHex;
      ctx.fillRect(px + 2, py + 2, park.width - 4, park.height - 4);

      // Winding park path
      ctx.strokeStyle = PALETTE.parkPathHex;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(px + 4, py + park.height / 2);
      ctx.quadraticCurveTo(px + park.width / 2, py + park.height / 3, px + park.width - 4, py + park.height / 2);
      ctx.stroke();

      // Sports Court (Basketball / Tennis)
      if (park.sportsCourt) {
        const sc = park.sportsCourt;
        const scx = sc.x - ox;
        const scy = sc.y - oy;

        ctx.fillStyle = sc.type === 'basketball' ? PALETTE.courtSurfaceTerracottaHex : PALETTE.courtSurfaceGreenHex;
        ctx.fillRect(scx, scy, sc.width, sc.height);

        // White court boundary & center line
        ctx.strokeStyle = PALETTE.courtLinesHex;
        ctx.lineWidth = 1;
        ctx.strokeRect(scx + 2, scy + 2, sc.width - 4, sc.height - 4);
        ctx.beginPath();
        ctx.moveTo(scx + sc.width / 2, scy + 2);
        ctx.lineTo(scx + sc.width / 2, scy + sc.height - 2);
        ctx.arc(scx + sc.width / 2, scy + sc.height / 2, 3, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Pond
      if (park.pond) {
        const pnd = park.pond;
        const pndx = pnd.x - ox;
        const pndy = pnd.y - oy;

        ctx.fillStyle = PALETTE.pondWaterHex;
        ctx.beginPath();
        ctx.ellipse(pndx, pndy, pnd.radiusX, pnd.radiusY, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = PALETTE.grassDarkHex;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Trees (Round Oak & Pointy Pine)
      park.trees.forEach(tree => {
        const tx = tree.x - ox;
        const ty = tree.y - oy;

        // Tree shadow
        ctx.fillStyle = 'rgba(7, 6, 10, 0.5)';
        ctx.beginPath();
        ctx.ellipse(tx + 2, ty + 2, tree.radius, tree.radius * 0.7, 0, 0, Math.PI * 2);
        ctx.fill();

        if (tree.isPine) {
          // Pointy pine tree
          ctx.fillStyle = PALETTE.pineDarkHex;
          ctx.beginPath();
          ctx.moveTo(tx, ty - tree.radius - 2);
          ctx.lineTo(tx + tree.radius, ty + tree.radius);
          ctx.lineTo(tx - tree.radius, ty + tree.radius);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = PALETTE.pineMidHex;
          ctx.beginPath();
          ctx.moveTo(tx, ty - tree.radius);
          ctx.lineTo(tx + tree.radius * 0.7, ty + tree.radius * 0.6);
          ctx.lineTo(tx - tree.radius * 0.7, ty + tree.radius * 0.6);
          ctx.closePath();
          ctx.fill();

          ctx.fillStyle = PALETTE.pineLightHex;
          ctx.fillRect(tx - 1, ty - tree.radius + 1, 2, 3);
        } else {
          // Round oak tree
          ctx.fillStyle = PALETTE.treeDarkHex;
          ctx.beginPath();
          ctx.arc(tx, ty, tree.radius, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = PALETTE.treeMidHex;
          ctx.beginPath();
          ctx.arc(tx - 1, ty - 1, tree.radius * 0.75, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = PALETTE.treeLightHex;
          ctx.beginPath();
          ctx.arc(tx - 2, ty - 2, tree.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });
  }

  /**
   * Draws Residential yards (green grass patches, fences, garden trees)
   */
  drawResidentialYards(ctx, chunk, ox, oy) {
    chunk.buildings.forEach(b => {
      if (b.zone === 'residential' && b.yard) {
        const yx = b.yard.x - ox;
        const yy = b.yard.y - oy;

        // Lawn patch
        ctx.fillStyle = PALETTE.grassDarkHex;
        ctx.fillRect(yx, yy, b.yard.width, b.yard.height);

        // Faint property fence
        ctx.strokeStyle = '#2b2633';
        ctx.lineWidth = 1;
        ctx.strokeRect(yx, yy, b.yard.width, b.yard.height);

        // Small garden tree in corner
        const gtx = yx + b.yard.width - 5;
        const gty = yy + b.yard.height - 5;
        ctx.fillStyle = PALETTE.treeMidHex;
        ctx.beginPath();
        ctx.arc(gtx, gty, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  }

  /**
   * Draws Parking Lots
   */
  drawParkingLots(ctx, chunk, ox, oy) {
    chunk.parkingLots.forEach(parking => {
      const px = parking.x - ox;
      const py = parking.y - oy;
      ctx.fillStyle = PALETTE.parkingLotHex;
      ctx.fillRect(px, py, parking.width, parking.height);

      ctx.strokeStyle = PALETTE.parkingLineHex;
      ctx.lineWidth = 1;
      parking.bays.forEach(bay => {
        const bx = bay.x - ox;
        const by = bay.y - oy;
        ctx.strokeRect(bx, by, bay.width, bay.height);
      });
    });
  }

  /**
   * Draws Industrial Storage Yards (cylindrical tanks & shipping containers)
   */
  drawIndustrialYards(ctx, chunk, ox, oy) {
    chunk.industrialYards.forEach(yard => {
      const yx = yard.x - ox;
      const yy = yard.y - oy;

      // Gravel yard base
      ctx.fillStyle = '#1c1a24';
      ctx.fillRect(yx, yy, yard.width, yard.height);

      yard.items.forEach(item => {
        if (item.type === 'storage_tank') {
          const tx = item.x - ox;
          const ty = item.y - oy;

          // Shadow
          ctx.fillStyle = 'rgba(7, 6, 10, 0.65)';
          ctx.beginPath();
          ctx.arc(tx + 6, ty + 7, item.radius, 0, Math.PI * 2);
          ctx.fill();

          // Tank metal body
          ctx.fillStyle = PALETTE.tankMetalHex;
          ctx.beginPath();
          ctx.arc(tx, ty, item.radius, 0, Math.PI * 2);
          ctx.fill();

          // Highlight ring
          ctx.strokeStyle = PALETTE.tankHighlightHex;
          ctx.lineWidth = 1.5;
          ctx.stroke();

          // Conical top center vertex
          ctx.fillStyle = PALETTE.tankHighlightHex;
          ctx.fillRect(tx - 1, ty - 1, 2, 2);
        } else if (item.type === 'container') {
          const cx = item.x - ox;
          const cy = item.y - oy;

          // Shadow
          ctx.fillStyle = 'rgba(7, 6, 10, 0.65)';
          ctx.fillRect(cx + 4, cy + 5, item.width, item.height);

          // Container body
          ctx.fillStyle = item.color;
          ctx.fillRect(cx, cy, item.width, item.height);

          // Corrugated roof lines
          ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
          ctx.fillRect(cx, cy, item.width, 1);
          for (let lx = 3; lx < item.width; lx += 3) {
            ctx.fillRect(cx + lx, cy, 1, item.height);
          }
        }
      });
    });
  }

  /**
   * Draws Building Shadows proportional to building height
   */
  drawBuildingShadows(ctx, chunk, ox, oy) {
    ctx.fillStyle = 'rgba(7, 6, 10, 0.68)';

    chunk.buildings.forEach(b => {
      const sOffset = b.shadowDepth || 8;
      const sx = b.x - ox + sOffset * 0.75;
      const sy = b.y - oy + sOffset;

      ctx.fillRect(sx, sy, b.width, b.height);
    });
  }

  /**
   * Draws Buildings with 3D walls, varied roof architectures, and rooftop props
   */
  drawBuildings(ctx, chunk, ox, oy) {
    chunk.buildings.forEach(b => {
      const bx = b.x - ox;
      const by = b.y - oy;

      // 1. Dinding samping gelap (wall depth for 3D perspective effect)
      const wallH = Math.min(4, Math.max(2, Math.floor((b.heightLevel || 3) * 0.4)));
      ctx.fillStyle = PALETTE.buildingWallDarkHex;
      ctx.fillRect(bx, by + b.height, b.width, wallH);
      ctx.fillRect(bx + b.width, by, wallH, b.height + wallH);

      // 2. Render Roof based on roofType
      if (b.roofType === 'gabled') {
        this.drawGabledRoof(ctx, b, bx, by);
      } else if (b.roofType === 'stepped') {
        this.drawSteppedRoof(ctx, b, bx, by);
      } else if (b.roofType === 'green_roof') {
        this.drawGreenRoof(ctx, b, bx, by);
      } else if (b.roofType === 'warehouse') {
        this.drawWarehouseRoof(ctx, b, bx, by);
      } else {
        this.drawFlatRoof(ctx, b, bx, by);
      }

      // 3. Render Rooftop Details
      this.drawBuildingDetails(ctx, b, bx, by);
    });
  }

  /**
   * Draws Gabled Roof (Rumah pelana: bubungan tengah dan dua sisi dengan gradasi beda)
   */
  drawGabledRoof(ctx, b, bx, by) {
    const pal = b.palette;
    const isHoriz = b.gabledOrientation === 'horizontal';

    if (isHoriz) {
      const halfH = Math.floor(b.height / 2);
      // Top slope (lit)
      ctx.fillStyle = pal.light;
      ctx.fillRect(bx, by, b.width, halfH);
      // Bottom slope (shaded)
      ctx.fillStyle = pal.dark;
      ctx.fillRect(bx, by + halfH, b.width, b.height - halfH);
      // Center Ridge Line (bubungan)
      ctx.fillStyle = pal.ridge;
      ctx.fillRect(bx, by + halfH - 1, b.width, 2);
    } else {
      const halfW = Math.floor(b.width / 2);
      // Left slope (lit)
      ctx.fillStyle = pal.light;
      ctx.fillRect(bx, by, halfW, b.height);
      // Right slope (shaded)
      ctx.fillStyle = pal.dark;
      ctx.fillRect(bx + halfW, by, b.width - halfW, b.height);
      // Center Ridge Line
      ctx.fillStyle = pal.ridge;
      ctx.fillRect(bx + halfW - 1, by, 2, b.height);
    }

    // Crisp lit eaves highlight (top & left edge)
    ctx.fillStyle = pal.ridge;
    ctx.fillRect(bx, by, b.width, 1);
    ctx.fillRect(bx, by, 1, b.height);
  }

  /**
   * Draws Stepped / Setback Skyscraper Roof
   */
  drawSteppedRoof(ctx, b, bx, by) {
    const pal = b.palette;

    // Base Tier
    ctx.fillStyle = pal.base;
    ctx.fillRect(bx, by, b.width, b.height);
    ctx.fillStyle = pal.ridge;
    ctx.fillRect(bx, by, b.width, 1);
    ctx.fillRect(bx, by, 1, b.height);

    // Inner Receding Tier
    if (b.subTiers && b.subTiers.length > 0) {
      const tier = b.subTiers[0];
      const inset = tier.inset;
      const tX = bx + inset;
      const tY = by + inset;
      const tW = b.width - inset * 2;
      const tH = b.height - inset * 2;

      // Inner Tier Wall shadow
      ctx.fillStyle = 'rgba(7, 6, 10, 0.4)';
      ctx.fillRect(tX - 1, tY - 1, tW + 2, tH + 2);

      // Inner Tier Roof
      ctx.fillStyle = tier.palette.base;
      ctx.fillRect(tX, tY, tW, tH);

      // Inner Tier Highlight
      ctx.fillStyle = tier.palette.ridge;
      ctx.fillRect(tX, tY, tW, 1);
      ctx.fillRect(tX, tY, 1, tH);
    }
  }

  /**
   * Draws Green Roof (Rooftop Garden)
   */
  drawGreenRoof(ctx, b, bx, by) {
    const pal = b.palette;

    // Border deck
    ctx.fillStyle = pal.base;
    ctx.fillRect(bx, by, b.width, b.height);

    // Grass patches
    ctx.fillStyle = PALETTE.grassMidHex;
    ctx.fillRect(bx + 3, by + 3, b.width - 6, b.height - 6);

    // Planter hedge divider
    ctx.fillStyle = PALETTE.grassDarkHex;
    ctx.fillRect(bx + 3, by + Math.floor(b.height / 2), b.width - 6, 2);

    // Outer highlight
    ctx.fillStyle = pal.ridge;
    ctx.fillRect(bx, by, b.width, 1);
    ctx.fillRect(bx, by, 1, b.height);
  }

  /**
   * Draws Industrial Warehouse Roof
   */
  drawWarehouseRoof(ctx, b, bx, by) {
    const pal = b.palette;

    // Metal roof base
    ctx.fillStyle = pal.base;
    ctx.fillRect(bx, by, b.width, b.height);

    // Corrugated metal lines
    ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
    for (let x = 4; x < b.width - 4; x += 4) {
      ctx.fillRect(bx + x, by, 1, b.height);
    }

    // Skylight strip down center
    ctx.fillStyle = PALETTE.skylightGlassHex;
    ctx.fillRect(bx + 4, by + Math.floor(b.height / 2) - 2, b.width - 8, 4);

    // Edge highlight
    ctx.fillStyle = pal.ridge;
    ctx.fillRect(bx, by, b.width, 1);
    ctx.fillRect(bx, by, 1, b.height);
  }

  /**
   * Draws Standard Flat Roof with highlights and bevel
   */
  drawFlatRoof(ctx, b, bx, by) {
    const pal = b.palette;

    // Outer dark bevel
    ctx.fillStyle = pal.dark;
    ctx.fillRect(bx, by, b.width, b.height);

    // Main roof fill
    ctx.fillStyle = pal.base;
    ctx.fillRect(bx + 1, by + 1, b.width - 2, b.height - 2);

    // Lit top and left edge highlight
    ctx.fillStyle = pal.ridge;
    ctx.fillRect(bx, by, b.width, 1);
    ctx.fillRect(bx, by, 1, b.height);
  }

  /**
   * Draws rooftop props (AC, Antennas, Neon Signs, Water Tanks, Helipad, Chimneys)
   */
  drawBuildingDetails(ctx, b, bx, by) {
    if (!b.details || b.details.length === 0) return;

    b.details.forEach(detail => {
      if (detail.type === 'ac') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        ctx.fillStyle = PALETTE.roofDetailDarkHex;
        ctx.fillRect(dx, dy, detail.width, detail.height);
        ctx.fillStyle = PALETTE.roofDetailLightHex;
        ctx.fillRect(dx + 1, dy + 1, detail.width - 2, 1);
      } else if (detail.type === 'water_tank') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        // Wood/metal tank circle
        ctx.fillStyle = PALETTE.waterTankWoodHex;
        ctx.beginPath();
        ctx.arc(dx, dy, detail.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = PALETTE.waterTankMetalHex;
        ctx.lineWidth = 1;
        ctx.stroke();
      } else if (detail.type === 'skylight') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        ctx.fillStyle = PALETTE.skylightGlassHex;
        ctx.fillRect(dx, dy, detail.width, detail.height);
        ctx.strokeStyle = PALETTE.skylightFrameHex;
        ctx.lineWidth = 1;
        ctx.strokeRect(dx, dy, detail.width, detail.height);
      } else if (detail.type === 'antenna') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        ctx.fillStyle = PALETTE.roofDetailLightHex;
        ctx.fillRect(dx, dy, 2, 6);
        ctx.fillStyle = '#ef4444'; // Red beacon
        ctx.fillRect(dx - 1, dy - 1, 4, 2);
      } else if (detail.type === 'chimney') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        ctx.fillStyle = '#4a251b';
        ctx.fillRect(dx, dy, 3, 3);
        // Faint smoke puff
        ctx.fillStyle = PALETTE.chimneySmoke;
        ctx.beginPath();
        ctx.arc(dx + 4, dy - 2, 2.5, 0, Math.PI * 2);
        ctx.arc(dx + 7, dy - 4, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else if (detail.type === 'neon_sign') {
        // Rooftop Neon Billboard / Sign
        const isHoriz = detail.edge === 'top' || detail.edge === 'bottom';
        let nx = bx + 4;
        let ny = detail.edge === 'bottom' ? by + b.height - 3 : by + 1;
        let nw = detail.length;
        let nh = 2;

        if (!isHoriz) {
          nx = detail.edge === 'right' ? bx + b.width - 3 : bx + 1;
          ny = by + 4;
          nw = 2;
          nh = detail.length;
        }

        // Neon ambient glow halo
        ctx.fillStyle = detail.glow;
        ctx.fillRect(nx - 2, ny - 2, nw + 4, nh + 4);

        // Core bright neon tube
        ctx.fillStyle = detail.color;
        ctx.fillRect(nx, ny, nw, nh);
      } else if (detail.type === 'helipad') {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);
        ctx.strokeStyle = PALETTE.helipadRingHex;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(dx, dy, detail.radius, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = PALETTE.helipadLetterHex;
        const hSize = Math.max(4, Math.floor(detail.radius * 0.6));
        ctx.fillRect(dx - hSize / 2, dy - hSize / 2, 2, hSize);
        ctx.fillRect(dx + hSize / 2 - 2, dy - hSize / 2, 2, hSize);
        ctx.fillRect(dx - hSize / 2, dy - 1, hSize, 2);
      }
    });
  }

  /**
   * Modifies the chunk canvas at world (x, y) to replace cell with dark textured rubble
   * and original building baseColor accent specks.
   * @param {number} worldX 
   * @param {number} worldY 
   * @param {string} baseColor 
   * @param {boolean} isCrack 
   */
  markCellAsRubble(worldX, worldY, baseColor = '#4a4453', isCrack = false) {
    const cx = Math.floor(worldX / this.chunkSize);
    const cy = Math.floor(worldY / this.chunkSize);
    const key = `${cx}_${cy}`;
    const chunk = this.chunks.get(key);
    if (!chunk || chunk.status !== 'ready' || !chunk.ctx) return;

    const lx = Math.floor(worldX - chunk.x);
    const ly = Math.floor(worldY - chunk.y);

    const ctx = chunk.ctx;
    // 1. Dark crater
    ctx.fillStyle = '#0f0e15';
    ctx.fillRect(lx, ly, 4, 4);

    // 2. Coarse rubble debris
    ctx.fillStyle = '#1b1822';
    ctx.fillRect(lx + 1, ly, 2, 2);
    ctx.fillRect(lx, ly + 2, 2, 2);

    // 3. Highlight specks with original building color
    ctx.fillStyle = baseColor;
    ctx.fillRect(lx + 1, ly + 1, 1, 1);
    ctx.fillRect(lx + 2, ly + 3, 1, 1);

    // 4. Subtle crack extension
    if (isCrack) {
      ctx.fillStyle = '#09080d';
      ctx.fillRect(lx - 1, ly + 2, 2, 1);
      ctx.fillRect(lx + 3, ly + 1, 2, 1);
    }

    chunk.isDirty = true;
    this.dirtyChunks.add(chunk);
  }

  /**
   * Draws radiating dark fracture cracks on pavement around major building collapses
   * @param {number} worldX 
   * @param {number} worldY 
   * @param {number} radius 
   */
  drawRoadCracks(worldX, worldY, radius = 20) {
    const minCx = Math.max(0, Math.floor((worldX - radius) / this.chunkSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((worldX + radius) / this.chunkSize));
    const minCy = Math.max(0, Math.floor((worldY - radius) / this.chunkSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((worldY + radius) / this.chunkSize));

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const chunk = this.chunks.get(`${cx}_${cy}`);
        if (chunk && chunk.status === 'ready' && chunk.ctx) {
          const clx = worldX - chunk.x;
          const cly = worldY - chunk.y;

          const ctx = chunk.ctx;
          ctx.strokeStyle = '#09080e';
          ctx.lineWidth = 1;

          for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + 0.35;
            const r = radius * 0.75;
            const midR = r * 0.45;

            ctx.beginPath();
            ctx.moveTo(clx, cly);
            ctx.lineTo(clx + Math.cos(angle - 0.2) * midR, cly + Math.sin(angle - 0.2) * midR);
            ctx.lineTo(clx + Math.cos(angle) * r, cly + Math.sin(angle) * r);
            ctx.stroke();
          }

          chunk.isDirty = true;
          this.dirtyChunks.add(chunk);
        }
      }
    }
  }

  destroy() {
    this.dirtyChunks.clear();
    this.chunks.forEach(chunk => {
      if (chunk.image) chunk.image.destroy();
      const textureKey = `chunk_${chunk.key}`;
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
    });
    this.chunks.clear();
  }
}
