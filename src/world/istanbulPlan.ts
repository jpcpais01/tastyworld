import { G, V, VX0, VZ0, SX, SZ } from './layout';
import { hash3, rng } from './grid';
import { regradePaths, gardenFlights } from './regrade';

/**
 * Istanbul's ground plan: Eminönü and the slopes above it, worked out once for the whole map from pure functions
 * of position (never from the voxel grid), so every world worker builds the same city whatever strip it keeps.
 *
 * North is +z and east is +x. The Golden Horn runs along the north edge and the Bosphorus along the east, so the
 * two meet at the corner where the ferries leave for Asia. From the waterfront the old city climbs south and west,
 * gently past the Spice Bazaar and the New Mosque, more steeply up to the Grand Bazaar and the great mosque on its
 * hilltop above the Horn: some fourteen metres in all, rolling rather than cliff-stepped.
 */

/** What the surface of a column is. */
export const enum K {
  Ground, Sea, Quay, Square, Street, Lane, Stair, Steps, Covered, Pier, Bridge, Lot, Mosque, Court, Park, Terrace, Tram,
  /** Steps down into the water from the quay. */
  Landing,
  /** A floating landing stage and the gangway down to it. */
  Pontoon,
}

export interface PathSeg {
  a: [number, number, number];
  b: [number, number, number];
  /** Width (m). */
  w: number;
  kind: K;
  /** Roofed over (a bazaar hall): the builder vaults it and keeps the space above it free. */
  roof?: number;
  /** Which bazaar the hall belongs to. */
  bazaar?: 'spice' | 'grand';
}

export type LotUse = 'house' | 'shop' | 'bazaar' | 'han';

export interface LotPlan {
  id: number;
  /** Inclusive voxel rect. */
  x0: number; z0: number; x1: number; z1: number;
  /** Voxel layer of the ground floor. */
  base: number;
  /** Voxel layer of the top of the walls (under the roof). */
  top: number;
  /** Which side the main door opens to, and the layer of the path in front of it. */
  side: 'n' | 's' | 'e' | 'w';
  door: number;
  seed: number;
  use: LotUse;
  /** The kind of path in front. */
  on: K;
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

// ------------------------------------------------------------------------------------------- terrain

export const SEA_Y = -0.55;
export const QUAY_Y = 1.0;
/** The shore: water north of HORN_Z and east of BOS_X. */
export const HORN_Z = 44, BOS_X = 30;
export const YENI_Y = 2.0;
/** The Grand Bazaar's plateau and the great mosque's hilltop. */
export const BAZAAR_Y = 11.5, HILLTOP_Y = 13.5;
/** Rects (metres) of the landmarks the plan keeps clear. */
export const YENI = { hall: [-4, 2, 16, 18] as const, court: [-2, 18, 14, 30] as const };
export const SULEY = { precinct: [-158, -34, -114, 12] as const, hall: [-150, -26, -124, -4] as const, court: [-146, -4, -128, 10] as const, terrace: [-158, 12, -112, 22] as const };
export const GRAND = [-152, -100, -102, -42] as const;
export const SPICE_Y = 1.0;
/** The bazaar halls' height to the crown of the vault (m): the Grand Bazaar's painted halls, the Spice Bazaar's. */
export const HALL_G = 6.5, HALL_S = 7;
/** Sirkeci's station between the avenue and the quay. */
export const STATION = [15, -58, 23, -36] as const;

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const dome = (x: number, z: number, cx: number, cz: number, h: number, r: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** Metres from the two straight shore lines of the old plan (what the hills are shaped against). */
const lineDist = (x: number, z: number) => Math.min(HORN_Z - z, BOS_X - x);

/**
 * Eminönü's waterfront, west to south: where the Horn and the Bosphorus meet the quay is no square corner but a
 * promenade built out a few metres into the water and faced in facets of stone, the way a real quay is rebuilt
 * stretch by stretch. From the Galata Bridge the fish boats' basin runs straight to the promenade, which steps
 * out at the landing stairs, swings round the point in short facets, dips back into a little bay with its own
 * stairs on the Bosphorus side, runs past the ferry jetty and folds back into the long Sirkeci quay. The ends
 * coincide with the old straight lines, so everything west of the bridge and south of Sirkeci is as it was.
 */
export const COAST: [number, number][] = [
  [-40, 44], [-12, 44], [11, 44],
  [12.4, 46.5], [20.5, 46.5],
  [21.4, 48], [27, 48.6], [31.6, 47.3], [34.6, 44.6], [36.3, 41], [36.7, 35.5],
  [36, 26], [34.2, 25], [33.8, 14],
  [34.8, 12.6], [34.4, 4], [33.6, -7], [31.9, -10.8], [30, -14], [30, -40],
];
/** Where the shore is the outline above, and not the old straight lines (they agree along its edges). */
const COAST_BOX = [-20, -22] as const;

function coastDist(x: number, z: number): number {
  let d2 = Infinity, inside = false;
  const n = COAST.length;
  for (let i = 0; i < n; i++) {
    const [ax, az] = COAST[i], [bx, bz] = i + 1 < n ? COAST[i + 1] : [-40, -40];
    if (i + 1 < n) {
      const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz)));
      const ex = ax + dx * t - x, ez = az + dz * t - z;
      d2 = Math.min(d2, ex * ex + ez * ez);
    }
    if ((az > z) !== (bz > z) && x < ax + ((z - az) / (bz - az)) * (bx - ax)) inside = !inside;
  }
  // the closing edges back round the land (-40,-40) and up to (-40, 44)
  if ((-40 > z) !== (44 > z) && x < -40) inside = !inside;
  return inside ? Math.sqrt(d2) : -Math.sqrt(d2);
}

/** Metres from the nearest water's edge (negative over the water). */
export function shoreDist(x: number, z: number): number {
  return x > COAST_BOX[0] && z > COAST_BOX[1] ? coastDist(x, z) : lineDist(x, z);
}

/** The voxel layer of the sea bed: shelving off from the quay walls into the deep channel. */
export const seaBed = (x: number, z: number) => Math.max(1, layerOf(-2.5 + Math.max(-6, shoreDist(x, z) * 0.18)));

/** The deck of the floating landing stages (m), a hand's breadth over half a metre above the water. */
export const PONTOON_Y = 0.25;
export type Rect = [number, number, number, number];
/**
 * The landing stages: a steel pontoon riding on the water, the gangway that slopes down to it from the quay (or
 * the ferry jetty) and the side the boats lie along. One for the Bosphorus tour boats on the Horn side of the point,
 * one for the city-line ferry beside the mosque.
 */
