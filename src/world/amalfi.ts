import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, V, VX0, VZ0, SX, SZ, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, BuildResult, Anchors, PlacedProp, Window, WARM, WHITEWARM, StallAnchor } from './tokyo';
import { Prop, rotateProp, bench, cafeTable, scooter, stool, bush, grassTuft } from './props';
import { buildFood } from './food';
import { SWAY } from './sway';
import { amalfiPlan, K, col, layerOf, hillY, isPath, LotPlan, PIAZZA_Y, DUOMO_Y, ROAD_X0, ROAD_X1, TUNNEL_Z, type Plan } from './amalfiPlan';

/**
 * Amalfi: a town poured down a ravine to the sea. Houses stand on terraces cut into both flanks of the valley,
 * stairways and lanes climb between them, the cathedral looks down its great flight of steps onto Piazza Duomo,
 * and the shore road runs along the beach and the harbour before it tunnels through the headland.
 * The ground plan (heights, paths, lots) comes from world/amalfiPlan.ts; this fills it with voxels.
 */

function amalfiColors(b: Builder) {
  const a = (hex: number, vary = 0.06, o: { emit?: number; night?: boolean; leaf?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
  const F = { leaf: true };
  return {
    // stone of the coast: pale limestone cliffs, tufa walls, grey basalt paving
    lime: a(0xc9bda6, 0.1), limeDark: a(0xa89c86, 0.1), limeLight: a(0xddd3bf, 0.08), cliffStreak: a(0x8f8676, 0.1),
    tufa: a(0xb9a07e, 0.08), tufaDark: a(0x9a8466, 0.08), mortar: a(0x8a8070, 0.05), dryStone: a(0xa8a08e, 0.12), dryStoneB: a(0x8e8676, 0.12),
    basalt: a(0x6f6c68, 0.06), basaltB: a(0x5f5c59, 0.06), basaltLight: a(0x8d8a84, 0.05), slab: a(0xa9a49a, 0.05), slabB: a(0x99948a, 0.05),
    cobble: a(0x88837b, 0.1), cobbleB: a(0x76716a, 0.1), stepStone: a(0xb5aea2, 0.05), stepEdge: a(0xe6e0d4, 0.03), cotto: a(0xb9714f, 0.07), cottoB: a(0xa5603f, 0.07),
    asphalt: a(0x4d4e52, 0.05), roadLine: a(0xe9e4d6, 0.03), kerb: a(0xcfc8bb, 0.04), quay: a(0x9b958a, 0.06), quayTop: a(0xb3ada2, 0.05), wet: a(0x4c4a44, 0.06), algae: a(0x445a36, 0.12),
    pebble: a(0x7d7a74, 0.14), pebbleB: a(0x96928b, 0.14), pebbleDark: a(0x5f5c57, 0.12), sandBed: a(0x9f9479, 0.12), seaRock: a(0x56544f, 0.12),
    soil: a(0x6a5238, 0.1), grass: a(0x7d9a46, 0.14), grassDry: a(0xa4a05a, 0.14), herb: a(0x5d7f3a, 0.14),
    // whitewash and the pastel plaster of the houses
    white: a(0xf2eee6, 0.03), whiteWarm: a(0xefe6d6, 0.03), cream: a(0xf0e2c2, 0.04), yellow: a(0xf0d68a, 0.04), lemonWall: a(0xf2dc6a, 0.04),
    ochre: a(0xe0ae66, 0.04), peach: a(0xefc4a2, 0.04), pink: a(0xe8b2a6, 0.04), rose: a(0xd9917f, 0.04), terracotta: a(0xc47a58, 0.05), sky: a(0xbfd2d8, 0.04),
    sage: a(0xc9d1b4, 0.04), plasterOld: a(0xd9cbb0, 0.06), plinth: a(0x9e968a, 0.05),
    shutterGreen: a(0x3d6b4b, 0.04), shutterDeep: a(0x2e5541, 0.04), shutterBrown: a(0x6e4a32, 0.04), shutterBlue: a(0x4f6f86, 0.04),
    glass: a(0x3d4c58, 0.04), glassLit: a(0xffcf8a, 0.04, { emit: 0.7, night: true }), shopLit: a(0xffd9a0, 0.04, { emit: 0.55 }),
    door: a(0x5a3a26, 0.06), doorGreen: a(0x31503c, 0.05), sill: a(0xe2dccf, 0.03), iron: a(0x2b2a2a, 0.04),
    roofWhite: a(0xf4f1ea, 0.03), roofTile: a(0xb5603f, 0.07), roofTileB: a(0x9c4f33, 0.07), terraceTile: a(0xc58a64, 0.06),
    // the cathedral: striped stone, gold mosaic, green and yellow majolica
    marble: a(0xf1ede4, 0.03), marbleGrey: a(0xd8d3c8, 0.04), stripeDark: a(0x3a3632, 0.04), stripeTufa: a(0xc8a36a, 0.05),
    mosaicGold: a(0xe0b54a, 0.08, { emit: 0.22 }), mosaicBlue: a(0x2f5d9a, 0.06), mosaicRed: a(0xa83a2c, 0.06), bronzeDoor: a(0x6b5a3a, 0.06),
    majolicaGreen: a(0x2f8a5a, 0.06), majolicaYellow: a(0xe9c23a, 0.06), majolicaBlue: a(0x2f63a8, 0.06), majolicaWhite: a(0xf3efe2, 0.03),
    // plants
    leaf: a(0x3f6e2e, 0.14, F), leafDark: a(0x2c5422, 0.14, F), leafLight: a(0x5e8f3a, 0.14, F), lemon: a(0xf2d43a, 0.06, F), lemonDeep: a(0xe8b82a, 0.06, F),
    bougain: a(0xd2368c, 0.1, F), bougainB: a(0xe05aa6, 0.1, F), geranium: a(0xd83a3a, 0.08, F), olive: a(0x7d8a5a, 0.12, F), oliveB: a(0x6a7a4c, 0.12, F),
    cypress: a(0x2c4a2e, 0.1, F), palm: a(0x4f7a32, 0.12, F), palmB: a(0x6a9040, 0.12, F), trunk: a(0x6a5440, 0.1), trunkPalm: a(0x8a7458, 0.1),
    pole: a(0x6e5a44, 0.08), net: a(0x2f3a2a, 0.06),
    // the shore
    umbrellaA: a(0xe8743a, 0.03), umbrellaB: a(0xf4efe4, 0.03), umbrellaC: a(0x2f6fae, 0.03), umbrellaD: a(0xe6c23a, 0.03), umbrellaE: a(0x3f9a6a, 0.03),
    bed: a(0xf1ede2, 0.03), bedFrame: a(0x8a6a4a, 0.05), hullWhite: a(0xf2efe8, 0.03), hullBlue: a(0x2f5d9a, 0.04), hullRed: a(0xb83a2c, 0.04), hullGreen: a(0x2f7a5a, 0.04),
    hullYellow: a(0xe9c23a, 0.04), deckWood: a(0xb08458, 0.06), keel: a(0x4a3a2e, 0.05), ferry: a(0xf4f4f0, 0.02), ferryBlue: a(0x23406a, 0.03), lighthouse: a(0xc8372d, 0.03),
    lampGlow: a(0xffd89a, 0.03, { emit: 0.9, night: true }), lampGlowAlways: a(0xffd89a, 0.03, { emit: 0.85 }),
  };
}

type AC = ReturnType<typeof amalfiColors>;

// ------------------------------------------------------------------------------------------- props

function lemonTree(c: AC, seed: number, big = false): Prop {
  const r = rng(seed);
  const s = big ? 1.4 : 1;
  const p = new Prop(Math.round(13 * s), Math.round(18 * s), Math.round(13 * s));
  const cx = p.sx / 2, cz = p.sz / 2;
  p.box(Math.floor(cx), 0, Math.floor(cz), Math.floor(cx), Math.round(7 * s), Math.floor(cz), c.trunk);
  p.ellipsoid(cx, 11 * s, cz, 5.6 * s, 5.4 * s, 5.6 * s, (x, y, z) => {
    const n = hash3(x + seed, y, z);
    return n < 0.09 ? c.lemon : n < 0.12 ? c.lemonDeep : n < 0.5 ? c.leaf : n < 0.8 ? c.leafDark : c.leafLight;
  });
  for (let i = 0; i < 30; i++) if (r() < 0.5) p.set(Math.floor(r() * p.sx), Math.floor(6 * s + r() * 9 * s), Math.floor(r() * p.sz), 0);
  p.sway(SWAY.bush, [cx, 7 * s, cz]);
  return p;
}

function potLemon(c: AC, seed: number): Prop {
  const p = new Prop(9, 14, 9);
  p.box(2, 0, 2, 6, 3, 6, c.terracotta);
  p.box(1, 3, 1, 7, 3, 7, c.terracotta);
  p.box(4, 4, 4, 4, 7, 4, c.trunk);
  p.ellipsoid(4.5, 10, 4.5, 4, 3.6, 4, (x, y, z) => { const n = hash3(x + seed, y, z); return n < 0.1 ? c.lemon : n < 0.55 ? c.leaf : c.leafDark; });
  p.sway(SWAY.shrub, [4.5, 4, 4.5], [0, 0, 0], (_x, y) => y >= 4);
  return p;
}

function geraniumPot(c: AC, seed: number): Prop {
  const p = new Prop(5, 6, 3);
  p.box(0, 0, 0, 4, 1, 2, c.terracotta);
  for (let x = 0; x < 5; x++) for (let z = 0; z < 3; z++) for (let y = 2; y < 5; y++) {
    const n = hash3(x + seed, y, z);
    if (n < 0.75 || y === 2) p.set(x, y, z, n < 0.3 ? c.geranium : c.leaf);
  }
  p.sway(SWAY.flowers, [2.5, 2, 1.5], [0, 0, 0], (_x, y) => y >= 2);
  return p;
}

function palmTree(c: AC, seed: number): Prop {
  const r = rng(seed);
  const p = new Prop(21, 44, 21);
  let x = 10, z = 10;
  for (let y = 0; y < 34; y++) {
    if (y > 8 && r() < 0.18) x += r() < 0.5 ? 1 : -1;
    p.box(x, y, z, x + 1, y, z + 1, (y % 3) ? c.trunkPalm : c.trunk);
  }
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + r() * 0.3;
    for (let s = 0; s < 10; s++) {
      const fx = x + 1 + Math.cos(a) * s, fz = z + 1 + Math.sin(a) * s, fy = 35 + s * 0.6 - (s * s) * 0.09;
      p.set(Math.round(fx), Math.round(fy), Math.round(fz), s % 2 ? c.palm : c.palmB);
      p.set(Math.round(fx + Math.sin(a)), Math.round(fy - 1), Math.round(fz - Math.cos(a)), c.palmB);
    }
  }
  p.sway(SWAY.tree, [x + 1, 30, z + 1], [0, 0, 0], (_x, y) => y >= 30);
  return p;
}

function oliveTree(c: AC, seed: number): Prop {
  const r = rng(seed);
  const p = new Prop(17, 18, 17);
  p.box(8, 0, 8, 9, 5, 9, c.trunk);
  p.box(7, 5, 8, 7, 7, 8, c.trunk); p.box(10, 5, 9, 10, 8, 9, c.trunk);
  for (let i = 0; i < 4; i++) {
    const cx = 5 + r() * 7, cz = 5 + r() * 7, cy = 10 + r() * 4;
    p.ellipsoid(cx, cy, cz, 4 + r() * 2, 2.6, 4 + r() * 2, (xx, y, zz) => (hash3(xx + seed, y, zz) < 0.5 ? c.olive : c.oliveB));
  }
  p.sway(SWAY.bush, [8.5, 6, 8.5], [0, 0, 0], (_x, y) => y >= 6);
  return p;
}

function umbrella(c: AC, seed: number): Prop {
  const p = new Prop(17, 18, 17);
  const cols = [[c.umbrellaA, c.umbrellaB], [c.umbrellaC, c.umbrellaB], [c.umbrellaD, c.umbrellaB], [c.umbrellaE, c.umbrellaB], [c.umbrellaA, c.umbrellaD]][seed % 5];
  p.box(8, 0, 8, 8, 15, 8, c.bedFrame);
  for (let z = 0; z < 17; z++) for (let x = 0; x < 17; x++) {
    const dx = x - 8, dz = z - 8, d = Math.hypot(dx, dz);
    if (d > 8.4) continue;
    const y = 16 - Math.floor(d / 3);
    const seg = Math.floor(((Math.atan2(dz, dx) + Math.PI) / (Math.PI * 2)) * 8);
    p.set(x, y, z, cols[seg % 2]);
  }
  p.sway(SWAY.flag, [8, 0, 8], [0, 1, 0], (_x, y) => y >= 13);
  return p;
}

function sunbed(c: AC): Prop {
  const p = new Prop(6, 4, 15);
  p.box(0, 0, 0, 0, 1, 0, c.bedFrame); p.box(5, 0, 0, 5, 1, 0, c.bedFrame); p.box(0, 0, 14, 0, 1, 14, c.bedFrame); p.box(5, 0, 14, 5, 1, 14, c.bedFrame);
  p.box(0, 2, 0, 5, 2, 14, c.bed);
  p.box(0, 3, 11, 5, 3, 14, c.bed);
  return p;
}

/** A gozzo: the clinker-built fishing boat of the coast, white with a coloured band. */
function gozzo(c: AC, seed: number, len = 36): Prop {
  const band = [c.hullBlue, c.hullRed, c.hullGreen, c.hullYellow][seed % 4];
  const w = 11;
  const p = new Prop(len, 9, w);
  for (let x = 0; x < len; x++) {
    const t = x / (len - 1);
    const half = (w / 2 - 0.5) * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.04)) ** 0.6;
    for (let z = 0; z < w; z++) {
      const dz = Math.abs(z - (w - 1) / 2);
      if (dz > half + 0.3) continue;
      const rim = dz > half - 1;
      const yb = Math.round((dz / Math.max(1, half)) * 2);
      for (let y = yb; y <= 5 + (t > 0.92 || t < 0.06 ? 2 : 0); y++) {
        if (!rim && y > 1) { if (y === 2) p.set(x, y, z, c.deckWood); continue; }
        p.set(x, y, z, y >= 4 ? band : y === 0 ? c.keel : c.hullWhite);
      }
    }
  }
  // thwarts and a little mast stub at the bow
  for (const x of [Math.floor(len * 0.3), Math.floor(len * 0.6)]) p.box(x, 3, 2, x, 3, w - 3, c.deckWood);
  p.box(len - 4, 6, (w - 1) / 2, len - 4, 8, (w - 1) / 2, c.deckWood);
  return p;
}

