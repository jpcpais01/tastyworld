import { Actor, Anim, SIT_DROP } from './actors';
import type { Nav } from './nav';
import type { Router } from './paths';
import type { Anchors, StallAnchor } from '../world/tokyo';
import type { RoomAnchor, RoomKind } from '../world/interiors';
import { randomLook, type Look } from '../world/characters';
import { rng } from '../world/grid';
import { crowdSpots, laneFor, streetAt, Spot, type CrowdSpots } from '../world/crowdspots';
import { zoneAt } from '../world/layout';
import { ISTANBUL } from '../world/cityId';
import { kerbStep, onCarriageway, offFoot, type Crosswalk } from '../world/roads';

/** Does the straight walk from a to b go along a carriageway away from its crosswalks? */
function roadOnWay(ax: number, az: number, bx: number, bz: number): boolean {
  const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
  for (let i = 1; i <= n; i++) if (offFoot(ax + ((bx - ax) * i) / n, az + ((bz - az) * i) / n)) return true;
  return false;
}
import { CROWD_CHAT, CROWD_GREET, CROWD_STARTLE, CROWD_ENVY } from '../data/dialogue';

/**
 * The city's people, each with a little life of their own. A walker has a persona and a pace and
 * moves along the street graph. At every junction they pick something to do from the time of day
 * and where they are: browse a stall and buy a snack, eat it on a bench, look in shop windows, pop
 * into a shop or an izakaya, stop for a photo or a phone call, or chat with someone they bump into.
 * Some set off across town on purpose: commuters stream through the station gates at rush hour,
 * elders pray at the shrine in the morning, students meet on the station square, neighbours take
 * the evening bath at the sento and office workers drift to the bars of Golden lane after dark.
 * Joggers lap the park pond, dogs take their owners for walks, cyclists and delivery scooters ride
 * the streets, swan boats pedal round the pond and a group does radio exercises on the lawn at dawn.
 *
 * Only people near the player are simulated in full and drawn; the rest of the city ticks over
 * a few times a second without their bodies being built at all.
 */

type V2 = [number, number];
const HAWKER_CALLS = ['Simiiit! Taze simit!', 'Sıcak simit!', 'Simitçiii!', 'Gevrek simit, sıcacık!'];

type Persona = 'commuter' | 'local' | 'tourist' | 'student' | 'elder' | 'jogger' | 'dogwalker' | 'cyclist' | 'courier';
type Mode = 'foot' | 'jog' | 'ride';

interface Seat { x: number; z: number; y: number; face: number; approach: V2; bench: number; taken: Walker | null; }
/** Stands in for the traveller on a seat they have taken (no walker is ever this one). */
const TRAVELLER = {} as Walker;
interface Taken extends Spot { taken: Walker | null }
interface Step { anim: Anim; t: number; face?: number; hold?: 'phone' | 'none' }

type Goal =
  | { k: 'node' }
  | { k: 'browse'; stall: StallAnchor; face: number }
  | { k: 'shop'; room: RoomAnchor; face: number }
  | { k: 'sit'; seat: Seat }
  | { k: 'home'; room: RoomAnchor }
  | { k: 'pause' }
  | { k: 'seq'; steps: Step[]; spot: Taken | null; then?: (w: Walker) => boolean }
  /** Through the ticket gates and onto a train, or in at the sento's door. */
  | { k: 'vanish' };

type Doing =
  | { k: 'wait'; t: number; anim: Anim; face?: number }
  | { k: 'browse'; t: number; face: number; stall?: StallAnchor; served: boolean }
  | { k: 'sit'; seat: Seat; t: number; stage: 0 | 1 | 2; s: number }
  | { k: 'chat'; t: number; with: Walker; talk: boolean; swap: number }
  | { k: 'seq'; steps: Step[]; i: number; t: number; spot: Taken | null; then?: (w: Walker) => boolean }
  /** At the kerb, waiting for the walk light. */
  | { k: 'kerb'; c: Crosswalk | null; face: number };

interface Pet { actor: Actor; sniff: number; next: number }
/** A rider: the walker's own actor is the bicycle or scooter, `person` sits on it. */
interface Ride { person: Actor; seat: number; scooter: boolean; parked: boolean }

/** What the crowd asks of Tokyo's traffic: the walk lights, and whether a car is in the way of the next step. */
interface CrowdTraffic {
  walkOk(c: Crosswalk | null, x: number, z: number): boolean;
  carAt(x: number, z: number, r: number): boolean;
}

interface Walker {
  actor: Actor;
  persona: Persona;
  mode: Mode;
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
  laneR: number;
  side: number;
  food: number;
  hidden: boolean;
  wantHome: boolean;
  lead: Walker | null;
  mate: Walker | null;
  mateSeat: Seat | null;
  chatCool: number;
  greetCool: number;
  /** Carries something to sell and calls it out (Istanbul's simit sellers). */
  hawker: boolean;
  /** A nook this walker means to stop at, waiting on its route. */
  nook: Taken | null;
  /** The junction a neighbourhood regular lives by and keeps near (-1: ranges across town). */
  home: number;
  nearT: number;
  stuck: number;
  stuckRef: V2;
  run: boolean;
  /** Seconds left of walking straight down the path, ignoring walls and people (to get unstuck). */
  ghost: number;
  /** Where this leg steps off the kerb onto an avenue, and the crossing there (Tokyo's traffic: see world/roads.ts). */
  kerb: { x: number; z: number; c: Crosswalk | null } | null;
  /** Where we last stood up or walked out from (to get back onto the graph). */
  from: V2 | null;
  hideT: number;
  /** A node across town this walker is heading for, and what they will do there. */
  dest: number;
  place: Place | null;
  /** Joggers: index on the pond ring (-1 when off it) and laps left. */
  ring: number;
  laps: number;
  pet: Pet | null;
  ride: Ride | null;
  /** Share of the day this walker is out: out while `out` is below the persona's turnout. */
  out: number;
  /** Distance to the player, and how long the body has been out of sight. */
  dist: number;
  unseen: number;
  acc: number;
}

interface Place { name: string; node: number; weight(w: Walker, h: number): number; go(w: Walker, h: number): boolean }

export interface CrowdPlayer { x: number; z: number; speed: number; running: boolean; eating: boolean; facing: number; }

export interface CrowdHooks {
  bubble(key: string, text: string, pos: [number, number, number], seconds: number): void;
  /** A stall vendor serves a customer standing at (x, z). */
  serve(stallId: string, x: number, z: number): void;
  /** Overheard lines are only shown while the player is free to read them. */
  quiet(): boolean;
}

/** Builds the bodies (lazily: meshes are made the first time they are drawn). */
export interface CrowdMaker {
  person(look: Look): Actor;
  dog(seed: number): Actor;
  vehicle(kind: 'bike' | 'scooter', seed: number): Actor;
  boat(seed: number): Actor;
}

export interface CrowdSize { walkers: number; joggers: number; dogs: number; cyclists: number; couriers: number; boats: number; exercise: number; bathers?: number }

const PERSONA_PACE: Record<Persona, number> = { commuter: 1.35, local: 1.05, tourist: 0.9, student: 1.2, elder: 0.72, jogger: 2.5, dogwalker: 0.85, cyclist: 3.9, courier: 4.9 };
const SNACK_ROOMS: RoomKind[] = ['bakery', 'cafe', 'konbini'];
/** Zones bicycles and scooters keep out of. */
const NO_RIDE = new Set(['ginza', 'park', 'midori', 'inari', 'yokocho', 'passage', 'station', 'plaza', 'kaminari', 'canal', 'farbank']);
const BIKE_SEAT = 0.42, SCOOTER_SEAT = 0.3; // rider origin above the ground
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const CELL = 2;
const ROUTE_CACHE = 8000;

const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const angTo = (ax: number, az: number, bx: number, bz: number) => Math.atan2(bx - ax, bz - az);
const bump = (h: number, c: number, w: number) => {
  let d = Math.abs(h - c);
  d = Math.min(d, 24 - d);
  return Math.exp(-(d * d) / (2 * w * w));
};
const within = (h: number, a: number, b: number) => (a <= b ? h >= a && h < b : h >= a || h < b);

function personaOf(l: Look): Persona {
  if (l.topStyle === 'suit') return 'commuter';
  if (l.hair === 0xb9b6b0 || l.hair === 0x6b6b70) return 'elder';
  if (l.topStyle === 'sailor') return 'student';
  if (l.backpack !== undefined || l.hat === 'bucket' || l.hat === 'straw') return 'tourist';
  return 'local';
}

/** Share of a persona out and about at a given hour. */
function turnout(p: Persona, h: number): number {
  const base = h < 5 ? 0.25 : h < 7 ? 0.25 + (h - 5) * 0.37 : h < 22 ? 1 : 1 - (h - 22) * 0.35;
  switch (p) {
    case 'elder': return within(h, 5.5, 19) ? 1 : within(h, 19, 22) ? 0.5 : 0.06;
    case 'student': return within(h, 7, 22.5) ? 1 : 0.06;
    case 'jogger': return Math.min(1, 0.12 + 1.2 * bump(h, 7, 1.4) + 1.1 * bump(h, 18.5, 1.6));
    case 'dogwalker': return Math.min(1, 0.15 + 1.1 * bump(h, 7.5, 1.3) + 1.0 * bump(h, 17.5, 1.6) + 0.4 * bump(h, 12, 2));
    case 'cyclist': return within(h, 6.5, 23) ? 1 : 0.15;
    case 'courier': return within(h, 10, 23.5) ? 1 : within(h, 9, 10) ? 0.5 : 0;
    default: return base;
  }
}

function roomOpen(kind: RoomKind, h: number): boolean {
  switch (kind) {
    case 'izakaya': return h >= 17 || h < 1;
    case 'konbini': return true;
    case 'cafe': case 'bakery': case 'kissa': return h >= 7 && h < 20;
    default: return h >= 9.5 && h < 21;
  }
}

/** How much a district draws people at an hour (for wandering at junctions). */
function zoneDraw(zone: string, h: number): number {
  const night = within(h, 18.5, 2.5), day = within(h, 7, 18.5);
  switch (zone) {
    case 'neon': case 'center': return night ? 1.8 : 0.9;
    case 'golden': case 'gado': return night ? 2 : 0.45;
    case 'park': return day ? 1.4 : 0.25;
    case 'inari': case 'midori': return day ? 1 : 0.15;
    case 'ginza': return within(h, 10, 20.5) ? 1.6 : 0.3;
    case 'yanaka': case 'nishi': return 0.6;
    case 'ekimae': case 'station': case 'hikari': return 1 + 1.5 * bump(h, 8, 0.9) + 1.5 * bump(h, 18, 1);
    case '': return 0.7;
    default: return 1 + 0.8 * bump(h, 12.3, 1.3) + 0.8 * bump(h, 19, 1.5); // the food streets
  }
}

/** A found path that ends exactly on the target, or [] if it stops short of it. */
function arrive(r: V2[] | null, bx: number, bz: number): V2[] {
  if (!r?.length) return [];
  const [ex, ez] = r[r.length - 1];
  if (Math.hypot(ex - bx, ez - bz) > 0.6) return [];
  r[r.length - 1] = [bx, bz];
  return r;
}

