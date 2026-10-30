/**
 * Procedural audio, no assets. A cozy lo-fi street-food loop (koto melody, electric piano, upright bass, brushed kit)
 * over the J-pop "royal road" progression, a Tokyo soundscape (sparrows by day, bell crickets by night, furin chimes,
 * grill crackle, canal water) and soft, rounded UI sounds.
 * Every note and sound is synthesised once into a small mono buffer and then replayed, so at runtime a note costs a
 * buffer source and a gain node. Rendering is spread over frames by a warm-up queue.
 */

export type SfxName = 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh';

const SR = 32000; // render rate for synthesised buffers (Safari needs >= 22050)
const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const noise = () => Math.random() * 2 - 1;

/** Chamberlin state-variable filter, used inside renders. */
class SVF {
  low = 0; band = 0;
  constructor(private sr: number, private q = 0.5) {}
  run(x: number, fc: number): number {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, this.sr / 6) / this.sr);
    this.low += f * this.band;
    const high = x - this.low - this.q * this.band;
    this.band += f * high;
    return this.band;
  }
}

// ---- song data (C major; MIDI notes) ----
/** [bass root, 4-voice voicing] */
const CHORDS: number[][] = [
  [41, 53, 57, 60, 64], // 0 Fmaj7
  [43, 53, 57, 59, 64], // 1 G13
  [40, 52, 55, 59, 62], // 2 Em7
  [45, 55, 59, 60, 64], // 3 Am9
  [38, 53, 57, 60, 64], // 4 Dm9
  [36, 52, 55, 59, 62], // 5 Cmaj9
  [40, 52, 56, 59, 62], // 6 E7
];
const PROG_A = [0, 1, 2, 3, 4, 1, 5, 5];
const PROG_B = [0, 1, 6, 3, 0, 1, 5, 5];

/** Per bar: [step (8ths), note, length in steps] */
type Phrase = [number, number, number][][];
const MEL_1: Phrase = [
  [[2, 72, 1], [3, 74, 1], [4, 76, 4]],
  [[0, 74, 2], [2, 67, 2], [4, 74, 1], [5, 76, 1], [6, 74, 2]],
  [[0, 71, 3], [4, 67, 2], [6, 76, 2]],
  [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 69, 4]],
  [[2, 69, 1], [3, 72, 1], [4, 74, 2], [6, 77, 2]],
  [[0, 76, 2], [2, 74, 2], [4, 71, 4]],
  [[0, 72, 3], [3, 74, 1], [4, 76, 2], [6, 79, 2]],
  [[0, 76, 6]],
];
const MEL_2: Phrase = [
  [[0, 81, 2], [2, 79, 1], [3, 76, 1], [4, 79, 4]],
  [[0, 76, 2], [2, 74, 1], [3, 76, 1], [4, 74, 3], [7, 71, 1]],
  [[0, 71, 3], [3, 74, 1], [4, 76, 2], [6, 74, 1], [7, 71, 1]],
  [[0, 72, 4], [4, 69, 2], [6, 76, 2]],
  [[0, 84, 2], [2, 81, 2], [4, 79, 2], [6, 76, 2]],
  [[0, 74, 3], [3, 76, 1], [4, 77, 2], [6, 74, 2]],
  [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 74, 2], [6, 67, 2]],
  [[0, 72, 6]],
];

interface Section { prog: number[]; mel?: Phrase; arp?: boolean; bass: boolean; drums: 0 | 1 | 2 }
/** The loop: an intro, then verse / chorus / koto break / verse / chorus / a quiet breather, back to the verse. */
const SONG: Section[] = [
  { prog: PROG_A, bass: false, drums: 1 },
  { prog: PROG_A, mel: MEL_1, bass: true, drums: 2 },
  { prog: PROG_B, mel: MEL_2, bass: true, drums: 2 },
  { prog: PROG_A, arp: true, bass: true, drums: 2 },
  { prog: PROG_A, mel: MEL_1, bass: true, drums: 2 },
  { prog: PROG_B, mel: MEL_2, bass: true, drums: 2 },
  { prog: PROG_B, arp: true, bass: true, drums: 0 },
];

