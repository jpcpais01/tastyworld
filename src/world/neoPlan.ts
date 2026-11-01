// Halcyon City (2040): the ground plan, pure functions of position shared by the builder (world/neo.ts), the walkers'
// graph, the pocket map, the drones and the sky traffic. Metres, x east, z south; the map is 320 x 256 m round the
// Halo crossing (x -176..144, z -128..128).
//
// The city is built on broken ground and has grown up and over it. The Halo crossing sits at the bottom of a bowl
// (street level 0). North-east the Spire stands on a basalt ridge 16 m up, its towers rising past 100 m, a cliff to
// the bowl and a sheer drop to the Black Canal. North-west the Lantern Market climbs a long slope in crooked lanes;
// south-west the Stacks' housing megablocks terrace a steep hill to 30 m. South of the Halo the Neon Mile lies low
// and flat; east of the canal the Rust Docks fill an island out to the bay. Streets follow the contours, stairs climb
// between them, and a skybridge leaps the canal from the ridge to the roof of a dock podium.
import { G, V, VX0, VZ0, SX, SZ, CITY_ZONES } from './layout';
import { hash3, rng } from './grid';
import { regradePaths } from './regrade';
import { NEO } from './cityId';

export type District = 'halo' | 'lantern' | 'spire' | 'stacks' | 'neonmile' | 'sump' | 'docks';
export type Rect = [number, number, number, number];

/** What the surface of a column is. */
export const enum K {
  Ground, Water, Quay, Plaza, Avenue, Street, Lane, Stair, Bridge, Lot, Yard, Deck, Pier,
}
const PATHY = new Set<number>([K.Quay, K.Plaza, K.Avenue, K.Street, K.Lane, K.Stair, K.Bridge, K.Deck, K.Pier]);
export const isPath = (k: number) => PATHY.has(k);

export interface PathSeg {
  a: [number, number, number];
  b: [number, number, number];
  w: number;
  kind: K;
  name: string;
  d: District;
}

export type LotUse = 'front' | 'back' | 'podium' | 'yard';

export interface LotPlan {
  id: number;
  /** Inclusive voxel rect. */
  x0: number; z0: number; x1: number; z1: number;
  /** Voxel layer the ground floor stands on (the street in front of its door). */
  base: number;
  /** Highest natural ground under it (voxel layer): the building must at least bury the hill behind it. */
  hi: number;
  side: 'n' | 's' | 'e' | 'w';
  d: District;
  seed: number;
  use: LotUse;
  /** The kind of path in front. */
  on: K;
  /** Roof deck people walk on (podiums): its voxel layer. */
  deck?: number;
}

export interface Plan {
  walk: Uint8Array;
  kind: Uint8Array;
  lot: Uint16Array;
  lots: LotPlan[];
  segs: PathSeg[];
  nodes: [number, number][];
  edges: [number, number][];
}

// ------------------------------------------------------------------------------------------- the land

export const MAP = { x0: VX0 * V, z0: VZ0 * V, x1: (VX0 + SX) * V, z1: (VZ0 + SZ) * V };
export const HALO: Rect = [-22, -22, 22, 22];
export const PLAZA_R = 22;
/** The bay east of the docks; the canal's centre line wanders north to south. */
export const BAY_X = 120;
export const canalX = (z: number) => 70 + 5 * Math.sin((z + 20) / 31);
export const CANAL_HALF = 5, QUAY_W = 5;
/** Street levels (m). */
export const SPIRE_Y = 16, QUAY_Y = 0.5, DOCK_Y = 0.5;
/** The skybridge from the Spire to the dock podium's roof, and the podium itself. */
export const SKYBRIDGE = { z: -63, w: 4, y: SPIRE_Y };
export const PODIUM: Rect = [71, -70, 87, -56];
/** Where the canal's west quay gives way to the ridge coming down to the water (the skybridge's span). */
const SUMP_GAP: [number, number] = [-72, -52];

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
/** A smooth wander in [-1, 1] from the plan's own hash (every worker agrees). */
const wav = (t: number, s: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return (hash3(i, s, 77) * (1 - u) + hash3(i + 1, s, 77) * u) * 2 - 1; };
const noise2 = (x: number, z: number, sc: number, s: number) => {
  const xi = Math.floor(x / sc), zi = Math.floor(z / sc), fx = x / sc - xi, fz = z / sc - zi;
  const u = fx * fx * (3 - 2 * fx), v = fz * fz * (3 - 2 * fz);
  const h = (a: number, b: number) => hash3(a, s, b) * 2 - 1;
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
};

/** The Spire ridge's edge: south (towards the bowl) and east (towards the canal). */
const spireS = (x: number) => -42 + 3 * wav(x / 14, 3);
const spireE = (z: number) => (z > SUMP_GAP[0] && z < SUMP_GAP[1] ? canalX(z) - CANAL_HALF : canalX(z) - CANAL_HALF - QUAY_W) - 0.5;
export const onSpire = (x: number, z: number) => x > -26 + 2 * wav(z / 12, 4) && x < spireE(z) && z < spireS(x);

