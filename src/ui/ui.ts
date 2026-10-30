import type { SaveState } from '../game/state';
import type { Audio } from '../game/audio';
import type { FoodId } from '../world/food';
import type { StallInfo } from '../data/stalls';
import { DISHES, DISH } from '../data/dishes';
import { STALL } from '../data/stalls';
import { MISSIONS, ITEMS, Mission } from '../data/missions';
import { PATCH_NOTES } from '../data/patchNotes';
import { CookingGame } from './cooking';

const $ = (id: string) => document.getElementById(id)!;
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const yen = (n: number) => `¥${n.toLocaleString('en-US')}`;

const MISSION_ICONS: Record<string, string> = {
  'first-bite': '🥢', trio: '🍡', sweet: '🍯', apprentice: '👩‍🍳', alley: '🏮', night: '🌙', cats: '🐱', secret: '🚪', stars: '⭐', master: '🏆',
};
/** Items that can be worn by the traveller. */
export const WEARABLE = ['headband', 'happi', 'charm', 'chefhat'];

/** What the UI asks of the game. */
export interface GameHooks {
  /** Pay for a dish and record the stamp. Returns false when the player cannot afford it. */
  buy(dish: FoodId, stall: StallInfo): boolean;
  /** A cooking challenge finished with 1..3 stars. Returns the tip earned. */
  cooked(dish: FoodId, stall: StallInfo, stars: number): number;
  claim(m: Mission): void;
  wearChanged(): void;
  settingsChanged(): void;
  reset(): void;
  panel(open: boolean): void;
  travel(): void;
}

interface Label { el: HTMLElement; pos: [number, number, number]; visible: boolean; until?: number; }

export class UI {
  icons: Record<string, string> = {};
  private hud = $('hud');
  private promptEl = $('prompt');
  private labelsEl = $('labels');
  private toasts = $('toasts');
  private root = $('panel-root');
  private titleEl = $('title');
  private locName!: HTMLElement;
  private locJp!: HTMLElement;
  private clockEl!: HTMLElement;
  private yenEl!: HTMLElement;
  private trackerEl!: HTMLElement;
  private ppDot!: HTMLElement;
  private labels = new Map<string, Label>();
  private cooking: CookingGame | null = null;
  private dialogueEl: HTMLElement | null = null;
  private promptKey = '';
  private lastZone = '';
  onPrompt: (() => void) | null = null;
  onRotate: ((dir: number) => void) | null = null;
  onZoom: ((f: number) => void) | null = null;
  open: string | null = null;

  constructor(private s: SaveState, private audio: Audio, private hooks: GameHooks) {
    this.buildHud();
    this.promptEl.addEventListener('pointerdown', (e) => { e.stopPropagation(); this.onPrompt?.(); });
  }

  setState(s: SaveState): void { this.s = s; this.refresh(); }

  // ------------------------------------------------------------------ loading + title
  loading(f: number, stage: string): void {
    ($('load-fill') as HTMLElement).style.width = `${Math.max(3, Math.min(100, f * 100)).toFixed(1)}%`;
    $('load-stage').textContent = stage;
  }
  loaded(): void { $('loading').classList.add('done'); }
  loadError(msg: string): void {
    $('load-stage').innerHTML = `${esc(msg)}<br><small>Try reloading the page.</small>`;
  }

