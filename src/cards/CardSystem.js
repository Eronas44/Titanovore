import { CARD_CONFIG } from '../config/cards.js';
import { WEAPON_CONFIG } from '../config/weapons.js';
import { GAME_CONFIG } from '../config/game.js';

/**
 * CardSystem - Tahap 4A
 * Rogue-lite card selection, upgrade progression, and passive perk management.
 * Features:
 * - Queued level-ups for rapid multi-level handling
 * - Clean modal with 3 cards side-by-side, rarity colored frames, pixel icons, descriptions
 * - Interactive mouse clicks and keyboard shortcuts [1, 2, 3, R, S]
 * - Reroll and Skip mechanics with compensations
 * - Strict eligibility filtering (no maxed cards, no new weapons if 6 slots full)
 * - Cohesive build biasing (owned weapons appear more frequently)
 * - RunState lifecycle (clean reset on death/revival)
 */
export class CardSystem {
  /**
   * @param {Phaser.Scene} scene 
   * @param {Object} kaiju - Kaiju instance
   * @param {Object} weaponSystem - WeaponSystem instance
   * @param {Object} xpSystem - XpSystem instance
   */
  constructor(scene, kaiju, weaponSystem, xpSystem) {
    this.scene = scene;
    this.kaiju = kaiju;
    this.weaponSystem = weaponSystem;
    this.xpSystem = xpSystem;

    // Passive perk levels (1-5)
    this.passiveLevels = new Map();

    // Rerolls remaining for this run
    this.rerollsRemaining = CARD_CONFIG.rerollsPerRun;

    // Queue of pending level-ups
    this.levelUpQueue = [];
    this.isModalOpen = false;
    this.currentDisplayedCards = [];

    // Setup interactive modal UI container
    this.setupUI();
    this.setupInput();
  }

  setupUI() {
    // Top-level modal container pinned to screen (ScrollFactor = 0, Depth = 250)
    this.container = this.scene.add.container(0, 0);
    this.container.setScrollFactor(0);
    this.container.setDepth(250);
    this.container.setVisible(false);

    const w = GAME_CONFIG.width;
    const h = GAME_CONFIG.height;

    // 1. Semi-transparent dark vignette backdrop
    this.backdrop = this.scene.add.graphics();
    this.backdrop.fillStyle(0x050408, 0.88);
    this.backdrop.fillRect(0, 0, w, h);
    this.container.add(this.backdrop);

    // 2. Header Banner: "KAIJU BERVOLUSI! - PILIH KARTU"
    this.headerText = this.scene.add.text(w / 2, 24, 'KAIJU BERVOLUSI!', {
      fontFamily: 'monospace',
      fontSize: '13px',
      fontStyle: 'bold',
      color: '#fbbf24',
      stroke: '#000000',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5);
    this.container.add(this.headerText);

    this.subHeaderText = this.scene.add.text(w / 2, 40, 'Pilih 1 peningkatan untuk memperkuat Kaiju [1, 2, 3]', {
      fontFamily: 'monospace',
      fontSize: '7px',
      color: '#cbd5e1',
      align: 'center'
    }).setOrigin(0.5);
    this.container.add(this.subHeaderText);

    // 3. Card Containers (3 slots)
    this.cardContainers = [];
    const cardW = 94;
    const cardH = 138;
    const startX = (w - (cardW * 3 + 18 * 2)) / 2 + cardW / 2;
    const cardY = 126;

    for (let i = 0; i < 3; i++) {
      const cx = startX + i * (cardW + 18);
      const cardCont = this.scene.add.container(cx, cardY);

      // Card Background & Border Graphics
      const bgGraphics = this.scene.add.graphics();
      cardCont.add(bgGraphics);

      // Card Icon Sprite (16x16 px scaled up to 32x32)
      const iconSprite = this.scene.add.sprite(0, -34, 'icon_claw').setScale(2.0);
      cardCont.add(iconSprite);

      // Level / Status Badge ("BARU" or "Lv 2")
      const badgeText = this.scene.add.text(0, -6, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#facc15',
        align: 'center'
      }).setOrigin(0.5);
      cardCont.add(badgeText);

      // Card Title Text
      const titleText = this.scene.add.text(0, 9, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        fontStyle: 'bold',
        color: '#ffffff',
        align: 'center'
      }).setOrigin(0.5);
      cardCont.add(titleText);

      // Description Text (Wrapped)
      const descText = this.scene.add.text(0, 36, '', {
        fontFamily: 'monospace',
        fontSize: '6.5px',
        color: '#cbd5e1',
        align: 'center',
        wordWrap: { width: cardW - 12 }
      }).setOrigin(0.5);
      cardCont.add(descText);

      // Rarity Text at bottom
      const rarityText = this.scene.add.text(0, 58, '', {
        fontFamily: 'monospace',
        fontSize: '6.5px',
        fontStyle: 'bold',
        color: '#94a3b8',
        align: 'center'
      }).setOrigin(0.5);
      cardCont.add(rarityText);

      // Interactive hit area
      const hitZone = this.scene.add.zone(0, 0, cardW, cardH).setInteractive({ useHandCursor: true });
      const cardIndex = i;
      hitZone.on('pointerdown', () => this.selectCard(cardIndex));
      hitZone.on('pointerover', () => {
        cardCont.setScale(1.04);
        bgGraphics.clear();
        this.drawCardBackground(bgGraphics, cardW, cardH, cardCont.rarityHex || 0x94a3b8, true);
      });
      hitZone.on('pointerout', () => {
        cardCont.setScale(1.0);
        bgGraphics.clear();
        this.drawCardBackground(bgGraphics, cardW, cardH, cardCont.rarityHex || 0x94a3b8, false);
      });
      cardCont.add(hitZone);

      cardCont.elements = {
        bg: bgGraphics,
        icon: iconSprite,
        badge: badgeText,
        title: titleText,
        desc: descText,
        rarity: rarityText,
        zone: hitZone
      };

      this.cardContainers.push(cardCont);
      this.container.add(cardCont);
    }

