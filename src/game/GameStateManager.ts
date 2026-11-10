import type { PowerUpType } from './constants';

export type GamePhase = 'loading' | 'playing' | 'paused' | 'gameover';

export interface HudState {
  score: number;
  coins: number;
  distance: number;
  multiplier: number;
  danger: number; // 0..1 police proximity
  powerups: { type: PowerUpType; fraction: number }[];
  hoverboards: number;
  invulnerable: boolean;
}

export interface RunSummary {
  score: number;
  best: number;
  newBest: boolean;
  coins: number;
  distance: number;
  revivesUsed: number;
  reviveCost: number;
  canRevive: boolean;
}

export interface GameSnapshot {
  phase: GamePhase;
  hud: HudState;
  summary: RunSummary | null;
}

const EMPTY_HUD: HudState = { score: 0, coins: 0, distance: 0, multiplier: 1, danger: 0, powerups: [], hoverboards: 0, invulnerable: false };

type Listener = () => void;

/** Tiny observable store consumed by React via useSyncExternalStore. Snapshots are immutable and replaced on change. */
export class GameStateManager {
  private snap: GameSnapshot = { phase: 'loading', hud: EMPTY_HUD, summary: null };
  private listeners = new Set<Listener>();

  getSnapshot = (): GameSnapshot => this.snap;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private emit() {
    this.listeners.forEach((l) => l());
  }

  get phase(): GamePhase {
    return this.snap.phase;
  }

  setPhase(phase: GamePhase) {
    if (this.snap.phase === phase) return;
    this.snap = { ...this.snap, phase };
    this.emit();
  }

  setHud(hud: HudState) {
    this.snap = { ...this.snap, hud };
    this.emit();
  }

  setSummary(summary: RunSummary | null) {
    this.snap = { ...this.snap, summary };
    this.emit();
  }

  resetRun() {
    this.snap = { ...this.snap, hud: EMPTY_HUD, summary: null };
    this.emit();
  }
}
