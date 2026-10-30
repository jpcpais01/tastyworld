import { Actor, Anim } from './actors';
import type { Nav } from './nav';
import type { Anchors, StallAnchor } from '../world/tokyo';
import type { RoomAnchor, RoomKind } from '../world/interiors';
import type { Look } from '../world/characters';
import { CROWD_CHAT, CROWD_GREET, CROWD_STARTLE, CROWD_ENVY } from '../data/dialogue';

/**
 * Passers-by with a little life of their own. Each one has a persona and a pace, follows the
 * street graph, and at every junction picks something to do based on the time of day: browse a
 * stall and buy a snack, eat it on a bench, pop into a shop or an izakaya, stop for a photo or a
 * phone call, chat with someone they bump into, or head home for the night. Some walk in pairs.
 * They steer around each other and the player, glance at you, greet you if you stop nearby and
 * jump if you run into them.
 */

type V2 = [number, number];
type Persona = 'commuter' | 'local' | 'tourist' | 'student' | 'elder';

interface Seat { x: number; z: number; face: number; approach: V2; bench: number; taken: Walker | null; }

type Goal =
  | { k: 'node' }
  | { k: 'browse'; stall: StallAnchor; face: number }
  | { k: 'shop'; room: RoomAnchor; face: number }
  | { k: 'sit'; seat: Seat }
  | { k: 'home'; room: RoomAnchor }
  | { k: 'pause' };

type Doing =
  | { k: 'wait'; t: number; anim: Anim; face?: number }
  | { k: 'browse'; t: number; face: number; stall?: StallAnchor; served: boolean }
  | { k: 'sit'; seat: Seat; t: number; stage: 0 | 1 | 2; s: number }
  | { k: 'chat'; t: number; with: Walker; talk: boolean; swap: number };

interface Walker {
  actor: Actor;
  persona: Persona;
  node: number;
  prev: number;
  path: V2[];
  /** Current steering target: the next waypoint shifted into this walker's lane. */
  tgt: V2 | null;
  goal: Goal;
  doing: Doing | null;
  pace: number;
  v: number;
  lane: number;
  side: number;
  food: number;
  hidden: boolean;
  wantHome: boolean;
  lead: Walker | null;
  mate: Walker | null;
  mateSeat: Seat | null;
  chatCool: number;
  greetCool: number;
  nearT: number;
  stuck: number;
  stuckRef: V2;
  run: boolean;
  /** Seconds left of walking straight down the path, ignoring walls and people (to get unstuck). */
  ghost: number;
  /** Where we last stood up or walked out from (to get back onto the graph). */
  from: V2 | null;
  hideT: number;
}

export interface CrowdPlayer { x: number; z: number; speed: number; running: boolean; eating: boolean; facing: number; }

export interface CrowdHooks {
  bubble(key: string, text: string, pos: [number, number, number], seconds: number): void;
  /** A stall vendor serves a customer standing at (x, z). */
  serve(stallId: string, x: number, z: number): void;
  /** Overheard lines are only shown while the player is free to read them. */
  quiet(): boolean;
}

const PERSONA_PACE: Record<Persona, number> = { commuter: 1.35, local: 1.05, tourist: 0.9, student: 1.2, elder: 0.72 };
const SNACK_ROOMS: RoomKind[] = ['bakery', 'cafe', 'konbini'];

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const angTo = (ax: number, az: number, bx: number, bz: number) => Math.atan2(bx - ax, bz - az);
const bump = (h: number, c: number, w: number) => Math.exp(-((h - c) * (h - c)) / (2 * w * w));

function personaOf(l: Look): Persona {
  if (l.topStyle === 'suit') return 'commuter';
  if (l.hair === 0xb9b6b0 || l.hair === 0x6b6b70) return 'elder';
  if (l.topStyle === 'sailor') return 'student';
  if (l.backpack !== undefined || l.hat === 'bucket' || l.hat === 'straw') return 'tourist';
  return 'local';
}

/** Share of the crowd out on the street at a given hour. */
function turnout(h: number): number {
  if (h < 5) return 0.3;
  if (h < 7) return 0.3 + (h - 5) * 0.3;
  if (h < 22) return 1;
  return 1 - (h - 22) * 0.3;
}

function roomOpen(kind: RoomKind, h: number): boolean {
  switch (kind) {
    case 'izakaya': return h >= 17 || h < 1;
    case 'konbini': return true;
    case 'cafe': case 'bakery': case 'kissa': return h >= 7 && h < 20;
    default: return h >= 9.5 && h < 21;
  }
}

export class Crowd {
  readonly walkers: Walker[] = [];
  private seats: Seat[] = [];
  private stallSpots = new Map<string, { p: V2; taken: Walker | null }[]>();
  private routes = new Map<string, V2[]>();
  private budget = 0;
  private popT = 0;
  private chatT = 0;
  private sayT = 4;
  private nodes: V2[];
  private obstacles: V2[] = [];
  private friends: [number, number][] = [];
  private nbrs: number[][];

