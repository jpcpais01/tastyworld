import { paintColors, picture, hangIn } from './paintings';
import { dineColors, dressWalls, tableTop, pendants, counterPiece, cornerPlant, rug, cornice, shelfProp, hiddenKitchenDress, onWall, walls, bare, stretches, put as dput, air as dair, blockCells as dblock, sideOf, F16, type Dine, type Goods } from './dining';
import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, V, VX0, VZ0, SX, SZ, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, BuildResult, Anchors, PlacedProp, Window, WARM, WHITEWARM, StallAnchor } from './tokyo';
import { Prop, rotateProp, bench, bush, grassTuft } from './props';
import { buildFood, type FoodId } from './food';
import { SWAY } from './sway';
import { mosqueInterior, mosqueWalls, HALL_ROOM } from './sacred';
import type { RoomAnchor, RoomKind } from './interiors';
import { paneOf, type HotelAnchor, type HotelRoomAnchor } from './hotels';
import { ISTANBUL_HOTELS } from '../data/hotels';
import { halls, bazaarShop, bazaarKeeper, bazaarStand, bazaarTrade, bazaarShoppers, hallFloor, WARM_ZONES } from './bazaars';
import { istanbulTrade } from '../data/souvenirs';
import {
  istanbulPlan, K, col, layerOf, inMap, hillY, isPath, shoreDist, type LotPlan, type Plan, type PathSeg,
  QUAY_Y, HORN_Z, BOS_X, YENI, YENI_Y, SULEY, HILLTOP_Y, STATION, GRAND, beyond, BRIDGE_GATE_Z,
  COAST, LANDINGS, PONTOONS, PONTOON_Y, landingStep, pontoonAt, seaBed, type Rect,
} from './istanbulPlan';

/**
 * Istanbul: Eminönü on the corner where the Golden Horn meets the Bosphorus. The New Mosque and its pigeons over
 * the square, the fish boats rocking at the quay, the ferry piers, the Galata Bridge lined with fishermen, the
 * Spice Bazaar's vaulted L, Hamidiye and the tram through Sirkeci, the long market street up to the Grand Bazaar's
 * painted halls and the great mosque on its hilltop, its terrace looking out over the water; wooden houses with
 * bay windows on the lanes in between. The ground plan comes from world/istanbulPlan.ts; this fills it in.
 */

function istanbulColors(b: Builder) {
  const a = (hex: number, vary = 0.06, o: { emit?: number; night?: boolean; leaf?: boolean; glass?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
  const F = { leaf: true }, GL = { glass: true };
  const c = {
    // stone: grey limestone of the mosques, the pinkish Küfeki stone of the hans, Ottoman brick, granite setts
    lime: a(0xd6d0c4, 0.05), limeDark: a(0xb9b2a4, 0.06), limeLight: a(0xe8e3d8, 0.04), kufeki: a(0xd8c7a8, 0.06), kufekiDark: a(0xbfac8a, 0.06),
    brick: a(0xa65a3e, 0.08), brickDark: a(0x8a4630, 0.08), mortar: a(0xcdbfa6, 0.05), granite: a(0x8b8781, 0.08), graniteB: a(0x77736d, 0.08),
    sett: a(0x7d7872, 0.1), settB: a(0x6a655f, 0.1), settLight: a(0x99938a, 0.08), kerb: a(0xc8c1b5, 0.04), slab: a(0xb1aa9f, 0.05), slabB: a(0x9f988d, 0.05),
    marble: a(0xf0ede6, 0.03), marbleGrey: a(0xd2cec6, 0.04), asphalt: a(0x56575b, 0.05), quayEdge: a(0xc9c3b6, 0.04), wet: a(0x4f4d48, 0.06), algae: a(0x3e5a3a, 0.12),
    seaBed: a(0x5d5a50, 0.12), seaBedB: a(0x6f6a5c, 0.12), soil: a(0x6a5238, 0.1), grass: a(0x6f9a46, 0.14), grassDry: a(0x9aa058, 0.14), clover: a(0x5d8a3a, 0.14), gravel: a(0xc9bfac, 0.1),
    // plaster and paint of the 19th-century blocks, and the painted boards of the wooden houses
    cream: a(0xeee2c8, 0.04), ochre: a(0xdcae6a, 0.04), apricot: a(0xe8b48a, 0.04), rose: a(0xd99a8a, 0.04), salmon: a(0xe3a07e, 0.04), mint: a(0xb9cfb6, 0.04),
    powder: a(0xb8c8d6, 0.04), lilac: a(0xc7b6c9, 0.04), stone: a(0xcfc4b0, 0.04), grey: a(0xb5b1aa, 0.04), white: a(0xf2eee6, 0.03), yellow: a(0xead08a, 0.04),
    woodRed: a(0x8e3b2c, 0.06), woodOchre: a(0xc88f4a, 0.06), woodBlue: a(0x6f8ea6, 0.05), woodGreen: a(0x6f8a68, 0.05), woodGrey: a(0x8c8478, 0.06), woodCream: a(0xe2d3b2, 0.05),
    terraPlaster: a(0xc0634e, 0.04), sage: a(0xa9b892, 0.04), sky: a(0xa8c4d8, 0.04), blush: a(0xe6bcb2, 0.04), sand: a(0xdcc79c, 0.04), pistachioP: a(0xcfd8a6, 0.04),
    deepOchre: a(0xc98d45, 0.04), warmGrey: a(0xc2b8a8, 0.04), oxblood: a(0x9a4a3e, 0.05), tealP: a(0x7fa8a0, 0.04), woodTeal: a(0x5f8c8a, 0.05), woodYellow: a(0xd8b45a, 0.05), woodPink: a(0xc98f86, 0.05),
    trimGreen: a(0x3e5c48, 0.03), trimOx: a(0x7a3026, 0.03), trimBlue: a(0x3f5a78, 0.03), trimOchre: a(0xb8873e, 0.03), rusticA: a(0xd2c4a8, 0.05), rusticB: a(0xc4b597, 0.05),
    woodBare: a(0x7a5a3e, 0.08), woodDark: a(0x4e3424, 0.07), eave: a(0x5e4130, 0.06), trim: a(0xf1ece2, 0.03), trimDark: a(0x3d3532, 0.04), cornice: a(0xe5ddce, 0.03),
    shutter: a(0x4f6b4a, 0.04), shutterB: a(0x6b4a34, 0.04), shutterC: a(0x5a6e82, 0.04), kafes: a(0x5a3e2a, 0.05), iron: a(0x2b2a2a, 0.04), ironGreen: a(0x2f4a3a, 0.04),
    glass: a(0x51687a, 0.05, GL), glassDark: a(0x3e4f5c, 0.05, GL), glassLit: a(0x7d8fa0, 0.05, { emit: 0.8, night: true, glass: true }), shopGlass: a(0xe8dcc4, 0.03, { emit: 0.55, glass: true }),
    door: a(0x5a3a26, 0.06), doorGreen: a(0x31503c, 0.05), doorBlue: a(0x2f4a66, 0.05), sign: a(0xf4f0e4, 0.02), signRed: a(0xb8322a, 0.03), signBlue: a(0x23406a, 0.03), signGreen: a(0x2f6a4a, 0.03),
    roofTile: a(0xa8563a, 0.07), roofTileB: a(0x8f4530, 0.07), roofFlat: a(0x9e9a92, 0.06), lead: a(0x7d8790, 0.05), leadDark: a(0x66707a, 0.05), leadLight: a(0x98a2aa, 0.04), gold: a(0xd8b04a, 0.05, { emit: 0.15 }),
    // tiles and the mosques' ornament
    iznikBlue: a(0x2f5f9a, 0.05), iznikTeal: a(0x2f8a8a, 0.05), iznikRed: a(0xb8322a, 0.05), iznikWhite: a(0xf3f1ea, 0.02), iznikGreen: a(0x3f8a4a, 0.05), cobalt: a(0x23406a, 0.04),
    paintRed: a(0x9c3428, 0.05), paintBlue: a(0x3a5a86, 0.05), paintCream: a(0xefe4c8, 0.03), paintGold: a(0xc9a44a, 0.05),
    // plants
    leaf: a(0x3f6e2e, 0.14, F), leafDark: a(0x2c5422, 0.14, F), leafLight: a(0x5e8f3a, 0.14, F), plane: a(0x5a8a3a, 0.14, F), planeB: a(0x47782f, 0.14, F), planeLight: a(0x7aa64a, 0.12, F),
    cypress: a(0x2c4a2e, 0.1, F), judas: a(0xc8508a, 0.1, F), judasB: a(0xe07aa8, 0.1, F), fig: a(0x4f7a32, 0.12, F), rose2: a(0xd23a4a, 0.08, F), geranium: a(0xe8485a, 0.08, F), wisteria: a(0x9a7ac8, 0.1, F), wisteriaB: a(0xbfa2e0, 0.1, F), ivy: a(0x355f2a, 0.14, F), tulip: a(0xe0402e, 0.06, F), tulipY: a(0xf0c23a, 0.06, F),
    trunk: a(0x6a5440, 0.1), terracotta: a(0xb86a44, 0.06), bark: a(0x9a8a72, 0.1), barkB: a(0xc4b8a2, 0.08),
    // the water's edge, boats and ferries
    hullWhite: a(0xf2efe8, 0.03), hullDark: a(0x22262c, 0.04), hullRed: a(0xa83a2c, 0.04), hullBlue: a(0x2f5d9a, 0.04), hullGreen: a(0x2f7a5a, 0.04), hullYellow: a(0xe9c23a, 0.04),
    gilt: a(0xd8a940, 0.06), deck: a(0xb08458, 0.06), funnel: a(0xe8b830, 0.03), funnelBlack: a(0x1e1f22, 0.03), ferryBand: a(0x1f3b66, 0.03), rope: a(0xc9b48a, 0.05),
    awnRed: a(0xc23a2e, 0.03), awnWhite: a(0xf3efe4, 0.03), awnGreen: a(0x2f7a52, 0.03), awnBlue: a(0x2f5d9a, 0.03), awnYellow: a(0xe6b83a, 0.03), awnBrown: a(0x7a4a2e, 0.03),
    // the bazaars' goods
    spiceRed: a(0xb8322a, 0.08), spiceOrange: a(0xd8762a, 0.08), spiceYellow: a(0xe0b02a, 0.08), spiceGreen: a(0x6a8a3a, 0.08), spiceBrown: a(0x7a4a2a, 0.08), spiceDark: a(0x4a2a1a, 0.08),
    lokumPink: a(0xf2a0b8, 0.04), lokumWhite: a(0xf6f0e4, 0.03), lokumGreen: a(0x9ac87a, 0.04), apricot2: a(0xe89a3a, 0.06), fig2: a(0x6a4a3a, 0.06), nut: a(0xb88a5a, 0.08), pistachio: a(0x9ab86a, 0.06),
    // the halls' flagstones and inlays, the skylights' glass, and more of the bazaars' wares
    floorA: a(0xcdbfa6, 0.04), floorB: a(0xbfb197, 0.04), floorC: a(0xd9cdb5, 0.03), floorD: a(0xa89a80, 0.05), marbleRed: a(0x9a4a3a, 0.04), marbleGreen: a(0x3f6a58, 0.04),
    skyGlass: a(0xdce9ef, 0.02, GL), woodFloor: a(0x8a6440, 0.06), woodFloorB: a(0x765434, 0.06),
    silkPink: a(0xd04a7a, 0.04), silkTeal: a(0x2a9a9a, 0.04), silkPurple: a(0x6a3a8a, 0.04), silkGold: a(0xe0b040, 0.04),
    silver: a(0xc8ccd0, 0.03, { emit: 0.12 }), ruby: a(0xc0203a, 0.03, { emit: 0.3 }), emerald: a(0x20a060, 0.03, { emit: 0.3 }), turquoise: a(0x3ab8b0, 0.03, { emit: 0.2 }),
    leather: a(0x8a5a32, 0.06), leatherDark: a(0x5a3a22, 0.06), soapGreen: a(0x8aa858, 0.05), soapCream: a(0xe8dcb0, 0.04), sponge: a(0xd8b878, 0.08),
    carpetRed: a(0x9a2a2a, 0.06), carpetBlue: a(0x2a3a6a, 0.06), carpetCream: a(0xe6d8b8, 0.05), carpetGold: a(0xc8963a, 0.06),
    lampRed: a(0xe84a3a, 0.03, { emit: 0.9 }), lampBlue: a(0x4a8ae8, 0.03, { emit: 0.9 }), lampGreen: a(0x4ac87a, 0.03, { emit: 0.9 }), lampAmber: a(0xf2a640, 0.03, { emit: 0.9 }),
    copper: a(0xb8693a, 0.06), brass: a(0xc8a04a, 0.05), tea: a(0xa83a1a, 0.05, { emit: 0.1 }), simit: a(0xb8743a, 0.08), simitDark: a(0x8a4a22, 0.08), sesame: a(0xe8d8a8, 0.08),
    cartRed: a(0xc8302a, 0.03), flagRed: a(0xd8202a, 0.02), cartGlass: a(0xe8f0f2, 0.02, { glass: true }), chrome: a(0xb8bec4, 0.03), tramWhite: a(0xf2f2ee, 0.02), tramRed: a(0xc8282a, 0.03), rail: a(0x8a8580, 0.05), sleeper: a(0x5a4636, 0.06),
    lampGlow: a(0xffd89a, 0.03, { emit: 0.9, night: true }), lampGlowAlways: a(0xffd89a, 0.03, { emit: 0.85 }), ember: a(0xff7a2a, 0.05, { emit: 0.9 }),
    nazarBlue: a(0x1f4fb8, 0.03, { emit: 0.15 }), nazarLight: a(0x7ab8f0, 0.03), nazarWhite: a(0xf8f8f4, 0.02), nazarDark: a(0x14141a, 0.02),
    // the small things on a block's walls: zinc downpipes, satellite dishes, the roller shutters' housings
    zinc: a(0x8e9498, 0.04), zincDark: a(0x6e7478, 0.04), dish: a(0xe6e4de, 0.03), kepenk: a(0x9a9c9e, 0.04),
  };
  // each wall's weathered shades: the damp that rises from the street, the streaks the rain leaves under a sill
  const shade = (i: number, k: number, warm = 0) => {
    const f = (v: number, w: number) => Math.max(0, Math.min(255, Math.round(v * k + w)));
    return (f(b.pal.r[i], warm) << 16) | (f(b.pal.g[i], warm * 0.6) << 8) | f(b.pal.b[i], 0);
  };
  const walls = [...new Set([...PLASTER(c), ...GROUND_WALLS(c), c.brick])];
  const dirt = new Map(walls.map((i) => [i, a(shade(i, 0.84, -4), 0.07)] as const));
  const damp = new Map(walls.map((i) => [i, a(shade(i, 0.91, 2), 0.08)] as const));
  return { ...c, dirt, damp };
}

export type IC2 = ReturnType<typeof istanbulColors>;

// ------------------------------------------------------------------------------------------- lot frames

/**
 * A lot seen from its street: a runs along the front (0..W-1), d goes in from the front wall (0..D-1).
 * `out` is the direction from the front into the street.
 */
/** v mod m, never negative: world voxel coordinates run below zero west and south of the origin. */
export const pm = (v: number, m: number) => ((v % m) + m) % m;
/** Past the town's edge, at voxel column (x, z). */
const outCell = (x: number, z: number) => beyond((x + 0.5) * V, (z + 0.5) * V);

export class Frame {
  W: number; D: number; out: [number, number];
  constructor(readonly lt: LotPlan) {
    const ns = lt.side === 'n' || lt.side === 's';
    this.W = ns ? lt.x1 - lt.x0 + 1 : lt.z1 - lt.z0 + 1;
    this.D = ns ? lt.z1 - lt.z0 + 1 : lt.x1 - lt.x0 + 1;
    this.out = lt.side === 'n' ? [0, -1] : lt.side === 's' ? [0, 1] : lt.side === 'w' ? [-1, 0] : [1, 0];
  }
  xz(a: number, d: number): [number, number] {
    const { x0, z0, x1, z1 } = this.lt;
    switch (this.lt.side) {
      case 'n': return [x0 + a, z0 + d];
      case 's': return [x1 - a, z1 - d];
      case 'w': return [x0 + d, z1 - a];
      case 'e': return [x1 - d, z0 + a];
    }
  }
  /** Metres of the middle of cell (a, d), fractional cells allowed. */
  m(a: number, d: number): [number, number] {
    const { x0, z0, x1, z1 } = this.lt;
    switch (this.lt.side) {
      case 'n': return [(x0 + a + 0.5) * V, (z0 + d + 0.5) * V];
      case 's': return [(x1 - a + 0.5) * V, (z1 - d + 0.5) * V];
      case 'w': return [(x0 + d + 0.5) * V, (z1 - a + 0.5) * V];
      case 'e': return [(x1 - d + 0.5) * V, (z0 + a + 0.5) * V];
    }
  }
  /** Facing angle (atan2(dx, dz)) of someone looking out of the front into the street. */
  get faceOut(): number { return Math.atan2(this.out[0], this.out[1]); }
  /** Quarter turns that point a prop's +z front out into the street. */
  get turnOut(): number { return faceTurn(this.out[0], this.out[1]); }
  box(g: SparseGrid, a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, c: number | ((a: number, y: number, d: number) => number)): void {
    for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++)
      for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++) {
        const [x, z] = this.xz(a, d);
        for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) g.set(x, y, z, typeof c === 'number' ? c : c(a, y, d));
      }
  }
}

/**
 * Whether the outside of the shell voxel (a, y, d) of a lot is hidden by a neighbouring building. Its walls are one
 * voxel thick, so a room's finish (a tiled dado, a rail, a picture) painted into one shows on the street side as
 * well; rooms paint only where the outside is backed by a neighbour, and leave the facade as the facade elsewhere.
 */
function backed(ctx: { plan: Plan }, f: Frame, a: number, y: number, d: number): boolean {
  const na = a <= 0 ? a - 1 : a >= f.W - 1 ? a + 1 : a, nd = d >= f.D - 1 ? d + 1 : d <= 0 ? d - 1 : d;
  if (na === a && nd === d) return true;
  const [x, z] = f.xz(na, nd);
  if (!inMap(x, z)) return false;
  const li = ctx.plan.lot[col(x, z)];
  if (!li || li === f.lt.id) return false;
  const n = ctx.plan.lots[li - 1];
  return y >= n.base - 1 && y < n.top;
}

/** A room-finish painter that keeps the shell voxel as it is wherever the outside of the wall is open. */
function lined(ctx: { plan: Plan; b: Builder }, f: Frame, v: (a: number, y: number, d: number) => number): (a: number, y: number, d: number) => number {
  return (a, y, d) => {
    if (backed(ctx, f, a, y, d)) return v(a, y, d);
    const [x, z] = f.xz(a, d);
    return ctx.b.grid.get(x, y, z);
  };
}

/** The turns that point a prop's front (+z as built) along a direction, to the nearest axis. */
function faceTurn(fx: number, fz: number): number {
  return Math.abs(fx) > Math.abs(fz) ? (fx > 0 ? 1 : 3) : (fz > 0 ? 0 : 2);
}

// ------------------------------------------------------------------------------------------- props

function planeTree(c: IC2, seed: number, big = false): Prop {
  const r = rng(seed);
  const s = big ? 1.35 : 1;
  const p = new Prop(Math.round(28 * s), Math.round(40 * s), Math.round(28 * s), 0.25);
  const cx = p.sx / 2, cz = p.sz / 2;
  // the plane's pale, peeling trunk, forking low
  const th = Math.round(13 * s);
  for (let y = 0; y < th; y++) p.box(Math.floor(cx) - 1, y, Math.floor(cz) - 1, Math.floor(cx), y, Math.floor(cz), (x, yy, z) => (hash3(x, yy, z + seed) < 0.35 ? c.barkB : c.bark));
  for (let i = 0; i < 4; i++) {
    const a = r() * Math.PI * 2, d = 4 + r() * 4 * s, h = 22 * s + r() * 8 * s;
    for (let t = 0; t < 1; t += 0.08) p.set(Math.round(cx + Math.cos(a) * d * t), Math.round(th + (h - th - 6) * t), Math.round(cz + Math.sin(a) * d * t), c.bark);
    p.ellipsoid(cx + Math.cos(a) * d, h, cz + Math.sin(a) * d, (6 + r() * 3) * s, (5 + r() * 2) * s, (6 + r() * 3) * s, (x, y, z) => {
      const n = hash3(x + seed, y, z);
      return n < 0.18 ? 0 : n < 0.55 ? c.plane : n < 0.85 ? c.planeB : c.planeLight;
    });
  }
  p.sway(SWAY.tree, [cx, th, cz], [0, 0, 0], (_x, y) => y >= th);
  return p;
}

function cypress(c: IC2, seed: number, h = 34): Prop {
  const p = new Prop(9, h + 2, 9, 0.25);
  p.box(4, 0, 4, 4, 2, 4, c.trunk);
  for (let y = 2; y < h; y++) {
    const rr = 1.2 + 2.6 * Math.sin(Math.PI * Math.min(1, (y - 1) / (h - 1))) ** 0.8;
    for (let z = 0; z < 9; z++) for (let x = 0; x < 9; x++) if (Math.hypot(x - 4, z - 4) <= rr && hash3(x + seed, y, z) < 0.92) p.set(x, y, z, hash3(x, y + seed, z) < 0.3 ? c.leafDark : c.cypress);
  }
  p.sway(SWAY.pine, [4, 3, 4], [0, 0, 0], (_x, y) => y >= 3);
  return p;
}

/** A Judas tree in pink flower, the colour of Istanbul's April. */
function judasTree(c: IC2, seed: number): Prop {
  const r = rng(seed);
  const p = new Prop(17, 18, 17);
  p.box(8, 0, 8, 8, 6, 8, c.trunk);
  for (let i = 0; i < 3; i++) p.ellipsoid(5 + r() * 7, 10 + r() * 3, 5 + r() * 7, 4.5, 3.5, 4.5, (x, y, z) => { const n = hash3(x + seed, y, z); return n < 0.15 ? 0 : n < 0.6 ? c.judas : n < 0.8 ? c.judasB : c.leaf; });
  p.sway(SWAY.bush, [8, 6, 8], [0, 0, 0], (_x, y) => y >= 6);
  return p;
}

function figTree(c: IC2, seed: number): Prop {
  const p = new Prop(15, 14, 15);
  p.box(7, 0, 7, 7, 4, 7, c.trunk);
  p.ellipsoid(7.5, 9, 7.5, 6.5, 4.5, 6.5, (x, y, z) => { const n = hash3(x + seed, y, z); return n < 0.12 ? 0 : n < 0.6 ? c.fig : c.leafDark; });
  p.sway(SWAY.bush, [7.5, 4, 7.5], [0, 0, 0], (_x, y) => y >= 4);
  return p;
}

/** The ornate Ottoman street lamp: a fluted iron post and a lantern under a little crown. */
function lampPost(c: IC2): Prop {
  const p = new Prop(5, 34, 5);
  p.box(0, 0, 0, 4, 2, 4, c.ironGreen);
  p.box(1, 3, 1, 3, 4, 3, c.ironGreen);
  p.box(2, 5, 2, 2, 27, 2, c.ironGreen);
  p.box(1, 28, 1, 3, 31, 3, c.lampGlow);
  p.box(0, 27, 0, 4, 27, 4, c.ironGreen); p.box(0, 32, 0, 4, 32, 4, c.ironGreen);
  p.set(2, 33, 2, c.gold);
  return p;
}

function wallLantern(c: IC2): Prop {
  const p = new Prop(3, 6, 4);
  p.box(1, 4, 0, 1, 4, 2, c.iron);
  p.box(0, 0, 1, 2, 3, 3, c.lampGlow);
  p.box(0, 4, 1, 2, 4, 3, c.iron);
  p.set(1, 5, 2, c.gold);
  return p;
}

/** A blue glass evil eye the size of a palm, hung on a wire loop: one of the three that open the hidden kitchen. */
function nazar(c: IC2): Prop {
  const p = new Prop(7, 9, 3, 0.0625);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const d = Math.hypot(x - 3, y - 3);
    if (d > 3.4) continue;
    const v = d < 0.8 ? c.nazarDark : d < 1.6 ? c.nazarLight : d < 2.4 ? c.nazarWhite : c.nazarBlue;
    p.set(x, y, 1, v);
    if (d < 2.6) { p.set(x, y, 0, c.nazarBlue); p.set(x, y, 2, c.nazarBlue); }
  }
  p.box(3, 7, 1, 3, 8, 1, c.iron);
  return p;
}

/** Plain wooden door in an old wall: the hidden kitchen, shut or open. Faces +z. */
function hiddenDoor(c: IC2, open: boolean): Prop {
  const p = new Prop(14, 22, 2);
  p.box(0, 0, 0, 13, 21, 1, (x, y) => {
    const dx = Math.abs(x - 6.5), arch = y > 16 ? Math.sqrt(Math.max(0, 25 - (y - 16) ** 2)) : 5;
    return dx <= arch ? 0 : (y + (x >> 2)) % 6 < 2 ? c.brick : c.kufeki;
  });
  for (let y = 0; y < 21; y++) for (let x = 2; x < 12; x++) {
    const dx = Math.abs(x - 6.5), arch = y > 16 ? Math.sqrt(Math.max(0, 25 - (y - 16) ** 2)) : 5;
    if (dx > arch) continue;
    if (!open) { p.set(x, y, 1, x % 3 === 0 ? c.woodDark : c.door); if (y === 9 && x === 9) p.set(x, y, 0, c.brass); }
    else p.set(x, y, 1, x < 4 ? c.door : y < 2 ? c.slab : c.glassLit);
  }
  // a little nazar over the door, the only sign
  p.box(6, 19, 0, 7, 20, 0, c.nazarBlue); p.set(6, 20, 0, c.nazarWhite);
  return p;
}

/** Low wooden stool of the tea gardens and fish boats. */
function tabure(c: IC2, col: number): Prop {
  const p = new Prop(3, 3, 3);
  for (const [x, z] of [[0, 0], [2, 0], [0, 2], [2, 2]]) p.box(x, 0, z, x, 1, z, c.woodDark);
  p.box(0, 2, 0, 2, 2, 2, col);
  return p;
}

/** A tea table: small, round-ish, a tray of tulip glasses on it. */
function teaTable(c: IC2, seed: number, glasses = true): Prop {
  const p = new Prop(6, 6, 6);
  p.box(2, 0, 2, 3, 3, 3, c.iron);
  p.box(0, 4, 0, 5, 4, 5, hash3(seed, 1, 2) < 0.5 ? c.marble : c.woodBare);
  p.set(0, 4, 0, 0); p.set(5, 4, 0, 0); p.set(0, 4, 5, 0); p.set(5, 4, 5, 0);
  if (glasses) { p.set(1, 5, 2, c.tea); p.set(4, 5, 3, c.tea); } // (indoors the dining kit lays the table instead)
  return p;
}

/** The simit cart: red, glass-cased, piled with sesame rings. Faces +z. */
function simitCart(c: IC2): Prop {
  const p = new Prop(16, 20, 10);
  for (const x of [1, 13]) { p.box(x, 0, 0, x + 2, 2, 0, c.iron); p.box(x, 0, 9, x + 2, 2, 9, c.iron); }
  // the body to counter height (1 m), the glass case of simits at one end, the other end open for handing over
  p.box(0, 3, 0, 15, 6, 9, c.cartRed);
  p.box(0, 7, 0, 15, 7, 9, c.chrome);
  p.box(10, 8, 1, 14, 13, 8, c.cartGlass);
  p.box(11, 8, 2, 13, 12, 7, 0);
  for (let y = 8; y <= 12; y++) for (let x = 11; x <= 13; x++) for (let z = 2; z <= 7; z++) {
    const ring = Math.hypot(((x - 2) % 4) - 1.5, ((z - 2) % 3) - 1) > 0.6;
    if (ring && hash3(x, y, z) < 0.8 - (y - 8) * 0.14) p.set(x, y, z, hash3(x, y + 1, z) < 0.3 ? c.simitDark : c.simit);
  }
  // a few simits stacked on a tray at the open end
  for (let x = 1; x <= 4; x++) for (let z = 3; z <= 6; z++) if ((x + z) % 2 === 0) p.set(x, 8, z, hash3(x, 8, z) < 0.3 ? c.simitDark : c.simit);
  p.box(0, 17, 0, 15, 17, 9, c.cartRed);
  p.box(0, 18, 1, 15, 18, 8, (x) => (x % 4 < 2 ? c.cartRed : c.awnWhite));
  for (const x of [0, 15]) for (const z of [0, 9]) p.box(x, 8, z, x, 16, z, c.chrome);
  return p;
}

/** A street vendor's cart with a brazier on top: chestnuts and corn. Faces +z. */
function brazierCart(c: IC2): Prop {
  const p = new Prop(16, 18, 10);
  for (const x of [1, 13]) { p.box(x, 0, 0, x + 2, 2, 0, c.iron); p.box(x, 0, 9, x + 2, 2, 9, c.iron); }
  p.box(0, 3, 0, 15, 8, 9, c.hullYellow);
  p.box(0, 8, 0, 15, 8, 9, c.chrome);
  p.box(1, 9, 1, 8, 9, 8, c.iron);
  for (let x = 2; x <= 7; x++) for (let z = 2; z <= 7; z++) p.set(x, 10, z, hash3(x, 3, z) < 0.5 ? c.spiceBrown : c.simitDark);
  p.box(1, 10, 1, 1, 10, 8, c.ember); p.box(8, 10, 1, 8, 10, 8, c.ember);
  for (let x = 10; x <= 14; x++) for (let z = 2; z <= 7; z += 2) p.box(x, 9, z, x, 9, z, c.spiceYellow);
  p.box(10, 10, 2, 14, 10, 7, (x, _y, z) => ((x + z) % 2 ? c.spiceYellow : c.apricot2));
  for (const x of [0, 15]) for (const z of [0, 9]) p.box(x, 9, z, x, 15, z, c.chrome);
  p.box(0, 16, 0, 15, 16, 9, (x) => (x % 4 < 2 ? c.awnRed : c.awnWhite));
  return p;
}

/**
 * The kumpir cart of the Ortaköy seafront: a glass warming case of giant potatoes in foil, a row of steel bins of
 * toppings (corn, olives, pickles, sausage, red cabbage, carrot) across the counter, a striped canopy. Faces +z.
 */
function kumpirCart(c: IC2): Prop {
  const p = new Prop(18, 20, 10);
  for (const x of [1, 15]) { p.box(x, 0, 0, x + 1, 2, 0, c.iron); p.box(x, 0, 9, x + 1, 2, 9, c.iron); }
  p.box(0, 3, 0, 17, 6, 9, (x, y) => (y === 5 && x % 4 < 2 ? c.awnYellow : c.awnBlue));
  p.box(0, 7, 0, 17, 7, 9, c.chrome);
  // the warming case at the back: potatoes in foil stacked behind the glass
  p.box(1, 8, 6, 9, 12, 9, c.cartGlass);
  p.box(2, 8, 7, 8, 11, 8, 0);
  for (let x = 2; x <= 8; x += 2) for (let y = 8; y <= 10; y += 2) p.box(x, y, 7, x + 1, y + 1, 8, hash3(x, y, 3) < 0.5 ? c.zinc : c.chrome);
  // the bins of toppings along the front edge
  const tops = [c.spiceYellow, c.spiceDark, c.leaf, c.cartRed, c.silkPurple, c.spiceOrange, c.sesame];
  for (let k = 0; k < 7; k++) { p.box(1 + k * 2, 8, 1, 2 + k * 2, 8, 3, c.chrome); p.box(1 + k * 2, 9, 1, 2 + k * 2, 9, 3, tops[k]); }
  // one potato split and filled, ready to hand over
  p.box(14, 8, 2, 16, 9, 5, c.zinc); p.box(14, 10, 2, 16, 10, 5, (x, _y, z) => ((x + z) % 2 ? c.spiceYellow : c.sesame));
  for (const x of [0, 17]) for (const z of [0, 9]) p.box(x, 8, z, x, 17, z, c.chrome);
  p.box(0, 18, 0, 17, 18, 9, (x) => (x % 4 < 2 ? c.awnBlue : c.awnWhite));
  p.box(0, 17, 0, 17, 17, 0, (x) => (x % 4 < 2 ? c.awnBlue : c.awnWhite));
  return p;
}

/** The lokma cart: a wide round copper pan of hot oil, a tray of golden balls in syrup, a brass urn of boza. Faces +z. */
function lokmaCart(c: IC2): Prop {
  const p = new Prop(18, 19, 10);
  for (const x of [1, 15]) { p.box(x, 0, 0, x + 1, 2, 0, c.iron); p.box(x, 0, 9, x + 1, 2, 9, c.iron); }
  p.box(0, 3, 0, 17, 7, 9, (x, y) => (y === 6 ? c.paintGold : x % 6 === 0 ? c.woodDark : c.paintCream));
  p.box(0, 8, 0, 17, 8, 9, c.chrome);
  // the frying pan over its burner, the oil catching the light
  p.cylY(5, 5, 4, 9, 10, c.copper);
  p.cylY(5, 5, 3, 10, 10, (x, _y, z) => ((x + z) % 3 === 0 ? c.simit : c.spiceYellow));
  p.box(1, 8, 1, 9, 8, 9, c.ember);
  // the tray of finished lokma, glossy
  p.box(11, 9, 1, 16, 9, 6, c.chrome);
  for (let x = 11; x <= 16; x++) for (let z = 1; z <= 6; z++) if ((x + z) % 2 === 0) p.set(x, 10, z, hash3(x, 10, z) < 0.3 ? c.simitDark : c.apricot2);
  // the boza urn with its brass lid
  p.cylY(14, 8, 1.6, 9, 13, c.brass); p.box(14, 14, 8, 14, 14, 8, c.gold);
  for (const x of [0, 17]) for (const z of [0, 9]) p.box(x, 9, z, x, 16, z, c.chrome);
  p.box(0, 17, 0, 17, 17, 9, (x) => (x % 4 < 2 ? c.awnRed : c.awnWhite));
  return p;
}

/**
 * Ayşe Teyze's gözleme corner: a low wooden table with a sheet of yufka and the thin rolling rod, the domed iron sac
 * glowing over its fire, a cushion to sit on, a double teapot on its own little stove, and a reed shade. Faces +z.
 */
