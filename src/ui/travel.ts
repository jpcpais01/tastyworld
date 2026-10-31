import type { SaveState } from '../game/state';
import type { Audio } from '../game/audio';
import type { Coop, Peer, Profile } from '../net/coop';
import { DESTINATIONS, DEST, Destination, homeCity, Home } from '../data/destinations';
import { TEXT } from '../data/cityText';
import { saveNow } from '../game/state';
import { CITY, isCity, goToCity, takeResume } from '../world/cityId';
import { DISHES } from '../data/dishes';
import { PATCH_NOTES } from '../data/patchNotes';
import { WorldMap } from './worldmap';
import { G } from './glyphs';

type LatLon = { lat: number; lon: number };
import { FLAGS, icon } from './emblems';
import { arrivalVeil } from './arrival';

const $ = (id: string) => document.getElementById(id)!;
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const touch = () => matchMedia('(pointer: coarse)').matches;
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const D2R = Math.PI / 180;

/** Great-circle distance in km. */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const c = Math.sin(a.lat * D2R) * Math.sin(b.lat * D2R) + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.cos((b.lon - a.lon) * D2R);
  return Math.acos(Math.max(-1, Math.min(1, c))) * 6371;
}

/** Local time somewhere, and whether the sun is up there (roughly). */
function localTime(tz: string): { text: string; day: boolean } {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).formatToParts(new Date());
    const hh = Number(parts.find((p) => p.type === 'hour')?.value ?? 12), mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return { text: `${String(hh).padStart(2, '0')}:${mm}`, day: hh >= 6 && hh < 19 };
  } catch { return { text: '', day: true }; }
}

/** Cap and jacket colours a traveller can pick for co-op trips. */
export const COLORS = [0xe9573f, 0xf4b63f, 0x4f9a6a, 0x3f6fc0, 0xe07aa8, 0x2bb3b1];

/** solo / coop: from the home menu. view: the world map in game. onward: the end of a trip, on to another city. */
export type MapMode = 'solo' | 'coop' | 'view' | 'onward';

/** What the travel screens ask of the game. */
export interface TravelHooks {
  save(): void;
  /** Start the trip (from the home menu, or flying on from the end of one). */
  board(dest: Destination, coop: Coop | null): void;
  /** The plane home has landed: end the trip and show the home menu. */
  home(): void;
  /** The hour on the clock in the city when the plane lands. */
  arrivalHour(): number;
  /** The map covers the whole screen: the 3D view can rest. */
  cover(on: boolean): void;
  notes(): void;
  /** In game: the trip currently shared with friends, if any. */
  coop(): Coop | null;
  /** In game: a friend can now join this trip. */
  attach(coop: Coop): void;
  /** In game: stop sharing the trip. */
  leave(): void;
  /** Show a full-screen layer above everything; onClose runs when it goes away for any reason. */
  overlay(el: HTMLElement, onClose: () => void): void;
  close(): void;
  toast(icon: string, title: string, text: string): void;
}

/** The home menu, the travel map, plane tickets and the boarding gate. */
export class Travel {
  readonly home: Home = homeCity();
  private map: WorldMap | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  /** A co-op trip set up at the gate but not boarded yet. */
  private pending: Coop | null = null;

  constructor(private s: SaveState, private audio: Audio, private hooks: TravelHooks) {}

  private profile(): Profile {
    return { name: this.s.profile.name.trim() || 'Traveller', color: this.s.profile.color, wear: Object.keys(this.s.wear).filter((k) => this.s.wear[k]) };
  }

