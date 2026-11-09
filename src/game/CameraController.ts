import * as THREE from 'three';

/** Chase camera: follows lane position, widens FOV with speed, adapts distance to screen aspect, supports shake. */
export class CameraController {
  readonly camera = new THREE.PerspectiveCamera(72, 1, 0.1, 400);
  private shakeTime = 0;
  private shakeStrength = 0;
  private x = 0;
  private y = 5;
  private dist = 10;
  private fov = 72;
  private roll = 0;
  private look = new THREE.Vector3();
  private aspect = 1;
  private baseFov = 72;

  resize(w: number, h: number) {
    this.aspect = w / Math.max(1, h);
    this.camera.aspect = this.aspect;
    this.camera.updateProjectionMatrix();
  }

  shake(strength: number, time = 0.35) {
    this.shakeStrength = strength;
    this.shakeTime = time;
  }

  reset(playerX = 0) {
    this.x = playerX;
    this.y = 5;
    this.fov = this.baseFov;
    this.update(0.016, playerX, 0, 20, false, true);
  }

  update(dt: number, playerX: number, playerY: number, speed: number, jetpack: boolean, snap = false) {
    const k = snap ? 1 : Math.min(1, 6 * dt);
    this.x += (playerX * 0.6 - this.x) * k;

    // distance so ~8 m of track width is visible at the player on tall portrait screens
    const tanHalf = Math.tan(THREE.MathUtils.degToRad(this.baseFov / 2));
    const desiredDist = THREE.MathUtils.clamp(8.2 / (2 * tanHalf * this.aspect), 8.5, 13);
    this.dist += (desiredDist - this.dist) * k;

    const targetY = 0.5 * this.dist + 0.8 + (jetpack ? 1.4 : 0) + playerY * 0.35;
    this.y += (targetY - this.y) * Math.min(1, 3 * dt + (snap ? 1 : 0));

    const targetFov = this.baseFov + Math.min(10, Math.max(0, speed - 20) * 0.45);
    this.fov += (targetFov - this.fov) * k;
    if (Math.abs(this.camera.fov - this.fov) > 0.01) {
      this.camera.fov = this.fov;
      this.camera.updateProjectionMatrix();
    }

    let sx = 0;
    let sy = 0;
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const m = this.shakeStrength * Math.max(0, this.shakeTime / 0.35);
      sx = (Math.random() - 0.5) * m;
      sy = (Math.random() - 0.5) * m;
    }

    this.camera.position.set(this.x + sx, this.y + sy, this.dist);
    this.look.set(this.x * 0.7, 1.2 + playerY * 0.4, -10);
    this.camera.lookAt(this.look);
    const targetRoll = (playerX * 0.6 - this.x) * -0.03;
    this.roll += (targetRoll - this.roll) * k;
    this.camera.rotation.z += this.roll;
  }
}
