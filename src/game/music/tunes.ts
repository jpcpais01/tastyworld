/**
 * Each city's lo-fi, a day tune and a night tune, written in the city's own sound over the same dusty band
 * (see score.ts for the notation, lofi.ts for how it is played).
 *
 * Tokyo: a Rhodes and a koto over the "royal road" by day; at night a shakuhachi in the miyako-bushi scale, a furin
 * on the breeze and the clack of the night watch's hyōshigi.
 * Amalfi: a bossa-lofi in C, fingerpicked nylon guitar, a soft flute and the faint musette of an accordion, with a
 * minor-iv turn (Fm6) any Neapolitan song would know; at night a slow A minor ballad.
 * Istanbul: D Hicaz by day, a dark oud and a ney over a darbuka's maqsum and the odd zil; at night Uşşak, with its
 * second a koma flat.
 * Funchal: a guitarra portuguesa and a viola de fado, Madeira's little braguinha strumming in the chorus; at night
 * fado menor in B minor.
 */

import type { CityId } from '../../world/cityId';
import type { Comp, Tune } from './score';

// ---- Tokyo ----

const tokyoKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.15, pat: 'X.........x.....X.............P.' };

const TOKYO_DAY: Tune = {
  title: 'Shōtengai',
  bpm: 84, swing: 0.6, tone: 7000, crackle: 0.5, echo: 0.22, loopFrom: 1,
  chords: [
    'G2 F#3 A3 B3 D4', // Gmaj9
    'A2 G3 B3 C#4 F#4', // A13
    'F#2 A3 C#4 E4 G#4', // F#m9
    'B1 A3 C#4 D4 F#4', // Bm9
    'E2 G3 B3 D4 F#4', // Em9
    'A2 G3 B3 D4 E4', // A7sus4
    'D2 F#3 A3 C#4 E4', // Dmaj9
    'B1 A3 C4 D#4 F#4', // B7b9
  ],
  grooves: {
    boom: { kick: '9......4.7......9......4.7....5.', snare: '....8.......8.2.', hat: '5.3.6.2.5.3.6.3.', ohat: '..............................4.' },
    soft: { kick: '7.........5.....', rim: '....5.......5...', hat: '3.2.3.2.3.2.3.2.' },
  },
  bass: 'R......5..r...A.',
  parts: [
    { prog: [0, 1, 2, 3], comp: [tokyoKeys], bass: false, lp: 1100 },
    {
      prog: [0, 1, 2, 3, 4, 5, 6, 7], comp: [tokyoKeys], groove: 'boom',
      lead: { voice: 'koto', vol: 0.3, mel: 'r2 B4/2 D5/2 E5/4 D5/2 B4/4 | A4/6 B4/2 D5/4 E5/4 | F#5/6 E5/2 D5/2 E5/6 | D5/4 B4/4 A4/8 | r2 G5/2 F#5/2 E5/2 D5/4 B4/4 | D5/6 E5/2 A5/4 G5/4 | F#5/8 E5/4 D5/4 | r4 F#5/2 E5/2 D#5/4 B4/4' },
    },
    {
      prog: [0, 1, 2, 7, 4, 1, 6, 6], comp: [tokyoKeys], groove: 'boom',
      lead: { voice: 'koto', vol: 0.3, mel: 'A5/4 B5/4 A5/2 F#5/2 D5/4 | E5/6 F#5/2 E5/2 C#5/2 B4/4 | r2 A5/2 C#6/4 B5/2 A5/4 E5/2 | F#5/4 A5/4 G5/2 F#5/2 D#5/4 | E5/8 G5/4 B5/4 | A5/4 G5/4 E5/4 C#5/4 | D5/12 E5/2 F#5/2 | F#5/8 r8' },
    },
    {
      prog: [0, 1, 2, 3, 4, 5, 6, 7], comp: [tokyoKeys], groove: 'soft', bass: 'R.......O.....A.',
      lead: { voice: 'shaku', vol: 0.11, mel: 'r4 B4/12 | A4/10 B4/2 D5/4 | E5/12 r4 | F#5/8 E5/4 D5/4 | B4/16 | r4 A4/4 B4/4 D5/4 | E5/12 D5/4 | r16' },
      fills: { voice: 'shamisen', scale: [2, 4, 7, 9, 11], lo: 62, hi: 79, density: 0.14, vol: 0.2 },
    },
    {
      prog: [0, 1, 2, 3, 4, 5, 6, 7], comp: [tokyoKeys], groove: 'boom',
      lead: { voice: 'koto', vol: 0.3, mel: 'r2 B4/2 D5/2 E5/4 D5/2 B4/4 | A4/6 B4/2 D5/4 E5/4 | F#5/6 E5/2 D5/2 E5/6 | D5/4 B4/4 A4/8 | r2 G5/2 F#5/2 E5/2 D5/4 B4/4 | D5/6 E5/2 A5/4 G5/4 | F#5/8 E5/4 D5/4 | r4 F#5/2 E5/2 D#5/4 B4/4' },
      fills: { voice: 'shamisen', scale: [2, 4, 7, 9, 11], lo: 62, hi: 76, density: 0.05, vol: 0.14 },
    },
    {
      prog: [0, 1, 2, 7, 4, 1, 6, 6], comp: [tokyoKeys], groove: 'boom',
      lead: { voice: 'koto', vol: 0.3, mel: 'A5/4 B5/4 A5/2 F#5/2 D5/4 | E5/6 F#5/2 E5/2 C#5/2 B4/4 | r2 A5/2 C#6/4 B5/2 A5/4 E5/2 | F#5/4 A5/4 G5/2 F#5/2 D#5/4 | E5/8 G5/4 B5/4 | A5/4 G5/4 E5/4 C#5/4 | D5/12 E5/2 F#5/2 | F#5/8 r8' },
    },
    { prog: [0, 1, 2, 3], comp: [tokyoKeys], bass: 'R...............', lp: 1600 },
  ],
};

const tokyoNightKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.13, pat: 'X...............X.............P.' };
const yatai = 'r4 E5/8 D5/2 E5/2 | F5/12 E5/4 | D5/8 r4 A4/4 | B4/4 A4/4 G#4/8 | A4/6 C5/2 E5/8 | F5/8 D5/4 C5/4 | D5/10 E5/2 F5/4 | E5/16';
const yataiKoto = 'r2 A5/2 C6/4 A5/2 F5/2 E5/4 | D5/6 F5/2 A5/8 | E5/4 r2 E5/2 D5/2 C5/2 B4/4 | A4/8 r4 D5/2 E5/2 | F5/6 E5/2 C5/4 A4/4 | B4/4 D5/4 F5/4 E5/4 | E5/12 D5/2 C5/2 | A4/8 r8';
const miyako = [9, 10, 2, 4, 5];

const TOKYO_NIGHT: Tune = {
  title: 'Yatai',
  bpm: 72, swing: 0.6, tone: 5200, crackle: 0.8, echo: 0.3, loopFrom: 1,
  chords: [
    'A2 G3 B3 C4 E4', // Am9
    'F2 E3 G3 A3 C4', // Fmaj9
    'D2 F3 A3 C4 E4', // Dm9
    'E2 G#3 B3 D4 F4', // E7b9
    'Bb1 A3 C4 D4 F4', // Bbmaj9
  ],
  grooves: {
    night: { kick: '7.........5.....', rim: '....5.......5...', hat: '3.1.3.1.3.1.3.1.' },
    watch: { kick: '7.........5.....', rim: '....5.......5...', hat: '3.1.3.1.3.1.3.1.', clap: '............................5.4.' },
  },
  bass: 'R.........r...A.',
  sparkle: { voice: 'bell', notes: 'E6 A6 D7 E7', every: 4, chance: 0.3, vol: 0.05, count: [2, 3] },
  parts: [
    { prog: [0, 1, 2, 3], comp: [tokyoNightKeys], bass: false, lp: 900 },
    { prog: [0, 1, 2, 3, 0, 4, 2, 3], comp: [tokyoNightKeys], groove: 'night', lead: { voice: 'shaku', vol: 0.11, mel: yatai } },
    { prog: [1, 4, 0, 2, 1, 3, 0, 0], comp: [tokyoNightKeys], groove: 'night', lead: { voice: 'koto', vol: 0.28, mel: yataiKoto } },
    {
      prog: [0, 1, 2, 3, 0, 4, 2, 3], comp: [tokyoNightKeys], groove: 'watch', bass: 'R.......O.......',
      fills: { voice: 'koto', scale: miyako, lo: 64, hi: 81, density: 0.28, vol: 0.3, runs: 0.25 },
    },
    {
      prog: [0, 1, 2, 3, 0, 4, 2, 3], comp: [tokyoNightKeys], groove: 'night', lead: { voice: 'shaku', vol: 0.11, mel: yatai },
      fills: { voice: 'koto', scale: miyako, lo: 64, hi: 76, density: 0.07, vol: 0.22 },
    },
    { prog: [1, 4, 0, 2, 1, 3, 0, 0], comp: [tokyoNightKeys], groove: 'night', lead: { voice: 'koto', vol: 0.28, mel: yataiKoto } },
    { prog: [0, 1, 2, 3], comp: [tokyoNightKeys], bass: 'R...............', lp: 1300 },
  ],
};

