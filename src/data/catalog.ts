import { PowerUpType } from '../game/constants';

export interface Outfit {
  name: string;
  /** colour of the top layer (hoodie / puffer jacket / tee) */
  hoodie: number;
  pants: number;
  shoes: number;
  price: number;
}

/** Per-character look details used by the in-game 3D rig (see CharacterFactory). */
export interface CharacterStyle {
  top: 'hoodie' | 'puffer' | 'tee';
  /** shirt visible under an open jacket */
  inner?: number;
  /** colour of stripes down the sleeves (hoodie) */
  sleeveStripe?: number;
  /** horizontal stripes on the tee, [a, b] */
  stripes?: [number, number];
  /** text printed on the chest */
  print?: string;
  headband?: number;
  beard?: boolean;
  chain?: boolean;
  earbuds?: boolean;
  watch: number;
  sole: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  price: number;
  skin: number;
  hair: number;
  hairStyle: 'cap' | 'spiky' | 'beanie' | 'ponytail' | 'curly' | 'swept' | 'wavy';
  style: CharacterStyle;
  outfits: Outfit[];
}

// Roster from the supplied character sheets. Artwork lives in public/art/chars/<id>_*.jpg (see src/data/art.ts).
// Optionally drop public/models/<id>.glb to replace the in-game 3D rig with a real model.
export const CHARACTERS: CharacterDef[] = [
  {
    id: 'ankit',
    name: 'Ankit',
    tagline: 'Headband hero of the Metro Dash crew',
    price: 0,
    skin: 0xc98d63,
    hair: 0x2e1c12,
    hairStyle: 'curly',
    style: { top: 'hoodie', inner: 0xcdb998, sleeveStripe: 0xe9dfd0, headband: 0xd8c7a4, beard: true, chain: true, watch: 0x1a1a1f, sole: 0xf1f1f1 },
    outfits: [
      { name: 'Signature', hoodie: 0x1f1f25, pants: 0x1d1d22, shoes: 0x3a3a42, price: 0 },
      { name: 'Neon Mint', hoodie: 0x19d3a2, pants: 0x1c2233, shoes: 0xffe14d, price: 400 },
      { name: 'Night Violet', hoodie: 0x7a4dff, pants: 0x20202a, shoes: 0xff4d8d, price: 900 },
    ],
  },
  {
    id: 'arya',
    name: 'Arya',
    tagline: 'Mood on, music up, never slows down',
    price: 1500,
    skin: 0xd9a272,
    hair: 0x1a1013,
    hairStyle: 'ponytail',
    style: { top: 'tee', print: 'MOOD', watch: 0x1a1a1f, sole: 0xffffff },
    outfits: [
      { name: 'Signature', hoodie: 0xd81b60, pants: 0x25212a, shoes: 0xe84a8a, price: 0 },
      { name: 'Electric Blue', hoodie: 0x2d9bff, pants: 0xe9edf5, shoes: 0xff7a1a, price: 600 },
      { name: 'Lime Zest', hoodie: 0xb6f23a, pants: 0x20202a, shoes: 0x7a4dff, price: 1100 },
    ],
  },
  {
    id: 'aman',
    name: 'Aman',
    tagline: 'Puffer-jacket speedster with the killer style',
    price: 3000,
    skin: 0xc58a5e,
    hair: 0x1b1210,
    hairStyle: 'swept',
    style: { top: 'puffer', inner: 0x1c1c20, print: 'KILLER', beard: true, earbuds: true, watch: 0x1a1a1f, sole: 0xf1f1f1 },
    outfits: [
      { name: 'Signature', hoodie: 0x8a9a56, pants: 0x1f1a1a, shoes: 0x8f8a95, price: 0 },
      { name: 'Crimson Run', hoodie: 0xe02b3a, pants: 0x14141c, shoes: 0xffffff, price: 800 },
      { name: 'Golden Hour', hoodie: 0xffc21a, pants: 0x2f4a8a, shoes: 0x14141c, price: 1400 },
    ],
  },
  {
    id: 'aashi',
    name: 'Aashi',
    tagline: 'Curly-haired sprinter in stripes',
    price: 5000,
    skin: 0xdda070,
    hair: 0x3a2218,
    hairStyle: 'wavy',
    style: { top: 'tee', stripes: [0xd9405c, 0xf6e6ea], watch: 0xd0507e, sole: 0xffffff },
    outfits: [
      { name: 'Signature', hoodie: 0xd9405c, pants: 0x2b2224, shoes: 0xc2407a, price: 0 },
      { name: 'Ocean Stripes', hoodie: 0x2d7fd9, pants: 0x20202a, shoes: 0xffffff, price: 1000 },
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
