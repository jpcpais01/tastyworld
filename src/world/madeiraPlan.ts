import { G, V, VX0, VZ0, SX, SZ } from './layout';
import { hash3, rng } from './grid';
import { regradePaths, gardenFlights } from './regrade';

/**
 * Funchal's ground plan: the old town and the seafront, the amphitheatre of hills behind, the paths across them and
 * the house lots on them, worked out once for the whole map from pure functions of position (never from the voxel
 * grid), so every world worker builds the same town whatever strip of it it keeps.
 *
 * As in Amalfi the sea lies to the east of the map (+x) and inland is -x; along the coast -z is west (the marina,
 * Avenida Arriaga and the hotels) and +z is east (the market over the Ribeira de João Gomes, the Zona Velha and the
 * yellow fort of São Tiago). The downtown is a flat apron of black basalt and white plaster between the Sé and the
 * sea; behind it the hills climb in terraces of bananas and vines, cut by the walled ravine of the ribeira.
 */

/** What the surface of a column is. */
export const enum K {
  Rock, Sea, Sand, Quay, Road, Walk, Piazza, Street, Stair, Lane, Garden, Lot, Tunnel, Covered, Pier, Steps, Shingle, Church, Channel,
}

export interface PathSeg {
  a: [number, number, number];
  b: [number, number, number];
  /** Width (m). */
  w: number;
  kind: K;
  /** Roofed over (a covered passage or a tunnel): the builder vaults it and keeps the space above it free. */
  roof?: number;
  /** A covered passage's open ends (at a, at b): cut square and framed as a portal instead of rounded off. */
  portal?: [boolean, boolean];
  /** A levada runs along this lane, its little stone channel on the uphill side. */
  levada?: boolean;
}

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
  /** Lots along the squares and the main streets have shops downstairs. */
  shop: boolean;
  /** A restaurant downstairs (its stall id): a walkable room on the level of the path, its door open. */
  food?: string;
  /** A hotel (its id): a lobby downstairs on the level of the path and guest rooms on the floors above. */
  hotel?: string;
  /** Guest floors above the lobby. */
  guestFloors?: number;
  /** The house whose painted door hides the secret kitchen. */
  secret?: boolean;
  /** On Rua de Santa Maria: its door is painted (the Arte de Portas Abertas). */
  painted?: boolean;
}

export interface Plan {
  walk: Uint8Array;
  kind: Uint8Array;
  lot: Uint16Array;
  lots: LotPlan[];
  segs: PathSeg[];
  nodes: [number, number][];
  edges: [number, number][];
  /** Columns of natural crag (none in Funchal's town: kept for the shared tools). */
  crag: Uint8Array;
  /** Columns of the ribeira's walled channel, bridges included. */
  chan: Uint8Array;
}

// ------------------------------------------------------------------------------------------- terrain

export const SEA_Y = -0.55;
export const ROAD_Y = 2.0;
export const PIAZZA_Y = 3.0;
/** The Sé stands on the level of its square (the name is shared with the builder it grew from). */
export const DUOMO_Y = 3.0;
/** Avenida do Mar (x) and the promenade seaward of it. */
export const ROAD_X0 = 27, ROAD_X1 = 35, PROM_X1 = 39.75;
/** The marina: its breakwater is a curved arm round (MAR_CX, MAR_CZ), between radii MAR_R0 and MAR_R1, from MAR_A0 to MAR_A1. */
export const MAR_CX = 39.5, MAR_CZ = -44, MAR_R0 = 21, MAR_R1 = 25, MAR_A0 = -Math.PI / 2, MAR_A1 = 0.9;
/** Largo da Sé and the Sé on it (m). */
export const LARGO: [number, number, number, number] = [-10, -42, 14, -12];
export const SE: [number, number, number, number] = [-42, -38, -11, -18];
/** The Sé's tower at the north-east corner of the nave (m). */
export const SE_TOWER: [number, number, number, number] = [-22, -18, -17, -13];
/** The market and the square in front of it. */
export const MERCADO: [number, number, number, number] = [-27, 23, -4, 45];
export const LAVRADORES: [number, number, number, number] = [-4, 23, 12, 34];
/** The garden on the seafront with the cable car's station, and the fort. */
export const JARDIM: [number, number, number, number] = [12, 23, 26, 50];
export const TELE: [number, number, number, number] = [14, 38, 23, 48];
export const FORT_C: [number, number] = [47, 76];
export const LEVADA_Y = 27;
/** The ribeira's channel: half width (m) and its line (z at x). */
export const RIB_HALF = 3.5;
export function ribZ(x: number): number {
  return 15 + 1.8 * Math.sin(x * 0.045) + (x < -40 ? 5 * Math.sin((x + 40) * 0.028) : 0);
}
/** The channel's bed: below the sea's level through town (the tide reaches in), climbing in weirs inland. */
export function bedY(x: number): number {
  return x > -16 ? -1.3 : -1.3 + Math.floor((-16 - x) / 6) * 0.75;
}

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Where the amphitheatre of hills begins (x) at z: the flat downtown lies seaward of it. */
export const hillEdge = (z: number) => -46 + 6 * Math.sin(z * 0.045 + 0.7) + 3 * Math.sin(z * 0.11) + 10 * smooth(40, 80, z) * 0;

/** The hills without the ravine: the downtown apron rising gently, then the amphitheatre climbing in folds. */
export function hillBase(x: number, z: number): number {
  const plain = ROAD_Y + Math.max(0, ROAD_X0 - x) * 0.03;
  const t = Math.max(0, hillEdge(z) - x);
  // the foot of the hill eases out of the plain, steepens through the terraces, and leans back near the top
  let h = plain + 33 * (1 - Math.exp(-((t / 34) ** 1.6))) + t * 0.03;
  // the Zona Velha rises towards Santa Maria Maior and the slopes of Socorro at the east end
  h += 2.5 * smooth(52, 86, z) * smooth(12, -30, x);
  h += (Math.sin(x * 0.11 + z * 0.05) + Math.sin(z * 0.13 - x * 0.04)) * 0.9 * smooth(0, 8, t);
  return h;
}

