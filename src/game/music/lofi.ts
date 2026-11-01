/**
 * The lo-fi player. Every city has a day tune and a night tune (music/tunes.ts) played by a small band through an
 * old tape and record chain: the band is ducked a little under each kick, gently saturated, its top end rolled off
 * and its pitch wobbled by a slowly swaying tape delay, with the record's crackle and hiss under everything. Leads
 * get a soft tape echo. The night tune takes over (and the day tune back) at the next part boundary.
 *
 * Notes are pre-rendered buffers (instruments.ts), so a note at runtime is a buffer source and a gain node.
 * They are rendered in a worker (worker.ts), the tune about to play first, and the band starts once it has every
 * sound that tune needs. Without a worker they are rendered on the main thread, a couple of milliseconds a frame.
 */

import { rand, toAudio } from '../synth';
import { DRUMS, Drum, Voice, renderSound } from './instruments';
import { Comp, Fills, Hit, Line, Part, Tune, chord, melody, note } from './score';

type Ch = 'keys' | 'comp' | 'lead' | 'bass' | 'kit';

/** How each voice plays a written note: how long it rings past its length, and its ornaments (chances). */
const TOUCH: Partial<Record<Voice, { tail: number; grace?: number; slide?: number; scoop?: number; press?: number }>> = {
  koto: { tail: 0.8, grace: 0.15, press: 0.2 },
  shamisen: { tail: 0.3, grace: 0.2 },
  shaku: { tail: 0.12, scoop: 0.6 },
  nylon: { tail: 0.8, grace: 0.12 },
  mando: { tail: 0.4, grace: 0.1 },
  flute: { tail: 0.12, scoop: 0.15 },
  oud: { tail: 0.7, slide: 0.35, grace: 0.1 },
  saz: { tail: 0.5, grace: 0.2 },
  qanun: { tail: 0.6, grace: 0.1 },
  ney: { tail: 0.15, scoop: 0.7 },
  guitarra: { tail: 0.8, grace: 0.18, slide: 0.12 },
  viola: { tail: 0.8, grace: 0.1 },
};

const KIT: Record<Drum, number> = {
  kick: 0.7, snare: 0.4, rim: 0.3, hat: 0.13, ohat: 0.1, shaker: 0.12, brush: 0.24, doum: 0.42, tek: 0.2, ka: 0.14, clap: 0.12,
};
const LATE: Partial<Record<Drum, number>> = { snare: 0.012, rim: 0.01, clap: 0.008, brush: 0.01 };

const at16 = (pat: string, bar: number, s: number) => pat[(bar % (pat.length >> 4)) * 16 + s] ?? '.';

interface Seq {
  tune: Tune;
  part: number;
  bar: number;
  step: number;
  t: number;
  /** a chord was pushed in on the last bar's "and of 4": don't strike it again on 1 */
  pushed: boolean;
  /** the lead's last note (for slides) */
  last: number;
  /** where the improvised fills are */
  fill: number;
  /** this part's ending: a drop, a fill or neither */
  ending: number;
}

export class Lofi {
  private bufs = new Map<string, AudioBuffer>();
  /** still to render on this thread (when there is no worker) */
  private queue: string[] = [];
  /** the sounds the first tune needs that haven't arrived yet; null before anything was asked for */
  private needed: Set<string> | null = null;
  private seq: Seq | null = null;
  private ch!: Record<Ch, AudioNode>;
  private duck!: GainNode;
  private partLp!: BiquadFilterNode;
  private tone!: BiquadFilterNode;
  private vinyl!: GainNode;
  private echo!: DelayNode;
  private echoSend!: GainNode;
  private mels = new WeakMap<Line, Hit[][]>();
  private chordCache = new WeakMap<Tune, number[][]>();
  private vinylOn = false;

  /** `worker`: render in a worker (the game); off for offline previews, which call prepare() */
  constructor(private ctx: BaseAudioContext, private out: AudioNode, private tunes: { day: Tune; night: Tune }, private useWorker = false) {
    this.build();
  }

