import { GAME_CONFIG } from '../config/game.js';
import { WORLD_CONFIG } from '../config/world.js';

/**
 * Kaiju Entity
 * Massive apex predator rendered from above with snake-like tail kinematics,
 * heavy inertia, 8-directional movement, layered modular anatomy, and footstep screen shake.
 */
export class Kaiju {
  /**
   * @param {Phaser.Scene} scene 
   * @param {number} x 
   * @param {number} y 
   */
  constructor(scene, x, y) {
    this.scene = scene;
    this.config = GAME_CONFIG.kaiju;

    // Position and Physics vectors
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0; // Current body orientation (radians)
    this.currentScale = this.config.initialScale;

    // Movement state
    this.isMoving = false;
    this.currentSpeed = 0;
    this.slowdownFactor = 0; // Dynamic resistance when crushing dense buildings

    // Step cycle tracking
    this.stepDistanceAccumulator = 0;
    this.leftFootStep = false;

    // Slot Layer Architecture
    // Supported slots: 'body', 'back_slot', 'skin_overlay', 'head_slot', 'tail_slot'
    this.layers = new Map();

    // Visual Mutations Architecture (Tahap 4B-1)
    this.mutationSprites = new Map(); // weaponId -> Sprite
    this.tailSpikeSprites = []; // Array<{ sprite, segmentIndex }>
    this.energyShieldSprite = null;
    this.currentShield = 0;
    this.maxShield = 0;
    this.shieldRechargeDelay = 6.0;
    this.shieldRechargeTimer = 0;
    this.reflectChance = 0;
    this.reflectMultiplier = 1.0;
    this.hasElectricSkinMutation = false;

    // Electric skin animation state
    this.electricFrame = 0;
    this.electricTimer = 0;

    // Setup GameObjects
    this.setupDisplayObjects();
    this.setupTail();
    this.setupFeet();
    this.setupInput();

    // Fill default layers
    this.addLayer('body', 'kaiju_body');

    // Centralized scaling
    this.setKaijuScale(this.config.initialScale);

    // HP, Invulnerability & Death (Tahap 3A)
    this.maxHp = this.config.maxHp || 300;
    this.hp = this.maxHp;
    this.speedMultiplier = 1.0;
    this.invincibleTimer = 0;
    this.flashTimer = 0;
    this.isDead = false;
  }

  /**
   * Sets up the main container holding the torso and layered components.
   */
  setupDisplayObjects() {
    this.container = this.scene.add.container(this.x, this.y);
    this.container.setDepth(15); // Above ground, shadows, and crowd
  }

  /**
   * Sets up the snake-like multi-segment tail trailing behind the Kaiju.
   */
  setupTail() {
    const { segmentCount, segmentDistance } = this.config.tail;
    this.tailSegments = [];

    for (let i = 0; i < segmentCount; i++) {
      const segSprite = this.scene.add.sprite(
        this.x - (i + 1) * segmentDistance,
        this.y,
        `kaiju_tail_${i}`
      );
      segSprite.setDepth(14); // Just underneath body

      this.tailSegments.push({
        sprite: segSprite,
        x: this.x - (i + 1) * segmentDistance,
        y: this.y,
        angle: 0,
        targetDist: segmentDistance
      });
    }

    this.tailSwayTimer = 0;
  }

  /**
   * Sets up left and right feet for alternating walking animation.
   */
  setupFeet() {
    this.leftFoot = this.scene.add.sprite(this.x, this.y, 'kaiju_foot');
    this.rightFoot = this.scene.add.sprite(this.x, this.y, 'kaiju_foot');
    this.leftFoot.setDepth(13);
    this.rightFoot.setDepth(13);

    this.leftFootOffset = { x: 0, y: -16, angle: 0 };
    this.rightFootOffset = { x: 0, y: 16, angle: 0 };
  }

  /**
   * Input keyboard controls (WASD & Arrow Keys)
   */
  setupInput() {
    this.cursors = this.scene.input.keyboard.createCursorKeys();
    this.wasd = {
      up: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      down: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      left: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      right: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      toggleElectric: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E)
    };

