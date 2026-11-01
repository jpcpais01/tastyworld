/**
 * Procedural audio, no assets. A cozy lo-fi street-food loop (koto melody, electric piano, upright bass, brushed kit)
 * over the J-pop "royal road" progression, a deliberately quiet street (a soft city hush, the canal lapping, the odd
 * sparrow by day and bell cricket by night, a faint grill crackle) and soft, rounded UI sounds. Amalfi keeps the
 * same unhurried feel but plays it on the coast: a fingerpicked nylon guitar and a soft flute over upright bass and
 * brushes, the sea breaking on the beach below the town, the odd distant gull and the cathedral bell.
 * Music, ambience and effects each have their own volume.
 * Every note and sound is synthesised once into a small mono buffer and then replayed, so at runtime a note costs a
 * buffer source and a gain node. Rendering is spread over frames by a warm-up queue.
 */

import { FLOORS, SOUND_SPOTS, Floor } from '../data/soundscape';
import { AMALFI, ISTANBUL, MADEIRA, HILLSIDE, perCity } from '../world/cityId';

export type SfxName = 'click' | 'coin' | 'stamp' | 'success' | 'fail' | 'sizzle' | 'chop' | 'pop' | 'chime' | 'door' | 'meow' | 'whoosh' | 'jet'
  | 'bite' | 'crunch' | 'slurp' | 'sip' | 'drip' | 'blow' | 'clink' | 'rustle' | 'yum' | 'ding' | 'shutter';

export interface AudioRoom { rect: [number, number, number, number]; kind: string }
/** A great hall one walks into: its floor plan (metres) and what it is. */
export interface AudioHall { rect: [number, number, number, number]; kind: 'church' | 'mosque' }

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
interface Section { prog: number[]; mel?: Phrase; arp?: boolean; bass: boolean; drums: 0 | 1 | 2; lead?: Inst }
interface Song {
  /** [bass root, 4-voice voicing] */
  chords: number[][];
  bpm: number;
  swing: number;
  sections: Section[];
  loopFrom: number;
  /** How it is played: Tokyo's lo-fi band, or Amalfi's guitar and flute. */
  style?: 'lofi' | 'riviera';
}
type Inst = 'koto' | 'bell' | 'ep' | 'bass' | 'mando' | 'nylon' | 'flute';
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

/**
 * Amalfi's tune, in the same easy lo-fi spirit as Tokyo's but by the sea: D major with a Neapolitan turn to G minor
 * in the chorus. A nylon guitar fingerpicks the chords and sings the verse, a soft flute takes the chorus, a mandolin
 * drops in a few plucked notes in the break (no tremolo), upright bass and brushes keep it all slow and swaying.
 */
const RIVIERA: Song = (() => {
  const A = [0, 1, 2, 3, 0, 1, 4, 8], B = [4, 5, 6, 7, 2, 3, 0, 8];
  const m1: Phrase = [
    [[0, 69, 2], [2, 74, 2], [4, 76, 3], [7, 78, 1]],
    [[0, 78, 3], [3, 76, 1], [4, 74, 4]],
    [[2, 71, 1], [3, 74, 1], [4, 79, 2], [6, 78, 2]],
    [[0, 76, 6]],
    [[0, 69, 2], [2, 74, 2], [4, 76, 3], [7, 78, 1]],
    [[0, 81, 3], [3, 78, 1], [4, 76, 2], [6, 74, 2]],
    [[0, 71, 2], [2, 74, 2], [4, 78, 2], [6, 76, 2]],
    [[0, 74, 6]],
  ];
  const m2: Phrase = [
    [[0, 78, 4], [4, 79, 2], [6, 81, 2]],
    [[0, 82, 4], [4, 81, 2], [6, 79, 2]],
    [[0, 81, 6], [6, 76, 2]],
    [[0, 78, 3], [3, 75, 1], [4, 78, 4]],
    [[0, 79, 4], [4, 78, 2], [6, 76, 2]],
    [[0, 73, 2], [2, 76, 2], [4, 78, 2], [6, 79, 2]],
    [[0, 78, 6]],
    [[2, 76, 2], [4, 74, 4]],
  ];
  return {
    chords: [
      [38, 54, 57, 61, 64], // Dmaj9
      [35, 57, 61, 62, 66], // Bm9
      [40, 55, 59, 62, 66], // Em9
      [45, 55, 59, 61, 66], // A13
      [43, 54, 57, 59, 62], // Gmaj9
      [43, 52, 55, 58, 62], // Gm6
      [42, 52, 57, 61, 64], // F#m7
      [47, 51, 57, 59, 66], // B7
      [45, 55, 59, 62, 64], // A7sus4
    ],
    bpm: 78, swing: 0.56, loopFrom: 1, style: 'riviera',
    sections: [
      { prog: A, bass: false, drums: 0 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 1 },
      { prog: B, mel: m2, lead: 'flute', bass: true, drums: 2 },
      { prog: A, arp: true, lead: 'mando', bass: true, drums: 2 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 2 },
      { prog: B, mel: m2, lead: 'flute', bass: true, drums: 2 },
      { prog: B, arp: true, lead: 'nylon', bass: true, drums: 0 },
    ],
  };
})();

