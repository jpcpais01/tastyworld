/**
 * Procedural audio, no assets. A cozy lo-fi street-food loop (koto melody, electric piano, upright bass, brushed kit)
 * over the J-pop "royal road" progression, a deliberately quiet street (a soft city hush, the canal lapping, the odd
 * sparrow by day and bell cricket by night, a faint grill crackle) and soft, rounded UI sounds.
 * Music, ambience and effects each have their own volume.
 * Every note and sound is synthesised once into a small mono buffer and then replayed, so at runtime a note costs a
 * buffer source and a gain node. Rendering is spread over frames by a warm-up queue.
 */

import { FLOORS, SOUND_SPOTS, Floor } from '../data/soundscape';

export type SfxName = 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh'
  | 'bite' | 'crunch' | 'slurp' | 'sip' | 'drip' | 'blow' | 'clink' | 'rustle' | 'yum';

export interface AudioRoom { rect: [number, number, number, number]; kind: string }

const SR = 32000; // render rate for bright one-shots
const LSR = 22050; // render rate for mellow notes and footsteps (Safari needs >= 22050)
const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
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

// ---- songs (MIDI notes) ----

/** Per bar: [step (8ths), note, length in steps] */
type Phrase = [number, number, number][][];
interface Section { prog: number[]; mel?: Phrase; arp?: boolean; bass: boolean; drums: 0 | 1 | 2 }
interface Song {
  /** [bass root, 4-voice voicing] */
  chords: number[][];
  bpm: number;
  swing: number;
  sections: Section[];
  loopFrom: number;
}
type Inst = 'koto' | 'bell' | 'ep' | 'bass';
interface Out { lead: AudioNode; ep: AudioNode; bass: AudioNode; drums: AudioNode }
interface Seq { song: Song; t: number; sec: number; bar: number; step: number; out: Out; bpm: number }

/** The background tune, in C: an intro, then verse / chorus / koto break / verse / chorus / a quiet breather. */
const BGM: Song = (() => {
  const A = [0, 1, 2, 3, 4, 1, 5, 5], B = [0, 1, 6, 3, 0, 1, 5, 5];
  const m1: Phrase = [
    [[2, 72, 1], [3, 74, 1], [4, 76, 4]],
    [[0, 74, 2], [2, 67, 2], [4, 74, 1], [5, 76, 1], [6, 74, 2]],
    [[0, 71, 3], [4, 67, 2], [6, 76, 2]],
    [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 69, 4]],
    [[2, 69, 1], [3, 72, 1], [4, 74, 2], [6, 77, 2]],
    [[0, 76, 2], [2, 74, 2], [4, 71, 4]],
    [[0, 72, 3], [3, 74, 1], [4, 76, 2], [6, 79, 2]],
    [[0, 76, 6]],
  ];
  const m2: Phrase = [
    [[0, 81, 2], [2, 79, 1], [3, 76, 1], [4, 79, 4]],
    [[0, 76, 2], [2, 74, 1], [3, 76, 1], [4, 74, 3], [7, 71, 1]],
    [[0, 71, 3], [3, 74, 1], [4, 76, 2], [6, 74, 1], [7, 71, 1]],
    [[0, 72, 4], [4, 69, 2], [6, 76, 2]],
    [[0, 84, 2], [2, 81, 2], [4, 79, 2], [6, 76, 2]],
    [[0, 74, 3], [3, 76, 1], [4, 77, 2], [6, 74, 2]],
    [[0, 76, 2], [2, 74, 1], [3, 72, 1], [4, 74, 2], [6, 67, 2]],
    [[0, 72, 6]],
  ];
  return {
    chords: [
      [41, 53, 57, 60, 64], // Fmaj7
      [43, 53, 57, 59, 64], // G13
      [40, 52, 55, 59, 62], // Em7
      [45, 55, 59, 60, 64], // Am9
      [38, 53, 57, 60, 64], // Dm9
      [36, 52, 55, 59, 62], // Cmaj9
      [40, 52, 56, 59, 62], // E7
    ],
    bpm: 84, swing: 0.58, loopFrom: 1,
    sections: [
      { prog: A, bass: false, drums: 1 },
      { prog: A, mel: m1, bass: true, drums: 2 },
      { prog: B, mel: m2, bass: true, drums: 2 },
      { prog: A, arp: true, bass: true, drums: 2 },
      { prog: A, mel: m1, bass: true, drums: 2 },
      { prog: B, mel: m2, bass: true, drums: 2 },
      { prog: B, arp: true, bass: true, drums: 0 },
    ],
  };
})();

