import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, V, VX0, VZ0, SX, SZ, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, BuildResult, Anchors, PlacedProp, Window, WARM, WHITEWARM, StallAnchor } from './tokyo';
import { Prop, rotateProp, bench, scooter, stool, bush, grassTuft, terraceTable, terraceChair, TERRACE_TOP } from './props';
import { buildFood, type FoodId } from './food';
import type { RoomAnchor, RoomNpc } from './interiors';
import { STALL } from '../data/stalls';
import { HOTEL } from '../data/hotels';
import { paneOf, type HotelAnchor } from './hotels';
import { SWAY } from './sway';
import { madeiraPlan, K, col, layerOf, isPath, wildRock, LotPlan, PIAZZA_Y, SEA_Y, DUOMO_Y, ROAD_X0, ROAD_X1, PROM_X1, ribZ, RIB_HALF, bedY, SE, SE_TOWER, MERCADO, JARDIM, TELE, FORT_C, fortR, MAR_CX, MAR_CZ, MAR_A0, MAR_A1, moleRadii, waterX, type Plan } from './madeiraPlan';
import { seInterior, seGeom, type SeFrame, HALL_ROOM } from './sacred';
import { paintColors, picture, hangIn, type PaintColors, type PictureKind } from './paintings';
import { dineColors, dressWalls, kitchenLine, tableTop, pendants, counterPiece, cornerPlant, rug, cornice, hangRail, windowBench, hiddenKitchenDress, onWall, bare, walls, put, type Dine, type Goods, type TableStyle, type WallLook } from './dining';

/**
 * Funchal: the old town and the seafront of Madeira's capital. White plaster and black basalt, terracotta roofs and
 * green shutters; the Sé on its square of calçada, the market over the walled ribeira, the painted doors of Rua de
 * Santa Maria, the yellow fort at the east end, the marina inside its curved breakwater, and behind it all the
 * amphitheatre of hills in terraces of bananas and vines, a levada running round them.
 * The ground plan (heights, paths, lots) comes from world/madeiraPlan.ts; this fills it with voxels.
 */

export function madeiraColors(b: Builder) {
  const a = (hex: number, vary = 0.06, o: { emit?: number; night?: boolean; leaf?: boolean; glass?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
  const F = { leaf: true };
  const c = {
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
    glass: a(0x3d4c58, 0.04, { glass: true }), glassLit: a(0xffcf8a, 0.04, { emit: 0.7, night: true, glass: true }), shopLit: a(0xffd9a0, 0.04, { emit: 0.55 }),
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
    fishNet: a(0x2f6b5a, 0.08), fishNetB: a(0xc8582e, 0.06), float: a(0xe8e2d4, 0.03), floatRed: a(0xd23a2a, 0.03),
    crateBlue: a(0x2f6fb0, 0.04), rope: a(0xc9b48a, 0.05), kiosk: a(0x2a5d8f, 0.03), sign: a(0xf4f0e4, 0.02),
    lampGlow: a(0xffd89a, 0.03, { emit: 0.9, night: true }), lampGlowAlways: a(0xffd89a, 0.03, { emit: 0.85 }),
    // the small things on a house front: a white air conditioner, the brass of a knocker, an aerial on the roof
    acWhite: a(0xe6e4de, 0.03), acGrille: a(0x8e8c86, 0.04), brass: a(0xb8923e, 0.05), piperno: a(0x45423f, 0.06),
    // Madeira: black basalt dressed stone (cantaria), the black and white calçada, the volcanic rock of the island
    cantaria: a(0x3e3b39, 0.05), cantariaB: a(0x4a4644, 0.05), calWhite: a(0xebe6da, 0.03), calBlack: a(0x34312f, 0.05),
    tuffRed: a(0x8a4a32, 0.1), tuffBrown: a(0x6a4a38, 0.1), lava: a(0x4a4440, 0.1), lavaB: a(0x5a534d, 0.1),
    azulejo: a(0x2a5aa8, 0.05), azulejoW: a(0xf1eee6, 0.02), fortYellow: a(0xe8b84a, 0.05), fortOchre: a(0xc8963a, 0.05),
    banana: a(0x6aa83a, 0.12, F), bananaB: a(0x4f8a2e, 0.12, F), bananaDry: a(0xa89a4a, 0.1, F), bananaStem: a(0x8aa85a, 0.08), bananaFruit: a(0x9ab83a, 0.06, F),
    vine: a(0x5a8a32, 0.12, F), vineB: a(0x3f6e26, 0.12, F), grape: a(0x4a2a5a, 0.08, F),
    jacaranda: a(0x8f72d6, 0.1, F), jacarandaB: a(0x7a5ec4, 0.1, F), jacarandaL: a(0xa88ee6, 0.08, F),
    strelitzia: a(0xf08a1e, 0.05, F), strelitziaBlue: a(0x3a4ab8, 0.05, F), strelLeaf: a(0x4a7a52, 0.1, F),
    laurel: a(0x2a4a24, 0.12, F), laurelB: a(0x365c2c, 0.12, F), moss: a(0x5a7a3a, 0.14, F), hydrangea: a(0x7a9ae0, 0.1, F), agapanthus: a(0x5a6ad8, 0.1, F),
    levadaWater: a(0x6a9aa8, 0.04, { glass: true }), cable: a(0x2a2a2c, 0.02), cabin: a(0xd83a2a, 0.04), cabinGlass: a(0x9ab8c8, 0.04, { glass: true }),
  };
  // each plaster's weathered shades: the damp that rises from the street, the streaks the rain leaves under a sill
  const shade = (i: number, k: number, warm = 0) => {
    const f = (v: number, w: number) => Math.max(0, Math.min(255, Math.round(v * k + w)));
    return (f(b.pal.r[i], warm) << 16) | (f(b.pal.g[i], warm * 0.6) << 8) | f(b.pal.b[i], 0);
  };
  const walls = [...new Set(PASTELS(c))];
  const dirt = new Map(walls.map((i) => [i, a(shade(i, 0.84, -4), 0.07)] as const));
  const damp = new Map(walls.map((i) => [i, a(shade(i, 0.92, 2), 0.08)] as const));
  return { ...c, dirt, damp };
}

export type AC = ReturnType<typeof madeiraColors>;
/** A plain colour of the town (not one of the shade tables). */
type ACol = { [K in keyof AC]: AC[K] extends number ? K : never }[keyof AC];

// ------------------------------------------------------------------------------------------- props

/**
 * A lemon tree: a short gnarled trunk forking into three or four limbs, each carrying a lumpy clump of glossy
 * leaves, sunlit on top and dark underneath, with the big pointed Amalfi lemons studding the crown and hanging
 * under it. Everything is joined to the trunk: no leaf floats.
 */
function lemonTree(c: AC, seed: number, big = false): Prop {
  const r = rng(seed);
  const s = big ? 1.25 : 1;
  const W = Math.round(30 * s);
  const p = new Prop(W, W, W);
  const cx = W / 2, cz = W / 2;
  const fork = Math.round((5 + r() * 2) * s);
  let tx = Math.floor(cx) - 1, tz = Math.floor(cz) - 1;
  const lx = r() < 0.5 ? 1 : -1, lz = r() < 0.5 ? 1 : -1;
  for (let y = 0; y <= fork; y++) {
    if (y === Math.floor(fork * 0.6)) { tx += lx; if (r() < 0.5) tz += lz; }
    p.box(tx, y, tz, tx + 1, y, tz + 1, c.trunk);
  }
  const line = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
    const n = Math.ceil(Math.max(Math.abs(bx - ax), Math.abs(by - ay), Math.abs(bz - az)) * 2);
    for (let i = 0; i <= n; i++) { const t = i / n; p.set(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t, c.trunk); }
  };
  const clumps: [number, number, number, number, number][] = [];
  const limbs = 3 + (r() < 0.5 ? 1 : 0), a0 = r() * Math.PI * 2;
  for (let i = 0; i < limbs; i++) {
    const a = a0 + (i / limbs) * Math.PI * 2 + (r() - 0.5) * 0.7;
    const reach = (4.5 + r() * 2.5) * s, up = (5 + r() * 4) * s;
    const ex = cx + Math.cos(a) * reach, ez = cz + Math.sin(a) * reach, ey = fork + up;
    line(tx + 1, fork, tz + 1, ex, ey, ez);
    clumps.push([ex, ey + 1.5, ez, (4 + r() * 1.5) * s, (3.4 + r() * 1.2) * s]);
  }
  clumps.push([cx, fork + 9 * s, cz, 5.5 * s, 4.2 * s]);
  for (const [qx, qy, qz, rx, ry] of clumps)
    for (let y = Math.floor(qy - ry); y <= Math.ceil(qy + ry); y++)
      for (let z = Math.floor(qz - rx); z <= Math.ceil(qz + rx); z++)
        for (let x = Math.floor(qx - rx); x <= Math.ceil(qx + rx); x++) {
          const dx = (x + 0.5 - qx) / rx, dy = (y + 0.5 - qy) / ry, dz = (z + 0.5 - qz) / rx;
          // lumps of leaves three voxels across break up the outline
          const lump = hash3(Math.floor((x + seed) / 3), Math.floor(y / 3), Math.floor(z / 3));
          if (dx * dx + dy * dy + dz * dz > 1 - 0.3 * lump) continue;
          const n = hash3(x + seed, y, z), t = dy;
          p.set(x, y, z, t > 0.35 ? (n < 0.55 ? c.leafLight : c.leaf) : t < -0.35 ? (n < 0.6 ? c.leafDark : c.leaf) : n < 0.45 ? c.leaf : n < 0.75 ? c.leafDark : c.leafLight);
        }
  // lemons on the outside of the crown and hanging under it, one voxel each, now and then two for a long one
  const leafy = (v: number) => v === c.leaf || v === c.leafDark || v === c.leafLight;
  const fruit: [number, number, number, number][] = [];
  for (let y = 1; y < p.sy - 1; y++)
    for (let z = 1; z < p.sz - 1; z++)
      for (let x = 1; x < p.sx - 1; x++) {
        if (!leafy(p.get(x, y, z))) continue;
        const h = hash3(x * 3 + seed, y * 5, z * 7);
        if (!p.get(x, y - 1, z) && y > fork + 2) {
          if (h < 0.12) fruit.push([x, y - 1, z, c.lemon]);
          if (h < 0.025 && !p.get(x, y - 2, z)) fruit.push([x, y - 2, z, c.lemonDeep]);
        } else if (h < 0.05 && (!p.get(x + 1, y, z) || !p.get(x - 1, y, z) || !p.get(x, y, z + 1) || !p.get(x, y, z - 1))) fruit.push([x, y, z, h < 0.012 ? c.lemonDeep : c.lemon]);
      }
  for (const [x, y, z, v] of fruit) p.set(x, y, z, v);
  p.keepConnected(tx, 0, tz);
  p.sway(SWAY.bush, [cx, fork, cz], [0, 0, 0], (_x, y) => y >= fork);
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

function umbrella(c: AC, seed: number, pair?: [number, number]): Prop {
  const p = new Prop(17, 18, 17);
  const cols = pair ?? [[c.umbrellaA, c.umbrellaB], [c.umbrellaC, c.umbrellaB], [c.umbrellaD, c.umbrellaB], [c.umbrellaE, c.umbrellaB], [c.umbrellaA, c.umbrellaD]][seed % 5];
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

/** A kayak drawn up at the water's edge. */
function kayak(c: AC, seed: number): Prop {
  const col = [c.umbrellaD, c.hullRed, c.umbrellaE][seed % 3];
  const p = new Prop(5, 3, 24);
  for (let z = 0; z < 24; z++) {
    const half = Math.sin(Math.PI * (z + 0.5) / 24) * 2.6;
    for (let x = 0; x < 5; x++) if (Math.abs(x - 2) <= half) { p.set(x, 0, z, col); if (Math.abs(x - 2) > half - 1) p.set(x, 1, z, col); }
    if (z > 9 && z < 14) p.set(2, 1, z, c.iron);
  }
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

/**
 * The ferry to Positano and Salerno, 30 m long, tied up at the pier with its bow to the sea: red below the
 * waterline, a blue band and a row of portholes, a saloon deck with its windows and a promenade rail, a sun deck
 * above with benches and life-raft drums, the bridge forward, a funnel and a radar mast, and the stern ramp up.
 */
/**
 * The Santa Maria, Funchal's replica of Columbus's nao: a tarred hull with a high aftcastle and forecastle, three
 * masts, square sails with the red cross of the Order of Christ, pennants at the mastheads. Its length runs along x,
 * the bow at +x; the waterline sits 1 m over its base.
 */
function nao(c: AC): Prop {
  const L = 76, W = 17, cz = 8, p = new Prop(L, 74, W, 0.25);
  for (let x = 0; x < L; x++) {
    const u = x / (L - 1);
    // the beam swells amidships; the bow narrows to a stem, the stern stays broad and square
    const half = 7.6 * Math.min(1, Math.pow(Math.sin(Math.PI * Math.min(1, u * 0.9 + 0.1)), 0.45)) * (u > 0.85 ? 1 - (u - 0.85) * 3.2 : 1);
    const deck = 10 + (u < 0.22 ? 7 : 0) + (u > 0.84 ? 5 : 0) + Math.round(Math.abs(u - 0.5) * 4);
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - cz);
      for (let y = 0; y <= deck; y++) {
        const hw = half * Math.min(1, 0.45 + y / 9);
        if (dz > hw) continue;
        const shell = dz > hw - 1.1 || y === 0 || x === 0;
        const rail = y > deck - 2 && dz > hw - 1.1;
        if (!shell && y < deck - 1) continue;
        p.set(x, y, z, y === deck - 1 && !rail ? c.deckWood : y < 4 ? c.hullRed : y === 7 || y === deck - 2 ? c.ochre : y > deck - 2 ? c.trunk : c.door);
      }
    }
  }
  // the bowsprit
  for (let i = 0; i < 12; i++) p.set(Math.min(L - 1, 66 + i), 16 + (i >> 1), cz, c.trunk);
  // masts: main amidships, fore, and the mizzen with its lateen yard over the aftcastle
  const masts: [number, number, number][] = [[38, 62, 18], [57, 50, 14], [14, 48, 0]];
  for (const [mx, top, sail] of masts) {
    p.box(mx, 8, cz, mx, top, cz, c.trunk);
    p.box(mx - 1, top + 1, cz, mx + 1, top + 2, cz, c.trunk); // the top
    p.box(mx, top + 3, cz, mx + 3, top + 4, cz, c.hullRed); // pennant
    if (sail) {
      // a square sail bellied a little forward, the red cross on it
      const s0 = top - 6 - sail, s1 = top - 6, sw = sail >> 1;
      for (let y = s0; y <= s1; y++) for (let z = cz - sw; z <= cz + sw; z++) {
        const belly = Math.round(1.6 * Math.sin(Math.PI * (y - s0) / (s1 - s0)) * Math.cos((z - cz) / (sw + 1) * 1.4));
        const arm = Math.max(1, Math.round(sail / 9));
        const cross = (Math.abs(z - cz) <= arm && y > s0 + 1 && y < s1 - 1) || (Math.abs(y - (s0 + s1) / 2) <= arm && Math.abs(z - cz) < sw - 1);
        p.set(mx + 1 + belly, y, z, cross ? c.hullRed : c.whiteWarm);
      }
      p.box(mx, s1 + 1, cz - sw - 1, mx, s1 + 1, cz + sw + 1, c.trunk); // the yard
    } else {
      // the lateen: a triangle on a slanting yard
      for (let i = 0; i < 22; i++) {
        const y = 22 + i, x0 = mx - 10 + Math.round(i * 0.9);
        p.set(x0, y, cz, c.trunk);
        for (let x = x0 + 1; x <= mx + 8 - Math.round(i * 0.4) && x < L; x++) if (y < 22 + (x - x0) * 1.3) p.set(x, y, cz + 1, c.whiteWarm);
      }
    }
  }
  // shrouds down to the rails, a lantern on the stern
  // (each shroud a line of face-touching voxels from the rail up to the mast's top, so no rope floats in pieces)
  for (const [mx, top] of masts) for (const sz of [-1, 1]) {
    let pz = cz + sz * 6;
    for (let y = 12; y < top - 4; y++) {
      const z = cz + sz * Math.max(1, Math.round(6 - (5 * (y - 12)) / (top - 16)));
      while (pz !== z) { p.set(mx - 2, y, pz, c.rope); pz += Math.sign(z - pz); }
      p.set(mx - 2, y, z, c.rope);
    }
  }
  p.box(1, 23, cz, 1, 24, cz, c.lampGlowAlways);
  return p;
}

function ferry(c: AC): Prop {
  const L = 120, W = 36, cz = 17.5;
  const p = new Prop(L, 40, W, 0.25);
  const half = (x: number) => 17 * Math.min(1, Math.sin(Math.PI * Math.min(1, (x / (L - 1)) * 1.05 + 0.02)) ** 0.35);
  for (let x = 0; x < L; x++) {
    const h = half(x);
    // the sheer rises towards the bow
    const deck = 9 + (x > 96 ? Math.round((x - 96) / 8) : 0);
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - cz);
      if (dz > h) continue;
      const edge = dz > h - 1.2;
      for (let y = 0; y <= deck; y++) {
        let v = c.ferry;
        if (y < 3) v = c.hullRed;
        else if (y === 3) v = c.ferryBlue;
        else if (y === 6 && edge && x % 4 === 2 && x > 6 && x < L - 12) v = c.glass;
        else if (y === deck - 1) v = c.ferryBlue;
        else if (y === deck && !edge) v = c.deckWood;
        p.set(x, y, z, v);
      }
      // the promenade rail round the main deck: posts and a top rail, open between
      if (edge) {
        if (x % 3 === 0) p.set(x, deck + 1, z, c.white);
        p.set(x, deck + 2, z, c.white);
      }
    }
  }
  // the stern ramp, raised
  p.box(0, 10, 9, 1, 16, 26, (_x, y, z) => (y === 16 || z === 9 || z === 26 ? c.iron : y % 2 ? c.marbleGrey : c.plinth));
  // the saloon: a long row of windows, a door each side
  p.box(14, 10, 5, 92, 15, 30, c.ferry);
  p.box(14, 12, 5, 92, 14, 30, (x, _y, z) => (z === 5 || z === 30 || x === 14 || x === 92 ? (x % 4 === 0 ? c.ferry : c.glass) : c.ferry));
  p.box(14, 15, 5, 92, 15, 30, c.ferryBlue);
  for (const z of [5, 30]) p.box(40, 10, z, 41, 13, z, c.door);
  // the sun deck on its roof: planking, a rail, benches in rows, life-raft drums along the sides
  p.box(15, 16, 6, 91, 16, 29, c.deckWood);
  for (let x = 14; x <= 92; x++) for (const z of [5, 30]) { if (x % 3 === 0) p.set(x, 17, z, c.white); p.set(x, 18, z, c.white); }
  for (let z = 5; z <= 30; z++) for (const x of [14, 92]) { if (z % 3 === 0) p.set(x, 17, z, c.white); p.set(x, 18, z, c.white); }
  for (let x = 20; x <= 44; x += 4) for (const z of [9, 14, 21, 26]) p.box(x, 17, z, x + 1, 17, z + 1, c.crateBlue);
  for (let x = 24; x <= 60; x += 6) for (const z of [6, 29]) { p.box(x, 17, z, x + 2, 18, z, c.white); p.set(x + 1, 18, z, c.umbrellaA); }
  // lifebuoys on the promenade rail
  for (const x of [20, 56, 86]) for (const z of [Math.round(cz - half(x)), Math.round(cz + half(x))]) { p.set(x, 10, z, c.floatRed); p.set(x, 11, z, c.float); }
  // the funnel: white, a blue band and a yellow stripe, black at the top
  p.box(50, 17, 15, 56, 27, 20, (_x, y) => (y >= 27 ? c.iron : y === 23 ? c.hullYellow : y >= 22 ? c.ferryBlue : c.ferry));
  // the bridge forward, its windows looking over the bow, wings out to both sides
  p.box(70, 17, 9, 86, 22, 26, c.ferry);
  p.box(86, 19, 9, 86, 21, 26, c.glass);
  p.box(70, 19, 9, 86, 20, 9, (x) => (x % 3 ? c.glass : c.ferry));
  p.box(70, 19, 26, 86, 20, 26, (x) => (x % 3 ? c.glass : c.ferry));
  p.box(80, 18, 5, 86, 18, 30, c.ferry);
  p.box(70, 23, 9, 86, 23, 26, c.ferryBlue);
  // radar mast with a crossbar and a scanner
  p.box(76, 24, 17, 77, 33, 18, c.iron);
  p.box(76, 31, 13, 77, 31, 22, c.iron);
  p.box(74, 34, 17, 79, 34, 18, c.white);
  // the anchor in its pocket at the bow
  p.box(L - 14, 6, 3, L - 13, 8, 3, c.iron); p.box(L - 14, 6, W - 4, L - 13, 8, W - 4, c.iron);
  return p;
}

/** The grotta's door, shut: old chestnut planks with iron studs in a rough tufa surround. */
/**
 * The painted door: a basalt frame round two leaves painted with a woman among birds-of-paradise and hydrangeas,
 * one of the Zona Velha's doors made over by its artists. Open, the leaves swing in on warm light. Faces -z.
 */
function grottaDoor(c: AC, open: boolean): Prop {
  const p = new Prop(14, 22, 2);
  p.box(0, 0, 0, 13, 21, 1, (x, y) => (x <= 1 || x >= 12 || y >= 20 ? ((x + y) % 5 === 0 ? c.cantariaB : c.cantaria) : 0));
  if (!open) {
    for (let y = 0; y < 20; y++) for (let x = 2; x < 12; x++) {
      const u = x - 6.5, v = y - 11;
      const face = Math.hypot(u, (v - 3) * 0.9) < 2.2, hair = Math.hypot(u, v - 4.2) < 2.8 && v > 3;
      const flower = hash3(x, y, 21) < 0.16 && y < 9;
      const leaf = (y < 8 && (x === 3 || x === 10)) || (y < 5 && hash3(x, y, 22) < 0.3);
      p.set(x, y, 1, x === 6 || x === 7 ? (y % 6 === 0 ? c.brass : c.majolicaBlue) : face ? c.peach : hair ? c.door : flower ? (x < 6 ? c.strelitzia : c.hydrangea) : leaf ? c.strelLeaf : y > 15 ? c.majolicaYellow : c.majolicaBlue);
    }
    p.set(5, 9, 0, c.brass); p.set(8, 9, 0, c.brass);
  } else {
    for (let y = 0; y < 20; y++) for (let x = 2; x < 12; x++) p.set(x, y, 1, x < 4 ? c.majolicaBlue : y < 1 ? c.cotto : c.glassLit);
  }
  // a little azulejo tile with a fish over the door
  p.box(5, 20, 0, 8, 21, 0, c.azulejoW); p.box(6, 20, 0, 7, 20, 0, c.azulejo);
  return p;
}

/**
 * One of Rua de Santa Maria's painted doors (the Arte de Portas Abertas), as a painting laid on the door itself at
 * sixteen to the metre: a woman among flowers, the sea with a boat, a bird-of-paradise, azulejo diamonds,
 * hydrangeas, or a fish. Faces -z, 0.75 m by 2 m.
 */
function paintedDoor(c: AC, seed: number): Prop {
  const p = new Prop(12, 32, 1, 0.0625);
  const motif = seed % 6, h = (x: number, y: number, k: number) => hash3(x, y, seed * 7 + k);
  const bg = [c.majolicaBlue, c.majolicaYellow, c.white, c.azulejoW, c.hullGreen, c.ferryBlue][motif];
  for (let y = 0; y < 32; y++) for (let x = 0; x < 12; x++) {
    const u = x - 5.5;
    let v = bg;
    if (motif === 0) {
      const face = Math.hypot(u, (y - 20) * 0.9) < 2.4, hair = Math.hypot(u, y - 21.5) < 3.4 && y > 19;
      const body = Math.abs(u) < 3 - (y - 4) * 0.05 && y < 17 && y > 2;
      v = face ? c.peach : hair ? c.door : body ? c.hullRed : h(x, y, 1) < 0.2 ? (x < 6 ? c.strelitzia : c.hydrangea) : bg;
    } else if (motif === 1) {
      const wave = y < 10 + Math.round(Math.sin(x * 1.3) * 1.2);
      const hull = y >= 11 && y <= 13 && Math.abs(u) < 4 - (13 - y), sail = x >= 5 && x <= 8 && y > 13 && y < 22 && x - 5 < (22 - y) * 0.5;
      const sun = Math.hypot(x - 8.5, y - 26) < 2.4;
      v = sun ? c.white : hull ? c.hullRed : sail ? c.white : wave ? (y % 3 === 0 ? c.white : c.majolicaBlue) : bg;
    } else if (motif === 2) {
      const stem = Math.abs(x - (2 + y * 0.18)) < 0.8 && y < 20;
      const crest = y >= 18 && y <= 24 && x > 3 + (y - 18) * 0.4 && x < 10 && (y - 18) > (x - 9) * -1.2;
      const blue = y >= 21 && y <= 25 && x >= 3 && x <= 5;
      const leaf = Math.abs(u + 2 - y * 0.12) < 1.4 && y < 12 && x > 5;
      v = crest ? c.strelitzia : blue ? c.majolicaBlue : stem ? c.strelLeaf : leaf ? c.strelLeaf : bg;
    } else if (motif === 3) {
      const cx = ((x + 1) % 6) - 3, cy = ((y + 2) % 8) - 4;
      v = Math.abs(cx) + Math.abs(cy) * 0.75 < 2.2 ? c.azulejo : (x + y) % 6 === 0 ? c.majolicaYellow : bg;
    } else if (motif === 4) {
      const cl = [[3, 8], [8, 13], [4, 19], [8, 25]].some(([a, b]) => Math.hypot(x - a, y - b) < 2.6);
      v = cl ? (h(x, y, 2) < 0.5 ? c.hydrangea : c.jacaranda) : h(x, y, 3) < 0.08 ? c.white : bg;
    } else {
      const fish = Math.hypot(u * 0.9, (y - 16) * 0.42) < 3.6 || (Math.abs(u) < (y - 25) * 0.6 + 0.5 && y > 23 && y < 29);
      const eye = x === 6 && y === 12;
      v = eye ? c.door : fish ? ((x + y) % 3 === 0 ? c.cantaria : c.white) : h(x, y, 4) < 0.05 ? c.white : bg;
    }
    if (x === 0 || x === 11 || y === 31) v = c.door; // the leaf's own edge
    p.set(x, y, 0, v);
  }
  p.set(9, 15, 0, c.brass);
  return p;
}