// ---- Amalfi ----

const amalfiPick: Comp = { voice: 'nylon', style: 'pick', vol: 0.28, pat: 'T..2.3.1T..2.3.1' };
const amalfiKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.06, pat: 'X...............' };
const amalfiAcc: Comp = { voice: 'accordion', style: 'pad', vol: 0.045, pat: 'X...............' };
const limoncello = 'r4 G4/2 A4/2 B4/4 D5/4 | C5/6 B4/2 A4/4 E4/4 | F4/4 A4/4 C5/4 E5/4 | D5/8 r2 B4/2 C5/2 D5/2 | E5/6 D5/2 B4/4 G4/4 | C#5/4 E5/4 F5/4 E5/4 | D5/8 C5/4 A4/4 | G4/12 r4';
const limoncelloFlute = 'A5/8 G5/4 E5/4 | Ab5/8 G5/4 F5/4 | G5/6 E5/2 B4/8 | C#5/4 E5/4 G5/4 F5/4 | F5/8 E5/4 D5/4 | E5/4 D5/4 B4/4 G4/4 | C5/12 D5/2 E5/2 | D5/8 r8';

const AMALFI_DAY: Tune = {
  title: 'Limoncello',
  bpm: 82, swing: 0.57, tone: 7500, crackle: 0.45, echo: 0.2, loopFrom: 1,
  chords: [
    'C2 E3 G3 B3 D4', // Cmaj9
    'A2 G3 B3 C4 E4', // Am9
    'D2 F3 A3 C4 E4', // Dm9
    'G2 F3 A3 B3 E4', // G13
    'E2 G3 B3 D4 E4', // Em7
    'A2 G3 B3 C#4 F4', // A7b13
    'G2 F3 A3 C4 D4', // G7sus4
    'F2 E3 G3 A3 C4', // Fmaj9
    'F2 F3 Ab3 C4 D4', // Fm6
  ],
  grooves: {
    bossa: { kick: '8.....4.7.....4.', rim: '5..5..4...5..4..', snare: '....4.......4...', shaker: '3121312131213121' },
    light: { kick: '6.......5.......', rim: '4..4..4...4..4..', shaker: '2.1.2.1.2.1.2.1.' },
  },
  bass: 'R.....5.r.....A.',
  parts: [
    { prog: [0, 1, 2, 3], comp: [amalfiPick], bass: false, lp: 1300 },
    { prog: [0, 1, 2, 3, 4, 5, 2, 6], comp: [amalfiPick, amalfiKeys], groove: 'bossa', lead: { voice: 'nylon', vol: 0.32, mel: limoncello } },
    { prog: [7, 8, 4, 5, 2, 3, 0, 6], comp: [amalfiPick, amalfiKeys, amalfiAcc], groove: 'bossa', lead: { voice: 'flute', vol: 0.14, mel: limoncelloFlute } },
    {
      prog: [0, 1, 2, 3, 4, 5, 2, 6], comp: [amalfiPick, amalfiKeys], groove: 'light',
      fills: { voice: 'mando', scale: [0, 2, 4, 5, 7, 9, 11], lo: 72, hi: 88, density: 0.2, vol: 0.2 },
    },
    {
      prog: [0, 1, 2, 3, 4, 5, 2, 6], comp: [amalfiPick, amalfiKeys], groove: 'bossa', lead: { voice: 'nylon', vol: 0.32, mel: limoncello },
      fills: { voice: 'mando', scale: [0, 2, 4, 5, 7, 9, 11], lo: 76, hi: 88, density: 0.05, vol: 0.14 },
    },
    { prog: [7, 8, 4, 5, 2, 3, 0, 6], comp: [amalfiPick, amalfiKeys, amalfiAcc], groove: 'bossa', lead: { voice: 'flute', vol: 0.14, mel: limoncelloFlute } },
    { prog: [0, 1, 2, 3], comp: [amalfiPick], bass: 'R...............', lp: 1800 },
  ],
};

