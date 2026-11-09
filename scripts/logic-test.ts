// Headless logic tests for the Three.js-free parts of the game. Run with: npm run test:logic
import { PatternGenerator, mulberry32, Row } from '../src/game/PatternGenerator';
import { OBSTACLE_DEFS, BASE_SPEED, MAX_SPEED } from '../src/game/constants';
import { CollisionSystem, Box } from '../src/game/CollisionSystem';
import { ScoreSystem } from '../src/game/ScoreSystem';
import { SaveManager, defaultSave, STORAGE_KEY } from '../src/game/SaveManager';

let failed = 0;
const check = (name: string, cond: boolean, extra = '') => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);
  if (!cond) failed++;
};

// ---------- 1. Pattern fairness over many seeds ----------
{
  let rows = 0;
  let unfairLane = 0;
  let jumpTooFar = 0;
  let gapTooSmall = 0;
  let comboTooTight = 0;
  let movingInRecentSafe = 0;
  const typeCount: Record<string, number> = {};
  for (let seed = 1; seed <= 300; seed++) {
    const gen = new PatternGenerator(mulberry32(seed));
    let end = 0;
    let dist = 0;
    let prev: Row | null = null;
    const recent: number[] = [];
    for (let i = 0; i < 120; i++) {
      const speed = Math.min(MAX_SPEED, BASE_SPEED + dist * 0.01);
      const row = gen.nextRow(end, speed, dist);
      rows++;
      // safe lane never holds a lane-only (fatal) obstacle at any offset
      for (const o of row.obstacles) {
        typeCount[o.type] = (typeCount[o.type] ?? 0) + 1;
        if (o.lane === row.safeLane && OBSTACLE_DEFS[o.type].counter === 'lane') unfairLane++;
        if (o.type === 'movingTrain' && recent.includes(o.lane)) movingInRecentSafe++;
      }
      // sequential safe lanes within 1 step
      if (prev && Math.abs(prev.safeLane - row.safeLane) > 1) jumpTooFar++;
      // physical gap check
      if (prev && row.z - (prev.z + prev.length) < PatternGenerator.minGap(speed) - 1e-6) gapTooSmall++;
      // combo spacing in safe lane
      const inSafe = row.obstacles.filter((o) => o.lane === row.safeLane).sort((a, b) => a.offset - b.offset);
      for (let k = 1; k < inSafe.length; k++) if (inSafe[k].offset - inSafe[k - 1].offset < speed * 0.9) comboTooTight++;
      recent.push(row.safeLane);
      if (recent.length > 3) recent.shift();
      end = row.z + row.length;
      dist += 40;
      prev = row;
    }
  }
  check('pattern: safe lane never blocked by lane-only obstacle', unfairLane === 0, `(${rows} rows)`);
  check('pattern: consecutive safe lanes <= 1 apart', jumpTooFar === 0);
  check('pattern: row gaps respect speed-based minimum', gapTooSmall === 0);
  check('pattern: jump->slide combos spaced for physics', comboTooTight === 0);
  check('pattern: moving trains never sweep a recent safe lane', movingInRecentSafe === 0);
  const expected = Object.keys(OBSTACLE_DEFS).filter((t) => t !== 'movingTrain' || true);
  const missing = expected.filter((t) => !typeCount[t]);
  check('pattern: every obstacle type gets generated', missing.length === 0, missing.length ? 'missing: ' + missing.join(',') : JSON.stringify(typeCount));
}

// ---------- 2. Physics reachability: jump clears jump obstacles, slide clears slide obstacles ----------
{
  const g = -42;
  const v0 = 15.5;
  const apex = (v0 * v0) / (2 * -g);
  const airtime = (2 * v0) / -g;
  const tallestJump = Math.max(...Object.values(OBSTACLE_DEFS).filter((d) => d.counter === 'jump').map((d) => d.h));
  check('physics: jump apex clears tallest jump obstacle', apex > tallestJump + 0.5, `apex=${apex.toFixed(2)} tallest=${tallestJump}`);
  const lowestSlide = Math.min(...Object.values(OBSTACLE_DEFS).filter((d) => d.counter === 'slide').map((d) => d.y));
  check('physics: slide height fits under slide obstacles', 0.6 < lowestSlide - 0.1, `lowest underside=${lowestSlide}`);
  const standingHits = lowestSlide < 1.65;
  check('physics: standing player is blocked by slide obstacles (so sliding is required)', standingHits);
  // jump must carry the player over the obstacle's depth at top speed
  const maxDepth = Math.max(...Object.values(OBSTACLE_DEFS).filter((d) => d.counter === 'jump').map((d) => d.d));
  check('physics: airtime covers obstacle depth at max speed', airtime * MAX_SPEED > maxDepth + 3, `air distance=${(airtime * MAX_SPEED).toFixed(1)}m`);
}