  constructor(private nav: Nav, private a: Anchors, private hooks: CrowdHooks) {
    this.nodes = a.graph.nodes;
    this.nbrs = this.nodes.map((_, i) => a.graph.edges.filter((e) => e[0] === i || e[1] === i).map((e) => (e[0] === i ? e[1] : e[0])));
    // two seats per bench, each with a walkable spot to sit down from
    a.benches.forEach(([bx, bz, f], bi) => {
      const fz = Math.cos(f);
      for (const sx of [-0.38, 0.38]) {
        const cand: V2[] = [[bx + sx, bz + 0.75 * fz], [bx + sx, bz + 0.62 * fz], [bx + Math.sign(sx) * 1.2, bz + 0.3 * fz], [bx - Math.sign(sx) * 1.2, bz + 0.3 * fz], [bx + Math.sign(sx) * 1.2, bz]];
        const ap = cand.find(([x, z]) => this.free(x, z));
        if (ap) this.seats.push({ x: bx + sx, z: bz - 0.04 * fz, face: f, approach: ap, bench: bi, taken: null });
      }
    });
    // customers queue beside the player's spot at each stall, never on it
    for (const s of a.stalls) {
      const vx = s.stand[0] - s.vendor[0], vz = s.stand[1] - s.vendor[1], vl = Math.hypot(vx, vz) || 1;
      const ux = vx / vl, uz = vz / vl;
      const cand: V2[] = [[s.stand[0] - uz * 0.62, s.stand[1] + ux * 0.62], [s.stand[0] + uz * 0.62, s.stand[1] - ux * 0.62], [s.stand[0] + ux * 0.6, s.stand[1] + uz * 0.6]];
      this.stallSpots.set(s.id, cand.filter(([x, z]) => this.free(x, z)).map((p) => ({ p, taken: null })));
    }
  }

  private free(x: number, z: number): boolean {
    return this.nav.canStand(x, z, this.nav.standHeightVox(x, z), 0.16);
  }

  /** Adds a pedestrian (or a pair walking together when `mateOf` is given). */
  add(actor: Actor, look: Look, node: number, mateOf?: Walker): Walker {
    const persona = personaOf(look);
    const w: Walker = {
      actor, persona, node, prev: -1, path: [], tgt: null, goal: { k: 'node' }, doing: null,
      pace: PERSONA_PACE[persona] * rnd(0.88, 1.12), v: 0, lane: rnd(-0.6, 0.6), side: Math.random() < 0.5 ? 1 : -1,
      food: 0, hidden: false, wantHome: false, lead: null, mate: null, mateSeat: null,
      chatCool: rnd(5, 25), greetCool: rnd(0, 20), nearT: 0, stuck: 0, stuckRef: [0, 0], run: false, ghost: 0, from: null, hideT: 0,
    };
    const [nx, nz] = this.nodes[node];
    actor.position.set(nx, this.nav.heightAt(nx, nz), nz);
    if (mateOf) {
      w.lead = mateOf;
      mateOf.mate = w;
      w.pace = mateOf.pace;
      actor.position.copy(mateOf.actor.position).x += 0.6;
    }
    this.walkers.push(w);
    return w;
  }

  /** People standing about (story characters) that walkers step around. */
  addObstacle(x: number, z: number): void {
    this.obstacles.push([x, z]);
  }

  /** Walkers out on the street right now. */
  *visible(): Generator<Actor> {
    for (const w of this.walkers) if (!w.hidden) yield w.actor;
  }

  /** Puts the right share of the crowd indoors for the starting hour. */
  settle(hour: number): void {
    const units = this.walkers.filter((w) => !w.lead);
    const out = Math.round(units.length * turnout(hour));
    for (const w of units.slice(out)) { this.hide(w); if (w.mate) this.hide(w.mate); }
  }

  /** `friends` are co-op travellers, stepped around like the player. */
  update(dt: number, hour: number, pl: CrowdPlayer, friends: [number, number][] = []): void {
    this.budget = 1;
    this.friends = friends;
    this.population(dt, hour, pl);
    const ws = this.walkers;
    for (const w of ws) {
      if (w.hidden) continue;
      w.chatCool -= dt; w.greetCool -= dt;
      // a snack lasts a while, longer if it is being saved for a bench
      if (w.food > 0 && !(w.goal.k === 'sit' && !w.doing)) { w.food -= dt; if (w.food <= 0) w.actor.hold = 'none'; }
      if (w.lead) this.follow(w, dt, pl);
      else if (w.doing) this.doing(w, dt, hour);
      else if (w.tgt || w.path.length) this.walk(w, dt, pl);
      else this.arrive(w, hour);
      this.react(w, dt, pl, hour);
      const p = w.actor.position;
      if (w.doing?.k !== 'sit') p.y = this.nav.heightAt(p.x, p.z);
    }
    this.meetings(dt);
    this.overhear(dt, pl);
  }

