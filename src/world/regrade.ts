import { SX, SZ, VX0, VZ0 } from './layout';

/**
 * Walkable grades for a hillside plan (city code v2 rule 6: no ledge the player can't climb). Paths are painted one
 * segment at a time, each graded evenly between its own ends, and squares are laid level over them; where a stair's
 * foot meets a square, or two streets cross on different grades, that leaves a riser too tall to step up. This finds
 * every such riser between two path columns and regrades the adjustable paths (stairs, lanes, streets) round it into
 * a flight of steps a voxel high, so the square, the courtyard or the hall it meets keeps its level.
 *
 * Only columns within `reach` of a riser change, so the rest of the town keeps the grades it was built on. Works on
 * the plan's arrays in place, from the plan alone, so every world worker agrees.
 */
export function regradePaths(walk: Uint8Array, kind: Uint8Array, opts: {
  /** Kinds that may be regraded. */
  adjustable: Set<number>;
  /** Kinds that take part as fixed levels (squares, courts, quays, halls...). */
  fixed: Set<number>;
  /** How far round a riser the grade may change (columns). */
  reach?: number;
  /** Two columns this far apart in height are different layers (a lane over a vault), not a riser. */
  layer?: number;
}): { risers: number; changed: number; left: number } {
  const { adjustable, fixed } = opts;
  const reach = opts.reach ?? 28, layer = opts.layer ?? 24;
  const n = SX * SZ;
  const part = (i: number) => adjustable.has(kind[i]) || fixed.has(kind[i]);
  const nbs = (i: number, f: (j: number) => void) => {
    const x = i % SX;
    if (x + 1 < SX) f(i + 1);
    if (x > 0) f(i - 1);
    if (i + SX < n) f(i + SX);
    if (i >= SX) f(i - SX);
  };
  const riser = (i: number, j: number) => { const d = Math.abs(walk[i] - walk[j]); return d > 2 && d <= layer; };
  // the risers, and the adjustable columns round them (by walking distance along the adjustable paths)
  const dist = new Int32Array(n).fill(-1);
  const q: number[] = [];
  let risers = 0;
  for (let i = 0; i < n; i++) {
    if (!part(i)) continue;
    nbs(i, (j) => {
      if (j < i || !part(j) || !riser(i, j)) return;
      risers++;
      for (const c of [i, j]) if (adjustable.has(kind[c]) && dist[c] < 0) { dist[c] = 0; q.push(c); }
    });
  }
  for (let k = 0; k < q.length; k++) {
    const c = q[k];
    if (dist[c] >= reach) continue;
    nbs(c, (j) => { if (dist[j] < 0 && adjustable.has(kind[j]) && Math.abs(walk[j] - walk[c]) <= layer) { dist[j] = dist[c] + 1; q.push(j); } });
  }
  const zone = q;
  const h = new Float32Array(n);
  for (let i = 0; i < n; i++) h[i] = walk[i];
  // a voxel a column: lower what stands too high over its neighbours, then raise what sits too low under them,
  // repeating until nothing moves (each sweep only ever moves one way, so it settles)
  const S = 1;
  const relax = (down: boolean, step: number, cells: number[]) => {
    for (let it = 0, moved = true; moved && it < 400; it++) {
      moved = false;
      for (let pass = 0; pass < 2; pass++)
        for (let k = pass ? cells.length - 1 : 0; pass ? k >= 0 : k < cells.length; k += pass ? -1 : 1) {
          const c = cells[k];
          let v = h[c];
          nbs(c, (j) => {
            if (!part(j) || Math.abs(h[j] - h[c]) > layer) return;
            if (down) v = Math.min(v, h[j] + step); else v = Math.max(v, h[j] - step);
          });
          if (v !== h[c]) { h[c] = v; moved = true; }
        }
    }
  };
  relax(true, S, zone);
  relax(false, S, zone);
  let changed = 0;
  for (const c of zone) { const v = Math.round(h[c]); if (v !== walk[c]) { walk[c] = v; changed++; } }
  let left = 0;
  for (let i = 0; i < n; i++) if (part(i)) nbs(i, (j) => { if (j > i && part(j) && riser(i, j)) left++; });
  return { risers, changed, left };
}

/**
 * Garden steps: every patch of open ground left between the houses (a terrace, a yard, a strip of hillside) that
 * stands above the paths it borders gets a flight of steps down to them, so nothing the player can see from a path
 * is out of reach. Patches are joined one at a time outwards from the paths: each one takes a single flight, cut
 * into the higher side of its edge with a path or with a patch already joined, a voxel a step and a few steps wide.
 * Run after the house lots are placed, on what is left; flight columns become `stair` kind.
 */