/** Natural ground height (m) before anything is built: the hills, with the ribeira's ravine cut into them inland. */
export function hillY(x: number, z: number): number {
  const h = hillBase(x, z);
  const k = smooth(-20, -48, x);
  if (k <= 0) return h;
  const dz = Math.abs(z - ribZ(x));
  const bank = bedY(x) + 3.5 + Math.max(0, dz - RIB_HALF - 1) * 1.25;
  return h + (Math.min(h, bank) - h) * k;
}

/** Kept for the shared far-terrain code: Funchal has no headland in its map. */
export function headlandY(_x: number, _z: number): number { return -99; }
export function footY(_x: number, _z: number): number { return Infinity; }
export function isFoot(_x: number, _z: number): boolean { return false; }
export function valleyZ(x: number): number { return ribZ(x); }

/** Inside the marina's breakwater (the basin), on it, or outside it: radius and angle round its centre. */
export function marinaPolar(x: number, z: number): { r: number; a: number } {
  return { r: Math.hypot(x - MAR_CX, z - MAR_CZ), a: Math.atan2(z - MAR_CZ, x - MAR_CX) };
}
/** The breakwater's walk at angle a: its inner and outer radius, wandering a little so no stretch is ruler-straight. */
export function moleRadii(a: number): [number, number] {
  const w = Math.sin(a * 3.1 + 0.4) * 0.8 + Math.sin(a * 7.3) * 0.35;
  return [MAR_R0 + w, MAR_R1 + w * 0.6];
}

/** The fort's trace: a ring of curtain walls with four arrowhead bastions, turned so none faces square to the sea. */
export function fortR(a: number): number {
  const q = Math.cos(4 * (a - 0.3));
  return 9 + 3.2 * Math.max(0, q) ** 6 + 0.4 * Math.sin(a * 3 + 1);
}
export const inFort = (x: number, z: number) => x > PROM_X1 + 0.5 && Math.hypot(x - FORT_C[0], z - FORT_C[1]) <= fortR(Math.atan2(z - FORT_C[1], x - FORT_C[0]));

/** The water's edge seaward of the promenade (x at z). */
export const waterX = (z: number) => 46 + 3.5 * Math.sin(z * 0.071 + 0.4) + 2 * Math.sin(z * 0.19 + 1.1);

/** Height of the sea bed and the shore (m), seaward of the promenade. */
export function shoreY(x: number, z: number): number {
  const { r, a } = marinaPolar(x, z);
  const inArc = a >= MAR_A0 - 0.05 && a <= MAR_A1;
  // the basin: deep water for the yachts
  if (inArc && r < moleRadii(a)[0] && x > PROM_X1 - 0.5) return -3.5;
  // the breakwater's armour of black boulders, falling to the sea bed
  if (inArc) return Math.min(ROAD_Y - 0.25, ROAD_Y - (r - moleRadii(a)[1]) * 1.1 + (hash3(Math.floor(x), 3, Math.floor(z)) - 0.5) * 0.9) - 0.25;
  const wl = waterX(z), d = x - wl;
  const n = (Math.sin(x * 0.9 + z * 0.37) + Math.sin(z * 0.71 - x * 0.53)) * 0.35;
  // the pebble beach of black basalt under the old town, rocks and boulders elsewhere
  const beach = smooth(18, 24, z) * smooth(62, 56, z);
  const rocks = SEA_Y + 0.4 - d * 0.45 + n + (hash3(Math.floor(x * 0.8), 1, Math.floor(z * 0.8)) - 0.5) * 0.9;
  const pebbles = SEA_Y + 0.35 - d * 0.22;
  const y = rocks * (1 - beach) + pebbles * beach;
  return Math.max(-9, Math.min(1.25, y, d > 0 ? -0.9 - d * 0.18 + n * 0.3 : 9));
}

/**
 * The town's restaurants, cafés and bakeries (stall ids). Each is a house whose ground floor is a walkable room on
 * the level of the path in front: `near` is a point just off that path where the middle of its front should be,
 * `w` its frontage and `dep` its depth (m). The plan finds the closest street, lane or square edge and stands the
 * house a step back from it, with a strip of paving to its door.
 */
export const FOOD_PLACES: { id: string; near: [number, number]; w: number; dep: number; secret?: boolean }[] = [
  { id: 'cafe', near: [10, -11], w: 6.5, dep: 6.5 },
  { id: 'pastelaria', near: [-4.5, -11], w: 6.5, dep: 6 },
  { id: 'espetada', near: [-24, -46.5], w: 7, dep: 6.5 },
  { id: 'espada', near: [6, 61], w: 7, dep: 6.5 },
  { id: 'atum', near: [25.5, -70], w: 7, dep: 4.75 },
  { id: 'tasca', near: [11.5, 66], w: 6.5, dep: 6 },
  { id: 'adega', near: [-20, 6.5], w: 7, dep: 6 },
  { id: 'picado', near: [-34, 25], w: 6.5, dep: 6 },
  { id: 'segredo', near: [11.5, 82], w: 6, dep: 6, secret: true },
  { id: 'mercado', near: [-22, 39], w: 6.5, dep: 6 },
  { id: 'churrasqueira', near: [-1, -59], w: 6.5, dep: 6 },
  { id: 'taberna', near: [-29, 60], w: 6.5, dep: 6 },
  { id: 'cha', near: [9, 32], w: 6.5, dep: 6 },
  { id: 'gelataria', near: [13, -3], w: 6.5, dep: 6 },
  { id: 'snack', near: [-43, -24], w: 6.5, dep: 6 },
];

