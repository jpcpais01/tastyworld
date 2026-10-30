import { SaveState, viewMetres, VIEW_DEFAULT } from '../game/state';
import type { Audio } from '../game/audio';
import type { FoodId } from '../world/food';
import type { StallInfo } from '../data/stalls';
import { DISHES, DISH } from '../data/dishes';
import { STALL } from '../data/stalls';
import { MISSIONS, ITEMS, Mission, trackedMission } from '../data/missions';
import { PATCH_NOTES } from '../data/patchNotes';
import { CAPSULES, Buyable } from '../data/places';
import { CookingGame } from './cooking';
import { G } from './glyphs';

const $ = (id: string) => document.getElementById(id)!;
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const yen = (n: number) => `¥${n.toLocaleString('en-US')}`;
const stars = (n: number, of = 3) => G.star.repeat(n) + (of > n ? `<span class="off">${G.star.repeat(of - n)}</span>` : '');
const touch = () => matchMedia('(pointer: coarse)').matches;
const firstSentence = (t: string) => (t.match(/^.*?[.!?](\s|$)/)?.[0] ?? t).trim();
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;

/** A few words on how a dish tastes, from its flavour profile. */
function tasteNotes(f: { sweet: number; savory: number; umami: number; crunch: number }): string[] {
  const words: Record<string, [string, string, string]> = {
    sweet: ['Lightly sweet', 'Sweet', 'Very sweet'],
    savory: ['A little savoury', 'Savoury', 'Deeply savoury'],
    umami: ['Umami', 'Rich umami', 'Umami bomb'],
    crunch: ['A bit of crunch', 'Crunchy', 'Shatteringly crisp'],
  };
  const out = (Object.entries(f) as [keyof typeof words, number][])
    .filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([k, v]) => words[k][Math.min(2, v - 3)]);
  if (f.crunch <= 1 && out.length < 3) out.push(f.sweet >= 3 ? 'Soft and fluffy' : 'Silky');
  return out;
}

const MISSION_ICONS: Record<string, string> = {
  'first-bite': '🥢', trio: '🍡', sweet: '🍯', apprentice: '👩‍🍳', alley: '🏮', night: '🌙', cats: '🐱', secret: '🚪', stars: '⭐', master: '🏆',
  browse: '🛍️', tables: '🍽️', gacha: '🎰', 'gacha-all': '👑', shelf: '📚', daruma: '🔴',
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
}

interface Label { el: HTMLElement; pos: [number, number, number]; visible: boolean; until?: number; }

/** A noren curtain: one fabric panel per character of the shop's name (two when it is long). */
function noren(jp: string, secret = false): HTMLElement {
  const chars = [...(jp.split(' ').pop() ?? '')];
  const per = chars.length > 5 ? 2 : 1;
  const words: string[] = [];
  for (let i = 0; i < chars.length; i += per) words.push(chars.slice(i, i + per).join(''));
  const n = Math.max(3, Math.min(5, words.length));
  const pad = Math.floor((n - words.length) / 2);
  const panels = Array.from({ length: n }, (_, i) => `<span>${words[i - pad] ?? ''}</span>`).join('');
  return h('div', 'noren' + (secret ? ' secret' : ''), `<i class="rod"></i><div class="cloth">${panels}</div>`);
}

/** An on/off switch button. */
function toggle(on: boolean, set: (v: boolean) => void, label = ''): HTMLElement {
  const wrap = h('label', 'toggle', label ? `<span>${label}</span>` : '');
  const sw = h('button', 'sw');
  sw.setAttribute('role', 'switch');
  sw.setAttribute('aria-checked', String(on));
  sw.onclick = (e) => {
    e.preventDefault();
    on = !on;
    sw.setAttribute('aria-checked', String(on));
    set(on);
  };
  wrap.appendChild(sw);
  return wrap;
}

/** A volume slider (0..1); reports while dragging and once more on release. */
function slider(v: number, set: (v: number, done: boolean) => void): HTMLElement {
  const r = document.createElement('input');
  r.type = 'range'; r.min = '0'; r.max = '100'; r.step = '1';
  r.value = String(Math.round(v * 100));
  r.className = 'vol';
  const paint = () => r.style.setProperty('--p', `${r.value}%`);
  paint();
  r.oninput = () => { paint(); set(Number(r.value) / 100, false); };
  r.onchange = () => set(Number(r.value) / 100, true);
  return r;
}

