/**
 * Procedural audio, no assets. A cozy lo-fi street-food loop (koto melody, electric piano, upright bass, brushed kit)
 * over the J-pop "royal road" progression, and a living Tokyo street around the player: footsteps on stone, wood,
 * tile and gravel, murmured (made-up) conversations, shop radios playing their own songs between chatty DJs,
 * sparrows, a bush warbler, crows at dusk, bell crickets at night, a distant level crossing, the temple bell, the
 * ramen cart's flute, bicycle bells, furin chimes, grill crackle and canal water.
 * Everything is positioned around the listener (distance falloff and panning against the camera), and sounds in
 * another space (a shop vs the street) come through muffled.
 * Every note and sound is synthesised once into a small mono buffer and then replayed, so at runtime a note costs a
 * buffer source and a gain node. Rendering is spread over frames by a warm-up queue.
 */

import { FLOORS, SOUND_SPOTS, Floor } from '../data/soundscape';

export type SfxName = 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh';

/** Someone who may be talking: anything stable can be the key (it picks their voice). */
export interface Talker { x: number; z: number; key: object; busy?: number }
export interface AudioRoom { rect: [number, number, number, number]; kind: string }

const SR = 32000; // render rate for bright one-shots
const LSR = 22050; // render rate for mellow notes, voices and footsteps (Safari needs >= 22050)
const TAU = Math.PI * 2;
const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const noise = () => Math.random() * 2 - 1;
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

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
  lead: 'koto' | 'bell' | 'ep';
  walk?: boolean;
  sections: Section[];
  loopFrom: number;
}
type Inst = 'koto' | 'bell' | 'ep' | 'bass';
interface Out { lead: AudioNode; ep: AudioNode; bass: AudioNode; drums: AudioNode }
interface Seq { song: Song; t: number; sec: number; bar: number; step: number; bars: number; out: Out; vol: number; bgm: boolean; bpm: number }

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
    bpm: 84, swing: 0.58, lead: 'koto', loopFrom: 1,
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