/** The six hotels, placed the same way: a lobby on the path, `rooms` guest floors above it. */
export const HOTEL_PLACES: { id: string; near: [number, number]; w: number; dep: number; rooms: number }[] = [
  { id: 'jacaranda', near: [-2, -72], w: 7.5, dep: 7, rooms: 3 },
  { id: 'cais', near: [25.5, -36], w: 7, dep: 4.75, rooms: 3 },
  { id: 'santamaria', near: [6, 44], w: 6.5, dep: 6, rooms: 2 },
  { id: 'bordado', near: [10.5, -80], w: 7, dep: 6.5, rooms: 3 },
  { id: 'se', near: [16, -36], w: 6.5, dep: 5, rooms: 2 },
  { id: 'monte', near: [-30, -6], w: 7, dep: 6.5, rooms: 2 },
];

// ------------------------------------------------------------------------------------------- path network

/** Named spots of the walking network (metres). The y of each comes from the terrain unless given. */
interface N { x: number; z: number; y?: number }

function network(): { nodes: Record<string, N>; edges: [string, string, number, K, number?][]; levada: Set<string> } {
  const n: Record<string, N> = {};
  const e: [string, string, number, K, number?][] = [];
  const levada = new Set<string>();
  const add = (id: string, x: number, z: number, y?: number) => { n[id] = { x, z, ...(y !== undefined ? { y } : {}) }; return id; };
  const line = (tag: string, pts: [number, number, number?][], w: number, k: K) => {
    pts.forEach(([x, z, y], i) => { add(`${tag}${i}`, x, z, y); if (i) e.push([`${tag}${i - 1}`, `${tag}${i}`, w, k]); });
  };
  const rz = ribZ(31);
  // Avenida do Mar and the promenade along the sea, bridging the ribeira's mouth
  line('r', [[31, -87.5, ROAD_Y], [31, -60, ROAD_Y], [31, -27, ROAD_Y], [31, -5, ROAD_Y], [31, rz, ROAD_Y], [31, 40, ROAD_Y], [31, 66, ROAD_Y], [31, 87.5, ROAD_Y]], 7.5, K.Road);
  line('w', [[37.25, -87.5, ROAD_Y], [37.25, -66, ROAD_Y], [37.25, -27, ROAD_Y], [37.25, rz, ROAD_Y], [37.25, 40, ROAD_Y], [37.25, 66, ROAD_Y], [37.25, 87.5, ROAD_Y]], 5, K.Walk);
  e.push(['r2', 'w2', 3, K.Walk], ['r4', 'w3', 3, K.Walk], ['r5', 'w4', 3, K.Walk], ['r6', 'w5', 3, K.Walk]);
  // Avenida Arriaga, the jacaranda boulevard, from the west end to the Largo da Sé
  line('aa', [[4, -87.5], [4, -64], [4, -42, PIAZZA_Y]], 10, K.Street);
  // Rua da Alfândega behind the seafront, parallel to it
  line('al', [[19.5, -87.5], [19.5, -60], [19.5, -42, PIAZZA_Y], [19.5, -27], [19.5, -12], [19.5, ribZ(19.5) - RIB_HALF - 2.4]], 4.2, K.Street);
  // the street down from the Largo to the avenue, and the side streets off the boulevard
  line('ld', [[14, -27, PIAZZA_Y], [19.5, -27], [27.5, -27, ROAD_Y]], 5, K.Street);
  line('a1', [[-1, -64], [19.5, -60]], 3.6, K.Street);
  e.push(['a11', 'al1', 3.6, K.Street], ['aa1', 'a10', 3.6, K.Street]);
  line('a2', [[19.5, -60], [27.5, -60, ROAD_Y]], 3.6, K.Street);
  e.push(['al1', 'a20', 3.6, K.Street]);
  // Rua do Aljube from the Largo over the ribeira to the market square
  line('aj', [[2, -12, PIAZZA_Y], [2, ribZ(2) - RIB_HALF - 2.4], [2, ribZ(2) + RIB_HALF + 2.4], [2, 23, PIAZZA_Y]], 4.4, K.Street);
  // the two banks of the ribeira, from the avenue inland, and the bridges over it
  const bank = (side: 1 | -1, tag: string) => {
    const xs = [27.5, 12, 2, -12, -26, -40, -54];
    xs.forEach((x, i) => { add(`${tag}${i}`, x, ribZ(x) + side * (RIB_HALF + 2.4), i === 0 ? ROAD_Y : undefined); if (i) e.push([`${tag}${i - 1}`, `${tag}${i}`, 4, K.Street]); });
  };
  bank(-1, 'bs'); bank(1, 'bn');
  e.push(['bs0', 'r4', 4, K.Street], ['bn0', 'r4', 4, K.Street]);
  for (const i of [3, 5]) e.push([`bs${i}`, `bn${i}`, 4.2, K.Street]);
  e.push(['bs2', 'aj1', 4, K.Street], ['bn2', 'aj2', 4, K.Street], ['bs1', 'al5', 4, K.Street]);
  // Rua dos Ferreiros and Rua do Bispo, either side of the Sé, climbing inland
  line('fe', [[-10, -12, PIAZZA_Y], [-30, -10], [-48, -8], [-70, -6]], 4.2, K.Street);
  line('bi', [[-10, -42, PIAZZA_Y], [-30, -44], [-48, -47], [-70, -50]], 4.2, K.Street);
  e.push(['fe0', 'aj0', 4.2, K.Street]);
  // the Zona Velha: Rua de Santa Maria from the market square to the east end, and the lanes off it
  line('sm', [[9, 34, PIAZZA_Y], [9, 50], [8, 66], [9, 87.5]], 4.2, K.Street);
  line('z1', [[9, 58], [27.5, 58, ROAD_Y]], 3.4, K.Street);
  line('z2', [[8, 74], [27.5, 74, ROAD_Y]], 3.4, K.Street);
  line('z3', [[9, 56], [-12, 56], [-30, 58], [-48, 60]], 3.4, K.Lane);
  line('z4', [[8.5, 76], [-12, 77], [-30, 78], [-48, 79]], 3.4, K.Lane);
  e.push(['sm1', 'z10', 3.4, K.Street], ['sm2', 'z20', 3.4, K.Street]);
  // the market square's crossing points (it is painted as a plaza below)
  add('lv0', 4, 28.5, PIAZZA_Y); add('lv1', 11, 28.5, PIAZZA_Y); add('lv2', -3, 34, PIAZZA_Y);
  e.push(['aj3', 'lv0', 3, K.Piazza], ['lv0', 'lv1', 3, K.Piazza], ['lv0', 'sm0', 3, K.Piazza], ['lv0', 'lv2', 3, K.Piazza], ['bn2', 'lv0', 3, K.Piazza]);
  // the garden on the seafront, from the square to the avenue
  add('jd0', 19, 30, PIAZZA_Y); add('jd1', 27.5, 30, ROAD_Y);
  e.push(['lv1', 'jd0', 3, K.Walk], ['jd0', 'jd1', 3, K.Walk]);
  // the Largo da Sé's crossing points
  add('ls0', 2, -27, PIAZZA_Y); add('ls1', -8, -27, PIAZZA_Y);
  e.push(['ld0', 'ls0', 3, K.Piazza], ['ls0', 'ls1', 3, K.Piazza], ['ls0', 'aj0', 3, K.Piazza], ['ls0', 'aa2', 3, K.Piazza], ['ls0', 'al2', 3, K.Piazza], ['fe0', 'ls1', 3, K.Piazza], ['bi0', 'ls1', 3, K.Piazza]);
  // the breakwater: out along its arm to the light at the end
  for (let i = 0; i <= 8; i++) {
    const a = MAR_A0 + (MAR_A1 - 0.2 - MAR_A0) * (i / 8), [r0, r1] = moleRadii(a), r = (r0 + r1) / 2;
    add(`mo${i}`, MAR_CX + Math.cos(a) * r, MAR_CZ + Math.sin(a) * r, ROAD_Y);
    if (i) e.push([`mo${i - 1}`, `mo${i}`, 2.6, K.Pier]);
  }
  e.push(['w1', 'mo0', 3, K.Walk]);
  // the hillside: contour lanes along the amphitheatre at fixed heights, joined by flights of steps; one of them
  // follows a levada round the hill
  const levels = [9, 14, 19.5, LEVADA_Y, 32];
  const at = (z: number, y: number) => { for (let x = 20; x > -111; x -= 0.25) if (hillBase(x, z) >= y) return x; return -111; };
  let prev: string[] = [];
  levels.forEach((y, li) => {
    const ids: string[] = [];
    for (let i = 0, z = -84 + (li % 2) * 4; z <= 85; z += 12, i++) {
      const id = add(`h${li}_${i}`, at(z, y), z, y);
      ids.push(id);
      if (i) { e.push([ids[i - 1], id, y === LEVADA_Y ? 2.4 : 2.6, K.Lane]); if (y === LEVADA_Y) levada.add(`${ids[i - 1]}|${id}`); }
    }
    if (li > 0) for (let i = li % 2; i < ids.length; i += 2) e.push([prev[Math.min(prev.length - 1, i)], ids[i], 2.2, K.Stair]);
    prev = ids;
  });
  // nothing of the lanes runs through the market or the Sé
  const nearest = (tag: string, x: number, z: number) => {
    let best = '', bd = 1e9;
    for (const [id, p] of Object.entries(n)) if (id.startsWith(tag) && Math.hypot(p.x - x, p.z - z) < bd) { bd = Math.hypot(p.x - x, p.z - z); best = id; }
    return best;
  };
  // the feet of the hill: the streets climbing inland end on the lowest lane, and steps tie the rest down
  e.push(['fe3', nearest('h0_', -70, -6), 2.6, K.Stair], ['bi3', nearest('h0_', -70, -50), 2.6, K.Stair],
    ['bs6', nearest('h0_', -54, 8), 2.6, K.Stair], ['bn6', nearest('h0_', -54, 24), 2.6, K.Stair],
    ['z33', nearest('h0_', -48, 60), 2.6, K.Stair], ['z43', nearest('h0_', -48, 79), 2.6, K.Stair]);
  e.push([nearest('aa', 4, -87), nearest('h0_', -48, -84), 2.6, K.Lane]);
  return { nodes: n, edges: e.filter(([a, b]) => n[a] && n[b]), levada };
}

