import * as THREE from 'three';
import { POLICE_DODGE_BONUS, POLICE_MAX_GAP, POLICE_RECOVER_RATE, POLICE_START_GAP, POLICE_STUMBLE_PENALTY } from './constants';
import { createPoliceDog, createPoliceOfficer, CharacterRig, DogRig } from './CharacterFactory';
import { PlayerAnimationController } from './PlayerAnimationController';
import { basic } from './Assets';

/**
 * The officer (and optional dog) chase from behind (+z). `gap` is the distance in metres between
 * officer and player. Collisions shrink it, clean running grows it, and gap <= 0 means the player is caught.
 */
export class PoliceChaseController {
  readonly group = new THREE.Group();
  private officer: CharacterRig;
  private officerAnim: PlayerAnimationController;
  private dog: DogRig;
  private dogMixer: THREE.AnimationMixer;
  private siren: THREE.Mesh[] = [];
  gap = POLICE_START_GAP;
  private displayGap = POLICE_START_GAP;
  private x = 0;
  private dogX = 1.1;
  private time = 0;
  private whistleTimer = 2;
  private caught = false;
  dogEnabled = true;
  onWhistle?: () => void;

  constructor() {
    this.officer = createPoliceOfficer();
    this.officerAnim = new PlayerAnimationController(this.officer);
    this.officerAnim.play('run');
    this.group.add(this.officer.root);

    // flashing siren bar on the officer's shoulder radio (red/blue)
    for (const [i, c] of [0xff2a2a, 0x2a6bff].entries()) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), basic(c));
      s.position.set(i === 0 ? -0.08 : 0.08, 1.75, 0.0);
      this.officer.root.add(s);
      this.siren.push(s);
    }

    this.dog = createPoliceDog();
    this.dogMixer = new THREE.AnimationMixer(this.dog.root);
    this.dogMixer.clipAction(this.dog.clips.get('run')!).play();
    this.group.add(this.dog.root);
  }

  reset() {
    this.gap = POLICE_START_GAP;
    this.displayGap = POLICE_START_GAP;
    this.caught = false;
    this.x = 0;
    this.whistleTimer = 2;
    this.officer.root.rotation.set(0, 0, 0);
    this.officerAnim.play('run', { force: true, fade: 0 });
    this.group.visible = true;
  }

  /** Player hit a non-fatal obstacle. Returns true if that caught them. */
  hit(): boolean {
    this.gap -= POLICE_STUMBLE_PENALTY;
    this.whistleTimer = 0; // whistle immediately
    if (this.gap <= 0) {
      this.gap = 0;
      this.caught = true;
    }
    return this.caught;
  }

  /** Called when the player clears an obstacle (it scrolled past without a collision). */
  dodged(n = 1) {
    this.gap = Math.min(POLICE_MAX_GAP, this.gap + POLICE_DODGE_BONUS * n);
  }

  get isCaught() {
    return this.caught;
  }

  /** 0 (safe) .. 1 (about to be caught) for HUD effects. */
  get danger(): number {
    return Math.max(0, Math.min(1, 1 - (this.gap - 1) / 7));
  }

  /** Move the officer next to the player and play the grab animation. */
  startCatch() {
    this.caught = true;
    this.gap = 0;
    this.officerAnim.play('jump', { duration: 0.6, force: true });
  }

  update(dt: number, playerX: number, playing: boolean) {
    this.time += dt;
    if (playing && !this.caught) {
      this.gap = Math.min(POLICE_MAX_GAP, this.gap + POLICE_RECOVER_RATE * dt);
      this.whistleTimer -= dt;
      if (this.whistleTimer <= 0) {
        if (this.gap < 6) this.onWhistle?.();
        this.whistleTimer = this.gap < 6 ? 2.2 : 6;
      }
    }
    // ease display distance for smooth movement
    this.displayGap += (this.gap - this.displayGap) * Math.min(1, 6 * dt);
    this.x += (playerX - this.x) * Math.min(1, 3.5 * dt);
    this.dogX += (playerX + (playerX > 0 ? -1.2 : 1.2) - this.dogX) * Math.min(1, 3 * dt);

    this.officer.root.position.set(this.x, 0, this.displayGap);
    this.officer.root.rotation.y = Math.PI * 0 + Math.max(-0.3, Math.min(0.3, (playerX - this.x) * -0.2));
    this.officerAnim.update(dt);

    this.dog.root.visible = this.dogEnabled;
    this.dog.root.position.set(this.dogX, 0, this.displayGap - 2.2);
    this.dogMixer.update(dt);

    // siren flash
    const flash = Math.sin(this.time * 14) > 0;
    this.siren[0].visible = flash;
    this.siren[1].visible = !flash;
  }

  dispose() {
    this.officerAnim.dispose();
    this.dogMixer.stopAllAction();
    this.officer.dispose();
  }
}
