import type { DineKit } from '../ui/dining';
import type { HotelInfo } from '../data/hotels';
import { G } from '../ui/glyphs';
import { icon } from '../ui/emblems';
import type { NeoLife } from './state';
import { GARMENT, GARMENTS, SLOT_NAME, takeOff, wear, type Boutique, type Slot } from './wardrobe';
import { JOB_NAME, type Gig, type GigRunner } from './jobs';

/**
 * 2040's life panels: the boutiques, the street clinics, the gig boards, the letting desks, and the life panel
 * (you, your wardrobe, your work and the secrets you have found). They are built with the same kit as the
 * eating-out sheets, so they look and close like every other panel.
 */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

export interface LifeDeps {
  life: () => NeoLife;
  money: (n: number) => string;
  /** Take credits; false when short. */
  spend: (n: number) => boolean;
  /** Rebuild the player after a change of clothes. */
  dressed: () => void;
  saved: () => void;
  day: () => number;
}

export const FLAT_NAME: Record<string, { name: string; text: string }> = {
  single: { name: 'Box flat', text: 'One room, a fold-down bed, a two-ring hob and a window onto the wires.' },
  twin: { name: 'Two-room flat', text: 'A real bedroom, a kitchen corner and a balcony big enough for one chair.' },
  double: { name: 'Studio loft', text: 'High ceiling, wide bed, a proper kitchen and the city in the windows.' },
  king: { name: 'Penthouse', text: 'The top of the building: the biggest bed in the city and a skyline that is all yours.' },
  tatami: { name: 'Tatami flat', text: '' },
};

const CLINIC = [
  { id: 'patch', name: 'Patch-up', icon: 'plaster', price: 45, text: 'Cleaned, stitched and scanned. Health back to full.' },
  { id: 'gel', name: 'Nutri-gel pouch', icon: 'drop', price: 14, text: 'A pouch of everything your body forgot. Takes the edge off hunger.' },
  { id: 'stim', name: 'Wake stim', icon: 'vitamin', price: 22, text: 'A shot of something bright. Holds off sleep for a few hours. Do not make it a habit.' },
] as const;
export type ClinicItem = typeof CLINIC[number]['id'];

export class LifeUI {
  constructor(private kit: DineKit, private d: LifeDeps) {}

  private say(body: HTMLElement, who: string, line: string): void {
    body.insertAdjacentHTML('beforeend', `<div class="vendor-line"><span class="ava">${esc(who.replace(/^(Mrs?\.|Ms\.|Mx\.|Dr\.|Landlady|Doorman|Dispatcher|Nurse|Medic|Bartender|Chef|Baker|Archivist|Master|Madame) /, '').charAt(0))}</span><div class="say"><b>${esc(who)}</b>“${esc(line)}”</div></div>`);
  }

  // ------------------------------------------------------------------ boutique
  boutique(b: Boutique, name: string, keeper: string, line: string): void {
    const p = this.kit.panel('panel n-shop');
    this.kit.head(p, esc(name), '', `${esc(b.label)} · ${esc(keeper)}`, icon('coat'));
    const body = h('div', 'panel-body');
    this.say(body, keeper, line);
    const grid = h('div', 'n-grid');
    const draw = () => {
      const L = this.d.life();
      grid.innerHTML = '';
      for (const id of b.stock) {
        const x = GARMENT[id];
        const owned = L.owned.includes(id), worn = L.outfit[x.slot] === id;
        const c = h('div', 'n-card' + (worn ? ' on' : ''), `
          <div class="n-sw" style="--a:${hex(x.sw[0])};--b:${hex(x.sw[1])}"><i></i><b>${esc(SLOT_NAME[x.slot])}</b></div>
          <h3>${esc(x.name)}</h3><p>${esc(x.text)}</p>
          <button class="btn ${owned ? 'btn-soft' : 'btn-red'}" ${worn ? 'disabled' : ''}>${worn ? `${G.check}Wearing` : owned ? 'Wear' : `Buy · ${esc(this.d.money(x.price))}`}</button>`);
        c.querySelector('button')!.onclick = () => {
          const L2 = this.d.life();
          if (!L2.owned.includes(id)) {
            if (!this.d.spend(x.price)) { this.kit.play('fail'); this.kit.toast('purse', 'Not enough credits', 'Take a gig from a GigHub board, then come back.'); return; }
            L2.owned.push(id);
            this.kit.play('coin');
            this.kit.toast('coat', x.name, 'Bagged, tagged and on you. It is in your wardrobe for good.');
          } else this.kit.play('click');
          wear(L2, id);
          this.d.dressed();
          this.d.saved();
          draw();
        };
        grid.appendChild(c);
      }
    };
    draw();
    body.appendChild(grid);
    body.appendChild(h('p', 'fine', 'What you buy stays in your wardrobe. Change any time from the life panel.'));
    p.appendChild(body);
  }

