import * as THREE from 'three';
import { DESPAWN_Z, LANES, OBSTACLE_DEFS } from './constants';
import { artTexture, basic } from './Assets';
import { CollisionSystem, PlayerBox } from './CollisionSystem';
import type { Row } from './PatternGenerator';

const POOL = 140;

interface Coin {
  group: THREE.Group;
  disc: THREE.Mesh;
  halo: THREE.Sprite;
  active: boolean;
  collecting: number;
  x: number;
  y: number;
  z: number;
}

let haloTex: THREE.CanvasTexture | null = null;
function halo(): THREE.CanvasTexture {
  if (haloTex) return haloTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,225,90,0.9)');
  g.addColorStop(0.4, 'rgba(255,190,40,0.35)');
  g.addColorStop(1, 'rgba(255,190,40,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  haloTex = new THREE.CanvasTexture(c);
  return haloTex;
}

export class CoinSystem {
  readonly root = new THREE.Group();
  private coins: Coin[] = [];
  private free: Coin[] = [];
  private t = 0;
  magnetRadius = 7;
  onCollect?: (coin: { x: number; y: number; z: number }) => void;

  constructor(scene: THREE.Scene) {
    const geo = new THREE.CylinderGeometry(0.34, 0.34, 0.09, 20);
    geo.rotateX(Math.PI / 2); // face toward +z so spinning around Y shows the face
    const rim = new THREE.CylinderGeometry(0.36, 0.36, 0.1, 20);
    rim.rotateX(Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({ color: 0xffc21a, emissive: 0xaa6a00, emissiveIntensity: 0.7 });
    const rimMat = new THREE.MeshLambertMaterial({ color: 0xffe27a, emissive: 0xaa7a10, emissiveIntensity: 0.6 });
    const spriteMat = new THREE.SpriteMaterial({ map: halo(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const faceGeo = new THREE.PlaneGeometry(0.8, 0.8);
    const faceMat = new THREE.MeshBasicMaterial({ map: artTexture('sprites/coin.png'), transparent: true, alphaTest: 0.35 });
    for (let i = 0; i < POOL; i++) {
      const group = new THREE.Group();
      const disc = new THREE.Mesh(geo, mat);
      const edge = new THREE.Mesh(rim, rimMat);
      edge.scale.set(1, 1, 0.6);
      // coin face from the art sheet on both sides of the disc
      const front = new THREE.Mesh(faceGeo, faceMat);
      front.position.z = 0.056;
      const back = new THREE.Mesh(faceGeo, faceMat);
      back.position.z = -0.056;
      back.rotation.y = Math.PI;
      disc.add(edge, front, back);
      const sprite = new THREE.Sprite(spriteMat);
      sprite.scale.setScalar(1.5);
      group.add(disc, sprite);
      group.visible = false;
      this.root.add(group);
      const c: Coin = { group, disc, halo: sprite, active: false, collecting: 0, x: 0, y: 0, z: 0 };
      this.coins.push(c);
      this.free.push(c);
    }
    scene.add(this.root);
  }

  reset() {
    for (const c of this.coins) this.deactivate(c);
  }

  private spawn(x: number, y: number, z: number) {
    const c = this.free.pop();
    if (!c) return;
    c.active = true;
    c.collecting = 0;
    c.x = x;
    c.y = y;
    c.z = z;
    c.group.visible = true;
    c.group.scale.setScalar(1);
    c.group.position.set(x, y, z);
  }

  private deactivate(c: Coin) {
    if (!c.active) return;
    c.active = false;
    c.group.visible = false;
    this.free.push(c);
  }

  /** Coin trail along a lane. Positions are distances ahead (positive). */
  spawnLine(lane: number, aheadStart: number, count: number, y = 0.9, spacing = 2) {
    for (let i = 0; i < count; i++) this.spawn(LANES[lane], y, -(aheadStart + i * spacing));
  }

  spawnArc(lane: number, aheadCentre: number, count: number, base = 0.9, peak = 2.7, spacing = 1.6) {
    for (let i = 0; i < count; i++) {
      const u = count === 1 ? 0.5 : i / (count - 1);
      const y = base + Math.sin(u * Math.PI) * (peak - base);
      this.spawn(LANES[lane], y, -(aheadCentre + (i - (count - 1) / 2) * spacing));
    }
  }

  /** Coins for a planned row: an arc over a jumpable obstacle in the safe lane, otherwise a line after the row. */
  spawnForRow(row: Row) {
    const c = row.coins;
    if (!c) return;
    const safeObs = row.obstacles.find((o) => o.lane === row.safeLane && o.offset === 0);
    if (safeObs && OBSTACLE_DEFS[safeObs.type].counter === 'jump') {
      this.spawnArc(row.safeLane, row.z + OBSTACLE_DEFS[safeObs.type].d / 2, 7);
    } else if (!safeObs) {
      this.spawnLine(row.safeLane, row.z + row.length + 2, c.count);
    }
  }

  /** Jetpack bonus trail high above the tracks. */
  spawnAir(lane: number, aheadStart: number, count = 10) {
    this.spawnLine(lane, aheadStart, count, 4.2, 2);
  }

  update(dt: number, speed: number, player: PlayerBox, magnet: boolean) {
    this.t += dt;
    const dz = speed * dt;
    for (const c of this.coins) {
      if (!c.active) continue;
      if (c.collecting > 0) {
        c.collecting -= dt;
        const k = Math.max(0, c.collecting / 0.22);
        c.group.scale.setScalar(1 + (1 - k) * 0.9);
        c.group.position.y += dt * 4;
        c.halo.scale.setScalar(1.5 * k);
        if (c.collecting <= 0) {
          c.halo.scale.setScalar(1.5);
          this.deactivate(c);
        }
        continue;
      }
      c.z += dz;
      // magnet: pull coins that are close in front of / around the player
      if (magnet) {
        const dx = player.x - c.x;
        const dy = player.y + 0.9 - c.y;
        const dzp = 0 - c.z;
        const d = Math.hypot(dx, dy, dzp);
        if (d < this.magnetRadius && c.z > -this.magnetRadius * 1.4) {
          const pull = Math.min(1, 14 * dt);
          c.x += dx * pull;
          c.y += dy * pull;
          c.z += dzp * pull;
        }
      }
      c.group.position.set(c.x, c.y + Math.sin(this.t * 4 + c.z * 0.3) * 0.04, c.z);
      c.disc.rotation.y = this.t * 4 + c.z * 0.2;

      if (CollisionSystem.coinHit(player, c.x, c.y, c.z)) {
        c.collecting = 0.22;
        this.onCollect?.({ x: c.x, y: c.y, z: c.z });
      } else if (c.z > DESPAWN_Z) {
        this.deactivate(c);
      }
    }
  }
}
