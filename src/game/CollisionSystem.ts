import { PLAYER_HALF_DEPTH, PLAYER_HALF_WIDTH } from './constants';

export interface Box {
  cx: number; // centre x
  cz: number; // centre z
  y: number; // bottom
  w: number;
  h: number;
  d: number;
}

export interface PlayerBox {
  x: number;
  z: number;
  y: number; // feet height
  height: number;
}

export function playerToBox(p: PlayerBox): Box {
  return { cx: p.x, cz: p.z, y: p.y, w: PLAYER_HALF_WIDTH * 2, h: p.height, d: PLAYER_HALF_DEPTH * 2 };
}

export function overlaps(a: Box, b: Box): boolean {
  return (
    Math.abs(a.cx - b.cx) < (a.w + b.w) / 2 &&
    Math.abs(a.cz - b.cz) < (a.d + b.d) / 2 &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

/** True when the player is shoulder-to-shoulder rather than head-on (used to forgive grazes at lane changes). */
export function isGraze(player: Box, obstacle: Box, forgiveness = 0.12): boolean {
  const overlapX = (player.w + obstacle.w) / 2 - Math.abs(player.cx - obstacle.cx);
  const overlapZ = (player.d + obstacle.d) / 2 - Math.abs(player.cz - obstacle.cz);
  return overlapX < forgiveness && overlapZ > overlapX;
}

export class CollisionSystem {
  /** Returns the first obstacle box hit by the player, or null. Obstacles are given as {box, id}. */
  static firstHit<T extends { box: Box }>(player: PlayerBox, obstacles: Iterable<T>): T | null {
    const pb = playerToBox(player);
    for (const o of obstacles) {
      if (overlaps(pb, o.box) && !isGraze(pb, o.box)) return o;
    }
    return null;
  }

  /** Sphere (coin) vs player capsule-ish box test. */
  static coinHit(player: PlayerBox, coinX: number, coinY: number, coinZ: number, radius = 0.45): boolean {
    const px = Math.abs(player.x - coinX) < PLAYER_HALF_WIDTH + radius;
    const pz = Math.abs(player.z - coinZ) < PLAYER_HALF_DEPTH + radius + 0.3;
    const py = coinY + radius > player.y && coinY - radius < player.y + player.height;
    return px && pz && py;
  }
}