function wallLantern(c: AC, allDay = false): Prop {
  const p = new Prop(3, 6, 4);
  p.box(1, 3, 0, 1, 3, 2, c.iron);
  p.box(0, 0, 1, 2, 2, 3, allDay ? c.lampGlowAlways : c.lampGlow);
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

/** A heap of fishing net drying on the quay, a line of floats along its edge. */
function netPile(c: AC, seed: number): Prop {
  const p = new Prop(12, 5, 9);
  const col = seed % 2 ? c.fishNet : c.fishNetB;
  p.ellipsoid(5.5, 0, 4, 5.5, 3.6, 4, (x, y, z) => (hash3(x + seed, y, z) < 0.12 ? (seed % 2 ? c.fishNetB : c.fishNet) : col));
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + seed; p.set(Math.round(5.5 + Math.cos(a) * 5), 0, Math.round(4 + Math.sin(a) * 3.6), i % 2 ? c.float : c.floatRed); }
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

/** The plan's walking surface under a point (metres): what a post, a pot or a bench stands on. */
function floorAt(plan: Plan, x: number, z: number): number {
  return (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
}

/** A height snapped down to the voxel layer it falls in (a post on a sloping flight stands on its tread). */
const layerY = (y: number) => Math.floor(y / V + 1e-6) * V;

export function buildMadeira(win?: Window): BuildResult {
  const b = new Builder(win);
  const g = b.grid;
  const c = madeiraColors(b);
  const plan = madeiraPlan();
  const [wx0, wz0, wx1, wz1] = win ?? [VX0, VZ0, VX0 + SX, VZ0 + SZ];
  const inWin = (x: number, z: number) => x >= wx0 && x < wx1 && z >= wz0 && z < wz1;

  terrain(b, c, plan, wx0, wz0, wx1, wz1);
  for (const lt of plan.lots) house(b, c, plan, lt);
  se(b, c);
  mercado(b, c);
  // the flower sellers' buckets along the tiles beside the market gate (the sellers themselves come with the people)
  for (const [x, z, i] of [[-3.35, 29.55, 0], [-3.35, 30.45, 1], [-3.35, 28.65, 2], [-2.6, 28.4, 3]]) { b.place(flowerBucket(c, 31 + i * 7), x, PIAZZA_Y, z); b.block(x - 0.35, z - 0.35, x + 0.35, z + 0.35); }
  fort(b, c);
  teleferico(b, c);
  largo(b, c, plan);
  ribeira(b, c, plan);
  marina(b, c, plan);
  shore(b, c, plan);
  gardens(b, c, plan, inWin);
  levada(b, c, plan);
  lanes(b, c, plan);
  laneDress(b, c, plan);
  const extras: Extra[] = [...marketFolk()];
  shopfronts(b, c, plan, extras);
  anglers(b, c, plan, extras);
  washingLines(b, c, plan);
  const stalls = foodStalls(b, c, plan);
  const eats = eateryAnchors(plan);
  stalls.push(...eats.stalls);
  const inns = hotelAnchors(plan);
  // the three azulejo tiles, on the ground where the plan says it is
  const groundY = (x: number, z: number) => (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
  const tiles = TILE_SPOTS.map(([x, z]) => [x, groundY(x, z), z] as [number, number, number]);
  for (const [x, y, z] of tiles) { b.place(azulejoCharm(c), x, y, z); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  const hidden = secretDoor(b, c, plan);

  const P = (x: number, z: number) => [x, z] as [number, number];
  const anchors: Anchors = {
    spawn: [6, 0, -27],
    stalls,
    // the secret kitchen is behind one of the painted doors of Rua de Santa Maria
    hiddenDoor: hidden,
    interiorExit: [0, 0], interiorSpawn: [0, 0, 0], chef: [0, 0, 0], counterStand: [0, 0],
    // three azulejo tiles tucked away around town open it
    manekis: tiles,
    graph: { nodes: plan.nodes.map(([x, z]) => P(x, z)), edges: plan.edges.map(([i, j]) => [i, j] as [number, number]) },
    idlers: [
      { id: 'avo', pos: [-6, 0, -16] },
      { id: 'pescador', pos: [38.5, 0, -58] },
      { id: 'levadeiro', pos: [-62, 0, 0] },
      { id: 'bordadeira', pos: [7.2, 0, 64] },
      { id: 'turista', pos: [18, 0, 30] },
      { id: 'padre', pos: [-8.5, 0, -24] },
    ],
    benches: b.benches,
    stools: b.stools, cafeTables: b.cafeTables,
    stepSeats: [],
    extras,
    cats: [[-2, 0, -20], [6.5, 0, 72], [38, 0, -30], [-14, 0, 28], [20, 0, -4]],
    emitters: b.emitters,
    // fireflies are rare on the island; a few over the vine pergolas on warm nights
    fireflies: fireflySpots(plan),
    vending: [],
    blockers: b.blockers,
    rooms: [...eats.rooms, ...inns.rooms],
    hotels: inns.hotels,
    darumas: [],
    secret: null,
    occluders: b.occluders,
    wires: b.wires,
    halls: b.halls,
    warm: [],
  };
  for (const id of anchors.idlers) id.pos[1] = 0;
  // the island at night is lit warm off the white walls and the pale calçada
  for (const l of b.lamps) { l.r *= 1.25; l.g *= 1.25; l.b *= 1.2; l.radius *= 1.12; }
  const interior = segredo(b, c, anchors);
  return {
    grid: g, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells,
    // houses are hollow on the ground floor: start their columns at the floor so nobody stands in the rooms
    // (a restaurant's room is walkable: its floor is the standing layer)
    navTop: (x, z) => { const id = plan.lot[col(x, z)]; return Math.min(g.sy - 8, plan.walk[col(x, z)] + (id ? (plan.lots[id - 1].food || plan.lots[id - 1].hotel ? 1 : 0) : 3)); },
    groundAt: (x, z) => {
      const ci = col(x, z);
      const kd = plan.kind[ci];
      return kd === K.Sea ? G : plan.walk[ci];
    },
  };
}

/** On the Largo looking at the Sé, on the promenade by the marina's boats, and among the fruit in the market. */
const TILE_SPOTS: [number, number][] = [[9, -33], [38.6, -52], [-10, 37]];

/** An azulejo tile on a little iron stand: blue and white, a passion flower in the middle. */
function azulejoCharm(c: AC): Prop {
  const p = new Prop(8, 12, 3);
  p.box(3, 0, 1, 4, 3, 1, c.iron);
  p.box(0, 4, 1, 7, 11, 1, (x, y) => {
    const u = x - 3.5, v = y - 7.5, r = Math.hypot(u, v);
    if (x === 0 || x === 7 || y === 4 || y === 11) return c.azulejo;
    return r < 1.2 ? c.majolicaYellow : r < 2.6 && (Math.abs(u) < 0.6 || Math.abs(v) < 0.6) ? c.azulejo : c.azulejoW;
  });
  p.box(1, 4, 2, 6, 4, 2, c.iron);
  return p;
}

/** The painted door on Rua de Santa Maria: the secret lot's own front door, hidden in plain sight among the others. */
function secretDoor(b: Builder, c: AC, plan: Plan): Anchors['hiddenDoor'] {
  const lt = plan.lots.find((l) => l.secret);
  if (!lt) return { stand: [0, 0], label: [0, 2, 0], reveal: [0, 3, 0] };
  const fr = lotFrame(lt, lt.side);
  // the door in the middle of the front, on the path's level
  const [dx, dz] = fr.P(fr.W / 2, 0);
  const [ox, oz] = fr.out;
  const y = (lt.door - G) * V;
  const turn = faceTurn(-ox, -oz);
  // the doorway through the front wall, the leaves set in it
  const a0 = Math.round(fr.W / 2) - 3;
  for (let a = a0; a < a0 + 7; a++) { const [vx, vz] = fr.at(a, 0); b.grid.box(vx, lt.door, vz, vx, lt.door + 10, vz, 0); }
  b.place(grottaDoor(c, false), dx - ox * 0.125, y, dz - oz * 0.125, turn, 'door-closed');
  b.place(grottaDoor(c, true), dx - ox * 0.125, y, dz - oz * 0.125, turn, 'door-open');
  b.place(wallLantern(c), dx + ox * 0.1 + fr.ax[0] * 1.4, y + 2.3, dz + oz * 0.1 + fr.ax[1] * 1.4, turn, 'door-open');
  { const [ax, az] = fr.ax, px = dx - ax * 0.9 + ox * 0.05, pz = dz - az * 0.9 + oz * 0.05, qx = dx + ax * 0.9 - ox * 0.6, qz = dz + az * 0.9 - oz * 0.6;
    b.block(Math.min(px, qx), Math.min(pz, qz), Math.max(px, qx), Math.max(pz, qz)); }
  return { stand: [dx + ox * 0.75, dz + oz * 0.75], label: [dx + ox * 0.2, 2.0, dz + oz * 0.2], reveal: [dx - ox * 1.5, y, dz - oz * 1.5] };
}

/** Material of a stone wall course (vertical faces of terraces, parapets, quays): dry basalt, or whitewashed. */
export function masonry(c: AC, x: number, y: number, z: number, white: boolean): number {
  if (white) return hash3(x >> 1, y >> 2, z >> 1) < 0.06 ? c.plasterOld : c.whiteWarm;
  const course = y >> 1, off = course & 1 ? 1 : 0;
  const bx = (x + off * 2) / 3 | 0, bz = (z + off * 2) / 3 | 0;
  if (((x + off * 2) % 3 === 0 || (z + off * 2) % 3 === 0) && (y & 1) === 0) return c.calBlack;
  const n = hash3(bx, course, bz);
  return n < 0.4 ? c.lava : n < 0.75 ? c.lavaB : n < 0.9 ? c.cantariaB : c.tuffBrown;
}

/**
 * The island's own rock: dark basalt flows a metre or two thick over beds of red and brown tuff, moss and ferns in
 * the damp seams.
 */
function cliffRock(c: AC, x: number, y: number, z: number): number {
  const n = hash3(x, y >> 1, z);
  if (n < 0.03) return c.moss;
  const bed = hash3(0, (y + ((x + z) >> 4)) >> 3, 11);
  return bed < 0.18 ? c.tuffRed : bed < 0.3 ? c.tuffBrown : n < 0.5 ? c.lava : c.lavaB;
}

/**
 * Calçada portuguesa: little cubes of white limestone and black basalt set in patterns. The promenade carries the
 * waves, the squares a star rosette in a field of white, the streets a black border.
 */
function calcada(c: AC, k: number, x: number, z: number): number {
  const mx = x * V, mz = z * V;
  if (k === K.Walk) {
    const w = Math.sin(mz * 0.9) * 1.1 + Math.sin(mz * 0.31) * 0.4;
    return Math.abs(((mx + w) % 2.2 + 2.2) % 2.2 - 1.1) < 0.36 ? c.calBlack : c.calWhite;
  }
  if (k === K.Piazza) {
    // a rosette every 6 m, joined by a lattice of black lines
    const u = ((mx % 6) + 6) % 6 - 3, v = ((mz % 6) + 6) % 6 - 3, r = Math.hypot(u, v), a = Math.atan2(v, u);
    if (r < 1.9 && Math.abs(Math.sin(a * 4)) * r < 0.5) return c.calBlack;
    if (r > 1.9 && r < 2.2) return c.calBlack;
    return Math.abs(u + v) < 0.13 || Math.abs(u - v) < 0.13 ? c.calBlack : c.calWhite;
  }
  return hash3(x, 4, z) < 0.5 ? c.calWhite : c.slab;
}

function terrain(b: Builder, c: AC, plan: Plan, wx0: number, wz0: number, wx1: number, wz1: number): void {
  const g = b.grid;
  // whole bricks under the lowest ground of each 8 x 8 column are bedrock
  for (let bz = wz0; bz < wz1; bz += 8)
    for (let bx = wx0; bx < wx1; bx += 8) {
      let lo = 255;
      for (let z = bz; z < bz + 8; z++) for (let x = bx; x < bx + 8; x++) lo = Math.min(lo, plan.walk[col(x, z)]);
      const full = (lo - 4) & ~7;
      if (full > 0) g.box(bx, 0, bz, bx + 7, full - 1, bz + 7, c.lava);
    }
  const inMap = (x: number, z: number) => x >= VX0 && z >= VZ0 && x < VX0 + SX && z < VZ0 + SZ;
  for (let z = wz0; z < wz1; z++)
    for (let x = wx0; x < wx1; x++) {
      const ci = col(x, z), w = plan.walk[ci], kd = plan.kind[ci];
      const y0 = Math.max(0, ((w - 4) & ~7) - 8);
      const mx = x * V, mz = z * V;
      // natural rock (the slopes above the town and the shore) or a built wall in town?
      const wild = kd === K.Rock && wildRock(x, z, w);
      const white = !wild && (hash3(x >> 4, 3, z >> 4) < 0.35) && w < layerOf(20);
      // a wall beside the channel is always basalt
      let byChan = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (inMap(x + dx, z + dz) && plan.chan[col(x + dx, z + dz)]) byChan = true;
      const wallW = white && !byChan;
      g.box(x, y0, z, x, w - 1, z, (xx, y, zz) => {
        const d = w - 1 - y;
        switch (kd) {
          case K.Sea: return d === 0 ? (hash3(xx, y, zz) < 0.5 ? c.pebbleDark : c.seaRock) : c.seaRock;
          case K.Shingle: case K.Sand: return d < 2 ? [c.calBlack, c.pebbleDark, c.lava, c.pebble][Math.floor(hash3(xx, y, zz) * 4)] : c.pebbleDark;
          case K.Channel: return d === 0 ? (hash3(xx, 6, zz) < 0.3 ? c.pebble : hash3(xx, 7, zz) < 0.5 ? c.lava : c.pebbleDark) : c.lava;
          case K.Quay: case K.Pier:
            if (d === 0) return (xx + zz) % 6 === 0 ? c.quay : c.quayTop;
            return y < G - 1 ? (y < G - 3 ? c.algae : c.wet) : masonry(c, xx, y, zz, false);
          case K.Road:
            if (d === 0) {
              const zl = Math.abs(mz % 6);
              return Math.abs(mx - (ROAD_X0 + ROAD_X1) / 2) < 0.13 && zl < 3 ? c.roadLine : c.asphalt;
            }
            return masonry(c, xx, y, zz, false);
          case K.Walk: return d === 0 ? calcada(c, K.Walk, xx, zz) : masonry(c, xx, y, zz, false);
          case K.Piazza: case K.Church: return d === 0 ? calcada(c, K.Piazza, xx, zz) : masonry(c, xx, y, zz, false);
          case K.Garden: {
            if (d > 0) return masonry(c, xx, y, zz, false);
            // beds of flowers round lawns, a calçada walk through them
            const u = mx - JARDIM[0], v = mz - JARDIM[1];
            const path = Math.abs(v - 7 - Math.sin(u * 0.4) * 1.5) < 1.2 || Math.abs(u - 4.5 - Math.sin(v * 0.3)) < 1;
            if (path) return calcada(c, K.Street, xx, zz);
            const n = hash3(xx, 9, zz);
            return n < 0.7 ? c.grass : n < 0.85 ? c.herb : c.soil;
          }
          case K.Steps: return d === 0 ? c.stepStone : d === 1 ? c.stepEdge : c.marbleGrey;
          case K.Street: case K.Covered:
            if (d === 0) return calcada(c, K.Street, xx, zz);
            return masonry(c, xx, y, zz, wallW);
          case K.Stair: return d === 0 ? (hash3(xx, 5, zz) < 0.2 ? c.cantariaB : c.stepStone) : d === 1 ? c.cantaria : masonry(c, xx, y, zz, wallW);
          case K.Lane: return d === 0 ? (hash3(xx >> 1, 6, zz >> 1) < 0.5 ? c.cobble : c.cobbleB) : masonry(c, xx, y, zz, wallW);
          case K.Lot: return masonry(c, xx, y, zz, false);
          default: {
            // (by the sea the rock is bare black basalt, a tuft of sea fennel here and there; up the hill it greens)
            if (wild && mx > ROAD_X0) return d === 0 && hash3(xx, 4, zz) < 0.08 ? c.grassDry : d === 0 ? (hash3(xx, 5, zz) < 0.5 ? c.lava : c.lavaB) : cliffRock(c, xx, y, zz);
            if (wild) return d === 0 ? [c.grassDry, c.herb, c.moss][Math.floor(hash3(xx, y >> 1, zz) * 2.5)] : cliffRock(c, xx, y, zz);
            if (d === 0) { const n = hash3(xx, 9, zz); return n < 0.55 ? c.grass : n < 0.8 ? c.herb : c.soil; }
            if (d === 1) return c.soil;
            return masonry(c, xx, y, zz, wallW);
          }
        }
      });
      // a bridge over the channel: an arch of basalt springs from wall to wall under the path
      if (plan.chan[ci] && kd !== K.Channel) {
        const bed = layerOf(bedY(mx));
        const t = Math.min(1, Math.abs(mz - ribZ(mx)) / RIB_HALF);
        const crown = Math.max(bed, w - 4 - Math.round((1 - Math.sqrt(Math.max(0, 1 - t * t))) * (w - 4 - bed)));
        if (crown > bed) {
          g.box(x, bed, z, x, crown - 1, z, 0);
          g.box(x, Math.max(0, bed - 2), z, x, bed - 1, z, c.lava);
          g.set(x, crown, z, c.cantaria);
          for (let y = crown + 1; y < w; y++) if (!g.get(x, y, z)) g.set(x, y, z, c.lava);
        }
      }
      // a natural face is rock all the way down, not the plain bedrock behind it
      if (wild || kd === K.Rock && mx > PROM_X1) {
        let lo = w;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (!inMap(nx, nz)) { lo = 0; continue; }
          lo = Math.min(lo, plan.walk[col(nx, nz)]);
        }
        if (lo < y0) g.box(x, Math.max(0, lo - 2), z, x, y0 - 1, z, (xx, y, zz) => cliffRock(c, xx, y, zz));
      }
      // a parapet along every path where the ground falls away beside it, and round the channel
      const parapetKind = isPath(kd) && kd !== K.Sand && kd !== K.Quay && kd !== K.Pier || kd === K.Garden || (kd === K.Rock && !wild);
      if (parapetKind) {
        let drop = false, chanDrop = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (!inMap(nx, nz)) continue;
          const nc = col(nx, nz), nk = plan.kind[nc];
          if (nk === K.Channel) { if (plan.walk[nc] < w - 2) chanDrop = true; continue; }
          if (!isPath(kd) && kd !== K.Garden) continue;
          if (isPath(nk) || nk === K.Lot || nk === K.Church || nk === K.Garden) continue;
          if (plan.walk[nc] < w - 3) drop = true;
        }
        if (chanDrop) {
          // the ribeira's parapet: whitewashed, a basalt coping, and every few metres a box of flowers on it
          const box = ((mx + mz * 0.3) % 5 + 5) % 5 < 1.6;
          g.box(x, w, z, x, w + 3, z, (xx, y, zz) => (y === w + 3 ? c.cantaria : masonry(c, xx, y, zz, true)));
          if (box) g.box(x, w + 4, z, x, w + 4, z, hash3(x, w, z) < 0.5 ? c.bougain : hash3(x, w, z) < 0.75 ? c.geranium : c.leaf);
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        } else if (drop) {
          g.box(x, w, z, x, w + 3, z, (xx, y, zz) => (y === w + 3 ? c.cantaria : masonry(c, xx, y, zz, true)));
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        }
      }
    }
}

type PastelKey = 'white' | 'whiteWarm' | 'cream' | 'yellow' | 'lemonWall' | 'ochre' | 'peach' | 'pink' | 'rose' | 'terracotta' | 'sky' | 'sage' | 'plasterOld';
/** Funchal is a white town: most houses whitewashed, the rest in ochre, cream and the odd pink or yellow. */
const PASTELS = (c: Record<PastelKey, number>) => [c.white, c.white, c.white, c.white, c.whiteWarm, c.whiteWarm, c.whiteWarm, c.cream, c.yellow, c.ochre, c.ochre, c.peach, c.pink, c.plasterOld];

/**
 * The ground-floor room of a house, hollow so that a house cut away in front of the player opens like a dollhouse
 * onto a majolica floor, a table and a dresser instead of a slab of solid stucco. Upstairs stays solid: the cut
 * never reaches it.
 */
function room(b: Builder, c: AC, lt: LotPlan): void {
  const g = b.grid;
  const { x0, z0, x1, z1, base } = lt;
  g.box(x0 + 1, base + 1, z0 + 1, x1 - 1, base + 10, z1 - 1, 0);
  // lit softly from within, and its contents drawn only near the player
  b.indoor.push([x0 + 1, base + 1, z0 + 1, x1 - 1, base + 10, z1 - 1]);
  // Vietri tiles: a motif every four voxels, in one of the coast's three colourways
  const ways = [
    [c.majolicaYellow, c.majolicaBlue, c.majolicaWhite],
    [c.majolicaGreen, c.majolicaYellow, c.majolicaWhite],
    [c.majolicaBlue, c.majolicaWhite, c.majolicaYellow],
  ];
  const [mid, corner, field] = ways[Math.floor(hash3(x0, base, z0) * ways.length)];
  g.box(x0 + 1, base, z0 + 1, x1 - 1, base, z1 - 1, (x, _y, z) => {
    const u = (x - x0) & 3, v = (z - z0) & 3;
    return (u === 1 || u === 2) && (v === 1 || v === 2) ? mid : u === 0 && v === 0 ? corner : field;
  });
  // a dark wooden table in the middle with a cloth runner, a dresser against the back wall, a plant in a pot;
  // all below the cut, so they stand whole when the house is cut away
  const cx = Math.floor((x0 + x1) / 2) - 1, cz = Math.floor((z0 + z1) / 2) - 1;
  for (const [lx, lz] of [[cx, cz], [cx + 3, cz], [cx, cz + 3], [cx + 3, cz + 3]]) g.set(lx, base + 1, lz, c.door);
  g.box(cx, base + 2, cz, cx + 3, base + 2, cz + 3, c.door);
  g.box(cx + 1, base + 2, cz, cx + 2, base + 2, cz + 3, c.white);
  const along = x1 - x0 >= z1 - z0;
  if (along) g.box(x0 + 2, base + 1, z0 + 1, Math.min(x1 - 2, x0 + 6), base + 2, z0 + 2, (_x, y) => (y === base + 2 ? c.sill : c.shutterBrown));
  else g.box(x0 + 1, base + 1, z0 + 2, x0 + 2, base + 2, Math.min(z1 - 2, z0 + 6), (_x, y) => (y === base + 2 ? c.sill : c.shutterBrown));
  g.set(x1 - 2, base + 1, z1 - 2, c.terracotta);
  g.set(x1 - 2, base + 2, z1 - 2, c.leaf);
  // after dark most rooms have a lamp on
  if (hash3(x0, base, z1) < 0.7) b.lamp((x0 + x1 + 1) / 2 * V, (base - G) * V + 2.2, (z0 + z1 + 1) / 2 * V, WARM, 3.2, 0.6);
}

/** Whether a lot stands over a covered passage or the road tunnel. */
function overPassage(plan: Plan, lt: LotPlan): boolean {
  for (let z = lt.z0; z <= lt.z1; z++)
    for (let x = lt.x0; x <= lt.x1; x++) { const k = plan.kind[col(x, z)]; if (k === K.Covered || k === K.Tunnel) return true; }
  return false;
}

/** One Amalfi house: stucco cube on its terrace, shuttered windows, balconies, and a vault, dome or terrace on top. */
/** One Funchal house; `ground` stands in for the plan outside the map (the villages on the slopes, world/amalfiFar.ts). */
export function house(b: Builder, c: AC, plan: Plan | null, lt: LotPlan, ground?: (x: number, z: number) => number): void {
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
  if (lt.hotel && plan) hotelHouse(b, c, plan, lt);
  else if (lt.food) eatery(b, c, lt);
  // (a house built over a covered passage keeps its ground floor solid: the passage is carved through it, and a
  // hollow room there would open onto the vault, tiles, table and all)
  else if (x1 - x0 >= 7 && z1 - z0 >= 7 && top - base >= 14 && !(plan && overPassage(plan, lt))) room(b, c, lt);
  // a cornice under the roof, flush; the finish below picks out the rest
  g.box(x0, top - 1, z0, x1, top - 1, z1, trim);
  // what stands outside a facade cell: the ground level and whether a neighbour's wall is there
  const outside = ground ?? ((x: number, z: number): number => {
    if (!plan || x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) return 255;
    const ci = col(x, z), id = plan.lot[ci];
    if (id) return plan.lots[id - 1].top;
    if (plan.kind[ci] === K.Church) return 255;
    return plan.walk[ci];
  });
  const faces: { side: 'n' | 's' | 'e' | 'w'; n: number; at: (a: number) => [number, number]; out: (a: number) => [number, number] }[] = [
    { side: 'n', n: x1 - x0 + 1, at: (a) => [x0 + a, z0], out: (a) => [x0 + a, z0 - 1] },
    { side: 's', n: x1 - x0 + 1, at: (a) => [x1 - a, z1], out: (a) => [x1 - a, z1 + 1] },
    { side: 'w', n: z1 - z0 + 1, at: (a) => [x0, z1 - a], out: (a) => [x0 - 1, z1 - a] },
    { side: 'e', n: z1 - z0 + 1, at: (a) => [x1, z0 + a], out: (a) => [x1 + 1, z0 + a] },
  ];
  const floors = Math.floor((top - base) / 12);
  // a hotel's guest rooms open their own French windows on the view
  const view = lt.hotel && plan ? viewSide(plan, lt) : null;
  // this house's own finish, hashed from its seed so the lot's rng (and the roof, chimney and climbers drawn
  // from it below) stays as it was
  const H = (k: number) => hash3(lt.seed, 41, k);
  const pale = wall === c.white || wall === c.whiteWarm || wall === c.cream;
  // Funchal frames its windows and doors in dark basalt (cantaria), the corners of the house too
  const frameC = H(1) < 0.75 ? c.cantaria : pale ? c.ochre : c.white;
  const framed = H(2) < 0.9; // stucco surrounds round the windows
  const hoods = H(3) < 0.4; // a little cornice over each upstairs window
  const bands = trim !== wall && H(4) < 0.55; // a string course at every floor
  const pilasters = H(5) < 0.7; // basalt quoins at the corners
  const dado = H(6) < 0.4; // a darker painted base
  const corniced = H(7) < 0.75; // the roof cornice stands out from the wall
  const dirt = c.dirt.get(wall) ?? c.plasterOld, damp = c.damp.get(wall) ?? c.plasterOld;
  const isWall = (x: number, y: number, z: number) => g.get(x, y, z) === wall;
  const paint = (x: number, y: number, z: number, v: number) => { if (g.get(x, y, z) === wall) g.set(x, y, z, v); };
  const stick = (x: number, y: number, z: number, v: number) => { if (!g.get(x, y, z)) g.set(x, y, z, v); };
  // a cell out from the wall at height y is above head height over whatever is walked on there
  const overhead = (x: number, z: number, y: number) => outside(x, z) + 9 < y;
  for (const f of faces) {
    const front = f.side === lt.side;
    const [fx0, fz0] = f.at(0), [ox0, oz0] = f.out(0);
    const nx = ox0 - fx0, nz = oz0 - fz0;
    // the door, on the level of the path in front, keeps its bay clear of windows
    const dl = lt.door, da = Math.floor(f.n / 2) - 1;
    const shopLevel = front && lt.shop && Math.abs(dl - base) <= 2;
    const own = front && !lt.food && !lt.hotel && !lt.secret && dl >= base && dl <= top - 10;
    const shopFront = own && shopLevel, door = own && !shopLevel;
    // window bays: 3 voxels of glass in a stucco frame, a louvred shutter folded back either side
    const bays: number[] = [];
    for (let a = 3; a + 4 < f.n; a += 7 + (lt.seed % 2)) bays.push(a);
    for (let fl = 0; fl < floors; fl++) {
      const yb = base + fl * 12;
      if (view === f.side && fl >= 1 && fl <= (lt.guestFloors ?? 0)) continue;
      for (const a of bays) {
        const [ox, oz] = f.out(a + 1);
        const ground = outside(ox, oz);
        if (ground > yb + 3) continue; // buried in the hill or against the neighbour
        if (plan && ox >= VX0 && oz >= VZ0 && ox < VX0 + SX && oz < VZ0 + SZ && plan.kind[col(ox, oz)] === K.Covered) continue; // onto a covered passage: its vault and the house over it
        const [wx, wz] = f.at(a);
        const groundFloor = fl === 0 || ground > yb - 6;
        // shops on the piazza and the main street open arches at street level instead
        if (fl === 0 && shopLevel) continue;
        const sy0 = yb + 3, sy1 = yb + 8;
        if (door && a + 4 >= da - 1 && a - 2 <= da + 3 && sy1 + 2 >= dl && sy0 - 1 <= dl + 10) continue;
        const pane = hash3(wx, yb, wz) < 0.35 ? c.glassLit : c.glass;
        const closed = hash3(wx, yb + 1, wz) < 0.25;
        const grate = groundFloor && hash3(wx, yb, 81) < 0.55;
        // the glass sits in the thickness of the wall, so the reveal throws its shadow; closed shutters are flush
        for (let u = a; u <= a + 2; u++) {
          const [px, pz] = f.at(u);
          for (let y = sy0; y <= sy1; y++) {
            if (closed) { g.set(px, y, pz, y % 2 ? shutter : c.shutterDeep); continue; }
            if (g.get(px - nx, y, pz - nz) === wall) {
              g.set(px - nx, y, pz - nz, pane);
              g.set(px, y, pz, grate && (u === a + 1 || y === sy0 + 1 || y === sy1 - 1) ? c.iron : 0);
            } else g.set(px, y, pz, pane);
          }
        }
        if (framed) {
          for (const u of [a - 1, a + 3]) { const [px, pz] = f.at(u); for (let y = sy0; y <= sy1 + 1; y++) paint(px, y, pz, frameC); }
          for (let u = a; u <= a + 2; u++) { const [px, pz] = f.at(u); paint(px, sy1 + 1, pz, frameC); }
        }
        // persiane: louvred shutters, open, folded back beside the frame; upstairs they stand a little off the wall
        if (!closed) {
          const out = !groundFloor && ground + 9 < sy0 && hash3(wx, yb, 83) < 0.65;
          for (const u of framed ? [a - 2, a + 4] : [a - 1, a + 3]) {
            const [px, pz] = f.at(u);
            for (let y = sy0; y <= sy1; y++) {
              const v = (y - sy0) % 2 ? shutter : c.shutterDeep;
              if (out && !g.get(px + nx, y, pz + nz) && overhead(px + nx, pz + nz, sy0)) g.set(px + nx, y, pz + nz, v);
              else paint(px, y, pz, v);
            }
          }
        }
        // sill, and on upper floors sometimes a little balcony with a rail and geraniums
        const [o0x, o0z] = f.out(a), [o2x, o2z] = f.out(a + 2);
        let balcony = false;
        if (!groundFloor && ground + 10 < yb && hash3(wx, yb, 77) < 0.35) {
          balcony = true;
          const [bx0, bz0] = f.out(a - 1), [bx1, bz1] = f.out(a + 3);
          g.box(Math.min(bx0, bx1), yb + 2, Math.min(bz0, bz1), Math.max(bx0, bx1), yb + 2, Math.max(bz0, bz1), c.sill);
          // the slab sits on two little stone brackets
          for (const i of [-1, 3]) { const [px, pz] = f.out(a + i); if (overhead(px, pz, yb + 1)) stick(px, yb + 1, pz, c.sill); }
          for (let i = -1; i <= 3; i++) { const [px, pz] = f.out(a + i); g.box(px, yb + 3, pz, px, yb + 5, pz, i % 2 === 0 ? c.iron : 0); g.set(px, yb + 6, pz, c.iron); }
          if (hash3(wx, yb, 78) < 0.6) for (let i = -1; i <= 3; i += 2) { const [px, pz] = f.out(a + i); g.set(px, yb + 3, pz, hash3(px, yb, pz) < 0.5 ? c.geranium : c.leaf); }
          // a balcony door instead of a window
          for (let u = a; u <= a + 2; u++) {
            const [px, pz] = f.at(u);
            for (let y = yb + 1; y <= yb + 2; y++) {
              if (!closed && g.get(px - nx, y, pz - nz) === wall) { g.set(px - nx, y, pz - nz, pane); g.set(px, y, pz, 0); } else g.set(px, y, pz, c.glass);
            }
          }
        } else if (ground + 2 < sy0) {
          g.box(Math.min(o0x, o2x), sy0 - 1, Math.min(o0z, o2z), Math.max(o0x, o2x), sy0 - 1, Math.max(o0z, o2z), trim);
          // upstairs the sill runs on under the frame
          if (framed && !groundFloor) for (const u of [a - 1, a + 3]) { const [px, pz] = f.out(u); if (overhead(px, pz, sy0 - 1)) stick(px, sy0 - 1, pz, trim); }
          if (!groundFloor && hash3(wx, yb, 79) < 0.3) {
            const [p0x, p0z] = f.out(a), [p2x, p2z] = f.out(a + 2);
            g.box(Math.min(p0x, p2x), sy0, Math.min(p0z, p2z), Math.max(p0x, p2x), sy0, Math.max(p0z, p2z), (x, y, z) => (hash3(x, y, z) < 0.5 ? c.geranium : c.leafLight));
          }
          // the rain has run off the sill and down the plaster
          const st = hash3(wx, yb, 84);
          if (st < 0.4) {
            const [px, pz] = f.at(a + 1 + (st < 0.12 ? -1 : 0));
            const len = 2 + Math.floor(st * 10);
            for (let y = sy0 - 2; y >= Math.max(yb + 1, sy0 - 1 - len); y--) paint(px, y, pz, dirt);
          }
        }
        // a hood moulding over the upstairs windows
        if (hoods && !groundFloor) for (let u = a - 1; u <= a + 3; u++) { const [px, pz] = f.out(u); if (overhead(px, pz, sy1 + 2)) stick(px, sy1 + 2, pz, trim); }
        // on the sides and backs, now and then an air conditioner under a window, its drip stain below
        if (!front && !groundFloor && !balcony && ground + 10 < sy0 - 4 && hash3(wx, yb, 85) < 0.16) {
          let free = true;
          for (let u = a; u <= a + 2 && free; u++) { const [px, pz] = f.out(u); if (!overhead(px, pz, sy0 - 4)) free = false; for (let y = sy0 - 4; y <= sy0 - 3; y++) if (g.get(px, y, pz)) free = false; }
          if (free) {
            for (let u = a; u <= a + 2; u++) { const [px, pz] = f.out(u); g.set(px, sy0 - 4, pz, c.acWhite); g.set(px, sy0 - 3, pz, u === a + 1 ? c.acGrille : c.acWhite); }
            const [px, pz] = f.at(a + 2);
            for (let y = sy0 - 5; y >= sy0 - 8; y--) paint(px, y, pz, dirt);
          }
        }
      }
    }
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
    }
    // the shop's name on a majolica panel over its arches, the coast's painted tiles
    if (shopFront && dl <= top - 14 && f.n >= 10) {
      const sy = dl + 11;
      for (let a = 2; a <= f.n - 3; a++) {
        const [px, pz] = f.at(a);
        for (let y = sy; y <= sy + 2; y++) {
          const end = a === 2 || a === f.n - 3;
          const v = end ? c.majolicaYellow : y !== sy + 1 ? c.majolicaBlue : a > 3 && a < f.n - 4 && hash3(a, y, lt.seed) < 0.55 ? c.majolicaBlue : c.majolicaWhite;
          paint(px, y, pz, v);
        }
      }
    }
    // a string course at each floor, painted corner pilasters
    if (bands) for (let fl = 1; fl < floors; fl++) for (let a = 0; a < f.n; a++) { const [px, pz] = f.at(a); paint(px, base + fl * 12, pz, trim); }
    if (pilasters && f.n >= 10) for (const a of [0, 1, f.n - 2, f.n - 1]) { const [px, pz] = f.at(a); for (let y = base + 2; y < top - 1; y++) if ((a === 0 || a === f.n - 1) || ((y - base) >> 1) % 2 === 0) paint(px, y, pz, c.cantaria); }
    // the cornice stands a voxel proud of the wall, with a row of dentils under it, wherever it is open to the sky
    if (corniced) for (let a = 0; a < f.n; a++) {
      const [px, pz] = f.out(a);
      if (!overhead(px, pz, top - 2)) continue;
      stick(px, top - 1, pz, trim);
      if (a % 2 === 0) stick(px, top - 2, pz, trim);
    }
    // the street end of the wall: a painted dado, or the damp creeping up from the paving
    for (let a = 0; a < f.n; a++) {
      const [px, pz] = f.at(a), [qx, qz] = f.out(a);
      const gl = outside(qx, qz);
      if (gl > base + 2) continue;
      const y0 = Math.max(base + 2, gl);
      if (dado) {
        for (let y = y0; y <= base + 4; y++) paint(px, y, pz, y === base + 4 ? trim : dirt);
      } else {
        const wave = Math.sin(a * 0.55 + lt.seed) + Math.sin(a * 0.21 + lt.seed * 0.3);
        const h = Math.max(0, Math.round(1.2 + wave * 1.3));
        for (let y = y0; y < y0 + h; y++) paint(px, y, pz, damp);
      }
    }
    // rain streaks down from the cornice, and patches where the plaster has fallen to show the tufa underneath
    for (let a = 1; a < f.n - 1; a++) {
      const [px, pz] = f.at(a);
      const h = hash3(px, top, pz + 7);
      if (h < 0.07) for (let y = top - 2; y >= top - 3 - Math.floor(h * 100); y--) paint(px, y, pz, dirt);
    }
    const patches = Math.floor(H(10 + faces.indexOf(f)) * 3.4);
    for (let i = 0; i < patches && f.n > 8 && top - base > 10; i++) {
      const ha = hash3(lt.seed, i, 50 + faces.indexOf(f)), hy = hash3(lt.seed, i, 60 + faces.indexOf(f));
      const pa = 1 + Math.floor(ha * (f.n - 6)), py = base + 3 + Math.floor(hy * hy * (top - base - 8));
      const pw = 3 + Math.floor(ha * 7) % 3, ph = 2 + Math.floor(hy * 5) % 2;
      for (let u = 0; u < pw; u++) for (let v = 0; v < ph; v++) {
        if ((u === 0 || u === pw - 1) && (v === 0 || v === ph - 1)) continue; // ragged corners
        const [px, pz] = f.at(pa + u);
        paint(px, py + v, pz, ((u + (v & 1) * 2) % 4 === 3) ? c.mortar : (v & 1) ? c.tufaDark : c.tufa);
      }
    }
    if (!door) continue;
    // the front door: two-panelled leaves under a fanlight, in a frame of grey piperno stone with a keystone,
    // the house number on a majolica tile beside it and a brass knocker
    const doorC = r() < 0.5 ? c.door : c.doorGreen;
    const [dx0, dz0] = f.at(da), [dx1, dz1] = f.at(da + 2);
    // on Rua de Santa Maria every door is a painting (the Arte de Portas Abertas): flowers, faces, birds, a sea
    const cxm = (lt.x0 + lt.x1) / 2 * V, czm = (lt.z0 + lt.z1) / 2 * V;
    const painted = cxm > 1 && cxm < 17 && czm > 36;
    const art = [c.majolicaBlue, c.strelitzia, c.hydrangea, c.majolicaYellow, c.hullRed, c.hullGreen, c.jacaranda, c.white];
    const base0 = art[Math.floor(H(40) * art.length)];
    g.box(Math.min(dx0, dx1), dl, Math.min(dz0, dz1), Math.max(dx0, dx1), dl + 8, Math.max(dz0, dz1), (x, y, z) => (y === dl + 8 ? (hash3(lt.seed, 3, 9) < 0.5 ? c.glassLit : c.glass)
      : painted ? (hash3(x + z, y, lt.seed) < 0.3 ? art[Math.floor(hash3(x, y, z + lt.seed) * art.length)] : base0)
      : y === dl + 3 || y === dl + 6 ? c.keel : doorC));
    { const [kx, kz] = f.at(da + 1); g.set(kx, dl + 5, kz, c.brass); }
    if (painted) {
      // the painting itself, laid on the outside of the leaves
      const [ax, az] = f.at(da + 1), [bx, bz] = f.out(da + 1), ox = bx - ax, oz = bz - az;
      b.place(paintedDoor(c, Math.floor(H(41) * 600)), (ax + 0.5 + ox * 0.5) * V + ox * 0.032, (dl - G) * V, (az + 0.5 + oz * 0.5) * V + oz * 0.032, faceTurn(-ox, -oz));
    }
    const stone = (x: number, y: number, z: number) => { const v = g.get(x, y, z); if (v === wall || v === c.plinth || v === trim || v === dirt || v === damp) g.set(x, y, z, c.piperno); };
    for (const u of [da - 1, da + 3]) { const [px, pz] = f.at(u); for (let y = dl; y <= dl + 9; y++) stone(px, y, pz); }
    for (let u = da; u <= da + 2; u++) { const [px, pz] = f.at(u); stone(px, dl + 9, pz); }
    { const [px, pz] = f.at(da + 1); stone(px, dl + 10, pz); }
    { const [px, pz] = f.at(da + 4); if (isWall(px, dl + 6, pz) || g.get(px, dl + 6, pz) === trim) { g.set(px, dl + 6, pz, c.majolicaBlue); g.set(px, dl + 7, pz, c.majolicaYellow); } }
  }
  // the roof
  const w = x1 - x0 + 1, d = z1 - z0 + 1;
  if (roof < -1) {
    // white barrel vault across the short side, the signature roof of the coast
    const alongX = w >= d;
    const span = alongX ? d : w;
    const rad = span / 2;
    g.box(x0, top, z0, x1, top + Math.ceil(rad * 0.55), z1, (x, y, z) => {
      const u = alongX ? z - z0 + 0.5 : x - x0 + 0.5;
      const hgt = Math.sqrt(Math.max(0, rad * rad - (u - rad) ** 2)) * 0.55;
      return y - top < hgt ? c.roofWhite : 0;
    });
  } else if (roof < -1 && w >= 12 && d >= 12) {
    // a small dome on a flat roof
    const cx = (x0 + x1 + 1) / 2, cz = (z0 + z1 + 1) / 2, rr = Math.min(w, d) / 2 - 1.5;
    g.box(x0, top, z0, x1, top, z1, c.terraceTile);
    for (let y = 0; y <= rr; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const dd = Math.hypot(x + 0.5 - cx, z + 0.5 - cz, y * 1.1);
      if (dd <= rr) g.set(x, top + 1 + y, z, c.roofWhite);
    }
  } else if (roof < 0.72) {
    // tiled hip roof, its eaves a tile out over the walls wherever the air is free
    for (let y = 0; y < Math.min(w, d) / 2; y++) g.box(x0 + y, top + y, z0 + y, x1 - y, top + y, z1 - y, (x, _y, z) => ((x + z) % 2 ? c.roofTile : c.roofTileB));
    g.box(x0 - 1, top, z0 - 1, x1 + 1, top, z1 + 1, (x, y, z) => {
      const v = g.get(x, y, z);
      return v || ((x === x0 - 1 || x === x1 + 1 || z === z0 - 1 || z === z1 + 1) && overhead(x, z, y) ? c.roofTileB : 0);
    });
  } else {
    // a flat terrace with a parapet, often a pergola, potted lemons or a line of washing
    g.box(x0, top, z0, x1, top, z1, c.terraceTile);
    // the parapet in the wall's own plaster under a coping of white stone, terracotta on some
    const coping = hash3(lt.seed, 41, 20) < 0.3 ? c.cottoB : trim;
    const para = (_x: number, y: number) => (y === top + 3 ? coping : wall);
    g.box(x0, top + 1, z0, x1, top + 3, z0, para); g.box(x0, top + 1, z1, x1, top + 3, z1, para);
    g.box(x0, top + 1, z0, x0, top + 3, z1, para); g.box(x1, top + 1, z0, x1, top + 3, z1, para);
    // a spout through the parapet at the low corner, and its stain down the wall
    { const sx = x0 + 2; if (!g.get(sx, top + 1, z0 - 1) && overhead(sx, z0 - 1, top + 1)) { g.set(sx, top + 1, z0 - 1, c.cotto); for (let y = top; y > top - 6; y--) if (g.get(sx, y, z0) === wall || g.get(sx, y, z0) === trim) g.set(sx, y, z0, dirt); } }
    const pr = r();
    if (pr < 0.45) {
      // pergola of chestnut poles under vines or bougainvillea
      const flower = r() < 0.5;
      for (let x = x0 + 2; x <= x1 - 2; x += 5) for (let z = z0 + 2; z <= z1 - 2; z += 5) g.box(x, top + 1, z, x, top + 9, z, c.pole);
      // beams along the rows of poles at 2.5 m, the leaves on them; a leaf the gaps leave on its own is dropped
      const pw = x1 - x0 - 3, pd = z1 - z0 - 3;
      const roof = new Int32Array(pw * pd);
      for (let j = 0; j < pd; j++) for (let i = 0; i < pw; i++) {
        const x = x0 + 2 + i, z = z0 + 2 + j, n = hash3(x, top + 10, z);
        roof[j * pw + i] = i % 5 === 0 || j % 5 === 0 ? c.pole : n < 0.25 ? 0 : flower && n < 0.55 ? (n < 0.4 ? c.bougain : c.bougainB) : n < 0.8 ? c.leaf : c.leafDark;
      }
      const held = new Uint8Array(pw * pd), st: number[] = [];
      for (let k = 0; k < roof.length; k++) if (roof[k] === c.pole) { held[k] = 1; st.push(k); }
      while (st.length) {
        const k = st.pop()!, i = k % pw, j = (k - i) / pw;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const ii = i + di, jj = j + dj, kk = jj * pw + ii;
          if (ii >= 0 && jj >= 0 && ii < pw && jj < pd && roof[kk] && !held[kk]) { held[kk] = 1; st.push(kk); }
        }
      }
      for (let k = 0; k < roof.length; k++) if (held[k]) g.set(x0 + 2 + (k % pw), top + 10, z0 + 2 + Math.floor(k / pw), roof[k]);
    } else if (pr < 0.75) {
      for (let i = 0; i < 2; i++) b.place(potLemon(c, lt.seed + i), (x0 + 3 + i * (w - 6)) * V, (top + 1 - G) * V, (z0 + 3) * V);
    } else {
      // washing on a line across the terrace
      const cols = [c.white, c.sky, c.pink, c.yellow, c.umbrellaC];
      g.box(x0 + 1, top + 8, z0 + Math.floor(d / 2), x1 - 1, top + 8, z0 + Math.floor(d / 2), c.iron);
      // tied to a pole at each end
      g.box(x0 + 1, top + 1, z0 + Math.floor(d / 2), x0 + 1, top + 8, z0 + Math.floor(d / 2), c.pole);
      g.box(x1 - 1, top + 1, z0 + Math.floor(d / 2), x1 - 1, top + 8, z0 + Math.floor(d / 2), c.pole);
      for (let x = x0 + 2; x < x1 - 1; x += 2) if (hash3(x, top, z0) < 0.7) {
        const zc = z0 + Math.floor(d / 2);
        g.box(x, top + 5, zc, x, top + 7, zc, cols[Math.floor(hash3(x, 1, zc) * cols.length)]);
        const id = b.addSway({ ...SWAY.laundry, pivot: [(x + 0.5) * V, (top + 8.5 - G) * V, (zc + 0.5) * V], axis: [1, 0, 0], reach: 0 });
        for (let y = top + 5; y <= top + 7; y++) b.swayCell(x, y, zc, id);
      }
    }
  }
  // a television aerial on one roof in four, standing on whatever is highest there
  if (H(30) < 0.25 && w >= 8 && d >= 8) {
    const ax = x0 + 2 + Math.floor(H(31) * (w - 4)), az = z0 + 2 + Math.floor(H(32) * (d - 4));
    let ay = top + 12;
    while (ay > top && !g.get(ax, ay - 1, az)) ay--;
    if (ay > top - 1 && g.get(ax, ay - 1, az) !== c.leaf && g.get(ax, ay - 1, az) !== c.leafDark) {
      g.box(ax, ay, az, ax, ay + 7, az, c.iron);
      const alongX = H(33) < 0.5;
      for (const [k, half] of [[ay + 5, 2], [ay + 7, 1]] as const) for (let i = -half; i <= half; i++) if (i) stick(alongX ? ax + i : ax, k, alongX ? az : az + i, c.iron);
    }
  }
  // Amalfi chimneys: a little hooded stack
  if (r() < 0.5) {
    const cx = x0 + 2 + Math.floor(r() * (w - 4)), cz = z0 + 2 + Math.floor(r() * (d - 4));
    const ty = top + (roof < 0.72 ? Math.min(w, d) / 2 - 2 : 1);
    g.box(cx, top, cz, cx + 1, ty + 5, cz + 1, wall);
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
      const [ax, az] = f.at(a);
      for (let y = top - 1; y > Math.max(gl + 4, top - 1 - len); y--) if (hash3(ox, y, oz) < 0.8 && g.get(ax, y, az)) g.set(ox, y, oz, hash3(ox, y + 1, oz) < 0.6 ? c.bougain : c.leaf);
    }
  }
  // a terracotta downpipe from the gutter to the ground at a corner of the front, clipped to the wall
  if (r() < 0.7) {
    const f = faces.find((q) => q.side === lt.side) ?? faces[0];
    const [ox, oz] = f.out(r() < 0.5 ? 1 : f.n - 2);
    const gl = outside(ox, oz);
    if (gl < top - 6) for (let y = gl; y < top; y++) if (!g.get(ox, y, oz)) g.set(ox, y, oz, (y - gl) % 10 === 9 ? c.iron : c.terracotta);
  }
}

