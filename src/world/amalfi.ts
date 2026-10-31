import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, V, VX0, VZ0, SX, SZ, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, BuildResult, Anchors, PlacedProp, Window, WARM, WHITEWARM, StallAnchor } from './tokyo';
import { Prop, rotateProp, bench, cafeTable, scooter, stool, bush, grassTuft } from './props';
import { buildFood, type FoodId } from './food';
import type { RoomAnchor, RoomNpc } from './interiors';
import { STALL } from '../data/stalls';
import { HOTEL } from '../data/hotels';
import { paneOf, type HotelAnchor } from './hotels';
import { SWAY } from './sway';
import { amalfiPlan, K, col, layerOf, hillY, headlandY, isFoot, isPath, LotPlan, PIAZZA_Y, DUOMO_Y, ROAD_X0, ROAD_X1, TUNNEL_Z, PORTAL_Y, LIDOS, lidoUmbrellas, freeBeachTowels, PIER_Y, PIER_HALF, PIER_END, PIER_R, BELV_X0, BELV_X1, GATE_X, type Plan } from './amalfiPlan';
import { duomoInterior, HALL_ROOM, DUOMO_WALLS } from './sacred';

/**
 * Amalfi: a town poured down a ravine to the sea. Houses stand on terraces cut into both flanks of the valley,
 * stairways and lanes climb between them, the cathedral looks down its great flight of steps onto Piazza Duomo,
 * and the shore road runs along the beach and the harbour before it tunnels through the headland.
 * The ground plan (heights, paths, lots) comes from world/amalfiPlan.ts; this fills it with voxels.
 */

