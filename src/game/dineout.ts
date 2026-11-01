import * as THREE from 'three';
import { Actor, SIT_DROP } from './actors';
import type { Nav } from './nav';
import type { Meal } from './meal';
import type { Crowd } from './crowd';
import type { SaveState } from './state';
import type { Audio } from './audio';
import type { UI } from '../ui/ui';
import { menuCard, billCard, vitrine, bagSheet } from '../ui/dining';
import { Waiter, TableVisit, plateSpot, approachOf, type SeatSpot, type OrderItem, type VisitHost, type V2 } from './service';
import { DINING, COUNTER_ROOMS, DRINK_ICONS, SWEET_ICONS, BAG_MAX, serviceOf } from '../data/service';
import { DISH } from '../data/dishes';
import { STALL, type StallInfo } from '../data/stalls';
import { PLACES, roomName, type Buyable } from '../data/places';
import { TEXT, localName } from '../data/cityText';
import type { FoodId } from '../world/food';
import type { RoomAnchor } from '../world/interiors';
import { randomLook, type Look } from '../world/characters';

/**
 * Eating out (data/service.ts has each city's manners): every bench, step and café chair is a seat the traveller can
 * take; a seat at a restaurant's tables, or on a terrace in front of one, brings a waiter with the menu (table
 * service, game/service.ts); bakeries and pastry shops sell from a display case into a paper bag; and the bag's
 * contents can be eaten anywhere, best sitting down.
 */

/** What the game registers as tappable (main.ts' Interactable). */
export interface DineSpot {
  key: string;
  x: number; z: number;
  stand: [number, number];
  pick: [number, number, number];
  r: number;
  inside: boolean;
  /** Only picked by a tap from this close (benches are everywhere). */
  reach?: number;
  prompt(): [string, string, string] | null;
  act(): void;
}

export interface DineHost {
  nav: Nav;
  player: Actor;
  ui: UI;
  audio: Audio;
  s: SaveState;
  crowd: Crowd;
  /** A body for a waiter, in the world, hidden until drawn. */
  spawn(look: Look): Actor;
  add(it: DineSpot): void;
  /** Walk to a spot's stand and use it on arrival. */
  walkTo(it: DineSpot): void;
  startMeal(id: string, server: Actor | null, done: () => void, table?: THREE.Vector3 | null, line?: string): Meal;
  meal(): Meal | null;
  endMeal(): void;
  /** A dish eaten: the stamp and the passport count. */
  eat(id: FoodId): void;
  afterChange(): void;
}

export interface BagItem { id: string; name: string; dish: boolean; icon?: string; city: string }

interface Place { id: string; stall?: string; name: string; local: string; kind: string; items: OrderItem[]; waiter: Waiter; door: V2; cover: boolean }

interface Seat extends SeatSpot { place: Place | null; crowd: number; it: DineSpot }

const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];
const SIT_SECS = 0.4;
/** A terrace is served by the table-service place whose door is this near (metres), else by a waiter of its own. */
const TERRACE_REACH = 28;

function courseOf(icon: string): OrderItem['course'] {
  return DRINK_ICONS.has(icon) ? 'drink' : SWEET_ICONS.has(icon) ? 'sweet' : 'food';
}
const dishItem = (id: FoodId): OrderItem => {
  const d = DISH[id];
  return { id, name: d.name, local: localName(d.name, d.jp), price: d.price, course: d.drink ? 'drink' : d.dessert ? 'sweet' : 'food', dish: true, text: d.tagline };
};
const snackItem = (b: Buyable): OrderItem => ({ id: b.icon, name: b.name, price: b.price, course: courseOf(b.icon), dish: false, text: b.text, icon: b.icon });

export class Dining {
  seated: Seat | null = null;
  private places: Place[] = [];
  private seats: Seat[] = [];
  private waiters: Waiter[] = [];
  private visit: TableVisit | null = null;
  /** Seconds until the waiter notices a traveller who just sat down. */
  private noticeT = -1;
  /** A sheet to open once the screen is free (the menu or the bill, never on top of the savour card). */
  private ask: (() => void) | null = null;
  private sitT = 0;
  private from = new THREE.Vector3();
  private owned = new Set<Meal>();
  private seatedSpot: DineSpot;

