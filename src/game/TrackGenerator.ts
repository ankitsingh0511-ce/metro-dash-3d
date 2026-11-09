import * as THREE from 'three';
import { DESPAWN_Z, LANES, LANE_WIDTH, SEGMENT_LENGTH, SPAWN_DISTANCE } from './constants';
import { BOX, CYL, SPHERE, CONE, adTexture, basic, canvasTexture, graffitiTexture, lambert, mesh, sunsetSky, windowTexture } from './Assets';
import { segmentThemeFor } from './PatternGenerator';

type Theme = 'city' | 'station' | 'bridge' | 'tunnel';

interface Segment {
  group: THREE.Group;
  theme: Theme;
  buildings: THREE.Mesh[];
}

const L = SEGMENT_LENGTH;
const TRACK_HALF = LANE_WIDTH * 1.5 + 0.8;

function rnd(a: number, b: number) {
  return a + Math.random() * (b - a);
}

/**
 * Procedurally generates an endless railway: segments scroll toward the camera and are recycled through
 * per-theme pools (city, station, bridge, tunnel), so no geometry is allocated during play.
 */
export class TrackGenerator {
  readonly root = new THREE.Group();
  private active: Segment[] = [];
  private pools: Record<Theme, Segment[]> = { city: [], station: [], bridge: [], tunnel: [] };
  private nextIndex = 0;
  private frontZ = 0; // z of most distant segment centre
  private sky: THREE.Mesh;
  private skyline: THREE.Mesh;
  private water: THREE.Mesh;