/** A flowering oleander bush in a terracotta pot. */
function oleander(c: AC, seed: number): Prop {
  const p = new Prop(11, 16, 11);
  p.box(3, 0, 3, 7, 3, 7, c.terracotta);
  p.box(4, 3, 4, 6, 3, 6, c.soil);
  p.ellipsoid(5, 10, 5, 5, 5, 5, (x, y, z) => { const n = hash3(x + seed, y, z); return n < 0.25 ? 0 : n < 0.45 ? c.bougainB : n < 0.52 ? c.white : n < 0.8 ? c.leaf : c.leafDark; });
  p.sway(SWAY.bush, [5, 4, 5], [0, 0, 0], (_x, y) => y >= 5);
  return p;
}

/** The coin telescope on the belvedere, pointed out to sea (+z before turning). */
function telescope(c: AC): Prop {
  const p = new Prop(5, 13, 9);
  p.box(1, 0, 1, 3, 0, 3, c.iron);
  p.box(2, 1, 2, 2, 8, 2, c.iron);
  p.box(1, 9, 1, 3, 10, 6, c.bronzeDoor);
  p.box(2, 10, 7, 2, 10, 8, c.iron);
  p.box(1, 11, 2, 3, 11, 4, c.bronzeDoor);
  p.set(2, 9, 0, c.iron);
  return p;
}

/** A lifebuoy on a short post (ring facing +z). */
function lifebuoy(c: AC): Prop {
  const p = new Prop(9, 12, 3);
  p.box(4, 0, 0, 4, 5, 0, c.iron);
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
    const d = Math.hypot(x - 4, y - 4);
    if (d > 4.4 || d < 2.4) continue;
    p.set(x, y + 3, 1, Math.floor(Math.atan2(y - 4, x - 4) / (Math.PI / 4) + 8) % 2 ? c.white : c.hullRed);
  }
  return p;
}

const k = (b: Builder) => b.k;

/** A yacht: a white hull pointed at the bow, a teak deck, a little cabin and a mast. Its length runs along x. */
function yacht(c: AC, seed: number, len = 44): Prop {
  const w = 13, p = new Prop(len, 40, w);
  const stripe = [c.hullBlue, c.ferryBlue, c.white, c.hullRed][seed % 4];
  for (let x = 0; x < len; x++) {
    const t = x / (len - 1), half = (w / 2 - 0.5) * Math.min(1, (1 - t) * 3.2) * (t < 0.08 ? 0.85 : 1);
    for (let z = 0; z < w; z++) {
      if (Math.abs(z + 0.5 - w / 2) > half + 0.3) continue;
      p.box(x, 0, z, x, 4, z, (_x, y) => (y === 3 ? stripe : y === 4 ? c.deckWood : c.hullWhite));
    }
  }
  p.box(Math.floor(len * 0.25), 5, 3, Math.floor(len * 0.55), 8, w - 4, (x, y) => (y === 7 && x % 3 ? c.glass : c.hullWhite));
  p.box(Math.floor(len * 0.25), 9, 3, Math.floor(len * 0.55), 9, w - 4, c.hullWhite);
  const mx = Math.floor(len * 0.6);
  p.box(mx, 5, (w >> 1), mx, 38, (w >> 1), c.iron);
  p.box(Math.floor(len * 0.1), 7, (w >> 1), mx - 1, 7, (w >> 1), c.iron); // the boom
  return p;
}

/** A Funchal street lamp: a black iron post with a lantern of four panes and a little crown. */
function ironLamp(c: AC): Prop {
  const p = new Prop(5, 30, 5);
  p.box(1, 0, 1, 3, 1, 3, c.iron);
  p.box(2, 2, 2, 2, 23, 2, c.iron);
  p.box(1, 24, 1, 3, 27, 3, (x, _y, z) => (x === 2 || z === 2 ? c.lampGlow : c.iron));
  p.box(0, 28, 0, 4, 28, 4, c.iron); p.set(2, 29, 2, c.iron);
  return p;
}

/** The sea front: lamps and benches along the promenade, palms by the avenue, boats on the black pebble beach. */
function shore(b: Builder, c: AC, plan: Plan): void {
  const at = (x: number, z: number) => floorAt(plan, x, z);
  const promX = PROM_X1 - 0.55;
  for (let z = -84; z < 86; z += 10) {
    const y = at(promX, z);
    if (Math.abs(y - 2) > 0.3) continue;
    b.place(ironLamp(c), promX, y, z); b.lamp(promX, y + 3.4, z, WARM, 7, 0.85); b.block(promX - 0.3, z - 0.3, promX + 0.3, z + 0.3);
    const bz = z + 5;
    if (Math.abs(at(promX, bz) - 2) < 0.3 && Math.abs(bz + 66) > 3) { b.place(bench(k(b)), promX, at(promX, bz), bz, 3); b.benches.push([promX, bz, -Math.PI / 2, at(promX, bz)]); }
  }
  // palms and the odd dragon tree between the avenue and the promenade
  for (let z = -82; z < 86; z += 12) {
    if (Math.abs(z - ribZ(35.3)) < 6) continue;
    const y = at(35.4, z);
    b.place(palmTree(c, z * 13 + 7), 35.4, y, z); b.block(35.1, z - 0.3, 35.7, z + 0.3);
  }
  // boats pulled up on the pebbles, nets and crates beside them
  for (let i = 0; i < 6; i++) {
    const z = 26 + i * 4.6, x = waterX(z) - 4.2;
    const y = at(x, z);
    if (y < 0) continue;
    b.place(gozzo(c, i + 1, 30), x, layerY(y), z, 0);
  }
  b.place(netPile(c, 3), waterX(52) - 6, at(waterX(52) - 6, 52), 52);
  for (let i = 0; i < 3; i++) b.place(kayak(c, i), waterX(40) - 5 + i * 0.4, at(waterX(40) - 5, 40 + i * 1.2), 40 + i * 1.2, 0);
  // a coin telescope on the promenade by the ribeira's mouth, pointed at the bay
  b.place(telescope(c), promX, 2.0, ribZ(39) + 6, 1); b.block(promX - 0.3, ribZ(39) + 5.7, promX + 0.3, ribZ(39) + 6.3);
  // a cruise ship at anchor in the bay, as there nearly always is
  b.place(ferry(c), 74, -1.3, 30, 1);
  // and the Santa Maria at anchor off the promenade, waiting for its afternoon sail
  b.place(nao(c), 61, SEA_Y - 1, -10, 0);
}

/** The marina: yachts and fishing boats inside the curved breakwater, its walls, bollards and the light at its end. */
function marina(b: Builder, c: AC, plan: Plan): void {
  const g = b.grid;
  // yachts moored stern-to along the breakwater and in rows in the basin
  let s = 0;
  for (let a = MAR_A0 + 0.25; a < MAR_A1 - 0.2; a += 0.17) {
    // a boat lies square to the grid, so where the arm runs diagonal it would cut into the wall: leave that bend free
    if (Math.min(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))) > 0.42) continue;
    const len = s % 3 === 2 ? 36 : 40 + (s % 3) * 6;
    const r = moleRadii(a)[0] - len * V / 2 - 0.7, x = MAR_CX + Math.cos(a) * r, z = MAR_CZ + Math.sin(a) * r;
    if (x < PROM_X1 + 3) continue;
    const radial = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a));
    b.place(s % 3 === 2 ? gozzo(c, s, len) : yacht(c, s, len), x, -0.8, z, radial ? 0 : 1);
    s++;
  }
  for (let z = -60; z <= -30; z += 4.2) { b.place(yacht(c, s++, 38 + (s % 2) * 8), 45, -0.8, z, 0); b.place(yacht(c, s++, 40), 52.5, -0.8, z + 1.5, 0); }
  // the breakwater's walls: a high wall to the open sea, a kerb and bollards along the basin
  const x0 = Math.floor(PROM_X1 / V), x1 = Math.ceil((MAR_CX + 27) / V), z0 = Math.floor((MAR_CZ - 27) / V), z1 = Math.ceil((MAR_CZ + 27) / V);
  if (g.touches(x0, z0, x1, z1))
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) continue;
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Pier) continue;
      const w = plan.walk[ci];
      let outer = false, inner = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = col(x + dx, z + dz), nk = plan.kind[nc];
        if (nk === K.Pier || isPath(nk)) continue;
        const nr = Math.hypot((x + dx + 0.5) * V - MAR_CX, (z + dz + 0.5) * V - MAR_CZ), r = Math.hypot((x + 0.5) * V - MAR_CX, (z + 0.5) * V - MAR_CZ);
        if (nr > r) outer = true; else inner = true;
      }
      const mx = x * V, mz = z * V;
      if (outer) { g.box(x, w, z, x, w + 5, z, (xx, y, zz) => (y === w + 5 ? c.cantaria : masonry(c, xx, y, zz, true))); b.block(mx, mz, mx + V * 0.99, mz + V * 0.99); }
      else if (inner) { g.set(x, w, z, c.cantaria); b.block(mx, mz, mx + V * 0.99, mz + V * 0.99); }
    }
  for (let a = MAR_A0 + 0.1; a < MAR_A1 - 0.15; a += 0.12) {
    const r = moleRadii(a)[0] + 0.45, x = MAR_CX + Math.cos(a) * r, z = MAR_CZ + Math.sin(a) * r;
    if (x > PROM_X1 + 1) b.place(bitt(c), x, 2.0, z);
  }
  // the green light at the end of the arm
  const a = MAR_A1 - 0.1, [r0, r1] = moleRadii(a), lr = (r0 + r1) / 2, lx = (MAR_CX + Math.cos(a) * lr) / V, lz = (MAR_CZ + Math.sin(a) * lr) / V;
  const LX = Math.round(lx), LZ = Math.round(lz);
  if (g.touches(LX - 4, LZ - 4, LX + 4, LZ + 4)) {
    const Y = layerOf(2.0);
    for (let y = 0; y < 26; y++) for (let z = LZ - 3; z <= LZ + 3; z++) for (let x = LX - 3; x <= LX + 3; x++) {
      const d = Math.hypot(x + 0.5 - lx, z + 0.5 - lz);
      if (d < (y > 20 ? 1.6 : 2.4)) g.set(x, Y + y, z, y > 20 ? (y > 23 ? c.iron : c.lampGlowAlways) : (y >> 2) % 2 ? c.hullGreen : c.white);
    }
  }
  b.block(lx * V - 0.7, lz * V - 0.7, lx * V + 0.7, lz * V + 0.7);
  b.lamp(lx * V, 7.5, lz * V, [0.4, 1, 0.5], 6, 1.2);
  b.place(lifebuoy(c), MAR_CX + 0.5, 2.0, MAR_CZ - moleRadii(MAR_A0)[0] - 0.6);
}