const amalfiNightPick: Comp = { voice: 'nylon', style: 'pick', vol: 0.26, pat: 'T...2.3.T...1.3.' };
const amalfiNightKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.08, pat: 'X...............X.............P.' };
const amalfiNightAcc: Comp = { voice: 'accordion', style: 'pad', vol: 0.04, pat: 'X...............' };
const molo = 'r4 E5/4 D5/2 C5/2 B4/4 | A4/8 C5/4 F5/4 | E5/6 D5/2 B4/8 | E5/12 r4 | A5/6 G5/2 E5/4 C5/4 | D5/6 F5/2 A5/8 | G#5/4 F5/4 E5/4 D5/4 | C5/4 B4/4 A4/8';
const moloFlute = 'C6/8 B5/4 A5/4 | F5/8 E5/4 D5/4 | B4/4 D5/4 E5/4 F5/4 | E5/16 | A5/4 G5/4 F5/4 E5/4 | D5/8 F5/4 A5/4 | G#5/8 B5/4 G#5/4 | A5/12 r4';
const moloProg = [0, 1, 2, 3, 4, 5, 6, 0];

const AMALFI_NIGHT: Tune = {
  title: 'Notte sul molo',
  bpm: 70, swing: 0.58, tone: 5400, crackle: 0.65, echo: 0.26, loopFrom: 1,
  chords: [
    'A2 G3 B3 C4 E4', // Am9
    'D2 F3 A3 C4 E4', // Dm9
    'G2 F3 A3 B3 E4', // G13
    'C2 E3 G3 B3 D4', // Cmaj9
    'F2 E3 G3 A3 C4', // Fmaj9
    'B1 F3 A3 B3 D4', // Bm7b5
    'E2 G#3 B3 D4 F4', // E7b9
  ],
  grooves: {
    notte: { kick: '6.......5.......', rim: '4..4..4...4..4..', brush: '....5.......5...', shaker: '2.1.2.1.2.1.2.1.' },
  },
  bass: 'R.......5.....A.',
  parts: [
    { prog: [0, 1, 2, 3], comp: [amalfiNightPick], bass: false, lp: 1000 },
    { prog: moloProg, comp: [amalfiNightPick, amalfiNightKeys], groove: 'notte', lead: { voice: 'nylon', vol: 0.3, mel: molo } },
    { prog: moloProg, comp: [amalfiNightPick, amalfiNightKeys, amalfiNightAcc], groove: 'notte', lead: { voice: 'flute', vol: 0.12, mel: moloFlute } },
    {
      prog: moloProg, comp: [amalfiNightPick, amalfiNightKeys], groove: 'notte', bass: 'R.......O.......',
      fills: { voice: 'nylon', scale: [9, 11, 0, 2, 4, 5, 7], lo: 69, hi: 84, density: 0.18, vol: 0.26 },
    },
    { prog: moloProg, comp: [amalfiNightPick, amalfiNightKeys], groove: 'notte', lead: { voice: 'nylon', vol: 0.3, mel: molo } },
    { prog: moloProg, comp: [amalfiNightPick, amalfiNightKeys, amalfiNightAcc], groove: 'notte', lead: { voice: 'flute', vol: 0.12, mel: moloFlute } },
    { prog: [0, 1, 2, 3], comp: [amalfiNightPick], bass: 'R...............', lp: 1400 },
  ],
};

// ---- Istanbul ----

const istanbulKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.13, pat: 'X.......x.......X.............P.' };
const galata = 'r2 D5/2 Eb5/2 F#5/2 G5/4 F#5/4 | G5/6 F#5/2 Eb5/8 | D5/6 r2 A4/2 C5/2 Bb4/2 A4/2 | Bb4/8 A4/4 G4/4 | r2 G5/2 Bb5/4 A5/2 G5/2 Eb5/4 | F#5/8 D5/4 Bb4/4 | Eb5/6 F#5/2 Eb5/4 D5/4 | D5/12 r4';
const galataNey = 'D6/8 C6/4 Bb5/4 | C6/6 Bb5/2 G5/8 | A5/8 F#5/4 G5/4 | Bb5/8 G5/4 Eb5/4 | D5/4 G5/4 A5/4 Bb5/4 | C6/12 Bb5/4 | G5/6 F#5/2 Eb5/8 | D5/16';
const hicaz = [2, 3, 6, 7, 9, 10, 0];

