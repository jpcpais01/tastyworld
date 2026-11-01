/**
 * The lo-fi band's instruments, each synthesised once per pitch (every third semitone, the rest is playback rate)
 * into a small mono buffer. Plucked strings are one Karplus-Strong model with a fractional delay, set up per
 * instrument: where it is plucked, how bright the pick is, how long it rings, a second string in the same course,
 * the body's resonances and the buzz of a sawari bridge. Winds are a tone with breath noise around it; drums are
 * rendered at a low rate and to 12 bits, the way an old sampler would have kept them.
 */

import { Pcm, SVF, TAU, finish, mtof, noise, pcm, rand } from '../synth';

export type Voice =
  | 'rhodes' | 'bass' | 'bell' | 'zil'
  | 'koto' | 'shamisen' | 'shaku'
  | 'nylon' | 'mando' | 'flute' | 'accordion'
  | 'oud' | 'saz' | 'qanun' | 'ney'
  | 'guitarra' | 'viola' | 'braguinha';

export type Drum = 'kick' | 'snare' | 'rim' | 'hat' | 'ohat' | 'shaker' | 'brush' | 'doum' | 'tek' | 'ka' | 'clap';
export const DRUMS: readonly Drum[] = ['kick', 'snare', 'rim', 'hat', 'ohat', 'shaker', 'brush', 'doum', 'tek', 'ka', 'clap'];

const LSR = 22050; // mellow voices, drums (Safari needs >= 22050)
const PSR = 24000; // plucked strings and bells: brighter than the rest, still small

interface Pluck {
  /** 0..1: how bright the pick or finger is (a low-passed noise burst excites the string). */
  bright: number;
  /** Where along the string it is plucked, from the bridge (0.5 is the middle): near the bridge is thin and nasal. */
  pos: number;
  /** Seconds a low note rings before it has died away; high notes ring shorter. */
  ring: number;
  /** 0..1: how fast the string loses its top (rounder, darker as it rings). */
  damp: number;
  dur: number;
  /** Cents a second string in the same course is tuned off (the shimmer of a double course). */
  twin?: number;
  /** Level of an octave string in the course (the bağlama's lower courses). */
  octave?: number;
  /** The body: [Hz, q, level] resonances added to the string. */
  body?: [number, number, number][];
  /** 0..1: buzz of a sawari bridge (the string rattling against it while it is loud). */
  buzz?: number;
  /** [level, Hz, decay]: the plectrum, nail or skin heard at the start. */
  click?: [number, number, number];
}

const PLUCKS: Partial<Record<Voice, Pluck>> = {
  // silk-ish strings plucked with ivory nails, a long paulownia body
  koto: { bright: 0.55, pos: 0.2, ring: 4, damp: 0.55, dur: 3, body: [[220, 1.6, 0.5], [520, 2, 0.25]], click: [0.22, 2600, 140] },
  // a big bachi slapping the skin as it plucks, the first string buzzing on its sawari
  shamisen: { bright: 0.9, pos: 0.1, ring: 1.6, damp: 0.3, dur: 1.6, buzz: 0.45, body: [[380, 3, 0.6]], click: [0.8, 950, 70] },
  nylon: { bright: 0.3, pos: 0.22, ring: 4, damp: 0.7, dur: 3, body: [[105, 2, 0.6], [210, 2, 0.35]], click: [0.05, 1800, 200] },
  mando: { bright: 0.85, pos: 0.12, ring: 2, damp: 0.25, dur: 1.8, twin: 3, body: [[330, 2, 0.4]], click: [0.18, 3500, 200] },
  // fretless, a deep bowl, gut-and-wound double courses struck with a risha
  oud: { bright: 0.6, pos: 0.18, ring: 3, damp: 0.5, dur: 2.6, twin: 4, body: [[115, 2.5, 0.8], [270, 2, 0.4]], click: [0.28, 1500, 150] },
  // the long-necked bağlama: thin steel, octave courses, a buzzy tone
  saz: { bright: 0.85, pos: 0.1, ring: 3, damp: 0.25, dur: 2.4, twin: 5, octave: 0.3, buzz: 0.22, body: [[300, 2, 0.3]], click: [0.22, 3000, 180] },
  qanun: { bright: 0.8, pos: 0.15, ring: 3.5, damp: 0.3, dur: 2.6, twin: 4, body: [[250, 2, 0.3]], click: [0.2, 3000, 200] },
  // the guitarra portuguesa: steel double courses picked near the bridge, ringing and bright
  guitarra: { bright: 0.9, pos: 0.1, ring: 3.8, damp: 0.2, dur: 3, twin: 5, body: [[180, 2, 0.5], [420, 2.5, 0.3]], click: [0.22, 4000, 200] },
  // the viola de fado that accompanies it: steel too, but warm and fingered
  viola: { bright: 0.55, pos: 0.2, ring: 4, damp: 0.45, dur: 3, body: [[100, 2, 0.6], [220, 2, 0.35]], click: [0.06, 2000, 200] },
  // Madeira's own little four-string braguinha, strummed
  braguinha: { bright: 0.8, pos: 0.15, ring: 1.2, damp: 0.35, dur: 1.2, body: [[420, 2, 0.4]], click: [0.12, 3200, 220] },
};

