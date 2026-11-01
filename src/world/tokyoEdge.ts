// Where Tokyo's walkable map ends. The voxel city is a rectangle, but people should never walk up to a
// straight invisible line: a wandering band just inside the rectangle is off limits, and wherever the street
// meets it something real closes the way. Roadworks hoarding across the avenues, a block wall at the end of a
// lane, a shutter across the arcade, floodgates where the canal leaves, bamboo fences and woods on the hill,
// hedges round the park and the gardens. Buildings that already stand on the map line close it themselves, so
// the band only reaches in where the ground is open.
import { hash3, rng } from './grid';
import { G, V, VX0, VZ0, SX, SZ, HILL } from './layout';
import type { Builder } from './tokyo';
import { tree, streetAt, hillAt } from './city';
import { trafficCone, workBarrier } from './props';
import { underpassAt } from './roads';

const MAP_W = VX0 * V, MAP_E = (VX0 + SX) * V, MAP_S = (VZ0 + SZ) * V;

/** Smooth value noise along one axis, 0..1. */
const wander = (t: number, s: number) => {
  const i = Math.floor(t), f = t - i, u = f * f * (3 - 2 * f);
  return hash3(i, s, 917) * (1 - u) + hash3(i + 1, s, 917) * u;
};
/** Piecewise linear through (t, v) points, flat past the ends. */
const through = (pts: [number, number][], t: number) => {
  if (t <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [t1, v1] = pts[i];
    if (t <= t1) { const [t0, v0] = pts[i - 1]; return v0 + ((t - t0) / Math.max(1e-6, t1 - t0)) * (v1 - v0); }
  }
  return pts[pts.length - 1][1];
};

// How far in the band may reach along each side (m). Where houses stand on the line it is 0 (they close it);
// at a street with a shop door near the corner it stays shallow so the door is never shut off; over open
// ground (the shrine wood, the hill, the park) it is free to wander deep.
const CAP_W: [number, number][] = [
  [-56, 0], [-50.2, 0], [-50, 5], [-46.4, 5], [-46, 13], [-30, 13], [-28.4, 1.2], [-18.4, 1.2], [-18, 0],
  [-8.2, 0], [-8, 2.2], [-4.4, 2.2], [-4.2, 0], [3.4, 0], [3.6, 6], [7.2, 6], [7.4, 0],
  [14.8, 0], [15, 2.6], [18.7, 2.6], [18.9, 0], [26.8, 0], [27, 6], [29.8, 6], [30, 0],
  [37.8, 0], [38, 2.6], [42.6, 2.6], [42.8, 6], [49.8, 6], [50, 4], [53.8, 4], [54, 0], [55.8, 0], [56, 6], [64.6, 6], [65, 13], [112, 13],
];
const CAP_E: [number, number][] = [
  [-56, 0], [-50.2, 0], [-50, 1.4], [-46.4, 1.4], [-46.2, 0], [-28.6, 0], [-28.4, 2.2], [-18.4, 2.2], [-18.2, 0],
  [8.8, 0], [9, 2.8], [16, 2.8], [16.2, 0], [37.6, 0], [37.8, 3], [42.6, 3], [42.8, 6], [49.8, 6], [50, 4], [53.8, 4], [54, 0],
  [55.8, 0], [56, 5], [64.6, 5], [65, 9], [112, 9],
];
const CAP_S: [number, number][] = [
  [-72, 13], [-11, 13], [-10, 8], [0, 8], [0.2, 7], [19.8, 7], [20, 0], [31.8, 0], [32, 0.8], [40, 0.8], [40.2, 0],
  [51.8, 0], [52, 7], [71.8, 7], [72, 8], [82, 8], [82.2, 9], [144, 9],
];

