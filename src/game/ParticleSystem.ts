import * as THREE from 'three';

const MAX = 220;
const STREAKS = 22;

/** Pooled InstancedMesh particles (coin sparkles, dust, hit stars) plus camera-speed streaks. */
export class ParticleSystem {
  readonly root = new THREE.Group();
  private mesh: THREE.InstancedMesh;
  private streakMesh: THREE.InstancedMesh;
  private p = Array.from({ length: MAX }, () => ({ life: 0, max: 1, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, size: 0.1, grav: 0 }));
  private cursor = 0;
  private m = new THREE.Matrix4();
  private c = new THREE.Color();
  private streaks = Array.from({ length: STREAKS }, () => ({ x: 0, y: 0, z: 0 }));
  private zero = new THREE.Matrix4().makeScale(0, 0, 0);

  constructor(scene: THREE.Scene) {
    this.mesh = new THREE.InstancedMesh(new THREE.OctahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }), MAX);
    this.mesh.frustumCulled = false;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
    for (let i = 0; i < MAX; i++) this.mesh.setMatrixAt(i, this.zero);
    this.root.add(this.mesh);

    this.streakMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false }), STREAKS);
    this.streakMesh.frustumCulled = false;
    this.root.add(this.streakMesh);
    for (const s of this.streaks) this.respawnStreak(s, true);
    scene.add(this.root);
  }

  private respawnStreak(s: { x: number; y: number; z: number }, anywhere = false) {
    const side = Math.random() < 0.5 ? -1 : 1;
    s.x = side * (2.5 + Math.random() * 5);
    s.y = 0.5 + Math.random() * 5;
    s.z = anywhere ? -Math.random() * 80 : -80 - Math.random() * 20;
  }

  burst(x: number, y: number, z: number, color: number, count = 10, speed = 3, grav = -8, size = 0.09) {
    this.c.set(color);
    for (let i = 0; i < count; i++) {
      const idx = this.cursor++ % MAX;
      const q = this.p[idx];
      const a = Math.random() * Math.PI * 2;
      const e = Math.random() * Math.PI - Math.PI / 2;
      q.x = x;
      q.y = y;
      q.z = z;
      q.vx = Math.cos(a) * Math.cos(e) * speed * (0.4 + Math.random());
      q.vy = Math.sin(e) * speed * (0.4 + Math.random()) + speed * 0.4;
      q.vz = Math.sin(a) * Math.cos(e) * speed * (0.4 + Math.random());
      q.life = q.max = 0.4 + Math.random() * 0.4;
      q.size = size * (0.6 + Math.random() * 0.8);
      q.grav = grav;
      this.mesh.setColorAt(idx, this.c);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Running dust behind the feet. */
  dust(x: number, z: number) {
    this.burst(x, 0.08, z + 0.3, 0xcfc6b5, 2, 1.2, 1.5, 0.12);
  }

  scroll(dz: number) {
    for (const q of this.p) if (q.life > 0) q.z += dz;
  }

  update(dt: number, speed: number, cameraX: number) {
    for (let i = 0; i < MAX; i++) {
      const q = this.p[i];
      if (q.life <= 0) continue;
      q.life -= dt;
      if (q.life <= 0) {
        this.mesh.setMatrixAt(i, this.zero);
        continue;
      }
      q.vy += q.grav * dt;
      q.x += q.vx * dt;
      q.y = Math.max(0.02, q.y + q.vy * dt);
      q.z += q.vz * dt;
      const s = q.size * (q.life / q.max);
      this.m.makeScale(s, s, s);
      this.m.setPosition(q.x, q.y, q.z);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;

    // speed streaks: visible only when fast
    const strength = Math.max(0, (speed - 26) / 20);
    (this.streakMesh.material as THREE.MeshBasicMaterial).opacity = Math.min(0.5, strength * 0.5);
    this.streakMesh.visible = strength > 0.01;
    if (this.streakMesh.visible) {
      for (let i = 0; i < STREAKS; i++) {
        const s = this.streaks[i];
        s.z += speed * 1.5 * dt;
        if (s.z > 12) this.respawnStreak(s);
        this.m.makeScale(1, 1, 4 + speed * 0.25);
        this.m.setPosition(s.x + cameraX * 0.3, s.y, s.z);
        this.streakMesh.setMatrixAt(i, this.m);
      }
      this.streakMesh.instanceMatrix.needsUpdate = true;
    }
  }

  clear() {
    for (let i = 0; i < MAX; i++) {
      this.p[i].life = 0;
      this.mesh.setMatrixAt(i, this.zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
