import type { Screen } from '../App';
import { SaveManager } from '../game/SaveManager';
import { CHARACTERS, MISSIONS } from '../data/catalog';
import { click, useSave } from '../services';
import CharacterPreview from './CharacterPreview';

interface Props {
  go: (s: Screen) => void;
}

export default function MainMenu({ go }: Props) {
  const s = useSave();
  const def = CHARACTERS.find((c) => c.id === s.selectedCharacter) ?? CHARACTERS[0];
  const outfit = s.selectedOutfit[def.id] ?? 0;
  const dailyReady = s.daily.lastClaim !== SaveManager.todayKey();
  const claimable = MISSIONS.filter((m) => !s.completedMissions.includes(m.id) && s.stats[m.metric] >= m.target).length;
  const nav = (screen: Screen) => () => {
    click();
    go(screen);
  };

  return (
    <div className="screen menu">
      <div className="topbar">
        <div className="chip coin">🪙 {s.totalCoins.toLocaleString()}</div>
        <div className="chip">🏆 {s.bestScore.toLocaleString()}</div>
        <button className="icon-btn" aria-label="Settings" onClick={nav('settings')}>
          ⚙️
        </button>
      </div>

      <div className="logo" aria-label="Metro Dash 3D">
        <span className="logo-top">METRO</span>
        <span className="logo-bottom">DASH <b>3D</b></span>
      </div>

      <CharacterPreview characterId={def.id} outfit={outfit} animation="run" className="menu-preview" />
      <div className="char-name">{def.name}</div>

      <button className="btn play" onClick={nav('game')}>
        ▶ PLAY
      </button>

      <div className="menu-grid">
        <button className="btn secondary" onClick={nav('characters')}>
          🧑‍🎤 Characters
        </button>
        <button className="btn secondary" onClick={nav('shop')}>
          🛒 Shop
        </button>
        <button className="btn secondary" onClick={nav('missions')}>
          🎯 Missions{claimable > 0 && <span className="badge">{claimable}</span>}
        </button>
        <button className="btn secondary" onClick={nav('daily')}>
          🎁 Daily{dailyReady && <span className="badge">!</span>}
        </button>
        <button className="btn secondary wide" onClick={nav('leaderboard')}>
          🏅 Leaderboard
        </button>
      </div>
    </div>
  );
}
