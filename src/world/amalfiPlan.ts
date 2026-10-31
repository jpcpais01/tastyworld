import { G, V, VX0, VZ0, SX, SZ } from './layout';
import { hash3, rng } from './grid';

/**
 * Amalfi's ground plan: the hillside, the paths across it and the house lots on it, worked out once for the whole
 * map from pure functions of position (never from the voxel grid), so every world worker builds the same town
 * whatever strip of it it keeps.
 *
 * The town is turned so the sea lies to the east (+x): the sun comes from that side, as it does over the real
 * Gulf of Salerno in the morning, and the iso camera looks up the valley from the water. Inland is -x. Along the
 * coast, -z is towards Atrani and the headland (the coast road tunnels through it), +z towards the harbour,
 * its pier and Positano.
 */

/** What the surface of a column is. */
export const enum K {
  Rock, Sea, Sand, Quay, Road, Walk, Piazza, Street, Stair, Lane, Garden, Lot, Tunnel, Covered, Pier, Steps, Shingle, Church,
}

export interface PathSeg {
  a: [number, number, number];
  b: [number, number, number];
  /** Width (m). */
  w: number;
  kind: K;
  /** Roofed over (a covered passage or a tunnel): the builder vaults it and keeps the space above it free. */
  roof?: number;
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
  /** Lots along the piazza and the main street have shops downstairs. */
  shop: boolean;
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
const ROAD_Y = 2.0;
export const PIAZZA_Y = 3.0;
export const DUOMO_Y = 12.5;
/** Where the shore road runs (x) and its width. */
export const ROAD_X0 = 27, ROAD_X1 = 35;
/** The Molo, out from the beach at z = 9: its deck height, half width, the far end and its round belvedere. */
export const PIER_Y = 1.55, PIER_HALF = 1.75, PIER_END = 63, PIER_R = 4.5;
/** The belvedere in front of the piazza: open to the sea between these x, its balustrade along the road side. */
export const BELV_X0 = 20, BELV_X1 = 27;
/** Where the steps down to the road start, under the sea gate's arch. */
export const GATE_X = 23.75;
/** The headland the road tunnels through starts here (z). */
export const TUNNEL_Z = -52;

/**
 * The beach, shared by the builder and the crowd: three lidos, each with rows of umbrellas (a sunbed beside each)
 * and a line of cabins against the sea wall, and the free beach at the tunnel end with its towels.
 */
export const LIDOS: { z0: number; z1: number; rows: number[] }[] = [
  { z0: -29, z1: -13, rows: [39, 42, 45] },
  { z0: -7, z1: 6, rows: [43, 46] },
  { z0: 12.5, z1: 30, rows: [44.5, 47.2] },
];

/** Umbrella spots of a lido (the sunbed's middle is 1 m to +x and 0.4 m to +z of each, head end to +z). */
export function lidoUmbrellas(l: (typeof LIDOS)[number]): [number, number][] {
  const out: [number, number][] = [];
  for (let z = l.z0; z <= l.z1; z += 3.4)
    for (const x of l.rows) if (Math.hypot(x - 45, z - 21) >= 2.8) out.push([x, z]); // not over Ciro and his tower
  return out;
}

/** The towels on the free beach: middle, whether laid along x, and whether an umbrella stands beside it. */
export function freeBeachTowels(): { x: number; z: number; alongX: boolean; umbrella: boolean }[] {
  const r = rng(77);
  const out: { x: number; z: number; alongX: boolean; umbrella: boolean }[] = [];
  for (let i = 0; i < 16; i++) {
    const x = 38 + r() * 9, z = -48 + r() * 17;
    const alongX = r() >= 0.5;
    out.push({ x, z, alongX, umbrella: r() < 0.35 });
  }
  return out;
}

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Valley axis (z) at inland x. */
export function valleyZ(x: number): number {
  return x > -4 ? -6 : -6 + 5 * Math.sin((x + 4) * 0.035);
}

/** The valley floor rises gently inland along Via Lorenzo d'Amalfi. */
export function floorY(x: number): number {
  return x > -4 ? PIAZZA_Y : PIAZZA_Y + (-4 - x) * 0.07;
}

/** Natural hillside height (m) before anything is built: the valley floor plus the two flanks climbing away. */
export function hillY(x: number, z: number): number {
  const zv = valleyZ(x);
  // the valley opens wide at the sea, where the piazza and the cathedral stand; inland it is a narrow cleft
  const open = smooth(-30, 0, x);
  const wW = 7 + open * 29, wE = 6 + open * 3;
  const t = z > zv ? z - zv - wW : zv - z - wE;
  let h = floorY(x);
  if (t > 0) h += 36 * (1 - Math.exp(-t / 40));
  // the headland towards Atrani pushes out into the sea and stands taller
  h += 16 * smooth(-30, -60, z) * smooth(-40, 0, x);
  // folds in the slope so the terraces don't run ruler-straight
  h += (Math.sin(x * 0.11 + z * 0.05) + Math.sin(z * 0.13 - x * 0.04)) * 0.9 * smooth(0, 8, t);
  return h;
}

/** Height of the sea bed and the shore (m), seaward of the road. */
export function shoreY(x: number, z: number): number {
  // pebble beach in front of the town, a stone quay along the harbour, cliffs under the headland
  if (z < TUNNEL_Z + 2) return -9;
  const bed = -1.2 - (x - 40) * 0.12;
  if (z > 40) return x < 46 ? 1.0 : bed - 1.5;
  if (x < 37) return 1.55;
  return Math.max(bed, 1.55 - (x - 37) * 0.16);
}

// ------------------------------------------------------------------------------------------- path network

/** Named spots of the walking network (metres). The y of each comes from the terrain unless given. */
interface N { x: number; z: number; y?: number }

function network(): { nodes: Record<string, N>; edges: [string, string, number, K, number?][] } {
  const n: Record<string, N> = {
    // the shore road, its pavement and the tunnel through the headland
    r0: { x: 31, z: 79, y: ROAD_Y }, r1: { x: 31, z: 40, y: ROAD_Y }, r2: { x: 31, z: 9, y: ROAD_Y }, r3: { x: 31, z: -20, y: ROAD_Y },
    r4: { x: 31, z: TUNNEL_Z, y: ROAD_Y }, r5: { x: 31, z: -79, y: ROAD_Y },
    // Porta della Marina: the old sea gate, now an arch standing free on the belvedere, steps down to the road
    g0: { x: 27.25, z: 9, y: ROAD_Y }, g1: { x: GATE_X, z: 9, y: PIAZZA_Y },
    // the piazza (painted as a plaza below; these are the crowd's crossing points)
    p0: { x: 16, z: 9, y: PIAZZA_Y }, p1: { x: 8, z: 14, y: PIAZZA_Y }, p2: { x: 0, z: 3, y: PIAZZA_Y }, p3: { x: 10, z: 26, y: PIAZZA_Y },
    p4: { x: 2, z: 14, y: PIAZZA_Y }, p5: { x: 16, z: -2, y: PIAZZA_Y }, p6: { x: -2, z: 25, y: PIAZZA_Y },
    // the 57 steps up to the cathedral and its atrium
    d0: { x: -4.5, z: 14, y: PIAZZA_Y }, d1: { x: -20, z: 14, y: DUOMO_Y }, d2: { x: -23, z: 14, y: DUOMO_Y }, d3: { x: -23, z: 26, y: DUOMO_Y },
    d4: { x: -23, z: 4, y: DUOMO_Y },
    // the cloister, through a door at the end of the atrium
    c0: { x: -30, z: 30, y: DUOMO_Y }, c1: { x: -38, z: 36, y: DUOMO_Y },
    // Via Lorenzo d'Amalfi, climbing the valley, and Piazza dei Dogi halfway up
    m0: { x: -4, z: -3 }, m1: { x: -20, z: -8 }, m2: { x: -38, z: -6 }, m3: { x: -54, z: -9 }, m4: { x: -64, z: -8 },
    m5: { x: -82, z: -7 }, m6: { x: -110, z: -9 },
    // Ruga dei Mercanti, the covered market passage behind the cathedral's east wall
    u0: { x: -4.5, z: 2, y: PIAZZA_Y }, u1: { x: -18, z: 1.5 }, u2: { x: -34, z: 1 }, u3: { x: -46, z: -3 },
    // the beach and the harbour
    b0: { x: 39, z: 9, y: 1.55 }, b1: { x: 39.5, z: -9, y: 1.15 }, b2: { x: 42, z: 34, y: 1.15 },
    // the Molo: a stone pier straight out from the beach below the piazza, a round belvedere at its end
    q0: { x: 49, z: 9, y: PIER_Y }, q1: { x: PIER_END - 4, z: 9, y: PIER_Y },
    h0: { x: 40, z: 46, y: 1.0 }, h1: { x: 40, z: 66, y: 1.0 }, h2: { x: 51, z: 51, y: 1.0 }, h3: { x: 78, z: 51, y: 1.0 },
  };
  const e: [string, string, number, K, number?][] = [
    ['r0', 'r1', 5.5, K.Road], ['r1', 'r2', 5.5, K.Road], ['r2', 'r3', 5.5, K.Road], ['r3', 'r4', 5.5, K.Road], ['r4', 'r5', 6.5, K.Tunnel, 5.5],
    ['r2', 'g0', 4, K.Walk], ['g0', 'g1', 4, K.Walk], ['g1', 'p0', 4, K.Piazza],
    ['b0', 'q0', 3, K.Pier], ['q0', 'q1', 3, K.Pier],
    ['p0', 'p1', 3, K.Piazza], ['p1', 'p4', 3, K.Piazza], ['p4', 'd0', 3, K.Piazza], ['p1', 'p3', 3, K.Piazza], ['p0', 'p5', 3, K.Piazza],
    ['p5', 'p2', 3, K.Piazza], ['p2', 'u0', 2, K.Piazza], ['p2', 'm0', 3, K.Piazza], ['p4', 'p2', 3, K.Piazza], ['p3', 'p6', 3, K.Piazza],
    ['d0', 'd1', 10, K.Steps], ['d1', 'd2', 6, K.Piazza], ['d2', 'd3', 3, K.Piazza], ['d2', 'd4', 3, K.Piazza], ['d3', 'c0', 2.4, K.Covered, 3.5], ['c0', 'c1', 3, K.Piazza],
    ['m0', 'm1', 4.2, K.Street], ['m1', 'm2', 4.2, K.Street], ['m2', 'm3', 4.4, K.Street], ['m3', 'm4', 9, K.Piazza], ['m4', 'm5', 4.2, K.Street], ['m5', 'm6', 4.2, K.Street],
    ['u0', 'u1', 2.6, K.Covered, 3.25], ['u1', 'u2', 2.6, K.Covered, 3.25], ['u2', 'u3', 2.6, K.Covered, 3.25], ['u3', 'm3', 2.6, K.Street],
    ['r2', 'b0', 3, K.Walk], ['b0', 'b1', 3, K.Sand], ['b0', 'b2', 3, K.Sand],
    ['r1', 'h0', 3, K.Quay], ['h0', 'h1', 3, K.Quay], ['h0', 'h2', 3, K.Quay], ['h2', 'h3', 4.5, K.Pier],
  ];
  // the hillside: contour lanes at fixed heights on both flanks, joined by flights of steps, every one of them
  // tied to the valley floor or the shore at its foot
  const flank = (side: 1 | -1, levels: number[], from: number, to: number, tag: string) => {
    const at = (x: number, y: number) => {
      // walk out from the valley axis until the hill reaches y
      const zv = valleyZ(x);
      for (let d = 0; d < 90; d += 0.25) {
        const z = zv + side * d;
        if (hillY(x, z) >= y) return Math.max(-77, Math.min(77, z));
      }
      return Math.max(-77, Math.min(77, zv + side * 90));
    };
    let prev: string[] = [];
    levels.forEach((y, li) => {
      // a lane along the slope at height y, from inland x `from` towards the sea at x `to`
      const ids: string[] = [];
      const n0 = Math.ceil((to - from) / 14);
      for (let i = 0; i <= n0; i++) {
        const x = from + ((to - from) * i) / n0 - (li % 2) * 3;
        const z = at(x, y);
        const id = `${tag}${li}_${i}`;
        n[id] = { x, z, y };
        ids.push(id);
        if (i) e.push([ids[i - 1], id, 2.6, K.Lane]);
      }
      // steps up to it from the level below, every other station, alternating so they zigzag up the hill
      if (li > 0) {
        for (let i = (li % 2); i < ids.length; i += 2) {
          const j = Math.min(prev.length - 1, i);
          e.push([prev[j], ids[i], 2.2, K.Stair]);
        }
      }
      prev = ids;
    });
  };
  flank(1, [8, 15.5, 23, 30.5], -104, 18, 'w');
  flank(-1, [8, 15.5, 23], -100, 14, 'e');
  // the cathedral stands on its terrace cut into the western flank: the lanes stop on either side of it
  for (const [id, p] of Object.entries(n)) if (id.startsWith('w') && p.x > -63 && p.x < -23 && p.z > 0 && p.z < 29.5) delete n[id];
  // and the lowest eastern lane gives way to the Ruga, which already runs along that foot of the slope
  for (const [id, p] of Object.entries(n)) if ((id.startsWith('e0_') || id.startsWith('w0_')) && p.x > -51 && p.x < -4 && Math.abs(p.z) < 4.5) delete n[id];
  // the feet of both flanks: steps down to the main street and to the shore road
  const near = (tag: string, x: number) => {
    let best = '', bd = 1e9;
    for (const [id, p] of Object.entries(n)) if (id.startsWith(tag) && Math.abs(p.x - x) < bd) { bd = Math.abs(p.x - x); best = id; }
    return best;
  };
  const nearest = (tag: string, x: number, z: number) => {
    let best = '', bd = 1e9;
    for (const [id, p] of Object.entries(n)) if (id.startsWith(tag) && Math.hypot(p.x - x, p.z - z) < bd) { bd = Math.hypot(p.x - x, p.z - z); best = id; }
    return best;
  };
  for (const x of [-96, -68, -40, -12]) e.push([near('m', x), near('w0_', x), 2.4, K.Stair], [near('m', x + 8), near('e0_', x + 8), 2.4, K.Stair]);
  e.push(['p6', near('w0_', 10), 2.4, K.Stair], ['r1', near('w0_', 18), 2.4, K.Stair], ['r3', near('e0_', 14), 2.4, K.Stair], ['c1', nearest('w', -38, 36), 2.4, K.Stair]);
  return { nodes: n, edges: e.filter(([a, b]) => n[a] && n[b]) };
}

// ------------------------------------------------------------------------------------------- plan

let cached: Plan | null = null;

export const col = (x: number, z: number) => (z - VZ0) * SX + (x - VX0);
export const layerOf = (y: number) => G + Math.round(y / V);

export function amalfiPlan(): Plan {
  if (cached) return cached;
  const n = SX * SZ;
  const walk = new Uint8Array(n), kind = new Uint8Array(n), lot = new Uint16Array(n);
  const best = new Float32Array(n).fill(1e9);
  // natural ground: terraces 3 m tall carved into the hill, the shore and sea bed seaward of the road
  for (let z = VZ0; z < VZ0 + SZ; z++)
    for (let x = VX0; x < VX0 + SX; x++) {
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V, c = col(x, z);
      if (mx > ROAD_X0 && !(mz < TUNNEL_Z && mx < 50)) {
        const y = shoreY(mx, mz);
        walk[c] = Math.max(1, layerOf(y));
        kind[c] = y < SEA_Y ? K.Sea : mz > 40 && mx < 46 ? K.Quay : K.Shingle;
      } else {
        const h = Math.max(hillY(mx, mz), ROAD_Y);
        const terrace = Math.floor(h / 3) * 3 + (hash3(Math.floor(mx / 9), 7, Math.floor(mz / 9)) < 0.3 ? 1.5 : 0);
        walk[c] = Math.min(250, layerOf(Math.min(h, terrace)));
        kind[c] = K.Rock;
      }
    }
  const { nodes, edges } = network();
  const ids = Object.keys(nodes);
  const ny = (id: string) => nodes[id].y ?? Math.max(PIAZZA_Y, hillY(nodes[id].x, nodes[id].z));
  const segs: PathSeg[] = edges.map(([a, b, w, k, roof]) => ({
    a: [nodes[a].x, ny(a), nodes[a].z], b: [nodes[b].x, ny(b), nodes[b].z], w, kind: k, roof,
  }));
  // paint the paths: each column takes the height of the closest path over it, uniformly graded along it
  for (const s of segs) paintSeg(s, walk, kind, best);
  // the cathedral steps and the vaulted passages keep their own grade whatever lane runs close by
  const own = new Float32Array(n).fill(1e9);
  for (const s of segs) if (s.kind === K.Steps || s.kind === K.Covered) paintSeg(s, walk, kind, own);
  for (let i = 0; i < n; i++) if (own[i] < 1e9) best[i] = -1;
  // the piazza, the cathedral terrace and the cloister are open squares
  // the piazza runs right out to the old sea wall: a belvedere over the road, the beach and the Molo
  rect(-4, -6, BELV_X1, 30, PIAZZA_Y, K.Piazza, walk, kind, best);
  rect(-26, 2, -20, 26, DUOMO_Y, K.Piazza, walk, kind, best);
  rect(-46, 29, -32, 43, DUOMO_Y, K.Piazza, walk, kind, best);
  rect(-68, -15, -52, -1, floorY(-60), K.Piazza, walk, kind, best);
  // the steps down from the belvedere through the sea gate keep their own grade over the square
  for (let z = Math.floor(7 / V); z < Math.ceil(11 / V); z++)
    for (let x = Math.floor(GATE_X / V); x < Math.ceil(ROAD_X0 / V); x++) {
      const c = col(x, z), t = ((x + 0.5) * V - GATE_X) / (ROAD_X0 - GATE_X);
      walk[c] = layerOf(PIAZZA_Y + (ROAD_Y - PIAZZA_Y) * t); kind[c] = K.Steps; best[c] = -1;
    }
  // the Molo and its round end
  rect(37, 9 - PIER_HALF, PIER_END - PIER_R + 0.5, 9 + PIER_HALF, PIER_Y, K.Pier, walk, kind, best);
  for (let z = Math.floor((9 - PIER_R) / V); z < Math.ceil((9 + PIER_R) / V); z++)
    for (let x = Math.floor((PIER_END - 2 * PIER_R) / V); x < Math.ceil(PIER_END / V); x++) {
      if (Math.hypot((x + 0.5) * V - (PIER_END - PIER_R), (z + 0.5) * V - 9) > PIER_R) continue;
      const c = col(x, z);
      walk[c] = layerOf(PIER_Y); kind[c] = K.Pier; best[c] = -1;
    }
  // the quay and the pier
  rect(36, 41, 46, 80, 1.0, K.Quay, walk, kind, best);
  rect(46, 48.5, 84, 53.5, 1.0, K.Pier, walk, kind, best);
  // the cathedral and its bell tower stand on their own terrace above the steps
  rect(-60, 3, -26, 25, DUOMO_Y, K.Church, walk, kind, best);
  rect(-40, 25, -32, 30, DUOMO_Y, K.Church, walk, kind, best);
  const lots = placeLots(walk, kind, lot, segs);
  const nodeList = ids.map((id) => [nodes[id].x, nodes[id].z] as [number, number]);
  const index = new Map(ids.map((id, i) => [id, i]));
  cached = { walk, kind, lot, lots, segs, nodes: nodeList, edges: edges.map(([a, b]) => [index.get(a)!, index.get(b)!]) };
  return cached;
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
  for (const s of segs) if (s.kind === K.Lane || s.kind === K.Street || s.kind === K.Stair) front(s.a[0], s.a[2], s.b[0], s.b[2], s.w / 2, s.kind, s.a[1], s.b[1]);
  // round the piazza and Piazza dei Dogi
  front(-3, -6, BELV_X1 - 1, -6, 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  front(-3, 30, BELV_X1 - 1, 30, 0, K.Piazza, PIAZZA_Y, PIAZZA_Y);
  front(-67, -15, -53, -15, 0, K.Piazza, floorY(-60), floorY(-60));
  front(-67, -1, -53, -1, 0, K.Piazza, floorY(-60), floorY(-60));
  // above the shore road, facing the sea
  front(ROAD_X0 - 1, 36, ROAD_X0 - 1, 80, 0, K.Lane, 2, 2);
  front(ROAD_X0 - 1, -50, ROAD_X0 - 1, -20, 0, K.Lane, 2, 2);
  // back lots on the slope between the lanes
  for (let gz = VZ0 + 6; gz < VZ0 + SZ - 10; gz += 6)
    for (let gx = VX0 + 6; gx < VX0 + SX - 10; gx += 6) {
      const c = col(gx, gz);
      if (kind[c] !== K.Rock || lot[c]) continue;
      if (walk[c] > layerOf(30)) continue; // the high slope stays lemon terraces and woods
      const w = 16 + Math.floor(r() * 16), d = 16 + Math.floor(r() * 14);
      tryLot(gx, gz, gx + w - 1, gz + d - 1, null, 0, false);
    }
  return lots;
}
