import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { App as CapApp } from '@capacitor/app';
import { GameEngine } from '../game/GameEngine';
import { GameStateManager } from '../game/GameStateManager';
import { audio, save } from '../services';
import GameHUD from './GameHUD';
import PauseScreen from './PauseScreen';
import GameOverScreen from './GameOverScreen';

interface Props {
  onHome: () => void;
}

export default function GameScreen({ onHome }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [state] = useState(() => new GameStateManager());
  const [error, setError] = useState<string | null>(null);
  const snap = useSyncExternalStore(state.subscribe, state.getSnapshot);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let cancelled = false;
    const engine = new GameEngine(el, save, audio, state);
    engineRef.current = engine;
    engine.init().catch((e: unknown) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });

    // pause when the app/tab goes to the background (Android home button, screen off, tab switch)
    const onVis = () => {
      if (document.hidden) engine.pause();
    };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('blur', onVis);
    let removeCap: (() => void) | null = null;
    CapApp.addListener('appStateChange', ({ isActive }) => {
      if (!isActive) engine.pause();
    })
      .then((h) => {
        if (cancelled) void h.remove();
        else removeCap = () => void h.remove();
      })
      .catch(() => undefined);
    CapApp.addListener('backButton', () => {
      if (state.phase === 'playing') engine.pause();
      else if (state.phase === 'paused') engine.resume();
      else onHome();
    }).catch(() => undefined);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('blur', onVis);
      removeCap?.();
      void CapApp.removeAllListeners().catch(() => undefined);
      engine.dispose();
      engineRef.current = null;
    };
  }, [state, onHome]);

  const engine = () => engineRef.current;

  return (
    <div className="screen game">
      <div ref={host} className="game-canvas" />

      {snap.phase === 'loading' && !error && (
        <div className="overlay solid">
          <div className="loader">Loading Metro Dash…</div>
        </div>
      )}
      {error && (
        <div className="overlay solid">
          <div className="panel">
            <h2>Can't start 3D</h2>
            <p className="muted">{error}</p>
            <button className="btn secondary" onClick={onHome}>🏠 Home</button>
          </div>
        </div>
      )}

      {(snap.phase === 'playing' || snap.phase === 'paused') && (
        <GameHUD hud={snap.hud} onPause={() => engine()?.pause()} onUseHoverboard={() => engine()?.useHoverboardItem()} />
      )}

      {snap.phase === 'paused' && (
        <PauseScreen
          onResume={() => engine()?.resume()}
          onRestart={() => engine()?.restart()}
          onHome={onHome}
          onAudioChanged={() => engine()?.applyAudioSettings()}
        />
      )}

      {snap.phase === 'gameover' && snap.summary && (
        <GameOverScreen summary={snap.summary} onRestart={() => engine()?.restart()} onHome={onHome} onRevive={() => engine()?.revive()} />
      )}
    </div>
  );
}
