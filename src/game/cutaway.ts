import * as THREE from 'three';
import { ISTANBUL } from '../world/cityId';
import type { Occluder } from '../world/tokyo';
import { SHELL, SPILL, solidBase, type Field, type GridRect, type Owned, type Owners } from '../world/owners';

/**
 * Whole-object cutaway. Every building, landmark and tree registers a footprint (Occluder); any other solid
 * mass taller than a person (back blocks, boundary walls) is picked up in the bake. Each frame a handful of
 * rays run from the player towards the camera through the actual voxels; an object is lowered only when one
 * of its own voxels sits on one of those rays, i.e. when it really hides the player. It then goes down as a
 * whole, by sliding its cut plane from its real top to just above the floor. Hysteresis keeps it lowered for
 * a moment after it stops occluding, so walking past corners or rotating the view never makes it pop.
 *
 * Every column of the map belongs to exactly one object (or none, see world/owners.ts), so a wall can only
 * ever be cut together with the rest of its own building: nothing is culled or faded on its own.
 *
 * The shader reads two textures:
 *  - an owner map (RGBA8, one texel per 0.25 m column): the occluder id (R low byte, low 4 bits of G), the
 *    building that owns the column above a split height instead (B low byte, high 4 bits of G), and in A the
 *    shell flag (128: outer walls plus anything hanging off the facade, 0: inside the footprint) plus that
 *    split height in voxels;
 *  - a cut table (64 x 64, RGBA float) per id: shell height on the camera side, shell height on the far
 *    side, height inside the footprint, and the "along the view" coordinate where the far side starts.
 *
 * Only occluders near the player are kept up to date each frame (a coarse bucket grid finds them).
 *
 * Seen from outside, an occluder is cut down evenly. When the player is inside a building it becomes a
 * dollhouse: the near walls drop to waist height while the back wall, the furniture and everything under
 * the ceiling stay, and only the ceiling and the floors above are taken away.
 */

const V = 0.25;
/**
 * Just under the ground-floor ceiling slab: 3.0 m in Tokyo and Amalfi; Istanbul's rooms are 2.75 m high (their
 * floors stack every 3 m with the slab in the top quarter metre), so its cut runs just under 2.75 m, never through
 * the slab (which would draw a section cap across the whole room).
 */
const ROOM_TOP = ISTANBUL ? 2.7 : 2.95;
const HOLD = 0.45; // seconds an occluder stays lowered after it stops blocking
/** Metres either side of the player (across the screen) that are kept in view too, so a clear band opens around you. */
const SIDES = [1.0, 2.0];
const OFF = 1e4;
const BUCKET = 8; // metres per cell of the lookup grid
const REACH = 64; // metres around the player that can hold something between it and the camera

/** e: lowered, c: holding the player (dollhouse), f: floor height of the room the player is in (metres). */
interface State { e: number; hold: number; c: number; f: number }
interface Scene { g: GridRect; f: Field; own: Uint16Array; from: number; to: number; top: number }

export class Cutaway {
  readonly cut: THREE.DataTexture;
  readonly ownerWorld: THREE.DataTexture;
  readonly ownerInside: THREE.DataTexture;
  /** True for occluders currently lowered at all (drives which chunks need the cutaway material). */
  readonly active: boolean[];
  readonly occ: Occluder[];
  private data = new Float32Array(64 * 64 * 4);
  private buckets = new Map<number, number[]>();
  /** Occluders kept up to date this frame: those near the player plus any still lowered. */
  private live: number[] = [];
  private liveT = 0;
  private liveAt = new THREE.Vector2(1e9, 1e9);
  private st: State[];
  private world: Scene;
  private inside: Scene;
  private blocking: Uint8Array;
  private hits: number[] = [];
  private groups = new Set<number>();
  private samples = Array.from({ length: 4 + SIDES.length * 4 }, () => new THREE.Vector3());

