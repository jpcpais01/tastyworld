/**
 * Procedural audio, no assets. Each city's music is its own lo-fi (music/: a day and a night tune played by a small
 * dusty band through tape and vinyl), under a deliberately quiet street (a soft city hush, water lapping, the odd
 * bird by day and cricket by night, a faint grill crackle, the sea and gulls on the coast, bells and the call to
 * prayer) and soft, rounded UI sounds. Music, ambience and effects each have their own volume.
 * Every note and sound is synthesised once into a small mono buffer and then replayed, so at runtime a note costs a
 * buffer source and a gain node. Rendering is spread over frames by a warm-up queue.
 */

import { FLOORS, SOUND_SPOTS, Floor } from '../data/soundscape';
import { AMALFI, ISTANBUL, MADEIRA, HILLSIDE, perCity } from '../world/cityId';
import { Lofi } from './music/lofi';
import { LOFI } from './music/tunes';
import { SVF, TAU, impulse, mtof, noise, pick, rand, render } from './synth';

export type SfxName = 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh' | 'jet'
  | 'bite' | 'crunch' | 'slurp' | 'sip' | 'drip' | 'blow' | 'clink' | 'rustle' | 'yum' | 'ding' | 'shutter';

export interface AudioRoom { rect: [number, number, number, number]; kind: string }
/** A great hall one walks into: its floor plan (metres) and what it is. */
export interface AudioHall { rect: [number, number, number, number]; kind: 'church' | 'mosque' }

const SR = 32000; // render rate for bright one-shots
const LSR = 22050; // render rate for mellow notes and footsteps (Safari needs >= 22050)

type Inst = 'koto' | 'bell';

