import { useCallback, useState } from 'react';
import MainMenu from './components/MainMenu';
import GameScreen from './components/GameScreen';
import CharacterSelection from './components/CharacterSelection';
import ShopScreen from './components/ShopScreen';
import MissionScreen from './components/MissionScreen';
import DailyRewardScreen from './components/DailyRewardScreen';
import SettingsScreen from './components/SettingsScreen';
import LeaderboardScreen from './components/LeaderboardScreen';
import { audio } from './services';

export type Screen = 'menu' | 'game' | 'characters' | 'shop' | 'missions' | 'daily' | 'settings' | 'leaderboard';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const go = useCallback((s: Screen) => {
    audio.unlock(); // first user gesture unlocks WebAudio
    setScreen(s);
  }, []);
  const home = useCallback(() => setScreen('menu'), []);

  return (
    <div className="app">
      {screen === 'menu' && <MainMenu go={go} />}
      {screen === 'game' && <GameScreen onHome={home} />}
      {screen === 'characters' && <CharacterSelection onBack={home} />}
      {screen === 'shop' && <ShopScreen onBack={home} />}
      {screen === 'missions' && <MissionScreen onBack={home} />}
      {screen === 'daily' && <DailyRewardScreen onBack={home} />}
      {screen === 'settings' && <SettingsScreen onBack={home} />}
      {screen === 'leaderboard' && <LeaderboardScreen onBack={home} />}
    </div>
  );
}
