import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { BOX, CONE, SPHERE, basic, canvasTexture, lambert, mesh } from './Assets';
import { CharacterDef, CharacterStyle, POLICE_OUTFIT } from '../data/catalog';

/**
 * Builds skeletal character rigs. Every rig is a hierarchy of *named* joints
 * (hips, chest, head, armL/R, foreL/R, legL/R, shinL/R) that AnimationMixer clips target by name,
 * exactly like bones in a GLB. When public/models/<characterId>.glb exists it is loaded with
 * GLTFLoader and its own animation clips (run, jump, slide, roll, fall, hit, hoverboard, jetpack, victory, idle)
 * are used instead; the procedural rig is the always-available fallback.
 */

export type ClipName = 'run' | 'jump' | 'slide' | 'roll' | 'fall' | 'hit' | 'hoverboard' | 'jetpack' | 'victory' | 'idle';

export interface CharacterRig {
  root: THREE.Group;
  clips: Map<ClipName, THREE.AnimationClip>;
  hoverboard: THREE.Group;
  jetpack: THREE.Group;
  jetFlames: THREE.Mesh[];
  shield: THREE.Mesh;
  /** per-frame effects (flames flicker) */
  tick(dt: number, time: number): void;
  dispose(): void;
  isGLB: boolean;
}

type V3 = [number, number, number];
type BoneName = 'hips' | 'chest' | 'head' | 'armL' | 'armR' | 'foreL' | 'foreR' | 'legL' | 'legR' | 'shinL' | 'shinR';
const BONES: BoneName[] = ['hips', 'chest', 'head', 'armL', 'armR', 'foreL', 'foreR', 'legL', 'legR', 'shinL', 'shinR'];
type Pose = Partial<Record<BoneName, V3>> & { hipsPos?: V3 };

const HIPS_Y = 0.88;
const qFrom = (e: V3) => new THREE.Quaternion().setFromEuler(new THREE.Euler(e[0], e[1], e[2]));