function insetW(z: number) { return Math.min(3 + 8 * wander(z / 19, 1) + 2.5 * wander(z / 6, 2), through(CAP_W, z)); }
function insetE(z: number) { return Math.min(3 + 7 * wander(z / 17, 3) + 2.5 * wander(z / 6, 4), through(CAP_E, z)); }
function insetS(x: number) { return Math.min(3 + 8 * wander(x / 21, 5) + 2.5 * wander(x / 7, 6), through(CAP_S, x)); }

/** True past the edge of the walkable town (metres). */
export function tokyoBeyond(x: number, z: number): boolean {
  return x - MAP_W < insetW(z) || MAP_E - x < insetE(z) || MAP_S - z < insetS(x);
}
/** The same for a voxel column. */
export const beyondCell = (x: number, z: number) => tokyoBeyond((x + 0.5) * V, (z + 0.5) * V);

type Ground = 'avenue' | 'street' | 'lane' | 'alley' | 'arcade' | 'park' | 'hill' | 'shrine' | 'garden' | 'bank' | 'water' | 'lot';

const XW = VX0, XE = VX0 + SX - 1, ZS = VZ0 + SZ - 1;
const inR = (x: number, z: number, x0: number, z0: number, x1: number, z1: number) => x >= x0 && x <= x1 && z >= z0 && z <= z1;
const GARDENS: [number, number, number, number][] = [
  [XW, 14, -193, 29], [-128, 14, -89, 29], [XW, 108, -193, 119], [-128, 108, -89, 119],
  [0, 416, 79, ZS], [208, 416, 287, ZS],
];

/** What lies on the ground of a voxel column, for choosing how to close it off (no grid reads: workers agree). */
function groundOf(x: number, z: number): Ground {
  if (z >= 171 && z <= 200) return 'water';
  const s = streetAt(x, z);
  if (s) return s.kind;
  if (inR(x, z, 328, 260, XE, ZS)) return 'park';
  if (inR(x, z, HILL[0], HILL[1], HILL[2], HILL[3])) return 'hill';
  if (inR(x, z, XW, -184, -1, -113)) return 'shrine';
  if ((z >= 152 && z <= 170) || (z >= 201 && z <= 215)) return 'bank';
  if (GARDENS.some(([a, b, c, d]) => inR(x, z, a, b, c, d))) return 'garden';
  return 'lot';
}

