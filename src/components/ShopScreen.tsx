import { useState } from 'react';
import { HOVERBOARD_ITEM_PRICE, UPGRADES, upgradeCost } from '../data/catalog';
import { POWERUP_BASE_DURATION, POWERUP_INFO } from '../game/constants';
import { audio, click, save, useSave } from '../services';

export default function ShopScreen({ onBack }: { onBack: () => void }) {
  const s = useSave();
  const [msg, setMsg] = useState('');

  const buyUpgrade = (type: (typeof UPGRADES)[number]['type']) => {
    const u = UPGRADES.find((x) => x.type === type)!;
    const level = s.upgrades[type];
    if (level >= u.maxLevel) return;
    if (!save.spend(upgradeCost(u, level))) return setMsg('Not enough coins');
    audio.play('powerup');
    save.update((d) => {
      d.upgrades[type] += 1;
    });
    setMsg(`${POWERUP_INFO[type].label} upgraded!`);
  };

  const buyBoard = () => {
    if (!save.spend(HOVERBOARD_ITEM_PRICE)) return setMsg('Not enough coins');
    audio.play('powerup');
    save.update((d) => {
      d.hoverboards += 1;
    });
    setMsg('Hoverboard added. Use it from the in-game button.');
  };

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Shop</h2>
        <div className="chip coin">🪙 {s.totalCoins.toLocaleString()}</div>
      </header>

      <div className="list">
        <div className="card">
          <div className="card-icon">🛹</div>
          <div className="card-body">
            <b>Hoverboard</b>
            <small>Own {s.hoverboards}. Tap the 🛹 button during a run to ride one and survive a crash.</small>
          </div>
          <button className="btn small" disabled={s.totalCoins < HOVERBOARD_ITEM_PRICE} onClick={buyBoard}>
            🪙 {HOVERBOARD_ITEM_PRICE}
          </button>
        </div>

        {UPGRADES.map((u) => {
          const level = s.upgrades[u.type];
          const maxed = level >= u.maxLevel;
          const cost = upgradeCost(u, level);
          const info = POWERUP_INFO[u.type];
          return (
            <div className="card" key={u.type}>
              <div className="card-icon">{info.icon}</div>
              <div className="card-body">
                <b>{info.label}</b>
                <small>
                  {POWERUP_BASE_DURATION[u.type] + u.perLevel * level}s · Level {level}/{u.maxLevel}
                </small>
                <div className="pips">
                  {Array.from({ length: u.maxLevel }, (_, i) => (
                    <i key={i} className={i < level ? 'on' : ''} />
                  ))}
                </div>
              </div>
              <button className="btn small" disabled={maxed || s.totalCoins < cost} onClick={() => buyUpgrade(u.type)}>
                {maxed ? 'MAX' : `🪙 ${cost}`}
              </button>
            </div>
          );
        })}
      </div>
      <div className="toast-line">{msg}</div>
    </div>
  );
}