function buildClip(name: string, duration: number, frames: { t: number; pose: Pose }[], _loop: boolean): THREE.AnimationClip {
  const times = frames.map((f) => f.t * duration);
  const tracks: THREE.KeyframeTrack[] = [];
  for (const bone of BONES) {
    const vals: number[] = [];
    let prev: THREE.Quaternion | null = null;
    for (const f of frames) {
      const q = qFrom(f.pose[bone] ?? [0, 0, 0]);
      if (prev && prev.dot(q) < 0) {
        q.set(-q.x, -q.y, -q.z, -q.w); // keep shortest path
      }
      prev = q;
      vals.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${bone}.quaternion`, times, vals));
  }
  const pos: number[] = [];
  for (const f of frames) pos.push(...(f.pose.hipsPos ?? [0, HIPS_Y, 0]));
  tracks.push(new THREE.VectorKeyframeTrack('hips.position', times, pos));
  const clip = new THREE.AnimationClip(name, duration, tracks);
  return clip;
}

/** Sample a periodic function of phase into keyframes. */
function cyclic(name: string, duration: number, fn: (p: number) => Pose, n = 12): THREE.AnimationClip {
  const frames: { t: number; pose: Pose }[] = [];
  for (let i = 0; i <= n; i++) frames.push({ t: i / n, pose: fn(i / n) });
  return buildClip(name, duration, frames, true);
}

function makeClips(): Map<ClipName, THREE.AnimationClip> {
  const TAU = Math.PI * 2;
  const m = new Map<ClipName, THREE.AnimationClip>();

  m.set('run', cyclic('run', 0.62, (p) => {
    const s = Math.sin(TAU * p);
    const c = Math.cos(TAU * p);
    return {
      hips: [-0.18, 0, 0],
      hipsPos: [0, HIPS_Y + 0.05 * Math.cos(2 * TAU * p) - 0.02, 0],
      chest: [0, 0.16 * s, 0],
      head: [0.1, -0.16 * s, 0],
      legL: [1.0 * s, 0, 0],
      legR: [-1.0 * s, 0, 0],
      shinL: [-(0.2 + 0.95 * Math.max(0, c)), 0, 0],
      shinR: [-(0.2 + 0.95 * Math.max(0, -c)), 0, 0],
      armL: [-0.85 * s, 0, 0.08],
      armR: [0.85 * s, 0, -0.08],
      foreL: [1.0, 0, 0],
      foreR: [1.0, 0, 0],
    };
  }));

  m.set('idle', cyclic('idle', 2, (p) => {
    const b = Math.sin(TAU * p);
    return { hipsPos: [0, HIPS_Y + 0.01 * b, 0], armL: [0.05 * b, 0, 0.12], armR: [-0.05 * b, 0, -0.12], chest: [0.02 * b, 0, 0], head: [0, 0.1 * b, 0] };
  }, 8));

  m.set('jump', buildClip('jump', 0.7, [
    { t: 0, pose: { hips: [-0.1, 0, 0], hipsPos: [0, 0.7, 0], legL: [0.3, 0, 0], legR: [0.3, 0, 0], shinL: [-0.8, 0, 0], shinR: [-0.8, 0, 0], armL: [0.6, 0, 0.1], armR: [0.6, 0, -0.1], foreL: [0.5, 0, 0], foreR: [0.5, 0, 0] } },
    { t: 0.25, pose: { hips: [-0.08, 0, 0], hipsPos: [0, HIPS_Y + 0.05, 0], legL: [1.0, 0, 0], legR: [-0.35, 0, 0], shinL: [-1.1, 0, 0], shinR: [-0.5, 0, 0], armL: [-2.5, 0, 0.35], armR: [-2.2, 0, -0.35], foreL: [0.4, 0, 0], foreR: [0.4, 0, 0] } },
    { t: 0.65, pose: { hips: [-0.05, 0, 0], hipsPos: [0, HIPS_Y, 0], legL: [0.8, 0, 0], legR: [-0.2, 0, 0], shinL: [-0.9, 0, 0], shinR: [-0.4, 0, 0], armL: [-2.1, 0, 0.5], armR: [-1.9, 0, -0.5] } },
    { t: 1, pose: { hips: [-0.15, 0, 0], hipsPos: [0, 0.8, 0], legL: [0.6, 0, 0], legR: [0.2, 0, 0], shinL: [-0.7, 0, 0], shinR: [-0.7, 0, 0], armL: [-0.5, 0, 0.2], armR: [-0.5, 0, -0.2] } },
  ], false));

  m.set('slide', buildClip('slide', 0.75, [
    { t: 0, pose: { hips: [0.2, 0, 0], hipsPos: [0, 0.7, 0], legL: [0.4, 0, 0], legR: [0.2, 0, 0], shinL: [-0.5, 0, 0], shinR: [-0.4, 0, 0], armL: [-0.6, 0, 0.3], armR: [-0.6, 0, -0.3] } },
    { t: 0.2, pose: { hips: [1.15, 0, 0], hipsPos: [0, 0.4, 0.05], head: [-0.8, 0, 0], legL: [0.1, 0, 0], legR: [0.2, 0, 0], shinL: [-0.1, 0, 0], shinR: [-0.1, 0, 0], armL: [-1.2, 0, 0.5], armR: [-1.4, 0, -0.5], foreL: [0.4, 0, 0], foreR: [0.4, 0, 0] } },
    { t: 0.8, pose: { hips: [1.15, 0, 0], hipsPos: [0, 0.4, 0.05], head: [-0.8, 0, 0], legL: [0.1, 0, 0], legR: [0.2, 0, 0], shinL: [-0.1, 0, 0], shinR: [-0.1, 0, 0], armL: [-1.2, 0, 0.5], armR: [-1.4, 0, -0.5], foreL: [0.4, 0, 0], foreR: [0.4, 0, 0] } },
    { t: 1, pose: { hips: [0.1, 0, 0], hipsPos: [0, 0.75, 0], legL: [0.5, 0, 0], legR: [-0.3, 0, 0], shinL: [-0.6, 0, 0], shinR: [-0.4, 0, 0] } },
  ], false));

  const tuck: Pose = { legL: [1.6, 0, 0], legR: [1.6, 0, 0], shinL: [-2.0, 0, 0], shinR: [-2.0, 0, 0], armL: [-1.4, 0, 0.2], armR: [-1.4, 0, -0.2], foreL: [1.4, 0, 0], foreR: [1.4, 0, 0] };
  const rollAt = (t: number, ang: number): { t: number; pose: Pose } => ({ t, pose: { ...tuck, hips: [-ang, 0, 0], hipsPos: [0, 0.62, 0] } });
  m.set('roll', buildClip('roll', 0.6, [rollAt(0, 0.2), rollAt(0.2, 1.4), rollAt(0.4, 2.7), rollAt(0.6, 4.0), rollAt(0.8, 5.2), { t: 1, pose: { hips: [-6.1, 0, 0], hipsPos: [0, 0.8, 0], legL: [0.5, 0, 0], legR: [-0.2, 0, 0], shinL: [-0.5, 0, 0], shinR: [-0.5, 0, 0] } }], false));

  m.set('fall', buildClip('fall', 0.9, [
    { t: 0, pose: { hips: [-0.2, 0, 0], hipsPos: [0, HIPS_Y, 0], armL: [-1.2, 0, 0.4], armR: [-1.2, 0, -0.4] } },
    { t: 0.5, pose: { hips: [-1.2, 0, 0], hipsPos: [0, 0.55, -0.1], armL: [-2.6, 0, 0.6], armR: [-2.6, 0, -0.6], legL: [0.4, 0, 0], legR: [-0.2, 0, 0], shinL: [-0.5, 0, 0], shinR: [-0.3, 0, 0] } },
    { t: 1, pose: { hips: [-1.5, 0.2, 0], hipsPos: [0, 0.3, -0.2], armL: [-2.9, 0, 0.5], armR: [-2.4, 0, -0.8], head: [-0.3, 0.3, 0], legL: [0.2, 0, 0.2], legR: [-0.1, 0, -0.2] } },
  ], false));

  m.set('hit', buildClip('hit', 0.55, [
    { t: 0, pose: { hips: [-0.15, 0, 0], hipsPos: [0, HIPS_Y, 0] } },
    { t: 0.25, pose: { hips: [0.35, 0, 0], hipsPos: [0, 0.8, 0.1], armL: [-1.8, 0, 0.5], armR: [-1.6, 0, -0.5], head: [-0.3, 0, 0], legL: [0.5, 0, 0], legR: [-0.3, 0, 0], shinL: [-0.5, 0, 0] } },
    { t: 0.65, pose: { hips: [-0.4, 0, 0], hipsPos: [0, 0.78, 0], armL: [-0.4, 0, 0.3], armR: [0.4, 0, -0.3], legL: [-0.2, 0, 0], legR: [0.7, 0, 0], shinL: [-0.3, 0, 0], shinR: [-0.6, 0, 0] } },
    { t: 1, pose: { hips: [-0.18, 0, 0], hipsPos: [0, HIPS_Y, 0] } },
  ], false));

  m.set('hoverboard', cyclic('hoverboard', 1.6, (p) => {
    const s = Math.sin(TAU * p);
    return {
      hips: [-0.1, 0.5, 0],
      hipsPos: [0, 0.72 + 0.015 * s, 0],
      chest: [0, -0.5, 0],
      legL: [0.4, 0, 0.1],
      legR: [-0.15, 0, -0.1],
      shinL: [-0.7, 0, 0],
      shinR: [-0.6, 0, 0],
      armL: [-0.3, 0, 1.0 + 0.08 * s],
      armR: [-0.3, 0, -1.0 - 0.08 * s],
      foreL: [0.3, 0, 0],
      foreR: [0.3, 0, 0],
    };
  }, 8));

  m.set('jetpack', cyclic('jetpack', 1.0, (p) => {
    const s = Math.sin(TAU * p);
    return {
      hips: [-0.55, 0, 0.04 * s],
      hipsPos: [0, 1.0 + 0.04 * s, 0],
      head: [0.4, 0, 0],
      legL: [-0.5 + 0.1 * s, 0, 0.05],
      legR: [-0.4 - 0.1 * s, 0, -0.05],
      shinL: [-0.5, 0, 0],
      shinR: [-0.4, 0, 0],
      armL: [-2.7, 0, 0.1],
      armR: [-2.5, 0, -0.1],
      foreL: [0.2, 0, 0],
      foreR: [0.2, 0, 0],
    };
  }, 8));

  m.set('victory', cyclic('victory', 1.0, (p) => {
    const s = Math.sin(TAU * p);
    return {
      hipsPos: [0, HIPS_Y + 0.08 * Math.abs(s), 0],
      armL: [-2.9, 0, 0.35 + 0.15 * s],
      armR: [-2.9, 0, -0.35 - 0.15 * s],
      head: [-0.15, 0.2 * s, 0],
      legL: [0.1, 0, 0.1],
      legR: [-0.1, 0, -0.1],
    };
  }, 8));

  return m;
}

const SHARED_CLIPS = makeClips();

// ---------- humanoid builder ----------

export interface Look {
  skin: number;
  hair: number;
  hairStyle: CharacterDef['hairStyle'] | 'police';
  hoodie: number;
  pants: number;
  shoes: number;
  backpack?: number;
  police?: boolean;
  /** extra per-character details (undefined for the police officer) */
  style?: CharacterStyle;
}

function capsule(r: number, len: number, mat: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 4, 8), mat);
  m.castShadow = true;
  return m;
}

function group(name: string, pos: V3): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  return g;
}

const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');
const shade = (n: number, k: number) => {
  const r = Math.min(255, Math.round(((n >> 16) & 255) * k));
  const g = Math.min(255, Math.round(((n >> 8) & 255) * k));
  const b = Math.min(255, Math.round((n & 255) * k));
  return (r << 16) | (g << 8) | b;
};

function stripeShirt(a: number, b: number): THREE.MeshLambertMaterial {
  const tex = canvasTexture(`shirt${a}-${b}`, 8, 64, (ctx, w, h) => {
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = hex(i % 2 === 0 ? a : b);
      ctx.fillRect(0, (i * h) / 8, w, h / 8 + 1);
    }
  });
  return new THREE.MeshLambertMaterial({ map: tex });
}

function printPlane(text: string, color: string, w: number, h: number, font: number): THREE.Mesh {
  const tex = canvasTexture(`print${text}${color}`, 256, Math.round(256 * (h / w)), (ctx, cw, ch) => {
    ctx.clearRect(0, 0, cw, ch);
    ctx.fillStyle = color;
    ctx.font = `900 ${font}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, cw / 2, ch / 2);
  });
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.rotation.y = Math.PI; // the rig faces -z, so the print must face -z too
  return m;
}