function ferry(c: AC): Prop {
  const p = new Prop(120, 40, 36, 0.25);
  for (let x = 0; x < 120; x++) {
    const t = x / 119;
    const half = 17 * Math.min(1, Math.sin(Math.PI * Math.min(1, t * 1.05 + 0.02)) ** 0.35);
    for (let z = 0; z < 36; z++) {
      if (Math.abs(z - 17.5) > half) continue;
      for (let y = 0; y < 10; y++) p.set(x, y, z, y < 3 ? c.ferryBlue : y === 9 ? c.ferryBlue : c.ferry);
    }
  }
  p.box(16, 10, 6, 92, 16, 29, c.ferry);
  p.box(16, 13, 6, 92, 14, 29, (x) => (x % 4 === 0 ? c.ferry : c.glass));
  p.box(30, 17, 10, 70, 22, 25, c.ferry);
  p.box(30, 19, 10, 70, 20, 25, (x) => (x % 3 === 0 ? c.ferry : c.glass));
  p.box(48, 23, 15, 54, 30, 20, c.ferryBlue);
  return p;
}

/** A majolica lemon the size of a fist on a little tiled plinth: one of the three that open the grotta. */
function majolicaLemon(c: AC): Prop {
  const p = new Prop(5, 7, 5);
  // the plinth: blue and white tiles
  p.box(0, 0, 0, 4, 1, 4, (x, _y, z) => ((x + z) % 2 ? c.majolicaBlue : c.majolicaWhite));
  p.box(1, 2, 1, 3, 2, 3, c.majolicaYellow);
  // the lemon, glazed, a pointed tip and two leaves in blue-green
  p.box(1, 3, 1, 3, 5, 3, c.lemon);
  p.box(2, 3, 0, 2, 5, 4, c.lemon); p.box(0, 4, 2, 4, 4, 2, c.lemon);
  p.set(2, 6, 2, c.lemon);
  p.set(1, 6, 2, c.majolicaGreen); p.set(0, 6, 1, c.majolicaGreen); p.set(3, 6, 3, c.majolicaGreen);
  return p;
}

/** The grotta's door, shut: old chestnut planks with iron studs in a rough tufa surround. */
function grottaDoor(c: AC, open: boolean): Prop {
  const p = new Prop(14, 22, 2);
  // the rock round it, roughly arched
  p.box(0, 0, 0, 13, 21, 1, (x, y) => {
    const dx = Math.abs(x - 6.5), arch = y > 15 ? Math.sqrt(Math.max(0, 25 - (y - 15) ** 2)) : 5;
    return dx <= arch ? 0 : hash3(x, y, 77) < 0.5 ? c.tufa : c.tufaDark;
  });
  if (!open) {
    for (let y = 0; y < 20; y++) for (let x = 2; x < 12; x++) {
      const dx = Math.abs(x - 6.5), arch = y > 15 ? Math.sqrt(Math.max(0, 25 - (y - 15) ** 2)) : 5;
      if (dx > arch) continue;
      p.set(x, y, 1, x % 3 === 0 ? c.iron : c.door);
      if ((y === 4 || y === 12) || (x === 4 && y === 9)) p.set(x, y, 0, c.iron);
    }
  } else {
    // open: the leaf swung in, warm light and the smell of garlic from inside
    for (let y = 0; y < 20; y++) for (let x = 2; x < 12; x++) {
      const dx = Math.abs(x - 6.5), arch = y > 15 ? Math.sqrt(Math.max(0, 25 - (y - 15) ** 2)) : 5;
      if (dx > arch) continue;
      p.set(x, y, 1, x < 4 ? c.door : y < 2 ? c.cotto : c.glassLit);
    }
  }
  // a majolica tile of a lemon over the door
  p.box(5, 20, 0, 8, 21, 0, c.majolicaWhite); p.box(6, 20, 0, 7, 21, 0, c.lemon);
  return p;
}

function wallLantern(c: AC): Prop {
  const p = new Prop(3, 6, 4);
  p.box(1, 3, 0, 1, 3, 2, c.iron);
  p.box(0, 0, 1, 2, 2, 3, c.lampGlow);
  p.box(0, 3, 1, 2, 3, 3, c.iron);
  p.box(1, 4, 2, 1, 4, 2, c.iron);
  return p;
}

function lampPost(c: AC): Prop {
  const p = new Prop(5, 30, 5);
  p.box(1, 0, 1, 3, 1, 3, c.iron);
  p.box(2, 2, 2, 2, 24, 2, c.iron);
  p.box(1, 25, 1, 3, 28, 3, c.lampGlow);
  p.box(0, 29, 0, 4, 29, 4, c.iron);
  p.box(2, 24, 2, 2, 24, 2, c.iron);
  return p;
}

/** Bollard of the harbour, an iron mushroom. */
function bitt(c: AC): Prop {
  const p = new Prop(3, 4, 3);
  p.box(1, 0, 1, 1, 2, 1, c.iron);
  p.box(0, 3, 0, 2, 3, 2, c.iron);
  return p;
}

function crateLemons(c: AC, seed: number): Prop {
  const p = new Prop(6, 4, 4);
  p.box(0, 0, 0, 5, 2, 3, c.deckWood);
  for (let x = 0; x < 6; x++) for (let z = 0; z < 4; z++) p.set(x, 3, z, hash3(x, seed, z) < 0.55 ? c.lemon : c.lemonDeep);
  for (let x = 1; x < 5; x++) p.set(x, 1, 0, c.pole);
  return p;
}

function ceramicRack(c: AC, seed: number): Prop {
  const p = new Prop(9, 14, 3);
  p.box(0, 0, 0, 0, 13, 0, c.pole); p.box(8, 0, 0, 8, 13, 0, c.pole);
  const cols = [c.majolicaBlue, c.majolicaYellow, c.majolicaGreen, c.lemon, c.majolicaWhite];
  for (const y of [2, 7, 12]) {
    p.box(0, y - 1, 0, 8, y - 1, 2, c.pole);
    for (let x = 1; x < 8; x += 3) {
      const col = cols[Math.floor(hash3(x, y, seed) * cols.length)];
      p.box(x, y, 1, x + 1, y + 1, 1, col);
      p.set(x, y, 2, c.majolicaWhite);
    }
  }
  return p;
}