/** Build the closures along the band and dress the ground behind them. Runs after the city is built. */
export function tokyoEdge(b: Builder): void {
  const g = b.grid, c = b.c, k = b.k;
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;
  const put = (x: number, y: number, z: number, v: number) => { if (g.get(x, y, z) === 0) g.set(x, y, z, v); };
  const BAND = 60; // voxels: the deepest the band reaches (13 m) plus a margin
  const near = (x: number, z: number) => x - XW < BAND || XE - x < BAND || ZS - z < BAND;
  for (let z = VZ0; z <= ZS; z++)
    for (let x = XW; x <= XE; x++) {
      if (!near(x, z) || !g.inside(x, G, z) || !beyondCell(x, z)) continue;
      // the avenues' underpasses close themselves (their trench walls and portal, see city.ts underpass)
      if (underpassAt(x, z)) continue;
      // the walkable side this column borders, if any
      let open: Ground | null = null;
      for (const [dx, dz] of N4) {
        const nx = x + dx, nz = z + dz;
        if (nx < XW || nx > XE || nz > ZS || beyondCell(nx, nz)) continue;
        const kind = groundOf(nx, nz);
        if (kind !== 'lot' && kind !== 'water') { open = kind; break; }
      }
      const kind = groundOf(x, z);
      if (open) closure(x, z, open);
      else if (kind === 'avenue' || kind === 'street') {
        // the road carries on behind the hoarding, dug up: gravel and spoil heaps
        if (hash3(x >> 2, z >> 2, 41) < 0.35) g.set(x, G - 1, z, c.gravel);
        if (hash3(x >> 3, z >> 3, 42) < 0.2) { const h = (hash3(x, z, 43) * 3) | 0; for (let y = 0; y < h; y++) put(x, G + y, z, y ? c.soil : c.gravel); }
      }
    }

  function closure(x: number, z: number, open: Ground) {
    switch (open) {
      case 'avenue':
      case 'street': {
        // white site hoarding, 2.5 m, a green band along the top, a steel post every two metres
        const post = (x + z) % 8 === 0;
        for (let y = 0; y <= 10; y++) put(x, G + y, z, post ? c.steelDark : y === 0 ? c.concreteDark : y >= 9 ? c.awnGreen : y === 8 ? c.trim : c.tileWhite);
        if ((x + z) % 24 === 0) put(x, G + 11, z, c.neonOrange);
        break;
      }
      case 'lane':
      case 'alley': {
        // a concrete block wall at the end of the lane, a row of open lattice blocks near the top, coping
        for (let y = 0; y <= 7; y++) put(x, G + y, z, y === 7 ? c.concreteDark : y === 5 && (x + z) % 2 ? 0 : (y + ((x + z) >> 1)) % 2 ? c.concreteWall : c.concrete);
        break;
      }
      case 'arcade':
        // the arcade's end: a shop shutter right across, a lit name board above
        for (let y = 0; y <= 20; y++) put(x, G + y, z, y >= 17 ? (y === 18 ? c.signLit : c.lacquer) : y % 2 ? c.shutterA : c.shutterB);
        break;
      case 'park':
        // a clipped hedge with a low green-painted rail through it
        for (let y = 0; y <= 4; y++) put(x, G + y, z, y === 2 && (x + z) % 6 === 0 ? c.awnGreen : hash3(x, y, z) < 0.5 ? c.leafDark : c.leaf);
        break;
      case 'hill': {
        // a bamboo fence following the slope: green and straw poles, tied with dark cord
        const base = G + hillAt(x, z);
        for (let y = 0; y <= 6; y++) put(x, base + y, z, y === 2 || y === 5 ? c.woodDark : (x + z) % 3 === 0 ? c.olive : c.hinoki);
        break;
      }
      case 'shrine':
        // a mossy stone wall under a vermilion tamagaki fence
        for (let y = 0; y <= 5; y++) put(x, G + y, z, y <= 2 ? (hash3(x, y, z) < 0.3 ? c.moss : c.stone) : y === 5 ? c.torii : (x + z) % 3 === 0 ? c.torii : 0);
        break;
      case 'bank':
        // the promenade ends at a stone wall with a granite coping
        for (let y = 0; y <= 4; y++) put(x, G + y, z, y === 4 ? c.stoneStep : hash3(x, y, z) < 0.15 ? c.moss : c.stone);
        break;
      default:
        // garden hedge
        for (let y = 0; y <= 5; y++) put(x, G + y, z, hash3(x, y, z) < 0.5 ? c.leafDark : c.leaf);
    }
  }

  // behind the fences: woods on the hill and by the shrine, trees and shrubs in the park and the gardens
  const r = rng(6161);
  for (let z = VZ0 + 4; z <= ZS - 2; z += 9)
    for (let x = XW + 2; x <= XE - 2; x += 9) {
      if (!near(x, z)) continue;
      const jx = x + Math.floor(r() * 6) - 3, jz = z + Math.floor(r() * 6) - 3;
      // the trunk and most of the crown have to stand inside the band, clear of the fence
      let deep = true;
      for (let a = -4; a <= 4 && deep; a += 4) for (let d = -4; d <= 4; d += 4) if (!beyondCell(jx + a, jz + d)) { deep = false; break; }
      if (!deep || jx < XW + 1 || jx > XE - 2 || jz > ZS - 2) continue;
      const kind = groundOf(jx, jz);
      const h = hash3(jx, jz, 44);
      if (kind === 'hill') tree(b, jx, jz, 6200 + jx * 7 + jz, h < 0.45 ? 'pine' : h < 0.75 ? 'keyaki' : 'maple', G + hillAt(jx, jz));
      else if (kind === 'shrine') tree(b, jx, jz, 6300 + jx * 7 + jz, h < 0.6 ? 'keyaki' : 'pine');
      else if (kind === 'park') tree(b, jx, jz, 6400 + jx * 7 + jz, h < 0.3 ? 'sakura' : h < 0.7 ? 'keyaki' : 'pine');
      else if (kind === 'garden') tree(b, jx, jz, 6500 + jx * 7 + jz, h < 0.4 ? 'maple' : h < 0.7 ? 'pine' : 'keyaki');
      else if (kind === 'bank') tree(b, jx, jz, 6600 + jx * 7 + jz, 'sakura');
      else continue;
      // a few shrubs round the foot
      for (let i = 0; i < 3; i++) {
        const sx = jx + Math.floor(r() * 9) - 4, sz = jz + Math.floor(r() * 9) - 4;
        if (!beyondCell(sx, sz) || groundOf(sx, sz) !== kind) continue;
        const base = G + (kind === 'hill' ? hillAt(sx, sz) : 0);
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) for (let y = 0; y <= 2; y++)
          if (Math.abs(dx) + Math.abs(dz) + y <= 2 && beyondCell(sx + dx, sz + dz)) put(sx + dx, base + y, sz + dz, hash3(sx + dx, y, sz + dz) < 0.5 ? c.leafDark : c.leaf);
      }
    }

  // the floodgates where the canal leaves town: concrete towers on both banks, the gate leaf down to the water
  // between them, the winding house on a bridge across the top
  for (const gx of [XW + 5, XE - 5]) {
    const t0 = gx - 4, t1 = gx + 4;
    for (const [z0, z1] of [[163, 170], [201, 208]] as const) {
      g.box(t0, G, z0, t1, G + 34, z1, (x, y, z) => (y % 12 === 0 ? c.concreteDark : (x === t0 || x === t1) && (z === z0 || z === z1) ? c.concreteDark : c.concreteWall));
      for (let y = G + 6; y < G + 30; y += 8) g.box(t0, y, z0 + 2, t0, y + 3, z1 - 2, c.glassDark);
    }
    g.box(gx - 2, 4, 171, gx + 2, G + 2, 200, (_x, y, z) => (z % 5 === 0 || y === G + 2 ? c.steelDark : c.awnBlue));
    g.box(t0, G + 35, 163, t1, G + 42, 208, (_x, y, z) => (y === G + 42 ? c.roofFlat : y === G + 35 ? c.concreteDark : z % 4 === 0 && y > G + 36 && y < G + 41 ? c.glassDark : c.tileWhite));
    for (const z of [163, 208]) g.box(t0, G + 43, z, t1, G + 44, z, c.steel);
    b.lamp(gx * V, 9.5, 167 * V, [1, 0.25, 0.15], 3, 0.6);
  }

  // a tower crane over the roadworks where Neon-dori runs off the map, and one where Minami-dori leaves eastward
  crane(b, 308, ZS - 10, 1, 48);
  crane(b, XE - 8, 248, -1, 44);

  // cones in front of the hoarding on the avenues (props, so they cost no voxels; placed the same in every worker)
  for (let z = VZ0; z <= ZS; z++)
    for (let x = XW; x <= XE; x++) {
      if (!near(x, z) || (x * 7 + z * 13) % 23 !== 0 || beyondCell(x, z) || underpassAt(x, z)) continue;
      const kind = groundOf(x, z);
      if (kind !== 'avenue' && kind !== 'street') continue;
      // two cells in front of the band, facing it
      for (const [dx, dz] of N4) {
        if (!beyondCell(x + dx * 3, z + dz * 3) || beyondCell(x + dx, z + dz)) continue;
        b.place(trafficCone(k), (x + 0.5) * V, 0, (z + 0.5) * V);
        break;
      }
    }
  // and a striped barrier on its feet before the hoarding where each avenue is shut
  const shut: [number, number, number][] = [
    ...[-23.3, 60.4].map((z) => [MAP_W + insetW(z) + 1.1, z, 1] as [number, number, number]),
    ...[-23.3, 12.5, 60.4].map((z) => [MAP_E - insetE(z) - 1.1, z, 1] as [number, number, number]),
    ...[-5, 77].map((x) => [x, MAP_S - insetS(x) - 1.1, 0] as [number, number, number]),
  ];
  for (const [x, z, t] of shut) {
    if (tokyoBeyond(x, z) || underpassAt(Math.floor(x / V), Math.floor(z / V))) continue;
    b.place(workBarrier(k), x, 0, z, t);
  }
}

