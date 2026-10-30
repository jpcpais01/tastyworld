import type { NavData } from '../world/bake';
import { G, V } from '../world/layout';

const BLOCKED = 255;
const MAX_STEP = 2; // voxels a character can step up or down between neighbouring cells
/** Player body radius in metres: slim and round so it slips between chairs, trees and props. */
export const PLAYER_R = 0.13;
const TIGHT_COST = 2.5; // extra A* cost for squeezing through cells without clearance
const NUDGE = [0.4, 0.8, 1.2]; // radians to deflect around an obstacle before giving up

/** Walkable heightfield queries + A* pathfinding over 25 cm cells. */
export class Nav {
  readonly sx: number;
  readonly sz: number;
  private clear: Uint8Array;
  private pass: Uint8Array;
  private g: Float32Array;
  private came: Int32Array;
  private state: Uint8Array;
  private heap: Int32Array;
  private hf: Float32Array;

  constructor(readonly d: NavData) {
    this.sx = d.sx;
    this.sz = d.sz;
    const n = d.sx * d.sz;
    this.clear = new Uint8Array(n);
    this.pass = new Uint8Array(n);
    this.flags(0, 0, d.sx - 1, d.sz - 1);
    this.g = new Float32Array(n);
    this.came = new Int32Array(n);
    this.state = new Uint8Array(n);
    this.heap = new Int32Array(n);
    this.hf = new Float32Array(n);
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
  canStand(x: number, z: number, hFrom: number, r = PLAYER_R): boolean {
    const d = r * 0.707;
    const pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r], [d, d], [-d, d], [d, -d], [-d, -d]];
    for (const [dx, dz] of pts) {
      const h = this.rawHeight(this.cell(x + dx, z + dz));
      if (h === BLOCKED || Math.abs(h - hFrom) > MAX_STEP + (dx === 0 && dz === 0 ? 0 : 1)) return false;
    }
    return true;
  }

  /**
   * Moves a character from (x,z) by dist along (dx,dz), sliding along walls and nudging round
   * corners instead of stopping dead. `side` (+1/-1) is the deflection tried first, so a slide
   * keeps going the same way. Returns the new position, or null if every direction is blocked.
   */
  slide(x: number, z: number, dx: number, dz: number, dist: number, hFrom: number, side = 1): { x: number; z: number; side: number } | null {
    // already wedged (e.g. after a teleport): let any step onto walkable floor through
    const r = this.canStand(x, z, hFrom) ? PLAYER_R : 0;
    const ok = (ax: number, az: number) => this.canStand(ax, az, hFrom, r);
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
  findPath(ax: number, az: number, bx: number, bz: number): [number, number][] | null {
    const start = this.nearestWalkable(this.cell(ax, az), 6);
    const goal = this.nearestWalkable(this.cell(bx, bz), 24);
    if (start < 0 || goal < 0) return null;
    const { sx } = this;
    const H = this.d.height;
    this.state.fill(0);
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
    this.state[start] = 1;
    push(start);
    const D = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false;
    let iter = 0;
    while (hs > 0 && iter++ < 400000) { // (the city is 216 x 168 m: room for routes across it)
      const cur = pop();
      if (cur === goal) { found = true; break; }
      if (this.state[cur] === 2) continue;
      this.state[cur] = 2;
      const cx = cur % sx, cz = Math.floor(cur / sx);
      const ch = H[cur];
      for (const [dx, dz, cost] of D) {
        const nx = cx + dx, nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= sx || nz >= this.sz) continue;
        const ni = nz * sx + nx;
        if (!this.pass[ni] || this.state[ni] === 2) continue;
        if (Math.abs(H[ni] - ch) > MAX_STEP) continue;
        if (dx && dz && (!this.pass[cz * sx + nx] || !this.pass[nz * sx + cx])) continue;
        // narrow gaps are allowed but cost more, so open ground is still preferred
        const ng = this.g[cur] + cost * (this.clear[ni] ? 1 : TIGHT_COST);
        if (this.state[ni] === 1 && ng >= this.g[ni]) continue;
        this.g[ni] = ng;
        this.came[ni] = cur;
        f[ni] = ng + heur(ni);
        this.state[ni] = 1;
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
    for (;;) {
      const i = z0 * sx + x0;
      if (!this.clear[i]) return false;
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
