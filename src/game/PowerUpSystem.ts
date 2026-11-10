import * as THREE from 'three';
import { DESPAWN_Z, LANES, POWERUP_BASE_DURATION, POWERUP_INFO, PowerUpType } from './constants';
import { BOX, CYL, SPHERE, basic, canvasTexture, lambert, mesh, spriteQuad } from './Assets';
import { UPGRADES } from '../data/catalog';
import { CollisionSystem, PlayerBox } from './CollisionSystem';

const TYPES: PowerUpType[] = ['magnet', 'jetpack', 'sneakers', 'hoverboard', 'multiplier', 'booster'];

function buildModel(type: PowerUpType): THREE.Group {
  const g = new THREE.Group();
  const col = POWERUP_INFO[type].color;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.04, 6, 24), basic(col, { transparent: true, opacity: 0.8 }));
  g.add(ring);
  const body = new THREE.Group();
  g.add(body);
  switch (type) {
    case 'magnet': {
      const sp = spriteQuad('sprites/magnet.png', 0.8, 0.73);
      sp.position.y = -0.36;
      body.add(sp);
      g.userData.sprite = true;
      break;
    }
    case 'jetpack': {
      for (const sx of [-0.14, 0.14]) {
        body.add(mesh(CYL, lambert(0xc7ccd8), [sx, 0, 0], [0.11, 0.5, 0.11]));
        body.add(mesh(CYL, lambert(0xff9a1f), [sx, -0.28, 0], [0.08, 0.1, 0.08]));
        body.add(mesh(SPHERE, lambert(0xff9a1f), [sx, 0.26, 0], [0.11, 0.08, 0.11]));
      }
      break;
    }
    case 'sneakers': {
      const sp = spriteQuad('sprites/sneaker.png', 0.8, 0.76);
      sp.position.y = -0.38;
      body.add(sp);
      g.userData.sprite = true;
      break;
    }
    case 'hoverboard': {
      body.add(mesh(BOX, lambert(0x2d9bff), [0, 0, 0], [0.42, 0.06, 0.95]));
      body.add(mesh(BOX, basic(0x7fe9ff), [0, -0.06, 0], [0.46, 0.03, 1.0]));
      body.rotation.x = 0.3;
      break;
    }
    case 'multiplier': {
      const sp = spriteQuad('sprites/spray.png', 0.55, 0.9);
      sp.position.y = -0.45;
      body.add(sp);
      g.userData.sprite = true;
      break;
    }
    case 'booster': {
      const bolt = new THREE.Shape();
      bolt.moveTo(0.1, 0.35);
      bolt.lineTo(-0.2, -0.02);
      bolt.lineTo(-0.02, -0.02);
      bolt.lineTo(-0.1, -0.35);
      bolt.lineTo(0.2, 0.03);
      bolt.lineTo(0.02, 0.03);
      bolt.closePath();
      const geo = new THREE.ExtrudeGeometry(bolt, { depth: 0.12, bevelEnabled: false });
      geo.translate(0, 0, -0.06);
      body.add(new THREE.Mesh(geo, basic(0xffe14d)));
      break;
    }
  }
  g.userData.body = body;
  g.userData.ring = ring;
  return g;
}

interface Pickup {
  type: PowerUpType;
  group: THREE.Group;
  x: number;
  z: number;
  active: boolean;
}

export class PowerUpSystem {
  readonly root = new THREE.Group();
  private pickups: Pickup[] = [];
  private pool = new Map<PowerUpType, Pickup[]>();
  private timers: Partial<Record<PowerUpType, number>> = {};
  private durations: Partial<Record<PowerUpType, number>> = {};
  private upgrades: Record<PowerUpType, number> = { magnet: 0, jetpack: 0, sneakers: 0, hoverboard: 0, multiplier: 0, booster: 0 };
  private t = 0;
  onActivate?: (t: PowerUpType) => void;
  onExpire?: (t: PowerUpType) => void;
  onPickup?: (t: PowerUpType, x: number, y: number, z: number) => void;

