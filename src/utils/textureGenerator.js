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
    this.createEnemyTextures(scene);
    this.createParticleTextures(scene);
    this.createCardAndWeaponTextures(scene);
    this.createMutationTextures(scene);
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
   * Procedural Enemy Textures - Tahap 3A
   * Generates pixel-art sprites for:
   * 1. Panicking Citizens (3x4 px) in diverse clothes
   * 2. Police Officers (4x5 px) in navy uniform with cap & gun
   * 3. Police Cruisers (9x5 px) with flashing dual-color siren lightbar
   */
  static createEnemyTextures(scene) {
    // 1. Panicking Citizens (3x4 px, 4 clothing color variations)
    const citizenClothes = ['#e06d53', '#eab308', '#0d9488', '#8b5cf6'];
    citizenClothes.forEach((clothColor, idx) => {
      const key = `enemy_citizen_${idx}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, 3, 4);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Head
        ctx.fillStyle = PALETTE.pedestrianSkinHex;
        ctx.fillRect(1, 0, 1, 1);

        // Clothes
        ctx.fillStyle = clothColor;
        ctx.fillRect(0, 1, 3, 2);

        // Legs / Shoes
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 3, 1, 1);
        ctx.fillRect(2, 3, 1, 1);

        canvas.refresh();
      }
    });

    // 2. Police Officer (4x5 px)
    if (!scene.textures.exists('enemy_police')) {
      const canvas = scene.textures.createCanvas('enemy_police', 4, 5);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Dark Blue Cap with Gold Badge
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(1, 0, 2, 1);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(1, 0, 1, 1);

      // Face
      ctx.fillStyle = PALETTE.pedestrianSkinHex;
      ctx.fillRect(1, 1, 2, 1);

      // Navy Uniform & White belt
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(0, 2, 4, 2);
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(1, 3, 2, 1); // Belt

      // Gun Holster / Muzzle pointed forward
      ctx.fillStyle = '#475569';
      ctx.fillRect(3, 2, 1, 1);

      // Dark Pants & Boots
      ctx.fillStyle = '#020617';
      ctx.fillRect(0, 4, 1, 1);
      ctx.fillRect(2, 4, 1, 1);

      canvas.refresh();
    }

    // 3. Police Cruiser (9x5 px, 2 frames for alternating siren flash)
    for (let f = 0; f < 2; f++) {
      const key = `enemy_police_car_${f}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, 9, 5);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Tires
        ctx.fillStyle = '#020617';
        ctx.fillRect(1, 0, 2, 1);
        ctx.fillRect(6, 0, 2, 1);
        ctx.fillRect(1, 4, 2, 1);
        ctx.fillRect(6, 4, 2, 1);

        // Body: Dark Navy Bumpers, White Doors in Middle
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 1, 9, 3);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(2, 1, 5, 3); // White door panels

        // Windshields
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(6, 1, 1, 3); // Front windshield
        ctx.fillRect(2, 1, 1, 3); // Rear windshield

        // Sirens: Frame 0 (Red Top, Blue Bottom), Frame 1 (Blue Top, Red Bottom)
        const topSiren = f === 0 ? '#ef4444' : '#3b82f6';
        const bottomSiren = f === 0 ? '#3b82f6' : '#ef4444';
        ctx.fillStyle = topSiren;
        ctx.fillRect(4, 1, 1, 1);
        ctx.fillStyle = bottomSiren;
        ctx.fillRect(4, 3, 1, 1);

        // Headlights (facing Right)
        ctx.fillStyle = '#fef08a';
        ctx.fillRect(8, 1, 1, 1);
        ctx.fillRect(8, 3, 1, 1);

        canvas.refresh();
      }
    }

    // 4. Military Tank (14x10 px, facing Right)
    if (!scene.textures.exists('enemy_tank')) {
      const canvas = scene.textures.createCanvas('enemy_tank', 14, 10);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Heavy Caterpillar Tread Tracks (Top & Bottom)
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(0, 0, 12, 2); // Top tread
      ctx.fillRect(0, 8, 12, 2); // Bottom tread

      // Tread notches / bogie wheels
      ctx.fillStyle = '#44403c';
      for (let tx = 1; tx < 11; tx += 3) {
        ctx.fillRect(tx, 0, 1, 2);
        ctx.fillRect(tx, 8, 1, 2);
      }

      // Main Armored Hull (Olive drab camouflage)
      ctx.fillStyle = '#3a4a32';
      ctx.fillRect(1, 2, 10, 6);

      // Armor plating highlights & shadows
      ctx.fillStyle = '#4b5e41';
      ctx.fillRect(2, 2, 9, 1); // Top hull highlight
      ctx.fillStyle = '#283322';
      ctx.fillRect(1, 7, 10, 1); // Bottom shadow

      // Front sloped glacis plate
      ctx.fillStyle = '#526647';
      ctx.fillRect(9, 3, 2, 4);

      // Rotating Turret Dome
      ctx.fillStyle = '#2b3725';
      ctx.fillRect(3, 3, 5, 4);
      ctx.fillStyle = '#3c4c34';
      ctx.fillRect(4, 3, 3, 1); // Turret top highlight
      // Commander Hatch
      ctx.fillStyle = '#1b2217';
      ctx.fillRect(4, 4, 2, 2);

      // Heavy Cannon Barrel (pointing East / Right)
      ctx.fillStyle = '#222b1d';
      ctx.fillRect(8, 4, 5, 2);
      // Muzzle brake at tip
      ctx.fillStyle = '#141a12';
      ctx.fillRect(12, 3, 2, 4);

      canvas.refresh();
    }

    // 5. Military Soldier (4x5 px, Olive Drab & Combat Helmet)
    if (!scene.textures.exists('enemy_soldier')) {
      const canvas = scene.textures.createCanvas('enemy_soldier', 4, 5);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Dark Military Helmet
      ctx.fillStyle = '#283322';
      ctx.fillRect(1, 0, 2, 1);
      ctx.fillStyle = '#1f271a';
      ctx.fillRect(1, 0, 1, 1);

      // Face
      ctx.fillStyle = PALETTE.pedestrianSkinHex;
      ctx.fillRect(1, 1, 2, 1);

      // Camouflage Fatigue Uniform
      ctx.fillStyle = '#3f4a36';
      ctx.fillRect(0, 2, 4, 2);
      ctx.fillStyle = '#4d5b42';
      ctx.fillRect(1, 2, 2, 1);

      // Assault Rifle barrel pointing Right
      ctx.fillStyle = '#18181b';
      ctx.fillRect(3, 2, 1, 1);

      // Combat Boots
      ctx.fillStyle = '#141a12';
      ctx.fillRect(0, 4, 1, 1);
      ctx.fillRect(2, 4, 1, 1);

      canvas.refresh();
    }

    // 6. Attack Helicopter (16x16 px, 2 Frames for spinning 4-blade rotor)
    for (let f = 0; f < 2; f++) {
      const key = `enemy_helicopter_${f}`;
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, 16, 16);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;

        // Tail boom & tail rotor
        ctx.fillStyle = '#273022';
        ctx.fillRect(1, 7, 4, 2);
        ctx.fillStyle = '#18181b';
        ctx.fillRect(0, 5, 2, 6); // Tail rotor

        // Weapon pods on sides
        ctx.fillStyle = '#18181b';
        ctx.fillRect(6, 4, 3, 1);
        ctx.fillRect(6, 11, 3, 1);

        // Main fuselage
        ctx.fillStyle = '#384330';
        ctx.fillRect(4, 5, 8, 6);
        ctx.fillStyle = '#46533c';
        ctx.fillRect(5, 6, 6, 4);

        // Cockpit canopy windshield (Facing Right / East)
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(10, 6, 3, 4);
        ctx.fillStyle = '#bae6fd';
        ctx.fillRect(11, 7, 2, 2);

        // Spinning 4-Blade Rotor
        ctx.fillStyle = '#0f172a';
        if (f === 0) {
          // Horizontal & Vertical cross blades (+)
          ctx.fillRect(1, 7, 14, 2);
          ctx.fillRect(7, 1, 2, 14);
        } else {
          // Diagonal cross blades (X)
          for (let d = 2; d <= 13; d++) {
            ctx.fillRect(d, d, 2, 2);
            ctx.fillRect(d, 15 - d, 2, 2);
          }
        }

        // Rotor Mast Hub
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(7, 7, 2, 2);

        canvas.refresh();
      }
    }

    // Helicopter Ground Shadow (16x16 px)
    if (!scene.textures.exists('enemy_helicopter_shadow')) {
      const canvas = scene.textures.createCanvas('enemy_helicopter_shadow', 16, 16);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Rotor blur disk shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
      ctx.beginPath();
      ctx.arc(8, 8, 7, 0, Math.PI * 2);
      ctx.fill();

      // Fuselage silhouette
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      ctx.fillRect(4, 6, 8, 4);
      ctx.fillRect(1, 7, 4, 2);
      canvas.refresh();
    }

    // 7. Kamikaze Drone (6x6 px)
    if (!scene.textures.exists('enemy_drone')) {
      const canvas = scene.textures.createCanvas('enemy_drone', 6, 6);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      // Motor arms at corners
      ctx.fillStyle = '#18181b';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(5, 0, 1, 1);
      ctx.fillRect(0, 5, 1, 1);
      ctx.fillRect(5, 5, 1, 1);

      // Crimson fuselage
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(1, 1, 4, 4);

      // Warning targeter core (glowing yellow/white)
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(2, 2, 2, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(2, 2, 1, 1);

      canvas.refresh();
    }

    // Drone Ground Shadow (6x6 px)
    if (!scene.textures.exists('enemy_drone_shadow')) {
      const canvas = scene.textures.createCanvas('enemy_drone_shadow', 6, 6);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      ctx.beginPath();
      ctx.arc(3, 3, 2.5, 0, Math.PI * 2);
      ctx.fill();
      canvas.refresh();
    }
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

  /**
   * Generates 16x16 pixel art icons for cards/weapons and XP crystals
   */
  static createCardAndWeaponTextures(scene) {
    // 1. Small XP Crystal (5x5 px diamond)
    if (!scene.textures.exists('xp_crystal_small')) {
      const canvas = scene.textures.createCanvas('xp_crystal_small', 5, 5);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#0891b2'; // Cyan border
      ctx.fillRect(2, 0, 1, 1);
      ctx.fillRect(1, 1, 3, 3);
      ctx.fillRect(2, 4, 1, 1);

      ctx.fillStyle = '#22d3ee'; // Bright cyan body
      ctx.fillRect(2, 1, 1, 3);
      ctx.fillRect(1, 2, 3, 1);

      ctx.fillStyle = '#ffffff'; // White glint
      ctx.fillRect(2, 2, 1, 1);
      canvas.refresh();
    }

    // 2. Large XP Crystal (7x7 px diamond)
    if (!scene.textures.exists('xp_crystal_large')) {
      const canvas = scene.textures.createCanvas('xp_crystal_large', 7, 7);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;

      ctx.fillStyle = '#047857'; // Emerald border
      ctx.fillRect(3, 0, 1, 1);
      ctx.fillRect(2, 1, 3, 5);
      ctx.fillRect(1, 2, 5, 3);
      ctx.fillRect(3, 6, 1, 1);

      ctx.fillStyle = '#10b981'; // Bright emerald body
      ctx.fillRect(2, 2, 3, 3);
      ctx.fillRect(3, 1, 1, 5);
      ctx.fillRect(1, 3, 5, 1);

      ctx.fillStyle = '#a7f3d0'; // Highlight
      ctx.fillRect(3, 2, 2, 2);

      ctx.fillStyle = '#ffffff'; // White glint
      ctx.fillRect(3, 3, 1, 1);
      canvas.refresh();
    }

    // Helper to generate a 16x16 icon canvas
    const createIcon = (key, drawFn) => {
      if (!scene.textures.exists(key)) {
        const canvas = scene.textures.createCanvas(key, 16, 16);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        // Dark background base
        ctx.fillStyle = '#111019';
        ctx.fillRect(0, 0, 16, 16);
        drawFn(ctx);
        canvas.refresh();
      }
    };

    // 3. Icon Cakar (Triple golden claw scratches)
    createIcon('icon_claw', (ctx) => {
      ctx.fillStyle = '#f59e0b'; // Gold
      // 3 claw slashes
      ctx.fillRect(3, 4, 2, 3);
      ctx.fillRect(4, 6, 2, 4);
      ctx.fillRect(5, 9, 2, 4);

      ctx.fillRect(7, 2, 2, 4);
      ctx.fillRect(8, 5, 2, 4);
      ctx.fillRect(9, 8, 2, 5);

      ctx.fillRect(11, 4, 2, 4);
      ctx.fillRect(12, 7, 2, 4);
      ctx.fillRect(13, 10, 2, 3);

      // Highlights
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(4, 4, 1, 2);
      ctx.fillRect(8, 2, 1, 2);
      ctx.fillRect(12, 4, 1, 2);
    });

    // 4. Icon Meriam Punggung (Twin cannon barrels)
    createIcon('icon_cannon', (ctx) => {
      // Gun base mount
      ctx.fillStyle = '#334155';
      ctx.fillRect(2, 4, 5, 8);
      // Twin Barrels
      ctx.fillStyle = '#64748b';
      ctx.fillRect(7, 5, 6, 2);
      ctx.fillRect(7, 9, 6, 2);
      // Steel highlights
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(7, 5, 5, 1);
      ctx.fillRect(7, 9, 5, 1);
      // Muzzle flash sparks
      ctx.fillStyle = '#f97316';
      ctx.fillRect(13, 4, 2, 4);
      ctx.fillRect(13, 8, 2, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(14, 5, 1, 2);
      ctx.fillRect(14, 9, 1, 2);
    });

    // 5. Icon Kulit Listrik (Cyan/Yellow Lightning Zap)
    createIcon('icon_electric', (ctx) => {
      ctx.fillStyle = '#38bdf8'; // Blue aura glow
      ctx.fillRect(8, 1, 4, 4);
      ctx.fillRect(6, 4, 5, 4);
      ctx.fillRect(4, 7, 6, 4);
      ctx.fillRect(7, 10, 4, 5);

      ctx.fillStyle = '#facc15'; // Bright yellow bolt
      ctx.fillRect(9, 2, 2, 3);
      ctx.fillRect(7, 5, 3, 3);
      ctx.fillRect(5, 8, 4, 3);
      ctx.fillRect(8, 11, 2, 3);

      ctx.fillStyle = '#ffffff'; // White core
      ctx.fillRect(8, 6, 1, 2);
      ctx.fillRect(6, 9, 1, 2);
    });

    // 6. Icon Kulit Baja (Steel Plate Shield)
    createIcon('icon_iron_skin', (ctx) => {
      ctx.fillStyle = '#475569';
      ctx.fillRect(3, 2, 10, 8);
      ctx.fillRect(4, 10, 8, 3);
      ctx.fillRect(5, 13, 6, 2);
      ctx.fillRect(7, 15, 2, 1);

      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(4, 3, 8, 6);
      ctx.fillRect(5, 9, 6, 3);

      // Steel cross reflection
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(7, 4, 2, 8);
      ctx.fillRect(5, 6, 6, 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(7, 6, 2, 2);
    });

    // 7. Icon Regenerasi (Green Medical Cross)
    createIcon('icon_regen', (ctx) => {
      ctx.fillStyle = '#15803d';
      ctx.fillRect(6, 2, 4, 12);
      ctx.fillRect(2, 6, 12, 4);

      ctx.fillStyle = '#22c55e';
      ctx.fillRect(7, 3, 2, 10);
      ctx.fillRect(3, 7, 10, 2);

      ctx.fillStyle = '#bbf7d0';
      ctx.fillRect(7, 7, 2, 2);
    });

    // 8. Icon Magnet XP (Horseshoe Magnet)
    createIcon('icon_magnet', (ctx) => {
      // Red north pole
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(3, 2, 3, 8);
      ctx.fillRect(3, 10, 10, 3);
      // Blue south pole
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(10, 2, 3, 8);
      // Silver tips
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(3, 2, 3, 2);
      ctx.fillRect(10, 2, 3, 2);
      // Energy spark in center
      ctx.fillStyle = '#06b6d4';
      ctx.fillRect(7, 5, 2, 2);
    });

    // 9. Icon Kaki Perkasa (Winged Speed Boot)
    createIcon('icon_swift', (ctx) => {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(3, 5, 6, 7);
      ctx.fillRect(3, 9, 10, 4);

      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(4, 6, 4, 5);
      ctx.fillRect(4, 10, 8, 2);

      // Speed feathers
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(1, 3, 4, 2);
      ctx.fillRect(2, 5, 3, 2);
    });

    // 10. Icon Tubuh Raksasa (Titan Footprint)
    createIcon('icon_colossus', (ctx) => {
      ctx.fillStyle = '#065f46';
      ctx.fillRect(4, 6, 8, 8);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(5, 7, 6, 6);
      // 3 Claws
      ctx.fillStyle = '#34d399';
      ctx.fillRect(3, 2, 2, 3);
      ctx.fillRect(7, 1, 2, 4);
      ctx.fillRect(11, 2, 2, 3);
    });

    // 11. Icon Pembunuh (Crossed Blades with Blood)
    createIcon('icon_carnage', (ctx) => {
      ctx.fillStyle = '#94a3b8';
      // Diagonal blade 1
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(3 + i, 3 + i, 2, 2);
      }
      // Diagonal blade 2
      for (let i = 0; i < 10; i++) {
        ctx.fillRect(12 - i, 3 + i, 2, 2);
      }
      // Blood drops
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(8, 2, 2, 3);
      ctx.fillRect(12, 12, 2, 2);
      ctx.fillRect(2, 12, 2, 2);
    });

    // 12. Icon Cepat Tembak (Stopwatch with Speed Streaks)
    createIcon('icon_rapid', (ctx) => {
      ctx.fillStyle = '#d97706';
      ctx.beginPath();
      ctx.arc(8, 9, 6, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#fde047';
      ctx.beginPath();
      ctx.arc(8, 9, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#78350f';
      ctx.fillRect(7, 2, 2, 2); // Button
      ctx.fillRect(8, 7, 1, 3); // Hand
      ctx.fillRect(8, 9, 3, 1);

      // Speed streaks
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(1, 4, 3, 1);
      ctx.fillRect(1, 8, 2, 1);
    });

    // 13. Icon Penghancur Kota (Collapsing Skyscraper)
    createIcon('icon_demolisher', (ctx) => {
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(4, 4, 8, 11);
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(5, 5, 6, 9);
      // Windows
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(6, 6, 1, 2);
      ctx.fillRect(8, 6, 1, 2);
      ctx.fillRect(6, 10, 1, 2);
      ctx.fillRect(8, 10, 1, 2);
      // Fracture crack
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(5, 8, 6, 1);
    });

    // 14. Icon Sisik Duri (Spike Shell)
    createIcon('icon_thorns', (ctx) => {
      ctx.fillStyle = '#9d174d';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillStyle = '#f43f5e';
      ctx.fillRect(5, 5, 6, 6);
      // 4 Spikes
      ctx.fillStyle = '#fbcfe8';
      ctx.fillRect(7, 1, 2, 3);
      ctx.fillRect(7, 12, 2, 3);
      ctx.fillRect(1, 7, 3, 2);
      ctx.fillRect(12, 7, 3, 2);
    });
  }

  /**
   * Procedural Visual Mutation Textures (Tahap 4B-1)
   * Detailed, modular layers corresponding to weapons at level tiers 1, 3, 5.
   * Rendered on top of Kaiju body/slots with zero external image files.
   */
  static createMutationTextures(scene) {
    const size = GAME_CONFIG.kaiju.baseSize; // 56x56
    const half = size / 2; // 28

    const createLayer = (key, drawFn) => {
      if (scene.textures.exists(key)) return;
      const canvas = scene.textures.createCanvas(key, size, size);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      drawFn(ctx, half, size);
      canvas.refresh();
    };

    // 1. CLAW (Cakar) - Forelimb raptor talons
    createLayer('mutation_claw_1', (ctx, h) => {
      ctx.fillStyle = '#fef08a';
      // Right arm claws
      ctx.fillRect(h + 13, h - 16, 4, 2);
      ctx.fillRect(h + 11, h - 18, 4, 2);
      // Left arm claws
      ctx.fillRect(h + 13, h + 14, 4, 2);
      ctx.fillRect(h + 11, h + 16, 4, 2);
    });

    createLayer('mutation_claw_3', (ctx, h) => {
      // Dark under-claw
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(h + 12, h - 18, 6, 4);
      ctx.fillRect(h + 12, h + 14, 6, 4);
      // Emerald razor talons
      ctx.fillStyle = '#10b981';
      ctx.fillRect(h + 14, h - 18, 5, 2);
      ctx.fillRect(h + 12, h - 20, 5, 2);
      ctx.fillRect(h + 14, h + 16, 5, 2);
      ctx.fillRect(h + 12, h + 18, 5, 2);
      // Highlight edge
      ctx.fillStyle = '#a7f3d0';
      ctx.fillRect(h + 17, h - 18, 2, 1);
      ctx.fillRect(h + 15, h - 20, 2, 1);
      ctx.fillRect(h + 17, h + 17, 2, 1);
      ctx.fillRect(h + 15, h + 19, 2, 1);
    });

    createLayer('mutation_claw_5', (ctx, h) => {
      // Massive glowing jade & gold bone scythe talons
      ctx.fillStyle = '#042f2e';
      ctx.fillRect(h + 10, h - 21, 9, 6);
      ctx.fillRect(h + 10, h + 15, 9, 6);
      // Glowing green blades
      ctx.fillStyle = '#34d399';
      ctx.fillRect(h + 14, h - 21, 6, 3);
      ctx.fillRect(h + 12, h - 23, 6, 3);
      ctx.fillRect(h + 14, h + 18, 6, 3);
      ctx.fillRect(h + 12, h + 20, 6, 3);
      // Gold lightning highlights
      ctx.fillStyle = '#fde047';
      ctx.fillRect(h + 18, h - 20, 3, 2);
      ctx.fillRect(h + 16, h - 22, 3, 2);
      ctx.fillRect(h + 18, h + 19, 3, 2);
      ctx.fillRect(h + 16, h + 21, 3, 2);
      // Spark dots
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h + 20, h - 20, 1, 1);
      ctx.fillRect(h + 20, h + 20, 1, 1);
    });

    // 2. BACK CANNON (Meriam Punggung) - Dual heavy artillery barrels
    createLayer('mutation_back_cannon_1', (ctx, h) => {
      ctx.fillStyle = '#1e293b'; // Gunmetal mount
      ctx.fillRect(h - 11, h - 12, 10, 4);
      ctx.fillRect(h - 11, h + 8, 10, 4);
      ctx.fillStyle = '#475569'; // Barrels
      ctx.fillRect(h - 8, h - 11, 8, 2);
      ctx.fillRect(h - 8, h + 9, 8, 2);
    });

    createLayer('mutation_back_cannon_3', (ctx, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(h - 13, h - 13, 13, 5);
      ctx.fillRect(h - 13, h + 8, 13, 5);
      // Heavy rifled barrels
      ctx.fillStyle = '#64748b';
      ctx.fillRect(h - 9, h - 12, 11, 3);
      ctx.fillRect(h - 9, h + 9, 11, 3);
      // Muzzle brakes & recoil springs
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h + 1, h - 13, 2, 5);
      ctx.fillRect(h + 1, h + 8, 2, 5);
    });

    createLayer('mutation_back_cannon_5', (ctx, h) => {
      // Railgun battery with glowing cyan energy coils
      ctx.fillStyle = '#020617';
      ctx.fillRect(h - 14, h - 14, 16, 6);
      ctx.fillRect(h - 14, h + 8, 16, 6);
      ctx.fillStyle = '#334155';
      ctx.fillRect(h - 10, h - 13, 14, 4);
      ctx.fillRect(h - 10, h + 9, 14, 4);
      // Cyan glowing accelerator coils
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h - 7, h - 14, 2, 6);
      ctx.fillRect(h - 3, h - 14, 2, 6);
      ctx.fillRect(h + 1, h - 14, 2, 6);
      ctx.fillRect(h - 7, h + 8, 2, 6);
      ctx.fillRect(h - 3, h + 8, 2, 6);
      ctx.fillRect(h + 1, h + 8, 2, 6);
      // Muzzle beam tip
      ctx.fillStyle = '#e0f2fe';
      ctx.fillRect(h + 3, h - 12, 2, 2);
      ctx.fillRect(h + 3, h + 10, 2, 2);
    });

    // 3. BACK ROCKETS (Roket Punggung) - Shoulder missile pods
    createLayer('mutation_back_rockets_1', (ctx, h) => {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(h - 7, h - 14, 8, 6);
      ctx.fillRect(h - 7, h + 8, 8, 6);
      // Orange rocket warhead tips
      ctx.fillStyle = '#f97316';
      ctx.fillRect(h, h - 13, 2, 2);
      ctx.fillRect(h, h - 10, 2, 2);
      ctx.fillRect(h, h + 9, 2, 2);
      ctx.fillRect(h, h + 12, 2, 2);
    });

    createLayer('mutation_back_rockets_3', (ctx, h) => {
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(h - 9, h - 15, 11, 7);
      ctx.fillRect(h - 9, h + 8, 11, 7);
      // Quad rocket cells
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(h + 1, h - 14, 2, 2);
      ctx.fillRect(h + 1, h - 11, 2, 2);
      ctx.fillRect(h + 1, h + 9, 2, 2);
      ctx.fillRect(h + 1, h + 12, 2, 2);
      // Targeting laser dot
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h - 4, h - 16, 2, 1);
      ctx.fillRect(h - 4, h + 15, 2, 1);
    });

    createLayer('mutation_back_rockets_5', (ctx, h) => {
      // 6-tube hex armored pods with hazard stripes
      ctx.fillStyle = '#09090b';
      ctx.fillRect(h - 11, h - 16, 14, 8);
      ctx.fillRect(h - 11, h + 8, 14, 8);
      // Yellow hazard trim
      ctx.fillStyle = '#eab308';
      ctx.fillRect(h - 11, h - 17, 14, 1);
      ctx.fillRect(h - 11, h + 16, 14, 1);
      // Hex warheads
      ctx.fillStyle = '#ef4444';
      for (let r = 0; r < 3; r++) {
        ctx.fillRect(h + 2, h - 15 + r * 2.5, 2, 2);
        ctx.fillRect(h + 2, h + 9 + r * 2.5, 2, 2);
      }
      // Glowing thruster heat vent
      ctx.fillStyle = '#ffedd5';
      ctx.fillRect(h - 10, h - 14, 2, 4);
      ctx.fillRect(h - 10, h + 10, 2, 4);
    });

    // 4. BODY SPIKES (Duri Tubuh) - Jagged spines along ribs & flanks
    createLayer('mutation_body_spikes_1', (ctx, h) => {
      ctx.fillStyle = '#1c1917';
      // Lateral flank spines
      const xOffsets = [-10, -3, 4];
      xOffsets.forEach(x => {
        ctx.fillRect(h + x, h - 16, 2, 3);
        ctx.fillRect(h + x, h + 13, 2, 3);
      });
      ctx.fillStyle = '#78716c';
      xOffsets.forEach(x => {
        ctx.fillRect(h + x, h - 17, 1, 2);
        ctx.fillRect(h + x, h + 15, 1, 2);
      });
    });

    createLayer('mutation_body_spikes_3', (ctx, h) => {
      ctx.fillStyle = '#0f172a';
      const xOffsets = [-12, -7, -2, 3, 8];
      xOffsets.forEach(x => {
        ctx.fillRect(h + x, h - 18, 3, 5);
        ctx.fillRect(h + x, h + 13, 3, 5);
      });
      // Crimson tipped barb points
      ctx.fillStyle = '#dc2626';
      xOffsets.forEach(x => {
        ctx.fillRect(h + x, h - 20, 2, 3);
        ctx.fillRect(h + x, h + 17, 2, 3);
      });
    });

    createLayer('mutation_body_spikes_5', (ctx, h) => {
      // Monstrous Behemoth Bone Carapace
      ctx.fillStyle = '#030712';
      const xOffsets = [-14, -9, -4, 1, 6, 11];
      xOffsets.forEach((x, i) => {
        const len = 5 + (i % 3) * 2;
        ctx.fillRect(h + x, h - 16 - len, 3, len + 3);
        ctx.fillRect(h + x, h + 13, 3, len + 3);
      });
      // Glowing blood-red magma edges
      ctx.fillStyle = '#ff5c39';
      xOffsets.forEach((x, i) => {
        const len = 5 + (i % 3) * 2;
        ctx.fillRect(h + x, h - 18 - len, 2, 3);
        ctx.fillRect(h + x, h + 15 + len, 2, 3);
      });
      // Center dorsal crest surge
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h - 10, h - 1, 18, 2);
    });

    // 5. FIRE BREATH (Napas Api) - Molten jaw & horns
    createLayer('mutation_fire_breath_1', (ctx, h) => {
      // Molten throat slit
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(h + 18, h - 2, 4, 4);
      ctx.fillStyle = '#fde047';
      ctx.fillRect(h + 19, h - 1, 2, 2);
    });

    createLayer('mutation_fire_breath_3', (ctx, h) => {
      // Blazing jaw & mini curved horns
      ctx.fillStyle = '#c2410c';
      ctx.fillRect(h + 17, h - 4, 6, 8);
      ctx.fillStyle = '#f97316';
      ctx.fillRect(h + 19, h - 3, 4, 6);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(h + 21, h - 2, 3, 4);
      // Small obsidian horns
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(h + 12, h - 9, 3, 4);
      ctx.fillRect(h + 12, h + 5, 3, 4);
    });

    createLayer('mutation_fire_breath_5', (ctx, h) => {
      // Infernal dragon visage: Sweeping horns and roaring magma maw
      ctx.fillStyle = '#0f0502';
      // Sweeping demonic horns
      ctx.fillRect(h + 10, h - 12, 4, 7);
      ctx.fillRect(h + 7, h - 15, 4, 5);
      ctx.fillRect(h + 10, h + 5, 4, 7);
      ctx.fillRect(h + 7, h + 10, 4, 5);
      // Fiery horn tips
      ctx.fillStyle = '#f97316';
      ctx.fillRect(h + 5, h - 16, 3, 3);
      ctx.fillRect(h + 5, h + 13, 3, 3);
      // Raging molten jaw
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(h + 16, h - 5, 8, 10);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(h + 19, h - 3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h + 22, h - 1, 3, 2);
    });

    // 6. LASER EYES (Mata Laser) - Crimson ocular implants
    createLayer('mutation_laser_eyes_1', (ctx, h) => {
      ctx.fillStyle = '#ff1e42';
      ctx.fillRect(h + 15, h - 6, 4, 3);
      ctx.fillRect(h + 15, h + 3, 4, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h + 17, h - 5, 1, 1);
      ctx.fillRect(h + 17, h + 4, 1, 1);
    });

    createLayer('mutation_laser_eyes_3', (ctx, h) => {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(h + 14, h - 8, 6, 5);
      ctx.fillRect(h + 14, h + 3, 6, 5);
      // Bright ruby ocular laser core
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h + 15, h - 7, 5, 3);
      ctx.fillRect(h + 15, h + 4, 5, 3);
      // Focused optic dot
      ctx.fillStyle = '#fecaca';
      ctx.fillRect(h + 18, h - 6, 2, 2);
      ctx.fillRect(h + 18, h + 5, 2, 2);
    });

    createLayer('mutation_laser_eyes_5', (ctx, h) => {
      // Overcharged Death-Ray ocular lenses with glowing energy conduits
      ctx.fillStyle = '#1c0303';
      ctx.fillRect(h + 13, h - 9, 8, 7);
      ctx.fillRect(h + 13, h + 2, 8, 7);
      // Red energy conduit lines back to spine
      ctx.fillStyle = '#b91c1c';
      ctx.fillRect(h + 7, h - 6, 7, 1);
      ctx.fillRect(h + 7, h + 5, 7, 1);
      // Intense crimson laser corona
      ctx.fillStyle = '#ff1e42';
      ctx.fillRect(h + 14, h - 8, 7, 5);
      ctx.fillRect(h + 14, h + 3, 7, 5);
      // Pure white hyper-concentrated core
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h + 18, h - 7, 3, 3);
      ctx.fillRect(h + 18, h + 4, 3, 3);
    });

    // 7. QUAKE STOMP (Injakan Getar) - Seismic tectonic chest & belly plates
    createLayer('mutation_quake_stomp_1', (ctx, h) => {
      ctx.fillStyle = '#292524';
      ctx.fillRect(h - 5, h - 3, 8, 6);
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(h - 3, h - 1, 5, 1);
    });

    createLayer('mutation_quake_stomp_3', (ctx, h) => {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(h - 7, h - 6, 12, 12);
      // Molten fissures in chest
      ctx.fillStyle = '#d97706';
      ctx.fillRect(h - 5, h - 4, 8, 8);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(h - 4, h - 2, 6, 4);
    });

    createLayer('mutation_quake_stomp_5', (ctx, h) => {
      // Volcanic Seismic Core
      ctx.fillStyle = '#0c0a09';
      ctx.fillRect(h - 9, h - 8, 16, 16);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(h - 7, h - 6, 12, 12);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(h - 5, h - 4, 8, 8);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h - 2, h - 2, 3, 3);
    });

    // 8. SPIKED TAIL (Ekor Berduri) - Barbed tip and segment spikes
    const createTailSpike = (key, drawFn) => {
      if (scene.textures.exists(key)) return;
      const c = scene.textures.createCanvas(key, 24, 24);
      const cx = c.getContext('2d');
      cx.imageSmoothingEnabled = false;
      drawFn(cx, 12);
      c.refresh();
    };

    createTailSpike('mutation_spiked_tail_1', (ctx, h) => {
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(h - 2, h - 8, 4, 16);
      ctx.fillStyle = '#78716c';
      ctx.fillRect(h - 1, h - 9, 2, 4);
      ctx.fillRect(h - 1, h + 5, 2, 4);
    });

    createTailSpike('mutation_spiked_tail_3', (ctx, h) => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(h - 4, h - 10, 8, 20);
      // Heavy twin lateral blade spikes
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h - 2, h - 11, 4, 3);
      ctx.fillRect(h - 2, h + 8, 4, 3);
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(h - 8, h - 2, 16, 4);
    });

    createTailSpike('mutation_spiked_tail_5', (ctx, h) => {
      // Brutal spiked morningstar club
      ctx.fillStyle = '#030712';
      ctx.beginPath();
      ctx.arc(h, h, 8, 0, Math.PI * 2);
      ctx.fill();
      // 8 razor obsidian spikes
      ctx.fillStyle = '#fb923c';
      ctx.fillRect(h - 2, h - 12, 4, 5);
      ctx.fillRect(h - 2, h + 7, 4, 5);
      ctx.fillRect(h - 12, h - 2, 5, 4);
      ctx.fillRect(h + 7, h - 2, 5, 4);
      ctx.fillRect(h - 9, h - 9, 3, 3);
      ctx.fillRect(h + 6, h - 9, 3, 3);
      ctx.fillRect(h - 9, h + 6, 3, 3);
      ctx.fillRect(h + 6, h + 6, 3, 3);
      // Core glowing amber crack
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(h - 2, h - 2, 4, 4);
    });

    // 9. ENERGY SHIELD BUBBLE (Perisai Energi) - 64x64 shimmering forcefield
    if (!scene.textures.exists('energy_shield_bubble')) {
      const shieldCanvas = scene.textures.createCanvas('energy_shield_bubble', 64, 64);
      const sctx = shieldCanvas.getContext('2d');
      sctx.imageSmoothingEnabled = false;

      // Outer glow
      sctx.strokeStyle = 'rgba(56, 189, 248, 0.45)';
      sctx.lineWidth = 2.5;
      sctx.beginPath();
      sctx.arc(32, 32, 29, 0, Math.PI * 2);
      sctx.stroke();

      // Hexagonal shield grid rings
      sctx.strokeStyle = 'rgba(125, 211, 252, 0.7)';
      sctx.lineWidth = 1.0;
      sctx.stroke();

      sctx.fillStyle = 'rgba(14, 165, 233, 0.12)';
      sctx.fill();

      // Shield spark facets
      sctx.fillStyle = '#38bdf8';
      sctx.fillRect(31, 2, 2, 2);
      sctx.fillRect(31, 60, 2, 2);
      sctx.fillRect(2, 31, 2, 2);
      sctx.fillRect(60, 31, 2, 2);

      shieldCanvas.refresh();
    }

    // 10. EVOLUTION SYNERGY VISUAL LAYERS (Tahap 4B-2)
    // Placeholder shapes with vivid gold & synergy accent colors
    // 10a. Badai Plasma (Plasma Storm): Golden-amber horned corona and plasma emitter
    createLayer('evolution_plasma_storm', (ctx, h) => {
      ctx.fillStyle = '#f59e0b';
      ctx.fillRect(h + 16, h - 5, 8, 10);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h + 18, h - 3, 5, 6);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h + 20, h - 1, 3, 2);
      // Plasma shoulder conduits
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h - 6, h - 14, 8, 3);
      ctx.fillRect(h - 6, h + 11, 8, 3);
    });

    // 10b. Ekor Petir (Lightning Tail): Golden lightning spine crest
    createLayer('evolution_lightning_tail', (ctx, h) => {
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(h - 16, h - 3, 14, 6);
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(h - 14, h - 2, 10, 4);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h - 12, h - 1, 6, 2);
    });

    // 10c. Artileri Berat (Heavy Artillery): Massive dual-bore golden mortar battery
    createLayer('evolution_heavy_artillery', (ctx, h) => {
      ctx.fillStyle = '#18181b';
      ctx.fillRect(h - 15, h - 15, 16, 7);
      ctx.fillRect(h - 15, h + 8, 16, 7);
      ctx.fillStyle = '#ea580c';
      ctx.fillRect(h - 12, h - 14, 14, 5);
      ctx.fillRect(h - 12, h + 9, 14, 5);
      // Gold muzzle bands
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h + 2, h - 15, 3, 7);
      ctx.fillRect(h + 2, h + 8, 3, 7);
    });

    // 10d. Gempa Bumi (Cataclysm Quake): Heavy golden tectonic chest core & gauntlets
    createLayer('evolution_cataclysm_quake', (ctx, h) => {
      ctx.fillStyle = '#78350f';
      ctx.fillRect(h - 8, h - 7, 14, 14);
      ctx.fillStyle = '#d97706';
      ctx.fillRect(h - 6, h - 5, 10, 10);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h - 4, h - 3, 6, 6);
      // Gauntlet edge
      ctx.fillStyle = '#10b981';
      ctx.fillRect(h + 12, h - 17, 6, 4);
      ctx.fillRect(h + 12, h + 13, 6, 4);
    });

    // 10e. Laser Penghancur (Annihilation Laser): Colossal multi-lens beam cannon on head
    createLayer('evolution_annihilation_laser', (ctx, h) => {
      ctx.fillStyle = '#450a0a';
      ctx.fillRect(h + 14, h - 9, 10, 18);
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(h + 16, h - 7, 8, 14);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h + 13, h - 10, 2, 20);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(h + 21, h - 2, 4, 4);
    });

    // 10f. Benteng Berduri (Thorn Bastion): Hexagonal reinforced carapace crest
    createLayer('evolution_thorn_bastion', (ctx, h) => {
      ctx.fillStyle = '#064e3b';
      ctx.fillRect(h - 12, h - 15, 20, 30);
      ctx.fillStyle = '#10b981';
      ctx.fillRect(h - 10, h - 13, 16, 26);
      ctx.fillStyle = '#ffd700';
      ctx.fillRect(h - 12, h - 16, 20, 2);
      ctx.fillRect(h - 12, h + 14, 20, 2);
    });
  }
}

