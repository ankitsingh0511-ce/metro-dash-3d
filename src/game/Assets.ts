import * as THREE from 'three';
import { artUrl } from '../data/art';

const matCache = new Map<string, THREE.Material>();

/** Cached Lambert material (cheap on mobile GPUs). */
export function lambert(color: number, opts: { emissive?: number; emissiveIntensity?: number; transparent?: boolean; opacity?: number; map?: THREE.Texture | null; side?: THREE.Side } = {}): THREE.MeshLambertMaterial {
  const key = `L${color}|${opts.emissive ?? ''}|${opts.emissiveIntensity ?? ''}|${opts.transparent ?? ''}|${opts.opacity ?? ''}|${opts.map?.uuid ?? ''}|${opts.side ?? ''}`;
  let m = matCache.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, ...opts });
    matCache.set(key, m);
  }
  return m;
}

export function basic(color: number, opts: { transparent?: boolean; opacity?: number; blending?: THREE.Blending; depthWrite?: boolean } = {}): THREE.MeshBasicMaterial {
  const key = `B${color}|${opts.transparent ?? ''}|${opts.opacity ?? ''}|${opts.blending ?? ''}|${opts.depthWrite ?? ''}`;
  let m = matCache.get(key) as THREE.MeshBasicMaterial | undefined;
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color, ...opts });
    matCache.set(key, m);
  }
  return m;
}

const texCache = new Map<string, THREE.CanvasTexture>();

export function canvasTexture(key: string, w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void, repeat?: [number, number]): THREE.CanvasTexture {
  const cached = texCache.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d')!;
  draw(ctx, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 2;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  texCache.set(key, t);
  return t;
}

/** Building facade with lit windows. */
export function windowTexture(seed: number, base: string): THREE.CanvasTexture {
  return canvasTexture(`win${seed}${base}`, 128, 256, (ctx, w, h) => {
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    let s = seed * 9301 + 49297;
    const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    for (let y = 12; y < h - 12; y += 28) {
      for (let x = 10; x < w - 10; x += 26) {
        ctx.fillStyle = rnd() > 0.45 ? '#9fd2ff' : '#2f4a7a';
        ctx.fillRect(x, y, 14, 18);
      }
    }
  });
}

const BRANDS = ['MEGA NOODLE', 'SKY BANK', 'FIZZ-UP', 'URBAN FIT', 'NOVA PHONE', 'CITY BIKE', 'BYTE CAFE', 'TURBO TEA'];
const BRAND_COLORS = ['#ff5a2a', '#2d9bff', '#19d3a2', '#ff4d8d', '#7a4dff', '#ffc21a'];

/** Original, fictional advertising board art. */
export function adTexture(i: number): THREE.CanvasTexture {
  return canvasTexture(`ad${i % BRANDS.length}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = BRAND_COLORS[i % BRAND_COLORS.length];
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    for (let k = 0; k < 6; k++) ctx.fillRect(k * 50 - 20, 0, 22, h);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 34px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(BRANDS[i % BRANDS.length], w / 2, h / 2);
  });
}

export function graffitiTexture(i: number): THREE.CanvasTexture {
  return canvasTexture(`graf${i % 4}`, 256, 128, (ctx, w, h) => {
    ctx.fillStyle = '#5c5f6e';
    ctx.fillRect(0, 0, w, h);
    const cols = ['#ff4d8d', '#19d3a2', '#ffc21a', '#2d9bff', '#7a4dff'];
    ctx.lineCap = 'round';
    for (let k = 0; k < 7; k++) {
      ctx.strokeStyle = cols[(k + i) % cols.length];
      ctx.lineWidth = 10 + ((k * 7) % 10);
      ctx.beginPath();
      ctx.moveTo(10 + k * 35, 20 + ((k * 31 + i * 17) % 90));
      ctx.bezierCurveTo(60 + k * 25, 10, 90 + k * 20, 120, 140 + k * 15, 40 + ((k * 13) % 60));
      ctx.stroke();
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText(['DASH', 'METRO', 'RUN', 'FLOW'][i % 4], 24, 70);
  });
}

export function sunsetSky(): THREE.CanvasTexture {
  return canvasTexture('sky', 8, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#2f7fe0');
    g.addColorStop(0.5, '#6fb4f2');
    g.addColorStop(0.85, '#bfe0fa');
    g.addColorStop(1, '#e4f2ff');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}

export const BOX = new THREE.BoxGeometry(1, 1, 1);
export const SPHERE = new THREE.SphereGeometry(1, 16, 12);
export const CYL = new THREE.CylinderGeometry(1, 1, 1, 12);
export const CONE = new THREE.ConeGeometry(1, 1, 8);

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, pos?: [number, number, number], scale?: [number, number, number], shadow = false): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (scale) m.scale.set(...scale);
  m.castShadow = shadow;
  return m;
}

// ---------- artwork (public/art) ----------

const artTexCache = new Map<string, THREE.Texture>();

/** Loads (and caches) an image from public/art. The texture fills in as soon as the file arrives. */
export function artTexture(path: string): THREE.Texture {
  let t = artTexCache.get(path);
  if (!t) {
    t = new THREE.TextureLoader().load(artUrl(path));
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    artTexCache.set(path, t);
  }
  return t;
}

export function preloadArt(paths: string[]) {
  for (const p of paths) artTexture(p);
}

const spriteMatCache = new Map<string, THREE.MeshBasicMaterial>();

/** Unlit, alpha-cut material for a cut-out sprite (the art already carries its own lighting). */
export function spriteMaterial(path: string): THREE.MeshBasicMaterial {
  let m = spriteMatCache.get(path);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ map: artTexture(path), transparent: true, alphaTest: 0.35, side: THREE.DoubleSide });
    spriteMatCache.set(path, m);
  }
  return m;
}

/** A vertical sprite quad whose origin is at its bottom-centre, facing +z (toward the camera). */
export function spriteQuad(path: string, w: number, h: number, y = 0): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h);
  geo.translate(0, h / 2, 0);
  const m = new THREE.Mesh(geo, spriteMaterial(path));
  m.position.y = y;
  return m;
}