export const PONTOONS: { deck: Rect; gang: Rect; dir: 'n' | 'e'; board: Rect }[] = [
  { deck: [18, 50.5, 31, 53], gang: [23, 48, 25.25, 50.5], dir: 'n', board: [19, 52.5, 30, 53] },
  { deck: [38, -9, 40.5, 5], gang: [36, -3.25, 38, -0.75], dir: 'e', board: [40, -7.5, 40.5, 3.5] },
];
/** The ferry jetty out to the Bosphorus pontoon, stone on piles, its terminal at the root. */
export const JETTY: Rect = [32, -5.5, 36, 1.5];
/** Stairs down into the water (the side they go down towards): on the Horn promenade and in the Bosphorus bay. */
export const LANDINGS: { rect: Rect; dir: 'n' | 'e' }[] = [
  { rect: [14, 45, 19.5, 46.5], dir: 'n' },
  { rect: [32.3, 15, 33.8, 23.5], dir: 'e' },
];
/** The stairs' cheek walls: half a metre of quay at each end of a landing, walled where it meets the steps. */
export const LANDING_CHEEK = 0.5;
const inRect = (r: Rect, x: number, z: number) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];
/** The landing stairs at (x, z): the step's layer (QUAY, then down a step every half metre), or -1. */
export function landingStep(x: number, z: number): { layer: number; cheek: boolean; dir: 'n' | 'e' } | null {
  for (const l of LANDINGS) {
    if (!inRect(l.rect, x, z)) continue;
    const [x0, z0, x1, z1] = l.rect;
    const along = l.dir === 'n' ? Math.min(x - x0, x1 - x) : Math.min(z - z0, z1 - z);
    if (along < LANDING_CHEEK) return { layer: layerOf(QUAY_Y), cheek: true, dir: l.dir };
    const i = Math.floor((l.dir === 'n' ? z - z0 : x - x0) / 0.5);
    return { layer: layerOf(QUAY_Y) - [2, 4, 7][Math.min(2, i)], cheek: false, dir: l.dir };
  }
  return null;
}
/** The pontoon or gangway at (x, z), and the deck's layer there (the gangway sloping from the quay down to it). */
export function pontoonAt(x: number, z: number): { layer: number; deck: boolean } | null {
  for (const p of PONTOONS) {
    if (inRect(p.deck, x, z)) return { layer: layerOf(PONTOON_Y), deck: true };
    if (inRect(p.gang, x, z)) {
      const [x0, z0, x1, z1] = p.gang, t = p.dir === 'n' ? (z - z0) / (z1 - z0) : (x - x0) / (x1 - x0);
      return { layer: layerOf(QUAY_Y + (PONTOON_Y - QUAY_Y) * t), deck: false };
    }
  }
  return null;
}

/** Natural ground (m) before anything is built: the flat waterfront, then the hills of the old city. */
export function hillY(x: number, z: number): number {
  // the third hill (the great mosque), the bazaar's ridge and the slope up to Cağaloğlu
  const h1 = dome(x, z, -140, -8, 13, 64), h2 = dome(x, z, -132, -80, 11.5, 70), h3 = dome(x, z, -40, -122, 6.5, 58);
  // a smooth maximum, so the hills run into one another without creases
  const k = 2.2;
  const hill = k * Math.log(Math.exp(h1 / k) + Math.exp(h2 / k) + Math.exp(h3 / k)) - k * Math.log(3);
  const mask = smooth(5, 44, lineDist(x, z));
  const roll = (Math.sin(x * 0.07 + z * 0.03) + Math.sin(z * 0.09 - x * 0.05)) * 0.35 * mask;
  return QUAY_Y + Math.max(0, hill * mask + roll);
}

// ------------------------------------------------------------------------------------------- the town's edge

/** A smooth wander in [0, 1] along a line, from the plan's own hash (every worker agrees). */
const wander = (t: number, s: number) => { const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f); return hash3(i, s, 911) * (1 - u) + hash3(i + 1, s, 911) * u; };
/** Linear interpolation through [at, value] points (sorted by at), held flat past the ends. */
const through = (pts: [number, number][], t: number) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (t <= pts[i][0]) { const [a0, v0] = pts[i - 1], [a1, v1] = pts[i]; return v0 + (v1 - v0) * (t - a0) / (a1 - a0); }
  return pts[pts.length - 1][1];
};
const MAP_W = VX0 * V, MAP_S = VZ0 * V;
/**
 * How far in from the map's west line the town stops (m), at z: a wandering line held back where the great mosque's
 * precinct and terrace and the Grand Bazaar's west halls come close to the edge, so their own walls close the town.
 */
function insetW(z: number): number {
  const v = 2.5 + 8 * wander(z / 22, 1) + 3 * wander(z / 7, 2);
  return Math.min(v, through([[-112, 14], [-104, 14], [-100, 6], [-40, 6], [-37, 2], [24, 2], [27, 14], [64, 14]], z));
}
/** How far in from the map's south line the town stops (m), at x: held back by the lanes, the tea garden and the quay. */
function insetS(x: number): number {
  const v = 3 + 8 * wander(x / 24, 3) + 3 * wander(x / 8, 4);
  return Math.min(v, through([[-160, 14], [-153, 14], [-150, 9], [-77, 9], [-72, 3.5], [-31, 3.5], [-27, 8], [-6, 8], [-3, 14], [11, 14], [14, 3.5], [26, 3.5], [27, 7], [48, 7]], x));
}
/** The Galata Bridge's walkable deck ends at its bascule towers; beyond them the bridge goes on to Karaköy. */
export const BRIDGE_GATE_Z = 60.5;

/**
 * Beyond the town's edge (metres): the band between the wandering edge and the map's west and south lines, and the
 * bridge past its gates. Built up and planted like the rest of the town, but never walked: lanes end at a house
 * or a garden gate, the avenue and the quays at the roadworks' hoardings, the bridge at its towers.
 */
export function beyond(x: number, z: number): boolean {
  if (z > BRIDGE_GATE_Z && x > -23 && x < -13) return true;
  return x - MAP_W < insetW(z) || z - MAP_S < insetS(x);
}

// ------------------------------------------------------------------------------------------- path network

interface N { x: number; z: number; y?: number }