  // ------------------------------------------------------------------ home menu
  title(): void {
    const t = $('title');
    const got = Object.keys(this.s.tasted).length;
    const hasSave = got > 0 || this.s.playTime > 30;
    t.innerHTML = `
      <div class="title-top">
        <h1 class="title-logo">Tasty<span class="w2">World</span><span class="title-sticker">${esc(TEXT.sticker)}</span></h1>
        <div class="title-tag">${hasSave ? `Welcome back, traveller · ${got} / ${DISHES.length} stamps` : 'Travel the world through its street food'}</div>
      </div>
      <div class="title-card">
        <div class="modes">
          <button class="mode solo" id="t-solo">
            <span class="mi">${G.backpack}</span>
            <span class="mt"><b>Solo trip</b><small>${hasSave ? 'Pick up where you left off' : 'Wander at your own pace'}</small></span>
            <span class="mgo">${G.arrow}</span>
          </button>
          <button class="mode coop" id="t-coop">
            <span class="mi">${G.people}</span>
            <span class="mt"><b>Co-op trip <span class="new">New</span></b><small>Explore together with a friend</small></span>
            <span class="mgo">${G.arrow}</span>
          </button>
        </div>
        <div class="title-row">
          <button class="btn btn-ghost" id="t-join">${G.ticket}Got a ticket?</button>
          <button class="btn btn-ghost" id="t-notes">${G.sparkle}What's new · v${PATCH_NOTES[0].version}</button>
        </div>
        <div class="title-hint">${touch() ? '<b>Tap</b> to walk · <b>Double-tap</b> to run · <b>Drag</b> to look · <b>Pinch</b> to zoom' : '<b>Click</b> or <b>WASD</b> to walk · <b>Q</b>/<b>E</b> to rotate · <b>Scroll</b> to zoom'}</div>
      </div>`;
    t.classList.remove('hidden');
    const go = (fn: () => void) => () => { this.audio.start(); this.audio.play('click'); fn(); };
    $('t-solo').onclick = go(() => this.openMap('solo'));
    $('t-coop').onclick = go(() => this.openMap('coop'));
    $('t-join').onclick = go(() => this.join());
    $('t-notes').onclick = go(() => this.hooks.notes());
    // after flying in from another city: carry on with what was started there
    const resume = takeResume();
    if (resume && 'host' in resume && DEST[resume.host]) {
      const d = DEST[resume.host];
      this.openMap('coop', (trip) => void this.hostPass(trip, d));
      return;
    }
    if (resume && 'board' in resume && DEST[resume.board]) {
      // the flight already landed on the page before: straight into the streets
      t.classList.add('hidden');
      this.hooks.board(DEST[resume.board], null);
      return;
    }
    if (resume && 'ticket' in resume) { this.join(resume.ticket); return; }
    // a shared link carries the ticket: go straight to check-in
    const params = new URLSearchParams(location.search);
    const code = params.get('ticket');
    if (code) {
      params.delete('ticket');
      const q = params.toString();
      history.replaceState(null, '', location.pathname + (q ? `?${q}` : '') + location.hash);
      this.join(code);
    }
  }

