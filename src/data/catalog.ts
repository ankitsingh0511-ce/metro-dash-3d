import { PowerUpType } from '../game/constants';

export interface Outfit {
  name: string;
  hoodie: number;
  pants: number;
  shoes: number;
  price: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  price: number;
  skin: number;
  hair: number;
  hairStyle: 'cap' | 'spiky' | 'beanie' | 'ponytail';
  outfits: Outfit[];
}

// Original characters. Add a new entry here (and optionally public/models/<id>.glb) to extend the roster.
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'kai',
    name: 'Kai',
    tagline: 'Rooftop runner from Eastside',
    price: 0,
    skin: 0xf0b98d,
    hair: 0x2b1b12,
    hairStyle: 'spiky',
    outfits: [
      { name: 'Street Orange', hoodie: 0xff7a1a, pants: 0x2f4a8a, shoes: 0xffffff, price: 0 },
      { name: 'Neon Mint', hoodie: 0x19d3a2, pants: 0x1c2233, shoes: 0xffe14d, price: 400 },
      { name: 'Night Violet', hoodie: 0x7a4dff, pants: 0x20202a, shoes: 0xff4d8d, price: 900 },
    ],
  },
  {
    id: 'zara',
    name: 'Zara',
    tagline: 'Graffiti artist, always on the move',
    price: 1500,
    skin: 0x8d5a3b,
    hair: 0x120c0c,
    hairStyle: 'ponytail',
    outfits: [
      { name: 'Sunset Pink', hoodie: 0xff4d8d, pants: 0x233048, shoes: 0xffffff, price: 0 },
      { name: 'Electric Blue', hoodie: 0x2d9bff, pants: 0xe9edf5, shoes: 0xff7a1a, price: 600 },
      { name: 'Lime Zest', hoodie: 0xb6f23a, pants: 0x20202a, shoes: 0x7a4dff, price: 1100 },
    ],
  },
  {
    id: 'milo',
    name: 'Milo',
    tagline: 'Courier who never misses a train',
    price: 3000,
    skin: 0xd99a6c,
    hair: 0x6b3a1e,
    hairStyle: 'beanie',
    outfits: [
      { name: 'Courier Teal', hoodie: 0x1fb5c9, pants: 0x3a3a46, shoes: 0xffe14d, price: 0 },
      { name: 'Crimson Run', hoodie: 0xe02b3a, pants: 0x14141c, shoes: 0xffffff, price: 800 },
      { name: 'Golden Hour', hoodie: 0xffc21a, pants: 0x2f4a8a, shoes: 0x14141c, price: 1400 },
    ],
  },
  {
    id: 'rin',
    name: 'Rin',
    tagline: 'Parkour champion from the harbour',
    price: 5000,
    skin: 0xf6d2b0,
    hair: 0x3d6bff,
    hairStyle: 'cap',
    outfits: [
      { name: 'Harbour Blue', hoodie: 0x3d6bff, pants: 0xf4f4f4, shoes: 0xff4d4d, price: 0 },
      { name: 'Chrome', hoodie: 0xc9d2e0, pants: 0x20202a, shoes: 0x19d3a2, price: 1000 },
      { name: 'Ember', hoodie: 0xff5a2a, pants: 0x3a1c14, shoes: 0xffe14d, price: 1800 },
    ],
  },
];

export const POLICE_OUTFIT = { hoodie: 0x1d3a8a, pants: 0x14203d, shoes: 0x0b0b10, skin: 0xe2ac80, hair: 0x1a1a1a };

export interface UpgradeDef {
  type: PowerUpType;
  /** seconds added per level */
  perLevel: number;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADES: UpgradeDef[] = [
  { type: 'magnet', perLevel: 2, maxLevel: 5, baseCost: 300 },
  { type: 'jetpack', perLevel: 1, maxLevel: 5, baseCost: 500 },
  { type: 'sneakers', perLevel: 2, maxLevel: 5, baseCost: 300 },
  { type: 'hoverboard', perLevel: 3, maxLevel: 5, baseCost: 400 },
  { type: 'multiplier', perLevel: 2, maxLevel: 5, baseCost: 600 },
  { type: 'booster', perLevel: 2, maxLevel: 5, baseCost: 500 },
];

export const upgradeCost = (u: UpgradeDef, level: number) => u.baseCost * (level + 1);

export const HOVERBOARD_ITEM_PRICE = 250;

export type MissionMetric = 'coins' | 'distance' | 'jumps' | 'slides' | 'laneChanges' | 'powerups' | 'runs' | 'score';

export interface MissionDef {
  id: string;
  title: string;
  metric: MissionMetric;
  target: number;
  reward: number;
}

// Lifetime-stat missions: progress comes from SaveData.stats
export const MISSIONS: MissionDef[] = [
  { id: 'm_coins_100', title: 'Collect 100 coins', metric: 'coins', target: 100, reward: 100 },
  { id: 'm_coins_1000', title: 'Collect 1,000 coins', metric: 'coins', target: 1000, reward: 400 },
  { id: 'm_dist_1000', title: 'Run 1,000 m in total', metric: 'distance', target: 1000, reward: 150 },
  { id: 'm_dist_10000', title: 'Run 10,000 m in total', metric: 'distance', target: 10000, reward: 600 },
  { id: 'm_jump_50', title: 'Jump 50 times', metric: 'jumps', target: 50, reward: 120 },
  { id: 'm_slide_50', title: 'Slide 50 times', metric: 'slides', target: 50, reward: 120 },
  { id: 'm_lane_100', title: 'Switch lanes 100 times', metric: 'laneChanges', target: 100, reward: 150 },
  { id: 'm_pu_10', title: 'Grab 10 power-ups', metric: 'powerups', target: 10, reward: 250 },
  { id: 'm_runs_10', title: 'Play 10 runs', metric: 'runs', target: 10, reward: 200 },
  { id: 'm_score_5000', title: 'Score 5,000 in one run', metric: 'score', target: 5000, reward: 300 },
  { id: 'm_score_25000', title: 'Score 25,000 in one run', metric: 'score', target: 25000, reward: 900 },
];

export const DAILY_REWARDS = [50, 100, 150, 200, 300, 400, 750];
