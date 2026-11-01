import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';
import { farHouses, type FarTower, type FarStone } from './farhouses';
import type { FarLot } from '../world/farTiles';
import { hillY, shoreY, ribZ, ROAD_X0, PROM_X1, TELE, coastX } from '../world/madeiraPlan';

/**
 * Madeira past the edges of the Funchal map: the amphitheatre of the city climbing on all sides to the mountains,
 * Monte on its ridge and the peaks of the central massif beyond, cut by the deep ribeiras running down to the sea;
 * the city itself pouring on along the coast west towards the Lido and east towards the cliffs of Garajau.
 * All of it voxels, on farcoast.ts's rules: columns of blocks doubling in size outwards, houses built on the town's
 * own rules, the ground between the iso camera and the map squatting down so it never hides the streets.
 */

type Rect = [number, number, number, number];

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.5 + vnoise(x * 2.1 + 5, z * 2.1 - 3) * 0.3 + vnoise(x * 4.3 - 7, z * 4.3 + 1) * 0.2;


/** The middle of the coast road west of the town (x), beyond the map: it leaves the map down the middle of the shore road. */
export { coastX };
const roadX = (z: number) => coastX(z) - 15;

/**
 * The torrents' creases in the mountainside: 0 down the middle of a gully, rising to 1 on the spurs between. The
 * gullies run down the mountain to the sea (the noise is stretched along the distance inland), wandering as they go:
 * a deep vallone every few hundred metres, smaller folds between.
 */
export function gully(x: number, z: number): number {
  const d = coastX(z) - x;
  const a = z + 140 * (vnoise(d * 0.004 + 3, z * 0.003) - 0.5);
  const g1 = Math.min(1, Math.abs(vnoise(a * 0.0042, d * 0.0014 + 7) * 2 - 1) * 1.7);
  const g2 = Math.min(1, Math.abs(vnoise(a * 0.012 + 5, d * 0.0038 - 2) * 2 - 1) * 1.7);
  return g1 * 0.66 + g2 * 0.34;
}

/** The Ribeira de João Gomes' line beyond the map, winding on inland, and its bed climbing in its gorge. */
const ribFar = (x: number) => (x < -112 ? ribZ(-112) + 30 * Math.sin((x + 112) * 0.004) + 9 * Math.sin((x + 112) * 0.021) : ribZ(x));
const ribFloor = (x: number) => 9.5 + Math.max(0, -112 - x) * 0.17;

/** The ribeiras carved into the mountainside: João Gomes behind the old town, Santa Luzia to its west. */
function valley(x: number, z: number, h: number): number {
  const inland = Math.max(0, -x);
  const rough = (fbm(x * 0.02 + 1, z * 0.02 - 4) - 0.5) * 14;
  const gorge = (dz: number, floor: number, half: number) => {
    const t = Math.max(0, dz - half);
    return floor + t * 1.3 + t * t * 0.004 + rough * smooth(0, 25, t);
  };
  const kA = smooth(-60, -140, x) * smooth(-2400, -1500, x);
  if (kA > 0) h += (Math.min(h, gorge(Math.abs(z - ribFar(x)), ribFloor(x), 5 + inland * 0.005)) - h) * kA;
  const vzB = -150 + 40 * Math.sin(inland * 0.005);
  const kB = smooth(-80, -200, x) * smooth(-2200, -1300, x);
  if (kB > 0) h += (Math.min(h, gorge(Math.abs(z - vzB), 8 + inland * 0.16, 5 + inland * 0.005)) - h) * kB;
  return h;
}

/** Ground height beyond the map (m): mountains inland, cliffs to the sea, the sea floor beyond the coast. */
export function farHeight(x: number, z: number): number {
  const cx = coastX(z);
  const d = cx - x; // inland distance from the water's edge
  if (d < 0) return Math.max(-38, -6 + d * 0.09); // the sea floor shelves away
  // the island's flank: the city's amphitheatre climbing from the bay, Monte's ridge, and the central massif's
  // peaks of eighteen hundred metres behind
  let h = (1750 * (1 - Math.exp(-d / 2600)) + 60 * smooth(0, 60, d)) * (0.82 + 0.36 * fbm(x * 0.0018 + 4, z * 0.0018));
  // spurs standing out between the gullies that run down to the sea
  h += (gully(x, z) - 0.6) * Math.min(150, 20 + d * 0.16) * smooth(15, 140, d);
  // knolls and hollows
  h += (fbm(x * 0.018, z * 0.018) - 0.5) * 22 * smooth(0, 60, d);
  // sea cliffs: sheer on the headlands, gentler in the coves
  h = Math.min(h, d * (1.2 + 1.8 * vnoise(z * 0.011 + 2, 1.7) * smooth(80, 400, z)) + 2 + 8 * vnoise(z * 0.05, 4.2));
  return valley(x, z, h);
}

/**
 * Limestone bands: the Lattari are layered rock, and their slopes climb in steps of cliff and ledge, scrub and
 * trees on every ledge. Bands are twenty-odd metres, their tops dipping and wandering along the mountain; `k` is
 * how strongly the slope is broken into them.
 */
function banded(x: number, z: number, h: number, k: number): number {
  bandAt = 0;
  if (k <= 0 || h < 6) return h;
  const B = 18 + 16 * vnoise(x * 0.004 + 8, z * 0.004);
  const tilt = 40 * fbm(x * 0.003 + 11, z * 0.003 - 6);
  const v = (h + tilt) / B, f = v - Math.floor(v);
  // (whether the last spot banded lies on one of the cliffs, and how sheer: its block is bare rock)
  bandAt = f > 0.5 && f < 0.92 ? k : 0;
  return h + ((Math.floor(v) + smooth(0.42, 0.97, f)) * B - tilt - h) * k;
}
let bandAt = 0;

/** What the far ground is at a spot, for its colour (the shader adds the detail). */
const enum Kind { Rock, Maquis, Terrace, Road, Beach, Seabed, Village, Wood }

interface Village { x: number; z: number; r: number; n: number; seed: number }
// Funchal goes on all round: the Lido and São Martinho to the west, Santa Luzia and São Pedro up behind the old
// town, Santa Maria Maior and São Gonçalo to the east, Monte on its ridge, and villages scattered up the slopes
const VILLAGES: Village[] = [
  { x: -150, z: -150, r: 90, n: 170, seed: 1 },
  { x: -60, z: -220, r: 80, n: 150, seed: 2 },
  { x: -210, z: 10, r: 95, n: 170, seed: 3 },
  { x: -330, z: -130, r: 110, n: 150, seed: 4 },
  { x: -300, z: 150, r: 100, n: 140, seed: 5 },
  { x: -110, z: 170, r: 80, n: 140, seed: 6 },
  { x: -20, z: 230, r: 70, n: 100, seed: 7 },
  { x: -520, z: 30, r: 130, n: 150, seed: 8 },
  { x: -80, z: -420, r: 120, n: 120, seed: 9 },
  { x: -720, z: -260, r: 120, n: 70, seed: 10 },
  { x: -1100, z: 250, r: 110, n: 60, seed: 11 },
];

/** Block size wanted at a distance (m) from the map: 2 m blocks at its edge, doubling outwards to 32 m ones. */
const want = (d: number) => (d < 32 ? 2 : d < 120 ? 4 : d < 320 ? 8 : d < 760 ? 16 : 32);
const ROOT = 64, TILE = 512;
/** Normals of the five faces a block shows (it never shows its bottom). */
const NRM: [number, number, number][] = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

