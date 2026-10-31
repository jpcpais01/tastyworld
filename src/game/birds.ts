import * as THREE from 'three';
import { meshGrid } from '../world/mesher';
import { buildBird, BIRD_PART, type Species } from '../world/birds';
import { HILLSIDE } from '../world/cityId';
import { POSE, type CharacterBatch } from './charbatch';
import { sampleLightmap } from './actors';
import type { NavData, LightMap2D } from '../world/bake';
import type { Anchors } from '../world/tokyo';
import { V, G, WATER_Y, zoneAt } from '../world/layout';
import { rng } from '../world/grid';
import { solidBase } from '../world/owners';

/**
 * The birds of the city: flocks of pigeons on the squares, sparrows hopping along the lanes, crows on the
 * roofs, wagtails running about the canal, bulbuls and turtle doves in the green, and now and then a
 * kingfisher on the canal bank.
 *
 * Each flock belongs to a spot: a patch of open ground (or a few perches) with the roof edges, overhead
 * wires and bank stones nearby that its birds fly up to. Spots are found once from the baked world. A
 * flock only exists while the player is near its spot, so the city can hold hundreds of them for the cost
 * of the few in view. Birds are bodies in the character batch (one shared mesh per plumage), so every
 * bird in town is part of the same single draw and shadow draw as the people.
 */

/** How a species lives. */
interface Kind {
  /** Placement scale of the model. */
  size: number;
  /** Ground gait: a nodding walk, two-footed hops, quick dashes, or none (it stays on its perch). */
  gait: 'walk' | 'hop' | 'run' | 'none';
  /** Walking pace (m/s), or the length of a hop (m). */
  pace: number;
  /** Flight speed (m/s) and wingbeats a second. */
  fly: number;
  flap: number;
  /** Between wingbeats: hold the wings out and sail, close them and bound (small birds), or keep flapping. */
  glide: 'soar' | 'bound' | 'none';
  /** How close a walking person may come before it flies (m). */
  flush: number;
  /** Hours it gets up and goes to roost (each bird adds a little of its own). */
  wake: number;
  sleep: number;
  flock: [number, number];
  /** Where it likes to sit. */
  perch: 'wire' | 'roof' | 'any' | 'bank';
}

const KIND: Record<Species, Kind> = {
  pigeon: { size: 0.95, gait: 'walk', pace: 0.32, fly: 6.5, flap: 7, glide: 'soar', flush: 1.6, wake: 5.3, sleep: 18.7, flock: [5, 13], perch: 'roof' },
  dove: { size: 0.9, gait: 'walk', pace: 0.27, fly: 6.5, flap: 7, glide: 'soar', flush: 2.4, wake: 5.0, sleep: 18.3, flock: [1, 2], perch: 'any' },
  sparrow: { size: 0.68, gait: 'hop', pace: 0.08, fly: 5, flap: 15, glide: 'bound', flush: 2.3, wake: 4.9, sleep: 18.2, flock: [3, 8], perch: 'wire' },
  crow: { size: 1, gait: 'walk', pace: 0.45, fly: 5.5, flap: 4, glide: 'soar', flush: 3.0, wake: 4.8, sleep: 18.0, flock: [1, 3], perch: 'roof' },
  wagtail: { size: 0.62, gait: 'run', pace: 0.95, fly: 5.5, flap: 12, glide: 'bound', flush: 2.6, wake: 5.0, sleep: 18.4, flock: [1, 2], perch: 'any' },
  bulbul: { size: 0.82, gait: 'hop', pace: 0.1, fly: 6, flap: 11, glide: 'bound', flush: 2.8, wake: 4.9, sleep: 18.3, flock: [1, 3], perch: 'wire' },
  gull: { size: 1, gait: 'walk', pace: 0.5, fly: 7, flap: 3.2, glide: 'soar', flush: 3.4, wake: 5.0, sleep: 19.5, flock: [2, 6], perch: 'roof' },
  kingfisher: { size: 0.66, gait: 'none', pace: 0, fly: 8, flap: 18, glide: 'none', flush: 5.5, wake: 5.5, sleep: 18.0, flock: [1, 1], perch: 'bank' },
};

/** Pigeon plumages and how common each is on the street: blue bar, chequer, dark, red, pale. */
const PIGEON_MORPHS = [0.45, 0.25, 0.12, 0.08, 0.1];

interface Perch { x: number; y: number; z: number; face: number; wire: boolean }
interface Spot {
  x: number; z: number; r: number;
  sp: Species;
  /** Birds forage on the ground here; otherwise they live on the perches. */
  ground: boolean;
  perches: Perch[];
  /** Kingfisher: out over the water from the bank (unit x, z). */
  water: [number, number] | null;
  /** How likely the flock is about when the player comes by. */
  chance: number;
  birds: Bird[];
  on: boolean;
  /** Perches checked for a clear flight from the ground (done the first time the spot wakes). */
  checked: boolean;
}

type State = 'ground' | 'perch' | 'fly' | 'dive' | 'away';
type Act = 'idle' | 'peck' | 'move' | 'preen' | 'shake' | 'call' | 'sleep';
type Then = 'ground' | 'perch' | 'away' | 'dive';

interface Bird {
  k: Kind;
  sp: Species;
  spot: Spot;
  id: number;
  tex: Float32Array;
  size: number;
  x: number; y: number; z: number;
  yaw: number; tYaw: number;
  state: State;
  act: Act; at: number; ad: number;
  tx: number; tz: number; hurry: number;
  hopT: number;
  perch: Perch | null;
  dwell: number;
  // flight: a curve from f0 over fc to f1, ft of fT seconds along it
  f0: THREE.Vector3; fc: THREE.Vector3; f1: THREE.Vector3; fT: number; ft: number; then: Then; next: Perch | null;
  // pose
  fold: number; flapPh: number; pitch: number; roll: number; headYaw: number; headYawT: number; headPitch: number; tail: number; lift: number;
  flushIn: number; fromX: number; fromZ: number;
  away: number;
  check: number;
  lightT: number;
  wakeAt: number; sleepAt: number;
  shown: boolean;
}

/** Someone the birds keep an eye on: where they are and how fast they move. */
export interface Threat { x: number; z: number; speed: number }
/** Nearest crowd walker within r metres of a point (see Crowd.nearest). */
export type CrowdNear = (x: number, z: number, r: number) => { d: number; speed: number; x: number; z: number };

