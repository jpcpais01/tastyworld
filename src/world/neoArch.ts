// Halcyon City's architecture (2040): the curtain-wall towers in their many cuts, the housing megablocks with
// everything the people in them bolted on, the megamall groundscrapers that roof whole blocks, the aquarium on the
// Halo and the arcology on the ridge. Everything here is painted from pure functions of position (never by reading
// a neighbour column back from the grid), so every worker strip bakes the same city.
import { rng, hash3, type SparseGrid } from './grid';
import { G, V } from './layout';
import { glyph } from './props';
import { tree } from './city';
import type { Builder, Side } from './tokyo';
import type { District } from './neoPlan';
import type { NC } from './neo';

export type Box = [number, number, number, number]; // inclusive voxel rect x0, z0, x1, z1
/** Is column (x, z) part of the mass? */
export type Foot = (x: number, z: number) => boolean;

export const NEON_RGB: [number, number, number][] = [[1, 0.35, 0.7], [0.3, 0.9, 1], [0.65, 0.45, 1], [1, 0.85, 0.35], [0.45, 1, 0.65], [1, 0.55, 0.3]];
const Y = (layer: number) => (layer - G) * V;
const pm = (v: number, m: number) => ((v % m) + m) % m;
/** Add k * IN to a face colour to set it k cells in from the face (the cells in front of it are left open). */
export const IN = 1 << 16;
const DIRS: [Side, number, number][] = [['n', 0, -1], ['s', 0, 1], ['w', -1, 0], ['e', 1, 0]];
const FID: Record<Side, number> = { n: 0, e: 1, s: 2, w: 3 };
const OUT: Record<Side, [number, number]> = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };

export interface Face { x: number; y: number; z: number; side: Side; fid: number; u: number; len: number; corner: boolean }

/**
 * Raise a solid mass over the columns of `box` that `inside` keeps, from layer y0 up to (not including) y1: a core
 * colour inside, and every face column painted by `face`, which may set its colour back into the wall (IN).
 */
export function mass(g: SparseGrid, box: Box, y0: number, y1: number, inside: Foot, core: number, face: (f: Face) => number, own = true): void {
  const [x0, z0, x1, z1] = box;
  y1 = Math.min(y1, g.sy);
  if (y1 <= y0) return;
  const ax0 = Math.max(x0, g.wx0 - 4), ax1 = Math.min(x1, g.wx1 + 3), az0 = Math.max(z0, g.wz0 - 4), az1 = Math.min(z1, g.wz1 + 3);
  if (ax0 > ax1 || az0 > az1) return;
  if (own) {
    // the box is ours alone (a lot): fill its inside as one box, so whole bricks stay uniform and cost no memory,
    // then open the columns the plan leaves out
    g.box(x0 + 1, y0, z0 + 1, x1 - 1, y1 - 1, z1 - 1, core);
    for (let z = Math.max(az0, z0 + 1); z <= Math.min(az1, z1 - 1); z++)
      for (let x = Math.max(ax0, x0 + 1); x <= Math.min(ax1, x1 - 1); x++)
        if (!inside(x, z)) g.box(x, y0, z, x, y1 - 1, z, 0);
  } else
    for (let z = az0; z <= az1; z++)
      for (let x = ax0; x <= ax1; x++)
        if (inside(x, z) && inside(x - 1, z) && inside(x + 1, z) && inside(x, z - 1) && inside(x, z + 1)) g.box(x, y0, z, x, y1 - 1, z, core);
  const f: Face = { x: 0, y: 0, z: 0, side: 's', fid: 0, u: 0, len: 0, corner: false };
  for (let z = az0; z <= az1; z++)
    for (let x = ax0; x <= ax1; x++) {
      if (!inside(x, z)) continue;
      let out = 0, nx = 0, nz = 0, s: Side = 's';
      for (const [sd, dx, dz] of DIRS) if (!inside(x + dx, z + dz)) { if (!out) { s = sd; nx = dx; nz = dz; } out++; }
      if (!out) continue;
      f.x = x; f.z = z; f.side = s; f.fid = FID[s]; f.corner = out > 1;
      f.u = nz ? (s === 'n' ? x - x0 : x1 - x) : s === 'e' ? z - z0 : z1 - z;
      f.len = nz ? x1 - x0 : z1 - z0;
      for (let y = y0; y < y1; y++) {
        f.y = y;
        const v = face(f), d = f.corner ? 0 : v >>> 16, c = v & 0xffff;
        if (!d) { g.set(x, y, z, c); continue; }
        for (let k = 0; k < d; k++) g.set(x - nx * k, y, z - nz * k, 0);
        g.set(x - nx * d, y, z - nz * d, c);
      }
    }
}

const rectFoot = (bx: Box): Foot => (x, z) => x >= bx[0] && x <= bx[2] && z >= bx[1] && z <= bx[3];

// ---------------------------------------------------------------------------------------------
// Windows: what is behind each pane at night

export interface Light { lit: number[]; dim: number[]; glass: number; glass2: number; frac: number; floorFrac: number; seed: number }

/**
 * One cell of a window (column uu of bw, row wy of wh, counted up from the sill) on floor fl, bay `bay` of face fid.
 * Most rooms are dark glass; a lit one is lit from its ceiling and dims towards the sill, and many have blinds down,
 * a curtain half drawn, only a screen on, or someone standing at the glass.
 */
export function pane(n: NC, L: Light, fl: number, fid: number, bay: number, uu: number, bw: number, wy: number, wh: number): number {
  const hv = hash3(fl * 7 + fid, bay, L.seed);
  const all = hash3(fl, fid * 5 + 1, L.seed + 77) < L.floorFrac; // a whole floor still at work
  if (hv >= L.frac && !all) return hash3(fl >> 1, bay >> 1, L.seed + 3) < 0.3 ? L.glass2 : L.glass;
  const h2 = hash3(bay * 3 + fid, fl, L.seed + 5);
  if (all) return wy >= wh - 2 ? n.office : wy === 0 || (uu === 0 && h2 < 0.5) ? n.dimCool : (bay + fl) % 4 === 0 && wy < 3 ? n.soot : n.officeDim;
  const li = Math.floor(h2 * 1000) % L.lit.length, lit = L.lit[li], dim = L.dim[li];
  const k = (h2 * 7.31) % 1;
  if (k < 0.3) return wy >= wh - 3 ? lit : dim;
  if (k < 0.48) return wy % 2 ? lit : n.blind;
  if (k < 0.64) return uu < bw >> 1 ? n.curtain[li % n.curtain.length] : wy >= wh - 3 ? lit : dim;
  if (k < 0.72) return wy > 1 && wy < wh - 3 && uu > 0 && uu < bw - 1 ? n.tvBlue : L.glass;
  if (k < 0.86) return uu === bw >> 1 && wy < wh - 3 ? n.soot : wy >= wh - 3 ? lit : dim;
  return lit;
}

const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];

// ---------------------------------------------------------------------------------------------
// Towers

/** How a tower's face is cut: fins and glass, ribbon windows, punched stone, deep sun fins, louvred. */
const enum Cut { Curtain, Ribbon, Punched, Brise, Louvre }
const enum Plan { Rect, Chamfer, Round, Notch, Twin }

interface Skin { cut: Cut; bay: number; FH: number; frame: number; band: number; spandrel: number; wall: number; accent: number; L: Light; ribs: boolean; mech: number; transom: boolean }

function skinFor(n: NC, r: () => number, d: District, seed: number): Skin {
  const corp = d === 'spire' || d === 'halo';
  const cut = pick<Cut>(r, corp ? [Cut.Curtain, Cut.Curtain, Cut.Ribbon, Cut.Brise, Cut.Louvre, Cut.Punched] : [Cut.Curtain, Cut.Ribbon, Cut.Punched, Cut.Punched, Cut.Brise, Cut.Louvre]);
  const glass = pick(r, corp ? [n.blackGlass, n.blueGlass, n.tealGlass, n.blackGlass, n.bronzeGlass, n.greyGlass] : [n.blackGlass, n.blueGlass, n.greyGlass, n.tealGlass]);
  const litSet = pick(r, [[0, 1], [0, 2], [1, 3], [0, 1, 2], [0, 3]]);
  const LIT = [n.litWarm, n.litCool, n.litGlass, n.sodiumWin], DIM = [n.dimWarm, n.dimCool, n.dimCool, n.dimWarm];
  return {
    cut,
    bay: pick(r, cut === Cut.Punched ? [6, 7, 8] : [6, 8, 8, 10]),
    FH: 14,
    frame: pick(r, corp ? [n.steelDark, n.chrome, n.steel, n.navy, n.steelDark] : [n.concreteDark, n.steelDark, n.soot, n.steel]),
    band: pick(r, corp ? [n.steelDark, n.navy, n.concreteDark, n.soot] : [n.concrete, n.concreteDark, n.tileGrey, n.soot]),
    spandrel: pick(r, [n.screenDark, n.soot, n.steelDark, glass]),
    wall: pick(r, cut === Cut.Punched ? [n.concrete, n.tileGrey, n.concreteDark, n.maroon, n.navy, n.plum, n.rustRed] : [n.concreteDark, n.soot]),
    accent: n.neon[Math.floor(r() * n.neon.length)],
    L: { lit: litSet.map((i) => LIT[i]), dim: litSet.map((i) => DIM[i]), glass, glass2: glass === n.blackGlass ? n.greyGlass : n.blackGlass, frac: 0.16 + r() * 0.24, floorFrac: corp ? 0.04 + r() * 0.08 : 0.02, seed },
    ribs: false,
    mech: pick(r, [0, 10, 12, 16]),
    transom: r() < 0.5,
  };
}