function network(): { nodes: Record<string, N>; edges: [string, string, number, K, number?, PathSeg['bazaar']?][]; links: [string, string][] } {
  const Q = QUAY_Y;
  const n: Record<string, N> = {
    // the Golden Horn quay, from the far west to Eminönü, and the Bosphorus quay south past Sirkeci
    q0: { x: -158, z: 40, y: Q }, q1: { x: -120, z: 40, y: Q }, q2: { x: -100, z: 40, y: Q }, q3: { x: -80, z: 40, y: Q }, q4: { x: -60, z: 40, y: Q },
    q5: { x: -40, z: 40, y: Q }, q6: { x: -18, z: 40, y: Q }, q7: { x: 2, z: 40, y: Q }, q8: { x: 26, z: 40, y: Q },
    b1: { x: 26, z: 14, y: Q }, b2: { x: 26, z: -2, y: Q }, b3: { x: 26, z: -16, y: Q }, b4: { x: 26, z: -46, y: Q }, b5: { x: 26, z: -80, y: Q }, b6: { x: 26, z: -110, y: Q },
    // the Galata Bridge across the Horn, and the ferry piers
    gb0: { x: -18, z: 46, y: 1.5 }, gb1: { x: -18, z: 63, y: 1.5 },
    fp0: { x: 32, z: -2, y: Q }, fp1: { x: 39.2, z: -2, y: PONTOON_Y }, fq0: { x: 32, z: -46, y: Q }, fq1: { x: 41, z: -46, y: Q },
    fh0: { x: -52, z: 46, y: Q }, fh1: { x: -52, z: 55, y: Q },
    // Eminönü square, the New Mosque's courtyard up its steps
    e0: { x: 20, z: 34, y: Q }, e1: { x: 6, z: 36, y: Q }, e2: { x: -8, z: 34, y: Q }, e3: { x: 20, z: 12, y: Q }, e4: { x: 20, z: -2, y: Q },
    y0: { x: 6, z: 31.5, y: Q }, y1: { x: 6, z: 28.5, y: YENI_Y }, y2: { x: 6, z: 22, y: YENI_Y },
    // the Spice Bazaar, an L of vaulted halls
    s0: { x: -12, z: 30, y: SPICE_Y }, s1: { x: -12, z: 25 }, s2: { x: -36, z: 25 }, s3: { x: -60, z: 25 }, s4: { x: -12, z: 6 }, s5: { x: -12, z: -12 },
    s6: { x: -60, z: 34, y: Q }, s7: { x: -66, z: 25 },
    // Hamidiye and the tram avenue through Sirkeci
    h0: { x: 20, z: -16, y: Q }, h1: { x: 4, z: -16 }, h2: { x: -12, z: -17 }, h3: { x: -30, z: -19 },
    t0: { x: 12, z: -2, y: Q }, t1: { x: 12, z: -16 }, t2: { x: 12, z: -46 }, t3: { x: 12, z: -80 }, t4: { x: 12, z: -110 },
    // cross streets climbing west from the Bosphorus
    c0: { x: -12, z: -48 }, c1: { x: -36, z: -52 }, c2: { x: -62, z: -58 },
    d0: { x: -14, z: -82 }, d1: { x: -40, z: -86 }, d2: { x: -66, z: -90 }, d3: { x: -94, z: -98 },
    // Uzunçarşı, the long market street up to the Grand Bazaar
    u1: { x: -48, z: -26 }, u2: { x: -70, z: -34 }, u3: { x: -94, z: -44 },
    // round the Grand Bazaar
    ga: { x: -92, z: -60 }, gb: { x: -92, z: -80 }, gc: { x: -96, z: -96 },
    gn1: { x: -114, z: -40 }, gn2: { x: -138, z: -40 },
    // inside the Grand Bazaar: two long halls and two cross halls
    i0: { x: -104, z: -60, y: BAZAAR_Y }, i1: { x: -114, z: -60, y: BAZAAR_Y }, i2: { x: -138, z: -60, y: BAZAAR_Y }, i3: { x: -150, z: -60, y: BAZAAR_Y },
    j0: { x: -104, z: -80, y: BAZAAR_Y }, j1: { x: -114, z: -80, y: BAZAAR_Y }, j2: { x: -138, z: -80, y: BAZAAR_Y }, j3: { x: -150, z: -80, y: BAZAAR_Y },
    k1: { x: -114, z: -44, y: BAZAAR_Y }, k2: { x: -138, z: -44, y: BAZAAR_Y }, k3: { x: -114, z: -97, y: BAZAAR_Y }, k4: { x: -138, z: -97, y: BAZAAR_Y },
    // up to the great mosque and its terrace over the Horn
    m0: { x: -112, z: -30 }, m1: { x: -112, z: -10, y: HILLTOP_Y }, m2: { x: -118, z: -10, y: HILLTOP_Y }, m3: { x: -137, z: 11, y: HILLTOP_Y },
    m4: { x: -112, z: 17, y: HILLTOP_Y }, m5: { x: -137, z: 17, y: HILLTOP_Y }, m6: { x: -152, z: 17, y: HILLTOP_Y },
    // the stairs down to the Horn, and the lanes of the north slope
    w0: { x: -96, z: 30 }, w1: { x: -92, z: 37 },
    n0: { x: -24, z: 8 }, n1: { x: -40, z: 7 }, n2: { x: -60, z: 6 }, n3: { x: -80, z: 4 }, n4: { x: -100, z: 2 },
    o1: { x: -40, z: 34 }, o2: { x: -80, z: 34 }, o3: { x: -40, z: -8 }, o4: { x: -80, z: -14 },
    // the wooden-house lanes of the south slope
    l0: { x: -14, z: -100 }, l1: { x: -40, z: -103 }, l2: { x: -66, z: -106 },
    l3: { x: -36, z: -70 }, l4: { x: -62, z: -74 }, l5: { x: -88, z: -78 },
    v1: { x: -54, z: -44 },
  };
  type E = [string, string, number, K, number?, PathSeg['bazaar']?];
  const e: E[] = [
    ['q0', 'q1', 7, K.Quay], ['q1', 'q2', 7, K.Quay], ['q2', 'q3', 7, K.Quay], ['q3', 'q4', 7, K.Quay], ['q4', 'q5', 7, K.Quay], ['q5', 'q6', 7, K.Quay], ['q6', 'q7', 7, K.Quay], ['q7', 'q8', 7, K.Quay],
    ['q8', 'b1', 7, K.Quay], ['b1', 'b2', 7, K.Quay], ['b2', 'b3', 7, K.Quay], ['b3', 'b4', 7, K.Quay], ['b4', 'b5', 7, K.Quay], ['b5', 'b6', 7, K.Quay],
    ['q6', 'gb0', 6, K.Bridge], ['gb0', 'gb1', 9, K.Bridge],
    ['b2', 'fp0', 4, K.Quay], ['fp0', 'fp1', 6, K.Pier], ['b4', 'fq0', 4, K.Quay], ['fq0', 'fq1', 6, K.Pier], ['q4', 'fh0', 4, K.Quay], ['fh0', 'fh1', 6, K.Pier],
    ['q8', 'e0', 4, K.Square], ['e0', 'e1', 4, K.Square], ['e1', 'e2', 4, K.Square], ['e0', 'e3', 4, K.Square], ['e3', 'e4', 4, K.Square], ['e1', 'q7', 4, K.Square], ['e2', 'q6', 4, K.Square],
    ['e1', 'y0', 4, K.Square], ['y0', 'y1', 6, K.Steps], ['y1', 'y2', 4, K.Court], ['e3', 'b1', 4, K.Square], ['e4', 'b2', 4, K.Square],
    ['e2', 's0', 4, K.Square], ['s0', 's1', 4, K.Street], ['s1', 's2', 4.5, K.Covered, HALL_S, 'spice'], ['s2', 's3', 4.5, K.Covered, HALL_S, 'spice'], ['s3', 's7', 4, K.Street], ['s3', 's6', 4, K.Street], ['s6', 'q4', 4, K.Quay],
    ['s1', 's4', 4.5, K.Covered, HALL_S, 'spice'], ['s4', 's5', 4.5, K.Covered, HALL_S, 'spice'], ['s5', 'h2', 4, K.Street],
    ['b3', 'h0', 6, K.Street], ['h0', 'h1', 6, K.Street], ['h1', 'h2', 6, K.Street], ['h2', 'h3', 6, K.Street], ['e4', 't0', 6, K.Square],
    ['t0', 't1', 9, K.Tram], ['t1', 't2', 9, K.Tram], ['t2', 't3', 9, K.Tram], ['t3', 't4', 9, K.Tram], ['h1', 't1', 6, K.Street],
    ['b4', 't2', 6, K.Street], ['t2', 'c0', 5, K.Street], ['c0', 'c1', 5, K.Street], ['c1', 'c2', 5, K.Street], ['c2', 'u3', 4, K.Lane],
    ['b5', 't3', 6, K.Street], ['t3', 'd0', 5, K.Street], ['d0', 'd1', 4.5, K.Lane], ['d1', 'd2', 4.5, K.Lane], ['d2', 'd3', 4.5, K.Lane], ['d3', 'gc', 4, K.Lane],
    ['h3', 'u1', 6, K.Street], ['u1', 'u2', 6, K.Street], ['u2', 'u3', 6, K.Street], ['u3', 'ga', 5, K.Street], ['ga', 'gb', 5, K.Street], ['gb', 'gc', 5, K.Street],
    ['u3', 'gn1', 5, K.Street], ['gn1', 'gn2', 5, K.Street],
    ['ga', 'i0', 4, K.Stair], ['i0', 'i1', 4, K.Covered, HALL_G, 'grand'], ['i1', 'i2', 4, K.Covered, HALL_G, 'grand'], ['i2', 'i3', 4, K.Covered, HALL_G, 'grand'],
    ['gb', 'j0', 4, K.Stair], ['j0', 'j1', 4, K.Covered, HALL_G, 'grand'], ['j1', 'j2', 4, K.Covered, HALL_G, 'grand'], ['j2', 'j3', 4, K.Covered, HALL_G, 'grand'],
    ['gn1', 'k1', 4, K.Street], ['k1', 'i1', 4, K.Covered, HALL_G, 'grand'], ['i1', 'j1', 4, K.Covered, HALL_G, 'grand'], ['j1', 'k3', 4, K.Covered, HALL_G, 'grand'],
    ['gn2', 'k2', 4, K.Street], ['k2', 'i2', 4, K.Covered, HALL_G, 'grand'], ['i2', 'j2', 4, K.Covered, HALL_G, 'grand'], ['j2', 'k4', 4, K.Covered, HALL_G, 'grand'],
    ['gn1', 'm0', 5, K.Street], ['m0', 'm1', 5, K.Street], ['m1', 'm2', 4, K.Court], ['m1', 'm4', 5, K.Street], ['m4', 'm5', 6, K.Terrace], ['m5', 'm6', 6, K.Terrace], ['m5', 'm3', 4, K.Court],
    ['m4', 'w0', 3, K.Stair], ['w0', 'w1', 3, K.Stair], ['w1', 'q2', 3, K.Lane], ['w0', 'n4', 3, K.Stair],
    ['s4', 'n0', 3, K.Lane], ['n0', 'n1', 3.4, K.Lane], ['n1', 'n2', 3.4, K.Lane], ['n2', 'n3', 3.4, K.Lane], ['n3', 'n4', 3.4, K.Lane],
    ['q5', 'o1', 3.4, K.Lane], ['o1', 'n1', 3.4, K.Lane], ['n1', 'o3', 3.4, K.Lane], ['o3', 'u1', 3.4, K.Lane],
    ['q3', 'o2', 3.4, K.Lane], ['o2', 'n3', 3.4, K.Lane], ['n3', 'o4', 3.4, K.Stair], ['o4', 'u2', 3.4, K.Lane],
    ['t4', 'l0', 4, K.Lane], ['l0', 'l1', 3.6, K.Lane], ['l1', 'l2', 3.6, K.Lane], ['l2', 'd3', 3, K.Stair],
    ['c1', 'l3', 3.4, K.Lane], ['l3', 'l4', 3.4, K.Lane], ['l4', 'l5', 3.4, K.Lane], ['l5', 'gb', 3, K.Stair],
    ['l3', 'd1', 3, K.Stair], ['l4', 'd2', 3, K.Stair], ['d0', 'l0', 3.4, K.Lane], ['c0', 'd0', 3.4, K.Lane],
    ['u1', 'v1', 3.4, K.Lane], ['v1', 'c1', 3.4, K.Lane], ['v1', 'c2', 3, K.Lane],
  ];
  // the promenade round the point and out onto the landing stages: walked by the crowd, laid by the waterfront
  // pass (they follow the outline, not a straight strip)
  Object.assign(n, {
    pr0: { x: 16, z: 44.2 }, pr1: { x: 24, z: 46.6 }, hp: { x: 20, z: 51.8 }, pr2: { x: 33.4, z: 41.2 },
    pr3: { x: 33, z: 30 }, pr4: { x: 31.4, z: 19 }, pr5: { x: 32, z: 8 },
  });
  const links: [string, string][] = [
    ['q7', 'pr0'], ['pr0', 'pr1'], ['q8', 'pr1'], ['pr1', 'hp'], ['pr1', 'pr2'], ['pr2', 'pr3'], ['pr3', 'pr4'], ['pr4', 'b1'],
    ['pr4', 'pr5'], ['pr5', 'fp0'],
  ];
  return { nodes: n, edges: e.filter(([a, b]) => n[a] && n[b]), links };
}

