import { audio, click, save, useSave } from '../services';

interface Props {
  onResume: () => void;
  onRestart: () => void;
  onHome: () => void;
  onAudioChanged: () => void;
}

export default function PauseScreen({ onResume, onRestart, onHome, onAudioChanged }: Props) {
  const s = useSave();
  const set = (fn: (st: typeof s.settings) => void) => {
    save.update((d) => fn(d.settings));
    audio.setVolumes(save.state.settings.musicVolume, save.state.settings.sfxVolume, save.state.settings.muted);
    onAudioChanged();
  };
  return (
    <div className="overlay">
      <div className="panel">
        <h2>Paused</h2>
        <button className="btn play" onClick={() => { click(); onResume(); }}>▶ Resume</button>
        <button className="btn secondary" onClick={() => { click(); onRestart(); }}>🔄 Restart</button>
        <button className="btn secondary" onClick={() => { click(); onHome(); }}>🏠 Home</button>

        <div className="sliders">
          <label>
            Music
            <input type="range" min={0} max={1} step={0.05} value={s.settings.musicVolume} onChange={(e) => set((st) => (st.musicVolume = Number(e.target.value)))} />
          </label>
          <label>
            Effects
            <input type="range" min={0} max={1} step={0.05} value={s.settings.sfxVolume} onChange={(e) => set((st) => (st.sfxVolume = Number(e.target.value)))} />
          </label>
          <button className="btn secondary small" onClick={() => set((st) => (st.muted = !st.muted))}>
            {s.settings.muted ? '🔇 Sound off' : '🔊 Sound on'}
          </button>
        </div>
      </div>
    </div>
  );
}
