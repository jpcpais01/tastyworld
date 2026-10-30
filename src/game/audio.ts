/** Procedural audio: a soft generative koto-like melody, city ambience and UI sounds. No assets needed. */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private sizzle!: GainNode;
  private water!: GainNode;
  private nextNote = 0;
  private step = 0;
  musicOn = true;
  sfxOn = true;
  private noiseBuf: AudioBuffer | null = null;

  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.8;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = this.musicOn ? 0.22 : 0; this.music.connect(this.master);
    this.sfx = ctx.createGain(); this.sfx.gain.value = this.sfxOn ? 0.5 : 0; this.sfx.connect(this.master);
    this.amb = ctx.createGain(); this.amb.gain.value = this.sfxOn ? 0.05 : 0; this.amb.connect(this.master);
    // reverb-ish echo for the music
    const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.36;
    const fb = ctx.createGain(); fb.gain.value = 0.32;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    this.music.connect(delay); delay.connect(lp).connect(fb).connect(delay); lp.connect(this.master);

    // noise buffer
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let b = 0;
    for (let i = 0; i < len; i++) { b = 0.97 * b + 0.03 * (Math.random() * 2 - 1); d[i] = b * 4 + (Math.random() * 2 - 1) * 0.15; }
    this.noiseBuf = buf;
    // city murmur
    const n = ctx.createBufferSource(); n.buffer = buf; n.loop = true;
    const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 380; f.Q.value = 0.5;
    n.connect(f).connect(this.amb); n.start();
    // sizzle layer (near grills)
    this.sizzle = ctx.createGain(); this.sizzle.gain.value = 0; this.sizzle.connect(this.master);
    const s = ctx.createBufferSource(); s.buffer = this.whiteNoise(); s.loop = true;
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 4500;
    s.connect(hp).connect(this.sizzle); s.start();
    // water lapping
    this.water = ctx.createGain(); this.water.gain.value = 0; this.water.connect(this.master);
    const w = ctx.createBufferSource(); w.buffer = buf; w.loop = true; w.playbackRate.value = 0.5;
    const wl = ctx.createBiquadFilter(); wl.type = 'lowpass'; wl.frequency.value = 600;
    w.connect(wl).connect(this.water); w.start();
    this.nextNote = ctx.currentTime + 0.5;
  }

  private whiteNoise(): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (0.6 + 0.4 * Math.sin(i * 0.002) ** 2);
    return buf;
  }

  setMusic(on: boolean): void { this.musicOn = on; if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.22 : 0, this.ctx.currentTime, 0.3); }
  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(on ? 0.5 : 0, this.ctx.currentTime, 0.1);
    this.amb.gain.setTargetAtTime(on ? 0.05 : 0, this.ctx.currentTime, 0.3);
  }

  /** Ambient proximity: 0..1 for grills and water. */
  ambience(sizzle: number, water: number, night: number): void {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    this.sizzle.gain.setTargetAtTime(sizzle * 0.05, t, 0.4);
    this.water.gain.setTargetAtTime(water * 0.06, t, 0.6);
    this.amb.gain.setTargetAtTime(0.05 * (1 - night * 0.5), t, 1.0);
  }

  private pluck(freq: number, when: number, vol = 0.3, dur = 1.6, dest?: AudioNode) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator(), o2 = ctx.createOscillator();
    const g = ctx.createGain();
    const f = ctx.createBiquadFilter();
    o.type = 'triangle'; o2.type = 'sine';
    o.frequency.value = freq; o2.frequency.value = freq * 2.003;
    f.type = 'lowpass'; f.frequency.setValueAtTime(freq * 8, when); f.frequency.exponentialRampToValueAtTime(freq * 1.5, when + dur * 0.6);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    const g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(f); o2.connect(g2).connect(f); f.connect(g).connect(dest ?? this.music);
    o.start(when); o2.start(when); o.stop(when + dur + 0.05); o2.stop(when + dur + 0.05);
  }

  /** Called every frame: schedules the generative melody (miyako-bushi scale). */
  tick(night: number): void {
    if (!this.ctx || !this.musicOn) return;
    const ctx = this.ctx;
    const scale = [293.66, 311.13, 392.0, 440.0, 466.16]; // D Eb G A Bb
    const beat = night > 0.5 ? 0.62 : 0.5;
    while (this.nextNote < ctx.currentTime + 0.3) {
      const t = this.nextNote;
      const bar = Math.floor(this.step / 8);
      const pos = this.step % 8;
      const rnd = Math.sin(this.step * 12.9898 + bar * 78.233) * 43758.5453 % 1;
      const r = Math.abs(rnd);
      if (pos === 0) {
        const root = scale[[0, 2, 3, 0][bar % 4]] / 2;
        this.pluck(root, t, 0.18, 3.2);
        this.pluck(root * 1.5, t + 0.02, 0.08, 3.0);
      }
      if (r < (pos % 2 === 0 ? 0.55 : 0.25)) {
        const oct = r < 0.12 ? 2 : 1;
        this.pluck(scale[Math.floor(r * 37) % 5] * oct, t, 0.11 + r * 0.08, 1.4);
      }
      this.nextNote += beat;
      this.step++;
    }
  }

  private env(o: AudioScheduledSourceNode, g: GainNode, when: number, vol: number, dur: number) {
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(vol, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
    o.start(when); o.stop(when + dur + 0.05);
  }

  play(name: 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh'): void {
    if (!this.ctx || !this.sfxOn) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const tone = (freq: number, when: number, vol: number, dur: number, type: OscillatorType = 'sine', slide?: number) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, when);
      if (slide) o.frequency.exponentialRampToValueAtTime(slide, when + dur);
      o.connect(g).connect(this.sfx);
      this.env(o, g, when, vol, dur);
    };
    const noise = (when: number, vol: number, dur: number, freq: number, type: BiquadFilterType = 'bandpass') => {
      if (!this.noiseBuf) return;
      const s = ctx.createBufferSource(); s.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq;
      const g = ctx.createGain();
      s.connect(f).connect(g).connect(this.sfx);
      this.env(s, g, when, vol, dur);
    };
    switch (name) {
      case 'click': tone(880, t, 0.12, 0.08, 'triangle'); break;
      case 'pop': tone(520, t, 0.2, 0.12, 'sine', 980); break;
      case 'coin': tone(1318, t, 0.18, 0.12, 'square'); tone(1760, t + 0.07, 0.15, 0.3, 'square'); break;
      case 'stamp': noise(t, 0.9, 0.18, 220, 'lowpass'); tone(90, t, 0.6, 0.2, 'sine', 50); break;
      case 'success': [523, 659, 784, 1046].forEach((f, i) => this.pluck(f, t + i * 0.09, 0.25, 1.2, this.sfx)); break;
      case 'fail': tone(330, t, 0.2, 0.25, 'triangle', 220); break;
      case 'sizzle': noise(t, 0.35, 0.5, 6000, 'highpass'); break;
      case 'chop': noise(t, 0.6, 0.06, 2500); tone(180, t, 0.3, 0.06, 'square', 120); break;
      case 'chime': [784, 1175, 1568].forEach((f, i) => this.pluck(f, t + i * 0.12, 0.2, 2.0, this.sfx)); break;
      case 'door': noise(t, 0.4, 0.5, 400); tone(140, t + 0.1, 0.2, 0.4, 'triangle', 90); break;
      case 'meow': tone(700, t, 0.15, 0.35, 'sawtooth', 500); break;
      case 'whoosh': noise(t, 0.4, 0.6, 900); break;
    }
  }
}