  // ------------------------------------------------------------------ routes

  private nearestNode(x: number, z: number): number {
    let best = 0, bd = Infinity;
    this.nodes.forEach(([nx, nz], i) => { const d = Math.hypot(nx - x, nz - z); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  /** Cached A* route; undefined when this frame's path budget is spent, [] when unreachable. */
  private route(key: string, ax: number, az: number, bx: number, bz: number): V2[] | undefined {
    let r = this.routes.get(key);
    if (r) return r;
    if (this.budget <= 0) return undefined;
    this.budget--;
    r = this.nav.findPath(ax, az, bx, bz) ?? [];
    if (r.length) {
      const [ex, ez] = r[r.length - 1];
      if (Math.hypot(ex - bx, ez - bz) > 0.6) r = [];
      else r[r.length - 1] = [bx, bz];
    }
    this.routes.set(key, r);
    return r;
  }

  private setPath(w: Walker, path: V2[], goal: Goal): void {
    w.path = path.slice();
    w.goal = goal;
    w.tgt = null;
    w.lane = goal.k === 'node' ? rnd(-0.6, 0.6) : rnd(-0.3, 0.3);
    w.stuck = 0;
  }

  /** Back onto the street graph from wherever an activity left us. */
  private leave(w: Walker): void {
    w.doing = null;
    w.actor.anim = 'idle';
    const p = w.actor.position;
    const from: V2 = w.from ?? [p.x, p.z];
    const n = this.nearestNode(from[0], from[1]);
    const r = this.route(`${from[0].toFixed(1)},${from[1].toFixed(1)}>${n}`, from[0], from[1], this.nodes[n][0], this.nodes[n][1]);
    if (!r) { w.from = from; w.doing = { k: 'wait', t: 0.2, anim: 'idle' }; return; } // out of path budget, try next time
    w.from = null;
    w.node = n;
    this.setPath(w, r.length ? r : [this.nodes[n]], { k: 'node' });
  }

  // ------------------------------------------------------------------ deciding

  private arrive(w: Walker, hour: number): void {
    const g = w.goal, p = w.actor.position;
    w.actor.anim = 'idle';
    w.run = false;
    switch (g.k) {
      case 'browse':
        w.doing = { k: 'browse', t: rnd(2.5, 4.5), face: g.face, stall: g.stall, served: false };
        w.from = [p.x, p.z];
        return;
      case 'shop':
        w.doing = { k: 'browse', t: rnd(4, 9), face: g.face, served: false };
        if (SNACK_ROOMS.includes(g.room.kind) && Math.random() < 0.45) w.food = -1; // buys something on the way out
        w.from = [p.x, p.z];
        return;
      case 'sit':
        w.doing = { k: 'sit', seat: g.seat, t: rnd(14, 38) + (w.food > 0 ? 8 : 0), stage: 0, s: 0 };
        w.from = g.seat.approach;
        return;
      case 'home':
        this.hide(w);
        return;
      case 'pause': {
        const anim: Anim = w.persona === 'tourist' && Math.random() < 0.6 ? 'photo' : Math.random() < 0.55 ? 'phone' : 'idle';
        w.doing = { k: 'wait', t: rnd(3, 7), anim, face: w.actor.facing + rnd(-1.2, 1.2) };
        return;
      }
    }
    this.choose(w, hour);
  }

  private choose(w: Walker, hour: number): void {
    const [nx, nz] = this.nodes[w.node];
    const rush = w.persona === 'commuter' && (bump(hour, 8, 0.9) > 0.3 || bump(hour, 18, 0.8) > 0.3);
    const meal = 0.35 + 1.3 * bump(hour, 12.3, 1.2) + 1.0 * bump(hour, 19, 1.3) + 0.4 * bump(hour, 15.5, 0.8);
    const day = hour >= 7 && hour < 21.5;
    type Opt = { w: number; go: () => boolean };
    const opts: Opt[] = [];
    if (w.wantHome) {
      const homes = this.a.rooms.filter((r) => Math.hypot(r.door[0] - nx, r.door[1] - nz) < 16);
      const r = homes.length ? pick(homes) : null;
      if (r) opts.push({ w: 6, go: () => this.plan(w, `home:${r.id}`, r.door, { k: 'home', room: r }) });
    }
    opts.push({ w: 1.6 + (rush ? 4 : 0), go: () => this.roam(w, hour, rush) });
    if (!rush) {
      opts.push({ w: w.persona === 'tourist' ? 0.5 : 0.18, go: () => { w.goal = { k: 'pause' }; return true; } });
      if (w.food <= 0) {
        for (const s of this.a.stalls) {
          const d = Math.hypot(s.stand[0] - nx, s.stand[1] - nz);
          if (d > 15) continue;
          const spot = this.stallSpots.get(s.id)?.find((q) => !q.taken);
          if (!spot) continue;
          opts.push({
            w: (meal * (w.persona === 'tourist' ? 1.3 : 1)) / (1 + d / 8),
            go: () => {
              const ok = this.plan(w, `stall:${s.id}:${spot.p[0]},${spot.p[1]}`, spot.p, { k: 'browse', stall: s, face: angTo(spot.p[0], spot.p[1], s.vendor[0], s.vendor[1]) });
              if (ok) spot.taken = w;
              return ok;
            },
          });
        }
      }
      const seat = this.freeSeat(nx, nz, !!w.mate);
      if (seat) {
        opts.push({
          w: (day ? 0.35 : 0.12) + (w.food > 0 ? 1.4 : 0) + (w.persona === 'elder' ? 0.5 : 0),
          go: () => {
            const ok = this.plan(w, `seat:${seat.x},${seat.z}`, seat.approach, { k: 'sit', seat });
            if (ok) {
              seat.taken = w;
              if (w.mate) { w.mateSeat = this.seats.find((s) => s.bench === seat.bench && s !== seat && !s.taken) ?? null; if (w.mateSeat) w.mateSeat.taken = w.mate; }
            }
            return ok;
          },
        });
      }
      for (const r of this.a.rooms) {
        const buy = r.spots.find((s) => s.kind === 'buy');
        if (!buy || !roomOpen(r.kind, hour)) continue;
        const d = Math.hypot(r.door[0] - nx, r.door[1] - nz);
        if (d > 11) continue;
        const night = r.kind === 'izakaya' ? 1.6 : 1;
        opts.push({
          w: (0.22 * night) / (1 + d / 6),
          go: () => {
            const [sx, sz] = this.shopSpot(r, buy.stand);
            return this.plan(w, `room:${r.id}:${sx.toFixed(2)}`, [sx, sz], { k: 'shop', room: r, face: angTo(sx, sz, buy.pos[0], buy.pos[2]) });
          },
        });
      }
    }
    let total = 0;
    for (const o of opts) total += o.w;
    let roll = Math.random() * total;
    for (const o of opts) {
      roll -= o.w;
      if (roll <= 0) { if (o.go()) return; break; }
    }
    if (!this.roam(w, hour, rush)) w.doing = { k: 'wait', t: 0.3, anim: 'idle' };
  }

  private roam(w: Walker, hour: number, rush: boolean): boolean {
    const nb = this.nbrs[w.node];
    if (!nb.length) return false;
    let next = pick(nb);
    if (nb.length > 1 && next === w.prev) next = nb.find((x) => x !== w.prev)!;
    const a = this.nodes[w.node], b = this.nodes[next];
    const r = this.route(`${w.node}-${next}`, a[0], a[1], b[0], b[1]);
    if (!r) return false;
    w.prev = w.node;
    w.node = next;
    this.setPath(w, r.length ? r : [b], { k: 'node' });
    // late for the train
    w.run = rush && hour < 9.5 && Math.random() < 0.18 && !w.mate;
    return true;
  }

  /** Path from the current node to an activity spot. */
  private plan(w: Walker, key: string, to: V2, goal: Goal): boolean {
    const [nx, nz] = this.nodes[w.node];
    const r = this.route(`${w.node}>${key}`, nx, nz, to[0], to[1]);
    if (!r || !r.length) return false;
    this.setPath(w, r, goal);
    return true;
  }

  private freeSeat(x: number, z: number, pair: boolean): Seat | null {
    let best: Seat | null = null, bd = 16;
    for (const s of this.seats) {
      if (s.taken) continue;
      if (pair && !this.seats.some((o) => o.bench === s.bench && o !== s && !o.taken)) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d < bd) { bd = d; best = s; }
    }
    return best;
  }

  private shopSpot(r: RoomAnchor, st: V2): V2 {
    const c: V2[] = [[st[0] + 0.4, st[1]], [st[0] - 0.4, st[1]], [st[0], st[1] + 0.4], [st[0], st[1] - 0.4]];
    return pick(c.filter(([x, z]) => this.free(x, z) && x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3])) ?? st;
  }

  // ------------------------------------------------------------------ moving

  /**
   * Steers towards (tx, tz) around other people, sliding along walls. Returns the distance left.
   * Japanese pavements have no strict side, so each walker dodges towards their own lane.
   */
  private steer(w: Walker, tx: number, tz: number, speed: number, dt: number, pl: CrowdPlayer, ignore: Walker | null): number {
    const a = w.actor, p = a.position;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) { w.v = 0; return 0; }
    const ux = dx / d, uz = dz / d;
    let ax = 0, az = 0, slow = 1;
    const avoid = (ox: number, oz: number, r: number) => {
      const rx = ox - p.x, rz = oz - p.z, r2 = rx * rx + rz * rz;
      if (r2 > r * r || r2 < 1e-6) return;
      const od = Math.sqrt(r2), ahead = rx * ux + rz * uz;
      if (ahead < -0.15) return;
      const lat = rx * -uz + rz * ux;
      const push = (r - od) / r;
      const sd = lat > 0.04 ? -1 : lat < -0.04 ? 1 : (w.lane >= 0 ? 1 : -1);
      ax += -uz * sd * push * 1.4; az += ux * sd * push * 1.4;
      if (od < 0.55 && ahead > 0.12) slow = Math.min(slow, Math.max(0.15, (od - 0.32) / 0.23));
    };
    for (const o of this.walkers) if (o !== w && o !== ignore && !o.hidden) avoid(o.actor.position.x, o.actor.position.z, 1.1);
    avoid(pl.x, pl.z, 1.3);
    for (const [ox, oz] of this.obstacles) avoid(ox, oz, 0.9);
    for (const [ox, oz] of this.friends) avoid(ox, oz, 1.3);
    let mx = ux + ax, mz = uz + az;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const want = speed * slow;
    w.v += (want - w.v) * Math.min(1, dt * (want > w.v ? 3.5 : 6));
    const step = Math.min(w.v * dt, d);
    if (step > 1e-4) {
      // path cells are walkable even where a full body would brush a wall, so fall back to the path
      const m = w.ghost > 0 ? null : this.nav.slide(p.x, p.z, mx, mz, step, this.nav.standHeightVox(p.x, p.z), w.side);
      if (m && (m.x - p.x) * ux + (m.z - p.z) * uz > step * 0.2) {
        const sx = m.x - p.x, sz = m.z - p.z;
        p.x = m.x; p.z = m.z; w.side = m.side;
        if (sx * sx + sz * sz > 1e-8) a.targetFacing = Math.atan2(sx, sz);
      } else if (w.path.length || w.ghost > 0) {
        p.x += ux * step; p.z += uz * step;
        a.targetFacing = Math.atan2(ux, uz);
      } else if (m) { p.x = m.x; p.z = m.z; w.side = m.side; }
      else w.v = 0;
    }
    a.speed = w.v;
    a.anim = w.v < 0.06 ? 'idle' : w.run && w.v > 1.9 ? 'run' : 'walk';
    return Math.hypot(tx - p.x, tz - p.z);
  }