// ------------------------------------------------------------------------------------------- plan

let cached: Plan | null = null;

export const col = (x: number, z: number) => (z - VZ0) * SX + (x - VX0);
export const layerOf = (y: number) => G + Math.round(y / V);

/** The wild hillside (voxel column, its ground layer): above the levada the slope is laurel wood, and the ribeira's gorge inland is bare rock. */
export const wildRock = (x: number, z: number, w: number) =>
  x * V > ROAD_X0 || w > layerOf(28.75 + 1.25 * Math.sin(z * V * 0.05)) || (x * V < -58 && Math.abs(z * V - ribZ(x * V)) < 15);

/** Inside the ribeira's channel (metres). */
export const inChannel = (x: number, z: number) => x < PROM_X1 && Math.abs(z - ribZ(x)) <= RIB_HALF;

export function madeiraPlan(): Plan {
  if (cached) return cached;
  const n = SX * SZ;
  const walk = new Uint8Array(n), kind = new Uint8Array(n), lot = new Uint16Array(n), chan = new Uint8Array(n);
  const best = new Float32Array(n).fill(1e9);
  // natural ground: terraces carved into the hill, the shore and sea bed seaward of the promenade
  for (let z = VZ0; z < VZ0 + SZ; z++)
    for (let x = VX0; x < VX0 + SX; x++) {
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V, c = col(x, z);
      if (inChannel(mx, mz)) {
        chan[c] = 1;
        walk[c] = Math.max(1, layerOf(bedY(mx)));
        kind[c] = K.Channel;
      } else if (mx > PROM_X1) {
        const y = shoreY(mx, mz);
        walk[c] = Math.max(1, layerOf(y));
        const beach = mz > 18 && mz < 62;
        kind[c] = y < SEA_Y ? K.Sea : beach ? K.Shingle : K.Rock;
      } else {
        const h = Math.max(hillY(mx, mz), ROAD_Y);
        // the downtown is level ground; on the hill the terraces are 3 m walls of basalt
        const terrace = h < 6 ? h : Math.floor(h / 3) * 3 + (hash3(Math.floor(mx / 9), 7, Math.floor(mz / 9)) < 0.3 ? 1.5 : 0);
        walk[c] = Math.min(250, layerOf(Math.min(h, terrace)));
        kind[c] = K.Rock;
      }
    }
  const { nodes, edges, levada } = network();
  const ids = Object.keys(nodes);
  const ny = (id: string) => nodes[id].y ?? Math.max(ROAD_Y, hillY(nodes[id].x, nodes[id].z));
  // a lane's or a bank street's node over the ravine stands on the hill's own level, not the ravine's
  const nyb = (id: string) => nodes[id].y ?? Math.max(ROAD_Y, hillBase(nodes[id].x, nodes[id].z) * (nodes[id].x < -20 ? 1 : 0), hillY(nodes[id].x, nodes[id].z));
  const segs: PathSeg[] = edges.map(([a, b, w, k, roof]) => ({
    a: [nodes[a].x, nyb(a), nodes[a].z], b: [nodes[b].x, nyb(b), nodes[b].z], w, kind: k, roof,
    ...(levada.has(`${a}|${b}`) ? { levada: true } : {}),
  }));
  void ny;
  // paint the paths: each column takes the height of the closest path over it, uniformly graded along it
  for (const s of segs) paintSeg(s, walk, kind, best);
  // the squares are level
  rect(LARGO[0], LARGO[1], LARGO[2], LARGO[3], PIAZZA_Y, K.Piazza, walk, kind, best);
  rect(LAVRADORES[0], LAVRADORES[1], LAVRADORES[2], LAVRADORES[3], PIAZZA_Y, K.Piazza, walk, kind, best);
  // the seafront garden slopes from the square down to the avenue, a walk of calçada through its beds
  for (let z = Math.floor(JARDIM[1] / V); z < Math.ceil(JARDIM[3] / V); z++)
    for (let x = Math.floor(JARDIM[0] / V); x < Math.ceil(JARDIM[2] / V); x++) {
      const c = col(x, z), t = Math.max(0, Math.min(1, ((x + 0.5) * V - JARDIM[0]) / (JARDIM[2] - JARDIM[0])));
      if (chan[c]) continue;
      walk[c] = layerOf(PIAZZA_Y + (ROAD_Y - PIAZZA_Y) * t); kind[c] = K.Garden; best[c] = -1;
    }
  // the market and the Sé stand on their own footprints; the market's courtyard is open ground inside
  rect(MERCADO[0], MERCADO[1], MERCADO[2], MERCADO[3], PIAZZA_Y, K.Church, walk, kind, best);
  rect(MERCADO[0] + 4, MERCADO[1] + 4, MERCADO[2] - 4, MERCADO[3] - 4, PIAZZA_Y, K.Piazza, walk, kind, best);
  rect(MERCADO[2] - 4, (MERCADO[1] + MERCADO[3]) / 2 - 2.5, MERCADO[2], (MERCADO[1] + MERCADO[3]) / 2 + 2.5, PIAZZA_Y, K.Piazza, walk, kind, best);
  rect(SE[0], SE[1], SE[2] + 1, SE[3], DUOMO_Y, K.Church, walk, kind, best);
  rect(SE_TOWER[0], SE_TOWER[1], SE_TOWER[2], SE_TOWER[3], DUOMO_Y, K.Church, walk, kind, best);
  // the cable car's station on the garden, and its tower
  rect(TELE[0], TELE[1], TELE[2], TELE[3], PIAZZA_Y, K.Church, walk, kind, best);
  // the fort of São Tiago on the rocks at the east end: a bastioned trace, every face at its own angle
  for (let z = Math.floor((FORT_C[1] - 14) / V); z < Math.ceil((FORT_C[1] + 14) / V); z++)
    for (let x = Math.floor((FORT_C[0] - 14) / V); x < Math.ceil((FORT_C[0] + 14) / V); x++) {
      if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) continue;
      if (!inFort((x + 0.5) * V, (z + 0.5) * V)) continue;
      const c = col(x, z);
      walk[c] = layerOf(ROAD_Y); kind[c] = K.Church; best[c] = -1;
    }
  // the breakwater: a curved arm out into the sea, walked along its top
  for (let z = Math.floor((MAR_CZ - MAR_R1 - 2) / V); z < Math.ceil((MAR_CZ + MAR_R1 + 2) / V); z++)
    for (let x = Math.floor(PROM_X1 / V) - 2; x < Math.ceil((MAR_CX + MAR_R1 + 2) / V); x++) {
      if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) continue;
      const { r, a } = marinaPolar((x + 0.5) * V, (z + 0.5) * V);
      if (a < MAR_A0 - 0.06 || a > MAR_A1) continue;
      const [r0, r1] = moleRadii(a);
      // its end is rounded off where the light stands
      const tip = MAR_A1 - a < 0.12 ? Math.hypot(r - (r0 + r1) / 2, (MAR_A1 - 0.12 - a) * r) <= (r1 - r0) / 2 || a < MAR_A1 - 0.12 : true;
      if (r < r0 || r > r1 || !tip) continue;
      const c = col(x, z);
      walk[c] = layerOf(ROAD_Y); kind[c] = K.Pier; best[c] = -1;
    }
  // the channel keeps its walls: paths only cross it on bridges (marked, so the builder springs an arch under them)
  for (let i = 0; i < n; i++) if (chan[i] && kind[i] !== K.Channel && !isPath(kind[i])) { kind[i] = K.Channel; walk[i] = Math.max(1, layerOf(bedY(((i % SX) + VX0 + 0.5) * V))); }
  // every riser left where a stair meets a square or two paths cross on different grades becomes steps
  regradePaths(walk, kind, { adjustable: new Set([K.Stair, K.Lane, K.Street]), fixed: new Set([K.Road, K.Walk, K.Piazza, K.Steps, K.Quay, K.Pier, K.Church, K.Sand, K.Garden]) });
  const lots = placeLots(walk, kind, lot, segs);
  const crag = new Uint8Array(SX * SZ);
  // and every garden terrace left between the houses gets its steps down to the lane (the wild slopes above the
  // town stay as they are)
  gardenFlights(walk, kind, lot, { ground: K.Rock, stair: K.Stair, path: (k) => isPath(k), wild: (x, z) => chan[col(x, z)] === 1 || wildRock(x, z, walk[col(x, z)]) });
  // (a second pass with narrower flights reaches the patches the first could not fit a flight into)
  gardenFlights(walk, kind, lot, { ground: K.Rock, stair: K.Stair, path: (k) => isPath(k), width: 3, wild: (x, z) => chan[col(x, z)] === 1 || wildRock(x, z, walk[col(x, z)]) });
  fillPockets(walk, kind, lot, chan);
  const nodeList = ids.map((id) => [nodes[id].x, nodes[id].z] as [number, number]);
  const index = new Map(ids.map((id, i) => [id, i]));
  cached = { walk, kind, lot, lots, segs, crag, chan, nodes: nodeList, edges: edges.map(([a, b]) => [index.get(a)!, index.get(b)!]) };
  return cached;
}

