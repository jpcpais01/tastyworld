import { hash3 } from './grid';
import { G, V } from './layout';
import { WARM, WHITEWARM } from './tokyo';
import { Prop } from './props';
import { SWAY } from './sway';
import { K, col, layerOf, inMap, hillY, type PathSeg, type LotPlan } from './istanbulPlan';
import { Frame, pm, almasik, foodRoom, type Ctx, type IC2, type Use } from './istanbul';

/**
 * Istanbul's two covered markets: the Grand Bazaar's painted halls on their ridge and the Spice Bazaar's L by the
 * water. Each hall is a pointed barrel vault on transverse arches striped in two colours, springing from a
 * clerestory wall over the shop fronts; a dome stands over every crossing, an open skylight lets the sun into
 * every bay, and the floor is laid in flagstones with a marble band under each arch and an inlaid star under
 * each dome. The shops are packed to the ceiling with what each trade sells, and spill out under the arches.
 *
 * Everything here is worked out from the ground plan (never from the grid), so every world strip agrees.
 */

// ------------------------------------------------------------------------------------------- the halls' geometry

interface Hall {
  s: PathSeg;
  grand: boolean;
  alongX: boolean;
  /** The hall's axis: z for a hall along x, x for one along z (m). */
  axis: number;
  /** Along-axis coordinates (m) of the segment's ends a and b, and their floor heights. */
  pa: number; pb: number; ya: number; yb: number;
  /** Covered extent along the axis (m), past the ends where the vault runs on to a gate. */
  lo: number; hi: number;
  half: number; r: number;
  /** Spring of the vault above the floor (m) and its rise to the crown. */
  spring: number; rise: number;
  /** Transverse arches (along-axis m) and the bay centres between them, each with its skylight. */
  ribs: number[]; bays: number[];
  /** A dead end (no gate, no street): closed with a fountain wall. */
  deadLo: boolean; deadHi: boolean;
}

interface Dome { x: number; z: number; y: number; R: number; spring: number; rise: number; grand: boolean }

/** The gates at the hall ends: [x, z, floor y or null for the hill, across x, grand]. */
const GATES: [number, number, number | null, boolean, boolean][] = [
  [-12, 30.2, 1.0, false, false], [-12, -13.8, null, false, false], [-62.2, 25, 1.0, true, false],
  [-101.8, -60, 11.5, true, true], [-101.8, -80, 11.5, true, true], [-114, -42.2, 11.5, false, true], [-138, -42.2, 11.5, false, true],
];

/** Where the light is warm and the lamps lit all day: the Grand Bazaar on its ridge, the Spice Bazaar's two arms. */
export const WARM_ZONES: [number, number, number, number, number][] = [
  [-153, -101, -101, -41, 11.5 + 8.2], [-62.6, 18.5, -8.5, 31.5, 10], [-18.6, -14.5, -5.4, 31.5, 10],
];

let cache: { segs: PathSeg[]; halls: Hall[]; domes: Dome[] } | null = null;

/** The halls and crossing domes of the plan, worked out once. */
export function hallsOf(segs: PathSeg[]): { halls: Hall[]; domes: Dome[] } {
  if (cache && cache.segs === segs) return cache;
  const hs = segs.filter((s) => s.kind === K.Covered && s.roof);
  const key = (x: number, z: number) => `${Math.round(x * 4)},${Math.round(z * 4)}`;
  const at = new Map<string, PathSeg[]>();
  for (const s of segs) for (const p of [s.a, s.b]) { const k = key(p[0], p[2]); if (!at.has(k)) at.set(k, []); at.get(k)!.push(s); }
  const axisOf = (s: PathSeg) => Math.abs(s.b[0] - s.a[0]) >= Math.abs(s.b[2] - s.a[2]);
  // the crossings: where a hall along x meets one along z
  const domes: Dome[] = [];
  const crossKeys = new Set<string>();
  for (const [k, list] of at) {
    const h = list.filter((s) => s.kind === K.Covered && s.roof);
    if (!h.some(axisOf) || !h.some((s) => !axisOf(s))) continue;
    const s = h[0], p = key(s.a[0], s.a[2]) === k ? s.a : s.b;
    const r = s.w / 2 + 0.5, R = r * 1.45;
    const rise0 = r * 0.7;
    crossKeys.add(k);
    domes.push({ x: p[0], z: p[2], y: p[1], R, spring: s.roof! - rise0, rise: R * 0.78, grand: s.bazaar === 'grand' });
  }
  const halls: Hall[] = hs.map((s) => {
    const alongX = axisOf(s);
    const pa = alongX ? s.a[0] : s.a[2], pb = alongX ? s.b[0] : s.b[2];
    const half = s.w / 2, r = half + 0.5, rise = r * 0.7;
    const end = (p: [number, number, number], along: number, dir: number) => {
      const k = key(p[0], p[2]);
      const others = (at.get(k) ?? []).filter((o) => o !== s);
      const cross = crossKeys.has(k);
      const straight = others.some((o) => o.kind === K.Covered && o.roof && axisOf(o) === alongX);
      if (cross) return { ext: straight ? 0 : r * 1.45, rib: r * 1.45, dead: false };
      if (straight) return { ext: 0, rib: 0, dead: false };
      // an open end runs on to its gate, if one stands in line
      const gate = GATES.find(([gx, gz, , gAlongX]) => gAlongX === alongX && Math.abs((alongX ? gz : gx) - (alongX ? s.a[2] : s.a[0])) < 1 && (((alongX ? gx : gz) - along) * dir) > 0 && Math.abs((alongX ? gx : gz) - along) < 7);
      if (gate) return { ext: Math.abs((alongX ? gate[0] : gate[1]) - along) + 0.2, rib: 0.4, dead: false };
      if (others.length) return { ext: r, rib: 0.4, dead: false };
      return { ext: 2.2, rib: 0.4, dead: true };
    };
    const lowA = pa <= pb;
    const eA = end(s.a, pa, lowA ? -1 : 1), eB = end(s.b, pb, lowA ? 1 : -1);
    const eLo = lowA ? eA : eB, eHi = lowA ? eB : eA;
    const p0 = Math.min(pa, pb), p1 = Math.max(pa, pb);
    const lo = p0 - eLo.ext, hi = p1 + eHi.ext;
    // the arches, evenly spaced some four metres apart between the crossings' arches and the ends
    const r0 = eLo.rib > 1 ? p0 + eLo.rib : lo + eLo.rib, r1 = eHi.rib > 1 ? p1 - eHi.rib : hi - eHi.rib;
    const n = Math.max(1, Math.round((r1 - r0) / (s.bazaar === 'grand' ? 4 : 4.5)));
    const ribs = Array.from({ length: n + 1 }, (_, i) => r0 + ((r1 - r0) * i) / n);
    const bays = ribs.slice(1).map((v, i) => (v + ribs[i]) / 2);
    return {
      s, grand: s.bazaar === 'grand', alongX, axis: alongX ? s.a[2] : s.a[0], pa, pb, ya: s.a[1], yb: s.b[1], lo, hi, half, r,
      spring: s.roof! - rise, rise, ribs, bays, deadLo: eLo.dead, deadHi: eHi.dead,
    };
  });
  cache = { segs, halls, domes };
  return cache;
}

