import * as THREE from 'three';
import type { Actor } from './actors';
import type { Nav } from './nav';
import { PLAYER_REACH } from './nav';
import type { Meal } from './meal';
import { DINING, KITCHEN_SECS } from '../data/service';

/**
 * Table service (data/service.ts has the manners): a waiter who works the floor, and the visit of a traveller who
 * sits down at one of their tables. The waiter walks the room on the walk map; the visit is a little script of
 * calls and trips (bring the menu, take the order, carry each course out and set it down, clear the plates, bring
 * the bill) that the game drives once a frame. Eating itself is game/meal.ts, in its table mode.
 */

export type V2 = [number, number];

const WALK = 1.25;
const pick = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** A seat as the game uses it: where to sit and from where, the table, and the spot the plate goes. */
export interface SeatSpot {
  key: string;
  x: number; y: number; z: number;
  face: number;
  approach: V2;
  /** The middle of the table (or counter) top, and where the plate goes on it; null on a bench. */
  table: THREE.Vector3 | null;
  plate: THREE.Vector3 | null;
  /** Where a waiter stands to serve it. */
  serve: V2 | null;
}

/** On the line from the seat to the table, a forearm's reach in: never past the middle, never under the chin. */
export function plateSpot(sx: number, sz: number, table: [number, number, number]): THREE.Vector3 {
  const dx = table[0] - sx, dz = table[2] - sz, d = Math.hypot(dx, dz) || 1;
  const k = Math.min(d, Math.max(0.3, d - 0.15)) / d;
  return new THREE.Vector3(sx + dx * k, table[1], sz + dz * k);
}

/** A free spot to sit down from: behind the seat, or to either side of it. */
export function approachOf(nav: Nav, x: number, z: number, face: number): V2 | null {
  const fx = Math.sin(face), fz = Math.cos(face), px = fz, pz = -fx;
  const cand: V2[] = [];
  for (const r of [0.55, 0.75, 0.95]) cand.push([x - fx * r, z - fz * r], [x + px * r, z + pz * r], [x - px * r, z - pz * r]);
  return cand.find(([cx, cz]) => nav.walkable(cx, cz)) ?? null;
}

/** Where a waiter stands to serve a seat: beside the table on the diner's side, or round it. */
export function serveOf(nav: Nav, x: number, z: number, face: number, table: [number, number, number] | null): V2 | null {
  const fx = Math.sin(face), fz = Math.cos(face), px = fz, pz = -fx;
  const cand: V2[] = [];
  const mx = table ? (x + table[0]) / 2 : x, mz = table ? (z + table[2]) / 2 : z;
  for (const r of [0.6, 0.8, 1.0]) cand.push([mx + px * r, mz + pz * r], [mx - px * r, mz - pz * r]);
  for (const r of [0.6, 0.8]) cand.push([x - fx * r + px * 0.4, z - fz * r + pz * 0.4], [x - fx * r - px * 0.4, z - fz * r - pz * 0.4]);
  return cand.find(([cx, cz]) => nav.walkable(cx, cz)) ?? null;
}

/** A waiter: idles by the pass, takes plates out to the regulars now and then, and serves the traveller first. */
export class Waiter {
  path: V2[] = [];
  /** Serving the traveller: the regulars wait. */
  busy = false;
  private then: (() => void) | null = null;
  private faceTo: V2 | null = null;
  private ambientT = 6 + Math.random() * 12;
  private pause = 0;
  private guestServe = new Map<number, V2 | null>();

  constructor(readonly actor: Actor, readonly name: string, readonly home: V2, readonly homeFace: number, private nav: Nav,
    /** Regulars at the tables: seat, the way they face, the table. */
    private guests: { x: number; z: number; face: number; table: [number, number, number] }[]) {
    actor.position.set(home[0], nav.heightAt(home[0], home[1]), home[1]);
    actor.facing = actor.targetFacing = homeFace;
    actor.anim = 'idle';
  }