/**
 * The Sé (1514), smaller and plainer than the cathedrals of the south: white walls framed in black basalt, a nave
 * standing over two lower aisles under Portuguese tile roofs with their rows of tile-ends at the eaves, buttresses
 * along the side, the square chancel at the back behind its Manueline parapet of merlons and twisted pinnacles. The
 * front: one gable between basalt pilasters, the Manueline portal of roped archivolts in its rectangular frame, King
 * Manuel's arms between two armillary spheres, the round óculo, the cross. The tower with its tiled spire beside it.
 */
function se(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(DUOMO_Y);
  const X0 = Math.round((SE[0] + 3) / V), X1 = SE[2] / V - 1, Z0 = Math.round((SE[1] + 4) / V), Z1 = SE[3] / V - 1;
  const XN = X0 + 21, FX = X1 + 1, AH = 30, NH = 46, CHH = 36;
  const F: SeFrame = { X0, X1, Z0, Z1, XN, Y, FX, AH, NH, CHH };
  const S = seGeom(F);
  const { NZ0, NZ1, cz, cols, wins, occuli } = S;
  b.occlude(X0, Z0, X1 + 4, Z1, DUOMO_Y + 17, DUOMO_Y + 0.95, 'landmark');
  const hallOcc = b.occluders.length - 1;
  Object.assign(b.occluders[hallOcc], { floor: DUOMO_Y, room: HALL_ROOM, walls: (AH - 3) * V, shell: 3, claim: [(X1 + 1) * V, (Z0 - 2) * V, (X1 + 5) * V, (Z1 + 3) * V] });
  if (g.touches(X0 - 4, Z0 - 4, X1 + 8, Z1 + 4)) {
    const plaster = (x: number, y: number, z: number) => (hash3(x, y >> 1, z >> 1) < 0.04 ? c.plasterOld : c.white);
    // ---- the aisles and the nave: white walls on a basalt plinth, basalt pilasters at every column, a basalt
    // cornice under the eaves, quoins at the corners
    g.box(XN + 1, Y, Z0, X1, Y + AH, Z1, (x, y, z) => {
      if (y < Y + 3 || y === Y + AH) return c.cantaria;
      const side = z === Z0 || z === Z1, end = x === XN + 1;
      const corner = (x - XN - 1 < 3) && (z - Z0 < 3 || Z1 - z < 3);
      if (corner && ((y - Y) >> 1) % 2 === 0) return c.cantaria;
      if (side && cols.some((cc) => x >= cc && x <= cc + 1)) return c.cantaria;
      if (end && (z === NZ0 - 3 || z === NZ1 + 3)) return c.cantaria;
      return plaster(x, y, z);
    });
    // the clerestory: the nave's walls standing over the aisle roofs, their round windows
    g.box(XN + 1, Y + AH + 1, NZ0 - 2, X1, Y + NH, NZ1 + 2, (x, y, z) => (y === Y + NH ? c.cantaria : (z === NZ0 - 2 || z === NZ1 + 2) && cols.some((cc) => x >= cc && x <= cc + 1) ? c.cantaria : plaster(x, y, z)));
    for (const x of occuli) for (const z of [NZ0 - 2, NZ1 + 2]) for (let y = Y + NH - 8; y <= Y + NH - 3; y++) for (let xx = x - 1; xx <= x + 3; xx++) {
      const r = Math.hypot(xx - x - 1, y - (Y + NH - 5.5));
      if (r < 1.9) g.set(xx, y, z, c.glass); else if (r < 2.8) g.set(xx, y, z, c.cantaria);
    }
    // lean-to roofs over the aisles, rising to the clerestory, the Portuguese eaves of tile-ends under them
    for (const [za, zb, dir] of [[Z0 - 1, NZ0 - 3, 1], [Z1 + 1, NZ1 + 3, -1]] as const) {
      for (let z = za; dir > 0 ? z <= zb : z >= zb; z += dir) {
        const yr = Y + AH + 1 + Math.floor(Math.abs(z - za) / 2);
        g.box(XN + 1, Y + AH + 1, z, X1, yr, z, (x, y) => (y === yr ? (x % 2 ? c.roofTile : c.roofTileB) : z === za ? 0 : c.white));
      }
      g.box(XN + 1, Y + AH, za, X1, Y + AH, za, (x) => (x % 2 ? c.roofTileB : c.white));
      g.box(XN + 1, Y + AH - 1, za, X1, Y + AH - 1, za, (x) => (x % 2 ? 0 : c.roofTileB));
    }
    // the nave's roof: a gable of tiles over the clerestory, a ridge of capping tiles
    for (let i = 0; NZ0 - 3 + i <= NZ1 + 3 - i; i++) g.box(XN + 1, Y + NH + 1 + i, NZ0 - 3 + i, X1, Y + NH + 1 + i, NZ1 + 3 - i, (x, _y, z) => (z === NZ0 - 3 + i || z === NZ1 + 3 - i ? (x % 2 ? c.roofTile : c.roofTileB) : c.white));
    const ridge = Y + NH + 1 + Math.floor((NZ1 - NZ0 + 6) / 2);
    g.box(XN + 1, ridge + 1, Math.floor(cz) - 1, X1, ridge + 1, Math.ceil(cz), c.roofTileB);
    // the aisle windows: tall lancets in basalt frames between the pilasters
    for (const x of wins) for (const z of [Z0, Z1]) {
      g.box(x - 1, S.WIN_Y0 - 1, z, x + 4, S.WIN_Y1 + 2, z, c.cantaria);
      g.box(x, S.WIN_Y0, z, x + 3, S.WIN_Y1, z, (xx, y) => (y === S.WIN_Y1 && (xx === x || xx === x + 3) ? c.cantaria : c.glass));
      g.box(x + 1, S.WIN_Y1 + 1, z, x + 2, S.WIN_Y1 + 1, z, c.glass);
    }
    // buttresses along the open side, stepped back as they rise
    for (const cc of cols) g.box(cc, Y, Z0 - 2, cc + 1, Y + AH - 6, Z0 - 1, (_x, y, z) => (y > Y + AH - 14 && z === Z0 - 2 ? 0 : c.cantaria));
    // a side door on the open side: a pointed arch of basalt, the doors in it
    {
      const dx = cols[cols.length - 2] + 7;
      for (let y = Y; y <= Y + 17; y++) for (let x = dx - 6; x <= dx + 6; x++) {
        const u = Math.abs(x + 0.5 - dx), v = y - Y, half = v < 11 ? 6 : Math.sqrt(Math.max(0, 36 - ((v - 11) * 1.05) ** 2));
        if (u > half) continue;
        g.set(x, y, Z0 - 1, half - u < 1.6 ? c.cantaria : 0);
        if (half - u >= 1.6) g.set(x, y, Z0, c.door);
      }
    }
    // ---- the chancel: a square block with a Manueline parapet, twisted pinnacles at its corners, a tall lancet
    // either side
    const CZ0 = NZ0 - 3, CZ1 = NZ1 + 3;
    g.box(X0, Y, CZ0, XN, Y + CHH, CZ1, (x, y, z) => (y < Y + 3 || y === Y + CHH ? c.cantaria : (x - X0 < 2 || XN - x < 0) && (z - CZ0 < 2 || CZ1 - z < 2) ? c.cantaria : plaster(x, y, z)));
    for (let z = CZ0; z <= CZ1; z++) for (let x = X0; x <= XN; x++) {
      const edge = x === X0 || z === CZ0 || z === CZ1;
      if (!edge) { g.set(x, Y + CHH + 1, z, (x + z) % 2 ? c.roofTile : c.roofTileB); continue; }
      const a = x === X0 ? z : x;
      g.set(x, Y + CHH + 1, z, c.white);
      if (pm2(a, 4) < 2) { g.box(x, Y + CHH + 2, z, x, Y + CHH + 3, z, c.white); if (pm2(a, 8) === 0) g.set(x, Y + CHH + 4, z, c.cantaria); }
    }
    for (const [px, pz] of [[X0, CZ0], [X0, CZ1 - 2], [XN - 2, CZ0], [XN - 2, CZ1 - 2]] as const)
      g.box(px, Y + 3, pz, px + 2, Y + CHH + 9, pz + 2, (x, y, z) => (y > Y + CHH + 7 ? (x === px + 1 && z === pz + 1 ? c.cantaria : 0) : pm2(y + (x - px) + (z - pz) * 2, 4) < 2 ? c.cantaria : c.white));
    {
      const lx = Math.round((S.CX0 + S.CX1) / 2) - 1;
      for (const z of [CZ0, CZ1]) {
        g.box(lx - 1, Y + 11, z, lx + 3, Y + 28, z, c.cantaria);
        g.box(lx, Y + 12, z, lx + 2, Y + 26, z, c.glass);
        g.set(lx + 1, Y + 27, z, c.glass);
      }
    }
    // ---- the front: one gable over the nave between basalt pilasters, shoulders over the aisles
    const SH = Y + AH + 4;
    g.box(FX, Y, Z0, FX + 3, SH, Z1, (x, y, z) => (z - Z0 < 4 || Z1 - z < 4 || y < Y + 3 || y >= SH - 1 ? c.cantaria : plaster(x, y, z)));
    g.box(FX, SH + 1, NZ0 - 3, FX + 3, Y + NH + 1, NZ1 + 3, (x, y, z) => (z - (NZ0 - 3) < 3 || (NZ1 + 3) - z < 3 ? c.cantaria : plaster(x, y, z)));
    for (let i = 0; NZ0 - 3 + i <= NZ1 + 3 - i; i++) g.box(FX, Y + NH + 2 + i, NZ0 - 3 + i, FX + 3, Y + NH + 2 + i, NZ1 + 3 - i, (x, y, z) => (z - (NZ0 - 3 + i) < 2 || (NZ1 + 3 - i) - z < 2 ? c.cantaria : plaster(x, y, z)));
    const apex = Y + NH + 2 + Math.floor((NZ1 - NZ0 + 6) / 2);
    g.box(FX + 1, apex + 1, Math.floor(cz), FX + 2, apex + 8, Math.floor(cz), c.cantaria);
    g.box(FX + 1, apex + 6, Math.floor(cz) - 2, FX + 2, apex + 6, Math.floor(cz) + 2, c.cantaria);
    // twisted pinnacles on the front's corners and where the gable rises
    for (const z of [Z0, Z1 - 2, NZ0 - 3, NZ1 + 1]) {
      const base = z === Z0 || z === Z1 - 2 ? SH + 1 : Y + NH + 2;
      g.box(FX, base, z, FX + 2, base + 7, z + 2, (x, y, zz) => (pm2(y + (x - FX) + (zz - z) * 2, 4) < 2 ? c.cantaria : c.white));
      g.box(FX + 1, base + 8, z + 1, FX + 1, base + 9, z + 1, c.cantaria);
    }
    // the Manueline portal: three roped archivolts of basalt round a pointed arch, in a rectangular frame (the
    // alfiz) with a twisted rope moulding
    for (let y = Y; y <= Y + 26; y++) for (let z = Math.floor(cz) - 10; z <= Math.ceil(cz) + 9; z++) {
      const u = Math.abs(z + 0.5 - cz), v = y - Y;
      const half = v < 14 ? 7 : Math.sqrt(Math.max(0, 49 - ((v - 14) * 0.78) ** 2));
      const alfiz = u > 8.4 || y > Y + 24;
      if (alfiz) { if (u <= 10 && y <= Y + 26 && (u > 9 || y > Y + 25)) g.set(FX + 4, y, z, (y + z) % 2 ? c.cantaria : c.cantariaB); continue; }
      if (u > half + 2.6) { g.set(FX + 4, y, z, c.white); continue; }
      if (u > half) g.set(FX + 4, y, z, (y + Math.floor(u * 2)) % 2 ? c.cantaria : c.cantariaB);
      else if (v < 16) g.set(FX + 3, y, z, Math.abs(z + 0.5 - cz) < 0.6 ? c.iron : c.door);
    }
    b.lamp(FX * V + 2, DUOMO_Y + 3.5, cz * V, WHITEWARM, 8, 0.9);
    // over it, the arms of King Manuel I in a basalt frame between two armillary spheres
    const zc = Math.floor(cz);
    for (let y = Y + 28; y <= Y + 37; y++) for (let z = zc - 4; z <= zc + 5; z++) {
      const edge = y === Y + 28 || y === Y + 37 || z === zc - 4 || z === zc + 5;
      const shield = Math.abs(z + 0.5 - cz) < 3 - Math.max(0, Y + 31 - y) * 0.6 && y < Y + 36;
      const dot = shield && ((y - Y) % 3 === 0) && Math.abs(z + 0.5 - cz) < 1.5 + ((y - Y) === 33 ? 1.2 : 0);
      g.set(FX + 4, y, z, edge ? c.cantaria : dot ? c.majolicaBlue : shield ? c.white : c.cantariaB);
    }
    for (const z0 of [zc - 8, zc + 9]) for (let y = Y + 29; y <= Y + 35; y++) for (let z = z0 - 2; z <= z0 + 2; z++) {
      const r = Math.hypot(z - z0, y - (Y + 32));
      if (r < 2.9 && (r > 1.9 || Math.abs(y - (Y + 32)) < 0.6)) g.set(FX + 4, y, z, c.brass);
    }
    // the óculo: a round window in a basalt ring, spokes of stone
    const oy = Y + NH - 9;
    for (let y = oy - 7; y <= oy + 7; y++) for (let z = zc - 7; z <= zc + 8; z++) {
      const r = Math.hypot(z + 0.5 - cz, y + 0.5 - oy);
      if (r > 6.6) continue;
      if (r >= 4.6) { g.set(FX + 4, y, z, c.cantaria); continue; }
      g.set(FX + 3, y, z, r < 1.4 ? c.glassLit : c.glassLit);
    }
    b.lamp(FX * V + 6, DUOMO_Y + 1, cz * V - 4, [1, 0.88, 0.7], 8, 0.7);
    b.lamp(FX * V + 6, DUOMO_Y + 1, cz * V + 4, [1, 0.88, 0.7], 8, 0.7);
  }
  // inside: the nave, the aisles and the chancel (registers its anchors in every worker)
  seInterior(b, F);
  b.occluders[hallOcc].air = b.halls[b.halls.length - 1].rect;
  // the tower, its spire sheathed in glazed tiles in a chequer of white, blue and green
  const TX0 = Math.round(SE_TOWER[0] / V), TZ0 = Math.round(SE_TOWER[1] / V), TS = Math.round((SE_TOWER[2] - SE_TOWER[0]) / V);
  b.occlude(TX0, TZ0, TX0 + TS - 1, TZ0 + TS - 1, DUOMO_Y + 26, DUOMO_Y + 0.95, 'landmark');
  Object.assign(b.occluders[b.occluders.length - 1], { floor: DUOMO_Y, follow: hallOcc });
  if (g.touches(TX0 - 2, TZ0 - 2, TX0 + TS + 2, TZ0 + TS + 2)) {
    const TH = 72;
    g.box(TX0, Y, TZ0, TX0 + TS - 1, Y + TH, TZ0 + TS - 1, (x, y, z) => {
      const edge = x === TX0 || x === TX0 + TS - 1 || z === TZ0 || z === TZ0 + TS - 1;
      const corner = (x - TX0 < 2 || TX0 + TS - 1 - x < 2) && (z - TZ0 < 2 || TZ0 + TS - 1 - z < 2);
      return y < Y + 3 || (y - Y) % 24 === 0 || (corner && edge) ? c.cantaria : c.white;
    });
    // the belfry: an arch on each face, a bell in it
    const yb = Y + TH - 18;
    for (const side of [0, 1, 2, 3]) for (let y = yb; y < yb + 12; y++) for (let a = 6; a < TS - 6; a++) {
      const [x, z] = side === 0 ? [TX0 + a, TZ0] : side === 1 ? [TX0 + a, TZ0 + TS - 1] : side === 2 ? [TX0, TZ0 + a] : [TX0 + TS - 1, TZ0 + a];
      const u = Math.abs(a + 0.5 - TS / 2), top = y - yb > 7 ? Math.sqrt(Math.max(0, 16 - (y - yb - 7) ** 2)) : 4;
      if (u < top) g.set(x, y, z, 0);
    }
    g.box(TX0 + 7, yb + 3, TZ0 + 7, TX0 + TS - 8, yb + 8, TZ0 + TS - 8, c.brass);
    g.box(TX0 - 1, Y + TH + 1, TZ0 - 1, TX0 + TS, Y + TH + 1, TZ0 + TS, c.cantaria);
    for (let i = 0; i < TS / 2 + 4; i++) g.box(TX0 + Math.floor(i / 2), Y + TH + 2 + i, TZ0 + Math.floor(i / 2), TX0 + TS - 1 - Math.floor(i / 2), Y + TH + 2 + i, TZ0 + TS - 1 - Math.floor(i / 2), (x, y, z) => ((x + y + z) % 2 ? c.azulejoW : (x + z) % 4 < 2 ? c.azulejo : c.majolicaGreen));
    const cx = TX0 + (TS >> 1), top = Y + TH + 2 + TS / 2 + 4;
    g.box(cx, top, TZ0 + (TS >> 1), cx, top + 6, TZ0 + (TS >> 1), c.iron);
    g.box(cx - 2, top + 4, TZ0 + (TS >> 1), cx + 2, top + 4, TZ0 + (TS >> 1), c.iron);
  }
}
const pm2 = (v: number, m: number) => ((v % m) + m) % m;

/**
 * The Mercado dos Lavradores (1940): an art deco square of white and ochre round an open courtyard, the azulejo
 * panels of market women either side of the gate, galleries of stalls under a covered walk, the fruit sellers in
 * the courtyard and the fish hall at the back where the black espada lies on marble.
 */
function mercado(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(PIAZZA_Y);
  const X0 = Math.round(MERCADO[0] / V), Z0 = Math.round(MERCADO[1] / V), X1 = Math.round(MERCADO[2] / V) - 1, Z1 = Math.round(MERCADO[3] / V) - 1;
  const IN = 16, zc = (Z0 + Z1) >> 1, HT = 34;
  b.occlude(X0, Z0, X1, Z1, PIAZZA_Y + 9.5, PIAZZA_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = PIAZZA_Y;
  if (!g.touches(X0 - 2, Z0 - 2, X1 + 2, Z1 + 2)) return;
  const inner = (x: number, z: number) => x >= X0 + IN && x <= X1 - IN && z >= Z0 + IN && z <= Z1 - IN;
  const gate = (x: number, z: number) => x > X1 - IN && Math.abs(z + 0.5 - zc) <= 10;
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    if (inner(x, z)) continue;
    const u = Math.min(x - X0, X1 - x, z - Z0, Z1 - z);
    if (u < 4) {
      // the outer wall: two storeys of white over an ochre base, tall windows above, a deco cornice
      if (gate(x, z) && Math.abs(z + 0.5 - zc) <= 9) { g.box(x, Y + 20, z, x, Y + HT + 6, z, (_x, y) => (y > Y + HT ? c.ochre : c.white)); continue; }
      g.box(x, Y, z, x, Y + HT, z, (xx, y, zz) => {
        if (y < Y + 4) return c.ochre;
        if (y > Y + HT - 3) return (xx + zz) % 3 ? c.ochre : c.white;
        const a = x === X0 || x === X1 ? zz : xx;
        if (u === 0 && y > Y + 18 && y < Y + 28 && (a % 8) > 1 && (a % 8) < 6) return c.glass;
        if (u === 0 && y > Y + 5 && y < Y + 14 && (a % 8) > 1 && (a % 8) < 6) return c.shopLit;
        return c.white;
      });
    } else {
      // the covered walk round the courtyard: its ceiling at 3.5 m, the gallery and its rail above, columns on the inside
      const col0 = (x - X0) % 12 === 0 || (z - Z0) % 12 === 0;
      const edge = x === X0 + IN - 1 || x === X1 - IN + 1 || z === Z0 + IN - 1 || z === Z1 - IN + 1;
      if (gate(x, z)) { g.box(x, Y + 20, z, x, Y + 22, z, c.white); continue; }
      if (edge && col0) g.box(x, Y, z, x, Y + 13, z, c.white);
      g.box(x, Y + 14, z, x, Y + 15, z, c.white);
      if (edge) g.box(x, Y + 16, z, x, Y + 19, z, (_x, y) => (y === Y + 19 ? c.cantaria : (x + z) % 2 ? c.iron : 0));
      else g.box(x, Y + 20, z, x, Y + 21, z, c.roofTile);
      // stall counters along the outer wall of the walk, their wares on top
      if (u === 4 || u === 5) {
        const fishHall = x < X0 + IN;
        g.box(x, Y, z, x, Y + 3, z, fishHall ? c.marble : c.door);
        if (u === 4) g.set(x, Y + 4, z, fishHall ? (hash3(x, 1, z) < 0.6 ? c.calBlack : c.marble) : [c.banana, c.grape, c.ochre, c.lemon, c.leafLight, c.hullRed][Math.floor(hash3(x, 2, z) * 6)]);
      }
    }
  }
  // the gate: an art deco frame stepped up over the entrance, azulejo panels either side
  for (let z = zc - 14; z <= zc + 14; z++) for (let y = Y; y <= Y + HT + 10; y++) {
    const dz = Math.abs(z + 0.5 - zc);
    const step = y > Y + HT ? 9 - Math.floor((y - Y - HT) / 3) * 2 : 14;
    if (dz > step) continue;
    if (dz <= 9 && y < Y + 20) { if (dz > 8) g.set(X1, y, z, c.ochre); continue; }
    if (dz > 9 && y < Y + 18 && y > Y + 2) { g.set(X1 + 1, y, z, (y + z) % 5 === 0 || dz > 13.5 || y === Y + 3 || y === Y + 17 ? c.azulejo : hash3(z, y, 9) < 0.35 ? c.azulejo : c.azulejoW); continue; }
    g.set(X1, y, z, y > Y + HT ? c.ochre : (y - Y) % 4 === 0 ? c.ochre : c.white);
  }
  // the name over the gate in black letters
  for (let z = zc - 6; z <= zc + 5; z++) if (z % 2 === 0) g.box(X1 + 1, Y + 24, z, X1 + 1, Y + 26, z, c.calBlack);
  // the courtyard's fruit stands: rows of trestles heaped with fruit under canvas
  const fruits = [c.banana, c.lemon, c.hullRed, c.ochre, c.leafLight, c.bougain, c.majolicaYellow];
  for (let row = 0; row < 3; row++) {
    const z = Z0 + IN + 8 + row * 18;
    for (let x = X0 + IN + 6; x < X1 - IN - 18; x += 14) {
      g.box(x, Y, z, x + 8, Y + 3, z + 3, c.door);
      g.box(x, Y + 4, z, x + 8, Y + 4, z + 3, (xx, _y, zz) => fruits[Math.floor(hash3(xx >> 1, row, zz) * fruits.length)]);
      g.box(x, Y + 4, z + 1, x + 8, Y + 5, z + 2, (xx, _y, zz) => (hash3(xx, 5, zz) < 0.5 ? fruits[Math.floor(hash3(xx, 6, zz) * fruits.length)] : 0));
      for (const [px, pz] of [[x, z], [x + 8, z], [x, z + 3], [x + 8, z + 3]]) g.box(px, Y + 4, pz, px, Y + 11, pz, c.pole);
      g.box(x - 1, Y + 12, z - 1, x + 9, Y + 12, z + 4, (xx) => ((xx >> 1) % 2 ? c.white : c.umbrellaC));
      b.block((x - 1) * V, (z - 1) * V, (x + 10) * V, (z + 5) * V);
    }
  }
  for (let x = X0 + 4; x <= X1 - 4; x += 16) for (const z of [Z0 + 6, Z1 - 6]) b.lamp((x + 0.5) * V, PIAZZA_Y + 3, (z + 0.5) * V, WARM, 5, 0.7);
  b.lamp((X0 + X1) / 2 * V, PIAZZA_Y + 5, zc * V, WHITEWARM, 10, 0.6);
}

/** The Fortaleza de São Tiago (1614): yellow curtain walls with a battered base, arrowhead bastions and sentry boxes. */
function fort(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(2.0), HT = 26;
  const [fx, fz] = FORT_C;
  const X0 = Math.floor((fx - 14) / V), X1 = Math.ceil((fx + 14) / V), Z0 = Math.floor((fz - 14) / V), Z1 = Math.ceil((fz + 14) / V);
  b.occlude(X0, Z0, X1, Z1, 2 + HT * V + 2, 2.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = 2.0;
  if (!g.touches(X0, Z0, X1, Z1)) return;
  const R = (x: number, z: number) => { const mx = (x + 0.5) * V, mz = (z + 0.5) * V; return { d: Math.hypot(mx - fx, mz - fz), a: Math.atan2(mz - fz, mx - fx) }; };
  for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
    if ((x + 0.5) * V <= PROM_X1 + 0.5) continue;
    const { d, a } = R(x, z), rr = fortR(a);
    for (let y = Y; y <= Y + HT + 3; y++) {
      // the base leans out (a talus), a rounded cordon of basalt at its top
      const lean = y < Y + 10 ? (Y + 10 - y) * 0.06 : 0;
      if (d > rr + lean) continue;
      const shell = d > rr - 1.5;
      if (y > Y + HT) {
        // the parapet, cut with embrasures
        if (!shell || d < rr - 0.75) continue;
        if (y > Y + HT + 1 && Math.floor((a + Math.PI) * rr * 0.9) % 3 === 0) continue;
        g.set(x, y, z, c.fortYellow);
        continue;
      }
      g.set(x, y, z, y === Y + 10 || y === Y + HT ? c.cantaria : shell ? (y < Y + 10 ? c.fortOchre : hash3(x, y >> 2, z) < 0.04 ? c.plasterOld : c.fortYellow) : c.lava);
    }
  }
  // the gate towards the town: a basalt arch with the royal arms over it
  const gz = Math.round(fz / V), gx = Math.floor((fx - fortR(Math.PI)) / V);
  g.box(gx - 1, Y, gz - 5, gx + 1, Y + 17, gz + 4, (_x, y, z) => (Math.abs(z + 0.5 - gz) < 3.5 && y < Y + 13 ? (y < Y + 12 ? c.door : c.cantaria) : c.cantaria));
  g.box(gx - 1, Y + 18, gz - 2, gx - 1, Y + 22, gz + 1, (_x, y, z) => ((y + z) % 2 ? c.azulejoW : c.azulejo));
  // a sentry box on the point of each bastion: a little drum with a dome
  for (let i = 0; i < 4; i++) {
    const a = 0.3 + (i * Math.PI) / 2, rr = fortR(a) - 0.6;
    const sx = (fx + Math.cos(a) * rr) / V, sz = (fz + Math.sin(a) * rr) / V;
    // it stands on whatever the wall's point really is: find its top under the drum's middle
    let T = Y + HT;
    while (T > Y && !g.get(Math.floor(sx), T, Math.floor(sz))) T--;
    if (T <= Y) continue;
    for (let y = 0; y < 14; y++) for (let z = Math.floor(sz - 4); z <= sz + 4; z++) for (let x = Math.floor(sx - 4); x <= sx + 4; x++) {
      const d = Math.hypot(x + 0.5 - sx, z + 0.5 - sz), r0 = y < 9 ? 3 : 3.4 - (y - 9) * 0.7;
      if (d > r0) continue;
      g.set(x, T + 1 + y, z, y < 9 ? (y > 4 && y < 7 && d > 2.2 && Math.floor(Math.atan2(z - sz, x - sx) * 2) % 2 === 0 ? 0 : c.fortYellow) : c.white);
    }
    // carried out over the wall's point on a stepped stone corbel
    for (let k = 0; k < 6; k++) for (let z = Math.floor(sz - 4); z <= sz + 4; z++) for (let x = Math.floor(sx - 4); x <= sx + 4; x++) {
      if (Math.hypot(x + 0.5 - sx, z + 0.5 - sz) > 3 - k * 0.5 || g.get(x, T - k, z)) continue;
      g.set(x, T - k, z, c.cantaria);
    }
  }
  // the flag over the keep
  const kx = Math.round(fx / V), kz = Math.round(fz / V);
  g.box(kx, Y + HT + 1, kz, kx, Y + HT + 20, kz, c.iron);
  g.box(kx + 1, Y + HT + 15, kz, kx + 6, Y + HT + 19, kz, (x) => (x < kx + 3 ? c.hullGreen : c.hullRed));
  b.lamp(fx - 10, 3, fz, [1, 0.85, 0.6], 12, 0.8);
}