/**
 * The tree kinds of the coast, each five boxes (a trunk and four lumps of crown), as offset and size in metres:
 * the umbrella stone pine, the holm oak, the cypress, the chestnut of the high woods, the lemon of the terraces, a
 * low mound of maquis (myrtle, lentisk, broom) and the grey-green olive by the villages.
 */
const TREE_BOXES: [number, number, number, number, number, number][][] = [
  [[0, 0, 0, 0.55, 7.2, 0.55], [0, 6.6, 0, 7.2, 1.5, 6.4], [0.4, 7.9, -0.3, 5.0, 1.1, 4.6], [1.4, 8.8, 0.8, 2.6, 0.7, 2.4], [-2.8, 6.2, 1.6, 2.6, 1.1, 2.2]],
  [[0, 0, 0, 0.55, 2.4, 0.55], [0, 1.9, 0, 4.4, 2.6, 4.0], [0.2, 4.3, 0.1, 3.2, 1.3, 3.0], [1.7, 2.6, 1.0, 2.2, 1.7, 2.0], [-1.7, 2.3, -0.7, 2.0, 1.5, 2.4]],
  [[0, 0, 0, 0.4, 1.4, 0.4], [0, 1.0, 0, 1.7, 5.0, 1.7], [0, 5.8, 0, 1.25, 2.2, 1.25], [0, 7.8, 0, 0.75, 1.2, 0.75], [0, 1.5, 0, 2.0, 2.4, 2.0]],
  [[0, 0, 0, 0.75, 3.2, 0.75], [0, 2.7, 0, 6.0, 3.4, 5.6], [-0.2, 5.9, 0.2, 4.4, 1.7, 4.2], [2.7, 3.2, 1.3, 2.6, 2.1, 3.0], [-2.5, 3.0, -1.6, 3.0, 2.0, 2.4]],
  [[0, 0, 0, 0.3, 0.9, 0.3], [0, 0.7, 0, 2.4, 1.6, 2.2], [0.1, 2.2, 0, 1.6, 0.8, 1.6], [0.95, 1.0, 0.6, 1.2, 1.0, 1.0], [-0.9, 1.1, -0.5, 1.0, 0.8, 1.2]],
  [[0, 0, 0, 0.25, 0.4, 0.25], [0, 0.15, 0, 2.6, 1.1, 2.0], [0.8, 0.25, 0.6, 1.6, 1.3, 1.4], [-0.9, 0.1, -0.5, 1.5, 0.9, 1.7], [0.1, 1.1, 0.1, 1.4, 0.6, 1.1]],
  [[0, 0, 0, 0.5, 1.7, 0.5], [0, 1.4, 0, 3.4, 1.3, 3.0], [1.0, 2.2, 0.4, 2.0, 0.9, 1.9], [-1.1, 1.7, -0.7, 1.9, 1.0, 1.6], [0.3, 0.8, 0.0, 0.45, 0.9, 0.45]],
];

/** The cable car to Monte: the line its cabins run along (x, height in m) at z, up one rope and down the other. */
export interface CableLine { z: number; gap: number; pts: [number, number][] }