const floorOf = (h: Hall, p: number) => { const t = Math.max(0, Math.min(1, (p - h.pa) / ((h.pb - h.pa) || 1))); return h.ya + (h.yb - h.ya) * t; };
/** The vault's pointed profile: 1 at the crown, 0 at the springing (q = distance from the axis / half span). */
const prof = (q: number) => 0.82 * Math.sqrt(Math.max(0, 1 - q * q)) + 0.18 * (1 - q);
const nearest = (list: number[], v: number) => { let best = 1e9; for (const x of list) if (Math.abs(x - v) < Math.abs(best)) best = x - v; return best; };

/** What stands over a column: the hall that wins it, where in it the column is, and the ceiling's layer. */
interface Over { h: Hall | null; dome: Dome | null; p: number; v: number; floor: number; ceil: number; ring: boolean }

function overAt(halls: Hall[], domes: Dome[], x: number, z: number): Over | null {
  const mx = (x + 0.5) * V, mz = (z + 0.5) * V;
  let best: Over | null = null, bestQ = 9, ceilMax = -1;
  let ring: Over | null = null;
  for (const h of halls) {
    const p = h.alongX ? mx : mz, v = (h.alongX ? mz : mx) - h.axis;
    if (p < h.lo || p > h.hi) continue;
    const d = Math.abs(v), fl = floorOf(h, p);
    if (d <= h.r) {
      const q = d / h.r;
      const ceil = layerOf(fl) + Math.round((h.spring + h.rise * prof(q)) / V);
      ceilMax = Math.max(ceilMax, ceil);
      if (q < bestQ) { bestQ = q; best = { h, dome: null, p, v, floor: layerOf(fl), ceil, ring: false }; }
    } else if (d <= h.r + 0.55 && !ring) ring = { h, dome: null, p, v, floor: layerOf(fl), ceil: layerOf(fl) + Math.round(h.spring / V), ring: true };
  }
  if (best) best.ceil = ceilMax;
  for (const dm of domes) {
    const rho = Math.hypot(mx - dm.x, mz - dm.z);
    if (rho > dm.R || !best) continue;
    const ceil = layerOf(dm.y) + Math.round((dm.spring + dm.rise * Math.sqrt(Math.max(0, 1 - (rho / dm.R) ** 2))) / V);
    if (ceil >= best.ceil) { best.ceil = ceil; best.dome = dm; }
  }
  return best ?? ring;
}

/** The hall over a column of the plan (for the floor and anyone who asks), or null. */
export function hallAt(segs: PathSeg[], x: number, z: number): Over | null {
  const { halls, domes } = hallsOf(segs);
  return overAt(halls, domes, x, z);
}

// ------------------------------------------------------------------------------------------- floors

/**
 * The top of a hall's floor at voxel column (x, z): flagstones in running bond across the hall, a marble band
 * under every arch, a threshold of marble before the shops, an inlaid star under each dome.
 */
export function hallFloor(c: IC2, segs: PathSeg[], x: number, z: number): number {
  const o = hallAt(segs, x, z);
  const h = o?.h;
  if (!o || !h) return (x + z) % 7 === 0 ? c.floorD : c.floorA;
  const mx = (x + 0.5) * V, mz = (z + 0.5) * V;
  for (const dm of hallsOf(segs).domes) {
    const rho = Math.hypot(mx - dm.x, mz - dm.z);
    if (rho > dm.R - 0.6) continue;
    // the star: eight points of white marble on grey, a red heart, a green ring, a border of dark stone
    const th = Math.atan2(mz - dm.z, mx - dm.x);
    const rr = rho / (dm.R - 0.6);
    if (rr > 0.9) return c.floorD;
    if (rr > 0.8) return c.marbleRed;
    if (rr < 0.12) return c.marbleRed;
    if (rr < 0.22) return c.marbleGreen;
    const star = 0.62 + 0.22 * Math.cos(th * 8);
    return rr < star ? (rr < star - 0.12 ? c.marble : c.gold) : c.marbleGrey;
  }
  const d = Math.abs(o.v);
  const vi = Math.floor(o.v / V), pi = Math.floor(o.p / V);
  if (d > h.half - 0.25) return d > h.half ? c.marbleGrey : c.floorD; // threshold, and its kerb
  const rib = nearest(h.ribs, o.p);
  if (Math.abs(rib) < 0.25) return h.grand ? c.marble : c.marbleRed;
  if (Math.abs(rib) < 0.5) return c.marbleGrey;
  // flagstones: courses of four cells across, six along, every other course set over by half a stone
  const course = Math.floor((vi + 64) / 4);
  const stone = Math.floor((pi + (course & 1) * 3) / 6);
  const n = hash3(stone, course, 41);
  const tones = h.grand ? [c.floorA, c.floorB, c.floorC, c.floorA, c.floorD] : [c.floorC, c.floorA, c.floorC, c.floorB, c.marbleGrey];
  // and a few worn into a darker hollow down the middle, where everyone walks
  if (d < 0.75 && hash3(pi, vi, 43) < 0.08) return c.floorD;
  return tones[Math.floor(n * tones.length)];
}

// ------------------------------------------------------------------------------------------- the halls

