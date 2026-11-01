import { hash3 } from './grid';
import { Palette, GLASS_VARY } from './palette';
import { Prop } from './props';
import { paintColors, picture, hang, type PictureKind } from './paintings';
import type { Builder } from './tokyo';
import { V } from './layout';

/**
 * The dining-room kit: what turns a room with a counter and some tables into a place people eat in. The same pieces
 * dress the restaurants, cafés and bars of every city (each city picks its own look from them): shelves of bottles
 * and jars, crockery racks, framed pictures, menu boards, clocks, wall lamps, pendant lights over the tables, the
 * settings on the tables, rugs, big plants in the corners, and the cook's line of cabinets, hob, hood and rail.
 *
 * Everything works in a room's own frame: `a` along the front (left to right seen from the street), `d` in from it,
 * `y` the voxel layer over the floor (0 is the first layer of air). Fine detail is props of 1/16 m voxels, meshed into
 * the chunks like every other prop; coarse pieces go into the grid. Wall pieces sit against solid, unglazed wall only,
 * and anything at body height either stands on furniture that already blocks the floor or is blocked itself.
 */

export const F16 = 0.0625;

export interface Dine {
  b: Builder;
  /** Air cells of the room, inclusive. */
  A0: number; A1: number; D0: number; D1: number;
  /** Highest air layer (the ceiling slab is the layer above). */
  top: number;
  /** World height (m) of the floor surface. */
  floorY: number;
  seed: number;
  get(a: number, y: number, d: number): number;
  set(a: number, y: number, d: number, c: number): void;
  /** Continuous room coords to world metres: cell (a, d) spans a..a+1, d..d+1. */
  m(a: number, d: number): [number, number];
}

/** Local directions: 0 out to the street (-d), 1 along +a, 2 in (+d), 3 along -a. */
export type Dir = 0 | 1 | 2 | 3;

export function dineColors(pal: Palette) {
  const a = (hex: number, vary = 0.04, o: { emit?: number; glass?: boolean } = {}) => pal.add(hex, { vary, ...o });
  return {
    white: a(0xf6f3ec, 0.02), cream: a(0xeee2c6, 0.03), plate: a(0xf4f1ea, 0.015), plateRim: a(0x2f5f9e, 0.03), plateRed: a(0xb8402e, 0.03),
    glass: pal.add(0xd8eaf0, { glass: true }), wine: a(0x6a1424, 0.04), wineW: a(0xe8d890, 0.03), water: pal.add(0xcfe6ee, { glass: true }),
    bottleG: a(0x2e5a34, 0.05), bottleB: a(0x5a3214, 0.05), bottleC: a(0xd8d0b8, 0.03), bottleBlue: a(0x284a7a, 0.04), bottleAmber: a(0x9a5a18, 0.05),
    label: a(0xf0e6cc, 0.03), labelR: a(0xc0392b, 0.03), cork: a(0xb08458, 0.05), gold: a(0xc9a040, 0.04), goldLight: a(0xe6c46a, 0.04),
    steel: a(0xb4bcc4, 0.025), steelDark: a(0x60676e, 0.03), steelMid: a(0x8a9298, 0.03), iron: a(0x2c2a2a, 0.03), black: a(0x1c1b1d, 0.02),
    copper: a(0xb8693a, 0.05), copperDark: a(0x8a4a24, 0.05), brass: a(0xb8923e, 0.04),
    woodL: a(0xc29a68, 0.06), wood: a(0x8e5f3a, 0.06), woodD: a(0x5a3a24, 0.06), woodK: a(0x3a261a, 0.05),
    chalk: a(0x2a3330, 0.03), chalkFrame: a(0x6a4a30, 0.05), chalkW: a(0xe8e6dc, 0.03), chalkY: a(0xf0d870, 0.03), chalkP: a(0xf0a0b0, 0.03),
    clockFace: a(0xf5f0e2, 0.02), ink: a(0x24201e, 0.02),
    leaf: a(0x3f7a34, 0.12), leafL: a(0x63a048, 0.12), leafD: a(0x2a5a28, 0.1), soil: a(0x4a3222, 0.06), trunk: a(0x6a4a30, 0.08),
    potTerra: a(0xb8643a, 0.05), potWhite: a(0xe8e4da, 0.03), potBlue: a(0x2f5a8e, 0.04), potGreen: a(0x3a6a4a, 0.04),
    lemon: a(0xf2d43a, 0.06), lemonLeaf: a(0x3a7a2a, 0.1), chili: a(0xc8281e, 0.06), garlic: a(0xf0e8d6, 0.03), onion: a(0xc88a4a, 0.06), herb: a(0x5a7a3a, 0.12),
    bread: a(0xd09a52, 0.08), breadD: a(0xa86a32, 0.08), basket: a(0xa8804a, 0.06), linenR: a(0xb83a2e, 0.03), linenW: a(0xf4efe4, 0.02), linenB: a(0x2c4a7a, 0.03),
    tea: a(0x8a2a12, 0.04), coffee: a(0x3a2216, 0.04), milk: a(0xf6f2e6, 0.02), beer: a(0xe8a828, 0.04, { emit: 0.05 }), foam: a(0xfbf6e8, 0.02),
    soy: a(0x2a160c, 0.03), rice: a(0xfbfaf4, 0.02), edamame: a(0x7ab04a, 0.08), sauceR: a(0xb8301e, 0.05), food1: a(0xd8883a, 0.1), food2: a(0x9a4a22, 0.08), food3: a(0x6a9a3a, 0.1), food4: a(0xf0d080, 0.06),
    candle: a(0xf8f0d8, 0.02), flame: a(0xffc860, 0.02, { emit: 1.0 }), bulb: a(0xffe1a0, 0.02, { emit: 1.0 }), bulbR: a(0xff7a4a, 0.02, { emit: 0.9 }),
    shadeW: a(0xfff0d0, 0.02, { emit: 0.7 }), shadeA: a(0xffc070, 0.02, { emit: 0.75 }), shadeR: a(0xff6a4a, 0.02, { emit: 0.7 }), shadeG: a(0x7ad0a0, 0.02, { emit: 0.6 }), shadeB: a(0x6aa0f0, 0.02, { emit: 0.6 }),
    paperL: a(0xfaf0d8, 0.02, { emit: 0.6 }), paperR: a(0xd8382a, 0.03, { emit: 0.5 }),
    tile1: a(0x2f63a8, 0.04), tile2: a(0xf5f1e6, 0.02), tile3: a(0xe9c23a, 0.04), tile4: a(0xc8321e, 0.04), tile5: a(0x2a8a7a, 0.04),
    rugR: a(0x8a2a28, 0.04), rugB: a(0x2a3a62, 0.04), rugO: a(0xc8803a, 0.04), rugC: a(0xe8d8b0, 0.03), rugG: a(0x3a5a3a, 0.04), rugK: a(0x2a1e1a, 0.03),
    tatami: a(0xc8c088, 0.04), tatamiEdge: a(0x2a3a2a, 0.03), cushion: a(0x6a3a7a, 0.04), cushionB: a(0x2c3d73, 0.04), cushionR: a(0xa8323a, 0.04),
    paper: a(0xf6efe0, 0.02), poster1: a(0xd8402e, 0.03), poster2: a(0x2a5a9a, 0.03), poster3: a(0xf0c040, 0.03),
    sack: a(0xd8c8a0, 0.05), sackD: a(0xb8a478, 0.05), flour: a(0xf6f2e8, 0.03), crate: a(0xa8804e, 0.06), crateY: a(0xe8b830, 0.04), crateR: a(0xc83a2e, 0.04), crateB: a(0x2a5aa0, 0.04),
    nazar: a(0x1a4aa8, 0.03), nazarL: a(0x7ab8f0, 0.03), tulipR: a(0xc8281e, 0.04),
  };
}
export type DC = ReturnType<typeof dineColors>;