/**
 * One string of a course, added into y: a delay line with a one-zero loss filter and a first-order allpass for the
 * fractional part of the delay (so it tunes exactly without the treble loss of interpolating).
 */
function string(y: Float32Array, f: number, sr: number, p: Pluck, amp: number): void {
  const n = y.length;
  const h = (p.damp / 2) * Math.min(1, 400 / f); // high notes lose their top over fewer trips, so damp them less per trip
  const D = sr / f - h; // the loss filter adds h samples of delay
  const N = Math.floor(D - 0.5), frac = D - N; // integer delay + an allpass of 0.5..1.5 samples
  const C = (1 - frac) / (1 + frac);
  const L = N + 1;
  const ring = Math.max(0.35, p.ring * (1 - Math.min(0.7, f / 2500)));
  // loss per trip so the fundamental has fallen 60 dB after `ring` seconds; the damping filter already takes a little
  // of it each trip, so that is given back (never past 1, or the lowest frequencies would grow)
  const lost = Math.sqrt(1 - 2 * h * (1 - h) * (1 - Math.cos(TAU * f / sr)));
  const g = Math.min(0.9995, 10 ** (-3 / (ring * f)) / lost);
  // excitation: a low-passed burst, combed at the pick position, mean removed
  const e = new Float32Array(L);
  let lp = 0, mean = 0;
  for (let i = 0; i < L; i++) { lp += p.bright * (noise() - lp); e[i] = lp; }
  const P = Math.max(1, Math.round(p.pos * D));
  for (let i = L - 1; i >= P; i--) e[i] -= e[i - P];
  for (let i = 0; i < L; i++) mean += e[i] / L;
  const w = new Float32Array(n);
  const th = p.buzz ? 0.55 - 0.35 * p.buzz : 9;
  let lin = 0, apOut = 0;
  for (let i = 0; i < n; i++) {
    const x0 = i >= N ? w[i - N] : 0, x1 = i > N ? w[i - N - 1] : 0;
    const l = (1 - h) * x0 + h * x1;
    apOut = C * l + lin - C * apOut;
    lin = l;
    let v = g * apOut;
    if (v > th) v = th + (v - th) * 0.3; // the string slapping the sawari
    w[i] = (i < L ? e[i] - mean : 0) + v;
  }
  for (let i = 0; i < n; i++) y[i] += w[i] * amp;
}

function renderPluck(p: Pluck, m: number): Pcm {
  const f = mtof(m), sr = PSR, n = Math.ceil(p.dur * sr);
  const y = new Float32Array(n);
  string(y, f, sr, p, 1);
  if (p.twin) string(y, f * 2 ** (p.twin / 1200), sr, p, 0.85);
  if (p.octave) string(y, f * 2, sr, p, p.octave);
  const body = (p.body ?? []).map(([hz, q, lv]) => ({ f: new SVF(sr, 1 / q), hz, lv }));
  const ck = p.click ? new SVF(sr, 0.7) : null;
  let dc = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    let x = y[i];
    for (const b of body) x += b.f.run(y[i], b.hz) * b.lv;
    if (ck && p.click) x += ck.run(noise(), p.click[1]) * p.click[0] * Math.exp(-(i / sr) * p.click[2]) * 1.5;
    dc = x - prev + 0.996 * dc; prev = x; // remove DC
    y[i] = dc;
  }
  return finish(y, sr, 0.08);
}