/** The vaults, domes, arches, skylights, lamps and gates of both bazaars. */
export function halls(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const { halls: hs, domes } = hallsOf(plan.segs);
  const shafts = b.shafts;
  // the cutaway and the light: one occluder and one soft indoor glow per hall, lamps hanging from the arches
  for (const h of hs) {
    const [x0, z0, x1, z1] = h.alongX ? [h.lo, h.axis - h.r, h.hi, h.axis + h.r] : [h.axis - h.r, h.lo, h.axis + h.r, h.hi];
    const fy = Math.min(h.ya, h.yb), top = Math.max(h.ya, h.yb) + h.spring + h.rise;
    b.occlude(Math.floor(x0 / V), Math.floor(z0 / V), Math.ceil(x1 / V), Math.ceil(z1 / V), top + 1.5, fy + 0.95, 'building');
    b.occluders[b.occluders.length - 1].floor = fy;
    b.indoor.push([Math.floor(x0 / V), layerOf(fy), Math.floor(z0 / V), Math.ceil(x1 / V), layerOf(top) - 2, Math.ceil(z1 / V)]);
    for (const rp of h.ribs) {
      if (domes.some((dm) => Math.hypot((h.alongX ? rp : h.axis) - dm.x, (h.alongX ? h.axis : rp) - dm.z) < dm.R + 0.3)) continue;
      if (rp < h.lo + 0.5 || rp > h.hi - 0.5) continue;
      const [lx, lz] = h.alongX ? [rp, h.axis] : [h.axis, rp];
      const fl = floorOf(h, rp), crown = fl + h.spring + h.rise;
      const seed = Math.round(lx * 7 + lz * 13);
      b.place(hallLantern(c, seed, h.grand, Math.round((crown - fl - 3.1) / 0.125) - 9), lx, fl + 3.1, lz);
      b.lamp(lx, fl + 3.3, lz, h.grand ? [1, 0.74, 0.48] : WARM, 6, 0.9);
    }
    for (const bp of h.bays) {
      if (domes.some((dm) => Math.hypot((h.alongX ? bp : h.axis) - dm.x, (h.alongX ? h.axis : bp) - dm.z) < dm.R + 0.6)) continue;
      const fl = floorOf(h, bp);
      const [sx, sz] = h.alongX ? [bp, h.axis] : [h.axis, bp];
      shafts.push([sx, fl + h.spring + h.rise, sz, 0.5, 0.5, fl]);
    }
  }
  for (const dm of domes) {
    const crown = dm.y + dm.spring + dm.rise;
    b.place(chandelier(c, Math.round(dm.x * 3 + dm.z), dm.grand, Math.round((crown - dm.y - 3.4) / 0.125) - 9), dm.x, dm.y + 3.4, dm.z);
    b.lamp(dm.x, dm.y + 3.6, dm.z, dm.grand ? [1, 0.72, 0.46] : WARM, 7.5, 1.0);
    shafts.push([dm.x, crown, dm.z, 1.0, 1.0, dm.y]);
    b.occlude(Math.floor((dm.x - dm.R) / V), Math.floor((dm.z - dm.R) / V), Math.ceil((dm.x + dm.R) / V), Math.ceil((dm.z + dm.R) / V), crown + 2.2, dm.y + 0.95, 'building');
    b.occluders[b.occluders.length - 1].floor = dm.y;
  }
  // the voxels: first the ceiling over every column of each hall's box (once per column), then the shell,
  // paint, ribs, skylights and clerestory
  const done = new Set<number>();
  const cells: { x: number; z: number; o: Over }[] = [];
  const ceilAt = new Map<number, number>();
  for (const h of hs) {
    const [x0, z0, x1, z1] = h.alongX ? [h.lo, h.axis - h.r - 0.6, h.hi, h.axis + h.r + 0.6] : [h.axis - h.r - 0.6, h.lo, h.axis + h.r + 0.6, h.hi];
    const X0 = Math.floor(x0 / V) - 2, X1 = Math.ceil(x1 / V) + 2, Z0 = Math.floor(z0 / V) - 2, Z1 = Math.ceil(z1 / V) + 2;
    if (!g.touches(X0 - 2, Z0 - 2, X1 + 2, Z1 + 2)) continue;
    for (let z = Z0; z <= Z1; z++)
      for (let x = X0; x <= X1; x++) {
        if (!inMap(x, z)) continue;
        const k = col(x, z);
        if (done.has(k)) continue;
        done.add(k);
        const o = overAt(hs, domes, x, z);
        if (!o) continue;
        cells.push({ x, z, o });
        if (!o.ring) ceilAt.set(k, o.ceil);
      }
  }
  for (const { x, z, o } of cells) {
    if (!g.touches(x, z, x, z)) continue;
    const k = col(x, z), kd = plan.kind[k];
    const h = o.h!;
    if (o.ring) { clerestory(ctx, x, z, o, kd); continue; }
    // the shell is thick enough to close the step to its tallest neighbour
    let nb = o.ceil;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = ceilAt.get(col(x + dx, z + dz)); if (n !== undefined) nb = Math.max(nb, n); }
    const topL = Math.max(o.ceil + 3, nb + 1);
    if (kd === K.Covered) g.box(x, o.floor, z, x, o.ceil - 1, z, 0);
    const mx = (x + 0.5) * V, mz = (z + 0.5) * V;
    const dm = o.dome;
    // the skylights: an open slot at the crown of every bay, the oculus of every dome
    let sky = false;
    if (dm) sky = Math.hypot(mx - dm.x, mz - dm.z) < 0.5;
    else if (Math.abs(o.v) < 0.26) { const bp = nearest(h.bays, o.p); sky = Math.abs(bp) < 0.38 && !domes.some((d2) => Math.hypot(mx - d2.x, mz - d2.z) < d2.R + 0.6); }
    if (sky) {
      g.box(x, o.ceil, z, x, topL, z, 0);
      // a little stone kerb round the opening on the roof
      g.set(x, topL + 1, z, 0);
      continue;
    }
    const paint = dm ? domePaint(c, dm, mx, mz, o.ceil) : vaultPaint(c, h, o);
    g.box(x, o.ceil, z, x, topL, z, (_x, y) => (y >= topL ? (h.grand ? c.lead : c.leadDark) : y >= o.ceil + 2 ? c.kufeki : paint));
    // the transverse arches stand a cell proud of the vault, striped, and come down the wall to a corbel
    if (!dm && Math.abs(nearest(h.ribs, o.p)) < 0.26) {
      const stripe = Math.floor((o.v + 8) / 0.5) % 2 === 0;
      const rc = h.grand ? (stripe ? c.paintRed : c.paintCream) : (stripe ? c.brick : c.limeLight);
      if (Math.abs(o.v) < h.r - 0.3) g.set(x, o.ceil - 1, z, rc);
      else g.box(x, o.floor + 12, z, x, o.ceil - 1, z, (_x, y) => (y === o.floor + 12 ? c.marble : y === o.floor + 13 ? c.paintGold : rc));
    }
  }
  // the skylights' rims and the little lanterns over the domes' oculi, outside on the roof
  for (const dm of domes) {
    const cx = dm.x / V, cz = dm.z / V, top = layerOf(dm.y) + Math.round((dm.spring + dm.rise) / V) + 4;
    if (!g.touches(Math.floor(cx) - 6, Math.floor(cz) - 6, Math.ceil(cx) + 6, Math.ceil(cz) + 6)) continue;
    for (let z = Math.floor(cz - 4); z <= Math.ceil(cz + 4); z++)
      for (let x = Math.floor(cx - 4); x <= Math.ceil(cx + 4); x++) {
        const rr = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        if (rr > 3.6) continue;
        // four stone posts round the opening, a lead cap over them, a gilded finial on top
        if (rr > 2.2 && rr < 3.2 && (Math.abs(x + 0.5 - cx) < 0.7 || Math.abs(z + 0.5 - cz) < 0.7)) g.box(x, top - 1, z, x, top + 2, z, c.limeLight);
        g.set(x, top + 3, z, rr > 3.0 ? c.leadDark : c.lead);
        if (rr < 2.2) g.set(x, top + 4, z, c.lead);
      }
    g.box(Math.floor(cx), top + 5, Math.floor(cz), Math.floor(cx), top + 7, Math.floor(cz), c.gold);
  }
  // the hall ends with no way on: a wall with a fountain
  for (const h of hs)
    for (const [dead, p] of [[h.deadLo, h.lo], [h.deadHi, h.hi]] as const) {
      if (!dead) continue;
      endWall(ctx, h, p, p === h.lo ? 1 : -1);
    }
  for (const [x, z, y, alongX, grand] of GATES) gate(ctx, x, z, y ?? hillY(x, z), alongX, grand);
}