const TILE_ROOMS = ['konbini', 'pharmacy', 'bakery', 'fish', 'hotel'];
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
  /** Amalfi: the sea breaking on the beach, heard faintly all over town and fuller down by the shore. */
  private surf: GainNode | null = null;
  /** Far-off sounds (gulls): dulled and sent wetter to the reverb. */
  private far!: AudioNode;
  private verb!: ConvolverNode;
  private bufs = new Map<string, AudioBuffer>();
  private warm: string[] = [];
  /** This city's lo-fi, made on start. */
  private lofi: Lofi | null = null;
  // listener
  private lx = 0;
  private lz = 0;
  private lroom = -1;
  private rooms: AudioRoom[] = [];
  private halls: AudioHall[] = [];
  private lhall = -1;
  /** The halls' long stone echo and the organ's soft chords, made the first time one is entered. */
  private hallVerb: ConvolverNode | null = null;
  private hallSend!: GainNode;
  private carpet!: BiquadFilterNode;
  private organ: { out: GainNode; oscs: OscillatorNode[]; next: number; chord: number } | null = null;
  private night = 0;
  private inside = false;
  private timers: Record<string, number> = {};
  /** Volumes 0..1 for the music, the world around you and UI/cooking effects. */
  private vol = { music: 0.8, amb: 0.6, sfx: 0.8 };
  /** How near the open water is, 0..1 (gulls carry further by the sea). */
  private sea = 0;

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
    this.verb.buffer = impulse(ctx, 1.6);
    this.verb.connect(this.gain(0.32, this.master));

    // music bus: instruments -> volume -> warm tone filter -> level (+ reverb send)
    this.musicLevel = this.gain(0.36, this.master);
    this.musicLevel.connect(this.gain(0.55, this.verb));
    this.musicTone = this.filter('lowpass', 9000, 0.4, this.musicLevel);
    this.music = this.gain(0, this.musicTone);
    this.lofi = new Lofi(ctx, this.music, perCity(LOFI), true);

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
    this.far = this.filter('lowpass', 2600, 0.4, this.street);
    this.far.connect(this.gain(0.6, this.verb));
    if (HILLSIDE) {
      this.surf = this.gain(0, this.street);
      this.loop(this.surfLoop(), 1, this.surf);
    }
    this.setVolumes(this.vol.music, this.vol.amb, this.vol.sfx);

    const now = ctx.currentTime;
    this.timers.bird = now + rand(15, 40);
    this.timers.cricket = now + rand(5, 12);
    this.timers.horn = now + rand(25, 60);

    // queue footsteps and eating sounds so they're rendered a couple per frame before they're needed (the music has its own queue)
    if (AMALFI || MADEIRA) this.warm.push('gull', 'toll');
    if (ISTANBUL) this.warm.push('gull', 'horn', 'ezan');
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

  /** The cathedral and the mosques: inside them the street falls away, steps ring, and in the church an organ plays. */
  setHalls(halls: AudioHall[]): void {
    this.halls = halls;
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
    this.water.gain.setTargetAtTime(water * (this.surf ? 0.12 : 0.3), t, 0.8);
    this.surf?.gain.setTargetAtTime(inside ? 0 : 0.035 + 0.13 * water, t, 1.2);
    this.sea = water;
    this.bed.gain.setTargetAtTime(inside ? 0.01 : 0.03 * (1 - night * 0.4), t, 1.5);
  }

  /** Where the listener is. Call a few times a second. */
  scene(x: number, z: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.lx = x; this.lz = z;
    const room = this.inside ? -1 : this.roomAt(x, z);
    const hall = this.inside ? -1 : this.hallAt(x, z);
    if (room !== this.lroom || hall !== this.lhall) {
      this.lroom = room;
      this.lhall = hall;
      // in a great hall the town outside is a murmur through the thick walls, the street tune nearly gone
      this.streetTone.frequency.setTargetAtTime(hall >= 0 ? 520 : room >= 0 || this.inside ? 1100 : 16000, t, hall >= 0 ? 0.9 : 0.3);
      this.street.gain.setTargetAtTime(hall >= 0 ? 0.32 : room >= 0 ? 0.55 : 1, t, hall >= 0 ? 0.9 : 0.3);
      this.musicTone.frequency.setTargetAtTime(hall >= 0 ? 650 : this.inside ? 1500 : 9000, t, 0.9);
      this.musicLevel.gain.setTargetAtTime(hall >= 0 ? 0.12 : 0.36, t, 0.9);
      if (hall >= 0) this.hallBus();
      this.hallSend?.gain.setTargetAtTime(hall >= 0 ? 1 : 0, t, 0.4);
      this.organ?.out.gain.setTargetAtTime(hall >= 0 && this.halls[hall].kind === 'church' ? 0.022 : 0, t, 2.5);
    }
    if (hall >= 0 && this.halls[hall].kind === 'church') this.playOrgan(t);
  }

  private hallAt(x: number, z: number): number {
    for (let i = 0; i < this.halls.length; i++) if (inRect(this.halls[i].rect, x, z)) return i;
    return -1;
  }

  /**
   * The halls' sound, made once: a long dark echo (five seconds of stone) that footsteps and the organ go into,
   * the soft dull fall of a step on carpet, and the organ itself: a few soft flue pipes holding slow chords.
   */
  private hallBus(): void {
    const ctx = this.ctx!;
    if (this.hallVerb) return;
    this.hallVerb = ctx.createConvolver();
    this.hallVerb.buffer = impulse(ctx, 5, 0.9);
    this.hallVerb.connect(this.gain(0.5, this.filter('lowpass', 3200, 0.4, this.amb)));
    this.hallSend = this.gain(0, this.hallVerb);
    this.carpet = this.filter('lowpass', 900, 0.5, this.amb);
    const out = this.gain(0, this.amb);
    out.connect(this.hallVerb);
    const tone = this.filter('lowpass', 1400, 0.5, out);
    const oscs: OscillatorNode[] = [];
    // three voices, each a pipe with its octave: sine and a quiet triangle an octave up
    for (let i = 0; i < 3; i++) for (const [type, mul, v] of [['sine', 1, 0.5], ['triangle', 2, 0.14]] as const) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = 220 * mul;
      o.connect(this.gain(v, tone));
      o.start();
      oscs.push(o);
    }
    this.organ = { out, oscs, next: 0, chord: 0 };
  }

  /** The organ moves to its next chord every few bars, gliding, the way someone practising softly would. */
  private playOrgan(t: number): void {
    const o = this.organ;
    if (!o || t < o.next) return;
    // F major, slow and plain: F, Dm, B-flat, C, Am, B-flat, C, F (bass, third, fifth as midi notes)
    const CH = [[53, 57, 60], [50, 57, 62], [46, 53, 58], [48, 55, 64], [45, 52, 60], [46, 53, 62], [48, 55, 60], [41, 57, 60]];
    const ch = CH[o.chord++ % CH.length];
    ch.forEach((m, i) => {
      const f = 440 * Math.pow(2, (m - 69) / 12);
      o.oscs[i * 2].frequency.setTargetAtTime(f, t, 0.35);
      o.oscs[i * 2 + 1].frequency.setTargetAtTime(f * 2, t, 0.35);
    });
    o.next = t + rand(6, 9);
  }

  /** The player's foot touching the ground (from the walk cycle): barely there, just enough to feel the floor. */
  step(x: number, z: number, run: boolean): void {
    if (!this.ctx || !this.vol.amb) return;
    const t = this.ctx.currentTime + 0.005, vol = (run ? 0.035 : 0.024) * rand(0.7, 1.05);
    const h = this.inside ? -1 : this.hallAt(x, z);
    if (h >= 0 && this.hallVerb) {
      const hall = this.halls[h];
      // on a mosque's carpet a step is a soft dull pad; on a church's marble it rings down the nave
      if (hall.kind === 'mosque' && z < hall.rect[3] - 1.1) { this.fire(this.buf(`step-wood-${Math.floor(rand(0, 3))}`), t, vol * 0.45, this.carpet, rand(0.62, 0.72)); return; }
      const b = this.buf(`step-stone-${Math.floor(rand(0, 3))}`), rate = rand(0.88, 1.04);
      this.fire(b, t, vol, this.amb, rate);
      this.fire(b, t, vol * 1.6, this.hallSend, rate);
      return;
    }
    const k = `step-${this.surfaceAt(x, z)}-${Math.floor(rand(0, 3))}`;
    this.fire(this.buf(k), t, vol, this.amb, rand(0.88, 1.08));
  }

  /** Called every frame: runs the sequencers, ambient life and the render warm-up queue. */
  tick(night: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    this.night = night;
    for (let i = 0; i < 2 && this.warm.length; i++) this.buf(this.warm.shift()!);
    const now = ctx.currentTime;
    if (this.vol.music) this.lofi?.tick(now, night);
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
      case 'ding': note('bell', 88, t, 0.2); note('bell', 84, t + 0.3, 0.18); break; // the lift arrives
      case 'whoosh': fire('whoosh', t, 0.42, rand(0.95, 1.05)); break;
      case 'jet': fire('jet', t, 0.3); break;
      case 'shutter': fire('shutter', t, 0.55); fire('shutter', t + 0.075, 0.38, 0.82); break; // curtain opens, then closes
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
    // Amalfi: now and then a gull far out over the bay, a little nearer by the sea
    if (HILLSIDE && due('gull', ISTANBUL ? 18 : 35, ISTANBUL ? 50 : 90) && n < 0.6) {
      const pan = rand(-0.9, 0.9), vol = rand(0.01, 0.018) * (0.4 + 0.6 * this.sea);
      for (let i = 0, c = 1 + Math.floor(rand(0, 2)); i < c; i++) this.fire(this.buf('gull'), at + i * rand(0.5, 0.8), vol * (1 - i * 0.25), this.far, rand(0.9, 1.05), undefined, pan);
    }
    // Istanbul: a ferry's horn somewhere out on the Bosphorus, day and night
    if (ISTANBUL && due('horn', 70, 160)) {
      const vol = rand(0.035, 0.06) * (0.5 + 0.5 * this.sea), pan = rand(0.2, 0.8);
      this.fire(this.buf('horn'), at, vol, this.far, rand(0.94, 1.04), undefined, pan);
      if (Math.random() < 0.5) this.fire(this.buf('horn'), at + 2.6, vol * 0.8, this.far, 1, undefined, pan);
    }
  }

  /** The call to prayer from a minaret, `delay` seconds from now, reverberating across the roofs. */
  ezan(vol: number, delay: number): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.1 + delay;
    this.fire(this.buf('ezan'), t, vol * (this.inside ? 0.35 : 1), this.far, 1, undefined, delay ? -0.5 : 0.3);
    this.fire(this.buf('ezan'), t + 0.9, vol * 0.3 * (this.inside ? 0.35 : 1), this.verb, 1, undefined, delay ? 0.4 : -0.4);
  }

  /** The cathedral bell striking the hour, fainter the further away it is. */
  toll(strokes: number, vol: number): void {
    if (!this.ctx || this.inside) return;
    const t = this.ctx.currentTime + 0.1;
    for (let i = 0; i < strokes; i++) this.fire(this.buf('toll'), t + i * 2.4, vol, this.street, 1, undefined, 0.2);
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

  /**
   * The call to prayer: a single voice on the open vowel, long held tones ornamented with melisma, phrase by phrase
   * with breaths between. A glottal buzz through three vowel formants, vibrato that widens on the held notes, the
   * pitch gliding between steps of a Hicaz-like scale.
   */
  private renderEzan(): AudioBuffer {
    const base = 207.65; // G#3
    // [semitones above the tonic, seconds] per note, phrases split by rests (null)
    const line: ([number, number] | null)[] = [
      [0, 1.4], [1, 0.3], [0, 0.3], [4, 0.5], [5, 2.2], [4, 0.35], [1, 0.4], [0, 1.6], null,
      [5, 0.8], [7, 0.4], [8, 0.3], [7, 2.0], [5, 0.4], [4, 0.4], [5, 0.3], [4, 0.3], [1, 0.4], [0, 1.8], null,
      [7, 1.0], [8, 0.3], [7, 0.3], [5, 0.3], [7, 2.4], [8, 0.3], [10, 0.6], [8, 0.4], [7, 0.4], [5, 0.5], [4, 0.4], [5, 2.0], null,
      [4, 0.6], [5, 0.4], [4, 0.3], [1, 0.4], [0, 2.6],
    ];
    const notes: { t0: number; t1: number; st: number }[] = [];
    let t = 0.2;
    const rests: [number, number][] = [];
    for (const n of line) {
      if (!n) { rests.push([t, t + 1.6]); t += 1.6; continue; }
      notes.push({ t0: t, t1: t + n[1], st: n[0] });
      t += n[1];
    }
    const dur = t + 1.0;
    return this.render(dur, LSR, () => {
      const f1 = new SVF(LSR, 0.18), f2 = new SVF(LSR, 0.14), f3 = new SVF(LSR, 0.1);
      let ph = 0, i = 0, st = notes[0].st;
      return (tt) => {
        while (i < notes.length - 1 && tt >= notes[i].t1) i++;
        const nt = notes[i];
        // glide to each new step, then hold with a slow widening vibrato
        st += (nt.st - st) * 0.0016;
        const held = Math.min(1, Math.max(0, tt - nt.t0 - 0.25) / 0.8);
        const vib = (0.12 + 0.28 * held) * Math.sin(TAU * 5.4 * tt);
        const f = base * 2 ** ((st + vib) / 12);
        ph += (TAU * f) / LSR;
        // a plain sawtooth buzz (cheap to render); the formants and the reverb soften it into a voice
        const src = ((ph / TAU) % 1) * 2 - 1 + noise() * 0.05;
        const v = f1.run(src, 760) * 1.0 + f2.run(src, 1180) * 0.55 + f3.run(src, 2650) * 0.22;
        let env = Math.min(1, tt / 0.25) * Math.min(1, Math.max(0, dur - 0.6 - tt) / 0.6);
        for (const [a, b] of rests) if (tt > a - 0.35 && tt < b) env *= Math.max(0, Math.min(1, (a - tt) / 0.35, (tt - b + 0.3) / 0.3));
        return v * env;
      };
    });
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

  private render(dur: number, sr: number, gen: () => (t: number) => number, seamless = false): AudioBuffer {
    return render(this.ctx!, dur, sr, gen, seamless);
  }

  private make(k: string): AudioBuffer {
    let m: RegExpMatchArray | null;
    if ((m = k.match(/^(koto|bell)(\d+)$/))) return m[1] === 'koto' ? this.renderKoto(Number(m[2])) : this.renderBell(Number(m[2]));
    if ((m = k.match(/^step-(\w+)-\d$/))) return this.renderStep(m[1] as Floor);
    return this.renderSfx(k);
  }

  /**
   * A koto string for the UI chimes (Karplus-Strong); the buffer's sample rate is picked so the delay line tunes
   * exactly.
   */
  private renderKoto(m: number): AudioBuffer {
    const f = mtof(m);
    const N = Math.max(4, Math.round(24000 / f - 0.5));
    const sr = f * (N + 0.5);
    const len = Math.ceil(sr * 2.2);
    const y = new Float32Array(len);
    let lp = 0;
    const smooth = 0.6;
    for (let i = 0; i <= N && i < len; i++) { lp = smooth * lp + (1 - smooth) * noise(); y[i] = lp; }
    const ring = Math.max(1.2, 3.6 - f / 600);
    const keep = 10 ** (-3 / (f * ring)); // per-period loss for the wanted ring time
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
      case 'jet': return this.render(3.2, LSR, () => { const bp = new SVF(LSR, 0.6), lo = new SVF(LSR, 0.4); return (t) => { // engines spool up, roll, lift off
        const spool = Math.min(1, t / 1.4), env = Math.min(1, t / 0.5) * (t > 2.2 ? Math.max(0, 1 - (t - 2.2) / 1) : 1);
        return (bp.run(noise(), 260 + 900 * spool * spool) * 0.8 + lo.run(noise(), 90 + 60 * spool) * 1.4) * env;
      }; });
      case 'shutter': return this.render(0.07, SR, () => { const bp = new SVF(SR, 1.4); return (t) => // a small mechanical clack
        (bp.run(noise(), 2600) * 0.9 + Math.sin(TAU * 1450 * t) * 0.35) * Math.min(1, t / 0.0008) * Math.exp(-t * 85);
      });
      case 'gull': return this.render(0.62, SR, () => { let ph = 0; return (t) => { // a yellow-legged gull's "kyow"
        const f = 1350 * (1 - 0.42 * Math.min(1, t / 0.5)) * (1 + 0.04 * Math.sin(TAU * 26 * t));
        ph += (TAU * f) / SR;
        const env = Math.min(1, t / 0.03) * Math.exp(-Math.max(0, t - 0.25) * 7);
        return (Math.sin(ph) + 0.55 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph)) * 0.55 * env * (0.8 + 0.2 * Math.sin(TAU * 52 * t));
      }; });
      case 'horn': return this.render(2.4, LSR, () => { const lp = new SVF(LSR, 0.6); let ph = 0; return (t) => { // a ferry's deep two-tone horn
        ph += (TAU * 98 * (1 + 0.004 * Math.sin(TAU * 4 * t))) / LSR;
        const src = Math.sin(ph) + 0.6 * Math.sin(2 * ph) + 0.45 * Math.sin(3 * ph) + 0.3 * Math.sin(4 * ph) + 0.2 * Math.sin(5.04 * ph);
        return lp.run(src, 700) * Math.min(1, t / 0.12) * Math.min(1, (2.4 - t) / 0.5);
      }; });
      case 'ezan': return this.renderEzan();
      case 'toll': return this.render(6, LSR, () => (t) => { // a big bronze bell: hum, prime, minor third, fifth, nominal
        const f = 196;
        let s = 0;
        for (const [r, a, d] of [[0.5, 0.5, 0.35], [1, 0.8, 0.6], [1.19, 0.45, 0.8], [1.5, 0.3, 1.1], [2, 0.5, 1.4], [2.98, 0.18, 2.4]]) s += a * Math.sin(TAU * f * r * t) * Math.exp(-t * d);
        return s * 0.45 * Math.min(1, t / 0.003);
      });
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

  /**
   * Small Tyrrhenian waves on Marina Grande (a seamless 24 s loop): each swells in low, folds over in a soft wash
   * and drains back down the beach with a fine hiss of pebbles. Three waves of different size, never on a beat.
   */
  private surfLoop(): AudioBuffer {
    const L = 24, waves = [[0, 1], [7.4, 0.7], [15.9, 0.85]];
    return this.render(L, LSR, () => {
      const wash = new SVF(LSR, 0.5), hiss = new SVF(LSR, 0.7);
      let low = 0, peb = 0;
      return (t) => {
        let sw = 0, cr = 0, bk = 0;
        for (const [t0, a] of waves) {
          const d = (((t - t0) % L) + L) % L;
          sw += a * Math.exp(-(((d - 2.2) / 1.1) ** 2));
          if (d > 2.4) cr += a * (1 - Math.exp(-(d - 2.4) / 0.12)) * Math.exp(-(d - 2.4) / 1.3);
          if (d > 3.2) bk += a * Math.min(1, (d - 3.2) / 0.6) * Math.exp(-(d - 3.2) / 1.9);
        }
        low += 0.06 * (noise() - low);
        if (Math.random() < 0.004 * bk) peb = rand(0.3, 1);
        peb *= 0.9;
        return low * 2.2 * (0.25 + sw) + wash.run(noise(), 700 + 900 * cr) * cr * 0.55 + hiss.run(noise() * (0.25 + peb), 3800) * bk * 0.22;
      };
    }, true);
  }
}
