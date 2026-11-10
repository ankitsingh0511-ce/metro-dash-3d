import { POWERUP_INFO } from '../game/constants';
import type { HudState } from '../game/GameStateManager';

interface Props {
  hud: HudState;
  onPause: () => void;
  onUseHoverboard: () => void;
}

export default function GameHUD({ hud, onPause, onUseHoverboard }: Props) {
  return (
    <div className="hud">
      {hud.danger > 0.25 && <div className="danger-vignette" style={{ opacity: hud.danger }} />}
      <div className="hud-top">
        <div className="hud-block">
          <div className="hud-score">{hud.score.toLocaleString()}</div>
          <div className="hud-sub">
            {hud.distance} m {hud.multiplier > 1 && <span className="mult">x{hud.multiplier}</span>}
          </div>
        </div>
        <div className="hud-right">
          <div className="chip coin">🪙 {hud.coins}</div>
          <button className="icon-btn" aria-label="Pause" onClick={onPause}>
            ⏸
          </button>
        </div>
      </div>

      <div className="powerups">
        {hud.powerups.map((p) => (
          <div key={p.type} className="pu" style={{ borderColor: POWERUP_INFO[p.type].css }} title={POWERUP_INFO[p.type].label}>
            <span className="pu-icon">{POWERUP_INFO[p.type].icon}</span>
            <div className="pu-bar">
              <div style={{ width: `${Math.round(p.fraction * 100)}%`, background: POWERUP_INFO[p.type].css }} />
            </div>
          </div>
        ))}
      </div>

      {hud.hoverboards > 0 && !hud.powerups.some((p) => p.type === 'hoverboard') && (
        <button className="btn hover-btn" onClick={onUseHoverboard}>
          🛹 x{hud.hoverboards}
        </button>
      )}
    </div>
  );
}