/** Natural ground (m) before anything is built. */
export function hillY(x: number, z: number): number {
  const cx = canalX(z);
  if (x > cx - CANAL_HALF - QUAY_W) return x < cx + CANAL_HALF ? -2.5 : DOCK_Y; // the canal and its quays, the docks
  if (onSpire(x, z)) return SPIRE_Y;
  // the valley the Boulevard climbs west, between the market's slope and the Stacks' hill
  const base = 8 * smooth(-20, -170, x);
  const west = smooth(-14, -70, x);
  const lantern = 11 * smooth(-12, -100, z) * west * (0.75 + 0.25 * smooth(-20, -150, x));
  const stacks = 22 * smooth(12, 110, z) * (0.3 + 0.7 * smooth(-14, -150, x)) * smooth(-10, -40, x);
  // the Neon Mile lies low; it lifts a little towards the south edge
  const mile = 2.5 * smooth(20, 120, z) * smooth(-10, 10, x);
  const rough = (lantern + stacks > 1 ? 0.9 : 0.2) * noise2(x, z, 23, 5) + 0.4 * noise2(x, z, 9, 6) * smooth(1, 4, lantern + stacks);
  const y = base + lantern + stacks + mile + rough;
  // the ridge's foot: a scree of rock falling from the cliff into the bowl and to the market
  return Math.max(0, y);
}

/**
 * The ground of the sprawl past the map's edges (m): the hills carry on from the border, climbing a little further
 * out to the west, north and south; the bay stays at the water to the east.
 */
export function farLift(x: number, z: number): number {
  if (x > MAP.x1 - 13) return 0;
  const cx = Math.min(MAP.x1 - 13, Math.max(MAP.x0, x)), cz = Math.min(MAP.z1, Math.max(MAP.z0, z));
  const out = Math.max(MAP.x0 - x, z - MAP.z1, MAP.z0 - z, 0);
  const edge = hillY(cx, cz);
  if (edge <= 0.6) return Math.max(0, edge) * (1 - smooth(0, 40, out)); // the canal's cut and the docks run out level
  return edge + 14 * smooth(0, 220, out) + 3 * noise2(x, z, 61, 8) * smooth(10, 60, out);
}

export function districtAt(x: number, z: number): District {
  const cx = canalX(z);
  if (x > cx + CANAL_HALF) return 'docks';
  if (x > cx - CANAL_HALF - QUAY_W - 2) return 'sump';
  if (Math.hypot(x, z) < 34) return 'halo';
  if (onSpire(x, z) || (z < -40 && x > -20)) return 'spire';
  if (x < -14 && z < 0) return 'lantern';
  if (x < -14) return 'stacks';
  if (z > 0) return 'neonmile';
  return 'halo';
}

// ------------------------------------------------------------------------------------------- the streets

interface N { x: number; z: number; y?: number }
type E = [string, string, number, K, string];

/** Points along a contour: where the ground climbs to `level` going from z0 towards z1, every `step` m of x. */
function contour(level: number, xs: number[], z0: number, z1: number): [number, number][] {
  const out: [number, number][] = [];
  for (const x of xs) {
    let lo = z0, hi = z1;
    if ((hillY(x, lo) - level) * (hillY(x, hi) - level) > 0) continue;
    for (let k = 0; k < 24; k++) { const m = (lo + hi) / 2; if ((hillY(x, m) - level) * (hillY(x, lo) - level) > 0) lo = m; else hi = m; }
    out.push([x, (lo + hi) / 2]);
  }
  return out;
}

/** Where the stair lanes leave the Boulevard, up into the market and the Stacks. */
const STAIR_X = [-36, -62, -90, -119, -148];

