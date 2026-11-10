import {
  GRAVITY,
  JUMP_VELOCITY,
  LANES,
  LANE_SWITCH_SPEED,
  PLAYER_HEIGHT,
  PLAYER_SLIDE_HEIGHT,
  ROLL_TIME,
  SLIDE_TIME,
  SNEAKER_JUMP_VELOCITY,
} from './constants';
import type { CharacterRig } from './CharacterFactory';
import { PlayerAnimationController } from './PlayerAnimationController';
import type { PlayerBox } from './CollisionSystem';

export interface PlayerEvents {
  onJump?: () => void;
  onSlide?: () => void;
  onLand?: () => void;
  onLaneChange?: () => void;
}

export interface PlayerContext {
  jetpack: boolean;
  sneakers: boolean;
  hoverboard: boolean;
}

const JETPACK_HEIGHT = 4.2;

export type PlayerMode = 'running' | 'stumbling' | 'fallen' | 'celebrating';

export class PlayerController {
  lane = 1;
  x = 0;
  y = 0;
  private vy = 0;
  private slideTimer = 0;
  private rollTimer = 0;
  private slideQueued = false;
  private peakHeight = 0;
  private stumbleTimer = 0;
  mode: PlayerMode = 'running';
  grounded = true;
  anim: PlayerAnimationController;
  events: PlayerEvents = {};
  private ctx: PlayerContext = { jetpack: false, sneakers: false, hoverboard: false };

  constructor(public rig: CharacterRig) {
    this.anim = new PlayerAnimationController(rig);
    this.anim.play('run');
  }

  /** Swap in a different character rig (character selection) keeping the current state. */
  setRig(rig: CharacterRig) {
    this.anim.dispose();
    this.rig = rig;
    this.anim = new PlayerAnimationController(rig);
    this.anim.play('run', { force: true });
  }

  reset() {
    this.lane = 1;
    this.x = 0;
    this.y = 0;
    this.vy = 0;
    this.slideTimer = 0;
    this.rollTimer = 0;
    this.slideQueued = false;
    this.stumbleTimer = 0;
    this.mode = 'running';
    this.grounded = true;
    this.peakHeight = 0;
    this.rig.root.rotation.set(0, 0, 0);
    this.anim.play('run', { force: true, fade: 0 });
  }

  get sliding() {
    return this.slideTimer > 0;
  }

  get busy() {
    return this.mode !== 'running';
  }

  moveLeft() {
    this.changeLane(-1);
  }
  moveRight() {
    this.changeLane(1);
  }

  private changeLane(d: -1 | 1) {
    if (this.mode !== 'running') return;
    const next = this.lane + d;
    if (next < 0 || next > 2) return;
    this.lane = next;
    this.events.onLaneChange?.();
  }

  jump() {
    if (this.mode !== 'running' || this.ctx.jetpack) return;
    if (!this.grounded) return;
    this.slideTimer = 0;
    this.rollTimer = 0;
    this.slideQueued = false;
    this.vy = this.ctx.sneakers ? SNEAKER_JUMP_VELOCITY : JUMP_VELOCITY;
    this.grounded = false;
    this.peakHeight = 0;
    this.anim.play('jump', { duration: this.ctx.sneakers ? 0.95 : 0.76, fade: 0.06 });
    this.events.onJump?.();
  }

  slide() {
    if (this.mode !== 'running' || this.ctx.jetpack) return;
    if (!this.grounded) {
      // fast-fall: drop quickly and slide as soon as we land
      this.vy = Math.min(this.vy, -34);
      this.slideQueued = true;
      return;
    }
    this.startSlide();
  }

  private startSlide() {
    this.slideTimer = SLIDE_TIME;
    this.rollTimer = 0;
    this.anim.play('slide', { duration: SLIDE_TIME, fade: 0.05, force: true });
    this.events.onSlide?.();
  }

  stumble(duration = 0.55) {
    this.mode = 'stumbling';
    this.stumbleTimer = duration;
    this.slideTimer = 0;
    this.rollTimer = 0;
    this.anim.play('hit', { duration, force: true, fade: 0.04 });
  }

