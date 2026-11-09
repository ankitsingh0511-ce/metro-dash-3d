import type { RunSummary } from '../game/GameStateManager';
import { click, useSave } from '../services';

interface Props {
  summary: RunSummary;
  onRestart: () => void;
  onHome: () => void;
  onRevive: () => void;
}

export default function GameOverScreen({ summary, onRestart, onHome, onRevive }: Props) {
  const s = useSave();
  const canAfford = s.totalCoins >= summary.reviveCost;
  return (
    <div className="overlay">
      <div className="panel">
        <h2>Busted!</h2>
        {summary.newBest && <div className="new-best">🏆 NEW BEST!</div>}
        <div className="stat-grid">
          <div>
            <span>Score</span>
            <b>{summary.score.toLocaleString()}</b>
          </div>
          <div>
            <span>Best</span>
            <b>{summary.best.toLocaleString()}</b>
          </div>
          <div>
            <span>Coins</span>
            <b>🪙 {summary.coins}</b>
          </div>
          <div>
            <span>Distance</span>
            <b>{summary.distance} m</b>
          </div>
        </div>

        {summary.canRevive && (
          <button className="btn revive" disabled={!canAfford} onClick={() => { click(); onRevive(); }}>
            ❤️ Revive · 🪙 {summary.reviveCost}
          </button>
        )}
        <button className="btn play" onClick={() => { click(); onRestart(); }}>🔄 Restart</button>
        <button className="btn secondary" onClick={() => { click(); onHome(); }}>🏠 Home</button>
      </div>
    </div>
  );
}