  title(onStart: () => void): void {
    const t = this.titleEl;
    const hasSave = Object.keys(this.s.tasted).length > 0 || this.s.playTime > 30;
    t.innerHTML = `
      <div class="title-top">
        <h1 class="title-logo">Tasty World</h1>
        <div class="title-jp">東京 · 屋台めぐり</div>
        <div class="title-tag">A street food adventure · First stop, Tokyo</div>
      </div>
      <div class="title-actions">
        <button class="btn-hero" id="t-start">${hasSave ? 'Continue journey' : 'Start your journey'}</button>
        <button class="btn-ghost" id="t-notes">What's new in v${PATCH_NOTES[0].version}</button>
        <div class="title-hint">${matchMedia('(pointer: coarse)').matches ? 'Tap to walk · Drag to move · Pinch to zoom' : 'Click or WASD to walk · Q/E rotate · Scroll to zoom'}</div>
      </div>`;
    t.classList.remove('hidden');
    $('t-start').onclick = () => { this.audio.start(); this.audio.play('chime'); t.classList.add('hidden'); onStart(); };
    $('t-notes').onclick = () => { this.audio.start(); this.notes(); };
  }

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-tl">
        <div class="chip loc"><div class="loc-city">Tokyo · 東京 <span class="clock" id="h-clock">16:36</span></div><div class="loc-name" id="h-loc">Temple Plaza</div><div class="loc-jp" id="h-jp"></div></div>
        <div class="chip tracker" id="h-track"></div>
      </div>
      <div class="hud-tr">
        <div class="chip yen"><span class="coin">¥</span><span id="h-yen">3,000</span></div>
        <button class="chip icon-btn" id="h-pass" title="Food Passport (P)">📕<span class="dot hidden" id="h-dot"></span></button>
        <button class="chip icon-btn" id="h-map" title="World map (M)">🗺️</button>
        <button class="chip icon-btn" id="h-set" title="Settings">⚙️</button>
      </div>
      <div class="hud-bl"><div class="chip keys"><b>WASD</b> walk · <b>Q</b><b>E</b> rotate · <b>Space</b> interact · <b>P</b> passport</div></div>
      <div class="hud-br">
        <button class="chip icon-btn" id="h-rl" title="Rotate (Q)">⟲</button>
        <button class="chip icon-btn" id="h-rr" title="Rotate (E)">⟳</button>
      </div>`;
    this.locName = $('h-loc'); this.locJp = $('h-jp'); this.clockEl = $('h-clock');
    this.yenEl = $('h-yen'); this.trackerEl = $('h-track'); this.ppDot = $('h-dot');
    const tap = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); this.audio.play('click'); fn(); });
    tap('h-pass', () => this.passport());
    tap('h-map', () => this.map());
    tap('h-set', () => this.settings());
    tap('h-rl', () => this.onRotate?.(-1));
    tap('h-rr', () => this.onRotate?.(1));
    for (const el of this.hud.querySelectorAll('button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.refresh();
  }

  showHud(on: boolean): void { this.hud.classList.toggle('hidden', !on); }

  location(name: string, jp: string, clock: string): void {
    if (name !== this.lastZone) {
      this.lastZone = name;
      this.locName.textContent = name;
      this.locJp.textContent = jp;
    }
    if (this.clockEl.textContent !== clock) this.clockEl.textContent = clock;
  }

  /** Re-render yen, the mission tracker and the passport notification dot. */
  refresh(): void {
    this.yenEl.textContent = this.s.yen.toLocaleString('en-US');
    const open = MISSIONS.filter((m) => !this.s.claimed.includes(m.id));
    const claimable = open.some((m) => { const [a, b] = m.progress(this.s); return a >= b; });
    this.ppDot.classList.toggle('hidden', !claimable);
    const show = open.filter((m) => m.id !== 'secret' || this.s.hiddenFound).slice(0, 3);
    this.trackerEl.innerHTML = `<h4>Missions</h4>` + (show.length ? show.map((m) => {
      const [a, b] = m.progress(this.s);
      const done = a >= b;
      return `<div class="m"><span class="bar"><i style="width:${Math.min(100, (a / b) * 100)}%"></i></span><span>${done ? '✅ ' : ''}${esc(m.name)}${done ? ' · claim!' : ` <small style="opacity:.6">${a}/${b}</small>`}</span></div>`;
    }).join('') : `<div class="m">Tokyo complete! 🎉</div>`);
    this.trackerEl.onclick = () => this.passport('missions');
  }

  // ------------------------------------------------------------------ prompt, toasts, labels
  prompt(key: string, icon: string, text: string, sub = ''): void {
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (!key) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.innerHTML = `<span class="pk">${icon}</span><span class="pt">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><kbd>Space</kbd>`;
    this.promptEl.classList.remove('hidden');
    // restart the pop animation
    this.promptEl.style.animation = 'none';
    void this.promptEl.offsetWidth;
    this.promptEl.style.animation = '';
  }

  toast(icon: string, title: string, text: string, gold = false): void {
    const t = h('div', 'toast' + (gold ? ' gold' : ''));
    const ic = icon.startsWith('data:') ? `<img src="${icon}" alt="">` : icon;
    t.innerHTML = `<span class="ti">${ic}</span><span><b>${esc(title)}</b>${esc(text)}</span>`;
    this.toasts.appendChild(t);
    while (this.toasts.children.length > 3) this.toasts.firstElementChild!.remove();
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 450); }, gold ? 4200 : 3000);
  }

  label(key: string, html: string, cls: string, pos: [number, number, number]): HTMLElement {
    let l = this.labels.get(key);
    if (!l) {
      const el = h('div', cls);
      this.labelsEl.appendChild(el);
      l = { el, pos, visible: true };
      this.labels.set(key, l);
    }
    l.el.className = cls;
    l.el.innerHTML = html;
    l.pos = pos;
    l.until = undefined;
    return l.el;
  }

  bubble(key: string, text: string, pos: [number, number, number], seconds = 3.2): void {
    this.label(key, esc(text), 'bubble', pos);
    this.labels.get(key)!.until = performance.now() + seconds * 1000;
  }

  removeLabel(key: string): void {
    const l = this.labels.get(key);
    if (l) { l.el.remove(); this.labels.delete(key); }
  }

  setLabelPos(key: string, x: number, y: number, z: number): void {
    const l = this.labels.get(key);
    if (l) { l.pos[0] = x; l.pos[1] = y; l.pos[2] = z; }
  }

  /** Position labels: project returns screen pixels or null when off screen; fade by distance. */
  updateLabels(project: (p: [number, number, number]) => [number, number] | null, near: (p: [number, number, number]) => number): void {
    const now = performance.now();
    for (const [key, l] of this.labels) {
      if (l.until && now > l.until) { this.removeLabel(key); continue; }
      const sp = project(l.pos);
      const show = !!sp && !this.open;
      if (show !== l.visible) { l.el.style.display = show ? '' : 'none'; l.visible = show; }
      if (!sp || !show) continue;
      l.el.style.left = `${sp[0].toFixed(1)}px`;
      l.el.style.top = `${sp[1].toFixed(1)}px`;
      if (l.el.classList.contains('plate')) l.el.style.opacity = String(near(l.pos));
    }
  }

  tapRing(x: number, y: number): void {
    const r = h('div', 'tap-ring');
    r.style.left = x + 'px';
    r.style.top = y + 'px';
    this.labelsEl.appendChild(r);
    setTimeout(() => r.remove(), 650);
  }

  // ------------------------------------------------------------------ panels
  private panel(cls = 'panel', onClose?: () => void): HTMLElement {
    this.close(false);
    const scrim = h('div', 'scrim');
    const p = h('div', cls);
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) { this.audio.play('click'); onClose?.(); this.close(); } });
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(scrim);
    this.root.appendChild(p);
    this.open = cls;
    this.hooks.panel(true);
    return p;
  }

  private head(p: HTMLElement, title: string, jp = '', sub = '', onClose?: () => void): HTMLElement {
    const hd = h('div', 'panel-head', `<h2>${title}</h2>${jp ? `<div class="jp">${jp}</div>` : ''}${sub ? `<div class="sub">${sub}</div>` : ''}`);
    const c = h('button', 'close', '✕');
    c.onclick = () => { this.audio.play('click'); onClose?.(); this.close(); };
    hd.appendChild(c);
    p.appendChild(hd);
    return hd;
  }

  close(notify = true): void {
    this.cooking?.stop();
    this.cooking = null;
    this.root.innerHTML = '';
    const was = this.open;
    this.open = null;
    if (notify && was) this.hooks.panel(false);
  }

  get busy(): boolean { return !!this.open || !!this.dialogueEl; }

  // stall menu ------------------------------------------------------------------------------
  stall(st: StallInfo): void {
    const p = this.panel();
    this.head(p, st.name, st.jp, `${esc(st.street)} · ${st.hidden ? 'Omakase counter' : 'Street stall'}`);
    const body = h('div', 'panel-body');
    const greet = st.greeting[Math.floor(Math.random() * st.greeting.length)];
    body.innerHTML = `<div class="vendor-line"><span class="who">${esc(st.vendor)}</span><span>“${esc(greet)}”</span></div>`;
    const menu = h('div', 'menu');
    for (const id of st.dishes) {
      const d = DISH[id];
      const got = !!this.s.tasted[id];
      const card = h('div', 'dish-card');
      const canCook = st.recipe.dish === id;
      const stars = this.s.cooked[id] ?? 0;
      card.innerHTML = `
        <div class="dimg">${this.icons[id] ? `<img src="${this.icons[id]}" alt="">` : ''}</div>
        <div>
          <h3>${esc(d.name)} <span class="jp">${d.jp}</span></h3>
          <p>${esc(d.tagline)}</p>
          <div class="row">
            <button class="btn btn-red" data-a="taste">Taste · ${yen(d.price)}</button>
            ${canCook ? `<button class="btn btn-ink" data-a="cook">👩‍🍳 Cook it${stars ? ` · ${'★'.repeat(stars)}` : ''}</button>` : ''}
            ${got ? '<span class="badge">✓ Stamped</span>' : '<span class="badge red">New</span>'}
          </div>
        </div>`;
      card.querySelector<HTMLButtonElement>('[data-a="taste"]')!.onclick = () => {
        if (!this.hooks.buy(id, st)) {
          this.audio.play('fail');
          this.toast('👛', 'Not enough yen', 'Help a vendor cook to earn tips, or finish missions in your passport.');
          return;
        }
        this.taste(id, !got);
      };
      const cookBtn = card.querySelector<HTMLButtonElement>('[data-a="cook"]');
      if (cookBtn) cookBtn.onclick = () => this.cook(st);
      menu.appendChild(card);
    }
    body.appendChild(menu);
    p.appendChild(body);
  }

  private cook(st: StallInfo): void {
    const p = this.panel('panel cook');
    const dish = st.recipe.dish;
    this.cooking = new CookingGame(p, st.recipe, this.audio, this.icons[dish] ?? '', (stars) => {
      this.cooking = null;
      if (stars < 0) { this.stall(st); return; }
      const wasNew = !this.s.tasted[dish];
      const tip = this.hooks.cooked(dish, st, stars);
      this.taste(dish, wasNew, stars, tip);
    });
  }

  // tasting card --------------------------------------------------------------------------
  taste(id: FoodId, isNew: boolean, stars = 0, tip = 0): void {
    const d = DISH[id];
    const p = this.panel();
    const hero = h('div', 'taste-hero', `<div class="rays"></div>${this.icons[id] ? `<img src="${this.icons[id]}" alt="${esc(d.name)}">` : ''}
      <div class="stamp${isNew ? ' new' : ''}"><div><span>${d.jp.slice(0, 2)}</span>TOKYO<br>${isNew ? 'NEW!' : 'TASTED'}</div></div>`);
    p.appendChild(hero);
    const c = h('button', 'close', '✕');
    c.onclick = () => { this.audio.play('click'); this.close(); };
    hero.appendChild(c);
    const hd = h('div', 'panel-head', `<h2>${esc(d.name)}</h2><div class="jp">${d.jp} · ${esc(d.romaji)}</div><div class="sub">${esc(d.tagline)}</div>`);
    p.appendChild(hd);
    const body = h('div', 'panel-body');
    const bar = (label: string, v: number) => `<span>${label}</span><span class="fb"><i style="width:${v * 20}%"></i></span>`;
    body.innerHTML = `
      ${stars ? `<div class="vendor-line"><span class="who">You cooked it!</span><span>${'★'.repeat(stars)}${'☆'.repeat(3 - stars)} · ${STALL[d.stall]?.vendor ?? 'The vendor'} tipped you ${yen(tip)}.</span></div>` : ''}
      <div class="facts">
        <div class="fact"><h4>Origin</h4>${esc(d.origin)}</div>
        <div class="fact"><h4>History</h4>${esc(d.history)}</div>
        <div class="fact"><h4>Ingredients</h4><ul>${d.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
        <div class="fact"><h4>Culture</h4>${esc(d.culture)}</div>
        <div class="fact"><h4>Flavour</h4><div class="flavor">${bar('Sweet', d.flavor.sweet)}${bar('Savoury', d.flavor.savory)}${bar('Umami', d.flavor.umami)}${bar('Crunch', d.flavor.crunch)}</div></div>
        <div class="fact"><h4>Local tip</h4>${esc(d.tip)}</div>
      </div>
      <div style="text-align:center;margin-top:16px"><button class="btn btn-red" id="tk-ok">Itadakimasu! いただきます</button></div>`;
    p.appendChild(body);
    body.querySelector<HTMLButtonElement>('#tk-ok')!.onclick = () => { this.audio.play('click'); this.close(); };
    if (isNew) setTimeout(() => this.audio.play('stamp'), 520);
  }

  // passport ------------------------------------------------------------------------------
  passport(tab: 'stamps' | 'missions' | 'items' | 'tokyo' = 'stamps'): void {
    const p = this.panel('panel passport');
    const got = Object.keys(this.s.tasted).length;
    this.head(p, 'Food Passport', '日本 · JAPAN', `${got} / ${DISHES.length} stamps${this.s.title ? ` · ${esc(this.s.title)}` : ''}`);
    const tabs = h('div', 'pp-tabs');
    const page = h('div', 'pp-page');
    const names: [typeof tab, string][] = [['stamps', '🍡 Stamps'], ['missions', '🎯 Missions'], ['items', '🎒 Items'], ['tokyo', '🗼 Tokyo']];
    const render = (t: typeof tab) => {
      tabs.innerHTML = '';
      for (const [k, n] of names) {
        const b = h('button', 'pp-tab' + (k === t ? ' on' : ''), n);
        b.onclick = () => { this.audio.play('click'); render(k); };
        tabs.appendChild(b);
      }
      page.innerHTML = '';
      if (t === 'stamps') this.ppStamps(page);
      else if (t === 'missions') this.ppMissions(page, () => render('missions'));
      else if (t === 'items') this.ppItems(page);
      else this.ppTokyo(page);
    };
    p.appendChild(tabs);
    p.appendChild(page);
    render(tab);
  }

  private ppStamps(page: HTMLElement) {
    const got = Object.keys(this.s.tasted).length;
    page.innerHTML = `<div class="pp-cover"><div class="pp-flag"><i></i></div><div><b style="font-family:var(--display);font-size:20px">Tokyo · 東京</b><div style="font-size:13px;color:var(--ink-soft)">Collect a stamp for every dish you taste or cook.</div><div class="pp-progress"><i style="width:${(got / DISHES.length) * 100}%"></i></div></div></div>`;
    const grid = h('div', 'stamps');
    for (const d of DISHES) {
      const has = !!this.s.tasted[d.id];
      const st = STALL[d.stall];
      const hidden = st?.hidden && !this.s.hiddenFound;
      const stars = this.s.cooked[d.id] ?? 0;
      const slot = h('div', 'slot' + (has ? ' got' : ' locked'), `
        ${stars ? `<span class="stars">${'★'.repeat(stars)}</span>` : ''}
        ${has ? `<span class="ss">${d.jp.slice(0, 1)}</span>` : ''}
        ${this.icons[d.id] ? `<img src="${this.icons[d.id]}" alt="">` : ''}
        <div class="sn">${has ? esc(d.name) : hidden ? '???' : esc(d.name)}<br><small style="font-weight:400;color:var(--ink-soft)">${has ? d.jp : hidden ? 'A secret counter' : esc(st?.name ?? '')}</small></div>`);
      slot.onclick = () => {
        this.audio.play('click');
        if (has) this.taste(d.id, false);
        else this.toast('🧭', hidden ? 'A secret dish' : `Find it at ${st?.name ?? 'a stall'}`, hidden ? 'Some say the lucky cats know the way.' : `${st?.street ?? 'Somewhere in Tokyo'}.`);
      };
      grid.appendChild(slot);
    }
    page.appendChild(grid);
  }

  private ppMissions(page: HTMLElement, rerender: () => void) {
    for (const m of MISSIONS) {
      const [a, b] = m.progress(this.s);
      const claimed = this.s.claimed.includes(m.id);
      const done = a >= b;
      const secret = m.id === 'secret' && !this.s.hiddenFound && !done;
      const rw = [m.reward.yen ? yen(m.reward.yen) : '', m.reward.item ? `${ITEMS[m.reward.item].icon} ${ITEMS[m.reward.item].name}` : '', m.reward.title ? `“${m.reward.title}”` : ''].filter(Boolean).join('<br>');
      const row = h('div', 'mission' + (claimed ? ' done' : ''), `
        <div class="mi">${claimed ? '✅' : MISSION_ICONS[m.id] ?? '🎯'}</div>
        <div><h5>${secret ? '???' : esc(m.name)}</h5><p>${secret ? 'Somewhere in this district hides a counter with no sign.' : esc(m.desc)} <b>${Math.min(a, b)}/${b}</b></p></div>
        <div class="rw"></div>`);
      const rwEl = row.querySelector('.rw')!;
      if (done && !claimed) {
        const btn = h('button', 'btn btn-red', 'Claim');
        btn.onclick = () => { this.hooks.claim(m); rerender(); };
        rwEl.appendChild(btn);
      } else rwEl.innerHTML = claimed ? 'Claimed' : rw;
      page.appendChild(row);
    }
  }

  private ppItems(page: HTMLElement) {
    if (!this.s.items.length) {
      page.innerHTML = `<p style="text-align:center;color:var(--ink-soft);margin-top:60px">Your bag is empty.<br>Complete missions to earn souvenirs for your traveller.</p>`;
      return;
    }
    const grid = h('div', 'items');
    for (const id of this.s.items) {
      const it = ITEMS[id];
      if (!it) continue;
      const card = h('div', 'item', `<div class="ii">${it.icon}</div><h5>${esc(it.name)}</h5><div>${esc(it.desc)}</div>`);
      if (WEARABLE.includes(id)) {
        const sw = h('label', 'switch', `<input type="checkbox" ${this.s.wear[id] ? 'checked' : ''}> Wear it`);
        sw.querySelector('input')!.onchange = (e) => {
          this.s.wear[id] = (e.target as HTMLInputElement).checked;
          this.audio.play('pop');
          this.hooks.wearChanged();
        };
        card.appendChild(sw);
      }
      grid.appendChild(card);
    }
    page.appendChild(grid);
  }

  private ppTokyo(page: HTMLElement) {
    page.innerHTML = `
      <div class="fact" style="margin-bottom:10px"><h4>Tokyo · 東京</h4>Once the fishing village of Edo, Tokyo became the shogun's capital in 1603 and grew into the largest city on Earth. Its food culture was born on the street: sushi, tempura and soba all started as quick snacks sold from stalls to busy workers.</div>
      <div class="fact" style="margin-bottom:10px"><h4>Yatai &amp; yokochō</h4>Yatai are portable food carts that appear at dusk. Yokochō are narrow alleys packed with tiny counters, many dating from the post-war markets of the 1940s.</div>
      <div class="fact" style="margin-bottom:10px"><h4>Etiquette</h4><ul><li>Say “itadakimasu” before eating and “gochisōsama” after.</li><li>Eat near the stall instead of walking with your food.</li><li>Slurping noodles is a compliment to the cook.</li><li>No tipping in real Tokyo! Here, vendors reward your help in the kitchen.</li></ul></div>
      <div class="fact"><h4>Words to know</h4><ul><li><b>Irasshaimase</b>: welcome!</li><li><b>Oishii</b>: delicious</li><li><b>Omakase</b>: “I leave it to you”, the chef's choice</li><li><b>Kanpai</b>: cheers</li></ul></div>`;
  }