export interface BirdWorld {
  nav: NavData;
  /** Per-column top of the solid run from street level, per-column 64-layer occupancy and shore distance (see BakedWorld). */
  height: Uint8Array;
  solid: Uint32Array;
  /** Hillside cities: the terrain under each column, where its 64 layers start from (see solidBase). */
  ground?: Uint8Array | null;
  shore: Uint8Array;
  lightmap: LightMap2D;
  anchors: Anchors;
}

const BLOCKED = 255;
const TAU = Math.PI * 2;
const HASH = 8;
/** Most birds about at once. */
const MAX_BIRDS = 320;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const pick = <T,>(l: T[]) => l[Math.floor(Math.random() * l.length)];
const angDiff = (a: number, b: number) => Math.atan2(Math.sin(b - a), Math.cos(b - a));
const tmpL = new Float32Array(5);
const mtx = new THREE.Matrix4();
const vA = new THREE.Vector3();
/** Scratch for checking flight paths (callers pass vA as the destination). */
const vS = new THREE.Vector3();

/** Zones and the birds found there: [species, weight]. */
const SQUARES = new Set(['plaza', 'ekimae', 'midori', 'park', 'inari', 'station', 'piazza', 'dogi', 'scalinata', 'meydan', 'yeni', 'teras', 'suleymaniye']);
const GREEN = new Set(['midori', 'park', 'inari', 'yanaka', 'limoni', 'limoni2', 'chiostro', 'teras']);
const WATERSIDE = new Set(['canal', 'farbank', 'marina', 'molo', 'lungomare', 'halic', 'bogaz', 'kopru', 'kadikoy', 'uskudar', 'halicpier', 'kucukpazar']);
const AVENUES = new Set(['hikari', 'neon', 'minami', 'nishi', 'center']);

export class Birds {
  /** Every flock in town (most of them away from the player, so empty). */
  readonly spots: Spot[] = [];
  private roofs = new Map<number, Perch[]>();
  private wires = new Map<number, Perch[]>();
  private banks: Perch[] = [];
  private shapes = new Map<string, { gid: number; pivots: THREE.Vector3[] }>();
  private live: Bird[] = [];
  private scan = 0;
  private hidden = false;
  private nav: NavData;

  constructor(private w: BirdWorld, private batch: CharacterBatch | null, seed = 4242) {
    this.nav = w.nav;
    const r = rng(seed);
    this.findWires();
    this.findRoofs(r);
    this.findBanks(r);
    this.placeFlocks(r);
  }

  /** Birds about right now (for the perf overlay and the checks). */
  get count(): number {
    return this.live.length;
  }

  /** Every bird about right now (read only; for the checks). */
  get birds(): readonly Bird[] {
    return this.live;
  }

  // ------------------------------------------------------------------ the world, as birds see it

  private cell(x: number, z: number): number {
    const n = this.nav, ix = Math.floor((x - n.ox) / V), iz = Math.floor((z - n.oz) / V);
    return ix < 0 || iz < 0 || ix >= n.sx || iz >= n.sz ? -1 : iz * n.sx + ix;
  }

  /** Is the voxel at a point solid (y in metres above the street; only the 16 m above the column's base are known). */
  solidAt(x: number, y: number, z: number): boolean {
    const c = this.cell(x, z);
    if (c < 0 || y < 0) return false;
    const l = Math.floor(y / V) - solidBase(this.w.ground, c);
    if (l < 0) return true;
    if (l >= 64) return false;
    return ((this.w.solid[c * 2 + (l >> 5)] >>> (l & 31)) & 1) === 1;
  }

  /** Ground a bird can stand and forage on: walkable, open to the sky, dry. Returns the floor height, or NaN. */
  private groundAt(x: number, z: number): number {
    const c = this.cell(x, z);
    if (c < 0) return NaN;
    const h = this.nav.height[c];
    if (h === BLOCKED || this.w.shore[c] > 128 - 24) return NaN;
    const y = (h - G) * V;
    for (let k = 0; k < 24; k += 3) if (this.solidAt(x, y + 0.1 + k * V, z)) return NaN;
    return y;
  }

  private key(x: number, z: number): number {
    return (Math.floor(x / HASH) + 512) * 1024 + Math.floor(z / HASH) + 512;
  }

  private near(map: Map<number, Perch[]>, x: number, z: number, r: number, out: Perch[]): void {
    const n = Math.ceil(r / HASH), kx = Math.floor(x / HASH) + 512, kz = Math.floor(z / HASH) + 512;
    for (let ix = kx - n; ix <= kx + n; ix++) for (let iz = kz - n; iz <= kz + n; iz++) {
      const l = map.get(ix * 1024 + iz);
      if (l) for (const p of l) if (Math.hypot(p.x - x, p.z - z) < r) out.push(p);
    }
  }

  private add(map: Map<number, Perch[]>, p: Perch): void {
    const k = this.key(p.x, p.z), l = map.get(k);
    if (l) l.push(p); else map.set(k, [p]);
  }