  private walk(w: Walker, dt: number, pl: CrowdPlayer): void {
    const p = w.actor.position;
    if (!w.tgt) {
      const wp = w.path[0];
      const last = w.path.length === 1;
      // shift the waypoint sideways into this walker's lane, if there is room
      let t: V2 = [wp[0], wp[1]];
      if (!last || w.goal.k === 'node') {
        const dx = wp[0] - p.x, dz = wp[1] - p.z, dl = Math.hypot(dx, dz) || 1;
        const ox = wp[0] - (dz / dl) * w.lane, oz = wp[1] + (dx / dl) * w.lane;
        if (this.free(ox, oz)) t = [ox, oz];
      }
      w.tgt = t;
    }
    const last = w.path.length <= 1;
    const speed = w.run ? 2.7 : w.pace;
    const left = this.steer(w, w.tgt[0], w.tgt[1], speed * (last && w.goal.k !== 'node' ? Math.min(1, 0.45 + Math.hypot(w.tgt[0] - p.x, w.tgt[1] - p.z)) : 1), dt, pl, w.mate);
    if (left < (last ? 0.12 : 0.35)) {
      w.path.shift();
      w.tgt = null;
      if (!w.path.length) { w.v *= 0.5; w.actor.anim = 'idle'; w.actor.speed = 0; }
    }
    // hardly moving: drop the lane and walk straight down the path for a moment
    w.ghost = Math.max(0, w.ghost - dt);
    w.stuck += dt;
    if (w.stuck > 2) {
      const moved = Math.hypot(p.x - w.stuckRef[0], p.z - w.stuckRef[1]);
      w.stuckRef = [p.x, p.z];
      if (moved < 0.4 && w.path.length) { w.lane = 0; w.tgt = null; w.ghost = 1.2; w.side = -w.side; }
      w.stuck = 0;
    }
  }

