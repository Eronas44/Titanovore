/**
 * Boss Configuration - Tahap 5B-1: Mech-Titan
 * Defines spawn triggers, scaling multipliers, phase thresholds,
 * telegraph timings, attack attributes, and rewards.
 */
export const BOSS_CONFIG = {
  // Spawning & Threat Triggers
  triggerSiagaLevel: 3,
  subsequentTriggerSiagaLevel: 4,
  subsequentCooldownSeconds: 300, // 5 minutes at Siaga 3+ before next boss spawns
  warningDelaySeconds: 6.0, // Delay from siren warning to physical entry
  invulnerableEntryDuration: 2.0, // Entrance animation invulnerability window

  // Physical Stats
  size: 56, // px (width & height top-down)
  hitRadius: 28, // Collision & weapon hit detection radius
  baseHp: 1200,
  hpScalePerBoss: 1.5, // +50% HP per subsequent boss
  damageScalePerBoss: 1.25, // +25% damage per subsequent boss
  baseSpeed: 62,
  enrageSpeedMultiplier: 1.45,
  ccResistance: 0.85, // 85% resistance to knockback and slows
  buildingCrushInterval: 0.12, // Seconds between footprint building destruction checks

  // Phase HP Thresholds
  phases: {
    phase1: { minHpRatio: 0.66, name: 'FASE 1 · STANDAR' },
    phase2: { minHpRatio: 0.33, name: 'FASE 2 · ESCALATION' },
    phase3: { minHpRatio: 0.0, name: 'FASE 3 · MODE MARAH' }
  },

  // Attack Window & Recovery Intervals (Seconds)
  attackCooldownMin: 1.1,
  attackCooldownMax: 1.8,
  enrageCooldownMin: 0.7,
  enrageCooldownMax: 1.1,
  enrageDoubleAttackChance: 0.35,

  // Attack 1: Stomp (Hentakan Gempa)
  stomp: {
    telegraphDuration: 0.9,
    radius: 125,
    damage: 24,
    buildingDamage: 5.0,
    shockwaveSpeed: 380,
    shockwaveColor: 0xef4444
  },

  // Attack 2: Cannon Salvo (Salvo Meriam Berat)
  cannonSalvo: {
    telegraphDuration: 0.85,
    shotCountPhase1: 3,
    shotCountPhase2: 4,
    shotInterval: 0.18,
    bulletSpeed: 440,
    damage: 16,
    blastRadius: 22,
    buildingDamage: 3.5,
    bulletColor: 0xf97316
  },

  // Attack 3: Missile Rain (Hujan Rudal Lengkung - Phase 2+)
  missileRain: {
    telegraphDuration: 1.15,
    missileCount: 7, // 6-8 missiles
    spreadRadius: 165,
    missileSpeed: 320,
    damage: 18,
    blastRadius: 26,
    buildingDamage: 4.5,
    missileColor: 0xf43f5e
  },

  // Attack 4: Call Drones (Panggil Drone Kamikaze - Phase 2+)
  callDrones: {
    telegraphDuration: 0.8,
    droneCountMin: 4,
    droneCountMax: 6,
    droneSpawnRadius: 75
  },

  // Attack 5: Sweeping Laser (Laser Pemotong 120 Derajat - Phase 3)
  sweepingLaser: {
    telegraphDuration: 1.0,
    sweepDuration: 1.25,
    arcDegrees: 120,
    range: 220,
    dps: 52,
    buildingDamagePerSec: 18,
    laserColor: 0xff1e42,
    coreColor: 0xffffff
  },

  // Visuals & Camera
  cameraZoomOutFactor: 0.85, // Zoom out factor during boss encounter
  cameraZoomDurationMs: 800,
  deathSlowMoDurationMs: 1000,
  deathExplosionCount: 12,
  deathGrandExplosionRadius: 80,

  // Rewards
  rewards: {
    xpTotal: 850,
    scoreMultiplierGain: 1.5,
    scoreBonus: 5000,
    bannerTitle: 'MECH-TITAN TUMBANG',
    uniqueCardId: 'inti_reaktor'
  },

  // Performance Limits
  maxProjectiles: 40
};
