import { DISTRICTS_CONFIG } from '../config/districts.js';
import { WORLD_CONFIG } from '../config/world.js';

/**
 * Districts.js - Tahap 5A
 * Manages the 6 persistent city districts:
 * - Geometric district zoning & O(1) coordinate lookups
 * - Per-district building cell destruction tracking with zero per-frame recalculation
 * - District transition detection & HTML banner event triggers
 * - 80% district destruction milestone rewards (rare bonus card screen & Siaga boost)
 * - Spawn weight multiplier lookup for EnemyManager
 */
export class Districts {
  /**
   * @param {Object} cityData - Output from CityGenerator
   * @param {number} worldWidth
   * @param {number} worldHeight
   */
  constructor(cityData = null, worldWidth = WORLD_CONFIG.worldWidth, worldHeight = WORLD_CONFIG.worldHeight) {
    this.cityData = cityData;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.centerX = worldWidth / 2;
    this.centerY = worldHeight / 2;

    this.currentDistrictId = 'downtown';
    this.districtMap = new Map();

    // Initialize district state records
    DISTRICTS_CONFIG.districts.forEach(def => {
      this.districtMap.set(def.id, {
        id: def.id,
        name: def.name,
        subtitle: def.subtitle,
        color: def.color,
        hexColor: def.hexColor,
        minimapColor: def.minimapColor,
        spawnWeightMultipliers: def.spawnWeightMultipliers,
        totalInitialBuildingCells: 0,
        destroyedBuildingCells: 0,
        is80PercentDestroyed: false,
        bonusRewardClaimedInRun: false // Resets on Kaiju respawn / RunState reset
      });
    });
  }

  /**
   * Determines the district ID at given world coordinates.
   * Based on CityGenerator zonation:
   * - Canal & Waterfront Park
   * - Downtown (Metropolis Inti)
   * - Southeast Industrial Sector
   * - Commercial Ring
   * - Residential Ring
   * - Suburbs Outer Ring
   * @param {number} worldX 
   * @param {number} worldY 
   * @returns {string} districtId
   */
  getDistrictIdAt(worldX, worldY) {
    // 1. Check Canal Waterfront Park
    if (this.cityData && this.cityData.canal && this.cityData.canal.points) {
      if (this.isNearCanal(worldX, worldY, 40)) {
        return 'canal_park';
      }
    }

    const distToCenter = Math.hypot(worldX - this.centerX, worldY - this.centerY);

    // 2. Downtown (Metropolis Inti)
    if (distToCenter < WORLD_CONFIG.downtownRadius) {
      return 'downtown';
    }

    // 3. Southeast Industrial Sector
    if (worldX > 2100 && worldY > 2000) {
      return 'industrial';
    }

    // 4. Commercial District
    if (distToCenter < WORLD_CONFIG.commercialRadius) {
      return 'commercial';
    }

    // 5. Residential District
    if (distToCenter < WORLD_CONFIG.residentialRadius) {
      return 'residential';
    }

    // 6. Suburbs (Outer Rim)
    return 'suburbs';
  }

  /**
   * Checks if a point is near the canal
   */
  isNearCanal(worldX, worldY, margin = 40) {
    if (!this.cityData || !this.cityData.canal || !this.cityData.canal.points) return false;
    const pts = this.cityData.canal.points;
    const total = pts.length;
    const stepY = this.worldHeight / (total - 1);
    const idx = Math.min(total - 2, Math.max(0, Math.floor(worldY / stepY)));
    const frac = (worldY - idx * stepY) / stepY;
    const p1 = pts[idx];
    const p2 = pts[idx + 1];
    const canalX = p1.x + (p2.x - p1.x) * frac;
    const halfW = (this.cityData.canal.width + this.cityData.canal.bankWidth * 2) / 2 + margin;
    return Math.abs(worldX - canalX) <= halfW;
  }

  /**
   * Registers a building and associates it with its district.
   * Increments the district's initial cell counter.
   * @param {Object} building 
   */
  registerBuilding(building) {
    const bCenterX = building.x + building.width / 2;
    const bCenterY = building.y + building.height / 2;
    const districtId = this.getDistrictIdAt(bCenterX, bCenterY);
    building.districtId = districtId;

    const district = this.districtMap.get(districtId);
    if (district) {
      district.totalInitialBuildingCells += (building.totalCells || 0);
    }
  }

  /**
   * Called when a building cell is destroyed.
   * Updates district destroyed counter and evaluates 80% collapse milestone.
   * @param {number} worldX 
   * @param {number} worldY 
   * @param {Object|null} building 
   * @returns {{ district: Object, isMilestoneTriggered: boolean } | null}
   */
  onCellDestroyed(worldX, worldY, building = null) {
    const districtId = (building && building.districtId) ? building.districtId : this.getDistrictIdAt(worldX, worldY);
    const district = this.districtMap.get(districtId);
    if (!district) return null;

    district.destroyedBuildingCells++;

    // Check 80% destruction milestone
    const threshold = DISTRICTS_CONFIG.milestones.collapseRewardThreshold || 0.80;
    const total = district.totalInitialBuildingCells;
    const currentRatio = total > 0 ? (district.destroyedBuildingCells / total) : 0;

    let isMilestoneTriggered = false;
    if (currentRatio >= threshold && !district.is80PercentDestroyed) {
      district.is80PercentDestroyed = true;
      if (!district.bonusRewardClaimedInRun) {
        district.bonusRewardClaimedInRun = true;
        isMilestoneTriggered = true;
      }
    }

    return {
      district,
      isMilestoneTriggered
    };
  }