function addHair(head: THREE.Group, look: Look) {
  const hairMat = lambert(look.hair);
  const dome = (r: number, accent?: number) => {
    const d = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), accent ? lambert(accent) : hairMat);
    d.position.set(0, 0.15, 0.01);
    d.castShadow = true;
    return d;
  };
  const blob = (x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
    const b = mesh(SPHERE, hairMat, [x, y, z], [sx, sy, sz], true);
    head.add(b);
    return b;
  };
  switch (look.hairStyle) {
    case 'cap': {
      head.add(dome(0.235, look.hoodie));
      head.add(mesh(BOX, lambert(look.hoodie), [0, 0.25, -0.24], [0.3, 0.035, 0.22]));
      break;
    }
    case 'beanie': {
      head.add(dome(0.24, look.hair));
      head.add(mesh(SPHERE, lambert(0xffffff), [0, 0.4, 0], [0.06, 0.06, 0.06]));
      break;
    }
    case 'ponytail': {
      head.add(dome(0.232));
      blob(0, 0.3, -0.12, 0.2, 0.07, 0.12); // fringe
      const tail = capsule(0.065, 0.25, hairMat);
      tail.position.set(0, 0.06, 0.27);
      tail.rotation.x = -0.35;
      head.add(tail);
      head.add(mesh(SPHERE, lambert(0xff5fa0), [0, 0.17, 0.25], [0.05, 0.05, 0.05])); // hair tie
      break;
    }
    case 'curly': {
      head.add(dome(0.236));
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        blob(Math.cos(a) * 0.14, 0.37 + (i % 2) * 0.02, Math.sin(a) * 0.14, 0.075, 0.075, 0.075);
      }
      blob(0, 0.42, 0, 0.1, 0.08, 0.1);
      break;
    }
    case 'swept': {
      head.add(dome(0.24));
      blob(0, 0.37, -0.07, 0.19, 0.11, 0.17); // quiff
      blob(0, 0.33, 0.1, 0.22, 0.12, 0.17); // volume at the back
      blob(0.16, 0.3, -0.02, 0.1, 0.1, 0.12);
      blob(-0.16, 0.3, -0.02, 0.1, 0.1, 0.12);
      break;
    }
    case 'wavy': {
      head.add(dome(0.238));
      blob(0, 0.08, 0.13, 0.26, 0.27, 0.2); // shoulder-length mass behind the head
      blob(0, -0.03, 0.15, 0.22, 0.1, 0.1);
      blob(0.2, 0.1, -0.01, 0.07, 0.15, 0.08); // side locks
      blob(-0.2, 0.1, -0.01, 0.07, 0.15, 0.08);
      blob(0, 0.3, -0.13, 0.2, 0.06, 0.08); // fringe
      break;
    }
    case 'police': {
      const crown = mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.14, 14), lambert(0x14203d), [0, 0.36, 0]);
      head.add(crown);
      head.add(mesh(BOX, lambert(0x0b0b10), [0, 0.3, -0.24], [0.34, 0.03, 0.2]));
      head.add(mesh(SPHERE, basic(0xffd23a), [0, 0.37, -0.255], [0.045, 0.05, 0.02]));
      break;
    }
    default: {
      head.add(dome(0.232));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), hairMat);
        c.position.set(Math.cos(a) * 0.14, 0.38, Math.sin(a) * 0.14);
        c.rotation.set(Math.sin(a) * 0.5, 0, -Math.cos(a) * 0.5);
        head.add(c);
      }
    }
  }
}

