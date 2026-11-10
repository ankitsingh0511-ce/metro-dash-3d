import { useState } from 'react';
import { defaultSave } from '../game/SaveManager';
import { audio, click, save, useSave } from '../services';

export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const s = useSave();
  const [confirm, setConfirm] = useState(false);

  const apply = () => audio.setVolumes(save.state.settings.musicVolume, save.state.settings.sfxVolume, save.state.settings.muted);
  const set = (fn: (st: typeof s.settings) => void) => {
    save.update((d) => fn(d.settings));
    apply();
  };

  const reset = () => {
    save.update((d) => {
      Object.assign(d, defaultSave());
    });
    apply();
    setConfirm(false);
  };

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Settings</h2>
        <span />
      </header>
      <div className="list">
        <div className="card col">
          <label className="row">
            <span>🎵 Music</span>
            <input type="range" min={0} max={1} step={0.05} value={s.settings.musicVolume} onChange={(e) => set((st) => (st.musicVolume = Number(e.target.value)))} />
          </label>
          <label className="row">
            <span>🔊 Effects</span>
            <input type="range" min={0} max={1} step={0.05} value={s.settings.sfxVolume} onChange={(e) => { set((st) => (st.sfxVolume = Number(e.target.value))); audio.unlock(); audio.play('coin'); }} />
          </label>
          <label className="row">
            <span>🔇 Mute all</span>
            <input type="checkbox" checked={s.settings.muted} onChange={(e) => set((st) => (st.muted = e.target.checked))} />
          </label>
        </div>

        <div className="card col">
          <label className="row">
            <span>🖥 Graphics</span>
            <select value={s.settings.quality} onChange={(e) => set((st) => (st.quality = e.target.value as typeof st.quality))}>
              <option value="auto">Auto (adaptive)</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label className="row">
            <span>📳 Vibration</span>
            <input type="checkbox" checked={s.settings.vibration} onChange={(e) => set((st) => (st.vibration = e.target.checked))} />
          </label>
        </div>

        <div className="card col">
          <b>How to play</b>
          <small>Swipe ← → to change lane · ↑ jump · ↓ slide (or roll when in the air). Desktop: arrow keys / WASD / Space, P or Esc to pause.</small>
        </div>

        {!confirm ? (
          <button className="btn secondary danger" onClick={() => setConfirm(true)}>Reset all progress</button>
        ) : (
          <div className="card col">
            <b>Erase coins, characters and records?</b>
            <div className="row">
              <button className="btn small danger" onClick={reset}>Yes, erase</button>
              <button className="btn small" onClick={() => setConfirm(false)}>Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