  constructor(o: Owners, wr: GridRect, ir: GridRect, wf: Field, inf: Field) {
    this.occ = o.occ;
    this.world = { g: wr, f: wf, own: o.world.id, from: 0, to: o.worldN, top: maxTop(wf) };
    this.inside = { g: ir, f: inf, own: o.inside.id, from: o.worldN, to: o.occ.length, top: maxTop(inf) };
    this.st = this.occ.map(() => ({ e: 0, hold: 0, c: 0, f: 0 }));
    this.active = this.occ.map(() => false);
    this.blocking = new Uint8Array(this.occ.length);
    this.data.fill(OFF);
    this.cut = new THREE.DataTexture(this.data, 64, 64, THREE.RGBAFormat, THREE.FloatType);
    this.cut.magFilter = this.cut.minFilter = THREE.NearestFilter;
    this.cut.generateMipmaps = false;
    this.cut.needsUpdate = true;
    this.ownerWorld = ownerTex(o.world, wr);
    this.ownerInside = ownerTex(o.inside, ir);
    this.occ.forEach((_, i) => {
      const [x0, z0, x1, z1] = this.bounds(i);
      for (let bz = Math.floor(z0 / BUCKET); bz <= Math.floor(z1 / BUCKET); bz++)
        for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++) {
          const k = bz * 4096 + bx;
          let l = this.buckets.get(k);
          if (!l) this.buckets.set(k, (l = []));
          l.push(i);
        }
    });
  }

  /** Occluders whose (spilled) footprint overlaps a rect in metres. */
  touching(x0: number, z0: number, x1: number, z1: number): number[] {
    const out = new Set<number>();
    for (let bz = Math.floor(z0 / BUCKET); bz <= Math.floor(z1 / BUCKET); bz++)
      for (let bx = Math.floor(x0 / BUCKET); bx <= Math.floor(x1 / BUCKET); bx++)
        for (const i of this.buckets.get(bz * 4096 + bx) ?? []) {
          const [a0, b0, a1, b1] = this.bounds(i);
          if (a0 < x1 && a1 > x0 && b0 < z1 && b1 > z0) out.add(i);
        }
    return [...out];
  }

  /** Footprint grown by the spill margin, for picking the chunks an occluder can touch. */
  bounds(i: number): [number, number, number, number] {
    const m = SPILL * V + 0.25, r = this.occ[i].rect;
    return [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  }

  /**
   * Marks every occluder owning a solid voxel on the ray from o towards the camera (d, normalised). For the side
   * band (core) only voxels inside its footprint count: what hangs off a facade beside you (awnings, lanterns,
   * signs) only lowers its building when it covers you yourself, so a shop you stand in front of stays up.
   */
  private march(sc: Scene, o: THREE.Vector3, dx: number, dy: number, dz: number, core: boolean): void {
    const { g, f, own } = sc;
    const step = 0.1;
    const tMax = dy > 0.05 ? (sc.top - o.y) / dy : 40;
    for (let t = 0.15; t < tMax; t += step) {
      const y = o.y + dy * t;
      if (y < 0) continue;
      const k = Math.floor((o.x + dx * t - g.ox) / V), j = Math.floor((o.z + dz * t - g.oz) / V);
      if (k < 0 || j < 0 || k >= g.sx || j >= g.sz) return;
      const c = j * g.sx + k, id = own[c];
      if (!id || this.blocking[id - 1]) continue;
      if (solidAt(f, c, y) && (!core || this.core(sc, k, j, id))) {
        this.blocking[id - 1] = 1;
        this.hits.push(id - 1);
      }
    }
  }

  /** Whether column (k, j) lies inside the footprint of occluder id (1-based), not just in what it spills over. */
  private core(sc: Scene, k: number, j: number, id: number): boolean {
    const r = this.occ[id - 1].rect, x = sc.g.ox + (k + 0.5) * V, z = sc.g.oz + (j + 0.5) * V;
    return x > r[0] && x < r[2] && z > r[1] && z < r[3];
  }

  /**
   * How far (up to m) one can go from o along (dx, dz) at o's height while staying in the open: side samples stop
   * at the first solid voxel or footprint (an open stall front, a doorway), so the band never reaches into a
   * building beside or behind the player. That building hides nothing, and a ray starting inside it would lower it.
   */
  private reach(sc: Scene, o: THREE.Vector3, dx: number, dz: number, m: number): number {
    const { g, f, own } = sc;
    for (let t = V / 2; t <= m; t += V / 2) {
      const k = Math.floor((o.x + dx * t - g.ox) / V), j = Math.floor((o.z + dz * t - g.oz) / V);
      if (k < 0 || j < 0 || k >= g.sx || j >= g.sz) return Math.max(0, t - V);
      const c = j * g.sx + k;
      if (solidAt(f, c, o.y) || (own[c] && this.core(sc, k, j, own[c]))) return Math.max(0, t - V);
    }
    return m;
  }

  /**
   * `floor` is the height of the floor the player stands on inside a building (a hotel room upstairs): the
   * dollhouse then opens that floor instead of the ground floor.
   */
  update(dt: number, p: THREE.Vector3, fwd: THREE.Vector3, inside: boolean, on: boolean, floor = 0): void {
    const fl = Math.hypot(fwd.x, fwd.z) || 1;
    const ax = fwd.x / fl, az = fwd.z / fl;
    const sc = inside ? this.inside : this.world;
    const block = this.blocking, groups = this.groups, hits = this.hits;
    for (const i of hits) block[i] = 0;
    hits.length = 0;
    groups.clear();
    // refresh the nearby set now and then (and right away after a teleport)
    this.liveT -= dt;
    if (this.liveT <= 0 || Math.hypot(this.liveAt.x - p.x, this.liveAt.y - p.z) > 8) {
      this.liveT = 0.5;
      this.liveAt.set(p.x, p.z);
      const near = new Set(this.touching(p.x - REACH, p.z - REACH, p.x + REACH, p.z + REACH));
      for (const i of this.live) if (this.active[i] || this.st[i].hold > 0) near.add(i);
      for (let i = this.inside.from; i < this.occ.length; i++) near.add(i);
      this.live = [...near];
    }
    const live = this.live;
    if (on) {
      // sample points on the player (feet, chest, head, hair) and in a band either side of it, across the screen
      const s = this.samples;
      s[0].set(p.x, p.y + 0.15, p.z);
      s[1].set(p.x, p.y + 1.0, p.z);
      s[2].set(p.x, p.y + 1.6, p.z);
      s[3].set(p.x, p.y + 1.95, p.z);
      let k = 4;
      for (const m of SIDES)
        for (const y of [0.6, 1.7])
          for (const sd of [-1, 1]) {
            const o = s[k++].set(p.x, p.y + y, p.z);
            const r = this.reach(sc, o, sd * az, -sd * ax, m);
            o.x += sd * az * r;
            o.z -= sd * ax * r;
          }
      const dl = Math.hypot(fwd.x, fwd.y, fwd.z) || 1;
      for (let i = 0; i < s.length; i++) this.march(sc, s[i], -fwd.x / dl, -fwd.y / dl, -fwd.z / dl, i >= 4);
      for (const i of live) {
        const o = this.occ[i], [x0, z0, x1, z1] = o.rect;
        if (i < sc.from || i >= sc.to || !enterable(o) || block[i]) continue;
        if (p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1) { block[i] = 1; hits.push(i); }
      }
      for (const i of hits) {
        if (this.occ[i].group !== undefined) groups.add(this.occ[i].group!);
        // hit by a ray but outside the nearby set (very tall and far): keep it updated from now on
        if (!live.includes(i)) live.push(i);
      }
    }
    let dirty = false;
    for (let li = 0; li < live.length; li++) {
      const i = live[li];
      const o = this.occ[i], st = this.st[i];
      const mine = i >= sc.from && i < sc.to;
      const [x0, z0, x1, z1] = o.rect;
      const contain = on && mine && enterable(o) && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
      const blocking = block[i] === 1 || (o.group !== undefined && groups.has(o.group));
      if (!mine || !on) {
        // first-person view, title screen or the other scene: everything stands at full height at once
        st.e = 0; st.c = 0; st.hold = 0;
      } else {
        st.hold = blocking ? HOLD : Math.max(0, st.hold - dt);
        // (a fully lowered one must stay put: easing it 'towards' 1 from 1 used to nudge it up every other frame)
        st.e = blocking || st.hold > 0 ? Math.min(1, st.e + dt * 3.8) : Math.max(0, st.e - dt * 2.2);
        st.c = contain ? Math.min(1, st.c + dt * 3) : Math.max(0, st.c - dt * 3);
        if (contain) st.f = floor;
      }
      const j = (i + 1) * 4;
      let f = OFF, b = OFF, n = OFF, back = 0;
      if (st.e > 0 || st.c > 0) {
        const e = st.e * st.e * (3 - 2 * st.e), c = st.c * st.c * (3 - 2 * st.c);
        // upstairs the near walls drop to waist height on that floor, and everything under its ceiling stays
        // (the room's floor counts from the building's own floor: on a hillside that is not the street's zero)
        const rel = st.f > 0 ? st.f - (o.floor ?? 0) : 0;
        const up = rel * c;
        const low = o.top + (Math.min(o.top, o.low + up) - o.top) * e;
        // (a great hall, a cathedral's nave or a mosque's prayer hall, opens higher: its own `room` height)
        const roomH = o.top + (Math.min(o.top, Math.max(o.low, (o.room ?? ROOM_TOP) + (o.floor ?? 0)) + (rel > 0 ? rel - 0.5 : 0) * c) - o.top) * e;
        f = low;
        b = low + (roomH - low) * c;
        n = b;
        back = Math.max(x0 * ax + z0 * az, x1 * ax + z0 * az, x0 * ax + z1 * az, x1 * ax + z1 * az) - (SHELL + 1) * V;
      }
      this.active[i] = f < OFF;
      const d = this.data;
      if (d[j] !== f || d[j + 1] !== b || d[j + 2] !== n || d[j + 3] !== back) {
        d[j] = f; d[j + 1] = b; d[j + 2] = n; d[j + 3] = back;
        dirty = true;
      }
    }
    if (dirty) this.cut.needsUpdate = true;
  }
}