function gozlemeStall(c: IC2): Prop {
  const p = new Prop(20, 20, 12);
  // the shade: four poles and a woven reed mat
  for (const x of [0, 19]) for (const z of [0, 11]) p.box(x, 0, z, x, 17, z, c.woodBare);
  p.box(0, 18, 0, 19, 18, 11, (x, _y, z) => ((x + z) % 3 === 0 ? c.woodDark : c.sand));
  // the low table with a white cloth, a round of yufka and the oklava
  p.box(2, 0, 2, 9, 3, 9, c.woodDark);
  p.box(2, 3, 2, 9, 3, 9, c.marble);
  p.cylY(5.5, 5.5, 3, 4, 4, c.cream);
  p.box(2, 5, 8, 9, 5, 8, c.woodBare);
  // the sac: a domed iron griddle over a ring of embers, a gözleme browning on it
  p.box(11, 0, 3, 17, 2, 9, c.brick);
  p.box(12, 1, 4, 16, 2, 8, c.ember);
  p.cylY(14, 6, 3.4, 3, 3, c.iron);
  p.cylY(14, 6, 2.6, 4, 4, c.iron);
  p.box(12, 5, 5, 16, 5, 7, (x, _y, z) => ((x + z) % 3 === 0 ? c.simitDark : c.cream));
  // the cushion by the table, the teapot stove at the back corner
  p.box(2, 0, 10, 5, 1, 11, c.carpetRed);
  p.box(16, 0, 10, 18, 4, 11, c.chrome); p.box(16, 5, 10, 17, 7, 11, c.copper); p.box(16, 8, 10, 17, 9, 11, c.copper);
  return p;
}

/** The mussel seller's tray stand: a wide tray of stuffed mussels with lemon wedges. Faces +z. */
function midyeStand(c: IC2): Prop {
  const p = new Prop(14, 14, 10);
  for (const [x, z] of [[1, 1], [12, 1], [1, 8], [12, 8]]) p.box(x, 0, z, x, 6, z, c.chrome);
  p.box(0, 7, 0, 13, 7, 9, c.chrome);
  for (let x = 1; x <= 12; x++) for (let z = 1; z <= 8; z++) p.set(x, 8, z, (x + z) % 3 === 0 ? c.yellow : (x + 2 * z) % 4 === 0 ? c.apricot2 : c.hullDark);
  // the kokoreç grill beside it, a long skewer turning over coals
  p.box(0, 8, 0, 13, 8, 0, c.chrome);
  p.box(1, 9, 8, 12, 9, 9, c.iron); p.box(2, 10, 8, 11, 10, 9, c.ember);
  p.box(1, 12, 8, 12, 12, 9, c.simitDark);
  p.box(0, 13, 8, 13, 13, 9, c.signRed);
  return p;
}

/** The ice-cream stall with its long iron paddle and the brass bells. Faces +z. */
function dondurmaStall(c: IC2): Prop {
  const p = new Prop(16, 24, 10);
  p.box(0, 0, 0, 15, 6, 9, c.awnRed);
  p.box(0, 3, 0, 15, 3, 0, c.gilt);
  p.box(0, 7, 0, 15, 7, 9, c.chrome);
  for (let x = 2; x <= 13; x += 4) p.box(x, 7, 2, x + 2, 7, 6, [c.lokumWhite, c.pistachio, c.lokumPink][(x / 4) | 0]);
  for (const x of [0, 15]) p.box(x, 8, 8, x, 21, 8, c.gilt);
  p.box(0, 21, 0, 15, 22, 9, (x) => (x % 4 < 2 ? c.awnRed : c.gilt));
  p.box(2, 19, 9, 2, 20, 9, c.brass); p.box(13, 19, 9, 13, 20, 9, c.brass);
  p.box(6, 8, 4, 6, 15, 4, c.iron); // the paddle stood up in the tub
  return p;
}

/**
 * A balık ekmek boat: a gilded Ottoman-style caique tied up at the quay, its grill smoking amidships, a counter at
 * the rail. Faces +z towards the quay (built bow along x).
 */
function fishBoat(c: IC2, seed: number): Prop {
  const L = 44, W = 16;
  const p = new Prop(L, 22, W);
  const band = [c.hullRed, c.hullBlue, c.hullGreen][seed % 3];
  for (let x = 0; x < L; x++) {
    const t = x / (L - 1);
    const half = (W / 2 - 0.5) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.05)) ** 0.5;
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - (W - 1) / 2);
      if (dz > half + 0.3) continue;
      const rim = dz > half - 1.2;
      const yb = Math.round((dz / Math.max(1, half)) * 3);
      const top = 7 + (t > 0.9 || t < 0.08 ? 3 : 0);
      for (let y = yb; y <= top; y++) {
        if (!rim && y > 2) { if (y === 5) p.set(x, y, z, c.deck); continue; }
        p.set(x, y, z, y >= top - 1 ? c.gilt : y >= 5 ? band : y < 2 ? c.hullDark : c.hullWhite);
      }
    }
  }
  // the grill amidships, its hood, and the counter along the quay side
  p.box(16, 6, 4, 27, 8, 8, c.iron);
  p.box(17, 9, 5, 26, 9, 7, c.ember);
  p.box(15, 16, 3, 28, 16, 9, c.chrome);
  for (const x of [15, 28]) p.box(x, 9, 3, x, 15, 3, c.chrome);
  p.box(12, 9, W - 2, 32, 9, W - 1, c.gilt);
  // a canopy striped red and gold, tasselled
  for (let x = 6; x < L - 6; x++) for (let z = 1; z < W - 1; z++) p.set(x, 19 + (z > 3 && z < W - 4 ? 1 : 0), z, (x >> 1) % 2 ? c.awnRed : c.gilt);
  for (const x of [6, L - 7]) for (const z of [1, W - 2]) p.box(x, 8, z, x, 19, z, c.gilt);
  return p;
}

/** A small rowing boat, the kind tied up along the Horn. */
function kayik(c: IC2, seed: number): Prop {
  const col = [c.hullBlue, c.hullGreen, c.hullRed, c.hullYellow][seed % 4];
  const L = 26, W = 8;
  const p = new Prop(L, 5, W);
  for (let x = 0; x < L; x++) {
    const half = (W / 2 - 0.5) * Math.sin(Math.PI * Math.min(1, (x / (L - 1)) * 1.1 + 0.04)) ** 0.6;
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - (W - 1) / 2);
      if (dz > half + 0.3) continue;
      const rim = dz > half - 1;
      for (let y = Math.round(dz / Math.max(1, half) * 1.5); y <= 3; y++) {
        if (!rim && y > 0) { if (y === 1) p.set(x, y, z, c.deck); continue; }
        p.set(x, y, z, y === 3 ? col : y === 0 ? c.hullDark : c.hullWhite);
      }
    }
  }
  p.box(Math.floor(L / 2), 2, 1, Math.floor(L / 2), 2, W - 2, c.deck);
  return p;
}

/**
 * A city-line ferry (vapur), 34 m long, tied up at a pier: a black hull, a white superstructure with two rows of
 * windows, the yellow funnel with its black top, life rings along the rails and the flag at the stern.
 */
function vapur(c: IC2): Prop {
  const L = 136, W = 34, cz = 16.5;
  const p = new Prop(L, 44, W, 0.25);
  const half = (x: number) => 16 * Math.min(1, Math.sin(Math.PI * Math.min(1, (x / (L - 1)) * 1.02 + 0.03)) ** 0.3);
  for (let x = 0; x < L; x++) {
    const h = half(x);
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - cz);
      if (dz > h) continue;
      const edge = dz > h - 1.2;
      for (let y = 0; y <= 9; y++) p.set(x, y, z, y < 7 ? c.hullDark : y === 7 ? c.hullRed : y === 9 && !edge ? c.deck : c.hullWhite);
      if (edge) { if (x % 3 === 0) p.set(x, 10, z, c.white); p.set(x, 11, z, c.white); }
    }
  }
  // two decks of saloon with windows all round
  const deck = (y0: number, x0: number, x1: number, z0: number, z1: number) => {
    p.box(x0, y0, z0, x1, y0 + 6, z1, (x, y, z) => {
      const side = z === z0 || z === z1 || x === x0 || x === x1;
      return side && y >= y0 + 2 && y <= y0 + 4 && (x + z) % 4 !== 0 ? c.glass : y === y0 + 6 ? c.ferryBand : c.hullWhite;
    });
    p.box(x0 + 1, y0, z0 + 1, x1 - 1, y0 + 5, z1 - 1, 0);
  };
  deck(10, 12, 122, 4, 29);
  deck(17, 22, 110, 6, 27);
  p.box(22, 24, 6, 110, 24, 27, c.deck);
  for (let x = 22; x <= 110; x++) for (const z of [6, 27]) { if (x % 3 === 0) p.set(x, 25, z, c.white); p.set(x, 26, z, c.white); }
  // the wheelhouses at both ends (a ferry docks either way round)
  for (const x0 of [24, 100]) { p.box(x0, 25, 10, x0 + 8, 30, 23, c.hullWhite); p.box(x0, 27, 10, x0 + 8, 28, 23, (x, _y, z) => (x === x0 || x === x0 + 8 || z === 10 || z === 23 ? c.glass : c.hullWhite)); }
  // the funnel
  p.box(60, 25, 13, 69, 38, 20, (_x, y) => (y >= 36 ? c.funnelBlack : y === 33 ? c.ferryBand : c.funnel));
  // life rings, and the flag on its staff at the stern
  for (let x = 16; x < 120; x += 14) for (const z of [Math.round(cz - half(x)), Math.round(cz + half(x))]) { p.set(x, 10, z, c.hullRed); p.set(x, 11, z, c.white); }
  p.box(3, 12, 16, 3, 24, 16, c.white);
  p.box(4, 20, 16, 10, 24, 16, (x, y) => (Math.hypot(x - 6.5, y - 22) < 1.4 && x < 7 ? c.white : c.hullRed));
  return p;
}

/**
 * A Bosphorus tour boat (Boğaz turu), 18 m: a navy hull with a white gunwale, a glazed saloon, an open top deck
 * of slatted benches under a striped awning, the wheelhouse forward and the flag at the stern. Bow towards +x.
 */
function tourBoat(c: IC2): Prop {
  const L = 72, W = 16, cz = 7.5;
  const p = new Prop(L, 30, W, 0.25);
  const half = (x: number) => 7.5 * Math.min(1, Math.sin(Math.PI * Math.min(1, (x / (L - 1)) * 0.93 + 0.07)) ** 0.35);
  for (let x = 0; x < L; x++) {
    const h = half(x);
    for (let z = 0; z < W; z++) {
      const dz = Math.abs(z - cz);
      if (dz > h) continue;
      const edge = dz > h - 1.2;
      for (let y = Math.round((dz / Math.max(1, h)) * 2); y <= 7; y++) {
        if (!edge && y > 1 && y < 6) continue;
        p.set(x, y, z, y < 4 ? c.hullRed : y < 6 ? c.ferryBand : y === 6 ? (edge ? c.white : c.deck) : edge ? c.white : 0);
      }
      if (edge && x % 3 === 0) p.set(x, 8, z, c.white);
      if (edge) p.set(x, 9, z, c.white);
    }
  }
  // the saloon, glazed all round, its roof the top deck
  p.box(10, 7, 3, 56, 12, 12, (x, y, z) => {
    const side = z === 3 || z === 12 || x === 10 || x === 56;
    if (!side) return 0;
    return y >= 9 && y <= 11 && (x + z) % 4 !== 0 ? c.glass : y === 12 ? c.ferryBand : c.hullWhite;
  });
  p.box(10, 13, 2, 56, 13, 13, c.deck);
  for (let x = 10; x <= 56; x++) for (const z of [2, 13]) { if (x % 3 === 0) p.set(x, 14, z, c.white); p.set(x, 15, z, c.white); }
  // benches on the top deck, back to back down the middle
  for (let x = 14; x <= 50; x += 4) for (const z of [4, 11]) { p.box(x, 14, z, x + 2, 14, z, c.woodBare); p.box(x, 15, z + (z < 7 ? -1 : 1), x + 2, 16, z + (z < 7 ? -1 : 1), c.woodBare); }
  // the striped awning on its posts
  for (const x of [12, 30, 48]) for (const z of [2, 13]) p.box(x, 14, z, x, 20, z, c.white);
  for (let x = 11; x <= 50; x++) for (let z = 2; z <= 13; z++) p.set(x, 21 + (z > 4 && z < 11 ? 1 : 0), z, (x >> 1) % 2 ? c.awnBlue : c.white);
  // the wheelhouse forward, the flag aft, life rings along the rails
  p.box(56, 13, 4, 63, 19, 11, (x, y, z) => (y === 19 ? c.white : y >= 16 && y <= 18 && (x === 63 || z === 4 || z === 11) ? c.glass : c.hullWhite));
  p.box(60, 20, 7, 60, 23, 7, c.iron);
  p.box(2, 8, 7, 2, 19, 7, c.white);
  p.box(3, 15, 7, 7, 18, 7, (x, y) => (x === 4 && y >= 16 && y <= 17 ? c.white : c.flagRed));
  for (let x = 14; x < 56; x += 10) for (const z of [Math.round(cz - half(x)), Math.round(cz + half(x))]) { p.set(x, 8, z, c.hullRed); p.set(x, 9, z, c.white); }
  return p;
}

/** A cast-iron bollard at the quay's edge, a turn of mooring rope round it. */
function bollard(c: IC2, rope: boolean): Prop {
  const p = new Prop(3, 5, 3);
  p.box(0, 0, 0, 2, 0, 2, c.iron);
  p.box(1, 1, 1, 1, 3, 1, c.iron);
  p.box(0, 4, 0, 2, 4, 2, c.iron);
  if (rope) { p.set(0, 2, 1, c.rope); p.set(2, 2, 1, c.rope); p.set(1, 2, 0, c.rope); p.set(1, 2, 2, c.rope); }
  return p;
}

/** The lifebuoy (can simidi) on its white post by the stairs and the landing stages, red and white. Faces +z. */
function lifebuoy(c: IC2): Prop {
  const p = new Prop(7, 13, 2);
  p.box(3, 0, 1, 3, 12, 1, c.white);
  for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
    const d = Math.hypot(x - 3, y - 3);
    if (d > 2 && d < 3.6) p.set(x, y + 5, 0, (Math.floor(Math.atan2(y - 3, x - 3) / (Math.PI / 2) + 4) % 2) ? c.white : c.hullRed);
  }
  return p;
}

/** A round planter of quay stone round the foot of a tree, a ring of grass and clover inside. */
function planter(c: IC2): Prop {
  const p = new Prop(14, 4, 14);
  for (let z = 0; z < 14; z++) for (let x = 0; x < 14; x++) {
    const d = Math.hypot(x - 6.5, z - 6.5);
    if (d > 6.9) continue;
    if (d > 5.6) p.box(x, 0, z, x, 3, z, (_x, y) => (y === 3 ? c.quayEdge : c.granite));
    else p.box(x, 0, z, x, 2, z, (_x, y) => (y < 2 ? c.soil : hash3(x, 5, z) < 0.6 ? c.grass : c.clover));
  }
  return p;
}

/**
 * The Turkish flag on its pole: red, the white crescent and star near the hoist, swinging round the pole in the
 * wind. Eighth-metre voxels, six metres of pole, the flag two and a quarter metres across. Flies along +x.
 */
function turkishFlag(c: IC2): Prop {
  const W = 19, H = 49, F0 = 36;
  const p = new Prop(W, H, 1);
  p.box(0, 0, 0, 0, H - 2, 0, c.chrome);
  p.set(0, H - 1, 0, c.gold);
  for (let y = F0; y < F0 + 12; y++) for (let x = 1; x < W; x++) {
    const cy = F0 + 5.5, dy = y - cy;
    const outer = Math.hypot(x - 6, dy) <= 3.6, inner = Math.hypot(x - 7, dy) <= 2.9;
    const star = (x === 10 && Math.abs(dy) <= 1.5) || (Math.abs(x - 10) <= 1.5 && Math.abs(dy) <= 0.5);
    p.set(x, y, 0, (outer && !inner) || star ? c.white : c.flagRed);
  }
  p.sway(SWAY.flag, [0.5, F0, 0.5], [0, 1, 0], (x, y) => x >= 1 && y >= F0);
  return p;
}

/** The tram of the T1 line, waiting at its stop: white and red, two cars, pantograph up. Built along x. */
function tram(c: IC2): Prop {
  const L = 112, W = 10;
  const p = new Prop(L, 16, W, 0.25);
  p.box(0, 1, 0, L - 1, 12, W - 1, (x, y, z) => {
    if (y <= 2) return x % 18 < 3 ? c.iron : c.hullDark;
    if (y === 3) return c.tramRed;
    const side = z === 0 || z === W - 1;
    if (side && y >= 6 && y <= 10) return x % 9 === 0 || x % 56 < 2 ? c.tramWhite : (x % 56 > 20 && x % 56 < 25 && y < 10 ? c.glassDark : c.glass);
    if ((x === 0 || x === L - 1) && y >= 6 && y <= 10 && z > 1 && z < W - 2) return c.glass;
    return y === 11 || y === 12 ? c.tramWhite : y === 5 || y === 4 ? c.tramRed : c.tramWhite;
  });
  p.box(1, 2, 1, L - 2, 11, W - 2, 0);
  p.box(1, 1, 1, L - 2, 1, W - 2, c.grey);
  p.box(54, 1, 0, 57, 12, W - 1, c.hullDark);
  for (const x0 of [24, 80]) { p.box(x0, 13, 4, x0 + 6, 13, 5, c.iron); p.box(x0 + 2, 14, 4, x0 + 3, 15, 5, c.iron); }
  return p;
}

/** A shoeshine man's brass box, gleaming. */
function shoeshine(c: IC2): Prop {
  const p = new Prop(7, 8, 5);
  p.box(0, 0, 0, 6, 3, 4, c.brass);
  p.box(1, 4, 1, 5, 4, 3, c.woodDark);
  p.box(2, 5, 2, 4, 7, 2, c.brass);
  p.set(3, 7, 2, c.gold);
  for (const x of [1, 3, 5]) p.set(x, 4, 0, c.copper);
  return p;
}

/** The bird-seed seller's table in the square, with saucers of grain for the pigeons. */
function seedTable(c: IC2): Prop {
  const p = new Prop(10, 6, 6);
  for (const [x, z] of [[0, 0], [9, 0], [0, 5], [9, 5]]) p.box(x, 0, z, x, 4, z, c.woodDark);
  p.box(0, 5, 0, 9, 5, 5, c.woodBare);
  for (let x = 1; x < 9; x += 3) for (let z = 1; z < 5; z += 3) p.box(x, 5, z, x + 1, 5, z + 1, c.gravel);
  return p;
}

/** A tea-house tray stand: the çaycı's hanging tray and the samovar. */
function samovar(c: IC2): Prop {
  const p = new Prop(5, 9, 5);
  p.box(1, 0, 1, 3, 1, 3, c.copper);
  p.box(0, 2, 0, 4, 6, 4, c.chrome);
  p.box(1, 7, 1, 3, 7, 3, c.chrome);
  p.box(2, 8, 2, 2, 8, 2, c.iron);
  p.set(4, 3, 2, c.brass);
  return p;
}

/** A tall cone of ground spice in a sack, the Spice Bazaar's way of showing off. */
function spiceSacks(c: IC2, seed: number): Prop {
  const p = new Prop(14, 9, 6);
  const cols = [c.spiceRed, c.spiceOrange, c.spiceYellow, c.spiceGreen, c.spiceBrown, c.spiceDark, c.lokumPink];
  for (let i = 0; i < 4; i++) {
    const cx = 1.5 + i * 3.5, col = cols[Math.floor(hash3(i, seed, 3) * cols.length)];
    p.cylY(cx, 3, 1.7, 0, 3, c.carpetCream);
    for (let y = 4; y < 9; y++) p.cylY(cx, 3, 1.5 - (y - 4) * 0.32, y, y, col);
  }
  return p;
}

/** Hanging mosaic glass lamps, a bunch of them, lit. */
function mosaicLamps(c: IC2, seed: number): Prop {
  const p = new Prop(9, 14, 9, 0.0625);
  const cols = [c.lampRed, c.lampBlue, c.lampGreen, c.lampAmber];
  for (let i = 0; i < 5; i++) {
    const x = 1 + Math.floor(hash3(i, seed, 1) * 6), z = 1 + Math.floor(hash3(i, seed, 2) * 6), y = 2 + Math.floor(hash3(i, seed, 3) * 6);
    p.box(x + 1, y + 3, z + 1, x + 1, 13, z + 1, c.iron);
    p.ellipsoid(x + 1, y + 1.5, z + 1, 1.2, 1.6, 1.2, cols[(i + seed) % 4]);
  }
  return p;
}

/** A carpet hung on a wall or a rail. Faces +z. */
function carpet(c: IC2, seed: number): Prop {
  const p = new Prop(8, 12, 1);
  const [f, g2, e] = [[c.carpetRed, c.carpetBlue, c.carpetCream], [c.carpetBlue, c.carpetRed, c.carpetGold], [c.carpetGold, c.carpetRed, c.carpetCream]][seed % 3];
  p.box(0, 0, 0, 7, 11, 0, (x, y) => (x === 0 || x === 7 || y === 0 || y === 11 ? e : Math.abs(x - 3.5) + Math.abs(y - 5.5) < 3 ? g2 : (x + y) % 4 === 0 ? e : f));
  return p;
}

/** A striped awning out from a shop front. Faces +z. */
function awning(cols: [number, number], w = 18): Prop {
  const p = new Prop(w, 4, 9);
  for (let z = 0; z < 9; z++) p.box(0, 3 - Math.floor(z / 3), z, w - 1, 3 - Math.floor(z / 3), z, (x) => ((x >> 1) % 2 ? cols[0] : cols[1]));
  p.box(0, 0, 8, w - 1, 0, 8, (x) => ((x >> 1) % 2 ? cols[0] : cols[1]));
  return p;
}

/** Crates of fruit and vegetables outside a grocer's. Faces +z. */
function produce(c: IC2, seed: number): Prop {
  const p = new Prop(12, 7, 6);
  p.box(0, 0, 0, 11, 2, 5, c.woodBare);
  p.box(0, 3, 2, 11, 4, 5, c.woodBare);
  const cols = [c.tulip, c.apricot2, c.spiceYellow, c.lokumGreen, c.rose2, c.spiceGreen];
  for (let x = 0; x < 12; x += 4) { const a = cols[Math.floor(hash3(x, seed, 1) * cols.length)]; p.box(x, 3, 0, x + 3, 3, 1, a); p.box(x, 5, 2, x + 3, 5, 5, cols[Math.floor(hash3(x, seed, 2) * cols.length)]); }
  return p;
}

/** A cat's little wooden house and its water bowl, put out by the neighbours. */
/** A terracotta pot by a door: geraniums, a bay tree, a little lemon. */
function pottedPlant(c: IC2, seed: number): Prop {
  const p = new Prop(6, 12, 6);
  const tall = seed % 3 === 0;
  p.cylY(3, 3, 2.4, 0, 3, (_x, y) => (y === 3 ? c.brickDark : c.brick));
  p.cylY(3, 3, 2, 4, 4, c.soil);
  const flower = [c.rose2, c.tulip, c.tulipY, c.white][seed % 4];
  if (tall) { p.box(3, 5, 3, 3, 7, 3, c.trunk); p.ellipsoid(3, 9.5, 3, 2.6, 2.3, 2.6, (x, y, z) => (hash3(x, y + seed, z) < 0.12 ? c.yellow : hash3(x, y, z + seed) < 0.5 ? c.leaf : c.leafDark)); }
  else p.ellipsoid(3, 6.5, 3, 2.8, 2.2, 2.8, (x, y, z) => (hash3(x + seed, y, z) < 0.3 ? flower : hash3(x, y, z) < 0.5 ? c.leaf : c.leafLight));
  p.sway(SWAY.bush, [3, 4, 3], [0, 0, 0], (_x, y) => y >= 5);
  return p;
}

/** A shop's blade sign on its iron bracket, standing out from the wall over the pavement. Faces +z. */
function bladeSign(c: IC2, seed: number): Prop {
  const p = new Prop(1, 7, 9);
  const col = [c.signRed, c.signBlue, c.signGreen, c.woodDark, c.gold][seed % 5];
  p.box(0, 6, 0, 0, 6, 8, c.iron);
  p.set(0, 5, 0, c.iron);
  p.box(0, 0, 3, 0, 4, 8, (_x, y, z) => (y === 0 || y === 4 || z === 3 || z === 8 ? c.gold : hash3(seed, y, z) < 0.45 ? c.white : col));
  p.sway(SWAY.bush, [0.5, 6, 5.5], [1, 0, 0], (_x, y) => y <= 4);
  return p;
}

/**
 * An Ottoman street fountain, the çeşme: a marble niche set into the wall under a pointed arch, its inscription
 * in gold on green, a brass tap, and the trough below. Faces +z, its back against the wall.
 */
function cesme(c: IC2): Prop {
  const p = new Prop(15, 24, 5);
  // the frame and the niche
  for (let y = 0; y < 22; y++) for (let x = 0; x < 15; x++) {
    const dx = Math.abs(x - 7), arch = y > 13 ? 13 + Math.round(Math.sqrt(Math.max(0, 25 - dx * dx)) * 1.3) : 99;
    const inNiche = dx <= 4 && y >= 4 && y < Math.min(arch, 20);
    p.set(x, y, 0, c.marble);
    if (!inNiche) p.set(x, y, 1, y === 21 || x === 0 || x === 14 ? c.marbleGrey : c.marble);
    else if (y >= 15 && y <= 17) p.set(x, y, 0, (x + y) % 3 === 0 ? c.gold : c.iznikGreen); // the inscription in the niche
  }
  p.box(0, 22, 0, 14, 22, 2, c.marbleGrey); // the eave
  p.box(1, 23, 0, 13, 23, 1, c.lead);
  // the tap and the trough
  p.box(7, 9, 1, 7, 9, 2, c.brass); p.set(7, 8, 2, c.brass);
  p.box(2, 0, 2, 12, 3, 4, (x, y, z) => (y === 3 || x === 2 || x === 12 || z === 4 ? c.marble : y === 2 ? c.glass : c.marbleGrey));
  return p;
}

/** A scooter parked at the kerb, as everyone in Istanbul seems to own one. Faces +z. */
function scooter(c: IC2, seed: number): Prop {
  const p = new Prop(4, 9, 13);
  const body = [c.cartRed, c.white, c.awnBlue, c.yellow, c.grey][seed % 5];
  for (const z of [1, 10]) p.box(1, 0, z, 2, 2, z + 2, c.trimDark);
  p.box(1, 2, 3, 2, 3, 10, body);
  p.box(1, 4, 6, 2, 4, 9, c.trimDark); // the seat
  p.box(1, 3, 10, 2, 6, 11, body);
  p.box(0, 7, 11, 3, 7, 11, c.chrome);
  p.set(1, 6, 12, c.lampAmber);
  return p;
}

/**
 * An Ottoman headstone: a slim marble slab, a man's crowned with his turban or fez carved in stone, a woman's
 * rounded with a carved spray of flowers. Faces +z.
 */
function headstone(c: IC2, seed: number): Prop {
  const p = new Prop(5, 14, 3);
  const man = seed % 3 !== 0, tall = 8 + (seed % 3);
  const stone = (x: number, y: number, z: number) => (y < 2 && hash3(x, y, z + seed) < 0.4 ? c.algae : hash3(x, y, z + seed) < 0.2 ? c.marbleGrey : c.marble);
  p.box(1, 0, 1, 3, tall, 1, stone);
  // the inscription in lines down the face
  for (let y = 3; y < tall - 1; y += 2) p.box(1, y, 2, 3, y, 2, (x) => (hash3(x, y, seed) < 0.6 ? c.limeDark : 0));
  if (man) {
    if (seed % 2) { p.ellipsoid(2, tall + 2, 1, 2.3, 1.7, 1.5, (x, y) => ((x + y) % 2 ? c.marble : c.limeLight)); }
    else { p.cylY(2, 1, 1.4, tall + 1, tall + 3, c.marble); p.set(2, tall + 4, 1, c.marbleGrey); }
  } else {
    p.box(2, tall + 1, 1, 2, tall + 2, 1, c.marble);
    p.box(1, tall - 3, 2, 3, tall - 1, 2, (x, y) => ((x + y) % 2 ? c.limeDark : 0)); // the carved flowers
  }
  return p;
}

/**
 * A street juice stand: pyramids of pomegranates and oranges on a white cart, the chrome lever press, glasses
 * of ruby juice and a striped sunshade. Faces +z, the seller behind it.
 */
function juiceStand(c: IC2, seed: number): Prop {
  const p = new Prop(14, 22, 9);
  p.box(1, 0, 1, 12, 6, 7, (x, y, z) => (y === 6 ? c.marble : y === 0 ? c.trimDark : z === 7 && y > 1 && y < 5 && x % 4 === 1 ? c.cartRed : c.white));
  for (const x of [1, 12]) for (const z of [1, 7]) p.box(x, 7, z, x, 15, z, c.chrome);
  p.box(0, 16, 0, 13, 16, 8, (x) => (x % 4 < 2 ? c.awnRed : c.awnWhite));
  p.box(1, 17, 1, 12, 17, 7, (x) => (x % 4 < 2 ? c.awnRed : c.awnWhite));
  // the fruit in stepped heaps, pomegranates on one side and oranges on the other
  for (let k = 0; k < 3; k++) {
    p.box(2 + k, 7 + k, 3 + k, 6 - k, 7 + k, 7 - k, (x, y, z) => (hash3(x, y, z + seed) < 0.15 ? c.leafLight : c.spiceRed));
    p.box(8 + k, 7 + k, 3 + k, 11 - k, 7 + k, 7 - k, (x, y, z) => (hash3(x, y, z + seed) < 0.15 ? c.leafLight : c.apricot2));
  }
  // the press and a row of glasses
  p.box(6, 7, 1, 7, 10, 2, c.chrome); p.box(6, 11, 1, 9, 11, 1, c.chrome);
  for (let x = 2; x <= 11; x += 2) p.set(x, 7, 1, c.tea);
  return p;
}

function catHouse(c: IC2): Prop {
  const p = new Prop(8, 7, 6);
  p.box(0, 0, 0, 5, 4, 5, c.woodBare);
  p.box(1, 1, 0, 4, 3, 4, 0);
  p.box(1, 1, 5, 4, 3, 5, c.woodBare);
  for (let i = 0; i < 4; i++) p.box(i, 5 + Math.min(i, 3 - i), 0, i, 5 + Math.min(i, 3 - i), 5, c.roofTile);
  p.box(6, 0, 1, 7, 0, 2, c.chrome);
  p.set(6, 0, 4, c.hullBlue);
  return p;
}

// ------------------------------------------------------------------------------------------- build

type Extra = import('./tokyo').Extra;
export type Ctx = { b: Builder; c: IC2; plan: Plan; inWin: (x: number, z: number) => boolean; keepers: Extra[] };