function network(): { nodes: Record<string, N>; edges: E[] } {
  const n: Record<string, N> = {};
  const e: E[] = [];
  const at = (id: string, x: number, z: number, y?: number) => { n[id] = { x, z, y }; return id; };
  const chain = (ids: string[], w: number, k: K, name: string) => { for (let i = 1; i < ids.length; i++) e.push([ids[i - 1], ids[i], w, k, name]); };
  const Q = QUAY_Y;

  // the Halo crossing's four mouths and the two avenues through it
  at('hw', -21, 0, 0); at('he', 21, 0, 0); at('hn', 0, -21, 0); at('hs', 0, 21, 0);
  // (a node wherever a stair lane leaves it, north into the market and south into the Stacks)
  const MW = ['hw', ...STAIR_X.map((x, i) => at(`mw${i + 1}`, x, 1.5 * wav(x / 30, 9))), at('mw9', -172, 0)];
  chain(MW, 12, K.Avenue, 'Meridian Boulevard');
  const cx0 = canalX(0);
  chain(['he', at('me1', 42, 0, 0), at('me2', cx0 - CANAL_HALF - QUAY_W / 2, 0, Q)], 12, K.Avenue, 'Meridian Boulevard');
  chain(['me2', at('me3', cx0 + CANAL_HALF + QUAY_W / 2, 0, Q)], 10, K.Bridge, 'Meridian Bridge');
  chain(['me3', at('me4', 96, 0, DOCK_Y), at('me5', 117, 0, DOCK_Y)], 10, K.Street, 'Meridian Boulevard');
  // Spindle Avenue: north up the grand stair onto the ridge, south down the Neon Mile
  chain(['hn', at('sn1', 1, -36, 0)], 12, K.Avenue, 'Spindle Avenue');
  chain(['sn1', at('sn2', 3, -59, SPIRE_Y)], 9, K.Stair, 'The Spindle Steps');
  chain(['sn2', at('sn3', 4, -84, SPIRE_Y), at('sn4', 5, -112, SPIRE_Y), at('sn5', 4, -126, SPIRE_Y)], 10, K.Avenue, 'Spindle Avenue');
  chain(['hs', at('ss1', -1, 46), at('ss2', 2, 74), at('ss3', 0, 100), at('ss4', 1, 126)], 10, K.Avenue, 'Spindle Avenue');

  // ---- the Spire, on its ridge
  chain([at('cr0', -22, -86, SPIRE_Y), 'sn3', at('cr2', 30, -82, SPIRE_Y), at('cr3', 50, -85, SPIRE_Y)], 8, K.Street, 'Capital Road');
  chain([at('gr0', -22, -113, SPIRE_Y), 'sn4', at('gr2', 31, -111, SPIRE_Y), at('gr3', 50, -110, SPIRE_Y)], 7, K.Street, 'Glass Road');
  chain([at('ha0', 30, -50, SPIRE_Y), at('ha1', 32, -64, SPIRE_Y), 'cr2', 'gr2', at('ha3', 30, -126, SPIRE_Y)], 8, K.Street, 'Helix Avenue');
  // the ridge's edge over the bowl: a walk along the top of the cliff, and over the canal to the skybridge
  chain(['sn2', at('rim1', 16, -52, SPIRE_Y), 'ha0'], 5, K.Street, 'Cliff Walk');
  chain(['ha1', at('sky0', 54, SKYBRIDGE.z, SPIRE_Y)], 6, K.Street, 'Skybridge Plaza');
  chain(['sky0', at('sky1', PODIUM[0] + 1.5, SKYBRIDGE.z, SPIRE_Y)], SKYBRIDGE.w, K.Bridge, 'The Skybridge');
  chain(['sky1', at('sky2', PODIUM[2] - 2, SKYBRIDGE.z, SPIRE_Y)], 6, K.Deck, 'Podium Deck');
  // and down off the podium's roof to the docks
  chain([at('pd0', PODIUM[2] - 1.5, PODIUM[3] - 2, SPIRE_Y), at('pd1', PODIUM[2] - 1.5, -40, DOCK_Y)], 3, K.Stair, 'Podium Stair');
  chain(['sky2', 'pd0'], 3, K.Deck, 'Podium Deck');
  // down the ridge's east cliff to the canal: a stair cut in the rock
  const cq = (z: number) => canalX(z) - CANAL_HALF - QUAY_W / 2;
  chain(['cr3', at('ds1', cq(-92) - 4, -98, 8), at('ds2', cq(-104), -104, Q)], 3.5, K.Stair, 'The Drop');
  // and west, where the ridge meets the market's slope
  chain(['gr0', at('gs1', -36, -112), at('gs2', -52, -106)], 5, K.Stair, 'Glass Stairs');
  chain(['cr0', at('ci1', -38, -80)], 4, K.Stair, 'Cinder Steps');

  // ---- the Black Canal: its west quay under the ridge (the Sump) and the Neon Mile, the east quay on the docks
  const west: string[] = [], west2: string[] = [], east: string[] = [], east2: string[] = [];
  for (let z = -126; z <= 126; z += 12) {
    const zz = Math.min(126, z), x = cq(zz), xe = canalX(zz) + CANAL_HALF + QUAY_W / 2;
    if (zz > SUMP_GAP[0] && zz < SUMP_GAP[1]) continue;
    (zz < SUMP_GAP[0] ? west : west2).push(at(`cw${zz}`, x, zz, Q));
    if (zz > PODIUM[1] - 2 && zz < PODIUM[3] + 6) continue;
    (zz < PODIUM[1] ? east : east2).push(at(`ce${zz}`, xe, zz, Q));
  }
  chain(west, QUAY_W, K.Quay, 'The Sump'); chain(west2, QUAY_W, K.Quay, 'Canal Walk'); chain(east, QUAY_W, K.Quay, 'Dock Quay'); chain(east2, QUAY_W, K.Quay, 'Dock Quay');
  // the quays' ends at the ridge come up to the bowl and the Cliff Walk
  e.push([west2[0], 'me2', 4, K.Quay, 'Canal Walk']);
  e.push(['ds2', `cw-102`, 3.5, K.Quay, 'The Sump']);
  // the low bridges over the canal
  const bridge = (z: number, name: string, wi = 5) => {
    const a = at(`bw${z}`, cq(z), z, Q), b = at(`be${z}`, canalX(z) + CANAL_HALF + QUAY_W / 2, z, Q);
    e.push([a, b, wi, K.Bridge, name]);
    return [a, b];
  };
  const [pbw, pbe] = bridge(-100, 'Pier Bridge');
  e.push([pbw, 'ds2', 4, K.Quay, 'The Sump']);
  const [kbw, kbe] = bridge(46, 'Kiss Bridge');
  const [hbw, hbe] = bridge(100, 'Harbour Bridge');
  // tie the bridge ends into their quays
  const near = (ids: string[], z: number) => ids.reduce((b, id) => (Math.abs(n[id].z - z) < Math.abs(n[b].z - z) ? id : b));
  for (const [id, list] of [[pbw, west], [kbw, west2], [hbw, west2], [pbe, east], [kbe, east2], [hbe, east2]] as [string, string[]][]) e.push([id, near(list, n[id].z), QUAY_W, K.Quay, 'Canal Walk']);

  // ---- the Rust Docks
  chain([at('cs0', 96, -126, DOCK_Y), at('cs1', 96, -100, DOCK_Y), at('cs2', 96, -74, DOCK_Y), at('cs3', 96, -40, DOCK_Y), 'me4', at('cs5', 96, 40, DOCK_Y), at('cs6', 96, 100, DOCK_Y), at('cs7', 96, 126, DOCK_Y)], 8, K.Street, 'Crane Street');
  chain([at('bf0', 117, -100, DOCK_Y), at('bf1', 117, -40, DOCK_Y), 'me5', at('bf3', 117, 40, DOCK_Y), at('bf4', 117, 100, DOCK_Y)], 5, K.Quay, 'Bayfront');
  chain([pbe, 'cs1', 'bf0'], 7, K.Street, 'Pier Road');
  chain([near(east, -74), 'cs2'], 4, K.Lane, 'Bolt Lane');
  chain([near(east2, -40), 'pd1', 'cs3', 'bf1'], 5, K.Street, 'Rope Lane');
  chain([near(east2, 40), 'cs5', 'bf3'], 5, K.Street, 'Rust Lane');
  chain([kbe, near(east2, 46)], QUAY_W, K.Quay, 'Dock Quay');
  chain([hbe, 'cs6', 'bf4'], 7, K.Street, 'Harbour Road');
  // the piers into the bay
  for (const [z, name] of [[-70, 'North Pier'], [20, 'Ferry Pier'], [70, 'South Pier']] as [number, string][]) {
    const root = at(`pr${z}`, 117, z, DOCK_Y);
    chain([root, at(`pt${z}`, 139, z, DOCK_Y)], 4, K.Pier, name);
    e.push([root, near(['bf0', 'bf1', 'me5', 'bf3', 'bf4'], z), 5, K.Quay, 'Bayfront']);
  }

  // ---- the Neon Mile
  chain([at('nm0', 26, 18, 0), at('nm1', 27, 46), at('nm2', 25, 72), at('nm3', 27, 100), at('nm4', 26, 126)], 8, K.Street, 'Mile Street');
  chain([at('vl0', 47, 20), at('vl1', 45, 46), at('vl2', 48, 72), at('vl3', 46, 100), at('vl4', 47, 126)], 4, K.Lane, 'Velvet Lane');
  chain(['he', at('nmh', 28, 8, 0), 'nm0'], 6, K.Street, 'Mile Street');
  chain([at('kl0', 1, 46), 'nm1', 'vl1', kbw], 5, K.Street, 'Kiss Lane');
  e.push(['kl0', 'ss1', 5, K.Street, 'Kiss Lane']);
  chain(['ss2', 'nm2', 'vl2', at('sr3', cq(72), 72, Q)], 7, K.Street, 'Starlight Road');
  chain(['ss3', 'nm3', 'vl3', hbw], 5, K.Lane, 'Bass Lane');
  chain(['ss4', 'nm4', 'vl4', at('ar3', cq(124), 124, Q)], 5, K.Lane, 'Afterhours Road');
  chain(['me1', 'vl0'], 4, K.Lane, 'Arcade Alley');
  e.push(['sr3', near(west2, 72), QUAY_W, K.Quay, 'Canal Walk'], ['ar3', near(west2, 124), QUAY_W, K.Quay, 'Canal Walk']);
  // the bowl's own lanes round the Halo, to the foot of the ridge and the canal
  chain(['sn1', at('bl1', 30, -30, 0), at('bl2', cq(-30) - 1, -30, Q)], 5, K.Street, 'Glass Road Low');
  e.push(['bl2', near(west2, -30), QUAY_W, K.Quay, 'Canal Walk']);
  chain(['bl1', 'me1'], 4, K.Lane, 'Undercliff Lane');

  // ---- the Lantern Market: lanes along the slope's contours, stairs straight up it, the old market road across
  const lxs = [-26, -40, -54, -68, -82, -96, -110, -124, -138, -152, -166];
  const lrows: string[][] = [];
  [2.5, 5, 7.5, 10].forEach((lv, j) => {
    const pts = contour(lv, lxs.map((x) => x + 3 * wav(x / 9, 20 + j)), -6, -124);
    const ids = pts.filter(([x, z]) => z > -122 && !onSpire(x + 6, z)).map(([x, z], i) => at(`lc${j}_${i}`, x, z));
    if (ids.length > 1) chain(ids, j % 2 ? 3.5 : 5, j % 2 ? K.Lane : K.Street, ['Rice Lane', 'Silk Road', 'Steam Lane', 'Joss Street'][j]);
    lrows.push(ids);
  });
  const lnames = ['Paper Lane', 'Wok Street', 'Incense Lane', 'Lantern Row', 'Kite Steps', 'Ash Steps'];
  STAIR_X.forEach((x0, i) => {
    // a stair lane up the slope: from the Boulevard through each contour row it meets
    const ids = [`mw${i + 1}`], x = x0 - 2;
    for (const row of lrows) {
      if (!row.length) continue;
      const c = row.reduce((b, id) => (Math.abs(n[id].x - x) < Math.abs(n[b].x - x) ? id : b));
      if (Math.abs(n[c].x - x) < 14 && n[c].z < n[ids[ids.length - 1]].z) ids.push(c);
    }
    if (ids.length > 1) chain(ids, 3.5, K.Lane, lnames[i]);
  });
  // Kowloon Road: the old market road, from the Halo up across the slope to the far corner
  chain(['hw', at('kr1', -34, -18), at('kr2', -58, -40), at('kr3', -84, -58), at('kr4', -112, -80), at('kr5', -140, -98), at('kr6', -168, -112)], 6, K.Street, 'Kowloon Road');
  chain(['gs2', near(lrows[3]?.length ? lrows[3] : ['kr4'], -54)], 4, K.Lane, 'Glass Stairs');
  chain(['ci1', near(lrows[2]?.length ? lrows[2] : ['kr3'], -38)], 4, K.Lane, 'Cinder Steps');

  // ---- the Stacks: terraces round the hill, each a street of megablock doors, and stairs straight up between
  const sxs = [-24, -38, -52, -66, -80, -94, -108, -122, -136, -150, -164];
  const srows: string[][] = [];
  [3, 7, 11, 15, 19, 23].forEach((lv, j) => {
    const pts = contour(lv, sxs.map((x) => x + 3 * wav(x / 9, 40 + j)), 8, 124);
    const ids = pts.filter(([, z]) => z < 123).map(([x, z], i) => at(`sc${j}_${i}`, x, z));
    if (ids.length > 1) chain(ids, j % 2 ? 4 : 5.5, j % 2 ? K.Lane : K.Street, ['Fourth Lane', 'Commons Road', 'Ninth Lane', 'Echo Road', 'Laundry Lane', 'Sky Row'][j]);
    srows.push(ids);
  });
  const snames = ['Block Street', 'Tower Stairs', 'Stair Lane', 'Stacks Row', 'Long Stair'];
  STAIR_X.forEach((x0, i) => {
    const ids = [`mw${i + 1}`], x = x0 + 2;
    for (const row of srows) {
      if (!row.length) continue;
      const c = row.reduce((b, id) => (Math.abs(n[id].x - x) < Math.abs(n[b].x - x) ? id : b));
      if (Math.abs(n[c].x - x) < 14 && n[c].z > n[ids[ids.length - 1]].z) ids.push(c);
    }
    if (ids.length > 1) chain(ids, i === 2 ? 5 : 3.5, K.Lane, snames[i]);
  });
  // the Stacks' foot along Spindle Avenue's west side
  if (srows[0]?.length) chain(['ss1', srows[0].reduce((b, id) => (n[id].x > n[b].x ? id : b))], 5, K.Street, 'Fourth Lane');
  if (srows[1]?.length) chain(['ss3', srows[1].reduce((b, id) => (n[id].x > n[b].x ? id : b))], 4, K.Lane, 'Commons Road');
  return { nodes: n, edges: e.filter(([a, b]) => n[a] && n[b] && a !== b) };
}