/** A hall's painted ceiling: arches' borders, a band at the springing, a rosette round each skylight. */
function vaultPaint(c: IC2, h: Hall, o: Over): number {
  const q = Math.abs(o.v) / h.r;
  const rib = nearest(h.ribs, o.p), bay = nearest(h.bays, o.p);
  const vi = Math.floor(o.v / V), pi = Math.floor(o.p / V);
  if (h.grand) {
    // the Grand Bazaar's halls: cream plaster painted in red, blue and gold
    if (q > 0.84) return (pi + Math.floor(q * 20)) % 4 === 0 ? c.paintGold : c.paintRed;
    if (q > 0.78) return c.paintGold;
    if (Math.abs(rib) < 0.55) return (pi & 1) ? c.paintBlue : c.paintGold;
    const dd = Math.abs(bay) / V + Math.abs(o.v) / V; // diamond distance from the skylight, in cells
    if (dd < 3) return c.paintGold;
    if (dd < 5) return (vi + pi) & 1 ? c.paintRed : c.paintBlue;
    if (dd < 6) return c.paintGold;
    if (pm(pi, 4) === 2 && pm(vi, 4) === 2) return c.paintBlue;
    if (pm(pi + 2, 4) === 2 && pm(vi + 2, 4) === 2) return c.paintRed;
    return c.paintCream;
  }
  // the Spice Bazaar's: whitewash, a band of ochre with a red line at the springing, a red ring round each skylight
  if (q > 0.86) return c.ochre;
  if (q > 0.8) return c.paintRed;
  if (Math.abs(rib) < 0.55) return c.ochre;
  const dd = Math.abs(bay) / V + Math.abs(o.v) / V;
  if (dd < 3) return c.ochre;
  if (dd < 4) return c.paintRed;
  if (pm(pi, 6) === 3 && pm(vi, 6) === 3) return c.ochre;
  return c.white;
}

/** A crossing dome inside: a red band at its foot with windows, gores ribbed in red, a gilded ring round the oculus. */
function domePaint(c: IC2, dm: Dome, mx: number, mz: number, _ceil: number): number {
  const rr = Math.hypot(mx - dm.x, mz - dm.z) / dm.R;
  const th = Math.atan2(mz - dm.z, mx - dm.x);
  const sector = ((th / (Math.PI * 2)) * 16 + 16) % 16, edge = Math.min(sector % 1, 1 - (sector % 1));
  if (rr > 0.92) return dm.grand ? c.paintRed : c.ochre;
  if (rr > 0.76) return Math.floor(sector) % 2 === 0 && edge > 0.25 ? c.skyGlass : dm.grand ? c.paintBlue : c.white;
  if (rr > 0.72) return c.paintGold;
  if (rr < 0.26) return c.paintGold;
  if (rr < 0.32) return dm.grand ? c.paintBlue : c.paintRed;
  if (edge < 0.12) return dm.grand ? c.paintRed : c.brick;
  if (dm.grand && Math.floor(sector) % 2 === 1 && Math.abs(rr - 0.52) < 0.08 && edge > 0.3) return c.paintBlue;
  return dm.grand ? c.paintCream : c.white;
}

/**
 * The wall over the shop fronts, up to the vault: a marble string course, plaster painted with a band, a small
 * arched window in every bay. Where a street leaves the hall it bridges the opening; where no shop stands it
 * comes down to the floor as a wall of shelves, so no hall side is ever bare.
 */
function clerestory(ctx: Ctx, x: number, z: number, o: Over, kd: number): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const h = o.h!;
  const pi = Math.floor(o.p / V);
  const top = o.floor + Math.round(h.spring / V) + 3;
  const bay = nearest(h.bays, o.p), rib = nearest(h.ribs, o.p);
  const lot = plan.lot[col(x, z)];
  const open = kd !== K.Ground && kd !== K.Lot && kd !== K.Covered;
  const y0 = open ? o.floor + 13 : lot ? o.floor + 12 : o.floor;
  if (kd === K.Covered) return;
  // the outer of the wall's two cells is the bazaar's plain stone outside, over the shops' roofs
  const outer = Math.abs(o.v) > h.r + 0.27;
  g.box(x, y0, z, x, top, z, (xx, y, zz) => {
    const up = y - o.floor;
    if (up === top - o.floor) return h.grand ? c.lead : c.leadDark;
    if (outer && up >= 12) return up >= 15 && up <= 18 && Math.abs(bay) < 0.45 - (up === 18 ? 0.25 : 0) ? c.skyGlass : up === 14 || up === 19 ? c.limeLight : almasik(c, xx, y, zz);
    if (up === 12) return c.marble;
    if (up === 13) return h.grand ? c.paintRed : c.brick;
    if (up < 12) {
      // the wall of shelves where no shop stands: planks every three cells, the bazaar's goods between
      if (up < 1) return c.woodDark;
      if (up % 3 === 0) return c.woodDark;
      const goods = h.grand ? [c.carpetRed, c.carpetBlue, c.carpetGold, c.copper, c.brass, c.iznikBlue, c.iznikWhite, c.lampAmber] : [c.spiceRed, c.spiceOrange, c.spiceYellow, c.spiceGreen, c.nut, c.apricot2, c.lokumPink, c.pistachio];
      return goods[Math.floor(hash3(pi, y, 7) * goods.length)];
    }
    if (Math.abs(rib) < 0.26) return h.grand ? c.paintRed : c.brick;
    // a window over the middle of each bay: pointed, framed in marble
    const wb = Math.abs(bay);
    if (up >= 15 && up <= 18 && wb < 0.45 - (up === 18 ? 0.25 : 0)) return c.skyGlass;
    if (up >= 14 && up <= 19 && wb < 0.7) return c.marble;
    if (up === top - o.floor - 1) return h.grand ? c.paintGold : c.ochre;
    // tiles either side of the window, a painted band over them
    if (up >= 14 && up <= 19 && wb < 1.45 && Math.abs(rib) > 0.6) return h.grand ? ((pi + up) % 3 === 0 ? c.iznikRed : (pi + up) & 1 ? c.iznikBlue : c.iznikWhite) : (pi + up) & 1 ? c.iznikTeal : c.iznikWhite;
    if (up === 20) return h.grand ? c.paintBlue : c.paintRed;
    return h.grand ? c.paintCream : c.white;
  });
}

