import { useSyncExternalStore } from 'react';
import { AudioManager } from './game/AudioManager';
import { SaveManager, SaveData } from './game/SaveManager';

/** App-wide singletons: persistent save data and audio. */
export const save = new SaveManager();
export const audio = new AudioManager();

audio.setVolumes(save.state.settings.musicVolume, save.state.settings.sfxVolume, save.state.settings.muted);

let version = 0;
save.subscribe(() => {
  version++;
});

/** Re-renders the component whenever the save data changes. */
export function useSave(): SaveData {
  useSyncExternalStore(
    (cb) => save.subscribe(cb),
    () => version,
  );
  return save.state;
}

export function click() {
  audio.unlock();
  audio.play('click');
}
