import { TEXT } from '../data/cityText';
import type { Recipe, Step, Ingredient } from '../data/stalls';
import type { Audio } from '../game/audio';
import { DISH } from '../data/dishes';
import { G } from './glyphs';
import { E, icon } from './emblems';

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
  return b;
}

/** A sequence of tactile cooking mini-games. Calls done(stars) at the end, or done(-1) if cancelled. */
export class CookingGame {
  private idx = 0;
  private scores: number[] = [];
  private stage!: HTMLElement;
  private stepsBar!: HTMLElement;
  private titleEl!: HTMLElement;
  private raf = 0;
  private alive = true;

  constructor(panel: HTMLElement, private recipe: Recipe, private audio: Audio, private icon: string, private done: (stars: number) => void) {
    const dish = DISH[recipe.dish];
    panel.classList.add('cook');
    panel.innerHTML = '';
    const head = h('div', 'panel-head');
    head.innerHTML = `<div class="ph-icon">${G.chef}</div><div><h2>${dish.name}<span class="jp">${dish.jp}</span></h2></div>`;
    this.titleEl = h('div', 'sub');
    head.lastElementChild!.appendChild(this.titleEl);
    const close = h('button', 'close', G.close);
    close.setAttribute('aria-label', 'Close');
    close.onclick = () => { this.stop(); done(-1); };
    head.appendChild(close);
    panel.appendChild(head);
    this.stepsBar = h('div', 'cook-steps');
    recipe.steps.forEach(() => this.stepsBar.appendChild(h('i')));
    panel.appendChild(this.stepsBar);
    this.stage = h('div', 'cook-stage');
    panel.appendChild(this.stage);
    this.next();
  }

  stop(): void {
    this.alive = false;
    cancelAnimationFrame(this.raf);
  }

  private bar() {
    [...this.stepsBar.children].forEach((c, i) => {
      c.className = i < this.idx ? 'done' : i === this.idx ? 'on' : '';
    });
  }

  private pop(text: string, x: number, y: number, color: string) {
    const p = h('div', 'fx-pop', text);
    // x/y come from screen rects; on phones the panel is CSS-zoomed, so map them back to its own pixels
    const k = this.stage.offsetWidth / (this.stage.getBoundingClientRect().width || 1);
    p.style.left = x * k + 'px';
    p.style.top = y * k + 'px';
    p.style.color = color;
    this.stage.appendChild(p);
    setTimeout(() => p.remove(), 800);
  }

  private finishStep(score: number) {
    this.scores.push(Math.max(0, Math.min(1, score)));
    this.idx++;
    setTimeout(() => this.alive && this.next(), 550);
  }

  private next() {
    cancelAnimationFrame(this.raf);
    this.bar();
    this.stage.innerHTML = '';
    if (this.idx >= this.recipe.steps.length) return this.result();
    const step = this.recipe.steps[this.idx];
    this.titleEl.textContent = `Step ${this.idx + 1} of ${this.recipe.steps.length} · ${step.title}`;
    this.stage.appendChild(h('div', 'cook-hint', step.hint));
    switch (step.kind) {
      case 'pick': return this.pick(step);
      case 'mix': return this.mix(step);
      case 'heat': return this.heat(step);
      case 'chop': return this.chop(step);
      case 'order': return this.order(step);
      case 'flip': return this.flip(step);
    }
  }

  private pick(step: Step) {
    const want = step.items ?? [];
    const all = shuffle([...want, ...(step.decoys ?? [])]);
    const grid = h('div', 'ing-grid');
    let got = 0, mistakes = 0;
    all.forEach((ing) => {
      const b = h('button', 'ing', `<span class="e">${icon(ing.icon)}</span>${ing.name}`);
      b.onclick = () => {
        if (b.classList.contains('ok')) return;
        if (want.includes(ing)) {
          b.classList.add('ok');
          got++;
          this.audio.play('pop');
          if (got === want.length) this.finishStep(1 - mistakes * 0.25);
        } else {
          mistakes++;
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
          this.audio.play('fail');
        }
      };
      grid.appendChild(b);
    });
    this.stage.appendChild(grid);
  }

