import * as THREE from 'three';
import { BASE_SPEED, MAX_SPEED, POWERUP_INFO, PowerUpType, Quality, SPAWN_DISTANCE, SPEED_RAMP } from './constants';
import { CHARACTERS } from '../data/catalog';
import { AudioManager } from './AudioManager';
import { CameraController } from './CameraController';
import { CoinSystem } from './CoinSystem';
import { CollisionSystem } from './CollisionSystem';
import { loadPlayerRig } from './CharacterFactory';
import { GameStateManager, HudState } from './GameStateManager';
import { InputController } from './InputController';
import { ObstacleSpawner, ActiveObstacle } from './ObstacleSpawner';
import { ParticleSystem } from './ParticleSystem';
import { PlayerController } from './PlayerController';
import { PoliceChaseController } from './PoliceChaseController';
import { PowerUpSystem } from './PowerUpSystem';
import { SaveManager } from './SaveManager';
import { ScoreSystem } from './ScoreSystem';
import { TrackGenerator } from './TrackGenerator';

const MAX_REVIVES = 3;
const FRONTAL_THRESHOLD = 1.5;

/** Owns the Three.js scene and ties every gameplay system together. */
export class GameEngine {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private cam = new CameraController();
  private sun!: THREE.DirectionalLight;
  private track!: TrackGenerator;
  private obstacles!: ObstacleSpawner;
  private coins!: CoinSystem;
  private powerups!: PowerUpSystem;
  private particles!: ParticleSystem;
  private player!: PlayerController;
  private police!: PoliceChaseController;
  private score = new ScoreSystem();
  private input!: InputController;
  private resizeObs?: ResizeObserver;

  private raf = 0;
  private last = 0;
  private time = 0;
  private runTime = 0;
  private speed = BASE_SPEED;
  private invuln = 0;
  private stepTimer = 0;
  private dustTimer = 0;
  private hudTimer = 0;
  private endTimer = -1;
  private airTrail = 0;
  private revives = 0;
  private disposed = false;
  private tmp: ActiveObstacle[] = [];
  private prevLane = 1;
  private curLane = 1;

  private run = { jumps: 0, slides: 0, laneChanges: 0, powerups: 0 };

  // adaptive quality
  private quality: Quality = 'high';
  private fpsFrames = 0;
  private fpsTime = 0;
  private qualityLocked = false;

  constructor(private container: HTMLElement, private save: SaveManager, private audio: AudioManager, private state: GameStateManager) {}

  // ---------------------------------------------------------------- setup

  async init() {
    const settings = this.save.state.settings;
    const mobile = navigator.maxTouchPoints > 0;
    this.quality = settings.quality === 'auto' ? (mobile ? 'medium' : 'high') : settings.quality;
    this.qualityLocked = settings.quality !== 'auto';

    this.renderer = new THREE.WebGLRenderer({ antialias: this.quality !== 'low', powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);
    this.renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;';

    this.scene.background = new THREE.Color(0xffb98a);
    this.scene.fog = new THREE.Fog(0xf2b48f, 45, SPAWN_DISTANCE + 10);

    this.scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x7a6552, 1.05));
    this.sun = new THREE.DirectionalLight(0xfff1d6, 1.2);
    this.sun.position.set(-8, 16, 6);
    this.sun.target.position.set(0, 0, -6);
    const sc = this.sun.shadow.camera;
    sc.left = -12;
    sc.right = 12;
    sc.top = 22;
    sc.bottom = -14;
    sc.near = 1;
    sc.far = 50;
    this.sun.shadow.bias = -0.0008;
    this.scene.add(this.sun, this.sun.target);

    this.track = new TrackGenerator(this.scene);
    this.obstacles = new ObstacleSpawner(this.scene);
    this.coins = new CoinSystem(this.scene);
    this.powerups = new PowerUpSystem(this.scene);
    this.particles = new ParticleSystem(this.scene);
    this.police = new PoliceChaseController();
    this.scene.add(this.police.group);

    const rig = await this.loadSelectedRig();
    if (this.disposed) return;
    this.player = new PlayerController(rig);
    this.scene.add(rig.root);

    this.wire();
    this.applyQuality(this.quality);
    this.applyAudioSettings();

    this.input = new InputController(this.container, {
      left: () => this.player.moveLeft(),
      right: () => this.player.moveRight(),
      up: () => this.player.jump(),
      down: () => this.player.slide(),
      pause: () => (this.state.phase === 'playing' ? this.pause() : this.state.phase === 'paused' ? this.resume() : undefined),
    });