    // Toggle electric skin overlay on E key press
    this.wasd.toggleElectric.on('down', () => {
      this.toggleElectricSkin();
    });
  }

  /**
   * Layer Architecture: adds a modular layer to a designated slot.
   * All added layers rotate and scale synchronously with the Kaiju body.
   * @param {string} slotName - One of ['body', 'back_slot', 'skin_overlay', 'head_slot', 'tail_slot']
   * @param {string} layerKey - Phaser texture key
   */
  addLayer(slotName, layerKey) {
    if (!this.config.slots.includes(slotName)) {
      console.warn(`[Kaiju] Invalid slot: ${slotName}. Allowed slots:`, this.config.slots);
      return;
    }

    // Remove old layer in this slot if present
    this.removeLayer(slotName);

    // Create new layer sprite
    const sprite = this.scene.add.sprite(0, 0, layerKey);
    sprite.setOrigin(0.5, 0.5);

    // Adjust stacking order inside container
    // 'body' at bottom, 'back_slot' middle, 'skin_overlay' top
    if (slotName === 'body') {
      this.container.addAt(sprite, 0);
    } else {
      this.container.add(sprite);
    }

    this.layers.set(slotName, {
      sprite,
      key: layerKey
    });
  }

  /**
   * Removes a layer from the specified slot.
   * @param {string} slotName 
   */
  removeLayer(slotName) {
    if (this.layers.has(slotName)) {
      const entry = this.layers.get(slotName);
      if (entry.sprite) {
        this.container.remove(entry.sprite);
        entry.sprite.destroy();
      }
      this.layers.delete(slotName);
    }
  }

  /**
   * Checks if a slot currently has an active layer.
   * @param {string} slotName 
   * @returns {boolean}
   */
  hasLayer(slotName) {
    return this.layers.has(slotName);
  }

  /**
   * Toggles sample "kulit listrik" (electric skin) layer in 'skin_overlay' slot.
   */
  toggleElectricSkin() {
    if (this.hasLayer('skin_overlay')) {
      this.removeLayer('skin_overlay');
    } else {
      this.addLayer('skin_overlay', 'kaiju_electric_skin_0');
      this.electricFrame = 0;
    }
  }

  /**
   * Sets or upgrades visual mutation layer corresponding to an equipped weapon (Tahap 4B-1).
   * Tiers: Level 1 (Lv 1-2), Level 3 (Lv 3-4), Level 5 (Lv 5 dramatic special).
   * @param {string} weaponId 
   * @param {number} level 
   */
  setMutation(weaponId, level = 1) {
    const tier = level >= 5 ? 5 : (level >= 3 ? 3 : 1);

    if (weaponId === 'spiked_tail') {
      this.updateTailSpikes(tier);
      return;
    }

    if (weaponId === 'electric_skin') {
      this.hasElectricSkinMutation = true;
      if (!this.mutationSprites.has('electric_skin')) {
        const sprite = this.scene.add.sprite(0, 0, 'kaiju_electric_skin_0');
        sprite.setOrigin(0.5, 0.5);
        this.container.add(sprite);
        this.mutationSprites.set('electric_skin', sprite);
      }
      return;
    }

    const texKey = `mutation_${weaponId}_${tier}`;
    if (this.scene.textures.exists(texKey)) {
      if (this.mutationSprites.has(weaponId)) {
        const sprite = this.mutationSprites.get(weaponId);
        sprite.setTexture(texKey);
      } else {
        const sprite = this.scene.add.sprite(0, 0, texKey);
        sprite.setOrigin(0.5, 0.5);
        this.container.add(sprite);
        this.mutationSprites.set(weaponId, sprite);
      }
    }
  }

  /**
   * Updates tail spikes attached to snake-like trailing tail segments
   * @param {number} tier - 1, 3, or 5
   */
  updateTailSpikes(tier) {
    this.clearTailSpikes();

    const spikeKey = `mutation_spiked_tail_${tier}`;
    if (!this.scene.textures.exists(spikeKey)) return;

    this.tailSegments.forEach((seg, idx) => {
      // Tip segment always gets heavy morningstar club, earlier segments get dorsal spikes at tier >= 3
      if (idx === this.tailSegments.length - 1 || (tier >= 3 && idx >= 2)) {
        const spike = this.scene.add.sprite(seg.x, seg.y, spikeKey);
        spike.setDepth(14.5);
        spike.setScale(this.currentScale * (idx === this.tailSegments.length - 1 ? 1.0 : 0.7));
        this.tailSpikeSprites.push({ sprite: spike, segmentIndex: idx });
      }
    });
  }

  /**
   * Clears tail spike sprites
   */
  clearTailSpikes() {
    if (this.tailSpikeSprites) {
      this.tailSpikeSprites.forEach(item => {
        if (item.sprite) item.sprite.destroy();
      });
      this.tailSpikeSprites = [];
    }
  }

  /**
   * Activates or updates Energy Shield bubble
   * @param {number} capacity 
   * @param {number} delay 
   */
  setEnergyShield(capacity, delay = 6.0) {
    this.maxShield = capacity;
    this.currentShield = capacity;
    this.shieldRechargeDelay = delay;
    this.shieldRechargeTimer = 0;

    if (!this.energyShieldSprite) {
      this.energyShieldSprite = this.scene.add.sprite(0, 0, 'energy_shield_bubble');
      this.energyShieldSprite.setOrigin(0.5, 0.5);
      this.container.add(this.energyShieldSprite);
    }
    this.energyShieldSprite.setVisible(true);
  }

  /**
   * Removes all mutation layers and restores base anatomy (RunState reset)
   */
  clearAllMutations() {
    if (this.mutationSprites) {
      this.mutationSprites.forEach(sprite => {
        if (sprite) {
          this.container.remove(sprite);
          sprite.destroy();
        }
      });
      this.mutationSprites.clear();
    }
    this.hasElectricSkinMutation = false;
    this.clearTailSpikes();

    if (this.energyShieldSprite) {
      this.container.remove(this.energyShieldSprite);
      this.energyShieldSprite.destroy();
      this.energyShieldSprite = null;
    }
    this.currentShield = 0;
    this.maxShield = 0;
  }

  /**
   * Centralized Kaiju scale function.
   * Readies Kaiju for Phase 2+ evolution, resizing body, feet, tail segments, and collision box.
   * @param {number} scale 
   */
  setKaijuScale(scale) {
    this.currentScale = scale;
    this.container.setScale(scale);

    // Scale feet
    if (this.leftFoot && this.rightFoot) {
      this.leftFoot.setScale(scale);
      this.rightFoot.setScale(scale);
    }

    // Scale tail segments
    if (this.tailSegments) {
      this.tailSegments.forEach((seg, idx) => {
        seg.sprite.setScale(scale);
        seg.targetDist = this.config.tail.segmentDistance * scale;
      });
    }
  }

  /**
   * Main per-frame update
   * @param {number} time 
   * @param {number} delta - Frame delta in ms
   */
  update(time, delta) {
    const dt = delta / 1000;

    // Update invincibility & flash timers
    if (this.invincibleTimer > 0) {
      this.invincibleTimer = Math.max(0, this.invincibleTimer - dt);
    }
    if (this.flashTimer > 0) {
      this.flashTimer = Math.max(0, this.flashTimer - dt);
      if (this.flashTimer === 0) {
        this.applyHitFlash(false);
      }
    }

    if (this.isDead) return;

    this.handleMovement(dt);
    this.handleRotation(dt);
    this.updateTail(time, dt);
    this.updateFeetAndSteps(dt);
    this.updateElectricSkin(delta);

    // Sync tail spike positions with tail segments
    if (this.tailSpikeSprites && this.tailSpikeSprites.length > 0) {
      this.tailSpikeSprites.forEach(item => {
        const seg = this.tailSegments[item.segmentIndex];
        if (seg && item.sprite) {
          item.sprite.setPosition(seg.x, seg.y);
          item.sprite.setRotation(seg.angle);
        }
      });
    }

    // Energy Shield rotation & recharge timer
    if (this.maxShield > 0) {
      if (this.shieldRechargeTimer > 0) {
        this.shieldRechargeTimer = Math.max(0, this.shieldRechargeTimer - dt);
        if (this.shieldRechargeTimer === 0 && this.currentShield < this.maxShield) {
          this.currentShield = this.maxShield;
          if (this.energyShieldSprite) {
            this.energyShieldSprite.setVisible(true);
            this.energyShieldSprite.setAlpha(0.85);
          }
          if (this.scene && this.scene.particleManager) {
            this.scene.particleManager.emitSparks(this.x, this.y, 0x38bdf8, 12, 50);
          }
        }
      }

      if (this.energyShieldSprite && this.currentShield > 0) {
        this.energyShieldSprite.rotation += dt * 0.8;
      }
    }

    // Sync container position
    this.container.setPosition(this.x, this.y);
  }

  /**
   * Applies damage to Kaiju with deflector check, shield absorption, invulnerability window & white hit flash.
   * @param {number} amount 
   * @returns {boolean} Whether damage was taken
   */
  takeDamage(amount) {
    if (this.isDead || this.invincibleTimer > 0) return false;

    // 1. Deflector passive check (bullet reflection)
    if (this.reflectChance > 0 && Math.random() < this.reflectChance) {
      if (this.scene && this.scene.weaponSystem) {
        this.scene.weaponSystem.reflectEnemyBullet(this.x, this.y, this.reflectMultiplier);
      }
      return false; // Bullet deflected!
    }

    // 2. Energy Shield absorption
    if (this.currentShield > 0) {
      this.shieldRechargeTimer = this.shieldRechargeDelay;
      const absorbed = Math.min(this.currentShield, amount);
      this.currentShield -= absorbed;
      amount -= absorbed;

      if (this.scene && this.scene.particleManager) {
        this.scene.particleManager.emitSparks(this.x, this.y, 0x38bdf8, 6, 40);
      }

      if (this.currentShield <= 0 && this.energyShieldSprite) {
        this.energyShieldSprite.setVisible(false);
      }

      if (amount <= 0) return true; // Fully absorbed by shield!
    }

    // 3. Regular HP damage
    this.hp = Math.max(0, this.hp - amount);
    this.invincibleTimer = this.config.invincibilityDuration || 0.1; // 100ms
    this.flashTimer = this.config.flashDuration || 0.08; // 80ms
    this.applyHitFlash(true);

    if (this.scene && this.scene.weaponSystem) {
      this.scene.weaponSystem.triggerThornBurst(amount);
    }

    return true;
  }

  /**
   * Applies a brief white hit flash across Kaiju layers and segments
   * @param {boolean} enable 
   */
  applyHitFlash(enable) {
    this.layers.forEach(layer => {
      if (layer.sprite) {
        if (enable) layer.sprite.setTintFill(0xffffff);
        else layer.sprite.clearTint();
      }
    });

    if (this.mutationSprites) {
      this.mutationSprites.forEach(sprite => {
        if (sprite) {
          if (enable) sprite.setTintFill(0xffffff);
          else sprite.clearTint();
        }
      });
    }

    if (this.leftFoot) {
      if (enable) this.leftFoot.setTintFill(0xffffff);
      else this.leftFoot.clearTint();
    }
    if (this.rightFoot) {
      if (enable) this.rightFoot.setTintFill(0xffffff);
      else this.rightFoot.clearTint();
    }
    if (this.tailSegments) {
      this.tailSegments.forEach(seg => {
        if (enable) seg.sprite.setTintFill(0xffffff);
        else seg.sprite.clearTint();
      });
    }
  }

  /**
   * 8-directional movement with heavy acceleration and inertia
   */
  handleMovement(dt) {
    let inputX = 0;
    let inputY = 0;

    // Check WASD and Arrow Keys
    if (this.wasd.left.isDown || this.cursors.left.isDown) inputX -= 1;
    if (this.wasd.right.isDown || this.cursors.right.isDown) inputX += 1;
    if (this.wasd.up.isDown || this.cursors.up.isDown) inputY -= 1;
    if (this.wasd.down.isDown || this.cursors.down.isDown) inputY += 1;

    // Normalize diagonal input
    if (inputX !== 0 && inputY !== 0) {
      const invLen = 1 / Math.SQRT2;
      inputX *= invLen;
      inputY *= invLen;
    }

    const { acceleration, drag, maxSpeed } = this.config;

    if (inputX !== 0 || inputY !== 0) {
      // Accelerate heavily towards input direction
      this.vx += inputX * acceleration * dt;
      this.vy += inputY * acceleration * dt;
      this.isMoving = true;
    } else {
      // Apply drag / friction when idle
      const currentSpeed = Math.hypot(this.vx, this.vy);
      if (currentSpeed > 0) {
        const drop = drag * dt;
        const newSpeed = Math.max(0, currentSpeed - drop);
        const factor = currentSpeed > 0 ? newSpeed / currentSpeed : 0;
        this.vx *= factor;
        this.vy *= factor;
      }
      this.isMoving = Math.hypot(this.vx, this.vy) > 2;
    }

    // Calculate effective max speed with trampling slowdown penalty and speedMultiplier
    const maxPenalty = GAME_CONFIG.destruction.maxSlowdownPercent || 0.25;
    const currentPenalty = Math.min(maxPenalty, this.slowdownFactor);
    const effectiveMaxSpeed = maxSpeed * (this.speedMultiplier || 1.0) * (1 - currentPenalty);

    // Slowly recover slowdown over time
    const recovery = GAME_CONFIG.destruction.slowdownRecoveryRate || 1.8;
    this.slowdownFactor = Math.max(0, this.slowdownFactor - recovery * dt);

    // Clamp to effective maximum speed
    this.currentSpeed = Math.hypot(this.vx, this.vy);
    if (this.currentSpeed > effectiveMaxSpeed) {
      const factor = effectiveMaxSpeed / this.currentSpeed;
      this.vx *= factor;
      this.vy *= factor;
      this.currentSpeed = effectiveMaxSpeed;
    }

    // Integrate position
    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Basic world boundary collision (Kaiju cannot leave world)
    const margin = (this.config.baseSize / 2) * this.currentScale;
    if (this.x < margin) {
      this.x = margin;
      this.vx = 0;
    } else if (this.x > WORLD_CONFIG.worldWidth - margin) {
      this.x = WORLD_CONFIG.worldWidth - margin;
      this.vx = 0;
    }

    if (this.y < margin) {
      this.y = margin;
      this.vy = 0;
    } else if (this.y > WORLD_CONFIG.worldHeight - margin) {
      this.y = WORLD_CONFIG.worldHeight - margin;
      this.vy = 0;
    }
  }

  /**
   * Smooth angular interpolation towards velocity vector
   */
  handleRotation(dt) {
    if (this.currentSpeed > 4) {
      const targetAngle = Math.atan2(this.vy, this.vx);
      // Angle wrap difference [-PI, PI]
      const diff = Phaser.Math.Angle.Wrap(targetAngle - this.rotation);
      // Heavy rotational lerp
      this.rotation += diff * Math.min(1, this.config.turnSpeed * (dt * 60));
      this.container.setRotation(this.rotation);
    }
  }

  /**
   * Snake-like tail kinematics with delay and organic sinusoidal sway
   */
  updateTail(time, dt) {
    const { swayFrequency, swayAmplitude, followSpeed } = this.config.tail;

    // Organic idle sway
    this.tailSwayTimer += dt * 60;
    const baseSway = Math.sin(time * swayFrequency) * swayAmplitude;

    // Anchor point: rear of the Kaiju body
    const bodyRearDist = 20 * this.currentScale;
    let anchorX = this.x - Math.cos(this.rotation) * bodyRearDist;
    let anchorY = this.y - Math.sin(this.rotation) * bodyRearDist;
    let prevAngle = this.rotation;

    for (let i = 0; i < this.tailSegments.length; i++) {
      const seg = this.tailSegments[i];

      // Segment sway offset increases toward tail tip
      const segmentSway = baseSway * (i + 1) * 0.45;

      // Target position behind anchor
      const targetAngle = prevAngle + Math.PI + segmentSway;
      const targetX = anchorX + Math.cos(targetAngle) * seg.targetDist;
      const targetY = anchorY + Math.sin(targetAngle) * seg.targetDist;

      // Smooth lag / delayed following
      seg.x += (targetX - seg.x) * Math.min(1, followSpeed * (dt * 60));
      seg.y += (targetY - seg.y) * Math.min(1, followSpeed * (dt * 60));

      // Calculate segment orientation pointing to anchor
      const segAngle = Math.atan2(anchorY - seg.y, anchorX - seg.x);
      seg.angle = segAngle;

      seg.sprite.setPosition(seg.x, seg.y);
      seg.sprite.setRotation(segAngle);

      // Next segment follows this segment
      anchorX = seg.x;
      anchorY = seg.y;
      prevAngle = segAngle;
    }
  }

  /**
   * Alternating footstep animation and subtle step screen shake
   */
  updateFeetAndSteps(dt) {
    const scale = this.currentScale;

    if (this.currentSpeed > 5) {
      this.stepDistanceAccumulator += this.currentSpeed * dt;

      // Check step trigger
      if (this.stepDistanceAccumulator >= this.config.stepDistance * scale) {
        this.stepDistanceAccumulator = 0;
        this.leftFootStep = !this.leftFootStep;

        // Subtle, smooth camera screen shake
        this.scene.cameras.main.shake(
          this.config.stepShakeDuration,
          this.config.stepShakeIntensity
        );
      }
    }

    // Walking stride oscillation
    const stride = Math.sin((this.stepDistanceAccumulator / (this.config.stepDistance * scale)) * Math.PI * 2);
    const leftStrideOffset = this.leftFootStep ? stride * 8 * scale : -stride * 4 * scale;
    const rightStrideOffset = !this.leftFootStep ? stride * 8 * scale : -stride * 4 * scale;

    // Body perpendicular and parallel unit vectors
    const cos = Math.cos(this.rotation);
    const sin = Math.sin(this.rotation);
    const perpX = -sin;
    const perpY = cos;

    const lateralSpread = 16 * scale;
    const longitudinalBase = -4 * scale;

    // Left Foot position
    const leftX = this.x + perpX * -lateralSpread + cos * (longitudinalBase + leftStrideOffset);
    const leftY = this.y + perpY * -lateralSpread + sin * (longitudinalBase + leftStrideOffset);
    this.leftFoot.setPosition(leftX, leftY);
    this.leftFoot.setRotation(this.rotation);

    // Right Foot position
    const rightX = this.x + perpX * lateralSpread + cos * (longitudinalBase + rightStrideOffset);
    const rightY = this.y + perpY * lateralSpread + sin * (longitudinalBase + rightStrideOffset);
    this.rightFoot.setPosition(rightX, rightY);
    this.rightFoot.setRotation(this.rotation);
  }

  /**
   * Electric skin spark frame animation
   */
  updateElectricSkin(delta) {
    if (this.hasLayer('skin_overlay')) {
      this.electricTimer += delta;
      if (this.electricTimer >= 70) { // ~14 FPS crackle
        this.electricTimer = 0;
        this.electricFrame = (this.electricFrame + 1) % 3;
        const entry = this.layers.get('skin_overlay');
        if (entry && entry.sprite) {
          entry.sprite.setTexture(`kaiju_electric_skin_${this.electricFrame}`);
        }
      }
    }
  }

  /**
   * Applies trample resistance when crushing dense skyscraper cells
   * @param {number} amount 
   */
  applyResistance(amount) {
    const maxPenalty = GAME_CONFIG.destruction.maxSlowdownPercent || 0.25;
    this.slowdownFactor = Math.min(maxPenalty, this.slowdownFactor + amount);
  }

  /**
   * Returns oriented ellipse parameters of the Kaiju torso footprint
   */
  getBodyFootprint() {
    return {
      cx: this.x,
      cy: this.y,
      rx: 24 * this.currentScale,
      ry: 16 * this.currentScale,
      angle: this.rotation
    };
  }

  /**
   * Returns circular footprints for each sweeping tail segment
   */
  getTailFootprints() {
    const scale = this.currentScale;
    return this.tailSegments.map((seg, idx) => ({
      cx: seg.x,
      cy: seg.y,
      radius: (this.config.tail.segmentRadius[idx] + 2) * scale,
      segmentIndex: idx
    }));
  }

  /**
   * Resets Kaiju state cleanly for world restart
   */
  resetPosition(x, y) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.rotation = 0;
    this.slowdownFactor = 0;
    this.container.setPosition(x, y);
    this.container.setRotation(0);

    const { segmentDistance } = this.config.tail;
    this.tailSegments.forEach((seg, i) => {
      seg.x = x - (i + 1) * segmentDistance * this.currentScale;
      seg.y = y;
      seg.angle = 0;
      seg.sprite.setPosition(seg.x, seg.y);
      seg.sprite.setRotation(0);
      seg.sprite.setVisible(true);
    });

    // Reset HP & death state
    this.hp = this.maxHp;
    this.isDead = false;
    this.invincibleTimer = 0;
    this.flashTimer = 0;
    this.applyHitFlash(false);
    this.clearAllMutations();
    this.container.setVisible(true);
    if (this.leftFoot) this.leftFoot.setVisible(true);
    if (this.rightFoot) this.rightFoot.setVisible(true);
  }

  /**
   * Clean up all game objects
   */
  destroy() {
    this.clearAllMutations();
    this.container.destroy();
    if (this.leftFoot) this.leftFoot.destroy();
    if (this.rightFoot) this.rightFoot.destroy();
    if (this.tailSegments) {
      this.tailSegments.forEach(seg => seg.sprite.destroy());
    }
  }
}