const ISTANBUL_DAY: Tune = {
  title: 'Galata',
  bpm: 86, swing: 0.56, tone: 7000, crackle: 0.5, echo: 0.22, loopFrom: 1,
  chords: [
    'D2 F#3 A3 C4 D4', // D7
    'Eb2 Eb3 G3 Bb3 D4', // Ebmaj7
    'G2 G3 A3 Bb3 D4', // Gm(add9)
    'C2 Eb3 G3 Bb3 D4', // Cm9
    'Bb1 F#3 A3 Bb3 D4', // Bbmaj7#5
  ],
  grooves: {
    galata: {
      kick: '8.......6.5.....', snare: '....7.......7...', hat: '4.2.4.2.4.2.4.2.',
      doum: '7.......6.......', tek: '..5...5.....5...', ka: '........3......3',
    },
    tarab: { kick: '6...............', doum: '7.....5.6.......', tek: '..4...4...4...4.', ka: '.2.2.2.2.2.2.2.2' },
  },
  bass: 'R.......5.....A.',
  sparkle: { voice: 'zil', notes: 'E7', every: 8, chance: 0.4, vol: 0.03, count: [1, 1] },
  parts: [
    { prog: [0, 1, 0, 2], comp: [istanbulKeys], bass: false, lp: 1100 },
    { prog: [0, 1, 0, 2, 3, 4, 1, 0], comp: [istanbulKeys], groove: 'galata', lead: { voice: 'oud', vol: 0.32, up: -1, mel: galata } },
    { prog: [2, 3, 4, 1, 2, 3, 1, 0], comp: [istanbulKeys], groove: 'galata', lead: { voice: 'ney', vol: 0.14, up: -1, mel: galataNey } },
    {
      prog: [0, 1, 0, 2, 3, 4, 1, 0], comp: [istanbulKeys], groove: 'tarab',
      fills: { voice: 'qanun', scale: hicaz, lo: 62, hi: 81, density: 0.2, vol: 0.2, runs: 0.35 },
    },
    {
      prog: [0, 1, 0, 2, 3, 4, 1, 0], comp: [istanbulKeys], groove: 'galata', lead: { voice: 'oud', vol: 0.32, up: -1, mel: galata },
      fills: { voice: 'saz', scale: hicaz, lo: 69, hi: 81, density: 0.06, vol: 0.14 },
    },
    { prog: [2, 3, 4, 1, 2, 3, 1, 0], comp: [istanbulKeys], groove: 'galata', lead: { voice: 'ney', vol: 0.14, up: -1, mel: galataNey } },
    { prog: [0, 1, 0, 2], comp: [istanbulKeys], bass: 'R...............', lp: 1500 },
  ],
};

const istanbulNightKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.12, pat: 'X...............X.............P.' };
const vapur = 'r4 E5/4 D5/2 C5/2 Bk4/2 C5/2 | D5/8 r2 A4/2 C5/2 D5/2 | F5/6 E5/2 D5/4 C5/4 | C5/4 Bk4/4 A4/8 | A5/6 G5/2 F5/4 E5/4 | F5/4 E5/2 D5/2 C5/8 | D5/4 C5/4 Bk4/4 C5/4 | A4/12 r4';
const vapurNey = 'C6/8 A5/8 | D6/6 C6/2 G5/8 | E5/12 r4 | r4 G5/4 A5/4 C6/4 | D6/8 C6/4 A5/4 | G5/8 F5/4 D5/4 | E5/6 F5/2 E5/4 D5/4 | E5/16';
const vapurA = [0, 1, 2, 3, 4, 1, 5, 0], vapurB = [4, 2, 0, 0, 1, 2, 4, 5];