/** The cable car's valley station on the seafront garden: glass and white walls round the big wheel. */
function teleferico(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(PIAZZA_Y);
  const X0 = Math.round(TELE[0] / V), Z0 = Math.round(TELE[1] / V), X1 = Math.round(TELE[2] / V) - 1, Z1 = Math.round(TELE[3] / V) - 1;
  b.block(TELE[0], TELE[1], TELE[2], TELE[3]);
  if (!g.touches(X0, Z0, X1, Z1)) return;
  g.box(X0, Y, Z0, X1, Y + 22, Z1, (x, y, z) => {
    const u = Math.min(x - X0, X1 - x, z - Z0, Z1 - z);
    if (y < Y + 2) return c.cantaria;
    if (u > 0) return y > Y + 20 ? c.white : 0;
    return y > Y + 3 && y < Y + 18 && (x + z) % 6 ? c.glass : c.white;
  });
  // the roof slopes up towards the hill, where the cables leave
  for (let i = 0; i < 8; i++) g.box(X0 - 1 + i, Y + 23, Z0 - 1, X0 - 1 + i, Y + 30 - i, Z1 + 1, (_x, y) => (y === Y + 30 - i ? c.roofWhite : c.white));
  g.box(X0 - 1 + 8, Y + 23, Z0 - 1, X1 + 1, Y + 23, Z1 + 1, c.white);
  // the bull wheel and a cabin waiting at the platform
  const zc = (Z0 + Z1) >> 1;
  for (let z = Z0 + 4; z <= Z1 - 4; z++) for (let x = X0 + 6; x <= X1 - 4; x++) { const d = Math.hypot(x + 0.5 - (X0 + X1) / 2, z + 0.5 - zc); if (Math.abs(d - 12) < 1) g.set(x, Y + 20, z, c.iron); }
  g.box(X0 + 10, Y + 4, zc - 3, X0 + 16, Y + 12, zc + 3, (x, y) => (y > Y + 7 && y < Y + 11 && x % 2 ? c.cabinGlass : c.cabin));
  g.box(X0 + 13, Y + 13, zc, X0 + 13, Y + 20, zc, c.iron);
  // the sign over the entrance, on the garden side
  g.box(X1 + 1, Y + 15, zc - 6, X1 + 1, Y + 17, zc + 5, (_x, y, z) => (y === Y + 16 && z % 2 ? c.white : c.cabin));
  b.lamp(TELE[2] + 0.5, PIAZZA_Y + 3, (TELE[1] + TELE[3]) / 2, WHITEWARM, 6, 0.8);
}

/** A jacaranda: the lemon tree's shape in the violet-blue of its flowers, a little green showing through. */
function jacaranda(c: AC, seed: number): Prop {
  return lemonTree({ ...c, leaf: c.jacaranda, leafDark: c.jacarandaB, leafLight: c.jacarandaL, lemon: c.jacarandaL, lemonDeep: c.leaf }, seed, true);
}

/** A laurel of the Laurisilva: dark glossy leaves, mossy limbs. */
function laurelTree(c: AC, seed: number): Prop {
  return lemonTree({ ...c, leaf: c.laurel, leafDark: c.laurelB, leafLight: c.moss, lemon: c.laurelB, lemonDeep: c.laurel, trunk: c.tuffBrown }, seed, seed % 3 === 0);
}

/** A clump of strelitzia, the bird-of-paradise: grey-green paddle leaves and orange and blue flowers like beaks. */
function strelitzia(c: AC, seed: number, pot = false): Prop {
  const p = new Prop(9, 14, 9);
  const y0 = pot ? 3 : 0;
  if (pot) { p.box(2, 0, 2, 6, 2, 6, c.terracotta); p.box(1, 2, 1, 7, 2, 7, c.cottoB); }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + seed, len = 7 + (i % 3);
    for (let s = 0; s < len; s++) {
      const x = 4 + Math.round(Math.cos(a) * s * 0.35), z = 4 + Math.round(Math.sin(a) * s * 0.35);
      p.set(x, y0 + s, z, s > len - 4 ? c.strelLeaf : c.leafDark);
    }
  }
  for (let i = 0; i < 2; i++) {
    const fx = 3 + i * 3, fz = 4 - i, fy = y0 + 8 + i;
    p.set(fx, fy, fz, c.strelitzia); p.set(fx + 1, fy + 1, fz, c.strelitzia); p.set(fx - 1, fy, fz, c.strelitziaBlue); p.set(fx, fy - 1, fz, c.leafDark);
  }
  p.sway(SWAY.shrub, [4.5, y0, 4.5], [0, 0, 0], (_x, y) => y > y0 + 3);
  return p;
}

/** The Jardim's lily pond: a basalt rim, water lilies and goldfish, a two-tier fountain splashing in the middle. */
function lilyPond(c: AC): Prop {
  const R = 13, N = 27, p = new Prop(N, 16, N);
  const m = (N - 1) / 2;
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - m, z - m);
    if (d > R) continue;
    if (d > R - 1.6) { p.box(x, 0, z, x, 2, z, hash3(x, 1, z) < 0.25 ? c.basaltB : c.basalt); p.set(x, 3, z, c.cantaria); continue; }
    p.set(x, 0, z, c.levadaWater); p.set(x, 1, z, c.levadaWater);
    const h = hash3(x, 7, z);
    if (d > 4 && h < 0.09) p.set(x, 2, z, c.leaf);
    else if (d > 4 && h < 0.11) p.set(x, 2, z, c.rose);
    else if (d > 3 && h < 0.13) p.set(x, 1, z, c.lemonDeep);
  }
  // the fountain: a basin on a column, a smaller one above, the jet and the water falling back
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    const d = Math.hypot(x - m, z - m);
    if (d <= 1.2) p.box(x, 2, z, x, 7, z, c.cantaria);
    if (d <= 3.6 && d > 2.6) p.set(x, 8, z, c.cantaria);
    if (d <= 2.6) p.set(x, 8, z, d > 1.2 ? c.levadaWater : c.cantaria);
    if (d <= 2.2 && d > 1.4) p.set(x, 12, z, c.cantaria);
    if (d <= 1.4) p.box(x, 9, z, x, 12, z, d > 0.8 ? c.cantaria : c.cantariaB);
    if (d <= 0.6) p.box(x, 13, z, x, 15, z, c.white);
    if (d <= 3.8 && d > 3.4 && hash3(x, 3, z) < 0.5) p.box(x, 3, z, x, 6 + Math.floor(hash3(x, 4, z) * 2), z, c.white);
  }
  return p;
}

/** A clump of hydrangeas or agapanthus for the garden beds. */
function flowerClump(c: AC, seed: number): Prop {
  const p = new Prop(8, 7, 8), blue = seed % 2 ? c.hydrangea : c.agapanthus;
  p.ellipsoid(3.5, 0, 3.5, 3.6, 3.2, 3.6, (x, y, z) => (y < 2 ? c.leafDark : hash3(x + seed, y, z) < 0.55 ? blue : y > 4 && hash3(x, y + seed, z) < 0.3 ? c.white : c.leaf));
  if (seed % 2 === 0) for (let i = 0; i < 5; i++) { const x = 1 + Math.floor(hash3(i, seed, 1) * 6), z = 1 + Math.floor(hash3(i, seed, 2) * 6); p.box(x, 3, z, x, 5, z, c.leafDark); p.set(x, 6, z, blue); }
  return p;
}

/** A zinc bucket of cut flowers for the market gate: strelitzias, anthuriums, proteas. */
function flowerBucket(c: AC, seed: number): Prop {
  const p = new Prop(6, 9, 6);
  p.box(1, 0, 1, 4, 2, 4, c.iron);
  const cols = [c.strelitzia, c.hullRed, c.bougain, c.white, c.strelitziaBlue];
  for (let z = 1; z <= 4; z++) for (let x = 1; x <= 4; x++) {
    const h = 4 + Math.floor(hash3(x, seed, z) * 4);
    p.box(x, 3, z, x, h - 1, z, c.leafDark);
    p.set(x, h, z, cols[Math.floor(hash3(x, z, seed + 3) * cols.length)]);
    if (hash3(z, x, seed) < 0.3) p.set(x + (x < 3 ? -1 : 1), h - 1, z, c.strelLeaf);
  }
  return p;
}

/** The Largo da Sé and Avenida Arriaga: café tables, benches, iron lamps, jacarandas and strelitzia beds. */
function largo(b: Builder, c: AC, plan: Plan): void {
  const Yp = PIAZZA_Y;
  for (const [x, z] of [[-4, -38], [12, -38], [-4, -16], [12, -16]] as const) { b.place(jacaranda(c, (x * 31 + z) | 0), x, Yp, z); b.block(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
  for (const [x, z] of [[-6, -30], [-6, -24], [12.5, -30], [12.5, -24]] as const) { b.place(bench(k(b)), x, Yp, z, 1); b.benches.push([x, z, Math.PI / 2, Yp]); }
  for (const [x, z] of [[-8, -40], [-8, -14], [13, -40], [13, -14], [3, -40], [3, -14]] as const) { b.place(ironLamp(c), x, Yp, z); b.lamp(x, Yp + 3.4, z, WARM, 7, 0.9); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  // café tables on the square in front of the café
  for (let i = 0; i < 4; i++) {
    const x = 6 + i * 2.2, z = -15.2;
    b.place(terraceTable(k(b), b.k.c.white, i), x, Yp, z);
    b.place(terraceChair(k(b), c.iron, c.iron), x - 0.55, Yp, z, 1); b.place(terraceChair(k(b), c.iron, c.iron), x + 0.55, Yp, z, 3);
    b.stools.push([x - 0.55, z, Math.PI / 2, Yp], [x + 0.55, z, -Math.PI / 2, Yp]);
    b.cafeTables.push([x, z, Yp + TERRACE_TOP]);
    if (i % 2 === 0) b.place(umbrella(c, i), x, Yp, z);
    b.lamp(x, Yp + 1.1, z, WARM, 2.5, 0.5);
  }
  for (const [x, z] of [[-2, -41], [10, -41], [-9, -20], [-9, -34]] as const) b.place(strelitzia(c, (x * 7 + z) | 0, true), x, Yp, z);
  // the jacaranda boulevard
  for (let z = -86; z <= -46; z += 8) for (const x of [-0.25, 8.25]) {
    const y = floorAt(plan, x, z);
    b.place(jacaranda(c, (z * 5 + x * 3) | 0), x, layerY(y), z); b.block(x - 0.4, z - 0.4, x + 0.4, z + 0.4);
  }
  for (let z = -82; z <= -50; z += 8) { const y = floorAt(plan, 4, z); b.place(ironLamp(c), 4, layerY(y), z); b.lamp(4, y + 3.4, z, WARM, 7, 0.85); b.block(3.7, z - 0.3, 4.3, z + 0.3); }
  // café terraces under the jacarandas on the east side, as along the Avenida Arriaga: little tables in pairs of
  // iron chairs, a parasol over every other one, a light on each table at night
  const free = (x0: number, z0: number, x1: number, z1: number) => !b.blockers.some(([a0, c0, a1, c1]) => a0 < x1 && a1 > x0 && c0 < z1 && c1 > z0);
  const cloths = [b.k.c.white, c.majolicaYellow, c.umbrellaC];
  let ti = 0;
  for (const z0 of [-80, -72, -64, -56]) for (const dz of [0, 1.9]) {
    const x = 6.6, z = z0 + dz, y = floorAt(plan, x, z);
    if (Math.abs(floorAt(plan, x - 0.6, z) - y) > 0.05 || Math.abs(floorAt(plan, x + 0.6, z) - y) > 0.05 || !free(x - 0.9, z - 0.5, x + 0.9, z + 0.5)) continue;
    b.place(terraceTable(k(b), cloths[(z0 / 8) & 1 ? 0 : (ti % 3)], ti), x, y, z);
    b.place(terraceChair(k(b), c.iron, c.iron), x - 0.55, y, z, 1); b.place(terraceChair(k(b), c.iron, c.iron), x + 0.55, y, z, 3);
    b.stools.push([x - 0.55, z, Math.PI / 2, y], [x + 0.55, z, -Math.PI / 2, y]);
    b.cafeTables.push([x, z, y + TERRACE_TOP]);
    if (ti % 2 === 0) b.place(umbrella(c, ti + 5), x, y, z);
    b.block(x - 0.9, z - 0.45, x + 0.9, z + 0.45);
    b.lamp(x, y + 1.1, z, WARM, 2.5, 0.5);
    ti++;
  }
  // the seafront garden: palms, a dragon tree, strelitzia and benches
  for (const [x, z] of [[14, 26], [24, 27], [15.5, 35], [24.5, 49]] as const) { b.place(palmTree(c, (x * 11 + z) | 0), x, floorAt(plan, x, z), z); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  for (const [x, z] of [[18, 25], [25, 33], [13, 31], [20, 49]] as const) b.place(strelitzia(c, (x + z) | 0), x, floorAt(plan, x, z), z);
  // the Jardim Municipal: a lily pond with its fountain, beds of hydrangea and agapanthus, benches round the pond
  // (the garden steps down to the sea in terraces 3.5 m wide: the pond fills one, the beds sit on the others)
  const py = floorAt(plan, 22.6, 35);
  b.place(lilyPond(c), 22.6, py, 35); b.block(21.0, 33.4, 24.2, 36.6);
  b.lamp(22.6, py + 1.2, 35, WHITEWARM, 3, 0.35);
  for (const [x, z, i] of [[12.9, 26.5, 0], [12.9, 33.5, 1], [19.25, 33, 2], [19.25, 27.5, 3], [25.1, 25.5, 4], [25.1, 36.5, 5], [15.75, 36.8, 6], [22.75, 25, 7]] as const) {
    b.place(flowerClump(c, 61 + i), x, floorAt(plan, x, z), z); b.block(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
  }
  for (const [z, t, f] of [[32.7, 0, 0], [37.3, 2, Math.PI]] as const) {
    const y = floorAt(plan, 22.6, z);
    if (Math.abs(y - py) > 0.1) continue;
    b.place(bench(k(b)), 22.6, y, z, t); b.benches.push([22.6, z, f, y]);
  }
}

/** The ribeira's bed: a trickle between boulders inland, bougainvillea spilling over the parapets. */
function ribeira(b: Builder, c: AC, plan: Plan): void {
  const g = b.grid;
  for (let x = VX0; x < Math.floor(PROM_X1 / V); x++) {
    const mx = (x + 0.5) * V, zc = ribZ(mx), bed = layerOf(bedY(mx));
    const z0 = Math.floor((zc - RIB_HALF) / V), z1 = Math.ceil((zc + RIB_HALF) / V);
    if (!g.touches(x, z0 - 1, x, z1 + 1)) continue;
    for (let z = z0; z <= z1; z++) {
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Channel) continue;
      const mz = (z + 0.5) * V;
      // the stream itself where the sea does not reach in
      if (bedY(mx) > -0.5 && Math.abs(mz - zc - Math.sin(mx * 0.3) * 0.8) < 0.4) g.set(x, bed - 1, z, c.levadaWater);
      else if (hash3(x, 31, z) < 0.04) g.box(x, bed, z, x, bed + (hash3(x, 32, z) < 0.5 ? 1 : 0), z, c.lavaB);
    }
    // bougainvillea hanging down the channel walls
    for (const z of [z0 - 1, z1 + 1]) {
      const ci = col(x, z);
      if (plan.kind[ci] === K.Channel) continue;
      const w = plan.walk[ci], inZ = z < z0 ? z + 1 : z - 1;
      if (hash3(x >> 1, 33, z) < 0.35 && hash3(x >> 3, 34, z) < 0.5) for (let y = w + 3; y > Math.max(bed + 2, w - 4 - Math.floor(hash3(x, 35, z) * 8)); y--) if (!g.get(x, y, inZ)) g.set(x, y, inZ, hash3(x, y, 36) < 0.65 ? c.bougain : c.leaf);
    }
  }
}

/** The levada: a stone channel a hand deep along the uphill side of its lane, agapanthus and hydrangeas beside it. */
function levada(b: Builder, c: AC, plan: Plan): void {
  const g = b.grid;
  for (const s of plan.segs) {
    if (!s.levada) continue;
    const [ax, ay, az] = s.a, [bx, , bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    let nx = -(bz - az) / len, nz = (bx - ax) / len;
    if (nx > 0) { nx = -nx; nz = -nz; } // the uphill side is inland (-x)
    const Y = layerOf(ay);
    for (let t = 0; t <= len; t += 0.125) {
      const cx = ax + (bx - ax) * (t / len), cz = az + (bz - az) * (t / len);
      for (let o = 0; o < 3; o++) {
        const d = s.w / 2 + 0.125 + o * V, x = Math.floor((cx + nx * d) / V), z = Math.floor((cz + nz * d) / V);
        if (!g.touches(x, z, x, z)) continue;
        const ci = col(x, z);
        if (plan.kind[ci] !== K.Rock || plan.lot[ci]) continue;
        g.box(x, Y, z, x, Y + 10, z, 0);
        g.box(x, Y - 2, z, x, Y - 1, z, c.lavaB);
        g.set(x, Y, z, o === 1 ? c.levadaWater : c.cantariaB);
        if (o === 1) g.set(x, Y - 1, z, c.moss);
      }
      // agapanthus on the downhill edge now and then
      if (hash3(Math.floor(t * 2), 51, Math.floor(ax)) < 0.18) {
        const d = s.w / 2 - 0.2, x = Math.floor((cx - nx * d) / V), z = Math.floor((cz - nz * d) / V);
        if (g.touches(x, z, x, z) && Math.abs(plan.walk[col(x, z)] - Y) <= 1) { g.set(x, plan.walk[col(x, z)], z, c.leafDark); g.set(x, plan.walk[col(x, z)] + 1, z, hash3(x, 52, z) < 0.5 ? c.agapanthus : c.hydrangea); }
      }
    }
  }
}


/** Fireflies over the lemon pergolas, from the plan alone: the same pergola test as gardens(), on a coarse grid. */
function fireflySpots(plan: Plan): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let z = VZ0 + 8; z < VZ0 + SZ - 8; z += 12)
    for (let x = VX0 + 8; x < VX0 + SX - 8; x += 12) {
      const ci = col(x, z), mx = x * V, mz = z * V;
      if (plan.kind[ci] !== K.Rock || mx > ROAD_X0 || wildRock(x, z, plan.walk[ci])) continue;
      if (hash3(Math.floor(mx / 11), 17, Math.floor(mz / 11)) >= 0.62 || hash3(x, 41, z) > 0.19) continue;
      out.push([mx, (plan.walk[ci] - G) * V + 3.0, mz]); // just above the leaf roof at 2.5 m, where they can be seen
    }
  return out.slice(0, 100);
}

/**
 * A banana plant in voxels: a green pseudostem two metres tall, a crown of long paddle leaves arching out and
 * drooping at the tips (some torn, some dried brown and hanging), and on most a bunch of green fingers with the
 * purple bud below it.
 */
function banana(g: SparseGrid, c: AC, x: number, w: number, z: number, h: number): void {
  const top = w + 7 + Math.floor(h * 3);
  const put = (px: number, py: number, pz: number, v: number) => { if (!g.get(px, py, pz)) g.set(px, py, pz, v); };
  g.box(x, w, z, x, top, z, c.bananaStem);
  if (h > 0.5) g.box(x + 1, w, z, x + 1, w + 3, z, c.bananaStem); // a sucker at its foot
  const n = 6 + Math.floor(h * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + h * 6, len = 6 + ((i * 7 + Math.floor(h * 10)) % 4);
    const dry = i === 0 && h < 0.6;
    let qx = x, qy = top, qz = z;
    for (let s = 1; s <= len; s++) {
      const px = x + Math.round(Math.cos(a) * s * 0.8), pz = z + Math.round(Math.sin(a) * s * 0.8);
      const py = dry ? top - s : top + Math.round(s * 0.7 - s * s * 0.11);
      const v = dry ? c.bananaDry : s === len && (i + s) % 3 === 0 ? c.bananaDry : (s + i) % 2 ? c.banana : c.bananaB;
      // the rib runs on unbroken: where it steps sideways and up at once, a voxel fills the corner
      if (px !== qx && pz !== qz) put(px, qy, qz, v);
      if (py !== qy) put(px, qy, pz, v);
      put(px, py, pz, v);
      qx = px; qy = py; qz = pz;
      // the blade's width either side of the rib
      if (!dry && s > 1 && s < len) { put(px + Math.round(-Math.sin(a)), py, pz + Math.round(Math.cos(a)), c.banana); if (s > 2 && s < len - 1) put(px - Math.round(-Math.sin(a)), py, pz - Math.round(Math.cos(a)), c.bananaB); }
    }
  }
  if (h > 0.3) {
    const fx = x + (h > 0.65 ? 1 : -1);
    for (let y = top - 3; y <= top - 1; y++) { put(fx, y, z, c.bananaFruit); put(fx, y, z + 1, c.bananaFruit); }
    put(fx, top - 4, z, c.grape);
  }
}

/** Vine pergolas and banana plantations on the terraces, dragon trees here and there, laurel above. */
function gardens(b: Builder, c: AC, plan: Plan, inWin: (x: number, z: number) => boolean): void {
  const g = b.grid;
  const RING = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  /** A terrace column with the same level two cells all round (from the plan alone, so every strip agrees). */
  const flatAt = (x: number, z: number) => {
    const ci = col(x, z);
    if (plan.kind[ci] !== K.Rock || x * V > ROAD_X0 || wildRock(x, z, plan.walk[ci])) return false;
    const w = plan.walk[ci];
    for (const [dx, dz] of RING) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== K.Rock || plan.walk[nc] !== w) return false; }
    return true;
  };
  const zoneAt = (x: number, z: number) => hash3(Math.floor((x * V) / 11), 17, Math.floor((z * V) / 11));
  const P = (x: number, z: number) => zoneAt(x, z) < 0.28 && flatAt(x, z);
  /**
   * A limonaia's roof only spreads where it can hang from a pole: along its row to the nearest line of poles (every
   * 2 m), then along that line to a pole, one where the lines cross or one on the grove's rim.
   */
  const supported = (x: number, z: number) => {
    const xa = Math.round(x / 8) * 8, sx = Math.sign(xa - x);
    for (let xx = x; xx !== xa; xx += sx) if (!P(xx, z)) return false;
    const za = Math.round(z / 8) * 8, dz = Math.sign(za - z) || 1;
    for (let zz = z; ; zz += dz) {
      if (!P(xa, zz)) return false;
      if (zz % 8 === 0 || !P(xa, zz + dz)) return true;
    }
  };
  for (let z = VZ0 + 1; z < VZ0 + SZ - 1; z++)
    for (let x = VX0 + 1; x < VX0 + SX - 1; x++) {
      if (!inWin(x, z)) continue;
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Rock) continue;
      const w = plan.walk[ci];
      const mx = x * V;
      if (mx > ROAD_X0) continue;
      const flat = flatAt(x, z), zone = zoneAt(x, z);
      if (zone >= 0.28 && zone < 0.66 && flat) {
        // a banana plantation: plants every 2.5 m in rows along the terrace
        if (((x % 10) + 10) % 10 === 5 && ((z % 10) + 10) % 10 === 5) banana(g, c, x, w, z, hash3(x, 62, z));
        continue;
      }
      if (zone < 0.28 && flat) {
        if (!supported(x, z)) continue;
        // latada: a vine pergola on chestnut poles every 2 m, its roof of vine leaves at 2.5 m and the grapes hanging under it
        const rimX = !P(x - 1, z) || !P(x + 1, z), rimZ = !P(x, z - 1) || !P(x, z + 1);
        const post = (x % 8 === 0 && (z % 8 === 0 || rimZ)) || (z % 8 === 0 && rimX);
        const beam = x % 8 === 0 || z % 8 === 0;
        if (post) g.box(x, w, z, x, w + 9, z, c.pole);
        else if (beam) g.set(x, w + 9, z, c.pole);
        const n = hash3(x, w, z);
        g.set(x, w + 10, z, n < 0.55 ? c.vine : n < 0.85 ? c.vineB : c.leafLight);
        // black nets drawn over part of the grove, leaves pushing through; elsewhere the leaves pile up in lumps
        if (hash3(x, 78, z) < 0.3) g.set(x, w + 11, z, n < 0.5 ? c.leafLight : c.vine);
        // underneath: lemons hanging from the leaves, a long one now and then, and trailing shoots
        if (!beam) {
          const h = hash3(x, w + 9, z);
          if (h < 0.12) { g.set(x, w + 9, z, c.grape); if (h < 0.05) g.set(x, w + 8, z, c.grape); }
          else if (h < 0.3) g.set(x, w + 9, z, c.vineB);
        }
        // the trees themselves, every 4 m between the poles: a trunk rising into the roof, a crown gathered round it
        if (((x % 16) + 16) % 16 === 4 && ((z % 16) + 16) % 16 === 4) {
          g.box(x, w, z, x, w + 9, z, c.trunk);
          for (let y = w + 6; y <= w + 9; y++)
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) {
                if ((dx || dz) && Math.hypot(dx, dz) <= (y - w - 5) * 0.7 + 0.6 && !g.get(x + dx, y, z + dz) && supported(x + dx, z + dz))
                  g.set(x + dx, y, z + dz, hash3(x + dx, y, z + dz) < 0.12 ? c.grape : y === w + 9 ? c.vine : c.vineB);
              }
        }
      } else if (zone > 0.9 && flat && x % 20 === 7 && z % 20 === 3) {
        // a dragon tree: a stout trunk forking into fat branches, each ending in a tuft of blade leaves
        g.box(x, w, z, x + 1, w + 10, z + 1, c.trunk);
        for (const [dx, dz] of [[2, 0], [-2, 1], [0, 2], [1, -2]]) {
          for (let i = 1; i <= 3; i++) g.set(x + Math.sign(dx) * i + (dx ? 0 : 0), w + 10 + i, z + Math.sign(dz) * i, c.trunk);
          const tx = x + Math.sign(dx) * 3, tz = z + Math.sign(dz) * 3, ty = w + 14;
          for (let ox = -2; ox <= 2; ox++) for (let oz = -2; oz <= 2; oz++) if (Math.abs(ox) + Math.abs(oz) <= 2) g.set(tx + ox, ty + (Math.abs(ox) + Math.abs(oz) === 2 ? 0 : 1), tz + oz, c.strelLeaf);
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
    // (a lemon tree spreads nearly 4 m: room for all of it on one level)
    for (let dz = -8; dz <= 8 && flat; dz += 4) for (let dx = -8; dx <= 8 && flat; dx += 4) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== K.Rock || plan.walk[nc] !== plan.walk[ci]) flat = false; }
    if (!flat) continue;
    const y = (plan.walk[ci] - G) * V;
    if (x * V > ROAD_X0) continue;
    const wild = wildRock(x, z, plan.walk[ci]);
    if (wild || kind < 0.25) b.place(laurelTree(c, seed), x * V, y, z * V);
    else if (kind < 0.45) b.place(jacaranda(c, seed), x * V, y, z * V);
    else if (kind < 0.6) b.place(lemonTree(c, seed, false), x * V, y, z * V);
    else if (kind < 0.72) b.place(palmTree(c, seed), x * V, y, z * V);
    else if (kind < 0.88) b.place(strelitzia(c, seed), x * V, y, z * V);
    else if (kind < 0.95) b.place(bush(b.k, seed), x * V, y, z * V);
    else b.place(grassTuft(b.k, seed), x * V, y, z * V);
  }
}

/** The turns that point a prop's front (+z as built) along a direction, to the nearest axis. */
function faceTurn(fx: number, fz: number): number {
  return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 0 : 2);
}

/** Linen shirts and dresses on a rail outside a shop. Faces +z. */
function clothesRail(c: AC, seed: number): Prop {
  const p = new Prop(12, 14, 4);
  p.box(0, 0, 2, 0, 13, 2, c.iron); p.box(11, 0, 2, 11, 13, 2, c.iron); p.box(0, 13, 2, 11, 13, 2, c.iron);
  const cols = [c.white, c.sky, c.lemonWall, c.whiteWarm, c.sage, c.rose];
  for (let x = 1; x < 11; x += 2) {
    const col = cols[Math.floor(hash3(x, seed, 5) * cols.length)];
    const long = hash3(seed, x, 9) < 0.4;
    p.box(x, long ? 3 : 6, 1, x + 1, 12, 3, col);
  }
  return p;
}

/** A shelf of limoncello bottles and jars of lemon sweets by a shop door. Faces +z. */
function limoncelloShelf(c: AC, seed: number): Prop {
  const p = new Prop(10, 14, 3);
  p.box(0, 0, 0, 9, 13, 0, c.deckWood);
  p.box(0, 0, 0, 0, 13, 2, c.deckWood); p.box(9, 0, 0, 9, 13, 2, c.deckWood);
  for (const y of [0, 4, 8]) {
    p.box(1, y, 1, 8, y, 2, c.deckWood);
    for (let x = 1; x < 9; x += 2) {
      const h = hash3(x, y, seed) < 0.5 ? 3 : 2;
      p.box(x, y + 1, 1, x, y + h, 1, h === 3 ? c.lemon : c.majolicaWhite);
      if (h === 3) p.set(x, y + 3, 1, c.cotto);
    }
  }
  p.box(1, 12, 0, 8, 13, 0, c.lemon); // the painted sign
  return p;
}

/** A striped canvas awning over a shop door, out from the wall. Faces +z. */
function awning(c: AC, col: number): Prop {
  const p = new Prop(18, 4, 9);
  for (let z = 0; z < 9; z++) p.box(0, 3 - Math.floor(z / 3), z, 17, 3 - Math.floor(z / 3), z, (x) => ((x >> 1) % 2 ? col : c.white));
  p.box(0, 0, 8, 17, 0, 8, (x) => ((x >> 1) % 2 ? col : c.white)); // the valance
  return p;
}

