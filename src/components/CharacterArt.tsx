import { CHARACTERS } from '../data/catalog';
import { faceArt, heroArt } from '../data/art';
import CharacterPreview from './CharacterPreview';

interface Props {
  characterId: string;
  outfit: number;
  className?: string;
  locked?: boolean;
  animation?: 'idle' | 'run' | 'victory';
}

/**
 * Shows the supplied character artwork for a character's Signature outfit (outfit 0).
 * Alternate colourways have no artwork, so they fall back to the live 3D in-game model.
 */
export default function CharacterArt({ characterId, outfit, className, locked, animation = 'idle' }: Props) {
  const def = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
  if (outfit > 0) {
    return (
      <div className={`art-card live ${className ?? ''}`}>
        <CharacterPreview characterId={def.id} outfit={outfit} animation={animation} className="preview" />
        <span className="art-tag">In-game colourway</span>
      </div>
    );
  }
  return (
    <div className={`art-card ${locked ? 'locked' : ''} ${className ?? ''}`}>
      <img src={heroArt(def.id)} alt={def.name} draggable={false} />
      {locked && <span className="art-lock">🔒</span>}
    </div>
  );
}

export function FaceAvatar({ characterId, size = 44 }: { characterId: string; size?: number }) {
  return <img className="face" src={faceArt(characterId)} alt="" draggable={false} style={{ width: size, height: size }} />;
}