  /** Seats along the overhead wires, near the ends where the lanterns aren't and the wire hardly swings. */
  private findWires(): void {
    for (const [x0, z0, x1, z1, top, sag] of this.w.anchors.wires) {
      const len = Math.hypot(x1 - x0, z1 - z0);
      if (len < 1.2) continue;
      const n = Math.floor(len / 0.32);
      const face = Math.atan2(-(z1 - z0), x1 - x0);
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        if (t < 0.05 || t > 0.95 || (t > 0.3 && t < 0.7)) continue;
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = top - sag * 4 * t * (1 - t);
        if (this.solidAt(x, y + 0.12, z) || this.solidAt(x, y + 0.35, z)) continue;
        this.add(this.wires, { x, y, z, face: face + (i % 2 ? Math.PI : 0), wire: true });
      }
    }
  }

  /** Roof edges and parapets: high columns with a drop of 2 m or more right beside them, open above. */
  private findRoofs(r: () => number): void {
    const { sx, sz, ox, oz } = this.nav, h = this.w.height;
    const at = (x: number, z: number) => (x < 0 || z < 0 || x >= sx || z >= sz ? 0 : h[z * sx + x]);
    const dirs: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    const taken = new Set<number>();
    for (let z = 2; z < sz - 2; z += 2)
      for (let x = 2; x < sx - 2; x += 2) {
        const top = h[z * sx + x];
        if (top < 12 || top > 60) continue;
        for (const [dx, dz] of dirs) {
          if (at(x + dx * 2, z + dz * 2) > top - 8 || at(x + dx, z + dz) > top) continue;
          // a ledge, not a spike: the roof carries on behind and along the edge
          if (Math.abs(at(x - dx, z - dz) - top) > 1) continue;
          if (Math.abs(at(x + dz, z + dx) - top) > 1 || Math.abs(at(x - dz, z - dx) - top) > 1) continue;
          const px = ox + (x + 0.5) * V + dx * 0.08, pz = oz + (z + 0.5) * V + dz * 0.08, py = top * V;
          if (this.solidAt(px, py + 0.1, pz) || this.solidAt(px, py + 0.6, pz)) continue;
          // one perch every metre or so along an edge
          const k = Math.floor(px / 1.2) * 4096 + Math.floor(pz / 1.2);
          if (taken.has(k) || r() < 0.25) continue;
          taken.add(k);
          this.add(this.roofs, { x: px, y: py, z: pz, face: Math.atan2(dx, dz), wire: false });
        }
      }
  }

  /** Bank stones right at the water's edge, facing out over it. */
  private findBanks(r: () => number): void {
    const { sx, sz, ox, oz } = this.nav, s = this.w.shore;
    for (let z = 1; z < sz - 1; z += 2)
      for (let x = 1; x < sx - 1; x += 2) {
        const v = s[z * sx + x];
        if (v < 128 - 14 || v >= 128 || r() < 0.6) continue;
        const gx = s[z * sx + x + 1] - s[z * sx + x - 1], gz = s[(z + 1) * sx + x] - s[(z - 1) * sx + x], gl = Math.hypot(gx, gz);
        if (gl < 1) continue;
        const px = ox + (x + 0.5) * V, pz = oz + (z + 0.5) * V;
        const top = this.w.height[z * sx + x] * V;
        const nh = this.nav.height[z * sx + x];
        const y = nh !== BLOCKED ? Math.max(top, (nh - G) * V) : top;
        if (y > 1.5 || this.solidAt(px, y + 0.1, pz) || this.solidAt(px, y + 0.4, pz)) continue;
        this.banks.push({ x: px, y, z: pz, face: Math.atan2(gx / gl, gz / gl), wire: false });
      }
  }

  /** Spread the flocks over town: pigeons on the squares, sparrows along the lanes, and so on (see KIND). */
  private placeFlocks(r: () => number): void {
    const { sx, sz, ox, oz } = this.nav;
    const spacing = new Map<number, Spot[]>();
    const room = (x: number, z: number, d: number) => {
      const kx = Math.floor(x / 16), kz = Math.floor(z / 16);
      for (let i = kx - 1; i <= kx + 1; i++) for (let j = kz - 1; j <= kz + 1; j++)
        for (const o of spacing.get(i * 4096 + j) ?? []) if (Math.hypot(o.x - x, o.z - z) < d) return false;
      return true;
    };
    const keep = (s: Spot) => {
      this.spots.push(s);
      const k = Math.floor(s.x / 16) * 4096 + Math.floor(s.z / 16);
      const l = spacing.get(k);
      if (l) l.push(s); else spacing.set(k, [s]);
    };
    const choose = (opts: [Species, number][]): Species => {
      let t = 0;
      for (const [, w] of opts) t += w;
      let u = r() * t;
      for (const [s, w] of opts) if ((u -= w) <= 0) return s;
      return opts[0][0];
    };
    const spot = (x: number, z: number, sp: Species, ground: boolean, rad: number, perches: Perch[] = []): Spot =>
      ({ x, z, r: rad, sp, ground, perches, water: null, chance: 0.92, birds: [], on: false, checked: false });

    // ground flocks, on a jittered 3 m lattice
    const step = 12;
    for (let cz = 0; cz < sz; cz += step)
      for (let cx = 0; cx < sx; cx += step) {
        const x = ox + (cx + r() * step) * V, z = oz + (cz + r() * step) * V;
        const zone = zoneAt(x, z)?.id ?? '';
        if (zone === 'kakurega' || zone === 'grotta' || zone === 'gizli' || zone === 'kapali' || zone === 'misir') continue;
        const sq = SQUARES.has(zone), green = GREEN.has(zone), water = WATERSIDE.has(zone), ave = AVENUES.has(zone);
        // the pigeons of Eminönü, fed by the seed sellers in front of the New Mosque, are a flock all of their own
        const density = zone === 'meydan' || zone === 'yeni' ? 0.85 : sq ? 0.4 : water ? 0.3 : ave ? 0.07 : 0.14;
        if (r() > density) continue;
        const y = this.groundAt(x, z);
        if (Number.isNaN(y)) continue;
        // room to forage: open ground around it too
        let open = 0;
        for (let k = 0; k < 8; k++) if (!Number.isNaN(this.groundAt(x + Math.cos(k * 0.785) * 1.2, z + Math.sin(k * 0.785) * 1.2))) open++;
        if (open < 6) continue;
        const sp = choose(HILLSIDE ? (sq
          ? [['pigeon', 1], ['sparrow', 0.5], ['gull', 0.12], ['dove', 0.1], ['crow', 0.05]]
          : water ? [['gull', 1], ['pigeon', 0.35], ['wagtail', 0.35], ['sparrow', 0.15]]
          : green ? [['sparrow', 0.6], ['dove', 0.4], ['crow', 0.2], ['wagtail', 0.1]]
          : [['sparrow', 0.65], ['pigeon', 0.4], ['dove', 0.12], ['crow', 0.06]]) : sq
          ? [['pigeon', 1], ['sparrow', 0.45], ['crow', 0.12], ['dove', green ? 0.3 : 0.04], ['bulbul', green ? 0.25 : 0], ['wagtail', 0.15]]
          : water ? [['pigeon', 0.5], ['wagtail', 0.7], ['sparrow', 0.35], ['crow', 0.1]]
          : green ? [['sparrow', 0.6], ['bulbul', 0.4], ['dove', 0.3], ['pigeon', 0.3], ['crow', 0.15]]
          : [['sparrow', 0.65], ['pigeon', 0.35], ['crow', 0.18], ['wagtail', 0.12]]);
        const gap = sp === 'pigeon' ? (zone === 'meydan' || zone === 'yeni' ? 4.5 : 9) : 7;
        if (!room(x, z, gap)) continue;
        keep(spot(x, z, sp, true, sp === 'pigeon' ? 2.6 : sp === 'crow' ? 2.2 : 1.6));
      }
    // birds that sit about up top: sparrows and bulbuls on wires, crows and pigeons along the roofs
    for (const l of this.wires.values()) for (const p of l) {
      if (r() > 0.07 || !room(p.x, p.z, 5)) continue;
      const sp: Species = r() < 0.6 ? 'sparrow' : r() < 0.6 ? (HILLSIDE ? 'dove' : 'bulbul') : 'pigeon';
      const near: Perch[] = [];
      this.near(this.wires, p.x, p.z, 3, near);
      keep(spot(p.x, p.z, sp, false, 0, near.filter((q) => Math.abs(q.y - p.y) < 0.6).slice(0, 8)));
    }
    for (const l of this.roofs.values()) for (const p of l) {
      if (r() > 0.03 || !room(p.x, p.z, 10)) continue;
      const sp: Species = HILLSIDE ? (r() < 0.45 ? 'gull' : r() < 0.15 ? 'crow' : 'pigeon') : r() < 0.45 ? 'crow' : 'pigeon';
      const near: Perch[] = [];
      this.near(this.roofs, p.x, p.z, 3, near);
      keep(spot(p.x, p.z, sp, false, 0, near.filter((q) => Math.abs(q.y - p.y) < 0.3).slice(0, 8)));
    }
    // kingfishers: a few stretches of bank, far apart, and not always at home
    const banks = this.banks.filter(() => r() < 0.5);
    const kf: Spot[] = [];
    for (const b of banks) {
      if (kf.some((o) => Math.hypot(o.x - b.x, o.z - b.z) < 30)) continue;
      const along = this.banks.filter((q) => Math.hypot(q.x - b.x, q.z - b.z) < 22 && Math.abs(q.y - b.y) < 0.6);
      if (along.length < 3) continue;
      const s = spot(b.x, b.z, 'kingfisher', false, 0, along.slice(0, 12));
      s.water = [Math.sin(b.face), Math.cos(b.face)];
      s.chance = 0.35;
      kf.push(s);
      this.spots.push(s);
    }
  }

  /** Perches a ground flock flies up to: the kind it likes within 22 m, reachable without hitting a wall. */
  private wake(s: Spot, gy: number): void {
    s.checked = true;
    if (!s.ground) return;
    const k = KIND[s.sp], cand: Perch[] = [];
    if (k.perch !== 'roof') this.near(this.wires, s.x, s.z, 18, cand);
    if (k.perch !== 'wire' || cand.length < 3) this.near(this.roofs, s.x, s.z, 22, cand);
    // nearest first, a few of them
    cand.sort((a, b) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(b.x - s.x, b.z - s.z));
    const from = vA.set(s.x, gy + 0.3, s.z);
    for (const p of cand) {
      if (s.perches.length >= 6) break;
      if (p.wire === false && Math.cos(p.face - Math.atan2(s.x - p.x, s.z - p.z)) < -0.2) continue; // the far side of the roof
      if (this.route(from, new THREE.Vector3(p.x, p.y, p.z), null)) s.perches.push(p);
    }
  }

  // ------------------------------------------------------------------ flight paths

  /** Plans a curved flight from a to b (filling c with the control point); false if it would hit a wall. */
  private route(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3 | null, loop = 0): boolean {
    const d = Math.hypot(b.x - a.x, b.z - a.z);
    const ctl = c ?? new THREE.Vector3();
    for (const extra of [0, 2.5]) {
      ctl.set((a.x + b.x) / 2, Math.max(a.y, b.y) + Math.min(6, 0.5 + d * 0.22) + extra, (a.z + b.z) / 2);
      if (loop) {
        // swing wide to one side (pigeons wheeling round and settling back down)
        const ux = (b.x - a.x) / (d || 1), uz = (b.z - a.z) / (d || 1);
        ctl.x += -uz * loop; ctl.z += ux * loop;
      }
      if (this.clear(a, ctl, b, 0.1)) return true;
    }
    return false;
  }

  /** No wall along the curve a, c, b, leaving out `end` of it at each end (taking off, landing). */
  private clear(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, end: number): boolean {
    const len = a.distanceTo(c) + c.distanceTo(b), n = Math.max(8, Math.ceil(len / 0.3));
    for (let i = 0; i <= n; i++) {
      const t = end + (1 - 2 * end) * (i / n);
      bez(a, c, b, t, vS);
      if (this.solidAt(vS.x, vS.y, vS.z)) return false;
    }
    return true;
  }

  private fly(b: Bird, to: THREE.Vector3, then: Then, next: Perch | null = null, loop = 0): boolean {
    b.f0.set(b.x, b.y, b.z);
    if (!this.route(b.f0, to, b.fc, loop)) return false;
    b.f1.copy(to);
    const len = b.f0.distanceTo(b.fc) + b.fc.distanceTo(b.f1);
    b.fT = Math.max(0.5, len / b.k.fly) * rnd(0.9, 1.1);
    b.ft = 0;
    b.state = 'fly';
    b.then = then;
    b.next = next;
    b.perch = null;
    b.flushIn = -1;
    return true;
  }

  /** Up and away over the roofs, whichever way is clear (straight up if none is); back some time later. */
  private leave(b: Bird, fromX: number, fromZ: number): void {
    const base = Math.atan2(b.x - fromX, b.z - fromZ);
    b.f0.set(b.x, b.y, b.z);
    let ok = false;
    for (const off of [0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9, Math.PI]) {
      const a = base + off + rnd(-0.2, 0.2), sx = Math.sin(a), sz = Math.cos(a);
      b.fc.set(b.x + sx * 4, b.y + 6, b.z + sz * 4);
      b.f1.set(b.x + sx * 28, b.y + 20, b.z + sz * 28);
      if ((ok = this.clear(b.f0, b.fc, b.f1, 0.06))) break;
    }
    if (!ok) { b.fc.set(b.x, b.y + 9, b.z); b.f1.set(b.x + Math.sin(base) * 8, b.y + 24, b.z + Math.cos(base) * 8); }
    b.fT = 34 / b.k.fly;
    b.ft = 0;
    b.state = 'fly';
    b.then = 'away';
    b.next = null;
    b.perch = null;
    b.flushIn = -1;
  }

  // ------------------------------------------------------------------ flocks coming and going

  private shape(sp: Species, variant: number): { gid: number; pivots: THREE.Vector3[] } {
    const key = sp + variant;
    let s = this.shapes.get(key);
    if (!s) {
      const m = buildBird(sp, variant);
      const md = meshGrid({ grid: m.grid, pal: m.pal, scale: m.scale, origin: m.origin, parts: m.parts });
      s = { gid: this.batch ? this.batch.shared(md) : -1, pivots: m.pivots.map((p) => new THREE.Vector3(...p)) };
      this.shapes.set(key, s);
    }
    return s;
  }

  private spawn(s: Spot, hour: number): void {
    s.on = true;
    if (Math.random() > s.chance) return;
    const k = KIND[s.sp];
    const gy = s.ground ? this.groundAt(s.x, s.z) : NaN;
    if (!s.checked) this.wake(s, Number.isNaN(gy) ? 0 : gy);
    const n = Math.round(rnd(k.flock[0], k.flock[1] + 0.49));
    for (let i = 0; i < n && this.live.length < MAX_BIRDS; i++) {
      let variant = 0;
      if (s.sp === 'pigeon') { let u = Math.random(); while (variant < PIGEON_MORPHS.length - 1 && (u -= PIGEON_MORPHS[variant]) > 0) variant++; }
      const sh = this.shape(s.sp, variant);
      const id = this.batch ? this.batch.addCopy(sh.gid, sh.pivots) : -1;
      const tex = this.batch ? this.batch.texels(id) : new Float32Array(32 * 4);
      if (!this.batch) for (let j = 0; j < sh.pivots.length; j++) sh.pivots[j].toArray(tex, (POSE.pivot + j) * 4);
      const b: Bird = {
        k, sp: s.sp, spot: s, id, tex, size: k.size * rnd(0.93, 1.07),
        x: s.x, y: 0, z: s.z, yaw: Math.random() * TAU, tYaw: 0, state: 'away',
        act: 'idle', at: 0, ad: rnd(0.3, 2), tx: s.x, tz: s.z, hurry: 1, hopT: 0, perch: null, dwell: rnd(5, 30),
        f0: new THREE.Vector3(), fc: new THREE.Vector3(), f1: new THREE.Vector3(), fT: 1, ft: 0, then: 'ground', next: null,
        fold: 1, flapPh: Math.random() * TAU, pitch: 0, roll: 0, headYaw: 0, headYawT: 0, headPitch: 0, tail: 0, lift: 0,
        flushIn: -1, fromX: 0, fromZ: 0, away: 1e9, check: Math.random() * 0.1, lightT: 0,
        wakeAt: k.wake + rnd(0, 0.8), sleepAt: k.sleep + rnd(0, 0.9), shown: true,
      };
      b.tYaw = b.yaw;
      const asleep = !this.awake(b, hour);
      const p = s.perches.length ? pick(s.perches) : null;
      if (s.ground && !asleep && Math.random() < 0.8) {
        const g = this.forage(s);
        if (g) { b.x = g[0]; b.z = g[1]; b.y = g[2]; b.state = 'ground'; }
      }
      if (b.state === 'away' && p) this.sit(b, p, asleep);
      if (b.state === 'away') { b.away = asleep ? rnd(60, 200) : rnd(3, 30); b.shown = true; this.show(b, false); }
      this.live.push(b);
      s.birds.push(b);
      this.light(b);
      this.place(b);
    }
  }

  private despawn(s: Spot): void {
    s.on = false;
    for (const b of s.birds) {
      if (this.batch) this.batch.remove(b.id);
      const i = this.live.indexOf(b);
      if (i >= 0) { this.live[i] = this.live[this.live.length - 1]; this.live.pop(); }
    }
    s.birds.length = 0;
  }

  /** A clear bit of ground in a spot to land on or walk to: x, z, floor height. */
  private forage(s: Spot, fx = s.x, fz = s.z, r = s.r): [number, number, number] | null {
    for (let i = 0; i < 6; i++) {
      const a = Math.random() * TAU, d = Math.sqrt(Math.random()) * r;
      const x = fx + Math.cos(a) * d, z = fz + Math.sin(a) * d;
      if (Math.hypot(x - s.x, z - s.z) > s.r + 1.5) continue;
      const y = this.groundAt(x, z);
      if (!Number.isNaN(y)) return [x, z, y];
    }
    return null;
  }

  private sit(b: Bird, p: Perch, asleep: boolean): void {
    b.state = 'perch';
    b.perch = p;
    b.x = p.x; b.y = p.y; b.z = p.z;
    b.yaw = b.tYaw = p.face + (p.wire ? 0 : rnd(-0.5, 0.5));
    b.fold = 1;
    b.act = asleep ? 'sleep' : 'idle';
    b.at = 0; b.ad = rnd(0.5, 2);
    b.dwell = rnd(8, 40);
  }

  private awake(b: Bird, hour: number): boolean {
    return hour >= b.wakeAt && hour < b.sleepAt;
  }

  // ------------------------------------------------------------------ every frame

  /** Hide every bird (inside the hidden restaurant) or show them again. */
  setVisible(on: boolean): void {
    if (this.hidden === !on) return;
    this.hidden = !on;
    for (const b of this.live) this.show(b, on && b.state !== 'away');
  }

  /**
   * `cx, cz` is where the player is and `radius` how far they can see; `threats` are the people the
   * birds watch (the player and friends), `crowd` finds walkers; `food` is someone eating standing still.
   */
  update(dt: number, hour: number, cx: number, cz: number, radius: number, threats: Threat[], crowd: CrowdNear | null, food: [number, number] | null): void {
    // flocks come and go with the player (a few spots a frame)
    const R = Math.min(radius, 60) + 4;
    const n = this.spots.length, per = Math.max(1, Math.ceil(n / 8));
    for (let i = 0; i < per; i++) {
      const s = this.spots[this.scan];
      this.scan = (this.scan + 1) % n;
      const d = Math.hypot(s.x - cx, s.z - cz);
      if (!s.on && d < R && this.live.length < MAX_BIRDS - 8) this.spawn(s, hour);
      else if (s.on && d > R + 14) this.despawn(s);
    }
    for (const b of this.live) {
      switch (b.state) {
        case 'ground': this.onGround(b, dt, hour, threats, crowd, food); break;
        case 'perch': this.onPerch(b, dt, hour, threats); break;
        case 'fly': this.flying(b, dt); break;
        case 'dive': if ((b.at += dt) > 0.35) { const p = b.next ?? pick(b.spot.perches); if (!this.fly(b, vA.set(p.x, p.y, p.z), 'perch', p)) this.sit(b, p, false); } break;
        case 'away': this.gone(b, dt, hour); break;
      }
      if (b.state !== 'away') {
        if ((b.lightT -= dt) < 0) this.light(b);
        this.place(b);
      }
    }
  }

  private threat(b: Bird, threats: Threat[], crowd: CrowdNear | null, r: number): { d: number; speed: number; x: number; z: number } {
    const t = TH;
    t.d = Infinity; t.speed = 0;
    for (const p of threats) {
      const d = Math.hypot(p.x - b.x, p.z - b.z);
      if (d < t.d) { t.d = d; t.speed = p.speed; t.x = p.x; t.z = p.z; }
    }
    if (crowd && (b.check -= 1) <= 0) {
      b.check = 6; // the crowd is looked at every few frames
      const c = crowd(b.x, b.z, Math.min(2, r));
      if (c.d < t.d) { t.d = c.d; t.speed = c.speed; t.x = c.x; t.z = c.z; }
    }
    return t;
  }

  /** How far away a person at this speed makes the bird go. */
  private reach(k: Kind, speed: number): number {
    return k.flush * (speed < 0.15 ? 0.35 : speed < 2 ? 1 : speed < 3.5 ? 1.35 : 1.8);
  }

  private onGround(b: Bird, dt: number, hour: number, threats: Threat[], crowd: CrowdNear | null, food: [number, number] | null): void {
    const k = b.k, s = b.spot;
    b.at += dt;
    // fold the wings back after landing
    b.fold = Math.min(1, b.fold + dt * 4);
    b.flapPh += dt * k.flap * TAU;
    // trouble?
    if (b.flushIn >= 0) {
      if ((b.flushIn -= dt) < 0) this.takeOff(b, b.fromX, b.fromZ);
      if (b.state !== 'ground') return;
    } else {
      const t = this.threat(b, threats, crowd, k.flush * 1.8), reach = this.reach(k, t.speed);
      if (t.d < reach) {
        // a slow walker gets a waddle out of the way first; anything quicker and up they go
        if (k.gait === 'walk' && t.speed < 2.2 && t.d > reach * 0.55 && b.hurry < 1.5 && Math.random() < 0.65) {
          const ax = b.x - t.x, az = b.z - t.z, al = Math.hypot(ax, az) || 1;
          const g = this.forage(s, b.x + (ax / al) * 1.1, b.z + (az / al) * 1.1, 0.4);
          if (g) { b.tx = g[0]; b.tz = g[1]; b.act = 'move'; b.at = 0; b.ad = 3; b.hurry = 2; }
        } else {
          this.takeOff(b, t.x, t.z);
          // and the rest of the flock goes up with it, one after another
          for (const o of s.birds) if (o !== b && o.state === 'ground' && o.flushIn < 0 && Math.hypot(o.x - b.x, o.z - b.z) < 4) {
            o.flushIn = rnd(0.05, 0.45); o.fromX = t.x; o.fromZ = t.z;
          }
          return;
        }
      }
    }
    // roosting time: off up to the perches as the light goes
    if (!this.awake(b, hour) && Math.random() < dt * 0.15) { this.takeOff(b, b.x + rnd(-1, 1), b.z + rnd(-1, 1), true); return; }
    // now and then up to a perch for a while
    if (s.perches.length && Math.random() < dt / 70) { this.takeOff(b, b.x + rnd(-1, 1), b.z + rnd(-1, 1), true); return; }
    // someone eating close by and keeping still: worth a look
    if (food && (b.sp === 'pigeon' || b.sp === 'sparrow' || b.sp === 'dove') && b.act !== 'move' && Math.random() < dt * 0.5) {
      const d = Math.hypot(food[0] - b.x, food[1] - b.z);
      if (d < 9 && d > 1.3) {
        const a = Math.atan2(b.z - food[1], b.x - food[0]) + rnd(-0.7, 0.7), rr = rnd(0.75, 1.2);
        const x = food[0] + Math.cos(a) * rr, z = food[1] + Math.sin(a) * rr;
        if (!Number.isNaN(this.groundAt(x, z))) { b.tx = x; b.tz = z; b.act = 'move'; b.at = 0; b.ad = 12; b.hurry = 1.3; }
      }
    }
    if (b.act === 'move') this.walk(b, dt);
    else if (b.at > b.ad) this.nextAct(b);
    // the pose of the moment
    const k2 = b.at / b.ad;
    let pitch = 0, head = 0, tail = 0;
    if (b.act === 'peck') {
      // quick dips, two or three in a row
      const ph = (b.at * (b.sp === 'pigeon' || b.sp === 'crow' || b.sp === 'dove' ? 3.2 : 4.5)) % 1;
      const dip = ph < 0.45 ? Math.sin((ph / 0.45) * Math.PI) : 0;
      pitch = 0.42 * dip; head = 0.75 * dip;
    } else if (b.act === 'idle') {
      if (Math.random() < dt * 1.6) b.headYawT = rnd(-1.1, 1.1);
      head = -0.1;
    } else if (b.act === 'preen') {
      head = 0.5; b.headYawT = 2.3 * Math.sign(Math.sin(b.ad * 7)) * Math.min(1, Math.sin(k2 * Math.PI) * 3);
    }
    if (b.sp === 'wagtail') tail = 0.38 * Math.sin(b.at * 9) * (b.act === 'move' ? 0.3 : 1);
    this.ease(b, dt, pitch, head, tail);
    b.y = this.navY(b.x, b.z) + b.lift;
  }

  private navY(x: number, z: number): number {
    const c = this.cell(x, z);
    if (c < 0) return 0;
    const h = this.nav.height[c];
    return h === BLOCKED ? 0 : (h - G) * V;
  }

  private nextAct(b: Bird): void {
    const u = Math.random();
    const s = b.spot;
    b.at = 0;
    b.hurry = 1;
    if (u < 0.42) { b.act = 'peck'; b.ad = rnd(0.6, 2.4); }
    else if (u < 0.7) { b.act = 'idle'; b.ad = rnd(0.5, 2.5); }
    else if (u < 0.76) { b.act = 'preen'; b.ad = rnd(1, 2.2); }
    else {
      const g = this.forage(s, b.x, b.z, b.k.gait === 'run' ? 2.5 : 1.2);
      if (!g) { b.act = 'idle'; b.ad = 1; return; }
      b.act = 'move'; b.tx = g[0]; b.tz = g[1]; b.ad = 8;
    }
  }

  /** Walk, hop or dash towards the target. */
  private walk(b: Bird, dt: number): void {
    const k = b.k, dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
    b.tYaw = Math.atan2(dx, dz);
    const facing = Math.abs(angDiff(b.yaw, b.tYaw)) < 0.5;
    b.lift = 0;
    if (d < 0.04 || b.at > b.ad) { b.act = 'idle'; b.at = 0; b.ad = rnd(0.3, 1.5); b.hurry = 1; return; }
    let step = 0;
    if (k.gait === 'hop') {
      // hops of a fixed length with little pauses between
      b.hopT += dt * b.hurry;
      const T = 0.15, gap = 0.12;
      if (b.hopT > T + gap) b.hopT = 0;
      if (b.hopT < T && facing) {
        step = Math.min(d, (k.pace / T) * dt * b.hurry);
        b.lift = Math.sin((b.hopT / T) * Math.PI) * 0.035;
      }
    } else if (facing) {
      step = Math.min(d, k.pace * b.hurry * dt);
      if (k.gait === 'walk') b.roll = Math.sin(b.at * 9 * b.hurry) * 0.07;
    }
    if (step <= 0) return;
    const nx = b.x + (dx / d) * step, nz = b.z + (dz / d) * step;
    if (Number.isNaN(this.groundAt(nx, nz))) { b.act = 'idle'; b.at = 0; b.ad = 0.5; return; }
    b.x = nx; b.z = nz;
    // the pigeon nod: the head shoots forward and holds still as the body catches up
    if (k.gait === 'walk') b.headPitch = -0.12 + 0.2 * Math.max(0, Math.sin(b.at * 9 * b.hurry));
  }

  /** Off the ground: to a perch, round in a loop and back down (pigeons), or away. */
  private takeOff(b: Bird, fromX: number, fromZ: number, calm = false): void {
    const s = b.spot;
    const ax = b.x - fromX, az = b.z - fromZ;
    b.flushIn = -1;
    b.hurry = 1;
    b.act = 'idle';
    if (s.perches.length && (calm || Math.random() < 0.7)) {
      // a perch on the far side from the trouble, if there is one
      let best: Perch | null = null, bs = -Infinity;
      for (let i = 0; i < 4; i++) {
        const p = pick(s.perches), sc = (p.x - b.x) * ax + (p.z - b.z) * az + Math.random() * 6;
        if (sc > bs) { bs = sc; best = p; }
      }
      if (best && this.fly(b, vA.set(best.x, best.y, best.z), 'perch', best)) return;
    }
    if (!calm && (b.sp === 'pigeon' || b.sp === 'dove') && Math.random() < 0.6) {
      const al = Math.hypot(ax, az) || 1;
      const g = this.forage(s, s.x + (ax / al) * s.r, s.z + (az / al) * s.r, s.r);
      if (g && this.fly(b, vA.set(g[0], g[2], g[1]), 'ground', null, rnd(-6, 6))) return;
    }
    this.leave(b, fromX, fromZ);
  }

  private onPerch(b: Bird, dt: number, hour: number, threats: Threat[]): void {
    const k = b.k, s = b.spot, p = b.perch!;
    b.at += dt;
    b.fold = Math.min(1, b.fold + dt * 4);
    b.lift = 0;
    const up = this.awake(b, hour);
    // only someone right underneath a low perch (or anyone near a kingfisher) bothers a perched bird
    const low = p.y < 2.4 || b.sp === 'kingfisher';
    if (low && up) for (const t of threats) {
      const d = Math.hypot(t.x - b.x, t.z - b.z);
      if (d < (b.sp === 'kingfisher' ? this.reach(k, t.speed) : 1.1)) {
        const other = s.perches.filter((q) => Math.hypot(q.x - t.x, q.z - t.z) > 8);
        const q = other.length ? pick(other) : null;
        if (!q || !this.fly(b, vA.set(q.x, q.y, q.z), 'perch', q)) this.leave(b, t.x, t.z);
        return;
      }
    }
    if (!up) {
      b.act = 'sleep';
      this.ease(b, dt, 0, 0.45, 0);
      return;
    }
    if (b.act === 'sleep') { b.act = 'idle'; b.at = 0; b.ad = rnd(0.5, 2); b.dwell = rnd(1, 30); }
    if ((b.dwell -= dt) < 0) {
      b.dwell = rnd(8, 40);
      if (s.ground) {
        const g = this.forage(s);
        if (g && threats.every((t) => Math.hypot(t.x - g[0], t.z - g[1]) > 4) && this.fly(b, vA.set(g[0], g[2], g[1]), 'ground')) return;
      } else if (s.water && Math.random() < 0.6) {
        // a kingfisher's plunge, out over the water and straight back
        const d = rnd(1, 2.4), x = b.x + s.water[0] * d, z = b.z + s.water[1] * d;
        b.next = Math.random() < 0.7 ? p : pick(s.perches);
        const nx = b.next;
        if (this.fly(b, vA.set(x, WATER_Y - 0.12, z), 'dive', nx)) return;
      } else if (s.perches.length > 1 && Math.random() < 0.5) {
        const q = pick(s.perches);
        if (q !== p && this.fly(b, vA.set(q.x, q.y, q.z), 'perch', q)) return;
      }
    }
    if (b.at > b.ad) {
      const u = Math.random();
      b.at = 0;
      if (u < 0.6) { b.act = 'idle'; b.ad = rnd(0.8, 3); }
      else if (u < 0.82) { b.act = 'preen'; b.ad = rnd(1, 2.5); }
      else if (u < 0.92) { b.act = 'shake'; b.ad = 0.5; }
      else { b.act = b.sp === 'crow' || b.sp === 'bulbul' || b.sp === 'gull' ? 'call' : 'idle'; b.ad = 1.2; }
    }
    let pitch = 0, head = 0, tail = 0;
    const k2 = b.at / b.ad;
    if (b.act === 'idle') { if (Math.random() < dt * 1.2) b.headYawT = rnd(-1.2, 1.2); }
    else if (b.act === 'preen') { head = 0.55; b.headYawT = 2.3 * Math.min(1, Math.sin(k2 * Math.PI) * 3) * (b.ad > 1.7 ? 1 : -1); }
    else if (b.act === 'shake') b.fold = 1 - 0.35 * Math.sin(k2 * Math.PI);
    else if (b.act === 'call') { head = -0.45 * Math.abs(Math.sin(k2 * Math.PI * 3)); pitch = 0.18 * Math.abs(Math.sin(k2 * Math.PI * 3)); }
    if (b.sp === 'wagtail' || b.sp === 'kingfisher') tail = 0.3 * Math.sin(b.at * (b.sp === 'wagtail' ? 9 : 2.5));
    this.ease(b, dt, pitch, head, tail);
  }

  private flying(b: Bird, dt: number): void {
    const k = b.k;
    b.ft += dt;
    const t = Math.min(1, b.ft / b.fT);
    // a little slower off the ground and into the landing
    const u = 0.55 * t + 0.45 * t * t * (3 - 2 * t);
    bez(b.f0, b.fc, b.f1, u, vA);
    const px = b.x, py = b.y, pz = b.z;
    b.x = vA.x; b.y = vA.y; b.z = vA.z;
    const vx = b.x - px, vy = b.y - py, vz = b.z - pz, vh = Math.hypot(vx, vz);
    if (vh > 1e-4) b.yaw = b.tYaw = Math.atan2(vx, vz);
    const climb = Math.atan2(vy, Math.max(vh, 1e-4));
    // wings: beat, sail or bound between beats, flare into the landing
    const landing = b.then !== 'away' && t > 0.82, takeoff = b.ft < 0.25;
    b.fold = Math.max(0, b.fold - dt * 12);
    let rate = k.flap, amp = 0.95;
    const cruise = !takeoff && !landing && b.then !== 'dive';
    const gl = cruise ? Math.sin(b.ft * 2.1 + b.size * 40) : -1;
    if (k.glide === 'soar' && gl > 0.2) { amp = 0; b.flapPh = 0.35; }
    if (k.glide === 'bound' && gl > 0.45) { amp = 0; b.fold = Math.min(1, b.fold + dt * 30); }
    if (takeoff) rate *= 1.25;
    if (landing) { rate *= 0.8; amp = 1.1; }
    b.flapPh += dt * rate * TAU;
    const flap = amp > 0 ? Math.sin(b.flapPh) * amp + 0.2 : 0.25;
    writeWings(b, flap);
    const pitch = landing ? -0.6 : THREE.MathUtils.clamp(-climb * 0.6, -0.5, 0.5);
    b.pitch += (pitch - b.pitch) * Math.min(1, dt * 8);
    b.roll += (0 - b.roll) * Math.min(1, dt * 6);
    b.headPitch += (-0.15 - b.headPitch) * Math.min(1, dt * 10);
    b.headYaw += (0 - b.headYaw) * Math.min(1, dt * 10);
    b.tail = b.then === 'dive' ? -0.2 : 0;
    if (t < 1) return;
    // arrived
    b.flapPh = 0;
    if (b.then === 'perch' && b.next) this.sit(b, b.next, false);
    else if (b.then === 'ground') {
      b.state = 'ground'; b.act = 'idle'; b.at = 0; b.ad = rnd(0.4, 1.4);
      b.y = this.navY(b.x, b.z);
    } else if (b.then === 'dive') { b.state = 'dive'; b.at = 0; }
    else { b.state = 'away'; b.away = rnd(20, 60); this.show(b, false); }
  }

  private gone(b: Bird, dt: number, hour: number): void {
    if ((b.away -= dt) > 0) return;
    const s = b.spot, up = this.awake(b, hour);
    b.away = rnd(10, 30);
    if (!up && !s.perches.length) return;
    // back in from the sky
    const a = Math.random() * TAU;
    b.x = s.x + Math.sin(a) * 28; b.z = s.z + Math.cos(a) * 28; b.y = 16;
    let ok = false;
    if (up && s.ground) {
      const g = this.forage(s);
      ok = !!g && this.fly(b, vA.set(g[0], g[2], g[1]), 'ground');
    }
    if (!ok && s.perches.length) {
      const p = pick(s.perches);
      ok = this.fly(b, vA.set(p.x, p.y, p.z), 'perch', p);
    }
    if (!ok) { b.state = 'away'; return; }
    b.fold = 0;
    this.show(b, !this.hidden);
  }

  /** Smoothly towards a pose: body pitch, head pitch, tail; the head turns in quick jerks like a bird's. */
  private ease(b: Bird, dt: number, pitch: number, head: number, tail: number): void {
    const f = Math.min(1, dt * 14);
    b.pitch += (pitch - b.pitch) * f;
    b.headPitch += (head - b.headPitch) * f;
    b.tail += (tail - b.tail) * f;
    b.roll += (0 - b.roll) * Math.min(1, dt * 5);
    b.headYaw += (b.headYawT - b.headYaw) * Math.min(1, dt * 22);
    if (b.act !== 'move') b.yaw += angDiff(b.yaw, b.tYaw) * Math.min(1, dt * 3);
    else b.yaw += angDiff(b.yaw, b.tYaw) * Math.min(1, dt * 10);
    writeWings(b, 0);
  }

  private light(b: Bird): void {
    b.lightT = rnd(0.3, 0.6);
    sampleLightmap(this.w.lightmap, b.x, b.z, tmpL);
    // the light map is for people on the street; up on a roof or a wire it is open sky
    const up = THREE.MathUtils.clamp((b.y - this.navY(b.x, b.z) - 1.2) / 3, 0, 1);
    const o = b.tex;
    o[POSE.light * 4] = tmpL[0] + (1 - tmpL[0]) * up;
    o[POSE.light * 4 + 1] = Math.max(0.35, tmpL[1] + (1 - tmpL[1]) * up);
    o[POSE.light * 4 + 2] = 0;
    for (let c = 0; c < 3; c++) o[POSE.lamp * 4 + c] = tmpL[2 + c] * (1 - up * 0.6);
  }

  private show(b: Bird, on: boolean): void {
    if (b.shown === on) return;
    b.shown = on;
    if (this.batch) this.batch.show(b.id, on);
  }

  /** Placement (turned, tipped forward about the feet, sized) and the pose of the head and tail. */
  private place(b: Bird): void {
    const o = b.tex, P = BIRD_PART;
    o[(POSE.rot + P.body) * 4 + 2] = b.roll;
    o[(POSE.rot + P.head) * 4] = b.headPitch;
    o[(POSE.rot + P.head) * 4 + 1] = b.headYaw;
    o[(POSE.rot + P.tail) * 4] = b.tail;
    if (!this.batch) return;
    const cy = Math.cos(b.yaw), sy = Math.sin(b.yaw), cp = Math.cos(b.pitch), sp = Math.sin(b.pitch), s = b.size;
    mtx.set(
      cy * s, sy * sp * s, sy * cp * s, b.x,
      0, cp * s, -sp * s, b.y,
      -sy * s, cy * sp * s, cy * cp * s, b.z,
      0, 0, 0, 1,
    );
    this.batch.place(b.id, mtx);
  }
}

const TH = { d: Infinity, speed: 0, x: 0, z: 0 };

/** Wing pose: folded back along the body by `b.fold`, beating by `flap` (radians, up is positive). */
function writeWings(b: Bird, flap: number): void {
  const o = b.tex, f = b.fold, P = BIRD_PART;
  const L = (POSE.rot + P.wingL) * 4, R = (POSE.rot + P.wingR) * 4;
  // folding turns each wing back along the body and tips its trailing edge up a touch, so the two meet
  // over the rump at an angle instead of lying in one plane
  o[L] = 0.26 * f; o[L + 1] = -f * Math.PI * 0.49; o[L + 2] = -flap * (1 - f);
  o[R] = 0.31 * f; o[R + 1] = f * Math.PI * 0.49; o[R + 2] = flap * (1 - f);
}

/** Point t along the quadratic curve a, c, b. */
function bez(a: THREE.Vector3, c: THREE.Vector3, b: THREE.Vector3, t: number, out: THREE.Vector3): THREE.Vector3 {
  const u = 1 - t;
  return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}
