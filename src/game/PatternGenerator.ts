import { OBSTACLE_DEFS, ObstacleType, SEGMENT_LENGTH } from './constants';

/**
 * Pure obstacle pattern generation. Guarantees every row has a "safe lane" that can be
 * passed without hitting anything (empty, or only containing a jump/slide obstacle), and that
 * successive safe lanes are never more than one lane apart.
 */

export interface PlannedObstacle {
  lane: 0 | 1 | 2;
  type: ObstacleType;
  /** distance from row start toward the player-away direction (m) */
  offset: number;
}

export interface PlannedCoins {
  lane: 0 | 1 | 2;
  count: number;
  /** y height of coins; arcs handled by spawner */
  arc: boolean;
}

export interface Row {
  /** distance along the track (positive = further ahead) of the row's front edge (nearest to player) */
  z: number;
  /** longest obstacle depth in this row */
  length: number;
  safeLane: 0 | 1 | 2;
  obstacles: PlannedObstacle[];
  coins: PlannedCoins | null;
  powerUp: boolean;
}

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(rng: Rng, arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

/** Difficulty 0..1 */
export function difficultyFor(distance: number): number {
  return Math.min(1, distance / 3500);
}

export class PatternGenerator {
  private lastSafe: 0 | 1 | 2 = 1;
  private recentSafe: number[] = [];
  private rowsSinceStation = 0;
  rowsGenerated = 0;

  constructor(private rng: Rng = Math.random) {}

  reset(rng?: Rng) {
    if (rng) this.rng = rng;
    this.lastSafe = 1;
    this.recentSafe = [];
    this.rowsGenerated = 0;
  }

  /** Minimum gap between rows in metres, scaled with speed so lane-switching stays physically possible. */
  static minGap(speed: number): number {
    // switching 1 lane takes ~0.22 s; keep >= 0.7 s of reaction time
    return Math.max(14, speed * 0.7);
  }

  nextRow(prevEnd: number, speed: number, distance: number): Row {
    const rng = this.rng;
    const diff = difficultyFor(distance);

    // choose safe lane within 1 step of previous
    const options: (0 | 1 | 2)[] = [];
    for (const l of [0, 1, 2] as const) if (Math.abs(l - this.lastSafe) <= 1) options.push(l);
    // early on mostly keep lane; later, switch more
    const safe = rng() < 0.4 - diff * 0.2 ? this.lastSafe : pick(rng, options);

    const obstacles: PlannedObstacle[] = [];
    const lanes: (0 | 1 | 2)[] = [0, 1, 2];

    // Probability that a non-safe lane gets an obstacle (more blocked lanes with difficulty)
    const fillChance = 0.55 + diff * 0.4;

    const heavyPool: ObstacleType[] = ['train', 'roadblock', 'train'];
    const mediumPool: ObstacleType[] = ['crate', 'constructionBarrier', 'lowBarrier'];
    const lowerSlideJumpPool: ObstacleType[] = ['lowBarrier', 'crate', 'constructionBarrier', 'highBarrier', 'signal', 'tunnelGate'];

    // moving trains must not be in any lane that was safe in the last 3 rows (they sweep toward the player)
    const movingAllowed = diff > 0.15;

    for (const lane of lanes) {
      if (lane === safe) continue;
      if (rng() > fillChance) continue;
      let type: ObstacleType;
      const r = rng();
      if (r < 0.38 + diff * 0.1) type = pick(rng, heavyPool);
      else type = pick(rng, mediumPool);
      if (type === 'train' && movingAllowed && !this.recentSafe.includes(lane) && rng() < 0.3 + diff * 0.3) {
        type = 'movingTrain';
      }
      obstacles.push({ lane, type, offset: 0 });
    }

    // A jump/slide obstacle may sit in the safe lane (never a lane-only obstacle)
    if (rng() < 0.35 + diff * 0.25) {
      obstacles.push({ lane: safe, type: pick(rng, lowerSlideJumpPool), offset: 0 });
    }

    // Occasionally offset a second obstacle in the safe lane behind to demand a jump->slide combo
    if (diff > 0.4 && rng() < 0.2) {
      const t = pick(rng, ['highBarrier', 'signal', 'tunnelGate'] as const);
      // spaced by >= 1 s of travel so a jump-then-slide combo is physically possible
      obstacles.push({ lane: safe, type: t, offset: Math.max(14, speed * 1.0) });
    }

    // Rows with a moving train must also not hold a second obstacle in the safe lane at offset
    // (kept simple: allowed, because the safe lane obstacles are jump/slide only).

    let length = 1;
    for (const o of obstacles) length = Math.max(length, OBSTACLE_DEFS[o.type].d + o.offset);

    const hasSolidSafe = obstacles.some((o) => o.lane === safe);
    const coins: PlannedCoins | null =
      rng() < 0.75 ? { lane: safe, count: 4 + Math.floor(rng() * 3), arc: hasSolidSafe } : null;
    const powerUp = rng() < 0.07 && !hasSolidSafe;

    const gap = PatternGenerator.minGap(speed) * (1.25 - diff * 0.25) + rng() * 6; // never below minGap
    const z = prevEnd + gap;

    this.lastSafe = safe;
    this.recentSafe.push(safe);
    if (this.recentSafe.length > 3) this.recentSafe.shift();
    this.rowsGenerated++;
    this.rowsSinceStation++;

    return { z, length, safeLane: safe, obstacles, coins, powerUp };
  }
}

export function segmentThemeFor(index: number): 'city' | 'station' | 'bridge' | 'tunnel' {
  if (index < 2) return 'city';
  const m = index % 12;
  if (m === 5) return 'station';
  if (m === 8 || m === 9) return 'bridge';
  if (m === 11 || m === 0) return 'tunnel';
  return 'city';
}

export { SEGMENT_LENGTH };
