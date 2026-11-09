export interface InputHandlers {
  left(): void;
  right(): void;
  up(): void;
  down(): void;
  pause(): void;
}

/**
 * Swipe + keyboard input. Swipes fire as soon as the finger travels past a threshold (not on release),
 * which makes lane changes feel instant, and the gesture origin resets so chained swipes work in one drag.
 */
export class InputController {
  private sx = 0;
  private sy = 0;
  private active = false;
  private pointerId = -1;
  private enabled = true;
  readonly threshold: number;

  constructor(private el: HTMLElement, private h: InputHandlers) {
    this.threshold = Math.max(22, Math.min(window.innerWidth, window.innerHeight) * 0.06);
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', this.down);
    el.addEventListener('pointermove', this.move);
    el.addEventListener('pointerup', this.up);
    el.addEventListener('pointercancel', this.up);
    window.addEventListener('keydown', this.key);
  }

  setEnabled(v: boolean) {
    this.enabled = v;
    if (!v) this.active = false;
  }

  private down = (e: PointerEvent) => {
    this.active = true;
    this.pointerId = e.pointerId;
    this.sx = e.clientX;
    this.sy = e.clientY;
    try {
      this.el.setPointerCapture(e.pointerId);
    } catch {
      /* not all environments support capture */
    }
  };

  private move = (e: PointerEvent) => {
    if (!this.active || e.pointerId !== this.pointerId || !this.enabled) return;
    const dx = e.clientX - this.sx;
    const dy = e.clientY - this.sy;
    const ax = Math.abs(dx);
    const ay = Math.abs(dy);
    if (Math.max(ax, ay) < this.threshold) return;
    if (ax > ay) (dx > 0 ? this.h.right : this.h.left)();
    else (dy > 0 ? this.h.down : this.h.up)();
    this.sx = e.clientX;
    this.sy = e.clientY;
  };

  private up = (e: PointerEvent) => {
    if (e.pointerId === this.pointerId) this.active = false;
  };

  private key = (e: KeyboardEvent) => {
    if (e.repeat) return;
    switch (e.code) {
      case 'Escape':
      case 'KeyP':
        this.h.pause();
        return;
    }
    if (!this.enabled) return;
    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        this.h.left();
        break;
      case 'ArrowRight':
      case 'KeyD':
        this.h.right();
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'Space':
        this.h.up();
        break;
      case 'ArrowDown':
      case 'KeyS':
        this.h.down();
        break;
      default:
        return;
    }
    e.preventDefault();
  };

  dispose() {
    this.el.removeEventListener('pointerdown', this.down);
    this.el.removeEventListener('pointermove', this.move);
    this.el.removeEventListener('pointerup', this.up);
    this.el.removeEventListener('pointercancel', this.up);
    window.removeEventListener('keydown', this.key);
  }
}