function buildHumanoid(look: Look): { root: THREE.Group; hoverboard: THREE.Group; jetpack: THREE.Group; jetFlames: THREE.Mesh[]; shield: THREE.Mesh } {
  const st = look.style;
  const root = new THREE.Group();
  root.name = 'root';
  const skin = lambert(look.skin);
  const hoodie = st?.stripes ? stripeShirt(look.hoodie, st.stripes[1]) : lambert(look.hoodie);
  const solidTop = lambert(look.hoodie);
  const pants = lambert(look.pants);
  const shoe = lambert(look.shoes);
  const sole = lambert(st?.sole ?? 0x20222c);
  const wide = st ? 1.12 : 1; // baggy cargo pants for the roster characters
  const sleeveless = st?.top === 'tee';

  const hips = group('hips', [0, HIPS_Y, 0]);
  root.add(hips);
  const torso = capsule(st?.top === 'puffer' ? 0.235 : 0.22, 0.3, hoodie);
  torso.scale.z = 0.72;
  torso.position.y = 0.32;
  hips.add(torso);
  const belt = mesh(BOX, pants, [0, 0.03, 0], [0.45, 0.1, 0.27]);
  hips.add(belt);
  if (st) {
    if (st.top === 'puffer') {
      const ringMat = lambert(shade(look.hoodie, 0.78));
      for (const y of [0.16, 0.3, 0.44]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.238, 0.02, 6, 18), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.scale.set(1, 0.72, 1);
        ring.position.y = y;
        hips.add(ring);
      }
    }
    if (st.print) {
      const dark = st.top === 'puffer';
      const pr = printPlane(st.print, dark ? '#1b1b1b' : '#ffffff', dark ? 0.2 : 0.3, dark ? 0.06 : 0.1, dark ? 56 : 80);
      pr.position.set(dark ? 0.1 : 0, dark ? 0.52 : 0.42, -0.165);
      hips.add(pr);
    }
  } else {
    // police: hoodie pocket + stripe (original design)
    hips.add(mesh(BOX, lambert(0xffffff), [0, 0.38, -0.165], [0.3, 0.04, 0.02]));
  }
  if (look.police) {
    hips.add(mesh(BOX, lambert(0xf2d130), [0, 0.28, -0.165], [0.46, 0.05, 0.02]));
    hips.add(mesh(BOX, basic(0xffd23a), [0.12, 0.45, -0.17], [0.07, 0.07, 0.02]));
  }

  const chest = group('chest', [0, 0.5, 0]);
  hips.add(chest);

  // backpack (police only; the roster characters run without one)
  if (look.backpack !== undefined) {
    const packMat = lambert(look.backpack);
    const pack = mesh(BOX, packMat, [0, -0.12, 0.2], [0.34, 0.42, 0.16], true);
    chest.add(pack);
    chest.add(mesh(BOX, lambert(0x1c1c24), [0, -0.12, 0.285], [0.26, 0.2, 0.03]));
    chest.add(mesh(BOX, lambert(0x1c1c24), [-0.14, -0.06, -0.14], [0.05, 0.4, 0.02]));
    chest.add(mesh(BOX, lambert(0x1c1c24), [0.14, -0.06, -0.14], [0.05, 0.4, 0.02]));
  }

  // hood (hoodies and puffer jackets)
  if (!st || st.top !== 'tee') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 14, Math.PI * 1.2), solidTop);
    hood.position.set(0, 0.17, 0.02);
    hood.rotation.set(Math.PI / 2 + 0.2, 0, -Math.PI * 0.1);
    chest.add(hood);
  }
  if (st?.chain) {
    const chain = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.012, 6, 18), lambert(0xd5dbe6));
    chain.rotation.x = Math.PI / 2 - 0.35;
    chain.position.set(0, 0.17, -0.04);
    chest.add(chain);
  }

  // head
  const head = group('head', [0, 0.28, 0]);
  chest.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), skin);
  skull.position.y = 0.15;
  skull.castShadow = true;
  head.add(skull);
  for (const sx of [-1, 1]) {
    head.add(mesh(SPHERE, basic(0xffffff), [sx * 0.085, 0.19, -0.185], [0.055, 0.065, 0.04]));
    head.add(mesh(SPHERE, basic(0x15151c), [sx * 0.085, 0.19, -0.222], [0.028, 0.036, 0.02]));
    const brow = mesh(BOX, lambert(look.hair), [sx * 0.085, 0.27, -0.19], [0.085, 0.018, 0.02]);
    brow.rotation.z = sx * 0.15;
    head.add(brow);
    head.add(mesh(SPHERE, skin, [sx * 0.22, 0.15, 0], [0.045, 0.06, 0.035])); // ears
    head.add(mesh(SPHERE, lambert(0xff8f8f, { transparent: true, opacity: 0.55 }), [sx * 0.13, 0.11, -0.19], [0.04, 0.025, 0.01])); // cheeks
    if (st?.earbuds) head.add(mesh(SPHERE, basic(0x15151c), [sx * 0.245, 0.15, -0.01], [0.032, 0.032, 0.032]));
  }
  head.add(mesh(SPHERE, skin, [0, 0.14, -0.215], [0.035, 0.035, 0.035])); // nose
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 12, Math.PI), basic(0x6b2a2a));
  smile.position.set(0, 0.075, -0.2);
  smile.rotation.z = Math.PI;
  head.add(smile);
  if (st?.beard) {
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.228, 16, 10, 0, Math.PI * 2, Math.PI * 0.68, Math.PI * 0.3), lambert(look.hair));
    beard.position.y = 0.15;
    head.add(beard);
    head.add(mesh(BOX, lambert(look.hair), [0, 0.105, -0.205], [0.13, 0.022, 0.025])); // moustache
  }
  addHair(head, look);
  if (st?.headband !== undefined) {
    const bandMat = lambert(st.headband);
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.228, 0.05, 6, 20), bandMat);
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.28;
    head.add(band);
    head.add(mesh(SPHERE, bandMat, [0, 0.28, 0.235], [0.07, 0.07, 0.06])); // knot
    for (const [sx, rz] of [[-0.05, 0.35], [0.05, -0.2]] as const) {
      const tailBand = capsule(0.032, 0.2, bandMat);
      tailBand.position.set(sx, 0.17, 0.26);
      tailBand.rotation.set(-0.25, 0, rz);
      head.add(tailBand);
    }
  }

  // arms
  for (const side of [-1, 1] as const) {
    const S = side < 0 ? 'L' : 'R';
    const arm = group(`arm${S}`, [side * 0.33, 0.02, 0]);
    chest.add(arm);
    const upper = capsule(st?.top === 'puffer' ? 0.092 : 0.075, 0.2, st?.stripes ? solidTop : hoodie);
    upper.position.y = -0.17;
    arm.add(upper);
    const fore = group(`fore${S}`, [0, -0.34, 0]);
    arm.add(fore);
    const lower = capsule(0.068, 0.18, sleeveless ? skin : st?.stripes ? solidTop : hoodie);
    lower.position.y = -0.15;
    fore.add(lower);
    fore.add(mesh(SPHERE, skin, [0, -0.3, 0], [0.07, 0.07, 0.07]));
    if (st?.sleeveStripe !== undefined) {
      const stripe = lambert(st.sleeveStripe);
      arm.add(mesh(BOX, stripe, [side * 0.078, -0.17, 0], [0.02, 0.3, 0.05]));
      fore.add(mesh(BOX, stripe, [side * 0.07, -0.13, 0], [0.02, 0.2, 0.05]));
    }
    if (st && side < 0) fore.add(mesh(BOX, lambert(st.watch), [0, -0.27, 0], [0.15, 0.07, 0.15])); // wrist watch
  }

  // legs
  for (const side of [-1, 1] as const) {
    const S = side < 0 ? 'L' : 'R';
    const leg = group(`leg${S}`, [side * 0.14, -0.02, 0]);
    hips.add(leg);
    const thigh = capsule(0.1 * wide, 0.22, pants);
    thigh.position.y = -0.2;
    leg.add(thigh);
    if (st) leg.add(mesh(BOX, pants, [side * 0.12 * wide, -0.22, -0.01], [0.05, 0.15, 0.14])); // cargo pocket
    const shin = group(`shin${S}`, [0, -0.41, 0]);
    leg.add(shin);
    const calf = capsule(0.088 * wide, 0.22, pants);
    calf.position.y = -0.2;
    shin.add(calf);
    const foot = mesh(BOX, shoe, [0, -0.41, -0.05], [0.17, 0.11, 0.3], true);
    shin.add(foot);
    shin.add(mesh(BOX, sole, [0, -0.47, -0.05], [0.18, 0.04, 0.31]));
  }

  // ----- attachments -----
  const hoverboard = new THREE.Group();
  hoverboard.name = 'hoverboard';
  hoverboard.add(mesh(BOX, lambert(0x2d9bff), [0, 0.12, 0], [0.62, 0.06, 1.5], true));
  hoverboard.add(mesh(BOX, lambert(0x14203d), [0, 0.16, 0], [0.5, 0.02, 1.3]));
  hoverboard.add(mesh(BOX, basic(0x7fe9ff, { transparent: true, opacity: 0.8 }), [0, 0.07, 0], [0.7, 0.03, 1.6]));
  hoverboard.visible = false;
  root.add(hoverboard);

  const jetpack = new THREE.Group();
  jetpack.name = 'jetpack';
  const jetFlames: THREE.Mesh[] = [];
  for (const sx of [-1, 1]) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.46, 10), lambert(0xc7ccd8));
    tank.position.set(sx * 0.1, -0.12, 0.34);
    jetpack.add(tank);
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.5, 8), basic(0xffa629, { transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
    flame.position.set(sx * 0.1, -0.5, 0.34);
    flame.rotation.x = Math.PI;
    jetpack.add(flame);
    jetFlames.push(flame);
  }
  jetpack.visible = false;
  chest.add(jetpack); // follows the torso, so it leans with the body

  const shield = new THREE.Mesh(new THREE.SphereGeometry(1.0, 16, 12), basic(0x35c7ff, { transparent: true, opacity: 0.22, depthWrite: false }));
  shield.position.y = 0.95;
  shield.visible = false;
  root.add(shield);

  root.scale.setScalar(0.95);
  return { root, hoverboard, jetpack, jetFlames, shield };
}