  constructor(private scene: THREE.Scene) {
    scene.add(this.root);

    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 16, 12), new THREE.MeshBasicMaterial({ map: sunsetSky(), side: THREE.BackSide, fog: false, depthWrite: false }));
    this.sky.renderOrder = -2;
    scene.add(this.sky);

    const skyTex = canvasTexture('skyline', 1024, 128, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      let x = 0;
      while (x < w) {
        const bw = 30 + Math.random() * 50;
        const bh = 25 + Math.random() * 90;
        ctx.fillStyle = Math.random() > 0.5 ? '#3b3a6b' : '#4a4780';
        ctx.fillRect(x, h - bh, bw, bh);
        ctx.fillStyle = 'rgba(255,225,150,0.7)';
        for (let wy = h - bh + 8; wy < h - 6; wy += 14) for (let wx = x + 6; wx < x + bw - 8; wx += 12) if (Math.random() > 0.6) ctx.fillRect(wx, wy, 5, 7);
        x += bw + 2;
      }
    });
    this.skyline = new THREE.Mesh(new THREE.PlaneGeometry(700, 90), new THREE.MeshBasicMaterial({ map: skyTex, transparent: true, fog: false, depthWrite: false }));
    this.skyline.position.set(0, 38, -300);
    this.skyline.renderOrder = -1;
    scene.add(this.skyline);

    this.water = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), lambert(0x2a6bb3));
    this.water.rotation.x = -Math.PI / 2;
    this.water.position.y = -9;
    this.water.visible = false;
    scene.add(this.water);
  }

  /** Follow the camera so sky and skyline always fill the background. */
  followCamera(cam: THREE.Camera) {
    this.sky.position.copy(cam.position);
    this.skyline.position.x = cam.position.x * 0.9;
    this.water.position.x = cam.position.x;
  }

  reset() {
    for (const s of this.active) this.release(s);
    this.active = [];
    this.nextIndex = 0;
    this.frontZ = 2 * L; // first segment centre at z = +L so the area behind the player is covered too
    this.fill();
  }

  /** Scroll the world by `dz` toward the camera (+z). */
  scroll(dz: number) {
    for (const s of this.active) s.group.position.z += dz;
    this.frontZ += dz;
    // recycle segments that have passed behind the camera
    while (this.active.length && this.active[0].group.position.z - L / 2 > DESPAWN_Z + 10) {
      this.release(this.active.shift()!);
    }
    this.fill();
    this.water.visible = this.active.some((s) => s.theme === 'bridge' && Math.abs(s.group.position.z) < 80);
  }

  private fill() {
    while (this.frontZ - L / 2 > -SPAWN_DISTANCE - L) {
      const theme = segmentThemeFor(this.nextIndex++);
      const seg = this.acquire(theme);
      this.frontZ -= L;
      seg.group.position.set(0, 0, this.frontZ);
      this.active.push(seg);
    }
  }

  private acquire(theme: Theme): Segment {
    const seg = this.pools[theme].pop() ?? this.build(theme);
    for (const b of seg.buildings) {
      const h = rnd(14, 34);
      b.scale.y = h;
      b.position.y = h / 2 - 0.2;
    }
    seg.group.visible = true;
    this.root.add(seg.group);
    return seg;
  }

  private release(seg: Segment) {
    this.root.remove(seg.group);
    seg.group.visible = false;
    this.pools[seg.theme].push(seg);
  }

  // ---------------- segment builders ----------------

  private build(theme: Theme): Segment {
    const group = new THREE.Group();
    const buildings: THREE.Mesh[] = [];
    this.addTrack(group, theme);
    switch (theme) {
      case 'city':
        this.addCity(group, buildings);
        break;
      case 'station':
        this.addStation(group, buildings);
        break;
      case 'bridge':
        this.addBridge(group);
        break;
      case 'tunnel':
        this.addTunnel(group);
        break;
    }
    return { group, theme, buildings };
  }

  private addTrack(g: THREE.Group, theme: Theme) {
    const bedW = TRACK_HALF * 2;
    const bed = mesh(BOX, lambert(theme === 'bridge' ? 0x4a4f5c : 0x6d675f), [0, -0.1, 0], [bedW, 0.2, L]);
    bed.receiveShadow = true;
    g.add(bed);
    const rail = lambert(0xc5cad6);
    const tieMat = lambert(0x5a3d2b);
    const tiesPerLane = L / 2;
    const ties = new THREE.InstancedMesh(BOX, tieMat, tiesPerLane * 3);
    const m = new THREE.Matrix4();
    let n = 0;
    for (const lx of LANES) {
      for (let i = 0; i < tiesPerLane; i++) {
        m.compose(new THREE.Vector3(lx, 0.03, -L / 2 + i * 2 + 1), new THREE.Quaternion(), new THREE.Vector3(2.0, 0.07, 0.34));
        ties.setMatrixAt(n++, m);
      }
      for (const dx of [-0.6, 0.6]) {
        const r = mesh(BOX, rail, [lx + dx, 0.12, 0], [0.09, 0.12, L]);
        g.add(r);
      }
    }
    ties.receiveShadow = true;
    g.add(ties);
    // lane tint stripes help readability of the 3 lanes
    for (const lx of [-LANE_WIDTH / 2, LANE_WIDTH / 2]) g.add(mesh(BOX, basic(0xffffff, { transparent: true, opacity: 0.08 }), [lx * 2, 0.01, 0], [0.04, 0.01, L]));
  }

  private lamp(g: THREE.Group, x: number, z: number) {
    const side = Math.sign(x);
    g.add(mesh(CYL, lambert(0x2b2f3d), [x, 2.6, z], [0.07, 5.2, 0.07]));
    g.add(mesh(BOX, lambert(0x2b2f3d), [x - side * 0.6, 5.15, z], [1.3, 0.07, 0.07]));
    g.add(mesh(BOX, basic(0xfff0b8), [x - side * 1.15, 5.08, z], [0.5, 0.08, 0.22]));
  }

  private tree(g: THREE.Group, x: number, z: number) {
    const s = rnd(0.9, 1.5);
    g.add(mesh(CYL, lambert(0x6b4a2f), [x, 0.9 * s, z], [0.18 * s, 1.8 * s, 0.18 * s]));
    g.add(mesh(CONE, lambert(0x2fa35a), [x, 3.0 * s, z], [1.2 * s, 2.6 * s, 1.2 * s], true));
    g.add(mesh(CONE, lambert(0x3cc16c), [x, 4.1 * s, z], [0.9 * s, 1.9 * s, 0.9 * s], true));
  }

  private signalPost(g: THREE.Group, x: number, z: number) {
    g.add(mesh(CYL, lambert(0x3a3f4f), [x, 1.6, z], [0.07, 3.2, 0.07]));
    g.add(mesh(BOX, lambert(0x14161f), [x, 3.3, z], [0.35, 0.8, 0.25]));
    g.add(mesh(SPHERE, basic(0xff3030), [x, 3.5, z - 0.14], [0.1, 0.1, 0.05]));
    g.add(mesh(SPHERE, basic(0x30ff70), [x, 3.15, z - 0.14], [0.1, 0.1, 0.05]));
  }

  private adBoard(g: THREE.Group, x: number, z: number, i: number) {
    const side = Math.sign(x);
    g.add(mesh(BOX, lambert(0x2b2f3d), [x, 1.5, z], [0.12, 3.0, 0.12]));
    const board = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.1), new THREE.MeshBasicMaterial({ map: adTexture(i) }));
    board.position.set(x, 3.6, z);
    board.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(board);
  }

  private graffitiWall(g: THREE.Group, x: number, z: number, i: number) {
    const wall = mesh(BOX, lambert(0x5c5f6e), [x, 1.2, z], [0.3, 2.4, 11]);
    g.add(wall);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(10.5, 2.2), new THREE.MeshBasicMaterial({ map: graffitiTexture(i) }));
    art.position.set(x - Math.sign(x) * 0.17, 1.2, z);
    art.rotation.y = x > 0 ? -Math.PI / 2 : Math.PI / 2;
    g.add(art);
  }

  private addBuildings(g: THREE.Group, buildings: THREE.Mesh[], startX: number) {
    for (const side of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        const w = rnd(6, 9);
        const mat = new THREE.MeshLambertMaterial({ map: windowTexture(Math.floor(rnd(1, 6)), ['#3c4a7a', '#7a3c5a', '#3c7a6a', '#7a6a3c', '#4a3c7a'][Math.floor(rnd(0, 5))]) });
        mat.map = mat.map!.clone();
        mat.map.needsUpdate = true;
        mat.map.repeat.set(Math.ceil(w / 4), 4);
        mat.map.wrapS = mat.map.wrapT = THREE.RepeatWrapping;
        const b = new THREE.Mesh(BOX, mat);
        b.scale.set(w, 20, 9);
        b.position.set(side * (startX + w / 2 + rnd(0, 3)), 10, -L / 2 + 5 + i * 10);
        g.add(b);
        buildings.push(b);
      }
    }
  }

  private addCity(g: THREE.Group, buildings: THREE.Mesh[]) {
    for (const side of [-1, 1]) {
      const pave = mesh(BOX, lambert(0x4a5063), [side * 9.4, -0.12, 0], [9.2, 0.2, L]);
      pave.receiveShadow = true;
      g.add(pave);
      this.lamp(g, side * 5.6, -L / 4);
      this.lamp(g, side * 5.6, L / 4);
      this.tree(g, side * 6.8, -L / 2 + 6);
      this.tree(g, side * 7.4, L / 2 - 8);
    }
    this.adBoard(g, -6.4, -6, Math.floor(rnd(0, 8)));
    this.adBoard(g, 6.4, 8, Math.floor(rnd(0, 8)));
    this.graffitiWall(g, -5.4, 6, Math.floor(rnd(0, 4)));
    this.graffitiWall(g, 5.4, -8, Math.floor(rnd(0, 4)));
    this.signalPost(g, -5.0, -14);
    this.signalPost(g, 5.0, 14);
    this.addBuildings(g, buildings, 13);
  }

  private addStation(g: THREE.Group, buildings: THREE.Mesh[]) {
    const platMat = lambert(0xb8bcc9);
    const edge = lambert(0xffd23a);
    for (const side of [-1, 1]) {
      g.add(mesh(BOX, platMat, [side * 8.2, 0.45, 0], [7.4, 0.9, L]));
      g.add(mesh(BOX, edge, [side * 4.6, 0.92, 0], [0.25, 0.05, L]));
      // roof and pillars
      g.add(mesh(BOX, lambert(0x2f6fd6), [side * 7.4, 5.6, 0], [6.2, 0.25, L - 2]));
      for (const pz of [-16, -5, 5, 16]) g.add(mesh(CYL, lambert(0x3a3f4f), [side * 5.6, 3.2, pz], [0.14, 4.6, 0.14]));
      for (const bz of [-9, 9]) {
        g.add(mesh(BOX, lambert(0x8b5a2b), [side * 8.8, 1.3, bz], [0.7, 0.12, 2.2]));
        g.add(mesh(BOX, lambert(0x8b5a2b), [side * 9.1, 1.7, bz], [0.12, 0.7, 2.2]));
      }
      const sign = new THREE.Mesh(
        new THREE.PlaneGeometry(7, 1.2),
        new THREE.MeshBasicMaterial({
          map: canvasTexture('stationSign', 512, 88, (ctx, w, h) => {
            ctx.fillStyle = '#12326b';
            ctx.fillRect(0, 0, w, h);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 48px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('METRO CENTRAL', w / 2, h / 2 + 2);
          }),
        }),
      );
      sign.position.set(side * 4.9, 4.5, 0);
      sign.rotation.y = side > 0 ? -Math.PI / 2 : Math.PI / 2;
      g.add(sign);
      this.lamp(g, side * 11.5, 0);
      this.adBoard(g, side * 11.2, -12, Math.floor(rnd(0, 8)));
    }
    this.addBuildings(g, buildings, 14);
  }

  private addBridge(g: THREE.Group) {
    const steel = lambert(0xd9532b);
    for (const side of [-1, 1]) {
      g.add(mesh(BOX, steel, [side * 5.0, 1.4, 0], [0.35, 0.35, L])); // top chord
      g.add(mesh(BOX, steel, [side * 5.0, 0.1, 0], [0.35, 0.35, L])); // bottom chord
      for (let i = 0; i < 8; i++) {
        const z = -L / 2 + 2.5 + i * 5;
        g.add(mesh(BOX, steel, [side * 5.0, 0.75, z], [0.22, 1.5, 0.22]));
        const d = mesh(BOX, steel, [side * 5.0, 0.75, z + 2.5], [0.14, 1.7, 0.14]);
        d.rotation.x = 0.9;
        g.add(d);
      }
      g.add(mesh(BOX, lambert(0x3a3f4f), [side * 6.2, -0.4, 0], [3.0, 0.3, L]));
      this.lamp(g, side * 5.3, -L / 4);
      this.lamp(g, side * 5.3, L / 4);
    }
    // supports into the water
    for (const side of [-1, 1]) g.add(mesh(BOX, lambert(0x6b6f7d), [side * 3.5, -5, 0], [1.2, 9, 1.2]));
  }

  private addTunnel(g: THREE.Group) {
    const wall = lambert(0x3a3e50);
    const H = 7.4;
    for (const side of [-1, 1]) {
      g.add(mesh(BOX, wall, [side * (TRACK_HALF + 0.3), H / 2, 0], [0.6, H, L]));
      for (let i = 0; i < 4; i++) {
        g.add(mesh(BOX, basic(0xffe9a8), [side * (TRACK_HALF - 0.1), 4.2, -L / 2 + 5 + i * 10], [0.12, 0.35, 1.4]));
      }
    }
    g.add(mesh(BOX, lambert(0x2a2d3a), [0, H + 0.2, 0], [TRACK_HALF * 2 + 1.2, 0.5, L]));
    for (let i = 0; i < 4; i++) g.add(mesh(BOX, basic(0xfff3c4), [0, H - 0.2, -L / 2 + 5 + i * 10], [1.8, 0.1, 0.5]));
    // arch ribs
    for (let i = 0; i < 4; i++) g.add(mesh(BOX, lambert(0x555a70), [0, H - 0.05, -L / 2 + i * 10], [TRACK_HALF * 2 + 0.6, 0.45, 0.6]));
  }
}