  constructor(private h: DineHost) {
    this.seatedSpot = {
      key: 'seated', x: 0, z: 0, stand: [0, 0], pick: [0, 0, 0], r: 99, inside: false,
      prompt: () => this.seatedPrompt(),
      act: () => this.seatedAct(),
    };
  }

  private get bag(): BagItem[] { return (this.h.s.bag ??= []); }

  // ------------------------------------------------------------------------------------------- building

  build(rooms: RoomAnchor[], cafeTables: [number, number, number][]): void {
    const nav = this.h.nav;
    let wi = 0;
    for (const rm of rooms) {
      if (rm.hotel) continue;
      const st = rm.stall ? STALL[rm.stall] : undefined;
      const place = this.placeOf(rm, st, wi);
      if (place) wi++;
      for (const [i, s] of (rm.seats ?? []).entries()) {
        if (s.taken) continue;
        const ap = approachOf(nav, s.pos[0], s.pos[2], s.face);
        if (!ap) continue;
        const table = new THREE.Vector3(s.table[0], s.table[1], s.table[2]);
        this.addSeat({
          key: `${rm.id}-${i}`, x: s.pos[0], y: s.pos[1], z: s.pos[2], face: s.face, approach: ap,
          table, plate: plateSpot(s.pos[0], s.pos[2], s.table), serve: null,
        }, place, -1);
      }
    }
    // the city's benches, steps and terrace chairs; the ones at a café table get a waiter
    const pub = this.h.crowd.publicSeats;
    const terraces = new Map<number, Place>();
    pub.forEach((s, i) => {
      let tb: [number, number, number] | null = null, ti = -1, bd = 0.85;
      cafeTables.forEach((t, j) => { const d = Math.hypot(t[0] - s.x, t[1] - s.z); if (d < bd) { bd = d; tb = t; ti = j; } });
      let place: Place | null = null;
      let table: THREE.Vector3 | null = null, plate: THREE.Vector3 | null = null;
      if (tb) {
        const [tx, tz, top] = tb as [number, number, number];
        table = new THREE.Vector3(tx, top, tz);
        plate = plateSpot(s.x, s.z, [tx, top, tz]);
        place = terraces.get(ti) ?? null;
        if (!place) { place = this.terraceOf(tx, tz, wi++); if (place) terraces.set(ti, place); }
      }
      this.addSeat({ key: `pub-${i}`, x: s.x, y: s.y, z: s.z, face: s.face, approach: s.approach, table, plate, serve: null }, place, i);
    });
  }

  private placeOf(rm: RoomAnchor, st: StallInfo | undefined, n: number): Place | null {
    if (!rm.seats?.length || COUNTER_ROOMS.has(rm.kind)) return null;
    if (st && serviceOf(st) !== 'table') return null;
    const items: OrderItem[] = [];
    const seen = new Set<string>();
    const push = (it: OrderItem) => { if (!seen.has(it.name)) { seen.add(it.name); items.push(it); } };
    for (const d of st?.dishes ?? []) if (DISH[d]) push(dishItem(d));
    // a cook's restaurant serves its own dishes; a café or a bar with a keeper, what is on its counter
    if (!st) for (const b of PLACES[rm.kind]?.buy ?? []) if (b.snack) push(snackItem(b));
    if (!items.some((i) => i.course !== 'drink')) return null;
    // the house drinks, unless the place pours its own already (a tea house's çay)
    for (const b of DINING.drinks) if (!items.some((i) => i.name.toLowerCase().includes(b.name.toLowerCase()))) push(snackItem(b));
    const [name, local] = st ? [st.name, st.jp] : roomName(rm.kind, rm.nth, rm.hotel);
    const home = this.homeOf(rm), [x0, z0, x1, z1] = rm.rect;
    const guests = (rm.seats ?? []).filter((s) => s.taken).map((s) => ({ x: s.pos[0], z: s.pos[2], face: s.face, table: s.table }));
    const waiter = this.waiter(home, Math.atan2((x0 + x1) / 2 - home[0], (z0 + z1) / 2 - home[1]), n, guests);
    const cover = !!DINING.cover && (!DINING.cover.only || DINING.cover.only.includes(rm.kind));
    const place: Place = { id: rm.id, stall: rm.stall, name, local, kind: rm.kind, items, waiter, door: rm.door, cover };
    this.places.push(place);
    return place;
  }

