import * as THREE from 'three';
import type { Occluder } from '../world/tokyo';

/**
 * Whole-object cutaway. Every building, landmark and tree registers a footprint (Occluder). Each frame a
 * handful of rays run from the player towards the camera; whatever they pass through is lowered, as a
 * whole, by sliding its cut plane down from the roof to just above the floor. Hysteresis keeps it lowered
 * for a moment after it stops occluding, so walking past corners or rotating the view never makes it pop.
 *
 * The shader reads two textures:
 *  - an owner map (RG8, one texel per 0.25 m column): the occluder id in R (low byte) and G (high bits,
 *    shifted up one), and in G's lowest bit whether the column is the building's shell (outer walls plus
 *   anything hanging off the facade) rather than the inside of the footprint;
 *  - a cut table (64 x 64, RGBA float) per id: shell height on the camera side, shell height on the far
 *    side, height inside the footprint, and the "along the view" coordinate where the far side starts.
 *
 * Only occluders near the player are tested each frame (a coarse bucket grid finds them).
 *
 * Seen from outside, an occluder is cut down evenly. When the player is inside a building it becomes a
 * dollhouse: the near walls drop to waist height while the back wall, the furniture and everything under
 * the ceiling stay, and only the ceiling and the floors above are taken away.
 */

const V = 0.25;
const SHELL = 2; // voxels of outer wall
const SPILL = 4; // voxels outside a footprint that still belong to it (awnings, signs, balconies)
const ROOM_TOP = 2.95; // just under the ground-floor ceiling slab (3.0 m)
const HOLD = 0.45; // seconds an occluder stays lowered after it stops blocking
const OFF = 1e4;
const MAX = 4095; // ids that fit the 64 x 64 cut table (0 = nobody)
const BUCKET = 8; // metres per cell of the lookup grid
const REACH = 64; // metres around the player that can hold something between it and the camera

export interface GridRect { ox: number; oz: number; sx: number; sz: number }

interface State { e: number; hold: number; c: number }

