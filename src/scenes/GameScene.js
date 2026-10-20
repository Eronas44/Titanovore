import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/game.js';
import { WORLD_CONFIG } from '../config/world.js';
import { PALETTE } from '../config/palette.js';
import { CityGrid, CELL_TYPES } from '../world/CityGrid.js';
import { CityGenerator } from '../world/CityGenerator.js';
import { ChunkRenderer } from '../world/ChunkRenderer.js';
import { Kaiju } from '../entities/Kaiju.js';
import { Crowd } from '../entities/Crowd.js';
import { ParticleManager } from '../effects/ParticleManager.js';
import { EnemyManager, ENEMY_TYPES } from '../enemies/EnemyManager.js';
import { NavGrid } from '../world/NavGrid.js';
import { ENEMY_CONFIG } from '../config/enemies.js';
import { AlertSystem } from '../systems/AlertSystem.js';
import { ALERT_CONFIG } from '../config/alert.js';
import { XpSystem } from '../systems/XpSystem.js';
import { XP_CONFIG } from '../config/xp.js';
import { WeaponSystem } from '../weapons/WeaponSystem.js';
import { WEAPON_CONFIG } from '../config/weapons.js';
import { CardSystem } from '../cards/CardSystem.js';
import { EVOLUTION_CONFIG } from '../config/evolutions.js';
import { UIManager } from '../ui/UIManager.js';
import { Districts } from '../world/Districts.js';
import { DISTRICTS_CONFIG } from '../config/districts.js';
import { RebuildSystem } from '../world/RebuildSystem.js';
import { SaveSystem } from '../systems/SaveSystem.js';
import { BossManager } from '../enemies/Boss.js';
import { BOSS_CONFIG } from '../config/boss.js';
import { EventSystem } from '../systems/EventSystem.js';

/**
 * GameScene - Tahap 3B
 * Orchestrates:
 * - AlertSystem threat escalation (Siaga 1 - 5, level notifications, inactivity decay)
 * - Military & Airborne threats (Soldiers, Attack Helicopters, Kamikaze Drones)
 * - Kaiju body & tail trample damage on 4x4 px grid cells
 * - NavGrid dual-layer walkability (infantry & inflated vehicle) and dynamic flow fields
 * - RunState vs WorldState persistence (respawning resets Siaga & enemies, city damage persists)
 * - Debug keys: [F] Scale Up, [R] Respawn, [Shift+R] Full Reset, [F6] Air Kill, [F7/F8] Siaga +/-, [F3] HUD
 */
