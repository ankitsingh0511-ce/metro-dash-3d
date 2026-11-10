/**
 * Paths of the artwork bundled in public/art (cut from the supplied art sheets).
 * No Three.js / Vite-only imports except BASE_URL, so it is safe to import anywhere in the UI.
 */
const base = (): string => {
  try {
    return (import.meta as unknown as { env?: { BASE_URL?: string } }).env?.BASE_URL ?? './';
  } catch {
    return './';
  }
};

export const artUrl = (p: string): string => `${base()}art/${p}`;

/** Full-body hero panel (character standing on the train track, as supplied) */
export const heroArt = (id: string): string => artUrl(`chars/${id}_hero.jpg`);
/** Square face crop for avatars / HUD */
export const faceArt = (id: string): string => artUrl(`chars/${id}_face.jpg`);
/** Turn-around + run / jump / slide pose sheet */
export const sheetArt = (id: string): string => artUrl(`chars/${id}_sheet.jpg`);

export const STATION_BG = 'station.jpg';

/** Every image the 3D game uses; preloaded so the first frame is not blank. */
export const GAME_ART: string[] = [
  'backdrop.jpg',
  'mural.jpg',
  'billboard.jpg',
  'metrosign.jpg',
  ...['barrier_low', 'gate_light', 'crate_m', 'crate_metal', 'crates_stack', 'hazard', 'cone', 'barrel', 'coin', 'magnet', 'spray', 'sneaker', 'dumpster', 'bush', 'traffic', 'arch'].map((n) => `sprites/${n}.png`),
  ...[0, 1, 2, 3, 4].map((i) => `trains/front${i}.png`),
];