/**
 * Via Lorenzo d'Amalfi and the streets off the piazza: the shops spill out of their doors, ceramics on racks,
 * limoncello on shelves, linen on rails and crates of lemons, under striped awnings.
 */
type Extra = { pos: [number, number, number]; face: number; seed: number; indoor?: boolean };

/**
 * The Mercado dos Lavradores at work: a seller behind every fruit trestle in the courtyard, shoppers picking over
 * the fruit in front of them and along the fish and flower counters round the covered walk.
 */
function marketFolk(): Extra[] {
  const X0 = Math.round(MERCADO[0] / V), Z0 = Math.round(MERCADO[1] / V), X1 = Math.round(MERCADO[2] / V) - 1, Z1 = Math.round(MERCADO[3] / V) - 1, IN = 16;
  const out: Extra[] = [], y = PIAZZA_Y;
  let n = 0;
  for (let row = 0; row < 3; row++) {
    const z = Z0 + IN + 8 + row * 18;
    for (let x = X0 + IN + 6; x < X1 - IN - 18; x += 14) {
      out.push({ pos: [(x + 4.5) * V, y, (z + 6.5) * V], face: Math.PI, seed: 8200 + n++ * 11 });
      if ((row + x) % 2) out.push({ pos: [(x + 2.5 + (n % 3) * 2) * V, y, (z - 2.5) * V], face: 0, seed: 8200 + n++ * 11 });
    }
  }
  // along the counters on the walk: fish on the west side, fruit and flowers elsewhere
  for (const zz of [Z0 + 30, Z0 + 52, Z1 - 30]) out.push({ pos: [(X0 + 7.5) * V, y, (zz + 0.5) * V], face: -Math.PI / 2, seed: 8200 + n++ * 11 });
  for (const xx of [X0 + 34, X1 - 30]) {
    out.push({ pos: [(xx + 0.5) * V, y, (Z0 + 7.5) * V], face: Math.PI, seed: 8200 + n++ * 11 });
    out.push({ pos: [(xx + 6.5) * V, y, (Z1 - 6.5) * V], face: 0, seed: 8200 + n++ * 11 });
  }
  return out;
}

/** A fishing rod held out over the water, its line down to the surface. Faces +z; `diag` leans it out along +x+z. */
function fishingRod(c: AC, rise: number, diag: boolean): Prop {
  const L = 30, top = rise + 22, p = new Prop(diag ? L + 2 : 1, top + 2, L + 2, 0.0625);
  for (let i = 0; i <= L; i++) {
    const y = rise + Math.round(i * 22 / L), x = diag ? i : 0;
    p.set(x, y, i, i < 6 ? c.door : c.iron);
    if (diag && i < L) p.set(x + 1, y, i, c.iron);
  }
  for (let y = 0; y < top; y++) p.set(diag ? L : 0, y, L + 1, c.white);
  return p;
}

/** A cool box beside an angler. */
function coolBox(c: AC): Prop {
  const p = new Prop(6, 5, 4, 0.0625);
  p.box(0, 0, 0, 5, 3, 3, c.ferryBlue);
  p.box(0, 4, 0, 5, 4, 3, c.white);
  return p;
}

/**
 * Anglers along the promenade where it meets the basin, and out at the end of the breakwater, as there always are
 * of an evening in Funchal: a rod out over the water, a cool box at their feet.
 */
function anglers(b: Builder, c: AC, plan: Plan, out: Extra[]): void {
  const spots: [number, number, number][] = [];
  for (const z of [-56.5, -51.5, -46.5]) spots.push([PROM_X1 - 0.55, z, Math.PI / 2]);
  for (const a of [0.42, 0.58, 0.74]) {
    const r = moleRadii(a)[0] + 0.95;
    spots.push([MAR_CX + Math.cos(a) * r, MAR_CZ + Math.sin(a) * r, Math.atan2(-Math.cos(a), -Math.sin(a))]);
  }
  spots.forEach(([x, z, face], i) => {
    const fl = floorAt(plan, x, z);
    const deg = face * 180 / Math.PI;
    const straight = i < 3;
    const turn = straight ? (((Math.round(deg / 90)) % 4) + 4) % 4 : (((Math.round((deg - 45) / 90)) % 4) + 4) % 4;
    const th = straight ? turn * Math.PI / 2 : Math.PI / 4 + turn * Math.PI / 2;
    const dx = Math.sin(th), dz = Math.cos(th);
    const base = SEA_Y + 0.1, rise = Math.round((fl + 0.8 - base) / 0.0625);
    const half = 31 * 0.0625 / 2;
    b.place(fishingRod(c, rise, !straight), x + dx * (0.3 + half), base, z + dz * (0.3 + half), turn);
    b.place(coolBox(c), x - dz * 0.5, fl, z + dx * 0.5, turn);
    out.push({ pos: [x, fl, z], face: th, seed: 8600 + i * 13 });
  });
}

function shopfronts(b: Builder, c: AC, plan: Plan, out: Extra[]): void {
  const r = rng(5150);
  const awnings = [c.umbrellaC, c.umbrellaA, c.umbrellaE, c.majolicaYellow, c.hullRed];
  for (const s of plan.segs) {
    if (s.kind !== K.Street) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (const side of [1, -1]) {
      for (let t = 2 + r() * 2; t < len - 2; t += 3.2 + r() * 2.4) {
        if (r() < 0.35) continue;
        const f = t / len;
        // the house front: a little way past the edge of the paving, across a step or a strip of garden
        const ex = ax + (bx - ax) * f + nx * (s.w / 2) * side, ez = az + (bz - az) * f + nz * (s.w / 2) * side;
        const y = ay + (by - ay) * f;
        let d = -0.5;
        while (d <= 1.75 && !plan.lot[col(Math.floor((ex + nx * side * d) / V), Math.floor((ez + nz * side * d) / V))]) d += 0.25;
        // no house close by: the goods stand against the street's own wall
        const front = d <= 1.75;
        const lid = front ? plan.lot[col(Math.floor((ex + nx * side * d) / V), Math.floor((ez + nz * side * d) / V))] : 0;
        if (lid && (plan.lots[lid - 1].food || plan.lots[lid - 1].hotel)) continue; // a restaurant's or a hotel's door, kept clear
        const back = front ? d - 0.4 : -0.4;
        const x = ex + nx * side * back, z = ez + nz * side * back;
        const fl = (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
        if (Math.abs(fl - y) > 0.6) continue;
        const turn = faceTurn(-nx * side, -nz * side);
        const pick = r();
        const prop = pick < 0.3 ? ceramicRack(c, Math.floor(r() * 1e4)) : pick < 0.55 ? limoncelloShelf(c, Math.floor(r() * 1e4)) : pick < 0.8 ? clothesRail(c, Math.floor(r() * 1e4)) : crateLemons(c, Math.floor(r() * 1e4));
        b.place(prop, x, fl, z, turn);
        b.block(x - 0.6, z - 0.6, x + 0.6, z + 0.6);
        if (front && r() < 0.6) b.place(awning(c, awnings[Math.floor(r() * awnings.length)]), ex + nx * side * (d - 0.5625), fl + 2.5, ez + nz * side * (d - 0.5625), turn); // its back against the wall
        // the shopkeeper out on the step beside the goods, where the street is wide enough to stand in
        if (front && s.w >= 3.5 && r() < 0.45) {
          const ux = (bx - ax) / len, uz = (bz - az) / len, kx = x + ux * 0.95, kz = z + uz * 0.95;
          const kc = col(Math.floor(kx / V), Math.floor(kz / V));
          if (!plan.lot[kc] && Math.abs((plan.walk[kc] - G) * V - fl) < 0.3) { out.push({ pos: [kx, fl, kz], face: Math.atan2(-nx * side, -nz * side), seed: 9000 + out.length * 7 }); b.block(kx - 0.3, kz - 0.3, kx + 0.3, kz + 0.3); }
        }
      }
    }
  }
}

/**
 * Washing hung on a line across a narrow lane, house to house, high enough to walk under; the sparrows use the line
 * too. Decided from the plan alone, so every worker strings the same lines.
 */
function washingLines(b: Builder, c: AC, plan: Plan): void {
  const r = rng(909);
  const g = b.grid;
  const cols = [c.white, c.sky, c.pink, c.yellow, c.umbrellaC, c.whiteWarm, c.hullRed];
  const lotAt = (x: number, z: number) => plan.lot[col(Math.floor(x / V), Math.floor(z / V))];
  for (const s of plan.segs) {
    if (s.kind !== K.Lane && s.kind !== K.Stair && s.kind !== K.Street) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 2 + r() * 4; t < len - 2; t += 2.5 + r() * 3) {
      if (r() < 0.15) continue;
      const f = t / len, cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, y = ay + (by - ay) * f;
      // a house wall within reach on both sides
      let d1 = -1, d2 = -1, l1 = 0, l2 = 0;
      for (let d = s.w / 2 - 0.5; d < s.w / 2 + 2.6 && d1 < 0; d += 0.25) if ((l1 = lotAt(cx + nx * d, cz + nz * d))) d1 = d;
      for (let d = s.w / 2 - 0.5; d < s.w / 2 + 2.6 && d2 < 0; d += 0.25) if ((l2 = lotAt(cx - nx * d, cz - nz * d))) d2 = d;
      if (d1 < 0 || d2 < 0) continue;
      // both walls must stand above the line: tied under the eaves, high enough to walk under
      const hi = Math.min(plan.lots[l1 - 1].top, plan.lots[l2 - 1].top) - 3;
      const lo = Math.max(layerOf(y + 3.2), plan.lots[l1 - 1].base + 6, plan.lots[l2 - 1].base + 6);
      if (hi < lo) continue;
      const x0 = cx + nx * d1, z0 = cz + nz * d1, x1 = cx - nx * d2, z1 = cz - nz * d2;
      const Y = Math.min(hi, Math.max(lo, layerOf(y + 4.3 + r() * 0.8)));
      const span = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(span / (V * 0.5));
      const ax2 = (x1 - x0) / span, az2 = (z1 - z0) / span;
      let lx = NaN, lz = NaN;
      for (let i = -2; i <= n + 2; i++) {
        // (two half-voxel steps past each end, into the walls the line is tied to)
        const k = i / n, vx = Math.floor((x0 + (x1 - x0) * k) / V), vz = Math.floor((z0 + (z1 - z0) * k) / V);
        if (vx === lx && vz === lz) continue;
        if (vx !== lx && vz !== lz && !Number.isNaN(lx) && !g.get(lx, Y, vz)) g.set(lx, Y, vz, c.iron); // a corner, not a diagonal
        lx = vx; lz = vz;
        if (!g.get(vx, Y, vz)) g.set(vx, Y, vz, c.iron);
        if (i < 0 || i > n) continue;
        // a shirt, a towel, a sheet now and then: every other cell along the line
        if (i % 4 === 2 && hash3(vx, Y, vz) < 0.75 && i > 2 && i < n - 2 && g.touches(vx, vz, vx, vz)) {
          const drop = hash3(vz, Y, vx) < 0.25 ? 5 : 3;
          const cl = cols[Math.floor(hash3(vx, 3, vz) * cols.length)];
          const id = b.addSway({ ...SWAY.laundry, pivot: [(vx + 0.5) * V, (Y + 0.5 - G) * V, (vz + 0.5) * V], axis: [ax2, 0, az2], reach: 0 });
          for (let yy = Y - drop; yy < Y; yy++) if (!g.get(vx, yy, vz)) { g.set(vx, yy, vz, cl); b.swayCell(vx, yy, vz, id); }
        }
      }
      b.wires.push([x0, z0, x1, z1, (Y + 1 - G) * V, 0.05]);
    }
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
      const cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, cy = ay + (by - ay) * f;
      const x = cx + nx * off * side, z = cz + nz * off * side;
      // everything stands on the ground actually under it; where that is not this lane (another path or a drop
      // beside a flight of steps) the spot is left alone
      const y = floorAt(plan, x, z), own = (py: number) => Math.abs(py - cy) < 0.8;
      // wall lantern on the house beside the lane, if there is one, else a post
      const vx = Math.floor((x + nx * side * 0.5) / V), vz = Math.floor((z + nz * side * 0.5) / V);
      const beside = plan.lot[col(vx, vz)];
      if (beside) {
        // fixed to the wall itself: lots stand 0.6 m off the lane's edge
        const wo = s.w / 2 + 0.6 - 0.25, lx = cx + nx * wo * side, lz = cz + nz * wo * side;
        b.place(wallLantern(c), lx, cy + 2.6, lz, faceTurn(-nx * side, -nz * side));
        b.lamp(lx, cy + 2.6, lz, WARM, 5.5, 0.75);
      } else if (own(y) && plan.kind[col(Math.floor(x / V), Math.floor(z / V))] !== K.Steps) {
        // (never on the cathedral's flight, which keeps its own pair of lamps)
        b.place(lampPost(c), x, layerY(y), z);
        b.lamp(x, y + 2.6, z, WARM, 5.5, 0.75);
      }
      const ex = cx - nx * off * side, ez = cz - nz * off * side, ey = floorAt(plan, ex, ez);
      if (!own(ey)) continue;
      if (r() < 0.5) b.place(geraniumPot(c, Math.floor(r() * 1e4)), ex, ey, ez);
      else if (r() < 0.4) b.place(potLemon(c, Math.floor(r() * 1e4)), ex, ey, ez);
    }
  }
}

/** A wayside shrine: the Madonna in majolica in a marble niche under a little tiled roof, flowers and a red lamp on its ledge. Back to the wall at z = 0. */
function shrine(c: AC, pc: PaintColors, seed: number): Prop {
  const p = new Prop(8, 14, 4);
  p.box(0, 1, 0, 7, 12, 0, c.majolicaWhite);
  // the picture: the Madonna and Child in a blue mantle under a gold halo, on yellow tiles in a blue border
  const im = picture(pc, 'madonna', 6, 9, seed);
  for (let v = 0; v < 9; v++) for (let u = 0; u < 6; u++) p.set(1 + u, 2 + v, 0, im.get(u, v));
  // the marble surround and the ledge
  p.box(0, 1, 1, 0, 11, 1, c.marble); p.box(7, 1, 1, 7, 11, 1, c.marble);
  p.box(0, 0, 0, 7, 1, 3, c.marble);
  p.box(0, 11, 1, 7, 11, 1, c.marble);
  // a tiled hood
  p.box(0, 12, 0, 7, 12, 2, c.terracotta); p.box(1, 13, 0, 6, 13, 1, c.terracotta);
  // flowers either side, the lamp in the middle
  const fl = seed % 2 ? c.geranium : c.bougain;
  p.box(1, 2, 2, 1, 3, 2, c.majolicaWhite); p.box(1, 4, 2, 1, 4, 3, fl); p.set(1, 4, 1, c.leaf);
  p.box(6, 2, 2, 6, 3, 2, c.majolicaWhite); p.box(6, 4, 2, 6, 4, 3, fl); p.set(6, 4, 1, c.leaf);
  p.box(3, 2, 2, 4, 3, 2, c.lampGlowAlways);
  return p;
}

/** A majolica street plaque: a white tile with a blue border and the name in dark letters. Back to the wall at z = 0. */
function streetPlaque(c: AC, seed: number): Prop {
  const p = new Prop(9, 5, 1);
  p.box(0, 0, 0, 8, 4, 0, (x, y) => (x === 0 || x === 8 || y === 0 || y === 4 ? c.majolicaBlue : (y === 2 && hash3(x, seed, 3) < 0.7 ? c.stripeDark : c.majolicaWhite)));
  p.set(1, 3, 0, c.majolicaYellow); p.set(7, 3, 0, c.majolicaYellow);
  return p;
}

/**
 * The lanes lived in: wayside shrines on the house walls, majolica plaques with the street names where lanes begin,
 * and Vespas parked along the wider streets. Decided from the plan alone, so every worker dresses the same lanes.
 */
function laneDress(b: Builder, c: AC, plan: Plan): void {
  const r = rng(6161);
  const vespa = [c.hullRed, c.sky, c.majolicaYellow, c.whiteWarm, c.hullGreen];
  for (const s of plan.segs) {
    if (s.kind !== K.Lane && s.kind !== K.Street && s.kind !== K.Stair) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 4) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = -uz, nz = ux;
    /** The house wall beside the lane at t on a side, if a house stands there (not a restaurant's or hotel's front). */
    const wallAt = (t: number, side: number, depth: number, h0: number, h1: number) => {
      const cx = ax + ux * t, cz = az + uz * t, y = ay + (by - ay) * (t / len);
      // march out from the middle of the lane to the first voxel of a house
      let d = s.w / 2 - 0.25, id = 0;
      for (; d < s.w / 2 + 1.5 && !id; d += 0.125) id = plan.lot[col(Math.floor((cx + nx * side * d) / V), Math.floor((cz + nz * side * d) / V))];
      if (!id) return null;
      const lt = plan.lots[id - 1];
      if (lt.food || lt.hotel || (lt.base - G) * V > y + h0 || (lt.top - G) * V < y + h1) return null;
      // (d now sits one step inside the wall: back off to its face, then half the prop's depth)
      const o = d - 0.125 - depth / 2;
      return { x: cx + nx * o * side, z: cz + nz * o * side, y, turn: faceTurn(-nx * side, -nz * side) };
    };
    // the street's name where it starts
    if (len > 10) {
      const side = r() < 0.5 ? 1 : -1;
      const w = wallAt(1.6, side, 0.125, 2.3, 3.3) ?? wallAt(1.6, -side, 0.125, 2.3, 3.3);
      if (w) b.place(streetPlaque(c, Math.floor(r() * 1e4)), w.x, w.y + 2.5, w.z, w.turn);
    }
    // a shrine every so often, at eye height
    for (let t = 6 + r() * 10; t < len - 3; t += 22 + r() * 16) {
      const side = r() < 0.5 ? 1 : -1;
      const w = wallAt(t, side, 0.5, 1.1, 3.2);
      if (!w) continue;
      b.place(shrine(c, paintColors(b), Math.floor(r() * 1e4)), w.x, w.y + 1.3, w.z, w.turn);
      b.lamp(w.x, w.y + 1.6, w.z, [1, 0.55, 0.35], 2.2, 0.45);
    }
    // Vespas against the wall of the wider streets, along the kerb
    if (s.kind === K.Street && s.w >= 3.4)
      for (let t = 4 + r() * 6; t < len - 3; t += 7 + r() * 9) {
        if (r() < 0.4) continue;
        const side = r() < 0.5 ? 1 : -1;
        const off = s.w / 2 - 0.35;
        const x = ax + ux * t + nx * off * side, z = az + uz * t + nz * off * side;
        const y = floorAt(plan, x, z);
        if (Math.abs(y - (ay + (by - ay) * (t / len))) > 0.3) continue;
        b.place(scooter(k(b), vespa[Math.floor(r() * vespa.length)]), x, layerY(y), z, Math.abs(ux) > Math.abs(uz) ? 0 : 1);
        b.block(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
      }
  }
}

// ------------------------------------------------------------------------------------------- food

const STALL_SPOTS: { id: string; kind: 'pastry' | 'fry' | 'pizza' | 'gelato' | 'lemon'; x: number; z: number; face: number }[] = [
  { id: 'caco', kind: 'pizza', x: 36.6, z: 2, face: -Math.PI / 2 },
  { id: 'poncha', kind: 'lemon', x: 10.4, z: 42, face: -Math.PI / 2 },
  { id: 'frutas', kind: 'gelato', x: -18, z: 41.2, face: Math.PI },
  { id: 'malasadas', kind: 'fry', x: 4, z: -19, face: 0 },
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
    const reach = s.kind === 'pizza' ? 2.1 : 1.6;
    const stand: [number, number] = [s.x + fx * reach, s.z + fz * reach];
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
function segredo(b: Builder, c: AC, anchors: Anchors): BuildResult['interior'] {
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
  g.box(0, 0, 0, ISX - 1, G - 1, ISZ - 1, c.lava);
  for (let z = 0; z < ISZ; z++) for (let x = 0; x < ISX; x++) g.set(x, G - 1, z, (x >> 2) % 2 === (z >> 2) % 2 ? c.cotto : c.cottoB);
  // tufa walls on the two far sides, vaulting over towards the open ones
  g.box(0, G, 0, 2, G + 17, ISZ - 1, (x, y, z) => (hash3(x, y >> 1, z >> 1) < 0.5 ? c.lavaB : c.lava));
  g.box(0, G, 0, ISX - 1, G + 17, 2, (x, y, z) => (hash3(x >> 1, y >> 1, z) < 0.5 ? c.lavaB : c.lava));
  for (let y = 0; y < 6; y++) { g.box(3, G + 12 + y, 3, 3 + 6 - y, G + 12 + y, ISZ - 1, c.lavaB); g.box(3, G + 12 + y, 3, ISX - 1, G + 12 + y, 3 + 6 - y, c.lavaB); }
  // the marble counter (same footprint the bake keeps clear for any hidden kitchen) and the prep shelf behind it
  g.box(8, G, 22, 44, G + 2, 25, c.azulejo);
  g.box(8, G, 22, 44, G + 2, 22, (x, y) => ((x + y) % 2 === 0 ? c.azulejo : c.azulejoW));
  g.box(8, G + 3, 21, 44, G + 3, 26, c.marble);
  g.box(6, G, 6, 44, G + 3, 10, c.door);
  g.box(6, G + 4, 6, 44, G + 4, 10, c.marbleGrey);
  // shelves of jars, lemons and limoncello bottles
  g.box(6, G + 8, 2, 44, G + 8, 4, c.door);
  for (let x = 8; x < 42; x += 2) g.box(x, G + 9, 3, x, G + 10, 3, [c.door, c.glass, c.banana, c.geranium][(x / 2) % 4]);
  // a wood-fired oven in the alcove, glowing
  g.box(44, G, 2, 56, G + 10, 7, c.lavaB);
  for (let y = 0; y < 5; y++) g.box(45 + y, G + 11 + y, 2, 55 - y, G + 11 + y, 7, c.lava);
  g.box(48, G + 3, 7, 52, G + 7, 7, c.glassLit);
  g.box(49, G + 4, 7, 51, G + 6, 7, c.lampGlowAlways);
  // garlic and peppers hanging from the vault
  for (let x = 10; x < 42; x += 5) g.box(x, G + 12, 14, x, G + 14, 14, x % 2 ? c.geranium : c.marble);
  // stools along the counter
  for (let i = 0; i < 6; i++) place(stool(b.k, c.door), (10.5 + i * 5.5) * V, 0, 30 * V);
  place(strelitzia(c, 404, true), 58 * V, 0, 40 * V);
  place(strelitzia(c, 405, true), 4 * V, 0, 44 * V);
  place(buildFood('gaiado', b.pal), 20 * V, 1.0, 23 * V, 2);
  place(buildFood('pudim', b.pal), 33 * V, 1.0, 23 * V, 2);
  lamp(18 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(34 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(50 * V, 1.5, 9 * V, [1, 0.55, 0.25], 6, 1.4);
  lamp(30 * V, 2.0, 8 * V, WHITEWARM, 6, 0.7);
  lamp(4 * V, 2.2, 30 * V, WARM, 4, 0.6);
  hiddenKitchenDress({ pal: b.pal, g, place, lamp, G, style: 'it', wood: c.door, top: c.azulejoW, cushion: [c.hullRed, c.shutterBlue], seed: 2538 });
  // the way out: a low door at the front corner
  g.box(56, G, 44, 63, G + 12, 47, c.lavaB);
  g.box(58, G, 44, 61, G + 9, 44, c.door);
  anchors.interiorSpawn = [ox + 14.75, 0, oz + 10.0];
  anchors.interiorExit = [ox + 14.9, oz + 10.6];
  anchors.chef = [ox + 6.5, 0, oz + 4.4];
  anchors.counterStand = [ox + 6.5, oz + 7.3];
  return { grid: g, props, lamps };
}

// ------------------------------------------------------------------------------------------- restaurants

/**
 * The layout of a restaurant's room, in its own coordinates: `a` runs along the front (0 .. W-1), `d` in from it
 * (0 = the front wall .. D-1 = the back wall), whole cells. Worked out from the plan alone so every worker places
 * the same seats, counter and cook, whatever strip it builds.
 */
function eateryLayout(lt: LotPlan) {
  const along = lt.side === 'n' || lt.side === 's';
  const W = along ? lt.x1 - lt.x0 + 1 : lt.z1 - lt.z0 + 1, D = along ? lt.z1 - lt.z0 + 1 : lt.x1 - lt.x0 + 1;
  const mid = Math.floor(W / 2);
  // the counter across the back, a gap at one end for the cook; the cook behind it, the customer in front
  const ca0 = 2, ca1 = W - 6, cd0 = D - 6, cd1 = D - 5;
  const tables: { a: number; d: number }[] = [];
  for (let d = 3; d + 1 <= D - 10; d += 4) {
    for (let a = 2; a + 2 <= mid - 4; a += 5) tables.push({ a, d });
    for (let a = mid + 5; a + 2 <= W - 2; a += 5) tables.push({ a, d });
  }
  // continuous local coordinates (a cell's middle is +0.5) to world metres
  const P = (a: number, d: number): [number, number] => {
    const { x0, z0, x1, z1 } = lt;
    switch (lt.side) {
      case 'n': return [(x0 + a) * V, (z0 + d) * V];
      case 's': return [(x1 + 1 - a) * V, (z1 + 1 - d) * V];
      case 'w': return [(x0 + d) * V, (z1 + 1 - a) * V];
      default: return [(x1 + 1 - d) * V, (z0 + a) * V];
    }
  };
  // world directions of +a and of "out of the front"
  const out: [number, number] = lt.side === 'n' ? [0, -1] : lt.side === 's' ? [0, 1] : lt.side === 'w' ? [-1, 0] : [1, 0];
  const ax: [number, number] = lt.side === 'n' ? [1, 0] : lt.side === 's' ? [-1, 0] : lt.side === 'w' ? [0, -1] : [0, 1];
  const vendor = { a: (ca0 + ca1 + 1) / 2, d: D - 2.5 }, stand = { a: (ca0 + ca1 + 1) / 2, d: D - 7.4 };
  return { W, D, mid, ca0, ca1, cd0, cd1, tables, P, out, ax, vendor, stand, floorY: (lt.base + 1 - G) * V };
}

/** Which tables have someone eating at them: a seat each side, about half of them taken. */
function eaterySeats(lt: LotPlan) {
  const L = eateryLayout(lt);
  const seats: { x: number; z: number; face: number; taken: boolean; table: [number, number] }[] = [];
  L.tables.forEach((t, i) => {
    const table = L.P(t.a + 1, t.d + 1);
    for (const s of [-1, 1]) {
      const [x, z] = L.P(s < 0 ? t.a - 0.5 : t.a + 2.5, t.d + 1);
      const dir = s < 0 ? L.ax : [-L.ax[0], -L.ax[1]];
      seats.push({ x, z, face: Math.atan2(dir[0], dir[1]), taken: hash3(lt.seed + i, s + 3, 17) < 0.4, table });
    }
  });
  return seats;
}

/** The stall anchors and walkable rooms of every restaurant (pure: every worker registers the same ones). */
function eateryAnchors(plan: Plan): { stalls: StallAnchor[]; rooms: RoomAnchor[] } {
  const stalls: StallAnchor[] = [], rooms: RoomAnchor[] = [];
  for (const lt of plan.lots) {
    if (!lt.food) continue;
    const L = eateryLayout(lt);
    const [vx, vz] = L.P(L.vendor.a, L.vendor.d), [sx, sz] = L.P(L.stand.a, L.stand.d);
    const [lx, lz] = L.P(L.mid + 0.5, -0.6);
    stalls.push({ id: lt.food, stand: [sx, sz], vendor: [vx, vz, Math.atan2(L.out[0], L.out[1])], label: [lx, L.floorY + 3.5, lz] });
    const [ax0, az0] = L.P(1, 1), [ax1, az1] = L.P(L.W - 1, L.D - 1);
    const [dx, dz] = L.P(L.mid + 0.5, 1.6);
    const all = eaterySeats(lt);
    const npcs: RoomNpc[] = all.filter((s) => s.taken).map((s, i) => ({ role: 'guest', pos: [s.x, L.floorY + 0.5, s.z], facing: s.face, sit: true, seed: lt.seed + i * 13 }));
    rooms.push({
      id: `eat-${lt.food}`, kind: 'cafe', nth: rooms.length, stall: lt.food,
      rect: [Math.min(ax0, ax1), Math.min(az0, az1), Math.max(ax0, ax1), Math.max(az0, az1)],
      door: [dx, dz], npcs, spots: [],
      seats: all.map((s) => ({ pos: [s.x, L.floorY + 0.5, s.z], face: s.face, table: [s.table[0], L.floorY + 0.75, s.table[1]], taken: s.taken })),
    });
  }
  return { stalls, rooms };
}

/** A rush-seated wooden chair, its back to -z (faces +z before turning). */
function chair(c: AC, wood: number): Prop {
  const p = new Prop(3, 7, 3);
  for (const [x, z] of [[0, 0], [2, 0], [0, 2], [2, 2]]) p.box(x, 0, z, x, 2, z, wood);
  p.box(0, 3, 0, 2, 3, 2, c.rope);
  p.box(0, 4, 0, 0, 6, 0, wood); p.box(2, 4, 0, 2, 6, 0, wood);
  p.box(0, 5, 0, 2, 5, 0, wood); p.box(0, 6, 0, 2, 6, 0, wood);
  return p;
}

/** A small square table under a cloth that hangs over its edges. */
function eatTable(_c: AC, cloth: number, cloth2: number, wood: number): Prop {
  const p = new Prop(5, 6, 5);
  p.box(2, 0, 2, 2, 4, 2, wood);
  p.box(1, 0, 1, 3, 0, 3, wood);
  p.box(0, 5, 0, 4, 5, 4, (x, _y, z) => ((x + z) % 2 ? cloth : cloth2));
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 0], [0, 2], [4, 2], [2, 4]]) p.set(x, 4, z, (x + z) % 2 ? cloth : cloth2);
  return p; // (what is laid on it comes from the dining kit: see eateryDress)
}