export class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    // 1. Scoring & Telemetry Stats
    this.stats = {
      buildingsDestroyed: 0,
      humansKilled: 0,
      policeKilled: 0,
      carsDestroyed: 0,
      tanksDestroyed: 0,
      soldiersKilled: 0,
      helicoptersDestroyed: 0,
      dronesDestroyed: 0,
      xp: 0,
      survivalTime: 0
    };
    this.isGameOver = false;

    // 2. Active collapse wave animations queue
    this.activeCollapses = [];
    this.hitstopTimer = 0;
    this.trampleTimer = 0;
    this.isolationChecksThisFrame = 0;

    // 3. Initialize Particle Manager (Pre-allocated zero-GC pools)
    this.particleManager = new ParticleManager(this);

    // 4. Initialize Spatial Grid (4x4 px cells, typed array storage)
    this.cityGrid = new CityGrid(WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, WORLD_CONFIG.cellSize);

    // 5. Procedural City Generation (Roads, Blocks, Buildings, Parks, Canal)
    this.cityGenerator = new CityGenerator(WORLD_CONFIG.seed);
    this.cityData = this.cityGenerator.generate(this.cityGrid);

    // 5a. Initialize Persistent Districts (Tahap 5A)
    this.districts = new Districts(this.cityData, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);
    for (const bldg of this.cityGrid.buildings.values()) {
      this.districts.registerBuilding(bldg);
    }

    // 5b. Initialize 8x8 px Navigation Grid & Flow Field (Tahap 3A-2)
    this.navGrid = new NavGrid(this.cityGrid, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, ENEMY_CONFIG.navCellSize);

    // 5c. Initialize Alert System (Siaga 1-5 threat meter - Tahap 3B)
    this.alertSystem = new AlertSystem(this);

    // 6. Chunk Renderer (256x256 px chunks, dirty rect batch rendering, camera culling)
    this.chunkRenderer = new ChunkRenderer(this, this.cityData);

    // 6b. Initialize City Rebuild System (Tahap 5A)
    this.rebuildSystem = new RebuildSystem(this);

    // 6c. Initialize IndexedDB Save System (Tahap 5A)
    this.saveSystem = new SaveSystem(this);
    this.saveSystem.loadWorldState().then(async (savedState) => {
      if (savedState) {
        if (this.uiManager) {
          this.uiManager.showLoadingScreen('MEMUAT KOTA PERSISTEN', 0);
        }
        await this.saveSystem.applyWorldState(savedState, (prog) => {
          if (this.uiManager) {
            this.uiManager.updateLoadingProgress(prog);
          }
        });
        if (this.uiManager) {
          this.uiManager.hideLoadingScreen();
          this.uiManager.showEventBanner('KOTA DIMUAT', 'DATA PERSISTENSI KOTA BERHASIL DITERAPKAN', 2000);
        }
      }
    });

    // 7. Spawn Kaiju in the center of the world (Downtown)
    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju = new Kaiju(this, spawnX, spawnY);

    // 8. Spawn High-Performance Enemy & Threat Manager (Tahap 3B)
    this.enemyManager = new EnemyManager(this, this.cityGrid, this.navGrid, this.alertSystem, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);

    // 8b. Spawn Ambient Crowd (Ambient vehicles & decorative pedestrians)
    this.crowd = new Crowd(this, this.cityData);

    // 8c. Initialize XP & Progression System (Tahap 4A)
    this.xpSystem = new XpSystem(this, (newLevel) => {
      if (this.cardSystem) {
        this.cardSystem.queueLevelUp(newLevel);
      }
    });

    // 8d. Initialize Automatic Weapon System (Tahap 4A)
    this.weaponSystem = new WeaponSystem(
      this,
      this.kaiju,
      this.enemyManager,
      this.cityGrid,
      this.particleManager
    );

    // 8e. Initialize Rogue-lite Card Selection System (Tahap 4A)
    this.cardSystem = new CardSystem(
      this,
      this.kaiju,
      this.weaponSystem,
      this.xpSystem
    );

    // 9. Camera Setup
    this.setupCamera();

    // 10. UI Manager (Crisp HTML/CSS Overlay over canvas)
    this.uiManager = new UIManager('ui-root', () => {
      return this.cardSystem && this.cardSystem.evolutionSystem
        ? this.cardSystem.evolutionSystem.getAllRecipesStatus()
        : [];
    }, this);
    this.isExtendedHud = false;
    this.evolutionDebugIndex = 0;
    this.profiling = { tEnemy: 0, tWeapon: 0, tParticle: 0, tChunk: 0, tNav: 0, tUI: 0, tBoss: 0 };

    // 10b. Initialize Mech-Titan Boss Director (Tahap 5B-1)
    this.bossManager = new BossManager(this);
    this.boss = null;

    // 10c. Initialize Special Events System (Tahap 5B-2)
    this.eventSystem = new EventSystem(this, this.enemyManager, this.alertSystem, this.cityGrid, this.navGrid);

    // 11. Debug Hotkeys Setup (F: Grow, R: Respawn, 1-4: Teleport, F3: HUD, F6: AirKill, F7/F8: Siaga, M: Evolution Cheat, T: Rebuild, Y: Save, N: Minimap, O: Boss, P: Boss 10% HP, G: Event, H: Elite, J: Artileri)
    this.setupDebugKeys();
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);
    cam.startFollow(
      this.kaiju.container,
      false,
      GAME_CONFIG.camera.followLerpX,
      GAME_CONFIG.camera.followLerpY
    );
    cam.setZoom(GAME_CONFIG.camera.initialZoom);
  }

  /**
   * Sets up debug hotkeys:
   * [F]: Increment Kaiju scale (+0.3 up to 3.0x)
   * [R]: Clean world restart
   * [1-4]: Teleport to districts
   * [F3]: Toggle HUD
   */
  /**
   * Sets up debug hotkeys:
   * [F]: Increment Kaiju scale (+0.3 up to 3.0x)
   * [R]: Bangkit Kembali / Respawn Kaiju (RunState reset: Siaga resets, city damage persists)
   * [Shift + R]: Hard World Reset (Regenerates entire city from scratch)
   * [1-4]: Teleport to districts
   * [F3]: Toggle HUD / telemetry overlay
   * [F6]: (Temp Debug) Kill nearest air enemies (Helis/Drones) in radius
   * [F7]: (Temp Debug) Increase Siaga +15
   * [F8]: (Temp Debug) Decrease Siaga -15
   */
  setupDebugKeys() {
    // 1. [F] Key: Increment Kaiju scale
    this.input.keyboard.on('keydown-F', () => {
      let nextScale = this.kaiju.currentScale + 0.3;
      if (nextScale > 3.0) nextScale = 1.0;
      this.kaiju.setKaijuScale(nextScale);
      const targetZoom = Math.max(1.0, GAME_CONFIG.camera.initialZoom - (nextScale - 1.0) * 0.25);
      this.cameras.main.zoomTo(targetZoom, 400);
    });

    // 2. [R] Key: Bangkit Kembali (RunState reset: Siaga & enemies reset, city damage persists)
    this.input.keyboard.on('keydown-R', (event) => {
      if (event.shiftKey) {
        this.startNewCity(); // Hard full world reset + deletes save
      } else {
        this.respawnKaiju(); // RunState respawn: city remains destroyed
      }
    });

    // 3. [1-4] Keys: Zone Teleport
    this.currentZoneName = 'Downtown';
    const zones = [
      { key: 'ONE', name: 'Downtown', x: 2000, y: 2000 },
      { key: 'TWO', name: 'Residential', x: 1000, y: 1000 },
      { key: 'THREE', name: 'Industrial', x: 2700, y: 2700 },
      { key: 'FOUR', name: 'Park & Canal', x: 1610, y: 1980 }
    ];

    zones.forEach(z => {
      this.input.keyboard.on(`keydown-${z.key}`, () => {
        // Disable district teleport when selecting cards
        if (this.cardSystem && this.cardSystem.isModalOpen) return;

        this.kaiju.x = z.x;
        this.kaiju.y = z.y;
        this.kaiju.vx = 0;
        this.kaiju.vy = 0;
        this.kaiju.container.setPosition(z.x, z.y);
        this.currentZoneName = z.name;
        this.chunkRenderer.update(this.cameras.main);
      });
    });

    // 4. [F3] Key: Toggle HTML Technical Telemetry Overlay
    this.input.keyboard.on('keydown-F3', (event) => {
      event.preventDefault();
      this.isExtendedHud = !this.isExtendedHud;
    });

    // 5. [F6] Key: (Temporary Debug) Clear nearest air enemies (Helicopters & Drones)
    this.input.keyboard.on('keydown-F6', (event) => {
      event.preventDefault();
      if (this.enemyManager) {
        const count = this.enemyManager.debugKillNearestAirEnemies(this.kaiju.x, this.kaiju.y, 280);
        this.particleManager.emitDebris(this.kaiju.x, this.kaiju.y, 0xef4444, 4, 30);
      }
    });

    // 6. [F7] Key: (Temporary Debug) Increase Siaga +15
    this.input.keyboard.on('keydown-F7', (event) => {
      event.preventDefault();
      if (this.alertSystem) {
        this.alertSystem.setAlert(this.alertSystem.alert + 15);
      }
    });

    // 7. [F8] Key: (Temporary Debug) Decrease Siaga -15
    this.input.keyboard.on('keydown-F8', (event) => {
      event.preventDefault();
      if (this.alertSystem) {
        this.alertSystem.setAlert(this.alertSystem.alert - 15);
      }
    });

    // 8. [X] Key: (Temporary Debug) Instant Level Up (Presents Card Selection)
    this.input.keyboard.on('keydown-X', (event) => {
      event.preventDefault();
      if (this.cardSystem && this.xpSystem) {
        this.cardSystem.queueLevelUp(this.xpSystem.level + 1);
      }
    });

    // 9. [C] Key: (Temporary Debug) +500 XP
    this.input.keyboard.on('keydown-C', (event) => {
      event.preventDefault();
      if (this.xpSystem) {
        this.xpSystem.addDirectXp(500);
      }
    });

    // 10. [TAB] Key: Toggle Recipe Book
    this.input.keyboard.on('keydown-TAB', (event) => {
      event.preventDefault();
      if (this.uiManager) {
        this.uiManager.toggleRecipeBook();
      }
    });

    // 11. [M] Key: (Temporary Debug) Cycle through and grant evolution ingredients
    this.input.keyboard.on('keydown-M', (event) => {
      event.preventDefault();
      const evos = EVOLUTION_CONFIG.evolutions;
      if (!evos || evos.length === 0) return;

      const evo = evos[this.evolutionDebugIndex % evos.length];
      this.evolutionDebugIndex++;

      // Grant Primary Ingredient at required min level
      if (evo.primaryIngredient.type === 'weapon') {
        this.weaponSystem.equipWeapon(evo.primaryIngredient.id, evo.primaryIngredient.minLevel);
      } else {
        this.cardSystem.passiveLevels.set(evo.primaryIngredient.id, evo.primaryIngredient.minLevel);
      }

      // Grant Secondary Ingredient at required min level
      if (evo.secondaryIngredient.type === 'weapon') {
        this.weaponSystem.equipWeapon(evo.secondaryIngredient.id, evo.secondaryIngredient.minLevel);
      } else {
        this.cardSystem.passiveLevels.set(evo.secondaryIngredient.id, evo.secondaryIngredient.minLevel);
      }

      if (this.uiManager) {
        this.uiManager.showEventBanner('DEBUG CHEAT [M]', `BAHAN "${evo.name.toUpperCase()}" DISIAPKAN!`, 1800);
      }
    });

    // 12. [T] Key: (Temporary Debug) Fast Rebuild Toggle (10s delay vs 360s)
    this.input.keyboard.on('keydown-T', (event) => {
      event.preventDefault();
      if (this.rebuildSystem) {
        const isFast = this.rebuildSystem.toggleFastDebugMode();
        if (this.uiManager) {
          const status = isFast ? 'CEPAT (10 DETIK)' : 'NORMAL (6 MENIT)';
          this.uiManager.showEventBanner('PEMBANGUNAN KOTA [T]', `JEDA RECOVERY: ${status}`, 2200);
        }
      }
    });

    // 13. [Y] Key: (Temporary Debug) Save WorldState now and reload scene (test save/load without browser refresh)
    this.input.keyboard.on('keydown-Y', async (event) => {
      event.preventDefault();
      if (this.saveSystem) {
        if (this.uiManager) {
          this.uiManager.showEventBanner('SIMPAN & MUAT [Y]', 'MENYIMPAN KE INDEXEDDB DAN MEMUAT ULANG...', 1500);
        }
        await this.saveSystem.saveNow();
        this.time.delayedCall(250, () => {
          this.scene.restart();
        });
      }
    });

    // 14. [N] Key: Toggle Tactical Radar Minimap
    this.input.keyboard.on('keydown-N', (event) => {
      event.preventDefault();
      if (this.uiManager) {
        this.uiManager.toggleMinimap();
      }
    });

    // 15. [K] Key: (Temporary Debug) Trigger 80% District Milestone Test
    this.input.keyboard.on('keydown-K', (event) => {
      event.preventDefault();
      if (this.districts) {
        const curD = this.districts.getCurrentDistrict();
        if (curD) {
          curD.destroyedBuildingCells = Math.ceil(curD.totalInitialBuildingCells * 0.81);
          curD.is80PercentDestroyed = true;
          if (this.uiManager) {
            this.uiManager.showEventBanner('DISTRIK RATA!', `${curD.name.toUpperCase()} HANCUR 80%! HADIAH KARTU BONUS DIBERIKAN!`, 3000);
          }
          if (this.alertSystem) {
            this.alertSystem.addAlert(DISTRICTS_CONFIG.milestones.collapseRewardAlertGain || 15);
          }
          if (this.cardSystem) {
            this.cardSystem.queueBonusCardScreen(`DISTRIK ${curD.name.toUpperCase()} RATA`);
          }
        }
      }
    });

    // 16. [O] Key: (Temporary Debug) Spawn Mech-Titan Boss immediately
    this.input.keyboard.on('keydown-O', (event) => {
      event.preventDefault();
      if (this.bossManager) {
        this.bossManager.spawnBossNow(this.kaiju);
        if (this.uiManager) {
          this.uiManager.showEventBanner('DEBUG CHEAT [O]', 'MECH-TITAN DIMUNCULKAN LANGSUNG!', 2000);
        }
      }
    });

    // 17. [P] Key: (Temporary Debug) Set Boss HP to 10% for phase 3 and death testing
    this.input.keyboard.on('keydown-P', (event) => {
      event.preventDefault();
      const b = this.boss || (this.bossManager && this.bossManager.activeBoss);
      if (b && b.isAlive) {
        b.hp = Math.round(b.maxHp * 0.10);
        b.takeDamage(1, true); // Trigger phase updates
        if (this.uiManager) {
          this.uiManager.showEventBanner('DEBUG CHEAT [P]', 'HP MECH-TITAN DITURUNKAN KE 10%!', 2000);
        }
      }
    });

    // 18. [G] Key: (Temporary Debug - Tahap 5B-2) Trigger Next Special Event in rotation
    this.input.keyboard.on('keydown-G', (event) => {
      event.preventDefault();
      if (this.eventSystem) {
        const ev = this.eventSystem.triggerNextEvent(this.kaiju);
        if (this.uiManager) {
          this.uiManager.showEventBanner('DEBUG CHEAT [G]', `KEJADIAN DIPICU: ${ev}`, 2000);
        }
      }
    });

    // 19. [H] Key: (Temporary Debug - Tahap 5B-2) Spawn 1 Elite Enemy Near Kaiju
    this.input.keyboard.on('keydown-H', (event) => {
      event.preventDefault();
      if (this.enemyManager) {
        this.enemyManager.spawnDebugElite(this.kaiju);
        if (this.uiManager) {
          this.uiManager.showEventBanner('DEBUG CHEAT [H]', 'MUSUH ELIT DIMUNCULKAN!', 2000);
        }
      }
    });

    // 20. [J] Key: (Temporary Debug - Tahap 5B-2) Spawn 3 Artillery Units Near Kaiju
    this.input.keyboard.on('keydown-J', (event) => {
      event.preventDefault();
      if (this.enemyManager) {
        this.enemyManager.spawnDebugArtillery(this.kaiju, 3);
        if (this.uiManager) {
          this.uiManager.showEventBanner('DEBUG CHEAT [J]', '3 ARTILERI BERGERAK DIMUNCULKAN!', 2000);
        }
      }
    });

    // 21. [U] Key: (Tahap 6A) Toggle Godzilla Mutation Layer & Anchor Inspector Overlay
    this.input.keyboard.on('keydown-U', (event) => {
      event.preventDefault();
      if (this.uiManager) {
        this.uiManager.toggleLayerInspector();
      }
    });
  }

  /**
   * Resets WorldState in IndexedDB and starts a completely fresh city
   */
  async startNewCity() {
    if (this.saveSystem) {
      await this.saveSystem.clearSave();
    }
    this.restartCity();
    if (this.uiManager) {
      this.uiManager.showEventBanner('KOTA BARU', 'KOTA TELAH DIRESET DAN SIAP DIHANCURKAN!', 2200);
    }
  }

  /**
   * Bangkit Kembali / Respawn Kaiju:
   * Resets RunState (Siaga resets to 0 / Level 1, active enemies reset, Kaiju revives),
   * while keeping WorldState (city damage, rubble, craters, collapsed buildings) completely intact!
   */
  respawnKaiju() {
    this.isGameOver = false;
    this.time.timeScale = 1.0;
    if (this.uiManager) {
      this.uiManager.closeDeath();
    }

    // 1. Reset particle & collapse waves
    this.particleManager.reset();
    this.activeCollapses = [];
    this.hitstopTimer = 0;

    // 2. Revive Kaiju & Reset Position
    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju.isDead = false;
    this.kaiju.maxHp = GAME_CONFIG.kaiju.maxHp;
    this.kaiju.hp = this.kaiju.maxHp;
    this.kaiju.speedMultiplier = 1.0;
    this.kaiju.container.setVisible(true);
    if (this.kaiju.leftFoot) this.kaiju.leftFoot.setVisible(true);
    if (this.kaiju.rightFoot) this.kaiju.rightFoot.setVisible(true);
    if (this.kaiju.tailSegments) {
      this.kaiju.tailSegments.forEach(seg => seg.sprite.setVisible(true));
    }
    this.kaiju.resetPosition(spawnX, spawnY);
    this.kaiju.setKaijuScale(1.0);
    this.cameras.main.setZoom(GAME_CONFIG.camera.initialZoom);

    // 3. Reset RunState: Siaga, Enemies, XP, Weapons, and Cards reset!
    if (this.alertSystem) {
      this.alertSystem.reset();
    }
    if (this.enemyManager) {
      this.enemyManager.reset();
    }
    if (this.crowd) {
      this.crowd.reset();
    }
    if (this.xpSystem) {
      this.xpSystem.reset();
    }
    if (this.weaponSystem) {
      this.weaponSystem.reset();
    }
    if (this.cardSystem) {
      this.cardSystem.reset();
    }
    if (this.districts) {
      this.districts.resetRunState(); // Reset per-run milestone claim flags
    }
    if (this.bossManager) {
      this.bossManager.resetRunState(); // Reset boss on kaiju death/respawn
    }
    if (this.eventSystem) {
      this.eventSystem.reset();
    }
    this.isCardSelecting = false;

    // 4. Reset Run Telemetry (City destruction stats remain accumulated)
    this.stats.survivalTime = 0;

    // 5. WorldState remains intact: cityGrid, rubble, chunkRenderer textures are NOT wiped!
    this.chunkRenderer.update(this.cameras.main);
  }

  /**
   * Performs a hard clean restart of the entire city from scratch (used on Shift+R)
   */
  restartCity() {
    this.isGameOver = false;
    this.time.timeScale = 1.0;
    if (this.uiManager) {
      this.uiManager.closeDeath();
    }

    this.particleManager.reset();
    this.activeCollapses = [];
    this.hitstopTimer = 0;

    this.chunkRenderer.destroy();

    this.cityGrid = new CityGrid(WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, WORLD_CONFIG.cellSize);
    this.cityData = this.cityGenerator.generate(this.cityGrid);
    this.navGrid = new NavGrid(this.cityGrid, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight, ENEMY_CONFIG.navCellSize);
    this.chunkRenderer = new ChunkRenderer(this, this.cityData);

    if (this.districts) {
      this.districts = new Districts(this.cityData, WORLD_CONFIG.worldWidth, WORLD_CONFIG.worldHeight);
      for (const bldg of this.cityGrid.buildings.values()) {
        this.districts.registerBuilding(bldg);
      }
    }
    if (this.rebuildSystem) {
      this.rebuildSystem.reset();
    }

    if (this.alertSystem) {
      this.alertSystem.reset();
    }
    if (this.enemyManager) {
      this.enemyManager.cityGrid = this.cityGrid;
      this.enemyManager.navGrid = this.navGrid;
      this.enemyManager.alertSystem = this.alertSystem;
      this.enemyManager.reset();
    }
    if (this.crowd) {
      this.crowd.reset();
    }
    if (this.xpSystem) {
      this.xpSystem.reset();
    }
    if (this.weaponSystem) {
      this.weaponSystem.reset();
    }
    if (this.cardSystem) {
      this.cardSystem.reset();
    }
    if (this.bossManager) {
      this.bossManager.resetRunState();
    }
    if (this.eventSystem) {
      this.eventSystem.reset();
    }
    this.isCardSelecting = false;

    const spawnX = WORLD_CONFIG.worldWidth / 2;
    const spawnY = WORLD_CONFIG.worldHeight / 2;
    this.kaiju.resetPosition(spawnX, spawnY);
    this.kaiju.maxHp = GAME_CONFIG.kaiju.maxHp;
    this.kaiju.hp = this.kaiju.maxHp;
    this.kaiju.speedMultiplier = 1.0;
    this.kaiju.setKaijuScale(1.0);
    this.cameras.main.setZoom(GAME_CONFIG.camera.initialZoom);

    this.stats = {
      buildingsDestroyed: 0,
      humansKilled: 0,
      policeKilled: 0,
      carsDestroyed: 0,
      tanksDestroyed: 0,
      soldiersKilled: 0,
      helicoptersDestroyed: 0,
      dronesDestroyed: 0,
      xp: 0,
      survivalTime: 0
    };

    this.chunkRenderer.update(this.cameras.main);
  }

  /**
   * Updates HTML/CSS HUD and telemetry via UIManager
   */
  updateHUD() {
    if (!this.uiManager) return;

    const curHp = Math.max(0, Math.ceil(this.kaiju.hp));
    const maxHp = this.kaiju.maxHp;
    const alertLevel = this.alertSystem ? this.alertSystem.currentLevel : 1;
    const alertVal = this.alertSystem ? this.alertSystem.alert : 0;
    const alertName = this.alertSystem ? this.alertSystem.getLevelName() : 'AMAN';

    const mins = Math.floor(this.stats.survivalTime / 60);
    const secs = Math.floor(this.stats.survivalTime % 60);
    const survivalTimeStr = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    const totalKills = this.stats.humansKilled +
      this.stats.policeKilled +
      this.stats.carsDestroyed +
      this.stats.tanksDestroyed +
      this.stats.soldiersKilled +
      this.stats.helicoptersDestroyed +
      this.stats.dronesDestroyed;
    const destructionPct = this.cityGrid.getDestructionPercentage().toFixed(1);
    const bldgsCount = this.stats.buildingsDestroyed;

    const level = this.xpSystem ? this.xpSystem.level : 1;
    const xp = this.xpSystem ? this.xpSystem.currentXp : 0;
    const targetXp = this.xpSystem ? this.xpSystem.targetXp : 20;

    // Weapons with cooldown ratios
    const weapons = [];
    if (this.weaponSystem) {
      for (const [id, entry] of this.weaponSystem.equippedWeapons.entries()) {
        const isEvolution = !!entry.isEvolution;
        const def = WEAPON_CONFIG.weapons[id];
        const lvlObj = def && def.levels && def.levels[entry.level - 1];
        const baseCd = isEvolution
          ? (entry.evoData?.stats?.cooldown || 1.5)
          : (lvlObj ? lvlObj.cooldown : (def ? def.cooldown : 1.0));
        const cdTime = baseCd * (this.weaponSystem.cooldownMultiplier || 1.0);
        const cdRatio = cdTime > 0 ? (entry.timer / cdTime) : 0;
        weapons.push({ id, level: entry.level, cdRatio, isEvolution });
      }
    }

    // Passives
    const passives = [];
    if (this.cardSystem) {
      for (const [key, lvl] of this.cardSystem.passiveLevels.entries()) {
        if (lvl > 0) passives.push({ key, level: lvl });
      }
    }

    // F3 Extended Telemetry (Detailed ms breakdown per frame)
    let f3Text = '';
    if (this.isExtendedHud) {
      const fps = Math.round(this.game.loop.actualFps);
      const tc = this.enemyManager ? this.enemyManager.typeCounts : [0,0,0,0,0,0,0,0,0,0,0];
      const activeTot = this.enemyManager ? this.enemyManager.activeCount : 0;
      const eliteTot = this.enemyManager ? this.enemyManager.eliteCount : 0;
      const p = this.profiling || { tEnemy: 0, tWeapon: 0, tParticle: 0, tChunk: 0, tNav: 0, tUI: 0, tBoss: 0, tEvent: 0 };

      const curD = this.districts ? this.districts.getCurrentDistrict() : null;
      const dName = curD ? curD.name : 'Downtown';
      const dPct = curD ? this.districts.getDestructionPercentage(curD.id).toFixed(1) : '0.0';
      const fastRebuildStr = (this.rebuildSystem && this.rebuildSystem.isFastDebugMode) ? 'CEPAT (10s)' : 'NORMAL (6m)';

      const curB = this.boss || (this.bossManager && this.bossManager.activeBoss);
      const bStatus = curB && curB.isAlive
        ? `FASE ${curB.phase}${curB.isEnraged ? ' (ENRAGED)' : ''} | HP: ${Math.ceil(curB.hp)}/${curB.maxHp} | ATK: ${curB.currentAttack || 'IDLE'} | ${(p.tBoss || 0).toFixed(2)}ms`
        : (this.bossManager && this.bossManager.spawnState === 'warning' ? `MENDEKAT (${this.bossManager.warningTimer.toFixed(1)}s)` : 'TIDAK AKTIF');

      const evTelemetry = this.eventSystem ? this.eventSystem.getTelemetry() : null;
      const evStatus = evTelemetry && evTelemetry.activeEvent
        ? `${evTelemetry.activeEvent} (${evTelemetry.eventTimer}s) | ${(p.tEvent || 0).toFixed(2)}ms`
        : `IDLE (Cooldown: ${evTelemetry ? evTelemetry.cooldownTimer : 0}s)`;

      f3Text = `FPS: ${fps} | TOTAL KOTA: ${destructionPct}% | DISTRIK: ${dName.toUpperCase()} (${dPct}%)\n` +
               `PROFILE (ms): Enemy: ${p.tEnemy.toFixed(2)} | Wpn: ${p.tWeapon.toFixed(2)} | Part: ${p.tParticle.toFixed(2)} | Chunk: ${p.tChunk.toFixed(2)} | Nav: ${p.tNav.toFixed(2)} | UI: ${p.tUI.toFixed(2)} | Boss: ${(p.tBoss || 0).toFixed(2)} | Event: ${(p.tEvent || 0).toFixed(2)}\n` +
               `ENTITIES: C:${tc[1]} P:${tc[2]} T:${tc[4]} S:${tc[5]} H:${tc[6]} D:${tc[7]} ART:${tc[9] || 0} TRK:${tc[10] || 0} | ELIT:${eliteTot} (TOT: ${activeTot})\n` +
               `EVENT: ${evStatus}\n` +
               `BOSS: ${bStatus}\n` +
               `HOTKEYS: [G] Event | [H] Elite | [J] Artileri | [O] Boss | [P] Boss 10% | [T] Rebuild | [N] Radar`;
    }

    const curDistrict = this.districts ? this.districts.getCurrentDistrict() : null;
    const districtName = curDistrict ? curDistrict.name : 'Pusat Kota';
    const districtColor = curDistrict ? curDistrict.color : '#38bdf8';
    const districtDestructionPct = curDistrict ? this.districts.getDestructionPercentage(curDistrict.id).toFixed(1) : '0.0';
    const lastSavedStr = this.saveSystem ? `Disimpan: ${this.saveSystem.getLastSavedString()}` : 'Tersimpan';

    const curBoss = this.boss || (this.bossManager && this.bossManager.activeBoss);
    const bossData = curBoss && curBoss.isAlive ? {
      active: true,
      name: 'MECH-TITAN',
      hp: curBoss.hp,
      maxHp: curBoss.maxHp,
      phase: curBoss.phase,
      isEnraged: curBoss.isEnraged
    } : null;

    const eventTelemetry = this.eventSystem ? this.eventSystem.getTelemetry() : null;

    this.uiManager.update({
      hp: curHp,
      maxHp,
      alertLevel,
      alertVal,
      alertName,
      survivalTimeStr,
      totalKills,
      destructionPct,
      bldgsCount,
      districtName,
      districtColor,
      districtDestructionPct,
      lastSavedStr,
      level,
      xp,
      targetXp,
      weapons,
      passives,
      boss: bossData,
      eventData: eventTelemetry,
      f3Visible: this.isExtendedHud,
      f3Text
    });
  }

  /**
   * Catastrophic Kaiju collapse sequence when HP reaches 0
   */
  onKaijuDeath() {
    this.isGameOver = true;
    this.kaiju.isDead = true;

    // Close card selection modal if open when dying
    if (this.cardSystem) {
      this.cardSystem.closeModal();
    }
    this.isCardSelecting = false;

    // Save WorldState immediately on death
    if (this.saveSystem) {
      this.saveSystem.saveNow();
    }

    // 1. Slow-motion cinematic effect
    this.time.timeScale = 0.25;

    // 2. Heavy earthquake camera shake
    this.cameras.main.shake(700, 0.015);

    // 3. Massive explosion of Kaiju scales, dust, and sparks
    this.particleManager.emitKaijuDeathExplosion(this.kaiju.x, this.kaiju.y);

    // 4. Hide Kaiju body & segments
    this.kaiju.container.setVisible(false);
    if (this.kaiju.leftFoot) this.kaiju.leftFoot.setVisible(false);
    if (this.kaiju.rightFoot) this.kaiju.rightFoot.setVisible(false);
    if (this.kaiju.tailSegments) {
      this.kaiju.tailSegments.forEach(seg => seg.sprite.setVisible(false));
    }

    // 5. Brief pause before displaying HTML "KAIJU TUMBANG" summary dialog
    this.time.delayedCall(700, () => {
      this.time.timeScale = 1.0;
      if (this.uiManager) {
        this.uiManager.showDeath({
          survivalTime: this.stats.survivalTime,
          level: this.xpSystem ? this.xpSystem.level : 1,
          destructionPct: this.cityGrid.getDestructionPercentage().toFixed(1),
          buildingsDestroyed: this.stats.buildingsDestroyed,
          humansKilled: this.stats.humansKilled,
          policeKilled: this.stats.policeKilled,
          carsDestroyed: this.stats.carsDestroyed,
          tanksDestroyed: this.stats.tanksDestroyed,
          soldiersKilled: this.stats.soldiersKilled,
          helicoptersDestroyed: this.stats.helicoptersDestroyed,
          dronesDestroyed: this.stats.dronesDestroyed,
          xp: this.stats.xp
        }, () => {
          this.respawnKaiju();
        });
      }
    });
  }

  /**
   * Main game update loop
   */
  update(time, delta) {
    const dt = delta / 1000;

    // 1. Hitstop handling (brief pause frame on skyscraper collapses)
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= delta;
      return; // Freeze update for hitstop duration
    }

    // 1b. Rogue-lite Card Selection Pause (physics and world freeze while cards are shown)
    if (this.isCardSelecting) {
      if (this.cardSystem) {
        this.cardSystem.update(dt);
      }
      this.updateHUD();
      return;
    }

    // 1c. Layer Inspector Tool Pause [U]
    if (this.uiManager && this.uiManager.isLayerInspectorOpen()) {
      return;
    }

    if (!this.isGameOver) {
      this.stats.survivalTime += dt;
    }

    // 1c. Update AlertSystem threat escalation (Siaga 1-5, meter decay, floor timer)
    if (this.alertSystem) {
      this.alertSystem.update(dt);
    }

    // 2. Update Kaiju physics & animation
    this.kaiju.update(time, delta);

    // Check if Kaiju died
    if (this.kaiju.hp <= 0 && !this.isGameOver) {
      this.onKaijuDeath();
    }

    // 3. Process Trample Damage Pulses on 4x4 px grid
    this.trampleTimer += delta;
    if (this.trampleTimer >= GAME_CONFIG.destruction.trampleTickInterval) {
      this.trampleTimer = 0;
      this.handleKaijuTrampleDamage();
    }

    // 4. Process Progressive Building Collapse Waves
    this.updateCollapseWaves(dt);

    // 4b. Update Navigation Grid & Flow Fields (Tahap 3A-2)
    // Flushes newly cleared rubble paths and recalculates BFS gradient vectors towards Kaiju
    const tNav0 = performance.now();
    if (this.navGrid) {
      this.navGrid.flushDirtyUpdates();
      this.navGrid.updateFlowField(this.kaiju.x, this.kaiju.y, dt);
    }
    const tNav = performance.now() - tNav0;

    // 5. Update Enemies & Threat Manager (Tahap 3B)
    const tEnemy0 = performance.now();
    if (this.enemyManager) {
      this.enemyManager.update(this.cameras.main, dt, this.kaiju, this.particleManager);
    }
    const tEnemy = performance.now() - tEnemy0;

    // 6. Update Ambient Crowd
    this.crowd.update(this.cameras.main, delta, this.kaiju);

    // 6b. Update Automatic Weapons (Tahap 4A)
    const tWeapon0 = performance.now();
    if (this.weaponSystem) {
      this.weaponSystem.update(dt);
    }
    const tWeapon = performance.now() - tWeapon0;

    // 6c. Update XP System & Crystal Magnet (Tahap 4A)
    if (this.xpSystem) {
      this.xpSystem.update(dt, this.kaiju, this.cameras.main);
    }

    // 6d. Update Card System & Passives (Tahap 4A)
    if (this.cardSystem) {
      this.cardSystem.update(dt);
    }

    // 6e. Update Districts & Rebuilding (Tahap 5A)
    if (this.districts) {
      const dChange = this.districts.checkKaijuPosition(this.kaiju.x, this.kaiju.y);
      if (dChange && dChange.changed && this.uiManager) {
        this.uiManager.showEventBanner('MEMASUKI WILAYAH', `${dChange.currentDistrict.name.toUpperCase()} · ${dChange.currentDistrict.subtitle.toUpperCase()}`, 2000);
      }
    }

    if (this.rebuildSystem) {
      this.rebuildSystem.update(dt, this.kaiju, this.enemyManager);
    }

    // 6f. Update SaveSystem debounced auto-save (Tahap 5A)
    if (this.saveSystem) {
      this.saveSystem.update(dt);
    }

    // 6g. Update Mech-Titan Boss (Tahap 5B-1)
    const tBoss0 = performance.now();
    if (this.bossManager) {
      this.bossManager.update(dt, this.kaiju);
    }
    const tBoss = performance.now() - tBoss0;

    // 6h. Update Special Events System (Tahap 5B-2)
    const tEvent0 = performance.now();
    if (this.eventSystem) {
      this.eventSystem.update(dt, this.kaiju);
    }
    const tEvent = performance.now() - tEvent0;

    // 7. Update Particle Manager
    const tParticle0 = performance.now();
    this.particleManager.update(dt);
    const tParticle = performance.now() - tParticle0;

    // 8. Update Chunk Renderer (progressive loading & dirty rect batches)
    const tChunk0 = performance.now();
    this.chunkRenderer.update(this.cameras.main);
    const tChunk = performance.now() - tChunk0;

    // 9. Update HUD Telemetry, Inventory, and XP Bar
    const alpha = 0.2;
    this.profiling.tEnemy = this.profiling.tEnemy * (1 - alpha) + tEnemy * alpha;
    this.profiling.tWeapon = this.profiling.tWeapon * (1 - alpha) + tWeapon * alpha;
    this.profiling.tParticle = this.profiling.tParticle * (1 - alpha) + tParticle * alpha;
    this.profiling.tChunk = this.profiling.tChunk * (1 - alpha) + tChunk * alpha;
    this.profiling.tNav = this.profiling.tNav * (1 - alpha) + tNav * alpha;
    this.profiling.tBoss = (this.profiling.tBoss || 0) * (1 - alpha) + tBoss * alpha;
    this.profiling.tEvent = (this.profiling.tEvent || 0) * (1 - alpha) + tEvent * alpha;

    const tUI0 = performance.now();
    this.updateHUD();
    const tUI = performance.now() - tUI0;
    this.profiling.tUI = this.profiling.tUI * (1 - alpha) + tUI * alpha;
  }

  /**
   * Evaluates Kaiju body footprint and sweeping tail segments against building cells.
   */
  handleKaijuTrampleDamage() {
    // Only apply trample damage when Kaiju is moving / walking through buildings
    if (!this.kaiju.isMoving && this.kaiju.currentSpeed < 4) return;

    const { bodyDamageBase, bodySpeedMultiplier, tailDamageMultiplier } = GAME_CONFIG.destruction;
    const collapseConfig = WORLD_CONFIG.building || WORLD_CONFIG.buildingDestruction || {};
    const bodyFoot = this.kaiju.getBodyFootprint();
    const tailFoots = this.kaiju.getTailFootprints();

    // Damage scales with speed and current Kaiju scale
    const baseDamage = (bodyDamageBase + this.kaiju.currentSpeed * bodySpeedMultiplier) * this.kaiju.currentScale;

    this.isolationChecksThisFrame = 0;
    let crushedDenseCells = 0;
    let hasSkyscraperTrampled = false;

    // 1. Process Body Footprint (Oriented Ellipse)
    const bodyCells = this.cityGrid.getCellsInEllipse(
      bodyFoot.cx,
      bodyFoot.cy,
      bodyFoot.rx,
      bodyFoot.ry,
      bodyFoot.angle
    );

    for (let i = 0; i < bodyCells.length; i++) {
      const cell = bodyCells[i];
      const res = this.cityGrid.damageCell(cell.col, cell.row, baseDamage);

      if (res && res.damaged) {
        if (res.destroyed) {
          crushedDenseCells++;
          if (res.building && res.building.heightLevel >= 8) {
            hasSkyscraperTrampled = true;
          }
          this.onCellDestroyed(cell, res.building, true);
        }
      }
    }

    // 2. Apply dynamic slowdown when crushing dense buildings
    if (crushedDenseCells > 0) {
      this.kaiju.applyResistance(crushedDenseCells * 0.025);
      // Subtle continuous trample shake (amplified for skyscrapers)
      let shakeIntensity = GAME_CONFIG.destruction.trampleShakeIntensity;
      if (hasSkyscraperTrampled) {
        shakeIntensity *= (collapseConfig.skyscraperShakeMultiplier || 1.5);
      }
      this.cameras.main.shake(
        GAME_CONFIG.destruction.trampleShakeDuration,
        shakeIntensity
      );
    }

    // 3. Process Sweeping Tail Segments
    for (let t = 0; t < tailFoots.length; t++) {
      const seg = tailFoots[t];
      const tailDamage = baseDamage * tailDamageMultiplier * (1.0 - t * 0.1);
      const tailCells = this.cityGrid.getCellsInCircle(seg.cx, seg.cy, seg.radius);

      for (let i = 0; i < tailCells.length; i++) {
        const cell = tailCells[i];
        const res = this.cityGrid.damageCell(cell.col, cell.row, tailDamage);

        if (res && res.destroyed) {
          if (res.building && res.building.heightLevel >= 8) {
            hasSkyscraperTrampled = true;
          }
          this.onCellDestroyed(cell, res.building, false);
        }
      }
    }

    // 4. Process Enemies Trampling (Tahap 3B: Ground threats crushed by feet/tail)
    if (this.enemyManager) {
      this.enemyManager.checkKaijuTrample(
        bodyFoot,
        tailFoots,
        this.particleManager,
        (eType, xpGained) => {
          this.stats.xp += xpGained;
          if (eType === ENEMY_TYPES.CITIZEN) {
            this.stats.humansKilled++;
            if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killCivilian);
          } else if (eType === ENEMY_TYPES.POLICE) {
            this.stats.policeKilled++;
            if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killPolice);
          } else if (eType === ENEMY_TYPES.POLICE_CAR) {
            this.stats.carsDestroyed++;
            if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killPolice);
          } else if (eType === ENEMY_TYPES.TANK) {
            this.stats.tanksDestroyed++;
            if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killTank);
          } else if (eType === ENEMY_TYPES.SOLDIER) {
            this.stats.soldiersKilled++;
            if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killSoldier);
          }
        }
      );
    }

    // 4b. Process Ambient Crowd Trampling (Humans squished, cars crushed)
    this.crowd.checkKaijuTrample(
      bodyFoot,
      tailFoots,
      this.particleManager,
      (hx, hy) => {
        this.stats.humansKilled++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerHuman;
        if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killCivilian);
        if (this.xpSystem) this.xpSystem.spawnCrystal(hx, hy, XP_CONFIG.drops.CITIZEN);
      },
      (cx, cy) => {
        this.stats.carsDestroyed++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerCar;
        if (this.alertSystem) this.alertSystem.addAlert(ALERT_CONFIG.gains.killPolice);
        if (this.xpSystem) this.xpSystem.spawnCrystal(cx, cy, XP_CONFIG.drops.POLICE_CAR);
      }
    );
  }

  /**
   * Dispatches cell destruction logic according to active collapseMode ('none' | 'local' | 'full')
   * In 'local' mode:
   * - Immediate neighbor cells take minor crack damage and display fracture textures.
   * - Small isolated cell fragments (<= 6 cells) collapse as small rubble via shallow bounded BFS.
   * - NavGrid receives dirty updates so flattened buildings dynamically become new walkable shortcuts!
   * - Skyscrapers generate higher dust/debris without total collapse.
   * - Building is only marked destroyed when all alive cells reach 0.
   */
  onCellDestroyed(cell, building, isBodyTrample = true) {
    if (!building) return;

    const collapseConfig = WORLD_CONFIG.building || WORLD_CONFIG.buildingDestruction || {};
    const collapseMode = collapseConfig.collapseMode || 'local';
    const isSkyscraper = building.heightLevel >= 8;

    this.stats.xp += GAME_CONFIG.destruction.xpPerCell;
    if (this.xpSystem) {
      this.xpSystem.addDirectXp(XP_CONFIG.directXp.cellDestroyed);
    }
    if (this.alertSystem) {
      this.alertSystem.addAlert(ALERT_CONFIG.gains.cellDestroyed);
    }

    // 1. Mark rubble on chunk canvas & notify NavGrid of newly walkable rubble
    this.chunkRenderer.markCellAsRubble(cell.worldX, cell.worldY, building.baseColor, isBodyTrample);
    if (this.navGrid) {
      this.navGrid.markDirtyCell(cell.worldX, cell.worldY);
    }

    // Phase 5A: Districts Destruction Milestone & Bonus
    if (this.districts) {
      const dRes = this.districts.onCellDestroyed(cell.worldX, cell.worldY, building);
      if (dRes && dRes.isMilestoneTriggered) {
        if (this.uiManager) {
          this.uiManager.showEventBanner('DISTRIK RATA!', `${dRes.district.name.toUpperCase()} HANCUR 80%! HADIAH KARTU BONUS DIBERIKAN!`, 3000);
        }
        if (this.alertSystem) {
          this.alertSystem.addAlert(DISTRICTS_CONFIG.milestones.collapseRewardAlertGain || 15);
        }
        if (this.cardSystem) {
          this.cardSystem.queueBonusCardScreen(`DISTRIK ${dRes.district.name.toUpperCase()} RATA`);
        }
      }
    }

    // Phase 5A: Queue cell in RebuildSystem
    if (this.rebuildSystem) {
      this.rebuildSystem.recordDestroyedCell(cell.worldX, cell.worldY, cell, building);
    }

    // Phase 5A: Mark SaveSystem dirty
    if (this.saveSystem) {
      this.saveSystem.markDirty();
    }

    // 2. Debris & dust emission (scaled for skyscrapers)
    const dustMult = isSkyscraper ? (collapseConfig.skyscraperDustMultiplier || 1.8) : 1.0;
    const debrisCount = Math.round((isBodyTrample ? 2 : 2) * dustMult);
    this.particleManager.emitDebris(cell.worldX, cell.worldY, building.baseColor, debrisCount, isBodyTrample ? 50 : 40);

    if (isSkyscraper) {
      this.particleManager.emitDust(cell.worldX, cell.worldY, Math.round(1 * dustMult), 1.3);
    }

    // 3. Mode branching
    if (collapseMode === 'full') {
      this.checkBuildingCollapse(building, cell);
      return;
    }

    if (collapseMode === 'local') {
      // A. Neighbor crack propagation (small damage, hairline crack, without dying)
      const crackedNeighbors = this.cityGrid.applyCrackDamageToNeighbors(
        cell.col,
        cell.row,
        collapseConfig.crackDamage || 0.35,
        collapseConfig.crackRadius || 1
      );
      for (let k = 0; k < crackedNeighbors.length; k++) {
        const cn = crackedNeighbors[k];
        if (cn.newlyCracked) {
          this.chunkRenderer.markCellAsCracked(cn.worldX, cn.worldY);
        }
      }

      // B. Isolated island check for small disconnected fragments (<= 6 cells)
      const maxChecks = collapseConfig.maxIsolationChecksPerFrame || 8;
      if (this.isolationChecksThisFrame < maxChecks) {
        const dirs = [
          { dc: 1, dr: 0 },
          { dc: -1, dr: 0 },
          { dc: 0, dr: 1 },
          { dc: 0, dr: -1 }
        ];

        for (let d = 0; d < 4; d++) {
          if (this.isolationChecksThisFrame >= maxChecks) break;

          const nCol = cell.col + dirs[d].dc;
          const nRow = cell.row + dirs[d].dr;
          this.isolationChecksThisFrame++;

          const island = this.cityGrid.findSmallIsolatedIsland(
            nCol,
            nRow,
            building.id,
            collapseConfig.maxIsolatedIslandSize || 6
          );

          if (island && island.length > 0) {
            for (let m = 0; m < island.length; m++) {
              const ic = island[m];
              this.cityGrid.hp[ic.idx] = 0;
              this.cityGrid.types[ic.idx] = CELL_TYPES.RUBBLE;
              this.cityGrid.totalDestroyedCells++;
              building.aliveCells = Math.max(0, building.aliveCells - 1);

              this.chunkRenderer.markCellAsRubble(ic.worldX, ic.worldY, building.baseColor, false);
              if (this.navGrid) {
                this.navGrid.markDirtyCell(ic.worldX, ic.worldY);
              }
              this.particleManager.emitDebris(ic.worldX, ic.worldY, building.baseColor, 2, 35);
              this.particleManager.emitDust(ic.worldX, ic.worldY, 1, 0.7);
              this.stats.xp += GAME_CONFIG.destruction.xpPerCell;
              if (this.xpSystem) {
                this.xpSystem.addDirectXp(XP_CONFIG.directXp.cellDestroyed);
              }
              if (this.alertSystem) {
                this.alertSystem.addAlert(ALERT_CONFIG.gains.cellDestroyed);
              }

              // Phase 5A: Districts & Rebuild notification for isolated fragments
              if (this.districts) {
                const dRes = this.districts.onCellDestroyed(ic.worldX, ic.worldY, building);
                if (dRes && dRes.isMilestoneTriggered) {
                  if (this.uiManager) {
                    this.uiManager.showEventBanner('DISTRIK RATA!', `${dRes.district.name.toUpperCase()} HANCUR 80%! HADIAH KARTU BONUS DIBERIKAN!`, 3000);
                  }
                  if (this.alertSystem) {
                    this.alertSystem.addAlert(DISTRICTS_CONFIG.milestones.collapseRewardAlertGain || 15);
                  }
                  if (this.cardSystem) {
                    this.cardSystem.queueBonusCardScreen(`DISTRIK ${dRes.district.name.toUpperCase()} RATA`);
                  }
                }
              }
              if (this.rebuildSystem) {
                this.rebuildSystem.recordDestroyedCell(ic.worldX, ic.worldY, ic, building);
              }
              if (this.saveSystem) {
                this.saveSystem.markDirty();
              }
            }
          }
        }
      }
    }

    // 4. Final building collapse: counter & bonus XP triggers ONLY when aliveCells reaches 0!
    if (building.aliveCells === 0 && !building.isFullyDestroyed) {
      building.isFullyDestroyed = true;
      this.stats.buildingsDestroyed++;
      this.stats.xp += (collapseConfig.finalCollapseBonusXp || 150);
      if (this.cardSystem) {
        this.cardSystem.handleBuildingDestroyed();
      }
      if (this.xpSystem) {
        this.xpSystem.addDirectXp(XP_CONFIG.directXp.buildingCollapse);
      }
      if (this.alertSystem) {
        this.alertSystem.addAlert(ALERT_CONFIG.gains.buildingDestroyed);
      }

      const bCenterX = building.x + building.width / 2;
      const bCenterY = building.y + building.height / 2;
      this.particleManager.emitFinalBuildingCollapse(bCenterX, bCenterY, building.baseColor, building.heightLevel);
      this.cameras.main.shake(120, 0.0035);
    }
  }

  /**
   * Checks if a building's integrity has been breached (used only when collapseMode === 'full')
   */
  checkBuildingCollapse(building, hitCell) {
    const collapseConfig = WORLD_CONFIG.building || WORLD_CONFIG.buildingDestruction || {};
    if (collapseConfig.collapseMode !== 'full') return;
    if (!building || building.isCollapsed) return;

    const threshold = WORLD_CONFIG.collapseThreshold || 0.45;
    const ratioDestroyed = (building.totalCells - building.aliveCells) / building.totalCells;

    const isCenterHit = building.centerCell &&
      hitCell.col === building.centerCell.col &&
      hitCell.row === building.centerCell.row;

    if (ratioDestroyed >= threshold || isCenterHit) {
      this.triggerBuildingCollapse(building, hitCell);
    }
  }

  /**
   * Initiates the building collapse sequence (wave crumbling, shockwaves, falling debris splash)
   */
  triggerBuildingCollapse(building, epicenterCell) {
    building.isCollapsed = true;
    this.stats.buildingsDestroyed++;
    this.stats.xp += GAME_CONFIG.destruction.xpPerBuildingCollapse;
    if (this.cardSystem) {
      this.cardSystem.handleBuildingDestroyed();
    }

    const heightLevel = building.heightLevel || 3;
    const bCenterX = building.x + building.width / 2;
    const bCenterY = building.y + building.height / 2;

    // 1. Screen Shake proportional to building height
    const shakeMult = Math.min(2.5, heightLevel / 3.5);
    this.cameras.main.shake(
      GAME_CONFIG.destruction.collapseShakeDuration,
      GAME_CONFIG.destruction.collapseShakeIntensityBase * shakeMult
    );

    // 2. Skyscraper effects (Hitstop, fire flash, road cracks)
    if (heightLevel >= 8) {
      // Brief hitstop freeze frame
      this.hitstopTimer = GAME_CONFIG.destruction.hitstopDurationMs;

      // Additive light burst / orange flash
      this.particleManager.emitCollapseFlash(bCenterX, bCenterY, heightLevel * 3.5);

      // Fracture cracks on surrounding roads
      this.chunkRenderer.drawRoadCracks(bCenterX, bCenterY, building.width * 0.65);

      // Shockwave damage to nearby smaller buildings
      const shockwaveRadius = heightLevel * 3.2;
      const nearbyBuildings = this.cityGrid.getBuildingsInRect({
        x: bCenterX - shockwaveRadius,
        y: bCenterY - shockwaveRadius,
        width: shockwaveRadius * 2,
        height: shockwaveRadius * 2
      });

      nearbyBuildings.forEach(nb => {
        if (nb.id !== building.id && !nb.isCollapsed && nb.heightLevel < heightLevel) {
          // Damage perimeter cells
          const sampleCells = nb.cells.slice(0, Math.min(6, nb.cells.length));
          sampleCells.forEach(sc => {
            const res = this.cityGrid.damageCell(sc.col, sc.row, 1.5);
            if (res && res.destroyed) {
              this.chunkRenderer.markCellAsRubble(sc.col * 4, sc.row * 4, nb.baseColor, true);
            }
          });
        }
      });
    }

    // 3. Falling Debris Outward Splash (Crushes cars & humans within radius)
    const splashRadius = heightLevel * (WORLD_CONFIG.debrisSpreadRadiusFactor || 1.3) * 2;
    this.crowd.destroyEntitiesInRadius(
      bCenterX,
      bCenterY,
      splashRadius,
      this.particleManager,
      () => {
        this.stats.humansKilled++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerHuman;
      },
      () => {
        this.stats.carsDestroyed++;
        this.stats.xp += GAME_CONFIG.destruction.xpPerCar;
      }
    );

    // 4. Create Progressive Outward Wave Crumble Rings (~0.5s animation)
    const epiX = epicenterCell ? epicenterCell.col * 4 : bCenterX;
    const epiY = epicenterCell ? epicenterCell.row * 4 : bCenterY;

    // Group remaining living cells by distance to epicenter into wave rings
    const remainingCells = building.cells.filter(c => this.cityGrid.hp[c.idx] > 0);
    const wavesMap = new Map(); // ringIndex -> [cells]

    remainingCells.forEach(c => {
      const cellWorld = this.cityGrid.gridToWorld(c.col, c.row);
      const dist = Math.hypot(cellWorld.x - epiX, cellWorld.y - epiY);
      const ring = Math.floor(dist / 8); // 8px per wave ring

      if (!wavesMap.has(ring)) wavesMap.set(ring, []);
      wavesMap.get(ring).push({ ...c, worldX: cellWorld.x, worldY: cellWorld.y });
    });

    const sortedRings = Array.from(wavesMap.keys()).sort((a, b) => a - b);
    const waveDelayStep = 0.08; // Seconds per ring step

    sortedRings.forEach((ring, idx) => {
      this.activeCollapses.push({
        timer: idx * waveDelayStep,
        cells: wavesMap.get(ring),
        building,
        heightLevel
      });
    });
  }

  /**
   * Updates progressive collapse wave timers and triggers cell shattering
   */
  updateCollapseWaves(dt) {
    for (let i = this.activeCollapses.length - 1; i >= 0; i--) {
      const item = this.activeCollapses[i];
      item.timer -= dt;

      if (item.timer <= 0) {
        // Shatter cells in this wave ring!
        item.cells.forEach(c => {
          this.cityGrid.hp[c.idx] = 0;
          this.cityGrid.types[c.idx] = CELL_TYPES.RUBBLE;
          this.cityGrid.totalDestroyedCells++;

          this.chunkRenderer.markCellAsRubble(c.worldX, c.worldY, item.building.baseColor, true);

          // Billowing dust clouds & debris proportional to building height
          this.particleManager.emitDebris(c.worldX, c.worldY, item.building.baseColor, 3, 60);
          this.particleManager.emitDust(c.worldX, c.worldY, 2, Math.min(2.2, item.heightLevel * 0.25));
        });

        this.activeCollapses.splice(i, 1);
      }
    }
  }

  shutdown() {
    if (this.uiManager) {
      this.uiManager.destroy();
    }
  }
}