/**
 * A garden pocket no flight could reach (shut in by houses and a higher terrace) is filled up to the terrace above
 * it, so no ground is left the player can see but never step onto.
 */
function fillPockets(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, chan: Uint8Array): void {
  const n = SX * SZ;
  const open = (i: number) => kind[i] === K.Rock && !lot[i] && !chan[i] && !wildRock((i % SX) + VX0, Math.floor(i / SX) + VZ0, walk[i]);
  for (let pass = 0; pass < 3; pass++) {
    const comp = new Int32Array(n).fill(-1);
    let id = 0;
    for (let s0 = 0; s0 < n; s0++) {
      if (comp[s0] >= 0 || !open(s0)) continue;
      const list = [s0];
      comp[s0] = id;
      let linked = false, up = 0;
      for (let k = 0; k < list.length; k++) {
        const c = list[k], x = c % SX;
        for (const j of [x + 1 < SX ? c + 1 : -1, x > 0 ? c - 1 : -1, c + SX < n ? c + SX : -1, c - SX]) {
          if (j < 0) continue;
          const d = walk[j] - walk[c];
          if (open(j)) {
            if (comp[j] < 0 && Math.abs(d) <= 2) { comp[j] = id; list.push(j); }
            else if (d > 2 && d <= 16) up = Math.max(up, walk[j]);
            continue;
          }
          if ((isPath(kind[j]) || kind[j] === K.Garden) && !lot[j] && Math.abs(d) <= 2) linked = true;
        }
      }
      if (!linked && up && list.length < 4000) for (const c of list) walk[c] = up;
      id++;
    }
  }
}