    // 4. Action Buttons: Reroll & Skip
    const btnY = 222;

    // Reroll Button
    this.rerollCont = this.scene.add.container(w / 2 - 65, btnY);
    const rerollBg = this.scene.add.graphics();
    this.drawButton(rerollBg, 90, 20, 0x3b82f6, false);
    this.rerollCont.add(rerollBg);

    this.rerollText = this.scene.add.text(0, 0, `REROLL [R] (${this.rerollsRemaining})`, {
      fontFamily: 'monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.rerollCont.add(this.rerollText);

    const rerollZone = this.scene.add.zone(0, 0, 90, 20).setInteractive({ useHandCursor: true });
    rerollZone.on('pointerdown', () => this.reroll());
    rerollZone.on('pointerover', () => this.drawButton(rerollBg, 90, 20, 0x3b82f6, true));
    rerollZone.on('pointerout', () => this.drawButton(rerollBg, 90, 20, 0x3b82f6, false));
    this.rerollCont.add(rerollZone);
    this.container.add(this.rerollCont);

    // Skip Button
    this.skipCont = this.scene.add.container(w / 2 + 65, btnY);
    const skipBg = this.scene.add.graphics();
    this.drawButton(skipBg, 90, 20, 0x64748b, false);
    this.skipCont.add(skipBg);

    const skipText = this.scene.add.text(0, 0, `LEWATI [S] (+25 HP)`, {
      fontFamily: 'monospace',
      fontSize: '7px',
      fontStyle: 'bold',
      color: '#f1f5f9'
    }).setOrigin(0.5);
    this.skipCont.add(skipText);

    const skipZone = this.scene.add.zone(0, 0, 90, 20).setInteractive({ useHandCursor: true });
    skipZone.on('pointerdown', () => this.skip());
    skipZone.on('pointerover', () => this.drawButton(skipBg, 90, 20, 0x64748b, true));
    skipZone.on('pointerout', () => this.drawButton(skipBg, 90, 20, 0x64748b, false));
    this.skipCont.add(skipZone);
    this.container.add(this.skipCont);
  }

  drawCardBackground(graphics, w, h, borderHex, isHovered) {
    graphics.clear();
    // Dark body
    graphics.fillStyle(isHovered ? 0x1a1926 : 0x0f0e18, 0.96);
    graphics.fillRoundedRect(-w / 2, -h / 2, w, h, 4);

    // Frame border
    graphics.lineStyle(isHovered ? 2.5 : 1.5, borderHex, isHovered ? 1.0 : 0.85);
    graphics.strokeRoundedRect(-w / 2, -h / 2, w, h, 4);

    // Top icon backing slot
    graphics.fillStyle(0x06050b, 0.9);
    graphics.fillRect(-22, -48, 44, 28);
    graphics.lineStyle(1, borderHex, 0.5);
    graphics.strokeRect(-22, -48, 44, 28);
  }

  drawButton(graphics, w, h, colorHex, isHovered) {
    graphics.clear();
    graphics.fillStyle(isHovered ? colorHex : 0x0f172a, 0.95);
    graphics.fillRoundedRect(-w / 2, -h / 2, w, h, 3);
    graphics.lineStyle(1.5, colorHex, 0.9);
    graphics.strokeRoundedRect(-w / 2, -h / 2, w, h, 3);
  }

  setupInput() {
    // Keyboard shortcuts: 1, 2, 3 for cards, R for reroll, S/Space for skip
    this.scene.input.keyboard.on('keydown', (event) => {
      if (!this.isModalOpen) return;

      if (event.key === '1') {
        event.preventDefault();
        this.selectCard(0);
      } else if (event.key === '2') {
        event.preventDefault();
        this.selectCard(1);
      } else if (event.key === '3') {
        event.preventDefault();
        this.selectCard(2);
      } else if (event.key === 'r' || event.key === 'R') {
        event.preventDefault();
        this.reroll();
      } else if (event.key === 's' || event.key === 'S' || event.key === ' ') {
        event.preventDefault();
        this.skip();
      }
    });
  }

  /**
   * Enqueues a level-up event.
   * If modal is not currently open, opens it immediately.
   * @param {number} level - New Kaiju level
   */
  queueLevelUp(level) {
    this.levelUpQueue.push(level);
    if (!this.isModalOpen) {
      this.presentNextLevelUp();
    }
  }

  /**
   * Opens the card selection screen for the next pending level in the queue.
   */
  presentNextLevelUp() {
    if (this.levelUpQueue.length === 0) {
      this.closeModal();
      return;
    }

    const currentLevel = this.levelUpQueue.shift();
    this.isModalOpen = true;
    this.scene.isCardSelecting = true; // Pause game updates

    // Keep camera positioned centered on screen
    const cam = this.scene.cameras.main;
    const z = cam.zoom || 1.0;
    const visibleLeft = (cam.width / 2) * (1 - 1 / z);
    const visibleTop = (cam.height / 2) * (1 - 1 / z);
    this.container.setPosition(visibleLeft, visibleTop);
    this.container.setScale(1 / z);
    this.container.setVisible(true);

    this.headerText.setText(`KAIJU LEVEL ${currentLevel}!`);
    this.subHeaderText.setText(
      this.levelUpQueue.length > 0
        ? `Pilih 1 peningkatan (+${this.levelUpQueue.length} level lagi menanti)`
        : `Pilih 1 peningkatan [1, 2, 3]`
    );

    this.updateRerollButton();
    this.rollCards();
  }

  /**
   * Rolls 3 distinct eligible cards based on weights and build synergy.
   */
  rollCards() {
    const eligibleCards = [];
    const equippedWeaponCount = this.weaponSystem.equippedWeapons.size;

    for (const card of CARD_CONFIG.cards) {
      let currentLevel = 0;
      if (card.type === 'weapon') {
        currentLevel = this.weaponSystem.getWeaponLevel(card.weaponId);
      } else {
        currentLevel = this.passiveLevels.get(card.passiveKey) || 0;
      }

      // Check max level condition
      if (currentLevel >= card.maxLevel) continue;

      // Check 6 weapon slots cap condition
      if (card.type === 'weapon' && currentLevel === 0 && equippedWeaponCount >= WEAPON_CONFIG.maxWeaponSlots) {
        continue;
      }

      // Calculate weight based on rarity and owned build bonus
      const rarityData = CARD_CONFIG.rarities[card.rarity] || CARD_CONFIG.rarities.COMMON;
      let weight = rarityData.weight;

      if (card.type === 'weapon' && currentLevel > 0) {
        weight *= CARD_CONFIG.ownedWeaponWeightMultiplier;
      }

      eligibleCards.push({
        card,
        currentLevel,
        nextLevel: currentLevel + 1,
        weight,
        rarityData
      });
    }

    // Select up to 3 distinct cards using roulette wheel selection
    const chosen = [];
    const pool = [...eligibleCards];

    for (let c = 0; c < 3; c++) {
      if (pool.length === 0) break;

      let totalWeight = 0;
      for (const item of pool) totalWeight += item.weight;

      let r = Math.random() * totalWeight;
      let selectedIdx = 0;
      for (let i = 0; i < pool.length; i++) {
        r -= pool[i].weight;
        if (r <= 0) {
          selectedIdx = i;
          break;
        }
      }

      chosen.push(pool[selectedIdx]);
      pool.splice(selectedIdx, 1);
    }

    this.currentDisplayedCards = chosen;
    this.renderCards(chosen);
  }

  renderCards(cards) {
    const cardW = 94;
    const cardH = 138;

    for (let i = 0; i < 3; i++) {
      const cardCont = this.cardContainers[i];
      if (i < cards.length) {
        const item = cards[i];
        const card = item.card;
        const rarity = item.rarityData;

        cardCont.setVisible(true);
        cardCont.rarityHex = rarity.hex;

        this.drawCardBackground(cardCont.elements.bg, cardW, cardH, rarity.hex, false);
        cardCont.elements.icon.setTexture(card.icon);

        // Status badge: "BARU" or "Lv X"
        const badgeStr = item.currentLevel === 0 ? '[ BARU ]' : `[ Lv ${item.nextLevel} ]`;
        cardCont.elements.badge.setText(badgeStr);
        cardCont.elements.badge.setColor(item.currentLevel === 0 ? '#38bdf8' : '#facc15');

        cardCont.elements.title.setText(`[${i + 1}] ${card.name.toUpperCase()}`);

        const desc = card.descriptions[item.nextLevel - 1] || card.descriptions[0];
        cardCont.elements.desc.setText(desc);

        cardCont.elements.rarity.setText(rarity.name.toUpperCase());
        cardCont.elements.rarity.setColor(rarity.color);
      } else {
        cardCont.setVisible(false);
      }
    }
  }

  updateRerollButton() {
    this.rerollText.setText(`REROLL [R] (${this.rerollsRemaining})`);
    if (this.rerollsRemaining <= 0) {
      this.drawButton(this.rerollCont.first, 90, 20, 0x475569, false);
    } else {
      this.drawButton(this.rerollCont.first, 90, 20, 0x3b82f6, false);
    }
  }

  /**
   * Selects a card by index (0, 1, or 2)
   * @param {number} index 
   */
  selectCard(index) {
    if (!this.isModalOpen || index >= this.currentDisplayedCards.length) return;

    const chosen = this.currentDisplayedCards[index];
    this.applyCard(chosen.card, chosen.nextLevel);

    // Brief screen flash and audio/visual confirmation
    this.scene.particleManager.emitDebris(this.kaiju.x, this.kaiju.y, chosen.rarityData.hex, 8, 45);

    // Progress to next queued level or close
    this.presentNextLevelUp();
  }

  /**
   * Applies the chosen card's effects to Kaiju, WeaponSystem, or XpSystem.
   * @param {Object} card 
   * @param {number} level 
   */
  applyCard(card, level) {
    if (card.type === 'weapon') {
      this.weaponSystem.equipWeapon(card.weaponId, level);
    } else if (card.type === 'passive') {
      this.passiveLevels.set(card.passiveKey, level);
      const effect = card.effects[level - 1] || card.effects[0];

      if (card.passiveKey === 'ironSkin') {
        const bonusHp = Math.round(GAME_CONFIG.kaiju.maxHp * (1 + (level * 0.15)));
        this.kaiju.maxHp = bonusHp;
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + (effect.healAmount || 45));
      } else if (card.passiveKey === 'magnet') {
        this.xpSystem.magnetRadiusBonus = effect.radiusBonus || 0;
      } else if (card.passiveKey === 'swiftStride') {
        this.kaiju.speedMultiplier = effect.speedMultiplier || 1.15;
      } else if (card.passiveKey === 'colossus') {
        // Smoothly scale up Kaiju body & trample footprint
        const nextScale = 1.0 + (effect.scaleBonus || 0.15);
        this.kaiju.setKaijuScale(nextScale);
      } else if (card.passiveKey === 'carnage') {
        this.weaponSystem.damageMultiplier = effect.damageMultiplier || 1.2;
      } else if (card.passiveKey === 'rapidFire') {
        this.weaponSystem.cooldownMultiplier = effect.cooldownMultiplier || 0.85;
      } else if (card.passiveKey === 'demolisher') {
        this.weaponSystem.buildingDmgMultiplier = effect.buildingDmgMultiplier || 1.35;
      } else if (card.passiveKey === 'thornShield') {
        this.weaponSystem.thornDamage = effect.thornDamage || 25;
        this.weaponSystem.thornRadius = effect.thornRadius || 45;
      }
    }
  }