// ------------------------------------------------------------------------------------------- plan

let cached: Plan | null = null;

export const col = (x: number, z: number) => (z - VZ0) * SX + (x - VX0);
export const layerOf = (y: number) => G + Math.round(y / V);
export const inMap = (x: number, z: number) => x >= VX0 && z >= VZ0 && x < VX0 + SX && z < VZ0 + SZ;

export function istanbulPlan(): Plan {
  if (cached) return cached;
  const n = SX * SZ;
  const walk = new Uint8Array(n), kind = new Uint8Array(n), lot = new Uint16Array(n);
  const best = new Float32Array(n).fill(1e9);
  // natural ground, gradient all the way (voxel by voxel, never terraced); the water and its bed
  for (let z = VZ0; z < VZ0 + SZ; z++)
    for (let x = VX0; x < VX0 + SX; x++) {
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V, c = col(x, z);
      // (the old straight shore here: the waterfront pass builds Eminönü's out after the lots are placed, so the
      // town's houses fall exactly where they always have)
      if (lineDist(mx, mz) < 0) {
        walk[c] = seaBed(mx, mz);
        kind[c] = K.Sea;
      } else {
        walk[c] = Math.min(250, layerOf(hillY(mx, mz)));
        kind[c] = K.Ground;
      }
    }
  const { nodes, edges: paved, links } = network();
  const ids = Object.keys(nodes);
  const ny = (id: string) => nodes[id].y ?? Math.round(hillY(nodes[id].x, nodes[id].z) * 4) / 4;
  const edges: [string, string][] = [...paved.map(([a, b]) => [a, b] as [string, string]), ...links];
  const segs: PathSeg[] = paved.map(([a, b, w, k, roof, bz]) => ({
    a: [nodes[a].x, ny(a), nodes[a].z], b: [nodes[b].x, ny(b), nodes[b].z], w, kind: k, roof, bazaar: bz,
  }));
  for (const s of segs) paintSeg(s, walk, kind, best);
  // the steps keep their own grade whatever runs close by
  const own = new Float32Array(n).fill(1e9);
  for (const s of segs) if (s.kind === K.Steps || s.kind === K.Covered || s.kind === K.Bridge || s.kind === K.Pier) paintSeg(s, walk, kind, own);
  for (let i = 0; i < n; i++) if (own[i] < 1e9) best[i] = -1;
  // Eminönü square, the mosques' courtyards and the hilltop terrace are open, level squares
  rect(-12, 30, 26, 44, QUAY_Y, K.Square, walk, kind, best);
  rect(18, -4, 26, 30, QUAY_Y, K.Square, walk, kind, best);
  rect(YENI.court[0], YENI.court[1], YENI.court[2], YENI.court[3] - 0.25, YENI_Y, K.Court, walk, kind, best);
  rect(YENI.hall[0], YENI.hall[1], YENI.hall[2], YENI.hall[3], YENI_Y, K.Mosque, walk, kind, best);
  // the courtyard of the great mosque, its prayer hall and garden, and the terrace looking over the Horn
  rect(SULEY.precinct[0], SULEY.precinct[1], SULEY.precinct[2], SULEY.precinct[3], HILLTOP_Y, K.Park, walk, kind, best);
  rect(SULEY.court[0], SULEY.court[1], SULEY.court[2], SULEY.court[3], HILLTOP_Y, K.Court, walk, kind, best);
  rect(SULEY.hall[0], SULEY.hall[1], SULEY.hall[2], SULEY.hall[3], HILLTOP_Y, K.Mosque, walk, kind, best);
  rect(SULEY.terrace[0], SULEY.terrace[1], SULEY.terrace[2], SULEY.terrace[3], HILLTOP_Y, K.Terrace, walk, kind, best);
  // the station stands on its own block between the tram and the quay
  rect(STATION[0], STATION[1], STATION[2], STATION[3], QUAY_Y, K.Mosque, walk, kind, best);
  // the Grand Bazaar sits level on its ridge: everything inside it is at the bazaar's floor
  for (let z = Math.floor(GRAND[1] / V); z < Math.ceil(GRAND[3] / V); z++)
    for (let x = Math.floor(GRAND[0] / V); x < Math.ceil(GRAND[2] / V); x++) {
      const c = col(x, z);
      if (kind[c] !== K.Stair) walk[c] = layerOf(BAZAAR_Y); // the stairs up to its gates keep their grade
    }
  // past the town's edge the lanes and streets give way to houses and gardens (the avenue, the quays and the
  // bridge carry on, closed off by the builder at the edge)
  for (let z = VZ0; z < VZ0 + SZ; z++)
    for (let x = VX0; x < VX0 + SX; x++) {
      const c = col(x, z), k = kind[c];
      if ((k === K.Lane || k === K.Stair || k === K.Street) && beyond((x + 0.5) * V, (z + 0.5) * V)) { kind[c] = K.Ground; walk[c] = Math.min(250, layerOf(hillY((x + 0.5) * V, (z + 0.5) * V))); }
    }
  // every riser left where a street meets a square or a hall, or two paths cross on different grades, becomes steps
  regradePaths(walk, kind, { adjustable: new Set([K.Street, K.Lane, K.Stair]), fixed: new Set([K.Quay, K.Square, K.Steps, K.Covered, K.Court, K.Terrace, K.Tram, K.Mosque, K.Park]) });
  const lots = placeLots(walk, kind, lot, segs);
  waterfront(walk, kind, lot);
  // and every yard or strip of open ground above the street beside it gets steps up from it
  gardenFlights(walk, kind, lot, { ground: K.Ground, stair: K.Stair, path: (k) => isPath(k) && k !== K.Covered, wild: (x, z) => beyond((x + 0.5) * V, (z + 0.5) * V) });
  // the crowd's walking graph stops at the edge: a path running out of the town ends at its last walkable point
  const nodeList: [number, number][] = ids.map((id) => [nodes[id].x, nodes[id].z]);
  const index = new Map(ids.map((id, i) => [id, i]));
  const edgeList: [number, number][] = [];
  const out = (i: number) => beyond(nodeList[i][0], nodeList[i][1]);
  for (const [a, b] of edges) {
    let i = index.get(a)!, j = index.get(b)!;
    if (out(i) && out(j)) continue;
    if (out(i)) [i, j] = [j, i];
    if (out(j)) {
      const [ax, az] = nodeList[i], [bx, bz] = nodeList[j];
      let lo = 0, hi = 1;
      for (let k = 0; k < 20; k++) { const m = (lo + hi) / 2; if (beyond(ax + (bx - ax) * m, az + (bz - az) * m)) hi = m; else lo = m; }
      const len = Math.hypot(bx - ax, bz - az), f = Math.max(0, lo - 1.5 / Math.max(1, len));
      if (f * len < 2) continue;
      nodeList.push([ax + (bx - ax) * f, az + (bz - az) * f]);
      j = nodeList.length - 1;
    }
    edgeList.push([i, j]);
  }
  // and the nodes left past the edge with no path to them go
  const used = [...new Set(edgeList.flat())].sort((p, q) => p - q), remap = new Map(used.map((o, i) => [o, i]));
  cached = { walk, kind, lot, lots, segs, nodes: used.map((i) => nodeList[i]), edges: edgeList.map(([i, j]) => [remap.get(i)!, remap.get(j)!]) };
  return cached;
}

