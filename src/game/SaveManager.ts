import { PowerUpType, Quality } from './constants';
import { CHARACTERS } from '../data/catalog';

export interface Settings {
  musicVolume: number; // 0..1
  sfxVolume: number; // 0..1
  muted: boolean;
  quality: Quality | 'auto';
  vibration: boolean;
}

export interface Stats {
  coins: number;
  distance: number;
  jumps: number;
  slides: number;
  laneChanges: number;
  powerups: number;
  runs: number;
  score: number; // best single-run score (mirrors bestScore for mission checks)
}

export interface LeaderboardEntry {
  score: number;
  coins: number;
  distance: number;
  date: string; // ISO
}

export interface SaveData {
  version: 1;
  totalCoins: number;
  bestScore: number;
  selectedCharacter: string;
  selectedOutfit: Record<string, number>;
  unlockedCharacters: string[];
  purchasedOutfits: string[]; // "charId:index"
  completedMissions: string[]; // ids whose reward has been claimed
  upgrades: Record<PowerUpType, number>;
  hoverboards: number;
  stats: Stats;
  leaderboard: LeaderboardEntry[];
  daily: { lastClaim: string; streak: number };
  settings: Settings;
}

export const STORAGE_KEY = 'metro-dash-3d/save-v1';

export function defaultSave(): SaveData {
  return {
    version: 1,
    totalCoins: 0,
    bestScore: 0,
    selectedCharacter: 'ankit',
    selectedOutfit: { ankit: 0 },
    unlockedCharacters: ['ankit'],
    purchasedOutfits: ['ankit:0'],
    completedMissions: [],
    upgrades: { magnet: 0, jetpack: 0, sneakers: 0, hoverboard: 0, multiplier: 0, booster: 0 },
    hoverboards: 0,
    stats: { coins: 0, distance: 0, jumps: 0, slides: 0, laneChanges: 0, powerups: 0, runs: 0, score: 0 },
    leaderboard: [],
    daily: { lastClaim: '', streak: 0 },
    settings: { musicVolume: 0.5, sfxVolume: 0.8, muted: false, quality: 'auto', vibration: true },
  };
}

type Listener = (d: SaveData) => void;

function merge<T>(base: T, incoming: unknown): T {
  if (incoming === null || typeof incoming !== 'object' || Array.isArray(base)) {
    return (incoming !== undefined && typeof incoming === typeof base ? incoming : base) as T;
  }
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const key of Object.keys(incoming as object)) {
    const b = (base as Record<string, unknown>)[key];
    const v = (incoming as Record<string, unknown>)[key];
    if (b === undefined) continue;
    if (Array.isArray(b)) out[key] = Array.isArray(v) ? v : b;
    else if (b !== null && typeof b === 'object') out[key] = merge(b, v);
    else if (typeof v === typeof b) out[key] = v;
  }
  return out as T;
}

/** localStorage-backed save. Works in browsers and in the Capacitor WebView (storage persists across launches). */
export class SaveManager {
  private data: SaveData;
  private listeners = new Set<Listener>();

  constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null = SaveManager.defaultStorage()) {
    this.data = this.load();
  }

  private static defaultStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch {
      return null;
    }
  }

  private load(): SaveData {
    const base = defaultSave();
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return base;
      const parsed = JSON.parse(raw) as Partial<SaveData>;
      const d = merge(base, parsed);
      // per-character outfit choices use dynamic keys, which merge() would otherwise drop
      for (const [k, v] of Object.entries(parsed.selectedOutfit ?? {})) if (typeof v === 'number') d.selectedOutfit[k] = v;
      return SaveManager.migrate(d);
    } catch {
      return base;
    }
  }

  /** Saves from the old roster (kai/zara/milo/rin) are mapped onto the new characters; coins, scores etc. are kept. */
  private static migrate(d: SaveData): SaveData {
    const valid = new Set(CHARACTERS.map((c) => c.id));
    d.unlockedCharacters = d.unlockedCharacters.filter((id) => valid.has(id));
    if (!d.unlockedCharacters.includes('ankit')) d.unlockedCharacters.unshift('ankit');
    d.purchasedOutfits = d.purchasedOutfits.filter((k) => valid.has(k.split(':')[0]));
    if (!d.purchasedOutfits.includes('ankit:0')) d.purchasedOutfits.unshift('ankit:0');
    for (const k of Object.keys(d.selectedOutfit)) if (!valid.has(k)) delete d.selectedOutfit[k];
    if (!valid.has(d.selectedCharacter) || !d.unlockedCharacters.includes(d.selectedCharacter)) d.selectedCharacter = 'ankit';
    return d;
  }

  get state(): SaveData {
    return this.data;
  }

  /** Mutate via callback, then persist and notify. */
  update(fn: (d: SaveData) => void) {
    fn(this.data);
    this.persist();
    this.listeners.forEach((l) => l(this.data));
  }

  subscribe(l: Listener) {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  persist() {
    try {
      this.storage?.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      /* storage full or unavailable: gameplay continues */
    }
  }

  addCoins(n: number) {
    this.update((d) => {
      d.totalCoins += n;
    });
  }

  /** Returns true when the purchase succeeded. */
  spend(cost: number): boolean {
    if (this.data.totalCoins < cost) return false;
    this.update((d) => {
      d.totalCoins -= cost;
    });
    return true;
  }

  recordRun(run: { score: number; coins: number; distance: number; jumps: number; slides: number; laneChanges: number; powerups: number }) {
    this.update((d) => {
      d.totalCoins += run.coins;
      d.bestScore = Math.max(d.bestScore, run.score);
      const s = d.stats;
      s.coins += run.coins;
      s.distance += run.distance;
      s.jumps += run.jumps;
      s.slides += run.slides;
      s.laneChanges += run.laneChanges;
      s.powerups += run.powerups;
      s.runs += 1;
      s.score = Math.max(s.score, run.score);
      d.leaderboard.push({ score: run.score, coins: run.coins, distance: Math.floor(run.distance), date: new Date().toISOString() });
      d.leaderboard.sort((a, b) => b.score - a.score);
      d.leaderboard = d.leaderboard.slice(0, 10);
    });
  }

  static todayKey(date = new Date()): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }
}
