import type { Occluder } from './tokyo';

/**
 * Column ownership for the cutaway (see game/cutaway.ts). Every column of a scene belongs to at most one
 * occluder, so a wall can only ever be cut together with the rest of its own building. Computed in the bake so
 * the mesher can keep the faces where two owners meet: when one of them is lowered, the other still shows a
 * proper side wall instead of a hole into its solid body.
 */

const V = 0.25;
export const SHELL = 2; // voxels of outer wall
export const SPILL = 4; // voxels outside a footprint that still belong to it (awnings, signs, balconies, pipes)
const MASS_H = 8; // voxels (2 m): a column at least this tall from the street is part of a solid mass
const MASS_MIN = 12; // columns: smaller unregistered pieces (poles, pipes) are left to the spill
const REACH = 8; // further voxels a footprint follows things hanging overhead (blade signs, deep eaves)
const TILE = 32; // columns: unregistered masses are split into tiles of at most 8 m
/** Ids that fit the cutaway's 64 x 64 cut table and its 12-bit owner texture (0 = nobody). */
export const MAX_ID = 4095;
/** Splits above this height (voxels) don't fit the owner texture; the column's own owner keeps it whole. */
const SPLIT_MAX = 127;

export interface GridRect { ox: number; oz: number; sx: number; sz: number }
/**
 * Per-column solid run from the street (voxels) and occupancy bits of the 64 layers above it (layers higher up
 * count as solid below the run's top). `walk` (nav standing layer, 255 = blocked) keeps walkable ground such
 * as the Inari hill from being taken for a building-sized mass.
 */
export interface Field { height: Uint8Array; solid: Uint32Array; walk?: Uint8Array; ground?: Uint8Array }
/**
 * The layer (voxels above the street) the 64 occupancy bits of a column start from: the street on flat ground, a
 * metre under the terrain on a hillside, so a hall or a house on a hilltop keeps its own 16 m of detail (its rooms
 * get true section caps however high the hill). Everything under it counts as solid.
 */
export const SOLID_UNDER = 4;
export function solidBase(ground: Uint8Array | null | undefined, c: number): number {
  return ground ? Math.max(0, ground[c] - SOLID_UNDER) : 0;
}
/**
 * Per column: occluder id (index + 1, 0 = nobody) and 255 on a building's shell. Where a building's side rises
 * above a lower neighbour (or a boundary wall), whatever hangs off it up there (sills, pipes, eaves) sits in the
 * neighbour's columns: `upper` names that building and `split` the height (voxels above the street) above which
 * it, not the column's owner, decides the cut.
 */
export interface Owned { id: Uint16Array; shell: Uint8Array; upper: Uint16Array; split: Uint8Array }
export interface Owners { occ: Occluder[]; worldN: number; world: Owned; inside: Owned }

export function buildOwners(world: Occluder[], inside: Occluder[], wr: GridRect, ir: GridRect, wf: Field, inf: Field): Owners {
  const room = MAX_ID - inside.length;
  if (world.length > room) console.warn(`cutaway: ${world.length - room} occluders dropped`);
  const occ = world.slice(0, room);
  const ownW = raster(occ, 0, wr, wf, true, room);
  const worldN = occ.length;
  occ.push(...inside);
  const ownI = raster(occ, worldN, ir, inf, false, MAX_ID);
  // lower from the real top of what each occluder owns, so the cut starts moving the moment it is needed
  for (const [own, f, from, to] of [[ownW.id, wf, 0, worldN], [ownI.id, inf, worldN, occ.length]] as const) {
    const top = new Float32Array(occ.length).fill(-1);
    for (let c = 0; c < own.length; c++) {
      const id = own[c];
      if (!id) continue;
      const hi = f.solid[c * 2 + 1], lo = f.solid[c * 2];
      const layer = Math.max(f.height[c] - 1, solidBase(f.ground, c) + (hi ? 63 - Math.clz32(hi) : lo ? 31 - Math.clz32(lo) : -1));
      top[id - 1] = Math.max(top[id - 1], (layer + 1) * V);
    }
    // above the 64 layers we only see the run from the street, so very tall ones keep their registered top too
    for (let i = from; i < to; i++) if (top[i] > 0) occ[i] = { ...occ[i], top: Math.max(occ[i].low + 0.1, top[i] + 0.3, top[i] >= 64 * V + (occ[i].floor ?? 0) ? occ[i].top : 0) };
  }
  return { occ, worldN, world: ownW, inside: ownI };
}