  // world map -----------------------------------------------------------------------------
  map(): void {
    const p = this.panel();
    this.head(p, 'World Map', '世界地図', 'Every passport you complete opens a new destination.');
    const wrap = h('div', 'map-wrap');
    const dests = [
      { flag: '🇯🇵', name: 'Japan · Tokyo', desc: 'Kaminari Lane, Lantern Alley, Sakura Canal', here: true, x: 84, y: 40 },
      { flag: '🇰🇷', name: 'South Korea · Seoul', desc: 'Tteokbokki, hotteok and night markets', x: 80, y: 40 },
      { flag: '🇮🇹', name: 'Italy · Naples', desc: 'Pizza fritta, sfogliatella, cuoppo', x: 51, y: 36 },
      { flag: '🇵🇹', name: 'Portugal · Lisbon', desc: 'Pastéis de nata, bifanas, sardines', x: 45, y: 37 },
      { flag: '🇹🇷', name: 'Türkiye · Istanbul', desc: 'Simit, balık ekmek, döner', x: 57, y: 36 },
      { flag: '🇲🇽', name: 'Mexico · Mexico City', desc: 'Tacos al pastor, elotes, tamales', x: 20, y: 46 },
    ];
    const dots = dests.map((d) => `<circle cx="${d.x}%" cy="${d.y}%" r="${d.here ? 6 : 4}" fill="${d.here ? '#ff6a4a' : '#f2d88a'}" opacity="${d.here ? 1 : 0.55}">${d.here ? '<animate attributeName="r" values="5;8;5" dur="1.6s" repeatCount="indefinite"/>' : ''}</circle>`).join('');
    wrap.innerHTML = `<div class="globe"><svg viewBox="0 0 100 60" preserveAspectRatio="none">
      <g fill="rgba(255,255,255,0.13)">
        <path d="M8 16 Q18 8 30 12 Q34 20 28 28 Q24 36 20 48 Q16 40 12 30 Q6 24 8 16Z"/>
        <path d="M26 50 Q32 48 34 56 Q30 60 28 58Z"/>
        <path d="M44 14 Q52 10 60 14 Q58 22 52 24 Q46 26 44 20Z"/>
        <path d="M46 28 Q56 26 58 36 Q56 48 50 52 Q46 44 46 36Z"/>
        <path d="M60 12 Q76 8 90 14 Q92 24 84 28 Q76 32 70 30 Q62 26 60 18Z"/>
        <path d="M78 44 Q86 42 90 48 Q86 52 80 50Z"/>
      </g>
      <path d="M84 40 Q66 18 51 36 M84 40 Q52 4 20 46" stroke="rgba(242,216,138,0.35)" stroke-width="0.4" fill="none" stroke-dasharray="1 1"/>
      ${dots}</svg></div>`;
    const list = h('div', 'tickets');
    const complete = Object.keys(this.s.tasted).length >= DISHES.length;
    for (const d of dests) {
      const t = h('div', 'ticket' + (d.here ? '' : ' locked'), `<div class="flag">${d.flag}</div><div><h4>${d.name}</h4><p>${d.desc}</p></div><div class="go">${d.here ? 'You are here' : complete && d.name.startsWith('South') ? 'Next stop!' : 'Coming soon'}</div>`);
      t.onclick = () => {
        this.audio.play('click');
        if (d.here) this.close();
        else this.toast(d.flag, `${d.name.split(' · ')[1]} is coming soon`, complete ? 'Your Tokyo passport is complete. Stay tuned, traveller!' : 'Fill your Tokyo passport while you wait.');
      };
      list.appendChild(t);
    }
    wrap.appendChild(list);
    p.appendChild(wrap);
  }