  /** A café table out in the street: the nearest table-service place serves it, its waiter too when it is close. */
  private terraceOf(x: number, z: number, n: number): Place | null {
    let best: Place | null = null, bd = Infinity;
    for (const p of this.places) { const d = Math.hypot(p.door[0] - x, p.door[1] - z); if (d < bd) { bd = d; best = p; } }
    if (!best) return null;
    if (bd <= TERRACE_REACH) return best;
    // too far to run plates from: a waiter of its own, standing by the tables
    const nav = this.h.nav;
    let home: V2 = [x, z];
    for (let r = 1.4; r < 3; r += 0.4) {
      const c = [0, 1, 2, 3, 4, 5, 6, 7].map((k): V2 => [x + Math.cos(k * 0.785) * r, z + Math.sin(k * 0.785) * r]).find(([cx, cz]) => nav.walkable(cx, cz));
      if (c) { home = c; break; }
    }
    const waiter = this.waiter(home, Math.atan2(x - home[0], z - home[1]), n, []);
    return { ...best, id: `terrace-${n}`, waiter, door: home };
  }

  /** Where a room's waiter waits: a step in from the door, towards the middle of the room. */
  private homeOf(rm: RoomAnchor): V2 {
    const nav = this.h.nav, [x0, z0, x1, z1] = rm.rect;
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, [dx, dz] = rm.door;
    const d = Math.hypot(cx - dx, cz - dz) || 1;
    for (const k of [1.1, 0.8, 1.5, 0.5]) {
      const x = dx + ((cx - dx) / d) * k, z = dz + ((cz - dz) / d) * k;
      if (nav.walkable(x, z)) return [x, z];
    }
    return [dx, dz];
  }

  private waiter(home: V2, face: number, n: number, guests: ConstructorParameters<typeof Waiter>[5]): Waiter {
    const seed = 7919 * (n + 3);
    const look: Look = { ...randomLook(seed), ...DINING.waiterLook };
    const a = this.h.spawn(look);
    const w = new Waiter(a, DINING.waiters[n % DINING.waiters.length], home, face, this.h.nav, guests);
    this.waiters.push(w);
    return w;
  }

  private addSeat(spot: SeatSpot, place: Place | null, crowd: number): void {
    const seat = spot as Seat;
    seat.place = place;
    seat.crowd = crowd;
    seat.it = {
      key: `seat-${spot.key}`, x: spot.x, z: spot.z, stand: spot.approach, pick: [spot.x, spot.y + 0.45, spot.z], r: 0.8, inside: false, reach: 7,
      prompt: () => {
        if (this.seated || (crowd >= 0 && !this.h.crowd.seatFree(crowd))) return null;
        if (place) return ['terrace', place.name, crowd >= 0 ? 'Sit at a table outside' : 'Take a seat'];
        return ['seat', spot.table ? 'A free table' : 'A seat', this.bag.length ? 'Sit down for a bite from your paper bag' : 'Sit down a while'];
      },
      act: () => this.sit(seat),
    };
    this.seats.push(seat);
    this.h.add(seat.it);
  }

  // ------------------------------------------------------------------------------------------- sitting