// ---------------------------------------------------------------------------------------------- the frame

export function dvec(R: Dine, k: Dir): [number, number] {
  const [x0, z0] = R.m(0, 0);
  const [x1, z1] = k === 0 ? R.m(0, -1) : k === 1 ? R.m(1, 0) : k === 2 ? R.m(0, 1) : R.m(-1, 0);
  return [Math.round((x1 - x0) / V), Math.round((z1 - z0) / V)];
}
/** Quarter turns that point a prop's +z front along local direction k. */
export function dturn(R: Dine, k: Dir): number {
  const [fx, fz] = dvec(R, k);
  return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 0 : 2);
}
/**
 * Which side of a prop placed with its front to k (tableTop's 'n' is its +z side, 'e' its +x side) faces local
 * direction L. Room frames differ in handedness from city to city, so this is worked out, not assumed.
 */
export function sideOf(R: Dine, k: Dir, L: Dir): 'n' | 's' | 'e' | 'w' {
  const [fx, fz] = dvec(R, k);
  const [px, pz] = [fz, -fx]; // the prop's +x once turned (turn 1 takes +z to +x and +x to -z)
  const [lx, lz] = dvec(R, L);
  if (lx === fx && lz === fz) return 'n';
  if (lx === -fx && lz === -fz) return 's';
  return lx === px && lz === pz ? 'e' : 'w';
}
export function face(R: Dine, k: Dir): number {
  const [fx, fz] = dvec(R, k);
  return Math.atan2(fx, fz);
}
export function box(R: Dine, a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: number | ((a: number, y: number, d: number) => number)): void {
  for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++)
    for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) R.set(a, y, d, typeof col === 'number' ? col : col(a, y, d));
}
/** Like box, but only into air: never fills what is already there. */
export function air(R: Dine, a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: number | ((a: number, y: number, d: number) => number)): void {
  box(R, a0, y0, d0, a1, y1, d1, (a, y, d) => (R.get(a, y, d) ? R.get(a, y, d) : typeof col === 'number' ? col : col(a, y, d)));
}
/** Repaint solid cells only (a floor, a wall), never fill an opening. */
export function paint(R: Dine, a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: number | ((a: number, y: number, d: number) => number)): void {
  box(R, a0, y0, d0, a1, y1, d1, (a, y, d) => (R.get(a, y, d) ? (typeof col === 'number' ? col : col(a, y, d)) : 0));
}
/** A prop by its footprint centre (room coords), its base y metres over the floor, its front turned to k. */
export function put(R: Dine, p: Prop, a: number, d: number, y: number, k: Dir): void {
  const [x, z] = R.m(a, d);
  R.b.place(p, x, R.floorY + y, z, dturn(R, k));
}
export function lamp(R: Dine, a: number, d: number, y: number, col: [number, number, number], rad: number, inten: number): void {
  const [x, z] = R.m(a, d);
  R.b.lamp(x, R.floorY + y, z, col, rad, inten);
}
/** Keep walkers off cells a0..a1 x d0..d1. */
export function blockCells(R: Dine, a0: number, d0: number, a1: number, d1: number): void {
  const [x0, z0] = R.m(Math.min(a0, a1) + 0.05, Math.min(d0, d1) + 0.05), [x1, z1] = R.m(Math.max(a0, a1) + 0.95, Math.max(d0, d1) + 0.95);
  R.b.block(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1));
}

// ---------------------------------------------------------------------------------------------- walls

/** A wall of the room: `u` runs along it, `cell(u)` is its voxel column, `line(u)` the air column in front of it. */
export interface Wall {
  id: 'L' | 'R' | 'B';
  u0: number; u1: number;
  /** Which way is into the room, and the way u runs seen from inside (for left-to-right pictures). */
  into: Dir;
  cell(u: number): [number, number];
  line(u: number): [number, number];
  /** Continuous room coords of a point `off` cells out from the wall's face at continuous position u. */
  at(u: number, off: number): [number, number];
}

export function walls(R: Dine): Record<'L' | 'R' | 'B', Wall> {
  return {
    L: { id: 'L', u0: R.D0, u1: R.D1, into: 1, cell: (u) => [R.A0 - 1, u], line: (u) => [R.A0, u], at: (u, o) => [R.A0 + o, u] },
    R: { id: 'R', u0: R.D0, u1: R.D1, into: 3, cell: (u) => [R.A1 + 1, u], line: (u) => [R.A1, u], at: (u, o) => [R.A1 + 1 - o, u] },
    B: { id: 'B', u0: R.A0, u1: R.A1, into: 0, cell: (u) => [u, R.D1 + 1], line: (u) => [u, R.D1], at: (u, o) => [u, R.D1 + 1 - o] },
  };
}

/** True when the wall is solid and unglazed over u0..u1 x y0..y1 and nothing stands in front of it there. */
export function bare(R: Dine, w: Wall, u0: number, u1: number, y0: number, y1: number, depth = 1): boolean {
  if (u0 < w.u0 || u1 > w.u1) return false;
  const pal = R.b.pal;
  for (let u = u0; u <= u1; u++) for (let y = y0; y <= y1; y++) {
    const [ca, cd] = w.cell(u);
    const c = R.get(ca, y, cd);
    if (!c || pal.vary[c] === GLASS_VARY || pal.emit[c] > 0.2) return false;
    for (let k = 0; k < depth; k++) {
      const [la, ld] = w.at(u + 0.5, k + 0.5);
      if (R.get(Math.floor(la), y, Math.floor(ld))) return false;
    }
  }
  return true;
}

/** Hang a flat prop (built facing +z, its back at z = 0) on a wall: centred at u (continuous), its bottom y metres up. */
export function onWall(R: Dine, w: Wall, p: Prop, u: number, y: number): void {
  const depth = p.sz * p.scale / V; // in cells
  const [a, d] = w.at(u, depth / 2 + 0.01);
  put(R, p, a, d, y, w.into);
}

/** Find the free stretches of a wall at layers y0..y1, at least n cells long. */
export function stretches(R: Dine, w: Wall, y0: number, y1: number, n: number, depth = 1): [number, number][] {
  const out: [number, number][] = [];
  let s = -1;
  for (let u = w.u0; u <= w.u1 + 1; u++) {
    const ok = u <= w.u1 && bare(R, w, u, u, y0, y1, depth);
    if (ok && s < 0) s = u;
    if (!ok && s >= 0) { if (u - s >= n) out.push([s, u - 1]); s = -1; }
  }
  return out;
}

// ---------------------------------------------------------------------------------------------- fine props

/** Goods on a shelf, by kind. */
export type Goods = 'bottles' | 'wine' | 'sake' | 'jars' | 'plates' | 'cups' | 'copper' | 'books' | 'tins' | 'spice' | 'bread' | 'glasses' | 'tea';