/** Stall carts of the food vendors. */
function cart(c: AC, kind: 'pastry' | 'fry' | 'pizza' | 'gelato' | 'lemon'): Prop {
  const p = new Prop(16, 20, 9);
  const body = { pastry: c.majolicaBlue, fry: c.hullRed, pizza: c.hullGreen, gelato: c.sky, lemon: c.lemonWall }[kind];
  // wheels and body
  p.box(1, 0, 0, 3, 2, 0, c.iron); p.box(12, 0, 0, 14, 2, 0, c.iron); p.box(1, 0, 8, 3, 2, 8, c.iron); p.box(12, 0, 8, 14, 2, 8, c.iron);
  p.box(0, 2, 1, 15, 7, 7, body);
  p.box(0, 8, 0, 15, 8, 8, c.marble);
  p.box(0, 5, 0, 15, 5, 0, c.marble);
  // posts and an awning striped in the cart's colour
  p.box(0, 9, 0, 0, 16, 0, c.iron); p.box(15, 9, 0, 15, 16, 0, c.iron); p.box(0, 9, 8, 0, 16, 8, c.iron); p.box(15, 9, 8, 15, 16, 8, c.iron);
  for (let x = 0; x < 16; x++) for (let z = -1; z <= 9; z++) p.set(x, 17 + (z < 2 ? 0 : z > 6 ? 0 : 1), Math.max(0, Math.min(8, z)), (x >> 1) & 1 ? body : c.white);
  if (kind === 'gelato') for (let x = 2; x < 14; x += 2) p.box(x, 9, 2, x + 1, 9, 5, [c.lemon, c.leafLight, c.pink, c.cream, c.door][(x / 2) % 5]);
  if (kind === 'lemon') for (let x = 1; x < 15; x++) for (let z = 1; z < 8; z++) if (hash3(x, 9, z) < 0.6) p.set(x, 9, z, c.lemon);
  if (kind === 'fry') { p.box(10, 9, 2, 14, 11, 6, c.iron); p.box(11, 11, 3, 13, 11, 5, c.ochre); }
  if (kind === 'pizza') { p.box(9, 9, 1, 15, 15, 7, c.tufa); p.box(11, 9, 0, 13, 12, 0, c.glassLit); }
  if (kind === 'pastry') for (let x = 2; x < 14; x += 3) p.box(x, 9, 2, x + 1, 10, 4, c.ochre);
  return p;
}

// ------------------------------------------------------------------------------------------- build

export function buildAmalfi(win?: Window): BuildResult {
  const b = new Builder(win);
  const g = b.grid;
  const c = amalfiColors(b);
  const plan = amalfiPlan();
  const [wx0, wz0, wx1, wz1] = win ?? [VX0, VZ0, VX0 + SX, VZ0 + SZ];
  const inWin = (x: number, z: number) => x >= wx0 && x < wx1 && z >= wz0 && z < wz1;

  terrain(b, c, plan, wx0, wz0, wx1, wz1);
  covered(b, c, plan);
  for (const lt of plan.lots) house(b, c, plan, lt);
  duomo(b, c);
  cloister(b, c);
  gate(b, c);
  carvePassages(b, c, plan);
  piazza(b, c);
  shore(b, c);
  gardens(b, c, plan, inWin);
  lanes(b, c, plan);
  const stalls = foodStalls(b, c, plan);
  // the three majolica lemons, on the ground where the plan says it is
  const groundY = (x: number, z: number) => (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
  const lemons = LEMON_SPOTS.map(([x, z]) => [x, groundY(x, z), z] as [number, number, number]);
  for (const [x, y, z] of lemons) { b.place(majolicaLemon(c), x, y, z); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  grottaDoorway(b, c);

  const P = (x: number, z: number) => [x, z] as [number, number];
  const anchors: Anchors = {
    spawn: [15, 0, 9],
    stalls,
    // the hidden kitchen's door is in a lane of the western flank, behind the cathedral
    hiddenDoor: HIDDEN,
    interiorExit: [0, 0], interiorSpawn: [0, 0, 0], chef: [0, 0, 0], counterStand: [0, 0],
    // three majolica lemons tucked away around town open it
    manekis: lemons,
    graph: { nodes: plan.nodes.map(([x, z]) => P(x, z)), edges: plan.edges.map(([i, j]) => [i, j] as [number, number]) },
    idlers: [
      { id: 'nonna', pos: [6, 0, 22] },
      { id: 'pescatore', pos: [41, 0, 58] },
      { id: 'limonaio', pos: [-52, 0, -8] },
      { id: 'painter', pos: [-22.5, 0, 22] },
      { id: 'lifeguard', pos: [44, 0, 20] },
      { id: 'priest', pos: [-22, 0, 7] },
    ],
    benches: b.benches,
    stools: b.stools,
    cats: [[1.5, 0, -4], [-21, 0, 3.5], [38, 0, 44], [-60, 0, -2], [17, 0, 28.5]],
    emitters: b.emitters,
    vending: [],
    blockers: b.blockers,
    koiArea: [9.2, 11.2, 10.8, 12.8],
    rooms: [],
    hotels: [],
    darumas: [],
    secret: null,
    occluders: b.occluders,
    wires: b.wires,
  };
  for (const id of anchors.idlers) id.pos[1] = 0;
  const interior = grotta(b, c, anchors);
  return {
    grid: g, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells,
    // the standing layer is looked for just above the path: under an arch or a vault the roof is no floor
    navTop: (x, z) => Math.min(g.sy - 8, plan.walk[col(x, z)] + 3),
    groundAt: (x, z) => {
      const ci = col(x, z);
      const kd = plan.kind[ci];
      // under a house the hill is what it stands on; the house itself can be cut away
      return kd === K.Sea ? G : plan.walk[ci];
    },
  };
}

/** The grotta's door: in the cliff at the back of the cloister, behind the cathedral (labels relative to the ground). */
const DOOR_X = -39, DOOR_Z = 43;
export const HIDDEN = { stand: [DOOR_X, DOOR_Z - 0.75] as [number, number], label: [DOOR_X, 2.0, DOOR_Z - 0.2] as [number, number, number], reveal: [DOOR_X, DUOMO_Y, DOOR_Z - 1.5] as [number, number, number] };
/** By the lemon seller in Piazza dei Dogi, on the harbour quay, and in the corner of the cathedral's atrium. */
const LEMON_SPOTS: [number, number][] = [[-66.5, -14.2], [44.5, 63], [-23.6, 25.3]];

/** The doorway in the cloister's back wall: the plaster gives way to rock round an old door (both states, tagged). */
function grottaDoorway(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(DUOMO_Y);
  const x0 = Math.round(DOOR_X / V) - 7, z0 = Math.round(DOOR_Z / V);
  if (g.touches(x0 - 6, z0 - 2, x0 + 20, z0 + 4)) {
    // bare rock round the door where the plaster has fallen away
    g.box(x0 - 3, Y, z0, x0 + 16, Y + 17, z0 + 1, (x, y, z) => {
      const dx = Math.abs(x - (x0 + 6.5)), r = 9 + hash3(x >> 1, y >> 1, 5) * 3;
      return dx + Math.max(0, y - Y - 10) * 0.6 < r ? (hash3(x, y, z) < 0.5 ? c.tufa : c.tufaDark) : g.get(x, y, z);
    });
    g.box(x0, Y, z0, x0 + 13, Y + 21, z0 + 1, 0);
  }
  b.place(grottaDoor(c, false), DOOR_X, DUOMO_Y, DOOR_Z + 0.125, 0, 'door-closed');
  b.place(grottaDoor(c, true), DOOR_X, DUOMO_Y, DOOR_Z + 0.125, 0, 'door-open');
  b.place(wallLantern(c), DOOR_X - 1.3, DUOMO_Y + 2.3, DOOR_Z - 0.1, 2, 'door-open');
  b.block(DOOR_X - 0.9, DOOR_Z - 0.05, DOOR_X + 0.9, DOOR_Z + 0.5);
}

/** Material of a stone wall course (vertical faces of terraces, parapets, quays). */
function masonry(c: AC, x: number, y: number, z: number, white: boolean): number {
  if (white) return hash3(x >> 1, y >> 2, z >> 1) < 0.06 ? c.plasterOld : c.whiteWarm;
  const course = y >> 1, off = course & 1 ? 1 : 0;
  const bx = (x + off * 2) / 3 | 0, bz = (z + off * 2) / 3 | 0;
  if (((x + off * 2) % 3 === 0 || (z + off * 2) % 3 === 0) && (y & 1) === 0) return c.mortar;
  const n = hash3(bx, course, bz);
  return n < 0.4 ? c.dryStone : n < 0.75 ? c.dryStoneB : n < 0.9 ? c.tufa : c.limeDark;
}

function terrain(b: Builder, c: AC, plan: Plan, wx0: number, wz0: number, wx1: number, wz1: number): void {
  const g = b.grid;
  // whole bricks under the lowest ground of each 8 x 8 column are bedrock
  for (let bz = wz0; bz < wz1; bz += 8)
    for (let bx = wx0; bx < wx1; bx += 8) {
      let lo = 255;
      for (let z = bz; z < bz + 8; z++) for (let x = bx; x < bx + 8; x++) lo = Math.min(lo, plan.walk[col(x, z)]);
      const full = (lo - 4) & ~7;
      if (full > 0) g.box(bx, 0, bz, bx + 7, full - 1, bz + 7, c.limeDark);
    }
  for (let z = wz0; z < wz1; z++)
    for (let x = wx0; x < wx1; x++) {
      const ci = col(x, z), w = plan.walk[ci], kd = plan.kind[ci];
      const y0 = Math.max(0, ((w - 4) & ~7) - 8);
      const mx = x * V, mz = z * V;
      // natural cliff (the headland and the sea cliffs) or a built wall in town?
      const wild = kd === K.Rock && (mz < -44 || w > layerOf(29));
      const white = !wild && (hash3(x >> 4, 3, z >> 4) < 0.45) && w < layerOf(26);
      g.box(x, y0, z, x, w - 1, z, (xx, y, zz) => {
        const d = w - 1 - y;
        switch (kd) {
          case K.Sea: return d === 0 ? (hash3(xx, y, zz) < 0.5 ? c.sandBed : c.seaRock) : c.seaRock;
          case K.Shingle: case K.Sand: return d < 2 ? [c.pebble, c.pebbleB, c.pebbleDark][Math.floor(hash3(xx, y, zz) * 3)] : c.pebbleDark;
          case K.Quay: case K.Pier:
            if (d === 0) return (xx + zz) % 6 === 0 ? c.quay : c.quayTop;
            return y < G - 1 ? (y < G - 3 ? c.algae : c.wet) : masonry(c, xx, y, zz, false);
          case K.Road: case K.Tunnel:
            if (d === 0) {
              const zl = Math.abs(mz % 6);
              return Math.abs(mx - (ROAD_X0 + ROAD_X1) / 2 + 1) < 0.13 && zl < 3 ? c.roadLine : c.asphalt;
            }
            return masonry(c, xx, y, zz, false);
          case K.Walk: return d === 0 ? (hash3(xx >> 1, 1, zz >> 1) < 0.5 ? c.slab : c.slabB) : masonry(c, xx, y, zz, true);
          case K.Piazza: case K.Church:
            if (d === 0) return (xx % 8 === 0 || zz % 8 === 0) ? c.basaltLight : hash3(xx >> 2, 2, zz >> 2) < 0.5 ? c.basalt : c.basaltB;
            return masonry(c, xx, y, zz, true);
          case K.Steps: return d === 0 ? c.stepStone : d === 1 ? c.stepEdge : c.marbleGrey;
          case K.Street: case K.Covered:
            if (d === 0) return hash3(xx >> 1, 4, zz >> 1) < 0.15 ? c.cobbleB : (xx + zz * 3) % 5 === 0 ? c.cobbleB : c.cobble;
            return masonry(c, xx, y, zz, true);
          case K.Stair: return d === 0 ? (hash3(xx, 5, zz) < 0.2 ? c.cottoB : c.stepStone) : d === 1 ? c.stepEdge : masonry(c, xx, y, zz, true);
          case K.Lane: return d === 0 ? (hash3(xx >> 1, 6, zz >> 1) < 0.5 ? c.cobble : c.cobbleB) : masonry(c, xx, y, zz, white);
          case K.Lot: return masonry(c, xx, y, zz, false);
          default: {
            if (wild) { const n = hash3(xx, y >> 1, zz); return d === 0 ? (n < 0.4 ? c.grassDry : n < 0.7 ? c.herb : c.lime) : n < 0.15 ? c.cliffStreak : n < 0.6 ? c.lime : c.limeLight; }
            if (d === 0) { const n = hash3(xx, 9, zz); return n < 0.55 ? c.grass : n < 0.8 ? c.herb : c.soil; }
            if (d === 1) return c.soil;
            return masonry(c, xx, y, zz, white);
          }
        }
      });
      // a parapet along every path where the ground falls away beside it
      if (isPath(kd) && kd !== K.Sand && kd !== K.Covered && kd !== K.Tunnel && kd !== K.Quay && kd !== K.Pier) {
        let drop = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (nx < VX0 || nz < VZ0 || nx >= VX0 + SX || nz >= VZ0 + SZ) continue;
          const nc = col(nx, nz), nk = plan.kind[nc];
          if (isPath(nk) || nk === K.Lot || nk === K.Church) continue;
          if (plan.walk[nc] < w - 3) drop = true;
        }
        if (drop) {
          g.box(x, w, z, x, w + 3, z, (xx, y, zz) => (y === w + 3 ? c.stepEdge : masonry(c, xx, y, zz, true)));
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        }
      }
    }
}

/** Covered passages and the road tunnel: a vault over each, with the hill or a house on top. */
function covered(b: Builder, c: AC, plan: Plan): void {
  const g = b.grid;
  for (const s of plan.segs) {
    if (!s.roof) continue;
    const r = s.w / 2 + 0.75;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1;
    const x0 = Math.floor((Math.min(ax, bx) - r) / V), x1 = Math.ceil((Math.max(ax, bx) + r) / V);
    const z0 = Math.floor((Math.min(az, bz) - r) / V), z1 = Math.ceil((Math.max(az, bz) + r) / V);
    // every worker registers the same occluders, whatever strip it keeps
    if (s.kind !== K.Tunnel) b.occlude(x0, z0, x1, z1, (layerOf(Math.max(ay, by)) - G) * V + s.roof + 5, Math.min(ay, by) + 0.95, 'building');
    if (!g.touches(x0, z0, x1, z1)) continue;
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) * V, pz = (z + 0.5) * V;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
        const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
        if (d > r) continue;
        const floor = layerOf(ay + (by - ay) * t);
        const ci = col(x, z);
        const inside = d <= s.w / 2;
        // a round vault: highest along the middle, springing from the walls
        const spring = floor + Math.round((s.roof - 1.2) / V);
        const crown = spring + Math.round(Math.sqrt(Math.max(0, 1 - (d / (s.w / 2)) ** 2)) * 1.2 / V);
        const lt = plan.lot[ci] ? plan.lots[plan.lot[ci] - 1] : null;
        const hill = layerOf(hillY(px, pz));
        const top = Math.max(lt ? lt.top : 0, s.kind === K.Tunnel ? hill : spring + 14 + Math.round(hash3(x >> 4, 1, z >> 4) * 12));
        const wall = s.kind === K.Tunnel ? c.limeDark : lt ? c.plasterOld : c.tufa;
        if (inside) {
          // the hill the passage burrows through is cut away under the vault
          if (crown > floor) g.box(x, floor, z, x, crown - 1, z, 0);
          g.box(x, crown, z, x, top, z, (xx, y, zz) => (y === crown ? c.stripeTufa : y > top - 2 && s.kind !== K.Tunnel ? c.roofWhite : s.kind === K.Tunnel && y > top - 2 ? c.grassDry : masonry(c, xx, y, zz, false) === c.mortar ? c.mortar : wall));
        } else if (plan.kind[ci] !== s.kind && t > 0 && t < 1) {
          // side walls only: the two ends stay open
          g.box(x, floor, z, x, top, z, (xx, y, zz) => (y > top - 2 && s.kind !== K.Tunnel ? c.roofWhite : y < floor + 2 ? c.plinth : masonry(c, xx, y, zz, s.kind !== K.Tunnel)));
        }
      }
    // lamps along the vault
    const len = Math.sqrt(len2);
    for (let t = 2; t < len; t += s.kind === K.Tunnel ? 7 : 5) {
      const f = t / len;
      b.lamp(ax + dx * f, ay + (by - ay) * f + s.roof - 1.4, az + dz * f, s.kind === K.Tunnel ? [1, 0.78, 0.5] : WARM, s.kind === K.Tunnel ? 7 : 4.5, 0.8);
    }
  }
}