// ------------------------------------------------------------------------------------------- plan

export const col = (x: number, z: number) => (z - VZ0) * SX + (x - VX0);
export const layerOf = (y: number) => G + Math.round(y / V);
export const inMap = (x: number, z: number) => x >= VX0 && z >= VZ0 && x < VX0 + SX && z < VZ0 + SZ;

function paintSeg(s: PathSeg, walk: Uint8Array, kind: Uint8Array, best: Float32Array): void {
  const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
  const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
  const r = s.w / 2;
  const x0 = Math.floor((Math.min(ax, bx) - r) / V), x1 = Math.ceil((Math.max(ax, bx) + r) / V);
  const z0 = Math.floor((Math.min(az, bz) - r) / V), z1 = Math.ceil((Math.max(az, bz) + r) / V);
  for (let z = Math.max(VZ0, z0); z < Math.min(VZ0 + SZ, z1); z++)
    for (let x = Math.max(VX0, x0); x < Math.min(VX0 + SX, x1); x++) {
      const px = (x + 0.5) * V, pz = (z + 0.5) * V;
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
      const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
      if (d > r) continue;
      const c = col(x, z);
      if (d >= best[c]) continue;
      best[c] = d;
      walk[c] = layerOf(ay + (by - ay) * t);
      kind[c] = s.kind;
    }
}