/** Where a hall stops at a wall: a marble fountain in a tiled niche, a lamp over it. */
function endWall(ctx: Ctx, h: Hall, p: number, dir: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  const fl = floorOf(h, p), F = layerOf(fl);
  const top = F + Math.round((h.spring + h.rise) / V) + 4;
  const pv = Math.round(p / V) + (dir > 0 ? 0 : -1);
  const a0 = Math.floor((h.axis - h.r - 0.3) / V), a1 = Math.ceil((h.axis + h.r + 0.3) / V);
  const set = (along: number, across: number, y: number, v: number) => (h.alongX ? g.set(along, y, across, v) : g.set(across, y, along, v));
  if (h.alongX ? g.touches(pv - 2, a0, pv + 2, a1) : g.touches(a0, pv - 2, a1, pv + 2))
    for (let k = 0; k < 3; k++)
      for (let a = a0; a <= a1; a++)
        for (let y = F - 1; y <= top; y++) {
          const across = (a + 0.5) * V - h.axis, q = Math.abs(across) / h.r;
          const tile = Math.abs(across) < 1.1 && y >= F + 1 && y <= F + 15;
          set(pv - dir * k, a, y, k === 0 && tile ? ((a + y) % 3 === 0 ? c.iznikRed : (a + y) & 1 ? c.iznikBlue : c.iznikWhite) : q > 0.9 ? c.marble : almasik(c, a, y, k));
        }
  const [fx, fz] = h.alongX ? [p + dir * 0.7, h.axis] : [h.axis, p + dir * 0.7];
  b.place(fountain(c), fx, fl, fz, h.alongX ? (dir > 0 ? 1 : 3) : (dir > 0 ? 0 : 2));
  if (h.alongX) b.block(p, h.axis - 0.9, p + dir * 1.15, h.axis + 0.9);
  else b.block(h.axis - 0.9, p, h.axis + 0.9, p + dir * 1.15);
  b.lamp(fx, fl + 3, fz, WARM, 4, 0.7);
}

/** A gate at a hall's end: a tall stone portal, marble round the arch, the sultan's tuğra in gold on blue over it. */
function gate(ctx: Ctx, x: number, z: number, y: number, alongX: boolean, grand: boolean): void {
  const { b, c } = ctx;
  const g = b.grid;
  const vx = Math.round(x / V), vz = Math.round(z / V), Y = layerOf(y);
  b.occlude(vx - (alongX ? 2 : 15), vz - (alongX ? 15 : 2), vx + (alongX ? 2 : 15), vz + (alongX ? 15 : 2), y + 9.5, y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = y;
  b.lamp(x, y + 5, z, WARM, 6, 0.8);
  if (!g.touches(vx - 17, vz - 17, vx + 17, vz + 17)) return;
  for (let i = -15; i <= 15; i++) for (let j = -1; j <= 1; j++) {
    const X = alongX ? vx + j : vx + i, Z = alongX ? vz + i : vz + j;
    const half = Math.abs(i);
    const arch = Y + 18 + Math.round(Math.sqrt(Math.max(0, 1 - (half / 9) ** 2)) * 6 + Math.max(0, 3 - half) * 0.6);
    g.box(X, half < 9 ? arch : Y, Z, X, Y + 36, Z, (xx, yy, zz) => {
      if (yy > Y + 34) return grand ? c.lead : c.leadDark;
      if (yy === Y + 34 || yy === Y + 33) return half % 2 ? c.limeLight : c.marble; // the cornice, dentilled
      if (half < 6 && yy > Y + 26 && yy < Y + 32) return half === 5 || yy === Y + 27 || yy === Y + 31 ? c.gold : (xx + yy + zz) % 4 === 0 ? c.gold : c.cobalt; // the tuğra panel
      if (half >= 13) return yy % 4 === 0 ? c.marble : c.limeDark; // the flanking pilasters
      if (j !== 0 && half >= 10 && half <= 11 && yy < Y + 24) return c.marbleGrey; // engaged columns
      return yy < arch + 2 && half < 10 ? (half + yy) % 4 < 2 ? c.marble : c.paintRed : almasik(c, xx, yy, zz);
    });
  }
}

// ------------------------------------------------------------------------------------------- props

/** A big Ottoman lantern on a long chain from the arch: a brass crown, panes of coloured glass, a drop below. */
function hallLantern(c: IC2, seed: number, grand: boolean, chain: number): Prop {
  const ch = Math.max(2, chain);
  const p = new Prop(7, 10 + ch, 7);
  const cols = grand ? [c.lampRed, c.lampAmber, c.lampBlue, c.lampGreen] : [c.lampAmber, c.lampAmber, c.lampRed, c.lampGreen];
  const glass = cols[seed & 3], glass2 = cols[(seed + 1) & 3];
  p.box(3, 10, 3, 3, 9 + ch, 3, c.brass);
  p.box(2, 9, 2, 4, 9, 4, c.brass);
  p.box(1, 8, 1, 5, 8, 5, c.brass);
  for (let y = 3; y <= 7; y++) p.box(1, y, 1, 5, y, 5, (x, yy, z) => ((x === 1 || x === 5) && (z === 1 || z === 5) ? c.brass : (x + z + yy) % 3 === 0 ? glass2 : glass));
  p.box(2, 2, 2, 4, 2, 4, c.brass);
  p.box(3, 0, 3, 3, 1, 3, glass);
  p.sway(SWAY.giant, [3, 9 + ch, 3], [0, 0, 0], (_x, y) => y <= 9);
  return p;
}

/** Under a dome: a ring of small lanterns on chains from a brass hoop. */
function chandelier(c: IC2, seed: number, grand: boolean, chain: number): Prop {
  const ch = Math.max(2, chain);
  const p = new Prop(21, 9 + ch, 21);
  const cols = grand ? [c.lampRed, c.lampAmber, c.lampBlue, c.lampGreen] : [c.lampAmber, c.lampRed, c.lampAmber, c.lampGreen];
  p.box(10, 8, 10, 10, 8 + ch, 10, c.brass);
  for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; p.set(Math.round(10 + Math.cos(a) * 8), 7, Math.round(10 + Math.sin(a) * 8), c.brass); }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, x = Math.round(10 + Math.cos(a) * 8), z = Math.round(10 + Math.sin(a) * 8);
    p.box(x, 4, z, x, 6, z, c.brass);
    p.box(x - 1, 1, z - 1, x + 1, 3, z + 1, cols[(i + seed) & 3]);
    p.set(x, 0, z, c.brass);
  }
  p.box(9, 2, 9, 11, 5, 11, (x, y, z) => ((x + y + z) & 1 ? c.lampAmber : c.brass));
  p.sway(SWAY.giant, [10, 8 + ch, 10], [0, 0, 0], (_x, y) => y <= 8);
  return p;
}