export class Crowd {
  readonly walkers: Walker[] = [];
  private seats: Seat[] = [];
  private stallSpots = new Map<string, { p: V2; taken: Walker | null }[]>();
  private routes = new Map<string, V2[]>();
  /** Routes asked of the router and not answered yet. */
  private asking = new Set<string>();
  private budget = 0;
  /** Finds routes off the main thread when set; otherwise a couple of searches run inline each frame. */
  router: Router | null = null;
  /** Tokyo's traffic lights: people wait at the kerb for the walk light, and never stop to chat in the road. */
  get traffic(): CrowdTraffic | null { return this.cars; }
  set traffic(t: CrowdTraffic | null) {
    this.cars = t;
    if (!t) return;
    // nobody idles out in the carriageway: the nooks, meeting points and shop windows there go
    const keep = (s: { x: number; z: number }) => !onCarriageway(s.x, s.z) && !onCarriageway(s.x + 0.5, s.z) && !onCarriageway(s.x - 0.5, s.z) && !onCarriageway(s.x, s.z + 0.5) && !onCarriageway(s.x, s.z - 0.5);
    this.meet = this.meet.filter(keep);
    this.windows = this.windows.filter(keep);
    const N = this.nodes;
    this.nooks = this.nooks.filter(keep);
    this.nookNear = N.map(([nx, nz]) => this.nooks.flatMap((s, i) => (Math.hypot(s.x - nx, s.z - nz) < 24 ? [i] : [])));
  }
  private cars: CrowdTraffic | null = null;
  private popT = 0;
  private chatT = 0;
  private sayT = 4;
  private nodes: V2[];
  private zones: string[];
  private rideOk: boolean[];
  private obstacles: V2[] = [];
  private friends: [number, number][] = [];
  private nbrs: number[][];
  private dist: Float32Array;
  private places: Place[] = [];
  private grid = new Map<number, Walker[]>();
  private pray: Taken[];
  private purify: Taken[];
  private gates: { front: V2; back: V2 }[];
  private meet: Taken[];
  private windows: Taken[];
  private sento: { door: V2; front: V2 } | null;
  private jog: V2[];
  private parkNode = -1;
  /** Corners off the street graph (alley mouths, doorsteps, courtyards, lane ends) where people stop a while. */
  private nooks: Taken[] = [];
  /** Per graph node: the nooks within a short walk of it. */
  private nookNear: number[][] = [];
  /** Walkable ground per district (m²), and how much each district draws wanderers to even the crowd out. */
  private zoneArea = new Map<string, number>();
  private zoneBal = new Map<string, number>();
  /** Walkable ground closest to each graph node (m²): people live where the ground is, not where junctions bunch up. */
  private nodeArea: Float32Array = new Float32Array(0);
  private viewR = 40;
  private pl: CrowdPlayer = { x: 0, z: 0, speed: 0, running: false, eating: false, facing: 0 };
  private boats: Boats | SeaBoats | null = null;
  private exercise: Exercise | null = null;
  private beach: Beach | null = null;

  constructor(private nav: Nav, private a: Anchors, private hooks: CrowdHooks, private make?: CrowdMaker) {
    this.nodes = a.graph.nodes;
    const n = this.nodes.length;
    this.nbrs = this.nodes.map((_, i) => a.graph.edges.filter((e) => e[0] === i || e[1] === i).map((e) => (e[0] === i ? e[1] : e[0])));
    this.zones = this.nodes.map(([x, z]) => zoneAt(x, z)?.id ?? '');
    this.rideOk = this.zones.map((zn) => !NO_RIDE.has(zn));
    // all-pairs distances along the street graph, for walking somewhere on purpose
    this.dist = new Float32Array(n * n).fill(1e9);
    for (let i = 0; i < n; i++) this.dist[i * n + i] = 0;
    for (const [p, q] of a.graph.edges) {
      const d = Math.hypot(this.nodes[p][0] - this.nodes[q][0], this.nodes[p][1] - this.nodes[q][1]);
      this.dist[p * n + q] = this.dist[q * n + p] = Math.min(this.dist[p * n + q], d);
    }
    for (let k = 0; k < n; k++) for (let i = 0; i < n; i++) {
      const ik = this.dist[i * n + k];
      if (ik >= 1e9) continue;
      for (let j = 0; j < n; j++) { const d = ik + this.dist[k * n + j]; if (d < this.dist[i * n + j]) this.dist[i * n + j] = d; }
    }
    // two seats per bench, each with a walkable spot to sit down from
    a.benches.forEach(([bx, bz, f, ground = 0], bi) => {
      const fz = Math.cos(f), fx = Math.sin(f);
      // seats sit across the bench (perpendicular to the way a sitter faces)
      for (const sx of [-0.38, 0.38]) {
        const ox = sx * fz, oz = -sx * fx;
        const cand: V2[] = [[bx + ox + fx * 0.75, bz + oz + fz * 0.75], [bx + ox + fx * 0.62, bz + oz + fz * 0.62], [bx + Math.sign(sx) * 1.2 * fz + fx * 0.3, bz - Math.sign(sx) * 1.2 * fx + fz * 0.3]];
        const ap = cand.find(([x, z]) => this.free(x, z));
        // the seat is half a metre above the ground the bench stands on (a hillside town's benches are not all at sea level)
        if (ap) this.seats.push({ x: bx + ox - fx * 0.04, z: bz + oz - fz * 0.04, y: ground + 0.5, face: f, approach: ap, bench: bi, taken: null });
      }
    });
    // café terrace stools: one seat each, sat down onto from the open side
    a.stools.forEach(([sx, sz, f, ground = 0], i) => {
      const fx = Math.sin(f), fz = Math.cos(f);
      const cand: V2[] = [[sx - fx * 0.55, sz - fz * 0.55], [sx - fz * 0.55, sz + fx * 0.55], [sx + fz * 0.55, sz - fx * 0.55]];
      const ap = cand.find(([x, z]) => this.free(x, z));
      if (ap) this.seats.push({ x: sx, z: sz, y: ground + 0.5, face: f, approach: ap, bench: -1 - i, taken: null });
    });
    // steps to sit on, stepped onto from the one below
    (a.stepSeats ?? []).forEach(([sx, sz, f], i) => {
      const ap: V2 = [sx + Math.sin(f) * 0.55, sz + Math.cos(f) * 0.55];
      if (this.free(sx, sz) && this.free(ap[0], ap[1])) this.seats.push({ x: sx, z: sz, y: this.nav.heightAt(sx, sz), face: f, approach: ap, bench: -10000 - i, taken: null });
    });
    // customers queue beside the player's spot at each stall, never on it
    for (const s of a.stalls) {
      const vx = s.stand[0] - s.vendor[0], vz = s.stand[1] - s.vendor[1], vl = Math.hypot(vx, vz) || 1;
      const ux = vx / vl, uz = vz / vl;
      const cand: V2[] = [[s.stand[0] - uz * 0.62, s.stand[1] + ux * 0.62], [s.stand[0] + uz * 0.62, s.stand[1] - ux * 0.62], [s.stand[0] + ux * 0.6, s.stand[1] + uz * 0.6]];
      this.stallSpots.set(s.id, cand.filter(([x, z]) => this.free(x, z)).map((p) => ({ p, taken: null })));
    }
    // the city's special places, keeping only spots that are really free to stand on
    const sp = crowdSpots();
    const ok = (s: Spot) => this.free(s.x, s.z);
    const facade = (s: Spot) => { const x = s.x + Math.sin(s.face) * 0.9, z = s.z + Math.cos(s.face) * 0.9; return !this.nav.canStand(x, z, this.nav.standHeightVox(s.x, s.z), 0.1); };
    const taken = (l: Spot[]) => l.map((s) => ({ ...s, taken: null as Walker | null }));
    this.pray = taken(sp.pray.filter(ok));
    this.purify = taken(sp.purify.filter(ok));
    this.gates = sp.gates.filter((g) => this.free(g.front[0], g.front[1]) && this.free(g.back[0], g.back[1]));
    this.meet = taken(sp.meet.filter(ok));
    this.windows = taken(sp.windows.filter((s) => ok(s) && facade(s)));
    this.survey();
    this.sento = this.free(sp.sento.front[0], sp.sento.front[1]) ? sp.sento : null;
    this.jog = sp.jog.filter(([x, z]) => this.free(x, z));
    if (this.jog.length < 10) this.jog = [];
    this.buildPlaces();
    if (make) {
      this.boats = sp.sea ? new SeaBoats(sp.sea, make) : new Boats(sp.boats, make);
      this.exercise = new Exercise(sp.exercise, make, (x, z) => this.free(x, z, 0.3), (x, z) => this.nav.heightAt(x, z));
      if (sp.beach) this.beach = new Beach(sp.beach, (x, z) => this.nav.heightAt(x, z));
    }
  }

