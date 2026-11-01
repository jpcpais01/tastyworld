/**
 * How the tunes are written down. Notes are names ("F#4", "Bb3", and "Bk4" for a B a koma flat, the Turkish
 * segâh); a chord is its bass then its voicing ("G2 F#3 A3 B3 D4"). A melody is one string of notes and rests
 * with lengths in sixteenths ("r2 B4/2 D5/2 E5/4"), bars split by "|", and "~" before a note to slide into it
 * or "^" to lead in with a grace note. Rhythms are 16 (or 32, for a two-bar figure) characters per bar.
 */

import type { Drum, Voice } from './instruments';

const PC: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC: Record<string, number> = { '': 0, '#': 1, b: -1, k: -0.3 };

/** MIDI number of a note name, NaN when it isn't one. */
export function note(s: string): number {
  const m = /^([A-G])([#bk]?)(-?\d)$/.exec(s);
  return m ? 12 * (Number(m[3]) + 1) + PC[m[1]] + ACC[m[2]] : NaN;
}

/** [bass, ...voicing low to high] */
export const chord = (s: string): number[] => s.trim().split(/\s+/).map(note);

export interface Hit { at: number; m: number; len: number; fx: '' | '~' | '^' }

/** Parse a melody into bars of hits. Bar lines must fall on whole bars; `errors` says where one doesn't. */
export function melody(s: string): { bars: Hit[][]; errors: string[] } {
  const bars: Hit[][] = [];
  const errors: string[] = [];
  let pos = 0;
  for (const tok of s.trim().split(/\s+/)) {
    if (tok === '|') {
      if (pos % 16) errors.push(`bar line at ${pos / 16} bars in "${s.slice(0, 40)}…"`);
      continue;
    }
    const r = /^r\/?(\d+)$/.exec(tok);
    if (r) { pos += Number(r[1]); continue; }
    const m = /^([~^]?)([A-G][#bk]?-?\d)\/(\d+)$/.exec(tok);
    if (!m || Number.isNaN(note(m[2]))) { errors.push(`bad token "${tok}"`); continue; }
    const bar = Math.floor(pos / 16);
    (bars[bar] ??= []).push({ at: pos % 16, m: note(m[2]), len: Number(m[3]), fx: m[1] as Hit['fx'] });
    pos += Number(m[3]);
  }
  if (pos % 16) errors.push(`melody ends mid-bar (${pos} sixteenths)`);
  for (let i = 0; i < Math.ceil(pos / 16); i++) bars[i] ??= [];
  return { bars, errors };
}

/** A way of playing the chords. `pat` is one bar (16) or two bars (32) of: */
export interface Comp {
  voice: Voice;
  /**
   * keys: X strikes the chord (rolled), x touches its top two notes, P pushes the next bar's chord in early.
   * pick: T is the thumb on the bass, 0-3 a finger on that note of the voicing.
   * strum: D/U a strum down or up (d/u softer), lightly damped after.
   * pad: X holds the chord until the next X.
   */
  style: 'keys' | 'pick' | 'strum' | 'pad';
  pat: string;
  vol: number;
  /** octaves up from the written voicing */
  up?: number;
}

export interface Line { voice: Voice; mel: string; vol: number; up?: number }

/** Improvised fills: a few notes at a time, moving by step through `scale` (pitch classes), landing on chord tones. */
export interface Fills {
  voice: Voice;
  scale: number[];
  lo: number;
  hi: number;
  /** chance of a note on each eighth */
  density: number;
  vol: number;
  /** chance of a quick four-note run into the next bar (a qanun's flourish) */
  runs?: number;
}

/** Drum parts: per drum, 16 or 32 characters of velocity 1-9. */
export type Groove = Partial<Record<Drum, string>>;

export interface Part {
  /** chord index per bar */
  prog: number[];
  comp: Comp[];
  lead?: Line;
  second?: Line;
  fills?: Fills;
  groove?: string;
  /**
   * Bass rhythm: R root (r softer), 5 the fifth, O the octave, b the flat seventh, A an approach note into the next
   * bar's root. false: no bass. Missing: the tune's.
   */
  bass?: string | false;
  /** the whole band low-passed to this (an intro heard through a wall, opening up) */
  lp?: number;
}

/** A few bell notes now and then, over the top. */
export interface Sparkle { voice: Voice; notes: string; every: number; chance: number; vol: number; count: [number, number] }

export interface Tune {
  title: string;
  bpm: number;
  /** where the off sixteenth falls in its pair (0.5 straight, 0.6 lazy) */
  swing: number;
  chords: string[];
  grooves: Record<string, Groove>;
  bass: string;
  parts: Part[];
  loopFrom: number;
  /** the tape's top end, Hz */
  tone: number;
  /** vinyl crackle level 0..1 */
  crackle: number;
  /** the lead's tape echo send 0..1 */
  echo: number;
  sparkle?: Sparkle;
}