  // ------------------------------------------------------------------ activities

  private doing(w: Walker, dt: number, hour: number): void {
    const d = w.doing!, a = w.actor, p = a.position;
    a.speed = 0;
    w.v = 0;
    switch (d.k) {
      case 'wait':
        a.anim = d.anim;
        if (d.face !== undefined) a.targetFacing = d.face;
        if ((d.t -= dt) <= 0) {
          w.doing = null;
          a.anim = 'idle';
          if (w.from) this.leave(w); // done at an activity spot
          else if (!w.path.length && !w.tgt) this.choose(w, hour);
        }
        return;
      case 'browse':
        a.targetFacing = d.face;
        d.t -= dt;
        if (!d.served) {
          a.anim = 'browse';
          if (d.t <= 0) {
            d.served = true;
            d.t = 1.1;
            if (d.stall) this.hooks.serve(d.stall.id, p.x, p.z);
            a.anim = 'bow';
          }
        } else if (d.t <= 0) {
          if (d.stall) {
            for (const q of this.stallSpots.get(d.stall.id) ?? []) if (q.taken === w) q.taken = null;
            this.giveFood(w);
            // eat right here, carry it off, or find a bench
            if (Math.random() < 0.4) {
              w.doing = { k: 'wait', t: rnd(5, 9), anim: 'eat', face: d.face };
              for (const m of w.mate ? [w, w.mate] : [w]) { m.food = 0; m.actor.hold = 'none'; }
              return;
            }
          } else if (w.food < 0) this.giveFood(w);
          else w.food = 0;
          this.leave(w);
        }
        return;
      case 'sit': {
        const s = d.seat;
        a.targetFacing = s.face;
        if (d.stage === 0) {
          d.s = Math.min(1, d.s + dt * 1.8);
          const e = d.s * d.s * (3 - 2 * d.s);
          p.x = s.approach[0] + (s.x - s.approach[0]) * e;
          p.z = s.approach[1] + (s.z - s.approach[1]) * e;
          p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + -0.08 * e;
          a.anim = d.s > 0.35 ? (w.food > 0 ? 'sitEat' : 'sit') : 'idle';
          if (d.s >= 1) d.stage = 1;
        } else if (d.stage === 1) {
          a.anim = w.food > 0 ? 'sitEat' : 'sit';
          if (w.food > 0) a.hold = 'none';
          // after the snack, a look at the phone now and then
          else if (Math.random() < dt * 0.05) a.hold = a.hold === 'phone' ? 'none' : 'phone';
          d.t -= dt;
          // the lead of a pair waits for the other to settle before getting up
          if (d.t <= 0) { d.stage = 2; d.s = 1; a.hold = 'none'; }
        } else {
          d.s = Math.max(0, d.s - dt * 2);
          const e = d.s * d.s * (3 - 2 * d.s);
          p.x = s.approach[0] + (s.x - s.approach[0]) * e;
          p.z = s.approach[1] + (s.z - s.approach[1]) * e;
          p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + -0.08 * e;
          a.anim = d.s > 0.35 ? 'sit' : 'idle';
          if (d.s <= 0) {
            if (s.taken === w) s.taken = null;
            w.food = 0;
            this.leave(w);
          }
        }
        return;
      }
      case 'chat': {
        a.targetFacing = angTo(p.x, p.z, d.with.actor.position.x, d.with.actor.position.z);
        d.swap -= dt;
        if (d.swap <= 0) { d.talk = !d.talk; d.swap = rnd(1.8, 3.6); }
        a.anim = d.talk ? 'talk' : 'listen';
        if ((d.t -= dt) <= 0 || d.with.hidden || d.with.doing?.k !== 'chat') {
          w.doing = null;
          a.anim = 'idle';
          w.chatCool = rnd(35, 70);
          w.tgt = null;
          if (!w.path.length) this.choose(w, hour);
        }
        return;
      }
    }
  }