function skinFace(n: NC, S: Skin, y0: number) {
  const wh = S.FH - 2;
  return (f: Face): number => {
    const fl = Math.floor((f.y - y0) / S.FH), fy = (f.y - y0) % S.FH;
    if (f.corner) return S.ribs && fy > 1 && fy < 10 && (fl + f.fid) % 4 === 0 ? S.accent : S.frame;
    // a plant floor every so often: louvres in front of the machinery, a lit line at its waist
    if (S.mech && fl % S.mech === S.mech - 1 && fl > 0) return fy < 2 ? S.band : fy === 7 && S.ribs ? S.accent : fy % 2 ? S.frame : n.steelDark + IN;
    const u = f.u, bay = Math.floor(u / S.bay), ub = u % S.bay, wy = fy - 2;
    switch (S.cut) {
      case Cut.Ribbon:
        if (fy < 3) return fy === 1 ? (S.ribs && fl % 6 === 0 ? S.accent : S.spandrel) : S.band;
        if (ub === 0) return S.frame + IN;
        return pane(n, S.L, fl, f.fid, bay, ub - 1, S.bay - 1, fy - 3, S.FH - 3) + IN;
      case Cut.Punched: {
        // stone piers proud, each bay's windows and their spandrel panels set back in one channel up the face
        if (ub === 0) return S.frame;
        if (ub === 1 || ub === S.bay - 1) return hash3(u, f.y >> 2, f.fid) < 0.05 ? n.soot : S.wall;
        if (fy === 0) return S.band + IN;
        if (wy >= 2 && wy <= wh - 2) return pane(n, S.L, fl, f.fid, bay, ub - 2, S.bay - 3, wy - 2, wh - 3) + IN;
        return (wy === 1 ? S.frame : S.spandrel) + IN;
      }
      case Cut.Brise:
        // deep sun shades along every floor, the glass and its mullions behind them
        if (fy === 0 || fy === 1) return fy ? S.spandrel : S.frame;
        if (ub === 0) return S.frame + IN;
        return pane(n, S.L, fl, f.fid, bay, ub - 1, S.bay - 1, wy, wh) + IN;
      case Cut.Louvre:
        // deep louvre bands across every floor, the glass and its mullions set back behind them
        if (fy === 0) return S.band;
        if (fy === 1) return S.spandrel;
        if (wy % 3 === 0) return S.frame;
        if (ub === 0) return S.frame + IN;
        return pane(n, S.L, fl, f.fid, bay, ub - 1, S.bay - 1, wy, wh) + IN;
      default:
        // the fins stand proud and run the full height; the floor bands sit back with the glass
        if (ub === 0) return S.frame;
        if (fy === 0) return S.band + IN;
        if (fy === 1) return S.spandrel + IN;
        if ((S.bay >= 8 && ub === S.bay >> 1) || (S.transom && wy === wh - 4)) return S.frame + IN;
        return pane(n, S.L, fl, f.fid, bay, ub - 1, S.bay - 1, wy, wh) + IN;
    }
  };
}

function planFoot(plan: Plan, bx: Box): Foot {
  const [x0, z0, x1, z1] = bx;
  const w = x1 - x0, d = z1 - z0;
  const inBox = rectFoot(bx);
  switch (plan) {
    case Plan.Chamfer: {
      const c = Math.max(3, Math.min(12, Math.round(Math.min(w, d) * 0.18)));
      return (x, z) => inBox(x, z) && x - x0 + z - z0 >= c && x1 - x + z - z0 >= c && x - x0 + z1 - z >= c && x1 - x + z1 - z >= c;
    }
    case Plan.Round: {
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rx = w / 2 + 0.45, rz = d / 2 + 0.45;
      return (x, z) => ((x - cx) / rx) ** 2 + ((z - cz) / rz) ** 2 <= 1;
    }
    case Plan.Notch: {
      const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1, sw = Math.max(2, Math.round(Math.min(w, d) / 10)), sd = 4;
      return (x, z) => inBox(x, z) && !(Math.abs(x - cx) <= sw && (z < z0 + sd || z > z1 - sd)) && !(Math.abs(z - cz) <= sw && (x < x0 + sd || x > x1 - sd));
    }
    case Plan.Twin: {
      const alongX = w >= d, mid = alongX ? (x0 + x1) / 2 : (z0 + z1) / 2, gap = Math.max(3, Math.round((alongX ? w : d) * 0.1));
      return (x, z) => inBox(x, z) && Math.abs((alongX ? x : z) - mid) > gap;
    }
    default: return inBox;
  }
}

export interface TowerOpts { screen?: Side; crown?: boolean; ribs?: boolean; front?: Side; blade?: boolean }

/**
 * A tower from layer y0 to y1 on `box`: a plan (square, chamfered, round, notched or split in two), a skin, one to
 * three tiers stepping in, a lift shaft up one face, sometimes a steel exoskeleton or a blade sign the height of
 * several floors, and a crown: a mast, a helipad, a lattice spire, a ring of light, a blade, a billboard or a
 * stepped glass top.
 */