    this.resizeObs = new ResizeObserver(() => this.resize());
    this.resizeObs.observe(this.container);
    this.resize();

    this.newRun();
    this.state.setPhase('playing');
    this.last = performance.now();
    this.loop(this.last);
  }

  private async loadSelectedRig() {
    const s = this.save.state;
    const def = CHARACTERS.find((c) => c.id === s.selectedCharacter) ?? CHARACTERS[0];
    return loadPlayerRig(def, s.selectedOutfit[def.id] ?? 0);
  }

  private wire() {
    this.player.events = {
      onJump: () => {
        this.audio.play('jump');
        this.run.jumps++;
      },
      onSlide: () => {
        this.audio.play('slide');
        this.run.slides++;
        this.particles.burst(this.player.x, 0.1, 0.2, 0xcfc6b5, 6, 2, 2);
      },
      onLand: () => {
        this.audio.play('land');
        this.particles.burst(this.player.x, 0.1, 0, 0xcfc6b5, 6, 2, 2);
      },
      onLaneChange: () => {
        this.run.laneChanges++;
        this.audio.play('step');
      },
    };

    this.coins.onCollect = (c) => {
      this.score.addCoin();
      this.audio.play('coin');
      this.particles.burst(c.x, c.y, c.z, 0xffd23a, 8, 3, -4, 0.07);
    };

    this.powerups.onActivate = (t) => {
      this.audio.play('powerup');
    };
    this.powerups.onPickup = (t, x, y, z) => {
      this.run.powerups++;
      this.particles.burst(x, y, z, POWERUP_INFO[t].color, 16, 4, -3, 0.1);
    };
    this.powerups.onExpire = (t: PowerUpType) => {
      if (t === 'jetpack') this.invuln = Math.max(this.invuln, 1.5); // safe landing window
    };

    this.police.onWhistle = () => this.audio.play('whistle');

    this.obstacles.onRow = (row) => {
      this.coins.spawnForRow(row);
      if (row.powerUp) this.powerups.spawnPickup(row.safeLane, row.z + row.length * 0.5 + 6);
    };
    this.obstacles.onPassed = (o) => {
      // clearing an obstacle that was in the player's path nudges the police back
      if (Math.abs(o.x - this.player.x) < 1.3 && this.player.mode === 'running') this.police.dodged(1);
    };
  }

  // ---------------------------------------------------------------- run lifecycle

  private newRun() {
    this.score.reset();
    this.track.reset();
    this.obstacles.reset();
    this.coins.reset();
    this.powerups.setUpgrades(this.save.state.upgrades);
    this.powerups.reset();
    this.particles.clear();
    this.player.reset();
    this.curLane = this.prevLane = 1;
    this.police.reset();
    this.police.dogEnabled = true;
    this.speed = BASE_SPEED;
    this.runTime = 0;
    this.invuln = 1.2;
    this.endTimer = -1;
    this.airTrail = 0;
    this.revives = 0;
    this.run = { jumps: 0, slides: 0, laneChanges: 0, powerups: 0 };
    this.cam.reset(0);
    this.state.resetRun();
    this.input?.setEnabled(true);
    this.publishHud(true);
    this.audio.startMusic();
  }

  restart() {
    this.audio.stopMusic();
    this.newRun();
    this.state.setPhase('playing');
  }

  pause() {
    if (this.state.phase !== 'playing') return;
    this.state.setPhase('paused');
    this.audio.suspend();
  }

  resume() {
    if (this.state.phase !== 'paused') return;
    this.state.setPhase('playing');
    this.audio.resume();
    this.last = performance.now();
  }

  useHoverboardItem() {
    if (this.state.phase !== 'playing' || this.save.state.hoverboards <= 0 || this.powerups.isActive('hoverboard')) return;
    this.save.update((d) => {
      d.hoverboards -= 1;
    });
    this.powerups.activate('hoverboard');
    this.publishHud(true);
  }

  get reviveCost() {
    return 100 * Math.pow(2, this.revives);
  }

  revive(): boolean {
    if (this.state.phase !== 'gameover' || this.revives >= MAX_REVIVES) return false;
    if (!this.save.spend(this.reviveCost)) return false;
    this.revives++;
    this.player.reset();
    this.police.reset();
    this.obstacles.clearNear(70);
    this.speed = Math.max(BASE_SPEED, this.speed * 0.8);
    this.invuln = 3;
    this.endTimer = -1;
    this.player.rig.root.position.y = 0;
    this.input.setEnabled(true);
    this.state.setSummary(null);
    this.state.setPhase('playing');
    this.audio.startMusic();
    return true;
  }

  private crash(fatalFront: boolean) {
    if (this.endTimer >= 0) return;
    this.audio.play('crash');
    this.audio.play('whistle');
    this.cam.shake(0.7, 0.5);
    this.player.fall();
    this.police.startCatch();
    this.particles.burst(this.player.x, 1, 0, 0xffe14d, 22, 5, -6, 0.12);
    this.input.setEnabled(false);
    this.endTimer = fatalFront ? 1.0 : 1.2;
    this.audio.stopMusic();
    if (navigator.vibrate && this.save.state.settings.vibration) navigator.vibrate(120);
  }

  private finishRun() {
    this.audio.play('gameover');
    const before = this.save.state.bestScore;
    const score = this.score.displayScore;
    this.save.recordRun({ score, coins: this.score.coins, distance: this.score.distance, ...this.run });
    const canRevive = this.revives < MAX_REVIVES;
    this.state.setSummary({
      score,
      best: this.save.state.bestScore,
      newBest: score > before,
      coins: this.score.coins,
      distance: Math.floor(this.score.distance),
      revivesUsed: this.revives,
      reviveCost: this.reviveCost,
      canRevive,
    });
    this.state.setPhase('gameover');
  }

  // ---------------------------------------------------------------- settings / quality

  applyAudioSettings() {
    const s = this.save.state.settings;
    this.audio.setVolumes(s.musicVolume, s.sfxVolume, s.muted);
  }

  applyQualitySetting() {
    const s = this.save.state.settings.quality;
    this.qualityLocked = s !== 'auto';
    if (s !== 'auto') this.applyQuality(s);
  }

  private applyQuality(q: Quality) {
    this.quality = q;
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(dpr, 2) : q === 'medium' ? Math.min(dpr, 1.5) : 1);
    const shadows = q === 'high';
    this.renderer.shadowMap.enabled = shadows;
    this.sun.castShadow = shadows;
    if (shadows) {
      this.sun.shadow.mapSize.set(1024, 1024);
      this.sun.shadow.map?.dispose();
      this.sun.shadow.map = null;
    }
    this.scene.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
      if (m) (Array.isArray(m) ? m : [m]).forEach((mm) => (mm.needsUpdate = true));
    });
    this.resize();
  }

  private monitorFps(rawDt: number) {
    this.fpsFrames++;
    this.fpsTime += rawDt;
    if (this.fpsTime < 2.5) return;
    const fps = this.fpsFrames / this.fpsTime;
    this.fpsFrames = 0;
    this.fpsTime = 0;
    if (this.qualityLocked || this.state.phase !== 'playing') return;
    if (fps < 45 && this.quality !== 'low') this.applyQuality(this.quality === 'high' ? 'medium' : 'low');
  }

  private resize() {
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.cam.resize(w, h);
  }

  // ---------------------------------------------------------------- main loop

  private loop = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const raw = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    const dt = Math.min(raw, 1 / 30);
    this.time += dt;
    this.monitorFps(raw);

    const phase = this.state.phase;
    if (phase === 'playing') this.step(dt);
    else if (phase === 'gameover') this.stepIdle(dt);
    // paused: render only
    this.renderer.render(this.scene, this.cam.camera);
  };

  /** Gameplay frame. */
  private step(dt: number) {
    const crashed = this.endTimer >= 0;
    const jet = this.powerups.isActive('jetpack');

    // speed ramps with time; slows to a stop once crashed
    if (crashed) this.speed = Math.max(0, this.speed - 40 * dt);
    else {
      this.runTime += dt;
      const target = Math.min(MAX_SPEED, BASE_SPEED + SPEED_RAMP * this.runTime);
      this.speed += (target * (jet ? 1.15 : 1) - this.speed) * Math.min(1, 2 * dt);
    }
    const dz = this.speed * dt;

    this.track.scroll(dz);
    this.particles.scroll(dz);
    this.obstacles.update(dt, this.speed, this.score.distance);
    if (!crashed) this.score.addDistance(dz);

    this.score.setPowerups(this.powerups.isActive('multiplier'), this.powerups.isActive('booster'));
    this.invuln = Math.max(0, this.invuln - dt);

    this.player.update(dt, { jetpack: jet && !crashed, sneakers: this.powerups.isActive('sneakers'), hoverboard: this.powerups.isActive('hoverboard') });
    this.player.rig.tick(dt, this.time);
    this.player.rig.shield.visible = this.powerups.isActive('hoverboard') && !crashed;
    // blink while invulnerable after a hit / revive
    this.player.rig.root.visible = this.invuln > 0 && !crashed && !jet ? Math.floor(this.time * 18) % 2 === 0 : true;
    if (this.player.lane !== this.curLane) {
      this.prevLane = this.curLane;
      this.curLane = this.player.lane;
    }

    this.coins.update(dt, this.speed, this.player.box, this.powerups.isActive('magnet') && !crashed);
    this.powerups.update(dt, this.speed, this.player.box);
    if (this.powerups.isActive('jetpack') && !crashed) {
      this.airTrail -= dz;
      if (this.airTrail <= 0) {
        this.coins.spawnAir(Math.floor(Math.random() * 3), SPAWN_DISTANCE - 20, 8);
        this.airTrail = 28;
      }
    }

    if (!crashed && !jet && this.invuln <= 0) this.handleCollisions();

    this.police.update(dt, this.player.x, !crashed);
    this.cam.update(dt, this.player.x, this.player.y, this.speed, jet);
    this.track.followCamera(this.cam.camera);
    this.sun.position.set(-8, 16, 6);
    this.sun.target.position.set(0, 0, -6);

    // footsteps + dust
    if (!crashed && this.player.grounded && !this.player.sliding && this.player.mode === 'running') {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.audio.play('step');
        this.stepTimer = 0.31;
      }
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.particles.dust(this.player.x, 0.2);
        this.dustTimer = 0.06;
      }
    }
    this.particles.update(dt, this.speed, this.cam.camera.position.x);

    if (this.endTimer >= 0) {
      this.endTimer -= dt;
      if (this.endTimer < 0) this.finishRun();
    }

    this.hudTimer -= dt;
    if (this.hudTimer <= 0) this.publishHud();
  }

  /** Keep the scene alive (particles, police) while the game-over panel is showing. */
  private stepIdle(dt: number) {
    this.player.update(dt, { jetpack: false, sneakers: false, hoverboard: false });
    this.police.update(dt, this.player.x, false);
    this.particles.update(dt, 0, this.cam.camera.position.x);
    this.cam.update(dt, this.player.x, 0, 0, false);
  }

  private handleCollisions() {
    this.tmp.length = 0;
    for (const o of this.obstacles.active) if (!o.hit) this.tmp.push(o);
    const hit = CollisionSystem.firstHit(this.player.box, this.tmp);
    if (!hit) return;

    // hoverboard absorbs one hit
    if (this.powerups.consumeShield()) {
      this.obstacles.knockOver(hit);
      this.invuln = 1.6;
      this.audio.play('shield');
      this.cam.shake(0.3, 0.25);
      this.particles.burst(this.player.x, 1, 0, 0x7fe9ff, 20, 5, -3, 0.1);
      return;
    }

    const def = hit.def;
    const nearEdge = hit.box.cz + def.d / 2;
    const frontal = nearEdge + 0.3 < FRONTAL_THRESHOLD;

    this.obstacles.knockOver(hit);
    this.cam.shake(0.5, 0.35);
    this.audio.play('crash');
    if (navigator.vibrate && this.save.state.settings.vibration) navigator.vibrate(40);

    if (def.fatal && frontal) {
      this.crash(true);
      return;
    }
    if (def.fatal && !frontal) {
      // scraped the side of a train / roadblock while changing lanes: bounce back to the previous lane
      this.player.lane = this.prevLane !== this.player.lane ? this.prevLane : Math.max(0, Math.min(2, this.player.lane + (hit.lane > this.player.lane ? -1 : 1)));
      this.curLane = this.player.lane;
    }
    this.particles.burst(this.player.x, 0.8, 0, 0xffe14d, 14, 4, -6, 0.1);
    this.player.stumble();
    this.invuln = 1.1;
    if (this.police.hit()) this.crash(false);
  }

  private publishHud(force = false) {
    this.hudTimer = 0.08;
    const p = this.powerups;
    const hud: HudState = {
      score: this.score.displayScore,
      coins: this.score.coins,
      distance: Math.floor(this.score.distance),
      multiplier: this.score.multiplier,
      danger: this.police.danger,
      powerups: p.activeList().map((type) => ({ type, fraction: p.fraction(type) })),
      hoverboards: this.save.state.hoverboards,
      invulnerable: this.invuln > 0,
    };
    void force;
    this.state.setHud(hud);
  }

  // ---------------------------------------------------------------- teardown

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.resizeObs?.disconnect();
    this.input?.dispose();
    this.audio.stopMusic();
    this.police?.dispose();
    this.player?.anim.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
    });
    this.renderer?.dispose();
    this.renderer?.forceContextLoss();
    this.renderer?.domElement.remove();
  }
}