function goodsAt(p: Prop, c: DC, kind: Goods, x: number, y: number, z0: number, depth: number, seed: number, room: number): number {
  // returns the width used (fine voxels)
  const h = hash3(x, seed, 31);
  const zc = z0 + (depth >> 1);
  switch (kind) {
    case 'bottles': case 'wine': case 'sake': {
      const cols = kind === 'wine' ? [c.wine, c.bottleG, c.bottleG, c.bottleB] : kind === 'sake' ? [c.bottleC, c.bottleG, c.bottleB, c.bottleBlue] : [c.bottleG, c.bottleB, c.bottleAmber, c.bottleC, c.bottleBlue];
      const col = cols[Math.floor(h * cols.length)];
      const tall = kind === 'sake' ? 5 + (h < 0.5 ? 1 : 0) : 4 + (h < 0.4 ? 1 : 0);
      if (tall + 2 > room) return 2;
      p.box(x, y, zc, x, y + tall - 1, zc, col);
      p.set(x, y + tall, zc, kind === 'wine' ? c.cork : col);
      if (kind !== 'wine' || h < 0.7) p.set(x, y + 2, zc, kind === 'sake' ? c.label : h < 0.5 ? c.label : c.labelR);
      if (kind === 'sake' && h < 0.5) p.box(x + 1, y, zc, x + 1, y + tall - 2, zc, cols[(Math.floor(h * 7) + 1) % cols.length]);
      return kind === 'sake' && h < 0.5 ? 3 : 2;
    }
    case 'glasses': {
      p.box(x, y, zc, x, y + 1, zc, c.glass);
      if (h < 0.5) p.box(x + 1, y, zc, x + 1, y + 1, zc, c.glass);
      return 3;
    }
    case 'jars': {
      if (room < 4) return 2;
      const fill = [c.lemon, c.chili, c.food1, c.herb, c.onion, c.food3, c.garlic][Math.floor(h * 7)];
      p.box(x, y, z0, x + 1, y + 1, z0 + 1, fill);
      p.box(x, y + 2, z0, x + 1, y + 2, z0 + 1, h < 0.5 ? c.brass : c.wood);
      return 3;
    }
    case 'spice': {
      if (room < 3) return 2;
      const fill = [c.chili, c.food1, c.lemon, c.herb, c.food2, c.onion][Math.floor(h * 6)];
      p.box(x, y, z0, x + 1, y + 1, z0 + 1, c.glass);
      p.box(x, y, z0, x + 1, y, z0 + 1, fill);
      p.box(x, y + 2, z0, x + 1, y + 2, z0 + 1, c.steel);
      return 3;
    }
    case 'plates': {
      // plates stood on edge along the shelf, a rim of colour
      const rim = [c.plateRim, c.plateRed, c.tile5, c.tile3][Math.floor(h * 4)];
      if (room < 4) return 2;
      p.box(x, y, z0, x + 2, y + 2, z0, c.plate);
      p.set(x + 1, y + 1, z0, rim); p.set(x + 1, y + 3, z0, rim); p.set(x, y + 3, z0, 0);
      p.box(x, y + 3, z0, x + 2, y + 3, z0, rim); p.set(x, y + 3, z0, 0); p.set(x + 2, y + 3, z0, 0);
      return 4;
    }
    case 'cups': {
      p.set(x, y, zc, c.white); p.set(x, y + 1, zc, h < 0.5 ? c.white : c.plateRim);
      if (h < 0.6) { p.set(x + 1, y, zc, c.white); }
      return 3;
    }
    case 'tea': {
      // tulip glasses on saucers
      p.set(x, y, zc, c.plate); p.box(x, y + 1, zc, x, y + 2, zc, c.tea);
      return 2;
    }
    case 'copper': {
      if (room < 4) return 2;
      p.box(x, y, z0, x + 2, y + 2, z0 + 2, c.copper);
      p.box(x, y + 2, z0, x + 2, y + 2, z0 + 2, c.copperDark);
      if (h < 0.5) p.set(x + 1, y + 3, z0 + 1, c.brass);
      return 4;
    }
    case 'books': {
      const cols = [c.labelR, c.plateRim, c.food4, c.leafD, c.cream, c.woodD];
      const t = 3 + Math.floor(h * 2);
      if (t + 1 > room) return 1;
      p.box(x, y, z0, x, y + t - 1, z0 + depth - 1, cols[Math.floor(h * 6)]);
      return 1;
    }
    case 'tins': {
      const cols = [c.labelR, c.food4, c.plateRim, c.leafD, c.gold];
      p.box(x, y, zc - 1, x + 1, y + 2, zc, cols[Math.floor(h * 5)]);
      return 3;
    }
    case 'bread': {
      p.box(x, y, z0, x + 2, y + 1, z0 + depth - 1, h < 0.5 ? c.bread : c.breadD);
      p.box(x, y + 2, z0 + 1, x + 2, y + 2, z0 + depth - 2, c.bread);
      return 4;
    }
  }
}

/** A wall shelf: a board on two brackets, goods along it. Faces +z; `len` fine voxels long, 4 deep. */
export function shelfProp(c: DC, len: number, goods: Goods[], seed: number, board = c.wood, tiers = 1): Prop {
  const tierH = 7;
  const p = new Prop(len, tierH * tiers, 4, F16);
  for (let t = 0; t < tiers; t++) {
    const y0 = t * tierH;
    p.box(0, y0, 0, len - 1, y0, 3, board);
    for (const bx of [1, len - 2]) p.box(bx, y0 - 1 < 0 ? y0 : y0 - 1, 0, bx, y0, 0, c.iron);
    for (let x = 1; x < len - 1;) {
      const g = goods[Math.floor(hash3(x, t, seed) * goods.length)];
      if (hash3(x, t + 7, seed) < 0.12) { x += 2; continue; }
      x += goodsAt(p, c, g, x, y0 + 1, 0, 4, seed + t * 13, tierH - 1);
    }
  }
  return p;
}

/** A framed chalkboard menu: lines of chalk "writing", a heading in colour. Faces +z. */
export function chalkboard(c: DC, w: number, h: number, seed: number): Prop {
  const p = new Prop(w, h, 1, F16);
  p.box(0, 0, 0, w - 1, h - 1, 0, (x, y) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? c.chalkFrame : c.chalk));
  for (let y = h - 4; y >= 2; y -= 2) {
    const head = y === h - 4;
    const col = head ? c.chalkY : c.chalkW;
    for (let x = 2; x < w - 2; x++) {
      const word = hash3(x >> 1, y, seed) < (head ? 0.85 : 0.7);
      if (word && (!head || (x > 3 && x < w - 4))) p.set(x, y, 0, hash3(x, y, seed + 5) < 0.08 ? c.chalkP : col);
    }
    if (!head) p.set(w - 3, y, 0, c.chalkW); // the price
  }
  return p;
}

/** A round wall clock. Faces +z. */
export function clockProp(c: DC, rim = c.woodD): Prop {
  const p = new Prop(7, 7, 1, F16);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const r = Math.hypot(x - 3, y - 3);
    if (r > 3.4) continue;
    p.set(x, y, 0, r > 2.5 ? rim : c.clockFace);
  }
  p.set(3, 3, 0, c.ink); p.set(3, 4, 0, c.ink); p.set(3, 5, 0, c.ink); p.set(4, 3, 0, c.ink);
  return p;
}

/** A framed mirror. Faces +z. */
export function mirrorProp(c: DC, w: number, h: number, frame = c.gold): Prop {
  const p = new Prop(w, h, 1, F16);
  p.box(0, 0, 0, w - 1, h - 1, 0, (x, y) => (x === 0 || y === 0 || x === w - 1 || y === h - 1 ? frame : c.glass));
  return p;
}

/** A wall lamp: a bracket and a glowing shade. Faces +z. */
export function sconce(c: DC, shade: number, metal = c.brass): Prop {
  const p = new Prop(3, 5, 3, F16);
  p.box(1, 1, 0, 1, 1, 1, metal);
  p.box(0, 2, 1, 2, 4, 2, shade);
  p.set(1, 1, 2, metal);
  return p;
}