/**
 * Funchal's tune: A minor with a turn to the major in the chorus, the mood of a fado sung at a café table rather than in
 * a dark tavern. A nylon guitar (the viola) fingerpicks and sings the verse, the bright plucked string of the guitarra
 * portuguesa takes the chorus and the break, upright bass and brushes keep it slow.
 */
const ATLANTICO: Song = (() => {
  const A = [0, 1, 2, 3, 0, 1, 4, 3], B = [5, 6, 2, 3, 5, 6, 7, 0];
  const m1: Phrase = [
    [[0, 76, 2], [2, 77, 1], [3, 76, 1], [4, 72, 4]],
    [[0, 74, 3], [3, 72, 1], [4, 71, 4]],
    [[0, 69, 2], [2, 72, 2], [4, 76, 3], [7, 74, 1]],
    [[0, 71, 6]],
    [[0, 76, 2], [2, 77, 1], [3, 79, 1], [4, 81, 4]],
    [[0, 79, 3], [3, 77, 1], [4, 76, 2], [6, 74, 2]],
    [[0, 72, 2], [2, 71, 2], [4, 69, 2], [6, 71, 2]],
    [[0, 69, 6]],
  ];
  const m2: Phrase = [
    [[0, 81, 4], [4, 79, 2], [6, 77, 2]],
    [[0, 76, 3], [3, 77, 1], [4, 79, 4]],
    [[0, 77, 2], [2, 76, 2], [4, 74, 2], [6, 72, 2]],
    [[0, 71, 4], [4, 72, 2], [6, 74, 2]],
    [[0, 81, 3], [3, 83, 1], [4, 84, 4]],
    [[0, 83, 2], [2, 81, 2], [4, 79, 2], [6, 77, 2]],
    [[0, 76, 2], [2, 74, 2], [4, 72, 2], [6, 71, 2]],
    [[0, 69, 6]],
  ];
  return {
    chords: [
      [45, 57, 60, 64, 67], // Am7
      [38, 53, 57, 60, 65], // Dm7
      [43, 53, 55, 59, 62], // G7
      [40, 52, 56, 59, 62], // E7
      [41, 53, 57, 60, 64], // Fmaj7
      [36, 52, 55, 59, 64], // Cmaj7
      [41, 53, 57, 60, 65], // F6
      [40, 52, 55, 59, 64], // Em7
    ],
    bpm: 74, swing: 0.55, loopFrom: 1, style: 'riviera',
    sections: [
      { prog: A, bass: false, drums: 0 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 1 },
      { prog: B, mel: m2, lead: 'mando', bass: true, drums: 2 },
      { prog: A, arp: true, lead: 'mando', bass: true, drums: 1 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 2 },
      { prog: B, mel: m2, lead: 'flute', bass: true, drums: 2 },
      { prog: B, arp: true, lead: 'nylon', bass: true, drums: 0 },
    ],
  };
})();

