// Shared tuning constants and plain types (no Three.js imports so they are unit-testable in Node).

export const LANE_WIDTH = 2.4;
export const LANES = [-LANE_WIDTH, 0, LANE_WIDTH] as const;
export const SEGMENT_LENGTH = 40;
export const SPAWN_DISTANCE = 170; // how far ahead (-z) content is generated
export const DESPAWN_Z = 20; // behind the player where content is recycled

export const GRAVITY = -42;
export const JUMP_VELOCITY = 15.5;
export const SNEAKER_JUMP_VELOCITY = 21;
export const SLIDE_TIME = 0.75;
export const ROLL_TIME = 0.6;
export const LANE_SWITCH_SPEED = 16; // x units / s smoothing factor

export const PLAYER_HALF_WIDTH = 0.34;
export const PLAYER_HEIGHT = 1.65;
export const PLAYER_SLIDE_HEIGHT = 0.6;
export const PLAYER_HALF_DEPTH = 0.3;

export const BASE_SPEED = 20;
export const MAX_SPEED = 46;
export const SPEED_RAMP = 0.28; // speed gained per second

export const POLICE_START_GAP = 10;
export const POLICE_MAX_GAP = 15;
export const POLICE_STUMBLE_PENALTY = 6;
export const POLICE_RECOVER_RATE = 0.35; // m/s while running clean
export const POLICE_DODGE_BONUS = 0.5; // per obstacle passed

export type ObstacleType =
  | 'train'
  | 'movingTrain'
  | 'crate'
  | 'lowBarrier'
  | 'highBarrier'
  | 'constructionBarrier'
  | 'signal'
  | 'tunnelGate'
  | 'roadblock';

/** How the player is expected to deal with an obstacle. */
export type Counter = 'lane' | 'jump' | 'slide';

export interface ObstacleDef {
  type: ObstacleType;
  /** full width / height / depth of the collision box */
  w: number;
  h: number;
  d: number;
  /** bottom of the collision box above ground */
  y: number;
  counter: Counter;
  /** hitting it from the front is always fatal (trains). Others cause a stumble. */
  fatal: boolean;
  /** extra forward velocity (toward player) in m/s */
  velocity: number;
}

export const OBSTACLE_DEFS: Record<ObstacleType, ObstacleDef> = {
  train: { type: 'train', w: 2.0, h: 3.6, d: 14, y: 0, counter: 'lane', fatal: true, velocity: 0 },
  movingTrain: { type: 'movingTrain', w: 2.0, h: 3.6, d: 14, y: 0, counter: 'lane', fatal: true, velocity: 8 },
  crate: { type: 'crate', w: 1.7, h: 1.1, d: 1.4, y: 0, counter: 'jump', fatal: false, velocity: 0 },
  lowBarrier: { type: 'lowBarrier', w: 2.0, h: 0.85, d: 0.5, y: 0, counter: 'jump', fatal: false, velocity: 0 },
  highBarrier: { type: 'highBarrier', w: 2.0, h: 1.1, d: 0.5, y: 1.15, counter: 'slide', fatal: false, velocity: 0 },
  constructionBarrier: { type: 'constructionBarrier', w: 2.0, h: 1.2, d: 0.6, y: 0, counter: 'jump', fatal: false, velocity: 0 },
  signal: { type: 'signal', w: 2.2, h: 1.0, d: 0.6, y: 1.25, counter: 'slide', fatal: false, velocity: 0 },
  tunnelGate: { type: 'tunnelGate', w: 2.2, h: 1.2, d: 1.6, y: 1.2, counter: 'slide', fatal: false, velocity: 0 },
  roadblock: { type: 'roadblock', w: 2.0, h: 2.8, d: 0.9, y: 0, counter: 'lane', fatal: true, velocity: 0 },
};

export type PowerUpType = 'magnet' | 'jetpack' | 'sneakers' | 'hoverboard' | 'multiplier' | 'booster';

export const POWERUP_BASE_DURATION: Record<PowerUpType, number> = {
  magnet: 10,
  jetpack: 7,
  sneakers: 12,
  hoverboard: 20,
  multiplier: 15,
  booster: 10,
};

export const POWERUP_INFO: Record<PowerUpType, { label: string; icon: string; color: number; css: string }> = {
  magnet: { label: 'Coin Magnet', icon: '🧲', color: 0xff3d57, css: '#ff3d57' },
  jetpack: { label: 'Jetpack', icon: '🚀', color: 0xff9a1f, css: '#ff9a1f' },
  sneakers: { label: 'Super Sneakers', icon: '👟', color: 0x33d17a, css: '#33d17a' },
  hoverboard: { label: 'Hoverboard', icon: '🛹', color: 0x35c7ff, css: '#35c7ff' },
  multiplier: { label: 'Score x2', icon: '✖2', color: 0xb26bff, css: '#b26bff' },
  booster: { label: 'Score Booster', icon: '⚡', color: 0xffe14d, css: '#ffe14d' },
};

export type Quality = 'low' | 'medium' | 'high';
