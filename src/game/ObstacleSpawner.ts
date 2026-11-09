import * as THREE from 'three';
import { DESPAWN_Z, LANES, OBSTACLE_DEFS, ObstacleDef, ObstacleType, SPAWN_DISTANCE } from './constants';
import { BOX, CYL, SPHERE, basic, canvasTexture, lambert, mesh } from './Assets';
import { PatternGenerator, Row } from './PatternGenerator';
import type { Box } from './CollisionSystem';

export interface ActiveObstacle {
  type: ObstacleType;
  def: ObstacleDef;
  group: THREE.Group;
  lane: number;
  x: number;
  z: number; // centre
  box: Box;
  hit: boolean; // already collided (ignored afterwards)
  passed: boolean;
  knock: number; // >0 while tumbling after a non-fatal hit
  blink?: THREE.Mesh;
}

const LIVERIES = [
  [0x2f6fd6, 0xffffff],
  [0xd9532b, 0xffe14d],
  [0x1fa37a, 0xffffff],
  [0x7a4dff, 0xffd23a],
  [0xc9d2e0, 0xff4d4d],
];

function stripeTexture(a: string, b: string) {
  return canvasTexture(`stripe${a}${b}`, 128, 32, (ctx, w, h) => {
    ctx.fillStyle = a;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = b;
    for (let x = -h; x < w + h; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x + 16, h);
      ctx.lineTo(x + 16 + h, 0);
      ctx.lineTo(x + h, 0);
      ctx.fill();
    }
  });
}

function woodTexture() {
  return canvasTexture('wood', 128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#b07a3f';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#7b4f24';
    ctx.lineWidth = 6;
    ctx.strokeRect(3, 3, w - 6, h - 6);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(w, h);
    ctx.moveTo(w, 0);
    ctx.lineTo(0, h);
    ctx.stroke();
    ctx.lineWidth = 2;
    for (let y = 16; y < h; y += 24) {
      ctx.beginPath();
      ctx.moveTo(10, y);
      ctx.lineTo(w - 10, y + 3);
      ctx.stroke();
    }
  });
}

function trainTexture(body: number, accent: number) {
  const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
  return canvasTexture(`train${body}${accent}`, 512, 128, (ctx, w, h) => {
    ctx.fillStyle = hex(body);
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = hex(accent);
    ctx.fillRect(0, h * 0.62, w, 10);
    ctx.fillRect(0, h * 0.12, w, 5);
    ctx.fillStyle = '#16213e';
    for (let x = 28; x < w - 50; x += 72) {
      ctx.fillRect(x, 26, 48, 40);
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x + 4, 30, 14, 32);
      ctx.fillStyle = '#16213e';
    }
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, h - 14, w, 14);
  });
}

type Builder = (def: ObstacleDef) => { group: THREE.Group; blink?: THREE.Mesh };

