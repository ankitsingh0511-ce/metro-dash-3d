/**
 * Fully synthesised audio (WebAudio) so the game ships with no third-party audio files and works offline.
 * All sounds and the music loop are original compositions generated at runtime.
 */
export type Sfx = 'jump' | 'slide' | 'coin' | 'train' | 'whistle' | 'crash' | 'powerup' | 'gameover' | 'step' | 'click' | 'reward' | 'land' | 'shield';

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicGain!: GainNode;
  private sfxGain!: GainNode;
  private noiseBuf: AudioBuffer | null = null;
  private musicTimer: number | null = null;
  private nextStep = 0;
  private step = 0;
  private playingMusic = false;
  musicVolume = 0.5;
  sfxVolume = 0.8;
  muted = false;
  private lastCoinPitch = 0;
  private lastCoinTime = 0;

  /** Must be called from a user gesture at least once (browsers/WebViews block autoplay). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.connect(this.master);
      this.sfxGain.connect(this.master);
      this.master.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.applyVolumes();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setVolumes(music: number, sfx: number, muted: boolean) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    this.muted = muted;
    this.applyVolumes();
  }

  private applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(this.muted ? 0 : 1, t, 0.02);
    this.musicGain.gain.setTargetAtTime(this.musicVolume * 0.35, t, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.sfxVolume, t, 0.02);
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }
  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  // ---------- primitives ----------
  private tone(freq: number, dur: number, type: OscillatorType, vol: number, opts: { slideTo?: number; delay?: number; dest?: AudioNode } = {}) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (opts.slideTo) o.frequency.exponentialRampToValueAtTime(opts.slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(opts.dest ?? this.sfxGain);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, vol: number, opts: { freq?: number; freqTo?: number; type?: BiquadFilterType; delay?: number; dest?: AudioNode } = {}) {
    if (!this.ctx || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + (opts.delay ?? 0);
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = opts.type ?? 'lowpass';
    f.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.freqTo) f.frequency.exponentialRampToValueAtTime(opts.freqTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(opts.dest ?? this.sfxGain);
    src.start(t0, Math.random() * 0.5);
    src.stop(t0 + dur + 0.05);
  }

  play(name: Sfx) {
    if (!this.ctx || this.muted) return;
    switch (name) {
      case 'jump':
        this.tone(330, 0.18, 'square', 0.12, { slideTo: 740 });
        this.noise(0.12, 0.08, { freq: 2000, type: 'highpass' });
        break;
      case 'land':
        this.noise(0.1, 0.15, { freq: 300 });
        break;
      case 'slide':
        this.noise(0.45, 0.2, { freq: 3000, freqTo: 500, type: 'bandpass' });
        break;
      case 'coin': {
        const now = this.ctx.currentTime;
        // rising pitch for rapid pickups
        this.lastCoinPitch = now - this.lastCoinTime < 0.35 ? Math.min(this.lastCoinPitch + 1, 7) : 0;
        this.lastCoinTime = now;
        const f = NOTE(83 + this.lastCoinPitch);
        this.tone(f, 0.08, 'square', 0.09);
        this.tone(f * 1.5, 0.2, 'square', 0.09, { delay: 0.06 });
        break;
      }
      case 'train':
        this.tone(220, 0.6, 'sawtooth', 0.12);
        this.tone(277, 0.6, 'sawtooth', 0.1);
        break;
      case 'whistle':
        for (let i = 0; i < 2; i++) {
          this.tone(2500, 0.16, 'sine', 0.14, { delay: i * 0.22, slideTo: 2900 });
          this.tone(2540, 0.16, 'sine', 0.1, { delay: i * 0.22 + 0.02 });
        }
        break;
      case 'crash':
        this.noise(0.5, 0.5, { freq: 900, freqTo: 80 });
        this.tone(110, 0.4, 'sawtooth', 0.25, { slideTo: 40 });
        break;
      case 'shield':
        this.tone(900, 0.25, 'triangle', 0.18, { slideTo: 200 });
        this.noise(0.25, 0.2, { freq: 4000, type: 'highpass' });
        break;
      case 'powerup':
        [72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), 0.18, 'triangle', 0.16, { delay: i * 0.07 }));
        break;
      case 'reward':
        [76, 79, 83, 88].forEach((n, i) => this.tone(NOTE(n), 0.3, 'triangle', 0.15, { delay: i * 0.1 }));
        break;
      case 'gameover':
        [67, 64, 60, 55].forEach((n, i) => this.tone(NOTE(n), 0.4, 'sawtooth', 0.12, { delay: i * 0.22 }));
        break;
      case 'step':
        this.noise(0.05, 0.06, { freq: 700 + Math.random() * 300 });
        break;
      case 'click':
        this.tone(660, 0.06, 'square', 0.07);
        break;
    }
  }

  // ---------- music: simple generative 4-chord loop (Am F C G) ----------
  startMusic() {
    if (!this.ctx || this.playingMusic) return;
    this.playingMusic = true;
    this.step = 0;
    this.nextStep = this.ctx.currentTime + 0.1;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 60);
  }

  stopMusic() {
    this.playingMusic = false;
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleMusic() {
    if (!this.ctx || !this.playingMusic) return;
    const bpm = 132;
    const stepDur = 60 / bpm / 4; // 16th notes
    const chords = [
      [57, 60, 64], // Am
      [53, 57, 60], // F
      [48, 52, 55], // C
      [55, 59, 62], // G
    ];
    while (this.nextStep < this.ctx.currentTime + 0.25) {
      const s = this.step % 64;
      const chord = chords[Math.floor(s / 16)];
      const t = this.nextStep - this.ctx.currentTime;
      const dest = this.musicGain;
      if (s % 4 === 0) {
        // kick
        this.tone(120, 0.12, 'sine', 0.5, { slideTo: 45, delay: t, dest });
      }
      if (s % 8 === 4) this.noise(0.1, 0.25, { freq: 1800, type: 'bandpass', delay: t, dest }); // snare
      if (s % 2 === 1) this.noise(0.03, 0.08, { freq: 7000, type: 'highpass', delay: t, dest }); // hat
      if (s % 4 === 2 || s % 16 === 0) this.tone(NOTE(chord[0] - 12), stepDur * 3, 'triangle', 0.35, { delay: t, dest }); // bass
      const arp = [0, 1, 2, 1, 2, 1, 0, 2];
      if (s % 2 === 0) this.tone(NOTE(chord[arp[(s / 2) % 8]] + 12), stepDur * 1.6, 'square', 0.08, { delay: t, dest });
      if (s % 16 === 8 || s % 16 === 14) this.tone(NOTE(chord[2] + 24), stepDur * 2, 'sawtooth', 0.04, { delay: t, dest });
      this.step++;
      this.nextStep += stepDur;
    }
  }

  dispose() {
    this.stopMusic();
    void this.ctx?.close();
    this.ctx = null;
  }
}
