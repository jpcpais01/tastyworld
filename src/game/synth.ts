/**
 * Small DSP kit shared by the sound effects (audio.ts) and the music (music/): pitch helpers, a state-variable filter,
 * and renderers that turn a per-sample generator into an AudioBuffer once, so playback only costs a buffer source.
 */

export const TAU = Math.PI * 2;
export const mtof = (m: number) => 440 * 2 ** ((m - 69) / 12);
export const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
export const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
export const noise = () => Math.random() * 2 - 1;

/** Chamberlin state-variable filter, used inside renders. `run` returns the band-pass; `low` holds the low-pass. */
export class SVF {
  low = 0; band = 0; high = 0;
  constructor(private sr: number, private q = 0.5) {}
  run(x: number, fc: number): number {
    const f = 2 * Math.sin(Math.PI * Math.min(fc, this.sr / 6) / this.sr);
    this.low += f * this.band;
    this.high = x - this.low - this.q * this.band;
    this.band += f * this.high;
    return this.band;
  }
}

/** Mono samples at a rate: what a render makes, ready to become an AudioBuffer (or cross from a worker). */
export interface Pcm { data: Float32Array; sr: number }

/** Peak-normalise `y` in place and fade out its last `fadeSec`, so a cut-off tail never clicks. */
export function finish(y: Float32Array, sr: number, fadeSec = 0.02): Pcm {
  const n = y.length;
  let peak = 1e-6;
  for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(y[i]));
  const fade = Math.min(n, Math.floor(sr * fadeSec));
  for (let i = 0; i < n; i++) y[i] = (y[i] / peak) * (i >= n - fade ? (n - 1 - i) / fade : 1);
  return { data: y, sr };
}

/**
 * Render mono samples from a per-sample generator (the factory gets fresh filter state). A seamless render makes a
 * little extra and crossfades it into the start, so it loops without a seam.
 */
export function pcm(dur: number, sr: number, gen: () => (t: number) => number, seamless = false): Pcm {
  const n = Math.ceil(dur * sr);
  const xf = seamless ? Math.floor(sr * 0.25) : 0;
  const f = gen();
  const y = new Float32Array(n + xf);
  for (let i = 0; i < n + xf; i++) y[i] = f(i / sr);
  for (let i = 0; i < xf; i++) { const u = i / xf; y[i] = y[i] * Math.sqrt(u) + y[n + i] * Math.sqrt(1 - u); }
  return finish(xf ? y.slice(0, n) : y, sr, seamless ? 0 : 0.02);
}

export function toAudio(ctx: BaseAudioContext, p: Pcm): AudioBuffer {
  const b = ctx.createBuffer(1, p.data.length, p.sr);
  b.getChannelData(0).set(p.data);
  return b;
}

export const render = (ctx: BaseAudioContext, dur: number, sr: number, gen: () => (t: number) => number, seamless = false): AudioBuffer =>
  toAudio(ctx, pcm(dur, sr, gen, seamless));

/** A reverb's impulse: `dur` seconds of stereo decaying noise that darkens as it dies (`decay`: lower rings longer). */
export function impulse(ctx: BaseAudioContext, dur: number, decay = 3.2): AudioBuffer {
  const sr = ctx.sampleRate, n = Math.floor(dur * sr);
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
