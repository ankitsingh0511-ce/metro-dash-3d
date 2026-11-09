import { click, useSave } from '../services';

/** Local (on-device) top-10 leaderboard. */
export default function LeaderboardScreen({ onBack }: { onBack: () => void }) {
  const s = useSave();
  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Leaderboard</h2>
        <span />
      </header>
      <p className="muted center">Your best runs on this device</p>
      <div className="list">
        {s.leaderboard.length === 0 && <div className="card"><div className="card-body"><b>No runs yet</b><small>Play a round to set your first record.</small></div></div>}
        {s.leaderboard.map((e, i) => (
          <div className="card" key={e.date + i}>
            <div className="rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}</div>
            <div className="card-body">
              <b>{e.score.toLocaleString()}</b>
              <small>
                {e.distance} m · 🪙 {e.coins} · {new Date(e.date).toLocaleDateString()}
              </small>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
