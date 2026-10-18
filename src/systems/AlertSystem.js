import { ALERT_CONFIG } from '../config/alert.js';

/**
 * AlertSystem - Tahap 3B
 * Manages city-wide threat escalation (Siaga 1 to 5).
 * - Meter 0 - 100 with 5 tiers
 * - Increases on destruction & enemy casualties
 * - Decays after 5s of inactivity
 * - Level floor lock for 20s after level up (prevents rapid oscillations)
 * - Level-up cinematic warning: siren alert, "SIAGA X!" banner, and red border flash
 * - Reset on run restart (RunState) while city damage is preserved (WorldState)
 */
export class AlertSystem {
  /**
   * @param {Phaser.Scene} scene 
   */
  constructor(scene) {
    this.scene = scene;

    this.alert = 0.0; // Current meter value (0 - 100)
    this.currentLevel = 1;
    this.previousLevel = 1;

    // Decay & Protection Timers
    this.noActionTimer = 0.0;
    this.levelFloorProtectionTimer = 0.0;
    this.protectedFloor = 0.0;

    // Visual Elements for Level-up Notifications
    this.setupVisuals();
  }

  setupVisuals() {
    // 1. Red Border Vignette Flash (screen edge flash)
    this.borderFlash = this.scene.add.graphics();
    this.borderFlash.setScrollFactor(0);
    this.borderFlash.setDepth(150); // Above HUD, below modal
    this.borderFlash.setVisible(false);

    // 2. Large "SIAGA X!" Center Banner
    this.bannerText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 - 20,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#ef4444',
        stroke: '#050408',
        strokeThickness: 4,
        align: 'center'
      }
    );
    this.bannerText.setOrigin(0.5);
    this.bannerText.setScrollFactor(0);
    this.bannerText.setDepth(151);
    this.bannerText.setVisible(false);

    // Subtitle description under banner
    this.bannerSubText = this.scene.add.text(
      this.scene.cameras.main.width / 2,
      this.scene.cameras.main.height / 2 + 6,
      '',
      {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#fca5a5',
        stroke: '#050408',
        strokeThickness: 2,
        align: 'center'
      }
    );
    this.bannerSubText.setOrigin(0.5);
    this.bannerSubText.setScrollFactor(0);
    this.bannerSubText.setDepth(151);
    this.bannerSubText.setVisible(false);
  }

  /**
   * Returns current level (1-5) corresponding to alert value
   */
  getLevelForAlert(value) {
    if (value >= 80) return 5;
    if (value >= 60) return 4;
    if (value >= 40) return 3;
    if (value >= 20) return 2;
    return 1;
  }

  /**
   * Returns display name for current alert level
   */
  getLevelName() {
    const levelData = ALERT_CONFIG.levels[this.currentLevel - 1];
    if (!levelData) return 'AMAN';
    const parts = levelData.name.split(':');
    return parts.length > 1 ? parts[1].trim() : levelData.name;
  }

  /**
   * Increases Alert meter by given amount
   * @param {number} amount 
   */
  addAlert(amount) {
    if (amount <= 0) return;

    this.alert = Math.min(ALERT_CONFIG.maxAlert, this.alert + amount);
    this.noActionTimer = 0.0; // Reset inactivity timer on action

    const newLevel = this.getLevelForAlert(this.alert);
    if (newLevel > this.currentLevel) {
      this.triggerLevelUp(newLevel);
      this.currentLevel = newLevel;
      this.levelFloorProtectionTimer = ALERT_CONFIG.levelFloorProtectionDuration; // 20s lock
      this.protectedFloor = (newLevel - 1) * 20.0;
    }
  }

  /**
   * Manually sets alert (used by F7/F8 debug keys)
   * @param {number} value 
   */
  setAlert(value) {
    const oldLevel = this.currentLevel;
    this.alert = Math.max(ALERT_CONFIG.minAlert, Math.min(ALERT_CONFIG.maxAlert, value));
    this.currentLevel = this.getLevelForAlert(this.alert);

    if (this.currentLevel > oldLevel) {
      this.triggerLevelUp(this.currentLevel);
      this.levelFloorProtectionTimer = ALERT_CONFIG.levelFloorProtectionDuration;
      this.protectedFloor = (this.currentLevel - 1) * 20.0;
    } else if (this.currentLevel < oldLevel) {
      // Clear protection if manually lowered
      this.levelFloorProtectionTimer = 0.0;
      this.protectedFloor = (this.currentLevel - 1) * 20.0;
    }
  }

  /**
   * Dispatches level up cinematic alert
   */
  triggerLevelUp(level) {
    const levelData = ALERT_CONFIG.levels[level - 1];
    const name = levelData ? levelData.name : `SIAGA ${level}`;

    // 1. Camera Shake
    this.scene.cameras.main.shake(260, 0.007);

    // 2. Banner Text Pop & Fade
    this.bannerText.setText(`[ ${name.split(':')[0]}! ]`);
    this.bannerSubText.setText(name.split(':')[1] ? name.split(':')[1].trim() : '');

    this.bannerText.setVisible(true);
    this.bannerText.setAlpha(1.0);
    this.bannerText.setScale(0.8);

    this.bannerSubText.setVisible(true);
    this.bannerSubText.setAlpha(1.0);

    // Pop animation
    this.scene.tweens.killTweensOf(this.bannerText);
    this.scene.tweens.killTweensOf(this.bannerSubText);

    this.scene.tweens.add({
      targets: this.bannerText,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 180,
      yoyo: true,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: [this.bannerText, this.bannerSubText],
          alpha: 0,
          y: '-=12',
          duration: 1200,
          delay: 400,
          ease: 'Power2',
          onComplete: () => {
            this.bannerText.setVisible(false);
            this.bannerSubText.setVisible(false);
            this.bannerText.y = this.scene.cameras.main.height / 2 - 20;
            this.bannerSubText.y = this.scene.cameras.main.height / 2 + 6;
          }
        });
      }
    });

    // 3. Screen Edge Red Flash
    this.borderFlash.clear();
    const w = this.scene.cameras.main.width;
    const h = this.scene.cameras.main.height;
    this.borderFlash.lineStyle(3, 0xef4444, 0.9);
    this.borderFlash.strokeRect(1, 1, w - 2, h - 2);
    this.borderFlash.fillStyle(0xef4444, 0.12);
    this.borderFlash.fillRect(0, 0, w, h);
    this.borderFlash.setVisible(true);
    this.borderFlash.setAlpha(1.0);

    this.scene.tweens.killTweensOf(this.borderFlash);
    this.scene.tweens.add({
      targets: this.borderFlash,
      alpha: 0,
      duration: 650,
      ease: 'Power2',
      onComplete: () => {
        this.borderFlash.setVisible(false);
      }
    });
  }

  /**
   * Per-frame update: handles inactivity timer and decay
   * @param {number} dt - delta in seconds
   */
  update(dt) {
    this.noActionTimer += dt;

    if (this.levelFloorProtectionTimer > 0) {
      this.levelFloorProtectionTimer = Math.max(0, this.levelFloorProtectionTimer - dt);
    }

    // Inactivity decay
    if (this.noActionTimer >= ALERT_CONFIG.decayDelaySeconds) {
      const decay = ALERT_CONFIG.decayRatePerSecond * dt;
      const minFloor = this.levelFloorProtectionTimer > 0 ? this.protectedFloor : 0.0;
      this.alert = Math.max(minFloor, this.alert - decay);
      this.currentLevel = this.getLevelForAlert(this.alert);
    }
  }

  /**
   * Resets alert state when Kaiju dies and respawns (RunState reset)
   */
  reset() {
    this.alert = 0.0;
    this.currentLevel = 1;
    this.previousLevel = 1;
    this.noActionTimer = 0.0;
    this.levelFloorProtectionTimer = 0.0;
    this.protectedFloor = 0.0;

    if (this.bannerText) this.bannerText.setVisible(false);
    if (this.bannerSubText) this.bannerSubText.setVisible(false);
    if (this.borderFlash) this.borderFlash.setVisible(false);
  }
}