/** Houses stand over the covered passages: once everything is built, clear each passage again under its vault. */
function carvePassages(b: Builder, c: AC, plan: Plan): void {
  const g = b.grid;
  for (const s of plan.segs) {
    if (!s.roof) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const dx = bx - ax, dz = bz - az, len2 = dx * dx + dz * dz || 1, r = s.w / 2;
    const x0 = Math.floor((Math.min(ax, bx) - r) / V), x1 = Math.ceil((Math.max(ax, bx) + r) / V);
    const z0 = Math.floor((Math.min(az, bz) - r) / V), z1 = Math.ceil((Math.max(az, bz) + r) / V);
    if (!g.touches(x0, z0, x1, z1)) continue;
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++) {
        const px = (x + 0.5) * V, pz = (z + 0.5) * V;
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / len2));
        const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
        if (d > r) continue;
        const floor = layerOf(ay + (by - ay) * t);
        const spring = floor + Math.round((s.roof - 1.2) / V);
        const crown = spring + Math.round(Math.sqrt(Math.max(0, 1 - (d / r) ** 2)) * 1.2 / V);
        if (g.get(x, crown - 1, z) === 0 && g.get(x, floor, z) === 0) continue;
        g.box(x, floor, z, x, crown - 1, z, 0);
        g.set(x, crown, z, c.stripeTufa);
      }
  }
}

const PASTELS = (c: AC) => [c.white, c.white, c.whiteWarm, c.cream, c.cream, c.yellow, c.lemonWall, c.ochre, c.peach, c.pink, c.rose, c.terracotta, c.sky, c.sage, c.plasterOld];