export function gardenFlights(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, opts: {
  /** Open ground kinds (terraces, yards). */
  ground: number;
  /** Kind the steps are drawn as. */
  stair: number;
  /** Paths a flight may come down to. */
  path: (k: number) => boolean;
  /** Columns that stay wild (natural cliffs, ground past the town's edge): no steps cut there. */
  wild?: (x: number, z: number) => boolean;
  /** Tallest riser a flight climbs (voxels), and the smallest patch worth one (columns). */
  maxRise?: number;
  minPatch?: number;
  /** Flight width (columns), and the most a stretch of edge may run with no way up (columns). */
  width?: number;
  spacing?: number;
}): { patches: number; flights: number; stranded: number } {
  const { ground, stair, path } = opts;
  const maxRise = opts.maxRise ?? 16, minPatch = opts.minPatch ?? 48, W = opts.width ?? 5, spacing = opts.spacing ?? 56;
  const n = SX * SZ;
  const VX = (i: number) => (i % SX) + VX0, VZ = (i: number) => Math.floor(i / SX) + VZ0;
  const open = (i: number) => kind[i] === ground && !lot[i] && !(opts.wild?.(VX(i), VZ(i)));
  // patches of open ground walkable within themselves
  const comp = new Int32Array(n).fill(-1);
  const cells: number[][] = [];
  const q: number[] = [];
  for (let s = 0; s < n; s++) {
    if (comp[s] >= 0 || !open(s)) continue;
    const id = cells.length, list = [s];
    comp[s] = id; q.length = 0; q.push(s);
    for (let k = 0; k < q.length; k++) {
      const c = q[k], x = c % SX;
      for (const j of [x + 1 < SX ? c + 1 : -1, x > 0 ? c - 1 : -1, c + SX < n ? c + SX : -1, c - SX]) {
        if (j < 0 || comp[j] >= 0 || !open(j) || Math.abs(walk[j] - walk[c]) > 2) continue;
        comp[j] = id; q.push(j); list.push(j);
      }
    }
    cells.push(list);
  }
  const joined = new Uint8Array(cells.length);
  const reach = (i: number) => (comp[i] >= 0 ? joined[comp[i]] === 1 : path(kind[i]) && !lot[i]);
  const DIRS = [1, -1, SX, -SX];
  /**
   * Cut a flight from the edge column `top` (on the higher side) inwards along `d`, down to `low`: a voxel a step
   * where there is room, steeper (never more than two a step) where the terrace is shallow.
   */
  const fits = (top: number, d: number, low: number, owner: number) => {
    const rise = walk[top] - low, alongX = Math.abs(d) === 1, step = Math.sign(d);
    const tx = top % SX, tz = Math.floor(top / SX);
    /** Column of step k, w across the flight (or -1 off the map). */
    const at = (k: number, w: number) => {
      const x = tx + (alongX ? step * k : w), z = tz + (alongX ? w : step * k);
      return x < 0 || z < 0 || x >= SX || z >= SZ ? -1 : z * SX + x;
    };
    const ok = (c: number) => c >= 0 && comp[c] === owner && kind[c] === ground;
    // every step is on this patch in its middle and at least one column beside it (an edge running on the slant
    // leaves a corner off); the outer columns are cut where they are on it too
    const row = (k: number) => ok(at(k, 0)) && (ok(at(k, -1)) || ok(at(k, 1)));
    let len = 0;
    while (len < rise && row(len)) len++;
    if (len < Math.ceil(rise / 2)) return null;
    // the foot lands on the lower side (beside it, the patch's own corner may stand)
    const foot = at(-1, 0);
    if (foot < 0 || comp[foot] === owner || Math.abs(walk[foot] - low) > 2 || !(reach(foot) || comp[foot] >= 0)) return null;
    for (const w of [-1, 1]) {
      const f = at(-1, w);
      if (f < 0 || ok(f)) continue;
      if (Math.abs(walk[f] - low) > 2 || !(reach(f) || comp[f] === comp[foot])) return null;
    }
    const out: [number, number][] = [];
    for (let k = 0; k < len; k++)
      for (let w = -(W >> 1); w <= W >> 1; w++) {
        const c = at(k, w);
        if (!ok(c)) continue;
        out.push([c, Math.min(walk[c], low + Math.ceil(((k + 1) * rise) / len))]);
      }
    return out;
  };
  /**
   * Build a flight up from the patch column `first` (at the foot of a path's wall) outwards along `d`, from the
   * path's level `high` down onto the patch: steps standing on the patch, a voxel a step where there is room.
   */
  const stands = (first: number, d: number, high: number, owner: number) => {
    const rise = high - walk[first], alongX = Math.abs(d) === 1, step = Math.sign(d);
    const tx = first % SX, tz = Math.floor(first / SX);
    const at = (k: number, w: number) => {
      const x = tx + (alongX ? step * k : w), z = tz + (alongX ? w : step * k);
      return x < 0 || z < 0 || x >= SX || z >= SZ ? -1 : z * SX + x;
    };
    const ok = (c: number) => c >= 0 && comp[c] === owner && kind[c] === ground && walk[c] <= high;
    // room for the flight and a landing at its foot
    let len = 0;
    for (; len <= rise; len++) {
      let row = true;
      for (let w = -2; w <= 2 && row; w++) row = ok(at(len, w));
      if (!row) break;
    }
    len = Math.min(rise, len - 1);
    if (len < Math.ceil(rise / 2)) return null;
    // the top step meets the path across the whole width
    for (let w = -1; w <= 1; w++) {
      const f = at(-1, w);
      if (f < 0 || Math.abs(walk[f] - high) > 2 || !reach(f)) return null;
    }
    const out: [number, number][] = [];
    // (five wide: where the flight stands proud of the patch its outer columns carry the parapets)
    for (let k = 0; k < len; k++)
      for (let w = -2; w <= 2; w++) out.push([at(k, w), Math.max(walk[at(k, w)], high - Math.ceil((k * rise) / len))]);
    return out;
  };
  /** Where a patch meets the joined ground: level spots (open already) and risers a flight could climb. */
  const contacts = (id: number) => {
    const level: number[] = [];
    const cand: { top: number; d: number; low: number; owner: number; at: number; raise?: boolean }[] = [];
    for (const c of cells[id])
      for (const d of DIRS) {
        const j = c + d;
        if (j < 0 || j >= n || (Math.abs(d) === 1 && Math.floor(j / SX) !== Math.floor(c / SX)) || comp[j] === id || !reach(j)) continue;
        const dh = walk[c] - walk[j];
        if (Math.abs(dh) <= 2) level.push(c);
        // this patch higher: steps cut into it; lower: into the joined patch above (never into a path)
        else if (dh > 2 && dh <= maxRise) cand.push({ top: c, d: -d, low: walk[j], owner: id, at: c });
        else if (-dh > 2 && -dh <= maxRise && comp[j] >= 0) cand.push({ top: j, d, low: walk[c], owner: comp[j], at: c });
        // under a path's parapet: a flight built up against the wall, down from the path onto this patch
        else if (-dh > 2 && -dh <= maxRise) cand.push({ top: c, d: -d, low: walk[j], owner: id, at: c, raise: true });
      }
    return { level, cand };
  };
  /** A flight may not run beside a path it doesn't step onto (it would leave a riser between the two). */
  const clear = (f: [number, number][]) => {
    const mine = new Map(f);
    for (const [c, h] of f)
      for (const d of DIRS) {
        const j = c + d;
        if (j < 0 || j >= n || mine.has(j) || (Math.abs(d) === 1 && Math.floor(j / SX) !== Math.floor(c / SX))) continue;
        if (comp[j] < 0 && path(kind[j]) && !lot[j] && Math.abs(walk[j] - h) > 2) return false;
      }
    return true;
  };
  const cut = (c: { top: number; d: number; low: number; owner: number; raise?: boolean }) => {
    const f = c.raise ? stands(c.top, c.d, c.low, c.owner) : fits(c.top, c.d, c.low, c.owner);
    if (!f || !clear(f)) return false;
    for (const [col, h] of f) { walk[col] = h; kind[col] = stair; }
    flights++;
    return true;
  };
  let flights = 0;
  // join the patches outwards from the paths, one flight each, in the middle of their edge where it fits
  for (let changed = true; changed; ) {
    changed = false;
    for (let id = 0; id < cells.length; id++) {
      if (joined[id]) continue;
      const { level, cand } = contacts(id);
      if (level.length) { joined[id] = 1; changed = true; continue; }
      if (cells[id].length < minPatch || !cand.length) continue;
      const mid = cand.length >> 1;
      const order = cand.map((_, k) => k).sort((a, b) => Math.abs(a - mid) - Math.abs(b - mid));
      for (const k of order) if (cut(cand[k])) { joined[id] = 1; changed = true; break; }
    }
  }
  // then more flights along long edges, so no stretch of path runs far beside a terrace with no way up
  const gap2 = spacing * spacing;
  for (let id = 0; id < cells.length; id++) {
    if (!joined[id] || cells[id].length < minPatch) continue;
    // (a level contact counts for joining but not here: the builder may wall it, a gate pier or a yard wall)
    const { cand } = contacts(id);
    const ways: number[] = [];
    for (const c of cand) {
      const cx = c.at % SX, cz = Math.floor(c.at / SX);
      if (ways.some((w) => (w % SX - cx) ** 2 + (Math.floor(w / SX) - cz) ** 2 < gap2)) continue;
      if (cut(c)) ways.push(c.at);
    }
  }
  let stranded = 0;
  for (let id = 0; id < cells.length; id++) if (!joined[id] && cells[id].length >= minPatch) stranded++;
  return { patches: cells.length, flights, stranded };
}