  /**
   * Called when a building cell is restored / rebuilt by RebuildSystem.
   * Decrements district destroyed counter.
   * @param {number} worldX 
   * @param {number} worldY 
   * @param {string} districtId 
   */
  onCellRebuilt(worldX, worldY, districtId = null) {
    const dId = districtId || this.getDistrictIdAt(worldX, worldY);
    const district = this.districtMap.get(dId);
    if (!district) return;

    district.destroyedBuildingCells = Math.max(0, district.destroyedBuildingCells - 1);
    
    // If rebuilt below 75%, allow milestone to re-trigger in future runs
    const total = district.totalInitialBuildingCells;
    if (total > 0 && (district.destroyedBuildingCells / total) < 0.75) {
      district.is80PercentDestroyed = false;
    }
  }

  /**
   * Checks if Kaiju has entered a new district.
   * @param {number} kaijuX 
   * @param {number} kaijuY 
   * @returns {{ changed: boolean, previousDistrict: Object, currentDistrict: Object } | null}
   */
  checkKaijuPosition(kaijuX, kaijuY) {
    const newDistrictId = this.getDistrictIdAt(kaijuX, kaijuY);
    if (newDistrictId !== this.currentDistrictId) {
      const prevDistrict = this.districtMap.get(this.currentDistrictId);
      this.currentDistrictId = newDistrictId;
      const curDistrict = this.districtMap.get(newDistrictId);
      return {
        changed: true,
        previousDistrict: prevDistrict,
        currentDistrict: curDistrict
      };
    }
    return null;
  }

  /**
   * Gets current district record
   */
  getCurrentDistrict() {
    return this.districtMap.get(this.currentDistrictId) || this.districtMap.get('downtown');
  }

  /**
   * Gets district destruction percentage (0.0 - 100.0)
   * @param {string} districtId 
   * @returns {number}
   */
  getDestructionPercentage(districtId) {
    const d = this.districtMap.get(districtId);
    if (!d || d.totalInitialBuildingCells === 0) return 0;
    return Math.min(100, (d.destroyedBuildingCells / d.totalInitialBuildingCells) * 100);
  }

  /**
   * Returns current spawn weight multipliers for EnemyManager
   * @returns {Object} { CITIZEN: number, POLICE: number, ... }
   */
  getCurrentSpawnWeightMultipliers() {
    const current = this.getCurrentDistrict();
    return current ? current.spawnWeightMultipliers : {};
  }

  /**
   * Returns snapshot of all districts for save/load, HUD, and minimap
   */
  getAllDistrictsState() {
    const results = [];
    this.districtMap.forEach(d => {
      const total = d.totalInitialBuildingCells;
      const destroyed = d.destroyedBuildingCells;
      const pct = total > 0 ? (destroyed / total) * 100 : 0;
      results.push({
        id: d.id,
        name: d.name,
        subtitle: d.subtitle,
        color: d.color,
        hexColor: d.hexColor,
        minimapColor: d.minimapColor,
        totalInitialBuildingCells: total,
        destroyedBuildingCells: destroyed,
        destructionPct: pct,
        is80PercentDestroyed: d.is80PercentDestroyed,
        bonusRewardClaimedInRun: d.bonusRewardClaimedInRun
      });
    });
    return results;
  }

  /**
   * Restores district destruction counters from saved WorldState
   * @param {Object} savedDistrictsData 
   */
  loadFromSavedState(savedDistrictsData) {
    if (!savedDistrictsData) return;
    Object.keys(savedDistrictsData).forEach(id => {
      const target = this.districtMap.get(id);
      const saved = savedDistrictsData[id];
      if (target && saved) {
        target.destroyedBuildingCells = saved.destroyedBuildingCells || 0;
        target.is80PercentDestroyed = !!saved.is80PercentDestroyed;
      }
    });
  }

  /**
   * RunState reset: Called when Kaiju dies and respawns.
   * Resets per-run bonus card reward flags so leveled districts can award bonuses in the next life!
   */
  resetRunState() {
    this.districtMap.forEach(d => {
      d.bonusRewardClaimedInRun = false;
    });
  }

  /**
   * Hard world reset: Clears all destruction counters
   */
  resetAll() {
    this.districtMap.forEach(d => {
      d.destroyedBuildingCells = 0;
      d.is80PercentDestroyed = false;
      d.bonusRewardClaimedInRun = false;
    });
    this.currentDistrictId = 'downtown';
  }
}