const EAT_THEME: Record<string, { floor: 'cotto' | 'check' | 'majolica' | 'plank' | 'marble' | 'tile'; wall: ACol; wain: ACol; cloth: [ACol, ACol]; front: ACol; awning: [ACol, ACol] }> = {
  cafe: { floor: 'check', wall: 'cream', wain: 'shutterGreen', cloth: ['white', 'white'], front: 'shutterGreen', awning: ['shutterGreen', 'white'] },
  pastelaria: { floor: 'check', wall: 'white', wain: 'azulejo', cloth: ['pink', 'white'], front: 'shutterBrown', awning: ['ochre', 'white'] },
  espetada: { floor: 'cotto', wall: 'whiteWarm', wain: 'cantaria', cloth: ['hullRed', 'white'], front: 'door', awning: ['hullRed', 'white'] },
  espada: { floor: 'majolica', wall: 'white', wain: 'azulejo', cloth: ['umbrellaC', 'white'], front: 'shutterBlue', awning: ['umbrellaC', 'white'] },
  atum: { floor: 'plank', wall: 'whiteWarm', wain: 'shutterBlue', cloth: ['white', 'umbrellaC'], front: 'shutterBlue', awning: ['ferryBlue', 'white'] },
  tasca: { floor: 'cotto', wall: 'plasterOld', wain: 'shutterGreen', cloth: ['hullGreen', 'cream'], front: 'shutterGreen', awning: ['hullGreen', 'cream'] },
  adega: { floor: 'plank', wall: 'cantariaB', wain: 'door', cloth: ['stripeDark', 'stripeDark'], front: 'door', awning: ['door', 'ochre'] },
  picado: { floor: 'tile', wall: 'cream', wain: 'ochre', cloth: ['majolicaYellow', 'white'], front: 'shutterBrown', awning: ['majolicaYellow', 'white'] },
  mercado: { floor: 'tile', wall: 'whiteWarm', wain: 'azulejo', cloth: ['white', 'white'], front: 'shutterGreen', awning: ['shutterGreen', 'white'] },
  churrasqueira: { floor: 'cotto', wall: 'cream', wain: 'cantaria', cloth: ['hullRed', 'white'], front: 'shutterBrown', awning: ['hullRed', 'cream'] },
  taberna: { floor: 'plank', wall: 'white', wain: 'shutterBlue', cloth: ['ferryBlue', 'white'], front: 'shutterBlue', awning: ['ferryBlue', 'white'] },
  cha: { floor: 'marble', wall: 'white', wain: 'shutterGreen', cloth: ['white', 'cream'], front: 'shutterGreen', awning: ['hullGreen', 'white'] },
  gelataria: { floor: 'check', wall: 'white', wain: 'ochre', cloth: ['majolicaYellow', 'white'], front: 'ochre', awning: ['majolicaYellow', 'white'] },
  snack: { floor: 'tile', wall: 'cream', wain: 'hullRed', cloth: ['hullRed', 'white'], front: 'hullRed', awning: ['hullRed', 'white'] },
};
/** Which of the Amalfi rooms each Funchal place furnishes itself like: the coffee bar, the pastry case, the hearth, the fish on ice... */
const EAT_LOOK: Record<string, string> = { cafe: 'duomo', pastelaria: 'dolceria', espetada: 'masseria', espada: 'saraceno', atum: 'colatura', tasca: 'gemma', adega: 'cantina', picado: 'ruocco', mercado: 'andrea', churrasqueira: 'forno', taberna: 'chiostro', cha: 'terrazza', gelataria: 'duomo', snack: 'ruocco' };

/**
 * A restaurant's ground floor: a room on the level of the path, its door open, windows either side, a majolica
 * sign and a striped awning outside; tiles, wainscot, a counter with the cook behind it, the dishes on show,
 * tables with cloths and people eating; and in each one the things that make it what it is: the pizza oven,
 * the fish on ice, the wine racks, the bread shelves, the pastry case, the fireplace.
 */
function eatery(b: Builder, c: AC, lt: LotPlan): void {
  const g = b.grid;
  const L = eateryLayout(lt);
  const { W, D, mid, ca0, ca1, cd0, cd1 } = L;
  const food = lt.food!, id = EAT_LOOK[food] ?? food;
  const th = EAT_THEME[food];
  if (!th) return;
  const ic = b.ic;
  const F = lt.base;
  const at = (a: number, d: number): [number, number] => {
    const { x0, z0, x1, z1 } = lt;
    switch (lt.side) {
      case 'n': return [x0 + a, z0 + d];
      case 's': return [x1 - a, z1 - d];
      case 'w': return [x0 + d, z1 - a];
      default: return [x1 - d, z0 + a];
    }
  };
  type Col = number | ((a: number, y: number, d: number) => number);
  const box = (a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: Col) => {
    for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++) for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++) {
      const [x, z] = at(a, d);
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.set(x, F + y, z, typeof col === 'number' ? col : col(a, y, d));
    }
  };
  const put = (p: Prop, a: number, d: number, y: number, dir: [number, number]) => { const [x, z] = L.P(a, d); b.place(p, x, L.floorY - V + y, z, faceTurn(dir[0], dir[1])); };
  const inward: [number, number] = [-L.out[0], -L.out[1]];
  const lamp = (a: number, d: number, y: number, col: [number, number, number], r: number, i: number) => { const [x, z] = L.P(a, d); b.lamp(x, L.floorY + y, z, col, r, i); };
  const wall = c[th.wall], wain = c[th.wain];
  // ---- the room: air up to the ceiling slab 3 m over the floor, so the cutaway takes the ceiling off whole
  box(1, 1, 1, W - 2, 11, D - 2, 0);
  {
    const [x0, z0] = at(1, 1), [x1, z1] = at(W - 2, D - 2);
    b.indoor.push([Math.min(x0, x1), F + 1, Math.min(z0, z1), Math.max(x0, x1), F + 11, Math.max(z0, z1)]);
  }
  const floor = th.floor;
  box(1, 0, 1, W - 2, 0, D - 2, (a, _y, d) => {
    switch (floor) {
      case 'cotto': return (a + d) % 2 ? c.cotto : c.cottoB;
      case 'check': return (a + d) % 2 ? ic.checkB : ic.checkW;
      case 'plank': return (a + (d >> 2)) % 3 === 0 ? ic.plankDark : (a % 2 ? ic.plank : ic.plankB);
      case 'marble': return ((a >> 1) + (d >> 1)) % 2 ? ic.marbleW : ic.marbleG;
      case 'tile': return (a + d) % 2 ? ic.tileW : ic.tileCream;
      default: { const u = a & 3, v = d & 3; return (u === 1 || u === 2) && (v === 1 || v === 2) ? c.majolicaBlue : u === 0 && v === 0 ? c.majolicaYellow : c.majolicaWhite; }
    }
  });
  // walls: wainscot to the waist, plaster above, a picture rail
  // (repaints wall cells only, never fills an opening)
  const solid = (a: number, y: number, d: number) => { const [x, z] = at(a, d); return g.get(x, F + y, z) !== 0; };
  const walls = (fn: (a: number, y: number, d: number) => number) => {
    const f = (a: number, y: number, d: number) => (solid(a, y, d) ? fn(a, y, d) : 0);
    box(0, 1, 0, 0, 11, D - 1, f); box(W - 1, 1, 0, W - 1, 11, D - 1, f);
    box(0, 1, D - 1, W - 1, 11, D - 1, f); box(0, 1, 0, W - 1, 11, 0, f);
  };
  walls((_a, y) => (y <= 3 ? wain : y === 4 || y === 9 ? c.sill : wall));
  // ---- the front: the door, windows either side, a majolica sign, an awning, lanterns and plants
  const front = c[th.front];
  box(mid - 2, 1, 0, mid + 2, 9, 0, 0);
  box(mid - 3, 1, 0, mid - 3, 10, 0, c.sill); box(mid + 3, 1, 0, mid + 3, 10, 0, c.sill);
  box(mid - 3, 10, 0, mid + 3, 10, 0, c.stripeTufa);
  for (const [w0, w1] of [[2, mid - 5], [mid + 5, W - 3]]) {
    if (w1 - w0 < 2) continue;
    box(w0, 2, 0, w1, 2, 0, c.sill);
    box(w0, 3, 0, w1, 8, 0, (a, y) => (a === w0 || a === w1 || y === 8 ? front : y === 5 || (a - w0) % 4 === 0 ? front : c.glassLit));
    box(w0, 9, 0, w1, 9, 0, c.sill);
  }
  // the sign over the door, out on the wall: a panel of majolica tiles
  box(mid - 4, 11, -1, mid + 4, 12, -1, (a, y) => (a === mid - 4 || a === mid + 4 ? c.majolicaBlue : (a + y) % 3 === 0 ? c.majolicaYellow : c.majolicaWhite));
  // a striped awning the width of the front
  const [aw0, aw1] = [c[th.awning[0]], c[th.awning[1]]];
  box(1, 10, -1, W - 2, 10, -2, (a) => ((a >> 1) % 2 ? aw0 : aw1));
  box(1, 9, -2, W - 2, 9, -2, (a) => ((a >> 1) % 2 ? aw0 : aw1));
  box(1, 8, -2, W - 2, 8, -2, (a) => (a % 2 ? aw0 : 0));
  for (const s of [-1, 1]) {
    put(wallLantern(c), mid + 0.5 + s * 4.5, 0.25, 2.4, L.out);
    lamp(mid + 0.5 + s * 4.5, -0.3, 2.4, WARM, 4, 0.6);
    put(s < 0 ? potLemon(c, lt.seed + 3) : geraniumPot(c, lt.seed + 4), mid + 0.5 + s * 3.9, -0.55, 0.25, L.out);
  }
  for (const s of [-1, 1]) { const [x, z] = L.P(mid + 0.5 + s * 3.9, -0.55); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  // ---- the counter, the dishes on it, the shelves behind and the cook's corner
  const counterTop = id === 'cantina' || id === 'masseria' || id === 'colatura' ? c.door : c.marble;
  box(ca0, 1, cd0, ca1, 3, cd1, (a, y) => (y === 1 ? c.plinth : id === 'dolceria' || id === 'andrea' || id === 'duomo' ? (y === 3 ? c.sill : ic.case) : (a % 3 === 0 ? c.sill : front)));
  box(ca0, 4, cd0, ca1, 4, cd1, counterTop);
  const dishes = STALL[food]?.dishes as FoodId[] | undefined;
  if (dishes) dishes.forEach((f, i) => { const [x, z] = L.P(ca0 + 2.5 + i * 3.5, cd0 + 1); b.place(buildFood(f, b.pal), x, L.floorY + 1.0, z, faceTurn(L.out[0], L.out[1])); });
  // shelves on the back wall
  for (const y of [5, 7, 9]) box(2, y, D - 2, W - 3, y, D - 2, c.door);
  const goods = [ic.bottleA, ic.bottleB, ic.bottleC, ic.bottleD, c.lemon, ic.bread, c.majolicaYellow];
  box(2, 6, D - 2, W - 3, 6, D - 2, (a) => (hash3(a, 6, lt.seed) < 0.7 ? goods[Math.floor(hash3(a, 61, lt.seed) * goods.length)] : 0));
  box(2, 8, D - 2, W - 3, 8, D - 2, (a) => (hash3(a, 8, lt.seed) < 0.6 ? goods[Math.floor(hash3(a, 81, lt.seed) * goods.length)] : 0));
  // ---- tables, chairs, and the regulars at them
  const cloth = c[th.cloth[0]], cloth2 = c[th.cloth[1]];
  const wood = id === 'terrazza' || id === 'chiostro' ? c.iron : c.door;
  for (const t of L.tables) {
    put(eatTable(c, cloth, cloth2, wood), t.a + 1, t.d + 1, 0.25, L.out);
    put(chair(c, wood), t.a - 0.5, t.d + 1, 0.25, L.ax);
    put(chair(c, wood), t.a + 2.5, t.d + 1, 0.25, [-L.ax[0], -L.ax[1]]);
    const [x0, z0] = L.P(t.a - 1, t.d), [x1, z1] = L.P(t.a + 3, t.d + 2);
    b.block(Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1));
  }
  // ---- what makes each place itself
  switch (id) {
    case 'duomo': {
      // the espresso machine, cups stacked on top, the pastry case with cornetti
      box(ca1 - 4, 5, cd0, ca1 - 1, 6, cd1, (_a, y) => (y === 6 ? ic.brass : ic.steel));
      box(ca1 - 4, 7, cd0, ca1 - 1, 7, cd0, ic.cup);
      box(ca0 + 1, 5, cd0, ca0 + 5, 5, cd1, (a) => (a % 2 ? ic.bread : ic.breadDark));
      box(1, 1, D - 3, 1, 9, D - 2, c.shutterGreen);
      break;
    }
    case 'gemma': case 'masseria': {
      // garlic plaits and red peppers hanging from a beam, plates of majolica on the wall
      box(1, 11, 4, W - 2, 11, 4, c.door);
      for (let a = 3; a < W - 3; a += 3) box(a, 9, 4, a, 10, 4, (_a, y) => (a % 2 ? (y === 9 ? c.geranium : c.door) : c.white));
      for (let d = 3; d < D - 7; d += 4) { box(0, 7, d, 0, 7, d, c.majolicaYellow); box(W - 1, 7, d, W - 1, 7, d, c.majolicaBlue); }
      if (id === 'masseria') {
        // the hearth on the side wall, a ham and braids of onions
        box(W - 2, 1, 3, W - 2, 6, 7, c.tufaDark); box(W - 2, 1, 4, W - 2, 3, 6, ic.oven); box(W - 3, 1, 4, W - 3, 1, 6, c.tufaDark);
        lamp(W - 3, 4.5, 1.2, [1, 0.55, 0.25], 4, 1.1);
        box(4, 8, 6, 4, 11, 6, (_a, y) => (y === 11 ? c.iron : ic.velvet)); box(W - 6, 8, 8, W - 6, 11, 8, (_a, y) => (y === 11 ? c.iron : c.ochre));
        b.emitters.push({ kind: 'smoke', pos: [...((): [number, number, number] => { const [x, z] = L.P(W - 2.5, 5); return [x, L.floorY + 1.4, z]; })()], rate: 0.25 });
      }
      break;
    }
    case 'saraceno': case 'colatura': {
      // the catch on ice along the counter, a net and floats on the wall
      box(ca0 + 6, 5, cd0, ca1, 5, cd1, ic.ice);
      for (let a = ca0 + 6; a < ca1; a += 2) box(a, 6, cd0, a, 6, cd0 + (a % 4 ? 1 : 0), [ic.fishA, ic.fishB, ic.fishC][a % 3]);
      box(0, 4, 3, 0, 9, D - 8, (_a, y, d) => ((y + d) % 2 ? c.fishNet : 0) || wall);
      for (let d = 4; d < D - 8; d += 3) box(0, 9, d, 0, 9, d, c.floatRed);
      if (id === 'saraceno') box(W - 1, 4, 4, W - 1, 8, 9, (_a, y) => (y === 4 || y === 8 ? c.door : ic.tank));
      else for (let d = 3; d < D - 8; d += 2) box(W - 2, 1, d, W - 2, 2, d, c.door); // the colatura kegs
      break;
    }
    case 'forno': {
      // the wood-fired oven in the corner behind the counter, glowing; logs stacked under it
      const oa = W - 5, od = D - 5;
      for (let y = 0; y < 7; y++) for (let d = od; d <= D - 2; d++) for (let a = oa; a <= W - 2; a++) {
        const r = Math.hypot(a - (oa + 1.5), d - (od + 2), (y - 1) * 0.9);
        if (y >= 3 && r > 2.8) continue;
        box(a, 1 + y, d, a, 1 + y, d, y < 3 ? (a === oa && (d === od + 1 || d === od + 2) && y > 0 ? ic.oven : c.tufaDark) : c.tufa);
      }
      box(oa - 1, 1, od + 1, oa - 1, 2, od + 2, c.trunk);
      lamp(oa, 2, od + 1.5, [1, 0.55, 0.25], 5, 1.2);
      b.emitters.push({ kind: 'smoke', pos: [...((): [number, number, number] => { const [x, z] = L.P(oa + 1.5, od + 2); return [x, L.floorY + 2.6, z]; })()], rate: 0.3 });
      box(ca0 + 1, 5, cd0, ca0 + 5, 5, cd1, ic.flour);
      break;
    }
    case 'cantina': {
      // wine racks up both side walls, two barrels by the door, salami from the beam
      for (const a of [1, W - 2]) box(a, 1, 2, a, 9, D - 8, (_a, y, d) => (y % 3 === 0 ? c.door : (d + y) % 2 ? [ic.bottleA, ic.bottleB, ic.bottleD, c.hullRed][(d + y) % 4] : c.stripeDark));
      for (const a of [2, W - 3]) { box(a, 1, 1, a, 3, 1, (_a, y) => (y === 2 ? c.iron : c.door)); }
      for (let a = 4; a < W - 4; a += 3) box(a, 9, D - 9, a, 11, D - 9, (_a, y) => (y === 11 ? c.iron : ic.velvetDark)); // (hooked to the ceiling)
      break;
    }
    case 'ruocco': {
      // loaves on the shelves, baskets on the counter, sacks of flour, the oven's mouth in the back wall
      box(2, 5, D - 2, W - 3, 9, D - 2, (a, y) => (y % 2 ? c.door : hash3(a, y, 5) < 0.8 ? (a % 2 ? ic.bread : ic.breadDark) : 0));
      box(ca0 + 1, 5, cd0, ca1 - 1, 5, cd1, (a) => (a % 3 === 0 ? c.rope : ic.bread));
      for (let a = 2; a < 6; a++) box(a, 1, 2, a, 1 + (a % 2), 2, ic.flour);
      box(W - 4, 1, D - 2, W - 2, 4, D - 2, ic.brick); box(W - 3, 2, D - 2, W - 3, 3, D - 2, ic.oven);
      break;
    }
    case 'andrea': {
      // white tiles all the way up, the hot case full of arancini and crocchè
      walls((_a, y) => (y <= 8 ? ((y + _a) % 2 ? ic.tileW : c.white) : wall));
      box(ca0, 5, cd0, ca1, 5, cd1, (a) => (a % 2 ? c.ochre : c.lemonDeep));
      box(ca0, 6, cd0, ca1, 6, cd0, ic.case);
      break;
    }
    case 'dolceria': {
      // a glass case of pastries in every colour, a cake on a stand
      box(ca0, 5, cd0, ca1, 5, cd1, (a, _y, d) => [c.pink, ic.coffee, c.cream, c.lemon, c.bougainB, ic.bread][(a + d * 2) % 6]);
      box(ca0, 6, cd0, ca1, 6, cd0, ic.case);
      box(ca1 + 2, 1, 2, ca1 + 2, 4, 2, c.marble); box(ca1 + 1, 5, 1, ca1 + 3, 6, 3, (_a, y) => (y === 6 ? c.pink : c.cream));
      break;
    }
    case 'chiostro': {
      // painted arches on the walls like the cloister's, lemon trees in pots, a case of books
      walls((a, y, d) => {
        const u = (a + d) % 8;
        return y <= 3 ? wain : y >= 8 && (u === 0 || u === 7) ? c.stripeTufa : y > 8 && u > 1 && u < 6 ? c.stripeTufa : wall;
      });
      put(potLemon(c, lt.seed + 9), 2, 2, 0.25, inward);
      put(potLemon(c, lt.seed + 10), W - 2, 2, 0.25, inward);
      box(W - 2, 1, D - 9, W - 2, 8, D - 7, (_a, y, d) => (y % 3 === 0 ? c.door : [ic.bookA, ic.bookB, ic.bookC, ic.bookD][(d + y) % 4]));
      break;
    }
    case 'terrazza': {
      // tall windows down the side walls, candles on the tables, a chandelier
      for (const a of [0, W - 1]) box(a, 3, 3, a, 9, D - 8, (_a, y, d) => (y === 3 || y === 9 || d % 4 === 0 ? c.white : c.glassLit));
      box(mid, 10, (D >> 1) - 1, mid + 1, 11, (D >> 1), ic.brass);
      box(mid - 1, 10, (D >> 1) - 2, mid + 2, 10, (D >> 1) + 1, ic.brass); // the arms, the shades hanging from them
      box(mid - 1, 9, (D >> 1) - 2, mid + 2, 9, (D >> 1) + 1, (a, _y, d) => ((a + d) % 3 === 0 ? ic.shade : 0));
      lamp(mid + 1, (D >> 1), 2.3, WARM, 6, 1.0);
      break;
    }
  }
  lamp(mid + 0.5, D * 0.4, 2.5, WARM, 6, 1.0);
  lamp((ca0 + ca1) / 2, cd0 - 0.5, 2.5, WARM, 4.5, 0.8);
  eateryDress(b, c, lt, L, (a, y, d) => { const [x, z] = at(a, d); return g.get(x, F + 1 + y, z); }, (a, y, d, v) => { const [x, z] = at(a, d); g.set(x, F + 1 + y, z, v); });
}

/** Each restaurant's look in the dining kit: what is on its shelves, its walls, over its tables and on its counter. */
const EAT_DRESS: Record<string, { goods: Goods[]; pics?: PictureKind[]; plates?: 'blue' | 'yellow' | 'green' | 'mixed' | 'pink'; rail?: WallLook['rail']; pend: 'cone' | 'globe' | 'bell' | 'cage'; shade: 'W' | 'A' | 'G'; table: TableStyle; counter: ('register' | 'fruit' | 'cake' | 'bread' | 'menu' | 'vase' | 'jars' | 'machine')[]; plant: 'lemon' | 'olive' | 'fig' | 'palm' | 'monstera'; menu?: boolean; mirror?: boolean; kitchen?: boolean }> = {
  duomo: { goods: ['cups', 'bottles', 'jars'], pics: ['coast'], plates: 'blue', pend: 'bell', shade: 'W', table: 'cafe', counter: ['machine', 'cake', 'register'], plant: 'palm', mirror: true },
  gemma: { goods: ['wine', 'jars', 'plates'], pics: ['lemons', 'coast'], plates: 'mixed', rail: 'garland', pend: 'cone', shade: 'A', table: 'it', counter: ['bread', 'vase', 'register'], plant: 'lemon', kitchen: true },
  saraceno: { goods: ['bottles', 'plates', 'wine'], pics: ['coast'], plates: 'blue', rail: 'pans', pend: 'globe', shade: 'W', table: 'it', counter: ['fruit', 'register'], plant: 'monstera', menu: true, kitchen: true },
  forno: { goods: ['jars', 'bottles', 'tins'], pics: ['coast'], plates: 'yellow', rail: 'utensils', pend: 'cage', shade: 'A', table: 'it', counter: ['jars', 'menu', 'register'], plant: 'olive', menu: true, kitchen: true },
  cantina: { goods: ['wine', 'wine', 'glasses'], pics: ['lemons'], rail: 'garland', pend: 'cage', shade: 'A', table: 'it', counter: ['bread', 'register'], plant: 'olive', menu: true },
  ruocco: { goods: ['bread', 'jars', 'tins'], pics: ['coast'], plates: 'yellow', pend: 'bell', shade: 'W', table: 'cafe', counter: ['register', 'bread'], plant: 'fig', menu: true },
  andrea: { goods: ['bottles', 'tins', 'jars'], pend: 'cone', shade: 'W', table: 'it', counter: ['register', 'jars'], plant: 'palm', menu: true },
  dolceria: { goods: ['cups', 'jars', 'glasses'], pics: ['lemons'], plates: 'pink', pend: 'globe', shade: 'W', table: 'cafe', counter: ['cake', 'register', 'vase'], plant: 'fig', mirror: true },
  chiostro: { goods: ['books', 'wine', 'plates'], pics: ['coast', 'lemons'], plates: 'green', pend: 'bell', shade: 'A', table: 'it', counter: ['vase', 'register', 'fruit'], plant: 'lemon' },
  colatura: { goods: ['bottles', 'jars', 'plates'], pics: ['coast'], plates: 'blue', rail: 'garland', pend: 'globe', shade: 'W', table: 'it', counter: ['jars', 'register'], plant: 'monstera', kitchen: true },
  masseria: { goods: ['copper', 'jars', 'wine'], pics: ['lemons'], plates: 'mixed', rail: 'herbs', pend: 'cage', shade: 'A', table: 'it', counter: ['bread', 'fruit', 'register'], plant: 'olive', kitchen: true },
  terrazza: { goods: ['wine', 'glasses', 'plates'], pics: ['coast'], pend: 'bell', shade: 'W', table: 'it', counter: ['vase', 'register', 'fruit'], plant: 'palm', mirror: true },
};

/**
 * The finish on a restaurant's room, from the dining kit: the walls dressed (a shelf high up, majolica plates,
 * pictures of the coast and the lemon groves, a clock, a mirror or a menu board), a light over every table and the
 * table laid, the counter's ends set out, the cook's line under the back shelves, a big plant in each front corner,
 * a mat inside the door and a moulding under the ceiling.
 */
function eateryDress(b: Builder, c: AC, lt: LotPlan, L: ReturnType<typeof eateryLayout>, get: Dine['get'], set: Dine['set']): void {
  const id = lt.food!;
  // (Funchal's places borrow the furnishing of the Amalfi room they are laid out like: EAT_LOOK)
  const dr = EAT_DRESS[EAT_LOOK[id] ?? id];
  if (!dr) return;
  const { W, D, mid, ca0, ca1, cd0 } = L;
  const R: Dine = { b, A0: 1, A1: W - 2, D0: 1, D1: D - 2, top: 10, floorY: L.floorY, seed: lt.seed, get, set, m: L.P };
  const k = dineColors(b.pal);
  const plates: [number, number][] = dr.plates === 'blue' ? [[c.majolicaBlue, c.majolicaYellow], [c.majolicaBlue, c.majolicaBlue]]
    : dr.plates === 'yellow' ? [[c.majolicaYellow, c.majolicaBlue], [c.majolicaYellow, c.majolicaGreen]]
      : dr.plates === 'green' ? [[c.majolicaGreen, c.majolicaYellow], [c.majolicaBlue, c.majolicaGreen]]
        : dr.plates === 'pink' ? [[c.rose, c.majolicaYellow], [c.pink, c.majolicaWhite]]
          : dr.plates ? [[c.majolicaBlue, c.majolicaYellow], [c.majolicaYellow, c.majolicaGreen], [c.majolicaGreen, c.majolicaBlue]] : [];
  const shade = dr.shade === 'A' ? k.shadeA : dr.shade === 'G' ? k.shadeG : k.shadeW;
  // the cook's line first, so the walls dress round it
  if (dr.kitchen) kitchenLine(R, k, 2, Math.min(ca1 - 1, W - 7), { body: c.majolicaWhite, top: c.marble, hood: false, rail: false, plates: false, d: D - 2 });
  dressWalls(R, k, { goods: dr.goods, board: k.wood, pictures: dr.pics, plates: plates.length ? plates : undefined, shade, menu: dr.menu, clock: !dr.menu, mirror: dr.mirror, rail: dr.rail, only: ['L', 'R'] });
  // the back wall over the shelves: a rail of something hanging from the beam
  if (dr.rail && bare(R, walls(R).L, 3, 8, 9, 10)) onWall(R, walls(R).L, hangRail(k, 20, dr.rail, lt.seed), 5.5, 2.0);
  // the tables laid, a light over each
  const spots: [number, number][] = [];
  for (const t of L.tables) {
    put(R, tableTop(k, dr.table, 10, 10, ['w', 'e'], lt.seed + t.a * 7 + t.d), t.a + 1, t.d + 1, 0.75, 2);
    spots.push([t.a + 1, t.d + 1]);
  }
  pendants(R, k, spots, dr.pend, shade, 2.2);
  // the counter's ends
  dr.counter.forEach((kind, i) => {
    const a = i === 0 ? ca1 - 0.6 : i === 1 ? ca0 + 0.7 : ca1 - 2.4;
    put(R, counterPiece(k, kind, lt.seed + i), a, cd0 + 1, 1.0, 0);
  });
  // a big plant in each front corner, a mat inside the door, the moulding round the ceiling
  cornerPlant(R, k, 1, 1, dr.plant, k.potTerra);
  cornerPlant(R, k, W - 3, 1, dr.plant, k.potTerra);
  rug(R, mid - 2, 1, mid + 2, 2, [k.rugR, k.rugO, k.rugC], 'border');
  // a bench under each front window with pots of geraniums and herbs
  windowBench(R, k, 3, mid - 5, c.door, c.marble);
  windowBench(R, k, mid + 5, W - 4, c.door, c.marble);
  cornice(R, c.sill);
}


