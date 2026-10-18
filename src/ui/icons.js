/**
 * SVG Icons - Tahap 4B-1
 * Crisp, modern neon-line SVG icons for Kaiju weapons, passives, mutation badges, and HUD stats.
 * Uses 24x24 viewBox with vector paths, scales cleanly to any resolution without blur.
 */
export const ICONS = {
  // --- EXISTING WEAPONS ---
  // Weapon: Claw (Cakar)
  claw: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 21C6 14 8 8 11 3" />
      <path d="M10 21C11.5 13 13.5 7 17 4" />
      <path d="M15 21C16.5 15 18 10 21 7" />
      <path d="M4 18c2-3 4-4 7-4" opacity="0.6" />
    </svg>
  `,

  // Weapon: Back Cannon (Meriam Punggung)
  back_cannon: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="6" width="6" height="12" rx="1.5" />
      <path d="M8 8h9a1 1 0 0 1 1 1v2H8" />
      <path d="M8 13h9a1 1 0 0 1 1 1v2H8" />
      <line x1="18" y1="9" x2="22" y2="9" stroke-width="2.5" />
      <line x1="18" y1="15" x2="22" y2="15" stroke-width="2.5" />
      <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    </svg>
  `,

  // Weapon: Electric Skin (Kulit Listrik)
  electric_skin: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  `,

  // --- NEW WEAPONS (TAHAP 4B-1) ---
  // Weapon: Spiked Tail (Ekor Berduri)
  spiked_tail: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 12c4 0 7-3 10-3 3 0 6 3 7 7" />
      <path d="M11 6l2-4 2 4" />
      <path d="M16 8l3-3 1 4" />
      <path d="M19 13l4 1-2 3" />
      <path d="M18 18l3 3-4-1" />
      <circle cx="5" cy="12" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  `,

  // Weapon: Body Spikes (Duri Tubuh)
  body_spikes: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2L9 8h6L12 2z" />
      <path d="M6 6L4 12h5L6 6z" />
      <path d="M18 6l2 6h-5l3-6z" />
      <path d="M3 15l-1 5 6-2-5-3z" />
      <path d="M21 15l1 5-6-2 5-3z" />
      <circle cx="12" cy="14" r="3" fill="currentColor" opacity="0.3" />
    </svg>
  `,

  // Weapon: Fire Breath (Napas Api)
  fire_breath: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
      <path d="M12 17a2 2 0 0 0 2-2c0-1-1-1.5-1.5-2-.5.5-.5 1-.5 2v2z" fill="currentColor" opacity="0.6" />
    </svg>
  `,

  // Weapon: Back Rockets (Roket Punggung)
  back_rockets: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14l4-4 4 4-4 4-4-4z" />
      <path d="M12 6l4-4 4 4-4 4-4-4z" />
      <path d="M3 19l2-2" stroke-width="2.5" />
      <path d="M11 11l2-2" stroke-width="2.5" />
      <path d="M2 22l3-1-2-2-1 3z" fill="currentColor" />
      <path d="M10 14l3-1-2-2-1 3z" fill="currentColor" />
    </svg>
  `,

  // Weapon: Quake Stomp (Injakan Getar)
  quake_stomp: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <circle cx="12" cy="12" r="7" stroke-dasharray="3 2" />
      <circle cx="12" cy="12" r="10" stroke-dasharray="4 3" opacity="0.6" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  `,

  // Weapon: Laser Eyes (Mata Laser)
  laser_eyes: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="7" cy="12" r="3" fill="currentColor" />
      <circle cx="17" cy="12" r="3" fill="currentColor" />
      <line x1="10" y1="12" x2="14" y2="12" opacity="0.4" />
      <path d="M2 12h2M20 12h2" stroke-width="2.5" />
      <path d="M7 6v2M17 6v2M7 16v2M17 16v2" />
    </svg>
  `,

  // --- EXISTING PASSIVES ---
  // Passive: Iron Skin (Kulit Baja)
  iron_skin: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 8v8" opacity="0.7" />
      <path d="M8 12h8" opacity="0.7" />
    </svg>
  `,

  // Passive: Regeneration (Regenerasi)
  regeneration: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
      <line x1="12" y1="8" x2="12" y2="14" />
      <line x1="9" y1="11" x2="15" y2="11" />
    </svg>
  `,

  // Passive: Magnet XP
  magnet: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="m6 15-3-3 6.7-6.7a4.95 4.95 0 0 1 7 0l2 2a4.95 4.95 0 0 1 0 7L12 21l-3-3" />
      <path d="m9 6 3 3" />
      <path d="m15 12 3 3" />
      <path d="m3 12 3 3" opacity="0.7" />
    </svg>
  `,

  // Passive: Swift Stride (Kaki Perkasa)
  swift_stride: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 16v-2.38C4 11.5 6.5 9 9.5 9h5c3 0 5.5 2.5 5.5 5.62V16" />
      <path d="M16 16v4" />
      <path d="M8 16v4" />
      <path d="M4 10l5-6 4 3 5-3" />
    </svg>
  `,

  // Passive: Colossus (Tubuh Raksasa)
  colossus: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="5" r="3" />
      <path d="M7 21v-4a5 5 0 0 1 10 0v4" />
      <line x1="4" y1="11" x2="20" y2="11" stroke-width="2.5" />
    </svg>
  `,

  // Passive: Carnage (Pembunuh)
  carnage: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5" />
      <path d="M13 19l6-6" />
      <path d="M16 16l4 4" />
      <path d="M19 21l2-2" />
    </svg>
  `,

  // Passive: Rapid Fire (Cepat Tembak)
  rapid_fire: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  `,

  // Passive: Demolisher (Penghancur Kota)
  demolisher: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="10" width="18" height="11" rx="2" />
      <path d="M7 10V5a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v5" />
      <line x1="12" y1="14" x2="12" y2="17" />
    </svg>
  `,

  // Passive: Thorn Shield (Sisik Duri)
  thorn_shield: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="M12 6l2 4-4 2 4 2-2 4" />
    </svg>
  `,

  // --- NEW PASSIVES (TAHAP 4B-1) ---
  // Passive: Vampirism (Regenerasi Agresif)
  vampirism: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      <path d="M10 8l2 3 2-3" fill="currentColor" />
    </svg>
  `,

  // Passive: Blood Rage (Haus Darah)
  blood_rage: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2c-4 4-8 8.5-8 13a8 8 0 0 0 16 0c0-4.5-4-9-8-13z" />
      <path d="M12 9v6" stroke-width="2.5" />
      <path d="M9 14l3-3 3 3" />
    </svg>
  `,

  // Passive: Deflector (Reflektor Peluru)
  deflector: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 6l-4 4 4 4" />
      <path d="M8 10h10" />
      <path d="M18 14l4-4-4-4" opacity="0.6" />
    </svg>
  `,

  // Passive: Energy Shield (Perisai Energi)
  energy_shield: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" />
      <circle cx="12" cy="12" r="4" fill="currentColor" opacity="0.4" />
    </svg>
  `,

  // Passive: Scavenger (Penjarah Bangkai)
  scavenger: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 3h12l3 6-9 12L3 9l3-6z" />
      <path d="M3 9h18" />
      <path d="M10 3l2 6-2 12" />
      <path d="M14 3l-2 6 2 12" />
    </svg>
  `,

  // Passive: Extended Reach (Jangkauan Luas)
  extended_reach: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M3 12h3M18 12h3M12 3v3M12 18v3" stroke-width="2" />
      <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" opacity="0.6" />
    </svg>
  `,

  // Passive: City Sprinter (Pelari Kota)
  city_sprinter: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M13 4v6l4-2-4 12V14l-4 2 4-12z" fill="currentColor" opacity="0.3" />
      <path d="M4 14l3-3 4 4 6-6 3 3" />
    </svg>
  `,

  // Mutation Badge Icon (DNA Double Helix)
  dna: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M2 15c6.667-6 13.333 0 20-6" />
      <path d="M9 22c1.798-1.998 2.518-3.995 2.807-5.993" />
      <path d="M15 2c-1.798 1.998-2.518 3.995-2.807 5.993" />
      <path d="M17 6l-2.5-2.5" />
      <path d="M14 8l-1-1" />
      <path d="M7 18l2.5 2.5" />
      <path d="M3.5 14.5l.5.5" />
      <path d="M20 9.5l.5.5" />
    </svg>
  `,

  // --- HUD / STAT ICONS ---
  clock: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  `,

  skull: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 22v-3h6v3" />
      <path d="M19 12a7 7 0 1 0-14 0c0 3 2 5 3 6h8c1-1 3-3 3-6z" />
      <circle cx="9" cy="12" r="1.5" fill="currentColor" />
      <circle cx="15" cy="12" r="1.5" fill="currentColor" />
    </svg>
  `,

  city: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="7" width="6" height="14" rx="1" />
      <rect x="9" y="3" width="6" height="18" rx="1" />
      <rect x="16" y="11" width="6" height="10" rx="1" />
    </svg>
  `,

  siren: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 12a5 5 0 0 1 10 0v5H7v-5z" />
      <path d="M5 21h14" />
      <path d="M12 3v4" />
    </svg>
  `,

  reroll: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M21.5 2v6h-6" />
      <path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67" />
    </svg>
  `,

  skip: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" />
      <line x1="19" y1="5" x2="19" y2="19" stroke-width="2.5" />
    </svg>
  `
};