/** A Rhodes-like electric piano: two-operator FM with a soft tine, a fast first decay and a long warm tail. */
function rhodes(m: number): Pcm {
  const f = mtof(m), k = 1 + f / 1100;
  return pcm(3.4, LSR, () => (t) => {
    const env = Math.min(1, t / 0.003) * (0.6 * Math.exp(-t * 2.8 * k) + 0.4 * Math.exp(-t * 0.6 * k));
    const idx = 0.95 * Math.exp(-t * 5) + 0.16;
    const a = Math.sin(TAU * f * t + idx * Math.sin(TAU * f * t));
    const b = Math.sin(TAU * f * 1.0018 * t + idx * 0.7 * Math.sin(TAU * f * 1.0018 * t));
    const tine = f * 7 < LSR / 2 ? 0.1 * Math.sin(TAU * f * 7 * t) * Math.exp(-t * 30) : 0;
    const bark = 0.12 * Math.sin(TAU * f * 2 * t) * Math.exp(-t * 9);
    return (a * 0.6 + b * 0.4 + tine + bark) * env;
  });
}

/** A round upright bass: the finger lands a touch sharp and settles, a soft thump under the note. */
function bass(m: number): Pcm {
  const f = mtof(m);
  return pcm(2.4, LSR, () => {
    let ph = 0, lp = 0;
    return (t) => {
      ph += TAU * f * (1 + 0.006 * Math.exp(-t * 25)) / LSR;
      lp += 0.08 * (noise() - lp);
      const env = Math.min(1, t / 0.006) * Math.exp(-t * 2) * (0.7 + 0.3 * Math.exp(-t * 8));
      const tone = Math.sin(ph) + 0.45 * Math.sin(2 * ph) * Math.exp(-t * 1.5) + 0.15 * Math.sin(3 * ph) * Math.exp(-t * 4) + 0.05 * Math.sin(4 * ph) * Math.exp(-t * 6);
      return tone * env + (lp * 1.5 + 0.2 * Math.sin(TAU * 70 * t)) * Math.exp(-t * 40);
    };
  });
}

interface Wind {
  /** harmonic levels from the fundamental up */
  harm: number[];
  /** breath around the note, and the higher hiss of air across the edge */
  breath: number;
  air: number;
  attack: number;
  vibRate: number;
  vibDepth: number;
  /** seconds before the vibrato starts to open */
  vibDelay: number;
  dur: number;
  /** the note swells after its attack (a shakuhachi player's push) */
  swell: number;
}

const WINDS: Partial<Record<Voice, Wind>> = {
  shaku: { harm: [1, 0.28, 0.12, 0.04], breath: 0.9, air: 0.12, attack: 0.12, vibRate: 5.2, vibDepth: 0.009, vibDelay: 0.5, dur: 4, swell: 0.25 },
  ney: { harm: [1, 0.12, 0.05], breath: 1.25, air: 0.22, attack: 0.18, vibRate: 4.6, vibDepth: 0.005, vibDelay: 0.8, dur: 4.5, swell: 0.15 },
  flute: { harm: [1, 0.18, 0.05], breath: 0.45, air: 0.06, attack: 0.07, vibRate: 4.8, vibDepth: 0.0035, vibDelay: 0.35, dur: 3.4, swell: 0 },
};

function wind(w: Wind, m: number): Pcm {
  const f = mtof(m);
  return pcm(w.dur, LSR, () => {
    const bp = new SVF(LSR, 0.3), edge = new SVF(LSR, 0.7);
    let ph = 0;
    return (t) => {
      const open = Math.min(1, Math.max(0, t - w.vibDelay) / 0.8);
      ph += (TAU * f * (1 + w.vibDepth * open * open * Math.sin(TAU * w.vibRate * t))) / LSR;
      let tone = 0;
      w.harm.forEach((a, i) => { if (f * (i + 1) < LSR / 2) tone += a * Math.sin((i + 1) * ph); });
      const env = Math.min(1, t / w.attack) ** 2 * (1 - w.swell + w.swell * Math.sin(Math.PI * Math.min(1, t / 2.6))) * Math.exp(-t * 0.2);
      const breath = bp.run(noise(), f) * w.breath * (0.4 + 0.9 * Math.exp(-t * 8));
      const air = edge.run(noise(), 4200) * w.air;
      return (tone * 0.8 + breath + air) * env;
    };
  });
}