export function buildIstanbul(win?: Window): BuildResult {
  const b = new Builder(win);
  const g = b.grid;
  const c = istanbulColors(b);
  const plan = istanbulPlan();
  const [wx0, wz0, wx1, wz1] = win ?? [VX0, VZ0, VX0 + SX, VZ0 + SZ];
  const inWin = (x: number, z: number) => x >= wx0 && x < wx1 && z >= wz0 && z < wz1;
  const ctx: Ctx = { b, c, plan, inWin, keepers: [] };

  terrain(ctx, wx0, wz0, wx1, wz1);
  townEdge(ctx, wx0, wz0, wx1, wz1);
  yardWalls(ctx, wx0, wz0, wx1, wz1);
  const uses = assignUses(plan);
  for (const lt of plan.lots) building(ctx, lt, uses.get(lt.id));
  halls(ctx);
  yeniCami(ctx);
  suleymaniye(ctx);
  station(ctx);
  waterfront(ctx);
  bridge(ctx);
  square(ctx);
  teaGarden(ctx);
  tramLine(ctx);
  greenery(ctx);
  streetLife(ctx);
  washingLines(ctx);
  const stalls = [...foodStalls(ctx), ...b.stallAnchors];
  const groundY = (x: number, z: number) => (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
  const charms = NAZAR_SPOTS.map(([x, z, h]) => [x, groundY(x, z) + h, z] as [number, number, number]);
  for (const [x, y, z] of charms) b.place(nazar(c), x, y, z);
  const door = hiddenDoorway(ctx);

  const P = (x: number, z: number) => [x, z] as [number, number];
  const anchors: Anchors = {
    spawn: [18, 0, 36],
    stalls,
    hiddenDoor: door,
    interiorExit: [0, 0], interiorSpawn: [0, 0, 0], chef: [0, 0, 0], counterStand: [0, 0],
    manekis: charms,
    graph: { nodes: plan.nodes.map(([x, z]) => P(x, z)), edges: plan.edges.map(([i, j]) => [i, j] as [number, number]) },
    idlers: [
      { id: 'teyze', pos: [8, 0, 37.5] },
      { id: 'olta', pos: [-17, 0, 58] },
      { id: 'hamal', pos: [-30, 0, -19.5] },
      { id: 'imam', pos: [0, 0, 33] },
      { id: 'cayci', pos: [-126, 0, 18] },
      { id: 'halici', pos: [-126, 0, -61.2] },
      { id: 'kaptan', pos: [39.3, 0, -6] },
    ],
    benches: b.benches.filter(([x, z]) => !beyond(x, z)),
    stools: b.stools.filter(([x, z]) => !beyond(x, z)),
    cats: [...CATS, ...laneCats(plan)].filter(([x, , z]) => !beyond(x, z)),
    extras: ([...anglers(), ...teaGardenFolk(), ...bazaarShoppers(plan.lots), ...ctx.keepers] as Extra[]).filter((e) => e.indoor || !beyond(e.pos[0], e.pos[2])),
    emitters: b.emitters,
    // no fireflies over the Golden Horn's busy quays
    fireflies: [],
    vending: [],
    blockers: b.blockers,
    rooms: b.rooms,
    hotels: b.hotels,
    darumas: [],
    secret: null,
    occluders: b.occluders,
    wires: b.wires,
    shafts: b.shafts,
    warm: WARM_ZONES,
    halls: b.halls,
  };
  // a warm city at night: lamp light carries over the pale stone
  for (const l of b.lamps) { l.r *= 1.2; l.g *= 1.2; l.b *= 1.15; l.radius *= 1.1; }
  const interior = gizliMutfak(b, c, anchors);
  return {
    grid: g, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells,
    // the standing layer is looked for just above the ground: under a vault the roof is no floor, and a
    // building's columns start at its floor so nobody stands in its rooms or on its roof
    navTop: (x, z) => {
      if (outCell(x, z)) return 0; // past the town's edge: never walked
      const ci = col(x, z);
      if (plan.lot[ci]) return Math.min(g.sy - 8, plan.walk[ci] + 1);
      const k = plan.kind[ci];
      if (k === K.Covered) return plan.walk[ci] + 1;
      return Math.min(g.sy - 8, plan.walk[ci] + 3);
    },
    groundAt: (x, z) => {
      const ci = col(x, z);
      return plan.kind[ci] === K.Sea ? G : plan.walk[ci];
    },
  };
}

const CATS: [number, number, number][] = [
  [10, 0, 33], [-6, 0, 36.5], [21, 0, 20], [-30, 0, 26], [-12, 0, 0], [6, 0, -18], [12.5, 0, -60], [-48, 0, -27],
  [-80, 0, 5], [-40, 0, -86], [-120, 0, 17], [-64, 0, -104], [-96, 0, 31], [24, 0, -96],
  // Istanbul is a city of cats: on the quays by the fish boats, in the bazaar halls, on the mosque terraces
  [-100, 0, 39], [-40, 0, 39], [3, 0, 39.5], [26, 0, -30], [26, 0, -70], [-60, 0, 6], [-36, 0, -52], [-66, 0, -90],
  [-94, 0, -97], [-137, 0, 15], [-40, 0, -103], [-62, 0, -74], [-24, 0, 8], [-80, 0, 34], [-114, 0, -60], [-138, 0, -80], [-126, 0, -79],
];

/** More cats down the middle of the lanes and stairs, one every thirty metres or so, as the city is full of them. */
function laneCats(plan: Plan): [number, number, number][] {
  const r = rng(808);
  const out: [number, number, number][] = [];
  for (const s of plan.segs) {
    if (s.kind !== K.Lane && s.kind !== K.Stair) continue;
    const [ax, , az] = s.a, [bx, , bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 6 + r() * 20; t < len - 4; t += 26 + r() * 16) {
      const f = t / len;
      if (CATS.some(([x, , z]) => Math.hypot(x - (ax + (bx - ax) * f), z - (az + (bz - az) * f)) < 8)) continue;
      out.push([ax + (bx - ax) * f, 0, az + (bz - az) * f]);
    }
  }
  return out.slice(0, 24);
}

/** The three nazar charms: in the Spice Bazaar, on the bridge rail among the fishermen, on the hilltop terrace's wall. */
const NAZAR_SPOTS: [number, number, number][] = [[-36.5, 22.9, 1.2], [-15.2, 56, 1.4], [-146, 21.4, 1.1]];

// ------------------------------------------------------------------------------------------- uses

export type Use = { room?: RoomKind; hotel?: number; restaurant?: { id: string; foods: [FoodId, FoodId] } };

/** The second menu's restaurants on the streets: near (x, z), which room they furnish like, the cook's stall and dishes. */
const RESTAURANTS: [number, number, RoomKind, string, [FoodId, FoodId]][] = [
  [0, -70, 'kebap', 'iskenderci', ['iskender', 'sutlac']],
  [-30, -65, 'pide', 'lahmacuncu', ['lahmacun', 'salgam']],
  [0, -7, 'pide', 'karadenizli', ['karapide', 'hamsi']],
  [-24, -10, 'lokanta', 'esnaf', ['kurufasulye', 'mercimek']],
  [-43, -97, 'kebap', 'koftecisi', ['kofte', 'piyaz']],
  [-104, -20, 'muhallebi', 'muhallebici', ['tavukgogsu', 'kazandibi']],
  [-84, -66, 'kahve', 'kahvaltici', ['menemen', 'kaymak']],
  [-73, 22, 'balik', 'meyhane', ['meze', 'kalamar']],
];

/** Which buildings hold the hotels, restaurants and food rooms: decided from the plan alone. */
/** Whether a lot's front door opens past the town's edge (so nobody could walk in). */
function doorBeyond(l: LotPlan): boolean {
  const [ox, oz] = l.side === 'n' ? [0, -1] : l.side === 's' ? [0, 1] : l.side === 'w' ? [-1, 0] : [1, 0];
  const mx = l.side === 'n' || l.side === 's' ? (l.x0 + l.x1 + 1) / 2 : l.side === 'w' ? l.x0 : l.x1 + 1;
  const mz = l.side === 'e' || l.side === 'w' ? (l.z0 + l.z1 + 1) / 2 : l.side === 'n' ? l.z0 : l.z1 + 1;
  if (beyond((mx + ox * 2) * V, (mz + oz * 2) * V)) return true;
  // nor one whose back rooms reach past it (a hotel's lift, a kitchen)
  return [[l.x0, l.z0], [l.x1 + 1, l.z0], [l.x0, l.z1 + 1], [l.x1 + 1, l.z1 + 1]].some(([x, z]) => beyond(x * V, z * V));
}

function assignUses(plan: Plan): Map<number, Use> {
  const out = new Map<number, Use>();
  const hid = hiddenLot(plan)?.id;
  const fronted = plan.lots.filter((l) => l.door >= 0 && l.id !== hid && !doorBeyond(l));
  const big = (l: LotPlan, w: number, d: number) => {
    const ns = l.side === 'n' || l.side === 's';
    const W = ns ? l.x1 - l.x0 + 1 : l.z1 - l.z0 + 1, D = ns ? l.z1 - l.z0 + 1 : l.x1 - l.x0 + 1;
    return W >= w && D >= d;
  };
  // the hotels: big buildings low on the waterfront and the flat streets of Sirkeci and Hamidiye
  // (a room on floor f needs the walls to reach 12f + 10 layers above the ground floor)
  const need = (i: number) => 12 * Math.max(...ISTANBUL_HOTELS[i].rooms.map((r) => r.floor)) + 10;
  const hotelLots = fronted.filter((l) => l.use !== 'bazaar' && l.on !== K.Lane && l.on !== K.Stair && l.base <= layerOf(3.5) && big(l, 18, 22) && l.top - l.base >= 34)
    .sort((p, q) => (p.x0 + p.z0 * 0.7) - (q.x0 + q.z0 * 0.7));
  // twelve lots spread along the shore and the avenue, then the tallest of them go to the hotels with the highest rooms
  const step = hotelLots.length / ISTANBUL_HOTELS.length;
  const chosen = ISTANBUL_HOTELS.map((_h, i) => hotelLots[Math.floor(i * step)]).filter(Boolean).sort((p, q) => (q.top - q.base) - (p.top - p.base));
  const order = ISTANBUL_HOTELS.map((_h, i) => i).sort((p, q) => need(q) - need(p));
  order.forEach((hi, k) => { const l = chosen[k]; if (l && l.top - l.base >= need(hi)) out.set(l.id, { hotel: hi }); });
  // the two sit-down places run by passport vendors
  const free = fronted.filter((l) => !out.has(l.id) && l.use !== 'bazaar' && big(l, 18, 22));
  const near = (x: number, z: number) => free.filter((l) => !out.has(l.id)).sort((p, q) => Math.hypot((p.x0 + p.x1) / 2 * V - x, (p.z0 + p.z1) / 2 * V - z) - Math.hypot((q.x0 + q.x1) / 2 * V - x, (q.z0 + q.z1) / 2 * V - z))[0];
  const bak = near(-40, -22); if (bak) out.set(bak.id, { room: 'kebap', restaurant: { id: 'baklavaci', foods: ['baklava', 'kunefe'] } });
  const dur = near(6, -24); if (dur) out.set(dur.id, { room: 'kebap', restaurant: { id: 'durumcu', foods: ['doner', 'ayran'] } });
  // the second menu's sit-down places, spread over the town (see data/istanbulMenu.ts)
  for (const [x, z, room, id, foods] of RESTAURANTS) { const l = near(x, z); if (l) out.set(l.id, { room, restaurant: { id, foods } }); }
  // food rooms on the streets, spread round the town
  const street: RoomKind[] = ['kahve', 'lokanta', 'borek', 'pide', 'muhallebi', 'cay', 'kebap', 'kahve', 'lokanta', 'borek', 'pide', 'muhallebi', 'cay', 'kebap', 'firin', 'balik'];
  const spots: [number, number][] = [[-60, -50], [2, -60], [-20, -17], [-70, -36], [-90, -46], [-108, 2], [14, -86], [-36, 36], [-4, -84], [-30, -50], [-48, -88], [20, -18], [-60, 2], [6, -102], [-82, -16], [-82, 37]];
  street.forEach((kind, i) => { const l = near(spots[i][0], spots[i][1]); if (l) out.set(l.id, { room: kind }); });
  // the bazaars' food shops: spices, Turkish delight, nuts; a coffee house and a lokanta in the Grand Bazaar
  const bz = plan.lots.filter((l) => l.use === 'bazaar' && big(l, 13, 15));
  const inSpice = bz.filter((l) => l.x0 * V > -70 && l.z0 * V > -20);
  const inGrand = bz.filter((l) => l.x0 * V < -100);
  const spiceKinds: RoomKind[] = ['baharat', 'lokum', 'baharat', 'lokum', 'baharat'];
  spiceKinds.forEach((k, i) => { const l = inSpice[Math.floor((i + 0.5) * inSpice.length / spiceKinds.length)]; if (l) out.set(l.id, { room: k }); });
  const grandKinds: RoomKind[] = ['kahve', 'lokanta'];
  grandKinds.forEach((k, i) => { const l = inGrand[Math.floor((i + 0.3) * inGrand.length / 2.4)]; if (l && !out.has(l.id)) out.set(l.id, { room: k }); });
  // the Grand Bazaar's coffee house and lokanta run by passport cooks, and more of its sweet, tea and pudding shops
  const grandMore: [number, Use][] = [
    [0.08, { room: 'kahve', restaurant: { id: 'kahveci', foods: ['kahve', 'lokum'] } }],
    [0.9, { room: 'lokanta', restaurant: { id: 'kalpakcilar', foods: ['karniyarik', 'cacik'] } }],
    [0.22, { room: 'lokum' }], [0.5, { room: 'cay' }], [0.66, { room: 'muhallebi' }], [0.78, { room: 'borek' }],
  ];
  for (const [t, u] of grandMore) {
    // the nearest free hall shop to that share of the way through the bazaar
    const i0 = Math.floor(t * inGrand.length);
    for (let d = 0; d < inGrand.length; d++) {
      const l = inGrand[(i0 + (d % 2 ? -1 : 1) * ((d + 1) >> 1) + inGrand.length) % inGrand.length];
      if (l && !out.has(l.id)) { out.set(l.id, u); break; }
    }
  }
  // two more in the Spice Bazaar: a tea house and a börek counter for the shoppers
  for (const [t, k] of [[0.12, 'cay'], [0.88, 'borek']] as [number, RoomKind][]) {
    const i0 = Math.floor(t * inSpice.length);
    for (let d = 0; d < inSpice.length; d++) {
      const l = inSpice[(i0 + (d % 2 ? -1 : 1) * ((d + 1) >> 1) + inSpice.length) % inSpice.length];
      if (l && !out.has(l.id)) { out.set(l.id, { room: k }); break; }
    }
  }
  return out;
}

// ------------------------------------------------------------------------------------------- terrain

/** Ottoman masonry: courses of cut stone banded with brick (the almaşık wall of the hans and the mosques' outbuildings). */
export function almasik(c: IC2, x: number, y: number, z: number): number {
  const band = ((y >> 1) % 5);
  if (band === 4) return (x + z) % 3 === 0 ? c.mortar : c.brick;
  const off = (y >> 1) & 1 ? 2 : 0;
  if ((x + z + off) % 6 === 0 && (y & 1) === 0) return c.mortar;
  return hash3(x >> 2, y >> 1, z >> 2) < 0.5 ? c.kufeki : c.kufekiDark;
}

/** Retaining and quay walls of big granite blocks. */
function blockWall(c: IC2, x: number, y: number, z: number): number {
  const course = y >> 1, off = course & 1 ? 2 : 0;
  if (((x + off) % 5 === 0 || (z + off) % 5 === 0) && (y & 1) === 0) return c.mortar;
  return hash3((x + off) / 5 | 0, course, (z + off) / 5 | 0) < 0.5 ? c.granite : c.graniteB;
}

const inside = (r: Rect, x: number, z: number) => x >= r[0] && x < r[2] && z >= r[1] && z < r[3];

/**
 * Where boats tie up along the quay, so its rail is left out and bollards stand at the edge instead: the fish
 * boats' basin by the bridge, the ferry piers on the Bosphorus and the Horn, and the rowing boats in the little bay.
 */
const MOORINGS: Rect[] = [[-12, 42, 11.2, 45], [27, -50, 33, -42], [-56, 42, -48, 45], [33, 12.8, 35, 14.4], [33, 23.6, 35.5, 25.4]];
const moored = (x: number, z: number) => MOORINGS.some((r) => inside(r, x, z));

/** The solid floor of a column: the deck, except under a landing stage riding on the water (the sea bed). */
function floorOf(plan: Plan, x: number, z: number): number {
  const ci = col(x, z);
  return plan.kind[ci] === K.Pontoon && shoreDist((x + 0.5) * V, (z + 0.5) * V) < 0 ? seaBed((x + 0.5) * V, (z + 0.5) * V) : plan.walk[ci];
}

/** Quay paving: big flags of grey limestone and granite in running bond, each its own tone. */
function quayFlag(c: IC2, x: number, z: number): number {
  const row = Math.floor(z / 4), fx = Math.floor((x + (row & 1) * 4) / 8), t = hash3(fx, 23, row);
  return t < 0.45 ? c.slab : t < 0.8 ? c.slabB : t < 0.93 ? c.kerb : c.granite;
}

/** The front edge of a landing step: the next column down the stairs is lower. */
function isNosing(plan: Plan, x: number, z: number): boolean {
  const s = landingStep((x + 0.5) * V, (z + 0.5) * V);
  if (!s) return false;
  const [dx, dz] = s.dir === 'n' ? [0, 1] : [1, 0];
  return inMap(x + dx, z + dz) && plan.walk[col(x + dx, z + dz)] < plan.walk[col(x, z)];
}

function terrain(ctx: Ctx, wx0: number, wz0: number, wx1: number, wz1: number): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  for (let bz = wz0; bz < wz1; bz += 8)
    for (let bx = wx0; bx < wx1; bx += 8) {
      let lo = 255;
      for (let z = bz; z < bz + 8; z++) for (let x = bx; x < bx + 8; x++) lo = Math.min(lo, floorOf(plan, x, z));
      const full = (lo - 4) & ~7;
      if (full > 0) g.box(bx, 0, bz, bx + 7, full - 1, bz + 7, c.granite);
    }
  for (let z = wz0; z < wz1; z++)
    for (let x = wx0; x < wx1; x++) {
      const ci = col(x, z), w = plan.walk[ci], kd = plan.kind[ci];
      const y0 = Math.max(0, ((w - 4) & ~7) - 8);
      // a strip of ground left between a bazaar hall and its shops is the hall's own stone floor, never a verge
      let hallSide = false;
      if (kd === K.Ground) for (let k = 1; k <= 12 && !hallSide; k++) for (const [dx, dz] of [[k, 0], [-k, 0], [0, k], [0, -k]]) {
        if (inMap(x + dx, z + dz) && plan.kind[col(x + dx, z + dz)] === K.Covered && Math.abs(plan.walk[col(x + dx, z + dz)] - w) <= 2) { hallSide = true; break; }
      }
      const floor = floorOf(plan, x, z);
      if (floor !== w) {
        // a landing stage riding on the water: the sea bed under it, then a steel hull with a black rubber
        // fender round its top and a deck of planks; a gangway is a single steel beam under its planks
        g.box(x, Math.max(0, ((floor - 4) & ~7) - 8), z, x, floor - 1, z, (xx, y, zz) => (y === floor - 1 && hash3(xx, y, zz) < 0.5 ? c.seaBedB : c.seaBed));
        const deck = pontoonAt((x + 0.5) * V, (z + 0.5) * V)?.deck;
        g.box(x, deck ? layerOf(-0.85) : w - 2, z, x, w - 1, z, (xx, y, zz) => {
          if (y === w - 1) return pm(deck ? xx : zz, 2) === 0 ? c.deck : c.woodBare;
          if (!deck) return c.iron;
          return y === w - 2 ? c.funnelBlack : y >= layerOf(-0.6) ? c.hullDark : c.algae;
        });
        continue;
      }
      g.box(x, y0, z, x, w - 1, z, (xx, y, zz) => {
        const d = w - 1 - y;
        switch (kd) {
          case K.Sea: return d === 0 ? (hash3(xx, y, zz) < 0.5 ? c.seaBed : c.seaBedB) : c.seaBed;
          case K.Quay: case K.Pier: case K.Pontoon:
            if (d === 0) return quayFlag(c, xx, zz);
            return y < G - 1 ? (y < G - 3 ? c.algae : c.wet) : blockWall(c, xx, y, zz);
          case K.Landing:
            // granite treads, a pale nosing on each, green and slick below the tide line
            if (y < G - 1) return y < G - 3 || d > 0 ? c.algae : c.wet;
            if (d === 0) return isNosing(plan, xx, zz) ? c.quayEdge : hash3(xx, 21, zz) < 0.5 ? c.granite : c.graniteB;
            return c.granite;
          case K.Bridge: return d === 0 ? c.asphalt : blockWall(c, xx, y, zz);
          case K.Square: case K.Court:
            if (d === 0) return (xx % 12 === 0 || zz % 12 === 0) ? c.marbleGrey : hash3(xx >> 1, 2, zz >> 1) < 0.5 ? c.slab : c.slabB;
            return blockWall(c, xx, y, zz);
          case K.Terrace: return d === 0 ? (hash3(xx, 3, zz) < 0.7 ? c.gravel : c.slab) : blockWall(c, xx, y, zz);
          case K.Steps: return d === 0 ? c.marble : d === 1 ? c.marbleGrey : c.limeDark;
          case K.Street: case K.Tram:
            if (d === 0) return (xx + (zz >> 1)) % 3 === 0 ? c.settB : hash3(xx, 4, zz) < 0.12 ? c.settLight : c.sett;
            return blockWall(c, xx, y, zz);
          case K.Covered: return d === 0 ? hallFloor(c, plan.segs, xx, zz) : c.granite;
          case K.Lane: return d === 0 ? (hash3(xx >> 1, 6, zz >> 1) < 0.5 ? c.sett : c.settB) : blockWall(c, xx, y, zz);
          case K.Stair: return d === 0 ? (hash3(xx, 5, zz) < 0.2 ? c.limeDark : c.lime) : d === 1 ? c.limeDark : blockWall(c, xx, y, zz);
          case K.Lot: case K.Mosque: return d === 0 ? c.slab : blockWall(c, xx, y, zz);
          case K.Park: return d === 0 ? (hash3(xx, 9, zz) < 0.6 ? c.grass : c.clover) : d === 1 ? c.soil : blockWall(c, xx, y, zz);
          default: {
            // the ground between the houses: cobbled yards worn to earth, weeds in the joints, and here and there a
            // walled kitchen garden of grass and clover (in 2 m patches, so it reads as yards and gardens, not lawn)
            if (hallSide) return d === 0 ? hallFloor(c, plan.segs, xx, zz) : blockWall(c, xx, y, zz);
            // the Grand Bazaar's plateau is all stone: the courtyards of its hans between the halls
            if (xx * V > GRAND[0] && xx * V < GRAND[2] && zz * V > GRAND[1] && zz * V < GRAND[3]) {
              if (d === 0) return (xx % 8 === 0 || zz % 8 === 0) ? c.marbleGrey : hash3(xx >> 1, 7, zz >> 1) < 0.5 ? c.slab : c.sett;
              return blockWall(c, xx, y, zz);
            }
            // along the water the quays are stone to the very edge, never a grass verge
            if (w <= layerOf(QUAY_Y) + 2 && shoreDist(xx * V, zz * V) < 6) {
              if (d === 0) return (xx + zz) % 8 === 0 ? c.slabB : c.slab;
              return blockWall(c, xx, y, zz);
            }
            if (d === 0) {
              const n = hash3(xx, 9, zz);
              if (hash3(xx >> 3, 11, zz >> 3) < 0.55) return n < 0.42 ? c.sett : n < 0.7 ? c.settB : n < 0.86 ? c.soil : n < 0.95 ? c.gravel : c.clover;
              return n < 0.5 ? c.grass : n < 0.75 ? c.clover : n < 0.92 ? c.soil : c.grassDry;
            }
            if (d === 1) return c.soil;
            return blockWall(c, xx, y, zz);
          }
        }
      });
      // a parapet where the ground falls away beside a path, a railing along the water
      if (isPath(kd) && kd !== K.Covered) {
        let drop = false, sea = false;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, nz = z + dz;
          if (!inMap(nx, nz)) continue;
          const nc = col(nx, nz), nk = plan.kind[nc];
          if (nk === K.Sea) { sea = true; continue; }
          if (isPath(nk) || nk === K.Lot || nk === K.Mosque) continue;
          if (plan.walk[nc] < w - 3) drop = true;
        }
        const mx = x * V, mz = z * V;
        const step = kd === K.Landing || (kd === K.Quay && landingStep(mx + V / 2, mz + V / 2)?.cheek);
        if (step) {
          // the stairs into the water: open to it, but the last step is under the tide and nobody stands there,
          // and the cheek walls either side are built by the waterfront
          if (sea && w < G) b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        } else if (sea && kd !== K.Quay) {
          // piers, the bridge and the landing stages: an iron railing along the edge, left open on a landing
          // stage's boarding side, where the boats lie alongside and the crew hand the passengers across
          const open = kd === K.Pontoon && PONTOONS.some((p) => inside(p.board, mx + V / 2, mz + V / 2));
          if (!open) g.box(x, w, z, x, w + 3, z, (_x, y) => (y === w + 3 ? c.iron : (x + z) % 4 === 0 ? c.iron : 0));
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        } else if (sea) {
          // the quay's edge: a kerb of white stone and a low iron rail, broken where the boats tie up
          g.set(x, w, z, c.quayEdge);
          if (!moored(mx, mz) && (x + z) % 2 === 0) g.box(x, w + 1, z, x, w + 3, z, (_x, y) => (y === w + 3 || (x + z) % 8 === 0 ? c.iron : 0));
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        } else if (drop) {
          g.box(x, w, z, x, w + 3, z, (xx, y, zz) => (y === w + 3 ? c.kerb : blockWall(c, xx, y, zz)));
          b.block(mx, mz, mx + V * 0.99, mz + V * 0.99);
        }
      }
    }
}

/**
 * The town's edge, where the walkable town meets the band past it: never an invisible wall. A lane runs up to a
 * garden gate of iron bars, the avenue and the quays to the roadworks' hoardings, the hilltop terrace to its
 * balustrade, open ground to a garden wall with its tiled coping; behind them the gardens are planted with trees,
 * and on the bridge the deck closes at the gates between the bascule towers.
 */
function townEdge(ctx: Ctx, wx0: number, wz0: number, wx1: number, wz1: number): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  for (let z = wz0; z < wz1; z++)
    for (let x = wx0; x < wx1; x++) {
      if (!outCell(x, z)) continue;
      const ci = col(x, z), k = plan.kind[ci];
      if (k === K.Sea || k === K.Lot || k === K.Mosque) continue;
      // the walkable neighbour this cell closes off
      let nk = -1, nw = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const ax = x + dx, az = z + dz;
        if (!inMap(ax, az) || outCell(ax, az)) continue;
        const ak = plan.kind[col(ax, az)];
        if (ak === K.Sea || ak === K.Lot || ak === K.Mosque) continue;
        if (nk < 0 || isPath(ak)) { nk = ak; nw = plan.walk[col(ax, az)]; }
      }
      if (nk < 0) continue;
      const w = plan.walk[ci], base = Math.min(w, nw), u = x + z;
      if (nk === K.Bridge) {
        // the bascule gates: iron bars between the towers, a red and white bar across at waist height
        g.box(x, nw, z, x, nw + 9, z, (_x, y) => (y === nw + 9 ? c.iron : y === nw + 4 ? (pm(x, 4) < 2 ? c.flagRed : c.white) : pm(x, 2) === 0 ? c.iron : 0));
      } else if (nk === K.Quay || nk === K.Tram || nk === K.Square || nk === K.Street || nk === K.Covered) {
        // the roadworks' hoarding: panels of blue and white on iron posts, the city's crest suggested on each
        g.box(x, base, z, x, nw + 9, z, (_x, y) => {
          const r = y - nw;
          if (pm(u, 12) === 0) return c.iron;
          if (r < 0) return c.granite;
          if (r === 9 || r === 0) return c.white;
          if (r >= 3 && r <= 6 && pm(u, 12) >= 4 && pm(u, 12) <= 7) return r === 3 || r === 6 ? c.signBlue : c.white;
          return r > 6 ? c.signBlue : c.awnBlue;
        });
      } else if (nk === K.Terrace) {
        g.box(x, base, z, x, nw + 3, z, (_x, y) => (y === nw + 3 ? c.marble : y < nw || pm(u, 3) === 0 ? c.lime : 0));
      } else if (nk === K.Lane || nk === K.Stair || nk === K.Steps) {
        // a garden gate of iron bars under a stone lintel, the garden behind it showing through
        g.box(x, base, z, x, nw + 10, z, (_x, y) => (y < nw ? c.limeDark : y >= nw + 9 ? (y === nw + 10 ? c.roofTile : c.limeLight) : pm(u, 2) === 0 || y === nw + 4 ? c.ironGreen : 0));
      } else {
        // a garden wall of stone and brick, its coping of tiles
        const top = Math.max(nw, w) + 8;
        g.box(x, base, z, x, top, z, (xx, y, zz) => (y === top ? c.roofTile : y === top - 1 ? c.limeLight : almasik(c, xx, y, zz)));
      }
    }
  // the gardens past the edge: trees over the walls, so the town goes on green and lived-in
  const r = rng(4919);
  for (let z = Math.max(wz0, VZ0 + 2); z < Math.min(wz1, VZ0 + SZ - 2); z += 10)
    for (let x = Math.max(wx0, VX0 + 2); x < Math.min(wx1, VX0 + SX - 2); x += 10) {
      const jx = x + Math.floor(hash3(x, 13, z) * 8), jz = z + Math.floor(hash3(x, 14, z) * 8);
      if (!inMap(jx, jz) || !outCell(jx, jz)) continue;
      const ci = col(jx, jz);
      if (plan.kind[ci] !== K.Ground || hash3(jx, 15, jz) < 0.35) continue;
      let clear = true;
      for (const [dx, dz] of [[4, 0], [-4, 0], [0, 4], [0, -4]]) if (!inMap(jx + dx, jz + dz) || plan.lot[col(jx + dx, jz + dz)] || !outCell(jx + dx, jz + dz)) clear = false;
      if (!clear) continue;
      const y = (plan.walk[ci] - G) * V, mx = (jx + 0.5) * V, mz = (jz + 0.5) * V, kind = hash3(jx, 16, jz), seed = Math.floor(r() * 1e5);
      if (kind < 0.3) b.place(cypress(c, seed, 26 + Math.floor(kind * 30)), mx, y, mz);
      else if (kind < 0.55) b.place(figTree(c, seed), mx, y, mz);
      else if (kind < 0.75) b.place(judasTree(c, seed), mx, y, mz);
      else b.place(planeTree(c, seed, false), mx, y, mz);
    }
  // the Galata Bridge's bascule towers either side of the gates: stone, a lead roof, windows on the water
  const tz = Math.round(BRIDGE_GATE_Z / V) + 1, Y = layerOf(1.5);
  if (g.touches(Math.round(-24 / V), tz, Math.round(-12 / V), tz + 10))
    for (const tx of [Math.round(-23 / V), Math.round(-14.5 / V)]) {
      g.box(tx, Y, tz, tx + 5, Y + 19, tz + 7, (xx, y, zz) => {
        const row = y - Y, edge = xx === tx || xx === tx + 5 || zz === tz || zz === tz + 7;
        if (!edge) return row === 19 ? c.lead : 0;
        if (row === 19) return c.lead;
        if (row === 18 || row === 0) return c.limeLight;
        if (row >= 11 && row <= 15 && (zz === tz + 3 || zz === tz + 4 || xx === tx + 2 || xx === tx + 3)) return row === 11 ? c.marble : c.glass;
        return row % 4 === 0 ? c.limeLight : c.lime;
      });
      for (let k = 0; k < 4; k++) g.box(tx + k, Y + 20 + k, tz + k, tx + 5 - k, Y + 20 + k, tz + 7 - k, c.lead);
      g.set(tx + 2, Y + 24, tz + 3, c.gold);
    }
}

/**
 * The yards and gardens behind the houses are walled off from the street, so a street reads as one frontage from
 * house to house: whitewashed or stone walls with a tiled coping, a gateway in them every few metres (a lintel
 * overhead, low enough to walk under), the gardens' trees showing over the top.
 */
function yardWalls(ctx: Ctx, wx0: number, wz0: number, wx1: number, wz1: number): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const STREETS = new Set<number>([K.Street, K.Lane, K.Stair, K.Tram, K.Quay, K.Square]);
  for (let z = wz0; z < wz1; z++)
    for (let x = wx0; x < wx1; x++) {
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Ground || outCell(x, z)) continue;
      if (shoreDist(x * V, z * V) < 6) continue; // the quays stay open to the water
      let along = -1, pw = 0;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ax = x + dx, az = z + dz;
        if (!inMap(ax, az)) continue;
        const ak = plan.kind[col(ax, az)];
        if (ak === K.Mosque || ak === K.Court || ak === K.Park || ak === K.Terrace) { along = -1; break; }
        if (STREETS.has(ak)) { along = dx !== 0 ? z : x; pw = plan.walk[col(ax, az)]; }
      }
      if (along < 0) continue;
      const w = plan.walk[ci], base = Math.min(w, pw) , top = Math.max(w, pw) + 8;
      const gate = pm(along, 26) < 4;
      const white = hash3(x >> 5, 21, z >> 5) < 0.55;
      g.box(x, base, z, x, top, z, (xx, y, zz) => {
        if (gate && y >= Math.max(w, pw) && y < top - 1) return 0; // the gateway, a lintel over it
        if (y === top) return c.roofTile;
        if (y === top - 1) return gate ? c.woodDark : white ? c.trim : c.limeLight;
        return white ? (y < base + 2 ? c.stone : c.white) : almasik(c, xx, y, zz);
      });
    }
}

// ------------------------------------------------------------------------------------------- buildings

type Keys<K extends string> = Record<K, number>;
const PLASTER = (c: Keys<'cream' | 'ochre' | 'apricot' | 'rose' | 'salmon' | 'mint' | 'powder' | 'lilac' | 'stone' | 'grey' | 'white' | 'yellow' | 'terraPlaster' | 'sage' | 'sky' | 'blush' | 'sand' | 'pistachioP' | 'deepOchre' | 'warmGrey' | 'oxblood' | 'tealP'>) => [c.cream, c.ochre, c.apricot, c.rose, c.salmon, c.mint, c.powder, c.lilac, c.stone, c.grey, c.white, c.yellow,
  c.terraPlaster, c.sage, c.sky, c.blush, c.sand, c.pistachioP, c.deepOchre, c.warmGrey, c.oxblood, c.tealP];
/** The tones a ground floor is painted in, under a plaster block of another colour. */
const GROUND_WALLS = (c: Keys<'limeDark' | 'stone' | 'warmGrey' | 'oxblood' | 'sand' | 'grey' | 'terraPlaster'>) => [c.limeDark, c.stone, c.warmGrey, c.oxblood, c.sand, c.grey, c.terraPlaster];
const WOOD = (c: IC2) => [c.woodRed, c.woodOchre, c.woodBlue, c.woodGreen, c.woodGrey, c.woodCream, c.woodBare, c.woodRed, c.woodTeal, c.woodYellow, c.woodPink, c.woodGrey];
/** Painted trims: window frames, string courses, cornices. Light ones on dark walls, dark ones on pale walls. */
const TRIM_LIGHT = (c: IC2) => [c.cornice, c.trim, c.limeLight, c.paintCream, c.stone];
const TRIM_DARK = (c: IC2) => [c.trimGreen, c.trimOx, c.trimBlue, c.trimOchre, c.warmGrey];

type WinKind = 'shutter' | 'arch' | 'plain' | 'french' | 'segment' | 'pair';
/**
 * How one building is finished, so a street reads as many builders over two centuries rather than one: the wall
 * (plaster in its colour, bare brick laced with stone, almaşık bands, painted timber), the ground floor (the same,
 * rusticated stone or a second colour), the window type and rhythm, trims, string courses, quoins, pilasters and
 * the cornice, and now and then (rarely) a panel of İznik tiles.
 */
interface Look {
  mode: 'plaster' | 'brick' | 'banded' | 'wood' | 'han';
  ground: 'same' | 'rustic' | 'tone';
  groundWall: number;
  win: WinKind;
  bay: number;
  quoins: boolean; courses: boolean; pilasters: boolean;
  cornice: 0 | 1 | 2;
  /** İznik motif for one panel on the front, or -1 (most buildings). */
  tiles: number;
  /** Share of shuttered windows with their shutters closed. */
  closed: number;
  board: boolean;
  kafes: boolean;
  doorC: number; fan: boolean;
}

function lookOf(c: IC2, lt: LotPlan, wooden: boolean, han: boolean): Look {
  const r = rng(lt.seed * 7 + 13);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const m = r();
  const brick = lt.use === 'house' ? 0.1 : 0.16;
  const mode = han ? 'han' : wooden ? 'wood' : m < brick ? 'brick' : m < brick + 0.06 ? 'banded' : 'plaster';
  const g = r();
  const kinds: WinKind[] = mode === 'brick' ? ['segment', 'segment', 'arch', 'plain', 'pair'] : ['shutter', 'shutter', 'arch', 'plain', 'french', 'segment', 'pair', 'plain'];
  const t = r();
  return {
    mode,
    ground: mode === 'plaster' ? (g < 0.24 ? 'rustic' : g < 0.42 ? 'tone' : 'same') : mode === 'brick' && g < 0.4 ? 'rustic' : 'same',
    groundWall: pick(GROUND_WALLS(c)),
    win: pick(kinds),
    bay: 5 + Math.floor(r() * 4),
    quoins: mode !== 'wood' && r() < 0.35,
    courses: mode !== 'banded' && r() < 0.55,
    pilasters: mode === 'plaster' && r() < 0.22,
    cornice: mode === 'wood' ? 0 : (Math.floor(r() * 3) as 0 | 1 | 2),
    tiles: mode !== 'wood' && t < 0.07 ? Math.floor(r() * 5) : -1,
    closed: r() * 0.4,
    board: mode === 'wood' && r() < 0.45,
    kafes: mode === 'wood' && r() < 0.4,
    doorC: pick([c.door, c.doorGreen, c.doorBlue, c.trimOx, c.woodBare, c.trimGreen, c.door]),
    fan: r() < 0.35,
  };
}

/** Rusticated stone: courses of dressed blocks with sunk joints, for the ground floor of a grander block. */
function rustic(c: IC2, x: number, y: number, z: number, base: number): number {
  const k = y - base - 2, course = Math.floor(k / 3);
  if (pm(k, 3) === 2) return c.limeDark;
  if (pm(x + z + (course & 1) * 3, 6) === 0) return c.limeDark;
  return hash3(x >> 2, course, z >> 2) < 0.5 ? c.rusticA : c.rusticB;
}