/** A semitone or whole tone below, staying in the scale: the koto's little lead-in. */
const graceOf = (m: number) => m - ([0, 5].includes(m % 12) ? 1 : 2);

const TILE_ROOMS = ['konbini', 'pharmacy', 'bakery', 'fish'];
const inRect = (r: readonly number[], x: number, z: number) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private musicLevel!: GainNode;
  private musicTone!: BiquadFilterNode;
  private sfx!: GainNode;
  private amb!: GainNode;
  /** Outdoor sounds: muffled and quieter while the listener is inside a shop. */
  private street!: GainNode;
  private streetTone!: BiquadFilterNode;
  private bed!: GainNode;
  private sizzle!: GainNode;
  private water!: GainNode;
  private verb!: ConvolverNode;
  private bgmOut!: Out;
  private bufs = new Map<string, AudioBuffer>();
  private warm: string[] = [];
  private bgm!: Seq;
  // listener
  private lx = 0;
  private lz = 0;
  private lroom = -1;
  private rooms: AudioRoom[] = [];
  private night = 0;
  private inside = false;
  private timers: Record<string, number> = {};
  /** Volumes 0..1 for the music, the world around you and UI/cooking effects. */
  private vol = { music: 0.8, amb: 0.6, sfx: 0.8 };

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

    // music bus: instruments -> volume -> warm tone filter -> level (+ reverb send)
    this.musicLevel = this.gain(0.36, this.master);
    this.musicLevel.connect(this.gain(0.55, this.verb));
    this.musicTone = this.filter('lowpass', 9000, 0.4, this.musicLevel);
    this.music = this.gain(0, this.musicTone);
    this.bgmOut = {
      lead: this.pan(-0.22, this.gain(1, this.music)),
      ep: this.pan(0.18, this.gain(1, this.music)),
      bass: this.gain(1, this.music),
      drums: this.pan(0.06, this.gain(1, this.music)),
    };

    this.sfx = this.gain(0, this.master);
    this.sfx.connect(this.gain(0.25, this.verb));

    // ambience: a quiet bed that stays out of the way
    this.amb = this.gain(0, this.master);
    this.amb.connect(this.gain(0.2, this.verb));
    this.streetTone = this.filter('lowpass', 16000, 0.3, this.amb);
    this.street = this.gain(1, this.streetTone);
    const brown = this.render(4, LSR, () => { let b = 0; return () => (b = 0.985 * b + 0.06 * noise()); }, true);
    this.bed = this.gain(0.03, this.street);
    this.loop(brown, 1, this.filter('lowpass', 500, 0.3, this.bed));
    this.sizzle = this.gain(0, this.street);
    this.loop(this.sizzleLoop(), 1, this.filter('lowpass', 7000, 0.3, this.sizzle));
    this.water = this.gain(0, this.street);
    const swell = this.gain(0.6, this.filter('lowpass', 380, 0.5, this.water));
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.15;
    lfo.connect(this.gain(0.4, swell.gain)); lfo.start();
    this.loop(brown, 0.6, swell);
    this.setVolumes(this.vol.music, this.vol.amb, this.vol.sfx);

    const now = ctx.currentTime;
    this.bgm = { song: BGM, t: now + 0.4, sec: 0, bar: 0, step: 0, out: this.bgmOut, bpm: BGM.bpm };
    this.timers.bird = now + rand(15, 40);
    this.timers.cricket = now + rand(5, 12);

    // queue the tune's notes and footsteps so they're rendered a couple per frame before they're needed
    this.queueSong(BGM);
    for (const s of ['stone', 'wood', 'tile', 'gravel', 'grass']) for (let i = 0; i < 3; i++) this.warm.push(`step-${s}-${i}`);
    for (const k of ['bite', 'chew', 'crunch', 'slurp', 'gulp', 'blow', 'rustle', 'drop']) this.warm.push(k);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
  }

  /** Volumes 0..1 (0 is off). Sliders feel more even on a squared curve. */
  setVolumes(music: number, amb: number, sfx: number): void {
    this.vol = { music, amb, sfx };
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.music.gain.setTargetAtTime(music * music, t, 0.3);
    this.amb.gain.setTargetAtTime(amb * amb, t, 0.3);
    this.sfx.gain.setTargetAtTime(sfx * sfx, t, 0.1);
  }

  /** The walkable shops: footsteps and muffling depend on them. */
  setRooms(rooms: AudioRoom[]): void {
    this.rooms = rooms;
  }

  /** Ambient proximity: 0..1 for grills and water, plus time of day and whether we're in the hidden restaurant. */
  ambience(sizzle: number, water: number, night: number, inside = false): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.night = night;
    const pond = this.nearest('water');
    if (pond && !inside) water = Math.max(water, 1 - pond.d / (pond.r ?? 8));
    if (inside !== this.inside) {
      this.inside = inside;
      // indoors the street tune drifts in muffled through the shoji
      this.musicTone.frequency.setTargetAtTime(inside ? 1500 : 9000, t, 0.5);
    }
    this.sizzle.gain.setTargetAtTime(sizzle * sizzle * 0.04, t, 0.6);
    this.water.gain.setTargetAtTime(water * 0.3, t, 0.8);
    this.bed.gain.setTargetAtTime(inside ? 0.01 : 0.03 * (1 - night * 0.4), t, 1.5);
  }

  /** Where the listener is. Call a few times a second. */
  scene(x: number, z: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lx = x; this.lz = z;
    const room = this.inside ? -1 : this.roomAt(x, z);
    if (room !== this.lroom) {
      this.lroom = room;
      this.streetTone.frequency.setTargetAtTime(room >= 0 || this.inside ? 1100 : 16000, t, 0.3);
      this.street.gain.setTargetAtTime(room >= 0 ? 0.55 : 1, t, 0.3);
    }
  }

  /** The player's foot touching the ground (from the walk cycle): barely there, just enough to feel the floor. */
  step(x: number, z: number, run: boolean): void {
    if (!this.ctx || !this.vol.amb) return;
    const k = `step-${this.surfaceAt(x, z)}-${Math.floor(rand(0, 3))}`;
    this.fire(this.buf(k), this.ctx.currentTime + 0.005, (run ? 0.035 : 0.024) * rand(0.7, 1.05), this.amb, rand(0.88, 1.08));
  }

  /** Called every frame: runs the sequencers, ambient life and the render warm-up queue. */
  tick(night: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.night = night;
    for (let i = 0; i < 2 && this.warm.length; i++) this.buf(this.warm.shift()!);
    const now = ctx.currentTime;
    if (this.vol.music) this.runSeq(this.bgm, now);
    if (this.vol.amb) this.life(now);
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.vol.sfx) return;
    const t = this.ctx.currentTime + 0.005, out = this.sfx;
    const fire = (k: string, when: number, vol: number, rate = 1, release?: number) => this.fire(this.buf(k), when, vol, out, rate, release);
    const note = (i: Inst, m: number, when: number, vol: number, release?: number) => this.note(i, m, when, vol, out, release);
    switch (name) {
      case 'click': fire('tok', t, 0.32, rand(0.96, 1.05)); break;
      case 'pop': fire('pop', t, 0.42, rand(0.92, 1.1)); break;
      case 'coin':
        note('bell', 95, t, 0.2);
        note('bell', 100, t + 0.075, 0.24);
        break;
      case 'stamp': fire('stamp', t, 0.7); break;
      case 'success':
        [72, 76, 79, 84].forEach((m, i) => note('koto', m, t + i * 0.075, 0.55 - i * 0.05));
        note('bell', 96, t + 0.3, 0.16);
        break;
      case 'fail':
        note('koto', 67, t, 0.32, 0.12);
        note('koto', 63, t + 0.13, 0.3, 0.35);
        break;
      case 'sizzle': fire('sear', t, 0.55, rand(0.95, 1.05)); break;
      case 'chop': fire('chop', t, 0.6, rand(0.9, 1.1)); break;
      case 'chime': this.furin(t, out, 0.22); break;
      case 'door':
        fire('slide', t, 0.6);
        note('bell', 91, t + 0.42, 0.14);
        note('bell', 96, t + 0.52, 0.12);
        break;
      case 'meow': fire('meow', t, 0.32, rand(0.92, 1.12)); break;
      case 'whoosh': fire('whoosh', t, 0.42, rand(0.95, 1.05)); break;
      // eating
      case 'bite': fire('bite', t, 0.5, rand(0.9, 1.12)); fire('chew', t + 0.22, 0.2, rand(0.9, 1.1)); fire('chew', t + 0.5, 0.16, rand(0.85, 1.05)); break;
      case 'crunch': fire('crunch', t, 0.55, rand(0.92, 1.1)); fire('crunch', t + 0.26, 0.3, rand(0.8, 1.0)); fire('chew', t + 0.55, 0.15); break;
      case 'slurp': fire('slurp', t, 0.5, rand(0.95, 1.06)); break;
      case 'sip': fire('slurp', t, 0.22, 1.5); fire('gulp', t + 0.42, 0.45, rand(0.95, 1.05)); fire('gulp', t + 0.78, 0.35, rand(0.9, 1.0)); break;
      case 'drip': fire('drop', t, 0.18, rand(1.3, 1.5)); break;
      case 'blow': fire('blow', t, 0.42, rand(0.95, 1.05)); break;
      case 'clink': note('bell', 100, t, 0.08, 0.15); fire('tok', t, 0.12, 1.7); break;
      case 'rustle': fire('rustle', t, 0.4, rand(0.95, 1.05)); break;
      case 'yum':
        [76, 79, 83].forEach((m, i) => note('koto', m, t + i * 0.09, 0.42 - i * 0.06));
        note('bell', 95, t + 0.27, 0.12);
        break;
    }
  }

  // ---- space ----

  private roomAt(x: number, z: number): number {
    for (let i = 0; i < this.rooms.length; i++) if (inRect(this.rooms[i].rect, x, z)) return i;
    return -1;
  }

  private surfaceAt(x: number, z: number): Floor {
    if (this.inside) return 'wood';
    const r = this.roomAt(x, z);
    if (r >= 0) return TILE_ROOMS.includes(this.rooms[r].kind) ? 'tile' : 'wood';
    let best: Floor = 'stone', ba = Infinity;
    for (const f of FLOORS) {
      const a = (f.rect[2] - f.rect[0]) * (f.rect[3] - f.rect[1]);
      if (a < ba && inRect(f.rect, x, z)) { best = f.floor; ba = a; }
    }
    return best;
  }

  /** The nearest sound spot of a kind. */
  private nearest(kind: string): { pos: [number, number]; d: number; r?: number } | null {
    let best: { pos: [number, number]; d: number; r?: number } | null = null;
    for (const s of SOUND_SPOTS) {
      if (s.kind !== kind) continue;
      const d = Math.hypot(s.pos[0] - this.lx, s.pos[1] - this.lz);
      if (!best || d < best.d) best = { pos: s.pos, d, r: s.r };
    }
    return best;
  }

  // ---- sequencers ----

  private queueSong(s: Song): void {
    const q = new Set<string>();
    const add = (i: Inst, m: number) => q.add(this.instKey(i, m)[0]);
    for (const c of s.chords) {
      c.slice(1).forEach((m) => { add('ep', m); add('koto', m + 12); });
      for (let d = 0; d <= 12; d++) add('bass', c[0] + d);
    }
    for (const sec of s.sections) for (const b of sec.mel ?? []) for (const n of b) { add('koto', n[1]); add('koto', graceOf(n[1])); }
    for (const k of ['kick', 'brush', 'shaker']) q.add(k);
    for (const k of q) this.warm.push(k);
  }

  private runSeq(q: Seq, now: number): void {
    if (q.t < now) q.t = now + 0.05; // after a stall, don't burst-play the backlog
    while (q.t < now + 0.25) {
      const e = 30 / q.bpm;
      this.playStep(q, q.t, e);
      q.t += (q.step % 2 === 0 ? 2 * q.song.swing : 2 - 2 * q.song.swing) * e;
      if (++q.step < 8) continue;
      q.step = 0;
      q.bpm = q.song.bpm - 12 * Math.min(1, this.night); // the tune is laid back at night
      if (++q.bar < 8) continue;
      q.bar = 0;
      if (++q.sec >= q.song.sections.length) q.sec = q.song.loopFrom;
    }
  }

  private playStep(q: Seq, t: number, e: number): void {
    const song = q.song, sec = song.sections[q.sec], s = q.step, bar = q.bar, o = q.out;
    const ch = song.chords[sec.prog[bar]];
    const night = this.night > 0.5;
    const h = () => t + rand(-0.006, 0.006);
    const v = (x: number) => x * rand(0.85, 1.1);

    // electric piano: a slow strum on the downbeat, a soft push on the "and" of 3 every other bar
    if (s === 0) ch.slice(1).forEach((m, i) => this.note('ep', m, t + i * 0.022 + rand(0, 0.01), v(0.2), o.ep, e * 7.6));
    if (s === 5 && bar % 2 === 1 && sec.drums) ch.slice(2).forEach((m, i) => this.note('ep', m, t + i * 0.015, v(0.09), o.ep, e * 2.6));

    // bass: root, a pickup and a walk to the fifth or octave
    if (sec.bass) {
      const b = ch[0];
      if (s === 0) this.note('bass', b, t, v(0.75), o.bass, e * 2.7);
      if (s === 3 && !night) this.note('bass', b, h(), v(0.4), o.bass, e * 0.9);
      if (s === 6) this.note('bass', b + (bar % 2 ? 12 : 7), h(), v(0.5), o.bass, e * 1.6);
    }

    // brushed kit; at night just the shaker and brush
    if (sec.drums) {
      this.fire(this.buf('shaker'), h(), v(s % 2 ? 0.2 : 0.11), o.drums);
      if (sec.drums === 2) {
        if (!night && (s === 0 || s === 5)) this.fire(this.buf('kick'), t, v(s ? 0.5 : 0.7), o.drums);
        if (s === 2 || s === 6) this.fire(this.buf('brush'), h(), v(night ? 0.22 : 0.32), o.drums);
      } else if (s === 6) this.fire(this.buf('brush'), h(), v(0.16), o.drums);
    }

    // koto lead with the odd grace-note ornament
    if (sec.mel) {
      for (const [at, m, len] of sec.mel[bar]) {
        if (at !== s) continue;
        if (len >= 2 && Math.random() < 0.18) this.note('koto', graceOf(m), t - 0.055, v(0.2), o.lead, 0.06);
        this.note('koto', m, h(), v(night ? 0.42 : 0.5), o.lead, e * len + 0.35);
      }
    }
    // koto break: loose arpeggios from the chord
    if (sec.arp && Math.random() < (s % 2 ? 0.18 : 0.62)) {
      this.note('koto', ch[1 + Math.floor(Math.random() * 4)] + 12, h(), v(0.3), o.lead, e * 3);
    }
  }

  // ---- the street around you: kept sparse on purpose ----

  private life(now: number): void {
    if (this.inside) return;
    const T = this.timers, n = this.night, at = now + 0.05;
    const due = (k: string, a: number, b: number) => {
      if (now < T[k]) return false;
      T[k] = now + rand(a, b);
      return true;
    };
    if (due('bird', 25, 60) && n < 0.3) {
      const pan = rand(-0.8, 0.8);
      for (let i = 0, c = 1 + Math.floor(rand(0, 2)); i < c; i++) this.fire(this.buf('chirp'), at + i * rand(0.2, 0.35), rand(0.025, 0.05), this.street, rand(0.9, 1.15), undefined, pan);
    }
    if (due('cricket', 4, 10) && n > 0.55) this.fire(this.buf('cricket'), at, rand(0.01, 0.02) * n, this.street, rand(0.97, 1.03), undefined, rand(-0.9, 0.9));
  }

  /** A furin (glass wind bell) catching the breeze. */
  private furin(t: number, dest: AudioNode, vol: number, pan = 0): void {
    const notes = [93, 96, 98, 100, 103];
    let at = t;
    for (let i = 0, n = 2 + Math.floor(rand(0, 3)); i < n; i++) {
      this.note('bell', pick(notes), at, vol * rand(0.6, 1), dest, undefined, pan);
      at += rand(0.09, 0.28);
    }
  }

  // ---- playback helpers ----

  /** Notes are rendered every 3 semitones and pitched the rest of the way. */
  private instKey(i: Inst, m: number): [string, number] {
    const base = Math.round(m / 3) * 3;
    return [`${i}${base}`, 2 ** ((m - base) / 12)];
  }

  private note(i: Inst, m: number, when: number, vol: number, dest: AudioNode, release?: number, pan = 0): void {
    const [k, rate] = this.instKey(i, m);
    this.fire(this.buf(k), when, vol, dest, rate, release, pan);
  }

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
    if (!b) { b = this.make(k); this.bufs.set(k, b); }
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

  private make(k: string): AudioBuffer {
    let m: RegExpMatchArray | null;
    if ((m = k.match(/^(ep|koto|bass|bell)(\d+)$/))) {
      const n = Number(m[2]);
      switch (m[1]) {
        case 'ep': return this.renderEp(n);
        case 'koto': return this.renderKoto(n);
        case 'bass': return this.renderBass(n);
        default: return this.renderBell(n);
      }
    }
    if ((m = k.match(/^step-(\w+)-\d$/))) return this.renderStep(m[1] as Floor);
    return this.renderSfx(k);
  }

  /** Warm FM electric piano with a slight chorus. */
  private renderEp(m: number): AudioBuffer {
    const f = mtof(m), dec = 1.0 + f / 900;
    return this.render(2.6, LSR, () => (t) => {
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
    const N = Math.max(4, Math.round(24000 / f - 0.5));
    const sr = f * (N + 0.5);
    const len = Math.ceil(sr * 2.2);
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
    return this.render(2.2, LSR, () => (t) => {
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

  /** One soft footfall (soft soles, no clack) on the given ground. */
  private renderStep(s: Floor): AudioBuffer {
    const bp = new SVF(LSR, 0.9);
    let lp = 0, out = 0, grain = 0;
    const soft = (x: number) => (out += 0.3 * (x - out)); // round off the top end
    const pad = (t: number) => Math.min(1, t / 0.008); // the sole rolls on rather than slapping down
    switch (s) {
      case 'stone': return this.render(0.16, LSR, () => (t) => {
        lp += 0.12 * (noise() - lp);
        return soft((Math.sin(TAU * 85 * t) * 0.6 + lp * 1.6 + bp.run(noise(), 1100) * 0.25) * pad(t) * Math.exp(-t * 38));
      });
      case 'wood': return this.render(0.18, LSR, () => (t) => soft((Math.sin(TAU * 120 * t) * 0.8 + bp.run(noise(), 450) * 0.5) * pad(t) * Math.exp(-t * 35)));
      case 'tile': return this.render(0.12, LSR, () => (t) => soft((Math.sin(TAU * 110 * t) * 0.6 + bp.run(noise(), 1500) * 0.35) * pad(t) * Math.exp(-t * 50)));
      case 'gravel': return this.render(0.22, LSR, () => (t) => {
        if (Math.random() < 0.05) grain = rand(0.4, 1);
        grain *= 0.9;
        return soft(bp.run(noise() * grain, 1600) * Math.min(1, t / 0.015) * Math.exp(-t * 16));
      });
      case 'grass': return this.render(0.16, LSR, () => (t) => {
        lp += 0.1 * (noise() - lp);
        return soft(lp * Math.min(1, t / 0.015) * Math.exp(-t * 26));
      });
    }
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
      case 'bite': return this.render(0.16, SR, () => { const bp = new SVF(SR, 0.8); let ph = 0; return (t) => { // teeth through something soft
        ph += TAU * (150 + 60 * Math.exp(-t * 40)) / SR;
        return bp.run(noise(), 1300) * Math.exp(-t * 38) * 0.9 + Math.sin(ph) * Math.exp(-t * 30) * 0.5 * Math.min(1, t / 0.003);
      }; });
      case 'chew': return this.render(0.12, SR, () => { const bp = new SVF(SR, 1.2); return (t) => // a soft squish
        bp.run(noise(), 520 + 300 * Math.sin(t * 40)) * Math.sin(Math.PI * Math.min(1, t / 0.12)) ** 2;
      });
      case 'crunch': return this.render(0.24, SR, () => { const bp = new SVF(SR, 0.5); let crack = 0; return (t) => { // crisp batter giving way
        if (Math.random() < 0.012 * Math.exp(-t * 8)) crack = rand(0.6, 1.2);
        crack *= 0.93;
        return bp.run(noise(), 3600) * (0.25 * Math.exp(-t * 20) + crack) * Math.min(1, t / 0.002);
      }; });
      case 'slurp': return this.render(0.8, SR, () => { const bp = new SVF(SR, 3); return (t) => { // air pulled through noodles
        const sweep = 700 + 2200 * Math.min(1, t / 0.7);
        const env = Math.sin(Math.PI * Math.min(1, t / 0.8)) * (0.7 + 0.3 * Math.sin(t * 70));
        return bp.run(noise(), sweep) * env;
      }; });
      case 'gulp': return this.render(0.18, SR, () => { let ph = 0; return (t) => { // a swallow
        ph += TAU * (210 - 120 * Math.min(1, t / 0.12)) / SR;
        return Math.sin(ph) * Math.sin(Math.PI * Math.min(1, t / 0.16)) ** 1.5;
      }; });
      case 'blow': return this.render(0.6, SR, () => { const bp = new SVF(SR, 0.7); return (t) => // "fuu": cooling a hot bite
        bp.run(noise(), 1100) * Math.sin(Math.PI * Math.min(1, t / 0.6)) ** 0.8 * (1 - 0.3 * Math.sin(t * 20));
      });
      case 'rustle': return this.render(0.35, SR, () => { const bp = new SVF(SR, 0.9); let g = 0; return (t) => { // paper changing hands
        if (Math.random() < 0.004) g = rand(0.4, 1);
        g *= 0.995;
        return bp.run(noise(), 4800) * (g + 0.15) * Math.sin(Math.PI * Math.min(1, t / 0.35));
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