const LOT_SIZE: Record<District, { w: [number, number]; d: [number, number] }> = {
  halo: { w: [12, 20], d: [12, 18] },
  spire: { w: [14, 24], d: [14, 22] },
  lantern: { w: [5, 9], d: [7, 11] },
  stacks: { w: [9, 16], d: [9, 13] },
  neonmile: { w: [6, 12], d: [8, 13] },
  sump: { w: [6, 10], d: [6, 10] },
  docks: { w: [12, 22], d: [10, 18] },
};

function placeLots(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, segs: PathSeg[]): LotPlan[] {
  const lots: LotPlan[] = [];
  const r = rng(2040);
  const tryLot = (x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'], base: number, d: District, use: LotUse, on: K, minW = 20): boolean => {
    if (!inMap(x0, z0) || !inMap(x1, z1) || x1 - x0 + 1 < minW || z1 - z0 + 1 < minW) return false;
    let lo = 255, hi = 0;
    for (let z = z0 - 1; z <= z1 + 1; z++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        if (!inMap(x, z)) continue; // a lot may run to the map's edge
        if (x < x0 || x > x1 || z < z0 || z > z1) continue;
        const c = col(x, z);
        if (lot[c] || kind[c] !== K.Ground) return false;
        lo = Math.min(lo, walk[c]); hi = Math.max(hi, walk[c]);
      }
    if (use === 'back') base = lo;
    // a front lot may bury the slope behind it, but not a whole storey of cliff below its door
    if (base - lo > 16) return false;
    const id = lots.length + 1;
    lots.push({ id, x0, z0, x1, z1, base, hi, side, d, seed: Math.floor(r() * 1e6), use, on });
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = col(x, z); lot[c] = id; kind[c] = K.Lot; walk[c] = base; }
    return true;
  };
  const free = (x: number, z: number) => inMap(x, z) && !lot[col(x, z)] && kind[col(x, z)] === K.Ground;
  /**
   * Fit a lot that wants rect (x0..x1, z0..z1) facing `side` onto free ground: rows that touch a street (a diagonal
   * one cuts across the front corner) or another lot are dropped from the front, then the lot runs back as deep as
   * it wanted while the ground stays free. The gap left in front is paved as the door's apron.
   */
  const fitFront = (x0: number, z0: number, x1: number, z1: number, side: LotPlan['side']): [number, number, number, number] | null => {
    const ns = side === 'n' || side === 's';
    let a0 = ns ? x0 : z0, a1 = ns ? x1 : z1;
    const depth = (ns ? z1 - z0 : x1 - x0) + 1;
    // depth index k (0 = the front row) to a coordinate along the lot's depth
    const at = (k: number) => (side === 'n' ? z0 + k : side === 's' ? z1 - k : side === 'w' ? x0 + k : x1 - k);
    const rowFree = (k: number) => { const e = at(k); for (let a = a0; a <= a1; a++) if (!(ns ? free(a, e) : free(e, a))) return false; return true; };
    // a crossing street or a neighbour at either end narrows the lot to the free run round its middle
    const probe = at(Math.min(8, depth - 1));
    const ok = (a: number) => (ns ? free(a, probe) : free(probe, a));
    const mid = Math.round((a0 + a1) / 2);
    if (!ok(mid)) return null;
    let lo = mid, hi = mid;
    while (lo - 1 >= a0 && ok(lo - 1)) lo--;
    while (hi + 1 <= a1 && ok(hi + 1)) hi++;
    if (hi - lo + 1 < 20) return null;
    a0 = lo; a1 = hi;
    let k0 = 0;
    while (k0 < 24 && !rowFree(k0)) k0++;
    if (k0 >= 24) return null;
    let k1 = k0;
    while (k1 + 1 < k0 + depth && rowFree(k1 + 1)) k1++;
    if (k1 - k0 + 1 < 24) return null;
    const ea = at(k0), eb = at(k1);
    return ns ? [a0, Math.min(ea, eb), a1, Math.max(ea, eb)] : [Math.min(ea, eb), a0, Math.max(ea, eb), a1];
  };
  const front = (s: PathSeg) => {
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4) return;
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    const mid = districtAt((ax + bx) / 2, (az + bz) / 2);
    for (let t = 0.5; t < len - 2; ) {
      const f0 = (t + 2) / len, px = ax + (bx - ax) * f0, pz = az + (bz - az) * f0;
      const d = districtAt(px, pz) ?? mid, L = LOT_SIZE[d];
      const w = L.w[0] + r() * (L.w[1] - L.w[0]), dep = L.d[0] + r() * (L.d[1] - L.d[0]);
      const f = Math.min(1, (t + w / 2) / len);
      const cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, cy = ay + (by - ay) * f;
      for (const sd of [1, -1]) {
        const off = s.w / 2 + 0.25;
        let x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'];
        if (alongX) {
          x0 = cx - w / 2; x1 = cx + w / 2;
          if (sd > 0) { z0 = cz + off; z1 = z0 + dep; side = 'n'; } else { z1 = cz - off; z0 = z1 - dep; side = 's'; }
        } else {
          z0 = cz - w / 2; z1 = cz + w / 2;
          if (sd > 0) { x0 = cx + off; x1 = x0 + dep; side = 'w'; } else { x1 = cx - off; x0 = x1 - dep; side = 'e'; }
        }
        // the lot's door is on the street's own level where it stands (a stair's lots step up with it)
        const vx0 = Math.round(x0 / V), vz0 = Math.round(z0 / V), vx1 = Math.round(x1 / V) - 1, vz1 = Math.round(z1 / V) - 1;
        const fy = layerOf(Math.round(cy * 4) / 4);
        const fit = fitFront(vx0, vz0, vx1, vz1, side);
        if (fit) tryLot(fit[0], fit[1], fit[2], fit[3], side, fy, d, 'front', s.kind);
      }
      t += w + (r() < 0.12 ? 1.5 + r() * 2.5 : 0.25);
    }
  };
  // the podium the skybridge lands on comes first: its roof is a deck
  {
    const [x0, z0, x1, z1] = PODIUM;
    const id = lots.length + 1;
    const vx0 = Math.round(x0 / V), vz0 = Math.round(z0 / V), vx1 = Math.round(x1 / V) - 1, vz1 = Math.round(z1 / V) - 1;
    lots.push({ id, x0: vx0, z0: vz0, x1: vx1, z1: vz1, base: layerOf(DOCK_Y), hi: layerOf(DOCK_Y), side: 'e', d: 'docks', seed: 777, use: 'podium', on: K.Street, deck: layerOf(SPIRE_Y) });
    for (let z = vz0; z <= vz1; z++) for (let x = vx0; x <= vx1; x++) { const c = col(x, z); if (isPath(kind[c])) continue; lot[c] = id; kind[c] = K.Lot; walk[c] = layerOf(DOCK_Y); }
  }
  // avenues and streets first (the big frontages), then lanes and stairs, then the quays
  const order = [K.Avenue, K.Street, K.Lane, K.Stair, K.Quay];
  // round the Halo's plaza: the city's showpiece towers, each facing the crossing
  for (let i = 0; i < 16; i++) {
    const a = ((i + 0.5) / 16) * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
    if (Math.abs(ca) > 0.93 || Math.abs(sa) > 0.93) continue; // the avenues' mouths
    const w = 11, dep = 13, rr = PLAZA_R + 0.5 + dep / 2;
    const cx = ca * rr, cz = sa * rr;
    const side: LotPlan['side'] = Math.abs(ca) > Math.abs(sa) ? (ca > 0 ? 'w' : 'e') : sa > 0 ? 'n' : 's';
    const ns = side === 'n' || side === 's';
    const hw = (ns ? w : dep) / 2, hd = (ns ? dep : w) / 2;
    tryLot(Math.round((cx - hw) / V), Math.round((cz - hd) / V), Math.round((cx + hw) / V) - 1, Math.round((cz + hd) / V) - 1, side, G, 'halo', 'front', K.Plaza);
  }
  for (const k of order) for (const s of segs) if (s.kind === k) front(s);
  // an apron of paving from each front door out to its street, over the strip of ground left between them
  for (const l of lots) {
    if (l.use !== 'front') continue;
    const ns = l.side === 'n' || l.side === 's';
    const [ox, oz] = l.side === 'n' ? [0, -1] : l.side === 's' ? [0, 1] : l.side === 'w' ? [-1, 0] : [1, 0];
    const edge = l.side === 'n' ? l.z0 : l.side === 's' ? l.z1 : l.side === 'w' ? l.x0 : l.x1;
    for (let a = ns ? l.x0 : l.z0; a <= (ns ? l.x1 : l.z1); a++)
      for (let k = 1; k <= 30; k++) {
        const e = edge + (ns ? oz : ox) * k, x = ns ? a : e, z = ns ? e : a;
        if (!inMap(x, z)) break;
        const c = col(x, z);
        if (kind[c] !== K.Ground) break;
        kind[c] = l.on === K.Stair ? K.Lane : l.on; walk[c] = l.base;
      }
  }
  // back lots on the ground left between the streets, bigger first
  for (const [wv, dv, step] of [[64, 56, 8], [44, 40, 6], [28, 28, 4], [20, 20, 4]] as [number, number, number][])
    for (let gz = VZ0; gz < VZ0 + SZ - 16; gz += step)
      for (let gx = VX0; gx < VX0 + SX - 16; gx += step) {
        const c = col(gx, gz);
        if (kind[c] !== K.Ground || lot[c]) continue;
        const d = districtAt(gx * V, gz * V);
        if (d === 'sump') continue;
        const w = Math.max(20, wv - Math.floor(r() * 12)), dd = Math.max(20, dv - Math.floor(r() * 10));
        let x1 = Math.min(VX0 + SX - 1, gx + w - 1), z1 = Math.min(VZ0 + SZ - 1, gz + dd - 1);
        // shrink to fit: a back lot fills the yard it is in
        while (x1 - gx >= 19 && !(tryLot(gx, gz, x1, z1, 's', 0, d, 'back', K.Ground))) {
          x1 -= 4; z1 = Math.max(gz + 19, z1 - 4);
          if (z1 - gz < 19) break;
        }
      }
  return lots;
}