  /**
   * Walks the whole walkable map once: how much ground each district has (so a crowd spreads over all
   * of it, not just the avenues), and the nooks off the street graph where people loiter, so the side
   * lanes, courtyards and alley ends have someone in them too.
   */
  private survey(): void {
    const N = this.nodes, E = this.a.graph.edges;
    if (!N.length) return;
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of N) { x0 = Math.min(x0, x); z0 = Math.min(z0, z); x1 = Math.max(x1, x); z1 = Math.max(z1, z); }
    x0 -= 12; z0 -= 12; x1 += 12; z1 += 12;
    const inRoom = (x: number, z: number) => this.a.rooms.some((r) => x >= r.rect[0] - 0.4 && x <= r.rect[2] + 0.4 && z >= r.rect[1] - 0.4 && z <= r.rect[3] + 0.4);
    const toEdge = (x: number, z: number) => {
      let best = Infinity;
      for (const [i, j] of E) {
        const [ax, az] = N[i], [bx, bz] = N[j], dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / l2));
        best = Math.min(best, Math.hypot(ax + dx * t - x, az + dz * t - z));
      }
      return best;
    };
    const busy: V2[] = [
      ...this.a.rooms.map((r): V2 => [r.door[0], r.door[1]]),
      ...this.a.stalls.flatMap((s): V2[] => [[s.stand[0], s.stand[1]], [s.vendor[0], s.vendor[1]]]),
      ...this.a.benches.map(([x, z]): V2 => [x, z]),
      ...this.a.stools.map(([x, z]): V2 => [x, z]),
    ];
    const S = 2;
    this.nodeArea = new Float32Array(N.length);
    for (let x = x0; x <= x1; x += S) for (let z = z0; z <= z1; z += S) {
      if (!this.free(x, z)) continue;
      const zn = zoneAt(x, z)?.id ?? '';
      this.zoneArea.set(zn, (this.zoneArea.get(zn) ?? 0) + S * S);
      let bi = 0, bd = Infinity;
      for (let i = 0; i < N.length; i++) { const d = (N[i][0] - x) ** 2 + (N[i][1] - z) ** 2; if (d < bd) { bd = d; bi = i; } }
      if (bd < 30 * 30) this.nodeArea[bi] += S * S;
      // nooks: on a 4 m lattice, off the street graph, outside shops and clear of doors, stalls and seats
      if ((Math.round(x / S) + Math.round(z / S)) % 2 || inRoom(x, z) || !this.free(x, z, 0.4)) continue;
      const de = toEdge(x, z);
      if (de < 2.2 || de > 26 || busy.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < 1.8)) continue;
      // face whatever is close (a wall, a doorway, a shop window), else look out over the lane
      let face = Math.random() * Math.PI * 2;
      for (let k = 0; k < 8; k++) {
        const f = (k / 8) * Math.PI * 2;
        if (!this.nav.canStand(x + Math.sin(f) * 0.9, z + Math.cos(f) * 0.9, this.nav.standHeightVox(x, z), 0.1)) { face = Math.random() < 0.5 ? f : f + Math.PI; break; }
      }
      this.nooks.push({ x: x + rnd(-0.4, 0.4), z: z + rnd(-0.4, 0.4), face, taken: null });
    }
    this.nookNear = N.map(([nx, nz]) => this.nooks.flatMap((s, i) => (Math.hypot(s.x - nx, s.z - nz) < 24 ? [i] : [])));
  }

  /** Once a second: districts with fewer people than their share of the ground draw more of the wanderers. */
  private balance(): void {
    let total = 0, out = 0;
    for (const a of this.zoneArea.values()) total += a;
    const count = new Map<string, number>();
    for (const w of this.walkers) {
      if (w.hidden) continue;
      out++;
      const p = w.actor.position, zn = zoneAt(p.x, p.z)?.id ?? '';
      count.set(zn, (count.get(zn) ?? 0) + 1);
    }
    if (!total || out < 10) return;
    for (const [zn, a] of this.zoneArea) {
      const want = a / total, have = (count.get(zn) ?? 0) / out;
      this.zoneBal.set(zn, Math.max(0.3, Math.min(3, Math.sqrt(want / Math.max(have, want * 0.1)))));
    }
  }

  private bal(zone: string): number {
    return this.zoneBal.get(zone) ?? 1;
  }

  /** Stopping a while somewhere off the main street: a call, a smoke-break stare, a photo, a look at a door. */
  private loiter(w: Walker): boolean {
    const near = this.nookNear[w.node];
    if (!near?.length) return false;
    for (let k = 0; k < 4 && near.length; k++) {
      // a nook picked last time whose route was still being found is tried first
      const ni = Math.floor(Math.random() * near.length);
      const s = k === 0 && w.nook ? w.nook : this.nooks[near[ni]];
      w.nook = null;
      if (s.taken || this.obstacles.some(([ox, oz]) => Math.hypot(ox - s.x, oz - s.z) < 1)) continue;
      const long = w.persona === 'elder' ? 1.6 : w.persona === 'commuter' ? 0.6 : 1;
      const steps: Step[] = [{ anim: 'idle', t: rnd(1, 3) * long }];
      const r = Math.random();
      if (w.persona === 'tourist' && r < 0.5) steps.push({ anim: 'photo', t: 2.5 }, { anim: 'idle', t: rnd(2, 4) }, { anim: 'photo', t: 2.5 });
      else if (r < 0.4) steps.push({ anim: 'phone', t: rnd(6, 16) * long, hold: 'phone' });
      else if (r < 0.7) steps.push({ anim: 'browse', t: rnd(3, 8) * long });
      else steps.push({ anim: 'idle', t: rnd(5, 12) * long, face: s.face + Math.PI });
      steps.push({ anim: 'idle', t: rnd(0.5, 2) });
      if (this.planSeq(w, s, steps)) return true;
      const key = `${w.node}>spot:${s.x.toFixed(2)},${s.z.toFixed(2)}`;
      // the route is still being worked out: wait a moment and come back to this nook
      if (this.asking.has(key)) { w.nook = s; w.doing = { k: 'wait', t: 0.3, anim: 'idle' }; return true; }
      // out of reach from this junction (a roof, a walled yard): never try it from here again
      if (this.routes.get(key)?.length === 0) { const i = near.indexOf(this.nooks.indexOf(s)); if (i >= 0) near.splice(i, 1); }
    }
    return false;
  }

  private free(x: number, z: number, r = 0.16): boolean {
    return this.nav.canStand(x, z, this.nav.standHeightVox(x, z), r);
  }

  private nearestNode(x: number, z: number, rideOnly = false): number {
    let best = 0, bd = Infinity;
    this.nodes.forEach(([nx, nz], i) => {
      if (rideOnly && !this.rideOk[i]) return;
      const d = Math.hypot(nx - x, nz - z);
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }

  // ------------------------------------------------------------------ populating

  /** Fills the city: `size` says how many of each kind of people (scaled down on phones). */
  populate(size: CrowdSize, seed = 1000): void {
    if (!this.make) return;
    const mk = this.make;
    const n = this.nodes.length;
    // everyone lives somewhere: spread over the city by how much ground each junction has around it
    let areaSum = 0;
    for (let i = 0; i < n; i++) areaSum += this.nodeArea[i] ?? 0;
    const startNode = (ride = false) => {
      for (;;) {
        let i = Math.floor(Math.random() * n);
        if (areaSum > 0) { let r = Math.random() * areaSum; for (i = 0; i < n - 1 && (r -= this.nodeArea[i]) > 0; i++); }
        if (!ride || this.rideOk[i]) return i;
      }
    };
    let prev: Walker | null = null;
    for (let i = 0; i < size.walkers; i++) {
      const look = lookFor(seed + i * 7, null);
      // Istanbul: now and then a simit seller doing the rounds, the tray balanced on the head
      if (ISTANBUL && i % 10 === 3) Object.assign(look, { tray: true, hat: 'none', topStyle: 'vest', top: 0xf4f1ea, accent: 0x8a2e2a, skirt: false, moustache: i % 20 === 3 });
      const pair = i % 5 === 4 && prev && !prev.mate;
      prev = this.add(mk.person(look), look, pair ? prev!.node : startNode(), pair ? prev! : undefined);
      // locals and elders keep mostly to their own few streets; everyone else ranges across town
      if (prev.persona === 'local' || prev.persona === 'elder') prev.home = prev.node;
    }
    for (let i = 0; i < size.joggers; i++) {
      const look = lookFor(seed + 5000 + i * 11, 'jogger');
      this.add(mk.person(look), look, startNode(), undefined, 'jogger');
    }
    for (let i = 0; i < size.dogs; i++) {
      const look = lookFor(seed + 6000 + i * 13, 'dogwalker');
      const w = this.add(mk.person(look), look, startNode(), undefined, 'dogwalker');
      w.pet = { actor: mk.dog(seed + 6000 + i), sniff: 0, next: rnd(6, 20) };
      w.pet.actor.position.copy(w.actor.position);
    }
    for (let i = 0; i < size.cyclists + size.couriers; i++) {
      const courier = i >= size.cyclists;
      const look = lookFor(seed + 7000 + i * 17, courier ? 'courier' : 'cyclist');
      const veh = mk.vehicle(courier ? 'scooter' : 'bike', seed + 7000 + i);
      const w = this.add(veh, look, startNode(true), undefined, courier ? 'courier' : 'cyclist');
      w.ride = { person: mk.person(look), seat: courier ? SCOOTER_SEAT : BIKE_SEAT, scooter: courier, parked: false };
      w.ride.person.pedals = !courier;
      w.ride.person.anim = 'ride';
    }
    this.boats?.populate(size.boats, (s) => mk.person(lookFor(s, null)));
    this.exercise?.populate(size.exercise, (s) => mk.person(lookFor(s, 'elder')));
    this.beach?.populate(size.bathers ?? 0, (l) => mk.person(l));
  }

  /** Adds a pedestrian (or a pair walking together when `mateOf` is given). */
  add(actor: Actor, look: Look, node: number, mateOf?: Walker, persona?: Persona): Walker {
    const ps = persona ?? personaOf(look);
    const mode: Mode = ps === 'jogger' ? 'jog' : ps === 'cyclist' || ps === 'courier' ? 'ride' : 'foot';
    const w: Walker = {
      actor, persona: ps, mode, node, prev: -1, path: [], tgt: null, goal: { k: 'node' }, doing: null,
      pace: PERSONA_PACE[ps] * rnd(0.88, 1.12), v: 0, lane: 0, laneR: Math.random(), side: Math.random() < 0.5 ? 1 : -1,
      food: 0, hidden: false, wantHome: false, lead: null, mate: null, mateSeat: null,
      chatCool: rnd(5, 25), greetCool: rnd(0, 20), nearT: 0, stuck: 0, stuckRef: [0, 0], run: mode === 'jog', ghost: 0, kerb: null, from: null, hideT: 0,
      dest: -1, place: null, ring: -1, laps: 0, pet: null, ride: null, out: Math.random(), dist: 0, unseen: 0, acc: Math.random() * 0.25,
      hawker: !!look.tray, nook: null, home: -1,
    };
    const [nx, nz] = this.nodes[node];
    actor.position.set(nx + rnd(-1, 1), this.nav.heightAt(nx, nz), nz + rnd(-1, 1));
    if (mateOf) {
      w.lead = mateOf;
      mateOf.mate = w;
      w.pace = mateOf.pace;
      w.out = mateOf.out;
      actor.position.copy(mateOf.actor.position).x += 0.6;
    }
    this.walkers.push(w);
    return w;
  }

  /** People standing about (story characters) that walkers step around. */
  addObstacle(x: number, z: number): void {
    this.obstacles.push([x, z]);
  }

  /**
   * Bodies to animate and draw this frame: everyone out on the street within `viewR` of the player.
   * Bodies further away are hidden, and their meshes freed once they have been out of sight a while.
   */
  *visible(): Generator<Actor> {
    // build at most a few new bodies a frame, so walking into a busy street never stalls a frame
    let builds = 6;
    for (const w of this.walkers) {
      let on = !w.hidden && w.dist < this.viewR;
      if (on && !w.actor.built) on = builds-- > 0;
      if (on) w.unseen = 0;
      else if ((w.unseen += 1 / 60) > 45) this.release(w);
      show(w.actor, on);
      if (w.pet) show(w.pet.actor, on);
      if (w.ride) show(w.ride.person, on);
      if (!on) continue;
      yield w.actor;
      if (w.pet) yield w.pet.actor;
      if (w.ride) yield w.ride.person;
    }
    if (this.boats) yield* this.boats.visible(this.pl, this.viewR);
    if (this.exercise) yield* this.exercise.visible(this.pl, this.viewR);
    if (this.beach) yield* this.beach.visible(this.pl, this.viewR);
  }

  private release(w: Walker): void {
    if (!w.actor.built) return;
    w.actor.release();
    w.pet?.actor.release();
    w.ride?.person.release();
  }

  /** Puts the right share of the crowd indoors for the starting hour. */
  settle(hour: number): void {
    for (const w of this.walkers) {
      if (w.lead) continue;
      if (w.out >= turnout(w.persona, hour)) { this.hide(w); if (w.mate) this.hide(w.mate); }
    }
    this.boats?.settle(hour);
  }

  /** `friends` are co-op travellers, stepped around like the player; `viewR` is how far the camera sees. */
  update(dt: number, hour: number, pl: CrowdPlayer, friends: [number, number][] = [], viewR = 40): void {
    this.budget = 2;
    this.friends = friends;
    this.pl = pl;
    this.viewR = viewR;
    this.population(dt, hour, pl);
    const ws = this.walkers;
    // who is where, for stepping around each other
    this.grid.clear();
    for (const w of ws) {
      const p = w.actor.position;
      w.dist = Math.hypot(p.x - pl.x, p.z - pl.z);
      if (w.hidden || w.dist > viewR + 12) continue;
      const k = this.key(p.x, p.z);
      const l = this.grid.get(k);
      if (l) l.push(w); else this.grid.set(k, [w]);
    }
    const nearR = viewR + 10, midR = Math.max(20, viewR * 0.5);
    for (const w of ws) {
      if (w.hidden) continue;
      // far from the player: a few cheap ticks a second
      let step = dt;
      const near = w.dist < nearR;
      // going home: slip away as soon as nobody can see
      if (w.wantHome && !w.lead && w.dist > viewR + 4 && !w.doing) { this.hide(w); if (w.mate) this.hide(w.mate); continue; }
      // out at the edge of the view: still smooth to the eye at 40 steps a second
      const tick = !near ? 0.25 : w.dist > midR ? 1 / 40 : 0;
      if (tick > 0) {
        w.acc += dt;
        if (w.acc < tick) continue;
        step = Math.min(w.acc, 0.5);
        w.acc = 0;
      }
      w.chatCool -= step; w.greetCool -= step;
      // a snack lasts a while, longer if it is being saved for a bench
      if (w.food > 0 && !(w.goal.k === 'sit' && !w.doing)) { w.food -= step; if (w.food <= 0) w.actor.hold = 'none'; }
      if (w.lead) this.follow(w, step, pl);
      else if (w.doing) this.doing(w, step, hour);
      else if (w.tgt || w.path.length) this.walk(w, step, pl, near);
      else this.arrive(w, hour);
      if (near && w.mode === 'foot') this.react(w, step, pl, hour);
      const p = w.actor.position;
      if (w.doing?.k !== 'sit') p.y = this.nav.heightAt(p.x, p.z);
      if (w.pet) this.walkPet(w, step, near);
      if (w.ride) this.seatRider(w);
    }
    this.meetings(dt);
    this.overhear(dt, pl);
    this.boats?.update(dt, hour);
    this.exercise?.update(dt, hour);
    this.beach?.update(dt, hour);
  }

  /**
   * The closest shown walker (or rider, or dog) to a point within r metres (at most 2 m, the hash cell),
   * as distance, ground speed and position; distance is Infinity when nobody is there. Only people near
   * the player are in the hash. Reuses one result object.
   */
  nearest(x: number, z: number, r: number): { d: number; speed: number; x: number; z: number } {
    const out = this.near;
    out.d = Infinity; out.speed = 0;
    const kx = Math.floor(x / CELL) + 512, kz = Math.floor(z / CELL) + 512;
    for (let ix = kx - 1; ix <= kx + 1; ix++) for (let iz = kz - 1; iz <= kz + 1; iz++) {
      const l = this.grid.get(ix * 1024 + iz);
      if (!l) continue;
      for (const o of l) {
        if (o.hidden) continue;
        const p = o.actor.position, d = Math.hypot(p.x - x, p.z - z);
        if (d < r && d < out.d) { out.d = d; out.speed = o.mode === 'ride' ? Math.max(o.actor.speed, 3) : o.actor.speed; out.x = p.x; out.z = p.z; }
        const pet = o.pet?.actor.position;
        if (pet) { const dp = Math.hypot(pet.x - x, pet.z - z); if (dp < r && dp < out.d) { out.d = dp; out.speed = Math.max(1.5, o.pet!.actor.speed); out.x = pet.x; out.z = pet.z; } }
      }
    }
    return out;
  }
  private near = { d: Infinity, speed: 0, x: 0, z: 0 };

  /** Is anyone (or their dog, unless `pets` is false) standing within r metres (at most 2) of a point? For drivers looking down the road. */
  occupied(x: number, z: number, r: number, pets = true): boolean {
    const kx = Math.floor(x / CELL) + 512, kz = Math.floor(z / CELL) + 512, r2 = r * r;
    for (let ix = kx - 1; ix <= kx + 1; ix++) for (let iz = kz - 1; iz <= kz + 1; iz++) {
      const l = this.grid.get(ix * 1024 + iz);
      if (!l) continue;
      for (const o of l) {
        if (o.hidden) continue;
        const p = o.actor.position;
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < r2) return true;
        const pet = pets ? o.pet?.actor.position : undefined;
        if (pet && (pet.x - x) ** 2 + (pet.z - z) ** 2 < r2) return true;
      }
    }
    return false;
  }

  private key(x: number, z: number): number {
    return (Math.floor(x / CELL) + 512) * 1024 + Math.floor(z / CELL) + 512;
  }

  // ------------------------------------------------------------------ routes

  /** Cached A* route; undefined while it is still being found (or this frame's budget is spent), [] when unreachable. */
  private route(key: string, ax: number, az: number, bx: number, bz: number): V2[] | undefined {
    const r = this.routes.get(key);
    if (r) return r;
    if (this.router) {
      if (!this.asking.has(key) && this.router.find(ax, az, bx, bz, (p) => { this.asking.delete(key); this.remember(key, arrive(p, bx, bz)); })) this.asking.add(key);
      return undefined;
    }
    if (this.budget <= 0) return undefined;
    this.budget--;
    const p = arrive(this.nav.findPath(ax, az, bx, bz), bx, bz);
    this.remember(key, p);
    return p;
  }

  /** Keeps a found route, forgetting the oldest once there are plenty (nooks make for a great many). */
  private remember(key: string, p: V2[]): void {
    if (this.routes.size >= ROUTE_CACHE) this.routes.delete(this.routes.keys().next().value!);
    this.routes.set(key, p);
  }

  private setPath(w: Walker, path: V2[], goal: Goal): void {
    w.path = path.slice();
    w.goal = goal;
    w.tgt = null;
    w.laneR = Math.random();
    w.stuck = 0;
    // some people walk with their eyes on the phone
    if (w.mode === 'foot' && w.food <= 0 && !w.pet) w.actor.hold = goal.k === 'node' && Math.random() < (w.persona === 'student' ? 0.3 : 0.1) ? 'phone' : 'none';
  }

  /** Sideways offset for the next leg of the path: pavements on avenues, the road for riders. */
  private laneAt(w: Walker, x: number, z: number): number {
    const st = streetAt(x, z);
    if (w.mode === 'ride') {
      if (!st) return (w.laneR - 0.5) * 0.4;
      // keep left, as traffic does here; on the avenues bicycles keep to the pavement, as they do here
      return st.kind === 'avenue' ? laneFor('avenue', w.laneR) : st.kind === 'street' ? -0.6 : 0;
    }
    if (w.goal.k !== 'node') return (w.laneR - 0.5) * 0.5;
    if (w.mode === 'jog' && w.ring >= 0) return 0;
    return laneFor(st?.kind ?? null, w.laneR);
  }

  /** Back onto the street graph from wherever an activity left us. */
  private leave(w: Walker): void {
    w.doing = null;
    w.actor.anim = 'idle';
    const p = w.actor.position;
    const from: V2 = w.from ?? [p.x, p.z];
    const n = this.nearestNode(from[0], from[1], !!w.ride);
    const r = this.route(`${from[0].toFixed(1)},${from[1].toFixed(1)}>${n}`, from[0], from[1], this.nodes[n][0], this.nodes[n][1]);
    if (!r) { w.from = from; w.doing = { k: 'wait', t: 0.2, anim: 'idle' }; return; } // out of path budget, try next time
    w.from = null;
    w.node = n;
    this.setPath(w, r.length ? r : [this.nodes[n]], { k: 'node' });
  }

  // ------------------------------------------------------------------ places across town

  private buildPlaces(): void {
    const P = (name: string, at: V2 | null, weight: Place['weight'], go: Place['go']) => { if (at) this.places.push({ name, node: this.nearestNode(at[0], at[1]), weight, go }); };
    const ps = (w: Walker, m: Partial<Record<Persona, number>>) => m[w.persona] ?? 0;
    // the station: commuters home at the evening rush, students after school, visitors leaving
    if (this.gates.length) {
      const g0 = this.gates[Math.floor(this.gates.length / 2)];
      P('station', g0.front, (w, h) => (h < 5 ? 0 : ps(w, { commuter: 0.15 + 3 * bump(h, 18.3, 1.3) + 0.8 * bump(h, 22.5, 1), student: 0.1 + 1.5 * bump(h, 16, 1.2), tourist: 0.25, local: 0.12, elder: 0.05 })),
        (w) => this.board(w));
    }
    // the shrine: wash the hands, then bow twice, clap twice, pray and bow
    const midori = this.pray.find((s) => s.z < 0);
    if (midori) P('midori', [midori.x, midori.z], (w, h) => (within(h, 6, 18.5) ? ps(w, { elder: 0.25 + 1.3 * bump(h, 7.5, 1.8), tourist: 0.5, local: 0.25, student: 0.12, commuter: 0.4 * bump(h, 8, 0.6) }) : 0),
      (w) => this.toShrine(w));
    const summit = this.pray.find((s) => s.z > 90 && s.x < 0);
    if (summit) P('inari', [summit.x, summit.z], (w, h) => (within(h, 7, 17) ? ps(w, { tourist: 0.35, elder: 0.15, local: 0.12, student: 0.1 }) : 0),
      (w) => this.prayAt(w, this.pray.filter((s) => Math.hypot(s.x - summit.x, s.z - summit.z) < 3)));
    const isle = this.pray.find((s) => s.x > 100);
    if (isle) P('isle', [isle.x, isle.z], (_w, h) => (within(h, 8, 18) ? 0.12 : 0), (w) => this.prayAt(w, [isle as Taken]));
    // the meeting point on the station square
    if (this.meet.length) P('meet', [this.meet[0].x, this.meet[0].z], (w, h) => (within(h, 9, 22.5) ? ps(w, { student: 0.45, local: 0.3, tourist: 0.2, commuter: 0.1 }) : 0),
      (w) => this.waitAt(w, this.meet, [['phone', rnd(6, 14)], ['idle', rnd(3, 6)], ['phone', rnd(5, 12)], ['wave', 1.4]]));
    // the evening bath
    if (this.sento) P('sento', this.sento.front, (w, h) => (within(h, 15, 23.5) ? ps(w, { elder: 0.55, local: 0.35, commuter: 0.06, student: 0.05 }) : 0),
      (w) => this.toSento(w));
    // window shopping streets
    const shop = (name: string, test: (s: Taken) => boolean, hours: [number, number], m: Partial<Record<Persona, number>>) => {
      const l = this.windows.filter(test);
      if (!l.length) return;
      const c = l[Math.floor(l.length / 2)];
      P(name, [c.x, c.z], (w, h) => (within(h, hours[0], hours[1]) ? ps(w, m) : 0), (w) => this.waitAt(w, l, w.persona === 'tourist' && Math.random() < 0.4 ? [['browse', rnd(3, 6)], ['photo', 2.5]] : [['browse', rnd(4, 9)]], 26));
    };
    shop('ginza', (s) => s.x > 30 && s.x < 41 && s.z > 64, [10, 20.5], { tourist: 0.6, local: 0.5, student: 0.4, elder: 0.35, commuter: 0.1 });
    shop('center', (s) => s.z > 8 && s.z < 17 && s.x > 82, [11, 23.5], { student: 0.7, tourist: 0.5, local: 0.3, commuter: 0.15 });
    shop('golden', (s) => s.x > 111 && s.x < 117, [18, 2], { commuter: 0.7, local: 0.4, tourist: 0.4 });
    shop('minami', (s) => s.z > 55 && s.z < 66, [10, 21], { local: 0.3, elder: 0.25, tourist: 0.25, student: 0.2 });
    shop('neon', (s) => s.x > 80 && s.x < 82, [16, 2], { student: 0.4, tourist: 0.4, commuter: 0.3, local: 0.2 });
    // food streets of the old district: lunch and dinner
    const old = this.zones.map((z, i) => [z, i] as const).filter(([z]) => ['kaminari', 'yokocho', 'plaza', 'canal', 'farbank', 'uramichi'].includes(z)).map(([, i]) => i);
    for (let k = 0; k < 3 && old.length; k++) {
      const i = old[Math.floor((k / 3) * old.length)];
      P('food', this.nodes[i], (w, h) => (w.persona === 'elder' ? 0.2 : 0.3) * (0.4 + 2 * bump(h, 12.3, 1.2) + 1.8 * bump(h, 19, 1.4)), () => false);
    }
    // the park: a stroll and a bench by the water
    const pk = this.zones.findIndex((z) => z === 'park');
    if (pk >= 0) {
      this.parkNode = this.nearestNode(113, 76);
      P('park', this.nodes[this.parkNode], (w, h) => (within(h, 6.5, 19) ? ps(w, { elder: 0.5, local: 0.45, tourist: 0.35, student: 0.25, commuter: 0.05, dogwalker: 1 }) : 0), () => false);
    }
  }

  private pickDest(w: Walker, hour: number): boolean {
    let total = 0;
    const ws = this.places.map((p) => { const v = p.node === w.node ? 0 : p.weight(w, hour); total += v; return v; });
    if (total <= 0) return false;
    let roll = Math.random() * total;
    for (let i = 0; i < ws.length; i++) {
      roll -= ws[i];
      if (roll <= 0) { w.dest = this.places[i].node; w.place = this.places[i]; return this.roam(w, hour, false); }
    }
    return false;
  }

  /** Through a free ticket gate to the platforms (and out of the simulation until later). */
  private board(w: Walker): boolean {
    const g = pick(this.gates);
    const ok = this.plan(w, `gate:${g.front[0]}`, g.front, { k: 'vanish' });
    if (ok) { w.path.push(g.back); if (w.mate) w.mate.wantHome = true; }
    return ok;
  }

  private toShrine(w: Walker): boolean {
    const near = this.pray.filter((s) => s.z < 0);
    if (this.purify.length && Math.random() < 0.7) {
      const s = this.purify.find((q) => !q.taken);
      if (s) return this.planSeq(w, s, [{ anim: 'idle', t: 0.5 }, { anim: 'browse', t: rnd(2.5, 4) }, { anim: 'idle', t: 0.6 }], (ww) => this.prayAt(ww, near));
    }
    return this.prayAt(w, near);
  }

  private prayAt(w: Walker, spots: Taken[]): boolean {
    const s = spots.find((q) => !q.taken);
    if (!s) return false;
    return this.planSeq(w, s, [{ anim: 'idle', t: 0.6 }, { anim: 'bow', t: 1.0 }, { anim: 'idle', t: 0.3 }, { anim: 'bow', t: 1.0 }, { anim: 'pray', t: rnd(4, 6.5) }, { anim: 'bow', t: 1.1 }, { anim: 'idle', t: 0.6 }]);
  }

  private waitAt(w: Walker, spots: Taken[], steps: [Anim, number][], maxD = 1e9): boolean {
    const [nx, nz] = this.nodes[w.node];
    const free = spots.filter((s) => !s.taken && Math.hypot(s.x - nx, s.z - nz) < maxD);
    if (!free.length) return false;
    const s = pick(free);
    return this.planSeq(w, s, steps.map(([anim, t]) => ({ anim, t, hold: anim === 'phone' ? 'phone' : 'none' })));
  }

  private toSento(w: Walker): boolean {
    const s = this.sento!;
    const ok = this.plan(w, 'sento', s.front, { k: 'vanish' });
    if (ok) { w.path.push(s.door); if (w.mate) w.mate.wantHome = true; }
    return ok;
  }

  private planSeq(w: Walker, s: Taken, steps: Step[], then?: (w: Walker) => boolean): boolean {
    const ok = this.plan(w, `spot:${s.x.toFixed(2)},${s.z.toFixed(2)}`, [s.x, s.z], { k: 'seq', steps: steps.map((st) => ({ ...st, face: st.face ?? s.face })), spot: s, then }, w.from ?? undefined);
    if (ok) s.taken = w;
    return ok;
  }

  // ------------------------------------------------------------------ deciding

  private arrive(w: Walker, hour: number): void {
    const g = w.goal, p = w.actor.position;
    if (!w.ride) w.actor.anim = 'idle';
    w.run = w.mode === 'jog';
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
      case 'home': case 'vanish':
        this.hide(w);
        if (w.mate && !w.mate.hidden) w.mate.hideT = 2;
        return;
      case 'pause': {
        const anim: Anim = w.persona === 'tourist' && Math.random() < 0.6 ? 'photo' : Math.random() < 0.55 ? 'phone' : 'idle';
        w.doing = { k: 'wait', t: rnd(3, 7), anim, face: w.actor.facing + rnd(-1.2, 1.2) };
        return;
      }
      case 'seq':
        w.doing = { k: 'seq', steps: g.steps, i: 0, t: g.steps[0].t, spot: g.spot, then: g.then };
        w.from = [p.x, p.z];
        w.actor.hold = 'none';
        return;
    }
    this.choose(w, hour);
  }

  private choose(w: Walker, hour: number): void {
    if (w.mode === 'jog') { this.chooseJog(w, hour); return; }
    if (w.mode === 'ride') { this.chooseRide(w, hour); return; }
    if (w.nook) { if (!w.nook.taken && this.loiter(w)) return; w.nook = null; }
    // on the way somewhere: keep going, or do the thing on arrival
    if (w.dest >= 0) {
      if (w.node === w.dest) {
        const pl = w.place;
        w.dest = -1; w.place = null;
        if (pl && pl.go(w, hour)) return;
      } else if (Math.random() < 0.85 && this.roam(w, hour, false)) return;
    }
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
      if (this.gates.length && w.persona !== 'elder' && w.persona !== 'dogwalker') opts.push({ w: 3, go: () => { const st = this.places.find((q) => q.name === 'station')!; w.dest = st.node; w.place = st; return this.roam(w, hour, false); } });
    }
    opts.push({ w: 1.6 + (rush ? 4 : 0), go: () => this.roam(w, hour, rush) });
    opts.push({ w: w.wantHome ? 0 : 1.1, go: () => this.pickDest(w, hour) });
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
      // off down a side lane or into a courtyard to stop a while
      if (within(hour, 6, 23.5) && this.nookNear[w.node]?.length) {
        const like = { elder: 1.7, local: 1.5, tourist: 1.1, student: 1.2, commuter: 0.35, dogwalker: 0.8 } as Partial<Record<Persona, number>>;
        opts.push({ w: like[w.persona] ?? 0.4, go: () => this.loiter(w) });
      }
      // a look in a shop window on the way
      if (within(hour, 9.5, 23) && !w.pet) {
        const near = this.windows.filter((s) => !s.taken && Math.abs(s.x - nx) < 9 && Math.abs(s.z - nz) < 9);
        if (near.length) opts.push({ w: w.persona === 'tourist' ? 0.45 : 0.25, go: () => this.waitAt(w, near, [['browse', rnd(3, 7)]]) });
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

  /** Joggers lap the pond a few times, then run off somewhere else. */
  private chooseJog(w: Walker, hour: number): void {
    const J = this.jog;
    if (J.length && w.ring >= 0) {
      if (w.laps <= 0) {
        w.ring = -1;
        w.from = [w.actor.position.x, w.actor.position.z];
        w.dest = Math.floor(Math.random() * this.nodes.length);
        this.leave(w);
        return;
      }
      const i = w.ring, j = (i + 1) % J.length;
      const r = this.route(`jog:${i}`, J[i][0], J[i][1], J[j][0], J[j][1]);
      if (!r) { w.doing = { k: 'wait', t: 0.1, anim: 'idle' }; return; }
      w.ring = j;
      if (j === 0) w.laps--;
      this.setPath(w, r.length ? r : [J[j]], { k: 'node' });
      w.run = true;
      return;
    }
    if (J.length && this.parkNode >= 0 && w.node === this.parkNode && within(hour, 5, 21)) {
      // join the ring at its nearest point
      const [nx, nz] = this.nodes[w.node];
      let bi = 0, bd = Infinity;
      J.forEach(([x, z], i) => { const d = Math.hypot(x - nx, z - nz); if (d < bd) { bd = d; bi = i; } });
      if (this.plan(w, `jogin:${bi}`, J[bi], { k: 'node' })) { w.ring = bi; w.laps = 1 + Math.floor(Math.random() * 3); w.run = true; return; }
    }
    if (w.dest < 0 || w.node === w.dest) w.dest = this.parkNode >= 0 && Math.random() < 0.8 ? this.parkNode : Math.floor(Math.random() * this.nodes.length);
    w.run = true;
    if (!this.roam(w, hour, false)) w.doing = { k: 'wait', t: 0.3, anim: 'idle' };
  }

  /** Riders keep to the streets; couriers stop now and then to drop off an order. */
  private chooseRide(w: Walker, hour: number): void {
    if (w.persona === 'courier' && Math.random() < 0.22 && w.ride) {
      w.ride.parked = true;
      w.doing = { k: 'seq', steps: [{ anim: 'idle', t: 0.6 }, { anim: 'phone', t: rnd(2, 4), hold: 'phone' }, { anim: 'bow', t: 1 }, { anim: 'idle', t: rnd(1, 3) }], i: 0, t: 0.6, spot: null };
      return;
    }
    if (!this.roam(w, hour, false)) w.doing = { k: 'wait', t: 0.4, anim: 'idle' };
  }

  /** On to the next junction: towards the walker's destination, or wherever the districts draw them. */
  private roam(w: Walker, hour: number, rush: boolean): boolean {
    const nb = w.ride ? this.nbrs[w.node].filter((v) => this.rideOk[v]) : this.nbrs[w.node];
    if (!nb.length) return false;
    let next = -1;
    const n = this.nodes.length;
    if (w.dest >= 0 && w.dest !== w.node && !w.ride) {
      let bd = Infinity;
      for (const v of nb) {
        const d = this.edgeLen(w.node, v) + this.dist[v * n + w.dest] + (v === w.prev ? 4 : 0) + Math.random() * 3;
        if (d < bd) { bd = d; next = v; }
      }
    } else {
      let total = 0;
      const hn = w.home >= 0 ? this.nodes[w.home] : null;
      const ws = nb.map((v) => {
        // a regular strays a block or two from home, then drifts back
        const tether = hn ? (Math.hypot(this.nodes[v][0] - hn[0], this.nodes[v][1] - hn[1]) > 40 ? 0.15 : 1) : 1;
        const x = zoneDraw(this.zones[v], hour) * this.bal(this.zones[v]) * tether * (v === w.prev && nb.length > 1 ? 0.15 : 1);
        total += x;
        return x;
      });
      let roll = Math.random() * total;
      for (let i = 0; i < nb.length; i++) { roll -= ws[i]; if (roll <= 0) { next = nb[i]; break; } }
      if (next < 0) next = nb[nb.length - 1];
    }
    const a = this.nodes[w.node], b = this.nodes[next];
    const r = this.route(`${w.node}-${next}`, a[0], a[1], b[0], b[1]);
    if (!r) return false;
    w.prev = w.node;
    w.node = next;
    this.setPath(w, r.length ? r : [b], { k: 'node' });
    // late for the train
    w.run = w.mode === 'jog' || (rush && hour < 9.5 && Math.random() < 0.18 && !w.mate && !w.pet);
    return true;
  }

  private edgeLen(p: number, q: number): number {
    return Math.hypot(this.nodes[p][0] - this.nodes[q][0], this.nodes[p][1] - this.nodes[q][1]);
  }

  /** Path from the current node (or from `from`) to an activity spot. */
  private plan(w: Walker, key: string, to: V2, goal: Goal, from?: V2): boolean {
    const [nx, nz] = from ?? this.nodes[w.node];
    const r = this.route(`${from ? `${nx.toFixed(1)},${nz.toFixed(1)}` : w.node}>${key}`, nx, nz, to[0], to[1]);
    if (!r || !r.length) return false;
    this.setPath(w, r, goal);
    return true;
  }

  /** The seats people sit on (bench halves, terrace chairs, steps), so the traveller can take one too. */
  get publicSeats(): readonly { x: number; z: number; y: number; face: number; approach: V2 }[] { return this.seats; }

  /** Nobody else sits on seat `i`, or is on the way to it. */
  seatFree(i: number): boolean { const t = this.seats[i]?.taken; return !t || t === TRAVELLER; }

  /** Keep seat `i` for the traveller (on) or give it back. False when someone sits there, or is on the way to it. */
  holdSeat(i: number, on: boolean): boolean {
    const s = this.seats[i];
    if (!s) return false;
    if (!on) { if (s.taken === TRAVELLER) s.taken = null; return true; }
    if (s.taken && s.taken !== TRAVELLER) return false;
    s.taken = TRAVELLER;
    return true;
  }

  private freeSeat(x: number, z: number, pair: boolean): Seat | null {
    let best: Seat | null = null, bd = 16;
    for (const s of this.seats) {
      if (s.taken) continue;
      const d = Math.hypot(s.x - x, s.z - z);
      if (d >= bd) continue;
      if (pair && !this.seats.some((o) => o.bench === s.bench && o !== s && !o.taken)) continue;
      bd = d; best = s;
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
   * Japanese pavements have no strict side, so each walker dodges towards their own lane. Riders
   * mostly slow down behind people rather than swerve.
   */
  private steer(w: Walker, tx: number, tz: number, speed: number, dt: number, pl: CrowdPlayer, ignore: Walker | null, near = true): number {
    const a = w.actor, p = a.position;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (d < 1e-4) { w.v = 0; return 0; }
    const ux = dx / d, uz = dz / d;
    let ax = 0, az = 0, slow = 1;
    const ride = w.mode === 'ride';
    const dodge = ride ? 0.5 : 1.4;
    const avoid = (ox: number, oz: number, r: number) => {
      const rx = ox - p.x, rz = oz - p.z, r2 = rx * rx + rz * rz;
      if (r2 > r * r || r2 < 1e-6) return;
      const od = Math.sqrt(r2), ahead = rx * ux + rz * uz;
      if (ahead < -0.15) return;
      const lat = rx * -uz + rz * ux;
      const push = (r - od) / r;
      const sd = lat > 0.04 ? -1 : lat < -0.04 ? 1 : (w.lane >= 0 ? 1 : -1);
      ax += -uz * sd * push * dodge; az += ux * sd * push * dodge;
      if (ride) { if (ahead > 0.2 && Math.abs(lat) < 0.8 && w.ghost <= 0) slow = Math.min(slow, Math.max(0.1, (od - 0.9) / 1.6)); }
      else if (od < 0.55 && ahead > 0.12) slow = Math.min(slow, Math.max(0.15, (od - 0.32) / 0.23));
    };
    if (near) {
      const kx = Math.floor(p.x / CELL) + 512, kz = Math.floor(p.z / CELL) + 512;
      for (let ix = kx - 1; ix <= kx + 1; ix++) for (let iz = kz - 1; iz <= kz + 1; iz++) {
        const l = this.grid.get(ix * 1024 + iz);
        if (!l) continue;
        for (const o of l) if (o !== w && o !== ignore && !o.hidden) avoid(o.actor.position.x, o.actor.position.z, ride || o.mode === 'ride' ? 2.2 : o.mode === 'jog' ? 1.4 : 1.1);
      }
      avoid(pl.x, pl.z, ride ? 2.4 : 1.3);
      for (const [ox, oz] of this.obstacles) if (Math.abs(ox - p.x) < 2 && Math.abs(oz - p.z) < 2) avoid(ox, oz, 0.9);
      for (const [ox, oz] of this.friends) avoid(ox, oz, ride ? 2.4 : 1.3);
    }
    let mx = ux + ax, mz = uz + az;
    const ml = Math.hypot(mx, mz) || 1;
    mx /= ml; mz /= ml;
    const want = speed * slow;
    w.v += (want - w.v) * Math.min(1, dt * (want > w.v ? (ride ? 1.6 : 3.5) : 6));
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
    if (w.ride) a.anim = 'idle';
    else a.anim = w.v < 0.06 ? 'idle' : w.run && w.v > 1.9 ? 'run' : 'walk';
    if (!near) a.facing = a.targetFacing;
    return Math.hypot(tx - p.x, tz - p.z);
  }

  private walk(w: Walker, dt: number, pl: CrowdPlayer, near: boolean): void {
    const p = w.actor.position;
    if (!w.tgt) {
      const wp = w.path[0];
      const last = w.path.length === 1;
      // shift the waypoint sideways into this walker's lane, if there is room
      let t: V2 = [wp[0], wp[1]];
      if (!last || w.goal.k === 'node') {
        w.lane = this.laneAt(w, (wp[0] + p.x) / 2, (wp[1] + p.z) / 2);
        const dx = wp[0] - p.x, dz = wp[1] - p.z, dl = Math.hypot(dx, dz) || 1;
        const st = streetAt((wp[0] + p.x) / 2, (wp[1] + p.z) / 2);
        // along a straight street, hold the lane measured from its centre line; elsewhere offset the waypoint
        let ox = wp[0] - (dz / dl) * w.lane, oz = wp[1] + (dx / dl) * w.lane;
        // (only Tokyo has avenues: their walking routes run down the pavements, and over the crosswalks)
        const off = st ? (st.ew ? wp[1] : wp[0]) - st.centre : 0;
        if (st?.kind === 'avenue' && (this.traffic || Math.abs(off) > 2.5)) {
          // along an avenue: down the middle of the pavement the waypoint is on; across it: straight over the zebra
          if (Math.abs(st.ew ? dz : dx) < dl * 0.25 && Math.abs(off) > 2.5) {
            // the graph's lanes are already pavement offsets; a routed walk keeps to the middle of the pavement
            const m = Math.abs(w.lane) > 2 ? clamp(Math.abs(w.lane), 3.45, 4.6) : 3.55 + w.laneR * 0.8;
            const v = st.centre + Math.sign(off) * m;
            if (st.ew) { ox = wp[0]; oz = v; } else { ox = v; oz = wp[1]; }
          } else { ox = wp[0] - (dz / dl) * (w.laneR - 0.5) * 0.8; oz = wp[1] + (dx / dl) * (w.laneR - 0.5) * 0.8; }
        } else if (st && Math.abs(st.ew ? dz : dx) < dl * 0.25 && Math.abs((st.ew ? wp[1] : wp[0]) - st.centre) < 1.5) {
          const sgn = st.ew ? (dx > 0 ? 1 : -1) : (dz > 0 ? -1 : 1);
          if (st.ew) { ox = wp[0]; oz = st.centre + sgn * w.lane; } else { ox = st.centre + sgn * w.lane; oz = wp[1]; }
        }
        if (this.free(ox, oz)) t = [ox, oz];
        else if (this.free((ox + wp[0]) / 2, (oz + wp[1]) / 2)) t = [(ox + wp[0]) / 2, (oz + wp[1]) / 2];
        // a lane offset never takes a walk out into the traffic that the waypoint itself keeps out of
        if (this.traffic && t !== undefined && (t[0] !== wp[0] || t[1] !== wp[1]) && roadOnWay(p.x, p.z, t[0], t[1]) && !roadOnWay(p.x, p.z, wp[0], wp[1])) t = [wp[0], wp[1]];
      }
      w.tgt = t;
      w.kerb = this.traffic ? kerbStep(p.x, p.z, t[0], t[1]) : null;
    }
    // about to step into an avenue: cross on the walk light, waiting at the kerb for it
    if (w.kerb && this.traffic) {
      if (onCarriageway(p.x, p.z)) w.kerb = null;
      else if (!this.traffic.walkOk(w.kerb.c, w.kerb.x, w.kerb.z)) {
        const k = w.kerb;
        if (Math.hypot(k.x - p.x, k.z - p.z) > 0.25) { this.steer(w, k.x, k.z, w.pace, dt, pl, w.mate, near); return; }
        w.doing = { k: 'kerb', c: k.c, face: Math.atan2(w.tgt[0] - p.x, w.tgt[1] - p.z) };
        w.actor.anim = 'idle';
        w.actor.speed = 0;
        w.v = 0;
        return;
      }
    }
    // out in the road: never walk into the side of a car going by, wait for it to pass
    if (this.traffic && onCarriageway(p.x, p.z)) {
      const dx = w.tgt[0] - p.x, dz = w.tgt[1] - p.z, dl = Math.hypot(dx, dz) || 1;
      if (this.traffic.carAt(p.x + (dx / dl) * 0.55, p.z + (dz / dl) * 0.55, 0.3)) {
        w.actor.anim = 'idle';
        w.actor.speed = 0;
        w.v = 0;
        return;
      }
    }
    const last = w.path.length <= 1;
    const speed = w.run ? (w.mode === 'jog' ? w.pace : 2.7) : w.pace;
    const left = this.steer(w, w.tgt[0], w.tgt[1], speed * (last && w.goal.k !== 'node' ? Math.min(1, 0.45 + Math.hypot(w.tgt[0] - p.x, w.tgt[1] - p.z)) : 1), dt, pl, w.mate, near);
    if (left < (last ? 0.12 : w.mode === 'ride' ? 0.8 : 0.35)) {
      w.path.shift();
      w.tgt = null;
      if (!w.path.length) { w.v *= w.mode === 'foot' ? 0.5 : 1; if (w.mode === 'foot') { w.actor.anim = 'idle'; w.actor.speed = 0; } }
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
    // the dog wants to sniff something: wait for it
    if (w.pet && near && (w.pet.next -= dt) <= 0 && !w.mate) {
      w.pet.next = rnd(10, 26);
      const t = rnd(2.5, 5);
      w.pet.sniff = t;
      w.doing = { k: 'wait', t, anim: Math.random() < 0.4 ? 'phone' : 'idle' };
    }
  }

  /** The dog trots at its owner's heel, sits when they stop for long and sniffs when it likes. */
  private walkPet(w: Walker, dt: number, near: boolean): void {
    const pet = w.pet!, a = pet.actor, p = a.position, o = w.actor.position, f = w.actor.facing;
    const tx = o.x - Math.sin(f) * 0.55 + Math.cos(f) * 0.5, tz = o.z - Math.cos(f) * 0.55 - Math.sin(f) * 0.5;
    const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
    if (!near || d > 4) { p.set(tx, this.nav.heightAt(tx, tz), tz); a.facing = a.targetFacing = f; a.anim = 'idle'; a.speed = 0; return; }
    if (pet.sniff > 0) {
      pet.sniff -= dt;
      a.anim = 'browse'; a.speed = 0;
      if (w.doing?.k === 'wait') w.actor.targetFacing = angTo(o.x, o.z, p.x, p.z);
      return;
    }
    if (d > 0.06) {
      const sp = Math.min(d * 3.2, Math.max(1.2, w.v * 1.5));
      const step = Math.min(d, sp * dt);
      const m = this.nav.slide(p.x, p.z, dx / d, dz / d, step, this.nav.standHeightVox(p.x, p.z), 1);
      if (m) { p.x = m.x; p.z = m.z; } else { p.x += (dx / d) * step; p.z += (dz / d) * step; }
      a.targetFacing = Math.atan2(dx, dz);
      a.speed = sp;
      a.anim = sp > 0.15 ? 'walk' : 'idle';
    } else {
      a.speed = 0;
      a.anim = w.doing?.k === 'sit' || (w.doing && w.v < 0.05) ? 'sit' : 'idle';
      if (a.anim !== 'idle') a.targetFacing = f;
    }
    p.y = this.nav.heightAt(p.x, p.z);
  }

  /** Puts the rider on the saddle, or beside the parked scooter. */
  private seatRider(w: Walker): void {
    const r = w.ride!, v = w.actor, b = r.person, f = v.facing;
    if (r.parked) {
      const x = v.position.x + Math.cos(f) * 0.7, z = v.position.z - Math.sin(f) * 0.7;
      b.position.set(x, this.nav.heightAt(x, z), z);
      b.targetFacing = f - Math.PI / 2;
      if (b.anim === 'ride') b.facing = b.targetFacing;
      const d = w.doing;
      b.anim = d?.k === 'seq' ? d.steps[d.i].anim : 'idle';
      b.hold = d?.k === 'seq' && d.steps[d.i].hold === 'phone' ? 'phone' : 'none';
      b.speed = 0;
      return;
    }
    b.position.set(v.position.x, v.position.y + r.seat, v.position.z);
    b.position.x -= Math.sin(f) * (r.scooter ? 0.05 : 0.12);
    b.position.z -= Math.cos(f) * (r.scooter ? 0.05 : 0.12);
    b.facing = b.targetFacing = f;
    b.anim = 'ride';
    b.hold = 'none';
    b.speed = w.v;
  }

  // ------------------------------------------------------------------ activities

  private doing(w: Walker, dt: number, hour: number): void {
    const d = w.doing!, a = w.actor, p = a.position;
    a.speed = 0;
    w.v = 0;
    if (w.ride && d.k !== 'seq') a.anim = 'idle';
    switch (d.k) {
      case 'kerb':
        if (!w.ride) a.anim = 'idle';
        a.targetFacing = d.face;
        if (!this.traffic || this.traffic.walkOk(d.c, p.x, p.z)) w.doing = null;
        return;
      case 'wait':
        if (!w.ride) a.anim = d.anim;
        if (d.face !== undefined) a.targetFacing = d.face;
        if (d.anim === 'phone') a.hold = 'phone';
        if ((d.t -= dt) <= 0) {
          w.doing = null;
          if (!w.ride) a.anim = 'idle';
          if (d.anim === 'phone') a.hold = 'none';
          if (w.from) this.leave(w); // done at an activity spot
          else if (!w.path.length && !w.tgt) this.choose(w, hour);
        }
        return;
      case 'seq': {
        const st = d.steps[d.i];
        if (!w.ride) { a.anim = st.anim; a.hold = st.hold === 'phone' ? 'phone' : 'none'; }
        else a.anim = 'idle';
        if (st.face !== undefined && !w.ride) a.targetFacing = st.face;
        if ((d.t -= dt) > 0) return;
        d.i++;
        if (d.i < d.steps.length) { d.t = d.steps[d.i].t; return; }
        if (d.spot && d.spot.taken === w) d.spot.taken = null;
        a.hold = 'none';
        w.doing = null;
        if (w.ride) { w.ride.parked = false; this.chooseRideOn(w, hour); return; }
        if (d.then) { w.from = [p.x, p.z]; if (d.then(w)) { w.from = null; return; } }
        this.leave(w);
        return;
      }
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
          p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + (s.y - SIT_DROP) * e;
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
          p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + (s.y - SIT_DROP) * e;
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

  private chooseRideOn(w: Walker, hour: number): void {
    if (!this.roam(w, hour, false)) w.doing = { k: 'wait', t: 0.4, anim: 'idle' };
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
      p.y = this.nav.heightAt(s.approach[0], s.approach[1]) * (1 - e) + (s.y - SIT_DROP) * e;
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
      const la = ld?.k === 'seq' ? ld.steps[ld.i].anim : null;
      a.anim = ld?.k === 'browse' ? 'browse' : ld?.k === 'wait' && ld.anim === 'eat' ? 'eat' : ld?.k === 'chat' ? 'listen'
        : la === 'pray' || la === 'bow' ? la : la === 'browse' ? 'browse' : (Math.sin(L.actor.animT * 0.4 + 1) > 0 ? 'talk' : 'listen');
      if (la === 'pray' || la === 'bow') a.targetFacing = L.actor.targetFacing;
      if (ld?.k === 'wait' && ld.anim === 'eat') a.hold = 'none';
      return;
    }
    const sp = still ? Math.min(w.pace, 0.4 + gap) : L.v * (1 + Math.max(-0.4, Math.min(0.7, (gap - 0.15) * 0.9)));
    w.run = L.run;
    this.steer(w, tx, tz, Math.max(0.3, sp), dt, pl, L, w.dist < this.viewR + 10);
  }

  // ------------------------------------------------------------------ social

  /** Two people who bump into each other sometimes stop for a chat. */
  private meetings(dt: number): void {
    this.chatT -= dt;
    if (this.chatT > 0) return;
    this.chatT = 0.5;
    const free = this.walkers.filter((w) => !w.hidden && w.mode === 'foot' && w.dist < this.viewR + 10 && !w.lead && !w.mate && !w.doing && w.chatCool <= 0 && w.goal.k === 'node' && w.path.length > 0 && !(this.traffic && onCarriageway(w.actor.position.x, w.actor.position.z)));
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
      a.actor.hold = b.actor.hold = 'none';
    }
  }

  private react(w: Walker, dt: number, pl: CrowdPlayer, hour: number): void {
    const a = w.actor, p = a.position;
    const dx = pl.x - p.x, dz = pl.z - p.z, d = w.dist;
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
    // a simit seller passing calls out the wares
    const hawker = this.walkers.find((w) => w.hawker && !w.hidden && w.dist < 8);
    if (hawker && Math.random() < 0.6) {
      this.say(`hawk-${this.walkers.indexOf(hawker)}`, pick(HAWKER_CALLS), hawker.actor.position, 2.2, pl);
      return;
    }
    const talkers = this.walkers.filter((w) => !w.hidden && w.dist < 7 && w.actor.anim === 'talk');
    if (talkers.length) {
      const w = pick(talkers);
      this.say(`chat-${this.walkers.indexOf(w)}`, pick(CROWD_CHAT), w.actor.position, 2.8, pl);
    }
  }

  // ------------------------------------------------------------------ daily rhythm

  private hide(w: Walker): void {
    w.hidden = true;
    show(w.actor, false);
    if (w.pet) { show(w.pet.actor, false); w.pet.sniff = 0; }
    if (w.ride) { show(w.ride.person, false); w.ride.parked = false; }
    if (w.doing?.k === 'seq' && w.doing.spot?.taken === w) w.doing.spot.taken = null;
    if (w.goal.k === 'seq' && w.goal.spot?.taken === w) w.goal.spot.taken = null;
    w.doing = null;
    w.path = [];
    w.tgt = null;
    w.wantHome = false;
    w.food = 0;
    w.dest = -1; w.place = null; w.ring = -1; w.nook = null;
    w.actor.hold = 'none';
    for (const s of this.seats) if (s.taken === w) s.taken = null;
    for (const l of this.stallSpots.values()) for (const q of l) if (q.taken === w) q.taken = null;
    for (const l of [this.pray, this.purify, this.meet, this.windows, this.nooks]) for (const q of l) if (q.taken === w) q.taken = null;
  }

  /** People come out (from the station, a doorway, round a corner out of sight) and go home by the hour. */
  private population(dt: number, hour: number, pl: CrowdPlayer): void {
    if ((this.popT -= dt) > 0) return;
    this.popT = 1;
    this.balance();
    // a big city fills (and empties) at the same pace as a small one
    let spawns = Math.max(4, Math.ceil(this.walkers.length / 60)), homes = spawns;
    const order = this.walkers.slice().sort(() => Math.random() - 0.5);
    for (const w of order) {
      if (w.lead) continue;
      const want = w.out < turnout(w.persona, hour);
      if (!w.hidden && !want && !w.wantHome && homes > 0) { w.wantHome = true; homes--; continue; }
      if (!w.hidden || !want || spawns <= 0) continue;
      spawns--;
      this.spawn(w, hour, pl);
    }
  }

  private spawn(w: Walker, hour: number, pl: CrowdPlayer): void {
    const n = this.nodes.length;
    let at: V2 | null = null;
    const roll = Math.random();
    // off the train
    if (w.mode === 'foot' && !w.pet && this.gates.length && within(hour, 5.5, 0.5) && roll < ({ commuter: 0.6, student: 0.45, tourist: 0.45 } as Record<string, number>)[w.persona]) at = pick(this.gates).back;
    // out of a shop or home doorway
    else if (w.mode === 'foot' && roll < 0.7 && this.a.rooms.length) {
      const doors = this.a.rooms.filter((r) => Math.hypot(r.door[0] - pl.x, r.door[1] - pl.z) > 10);
      // out of a doorway in a district that could do with more people
      let best: RoomAnchor | null = null, bs = -1;
      for (let k = 0; k < 6 && doors.length; k++) {
        const r = pick(doors), sc = this.bal(zoneAt(r.door[0], r.door[1])?.id ?? '') * Math.random();
        if (sc > bs) { bs = sc; best = r; }
      }
      if (best) at = best.door;
    }
    // out of a side door or a courtyard gate down a lane
    if (!at && w.mode === 'foot' && this.nooks.length && Math.random() < 0.5) {
      for (let k = 0; k < 6 && !at; k++) {
        const s = pick(this.nooks);
        if (Math.hypot(s.x - pl.x, s.z - pl.z) > 10 && Math.random() < this.bal(zoneAt(s.x, s.z)?.id ?? '') / 1.5) at = [s.x, s.z];
      }
    }
    if (!at && w.mode === 'foot' && this.sento && within(hour, 16, 23.5) && Math.random() < 0.15) at = this.sento.door;
    // round a corner out of sight
    if (!at) {
      for (let k = 0; k < 12; k++) {
        const i = Math.floor(Math.random() * n);
        if (w.ride && !this.rideOk[i]) continue;
        const [x, z] = this.nodes[i];
        if (Math.hypot(x - pl.x, z - pl.z) > this.viewR + 4 || k === 11) { at = [x + rnd(-1, 1), z + rnd(-1, 1)]; break; }
      }
    }
    if (!at) return;
    for (const m of w.mate ? [w, w.mate] : [w]) {
      m.hidden = false;
      m.actor.position.set(at[0] + (m === w ? 0 : 0.4), this.nav.heightAt(at[0], at[1]), at[1]);
      m.actor.anim = 'idle';
      m.v = 0;
      m.wantHome = false;
      m.dist = Math.hypot(at[0] - pl.x, at[1] - pl.z);
    }
    if (w.pet) { w.pet.actor.position.copy(w.actor.position); w.pet.next = rnd(5, 15); }
    if (w.ride) w.ride.parked = false;
    w.from = [at[0], at[1]];
    w.run = w.mode === 'jog';
    this.leave(w);
  }
}

function show(a: Actor, on: boolean): void {
  if (a.root.visible !== on) a.root.visible = on;
}

/** A look that suits the persona (or a random one, whose persona follows from it). */
export function lookFor(seed: number, persona: Persona | null): Look {
  const r = rng(seed + 31);
  const l: Look = { ...randomLook(seed) };
  switch (persona) {
    case 'jogger': {
      const sport = [0xd9534a, 0x3f6e9a, 0xf2c74a, 0x4f9a6b, 0xf08ac0, 0xf4f1ea, 0x2f2f35][Math.floor(r() * 7)];
      Object.assign(l, { topStyle: 'tee', top: sport, accent: sport, bottom: 0x2f2f35, skirt: false, backpack: undefined, glasses: false, hat: r() < 0.4 ? 'cap' : r() < 0.5 ? 'headband' : 'none', hatColor: 0xf4f1ea, shoes: [0xf2efe7, 0xc9463d, 0x3f6e9a][Math.floor(r() * 3)] });
      break;
    }
    case 'courier': {
      const co = [0xd8372b, 0x3f9a5b, 0x2b6cb0, 0xf2a03a][Math.floor(r() * 4)];
      Object.assign(l, { topStyle: 'jacket', top: co, accent: 0xf4f1ea, bottom: 0x2f2f35, skirt: false, backpack: undefined, hat: 'cap', hatColor: co });
      break;
    }
    case 'cyclist': Object.assign(l, { skirt: false, backpack: r() < 0.3 ? 0x3a3a40 : undefined }); break;
    case 'dogwalker': Object.assign(l, { topStyle: r() < 0.5 ? 'cardigan' : 'jacket', backpack: undefined }); break;
    case 'elder': Object.assign(l, { hair: r() < 0.5 ? 0xb9b6b0 : 0x6b6b70, topStyle: r() < 0.5 ? 'cardigan' : 'vest', backpack: undefined }); break;
  }
  return l;
}

// ---------------------------------------------------------------------------------------------
// Swan boats on the park pond

interface Boat { hull: Actor; riders: Actor[]; t: number; speed: number; out: boolean; dock: number }

class Boats {
  private list: Boat[] = [];
  private time = 0;
  constructor(private o: { cx: number; cz: number; rx: number; rz: number; y: number; dock: V2 }, private make: CrowdMaker) {}

  populate(n: number, person: (seed: number) => Actor): void {
    for (let i = 0; i < n; i++) {
      const riders = [person(8100 + i * 3)];
      if (i % 3 !== 2) riders.push(person(8101 + i * 3));
      for (const r of riders) { r.anim = 'sit'; r.noBlob = true; }
      const hull = this.make.boat(8000 + i);
      hull.noBlob = true;
      this.list.push({ hull, riders, t: (i / Math.max(1, n)) * Math.PI * 2, speed: rnd(0.28, 0.4), out: false, dock: i });
    }
  }

  settle(hour: number): void {
    for (const b of this.list) b.out = within(hour, 9, 17.5);
  }

  update(dt: number, hour: number): void {
    this.time += dt;
    const o = this.o;
    const open = within(hour, 9, 17.5);
    for (const b of this.list) {
      if (b.out !== open) b.out = open;
      const h = b.hull, p = h.position;
      if (b.out) {
        b.t += (b.speed * dt) / ((o.rx + o.rz) / 2);
        const x = o.cx + Math.cos(b.t) * o.rx, z = o.cz + Math.sin(b.t) * o.rz;
        p.set(x, o.y - 0.12 + Math.sin(this.time * 1.4 + b.dock) * 0.02, z);
        h.facing = h.targetFacing = Math.atan2(-Math.sin(b.t) * o.rx, Math.cos(b.t) * o.rz);
      } else {
        p.set(o.dock[0] - 1.2 + b.dock * 1.9, o.y - 0.12 + Math.sin(this.time * 0.9 + b.dock) * 0.012, o.dock[1] - 0.6);
        h.facing = h.targetFacing = Math.PI;
      }
      h.root.rotation.z = Math.sin(this.time * 1.1 + b.dock * 2) * 0.03;
      h.root.rotation.x = Math.sin(this.time * 0.8 + b.dock) * 0.02;
      const f = h.facing;
      b.riders.forEach((r, i) => {
        const side = b.riders.length === 1 ? 0 : i ? 0.36 : -0.36;
        r.position.set(p.x + Math.cos(f) * side - Math.sin(f) * 0.62, p.y + 0.5 - SIT_DROP, p.z - Math.sin(f) * side - Math.cos(f) * 0.62);
        r.facing = r.targetFacing = f;
        r.anim = 'sit';
        r.headYawTarget = Math.sin(this.time * 0.2 + i * 2 + b.dock) * 0.7;
      });
    }
  }

  *visible(pl: CrowdPlayer, viewR: number): Generator<Actor> {
    for (const b of this.list) {
      const on = Math.hypot(b.hull.position.x - pl.x, b.hull.position.z - pl.z) < viewR + 4;
      show(b.hull, on);
      for (const r of b.riders) show(r, on && b.out);
      if (!on) continue;
      yield b.hull;
      if (b.out) yield* b.riders;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Gozzi out in the bay

interface SeaBoat { hull: Actor; riders: Actor[]; t: number; speed: number; ring: number; from: number; to: number }

class SeaBoats {
  private list: SeaBoat[] = [];
  private time = 0;
  constructor(private o: { cx: number; cz: number; rx: number; rz: number; y: number }, private make: CrowdMaker) {}

  populate(n: number, person: (seed: number) => Actor): void {
    for (let i = 0; i < n; i++) {
      // a fisherman at the tiller, now and then a friend on the forward thwart
      const riders = [person(8200 + i * 3)];
      if (i % 2) riders.push(person(8201 + i * 3));
      for (const r of riders) { r.anim = 'sit'; r.noBlob = true; }
      const hull = this.make.boat(8300 + i);
      hull.noBlob = true;
      // concentric rings, alternate ones run the other way round, so no two boats ever meet
      const dir = i % 2 ? -1 : 1;
      this.list.push({ hull, riders, t: (i / Math.max(1, n)) * Math.PI * 2 + i, speed: dir * rnd(1.6, 2.6), ring: i, from: 6.2 + i * 0.35, to: 19.2 + i * 0.3 });
    }
  }

  settle(_hour: number): void {}

  update(dt: number, hour: number): void {
    this.time += dt;
    const o = this.o;
    for (const b of this.list) {
      const h = b.hull, p = h.position;
      const rx = o.rx + b.ring * 2, rz = o.rz + b.ring * 3.2;
      b.t += (b.speed * dt) / ((rx + rz) / 2);
      const s = Math.sin(b.t), c = Math.cos(b.t), dir = Math.sign(b.speed);
      p.set(o.cx + c * rx, o.y - 0.18 + Math.sin(this.time * 1.3 + b.ring) * 0.05, o.cz + s * rz);
      h.facing = h.targetFacing = Math.atan2(-s * rx * dir, c * rz * dir);
      // riding the swell: the bow lifts and falls, the hull rolls a little
      h.root.rotation.z = Math.sin(this.time * 0.9 + b.ring * 2) * 0.05;
      h.root.rotation.x = Math.sin(this.time * 1.3 + b.ring) * 0.04 - 0.03;
      const f = h.facing;
      b.riders.forEach((r, i) => {
        const along = i ? 0.5 : -1.8;
        r.position.set(p.x + Math.sin(f) * along, p.y + 0.5 - SIT_DROP, p.z + Math.cos(f) * along);
        r.facing = r.targetFacing = f;
        r.anim = 'sit';
        r.headYawTarget = Math.sin(this.time * 0.15 + i * 2 + b.ring) * 0.8;
      });
    }
    this.hour = hour;
  }

  private hour = 12;

  *visible(pl: CrowdPlayer, viewR: number): Generator<Actor> {
    for (const b of this.list) {
      const on = within(this.hour, b.from, b.to) && Math.hypot(b.hull.position.x - pl.x, b.hull.position.z - pl.z) < viewR + 12;
      show(b.hull, on);
      for (const r of b.riders) show(r, on);
      if (!on) continue;
      yield b.hull;
      yield* b.riders;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Bathers: lying in the sun on the lido beds and the towels, sitting up to look at the sea, swimming off the shore

interface Bather { a: Actor; x: number; z: number; y: number; face: number; mode: 'lie' | 'sit' | 'swim'; from: number; to: number; ph: number }

/** Swimwear: trunks or a costume in a bright colour, bare feet, sunglasses and a straw hat for some on the sand. */
function batherLook(seed: number, swim: boolean): Look {
  const r = rng(seed + 57);
  const l: Look = { ...randomLook(seed) };
  const suit = [0xd9534a, 0x2f6fae, 0xf2c74a, 0x4f9a6b, 0xf08ac0, 0x2f2f35, 0xe8743a][Math.floor(r() * 7)];
  const bare = r() < 0.5;
  Object.assign(l, {
    topStyle: 'tee', top: bare ? l.skin : suit, accent: bare ? l.skin : suit, bottom: suit, shorts: true, skirt: false, shoes: l.skin,
    backpack: undefined, charm: false, glasses: !swim && r() < 0.5, hat: !swim && r() < 0.25 ? 'straw' : 'none', hatColor: 0xe8d8a8,
  });
  return l;
}

class Beach {
  private list: Bather[] = [];
  private hour = 12;
  private time = 0;
  constructor(private o: NonNullable<CrowdSpots['beach']>, private ground: (x: number, z: number) => number) {}

  populate(n: number, person: (look: Look) => Actor): void {
    const r = rng(4711);
    const swimmers = Math.min(this.o.swim.length, Math.round(n * 0.25));
    // a fixed shuffle of the beds, so the same ones are taken every visit
    const beds = this.o.beds.map((b) => ({ b, k: r() })).sort((p, q) => p.k - q.k).map((e) => e.b);
    for (let i = 0; i < Math.min(n, swimmers + beds.length); i++) {
      const swim = i < swimmers;
      const a = person(batherLook(9500 + i * 7, swim));
      a.noBlob = true;
      const from = 8.3 + r() * 2.5, to = 16.5 + r() * 2.5, ph = r() * 10;
      if (swim) {
        const [x, z] = this.o.swim[i];
        this.list.push({ a, x, z, y: this.o.seaY - 1.42, face: 0, mode: 'swim', from, to, ph });
        continue;
      }
      const b = beds[i - swimmers];
      const sand = this.ground(b.at[0], b.at[1]);
      // on a lido bed some sit up facing the sea; on a towel everyone lies down
      if (b.top > 0.2 && r() < 0.3) {
        this.list.push({ a, x: b.x, z: b.z, y: sand + b.top - SIT_DROP, face: Math.PI / 2, mode: 'sit', from, to, ph });
        continue;
      }
      // lying on the back, feet at the foot end: the body is pitched over the feet, so the root goes there
      const hx = Math.sin(b.face), hz = Math.cos(b.face);
      a.root.rotation.order = 'YXZ';
      a.root.rotation.x = -Math.PI / 2;
      this.list.push({ a, x: b.x - hx * 0.85, z: b.z - hz * 0.85, y: sand + b.top + 0.14, face: b.face + Math.PI, mode: 'lie', from, to, ph });
    }
  }

  update(dt: number, hour: number): void {
    this.time += dt;
    this.hour = hour;
    for (const b of this.list) {
      const a = b.a;
      if (b.mode === 'swim') {
        // breaststroke in a slow loop round their spot, the head bobbing at the surface
        const t = this.time * 0.12 + b.ph;
        const x = b.x + Math.sin(t) * 1.3, z = b.z + Math.sin(t * 2) * 0.9;
        a.position.set(x, b.y + Math.sin(this.time * 1.8 + b.ph) * 0.05, z);
        a.facing = a.targetFacing = Math.atan2(Math.cos(t) * 1.3, Math.cos(t * 2) * 1.8);
        a.anim = 'idle';
        continue;
      }
      a.position.set(b.x, b.y, b.z);
      a.facing = a.targetFacing = b.face;
      a.anim = b.mode === 'sit' ? 'sit' : 'idle';
      a.headYawTarget = b.mode === 'sit' ? Math.sin(this.time * 0.1 + b.ph) * 0.6 : 0;
    }
  }

  *visible(pl: CrowdPlayer, viewR: number): Generator<Actor> {
    for (const b of this.list) {
      const on = within(this.hour, b.from, b.to) && Math.hypot(b.x - pl.x, b.z - pl.z) < viewR;
      show(b.a, on);
      if (on) yield b.a;
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Radio calisthenics on the park lawn at dawn

class Exercise {
  private people: Actor[] = [];
  private spots: { x: number; z: number; face: number }[] = [];
  constructor(private centres: V2[], _make: CrowdMaker, private free: (x: number, z: number) => boolean, private height: (x: number, z: number) => number) {}

  populate(n: number, person: (seed: number) => Actor): void {
    if (n < 3) return;
    // the first lawn with room for a leader and rows of followers facing them
    for (const [cx, cz] of this.centres) {
      const s: { x: number; z: number; face: number }[] = [{ x: cx, z: cz - 2.2, face: 0 }];
      for (let row = 0; row < 2; row++) for (let col = -2; col <= 2; col++) s.push({ x: cx + col * 1.3, z: cz + row * 1.4, face: Math.PI });
      const ok = s.filter((q) => this.free(q.x, q.z));
      if (!this.free(cx, cz - 2.2) || ok.length < n) continue;
      this.spots = [s[0], ...ok.filter((q) => q !== s[0]).slice(0, n - 1)];
      break;
    }
    if (!this.spots.length) return;
    this.people = this.spots.map((q, i) => {
      const a = person(9000 + i * 5);
      a.position.set(q.x, this.height(q.x, q.z), q.z);
      a.facing = a.targetFacing = q.face;
      a.anim = 'exercise';
      return a;
    });
  }

  private active = false;

  update(_dt: number, hour: number): void {
    // gathering a few minutes early, then the broadcast starts at half past six
    this.active = within(hour, 6.2, 7.6);
    for (const a of this.people) a.anim = within(hour, 6.2, 6.5) ? 'idle' : 'exercise';
  }

  *visible(pl: CrowdPlayer, viewR: number): Generator<Actor> {
    for (const a of this.people) {
      const on = this.active && Math.hypot(a.position.x - pl.x, a.position.z - pl.z) < viewR;
      show(a, on);
      if (on) yield a;
    }
  }
}