/** What the shop radios play: a city-pop number, a kayōkyoku ballad and a kissa jazz tune. */
const CITY_POP: Song = {
  chords: [[46, 57, 60, 62, 65], [45, 55, 60, 64, 67], [43, 53, 57, 58, 62], [36, 52, 57, 58, 62], [41, 52, 57, 60, 64]],
  bpm: 100, swing: 0.52, lead: 'bell', loopFrom: 0,
  sections: [{
    prog: [0, 1, 2, 3, 0, 1, 2, 4], bass: true, drums: 2, mel: [
      [[0, 77, 2], [2, 76, 1], [3, 74, 1], [4, 72, 3]],
      [[0, 69, 2], [2, 72, 2], [4, 76, 4]],
      [[0, 74, 2], [2, 72, 1], [3, 70, 1], [4, 69, 2], [6, 67, 2]],
      [[0, 72, 6], [6, 74, 1], [7, 76, 1]],
      [[0, 77, 2], [2, 79, 1], [3, 81, 1], [4, 79, 3]],
      [[0, 76, 2], [2, 74, 2], [4, 72, 4]],
      [[0, 70, 2], [2, 69, 2], [4, 67, 2], [6, 72, 2]],
      [[0, 77, 6]],
    ],
  }],
};
const BALLAD: Song = {
  chords: [[45, 57, 60, 64, 69], [38, 57, 62, 65, 69], [40, 56, 59, 62, 64], [41, 57, 60, 65, 69], [43, 59, 62, 67, 71], [36, 55, 60, 64, 67]],
  bpm: 68, swing: 0.5, lead: 'koto', loopFrom: 0,
  sections: [{
    prog: [0, 1, 2, 0, 3, 4, 5, 2], bass: true, drums: 1, mel: [
      [[0, 76, 3], [3, 77, 1], [4, 76, 2], [6, 72, 2]],
      [[0, 74, 4], [4, 77, 2], [6, 76, 2]],
      [[0, 71, 2], [2, 72, 1], [3, 71, 1], [4, 68, 4]],
      [[0, 69, 6]],
      [[0, 72, 2], [2, 76, 2], [4, 81, 4]],
      [[0, 79, 2], [2, 77, 1], [3, 76, 1], [4, 74, 4]],
      [[0, 76, 3], [3, 74, 1], [4, 72, 2], [6, 71, 2]],
      [[0, 71, 4], [4, 68, 2], [6, 71, 2]],
    ],
  }],
};
const JAZZ: Song = {
  chords: [[38, 53, 57, 60, 64], [43, 53, 57, 59, 64], [36, 52, 55, 59, 62], [45, 55, 61, 64, 66]],
  bpm: 116, swing: 0.64, lead: 'ep', walk: true, loopFrom: 0,
  sections: [{
    prog: [0, 1, 2, 3, 0, 1, 2, 2], bass: true, drums: 1, mel: [
      [[0, 76, 1], [1, 77, 1], [2, 76, 1], [3, 74, 1], [4, 72, 2], [6, 69, 2]],
      [[0, 71, 2], [2, 74, 2], [4, 77, 2], [6, 76, 2]],
      [[0, 76, 4], [4, 79, 2], [6, 76, 2]],
      [[0, 73, 2], [2, 76, 2], [4, 79, 2], [6, 78, 2]],
      [[0, 77, 2], [2, 81, 2], [4, 79, 1], [5, 77, 1], [6, 76, 2]],
      [[0, 74, 2], [2, 71, 2], [4, 67, 2], [6, 69, 2]],
      [[0, 71, 2], [2, 72, 6]],
      [],
    ],
  }],
};
/** Which shops keep a radio on, and what they like to listen to. */
const STATIONS: Record<string, Song[]> = {
  kissa: [JAZZ, BALLAD, CITY_POP],
  izakaya: [BALLAD, CITY_POP, JAZZ],
  soba: [BALLAD, JAZZ],
  fish: [CITY_POP, BALLAD],
  florist: [CITY_POP, JAZZ],
};

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
  /** Sources in another space than the listener (heard through a wall or doorway). */
  private muffled!: GainNode;
  /** The far-off crowd. */
  private walla!: GainNode;
  private bed!: GainNode;
  private sizzle!: GainNode;
  private water!: GainNode;
  private verb!: ConvolverNode;
  private bgmOut!: Out;
  private bufs = new Map<string, AudioBuffer>();
  private warm: string[] = [];
  private bgm!: Seq;
  // the radio the listener is nearest to
  private radioIn!: GainNode;
  private radioLp!: BiquadFilterNode;
  private radioLevel!: GainNode;
  private radioPan!: StereoPannerNode | null;
  private radioOut!: Out;
  private radio = { room: -1, seq: null as Seq | null, djUntil: 0, n: 0, gain: 0, warmed: new Set<number>() };
  // listener
  private lx = 0;
  private lz = 0;
  private rx = 1;
  private rz = 0;
  private lroom = -1;
  private rooms: AudioRoom[] = [];
  private night = 0;
  private lastNight = -1;
  private inside = false;
  private waterLevel = 0;
  // people
  private voiceOf = new WeakMap<object, number>();
  private talkNext = new WeakMap<object, number>();
  private speaking: number[] = [];
  private crowd = 0;
  private wallaNext = 0;
  private stepWindow = 0;
  private stepCount = 0;
  private timers: Record<string, number> = {};
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
    this.musicLevel = this.gain(0.36, this.master);
    this.musicLevel.connect(this.gain(0.55, this.verb));
    this.musicTone = this.filter('lowpass', 9000, 0.4, this.musicLevel);
    this.music = this.gain(this.musicOn ? 1 : 0, this.musicTone);
    this.bgmOut = {
      lead: this.pan(-0.22, this.gain(1, this.music)),
      ep: this.pan(0.18, this.gain(1, this.music)),
      bass: this.gain(1, this.music),
      drums: this.pan(0.06, this.gain(1, this.music)),
    };

    this.sfx = this.gain(this.sfxOn ? 0.75 : 0, this.master);
    this.sfx.connect(this.gain(0.25, this.verb));

    // ambience: everything heard in the world
    this.amb = this.gain(this.sfxOn ? 1 : 0, this.master);
    this.amb.connect(this.gain(0.35, this.verb));
    this.streetTone = this.filter('lowpass', 16000, 0.3, this.amb);
    this.street = this.gain(1, this.streetTone);
    this.muffled = this.gain(0.6, this.filter('lowpass', 900, 0.4, this.amb));
    this.walla = this.gain(1, this.filter('lowpass', 750, 0.3, this.street));
    const brown = this.render(4, LSR, () => { let b = 0; return () => (b = 0.985 * b + 0.06 * noise()); }, true);
    this.bed = this.gain(0.05, this.street);
    this.loop(brown, 1, this.filter('lowpass', 650, 0.3, this.bed));
    this.sizzle = this.gain(0, this.street);
    this.loop(this.sizzleLoop(), 1, this.sizzle);
    this.water = this.gain(0, this.street);
    const swell = this.gain(0.6, this.filter('lowpass', 420, 0.5, this.water));
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.17;
    lfo.connect(this.gain(0.4, swell.gain)); lfo.start();
    this.loop(brown, 0.63, swell);

    // radio: band-limited and a little crunchy, placed at the nearest shop that has one on
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) curve[i] = Math.tanh(2.2 * (i / 127.5 - 1)) / Math.tanh(2.2);
    shaper.curve = curve;
    this.radioLevel = this.gain(0, this.amb);
    this.radioPan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (this.radioPan) this.radioPan.connect(this.radioLevel);
    shaper.connect(this.radioPan ?? this.radioLevel);
    this.radioLp = this.filter('lowpass', 3200, 0.7, shaper);
    this.radioIn = this.gain(0.8, this.filter('highpass', 380, 0.7, this.radioLp));
    this.radioOut = { lead: this.radioIn, ep: this.radioIn, bass: this.radioIn, drums: this.gain(0.7, this.radioIn) };

    const now = ctx.currentTime;
    this.bgm = this.seq(BGM, now + 0.4, this.bgmOut, 1, true);
    for (const k of ['bird', 'cricket', 'furin', 'drop', 'warbler', 'crow', 'bike', 'train', 'temple', 'flute']) this.timers[k] = now + rand(4, 30);
    this.timers.train = now + rand(40, 90);
    this.timers.temple = now + rand(120, 240);
    this.timers.flute = now + rand(60, 150);

    // queue the tune's notes, voices and footsteps so they're rendered a couple per frame before they're needed
    this.queueSong(BGM);
    for (let v = 0; v < 3; v++) for (let i = 0; i < 4; i++) this.warm.push(`babble${v}-${i}`);
    for (const s of ['stone', 'wood', 'tile', 'gravel', 'grass']) for (let i = 0; i < 3; i++) this.warm.push(`step-${s}-${i}`);

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

  /** The walkable shops: footsteps, muffling and radios depend on them. */
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

  /**
   * Where the listener is (x, z and the camera's right vector on the ground), who nearby is talking and how many
   * people are about. Call a few times a second.
   */
  scene(x: number, z: number, rightX: number, rightZ: number, talkers: Talker[], crowd: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lx = x; this.lz = z;
    const rl = Math.hypot(rightX, rightZ) || 1;
    this.rx = rightX / rl; this.rz = rightZ / rl;
    this.crowd = crowd;
    const room = this.inside ? -1 : this.roomAt(x, z);
    if (room !== this.lroom) {
      this.lroom = room;
      this.streetTone.frequency.setTargetAtTime(room >= 0 || this.inside ? 1100 : 16000, t, 0.3);
      this.street.gain.setTargetAtTime(room >= 0 ? 0.55 : 1, t, 0.3);
    }
    this.updateRadio(t);
    if (!this.sfxOn || !this.ready(`babble0-0`)) return;
    this.speaking = this.speaking.filter((e) => e > t);
    for (const p of talkers) {
      if (this.speaking.length >= 4) break;
      const next = this.talkNext.get(p.key) ?? 0;
      if (t < next) continue;
      const sp = this.spot(p.x, p.z, 14);
      if (!sp) { this.talkNext.set(p.key, t + 1); continue; }
      let v = this.voiceOf.get(p.key);
      if (v === undefined) { v = Math.floor(rand(0, 3)); this.voiceOf.set(p.key, v); }
      const b = this.buf(`babble${v}-${Math.floor(rand(0, 4))}`);
      const rate = rand(0.94, 1.06), at = t + rand(0.02, 0.3);
      this.fire(b, at, 0.5 * sp.g, sp.out, rate, undefined, sp.pan);
      this.speaking.push(at + b.duration / rate);
      this.talkNext.set(p.key, at + b.duration / rate + rand(0.3, 1.6) / clamp(p.busy ?? 1, 0.1, 1));
    }
  }

  /** A foot touching the ground (from the walk cycle). */
  step(x: number, z: number, run: boolean, mine: boolean): void {
    if (!this.ctx || !this.sfxOn) return;
    const t = this.ctx.currentTime;
    let vol = run ? 0.3 : 0.2, out: AudioNode = this.amb, pan = 0;
    if (!mine) {
      const sp = this.spot(x, z, 11);
      if (!sp) return;
      if (t > this.stepWindow) { this.stepWindow = t + 0.25; this.stepCount = 0; }
      if (++this.stepCount > 6) return; // a busy street needn't trigger a sound for every foot
      vol *= 0.75 * sp.g; out = sp.out; pan = sp.pan;
    }
    const k = `step-${this.surfaceAt(x, z)}-${Math.floor(rand(0, 3))}`;
    if (!mine && !this.ready(k)) return;
    this.fire(this.buf(k), t + 0.005, vol * rand(0.8, 1.1), out, rand(0.9, 1.1) * (run ? 1.08 : 1), undefined, pan);
  }

  /** Called every frame: runs the sequencers, ambient life and the render warm-up queue. */
  tick(night: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.night = night;
    for (let i = 0; i < 2 && this.warm.length; i++) this.buf(this.warm.shift()!);
    const now = ctx.currentTime;
    if (this.musicOn) this.runSeq(this.bgm, now);
    if (this.sfxOn) {
      this.runRadio(now);
      this.life(now);
    }
  }

  play(name: SfxName): void {
    if (!this.ctx || !this.sfxOn) return;
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

  private panTo(x: number, z: number): number {
    const dx = x - this.lx, dz = z - this.lz, d = Math.hypot(dx, dz);
    if (d < 0.01) return 0;
    return clamp((dx * this.rx + dz * this.rz) / d, -1, 1) * 0.85 * Math.min(1, d / 2.5);
  }

  /** Gain, pan and bus for a sound at (x, z), or null when it's out of earshot. */
  private spot(x: number, z: number, range: number): { g: number; pan: number; out: AudioNode } | null {
    if (this.inside) return null;
    const d = Math.hypot(x - this.lx, z - this.lz);
    if (d > range) return null;
    const g = (1 - d / range) ** 1.4 / (1 + 0.12 * d);
    const same = this.roomAt(x, z) === this.lroom;
    return { g, pan: this.panTo(x, z), out: same ? this.amb : this.muffled };
  }

  // ---- sequencers ----

  private seq(song: Song, t: number, out: Out, vol: number, bgm = false): Seq {
    return { song, t, sec: 0, bar: 0, step: 0, bars: 0, out, vol, bgm, bpm: song.bpm };
  }

  private queueSong(s: Song): void {
    const q = new Set<string>();
    const add = (i: Inst, m: number) => q.add(this.instKey(i, m)[0]);
    for (const c of s.chords) {
      c.slice(1).forEach((m) => { add('ep', m); add(s.lead, m + 12); });
      for (let d = -1; d <= 12; d++) add('bass', c[0] + d);
    }
    for (const sec of s.sections) for (const b of sec.mel ?? []) for (const n of b) { add(s.lead, n[1]); add(s.lead, graceOf(n[1])); }
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
      q.bars++;
      q.bpm = q.song.bpm - (q.bgm ? 12 * Math.min(1, this.night) : 0); // the tune is laid back at night
      if (++q.bar < 8) continue;
      q.bar = 0;
      if (++q.sec >= q.song.sections.length) q.sec = q.song.loopFrom;
    }
  }

  private playStep(q: Seq, t: number, e: number): void {
    const song = q.song, sec = song.sections[q.sec], s = q.step, bar = q.bar, o = q.out;
    const ch = song.chords[sec.prog[bar]];
    const night = q.bgm && this.night > 0.5;
    const h = () => t + rand(-0.006, 0.006);
    const v = (x: number) => x * q.vol * rand(0.85, 1.1);

    // electric piano: a slow strum on the downbeat, a soft push on the "and" of 3 every other bar
    if (s === 0) ch.slice(1).forEach((m, i) => this.note('ep', m, t + i * 0.022 + rand(0, 0.01), v(0.2), o.ep, e * 7.6));
    if (s === 5 && bar % 2 === 1 && sec.drums) ch.slice(2).forEach((m, i) => this.note('ep', m, t + i * 0.015, v(0.09), o.ep, e * 2.6));

    // bass: root, a pickup and a walk to the fifth or octave; jazz walks in quarters
    if (sec.bass) {
      const b = ch[0];
      if (song.walk) {
        if (s % 2 === 0) {
          const next = song.chords[sec.prog[(bar + 1) % 8]][0];
          const m = [b, b + 7, b + 12, next + (next > b ? -1 : 1)][s / 2];
          this.note('bass', m, h(), v(s ? 0.5 : 0.65), o.bass, e * 1.8);
        }
      } else {
        if (s === 0) this.note('bass', b, t, v(0.75), o.bass, e * 2.7);
        if (s === 3 && !night) this.note('bass', b, h(), v(0.4), o.bass, e * 0.9);
        if (s === 6) this.note('bass', b + (bar % 2 ? 12 : 7), h(), v(0.5), o.bass, e * 1.6);
      }
    }

    // brushed kit; at night just the shaker and brush
    if (sec.drums) {
      this.fire(this.buf('shaker'), h(), v(s % 2 ? 0.2 : 0.11), o.drums);
      if (sec.drums === 2) {
        if (!night && (s === 0 || s === 5)) this.fire(this.buf('kick'), t, v(s ? 0.5 : 0.7), o.drums);
        if (s === 2 || s === 6) this.fire(this.buf('brush'), h(), v(night ? 0.22 : 0.32), o.drums);
      } else if (song.walk ? s % 4 === 2 : s === 6) this.fire(this.buf('brush'), h(), v(song.walk ? 0.24 : 0.16), o.drums);
    }

    // lead with the odd grace-note ornament
    if (sec.mel) {
      const lv = song.lead === 'koto' ? 0.5 : song.lead === 'bell' ? 0.3 : 0.4;
      for (const [at, m, len] of sec.mel[bar]) {
        if (at !== s) continue;
        if (song.lead === 'koto' && len >= 2 && Math.random() < 0.18) this.note('koto', graceOf(m), t - 0.055, v(0.2), o.lead, 0.06);
        this.note(song.lead, m, h(), v(night ? lv * 0.84 : lv), o.lead, e * len + 0.35);
      }
    }
    // koto break: loose arpeggios from the chord
    if (sec.arp && Math.random() < (s % 2 ? 0.18 : 0.62)) {
      this.note(song.lead, ch[1 + Math.floor(Math.random() * 4)] + 12, h(), v(0.3), o.lead, e * 3);
    }
  }

  // ---- radio ----

  private updateRadio(t: number): void {
    let best = -1, bd = 14;
    for (let i = 0; i < this.rooms.length; i++) {
      const r = this.rooms[i];
      if (!STATIONS[r.kind]) continue;
      const d = Math.hypot((r.rect[0] + r.rect[2]) / 2 - this.lx, (r.rect[1] + r.rect[3]) / 2 - this.lz);
      if (d < bd) { bd = d; best = i; }
    }
    if (this.inside || !this.sfxOn) best = -1;
    const R = this.radio;
    if (best >= 0 && !R.warmed.has(best)) { R.warmed.add(best); for (const s of STATIONS[this.rooms[best].kind]) this.queueSong(s); }
    if (best !== R.room) {
      R.room = best;
      R.seq = null;
      R.djUntil = 0;
    }
    let g = 0;
    if (best >= 0) {
      const r = this.rooms[best];
      const cx = (r.rect[0] + r.rect[2]) / 2, cz = (r.rect[1] + r.rect[3]) / 2;
      const same = best === this.lroom;
      g = (same ? 0.5 : 0.32) * (1 - bd / 14) ** 1.2;
      this.radioLp.frequency.setTargetAtTime(same ? 3200 : 1500, t, 0.3);
      this.radioPan?.pan.setTargetAtTime(same ? 0 : this.panTo(cx, cz), t, 0.3);
    }
    R.gain = g;
    this.radioLevel.gain.setTargetAtTime(g, t, 0.5);
    // the background tune makes room for the radio
    this.musicLevel.gain.setTargetAtTime(0.36 * (1 - Math.min(0.7, g * 1.6)), t, 0.6);
  }

  private runRadio(now: number): void {
    const R = this.radio;
    if (R.room < 0 || R.gain <= 0.001) return;
    const list = STATIONS[this.rooms[R.room].kind];
    if (R.seq) {
      this.runSeq(R.seq, now);
      if (R.seq.bars >= 16) { // song's over: the DJ chats, then a jingle
        const t = R.seq.t;
        R.seq = null;
        R.djUntil = t + rand(4, 7);
        let at = t + 0.4;
        while (at < R.djUntil - 1.2) {
          const b = this.buf(`babble${1 + (R.n % 2)}-${Math.floor(rand(0, 4))}`);
          this.fire(b, at, 0.55, this.radioIn, 1.1);
          at += b.duration / 1.1 + rand(0.15, 0.4);
        }
        [84, 88, 91, 96].forEach((m, i) => this.note('bell', m, R.djUntil - 0.9 + i * 0.1, 0.22, this.radioIn));
      }
    } else if (now + 0.3 > R.djUntil) {
      const song = list[R.n++ % list.length];
      if (song.sections.every((s) => s.mel?.every((b) => b.every((n) => this.ready(this.instKey(song.lead, n[1])[0]))) ?? true)) {
        R.seq = this.seq(song, Math.max(now + 0.1, R.djUntil), this.radioOut, 0.9);
        // drop in mid-song the first time, as if it had been playing all along
        if (R.djUntil === 0) { R.seq.bar = Math.floor(rand(0, 6)); R.seq.bars = R.seq.bar; }
      } else R.n--;
    }
  }

  // ---- the street around you ----

  private life(now: number): void {
    const out = !this.inside, T = this.timers, n = this.night;
    const at = now + 0.05;
    if (this.lastNight >= 0 && out && ((this.lastNight < 0.5 && n >= 0.5) || (this.lastNight > 0.5 && n <= 0.5))) T.temple = now; // the temple bell marks dusk and dawn
    this.lastNight = n;
    const due = (k: string, a: number, b: number) => {
      if (now < T[k]) return false;
      T[k] = now + rand(a, b);
      return true;
    };
    if (due('bird', 5, 14) && out && n < 0.35) {
      const pan = rand(-0.8, 0.8);
      for (let i = 0, c = 1 + Math.floor(rand(0, 3)); i < c; i++) this.fire(this.buf('chirp'), at + i * rand(0.18, 0.32), rand(0.05, 0.11), this.street, rand(0.9, 1.15), undefined, pan);
    }
    if (due('warbler', 50, 110) && out && n < 0.2) this.fire(this.buf('warbler'), at, rand(0.05, 0.09), this.street, rand(0.96, 1.04), undefined, rand(-0.9, 0.9));
    if (due('crow', 14, 35) && out && n > 0.15 && n < 0.75) {
      const pan = rand(-0.9, 0.9), rate = rand(0.9, 1.1);
      for (let i = 0, c = 2 + Math.floor(rand(0, 2)); i < c; i++) this.fire(this.buf('crow'), at + i * rand(0.42, 0.55), 0.06, this.street, rate * rand(0.97, 1.03), undefined, pan);
    }
    if (due('cricket', 1.4, 4) && out && n > 0.5) this.fire(this.buf('cricket'), at, rand(0.025, 0.05) * n, this.street, rand(0.97, 1.03), undefined, rand(-0.9, 0.9));
    if (due('furin', 22, 50) && out) this.furin(at, this.street, 0.07, rand(-0.6, 0.6));
    if (due('bike', 35, 80) && out && n < 0.6 && this.crowd > 2) this.fire(this.buf('bike'), at, rand(0.06, 0.1), this.street, rand(0.95, 1.05), undefined, rand(-0.7, 0.7));
    const cross = this.nearest('crossing');
    if (due('train', 100, 200) && out && n < 0.85 && cross) {
      this.fire(this.buf('train'), at, 0.3 / (1 + cross.d * 0.02), this.street, 1, undefined, this.panTo(...cross.pos));
    }
    const bell = this.nearest('temple');
    if (due('temple', 240, 420) && out && bell) {
      for (let i = 0; i < 3; i++) this.fire(this.buf('bonsho'), at + i * 6.5, 0.3 / (1 + bell.d * 0.03), this.street, 1, undefined, this.panTo(...bell.pos));
    }
    if (due('flute', 150, 300) && out && n > 0.6) this.fire(this.buf('charumera'), at, 0.06, this.street, 1, undefined, rand(-0.8, 0.8));
    if (this.waterLevel > 0.35 && due('drop', 0.6, 3)) this.fire(this.buf('drop'), at, rand(0.03, 0.07) * this.waterLevel, this.street, rand(0.8, 1.3), undefined, rand(-0.5, 0.5));
    // the far-off murmur of the crowd
    if (out && this.crowd > 0 && now > this.wallaNext && this.ready('babble0-0')) {
      const b = this.buf(`babble${Math.floor(rand(0, 3))}-${Math.floor(rand(0, 4))}`);
      this.fire(b, at, rand(0.06, 0.12) * Math.min(1, this.crowd / 8), this.walla, rand(0.9, 1.1), undefined, rand(-0.9, 0.9));
      this.wallaNext = now + rand(0.4, 1.6) * 8 / (this.crowd + 4);
    }
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

  private ready(k: string): boolean {
    return this.bufs.has(k);
  }

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
    if ((m = k.match(/^babble(\d)-(\d)$/))) return this.renderBabble(Number(m[1]));
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

  /** Small glassy bell (furin, coins, door bell, vibraphone on the radio). */
  private renderBell(m: number): AudioBuffer {
    const f = mtof(m);
    const parts = [[1, 1, 2.2], [2.76, 0.42, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 12]].filter((p) => p[0] * f < SR * 0.47);
    return this.render(2.4, SR, () => (t) => {
      let s = 0;
      for (const [r, a, d] of parts) s += a * Math.sin(TAU * f * r * t) * Math.exp(-t * d);
      return s * Math.min(1, t / 0.002);
    });
  }

  /**
   * A phrase of made-up Japanese-sounding speech: consonant-vowel morae through moving formants, with a falling
   * pitch line and the odd question at the end. Voices 0..2 go from low to high.
   */
  private renderBabble(voice: number): AudioBuffer {
    const f0 = [112, 175, 230][voice] * rand(0.92, 1.08), fs = [1, 1.12, 1.2][voice];
    const VOW: Record<string, [number, number, number]> = { a: [750, 1200, 2600], i: [300, 2250, 3000], u: [340, 1350, 2400], e: [480, 1850, 2600], o: [480, 850, 2500] };
    // consonant onset: [length, voiced, noise amount, noise centre, F1, F2] (0 formants: the vowel's own)
    const CONS: Record<string, [number, number, number, number, number, number]> = {
      '': [0, 1, 0, 0, 0, 0], k: [0.045, 0, 1, 1800, 300, 1800], t: [0.04, 0, 1, 3200, 300, 1700], s: [0.075, 0, 0.7, 5000, 300, 1600],
      h: [0.045, 0, 0.5, 1400, 0, 0], n: [0.05, 0.6, 0, 0, 260, 1100], m: [0.05, 0.6, 0, 0, 260, 900], r: [0.022, 0.8, 0, 0, 420, 1500],
      y: [0.04, 1, 0, 0, 300, 2100], w: [0.04, 1, 0, 0, 320, 750],
    };
    type Mora = { t: number; c: string; v: string; d: number; acc: number };
    const morae: Mora[] = [];
    let t = 0.03;
    const n = 4 + Math.floor(rand(0, 9));
    for (let i = 0; i < n; i++) {
      if (i > 0 && Math.random() < 0.14) t += rand(0.07, 0.16);
      const c = pick(['', '', 'k', 's', 't', 'n', 'm', 'h', 'r', 'y', 'w']);
      const d = rand(0.085, 0.14) + (i === n - 1 ? 0.07 : 0);
      morae.push({ t, c, v: pick(['a', 'a', 'i', 'u', 'e', 'o', 'o']), d, acc: pick([1, 1, 1.07, 0.95]) });
      t += d;
    }
    const T = t + 0.08, ask = Math.random() < 0.2;
    const src = new SVF(LSR, 0.6), F1 = new SVF(LSR, 0.18), F2 = new SVF(LSR, 0.16), F3 = new SVF(LSR, 0.2), hiss = new SVF(LSR, 0.7);
    let ph = 0, j = 0, amp = 0, f1 = 500, f2 = 1500, f3 = 2500, pitch = f0, nAmp = 0;
    return this.render(T, LSR, () => (time) => {
      while (j < morae.length - 1 && time >= morae[j + 1].t) j++;
      const mo = morae[j], u = time - mo.t;
      const [v1, v2, v3] = VOW[mo.v];
      const [cl, voiced, nz, nf, c1x, c2x] = CONS[mo.c];
      const c1 = c1x || v1, c2 = c2x || v2;
      const inC = u < cl, live = time < mo.t + mo.d && time >= mo.t;
      const burst = mo.c === 'k' || mo.c === 't';
      const vTarget = !live ? 0 : inC ? voiced * (burst ? 0 : 1) : 1;
      const nTarget = !live || !inC ? 0 : burst ? (u > cl - 0.012 ? nz : 0) : nz;
      amp += (vTarget - amp) * 0.006;
      nAmp += (nTarget - nAmp) * 0.05;
      f1 += ((inC ? c1 : v1) * fs - f1) * 0.004;
      f2 += ((inC ? c2 : v2) * fs - f2) * 0.004;
      f3 += (v3 * fs - f3) * 0.004;
      const line = 1.12 - 0.24 * (time / T) + (ask && j === morae.length - 1 ? 0.35 * u / mo.d : 0);
      pitch += (f0 * line * mo.acc - pitch) * 0.003;
      ph += (pitch * (1 + 0.012 * Math.sin(TAU * 5.3 * time))) / LSR;
      ph -= Math.floor(ph);
      const glottal = src.run(2 * ph - 1 + 0.08 * noise(), pitch * 3);
      const voicedOut = (F1.run(glottal, f1) + 0.7 * F2.run(glottal, f2) + 0.25 * F3.run(glottal, f3)) * amp;
      return voicedOut + hiss.run(noise(), nf || 2000) * nAmp * 0.35;
    });
  }

  /** One footfall on the given ground. */
  private renderStep(s: Floor): AudioBuffer {
    const bp = new SVF(LSR, 0.8), bp2 = new SVF(LSR, 0.6);
    let lp = 0, grain = 0;
    switch (s) {
      case 'stone': return this.render(0.16, LSR, () => (t) => { // heel then sole on paving
        lp += 0.15 * (noise() - lp);
        return Math.sin(TAU * 95 * t) * Math.exp(-t * 55) * 0.5 + bp.run(noise(), 1700) * Math.exp(-t * 70) * 0.8
          + (t > 0.035 ? lp * 2 * Math.exp(-(t - 0.035) * 45) : 0);
      });
      case 'wood': return this.render(0.18, LSR, () => (t) =>
        Math.sin(TAU * 150 * t) * Math.exp(-t * 40) * 0.8 + bp.run(noise(), 600) * Math.exp(-t * 60) * 0.7 + bp2.run(noise(), 1800) * Math.exp(-t * 150) * 0.25);
      case 'tile': return this.render(0.12, LSR, () => (t) =>
        bp.run(noise(), 3000) * Math.exp(-t * 130) + Math.sin(TAU * 120 * t) * Math.exp(-t * 70) * 0.4);
      case 'gravel': return this.render(0.22, LSR, () => (t) => {
        if (Math.random() < 0.06) grain = rand(0.5, 1);
        grain *= 0.9;
        return bp.run(noise() * grain, 2200) * Math.min(1, t / 0.01) * Math.exp(-t * 18);
      });
      case 'grass': return this.render(0.16, LSR, () => (t) => {
        lp += 0.12 * (noise() - lp);
        return lp * Math.min(1, t / 0.012) * Math.exp(-t * 28) + Math.sin(TAU * 80 * t) * Math.exp(-t * 50) * 0.15;
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
      case 'warbler': return this.render(2.1, SR, () => { // uguisu: "hoooo... ho-ke-kyo"
        let ph = 0;
        const seg = (t: number): [number, number] => {
          if (t < 1.0) return [1250 + 120 * t, Math.min(1, t / 0.2) * Math.min(1, (1.0 - t) / 0.08)];
          if (t < 1.2) return [0, 0];
          if (t < 1.36) return [1750 - 200 * (t - 1.2) / 0.16, Math.sin(Math.PI * (t - 1.2) / 0.16)];
          if (t < 1.48) return [2400 - 500 * (t - 1.36) / 0.12, Math.sin(Math.PI * (t - 1.36) / 0.12)];
          if (t < 1.9) return [2700 - 700 * (t - 1.5) / 0.4, t < 1.5 ? 0 : Math.min(1, (t - 1.5) / 0.02) * Math.min(1, (1.9 - t) / 0.12)];
          return [0, 0];
        };
        return (t) => {
          const [f, a] = seg(t);
          ph += TAU * f / SR;
          return (Math.sin(ph) + 0.15 * Math.sin(2 * ph)) * a;
        };
      });
      case 'crow': return this.render(0.42, LSR, () => { // "kaa"
        let ph = 0; const f1 = new SVF(LSR, 0.2), f2 = new SVF(LSR, 0.25);
        return (t) => {
          const f0 = 540 - 90 * t + 20 * noise();
          ph += f0 / LSR; ph -= Math.floor(ph);
          const s = 2 * ph - 1 + 0.4 * noise();
          const env = Math.min(1, t / 0.03) * (t > 0.3 ? Math.max(0, 1 - (t - 0.3) / 0.12) : 1);
          return (f1.run(s, 1150) + 0.8 * f2.run(s, 1750)) * env;
        };
      });
      case 'cricket': return this.render(1.1, SR, () => (t) => { // suzumushi: a ringing "riiin"
        const trill = Math.abs(Math.sin(Math.PI * 38 * t)) ** 3;
        return Math.sin(TAU * 4300 * t) * trill * Math.min(1, t / 0.08) * Math.exp(-t * 2.2);
      });
      case 'drop': return this.render(0.12, SR, () => { let ph = 0; return (t) => {
        ph += TAU * (700 + 900 * (1 - Math.exp(-t * 60))) / SR;
        return Math.sin(ph) * Math.min(1, t / 0.002) * Math.exp(-t * 45);
      }; });
      case 'bike': return this.render(1.3, SR, () => (t) => { // "chiriin chiriin"
        let s = 0;
        for (const s0 of [0, 0.06, 0.12, 0.5, 0.56, 0.62]) {
          if (t < s0) continue;
          const u = t - s0;
          s += (Math.sin(TAU * 2350 * u) + 0.5 * Math.sin(TAU * 3480 * u) * Math.exp(-u * 6) + 0.3 * Math.sin(TAU * 5900 * u) * Math.exp(-u * 12)) * Math.exp(-u * 4);
        }
        return s;
      });
      case 'bonsho': return this.render(7, LSR, () => { // the temple's big bronze bell, struck with a log
        const parts = [[0.5, 0.5, 0.25], [1, 1, 0.45], [1.007, 0.6, 0.45], [2.0, 0.45, 0.7], [2.74, 0.3, 1.0], [3.9, 0.18, 1.6], [5.3, 0.1, 2.4]];
        const f = 98; let lp = 0;
        return (t) => {
          let s = 0;
          for (const [r, a, d] of parts) s += a * Math.sin(TAU * f * r * t) * Math.exp(-t * d);
          lp += 0.08 * (noise() - lp);
          return s * Math.min(1, t / 0.006) + lp * 3 * Math.exp(-t * 25);
        };
      });
      case 'charumera': return this.render(4.6, LSR, () => { // the ramen cart's little reed flute, far away
        const tune: [number, number][] = [[72, 0.24], [74, 0.24], [76, 0.62], [74, 0.24], [72, 0.75], [0, 0.35], [72, 0.2], [74, 0.2], [76, 0.2], [74, 0.2], [72, 0.2], [74, 1.0]];
        const starts: number[] = []; let acc = 0.05;
        for (const [, d] of tune) { starts.push(acc); acc += d; }
        let ph = 0, amp = 0, j = 0; const f1 = new SVF(LSR, 0.3), f2 = new SVF(LSR, 0.3);
        return (t) => {
          while (j < tune.length - 1 && t >= starts[j + 1]) j++;
          const [m, d] = tune[j], u = t - starts[j];
          const on = m > 0 && t >= starts[0] && u < d - 0.03;
          amp += ((on ? 1 : 0) - amp) * 0.004;
          const f = mtof(m || 72) * (1 - 0.02 * Math.exp(-u * 25)) * (1 + (d > 0.5 ? 0.012 * Math.sin(TAU * 5.5 * u) * Math.min(1, u / 0.3) : 0));
          ph += f / LSR; ph -= Math.floor(ph);
          const s = 2 * ph - 1;
          return (f1.run(s, 1300) + 0.7 * f2.run(s, 2600)) * amp;
        };
      });
      case 'train': return this.render(11, LSR, () => { // a level crossing ringing, a train rolling through, far off
        let b = 0; const lp = new SVF(LSR, 0.6);
        return (t) => {
          const bellOn = t < 10.4 ? Math.min(1, t / 0.5) * Math.min(1, (10.4 - t) / 0.4) : 0;
          const u = t % 0.46;
          const bell = (Math.sin(TAU * 760 * u) + 0.5 * Math.sin(TAU * 1740 * u) + 0.3 * Math.sin(TAU * 2960 * u)) * Math.exp(-u * 9) * bellOn * 0.5;
          const pass = t > 2.5 && t < 9.5 ? Math.sin(Math.PI * (t - 2.5) / 7) ** 1.5 : 0;
          b = 0.995 * b + 0.05 * noise();
          const c = (t - 2.5) % 0.85;
          const clack = t > 2.5 && t < 9.5 ? (Math.exp(-c * 60) + Math.exp(-Math.max(0, c - 0.12) * 60) * (c > 0.12 ? 1 : 0)) * noise() * 1.2 : 0;
          return bell + lp.run(b * 2.5 + clack, 300 + 400 * pass) * pass * 1.6;
        };
      });
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