let cached: Plan | null = null;
const PROF = !!(globalThis as { process?: { env?: Record<string, string> } }).process?.env?.NEO_PROF;

export function neoPlan(): Plan {
  if (cached) return cached;
  const t0 = performance.now();
  const n = SX * SZ;
  const walk = new Uint8Array(n), kind = new Uint8Array(n), lot = new Uint16Array(n);
  const best = new Float32Array(n).fill(1e9);
  for (let z = VZ0; z < VZ0 + SZ; z++)
    for (let x = VX0; x < VX0 + SX; x++) {
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V, c = col(x, z);
      const cx = canalX(mz);
      if ((mx > cx - CANAL_HALF && mx < cx + CANAL_HALF) || mx >= BAY_X) { walk[c] = layerOf(-2.5); kind[c] = K.Water; continue; }
      walk[c] = Math.min(250, layerOf(hillY(mx, mz)));
      kind[c] = K.Ground;
    }
  const T = (m: string) => { if (PROF) console.log(m, (performance.now() - t0) | 0); };
  T('ground');
  const { nodes, edges } = network();
  const ny = (id: string) => nodes[id].y ?? Math.round(hillY(nodes[id].x, nodes[id].z) * 4) / 4;
  const segs: PathSeg[] = edges.map(([a, b, w, k, name]) => {
    const A: [number, number, number] = [nodes[a].x, ny(a), nodes[a].z], B: [number, number, number] = [nodes[b].x, ny(b), nodes[b].z];
    const len = Math.hypot(B[0] - A[0], B[2] - A[2]);
    // anything steeper than a ramp is a flight of steps
    const kk = (k === K.Street || k === K.Lane || k === K.Avenue) && Math.abs(B[1] - A[1]) / Math.max(1, len) > 0.16 ? K.Stair : k;
    return { a: A, b: B, w, kind: kk, name, d: districtAt((A[0] + B[0]) / 2, (A[2] + B[2]) / 2) };
  });
  // the quays and the bridges first, then everything else over them (crossings belong to the nearer centre line)
  for (const s of segs) paintSeg(s, walk, kind, best);
  // bridges and stairs keep their own grade whatever runs close by
  const own = new Float32Array(n).fill(1e9);
  for (const s of segs) if (s.kind === K.Bridge || s.kind === K.Stair || s.kind === K.Deck || s.kind === K.Pier) paintSeg(s, walk, kind, own);
  for (let i = 0; i < n; i++) if (own[i] < 1e9) best[i] = -1;
  // the Halo's round plaza, level at the bottom of the bowl
  for (let z = Math.floor(-PLAZA_R / V); z < Math.ceil(PLAZA_R / V); z++)
    for (let x = Math.floor(-PLAZA_R / V); x < Math.ceil(PLAZA_R / V); x++) {
      if (Math.hypot((x + 0.5) * V, (z + 0.5) * V) > PLAZA_R) continue;
      const c = col(x, z);
      walk[c] = G; kind[c] = K.Plaza; best[c] = -1;
    }
  // the bay's quay apron and the canal's water edge stay true to their level
  T('paint');
  regradePaths(walk, kind, { adjustable: new Set([K.Street, K.Lane, K.Stair, K.Avenue]), fixed: new Set([K.Quay, K.Plaza, K.Bridge, K.Deck, K.Pier]) });
  T('regrade');
  const lots = placeLots(walk, kind, lot, segs);
  T('lots');
  // the crowd's walking graph: every edge cut into pieces of a dozen metres or less
  const nodeList: [number, number][] = [];
  const key = new Map<string, number>();
  const idx = (x: number, z: number) => {
    const k = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    let i = key.get(k);
    if (i === undefined) { i = nodeList.length; nodeList.push([x, z]); key.set(k, i); }
    return i;
  };
  const edgeList: [number, number][] = [];
  for (const s of segs) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]), m = Math.max(1, Math.ceil(len / 12));
    let prev = idx(s.a[0], s.a[2]);
    for (let i = 1; i <= m; i++) {
      const f = i / m, cur = idx(s.a[0] + (s.b[0] - s.a[0]) * f, s.a[2] + (s.b[2] - s.a[2]) * f);
      if (cur !== prev) edgeList.push([prev, cur]);
      prev = cur;
    }
  }
  cached = { walk, kind, lot, lots, segs, nodes: nodeList, edges: edgeList };
  return cached;
}