function wrapRig(parts: ReturnType<typeof buildHumanoid>, clips: Map<ClipName, THREE.AnimationClip>, isGLB = false): CharacterRig {
  return {
    ...parts,
    clips,
    isGLB,
    tick(_dt, time) {
      this.jetFlames.forEach((f, i) => {
        if (!this.jetpack.visible) return;
        const k = 0.8 + 0.4 * Math.sin(time * 40 + i * 2);
        f.scale.set(1, k, 1);
      });
      if (this.shield.visible) this.shield.scale.setScalar(1 + 0.03 * Math.sin(time * 6));
    },
    dispose() {
      this.root.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry && m.geometry !== BOX && m.geometry !== SPHERE && m.geometry !== CONE) m.geometry.dispose();
      });
    },
  };
}

export function lookFor(def: CharacterDef, outfitIndex: number): Look {
  const o = def.outfits[Math.min(outfitIndex, def.outfits.length - 1)];
  return { skin: def.skin, hair: def.hair, hairStyle: def.hairStyle, hoodie: o.hoodie, pants: o.pants, shoes: o.shoes, style: def.style };
}

export function createProceduralPlayer(def: CharacterDef, outfitIndex: number): CharacterRig {
  return wrapRig(buildHumanoid(lookFor(def, outfitIndex)), SHARED_CLIPS);
}