const ISTANBUL_NIGHT: Tune = {
  title: 'Vapur',
  bpm: 74, swing: 0.58, tone: 5200, crackle: 0.75, echo: 0.3, loopFrom: 1,
  chords: [
    'A2 G3 A3 C4 E4', // Am7
    'D2 F3 A3 C4 D4', // Dm7
    'G2 F3 G3 C4 D4', // G7sus4
    'C2 E3 G3 A3 C4', // C6
    'F2 F3 A3 C4 E4', // Fmaj7
    'E2 D3 A3 D4 E4', // E7sus4
  ],
  grooves: {
    gece: { kick: '6.........4.....', doum: '6.......5.......', tek: '....4.......4..3', ka: '..2.......2.....', shaker: '2.1.2.1.2.1.2.1.' },
  },
  bass: 'R.........r...A.',
  parts: [
    { prog: [0, 1, 2, 3], comp: [istanbulNightKeys], bass: false, lp: 900 },
    { prog: vapurA, comp: [istanbulNightKeys], groove: 'gece', lead: { voice: 'oud', vol: 0.3, up: -1, mel: vapur } },
    { prog: vapurB, comp: [istanbulNightKeys], groove: 'gece', lead: { voice: 'ney', vol: 0.14, up: -1, mel: vapurNey } },
    {
      prog: vapurA, comp: [istanbulNightKeys], groove: 'gece', bass: 'R.......O.......',
      fills: { voice: 'qanun', scale: [9, 0, 2, 4, 5, 7], lo: 64, hi: 81, density: 0.22, vol: 0.2, runs: 0.3 },
    },
    { prog: vapurA, comp: [istanbulNightKeys], groove: 'gece', lead: { voice: 'oud', vol: 0.3, up: -1, mel: vapur } },
    { prog: vapurB, comp: [istanbulNightKeys], groove: 'gece', lead: { voice: 'ney', vol: 0.14, up: -1, mel: vapurNey } },
    { prog: [0, 1, 2, 3], comp: [istanbulNightKeys], bass: 'R...............', lp: 1300 },
  ],
};

// ---- Funchal ----

const funchalPick: Comp = { voice: 'viola', style: 'pick', vol: 0.32, pat: 'T..1..2.T..3..2.' };
const funchalBraguinha: Comp = { voice: 'braguinha', style: 'strum', vol: 0.05, up: 1, pat: '..D...Du..D...Du' };
const funchalKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.06, pat: 'X...............' };
const funchal = 'r2 E5/2 A5/4 G#5/2 F#5/2 E5/4 | C#5/6 B4/2 A4/4 C#5/4 | D5/8 C#5/4 B4/4 | G#4/4 B4/4 E5/4 F#5/4 | G#5/6 F#5/2 E5/8 | A5/4 G#5/4 F#5/4 E5/4 | F#5/6 E5/2 D5/4 C#5/4 | B4/12 r4';
const funchalB = 'A5/8 F#5/4 A5/4 | B5/6 G#5/2 E5/8 | E5/4 G#5/4 B5/4 C#6/4 | A5/12 G#5/4 | F#5/8 D5/4 C#5/4 | B4/4 C#5/4 D5/4 E5/4 | C#5/12 B4/2 C#5/2 | E5/8 r8';
const funchalA = [0, 1, 2, 3, 4, 1, 5, 6], funchalBProg = [5, 3, 4, 1, 2, 3, 0, 6];

const MADEIRA_DAY: Tune = {
  title: 'Funchal',
  bpm: 80, swing: 0.57, tone: 7200, crackle: 0.45, echo: 0.2, loopFrom: 1,
  chords: [
    'A2 G#3 B3 C#4 E4', // Amaj9
    'F#2 A3 C#4 E4 G#4', // F#m9
    'B1 A3 C#4 D4 F#4', // Bm9
    'E2 G#3 C#4 D4 F#4', // E13
    'C#2 E3 G#3 B3 E4', // C#m7
    'D2 F#3 A3 C#4 E4', // Dmaj9
    'E2 A3 B3 D4 F#4', // E9sus4
  ],
  grooves: {
    funchal: { kick: '8......5..6.....', snare: '....6.......6...', hat: '3.2.4.2.3.2.4.2.' },
    brisa: { kick: '6.........5.....', rim: '....4.......4...', shaker: '2.1.2.1.2.1.2.1.' },
  },
  bass: 'R.....5...r...A.',
  parts: [
    { prog: [0, 1, 2, 3], comp: [funchalPick], bass: false, lp: 1300 },
    { prog: funchalA, comp: [funchalPick, funchalKeys], groove: 'funchal', lead: { voice: 'guitarra', vol: 0.42, mel: funchal } },
    { prog: funchalBProg, comp: [funchalPick, funchalKeys, funchalBraguinha], groove: 'funchal', lead: { voice: 'guitarra', vol: 0.42, mel: funchalB } },
    {
      prog: funchalA, comp: [funchalPick, funchalKeys, funchalBraguinha], groove: 'brisa',
      fills: { voice: 'guitarra', scale: [9, 11, 1, 2, 4, 6, 8], lo: 69, hi: 86, density: 0.2, vol: 0.26 },
    },
    { prog: funchalA, comp: [funchalPick, funchalKeys], groove: 'funchal', lead: { voice: 'guitarra', vol: 0.42, mel: funchal } },
    { prog: funchalBProg, comp: [funchalPick, funchalKeys, funchalBraguinha], groove: 'funchal', lead: { voice: 'guitarra', vol: 0.42, mel: funchalB } },
    { prog: [0, 1, 2, 3], comp: [funchalPick], bass: 'R...............', lp: 1800 },
  ],
};