/** One Amalfi house: stucco cube on its terrace, shuttered windows, balconies, and a vault, dome or terrace on top. */
function house(b: Builder, c: AC, plan: Plan, lt: LotPlan): void {
  const g = b.grid;
  const { x0, z0, x1, z1, base, top } = lt;
  b.occlude(x0, z0, x1, z1, (top - G) * V + 2.6, (base - G) * V + 0.95, 'building');
  (b.occluders[b.occluders.length - 1]).floor = (base - G) * V;
  if (!g.touches(x0 - 2, z0 - 2, x1 + 2, z1 + 2)) return;
  const r = rng(lt.seed);
  const pal = PASTELS(c);
  const wall = pal[Math.floor(r() * pal.length)];
  const shutter = [c.shutterGreen, c.shutterGreen, c.shutterDeep, c.shutterBrown, c.shutterBlue][Math.floor(r() * 5)];
  const trim = r() < 0.6 ? c.white : c.sill;
  const roof = r();
  g.box(x0, base, z0, x1, top - 1, z1, (_x, y) => (y < base + 2 ? c.plinth : wall));
  // corner quoins on taller houses, a cornice under the roof
  g.box(x0, top - 1, z0, x1, top - 1, z1, trim);
  // what stands outside a facade cell: the ground level and whether a neighbour's wall is there
  const outside = (x: number, z: number): number => {
    if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) return 255;
    const ci = col(x, z), id = plan.lot[ci];
    if (id) return plan.lots[id - 1].top;
    if (plan.kind[ci] === K.Church) return 255;
    return plan.walk[ci];
  };
  const faces: { side: 'n' | 's' | 'e' | 'w'; n: number; at: (a: number) => [number, number]; out: (a: number) => [number, number] }[] = [
    { side: 'n', n: x1 - x0 + 1, at: (a) => [x0 + a, z0], out: (a) => [x0 + a, z0 - 1] },
    { side: 's', n: x1 - x0 + 1, at: (a) => [x1 - a, z1], out: (a) => [x1 - a, z1 + 1] },
    { side: 'w', n: z1 - z0 + 1, at: (a) => [x0, z1 - a], out: (a) => [x0 - 1, z1 - a] },
    { side: 'e', n: z1 - z0 + 1, at: (a) => [x1, z0 + a], out: (a) => [x1 + 1, z0 + a] },
  ];
  const floors = Math.floor((top - base) / 12);
  for (const f of faces) {
    const front = f.side === lt.side;
    // window bays: 3 voxels of glass, 2 of wall and shutter either side
    const bays: number[] = [];
    for (let a = 3; a + 4 < f.n; a += 7 + (lt.seed % 2)) bays.push(a);
    for (let fl = 0; fl < floors; fl++) {
      const yb = base + fl * 12;
      for (const a of bays) {
        const [ox, oz] = f.out(a + 1);
        const ground = outside(ox, oz);
        if (ground > yb + 3) continue; // buried in the hill or against the neighbour
        const [wx, wz] = f.at(a), [wx2, wz2] = f.at(a + 2);
        const groundFloor = fl === 0 || ground > yb - 6;
        // shops on the piazza and the main street open arches at street level instead
        if (fl === 0 && front && lt.shop && Math.abs(lt.door - base) <= 2) continue;
        const sy0 = yb + 3, sy1 = yb + 8;
        g.box(Math.min(wx, wx2), sy0, Math.min(wz, wz2), Math.max(wx, wx2), sy1, Math.max(wz, wz2), hash3(wx, yb, wz) < 0.35 ? c.glassLit : c.glass);
        // shutters: open, folded back against the wall beside the window
        const [sx0, sz0] = f.at(a - 1), [sx1, sz1] = f.at(a + 3);
        const closed = hash3(wx, yb + 1, wz) < 0.25;
        if (closed) g.box(Math.min(wx, wx2), sy0, Math.min(wz, wz2), Math.max(wx, wx2), sy1, Math.max(wz, wz2), (_x, y) => (y % 2 ? shutter : c.shutterDeep));
        else { g.box(sx0, sy0, sz0, sx0, sy1, sz0, shutter); g.box(sx1, sy0, sz1, sx1, sy1, sz1, shutter); }
        // sill, and on upper floors sometimes a little balcony with a rail and geraniums
        const [o0x, o0z] = f.out(a), [o2x, o2z] = f.out(a + 2);
        if (!groundFloor && ground + 10 < yb && hash3(wx, yb, 77) < 0.35) {
          const [bx0, bz0] = f.out(a - 1), [bx1, bz1] = f.out(a + 3);
          g.box(Math.min(bx0, bx1), yb + 2, Math.min(bz0, bz1), Math.max(bx0, bx1), yb + 2, Math.max(bz0, bz1), c.sill);
          for (let i = -1; i <= 3; i++) { const [px, pz] = f.out(a + i); g.box(px, yb + 3, pz, px, yb + 5, pz, i % 2 === 0 ? c.iron : 0); g.set(px, yb + 6, pz, c.iron); }
          if (hash3(wx, yb, 78) < 0.6) for (let i = -1; i <= 3; i += 2) { const [px, pz] = f.out(a + i); g.set(px, yb + 3, pz, hash3(px, yb, pz) < 0.5 ? c.geranium : c.leaf); }
          // a balcony door instead of a window
          g.box(Math.min(wx, wx2), yb + 1, Math.min(wz, wz2), Math.max(wx, wx2), yb + 2, Math.max(wz, wz2), c.glass);
        } else if (ground + 2 < sy0) {
          g.box(Math.min(o0x, o2x), sy0 - 1, Math.min(o0z, o2z), Math.max(o0x, o2x), sy0 - 1, Math.max(o0z, o2z), trim);
          if (!groundFloor && hash3(wx, yb, 79) < 0.3) g.box(Math.min(o0x, o2x), sy0, Math.min(o0z, o2z), Math.max(o0x, o2x), sy0, Math.max(o0z, o2z), (x, y, z) => (hash3(x, y, z) < 0.5 ? c.geranium : c.leafLight));
        }
      }
    }
    if (!front) continue;
    // the door, on the level of the path in front
    const dl = lt.door;
    if (dl >= base && dl <= top - 10) {
      const a = Math.floor(f.n / 2) - 1;
      const [dx0, dz0] = f.at(a), [dx1, dz1] = f.at(a + 2);
      const shopFront = lt.shop && Math.abs(dl - base) <= 2;
      if (shopFront) {
        // arched shop openings across the front, warm inside
        for (let s = 2; s + 4 < f.n; s += 6) {
          const [ax0, az0] = f.at(s), [ax1, az1] = f.at(s + 3);
          const X0 = Math.min(ax0, ax1), X1 = Math.max(ax0, ax1), Z0 = Math.min(az0, az1), Z1 = Math.max(az0, az1);
          g.box(X0, dl, Z0, X1, dl + 9, Z1, c.shopLit);
          g.box(X0, dl + 10, Z0, X1, dl + 10, Z1, c.stripeTufa);
          const [ix, iz] = f.at(s + 1), [jx, jz] = f.at(s + 2);
          g.set(ix, dl + 10, iz, c.shopLit); g.set(jx, dl + 10, jz, c.shopLit);
          const [lx, lz] = f.out(s + 1.5);
          b.lamp((lx + 0.5) * V, (dl - G) * V + 2, (lz + 0.5) * V, WARM, 3.5, 0.55);
        }
      } else {
        g.box(Math.min(dx0, dx1), dl, Math.min(dz0, dz1), Math.max(dx0, dx1), dl + 8, Math.max(dz0, dz1), r() < 0.5 ? c.door : c.doorGreen);
        g.box(Math.min(dx0, dx1), dl + 9, Math.min(dz0, dz1), Math.max(dx0, dx1), dl + 9, Math.max(dz0, dz1), trim);
      }
    }
  }
  // the roof
  const w = x1 - x0 + 1, d = z1 - z0 + 1;
  if (roof < 0.38) {
    // white barrel vault across the short side, the signature roof of the coast
    const alongX = w >= d;
    const span = alongX ? d : w;
    const rad = span / 2;
    g.box(x0, top, z0, x1, top + Math.ceil(rad * 0.55), z1, (x, y, z) => {
      const u = alongX ? z - z0 + 0.5 : x - x0 + 0.5;
      const hgt = Math.sqrt(Math.max(0, rad * rad - (u - rad) ** 2)) * 0.55;
      return y - top < hgt ? c.roofWhite : 0;
    });
  } else if (roof < 0.5 && w >= 12 && d >= 12) {
    // a small dome on a flat roof
    const cx = (x0 + x1 + 1) / 2, cz = (z0 + z1 + 1) / 2, rr = Math.min(w, d) / 2 - 1.5;
    g.box(x0, top, z0, x1, top, z1, c.terraceTile);
    for (let y = 0; y <= rr; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const dd = Math.hypot(x + 0.5 - cx, z + 0.5 - cz, y * 1.1);
      if (dd <= rr) g.set(x, top + 1 + y, z, c.roofWhite);
    }
  } else if (roof < 0.62) {
    // tiled hip roof
    for (let y = 0; y < Math.min(w, d) / 2; y++) g.box(x0 + y, top + y, z0 + y, x1 - y, top + y, z1 - y, (x, _y, z) => ((x + z) % 2 ? c.roofTile : c.roofTileB));
  } else {
    // a flat terrace with a parapet, often a pergola, potted lemons or a line of washing
    g.box(x0, top, z0, x1, top, z1, c.terraceTile);
    g.box(x0, top + 1, z0, x1, top + 3, z0, trim); g.box(x0, top + 1, z1, x1, top + 3, z1, trim);
    g.box(x0, top + 1, z0, x0, top + 3, z1, trim); g.box(x1, top + 1, z0, x1, top + 3, z1, trim);
    const pr = r();
    if (pr < 0.45) {
      // pergola of chestnut poles under vines or bougainvillea
      const flower = r() < 0.5;
      for (let x = x0 + 2; x <= x1 - 2; x += 5) for (let z = z0 + 2; z <= z1 - 2; z += 5) g.box(x, top + 1, z, x, top + 9, z, c.pole);
      g.box(x0 + 2, top + 10, z0 + 2, x1 - 2, top + 10, z1 - 2, (x, y, z) => {
        const n = hash3(x, y, z);
        return n < 0.25 ? 0 : flower && n < 0.55 ? (n < 0.4 ? c.bougain : c.bougainB) : n < 0.8 ? c.leaf : c.leafDark;
      });
    } else if (pr < 0.75) {
      for (let i = 0; i < 2; i++) b.place(potLemon(c, lt.seed + i), (x0 + 3 + i * (w - 6)) * V, (top + 1 - G) * V, (z0 + 3) * V);
    } else {
      // washing on a line across the terrace
      const cols = [c.white, c.sky, c.pink, c.yellow, c.umbrellaC];
      g.box(x0 + 1, top + 8, z0 + Math.floor(d / 2), x1 - 1, top + 8, z0 + Math.floor(d / 2), c.iron);
      for (let x = x0 + 2; x < x1 - 1; x += 2) if (hash3(x, top, z0) < 0.7) {
        const zc = z0 + Math.floor(d / 2);
        g.box(x, top + 5, zc, x, top + 7, zc, cols[Math.floor(hash3(x, 1, zc) * cols.length)]);
        const id = b.addSway({ ...SWAY.laundry, pivot: [(x + 0.5) * V, (top + 8.5 - G) * V, (zc + 0.5) * V], axis: [1, 0, 0], reach: 0 });
        for (let y = top + 5; y <= top + 7; y++) b.swayCell(x, y, zc, id);
      }
    }
  }
  // Amalfi chimneys: a little hooded stack
  if (r() < 0.5) {
    const cx = x0 + 2 + Math.floor(r() * (w - 4)), cz = z0 + 2 + Math.floor(r() * (d - 4));
    const ty = top + (roof < 0.38 ? 3 : 1);
    g.box(cx, ty, cz, cx + 1, ty + 5, cz + 1, wall);
    g.box(cx - 1, ty + 6, cz - 1, cx + 2, ty + 6, cz + 2, c.roofWhite);
  }
  // bougainvillea pouring down a sunny wall
  if (r() < 0.3) {
    const f = faces[Math.floor(r() * 4)];
    const a0 = Math.floor(r() * Math.max(1, f.n - 8));
    for (let a = a0; a < Math.min(f.n, a0 + 8); a++) {
      const [ox, oz] = f.out(a);
      const gl = outside(ox, oz);
      if (gl >= top) continue;
      const len = 6 + Math.floor(hash3(ox, 3, oz) * 18);
      for (let y = top - 1; y > Math.max(gl + 4, top - 1 - len); y--) if (hash3(ox, y, oz) < 0.8) g.set(ox, y, oz, hash3(ox, y + 1, oz) < 0.6 ? c.bougain : c.leaf);
    }
  }
}