/**
 * A panel of İznik tiles, row 0 at the bottom: a few motifs, used sparingly (a building in fifteen or so),
 * so they read as a treasure on a street rather than a pattern stamped on every front.
 */
function izTile(c: IC2, m: number, a: number, row: number): number {
  switch (m) {
    case 0: return row === 0 || row === 3 ? c.cobalt : pm(a, 4) === 1 ? (row === 2 ? c.iznikRed : c.iznikGreen) : c.iznikWhite; // tulips on white
    case 1: return pm(a + row, 3) === 0 ? c.iznikBlue : pm(a + row, 3) === 1 ? c.iznikTeal : c.iznikWhite; // the saz leaf, running
    case 2: return row === 0 || row === 3 ? c.iznikRed : pm(a, 3) === 1 && row === 2 ? c.iznikRed : pm(a, 3) !== 1 && row === 1 ? c.cobalt : c.iznikWhite; // çintamani
    case 3: return row === 0 || row === 3 ? c.cobalt : c.turquoise; // a plain turquoise band in a cobalt frame
    default: return pm(a, 4) === 1 || pm(row, 3) === 1 ? c.iznikTeal : c.iznikWhite; // the old cross, kept for one front in many
  }
}

/** A shop's name over its front, in one of several hands: a painted band, a framed board, letters on the wall, or lit. */
function signBoard(c: IC2, g: SparseGrid, f: Frame, a0: number, a1: number, y: number, seed: number): void {
  const style = Math.floor(hash3(seed, 2, 5) * 4);
  const ground = [c.signRed, c.signBlue, c.signGreen, c.sign, c.woodDark, c.trimOx, c.trimGreen, c.paintGold][Math.floor(hash3(seed, 1, 1) * 8)];
  const ink = ground === c.sign || ground === c.paintGold ? c.trimDark : hash3(seed, 4, 4) < 0.3 ? c.paintGold : c.white;
  const letter = (a: number, yy: number) => (a + yy) % 3 === 0 && hash3(a, yy, seed) < 0.7;
  if (style === 0) f.box(g, a0, y, -1, a1, y + 1, -1, (a, yy) => (letter(a, yy) && a > a0 + 1 && a < a1 - 1 ? ink : ground));
  else if (style === 1) {
    // a framed board in the middle of the front
    const w = Math.max(4, Math.floor((a1 - a0) * 0.6)), b0 = Math.floor((a0 + a1 - w) / 2), b1 = b0 + w;
    f.box(g, b0 - 1, y - 1, -1, b1 + 1, y + 2, -1, (a, yy) => (a === b0 - 1 || a === b1 + 1 || yy === y - 1 || yy === y + 2 ? c.gilt : letter(a, yy) ? ink : ground));
  } else if (style === 2) {
    // the name painted straight on the wall
    const col = hash3(seed, 6, 6) < 0.5 ? c.trimDark : c.signRed;
    f.box(g, a0 + 2, y, 0, a1 - 2, y + 1, 0, (a, yy) => (letter(a, yy) ? col : g.get(...xzy(f, a, yy, 0))));
  } else {
    // a dark board with lit letters
    const lit = [c.lampAmber, c.lampRed, c.lampBlue][Math.floor(hash3(seed, 7, 7) * 3)];
    f.box(g, a0 + 1, y, -1, a1 - 1, y + 1, -1, (a, yy) => (letter(a, yy) ? lit : c.trimDark));
  }
}
const xzy = (f: Frame, a: number, y: number, d: number): [number, number, number] => { const [x, z] = f.xz(a, d); return [x, y, z]; };

function building(ctx: Ctx, lt: LotPlan, use: Use | undefined): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { x0, z0, x1, z1, base, top } = lt;
  const bazaar = lt.use === 'bazaar';
  b.occlude(x0, z0, x1, z1, (top - G) * V + (bazaar ? 1.5 : 3.5), (base - G) * V + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = (base - G) * V;
  const f = new Frame(lt);
  const touched = g.touches(x0 - 4, z0 - 4, x1 + 4, z1 + 4);
  const r = rng(lt.seed);
  const wooden = lt.use === 'house' && (lt.on === K.Lane || lt.on === K.Stair || lt.on === K.Ground) && r() < 0.75;
  const han = lt.use === 'han' || lt.use === 'bazaar' || (lt.use === 'shop' && r() < 0.18);
  const lk = lookOf(c, lt, wooden, han);
  const wallPick = r(); // (drawn as before, so the rest of the lot's choices stay where they were)
  const wall = han ? c.kufeki : wooden ? WOOD(c)[Math.floor(hash3(lt.seed, 8, 1) * 12)] : lk.mode === 'brick' ? c.brick : lk.mode === 'banded' ? c.kufeki : PLASTER(c)[Math.floor(wallPick * 22)];
  const shutter = [c.shutter, c.shutterB, c.shutterC, c.trimOx, c.trimBlue, c.shutter][Math.floor(r() * 6)];
  const dark = wall === c.oxblood || wall === c.terraPlaster || wall === c.brick || wall === c.deepOchre || wall === c.tealP;
  const trim = wooden ? [c.woodCream, c.woodCream, c.trim, c.eave][Math.floor(hash3(lt.seed, 9, 2) * 4)] : han ? c.limeLight
    : lk.mode !== 'plaster' ? c.limeLight : (dark ? TRIM_LIGHT(c) : hash3(lt.seed, 9, 3) < 0.6 ? TRIM_LIGHT(c) : TRIM_DARK(c))[Math.floor(hash3(lt.seed, 9, 4) * 5)];
  const hasRoom = !!use?.room || use?.hotel !== undefined;
  const shopFront = lt.use !== 'house' && lt.door === base;
  if (touched) {
    // the shell: a stone plinth, then the walls; the ground floor is a hollow room with a real floor
    g.box(x0, base - 1, z0, x1, top - 1, z1, (xx, y, zz) => {
      if (han) return almasik(c, xx, y, zz);
      if (y < base + 2) return wooden ? blockWall(c, xx, y, zz) : c.limeDark;
      if (wooden && y < base + 12) return blockWall(c, xx, y, zz); // a stone ground floor under the timber
      const ex = Math.min(xx - x0, x1 - xx), ez = Math.min(zz - z0, z1 - zz), k = y - base;
      if (wooden) {
        // painted boards, laid level or upright with battens, corner posts and a girt at each floor in the trim
        if (ex === 0 && ez === 0) return trim;
        if (pm(k, 12) === 11) return trim;
        if (lk.board) return pm(ex === 0 ? zz : xx, 4) === 0 ? c.eave : wall;
        return (y & 1) === 0 && hash3(xx, y >> 1, zz) < 0.04 ? c.woodBare : wall;
      }
      if (y >= top - 1) return lk.cornice ? trim : wall;
      if (lk.courses && pm(k, 12) === 11) return trim;
      if (lk.quoins && ((ex === 0 && ez < ((k >> 1) & 1 ? 2 : 3)) || (ez === 0 && ex < ((k >> 1) & 1 ? 2 : 3)))) return lk.mode === 'brick' ? c.limeLight : c.rusticA;
      if (k < 12 && lk.ground === 'rustic') return rustic(c, xx, y, zz, base);
      if (k < 12 && lk.ground === 'tone') return lk.groundWall;
      if (lk.mode === 'brick') return pm(k, 9) === 8 ? c.limeLight : hash3(xx, y, zz) < 0.12 ? c.brickDark : c.brick;
      if (lk.mode === 'banded') return almasik(c, xx, y, zz);
      return wall;
    });
    if (bazaar) bazaarShop(ctx, f, lt, use);
    else {
      facade(ctx, f, lt, { wall, shutter, trim, wooden, han, shopFront: shopFront && !hasRoom, room: hasRoom, r, lk });
      roof(ctx, lt, { wall, wooden, han, r });
    }
  }
  if (bazaar) {
    // the bazaar shop's keeper stands just inside the open front, among the goods
    if (!use?.room) { const [kx, kz] = bazaarKeeper(f); ctx.keepers.push({ pos: [kx, (base - G) * V, kz], face: f.faceOut, seed: lt.seed * 13 + 5, indoor: true, shop: istanbulTrade(bazaarTrade(lt), lt.seed), stand: bazaarStand(f) }); }
    return;
  }
  if (use?.hotel !== undefined) hotel(ctx, f, lt, use.hotel, touched);
  else if (use?.room) foodRoom(ctx, f, lt, use.room, touched, use.restaurant);
  else if (shopFront && f.W >= 10 && f.D >= 12) shopInterior(ctx, f, lt, touched);
  else if (touched && f.W >= 16 && f.D >= 16 && (lt.use === 'house' || !shopFront)) homeRoom(ctx, f, lt);
}

/** Windows, balconies and the bay windows of the wooden houses, the shopfront downstairs. */
function facade(ctx: Ctx, f: Frame, lt: LotPlan, o: { wall: number; shutter: number; trim: number; wooden: boolean; han: boolean; shopFront: boolean; room: boolean; r: () => number; lk: Look }): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const { base, top } = lt;
  const floors = Math.floor((top - base) / 12);
  // every side whose outside is open air at that height gets windows; the front is the street side
  const sides: { frame: Frame; front: boolean }[] = [{ frame: f, front: true }];
  for (const sd of ['n', 's', 'e', 'w'] as const) if (sd !== lt.side) sides.push({ frame: new Frame({ ...lt, side: sd }), front: false });
  for (const { frame: fr, front } of sides) {
    const ground = (a: number) => {
      const [x, z] = fr.xz(a, 0);
      const ox = x + fr.out[0], oz = z + fr.out[1];
      if (!inMap(ox, oz)) return 255;
      const ci = col(ox, oz);
      if (plan.lot[ci]) return plan.lots[plan.lot[ci] - 1].top;
      if (plan.kind[ci] === K.Mosque) return 255;
      return plan.walk[ci];
    };
    const lk = o.lk;
    const bays: number[] = [];
    const step = o.han ? 6 + (lt.seed % 2) : lk.bay;
    for (let a = 3; a + 4 < fr.W; a += step) bays.push(a);
    const doorA = Math.floor(fr.W / 2) - 2;
    // pilasters between the bays of the upper floors, flush with the wall
    if (lk.pilasters && step >= 7 && floors >= 2) for (const a of bays) if (a + 5 < fr.W - 2 && ground(a + 5) <= base + 14) fr.box(g, a + 5, base + 12, 0, a + 5, top - 2, 0, o.trim);
    // the cornice: a moulded band at the top of the wall, on some a row of dentils under it
    if (lk.cornice === 2 && !o.han) for (let a = 0; a < fr.W; a++) if (ground(a) < top - 3) { fr.box(g, a, top - 1, -1, a, top - 1, -1, o.trim); if (a % 2 === 0) fr.box(g, a, top - 2, -1, a, top - 2, -1, o.trim); }
    for (let fl = front && (o.shopFront || o.room) ? 1 : 0; fl < floors; fl++) {
      const yb = base + fl * 12;
      const balcony = !o.wooden && !o.han && fl > 0 && front && fr.W >= 18 && hash3(lt.seed, fl, 3) < 0.55;
      for (const a of bays) {
        if (ground(a + 1) > yb + 2) continue;
        if (front && fl === 0 && a + 3 >= doorA - 1 && a - 1 <= doorA + 4) continue; // the door has this bay
        const tall = o.han ? 5 : 6;
        const kind: WinKind = lk.win === 'french' && fl === 0 ? 'plain' : lk.win;
        const sy0 = yb + 3 - (kind === 'french' ? 2 : 0), sy1 = yb + 3 + tall + (kind === 'arch' ? 1 : 0);
        const lit = hash3(a, yb, lt.seed) < 0.35;
        const pane = lit ? c.glassLit : c.glass;
        fr.box(g, a, sy0, 0, a + 2, sy1, 0, pane);
        // upstairs the glass sits back in the thickness of the wall, so the reveal throws its shadow (the ground
        // floor and any building with rooms upstairs keep it flush: their rooms are hollowed out after this)
        if (fl > 0 && !o.room) for (let aa = a; aa <= a + 2; aa++) for (let y = sy0; y <= sy1; y++) {
          const [bx, bz] = fr.xz(aa, 1);
          const behind = g.get(bx, y, bz);
          if (!behind || behind === c.glass || behind === c.glassLit) continue;
          g.set(bx, y, bz, pane);
          const [fx, fz] = fr.xz(aa, 0);
          g.set(fx, y, fz, 0);
        }
        const face = (aa: number, y: number) => { const [fx, fz] = fr.xz(aa, 0); return g.get(fx, y, fz); };
        if (o.han) { fr.box(g, a, sy1 + 1, 0, a + 2, sy1 + 1, 0, c.brick); fr.box(g, a + 1, sy1 + 2, 0, a + 1, sy1 + 2, 0, c.brick); continue; }
        // the sill, then the window's own surround
        if (kind !== 'french') fr.box(g, a - 1, sy0 - 1, -1, a + 3, sy0 - 1, -1, o.trim);
        if (o.wooden) {
          fr.box(g, a - 1, sy0, 0, a - 1, sy1, 0, o.trim); fr.box(g, a + 3, sy0, 0, a + 3, sy1, 0, o.trim);
          fr.box(g, a - 1, sy1 + 1, 0, a + 3, sy1 + 1, 0, o.trim);
          // upstairs, the kafes lattice over the lower half of the sash on some houses
          if (lk.kafes && fl > 0) fr.box(g, a, sy0, 0, a + 2, sy0 + 2, 0, (aa, y) => ((aa + y) % 2 ? c.kafes : face(aa, y)));
        } else if (kind === 'shutter') {
          if (fl > 0) {
            fr.box(g, a - 1, sy1 + 1, -1, a + 3, sy1 + 1, -1, o.trim); // a pediment over the window
            fr.box(g, a, sy1 + 2, -1, a + 2, sy1 + 2, -1, o.trim);
            if (hash3(a, yb, 7) < 0.6) { fr.box(g, a - 1, sy0, -1, a - 1, sy1, -1, o.shutter); fr.box(g, a + 3, sy0, -1, a + 3, sy1, -1, o.shutter); }
            else if (hash3(a, yb, 11) < lk.closed) fr.box(g, a, sy0, 0, a + 2, sy1, 0, (aa, y) => (aa === a + 1 ? c.trimDark : y % 2 ? o.shutter : c.iron)); // shutters closed for the heat
          } else fr.box(g, a - 1, sy1 + 1, 0, a + 3, sy1 + 1, 0, o.trim);
        } else if (kind === 'arch') {
          // a round head: the top corners filled back in, the trim following the curve, a keystone at the crown
          fr.box(g, a, sy1, 0, a, sy1, 0, o.trim); fr.box(g, a + 2, sy1, 0, a + 2, sy1, 0, o.trim);
          fr.box(g, a - 1, sy0, 0, a - 1, sy1 - 1, 0, o.trim); fr.box(g, a + 3, sy0, 0, a + 3, sy1 - 1, 0, o.trim);
          fr.box(g, a, sy1 + 1, 0, a + 2, sy1 + 1, 0, o.trim);
          fr.box(g, a + 1, sy1 + 2, fl > 0 ? -1 : 0, a + 1, sy1 + 2, fl > 0 ? -1 : 0, o.trim);
        } else if (kind === 'plain') {
          fr.box(g, a - 1, sy0, 0, a - 1, sy1 + 1, 0, o.trim); fr.box(g, a + 3, sy0, 0, a + 3, sy1 + 1, 0, o.trim);
          fr.box(g, a, sy1 + 1, 0, a + 2, sy1 + 1, 0, o.trim);
        } else if (kind === 'french') {
          // a door-height window onto an iron balconette (upper floors only, well over the street)
          fr.box(g, a - 1, sy0 - 1, -1, a + 3, sy0 - 1, -1, o.trim);
          fr.box(g, a - 1, sy0, -1, a + 3, sy0 + 2, -1, (aa, y) => (y === sy0 + 2 || aa === a - 1 || aa === a + 3 || (aa - a) % 2 === 0 ? c.iron : 0));
          fr.box(g, a - 1, sy1 + 1, 0, a + 3, sy1 + 1, 0, o.trim);
          fr.box(g, a + 1, sy0, 0, a + 1, sy1, 0, c.trimDark);
        } else if (kind === 'segment') {
          // a flat arch of alternating voussoirs, the jambs picked out in blocks
          const vA = lk.mode === 'brick' ? c.limeLight : c.brick, vB = lk.mode === 'brick' ? c.brickDark : o.trim;
          fr.box(g, a - 1, sy1 + 1, 0, a + 3, sy1 + 1, 0, (aa) => ((aa - a) % 2 ? vA : vB));
          fr.box(g, a, sy1 + 2, 0, a + 2, sy1 + 2, 0, (aa) => ((aa - a) % 2 ? vB : vA));
          for (const ja of [a - 1, a + 3]) fr.box(g, ja, sy0, 0, ja, sy1, 0, (_a, y) => (((y - sy0) >> 1) % 2 ? vA : o.trim));
        } else {
          // a pair of narrow lights under one lintel, a slim pier between them
          fr.box(g, a + 1, sy0, 0, a + 1, sy1, 0, o.trim);
          fr.box(g, a - 1, sy1 + 1, 0, a + 3, sy1 + 1, 0, o.trim);
          fr.box(g, a + 1, sy1 + 2, 0, a + 1, sy1 + 2, 0, o.trim);
        }
        // under the sill: a box of geraniums trailing ivy, or on the plaster blocks now and then an air conditioner
        if (fl > 0 && !balcony && kind !== 'french') {
          const h = hash3(a, yb, lt.seed + 17);
          if (h < 0.36) {
            fr.box(g, a - 1, sy0 - 2, -2, a + 3, sy0 - 1, -2, o.wooden ? c.woodBare : c.terracotta);
            const bloom = [c.geranium, c.rose2, c.white, c.tulipY][Math.floor(hash3(a, yb, lt.seed + 5) * 4)];
            fr.box(g, a - 1, sy0, -2, a + 3, sy0 + 1, -2, (aa, y) => {
              const k = hash3(aa, y, lt.seed + a);
              return y === sy0 ? (k < 0.55 ? bloom : c.leafLight) : k < 0.35 ? bloom : 0;
            });
            for (let aa = a - 1; aa <= a + 3; aa++) { const k = hash3(aa, yb, lt.seed + 9); if (k < 0.45) fr.box(g, aa, sy0 - 3 - (k < 0.15 ? 1 : 0), -2, aa, sy0 - 3, -2, c.ivy); }
          } else if (h > 0.84 && !o.wooden) {
            fr.box(g, a, sy0 - 4, -1, a + 2, sy0 - 2, -2, (aa, y, d) => (d === -2 && aa === a + 1 && y === sy0 - 3 ? c.grey : c.white));
            fr.box(g, a + 2, sy0 - 5, -1, a + 2, sy0 - 5, -1, c.grey);
          }
        }
      }
      // balconies on the stone blocks: an iron rail along a stone shelf, flowers here and there
      if (balcony) {
        const a0 = 2, a1 = fr.W - 3;
        fr.box(g, a0, yb + 2, -1, a1, yb + 2, -2, o.trim);
        fr.box(g, a0, yb + 3, -2, a1, yb + 5, -2, (a, y) => (y === yb + 5 || a % 2 === 0 ? c.iron : 0));
        for (let a = a0 + 1; a < a1; a += 3) if (hash3(a, yb, lt.seed) < 0.35) fr.box(g, a, yb + 3, -1, a, yb + 3, -1, hash3(a, yb, 5) < 0.5 ? c.rose2 : c.leaf);
        // now and then a kilim put out to air, folded over the rail and hanging down the front
        if (hash3(lt.seed, fl, 23) < 0.3) {
          const ka = a0 + 2 + Math.floor(hash3(lt.seed, fl, 29) * Math.max(1, a1 - a0 - 10));
          const [k1, k2, k3] = hash3(lt.seed, fl, 31) < 0.5 ? [c.carpetRed, c.carpetCream, c.carpetBlue] : [c.carpetBlue, c.carpetGold, c.carpetRed];
          fr.box(g, ka, yb - 2, -3, ka + 6, yb + 5, -3, (a, y) => {
            const ea = Math.min(a - ka, ka + 6 - a), ey = Math.min(y - (yb - 2), yb + 5 - y);
            return ea === 0 || ey === 0 ? k2 : (ea + ey) % 3 === 0 ? k3 : k1;
          });
          fr.box(g, ka, yb + 6, -2, ka + 6, yb + 6, -3, k1);
        }
      }
    }
    if (!o.wooden && !o.han) weather(ctx, fr, lt, o, ground, front, bays, floors);
    // the wooden houses' cumba: a closed bay window jutting out over the street on the upper floors
    if (o.wooden && front && floors >= 2 && fr.W >= 16) {
      const a0 = Math.floor(fr.W / 2) - 5, a1 = a0 + 9;
      const y0 = base + 12, y1 = top - 2;
      fr.box(g, a0, y0, -1, a1, y1, -3, (a, y, d) => {
        const edge = a === a0 || a === a1 || d === -3;
        if (y === y0) return c.eave;
        if (y === y1) return c.eave;
        const win = ((y - y0) % 12 >= 3 && (y - y0) % 12 <= 8);
        return edge && win && a % 3 !== 0 ? (hash3(a, y, d) < 0.4 ? c.glassLit : c.glass) : edge && (y - y0) % 12 >= 3 && (y - y0) % 12 <= 5 && win ? c.kafes : o.wall;
      });
      // the brackets under it
      for (const a of [a0, a0 + 4, a1]) for (let i = 1; i <= 2; i++) fr.box(g, a, y0 - i, -1, a, y0 - i, -(3 - i), c.eave);
    }
    if (front && !o.han) vine(ctx, fr, lt, floors, ground);
    if (!front) continue;
    // the ground floor: a shopfront of glass, or a door
    const a0 = 1, a1 = fr.W - 2, yb = base;
    if (o.room) {
      // the room draws its own front
    } else if (o.shopFront) {
      // the shopfront's frame in its own paint, the glazing bars at its own spacing
      const frameC = [c.woodDark, c.ironGreen, c.trimOx, c.iron, c.trimBlue, c.woodBare, c.trimGreen][Math.floor(hash3(lt.seed, 2, 2) * 7)];
      const bar = 4 + Math.floor(hash3(lt.seed, 2, 3) * 4);
      fr.box(g, a0, yb, 0, a1, yb + 9, 0, (a, y) => (y === yb + 9 ? o.trim : pm(a - a0, bar) === 0 || a === a1 ? frameC : y < yb + 2 ? frameC : c.shopGlass));
      // the roller shutter's housing over the glass, rolled up for the day, and its guide rails down the sides
      if (hash3(lt.seed, 2, 4) < 0.7) {
        fr.box(g, a0, yb + 9, -1, a1, yb + 9, -1, (a, y, d) => { const [x, z] = fr.xz(a, d); return g.get(x, y, z) || c.kepenk; });
        for (const a of [a0, a1]) fr.box(g, a, yb + 2, 0, a, yb + 8, 0, c.kepenk);
      }
      signBoard(c, g, fr, a0, a1, yb + 10, lt.seed);
      if (lk.tiles >= 0 && top - base > 20) fr.box(g, 1, top - 6, 0, fr.W - 2, top - 3, 0, (a, y) => izTile(c, lk.tiles, a, y - (top - 6)));
      const [lx, lz] = fr.m(fr.W / 2, -1.5);
      b.lamp(lx, (yb - G) * V + 2.1, lz, WARM, 4, 0.55);
    } else {
      const da = Math.floor(fr.W / 2) - 2;
      // the door, on some a fanlight of glass over it; a panel of tiles over a few doors
      fr.box(g, da, yb, 0, da + 3, yb + 8, 0, (_a, y) => (lk.fan && y === yb + 8 ? c.glassLit : lk.doorC));
      if (!lk.fan) fr.box(g, da + 1, yb, 0, da + 2, yb + 7, 0, (_a, y) => ((y - yb) % 4 === 3 ? c.trimDark : lk.doorC)); // the panels
      fr.box(g, da - 1, yb + 9, -1, da + 4, yb + 9, -1, o.trim);
      if (lk.tiles >= 0) fr.box(g, da - 1, yb + 10, 0, da + 4, yb + 11, 0, (a, y) => izTile(c, lk.tiles, a, y - yb - 9));
      // the blue enamel number plate beside the door and a brass knocker, flush so the doorstep stays clear
      fr.box(g, da + 5, yb + 7, 0, da + 6, yb + 7, 0, (a) => (a === da + 5 ? c.signBlue : c.white));
      fr.box(g, da + 5, yb + 6, 0, da + 6, yb + 6, 0, c.signBlue);
      if (hash3(lt.seed, 7, 7) < 0.6) fr.box(g, da + 1, yb + 5, 0, da + 2, yb + 5, 0, c.brass);
      const [lx, lz] = fr.m(da + 1.5, -0.4);
      if (hash3(lt.seed, 3, 3) < 0.5) { b.place(wallLantern(c), lx, (yb - G) * V + 2.4, lz, fr.turnOut); b.lamp(lx, (yb - G) * V + 2.4, lz, WARM, 4.5, 0.6); }
    }
  }
}

/**
 * The wear of a century on a block's walls, and the things a household fixes to them: damp creeping up from the
 * paving, rain streaks down from the cornice and the sills, plaster fallen away to show the brick behind, a zinc
 * downpipe at a corner and now and then a satellite dish. Repaints only cells still in the wall's own colour, and
 * sticks out only into empty air above head height.
 */
function weather(ctx: Ctx, fr: Frame, lt: LotPlan, o: { wall: number; trim: number; lk: Look; shopFront: boolean }, ground: (a: number) => number, front: boolean, bays: number[], floors: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base, top, seed } = lt;
  const lk = o.lk;
  const own = (v: number) => v === o.wall || (lk.ground !== 'same' && v === lk.groundWall);
  const shadeOf = (m: Map<number, number>, v: number) => m.get(v) ?? m.get(o.wall) ?? v;
  const paint = (a: number, y: number, m: Map<number, number>) => {
    const [x, z] = fr.xz(a, 0), v = g.get(x, y, z);
    if (own(v)) g.set(x, y, z, shadeOf(m, v));
  };
  const H = (k: number, a = 0, y = 0) => hash3(seed * 7 + a, y, k);
  const plaster = lk.mode === 'plaster';
  // damp, rising in a soft wave from the street where the wall meets the paving
  for (let a = 0; a < fr.W; a++) {
    const gl = ground(a);
    if (gl > base + 2 || gl < base - 6) continue;
    const y0 = Math.max(base + 2, gl);
    const wave = Math.sin(a * 0.5 + seed) + Math.sin(a * 0.19 + seed * 0.7);
    const h = Math.max(0, Math.round((plaster ? 1.6 : 0.8) + wave * 1.4));
    for (let y = y0; y < y0 + h; y++) paint(a, y, c.damp);
  }
  // rain streaks down from the cornice, and under the upstairs sills
  for (let a = 1; a < fr.W - 1; a++) {
    const h = H(61, a);
    if (h < 0.08) for (let y = top - 2; y >= top - 3 - Math.floor(h * 90); y--) paint(a, y, c.dirt);
  }
  for (let fl = 1; fl < floors; fl++) for (const a of bays) {
    const h = H(62, a, fl);
    if (h < 0.35) for (let y = base + fl * 12 + 1; y >= base + fl * 12 - Math.floor(h * 12); y--) paint(a + 1, y, c.dirt);
  }
  // plaster fallen away from the brick under it, in ragged patches
  if (plaster) {
    const n = Math.floor(H(63) * 3.6);
    for (let i = 0; i < n && fr.W > 8 && top - base > 14; i++) {
      const ha = H(64, i), hy = H(65, i);
      const pa = 1 + Math.floor(ha * (fr.W - 7)), py = base + 3 + Math.floor(hy * hy * (top - base - 9));
      const pw = 3 + (Math.floor(ha * 17) % 4), ph = 2 + (Math.floor(hy * 13) % 3);
      for (let u = 0; u < pw; u++) for (let v = 0; v < ph; v++) {
        if ((u === 0 || u === pw - 1) && (v === 0 || v === ph - 1)) continue;
        const [x, z] = fr.xz(pa + u, 0), cur = g.get(x, py + v, z);
        if (own(cur)) g.set(x, py + v, z, (py + v) % 3 === 2 ? c.mortar : (pa + u + ((py + v) % 6 < 3 ? 0 : 2)) % 4 === 0 ? c.mortar : c.brick);
      }
    }
  }
  // a zinc downpipe from the gutter to the street at one front corner, its joints banded
  if (front && H(66) < 0.6 && fr.W >= 10) {
    const a = H(67) < 0.5 ? 0 : fr.W - 1;
    const gl = ground(a);
    if (gl <= base + 2 && gl >= base - 6) for (let y = gl; y < top; y++) {
      const [x, z] = fr.xz(a, -1);
      if (!g.get(x, y, z)) g.set(x, y, z, (y - gl) % 12 === 11 ? c.zincDark : c.zinc);
    }
  }
  // a satellite dish beside an upstairs window, on one block in eight
  if (floors >= 2 && bays.length && H(68) < 0.14) {
    const a = bays[Math.floor(H(69) * bays.length)] + 4, fl = 1 + Math.floor(H(70) * (floors - 1));
    const y = base + fl * 12 + 6;
    const [ax, az] = fr.xz(a, -1), [dx, dz] = fr.xz(a, -2), [ex, ez] = fr.xz(a + 1, -2);
    if (a + 1 < fr.W - 1 && ground(a) + 10 < y && !g.get(ax, y, az) && !g.get(dx, y, dz) && !g.get(ex, y, ez) && !g.get(dx, y + 1, dz) && !g.get(ex, y + 1, ez)) {
      g.set(ax, y, az, c.zincDark);
      for (const [x, z] of [[dx, dz], [ex, ez]]) { g.set(x, y, z, c.dish); g.set(x, y + 1, z, c.dish); }
    }
  }
}

/**
 * A climber up a house corner: wisteria hanging in purple tassels, bougainvillea in magenta, or plain ivy.
 * The stem hugs the wall one voxel out; it spreads only above head height, so the street stays walkable.
 */
function vine(ctx: Ctx, fr: Frame, lt: LotPlan, floors: number, ground: (a: number) => number): void {
  const { b, c } = ctx;
  const g = b.grid;
  const pick = hash3(lt.seed, 11, 19);
  if (pick > 0.3 || fr.W < 10) return;
  const va = hash3(lt.seed, 3, 29) < 0.5 ? 0 : fr.W - 1;
  const gw = ground(va);
  if (gw > lt.base + 2 || gw < lt.base - 4) return;
  const kind = pick < 0.12 ? 'wisteria' : pick < 0.22 ? 'bougainvillea' : 'ivy';
  const yT = Math.min(lt.top - 2, lt.base + 12 * Math.min(floors, 2) + 4);
  const y0 = lt.base + 9;
  fr.box(g, va, gw, -1, va, yT, -1, c.trunk);
  const dir = va === 0 ? 1 : -1;
  const flowers = kind === 'wisteria' ? [c.wisteria, c.wisteriaB] : kind === 'bougainvillea' ? [c.judas, c.judasB] : [c.ivy];
  const reach = kind === 'ivy' ? 7 : 10;
  for (let y = y0; y <= yT; y++) {
    const spread = Math.round(reach * Math.sin(((y - y0) / Math.max(1, yT - y0)) * Math.PI * 0.9 + 0.25));
    for (let k = 0; k <= spread; k++) {
      const a = va + dir * k;
      if (a < 0 || a >= fr.W) continue;
      const h = hash3(a, y, lt.seed + 41);
      if (h > 0.78 - k * 0.03) continue;
      const bloom = kind !== 'ivy' && h < 0.3;
      fr.box(g, a, y, -1, a, y, -1, bloom ? flowers[Math.floor(h * 10) % 2] : h < 0.5 ? c.leaf : c.ivy);
      // wisteria's tassels hang a little out from the leaves
      if (kind === 'wisteria' && h < 0.12 && y > y0 + 1) fr.box(g, a, y - 2, -2, a, y, -2, (_a, yy) => (yy === y - 2 ? c.wisteriaB : c.wisteria));
      if (kind === 'bougainvillea' && h < 0.08) fr.box(g, a, y, -2, a, y, -2, c.judasB);
    }
  }
}

function roof(ctx: Ctx, lt: LotPlan, o: { wall: number; wooden: boolean; han: boolean; r: () => number }): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { x0, z0, x1, z1, top } = lt;
  const w = x1 - x0 + 1, d = z1 - z0 + 1;
  if (o.han) {
    // a flat lead roof with rows of little domes, one over each room, and chimney stacks between
    g.box(x0, top, z0, x1, top, z1, c.leadDark);
    for (let z = z0 + 3; z + 5 <= z1; z += 8) for (let x = x0 + 3; x + 5 <= x1; x += 8) {
      for (let y = 0; y <= 3; y++) for (let dz = 0; dz < 6; dz++) for (let dx = 0; dx < 6; dx++) if (Math.hypot(dx - 2.5, dz - 2.5, y * 1.3) <= 3.2) g.set(x + dx, top + 1 + y, z + dz, y === 3 ? c.leadLight : c.lead);
      if (hash3(x, z, 4) < 0.4) { g.box(x + 6, top + 1, z + 6, x + 6, top + 4, z + 6, c.brick); g.set(x + 6, top + 5, z + 6, c.lead); }
    }
    return;
  }
  const kind = o.r();
  if (o.wooden || kind < 0.55) {
    // a low hipped roof of red tiles, the eaves out over the walls
    const ex = o.wooden ? 2 : 1;
    for (let y = 0; y < Math.min(w, d) / 2 + ex; y++) {
      const X0 = x0 - ex + y, X1 = x1 + ex - y, Z0 = z0 - ex + y, Z1 = z1 + ex - y;
      if (X0 > X1 || Z0 > Z1) break;
      g.box(X0, top + Math.floor(y / 2), Z0, X1, top + Math.floor(y / 2), Z1, (x, _y, z) => (x === X0 || x === X1 || z === Z0 || z === Z1 ? ((x + z) % 2 ? c.roofTile : c.roofTileB) : g.get(x, top + Math.floor(y / 2), z) || 0));
    }
    // fill the hip's inside so no gaps show
    for (let y = 0; y < Math.min(w, d) / 4; y++) g.box(x0 + 2 * y + 1, top + y, z0 + 2 * y + 1, x1 - 2 * y - 1, top + y, z1 - 2 * y - 1, (x, yy, z) => g.get(x, yy, z) || c.roofTileB);
  } else {
    // a flat roof with a parapet, water tanks and the odd satellite dish; a cornice below
    g.box(x0, top, z0, x1, top, z1, c.roofFlat);
    g.box(x0, top + 1, z0, x1, top + 2, z0, c.cornice); g.box(x0, top + 1, z1, x1, top + 2, z1, c.cornice);
    g.box(x0, top + 1, z0, x0, top + 2, z1, c.cornice); g.box(x1, top + 1, z0, x1, top + 2, z1, c.cornice);
    g.box(x0 - 1, top - 2, z0 - 1, x1 + 1, top - 2, z1 + 1, (x, y, z) => g.get(x, y, z) || c.cornice);
    if (kind < 0.8 && w > 10 && d > 10) { const tx = x0 + 3, tz = z0 + 3; g.box(tx, top + 1, tz, tx + 4, top + 5, tz + 3, c.white); g.box(tx, top + 6, tz, tx + 4, top + 6, tz + 3, c.grey); }
    if (kind > 0.85) { const sx = x1 - 4, sz = z1 - 4; g.box(sx, top + 1, sz, sx, top + 3, sz, c.iron); g.box(sx - 1, top + 4, sz - 1, sx + 1, top + 5, sz + 1, c.white); }
    // a pigeon loft of planks and wire on the roof, the old Istanbul hobby; pots of herbs along the parapet
    if (w > 13 && d > 13 && o.r() < 0.45) {
      const px = x1 - 8, pz = z0 + 2;
      g.box(px, top + 1, pz, px + 5, top + 5, pz + 4, (x, y, z) => {
        if (y === top + 5) return c.roofTileB;
        const face = z === pz || z === pz + 4 || x === px || x === px + 5;
        if (!face) return g.get(x, y, z);
        return z === pz && y >= top + 2 && y <= top + 4 && x > px && x < px + 5 ? ((x + y) % 2 ? c.iron : 0) : c.woodBare;
      });
      g.box(px - 1, top + 6, pz - 1, px + 6, top + 6, pz + 5, (x, _y, z) => (x === px - 1 || x === px + 6 || z === pz - 1 || z === pz + 5 ? c.roofTile : g.get(x, top + 6, z)));
    }
    for (const [x, z] of [[x0 + 1, z1 - 1], [x1 - 1, z1 - 1], [x0 + 1, z0 + 1]] as const) if (o.r() < 0.5) { g.set(x, top + 1, z, c.terracotta); g.set(x, top + 2, z, o.r() < 0.5 ? c.leafLight : c.geranium); }
  }
  // chimneys
  if (o.r() < 0.6) { const cx = x0 + 2 + Math.floor(o.r() * Math.max(1, w - 4)), cz = z0 + 2 + Math.floor(o.r() * Math.max(1, d - 4)); g.box(cx, top + 1, cz, cx + 1, top + 7, cz + 1, c.brick); g.box(cx - 1, top + 8, cz - 1, cx + 2, top + 8, cz + 2, c.roofTileB); }
}