/**
 * Eminönü's waterfront, after the square and the quays are laid: the ground out to the new shore (see COAST) is
 * quay, a band of quay flags follows the water's edge round the point and the square's paving runs out to it, so
 * no trace of the old straight edge is left; then the landing stairs, the ferry jetty and the landing stages.
 */
function waterfront(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array): void {
  const Q = layerOf(QUAY_Y);
  const squareZone = (x: number, z: number) => (x >= -12 && z >= 30) || (x >= 18 && z >= -4);
  for (let z = Math.floor(-16 / V); z < VZ0 + SZ; z++)
    for (let x = Math.floor(-12 / V); x < VX0 + SX; x++) {
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V, c = col(x, z), k = kind[c];
      if (lot[c]) continue;
      if (shoreDist(mx, mz) < 0) {
        // the old ferry pier gives way to the jetty and its landing stage, laid below
        if (k === K.Pier && mx > 30 && Math.abs(mz + 2) < 4) { kind[c] = K.Sea; walk[c] = seaBed(mx, mz); }
        continue;
      }
      const fresh = k === K.Sea || (k === K.Ground && (lineDist(mx, mz) < 1 || (walk[c] === Q && squareZone(mx, mz))));
      if (!fresh && k !== K.Quay && k !== K.Square) continue;
      if (!fresh && walk[c] !== Q) continue;
      walk[c] = Q;
      kind[c] = shoreDist(mx, mz) < 2.4 ? K.Quay : squareZone(mx, mz) ? K.Square : K.Quay;
    }
  const paint = (r: Rect, f: (mx: number, mz: number, c: number) => void) => {
    for (let z = Math.round(r[1] / V); z < Math.round(r[3] / V); z++)
      for (let x = Math.round(r[0] / V); x < Math.round(r[2] / V); x++) if (inMap(x, z)) f((x + 0.5) * V, (z + 0.5) * V, col(x, z));
  };
  paint(JETTY, (_x, _z, c) => { kind[c] = K.Pier; walk[c] = Q; });
  for (const l of LANDINGS) paint(l.rect, (mx, mz, c) => { const s = landingStep(mx, mz)!; walk[c] = s.layer; kind[c] = s.cheek ? K.Quay : K.Landing; });
  for (const p of PONTOONS) for (const r of [p.gang, p.deck]) paint(r, (mx, mz, c) => { walk[c] = pontoonAt(mx, mz)!.layer; kind[c] = K.Pontoon; });
}