  fall() {
    this.mode = 'fallen';
    this.anim.play('fall', { force: true, fade: 0.05 });
  }

  celebrate() {
    this.mode = 'celebrating';
    this.y = 0;
    this.anim.play('victory', { force: true });
  }

  get box(): PlayerBox {
    const height = this.sliding ? PLAYER_SLIDE_HEIGHT : this.rollTimer > 0 ? 0.85 : PLAYER_HEIGHT;
    return { x: this.x, z: 0, y: this.y, height };
  }

  update(dt: number, ctx: PlayerContext) {
    const wasJet = this.ctx.jetpack;
    this.ctx = ctx;

    // --- lateral movement (smoothed) ---
    const targetX = LANES[this.lane];
    const dx = targetX - this.x;
    this.x += dx * Math.min(1, LANE_SWITCH_SPEED * dt);
    if (Math.abs(targetX - this.x) < 0.002) this.x = targetX;

    // --- vertical ---
    if (ctx.jetpack) {
      this.vy = 0;
      this.y += (JETPACK_HEIGHT - this.y) * Math.min(1, 4 * dt);
      this.grounded = false;
      this.slideTimer = 0;
      this.rollTimer = 0;
    } else if (this.mode === 'running' || this.mode === 'stumbling') {
      if (!this.grounded || this.y > 0) {
        this.vy += GRAVITY * dt;
        this.y += this.vy * dt;
        this.peakHeight = Math.max(this.peakHeight, this.y);
        if (this.y <= 0) {
          const hard = this.peakHeight > 2.4 || this.slideQueued;
          this.y = 0;
          this.vy = 0;
          this.grounded = true;
          this.events.onLand?.();
          if (this.mode === 'running') {
            if (this.slideQueued) {
              this.slideQueued = false;
              this.rollTimer = ROLL_TIME;
              this.anim.play('roll', { duration: ROLL_TIME, force: true, fade: 0.04 });
            } else if (hard) {
              this.rollTimer = ROLL_TIME;
              this.anim.play('roll', { duration: ROLL_TIME, force: true, fade: 0.04 });
            } else if (this.anim.current === 'jump') {
              this.anim.play('run', { fade: 0.1 });
            }
          }
        }
      }
    }
    if (wasJet && !ctx.jetpack) {
      this.vy = -4;
      this.grounded = false;
      this.peakHeight = 0;
    }

    // --- timers ---
    if (this.slideTimer > 0) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) this.anim.play(ctx.hoverboard ? 'hoverboard' : 'run', { fade: 0.1 });
    }
    if (this.rollTimer > 0) {
      this.rollTimer -= dt;
      if (this.rollTimer <= 0) this.anim.play(ctx.hoverboard ? 'hoverboard' : 'run', { fade: 0.1 });
    }
    if (this.mode === 'stumbling') {
      this.stumbleTimer -= dt;
      if (this.stumbleTimer <= 0) {
        this.mode = 'running';
        this.anim.play(ctx.hoverboard ? 'hoverboard' : 'run', { fade: 0.1 });
      }
    }

    // --- choose locomotion clip ---
    if (this.mode === 'running' && !this.sliding && this.rollTimer <= 0) {
      if (ctx.jetpack) this.anim.play('jetpack', { fade: 0.2 });
      else if (this.grounded) {
        const want = ctx.hoverboard ? 'hoverboard' : 'run';
        if (this.anim.current !== want) this.anim.play(want, { fade: 0.12 });
      }
    }

    // --- apply transform ---
    const root = this.rig.root;
    root.position.set(this.x, this.y, 0);
    const lateral = targetX - this.x;
    root.rotation.y = this.mode === 'fallen' ? 0 : Math.max(-0.5, Math.min(0.5, lateral * -0.22));
    root.rotation.z = Math.max(-0.35, Math.min(0.35, lateral * -0.12));
    this.rig.hoverboard.visible = ctx.hoverboard && !ctx.jetpack;
    this.rig.jetpack.visible = ctx.jetpack;
    this.anim.update(dt);
  }
}