  private giveFood(w: Walker): void {
    w.food = rnd(22, 40);
    w.actor.hold = 'food';
    if (w.mate) { w.mate.food = w.food; w.mate.actor.hold = 'food'; }
  }

  /** The second of a pair walks beside the first, waits outside shops and sits on the same bench. */
  private follow(w: Walker, dt: number, pl: CrowdPlayer): void {
    const L = w.lead!, a = w.actor, p = a.position, q = L.actor.position;
    if (L.hidden) {
      w.hideT += dt;
      if (w.hideT > 2.5 || Math.hypot(q.x - p.x, q.z - p.z) < 1.2) this.hide(w);
      else this.steer(w, q.x, q.z, L.pace * 1.2, dt, pl, L);
      return;
    }
    w.hideT = 0;
    const ld = L.doing;
    // sitting together on one bench
    if (w.doing?.k === 'sit') {
      const d = w.doing, s = d.seat;
      if ((ld?.k !== 'sit' || ld.stage === 2) && d.stage < 2) d.stage = 2;
      if (d.stage === 0) { d.s = Math.min(1, d.s + dt * 1.8); if (d.s >= 1) d.stage = 1; }
      else if (d.stage === 2) d.s = Math.max(0, d.s - dt * 2);
      const e = d.s * d.s * (3 - 2 * d.s);
      p.x = s.approach[0] + (s.x - s.approach[0]) * e;
      p.z = s.approach[1] + (s.z - s.approach[1]) * e;
      p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + -0.08 * e;
      a.targetFacing = s.face;
      a.speed = 0; w.v = 0;
      a.anim = d.s > 0.35 ? (w.food > 0 ? 'sitEat' : 'sit') : 'idle';
      if (w.food > 0) a.hold = 'none';
      // turn to the other one now and then
      if (ld?.k === 'sit' && d.stage === 1) a.headYawTarget = Math.sin(L.actor.animT * 0.3) > 0.3 ? (s.x < ld.seat.x ? 0.7 : -0.7) * Math.sign(Math.cos(s.face)) : 0;
      if (d.stage === 2 && d.s <= 0) { w.doing = null; s.taken = null; if (L.mateSeat === s) L.mateSeat = null; a.headYawTarget = 0; w.food = 0; }
      return;
    }
    if (ld?.k === 'sit' && L.mateSeat && ld.stage !== 2) {
      ld.t = Math.max(ld.t, 4); // the lead waits until we have sat down too
      const s = L.mateSeat;
      if (this.steer(w, s.approach[0], s.approach[1], w.pace, dt, pl, L) < 0.12) w.doing = { k: 'sit', seat: s, t: 0, stage: 0, s: 0 };
      return;
    }
    if (L.mateSeat && ld?.k !== 'sit') { L.mateSeat.taken = null; L.mateSeat = null; }
    const inRoom = this.a.rooms.find((r) => q.x >= r.rect[0] && q.x <= r.rect[2] && q.z >= r.rect[1] && q.z <= r.rect[3]);
    const myRoom = inRoom && p.x >= inRoom.rect[0] - 0.4 && p.x <= inRoom.rect[2] + 0.4 && p.z >= inRoom.rect[1] - 0.4 && p.z <= inRoom.rect[3] + 0.4;
    const dist = Math.hypot(q.x - p.x, q.z - p.z);
    if (inRoom && !myRoom) {
      // wait by the door with the phone out
      a.anim = 'idle';
      a.speed = 0;
      w.v = 0;
      a.hold = w.food > 0 ? 'food' : 'phone';
      return;
    }
    if (a.hold === 'phone' && w.food <= 0) a.hold = 'none';
    // a spot at the lead's side
    const f = L.actor.facing, rx = Math.cos(f), rz = -Math.sin(f);
    let tx = q.x - rx * 0.58, tz = q.z - rz * 0.58;
    if (!this.free(tx, tz)) { tx = q.x + rx * 0.58; tz = q.z + rz * 0.58; }
    if (!this.free(tx, tz)) { tx = q.x - Math.sin(f) * 0.7; tz = q.z - Math.cos(f) * 0.7; }
    const still = !!ld || L.v < 0.1;
    if (dist > 6 && Math.hypot(pl.x - p.x, pl.z - p.z) > 14) { p.x = tx; p.z = tz; } // lost: catch up out of sight
    const gap = Math.hypot(tx - p.x, tz - p.z);
    if (still && gap < 0.25) {
      a.speed = 0; w.v = 0;
      a.targetFacing = angTo(p.x, p.z, q.x, q.z);
      a.anim = ld?.k === 'browse' ? 'browse' : ld?.k === 'wait' && ld.anim === 'eat' ? 'eat' : ld?.k === 'chat' ? 'listen' : (Math.sin(L.actor.animT * 0.4 + 1) > 0 ? 'talk' : 'listen');
      if (ld?.k === 'wait' && ld.anim === 'eat') a.hold = 'none';
      return;
    }
    const sp = still ? Math.min(w.pace, 0.4 + gap) : L.v * (1 + Math.max(-0.4, Math.min(0.7, (gap - 0.15) * 0.9)));
    w.run = L.run;
    this.steer(w, tx, tz, Math.max(0.3, sp), dt, pl, L);
  }