  private build(): void {
    const ctx = this.ctx;
    const gain = (v: number, dest: AudioNode | AudioParam) => { const g = ctx.createGain(); g.gain.value = v; g.connect(dest as AudioNode); return g; };
    const filter = (type: BiquadFilterType, f: number, q: number, dest: AudioNode) => {
      const n = ctx.createBiquadFilter(); n.type = type; n.frequency.value = f; n.Q.value = q; n.connect(dest); return n;
    };
    const pan = (p: number, dest: AudioNode) => {
      if (!ctx.createStereoPanner) return { node: dest, pan: null };
      const n = ctx.createStereoPanner(); n.pan.value = p; n.connect(dest); return { node: n as AudioNode, pan: n.pan };
    };
    const lfo = (hz: number, depth: number, param: AudioParam) => {
      const o = ctx.createOscillator(); o.frequency.value = hz; o.connect(gain(depth, param)); o.start();
    };

    // tape: wobble (a swaying delay line) <- top end rolled off <- gentle saturation <- per-part filter
    const level = gain(0.62, this.out);
    const wow = ctx.createDelay(0.05);
    wow.delayTime.value = 0.012;
    wow.connect(level);
    lfo(0.55, 0.0011, wow.delayTime); // wow: a slow sway in pitch, a few cents
    lfo(5.8, 0.00008, wow.delayTime); // flutter
    const hp = filter('highpass', 35, 0.5, wow);
    this.tone = filter('lowpass', 7000, 0.5, hp);
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) { const x = (i / 511.5) - 1; curve[i] = Math.tanh(1.5 * x) / Math.tanh(1.5); }
    shaper.curve = curve;
    shaper.connect(this.tone);
    this.partLp = filter('lowpass', 20000, 0.6, shaper);
    this.duck = gain(1, this.partLp);

    // the lead's tape echo: a dotted eighth, dark and fading
    this.echo = ctx.createDelay(2);
    this.echo.connect(filter('lowpass', 2400, 0.5, filter('highpass', 300, 0.5, gain(0.3, this.echo))));
    this.echo.connect(gain(0.5, this.partLp));

    // channel levels: the keys and the lead sit level with the kit, the bass just under
    const keys = pan(0.15, this.duck);
    if (keys.pan) lfo(0.13, 0.3, keys.pan); // a slow drift across the stereo field, like a suitcase piano's tremolo
    const lead = gain(2.2, pan(-0.2, this.duck).node);
    this.echoSend = gain(0, this.echo);
    lead.connect(this.echoSend);
    this.ch = {
      keys: gain(1.8, keys.node),
      comp: gain(1.4, pan(0.28, this.duck).node),
      lead,
      bass: gain(0.75, this.duck),
      kit: gain(0.7, pan(0.05, this.partLp).node),
    };