/** An accordion's musette: two reeds a few cents apart beating gently, bellows swelling the note in. */
function accordion(m: number): Pcm {
  const f = mtof(m);
  // one cycle of the reed's tone (harmonics falling off gently, none past Nyquist) read at two slightly different speeds
  const T = 2048, top = Math.min(12, Math.floor(LSR / 2 / (f * 1.01))), cyc = new Float32Array(T + 1);
  for (let j = 0; j <= T; j++) for (let i = 1; i <= top; i++) cyc[j] += Math.sin((TAU * i * j) / T) / i ** 1.25;
  const read = (ph: number) => { const x = ph * T, j = Math.floor(x); return cyc[j] + (cyc[j + 1] - cyc[j]) * (x - j); };
  return pcm(4, LSR, () => {
    const lp = new SVF(LSR, 0.6);
    let a = 0, b = 0;
    return (t) => {
      a = (a + f * 0.9965 / LSR) % 1; b = (b + f * 1.0035 / LSR) % 1;
      lp.run(read(a) + read(b), 2200);
      const env = Math.min(1, t / 0.09) * (0.92 + 0.08 * Math.sin(TAU * 0.7 * t)) * Math.exp(-t * 0.1);
      return lp.low * env;
    };
  });
}

/** Small glassy bell (a furin) and the zil, a pair of finger cymbals. */
function bell(m: number, zil: boolean): Pcm {
  const f = mtof(m);
  const parts = (zil ? [[1, 1, 2], [1.58, 0.6, 3], [2.33, 0.35, 4.5], [3.1, 0.2, 6]] : [[1, 1, 2.2], [2.76, 0.42, 4.5], [5.4, 0.22, 8], [8.93, 0.1, 12]])
    .filter((p) => p[0] * f < PSR * 0.47);
  return pcm(zil ? 2.2 : 2.4, PSR, () => (t) => {
    let s = 0;
    for (const [r, a, d] of parts) s += a * Math.sin(TAU * f * r * t + (zil ? 0.3 * Math.sin(TAU * 5.5 * t) : 0)) * Math.exp(-t * d);
    return s * Math.min(1, t / 0.002);
  });
}

export function renderVoice(v: Voice, m: number): Pcm {
  const p = PLUCKS[v];
  if (p) return renderPluck(p, m);
  const w = WINDS[v];
  if (w) return wind(w, m);
  switch (v) {
    case 'rhodes': return rhodes(m);
    case 'bass': return bass(m);
    case 'accordion': return accordion(m);
    case 'zil': return bell(m, true);
    default: return bell(m, false);
  }
}

/** Render, normalise and keep 12 bits, like a sample on an old drum machine. */
function crushed(dur: number, gen: () => (t: number) => number): Pcm {
  const n = Math.ceil(dur * LSR), f = gen(), y = new Float32Array(n);
  let peak = 1e-6;
  for (let i = 0; i < n; i++) { y[i] = f(i / LSR); peak = Math.max(peak, Math.abs(y[i])); }
  for (let i = 0; i < n; i++) y[i] = Math.round((y[i] / peak) * 2047) / 2047;
  return finish(y, LSR, 0.01);
}

const sat = (x: number, k: number) => Math.tanh(k * x) / Math.tanh(k);