  sit(seat: Seat): void {
    if (this.seated || this.h.meal()) return;
    if (seat.crowd >= 0 && !this.h.crowd.holdSeat(seat.crowd, true)) {
      this.h.audio.play('fail');
      this.h.ui.toast('seat', 'Someone beat you to it', 'Find another seat.');
      return;
    }
    const pl = this.h.player;
    this.seated = seat;
    this.sitT = 0;
    this.from.copy(pl.position);
    pl.facing = pl.targetFacing = seat.face;
    this.h.ui.setSeated(true);
    this.h.audio.play('rustle');
    const p = seat.place;
    if (p && !p.waiter.busy) this.noticeT = 0.9;
    else if (p) this.h.ui.bubble('waiter', 'One moment, I will be right with you!', this.waiterHead(p.waiter), 2.2);
  }

  /** Get up: anything eaten at the table is paid on the way out. */
  stand(): void {
    const seat = this.seated;
    if (!seat) return;
    this.noticeT = -1;
    this.ask = null;
    const m = this.h.meal();
    if (m) this.h.endMeal();
    if (this.visit) { this.visit.leave(); this.visit = null; this.h.ui.close(); }
    if (seat.crowd >= 0) this.h.crowd.holdSeat(seat.crowd, false);
    this.seated = null;
    const pl = this.h.player, [ax, az] = seat.approach;
    pl.position.set(ax, this.h.nav.heightAt(ax, az), az);
    pl.anim = 'idle';
    this.h.ui.setSeated(false);
  }

  /** Once a frame while seated, instead of walking: settle onto the seat and stay there. */
  hold(dt: number): void {
    const seat = this.seated!, pl = this.h.player;
    this.sitT = Math.min(SIT_SECS, this.sitT + dt);
    const u = this.sitT / SIT_SECS, e = u * u * (3 - 2 * u);
    pl.position.set(
      this.from.x + (seat.x - this.from.x) * e,
      this.from.y + (seat.y - SIT_DROP - this.from.y) * e,
      this.from.z + (seat.z - this.from.z) * e,
    );
    pl.targetFacing = seat.face;
    pl.speed = 0;
    pl.anim = u < 1 ? 'idle' : 'sit';
  }

  /** While seated the prompt is about the table: call the waiter, the bag, or getting up. */
  get prompt(): DineSpot | null {
    if (!this.seated) return null;
    const p = this.h.player.position;
    this.seatedSpot.x = p.x; this.seatedSpot.z = p.z;
    return this.seatedSpot;
  }

  private canCall(): boolean {
    const p = this.seated?.place;
    if (!p) return false;
    const v = this.visit;
    return v ? v.state === 'idle' : !p.waiter.busy;
  }

  private seatedPrompt(): [string, string, string] | null {
    const v = this.visit;
    if (this.canCall()) return ['waiter', `“${DINING.call}”`, 'Call the waiter over'];
    if (v && v.state === 'kitchen') return ['waiter', 'Your order is coming', 'Sit back and watch the street'];
    if (this.bag.length && !this.h.meal()) return ['bag', 'Your paper bag', `${this.bag.length} ${this.bag.length === 1 ? 'thing' : 'things'} to eat here`];
    return ['walk', 'Stand up', v && v.state !== 'done' && v.eatenItems.length ? 'Pay for what you ate and go' : 'Carry on exploring'];
  }

  private seatedAct(): void {
    if (this.canCall()) {
      this.h.ui.bubble('me', DINING.call, this.head(this.h.player), 1.6);
      this.call();
    } else if (this.visit?.state === 'kitchen') this.h.ui.bubble('waiter', 'Almost ready!', this.waiterHead(this.visit.waiter), 1.6);
    else if (this.bag.length && !this.h.meal()) this.openBag();
    else this.stand();
  }

  private call(): void {
    const seat = this.seated, p = seat?.place;
    if (!seat || !p) return;
    if (this.visit && this.visit.state === 'idle') { this.visit.call(); return; }
    this.visit = new TableVisit(seat, p.waiter, p, this.visitHost(p), p.cover);
  }

  // ------------------------------------------------------------------------------------------- the visit