export function tower(b: Builder, n: NC, box: Box, y0: number, y1: number, seed: number, d: District, o: TowerOpts = {}) {
  const g = b.grid, r = rng(seed);
  const S = skinFor(n, r, d, seed);
  S.ribs = o.ribs ?? r() < 0.4;
  const w0 = box[2] - box[0], d0 = box[3] - box[1];
  const big = Math.min(w0, d0);
  let plan = pick<Plan>(r, [Plan.Rect, Plan.Rect, Plan.Chamfer, Plan.Chamfer, Plan.Round, Plan.Notch, Plan.Twin]);
  if (plan === Plan.Round && big < 24) plan = Plan.Chamfer;
  if (plan === Plan.Twin && Math.max(w0, d0) < 44) plan = Plan.Notch;
  const exo = plan !== Plan.Round && r() < 0.12;
  let [x0, z0, x1, z1] = box;
  const tiers = y1 - y0 > 220 ? 3 : y1 - y0 > 120 ? 2 : 1;
  let y = y0;
  const top = y1;
  let foot = planFoot(plan, box);
  for (let t = 0; t < tiers; t++) {
    const yt = t === tiers - 1 ? top : y + Math.round(((top - y0) * (0.45 + r() * 0.2)) / tiers) + (t === 0 ? 20 : 0);
    if (x1 - x0 < 8 || z1 - z0 < 8) break;
    const bx: Box = [x0, z0, x1, z1];
    foot = planFoot(t > 0 && plan === Plan.Twin ? Plan.Rect : plan, bx);
    mass(g, bx, y, yt, foot, n.soot, skinFace(n, S, y0));
    // the roof of the tier: a deck, its parapet lit on a setback
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (foot(x, z)) {
      const edge = !foot(x - 1, z) || !foot(x + 1, z) || !foot(x, z - 1) || !foot(x, z + 1);
      g.set(x, yt, z, edge ? n.parapet : n.steelDark);
      if (edge && t < tiers - 1) g.set(x, yt + 1, z, pm(x + z, 6) < 4 ? S.accent : n.steelDark);
    }
    if (t === 0 && plan === Plan.Twin) twinBridges(b, n, bx, y + 30, yt - 10, S);
    if (t === 0 && exo) exoskeleton(g, n, bx, y, yt, S);
    if (t === 0 && plan !== Plan.Round && r() < 0.45) liftShaft(b, n, bx, y + 2, yt - 4, pick<Side>(r, ['n', 's', 'e', 'w']), seed);
    if (t < tiers - 1) {
      const s = 3 + Math.floor(r() * 5);
      x0 += s; z0 += s; x1 -= s; z1 -= s;
      if (r() < 0.5) x0 += Math.floor(r() * 6); else z1 -= Math.floor(r() * 6);
      if (plan === Plan.Twin) plan = Plan.Rect;
    }
    y = yt + 1;
  }
  if (o.blade ?? ((d === 'neonmile' || d === 'halo' || d === 'lantern') && r() < 0.55)) bladeSign(b, n, box, y0 + 6, Math.min(top - 10, y0 + 50 + Math.floor(r() * 40)), o.front ?? 's', seed);
  if (o.crown ?? true) crown(b, n, [x0, z0, x1, z1], foot, y, seed, S, r);
  if (o.screen) holoScreen(b, n, box, o.screen, y0 + 20 + Math.floor(r() * 20), Math.min(top - 8, y0 + 70 + Math.floor(r() * 40)), seed, plan === Plan.Rect || plan === Plan.Notch ? 0 : 3);
  b.occlude(box[0], box[1], box[2], box[3], Y(top) + 12, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/** Glass skybridges between the two halves of a split tower, every forty-odd floors' worth of voxels. */
function twinBridges(b: Builder, n: NC, bx: Box, ya: number, yb: number, S: Skin) {
  const g = b.grid;
  const [x0, z0, x1, z1] = bx;
  const alongX = x1 - x0 >= z1 - z0;
  const mid = alongX ? (x0 + x1) >> 1 : (z0 + z1) >> 1, gap = Math.max(3, Math.round((alongX ? x1 - x0 : z1 - z0) * 0.1)) + 1;
  const c = alongX ? (z0 + z1) >> 1 : (x0 + x1) >> 1;
  for (let yy = ya; yy < yb; yy += 46) {
    for (let a = mid - gap; a <= mid + gap; a++)
      for (let q = -3; q <= 3; q++)
        for (let h = 0; h <= 8; h++) {
          const side = Math.abs(q) === 3, cap = h === 0 || h === 8;
          const v = cap ? n.steelDark : side ? (a % 4 === 0 ? n.steelDark : h === 7 ? S.accent : n.plazaGlass) : 0;
          if (!v && !(h === 1)) continue;
          const vv = v || n.plazaA;
          if (alongX) g.set(a, yy + h, c + q, vv); else g.set(c + q, yy + h, a, vv);
        }
    b.lamp((alongX ? mid : c) * V, Y(yy + 5), (alongX ? c : mid) * V, NEON_RGB[1], 6, 0.4);
  }
}

/** A steel exoskeleton over a tower's four faces: X bracing over every four floors, a cell proud of the glass. */
function exoskeleton(g: SparseGrid, n: NC, bx: Box, ya: number, yb: number, S: Skin) {
  const [x0, z0, x1, z1] = bx;
  const span = S.FH * 4;
  for (const side of ['n', 's', 'e', 'w'] as Side[]) {
    const ns = side === 'n' || side === 's', a0 = ns ? x0 : z0, a1 = ns ? x1 : z1;
    const e = side === 's' ? z1 + 1 : side === 'n' ? z0 - 1 : side === 'e' ? x1 + 1 : x0 - 1;
    const W = Math.max(8, Math.round((a1 - a0) / Math.max(1, Math.round((a1 - a0) / span))));
    for (let yy = ya; yy < yb; yy++) {
      const t = (yy - ya) % span;
      for (let a = a0; a <= a1; a++) {
        const p = (a - a0) % W, q = Math.round((t / span) * W);
        const on = a === a0 || a === a1 || t === 0 || p === q || p === W - q || p === 0;
        if (!on) continue;
        if (ns) g.set(a, yy, e, n.steel); else g.set(e, yy, a, n.steel);
      }
    }
  }
}

/** A glass lift shaft standing proud of one face, two lit cars somewhere up it. */
function liftShaft(b: Builder, n: NC, bx: Box, ya: number, yb: number, side: Side, seed: number) {
  const g = b.grid;
  const [x0, z0, x1, z1] = bx;
  const ns = side === 'n' || side === 's';
  const len = ns ? x1 - x0 : z1 - z0;
  if (len < 20 || yb - ya < 40) return;
  const a0 = (ns ? x0 : z0) + Math.floor(len * (0.2 + hash3(seed, 1, 9) * 0.5)), a1 = a0 + 4;
  const [ox, oz] = OUT[side];
  const e = side === 's' ? z1 : side === 'n' ? z0 : side === 'e' ? x1 : x0;
  const cars = [ya + Math.floor(hash3(seed, 2, 9) * (yb - ya - 10)), ya + Math.floor(hash3(seed, 3, 9) * (yb - ya - 10))];
  for (let yy = ya; yy < yb; yy++)
    for (let a = a0; a <= a1; a++)
      for (let k = 1; k <= 3; k++) {
        const edge = a === a0 || a === a1 || k === 3;
        const car = cars.some((c) => yy >= c && yy < c + 9) && !(a === a0 || a === a1) && k < 3;
        const v = car ? (yy % 9 === 0 ? n.steelDark : n.office) : (a === a0 || a === a1) && k === 3 ? n.steelDark : edge ? (yy % 14 === 0 ? n.steelDark : n.plazaGlass) : 0;
        if (!v) continue;
        if (ns) g.set(a, yy, e + oz * k, v); else g.set(e + ox * k, yy, a, v);
      }
}

/**
 * A blade sign: a slab of light standing out from a face at its corner, the height of several floors, glyphs in
 * one colour on a field of another, both sides lit; a steel frame and brackets back to the wall.
 */
export function bladeSign(b: Builder, n: NC, bx: Box, ya: number, yb: number, front: Side, seed: number, out = 9) {
  if (yb - ya < 14) return;
  const g = b.grid, r = rng(seed * 17 + 3);
  const [x0, z0, x1, z1] = bx;
  const ns = front === 'n' || front === 's';
  const [ox, oz] = OUT[front];
  const e = front === 's' ? z1 : front === 'n' ? z0 : front === 'e' ? x1 : x0;
  const at = r() < 0.5 ? (ns ? x0 + 2 : z0 + 2) : ns ? x1 - 2 : z1 - 2;
  const ci = Math.floor(r() * 6), field = r() < 0.5 ? n.screenDark : n.neon[(ci + 2) % 6], ink = n.neon[ci];
  const cells = Math.floor((out - 3) / 5) || 1;
  const gr = rng(seed);
  const glyphs: boolean[][][] = [];
  for (let i = 0; i < Math.ceil((yb - ya) / 7); i++) glyphs.push(glyph(gr, 5));
  for (let yy = ya; yy <= yb; yy++)
    for (let k = 1; k <= out; k++) {
      let v: number;
      if (yy === ya || yy === yb || k === out || k === 1) v = n.steelDark;
      else {
        const gi = Math.floor((yb - 2 - yy) / 7), gy = (yb - 2 - yy) % 7, gx = k - 2 - Math.floor((out - 2 - cells * 5) / 2);
        const on = gy < 5 && gx >= 0 && gx < 5 && glyphs[gi]?.[gy]?.[gx];
        v = on ? ink : field === n.screenDark && (yy + k) % 2 === 0 && hash3(k, yy, seed) < 0.06 ? n.neon[(ci + 4) % 6] : field;
      }
      if (ns) g.set(at, yy, e + oz * k, v); else g.set(e + ox * k, yy, at, v);
    }
  // (only the big ones light the street: the small ones glow on their own)
  const mx = ns ? at : e + ox * (out >> 1), mz = ns ? e + oz * (out >> 1) : at;
  if (out >= 8 && yb - ya >= 24) b.lamp(mx * V, Y((ya + yb) >> 1), mz * V, NEON_RGB[ci], 9, 0.55);
}

/** A great holo screen hung on a building's face, banded in slow colour, framed in black; it lights the street. */
export function holoScreen(b: Builder, n: NC, box: Box, side: Side, y0: number, y1: number, seed: number, stand = 0) {
  if (y1 - y0 < 10) return;
  const g = b.grid, r = rng(seed * 3 + 1);
  const [x0, z0, x1, z1] = box;
  const ns = side === 'n' || side === 's';
  const len = ns ? x1 - x0 : z1 - z0;
  const w = Math.min(len - 4, 18 + Math.floor(r() * 18));
  if (w < 8) return;
  const a0 = (ns ? x0 : z0) + Math.floor((len - w) / 2), a1 = a0 + w;
  const out = side === 's' ? 1 : side === 'n' ? -1 : side === 'e' ? 1 : -1;
  const e = (side === 's' ? z1 : side === 'n' ? z0 : side === 'e' ? x1 : x0) + out * (1 + stand);
  const ph = r() * 9, sc = n.screen, motif = Math.floor(r() * 4);
  for (let a = a0; a <= a1; a++)
    for (let y = y0; y <= y1; y++) {
      let v: number;
      if (a === a0 || a === a1 || y === y0 || y === y1) v = n.screenDark;
      else if (motif === 0) { const t = Math.sin((a + ph) * 0.35 + y * 0.12) + Math.cos(y * 0.3 - ph); v = t > 1 ? sc[3] : t > 0 ? sc[seed & 1 ? 0 : 2] : sc[1]; }
      else if (motif === 1) { const cy = (y0 + y1) / 2, ca = (a0 + a1) / 2; const rr = Math.hypot((a - ca) * 1.2, y - cy); v = rr < (y1 - y0) * 0.28 ? sc[3] : pm(Math.floor(rr), 4) < 2 ? sc[1] : sc[0]; }
      else if (motif === 2) {
        // a face in profile, a geisha in a hard light: an oval and a red mouth on a field of blue
        const cy = y0 + (y1 - y0) * 0.55, ca = a0 + w * 0.5, dx = (a - ca) / (w * 0.28), dy = (y - cy) / ((y1 - y0) * 0.36);
        const inF = dx * dx + dy * dy < 1;
        v = inF ? (Math.abs(dx) < 0.25 && Math.abs(dy + 0.45) < 0.07 ? n.neon[0] : dy > 0.35 ? n.screenDark : sc[3]) : (y - y0) % 4 === 0 ? n.screenDark : sc[0];
      }
      else v = pm(Math.floor((y - y0) / 3) + Math.floor((a - a0) / 5), 3) === 0 ? sc[2] : (y - y0) % 3 === 0 ? n.screenDark : sc[seed % 4];
      if (ns) g.set(a, y, e, v); else g.set(e, y, a, v);
      if (stand && (a === a0 || a === a1) && (y - y0) % 10 === 0) for (let k = 1; k <= stand; k++) { if (ns) g.set(a, y, e - out * k, n.steelDark); else g.set(e - out * k, y, a, n.steelDark); }
    }
  const mid = (a0 + a1) / 2, ym = Y((y0 + y1) / 2);
  if (ns) b.lamp(mid * V, ym, (e + out * 8) * V, [0.6, 0.55, 1], 14, 0.8); else b.lamp((e + out * 8) * V, ym, mid * V, [0.6, 0.55, 1], 14, 0.8);
}

/** The top of a tower. */
function crown(b: Builder, n: NC, bx: Box, foot: Foot, y: number, seed: number, S: Skin, r: () => number) {
  const g = b.grid;
  const [x0, z0, x1, z1] = bx;
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1, w = x1 - x0, d = z1 - z0, s = Math.min(w, d);
  const beacon = (x: number, yy: number, z: number) => {
    yy = Math.min(g.sy - 1, yy);
    g.set(x, yy, z, n.beacon);
  };
  // plant on every roof: fan boxes and a few aerials, warning lights at the corners
  for (let i = 0; i < 3 + Math.floor(r() * 3); i++) {
    const a = x0 + 3 + Math.floor(r() * Math.max(1, w - 9)), c = z0 + 3 + Math.floor(r() * Math.max(1, d - 9));
    if (!foot(a, c) || !foot(a + 3, c + 3)) continue;
    g.box(a, y, c, a + 3, y + 2, c + 3, n.acGrey);
    g.set(a + 1, y + 3, c + 1, n.steelDark); g.set(a + 2, y + 3, c + 2, n.steelDark);
  }
  const kind = s < 14 ? 0 : Math.floor(r() * 7);
  switch (kind) {
    case 1: {
      // a helipad: a deck on struts, its edge lit, an H, a windsock mast
      const h = Math.min(s >> 1, 22);
      g.box(cx - h, y + 4, cz - h, cx + h, y + 4, cz + h, (x, _y, z) => (Math.abs(x - cx) === h || Math.abs(z - cz) === h ? (pm(x + z, 4) < 2 ? n.guideCyan : n.steelDark) : n.plazaA));
      for (const [dx, dz] of [[-h + 2, -h + 2], [h - 2, -h + 2], [-h + 2, h - 2], [h - 2, h - 2]]) g.box(cx + dx, y, cz + dz, cx + dx, y + 3, cz + dz, n.steelDark);
      const H = Math.max(3, h >> 2);
      for (let q = -H; q <= H; q++) { g.set(cx - H, y + 5, cz + q, n.hazardY); g.set(cx + H, y + 5, cz + q, n.hazardY); }
      for (let q = -H; q <= H; q++) g.set(cx + q, y + 5, cz, n.hazardY);
      for (let t = 0; t < 64; t++) { const a = (t / 64) * Math.PI * 2, R = h - 3; g.set(Math.round(cx + Math.cos(a) * R), y + 5, Math.round(cz + Math.sin(a) * R), t % 4 ? n.lineW : n.guideCyan); }
      g.box(cx + h, y + 5, cz + h, cx + h, y + 16, cz + h, n.steel);
      beacon(cx + h, y + 17, cz + h);
      b.lamp(cx * V, Y(y + 7), cz * V, [0.5, 0.95, 1], 10, 0.5);
      return;
    }
    case 2: {
      // a lattice spire: four legs tapering to a spike, a ring of steel every few metres, light up the legs
      const H = 40 + Math.floor(r() * 50), base = Math.min(12, s >> 2);
      for (let h = 0; h < H; h++) {
        const q = Math.round(base * (1 - h / H));
        for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.set(cx + sx * q, y + h, cz + sz * q, h % 8 === 4 ? S.accent : n.steel);
        if (h % 8 === 0 && q > 0) for (let a = -q; a <= q; a++) { g.set(cx + a, y + h, cz - q, n.steel); g.set(cx + a, y + h, cz + q, n.steel); g.set(cx - q, y + h, cz + a, n.steel); g.set(cx + q, y + h, cz + a, n.steel); }
      }
      g.box(cx, y + H, cz, cx, y + H + 16, cz, n.chrome);
      beacon(cx, y + H + 17, cz);
      return;
    }
    case 3: {
      // a ring of light over the roof on four struts
      const R = Math.max(5, (s >> 1) - 3);
      for (const [dx, dz] of [[R, 0], [-R, 0], [0, R], [0, -R]]) g.box(cx + dx, y, cz + dz, cx + dx, y + 11, cz + dz, n.steelDark);
      for (let t = 0; t < 360; t += 1.5) { const a = (t * Math.PI) / 180; g.set(Math.round(cx + Math.cos(a) * R), y + 12, Math.round(cz + Math.sin(a) * R), S.accent); g.set(Math.round(cx + Math.cos(a) * R), y + 13, Math.round(cz + Math.sin(a) * R), n.steelDark); }
      g.box(cx, y, cz, cx, y + 30, cz, n.steel);
      beacon(cx, y + 31, cz);
      b.lamp(cx * V, Y(y + 12), cz * V, NEON_RGB[1], 12, 0.5);
      return;
    }
    case 4: {
      // a blade: a thin wall of steel rising off the roof, a light up its leading edge
      const alongX = w >= d, half = Math.max(4, Math.round((alongX ? w : d) * 0.35)), H = 36 + Math.floor(r() * 40);
      for (let h = 0; h < H; h++) {
        const q = Math.round(half * (1 - (h / H) * 0.85));
        for (let a = -q; a <= q; a++) for (const t of [0, 1]) {
          const v = a === q ? S.accent : h % 12 === 0 ? n.steel : n.steelDark;
          if (alongX) g.set(cx + a, y + h, cz + t, v); else g.set(cx + t, y + h, cz + a, v);
        }
      }
      beacon(alongX ? cx : cx, y + H, alongX ? cz : cz);
      return;
    }
    case 5: {
      // a billboard on the roof, on a steel frame, facing south over the city
      const W2 = Math.min(w - 4, 40), H = 22;
      const a0 = cx - (W2 >> 1), a1 = a0 + W2, ph = r() * 9;
      for (let a = a0; a <= a1; a++) {
        for (let h = 0; h <= H; h++) {
          const v = a === a0 || a === a1 || h === 0 || h === H ? n.screenDark : Math.sin((a + ph) * 0.3) + Math.cos(h * 0.4 + ph) > 0.6 ? n.screen[3] : (h + (a >> 2)) % 6 < 3 ? n.screen[seed % 3] : n.screen[(seed + 1) % 3];
          g.set(a, y + 8 + h, cz + 2, v);
        }
        if ((a - a0) % 8 === 0) { g.box(a, y, cz + 3, a, y + 8 + H, cz + 3, n.steelDark); g.box(a, y, cz + 3, a, y + 7, cz + 8, (_x, yy, zz) => (zz - cz - 3 === 7 - (yy - y) ? n.steelDark : 0)); }
      }
      b.lamp(cx * V, Y(y + 18), (cz + 8) * V, [0.6, 0.55, 1], 14, 0.6);
      return;
    }
    case 6: {
      // a stepped glass crown lit from inside, a spire out of it
      let q = Math.max(4, (s >> 1) - 2), yy = y;
      for (let k = 0; k < 5 && q > 2; k++) {
        const lit = k % 2 ? S.L.lit[0] : n.office;
        g.box(cx - q, yy, cz - q, cx + q, yy + 5, cz + q, (x, h, z) => (Math.abs(x - cx) === q || Math.abs(z - cz) === q ? (h === yy + 5 ? S.accent : (x + z) % 4 === 0 ? n.steelDark : lit) : n.soot));
        yy += 6; q -= 3;
      }
      g.box(cx, yy, cz, cx, yy + 22, cz, n.chrome);
      beacon(cx, yy + 23, cz);
      b.lamp(cx * V, Y(yy), cz * V, [0.9, 0.9, 1], 12, 0.6);
      return;
    }
    default: {
      g.box(x0 + 2, y, z0 + 2, x1 - 2, y + 5, z1 - 2, (x, _y, z) => (foot(x, z) ? n.steelDark : 0));
      g.box(x0 + 2, y + 3, z0 + 2, x1 - 2, y + 3, z1 - 2, (x, _y, z) => (foot(x, z) ? S.accent : 0));
      const mh = 16 + Math.floor(r() * 30);
      g.box(cx, y + 6, cz, cx, Math.min(g.sy - 2, y + 6 + mh), cz, n.steel);
      beacon(cx, y + 7 + mh, cz);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Housing megablocks

/**
 * A concrete megablock of flats from layer y0 to y1: a slab, a slab with light wells notched into its faces, or an L;
 * every floor a row of real windows (lit, curtained, dark, barred, boarded), and everything people bolt on: balcony
 * cages, AC units weeping rust down the wall, pipes, rooms built out on brackets, laundry, gallery walkways on the
 * back, a stack of neon signs at the street corner, a lit stair core.
 */
export function megablock(b: Builder, n: NC, box: Box, y0: number, y1: number, seed: number, front: Side, d: District = 'stacks') {
  const g = b.grid, r = rng(seed);
  const [x0, z0, x1, z1] = box;
  const w = x1 - x0, dep = z1 - z0;
  const wall = pick(r, [n.concrete, n.concreteDark, n.tileGrey, n.tileTeal, n.plum, n.soot, n.rustRed, n.navy, n.concrete]);
  const trim = pick(r, [n.concreteDark, n.soot, n.steelDark, n.tileGrey]);
  const FH = 11;
  const litSet = pick(r, [[0, 1], [0, 3], [0, 1, 3], [1, 2]]);
  const LIT = [n.litWarm, n.litCool, n.litGlass, n.sodiumWin], DIM = [n.dimWarm, n.dimCool, n.dimCool, n.dimWarm];
  const L: Light = { lit: litSet.map((i) => LIT[i]), dim: litSet.map((i) => DIM[i]), glass: n.blackGlass, glass2: n.greyGlass, frac: 0.26 + r() * 0.16, floorFrac: 0, seed };
  const shape = Math.min(w, dep) < 26 ? 0 : Math.floor(r() * 3); // 0 slab, 1 light wells, 2 an L
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  const sw = Math.max(2, Math.round(Math.min(w, dep) / 12));
  const foot: Foot = shape === 1
    ? (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && !(Math.abs(x - cx) <= sw && (z < z0 + 5 || z > z1 - 5))
    : shape === 2 ? (x, z) => x >= x0 && x <= x1 && z >= z0 && z <= z1 && !(x > cx + 2 && z < cz - 2)
      : rectFoot(box);
  mass(g, box, y0, y1, foot, n.soot, (f) => {
    const fl = Math.floor((f.y - y0) / FH), fy = (f.y - y0) % FH;
    if (f.corner) return trim;
    const bay = Math.floor((f.u - 2) / 6), bu = (f.u - 2) % 6;
    if (f.u < 2 || f.u > f.len - 2) return trim;
    // each bay's windows sit back in one channel from the street to the roof, the piers between them proud
    const chan = bu >= 1 && bu <= 4 ? IN : 0;
    if (fy === 0) return trim + chan;
    if (fy >= 3 && fy <= 8 && bu >= 1 && bu <= 4) {
      const hv = hash3(fl * 13 + f.fid, bay, seed + 31);
      if (hv < 0.05) return n.corrugated; // boarded up
      if (hv < 0.09) return n.screen[Math.floor(hv * 1000) % 4] + IN; // a screen against the glass
      return pane(n, L, fl, f.fid, bay, bu - 1, 4, fy - 3, 6) + IN;
    }
    if (fy === 2 && bu >= 1 && bu <= 4) return trim + IN; // a sill
    // grime washed down the wall in streaks
    const st = hash3(f.u, f.fid, seed + 7);
    if (st < 0.14 && hash3(f.u, fl, seed + 9) < 0.6 && fy < 7) return n.grime + chan;
    return (hash3(f.u, f.y, f.fid + seed) < 0.05 ? n.soot : wall) + chan;
  });
  g.box(x0, y1, z0, x1, y1, z1, (x, _y, z) => (foot(x, z) ? n.concreteDark : 0));

  // what people bolted on, face by face
  const sides: Side[] = ['s', 'n', 'e', 'w'];
  const gallery: Side | null = r() < 0.4 ? (front === 's' ? 'n' : front === 'n' ? 's' : front === 'e' ? 'w' : 'e') : null;
  for (const side of sides) {
    const ns = side === 'n' || side === 's', a0 = ns ? x0 : z0, a1 = ns ? x1 : z1;
    const [ox, oz] = OUT[side];
    const e = side === 's' ? z1 : side === 'n' ? z0 : side === 'e' ? x1 : x0;
    const at = (a: number, k: number): [number, number] => (ns ? [a, e + oz * k] : [e + ox * k, a]);
    const onFace = (a: number) => { const [fx, fz] = at(a, 0); return foot(fx, fz) && !foot(fx + ox, fz + oz); };
    const put = (a: number, yy: number, k: number, v: number) => { const [px, pz] = at(a, k); g.set(px, yy, pz, v); };
    const busy = side === front ? 0.55 : 0.3;
    if (side === gallery) {
      // open access galleries: a walkway along every floor, a rail, sodium lights over the doors
      for (let fl = 1; (fl + 1) * FH + y0 <= y1; fl++) {
        const yy = y0 + fl * FH;
        for (let a = a0 + 1; a < a1; a++) {
          if (!onFace(a)) continue;
          put(a, yy, 1, n.concreteDark); put(a, yy, 2, n.concreteDark);
          put(a, yy + 3, 2, n.steel);
          if (a % 6 === 0) { put(a, yy + 1, 2, n.steelDark); put(a, yy + 2, 2, n.steelDark); }
          if (a % 12 === 6) put(a, yy + 9, 1, n.sodium);
        }
      }
      continue;
    }
    for (let fl = 1; (fl + 1) * FH + y0 < y1; fl++)
      for (let a = a0 + 3; a + 5 < a1; a += 6) {
        if (!onFace(a) || !onFace(a + 4)) continue;
        const hv = hash3(a, fl, seed + side.charCodeAt(0));
        const yy = y0 + fl * FH;
        if (hv < busy * 0.32) {
          // a balcony cage: a floor slab, bars, sometimes laundry, a pot plant
          for (let u = a; u < a + 5; u++) for (let k = 1; k <= 3; k++) { put(u, yy, k, n.steelDark); put(u, yy + 6, k, n.steelDark); }
          for (const u of [a, a + 2, a + 4]) for (let q = 1; q < 6; q++) put(u, yy + q, 3, n.steel);
          if (hv < busy * 0.14) for (let u = a + 1; u < a + 4; u++) put(u, yy + 2 + Math.floor(hash3(u, fl, 3) * 2), 2, pick(r, [n.laundryA, n.laundryB, n.laundryC]));
          else if (hv < busy * 0.2) { put(a + 1, yy + 1, 2, n.growLeaf); put(a + 1, yy + 2, 2, n.growLeafB); }
        } else if (hv < busy * 0.42 && fl > 1) {
          // a room built out on brackets: corrugated walls, its own lit window, struts under it
          const ww = 5 + Math.floor(hash3(a, fl, 77) * 6), o2 = 2 + Math.floor(hash3(a, fl, 78) * 2);
          const skin = pick(r, [n.corrugated, n.corrugatedB, n.rustBrown, ...n.container.slice(0, 3)]);
          for (let u = a; u < Math.min(a1 - 1, a + ww); u++) {
            if (!onFace(u)) break;
            for (let q = 1; q <= 9; q++) for (let k = 1; k <= o2; k++) {
              const win = k === o2 && q >= 4 && q <= 6 && u > a && u < a + ww - 2;
              put(u, yy + q, k, q === 9 ? n.steelDark : win ? (hash3(u, fl, 5) < 0.6 ? n.litWarm : n.blackGlass) : skin);
            }
            for (let k = 1; k <= o2; k++) if ((u - a) % 4 === 0 && yy - o2 + k > y0) put(u, yy - (o2 - k), k, n.steelDark);
          }
        } else if (hv < busy) {
          // an AC box under the window, rust weeping down the wall under it
          for (let u = a + 1; u < a + 4; u++) for (let q = 1; q <= 2; q++) put(u, yy + q, 1, q === 2 && u === a + 2 ? n.steelDark : n.acGrey);
          for (let q = 1; q <= 5 && yy - q > y0; q++) if (hash3(a, q, fl) < 0.8) put(a + 2, yy - q + 1, 0, q < 3 ? n.rustBrown : n.grime);
        } else if (hv > 0.965) {
          // a neon sign in a window
          const c = n.neon[Math.floor(hv * 600) % 6];
          for (let u = a + 1; u <= a + 3; u++) put(u, yy + 5, 1, c);
        }
      }
    // pipes down the face: a soil stack and a rainwater pipe with their joints, a gas line along a floor
    for (let i = 0; i < 1 + Math.floor(r() * 3); i++) {
      const a = a0 + 2 + 6 * Math.floor(r() * Math.max(1, (a1 - a0 - 4) / 6)) + (i & 1 ? 5 : 0);
      if (!onFace(a)) continue;
      const col = pick(r, [n.pvc, n.pvc, n.rustBrown, n.steelDark]);
      for (let yy = y0 + 2; yy <= y1; yy++) put(a, yy, 1, (yy - y0) % FH === 0 ? n.steelDark : col);
    }
    if (r() < 0.5) {
      const yy = y0 + FH * (1 + Math.floor(r() * 3)) + 10;
      for (let a = a0 + 1; a < a1; a++) if (onFace(a) && yy < y1) put(a, yy, 1, n.yellowSteel);
    }
  }
  // a stack of neon signs out over the street at the front corner
  if ((d === 'lantern' || d === 'neonmile' || d === 'stacks' || d === 'sump') && r() < 0.75) {
    const ns = front === 'n' || front === 's';
    const len = ns ? w : dep;
    if (len >= 20) {
      let yy = y0 + 4;
      for (let k = 0; k < 4 && yy + 12 < y1; k++) {
        const hgt = 8 + Math.floor(r() * 10), out = 6 + Math.floor(r() * 5);
        bladeSign(b, n, box, yy, yy + hgt, front, seed + k * 101, out);
        yy += hgt + 3 + Math.floor(r() * 8);
      }
    }
  }
  // the stair core: a lit slot up one end
  const sx = r() < 0.5 ? x0 : x1;
  for (let yy = y0 + 2; yy < y1 - 2; yy++) if ((yy - y0) % FH > 1) for (let z = cz - 1; z <= cz + 1; z++) if (foot(sx, z)) g.set(sx, yy, z, (yy & 3) === 0 ? n.steelDark : n.sodiumWin);
  b.lamp(sx * V, Y((y0 + y1) >> 1), cz * V, [1, 0.7, 0.4], 8, 0.5);
  b.occlude(x0, z0, x1, z1, Y(y1) + 4, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/** The roof of a mass at layer y: parapet, water tanks, rooftop shacks, fans, dishes, aerials, a garden, a sign. */
export function roofClutter(b: Builder, n: NC, box: Box, y: number, seed: number, d: District) {
  const g = b.grid, r = rng(seed * 5 + 9);
  const [x0, z0, x1, z1] = box;
  if (x1 - x0 < 8 || z1 - z0 < 8) return;
  g.box(x0, y, z0, x1, y, z0, n.parapet); g.box(x0, y, z1, x1, y, z1, n.parapet);
  g.box(x0, y, z0, x0, y, z1, n.parapet); g.box(x1, y, z0, x1, y, z1, n.parapet);
  const spot = (m = 10) => [x0 + 2 + Math.floor(r() * Math.max(1, x1 - x0 - m)), z0 + 2 + Math.floor(r() * Math.max(1, z1 - z0 - m))];
  // water tanks on legs
  for (let i = 0; i < 1 + Math.floor(r() * 2); i++) {
    if (r() > 0.75) continue;
    const [a, c] = spot();
    for (const [dx, dz] of [[0, 0], [5, 0], [0, 5], [5, 5]]) g.box(a + dx, y, c + dz, a + dx, y + 3, c + dz, n.steelDark);
    g.box(a, y + 4, c, a + 5, y + 10, c + 5, (xx, yy, zz) => ((xx === a || xx === a + 5) && (zz === c || zz === c + 5) ? 0 : yy % 3 === 0 ? n.rustBrown : n.tankRust));
    g.box(a + 2, y + 11, c + 2, a + 3, y + 11, c + 3, n.steelDark);
  }
  // a shack someone lives in up here: corrugated walls, a lit window, a door, a strip of neon
  if (r() < 0.55 && x1 - x0 > 20 && z1 - z0 > 16) {
    const [a, c] = spot(16);
    const sk = pick(r, [n.corrugated, n.corrugatedB, n.rustBrown, n.container[1], n.container[3]]);
    g.box(a, y + 1, c, a + 9, y + 9, c + 7, (xx, yy, zz) => (yy === y + 9 ? n.corrugatedB : zz === c + 7 && xx >= a + 5 && xx <= a + 7 && yy <= y + 7 ? n.steelDark : zz === c + 7 && xx >= a + 1 && xx <= a + 3 && yy >= y + 4 && yy <= y + 6 ? n.litWarm : sk));
    g.box(a, y + 10, c + 7, a + 9, y + 10, c + 7, n.neon[Math.floor(r() * 6)]);
  }
  // fan boxes and ducts
  for (let i = 0; i < 2 + Math.floor(r() * 4); i++) {
    const [a, c] = spot();
    g.box(a, y, c, a + 3, y + 2, c + 3, n.acGrey);
    g.set(a + 1, y + 3, c + 1, n.steelDark); g.set(a + 2, y + 3, c + 2, n.steelDark);
    if (r() < 0.4) g.box(a + 4, y + 1, c + 1, a + 4 + Math.floor(r() * 8), y + 1, c + 2, n.steel);
  }
  // an antenna farm, dishes
  if (r() < 0.75) {
    const [a, c] = spot();
    for (let i = 0; i < 2 + Math.floor(r() * 4); i++) g.box(a + i * 2, y, c + (i & 1) * 2, a + i * 2, y + 8 + Math.floor(r() * 18), c + (i & 1) * 2, n.steel);
    if (r() < 0.6) { g.box(a + 8, y + 1, c, a + 8, y + 3, c, n.steelDark); g.box(a + 7, y + 3, c - 1, a + 9, y + 5, c - 1, n.chrome); }
  }
  // a laundry line, a garden in tubs
  if (r() < 0.5) {
    const [a, c] = spot(14);
    g.box(a, y + 1, c, a, y + 6, c, n.steelDark); g.box(a + 10, y + 1, c, a + 10, y + 6, c, n.steelDark);
    for (let u = a + 1; u < a + 10; u++) g.set(u, y + 5 + (u % 3 === 0 ? 0 : -1) , c, pick(r, [n.laundryA, n.laundryB, n.laundryC, 0]));
  }
  if (r() < 0.35) {
    const [a, c] = spot(12);
    g.box(a, y + 1, c, a + 7, y + 1, c + 3, n.soil);
    for (let u = a; u <= a + 7; u++) for (let q = c; q <= c + 3; q++) if (hash3(u, q, seed) < 0.6) g.box(u, y + 2, q, u, y + 2 + Math.floor(hash3(q, u, 2) * 3), q, hash3(u, q, 1) < 0.5 ? n.growLeaf : n.growLeafB);
  }
  // a rooftop sign in big neon glyphs, facing the street below
  if ((d === 'neonmile' || d === 'lantern' || d === 'halo' || d === 'stacks') && r() < (d === 'stacks' ? 0.3 : 0.5)) {
    const col = n.neon[Math.floor(r() * 6)], gr = rng(seed);
    const cnt = Math.min(5, Math.floor((x1 - x0 - 4) / 7));
    for (let i = 0; i < cnt; i++) {
      const gl = glyph(gr, 5);
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (gl[4 - yy][xx]) g.set(x0 + 3 + i * 7 + xx, y + 4 + yy * 2, z1 - 2, col), g.set(x0 + 3 + i * 7 + xx, y + 5 + yy * 2, z1 - 2, col);
      g.box(x0 + 3 + i * 7 + 2, y, z1 - 2, x0 + 3 + i * 7 + 2, y + 3, z1 - 2, n.steelDark);
    }
    b.lamp((x0 + x1) * 0.5 * V, Y(y + 8), (z1 + 2) * V, NEON_RGB[Math.floor(r() * 6)], 9, 0.6);
  }
}

// ---------------------------------------------------------------------------------------------
// Showpieces

/**
 * The arcology on the ridge: a stepped pyramid of lit offices laid over a whole block above its shop fronts, a
 * terrace at every step lit along its edge, four lift spines standing straight up its sloping faces, flare stacks
 * burning on its shoulders and a lit pavilion at the apex.
 */
export function arcology(b: Builder, n: NC, box: Box, inside: Foot, y0: number, yMax: number, seed: number) {
  const g = b.grid;
  let [x0, z0, x1, z1] = box;
  const S: Skin = { cut: Cut.Punched, bay: 6, FH: 14, frame: n.steelDark, band: n.soot, spandrel: n.soot, wall: n.basaltDark, accent: n.sodium, ribs: false, mech: 0, transom: false,
    L: { lit: [n.litWarm, n.sodiumWin], dim: [n.dimWarm, n.dimWarm], glass: n.bronzeGlass, glass2: n.blackGlass, frac: 0.7, floorFrac: 0.15, seed } };
  const step = 12, inset = 4;
  let y = y0, k = 0;
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  const at = (k: number): Foot => { const e = k * inset; return (x, z) => x >= box[0] + e && x <= box[2] - e && z >= box[1] + e && z <= box[3] - e && inside(x, z); };
  // its podium: everything under the first step down to the roofs and the ground below is built in, its outer
  // face banded and lit like the floors over it
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, z) || x < g.wx0 || x >= g.wx1 || z < g.wz0 || z >= g.wz1) continue;
      const edge = !inside(x - 1, z) || !inside(x + 1, z) || !inside(x, z - 1) || !inside(x, z + 1);
      for (let yy = y0 - 1; yy > 0 && yy > y0 - 240 && !g.get(x, yy, z); yy--)
        g.set(x, yy, z, !edge ? n.soot : pm(y0 - yy, 14) < 2 ? n.steelDark : pm(x + z, 12) === 0 ? n.sodiumWin : hash3(x >> 2, yy >> 3, seed) < 0.3 ? n.dimWarm : n.basaltDark);
    }
  while (x1 - x0 > 14 && z1 - z0 > 14 && y + step < yMax) {
    const f = at(k);
    mass(g, [x0, z0, x1, z1], y, y + step, f, n.soot, skinFace(n, S, y0), false);
    // the terrace: basalt pavers, its edge lit in sodium
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (f(x, z)) {
      const edge = !f(x - 1, z) || !f(x + 1, z) || !f(x, z - 1) || !f(x, z + 1);
      g.set(x, y + step, z, edge ? (pm(x + z, 3) ? n.sodium : n.steelDark) : n.basalt);
    }
    x0 += inset; z0 += inset; x1 -= inset; z1 -= inset; y += step + 1; k++;
  }
  const top = y, fTop = at(k);
  // the spines: a lit lift slot up the middle of each face, standing on the first step's edge
  const spine = (ax: number, az: number, dx: number, dz: number) => {
    // walk in from the box edge to the mass
    let e = 0;
    while (e < 40 && !inside(ax + dx * e, az + dz * e)) e++;
    if (e >= 40) return;
    const px = dx ? -dz : 1, pz = dx ? 1 : 0; // along the face
    for (let yy = y0; yy < top - 4; yy++) {
      const lvl = Math.floor((yy - y0) / (step + 1)), into = lvl * inset;
      for (let q = -3; q <= 3; q++) {
        const fx = ax + dx * e + px * q, fz = az + dz * e + pz * q;
        if (!inside(fx, fz)) continue;
        const v = Math.abs(q) === 3 ? n.basaltDark : (yy - y0) % 14 < 2 ? n.steelDark : Math.abs(q) < 2 ? n.office : n.steelDark;
        // the shaft stands free of the receding steps, tied back to them by a bridge every few floors
        for (let kk = 1; kk <= 2; kk++) g.set(fx + dx * kk, yy, fz + dz * kk, v === n.office ? n.steelDark : v);
        g.set(fx, yy, fz, v);
        if (Math.abs(q) <= 1 && pm(yy - y0, 45) < 5) for (let kk = 3; kk <= into + inset - e; kk++) g.set(fx + dx * kk, yy, fz + dz * kk, pm(yy - y0, 45) === 4 ? n.sodium : n.steelDark);
      }
    }
  };
  spine(cx, box[1], 0, 1); spine(cx, box[3], 0, -1); spine(box[0], cz, 1, 0); spine(box[2], cz, -1, 0);
  // flare stacks on the shoulders of the second step
  const ly = y0 + (step + 1) * 2;
  for (const [fx, fz] of [[box[0] + 8, box[1] + 8], [box[2] - 8, box[1] + 8], [box[0] + 8, box[3] - 8], [box[2] - 8, box[3] - 8]]) {
    if (!at(2)(fx, fz) || at(3)(fx, fz)) continue;
    g.box(fx, ly, fz, fx + 1, ly + 18, fz + 1, n.steelDark);
    g.box(fx, ly + 19, fz, fx + 1, ly + 21, fz + 1, n.sodium);
    g.set(fx, ly + 22, fz, n.flood);
    b.lamp(fx * V, Y(ly + 21), fz * V, [1, 0.6, 0.25], 12, 0.9);
  }
  // the apex: a lit pavilion and a mast
  g.box(x0, top, z0, x1, top + 8, z1, (x, yy, z) => (!fTop(x, z) ? 0 : !fTop(x - 1, z) || !fTop(x + 1, z) || !fTop(x, z - 1) || !fTop(x, z + 1) ? (yy === top + 8 ? n.sodium : (x + z) % 3 === 0 ? n.steelDark : n.litWarm) : n.soot));
  g.box(cx, top + 9, cz, cx, Math.min(g.sy - 3, top + 40), cz, n.chrome);
  g.set(cx, Math.min(g.sy - 2, top + 41), cz, n.beacon);
  b.lamp(cx * V, Y(top + 4), cz * V, [1, 0.75, 0.45], 18, 0.8);
  b.lamp(cx * V, Y((y0 + top) >> 1), (box[3] + 6) * V, [1, 0.7, 0.4], 16, 0.6);
  b.lamp(cx * V, Y((y0 + top) >> 1), (box[1] - 6) * V, [1, 0.7, 0.4], 16, 0.6);
  return top;
}

/**
 * The Halcyon Aquarium: a tank the size of a building standing on the Halo, glass on every side and water behind,
 * kelp rising from the sand, reefs, shoals, jellyfish, and a whale shark gliding past the front.
 */
export function aquarium(b: Builder, n: NC, box: Box, y0: number, y1: number, front: Side, seed: number) {
  const g = b.grid;
  const [x0, z0, x1, z1] = box;
  const H = y1 - y0;
  const fr = FID[front];
  const ink = (u: number, h: number, fid: number, len: number): number => {
    // the whale shark across the front: a long dark body, white spots, a tall tail
    if (fid === fr) {
      const su = len * 0.46, sh = H * 0.55, L = len * 0.32;
      const du = (u - su) / L, dh = (h - sh) / 7;
      if (du * du + dh * dh < 1) return (pm(u, 5) === 0 && pm(h, 4) === 1) || (pm(u + 2, 5) === 0 && pm(h, 4) === 3) ? n.spot : dh > 0.35 ? n.sharkTop : n.shark;
      const tu = u - (su - L);
      if (tu < 0 && tu > -9 && Math.abs(h - sh) < -tu * 1.2 + 1 && Math.abs(h - sh) > -tu * 0.4) return n.shark;
      if (Math.abs(u - su + 2) < 4 - (h - sh - 7) * 0.6 && h > sh + 6 && h < sh + 12) return n.shark;
    }
    // sand and rock on the floor, coral heads
    const floor = 4 + Math.round(Math.sin(u * 0.21 + fid) * 2 + Math.sin(u * 0.07) * 2);
    if (h < floor) return hash3(u, h, fid) < 0.2 ? n.rubble : n.sand;
    if (h < floor + 6 && hash3(u >> 2, fid, seed) < 0.35) { const cc = hash3(u, h >> 1, 7); return cc < 0.45 ? n.coral : cc < 0.7 ? n.coralB : 0; }
    // kelp, swaying up from the sand
    const sway = Math.round(Math.sin(h * 0.16 + u * 0.4) * 1.5);
    if (pm(u + sway, 13) < 2 && h < H * (0.5 + hash3(Math.floor((u + sway) / 13), fid, 3) * 0.4)) return pm(h, 5) === 0 ? n.kelpB : n.kelp;
    // shoals and fish, one to a cell of the glass
    const cu = Math.floor(u / 16), ch = Math.floor(h / 10), hv = hash3(cu, ch * 4 + fid, seed + 41);
    if (hv < 0.42 && ch > 0) {
      const fx = cu * 16 + 4 + Math.floor(hash3(cu, ch, 2) * 8), fy = ch * 10 + 3 + Math.floor(hash3(ch, cu, 3) * 4);
      const dirR = hash3(cu, ch, 4) < 0.5 ? 1 : -1, L = 3 + Math.floor(hv * 10) % 4;
      const du = (u - fx) * dirR, dh = h - fy;
      const fc = [n.fishO, n.fishY, n.fishS, n.fishB][Math.floor(hv * 97) % 4];
      if (hv < 0.12) { const jd = Math.hypot(u - fx, (h - fy) * 1.4); if (jd < 3 && h >= fy) return n.jelly; if (h < fy && h > fy - 6 && pm(u - fx, 2) === 0 && Math.abs(u - fx) < 3) return n.jellyB; }
      else if (hv < 0.2) { if (pm(u - fx, 3) === 0 && pm(h - fy, 2) === 0 && Math.abs(u - fx) < 9 && Math.abs(h - fy) < 4) return n.fishS; }
      else {
        if (Math.abs(dh) <= (du > -L && du < L ? 1 : 0) && du > -L && du <= L) return du === L - 1 && dh === 1 ? n.screenDark : fc;
        if (du === -L - 1 && Math.abs(dh) <= 1) return fc;
      }
    }
    // bubbles
    if (pm(u, 29) === 7 && hash3(u, h >> 1, 5) < 0.3 && h % 3 === 0) return n.caustic;
    return 0;
  };
  mass(g, box, y0, y1, rectFoot(box), n.water[0], (f) => {
    const h = f.y - y0;
    if (f.corner || h < 2 || h >= H - 3) return n.steelDark;
    if (h === 2 || h === H - 4) return n.guideCyan;
    if (f.u % 24 === 0) return n.steel;
    const v = ink(f.u, h - 3, f.fid, f.len);
    if (v) return v;
    if (h > H - 10 && pm(f.u + h * 3, 7) === 0) return n.caustic;
    const t = h / H + (hash3(f.u >> 1, h >> 1, f.fid) - 0.5) * 0.12;
    return t > 0.78 ? n.water[3] : t > 0.52 ? n.water[2] : t > 0.25 ? n.water[1] : n.water[0];
  });
  // the cap: a steel band with the name in cyan glyphs over the front
  g.box(x0, y1, z0, x1, y1 + 1, z1, n.steelDark);
  const ns = front === 'n' || front === 's', len = ns ? x1 - x0 : z1 - z0, gr = rng(2040_07);
  const e = front === 's' ? z1 + 1 : front === 'n' ? z0 - 1 : front === 'e' ? x1 + 1 : x0 - 1;
  const cnt = Math.min(7, Math.floor((len - 6) / 7)), a0 = (ns ? x0 : z0) + Math.floor((len - cnt * 7) / 2);
  for (let i = 0; i < cnt; i++) {
    const gl = glyph(gr, 5);
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (gl[4 - yy][xx]) { const a = a0 + i * 7 + xx; if (ns) g.set(a, y1 - 9 + yy, e, n.neon[1]); else g.set(e, y1 - 9 + yy, a, n.neon[1]); }
  }
  // blue light out over the square, and up the tank
  const mid = ((ns ? x0 + x1 : z0 + z1) / 2) * V, out = (e + (front === 's' || front === 'e' ? 5 : -5)) * V;
  for (const hy of [2.5, Y(y0 + (H >> 1)) - Y(y0) + 0]) {
    if (ns) b.lamp(mid, Y(y0) + hy, out, [0.25, 0.6, 1], 14, 0.9); else b.lamp(out, Y(y0) + hy, mid, [0.25, 0.6, 1], 14, 0.9);
  }
  b.occlude(x0, z0, x1, z1, Y(y1) + 1, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/**
 * A megamall groundscraper roofing a whole block over its shop fronts: three floors of lit storefronts behind sign
 * fascias and giant screens, lit soffit and steel columns under it where the buildings below are lower, and on top
 * a garden plaza round a glass barrel vault over the atrium, the towers of the block rising through it.
 */
export function megamall(b: Builder, n: NC, box: Box, inside: Foot, yA: number, floors: number, seed: number) {
  const g = b.grid, r = rng(seed);
  const FH = 16, yB = yA + floors * FH;
  const [x0, z0, x1, z1] = box;
  const brand = n.neon[Math.floor(r() * 6)];
  const SL = [n.litWarm, n.office, n.pinkLit, n.litCool, n.sodiumWin];
  mass(g, box, yA, yB, inside, n.soot, (f) => {
    const fl = Math.floor((f.y - yA) / FH), fy = (f.y - yA) % FH;
    if (f.corner) return fy === 1 ? brand : n.steelDark;
    if (fy === 0) return n.steelDark;
    if (fy === 1) return brand;
    const store = Math.floor(f.u / 28), su = f.u % 28, hs = hash3(store, fl * 4 + f.fid, seed);
    if (su < 2) return n.steel;
    // a screen the height of the floor, or the whole facade on the top floor's corner stores
    if (hs < 0.16 || (fl === floors - 1 && hs < 0.3)) {
      const t = Math.sin(su * 0.4 + store) + Math.cos(fy * 0.5 + fl);
      return fy === 15 || su === 27 ? n.screenDark : t > 0.9 ? n.screen[3] : t > -0.2 ? n.screen[store % 3] : n.screen[(store + 1) % 3];
    }
    if (fy <= 4) {
      // the store's sign over its window
      if (fy === 2 || fy === 4 || su === 27) return n.screenDark;
      return hash3(f.u, fl, seed + store) < 0.6 ? n.neon[Math.floor(hs * 600) % 6] : n.screenDark;
    }
    if (su % 5 === 1) return n.steelDark + IN;
    const lit = SL[Math.floor(hs * 97) % SL.length];
    if (fy === 8 || fy === 12) return n.dimWarm + IN; // shelves and racks inside
    if (fy < 8 && pm(f.u * 7 + fy, 11) === 0) return n.soot + IN; // a shopper
    return lit + IN;
  }, false);
  // the lit soffit and the columns down onto the roofs below
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, z) || x < g.wx0 || x >= g.wx1 || z < g.wz0 || z >= g.wz1) continue;
      g.set(x, yA, z, pm(x, 8) < 2 && pm(z, 8) < 2 ? n.flood : n.steelDark);
      if (pm(x, 24) < 2 && pm(z, 24) < 2) {
        for (let yy = yA - 1; yy > yA - 140 && yy > 0 && !g.get(x, yy, z); yy--) g.set(x, yy, z, n.steelDark);
      }
    }
  // the roof: pavers, a lit parapet, a glass barrel vault along the block, trees in planters, lamps
  const alongX = x1 - x0 >= z1 - z0;
  const mid = alongX ? (z0 + z1) / 2 : (x0 + x1) / 2, R = Math.min(12, Math.floor(((alongX ? z1 - z0 : x1 - x0) / 2) * 0.4));
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, z) || x < g.wx0 || x >= g.wx1 || z < g.wz0 || z >= g.wz1) continue;
      if (g.get(x, yB, z)) continue; // a tower rises through here
      const edge = !inside(x - 1, z) || !inside(x + 1, z) || !inside(x, z - 1) || !inside(x, z + 1);
      g.set(x, yB, z, (pm(x >> 1, 2) + pm(z >> 1, 2)) & 1 ? n.plazaA : n.plazaB);
      if (edge) { g.set(x, yB + 1, z, n.parapet); g.set(x, yB + 2, z, pm(x + z, 8) === 0 ? n.guideCyan : n.steelDark); continue; }
      const dd = Math.abs((alongX ? z : x) - mid), along = alongX ? x : z;
      if (dd <= R) {
        const h = Math.round(Math.sqrt(R * R - dd * dd) * 0.75);
        for (let q = 1; q <= h; q++) g.set(x, yB + q, z, q === h ? (pm(along, 6) === 0 ? n.steelDark : n.plazaGlass) : pm(along, 6) === 0 && q > h - 2 ? n.steelDark : n.office);
      } else if (pm(along, 20) === 0 && dd > R + 3 && pm(Math.floor(dd), 10) === 4) {
        g.set(x, yB + 1, z, n.steelDark);
        for (let q = 2; q < 12; q++) g.set(x, yB + q, z, n.steelDark);
        g.set(x, yB + 12, z, n.flood);
      }
    }
  // trees in planters on the plaza (pure positions on a grid, so every strip agrees)
  for (let z = z0 + 8; z <= z1 - 8; z += 22)
    for (let x = x0 + 8; x <= x1 - 8; x += 22) {
      const dd = Math.abs((alongX ? z : x) - mid);
      if (dd <= R + 4 || !inside(x - 4, z - 4) || !inside(x + 4, z + 4) || !inside(x - 4, z + 4) || !inside(x + 4, z - 4)) continue;
      if (hash3(x, z, seed) < 0.3) continue;
      g.box(x - 3, yB + 1, z - 3, x + 3, yB + 2, z + 3, (xx, _y, zz) => (Math.abs(xx - x) === 3 || Math.abs(zz - z) === 3 ? n.steelDark : n.moss));
      tree(b, x - 1, z - 1, seed + x * 31 + z, 'keyaki', yB + 3, 10, 0.8);
    }
  // its name on the roof edge, facing south, and light down the facades
  const gr = rng(seed + 5), cnt = Math.min(6, Math.floor((x1 - x0 - 10) / 9));
  const sz = z1 - 1;
  for (let i = 0; i < cnt; i++) {
    const gl = glyph(gr, 5), ax = x0 + 6 + i * 9;
    if (!inside(ax, sz) || !inside(ax + 6, sz)) continue;
    for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (gl[4 - yy][xx]) for (const dy of [0, 1]) g.set(ax + xx, yB + 4 + yy * 2 + dy, sz, brand);
  }
  const ci = n.neon.indexOf(brand);
  for (let i = 0; i < 6; i++) {
    const t = i / 6, x = x0 + (x1 - x0) * (0.1 + 0.8 * hash3(i, seed, 1)), z = z0 + (z1 - z0) * (0.1 + 0.8 * t);
    if (inside(Math.round(x), Math.round(z))) b.lamp(x * V, Y(yA - 3), z * V, [1, 0.95, 0.85], 10, 0.5);
  }
  b.lamp(((x0 + x1) / 2) * V, Y(yB + 6), ((z0 + z1) / 2) * V, NEON_RGB[ci < 0 ? 0 : ci], 20, 0.6);
  b.lamp(((x0 + x1) / 2) * V, Y(yB + 4), mid * V, [0.9, 0.95, 1], 14, 0.5);
  return yB;
}