  // ------------------------------------------------------------------ clinic
  clinic(name: string, keeper: string, line: string, use: (id: ClinicItem) => void): void {
    const p = this.kit.panel('panel');
    this.kit.head(p, esc(name), '', `Street clinic · ${esc(keeper)}`, icon('plaster'));
    const body = h('div', 'panel-body');
    this.say(body, keeper, line);
    const menu = h('div', 'menu');
    for (const it of CLINIC) {
      const c = h('div', 'dish-card', `<div class="dimg"><span class="emo">${icon(it.icon)}</span></div><div><h3>${esc(it.name)}</h3><p>${esc(it.text)}</p><div class="row"><button class="btn btn-red">${esc(this.d.money(it.price))}</button></div></div>`);
      c.querySelector('button')!.onclick = () => {
        if (!this.d.spend(it.price)) { this.kit.play('fail'); this.kit.toast('purse', 'Not enough credits', 'The clinic runs on credits, sadly. A gig pays in minutes.'); return; }
        this.kit.play('coin');
        use(it.id);
        this.kit.close();
      };
      menu.appendChild(c);
    }
    body.appendChild(menu);
    p.appendChild(body);
  }

  // ------------------------------------------------------------------ gig board
  gigBoard(name: string, keeper: string, line: string, gigs: Gig[], runner: GigRunner, accept: (g: Gig) => void, quit: () => void): void {
    const p = this.kit.panel('panel');
    this.kit.head(p, esc(name), '', `Gig board · ${esc(keeper)}`, icon('signal'));
    const body = h('div', 'panel-body');
    this.say(body, keeper, line);
    const cur = runner.gig;
    if (cur) {
      const c = h('div', 'n-active', `<b>On the clock: ${esc(cur.title)}</b><span>Stop ${cur.at + 1} of ${cur.stops.length} · ${esc(cur.stops[cur.at].name)}</span><button class="btn btn-soft">Drop this gig</button>`);
      c.querySelector('button')!.onclick = () => { this.kit.play('click'); quit(); this.kit.close(); };
      body.appendChild(c);
    }
    const menu = h('div', 'menu');
    const L = this.d.life();
    for (const g of gigs) {
      const j = JOB_NAME[g.kind];
      const done = L.shifts[g.kind] ?? 0;
      const c = h('div', 'dish-card gig', `
        <div class="dimg"><span class="emo">${icon(j.icon)}</span><span class="badge floor">${g.stops.length} stop${g.stops.length > 1 ? 's' : ''}</span></div>
        <div>
          <h3>${esc(g.title)}</h3>
          <p>${esc(g.text)}</p>
          <div class="n-meta"><span>${esc(j.name)}</span>${g.par ? `<span>${G.clock}Bonus +${esc(this.d.money(g.bonus))} under ${Math.ceil(g.par / 60)} min</span>` : ''}${done ? `<span>${done} done</span>` : ''}</div>
          <div class="row"><button class="btn btn-red" ${cur ? 'disabled' : ''}>${cur ? 'Finish your gig first' : `Take it · ${esc(this.d.money(g.pay))}${g.kind === 'kitchen' ? '+' : ''}`}</button></div>
        </div>`);
      const btn = c.querySelector<HTMLButtonElement>('.btn-red')!;
      btn.onclick = () => { if (cur) return; this.kit.play('coin'); accept(g); this.kit.close(); };
      menu.appendChild(c);
    }
    body.appendChild(menu);
    body.appendChild(h('p', 'fine', 'A new board every hour. Your pin and compass lead to each stop.'));
    p.appendChild(body);
  }