/** A tower crane: a lattice mast, the cab, the jib out over the site and the counterweight behind. dir: +1 jib toward +x, -1 toward -x. */
function crane(b: Builder, mx: number, mz: number, dir: 1 | -1, jib: number) {
  const g = b.grid, c = b.c;
  const top = G + 104;
  // the mast: four corner chords, cross bracing on each face
  for (let y = G; y <= top; y++)
    for (let dz = 0; dz < 4; dz++) for (let dx = 0; dx < 4; dx++) {
      const edge = dx === 0 || dx === 3 || dz === 0 || dz === 3;
      if (!edge) continue;
      const corner = (dx === 0 || dx === 3) && (dz === 0 || dz === 3);
      const along = dx === 0 || dx === 3 ? dz : dx;
      const brace = (y - G) % 6 === 0 || along === ((y - G) % 6 < 3 ? (y - G) % 3 + 0 : 3 - ((y - G) % 3));
      if (corner || brace) g.set(mx + dx, y, mz + dz, c.lineYellow);
    }
  g.box(mx - 1, G, mz - 1, mx + 4, G + 1, mz + 4, c.concreteDark);
  // the slewing ring and the cab
  g.box(mx - 1, top + 1, mz - 1, mx + 4, top + 2, mz + 4, c.steelDark);
  g.box(mx + (dir > 0 ? 3 : -2), top + 3, mz, mx + (dir > 0 ? 5 : 0), top + 6, mz + 3, (x, y) => (y === top + 5 && (x + mz) % 2 === 0 ? c.glassDark : c.tileWhite));
  // the jib and the counter-jib, a triangular lattice in section
  const x0 = dir > 0 ? mx : mx + 3;
  for (let i = -16; i <= jib; i++) {
    const x = x0 + i * dir;
    g.set(x, top + 3, mz, c.lineYellow); g.set(x, top + 3, mz + 3, c.lineYellow);
    if (i % 3 === 0) g.box(x, top + 3, mz, x, top + 3, mz + 3, c.lineYellow);
    g.set(x, top + 6, mz + 1, c.lineYellow); g.set(x, top + 6, mz + 2, c.lineYellow);
    if ((i & 3) === 0) { g.set(x, top + 4, mz + 1, c.lineYellow); g.set(x, top + 5, mz + 2, c.lineYellow); }
  }
  // the counterweight blocks and the trolley with its hook hanging over the site
  g.box(x0 - 15 * dir, top, mz, x0 - 10 * dir, top + 2, mz + 3, c.concrete);
  const tx = x0 + Math.round(jib * 0.6) * dir;
  g.box(tx, top + 2, mz + 1, tx + dir, top + 2, mz + 2, c.steelDark);
  for (let y = G + 40; y < top + 2; y++) g.set(tx, y, mz + 1, c.steelDark);
  g.box(tx - 1, G + 37, mz, tx + 1, G + 39, mz + 2, c.awnRed);
  // a red light on the jib's tip for aircraft
  b.lamp((x0 + jib * dir) * V, (top + 4 - G) * V, (mz + 1.5) * V, [1, 0.15, 0.1], 2.5, 0.8);
  b.occlude(Math.min(mx, x0 + jib * dir), mz, Math.max(mx + 4, x0 + jib * dir), mz + 4, (top - G + 7) * V, (top - G) * V - 1, 'landmark');
}