/**
 * Assigns every column of one scene to at most one occluder (ids are index + 1, 0 = nobody). Registered
 * footprints first, then unregistered solid masses become occluders of their own (so a neighbour's spill can
 * never eat into them), then each footprint spills a little onto open ground for its facade props, and tree
 * canopies take whatever open ground is still free.
 */
function raster(occ: Occluder[], from: number, g: GridRect, f: Field, auto: boolean, cap: number): Owned {
  const n = g.sx * g.sz;
  const id = new Uint16Array(n), shell = new Uint8Array(n), solid = new Uint8Array(n);
  // on a hillside the hill itself is never a mass: only what stands on it counts
  const gr = f.ground;
  const tall = (c: number) => f.height[c] - (gr ? gr[c] : 0) >= MASS_H && (!f.walk || f.walk[c] === 255);
  const span = (o: Occluder) => {
    const [x0, z0, x1, z1] = o.rect;
    return [
      Math.max(0, Math.ceil((x0 - g.ox) / V - 0.5)), Math.max(0, Math.ceil((z0 - g.oz) / V - 0.5)),
      Math.min(g.sx - 1, Math.floor((x1 - g.ox) / V - 0.5)), Math.min(g.sz - 1, Math.floor((z1 - g.oz) / V - 0.5)),
    ];
  };
  // core: only the trunk of a tree (canopies come last, see below)
  const paint = (i: number, core: boolean) => {
    const o = occ[i];
    const [i0, j0, i1, j1] = span(o);
    const ci = (i0 + i1) / 2, cj = (j0 + j1) / 2;
    for (let j = j0; j <= j1; j++)
      for (let k = i0; k <= i1; k++) {
        const c = j * g.sx + k;
        if (o.kind === 'tree') {
          const trunk = Math.max(Math.abs(k - ci), Math.abs(j - cj)) <= 3;
          if (core ? !trunk : id[c]) continue;
        }
        const edge = Math.min(k - i0, i1 - k, j - j0, j1 - j);
        id[c] = i + 1;
        shell[c] = (o.kind !== 'building' && o.room === undefined) || edge < SHELL ? 255 : 0;
        solid[c] = o.kind === 'tree' ? 0 : 1;
      }
  };
  // trunks, then landmarks, then buildings (later ones win where footprints overlap)
  for (const kind of ['tree', 'landmark', 'building'] as const)
    for (let i = from; i < occ.length; i++) if (occ[i].kind === kind) paint(i, true);
  const registered = occ.length;
  if (auto) {
    // flood unowned tall columns into connected masses, split into tiles, and give each its own id
    const seen = new Uint8Array(n);
    let skipped = 0;
    for (let s = 0; s < n; s++) {
      if (seen[s] || id[s] || !tall(s)) continue;
      const comp: number[] = [s];
      seen[s] = 1;
      for (let q = 0; q < comp.length; q++) {
        const c = comp[q], k = c % g.sx, j = (c - k) / g.sx;
        for (const [dk, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const kk = k + dk, jj = j + dj;
          if (kk < 0 || jj < 0 || kk >= g.sx || jj >= g.sz) continue;
          const cc = jj * g.sx + kk;
          // on a hillside a mass never spans terraces, or its cut would shave the upper ones down to the lowest
          if (!seen[cc] && !id[cc] && tall(cc) && (!gr || Math.abs(gr[cc] - gr[c]) <= 2)) { seen[cc] = 1; comp.push(cc); }
        }
      }
      if (comp.length < MASS_MIN) continue;
      const tiles = new Map<number, number[]>();
      for (const c of comp) {
        const k = c % g.sx, j = (c - k) / g.sx, key = Math.floor(j / TILE) * 4096 + Math.floor(k / TILE);
        let t = tiles.get(key);
        if (!t) tiles.set(key, (t = []));
        t.push(c);
      }
      for (const cells of tiles.values()) {
        if (occ.length >= cap) { skipped++; continue; }
        let k0 = g.sx, j0 = g.sz, k1 = -1, j1 = -1, base = 255;
        for (const c of cells) {
          const k = c % g.sx, j = (c - k) / g.sx;
          k0 = Math.min(k0, k); k1 = Math.max(k1, k); j0 = Math.min(j0, j); j1 = Math.max(j1, j);
          id[c] = occ.length + 1; shell[c] = 255; solid[c] = 1;
          if (gr) base = Math.min(base, gr[c]);
        }
        const fl = gr ? base * V : 0;
        occ.push({ rect: [g.ox + k0 * V, g.oz + j0 * V, g.ox + (k1 + 1) * V, g.oz + (j1 + 1) * V], top: 8 + fl, low: 0.95 + fl, kind: 'landmark', floor: fl });
      }
    }
    if (skipped) console.warn(`cutaway: ${skipped} solid masses left without an id`);
  }
  // spill a little past each footprint onto open ground so facade props, awnings and balconies go down with it
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
  // and further out, but only over columns with something up in the air and open ground below it
  const overhead = (c: number) => !(gr && gr[c]) && f.height[c] < MASS_H && (f.solid[c * 2] >>> MASS_H !== 0 || f.solid[c * 2 + 1] !== 0);
  front = front.filter(overhead);
  for (let step = 0; step < REACH && front.length; step++) {
    const next: number[] = [];
    for (const c of front) {
      const k = c % g.sx, j = (c - k) / g.sx;
      for (const [dk, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = k + dk, jj = j + dj;
        if (kk < 0 || jj < 0 || kk >= g.sx || jj >= g.sz) continue;
        const cc = jj * g.sx + kk;
        if (id[cc] || !overhead(cc)) continue;
        id[cc] = id[c];
        shell[cc] = 255;
        next.push(cc);
      }
    }
    front = next;
  }
  // a canopy only takes what is left: it never owns a wall, an awning or a balcony it happens to overhang
  for (let i = from; i < registered; i++) if (occ[i].kind === 'tree') paint(i, false);
  // the same spill again, over the top of neighbouring walls and masses
  const upper = new Uint16Array(n), split = new Uint8Array(n), src = new Uint16Array(n);
  front = [];
  for (let c = 0; c < n; c++) if (solid[c] && occ[id[c] - 1].kind === 'building') { src[c] = id[c]; front.push(c); }
  for (let step = 0; step < SPILL && front.length; step++) {
    const next: number[] = [];
    for (const c of front) {
      const k = c % g.sx, j = (c - k) / g.sx;
      for (const [dk, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const kk = k + dk, jj = j + dj;
        if (kk < 0 || jj < 0 || kk >= g.sx || jj >= g.sz) continue;
        const cc = jj * g.sx + kk;
        if (src[cc]) continue;
        src[cc] = src[c];
        next.push(cc);
        const o = id[cc];
        // only over walls and solid masses, never into the rooms and floors of the neighbour's own body
        if (o && o !== src[c] && shell[cc] && occ[o - 1].kind !== 'tree' && f.height[cc] > 0 && f.height[cc] <= SPLIT_MAX) { upper[cc] = src[c]; split[cc] = f.height[cc]; }
      }
    }
    front = next;
  }
  return { id, shell, upper, split };
}