  constructor(scene: THREE.Scene) {
    scene.add(this.root);
  }

  setUpgrades(u: Record<PowerUpType, number>) {
    this.upgrades = { ...u };
  }

  reset() {
    for (const p of this.pickups) this.release(p);
    this.pickups = [];
    this.timers = {};
    this.durations = {};
  }

  duration(t: PowerUpType): number {
    const up = UPGRADES.find((u) => u.type === t)!;
    return POWERUP_BASE_DURATION[t] + up.perLevel * (this.upgrades[t] ?? 0);
  }

  isActive(t: PowerUpType) {
    return (this.timers[t] ?? 0) > 0;
  }

  remaining(t: PowerUpType) {
    return Math.max(0, this.timers[t] ?? 0);
  }

  fraction(t: PowerUpType) {
    return this.remaining(t) / (this.durations[t] || 1);
  }

  activeList(): PowerUpType[] {
    return TYPES.filter((t) => this.isActive(t));
  }

  activate(t: PowerUpType) {
    const d = this.duration(t);
    this.timers[t] = d;
    this.durations[t] = d;
    this.onActivate?.(t);
  }

  /** Hoverboard absorbs one hit then breaks. Returns true if a shield absorbed the hit. */
  consumeShield(): boolean {
    if (!this.isActive('hoverboard')) return false;
    this.timers.hoverboard = 0;
    this.onExpire?.('hoverboard');
    return true;
  }

  endJetpack() {
    if (this.isActive('jetpack')) {
      this.timers.jetpack = 0;
      this.onExpire?.('jetpack');
    }
  }

  spawnPickup(lane: number, aheadZ: number) {
    const candidates = TYPES.filter((t) => !this.isActive(t));
    const pool = candidates.length ? candidates : TYPES;
    const type = pool[Math.floor(Math.random() * pool.length)];
    let p = this.pool.get(type)?.pop();
    if (!p) p = { type, group: buildModel(type), x: 0, z: 0, active: true };
    p.active = true;
    p.x = LANES[lane];
    p.z = -aheadZ;
    p.group.position.set(p.x, 1.2, p.z);
    p.group.visible = true;
    this.root.add(p.group);
    this.pickups.push(p);
  }

  private release(p: Pickup) {
    this.root.remove(p.group);
    p.group.visible = false;
    p.active = false;
    let list = this.pool.get(p.type);
    if (!list) this.pool.set(p.type, (list = []));
    list.push(p);
  }

  update(dt: number, speed: number, player: PlayerBox) {
    this.t += dt;
    for (const key of Object.keys(this.timers) as PowerUpType[]) {
      const left = this.timers[key] ?? 0;
      if (left > 0) {
        this.timers[key] = left - dt;
        if (this.timers[key]! <= 0) {
          this.timers[key] = 0;
          this.onExpire?.(key);
        }
      }
    }
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const p = this.pickups[i];
      p.z += speed * dt;
      p.group.position.set(p.x, 1.2 + Math.sin(this.t * 3 + i) * 0.12, p.z);
      // art-sprite pickups wobble instead of spinning (a flat sprite would vanish edge-on)
      (p.group.userData.body as THREE.Object3D).rotation.y = p.group.userData.sprite ? Math.sin(this.t * 3) * 0.35 : this.t * 2.4;
      (p.group.userData.ring as THREE.Object3D).rotation.x = this.t * 1.5;
      if (CollisionSystem.coinHit(player, p.x, 1.2, p.z, 0.7)) {
        this.onPickup?.(p.type, p.x, 1.2, p.z);
        this.activate(p.type);
        this.release(p);
        this.pickups.splice(i, 1);
      } else if (p.z > DESPAWN_Z) {
        this.release(p);
        this.pickups.splice(i, 1);
      }
    }
  }
}