// ---------------------------------------------------------------------------------------------- hotels

type Side = LotPlan['side'];
type P2 = [number, number];

/**
 * A lot seen from one of its faces: `a` runs along that face (left to right seen from outside), `d` inwards from
 * it, both in voxels from the lot's corner; `P` turns continuous (a, d) into world metres.
 */
function lotFrame(lt: LotPlan, side: Side) {
  const along = side === 'n' || side === 's';
  const W = along ? lt.x1 - lt.x0 + 1 : lt.z1 - lt.z0 + 1, D = along ? lt.z1 - lt.z0 + 1 : lt.x1 - lt.x0 + 1;
  const { x0, z0, x1, z1 } = lt;
  const at = (a: number, d: number): P2 => {
    switch (side) {
      case 'n': return [x0 + a, z0 + d];
      case 's': return [x1 - a, z1 - d];
      case 'w': return [x0 + d, z1 - a];
      default: return [x1 - d, z0 + a];
    }
  };
  const P = (a: number, d: number): P2 => {
    switch (side) {
      case 'n': return [(x0 + a) * V, (z0 + d) * V];
      case 's': return [(x1 + 1 - a) * V, (z1 + 1 - d) * V];
      case 'w': return [(x0 + d) * V, (z1 + 1 - a) * V];
      default: return [(x1 + 1 - d) * V, (z0 + a) * V];
    }
  };
  const out: P2 = side === 'n' ? [0, -1] : side === 's' ? [0, 1] : side === 'w' ? [-1, 0] : [1, 0];
  const ax: P2 = side === 'n' ? [1, 0] : side === 's' ? [-1, 0] : side === 'w' ? [0, -1] : [0, 1];
  return { W, D, at, P, out, ax };
}
type Frame = ReturnType<typeof lotFrame>;

/**
 * The face the guest rooms look out of: the sea side (east) when nothing stands in front of it above the first
 * guest floor, otherwise the open face nearest to it. Read from the plan, so every worker agrees.
 */
function viewSide(plan: Plan, lt: LotPlan): Side {
  const tall = (side: Side) => {
    const f = lotFrame(lt, side);
    let hi = 0;
    for (let a = 2; a < f.W - 2; a += 2) for (const d of [-1, -3, -6]) {
      const [x, z] = f.at(a, d);
      if (x < VX0 || z < VZ0 || x >= VX0 + SX || z >= VZ0 + SZ) continue;
      const ci = col(x, z), id = plan.lot[ci];
      hi = Math.max(hi, id ? plan.lots[id - 1].top : plan.kind[ci] === K.Church ? 255 : plan.walk[ci]);
    }
    return hi;
  };
  const order: Side[] = ['e', lt.side, lt.side === 'n' || lt.side === 's' ? 'e' : 'n', 's', 'n', 'w'];
  for (const s of order) if (tall(s) < lt.base + 12) return s;
  return lt.side;
}

const HOTEL_THEME: Record<string, { floor: [ACol, ACol, ACol]; wall: ACol; wain: ACol; duvet: ACol; runner: ACol; wood: ACol; shutter: ACol; sign: ACol }> = {
  jacaranda: { floor: ['marble', 'marbleGrey', 'cantaria'], wall: 'cream', wain: 'cantaria', duvet: 'white', runner: 'jacarandaB', wood: 'stripeDark', shutter: 'shutterGreen', sign: 'cantaria' },
  cais: { floor: ['azulejo', 'azulejoW', 'majolicaYellow'], wall: 'white', wain: 'azulejo', duvet: 'white', runner: 'shutterBlue', wood: 'door', shutter: 'shutterBlue', sign: 'azulejo' },
  santamaria: { floor: ['majolicaYellow', 'azulejoW', 'majolicaGreen'], wall: 'whiteWarm', wain: 'ochre', duvet: 'cream', runner: 'hullRed', wood: 'door', shutter: 'shutterGreen', sign: 'majolicaGreen' },
  bordado: { floor: ['azulejo', 'azulejoW', 'azulejo'], wall: 'white', wain: 'sky', duvet: 'white', runner: 'azulejo', wood: 'door', shutter: 'shutterBrown', sign: 'azulejo' },
  se: { floor: ['cotto', 'cottoB', 'cantaria'], wall: 'whiteWarm', wain: 'cantaria', duvet: 'cream', runner: 'hullGreen', wood: 'door', shutter: 'shutterGreen', sign: 'cantaria' },
  monte: { floor: ['majolicaGreen', 'azulejoW', 'azulejo'], wall: 'white', wain: 'sky', duvet: 'white', runner: 'sky', wood: 'door', shutter: 'shutterGreen', sign: 'azulejo' },
};

/** Where everything is in a hotel: the lobby on the street side, each guest room on its own floor facing the view. */
function hotelLayout(plan: Plan, lt: LotPlan) {
  const L = lotFrame(lt, lt.side);
  const id = lt.hotel!;
  const floorY = (lt.base + 1 - G) * V;
  const mid = Math.floor(L.W / 2);
  // the front desk across the back, the stairs up the right-hand wall (seen from the door)
  const da0 = 3, da1 = L.W - 10, dd = L.D - 7;
  const deskMid = (da0 + da1 + 1) / 2;
  const st0 = L.D - 2 - 16; // first step
  const lift = { stand: L.P(L.W - 3.5, st0 - 1.4), pick: L.P(L.W - 3.5, st0 + 1.5), facing: Math.atan2(-L.out[0], -L.out[1]) };
  const view = viewSide(plan, lt);
  const R = lotFrame(lt, view);
  const rooms = Array.from({ length: lt.guestFloors ?? 2 }, (_, i) => {
    const floor = i + 1, yb = lt.base + 12 * floor; // the floor slab; the air is yb+1 .. yb+10
    return { floor, yb, layer: yb + 1 - G, y: (yb + 1 - G) * V };
  });
  return { L, R, id, floorY, mid, da0, da1, dd, deskMid, st0, lift, view, rooms };
}

/** Furniture positions of a guest room in its own frame R (window wall at d = 0, the door in the back wall). */
function roomPlan(R: Frame, type: string) {
  const W = R.W, D = R.D;
  const beds: [number, number][] = type === 'king' ? [[8, 15]] : type === 'double' ? [[9, 14]] : type === 'twin' ? [[6, 9], [12, 15]] : [[10, 13]];
  const wins: [number, number][] = W >= 26 ? [[Math.floor(W / 2) - 7, Math.floor(W / 2) - 3], [Math.floor(W / 2) + 2, Math.floor(W / 2) + 6]] : [[Math.floor(W / 2) - 6, Math.floor(W / 2) - 2], [Math.floor(W / 2) + 1, Math.floor(W / 2) + 5]];
  const door = W - 7; // door cells door .. door+3 in the back wall
  return { W, D, beds, wins, door };
}

const p3 = ([x, z]: P2, y: number): [number, number, number] => [x, y, z];

/** The hotels' lobbies (rooms) and guest floors (pure: every worker registers the same ones). */
function hotelAnchors(plan: Plan): { rooms: RoomAnchor[]; hotels: HotelAnchor[] } {
  const rooms: RoomAnchor[] = [], hotels: HotelAnchor[] = [];
  const ang = (from: P2, to: P2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
  for (const lt of plan.lots) {
    if (!lt.hotel) continue;
    const H = hotelLayout(plan, lt), L = H.L, info = HOTEL[lt.hotel];
    if (!info) continue;
    const [ax0, az0] = L.P(1, 1), [ax1, az1] = L.P(L.W - 1, L.D - 1);
    const door = L.P(H.mid + 0.5, 1.6);
    const [kx, kz] = L.P(H.deskMid, L.D - 3);
    const inward = Math.atan2(-L.out[0], -L.out[1]), outward = Math.atan2(L.out[0], L.out[1]);
    const npcs: RoomNpc[] = [
      { role: 'keeper', pos: [kx, H.floorY, kz], facing: outward, sit: false, seed: lt.seed },
      { role: 'guest', pos: [...((): [number, number, number] => { const [x, z] = L.P(1.9, 5.5); return [x, H.floorY + 0.5, z]; })()], facing: Math.atan2(L.ax[0], L.ax[1]), sit: true, seed: lt.seed + 7 },
    ];
    const [bx, bz] = L.P(H.deskMid, L.D - 6.5);
    rooms.push({
      id: `hotel-${lt.hotel}`, kind: 'hotel', nth: hotels.length, hotel: lt.hotel,
      rect: [Math.min(ax0, ax1), Math.min(az0, az1), Math.max(ax0, ax1), Math.max(az0, az1)],
      door, npcs, spots: [{ kind: 'buy', pos: [bx, 1.2, bz], stand: L.P(H.deskMid, L.D - 8.8) }],
      lift: { stand: H.lift.stand, pick: [H.lift.pick[0], H.floorY + 1.4, H.lift.pick[1]], facing: inward }, // (lifts know their own floor)
    });
    const [fx0, fz0] = [lt.x0 * V, lt.z0 * V], [fx1, fz1] = [(lt.x1 + 1) * V, (lt.z1 + 1) * V];
    const R = H.R;
    hotels.push({
      id: lt.hotel, lobby: `hotel-${lt.hotel}`, rect: [fx0, fz0, fx1, fz1], entrance: door,
      rooms: H.rooms.map((f, i) => {
        const spec = info.rooms[i] ?? info.rooms[info.rooms.length - 1];
        const rp = roomPlan(R, spec.type);
        const [rx0, rz0] = R.P(1, 1), [rx1, rz1] = R.P(R.W - 1, R.D - 1);
        const [vx0, vz0] = R.at(1, 1), [vx1, vz1] = R.at(R.W - 2, R.D - 2);
        const spawn = R.P(rp.door + 2, R.D - 2.6);
        const vc = (rp.beds[0][0] + rp.beds[rp.beds.length - 1][1] + 1) / 2;
        const bedStand = R.P(11.2, vc);
        const [w0, w1] = rp.wins[0], wm = (w0 + w1 + 1) / 2;
        const winStand = R.P(wm, 1.5);
        const teaStand = R.P(R.W - 4.5, 9.4);
        return {
          id: `${lt.hotel}-${f.floor}`, hotel: lt.hotel!, floor: f.floor, type: spec.type, price: spec.price, y: f.y,
          rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
          vox: [Math.min(vx0, vx1), Math.min(vz0, vz1), Math.max(vx0, vx1), Math.max(vz0, vz1)],
          layer: f.layer,
          spawn: [spawn[0], spawn[1], ang(spawn, R.P(rp.door + 2, 0))],
          door: { stand: spawn, pick: p3(R.P(rp.door + 2, R.D - 1), f.y + 1.2) },
          bed: { stand: bedStand, pick: p3(R.P(5, vc), f.y + 0.8), facing: ang(bedStand, R.P(5, vc)) },
          window: { stand: winStand, pick: p3(R.P(wm, 0), f.y + 1.5), facing: ang(winStand, R.P(wm, -2)) },
          tea: { stand: teaStand, pick: p3(R.P(R.W - 2.5, 5.5), f.y + 0.9), facing: ang(teaStand, R.P(R.W - 2.5, 5.5)) },
          // the French windows, thrown open: nothing to glaze, but the view out of them is kept clear
          panes: rp.wins.map(([a0, a1]) => ({ ...paneOf(R.P, a0, a1, 0, f.y, f.y + 8 * V), open: true })),
        };
      }),
    });
  }
  return { rooms, hotels };
}

/** Box and set in a frame's (a, y, d) coordinates, y counted from layer F. */
function frameOps(b: Builder, f: Frame, F: number) {
  const g = b.grid;
  type Col = number | ((a: number, y: number, d: number) => number);
  const box = (a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: Col) => {
    for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++) for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++) {
      const [x, z] = f.at(a, d);
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.set(x, F + y, z, typeof col === 'number' ? col : col(a, y, d));
    }
  };
  const get = (a: number, y: number, d: number) => { const [x, z] = f.at(a, d); return g.get(x, F + y, z); };
  /** Repaint only what is already solid (never fills a door or a window). */
  const paint = (a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: (a: number, y: number, d: number) => number) =>
    box(a0, y0, d0, a1, y1, d1, (a, y, d) => (get(a, y, d) ? col(a, y, d) : 0));
  return { box, get, paint };
}

/** Vietri tiles: a motif every four voxels in the hotel's colourway. */
const tiles = (c: AC, [m, k, f]: [ACol, ACol, ACol], marble: boolean) => (a: number, d: number) => {
  if (marble) return ((a >> 1) + (d >> 1)) % 2 ? c[m] : (a + d) % 8 === 0 ? c[f] : c[k];
  const u = a & 3, v = d & 3;
  return (u === 1 || u === 2) && (v === 1 || v === 2) ? c[m] : u === 0 && v === 0 ? c[f] : c[k];
};

/** HOTEL in tiles, three by four each, as the lobby's sign. */
const HOTEL_FONT = ['101111101101', '111101101111', '111010010010', '111110100111', '100100100111'];

/**
 * A hotel: the lobby on the level of the path (tiles, a front desk with the key board, a marble stair up the side
 * wall, a sofa for guests waiting on friends), and one guest room on each floor above, its French windows
 * opened on the view with the shutters folded back, an iron bed, a desk with a moka pot, a wardrobe, a rug.
 */
function hotelHouse(b: Builder, c: AC, plan: Plan, lt: LotPlan): void {
  const H = hotelLayout(plan, lt), L = H.L, th = HOTEL_THEME[H.id];
  const info = HOTEL[H.id];
  if (!th || !info) return;
  const ic = b.ic;
  const F = lt.base;
  const { box, paint, get } = frameOps(b, L, F);
  const W = L.W, D = L.D, mid = H.mid;
  const wain = c[th.wain], wood = c[th.wood];
  const palazzo = H.id === 'jacaranda';
  const floorTile = tiles(c, th.floor, palazzo);
  const lamp = (f: Frame, a: number, d: number, y: number, col: [number, number, number], r: number, i: number) => { const [x, z] = f.P(a, d); b.lamp(x, y, z, col, r, i); };
  const put = (f: Frame, p: Prop, a: number, d: number, y: number, dir: P2) => { const [x, z] = f.P(a, d); b.place(p, x, y, z, faceTurn(dir[0], dir[1])); };

  // ---- the lobby
  box(1, 1, 1, W - 2, 11, D - 2, 0);
  { const [x0, z0] = L.at(1, 1), [x1, z1] = L.at(W - 2, D - 2); b.indoor.push([Math.min(x0, x1), F + 1, Math.min(z0, z1), Math.max(x0, x1), F + 11, Math.max(z0, z1)]); }
  box(1, 0, 1, W - 2, 0, D - 2, (a, _y, d) => floorTile(a, d));
  const walls = (fn: (a: number, y: number, d: number) => number) => {
    paint(0, 1, 0, 0, 11, D - 1, fn); paint(W - 1, 1, 0, W - 1, 11, D - 1, fn);
    paint(0, 1, D - 1, W - 1, 11, D - 1, fn); paint(0, 1, 0, W - 1, 11, 0, fn);
  };
  // (the walls are the facade too: above the tiled dado the plaster stays the house's own colour)
  walls((a, y, d) => (y <= 3 ? (palazzo ? c.stripeDark : (a + d + y) % 2 ? wain : c.majolicaWhite) : y === 4 || y === 11 ? c.sill : get(a, y, d)));
  // the front: a tall door with a fanlight, windows either side, HOTEL in tiles over the door, two lanterns
  box(mid - 2, 1, 0, mid + 2, 9, 0, 0);
  box(mid - 3, 1, 0, mid - 3, 10, 0, c.marble); box(mid + 3, 1, 0, mid + 3, 10, 0, c.marble);
  box(mid - 3, 10, 0, mid + 3, 10, 0, c.stripeTufa);
  for (const [w0, w1] of [[2, mid - 5], [mid + 5, W - 3]]) {
    if (w1 - w0 < 2) continue;
    box(w0, 2, 0, w1, 2, 0, c.sill);
    box(w0, 3, 0, w1, 8, 0, (a, y) => (a === w0 || a === w1 || y === 8 ? c[th.shutter] : y === 5 || (a - w0) % 3 === 0 ? c[th.shutter] : c.glassLit));
    box(w0, 9, 0, w1, 9, 0, c.sill);
  }
  const la0 = mid - 9;
  box(la0 - 1, 10, -1, la0 + 19, 15, -1, (a, y) => (a === la0 - 1 || a === la0 + 19 || y === 10 || y === 15 ? c.majolicaWhite : c[th.sign]));
  HOTEL_FONT.forEach((gl, i) => { for (let row = 0; row < 4; row++) for (let cc = 0; cc < 3; cc++) if (gl[row * 3 + cc] === '1') box(la0 + i * 4 + cc, 14 - row, -1, la0 + i * 4 + cc, 14 - row, -1, c.majolicaYellow); });
  for (const s of [-1, 1]) {
    put(L, wallLantern(c), mid + 0.5 + s * 4.5, 0.25, H.floorY + 2.4, L.out);
    lamp(L, mid + 0.5 + s * 4.5, -0.3, H.floorY + 2.4, WARM, 4, 0.6);
    put(L, s < 0 ? potLemon(c, lt.seed + 3) : oleander(c, lt.seed + 4), mid + 0.5 + s * 3.9, -0.55, H.floorY, L.out);
    const [x, z] = L.P(mid + 0.5 + s * 3.9, -0.55); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
  }
  // the front desk, the key board behind it with a brass hook for each room, a bell, the register
  box(H.da0, 1, H.dd, H.da1, 3, H.dd + 1, (a, y) => (y === 1 ? c.plinth : a % 3 === 0 ? c.sill : wood));
  box(H.da0, 4, H.dd, H.da1, 4, H.dd + 1, c.marble);
  box(H.da1 - 1, 5, H.dd, H.da1 - 1, 5, H.dd, ic.brass);
  box(H.da0 + 1, 5, H.dd + 1, H.da0 + 2, 5, H.dd + 1, c.majolicaWhite);
  box(H.da0 + 1, 5, D - 2, H.da1, 9, D - 2, (a, y) => (y === 5 || y === 9 || a === H.da0 + 1 || a === H.da1 ? wood : (a + y) % 2 ? (y === 7 && a % 4 === 0 ? ic.brass : c.door) : c[th.wall]));
  // the stair up the right-hand wall: marble treads, an iron rail with a brass top
  for (let s = 0; s < 8; s++) box(W - 5, 1, H.st0 + s * 2, W - 2, 1 + s, H.st0 + s * 2 + 1, (_a, y) => (y === 1 + s ? c.marble : c.marbleGrey));
  for (let s = 0; s < 8; s++) {
    const d0 = H.st0 + s * 2;
    box(W - 6, 1, d0, W - 6, 1 + s, d0 + 1, c.marbleGrey);
    box(W - 6, 2 + s, d0 + 1, W - 6, 2 + s, d0 + 1, c.iron);
    box(W - 6, 3 + s, d0, W - 6, 3 + s, d0 + 1, ic.brass);
    if (s < 7) box(W - 6, 4 + s, d0 + 1, W - 6, 4 + s, d0 + 1, ic.brass);
  }
  box(W - 6, 1, H.st0 - 1, W - 6, 3, H.st0 - 1, c.iron); box(W - 6, 3, H.st0, W - 6, 3, H.st0, ic.brass);
  // guests' corner by the front window: a sofa, a low table, a lemon tree in a pot, a rug down the middle
  box(1, 1, 3, 2, 2, 8, ic.velvet); box(1, 3, 3, 1, 4, 8, ic.velvetDark);
  box(4, 1, 4, 5, 2, 7, (_a, y) => (y === 2 ? c.marble : wood));
  box(mid - 3, 0, 3, mid + 3, 0, H.dd - 2, (a, _y, d) => (a === mid - 3 || a === mid + 3 || d === 3 || d === H.dd - 2 ? c.majolicaYellow : palazzo ? ic.velvet : c[th.floor[0]]));
  put(L, potLemon(c, lt.seed + 9), 2, D - 3, H.floorY, [-L.out[0], -L.out[1]]);
  { const [x, z] = L.P(2, D - 3); b.block(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
  // majolica plates on the left wall, a painting of the coast over the sofa
  for (let d = 10; d < D - 8; d += 4) box(0, 7, d, 0, 8, d + 1, (_a, y, dd) => ((y + dd) % 2 ? c.majolicaYellow : c.majolicaBlue));
  hangIn(b, picture(paintColors(b), 'coast', 12, 8, lt.seed), L.P, 1, 6, 1, 0, (F + 6 - G) * V);
  // a chandelier in the palazzo, a ceiling lamp elsewhere
  box(mid, 10, (D >> 1) - 1, mid + 1, 11, D >> 1, ic.brass);
  if (palazzo) {
    box(mid - 1, 10, (D >> 1) - 2, mid + 2, 10, (D >> 1) + 1, ic.brass);
    box(mid - 1, 9, (D >> 1) - 2, mid + 2, 9, (D >> 1) + 1, (a, _y, d) => ((a + d) % 3 === 0 ? ic.shade : 0));
  }
  lamp(L, mid + 1, D >> 1, H.floorY + 2.4, WARM, 7, 1.0);
  lamp(L, H.deskMid, H.dd - 0.5, H.floorY + 2.4, WARM, 4.5, 0.8);

  // ---- the guest rooms, one per floor, facing the view
  const R = H.R;
  H.rooms.forEach((f, i) => {
    const spec = info.rooms[i] ?? info.rooms[info.rooms.length - 1];
    const rp = roomPlan(R, spec.type);
    const o = frameOps(b, R, f.yb);
    const RW = R.W, RD = R.D;
    const Y = f.y; // the room's floor in metres
    o.box(1, 1, 1, RW - 2, 10, RD - 2, 0);
    { const [x0, z0] = R.at(1, 1), [x1, z1] = R.at(RW - 2, RD - 2); b.indoor.push([Math.min(x0, x1), f.yb + 1, Math.min(z0, z1), Math.max(x0, x1), f.yb + 10, Math.max(z0, z1)]); }
    o.box(1, 0, 1, RW - 2, 0, RD - 2, (a, _y, d) => floorTile(a + i, d));
    // walls: a band of tiles at the skirting, plaster (silk in the palazzo), a beamed or painted ceiling
    // (the walls are the facade too: the plaster stays the house's own colour, only the skirting and rails change)
    const fin = (a: number, y: number, d: number) => (y <= 1 ? ((a + d) % 2 ? wain : c.majolicaWhite) : y === 2 || y === 10 ? (palazzo ? c.mosaicGold : c.sill) : o.get(a, y, d));
    o.paint(0, 1, 0, 0, 10, RD - 1, fin); o.paint(RW - 1, 1, 0, RW - 1, 10, RD - 1, fin);
    o.paint(0, 1, RD - 1, RW - 1, 10, RD - 1, fin); o.paint(0, 1, 0, RW - 1, 10, 0, fin);
    o.box(1, 11, 1, RW - 2, 11, RD - 2, (a, _y, d) => (palazzo ? ((a + d) % 6 === 0 ? c.mosaicGold : (a * 3 + d) % 11 === 0 ? c.rose : c.sky) : a % 4 === 0 ? wood : c.roofWhite));
    // the French windows onto the view, open; shutters folded back outside, a little iron balcony rail, curtains
    for (const [w0, w1] of rp.wins) {
      o.box(w0, 1, 0, w1, 8, 0, 0);
      o.box(w0 - 1, 9, 0, w1 + 1, 9, 0, c.sill);
      o.box(w0 - 1, 0, -1, w1 + 1, 0, -2, c.sill);
      o.box(w0 - 1, 1, -2, w1 + 1, 3, -2, (a, y) => (y === 3 || a % 2 === 0 ? c.iron : 0));
      o.box(w0 - 1, 1, -1, w0 - 1, 3, -1, c.iron); o.box(w1 + 1, 1, -1, w1 + 1, 3, -1, c.iron);
      o.box(w0 - 2, 1, -1, w0 - 2, 8, -1, (_a, y) => (y % 2 ? c[th.shutter] : c.shutterDeep));
      o.box(w1 + 2, 1, -1, w1 + 2, 8, -1, (_a, y) => (y % 2 ? c[th.shutter] : c.shutterDeep));
      if (hash3(w0, f.yb, lt.seed) < 0.6) o.box(w0, 1, -1, w0, 1, -1, c.geranium);
      o.box(w0 - 1, 1, 1, w0 - 1, 9, 1, c.white); o.box(w1 + 1, 1, 1, w1 + 1, 9, 1, c.white);
    }
    // the door back down to the lobby, in the back wall
    o.box(rp.door, 1, RD - 1, rp.door + 3, 8, RD - 1, (a, y) => (y === 8 || a === rp.door || a === rp.door + 3 ? c.sill : a === rp.door + 2 && y === 4 ? ic.brass : wood));
    // the bed against the left wall: iron frame and headboard (carved walnut in the palazzo), linen, a runner
    for (const [v0, v1] of rp.beds) {
      o.box(1, 1, v0, 9, 1, v1, (a, _y, v) => ((a === 1 || a === 9) && (v === v0 || v === v1) ? (palazzo ? wood : c.iron) : c.white));
      o.box(1, 2, v0, 9, 2, v1, (a) => (a <= 3 ? c.white : a === 7 || a === 8 ? c[th.runner] : c[th.duvet]));
      o.box(1, 3, v0, 2, 3, v1, c.white);
      o.box(1, 1, v0, 1, 6, v1, (_a, y, v) => (palazzo ? (y === 6 || v === v0 || v === v1 ? c.mosaicGold : wood) : y === 6 || v === v0 || v === v1 || (v + y) % 2 === 0 ? c.iron : 0));
    }
    const [b0] = rp.beds[0], b1 = rp.beds[rp.beds.length - 1][1];
    // a majolica plate or a gilt picture over the bed, little tables with lamps either side
    hangIn(b, picture(paintColors(b), i % 2 ? 'lemons' : 'coast', (b1 - b0 - 1) * 2, 8, lt.seed + i), R.P, 1, (b0 + b1 + 1) / 2, 1, 0, (f.yb + 5 - G) * V);
    for (const v of [b0 - 2, b1 + 1]) {
      o.box(1, 1, v, 2, 2, v + 1, wood); o.box(1, 3, v, 1, 3, v, c.iron); o.box(1, 4, v, 1, 4, v, ic.shade);
      lamp(R, 1.5, v + 0.5, Y + 1.1, WARM, 2.6, 0.55);
    }
    // the writing desk on the right wall with the moka pot, two cups and a bowl of lemons; its chair
    o.box(RW - 3, 1, 3, RW - 2, 2, 3, wood); o.box(RW - 3, 1, 7, RW - 2, 2, 7, wood);
    o.box(RW - 3, 3, 3, RW - 2, 3, 7, palazzo ? c.marble : wood);
    o.box(RW - 2, 4, 5, RW - 2, 5, 5, ic.steel); o.box(RW - 2, 6, 5, RW - 2, 6, 5, c.iron);
    o.box(RW - 3, 4, 6, RW - 3, 4, 6, ic.cup); o.box(RW - 2, 4, 6, RW - 2, 4, 6, ic.cup);
    o.box(RW - 2, 4, 3, RW - 2, 4, 4, c.lemon);
    o.box(RW - 1, 5, 3, RW - 1, 8, 7, (_a, y, d) => (y === 5 || y === 8 || d === 3 || d === 7 ? wood : c.sky)); // a mirror
    o.box(RW - 4, 1, 4, RW - 4, 2, 5, wood); o.box(RW - 5, 1, 4, RW - 5, 5, 5, (_a, y) => (y <= 2 ? c.rope : wood));
    // the wardrobe by the door, an armchair in the window corner, a lemon tree, a rug
    o.box(RW - 3, 1, RD - 9, RW - 2, 9, RD - 4, (_a, y, d) => (y === 1 || y === 9 || d === RD - 9 || d === RD - 4 ? wood : d === RD - 7 && y === 5 ? ic.brass : palazzo ? c.stripeDark : c.door));
    if (spec.type !== 'single') { o.box(1, 1, 1, 2, 2, 2, ic.velvet); o.box(1, 3, 1, 1, 4, 2, ic.velvetDark); }
    put(R, potLemon(c, lt.seed + 20 + i), RW - 2.5, 2, Y, [-R.out[0], -R.out[1]]);
    { const [x, z] = R.P(RW - 2.5, 2); b.block(x - 0.4, z - 0.4, x + 0.4, z + 0.4); }
    if (RW >= 24) o.box(12, 0, 4, RW - 7, 0, RD - 6, (a, _y, d) => (a === 12 || a === RW - 7 || d === 4 || d === RD - 6 ? c.majolicaYellow : (a + d) % 4 === 0 ? c[th.floor[0]] : c.cream));
    lamp(R, RW / 2, RD / 2, Y + 2.3, WARM, 6.5, 0.9);
  });
}