/** A marble wall fountain: a basin, a carved back with a tap, a little roof of stone. Faces +z. */
function fountain(c: IC2): Prop {
  const p = new Prop(14, 22, 6);
  p.box(0, 0, 3, 13, 3, 5, c.marble);
  p.box(1, 3, 4, 12, 3, 4, c.nazarLight);
  p.box(1, 0, 0, 12, 19, 2, (x, y) => {
    const dx = Math.abs(x - 6.5), arch = y > 12 ? 12 + Math.round(Math.sqrt(Math.max(0, 25 - dx * dx)) * 1.2) : 99;
    if (y >= arch) return c.marble;
    if (y > 12 && dx < 4) return (x + y) % 3 === 0 ? c.iznikRed : c.iznikBlue;
    return dx > 4.5 ? c.marble : c.marbleGrey;
  });
  p.box(6, 7, 3, 7, 7, 3, c.brass);
  p.box(0, 20, 0, 13, 21, 3, c.limeLight);
  return p;
}

// ------------------------------------------------------------------------------------------- the shops

type Kind = 'carpet' | 'lamp' | 'ceramic' | 'copper' | 'textile' | 'jewel' | 'leather' | 'spice' | 'tea' | 'nuts' | 'lokum' | 'soap' | 'nazar';
const GRAND_KINDS: Kind[] = ['carpet', 'lamp', 'ceramic', 'copper', 'textile', 'jewel', 'lamp', 'carpet', 'leather', 'textile'];
const SPICE_KINDS: Kind[] = ['spice', 'spice', 'tea', 'nuts', 'lokum', 'spice', 'soap', 'nazar', 'nuts'];

/**
 * A shop in a bazaar hall: open across its front onto the hall under a sign, its walls, shelves and ceiling
 * packed with the trade's goods, more spilling out and hanging over the threshold, a lead dome on top.
 */
export function bazaarShop(ctx: Ctx, f: Frame, lt: LotPlan, use: Use | undefined): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base, top, seed } = lt;
  const W = f.W, D = f.D;
  const grand = lt.x0 * V < -100;
  // hollow inside, a wide opening onto the hall with corbels at its top corners
  f.box(g, 1, base, 1, W - 2, base + 10, D - 2, 0);
  f.box(g, 1, base, 0, W - 2, base + 9, 0, (a, y) => ((a === 1 || a === W - 2) && y >= base + 8 ? c.marble : 0));
  for (const a of [0, W - 1]) f.box(g, a, base, 0, a, base + 9, 0, (_a, y) => (y === base + 9 ? c.marble : y < base + 1 ? c.marbleGrey : grand ? c.limeLight : c.kufeki));
  // the sign over the opening: a painted board, framed in gold, its name in white and gold
  const board = [c.signGreen, c.signRed, c.cobalt, c.woodDark, c.carpetRed][seed % 5];
  f.box(g, 0, base + 10, 0, W - 1, base + 11, 0, (a, y) => (a === 0 || a === W - 1 ? c.gold : a >= 2 && a <= W - 3 && hash3(a, y, seed) < 0.55 ? (y === base + 11 ? c.gold : c.white) : board));
  // a lead dome over each shop
  const [cx0, cz0] = f.xz(0, 0), [cx1, cz1] = f.xz(W - 1, D - 1);
  const X0 = Math.min(cx0, cx1), X1 = Math.max(cx0, cx1), Z0 = Math.min(cz0, cz1), Z1 = Math.max(cz0, cz1);
  g.box(X0, top, Z0, X1, top, Z1, c.leadDark);
  const rr = Math.min(X1 - X0, Z1 - Z0) / 2 - 0.5;
  for (let y = 0; y <= rr; y++) for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) if (Math.hypot(x + 0.5 - (X0 + X1 + 1) / 2, z + 0.5 - (Z0 + Z1 + 1) / 2, y * 1.2) <= rr) g.set(x, top + 1 + y, z, c.lead);
  const [vx0, vz0] = f.xz(1, 0), [vx1, vz1] = f.xz(W - 2, D - 2);
  b.indoor.push([Math.min(vx0, vx1), base, Math.min(vz0, vz1), Math.max(vx0, vx1), base + 10, Math.max(vz0, vz1)]);
  if (use?.room) { foodRoom(ctx, f, lt, use.room, true, use.restaurant, true); return; }
  const kinds = grand ? GRAND_KINDS : SPICE_KINDS;
  const kind = bazaarTrade(lt);
  // a shop on a corner opens onto the cross hall too, under its own sign
  const hallCell = (a: number, d: number) => { const [x, z] = f.xz(a, d); return inMap(x, z) && ctx.plan.kind[col(x, z)] === K.Covered; };
  const onHall = (a: number) => [2, D >> 1, D - 3].every((d) => hallCell(a, d));
  const sides = { left: onHall(-1), right: onHall(W) };
  // a side wall that only partly meets a hall is stocked on its outside instead: shelves of the trade's goods
  for (const [open, a, out] of [[sides.left, 0, -1], [sides.right, W - 1, W]] as const) {
    if (open) continue;
    const gl = GOODS(c)[kinds[Math.floor(hash3(seed, 5, 9) * kinds.length)]];
    for (let d = 1; d <= D - 2; d++) if (hallCell(out, d)) f.box(g, a, base, d, a, base + 9, d, (_a, y) => (y === base || (y - base) % 3 === 0 ? c.woodDark : gl[Math.floor(hash3(d, y, seed + a) * gl.length)]));
  }
  for (const [open, a] of [[sides.left, 0], [sides.right, W - 1]] as const) {
    if (!open) continue;
    f.box(g, a, base, 1, a, base + 9, D - 2, (_a, y, d) => ((d === 1 || d === D - 2) && y >= base + 8 ? c.marble : 0));
    f.box(g, a, base + 10, 0, a, base + 11, D - 1, (_a, y, d) => (d === 0 || d === D - 1 ? c.gold : d >= 2 && d <= D - 3 && hash3(d, y, seed + 1) < 0.55 ? (y === base + 11 ? c.gold : c.white) : board));
  }
  dressShop(ctx, f, lt, kind, sides);
}

/** Where a bazaar shop's keeper stands (metres): beside the goods, in the light of the opening. */
export function bazaarKeeper(f: Frame): [number, number] {
  return f.m(2.5, 3);
}

/** Where a shopper stands to talk to the keeper (metres): out in the hall, just off the threshold. */
export function bazaarStand(f: Frame): [number, number] {
  return f.m(4.5, -3);
}

/** The trade a bazaar shop keeps (pure: from its lot alone, the same in every worker). */
export function bazaarTrade(lt: LotPlan): Kind {
  const kinds = lt.x0 * V < -100 ? GRAND_KINDS : SPICE_KINDS;
  return kinds[Math.floor(hash3(lt.seed, 5, 9) * kinds.length)];
}