/** A semitone or whole tone below, staying in the scale: the koto's little lead-in. */
const graceOf = (m: number) => m - ([0, 5].includes(m % 12) ? 1 : 2);

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private musicTone!: BiquadFilterNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  private bed!: GainNode;
  private sizzle!: GainNode;
  private water!: GainNode;
  private events!: GainNode;
  private verb!: ConvolverNode;
  private koto!: AudioNode;
  private ep!: AudioNode;
  private bass!: AudioNode;
  private drums!: AudioNode;
  private bufs = new Map<string, AudioBuffer>();
  private warm: [string, () => AudioBuffer][] = [];
  // sequencer
  private nextTime = 0;
  private sec = 0;
  private bar = 0;
  private step = 0;
  private bpm = 84;
  // ambience
  private night = 0;
  private inside = false;
  private nextBird = 0;
  private nextCricket = 0;
  private nextFurin = 0;
  private nextDrop = 0;
  private waterLevel = 0;
  musicOn = true;
  sfxOn = true;

  start(): void {
    if (this.ctx) { if (this.ctx.state !== 'running' && !document.hidden) void this.ctx.resume(); return; }
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
    this.master = this.gain(0.9, comp);
    comp.connect(ctx.destination);

    // shared room reverb
    this.verb = ctx.createConvolver();
    this.verb.buffer = this.impulse(1.6);
    this.verb.connect(this.gain(0.32, this.master));

    // music bus: instruments -> on/off -> warm tone filter -> level (+ reverb send)
    const level = this.gain(0.42, this.master);
    level.connect(this.gain(0.55, this.verb));
    this.musicTone = ctx.createBiquadFilter();
    this.musicTone.type = 'lowpass'; this.musicTone.frequency.value = 9000; this.musicTone.Q.value = 0.4;
    this.musicTone.connect(level);
    this.music = this.gain(this.musicOn ? 1 : 0, this.musicTone);
    this.koto = this.pan(-0.22, this.gain(1, this.music));
    this.ep = this.pan(0.18, this.gain(1, this.music));
    this.bass = this.gain(1, this.music);
    this.drums = this.pan(0.06, this.gain(1, this.music));

    this.sfx = this.gain(this.sfxOn ? 0.75 : 0, this.master);
    this.sfx.connect(this.gain(0.25, this.verb));

    // ambience: city bed, grill crackle and canal water loops, plus sparse critters and chimes
    this.amb = this.gain(this.sfxOn ? 1 : 0, this.master);
    const brown = this.render(4, 22050, () => { let b = 0; return () => (b = 0.985 * b + 0.06 * noise()); }, true);
    this.bed = this.gain(0.05, this.amb);
    this.loop(brown, 1, this.filter('lowpass', 650, 0.3, this.bed));
    this.sizzle = this.gain(0, this.amb);
    this.loop(this.sizzleLoop(), 1, this.sizzle);
    this.water = this.gain(0, this.amb);
    const swell = this.gain(0.6, this.filter('lowpass', 420, 0.5, this.water));
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
    lfo.connect(this.gain(0.4, swell.gain)); lfo.start();
    this.loop(brown, 0.63, swell);
    this.events = this.gain(1, this.amb);
    this.events.connect(this.gain(0.6, this.verb));

    const now = ctx.currentTime;
    this.nextTime = now + 0.4;
    this.nextBird = now + rand(3, 8);
    this.nextCricket = now + rand(2, 5);
    this.nextFurin = now + rand(12, 25);

    // queue the song's notes so they're rendered a couple per frame before they're needed
    const q = new Set<string>();
    for (const c of CHORDS) {
      c.slice(1).forEach((m) => { q.add(`ep${m}`); q.add(`koto${m + 12}`); });
      [0, 7, 12].forEach((d) => q.add(`bass${c[0] + d}`));
    }
    for (const p of [MEL_1, MEL_2]) for (const b of p) for (const n of b) { q.add(`koto${n[1]}`); q.add(`koto${graceOf(n[1])}`); }
    for (const k of q) this.warm.push([k, () => this.note(k)]);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (!this.ctx) return;
    this.music.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.4);
  }

  setSfx(on: boolean): void {
    this.sfxOn = on;
    if (!this.ctx) return;
    this.sfx.gain.setTargetAtTime(on ? 0.75 : 0, this.ctx.currentTime, 0.1);
    this.amb.gain.setTargetAtTime(on ? 1 : 0, this.ctx.currentTime, 0.4);
  }

  /** Ambient proximity: 0..1 for grills and water, plus time of day and whether we're in the hidden restaurant. */
  ambience(sizzle: number, water: number, night: number, inside = false): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.night = night;
    this.waterLevel = water;
    if (inside !== this.inside) {
      this.inside = inside;
      // indoors the street tune drifts in muffled through the shoji
      this.musicTone.frequency.setTargetAtTime(inside ? 1500 : 9000, t, 0.5);
    }
    this.sizzle.gain.setTargetAtTime(sizzle * sizzle * 0.22, t, 0.4);
    this.water.gain.setTargetAtTime(water * 0.5, t, 0.6);
    this.bed.gain.setTargetAtTime(inside ? 0.012 : 0.05 * (1 - night * 0.45), t, 1.0);
  }

  /** Called every frame: runs the music sequencer, ambient critters and the render warm-up queue. */
  tick(night: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.night = night;
    for (let i = 0; i < 2 && this.warm.length; i++) { const [k, f] = this.warm.shift()!; if (!this.bufs.has(k)) this.bufs.set(k, f()); }
    const now = ctx.currentTime;
    if (this.musicOn) {
      if (this.nextTime < now) this.nextTime = now + 0.05; // after a stall, don't burst-play the backlog
      while (this.nextTime < now + 0.25) {
        const e = 30 / this.bpm;
        this.playStep(this.nextTime, e);
        this.nextTime += (this.step % 2 === 0 ? 1.16 : 0.84) * e; // gentle swing
        this.advance();
      }
    }
    if (this.sfxOn) this.critters(now);
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime + 0.005, out = this.sfx;
    const fire = (k: string, when: number, vol: number, rate = 1, release?: number) => this.fire(this.buf(k), when, vol, out, rate, release);
    switch (name) {
      case 'click': fire('tok', t, 0.32, rand(0.96, 1.05)); break;
      case 'pop': fire('pop', t, 0.42, rand(0.92, 1.1)); break;
      case 'coin':
        fire('bell95', t, 0.2);
        fire('bell100', t + 0.075, 0.24);
        break;
      case 'stamp': fire('stamp', t, 0.7); break;
      case 'success':
        [72, 76, 79, 84].forEach((m, i) => fire(`koto${m}`, t + i * 0.075, 0.55 - i * 0.05));
        fire('bell96', t + 0.3, 0.16);
        break;
      case 'fail':
        fire('koto67', t, 0.32, 1, 0.12);
        fire('koto63', t + 0.13, 0.3, 1, 0.35);
        break;
      case 'sizzle': fire('sear', t, 0.55, rand(0.95, 1.05)); break;
      case 'chop': fire('chop', t, 0.6, rand(0.9, 1.1)); break;
      case 'chime': this.furin(t, out, 0.22); break;
      case 'door':
        fire('slide', t, 0.6);
        fire('bell91', t + 0.42, 0.14);
        fire('bell96', t + 0.52, 0.12);
        break;
      case 'meow': fire('meow', t, 0.32, rand(0.92, 1.12)); break;
      case 'whoosh': fire('whoosh', t, 0.42, rand(0.95, 1.05)); break;
    }
  }

  // ---- sequencer ----

  private advance(): void {
    if (++this.step < 8) return;
    this.step = 0;
    this.bpm = 84 - 12 * Math.min(1, this.night); // laid back at night
    if (++this.bar < 8) return;
    this.bar = 0;
    if (++this.sec >= SONG.length) this.sec = 1;
  }

  private playStep(t: number, e: number): void {
    const sec = SONG[this.sec], s = this.step, bar = this.bar;
    const ch = CHORDS[sec.prog[bar]];
    const night = this.night > 0.5;
    const h = () => t + rand(-0.006, 0.006);
    const v = (x: number) => x * rand(0.85, 1.1);

    // electric piano: a slow strum on the downbeat, a soft push on the "and" of 3 every other bar
    if (s === 0) ch.slice(1).forEach((m, i) => this.fire(this.buf(`ep${m}`), t + i * 0.022 + rand(0, 0.01), v(0.2), this.ep, 1, e * 7.6));
    if (s === 5 && bar % 2 === 1 && sec.drums) ch.slice(2).forEach((m, i) => this.fire(this.buf(`ep${m}`), t + i * 0.015, v(0.09), this.ep, 1, e * 2.6));

    // bass: root, a pickup and a walk to the fifth or octave
    if (sec.bass) {
      const b = ch[0];
      if (s === 0) this.fire(this.buf(`bass${b}`), t, v(0.75), this.bass, 1, e * 2.7);
      if (s === 3 && !night) this.fire(this.buf(`bass${b}`), h(), v(0.4), this.bass, 1, e * 0.9);
      if (s === 6) this.fire(this.buf(`bass${b + (bar % 2 ? 12 : 7)}`), h(), v(0.5), this.bass, 1, e * 1.6);
    }

    // brushed kit; at night just the shaker and brush
    if (sec.drums) {
      this.fire(this.buf('shaker'), h(), v(s % 2 ? 0.2 : 0.11), this.drums);
      if (sec.drums === 2) {
        if (!night && (s === 0 || s === 5)) this.fire(this.buf('kick'), t, v(s ? 0.5 : 0.7), this.drums);
        if (s === 2 || s === 6) this.fire(this.buf('brush'), h(), v(night ? 0.22 : 0.32), this.drums);
      } else if (s === 6) this.fire(this.buf('brush'), h(), v(0.16), this.drums);
    }

    // koto lead with the odd grace-note ornament
    if (sec.mel) {
      for (const [at, m, len] of sec.mel[bar]) {
        if (at !== s) continue;
        if (len >= 2 && Math.random() < 0.18) this.fire(this.buf(`koto${graceOf(m)}`), t - 0.055, v(0.2), this.koto, 1, 0.06);
        this.fire(this.buf(`koto${m}`), h(), v(night ? 0.42 : 0.5), this.koto, 1, e * len + 0.35);
      }
    }
    // koto break: loose arpeggios from the chord
    if (sec.arp && Math.random() < (s % 2 ? 0.18 : 0.62)) {
      const m = ch[1 + Math.floor(Math.random() * 4)] + 12;
      this.fire(this.buf(`koto${m}`), h(), v(0.3), this.koto, 1, e * 3);
    }
  }

  // ---- ambience events ----

  private critters(now: number): void {
    const out = !this.inside;
    if (now > this.nextBird) {
      if (out && this.night < 0.35) {
        const pan = rand(-0.8, 0.8);
        for (let i = 0, n = 1 + Math.floor(rand(0, 3)); i < n; i++) this.fire(this.buf('chirp'), now + 0.05 + i * rand(0.18, 0.32), rand(0.05, 0.11), this.events, rand(0.9, 1.15), undefined, pan);
      }
      this.nextBird = now + rand(5, 14);
    }
    if (now > this.nextCricket) {
      if (out && this.night > 0.5) this.fire(this.buf('cricket'), now + 0.05, rand(0.025, 0.05) * this.night, this.events, rand(0.97, 1.03), undefined, rand(-0.9, 0.9));
      this.nextCricket = now + rand(1.4, 4);
    }
    if (now > this.nextFurin) {
      if (out) this.furin(now + 0.05, this.events, 0.07, rand(-0.6, 0.6));
      this.nextFurin = now + rand(22, 50);
    }
    if (this.waterLevel > 0.35 && now > this.nextDrop) {
      this.fire(this.buf('drop'), now + 0.05, rand(0.03, 0.07) * this.waterLevel, this.events, rand(0.8, 1.3), undefined, rand(-0.5, 0.5));
      this.nextDrop = now + rand(0.6, 3);
    } else if (now > this.nextDrop) this.nextDrop = now + 1;
  }

  /** A furin (glass wind bell) catching the breeze. */
  private furin(t: number, dest: AudioNode, vol: number, pan = 0): void {
    const notes = [93, 96, 98, 100, 103];
    let at = t;
    for (let i = 0, n = 2 + Math.floor(rand(0, 3)); i < n; i++) {
      this.fire(this.buf(`bell${notes[Math.floor(rand(0, notes.length))]}`), at, vol * rand(0.6, 1), dest, 1, undefined, pan);
      at += rand(0.09, 0.28);
    }
  }

  // ---- playback helpers ----

  private fire(b: AudioBuffer, when: number, vol: number, dest: AudioNode, rate = 1, release?: number, pan = 0): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = b;
    s.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    s.connect(g).connect(pan ? this.pan(pan, dest) : dest);
    s.start(Math.max(when, ctx.currentTime));
    if (release !== undefined) {
      g.gain.setValueAtTime(vol, when + release);
      g.gain.setTargetAtTime(0, when + release, 0.07);
      s.stop(when + release + 0.5);
    }
  }

  private loop(b: AudioBuffer, rate: number, dest: AudioNode): void {
    const s = this.ctx!.createBufferSource();
    s.buffer = b; s.loop = true; s.playbackRate.value = rate;
    s.connect(dest); s.start();
  }

  private gain(v: number, dest: AudioNode | AudioParam): GainNode {
    const g = this.ctx!.createGain();
    g.gain.value = v;
    g.connect(dest as AudioNode);
    return g;
  }

  private pan(p: number, dest: AudioNode): AudioNode {
    if (!this.ctx!.createStereoPanner) return dest;
    const n = this.ctx!.createStereoPanner();
    n.pan.value = p;
    n.connect(dest);
    return n;
  }

  private filter(type: BiquadFilterType, freq: number, q: number, dest: AudioNode): BiquadFilterNode {
    const f = this.ctx!.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    f.connect(dest);
    return f;
  }

  // ---- synthesis ----

  private buf(k: string): AudioBuffer {
    let b = this.bufs.get(k);
    if (!b) { b = this.note(k); this.bufs.set(k, b); }
    return b;
  }

  /** Render a mono buffer from a per-sample generator (the factory gets fresh filter state). */
  private render(dur: number, sr: number, gen: () => (t: number) => number, seamless = false): AudioBuffer {
    const n = Math.ceil(dur * sr);
    const xf = seamless ? Math.floor(sr * 0.25) : 0; // loops render a little extra and crossfade it into the start
    const f = gen();
    const y = new Float32Array(n + xf);
    for (let i = 0; i < n + xf; i++) y[i] = f(i / sr);
    for (let i = 0; i < xf; i++) { const u = i / xf; y[i] = y[i] * Math.sqrt(u) + y[n + i] * Math.sqrt(1 - u); }
    let peak = 1e-6;
    for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(y[i]));
    const fade = seamless ? 0 : Math.min(n, Math.floor(sr * 0.02));
    const b = this.ctx!.createBuffer(1, n, sr);
    const d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (y[i] / peak) * (i >= n - fade ? (n - 1 - i) / fade : 1);
    return b;
  }

  private note(k: string): AudioBuffer {
    const m = Number(k.replace(/^\D+/, ''));
    const kind = k.replace(/\d+$/, '');
    switch (kind) {
      case 'ep': return this.renderEp(m);
      case 'koto': return this.renderKoto(m);
      case 'bass': return this.renderBass(m);
      case 'bell': return this.renderBell(m);
    }
    return this.renderSfx(k);
  }

  /** Warm FM electric piano with a slight chorus. */
  private renderEp(m: number): AudioBuffer {
    const f = mtof(m), dec = 1.0 + f / 900;
    return this.render(2.8, SR, () => (t) => {
      const env = Math.min(1, t / 0.004) * Math.exp(-t * dec);
      const idx = 1.4 * Math.exp(-t * 7) + 0.22;
      const a = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t));
      const b = Math.sin(TAU * f * 1.0025 * t + idx * 0.8 * Math.sin(TAU * f * 1.0025 * t));
      const tine = 0.12 * Math.sin(TAU * f * 7.02 * t) * Math.exp(-t * 28);
      return (a * 0.62 + b * 0.38 + tine) * env;
    });
  }

  /** Karplus-Strong plucked string; the buffer's sample rate is picked so the delay line tunes exactly. */
  private renderKoto(m: number): AudioBuffer {
    const f = mtof(m);
    const N = Math.max(4, Math.round(SR / f - 0.5));
    const sr = f * (N + 0.5);
    const len = Math.ceil(sr * 2.4);
    const y = new Float32Array(len);
    let lp = 0;
    for (let i = 0; i <= N && i < len; i++) { lp = 0.6 * lp + 0.4 * noise(); y[i] = lp; }
    const keep = 10 ** (-3 / (f * Math.max(1.2, 3.6 - f / 600))); // per-period loss for the wanted ring time
    for (let i = N + 1; i < len; i++) y[i] = keep * 0.5 * (y[i - N] + y[i - N - 1]);
    let dc = 0, prev = 0, peak = 1e-6;
    for (let i = 0; i < len; i++) { // remove DC
      dc = y[i] - prev + 0.995 * dc; prev = y[i];
      y[i] = dc;
      peak = Math.max(peak, Math.abs(y[i]));
    }
    const b = this.ctx!.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    const fade = Math.floor(sr * 0.05);
    for (let i = 0; i < len; i++) d[i] = (y[i] / peak) * (i > len - fade ? (len - i) / fade : 1);
    return b;
  }

  /** Round upright-ish bass with a soft finger thump. */
  private renderBass(m: number): AudioBuffer {
    const f = mtof(m);
    return this.render(2.2, SR, () => (t) => {
      const env = Math.min(1, t / 0.01) * Math.exp(-t * 1.8);
      const p = TAU * f * t;
      const thump = Math.sin(TAU * 90 * t) * Math.exp(-t * 40) * 0.25;
      return (Math.sin(p) + 0.5 * Math.sin(2 * p) * Math.exp(-t * 1.2) + 0.12 * Math.sin(3 * p) * Math.exp(-t * 4)) * env + thump;
    });
  }

  /** Small glassy bell (furin, coins, door bell). */
  private renderBell(m: number): AudioBuffer {
    const f = mtof(m);
    const parts = [[1, 1, 2.2], [2.76, 0.42, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 12]].filter((p) => p[0] * f < SR * 0.47);
    return this.render(2.4, SR, () => (t) => {
      let s = 0;
      for (const [r, a, d] of parts) s += a * Math.sin(TAU * f * r * t) * Math.exp(-t * d);
      return s * Math.min(1, t / 0.002);
    });
  }

  private renderSfx(k: string): AudioBuffer {
    switch (k) {
      case 'kick': return this.render(0.35, SR, () => { let ph = 0; return (t) => {
        ph += TAU * (46 + 64 * Math.exp(-t * 28)) / SR;
        return Math.sin(ph) * Math.exp(-t * 9) * Math.min(1, t / 0.003);
      }; });
      case 'brush': return this.render(0.3, SR, () => { const bp = new SVF(SR, 0.9); return (t) =>
        bp.run(noise(), 3200) * Math.min(1, t / 0.006) * Math.exp(-t * 14) + 0.25 * Math.sin(TAU * 185 * t) * Math.exp(-t * 35);
      });
      case 'shaker': return this.render(0.09, SR, () => { let lp = 0; return (t) => {
        const x = noise(); lp += 0.35 * (x - lp);
        return (x - lp) * Math.min(1, t / 0.012) * Math.exp(-t * 55);
      }; });
      case 'tok': return this.render(0.08, SR, () => (t) => // wooden tap
        (Math.sin(TAU * 820 * t * (1 + 0.15 * Math.exp(-t * 90))) + 0.3 * Math.sin(TAU * 2140 * t) * Math.exp(-t * 90)) * Math.exp(-t * 60) * Math.min(1, t / 0.001));
      case 'pop': return this.render(0.16, SR, () => { let ph = 0; return (t) => { // a bubble going "bloop"
        ph += TAU * (300 + 650 * (1 - Math.exp(-t * 30))) / SR;
        return Math.sin(ph) * Math.min(1, t / 0.005) * Math.exp(-t * 26);
      }; });
      case 'stamp': return this.render(0.32, SR, () => { let ph = 0, lp = 0; return (t) => { // rubber on paper
        ph += TAU * (55 + 110 * Math.exp(-t * 30)) / SR;
        lp += 0.2 * (noise() - lp);
        return Math.sin(ph) * Math.exp(-t * 13) + lp * 1.4 * Math.exp(-t * 45);
      }; });
      case 'sear': return this.render(0.8, SR, () => { let lp = 0, pop = 0; return (t) => { // ingredient hits the pan
        const x = noise(); lp += 0.5 * (x - lp);
        if (Math.random() < 0.004) pop = rand(0.5, 1.2);
        pop *= 0.97;
        return ((x - lp) * 0.5 + pop * noise()) * Math.min(1, t / 0.015) * Math.exp(-t * 3.5);
      }; });
      case 'chop': return this.render(0.14, SR, () => { const bp = new SVF(SR, 0.7); return (t) => // knife through to the board
        bp.run(noise(), 3000) * Math.exp(-t * 110) * 0.8 + Math.sin(TAU * 200 * t) * Math.exp(-t * 40);
      });
      case 'slide': return this.render(0.6, SR, () => { const bp = new SVF(SR, 0.6); return (t) => { // a wooden sliding door
        const glide = t < 0.42 ? Math.sin(Math.PI * t / 0.42) ** 1.5 : 0;
        const clack = t > 0.42 ? (Math.sin(TAU * 330 * t) + 0.5 * Math.sin(TAU * 910 * t)) * Math.exp(-(t - 0.42) * 50) : 0;
        return bp.run(noise(), 500 + 400 * t) * glide * 0.9 + clack * 0.7;
      }; });
      case 'meow': return this.render(0.6, SR, () => { // "mi-a-ow": harmonic source through two moving formants
        let ph = 0; const f1 = new SVF(SR, 0.25), f2 = new SVF(SR, 0.25);
        return (t) => {
          const f0 = t < 0.15 ? 470 + 1700 * t : 725 - 360 * (t - 0.15);
          ph += TAU * f0 / SR;
          let src = 0;
          for (let h = 1; h <= 7; h++) src += Math.sin(h * ph) / h;
          const u = Math.min(1, t / 0.5);
          const F1 = u < 0.3 ? 350 + 1600 * u : 830 - 600 * (u - 0.3);
          const F2 = u < 0.3 ? 2200 - 2600 * u : 1420 - 700 * (u - 0.3);
          const env = Math.min(1, t / 0.05) * (t > 0.42 ? Math.max(0, 1 - (t - 0.42) / 0.16) : 1);
          return (f1.run(src, F1) + 0.6 * f2.run(src, F2)) * env;
        };
      });
      case 'whoosh': return this.render(0.55, SR, () => { const bp = new SVF(SR, 0.8); return (t) => {
        const u = t / 0.55;
        return bp.run(noise(), 350 + 1300 * Math.sin(Math.PI * u)) * Math.sin(Math.PI * u) ** 2;
      }; });
      case 'chirp': return this.render(0.14, SR, () => (t) => { // one sparrow "tsip"
        const f = 3600 + 1800 * Math.sin(Math.PI * Math.min(1, t / 0.07));
        return Math.sin(TAU * f * t) * Math.sin(Math.PI * Math.min(1, t / 0.09)) ** 2;
      });
      case 'cricket': return this.render(1.1, SR, () => (t) => { // suzumushi: a ringing "riiin"
        const trill = Math.abs(Math.sin(Math.PI * 38 * t)) ** 3;
        return Math.sin(TAU * 4300 * t) * trill * Math.min(1, t / 0.08) * Math.exp(-t * 2.2);
      });
      case 'drop': return this.render(0.12, SR, () => { let ph = 0; return (t) => {
        ph += TAU * (700 + 900 * (1 - Math.exp(-t * 60))) / SR;
        return Math.sin(ph) * Math.min(1, t / 0.002) * Math.exp(-t * 45);
      }; });
    }
    throw new Error(`unknown sound ${k}`);
  }

  /** Steady grill crackle for standing near the stalls (loops seamlessly). */
  private sizzleLoop(): AudioBuffer {
    return this.render(3, SR, () => { let lp = 0, pop = 0; return (t) => {
      const x = noise(); lp += 0.45 * (x - lp);
      if (Math.random() < 0.0012) pop = rand(0.4, 1.4);
      pop *= 0.94;
      return (x - lp) * (0.35 + 0.12 * Math.sin(TAU * t / 1.5)) + pop * noise();
    }; }, true);
  }

  /** Stereo room impulse: decaying noise that darkens over time. */
  private impulse(dur: number): AudioBuffer {
    const ctx = this.ctx!, sr = ctx.sampleRate, n = Math.floor(dur * sr);
    const b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        lp += (0.9 - 0.8 * t / dur) * (noise() - lp);
        d[i] = lp * Math.exp(-t * 3.2) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return b;
  }
}