  /**
   * Rerolls currently offered cards if rerolls are available
   */
  reroll() {
    if (this.rerollsRemaining <= 0 || !this.isModalOpen) return;
    this.rerollsRemaining--;
    this.updateRerollButton();
    this.rollCards();
  }

  /**
   * Skips card selection, awards compensation, and closes modal
   */
  skip() {
    if (!this.isModalOpen) return;

    // Award compensation: Heal 25 HP
    this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + CARD_CONFIG.skipRewardHp);

    this.presentNextLevelUp();
  }

  /**
   * Closes the card modal and unpauses the game
   */
  closeModal() {
    this.isModalOpen = false;
    this.scene.isCardSelecting = false;
    this.container.setVisible(false);
  }

  /**
   * Per-frame update for active passives like Regeneration
   * @param {number} dt 
   */
  update(dt) {
    if (this.isModalOpen) return;

    // Passive: Regeneration
    const regenLevel = this.passiveLevels.get('regeneration') || 0;
    if (regenLevel > 0 && this.kaiju.hp < this.kaiju.maxHp) {
      const card = CARD_CONFIG.cards.find(c => c.id === 'regenerasi');
      if (card) {
        const hpPerSec = card.effects[regenLevel - 1].hpPerSec;
        this.kaiju.hp = Math.min(this.kaiju.maxHp, this.kaiju.hp + hpPerSec * dt);
      }
    }
  }

  /**
   * Resets all cards, passives, rerolls, and closes modal cleanly (RunState reset)
   */
  reset() {
    this.passiveLevels.clear();
    this.rerollsRemaining = CARD_CONFIG.rerollsPerRun;
    this.levelUpQueue = [];
    this.closeModal();

    if (this.kaiju) {
      this.kaiju.speedMultiplier = 1.0;
    }
  }

  /**
   * Destroys UI elements
   */
  destroy() {
    this.reset();
    if (this.container) this.container.destroy();
  }
}