/** A decorative plate hung on the wall. Faces +z. */
export function wallPlate(c: DC, rim: number, mid: number, seed: number): Prop {
  const p = new Prop(5, 5, 1, F16);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    const r = Math.hypot(x - 2, y - 2);
    if (r > 2.4) continue;
    p.set(x, y, 0, r > 1.6 ? rim : r < 0.6 ? mid : hash3(x, y, seed) < 0.3 ? mid : c.plate);
  }
  return p;
}

/** A rail with things hanging from hooks: ladles, pans, copper pots, or a string of garlic and peppers. Faces +z. */
export function hangRail(c: DC, len: number, kind: 'utensils' | 'pans' | 'garland' | 'lemons' | 'herbs', seed: number): Prop {
  const p = new Prop(len, 9, 3, F16);
  const top = 8;
  p.box(0, top, 0, len - 1, top, 0, kind === 'garland' || kind === 'lemons' || kind === 'herbs' ? c.cork : c.steelDark);
  for (let x = 1; x < len - 1;) {
    const h = hash3(x, seed, 11);
    switch (kind) {
      case 'utensils': {
        const l = 3 + Math.floor(h * 3);
        p.box(x, top - l, 1, x, top - 1, 1, c.steel);
        if (h < 0.5) p.box(x - (x > 0 ? 1 : 0), top - l - 1, 1, x + 1, top - l, 1, c.steel); // the bowl of a ladle
        x += 3; break;
      }
      case 'pans': {
        p.box(x + 1, top - 2, 1, x + 1, top - 1, 1, c.iron);
        p.box(x, top - 6, 0, x + 2, top - 3, 2, h < 0.5 ? c.copper : c.steelMid);
        x += 4; break;
      }
      case 'garland': {
        const col = h < 0.45 ? c.chili : h < 0.8 ? c.garlic : c.onion;
        for (let y = top - 1; y >= top - 5; y--) if (hash3(x, y, seed) < 0.85) p.set(x, y, 1, col);
        x += 2; break;
      }
      case 'lemons': {
        p.set(x, top - 1, 1, c.lemonLeaf); p.box(x, top - 3, 1, x + 1, top - 2, 2, c.lemon);
        x += 3; break;
      }
      case 'herbs': {
        p.box(x, top - 4, 1, x + 1, top - 1, 1, (_x, y) => (y === top - 1 ? c.cork : hash3(x, y, seed) < 0.5 ? c.herb : c.leafD));
        x += 3; break;
      }
    }
  }
  return p;
}

/** A pendant light on its cord, hanging `drop` fine voxels from the ceiling. Base at the shade's bottom. */
export function pendantProp(c: DC, kind: 'cone' | 'globe' | 'paper' | 'lantern' | 'bell' | 'cage', shade: number, drop: number, seed = 1): Prop {
  const w = kind === 'paper' ? 7 : kind === 'lantern' ? 5 : 5;
  const sh = kind === 'paper' ? 8 : kind === 'lantern' ? 7 : 4;
  const p = new Prop(w, sh + drop, w, F16);
  const m = (w - 1) / 2;
  p.box(m, sh, m, m, sh + drop - 1, m, c.iron);
  switch (kind) {
    case 'cone':
      p.box(m - 1, sh - 1, m - 1, m + 1, sh - 1, m + 1, shade);
      p.box(0, 0, 0, w - 1, sh - 2, w - 1, (x, y, z) => (Math.max(Math.abs(x - m), Math.abs(z - m)) <= 1 + (sh - 2 - y) * 0.7 ? shade : 0));
      p.box(m - 1, 0, m - 1, m + 1, 0, m + 1, c.bulb);
      break;
    case 'bell':
      p.box(0, 0, 0, w - 1, sh - 2, w - 1, (x, _y, z) => ((x === 0 || x === w - 1) && (z === 0 || z === w - 1) ? 0 : shade));
      p.box(1, sh - 1, 1, w - 2, sh - 1, w - 2, shade);
      p.box(1, 0, 1, w - 2, 0, w - 2, c.bulb);
      break;
    case 'globe':
      p.ellipsoid(m + 0.5, 2, m + 0.5, 2.5, 2, 2.5, shade);
      p.set(m, sh - 1, m, c.brass);
      break;
    case 'cage':
      // an industrial cage: brass ribs round a bare bulb, a little cap
      p.box(0, 0, 0, w - 1, sh - 2, w - 1, (x, _y, z) => ((x === 0 || x === w - 1) && (z === 0 || z === w - 1) ? c.brass : 0));
      p.box(1, sh - 1, 1, w - 2, sh - 1, w - 2, c.brass);
      p.box(1, 0, 1, w - 2, sh - 2, w - 2, (x, y, z) => (x === m && z === m ? c.bulb : y === 0 ? 0 : c.bulb));
      break;
    case 'paper': {
      // a chochin: a paper lantern, fat at the waist, black rings top and bottom (square sections mesh cheaply)
      const sq = (y0: number, y1: number, r: number, col: number, cut: boolean) => p.box(3 - r, y0, 3 - r, 3 + r, y1, 3 + r, (x, _y, z) => (cut && Math.abs(x - 3) === r && Math.abs(z - 3) === r ? 0 : col));
      sq(0, 0, 1, c.black, false); sq(7, 7, 1, c.black, false);
      sq(1, 1, 2, shade, true); sq(6, 6, 2, shade, true);
      sq(2, 5, 3, shade, true);
      break;
    }
    case 'lantern':
      // an Ottoman lantern: a brass cap and foot round a body of coloured glass panes
      p.box(1, 0, 1, 3, 0, 3, c.brass);
      p.box(0, 1, 0, 4, 4, 4, (x, y, z) => ((x === 0 || x === 4) && (z === 0 || z === 4) ? c.brass : [c.shadeR, c.shadeB, c.shadeA, c.shadeG][(x + z + y + seed) & 3]));
      p.box(1, 5, 1, 3, 5, 3, c.brass); p.set(2, 6, 2, c.brass);
      break;
  }
  return p;
}

/** A big potted plant for a corner. Footprint about 0.5 m; faces +z. */
export function bigPlant(c: DC, kind: 'fig' | 'palm' | 'lemon' | 'monstera' | 'olive', pot: number, seed: number): Prop {
  const p = new Prop(9, 26, 9, F16);
  const ph = kind === 'lemon' || kind === 'olive' ? 6 : 5;
  p.box(1, 0, 1, 7, ph - 1, 7, (x, y, z) => (y === ph - 1 && x > 1 && x < 7 && z > 1 && z < 7 ? c.soil : (x === 1 || x === 7) && (z === 1 || z === 7) ? 0 : pot));
  // (foliage is solid masses with the leaf colours scattered over them: holes and loose voxels mesh to many quads)
  const leafy = (x: number, y: number, z: number) => { const h = hash3(x, y, z + seed); return h < 0.35 ? c.leafD : h < 0.75 ? c.leaf : c.leafL; };
  switch (kind) {
    case 'fig':
      p.box(4, ph, 4, 4, 13, 4, c.trunk);
      p.ellipsoid(4.5, 17, 4.5, 4, 4.5, 4, leafy);
      p.ellipsoid(3.5, 21.5, 5, 2.6, 2.5, 2.6, leafy);
      break;
    case 'palm':
      p.box(4, ph, 4, 4, 13, 4, c.trunk);
      for (let k = 0; k < 6; k++) {
        const an = (k / 6) * Math.PI * 2 + seed;
        for (let s = 1; s < 5; s++) {
          const x = Math.round(4 + Math.cos(an) * s * 0.9), z = Math.round(4 + Math.sin(an) * s * 0.9), y = 14 + Math.round(s * 1.2 - s * s * 0.3);
          p.set(x, y, z, s % 2 ? c.leaf : c.leafL);
        }
      }
      p.box(3, 13, 3, 5, 15, 5, c.leafD);
      break;
    case 'lemon': case 'olive':
      p.box(4, ph, 4, 4, 12, 4, c.trunk);
      p.ellipsoid(4.5, 17, 4.5, 4.2, 4.5, 4.2, (x, y, z) => {
        const h = hash3(x, y, z + seed);
        if (kind === 'lemon' && h < 0.1) return c.lemon;
        return kind === 'olive' ? (h < 0.4 ? c.herb : c.leafD) : leafy(x, y, z);
      });
      break;
    case 'monstera':
      p.box(4, ph, 4, 4, 8, 4, c.leafD);
      for (let k = 0; k < 6; k++) {
        const an = (k / 6) * Math.PI * 2 + seed * 0.7;
        const r = 2 + (k % 2);
        const x = Math.round(4 + Math.cos(an) * r), z = Math.round(4 + Math.sin(an) * r), y = 9 + (k % 3) * 3;
        p.box(x - 1, y, z - 1, x + 1, y + 1, z + 1, leafy);
        p.box(Math.min(4, x), y - 1, Math.min(4, z), Math.max(4, x), y - 1, Math.max(4, z), c.leafD);
      }
      p.keepConnected(4, 0, 4);
      break;
  }
  return p;
}

