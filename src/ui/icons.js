/**
 * SVG Icons - Tahap 4A-2
 * Crisp, modern neon-line SVG icons for Kaiju weapons, passives, and HUD stats.
 * Uses 24x24 viewBox with vector paths, scales cleanly to any resolution without blur.
 */
export const ICONS = {
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
      <path d="m18 15 3 3" opacity="0.7" />
    </svg>
  `,

  // Passive: Swift Stride (Kaki Perkasa)
  swift_stride: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 14h6a4 4 0 0 0 4-4V4" />
      <path d="M14 10l7 4-2 6-8-2-3-5" />
      <path d="M2 10h4" opacity="0.7" />
      <path d="M1 14h2" opacity="0.7" />
      <path d="M3 18h5" opacity="0.7" />
    </svg>
  `,

  // Passive: Colossus (Tubuh Raksasa)
  colossus: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M3 7V3h4" />
      <path d="M21 7V3h-4" />
      <path d="M3 17v4h4" />
      <path d="M21 17v4h-4" />
      <circle cx="12" cy="12" r="7" stroke-dasharray="3 3" opacity="0.6" />
    </svg>
  `,

  // Passive: Carnage / Killer (Pembunuh)
  carnage: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="9" r="2" fill="currentColor" />
      <circle cx="15" cy="9" r="2" fill="currentColor" />
      <path d="M9 15h6" />
      <path d="M12 2a9 9 0 0 0-9 9c0 3.87 2.45 7.17 5.92 8.48L8 22h8l-.92-2.52C18.55 18.17 21 14.87 21 11a9 9 0 0 0-9-9z" />
    </svg>
  `,

  // Passive: Rapid Fire (Cepat Tembak)
  rapid_fire: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2 2" />
      <path d="M5 3 2 6" />
      <path d="m22 6-3-3" />
      <path d="M12 2v3" />
    </svg>
  `,

  // Passive: Demolisher (Penghancur Kota)
  demolisher: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="10" width="7" height="12" rx="1" />
      <path d="M14 6l3-3 4 4-2 15h-8" />
      <line x1="6" y1="14" x2="7" y2="14" />
      <line x1="6" y1="18" x2="7" y2="18" />
      <line x1="16" y1="11" x2="18" y2="11" />
      <line x1="15" y1="15" x2="17" y2="15" />
    </svg>
  `,

  // Passive: Thorn Shield (Sisik Duri)
  thorn_shield: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="6" />
      <path d="M12 2v4" />
      <path d="M12 18v4" />
      <path d="M2 12h4" />
      <path d="M18 12h4" />
      <path d="m4.93 4.93 2.83 2.83" />
      <path d="m16.24 16.24 2.83 2.83" />
      <path d="m4.93 19.07 2.83-2.83" />
      <path d="m16.24 7.76 2.83-2.83" />
    </svg>
  `,

  // HUD Utilities: Clock, Skull, City, Alert, Level
  clock: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  `,

  skull: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 10h.01" />
      <path d="M15 10h.01" />
      <path d="M10 20v-3h4v3" />
      <path d="M5 10a7 7 0 0 1 14 0c0 3-1.5 5.5-4 6.5V17H9v-.5C6.5 15.5 5 13 5 10z" />
    </svg>
  `,

  city: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V7l8-4v18" />
      <path d="M13 11l6-2v12" />
      <line x1="9" y1="9" x2="9" y2="9.01" />
      <line x1="9" y1="13" x2="9" y2="13.01" />
      <line x1="9" y1="17" x2="9" y2="17.01" />
    </svg>
  `,

  siren: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M7 18h10" />
      <path d="M8 18v-6a4 4 0 0 1 8 0v6" />
      <path d="M12 2v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
    </svg>
  `,

  reroll: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
      <path d="M3 21v-5h5" />
    </svg>
  `,

  skip: `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" opacity="0.3" />
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" stroke-width="2.5" />
    </svg>
  `
};

/**
 * Resolves an icon key from card/weapon ID to an SVG markup string.
 * @param {string} key 
 * @returns {string}
 */
export function getIconSvg(key) {
  if (!key) return ICONS.claw;
  const normalized = key.toLowerCase().replace(/^(icon_|card_)/, '');

  if (ICONS[normalized]) return ICONS[normalized];
  if (normalized.includes('claw') || normalized.includes('cakar')) return ICONS.claw;
  if (normalized.includes('cannon') || normalized.includes('meriam')) return ICONS.back_cannon;
  if (normalized.includes('electric') || normalized.includes('listrik')) return ICONS.electric_skin;
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