/** A plain home: the ground floor hollow and furnished, so a building cut away shows a lived-in room. */
function homeRoom(ctx: Ctx, f: Frame, lt: LotPlan): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base } = lt;
  f.box(g, 1, base, 1, f.W - 2, base + 10, f.D - 2, 0);
  f.box(g, 1, base - 1, 1, f.W - 2, base - 1, f.D - 2, (a, _y, d) => ((a >> 2) + (d >> 2)) % 2 ? c.woodBare : c.woodDark);
  const [vx0, vz0] = f.xz(1, 1), [vx1, vz1] = f.xz(f.W - 2, f.D - 2);
  b.indoor.push([Math.min(vx0, vx1), base, Math.min(vz0, vz1), Math.max(vx0, vx1), base + 10, Math.max(vz0, vz1)]);
  // a kilim on the floor, a divan along the back wall with cushions, a low table, a cupboard
  const ca = Math.floor(f.W / 2), cd = Math.floor(f.D / 2);
  f.box(g, ca - 4, base - 1, cd - 3, ca + 3, base - 1, cd + 2, (a, _y, d) => (Math.abs(a - ca) + Math.abs(d - cd) < 3 ? c.carpetBlue : (a + d) % 3 ? c.carpetRed : c.carpetCream));
  f.box(g, 2, base, f.D - 4, f.W - 3, base + 1, f.D - 3, c.carpetRed);
  for (let a = 3; a < f.W - 3; a += 3) f.box(g, a, base + 2, f.D - 3, a + 1, base + 3, f.D - 3, [c.carpetGold, c.carpetBlue, c.carpetCream][a % 3]);
  f.box(g, ca - 1, base, cd, ca, base + 1, cd + 1, c.woodDark);
  f.box(g, 2, base, 2, 3, base + 7, 4, c.woodBare);
  if (hash3(lt.x0, base, lt.z1) < 0.7) { const [lx, lz] = f.m(ca, cd); b.lamp(lx, (base - G) * V + 2.2, lz, WARM, 3.2, 0.6); }
}

type ShopKind = 'bakkal' | 'lokum' | 'kuruyemis' | 'textile' | 'ceramics' | 'lamps' | 'copper' | 'kahve' | 'books' | 'shoes';
const SHOP_KINDS: ShopKind[] = ['bakkal', 'lokum', 'kuruyemis', 'textile', 'ceramics', 'lamps', 'copper', 'kahve', 'books', 'books', 'shoes', 'kuruyemis'];

/**
 * A shop behind its glass front, open for the day: three metres of room behind the window with shelves of its
 * goods up the back and sides, a counter with the shopkeeper behind it, a display table in the middle, things
 * hanging from the ceiling, the door propped open, and the goods out on the pavement or on the wall outside.
 */
function shopInterior(ctx: Ctx, f: Frame, lt: LotPlan, touched: boolean): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base } = lt;
  const W = f.W, SD = Math.min(f.D - 3, 12);
  const kind = SHOP_KINDS[Math.floor(hash3(lt.seed, 5, 9) * SHOP_KINDS.length)];
  const y = (base - G) * V;
  const goods = {
    bakkal: [c.spiceRed, c.yellow, c.awnBlue, c.white, c.spiceGreen, c.apricot2, c.cartRed],
    lokum: [c.lokumPink, c.lokumWhite, c.lokumGreen, c.pistachio, c.gold, c.rose2],
    kuruyemis: [c.nut, c.pistachio, c.apricot2, c.fig2, c.spiceBrown, c.sesame],
    textile: [c.carpetRed, c.carpetBlue, c.carpetGold, c.carpetCream, c.iznikTeal, c.rose, c.lilac],
    ceramics: [c.iznikBlue, c.iznikTeal, c.iznikRed, c.iznikWhite, c.cobalt],
    lamps: [c.lampRed, c.lampBlue, c.lampGreen, c.lampAmber, c.brass],
    copper: [c.copper, c.brass, c.gold, c.copper],
    kahve: [c.spiceBrown, c.woodDark, c.copper, c.cream, c.brass],
    books: [c.signRed, c.signBlue, c.signGreen, c.cream, c.woodDark, c.yellow],
    shoes: [c.woodDark, c.eave, c.cream, c.signRed, c.trimDark],
  }[kind];
  const pick = (a: number, yy: number, d: number) => goods[Math.floor(hash3(a + lt.seed, yy, d) * goods.length)];
  const da = Math.floor(W / 2) - 1;
  if (touched) {
    f.box(g, 1, base, 1, W - 2, base + 9, SD, 0);
    f.box(g, 1, base - 1, 1, W - 2, base - 1, SD, (a, _y, d) => (kind === 'ceramics' || kind === 'lokum' ? ((a + d) % 2 ? c.marble : c.marbleGrey) : ((a >> 1) + (d >> 1)) % 2 ? c.slab : c.slabB));
    f.box(g, 1, base, SD + 1, W - 2, base + 9, SD + 1, (_a, yy) => (yy <= base + 2 ? c.woodDark : c.cream));
    f.box(g, 1, base + 10, 1, W - 2, base + 10, SD, c.cornice);
    // the door, propped open
    f.box(g, da, base, 0, da + 2, base + 7, 0, 0);
    // shelves up the back wall and down both sides, full of the shop's goods
    for (let lv = 0; lv < 3; lv++) {
      const yy = base + 1 + lv * 3;
      f.box(g, 1, yy, SD, W - 2, yy, SD, c.woodDark);
      f.box(g, 1, yy + 1, SD, W - 2, yy + 2, SD, (a, y2, d) => (hash3(a, y2, d + lt.seed) < 0.85 ? pick(a, y2, d) : 0));
      for (const a of [1, W - 2]) {
        f.box(g, a, yy, 3, a, yy, SD - 1, c.woodDark);
        f.box(g, a, yy + 1, 3, a, yy + 2, SD - 1, (a2, y2, d) => (hash3(a2, y2, d + lt.seed) < 0.8 ? pick(a2, y2, d) : 0));
      }
    }
    // the counter along one side, glass-topped with more goods under it
    f.box(g, W - 5, base, 3, W - 4, base + 3, SD - 3, c.woodDark);
    f.box(g, W - 5, base + 4, 3, W - 4, base + 4, SD - 3, (a, y2, d) => (kind === 'lokum' || kind === 'ceramics' ? pick(a, y2, d) : c.marble));
    f.box(g, W - 5, base + 5, 4, W - 5, base + 5, 5, c.brass); // the till, or the scales
    // a display table in the middle of the floor with heaps or stacks on it
    const t0 = Math.max(3, da - 2), t1 = Math.min(W - 7, da + 3);
    if (t1 > t0 && SD >= 9) {
      f.box(g, t0, base, 5, t1, base + 2, SD - 3, c.woodBare);
      f.box(g, t0, base + 3, 5, t1, base + 4, SD - 3, (a, y2, d) => (y2 === base + 4 && (a + d) % 2 ? 0 : pick(a, y2, d)));
    }
    // things hanging from the ceiling in the window: lamps, scarves, copper pans, strings of dried fruit
    for (let a = 2; a < W - 2; a += 3) {
      if (hash3(a, lt.seed, 4) < 0.35) continue;
      const len = kind === 'textile' ? 4 + Math.floor(hash3(a, 2, lt.seed) * 3) : 2;
      f.box(g, a, base + 9 - len, 2, a, base + 8, 2, (_a, y2) => (y2 === base + 8 ? c.iron : pick(a, y2, 2)));
    }
    // the goods out front: on the pavement in boxes and sacks, or on the wall by the door
    const [ox, oz] = f.m(da - 3, -0.9);
    if (kind === 'bakkal' || kind === 'kuruyemis' || kind === 'kahve') { b.place(spiceSacks(c, lt.seed), ox, y, oz, f.turnOut); b.block(ox - 0.9, oz - 0.6, ox + 0.9, oz + 0.6); }
    else if (kind === 'textile') { const [qx, qz] = f.m(da - 3, -0.15); b.place(carpet(c, lt.seed), qx, y + 0.5, qz, f.turnOut); }
    else if (kind === 'lamps') { const [qx, qz] = f.m(da - 3, -0.6); b.place(mosaicLamps(c, lt.seed), qx, y + 1.9, qz); }
    // the awning over the window
    const aw: [number, number] = [[c.awnRed, c.awnWhite], [c.awnGreen, c.awnWhite], [c.awnBlue, c.awnWhite], [c.awnYellow, c.awnBrown]][(lt.seed >> 2) % 4] as [number, number];
    const [ax, az] = f.m(W / 2 - 0.5, -1.2);
    b.place(awning(aw, Math.min(W - 2, 24)), ax, y + 2.0, az, f.turnOut);
    const [vx0, vz0] = f.xz(1, 1), [vx1, vz1] = f.xz(W - 2, SD);
    b.indoor.push([Math.min(vx0, vx1), base, Math.min(vz0, vz1), Math.max(vx0, vx1), base + 10, Math.max(vz0, vz1)]);
    const [lx, lz] = f.m(W / 2, SD / 2);
    b.lamp(lx, y + 2.2, lz, kind === 'lamps' ? [1, 0.6, 0.45] : WARM, 4, 0.7);
  }
  // nobody walks in: the doorway is for looking
  { const [p0x, p0z] = f.m(da - 0.5, 0), [p1x, p1z] = f.m(da + 2.5, 0.6); b.block(Math.min(p0x, p1x), Math.min(p0z, p1z), Math.max(p0x, p1x), Math.max(p0z, p1z)); }
  const [kx, kz] = f.m(W - 3, SD / 2 + 0.5);
  // the keeper serves through the open door: you browse from the pavement in front of it
  ctx.keepers.push({ pos: [kx, y, kz], face: f.faceOut, seed: lt.seed * 13 + 3, indoor: true, shop: istanbulTrade(kind, lt.seed), stand: f.m(da + 1.5, -3.5) });
}

// ------------------------------------------------------------------------------------------- food rooms

/** What a food room looks like inside: floor, wall, counter, what is on show, how many tables. */
function roomLook(c: IC2, kind: RoomKind): { floor: (a: number, d: number) => number; wain: number; wall: number; counter: number; top: number; show: number[]; tables: number; stoolTop: number } {
  const check = (p: number, q: number) => (a: number, d: number) => ((a >> 1) + (d >> 1)) % 2 ? p : q;
  const plank = (a: number, d: number) => ((a + ((d >> 2) % 2) * 2) % 4 === 0 ? c.woodDark : c.woodBare);
  switch (kind) {
    case 'kahve': return { floor: plank, wain: c.woodDark, wall: c.cream, counter: c.woodDark, top: c.copper, show: [c.copper, c.brass, c.lokumPink, c.lokumWhite], tables: 3, stoolTop: c.carpetRed };
    case 'cay': return { floor: check(c.slab, c.slabB), wain: c.iznikTeal, wall: c.white, counter: c.woodBare, top: c.marble, show: [c.tea, c.chrome, c.simit], tables: 3, stoolTop: c.woodBare };
    case 'lokanta': return { floor: check(c.iznikWhite, c.marbleGrey), wain: c.iznikBlue, wall: c.white, counter: c.chrome, top: c.chrome, show: [c.spiceRed, c.apricot2, c.spiceGreen, c.lokumWhite, c.spiceBrown], tables: 3, stoolTop: c.woodDark };
    case 'kebap': return { floor: check(c.brick, c.kufeki), wain: c.woodDark, wall: c.cream, counter: c.marble, top: c.marble, show: [c.simitDark, c.spiceRed, c.lokumGreen, c.apricot2], tables: 3, stoolTop: c.woodDark };
    case 'pide': return { floor: check(c.kufeki, c.kufekiDark), wain: c.iznikTeal, wall: c.cream, counter: c.marble, top: c.marble, show: [c.simit, c.spiceRed, c.lokumWhite], tables: 2, stoolTop: c.woodBare };
    case 'borek': return { floor: check(c.iznikWhite, c.iznikBlue), wain: c.iznikBlue, wall: c.white, counter: c.chrome, top: c.marble, show: [c.simit, c.yellow, c.sesame], tables: 2, stoolTop: c.woodDark };
    case 'muhallebi': return { floor: check(c.marble, c.marbleGrey), wain: c.mint, wall: c.white, counter: c.marble, top: c.marble, show: [c.lokumWhite, c.cream, c.simit, c.lokumPink], tables: 3, stoolTop: c.mint };
    case 'lokum': return { floor: check(c.marble, c.iznikRed), wain: c.woodDark, wall: c.cream, counter: c.woodDark, top: c.cartGlass, show: [c.lokumPink, c.lokumWhite, c.lokumGreen, c.pistachio, c.yellow], tables: 0, stoolTop: c.woodDark };
    case 'baharat': return { floor: check(c.slab, c.slabB), wain: c.woodDark, wall: c.kufeki, counter: c.woodDark, top: c.woodBare, show: [c.spiceRed, c.spiceOrange, c.spiceYellow, c.spiceGreen, c.nut, c.pistachio, c.apricot2], tables: 0, stoolTop: c.woodDark };
    case 'firin': return { floor: check(c.kufeki, c.slab), wain: c.brick, wall: c.cream, counter: c.woodBare, top: c.woodBare, show: [c.simit, c.simitDark, c.sesame, c.yellow], tables: 1, stoolTop: c.woodBare };
    case 'balik': return { floor: check(c.iznikWhite, c.iznikTeal), wain: c.hullBlue, wall: c.white, counter: c.chrome, top: c.cartGlass, show: [c.marbleGrey, c.hullRed, c.chrome, c.yellow], tables: 3, stoolTop: c.hullBlue };
    default: return { floor: plank, wain: c.woodDark, wall: c.cream, counter: c.woodDark, top: c.marble, show: [c.simit], tables: 2, stoolTop: c.woodDark };
  }
}

/**
 * A food room behind a shopfront: a counter with the food on show and the keeper behind it, tables by the windows
 * with regulars at them, warm light. Its anchor is all the game needs to put people in it and let you buy.
 */
export function foodRoom(ctx: Ctx, f: Frame, lt: LotPlan, kind: RoomKind, touched: boolean, restaurant?: Use['restaurant'], bazaar = false): void {
  const { b, c } = ctx;
  const g = b.grid;
  const { base } = lt;
  const W = f.W, D = f.D;
  const look = roomLook(c, kind);
  const nth = b.roomCount[kind] = (b.roomCount[kind] ?? -1) + 1;
  const y = (base - G) * V;
  const A0 = 1, A1 = W - 2, D0 = 1, D1 = D - 2;
  // the doorway is never narrower than four cells, so anyone can walk in; five where the front is wide enough
  const dw = Math.max(4, Math.min(5, W - 6)), da = Math.floor(W / 2) - (dw >> 1);
  // the counter runs across the room two thirds of the way back; the keeper stands behind it
  const cd = Math.max(D0 + 4, D1 - 4);
  const ca0 = A0 + 1, ca1 = A1 - 2;
  // the tables: a column by each side wall, more down the middle of a wide room, rows from the front to the counter,
  // and always a clear way from the door to the counter
  const spots: { side: number; td: number }[] = [];
  if (look.tables > 0) {
    const cols: number[] = [A0 + 2];
    for (let s0 = A0 + 9; s0 <= A1 - 10; s0 += 7) cols.push(s0);
    if (A1 - 3 > A0 + 6) cols.push(A1 - 3);
    for (const side of cols) {
      if (Math.abs(side + 1 - W / 2) < 4) continue;
      for (let td = D0 + 3; td + 2 < cd - 2; td += 5) {
        if (side > da - 3 && side < da + dw + 2 && td < D0 + 4) continue;
        spots.push({ side, td });
      }
    }
  }
  if (touched) {
    if (!bazaar) {
      const frameC = [c.woodDark, c.ironGreen, c.trimOx, c.woodBare, c.trimBlue, c.trimGreen][Math.floor(hash3(lt.seed, 2, 7) * 6)];
      f.box(g, A0, base, D0, A1, base + 10, D1, 0);
      f.box(g, 0, base, 0, W - 1, base + 10, 0, (a, yy) => {
        if (a >= da && a < da + dw && yy <= base + 8) return 0;
        if (a === 0 || a === W - 1 || yy === base + 10 || yy < base + 2 || a === da - 1 || a === da + dw) return frameC;
        return c.shopGlass;
      });
      // the sign over the door, and the awning
      signBoard(c, g, f, 0, W - 1, base + 11, lt.seed + nth);
      const aw: [number, number] = [[c.awnRed, c.awnWhite], [c.awnGreen, c.awnWhite], [c.awnBlue, c.awnWhite], [c.awnYellow, c.awnBrown]][(lt.seed >> 3) % 4] as [number, number];
      const [ax, az] = f.m(W / 2 - 0.5, -1.2);
      b.place(awning(aw, Math.min(W - 2, 24)), ax, y + 2.9, az, f.turnOut);
    }
    f.box(g, A0, base - 1, D0, A1, base - 1, D1, (a, _y, d) => look.floor(a, d));
    // walls: a dado of tiles or panelling, plaster above
    // (the walls are the building's own outer walls: the finish goes only where a neighbour hides the outside)
    for (const [a0, d0, a1, d1] of [[A0 - 0, D1 + 1, A1, D1 + 1], [A0 - 1, D0, A0 - 1, D1], [A1 + 1, D0, A1 + 1, D1]] as const)
      f.box(g, a0, base, d0, a1, base + 10, d1, lined(ctx, f, (_a, yy) => (yy <= base + 3 ? look.wain : yy === base + 4 ? c.woodDark : look.wall)));
    // the counter and what is on it
    // a counter at counter height (its top 1 m off the floor), so you see the cook over it and the dish comes across
    // clean; what is on show sits along the back edge, clear of the middle where the cook hands it over
    f.box(g, ca0, base, cd, ca1, base + 2, cd + 1, look.counter);
    f.box(g, ca0, base + 3, cd, ca1, base + 3, cd + 1, look.top);
    const midC = (ca0 + ca1) / 2;
    f.box(g, ca0 + 1, base + 4, cd + 1, ca1 - 1, base + 4, cd + 1, (a) => (Math.abs(a + 0.5 - midC) < 2.5 ? 0 : look.show[a % look.show.length]));
    // shelves behind with jars, glasses, copper
    f.box(g, A0, base + 6, D1, A1, base + 6, D1, c.woodDark);
    f.box(g, A0, base + 7, D1, A1, base + 8, D1, (a, yy) => (hash3(a, yy, lt.seed) < 0.6 ? look.show[(a + yy) % look.show.length] : 0));
    if (kind === 'kebap' || kind === 'pide' || kind === 'firin' || kind === 'borek') {
      // the oven or the grill at the back, glowing
      f.box(g, A1 - 4, base, D1 - 1, A1, base + 6, D1, c.brick);
      f.box(g, A1 - 3, base + 2, D1 - 1, A1 - 1, base + 4, D1 - 1, c.ember);
      const [ox, oz] = f.m(A1 - 2, D1 - 1);
      b.emitters.push({ kind: 'smoke', pos: [ox, y + 2.0, oz], rate: 0.4 });
    }
    // İznik plates hung along the side walls above the dado, and coloured lanterns over the tables
    // (hung one voxel proud inside the room, never painted into the outer wall where the street would see them)
    for (const a of [A0, A1]) for (let d = D0 + 2; d + 2 < cd; d += 6) iznikPlate(ctx, f, a, base + 8, d, lt.seed + d * 3 + a);
    // clusters of mosaic glass lamps down the middle of the room, over the kilim
    if (!bazaar) for (let d = D0 + 4; d + 2 < cd; d += 7) { const [mx, mz] = f.m(Math.round(W / 2) - 0.5, d); b.place(mosaicLamps(c, lt.seed + d), mx, y + 1.85, mz); }
    if (kind === 'kahve' || kind === 'cay') {
      const [sx, sz] = f.m(ca1 - 1, cd + 0.5);
      b.place(samovar(c), sx, y + 1.25, sz);
    }
    foodRoomDress(ctx, f, lt, kind, { A0, A1, D0, D1, cd, ca0, ca1, da, dw, spots, bazaar });
    const [vx0, vz0] = f.xz(A0, D0), [vx1, vz1] = f.xz(A1, D1);
    b.indoor.push([Math.min(vx0, vx1), base, Math.min(vz0, vz1), Math.max(vx0, vx1), base + 10, Math.max(vz0, vz1)]);
    const [lx, lz] = f.m(W / 2, D / 2);
    b.lamp(lx, y + 2.4, lz, WARM, 5, 0.9);
    const [kx, kz] = f.m(W / 2, cd);
    b.lamp(kx, y + 2.2, kz, WHITEWARM, 3.5, 0.6);
  }
  // the anchor: keeper behind the counter, the buy spot in front of it, guests at the tables
  const [rx0, rz0] = f.m(A0 - 0.5, D0 - 0.5), [rx1, rz1] = f.m(A1 + 0.5, D1 + 0.5);
  const room: RoomAnchor = {
    id: `${kind}-${nth}`, kind, nth,
    rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
    door: f.m(W / 2 - 0.5, 1.5),
    npcs: [], spots: [],
  };
  const mid = (ca0 + ca1) / 2;
  const keeperAt = f.m(mid, cd + 3);
  const buyPos = f.m(mid, cd + 0.5), buyStand = f.m(mid, cd - 2);
  // a restaurant's cook serves as a passport vendor (a stall anchor), not as a shop keeper
  if (!restaurant) {
    room.npcs.push({ role: 'keeper', pos: [keeperAt[0], y, keeperAt[1]], facing: f.faceOut, sit: false, seed: lt.seed });
    room.spots.push({ kind: 'buy', pos: [buyPos[0], y + 1.1, buyPos[1]], stand: buyStand });
  }
  b.block(...((): [number, number, number, number] => { const [p0x, p0z] = f.m(ca0 - 0.5, cd - 0.5), [p1x, p1z] = f.m(ca1 + 0.5, cd + 1.5); return [p0x, p0z, p1x, p1z]; })());
  // the tables, a stool either side, regulars at some of them
  let t = 0;
  spots.forEach(({ side, td }, i) => {
    const [tx, tz] = f.m(side + 0.5, td + 0.5);
    b.place(teaTable(c, lt.seed + i, false), tx, y, tz);
    b.block(tx - 0.35, tz - 0.35, tx + 0.35, tz + 0.35);
    for (const s of [-1, 1]) {
      const [sx, sz] = f.m(side + 0.5 + s * 2.4, td + 0.5);
      b.place(tabure(c, look.stoolTop), sx, y, sz);
      if (hash3(lt.seed, i, s) < 0.5 && t < 4) {
        room.npcs.push({ role: 'guest', pos: [sx, y + 0.375, sz], facing: Math.atan2(tx - sx, tz - sz), sit: true, seed: lt.seed * 31 + i * 7 + s });
        t++;
      }
    }
  });
  if (restaurant) {
    room.stall = restaurant.id;
    const [lx, lz] = f.m(mid, cd + 0.5);
    b.stallAnchors.push({ id: restaurant.id, stand: buyStand, vendor: [keeperAt[0], keeperAt[1], f.faceOut], label: [lx, y + 2.9, lz] });
    if (touched) { const [fx, fz] = f.m(mid - 2.5, cd + 0.5); b.place(buildFood(restaurant.foods[0], b.pal), fx, y + 1.0, fz, f.turnOut); }
  }
  b.rooms.push(room);
}

/** Each kind of food room's look in the dining kit. */
const FOOD_DRESS: Partial<Record<RoomKind, { goods: Goods[]; rail?: 'utensils' | 'pans' | 'garland' | 'herbs'; menu?: boolean; clock?: boolean; mirror?: boolean; counter: ('register' | 'tea' | 'jars' | 'bread' | 'fruit' | 'cake' | 'vase')[]; shop?: boolean }>> = {
  kahve: { goods: ['copper', 'cups', 'jars'], clock: true, counter: ['tea', 'register'] },
  cay: { goods: ['tea', 'glasses', 'jars'], clock: true, counter: ['tea', 'register'] },
  lokanta: { goods: ['copper', 'plates', 'jars'], menu: true, rail: 'pans', counter: ['bread', 'register'] },
  kebap: { goods: ['jars', 'plates', 'bottles'], menu: true, rail: 'garland', counter: ['register', 'jars'] },
  pide: { goods: ['jars', 'plates', 'tins'], menu: true, rail: 'utensils', counter: ['register', 'bread'] },
  borek: { goods: ['plates', 'jars', 'tea'], clock: true, counter: ['register', 'tea'] },
  muhallebi: { goods: ['cups', 'glasses', 'plates'], mirror: true, counter: ['cake', 'register'] },
  lokum: { goods: ['jars', 'tins', 'jars'], counter: ['register', 'vase'], shop: true },
  baharat: { goods: ['spice', 'spice', 'jars'], rail: 'garland', counter: ['register', 'jars'], shop: true },
  firin: { goods: ['bread', 'tins', 'jars'], counter: ['register', 'bread'] },
  balik: { goods: ['bottles', 'plates', 'jars'], rail: 'pans', menu: true, counter: ['register', 'fruit'] },
};

/**
 * A food room finished from the dining kit: the side walls dressed (a shelf of copper and tea glasses high up, İznik
 * plates, a picture of the Bosphorus, a clock or a mirror, brass wall lamps), a band of İznik tiles behind the
 * counter, every table laid with tea and something to eat under its own coloured-glass lantern (a game of tavla
 * on some in a kahvehane), a kilim down the way to the counter, the counter's ends set out, a palm in a corner and
 * a nazar bead over the door. Shops (lokum, spice) get shelves up their walls and sacks along one side instead.
 */
function foodRoomDress(ctx: Ctx, f: Frame, lt: LotPlan, kind: RoomKind, o: { A0: number; A1: number; D0: number; D1: number; cd: number; ca0: number; ca1: number; da: number; dw: number; spots: { side: number; td: number }[]; bazaar: boolean }): void {
  const dr = FOOD_DRESS[kind];
  if (!dr) return;
  const { b, c } = ctx;
  const g = b.grid;
  const base = lt.base;
  const { A0, A1, D0, D1, cd, ca0, ca1 } = o;
  const k = dineColors(b.pal);
  const R: Dine = {
    b, A0, A1, D0, D1, top: 10, floorY: (base - G) * V, seed: lt.seed,
    get: (a, y, d) => { const [x, z] = f.xz(a, d); return g.get(x, base + y, z); },
    set: (a, y, d, v) => { const [x, z] = f.xz(a, d); g.set(x, base + y, z, v); },
    m: (a, d) => f.m(a - 0.5, d - 0.5),
  };
  const W = walls(R);
  const iznik: [number, number][] = [[c.iznikBlue, c.iznikRed], [c.cobalt, c.iznikTeal], [c.iznikTeal, c.iznikRed], [c.iznikBlue, c.iznikGreen]];
  // a shop's walls are its shelves: three tiers up each side wall, cells in front of them kept clear of walkers
  if (dr.shop) for (const w of [W.L, W.R]) for (const [s0, s1] of stretches(R, w, 3, 9, 4)) {
    const len = Math.min(s1 - s0 + 1, 18);
    onWall(R, w, shelfProp(k, len * 4, dr.goods, lt.seed + s0, c.woodDark, 3), s0 + len / 2, 0.75);
    const [a0, d0] = w.line(s0), [a1, d1] = w.line(s0 + len - 1);
    dblock(R, a0, d0, a1, d1);
  }
  dressWalls(R, k, { goods: dr.goods, board: c.woodDark, pictures: dr.shop ? undefined : ['bosphorus'], plates: iznik, shade: k.shadeA, menu: dr.menu, clock: dr.clock, mirror: dr.mirror, rail: dr.rail, only: ['L', 'R'], picY: 4 });
  // İznik tiles on the back wall between the counter and the shelf, in eighth-metre tiles: tulips and carnations
  if (bare(R, W.B, ca0, ca1, 4, 5)) {
    const n = (ca1 - ca0 + 1) * 2;
    const p = new Prop(n, 4, 1, 0.125);
    p.box(0, 0, 0, n - 1, 3, 0, (x, y) => (y === 0 || y === 3 ? c.cobalt : (x % 4 === 1 || x % 4 === 2) && (y === 1 || y === 2) ? ((x >> 2) % 2 ? c.iznikRed : c.iznikTeal) : c.iznikWhite));
    onWall(R, W.B, p, (ca0 + ca1 + 1) / 2, 1.0);
  }
  // the tables laid, a lantern over each (a game of tavla left out on some in a coffee house)
  const lit: [number, number][] = [];
  o.spots.forEach(({ side, td }, i) => {
    const ta = side + 1, tdd = td + 1;
    if (kind === 'kahve' && hash3(lt.seed, i, 5) < 0.45) {
      const p = new Prop(10, 2, 7, F16);
      p.box(0, 0, 0, 9, 0, 6, c.woodDark); p.box(1, 1, 1, 8, 1, 5, (x, _y, z) => (x === 4 || x === 5 ? c.woodDark : (z === 1 || z === 5) && x % 2 ? (x < 4 ? c.iznikRed : c.cream) : c.woodBare));
      p.set(2, 1, 3, c.white); p.set(6, 1, 2, c.trimDark); p.set(7, 1, 4, c.white);
      dput(R, p, ta, tdd, 0.625, 2);
    } else dput(R, tableTop(k, 'tr', 12, 12, [sideOf(R, 2, 1), sideOf(R, 2, 3)], lt.seed + i * 17), ta, tdd, 0.625, 2);
    lit.push([ta, tdd]);
  });
  pendants(R, k, lit, 'lantern', k.shadeA, 2.0);
  // a kilim down the way from the door to the counter
  const mid = Math.floor((A0 + A1) / 2);
  if (cd - 3 > D0 + 2 && !o.bazaar) rug(R, mid - 2, D0 + 1, mid + 2, cd - 3, [c.carpetRed, c.carpetBlue, c.carpetGold], 'kilim');
  // the counter's ends
  dr.counter.forEach((kind2, i) => dput(R, counterPiece(k, kind2, lt.seed + i), i === 0 ? ca0 + 1 : ca1 + 0.2, cd + 0.6, 1.0, 0));
  if (kind === 'lokanta') {
    // the steam table: trays of the day's stews, rice and beans set into the counter front
    const n = Math.max(2, Math.min(5, Math.floor((ca1 - ca0 - 6) / 2)));
    const p = new Prop(n * 6, 2, 6, F16);
    for (let i = 0; i < n; i++) {
      p.box(i * 6, 0, 0, i * 6 + 5, 0, 5, k.steel);
      p.box(i * 6 + 1, 1, 1, i * 6 + 4, 1, 4, [c.spiceRed, c.lokumWhite, c.spiceBrown, c.apricot2, c.spiceGreen][i % 5]);
    }
    dput(R, p, ca0 + 2 + n * 0.75, cd + 0.75, 1.0, 0);
  }
  // sacks of spices or nuts along the left wall of a shop, their tops heaped
  if (dr.shop && cd - 2 > D0 + 2) {
    const cols = [c.spiceRed, c.spiceOrange, c.spiceYellow, c.spiceGreen, c.nut, c.pistachio, c.apricot2];
    for (let d = D0 + 2; d + 1 <= cd - 2; d += 2) {
      const col = kind === 'lokum' ? [c.lokumPink, c.lokumWhite, c.lokumGreen][(d >> 1) % 3] : cols[Math.floor(hash3(d, lt.seed, 2) * cols.length)];
      dair(R, A0 + 1, 0, d, A0 + 2, 2, d + 1, (_a, y) => (y === 2 ? col : c.carpetCream));
    }
    dblock(R, A0 + 1, D0 + 2, A0 + 2, cd - 2);
  }
  // a nargile or two waiting in the corner of a coffee house, a palm in the other; a palm in a front corner elsewhere
  if (!o.bazaar) {
    if (kind === 'kahve' && !R.get(A0, 0, D0) && !R.get(A0 + 1, 0, D0 + 1)) {
      for (const [na, nd] of [[A0 + 0.5, D0 + 0.5], [A0 + 1.5, D0 + 1.2]]) {
        const p = new Prop(3, 14, 3, F16);
        p.box(0, 0, 0, 2, 2, 2, [c.iznikBlue, c.iznikRed][Math.floor(na) & 1]); p.box(1, 3, 1, 1, 9, 1, c.brass); p.box(0, 10, 0, 2, 10, 2, c.brass); p.box(1, 11, 1, 1, 12, 1, c.ember); p.set(1, 13, 1, c.brass);
        dput(R, p, na, nd, 0, 2);
      }
      dblock(R, A0, D0, A0 + 1, D0 + 1);
    } else if (!dr.shop) cornerPlant(R, k, A0, D0, 'palm', c.copper);
    if (!dr.shop) cornerPlant(R, k, A1 - 1, D0, kind === 'balik' ? 'monstera' : 'palm', c.copper);
    // the nazar over the inside of the door
    const p = new Prop(3, 6, 1, F16);
    p.box(1, 3, 0, 1, 5, 0, c.gold); p.box(0, 0, 0, 2, 2, 0, k.nazar); p.box(1, 1, 0, 1, 1, 0, k.nazarL);
    dput(R, p, o.da + o.dw / 2, D0 + 0.1, 2.1, 2);
  }
  cornice(R, c.woodDark);
}