// ---------- 3. Collision ----------
{
  const crate = OBSTACLE_DEFS.crate;
  const box = (def: typeof crate, x: number, z: number): { box: Box } => ({ box: { cx: x, cz: z, y: def.y, w: def.w, h: def.h, d: def.d } });
  const ob = [box(crate, 0, 0)];
  check('collision: running into a crate hits', CollisionSystem.firstHit({ x: 0, z: 0, y: 0, height: 1.65 }, ob) !== null);
  check('collision: jumping over a crate misses', CollisionSystem.firstHit({ x: 0, z: 0, y: 1.4, height: 1.65 }, ob) === null);
  check('collision: other lane misses', CollisionSystem.firstHit({ x: 2.4, z: 0, y: 0, height: 1.65 }, ob) === null);
  const hb = [box(OBSTACLE_DEFS.highBarrier, 0, 0)];
  check('collision: standing hits high barrier', CollisionSystem.firstHit({ x: 0, z: 0, y: 0, height: 1.65 }, hb) !== null);
  check('collision: sliding passes under high barrier', CollisionSystem.firstHit({ x: 0, z: 0, y: 0, height: 0.6 }, hb) === null);
  check('collision: coin pickup in range', CollisionSystem.coinHit({ x: 0, z: 0, y: 0, height: 1.65 }, 0.2, 1, 0.1));
  check('collision: coin in other lane not picked', !CollisionSystem.coinHit({ x: 0, z: 0, y: 0, height: 1.65 }, 2.4, 1, 0));
}

// ---------- 4. Score ----------
{
  const s = new ScoreSystem();
  s.addDistance(100);
  check('score: 100 m = 100 points at x1', s.displayScore === 100);
  s.addCoin();
  check('score: coin adds 1 coin and 5 points', s.coins === 1 && s.displayScore === 105);
  s.setPowerups(true, false);
  const before = s.score;
  s.addDistance(10);
  check('score: multiplier power-up doubles gain', Math.abs(s.score - before - 20) < 1e-9);
  s.setPowerups(false, true);
  s.addCoin();
  check('score: booster doubles coin value', s.coins === 3);
  s.reset();
  s.addDistance(1700);
  check('score: base multiplier grows with distance', s.baseMultiplier === 3);
}

// ---------- 5. Save persistence ----------
{
  const mem: Record<string, string> = {};
  const storage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) };
  const a = new SaveManager(storage);
  a.recordRun({ score: 1234, coins: 42, distance: 500, jumps: 3, slides: 2, laneChanges: 9, powerups: 1 });
  a.update((d) => {
    d.selectedCharacter = 'zara';
    d.unlockedCharacters.push('zara');
    d.settings.muted = true;
  });
  const b = new SaveManager(storage); // simulates app restart
  check('save: coins persist', b.state.totalCoins === 42);
  check('save: best score persists', b.state.bestScore === 1234);
  check('save: selected character + unlocks persist', b.state.selectedCharacter === 'zara' && b.state.unlockedCharacters.includes('zara'));
  check('save: settings persist', b.state.settings.muted === true);
  check('save: spend fails when poor, succeeds when rich', !b.spend(100) && b.spend(40) && b.state.totalCoins === 2);
  mem[STORAGE_KEY] = '{broken json';
  const c = new SaveManager(storage);
  check('save: corrupt data falls back to defaults', c.state.totalCoins === defaultSave().totalCoins);
  mem[STORAGE_KEY] = JSON.stringify({ totalCoins: 7, settings: { muted: true } });
  const d = new SaveManager(storage);
  check('save: partial data is merged with defaults', d.state.totalCoins === 7 && d.state.settings.sfxVolume === 0.8 && d.state.settings.muted);
}

console.log(failed === 0 ? '\nALL LOGIC TESTS PASSED' : `\n${failed} TEST(S) FAILED`);
process.exit(failed === 0 ? 0 : 1);