export class UI {
  icons: Record<string, string> = {};
  private hud = $('hud');
  private promptEl = $('prompt');
  private labelsEl = $('labels');
  private toasts = $('toasts');
  private root = $('panel-root');
  private locName!: HTMLElement;
  private clockEl!: HTMLElement;
  private todEl!: HTMLElement;
  private yenEl!: HTMLElement;
  private yenChip!: HTMLElement;
  private trackerEl!: HTMLElement;
  private ppDot!: HTMLElement;
  private labels = new Map<string, Label>();
  private cooking: CookingGame | null = null;
  private dialogueEl: HTMLElement | null = null;
  private promptKey = '';
  private lastZone = '';
  private lastTod = '';
  private lastYen = -1;
  private keysTimer = 0;
  onPrompt: (() => void) | null = null;
  onRotate: ((dir: number) => void) | null = null;
  onZoom: ((f: number) => void) | null = null;
  onView: (() => void) | null = null;
  onMap: (() => void) | null = null;
  onParty: (() => void) | null = null;
  onWave: (() => void) | null = null;
  open: string | null = null;
  private closeHook: (() => void) | null = null;
  private partyEl!: HTMLElement;
  private savourEl: HTMLElement | null = null;

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

  // ------------------------------------------------------------------ HUD
  private buildHud() {
    this.hud.innerHTML = `
      <div class="hud-tl">
        <div class="glass place">
          <div class="tod" id="h-tod">${G.sun}</div>
          <div class="place-name" id="h-loc">Temple Plaza</div>
          <span class="clock" id="h-clock">16:36</span>
        </div>
        <button class="glass party hidden" id="h-party" aria-label="Your co-op trip"></button>
        <button class="glass quest" id="h-track" aria-label="Missions"></button>
      </div>
      <div class="hud-tr">
        <div class="glass bar">
          <div class="yen" id="h-yenchip" title="Your yen"><span class="coin">¥</span><span id="h-yen">3,000</span></div>
          <span class="sep"></span>
          <button id="h-pass" title="Food Passport (P)" aria-label="Food Passport">${G.passport}<span class="dot hidden" id="h-dot"></span></button>
          <button id="h-map" title="City map (M)" aria-label="City map">${G.map}</button>
          <button id="h-set" title="Settings" aria-label="Settings">${G.gear}</button>
        </div>
        <button class="glass compass" id="h-compass" title="City map (M)" aria-label="Compass, opens the city map">
          <span class="dial"><span class="rose"><b>N</b><i></i></span><span class="aim"></span></span><span class="dist"></span>
        </button>
      </div>
      <div class="hud-bl">
        <div class="controls" id="h-keys">
          <button class="glass kb" id="h-kb" title="Controls" aria-label="Show controls">${G.keyboard}</button>
          <div class="glass keys"><span><kbd>WASD</kbd> walk</span><span><kbd>Shift</kbd> run</span><span><kbd>Space</kbd> interact</span><span><b><kbd>Q</kbd><kbd>E</kbd></b> rotate</span><span><kbd>V</kbd> view</span><span><kbd>P</kbd> passport</span><span><kbd>M</kbd> map</span></div>
        </div>
      </div>
      <div class="hud-br">
        <div class="glass bar">
          <button id="h-wave" class="hidden" title="Wave (G)" aria-label="Wave to your friends">${G.wave}</button>
          <button id="h-view" title="First-person view (V)" aria-label="First-person view" aria-pressed="false">${G.eye}</button>
          <button id="h-rl" title="Rotate left (Q)" aria-label="Rotate left">${G.rotL}</button>
          <button id="h-rr" title="Rotate right (E)" aria-label="Rotate right">${G.rotR}</button>
        </div>
      </div>
      <div class="xhair" aria-hidden="true"></div>`;
    this.locName = $('h-loc'); this.clockEl = $('h-clock'); this.todEl = $('h-tod');
    this.yenEl = $('h-yen'); this.yenChip = $('h-yenchip'); this.trackerEl = $('h-track'); this.ppDot = $('h-dot'); this.partyEl = $('h-party');
    const tap = (id: string, fn: () => void) => $(id).addEventListener('click', (e) => { e.stopPropagation(); this.audio.play('click'); fn(); });
    tap('h-pass', () => this.passport());
    tap('h-map', () => this.map());
    tap('h-compass', () => this.map());
    tap('h-party', () => this.onParty?.());
    tap('h-wave', () => this.onWave?.());
    tap('h-set', () => this.settings());
    tap('h-rl', () => this.onRotate?.(-1));
    tap('h-rr', () => this.onRotate?.(1));
    tap('h-view', () => this.onView?.());
    tap('h-track', () => this.passport('missions'));
    tap('h-kb', () => this.showKeys(!$('h-keys').classList.contains('open')));
    for (const el of this.hud.querySelectorAll('button')) el.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.refresh();
  }

  showHud(on: boolean): void {
    this.hud.classList.toggle('hidden', !on);
    // controls show for a moment when the HUD appears, then tuck away
    if (on) { this.showKeys(true); this.keysTimer = window.setTimeout(() => this.showKeys(false), 9000); }
  }

  private showKeys(open: boolean): void {
    clearTimeout(this.keysTimer);
    $('h-keys').classList.toggle('open', open);
  }

