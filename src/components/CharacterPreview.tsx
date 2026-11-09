import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { CHARACTERS } from '../data/catalog';
import { loadPlayerRig, CharacterRig } from '../game/CharacterFactory';
import { PlayerAnimationController } from '../game/PlayerAnimationController';

interface Props {
  characterId: string;
  outfit: number;
  animation?: 'idle' | 'run' | 'victory';
  className?: string;
}

/** Small self-contained Three.js view showing the selected character rotating with a skeletal animation. */
export default function CharacterPreview({ characterId, outfit, animation = 'run', className }: Props) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    let disposed = false;
    let raf = 0;
    let rig: CharacterRig | null = null;
    let anim: PlayerAnimationController | null = null;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';
    el.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 1.3));
    const key = new THREE.DirectionalLight(0xfff1d6, 1.4);
    key.position.set(3, 5, 4);
    scene.add(key);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(1.1, 32), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.001;
    scene.add(floor);

    const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
    camera.position.set(0, 1.25, 4.6);
    camera.lookAt(0, 0.95, 0);

    const def = CHARACTERS.find((c) => c.id === characterId) ?? CHARACTERS[0];
    void loadPlayerRig(def, outfit).then((r) => {
      if (disposed) {
        r.dispose();
        return;
      }
      rig = r;
      scene.add(r.root);
      anim = new PlayerAnimationController(r);
      anim.play(animation);
    });

    const resize = () => {
      const w = el.clientWidth || 200;
      const h = el.clientHeight || 260;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    resize();

    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (rig) {
        rig.root.rotation.y += dt * 0.9;
        rig.tick(dt, now / 1000);
      }
      anim?.update(dt);
      renderer.render(scene, camera);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      anim?.dispose();
      rig?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [characterId, outfit, animation]);

  return <div ref={host} className={className ?? 'preview'} />;
}