const BUILDERS: Record<ObstacleType, Builder> = {
  train: (def) => buildTrain(def, false),
  movingTrain: (def) => buildTrain(def, true),
  crate: () => {
    const g = new THREE.Group();
    const wood = lambert(0xffffff, { map: woodTexture() });
    g.add(mesh(BOX, wood, [0, 0.55, 0], [1.6, 1.1, 1.3], true));
    return { group: g };
  },
  lowBarrier: () => {
    const g = new THREE.Group();
    const stripes = lambert(0xffffff, { map: stripeTexture('#e03030', '#ffffff') });
    g.add(mesh(BOX, stripes, [0, 0.62, 0], [1.9, 0.4, 0.14], true));
    for (const sx of [-0.8, 0.8]) g.add(mesh(BOX, lambert(0x3a3f4f), [sx, 0.4, 0], [0.12, 0.8, 0.2], true));
    return { group: g };
  },
  highBarrier: () => {
    const g = new THREE.Group();
    const stripes = lambert(0xffffff, { map: stripeTexture('#ffb11a', '#1c1c24') });
    g.add(mesh(BOX, stripes, [0, 1.7, 0], [2.0, 1.0, 0.16], true));
    for (const sx of [-0.95, 0.95]) g.add(mesh(BOX, lambert(0x3a3f4f), [sx, 1.1, 0], [0.14, 2.3, 0.2], true));
    return { group: g };
  },
  constructionBarrier: () => {
    const g = new THREE.Group();
    const stripes = lambert(0xffffff, { map: stripeTexture('#ff7a1a', '#ffffff') });
    g.add(mesh(BOX, stripes, [0, 0.95, 0], [1.9, 0.4, 0.14], true));
    g.add(mesh(BOX, stripes, [0, 0.5, 0], [1.9, 0.3, 0.14], true));
    for (const sx of [-0.85, 0.85]) {
      const leg = mesh(BOX, lambert(0xf2f2f2), [sx, 0.55, 0.15], [0.1, 1.15, 0.1]);
      leg.rotation.x = 0.2;
      g.add(leg);
    }
    const blink = mesh(SPHERE, basic(0xffd23a), [0.8, 1.3, 0], [0.1, 0.1, 0.1]);
    g.add(blink);
    return { group: g, blink };
  },
  signal: () => {
    const g = new THREE.Group();
    for (const sx of [-1.0, 1.0]) g.add(mesh(CYL, lambert(0x3a3f4f), [sx, 1.4, 0], [0.09, 2.8, 0.09], true));
    g.add(mesh(BOX, lambert(0x2b2f3d), [0, 1.75, 0], [2.2, 0.5, 0.3], true));
    g.add(mesh(SPHERE, basic(0xff2a2a), [-0.4, 1.75, -0.17], [0.13, 0.13, 0.05]));
    g.add(mesh(SPHERE, basic(0xff2a2a), [0.4, 1.75, -0.17], [0.13, 0.13, 0.05]));
    return { group: g };
  },
  tunnelGate: () => {
    const g = new THREE.Group();
    const brick = lambert(0x8a4a3a);
    for (const sx of [-1.0, 1.0]) g.add(mesh(BOX, brick, [sx, 1.4, 0], [0.4, 2.8, 1.4], true));
    g.add(mesh(BOX, brick, [0, 1.8, 0], [2.2, 1.2, 1.5], true));
    g.add(mesh(BOX, basic(0xffd23a), [0, 1.2, -0.76], [2.0, 0.06, 0.02]));
    return { group: g };
  },
  roadblock: () => {
    const g = new THREE.Group();
    const stripes = lambert(0xffffff, { map: stripeTexture('#d62f2f', '#ffffff') });
    g.add(mesh(BOX, lambert(0xb9bcc7), [0, 0.55, 0], [1.9, 1.1, 0.8], true));
    g.add(mesh(BOX, stripes, [0, 1.35, 0], [1.9, 0.5, 0.8], true));
    g.add(mesh(BOX, lambert(0xb9bcc7), [0, 2.0, 0], [1.9, 0.9, 0.8], true));
    g.add(mesh(BOX, stripes, [0, 2.55, 0], [1.9, 0.4, 0.8], true));
    const sign = mesh(BOX, lambert(0xd62f2f), [0, 2.95, 0], [0.6, 0.45, 0.06]);
    g.add(sign);
    return { group: g };
  },
};

function buildTrain(def: ObstacleDef, moving: boolean) {
  const g = new THREE.Group();
  const [body, accent] = LIVERIES[Math.floor(Math.random() * LIVERIES.length)];
  const side = lambert(0xffffff, { map: trainTexture(body, accent) });
  const plain = lambert(body);
  const len = def.d;
  g.add(mesh(BOX, plain, [0, 2.05, 0], [1.85, 2.9, len], true)); // carriage
  g.add(mesh(BOX, lambert(0xdfe3ec), [0, 3.62, 0], [1.6, 0.14, len - 0.5])); // roof
  for (const sx of [-0.935, 0.935]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.6, 2.2), side);
    p.position.set(sx, 2.3, 0);
    p.rotation.y = sx > 0 ? Math.PI / 2 : -Math.PI / 2;
    g.add(p);
  }
  for (const bz of [-len / 2 + 2.4, len / 2 - 2.4]) g.add(mesh(BOX, lambert(0x23252f), [0, 0.45, bz], [1.7, 0.5, 2.4])); // bogies
  g.add(mesh(BOX, lambert(0x23252f), [0, 0.7, 0], [1.2, 0.3, len - 1])); // undercarriage
  // front (player-facing, +z) cab window and headlights
  g.add(mesh(BOX, lambert(0x16213e), [0, 2.6, len / 2 + 0.01], [1.5, 1.0, 0.04]));
  const lightMat = basic(moving ? 0xfff6c0 : 0xb8b49a);
  g.add(mesh(SPHERE, lightMat, [-0.55, 1.2, len / 2 + 0.04], [0.16, 0.16, 0.06]));
  g.add(mesh(SPHERE, lightMat, [0.55, 1.2, len / 2 + 0.04], [0.16, 0.16, 0.06]));
  g.add(mesh(BOX, basic(moving ? 0xff4d4d : 0x6b6f7d), [0, 3.35, len / 2 + 0.03], [0.5, 0.12, 0.05]));
  return { group: g };
}