/** A trade's shop dressed: floor, walls, shelves, what hangs from the ceiling, and what stands out front. */
function dressShop(ctx: Ctx, f: Frame, lt: LotPlan, kind: Kind, sides: { left: boolean; right: boolean }): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base: Y, seed } = lt;
  const W = f.W, D = f.D, A1 = W - 2, D1 = D - 2;
  const h = (a: number, y: number, d: number, s = 0) => hash3(a + seed * 3, y + s, d);
  const pick = (cols: number[], a: number, y: number, d: number) => cols[Math.floor(h(a, y, d) * cols.length)];
  const y0 = (Y - G) * V;
  // the floor: boards in the Grand Bazaar, stone flags with a kilim in the Spice Bazaar
  f.box(g, 1, Y - 1, 0, A1, Y - 1, D1, (a, _y, d) => {
    const rug = a >= 3 && a <= A1 - 2 && d >= 3 && d <= D1 - 2;
    if (rug && (kind === 'carpet' || kind === 'textile' || kind === 'spice' || kind === 'tea')) return (a + d) % 4 === 0 ? c.carpetGold : a === 3 || a === A1 - 2 || d === 3 || d === D1 - 2 ? c.carpetCream : (a ^ d) & 2 ? c.carpetRed : c.carpetBlue;
    return lt.x0 * V < -100 ? (hash3(d, Math.floor((a + d * 3) / 7), seed) < 0.5 ? c.woodFloor : c.woodFloorB) : (a >> 1) + (d >> 1) & 1 ? c.floorC : c.floorA;
  });
  // the ceiling: dark beams across, plaster between
  f.box(g, 1, Y + 11, 1, A1, Y + 11, D1, (_a, _y, d) => (d % 4 === 2 ? c.woodDark : c.cream));
  const goods = GOODS(c)[kind];
  const wallGoods = (a: number, y: number, d: number) => {
    const up = y - Y;
    if (up === 0) return c.woodDark;
    if (up % 3 === 0) return c.woodBare;
    return pick(goods, a, y, d);
  };
  // the back wall and the side walls: shelves to the ceiling, or hung with the trade's own pattern
  const hungWalls = kind === 'carpet' || kind === 'ceramic' || kind === 'leather';
  const wallFill = (a: number, y: number, d: number) => {
    const up = y - Y;
    if (!hungWalls || up < 1) return wallGoods(a, y, d);
    if (kind === 'carpet') {
      // kilims hung edge to edge: a border, a field, a lozenge in the middle of each
      const u = (f.W > 0 ? a + d : 0), tile = Math.floor(u / 7), lu = pm(u, 7), lv = pm(up - 1, 10);
      const pal = [[c.carpetRed, c.carpetBlue, c.carpetCream], [c.carpetBlue, c.carpetRed, c.carpetGold], [c.carpetGold, c.carpetRed, c.carpetCream], [c.carpetCream, c.carpetBlue, c.carpetRed]][(tile + seed) & 3];
      if (lu === 0 || lv === 0 || lv === 9) return pal[2];
      return Math.abs(lu - 3.5) + Math.abs(lv - 4.5) < 3 ? pal[1] : (lu + lv) % 4 === 0 ? pal[2] : pal[0];
    }
    if (kind === 'ceramic') {
      // plates hung in rows, each a ring of blue with a red or green heart, on white tile
      const u = a + d, lu = pm(u, 4), lv = pm(up - 1, 4);
      if (lu === 3 || lv === 3) return c.iznikWhite;
      if (lu === 1 && lv === 1) return [c.iznikRed, c.iznikGreen, c.tulipY][Math.floor(h(u >> 2, up >> 2, 1) * 3)];
      return [c.iznikBlue, c.cobalt, c.iznikTeal][Math.floor(h(u >> 2, up >> 2, 2) * 3)];
    }
    // leather: bags hung in rows on pegs, each with a brass buckle
    const u = a + d, lu = pm(u, 5), lv = pm(up - 1, 5);
    if (lv === 4 || lu === 4) return c.woodDark;
    if (lu === 2 && lv === 1) return c.brass;
    return [c.leather, c.leatherDark, c.carpetRed, c.copper, c.carpetBlue][Math.floor(h(u / 5 | 0, up / 5 | 0, 3) * 5)];
  };
  f.box(g, 1, Y, D1, A1, Y + 10, D1, wallFill);
  if (!sides.left) f.box(g, 1, Y, 2, 1, Y + 10, D1 - 1, wallFill);
  if (!sides.right) f.box(g, A1, Y, 2, A1, Y + 10, D1 - 1, wallFill);
  // a counter along the back, two cells deep
  if (kind === 'jewel' || kind === 'lokum') {
    // glass cases: gold, silver and stones (or Turkish delight) under glass, on dark wood
    f.box(g, 3, Y, D1 - 3, A1 - 2, Y + 3, D1 - 2, (a, y, d) => (y < Y + 3 ? (y === Y + 2 ? pick(goods, a, y, d) : c.woodDark) : c.cartGlass));
    f.box(g, 3, Y, 4, 3, Y + 3, D1 - 4, (a, y, d) => (y < Y + 3 ? (y === Y + 2 ? pick(goods, a, y, d) : c.woodDark) : c.cartGlass));
  } else {
    // goods piled on the floor in the middle: stacks of carpets, sacks, crates of bowls, bolts of cloth
    for (let d = Math.max(4, D1 - 7); d <= D1 - 2; d += 3)
      for (let a = 4; a + 2 <= A1 - 2; a += 3) {
        const hh = 1 + Math.floor(h(a, 0, d) * 3);
        f.box(g, a, Y, d, a + 1, Y + hh, d + 1, (aa, y, dd) => (kind === 'carpet' || kind === 'textile' ? pick(goods, 0, y, dd + a) : y === Y + hh ? pick(goods, aa, y, dd) : kind === 'spice' || kind === 'nuts' || kind === 'tea' ? c.carpetCream : c.woodBare));
      }
  }
  // what hangs from the ceiling, filling the room over everyone's head
  const hang = (a: number, d: number, len: number, colr: (y: number) => number) => f.box(g, a, Y + 11 - len, d, a, Y + 10, d, (_a, y) => colr(y));
  for (let d = 2; d <= D1 - 1; d += 2)
    for (let a = 4; a <= A1 - 2; a += 2) {
      const n = h(a, 1, d);
      switch (kind) {
        case 'lamp': {
          // mosaic glass lamps by the dozen, lit, on brass chains at every height
          const len = 2 + Math.floor(n * 3), col1 = pick(goods, a, 2, d);
          hang(a, d, len, (y) => (y >= Y + 11 - len + 2 ? c.brass : col1));
          break;
        }
        case 'textile': case 'nazar': case 'spice': case 'soap': case 'copper': case 'leather': {
          if (n < 0.35) break;
          const len = kind === 'copper' || kind === 'leather' ? 3 : 3 + Math.floor(n * 2);
          hang(a, d, len, (y) => (y === Y + 10 ? c.woodDark : kind === 'textile' ? pick(goods, a, Math.floor(y / 2), d) : kind === 'nazar' ? ((y + a) % 2 ? c.nazarBlue : y % 3 ? c.nazarWhite : c.nazarDark) : kind === 'spice' ? ((y + a) % 3 ? c.spiceRed : c.fig2) : kind === 'soap' ? c.sponge : kind === 'copper' ? (y === Y + 11 - len ? c.copper : c.brass) : c.leather));
          break;
        }
        default: break;
      }
    }
  // what stands in the front of the shop: the trade's showpiece, set out for the passers-by
  const front = (a0: number, a1: number) => {
    for (let a = a0; a <= a1; a++)
      switch (kind) {
        case 'spice': case 'tea': case 'nuts': {
          // tiers of bins, each heaped in a cone with a little card stuck in it
          for (const [d, lift] of [[1, 0], [2, 1], [3, 2]] as const) {
            const col1 = pick(goods, (a >> 1) * 2, d, 1);
            const peak = (a & 1) === 0;
            f.box(g, a, Y, d, a, Y + lift, d, c.woodDark);
            f.box(g, a, Y + lift + 1, d, a, Y + lift + 1 + (peak ? 1 : 0), d, (_a, y) => (peak && y === Y + lift + 2 && h(a, d, 9) < 0.3 ? c.white : col1));
          }
          break;
        }
        case 'carpet': {
          // a pile of folded carpets by the door
          const hh = 2 + (a & 1);
          f.box(g, a, Y, 1, a, Y + hh, 2, (_a, y) => pick(goods, 0, y, a >> 2));
          break;
        }
        case 'ceramic': case 'copper': {
          // a low table with bowls (or trays and ewers)
          f.box(g, a, Y, 1, a, Y + 1, 2, c.woodDark);
          f.box(g, a, Y + 2, 1, a, Y + 2 + (a & 1), 2, (_a, y, d) => pick(goods, a, y, d));
          break;
        }
        case 'lokum': case 'jewel': break;
        default: {
          f.box(g, a, Y, 1, a, Y + 2, 1, c.woodBare);
          f.box(g, a, Y + 3, 1, a, Y + 3, 1, pick(goods, a, 3, 1));
        }
      }
  };
  front(Math.ceil(W / 2), A1 - 1);
  // and over the threshold, above everyone's head, the goods hung out under the arch to draw the eye
  for (let a = 1; a <= A1; a++) {
    const n = h(a, 2, 0);
    const len = kind === 'lamp' ? 1 + Math.floor(n * 3) : kind === 'jewel' || kind === 'lokum' ? 0 : 1 + Math.floor(n * 2);
    for (let k = 0; k < len; k++) {
      const y = Y + 9 - k;
      const v = kind === 'lamp' ? (k === 0 ? c.brass : pick(goods, a, y, 0)) : kind === 'nazar' ? (k & 1 ? c.nazarBlue : c.nazarWhite) : kind === 'carpet' ? pick(goods, 0, y, a >> 2) : pick(goods, a, y, 0);
      f.box(g, a, y, -1, a, y, -1, v);
    }
  }
  for (const [open, a] of [[sides.left, -1], [sides.right, W]] as const) {
    if (!open || kind === 'jewel' || kind === 'lokum') continue;
    for (let d = 1; d <= D1; d++) {
      const len = 1 + Math.floor(h(d, 4, a) * 2);
      for (let k = 0; k < len; k++) f.box(g, a, Y + 9 - k, d, a, Y + 9 - k, d, kind === 'lamp' && k === 0 ? c.brass : kind === 'nazar' ? (k & 1 ? c.nazarBlue : c.nazarWhite) : pick(goods, d, Y + 9 - k, a));
    }
  }
  // the light: warm over most trades, white and bright over the jewellers', coloured in the lamp shops
  const [lx, lz] = f.m(W / 2, D / 2);
  b.lamp(lx, y0 + 2.2, lz, kind === 'lamp' ? [1, 0.6, 0.45] : kind === 'jewel' ? WHITEWARM : WARM, kind === 'lamp' ? 4.5 : 3.5, kind === 'lamp' || kind === 'jewel' ? 0.95 : 0.7);
}