function rect(x0: number, z0: number, x1: number, z1: number, y: number, k: K, walk: Uint8Array, kind: Uint8Array, best: Float32Array): void {
  for (let z = Math.floor(z0 / V); z < Math.ceil(z1 / V); z++)
    for (let x = Math.floor(x0 / V); x < Math.ceil(x1 / V); x++) {
      if (!inMap(x, z)) continue;
      const c = col(x, z);
      walk[c] = layerOf(y);
      kind[c] = k;
      best[c] = -1;
    }
}

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
      const qx = ax + dx * t, qz = az + dz * t;
      const d = Math.hypot(px - qx, pz - qz);
      if (d > r) continue;
      const c = col(x, z);
      if (d >= best[c]) continue;
      best[c] = d;
      walk[c] = layerOf(ay + (by - ay) * t);
      kind[c] = s.kind;
    }
}

const PATHY = new Set<number>([K.Quay, K.Square, K.Street, K.Lane, K.Stair, K.Steps, K.Covered, K.Pier, K.Bridge, K.Court, K.Terrace, K.Tram, K.Landing, K.Pontoon]);
export const isPath = (k: number) => PATHY.has(k);

/**
 * Buildings along every street and lane, then on the patches of slope left between them. A frontage lot stands
 * with its face on the path's own level; on the slope its ground floor is cut into the hill behind. The bazaar
 * halls are lined with single-storey shops; the quays with the tall stone hans and hotels of the waterfront.
 */