  private visitHost(p: Place): VisitHost {
    const h = this.h, ui = h.ui;
    return {
      bubble: (key, text, pos, secs) => ui.bubble(key, text, pos, secs),
      menu: (v) => this.whenFree(() => {
        if (this.visit !== v || v.state !== 'menu') return;
        const c = DINING.cover;
        menuCard(ui.dineKit(), {
          place: p.name, local: p.local, waiter: p.waiter.name, line: pick(DINING.hello),
          items: p.items,
          cover: v.cover && c ? { name: c.name, local: c.local, price: c.price, text: c.text, optional: c.optional } : null,
          order: (items, cover) => { v.cover = cover; v.order(items); },
          cancel: () => v.noOrder(),
        });
      }),
      bill: (v) => this.whenFree(() => {
        if (this.visit !== v || v.state !== 'paying') return;
        const c = DINING.cover;
        billCard(ui.dineKit(), {
          place: p.name, items: v.eatenItems,
          cover: v.cover && c ? { name: c.name, price: c.price } : null,
          pay: (tip) => { v.pay(tip); h.afterChange(); },
        });
      }),
      serve: (item, waiter, plate, line) => {
        const m = h.startMeal(item.id, waiter, () => {}, plate, line);
        this.owned.add(m);
        return m;
      },
      cook: () => h.audio.play('sizzle'),
      eaten: (item) => {
        if (!item.dish) return;
        const d = item.id as FoodId, isNew = !h.s.tasted[d];
        h.eat(d);
        const count = h.s.tasted[d] ?? 1;
        if (isNew) this.whenFree(() => ui.savour(d, { isNew, count }));
        else ui.toast(d, DISH[d].name, `Your ${ordinal(count)} time. Still delicious.`);
      },
      charge: (yen) => { h.s.yen = Math.max(0, h.s.yen - yen); h.afterChange(); },
      sound: (n) => h.audio.play(n),
      toast: (i, t, x) => ui.toast(i, t, x),
    };
  }

  private whenFree(f: () => void): void {
    if (!this.h.ui.busy) f();
    else this.ask = f;
  }

  /** Whether a meal is the visit's (the visit keeps the empties; main must not dispose it). */
  owns(m: Meal): boolean { return this.owned.has(m); }

  /** Main is done with a meal it was told the visit owns (eaten, or the traveller stood up). */
  ended(m: Meal): void {
    this.owned.delete(m);
    if (this.visit) this.visit.finished(m, m.served);
    else m.dispose();
  }

  // ------------------------------------------------------------------------------------------- a frame

  update(dt: number, pp: THREE.Vector3, indoors: boolean): void {
    for (const w of this.waiters) {
      const q = w.actor.position, d = Math.hypot(q.x - pp.x, q.z - pp.z);
      if (w.busy || d < 40) w.update(dt, !indoors && d < 30);
    }
    if (this.noticeT > 0 && (this.noticeT -= dt) <= 0) {
      this.noticeT = -1;
      if (this.seated?.place && !this.visit && !this.seated.place.waiter.busy) this.call();
    }
    this.visit?.update(dt);
    if (this.ask && !this.h.ui.busy) { const f = this.ask; this.ask = null; f(); }
    // the carried empties follow the waiter's hands
    const c = this.visit?.carried;
    if (c) c.update(dt);
  }

  /** The waiters near enough to see, added to the frame's drawn people. */
  draw(pp: THREE.Vector3, indoors: boolean, out: Actor[]): void {
    for (const w of this.waiters) {
      const q = w.actor.position;
      const on = !indoors && (Math.hypot(q.x - pp.x, q.z - pp.z) < 30 || w.busy);
      w.actor.root.visible = on;
      if (on) out.push(w.actor);
    }
  }

  /** After the people animate: the plates in the waiter's hands. */
  place(dt: number): void { this.visit?.carried?.place(dt); }

  // ------------------------------------------------------------------------------------------- counters