/**
 * Plans rows with PatternGenerator, builds/recycles obstacle meshes, scrolls them,
 * and exposes `active` for collision tests.
 */
export class ObstacleSpawner {
  readonly root = new THREE.Group();
  active: ActiveObstacle[] = [];
  private pool = new Map<ObstacleType, ActiveObstacle[]>();
  private gen: PatternGenerator;
  private aheadEnd = 40; // distance ahead of the player where planned content currently ends
  onRow?: (row: Row) => void;
  onPassed?: (o: ActiveObstacle) => void;
  private time = 0;

  constructor(scene: THREE.Scene, seed?: () => number) {
    this.gen = new PatternGenerator(seed ?? Math.random);
    scene.add(this.root);
  }

  reset() {
    for (const o of this.active) this.release(o);
    this.active = [];
    this.gen.reset();
    this.aheadEnd = 45;
  }

  /** Remove obstacles within `ahead` metres (used on revive to give breathing room). */
  clearNear(ahead: number) {
    this.active = this.active.filter((o) => {
      const near = o.z + o.def.d / 2 > -ahead && o.z - o.def.d / 2 < 8;
      if (near) this.release(o);
      return !near;
    });
  }

  private acquire(type: ObstacleType, lane: number): ActiveObstacle {
    const free = this.pool.get(type)?.pop();
    const def = OBSTACLE_DEFS[type];
    let o = free;
    if (!o) {
      const built = BUILDERS[type](def);
      o = { type, def, group: built.group, lane, x: 0, z: 0, box: { cx: 0, cz: 0, y: def.y, w: def.w, h: def.h, d: def.d }, hit: false, passed: false, knock: 0, blink: built.blink };
    }
    o.lane = lane;
    o.x = LANES[lane];
    o.hit = false;
    o.passed = false;
    o.knock = 0;
    o.group.rotation.set(0, 0, 0);
    o.group.visible = true;
    this.root.add(o.group);
    return o;
  }

  private release(o: ActiveObstacle) {
    this.root.remove(o.group);
    o.group.visible = false;
    let list = this.pool.get(o.type);
    if (!list) this.pool.set(o.type, (list = []));
    list.push(o);
  }

  update(dt: number, speed: number, distance: number) {
    this.time += dt;
    const dz = speed * dt;
    this.aheadEnd -= dz;

    // spawn rows until the horizon is filled
    while (this.aheadEnd < SPAWN_DISTANCE) {
      const row = this.gen.nextRow(this.aheadEnd, speed, distance);
      for (const p of row.obstacles) {
        const o = this.acquire(p.type, p.lane);
        const centreAhead = row.z + p.offset + o.def.d / 2;
        o.z = -centreAhead;
        o.group.position.set(o.x, 0, o.z);
        this.active.push(o);
      }
      this.onRow?.(row);
      this.aheadEnd = row.z + row.length;
    }

    for (let i = this.active.length - 1; i >= 0; i--) {
      const o = this.active[i];
      o.z += (speed + o.def.velocity) * dt;
      o.group.position.z = o.z;
      o.box.cx = o.x;
      o.box.cz = o.z;
      if (o.blink) o.blink.visible = Math.sin(this.time * 10) > 0;
      if (o.knock > 0) {
        o.knock -= dt;
        o.group.rotation.x -= dt * 5;
        o.group.position.y += dt * 2 - (0.6 - o.knock) * dt * 6;
      }
      if (!o.passed && o.z - o.def.d / 2 > 0.6) {
        o.passed = true;
        if (!o.hit) this.onPassed?.(o);
      }
      if (o.z - o.def.d / 2 > DESPAWN_Z) {
        this.release(o);
        this.active.splice(i, 1);
      }
    }
  }

  /** Visual knock-over after a non-fatal collision. */
  knockOver(o: ActiveObstacle) {
    o.hit = true;
    o.knock = 0.6;
  }
}
