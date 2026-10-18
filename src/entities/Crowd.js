import { WORLD_CONFIG } from '../config/world.js';
import { GAME_CONFIG } from '../config/game.js';
import { PALETTE } from '../config/palette.js';
import { PRNG } from '../utils/prng.js';

/**
 * High-Performance Decorative Crowd System - Tahap 2B
 * Manages pedestrians (fleeing mechanics, squish reactions) and vehicles (crushing & wreckage).
 * Frustum-culled updates maintain 60 FPS.
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
   * Creates vehicles placed along road centerlines.
   * ~55% of cars have illuminated headlights shining forward.
   */
  createCars() {
    const { carCount } = WORLD_CONFIG;
    const lanes = this.cityData.roadLanes;

    if (!lanes || lanes.length === 0) return;

    for (let i = 0; i < carCount; i++) {
      const lane = this.prng.choice(lanes);
      const colorIdx = this.prng.rangeInt(0, PALETTE.carBodies.length - 1);
      const speed = this.prng.range(50, 90);
      const direction = this.prng.chance(0.5) ? 1 : -1;
      const hasHeadlights = this.prng.chance(0.55);

      let x = 0;
      let y = 0;
      let rotation = 0;

      if (lane.isHorizontal) {
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

      const textureKey = hasHeadlights ? `car_headlights_${colorIdx}` : `car_${colorIdx}`;
      const sprite = this.scene.add.sprite(x, y, textureKey);
      sprite.setOrigin(hasHeadlights ? 0.35 : 0.5, 0.5);
      sprite.setRotation(rotation);
      sprite.setDepth(6);

      this.cars.push({
        sprite,
        lane,
        x,
        y,
        speed,
        direction,
        isHorizontal: lane.isHorizontal,
        rotation,
        isCrushed: false
      });
    }
  }

  /**
   * Creates pedestrians distributed across sidewalks, zebra crossings, and parks.
   */
  createPedestrians() {
    const { pedestrianCount } = WORLD_CONFIG;
    const clothesCount = PALETTE.pedestrianClothes.length;
    const { sidewalkPaths, zebraCrossings, parks } = this.cityData;

    for (let i = 0; i < pedestrianCount; i++) {
      let x = 0;
      let y = 0;
      let domain = 'sidewalk';
      let domainData = null;

      const roll = this.prng.next();

      if (roll < 0.28 && parks && parks.length > 0) {
        domain = 'park';
        domainData = this.prng.choice(parks);
        x = this.prng.range(domainData.x + 8, domainData.x + domainData.width - 8);
        y = this.prng.range(domainData.y + 8, domainData.y + domainData.height - 8);
      } else if (roll < 0.42 && zebraCrossings && zebraCrossings.length > 0) {
        domain = 'zebra';
        domainData = this.prng.choice(zebraCrossings);
        x = this.prng.range(domainData.x + 2, domainData.x + domainData.width - 2);
        y = this.prng.range(domainData.y + 2, domainData.y + domainData.height - 2);
      } else if (sidewalkPaths && sidewalkPaths.length > 0) {
        domain = 'sidewalk';
        domainData = this.prng.choice(sidewalkPaths);
        const edge = this.prng.rangeInt(0, 3);
        if (edge === 0) {
          x = this.prng.range(domainData.x1, domainData.x2);
          y = domainData.y1 - 2;
        } else if (edge === 1) {
          x = this.prng.range(domainData.x1, domainData.x2);
          y = domainData.y2 + 2;
        } else if (edge === 2) {
          x = domainData.x1 - 2;
          y = this.prng.range(domainData.y1, domainData.y2);
        } else {
          x = domainData.x2 + 2;
          y = this.prng.range(domainData.y1, domainData.y2);
        }
      } else {
        x = this.prng.range(100, WORLD_CONFIG.worldWidth - 100);
        y = this.prng.range(100, WORLD_CONFIG.worldHeight - 100);
      }

      const clothesIdx = this.prng.rangeInt(0, clothesCount - 1);
      const sprite = this.scene.add.sprite(x, y, `pedestrian_${clothesIdx}`);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDepth(7);

      const wanderAngle = this.prng.range(0, Math.PI * 2);
      const wanderSpeed = this.prng.range(10, 20);

      this.pedestrians.push({
        sprite,
        x,
        y,
        vx: Math.cos(wanderAngle) * wanderSpeed,
        vy: Math.sin(wanderAngle) * wanderSpeed,
        speed: wanderSpeed,
        timer: this.prng.range(1.5, 4.0),
        domain,
        domainData,
        isDead: false,
        isFleeing: false
      });
    }
  }

  /**
   * Main per-frame update loop:
   * 1. Updates car driving physics
   * 2. Updates pedestrian wandering & panic fleeing behavior
   * 3. Frustum culls off-screen entities
   * @param {Phaser.Cameras.Scene2D.Camera} camera 
   * @param {number} delta - Frame delta in ms
   * @param {Object} kaiju - Player Kaiju instance
   */
  update(camera, delta, kaiju) {
    const dt = delta / 1000;
    const view = camera.worldView;
    const pad = this.cullPadding;

    const minX = view.x - pad;
    const maxX = view.right + pad;
    const minY = view.y - pad;
    const maxY = view.bottom + pad;

    const fleeDist = GAME_CONFIG.destruction.humanFleeDistance || 110;
    const fleeMult = GAME_CONFIG.destruction.humanFleeSpeedMultiplier || 2.2;
    const kaijuX = kaiju ? kaiju.x : -9999;
    const kaijuY = kaiju ? kaiju.y : -9999;

    // 1. Update Cars
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.isCrushed) continue; // Crushed cars do not move

      if (car.isHorizontal) {
        car.x += car.speed * car.direction * dt;
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

      const isVisible = car.x >= minX && car.x <= maxX && car.y >= minY && car.y <= maxY;
      car.sprite.setVisible(isVisible);

      if (isVisible) {
        car.sprite.setPosition(car.x, car.y);
      }
    }

    // 2. Update Pedestrians (Wander & Panic Fleeing)
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.isDead) continue;

      const isVisible = p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY;
      p.sprite.setVisible(isVisible);

      if (isVisible) {
        // Check distance to Kaiju for Panic Fleeing!
        const distToKaiju = Math.hypot(p.x - kaijuX, p.y - kaijuY);

        if (distToKaiju < fleeDist) {
          // Flee directly away from Kaiju at sprint speed
          p.isFleeing = true;
          const fleeAngle = Math.atan2(p.y - kaijuY, p.x - kaijuX);
          p.vx = Math.cos(fleeAngle) * p.speed * fleeMult;
          p.vy = Math.sin(fleeAngle) * p.speed * fleeMult;
        } else {
          p.isFleeing = false;
          p.timer -= dt;
          if (p.timer <= 0) {
            p.timer = this.prng.range(1.5, 4.0);

            if (p.domain === 'sidewalk' && p.domainData) {
              const isHoriz = Math.abs(p.y - p.domainData.y1) < 8 || Math.abs(p.y - p.domainData.y2) < 8;
              p.vx = isHoriz ? (this.prng.chance(0.5) ? p.speed : -p.speed) : 0;
              p.vy = !isHoriz ? (this.prng.chance(0.5) ? p.speed : -p.speed) : 0;
            } else if (p.domain === 'zebra' && p.domainData) {
              if (p.domainData.isHorizontal) {
                p.vy = this.prng.chance(0.5) ? p.speed : -p.speed;
                p.vx = 0;
              } else {
                p.vx = this.prng.chance(0.5) ? p.speed : -p.speed;
                p.vy = 0;
              }
            } else {
              const wanderAngle = this.prng.range(0, Math.PI * 2);
              p.vx = Math.cos(wanderAngle) * p.speed;
              p.vy = Math.sin(wanderAngle) * p.speed;
            }
          }
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

  /**
   * Checks collisions between Kaiju footprints and crowd entities (humans squished, cars crushed).
   * @param {Object} bodyFootprint - { cx, cy, rx, ry, angle }
   * @param {Array} tailFootprints - [{ cx, cy, radius }]
   * @param {import('../effects/ParticleManager.js').ParticleManager} particleManager 
   * @param {Function} onHumanKilled 
   * @param {Function} onCarDestroyed 
   */
  checkKaijuTrample(bodyFootprint, tailFootprints, particleManager, onHumanKilled, onCarDestroyed) {
    const { cx, cy, rx, ry, angle } = bodyFootprint;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const invRx2 = 1 / (rx * rx);
    const invRy2 = 1 / (ry * ry);

    // 1. Check Pedestrians
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.isDead) continue;

      let hit = false;

      // Check Body Ellipse
      const dx = p.x - cx;
      const dy = p.y - cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (lx * lx * invRx2 + ly * ly * invRy2 <= 1.0) {
        hit = true;
      }

      // Check Tail Segments
      if (!hit && tailFootprints) {
        for (let t = 0; t < tailFootprints.length; t++) {
          const seg = tailFootprints[t];
          if (Math.hypot(p.x - seg.cx, p.y - seg.cy) <= seg.radius) {
            hit = true;
            break;
          }
        }
      }

      if (hit) {
        p.isDead = true;
        p.sprite.setVisible(false);
        particleManager.emitBloodSplatter(p.x, p.y);
        if (onHumanKilled) onHumanKilled(p.x, p.y);
      }
    }

    // 2. Check Vehicles (crush & flatten)
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.isCrushed) continue;

      const dx = car.x - cx;
      const dy = car.y - cy;
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;

      if (lx * lx * invRx2 + ly * ly * invRy2 <= 1.1) {
        car.isCrushed = true;
        car.sprite.setTint(0x282530); // Dark dented steel
        car.sprite.setScale(0.85, 0.45); // Flattened
        particleManager.emitDust(car.x, car.y, 4, 0.8);
        particleManager.emitDebris(car.x, car.y, 0xef4444, 4, 50);
        if (onCarDestroyed) onCarDestroyed(car.x, car.y);
      }
    }
  }

  /**
   * Crushes humans and cars within an area of effect (falling building collapse debris).
   */
  destroyEntitiesInRadius(centerX, centerY, radius, particleManager, onHumanKilled, onCarDestroyed) {
    const r2 = radius * radius;

    // Crush Pedestrians
    for (let i = 0; i < this.pedestrians.length; i++) {
      const p = this.pedestrians[i];
      if (p.isDead) continue;

      const d2 = (p.x - centerX) * (p.x - centerX) + (p.y - centerY) * (p.y - centerY);
      if (d2 <= r2) {
        p.isDead = true;
        p.sprite.setVisible(false);
        particleManager.emitBloodSplatter(p.x, p.y);
        if (onHumanKilled) onHumanKilled(p.x, p.y);
      }
    }

    // Crush Cars
    for (let i = 0; i < this.cars.length; i++) {
      const car = this.cars[i];
      if (car.isCrushed) continue;

      const d2 = (car.x - centerX) * (car.x - centerX) + (car.y - centerY) * (car.y - centerY);
      if (d2 <= r2) {
        car.isCrushed = true;
        car.sprite.setTint(0x282530);
        car.sprite.setScale(0.85, 0.45);
        particleManager.emitDust(car.x, car.y, 3, 0.7);
        if (onCarDestroyed) onCarDestroyed(car.x, car.y);
      }
    }
  }

  /**
   * Resets all crowd entities cleanly for restart (R)
   */
  reset() {
    this.destroy();
    this.createCars();
    this.createPedestrians();
  }

  destroy() {
    this.cars.forEach(c => c.sprite.destroy());
    this.pedestrians.forEach(p => p.sprite.destroy());
    this.cars = [];
    this.pedestrians = [];
  }
}
