import type { SaveState, TripLog } from '../game/state';
import type { Destination, Home } from '../data/destinations';
import { DISHES, DISH } from '../data/dishes';
import { TEXT } from '../data/cityText';
import { CITY } from '../world/cityId';
import { G } from './glyphs';
import { FLAGS } from './emblems';

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Where this trip started from: taken when the traveller lands in a city, cleared when they leave it. */
export function tripLog(s: SaveState): TripLog {
  return { city: CITY, t0: s.playTime, tasted: { ...s.tasted }, photos: s.photos, yen: s.yen, rooms: s.rooms.length };
}

export interface TripSummary {
  /** Seconds spent in the city on this trip. */
  time: number;
  /** Plates and cups had on this trip. */
  eaten: number;
  /** Dishes had on this trip, newest stamps first. */
  dishes: string[];
  /** Dishes tasted for the very first time on this trip. */
  fresh: Set<string>;
  photos: number;
  places: number;
  /** Money spent (negative when tips earned more than the food cost). */
  spent: number;
  /** This city's passport page: stamps got and stamps there are. */
  got: number;
  total: number;
}

export function summarise(s: SaveState): TripSummary {
  const t = s.trip?.city === CITY ? s.trip : tripLog(s);
  const dishes: string[] = [], fresh = new Set<string>();
  let eaten = 0;
  for (const [id, n] of Object.entries(s.tasted)) {
    const before = t.tasted[id] ?? 0;
    if (n <= before || !DISH[id as keyof typeof DISH]) continue;
    eaten += n - before;
    dishes.push(id);
    if (!before) fresh.add(id);
  }
  dishes.sort((a, b) => Number(fresh.has(b)) - Number(fresh.has(a)));
  return {
    time: Math.max(0, s.playTime - t.t0), eaten, dishes, fresh,
    photos: Math.max(0, s.photos - t.photos), places: Math.max(0, s.rooms.length - t.rooms), spent: t.yen - s.yen,
    got: DISHES.filter((d) => s.tasted[d.id]).length, total: DISHES.length,
  };
}