export function createPoliceOfficer(): CharacterRig {
  const p = POLICE_OUTFIT;
  return wrapRig(buildHumanoid({ skin: p.skin, hair: p.hair, hairStyle: 'police', hoodie: p.hoodie, pants: p.pants, shoes: p.shoes, backpack: 0x14203d, police: true }), SHARED_CLIPS);
}

// ---------- police dog ----------

export interface DogRig {
  root: THREE.Group;
  clips: Map<string, THREE.AnimationClip>;
}

export function createPoliceDog(): DogRig {
  const root = new THREE.Group();
  root.name = 'dogRoot';
  const fur = lambert(0x8a5a32);
  const dark = lambert(0x4a2e18);
  const body = new THREE.Group();
  body.name = 'dogBody';
  body.position.set(0, 0.55, 0);
  root.add(body);
  const torso = capsule(0.17, 0.5, fur);
  torso.rotation.x = Math.PI / 2;
  body.add(torso);
  body.add(mesh(BOX, lambert(0x1d3a8a), [0, 0.1, -0.05], [0.3, 0.05, 0.3])); // police vest
  const head = new THREE.Group();
  head.name = 'dogHead';
  head.position.set(0, 0.22, -0.52);
  body.add(head);
  head.add(mesh(SPHERE, fur, [0, 0, 0], [0.16, 0.15, 0.17], true));
  head.add(mesh(BOX, dark, [0, -0.04, -0.17], [0.11, 0.09, 0.2]));
  head.add(mesh(SPHERE, basic(0x111111), [0, -0.01, -0.28], [0.035, 0.03, 0.03]));
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 4), dark);
    ear.position.set(sx * 0.1, 0.16, 0.0);
    ear.rotation.z = -sx * 0.3;
    head.add(ear);
    head.add(mesh(SPHERE, basic(0x111111), [sx * 0.06, 0.04, -0.14], [0.022, 0.022, 0.02]));
  }
  const tail = new THREE.Group();
  tail.name = 'dogTail';
  tail.position.set(0, 0.1, 0.45);
  const tailMesh = capsule(0.04, 0.3, fur);
  tailMesh.position.set(0, 0.12, 0.05);
  tailMesh.rotation.x = -0.6;
  tail.add(tailMesh);
  body.add(tail);

  const legNames = ['legFL', 'legFR', 'legBL', 'legBR'];
  const legPos: V3[] = [[-0.12, -0.05, -0.3], [0.12, -0.05, -0.3], [-0.12, -0.05, 0.3], [0.12, -0.05, 0.3]];
  legNames.forEach((n, i) => {
    const g = group(n, legPos[i]);
    const l = capsule(0.045, 0.3, fur);
    l.position.y = -0.2;
    g.add(l);
    g.add(mesh(BOX, dark, [0, -0.4, -0.02], [0.09, 0.05, 0.14]));
    body.add(g);
  });

  const TAU = Math.PI * 2;
  const tracks: THREE.KeyframeTrack[] = [];
  const n = 12;
  const times = Array.from({ length: n + 1 }, (_, i) => (i / n) * 0.5);
  const qTrack = (name: string, f: (p: number) => number) => {
    const v: number[] = [];
    for (let i = 0; i <= n; i++) {
      const q = qFrom([f(i / n), 0, 0]);
      v.push(q.x, q.y, q.z, q.w);
    }
    tracks.push(new THREE.QuaternionKeyframeTrack(`${name}.quaternion`, times, v));
  };
  qTrack('legFL', (p) => 0.9 * Math.sin(TAU * p));
  qTrack('legFR', (p) => 0.9 * Math.sin(TAU * p + 0.6));
  qTrack('legBL', (p) => 0.9 * Math.sin(TAU * p + Math.PI));
  qTrack('legBR', (p) => 0.9 * Math.sin(TAU * p + Math.PI + 0.6));
  qTrack('dogBody', (p) => 0.08 * Math.sin(TAU * p + 1));
  qTrack('dogHead', (p) => -0.08 * Math.sin(TAU * p + 1));
  qTrack('dogTail', (p) => 0.3 * Math.sin(TAU * 2 * p));
  const bob: number[] = [];
  for (let i = 0; i <= n; i++) bob.push(0, 0.55 + 0.06 * Math.cos(TAU * (i / n)), 0);
  tracks.push(new THREE.VectorKeyframeTrack('dogBody.position', times, bob));
  const clips = new Map<string, THREE.AnimationClip>();
  clips.set('run', new THREE.AnimationClip('run', 0.5, tracks));
  root.scale.setScalar(1.1);
  return { root, clips };
}