/**
 * Istanbul's tune: D Hicaz, the augmented second between E flat and F sharp that every street musician in Beyoğlu
 * leans on, over a slow 4/4 sway. A dark nylon string stands in for the oud and sings the verse, a breathy flute for
 * the ney takes the chorus, a bright plucked string for the bağlama fills the break.
 */
const BOSPHORUS: Song = (() => {
  const A = [0, 1, 0, 2, 3, 1, 0, 4], B = [3, 6, 2, 1, 3, 5, 7, 0];
  const m1: Phrase = [
    [[0, 74, 2], [2, 75, 1], [3, 78, 1], [4, 79, 2], [6, 78, 2]],
    [[0, 75, 3], [3, 74, 1], [4, 74, 4]],
    [[0, 81, 2], [2, 79, 1], [3, 78, 1], [4, 79, 2], [6, 81, 2]],
    [[0, 82, 3], [3, 81, 1], [4, 79, 2], [6, 75, 2]],
    [[0, 79, 2], [2, 82, 2], [4, 81, 2], [6, 79, 2]],
    [[0, 78, 2], [2, 79, 1], [3, 78, 1], [4, 75, 4]],
    [[0, 74, 2], [2, 75, 1], [3, 78, 1], [4, 75, 2], [6, 74, 2]],
    [[0, 72, 2], [2, 75, 2], [4, 74, 4]],
  ];
  const m2: Phrase = [
    [[0, 86, 4], [4, 84, 2], [6, 82, 2]],
    [[0, 82, 3], [3, 81, 1], [4, 79, 4]],
    [[0, 84, 2], [2, 82, 1], [3, 81, 1], [4, 79, 2], [6, 75, 2]],
    [[0, 78, 3], [3, 79, 1], [4, 78, 2], [6, 75, 2]],
    [[0, 79, 4], [4, 82, 2], [6, 81, 2]],
    [[0, 79, 2], [2, 76, 2], [4, 79, 4]],
    [[0, 81, 2], [2, 79, 2], [4, 73, 2], [6, 76, 2]],
    [[0, 74, 6]],
  ];
  return {
    chords: [
      [38, 54, 57, 62, 66], // D
      [39, 55, 58, 62, 67], // Ebmaj7
      [36, 55, 60, 63, 67], // Cm
      [43, 55, 58, 62, 67], // Gm
      [38, 54, 57, 60, 66], // D7
      [43, 52, 55, 58, 62], // Gm6
      [46, 53, 58, 62, 65], // Bb
      [45, 55, 57, 61, 64], // A7
    ],
    bpm: 86, swing: 0.55, loopFrom: 1, style: 'riviera',
    sections: [
      { prog: A, bass: false, drums: 0 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 1 },
      { prog: B, mel: m2, lead: 'flute', bass: true, drums: 2 },
      { prog: A, arp: true, lead: 'mando', bass: true, drums: 2 },
      { prog: A, mel: m1, lead: 'nylon', bass: true, drums: 2 },
      { prog: B, mel: m2, lead: 'flute', bass: true, drums: 2 },
      { prog: B, arp: true, lead: 'nylon', bass: true, drums: 0 },
    ],
  };
})();