const fadoPick: Comp = { voice: 'viola', style: 'pick', vol: 0.3, pat: 'T...1.2.T...3.2.' };
const fadoKeys: Comp = { voice: 'rhodes', style: 'keys', vol: 0.09, pat: 'X...............X.............P.' };
const fado = 'r4 F#5/4 E5/2 D5/2 C#5/4 | A#4/6 C#5/2 E5/8 | D5/6 C#5/2 B4/8 | r2 G5/2 F#5/2 E5/2 B5/8 | A5/4 G5/4 E5/4 C#5/4 | F#5/12 r4 | E5/4 D5/4 C#5/4 A#4/4 | B4/12 r4';
const fadoViola = 'B4/6 D5/2 F#5/8 | E5/6 C#5/2 A4/8 | F#5/8 E5/4 D5/4 | B4/16 | G5/6 F#5/2 E5/4 D5/4 | C#5/6 E5/2 G5/8 | F#5/8 D5/4 C#5/4 | B4/8 r8';
const fadoA = [0, 1, 0, 2, 3, 4, 1, 0], fadoB = [5, 3, 4, 0, 2, 1, 0, 0];

const MADEIRA_NIGHT: Tune = {
  title: 'Fado da noite',
  bpm: 68, swing: 0.57, tone: 5000, crackle: 0.7, echo: 0.28, loopFrom: 1,
  chords: [
    'B1 A3 C#4 D4 F#4', // Bm9
    'F#2 E3 A#3 C#4 G4', // F#7b9
    'E2 G3 B3 D4 F#4', // Em9
    'A2 G3 B3 C#4 F#4', // A13
    'D2 F#3 A3 C#4 E4', // Dmaj9
    'G2 F#3 A3 B3 D4', // Gmaj9
  ],
  grooves: {
    fado: { kick: '6.......4.......', rim: '....4.......4...', shaker: '2.1.2.1.2.1.2.1.' },
  },
  bass: 'R.......5.....A.',
  parts: [
    { prog: [0, 1, 0, 2], comp: [fadoPick], bass: false, lp: 1000 },
    { prog: fadoA, comp: [fadoPick, fadoKeys], groove: 'fado', lead: { voice: 'guitarra', vol: 0.42, mel: fado } },
    { prog: fadoB, comp: [fadoPick, fadoKeys], groove: 'fado', lead: { voice: 'viola', vol: 0.45, mel: fadoViola } },
    {
      prog: fadoA, comp: [fadoPick, fadoKeys], groove: 'fado', bass: 'R.......O.......',
      fills: { voice: 'guitarra', scale: [11, 1, 2, 4, 6, 7, 10], lo: 66, hi: 83, density: 0.18, vol: 0.24 },
    },
    { prog: fadoA, comp: [fadoPick, fadoKeys], groove: 'fado', lead: { voice: 'guitarra', vol: 0.42, mel: fado } },
    { prog: fadoB, comp: [fadoPick, fadoKeys], groove: 'fado', lead: { voice: 'viola', vol: 0.45, mel: fadoViola } },
    { prog: [0, 1, 0, 2], comp: [fadoPick], bass: 'R...............', lp: 1400 },
  ],
};

export const LOFI: Record<CityId, { day: Tune; night: Tune }> = {
  tokyo: { day: TOKYO_DAY, night: TOKYO_NIGHT },
  amalfi: { day: AMALFI_DAY, night: AMALFI_NIGHT },
  istanbul: { day: ISTANBUL_DAY, night: ISTANBUL_NIGHT },
  madeira: { day: MADEIRA_DAY, night: MADEIRA_NIGHT },
};