// ---------- optional GLB loading ----------

const CLIP_ALIASES: Record<ClipName, string[]> = {
  run: ['run', 'running', 'sprint'],
  jump: ['jump', 'jumping'],
  slide: ['slide', 'sliding'],
  roll: ['roll', 'rolling'],
  fall: ['fall', 'falling', 'die'],
  hit: ['hit', 'stumble', 'hurt'],
  hoverboard: ['hoverboard', 'hover'],
  jetpack: ['jetpack', 'fly', 'flying'],
  victory: ['victory', 'win', 'cheer'],
  idle: ['idle', 'stand'],
};

/**
 * Returns a rig using public/models/<id>.glb if present, else the procedural rig.
 * GLB animations are matched by (case-insensitive) clip name; any missing clip falls back to the procedural one only
 * when the GLB uses the same joint names, otherwise `run` is reused.
 */
export async function loadPlayerRig(def: CharacterDef, outfitIndex: number): Promise<CharacterRig> {
  const procedural = createProceduralPlayer(def, outfitIndex);
  const url = `${import.meta.env.BASE_URL}models/${def.id}.glb`;
  try {
    const head = await fetch(url, { method: 'HEAD' });
    const type = head.headers.get('content-type') ?? '';
    if (!head.ok || type.includes('text/html')) return procedural; // SPA fallback returns html when the file is absent
    const gltf = await new GLTFLoader().loadAsync(url);
    const clips = new Map<ClipName, THREE.AnimationClip>();
    for (const name of Object.keys(CLIP_ALIASES) as ClipName[]) {
      const found = gltf.animations.find((a) => CLIP_ALIASES[name].includes(a.name.toLowerCase()));
      if (found) clips.set(name, found);
    }
    if (!clips.has('run')) return procedural;
    const root = new THREE.Group();
    root.add(gltf.scene);
    gltf.scene.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : undefined));
    const parts = { root, hoverboard: procedural.hoverboard, jetpack: procedural.jetpack, jetFlames: procedural.jetFlames, shield: procedural.shield };
    root.add(parts.hoverboard);
    root.add(parts.shield);
    procedural.jetpack.position.set(0, HIPS_Y + 0.5, 0);
    root.add(procedural.jetpack); // generic jetpack attachment for GLB models
    return wrapRig(parts, clips, true);
  } catch {
    return procedural;
  }
}