export const planHash = (x: number, z: number, s: number) => hash3(x, s, z);

// ------------------------------------------------------------------------------------------- for the game layer

/** A straight flight corridor over open ground (drones), at height `y` above sea level plus their own. */
export interface Seg { name: string; ew: boolean; c: number; w: number; a0: number; a1: number; kind: 'avenue' | 'street' | 'lane' | 'edge' | 'quay'; y: number }

/** The drones' corridors: over the avenues, the canal, the docks' streets and the ridge's roads. */
export const SEGS: Seg[] = [
  { name: 'Meridian Boulevard', ew: true, c: 0, w: 12, a0: -170, a1: 60, kind: 'avenue', y: 4 },
  { name: 'Meridian Boulevard', ew: true, c: 0, w: 10, a0: 60, a1: 118, kind: 'avenue', y: 0 },
  { name: 'Spindle Avenue', ew: false, c: 1, w: 10, a0: 22, a1: 126, kind: 'avenue', y: 2 },
  { name: 'Spindle Avenue', ew: false, c: 4, w: 10, a0: -126, a1: -30, kind: 'avenue', y: SPIRE_Y },
  { name: 'Capital Road', ew: true, c: -84, w: 8, a0: -22, a1: 50, kind: 'street', y: SPIRE_Y },
  { name: 'Black Canal', ew: false, c: 70, w: 10, a0: -126, a1: 126, kind: 'street', y: 9 },
  { name: 'Crane Street', ew: false, c: 96, w: 8, a0: -126, a1: 126, kind: 'street', y: 0 },
  { name: 'Mile Street', ew: false, c: 26, w: 8, a0: 18, a1: 126, kind: 'street', y: 1 },
  { name: 'Kowloon Road', ew: true, c: -40, w: 6, a0: -60, a1: -20, kind: 'street', y: 4 },
];