function amalfiColors(b: Builder) {
  const a = (hex: number, vary = 0.06, o: { emit?: number; night?: boolean; leaf?: boolean; glass?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
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
  };
}

type AC = ReturnType<typeof amalfiColors>;

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

function sunbed(c: AC): Prop {
  const p = new Prop(6, 4, 15);
  p.box(0, 0, 0, 0, 1, 0, c.bedFrame); p.box(5, 0, 0, 5, 1, 0, c.bedFrame); p.box(0, 0, 14, 0, 1, 14, c.bedFrame); p.box(5, 0, 14, 5, 1, 14, c.bedFrame);
  p.box(0, 2, 0, 5, 2, 14, c.bed);
  p.box(0, 3, 11, 5, 3, 14, c.bed);
  return p;
}

/** A changing cabin of a lido: painted planks in the lido's colour and white, a door, a little flat roof. */
function cabin(c: AC, col: number, seed: number): Prop {
  const p = new Prop(11, 19, 11);
  p.box(0, 0, 0, 10, 16, 10, (x, _y, z) => (((x + z) >> 1) % 2 ? col : c.white));
  p.box(1, 1, 1, 9, 16, 9, 0);
  p.box(3, 0, 0, 7, 13, 0, hash3(seed, 3, 7) < 0.3 ? 0 : c.door);
  p.box(0, 17, 0, 10, 17, 10, c.white);
  p.box(0, 18, 1, 10, 18, 9, col);
  p.set(6, 7, 0, c.iron);
  return p;
}

/** A beach towel spread on the pebbles, striped. */
function towel(c: AC, seed: number): Prop {
  const p = new Prop(7, 1, 14);
  const a = [c.umbrellaA, c.umbrellaC, c.umbrellaD, c.umbrellaE, c.pink, c.sky][seed % 6];
  p.box(0, 0, 0, 6, 0, 13, (_x, _y, z) => ((z >> 1) % 2 ? a : c.umbrellaB));
  return p;
}

/** The lifeguard's tower: a tall wooden chair with a red umbrella and a rescue float. */
function lifeguardTower(c: AC): Prop {
  const p = new Prop(9, 24, 9);
  for (const [x, z] of [[1, 1], [7, 1], [1, 7], [7, 7]]) p.box(x, 0, z, x, 9, z, c.bedFrame);
  p.box(1, 4, 1, 7, 4, 1, c.bedFrame); p.box(1, 4, 7, 7, 4, 7, c.bedFrame);
  p.box(0, 10, 0, 8, 10, 8, c.deckWood);
  p.box(2, 11, 6, 6, 11, 7, c.white); p.box(2, 12, 7, 6, 15, 7, c.white);
  p.box(3, 0, 0, 5, 9, 0, (_x, y) => (y % 3 === 0 ? c.bedFrame : 0)); // the ladder
  p.box(4, 11, 4, 4, 21, 4, c.iron);
  for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) if (Math.hypot(x - 4, z - 4) < 4.6) p.set(x, 22 - (Math.hypot(x - 4, z - 4) > 3 ? 1 : 0), z, c.hullRed);
  p.box(8, 6, 3, 8, 8, 5, c.hullRed); p.set(8, 7, 4, 0);
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

/** A heap of fishing net drying on the quay, a line of floats along its edge. */
function netPile(c: AC, seed: number): Prop {
  const p = new Prop(12, 5, 9);
  const col = seed % 2 ? c.fishNet : c.fishNetB;
  p.ellipsoid(5.5, 0, 4, 5.5, 3.6, 4, (x, y, z) => (hash3(x + seed, y, z) < 0.12 ? (seed % 2 ? c.fishNetB : c.fishNet) : col));
  for (let i = 0; i < 6; i++) { const a = i * 1.05 + seed; p.set(Math.round(5.5 + Math.cos(a) * 5), 0, Math.round(4 + Math.sin(a) * 3.6), i % 2 ? c.float : c.floatRed); }
  return p;
}

/** Lobster pots stacked three high. */
function creels(c: AC): Prop {
  const p = new Prop(10, 10, 5);
  const pot = (x: number, y: number) => {
    p.box(x, y, 0, x + 4, y + 3, 4, (xx, yy, zz) => ((xx + yy + zz) % 2 ? c.net : 0));
    p.box(x, y, 0, x + 4, y, 4, c.pole);
  };
  pot(0, 0); pot(5, 0); pot(2, 4);
  return p;
}

/** A coil of mooring rope. */
function ropeCoil(c: AC): Prop {
  const p = new Prop(5, 1, 5);
  for (let z = 0; z < 5; z++) for (let x = 0; x < 5; x++) if (Math.hypot(x - 2, z - 2) > 0.8 && Math.hypot(x - 2, z - 2) < 2.6) p.set(x, 0, z, c.rope);
  return p;
}

/** Blue fish crates, some with the morning's catch on ice. */
function fishCrates(c: AC, seed: number): Prop {
  const p = new Prop(9, 5, 6);
  p.box(0, 0, 0, 3, 1, 5, c.crateBlue); p.box(5, 0, 0, 8, 1, 5, c.crateBlue); p.box(1, 2, 0, 5, 3, 5, c.crateBlue);
  for (let x = 2; x < 5; x++) for (let z = 1; z < 5; z++) p.set(x, 4, z, hash3(x, seed, z) < 0.5 ? c.float : c.marbleGrey);
  return p;
}

/** A ferry ticket booth on the quay: a blue hut, a window with a counter, the timetable board on its roof. */
function ticketBooth(c: AC, seed: number): Prop {
  const p = new Prop(19, 24, 14);
  p.box(0, 0, 0, 18, 17, 13, c.kiosk);
  p.box(1, 1, 1, 17, 17, 12, 0);
  p.box(3, 7, 0, 15, 15, 0, c.glassLit);
  p.box(2, 6, 0, 16, 6, 1, c.sign); // the counter
  p.box(0, 18, 0, 18, 18, 13, c.white);
  p.box(2, 19, 1, 16, 23, 1, (x, y) => (y === 23 || x === 2 || x === 16 ? c.kiosk : hash3(x, y, seed) < 0.5 ? c.sign : c.mosaicBlue));
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
  molo(b, c);
  carvePassages(b, c, plan);
  piazza(b, c);
  shore(b, c, plan);
  gardens(b, c, plan, inWin);
  lanes(b, c, plan);
  laneDress(b, c, plan);
  shopfronts(b, c, plan);
  washingLines(b, c, plan);
  const stalls = foodStalls(b, c, plan);
  const eats = eateryAnchors(plan);
  stalls.push(...eats.stalls);
  const inns = hotelAnchors(plan);
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
    // people sit along both sides of the cathedral steps, looking down over the piazza, the middle left to climb
    stepSeats: [-7, -9.5, -12, -14.5, -17].flatMap((x) => [9.9, 10.7, 17.3, 18.1].map((z) => [x + (z % 2) * 0.4, z, Math.PI / 2] as [number, number, number])),
    cats: [[1.5, 0, -4], [-21, 0, 3.5], [38, 0, 44], [-60, 0, -2], [17, 0, 28.5]],
    emitters: b.emitters,
    // lucciole over the lemon pergolas on summer nights; no cherry blossom on this coast
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
  };
  for (const id of anchors.idlers) id.pos[1] = 0;
  // a southern town at night is lit warm and generous: lamp light reaches further over the pale stone than in Tokyo
  for (const l of b.lamps) { l.r *= 1.3; l.g *= 1.3; l.b *= 1.25; l.radius *= 1.15; }
  const interior = grotta(b, c, anchors);
  return {
    grid: g, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells,
    // the standing layer is looked for just above the path: under an arch or a vault the roof is no floor;
    // houses are hollow on the ground floor: start their columns at the floor so nobody stands in the rooms
    // (a restaurant's room is walkable: its floor is the standing layer)
    navTop: (x, z) => { const id = plan.lot[col(x, z)]; return Math.min(g.sy - 8, plan.walk[col(x, z)] + (id ? (plan.lots[id - 1].food || plan.lots[id - 1].hotel ? 1 : 0) : 3)); },
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

/**
 * Limestone of the coast: beds a metre or so thick, gently tilted, stained in long dark streaks where the water
 * runs down, a tuft of caper or broom on a ledge here and there.
 */
function cliffRock(c: AC, x: number, y: number, z: number): number {
  const n = hash3(x, y >> 1, z);
  if (hash3(x >> 1, 7, z >> 1) < 0.1 && hash3(x >> 1, y >> 4, z >> 1) < 0.8) return c.cliffStreak;
  if (n < 0.025) return c.herb;
  const bed = hash3(0, (y + ((x + z) >> 4)) >> 2, 11);
  return bed < 0.28 ? c.limeDark : bed < 0.78 ? (n < 0.5 ? c.lime : c.limeLight) : c.limeLight;
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
      const wild = kd === K.Rock && (mz < -44 || w > layerOf(29) || isFoot(mx, mz));
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
            if (wild) return d === 0 ? [c.grassDry, c.herb, c.lime][Math.floor(hash3(xx, y >> 1, zz) * 2.5)] : cliffRock(c, xx, y, zz);
            if (d === 0) { const n = hash3(xx, 9, zz); return n < 0.55 ? c.grass : n < 0.8 ? c.herb : c.soil; }
            if (d === 1) return c.soil;
            return masonry(c, xx, y, zz, white);
          }
        }
      });
      // a sea cliff or a crag: its face is bedded limestone all the way down, not the plain bedrock behind it
      if (wild) {
        let lo = w;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          // (the edge of the map counts as a drop: the coast beyond is drawn lower)
          if (nx < VX0 || nz < VZ0 || nx >= VX0 + SX || nz >= VZ0 + SZ) { lo = 0; continue; }
          const nc = col(nx, nz), nw = plan.walk[nc];
          lo = Math.min(lo, nw);
          // the face is never ruler-flat: knobs and ribs of rock stand out a hand or two into the air beside it
          const nk = plan.kind[nc];
          if (nw < w - 8 && (nk === K.Sea || nk === K.Rock))
            for (let y = nk === K.Sea ? nw : nw + 9; y < w - 1; y++) {
              const h = hash3(x >> 1, y >> 2, z >> 1);
              if (h < 0.3 && hash3(nx, y >> 3, nz) < 0.7) g.set(nx, y, nz, cliffRock(c, nx, y, nz));
            }
        }
        if (lo < y0) g.box(x, Math.max(0, lo - 2), z, x, y0 - 1, z, (xx, y, zz) => cliffRock(c, xx, y, zz));
      }
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
        const tr = ((px - ax) * dx + (pz - az) * dz) / len2, t = Math.max(0, Math.min(1, tr));
        const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
        if (d > r) continue;
        // a tunnel stops dead at its portals: nothing of it stands out in front of the rock face
        if (s.kind === K.Tunnel && (tr < 0 || tr > 1)) continue;
        const floor = layerOf(ay + (by - ay) * t);
        const ci = col(x, z);
        const inside = d <= s.w / 2;
        // a round vault: highest along the middle, springing from the walls
        const spring = floor + Math.round((s.roof - 1.2) / V);
        const crown = spring + Math.round(Math.sqrt(Math.max(0, 1 - (d / (s.w / 2)) ** 2)) * 1.2 / V);
        const lt = plan.lot[ci] ? plan.lots[plan.lot[ci] - 1] : null;
        const hd = headlandY(px, pz);
        const hill = layerOf(hd > -99 ? Math.floor(hd) : hillY(px, pz));
        const top = Math.max(lt ? lt.top : 0, s.kind === K.Tunnel ? hill : spring + 14 + Math.round(hash3(x >> 4, 1, z >> 4) * 12));
        const wall = s.kind === K.Tunnel ? c.limeDark : lt ? c.plasterOld : c.tufa;
        if (inside) {
          // the hill the passage burrows through is cut away under the vault
          if (crown > floor) g.box(x, floor, z, x, crown - 1, z, 0);
          // (a tunnel's lining is a few courses of stone; above it is the headland's own limestone)
          g.box(x, crown, z, x, top, z, (xx, y, zz) => (y === crown ? c.stripeTufa : y > top - 2 && s.kind !== K.Tunnel ? c.roofWhite : s.kind === K.Tunnel && y > top - 2 ? c.grassDry : s.kind === K.Tunnel && y > crown + 6 ? cliffRock(c, xx, y, zz) : masonry(c, xx, y, zz, false) === c.mortar ? c.mortar : wall));
        } else if (plan.kind[ci] !== s.kind && t > 0 && t < 1) {
          // side walls only: the two ends stay open
          g.box(x, floor, z, x, top, z, (xx, y, zz) => (y > top - 2 && s.kind !== K.Tunnel ? c.roofWhite : y < floor + 2 ? c.plinth : s.kind === K.Tunnel && y > spring + 8 ? cliffRock(c, xx, y, zz) : masonry(c, xx, y, zz, s.kind !== K.Tunnel)));
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
        const tr = ((px - ax) * dx + (pz - az) * dz) / len2, t = Math.max(0, Math.min(1, tr));
        const d = Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
        if (d > r) continue;
        if (s.kind === K.Tunnel && (tr < 0 || tr > 1)) continue; // (the portal's face, as in covered())
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
  if (lt.hotel) hotelHouse(b, c, plan, lt);
  else if (lt.food) eatery(b, c, lt);
  else if (x1 - x0 >= 7 && z1 - z0 >= 7 && top - base >= 14) room(b, c, lt);
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
  // a hotel's guest rooms open their own French windows on the view
  const view = lt.hotel ? viewSide(plan, lt) : null;
  for (const f of faces) {
    const front = f.side === lt.side;
    // window bays: 3 voxels of glass, 2 of wall and shutter either side
    const bays: number[] = [];
    for (let a = 3; a + 4 < f.n; a += 7 + (lt.seed % 2)) bays.push(a);
    for (let fl = 0; fl < floors; fl++) {
      const yb = base + fl * 12;
      if (view === f.side && fl >= 1 && fl <= (lt.guestFloors ?? 0)) continue;
      for (const a of bays) {
        const [ox, oz] = f.out(a + 1);
        const ground = outside(ox, oz);
        if (ground > yb + 3) continue; // buried in the hill or against the neighbour
        if (ox >= VX0 && oz >= VZ0 && ox < VX0 + SX && oz < VZ0 + SZ && plan.kind[col(ox, oz)] === K.Covered) continue; // onto a covered passage: its vault and the house over it
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
    if (!front || lt.food || lt.hotel) continue;
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
  // a terracotta downpipe from the gutter to the ground at a corner of the front, clipped to the wall
  if (r() < 0.7) {
    const f = faces.find((q) => q.side === lt.side) ?? faces[0];
    const [ox, oz] = f.out(r() < 0.5 ? 1 : f.n - 2);
    const gl = outside(ox, oz);
    if (gl < top - 6) for (let y = gl; y < top; y++) if (!g.get(ox, y, oz)) g.set(ox, y, oz, (y - gl) % 10 === 9 ? c.iron : c.terracotta);
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
  // the nave is walked into from the portico like a shop: the cutaway opens it 6 m over its floor
  Object.assign(b.occluders[b.occluders.length - 1], { floor: DUOMO_Y, room: HALL_ROOM, walls: DUOMO_WALLS, shell: 3 });
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
    // (on the face of the screen, under the portico)
    g.box(FX + 3, Y, zc - 4, FX + 3, Y + 16, zc + 3, c.bronzeDoor);
    g.box(FX + 3, Y + 17, zc - 5, FX + 3, Y + 17, zc + 4, c.mosaicGold);
    for (const zz of [zc - 18, zc + 14]) g.box(FX + 3, Y, zz, FX + 3, Y + 12, zz + 3, c.door);
    b.lamp(-23, DUOMO_Y + 4, zc * V, WHITEWARM, 9, 0.9);
    b.lamp(-23, DUOMO_Y + 4, FW0 * V + 2, WARM, 5, 0.6);
    b.lamp(-23, DUOMO_Y + 4, FW1 * V - 2, WARM, 5, 0.6);
    // floodlights on the front at night, from the foot of the steps
    b.lamp(-6, PIAZZA_Y + 1, 9, [1, 0.86, 0.66], 8, 0.7);
    b.lamp(-6, PIAZZA_Y + 1, 19, [1, 0.86, 0.66], 8, 0.7);
    duomoDress(g, c, { Y, H, X0, X1, Z0, Z1, FX, FW0, FW1, zc });
  }
  // inside: the baroque nave, the apse and the crypt (registers its anchors in every worker)
  duomoInterior(b, { X0, X1, Z0, Z1, Y, H, FX: X1 + 1, zc: (Z0 + Z1) >> 1, roof: [c.roofTile, c.roofTileB] });
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
  // one pair of lamps near the top of the steps, framing the portico; the rest of the flight stays clear,
  // lit from below by the piazza's lamps and the cathedral's floodlights
  {
    const x = -15.7, y = PIAZZA_Y + (DUOMO_Y - PIAZZA_Y) * ((-4.5 - x) / 15.5);
    for (const z of [9.3, 18.7]) { b.place(lampPost(c), x, layerY(y), z); b.lamp(x, y + 3.4, z, WARM, 7, 0.8); }
  }
}

/**
 * The cathedral's finery, Arab-Norman by way of the nineteenth-century rebuilding: columns with gilded capitals and
 * a little arcade along the top of the portico, a marble portal round the bronze doors with a gold lunette, a band of
 * green and yellow lozenges, a rose window between two lancets, a corbel table under the gables, pinnacles and the
 * cross, and blind arcades with a corbel frieze down both sides of the nave.
 */
function duomoDress(g: SparseGrid, c: AC, d: { Y: number; H: number; X0: number; X1: number; Z0: number; Z1: number; FX: number; FW0: number; FW1: number; zc: number }): void {
  const { Y, H, X0, X1, Z0, Z1, FX, FW0, FW1, zc } = d;
  // portico columns: a base, a gilded capital where the arches spring
  for (let z = FW0; z <= FW1; z += 12) {
    g.box(FX + 4, Y, z - 1, FX + 11, Y + 1, z + 2, c.marbleGrey);
    g.box(FX + 4, Y + 12, z - 1, FX + 11, Y + 12, z + 2, c.mosaicGold);
    g.box(FX + 4, Y + 13, z - 1, FX + 11, Y + 13, z + 2, c.marble);
  }
  // along the top of the portico: a cornice, a little arcade of colonnettes, and merlons
  g.box(FX + 12, Y + 22, FW0, FX + 12, Y + 22, FW1, c.marble);
  g.box(FX + 11, Y + 25, FW0, FX + 11, Y + 25, FW1, c.marble);
  g.box(FX + 11, Y + 26, FW0, FX + 11, Y + 28, FW1, (_x, y, z) => ((z - FW0) % 4 === 0 ? c.marble : y === 28 && (z - FW0) % 4 === 2 ? c.stripeDark : 0));
  g.box(FX + 11, Y + 28, FW0, FX + 11, Y + 28, FW1, (_x, _y, z) => ((z - FW0) % 4 === 2 ? c.stripeDark : c.marble));
  g.box(FX + 11, Y + 29, FW0, FX + 11, Y + 30, FW1, (_x, _y, z) => (((z - FW0) >> 1) % 2 === 0 ? c.marble : 0));
  // the portal round the bronze doors, a lunette of gold mosaic over them
  g.box(FX + 1 + 3, Y, zc - 6, FX + 4, Y + 18, zc - 5, (_x, y) => ((y >> 1) % 2 ? c.stripeDark : c.marble));
  g.box(FX + 1 + 3, Y, zc + 4, FX + 4, Y + 18, zc + 5, (_x, y) => ((y >> 1) % 2 ? c.stripeDark : c.marble));
  for (let y = Y + 18; y <= Y + 23; y++)
    for (let z = zc - 6; z <= zc + 5; z++) {
      const r = Math.hypot(z + 0.5 - zc, (y - Y - 18) * 1.2);
      if (r > 6) continue;
      g.set(FX + 4, y, z, r > 5 ? c.marble : r > 4.2 ? c.stripeDark : hash3(z, y, 3) < 0.15 ? c.mosaicBlue : c.mosaicGold);
    }
  // a band of green and yellow lozenges across the front
  g.box(FX + 4, Y + 44, FW0 + 1, FX + 4, Y + 47, FW1 - 1, (_x, y, z) => {
    const q = Math.abs((((z % 6) + 6) % 6) - 3) + Math.abs(((y - Y - 44) % 4) - 1.5);
    return q < 1.6 ? c.majolicaGreen : q < 2.6 ? c.majolicaYellow : c.marble;
  });
  // the rose window, a wheel of twelve spokes
  const ry = Y + 57;
  for (let y = ry - 9; y <= ry + 9; y++)
    for (let z = zc - 9; z <= zc + 9; z++) {
      const r = Math.hypot(z + 0.5 - zc, y + 0.5 - ry);
      if (r > 9) continue;
      if (r > 7.2) { g.set(FX + 4, y, z, (Math.floor(Math.atan2(y - ry, z - zc) * 6) & 1) ? c.stripeDark : c.marble); continue; }
      const spoke = Math.abs(Math.sin(Math.atan2(y + 0.5 - ry, z + 0.5 - zc) * 6)) < 0.3;
      g.set(FX + 3, y, z, r < 1.6 || (r > 3.2 && r < 4) || spoke ? c.marble : c.glassLit);
    }
  // two lancet windows either side, in striped frames
  for (const z0 of [zc - 19, zc + 17]) {
    const frame = (y: number) => ((y >> 1) % 2 ? c.stripeDark : c.marble);
    for (let y = Y + 48; y <= Y + 60; y++) {
      g.box(FX + 3, y, z0, FX + 3, y, z0 + 2, c.glassLit);
      g.set(FX + 4, y, z0 - 1, frame(y)); g.set(FX + 4, y, z0 + 3, frame(y));
    }
    // the pointed head
    g.set(FX + 3, Y + 61, z0 + 1, c.glassLit);
    g.set(FX + 4, Y + 61, z0, frame(Y + 61)); g.set(FX + 4, Y + 61, z0 + 2, frame(Y + 61));
    g.set(FX + 4, Y + 62, z0 + 1, c.marble);
    g.box(FX + 4, Y + 47, z0 - 1, FX + 4, Y + 47, z0 + 3, c.marble);
  }
  // a corbel table under the gables
  g.box(FX + 4, Y + H + 9, FW0, FX + 4, Y + H + 9, FW1, c.marble);
  g.box(FX + 4, Y + H + 8, FW0, FX + 4, Y + H + 8, FW1, (_x, _y, z) => (z % 3 === 0 ? c.stripeDark : 0));
  // the cross on the great gable, pinnacles on the small ones and at the corners
  const top = Y + H + 10 + 30;
  g.box(FX + 1, top + 1, zc, FX + 2, top + 7, zc, c.mosaicGold);
  g.box(FX + 1, top + 5, zc - 2, FX + 2, top + 5, zc + 2, c.mosaicGold);
  for (const [z, yb] of [[FW0 + 8, Y + H + 18], [FW1 - 8, Y + H + 18], [FW0, Y + H + 10], [FW1 - 1, Y + H + 10]] as const) {
    g.box(FX + 1, yb + 1, z, FX + 2, yb + 5, z + 1, c.marble);
    g.box(FX + 1, yb + 6, z, FX + 2, yb + 7, z + 1, c.majolicaGreen);
    g.box(FX + 1, yb + 8, z, FX + 1, yb + 8, z, c.majolicaYellow);
  }
  // down the sides of the nave: blind arches on pilasters, a corbel frieze under the eaves
  for (const z of [Z0 - 1, Z1 + 1]) {
    for (let x = X0 + 2; x < X1 - 2; x += 12) {
      g.boxIfEmpty(x, Y + 2, z, x + 1, Y + H - 6, z, c.stripeTufa);
      for (let i = 0; i < 10; i++) {
        const t = i / 9, rise = Math.round(Math.sin(t * Math.PI) * 4);
        g.boxIfEmpty(x + 1 + i, Y + H - 9 + rise, z, x + 1 + i, Y + H - 8 + rise, z, c.stripeTufa);
      }
    }
    g.boxIfEmpty(X0, Y + H - 1, z, X1, Y + H - 1, z, c.marble);
    for (let x = X0; x <= X1; x += 2) g.boxIfEmpty(x, Y + H - 2, z, x, Y + H - 2, z, c.stripeDark);
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

/**
 * The belvedere in front of the piazza and Porta della Marina. The old sea gate now stands free: a whitewashed
 * arch with Saint Andrew in majolica over it, framing the sea, steps going down through it to the road. Either
 * side of it a marble balustrade runs along the edge over the road, with benches looking out to sea, palms in
 * stone planters, lamps and a coin telescope.
 */
function gate(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(PIAZZA_Y);
  // the arch: two piers either side of the 4 m steps, a round arch and a gable wall over it
  const X0 = Math.round((GATE_X - 1) / V), X1 = Math.round((GATE_X + 1) / V) - 1, Z0 = Math.round(5.75 / V), Z1 = Math.round(12.25 / V) - 1;
  b.occlude(X0, Z0, X1, Z1, PIAZZA_Y + 7.5, PIAZZA_Y + 0.6, 'landmark');
  b.occluders[b.occluders.length - 1].floor = PIAZZA_Y;
  b.block(X0 * V, Z0 * V, (X1 + 1) * V, 7);
  b.block(X0 * V, 11, (X1 + 1) * V, (Z1 + 1) * V);
  if (g.touches(X0, Z0, X1, Z1)) {
    for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      const pz = (z + 0.5) * V, open = Math.abs(pz - 9) < 2;
      const top = Y + 27 + (Math.abs(pz - 9) < 1.25 ? 3 - Math.round(Math.abs(pz - 9) / V / 2) : 0); // a low gable
      const face = x === X0 || x === X1;
      if (!open) {
        g.box(x, Y, z, x, top, z, (_xx, y, zz) => (y === top ? c.roofWhite : y < Y + 2 ? c.plinth : y === Y + 16 || y === Y + 24 ? c.stripeTufa : face && (zz === Z0 || zz === Z1) ? c.white : c.whiteWarm));
        continue;
      }
      const crown = Y + 16 + Math.round(Math.sqrt(Math.max(0, 1 - ((pz - 9) / 2) ** 2)) * 5);
      g.box(x, crown, z, x, top, z, (_xx, y) => (y === top ? c.roofWhite : y < crown + 2 ? c.stripeTufa : y === Y + 24 ? c.stripeTufa : c.whiteWarm));
    }
    // Saint Andrew in majolica on the sea face, a smaller panel of the town's arms on the piazza face
    for (const [x, big] of [[X1 + 1, true], [X0 - 1, false]] as const) {
      const z0 = Math.round((9 - (big ? 1.25 : 0.75)) / V), z1 = Math.round((9 + (big ? 1.25 : 0.75)) / V) - 1;
      g.box(x, Y + 25, z0 - 1, x, Y + 25 + (big ? 7 : 5), z1 + 1, c.stripeTufa);
      g.box(x, Y + 26, z0, x, Y + 25 + (big ? 6 : 4), z1, (_x, y, z) => ((y + z) % 3 === 0 ? c.majolicaYellow : (y * 3 + z) % 5 === 0 ? c.majolicaGreen : (z === z0 || z === z1) ? c.majolicaWhite : c.majolicaBlue));
    }
    // a lantern hangs in the arch
    g.box(Math.round(GATE_X / V), Y + 18, Math.round(9 / V), Math.round(GATE_X / V), Y + 20, Math.round(9 / V), c.iron);
    g.set(Math.round(GATE_X / V), Y + 17, Math.round(9 / V), c.lampGlow);
  }
  b.lamp(GATE_X, PIAZZA_Y + 4.1, 9, WARM, 6, 0.9);
  b.lamp(GATE_X + 1.6, PIAZZA_Y + 6, 9, WARM, 5, 0.5);
  // the balustrade along the edge over the road, turning down both sides of the steps
  const BX = Math.round(BELV_X1 / V) - 1;
  const zA = Math.round(-6 / V), zB = Math.round(30 / V) - 1, s0 = Math.round(7 / V), s1 = Math.round(11 / V);
  const rail: [number, number][] = [];
  for (let z = zA; z <= zB; z++) if (z < s0 - 1 || z > s1) rail.push([BX, z]);
  for (let x = Math.round((GATE_X + 1) / V); x <= BX; x++) rail.push([x, s0 - 1], [x, s1]);
  for (const [x, z] of rail) {
    b.block(x * V, z * V, (x + 1) * V - 0.01, (z + 1) * V - 0.01);
    if (!g.touches(x, z, x, z)) continue;
    const y0 = Y;
    g.set(x, y0, z, c.marbleGrey);
    if ((x + z) % 2 === 0) g.box(x, y0 + 1, z, x, y0 + 2, z, c.marble);
    g.set(x, y0 + 3, z, c.marble);
  }
  // stone posts where the rail ends at the steps
  for (const z of [s0 - 1, s1]) if (g.touches(BX, z, BX, z)) g.box(BX, Y, z, BX, Y + 4, z, c.marbleGrey);
  // benches looking out to sea, lamps between them
  for (const z of [-3.5, 0.5, 16, 20, 24, 28]) { b.place(bench(k(b)), BELV_X1 - 1.15, PIAZZA_Y, z, 1); b.benches.push([BELV_X1 - 1.15, z, Math.PI / 2, PIAZZA_Y]); }
  for (const z of [-5.4, 4, 14, 22, 29.4]) { b.place(lampPost(c), BELV_X1 - 0.75, PIAZZA_Y, z); b.lamp(BELV_X1 - 0.75, PIAZZA_Y + 3.4, z, WARM, 7, 0.85); }
  // palms in stone planters, oleander between
  for (const [x, z, seed] of [[BELV_X0 + 2.5, 2.5, 61], [BELV_X0 + 2.5, 15.5, 62], [BELV_X0 + 2.5, -3, 63], [BELV_X0 + 2.5, 26, 64]] as const) {
    const px = Math.round(x / V), pz = Math.round(z / V);
    b.block(x - 0.75, z - 0.75, x + 0.75, z + 0.75);
    if (g.touches(px - 3, pz - 3, px + 3, pz + 3)) {
      g.box(px - 3, Y, pz - 3, px + 2, Y + 1, pz + 2, (xx, _y, zz) => (xx === px - 3 || xx === px + 2 || zz === pz - 3 || zz === pz + 2 ? c.marbleGrey : c.soil));
      for (let zz = pz - 2; zz <= pz + 1; zz++) for (let xx = px - 2; xx <= px + 1; xx++) if (hash3(xx, 3, zz) < 0.35) g.set(xx, Y + 2, zz, hash3(xx, 4, zz) < 0.4 ? c.geranium : c.leaf);
    }
    b.place(palmTree(c, seed), x, PIAZZA_Y + 0.5, z);
  }
  for (const z of [8.2 - 4.5, 9.8 + 4.5]) b.place(oleander(c, Math.round(z * 10)), BELV_X0 + 4.6, PIAZZA_Y, z);
  b.place(telescope(c), BELV_X1 - 0.8, PIAZZA_Y, 18, 1);
  b.block(BELV_X1 - 1.1, 17.7, BELV_X1 - 0.5, 18.3);
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

/**
 * Il Molo: a stone pier straight out from the beach below the piazza, a seat-high parapet along it, lamps,
 * lifebuoys and a round belvedere at the end with benches and a cast-iron candelabra.
 */
function molo(b: Builder, c: AC): void {
  const g = b.grid;
  const Y = layerOf(PIER_Y);
  const cx = PIER_END - PIER_R, cz = 9;
  const zL = Math.round((cz - PIER_HALF) / V), zR = Math.round((cz + PIER_HALF) / V) - 1;
  const xA = Math.round(37.25 / V), xB = Math.round(cx / V);
  const wall: [number, number][] = [];
  for (let x = xA; x <= xB; x++) {
    const px = (x + 0.5) * V;
    if (Math.hypot(px - cx, (zL + 0.5) * V - cz) < PIER_R - 0.6) continue;
    wall.push([x, zL], [x, zR]);
  }
  // the rim of the round end, with an opening onto the pier
  const xr0 = Math.round((cx - PIER_R) / V), xr1 = Math.round((cx + PIER_R) / V);
  for (let z = Math.round((cz - PIER_R) / V); z <= Math.round((cz + PIER_R) / V); z++)
    for (let x = xr0; x <= xr1; x++) {
      const d = Math.hypot((x + 0.5) * V - cx, (z + 0.5) * V - cz);
      if (d > PIER_R || d < PIER_R - 0.3) continue;
      if (x * V < cx && z >= zL && z <= zR) continue;
      wall.push([x, z]);
    }
  for (const [x, z] of wall) {
    b.block(x * V, z * V, (x + 1) * V - 0.01, (z + 1) * V - 0.01);
    if (!g.touches(x, z, x, z)) continue;
    g.box(x, Y, z, x, Y + 1, z, (xx, y, zz) => (y === Y + 1 ? c.stepEdge : masonry(c, xx, y, zz, false)));
  }
  // lamps along the pier, alternating sides, and lifebuoys on posts
  for (let x = 40, i = 0; x < cx - PIER_R; x += 5.5, i++) {
    const z = i % 2 ? cz + PIER_HALF - 0.55 : cz - PIER_HALF + 0.55;
    b.place(lampPost(c), x, PIER_Y, z);
    b.lamp(x, PIER_Y + 3.4, z, WARM, 6.5, 0.85);
    b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    if (i % 2 === 0) { b.place(lifebuoy(c), x + 2.7, PIER_Y, cz + PIER_HALF - 0.4, 2); b.block(x + 2.4, cz + PIER_HALF - 0.6, x + 3, cz + PIER_HALF); }
  }
  // the round end: benches facing out, a candelabra in the middle
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2, x = cx + Math.cos(a) * (PIER_R - 1.1), z = cz + Math.sin(a) * (PIER_R - 1.1);
    if (x < cx) continue;
    const turn = Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? 1 : 0;
    b.place(bench(k(b)), x, PIER_Y, z, turn);
    b.benches.push([x, z, Math.atan2(Math.cos(a), Math.sin(a)), PIER_Y]);
  }
  for (const [x, z] of [[cx + PIER_R - 1.1, cz]] as const) { b.place(bench(k(b)), x, PIER_Y, z, 1); b.benches.push([x, z, Math.PI / 2, PIER_Y]); }
  const mx = Math.round(cx / V), mz = Math.round(cz / V);
  b.block(cx - 0.4, cz - 0.4, cx + 0.4, cz + 0.4);
  b.place(candelabra(c), cx, PIER_Y, cz);
  b.lamp(cx, PIER_Y + 3.8, cz, WARM, 8, 1.1);
  b.occlude(mx - 4, mz - 4, mx + 3, mz + 3, PIER_Y + 4.5, PIER_Y + 0.6, 'landmark');
  b.occluders[b.occluders.length - 1].floor = PIER_Y;
  // a net pile and a couple of creels left by an angler, a gozzo tied up alongside
  b.place(netPile(c, 7), cx - 1.6, PIER_Y, cz + PIER_R - 1.4);
  b.block(cx - 2.2, cz + PIER_R - 2, cx - 1, cz + PIER_R - 0.8);
  b.place(gozzo(c, 21, 30), 45, -0.7, cz - PIER_HALF - 1.2, 1);
  b.place(gozzo(c, 22, 34), 50.5, -0.7, cz + PIER_HALF + 1.2, 1);
}

/** The cast-iron candelabra on the Molo's round end: a fluted column, four arms and five glass lanterns. */
function candelabra(c: AC): Prop {
  const p = new Prop(11, 36, 11);
  p.box(3, 0, 3, 7, 1, 7, c.marbleGrey);
  p.box(4, 2, 4, 6, 3, 6, c.iron);
  p.box(5, 4, 5, 5, 30, 5, c.iron);
  p.box(4, 12, 4, 6, 12, 6, c.iron);
  p.box(4, 26, 4, 6, 26, 6, c.iron);
  for (const [x, z] of [[1, 5], [9, 5], [5, 1], [5, 9]]) {
    p.box(Math.min(x, 5), 27, Math.min(z, 5), Math.max(x, 5), 27, Math.max(z, 5), c.iron);
    p.box(x, 28, z, x, 30, z, c.lampGlow);
    p.set(x, 31, z, c.iron);
  }
  p.box(4, 31, 4, 6, 34, 6, c.lampGlow);
  p.box(4, 35, 4, 6, 35, 6, c.iron);
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
    b.stools.push([x - 0.55, z, Math.PI / 2, PIAZZA_Y], [x + 0.55, z, -Math.PI / 2, PIAZZA_Y]);
    if (seed % 2 === 0) b.place(umbrella(c, seed), x, PIAZZA_Y, z);
    // after dark a little light on every table, and the café's light spilling over its terrace
    b.lamp(x, PIAZZA_Y + 1.1, z, WARM, 2.5, 0.5);
    if (seed % 2 === 1) b.lamp(x, PIAZZA_Y + 3, z, WARM, 6, 0.7);
  };
  for (let i = 0; i < 4; i++) terrace(3 + i * 3.2, -3.6, b.k.c.white, i);
  for (let i = 0; i < 3; i++) terrace(5 + i * 3.4, 27.4, b.k.c.navy, i + 7);
  for (const [x, z] of [[2, 6], [2, 22], [18, 3], [18, 24]] as const) { b.place(bench(k(b)), x, PIAZZA_Y, z, 1); b.benches.push([x, z, Math.PI / 2, PIAZZA_Y]); }
  for (const [x, z] of [[-2.5, 7.5], [-2.5, 20.5], [19.5, 14], [19.5, 4]] as const) { b.place(potLemon(c, (x * 7 + z) | 0), x, PIAZZA_Y, z); }
  for (const [x, z] of [[1, 10], [1, 17], [17, 26]] as const) { b.place(lampPost(c), x, PIAZZA_Y, z); b.lamp(x, PIAZZA_Y + 3.4, z, WARM, 7, 0.9); }
  b.place(ceramicRack(c, 3), 14, PIAZZA_Y, -5.3);
  b.place(ceramicRack(c, 4), 7, PIAZZA_Y, 29.4, 2);
  b.place(scooter(k(b), c.hullRed), 20, PIAZZA_Y, 22, 1);
  b.place(scooter(k(b), c.sky), 20, PIAZZA_Y, 24.5, 1);
}

const k = (b: Builder) => b.k;

/** The beach with its umbrellas and boats, the harbour quay, the pier and its lighthouse, ferries and gozzi. */
function shore(b: Builder, c: AC, plan: Plan): void {
  const sand = (x: number, z: number) => (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
  // the beach is let out to lidos, each with its own umbrellas and a row of changing cabins against the sea
  // wall; a stretch at the tunnel end is the free beach, towels and odd umbrellas brought from home
  const pairs: [number, number][] = [[c.umbrellaC, c.umbrellaB], [c.umbrellaA, c.umbrellaB], [c.umbrellaE, c.umbrellaB]];
  let s = 0;
  LIDOS.forEach((l, li) => {
    const pair = pairs[li];
    for (const [x, z] of lidoUmbrellas(l)) {
      b.place(umbrella(c, s, pair), x, sand(x, z), z);
      b.place(sunbed(c), x + 1, sand(x + 1, z + 0.4), z + 0.4);
      b.block(x + 0.6, z - 0.6, x + 1.8, z + 1.4);
      s++;
    }
    for (let z = l.z0; z <= l.z1 - 1; z += 1.6) {
      if (Math.abs(z - 9) < 3) continue;
      b.place(cabin(c, pair[0], s++), 35.9, 1.55, z, 3);
    }
    b.block(35.2, l.z0 - 0.9, 36.8, l.z1 - 0.2);
  });
  // the free beach
  freeBeachTowels().forEach((t, i) => {
    b.place(towel(c, i), t.x, sand(t.x, t.z), t.z, t.alongX ? 1 : 0);
    if (t.umbrella) b.place(umbrella(c, i), t.x + 0.9, sand(t.x + 0.9, t.z), t.z);
  });
  for (let i = 0; i < 3; i++) b.place(kayak(c, i), 48.5 + i * 0.2, -0.3, -44 + i * 2.6, 0);
  // the lifeguard's tower beside Ciro
  b.place(lifeguardTower(c), 45.8, sand(45.8, 22.4), 22.4);
  b.block(44.8, 21.4, 46.8, 23.4);
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
  for (let x = 50; x < 80; x += 5) b.place(bitt(c), x, 1.0, 53.2);
  // the working quay: nets drying, lobster pots, rope, the fishermen's crates, and the ferry ticket booths
  const gear: [Prop, number, number, number][] = [
    [netPile(c, 1), 44, 59.5, 0], [netPile(c, 2), 44.3, 69, 1], [netPile(c, 3), 43.6, 75.5, 0],
    [creels(c), 44.6, 63, 1], [ropeCoil(c), 45.1, 56.3, 0], [ropeCoil(c), 45.1, 72.3, 0], [fishCrates(c, 4), 42.8, 57.2, 0],
    [ticketBooth(c, 1), 36.4, 61, 3], [ticketBooth(c, 2), 36.4, 64.5, 3],
  ];
  for (const [p, x, z, t] of gear) {
    const pl = b.place(p, x, 1.0, z, t);
    const hx = (pl.sx * pl.scale) / 2, hz = (pl.sz * pl.scale) / 2;
    b.block(x - hx, z - hz, x + hx, z + hz);
  }
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
  for (let z = -48; z < 80; z += 9) { const y = floorAt(plan, ROAD_X1 + 0.6, z); b.place(lampPost(c), ROAD_X1 + 0.6, y, z); b.lamp(ROAD_X1 + 0.6, y + 3.4, z, WARM, 7, 0.8); }
  for (let z = -46; z < 78; z += 9) { const y = floorAt(plan, ROAD_X1 + 0.6, z + 4.5); b.place(bench(k(b)), ROAD_X1 + 0.6, y, z + 4.5, 1); b.benches.push([ROAD_X1 + 0.6, z + 4.5, Math.PI / 2, y]); }
  // the road tunnel's mouth
  const tz = TUNNEL_Z / V;
  if (g.touches(ROAD_X0 / V - 4, tz - 3, ROAD_X1 / V + 4, tz + 2)) {
    const Y = layerOf(2.0);
    for (let x = ROAD_X0 / V - 4; x <= ROAD_X1 / V + 4; x++) {
      const d = Math.abs((x + 0.5) * V - (ROAD_X0 + ROAD_X1) / 2);
      const crown = Y + 14 + Math.round(Math.sqrt(Math.max(0, 1 - (d / 4.2) ** 2)) * 8);
      // the headwall fills the cut in the rock face up to its brow, a stone cornice along the top
      const T = layerOf(PORTAL_Y);
      g.box(x, d < 4.2 ? crown : Y, tz, x, T - 2, tz + 1, (xx, y, zz) => (y < crown + 2 ? c.stripeTufa : masonry(c, xx, y, zz, false)));
      g.box(x, T - 1, tz, x, T, tz + 2, c.marbleGrey);
      // the arch's ring of voussoirs stands proud of the wall
      if (d < 4.7) for (let y = Y; y <= crown + 1; y++) if (d >= 4.2 || y >= crown) g.set(x, y, tz + 2, (x + y) % 3 ? c.stripeTufa : c.tufaDark);
    }
    // a marble plaque over the arch with the road's number and the year it was cut
    const xc = Math.round((ROAD_X0 + ROAD_X1) / 2 / V);
    g.box(xc - 5, Y + 26, tz + 2, xc + 4, Y + 30, tz + 2, c.marble);
    for (let x = xc - 3; x <= xc + 2; x++) if (x % 2) g.set(x, Y + 28, tz + 2, c.stripeDark);
  }
}

/** Fireflies over the lemon pergolas, from the plan alone: the same pergola test as gardens(), on a coarse grid. */
function fireflySpots(plan: Plan): [number, number, number][] {
  const out: [number, number, number][] = [];
  for (let z = VZ0 + 8; z < VZ0 + SZ - 8; z += 12)
    for (let x = VX0 + 8; x < VX0 + SX - 8; x += 12) {
      const ci = col(x, z), mx = x * V, mz = z * V;
      if (plan.kind[ci] !== K.Rock || mx > ROAD_X0 || mz < -44 || isFoot(mx, mz)) continue;
      if (hash3(Math.floor(mx / 11), 17, Math.floor(mz / 11)) >= 0.62 || hash3(x, 41, z) > 0.19) continue;
      out.push([mx, (plan.walk[ci] - G) * V + 3.0, mz]); // just above the leaf roof at 2.5 m, where they can be seen
    }
  return out.slice(0, 100);
}

/** Lemon pergolas on the terraces, olive and cypress higher up, a palm here and there. */
function gardens(b: Builder, c: AC, plan: Plan, inWin: (x: number, z: number) => boolean): void {
  const g = b.grid;
  const RING = [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]];
  /** A terrace column with the same level two cells all round (from the plan alone, so every strip agrees). */
  const flatAt = (x: number, z: number) => {
    const ci = col(x, z);
    if (plan.kind[ci] !== K.Rock || x * V > ROAD_X0 || z * V < -44 || isFoot(x * V, z * V)) return false;
    const w = plan.walk[ci];
    for (const [dx, dz] of RING) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== K.Rock || plan.walk[nc] !== w) return false; }
    return true;
  };
  const zoneAt = (x: number, z: number) => hash3(Math.floor((x * V) / 11), 17, Math.floor((z * V) / 11));
  const P = (x: number, z: number) => zoneAt(x, z) < 0.62 && flatAt(x, z);
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
      const mx = x * V, mz = z * V;
      if (mx > ROAD_X0 || mz < -44) continue;
      const flat = flatAt(x, z), zone = zoneAt(x, z);
      if (zone < 0.62 && flat) {
        if (!supported(x, z)) continue;
        // limonaia: chestnut poles every 2 m (and round the rim) carrying beams and a roof of lemon leaves at 2.5 m
        const rimX = !P(x - 1, z) || !P(x + 1, z), rimZ = !P(x, z - 1) || !P(x, z + 1);
        const post = (x % 8 === 0 && (z % 8 === 0 || rimZ)) || (z % 8 === 0 && rimX);
        const beam = x % 8 === 0 || z % 8 === 0;
        if (post) g.box(x, w, z, x, w + 9, z, c.pole);
        else if (beam) g.set(x, w + 9, z, c.pole);
        const n = hash3(x, w, z);
        g.set(x, w + 10, z, n < 0.06 ? c.lemon : n < 0.55 ? c.leaf : n < 0.85 ? c.leafDark : c.leafLight);
        // black nets drawn over part of the grove, leaves pushing through; elsewhere the leaves pile up in lumps
        if (hash3(Math.floor(x / 20), 29, Math.floor(z / 14)) < 0.22) { if (hash3(x, 77, z) < 0.7) g.set(x, w + 11, z, c.net); }
        else if (hash3(x, 78, z) < 0.3) g.set(x, w + 11, z, n < 0.5 ? c.leafLight : c.leaf);
        // underneath: lemons hanging from the leaves, a long one now and then, and trailing shoots
        if (!beam) {
          const h = hash3(x, w + 9, z);
          if (h < 0.1) { g.set(x, w + 9, z, c.lemon); if (h < 0.025) g.set(x, w + 8, z, c.lemonDeep); }
          else if (h < 0.3) g.set(x, w + 9, z, c.leafDark);
        }
        // the trees themselves, every 4 m between the poles: a trunk rising into the roof, a crown gathered round it
        if (((x % 16) + 16) % 16 === 4 && ((z % 16) + 16) % 16 === 4) {
          g.box(x, w, z, x, w + 9, z, c.trunk);
          for (let y = w + 6; y <= w + 9; y++)
            for (let dz = -2; dz <= 2; dz++)
              for (let dx = -2; dx <= 2; dx++) {
                if ((dx || dz) && Math.hypot(dx, dz) <= (y - w - 5) * 0.7 + 0.6 && !g.get(x + dx, y, z + dz) && supported(x + dx, z + dz))
                  g.set(x + dx, y, z + dz, hash3(x + dx, y, z + dz) < 0.12 ? c.lemon : y === w + 9 ? c.leaf : c.leafDark);
              }
        }
      } else if (zone > 0.9 && flat && x % 20 === 7 && z % 20 === 3) {
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
    // (a lemon tree spreads nearly 4 m: room for all of it on one level)
    for (let dz = -8; dz <= 8 && flat; dz += 4) for (let dx = -8; dx <= 8 && flat; dx += 4) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== K.Rock || plan.walk[nc] !== plan.walk[ci]) flat = false; }
    if (!flat) continue;
    const y = (plan.walk[ci] - G) * V;
    if (x * V > ROAD_X0 || isFoot(x * V, z * V)) continue;
    if (kind < 0.45) b.place(lemonTree(c, seed, kind < 0.1), x * V, y, z * V);
    else if (kind < 0.8) b.place(oliveTree(c, seed), x * V, y, z * V);
    else if (kind < 0.88) b.place(palmTree(c, seed), x * V, y, z * V);
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
function shopfronts(b: Builder, c: AC, plan: Plan): void {
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
function shrine(c: AC, seed: number): Prop {
  const p = new Prop(8, 14, 4);
  p.box(0, 1, 0, 7, 12, 0, c.majolicaWhite);
  // the picture: a blue mantle, a face, a gold halo, on yellow tiles in a blue border
  p.box(1, 2, 0, 6, 10, 0, (x, y) => (x === 1 || x === 6 || y === 2 || y === 10 ? c.majolicaBlue : c.majolicaYellow));
  p.box(2, 3, 0, 5, 7, 0, c.majolicaBlue);
  p.box(3, 7, 0, 4, 8, 0, c.peach);
  p.box(2, 9, 0, 5, 9, 0, c.mosaicGold); p.set(2, 8, 0, c.mosaicGold); p.set(5, 8, 0, c.mosaicGold);
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
      b.place(shrine(c, Math.floor(r() * 1e4)), w.x, w.y + 1.3, w.z, w.turn);
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
  g.box(8, G, 22, 44, G + 2, 25, c.majolicaBlue);
  g.box(8, G, 22, 44, G + 2, 22, (x) => (x % 3 === 0 ? c.majolicaYellow : c.majolicaWhite));
  g.box(8, G + 3, 21, 44, G + 3, 26, c.marble);
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
  place(buildFood('scialatielli', b.pal), 20 * V, 1.0, 23 * V, 2);
  place(buildFood('totani', b.pal), 33 * V, 1.0, 23 * V, 2);
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
  const seats: { x: number; z: number; face: number; taken: boolean }[] = [];
  L.tables.forEach((t, i) => {
    for (const s of [-1, 1]) {
      const [x, z] = L.P(s < 0 ? t.a - 0.5 : t.a + 2.5, t.d + 1);
      const dir = s < 0 ? L.ax : [-L.ax[0], -L.ax[1]];
      seats.push({ x, z, face: Math.atan2(dir[0], dir[1]), taken: hash3(lt.seed + i, s + 3, 17) < 0.4 });
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
    const npcs: RoomNpc[] = eaterySeats(lt).filter((s) => s.taken).map((s, i) => ({ role: 'guest', pos: [s.x, L.floorY + 0.5, s.z], facing: s.face, sit: true, seed: lt.seed + i * 13 }));
    rooms.push({
      id: `eat-${lt.food}`, kind: 'cafe', nth: rooms.length, stall: lt.food,
      rect: [Math.min(ax0, ax1), Math.min(az0, az1), Math.max(ax0, ax1), Math.max(az0, az1)],
      door: [dx, dz], npcs, spots: [],
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
function eatTable(c: AC, cloth: number, cloth2: number, wood: number): Prop {
  const p = new Prop(5, 6, 5);
  p.box(2, 0, 2, 2, 4, 2, wood);
  p.box(1, 0, 1, 3, 0, 3, wood);
  p.box(0, 5, 0, 4, 5, 4, (x, _y, z) => ((x + z) % 2 ? cloth : cloth2));
  for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4], [2, 0], [0, 2], [4, 2], [2, 4]]) p.set(x, 4, z, (x + z) % 2 ? cloth : cloth2);
  p.set(2, 6, 2, c.white); // a little vase or a candle
  return p;
}

const EAT_THEME: Record<string, { floor: 'cotto' | 'check' | 'majolica' | 'plank' | 'marble' | 'tile'; wall: keyof AC; wain: keyof AC; cloth: [keyof AC, keyof AC]; front: keyof AC; awning: [keyof AC, keyof AC] }> = {
  duomo: { floor: 'check', wall: 'cream', wain: 'shutterGreen', cloth: ['white', 'white'], front: 'shutterGreen', awning: ['shutterGreen', 'white'] },
  gemma: { floor: 'cotto', wall: 'whiteWarm', wain: 'terracotta', cloth: ['hullRed', 'white'], front: 'doorGreen', awning: ['hullRed', 'white'] },
  saraceno: { floor: 'majolica', wall: 'white', wain: 'majolicaBlue', cloth: ['umbrellaC', 'white'], front: 'shutterBlue', awning: ['umbrellaC', 'white'] },
  forno: { floor: 'cotto', wall: 'plasterOld', wain: 'tufa', cloth: ['hullRed', 'white'], front: 'door', awning: ['hullGreen', 'white'] },
  cantina: { floor: 'plank', wall: 'tufa', wain: 'door', cloth: ['stripeDark', 'stripeDark'], front: 'door', awning: ['door', 'stripeTufa'] },
  ruocco: { floor: 'tile', wall: 'cream', wain: 'ochre', cloth: ['cream', 'white'], front: 'shutterBrown', awning: ['ochre', 'white'] },
  andrea: { floor: 'tile', wall: 'white', wain: 'majolicaYellow', cloth: ['majolicaYellow', 'white'], front: 'shutterGreen', awning: ['majolicaYellow', 'white'] },
  dolceria: { floor: 'check', wall: 'pink', wain: 'white', cloth: ['pink', 'white'], front: 'rose', awning: ['bougainB', 'white'] },
  colatura: { floor: 'plank', wall: 'whiteWarm', wain: 'shutterBlue', cloth: ['white', 'umbrellaC'], front: 'shutterBlue', awning: ['umbrellaC', 'umbrellaB'] },
  masseria: { floor: 'cotto', wall: 'plasterOld', wain: 'shutterBrown', cloth: ['hullGreen', 'cream'], front: 'shutterBrown', awning: ['hullGreen', 'cream'] },
  chiostro: { floor: 'marble', wall: 'whiteWarm', wain: 'stripeTufa', cloth: ['marble', 'marbleGrey'], front: 'shutterDeep', awning: ['majolicaGreen', 'majolicaYellow'] },
  terrazza: { floor: 'marble', wall: 'white', wain: 'sky', cloth: ['white', 'white'], front: 'shutterBlue', awning: ['sky', 'white'] },
};

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
  const id = lt.food!;
  const th = EAT_THEME[id];
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
  const dishes = STALL[id]?.dishes as FoodId[] | undefined;
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

const HOTEL_THEME: Record<string, { floor: [keyof AC, keyof AC, keyof AC]; wall: keyof AC; wain: keyof AC; duvet: keyof AC; runner: keyof AC; wood: keyof AC; shutter: keyof AC; sign: keyof AC }> = {
  marina: { floor: ['majolicaBlue', 'majolicaWhite', 'majolicaYellow'], wall: 'white', wain: 'majolicaBlue', duvet: 'white', runner: 'shutterBlue', wood: 'door', shutter: 'shutterBlue', sign: 'majolicaBlue' },
  limoni: { floor: ['majolicaYellow', 'majolicaWhite', 'majolicaGreen'], wall: 'whiteWarm', wain: 'majolicaYellow', duvet: 'cream', runner: 'lemonDeep', wood: 'door', shutter: 'shutterGreen', sign: 'majolicaGreen' },
  palazzo: { floor: ['marble', 'marbleGrey', 'stripeTufa'], wall: 'cream', wain: 'stripeDark', duvet: 'white', runner: 'hullRed', wood: 'stripeDark', shutter: 'shutterDeep', sign: 'stripeDark' },
  gabbiano: { floor: ['majolicaGreen', 'majolicaWhite', 'majolicaBlue'], wall: 'white', wain: 'sky', duvet: 'white', runner: 'sky', wood: 'door', shutter: 'shutterGreen', sign: 'majolicaBlue' },
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
const tiles = (c: AC, [m, k, f]: [keyof AC, keyof AC, keyof AC], marble: boolean) => (a: number, d: number) => {
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
  const palazzo = H.id === 'palazzo';
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
  box(0, 6, 3, 0, 9, 8, (_a, y, d) => (y === 6 || y === 9 || d === 3 || d === 8 ? c.mosaicGold : y < 8 ? c.umbrellaC : c.sky));
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
    o.box(0, 5, b0 + 1, 0, 8, b1 - 1, (_a, y, v) => (y === 5 || y === 8 || v === b0 + 1 || v === b1 - 1 ? (palazzo ? c.mosaicGold : c.majolicaYellow) : (v + y) % 3 ? c.sky : c.umbrellaC));
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