  /** The co-op chip: who is on this trip (null hides it). */
  party(code: string, crew: { name: string; color: number; here: boolean }[] | null): void {
    $('h-wave').classList.toggle('hidden', !crew);
    this.partyEl.classList.toggle('hidden', !crew);
    if (!crew) return;
    const n = crew.length;
    this.partyEl.innerHTML = `<span class="avas">${crew.slice(0, 4).map((p) => `<span class="ava${p.here ? '' : ' away'}" style="--c:#${p.color.toString(16).padStart(6, '0')}">${esc(p.name.charAt(0).toUpperCase())}</span>`).join('')}</span>
      <span class="pt"><b>${n > 1 ? `${n} travelling together` : 'Waiting for a friend'}</b><small>${G.ticket}${code}</small></span>`;
  }

  /** The pocket city map (the world map is a button on it). */
  map(): void { this.onMap?.(); }

  private compassKey = '';
  private northA = 0;
  private aimA = 0;
  /**
   * The HUD compass: north and the way to the pinned spot, as clockwise screen angles in radians
   * (null hides the pointer), with the distance left to walk.
   */
  compass(north: number, aim: number | null, dist: string): void {
    // unwrap the angles so the needles turn the short way round
    const near = (a: number, prev: number) => prev + Math.atan2(Math.sin(a - prev), Math.cos(a - prev));
    north = this.northA = near(north, this.northA);
    if (aim !== null) aim = this.aimA = near(aim, this.aimA);
    const key = `${north.toFixed(2)}|${aim === null ? '' : aim.toFixed(2)}|${dist}`;
    if (key === this.compassKey) return;
    this.compassKey = key;
    const el = $('h-compass');
    (el.querySelector('.rose') as HTMLElement).style.transform = `rotate(${north.toFixed(3)}rad)`;
    el.classList.toggle('on', aim !== null);
    el.classList.toggle('here', dist === 'here');
    if (aim !== null) (el.querySelector('.aim') as HTMLElement).style.transform = `rotate(${aim.toFixed(3)}rad)`;
    (el.querySelector('.dist') as HTMLElement).textContent = dist === 'here' ? 'Here!' : dist;
  }

  /** A full-screen layer (the travel map, a boarding pass). onClose runs when it is closed for any reason. */
  overlay(el: HTMLElement, onClose: () => void): void {
    this.close(false);
    this.root.appendChild(el);
    this.open = 'overlay';
    this.closeHook = onClose;
    this.hooks.panel(true);
  }

  /** First-person HUD: crosshair on, view button lit. */
  setFirstPerson(on: boolean): void {
    this.hud.classList.toggle('fp', on);
    const b = $('h-view');
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', String(on));
    b.title = on ? 'Back to the overhead view (V)' : 'First-person view (V)';
  }

  location(name: string, jp: string, clock: string): void {
    if (name !== this.lastZone) {
      this.lastZone = name;
      this.locName.innerHTML = `${esc(name)}${jp ? `<span class="jp">${jp}</span>` : ''}`;
      this.locName.classList.remove('swap');
      void this.locName.offsetWidth;
      this.locName.classList.add('swap');
    }
    if (this.clockEl.textContent !== clock) {
      this.clockEl.textContent = clock;
      const hr = parseInt(clock, 10);
      const tod = hr >= 19 || hr < 5 ? 'night' : hr >= 17 || hr < 7 ? 'dusk' : 'day';
      if (tod !== this.lastTod) {
        this.lastTod = tod;
        this.todEl.className = `tod ${tod}`;
        this.todEl.innerHTML = tod === 'night' ? G.moon : tod === 'dusk' ? G.sunset : G.sun;
      }
    }
  }

  /** Re-render yen, the mission tracker and the passport notification dot. */
  refresh(): void {
    this.yenEl.textContent = this.s.yen.toLocaleString('en-US');
    if (this.lastYen >= 0 && this.s.yen !== this.lastYen) {
      this.yenChip.classList.remove('bump');
      void this.yenChip.offsetWidth;
      this.yenChip.classList.add('bump');
    }
    this.lastYen = this.s.yen;
    // one mission at a time: a reward to claim first, otherwise the one closest to done
    const { next, ready } = trackedMission(this.s);
    this.ppDot.classList.toggle('hidden', !ready.length);
    this.trackerEl.classList.toggle('ready', !!ready.length);
    this.trackerEl.classList.toggle('hidden', !next);
    if (!next) return;
    const [a, b] = next.progress(this.s);
    const extra = ready.length > 1 ? `<span class="more">+${ready.length - 1}</span>` : '';
    this.trackerEl.title = 'Missions (P)';
    this.trackerEl.innerHTML = ready.length
      ? `<span class="ring">${G.sparkle}</span><span class="qt"><em>Reward ready · </em>${esc(next.name)}</span>${extra}`
      : `<span class="ring" style="--p:${Math.round(Math.min(1, a / b) * 100)}"></span><span class="qt">${esc(next.name)}<small>${a}/${b}</small></span>`;
  }