/** Flying-car lanes: high over the avenues and the canal, between the towers. */
export const SKY_LANES: { ew: boolean; c: number; y: number; a0: number; a1: number }[] = [
  { ew: true, c: 0, y: 30, a0: -300, a1: 300 },
  { ew: false, c: 2, y: 38, a0: -260, a1: 260 },
  { ew: false, c: 70, y: 26, a0: -260, a1: 260 },
  { ew: true, c: -84, y: 52, a0: -300, a1: 300 },
  { ew: false, c: 26, y: 24, a0: -260, a1: 260 },
  { ew: true, c: -36, y: 44, a0: -300, a1: 300 },
  { ew: true, c: 72, y: 34, a0: -300, a1: 300 },
];

// the street names on the signs: every straight-ish piece of street is a zone of its own (checked after the districts)
if (NEO) {
  const { nodes, edges } = network();
  const seen = new Set<string>();
  for (const [a, b, w, , name] of edges) {
    const A = nodes[a], B = nodes[b];
    // a long diagonal's box would swallow its neighbours: only the straighter pieces name their strip
    if (Math.min(Math.abs(B.x - A.x), Math.abs(B.z - A.z)) > 8) continue;
    const rect: Rect = [Math.min(A.x, B.x) - w / 2, Math.min(A.z, B.z) - w / 2, Math.max(A.x, B.x) + w / 2, Math.max(A.z, B.z) + w / 2];
    const k = `${name}:${rect.map((v) => v.toFixed(1)).join(',')}`;
    if (seen.has(k)) continue;
    seen.add(k);
    CITY_ZONES.push({ id: `neo-${CITY_ZONES.length}`, name, jp: name.toUpperCase(), rect });
  }
}
