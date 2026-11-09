import { DAILY_REWARDS } from '../data/catalog';
import { SaveManager } from '../game/SaveManager';
import { audio, click, save, useSave } from '../services';

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return SaveManager.todayKey(d);
}

export default function DailyRewardScreen({ onBack }: { onBack: () => void }) {
  const s = useSave();
  const today = SaveManager.todayKey();
  const claimedToday = s.daily.lastClaim === today;
  // streak continues only if the last claim was yesterday; otherwise it restarts at day 1
  const activeStreak = s.daily.lastClaim === today || s.daily.lastClaim === yesterdayKey() ? s.daily.streak : 0;
  // number of days already collected in the current 7-day cycle
  const takenCount = claimedToday ? ((activeStreak - 1) % DAILY_REWARDS.length) + 1 : activeStreak % DAILY_REWARDS.length;

  const claim = () => {
    if (claimedToday) return;
    const day = activeStreak % DAILY_REWARDS.length;
    audio.unlock();
    audio.play('reward');
    save.update((d) => {
      d.totalCoins += DAILY_REWARDS[day];
      d.daily.lastClaim = today;
      d.daily.streak = activeStreak + 1;
    });
  };

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Daily Rewards</h2>
        <div className="chip coin">🪙 {s.totalCoins.toLocaleString()}</div>
      </header>
      <p className="muted center">Come back every day to keep your streak going.</p>
      <div className="days">
        {DAILY_REWARDS.map((r, i) => {
          const taken = i < takenCount;
          const current = !claimedToday && i === takenCount;
          return (
            <div key={i} className={`day ${taken ? 'taken' : ''} ${current ? 'current' : ''}`}>
              <small>Day {i + 1}</small>
              <b>🪙 {r}</b>
              {taken && <span>✓</span>}
            </div>
          );
        })}
      </div>
      <button className="btn play" disabled={claimedToday} onClick={claim}>
        {claimedToday ? 'Come back tomorrow' : `Claim 🪙 ${DAILY_REWARDS[activeStreak % DAILY_REWARDS.length]}`}
      </button>
    </div>
  );
}