  get walking(): boolean { return this.path.length > 0; }
  get atHome(): boolean { return !this.path.length && Math.hypot(this.actor.position.x - this.home[0], this.actor.position.z - this.home[1]) < 0.3; }

  /** Walk to a spot, then face `face` and run `then`. Where the walk map finds no way, they are there at once. */
  goTo(to: V2, then: (() => void) | null = null, face: V2 | null = null): void {
    const p = this.actor.position;
    const path = Math.hypot(to[0] - p.x, to[1] - p.z) < 0.15 ? [] : this.nav.findPath(p.x, p.z, to[0], to[1], PLAYER_REACH);
    this.then = then;
    this.faceTo = face;
    this.pause = 0;
    if (path) {
      // the last waypoint is the nearest walkable cell's middle: finish on the exact spot
      if (path.length) path[path.length - 1] = [to[0], to[1]];
      this.path = path;
    } else {
      this.path = [];
      p.set(to[0], this.nav.heightAt(to[0], to[1]), to[1]);
    }
    if (!this.path.length) this.arrive();
  }

  goHome(then: (() => void) | null = null): void { this.goTo(this.home, then, null); }

  private arrive(): void {
    const a = this.actor;
    a.anim = 'idle';
    a.speed = 0;
    if (this.faceTo) a.targetFacing = Math.atan2(this.faceTo[0] - a.position.x, this.faceTo[1] - a.position.z);
    else if (this.atHome) a.targetFacing = this.homeFace;
    const t = this.then;
    this.then = null;
    t?.();
  }

  /** Once a frame. `near`: the room is in view, so the regulars get their plates. */
  update(dt: number, near: boolean): void {
    const a = this.actor, p = a.position;
    if (this.path.length) {
      const [tx, tz] = this.path[0];
      const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      const step = WALK * dt;
      if (d <= step) {
        p.x = tx; p.z = tz;
        this.path.shift();
        if (!this.path.length) { p.y = this.nav.heightAt(p.x, p.z); this.arrive(); return; }
      } else {
        p.x += (dx / d) * step; p.z += (dz / d) * step;
        a.targetFacing = Math.atan2(dx, dz);
      }
      p.y += (this.nav.heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 12);
      a.anim = 'walk';
      a.speed = WALK;
      return;
    }
    if (this.pause > 0) {
      // at a regular's table: lean in with the plate, a little bow, back to the pass
      this.pause -= dt;
      a.pose.lean = 0.25 * Math.sin(Math.min(1, (2.2 - this.pause) / 1.2) * Math.PI);
      if (this.pause <= 0) { a.pose.lean = 0; this.goHome(); }
      return;
    }
    if (this.busy || !near || !this.guests.length || !this.atHome) return;
    if ((this.ambientT -= dt) > 0) return;
    this.ambientT = 14 + Math.random() * 18;
    const i = Math.floor(Math.random() * this.guests.length), g = this.guests[i];
    let at = this.guestServe.get(i);
    if (at === undefined) this.guestServe.set(i, (at = serveOf(this.nav, g.x, g.z, g.face, g.table)));
    if (!at) return;
    this.goTo(at, () => { this.pause = 2.2; a.anim = 'bow'; setTimeout(() => { if (a.anim === 'bow') a.anim = 'idle'; }, 900); }, [g.table[0], g.table[2]]);
  }
}

/** One thing on the order. */
export interface OrderItem {
  /** A dish id (a passport stamp) or a counter snack's icon. */
  id: string;
  name: string;
  price: number;
  course: 'drink' | 'food' | 'sweet';
  dish: boolean;
  /** A line about it: the dish's tagline, or the snack's text. */
  text?: string;
  /** Its name in the local language, and the picture or emblem on the menu. */
  local?: string;
  icon?: string;
}