function rect(x0: number, z0: number, x1: number, z1: number, y: number, k: K, walk: Uint8Array, kind: Uint8Array, best: Float32Array): void {
  for (let z = Math.floor(z0 / V); z < Math.ceil(z1 / V); z++)
    for (let x = Math.floor(x0 / V); x < Math.ceil(x1 / V); x++) {
      if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) continue;
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
      // where paths overlap the nearest centre line wins; squares painted later win over everything
      if (d >= best[c]) continue;
      best[c] = d;
      walk[c] = layerOf(ay + (by - ay) * t);
      kind[c] = s.kind;
    }
}

/** Restaurants that found no room where they were asked for (the checks report them). */
export const FOOD_MISSED: string[] = [];

const PATHY = new Set<number>([K.Road, K.Walk, K.Piazza, K.Street, K.Stair, K.Lane, K.Tunnel, K.Covered, K.Pier, K.Steps, K.Quay, K.Sand]);
export const isPath = (k: number) => PATHY.has(k);

/**
 * Houses along every path, then on the patches of hillside left between them. A frontage lot stands with its
 * face a step off the path, on the path's own level when it can; one whose ground floor sits below the lane
 * behind it simply has its entrance upstairs, the way so many houses in Amalfi do. Back lots fill the rest of
 * the slope below the highest lanes, so the town reads as one tight cascade of houses.
 */