  // settings + notes ----------------------------------------------------------------------
  settings(): void {
    const p = this.panel();
    this.head(p, 'Settings', '設定');
    const body = h('div', 'panel-body');
    const st = this.s.settings;
    const seg = (label: string, opts: [string, string][], cur: string, set: (v: string) => void) => {
      const row = h('div', 'set-row', `<span>${label}</span>`);
      const sg = h('div', 'seg');
      for (const [v, n] of opts) {
        const b = h('button', v === cur ? 'on' : '', n);
        b.onclick = () => {
          this.audio.play('click');
          set(v);
          [...sg.children].forEach((c) => c.classList.remove('on'));
          b.classList.add('on');
          this.hooks.settingsChanged();
        };
        sg.appendChild(b);
      }
      row.appendChild(sg);
      body.appendChild(row);
    };
    seg('Graphics', [['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.quality, (v) => { st.quality = v as typeof st.quality; });
    seg('Music', [['1', 'On'], ['0', 'Off']], st.music ? '1' : '0', (v) => { st.music = v === '1'; });
    seg('Sound', [['1', 'On'], ['0', 'Off']], st.sfx ? '1' : '0', (v) => { st.sfx = v === '1'; });
    seg('Miniature focus', [['1', 'On'], ['0', 'Off']], st.tilt ? '1' : '0', (v) => { st.tilt = v === '1'; });
    seg('Day length', [['360', '6 min'], ['720', '12 min'], ['1440', '24 min']], String(st.dayLength), (v) => { st.dayLength = Number(v); });
    const row = h('div', 'set-row', `<span>What's new</span>`);
    const nb = h('button', 'btn btn-soft', `v${PATCH_NOTES[0].version} notes`);
    nb.onclick = () => { this.audio.play('click'); this.notes(); };
    row.appendChild(nb);
    body.appendChild(row);
    const rrow = h('div', 'set-row', `<span>Reset progress</span>`);
    const rb = h('button', 'btn btn-soft', 'Reset');
    let armed = false;
    rb.onclick = () => {
      this.audio.play('click');
      if (!armed) { armed = true; rb.textContent = 'Tap again to erase'; rb.className = 'btn btn-red'; return; }
      this.hooks.reset();
      this.close();
    };
    rrow.appendChild(rb);
    body.appendChild(rrow);
    body.appendChild(h('p', '', `<small style="color:var(--ink-soft)">Tasty World v${PATCH_NOTES[0].version} · Progress is saved on this device.</small>`));
    p.appendChild(body);
  }

  notes(): void {
    const p = this.panel();
    this.head(p, 'Patch notes', 'お知らせ', 'What changed in Tasty World.');
    const body = h('div', 'panel-body notes');
    body.innerHTML = PATCH_NOTES.map((n) => `<h3>v${n.version} · ${esc(n.title)}</h3><div class="nd">${n.date}</div><ul>${n.items.map((i) => `<li>${esc(i)}</li>`).join('')}</ul>`).join('');
    p.appendChild(body);
  }

  // dialogue ------------------------------------------------------------------------------
  dialogue(name: string, lines: string[], onDone?: () => void): void {
    this.endDialogue();
    const el = h('div', 'dialogue', `<div class="dn">${esc(name)}</div><div class="dt"></div><div class="dm"></div>`);
    this.root.appendChild(el);
    this.dialogueEl = el;
    this.hooks.panel(true);
    const dt = el.querySelector('.dt') as HTMLElement, dm = el.querySelector('.dm') as HTMLElement;
    let i = 0, ch = 0, timer = 0;
    const show = () => {
      ch = 0;
      dm.textContent = i < lines.length - 1 ? 'Tap to continue ▸' : 'Tap to close';
      clearInterval(timer);
      timer = window.setInterval(() => {
        ch += 2;
        dt.textContent = lines[i].slice(0, ch);
        if (ch >= lines[i].length) clearInterval(timer);
      }, 18);
    };
    const advance = () => {
      if (ch < lines[i].length) { ch = lines[i].length; clearInterval(timer); dt.textContent = lines[i]; return; }
      i++;
      if (i >= lines.length) { clearInterval(timer); this.endDialogue(); onDone?.(); return; }
      this.audio.play('click');
      show();
    };
    el.addEventListener('pointerdown', (e) => { e.stopPropagation(); advance(); });
    (el as HTMLElement & { advance?: () => void }).advance = advance;
    show();
  }

  /** Space/Enter while a dialogue is open advances it. Returns true if handled. */
  advanceDialogue(): boolean {
    const el = this.dialogueEl as (HTMLElement & { advance?: () => void }) | null;
    if (!el) return false;
    el.advance?.();
    return true;
  }

  endDialogue(): void {
    if (!this.dialogueEl) return;
    this.dialogueEl.remove();
    this.dialogueEl = null;
    if (!this.open) this.hooks.panel(false);
  }
}