  // ------------------------------------------------------------------ prompt, toasts, labels
  prompt(key: string, icon: string, text: string, sub = ''): void {
    if (key === this.promptKey) return;
    this.promptKey = key;
    if (!key) { this.promptEl.classList.add('hidden'); return; }
    this.promptEl.innerHTML = `<span class="pk">${icon}</span><span class="pt">${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}</span><span class="pgo"><span class="key">SPACE</span><span class="tap">${G.arrow}</span></span>`;
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
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, gold ? 4200 : 3000);
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

  /** Position labels: project returns screen pixels or null when off screen. */
  updateLabels(project: (p: [number, number, number]) => [number, number] | null): void {
    const now = performance.now();
    for (const [key, l] of this.labels) {
      if (l.until && now > l.until) { this.removeLabel(key); continue; }
      const sp = project(l.pos);
      const show = !!sp && !this.open;
      if (show !== l.visible) { l.el.style.display = show ? '' : 'none'; l.visible = show; }
      if (!sp || !show) continue;
      l.el.style.left = `${sp[0].toFixed(1)}px`;
      l.el.style.top = `${sp[1].toFixed(1)}px`;
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
    p.setAttribute('role', 'dialog');
    scrim.addEventListener('pointerdown', (e) => { if (e.target === scrim) { this.audio.play('click'); onClose?.(); this.close(); } });
    p.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.root.appendChild(scrim);
    this.root.appendChild(p);
    this.open = cls;
    this.showKeys(false);
    this.hooks.panel(true);
    return p;
  }

  private closeBtn(onClose?: () => void): HTMLElement {
    const c = h('button', 'close', G.close);
    c.setAttribute('aria-label', 'Close');
    c.onclick = () => { this.audio.play('click'); onClose?.(); this.close(); };
    return c;
  }

  private head(p: HTMLElement, title: string, jp = '', sub = '', icon = '', onClose?: () => void): HTMLElement {
    const hd = h('div', 'panel-head', `${icon ? `<div class="ph-icon">${icon}</div>` : ''}<div><h2>${title}${jp ? `<span class="jp">${jp}</span>` : ''}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}</div>`);
    hd.appendChild(this.closeBtn(onClose));
    p.appendChild(hd);
    return hd;
  }

  close(notify = true): void {
    this.cooking?.stop();
    this.cooking = null;
    this.root.innerHTML = '';
    const hook = this.closeHook;
    this.closeHook = null;
    hook?.();
    const was = this.open;
    this.open = null;
    if (notify && was) this.hooks.panel(false);
  }

  get busy(): boolean { return !!this.open || !!this.dialogueEl; }

  // stall menu ------------------------------------------------------------------------------
  stall(st: StallInfo): void {
    const p = this.panel();
    p.appendChild(noren(st.jp, st.hidden));
    this.head(p, esc(st.name), '', `${esc(st.street)} · ${st.hidden ? 'Omakase counter' : st.restaurant ? 'Restaurant' : 'Street stall'}`);
    const body = h('div', 'panel-body');
    const greet = st.greeting[Math.floor(Math.random() * st.greeting.length)];
    body.innerHTML = `<div class="vendor-line"><span class="ava">${esc(st.vendor.charAt(0))}</span><div class="say"><b>${esc(st.vendor)}</b>“${esc(greet)}”</div></div>`;
    const menu = h('div', 'menu');
    for (const id of st.dishes) {
      const d = DISH[id];
      const got = !!this.s.tasted[id];
      const card = h('div', 'dish-card');
      const canCook = st.recipe.dish === id;
      const cooked = this.s.cooked[id] ?? 0;
      card.innerHTML = `
        <div class="dimg">${this.icons[id] ? `<img src="${this.icons[id]}" alt="">` : ''}${got ? `<span class="badge">${G.check}Stamped</span>` : '<span class="badge red">New</span>'}</div>
        <div>
          <h3>${esc(d.name)}<span class="jp">${d.jp}</span></h3>
          <p>${esc(d.tagline)}</p>
          <div class="row">
            <button class="btn btn-red" data-a="taste">Taste · ${yen(d.price)}</button>
            ${canCook ? `<button class="btn btn-soft" data-a="cook">${G.chef}Cook it${cooked ? ` <span class="stars-sm">${G.star.repeat(cooked)}</span>` : ''}</button>` : ''}
          </div>
        </div>`;
      card.querySelector<HTMLButtonElement>('[data-a="taste"]')!.onclick = () => {
        if (!this.hooks.buy(id, st)) {
          this.audio.play('fail');
          this.toast('👛', 'Not enough yen', 'Help a vendor cook to earn tips, or finish missions in your passport.');
          return;
        }
        // the vendor plates it up and hands it over in the street (see game/meal.ts)
        this.close();
      };
      const cookBtn = card.querySelector<HTMLButtonElement>('[data-a="cook"]');
      if (cookBtn) cookBtn.onclick = () => this.cook(st);
      menu.appendChild(card);
    }
    body.appendChild(menu);
    p.appendChild(body);
  }

  /** Counter of a shop, café or bar: a few small things to buy. */
  shop(name: string, jp: string, sub: string, keeper: string, line: string, items: Buyable[], buy: (it: Buyable) => boolean): void {
    const p = this.panel();
    p.appendChild(noren(jp));
    this.head(p, esc(name), '', esc(sub));
    const body = h('div', 'panel-body');
    body.innerHTML = `<div class="vendor-line"><span class="ava">${esc(keeper.charAt(0))}</span><div class="say"><b>${esc(keeper)}</b>“${esc(line)}”</div></div>`;
    const menu = h('div', 'menu');
    for (const it of items) {
      const card = h('div', 'dish-card', `
        <div class="dimg"><span class="emo">${it.icon}</span></div>
        <div>
          <h3>${esc(it.name)}</h3>
          <p>${esc(it.text)}</p>
          <div class="row"><button class="btn btn-red">Buy · ${yen(it.price)}</button></div>
        </div>`);
      card.querySelector('button')!.onclick = () => {
        if (!buy(it)) { this.audio.play('fail'); this.toast('👛', 'Not enough yen', 'Help a vendor cook to earn tips, or finish missions in your passport.'); return; }
        this.close();
      };
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
      this.hooks.cooked(dish, st, stars);
      this.close();
    });
  }