export function farMadeira(shared: SharedUniforms, rect: Rect): { ground: THREE.Group; houses: THREE.Mesh; lots: FarLot[]; cable: CableLine; sled: [number, number, number][] } {
  const [x0, z0, x1, z1] = rect;
  const outside = (x: number, z: number) => Math.max(x0 - x, x - x1, z0 - z, z - z1, 0);
  // height where the far ground meets the map: what the map itself has at its edge, so the seam is a step at most
  const edgeY = (x: number, z: number) => {
    const ex = Math.max(x0, Math.min(x1, x)), ez = Math.max(z0, Math.min(z1, z));
    if (ex < ROAD_X0) return hillY(ex, ez) - 0.4;
    if (ex <= PROM_X1) return 1.6;
    return shoreY(ex, ez);
  };
  const H = (x: number, z: number) => {
    const o = outside(x, z);
    const far = farHeight(x, z), t = smooth(0, 130, o);
    let h = edgeY(x, z) * (1 - t) + far * t;
    // the slope climbs in limestone bands, beginning a little way out from the map so its edge still meets the town
    h = banded(x, z, h, smooth(10, 70, o) * smooth(0.2, 0.75, vnoise(x * 0.005 + 3, z * 0.005 - 2)) * smooth(30, 160, h));
    // the coast road carries on out of the map a little way above the sea: the mountain comes down to it in crags,
    // as the town's hillside does (gently by the map, as steep as the sea cliffs further on), and below it the
    // rocks fall to the water
    if (z > z1 || z < z0) {
      const rx = roadX(z), ry = 1.6 + Math.max(z - z1, z0 - z) * 0.05;
      if (x < rx - 4) h = Math.min(h, ry + 0.5 + (rx - 4 - x) * (1.6 + 0.8 * smooth(z1, z1 + 80, z)) + (fbm(x * 0.06, z * 0.06) - 0.5) * 5 * smooth(0, 4, rx - 4 - x));
      else if (x <= rx + 4) h = Math.min(h, ry);
      else h = Math.min(h, ry - (x - rx - 4) * 1.2);
    }
    return h;
  };

  // ---- the ground as voxel blocks: a quadtree of square columns, 2 m at the map's edge and doubling outwards, so
  // a block always covers about the same slice of the view from town. Each column is drawn as its top and the
  // sides that stand above its neighbours; nothing hidden is ever meshed.
  const RX0 = x0 - ROOT * 23, RZ0 = z0 - ROOT * 24;
  const NI = 23 + Math.ceil((x1 - x0) / ROOT) + 11, NJ = 48 + Math.ceil((z1 - z0) / ROOT);
  const cellDist = (x: number, z: number, s: number) => Math.hypot(Math.max(x0 - x - s, x - x1, 0), Math.max(z0 - z - s, z - z1, 0));
  const split = (x: number, z: number, s: number) => s > 2 && s > want(cellDist(x, z, s));
  const key = (x: number, z: number, s: number) => (Math.round((x - RX0) / 2) * 4096 + Math.round((z - RZ0) / 2)) * 8 + Math.log2(s);
  const lx: number[] = [], lz: number[] = [], ls: number[] = [], top: number[] = [], base: number[] = [], kinds: number[] = [], flags: number[] = [], shade: number[] = [];
  const index = new Map<number, number>();

  // ---- mule paths: stepped stone trails from the town's edge, up the Valle dei Mulini beside its torrent and in
  // switchbacks up both flanks to the villages above (Pogerola to the west, Pontone and on to Ravello to the east)
  const trails: [number, number][][] = [];
  const trail = (pts: [number, number][], amp: number, period: number) => {
    const out: [number, number][] = [];
    for (let i = 0; i + 1 < pts.length; i++) {
      const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
      const L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      for (let t = i ? 1 : 0; t <= L; t += 1) {
        const ph = t / period - Math.floor(t / period);
        const w = amp * (4 * Math.abs(ph - 0.5) - 1) * smooth(0, 12, t) * smooth(0, 12, L - t);
        const px = ax + ux * t - uz * w, pz = az + uz * t + ux * w;
        if (outside(px, pz) > 0.5) out.push([px, pz]);
      }
    }
    trails.push(out);
  };
  trail([[-100, 60], [-180, 90], [-300, 150], [-420, 120]], 7, 22);
  trail([[-100, -60], [-170, -110], [-260, -130], [-340, -200]], 6, 20);
  const pathCells = new Set<number>();
  const pcell = (x: number, z: number) => Math.floor(x / 2) * 100003 + Math.floor(z / 2);
  for (const t of trails) for (const [px, pz] of t) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) pathCells.add(pcell(px + i * 2, pz + j * 2));
  const onPath = (x: number, z: number, s: number) => {
    if (s > 8) return false;
    for (let i = 0; i < s; i += 2) for (let j = 0; j < s; j += 2) if (pathCells.has(pcell(x + i + 1, z + j + 1))) return true;
    return false;
  };
  const villageNear = (x: number, z: number) => {
    let k = 0;
    for (const v of VILLAGES) k = Math.max(k, smooth(v.r * 2.8, v.r * 0.8, Math.hypot(x - v.x, z - v.z)));
    return k;
  };

  const leaf = (x: number, z: number, s: number) => {
    const cx = x + s / 2, cz = z + s / 2, r = Math.max(2, s / 2);
    const h = H(cx, cz), cliff = bandAt;
    const hx0 = H(cx - r, cz), hx1 = H(cx + r, cz), hz0 = H(cx, cz - r), hz1 = H(cx, cz + r);
    const slope = (Math.abs(hx1 - hx0) + Math.abs(hz1 - hz0)) / (2 * r);
    // how far the block sits below the ground around it: the gullies and folds hold shade (and the woods)
    const hollow = Math.max(-1, Math.min(1, ((hx0 + hx1 + hz0 + hz1) / 4 - h) / (r * 0.6)));
    const d = coastX(cz) - cx;
    const g = gully(cx, cz);
    let kd: Kind;
    if (h < -0.3) kd = Kind.Seabed;
    else if (h < 2.2 && d < 19 && slope < 0.5) kd = Math.abs(cx - roadX(cz)) < 4.5 && (cz > z1 || cz < z0) ? Kind.Road : Kind.Beach;
    else if ((cz > z1 || cz < z0) && Math.abs(cx - roadX(cz)) < 4 && h < 40) kd = Kind.Road;
    // bare limestone on the sea cliffs, the cliff faces of the bands and the highest crags; woods in the gullies
    // and in patches up the mountain, chestnut above; lemon terraces low down, thickest round the villages; and
    // everywhere else the maquis of holm oak, myrtle, broom and lentisk
    else if ((cliff > 0.6 && slope > 1.3) || slope > 3.5 || (d < 40 && slope > 1.5) || (h > 900 && slope > 1.1 && g > 0.6)) kd = Kind.Rock;
    else if (h < 420 && slope < 1.0 && fbm(cx * 0.015, cz * 0.015) + villageNear(cx, cz) * 0.3 + (1 - smooth(60, 260, h)) * 0.12 > 0.66) kd = Kind.Terrace;
    else if ((1 - g) * 0.55 + fbm(cx * 0.008 + 9, cz * 0.008) * 0.6 + smooth(250, 650, h) * 0.3 + Math.max(0, hollow) * 0.15 > 0.7) kd = Kind.Wood;
    else kd = Kind.Maquis;
    for (const v of VILLAGES) if (Math.hypot(cx - v.x, cz - v.z) < v.r * 0.9 && kd !== Kind.Seabed && slope < 1.6) kd = Kind.Village;
    // steps of half a block (the shore and the road in half metres, so the beach stays out of the sea; a quarter on
    // the big far blocks, so the bands still read on the ridges)
    const fineStep = kd === Kind.Beach || kd === Kind.Road || cellDist(x, z, s) < 6 || Math.abs(h) < 2.5;
    const step = fineStep ? 0.5 : s >= 16 ? s / 4 : s / 2;
    const b = Math.floor(h / step) * step;
    // woods and scrub break into a canopy of blocks: some columns stand a step proud, all leaves (never on a path)
    const rh = hash(cx * 0.37, cz * 0.53);
    const proud = h > 3 && !onPath(x, z, s) && (kd === Kind.Wood ? rh < 0.5 : kd === Kind.Maquis ? rh < 0.3 : false);
    const t = b + (proud ? (s <= 4 ? Math.max(step, 1) : s / 4) : 0);
    index.set(key(x, z, s), lx.length);
    lx.push(x); lz.push(z); ls.push(s); base.push(b); top.push(t); kinds.push(kd);
    flags.push(Math.log2(s) + (proud ? 8 : 0));
    shade.push(Math.round((hollow * 0.5 + 0.5) * 15));
  };
  const visit = (x: number, z: number, s: number): void => {
    if (x >= x0 && x + s <= x1 && z >= z0 && z + s <= z1) return; // under the map: the town is there
    if (!split(x, z, s)) { leaf(x, z, s); return; }
    const h = s / 2;
    visit(x, z, h); visit(x + h, z, h); visit(x, z + h, h); visit(x + h, z + h, h);
  };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) visit(RX0 + i * ROOT, RZ0 + j * ROOT, ROOT);
  /** The block whose column holds (x, z): its index, -2 under the map, -1 past the edge of the world. */
  const find = (px: number, pz: number) => {
    if (px >= x0 && px < x1 && pz >= z0 && pz < z1) return -2;
    const i = Math.floor((px - RX0) / ROOT), j = Math.floor((pz - RZ0) / ROOT);
    if (i < 0 || j < 0 || i >= NI || j >= NJ) return -1;
    let x = RX0 + i * ROOT, z = RZ0 + j * ROOT, s = ROOT;
    while (split(x, z, s)) { s /= 2; if (px >= x + s) x += s; if (pz >= z + s) z += s; }
    return index.get(key(x, z, s)) ?? -1;
  };
  /** The ground (without the canopy) at a point, for what stands on it. */
  const groundAt = (x: number, z: number) => { const n = find(x, z); return n >= 0 ? base[n] : H(x, z); };

  interface Buf { pos: number[]; info: number[]; cells: number[]; idx: number[]; lo: [number, number, number]; hi: [number, number, number] }
  const tiles = new Map<number, Buf>();
  const tileOf = (x: number, z: number) => {
    const k = Math.floor((x - RX0) / TILE) * 1000 + Math.floor((z - RZ0) / TILE);
    let t = tiles.get(k);
    if (!t) tiles.set(k, (t = { pos: [], info: [], cells: [], idx: [], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }));
    return t;
  };
  /**
   * One face of a block. `own` is the middle of the block (x, z); `nb` the middle of the block whose top a side's
   * foot stands on. In the iso view each block squats by the amount for its own middle, so its top stays flat and
   * level and every side runs from one block's top to the other's: the ground stays boxes, never a smooth slope.
   */
  const quad = (b: Buf, c: number[][], n: number, kd: number, hs: number, fl: number, ty: number, own: [number, number], nb = own) => {
    // wind the quad to face its normal (a side is wound as if its foot were lower than its top, even when level)
    const N = NRM[n], foot = (i: number) => (n > 0 && (i === 0 || i === 3) ? 1 : 0);
    const ux = c[1][0] - c[0][0], uy = c[1][1] - c[0][1] + foot(0), uz = c[1][2] - c[0][2];
    const vx = c[2][0] - c[0][0], vy = c[2][1] - c[0][1] + foot(0), vz = c[2][2] - c[0][2];
    const dot = (uy * vz - uz * vy) * N[0] + (uz * vx - ux * vz) * N[1] + (ux * vy - uy * vx) * N[2];
    const o = b.pos.length / 3;
    for (const i of dot < 0 ? [0, 3, 2, 1] : [0, 1, 2, 3]) {
      const p = c[i], m = foot(i) ? nb : own;
      b.pos.push(p[0], p[1], p[2]); b.info.push(n, kd, hs, fl); b.cells.push(ty, m[0], m[1]);
      for (let a = 0; a < 3; a++) { b.lo[a] = Math.min(b.lo[a], p[a]); b.hi[a] = Math.max(b.hi[a], p[a]); }
    }
    b.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (let n = 0; n < lx.length; n++) {
    const x = lx[n], z = lz[n], s = ls[n], t = top[n], kd = kinds[n], fl = flags[n];
    // the block's own random tint (low four bits) and how sheltered it lies (high four)
    const hs = Math.floor(hash(x * 0.71 + 3, z * 0.29 - 1) * 16) + shade[n] * 16;
    const b = tileOf(x + s / 2, z + s / 2);
    const own: [number, number] = [x + s / 2, z + s / 2];
    quad(b, [[x, t, z], [x, t, z + s], [x + s, t, z + s], [x + s, t, z]], 0, kd, hs, fl, t, own);
    // the sides, down to each neighbour that is lower (a neighbour is never less than half this block's size)
    const k = s >= 4 ? 2 : 1, seg = s / k;
    for (let f = 1; f <= 4; f++) {
      const alongZ = f <= 2, X = f === 1 ? x + s : x, Z = f === 3 ? z + s : z;
      let prev = -3, lo = 0, from = 0;
      const flush = (until: number) => {
        // (a neighbour level with this block still gets a side, from one of the two, flat until the two squat apart)
        if (prev === -2 || lo > t || (lo === t && (t <= 0 || f === 2 || f === 4))) return;
        const a = from * seg, e = until * seg;
        const nb: [number, number] = prev >= 0 ? [lx[prev] + ls[prev] / 2, lz[prev] + ls[prev] / 2] : own;
        if (alongZ) quad(b, [[X, lo, z + a], [X, t, z + a], [X, t, z + e], [X, lo, z + e]], f, kd, hs, fl, t, own, nb);
        else quad(b, [[x + a, lo, Z], [x + a, t, Z], [x + e, t, Z], [x + e, lo, Z]], f, kd, hs, fl, t, own, nb);
      };
      for (let q = 0; q < k; q++) {
        const u = (q + 0.5) * seg;
        const m = alongZ ? find(X + (f === 1 ? 0.1 : -0.1), z + u) : find(x + u, Z + (f === 3 ? 0.1 : -0.1));
        if (q > 0 && m === prev) continue;
        if (q > 0) flush(q);
        prev = m; from = q; lo = m === -1 ? -40 : m >= 0 ? top[m] : 0;
      }
      flush(k);
    }
  }

  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2((x0 + x1) / 2, (z0 + z1) / 2) },
    uOrigin: { value: new THREE.Vector2(RX0, RZ0) },
  };
  const SQUASH = /* glsl */ `
    uniform vec3 uCamFwd; uniform vec2 uMid; uniform vec4 uRect;
    // iso view: ground between the camera and the map squats down so it never hides the streets (the town
    // climbs to the map's edge, so the squatting starts right there)
    float squash(vec2 xz) {
      if (projectionMatrix[3][3] != 1.0) return 1.0;
      vec2 dir = xz - uMid;
      float l = length(dir);
      if (l < 1.0) return 1.0;
      float camSide = -dot(dir / l, normalize(uCamFwd.xz));
      vec2 o = max(uRect.xy - xz, xz - uRect.zw);
      float out_ = max(0.0, max(o.x, o.y));
      return mix(1.0, 0.03, smoothstep(-0.3, 0.25, camSide) * smoothstep(0.0, 24.0, out_));
    }`;
  const HAZE = /* glsl */ `
    uniform vec3 uFogColor; uniform vec4 uFog; uniform vec4 uRect;
    // aerial perspective over kilometres of coast: blue-grey ridges fading into the sky, thinner up high
    vec3 haze(vec3 col, vec3 w) {
      vec2 o = max(uRect.xy - w.xz, w.xz - uRect.zw);
      float out_ = max(0.0, max(o.x, o.y));
      float lift = mix(1.0, 0.7, smoothstep(20.0, 600.0, w.y));
      float a = (1.0 - exp(-out_ * 0.0016)) * lift;
      if (uFog.w > 0.0) {
        float fd = max(0.0, distance(w, uFog.xyz) - FOG_START) * uFog.w * 0.12;
        a = max(a, (1.0 - exp(-fd * fd)) * lift);
      }
      // (the far ridges go a cooler blue than the air close by)
      return mix(col, uFogColor * mix(vec3(1.0), vec3(0.88, 0.95, 1.07), a), min(a, 0.92));
    }`;
  const groundMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aInfo; in vec3 aCell;
      ${SQUASH}
      out vec3 vWorld; out float vTop; flat out vec4 vInfo; flat out vec3 vN;
      const vec3 NRM[5] = vec3[5](vec3(0, 1, 0), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 0, -1));
      void main() {
        // squat by the amount for the middle of the block this height belongs to: tops stay level
        float s = squash(aCell.yz);
        vec3 p = vec3(position.x, position.y > 0.0 ? position.y * s : position.y, position.z);
        float aTop = aCell.x;
        // squatted ground loses its relief too: no cliffs or canopy painted on a flattened hill
        float keep = smoothstep(0.45, 0.95, s);
        vWorld = vec3(position.x, mix(min(position.y, 0.0), position.y, keep), position.z);
        vTop = mix(min(aTop, 0.0), aTop, keep);
        vInfo = aInfo; vN = NRM[int(aInfo.x + 0.5)];
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp;
      uniform vec2 uOrigin; uniform vec3 uCamFwd;
      in vec3 vWorld; in float vTop; flat in vec4 vInfo; flat in vec3 vN;
      layout(location = 0) out vec4 outColor;
      vec3 lin(float r, float g, float b) { return srgb2lin(vec3(r, g, b)); }
      void main() {
        vec3 n = vN;
        // a side whose lower neighbour squatted less than its own block now faces the other way
        if (n.y < 0.5 && dot(n, uCamFwd) > 0.0) n = -n;
        float k = vInfo.y, cellH = mod(vInfo.z, 16.0) / 15.0, hollow = floor(vInfo.z / 16.0) / 15.0;
        float lvl = mod(vInfo.w, 8.0), sz = exp2(lvl);
        bool proud = vInfo.w > 7.5, top = n.y > 0.5;
        // where on the block: across its face (u) and down from its top edge (dn), in metres
        vec2 rel = vWorld.xz - uOrigin;
        float u = abs(n.x) > 0.5 ? rel.y : rel.x;
        float dn = vTop - vWorld.y;
        vec2 face = top ? rel : vec2(u, vWorld.y);
        float fw = max(fwidth(face.x), fwidth(face.y));
        // each block shows a grid of sub-voxels a quarter of its size (never finer than half a metre), each a shade
        // of its own, over patches of colour tens of metres across, so a slope reads as growth and rock, not static
        float sub = max(0.5, sz * 0.25);
        vec2 sc = floor(face / sub + 1e-3);
        float fine = 1.0 - smoothstep(sub * 0.25, sub * 0.7, fw);
        float tint = mix(1.0, 0.93 + 0.14 * hash12(sc + cellH * 17.0), fine) * (0.95 + 0.1 * cellH);
        vec2 at = top ? vWorld.xz : vec2(u, vWorld.y * 0.6);
        float blot = vnoise(at * 0.035 + 3.0) * 0.65 + vnoise(at * 0.11 - 5.0) * 0.35;
        vec3 alb;
        float lights = 0.0;
        bool grassy = k > 0.5 && k < 2.5 || k > 5.5;
        // the scrub and the woods drape over the edge of each step of the slope, deeper in places, ragged column by
        // column; below hangs the rock of the step
        float drape = sub * (0.7 + 2.6 * vnoise(vec2(u * 0.09, vTop * 0.3)) * (k > 6.5 ? 1.6 : 1.0)) * (0.6 + 0.8 * hash12(vec2(floor(u / sub), vTop)));
        // (on the scrub and the woods the plants cover most of each step: only here and there does a patch of the
        // rock beneath show through)
        float bare = vnoise(vec2(u * 0.07, vWorld.y * 0.11) + cellH * 5.0);
        bool lipped = !top && grassy && (dn < (k > 1.5 && k < 2.5 ? sub * 0.5 : drape) || (k > 0.5 && k < 1.5 && bare < 0.8) || (k > 6.5 && bare < 0.9));
        if (!top && k < 0.5 && dn < drape * 0.8) lipped = true;
        if (k > 4.5 && k < 5.5) {
          // the sea floor: sand and weed, seen through the water
          alb = mix(lin(0.42, 0.45, 0.4), lin(0.2, 0.3, 0.26), vnoise(vWorld.xz * 0.08));
        } else if (k > 3.5 && k < 4.5) {
          // the coast's grey pebbles, and their sea wall
          alb = top ? mix(lin(0.6, 0.58, 0.55), lin(0.47, 0.46, 0.44), hash12(sc * 1.3)) : lin(0.62, 0.58, 0.5);
        } else if (k > 2.5 && k < 3.5) {
          alb = top ? lin(0.33, 0.33, 0.35) : lin(0.64, 0.6, 0.52);
          lights = 0.4;
        } else if (proud || (top && grassy) || lipped) {
          if (k > 6.5) {
            // the woods: holm oak dark and glossy low down, the chestnuts of the upper slopes a fresher green
            float high = smoothstep(260.0, 520.0, vTop);
            vec3 a = mix(lin(0.11, 0.21, 0.09), lin(0.18, 0.3, 0.11), high), b = mix(lin(0.19, 0.31, 0.12), lin(0.29, 0.4, 0.14), high);
            alb = mix(a, b, blot * 0.75 + hash12(sc * 0.7 + 11.0) * 0.25);
          } else if (k > 1.5 && k < 2.5) {
            alb = mix(lin(0.3, 0.46, 0.15), lin(0.22, 0.36, 0.12), hash12(sc * 0.7 + 11.0) * 0.5 + blot * 0.5);
            if (top) {
              // lemon terraces: the dark nets of the pergolas over the rows, a glint of fruit in the leaves
              vec2 g = fract(vWorld.xz / 3.0);
              float net = max(step(g.x, 0.07), step(g.y, 0.07)) * fine;
              alb = mix(alb, lin(0.17, 0.2, 0.14), net * 0.55);
              alb = mix(alb, lin(0.9, 0.78, 0.18), step(0.9, hash12(floor(vWorld.xz * 2.0))) * 0.75 * (1.0 - smoothstep(0.25, 0.6, fw)));
            }
          } else if (k > 5.5) {
            // gardens and vines round the villages
            alb = mix(lin(0.33, 0.43, 0.2), lin(0.46, 0.49, 0.32), blot);
          } else {
            // the maquis: olive scrub, with dark clumps of holm oak and pale drifts of broom and dry grass
            alb = mix(lin(0.24, 0.34, 0.15), lin(0.33, 0.4, 0.19), hash12(sc * 0.7 + 11.0));
            alb = mix(alb, lin(0.15, 0.25, 0.11), smoothstep(0.38, 0.28, blot));
            alb = mix(alb, lin(0.47, 0.47, 0.29), smoothstep(0.64, 0.74, blot) * 0.8);
            // a bare stone here and there in the scrub
            if (top && hash12(sc * 1.7 + 2.0) > 0.95) alb = lin(0.62, 0.6, 0.55);
          }
          if (proud && !top) alb *= 0.8;
        } else if (k > 1.5 && k < 2.5) {
          // the terraces' dry-stone walls: courses of grey limestone
          vec2 st = vec2(u / 0.9 + floor(vWorld.y / 0.45) * 0.5, vWorld.y / 0.45);
          float joint = max(step(fract(st.x), 0.06), step(fract(st.y), 0.1)) * fine;
          alb = mix(lin(0.62, 0.59, 0.53), lin(0.5, 0.48, 0.44), hash12(floor(st)));
          alb *= 1.0 - joint * 0.3;
        } else if (top) {
          // a ledge over a cliff band: scrub where soil has gathered, bare pale rock where it hasn't
          float soil = vnoise(vWorld.xz * 0.13 + 1.0) * 0.7 + hash12(sc * 0.9 + 4.0) * 0.3;
          alb = soil > 0.42 ? mix(lin(0.21, 0.31, 0.13), lin(0.33, 0.4, 0.2), blot) : mix(lin(0.72, 0.7, 0.65), lin(0.6, 0.59, 0.55), hash12(sc));
        } else {
          // limestone: pale grey and cream in strata, dark streaks where the rain runs down it, ochre where it is
          // freshly broken, and here and there a tuft of holm oak or caper rooted in a crack along a bedding line
          float strata = vnoise(vec2(u * 0.02, vWorld.y * 0.35));
          alb = mix(lin(0.74, 0.72, 0.67), lin(0.6, 0.59, 0.56), strata * 0.75 + hash12(sc) * 0.25);
          float streak = vnoise(vec2(u * 0.22, vWorld.y * 0.015 + cellH * 9.0));
          alb = mix(alb, lin(0.43, 0.42, 0.4), smoothstep(0.58, 0.8, streak) * 0.75);
          alb = mix(alb, lin(0.7, 0.58, 0.44), smoothstep(0.72, 0.86, vnoise(vec2(u * 0.05, vWorld.y * 0.06) + 7.0)) * 0.45);
          if (mod(sc.y, 3.0) < 1.0 && hash12(sc * 0.9 + 4.0) > 0.7) alb = mix(lin(0.17, 0.28, 0.12), lin(0.27, 0.37, 0.15), hash12(sc + 2.0));
        }
        alb *= tint;
        if (k > 5.5) lights = 1.0;
        if (!top) lights = 0.0;
        // a block's edges catch the light, like the voxel bevels in town
        vec2 fa = top ? mod(rel, sz) : vec2(mod(u, sz), dn);
        float d = top ? min(min(fa.x, sz - fa.x), min(fa.y, sz - fa.y)) : min(min(fa.x, sz - fa.x), fa.y);
        float bevel = (1.0 - smoothstep(0.0, 0.05 * sz + fw * 0.8, d)) * 0.16;
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        // the foot of a tall side sits in the shade of the slope
        float occl = top ? 1.0 : mix(0.82, 1.0, 1.0 - smoothstep(0.0, sz * 1.5, dn));
        // and the gullies and folds lie in the mountain's own shadow, the spurs in the open
        occl *= mix(1.05, 0.76, hollow);
        vec3 col = alb * (uSunColor * ndl + hemi) * occl * (1.0 + bevel);
        // a few lamps along the road and in the villages after dark
        if (lights > 0.0) {
          vec2 c = floor(vWorld.xz * 0.25);
          float on = step(0.9 - lights * 0.06, hash12(c + 3.7));
          vec2 f = fract(vWorld.xz * 0.25) - 0.5;
          col += uWindowColor * on * exp(-dot(f, f) * 40.0) * uNight * 0.5;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  });
  const ground = new THREE.Group();
  for (const b of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array(b.info), 4));
    g.setAttribute('aCell', new THREE.BufferAttribute(new Float32Array(b.cells), 3));
    g.setIndex(b.pos.length / 3 > 65535 ? new THREE.BufferAttribute(new Uint32Array(b.idx), 1) : new THREE.BufferAttribute(new Uint16Array(b.idx), 1));
    // bounds reach down to the sea: in the iso view a hill on the camera's side squats to the ground
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b.lo[0], Math.min(b.lo[1], -1), b.lo[2]), new THREE.Vector3(...b.hi));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, groundMat);
    m.renderOrder = 10; // after the world, so it only fills what the voxels leave empty
    m.matrixAutoUpdate = false;
    ground.add(m);
  }

  // ---- houses: in the villages, one by one on the slope, each facing downhill on a terrace of its own (see
  // farhouses.ts); only where the village's own ground is, never two on one spot
  const lots: FarLot[] = [];
  const built = (n: number) => n >= 0 && (kinds[n] === Kind.Village || kinds[n] === Kind.Terrace);
  for (const v of VILLAGES) {
    let seed = v.seed * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const first = lots.length;
    for (let i = 0; i < v.n * 7 && lots.length < 1400; i++) {
      // (each is a real voxel house baked before the game starts: about 450 in all keeps that to the time the town
      // takes, shared out over the villages)
      if (lots.length - first >= Math.round(v.n * 0.3)) break;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * v.r;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      const w = 4.5 + rnd() * 4.5, dd = 4 + rnd() * 4, sd = rnd();
      if (outside(x, z) < 6) continue;
      const pts: [number, number][] = [[x - w / 2, z - dd / 2], [x + w / 2, z - dd / 2], [x - w / 2, z + dd / 2], [x + w / 2, z + dd / 2], [x, z]];
      if (!pts.every(([px, pz]) => built(find(px, pz)))) continue;
      const hs4 = pts.map(([px, pz]) => groundAt(px, pz));
      const lo = Math.min(...hs4), hi = Math.max(...hs4);
      if (lo < 0.8 || hi - lo > 6) continue; // in the sea, or too steep to build on
      if (lots.some((o) => Math.abs(o.x - x) < (o.w + w) / 2 + 1 && Math.abs(o.z - z) < (o.d + dd) / 2 + 1)) continue;
      const sides = [groundAt(x + w / 2 + 2, z), groundAt(x - w / 2 - 2, z), groundAt(x, z + dd / 2 + 2), groundAt(x, z - dd / 2 - 2)];
      const front = sides.indexOf(Math.min(...sides));
      lots.push({ x, z, w, d: dd, lo, hi, front, seed: Math.floor(sd * 1e6) + 1 });
    }
  }
  // church towers: São Pedro and Santa Luzia up the hill, Santa Maria Maior to the east, Monte's two on the ridge
  const towers: FarTower[] = ([[-200, -20, 0xf2eee6], [-150, -150, 0xf2eee6], [-60, 210, 0xf2eee6], [-520, 20, 0xf4f1ea], [-520, 34, 0xf4f1ea]] as const).map(([x, z, color]) => ({ x, z, ground: groundAt(x, z), h: 22, color }));

  // ---- the cable car from the garden station up over the city to Monte: steel pylons outside the town, two ropes,
  // the top station by Monte's church. The first span leaves the station high enough to clear every roof in town.
  const CZ = (TELE[1] + TELE[3]) / 2, GAP = 1.7, AX = TELE[0], AY = 8.5, END = -488;
  const pylX = [-132, -250, -370];
  const pts: [number, number][] = [[AX, AY]];
  let y1 = groundAt(pylX[0], CZ) + 18;
  for (let x = -112; x < AX - 4; x += 2) y1 = Math.max(y1, AY + (hillY(x, CZ) + 16 - AY) * (AX - pylX[0]) / (AX - x));
  pts.push([pylX[0], y1]);
  for (const x of pylX.slice(1)) pts.push([x, groundAt(x, CZ) + 18]);
  pts.push([END, groundAt(END, CZ) + 7]);
  // (raise a pylon wherever the rope would sag into the slope before it)
  for (let pass = 0; pass < 4; pass++) for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1], [xb, yb] = pts[i];
    for (let k = 1; k < 20; k++) {
      const x = xa + (xb - xa) * (k / 20), y = ya + (yb - ya) * (k / 20), gy = x < -112 ? groundAt(x, CZ) : hillY(x, CZ) + 14;
      if (y < gy + 8) { pts[i][1] += gy + 8 - y; break; }
    }
  }
  const cable: CableLine = { z: CZ, gap: GAP, pts };
  const ropes: FarStone[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [xa, ya] = pts[i - 1], [xb, yb] = pts[i], n = Math.ceil(Math.abs(xa - xb) / 0.75);
    for (let k = 0; k < n; k++) {
      const xm = xa + (xb - xa) * ((k + 0.5) / n), ym = ya + (yb - ya) * ((k + 0.5) / n), half = Math.abs(xb - xa) / n / 2 + 0.02;
      const dy = Math.abs(yb - ya) / n / 2 + 0.03;
      for (const s of [-1, 1]) ropes.push([xm - half, ym - dy, CZ + s * GAP - 0.04, xm + half, ym + dy, CZ + s * GAP + 0.04, 0x2b2a2a, 0]);
    }
  }
  // the pylons: a tapering steel mast with a crossarm carrying both ropes on its sheaves
  for (const [x, y] of pts.slice(1, -1)) {
    const gy = groundAt(x, CZ) - 1;
    for (let k = 0; k < 3; k++) {
      const t0 = gy + (y - gy) * (k / 3), t1 = gy + (y - gy) * ((k + 1) / 3), w = 1.0 - k * 0.25;
      ropes.push([x - w, t0, CZ - w, x + w, t1, CZ + w, 0x7a7e80, 0]);
    }
    ropes.push([x - 0.35, y - 0.2, CZ - GAP - 0.5, x + 0.35, y + 0.35, CZ + GAP + 0.5, 0x5a5e60, 0]);
  }
  // the top station at Monte: a white block with a tiled roof, the ropes running into it
  {
    const [x, y] = pts[pts.length - 1], gy = groundAt(x, CZ) - 1;
    ropes.push([x - 9, gy, CZ - 6, x + 3, y + 3, CZ + 6, 0xf2eee6, 0]);
    ropes.push([x - 9.5, y + 3, CZ - 6.5, x + 3.5, y + 4, CZ + 6.5, 0xb9714f, 0]);
    ropes.push([x - 8, y + 4, CZ - 5, x + 2, y + 5, CZ + 5, 0xa5603f, 0]);
  }

  // Nossa Senhora do Monte between its two towers: a white nave framed in black basalt, its gabled front to the sea,
  // and the long stair of grey basalt the pilgrims climb on their knees, falling away down the slope in front
  {
    const X0 = -538, X1 = -521, Z0 = 22.5, Z1 = 31.5, zc = (Z0 + Z1) / 2;
    const gy = Math.min(groundAt(X0, zc), groundAt(X1, zc), groundAt(X1, Z0), groundAt(X1, Z1)) - 1, top = gy + 15;
    ropes.push([X0, gy, Z0, X1, top, Z1, 0xf4f1ea, 0]);
    for (const [x, z] of [[X1, Z0], [X1, Z1], [X0, Z0], [X0, Z1]]) ropes.push([x - 0.6, gy, z - 0.6, x + 0.6, top + 0.3, z + 0.6, 0x2c2a2a, 0]);
    ropes.push([X0 - 0.3, top, Z0 - 0.3, X1 + 0.3, top + 0.6, Z1 + 0.3, 0x2c2a2a, 0]);
    // the roof in steps of tile, and the pediment on the front stepped up to a cross
    for (let i = 0; i < 5; i++) ropes.push([X0, top + 0.6 + i * 0.9, Z0 + i * 0.95, X1 - 0.6, top + 1.5 + i * 0.9, Z1 - i * 0.95, 0xb5643f, 0]);
    for (let i = 0; i < 5; i++) ropes.push([X1 - 0.6, top + 0.6 + i * 0.9, Z0 + i * 0.95, X1 + 0.4, top + 1.5 + i * 0.9, Z1 - i * 0.95, i % 4 === 0 ? 0x2c2a2a : 0xf4f1ea, 0]);
    ropes.push([X1 - 0.2, top + 5.1, zc - 0.2, X1 + 0.2, top + 7.2, zc + 0.2, 0x2c2a2a, 0]);
    ropes.push([X1 - 0.2, top + 6.2, zc - 0.8, X1 + 0.2, top + 6.6, zc + 0.8, 0x2c2a2a, 0]);
    // the portal and the three windows over it, dark in the white
    ropes.push([X1, gy + 1, zc - 1.3, X1 + 0.25, gy + 5.5, zc + 1.3, 0x3a2a22, 0]);
    ropes.push([X1, gy + 0.6, zc - 2, X1 + 0.35, gy + 6.4, zc + 2, 0x2c2a2a, 0]);
    for (const dz of [-2.6, 0, 2.6]) ropes.push([X1, gy + 8.5, zc + dz - 0.5, X1 + 0.3, gy + 11.5, zc + dz + 0.5, 0x23354a, 0]);
    // the stair: flights of basalt down the slope to the east, a landing at each turn
    let y = gy + 0.4;
    for (let x = X1 + 1; x < X1 + 34; x += 0.9) {
      const gd = groundAt(x, zc);
      if (gd > y + 0.5) continue;
      const ny = Math.max(gd - 0.2, y - 0.45);
      ropes.push([x, Math.min(ny, gd) - 1.5, zc - 2.2, x + 0.9, ny, zc + 2.2, (Math.round(x / 0.9) % 6) ? 0x55524e : 0x8a8580, 0]);
      for (const sz of [-1, 1]) ropes.push([x, ny, zc + sz * 2.2 - 0.25, x + 0.9, ny + 0.5, zc + sz * 2.2 + 0.25, 0xf2eee6, 0]);
      y = ny;
    }
  }

  // ---- the toboggan run: from below Monte's church down the steep lanes towards Livramento, a ribbon of worn grey
  // paving the sleds slide along (main.ts runs them), a point every 3 m on the ground
  const sled: [number, number, number][] = [];
  for (let t = 0; t <= 1.0001; t += 1 / 80) {
    const x = -500 + 170 * t + Math.sin(t * 9) * 6, z = 18 + 80 * t + Math.sin(t * 13 + 1) * 9;
    sled.push([x, groundAt(x, z), z]);
  }
  for (let i = 1; i < sled.length; i++) {
    const [xa, ya, za] = sled[i - 1], [xb, yb, zb] = sled[i];
    const n = Math.ceil(Math.hypot(xb - xa, zb - za) / 1.25);
    for (let k = 0; k < n; k++) {
      const f = (k + 0.5) / n, x = xa + (xb - xa) * f, z = za + (zb - za) * f, y = ya + (yb - ya) * f;
      ropes.push([x - 1.6, y - 0.6, z - 1.6, x + 1.6, y + 0.06, z + 1.6, (k + i) % 3 ? 0x8a8580 : 0x6e6a66, 0]);
    }
  }

  // ---- the paths' stones: a 1.25 m tread every metre, laid on the ground and stepping in half metres where the
  // ground steps more, so each trail is a flight of stairs up the slope (only near town: further off it's a thread)
  const steps: [number, number, number, number, number, number, number][] = [];
  for (const t of trails) {
    const pts = t.filter(([px, pz]) => { const n = find(px, pz); return n >= 0 && ls[n] <= 8; });
    const g = pts.map(([px, pz]) => groundAt(px, pz));
    const y = g.slice();
    // (a flight climbs a step of the ground up to three metres high; anything taller the path goes round)
    for (let i = 1; i < y.length; i++) if (y[i - 1] - g[i] < 3) y[i] = Math.max(y[i], y[i - 1] - 0.5);
    for (let i = y.length - 2; i >= 0; i--) if (y[i + 1] - g[i] < 3) y[i] = Math.max(y[i], y[i + 1] - 0.5);
    pts.forEach(([px, pz], i) => {
      if (y[i] - g[i] > 3) return;
      const sx = Math.round(px * 4) / 4, sz = Math.round(pz * 4) / 4, c = hash(sx * 0.3, sz * 0.7) < 0.5 ? 0xd8cfbc : 0xc9c0ac;
      steps.push([sx - 0.625, g[i] - 0.3, sz - 0.625, sx + 0.625, y[i] + 0.12, sz + 0.625, c]);
    });
  }
  // (the houses themselves are the town's own, in voxels: engine/fartown.ts)
  const houses = farHouses(u, SQUASH, HAZE, towers, [...steps, ...ropes]);

  // ---- trees: on the scrub and in the woods near town, lemons in rows on the terraces, an olive or a cypress by
  // the villages; none on a path or in a house
  const clear = new Set<number>(pathCells);
  for (const l of lots) for (let i = -l.w / 2 - 3; i <= l.w / 2 + 3; i += 2) for (let j = -l.d / 2 - 3; j <= l.d / 2 + 3; j += 2) clear.add(pcell(l.x + i, l.z + j));
  const trees: number[] = [];
  for (let n = 0; n < lx.length; n++) {
    const s = ls[n], kd = kinds[n];
    if (s > 8 || flags[n] >= 8 || !(kd === Kind.Maquis || kd === Kind.Wood || kd === Kind.Terrace || kd === Kind.Village || kd === Kind.Rock)) continue;
    const x = lx[n], z = lz[n];
    const many = s === 8 ? 3 : s === 4 ? 2 : 1;
    for (let q = 0; q < many; q++) {
      const r = (a: number) => hash(x * 0.13 + a * 17.1 + q * 5.3, z * 0.19 - a * 3.7 + q * 9.1);
      // woods in groves, thinning to their edges; scrub in scattered clumps; a holm oak clinging to a ledge
      const grove = vnoise(x * 0.05 + 2, z * 0.05 - 1);
      const p = kd === Kind.Terrace ? 0.55 : kd === Kind.Wood ? 0.35 + grove * 0.5 : kd === Kind.Maquis ? grove * 0.45 : kd === Kind.Village ? 0.12 : 0.06;
      if (r(0) > p * (s === 2 ? 0.6 : 1)) continue;
      let tx = x + s * (0.15 + 0.7 * r(1)), tz = z + s * (0.15 + 0.7 * r(2));
      // (the lemons stand in rows, on the pergolas' three-metre grid)
      if (kd === Kind.Terrace) { tx = Math.floor(tx / 3) * 3 + 1.5; tz = Math.floor(tz / 3) * 3 + 1.5; }
      if (clear.has(pcell(tx, tz))) continue;
      const y = base[n];
      if (y < 2.5) continue;
      let type: number;
      const r3 = r(3);
      if (kd === Kind.Terrace) type = 4;
      else if (kd === Kind.Wood) type = y > 330 ? (r3 < 0.8 ? 3 : 1) : r3 < 0.65 ? 1 : 3;
      else if (kd === Kind.Village) type = r3 < 0.45 ? 6 : r3 < 0.75 ? 2 : 4;
      else if (kd === Kind.Rock) type = r3 < 0.7 ? 5 : 1;
      else type = r3 < 0.42 ? 5 : r3 < 0.62 ? 1 : r3 < 0.74 ? 0 : r3 < 0.84 ? 2 : 6;
      const scale = (type === 4 ? 0.9 : 0.75) + r(4) * 0.5;
      trees.push(tx, y - 0.25, tz, type, scale, r(5));
    }
  }
  const tbox = new THREE.BoxGeometry(1, 1, 1);
  tbox.translate(0, 0.5, 0);
  // five boxes per tree, the trunk without its foot
  const tPos: number[] = [], tNrm: number[] = [], tPart: number[] = [], tIdx: number[] = [];
  const bp = tbox.attributes.position, bn = tbox.attributes.normal, bi = tbox.index!;
  for (let part = 0; part < 5; part++) {
    const o = tPos.length / 3;
    for (let v = 0; v < bp.count; v++) { tPos.push(bp.getX(v), bp.getY(v), bp.getZ(v)); tNrm.push(bn.getX(v), bn.getY(v), bn.getZ(v)); tPart.push(part); }
    for (let i = 0; i < bi.count; i += 3) {
      const a = bi.getX(i), b = bi.getX(i + 1), c = bi.getX(i + 2);
      if (part === 0 && bn.getY(a) < -0.5) continue; // (a crown's underside shows from the street below)
      tIdx.push(o + a, o + b, o + c);
    }
  }
  tbox.dispose();
  const tg = new THREE.InstancedBufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(tNrm, 3));
  tg.setAttribute('aPart', new THREE.Float32BufferAttribute(tPart, 1));
  tg.setIndex(tIdx);
  const tb = new THREE.InstancedInterleavedBuffer(new Float32Array(trees), 6);
  tg.setAttribute('aTree', new THREE.InterleavedBufferAttribute(tb, 4, 0));
  tg.setAttribute('aVar', new THREE.InterleavedBufferAttribute(tb, 2, 4));
  tg.instanceCount = trees.length / 6;
  const glslBoxes = (f: (b: number[]) => string) => TREE_BOXES.flat().map(f).join(', ');
  const treeMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in float aPart; in vec4 aTree; in vec2 aVar;
      ${SQUASH}
      const vec3 OFF[${TREE_BOXES.length * 5}] = vec3[${TREE_BOXES.length * 5}](${glslBoxes((b) => `vec3(${b[0].toFixed(2)}, ${b[1].toFixed(2)}, ${b[2].toFixed(2)})`)});
      const vec3 SIZ[${TREE_BOXES.length * 5}] = vec3[${TREE_BOXES.length * 5}](${glslBoxes((b) => `vec3(${b[3].toFixed(2)}, ${b[4].toFixed(2)}, ${b[5].toFixed(2)})`)});
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; flat out float vPart; flat out float vType; flat out float vSeed;
      void main() {
        int i = int(aTree.w + 0.5) * 5 + int(aPart + 0.5);
        vec3 off = OFF[i], siz = SIZ[i];
        // turned a quarter at random, mirrored, and stretched a little each way, so no two trees of a kind share a
        // silhouette (and every box still stands square on the voxel axes)
        if (fract(aVar.y * 5.3) > 0.5) { off.xz = off.zx; siz.xz = siz.zx; }
        off.xz *= vec2(aVar.y > 0.5 ? -1.0 : 1.0, fract(aVar.y * 7.0) > 0.5 ? -1.0 : 1.0);
        vec3 stretch = vec3(0.82 + 0.36 * fract(aVar.y * 13.1), 0.8 + 0.4 * fract(aVar.y * 29.7), 0.82 + 0.36 * fract(aVar.y * 3.3));
        // (each lump of a crown sits a touch differently on its tree)
        if (aPart > 0.5) off.xz += (vec2(fract(aVar.y * 41.0 + aPart * 0.37), fract(aVar.y * 17.0 + aPart * 0.71)) - 0.5) * siz.xz * 0.3;
        vLocal = position * siz;
        vec3 p = aTree.xyz + (vLocal + off) * stretch * aVar.x;
        vWorld = p; vN = normal; vPart = aPart; vType = aTree.w; vSeed = aVar.y;
        // a tree on squatted ground isn't drawn at all
        float s = squash(aTree.xz);
        if (s < 0.6) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        p.y = aTree.y * s + (p.y - aTree.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir;
      in vec3 vWorld; in vec3 vN; in vec3 vLocal; flat in float vPart; flat in float vType; flat in float vSeed;
      layout(location = 0) out vec4 outColor;
      vec3 lin(float r, float g, float b) { return srgb2lin(vec3(r, g, b)); }
      void main() {
        vec3 n = normalize(vN);
        int t = int(vType + 0.5);
        // leaves in half-metre voxels, each its own shade
        vec3 q = vWorld * 2.0 + n * 0.25;
        vec2 f2 = abs(n.y) > 0.5 ? q.xz : abs(n.x) > 0.5 ? q.zy : q.xy;
        vec2 cell = floor(f2);
        float fw = max(fwidth(f2.x), fwidth(f2.y));
        float fine = 1.0 - smoothstep(0.4, 0.9, fw);
        vec3 alb;
        if (vPart < 0.5) alb = t == 0 ? lin(0.45, 0.33, 0.25) : t == 6 ? lin(0.42, 0.39, 0.34) : lin(0.33, 0.27, 0.22);
        else {
          vec3 a = t == 0 ? lin(0.16, 0.29, 0.17) : t == 1 ? lin(0.17, 0.27, 0.13) : t == 2 ? lin(0.1, 0.2, 0.12) : t == 3 ? lin(0.27, 0.4, 0.16)
            : t == 4 ? lin(0.21, 0.4, 0.14) : t == 5 ? lin(0.24, 0.33, 0.14) : lin(0.4, 0.45, 0.32);
          // each tree its own green, each lump of its crown a shade apart, and the leaves voxel by voxel
          alb = a * (0.82 + 0.36 * vSeed) * (0.92 + 0.16 * fract(vSeed * 19.0 + vPart * 0.31));
          if (t == 5) alb = mix(alb, lin(0.5, 0.48, 0.2), step(0.7, fract(vSeed * 11.0)) * 0.5); // broom in flower
          alb *= mix(1.0, 0.8 + 0.4 * hash12(cell + vSeed * 31.0), fine);
          // lemons hang thick in the terrace trees
          if (t == 4) alb = mix(alb, lin(0.95, 0.8, 0.15), step(0.84, hash12(cell * 1.7 + 5.0)) * fine * step(n.y, 0.5));
        }
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        // a crown is darker underneath and inside, brighter on its sunlit top
        float occl = n.y < -0.5 ? 0.55 : mix(0.7, 1.0, clamp(vLocal.y / 1.2, 0.0, 1.0));
        vec3 col = alb * (uSunColor * ndl + hemi) * occl;
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  treeMesh.frustumCulled = false;
  treeMesh.renderOrder = 10;
  ground.add(treeMesh);


  // the sea floor everywhere the ground mesh doesn't reach, deep enough that the water reads as open sea
  const R = 6000;
  const sea = new THREE.BufferGeometry();
  sea.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -R, -40, -R, -R, -40, R, R, -40, R, -R, -40, -R, R, -40, R, R, -40, -R,
  ]), 3));
  const floor = new THREE.Mesh(sea, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `out vec3 vWorld; void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uFogColor;
      in vec3 vWorld;
      layout(location = 0) out vec4 outColor;
      void main() { outColor = vec4(uFogColor * 0.2, 1.0); }`,
  }));
  floor.frustumCulled = false;
  floor.renderOrder = 11;
  ground.add(floor);
  return { ground, houses, lots, cable, sled };
}
