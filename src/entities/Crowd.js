import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';
import { PRNG } from '../utils/prng.js';

/**
 * High-Performance Decorative Crowd System
 * Manages ~400 pedestrians and ~40 vehicles without arcade physics bodies.
 * Frustum-culled updates guarantee rock-solid 60 FPS.
 */
export class Crowd {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} cityData 
   */
  constructor(scene, cityData) {
    this.scene = scene;
    this.cityData = cityData;
    this.prng = new PRNG(WORLD_CONFIG.seed + 101);

    this.pedestrians = [];
    this.cars = [];

    this.cullPadding = WORLD_CONFIG.crowdCullPadding; // 100 px

    this.createCars();
    this.createPedestrians();
  }

  /**
   * Creates ~40 vehicles placed along road centerlines
   */
  createCars() {
    const { carCount } = WORLD_CONFIG;
    const lanes = this.cityData.roadLanes;

    if (!lanes || lanes.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const lane = this.prng.choice(lanes);
      const colorIdx = this.prng.rangeInt(0, PALETTE.carBodies.length - 1);
      const speed = this.prng.range(50, 95);
      const direction = this.prng.chance(0.5) ? 1 : -1;

      let x = 0;
      let y = 0;
      let rotation = 0;

      if (lane.isHorizontal) {
        // Offset slightly to drive on right side of road
        const laneOffset = (lane.width * 0.22) * direction;
        x = this.prng.range(100, WORLD_CONFIG.worldWidth - 100);
        y = lane.y + laneOffset;
        rotation = direction === 1 ? 0 : Math.PI;
      } else {
        const laneOffset = (lane.width * 0.22) * -direction;
        x = lane.x + laneOffset;
        y = this.prng.range(100, WORLD_CONFIG.worldHeight - 100);
        rotation = direction === 1 ? Math.PI / 2 : -Math.PI / 2;
      }

      const sprite = this.scene.add.sprite(x, y, `car_${colorIdx}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setRotation(rotation);
      sprite.setDepth(5); // Above road, below Kaiju

      this.cars.push({
        sprite,
        lane,
        x,
        y,
        speed,
        direction,
        isHorizontal: lane.isHorizontal,
        rotation
      });
    }
  }

  /**
   * Creates ~400 pedestrians distributed across sidewalks, parks, and blocks
   */
  createPedestrians() {
    const { pedestrianCount } = WORLD_CONFIG;
    const clothesCount = PALETTE.pedestrianClothes.length;

    // Distribute pedestrians across parks and sidewalks
    for (let i = 0; i < pedestrianCount; i++) {
      let x = 0;
      let y = 0;

      if (this.prng.chance(0.4) && this.cityData.parks.length > 0) {
        // Spawn in a park
        const park = this.prng.choice(this.cityData.parks);
        x = this.prng.range(park.x + 8, park.x + park.width - 8);
        y = this.prng.range(park.y + 8, park.y + park.height - 8);
      } else if (this.cityData.roads.length > 0) {
        // Spawn on or near road sidewalks
        const road = this.prng.choice(this.cityData.roads);
        if (road.isHorizontal) {
          x = this.prng.range(50, WORLD_CONFIG.worldWidth - 50);
          y = road.y + (this.prng.chance(0.5) ? -2 : road.height + 2);
        } else {
          x = road.x + (this.prng.chance(0.5) ? -2 : road.width + 2);
          y = this.prng.range(50, WORLD_CONFIG.worldHeight - 50);
        }
      } else {
        x = this.prng.range(100, WORLD_CONFIG.worldWidth - 100);
        y = this.prng.range(100, WORLD_CONFIG.worldHeight - 100);
      }

      const clothesIdx = this.prng.rangeInt(0, clothesCount - 1);
      const sprite = this.scene.add.sprite(x, y, `pedestrian_${clothesIdx}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(6);

      // Random wander velocity
      const wanderAngle = this.prng.range(0, Math.PI * 2);
      const wanderSpeed = this.prng.range(10, 22);

      this.pedestrians.push({
        sprite,
        x,
        y,
        vx: Math.cos(wanderAngle) * wanderSpeed,
        vy: Math.sin(wanderAngle) * wanderSpeed,
        speed: wanderSpeed,
        timer: this.prng.range(1, 4) // Seconds before changing wander direction
      });
    }
  }

  /**
   * Main per-frame update loop.
   * Culls entities outside camera view to maintain optimal 60 FPS.
   * @param {Phaser.Cameras.Scene2D.Camera} camera 
   * @param {number} delta - Frame delta in ms
   */
  update(camera, delta) {
    const dt = delta / 1000;
    const view = camera.worldView;
    const pad = this.cullPadding;

    const minX = view.x - pad;
    const maxX = view.right + pad;
    const minY = view.y - pad;
    const maxY = view.bottom + pad;

    // 1. Update Cars
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];

      // Move car along road
      if (car.isHorizontal) {
        car.x += car.speed * car.direction * dt;
        // Wrap around world edges
        if (car.direction === 1 && car.x > WORLD_CONFIG.worldWidth) {
          car.x = 0;
        } else if (car.direction === -1 && car.x < 0) {
          car.x = WORLD_CONFIG.worldWidth;
        }
      } else {
        car.y += car.speed * car.direction * dt;
        if (car.direction === 1 && car.y > WORLD_CONFIG.worldHeight) {
          car.y = 0;
        } else if (car.direction === -1 && car.y < 0) {
          car.y = WORLD_CONFIG.worldHeight;
        }
      }

      // Frustum culling
      const isVisible = car.x >= minX && car.x <= maxX && car.y >= minY && car.y <= maxY;
      car.sprite.setVisible(isVisible);

      if (isVisible) {
        car.sprite.setPosition(car.x, car.y);
      }
    }

    // 2. Update Pedestrians
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];

      // Check visibility
      const isVisible = p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      p.sprite.setVisible(isVisible);

      // Only calculate wander physics for near-screen pedestrians to save CPU
      if (isVisible) {
        p.timer -= dt;
        if (p.timer <= 0) {
          p.timer = this.prng.range(1.5, 4.5);
          const wanderAngle = this.prng.range(0, Math.PI * 2);
          p.vx = Math.cos(wanderAngle) * p.speed;
          p.vy = Math.sin(wanderAngle) * p.speed;
        }

        p.x += p.vx * dt;
        p.y += p.vy * dt;

        // Keep inside bounds
        if (p.x < 10) { p.x = 10; p.vx = Math.abs(p.vx); }
        if (p.x > WORLD_CONFIG.worldWidth - 10) { p.x = WORLD_CONFIG.worldWidth - 10; p.vx = -Math.abs(p.vx); }
        if (p.y < 10) { p.y = 10; p.vy = Math.abs(p.vy); }
        if (p.y > WORLD_CONFIG.worldHeight - 10) { p.y = WORLD_CONFIG.worldHeight - 10; p.vy = -Math.abs(p.vy); }

        p.sprite.setPosition(p.x, p.y);
      }
    }
  }

  destroy() {
    this.cars.forEach(c => c.sprite.destroy());
    this.pedestrians.forEach(p => p.sprite.destroy());
    this.cars = [];
    this.pedestrians = [];
  }
}