  // ------------------------------------------------------------------ social

  /** Two people who bump into each other sometimes stop for a chat. */
  private meetings(dt: number): void {
    this.chatT -= dt;
    if (this.chatT > 0) return;
    this.chatT = 0.5;
    const free = this.walkers.filter((w) => !w.hidden && !w.lead && !w.mate && !w.doing && w.chatCool <= 0 && w.goal.k === 'node' && w.path.length > 0);
    for (let i = 0; i < free.length; i++) for (let j = i + 1; j < free.length; j++) {
      const a = free[i], b = free[j];
      if (a.doing || b.doing) continue;
      const pa = a.actor.position, pb = b.actor.position;
      const d = Math.hypot(pa.x - pb.x, pa.z - pb.z);
      if (d > 1.7 || d < 0.5) continue;
      const soc = (a.persona === 'commuter' ? 0.3 : 1) * (b.persona === 'commuter' ? 0.3 : 1);
      if (Math.random() > 0.4 * soc) { a.chatCool = b.chatCool = rnd(8, 15); continue; }
      const t = rnd(6, 13);
      a.doing = { k: 'chat', t, with: b, talk: true, swap: rnd(2, 3.5) };
      b.doing = { k: 'chat', t, with: a, talk: false, swap: rnd(2, 3.5) };
    }
  }