const span = (sec: number) => {
  const m = Math.round(sec / 60);
  return m < 60 ? `${Math.max(1, m)} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};

export interface EndTripOpts {
  here: Destination;
  home: Home;
  sum: TripSummary;
  /** Dish pictures by id (rendered with the voxel shader). */
  pics: Record<string, string>;
  /** Friends on this trip, if it is a co-op one. */
  crew: number;
  click(): void;
  homeward(): void;
  onward(): void;
  stay(): void;
}

/**
 * The end-of-trip boarding pass: what the trip came to (time, plates, new stamps, photos, places), the stamps as a
 * stub, and the two ways out: fly home to the menu, or fly on to another city. Nothing ends until a plane leaves.
 */
export function endTripCard(o: EndTripOpts): HTMLElement {
  const { here, home, sum } = o;
  const wrap = h('div', 'bp-wrap endtrip-wrap');
  const bp = h('div', 'bpass endtrip');
  const pct = sum.total ? Math.round((sum.got / sum.total) * 100) : 0;
  const shown = sum.dishes.slice(0, 8), more = sum.dishes.length - shown.length;
  const stamps = shown.length
    ? `<div class="et-stamps">${shown.map((id, i) => {
        const d = DISH[id as keyof typeof DISH];
        const pic = o.pics[id];
        return `<span class="et-stamp${sum.fresh.has(id) ? ' fresh' : ''}" style="--r:${((i * 37) % 13) - 6}deg;--d:${(0.35 + i * 0.07).toFixed(2)}s" title="${esc(d.name)}">${pic ? `<img src="${pic}" alt="">` : G.bowl}${sum.fresh.has(id) ? '<em>New</em>' : ''}</span>`;
      }).join('')}${more > 0 ? `<span class="et-stamp more">+${more}</span>` : ''}</div>`
    : `<div class="et-empty">${G.bowl}<span><b>No plates yet</b>One last bite before the airport?</span></div>`;
  const money = sum.spent > 0 ? `<div class="bp-field"><small>Spent</small><b>${TEXT.money(sum.spent)}</b></div>`
    : sum.spent < 0 ? `<div class="bp-field"><small>Tips earned</small><b>${TEXT.money(-sum.spent)}</b></div>` : '';
  bp.innerHTML = `
    <div class="bp-main">
      <div class="bp-band"><span class="bp-air">${G.plane}Tasty Air</span><span>Trip summary</span></div>
      <div class="bp-route">
        <div class="bp-city"><small>From</small><b>${here.code}</b><span>${esc(here.city)} ${FLAGS[here.id] ?? ''}</span></div>
        <div class="bp-line"><i></i>${G.plane}<i></i></div>
        <div class="bp-city to"><small>To</small><b class="q" id="et-to">???</b><span id="et-to-city">Your call</span></div>
      </div>
      <div class="bp-grid et-grid">
        <div class="bp-field"><small>Time here</small><b>${span(sum.time)}</b></div>
        <div class="bp-field"><small>Plates</small><b>${sum.eaten}</b></div>
        <div class="bp-field"><small>Photos</small><b>${sum.photos}</b></div>
        ${money || `<div class="bp-field"><small>Places</small><b>${sum.places}</b></div>`}
      </div>
      <div class="et-book">
        <div class="et-book-top"><small>${esc(here.city)} passport</small><b>${sum.got} / ${sum.total} stamps</b></div>
        <div class="et-bar"><i style="--p:${pct}%"></i></div>
        <p>${sum.got >= sum.total ? `Every stamp in ${esc(here.city)}. The page is full.` : sum.fresh.size ? `${sum.fresh.size} new stamp${sum.fresh.size > 1 ? 's' : ''} on this trip. ${sum.total - sum.got} still waiting for next time.` : `${sum.total - sum.got} stamps still waiting here for next time.`}</p>
      </div>
    </div>
    <div class="bp-stub et-stub">
      <small>Tasted this trip</small>
      ${stamps}
      <div class="barcode" aria-hidden="true"></div>
    </div>
    <div class="bp-actions et-actions">
      <div class="et-choices">
        <button class="mode et-home" data-a="home">
          <span class="mi">${G.home}</span>
          <span class="mt"><b>Fly home</b><small>Back to ${esc(home.city)} and the menu</small></span>
          <span class="mgo">${G.arrow}</span>
        </button>
        <button class="mode coop et-on" data-a="onward">
          <span class="mi">${G.globe}</span>
          <span class="mt"><b>Somewhere new</b><small>Pick the next city on the globe</small></span>
          <span class="mgo">${G.arrow}</span>
        </button>
      </div>
      ${o.crew ? `<p class="cta-note et-note">${G.people}You'll leave the co-op trip. Your friend${o.crew > 1 ? 's' : ''} can stay and keep exploring ${esc(here.city)}.</p>` : ''}
      <p class="et-saved">${G.check}Your passport, wallet and wardrobe are saved and travel with you</p>
      <button class="btn btn-link" data-a="stay">Keep exploring ${esc(here.city)}</button>
    </div>`;
  wrap.appendChild(bp);

  // the "To" field follows the choice under the pointer or focus
  const to = bp.querySelector('#et-to') as HTMLElement, toCity = bp.querySelector('#et-to-city') as HTMLElement;
  const aim = (a: string | null) => {
    to.classList.toggle('q', !a);
    to.textContent = a === 'home' ? home.code : '???';
    toCity.textContent = a === 'home' ? home.city : a === 'onward' ? 'Anywhere' : 'Your call';
    bp.classList.toggle('aim-home', a === 'home');
    bp.classList.toggle('aim-on', a === 'onward');
  };
  for (const b of bp.querySelectorAll<HTMLElement>('.et-choices .mode')) {
    const a = b.dataset.a!;
    b.addEventListener('pointerenter', () => aim(a));
    b.addEventListener('focus', () => aim(a));
    b.addEventListener('pointerleave', () => aim(null));
    b.addEventListener('blur', () => aim(null));
  }
  let gone = false;
  bp.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest<HTMLElement>('[data-a]')?.dataset.a;
    if (!a || gone) return;
    o.click();
    if (a === 'stay') { o.stay(); return; }
    gone = true;
    aim(a);
    bp.classList.add('leaving');
    if (a === 'home') o.homeward(); else o.onward();
  });
  // a tap outside the pass keeps exploring
  wrap.addEventListener('click', (e) => { if (e.target === wrap && !gone) { o.click(); o.stay(); } });
  return wrap;
}