  // after eating ---------------------------------------------------------------------------
  /**
   * A small card that slides up once the last bite is gone: the stamp, how it tasted and one thing worth knowing.
   * It doesn't stop play and goes away on its own.
   */
  savour(id: FoodId, o: { isNew: boolean; count: number; cooked?: number; tip?: number }): void {
    const d = DISH[id];
    if (!d) return;
    this.savourEl?.remove();
    const lines = [d.tip, firstSentence(d.culture), firstSentence(d.history)];
    const line = lines[(Math.max(1, o.count) - 1) % lines.length];
    const card = h('div', 'savour', `
      <div class="sv-img">${this.icons[id] ? `<img src="${this.icons[id]}" alt="">` : ''}</div>
      <div class="sv-body">
        <div class="sv-eye">${o.isNew ? `${G.sparkle}New stamp` : o.count > 1 ? `Your ${ordinal(o.count)} ${esc(d.name.split(' ').pop()!.toLowerCase())}` : 'Stamped'}</div>
        <h3>${esc(d.name)}<span class="jp">${d.jp}</span></h3>
        <div class="sv-notes">${tasteNotes(d.flavor).map((n) => `<span>${esc(n)}</span>`).join('')}</div>
        ${o.cooked ? `<div class="sv-cook"><span class="stars-sm">${stars(o.cooked)}</span>You made this one. ${esc(STALL[d.stall]?.vendor ?? 'The vendor')} tipped you ${yen(o.tip ?? 0)}.</div>` : ''}
        <p class="sv-line">${esc(line)}</p>
        <div class="sv-foot"><span class="jp">ごちそうさまでした</span><button class="sv-more">The story ${G.book}</button></div>
      </div>
      ${o.isNew ? `<div class="stamp new"><div><span>${d.jp.slice(0, 2)}</span>TOKYO<br>NEW!</div></div>` : ''}`);
    const x = h('button', 'close', G.close);
    x.setAttribute('aria-label', 'Close');
    x.onclick = (e) => { e.stopPropagation(); this.audio.play('click'); dismiss(); };
    card.appendChild(x);
    const dismiss = () => {
      if (!card.isConnected) return;
      card.classList.add('out');
      setTimeout(() => card.remove(), 380);
      if (this.savourEl === card) this.savourEl = null;
    };
    card.querySelector<HTMLButtonElement>('.sv-more')!.onclick = (e) => { e.stopPropagation(); this.audio.play('click'); dismiss(); this.taste(id); };
    card.addEventListener('pointerdown', (e) => e.stopPropagation());
    let left = 9000;
    let last = performance.now();
    const tick = () => {
      if (!card.isConnected) return;
      const now = performance.now();
      if (!card.matches(':hover') && !this.open) left -= now - last;
      last = now;
      if (left <= 0) dismiss(); else setTimeout(tick, 250);
    };
    setTimeout(tick, 250);
    this.savourEl = card;
    this.hud.parentElement!.appendChild(card);
    if (o.isNew) setTimeout(() => this.audio.play('stamp'), 620);
  }