/** Sant'Andrea: the striped Arab-Norman front with its portico, the gold mosaic gable and the majolica bell tower. */
function duomo(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(DUOMO_Y);
  // nave x -58..-28, z 6..22, the front faces the steps at x = -27
  const X0 = -58 / V, X1 = -27 / V - 1, Z0 = 4 / V, Z1 = 24 / V - 1;
  const H = Math.round(15 / V);
  b.occlude(X0, Z0, X1, Z1, DUOMO_Y + 24, DUOMO_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = DUOMO_Y;
  if (g.touches(X0, Z0 - 30, X1 + 30, Z1 + 30)) {
    g.box(X0, Y, Z0, X1, Y + H, Z1, (_x, y) => (y < Y + 2 ? c.marbleGrey : ((y - Y) >> 1) % 6 === 0 ? c.stripeTufa : c.cream));
    // pitched roof along the nave
    for (let i = 0; i < 24; i++) g.box(X0, Y + H + 1 + i, Z0 + i, X1 - 2, Y + H + 1 + i, Z1 - i, (x) => (x % 2 ? c.roofTile : c.roofTileB));
    // aisle windows
    for (let x = X0 + 6; x < X1 - 6; x += 12) for (const z of [Z0, Z1]) g.box(x, Y + 26, z, x + 3, Y + 40, z, (_x, y) => (y > Y + 37 ? c.stripeDark : c.glassLit));
    // the front: a tall striped screen with three gables and the gold mosaic of the big one
    const FX = X1 + 1;
    const FW0 = Z0 - 6, FW1 = Z1 + 6;
    g.box(FX, Y, FW0, FX + 3, Y + H + 10, FW1, (_x, y, z) => {
      const band = ((y - Y) >> 1) % 2;
      return band ? c.marble : ((z >> 1) % 2 ? c.stripeDark : c.marble);
    });
    // interlaced pointed arches across the upper front
    for (let z = FW0 + 2; z < FW1 - 3; z += 6) g.box(FX + 4, Y + 30, z, FX + 4, Y + 42, z + 3, (_x, y, zz) => (y > Y + 39 || zz === z || zz === z + 3 ? c.stripeTufa : c.stripeDark));
    // gables: the middle one with the mosaic of Christ in gold
    const gable = (zc: number, half: number, yb: number, gold: boolean) => {
      for (let i = 0; i <= half; i++) g.box(FX, yb + i, zc - half + i, FX + 3, yb + i, zc + half - i, (_x, y, z) => {
        if (!gold || Math.abs(z - zc) > half - i - 2) return (y + z) % 3 === 0 ? c.stripeDark : c.marble;
        const n = hash3(z, y, 5);
        return Math.abs(z - zc) < 3 && y < yb + half - 6 ? (n < 0.5 ? c.mosaicBlue : c.mosaicRed) : n < 0.08 ? c.mosaicBlue : c.mosaicGold;
      });
    };
    gable((Z0 + Z1) >> 1, 30, Y + H + 10, true);
    gable(FW0 + 8, 8, Y + H + 10, false);
    gable(FW1 - 8, 8, Y + H + 10, false);
    // the portico: six pointed arches in black and white stone, open onto the atrium
    g.box(FX + 4, Y, FW0, FX + 11, Y + 24, FW1, (_x, y, z) => (y > Y + 21 ? c.marble : ((z - FW0) % 12 < 2 ? (((y - Y) >> 1) % 2 ? c.stripeDark : c.marble) : 0)));
    for (let z = FW0; z <= FW1; z += 12) for (let y = Y + 14; y <= Y + 21; y++) {
      const t = (y - Y - 14) / 7;
      const w0 = Math.round(t * t * 5);
      g.box(FX + 4, y, z + 2, FX + 11, y, z + 2 + w0, (_x, yy) => ((yy >> 1) % 2 ? c.stripeDark : c.marble));
      g.box(FX + 4, y, z + 11 - w0, FX + 11, y, z + 11, (_x, yy) => ((yy >> 1) % 2 ? c.stripeDark : c.marble));
    }
    // bronze doors cast in Constantinople, 1060
    const zc = (Z0 + Z1) >> 1;
    g.box(FX, Y, zc - 4, FX, Y + 16, zc + 3, c.bronzeDoor);
    g.box(FX, Y + 17, zc - 5, FX, Y + 17, zc + 4, c.mosaicGold);
    for (const zz of [zc - 18, zc + 14]) g.box(FX, Y, zz, FX, Y + 12, zz + 3, c.door);
    b.lamp(-23, DUOMO_Y + 4, zc * V, WHITEWARM, 9, 0.9);
    b.lamp(-23, DUOMO_Y + 4, FW0 * V + 2, WARM, 5, 0.6);
    b.lamp(-23, DUOMO_Y + 4, FW1 * V - 2, WARM, 5, 0.6);
    // floodlights on the front at night, from the foot of the steps
    b.lamp(-6, PIAZZA_Y + 1, 9, [1, 0.86, 0.66], 8, 0.7);
    b.lamp(-6, PIAZZA_Y + 1, 19, [1, 0.86, 0.66], 8, 0.7);
  }
  // the bell tower (1180), finished with a drum of interlaced arches and green and yellow tiles
  const TX0 = -40 / V, TZ0 = 25 / V, TS = 22;
  b.occlude(TX0, TZ0, TX0 + TS - 1, TZ0 + TS - 1, DUOMO_Y + 40, DUOMO_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = DUOMO_Y;
  if (g.touches(TX0, TZ0, TX0 + TS, TZ0 + TS)) {
    const TH = 116;
    g.box(TX0, Y, TZ0, TX0 + TS - 1, Y + TH, TZ0 + TS - 1, (_x, y) => (((y - Y) % 28) < 2 ? c.stripeDark : c.tufa));
    for (let lv = 1; lv < 4; lv++) for (const side of [0, 1, 2, 3]) {
      const yb = Y + lv * 28 + 8;
      for (let a = 4; a < TS - 4; a += 7) {
        const [x, z] = side === 0 ? [TX0 + a, TZ0] : side === 1 ? [TX0 + a, TZ0 + TS - 1] : side === 2 ? [TX0, TZ0 + a] : [TX0 + TS - 1, TZ0 + a];
        g.box(x, yb, z, x + (side < 2 ? 2 : 0), yb + 10, z + (side >= 2 ? 2 : 0), c.stripeDark);
      }
    }
    const cx = TX0 + TS / 2, cz = TZ0 + TS / 2;
    for (let y = 0; y < 22; y++) for (let z = TZ0 - 2; z < TZ0 + TS + 2; z++) for (let x = TX0 - 2; x < TX0 + TS + 2; x++) {
      const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
      const rr = y < 12 ? 9 : 9 - (y - 12) * 0.9;
      if (d > rr || d < rr - 2) continue;
      const ang = Math.atan2(z - cz, x - cx);
      const arch = y < 10 && Math.floor((ang + Math.PI) * 4) % 2 === 0 && y > 3;
      g.set(x, Y + TH + 1 + y, z, arch ? 0 : y >= 12 ? ((x + z + y) % 2 ? c.majolicaGreen : c.majolicaYellow) : (y % 3 ? c.marble : c.stripeDark));
    }
    // four little corner turrets
    for (const [qx, qz] of [[TX0, TZ0], [TX0 + TS - 4, TZ0], [TX0, TZ0 + TS - 4], [TX0 + TS - 4, TZ0 + TS - 4]]) {
      g.box(qx, Y + TH + 1, qz, qx + 3, Y + TH + 10, qz + 3, c.marble);
      g.box(qx + 1, Y + TH + 11, qz + 1, qx + 2, Y + TH + 13, qz + 2, c.majolicaGreen);
    }
    g.set(Math.floor(cx), Y + TH + 23, Math.floor(cz), c.iron);
    g.box(Math.floor(cx), Y + TH + 24, Math.floor(cz), Math.floor(cx), Y + TH + 27, Math.floor(cz), c.iron);
  }
  // the steps get lamps either side, all the way up
  for (let i = 0; i < 4; i++) {
    const x = -5 - i * 4.5, y = PIAZZA_Y + (DUOMO_Y - PIAZZA_Y) * (i * 4.5 / 15.5);
    for (const z of [8.6, 19.4]) { b.place(lampPost(c), x, y, z); b.lamp(x, y + 3.4, z, WARM, 5, 0.7); }
  }
}

/** The Cloister of Paradise: white interlaced arches round a garden of palms. */
function cloister(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(DUOMO_Y);
  const X0 = -46 / V, X1 = -32 / V - 1, Z0 = 29 / V, Z1 = 43 / V - 1;
  b.occlude(X0 - 2, Z0 - 2, X1 + 2, Z1 + 2, DUOMO_Y + 6, DUOMO_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = DUOMO_Y;
  if (!g.touches(X0 - 3, Z0 - 3, X1 + 3, Z1 + 3)) return;
  // outer walls (with the door from the atrium side), the arcade and its roof
  g.box(X0 - 2, Y, Z0 - 2, X1 + 2, Y + 18, Z1 + 2, (x, y, z) => (x < X0 || x > X1 || z < Z0 || z > Z1 ? (y > Y + 16 ? c.roofTile : c.white) : 0));
  g.box(X1 + 1, Y, Z0 + 2, X1 + 2, Y + 11, Z0 + 10, 0); // doorway towards the atrium passage
  for (let ring = 0; ring < 2; ring++) {
    const ax0 = X0 + 8, ax1 = X1 - 8, az0 = Z0 + 8, az1 = Z1 - 8;
    void ring;
    g.box(X0, Y + 14, Z0, X1, Y + 15, Z1, (x, _y, z) => (x >= ax0 && x <= ax1 && z >= az0 && z <= az1 ? 0 : c.roofTile));
    // twin columns and interlaced arches along the four sides of the garden
    for (let x = ax0; x <= ax1; x++) for (const z of [az0, az1]) {
      const ph = (x - ax0) % 4;
      g.box(x, Y, z, x, Y + 13, z, (_x, y) => (y > Y + 10 ? c.white : ph === 0 ? c.marble : y > Y + 8 + (ph === 2 ? 0 : 1) ? c.white : 0));
    }
    for (let z = az0; z <= az1; z++) for (const x of [ax0, ax1]) {
      const ph = (z - az0) % 4;
      g.box(x, Y, z, x, Y + 13, z, (_x, y) => (y > Y + 10 ? c.white : ph === 0 ? c.marble : y > Y + 8 + (ph === 2 ? 0 : 1) ? c.white : 0));
    }
    // the garden
    g.box(ax0 + 1, Y - 1, az0 + 1, ax1 - 1, Y - 1, az1 - 1, (x, y, z) => (hash3(x, y, z) < 0.7 ? c.grass : c.herb));
    break;
  }
  b.place(palmTree(c, 31), (X0 + X1) / 2 * V, DUOMO_Y, (Z0 + Z1) / 2 * V);
  b.place(potLemon(c, 12), (X0 + 9) * V, DUOMO_Y, (Z0 + 9) * V);
  b.place(potLemon(c, 13), (X1 - 9) * V, DUOMO_Y, (Z1 - 9) * V);
  b.lamp((X0 + X1) / 2 * V, DUOMO_Y + 2.5, (Z0 + Z1) / 2 * V, WARM, 7, 0.5);
}

/** Porta della Marina: the arch through the old sea wall, with its tile panel over the road side. */
function gate(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(2.0);
  const X0 = 18.5 / V, X1 = 26.5 / V, Z0 = 4 / V, Z1 = 14 / V;
  b.occlude(X0, Z0, X1, Z1, 11, 2.95, 'landmark');
  if (!g.touches(X0, Z0, X1, Z1)) return;
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    const pz = (z + 0.5) * V;
    const inside = Math.abs(pz - 9) < 2;
    const yb = layerOf(PIAZZA_Y) - 4;
    if (!inside) { g.box(x, Y, z, x, Y + 34, z, (xx, y, zz) => (y > Y + 32 ? c.roofWhite : masonry(c, xx, y, zz, true))); continue; }
    const crown = Y + 18 + Math.round(Math.sqrt(Math.max(0, 1 - ((pz - 9) / 2) ** 2)) * 6);
    g.box(x, crown, z, x, Y + 34, z, (_xx, y) => (y > Y + 32 ? c.roofWhite : y < crown + 2 ? c.stripeTufa : c.whiteWarm));
    void yb;
  }
  // the majolica panel of Saint Andrew facing the sea
  g.box(X1, Y + 26, Z0 + 10, X1, Y + 32, Z1 - 10, (_x, y, z) => ((y + z) % 3 === 0 ? c.majolicaYellow : (y * 3 + z) % 5 === 0 ? c.majolicaGreen : c.majolicaBlue));
  b.lamp(27.4, 6.5, 9, WARM, 6, 0.8);
  b.lamp(18, 6.5, 9, WARM, 6, 0.6);
}

/** Piazza Duomo: Saint Andrew's fountain, café tables under umbrellas, the pastry shop's tables. */
function piazza(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(PIAZZA_Y);
  // Fontana di Sant'Andrea: a marble basin, the saint on top, water spouting from the breasts of the siren below
  const fx = 10 / V, fz = 12 / V;
  b.block(8.4, 10.4, 11.6, 13.6);
  b.occlude(fx - 7, fz - 7, fx + 7, fz + 7, PIAZZA_Y + 4.5, PIAZZA_Y + 0.6, 'landmark');
  b.occluders[b.occluders.length - 1].floor = PIAZZA_Y;
  if (g.touches(fx - 8, fz - 8, fx + 8, fz + 8)) {
    for (let z = fz - 7; z <= fz + 7; z++) for (let x = fx - 7; x <= fx + 7; x++) {
      const d = Math.hypot(x + 0.5 - fx, z + 0.5 - fz);
      if (d > 6.5) continue;
      if (d > 5.4) g.box(x, Y, z, x, Y + 3, z, d > 6 ? c.marbleGrey : c.marble);
      else g.set(x, Y, z, c.marbleGrey);
    }
    g.box(fx - 1, Y, fz - 1, fx, Y + 9, fz, c.marble);
    g.box(fx - 2, Y + 6, fz - 2, fx + 1, Y + 6, fz + 1, c.marble);
    g.box(fx - 1, Y + 10, fz - 1, fx, Y + 15, fz, c.bronzeDoor);
    g.box(fx - 1, Y + 16, fz - 1, fx, Y + 17, fz, c.marbleGrey);
    g.box(fx - 3, Y + 13, fz, fx + 2, Y + 13, fz, c.bronzeDoor); // the saint's cross
  }
  b.emitters.push({ kind: 'steam', pos: [10, PIAZZA_Y + 1.6, 12], rate: 0 });
  // café terraces along the north side of the piazza and below the steps
  const terrace = (x: number, z: number, cloth: number, seed: number) => {
    b.place(cafeTable(k(b), cloth), x, PIAZZA_Y, z);
    b.place(stool(k(b), c.iron), x - 0.55, PIAZZA_Y, z);
    b.place(stool(k(b), c.iron), x + 0.55, PIAZZA_Y, z);
    b.stools.push([x - 0.55, z, Math.PI / 2], [x + 0.55, z, -Math.PI / 2]);
    if (seed % 2 === 0) b.place(umbrella(c, seed), x, PIAZZA_Y, z);
  };
  for (let i = 0; i < 4; i++) terrace(3 + i * 3.2, -3.6, b.k.c.white, i);
  for (let i = 0; i < 3; i++) terrace(5 + i * 3.4, 27.4, b.k.c.navy, i + 7);
  for (const [x, z] of [[2, 6], [2, 22], [18, 3], [18, 24]] as const) { b.place(bench(k(b)), x, PIAZZA_Y, z, 1); b.benches.push([x, z, Math.PI / 2]); }
  for (const [x, z] of [[-2.5, 7.5], [-2.5, 20.5], [19.5, 14], [19.5, 4]] as const) { b.place(potLemon(c, (x * 7 + z) | 0), x, PIAZZA_Y, z); }
  for (const [x, z] of [[1, 10], [1, 17], [17, 26]] as const) { b.place(lampPost(c), x, PIAZZA_Y, z); b.lamp(x, PIAZZA_Y + 3.4, z, WARM, 7, 0.9); }
  b.place(ceramicRack(c, 3), 14, PIAZZA_Y, -5.3);
  b.place(ceramicRack(c, 4), 7, PIAZZA_Y, 29.4, 2);
  b.place(scooter(k(b), c.hullRed), 20, PIAZZA_Y, 22, 1);
  b.place(scooter(k(b), c.sky), 20, PIAZZA_Y, 24.5, 1);
}

const k = (b: Builder) => b.k;

/** The beach with its umbrellas and boats, the harbour quay, the pier and its lighthouse, ferries and gozzi. */
function shore(b: Builder, c: AC): void {
  // umbrellas and sunbeds in rows on the pebbles
  let s = 0;
  for (let z = -10; z < 32; z += 3.6)
    for (const x of [41.5, 45]) {
      if (Math.abs(z - 9) < 3) continue; // the walk down to the water stays open
      b.place(umbrella(c, s), x, 0.95 - (x - 41.5) * 0.1, z);
      b.place(sunbed(c), x + 1, 0.95 - (x - 41.5) * 0.1, z + 0.4);
      b.block(x + 0.6, z - 0.6, x + 1.8, z + 1.4);
      s++;
    }
  // gozzi pulled up on the beach near the harbour end
  for (let i = 0; i < 4; i++) {
    const z = 32 + i * 1.8;
    b.place(gozzo(c, i + 1, 30), 39 + i * 0.6, 1.2, z, 0);
    b.block(39 + i * 0.6 - 1.9, z - 0.7, 39 + i * 0.6 + 1.9, z + 0.7);
  }
  // boats moored along the quay and the pier
  for (let i = 0; i < 7; i++) {
    const z = 56 + i * 3.4;
    b.place(gozzo(c, i + 3, 34 + (i % 3) * 4), 48.6, -0.7, z, 0);
  }
  for (let i = 0; i < 6; i++) b.place(gozzo(c, i + 9, 32), 56 + i * 4.6, -0.7, 46.2, 1);
  b.place(ferry(c), 70, -1.3, 58.2, 0);
  // bitts, crates and nets on the quay
  for (let z = 44; z < 80; z += 4) b.place(bitt(c), 45.6, 1.0, z);
  for (let x = 50; x < 84; x += 5) b.place(bitt(c), x, 1.0, 53.2);
  b.place(crateLemons(c, 1), 38, 1.0, 50);
  b.place(crateLemons(c, 2), 38.8, 1.0, 50.2);
  // the lighthouse at the end of the pier
  const g = b.grid;
  const lx = 82 / V, lz = 51 / V;
  if (g.touches(lx - 4, lz - 4, lx + 4, lz + 4)) {
    const Y = layerOf(1.0);
    for (let y = 0; y < 30; y++) for (let z = lz - 3; z <= lz + 3; z++) for (let x = lx - 3; x <= lx + 3; x++) {
      const d = Math.hypot(x + 0.5 - lx, z + 0.5 - lz);
      if (d < (y > 24 ? 2 : 3)) g.set(x, Y + y, z, y > 24 ? (y > 27 ? c.iron : c.lampGlowAlways) : (y >> 2) % 2 ? c.lighthouse : c.white);
    }
  }
  b.block(81, 50, 83, 52);
  b.lamp(82, 8, 51, [1, 0.5, 0.35], 6, 1.2);
  // lamps along the lungomare
  for (let z = -48; z < 80; z += 9) { b.place(lampPost(c), ROAD_X1 + 0.6, 2.0, z); b.lamp(ROAD_X1 + 0.6, 5.4, z, WARM, 7, 0.8); }
  for (let z = -46; z < 78; z += 9) { b.place(bench(k(b)), ROAD_X1 + 0.6, 2.0, z + 4.5, 1); b.benches.push([ROAD_X1 + 0.6, z + 4.5, Math.PI / 2]); }
  // the road tunnel's mouth
  const tz = TUNNEL_Z / V;
  if (g.touches(ROAD_X0 / V - 4, tz - 3, ROAD_X1 / V + 4, tz + 2)) {
    const Y = layerOf(2.0);
    for (let x = ROAD_X0 / V - 4; x <= ROAD_X1 / V + 4; x++) {
      const d = Math.abs((x + 0.5) * V - (ROAD_X0 + ROAD_X1) / 2);
      const crown = Y + 14 + Math.round(Math.sqrt(Math.max(0, 1 - (d / 4.2) ** 2)) * 8);
      g.box(x, d < 4.2 ? crown : Y, tz, x, Y + 30, tz + 1, (xx, y, zz) => (y < crown + 2 ? c.stripeTufa : masonry(c, xx, y, zz, false)));
    }
  }
}

/** Lemon pergolas on the terraces, olive and cypress higher up, a palm here and there. */
function gardens(b: Builder, c: AC, plan: Plan, inWin: (x: number, z: number) => boolean): void {
  const g = b.grid;
  for (let z = VZ0 + 1; z < VZ0 + SZ - 1; z++)
    for (let x = VX0 + 1; x < VX0 + SX - 1; x++) {
      if (!inWin(x, z)) continue;
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Rock) continue;
      const w = plan.walk[ci];
      const mx = x * V, mz = z * V;
      if (mx > ROAD_X0 || mz < -44) continue;
      // the terrace is one level wide here: no pergola over the edge of a drop
      let edge = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) {
        const nc = col(x + dx, z + dz);
        if (plan.kind[nc] !== K.Rock || Math.abs(plan.walk[nc] - w) > 0) { edge = true; break; }
      }
      const zone = hash3(Math.floor(mx / 11), 17, Math.floor(mz / 11));
      if (zone < 0.62 && !edge) {
        // limonaia: chestnut posts every 2 m holding a roof of leaves and lemons at 2.4 m
        if (x % 8 === 0 && z % 8 === 0) g.box(x, w, z, x, w + 9, z, c.pole);
        const n = hash3(x, w, z);
        g.set(x, w + 10, z, n < 0.08 ? c.lemon : n < 0.6 ? c.leaf : n < 0.85 ? c.leafDark : c.net);
        if (n < 0.05) g.set(x, w + 9, z, c.lemon);
      } else if (zone > 0.9 && !edge && x % 20 === 7 && z % 20 === 3) {
        // a cypress
        for (let y = 0; y < 30; y++) {
          const rr = y < 3 ? 0 : 1.6 * Math.sin(Math.PI * Math.min(1, (y - 2) / 28)) ** 0.7;
          for (let dz = -2; dz <= 2; dz++) for (let dx = -2; dx <= 2; dx++) if (Math.hypot(dx, dz) <= Math.max(0.5, rr)) g.set(x + dx, w + y, z + dz, y < 3 ? c.trunk : c.cypress);
        }
      }
    }
  // olive trees, lemon trees and palms as props on terrace spots (decided from the plan only)
  const r = rng(707);
  for (let i = 0; i < 260; i++) {
    const x = VX0 + 8 + Math.floor(r() * (SX - 16)), z = VZ0 + 8 + Math.floor(r() * (SZ - 16));
    const kind = r(), seed = Math.floor(r() * 1e5);
    const ci = col(x, z);
    if (plan.kind[ci] !== K.Rock) continue;
    let flat = true;
    for (let dz = -6; dz <= 6 && flat; dz += 3) for (let dx = -6; dx <= 6 && flat; dx += 3) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== K.Rock || plan.walk[nc] !== plan.walk[ci]) flat = false; }
    if (!flat) continue;
    const y = (plan.walk[ci] - G) * V;
    if (x * V > ROAD_X0) continue;
    if (kind < 0.45) b.place(lemonTree(c, seed, kind < 0.1), x * V, y, z * V);
    else if (kind < 0.8) b.place(oliveTree(c, seed), x * V, y, z * V);
    else if (kind < 0.88) b.place(palmTree(c, seed), x * V, y, z * V);
    else if (kind < 0.95) b.place(bush(b.k, seed), x * V, y, z * V);
    else b.place(grassTuft(b.k, seed), x * V, y, z * V);
  }
}