/**
 * What is laid on a table: one place per seat, the things shared in the middle. `style` picks the cuisine; the prop
 * is w x d fine voxels (the table top), its base on the table's surface. Faces +z; places at -x and +x ends when
 * `along` is 'x' (seats at the table's left and right), at -z and +z when 'z'.
 */
export type TableStyle = 'it' | 'jp' | 'tr' | 'cafe' | 'bar';
export function tableTop(c: DC, style: TableStyle, w: number, d: number, seats: ('n' | 's' | 'e' | 'w')[], seed: number): Prop {
  const p = new Prop(w, 6, d, F16);
  const cx = Math.floor((w - 1) / 2), cz = Math.floor((d - 1) / 2);
  const h = (k: number) => hash3(seed, k, 77);
  const dish = [c.food1, c.food2, c.food3, c.food4, c.sauceR][Math.floor(h(1) * 5)];
  for (const s of seats) {
    // the place: its centre one plate-radius in from the edge
    const [px, pz, ux, uz] = s === 'w' ? [2, cz, 0, 1] : s === 'e' ? [w - 3, cz, 0, 1] : s === 'n' ? [cx, d - 3, 1, 0] : [cx, 2, 1, 0];
    const eaten = h(px * 3 + pz) < 0.6;
    switch (style) {
      case 'it': case 'cafe': {
        // a plate, something on it, the fork and knife either side, a glass beyond
        p.box(px - 1, 0, pz - 1, px + 1, 0, pz + 1, c.plate);
        if (style === 'it') { p.set(px, 0, pz, eaten ? dish : c.plate); if (eaten) p.set(px + ux, 0, pz + uz, dish); }
        else { p.set(px, 1, pz, c.white); p.set(px, 2, pz, c.coffee); }
        if (style === 'it') {
          // the fork and the knife, either side of the plate along the table's edge
          const fx = px - ux * 2, fz = pz - uz * 2, kx = px + ux * 2, kz = pz + uz * 2;
          if (fx >= 0 && fz >= 0) p.set(fx, 0, fz, c.steel);
          if (kx < w && kz < d) p.set(kx, 0, kz, c.steel);
        }
        const gx = s === 'w' ? px + 2 : s === 'e' ? px - 2 : px + 1, gz = s === 'n' ? pz - 2 : s === 's' ? pz + 2 : pz + 1;
        if (gx >= 0 && gz >= 0 && gx < w && gz < d) p.box(gx, 0, gz, gx, style === 'it' ? 2 : 1, gz, style === 'it' && h(9) < 0.6 ? c.wine : c.glass);
        break;
      }
      case 'jp': {
        // a small plate, a rice bowl, chopsticks on their rest, a sake cup or a beer glass
        p.set(px, 0, pz, c.rice); p.set(px, 1, pz, eaten ? c.rice : c.black);
        p.box(px - ux - (ux ? 0 : 1), 0, pz - uz - (uz ? 0 : 1), px - ux - (ux ? 0 : 1), 0, pz - uz - (uz ? 0 : 1), c.plate);
        const sx = px + (ux ? 0 : (s === 'w' ? 1 : -1)), sz = pz + (uz ? 0 : (s === 's' ? 1 : -1));
        p.box(Math.min(sx, sx + ux * 2), 0, Math.min(sz, sz + uz * 2), Math.max(sx, sx + ux * 2), 0, Math.max(sz, sz + uz * 2), c.woodL);
        const gx = px + ux * 2 + (ux ? 0 : (s === 'w' ? 1 : -1)), gz = pz + uz * 2 + (uz ? 0 : (s === 's' ? 1 : -1));
        if (gx >= 0 && gz >= 0 && gx < w && gz < d) {
          if (h(px + 5) < 0.5) { p.box(gx, 0, gz, gx, 2, gz, c.beer); p.set(gx, 3, gz, c.foam); }
          else p.set(gx, 0, gz, c.white);
        }
        break;
      }
      case 'tr': {
        // a tulip glass of tea on its saucer, a small plate, a spoon
        p.set(px, 0, pz, c.plateRed); p.box(px, 1, pz, px, 2, pz, c.tea);
        const qx = px + ux * 2 + (ux ? 0 : (s === 'w' ? 1 : -1)), qz = pz + uz * 2 + (uz ? 0 : (s === 's' ? 1 : -1));
        if (qx >= 0 && qz >= 0 && qx < w && qz < d) { p.set(qx, 0, qz, c.plate); if (eaten) p.set(qx, 1, qz, dish); }
        break;
      }
      case 'bar': {
        p.box(px, 0, pz, px, 2, pz, h(px) < 0.5 ? c.beer : c.glass);
        if (h(px) < 0.5) p.set(px, 3, pz, c.foam);
        break;
      }
    }
  }
  // the middle: what is shared
  switch (style) {
    case 'it':
      if (h(3) < 0.55) { p.box(cx, 0, cz, cx, 3, cz, h(4) < 0.5 ? c.bottleG : c.wine); p.set(cx, 4, cz, c.cork); }
      else { p.set(cx, 0, cz, c.glass); p.set(cx, 1, cz, c.candle); p.set(cx, 2, cz, c.flame); }
      if (w > 6 && d > 6) { p.box(cx + 1, 0, cz + 1, cx + 2, 0, cz + 1, c.basket); p.set(cx + 1, 1, cz + 1, c.bread); }
      break;
    case 'jp':
      p.set(cx, 0, cz, c.soy); p.set(cx, 1, cz, c.soy);
      if (w > 5) { p.box(cx + 1, 0, cz, cx + 1, 1, cz, c.plateRed); }
      if (h(5) < 0.6 && d > 4) { p.box(cx - 1, 0, cz - 1, cx, 0, cz, c.plate); p.set(cx - 1, 1, cz - 1, c.edamame); p.set(cx, 1, cz, c.edamame); }
      break;
    case 'tr':
      p.set(cx, 0, cz, c.white); p.set(cx, 1, cz, c.white);
      if (w > 5) { p.set(cx + 1, 0, cz, c.chili); p.set(cx + 1, 1, cz, c.glass); }
      if (h(6) < 0.5) { p.box(cx - 1, 0, cz - 1, cx, 0, cz, c.bread); }
      break;
    case 'cafe':
      if (h(7) < 0.5) { p.set(cx, 0, cz, c.glass); p.set(cx, 1, cz, h(8) < 0.5 ? c.chili : c.lemon); }
      else { p.set(cx, 0, cz, c.white); p.set(cx, 1, cz, c.white); }
      break;
    case 'bar':
      p.box(cx, 0, cz, cx, 0, cz, c.plate); p.set(cx, 1, cz, c.edamame);
      break;
  }
  return p;
}