export function renderDrum(d: Drum): Pcm {
  switch (d) {
    // a round, dusty kick: a sine that falls from a soft knock to a low thump, gently saturated
    case 'kick': return crushed(0.5, () => { let ph = 0; const lp = new SVF(LSR, 0.7); return (t) => {
      ph += TAU * (48 + 92 * Math.exp(-t * 32)) / LSR;
      lp.run(noise(), 1800);
      return sat(Math.sin(ph) * Math.exp(-t * 7) * Math.min(1, t / 0.002) + lp.low * 0.5 * Math.exp(-t * 180), 1.8);
    }; });
    // a fat, soft snare: a short drum tone and the wires, with a little room behind
    case 'snare': return crushed(0.42, () => { const bp = new SVF(LSR, 0.6), lp = new SVF(LSR, 0.5); return (t) => {
      const body = Math.sin(TAU * 185 * t) * Math.exp(-t * 22) * 0.6 + Math.sin(TAU * 330 * t) * Math.exp(-t * 30) * 0.25;
      lp.run(noise(), 5200);
      const wires = bp.run(lp.low, 2100) * (Math.exp(-t * 15) + 0.12 * Math.exp(-t * 5));
      return sat((body + wires * 1.6) * Math.min(1, t / 0.0015), 1.5);
    }; });
    // a cross-stick: the rim knocked with the stick lying on the skin
    case 'rim': return crushed(0.14, () => { const bp = new SVF(LSR, 0.25); return (t) =>
      (Math.sin(TAU * 520 * t) * Math.exp(-t * 55) + bp.run(noise(), 1700) * 1.4 * Math.exp(-t * 90)) * Math.min(1, t / 0.0008);
    });
    case 'hat': return crushed(0.09, () => { const lp = new SVF(LSR, 0.5); return (t) => {
      lp.run(noise(), 6500);
      return lp.high * Math.exp(-t * 48) * Math.min(1, t / 0.001);
    }; });
    case 'ohat': return crushed(0.45, () => { const lp = new SVF(LSR, 0.5); return (t) => {
      lp.run(noise(), 6000);
      return lp.high * Math.exp(-t * 7) * Math.min(1, t / 0.002);
    }; });
    case 'shaker': return crushed(0.1, () => { let lp = 0; return (t) => {
      const x = noise(); lp += 0.35 * (x - lp);
      return (x - lp) * Math.min(1, t / 0.012) * Math.exp(-t * 50);
    }; });
    case 'brush': return crushed(0.32, () => { const bp = new SVF(LSR, 0.9); return (t) =>
      bp.run(noise(), 3200) * Math.min(1, t / 0.008) * Math.exp(-t * 12) + 0.2 * Math.sin(TAU * 185 * t) * Math.exp(-t * 35);
    });
    // the darbuka: the deep "düm" from the middle of the skin, the sharp "tek" at the rim, the light "ka" of the other hand
    case 'doum': return crushed(0.6, () => { let ph = 0; const lp = new SVF(LSR, 0.7); return (t) => {
      ph += TAU * (88 + 26 * Math.exp(-t * 20)) / LSR;
      lp.run(noise(), 420);
      return Math.sin(ph) * Math.exp(-t * 6.5) + lp.low * 1.2 * Math.exp(-t * 30);
    }; });
    case 'tek': return crushed(0.16, () => { const bp = new SVF(LSR, 0.35); return (t) =>
      (bp.run(noise(), 2800) * 1.3 * Math.exp(-t * 55) + Math.sin(TAU * 680 * t) * 0.4 * Math.exp(-t * 40)) * Math.min(1, t / 0.0006);
    });
    case 'ka': return crushed(0.1, () => { const bp = new SVF(LSR, 0.4); return (t) =>
      bp.run(noise(), 1800) * Math.exp(-t * 70) * Math.min(1, t / 0.001);
    });
    // hyōshigi: two hardwood clappers, the night watchman's clack
    case 'clap': return crushed(0.4, () => (t) =>
      (Math.sin(TAU * 1650 * t) + 0.6 * Math.sin(TAU * 2430 * t) + 0.3 * Math.sin(TAU * 960 * t)) * Math.exp(-t * 22) * Math.min(1, t / 0.0005)
      + noise() * Math.exp(-t * 400) * 0.6);
  }
}

/**
 * The record itself: a soft hiss, a steady fine crackle, the odd louder pop and a faint thump each time the
 * dust passes under the needle (33 rpm). Loops seamlessly.
 */
export function renderVinyl(): Pcm {
  return pcm(1.8 * 4, LSR, () => {
    const hiss = new SVF(LSR, 0.35), ring = new SVF(LSR, 1.5);
    let c = 0, hp = 0;
    return (t) => {
      let imp = 0;
      if (Math.random() < 22 / LSR) imp = (Math.random() < 0.5 ? -1 : 1) * (0.05 + 0.4 * Math.random() ** 3);
      if (Math.random() < 0.5 / LSR) imp = (Math.random() < 0.5 ? -1 : 1) * rand(0.6, 1);
      c = c * 0.55 + imp;
      const click = ring.run(c, 2400) * 0.6 + c;
      hp += 0.15 * (click - hp);
      const turn = Math.exp(-(((t % 1.8) - 0.9) ** 2) * 400) * Math.sin(TAU * 30 * t) * 0.05;
      return (click - hp) + hiss.run(noise(), 5200) * 0.035 + turn;
    };
  }, true);
}

/** The sound behind a key: "vinyl", a drum's name, or "voice:midi". */
export function renderSound(key: string): Pcm {
  if (key === 'vinyl') return renderVinyl();
  const i = key.indexOf(':');
  return i < 0 ? renderDrum(key as Drum) : renderVoice(key.slice(0, i) as Voice, Number(key.slice(i + 1)));
}