function placeLots(walk: Uint8Array, kind: Uint8Array, lot: Uint16Array, segs: PathSeg[]): LotPlan[] {
  const lots: LotPlan[] = [];
  const r = rng(1953);
  const inMap = (x: number, z: number) => x >= VX0 && z >= VZ0 && x < VX0 + SX && z < VZ0 + SZ;
  const under = (k: number) => k === K.Covered || k === K.Tunnel;
  const tryLot = (x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'] | null, frontLayer: number, shop: boolean): boolean => {
    if (!inMap(x0 - 1, z0 - 1) || !inMap(x1 + 1, z1 + 1) || x1 - x0 < 12 || z1 - z0 < 12) return false;
    if ((x1 + 1) * V > ROAD_X0) return false; // nothing is built seaward of the avenue
    let lo = 255, hi = 0;
    for (let z = z0 - 1; z <= z1 + 1; z++)
      for (let x = x0 - 1; x <= x1 + 1; x++) {
        const c = col(x, z), k = kind[c];
        if (lot[c]) return false;
        if (under(k)) continue;
        if (k !== K.Rock) return false;
        if (x >= x0 && x <= x1 && z >= z0 && z <= z1) { lo = Math.min(lo, walk[c]); hi = Math.max(hi, walk[c]); }
      }
    if (hi - lo > 44) return false;
    // stand on the path's level (cutting into the slope) unless the ground falls away below it
    const base = side ? Math.min(lo, frontLayer) : lo;
    const floors = 2 + Math.floor(r() * 3);
    const top = Math.min(214, Math.max(hi + 10, base + 4 + floors * 12));
    const id = lots.length + 1;
    lots.push({ id, x0, z0, x1, z1, base, top, side: side ?? 's', door: side ? frontLayer : -1, seed: Math.floor(r() * 1e6), shop });
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) { const c = col(x, z); if (!under(kind[c])) { lot[c] = id; kind[c] = K.Lot; walk[c] = base; } }
    return true;
  };
  const front = (ax: number, az: number, bx: number, bz: number, half: number, k: number, y0: number, y1: number) => {
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 3) return;
    const alongX = Math.abs(bx - ax) >= Math.abs(bz - az);
    for (let t = 0; t < len - 2; ) {
      const w = 5 + r() * 4.5, dep = 6 + r() * 4;
      const f = (t + w / 2) / len;
      const cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, cy = y0 + (y1 - y0) * f;
      const shop = (k === K.Street || k === K.Piazza) && r() < 0.85;
      for (const sd of [1, -1]) {
        const off = half + 0.6;
        let x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'];
        if (alongX) {
          x0 = cx - w / 2; x1 = cx + w / 2;
          if (sd > 0) { z0 = cz + off; z1 = z0 + dep; side = 'n'; } else { z1 = cz - off; z0 = z1 - dep; side = 's'; }
        } else {
          z0 = cz - w / 2; z1 = cz + w / 2;
          if (sd > 0) { x0 = cx + off; x1 = x0 + dep; side = 'w'; } else { x1 = cx - off; x0 = x1 - dep; side = 'e'; }
        }
        // the front faces the path: a lot north of it (+z) opens on its -z side, and so on
        tryLot(Math.round(x0 / V), Math.round(z0 / V), Math.round(x1 / V) - 1, Math.round(z1 / V) - 1, side, layerOf(cy), shop);
      }
      t += w + (r() < 0.2 ? 1.5 + r() * 2 : 0.25);
    }
  };
  // the restaurants first, so the town builds round them
  const edges: { a: [number, number]; b: [number, number]; half: number; k: K; y: number | null }[] = [
    ...segs.filter((sg) => sg.kind === K.Street || sg.kind === K.Lane).map((sg) => ({ a: [sg.a[0], sg.a[2]] as [number, number], b: [sg.b[0], sg.b[2]] as [number, number], half: sg.w / 2, k: sg.kind, y: null })),
    { a: [LARGO[0] + 1, LARGO[1]], b: [LARGO[2] - 1, LARGO[1]], half: 0, k: K.Piazza, y: PIAZZA_Y }, { a: [LARGO[0] + 1, LARGO[3]], b: [LARGO[2] - 1, LARGO[3]], half: 0, k: K.Piazza, y: PIAZZA_Y },
    { a: [LARGO[2], LARGO[1] + 1], b: [LARGO[2], LARGO[3] - 1], half: 0, k: K.Piazza, y: PIAZZA_Y },
    { a: [LAVRADORES[0] + 1, LAVRADORES[3]], b: [LAVRADORES[2] - 1, LAVRADORES[3]], half: 0, k: K.Piazza, y: PIAZZA_Y },
    // the avenue's landward pavement: the houses along it face the sea
    { a: [ROAD_X0 + 0.25, -87], b: [ROAD_X0 + 0.25, 87], half: 0.25, k: K.Walk, y: ROAD_Y },
  ];
  for (const fp of [...FOOD_PLACES, ...HOTEL_PLACES.map((h) => ({ ...h, hotel: true }))] as ((typeof FOOD_PLACES)[number] & { hotel?: boolean; rooms?: number })[]) {
    // if the spot asked for is taken, slide along the path a little either way
    const SHIFTS = [0, 1.5, -1.5, 3, -3, 4.5, -4.5, 6, -6, 8, -8, 10, -10];
    for (let attempt = 0; attempt < SHIFTS.length; attempt++) {
      let near: [number, number] = fp.near;
      {
        let be = edges[0], bdd = 1e9;
        for (const e of edges) {
          const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], l2 = dx * dx + dz * dz;
          const t = Math.max(0, Math.min(1, ((fp.near[0] - e.a[0]) * dx + (fp.near[1] - e.a[1]) * dz) / l2));
          const d = Math.hypot(fp.near[0] - e.a[0] - dx * t, fp.near[1] - e.a[1] - dz * t) - e.half;
          if (d < bdd) { bdd = d; be = e; }
        }
        const l = Math.hypot(be.b[0] - be.a[0], be.b[1] - be.a[1]) || 1;
        near = [fp.near[0] + ((be.b[0] - be.a[0]) / l) * SHIFTS[attempt], fp.near[1] + ((be.b[1] - be.a[1]) / l) * SHIFTS[attempt]];
      }
      let best = edges[0], bd = 1e9, bt = 0;
      for (const e of edges) {
        const dx = e.b[0] - e.a[0], dz = e.b[1] - e.a[1], l2 = dx * dx + dz * dz;
        const t = Math.max(0, Math.min(1, ((near[0] - e.a[0]) * dx + (near[1] - e.a[1]) * dz) / l2));
        const d = Math.hypot(near[0] - e.a[0] - dx * t, near[1] - e.a[1] - dz * t) - e.half;
        if (d < bd) { bd = d; best = e; bt = t; }
      }
      const e = best, cx = e.a[0] + (e.b[0] - e.a[0]) * bt, cz = e.a[1] + (e.b[1] - e.a[1]) * bt;
      const alongX = Math.abs(e.b[0] - e.a[0]) >= Math.abs(e.b[1] - e.a[1]);
      // the path's own level in front of the door (a square's edge: its own height)
      const pc = col(Math.floor((alongX ? near[0] : cx) / V), Math.floor((alongX ? cz : near[1]) / V));
      const pathLayer = e.y !== null ? layerOf(e.y) : walk[pc];
      const off = e.half + 0.5, sgn = alongX ? Math.sign(near[1] - cz) : Math.sign(near[0] - cx);
      // where a street runs at a slant the front stands clear of it along the whole frontage
      const across = (u: number) => {
        const du = alongX ? e.b[0] - e.a[0] : e.b[1] - e.a[1];
        const t = Math.max(0, Math.min(1, (u - (alongX ? e.a[0] : e.a[1])) / (du || 1)));
        return alongX ? e.a[1] + (e.b[1] - e.a[1]) * t : e.a[0] + (e.b[0] - e.a[0]) * t;
      };
      const u0 = (alongX ? near[0] : near[1]) - fp.w / 2, u1 = u0 + fp.w;
      const reach = sgn > 0 ? Math.max(across(u0), across(u1), alongX ? cz : cx) : Math.min(across(u0), across(u1), alongX ? cz : cx);
      let x0: number, z0: number, x1: number, z1: number, side: LotPlan['side'];
      if (alongX) {
        x0 = u0; x1 = u1;
        if (sgn > 0) { z0 = reach + off; z1 = z0 + fp.dep; side = 'n'; } else { z1 = reach - off; z0 = z1 - fp.dep; side = 's'; }
      } else {
        z0 = u0; z1 = u1;
        if (sgn > 0) { x0 = reach + off; x1 = x0 + fp.dep; side = 'w'; } else { x1 = reach - off; x0 = x1 - fp.dep; side = 'e'; }
      }
      const vx0 = Math.round(x0 / V), vz0 = Math.round(z0 / V), vx1 = Math.round(x1 / V) - 1, vz1 = Math.round(z1 / V) - 1;
      // the strip between the path and the front is paved on the path's level, the full width of the house
      const ap: number[] = [];
      if (alongX) for (let x = vx0; x <= vx1; x++) {
        const zc = Math.round(across((x + 0.5) * V) / V);
        if (side === 'n') for (let z = zc; z < vz0; z++) ap.push(col(x, z)); else for (let z = vz1 + 1; z <= zc; z++) ap.push(col(x, z));
      } else for (let z = vz0; z <= vz1; z++) {
        const xc = Math.round(across((z + 0.5) * V) / V);
        if (side === 'w') for (let x = xc; x < vx0; x++) ap.push(col(x, z)); else for (let x = vx1 + 1; x <= xc; x++) ap.push(col(x, z));
      }
      let why = '';
      for (let z = vz0 - 1; z <= vz1 + 1 && !why; z++) for (let x = vx0 - 1; x <= vx1 + 1; x++) { const c = col(x, z); if (lot[c] || (kind[c] !== K.Rock && !ap.includes(c))) { why = `${fp.id}: kind ${kind[c]} at ${(x * V).toFixed(1)},${(z * V).toFixed(1)}`; break; } }
      if (why) { if (attempt === SHIFTS.length - 1) FOOD_MISSED.push(why); continue; }
      for (const c of ap) if (kind[c] === K.Rock || kind[c] === K.Quay || kind[c] === K.Shingle) { kind[c] = e.k; walk[c] = pathLayer; }
      let hi = 0;
      for (let z = vz0; z <= vz1; z++) for (let x = vx0; x <= vx1; x++) hi = Math.max(hi, walk[col(x, z)]);
      const base = pathLayer - 1;
      const id = lots.length + 1;
      const top = Math.min(214, Math.max(hi + 10, base + 4 + (1 + (fp.rooms ?? 2)) * 12));
      lots.push({ id, x0: vx0, z0: vz0, x1: vx1, z1: vz1, base, top, side, door: pathLayer, seed: Math.floor(r() * 1e6), shop: true, ...(fp.hotel ? { hotel: fp.id, guestFloors: fp.rooms } : fp.secret ? { secret: true, painted: true, shop: false } : { food: fp.id }) });
      for (let z = vz0; z <= vz1; z++) for (let x = vx0; x <= vx1; x++) { const c = col(x, z); lot[c] = id; kind[c] = K.Lot; walk[c] = base; }
      break;
    }
  }  for (const s of segs) if (s.kind === K.Lane || s.kind === K.Street || s.kind === K.Stair) front(s.a[0], s.a[2], s.b[0], s.b[2], s.w / 2, s.kind, s.a[1], s.b[1]);
  // round the squares
  front(LARGO[0] + 1, LARGO[1], LARGO[2] - 1, LARGO[1], 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  front(LARGO[0] + 1, LARGO[3], LARGO[2] - 1, LARGO[3], 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  front(LARGO[2], LARGO[1] + 1, LARGO[2], LARGO[3] - 1, 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  front(LAVRADORES[0] + 1, LAVRADORES[3], LAVRADORES[2] - 1, LAVRADORES[3], 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  // along Avenida do Mar, facing the sea
  front(ROAD_X0 - 1, -87, ROAD_X0 - 1, 87, 0, K.Street, ROAD_Y, ROAD_Y);
  // back lots on the slope between the lanes
  for (let gz = VZ0 + 6; gz < VZ0 + SZ - 10; gz += 6)
    for (let gx = VX0 + 6; gx < VX0 + SX - 10; gx += 6) {
      const c = col(gx, gz);
      if (kind[c] !== K.Rock || lot[c] || gx * V > ROAD_X0) continue;
      if (walk[c] > layerOf(30)) continue; // the high slope stays banana terraces, vines and laurel wood
      const w = 16 + Math.floor(r() * 16), d = 16 + Math.floor(r() * 14);
      tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, false);
    }
  return lots;
}
