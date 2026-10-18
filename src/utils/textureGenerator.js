import { PALETTE } from '../config/palette.js';
import { GAME_CONFIG } from '../config/game.js';
import { WORLD_CONFIG } from '../config/world.js';

/**
 * Procedural Pixel Art Texture Generator
 * Generates all sprites and layer textures via Canvas without external image assets.
 */
export class TextureGenerator {
  /**
   * Generates all required game textures into the Phaser scene texture manager.
   * @param {Phaser.Scene} scene 
   */
  static generateAll(scene) {
    this.createKaijuTextures(scene);
    this.createElectricSkinTextures(scene);
    this.createPedestrianTextures(scene);
    this.createCarTextures(scene);
    this.createParticleTextures(scene);
  }

  /**
   * Kaiju Body, Feet, and Tail Segment textures
   */
  static createKaijuTextures(scene) {
    const size = GAME_CONFIG.kaiju.baseSize; // 56x56
    const half = size / 2;

    // 1. Kaiju Body (Top-down view)
    // Facing RIGHT (0 radians / standard Phaser orientation)
    if (!scene.textures.exists('kaiju_body')) {
      const canvas = scene.textures.createCanvas('kaiju_body', size, size);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Dark shadow underneath body
      ctx.fillStyle = 'rgba(10, 8, 16, 0.4)';
      ctx.beginPath();
      ctx.ellipse(half + 2, half + 3, 20, 16, 0, 0, Math.PI * 2);
      ctx.fill();

      // Outer Silhouette / Dark Outline
      ctx.fillStyle = PALETTE.kaijuGreenDarkHex;
      ctx.beginPath();
      // Main torso oval
      ctx.ellipse(half - 2, half, 18, 14, 0, 0, Math.PI * 2);
      // Head base extending to the right
      ctx.ellipse(half + 14, half, 11, 9, 0, 0, Math.PI * 2);
      // Forelimb shoulders
      ctx.ellipse(half + 6, half - 13, 7, 5, -0.4, 0, Math.PI * 2);
      ctx.ellipse(half + 6, half + 13, 7, 5, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Kaiju Main Body Green
      ctx.fillStyle = PALETTE.kaijuGreenHex;
      ctx.beginPath();
      ctx.ellipse(half - 2, half, 16, 12, 0, 0, Math.PI * 2);
      ctx.ellipse(half + 14, half, 9, 7, 0, 0, Math.PI * 2);
      ctx.ellipse(half + 6, half - 12, 5, 4, -0.4, 0, Math.PI * 2);
      ctx.ellipse(half + 6, half + 12, 5, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Scaled Arm Claws
      ctx.fillStyle = PALETTE.kaijuGreenLightHex;
      // Right arm claws
      ctx.fillRect(half + 12, half - 15, 3, 2);
      ctx.fillRect(half + 10, half - 17, 3, 2);
      // Left arm claws
      ctx.fillRect(half + 12, half + 13, 3, 2);
      ctx.fillRect(half + 10, half + 15, 3, 2);

      // Dorsal Plates / Spines along the spine (center axis)
      const dorsalX = [half - 14, half - 8, half - 2, half + 4, half + 9];
      const dorsalSizes = [3, 4, 5, 4, 3];
      for (let i = 0; i < dorsalX.length; i++) {
        const x = dorsalX[i];
        const s = dorsalSizes[i];
        // Dark base
        ctx.fillStyle = PALETTE.kaijuDorsalFinHex;
        ctx.fillRect(x - 2, half - s, 4, s * 2);
        // Highlight edge
        ctx.fillStyle = PALETTE.kaijuGreenLightHex;
        ctx.fillRect(x - 1, half - Math.floor(s / 2), 2, s);
      }

      // Snout details / nostrils
      ctx.fillStyle = PALETTE.kaijuGreenDarkHex;
      ctx.fillRect(half + 21, half - 2, 2, 1);
      ctx.fillRect(half + 21, half + 1, 2, 1);

      // Yellow Kaiju Eyes (Angled predator eyes on sides of head)
      ctx.fillStyle = PALETTE.kaijuEyeYellowHex;
      // Top eye
      ctx.beginPath();
      ctx.ellipse(half + 16, half - 5, 3, 2, -0.3, 0, Math.PI * 2);
      ctx.fill();
      // Bottom eye
      ctx.beginPath();
      ctx.ellipse(half + 16, half + 5, 3, 2, 0.3, 0, Math.PI * 2);
      ctx.fill();

      // Slit pupils
      ctx.fillStyle = PALETTE.kaijuEyePupilHex;
      ctx.fillRect(half + 16, half - 6, 1, 3);
      ctx.fillRect(half + 16, half + 4, 1, 3);

      // Eye highlight spark
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(half + 17, half - 5, 1, 1);
      ctx.fillRect(half + 17, half + 5, 1, 1);

      canvas.refresh();
    }

    // 2. Kaiju Foot Texture (for stepping animation)
    if (!scene.textures.exists('kaiju_foot')) {
      const footCanvas = scene.textures.createCanvas('kaiju_foot', 16, 12);
      const fctx = footCanvas.getContext('2d');
      fctx.imageSmoothingEnabled = false;

      // Dark foot base
      fctx.fillStyle = PALETTE.kaijuGreenDarkHex;
      fctx.beginPath();
      fctx.ellipse(7, 6, 6, 4, 0, 0, Math.PI * 2);
      fctx.fill();

      // Green foot
      fctx.fillStyle = PALETTE.kaijuGreenHex;
      fctx.beginPath();
      fctx.ellipse(6, 6, 5, 3, 0, 0, Math.PI * 2);
      fctx.fill();

      // 3 Claws pointing outward
      fctx.fillStyle = PALETTE.kaijuGreenLightHex;
      fctx.fillRect(11, 3, 3, 2);
      fctx.fillRect(12, 5, 3, 2);
      fctx.fillRect(11, 7, 3, 2);

      footCanvas.refresh();
    }

    // 3. Tail Segments (Decreasing size)
    const { segmentRadius } = GAME_CONFIG.kaiju.tail;
    for (let i = 0; i < segmentRadius.length; i++) {
      const key = `kaiju_tail_${i}`;
      if (!scene.textures.exists(key)) {
        const r = segmentRadius[i];
        const segSize = (r + 4) * 2;
        const segHalf = segSize / 2;
        const scanvas = scene.textures.createCanvas(key, segSize, segSize);
        const sctx = scanvas.getContext('2d');
        sctx.imageSmoothingEnabled = false;

        // Base dark outline
        sctx.fillStyle = PALETTE.kaijuGreenDarkHex;
        sctx.beginPath();
        sctx.arc(segHalf, segHalf, r + 1, 0, Math.PI * 2);
        sctx.fill();

        // Green body
        sctx.fillStyle = PALETTE.kaijuGreenHex;
        sctx.beginPath();
        sctx.arc(segHalf, segHalf, r - 0.5, 0, Math.PI * 2);
        sctx.fill();

        // Center spine plate
        sctx.fillStyle = PALETTE.kaijuDorsalFinHex;
        const spineH = Math.max(2, Math.floor(r * 0.9));
        sctx.fillRect(segHalf - 1, segHalf - spineH, 3, spineH * 2);

        // Highlight
        sctx.fillStyle = PALETTE.kaijuGreenLightHex;
        sctx.fillRect(segHalf, segHalf - Math.floor(spineH / 2), 1, spineH);

        scanvas.refresh();
      }
    }
  }

  /**
   * Electric Skin Layer (Animated spark frames for 'skin_overlay' slot)
   */
  static createElectricSkinTextures(scene) {
    const size = GAME_CONFIG.kaiju.baseSize; // 56x56
    const half = size / 2;

    for (let frame = 0; frame < 3; frame++) {
      const key = `kaiju_electric_skin_${frame}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, size, size);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Procedural electric arcs crackling around body perimeter
        ctx.strokeStyle = PALETTE.electricSparkLightHex;
        ctx.lineWidth = 1.5;

        const numArcs = 8;
        for (let a = 0; a < numArcs; a++) {
          const baseAngle = (a / numArcs) * Math.PI * 2 + (frame * 0.7);
          const rBase = 18 + ((a * 7 + frame * 5) % 8);
          const startX = half + Math.cos(baseAngle) * (rBase - 4);
          const startY = half + Math.sin(baseAngle) * (rBase - 4);
          const midX = half + Math.cos(baseAngle + 0.2) * (rBase + 4);
          const midY = half + Math.sin(baseAngle + 0.2) * (rBase + 4);
          const endX = half + Math.cos(baseAngle + 0.35) * (rBase + 1);
          const endY = half + Math.sin(baseAngle + 0.35) * (rBase + 1);

          ctx.beginPath();
          ctx.moveTo(startX, startY);
          ctx.lineTo(midX, midY);
          ctx.lineTo(endX, endY);
          ctx.stroke();

          // Spark particle dots
          ctx.fillStyle = PALETTE.electricSparkMidHex;
          ctx.fillRect(Math.round(midX) - 1, Math.round(midY) - 1, 2, 2);
        }

        // Faint electric glow aura
        ctx.fillStyle = 'rgba(34, 211, 238, 0.15)';
        ctx.beginPath();
        ctx.arc(half, half, 22, 0, Math.PI * 2);
        ctx.fill();

        canvas.refresh();
      }
    }
  }

  /**
   * Pedestrian Textures (3x4 px)
   */
  static createPedestrianTextures(scene) {
    const { width, height } = WORLD_CONFIG.pedestrianSize; // 3x4
    PALETTE.pedestrianClothes.forEach((color, idx) => {
      const key = `pedestrian_${idx}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Top pixel: Head
        ctx.fillStyle = PALETTE.pedestrianSkinHex;
        ctx.fillRect(1, 0, 1, 1);

        // Middle pixels: Clothes
        ctx.fillStyle = `#${color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(0, 1, 3, 2);

        // Bottom pixels: Pants / Shoes
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(0, 3, 1, 1);
        ctx.fillRect(2, 3, 1, 1);

        canvas.refresh();
      }
    });
  }

  /**
   * Car Textures (8x4 px normal, and 18x8 px with illuminated headlight beams)
   */
  static createCarTextures(scene) {
    const { width, height } = WORLD_CONFIG.carSize; // 8x4

    PALETTE.carBodies.forEach((color, idx) => {
      const bodyHex = `#${color.toString(16).padStart(6, '0')}`;

      // 1. Normal Car (8x4)
      const normalKey = `car_${idx}`;
      if (!scene.textures.exists(normalKey)) {
        const canvas = scene.textures.createCanvas(normalKey, width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(1, 0, 2, 1);
        ctx.fillRect(5, 0, 2, 1);
        ctx.fillRect(1, 3, 2, 1);
        ctx.fillRect(5, 3, 2, 1);

        // Body
        ctx.fillStyle = bodyHex;
        ctx.fillRect(0, 0, width, height);

        // Windshields
        ctx.fillStyle = PALETTE.carWindowHex;
        ctx.fillRect(5, 1, 1, 2);
        ctx.fillRect(2, 1, 1, 2);

        // Headlights
        ctx.fillStyle = PALETTE.carHeadlightHex;
        ctx.fillRect(7, 0, 1, 1);
        ctx.fillRect(7, 3, 1, 1);

        // Taillights
        ctx.fillStyle = PALETTE.carTaillightHex;
        ctx.fillRect(0, 0, 1, 1);
        ctx.fillRect(0, 3, 1, 1);

        canvas.refresh();
      }

      // 2. Car with Illuminated Headlights (18x8 px, car at x=2, y=2, beam extends forward)
      const lightKey = `car_headlights_${idx}`;
      if (!scene.textures.exists(lightKey)) {
        const fullW = 20;
        const fullH = 10;
        const canvas = scene.textures.createCanvas(lightKey, fullW, fullH);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        const carX = 1;
        const carY = 3;

        // Headlight beams projected forward from x=9 to 20
        const grad = ctx.createLinearGradient(carX + width, carY + 2, fullW, carY + 2);
        grad.addColorStop(0, 'rgba(254, 240, 138, 0.40)');
        grad.addColorStop(0.5, 'rgba(254, 240, 138, 0.18)');
        grad.addColorStop(1, 'rgba(254, 240, 138, 0)');

        ctx.fillStyle = grad;
        // Top headlight beam cone
        ctx.beginPath();
        ctx.moveTo(carX + width, carY);
        ctx.lineTo(fullW, carY - 2);
        ctx.lineTo(fullW, carY + 2);
        ctx.closePath();
        ctx.fill();

        // Bottom headlight beam cone
        ctx.beginPath();
        ctx.moveTo(carX + width, carY + height);
        ctx.lineTo(fullW, carY + height - 2);
        ctx.lineTo(fullW, carY + height + 2);
        ctx.closePath();
        ctx.fill();

        // Wheels
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(carX + 1, carY + 0, 2, 1);
        ctx.fillRect(carX + 5, carY + 0, 2, 1);
        ctx.fillRect(carX + 1, carY + 3, 2, 1);
        ctx.fillRect(carX + 5, carY + 3, 2, 1);

        // Body
        ctx.fillStyle = bodyHex;
        ctx.fillRect(carX, carY, width, height);

        // Windshields
        ctx.fillStyle = PALETTE.carWindowHex;
        ctx.fillRect(carX + 5, carY + 1, 1, 2);
        ctx.fillRect(carX + 2, carY + 1, 1, 2);

        // Glowing Headlights
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(carX + 7, carY + 0, 1, 1);
        ctx.fillRect(carX + 7, carY + 3, 1, 1);

        // Taillights
        ctx.fillStyle = PALETTE.carTaillightHex;
        ctx.fillRect(carX, carY + 0, 1, 1);
        ctx.fillRect(carX, carY + 3, 1, 1);

        canvas.refresh();
      }
    });
  }

  /**
   * Small utility particle / helper textures
   */
  static createParticleTextures(scene) {
    if (!scene.textures.exists('dust_particle')) {
      const canvas = scene.textures.createCanvas('dust_particle', 4, 4);
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'rgba(75, 85, 99, 0.6)';
      ctx.fillRect(0, 0, 4, 4);
      canvas.refresh();
    }
  }
}