/** Lamps, potted plants and little shrines along the lanes and stairways. */
function lanes(b: Builder, c: AC, plan: Plan): void {
  const r = rng(4242);
  for (const s of plan.segs) {
    if (s.kind !== K.Lane && s.kind !== K.Street && s.kind !== K.Stair) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 3 + r() * 3; t < len - 2; t += 9 + r() * 5) {
      const f = t / len, side = r() < 0.5 ? 1 : -1;
      const off = s.w / 2 - 0.2;
      const x = ax + (bx - ax) * f + nx * off * side, z = az + (bz - az) * f + nz * off * side;
      const y = ay + (by - ay) * f;
      // wall lantern on the house beside the lane, if there is one, else a post
      const vx = Math.floor((x + nx * side * 0.5) / V), vz = Math.floor((z + nz * side * 0.5) / V);
      const beside = plan.lot[col(vx, vz)];
      if (beside) b.place(wallLantern(c), x, y + 2.6, z, Math.abs(nx) > Math.abs(nz) ? (nx * side > 0 ? 3 : 1) : (nz * side > 0 ? 0 : 2));
      else b.place(lampPost(c), x, y, z);
      b.lamp(x, y + 2.6, z, WARM, 5.5, 0.75);
      const ex = ax + (bx - ax) * f - nx * off * side, ez = az + (bz - az) * f - nz * off * side;
      if (r() < 0.5) b.place(geraniumPot(c, Math.floor(r() * 1e4)), ex, y, ez);
      else if (r() < 0.4) b.place(potLemon(c, Math.floor(r() * 1e4)), ex, y, ez);
    }
  }
}