  /** The buttons a stall's sheet gets: a table at a restaurant, the display case at a pastry shop. */
  stallExtra(st: StallInfo, vendor: Actor): { label: string; icon: string; act: () => void } | null {
    const sv = serviceOf(st);
    if (sv === 'counter') return { label: 'Choose from the display case', icon: 'vitrine', act: () => this.caseFor(st.name, st.jp, st.vendor, pick(st.greeting), st.dishes.filter((d) => DISH[d]).map(dishItem), vendor) };
    if (sv !== 'table') return null;
    const seats = this.seats.filter((s) => s.place?.stall === st.id);
    if (!seats.length) return null;
    return { label: 'Find me a table', icon: 'terrace', act: () => this.findTable(seats) };
  }

  private findTable(seats: Seat[]): void {
    const p = this.h.player.position;
    const free = seats.filter((s) => s.crowd < 0 || this.h.crowd.seatFree(s.crowd));
    free.sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
    const s = free[0];
    if (!s) { this.h.audio.play('fail'); this.h.ui.toast('terrace', 'Every table is taken', 'Try again in a little while, or eat standing at the counter.'); return; }
    this.h.walkTo(s.it);
  }

  /** A keeper's counter in a bakery, a konbini or a sweet shop: the display case. False when there is nothing to eat. */
  counterRoom(rm: RoomAnchor, keeper: string, line: string, server: Actor): boolean {
    if (!COUNTER_ROOMS.has(rm.kind)) return false;
    const items = (PLACES[rm.kind]?.buy ?? []).filter((b) => b.snack).map(snackItem);
    if (!items.length) return false;
    const [name, local] = roomName(rm.kind, rm.nth, rm.hotel);
    this.caseFor(name, local, keeper, line, items, server);
    return true;
  }

  private caseFor(name: string, local: string, keeper: string, line: string, items: OrderItem[], server: Actor): void {
    const h = this.h;
    vitrine(h.ui.dineKit(), {
      place: name, local, keeper, line, items,
      room: Math.max(0, BAG_MAX - this.bag.length),
      buy: (list) => {
        const total = list.reduce((t, i) => t + i.price, 0);
        h.s.yen = Math.max(0, h.s.yen - total);
        const [now, ...later] = list;
        for (const it of later) this.bag.push({ id: it.id, name: it.name, dish: it.dish, icon: it.icon, city: TEXT.name });
        if (later.length) h.ui.toast('bag', `${later.length} in your paper bag`, 'For later. Tap the paper bag (B), or sit down somewhere nice.');
        this.refreshBag();
        h.afterChange();
        setTimeout(() => this.eatNow(now, server), 150);
      },
    });
  }

  // ------------------------------------------------------------------------------------------- the bag

  refreshBag(): void { this.h.ui.setBag(this.bag.length); }

  openBag(): void {
    if (this.h.meal() || this.h.ui.busy) return;
    bagSheet(this.h.ui.dineKit(), {
      items: this.bag, seated: !!this.seated,
      eat: (i) => {
        const [it] = this.bag.splice(i, 1);
        if (!it) return;
        this.refreshBag();
        this.h.afterChange();
        this.eatNow({ id: it.id, name: it.name, dish: it.dish, icon: it.icon, price: 0, course: 'food' }, null);
      },
    });
  }

  /** Eat something right away, handed over by `server` (or out of the bag), on the table if seated at one. */
  private eatNow(it: OrderItem, server: Actor | null): void {
    const h = this.h, plate = this.seated?.plate ?? null;
    if (it.dish && DISH[it.id as FoodId]) {
      const d = it.id as FoodId, isNew = !h.s.tasted[d];
      h.eat(d);
      const count = h.s.tasted[d] ?? 1;
      h.startMeal(d, server, () => h.ui.savour(d, { isNew, count }), plate);
    } else h.startMeal(it.icon ?? it.id, server, () => {}, plate);
  }

  private head(a: Actor): [number, number, number] { const q = a.position; return [q.x, q.y + (this.seated && a === this.h.player ? 1.75 : 2.15), q.z]; }
  private waiterHead(w: Waiter): [number, number, number] { return this.head(w.actor); }
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