function placeLots(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, segs: PathSeg[]): LotPlan[] {
  const lots: LotPlan[] = [];
  const r = rng(1453);
  const under = (k: number) => k === K.Covered;
  const inHall = new Map<number, [number, number, number][]>();
  const tryLot = (x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'] | null, frontLayer: number, use: LotUse, on: K): boolean => {
    if (!inMap(x0 - 1, z0 - 1) || !inMap(x1 + 1, z1 + 1) || x1 - x0 < 14 || z1 - z0 < 14) return false;
    let lo = 255, hi = 0, onHall = false;
    for (let z = z0 - 1; z <= z1 + 1; z++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        const c = col(x, z), k = kind[c];
        if (lot[c]) return false;
        if (use === 'bazaar' && under(k)) { if (x >= x0 && x <= x1 && z >= z0 && z <= z1) onHall = true; continue; }
        if (k !== K.Ground) return false;
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) { lo = Math.min(lo, walk[c]); hi = Math.max(hi, walk[c]); }
      }
    if (hi - lo > 24) return false;
    const base = side ? frontLayer : lo;
    const floors = use === 'bazaar' ? 1 : on === K.Quay || on === K.Tram ? 4 + Math.floor(r() * 2) : on === K.Street ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 2);
    let top = use === 'bazaar' ? base + 18 : Math.min(184, Math.max(hi + 10, base + 2 + floors * 12));
    // the roofs below the Süleymaniye's terrace stay low, so the terrace keeps its view over the Golden Horn
    const T = SULEY.terrace;
    if (x1 * V > T[0] - 4 && x0 * V < T[2] + 4 && z0 * V >= T[3] - 2 && z0 * V < HORN_Z) top = Math.min(top, Math.max(hi + 10, layerOf(HILLTOP_Y - 3.5)));
    const id = lots.length + 1;
    lots.push({ id, x0, z0, x1, z1, base, top, side: side ?? 's', door: side ? frontLayer : -1, seed: Math.floor(r() * 1e6), use, on });
    // a shop that landed in a hall (where a cross hall meets a long one) keeps its place while the rest of the
    // city is laid out, so every later lot comes out as it always has, and is taken away at the end
    if (onHall) { const saved: [number, number, number][] = []; for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = col(x, z); saved.push([c, kind[c], walk[c]]); } inHall.set(id, saved); }
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = col(x, z); lot[c] = id; kind[c] = K.Lot; walk[c] = base; }
    return true;
  };
  const front = (ax: number, az: number, bx: number, bz: number, half: number, k: K, y0: number, y1: number, sides: (1 | -1)[] = [1, -1], bazaar = false) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 3) return;
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    for (let t = 0.5; t < len - 2; ) {
      const w = bazaar ? 3.5 + r() * 1.5 : 5 + r() * 4, dep = bazaar ? 4 + r() * 1.5 : k === K.Quay || k === K.Tram ? 9 + r() * 4 : 6.5 + r() * 4;
      const f = (t + w / 2) / len;
      const cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, cy = y0 + (y1 - y0) * f;
      const use: LotUse = bazaar ? 'bazaar' : k === K.Street || k === K.Tram || k === K.Square ? (r() < 0.85 ? 'shop' : 'house') : k === K.Quay ? (r() < 0.6 ? 'han' : 'shop') : r() < 0.25 ? 'shop' : 'house';
      for (const sd of sides) {
        const off = half + 0.5;
        let x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'];
        if (alongX) {
          x0 = cx - w / 2; x1 = cx + w / 2;
          if (sd > 0) { z0 = cz + off; z1 = z0 + dep; side = 'n'; } else { z1 = cz - off; z0 = z1 - dep; side = 's'; }
        } else {
          z0 = cz - w / 2; z1 = cz + w / 2;
          if (sd > 0) { x0 = cx + off; x1 = x0 + dep; side = 'w'; } else { x1 = cx - off; x0 = x1 - dep; side = 'e'; }
        }
        tryLot(Math.round(x0 / V), Math.round(z0 / V), Math.round(x1 / V) - 1, Math.round(z1 / V) - 1, side, layerOf(Math.round(cy * 4) / 4), use, k);
      }
      t += w + (bazaar ? 0 : r() < 0.15 ? 1.5 + r() * 2 : 0.25);
    }
  };
  // the bazaars first: their halls are lined wall to wall
  for (const s of segs) if (s.kind === K.Covered) front(s.a[0], s.a[2], s.b[0], s.b[2], s.w / 2, K.Covered, s.a[1], s.b[1], [1, -1], true);
  // the waterfront: tall buildings facing the water across the quay
  for (const s of segs) if (s.kind === K.Quay && s.w >= 7) front(s.a[0], s.a[2], s.b[0], s.b[2], s.w / 2, K.Quay, s.a[1], s.b[1], Math.abs(s.b[0] - s.a[0]) > Math.abs(s.b[2] - s.a[2]) ? [-1] : [-1, 1].filter((v) => v === -1) as (1 | -1)[]);
  for (const s of segs) if (s.kind === K.Tram || s.kind === K.Street || s.kind === K.Lane || s.kind === K.Stair) front(s.a[0], s.a[2], s.b[0], s.b[2], s.w / 2, s.kind, s.a[1], s.b[1]);
  // round Eminönü square
  front(-12, 30, -4, 30, 0, K.Square, QUAY_Y, QUAY_Y, [-1]);
  // an apron of paving from each front door to its street, over the strip of hillside left between them
  for (const l of lots) {
    if (l.door < 0) continue;
    const [ox, oz] = l.side === 'n' ? [0, -1] : l.side === 's' ? [0, 1] : l.side === 'w' ? [-1, 0] : [1, 0];
    const ns = l.side === 'n' || l.side === 's';
    const a0 = ns ? l.x0 : l.z0, a1 = ns ? l.x1 : l.z1;
    const edge = l.side === 'n' ? l.z0 : l.side === 's' ? l.z1 : l.side === 'w' ? l.x0 : l.x1;
    for (let a = a0; a <= a1; a++)
      for (let k = 1; k <= 5; k++) {
        const e = edge + (ns ? oz : ox) * k;
        const x = ns ? a : e, z = ns ? e : a;
        if (!inMap(x, z)) break;
        const c = col(x, z);
        if (kind[c] !== K.Ground) break;
        kind[c] = l.on; walk[c] = l.door; // under a hall the apron is the hall's own floor
      }
  }
  // back lots on the slope between the streets
  for (let gz = VZ0 + 6; gz < VZ0 + SZ - 10; gz += 5)
    for (let gx = VX0 + 6; gx < VX0 + SX - 10; gx += 5) {
      const c = col(gx, gz);
      if (kind[c] !== K.Ground || lot[c]) continue;
      if (lineDist(gx * V, gz * V) < 3) continue;
      const w = 18 + Math.floor(r() * 18), d = 18 + Math.floor(r() * 16);
      tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, 'house', K.Ground);
    }
  // the bazaar halls lined wall to wall before the yards fill up
  bazaarInfill(walk, kind, lot, segs, lots);
  // the old city is built up: the bigger yards left between the houses get a house of their own (a few stay open,
  // and the ground round the mosques and the waterfront is kept clear for the views)
  let infill = 0;
  // (the Grand Bazaar's courtyards between its halls stay open, and so does the tea garden on the Bosphorus)
  const inGrand = (x: number, z: number) => (x * V > GRAND[0] - 6 && x * V < GRAND[2] + 2 && z * V > GRAND[1] - 6 && z * V < GRAND[3] + 2) || (x * V > 12 && x * V < 25 && z * V > -112 && z * V < -82);
  for (let gz = VZ0 + 4; gz < VZ0 + SZ - 20 && infill < 60; gz += 4)
    for (let gx = VX0 + 4; gx < VX0 + SX - 20 && infill < 60; gx += 4) {
      const c = col(gx, gz);
      if (kind[c] !== K.Ground || lot[c] || beyond((gx + 8) * V, (gz + 8) * V) || r() < 0.3) continue;
      if (lineDist(gx * V, gz * V) < 10 || inGrand(gx, gz)) continue;
      const w = 16 + Math.floor(r() * 12), d = 16 + Math.floor(r() * 12);
      if (tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, 'house', K.Ground)) infill++;
    }
  // then narrower houses into the wedges left where a street runs on the slant
  for (let gz = VZ0 + 4; gz < VZ0 + SZ - 16 && infill < 110; gz += 3)
    for (let gx = VX0 + 4; gx < VX0 + SX - 16 && infill < 110; gx += 3) {
      const c = col(gx, gz);
      if (kind[c] !== K.Ground || lot[c] || beyond((gx + 6) * V, (gz + 6) * V) || r() < 0.2) continue;
      if (lineDist(gx * V, gz * V) < 10 || inGrand(gx, gz)) continue;
      const w = 14 + Math.floor(r() * 6), d = 14 + Math.floor(r() * 6);
      if (tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, 'house', K.Ground)) infill++;
    }
  // past the town's edge the houses stand shoulder to shoulder, so the town reads as going on over the hill
  for (let gz = VZ0 + 1; gz < VZ0 + SZ - 15; gz += 3)
    for (let gx = VX0 + 1; gx < VX0 + SX - 15; gx += 3) {
      const c = col(gx, gz);
      if (kind[c] !== K.Ground || lot[c] || !beyond((gx + 8) * V, (gz + 8) * V)) continue;
      const w = 14 + Math.floor(r() * 14), d = 14 + Math.floor(r() * 14);
      tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, 'house', K.Ground);
    }
  // the shops standing in the halls go, the hall floor comes back, and the lots are numbered afresh
  for (const saved of inHall.values()) for (const [c, k, w] of saved) { kind[c] = k; walk[c] = w; lot[c] = 0; }
  const kept = lots.filter((l) => !inHall.has(l.id));
  const renum = new Map(kept.map((l, i) => [l.id, i + 1]));
  for (let i = 0; i < lot.length; i++) if (lot[i]) lot[i] = renum.get(lot[i]) ?? 0;
  kept.forEach((l, i) => { l.id = i + 1; });
  return kept;
}