  // dish page (from the passport) ---------------------------------------------------------
  taste(id: FoodId, isNew = false, cooked = 0, tip = 0): void {
    const d = DISH[id];
    const p = this.panel();
    const hero = h('div', 'taste-hero', `<div class="rays"></div>${this.icons[id] ? `<img src="${this.icons[id]}" alt="${esc(d.name)}">` : ''}
      <div class="stamp${isNew ? ' new' : ''}"><div><span>${d.jp.slice(0, 2)}</span>TOKYO<br>${isNew ? 'NEW!' : 'TASTED'}</div></div>`);
    hero.appendChild(this.closeBtn());
    p.appendChild(hero);
    p.appendChild(h('div', 'taste-head', `<div class="eyebrow">${isNew ? 'New stamp' : 'Food passport'}</div><h2>${esc(d.name)}</h2><div class="jp-line"><span class="jp">${d.jp}</span>${esc(d.romaji)}</div><div class="tagline">${esc(d.tagline)}</div>`));
    const body = h('div', 'panel-body');
    const pips = (label: string, v: number) => `<span>${label}</span><span class="pips">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < v ? 'on' : ''}"></i>`).join('')}</span>`;
    body.innerHTML = `
      ${cooked ? `<div class="cooked-note"><span class="stars-big">${stars(cooked)}</span><span>You cooked it! ${esc(STALL[d.stall]?.vendor ?? 'The vendor')} tipped you ${yen(tip)}.</span></div>` : ''}
      <div class="facts">
        <div class="sec fact"><h4>Origin</h4>${esc(d.origin)}</div>
        <div class="sec fact"><h4>Flavour</h4><div class="flavor">${pips('Sweet', d.flavor.sweet)}${pips('Savoury', d.flavor.savory)}${pips('Umami', d.flavor.umami)}${pips('Crunch', d.flavor.crunch)}</div></div>
        <div class="sec fact wide"><h4>History</h4>${esc(d.history)}</div>
        <div class="sec fact"><h4>Ingredients</h4><ul>${d.ingredients.map((i) => `<li>${esc(i)}</li>`).join('')}</ul></div>
        <div class="sec fact"><h4>Culture</h4>${esc(d.culture)}</div>
        <div class="sec fact wide"><h4>Local tip</h4>${esc(d.tip)}</div>
      </div>`;
    p.appendChild(body);
    const foot = h('div', 'taste-foot', `<button class="btn btn-soft btn-hero" id="tk-ok">${G.passport}Back to the passport</button>`);
    p.appendChild(foot);
    foot.querySelector<HTMLButtonElement>('#tk-ok')!.onclick = () => { this.audio.play('click'); this.passport(); };
    if (isNew) setTimeout(() => this.audio.play('stamp'), 520);
  }

  // passport ------------------------------------------------------------------------------
  passport(tab: 'stamps' | 'missions' | 'items' | 'tokyo' = 'stamps'): void {
    const p = this.panel('panel passport');
    const got = Object.keys(this.s.tasted).length;
    this.head(p, 'Food Passport', '日本', `${got} of ${DISHES.length} stamps${this.s.title ? ` · ${esc(this.s.title)}` : ''}`, G.passport);
    const tabs = h('div', 'pp-tabs');
    const seg = h('div', 'seg');
    seg.setAttribute('role', 'tablist');
    tabs.appendChild(seg);
    const page = h('div', 'pp-page');
    const names: [typeof tab, string, string][] = [['stamps', 'Stamps', G.bowl], ['missions', 'Missions', G.target], ['items', 'Bag', G.bag], ['tokyo', 'Tokyo', G.book]];
    const render = (t: typeof tab) => {
      seg.innerHTML = '';
      for (const [k, n, ic] of names) {
        const b = h('button', k === t ? 'on' : '', `${ic}${n}`);
        b.setAttribute('role', 'tab');
        b.setAttribute('aria-selected', String(k === t));
        b.onclick = () => { this.audio.play('click'); render(k); };
        seg.appendChild(b);
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
    page.innerHTML = `<div class="pp-cover"><div class="pp-flag"><i></i></div><div><b>Tokyo <span class="jp" style="font-weight:400;font-size:15px">東京</span></b><p>Collect a stamp for every dish you taste or cook.</p><div class="pbar"><span><i style="width:${(got / DISHES.length) * 100}%"></i></span>${got}/${DISHES.length}</div></div></div>`;
    const grid = h('div', 'stamps');
    for (const d of DISHES) {
      const has = !!this.s.tasted[d.id];
      const st = STALL[d.stall];
      const hidden = st?.hidden && !this.s.hiddenFound;
      const cooked = this.s.cooked[d.id] ?? 0;
      const slot = h('button', 'slot' + (has ? ' got' : ' locked'), `
        ${cooked ? `<span class="stars">${G.star.repeat(cooked)}</span>` : ''}
        ${has ? `<span class="ss">${d.jp.slice(0, 1)}</span>` : `<span class="lk">${hidden ? G.lock : ''}</span>`}
        ${this.icons[d.id] ? `<img src="${this.icons[d.id]}" alt="">` : ''}
        <div class="sn">${hidden && !has ? '???' : esc(d.name)}<small>${has ? d.jp : hidden ? 'A secret counter' : esc(st?.name ?? '')}</small></div>`);
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
    // ready to claim first, then in progress, then claimed
    const rank = (m: Mission) => { const [a, b] = m.progress(this.s); return this.s.claimed.includes(m.id) ? 2 : a >= b ? 0 : 1; };
    for (const m of [...MISSIONS].sort((x, y) => rank(x) - rank(y))) {
      const [a, b] = m.progress(this.s);
      const claimed = this.s.claimed.includes(m.id);
      const done = a >= b;
      const secret = m.id === 'secret' && !this.s.hiddenFound && !done;
      const rw = [m.reward.yen ? yen(m.reward.yen) : '', m.reward.item ? `${ITEMS[m.reward.item].icon} ${ITEMS[m.reward.item].name}` : '', m.reward.title ? `“${m.reward.title}”` : ''].filter(Boolean).join('<br>');
      const row = h('div', 'mission' + (claimed ? ' done' : done ? ' ready' : ''), `
        <div class="mi">${claimed ? G.check : MISSION_ICONS[m.id] ?? '🎯'}</div>
        <div><h5>${secret ? '???' : esc(m.name)}</h5><p>${secret ? 'Somewhere in this district hides a counter with no sign.' : esc(m.desc)}</p>
          ${claimed ? '' : `<div class="mbar"><span><i style="width:${Math.min(100, (a / b) * 100)}%"></i></span>${Math.min(a, b)}/${b}</div>`}</div>
        <div class="rw"></div>`);
      const rwEl = row.querySelector('.rw')!;
      if (done && !claimed) {
        const btn = h('button', 'btn btn-red', 'Claim');
        btn.onclick = () => { this.hooks.claim(m); rerender(); };
        rwEl.appendChild(btn);
      } else rwEl.innerHTML = claimed ? `<span class="claimed">${G.check}Claimed</span>` : rw;
      page.appendChild(row);
    }
  }

  private ppItems(page: HTMLElement) {
    // little finds first: daruma and gachapon capsules
    const caps = h('div', 'sec finds', `<h4>Finds</h4><p>🔴 Daruma found: <b>${this.s.darumas.length}/8</b> · 🎰 Capsule charms: <b>${this.s.capsules.length}/${CAPSULES.length}</b></p>`);
    const grid = h('div', 'capsules');
    for (const c of CAPSULES) {
      const got = this.s.capsules.includes(c.id);
      grid.appendChild(h('div', 'cap' + (got ? ' got' : '') + (c.rare ? ' rare' : ''), `<span>${got ? c.icon : '?'}</span><small>${got ? esc(c.name) : c.rare ? 'Rare' : '???'}</small>`));
    }
    caps.appendChild(grid);
    page.appendChild(caps);
    if (!this.s.items.length) {
      page.appendChild(h('div', 'empty', `<div class="ei">${G.bag}</div>Your bag is empty.<br>Complete missions to earn souvenirs for your traveller.`));
      return;
    }
    const items = h('div', 'items');
    for (const id of this.s.items) {
      const it = ITEMS[id];
      if (!it) continue;
      const card = h('div', 'item', `<div class="ii">${it.icon}</div><h5>${esc(it.name)}</h5><div>${esc(it.desc)}</div>`);
      if (WEARABLE.includes(id)) {
        card.appendChild(toggle(!!this.s.wear[id], (v) => {
          this.s.wear[id] = v;
          this.audio.play('pop');
          this.hooks.wearChanged();
        }, 'Wear it'));
      }
      items.appendChild(card);
    }
    page.appendChild(items);
  }

  private ppTokyo(page: HTMLElement) {
    page.innerHTML = `
      <div class="sec fact"><h4>Tokyo · 東京</h4>Once the fishing village of Edo, Tokyo became the shogun's capital in 1603 and grew into the largest city on Earth. Its food culture was born on the street: sushi, tempura and soba all started as quick snacks sold from stalls to busy workers.</div>
      <div class="sec fact"><h4>Yatai &amp; yokochō</h4>Yatai are portable food carts that appear at dusk. Yokochō are narrow alleys packed with tiny counters, many dating from the post-war markets of the 1940s.</div>
      <div class="sec fact"><h4>Etiquette</h4><ul><li>Say “itadakimasu” before eating and “gochisōsama” after.</li><li>Eat near the stall instead of walking with your food.</li><li>Slurping noodles is a compliment to the cook.</li><li>No tipping in real Tokyo! Here, vendors reward your help in the kitchen.</li></ul></div>
      <div class="sec fact"><h4>Words to know</h4><div class="words"><b>Irasshaimase</b><span>Welcome!</span><b>Oishii</b><span>Delicious</span><b>Omakase</b><span>“I leave it to you”, the chef's choice</span><b>Kanpai</b><span>Cheers</span></div></div>`;
  }

  // settings + notes ----------------------------------------------------------------------
  settings(): void {
    const p = this.panel();
    this.head(p, 'Settings', '設定', '', G.gear);
    const body = h('div', 'panel-body');
    const st = this.s.settings;
    const group = (name: string) => {
      body.appendChild(h('div', 'eyebrow set-label', name));
      const g = h('div', 'set-group');
      body.appendChild(g);
      return g;
    };
    const row = (g: HTMLElement, icon: string, label: string, ctl: HTMLElement) => {
      const r = h('div', 'set-row', `<span class="sl">${icon}${label}</span>`);
      r.appendChild(ctl);
      g.appendChild(r);
    };
    const seg = (opts: [string, string][], cur: string, set: (v: string) => void) => {
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
      return sg;
    };
    const sw = (on: boolean, set: (v: boolean) => void) => toggle(on, (v) => { set(v); this.audio.play('click'); this.hooks.settingsChanged(); });
    const look = group('Look');
    row(look, G.monitor, 'Graphics', seg([['auto', 'Auto'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High']], st.quality, (v) => { st.quality = v as typeof st.quality; }));
    row(look, G.eye, 'Miniature focus', sw(st.tilt, (v) => { st.tilt = v; }));
    row(look, G.clock, 'Day length', seg([['360', '6 min'], ['720', '12 min'], ['1440', '24 min']], String(st.dayLength), (v) => { st.dayLength = Number(v); }));
    // sliders that show their value next to the label while dragging and apply on release
    const ranged = (icon: string, label: string, v0: number, text: (v: number) => string, put: (v: number) => void) => {
      const val = h('span', 'set-val', text(v0));
      const ctl = slider(v0, (v, done) => {
        val.textContent = text(v);
        if (!done) return;
        put(v);
        this.hooks.settingsChanged();
        this.audio.play('click');
      });
      row(look, icon, label, ctl);
      look.lastElementChild!.querySelector('.sl')!.appendChild(val);
    };
    const tier = st.quality === 'auto' ? (matchMedia('(pointer: coarse)').matches ? 'medium' : 'high') : st.quality;
    ranged(G.map, 'View distance', st.viewDist ?? VIEW_DEFAULT[tier], (v) => `${viewMetres(v)} m`, (v) => { st.viewDist = v; });
    const fovOf = (v: number) => Math.round(50 + v * 50);
    ranged(G.eye, 'First-person FOV', (st.fov - 50) / 50, (v) => `${fovOf(v)}°`, (v) => { st.fov = fovOf(v); });
    const sound = group('Sound');
    const vol = (get: () => number, put: (v: number) => void) => slider(get(), (v, done) => {
      put(v);
      this.audio.setVolumes(st.musicVol, st.ambVol, st.sfxVol); // live while dragging; saved on release
      if (!done) return;
      this.hooks.settingsChanged();
      this.audio.play('click');
    });
    row(sound, G.music, 'Music', vol(() => st.musicVol, (v) => { st.musicVol = v; }));
    row(sound, G.wind, 'Ambience', vol(() => st.ambVol, (v) => { st.ambVol = v; }));
    row(sound, G.speaker, 'Effects', vol(() => st.sfxVol, (v) => { st.sfxVol = v; }));
    const more = group('More');
    const nb = h('button', 'btn btn-soft', `v${PATCH_NOTES[0].version} notes`);
    nb.onclick = () => { this.audio.play('click'); this.notes(); };
    row(more, G.sparkle, "What's new", nb);
    const rb = h('button', 'btn btn-soft', 'Reset');
    let armed = false;
    rb.onclick = () => {
      this.audio.play('click');
      if (!armed) { armed = true; rb.textContent = 'Tap again to erase'; rb.className = 'btn btn-red'; return; }
      this.hooks.reset();
      this.close();
    };
    row(more, G.trash, 'Reset progress', rb);
    body.appendChild(h('p', 'set-foot', `Tasty World v${PATCH_NOTES[0].version} · Progress is saved on this device.`));
    p.appendChild(body);
  }

  notes(): void {
    const p = this.panel();
    this.head(p, 'Patch notes', 'お知らせ', 'What changed in Tasty World.', G.sparkle);
    const body = h('div', 'panel-body notes');
    body.innerHTML = PATCH_NOTES.map((n, i) => `<div class="note"><div class="nh"><span class="badge${i ? ' gold' : ' red'}">v${n.version}</span><h3>${esc(n.title)}</h3></div><div class="nd">${n.date}</div><ul>${n.items.map((it) => `<li>${esc(it)}</li>`).join('')}</ul></div>`).join('');
    p.appendChild(body);
  }

  // dialogue ------------------------------------------------------------------------------
  dialogue(name: string, lines: string[], onDone?: () => void): void {
    this.endDialogue();
    const el = h('div', 'dialogue', `<div class="dn">${esc(name)}</div><div class="dt"></div><div class="dm"><span class="pips"></span><span class="more"></span></div>`);
    this.root.appendChild(el);
    this.dialogueEl = el;
    this.showKeys(false);
    this.hooks.panel(true);
    const dt = el.querySelector('.dt') as HTMLElement, more = el.querySelector('.more') as HTMLElement, pips = el.querySelector('.pips') as HTMLElement;
    let i = 0, ch = 0, timer = 0;
    const show = () => {
      ch = 0;
      const tapWord = touch() ? 'Tap' : 'Click or Space';
      more.innerHTML = i < lines.length - 1 ? `${tapWord} to continue ${G.arrow}` : `${tapWord} to close`;
      pips.innerHTML = lines.length > 1 ? lines.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('') : '';
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
