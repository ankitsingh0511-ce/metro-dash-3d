# Optional GLB character models

Metro Dash 3D ships with a fully procedural, skeletally animated character rig, so the game runs with no
external assets. To use your own models, drop a rigged glTF binary here named after the character id:

    public/models/kai.glb   public/models/zara.glb   public/models/milo.glb   public/models/rin.glb

The loader (`loadPlayerRig` in `src/game/CharacterFactory.ts`) uses GLTFLoader + AnimationMixer and matches
animation clip names case-insensitively:

| Game state  | Accepted clip names            |
|-------------|--------------------------------|
| run         | run, running, sprint (required) |
| jump        | jump, jumping                  |
| slide       | slide, sliding                 |
| roll        | roll, rolling                  |
| fall        | fall, falling, die             |
| hit         | hit, stumble, hurt             |
| hoverboard  | hoverboard, hover              |
| jetpack     | jetpack, fly, flying           |
| victory     | victory, win, cheer            |
| idle        | idle, stand                    |

Missing clips fall back to `run`. Model should face -Z, stand at y=0, and be about 1.7 units tall.
Use only models you created or that are licensed for redistribution.
To add a new character, add an entry to `CHARACTERS` in `src/data/catalog.ts`.