// ------------------------------------------------------------------------------------------- hotels

/**
 * A hotel: the lobby downstairs with the front desk and the lift, one guest room per floor upstairs, each with
 * its bed, its window onto the street, a tea tray and the door back down.
 */
function hotel(ctx: Ctx, f: Frame, lt: LotPlan, index: number, touched: boolean): void {
  const { b, c } = ctx;
  const g = b.grid;
  const info = ISTANBUL_HOTELS[index];
  const { base } = lt;
  const W = f.W, D = f.D;
  const y = (base - G) * V;
  const A0 = 1, A1 = W - 2, D0 = 1, D1 = Math.min(D - 2, 22);
  const theme = info.theme;
  const carpetA = theme === 'boutique' ? c.carpetRed : theme === 'business' ? c.carpetBlue : theme === 'sky' ? c.carpetCream : c.carpetRed;
  const wallC = theme === 'boutique' ? c.lilac : theme === 'business' ? c.powder : c.cream;
  const da = Math.floor(W / 2) - 2;
  if (touched) {
    // lobby: marble floor with a carpet runner to the desk, the desk to one side, the lift at the back
    f.box(g, A0, base, D0, A1, base + 10, D1, 0);
    f.box(g, 0, base, 0, W - 1, base + 10, 0, (a, yy) => (a >= da && a < da + 4 && yy <= base + 8 ? 0 : a === 0 || a === W - 1 || yy === base + 10 || yy < base + 2 || a === da - 1 || a === da + 4 ? c.woodDark : c.shopGlass));
    f.box(g, A0, base - 1, D0, A1, base - 1, D1, (a, _y, d) => (Math.abs(a - (da + 1.5)) < 2 ? carpetA : ((a >> 2) + (d >> 2)) % 2 ? c.marble : c.marbleGrey));
    f.box(g, A0, base, D1 + 1, A1, base + 10, D1 + 1, lined(ctx, f, (_a, yy) => (yy <= base + 3 ? c.woodDark : wallC)));
    f.box(g, A0, base + 11, D0, A1, base + 11, D1, c.cornice);
    // the name over the door in gold on blue, and a canopy
    f.box(g, 1, base + 11, -1, W - 2, base + 12, -1, (a, yy) => ((a + yy) % 3 === 0 && a > 2 && a < W - 3 ? c.gold : c.signBlue));
    f.box(g, da - 2, base + 9, -1, da + 5, base + 9, -5, c.signBlue);
    for (const a of [da - 2, da + 5]) f.box(g, a, base, -5, a, base + 8, -5, c.brass);
    // the flag on its pole by the door, flying along the front
    const [px, pz] = f.m(Math.max(1, da - 5), -1.5);
    b.place(turkishFlag(c), px, y, pz, f.turnOut);
    // the desk, the keys behind it, a sofa for waiting
    f.box(g, A0 + 3, base, D0 + 6, A0 + 5, base + 3, D0 + 12, c.woodDark);
    f.box(g, A0 + 3, base + 4, D0 + 6, A0 + 5, base + 4, D0 + 12, c.marble);
    f.box(g, A0 - 1, base + 4, D0 + 7, A0 - 1, base + 7, D0 + 11, (_a, yy, d) => ((yy + d) % 2 ? c.brass : c.woodDark));
    f.box(g, A1 - 2, base, D0 + 3, A1, base + 2, D0 + 8, c.carpetRed);
    // the lift doors at the back wall
    f.box(g, da, base, D1 + 1, da + 3, base + 8, D1 + 1, c.chrome);
    f.box(g, da + 1, base + 9, D1 + 1, da + 2, base + 9, D1 + 1, c.lampAmber);
    lobbyDressing(ctx, f, base, A0, A1, D0, D1, da);
    const [vx0, vz0] = f.xz(A0, D0), [vx1, vz1] = f.xz(A1, D1);
    b.indoor.push([Math.min(vx0, vx1), base, Math.min(vz0, vz1), Math.max(vx0, vx1), base + 10, Math.max(vz0, vz1)]);
    const [lx, lz] = f.m(W / 2, D1 / 2);
    b.lamp(lx, y + 2.4, lz, WHITEWARM, 6, 0.9);
    const [ex, ez] = f.m(da + 1.5, -3);
    b.lamp(ex, y + 2.1, ez, WARM, 5, 0.7);
  }
  { const [px, pz] = f.m(Math.max(1, da - 5), -1.5); b.block(px - 0.12, pz - 0.12, px + 0.12, pz + 0.12); }
  const [rx0, rz0] = f.m(A0 - 0.5, D0 - 0.5), [rx1, rz1] = f.m(A1 + 0.5, D1 + 0.5);
  const nth = b.roomCount.hotel = (b.roomCount.hotel ?? -1) + 1;
  const deskKeeper = f.m(A0 + 1.5, D0 + 9.5);
  const liftStand = f.m(da + 1.5, D1 - 1.5), liftPick = f.m(da + 1.5, D1 + 0.6);
  const bp = f.m(A0 + 4.5, D0 + 9.5);
  const lobby: RoomAnchor = {
    id: `hotel-${info.id}`, kind: 'hotel', nth, hotel: info.id,
    rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
    door: f.m(da + 1.5, 1.5),
    npcs: [{ role: 'keeper', pos: [deskKeeper[0], y, deskKeeper[1]], facing: Math.atan2(...dirOf(f, 1, 0)), sit: false, seed: lt.seed }],
    spots: [{ kind: 'buy', pos: [bp[0], y + 1.1, bp[1]], stand: f.m(A0 + 7.5, D0 + 9.5) }],
    lift: { stand: liftStand, pick: [liftPick[0], y + 1.2, liftPick[1]], facing: Math.atan2(...dirOf(f, 0, 1)) },
  };
  b.rooms.push(lobby);
  const [fx0, fz0] = f.m(-0.5, -0.5), [fx1, fz1] = f.m(W - 0.5, D - 0.5);
  const ha: HotelAnchor = { id: info.id, lobby: lobby.id, rect: [Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1)], entrance: lobby.door, rooms: [] };
  for (const spec of info.rooms) ha.rooms.push(guestRoom(ctx, f, lt, info.id, spec, touched, carpetA, wallC));
  b.hotels.push(ha);
}

/** A decorative İznik plate hung flat on a wall (the wall plane is at a): a coloured rim round a tulip. */
function iznikPlate(ctx: Ctx, f: Frame, a: number, y: number, d: number, seed: number): void {
  const { b, c } = ctx;
  const rim = [c.iznikBlue, c.cobalt, c.iznikTeal][Math.abs(seed) % 3];
  const mid = [c.iznikRed, c.iznikBlue, c.iznikGreen][Math.abs(seed >> 2) % 3];
  // round at this size: a cross of rim with the white field and the tulip at its heart
  f.box(b.grid, a, y, d + 1, a, y + 2, d + 1, rim);
  f.box(b.grid, a, y + 1, d, a, y + 1, d + 2, rim);
  f.box(b.grid, a, y + 1, d + 1, a, y + 1, d + 1, mid);
}

/** A potted palm: a copper pot and a fan of fronds, two voxels square. */
function pottedPalm(ctx: Ctx, f: Frame, a: number, y: number, d: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  f.box(g, a, y, d, a + 1, y + 2, d + 1, (_a, yy) => (yy === y + 2 ? c.soil : c.copper));
  f.box(g, a, y + 3, d, a, y + 5, d, c.trunk);
  for (let k = 0; k < 4; k++) {
    const [ea, ed] = [[-1, 0], [2, 1], [0, 2], [1, -1]][k];
    f.box(g, Math.min(a, a + ea), y + 6 + (k & 1), Math.min(d, d + ed), Math.max(a + 1, a + ea), y + 6 + (k & 1), Math.max(d + 1, d + ed), k % 2 ? c.leaf : c.leafLight);
  }
  f.box(g, a, y + 7, d, a + 1, y + 8, d + 1, c.leafDark);
}

/** A hanging Ottoman lantern of coloured glass on a brass chain, from the ceiling down to about two metres. */
function hangingLantern(ctx: Ctx, f: Frame, a: number, d: number, y: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  f.box(g, a, y + 9, d, a, y + 10, d, c.brass);
  const cols = [c.lampRed, c.lampBlue, c.lampAmber, c.lampGreen];
  // a little star of coloured glass round a brass heart, a drop of glass below
  f.box(g, a - 1, y + 8, d, a + 1, y + 8, d, (aa) => (aa === a ? c.brass : cols[(aa + d) & 3]));
  f.box(g, a, y + 8, d - 1, a, y + 8, d + 1, (_a, _y, dd) => (dd === d ? c.brass : cols[(dd + a + 1) & 3]));
  f.box(g, a, y + 7, d, a, y + 7, d, cols[(a + d) & 3]);
}

/**
 * The lobby made a lobby: an İznik tile band round the back wall, a calligraphy panel in gold, a coffee table
 * with a tea tray by the sofa, palms in the corners, and a coloured-glass lantern hanging over the runner.
 */
function lobbyDressing(ctx: Ctx, f: Frame, base: number, A0: number, A1: number, D0: number, D1: number, da: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  f.box(g, A0, base + 4, D1 + 1, A1, base + 5, D1 + 1, lined(ctx, f, (a, yy) => ((a + yy) % 2 ? c.iznikBlue : (a % 4 === 1 ? c.iznikRed : c.iznikWhite))));
  // the calligraphy: a gold-framed panel between the corner and the lift
  if (da - 3 > A0 + 3) f.box(g, A0 + 3, base + 6, D1 + 1, da - 3, base + 9, D1 + 1, lined(ctx, f, (a, yy) => (a === A0 + 3 || a === da - 3 || yy === base + 6 || yy === base + 9 ? c.gold : hash3(a, yy, 7) < 0.35 ? c.gold : c.leafDark)));
  // the coffee table with tulip glasses, in front of the sofa
  f.box(g, A1 - 5, base, D0 + 4, A1 - 4, base, D0 + 7, c.woodDark);
  f.box(g, A1 - 5, base + 1, D0 + 4, A1 - 4, base + 1, D0 + 7, c.brass);
  f.box(g, A1 - 5, base + 2, D0 + 5, A1 - 5, base + 2, D0 + 5, c.tea); f.box(g, A1 - 4, base + 2, D0 + 6, A1 - 4, base + 2, D0 + 6, c.tea);
  // cushions on the sofa, and its back against the wall
  f.box(g, A1, base + 3, D0 + 3, A1, base + 4, D0 + 8, c.carpetRed);
  f.box(g, A1 - 1, base + 3, D0 + 4, A1 - 1, base + 3, D0 + 4, c.carpetGold); f.box(g, A1 - 1, base + 3, D0 + 7, A1 - 1, base + 3, D0 + 7, c.carpetBlue);
  pottedPalm(ctx, f, A0, base, D1 - 1);
  pottedPalm(ctx, f, A1 - 1, base, D1 - 1);
  hangingLantern(ctx, f, da + 1, Math.round(D1 / 2), base);
  hangingLantern(ctx, f, da + 2, Math.round(D1 / 4), base);
}

/**
 * A guest room finished: a night table and its lamp by the bed, a wardrobe, a framed view of the Bosphorus on the
 * side wall and a coloured lantern from the ceiling.
 */
function guestDressing(ctx: Ctx, f: Frame, L: number, A0: number, A1: number, D0: number, D1: number, beds: number[], w: number, bedD: number, seed: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  // the night table: between the twins, or to the side of the double
  const na = beds[0] + w + 1;
  if (na + 1 <= A1) {
    f.box(g, na, L, bedD + 7, na + 1, L + 2, bedD + 8, c.woodDark);
    f.box(g, na, L + 3, bedD + 8, na, L + 3, bedD + 8, c.lampAmber);
  }
  // the wardrobe, by the door if there is depth for it behind the bed
  if (D1 - 3 > bedD + 9) f.box(g, A1 - 1, L, D1 - 3, A1, L + 8, D1, (_a, yy, d) => (yy === L + 8 ? c.cornice : (yy === L + 4 && (d === D1 - 2 || d === D1 - 1)) ? c.brass : c.woodDark));
  // the picture: a ferry on blue water under a pale sky, gold-framed, on the side wall above the kilim
  // (in fine voxels laid on the wall, like every painting in the game, so nothing of it shows outside)
  hangIn(b, picture(paintColors(b), 'bosphorus', 12, 8, seed), (a, d) => f.m(a, d), A0 - 0.5, D0 + 6.5, 1, 0, (L + 5 - G) * V);
  hangingLantern(ctx, f, Math.round((A0 + A1) / 2) - 3, Math.round((D0 + D1) / 2) - 3, L);
}

/** A unit direction in the lot's frame (along a, into d) as (dx, dz). */
function dirOf(f: Frame, da: number, dd: number): [number, number] {
  const [x0, z0] = f.m(0, 0), [x1, z1] = f.m(da, dd);
  const l = Math.hypot(x1 - x0, z1 - z0) || 1;
  return [(x1 - x0) / l, (z1 - z0) / l];
}

function guestRoom(ctx: Ctx, f: Frame, lt: LotPlan, hotelId: string, spec: { floor: number; type: HotelRoomAnchor['type']; price: number }, touched: boolean, carpetA: number, wallC: number): HotelRoomAnchor {
  const { b, c } = ctx;
  const g = b.grid;
  const W = f.W;
  const L = lt.base + spec.floor * 12;
  const Y = (L - G) * V;
  const A0 = 1, A1 = Math.min(W - 2, 24), D0 = 1, D1 = Math.min(f.D - 2, 21);
  const bedA = A1 - 7, bedD = D0 + 7;
  if (touched) {
    f.box(g, A0, L, D0, A1, L + 9, D1, 0);
    f.box(g, A0, L - 1, D0, A1, L - 1, D1, (a, _y, d) => ((a + d) % 5 === 0 ? c.carpetGold : carpetA));
    f.box(g, A0, L + 10, D0, A1, L + 10, D1, c.cornice);
    for (const [a0, d0, a1, d1] of [[A0, D1 + 1, A1, D1 + 1], [A0 - 1, D0, A0 - 1, D1], [A1 + 1, D0, A1 + 1, D1]] as const)
      f.box(g, a0, L, d0, a1, L + 9, d1, lined(ctx, f, (_a, yy) => (yy === L + 3 ? c.woodDark : wallC)));
    // the windows of this floor opened through to the street, curtains either side
    // glazing bars every 6 cells, set either side of the middle so the view from the window is a clear pane
    const mid = Math.round(A1 / 2);
    f.box(g, 3, L + 2, 0, A1 - 2, L + 8, 0, (a, yy) => (pm(a - mid, 6) === 3 ? c.woodDark : yy === L + 2 ? c.trim : c.glass));
    f.box(g, 2, L + 2, 1, 2, L + 8, 1, c.carpetRed); f.box(g, A1 - 1, L + 2, 1, A1 - 1, L + 8, 1, c.carpetRed);
    // the bed: a carved headboard at the back wall, white linen, a woven cover; a kilim and a chair
    const twin = spec.type === 'twin';
    const beds = twin ? [bedA - 4, bedA + 3] : [bedA];
    for (const a of beds) {
      const w = twin ? 3 : spec.type === 'single' ? 3 : 5;
      f.box(g, a, L, bedD, a + w, L + 1, bedD + 8, c.woodDark);
      f.box(g, a, L + 2, bedD, a + w, L + 2, bedD + 8, c.white);
      f.box(g, a, L + 2, bedD, a + w, L + 2, bedD + 4, (aa, _y, d) => ((aa + d) % 3 ? c.carpetRed : c.carpetGold));
      f.box(g, a, L + 3, bedD + 7, a + w, L + 3, bedD + 7, c.white);
      f.box(g, a, L, bedD + 9, a + w, L + 5, bedD + 9, c.woodDark);
    }
    f.box(g, A0 + 2, L - 1, D0 + 4, A0 + 7, L - 1, D0 + 9, (a, _y, d) => ((a + d) % 2 ? c.carpetBlue : c.carpetCream));
    // the door back down to the lobby, panelled, with a brass handle
    f.box(g, A0 + 1, L, D1 + 1, A0 + 3, L + 8, D1 + 1, (a, yy) => (yy === L + 4 && a === A0 + 3 ? c.brass : (yy - L) % 4 === 0 ? c.woodDark : c.door));
    f.box(g, A0, L, D0 + 12, A0 + 1, L + 3, D0 + 14, c.woodBare);
    f.box(g, A0, L + 4, D0 + 13, A0 + 1, L + 4, D0 + 13, c.tea);
    guestDressing(ctx, f, L, A0, A1, D0, D1, beds, twin ? 3 : spec.type === 'single' ? 3 : 5, bedD, lt.seed + spec.floor);
    const [vx0, vz0] = f.xz(A0, D0), [vx1, vz1] = f.xz(A1, D1);
    b.indoor.push([Math.min(vx0, vx1), L, Math.min(vz0, vz1), Math.max(vx0, vx1), L + 10, Math.max(vz0, vz1)]);
    const [lx, lz] = f.m((A0 + A1) / 2, (D0 + D1) / 2);
    b.lamp(lx, Y + 2.2, lz, WARM, 6, 0.8);
  }
  const [rx0, rz0] = f.m(A0 - 0.5, D0 - 0.5), [rx1, rz1] = f.m(A1 + 0.5, D1 + 0.5);
  const [vx0, vz0] = f.xz(A0, D0), [vx1, vz1] = f.xz(A1, D1);
  const ang = (from: [number, number], to: [number, number]) => Math.atan2(to[0] - from[0], to[1] - from[1]);
  const spawn = f.m(A0 + 2, D1 - 2);
  const doorPick = f.m(A0 + 2, D1 + 0.6);
  const bedStand = f.m(bedA - 1.5, bedD + 4), bedPick = f.m(bedA + 2, bedD + 4);
  const winStand = f.m(Math.round(A1 / 2), D0 + 1.5), winLook = f.m(Math.round(A1 / 2), D0 - 3);
  const teaStand = f.m(A0 + 3.5, D0 + 13.5), teaPick = f.m(A0 + 1.5, D0 + 13.5);
  return {
    id: `${hotelId}-${spec.floor}`, hotel: hotelId, floor: spec.floor, type: spec.type, price: spec.price, y: Y,
    rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
    vox: [Math.min(vx0, vx1), Math.min(vz0, vz1), Math.max(vx0, vx1), Math.max(vz0, vz1)],
    layer: L - G,
    spawn: [spawn[0], spawn[1], ang(spawn, f.m(A0 + 2, D1 - 6))],
    door: { stand: spawn, pick: [doorPick[0], Y + 1.2, doorPick[1]] },
    bed: { stand: bedStand, pick: [bedPick[0], Y + 0.7, bedPick[1]], facing: ang(bedStand, bedPick) },
    window: { stand: winStand, pick: [winStand[0], Y + 1.5, winStand[1]], facing: ang(winStand, winLook) },
    tea: { stand: teaStand, pick: [teaPick[0], Y + 1.1, teaPick[1]], facing: ang(teaStand, teaPick) },
    // the glass of the street windows (opened through above), clear from inside
    panes: [paneOf((a, d) => f.m(a, d), 3, A1 - 2, 0, (L + 2 - G) * V, (L + 9 - G) * V, 0.5)],
  };
}

// the bazaar halls and their shops are in world/bazaars.ts

// ------------------------------------------------------------------------------------------- mosques

/** A dome of radius r (voxels) centred at (cx, cz) springing from layer y: lead, ribbed, with a gold finial. */
function leadDome(g: SparseGrid, c: IC2, cx: number, cz: number, y: number, r: number, finial = true): void {
  for (let dy = 0; dy <= r; dy++)
    for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz, dy);
        if (d > r || d < r - 2) continue;
        const ang = Math.atan2(z + 0.5 - cz, x + 0.5 - cx);
        const rib = Math.floor((ang + Math.PI) / (Math.PI * 2) * 32) % 4 === 0;
        g.set(x, y + dy, z, rib ? c.leadLight : dy > r * 0.75 ? c.leadLight : c.lead);
      }
  if (finial) {
    g.box(Math.floor(cx), y + r + 1, Math.floor(cz), Math.floor(cx), y + r + 4, Math.floor(cz), c.gold);
    g.set(Math.floor(cx) + 1, y + r + 4, Math.floor(cz), c.gold);
  }
}

/** A minaret: a slender fluted shaft, one or two balconies, and a pointed lead cap with its crescent finial. */
function minaret(ctx: Ctx, cxM: number, czM: number, yM: number, h: number, balconies: number, follow?: number): void {
  const { b, c } = ctx;
  const g = b.grid;
  const cx = cxM / V, cz = czM / V, Y = layerOf(yM);
  b.occlude(Math.floor(cx - 4), Math.floor(cz - 4), Math.ceil(cx + 4), Math.ceil(cz + 4), yM + h * V + 4, yM + 0.95, 'landmark');
  Object.assign(b.occluders[b.occluders.length - 1], { floor: yM, follow });
  if (!g.touches(cx - 6, cz - 6, cx + 6, cz + 6)) return;
  const shaftR = 3.2;
  for (let y = 0; y < h; y++) {
    const balcony = Array.from({ length: balconies }, (_, i) => Math.round(h * (0.55 + i * 0.2))).find((by) => y >= by && y <= by + 2);
    for (let z = Math.floor(cz - 6); z <= cz + 6; z++)
      for (let x = Math.floor(cx - 6); x <= cx + 6; x++) {
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
        const R = y < 8 ? shaftR + 1 : shaftR;
        if (balcony !== undefined) {
          // the şerefe: a carved ring on corbels, a pierced parapet
          if (d <= R + 2 && (y === balcony || (d > R + 1 && pm(x + z + y, 2) === 0))) g.set(x, Y + y, z, c.marble);
          else if (d <= R) g.set(x, Y + y, z, c.lime);
          continue;
        }
        // the stalactite corbelling under each balcony, widening as it climbs
        const under = Array.from({ length: balconies }, (_, i) => Math.round(h * (0.55 + i * 0.2))).find((by) => y >= by - 4 && y < by);
        if (under !== undefined) {
          const k = y - (under - 4);
          if (d <= R + k * 0.5) g.set(x, Y + y, z, pm(Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 4) + k, 2) ? c.limeLight : c.marble);
          continue;
        }
        // the base: a square pedestal, then a band where it turns to the many-sided shaft
        const sq = Math.max(Math.abs(x + 0.5 - cx), Math.abs(z + 0.5 - cz));
        if (y < 12) { if (sq <= shaftR + 1.6) g.set(x, Y + y, z, y === 11 || y === 0 ? c.limeLight : sq > shaftR + 1.1 && y % 4 === 1 ? c.marble : c.limeDark); continue; }
        if (y < 14) { if (d <= R + 0.8) g.set(x, Y + y, z, c.limeLight); continue; }
        if (d <= R) g.set(x, Y + y, z, Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 3) % 2 ? c.lime : c.limeLight);
      }
  }
  // the cap
  for (let y = 0; y < 18; y++) {
    const R = shaftR * (1 - y / 18);
    for (let z = Math.floor(cz - 4); z <= cz + 4; z++) for (let x = Math.floor(cx - 4); x <= cx + 4; x++) if (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) <= R + 0.3) g.set(x, Y + h + y, z, c.lead);
  }
  g.box(Math.floor(cx), Y + h + 18, Math.floor(cz), Math.floor(cx), Y + h + 21, Math.floor(cz), c.gold);
  g.set(Math.floor(cx) + 1, Y + h + 21, Math.floor(cz), c.gold);
  b.lamp(cxM, yM + Math.round(h * 0.55) * V + 0.5, czM, [1, 0.9, 0.7], 5, 0.5);
}

/**
 * A mosque: the square prayer hall under a great dome on four half-domes, corner turrets, windows in rows and
 * the courtyard in front with its arcade of little domes and the fountain in the middle.
 */
function mosque(ctx: Ctx, id: string, rich: boolean, hall: readonly [number, number, number, number], court: readonly [number, number, number, number] | null, y: number, domeR: number, wallH: number, minarets: readonly (readonly number[])[] = []): number {
  const { b, c } = ctx;
  const g = b.grid;
  const X0 = Math.round(hall[0] / V), Z0 = Math.round(hall[1] / V), X1 = Math.round(hall[2] / V) - 1, Z1 = Math.round(hall[3] / V) - 1;
  const Y = layerOf(y);
  const H = Math.round(wallH / V);
  const cx = (X0 + X1 + 1) / 2, cz = (Z0 + Z1 + 1) / 2;
  const R = Math.round(domeR / V);
  // the prayer hall is walked into through its great door like a shop: the cutaway opens it 6 m over the carpet
  b.occlude(X0, Z0, X1, Z1, y + wallH + domeR + 6, y + 0.95, 'landmark');
  const hallOcc = b.occluders.length - 1;
  Object.assign(b.occluders[hallOcc], { floor: y, room: HALL_ROOM, walls: mosqueWalls(H) });
  // the walls: grey stone in courses, two rows of arched windows, a band of cornice
  // bays of three metres from each corner: under each a grilled window in a marble frame with a red and white
  // relieving arch, above it a pair of tall lights in coloured glass, an oculus higher still; pilasters between
  // the bays, a moulded band at mid-height, the cornice and a cresting of little merlons along the top
  const hallBay = (u: number, lo: number) => pm(u - lo, 12);
  const up = H - 16;
  const DY = Y + H + 1;
  const semi = R * 0.8;
  const semis: [number, number][] = [[cx, Z0 + semi * 0.6], [cx, Z1 + 1 - semi * 0.6], [X0 + semi * 0.6, cz], [X1 + 1 - semi * 0.6, cz]];
  const doorZ = court ? (court[1] >= hall[3] - 0.5 ? Z1 : Z0) : Z1;
  const wallCell = (x: number, yy: number, z: number) => {
    const u = x === X0 || x === X1 ? z : x;
    const bb = hallBay(u, x === X0 || x === X1 ? Z0 : X0);
    const row = yy - Y;
    if (row < 2) return c.limeDark;
    if (row >= H - 1) return c.limeLight;
    if (row === H - 2) return pm(u, 2) ? c.marble : c.limeLight;
    if (row === 16) return c.limeLight;
    if (bb === 0 || bb === 11) return row % 4 === 0 ? c.limeLight : c.lime;
    // the lower window and its arch
    if (bb >= 4 && bb <= 7 && row >= 4 && row <= 11) return bb === 4 || bb === 7 || row === 4 || row === 11 ? c.marble : row % 2 === 0 || bb === 5 ? c.iron : c.glassDark;
    if (row >= 12 && row <= 14 && Math.abs(bb - 5.5) <= 2.5 - (row - 12)) return (bb + row) % 2 ? c.brick : c.marble;
    // the paired lights
    if (row >= up && row <= up + 8 && (bb === 3 || bb === 4 || bb === 7 || bb === 8)) {
      if (row === up || row === up + 8) return c.marble;
      const pane = row - up;
      return pane >= 6 && (bb === 3 || bb === 7) === (pane === 7) ? c.marble : pane % 3 === 0 ? c.lampAmber : (bb + pane) % 2 ? c.glassLit : c.iznikBlue;
    }
    if (row >= up && row <= up + 8 && (bb === 2 || bb === 9)) return c.marble;
    // the oculus
    if (row >= up + 11 && row <= up + 12 && (bb === 5 || bb === 6)) return c.glassLit;
    if (row >= up + 10 && row <= up + 13 && bb >= 4 && bb <= 7) return c.marble;
    return (row >> 1) % 4 === 0 ? c.limeLight : c.lime;
  };
  // the windows the inside must leave open: the grilles below, the coloured lights and oculi above
  const windowCols = new Set([c.iron, c.glassDark, c.glassLit, c.lampAmber, c.iznikBlue]);
  if (g.touches(X0 - 4, Z0 - 4, X1 + 4, Z1 + 4)) {
    g.box(X0, Y, Z0, X1, Y + H, Z1, (x, yy, z) => (x === X0 || x === X1 || z === Z0 || z === Z1 ? wallCell(x, yy, z) : c.limeDark));
    // the pilasters stand a little proud of the wall; the cresting runs along the top
    for (let x = X0; x <= X1; x++) for (const [z, zo] of [[Z0, Z0 - 1], [Z1, Z1 + 1]] as const) {
      if (hallBay(x, X0) === 0 || hallBay(x, X0) === 11) g.box(x, Y, zo, x, Y + H - 3, zo, (_x, yy) => ((yy - Y) % 4 === 0 ? c.limeLight : c.lime));
      if (pm(x, 3) === 0) g.set(x, Y + H + 1, z, c.limeLight);
    }
    for (let z = Z0; z <= Z1; z++) for (const [x, xo] of [[X0, X0 - 1], [X1, X1 + 1]] as const) {
      if (hallBay(z, Z0) === 0 || hallBay(z, Z0) === 11) g.box(xo, Y, z, xo, Y + H - 3, z, (_x, yy) => ((yy - Y) % 4 === 0 ? c.limeLight : c.lime));
      if (pm(z, 3) === 0) g.set(x, Y + H + 1, z, c.limeLight);
    }
    // the drum and the dome, four half-domes leaning on it, little domes on the corners, weight turrets
    for (let yy = 0; yy < 8; yy++)
      for (let z = Math.floor(cz - R - 1); z <= cz + R + 1; z++)
        for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
          const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
          if (d > R + 0.5 || d < R - 1.5) continue;
          const win = yy >= 2 && yy <= 5 && Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 24 / Math.PI) % 2 === 0;
          g.set(x, DY + yy, z, win ? c.glassLit : c.lime);
        }
    // buttresses round the drum, stepping down onto the roof between the windows
    for (let k = 0; k < 16; k++) {
      const ang = (k + 0.5) * Math.PI / 8, ca = Math.cos(ang), sa = Math.sin(ang);
      for (let dr = 1; dr <= 3; dr++) for (let yy = 0; yy < 8 - dr * 2; yy++) g.set(Math.floor(cx + ca * (R + dr)), DY + yy, Math.floor(cz + sa * (R + dr)), yy === 7 - dr * 2 ? c.limeLight : c.lime);
    }
    leadDome(g, c, cx, cz, DY + 8, R);
    // the alem on the crown: a gilded stem with three balls and the crescent
    { const ax = Math.floor(cx), az = Math.floor(cz), top = DY + 8 + R;
      for (const [yb, rr] of [[2, 1], [5, 1], [8, 0]] as const) g.box(ax - rr, top + yb, az - rr, ax + rr, top + yb + (rr ? 1 : 0), az + rr, c.gold);
      g.box(ax, top + 1, az, ax, top + 10, az, c.gold);
      g.set(ax - 1, top + 11, az, c.gold); g.set(ax + 1, top + 11, az, c.gold); g.set(ax - 1, top + 12, az, c.gold); g.set(ax + 1, top + 12, az, c.gold); }
    for (const [sx, sz] of semis) leadDome(g, c, sx, sz, DY - 2, Math.round(semi * 0.75), false);
    for (const [qx, qz] of [[X0 + 6, Z0 + 6], [X1 - 5, Z0 + 6], [X0 + 6, Z1 - 5], [X1 - 5, Z1 - 5]]) {
      leadDome(g, c, qx, qz, DY, 6, true);
      g.box(Math.floor(qx) - 1, DY, Math.floor(qz) - 1, Math.floor(qx) + 1, DY + 1, Math.floor(qz) + 1, c.lime);
    }
    for (const [tx, tz] of [[cx - R - 2, cz - R - 2], [cx + R + 1, cz - R - 2], [cx - R - 2, cz + R + 1], [cx + R + 1, cz + R + 1]]) {
      g.box(Math.floor(tx), DY, Math.floor(tz), Math.floor(tx) + 2, DY + 10, Math.floor(tz) + 2, c.lime);
      leadDome(g, c, Math.floor(tx) + 1.5, Math.floor(tz) + 1.5, DY + 11, 2, true);
    }
    // the great door in the courtyard wall, under its stalactite niche
    const dz = doorZ;
    g.box(Math.floor(cx) - 3, Y, dz, Math.floor(cx) + 2, Y + 12, dz, (x, yy) => (yy > Y + 9 ? ((x + yy) % 2 ? c.marble : c.limeLight) : c.woodDark));
    g.box(Math.floor(cx) - 5, Y + 13, dz, Math.floor(cx) + 4, Y + 18, dz, (x, yy) => ((x + yy) % 3 === 0 ? c.iznikBlue : c.marble));
  }
  // inside, carved out of the shell once it stands (anchors in every worker): the door is on the court side
  // (Z1 for both mosques), the qibla wall at Z0
  if (doorZ === Z1) mosqueInterior(b, {
    id, X0, Z0, X1, Z1, Y, H, cx, cz, R, DY, rich,
    semis: semis.map(([sx, sz]) => [sx, sz, Math.round(semi * 0.75)] as [number, number, number]),
    door: [Math.floor(cx) - 3, Math.floor(cx) + 2],
    // (a minaret built against the wall leaves no window there)
    opening: (x, yy, z) => windowCols.has(wallCell(x, yy, z)) && !minarets.some(([mx, mz]) => Math.hypot(x + 0.5 - mx / V, z + 0.5 - mz / V) < 6),
    upper: (yy) => yy - Y >= up,
    clear: c.glassLit,
    stone: c.lime, lead: c.lead,
  });
  else b.block(hall[0], hall[1], hall[2], hall[3]);
  if (doorZ === Z1) b.occluders[hallOcc].air = b.halls[b.halls.length - 1].rect;
  // floodlights from below, the way Istanbul lights its mosques at night
  b.lamp(hall[0] - 2, y + 2, (hall[1] + hall[3]) / 2, [1, 0.9, 0.75], 14, 0.7);
  b.lamp(hall[2] + 2, y + 2, (hall[1] + hall[3]) / 2, [1, 0.9, 0.75], 14, 0.7);
  b.lamp((hall[0] + hall[2]) / 2, y + wallH + domeR, (hall[1] + hall[3]) / 2, [1, 0.88, 0.7], 16, 0.6);
  if (!court) return hallOcc;
  // the courtyard: an arcade of little domes on marble columns round three sides, the fountain in the middle
  const CX0 = Math.round(court[0] / V), CZ0 = Math.round(court[1] / V), CX1 = Math.round(court[2] / V) - 1, CZ1 = Math.round(court[3] / V) - 1;
  const AD = 14;
  b.occlude(CX0, CZ0, CX1, CZ1, y + 7, y + 0.95, 'landmark');
  Object.assign(b.occluders[b.occluders.length - 1], { floor: y, follow: hallOcc });
  const fx = (CX0 + CX1 + 1) / 2, fz = (CZ0 + CZ1 + 1) / 2;
  b.block((fx - 6) * V, (fz - 6) * V, (fx + 6) * V, (fz + 6) * V);
  if (!g.touches(CX0 - 2, CZ0 - 2, CX1 + 2, CZ1 + 2)) return hallOcc;
  // the bays of the arcade run from the corners, the last one on each side taking up whatever is left; walls,
  // columns, arches and domes all keep to them
  const bays = (lo: number, hi: number) => { const out: number[] = []; for (let v = lo; v + AD <= hi + 1; v += AD) out.push(v); if (out.length && out[out.length - 1] + AD <= hi) out.push(hi + 1 - AD); return out; };
  const xs = bays(CX0, CX1), zs = bays(CZ0, CZ1);
  const gateHi = court[1] >= hall[3] - 0.5;
  const inBay = (v: number, list: number[]) => { let s0 = list[0]; for (const q of list) if (q <= v) s0 = q; return v - s0; };
  /**
   * The crown gate: a tall portal standing above the courtyard wall, its pointed arch under a hood of stalactites in
   * marble, the inscription panel in gold on blue above, a cresting along its top.
   */
  const portal = (x: number, z: number, dx: number) => {
    const ad = Math.abs(dx);
    g.box(x, Y, z, x, Y + 27, z, (_xx, yy) => {
      const row = yy - Y;
      const archTop = 12 + Math.round(Math.sqrt(Math.max(0, 16 - dx * dx)) * 0.9);
      if (ad < 4 && row < archTop) return 0;
      if (row === 27) return ad < 7 && Math.round(dx + 8) % 2 === 0 ? c.limeLight : 0; // the cresting
      if (row === 26) return c.limeLight;
      if (ad >= 6.5) return row % 4 === 0 ? c.marble : c.limeLight; // the frame
      if (row >= 22 && row <= 24) return (Math.round(dx * 2) + row) % 3 === 0 ? c.gold : c.cobalt; // the inscription
      if (row === 21 || row === 25) return c.marble;
      if (ad < 5.5 && row >= archTop && row <= 20) return (Math.floor(ad) + row) % 2 ? c.marble : row > 17 ? c.limeLight : c.marbleGrey; // the stalactite hood
      return c.marble;
    });
  };
  for (let z = CZ0; z <= CZ1; z++)
    for (let x = CX0; x <= CX1; x++) {
      const inner = x >= CX0 + AD && x <= CX1 - AD && z >= CZ0 + AD && z <= CZ1 - AD;
      const outer = x === CX0 || x === CX1 || z === CZ0 || z === CZ1;
      const nearHall = court[1] >= hall[3] - 0.5 ? z < CZ0 + AD : z > CZ1 - AD;
      if (inner || (nearHall && outer)) continue;
      if (outer) {
        // the outer wall up to the arcade's roof, so its domes show above it from the street: under each dome a
        // tall grilled window in a marble frame with a pointed relieving arch, a small arched light above it
        const gateSide = court[1] >= hall[3] - 0.5 ? z === CZ1 : z === CZ0;
        const dx = x + 0.5 - fx;
        if (gateSide && Math.abs(dx) < 8) { portal(x, z, dx); continue; }
        const bay = x === CX0 || x === CX1 ? inBay(z, zs) : inBay(x, xs);
        g.box(x, Y, z, x, Y + 16, z, (_xx, yy) => {
          const row = yy - Y;
          if (row === 16) return c.leadDark;
          if (row === 15) return c.limeLight;
          if (bay === 0 || bay === AD - 1) return row < 2 ? c.limeDark : c.lime; // the pier between bays
          const inWin = bay >= 5 && bay <= 8;
          if (inWin && row >= 3 && row <= 8) return (bay === 5 || bay === 8 || row === 3 || row === 8) ? c.marble : row % 2 === 0 || bay === 6 ? c.iron : c.glassDark;
          if (bay >= 4 && bay <= 9 && (row === 9 || row === 10)) return row === 10 && (bay === 4 || bay === 9) ? c.lime : (bay + row) % 2 ? c.marble : c.paintRed;
          if ((bay === 6 || bay === 7) && row >= 11 && row <= 13) return row === 13 ? c.marble : c.glassLit;
          return row < 2 ? c.limeDark : (row >> 1) % 4 === 0 ? c.limeLight : c.lime;
        });
        // the wall in relief, one stone proud of it: pilasters on the piers with their capitals, a moulded frame
        // and sill round each window under its arch, a string course and the eave along the top
        const ox = x === CX0 ? -1 : x === CX1 ? 1 : 0, oz = ox ? 0 : z === CZ0 ? -1 : 1;
        const px = x + ox, pz = z + oz;
        for (let row = 0; row <= 16; row++) {
          let v = 0;
          if (row === 16) v = c.leadDark;
          else if (row === 14) v = c.limeLight;
          else if (bay === 0 || bay === AD - 1) v = row === 13 ? c.marble : row < 2 ? c.limeDark : c.lime;
          else if (row === 3 && bay >= 4 && bay <= 9) v = c.marble;
          else if ((bay === 4 || bay === 9) && row >= 4 && row <= 9) v = c.marbleGrey;
          else if (row === 10 && bay >= 5 && bay <= 8) v = (bay + row) % 2 ? c.marble : c.paintRed;
          else if (row === 11 && (bay === 6 || bay === 7)) v = c.marbleGrey;
          if (v && !g.get(px, Y + row, pz)) g.set(px, Y + row, pz, v);
        }
        continue;
      }
      // columns at the inner edge every 14 voxels, the arcade roof of little domes above
      const ix = x === CX0 + AD - 1 || x === CX1 - AD + 1, iz = z === CZ0 + AD - 1 || z === CZ1 - AD + 1;
      const k = ix ? inBay(z, zs) : inBay(x, xs);
      if ((ix || iz) && k === 0) g.box(x, Y, z, x, Y + 13, z, c.marble);
      else if (ix || iz) {
        // pointed arches from column to column, their voussoirs in red and white stone
        const m = Math.min(k, AD - k);
        g.box(x, Y + 9 + Math.round(4 * Math.sqrt(m / (AD / 2))), z, x, Y + 13, z, (xx, yy, zz) => ((xx + zz + (yy >> 1)) % 2 ? c.brick : c.marble));
      }
      g.box(x, Y + 14, z, x, Y + 16, z, c.lime);
    }
  // the arcade's domes, one over each bay, each on a low drum so the row of them reads above the outer wall
  for (const z of zs) for (const x of xs) {
    const sideBay = x === xs[0] || x === xs[xs.length - 1];
    const gateBay = gateHi ? z === zs[zs.length - 1] : z === zs[0];
    const hallBay = gateHi ? z < CZ0 + AD : z > CZ1 - AD;
    // the hall's portico, the son cemaat yeri, takes a row of domes too
    if (!(gateBay || sideBay || hallBay)) continue;
    const ox = x + AD / 2, oz = z + AD / 2;
    for (let yy = 0; yy < 2; yy++) for (let zz = Math.floor(oz - 6); zz <= oz + 6; zz++) for (let xx = Math.floor(ox - 6); xx <= ox + 6; xx++) {
      const d = Math.hypot(xx + 0.5 - ox, zz + 0.5 - oz);
      if (d <= 6 && d > 4.5) g.set(xx, Y + 17 + yy, zz, yy === 1 && Math.floor((Math.atan2(zz + 0.5 - oz, xx + 0.5 - ox) + Math.PI) * 8 / Math.PI) % 2 ? c.glassDark : c.lime);
    }
    leadDome(g, c, ox, oz, Y + 19, 6, true);
  }
  // the şadırvan: an octagonal fountain with taps all round under a wide eaved roof on columns
  for (let yy = 0; yy < 22; yy++) for (let z = Math.floor(fz - 7); z <= fz + 7; z++) for (let x = Math.floor(fx - 7); x <= fx + 7; x++) {
    const d = Math.max(Math.abs(x + 0.5 - fx), Math.abs(z + 0.5 - fz), (Math.abs(x + 0.5 - fx) + Math.abs(z + 0.5 - fz)) * 0.72);
    if (yy < 5 && d <= 4) g.set(x, Y + yy, z, yy === 4 ? c.marbleGrey : c.marble);
    else if (yy < 5 && d <= 4.6 && yy === 1 && (x + z) % 3 === 0) g.set(x, Y + yy, z, c.brass);
    else if (yy >= 5 && yy < 14 && d > 5.6 && d <= 6.2 && (x + z) % 5 === 0) g.set(x, Y + yy, z, c.marble);
    else if (yy >= 14 && yy < 17 && d <= 7 - (yy - 14) * 0.4) g.set(x, Y + yy, z, yy === 14 ? c.woodDark : c.lead);
    else if (yy >= 17 && d <= 3.5 - (yy - 17) * 0.6) g.set(x, Y + yy, z, c.lead);
  }
  b.lamp(fx * V, y + 3, fz * V, WARM, 7, 0.7);
  return hallOcc;
}