  private react(w: Walker, dt: number, pl: CrowdPlayer, hour: number): void {
    const a = w.actor, p = a.position;
    const dx = pl.x - p.x, dz = pl.z - p.z, d = Math.hypot(dx, dz);
    const rel = Math.atan2(Math.sin(Math.atan2(dx, dz) - a.facing), Math.cos(Math.atan2(dx, dz) - a.facing));
    const sitting = w.doing?.k === 'sit';
    // glance at the traveller
    if (d < 3 && Math.abs(rel) < 1.9) a.headYawTarget = Math.max(-0.9, Math.min(0.9, rel));
    else if (!(w.lead && sitting)) a.headYawTarget = 0;
    // never interrupt an errand, only walking, pausing or eating
    if (w.lead || (w.doing && w.doing.k !== 'wait')) return;
    // someone sprinting past makes people jump
    if (pl.running && d < 0.85 && !(w.doing?.k === 'wait' && w.doing.anim === 'startle')) {
      w.doing = { k: 'wait', t: 0.7, anim: 'startle', face: Math.atan2(dx, dz) };
      if (Math.random() < 0.4) this.say(`startle-${this.walkers.indexOf(w)}`, pick(CROWD_STARTLE), p, 1.6, pl);
      return;
    }
    // stop next to someone for a moment and they may say hello
    if (d < 1.8 && pl.speed < 0.1) w.nearT += dt; else w.nearT = 0;
    if (w.nearT > 1.0 && w.greetCool <= 0) {
      w.greetCool = rnd(50, 90);
      w.nearT = 0;
      if (Math.random() < 0.5) {
        w.doing = { k: 'wait', t: 1.6, anim: Math.random() < 0.5 ? 'bow' : 'wave', face: Math.atan2(dx, dz) };
        const tod = hour < 10.5 && hour >= 4 ? 'morning' : hour < 17.5 ? 'day' : 'evening';
        this.say(`greet-${this.walkers.indexOf(w)}`, pick(pl.eating ? CROWD_ENVY : CROWD_GREET[tod]), p, 2.2, pl);
      }
    }
  }

  private say(key: string, text: string, p: { x: number; y: number; z: number }, secs: number, pl: CrowdPlayer): void {
    if (this.hooks.quiet() || Math.hypot(pl.x - p.x, pl.z - p.z) > 9) return;
    this.hooks.bubble(key, text, [p.x, p.y + 2.1, p.z], secs);
  }

  /** Now and then a line from a nearby conversation drifts over. */
  private overhear(dt: number, pl: CrowdPlayer): void {
    if ((this.sayT -= dt) > 0) return;
    this.sayT = rnd(5, 10);
    const talkers = this.walkers.filter((w) => !w.hidden && w.actor.anim === 'talk' && Math.hypot(pl.x - w.actor.position.x, pl.z - w.actor.position.z) < 7);
    if (talkers.length) {
      const w = pick(talkers);
      this.say(`chat-${this.walkers.indexOf(w)}`, pick(CROWD_CHAT), w.actor.position, 2.8, pl);
    }
  }

  // ------------------------------------------------------------------ daily rhythm

  private hide(w: Walker): void {
    w.hidden = true;
    w.actor.root.visible = false;
    w.doing = null;
    w.path = [];
    w.tgt = null;
    w.wantHome = false;
    w.food = 0;
    w.actor.hold = 'none';
    for (const s of this.seats) if (s.taken === w) s.taken = null;
    for (const l of this.stallSpots.values()) for (const q of l) if (q.taken === w) q.taken = null;
  }

  private population(dt: number, hour: number, pl: CrowdPlayer): void {
    if ((this.popT -= dt) > 0) return;
    this.popT = 2.5;
    const units = this.walkers.filter((w) => !w.lead);
    const out = units.filter((w) => !w.hidden);
    const want = Math.round(units.length * turnout(hour));
    if (out.length > want) {
      const w = out.find((u) => !u.wantHome && !u.doing);
      if (w) w.wantHome = true;
    } else if (out.length < want) {
      const w = pick(units.filter((u) => u.hidden));
      const doors = this.a.rooms.filter((r) => Math.hypot(r.door[0] - pl.x, r.door[1] - pl.z) > 10);
      if (!w || !doors.length) return;
      // step out of a doorway somewhere off camera
      const r = pick(doors);
      for (const m of w.mate ? [w, w.mate] : [w]) {
        m.hidden = false;
        m.actor.root.visible = true;
        m.actor.position.set(r.door[0] + (m === w ? 0 : 0.4), this.nav.heightAt(r.door[0], r.door[1]), r.door[1]);
        m.actor.anim = 'idle';
        m.v = 0;
      }
      w.from = [r.door[0], r.door[1]];
      this.leave(w);
    }
  }
}