    this.vinyl = gain(0, filter('lowpass', 7500, 0.5, level));
  }

  /** Render everything now (for offline previews). */
  prepare(night: number): void {
    this.useWorker = false;
    this.begin(night);
    while (this.queue.length) this.buf(this.queue.shift()!);
  }

  /** Every frame: takes in rendered sounds and schedules the next quarter second of music. */
  tick(now: number, night: number): void {
    if (!this.needed) this.begin(night);
    if (this.queue.length) {
      const end = performance.now() + 2;
      do this.buf(this.queue.shift()!); while (this.queue.length && performance.now() < end);
    }
    if (!this.seq) {
      if (this.needed!.size) return; // the band waits until it has the sounds it needs
      this.seq = { tune: night > 0.5 ? this.tunes.night : this.tunes.day, part: 0, bar: 0, step: 0, t: now + 0.15, pushed: false, last: 0, fill: 0, ending: 0 };
      this.dress(this.seq.tune, now);
    }
    const q = this.seq;
    if (q.t < now) q.t = now + 0.05; // after a stall (tab hidden), don't burst-play the backlog
    while (q.t < now + 0.25) {
      const e = 15 / q.tune.bpm;
      this.step(q, q.t, e);
      q.t += (q.step % 2 === 0 ? q.tune.swing : 1 - q.tune.swing) * 2 * e;
      if (++q.step < 16) continue;
      q.step = 0;
      if (++q.bar < this.part(q).prog.length) continue;
      q.bar = 0;
      // part boundary: switch between day and night here, with a little hysteresis around dusk and dawn
      const want = q.tune === this.tunes.night ? night > 0.4 : night > 0.6;
      const tune = want ? this.tunes.night : this.tunes.day;
      if (tune !== q.tune) { q.tune = tune; q.part = 0; q.pushed = false; this.dress(tune, q.t); }
      else if (++q.part >= tune.parts.length) q.part = tune.loopFrom;
      const lp = this.part(q).lp;
      this.partLp.frequency.setTargetAtTime(lp ?? 20000, q.t, lp ? 0.4 : 2.2);
    }
  }

  /** Ask for the active tune's sounds first, then the other's. */
  private begin(night: number): void {
    const [a, b] = night > 0.5 ? [this.tunes.night, this.tunes.day] : [this.tunes.day, this.tunes.night];
    const first = new Set(['vinyl', ...this.keysOf(a)]);
    const all = [...new Set([...first, ...this.keysOf(b)])];
    this.needed = first;
    if (this.useWorker) {
      try {
        const w = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module', name: 'lofi' });
        let left = all.length;
        w.onmessage = (e: MessageEvent<{ key: string; data: Float32Array; sr: number }>) => {
          const { key, data, sr } = e.data;
          if (!this.bufs.has(key)) this.store(key, toAudio(this.ctx, { data, sr }));
          if (--left === 0) w.terminate();
        };
        w.onerror = () => { // fall back to rendering here
          w.terminate();
          this.queue = all.filter((k) => !this.bufs.has(k));
        };
        w.postMessage(all);
        return;
      } catch { /* no module workers: render here */ }
    }
    this.queue = all;
  }

  /** The tape and record settings for a tune. */
  private dress(tune: Tune, t: number): void {
    this.tone.frequency.setTargetAtTime(tune.tone, t, 2);
    this.vinyl.gain.setTargetAtTime(0.35 * tune.crackle, t, 2);
    this.echo.delayTime.setTargetAtTime(0.75 * 60 / tune.bpm, t, 0.05);
    this.echoSend.gain.setTargetAtTime(0.45 * tune.echo, t, 0.5);
    this.partLp.frequency.setTargetAtTime(tune.parts[0].lp ?? 20000, t, 0.4);
    if (!this.vinylOn) { this.vinylOn = true; this.loop(this.buf('vinyl'), this.vinyl); }
  }

  private part(q: Seq): Part { return q.tune.parts[q.part]; }

  private chords(t: Tune): number[][] {
    let c = this.chordCache.get(t);
    if (!c) { c = t.chords.map(chord); this.chordCache.set(t, c); }
    return c;
  }

  private mel(l: Line): Hit[][] {
    let m = this.mels.get(l);
    if (!m) { m = melody(l.mel).bars; this.mels.set(l, m); }
    return m;
  }

  /** The chord of the bar after this one (which may be in the next part). */
  private nextChord(q: Seq): number[] {
    const p = this.part(q);
    const idx = q.bar + 1 < p.prog.length ? p.prog[q.bar + 1]
      : q.tune.parts[q.part + 1 < q.tune.parts.length ? q.part + 1 : q.tune.loopFrom].prog[0];
    return this.chords(q.tune)[idx];
  }

  // ---- one sixteenth ----

  private step(q: Seq, t: number, e: number): void {
    const tune = q.tune, p = this.part(q), s = q.step, bar = q.bar;
    const ch = this.chords(tune)[p.prog[bar]];
    const last = bar === p.prog.length - 1;
    for (const c of p.comp) this.comp(q, c, ch, t, e);

    // bass
    const bl = p.bass === undefined ? tune.bass : p.bass;
    if (bl) {
      const c = at16(bl, bar, s);
      if (c !== '.') {
        let root = ch[0];
        while (root < 33) root += 12;
        const next = this.nextChord(q)[0];
        let m = root, v = 0.6;
        switch (c) {
          case 'R': v = 0.9; break;
          case '5': m = root + 7; v = 0.65; break;
          case 'O': m = root + 12; v = 0.55; break;
          case 'b': m = root + 10; v = 0.55; break;
          case 'A': { let n = next; while (n < 33) n += 12; m = n === root ? root + 7 : n > root ? n - 1 : n + 1; v = 0.55; break; }
        }
        this.play('bass', m, t + rand(0, 0.006), v * 0.55, this.ch.bass, this.until(bl, bar, s) * e * 0.92);
      }
    }

    // drums, with a drop or a little fill going into the next part
    const g = p.groove ? tune.grooves[p.groove] : undefined;
    if (g) {
      if (last && s === 12) q.ending = Math.random();
      const drop = last && s >= 12 && q.ending < 0.3;
      for (const d of DRUMS) {
        const pat = g[d];
        if (!pat) continue;
        const c = at16(pat, bar, s);
        let v = c >= '1' && c <= '9' ? Number(c) / 9 : 0;
        if (drop && d !== 'shaker') v = 0;
        if (last && s >= 13 && q.ending > 0.75 && (d === 'snare' || d === 'rim') && !v) v = (s - 11) * 0.09;
        if (!v || (v < 0.4 && Math.random() < 0.3)) continue;
        const when = t + (LATE[d] ?? 0) * rand(0.4, 1) + rand(-0.004, 0.004);
        this.fire(this.buf(d), when, KIT[d] * v * rand(0.88, 1.08), this.ch.kit);
        if (d === 'kick') this.pump(t, v);
      }
    }

    for (const l of [p.lead, p.second]) {
      if (!l) continue;
      for (const h of this.mel(l)[bar % this.mel(l).length] ?? []) if (h.at === s) this.sing(q, l, h, t, e);
    }
    if (p.fills) this.fills(q, p.fills, ch, t, e);

    const sp = tune.sparkle;
    if (sp && s === 0 && bar % sp.every === 0 && Math.random() < sp.chance) {
      const notes = sp.notes.split(' ').map(note);
      const n = Math.round(rand(sp.count[0], sp.count[1]));
      let w = t + rand(0.05, 0.4);
      for (let i = 0; i < n; i++, w += rand(0.12, 0.45)) this.play(sp.voice, notes[Math.floor(Math.random() * notes.length)], w, sp.vol * rand(0.6, 1), this.ch.comp);
    }
  }

  /** Sixteenths from step s until the pattern's next hit (wrapping into the next bar). */
  private until(pat: string, bar: number, s: number): number {
    for (let d = 1; d <= 32; d++) {
      const i = s + d;
      if (at16(pat, bar + (i >> 4), i & 15) !== '.') return d;
    }
    return 16;
  }

  private comp(q: Seq, c: Comp, ch: number[], t: number, e: number): void {
    const s = q.step, bar = q.bar, k = at16(c.pat, bar, s);
    if (k === '.') return;
    const up = 12 * (c.up ?? 0);
    const voicing = ch.slice(1).map((m) => m + up);
    const v = (x: number) => c.vol * x * rand(0.88, 1.06);
    const dest = c.style === 'keys' ? this.ch.keys : this.ch.comp;
    const hold = this.until(c.pat, bar, s) * e;
    switch (c.style) {
      case 'keys':
      case 'pad': {
        if (k === 'X' && s === 0 && q.pushed) { q.pushed = false; return; }
        const notes = k === 'P' ? this.nextChord(q).slice(1).map((m) => m + up) : k === 'x' ? voicing.slice(-2) : voicing;
        if (k === 'P') q.pushed = true;
        const lazy = c.style === 'keys' ? rand(0.008, 0.018) : 0;
        const rel = (k === 'P' ? hold + 16 * e : hold) + 0.06;
        notes.forEach((m, i) => this.play(c.voice, m, t + lazy + i * rand(0.01, 0.02), v((k === 'x' ? 0.6 : 1) * (i === notes.length - 1 ? 1.15 : 1)), dest, rel));
        break;
      }
      case 'pick': {
        let m: number;
        if (k === 'T') { m = ch[0] + 12; while (m < 40) m += 12; } else m = voicing[Math.min(voicing.length - 1, Number(k))];
        this.play(c.voice, m, t + rand(-0.006, 0.008), v(k === 'T' ? 1.1 : 0.85), dest, Math.max(hold, 6 * e));
        break;
      }
      case 'strum': {
        const down = k === 'D' || k === 'd';
        const notes = down ? voicing : [...voicing].reverse();
        const gap = down ? 0.011 : 0.008;
        notes.forEach((m, i) => this.play(c.voice, m, t + i * gap + rand(0, 0.004), v(k === k.toUpperCase() ? 1 : 0.6), dest, 2.5 * e));
        break;
      }
    }
  }

  /** A written melody note, with the voice's own ornaments now and then. */
  private sing(q: Seq, l: Line, h: Hit, t: number, e: number): void {
    const m = h.m + 12 * (l.up ?? 0), touch = TOUCH[l.voice] ?? { tail: 0.4 };
    const when = t + rand(-0.008, 0.008), vol = l.vol * rand(0.85, 1.08), rel = h.len * e + touch.tail;
    const long = h.len >= 4;
    const prev = q.last;
    q.last = m;
    if (h.fx === '^' || (touch.grace && long && Math.random() < touch.grace)) {
      this.play(l.voice, m - (l.voice === 'koto' ? 2 : 1), when - 0.055, vol * 0.45, this.ch.lead, 0.07);
    }
    const d = prev - m;
    if (h.fx === '~' || (touch.slide && prev && Math.abs(d) >= 1 && Math.abs(d) <= 4 && Math.random() < touch.slide)) {
      this.play(l.voice, m, when, vol, this.ch.lead, rel, { from: h.fx === '~' && !prev ? -2 : d, delay: 0.01, dur: 0.09 });
    } else if (touch.press && h.len >= 6 && Math.random() < touch.press) {
      this.play(l.voice, m, when, vol, this.ch.lead, rel, { from: -1, delay: 0.05, dur: 0.16 }); // the koto player presses the string up
    } else if (touch.scoop && long && Math.random() < touch.scoop) {
      this.play(l.voice, m, when, vol, this.ch.lead, rel, { from: -0.4, delay: 0, dur: 0.14 });
    } else {
      this.play(l.voice, m, when, vol, this.ch.lead, rel);
    }
  }

  /** Improvised fills: walk the scale a step or two at a time, settle on chord tones on the beat. */
  private fills(q: Seq, f: Fills, ch: number[], t: number, e: number): void {
    const s = q.step;
    const scale: number[] = [];
    for (let m = f.lo; m <= f.hi; m++) if (f.scale.includes(((m % 12) + 12) % 12)) scale.push(m);
    if (!scale.length) return;
    const near = (m: number) => scale.reduce((b, x) => Math.abs(x - m) < Math.abs(b - m) ? x : b, scale[0]);
    if (!q.fill || q.fill < f.lo || q.fill > f.hi) q.fill = near((f.lo + f.hi) / 2);
    const tones = ch.slice(1).map((m) => m % 12);
    // a quick run down into the next bar now and then
    if (f.runs && s === 12 && q.bar % 2 === 1 && Math.random() < f.runs) {
      const sw = 2 * e * q.tune.swing, offs = [0, sw, 2 * e, 2 * e + sw];
      let i = Math.min(scale.length - 1, scale.indexOf(near(q.fill)) + 4);
      for (let k = 0; k < 4; k++) {
        this.play(f.voice, scale[i], t + offs[k], f.vol * (0.7 + k * 0.08), this.ch.lead, 3 * e);
        q.fill = scale[i];
        i = Math.max(0, i - 1);
      }
      return;
    }
    if (s % 2 || Math.random() > f.density * (s % 4 === 0 ? 1.2 : 0.7)) return;
    let i = scale.indexOf(near(q.fill)) + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)];
    i = Math.max(0, Math.min(scale.length - 1, i));
    let m = scale[i];
    if (s % 8 === 0 && !tones.includes(m % 12)) {
      const up = scale.find((x) => x > m && tones.includes(x % 12)), dn = [...scale].reverse().find((x) => x < m && tones.includes(x % 12));
      m = up !== undefined && (dn === undefined || up - m <= m - dn) ? up : dn ?? m;
    }
    q.fill = m;
    this.play(f.voice, m, t + rand(-0.006, 0.01), f.vol * rand(0.75, 1.05), this.ch.lead, rand(2, 4) * e + (TOUCH[f.voice]?.tail ?? 0.4));
  }

  /** The band breathes under the kick. */
  private pump(t: number, v: number): void {
    const g = this.duck.gain;
    g.setTargetAtTime(1 - 0.22 * v, t, 0.006);
    g.setTargetAtTime(1, t + 0.04, 0.11);
  }

  // ---- playback ----

  /** Every third semitone is rendered; the rest (and microtones) are playback rate. */
  private key(v: Voice, m: number): [string, number] {
    const base = Math.round(m / 3) * 3;
    return [`${v}:${base}`, 2 ** ((m - base) / 12)];
  }

  private play(v: Voice, m: number, when: number, vol: number, dest: AudioNode, release?: number, bend?: { from: number; delay: number; dur: number }): void {
    const [k, rate] = this.key(v, m);
    this.fire(this.buf(k), when, vol, dest, rate, release, bend);
  }

  private fire(b: AudioBuffer, when: number, vol: number, dest: AudioNode, rate = 1, release?: number, bend?: { from: number; delay: number; dur: number }): void {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = b;
    when = Math.max(when, ctx.currentTime);
    if (bend) {
      const r = src.playbackRate;
      r.setValueAtTime(rate * 2 ** (bend.from / 12), when);
      r.setValueAtTime(rate * 2 ** (bend.from / 12), when + bend.delay);
      r.linearRampToValueAtTime(rate, when + bend.delay + bend.dur);
    } else src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(g).connect(dest);
    src.start(when);
    if (release !== undefined && release < b.duration / rate) {
      g.gain.setValueAtTime(vol, when + release);
      g.gain.setTargetAtTime(0, when + release, 0.06);
      src.stop(when + release + 0.4);
    }
  }

  private loop(b: AudioBuffer, dest: AudioNode): void {
    const s = this.ctx.createBufferSource();
    s.buffer = b; s.loop = true;
    s.connect(dest); s.start();
  }

  private buf(k: string): AudioBuffer {
    return this.bufs.get(k) ?? this.store(k, toAudio(this.ctx, renderSound(k)));
  }

  private store(k: string, b: AudioBuffer): AudioBuffer {
    this.bufs.set(k, b);
    this.needed?.delete(k);
    return b;
  }

  /** Every buffer a tune can ask for. */
  private keysOf(tune: Tune): Set<string> {
    const out = new Set<string>();
    const add = (v: Voice, m: number) => out.add(this.key(v, m)[0]);
    const chords = this.chords(tune);
    for (const p of tune.parts) {
      const used = p.prog.map((i) => chords[i]);
      const next = tune.parts[(tune.parts.indexOf(p) + 1) % tune.parts.length]?.prog[0];
      if (next !== undefined) used.push(chords[next]);
      for (const c of p.comp) for (const ch of used) {
        const up = 12 * (c.up ?? 0);
        if (c.style === 'pick') { let m = ch[0] + 12; while (m < 40) m += 12; add(c.voice, m); }
        for (const m of ch.slice(1)) add(c.voice, m + up);
      }
      if (p.bass !== false) for (const ch of used) { let r = ch[0]; while (r < 33) r += 12; for (let d = -1; d <= 13; d++) add('bass', r + d); }
      for (const l of [p.lead, p.second]) if (l) for (const bar of this.mel(l)) for (const h of bar) {
        const m = h.m + 12 * (l.up ?? 0);
        add(l.voice, m); add(l.voice, m - 1); add(l.voice, m - 2);
      }
      if (p.fills) for (let m = p.fills.lo; m <= p.fills.hi; m++) if (p.fills.scale.includes(m % 12)) add(p.fills.voice, m);
      const g = p.groove ? tune.grooves[p.groove] : undefined;
      if (g) for (const d of DRUMS) if (g[d] || d === 'snare') out.add(d);
    }
    if (tune.sparkle) for (const n of tune.sparkle.notes.split(' ')) add(tune.sparkle.voice, note(n));
    return out;
  }
}