function yeniCami(ctx: Ctx): void {
  const yeni = mosque(ctx, 'yeni', true, YENI.hall, YENI.court, YENI_Y, 6.5, 9);
  minaret(ctx, YENI.court[0] - 0.6, YENI.hall[3] + 0.6, YENI_Y, 104, 2, yeni);
  minaret(ctx, YENI.court[2] + 0.6, YENI.hall[3] + 0.6, YENI_Y, 104, 2, yeni);
  // the plinth's stone faces down to the square, and its steps
  const { b, c } = ctx;
  const g = b.grid;
  const X0 = Math.round((YENI.hall[0] - 0.5) / V), X1 = Math.round((YENI.hall[2] + 0.5) / V), Z0 = Math.round((YENI.hall[1] - 0.5) / V), Z1 = Math.round(YENI.court[3] / V);
  if (g.touches(X0, Z0, X1, Z1)) {
    for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
      if (edge && !g.get(x, layerOf(YENI_Y), z) && Math.abs((x + 0.5) * V - 6) > 3.2) g.box(x, layerOf(QUAY_Y), z, x, layerOf(YENI_Y) - 1, z, c.limeDark);
    }
  }
  b.place(lampPost(c), 2.4, QUAY_Y, 31.6); b.lamp(2.4, QUAY_Y + 3.8, 31.6, WARM, 6, 0.8);
  b.place(lampPost(c), 9.6, QUAY_Y, 31.6); b.lamp(9.6, QUAY_Y + 3.8, 31.6, WARM, 6, 0.8);
}

const HAZIRE_TREES: [number, number][] = [[-143.5, -32.1], [-131, -30.3], [-125.4, -33]];

function suleymaniye(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const minarets = [[-147, -5, 124], [-127, -5, 124], [-147, 11, 100], [-127, 11, 100]] as const;
  const suley = mosque(ctx, 'suleymaniye', false, SULEY.hall, SULEY.court, HILLTOP_Y, 8.5, 11, minarets);
  for (const [x, z, h] of minarets) minaret(ctx, x, z, HILLTOP_Y, h, h > 110 ? 2 : 1, suley);
  // the precinct wall with its windows, gates on the east and to the terrace
  const [px0, pz0, px1, pz1] = SULEY.precinct;
  const X0 = Math.round(px0 / V), Z0 = Math.round(pz0 / V), X1 = Math.round(px1 / V) - 1, Z1 = Math.round(pz1 / V) - 1;
  const Y = layerOf(HILLTOP_Y);
  if (g.touches(X0, Z0, X1, Z1)) {
    for (let z = Z0; z <= Z1; z++) for (let x = X0; x <= X1; x++) {
      if (x !== X0 && x !== X1 && z !== Z0 && z !== Z1) continue;
      const mx = (x + 0.5) * V, mz = (z + 0.5) * V;
      const gate = (x === X1 && Math.abs(mz + 10) < 2.5) || (z === Z1 && Math.abs(mx + 137) < 2.5) || (z === Z1 && Math.abs(mx + 120) < 2) ;
      if (gate) continue;
      // grilled openings in marble frames under red and white arches, a string course, a coping of lead
      g.box(x, plan.walk[col(x, z)], z, x, Y + 10, z, (xx, y, zz) => {
        const u = pm(xx + zz, 12), row = y - Y;
        if (row === 10) return c.lead;
        if (row === 9) return c.limeLight;
        if (row > 3 && row < 7 && u < 4) return row === 4 || pm(xx + zz + y, 2) === 0 ? c.iron : 0;
        if ((row === 3 || row === 7) && u < 4) return c.marble;
        if ((u === 4 || u === 11) && row >= 3 && row <= 7) return c.marble;
        if (row === 8 && (u < 4 || u === 4 || u === 11)) return (u + row) % 2 ? c.brick : c.marble;
        if (row === 1) return c.limeLight;
        return row < 1 ? c.limeDark : u === 8 ? c.limeLight : c.lime;
      });
      b.block(mx - 0.13, mz - 0.13, mx + 0.13, mz + 0.13);
    }
  }
  // the garden: cypresses and plane trees, a small tomb (türbe) with its own dome
  for (const [x, z] of [[-154, -30], [-154, -14], [-154, 2], [-118, -30], [-118, -20], [-156, 8]]) b.place(cypress(c, x * 7 + z), x, HILLTOP_Y, z);
  b.place(planeTree(c, 9, true), -120, HILLTOP_Y, 4);
  const tx = Math.round(-154 / V), tz = Math.round(-22 / V);
  b.occlude(tx - 12, tz - 12, tx + 12, tz + 12, HILLTOP_Y + 7, HILLTOP_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = HILLTOP_Y;
  if (g.touches(tx - 14, tz - 14, tx + 14, tz + 14)) {
    for (let yy = 0; yy < 18; yy++) for (let z = tz - 10; z <= tz + 10; z++) for (let x = tx - 10; x <= tx + 10; x++) {
      const d = Math.max(Math.abs(x - tx), Math.abs(z - tz), (Math.abs(x - tx) + Math.abs(z - tz)) * 0.72);
      if (d <= 9) g.set(x, Y + yy, z, yy > 5 && yy < 12 && (x + z) % 4 === 0 && d > 8 ? c.glass : yy % 6 === 0 ? c.limeLight : c.lime);
    }
    leadDome(g, c, tx + 0.5, tz + 0.5, Y + 18, 8);
  }
  b.block(-157, -25, -151, -19);
  // the hazire behind the qibla wall: rows of headstones in the grass among cypresses and roses
  const r = rng(1557);
  for (let z0 = Math.round(-33.6 / V); z0 <= Math.round(-27.4 / V); z0++) for (let x = Math.round(-148 / V); x <= Math.round(-126 / V); x++)
    if (g.get(x, Y - 1, z0) && !g.get(x, Y, z0)) g.set(x, Y - 1, z0, hash3(x, 5, z0) < 0.3 ? c.clover : hash3(x, 6, z0) < 0.08 ? c.gravel : c.grass);
  for (const z of [-33, -31.2, -29.4, -27.8]) for (let x = -147.4; x < -126.5; x += 0.9 + r() * 0.6) {
    if (r() < 0.3 || Math.abs(x + 137) < 1.3 || HAZIRE_TREES.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < 1.1)) continue; // gaps, and the path down the middle to the tomb gate
    const j = (r() - 0.5) * 0.25;
    b.place(headstone(c, Math.floor(r() * 1e4)), x, HILLTOP_Y, z + j, 0);
    b.block(x - 0.2, z + j - 0.1, x + 0.2, z + j + 0.1);
  }
  for (const [x, z] of HAZIRE_TREES) b.place(cypress(c, Math.round(x * 3 + z), 28), x, HILLTOP_Y, z);
  for (const [x, z] of [[-139.4, -28.6], [-134.6, -28.6], [-146.6, -30.3]]) b.place(pottedPlant(c, Math.round(-x)), x, HILLTOP_Y, z);
  // the terrace: a stone balustrade on the Horn side, the tea garden's tables under the plane trees
  const [tx0, tz0, tx1, tz1] = SULEY.terrace;
  const BZ = Math.round(tz1 / V) - 1;
  if (g.touches(Math.round(tx0 / V), BZ - 2, Math.round(tx1 / V), BZ + 2))
    for (let x = Math.round(tx0 / V); x < Math.round(tx1 / V); x++) g.box(x, Y, BZ, x, Y + 3, BZ, (_x, y) => (y === Y + 3 ? c.marble : x % 3 === 0 ? c.lime : 0));
  b.block(tx0, tz1 - 0.3, tx1, tz1);
  for (let i = 0; i < 7; i++) {
    const x = -154 + i * 5.5, z = 17.8 + (i % 2) * 1.6;
    if (Math.abs(x + 137) < 2.5) continue;
    b.place(teaTable(c, i), x, HILLTOP_Y, z);
    b.block(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
    for (const s of [-1, 1]) { b.place(tabure(c, c.woodBare), x + s * 0.6, HILLTOP_Y, z); b.stools.push([x + s * 0.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, HILLTOP_Y]); }
    b.lamp(x, HILLTOP_Y + 1, z, WARM, 2.5, 0.4);
  }
  for (const x of [-150, -128, -116]) b.place(planeTree(c, x, false), x, HILLTOP_Y, 14.5);
  for (const x of [-155, -142, -131, -118]) { b.place(lampPost(c), x, HILLTOP_Y, 21); b.lamp(x, HILLTOP_Y + 3.8, 21, WARM, 7, 0.8); }
  void tx0; void tz0;
}

/** Sirkeci station: the terminus of the Orient Express, red brick banded with stone, a rose window, two clock towers. */
function station(ctx: Ctx): void {
  const { b, c } = ctx;
  const g = b.grid;
  const [sx0, sz0, sx1, sz1] = STATION;
  const X0 = Math.round(sx0 / V), Z0 = Math.round(sz0 / V), X1 = Math.round(sx1 / V) - 1, Z1 = Math.round(sz1 / V) - 1;
  const Y = layerOf(QUAY_Y);
  b.occlude(X0, Z0, X1, Z1, QUAY_Y + 12, QUAY_Y + 0.95, 'landmark');
  b.occluders[b.occluders.length - 1].floor = QUAY_Y;
  b.block(sx0, sz0, sx1, sz1);
  if (!g.touches(X0 - 2, Z0 - 2, X1 + 2, Z1 + 2)) return;
  g.box(X0, Y, Z0, X1, Y + 34, Z1, (x, y, z) => {
    const edge = x === X0 || x === X1 || z === Z0 || z === Z1;
    if (!edge) return c.brickDark;
    const row = y - Y, u = x === X0 || x === X1 ? z : x;
    if (row >= 6 && row <= 16 && pm(u, 10) >= 3 && pm(u, 10) <= 6) return row > 14 ? c.limeLight : c.glassLit;
    if (row >= 21 && row <= 28 && pm(u, 10) >= 4 && pm(u, 10) <= 5) return c.glass;
    return (row >> 1) % 3 === 0 ? c.limeLight : c.brick;
  });
  g.box(X0, Y + 35, Z0, X1, Y + 35, Z1, c.leadDark);
  // the rose window over the main door on the avenue side, and the door
  const cz = (Z0 + Z1) >> 1;
  for (let yy = -6; yy <= 6; yy++) for (let zz = -6; zz <= 6; zz++) { const d = Math.hypot(yy, zz); if (d <= 6) g.set(X0, Y + 24 + yy, cz + zz, d > 5 ? c.limeLight : (Math.round(Math.atan2(yy, zz) * 4) % 2 ? c.iznikBlue : c.lampAmber)); }
  g.box(X0, Y, cz - 4, X0, Y + 12, cz + 3, (_x, y) => (y > Y + 10 ? c.limeLight : c.woodDark));
  // two clock towers with little lead cones
  for (const tz of [Z0 + 4, Z1 - 4]) {
    g.box(X0 - 1, Y, tz - 4, X0 + 7, Y + 50, tz + 4, (_x, y) => ((y - Y) >> 1) % 3 === 0 ? c.limeLight : c.brick);
    g.box(X0 - 1, Y + 40, tz - 2, X0 - 1, Y + 44, tz + 2, c.white);
    g.set(X0 - 2, Y + 42, tz, c.iron);
    for (let y = 0; y < 10; y++) g.box(X0 - 1 + y / 2, Y + 51 + y, tz - 4 + y / 2, X0 + 7 - y / 2, Y + 51 + y, tz + 4 - y / 2, c.lead);
  }
  b.lamp(sx0 - 1, QUAY_Y + 3, (sz0 + sz1) / 2, WARM, 8, 0.8);
  // the flag over the station, flying out over the avenue
  b.place(turkishFlag(c), (sx0 + sx1) / 2, QUAY_Y + 36 * V, (sz0 + sz1) / 2, 2);
}

// ------------------------------------------------------------------------------------------- water, bridge, square

/** The quays: fish boats at Eminönü, ferries at their piers, rowing boats along the Horn, benches and lamps. */
function waterfront(ctx: Ctx): void {
  const { b, c } = ctx;
  const g = b.grid;
  // the three fish boats tied up side by side, their tables and low stools on the quay
  for (let i = 0; i < 3; i++) {
    const x = -6 + i * 7;
    b.place(fishBoat(c, i), x, -0.35, HORN_Z + 2.2, 0);
    b.emitters.push({ kind: 'smoke', pos: [x, 1.6, HORN_Z + 1.6], rate: 1 });
    b.lamp(x, 2.6, HORN_Z + 2, WARM, 6, 0.9);
  }
  for (let i = 0; i < 6; i++) {
    const x = -8 + i * 3.4, z = 41.4;
    b.place(teaTable(c, i + 20), x, QUAY_Y, z);
    b.block(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
    for (const s of [-1, 1]) { b.place(tabure(c, [c.hullBlue, c.hullRed, c.hullYellow][i % 3]), x + s * 0.6, QUAY_Y, z); b.stools.push([x + s * 0.6, z, s > 0 ? -Math.PI / 2 : Math.PI / 2, QUAY_Y]); }
  }
  // ferries at the Kadıköy and Üsküdar piers, a smaller one at the Horn pier
  const pier = (x0: number, z: number, along: 'x' | 'z') => {
    // the pier's terminal: a little timber pavilion with a curved roof, its ticket window lit
    const vx = Math.round(x0 / V), vz = Math.round(z / V);
    const [X0, Z0, X1, Z1] = along === 'x' ? [vx + 4, vz - 14, vx + 36, vz + 14] : [vx - 14, vz + 4, vx + 14, vz + 36];
    b.occlude(X0, Z0, X1, Z1, QUAY_Y + 7, QUAY_Y + 0.95, 'building');
    b.occluders[b.occluders.length - 1].floor = QUAY_Y;
    if (!g.touches(X0, Z0, X1, Z1)) return;
    const Y = layerOf(QUAY_Y);
    for (let zz = Z0; zz <= Z1; zz++) for (let xx = X0; xx <= X1; xx++) {
      const edge = xx === X0 || xx === X1 || zz === Z0 || zz === Z1;
      const passage = along === 'x' ? Math.abs(zz - vz) < 10 : Math.abs(xx - vx) < 10;
      if (edge && !passage) g.box(xx, Y, zz, xx, Y + 11, zz, (_x, y) => (y > Y + 3 && y < Y + 9 && (xx + zz) % 5 ? c.glass : y < Y + 2 ? c.woodDark : c.hullWhite));
      else if (edge) g.box(xx, Y + 11, zz, xx, Y + 11, zz, c.hullWhite);
      const u = along === 'x' ? Math.abs(zz - vz) : Math.abs(xx - vx);
      g.set(xx, Y + 12 + Math.max(0, 3 - (u >> 2)), zz, c.leadLight);
      if (u > 12) g.set(xx, Y + 12, zz, c.ferryBand);
    }
  };
  // the Eminönü terminal sits astride the quay and the root of the jetty out to its landing stage
  pier(26.75, -2, 'x'); pier(32, -46, 'x'); pier(-52, 46, 'z');
  b.place(vapur(c), 44.5, -2.0, -11.5, 1);
  b.place(vapur(c), 44.5, -2.0, -55.5, 1);
  b.place(vapur(c), -43, -2.0, 57.5, 0);
  // rowing boats along the Horn
  for (let i = 0; i < 9; i++) { const x = -150 + i * 9 + (i % 3); if (Math.abs(x + 52) < 6 || Math.abs(x + 100) < 3) continue; b.place(kayik(c, i), x, -0.6, HORN_Z + 1.1, 0); }
  // lamps and benches along both quays, bollards at the edge
  for (let x = -154; x < -20; x += 9) {
    b.place(lampPost(c), x, QUAY_Y, HORN_Z - 1.2); b.lamp(x, QUAY_Y + 3.8, HORN_Z - 1.2, WARM, 7, 0.8);
    b.place(bench(b.k), x + 4.5, QUAY_Y, HORN_Z - 1.4, 2); b.benches.push([x + 4.5, HORN_Z - 1.4, 0, QUAY_Y]);
    b.block(x + 3.6, HORN_Z - 1.8, x + 5.4, HORN_Z - 1);
  }
  for (let z = -106; z < -12; z += 9) {
    if (Math.abs(z + 46) < 6) continue;
    b.place(lampPost(c), BOS_X - 1.2, QUAY_Y, z); b.lamp(BOS_X - 1.2, QUAY_Y + 3.8, z, WARM, 7, 0.8);
    b.place(bench(b.k), BOS_X - 1.4, QUAY_Y, z + 4.5, 1); b.benches.push([BOS_X - 1.4, z + 4.5, Math.PI / 2, QUAY_Y]);
    b.block(BOS_X - 1.8, z + 3.6, BOS_X - 1, z + 5.4);
  }
  promenade(ctx);
}

/** Things already standing near the promenade (m), that its lamps, benches and trees keep their distance from. */
const SQUARE_THINGS: [number, number][] = [[24.5, 12], [24.5, 26], [24, 32], [17, 28], [22, 24], [23.2, 8], [14, 33], [11, 35], [22.5, -0.5], [18, 36]];

/**
 * The promenade round Eminönü's point (see COAST): lamps every nine metres a step back from the edge and benches
 * between them looking out over the water, plane trees in round planters, bollards where the boats tie up, the
 * stairs' cheek walls and lifebuoys, rowing boats at the stairs, and the landing stages with their gangways, the
 * tour boat at the Horn stage and its shelter.
 */
function promenade(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const Q = layerOf(QUAY_Y);
  const taken: [number, number, number][] = SQUARE_THINGS.map(([x, z]) => [x, z, 1.5]);
  const free = (x: number, z: number, r: number) => taken.every(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) >= r + tr);
  const quayAt = (x: number, z: number) => {
    const ci = col(Math.floor(x / V), Math.floor(z / V)), k = plan.kind[ci];
    return (k === K.Quay || k === K.Square) && plan.walk[ci] === Q && !landingStep(x, z);
  };
  const clearOf = (x: number, z: number, m: number) =>
    !LANDINGS.some(({ rect: [x0, z0, x1, z1] }) => x > x0 - m && x < x1 + m && z > z0 - m && z < z1 + m) &&
    !PONTOONS.some(({ gang: [x0, z0, x1, z1] }) => x > x0 - m && x < x1 + m && z > z0 - m - 1 && z < z1 + m) &&
    !(x > 26 && z > -7 && z < 3.5);
  // the planters first: plane trees at the point and down the Bosphorus side
  for (const [x, z, seed] of [[31, 44.2, 71], [33, 34, 72], [31.2, 27.2, 73], [30.4, 6.4, 74]] as const) {
    if (!quayAt(x, z) || !free(x, z, 1.2)) continue;
    b.place(planter(c), x, QUAY_Y, z);
    b.place(planeTree(c, seed, true), x, QUAY_Y + 0.25, z);
    b.block(x - 0.85, z - 0.85, x + 0.85, z + 0.85);
    taken.push([x, z, 1.6]);
  }
  // lamps and benches, walking the outline from the landing stairs round the point to Sirkeci
  let run = 0, next = 1.5;
  for (let i = 3; i + 1 < COAST.length && COAST[i][1] > -14; i++) {
    const [ax, az] = COAST[i], [bx, bz] = COAST[i + 1], len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len, nx = uz, nz = -ux; // n points inland
    for (; next < run + len; next += 0.5) {
      const t = next - run, px = ax + ux * t, pz = az + uz * t;
      const phase = ((next % 9) + 9) % 9;
      if (phase < 0.25 || phase >= 8.75) {
        const x = px + nx * 1.2, z = pz + nz * 1.2;
        if (!quayAt(x, z) || !clearOf(x, z, 0.8) || !free(x, z, 1.4)) continue;
        b.place(lampPost(c), x, QUAY_Y, z); b.lamp(x, QUAY_Y + 3.8, z, WARM, 7, 0.8);
        b.block(x - 0.2, z - 0.2, x + 0.2, z + 0.2);
        taken.push([x, z, 0.4]);
      } else if (phase >= 4.25 && phase < 4.75) {
        const x = px + nx * 1.7, z = pz + nz * 1.7;
        if (!quayAt(x, z) || !clearOf(x, z, 1.2) || !free(x, z, 1.3)) continue;
        // the bench faces the water: along whichever axis the shore faces more
        const north = Math.abs(nz) >= Math.abs(nx), turns = north ? (nz < 0 ? 2 : 0) : nx < 0 ? 1 : 3;
        const face = north ? (nz < 0 ? 0 : Math.PI) : nx < 0 ? Math.PI / 2 : -Math.PI / 2;
        b.place(bench(b.k), x, QUAY_Y, z, turns); b.benches.push([x, z, face, QUAY_Y]);
        if (north) b.block(x - 0.9, z - 0.4, x + 0.9, z + 0.4); else b.block(x - 0.4, z - 0.9, x + 0.4, z + 0.9);
        taken.push([x, z, 1]);
      }
    }
    run += len;
  }
  // bollards along the fish boats' basin, and at the rowing boats' moorings in the bay
  // (on the kerb, a voxel up, where they stand on the edge row)
  const kerb = (x: number, z: number) => {
    const vx = Math.floor(x / V), vz = Math.floor(z / V);
    return [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => plan.kind[col(vx + dx, vz + dz)] === K.Sea) ? V : 0;
  };
  const moor = (x: number, z: number, rope: boolean) => { b.place(bollard(c, rope), x, QUAY_Y + kerb(x, z), z); b.block(x - 0.2, z - 0.2, x + 0.2, z + 0.2); };
  for (let x = -10.6; x < 11; x += 2.4) moor(x, HORN_Z - 0.15, Math.abs(x - 1) % 7 < 2.4);
  for (const [x, z] of [[33.8, 13.4], [34.6, 24.6]] as const) if (quayAt(x - 0.3, z)) moor(x, z, true);
  // the stairs into the water: granite cheek walls either side, a lifebuoy at the top, a rowing boat at the foot
  for (const { rect: [x0, z0, x1, z1], dir } of LANDINGS) {
    const cheeks: Rect[] = dir === 'n' ? [[x0, z0, x0 + 0.5, z1], [x1 - 0.5, z0, x1, z1]] : [[x0, z0, x1, z0 + 0.5], [x0, z1 - 0.5, x1, z1]];
    for (const [cx0, cz0, cx1, cz1] of cheeks) {
      const X0 = Math.round(cx0 / V), Z0 = Math.round(cz0 / V), X1 = Math.round(cx1 / V) - 1, Z1 = Math.round(cz1 / V) - 1;
      if (g.touches(X0, Z0, X1, Z1)) g.box(X0, Q, Z0, X1, Q + 2, Z1, (xx, y, zz) => (y === Q + 2 ? c.quayEdge : blockWall(c, xx, y, zz)));
      b.block(cx0, cz0, cx1, cz1);
    }
    const [lx, lz] = dir === 'n' ? [x0 - 0.5, z0 - 0.4] : [x0 - 0.4, z0 - 0.5];
    b.place(lifebuoy(c), lx, QUAY_Y, lz, dir === 'n' ? 0 : 1); b.block(lx - 0.3, lz - 0.2, lx + 0.3, lz + 0.2);
  }
  b.place(kayik(c, 11), 16.8, -0.6, HORN_Z + 3.2, 0);
  b.place(kayik(c, 12), 34.9, -0.6, 17.6, 1);
  b.place(kayik(c, 13), 35.0, -0.6, 21.4, 1);
  // the landing stages: lifebuoys at the corners, the Horn stage's shelter, and the tour boat alongside it
  for (const { deck: [x0, z0, x1, z1], dir } of PONTOONS) {
    const pts: [number, number][] = dir === 'n' ? [[x0 + 0.4, z0 + 0.35], [x1 - 0.4, z0 + 0.35]] : [[x0 + 0.35, z0 + 0.4], [x0 + 0.35, z1 - 0.4]];
    for (const [x, z] of pts) { b.place(lifebuoy(c), x, PONTOON_Y, z, dir === 'n' ? 2 : 3); b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3); }
  }
  {
    const [x0, z0, x1, z1] = PONTOONS[0].deck, Y = layerOf(PONTOON_Y);
    // a canopy on iron posts over the middle of the stage, its fascia in the city lines' blue, a bench under it
    const X0 = Math.round(21.5 / V), X1 = Math.round(27.5 / V) - 1, Z0 = Math.round((z0 + 0.25) / V), Z1 = Math.round((z1 - 0.25) / V) - 1;
    if (g.touches(X0, Z0, X1, Z1)) {
      for (const x of [X0, X1]) for (const z of [Z0, Z1]) g.box(x, Y, z, x, Y + 10, z, c.ironGreen);
      g.box(X0 - 1, Y + 11, Z0 - 1, X1 + 1, Y + 11, Z1 + 1, (xx, _y, zz) => (xx === X0 - 1 || xx === X1 + 1 || zz === Z0 - 1 || zz === Z1 + 1 ? c.ferryBand : c.leadLight));
      g.box(X0 + 2, Y + 12, Z0 + 1, X1 - 2, Y + 12, Z1 - 1, c.leadLight);
    }
    b.place(bench(b.k), 24.5, PONTOON_Y, z0 + 0.7, 2); b.benches.push([24.5, z0 + 0.7, 0, PONTOON_Y]); b.block(23.6, z0 + 0.3, 25.4, z0 + 1.1);
    b.lamp(24.5, PONTOON_Y + 2.6, (z0 + z1) / 2, WARM, 6, 0.8);
    b.place(tourBoat(c), (x0 + x1) / 2, -1.5, z1 + 2.05, 0);
    for (const x of [x0 + 0.6, x1 - 0.6]) { b.place(bollard(c, true), x, PONTOON_Y, z1 - 0.3); b.block(x - 0.2, z1 - 0.5, x + 0.2, z1 - 0.1); }
  }
  {
    const [, z0, x1, z1] = PONTOONS[1].deck;
    for (const z of [z0 + 0.8, z1 - 0.8]) { b.place(bollard(c, true), x1 - 0.3, PONTOON_Y, z); b.block(x1 - 0.5, z - 0.2, x1 - 0.1, z + 0.2); }
    b.lamp(39.2, PONTOON_Y + 2.6, -2, WARM, 6, 0.7);
  }
}