/** Whether column c of a scene is solid at height y (metres above the street). */
function solidAt(f: Field, c: number, y: number): boolean {
  const L = Math.floor(y / V), l = L - solidBase(f.ground, c);
  if (l < 0) return true;
  return l < 64 ? ((f.solid[c * 2 + (l >> 5)] >>> (l & 31)) & 1) === 1 : L < f.height[c];
}

/** Buildings, and the great halls one walks into (whose cut opens like a building's dollhouse). */
function enterable(o: Occluder): boolean {
  return o.kind === 'building' || o.room !== undefined;
}

/** Highest solid point of a scene (metres above the street): rays stop there. */
function maxTop(f: Field): number {
  let h = 16;
  for (let c = 0; c < f.height.length; c++) if (f.height[c] * V > h) h = f.height[c] * V;
  return h + 0.5;
}

function ownerTex(o: Owned, g: GridRect): THREE.DataTexture {
  const n = g.sx * g.sz;
  const px = new Uint8Array(n * 4);
  for (let c = 0; c < n; c++) {
    const id = o.id[c], up = o.upper[c];
    px[c * 4] = id & 255;
    px[c * 4 + 1] = (id >> 8) | ((up >> 8) << 4);
    px[c * 4 + 2] = up & 255;
    px[c * 4 + 3] = (o.shell[c] ? 128 : 0) | o.split[c];
  }
  const t = new THREE.DataTexture(px, g.sx, g.sz, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.magFilter = t.minFilter = THREE.NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}