  // ------------------------------------------------------------------ map
  openMap(mode: MapMode, then?: (trip: HTMLElement) => void): void {
    const trip = h('div', `trip ${mode}`);
    const map = new WorldMap(trip);
    this.map = map;
    const onward = mode === 'onward';
    const here = mode === 'view' ? DEST[this.hooks.coop()?.dest ?? CITY] ?? DEST[CITY] : onward ? DEST[CITY] : null;
    // onward flights leave from the city the trip ends in, every other one from home
    const origin: LatLon & { city: string; code: string } = onward && here ? here : this.home;
    const label = mode === 'solo' ? 'Solo trip' : mode === 'coop' ? 'Co-op trip' : onward ? 'Next stop' : 'World map';
    const top = h('div', 'trip-top', `
      <button class="round-btn" data-a="back" aria-label="${mode === 'view' ? 'Close map' : onward ? `Stay in ${esc(origin.city)}` : 'Back to the menu'}">${mode === 'view' ? G.close : G.back}</button>
      <div class="trip-title"><div class="eyebrow">${label}</div><h2>${mode === 'view' ? 'Where in the world' : onward ? 'Where next?' : 'Where to?'}</h2></div>
      <div class="trip-from">${onward ? G.depart : G.home}<span>Flying from <b>${esc(origin.city)}</b></span></div>`);
    const sheet = h('div', 'trip-sheet');
    trip.append(top, sheet);
    let sel: Destination = (onward ? DESTINATIONS.find((d) => d.open && d.id !== CITY) : null) ?? here ?? DEST[CITY] ?? DEST.tokyo;

    // pins
    const pins = new Map<string, HTMLElement>();
    const homePin = h('div', 'pin home', `<span class="pin-tag">${G.home}${esc(this.home.city)}</span><span class="pin-dot"></span>`);
    map.addPin(homePin, this.home);
    for (const d of DESTINATIONS) {
      const p = h('button', `pin ${d.open ? 'open' : 'soon'}`, `<span class="pin-tag"><span class="fl">${FLAGS[d.id] ?? ''}</span><span class="nm">${esc(d.city)}</span>${d.open ? '' : '<em>Soon</em>'}</span><span class="pin-dot"></span>`);
      p.setAttribute('aria-label', `${d.city}${d.open ? '' : ', coming soon'}`);
      p.dataset.place = d.id;
      p.onclick = () => { this.audio.play('click'); select(d); };
      pins.set(d.id, p);
      map.addPin(p, d);
    }

    // the sheet: destination picker, details, the big button
    const strip = h('div', 'dest-strip');
    for (const d of DESTINATIONS) {
      const c = h('button', `dchip${d.open ? '' : ' soon'}`, `<span class="fl">${FLAGS[d.id] ?? ''}</span>${esc(d.city)}`);
      c.dataset.id = d.id;
      c.onclick = () => { this.audio.play('click'); select(d); };
      strip.appendChild(c);
    }
    const card = h('div', 'dest-card');
    const cta = h('div', 'trip-cta');
    sheet.append(strip, card, cta);

    const select = (d: Destination, snap = false) => {
      sel = d;
      for (const [id, p] of pins) p.classList.toggle('sel', id === d.id);
      for (const c of strip.children) c.classList.toggle('on', (c as HTMLElement).dataset.id === d.id);
      strip.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: snap ? 'auto' : 'smooth' });
      const isHere = here?.id === d.id;
      const dist = km(origin, d), lt = localTime(d.tz);
      const hrs = dist / 850 + 0.6, dur = `${Math.floor(hrs)}h ${String(Math.round((hrs % 1) * 60 / 5) * 5).padStart(2, '0')}m`;
      const leg = isHere ? '' : dist < 150
        ? `<span class="dc-leg">${G.plane}<b>A lap over the city</b></span>`
        : `<span class="dc-leg"><b>${esc(origin.code)}</b><i>${G.plane}</i><b>${d.code}</b></span><span class="dc-dist">${Math.round(dist).toLocaleString('en-GB')} km · ${dur}</span>`;
      card.innerHTML = `
        <div class="dc-head">
          <span class="dc-flag">${FLAGS[d.id] ?? ''}</span>
          <div class="dc-name"><h3>${esc(d.city)}<span class="jp">${esc(d.local)}</span></h3><p>${esc(d.country)} · ${d.code}</p></div>
          ${isHere ? `<span class="badge red">${G.pin}You are here</span>` : d.open ? `<span class="badge">${G.check}Open</span>` : '<span class="badge gold">Coming soon</span>'}
        </div>
        <div class="dc-trip">${leg}${lt.text ? `<span class="dc-time ${lt.day ? 'day' : 'night'}">${lt.day ? G.sun : G.moon}${lt.text} there</span>` : ''}</div>
        <p class="dc-blurb">${esc(d.blurb)}</p>
        <div class="dc-menu">${d.menu.map(([e, n]) => `<span>${icon(e)}${esc(n)}</span>`).join('')}</div>`;
      cta.innerHTML = '';
      if (!d.open) {
        const b = h('button', 'btn btn-hero', `${G.clock}Coming soon`);
        b.setAttribute('disabled', '');
        cta.appendChild(b);
        cta.appendChild(h('p', 'cta-note', `The ${esc(d.city)} street food guide is still simmering. ${DESTINATIONS.filter((o) => o.open).map((o) => esc(o.city)).join(' and ')} ${DESTINATIONS.filter((o) => o.open).length > 1 ? 'are' : 'is'} open now!`));
      } else if (onward && isHere) {
        const b = h('button', 'btn btn-hero', `${G.pin}You are here`);
        b.setAttribute('disabled', '');
        cta.appendChild(b);
        cta.appendChild(h('p', 'cta-note', `Pick another city to fly on to, or go back to keep exploring ${esc(d.city)}.`));
      } else if (onward) {
        const b = h('button', 'btn btn-hero', `${G.depart}Fly on to ${esc(d.city)}`);
        b.onclick = () => { this.audio.play('click'); void this.fly(trip, d, null, origin); };
        cta.appendChild(b);
        cta.appendChild(h('p', 'cta-note', `${esc(origin.city)} keeps your stamps. You can fly back any time.`));
      } else if (mode === 'view') {
        const b = h('button', 'btn btn-hero', `${G.arrow}Back to ${esc(d.city)}`);
        b.onclick = () => { this.audio.play('click'); this.hooks.close(); };
        cta.appendChild(b);
        const coop = this.hooks.coop();
        const inv = h('button', 'btn btn-soft btn-wide', coop ? `${G.ticket}Show our plane ticket` : `${G.people}Invite a friend to ${esc(d.city)}`);
        inv.onclick = () => { this.audio.play('click'); void this.invite(trip, d); };
        cta.appendChild(inv);
      } else {
        const b = h('button', 'btn btn-hero', mode === 'solo' ? `${G.plane}Fly to ${esc(d.city)}` : `${G.ticket}Get plane ticket`);
        b.onclick = () => {
          this.audio.play('click');
          if (mode === 'solo') void this.fly(trip, d, null);
          // a trip to another city starts from a page that has built that city: go there first, then print the ticket
          else if (d.id !== CITY && isCity(d.id)) { this.hooks.save(); saveNow(this.s); goToCity(d.id, { host: d.id }); }
          else void this.hostPass(trip, d);
        };
        cta.appendChild(b);
        if (mode === 'coop') {
          const j = h('button', 'btn btn-link', `${G.ticket}Got a ticket from a friend?`);
          j.onclick = () => { this.audio.play('click'); this.joinPass(trip); };
          cta.appendChild(j);
        }
      }
      map.setRoute(isHere ? null : origin, d);
      map.focus(d, snap);
      layout();
    };
    const layout = () => {
      const r = trip.getBoundingClientRect(), sr = sheet.getBoundingClientRect(), tr = top.getBoundingClientRect();
      // wide or short-landscape screens: the sheet sits on the left; otherwise it covers the bottom
      const side = sr.width < r.width * 0.6 && sr.left < r.width * 0.2;
      map.setInsets(tr.bottom - r.top, side ? 0 : r.bottom - sr.top, side ? sr.right - r.left : 0, 0);
    };
    (top.querySelector('[data-a="back"]') as HTMLElement).onclick = () => { this.audio.play('click'); this.hooks.close(); };

    this.keyHandler = (e: KeyboardEvent) => {
      if (trip.classList.contains('flying')) {
        if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.stopPropagation(); e.preventDefault(); map.skip(); }
        return;
      }
      if (e.code === 'Escape') { e.stopPropagation(); if (!trip.querySelector('.bp-wrap')) this.hooks.close(); }
      else if (e.code === 'ArrowRight' || e.code === 'ArrowLeft') {
        const i = DESTINATIONS.indexOf(sel), n = DESTINATIONS.length;
        select(DESTINATIONS[(i + (e.code === 'ArrowRight' ? 1 : n - 1)) % n]);
      }
    };
    window.addEventListener('keydown', this.keyHandler, true);
    const ro = new ResizeObserver(layout);
    ro.observe(sheet);
    this.hooks.overlay(trip, () => {
      ro.disconnect();
      map.dispose();
      if (this.map === map) this.map = null;
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
      this.pending?.leave();
      this.pending = null;
      this.hooks.cover(false);
    });
    this.hooks.cover(true);
    requestAnimationFrame(() => select(sel, true));
    then?.(trip);
  }

  /** From the home menu, or a shared link: check in with a friend's ticket. */
  join(code = ''): void {
    this.openMap('coop', (trip) => this.joinPass(trip, code));
  }

  /** In game: show (or create) the ticket friends use to join this trip. */
  private async invite(trip: HTMLElement, d: Destination): Promise<void> {
    let coop = this.hooks.coop();
    if (!coop) {
      const { Coop, newCode } = await import('../net/coop');
      coop = await Coop.open(newCode(), true, d.id, this.profile());
      coop.setInWorld(true);
      this.hooks.attach(coop);
    }
    this.pass(trip, { coop, dest: DEST[coop.dest] ?? d, inGame: true });
  }

  /** In game, from the party chip: the boarding pass over a plain backdrop. */
  ticket(): void {
    const coop = this.hooks.coop();
    if (!coop) return;
    const wrap = h('div', 'trip-plain');
    this.hooks.overlay(wrap, () => {});
    this.pass(wrap, { coop, dest: DEST[coop.dest] ?? DEST.tokyo, inGame: true });
  }

  // ------------------------------------------------------------------ boarding
  private async fly(trip: HTMLElement, d: Destination, coop: Coop | null, from: LatLon = this.home): Promise<void> {
    if (trip.classList.contains('flying')) return;
    trip.classList.add('flying');
    this.pending = null;
    trip.querySelector('.bp-wrap')?.remove();
    await this.flight(trip, from, d, d.local, d.city, 'Arrived');
    // then down into the streets, through a veil dressed for the city (clouds where there is none yet)
    const hour = this.hooks.arrivalHour();
    const veil = arrivalVeil($('app'), d.id, hour < 6 || hour >= 19);
    this.audio.play('whoosh');
    void this.map?.diveIn(1500);
    await veil.cover();
    this.hooks.close();
    $('title').classList.add('hidden');
    this.hooks.board(d, coop);
    await sleep(350);
    veil.part();
  }

  /** Take off, cruise round the globe and land, then stamp the arrival. */
  private async flight(trip: HTMLElement, from: LatLon, to: LatLon, local: string, name: string, word: string): Promise<void> {
    const map = this.map;
    if (map) {
      // the flight: swoop down to the runway, take off, cruise round the globe, land
      const skip = h('button', 'trip-skip', `Skip${G.arrow}`);
      skip.onclick = () => { this.audio.play('click'); map.skip(); skip.remove(); };
      trip.appendChild(skip);
      map.setRoute(from, to);
      setTimeout(() => this.audio.play('jet'), 700);
      await map.fly(this.hooks.arrivalHour());
      skip.remove();
    }
    this.audio.play('chime');
    trip.appendChild(h('div', 'landed', `<div class="stamp-big">${local ? `<span>${esc(local)}</span>` : ''}${esc(name.toUpperCase())}<small>${word} · ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</small></div>`));
    setTimeout(() => this.audio.play('stamp'), 250);
    await sleep(1000);
  }

  /**
   * The end of a trip, flying home: the globe opens on the city being left, the plane flies the route home, the
   * home stamp lands, and clouds cover the switch back to the home menu.
   */
  homeward(): void {
    const from = DEST[CITY] ?? DEST.tokyo;
    const trip = h('div', 'trip solo homeward flying');
    const map = new WorldMap(trip);
    this.map = map;
    const homePin = h('div', 'pin home', `<span class="pin-tag">${G.home}${esc(this.home.city)}</span><span class="pin-dot"></span>`);
    map.addPin(homePin, this.home);
    const p = h('div', 'pin open sel', `<span class="pin-tag"><span class="fl">${FLAGS[from.id] ?? ''}</span><span class="nm">${esc(from.city)}</span></span><span class="pin-dot"></span>`);
    p.dataset.place = from.id;
    map.addPin(p, from);
    this.keyHandler = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') { e.stopPropagation(); e.preventDefault(); map.skip(); }
    };
    window.addEventListener('keydown', this.keyHandler, true);
    let done = false;
    this.hooks.overlay(trip, () => {
      map.dispose();
      if (this.map === map) this.map = null;
      if (this.keyHandler) window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
      this.hooks.cover(false);
      // closed before landing (it should not be): still end the trip, the plane has left
      if (!done) { done = true; this.hooks.home(); }
    });
    this.hooks.cover(true);
    map.setRoute(from, this.home);
    void (async () => {
      await new Promise((r) => requestAnimationFrame(r));
      map.focus(from, true);
      await sleep(250);
      await this.flight(trip, from, this.home, '', this.home.city, 'Welcome home');
      const veil = arrivalVeil($('app'), 'home', false);
      this.audio.play('whoosh');
      void map.diveIn(1500);
      await veil.cover();
      done = true;
      this.hooks.close();
      this.hooks.home();
      await sleep(350);
      veil.part();
    })();
  }

  private async hostPass(trip: HTMLElement, d: Destination): Promise<void> {
    const wait = this.passShell(trip, `<div class="bp-loading"><span class="spin"></span>Printing your ticket…</div>`);
    try {
      const { Coop, newCode } = await import('../net/coop');
      const coop = await Coop.open(newCode(), true, d.id, this.profile());
      if (!wait.isConnected) { coop.leave(); return; }
      this.pending = coop;
      wait.remove();
      this.pass(trip, { coop, dest: d, inGame: false });
    } catch (e) {
      console.error(e);
      wait.remove();
      this.hooks.toast('signal', 'No signal at the airport', 'Could not set up a co-op trip. Check your connection and try again.');
    }
  }

  /** The check-in desk: type a friend's ticket code and find their trip. */
  private joinPass(trip: HTMLElement, preset = ''): void {
    const wrap = this.passShell(trip, '');
    const bp = h('div', 'bpass checkin');
    bp.innerHTML = `
      <div class="bp-main">
        <div class="bp-band"><span class="bp-air">${G.plane}Tasty Air</span><span>Check-in</span></div>
        <div class="bp-route">
          <div class="bp-city"><small>From</small><b>${esc(this.home.code)}</b><span>${esc(this.home.city)}</span></div>
          <div class="bp-line"><i></i>${G.plane}<i></i></div>
          <div class="bp-city to"><small>To</small><b class="q">???</b><span>Ask your friend</span></div>
        </div>
        <label class="bp-field code-in"><small>Ticket code</small>
          <input id="bp-code" inputmode="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="7" placeholder="ACD-347" aria-label="Ticket code">
        </label>
        <p class="bp-status" id="bp-status">Your friend gets a ticket code when they start a co-op trip.</p>
      </div>
      <div class="bp-actions"><button class="btn btn-hero" id="bp-go">${G.ticket}Check in</button><button class="btn btn-link" id="bp-cancel">Cancel</button></div>`;
    wrap.appendChild(bp);
    const input = bp.querySelector('#bp-code') as HTMLInputElement, status = bp.querySelector('#bp-status') as HTMLElement, go = bp.querySelector('#bp-go') as HTMLButtonElement;
    const fmt = () => {
      const raw = input.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
      input.value = raw.length > 3 ? `${raw.slice(0, 3)}-${raw.slice(3)}` : raw;
    };
    input.value = preset;
    fmt();
    input.addEventListener('input', fmt);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') go.click(); e.stopPropagation(); });
    (bp.querySelector('#bp-cancel') as HTMLElement).onclick = () => { this.audio.play('click'); wrap.remove(); };
    let busy = false;
    go.onclick = async () => {
      if (busy) return;
      const { Coop, parseCode } = await import('../net/coop');
      const code = parseCode(input.value);
      if (!code) { this.audio.play('fail'); status.textContent = 'Ticket codes have six letters and numbers, like ACD-347.'; bp.classList.add('shake'); setTimeout(() => bp.classList.remove('shake'), 500); return; }
      busy = true;
      this.audio.play('click');
      go.innerHTML = '<span class="spin"></span>Finding your friend…';
      status.textContent = 'Looking for the trip on that ticket. Keep the game open on your friend\'s side.';
      let coop: Coop | null = null;
      try {
        coop = await Coop.open(code, false, '', this.profile());
        const t0 = performance.now();
        while (!coop.peers.size && performance.now() - t0 < 20000 && wrap.isConnected) await sleep(200);
      } catch (e) { console.error(e); }
      if (!wrap.isConnected) { coop?.leave(); return; }
      if (!coop || !coop.peers.size) {
        coop?.leave();
        busy = false;
        this.audio.play('fail');
        go.innerHTML = `${G.ticket}Try again`;
        status.textContent = 'Nobody is on that trip right now. Check the code, and make sure your friend still has the game open.';
        return;
      }
      if (coop.dest !== CITY && isCity(coop.dest)) {
        // the friend is in another city: reload into it and check in again from there
        coop.leave();
        saveNow(this.s);
        goToCity(coop.dest, { ticket: input.value });
        return;
      }
      wrap.remove();
      this.pending = coop;
      this.audio.play('success');
      this.pass(trip, { coop, dest: DEST[coop.dest] ?? DEST.tokyo, inGame: false });
    };
    if (preset) go.click();
    else setTimeout(() => input.focus(), 350);
  }

  /** Scrim + container for a boarding pass, inside the travel screen. */
  private passShell(trip: HTMLElement, html: string): HTMLElement {
    trip.querySelector('.bp-wrap')?.remove();
    const wrap = h('div', 'bp-wrap', html);
    trip.appendChild(wrap);
    return wrap;
  }

  /** The boarding pass for a co-op trip: route, passengers, the code to share, and the board button. */
  private pass(trip: HTMLElement, o: { coop: Coop; dest: Destination; inGame: boolean }): void {
    const { coop, dest, inGame } = o;
    const wrap = this.passShell(trip, '');
    void import('../net/coop').then(({ prettyCode, flightOf }) => {
      const { flight, gate } = flightOf(coop.code);
      const code = prettyCode(coop.code);
      const link = `${location.origin}${location.pathname}?ticket=${coop.code}`;
      const bp = h('div', 'bpass');
      bp.innerHTML = `
        <div class="bp-main">
          <div class="bp-band"><span class="bp-air">${G.plane}Tasty Air</span><span>Boarding pass</span></div>
          <div class="bp-route">
            <div class="bp-city"><small>From</small><b>${esc(this.home.code)}</b><span>${esc(this.home.city)}</span></div>
            <div class="bp-line"><i></i>${G.plane}<i></i></div>
            <div class="bp-city to"><small>To</small><b>${dest.code}</b><span>${esc(dest.city)} ${FLAGS[dest.id] ?? ''}</span></div>
          </div>
          <div class="bp-grid">
            <label class="bp-field name"><small>Passenger</small><input id="bp-name" maxlength="16" placeholder="Your name" autocomplete="nickname" spellcheck="false"></label>
            <div class="bp-field"><small>Flight</small><b>${flight}</b></div>
            <div class="bp-field"><small>Gate</small><b>${gate}</b></div>
            <div class="bp-field"><small>Seat</small><b id="bp-seat">${coop.seat || '—'}</b></div>
          </div>
          <div class="bp-colors"><small>Your colour</small><div class="sw-row" id="bp-colors"></div></div>
          <div class="bp-crew"><small>Travelling together</small><div class="crew" id="bp-crew"></div></div>
        </div>
        <div class="bp-stub">
          <small>Ticket code</small>
          <div class="bp-code">${code.split('').map((c) => c === '-' ? '<i></i>' : `<span>${c}</span>`).join('')}</div>
          <div class="bp-share">
            <button class="btn btn-soft" id="bp-copy">${G.copy}Copy</button>
            <button class="btn btn-ink" id="bp-send">${G.share}Send</button>
          </div>
          <div class="barcode" aria-hidden="true"></div>
        </div>
        <div class="bp-actions"></div>`;
      wrap.appendChild(bp);
      const name = bp.querySelector('#bp-name') as HTMLInputElement;
      name.value = this.s.profile.name;
      name.addEventListener('keydown', (e) => e.stopPropagation());
      name.addEventListener('input', () => { this.s.profile.name = name.value.slice(0, 16); this.hooks.save(); });
      name.addEventListener('change', () => coop.setProfile(this.profile()));
      const sw = bp.querySelector('#bp-colors')!;
      const paint = () => {
        sw.innerHTML = '';
        for (const c of COLORS) {
          const b = h('button', `swatch${c === this.s.profile.color ? ' on' : ''}`);
          b.style.setProperty('--c', hex(c));
          b.setAttribute('aria-label', 'Colour');
          b.onclick = () => { this.audio.play('pop'); this.s.profile.color = c; this.hooks.save(); coop.setProfile(this.profile()); paint(); crew(); };
          sw.appendChild(b);
        }
      };
      const crewEl = bp.querySelector('#bp-crew')!, seatEl = bp.querySelector('#bp-seat')!;
      const chip = (p: { name: string; color: number; seat: string }, you: boolean, host: boolean) =>
        `<span class="mate"><span class="ava" style="--c:${hex(p.color)}">${esc(p.name.charAt(0).toUpperCase())}</span><span><b>${esc(p.name)}${you ? ' <em>you</em>' : ''}</b><small>${host ? 'Trip leader' : 'Travel buddy'}${p.seat ? ` · ${p.seat}` : ''}</small></span></span>`;
      const crew = () => {
        if (!bp.isConnected) return;
        seatEl.textContent = coop.seat || '—';
        const me = this.profile();
        const others = coop.list.sort((a: Peer, b: Peer) => Number(b.host) - Number(a.host));
        crewEl.innerHTML = chip({ ...me, seat: coop.seat }, true, coop.host) + others.map((p) => chip(p, false, p.host)).join('')
          + (others.length ? '' : `<span class="mate waiting"><span class="ava">${G.plus}</span><span><b>Waiting for a friend<span class="dots"><i>.</i><i>.</i><i>.</i></span></b><small>Send them the ticket code</small></span></span>`);
      };
      paint();
      crew();
      const prev = coop.onPeers;
      coop.onPeers = () => { prev?.(); crew(); };
      // copy + share
      const copy = async () => {
        try { await navigator.clipboard.writeText(link); this.hooks.toast('ticket', 'Ticket copied', `Send it to a friend. They can also type ${code} under "Got a ticket?".`); } catch { this.hooks.toast('ticket', `Your code: ${code}`, 'Ask your friend to open "Got a ticket?" and type it in.'); }
      };
      (bp.querySelector('#bp-copy') as HTMLElement).onclick = () => { this.audio.play('click'); void copy(); };
      (bp.querySelector('#bp-send') as HTMLElement).onclick = async () => {
        this.audio.play('click');
        const text = `Come eat your way through ${dest.city} with me in Tasty World! Ticket ${code}`;
        if (navigator.share) { try { await navigator.share({ title: 'Tasty World', text, url: link }); return; } catch (e) { if ((e as Error).name === 'AbortError') return; } }
        void copy();
      };
      // board, or in game: close / leave
      const act = bp.querySelector('.bp-actions')!;
      if (inGame) {
        const ok = h('button', 'btn btn-hero', `${G.check}Done`);
        ok.onclick = () => { this.audio.play('click'); this.hooks.close(); };
        const lv = h('button', 'btn btn-link', `${G.exit}Leave the co-op trip`);
        lv.onclick = () => { this.audio.play('click'); this.hooks.leave(); this.hooks.close(); };
        act.append(ok, lv);
      } else {
        const go = h('button', 'btn btn-hero', `${G.plane}Board the plane`);
        go.onclick = () => { this.audio.play('click'); this.hooks.save(); coop.setProfile(this.profile()); void this.fly(trip, dest, coop); };
        const cancel = h('button', 'btn btn-link', 'Cancel trip');
        cancel.onclick = () => { this.audio.play('click'); coop.onPeers = prev; coop.leave(); this.pending = null; wrap.remove(); this.map?.setRoute(this.home, dest); };
        act.append(go, cancel);
        if (coop.host) act.appendChild(h('p', 'cta-note', 'You can board now. Friends with your ticket can land beside you any time.'));
      }
      this.map?.setRoute(this.home, dest);
      this.map?.focus(dest);
    });
  }
}