/** The Galata Bridge: a wide deck on piers, its rails lined with fishermen's rods and buckets, lamps all along. */
function bridge(ctx: Ctx): void {
  const { b, c } = ctx;
  const g = b.grid;
  const X0 = Math.round(-22.5 / V), X1 = Math.round(-13.5 / V) - 1, Z0 = Math.round((HORN_Z - 0.5) / V), Z1 = VZ0 + SZ - 1;
  const Y = layerOf(1.5);
  if (g.touches(X0 - 2, Z0, X1 + 2, Z1)) {
    // piers under the deck every 10 m
    for (let z = Z0 + 16; z < Z1; z += 40) g.box(X0 + 2, layerOf(-6), z, X1 - 2, Y - 2, z + 5, (xx, y, zz) => blockWall(c, xx, y, zz));
    g.box(X0, Y - 2, Z0, X1, Y - 2, Z1, c.granite);
    // the tram rails down the middle of the deck, kerbs for the pavements either side
    for (let z = Z0; z <= Z1; z++) for (const x of [X0 + 14, X0 + 20, X1 - 20, X1 - 14]) g.set(x, Y - 1, z, c.rail);
    for (let z = Z0; z <= Z1; z++) for (const x of [X0 + 6, X1 - 6]) g.set(x, Y - 1, z, c.kerb);
  }
  for (let z = HORN_Z + 2; z < 64; z += 6) {
    for (const x of [-22.2, -13.8]) { b.place(lampPost(c), x, 1.5, z); b.lamp(x, 5.3, z, WARM, 7, 0.8); }
  }
  // fishing rods leaning out over the rail, a bucket by each fisherman's spot
  for (const { x, y, z, side, tone } of rodSpots()) {
    const rod = new Prop(2, 26, 2, 0.125);
    for (let i = 0; i < 26; i++) rod.set(i < 13 ? 0 : 1, i, 0, i > 22 ? c.hullRed : c.iron);
    b.place(rod, x + side * 0.15, y, z, side < 0 ? 3 : 1);
    const bucket = new Prop(3, 3, 3, 0.125);
    bucket.box(0, 0, 0, 2, 2, 2, [c.hullBlue, c.hullRed, c.white][tone]);
    bucket.set(1, 2, 1, c.marbleGrey);
    b.place(bucket, x - side * 0.5, y, z + 0.4);
  }
}

type RodSpot = { x: number; y: number; z: number; side: number; tone: number; angler: boolean };

/**
 * The rods along the Galata Bridge's rails and the Bosphorus quay's edge: the side it leans over (-1 west, +1
 * east), the bucket's colour, and whether its angler is standing at it. The quay's spots keep clear of the lamps
 * and benches (a lamp every nine metres, a bench four and a half past it) and of the ferry piers.
 */
function rodSpots(): RodSpot[] {
  const r = rng(53), out: RodSpot[] = [];
  for (let z = HORN_Z + 3.5; z < BRIDGE_GATE_Z - 0.5; z += 1.7) for (const side of [-1, 1]) {
    if (r() < 0.35) continue;
    out.push({ x: side < 0 ? -21.9 : -14.1, y: 1.5, z, side, tone: Math.floor(r() * 3), angler: r() < 0.6 });
  }
  const q = rng(57);
  for (let z0 = -106; z0 < 36; z0 += 9) for (const dz of [2.2, 7.0]) {
    const z = z0 + dz;
    if (Math.abs(z + 46) < 7 || z > -14 || q() < 0.35) continue;
    out.push({ x: BOS_X - 0.6, y: QUAY_Y, z, side: 1, tone: Math.floor(q() * 3), angler: q() < 0.7 });
  }
  return out;
}

/** The anglers standing at their rods, looking out over the Horn and the Bosphorus. */
function anglers(): { pos: [number, number, number]; face: number; seed: number }[] {
  return rodSpots().filter((s) => s.angler && Math.abs(s.z - 58) > 1.5).map((s, i) => ({
    pos: [s.x - s.side * 0.8, s.y, s.z - 0.3] as [number, number, number], face: s.side < 0 ? -Math.PI / 2 : Math.PI / 2, seed: 7100 + i * 7,
  }));
}

/** The tea garden on the Bosphorus shore, between the tram avenue and the quay (metres). */
const TEA_GARDEN = [17.4, -108, 22.4, -86] as const;

/**
 * The çay bahçesi: two plane trees over rows of little tables, low stools either side of each, a counter with
 * the samovar at the top of the garden and its çaycı behind it, lamps at both ends.
 */
function teaGarden(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  const [x0, z0, x1, z1] = TEA_GARDEN;
  const gy = (x: number, z: number) => (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
  const xm = (x0 + x1) / 2;
  for (const z of [z0 + 5, z1 - 6]) { b.place(planeTree(c, Math.round(-z * 7), true), xm, gy(xm, z), z); b.block(xm - 0.5, z - 0.5, xm + 0.5, z + 0.5); }
  let i = 0;
  for (let z = z0 + 2.5; z < z1 - 3; z += 2.6) for (const x of [x0 + 1.2, x1 - 1.2]) {
    const y = gy(x, z);
    b.place(teaTable(c, 300 + i), x, y, z);
    b.block(x - 0.35, z - 0.35, x + 0.35, z + 0.35);
    for (const s of [-1, 1]) b.place(tabure(c, i % 3 === 0 ? c.carpetRed : c.woodBare), x, y, z + s * 0.6);
    i++;
  }
  // the counter with the samovar and a rack of tulip glasses
  const cz = z1 - 1.2, Y = plan.walk[col(Math.floor(xm / V), Math.floor(cz / V))];
  const X0 = Math.round((xm - 1) / V), X1 = Math.round((xm + 1) / V) - 1, Z0 = Math.round((cz - 0.25) / V), Z1 = Math.round((cz + 0.25) / V) - 1;
  if (g.touches(X0, Z0, X1, Z1)) {
    g.box(X0, Y, Z0, X1, Y + 2, Z1, c.woodDark);
    g.box(X0, Y + 3, Z0, X1, Y + 3, Z1, c.marble);
    for (let x = X0; x <= X1; x += 2) g.set(x, Y + 4, Z1, c.tea);
  }
  b.place(samovar(c), xm + 0.6, (Y + 4 - G) * V, cz);
  b.block(xm - 1, cz - 0.3, xm + 1, cz + 0.3);
  b.lamp(xm, (Y - G) * V + 2.4, cz, WARM, 5, 0.8);
  for (const z of [z0 + 0.6, z1 - 3]) { b.place(lampPost(c), x0 + 0.3, gy(x0 + 0.3, z), z); b.lamp(x0 + 0.3, gy(x0 + 0.3, z) + 3.8, z, WARM, 7, 0.8); b.block(x0 + 0.1, z - 0.2, x0 + 0.5, z + 0.2); }
}

/** The çaycı behind his counter at the top of the tea garden, looking down the rows. */
function teaGardenFolk(): { pos: [number, number, number]; face: number; seed: number }[] {
  const [x0, , x1, z1] = TEA_GARDEN;
  return [{ pos: [(x0 + x1) / 2, QUAY_Y, z1 - 0.5], face: Math.PI, seed: 7311 }];
}

/** Eminönü square: pigeons' seed sellers, the shoeshine man, benches, lamps, the simit trays. */
function square(ctx: Ctx): void {
  const { b, c } = ctx;
  b.place(seedTable(c), 11, QUAY_Y, 35); b.block(10.3, 34.5, 11.7, 35.5);
  b.place(seedTable(c), -2, QUAY_Y, 33.5); b.block(-2.7, 33, -1.3, 34);
  b.place(shoeshine(c), 22, QUAY_Y, 24); b.block(21.5, 23.6, 22.5, 24.4);
  // the women selling seed for the pigeons, and the shoeshine man by his brass box
  ctx.keepers.push({ pos: [11, QUAY_Y, 36.1], face: Math.PI, seed: 611 }, { pos: [-2, QUAY_Y, 34.6], face: Math.PI, seed: 617 }, { pos: [22.9, QUAY_Y, 24.2], face: -Math.PI / 2, seed: 619 });
  for (const [x, z] of [[20.5, 6], [20.5, 18], [-8, 31.5], [24, 32]] as const) { b.place(bench(b.k), x, QUAY_Y, z, 1); b.benches.push([x, z, Math.PI / 2, QUAY_Y]); b.block(x - 0.4, z - 0.9, x + 0.4, z + 0.9); }
  for (const [x, z] of [[17, 2], [17, 28], [-10, 38], [24.5, 12], [24.5, 26]] as const) { b.place(lampPost(c), x, QUAY_Y, z); b.lamp(x, QUAY_Y + 3.8, z, WARM, 7, 0.9); }
  for (const [x, z] of [[22.5, -0.5], [-10.5, 41]] as const) { b.place(planeTree(c, x * 13 + z, true), x, QUAY_Y, z); b.block(x - 0.5, z - 0.5, x + 0.5, z + 0.5); }
}

/** The tram line through Sirkeci: rails in the setts, a stop with its shelter, and a tram waiting at it. */
function tramLine(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const g = b.grid;
  for (const s of plan.segs) {
    if (s.kind !== K.Tram) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    for (let t = 0; t <= len; t += V * 0.5) {
      const f = t / len, x = ax + (bx - ax) * f, z = az + (bz - az) * f, y = ay + (by - ay) * f;
      for (const off of [-1.6, -0.6, 0.6, 1.6]) {
        const vx = Math.floor((x + off) / V), vz = Math.floor(z / V);
        if (g.touches(vx, vz, vx, vz)) g.set(vx, layerOf(y) - 1, vz, c.rail);
      }
    }
  }
  // the Sirkeci stop: a shelter either side, the tram waiting in the down track
  const sy = hillY(12, -30);
  const stopY = Math.round(sy * 4) / 4;
  for (const x of [8.2, 15.8]) {
    const shelter = new Prop(8, 22, 40, 0.125);
    shelter.box(0, 0, 0, 0, 20, 0, c.iron); shelter.box(0, 0, 39, 0, 20, 39, c.iron); shelter.box(7, 0, 0, 7, 20, 0, c.iron); shelter.box(7, 0, 39, 7, 20, 39, c.iron);
    shelter.box(0, 21, 0, 7, 21, 39, c.tramRed);
    shelter.box(7, 6, 1, 7, 18, 38, c.cartGlass);
    shelter.box(1, 4, 4, 5, 4, 35, c.chrome);
    b.place(shelter, x, stopY, -30, x < 12 ? 0 : 2);
    b.lamp(x, stopY + 2.4, -30, WHITEWARM, 5, 0.6);
  }
  b.place(tram(c), 12 + 1.1, hillY(12, -31) - 0.1, -31, 1);
  b.block(12.1, -45, 14.3, -17.5);
}

/** Trees on the slopes and in the courtyards, flowers in the gardens; benches and cats' houses in the lanes. */
function greenery(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const r = rng(808);
  for (let i = 0; i < 520; i++) {
    const x = VX0 + 8 + Math.floor(r() * (SX - 16)), z = VZ0 + 8 + Math.floor(r() * (SZ - 16));
    const kind = r(), seed = Math.floor(r() * 1e5);
    const ci = col(x, z);
    if (plan.kind[ci] !== K.Ground && plan.kind[ci] !== K.Park) continue;
    if (x * V > TEA_GARDEN[0] - 1 && x * V < TEA_GARDEN[2] + 1 && z * V > TEA_GARDEN[1] - 1 && z * V < TEA_GARDEN[3] + 1) continue;
    // a clear patch of ground round it
    let ok = true;
    for (let dz = -6; dz <= 6 && ok; dz += 3) for (let dx = -6; dx <= 6 && ok; dx += 3) { const nc = col(x + dx, z + dz); if (plan.kind[nc] !== plan.kind[ci] || Math.abs(plan.walk[nc] - plan.walk[ci]) > 2) ok = false; }
    if (!ok) continue;
    const y = (plan.walk[ci] - G) * V, mx = x * V, mz = z * V;
    if (kind < 0.18) b.place(planeTree(c, seed, kind < 0.05), mx, y, mz);
    else if (kind < 0.36) b.place(cypress(c, seed, 24 + Math.floor(r() * 14)), mx, y, mz);
    else if (kind < 0.5) b.place(judasTree(c, seed), mx, y, mz);
    else if (kind < 0.64) b.place(figTree(c, seed), mx, y, mz);
    else if (kind < 0.82) b.place(bush(b.k, seed), mx, y, mz);
    else b.place(grassTuft(b.k, seed), mx, y, mz);
    if (kind < 0.64) b.block(mx - 0.3, mz - 0.3, mx + 0.3, mz + 0.3);
  }
  // flower beds of tulips in the hilltop garden and the courtyards' corners
  const g = b.grid;
  for (let z = Math.round(SULEY.precinct[1] / V); z < Math.round(SULEY.precinct[3] / V); z++)
    for (let x = Math.round(SULEY.precinct[0] / V); x < Math.round(SULEY.precinct[2] / V); x++) {
      const ci = col(x, z);
      if (plan.kind[ci] !== K.Park || !g.touches(x, z, x, z)) continue;
      if (hash3(x >> 3, 5, z >> 3) < 0.25 && hash3(x, 6, z) < 0.5) g.set(x, plan.walk[ci], z, hash3(x, 7, z) < 0.6 ? c.tulip : c.tulipY);
    }
}

/** Life along the streets: lamps, café tables out front, produce, cats' houses, the odd bench. */
function streetLife(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const r = rng(4242);
  // keep the doorways of the shops and hotels clear
  const doors = b.rooms.map((rm) => rm.door);
  const nearDoor = (x: number, z: number) => doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < 2.6);
  let fountains = 0, juices = 0;
  for (const s of plan.segs) {
    if (s.kind !== K.Lane && s.kind !== K.Street && s.kind !== K.Stair && s.kind !== K.Tram) continue;
    const [ax, , az] = s.a, [bx, , bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 3 + r() * 3; t < len - 2; t += 8 + r() * 5) {
      const f = t / len, side = r() < 0.5 ? 1 : -1;
      const off = s.w / 2 - 0.25;
      const x = ax + (bx - ax) * f + nx * off * side, z = az + (bz - az) * f + nz * off * side;
      if (beyond(x, z)) continue;
      const y = (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
      const vx = Math.floor((x + nx * side * 0.6) / V), vz = Math.floor((z + nz * side * 0.6) / V);
      const beside = plan.lot[col(vx, vz)];
      if (beside) b.place(wallLantern(c), x, y + 2.6, z, faceTurn(-nx * side, -nz * side));
      else if (!nearDoor(x, z)) { b.place(lampPost(c), x, y, z); b.block(x - 0.2, z - 0.2, x + 0.2, z + 0.2); }
      b.lamp(x, y + 2.7, z, WARM, 6, 0.75);
      // across the way: something of the street's life against the wall
      const ex = ax + (bx - ax) * f - nx * off * side, ez = az + (bz - az) * f - nz * off * side;
      const ey = (plan.walk[col(Math.floor(ex / V), Math.floor(ez / V))] - G) * V;
      if (Math.abs(ey - y) > 0.6 || nearDoor(ex, ez) || beyond(ex, ez) || CATS.some(([cx, , cz]) => Math.hypot(cx - ex, cz - ez) < 1.6)) continue;
      const turn = faceTurn(nx * side, nz * side);
      const pick = r();
      if (s.kind === K.Street || s.kind === K.Tram) {
        if (pick < 0.35) { b.place(produce(c, Math.floor(r() * 1e4)), ex, ey, ez, turn); b.block(ex - 0.8, ez - 0.8, ex + 0.8, ez + 0.8); }
        else if (pick < 0.5 && s.w >= 5 && juices < 10 && Math.min(Math.abs(nx), Math.abs(nz)) < 0.15) {
          // a juice stand out from the wall, its seller between it and the wall
          juices++;
          const jx = ex + nx * side * 1.2, jz = ez + nz * side * 1.2;
          b.place(juiceStand(c, Math.floor(r() * 1e4)), jx, ey, jz, turn);
          const hx = Math.abs(nx) * 0.5 + Math.abs(nz) * 0.85, hz = Math.abs(nz) * 0.5 + Math.abs(nx) * 0.85;
          b.block(jx - hx, jz - hz, jx + hx, jz + hz);
          ctx.keepers.push({ pos: [ex + nx * side * 0.3, ey, ez + nz * side * 0.3], face: Math.atan2(nx * side, nz * side), seed: 700 + juices });
        } else if (pick < 0.6) {
          b.place(teaTable(c, Math.floor(r() * 1e4)), ex, ey, ez); b.block(ex - 0.35, ez - 0.35, ex + 0.35, ez + 0.35);
          const ux = (bx - ax) / len, uz = (bz - az) / len;
          for (const k of [-1, 1]) { const sx = ex + ux * 0.6 * k, sz = ez + uz * 0.6 * k; b.place(tabure(c, c.woodBare), sx, ey, sz); b.stools.push([sx, sz, Math.atan2(-ux * k, -uz * k), ey]); }
        }
      } else {
        if (pick < 0.25) { b.place(catHouse(c), ex, ey, ez, turn); b.block(ex - 0.5, ez - 0.5, ex + 0.5, ez + 0.5); }
        else if (pick < 0.45) { b.place(bench(b.k), ex, ey, ez, faceTurn(nx * side, nz * side) % 2 ? 1 : 0); b.benches.push([ex, ez, Math.atan2(nx * side, nz * side), ey]); b.block(ex - 0.5, ez - 0.5, ex + 0.5, ez + 0.5); }
      }
      // and between this and the next: pots by the doors, blade signs, a scooter, now and then a fountain
      const tt = t + 3.5 + r() * 2;
      if (tt < len - 2) between(s, tt / len, nx, nz, len);
    }
  }

  function between(s: (typeof plan.segs)[number], f: number, nx: number, nz: number, len: number): void {
    const [ax, , az] = s.a, [bx, , bz] = s.b;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    for (const side of [1, -1]) {
      const off = s.w / 2 - 0.3;
      const x = ax + (bx - ax) * f + nx * off * side, z = az + (bz - az) * f + nz * off * side;
      const y = (plan.walk[col(Math.floor(x / V), Math.floor(z / V))] - G) * V;
      const wall = plan.lot[col(Math.floor((x + nx * side * 0.6) / V), Math.floor((z + nz * side * 0.6) / V))];
      if (!wall || nearDoor(x, z) || beyond(x, z)) continue;
      const out = faceTurn(-nx * side, -nz * side);
      const pick = r();
      if (pick < 0.4) {
        // a pair of pots against the wall
        for (const k of [-0.45, 0.45]) { const px = x + ux * k, pz = z + uz * k; b.place(pottedPlant(c, Math.floor(r() * 1e4)), px, y, pz); b.block(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3); }
      } else if (pick < 0.72) {
        // a blade sign up on the wall, swinging a little
        b.place(bladeSign(c, Math.floor(r() * 1e4)), x - nx * side * 0.1, y + 2.5, z - nz * side * 0.1, out);
      } else if (pick < 0.86 && (s.kind === K.Street || s.kind === K.Tram)) {
        b.place(scooter(c, Math.floor(r() * 1e4)), x - nx * side * 0.2, y, z - nz * side * 0.2, faceTurn(ux, uz));
        b.block(x - 0.8, z - 0.8, x + 0.8, z + 0.8);
      } else if (pick < 0.93 && fountains < 9 && s.kind !== K.Stair && s.w >= 3) {
        fountains++;
        b.place(cesme(c), x + nx * side * 0.05, y, z + nz * side * 0.05, out);
        b.block(x - 0.95, z - 0.95, x + 0.95, z + 0.95);
      }
    }
  }
}

/** Washing on lines across the narrow lanes, house to house, high enough to walk under. */
function washingLines(ctx: Ctx): void {
  const { b, c, plan } = ctx;
  const r = rng(909);
  const g = b.grid;
  const cols = [c.white, c.powder, c.rose, c.yellow, c.awnBlue, c.cream, c.awnRed];
  const lotAt = (x: number, z: number) => inMap(Math.floor(x / V), Math.floor(z / V)) ? plan.lot[col(Math.floor(x / V), Math.floor(z / V))] : 0;
  for (const s of plan.segs) {
    const street = s.kind === K.Street;
    if (s.kind !== K.Lane && s.kind !== K.Stair && !street) continue;
    const [ax, ay, az] = s.a, [bx, by, bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    const nx = -(bz - az) / len, nz = (bx - ax) / len;
    for (let t = 2 + r() * 4; t < len - 2; t += street ? 9 + r() * 5 : 3 + r() * 4) {
      if (r() < 0.25) continue;
      const f = t / len, cx = ax + (bx - ax) * f, cz = az + (bz - az) * f, y = ay + (by - ay) * f;
      let d1 = -1, d2 = -1, l1 = 0, l2 = 0;
      for (let d = s.w / 2 - 0.5; d < s.w / 2 + 2.6 && d1 < 0; d += 0.25) if ((l1 = lotAt(cx + nx * d, cz + nz * d))) d1 = d;
      for (let d = s.w / 2 - 0.5; d < s.w / 2 + 2.6 && d2 < 0; d += 0.25) if ((l2 = lotAt(cx - nx * d, cz - nz * d))) d2 = d;
      if (d1 < 0 || d2 < 0) continue;
      const hi = Math.min(plan.lots[l1 - 1].top, plan.lots[l2 - 1].top) - 3;
      const lo = Math.max(layerOf(y + 3.2), plan.lots[l1 - 1].base + 14, plan.lots[l2 - 1].base + 14);
      if (hi < lo) continue;
      const x0 = cx + nx * d1, z0 = cz + nz * d1, x1 = cx - nx * d2, z1 = cz - nz * d2;
      const Y = Math.min(hi, Math.max(lo, layerOf(y + 4.3 + r() * 0.8)));
      const span = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(span / (V * 0.5));
      const ax2 = (x1 - x0) / span, az2 = (z1 - z0) / span;
      // the cells the line runs through, then the washing pegged along it: shirts and towels two cells wide with
      // a gap between, a long sheet now and then, each swinging on its own from the line
      const cells: [number, number][] = [];
      for (let i = 0; i <= n; i++) {
        const k = i / n, vx = Math.floor((x0 + (x1 - x0) * k) / V), vz = Math.floor((z0 + (z1 - z0) * k) / V);
        const lc = cells[cells.length - 1];
        if (!lc || lc[0] !== vx || lc[1] !== vz) cells.push([vx, vz]);
      }
      for (const [vx, vz] of cells) if (!g.get(vx, Y, vz)) g.set(vx, Y, vz, c.iron);
      if (street) {
        // over the shopping streets, strings of little flags instead: red and white pennants, the odd crescent
        for (let j = 1; j < cells.length - 1; j += 2) {
          const [vx, vz] = cells[j];
          if (!g.touches(vx, vz, vx, vz)) continue;
          const id = b.addSway({ ...SWAY.laundry, pivot: [(vx + 0.5) * V, (Y + 0.5 - G) * V, (vz + 0.5) * V], axis: [ax2, 0, az2], reach: 0 });
          const col2 = (j >> 1) % 3 === 2 ? c.white : c.flagRed;
          for (let yy = Y - 2; yy < Y; yy++) if (!g.get(vx, yy, vz)) { g.set(vx, yy, vz, col2); b.swayCell(vx, yy, vz, id); }
        }
        b.wires.push([x0, z0, x1, z1, (Y + 1 - G) * V, 0.05]);
        continue;
      }
      if (s.kind === K.Lane && hash3(Math.floor(cx), 17, Math.floor(cz)) < 0.3) {
        // a café's string of bulbs instead of washing, glowing warm after dark
        for (let j = 1; j < cells.length - 1; j += 2) {
          const [vx, vz] = cells[j];
          if (g.touches(vx, vz, vx, vz) && !g.get(vx, Y - 1, vz)) g.set(vx, Y - 1, vz, c.lampGlow);
        }
        b.wires.push([x0, z0, x1, z1, (Y + 1 - G) * V, 0.05]);
        continue;
      }
      for (let j = 2; j + 1 < cells.length - 2; j += 3) {
        const [vx, vz] = cells[j];
        if (hash3(vx, Y, vz) > 0.75 || !g.touches(vx, vz, vx, vz)) continue;
        const h = hash3(vz, Y, vx), sheet = h < 0.2;
        const cl = cols[Math.floor(hash3(vx, 3, vz) * cols.length)];
        const id = b.addSway({ ...SWAY.laundry, pivot: [(vx + 0.5) * V, (Y + 0.5 - G) * V, (vz + 0.5) * V], axis: [ax2, 0, az2], reach: 0 });
        for (const [w, [cx2, cz2]] of [cells[j], cells[j + 1]].entries()) {
          // a shirt's sleeves are a row shorter than its body; a towel and a sheet hang square
          const drop = sheet ? 6 : h < 0.55 ? 4 - w : 3;
          for (let yy = Y - drop; yy < Y; yy++) if (!g.get(cx2, yy, cz2)) { g.set(cx2, yy, cz2, (yy === Y - 1 && h > 0.85) ? c.white : cl); b.swayCell(cx2, yy, cz2, id); }
        }
      }
      b.wires.push([x0, z0, x1, z1, (Y + 1 - G) * V, 0.05]);
    }
  }
}

// ------------------------------------------------------------------------------------------- food stalls

const STALL_SPOTS: { id: string; kind: 'simit' | 'brazier' | 'midye' | 'dondurma' | 'kumpir' | 'lokma' | 'gozleme'; x: number; z: number; face: number }[] = [
  { id: 'simitci', kind: 'simit', x: 14, z: 33, face: Math.PI },
  { id: 'kestaneci', kind: 'brazier', x: -12, z: 36.6, face: 0 },
  { id: 'midyeci', kind: 'midye', x: 23.2, z: 8, face: -Math.PI / 2 },
  { id: 'dondurmaci', kind: 'dondurma', x: -36, z: -15.6, face: Math.PI },
  { id: 'kumpirci', kind: 'kumpir', x: 25, z: -24, face: -Math.PI / 2 },
  { id: 'lokmaci', kind: 'lokma', x: 20, z: 38, face: Math.PI },
  { id: 'gozlemeci', kind: 'gozleme', x: -30, z: 39, face: Math.PI },
];

function foodStalls(ctx: Ctx): StallAnchor[] {
  const { b, c, plan } = ctx;
  const out: StallAnchor[] = [];
  for (const s of STALL_SPOTS) {
    const fx = Math.sin(s.face), fz = Math.cos(s.face);
    const y = (plan.walk[col(Math.floor(s.x / V), Math.floor(s.z / V))] - G) * V;
    const turns = Math.round(((-s.face / (Math.PI / 2)) % 4 + 4) % 4);
    const prop = s.kind === 'simit' ? simitCart(c) : s.kind === 'brazier' ? brazierCart(c) : s.kind === 'midye' ? midyeStand(c) : s.kind === 'kumpir' ? kumpirCart(c)
      : s.kind === 'lokma' ? lokmaCart(c) : s.kind === 'gozleme' ? gozlemeStall(c) : dondurmaStall(c);
    b.place(prop, s.x, y, s.z, turns);
    b.block(s.x - 1.0, s.z - 1.0, s.x + 1.0, s.z + 1.0);
    const stand: [number, number] = [s.x + fx * 1.6, s.z + fz * 1.6];
    out.push({ id: s.id, stand, vendor: [s.x - fx * 1.0, s.z - fz * 1.0, s.face], label: [s.x, y + 2.6, s.z] });
    b.lamp(s.x, y + 2.3, s.z, WARM, 4, 0.8);
    if (s.kind === 'brazier' || s.kind === 'midye' || s.kind === 'lokma' || s.kind === 'gozleme') b.emitters.push({ kind: 'smoke', pos: [s.x - fx * 0.3, y + 1.4, s.z - fz * 0.3], rate: 1 });
  }
  // the fish boat in the middle is the one you buy from: the vendor at its rail, you on the quay
  out.push({ id: 'balikci', stand: [1, HORN_Z - 1.6], vendor: [1, HORN_Z + 0.6, Math.PI], label: [1, QUAY_Y + 2.4, HORN_Z + 1] });
  return out;
}

// ------------------------------------------------------------------------------------------- the hidden kitchen

/** The door: in the front wall of the old han that faces the north-slope lane, west of the Spice Bazaar. */
/** The lot fronting lane n1-n2 nearest x = -50, on its north side (it fronts on its min-z face): the hidden kitchen's. */
function hiddenLot(plan: Plan): LotPlan | undefined {
  const cand = plan.lots.filter((l) => l.side === 'n' && l.door >= 0 && l.x0 * V < -44 && l.x1 * V > -56 && l.z0 * V > 6 && l.z0 * V < 12);
  return cand.sort((p, q) => Math.abs((p.x0 + p.x1) / 2 * V + 50) - Math.abs((q.x0 + q.x1) / 2 * V + 50))[0];
}

function hiddenDoorway(ctx: Ctx): Anchors['hiddenDoor'] {
  const { b, c, plan } = ctx;
  const lt = hiddenLot(plan);
  const x = lt ? Math.round(((lt.x0 + lt.x1) / 2) / 2) * 2 * V + 1.0 : -50;
  const z = lt ? lt.z0 * V : 9.0;
  const y = lt ? (lt.base - G) * V : (layerOf(hillY(-50, 7)) - G) * V;
  b.place(hiddenDoor(c, false), x, y, z - 0.125, 0, 'door-closed');
  b.place(hiddenDoor(c, true), x, y, z - 0.125, 0, 'door-open');
  b.place(wallLantern(c), x - 1.3, y + 2.3, z - 0.3, 2, 'door-open');
  b.block(x - 0.9, z - 0.3, x + 0.9, z + 0.2);
  return { stand: [x, z - 0.9], label: [x, y + 2.0, z - 0.3], reveal: [x, y, z - 1.5] };
}

/**
 * Gizli Mutfak: a vaulted brick cellar under the old han, İznik tiles behind the counter, copper pans on the wall,
 * the tandır glowing in the corner, where Hatice Hanım cooks palace food for whoever finds the door.
 */
function gizliMutfak(b: Builder, c: IC2, anchors: Anchors): BuildResult['interior'] {
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
  g.box(0, 0, 0, ISX - 1, G - 1, ISZ - 1, c.granite);
  for (let z = 0; z < ISZ; z++) for (let x = 0; x < ISX; x++) g.set(x, G - 1, z, ((x >> 2) + (z >> 2)) % 2 ? c.kufeki : c.kufekiDark);
  // brick walls on the two far sides vaulting over
  g.box(0, G, 0, 2, G + 17, ISZ - 1, (x, y, z) => almasik(c, x, y, z));
  g.box(0, G, 0, ISX - 1, G + 17, 2, (x, y, z) => almasik(c, x, y, z));
  for (let y = 0; y < 6; y++) { g.box(3, G + 12 + y, 3, 3 + 6 - y, G + 12 + y, ISZ - 1, c.brick); g.box(3, G + 12 + y, 3, ISX - 1, G + 12 + y, 3 + 6 - y, c.brick); }
  // İznik tiles behind the counter
  g.box(3, G + 4, 3, 44, G + 11, 3, (x, y) => ((x + y) % 4 === 0 ? c.iznikRed : (x * 3 + y) % 5 === 0 ? c.iznikTeal : (x + y * 2) % 3 === 0 ? c.iznikWhite : c.iznikBlue));
  // the counter (the footprint the bake keeps clear for every hidden kitchen) and the prep table behind it
  g.box(8, G, 22, 44, G + 2, 25, c.woodDark);
  g.box(8, G, 22, 44, G + 2, 22, (x) => (x % 3 === 0 ? c.brass : c.woodBare));
  g.box(8, G + 3, 21, 44, G + 3, 26, c.marble);
  g.box(6, G, 6, 44, G + 3, 10, c.woodBare);
  g.box(6, G + 4, 6, 44, G + 4, 10, c.marbleGrey);
  // copper pans and ladles hung on the tiles, jars of pickles on a shelf
  for (let x = 8; x < 42; x += 4) g.box(x, G + 7, 4, x + 1, G + 8, 4, c.copper);
  g.box(6, G + 10, 4, 44, G + 10, 5, c.woodDark);
  for (let x = 8; x < 42; x += 2) g.box(x, G + 11, 4, x, G + 12, 4, [c.spiceYellow, c.cartGlass, c.spiceRed, c.lokumGreen][(x / 2) % 4]);
  // the tandır: a clay oven sunk in a brick hearth, glowing
  g.box(46, G, 2, 56, G + 6, 8, c.brick);
  g.box(48, G + 3, 8, 54, G + 5, 8, c.ember);
  g.box(50, G + 7, 4, 52, G + 14, 6, c.brick);
  // low cushioned seats along the counter instead of stools, a kilim on the floor
  g.box(10, G - 1, 30, 40, G - 1, 36, (x, _y, z) => ((x + z) % 3 ? c.carpetRed : c.carpetBlue));
  for (let i = 0; i < 6; i++) place(tabure(c, c.carpetRed), (10.5 + i * 5.5) * V, 0, 30 * V);
  place(figTree(c, 404), 58 * V, 0, 40 * V);
  place(samovar(c), 4 * V, 0, 44 * V);
  place(buildFood('hunkar', b.pal), 20 * V, 1.0, 23 * V, 2);
  place(buildFood('manti', b.pal), 33 * V, 1.0, 23 * V, 2);
  place(mosaicLamps(c, 7), 26 * V, 2.0, 16 * V);
  lamp(18 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(34 * V, 2.5, 23.5 * V, WARM, 6, 1.3);
  lamp(51 * V, 1.5, 9 * V, [1, 0.55, 0.25], 6, 1.4);
  lamp(30 * V, 2.0, 8 * V, WHITEWARM, 6, 0.7);
  lamp(26 * V, 2.0, 16 * V, [1, 0.6, 0.5], 4, 0.8);
  hiddenKitchenDress({ pal: b.pal, g, place, lamp, G, style: 'tr', wood: c.woodDark, top: c.copper, cushion: [c.carpetRed, c.carpetBlue], seed: 3298 });
  g.box(56, G, 44, 63, G + 12, 47, c.brick);
  g.box(58, G, 44, 61, G + 9, 44, c.door);
  anchors.interiorSpawn = [ox + 14.75, 0, oz + 10.0];
  anchors.interiorExit = [ox + 14.9, oz + 10.6];
  anchors.chef = [ox + 6.5, 0, oz + 4.4];
  anchors.counterStand = [ox + 6.5, oz + 7.3];
  return { grid: g, props, lamps };
}

export type { PathSeg };
