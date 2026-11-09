import * as THREE from 'three';
import type { CharacterRig, ClipName } from './CharacterFactory';

const ONE_SHOT: ReadonlySet<ClipName> = new Set(['jump', 'slide', 'roll', 'fall', 'hit']);

/**
 * Drives a rig's skeletal animation with THREE.AnimationMixer, cross-fading between clips
 * (run, jump, slide, roll, fall, hit, hoverboard, jetpack, victory, idle).
 */
export class PlayerAnimationController {
  private mixer: THREE.AnimationMixer;
  private actions = new Map<ClipName, THREE.AnimationAction>();
  current: ClipName | null = null;
  private onFinished: ((name: ClipName) => void) | null = null;

  constructor(private rig: CharacterRig) {
    this.mixer = new THREE.AnimationMixer(rig.root);
    this.mixer.addEventListener('finished', (e) => {
      const clipName = (e as unknown as { action: THREE.AnimationAction }).action.getClip().name as ClipName;
      this.onFinished?.(clipName);
    });
  }

  private action(name: ClipName): THREE.AnimationAction | null {
    let a = this.actions.get(name);
    if (!a) {
      const clip = this.rig.clips.get(name) ?? (name !== 'run' ? this.rig.clips.get('run') : undefined);
      if (!clip) return null;
      a = this.mixer.clipAction(clip);
      if (ONE_SHOT.has(name)) {
        a.setLoop(THREE.LoopOnce, 1);
        a.clampWhenFinished = true;
      } else {
        a.setLoop(THREE.LoopRepeat, Infinity);
      }
      this.actions.set(name, a);
    }
    return a;
  }

  /** Play a clip. `duration` (seconds) stretches/compresses it so one-shots match gameplay timing. */
  play(name: ClipName, opts: { fade?: number; duration?: number; speed?: number; force?: boolean } = {}) {
    if (this.current === name && !opts.force) {
      if (opts.speed !== undefined) this.action(name)?.setEffectiveTimeScale(opts.speed);
      return;
    }
    const next = this.action(name);
    if (!next) return;
    const prev = this.current ? this.actions.get(this.current) : null;
    const fade = opts.fade ?? 0.12;
    next.reset();
    const clipLen = next.getClip().duration;
    next.setEffectiveTimeScale(opts.duration ? clipLen / opts.duration : opts.speed ?? 1);
    next.setEffectiveWeight(1);
    next.play();
    if (prev && prev !== next) next.crossFadeFrom(prev, fade, false);
    this.current = name;
  }

  setFinishedListener(fn: ((name: ClipName) => void) | null) {
    this.onFinished = fn;
  }

  update(dt: number) {
    this.mixer.update(dt);
  }

  dispose() {
    this.mixer.stopAllAction();
    this.mixer.uncacheRoot(this.rig.root);
  }
}