export interface VisitHost {
  bubble(key: string, text: string, pos: [number, number, number], secs: number): void;
  /** Open the menu card; it answers with `order()` or `noOrder()`. */
  menu(v: TableVisit): void;
  /** Open the bill; it answers with `pay(tip)`. */
  bill(v: TableVisit): void;
  /** Start a course in table mode, carried out by the waiter, and make it the meal being eaten. */
  serve(item: OrderItem, waiter: Actor, plate: THREE.Vector3, line: string): Meal;
  /** The kitchen at work: the cook's sizzle and a puff of steam. */
  cook(): void;
  /** A course has been eaten (stamps, the savour card). */
  eaten(item: OrderItem): void;
  /** Take the money. */
  charge(yen: number): void;
  sound(name: 'pop' | 'coin' | 'clink' | 'chime'): void;
  toast(icon: string, title: string, text: string): void;
}

/**
 * A traveller at one table: called → menu → (kitchen → carry → eating) per course → bill → paid. The order is
 * served drinks first, then the dishes, then the sweets. Leaving early pays for what was eaten.
 */
export class TableVisit {
  state: 'calling' | 'menu' | 'idle' | 'kitchen' | 'carry' | 'eating' | 'bill' | 'paying' | 'done' = 'calling';
  readonly eatenItems: OrderItem[] = [];
  /** The cover charge (coperto, couvert, otōshi) applies, and was not sent back. */
  cover: boolean;
  private queue: OrderItem[] = [];
  private kitchenT = 0;
  private meal: Meal | null = null;
  private plates: Meal[] = [];

  constructor(readonly seat: SeatSpot, readonly waiter: Waiter, readonly place: { name: string; local: string; kind: string }, private host: VisitHost, coverApplies: boolean) {
    this.cover = coverApplies;
    waiter.busy = true;
    this.call();
  }

  get waiterPos(): [number, number, number] { const q = this.waiter.actor.position; return [q.x, q.y + 2.15, q.z]; }

  /** Call the waiter over with the menu. */
  call(): void {
    if (this.state !== 'calling' && this.state !== 'idle') return;
    this.state = 'calling';
    const s = this.seat;
    this.waiter.goTo(s.serve ?? s.approach, () => {
      if (this.state !== 'calling') return;
      this.host.bubble('waiter', pick(DINING.hello), this.waiterPos, 3);
      this.host.sound('pop');
      this.state = 'menu';
      this.host.menu(this);
    }, [s.x, s.z]);
  }

  /** The order is in. */
  order(items: OrderItem[]): void {
    if (this.state !== 'menu') return;
    const rank = { drink: 0, food: 1, sweet: 2 };
    this.queue = [...items].sort((a, b) => rank[a.course] - rank[b.course]);
    this.host.bubble('waiter', pick(DINING.taken), this.waiterPos, 2.2);
    this.next();
  }

  /** The menu was closed without ordering: the waiter leaves you to it. */
  noOrder(): void {
    if (this.state !== 'menu') return;
    this.state = 'idle';
    this.host.bubble('waiter', 'Call me when you are ready!', this.waiterPos, 2);
    this.waiter.goHome();
  }

  /** The total so far: what has been eaten, plus the cover. */
  get due(): number { return this.eatenItems.reduce((t, i) => t + i.price, 0) + (this.cover && DINING.cover ? DINING.cover.price : 0); }

  pay(tip: number): void {
    if (this.state !== 'paying') return;
    this.host.charge(this.due + tip);
    this.host.sound('coin');
    this.state = 'done';
    this.host.bubble('waiter', pick(DINING.bye), this.waiterPos, 2.6);
    this.release();
  }

  /** The traveller gets up. Anything eaten and not paid for is paid on the way out (no tip). */
  leave(): void {
    if (this.state === 'done') return;
    const owed = this.eatenItems.length ? this.due : 0;
    if (owed > 0) {
      this.host.charge(owed);
      this.host.sound('coin');
      this.host.toast('receipt', `Paid ${this.place.name}`, 'You settled up on your way out.');
    }
    this.state = 'done';
    this.meal?.stop();
    this.release();
  }

