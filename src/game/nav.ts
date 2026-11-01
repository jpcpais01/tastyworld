import type { NavData } from '../world/bake';
import { G, V } from '../world/layout';
import { NEO } from '../world/cityId';

/** A* search budget: Tokyo is 216 x 168 m, Halcyon City (2040) twice that each way. */
const ITER = NEO ? 2400000 : 400000;

const BLOCKED = 255;
const MAX_STEP = 2; // voxels a character can step up or down between neighbouring cells
/** Player body radius in metres: slim and round so it slips between chairs, trees and props. */
export const PLAYER_R = 0.13;
const TIGHT_COST = 2.5; // extra A* cost for squeezing through cells without clearance
/** A* cost per cell on ground walkers keep off (Tokyo's carriageways): they cross at the crosswalks. */
const OFF_COST = 6;
const NUDGE = [0.4, 0.8, 1.2]; // radians to deflect around an obstacle before giving up
const POCKET = 4000; // biggest separate walkable region (cells) a drop may land in: garden terraces, not open hillside
/**
 * Extra A* cost (in 25 cm cells) for hopping down a ledge: a flat 40 m of walking plus 2 m per voxel of fall.
 * Auto-walks take the stairs or a ramp whenever one is within a few dozen metres, and only jump when there is
 * no sensible way round (or no way round at all).
 */
const DROP_COST = 160, DROP_COST_PER_VOX = 8;

/** How far a character may step up and drop down between neighbouring cells, in voxels. */
export interface Reach { up: number; down: number }
const WALK: Reach = { up: MAX_STEP, down: MAX_STEP };
/** The player can hop down off walls and terrace edges up to 4 m; only townsfolk keep to the stairs. */
export const PLAYER_REACH: Reach = { up: MAX_STEP, down: 16 };

/** Walkable heightfield queries + A* pathfinding over 25 cm cells. */
export class Nav {
  readonly sx: number;
  readonly sz: number;
  private clear: Uint8Array;
  private pass: Uint8Array;
  private g: Float32Array;
  private came: Int32Array;
  /** Search state per cell, stamped per search so nothing needs clearing: open = stamp, closed = stamp + 1. */
  private mark: Uint32Array;
  private stamp = 0;
  private heap: Int32Array;
  private hf: Float32Array;
  /** Cells routes avoid when they can (see keepOff), or null. */
  private off: Uint8Array | null = null;
  /** Cells a drop may land on (built on the first drop query). */
  private main: Uint8Array | null = null;

  constructor(readonly d: NavData) {
    this.sx = d.sx;
    this.sz = d.sz;
    const n = d.sx * d.sz;
    this.clear = new Uint8Array(n);
    this.pass = new Uint8Array(n);
    this.flags(0, 0, d.sx - 1, d.sz - 1);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.mark = new Uint32Array(n);
    this.heap = new Int32Array(n);
    this.hf = new Float32Array(n);
  }

  /** Routes keep off the cells where `fn` (world metres) holds unless there is no sensible way round. */
  keepOff(fn: (x: number, z: number) => boolean): void {
    const d = this.d, off = new Uint8Array(d.sx * d.sz);
    for (let z = 0; z < d.sz; z++) for (let x = 0; x < d.sx; x++) off[z * d.sx + x] = fn(d.ox + (x + 0.5) * V, d.oz + (z + 0.5) * V) ? 1 : 0;
    this.off = off;
  }