/**
 * Returns SVG string by key with smart fallbacks
 * @param {string} key 
 * @returns {string}
 */
export function getIconSvg(key) {
  if (!key) return ICONS.claw;
  const normalized = key.toLowerCase().replace(/^(icon_|card_)/, '');

  if (ICONS[normalized]) return ICONS[normalized];

  // Weapon mappings
  if (normalized.includes('spiked_tail') || normalized.includes('ekor')) return ICONS.spiked_tail;
  if (normalized.includes('body_spikes') || normalized.includes('duri_tubuh')) return ICONS.body_spikes;
  if (normalized.includes('fire_breath') || normalized.includes('api') || normalized.includes('napas')) return ICONS.fire_breath;
  if (normalized.includes('rocket') || normalized.includes('roket')) return ICONS.back_rockets;
  if (normalized.includes('quake') || normalized.includes('getar') || normalized.includes('injak')) return ICONS.quake_stomp;
  if (normalized.includes('laser') || normalized.includes('mata')) return ICONS.laser_eyes;
  if (normalized.includes('claw') || normalized.includes('cakar')) return ICONS.claw;
  if (normalized.includes('cannon') || normalized.includes('meriam')) return ICONS.back_cannon;
  if (normalized.includes('electric') || normalized.includes('listrik')) return ICONS.electric_skin;

  // Passive mappings
  if (normalized.includes('vampir') || normalized.includes('agresif')) return ICONS.vampirism;
  if (normalized.includes('blood') || normalized.includes('darah')) return ICONS.blood_rage;
  if (normalized.includes('deflect') || normalized.includes('pantul') || normalized.includes('reflek')) return ICONS.deflector;
  if (normalized.includes('shield') || normalized.includes('perisai_energi') || normalized.includes('energi')) return ICONS.energy_shield;
  if (normalized.includes('scaveng') || normalized.includes('jarah') || normalized.includes('penjarah')) return ICONS.scavenger;
  if (normalized.includes('reach') || normalized.includes('jangkau')) return ICONS.extended_reach;
  if (normalized.includes('sprint') || normalized.includes('lari') || normalized.includes('pelari')) return ICONS.city_sprinter;

  if (normalized.includes('iron') || normalized.includes('baja')) return ICONS.iron_skin;
  if (normalized.includes('regen')) return ICONS.regeneration;
  if (normalized.includes('magnet')) return ICONS.magnet;
  if (normalized.includes('swift') || normalized.includes('kaki')) return ICONS.swift_stride;
  if (normalized.includes('colossus') || normalized.includes('raksasa')) return ICONS.colossus;
  if (normalized.includes('carnage') || normalized.includes('pembunuh')) return ICONS.carnage;
  if (normalized.includes('rapid') || normalized.includes('cepat')) return ICONS.rapid_fire;
  if (normalized.includes('demolisher') || normalized.includes('penghancur')) return ICONS.demolisher;
  if (normalized.includes('thorn') || normalized.includes('duri')) return ICONS.thorn_shield;

  return ICONS.claw;
}
