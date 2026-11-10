import { useState } from 'react';
import { CHARACTERS } from '../data/catalog';
import { audio, click, save, useSave } from '../services';
import CharacterArt, { FaceAvatar } from './CharacterArt';

export default function CharacterSelection({ onBack }: { onBack: () => void }) {
  const s = useSave();
  const startIdx = Math.max(0, CHARACTERS.findIndex((c) => c.id === s.selectedCharacter));
  const [idx, setIdx] = useState(startIdx);
  const [outfit, setOutfit] = useState(s.selectedOutfit[CHARACTERS[startIdx].id] ?? 0);
  const [msg, setMsg] = useState('');

  const def = CHARACTERS[idx];
  const unlocked = s.unlockedCharacters.includes(def.id);
  const outfitOwned = (i: number) => s.purchasedOutfits.includes(`${def.id}:${i}`) || (unlocked && def.outfits[i].price === 0);
  const selected = s.selectedCharacter === def.id && (s.selectedOutfit[def.id] ?? 0) === outfit;

  const pick = (i: number) => {
    click();
    setIdx(i);
    setOutfit(save.state.selectedOutfit[CHARACTERS[i].id] ?? 0);
    setMsg('');
  };

  const buyCharacter = () => {
    if (!save.spend(def.price)) return setMsg('Not enough coins');
    audio.play('reward');
    save.update((d) => {
      d.unlockedCharacters.push(def.id);
      d.purchasedOutfits.push(`${def.id}:0`);
      d.selectedCharacter = def.id;
      d.selectedOutfit[def.id] = 0;
    });
    setOutfit(0);
    setMsg(`${def.name} unlocked!`);
  };

  const buyOutfit = () => {
    const o = def.outfits[outfit];
    if (!save.spend(o.price)) return setMsg('Not enough coins');
    audio.play('reward');
    save.update((d) => {
      d.purchasedOutfits.push(`${def.id}:${outfit}`);
      d.selectedCharacter = def.id;
      d.selectedOutfit[def.id] = outfit;
    });
    setMsg(`${o.name} unlocked!`);
  };

  const select = () => {
    click();
    save.update((d) => {
      d.selectedCharacter = def.id;
      d.selectedOutfit[def.id] = outfit;
    });
    setMsg(`${def.name} selected`);
  };

  return (
    <div className="screen sub">
      <header className="sub-head">
        <button className="icon-btn" onClick={() => { click(); onBack(); }} aria-label="Back">←</button>
        <h2>Characters</h2>
        <div className="chip coin">🪙 {s.totalCoins.toLocaleString()}</div>
      </header>

      <div className="carousel">
        <button className="icon-btn" onClick={() => pick((idx + CHARACTERS.length - 1) % CHARACTERS.length)} aria-label="Previous">‹</button>
        <CharacterArt characterId={def.id} outfit={outfit} locked={!unlocked} animation="idle" className="big" />
        <button className="icon-btn" onClick={() => pick((idx + 1) % CHARACTERS.length)} aria-label="Next">›</button>
      </div>

      <div className="faces">
        {CHARACTERS.map((c, i) => (
          <button key={c.id} className={`face-btn ${i === idx ? 'on' : ''} ${s.unlockedCharacters.includes(c.id) ? '' : 'locked'}`} onClick={() => pick(i)} aria-label={c.name}>
            <FaceAvatar characterId={c.id} size={46} />
          </button>
        ))}
      </div>
      <div className="char-name">{def.name}</div>
      <p className="muted center">{def.tagline}</p>

      <div className="outfits">
        {def.outfits.map((o, i) => (
          <button
            key={o.name}
            className={`outfit ${i === outfit ? 'on' : ''}`}
            onClick={() => { click(); setOutfit(i); setMsg(''); }}
          >
            <span className="swatch" style={{ background: '#' + o.hoodie.toString(16).padStart(6, '0') }} />
            <span>{o.name}</span>
            <small>{!unlocked ? '🔒' : outfitOwned(i) ? '✓' : `🪙 ${o.price}`}</small>
          </button>
        ))}
      </div>

      {!unlocked ? (
        <button className="btn play" disabled={s.totalCoins < def.price} onClick={buyCharacter}>
          Unlock · 🪙 {def.price.toLocaleString()}
        </button>
      ) : !outfitOwned(outfit) ? (
        <button className="btn play" disabled={s.totalCoins < def.outfits[outfit].price} onClick={buyOutfit}>
          Buy outfit · 🪙 {def.outfits[outfit].price}
        </button>
      ) : (
        <button className="btn play" disabled={selected} onClick={select}>
          {selected ? '✓ Selected' : 'Select'}
        </button>
      )}
      <div className="toast-line">{msg}</div>
    </div>
  );
}