export class Cutaway {
  readonly cut: THREE.DataTexture;
  readonly ownerWorld: THREE.DataTexture;
  readonly ownerInside: THREE.DataTexture;
  /** True for occluders currently lowered at all (drives which chunks need the cutaway material). */
  readonly active: boolean[];
  readonly occ: Occluder[];
  private data = new Float32Array(64 * 64 * 4);
  private buckets = new Map<number, number[]>();
  /** Occluders tested this frame: those near the player plus any still lowered. */
  private live: number[] = [];
  private liveT = 0;
  private liveAt = new THREE.Vector2(1e9, 1e9);
  private st: State[];
  private worldN: number;
  private blocking: boolean[] = [];
  private groups = new Set<number>();
  private samples = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];

  constructor(world: Occluder[], inside: Occluder[], wr: GridRect, ir: GridRect) {
    const room = MAX - inside.length;
    if (world.length > room) console.warn(`cutaway: ${world.length - room} occluders dropped`);
    this.occ = [...world.slice(0, room), ...inside];
    this.worldN = Math.min(world.length, room);
    this.st = this.occ.map(() => ({ e: 0, hold: 0, c: 0 }));
    this.active = this.occ.map(() => false);
    this.data.fill(OFF);
    this.cut = new THREE.DataTexture(this.data, 64, 64, THREE.RGBAFormat, THREE.FloatType);
    this.cut.magFilter = this.cut.minFilter = THREE.NearestFilter;
    this.cut.generateMipmaps = false;
    this.cut.needsUpdate = true;
    this.ownerWorld = this.ownerMap(wr, 0, this.worldN);
    this.ownerInside = this.ownerMap(ir, this.worldN, this.occ.length);
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

  /** Occluder ids are their index + 1 (0 = nobody). */
  private ownerMap(g: GridRect, from: number, to: number): THREE.DataTexture {
    const n = g.sx * g.sz;
    const id = new Uint16Array(n), shell = new Uint8Array(n), solid = new Uint8Array(n);
    const raster = (i: number) => {
      const o = this.occ[i];
      const [x0, z0, x1, z1] = o.rect;
      const i0 = Math.max(0, Math.ceil((x0 - g.ox) / V - 0.5)), i1 = Math.min(g.sx - 1, Math.floor((x1 - g.ox) / V - 0.5));
      const j0 = Math.max(0, Math.ceil((z0 - g.oz) / V - 0.5)), j1 = Math.min(g.sz - 1, Math.floor((z1 - g.oz) / V - 0.5));
      for (let j = j0; j <= j1; j++)
        for (let k = i0; k <= i1; k++) {
          const c = j * g.sx + k;
          const edge = Math.min(k - i0, i1 - k, j - j0, j1 - j);
          id[c] = i + 1;
          shell[c] = o.kind !== 'building' || edge < SHELL ? 255 : 0;
          solid[c] = o.kind === 'tree' ? 0 : 1;
        }
    };
    // trees first so buildings and landmarks win where canopies overhang them; landmarks before buildings
    for (const kind of ['tree', 'landmark', 'building'] as const)
      for (let i = from; i < to; i++) if (this.occ[i].kind === kind) raster(i);
    // spill a little past each footprint so facade props, awnings and balconies go down with it
    let front: number[] = [];
    for (let c = 0; c < n; c++) if (solid[c]) front.push(c);
    for (let step = 0; step < SPILL && front.length; step++) {
      const next: number[] = [];
      for (const c of front) {
        const k = c % g.sx, j = (c - k) / g.sx;
        for (const [dk, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const kk = k + dk, jj = j + dj;
          if (kk < 0 || jj < 0 || kk >= g.sx || jj >= g.sz) continue;
          const cc = jj * g.sx + kk;
          if (id[cc]) continue;
          id[cc] = id[c];
          shell[cc] = 255;
          next.push(cc);
        }
      }
      front = next;
    }
    const rg = new Uint8Array(n * 2);
    for (let c = 0; c < n; c++) { rg[c * 2] = id[c] & 255; rg[c * 2 + 1] = ((id[c] >> 8) << 1) | (shell[c] ? 1 : 0); }
    const t = new THREE.DataTexture(rg, g.sx, g.sz, THREE.RGFormat, THREE.UnsignedByteType);
    t.magFilter = t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    return t;
  }

  /** Footprint grown by the spill margin, for picking the chunks an occluder can touch. */
  bounds(i: number): [number, number, number, number] {
    const m = SPILL * V + 0.25, r = this.occ[i].rect;
    return [r[0] - m, r[1] - m, r[2] + m, r[3] + m];
  }

  update(dt: number, p: THREE.Vector3, fwd: THREE.Vector3, inside: boolean, on: boolean): void {
    const fl = Math.hypot(fwd.x, fwd.z) || 1;
    const ax = fwd.x / fl, az = fwd.z / fl;
    // sample points on the player: feet, chest, head and both shoulders (across the screen)
    const s = this.samples;
    s[0].set(p.x, p.y + 0.15, p.z);
    s[1].set(p.x, p.y + 1.0, p.z);
    s[2].set(p.x, p.y + 1.75, p.z);
    s[3].set(p.x - az * 0.8, p.y + 0.9, p.z + ax * 0.8);
    s[4].set(p.x + az * 0.8, p.y + 0.9, p.z - ax * 0.8);
    const dx = -fwd.x, dy = -fwd.y, dz = -fwd.z; // towards the camera
    const block = this.blocking, groups = this.groups;
    groups.clear();
    // refresh the nearby set now and then (and right away after a teleport)
    this.liveT -= dt;
    if (this.liveT <= 0 || Math.hypot(this.liveAt.x - p.x, this.liveAt.y - p.z) > 8) {
      this.liveT = 0.5;
      this.liveAt.set(p.x, p.z);
      const near = new Set(this.touching(p.x - REACH, p.z - REACH, p.x + REACH, p.z + REACH));
      for (const i of this.live) if (this.active[i] || this.st[i].hold > 0) near.add(i);
      for (let i = this.worldN; i < this.occ.length; i++) near.add(i);
      this.live = [...near];
    }
    const live = this.live;
    for (let li = 0; li < live.length; li++) {
      const i = live[li];
      const o = this.occ[i];
      const mine = inside ? i >= this.worldN : i < this.worldN;
      const [x0, z0, x1, z1] = o.rect;
      let b = false;
      if (on && mine) {
        b = o.kind === 'building' && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
        const m = 0.25;
        for (let k = 0; k < s.length && !b; k++) b = rayBox(s[k], dx, dy, dz, x0 - m, -1, z0 - m, x1 + m, o.top, z1 + m);
      }
      block[i] = b;
      if (b && o.group !== undefined) groups.add(o.group);
    }
    let dirty = false;
    for (let li = 0; li < live.length; li++) {
      const i = live[li];
      const o = this.occ[i], st = this.st[i];
      const mine = inside ? i >= this.worldN : i < this.worldN;
      const [x0, z0, x1, z1] = o.rect;
      const contain = on && mine && o.kind === 'building' && p.x > x0 && p.x < x1 && p.z > z0 && p.z < z1;
      const blocking = block[i] || (o.group !== undefined && groups.has(o.group));
      if (!mine || !on) {
        // first-person view, title screen or the other scene: everything stands at full height at once
        st.e = 0; st.c = 0; st.hold = 0;
      } else {
        st.hold = blocking ? HOLD : Math.max(0, st.hold - dt);
        const target = blocking || st.hold > 0 ? 1 : 0;
        st.e = target > st.e ? Math.min(1, st.e + dt * 3.2) : Math.max(0, st.e - dt * 2.2);
        st.c = contain ? Math.min(1, st.c + dt * 3) : Math.max(0, st.c - dt * 3);
      }
      const j = (i + 1) * 4;
      let f = OFF, b = OFF, n = OFF, back = 0;
      if (st.e > 0 || st.c > 0) {
        const e = st.e * st.e * (3 - 2 * st.e), c = st.c * st.c * (3 - 2 * st.c);
        const low = o.top + (o.low - o.top) * e;
        const roomH = o.top + (Math.max(o.low, ROOM_TOP) - o.top) * e;
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

/** Does the ray from o along d (towards the camera) pass through the box? */
function rayBox(o: THREE.Vector3, dx: number, dy: number, dz: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  let t0 = 0, t1 = 1e4;
  const axis = (p: number, d: number, lo: number, hi: number) => {
    if (Math.abs(d) < 1e-6) return p >= lo && p <= hi;
    let a = (lo - p) / d, b = (hi - p) / d;
    if (a > b) { const t = a; a = b; b = t; }
    t0 = Math.max(t0, a); t1 = Math.min(t1, b);
    return t0 <= t1;
  };
  return axis(o.x, dx, x0, x1) && axis(o.y, dy, y0, y1) && axis(o.z, dz, z0, z1);
}