  /** Recompute the clearance and passability flags of a cell range (inclusive). */
  private flags(x0: number, z0: number, x1: number, z1: number): void {
    const d = this.d;
    x0 = Math.max(0, x0); z0 = Math.max(0, z0); x1 = Math.min(d.sx - 1, x1); z1 = Math.min(d.sz - 1, z1);
    const open = (x: number, z: number, h: number) => {
      if (x < 0 || z < 0 || x >= d.sx || z >= d.sz) return false;
      const nh = d.height[z * d.sx + x];
      return nh !== BLOCKED && Math.abs(nh - h) <= MAX_STEP;
    };
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const i = z * d.sx + x;
        const h = d.height[i];
        this.clear[i] = 0;
        this.pass[i] = 0;
        if (h === BLOCKED) continue;
        // clearance: a cell is comfortably walkable if its 8 neighbours are walkable at a similar height
        let ok = 1;
        for (let dz = -1; dz <= 1 && ok; dz++)
          for (let dx = -1; dx <= 1 && ok; dx++) if ((dx || dz) && !open(x + dx, z + dz, h)) ok = 0;
        this.clear[i] = ok;
        // passable: walkable and not pinched between blockers on opposite sides (gaps of 2+ cells, ~50 cm)
        this.pass[i] = (open(x - 1, z, h) || open(x + 1, z, h)) && (open(x, z - 1, h) || open(x, z + 1, h)) ? 1 : 0;
      }
  }

  private saved = new Map<string, Uint8Array>();

  /** Block (or restore) a rectangle in metres at runtime, e.g. a doorway behind a sliding bookshelf. */
  setBlocked(key: string, rect: [number, number, number, number], blocked: boolean): void {
    const d = this.d;
    const x0 = Math.floor((rect[0] - d.ox) / V), z0 = Math.floor((rect[1] - d.oz) / V);
    const x1 = Math.floor((rect[2] - d.ox) / V), z1 = Math.floor((rect[3] - d.oz) / V);
    let saved = this.saved.get(key);
    if (blocked) {
      if (saved) return;
      saved = new Uint8Array((x1 - x0 + 1) * (z1 - z0 + 1));
      let k = 0;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++, k++) { saved[k] = d.height[z * d.sx + x]; d.height[z * d.sx + x] = BLOCKED; }
      this.saved.set(key, saved);
    } else {
      if (!saved) return;
      let k = 0;
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++, k++) d.height[z * d.sx + x] = saved[k];
      this.saved.delete(key);
    }
    this.flags(x0 - 1, z0 - 1, x1 + 1, z1 + 1);
  }

  cell(x: number, z: number): number {
    const cx = Math.floor((x - this.d.ox) / V), cz = Math.floor((z - this.d.oz) / V);
    if (cx < 0 || cz < 0 || cx >= this.sx || cz >= this.sz) return -1;
    return cz * this.sx + cx;
  }

  rawHeight(i: number): number {
    return i < 0 ? BLOCKED : this.d.height[i];
  }

  walkable(x: number, z: number): boolean {
    const i = this.cell(x, z);
    return i >= 0 && this.d.height[i] !== BLOCKED;
  }

  /** Floor height in metres (smoothed across steps). */
  heightAt(x: number, z: number): number {
    const fx = (x - this.d.ox) / V - 0.5, fz = (z - this.d.oz) / V - 0.5;
    const x0 = Math.floor(fx), z0 = Math.floor(fz);
    const tx = fx - x0, tz = fz - z0;
    const centre = this.rawHeight(this.cell(x, z));
    const ref = centre === BLOCKED ? G : centre;
    let sum = 0, w = 0;
    for (let k = 0; k < 4; k++) {
      const cx = x0 + (k & 1), cz = z0 + (k >> 1);
      if (cx < 0 || cz < 0 || cx >= this.sx || cz >= this.sz) continue;
      let h = this.d.height[cz * this.sx + cx];
      if (h === BLOCKED || Math.abs(h - ref) > MAX_STEP) h = ref;
      const ww = ((k & 1) ? tx : 1 - tx) * ((k >> 1) ? tz : 1 - tz);
      sum += h * ww;
      w += ww;
    }
    return ((w > 0 ? sum / w : ref) - G) * V;
  }

  /** Can a character of the given radius stand at (x,z), coming from height hFrom (voxels)? */
  canStand(x: number, z: number, hFrom: number, r = PLAYER_R, reach = WALK): boolean {
    const d = r * 0.707;
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]];
    for (const [dx, dz] of pts) {
      const i = this.cell(x + dx, z + dz), h = this.rawHeight(i);
      if (h === BLOCKED) return false;
      const slack = dx === 0 && dz === 0 ? 0 : 1;
      if (h - hFrom > reach.up + slack) return false;
      if (hFrom - h > MAX_STEP + slack && (hFrom - h > reach.down + slack || !this.mainAt(i))) return false;
    }
    return true;
  }

  /** Can a drop land here? Only where the town's main network is still reachable, so a hop never strands anyone. */
  private mainAt(i: number): boolean {
    if (!this.main) this.main = this.landings();
    return this.main[i] === 1;
  }

  /**
   * Flood the walkable cells by ordinary steps and keep the biggest region (the town itself), then add the small
   * pockets (garden terraces, ledges) you can hop back down out of. Open hillside beyond the town stays out.
   */
  private landings(): Uint8Array {
    const { sx, sz } = this, H = this.d.height, n = sx * sz;
    const comp = new Int32Array(n).fill(-1);
    const size: number[] = [];
    const q = new Int32Array(n);
    const nb = (c: number, k: number) => {
      const cx = c % sx, cz = (c - cx) / sx;
      const nx = cx + (k === 0 ? 1 : k === 1 ? -1 : 0), nz = cz + (k === 2 ? 1 : k === 3 ? -1 : 0);
      return nx < 0 || nz < 0 || nx >= sx || nz >= sz ? -1 : nz * sx + nx;
    };
    let best = -1;
    for (let s0 = 0; s0 < n; s0++) {
      if (comp[s0] >= 0 || H[s0] === BLOCKED) continue;
      const id = size.length;
      let qh = 0, qt = 0;
      q[qt++] = s0; comp[s0] = id;
      while (qh < qt) {
        const c = q[qh++];
        for (let k = 0; k < 4; k++) {
          const ni = nb(c, k);
          if (ni < 0 || comp[ni] >= 0 || H[ni] === BLOCKED || Math.abs(H[ni] - H[c]) > MAX_STEP) continue;
          comp[ni] = id; q[qt++] = ni;
        }
      }
      size.push(qt);
      if (best < 0 || qt > size[best]) best = id;
    }
    const out = new Uint8Array(n);
    let qh = 0, qt = 0;
    for (let i = 0; i < n; i++) if (comp[i] === best) { out[i] = 1; q[qt++] = i; }
    // walk backwards from the town: a cell is a landing if it can step or hop onto one
    while (qh < qt) {
      const c = q[qh++];
      for (let k = 0; k < 4; k++) {
        const ni = nb(c, k);
        if (ni < 0 || out[ni] || H[ni] === BLOCKED || size[comp[ni]] > POCKET) continue;
        const d = H[ni] - H[c];
        if (d < -MAX_STEP || d > PLAYER_REACH.down) continue;
        out[ni] = 1; q[qt++] = ni;
      }
    }
    return out;
  }

  /**
   * Moves a character from (x,z) by dist along (dx,dz), sliding along walls and nudging round
   * corners instead of stopping dead. `side` (+1/-1) is the deflection tried first, so a slide
   * keeps going the same way. Returns the new position, or null if every direction is blocked.
   */
  slide(x: number, z: number, dx: number, dz: number, dist: number, hFrom: number, side = 1, reach = WALK): { x: number; z: number; side: number } | null {
    // already wedged (e.g. after a teleport or a drop): let any step onto walkable floor through
    const r = this.canStand(x, z, hFrom) ? PLAYER_R : 0;
    const ok = (ax: number, az: number) => this.canStand(ax, az, hFrom, r, reach);
    if (ok(x + dx * dist, z + dz * dist)) return { x: x + dx * dist, z: z + dz * dist, side };
    for (const a of NUDGE) {
      const c = Math.cos(a), sn = Math.sin(a), d = dist * Math.max(0.45, c);
      for (const sd of [side, -side]) {
        const rx = dx * c - dz * sn * sd, rz = dz * c + dx * sn * sd;
        const nx = x + rx * d, nz = z + rz * d;
        if (ok(nx, nz)) return { x: nx, z: nz, side: sd };
      }
    }
    return null;
  }

  standHeightVox(x: number, z: number): number {
    return this.rawHeight(this.cell(x, z));
  }

  private nearestClear(i: number, maxR = 24): number {
    if (i >= 0 && this.clear[i]) return i;
    if (i < 0) return -1;
    const cx = i % this.sx, cz = Math.floor(i / this.sx);
    for (let r = 1; r <= maxR; r++) {
      let best = -1, bd = Infinity;
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = cx + dx, z = cz + dz;
          if (x < 0 || z < 0 || x >= this.sx || z >= this.sz) continue;
          const j = z * this.sx + x;
          if (!this.clear[j]) continue;
          const d = dx * dx + dz * dz;
          if (d < bd) { bd = d; best = j; }
        }
      if (best >= 0) return best;
    }
    return -1;
  }

  /** The cell itself if it can be stood on, otherwise the nearest roomy one. */
  private nearestWalkable(i: number, maxR: number): number {
    return i >= 0 && this.pass[i] ? i : this.nearestClear(i, maxR);
  }

  /** A* path from a to b. Returns smoothed waypoints in metres (excluding the start), or null. */
  findPath(ax: number, az: number, bx: number, bz: number, reach = WALK): [number, number][] | null {
    const start = this.nearestWalkable(this.cell(ax, az), 6);
    const goal = this.nearestWalkable(this.cell(bx, bz), 24);
    if (start < 0 || goal < 0) return null;
    const { sx } = this;
    const H = this.d.height;
    if (this.stamp > 0xfffffff0) { this.mark.fill(0); this.stamp = 0; }
    const OPEN = (this.stamp += 2), CLOSED = OPEN + 1, mark = this.mark;
    const gx = goal % sx, gz = Math.floor(goal / sx);
    const heur = (i: number) => {
      const dx = Math.abs((i % sx) - gx), dz = Math.abs(Math.floor(i / sx) - gz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };
    let hs = 0;
    const heap = this.heap, f = this.hf;
    const push = (i: number) => {
      let k = hs++;
      heap[k] = i;
      while (k > 0) {
        const p = (k - 1) >> 1;
        if (f[heap[p]] <= f[heap[k]]) break;
        const t = heap[p]; heap[p] = heap[k]; heap[k] = t;
        k = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      heap[0] = heap[--hs];
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < hs && f[heap[l]] < f[heap[m]]) m = l;
        if (r < hs && f[heap[r]] < f[heap[m]]) m = r;
        if (m === k) break;
        const t = heap[m]; heap[m] = heap[k]; heap[k] = t;
        k = m;
      }
      return top;
    };
    this.g[start] = 0;
    f[start] = heur(start);
    this.came[start] = -1;
    mark[start] = OPEN;
    push(start);
    const off = this.off;
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    let iter = 0;
    while (hs > 0 && iter++ < ITER) { // (room for routes across the whole city)
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (mark[cur] === CLOSED) continue;
      mark[cur] = CLOSED;
      const cx = cur % sx, cz = Math.floor(cur / sx);
      const ch = H[cur];
      for (const [dx, dz, cost] of D) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= sx || nz >= this.sz) continue;
        const ni = nz * sx + nx;
        if (!this.pass[ni] || mark[ni] === CLOSED) continue;
        const rise = H[ni] - ch;
        if (rise > reach.up) continue;
        const drop = -rise > MAX_STEP;
        if (drop && (-rise > reach.down || dx && dz || !this.mainAt(ni))) continue;
        if (dx && dz && (!this.pass[cz * sx + nx] || !this.pass[nz * sx + cx])) continue;
        // narrow gaps are allowed but cost more, so open ground is still preferred
        const ng = this.g[cur] + cost * (this.clear[ni] ? 1 : TIGHT_COST) * (off && off[ni] ? OFF_COST : 1) + (drop ? DROP_COST - rise * DROP_COST_PER_VOX : 0);
        if (mark[ni] === OPEN && ng >= this.g[ni]) continue;
        this.g[ni] = ng;
        this.came[ni] = cur;
        f[ni] = ng + heur(ni);
        mark[ni] = OPEN;
        push(ni);
      }
    }
    if (!found) return null;
    const cells: number[] = [];
    for (let c = goal; c !== -1; c = this.came[c]) cells.push(c);
    cells.reverse();
    // string pulling with line of sight
    const out: [number, number][] = [];
    let anchor = 0;
    for (let i = 2; i < cells.length; i++) {
      if (!this.los(cells[anchor], cells[i])) {
        anchor = i - 1;
        out.push(this.centre(cells[anchor]));
      }
    }
    if (cells.length > 1) out.push(this.centre(cells[cells.length - 1]));
    // finish exactly at the requested point if it is reachable
    const last = this.cell(bx, bz), end = cells[cells.length - 1];
    if (last === end) {
      if (out.length) out[out.length - 1] = [bx, bz];
      else out.push([bx, bz]);
    } else if (last >= 0 && this.clear[last] && this.los(end, last)) out.push([bx, bz]);
    return out;
  }

  private centre(i: number): [number, number] {
    return [this.d.ox + ((i % this.sx) + 0.5) * V, this.d.oz + (Math.floor(i / this.sx) + 0.5) * V];
  }

  private los(a: number, b: number): boolean {
    const sx = this.sx;
    let x0 = a % sx, z0 = Math.floor(a / sx);
    const x1 = b % sx, z1 = Math.floor(b / sx);
    const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
    const stx = x0 < x1 ? 1 : -1, stz = z0 < z1 ? 1 : -1;
    let err = dx - dz;
    let prevH = this.d.height[a];
    // a straightened route only cuts over ground to keep off (a carriageway) where the route itself went
    const off = this.off && !this.off[a] && !this.off[b] ? this.off : null;
    for (;;) {
      const i = z0 * sx + x0;
      if (!this.clear[i] || (off && off[i])) return false;
      const h = this.d.height[i];
      if (Math.abs(h - prevH) > MAX_STEP) return false;
      prevH = h;
      if (x0 === x1 && z0 === z1) return true;
      const e2 = 2 * err;
      if (e2 > -dz) { err -= dz; x0 += stx; }
      if (e2 < dx) { err += dx; z0 += stz; }
    }
  }
}