/**
 * The bazaar halls lined wall to wall: the first pass leaves every other shop out (each lot wants a free ring
 * round it), so the gaps get their shops here, side by side, with their own draws so the rest of the city keeps
 * its lots.
 */
function bazaarInfill(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, segs: PathSeg[], lots: LotPlan[]): void {
  const r = rng(1461);
  const free = (x: number, z: number) => inMap(x, z) && !lot[col(x, z)] && kind[col(x, z)] === K.Ground && !beyond((x + 0.5) * V, (z + 0.5) * V);
  for (const s of segs) {
    if (s.kind !== K.Covered) continue;
    const alongX = Math.abs(s.b[0] - s.a[0]) >= Math.abs(s.b[2] - s.a[2]);
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const off = s.w / 2 + 0.5;
    const u0 = Math.round(Math.min(alongX ? ax : az, alongX ? bx : bz) / V), u1 = Math.round(Math.max(alongX ? ax : az, alongX ? bx : bz) / V) - 1;
    for (const sd of [1, -1] as const) {
      // voxel of the front row, and the cell (u, k rows back) in world voxels
      const axis = alongX ? az : ax;
      const front = sd > 0 ? Math.round((axis + off) / V) : Math.round((axis - off) / V) - 1;
      const cell = (u: number, k: number): [number, number] => (alongX ? [u, front + sd * k] : [front + sd * k, u]);
      const colFree = (u: number) => { for (let k = 0; k < 15; k++) { const [x, z] = cell(u, k); if (!free(x, z)) return false; } return true; };
      for (let u = u0; u <= u1; ) {
        if (!colFree(u)) { u++; continue; }
        let e = u;
        while (e + 1 <= u1 && colFree(e + 1)) e++;
        const L = e - u + 1;
        if (L >= 15) {
          const n = Math.max(1, Math.round(L / 18));
          for (let i = 0; i < n; i++) {
            const a0 = u + Math.floor((i * L) / n), a1 = u + Math.floor(((i + 1) * L) / n) - 1;
            const want = 16 + Math.floor(r() * 6), seed = Math.floor(r() * 1e6);
            let dep = 15;
            while (dep < want) { let ok = true; for (let a = a0; a <= a1 && ok; a++) { const [x, z] = cell(a, dep); ok = free(x, z); } if (!ok) break; dep++; }
            const [px, pz] = cell(a0, 0), [qx, qz] = cell(a1, dep - 1);
            const t = Math.max(0, Math.min(1, (((a0 + a1 + 1) / 2) * V - (alongX ? ax : az)) / ((alongX ? bx - ax : bz - az) || 1)));
            const base = layerOf(Math.round((ay + (by - ay) * t) * 4) / 4);
            const id = lots.length + 1;
            const side: LotPlan['side'] = alongX ? (sd > 0 ? 'n' : 's') : (sd > 0 ? 'w' : 'e');
            const lp: LotPlan = { id, x0: Math.min(px, qx), z0: Math.min(pz, qz), x1: Math.max(px, qx), z1: Math.max(pz, qz), base, top: base + 18, side, door: base, seed, use: 'bazaar', on: K.Covered };
            lots.push(lp);
            for (let z = lp.z0; z <= lp.z1; z++) for (let x = lp.x0; x <= lp.x1; x++) { const c = col(x, z); lot[c] = id; kind[c] = K.Lot; walk[c] = base; }
            // the strip between the shop and the hall is the hall's floor
            for (let a = a0; a <= a1; a++)
              for (let k = 1; k <= 4; k++) {
                const [x, z] = cell(a, -k);
                if (!inMap(x, z) || kind[col(x, z)] !== K.Ground || lot[col(x, z)]) break;
                kind[col(x, z)] = K.Covered; walk[col(x, z)] = base;
              }
          }
        }
        u = e + 1;
      }
    }
  }
}

/** Deterministic pick from the plan alone (every worker agrees). */
export const planHash = (x: number, z: number, s: number) => hash3(x, s, z);