// ------------------------------------------------------------------------------------------- food

const STALL_SPOTS: { id: string; kind: 'pastry' | 'fry' | 'pizza' | 'gelato' | 'lemon'; x: number; z: number; face: number }[] = [
  { id: 'pansa', kind: 'pastry', x: 12.5, z: -4.6, face: 0 },
  { id: 'cuoppo', kind: 'fry', x: 38.2, z: 42.5, face: -Math.PI / 2 },
  { id: 'portafoglio', kind: 'pizza', x: -31, z: -9.6, face: 0 },
  { id: 'gelato', kind: 'gelato', x: 36.4, z: 4.5, face: -Math.PI / 2 },
  { id: 'limonaia', kind: 'lemon', x: -60, z: -14.0, face: 0 },
];

function foodStalls(b: Builder, c: AC, plan: Plan): StallAnchor[] {
  const out: StallAnchor[] = [];
  for (const s of STALL_SPOTS) {
    // the cart's long side faces the customer; the vendor stands behind it
    const fx = Math.sin(s.face), fz = Math.cos(s.face);
    const y = (plan.walk[col(Math.floor(s.x / V), Math.floor(s.z / V))] - G) * V;
    const turns = Math.round(((-s.face / (Math.PI / 2)) % 4 + 4) % 4);
    b.place(cart(c, s.kind), s.x, y, s.z, turns);
    b.block(s.x - 1.0 - Math.abs(fz) * 0.1, s.z - 1.0, s.x + 1.0, s.z + 1.0);
    const stand: [number, number] = [s.x + fx * 1.6, s.z + fz * 1.6];
    out.push({ id: s.id, stand, vendor: [s.x - fx * 1.0, s.z - fz * 1.0, s.face], label: [s.x, (layerOf(y) - G) * V + 2.6, s.z] });
    b.lamp(s.x, y + 2.3, s.z, WARM, 4, 0.8);
    if (s.kind === 'fry' || s.kind === 'pizza') b.emitters.push({ kind: 'steam', pos: [s.x - fx * 0.3, y + 1.3, s.z - fz * 0.3], rate: 1 });
  }
  return out;
}

// ------------------------------------------------------------------------------------------- the hidden kitchen

/**
 * La Grotta: a cellar kitchen dug into the cliff, vaulted in tufa, a wood oven glowing at the back, a marble
 * counter where Zia Carmela cooks for whoever finds the door.
 */
function grotta(b: Builder, c: AC, anchors: Anchors): BuildResult['interior'] {
  const g = new SparseGrid(0, 0, ISX, ISY, ISZ);
  const props: PlacedProp[] = [];
  const lamps: Lamp[] = [];
  const [ox, , oz] = INTERIOR_ORIGIN;
  const place = (p: Prop, cx: number, y: number, cz: number, turns = 0) => {
    const rp = rotateProp(p, turns);
    props.push(b.placed(rp, [ox + cx - (rp.sx * rp.scale) / 2, y, oz + cz - (rp.sz * rp.scale) / 2]));
  };
  const lamp = (x: number, y: number, z: number, col: [number, number, number], radiusM: number, intensity = 1) => {
    lamps.push({ x: x / V, y: y / V + G, z: z / V, r: col[0] * intensity, g: col[1] * intensity, b: col[2] * intensity, radius: radiusM / V });
  };
  g.box(0, 0, 0, ISX - 1, G - 1, ISZ - 1, c.tufaDark);
  for (let z = 0; z < ISZ; z++) for (let x = 0; x < ISX; x++) g.set(x, G - 1, z, (x >> 2) % 2 === (z >> 2) % 2 ? c.cotto : c.cottoB);
  // tufa walls on the two far sides, vaulting over towards the open ones
  g.box(0, G, 0, 2, G + 17, ISZ - 1, (x, y, z) => (hash3(x, y >> 1, z >> 1) < 0.5 ? c.tufa : c.tufaDark));
  g.box(0, G, 0, ISX - 1, G + 17, 2, (x, y, z) => (hash3(x >> 1, y >> 1, z) < 0.5 ? c.tufa : c.tufaDark));
  for (let y = 0; y < 6; y++) { g.box(3, G + 12 + y, 3, 3 + 6 - y, G + 12 + y, ISZ - 1, c.tufa); g.box(3, G + 12 + y, 3, ISX - 1, G + 12 + y, 3 + 6 - y, c.tufa); }
  // the marble counter (same footprint the bake keeps clear for any hidden kitchen) and the prep shelf behind it
  g.box(8, G, 22, 44, G + 3, 25, c.majolicaBlue);
  g.box(8, G, 22, 44, G + 3, 22, (x) => (x % 3 === 0 ? c.majolicaYellow : c.majolicaWhite));
  g.box(8, G + 4, 21, 44, G + 4, 26, c.marble);
  g.box(6, G, 6, 44, G + 3, 10, c.door);
  g.box(6, G + 4, 6, 44, G + 4, 10, c.marbleGrey);
  // shelves of jars, lemons and limoncello bottles
  g.box(6, G + 8, 2, 44, G + 8, 4, c.door);
  for (let x = 8; x < 42; x += 2) g.box(x, G + 9, 3, x, G + 10, 3, [c.lemon, c.glass, c.majolicaYellow, c.geranium][(x / 2) % 4]);
  // a wood-fired oven in the alcove, glowing
  g.box(44, G, 2, 56, G + 10, 7, c.tufa);
  for (let y = 0; y < 5; y++) g.box(45 + y, G + 11 + y, 2, 55 - y, G + 11 + y, 7, c.tufaDark);
  g.box(48, G + 3, 7, 52, G + 7, 7, c.glassLit);
  g.box(49, G + 4, 7, 51, G + 6, 7, c.lampGlowAlways);
  // garlic and peppers hanging from the vault
  for (let x = 10; x < 42; x += 5) g.box(x, G + 12, 14, x, G + 14, 14, x % 2 ? c.geranium : c.marble);
  // stools along the counter
  for (let i = 0; i < 6; i++) place(stool(b.k, c.door), (10.5 + i * 5.5) * V, 0, 30 * V);
  place(lemonTree(c, 404), 58 * V, 0, 40 * V);
  place(potLemon(c, 405), 4 * V, 0, 44 * V);
  place(buildFood('scialatielli', b.pal), 22 * V, 1.25, 23 * V, 2);
  place(buildFood('totani', b.pal), 30 * V, 1.25, 23 * V, 2);
  lamp(18 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(34 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(50 * V, 1.5, 9 * V, [1, 0.55, 0.25], 6, 1.4);
  lamp(30 * V, 2.0, 8 * V, WHITEWARM, 6, 0.7);
  lamp(4 * V, 2.2, 30 * V, WARM, 4, 0.6);
  // the way out: a low door at the front corner
  g.box(56, G, 44, 63, G + 12, 47, c.tufa);
  g.box(58, G, 44, 61, G + 9, 44, c.door);
  anchors.interiorSpawn = [ox + 14.75, 0, oz + 10.0];
  anchors.interiorExit = [ox + 14.9, oz + 10.6];
  anchors.chef = [ox + 6.5, 0, oz + 4.4];
  anchors.counterStand = [ox + 6.5, oz + 7.3];
  return { grid: g, props, lamps };
}