/** A semitone or whole tone below, staying in the scale: the koto's little lead-in. */
const graceOf = (m: number) => m - ([0, 5].includes(m % 12) ? 1 : 2);

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
  private bgmOut!: Out;
  private bufs = new Map<string, AudioBuffer>();
  private warm: string[] = [];
  private bgm!: Seq;
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
    this.far = this.filter('lowpass', 2600, 0.4, this.street);
    this.far.connect(this.gain(0.6, this.verb));
    if (HILLSIDE) {
      this.surf = this.gain(0, this.street);
      this.loop(this.surfLoop(), 1, this.surf);
    }
    this.setVolumes(this.vol.music, this.vol.amb, this.vol.sfx);

    const now = ctx.currentTime;
    const song = perCity({ tokyo: BGM, amalfi: RIVIERA, istanbul: BOSPHORUS, madeira: ATLANTICO });
    this.bgm = { song, t: now + 0.4, sec: 0, bar: 0, step: 0, out: this.bgmOut, bpm: song.bpm };
    this.timers.bird = now + rand(15, 40);
    this.timers.cricket = now + rand(5, 12);
    this.timers.horn = now + rand(25, 60);

    // queue the tune's notes and footsteps so they're rendered a couple per frame before they're needed
    this.queueSong(song);
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
    this.hallVerb.buffer = this.impulse(5, 0.9);
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

  // ---- sequencers ----

  private queueSong(s: Song): void {
    const q = new Set<string>();
    const add = (i: Inst, m: number) => q.add(this.instKey(i, m)[0]);
    const riv = s.style === 'riviera';
    for (const c of s.chords) {
      c.slice(1).forEach((m) => add(riv ? 'nylon' : 'ep', m));
      for (let d = 0; d <= 12; d++) add('bass', c[0] + d);
    }
    for (const sec of s.sections) {
      const lead = sec.lead ?? 'koto';
      if (sec.arp) for (const c of s.chords) c.slice(1).forEach((m) => add(lead, m + 12));
      for (const b of sec.mel ?? []) for (const n of b) { add(lead, n[1]); add(lead, graceOf(n[1])); }
    }
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
    if (q.song.style === 'riviera') { this.playRiviera(q, t, e); return; }
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

  /**
   * Amalfi: the guitar fingerpicks every chord (thumb on the low voice, fingers rolling over the rest), the bass
   * lands on 1 with a soft walk-up, brushes on 2 and 4. The lead is the guitar, the flute or a sparse mandolin.
   */
  private playRiviera(q: Seq, t: number, e: number): void {
    const song = q.song, sec = song.sections[q.sec], s = q.step, bar = q.bar, o = q.out;
    const ch = song.chords[sec.prog[bar]];
    const night = this.night > 0.5;
    const h = () => t + rand(-0.007, 0.007);
    const v = (x: number) => x * rand(0.85, 1.1);
    const lead = sec.lead ?? 'nylon';

    // fingerpicking: a pinch on the downbeat, then a gentle roll; at night only the quarter notes
    if (s === 0) [1, 3].forEach((i, k) => this.note('nylon', ch[i], t + k * 0.018, v(0.3), o.ep, e * 7));
    else if (!night || s % 2 === 0) {
      const i = [0, 3, 2, 4, 2, 3, 2, 4][s];
      this.note('nylon', ch[i], h(), v(s % 2 ? 0.15 : 0.2), o.ep, e * 3.5);
    }

    if (sec.bass) {
      const b = ch[0];
      if (s === 0) this.note('bass', b, t, v(0.55), o.bass, e * 3.6);
      if (s === 4 && bar % 2 === 0) this.note('bass', b + 7, h(), v(0.36), o.bass, e * 2.6);
      if (s === 6 && bar % 2 === 1 && !night) this.note('bass', b + 12, h(), v(0.3), o.bass, e * 1.6);
    }

    if (sec.drums) {
      if (s % 2 === 1) this.fire(this.buf('shaker'), h(), v(sec.drums === 2 ? 0.1 : 0.06), o.drums);
      if (sec.drums === 2) {
        if (s === 2 || s === 6) this.fire(this.buf('brush'), h(), v(night ? 0.14 : 0.2), o.drums);
        if (s === 0 && !night) this.fire(this.buf('kick'), t, v(0.32), o.drums);
      }
    }

    if (sec.mel) {
      for (const [at, m, len] of sec.mel[bar]) {
        if (at !== s) continue;
        if (lead === 'flute') {
          this.note('flute', m, h(), v(night ? 0.1 : 0.13), o.lead, e * len + 0.12);
        } else {
          if (len >= 2 && Math.random() < 0.15) this.note(lead, graceOf(m), t - 0.055, v(0.16), o.lead, 0.06);
          this.note(lead, m, h(), v(night ? 0.34 : 0.4), o.lead, e * len + 0.4);
        }
      }
    }
    // the break: a few plucked notes picked out of the chord, never busy
    if (sec.arp && s % 2 === 0 && Math.random() < (s === 0 ? 0.7 : 0.32)) {
      this.note(lead, ch[1 + Math.floor(Math.random() * 4)] + 12, h(), v(lead === 'mando' ? 0.16 : 0.26), o.lead, e * 3);
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
    if ((m = k.match(/^(ep|koto|bass|bell|mando|nylon|flute)(\d+)$/))) {
      const n = Number(m[2]);
      switch (m[1]) {
        case 'ep': return this.renderEp(n);
        case 'koto': return this.renderKoto(n);
        case 'mando': return this.renderKoto(n, 'mando');
        case 'nylon': return this.renderKoto(n, 'nylon');
        case 'flute': return this.renderFlute(n);
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

  /**
   * Karplus-Strong plucked string; the buffer's sample rate is picked so the delay line tunes exactly. The mandolin
   * is picked hard near the bridge (a brighter burst), steel strings ringing shorter; the nylon guitar is plucked
   * with the flesh of the finger (a dark, round burst) and rings long and warm.
   */
  private renderKoto(m: number, kind: 'koto' | 'mando' | 'nylon' = 'koto'): AudioBuffer {
    const bright = kind === 'mando', nylon = kind === 'nylon';
    const f = mtof(m);
    const N = Math.max(4, Math.round(24000 / f - 0.5));
    const sr = f * (N + 0.5);
    const len = Math.ceil(sr * 2.2);
    const y = new Float32Array(len);
    let lp = 0;
    const smooth = bright ? 0.15 : nylon ? 0.78 : 0.6;
    for (let i = 0; i <= N && i < len; i++) { lp = smooth * lp + (1 - smooth) * noise(); y[i] = lp; }
    const ring = bright ? Math.max(0.6, 1.6 - f / 900) : nylon ? Math.max(1.4, 3 - f / 800) : Math.max(1.2, 3.6 - f / 600);
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

  /**
   * A soft wooden flute: a near-sine tone with a breath of air around it, swelling in and settling into a slow,
   * shallow vibrato only once the note has been held a moment.
   */
  private renderFlute(m: number): AudioBuffer {
    const f = mtof(m);
    return this.render(3.4, LSR, () => {
      const air = new SVF(LSR, 0.25);
      let ph = 0;
      return (t) => {
        const vib = 1 + 0.0035 * Math.min(1, Math.max(0, t - 0.35) / 0.6) * Math.sin(TAU * 4.8 * t);
        ph += (TAU * f * vib) / LSR;
        const env = Math.min(1, t / 0.07) ** 2 * (0.82 + 0.18 * Math.exp(-t * 3)) * Math.exp(-t * 0.25);
        const tone = Math.sin(ph) + 0.18 * Math.sin(2 * ph) + 0.05 * Math.sin(3 * ph);
        const breath = air.run(noise(), f * 1.02) * (0.45 + 0.9 * Math.exp(-t * 12));
        return (tone + breath * 0.5) * env;
      };
    });
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

  /** Stereo room impulse: decaying noise that darkens over time. */
  /** A reverb's impulse: `dur` seconds of decaying noise, `decay` the rate it dies at (lower rings longer). */
  private impulse(dur: number, decay = 3.2): AudioBuffer {
    const ctx = this.ctx!, sr = ctx.sampleRate, n = Math.floor(dur * sr);
    const b = ctx.createBuffer(2, n, sr);
    for (let c = 0; c < 2; c++) {
      const d = b.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < n; i++) {
        const t = i / sr;
        lp += (0.9 - 0.8 * t / dur) * (noise() - lp);
        d[i] = lp * Math.exp(-t * decay) * (t < 0.012 ? t / 0.012 : 1);
      }
    }
    return b;
  }
}