  /** The meal currently eaten at the table, if any. */
  get eating(): Meal | null { return this.state === 'eating' || this.state === 'carry' ? this.meal : null; }

  /** The game finished a course (the last bite): from here it is the empties on the table. `ate` false: it never reached the table. */
  finished(m: Meal, ate = true): void {
    if (m !== this.meal) return;
    const item = this.servedItem;
    if (item && ate) { this.eatenItems.push(item); this.host.eaten(item); }
    if (!ate) { this.servedItem = null; this.meal = null; m.dispose(); return; }
    this.servedItem = null;
    if (m.leftover) this.plates.push(m);
    else m.dispose();
    this.meal = null;
    this.next();
  }

  private servedItem: OrderItem | null = null;

  /** The empties on the table, still to be cleared (the game draws them). */
  get onTable(): readonly Meal[] { return this.plates; }

  private next(): void {
    const item = this.queue.shift();
    if (!item) { this.bringBill(); return; }
    this.state = 'kitchen';
    // the first course takes the kitchen's time; the next is ready by the time the last one is finished
    this.kitchenT = this.eatenItems.length ? 1.2 : KITCHEN_SECS[item.course];
    this.servedItem = item;
    if (this.waiter.atHome) this.host.cook();
    else this.waiter.goHome(() => this.host.cook());
  }

  private bringBill(): void {
    this.state = 'bill';
    // a moment to sit back first, and the waiter back at the pass with the empties put down (see update)
    this.billT = 1.4;
  }

  private billT = 0;

  private goWithBill(): void {
    const s = this.seat;
    this.waiter.goTo(s.serve ?? s.approach, () => {
      if (this.state !== 'bill') return;
      this.clear();
      this.host.bubble('waiter', pick(DINING.bill), this.waiterPos, 2.6);
      this.host.sound('clink');
      this.state = 'paying';
      this.host.bill(this);
    }, [s.x, s.z]);
  }

  /** The waiter takes the empties away (the plates in hand go back with them to the pass). */
  private clear(): void {
    const a = this.waiter.actor;
    const take = this.plates.shift();
    for (const m of this.plates) m.dispose();
    this.plates.length = 0;
    if (take) { take.clearBy(a); this.carrying = take; }
  }

  private carrying: Meal | null = null;

  private release(): void {
    this.queue.length = 0;
    this.servedItem = null;
    if (this.meal && this.meal !== this.carrying) this.meal.dispose();
    this.meal = null;
    for (const m of this.plates) m.dispose();
    this.plates.length = 0;
    const w = this.waiter;
    w.goHome(() => { this.dropCarried(); w.busy = false; });
  }

  private dropCarried(): void {
    if (!this.carrying) return;
    this.carrying.dispose();
    this.carrying = null;
  }

  /** The plates in the waiter's hands, to be drawn (and posed) each frame. */
  get carried(): Meal | null { return this.carrying; }

  update(dt: number): void {
    if (this.state === 'bill' && this.billT > 0) {
      if ((this.billT -= dt) <= 0 && this.waiter.atHome) this.goWithBill();
      else if (this.billT <= 0) this.billT = 0.2;
      return;
    }
    if (this.state === 'kitchen') {
      if (!this.waiter.atHome || (this.kitchenT -= dt) > 0) return;
      const item = this.servedItem!;
      const s = this.seat;
      this.dropCarried();
      this.meal = this.host.serve(item, this.waiter.actor, s.plate!, pick(DINING.serve));
      this.state = 'carry';
      this.waiter.goTo(s.serve ?? s.approach, () => this.meal?.arrived(), [s.x, s.z]);
    } else if (this.state === 'carry' && this.meal?.served) {
      // the plate is down: take the last one's empties back to the pass
      this.state = 'eating';
      this.clear();
      this.waiter.goHome(() => this.dropCarried());
    }
  }
}
