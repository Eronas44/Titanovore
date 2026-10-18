import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';

/**
 * High-Performance Chunk Renderer
 * Divides the 4000x4000 world into 256x256 px chunks.
 * Generates each chunk progressively to an HTML5 canvas texture.
 * Only camera-visible chunks have active/visible Phaser Images in the scene.
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

    this.chunks = new Map(); // key `${cx}_${cy}` -> ChunkData
    this.generationQueue = []; // Priority queue for progressive generation
    this.activeChunkCount = 0;

    // Partition world elements into chunks for fast rendering
    this.partitionWorldIntoChunks();
  }

  /**
   * Pre-filters roads, buildings, parks, and parking lots into intersecting chunks.
   */
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
          status: 'unrendered', // 'unrendered' | 'ready'
          image: null,
          roads: [],
          buildings: [],
          parks: [],
          parkingLots: []
        };

        // Filter intersecting roads
        this.cityData.roads.forEach(road => {
          if (this.rectIntersects(chunkRect, road)) {
            chunkData.roads.push(road);
          }
        });

        // Filter intersecting parks
        this.cityData.parks.forEach(park => {
          if (this.rectIntersects(chunkRect, park)) {
            chunkData.parks.push(park);
          }
        });

        // Filter intersecting parking lots
        this.cityData.parkingLots.forEach(parking => {
          if (this.rectIntersects(chunkRect, parking)) {
            chunkData.parkingLots.push(parking);
          }
        });

        // Filter intersecting buildings (including diagonal shadow margin)
        const shadowMargin = 20;
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

  rectIntersects(r1, r2) {
    return !(
      r2.x > r1.x + r1.width ||
      r2.x + r2.width < r1.x ||
      r2.y > r1.y + r1.height ||
      r2.y + r2.height < r1.y
    );
  }

  /**
   * Main per-frame update loop:
   * 1. Culls off-screen chunks
   * 2. Prioritizes visible chunks for progressive generation
   * 3. Renders a batch of chunks per frame
   * @param {Phaser.Cameras.Scene2D.Camera} camera 
   */
  update(camera) {
    // Determine visible bounding box in chunk coordinates
    // Camera worldView gives the visible rectangle accounting for zoom & scroll
    const worldView = camera.worldView;
    const padding = 32;

    const minCx = Math.max(0, Math.floor((worldView.x - padding) / this.chunkSize));
    const maxCx = Math.min(this.cols - 1, Math.floor((worldView.right + padding) / this.chunkSize));
    const minCy = Math.max(0, Math.floor((worldView.y - padding) / this.chunkSize));
    const maxCy = Math.min(this.rows - 1, Math.floor((worldView.bottom + padding) / this.chunkSize));

    let activeCount = 0;
    const priorityQueue = [];

    // Check visible chunks
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
          // Visible chunk needs urgent generation!
          priorityQueue.push(chunk);
        }
      }
    }

    // Hide any ready chunks that are outside the visible window
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

    // Process chunk generation queue (progressive rendering)
    const chunksToProcess = WORLD_CONFIG.chunksPerFrame;
    let processed = 0;

    // 1. First priority: chunks visible in current camera view
    while (priorityQueue.length > 0 && processed < chunksToProcess) {
      const chunk = priorityQueue.shift();
      if (chunk.status === 'unrendered') {
        this.renderChunk(chunk);
        processed++;
      }
    }

    // 2. Second priority: background pre-generation of nearby chunks
    if (processed < chunksToProcess) {
      // Find nearest unrendered chunk within expanded perimeter
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
  }

  /**
   * Renders a single 256x256 chunk into an HTML5 Canvas and registers it with Phaser.
   */
  renderChunk(chunk) {
    chunk.status = 'ready';

    const canvas = document.createElement('canvas');
    canvas.width = this.chunkSize;
    canvas.height = this.chunkSize;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 1. Terrain Base Fill
    ctx.fillStyle = PALETTE.groundHex;
    ctx.fillRect(0, 0, this.chunkSize, this.chunkSize);

    const ox = chunk.x;
    const oy = chunk.y;

    // 2. Render Roads & Markings
    chunk.roads.forEach(road => {
      const rx = road.x - ox;
      const ry = road.y - oy;

      // Sidewalk strips on road sides
      const sw = WORLD_CONFIG.sidewalkWidth;
      ctx.fillStyle = PALETTE.sidewalkHex;
      if (road.isHorizontal) {
        ctx.fillRect(rx, ry - sw, road.width, road.height + sw * 2);
      } else {
        ctx.fillRect(rx - sw, ry, road.width + sw * 2, road.height);
      }

      // Road Asphalt
      ctx.fillStyle = PALETTE.roadHex;
      ctx.fillRect(rx, ry, road.width, road.height);

      // Lane Dash Markings (faded yellow)
      ctx.fillStyle = PALETTE.roadMarkingHex;
      const dashLen = WORLD_CONFIG.laneMarkingLength;
      const dashGap = WORLD_CONFIG.laneMarkingGap;
      const step = dashLen + dashGap;

      if (road.isHorizontal) {
        const centerY = ry + road.height / 2;
        const startX = Math.floor(ox / step) * step;
        for (let lx = startX; lx < ox + this.chunkSize; lx += step) {
          const drawX = lx - ox;
          ctx.fillRect(drawX, centerY - 1, dashLen, 2);
        }
      } else {
        const centerX = rx + road.width / 2;
        const startY = Math.floor(oy / step) * step;
        for (let ly = startY; ly < oy + this.chunkSize; ly += step) {
          const drawY = ly - oy;
          ctx.fillRect(centerX - 1, drawY, 2, dashLen);
        }
      }
    });

    // 3. Render Parks
    chunk.parks.forEach(park => {
      const px = park.x - ox;
      const py = park.y - oy;
      ctx.fillStyle = PALETTE.grassDarkHex;
      ctx.fillRect(px, py, park.width, park.height);

      // Grass accents
      ctx.fillStyle = PALETTE.grassLightHex;
      ctx.fillRect(px + 2, py + 2, park.width - 4, park.height - 4);

      // Trees
      park.trees.forEach(tree => {
        const tx = tree.x - ox;
        const ty = tree.y - oy;
        if (tx >= -10 && tx <= this.chunkSize + 10 && ty >= -10 && ty <= this.chunkSize + 10) {
          // Tree shadow
          ctx.fillStyle = 'rgba(8, 7, 13, 0.5)';
          ctx.beginPath();
          ctx.ellipse(tx + 2, ty + 3, tree.radius, tree.radius * 0.7, 0, 0, Math.PI * 2);
          ctx.fill();

          // Dark foliage base
          ctx.fillStyle = PALETTE.treeDarkHex;
          ctx.beginPath();
          ctx.arc(tx, ty, tree.radius, 0, Math.PI * 2);
          ctx.fill();

          // Mid foliage
          ctx.fillStyle = PALETTE.treeMidHex;
          ctx.beginPath();
          ctx.arc(tx - 1, ty - 1, tree.radius * 0.75, 0, Math.PI * 2);
          ctx.fill();

          // Light highlight top-left
          ctx.fillStyle = PALETTE.treeLightHex;
          ctx.beginPath();
          ctx.arc(tx - 2, ty - 2, tree.radius * 0.4, 0, Math.PI * 2);
          ctx.fill();
        }
      });
    });

    // 4. Render Parking Lots
    chunk.parkingLots.forEach(parking => {
      const px = parking.x - ox;
      const py = parking.y - oy;
      ctx.fillStyle = PALETTE.parkingLotHex;
      ctx.fillRect(px, py, parking.width, parking.height);

      // Parking bay lines
      ctx.strokeStyle = PALETTE.parkingLineHex;
      ctx.lineWidth = 1;
      parking.bays.forEach(bay => {
        const bx = bay.x - ox;
        const by = bay.y - oy;
        ctx.strokeRect(bx, by, bay.width, bay.height);
      });
    });

    // 5. Render Building Shadows (Cast diagonally down-right)
    ctx.fillStyle = 'rgba(8, 7, 13, 0.65)';
    chunk.buildings.forEach(b => {
      const sx = b.x - ox + WORLD_CONFIG.shadowOffsetX;
      const sy = b.y - oy + WORLD_CONFIG.shadowOffsetY;

      if (b.shape === 'rect') {
        ctx.fillRect(sx, sy, b.width, b.height);
      } else if (b.shape === 'l_shape' && b.cutout) {
        ctx.fillRect(sx, sy, b.width, b.height);
        // Cutout the transparent void
        // Since we want transparent cutout for shadow, draw composite or fill segments
        // Segment 1: main rect
        // Segment 2: arm rect
        const cutX = b.cutout.x - ox + WORLD_CONFIG.shadowOffsetX;
        const cutY = b.cutout.y - oy + WORLD_CONFIG.shadowOffsetY;
        ctx.clearRect(cutX, cutY, b.cutout.width, b.cutout.height);
      }
    });

    // 6. Render Buildings (Roofs and Rooftop details)
    chunk.buildings.forEach(b => {
      const bx = b.x - ox;
      const by = b.y - oy;

      this.drawBuildingRoof(ctx, b, bx, by);
    });

    // Register Canvas Texture with Phaser
    const textureKey = `chunk_${chunk.key}`;
    if (this.scene.textures.exists(textureKey)) {
      this.scene.textures.remove(textureKey);
    }
    this.scene.textures.addCanvas(textureKey, canvas);

    // Create Phaser Image
    const img = this.scene.add.image(chunk.x, chunk.y, textureKey);
    img.setOrigin(0, 0);
    img.setDepth(0); // Underneath crowd and Kaiju
    chunk.image = img;
  }

  /**
   * Draws a pixel art building roof with edge highlights, beveled depth, and rooftop props.
   */
  drawBuildingRoof(ctx, b, bx, by) {
    const isL = b.shape === 'l_shape' && b.cutout;

    // Outer dark edge / base bevel
    ctx.fillStyle = b.roofDark;
    if (!isL) {
      ctx.fillRect(bx, by, b.width, b.height);
    } else {
      ctx.fillRect(bx, by, b.width, b.height);
      ctx.clearRect(b.cutout.x - (b.x - bx), b.cutout.y - (b.y - by), b.cutout.width, b.cutout.height);
      ctx.fillStyle = PALETTE.groundHex;
      ctx.fillRect(b.cutout.x - (b.x - bx), b.cutout.y - (b.y - by), b.cutout.width, b.cutout.height);
    }

    // Main roof color inset
    ctx.fillStyle = b.roofColor;
    if (!isL) {
      ctx.fillRect(bx + 1, by + 1, b.width - 2, b.height - 2);
    } else {
      const cx = b.cutout.x - (b.x - bx);
      const cy = b.cutout.y - (b.y - by);
      ctx.fillRect(bx + 1, by + 1, b.width - 2, b.height - 2);
      ctx.fillStyle = PALETTE.groundHex;
      ctx.fillRect(cx, cy, b.cutout.width, b.cutout.height);
    }

    // Top and Left edge bright highlights (gives crisp dramatic lit edge)
    ctx.fillStyle = b.roofHighlight;
    ctx.fillRect(bx, by, b.width, 2); // Top edge
    ctx.fillRect(bx, by, 2, b.height); // Left edge

    // Rooftop details (AC units, antennas, helipads)
    if (b.details && b.details.length > 0) {
      b.details.forEach(detail => {
        const dx = detail.x - (b.x - bx);
        const dy = detail.y - (b.y - by);

        if (detail.type === 'ac') {
          // AC chiller
          ctx.fillStyle = PALETTE.roofDetailDarkHex;
          ctx.fillRect(dx, dy, detail.width, detail.height);
          ctx.fillStyle = PALETTE.roofDetailLightHex;
          ctx.fillRect(dx + 1, dy + 1, detail.width - 2, 1); // grill line
          ctx.fillRect(dx + 1, dy + 3, detail.width - 2, 1);
        } else if (detail.type === 'antenna') {
          // Antenna pole and blinking light
          ctx.fillStyle = PALETTE.roofDetailLightHex;
          ctx.fillRect(dx, dy, 2, 6);
          ctx.fillStyle = '#ef4444'; // Red beacon
          ctx.fillRect(dx - 1, dy - 1, 4, 2);
        } else if (detail.type === 'helipad') {
          // Helipad circle
          ctx.strokeStyle = PALETTE.helipadRingHex;
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.arc(dx, dy, detail.radius, 0, Math.PI * 2);
          ctx.stroke();

          // Yellow 'H'
          ctx.fillStyle = PALETTE.helipadLetterHex;
          const hSize = Math.max(4, Math.floor(detail.radius * 0.6));
          // Left bar
          ctx.fillRect(dx - hSize / 2, dy - hSize / 2, 2, hSize);
          // Right bar
          ctx.fillRect(dx + hSize / 2 - 2, dy - hSize / 2, 2, hSize);
          // Center bar
          ctx.fillRect(dx - hSize / 2, dy - 1, hSize, 2);
        }
      });
    }
  }

  /**
   * Clean up all textures and images when scene shuts down
   */
  destroy() {
    this.chunks.forEach(chunk => {
      if (chunk.image) {
        chunk.image.destroy();
      }
      const textureKey = `chunk_${chunk.key}`;
      if (this.scene.textures.exists(textureKey)) {
        this.scene.textures.remove(textureKey);
      }
    });
    this.chunks.clear();
  }
}