/** A round bistro table on one pedestal, its top 0.75 m up; `top` colours the top. 9 x 12 x 9 fine voxels. */
export function bistroTable(c: DC, top: number, metal = c.iron): Prop {
  const p = new Prop(9, 12, 9, F16);
  p.box(2, 0, 4, 6, 0, 4, metal); p.box(4, 0, 2, 4, 0, 6, metal);
  p.box(4, 1, 4, 4, 10, 4, metal);
  // a top with its corners rounded off, one layer: it meshes to a handful of quads
  p.box(0, 11, 0, 8, 11, 8, (x, _y, z) => (Math.abs(x - 4) === 4 && Math.abs(z - 4) === 4 ? 0 : top));
  return p;
}

/** A shallow bowl of fruit, a cake stand or a basket of bread for a counter end. Faces +z. */
export function counterPiece(c: DC, kind: 'register' | 'fruit' | 'cake' | 'bread' | 'menu' | 'vase' | 'jars' | 'machine' | 'taps' | 'tea', seed: number): Prop {
  switch (kind) {
    case 'register': {
      const p = new Prop(5, 5, 4, F16);
      p.box(0, 0, 0, 4, 1, 3, c.steelDark); p.box(0, 2, 1, 4, 3, 3, c.steelMid); p.box(1, 4, 2, 3, 4, 3, c.black); p.box(0, 2, 0, 4, 2, 0, c.ink);
      return p;
    }
    case 'fruit': {
      const p = new Prop(6, 3, 6, F16);
      p.box(0, 0, 0, 5, 0, 5, (x, _y, z) => ((x === 0 || x === 5) && (z === 0 || z === 5) ? 0 : c.plateRim));
      p.box(1, 1, 1, 4, 1, 4, (x, _y, z) => [c.lemon, c.chili, c.food3, c.lemon][(x + z * 2 + seed) & 3]);
      p.box(2, 2, 2, 3, 2, 3, c.lemon);
      return p;
    }
    case 'cake': {
      const p = new Prop(6, 7, 6, F16);
      p.box(2, 0, 2, 3, 2, 3, c.glass); p.box(0, 3, 0, 5, 3, 5, c.plate);
      p.box(1, 4, 1, 4, 5, 4, (_x, y) => (y === 5 ? c.cream : c.food4)); p.set(2, 6, 2, c.chili);
      return p;
    }
    case 'bread': {
      const p = new Prop(7, 4, 5, F16);
      p.box(0, 0, 0, 6, 1, 4, c.basket); p.box(1, 1, 1, 5, 1, 3, 0);
      p.box(1, 1, 1, 5, 2, 3, (x, y, z) => (hash3(x, y, z + seed) < 0.6 ? (y === 2 ? c.bread : c.breadD) : 0));
      return p;
    }
    case 'menu': {
      const p = new Prop(4, 5, 2, F16);
      p.box(0, 0, 0, 3, 0, 1, c.woodD); p.box(0, 1, 1, 3, 4, 1, (x, y) => (y === 4 || x === 0 || x === 3 ? c.woodD : c.paper)); p.set(1, 2, 1, c.ink); p.set(2, 3, 1, c.ink);
      return p;
    }
    case 'vase': {
      const p = new Prop(3, 7, 3, F16);
      p.box(1, 0, 1, 1, 2, 1, c.glass); p.box(0, 3, 0, 2, 3, 2, c.leaf);
      p.set(1, 4, 1, c.leafD); p.set(0, 5, 1, c.chili); p.set(2, 5, 0, c.lemon); p.set(1, 6, 1, c.chili); p.set(2, 4, 2, c.linenW);
      return p;
    }
    case 'jars': {
      const p = new Prop(8, 5, 3, F16);
      for (let x = 0; x < 8; x += 3) {
        const fill = [c.food1, c.lemon, c.food2, c.food3][(x + seed) & 3];
        p.box(x, 0, 0, x + 1, 2, 1, c.glass); p.box(x, 0, 0, x + 1, 1, 1, fill); p.box(x, 3, 0, x + 1, 3, 1, c.steel);
      }
      return p;
    }
    case 'machine': {
      // an espresso machine: steel body, brass dome, two group heads, cups warming on top
      const p = new Prop(8, 7, 5, F16);
      p.box(0, 0, 0, 7, 4, 4, c.steel); p.box(0, 0, 0, 7, 0, 4, c.steelDark);
      p.box(2, 2, 0, 2, 2, 0, c.black); p.box(5, 2, 0, 5, 2, 0, c.black);
      p.box(1, 5, 1, 6, 5, 3, c.brass); p.set(1, 6, 2, c.white); p.set(3, 6, 2, c.white); p.set(5, 6, 2, c.white);
      return p;
    }
    case 'taps': {
      // beer taps on their tower, a drip tray
      const p = new Prop(6, 7, 3, F16);
      p.box(0, 0, 0, 5, 0, 2, c.steelDark); p.box(2, 1, 1, 3, 4, 1, c.steel); p.box(1, 5, 0, 4, 5, 2, c.steel);
      p.box(1, 6, 0, 1, 6, 0, c.black); p.box(4, 6, 0, 4, 6, 0, c.labelR);
      return p;
    }
    case 'tea': {
      // a double teapot on its burner, a tray of glasses
      const p = new Prop(7, 8, 4, F16);
      p.box(0, 0, 0, 3, 0, 3, c.steelDark); p.box(0, 1, 0, 3, 3, 3, c.copper); p.box(1, 4, 1, 2, 5, 2, c.steel); p.set(1, 6, 1, c.steel);
      p.box(4, 0, 0, 6, 0, 3, c.brass); p.set(5, 1, 1, c.tea); p.set(5, 1, 3, c.tea); p.set(4, 1, 2, c.tea); p.set(6, 1, 2, c.tea);
      return p;
    }
  }
}

// ---------------------------------------------------------------------------------------------- room pieces

/**
 * Dress the bare walls: shelves of goods high up, pictures, a clock, a mirror, plates, wall lamps, a menu board.
 * `look` picks what goes up and how often; spans already used by anything (a shelf, a window) are left alone.
 */
export interface WallLook {
  goods: Goods[];
  board: number;
  /** Pictures to hang (none for a tiled bar), and the plates' colours (rim, middle) or none. */
  pictures?: PictureKind[];
  plates?: [number, number][];
  shade?: number;
  menu?: boolean;
  clock?: boolean;
  mirror?: boolean;
  /** What hangs along the top of the walls: bulbs on a wire, a garland of peppers, lemons, flags... */
  rail?: 'utensils' | 'pans' | 'garland' | 'lemons' | 'herbs';
  /** Which walls: the back and both sides by default. */
  only?: ('L' | 'R' | 'B')[];
  /** Lowest layer a picture may hang from (pictures are flat, so they may come down over a bench). */
  picY?: number;
}

