import { MISSIONS } from '../data/catalog';
import { audio, click, save, useSave } from '../services';

export default function MissionScreen({ onBack }: { onBack: () => void }) {
  const s = useSave();

  const claim = (id: string, reward: number) => {
    if (save.state.completedMissions.includes(id)) return;
    audio.unlock();
    audio.play('reward');
    save.update((d) => {
      d.completedMissions.push(id);
      d.totalCoins += reward;
    });
  };

  const sorted = [...MISSIONS].sort((a, b) => Number(s.completedMissions.includes(a.id)) - Number(s.completedMissions.includes(b.id)));

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Missions</h2>
        <div className="chip coin">🪙 {s.totalCoins.toLocaleString()}</div>
      </header>
      <div className="list">
        {sorted.map((m) => {
          const progress = Math.min(m.target, Math.floor(s.stats[m.metric]));
          const done = s.completedMissions.includes(m.id);
          const ready = !done && progress >= m.target;
          return (
            <div className={`card ${done ? 'done' : ''}`} key={m.id}>
              <div className="card-body">
                <b>{m.title}</b>
                <div className="bar">
                  <div style={{ width: `${(progress / m.target) * 100}%` }} />
                </div>
                <small>
                  {progress.toLocaleString()} / {m.target.toLocaleString()}
                </small>
              </div>
              <button className="btn small" disabled={!ready} onClick={() => claim(m.id, m.reward)}>
                {done ? '✓' : ready ? `Claim 🪙 ${m.reward}` : `🪙 ${m.reward}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