  private mix(step: Step) {
    const turns = step.rounds ?? 5;
    const bowl = h('div', 'mixbowl');
    bowl.appendChild(h('div', 'swirl'));
    const whisk = h('div', 'whisk');
    bowl.appendChild(whisk);
    const meter = h('div', 'meter', '<i></i>');
    this.stage.appendChild(bowl);
    this.stage.appendChild(meter);
    const hint = h('div', 'gauge-label', 'Drag in circles (or tap ← → alternately)');
    this.stage.appendChild(hint);
    let total = 0, last: number | null = null, jerk = 0, samples = 0;
    const t0 = performance.now();
    whisk.style.left = '50%'; whisk.style.top = '30%';
    const update = () => {
      const f = Math.min(1, total / (turns * Math.PI * 2));
      (meter.firstChild as HTMLElement).style.width = f * 100 + '%';
      if (f >= 1) {
        cleanup();
        const secs = (performance.now() - t0) / 1000;
        const smooth = samples ? 1 - Math.min(0.5, jerk / samples) : 1;
        this.audio.play('success');
        this.finishStep(Math.min(1, smooth * (secs < turns * 0.25 ? 0.8 : 1)));
      }
    };
    const onMove = (e: PointerEvent) => {
      if (!(e.buttons & 1) && e.pointerType === 'mouse') return;
      const r = bowl.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
      const a = Math.atan2(y, x);
      whisk.style.left = 50 + (x / r.width) * 100 + '%';
      whisk.style.top = 50 + (y / r.height) * 100 + '%';
      if (last !== null) {
        let d = a - last;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        if (Math.abs(d) < 1.2) { total += Math.abs(d); jerk += Math.abs(Math.abs(d) - 0.2); samples++; }
      }
      last = a;
      update();
    };
    let lastKey = '';
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'a' || e.key === 'd') && e.key !== lastKey) {
        lastKey = e.key;
        total += Math.PI * 0.5;
        samples++;
        const ang = total;
        whisk.style.left = 50 + Math.cos(ang) * 28 + '%';
        whisk.style.top = 50 + Math.sin(ang) * 28 + '%';
        update();
      }
    };
    const up = () => { last = null; };
    bowl.addEventListener('pointermove', onMove);
    bowl.addEventListener('pointerdown', (e) => { bowl.setPointerCapture(e.pointerId); last = null; onMove(e); });
    bowl.addEventListener('pointerup', up);
    window.addEventListener('keydown', onKey);
    const cleanup = () => window.removeEventListener('keydown', onKey);
  }

  private heat(step: Step) {
    const rounds = step.rounds ?? 2;
    let round = 0;
    const scores: number[] = [];
    const gauge = h('div', 'gauge');
    const zone = h('div', 'zone');
    const needle = h('div', 'needle');
    gauge.append(zone, needle);
    const label = h('div', 'gauge-label');
    const btn = h('button', 'btn btn-red big-tap', `${E.fire}${step.label ?? 'Now'}!`);
    this.stage.append(gauge, label, btn);
    let pos = 0, dir = 1, zc = 0.5, zw = 0.16;
    const setup = () => {
      zc = 0.35 + Math.random() * 0.4;
      zw = Math.max(0.08, 0.16 - round * 0.03);
      zone.style.left = (zc - zw / 2) * 100 + '%';
      zone.style.width = zw * 100 + '%';
      label.textContent = `${round + 1} / ${rounds}`;
      pos = 0; dir = 1;
    };
    setup();
    let lastT = performance.now();
    const speed = (step.speed ?? 1.2) * 0.75;
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      pos += dir * dt * speed * (1 + round * 0.15);
      if (pos > 1) { pos = 1; dir = -1; }
      if (pos < 0) { pos = 0; dir = 1; }
      needle.style.left = pos * 100 + '%';
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    const hit = () => {
      const d = Math.abs(pos - zc);
      const s = d < zw * 0.18 ? 1 : d < zw / 2 ? 0.8 : d < zw ? 0.45 : 0.1;
      scores.push(s);
      const r = gauge.getBoundingClientRect(), sr = this.stage.getBoundingClientRect();
      this.pop(s >= 1 ? 'Perfect!' : s >= 0.8 ? 'Great' : s >= 0.45 ? 'OK' : 'Oops', r.left - sr.left + pos * r.width, r.top - sr.top - 10, s >= 0.8 ? '#4f9a6a' : s >= 0.45 ? '#c88a14' : '#e9573f');
      this.audio.play(s >= 0.45 ? 'sizzle' : 'fail');
      round++;
      if (round >= rounds) {
        cancelAnimationFrame(this.raf);
        btn.setAttribute('disabled', '');
        window.removeEventListener('keydown', onKey);
        this.finishStep(scores.reduce((a, b) => a + b, 0) / scores.length);
      } else setup();
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hit(); } };
    btn.onclick = hit;
    window.addEventListener('keydown', onKey);
  }

  private chop(step: Step) {
    const cuts = step.rounds ?? 4;
    const board = h('div', 'board');
    board.appendChild(h('div', 'meat'));
    const lines: { x: number; el: HTMLElement; cut: boolean }[] = [];
    for (let i = 0; i < cuts; i++) {
      const x = 0.18 + (i / (cuts - 1)) * 0.64;
      const el = h('div', 'line');
      el.style.left = x * 100 + '%';
      board.appendChild(el);
      lines.push({ x, el, cut: false });
    }
    const knife = h('div', 'knife');
    board.appendChild(knife);
    const btn = h('button', 'btn btn-red big-tap', `${E.knife}Chop!`);
    this.stage.append(board, btn);
    let pos = 0.05, dir = 1, lastT = performance.now();
    const speed = (step.speed ?? 1) * 0.55;
    const scores: number[] = [];
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      pos += dir * dt * speed;
      if (pos > 0.95) { pos = 0.95; dir = -1; }
      if (pos < 0.05) { pos = 0.05; dir = 1; }
      knife.style.left = pos * 100 + '%';
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    const hit = () => {
      let best: (typeof lines)[0] | null = null, bd = 1;
      for (const l of lines) if (!l.cut && Math.abs(l.x - pos) < bd) { bd = Math.abs(l.x - pos); best = l; }
      if (!best) return;
      const s = bd < 0.02 ? 1 : bd < 0.05 ? 0.75 : bd < 0.1 ? 0.4 : 0;
      this.audio.play('chop');
      knife.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(26px)' }, { transform: 'translateY(0)' }], { duration: 160 });
      if (s > 0) { best.cut = true; best.el.classList.add('cut'); scores.push(s); }
      else scores.push(0);
      const r = board.getBoundingClientRect(), sr = this.stage.getBoundingClientRect();
      this.pop(s >= 1 ? 'Clean!' : s > 0.5 ? 'Nice' : s > 0 ? 'Rough' : 'Miss', r.left - sr.left + pos * r.width, r.top - sr.top, s > 0.5 ? '#4f9a6a' : '#e9573f');
      if (lines.every((l) => l.cut) || scores.length >= cuts + 3) {
        cancelAnimationFrame(this.raf);
        btn.setAttribute('disabled', '');
        window.removeEventListener('keydown', onKey);
        const good = scores.filter((x) => x > 0);
        this.finishStep((good.reduce((a, b) => a + b, 0) / cuts) * (lines.every((l) => l.cut) ? 1 : 0.7));
      }
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); hit(); } };
    btn.onclick = hit;
    window.addEventListener('keydown', onKey);
  }

  private order(step: Step) {
    const seq = step.items ?? [];
    const slots = h('div', 'slots-row');
    seq.forEach(() => slots.appendChild(h('span')));
    const row = h('div', 'order-row');
    let k = 0, mistakes = 0;
    const unique: Ingredient[] = [];
    for (const s of seq) if (!unique.find((u) => u.name === s.name)) unique.push(s);
    shuffle(unique).forEach((ing) => {
      const b = h('button', 'ing', `<span class="e">${icon(ing.icon)}</span>${ing.name}`);
      b.style.minWidth = '96px';
      b.onclick = () => {
        if (k >= seq.length) return;
        if (seq[k].name === ing.name) {
          const s = slots.children[k] as HTMLElement;
          s.innerHTML = icon(ing.icon);
          s.classList.add('f');
          k++;
          this.audio.play('pop');
          if (k === seq.length) this.finishStep(1 - mistakes * 0.2);
        } else {
          mistakes++;
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
          this.audio.play('fail');
        }
      };
      row.appendChild(b);
    });
    this.stage.append(slots, row);
  }

  private flip(step: Step) {
    const n = step.rounds ?? 9;
    const pan = h('div', 'pan');
    const balls: { el: HTMLElement; t: number; rate: number; state: 'cook' | 'done' | 'burnt'; score: number }[] = [];
    for (let i = 0; i < n; i++) {
      const hole = h('div', 'hole');
      const ball = h('div', 'ball');
      hole.appendChild(ball);
      pan.appendChild(hole);
      const b = { el: ball, t: -Math.random() * 1.5, rate: 0.16 + Math.random() * 0.1, state: 'cook' as 'cook' | 'done' | 'burnt', score: 0 };
      balls.push(b);
      hole.onclick = () => {
        if (b.state !== 'cook') return;
        const c = b.t;
        if (c < 0.45) { this.audio.play('fail'); ball.animate([{ transform: 'scale(1)' }, { transform: 'scale(0.9)' }, { transform: 'scale(1)' }], { duration: 160 }); return; }
        b.state = 'done';
        b.score = c < 0.62 ? 0.6 : c < 0.82 ? 1 : 0.7;
        ball.classList.add('done');
        this.audio.play('sizzle');
        check();
      };
    }
    this.stage.appendChild(pan);
    const color = (t: number) => {
      // raw batter -> golden -> brown -> burnt
      const stops = [[0, 245, 232, 200], [0.5, 240, 205, 130], [0.75, 214, 150, 70], [0.95, 140, 80, 40], [1.1, 50, 30, 25]];
      let i = 0;
      while (i < stops.length - 2 && stops[i + 1][0] < t) i++;
      const a = stops[i], b = stops[i + 1];
      const f = Math.max(0, Math.min(1, (t - a[0]) / (b[0] - a[0])));
      return `rgb(${a[1] + (b[1] - a[1]) * f | 0},${a[2] + (b[2] - a[2]) * f | 0},${a[3] + (b[3] - a[3]) * f | 0})`;
    };
    let lastT = performance.now();
    const loop = (t: number) => {
      const dt = Math.min(0.05, (t - lastT) / 1000);
      lastT = t;
      for (const b of balls) {
        if (b.state !== 'cook') continue;
        b.t += dt * b.rate;
        b.el.style.background = `radial-gradient(circle at 35% 30%, rgba(255,255,255,0.35), transparent 40%), ${color(b.t)}`;
        if (b.t > 1.05) { b.state = 'burnt'; b.score = 0; b.el.classList.add('burnt'); this.audio.play('fail'); check(); }
      }
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
    const check = () => {
      if (balls.every((b) => b.state !== 'cook')) {
        cancelAnimationFrame(this.raf);
        this.finishStep(balls.reduce((a, b) => a + b.score, 0) / n);
      }
    };
  }

  private result() {
    const avg = this.scores.reduce((a, b) => a + b, 0) / Math.max(1, this.scores.length);
    const stars = avg >= 0.85 ? 3 : avg >= 0.6 ? 2 : 1;
    const dish = DISH[this.recipe.dish];
    const msgs = ['Edible! Everyone starts somewhere.', 'Delicious! The vendor nods approvingly.', 'Perfect! You cook like a local master.'];
    this.titleEl.textContent = 'Finished!';
    this.stage.innerHTML = `<div class="result">
      ${this.icon ? `<img src="${this.icon}" alt="">` : ''}
      <div class="stars-big">${G.star.repeat(stars)}<span class="off" style="display:contents">${G.star.repeat(3 - stars)}</span></div>
      <h3>${dish.name}</h3><p>${msgs[stars - 1]}<br>Tip earned: <b>${TEXT.money(stars * 150)}</b></p></div>`;
    const b = h('button', 'btn btn-red btn-hero', 'Taste it!');
    b.onclick = () => { this.stop(); this.done(stars); };
    this.stage.querySelector('.result')!.appendChild(b);
    this.audio.play(stars === 3 ? 'chime' : 'success');
    this.bar();
  }
}