  // ------------------------------------------------------------------ letting desk
  lettings(info: HotelInfo, line: string, flats: { id: string; floor: number; type: string; price: number; buy?: number }[], choose: (id: string, buy: boolean) => boolean): void {
    const p = this.kit.panel('panel');
    this.kit.head(p, esc(info.name), '', `${esc(info.street)} · Lettings · ${esc(info.keeper)}`, icon('key'));
    const body = h('div', 'panel-body');
    this.say(body, info.keeper, line);
    const L = this.d.life();
    const menu = h('div', 'menu');
    for (const f of flats) {
      const t = FLAT_NAME[f.type] ?? FLAT_NAME.double;
      const mine = L.home?.id === f.id;
      const left = mine && !L.home!.owned ? Math.max(0, L.home!.paidTo - this.d.day()) : 0;
      const c = h('div', 'dish-card room' + (f.type === 'king' ? ' king' : ''), `
        <div class="dimg"><span class="emo">${icon(f.type === 'king' ? 'crown' : 'home')}</span><span class="badge${mine ? '' : ' floor'}">${mine ? `${G.check}Your home` : `${f.floor + 1}F`}</span></div>
        <div>
          <h3>${esc(t.name)} · ${f.floor + 1}01</h3>
          <p>${esc(t.text)}</p>
          <div class="row">
            ${mine && L.home!.owned ? `<button class="btn btn-soft" disabled>${G.check}Yours outright</button>` : `<button class="btn btn-red" data-m="rent">${mine ? `Pay another week · ${esc(this.d.money(f.price))}` : `Rent a week · ${esc(this.d.money(f.price))}`}</button>`}
            ${f.buy && !(mine && L.home!.owned) ? `<button class="btn btn-soft" data-m="buy">Buy · ${esc(this.d.money(f.buy))}</button>` : ''}
          </div>
          ${mine && !L.home!.owned ? `<p class="fine">Paid for ${left} more day${left === 1 ? '' : 's'}.</p>` : ''}
        </div>`);
      c.querySelectorAll<HTMLButtonElement>('button[data-m]').forEach((b) => b.onclick = () => {
        if (!choose(f.id, b.dataset.m === 'buy')) { this.kit.play('fail'); this.kit.toast('purse', 'Not enough credits', 'Landlords take credits, not promises. Take a gig or two first.'); return; }
        this.kit.close();
      });
      menu.appendChild(c);
    }
    body.appendChild(menu);
    body.appendChild(h('p', 'fine', L.home && !flats.some((f) => f.id === L.home!.id) ? 'Taking a flat here gives up the one you have now.' : 'A week is seven city days. A home has a bed, a kitchen and your wardrobe.'));
    p.appendChild(body);
  }