/** Each trade's goods, as palette colours. */
function GOODS(c: IC2): Record<Kind, number[]> {
  return {
    carpet: [c.carpetRed, c.carpetBlue, c.carpetGold, c.carpetCream, c.carpetRed],
    lamp: [c.lampRed, c.lampBlue, c.lampGreen, c.lampAmber, c.lampAmber],
    ceramic: [c.iznikBlue, c.iznikTeal, c.iznikRed, c.iznikWhite, c.cobalt, c.iznikGreen],
    copper: [c.copper, c.brass, c.copper, c.gold, c.silver],
    textile: [c.silkPink, c.silkTeal, c.silkPurple, c.silkGold, c.awnWhite, c.carpetRed, c.iznikBlue],
    jewel: [c.gold, c.silver, c.ruby, c.turquoise, c.gold, c.emerald],
    leather: [c.leather, c.leatherDark, c.carpetRed, c.copper],
    spice: [c.spiceRed, c.spiceOrange, c.spiceYellow, c.spiceGreen, c.spiceBrown, c.spiceDark, c.lokumPink],
    tea: [c.lokumPink, c.rose2, c.spiceYellow, c.spiceGreen, c.tea, c.apricot2],
    nuts: [c.nut, c.pistachio, c.apricot2, c.fig2, c.sesame, c.spiceBrown],
    lokum: [c.lokumPink, c.lokumWhite, c.lokumGreen, c.pistachio, c.lokumWhite],
    soap: [c.soapGreen, c.soapCream, c.sponge, c.lokumPink, c.soapGreen],
    nazar: [c.nazarBlue, c.nazarLight, c.nazarWhite, c.iznikBlue, c.cobalt],
  };
}

/** Shoppers browsing the shop fronts down the halls (metres, facing the shop), one every few shops. */
export function bazaarShoppers(lots: LotPlan[]): { pos: [number, number, number]; face: number; seed: number }[] {
  const out: { pos: [number, number, number]; face: number; seed: number }[] = [];
  for (const l of lots) {
    if (l.use !== 'bazaar' || hash3(l.seed, 3, 17) > 0.4) continue;
    const f = new Frame(l);
    const [x, z] = f.m(f.W * 0.3, -3.4);
    out.push({ pos: [x, (l.base - G) * V, z], face: Math.atan2(-f.out[0], -f.out[1]), seed: l.seed * 7 + 11 });
  }
  return out;
}