export function dressWalls(R: Dine, c: DC, look: WallLook): void {
  const W = walls(R);
  const yShelf = 7; // 1.75 m: over every head
  let i = 0, menuDone = !look.menu, clockDone = !look.clock;
  const seq = (k: number) => hash3(R.seed, k, 41);
  for (const id of look.only ?? ['B', 'L', 'R'] as const) {
    const w = W[id];
    // the high shelf along the free stretches of the wall
    for (const [s0, s1] of stretches(R, w, yShelf, yShelf + 2, 6)) {
      if (seq(i++) < 0.25 && id !== 'B') continue;
      const len = Math.min(s1 - s0 + 1, 16);
      const u0 = s0 + Math.floor((s1 - s0 + 1 - len) / 2);
      onWall(R, w, shelfProp(c, len * 4, look.goods, R.seed + u0 * 7 + i, look.board), u0 + len / 2, yShelf * V);
    }
    // below it, at eye height: pictures, plates, the clock, a mirror, sconces, a menu board
    const lo = look.picY ?? 4;
    let u = w.u0 + 1;
    let k = 0;
    while (u + 3 <= w.u1) {
      const pick = seq(i++ + 100);
      if (!bare(R, w, u, u + 2, lo, 6)) { u++; continue; }
      if (!menuDone && bare(R, w, u, u + 4, lo, 6)) {
        onWall(R, w, chalkboard(c, 16, 11, R.seed + u), u + 2.5, lo * V + 0.05);
        if (look.shade !== undefined && bare(R, w, u + 5, u + 5, 5, 6)) onWall(R, w, sconce(c, look.shade), u + 5.5, 1.45);
        menuDone = true; u += 7; k++; continue;
      }
      if (!clockDone && k >= 1 && bare(R, w, u, u + 1, 5, 7)) { onWall(R, w, clockProp(c), u + 1, 1.45); clockDone = true; u += 4; k++; continue; }
      if (look.mirror && k === 1 && id !== 'B' && bare(R, w, u, u + 3, lo, 6)) { onWall(R, w, mirrorProp(c, 12, 10), u + 2, 1.0); u += 6; k++; continue; }
      if (look.pictures?.length && pick < 0.45 && bare(R, w, u, u + 3, Math.max(lo, 4), 7)) {
        // a metre wide, three quarters high, its bottom at 1.15 m: cells u..u+3, layers 4..7
        const kind = look.pictures[Math.floor(seq(i++ + 200) * look.pictures.length)];
        const im = picture(paintColors(R.b), kind, 8, 6, R.seed + u * 3 + i);
        const [ax, az] = w.at(u + 2, 0), [bx, bz] = w.at(u + 2, 1);
        const [x0, z0] = R.m(ax, az), [x1, z1] = R.m(bx, bz);
        hang(R.b, im, x0, R.floorY + 1.15, z0, x1 - x0, z1 - z0);
        u += 6; k++; continue;
      }
      if (look.plates?.length && pick < 0.8) {
        const pl = look.plates[Math.floor(seq(i++ + 300) * look.plates.length)];
        onWall(R, w, wallPlate(c, pl[0], pl[1], R.seed + u), u + 0.5, 1.3);
        if (bare(R, w, u + 1, u + 2, lo, 6)) onWall(R, w, wallPlate(c, pl[0], pl[1], R.seed + u + 9), u + 2, 1.05);
        u += 4; k++; continue;
      }
      if (look.shade !== undefined && pick >= 0.8 && bare(R, w, u, u, 6, 7)) { onWall(R, w, sconce(c, look.shade), u + 0.5, 1.5); u += 4; k++; continue; }
      u += 2;
    }
    // the rail up near the ceiling: only along the back
    if (look.rail && id === 'B') for (const [s0, s1] of stretches(R, w, R.top - 2, R.top, 6)) {
      const len = Math.min(s1 - s0 + 1, 20);
      onWall(R, w, hangRail(c, len * 4, look.rail, R.seed + s0), s0 + len / 2, (R.top - 2) * V);
    }
  }
}

/** A rug laid into the floor (repaints floor cells only): border, field and a pattern in the middle. */
export function rug(R: Dine, a0: number, d0: number, a1: number, d1: number, cols: [number, number, number], kind: 'kilim' | 'runner' | 'plain' | 'border'): void {
  const [edge, field, motif] = cols;
  paint(R, a0, -1, d0, a1, -1, d1, (a, _y, d) => {
    const ea = Math.min(a - a0, a1 - a), ed = Math.min(d - d0, d1 - d);
    if (ea === 0 || ed === 0) return edge;
    switch (kind) {
      case 'kilim': return (ea + ed) % 4 === 0 || ((a + d) % 6 === 0 && ea > 1 && ed > 1) ? motif : ea === 1 || ed === 1 ? motif : field;
      case 'runner': return ea === 1 || ed === 1 ? motif : (d % 4 === 0 ? motif : field);
      case 'border': return ea === 1 || ed === 1 ? motif : field;
      default: return field;
    }
  });
}

/** A crown moulding round the top of the walls, in the air row under the ceiling (seen from the floor in first person). */
export function cornice(R: Dine, col: number): void {
  const t = R.top;
  air(R, R.A0, t, R.D1, R.A1, t, R.D1, col);
  air(R, R.A0, t, R.D0, R.A0, t, R.D1, col);
  air(R, R.A1, t, R.D0, R.A1, t, R.D1, col);
}

/**
 * The cook's line along the back wall from a0 to a1 (one cell deep, against the wall): cabinets with a steel top,
 * a hob with pots on it, a sink, the hood above and a rail of utensils; plates on a shelf over it all.
 */
export function kitchenLine(R: Dine, c: DC, a0: number, a1: number, o: { body?: number; top?: number; hob?: boolean; sink?: boolean; hood?: boolean; rail?: boolean; plates?: boolean; d?: number } = {}): void {
  if (a1 - a0 < 2) return;
  const d = o.d ?? R.D1;
  const body = o.body ?? c.steelMid, top = o.top ?? c.steel;
  // cabinets, doors picked out with handles
  air(R, a0, 0, d, a1, 2, d, (a, y) => (y === 1 && a % 2 === 0 ? c.steelDark : body));
  air(R, a0, 3, d, a1, 3, d, top);
  const mid = Math.floor((a0 + a1) / 2);
  const W = walls(R).B;
  // the hob: pots and a pan on it (props on the top)
  if (o.hob !== false) {
    const p = new Prop(12, 7, 4, F16);
    p.box(0, 0, 0, 11, 0, 3, c.black);
    p.box(1, 1, 0, 4, 4, 3, c.steelMid); p.box(1, 5, 0, 4, 5, 3, c.steel); p.box(2, 1, 1, 3, 4, 2, c.steelMid);
    p.box(6, 1, 0, 9, 3, 3, c.copper); p.set(10, 2, 1, c.copper);
    p.box(7, 4, 1, 8, 4, 2, c.copperDark);
    const ha = Math.min(a1 - 1.5, mid + 1.5);
    const [la, ld] = [ha, d + 0.5];
    put(R, p, la, ld, 1.0, 0);
    const [ex, ez] = R.m(la, ld);
    R.b.emitters.push({ kind: 'steam', pos: [ex, R.floorY + 1.4, ez], rate: 0.5 });
  }
  if (o.sink !== false && a1 - a0 >= 6) {
    const sa = a0 + 1;
    box(R, sa, 3, d, sa + 1, 3, d, c.steelDark);
    const p = new Prop(2, 4, 2, F16);
    p.box(0, 0, 1, 0, 3, 1, c.steel); p.box(1, 3, 1, 1, 3, 1, c.steel);
    put(R, p, sa + 1, d + 0.85, 1.0, 0);
  }
  // the hood over the hob
  if (o.hood !== false) {
    const ha = Math.min(a1 - 1, mid + 1);
    air(R, ha - 2, 8, d, ha + 2, 9, d, (_a, y) => (y === 8 ? c.steelDark : c.steel));
    air(R, ha - 1, 10, d, ha + 1, R.top, d, c.steel);
  }
  // a rail of ladles and spoons between the top and the hood, and a plate shelf further along
  if (o.rail !== false && bare(R, W, a0, Math.min(a1, a0 + 3), 5, 7)) onWall(R, W, hangRail(c, Math.min(4, a1 - a0) * 4, 'utensils', R.seed + a0), a0 + Math.min(4, a1 - a0) / 2, 1.2);
  if (o.plates !== false && a1 - a0 >= 8) onWall(R, W, shelfProp(c, 16, ['plates', 'cups', 'jars'], R.seed + 5, c.steelMid), a1 - 2, 1.75);
}