  // ------------------------------------------------------------------ the life panel
  lifePanel(o: { tab?: string; stats: { label: string; value: string }[]; secrets: { name: string; text: string; found: boolean }[]; homeName: string | null; runner: GigRunner; quit: () => void }): void {
    const p = this.kit.panel('panel n-life');
    const L = this.d.life();
    this.kit.head(p, esc(L.name || 'You'), '', `Day ${L.day} in Halcyon${o.homeName ? ` · home: ${esc(o.homeName)}` : ' · no fixed address'}`, icon('chat'));
    const tabs = h('div', 'n-tabs', ['me', 'wardrobe', 'work', 'secrets'].map((t) => `<button data-t="${t}">${t === 'me' ? 'You' : t[0].toUpperCase() + t.slice(1)}</button>`).join(''));
    const body = h('div', 'panel-body');
    p.appendChild(tabs);
    p.appendChild(body);
    let tab = o.tab ?? 'me';
    const draw = () => {
      tabs.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.classList.toggle('on', b.dataset.t === tab));
      const L2 = this.d.life();
      if (tab === 'me') {
        body.innerHTML = `<div class="n-bars">${(['health', 'hunger', 'sleep'] as const).map((k) => `<div class="vit v-${k}"><span class="nb-l">${k[0].toUpperCase() + k.slice(1)}</span><span class="vb"><span class="vf" style="width:${L2[k].toFixed(0)}%"></span></span><b>${L2[k].toFixed(0)}</b></div>`).join('')}</div>
          <div class="n-stats">${o.stats.map((s) => `<div><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>
          <p class="fine">Eat to stay fed, sleep in a bed to stay sharp. If you let either run out, your health drains and you will wake up at the clinic.</p>`;
      } else if (tab === 'wardrobe') {
        const owned = GARMENTS.filter((x) => L2.owned.includes(x.id));
        body.innerHTML = owned.length ? '' : '<p class="n-empty">Your wardrobe is empty. The boutiques round the city sell streetwear, tailoring, techwear and thrift.</p>';
        const slots = [...new Set(owned.map((x) => x.slot))] as Slot[];
        for (const sl of slots) {
          body.insertAdjacentHTML('beforeend', `<h4 class="n-h">${esc(SLOT_NAME[sl])}</h4>`);
          const grid = h('div', 'n-grid small');
          for (const x of owned.filter((y) => y.slot === sl)) {
            const worn = L2.outfit[sl] === x.id;
            const c = h('button', 'n-chip' + (worn ? ' on' : ''), `<i style="--a:${hex(x.sw[0])};--b:${hex(x.sw[1])}"></i>${esc(x.name)}`);
            c.onclick = () => { this.kit.play('click'); if (worn) takeOff(L2, sl); else wear(L2, x.id); this.d.dressed(); this.d.saved(); draw(); };
            grid.appendChild(c);
          }
          body.appendChild(grid);
        }
      } else if (tab === 'work') {
        const g = o.runner.gig;
        const jobs = Object.entries(L2.shifts);
        body.innerHTML = `${g ? `<div class="n-active"><b>On the clock: ${esc(g.title)}</b><span>Stop ${g.at + 1} of ${g.stops.length} · ${esc(g.stops[g.at].name)}</span><button class="btn btn-soft" id="n-quit">Drop this gig</button></div>` : '<p class="n-empty">No gig right now. Every GigHub has a board of courier runs, kitchen shifts, dock work and data jobs.</p>'}
          <div class="n-stats">${jobs.map(([k, n]) => `<div><b>${n}</b><span>${esc(JOB_NAME[k as keyof typeof JOB_NAME]?.name ?? k)}</span></div>`).join('')}<div><b>${esc(this.d.money(L2.earned))}</b><span>Earned in all</span></div></div>`;
        const q = body.querySelector<HTMLButtonElement>('#n-quit');
        if (q) q.onclick = () => { this.kit.play('click'); o.quit(); draw(); };
      } else {
        body.innerHTML = `<div class="n-secrets">${o.secrets.map((s) => `<div class="${s.found ? 'found' : ''}"><b>${s.found ? esc(s.name) : 'Undiscovered'}</b><span>${esc(s.found ? s.text : s.text.replace(/./g, (c) => (c === ' ' ? ' ' : '·')).slice(0, 48))}</span></div>`).join('')}</div>`;
      }
    };
    tabs.querySelectorAll<HTMLButtonElement>('button').forEach((b) => b.onclick = () => { this.kit.play('click'); tab = b.dataset.t!; draw(); });
    draw();
  }

  // ------------------------------------------------------------------ data jack minigame
  /** Three bands sweep up and down; stop each inside its window. done(score 0..3), or -1 when abandoned. */
  tune(done: (score: number) => void): void {
    const p = this.kit.panel('panel n-tune', () => { alive = false; done(-1); });
    this.kit.head(p, 'Data jack', '', 'Stop each band inside the lit window', icon('signal'), () => { alive = false; done(-1); });
    const body = h('div', 'panel-body');
    const bands = [0, 1, 2].map((i) => ({ w0: 0.15 + Math.random() * 0.55, w: 0.2 - i * 0.04, v: 0, sp: 0.9 + i * 0.45 + Math.random() * 0.3, dir: 1, locked: false, hit: false }));
    body.innerHTML = `<div class="tn">${bands.map((b, i) => `<div class="tn-band" data-i="${i}"><i class="tn-win" style="left:${b.w0 * 100}%;width:${b.w * 100}%"></i><i class="tn-cur"></i></div>`).join('')}</div><button class="btn btn-red tn-go">Lock band 1</button>`;
    p.appendChild(body);
    const els = [...body.querySelectorAll<HTMLElement>('.tn-band')];
    const go = body.querySelector<HTMLButtonElement>('.tn-go')!;
    let cur = 0, alive = true, last = performance.now();
    const step = (now: number) => {
      if (!alive || !p.isConnected) return;
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      bands.forEach((b, i) => {
        if (b.locked) return;
        b.v += b.dir * b.sp * dt;
        if (b.v > 1) { b.v = 1; b.dir = -1; } else if (b.v < 0) { b.v = 0; b.dir = 1; }
        (els[i].querySelector('.tn-cur') as HTMLElement).style.left = `${b.v * 100}%`;
      });
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    const lock = () => {
      const b = bands[cur];
      b.locked = true;
      b.hit = b.v >= b.w0 - 0.01 && b.v <= b.w0 + b.w + 0.01;
      els[cur].classList.add(b.hit ? 'hit' : 'miss');
      this.kit.play(b.hit ? 'pop' : 'fail');
      cur++;
      if (cur < bands.length) { go.textContent = `Lock band ${cur + 1}`; return; }
      alive = false;
      go.disabled = true;
      const score = bands.filter((x) => x.hit).length;
      go.textContent = score === 3 ? 'Signal locked' : score ? 'Signal weak' : 'No signal';
      setTimeout(() => { this.kit.close(); done(score); }, 900);
    };
    go.onclick = lock;
    const key = (e: KeyboardEvent) => { if (!p.isConnected) { removeEventListener('keydown', key); return; } if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); if (alive) lock(); } };
    addEventListener('keydown', key, true);
  }
}

/** The small card under the vitals while a gig is running. */
export class GigChip {
  private el: HTMLElement;
  constructor(host: HTMLElement, onClick: () => void) {
    this.el = h('button', 'glass gigchip hidden');
    this.el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.el.onclick = (e) => { e.stopPropagation(); onClick(); };
    host.appendChild(this.el);
  }
  set(runner: GigRunner): void {
    const g = runner.gig;
    this.el.classList.toggle('hidden', !g);
    if (!g) return;
    const c = runner.clock;
    const s = g.stops[g.at];
    const t = c === null ? '' : `<em class="${c < 20 ? 'late' : ''}">${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}</em>`;
    const html = `<i>${icon(JOB_NAME[g.kind].icon)}</i><span><b>${esc(s.name)}</b><small>${esc(g.title)} · ${g.at + 1}/${g.stops.length}</small></span>${t}`;
    if (this.el.innerHTML !== html) this.el.innerHTML = html;
  }
}