/** Lights for the tables: one pendant over each spot given, and a lamp in the middle of them. */
export function pendants(R: Dine, c: DC, spots: [number, number][], kind: 'cone' | 'globe' | 'paper' | 'lantern' | 'bell' | 'cage', shade: number, bottom = 2.1): void {
  const top = (R.top + 1) * V;
  const drop = Math.max(2, Math.round((top - bottom) / F16) - (kind === 'paper' ? 8 : kind === 'lantern' ? 7 : 4));
  spots.forEach(([a, d], i) => put(R, pendantProp(c, kind, shade, drop, R.seed + i), a, d, bottom, 0));
}

/** A low bench under the front windows (a0..a1 along the front wall's inside), with little pots on it. */
export function windowBench(R: Dine, c: DC, a0: number, a1: number, body: number, top: number): void {
  if (a1 - a0 < 3) return;
  for (let a = a0; a <= a1; a++) for (let y = 0; y <= 2; y++) if (R.get(a, y, R.D0)) return;
  box(R, a0, 0, R.D0, a1, 0, R.D0, body);
  box(R, a0, 1, R.D0, a1, 1, R.D0, top);
  for (let a = a0 + 1; a < a1; a += 3) {
    const p = new Prop(3, 6, 3, F16);
    const pot = [c.potTerra, c.potBlue, c.potWhite][Math.floor(hash3(a, R.seed, 3) * 3)];
    p.box(0, 0, 0, 2, 1, 2, pot);
    p.ellipsoid(1.5, 3.5, 1.5, 1.6, 2.4, 1.6, (x, y, z) => (hash3(x, y, z + a) < 0.15 ? (hash3(a, 1, 1) < 0.5 ? c.chili : c.lemon) : hash3(x, y, z) < 0.5 ? c.leaf : c.leafL));
    put(R, p, a + 0.5, R.D0 + 0.5, 0.5, 2);
  }
  blockCells(R, a0, R.D0, a1, R.D0);
}

/** A big plant standing in a corner cell pair (a, d) .. (a+1, d+1), blocked. */
export function cornerPlant(R: Dine, c: DC, a: number, d: number, kind: 'fig' | 'palm' | 'lemon' | 'monstera' | 'olive', pot: number): void {
  for (let y = 0; y <= 6; y++) for (const [aa, dd] of [[a, d], [a + 1, d], [a, d + 1], [a + 1, d + 1]]) if (R.get(aa, y, dd)) return;
  put(R, bigPlant(c, kind, pot, R.seed + a * 3 + d), a + 1, d + 1, 0, 2);
  blockCells(R, a, d, a + 1, d + 1);
}

// ---------------------------------------------------------------------------------------------- hidden kitchens

/**
 * The hidden kitchen every city keeps (one diorama layout: the counter across x 8..44 at z 21..26 with its top 1 m
 * up, the cook's shelf behind it at z 6..10, stools along z 30, the way in at the front right corner) made a place
 * people linger: a place laid at every stool, lights over the counter, the cook's pots, board and bowls out on the
 * shelf, and two low tables with their cushions in the free corner by the open side, laid and lit.
 */
export function hiddenKitchenDress(o: {
  pal: Palette; g: { set(x: number, y: number, z: number, v: number): void; get(x: number, y: number, z: number): number };
  place: (p: Prop, cx: number, y: number, cz: number, turns?: number) => void;
  lamp: (x: number, y: number, z: number, col: [number, number, number], radiusM: number, intensity?: number) => void;
  G: number; style: 'jp' | 'it' | 'tr'; wood: number; top: number; cushion: [number, number]; seed: number;
}): void {
  const c = dineColors(o.pal);
  const { g, G, place } = o;
  const ts: TableStyle = o.style;
  // the counter: a place at every stool (the guest's side is +z)
  for (let i = 0; i < 6; i++) place(tableTop(c, ts, 6, 6, ['n'], o.seed + i), (10.5 + i * 5.5) * V, 1.0, 25.4 * V, 0);
  // lights over it
  const kind = o.style === 'jp' ? 'paper' : o.style === 'tr' ? 'lantern' : 'bell';
  const shade = o.style === 'jp' ? c.paperL : c.shadeA;
  for (const x of [13, 26, 39]) place(pendantProp(c, kind, shade, 8, o.seed + x), x * V, 2.4, 27.5 * V, 0);
  // the cook's shelf (top 1.25 m up): the hob and its pots, a board with a knife, a stack of bowls, jars
  const hob = new Prop(12, 7, 4, F16);
  hob.box(0, 0, 0, 11, 0, 3, c.black); hob.box(1, 1, 0, 4, 4, 3, c.steelMid); hob.box(1, 5, 0, 4, 5, 3, c.steel);
  hob.box(6, 1, 0, 9, 3, 3, c.copper); hob.box(7, 4, 1, 8, 4, 2, c.copperDark);
  place(hob, 16 * V, 1.25, 8 * V, 0);
  const board = new Prop(10, 2, 6, F16);
  board.box(0, 0, 0, 9, 0, 5, c.woodL); board.box(1, 1, 2, 6, 1, 2, c.steel); board.box(7, 1, 2, 8, 1, 2, c.black);
  board.box(2, 1, 4, 4, 1, 4, o.style === 'jp' ? c.edamame : c.food3);
  place(board, 26 * V, 1.25, 8 * V, 0);
  place(counterPiece(c, 'jars', o.seed), 35 * V, 1.25, 7.5 * V, 0);
  const bowls = new Prop(6, 5, 4, F16);
  for (let x = 0; x < 6; x += 3) bowls.box(x, 0, 0, x + 2, 1 + (x % 2) * 2, 3, (_x, y) => (y % 2 ? c.plateRim : c.plate));
  place(bowls, 40 * V, 1.25, 8 * V, 0);
  // two low tables in the corner by the open side, cushions or stools round them
  for (const tx of [6, 14]) {
    const tz = 35;
    // (three voxels tall, so nobody steps up onto it; pouffes two tall either side)
    for (let z = tz; z <= tz + 2; z++) for (let x = tx; x <= tx + 3; x++) for (let y = 0; y < 3; y++) g.set(x, G + y, z, y < 2 && (x > tx && x < tx + 3) && z === tz + 1 ? 0 : y === 2 && !(z === tz || z === tz + 2 || x === tx || x === tx + 3) ? o.top : o.wood);
    for (const z of [tz - 2, tz + 4]) for (let x = tx; x <= tx + 3; x += 2) { const px = x + (z > tz ? 1 : 0); g.set(px, G, z, o.wood); g.set(px, G + 1, z, z > tz ? o.cushion[0] : o.cushion[1]); }
    place(tableTop(c, ts, 16, 12, ['n', 's'], o.seed + tx), (tx + 2) * V, 0.75, (tz + 1.5) * V, 0);
    place(pendantProp(c, kind, shade, 12, o.seed + tx), (tx + 2) * V, 2.0, (tz + 1.5) * V, 0);
    o.lamp((tx + 2) * V, 1.6, (tz + 1.5) * V, [1.0, 0.72, 0.42], 4, 0.7);
  }
}
