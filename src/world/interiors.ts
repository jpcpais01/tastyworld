import type { Builder, Lot } from './tokyo';
import { Palette } from './palette';
import { rng, hash3 } from './grid';
import { G } from './layout';
import { Prop, PropKit, stool, plantPot, cafeTable, crateStack, lantern, noren, flowerStand, breadShelf, bookCart, fishDisplay, boardSign, aFrame } from './props';
import { buildFood, FoodId } from './food';
import type { HotelInfo } from '../data/hotels';

/**
 * Walkable ground floors. Street-front buildings are hollowed into a room behind the facade (walls two
 * voxels thick, 3 m of headroom under a ceiling slab), with a door in the storefront, furniture built from
 * world voxels (so it blocks the nav grid by itself), a keeper and sometimes guests, and an optional back
 * room. The cutaway in the voxel shader opens these rooms up whenever they sit between camera and player.
 */

export type RoomKind = 'shop' | 'cafe' | 'izakaya' | 'konbini' | 'florist' | 'books' | 'fish' | 'bakery' | 'pharmacy' | 'kissa' | 'soba' | 'hotel';

export interface RoomNpc {
  role: 'keeper' | 'guest';
  pos: [number, number, number];
  facing: number;
  sit: boolean;
  seed: number;
}

export interface RoomSpot {
  kind: 'buy' | 'gacha';
  pos: [number, number, number];
  stand: [number, number];
}

export interface RoomAnchor {
  id: string;
  kind: RoomKind;
  /** n-th room of this kind (names and keepers are picked from it). */
  nth: number;
  /** Interior bounds in metres (front and back room). */
  rect: [number, number, number, number];
  /** Just inside the door. */
  door: [number, number];
  npcs: RoomNpc[];
  spots: RoomSpot[];
  /** Restaurants are run by a StallInfo vendor instead of a keeper. */
  stall?: string;
  /** A hotel lobby: the hotel's id, and where guests stand to take the lift (or the stairs) up to the rooms. */
  hotel?: string;
  lift?: { stand: [number, number]; pick: [number, number, number]; facing: number };
}

export interface SecretAnchor {
  /** The bookshelf that slides aside. */
  shelf: [number, number, number];
  shelfStand: [number, number];
  /** Doorway cells (metres) that stay blocked until the shelf is open. */
  gate: [number, number, number, number];
  /** An old recipe card on the reading-room desk. */
  note: [number, number, number];
  noteStand: [number, number];
}

export interface DarumaSpot { kind: RoomKind; pos: [number, number, number]; secret?: boolean; }

export interface RestaurantSpec { id: string; foods: [FoodId, FoodId]; }

export interface ShopFloorOpts {
  kind: RoomKind;
  seed: number;
  trim: number;
  awn: [number, number];
  awning: (a0: number, a1: number, y: number, len?: number) => void;
  lanterns?: number;
  restaurant?: RestaurantSpec;
  secret?: boolean;
  doorA?: number;
  hotel?: HotelInfo;
  /** The kind of shop whose daruma hiding spots this room stands in for (a hotel lobby in a former shop). */
  spotKind?: RoomKind;
}

export function interiorColors(pal: Palette) {
  const a = (hex: number, vary = 0.05, o: { emit?: number; night?: boolean } = {}) => pal.add(hex, { vary, ...o });
  return {
    plank: a(0xa8744a, 0.08), plankB: a(0x93613c, 0.08), plankDark: a(0x5e3b26, 0.07), plankLight: a(0xc9a172, 0.07),
    tileW: a(0xeeece6, 0.03), tileG: a(0xc9ccc9, 0.03), tileTerra: a(0xc0704a, 0.06), tileCream: a(0xe8d6b0, 0.05),
    checkB: a(0x2e2a2c, 0.03), checkW: a(0xf0ece2, 0.03), doma: a(0x7a736c, 0.08), domaB: a(0x6a635d, 0.08),
    plaster: a(0xeee4cf, 0.03), sage: a(0xcfdcc4, 0.03), paperWall: a(0xe2d2ae, 0.04), wain: a(0x6e4630, 0.06), wainDark: a(0x4a2e20, 0.06),
    velvet: a(0xa8323a, 0.05), velvetDark: a(0x7e2229, 0.05), brick: a(0x9a4a32, 0.08), brickB: a(0x86402c, 0.08),
    fridge: a(0xe9f5fb, 0.02, { emit: 0.7 }), case: a(0xd6eef5, 0.02, { emit: 0.35 }), oven: a(0xff8a3a, 0.05, { emit: 0.9 }),
    ice: a(0xdff1f6, 0.05), styro: a(0xf3f3ee, 0.02), fishA: a(0xa8b4bc, 0.08), fishB: a(0xd9604a, 0.06), fishC: a(0x4a5560, 0.06), tank: a(0x4f8fb0, 0.03, { emit: 0.3 }),
    flowerR: a(0xe0473f, 0.08), flowerY: a(0xf5cf3a, 0.08), flowerP: a(0x8d5fc0, 0.08), flowerW: a(0xfbf8f0, 0.04), flowerO: a(0xf29a3c, 0.08), flowerK: a(0xf3a6b9, 0.06),
    stem: a(0x4f8a3a, 0.12), stemDark: a(0x35662c, 0.12), bucket: a(0x9aa6b0, 0.04),
    bookA: a(0x9a3b32, 0.06), bookB: a(0x2f5a88, 0.06), bookC: a(0xd9c49a, 0.06), bookD: a(0x3f6b45, 0.06), bookE: a(0xe8e1cf, 0.04), bookF: a(0x6b4a7a, 0.06),
    paper: a(0xf6efe0, 0.03), ink: a(0x2a2422, 0.03), bottleA: a(0x6b3a16, 0.05), bottleB: a(0x2e6b3a, 0.05), bottleC: a(0xf3efe6, 0.03), bottleD: a(0x23345e, 0.04),
    boxA: a(0x4aa3e9, 0.05), boxB: a(0xf2c74a, 0.05), boxC: a(0xe9504a, 0.05), boxD: a(0x6cc06a, 0.05), boxE: a(0xf08ac0, 0.05), boxF: a(0xffffff, 0.02),
    bread: a(0xd9a05a, 0.1), breadDark: a(0xa86a32, 0.1), melon: a(0xe9cf7a, 0.08),
    steel: a(0xa7b0b8, 0.03), steelDark: a(0x5d646b, 0.03), brass: a(0xb08a3e, 0.04), coffee: a(0x3a2418, 0.04), cup: a(0xf7f3ea, 0.02),
    zabuton: a(0x6a3a7a, 0.04), zabutonB: a(0x2c3d73, 0.04), flour: a(0xf6f2e8, 0.04), board: a(0xdcbf8e, 0.04), soba: a(0x9c8a72, 0.06),
    cross: a(0x34b25a, 0.03, { emit: 0.6 }), green: a(0x3f7f5f, 0.04), ceilLight: a(0xfff3da, 0.02, { emit: 0.9 }),
    capsuleA: a(0xf05a5a, 0.03), capsuleB: a(0x5ab0f0, 0.03), capsuleC: a(0xf5d24a, 0.03), capsuleD: a(0x6ad07a, 0.03), dome: a(0xe8f4fa, 0.02, { emit: 0.25 }),
    daruma: a(0xd8302a, 0.04), darumaGold: a(0xe0b040, 0.04), darumaFace: a(0xf6efe2, 0.02), darumaInk: a(0x1d1a1c, 0.02),
    record: a(0x18161a, 0.03), jukebox: a(0xf2a640, 0.03, { emit: 0.6 }),
    // hotels: lobby stone, carpets, wallpapers, bed linen, lamps
    marbleW: a(0xece8e0, 0.03), marbleG: a(0xd3cdc2, 0.03), linen: a(0xf7f5ef, 0.02), pillow: a(0xfbfaf4, 0.015),
    carpetBlue: a(0x5a6478, 0.05), carpetBlueB: a(0x4c5568, 0.05), carpetRed: a(0x7a2e32, 0.05), carpetRedB: a(0x63242a, 0.05),
    carpetPlum: a(0x3a2a3e, 0.05), carpetPlumB: a(0x30223a, 0.05), carpetSand: a(0xcdbfa6, 0.04), carpetSandB: a(0xbcae94, 0.04),
    wpCream: a(0xefe6d4, 0.03), wpSage: a(0xd5dfcb, 0.03), wpBlue: a(0xdde2ea, 0.03), wpPlum: a(0x4a3550, 0.04), wpWarm: a(0xeadbc4, 0.03), wpStone: a(0xe9e5de, 0.03),
    duvetBlue: a(0x4a6a9a, 0.04), duvetRed: a(0xb0473f, 0.04), duvetGold: a(0xd9b25a, 0.04), duvetPlum: a(0x6a3a7a, 0.04), duvetGreen: a(0x5f8a5a, 0.04), duvetGrey: a(0x9aa3ad, 0.04),
    runnerRed: a(0x8a2a30, 0.04), runnerNavy: a(0x2b3a62, 0.04), headTan: a(0xa8845a, 0.05), headGrey: a(0x6d7076, 0.04),
    shade: a(0xffe2ae, 0.02, { emit: 0.85 }), tvFrame: a(0x1b1b20, 0.02), screen: a(0x26304a, 0.03, { emit: 0.12 }),
    quilt: a(0x3f5a8a, 0.05), quiltB: a(0xe9e1cf, 0.04), mapSea: a(0x8fb4d6, 0.04), mapLand: a(0x9ac08a, 0.05),
    liftDoor: a(0xb7bec4, 0.02), liftLit: a(0xffb347, 0.02, { emit: 0.9 }),
  };
}

export type IC = ReturnType<typeof interiorColors>;

// ---------------------------------------------------------------------------------------------
// Small props that only live indoors

export function daruma(ic: IC): Prop {
  const p = new Prop(7, 9, 7, 0.05);
  p.ellipsoid(3.5, 4, 3.5, 3.4, 4, 3.3, ic.daruma);
  p.box(2, 4, 6, 4, 6, 6, ic.darumaFace);
  p.set(2, 5, 6, ic.darumaInk); p.set(4, 5, 6, 0); p.set(4, 5, 6, ic.darumaFace); // one eye painted, one still blank
  p.box(1, 2, 6, 5, 2, 6, ic.darumaGold);
  p.box(1, 7, 5, 5, 7, 5, ic.darumaGold);
  return p;
}

function gachaMachine(ic: IC, body: number): Prop {
  const p = new Prop(6, 14, 6, 0.0625);
  p.box(0, 0, 0, 5, 6, 5, body);
  p.box(1, 2, 5, 4, 4, 5, ic.steel);
  p.set(2, 3, 5, ic.steelDark); p.set(3, 3, 5, ic.steelDark);
  p.box(0, 7, 0, 5, 12, 5, ic.dome);
  const caps = [ic.capsuleA, ic.capsuleB, ic.capsuleC, ic.capsuleD];
  for (let y = 7; y <= 10; y++) for (let z = 1; z <= 4; z++) for (let x = 1; x <= 4; x++) if (hash3(x, y, z) < 0.55) p.set(x, y, z, caps[(x + y * 3 + z) % 4]);
  p.box(0, 13, 0, 5, 13, 5, body);
  return p;
}

function register(ic: IC): Prop {
  const p = new Prop(5, 5, 4, 0.0625);
  p.box(0, 0, 0, 4, 1, 3, ic.steelDark);
  p.box(0, 2, 1, 4, 3, 3, ic.steel);
  p.box(1, 4, 2, 3, 4, 3, ic.case);
  return p;
}

function pendant(k: PropKit, shade: number): Prop {
  const p = new Prop(5, 12, 5, 0.0625);
  p.box(2, 4, 2, 2, 11, 2, k.c.black);
  p.box(0, 1, 0, 4, 3, 4, shade);
  p.box(1, 0, 1, 3, 0, 3, k.c.bulb);
  return p;
}

function siphon(ic: IC): Prop {
  const p = new Prop(9, 7, 3, 0.0625);
  for (const x of [1, 4, 7]) {
    p.set(x, 0, 1, ic.steelDark);
    p.box(x, 1, 1, x, 2, 1, ic.coffee);
    p.box(x, 3, 1, x, 3, 1, ic.brass);
    p.box(x, 4, 1, x, 6, 1, ic.case);
  }
  return p;
}

function bowlStack(ic: IC, seed: number): Prop {
  const r = rng(seed);
  const p = new Prop(8, 4, 3, 0.0625);
  for (let x = 0; x < 8; x += 2) {
    const h = 1 + Math.floor(r() * 3);
    p.box(x, 0, 0, x + 1, h, 2, r() < 0.5 ? ic.cup : ic.bottleD);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------

const ANG = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

export function shopFloor(lot: Lot, o: ShopFloorOpts): void {
  const b = lot.b as Builder, c = b.c, k = b.k, ic = b.ic;
  const w = lot.width, dep = lot.depth;
  const r = rng(o.seed * 7 + 3);
  const kind = o.kind;
  const sw = w >= 15 ? 2 : 1;
  const A0 = sw, A1 = w - 1 - sw;
  const D0 = 2;
  let pb = D0 + Math.min(16, Math.max(10, dep - 14));
  const back = dep - 3 - pb >= 4;
  if (!back) pb = dep - 2;
  const D1 = pb - 1;
  const BD0 = pb + 1, BD1 = dep - 3;
  const DW = 5;
  const da = o.doorA ?? (kind === 'izakaya' ? A1 - DW + 1 : Math.floor(w / 2) - 2);
  const nth = b.roomCount[kind] = (b.roomCount[kind] ?? -1) + 1;

  // continuous facade coordinates (cell (a, d) spans a..a+1, d..d+1) -> metres
  const P = (a: number, d: number) => lot.m(a, d);
  const turn = (dir: number) => (lot.turns + dir) % 4; // 0 faces the street, 1 faces +a, 2 faces inward, 3 faces -a
  const face = (dir: number) => ANG[turn(dir)];
  const put = (p: Prop, a: number, d: number, y: number, dir: number, solid = 0) => {
    const [x, z] = P(a, d);
    b.place(p, x, y, z, turn(dir));
    if (solid) b.block(x - solid, z - solid, x + solid, z + solid);
  };
  const blockCells = (a0: number, d0: number, a1: number, d1: number) => {
    const [x0, z0] = P(Math.min(a0, a1) + 0.1, Math.min(d0, d1) + 0.1);
    const [x1, z1] = P(Math.max(a0, a1) + 0.9, Math.max(d0, d1) + 0.9);
    b.block(x0, z0, x1, z1);
  };
  const lampAt = (a: number, d: number, y: number, col: [number, number, number], rad: number, inten: number) => {
    const [x, z] = P(a, d);
    b.lamp(x, y, z, col, rad, inten);
  };

  const [rx0, rz0] = P(A0, D0), [rx1, rz1] = P(A1 + 1, dep - 2);
  const room: RoomAnchor = {
    id: `${kind}-${nth}`, kind, nth,
    rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
    door: P(da + 2.5, D0 + 1.2),
    npcs: [], spots: [],
  };
  const npc = (role: RoomNpc['role'], a: number, d: number, dir: number, sit = false, y = sit ? 0.5 : 0) => {
    const [x, z] = P(a, d);
    // one body per spot: never seat someone on top of someone else
    if (room.npcs.some((q) => Math.hypot(q.pos[0] - x, q.pos[2] - z) < 0.6)) return;
    room.npcs.push({ role, pos: [x, y, z], facing: face(dir), sit, seed: o.seed * 31 + room.npcs.length * 7 });
  };
  const spot = (kindS: RoomSpot['kind'], a: number, d: number, y: number, sa: number, sd: number) => {
    const [x, z] = P(a, d);
    room.spots.push({ kind: kindS, pos: [x, y, z], stand: P(sa, sd) });
  };
  const darumaAt = (a: number, d: number, y: number) => b.darumaSpots.push({ kind: o.spotKind ?? kind, pos: withY(P(a, d), y) });

  // ---- shell: hollow the ground floor
  const planks = (a: number, _y: number, d: number) => ((a + ((d >> 2) % 2) * 2) % 4 === 0 ? ic.plankB : (a % 2 ? ic.plank : ic.plankLight));
  const floorFn = ((): (a: number, y: number, d: number) => number => {
    switch (kind) {
      case 'konbini': case 'pharmacy': return (a, _y, d) => ((a + d) % 2 ? ic.tileW : ic.tileG);
      case 'fish': return (a, _y, d) => ((a >> 1) + (d >> 1)) % 2 ? ic.tileW : ic.tileG;
      case 'florist': return (a, _y, d) => (hash3(a, d, 3) < 0.5 ? ic.doma : ic.domaB);
      case 'bakery': return (a, _y, d) => ((a >> 1) + (d >> 1)) % 2 ? ic.tileTerra : ic.tileCream;
      case 'kissa': return (a, _y, d) => ((a + d) % 2 ? ic.checkB : ic.checkW);
      case 'izakaya': return (a, _y, d) => (hash3(a >> 1, d >> 1, 5) < 0.5 ? ic.doma : ic.domaB);
      case 'books': return (a, _y, d) => ((a + (d >> 2)) % 3 === 0 ? ic.plankDark : ic.wainDark);
      case 'hotel': if (o.hotel?.theme !== 'ryokan') return (a, _y, d) => (((a >> 2) + (d >> 2)) % 2 ? ic.marbleW : ic.marbleG);
        return planks; // a ryokan's entrance hall is boards
      default: return planks;
    }
  })();
  const [wainC, wallC] = ((): [number, number] => {
    switch (kind) {
      case 'konbini': case 'pharmacy': case 'fish': return [ic.tileG, ic.tileW];
      case 'kissa': return [ic.wainDark, ic.paperWall];
      case 'izakaya': case 'soba': return [c.cedar, c.plaster];
      case 'florist': return [ic.green, ic.sage];
      case 'bakery': return [ic.brick, ic.plaster];
      case 'books': return [ic.wainDark, ic.paperWall];
      case 'hotel': return o.hotel?.theme === 'ryokan' ? [c.cedar, c.plaster] : o.hotel?.theme === 'boutique' ? [ic.wainDark, ic.wpPlum] : [ic.wainDark, ic.wpWarm];
      default: return [ic.wain, ic.plaster];
    }
  })();
  const finish = (y: number) => (y <= 3 ? wainC : y === 4 ? o.trim : wallC);

  lot.box(A0, 0, D0, A1, 11, dep - 3, 0);
  lot.box(A0, -1, D0, A1, -1, dep - 3, floorFn);
  lot.box(A0 - 1, 0, D0, A0 - 1, 11, dep - 3, (_a, y) => finish(y));
  lot.box(A1 + 1, 0, D0, A1 + 1, 11, dep - 3, (_a, y) => finish(y));
  lot.box(A0, 0, 1, A1, 11, 1, (_a, y) => finish(y));
  lot.box(A0, 0, dep - 2, A1, 11, dep - 2, (_a, y) => finish(y));
  b.indoor.push(voxBox(lot, A0, D0, A1, dep - 3));

  // back room: storeroom or kitchen behind a partition with a doorway on the right
  const bda = A1 - 3;
  if (back) {
    lot.box(A0, 0, pb, A1, 11, pb, (_a, y) => finish(y));
    if (!o.secret) {
      lot.box(bda, 0, pb, A1, 9, pb, 0);
      lot.box(bda - 1, 10, pb, A1, 10, pb, o.trim);
    }
    lot.box(A0, -1, BD0, A1, -1, BD1, (a, _y, d) => (hash3(a, d, 9) < 0.5 ? ic.doma : ic.domaB));
  }

  // ---- storefront: door, windows, fascia
  const glassC = kind === 'konbini' || kind === 'pharmacy' ? c.konbiniGlass : c.glassLit;
  const ryokan = o.hotel?.theme === 'ryokan';
  const frame = kind === 'konbini' || kind === 'pharmacy' ? c.trim : kind === 'kissa' ? ic.wainDark : kind === 'izakaya' || kind === 'soba' || ryokan ? c.woodDark : o.trim;
  lot.box(da, 0, 0, da + DW - 1, 9, 1, 0);
  lot.box(da, -1, 0, da + DW - 1, -1, 1, c.stoneStep);
  lot.box(da - 1, 0, -1, da - 1, 10, 0, frame);
  lot.box(da + DW, 0, -1, da + DW, 10, 0, frame);
  lot.box(da - 1, 10, -1, da + DW, 10, 0, frame);
  const pane = (a0: number, a1: number, y0 = 2, y1 = 8) => {
    if (a1 - a0 < 1) return;
    lot.box(a0, y0, 0, a1, y1, 0, (a, y) => (a === a0 || a === a1 || y === y0 || y === y1 || (kind !== 'konbini' && (a - a0) % 4 === 0) ? frame : glassC));
    lot.box(a0 + 1, y0 + 1, 1, a1 - 1, y1 - 1, 1, glassC);
    lot.box(a0, y0 - 1, -1, a1, y0 - 1, -1, o.trim);
  };
  const leftA1 = da - 2, rightA0 = da + DW + 1;
  if (kind === 'konbini' || kind === 'pharmacy') { pane(A0 - 1, leftA1, 1, 9); pane(rightA0, A1 + 1, 1, 9); }
  else { pane(A0, leftA1); pane(rightA0, A1); }

  const WARM: [number, number, number] = [1.0, 0.72, 0.42];
  const WHITE: [number, number, number] = [1.0, 0.9, 0.76];
  const COOL: [number, number, number] = [0.8, 0.92, 1.0];
  const front = (a: number, out: number) => lot.front(a, out);

  // exterior dressing per kind
  switch (kind) {
    case 'shop': case 'florist': case 'books': case 'fish': case 'bakery': case 'cafe': {
      lot.box(0, 10, 0, w - 1, 11, 0, o.trim);
      o.awning(0, w - 1, 12, kind === 'cafe' || kind === 'books' || kind === 'bakery' ? 3 : 4);
      if (kind === 'shop') {
        const goods = [c.goodsA, c.goodsB, c.goodsC, c.goodsD, c.goodsE, c.goodsF];
        for (const [a0, a1] of [[A0, leftA1 - 1], [rightA0 + 1, A1]]) {
          if (a1 - a0 < 2) continue;
          lot.box(a0, 0, -1, a1, 2, -2, c.woodMid);
          lot.box(a0, 3, -1, a1, 3, -2, (a, _y, d) => goods[Math.floor(hash3(a, d, o.seed) * goods.length)]);
        }
      } else if (kind === 'florist') {
        lot.wallProp(flowerStand(k, o.seed), Math.max(2.2, leftA1 / 2 + 0.5), 0, 0.5);
        lot.wallProp(plantPot(k, 'flowers', o.seed + 3), w - 1.6, 0, 0.12);
      } else if (kind === 'books') {
        lot.wallProp(bookCart(k, o.seed), Math.max(2.2, leftA1 / 2 + 0.5), 0, 0.45);
      } else if (kind === 'fish') {
        lot.wallProp(fishDisplay(k, o.seed), Math.max(2.2, leftA1 / 2 + 0.5), 0, 0.5);
        if (A1 - rightA0 > 4) lot.wallProp(fishDisplay(k, o.seed + 5), (rightA0 + A1 + 1) / 2, 0, 0.5);
      } else if (kind === 'bakery') {
        lot.wallProp(aFrame(k, o.seed), w - 2.2, 0, 0.12);
        const [ax, az] = front(w - 2.2, 0.3);
        b.block(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3);
      } else {
        lot.wallProp(plantPot(k, 'shrub', o.seed), 1.6, 0, 0.12);
        lot.wallProp(plantPot(k, 'bamboo', o.seed + 1), w - 1.6, 0, 0.12);
        lot.wallProp(aFrame(k, o.seed + 2), Math.max(3.8, leftA1 - 0.5), 0, 0.12);
        const [ax, az] = front(Math.max(3.8, leftA1 - 0.5), 0.3);
        b.block(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3);
      }
      const [lx, lz] = front(w / 2, 0.8);
      b.lamp(lx, 2.2, lz, kind === 'fish' ? COOL : WARM, 4.5, 0.7);
      break;
    }
    case 'izakaya': {
      lot.box(0, 0, 0, w - 1, 13, 0, (a, y, d) => lot.get(a, y, d) === 0 ? 0 : (y === 0 || y >= 10 ? c.woodDark : lot.get(a, y, d) === glassC ? glassC : c.woodDark));
      for (let a = A0; a <= leftA1; a++) if (a % 2 === 0) lot.box(a, 2, -1, a, 8, -1, c.woodMid);
      lot.box(0, 10, -1, w - 1, 10, -2, c.cedar);
      lot.box(0, 11, -1, w - 1, 11, -1, c.roofTile);
      lot.wallProp(noren(k, 10, [k.c.navy, k.c.norenRed, k.c.norenBrown, k.c.indigo][Math.floor(r() * 4)], k.c.norenWhite, 6, 2), da + DW / 2, 1.5, 0.02);
      const lc = o.lanterns ?? k.c.lanternRed;
      lot.wallProp(lantern(k, lc, 6, 8, o.seed), da - 1.2, 1.3, 0.35);
      const [lx, lz] = front(da - 1.2, 0.5);
      b.lamp(lx, 1.8, lz, lc === k.c.lanternWhite ? WHITE : [1.0, 0.42, 0.22], 4, 1.0);
      if (leftA1 - A0 > 3 && r() < 0.6) lot.wallProp(crateStack(k, o.seed), A0 + 1.2, 0, 0.1);
      lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, 3, o.seed), w / 2, 2.85, 0.0);
      break;
    }
    case 'konbini': {
      lot.box(0, 10, -1, w - 1, 10, -1, c.konbiniStripeC);
      lot.box(0, 11, -1, w - 1, 11, -1, c.konbiniStripeA);
      lot.box(0, 12, -1, w - 1, 12, -1, c.signLit);
      lot.box(0, 13, -1, w - 1, 13, -1, c.konbiniStripeB);
      const [lx, lz] = front(w / 2, 1.2);
      b.lamp(lx, 2.4, lz, [0.62, 0.84, 1.0], 7.5, 1.0);
      break;
    }
    case 'pharmacy': {
      lot.box(0, 10, -1, w - 1, 13, -1, c.trim);
      lot.box(2, 12, -2, 4, 12, -2, k.c.greenCross);
      lot.box(3, 11, -2, 3, 13, -2, k.c.greenCross);
      lot.box(6, 12, -2, w - 3, 12, -2, (a) => (a % 2 ? k.c.signGreen : c.signLit));
      const [lx, lz] = front(w / 2, 1.0);
      b.lamp(lx, 2.4, lz, [0.75, 1.0, 0.85], 5.5, 0.8);
      break;
    }
    case 'kissa': {
      lot.box(0, 0, 0, w - 1, 11, 0, (a, y, d) => {
        const v = lot.get(a, y, d);
        if (v === 0 || v === glassC || v === frame) return v;
        return (y + (a >> 1)) % 3 === 0 ? ic.brickB : ic.brick;
      });
      lot.box(0, 10, -1, w - 1, 11, -1, ic.wainDark);
      o.awning(0, w - 1, 12, 3);
      lot.wallProp(boardSign(k, k.c.signCream, k.c.signRed, 2, o.seed + 4, k.c.woodDark), w / 2, 2.62, 0.0);
      lot.wallProp(plantPot(k, 'shrub', o.seed), 1.6, 0, 0.12);
      lot.wallProp(aFrame(k, o.seed + 1), w - 2.0, 0, 0.12);
      const [ax, az] = front(w - 2.0, 0.3);
      b.block(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3);
      const [lx, lz] = front(w / 2, 0.8);
      b.lamp(lx, 2.3, lz, WARM, 5, 0.9);
      break;
    }
    case 'hotel': {
      if (ryokan) {
        // a timber front with a lattice, an indigo noren and white lanterns either side of the door
        lot.box(0, 0, 0, w - 1, 11, 0, (a, y, d) => {
          const v = lot.get(a, y, d);
          if (v === 0) return 0;
          if (v === glassC) return (a % 2 === 0) ? c.woodDark : c.shoji;
          return y === 0 || y >= 10 ? c.cedar : c.woodDark;
        });
        lot.box(0, 10, -1, w - 1, 10, -2, c.cedar);
        lot.box(0, 11, -1, w - 1, 11, -2, c.roofTile);
        lot.wallProp(noren(k, 10, k.c.indigo, k.c.norenWhite, 6, 3), da + DW / 2, 1.5, 0.02);
        for (const la of [da - 1.2, da + DW + 1.2]) {
          lot.wallProp(lantern(k, k.c.lanternWhite, 6, 8, o.seed + la), la, 1.3, 0.35);
          const [lx, lz] = front(la, 0.5);
          b.lamp(lx, 1.8, lz, WHITE, 4, 0.9);
        }
        lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, 2, o.seed + 6, k.c.woodDark), w / 2, 2.85, 0.0);
        lot.wallProp(plantPot(k, 'pine', o.seed + 2), 1.6, 0, 0.12);
        lot.wallProp(plantPot(k, 'bamboo', o.seed + 3), w - 1.6, 0, 0.12);
        break;
      }
      // a dark fascia with HOTEL in lit channel letters, a red carpet to the door, little trees either side
      const hi = o.hotel!;
      const band = hi.theme === 'boutique' || hi.theme === 'sky' ? ic.tvFrame : c.trimDark;
      const glow = hi.theme === 'boutique' ? c.neonViolet : hi.theme === 'sky' ? c.neonYellow : c.signLit;
      lot.box(0, 10, -1, w - 1, 13, -1, band);
      const FONT = ['101111101101', '111101101111', '111010010010', '111110100111', '100100100111']; // H O T E L, 3 x 4 each
      const la0 = Math.floor((w - 19) / 2);
      FONT.forEach((g, i) => {
        for (let row = 0; row < 4; row++) for (let col = 0; col < 3; col++) if (g[row * 3 + col] === '1') lot.set(la0 + i * 4 + col, 13 - row, -2, glow);
      });
      const [gx, gz] = front(w / 2, 0.9);
      b.lamp(gx, 3.0, gz, hi.theme === 'boutique' ? [0.7, 0.5, 1.0] : WHITE, 5, 0.7);
      lot.box(da, -1, -3, da + DW - 1, -1, -1, ic.carpetRed);
      for (const pa of [da - 1.8, da + DW + 1.8]) {
        lot.wallProp(plantPot(k, 'pine', o.seed + pa), pa, 0, 0.12);
        const [px, pz] = front(pa, 0.35);
        b.block(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3);
      }
      const [lx, lz] = front(da + DW / 2, 0.8);
      b.lamp(lx, 2.3, lz, WARM, 4.5, 0.9);
      break;
    }
    case 'soba': {
      lot.box(0, 0, 0, w - 1, 11, 0, (a, y, d) => {
        const v = lot.get(a, y, d);
        if (v === 0) return 0;
        if (v === glassC) return (a % 2 === 0) ? c.woodDark : c.shoji;
        return y === 0 || y >= 10 ? c.cedar : c.woodDark;
      });
      lot.box(0, 10, -1, w - 1, 10, -2, c.cedar);
      lot.box(0, 11, -1, w - 1, 11, -2, c.roofTile);
      lot.wallProp(noren(k, 10, k.c.indigo, k.c.norenWhite, 6, 3), da + DW / 2, 1.5, 0.02);
      lot.wallProp(lantern(k, k.c.lanternWhite, 6, 8, o.seed), da - 1.2, 1.3, 0.35);
      lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, 2, o.seed + 6, k.c.woodDark), w / 2, 2.85, 0.0);
      lot.wallProp(plantPot(k, 'bamboo', o.seed + 2), w - 1.6, 0, 0.12);
      const [lx, lz] = front(da - 1.2, 0.5);
      b.lamp(lx, 1.8, lz, WHITE, 4.5, 1.0);
      break;
    }
  }

  // ---- furnishing
  const goods = [ic.boxA, ic.boxB, ic.boxC, ic.boxD, ic.boxE, ic.boxF, c.goodsA, c.goodsD];
  const books = [ic.bookA, ic.bookB, ic.bookC, ic.bookD, ic.bookE, ic.bookF];
  const bottles = [ic.bottleA, ic.bottleB, ic.bottleC, ic.bottleD];
  const flowers = [ic.flowerR, ic.flowerY, ic.flowerP, ic.flowerW, ic.flowerO, ic.flowerK];
  const shelfRun = (a0: number, d0: number, a1: number, d1: number, h: number, fill: number[], board = c.woodMid) =>
    lot.box(a0, 0, d0, a1, h, d1, (a, y, d) => (y === 0 || y % 3 === 0 || y === h ? board : hash3(a * 3 + d, y, o.seed) < 0.82 ? fill[Math.floor(hash3(a, y * 7, d + o.seed) * fill.length)] : board));
  const counter = (a0: number, d0: number, a1: number, d1: number, body: number, top: number) => {
    lot.box(a0, 0, d0, a1, 2, d1, body);
    lot.box(a0, 3, d0, a1, 3, d1, top);
  };
  const midA = Math.floor((A0 + A1) / 2);
  const IN = 2, OUT = 0, PA = 1, NA = 3;

  // keeper behind a counter that runs across the room in front of the partition (left of the back doorway)
  const backCounter = (body: number, top: number, extra?: (a0: number, a1: number) => void) => {
    const a1 = back ? bda - 2 : A1 - 1;
    counter(A0, D1 - 3, a1, D1 - 2, body, top);
    extra?.(A0, a1);
    const ka = Math.max(A0 + 1.5, Math.min(a1 - 0.5, midA));
    npc('keeper', ka, D1, OUT);
    return { ka, a1 };
  };

  switch (kind) {
    case 'konbini': {
      const fa1 = back ? bda - 2 : A1;
      lot.box(A0, 0, D1 - 1, fa1, 8, D1, (a, y, d) => (d === D1 || y === 0 || y === 8 || a === A0 ? c.trim : y % 3 === 0 ? ic.fridge : [c.goodsA, c.goodsB, c.goodsC, c.goodsD, ic.boxF][(a * 3 + y) % 5]));
      // central gondola
      shelfRun(A0 + 3, D0 + 4, A0 + 4, D1 - 4, 5, goods, c.trim);
      // register counter along the right wall
      const cd0 = D0 + 3, cd1 = Math.min(D1 - 5, D0 + 8);
      counter(A1 - 3, cd0, A1 - 2, cd1, c.trim, ic.tileG);
      b.place(register(ic), ...withY(P(A1 - 2.5, cd0 + 1.5), 1.0), turn(NA));
      lot.box(A1 - 3, 4, cd1 - 1, A1 - 3, 5, cd1, ic.case); // hot snack case
      npc('keeper', A1, (cd0 + cd1 + 1) / 2, NA);
      spot('buy', A1 - 3, (cd0 + cd1 + 1) / 2, 1.2, A1 - 4.5, (cd0 + cd1 + 1) / 2);
      // magazine rack under the right window
      if (A1 - rightA0 > 2) lot.box(rightA0, 0, D0, A1, 2, D0, (a, y) => (y === 2 ? goods[a % goods.length] : c.trim));
      // gachapon machines by the door
      put(gachaMachine(ic, ic.capsuleA), A0 + 0.75, D0 + 0.5, 0, IN, 0.22);
      put(gachaMachine(ic, ic.capsuleB), A0 + 2.35, D0 + 0.5, 0, IN, 0.22);
      spot('gacha', A0 + 1.55, D0 + 0.6, 0.9, A0 + 1.55, D0 + 2.6);
      npc('guest', A0 + 1.5, D0 + 6, PA);
      lampAt((A0 + A1 + 1) / 2, D0 + 4, 2.7, COOL, 8, 1.0);
      lampAt((A0 + A1 + 1) / 2, D1 - 3, 2.7, COOL, 7, 0.8);
      break;
    }
    case 'shop': {
      shelfRun(A0, D0 + 2, A0 + 1, D1 - 5, 7, goods);
      shelfRun(A1 - 1, D0 + 2, A1, back ? D1 - 5 : D1 - 1, 7, goods);
      if (D1 - D0 >= 11) {
        lot.box(midA - 1, 0, D0 + 4, midA + 1, 2, D0 + 6, c.woodMid);
        lot.box(midA - 1, 3, D0 + 4, midA + 1, 3, D0 + 6, (a, _y, d) => (hash3(a, d, o.seed) < 0.6 ? goods[(a + d) % goods.length] : 0));
      }
      const { ka } = backCounter(c.woodMid, c.hinoki);
      b.place(register(ic), ...withY(P(ka + 1, D1 - 2.5), 1.0), turn(OUT));
      spot('buy', ka, D1 - 2.5, 1.2, ka, D1 - 4.5);
      if (nth === 0) { put(gachaMachine(ic, ic.capsuleC), A1 - 0.6, D0 + 0.5, 0, IN, 0.22); spot('gacha', A1 - 0.6, D0 + 0.6, 0.9, A1 - 0.8, D0 + 2.6); }
      lampAt((A0 + A1 + 1) / 2, D0 + 5, 2.6, WARM, 7, 1.0);
      break;
    }
    case 'cafe': case 'kissa': {
      const kissa = kind === 'kissa';
      const { ka, a1 } = backCounter(kissa ? ic.wainDark : c.woodMid, kissa ? c.hinoki : c.counterTop);
      b.place(siphon(ic), ...withY(P(Math.min(a1 - 1, ka + 1.6), D1 - 2.5), 1.0), turn(OUT));
      lot.box(A0, 6, D1, a1, 6, D1, c.hinoki);
      lot.box(A0, 7, D1, a1, 7, D1, (a) => [ic.cup, 0, ic.bottleA, ic.cup, ic.bottleB][a % 5]);
      // counter stools
      const sd = D1 - 4.3;
      for (let a = A0 + 1; a <= a1 - 1; a += 3) put(stool(k, kissa ? k.c.lacquer : k.c.woodLight), a + 0.5, sd, 0, OUT);
      npc('guest', A0 + 1.5, sd, IN, true);
      // tables: booths along the walls in the kissa, small round tables in the café, only as many
      // rows as fit in front of the counter stools with room for the sitters' backs
      const rowEnd = kissa ? 5 : 3.3, rowStep = kissa ? 6 : 5;
      for (let i = 0; ; i++) {
        const d = D0 + 3 + i * rowStep;
        if (d + rowEnd + 2.2 > sd) break;
        for (const side of [0, 1]) {
          const ta = side === 0 ? A0 + 1 : A1 - 1;
          if (side === 1 && back && d + rowEnd - 1 >= D1 - 3) continue;
          if (kissa) {
            // booth: padded benches with high backs facing each other across a table on one leg by the
            // wall, deep enough that both sitters' knees fit under it
            const a0 = side === 0 ? A0 : A1 - 2, a1b = a0 + 2, wallA = side === 0 ? a0 : a1b;
            lot.box(a0, 0, d - 1, a1b, 4, d - 1, ic.velvetDark); lot.box(a0, 0, d, a1b, 1, d, ic.velvet);
            lot.box(a0, 0, d + 4, a1b, 4, d + 4, ic.velvetDark); lot.box(a0, 0, d + 3, a1b, 1, d + 3, ic.velvet);
            lot.box(wallA, 0, d + 1, wallA, 2, d + 2, ic.wainDark);
            lot.box(a0, 3, d + 1, a1b, 3, d + 2, c.hinoki);
            if (i === 0 || r() < 0.7) npc('guest', (a0 + a1b + 1) / 2, d + 0.5, IN, true);
            if (r() < 0.5) npc('guest', (a0 + a1b + 1) / 2, d + 3.5, OUT, true);
            put(pendant(k, k.c.lanternAmber), (a0 + a1b + 1) / 2, d + 2, 2.15, OUT);
          } else {
            // stools far enough out that a sitter's chest clears the round top and the knees tuck under it
            put(cafeTable(k, [k.c.fabricWhite, k.c.fabricRed, k.c.fabricGreen][(i + side) % 3]), ta + 0.5, d + 1.5, 0, OUT, 0.32);
            put(stool(k, k.c.woodLight), ta + 0.5, d - 0.3, 0, OUT);
            put(stool(k, k.c.woodLight), ta + 0.5, d + 3.3, 0, OUT);
            if ((i + side) % 2 === 0) npc('guest', ta + 0.5, d - 0.3, IN, true);
            else if (r() < 0.5) npc('guest', ta + 0.5, d + 3.3, OUT, true);
          }
        }
      }
      if (kissa) {
        // jukebox in the corner by the window
        lot.box(A1 - 1, 0, D0, A1, 5, D0, (_a, y) => (y >= 3 ? ic.jukebox : y === 2 ? ic.record : ic.wainDark));
      } else {
        lot.box(A1, 0, D0, A1, 4, D0 + 1, (_a, y) => (y === 4 ? c.leaf : ic.wain));
      }
      if (D0 + 3 > D1 - 9) put(plantPot(k, 'bamboo', o.seed + 9), A0 + 1.5, D0 + 1.5, 0, OUT, 0.2); // (where no table takes the corner)
      spot('buy', ka, D1 - 2.5, 1.2, ka, D1 - 4.8);
      lampAt((A0 + A1 + 1) / 2, D0 + 4, 2.4, WARM, 7, 1.1);
      lampAt(ka, D1 - 2, 2.4, WARM, 5, 0.9);
      if (o.restaurant) room.stall = o.restaurant.id;
      break;
    }
    case 'izakaya': {
      // counter along the left wall, keeper behind it, stools on the guest side
      const cd0 = D0 + 2, cd1 = D1;
      counter(A0 + 2, cd0, A0 + 3, cd1, c.woodDark, c.hinoki);
      for (let d = cd0; d <= cd1; d++) {
        lot.set(A0, 5, d, c.hinoki);
        lot.set(A0, 6, d, bottles[(d * 7 + o.seed) % 4]);
        if (d % 2) lot.set(A0, 7, d, bottles[(d + 1) % 4]);
      }
      // grill + pot at the keeper's station
      lot.box(A0, 0, cd1 - 3, A0 + 1, 3, cd1 - 2, ic.steelDark);
      lot.box(A0, 4, cd1 - 3, A0 + 1, 4, cd1 - 2, ic.oven);
      const [ex, ez] = P(A0 + 1, cd1 - 2);
      b.emitters.push({ kind: 'smoke', pos: [ex, 1.2, ez], rate: 0.5 });
      npc('keeper', A0 + 1, (cd0 + cd1) / 2, PA);
      // menu strips on the opposite wall, above head height
      for (let d = cd0; d <= cd1; d += 2) lot.box(A1, 7, d, A1, 10, d, (_a, y) => (y % 2 ? ic.paper : ic.ink));
      let n = 0;
      for (let d = cd0 + 1; d <= cd1; d += 3) {
        // a thigh's length out from the counter, so knees tuck under the overhang instead of into it
        put(stool(k, k.c.lacquer), A0 + 5.2, d + 0.5, 0, NA);
        if (n++ % 2 === 0 && n < 5) npc('guest', A0 + 5.2, d + 0.5, NA, true);
      }
      put(lantern(k, o.lanterns ?? k.c.lanternRed, 4, 5, o.seed + 2), A0 + 3, (cd0 + cd1) / 2, 2.3, OUT);
      lot.set(A0, 6, cd0 + 1, 0); lot.set(A0, 7, cd0 + 1, 0);
      darumaAt(A0 + 0.5, cd0 + 1.5, 1.5);
      spot('buy', A0 + 3, (cd0 + cd1 + 1) / 2 + 1, 1.2, A0 + 6.4, (cd0 + cd1 + 1) / 2 + 1);
      lampAt(A0 + 3.5, (cd0 + cd1) / 2, 2.3, [1.0, 0.55, 0.3], 6, 1.2);
      break;
    }
    case 'florist': {
      const buckets = (a0: number, a1: number, d0: number, d1: number) =>
        lot.box(a0, 0, d0, a1, 4, d1, (a, y, d) => (y <= 1 ? ic.bucket : hash3(a, y, d + o.seed) < 0.45 ? flowers[Math.floor(hash3(a * 5, y, d) * flowers.length)] : y === 2 ? ic.stemDark : hash3(a, d, y) < 0.5 ? ic.stem : 0));
      buckets(A0, A0 + 1, D0 + 2, D1 - 1);
      buckets(A1 - 1, A1, D0 + 2, Math.min(D1 - 5, D0 + 8));
      // glass flower fridge on the back wall
      lot.box(A0, 0, D1, back ? bda - 2 : A1, 7, D1, (a, y) => (y === 0 || y === 7 ? c.trim : y % 3 === 0 ? ic.fridge : flowers[(a + y) % flowers.length]));
      // wrapping table
      lot.box(midA - 1, 0, D0 + 5, midA + 1, 2, D0 + 6, c.woodMid);
      lot.box(midA - 1, 3, D0 + 5, midA + 1, 3, D0 + 6, (a) => (a % 2 ? ic.paper : ic.flowerK));
      npc('keeper', midA + 0.5, D0 + 8, OUT);
      spot('buy', midA + 0.5, D0 + 5.5, 1.0, midA + 0.5, D0 + 3);
      lampAt(midA + 0.5, D0 + 5, 2.6, WARM, 7, 1.0);
      break;
    }
    case 'books': {
      shelfRun(A0, D0 + 1, A0 + 1, D1, 10, books, ic.wainDark);
      shelfRun(A1 - 1, D0 + 3, A1, back && !o.secret ? D1 - 5 : D1 - 1, 10, books, ic.wainDark);
      if (D1 - D0 >= 11) {
        lot.box(midA - 1, 0, D0 + 5, midA + 1, 2, D0 + 7, ic.wainDark);
        lot.box(midA - 1, 3, D0 + 5, midA + 1, 4, D0 + 7, (a, y, d) => (hash3(a, y, d) < 0.6 ? books[(a + y + d) % books.length] : 0));
      }
      // keeper's desk by the door with a teetering stack
      lot.box(A1 - 2, 0, D0, A1 - 1, 2, D0 + 1, ic.wainDark);
      lot.box(A1 - 2, 3, D0, A1 - 2, 6, D0, (_a, y) => books[y % books.length]);
      npc('keeper', A1 + 0.5, D0 + 1, NA);
      npc('guest', A0 + 2.6, D0 + 6, NA);
      if (o.secret && back) {
        // a reading room hidden behind the back shelf
        const ga0 = midA - 1, ga1 = midA + 2;
        shelfRun(A0 + 2, D1, ga0 - 1, D1, 10, books, ic.wainDark);
        shelfRun(ga1 + 1, D1, A1 - 2, D1, 10, books, ic.wainDark);
        lot.box(ga0, 0, pb, ga1, 9, pb, 0);
        lot.box(ga0, 0, D1, ga1, 10, D1, 0);
        lot.box(ga0, 10, D1, ga1, 10, D1, ic.wainDark);
        const shelf = new Prop(8, 20, 2);
        shelf.box(0, 0, 0, 7, 19, 1, ic.wainDark);
        for (let y = 1; y < 19; y++) if (y % 6) for (let x = 1; x < 7; x++) shelf.set(x, y, 1, books[(x * 3 + y) % books.length]);
        shelf.set(5, 13, 1, ic.bookA); shelf.set(5, 14, 1, ic.bookA); // the one red book that is not quite pushed in
        const [sx, sz] = P((ga0 + ga1 + 1) / 2, D1 + 0.5);
        b.place(shelf, sx, 0, sz, turn(OUT), 'shelf-closed');
        const [ox, oz] = P(ga1 + 1 + 0.5, D1 - 0.4);
        b.place(shelf, ox, 0, oz, turn(OUT), 'shelf-open');
        const [gx0, gz0] = P(ga0 + 0.05, D1 + 0.05), [gx1, gz1] = P(ga1 + 0.95, pb + 0.95);
        // reading room furniture
        lot.box(A0, 0, BD1 - 1, A0 + 3, 1, BD1, ic.velvet); lot.box(A0, 2, BD1, A0 + 3, 4, BD1, ic.velvetDark); // settee
        lot.box(A1 - 3, 0, BD0 + 2, A1 - 1, 2, BD0 + 4, ic.wainDark); // desk
        lot.box(A1 - 3, 3, BD0 + 2, A1 - 1, 3, BD0 + 4, (a, _y, d) => ((a + d) % 2 ? ic.paper : ic.wainDark));
        shelfRun(A0, BD0, A0, BD1 - 2, 9, [ic.bookA, ic.bookC, ic.bookF, ic.paper], ic.wainDark);
        lot.box(midA - 2, 6, dep - 2, midA + 2, 10, dep - 2, (a, y) => (a === midA - 2 || a === midA + 2 ? ic.wainDark : y === 8 && a === midA ? ic.ink : ic.paper)); // hanging scroll
        const [nx, nz] = P(A1 - 2, BD0 + 3.5);
        b.secret = { shelf: [sx, 1.4, sz], shelfStand: P((ga0 + ga1 + 1) / 2, D1 - 2.2), gate: [Math.min(gx0, gx1), Math.min(gz0, gz1), Math.max(gx0, gx1), Math.max(gz0, gz1)], note: [nx, 0.85, nz], noteStand: P(A1 - 2, BD0 + 6.5) };
        b.darumaSpots.unshift({ kind, pos: withY(P(A0 + 2, BD1 - 0.5), 0.5), secret: true }); // on the settee's seat
        lampAt((A0 + A1 + 1) / 2, (BD0 + BD1 + 1) / 2, 2.2, [1.0, 0.62, 0.32], 5, 1.2);
      } else {
        shelfRun(A0 + 2, D1, back ? bda - 2 : A1 - 2, D1, 10, books, ic.wainDark);
      }
      spot('buy', A1 - 1, D0 + 1, 0.9, A1 - 3.5, D0 + 2.5);
      lampAt((A0 + A1 + 1) / 2, D0 + 5, 2.5, WARM, 7, 1.0);
      break;
    }
    case 'fish': {
      // ice beds along the left wall and the window
      const ice = (a0: number, d0: number, a1: number, d1: number) => {
        lot.box(a0, 0, d0, a1, 2, d1, ic.styro);
        lot.box(a0, 3, d0, a1, 3, d1, (a, _y, d) => (hash3(a, d, o.seed) < 0.55 ? [ic.fishA, ic.fishB, ic.fishC, ic.fishA][(a + d * 3) % 4] : ic.ice));
      };
      ice(A0, D0 + 2, A0 + 1, D1 - 4);
      if (leftA1 - A0 > 1) ice(A0 + 2, D0, leftA1, D0);
      lot.box(A0, 0, D1, back ? bda - 2 : A1, 6, D1, (_a, y) => (y <= 1 ? c.trim : ic.tank));
      counter(midA, D1 - 4, midA + 3, D1 - 3, c.trim, ic.tileW);
      npc('keeper', midA + 2, D1 - 1.5, OUT);
      spot('buy', midA + 2, D1 - 3.5, 1.2, midA + 2, D1 - 5.5);
      lampAt(midA + 0.5, D0 + 5, 2.6, COOL, 7, 1.0);
      break;
    }
    case 'bakery': {
      put(breadShelf(k, o.seed), A0 + 0.65, D0 + 4, 0, PA, 0);
      // a second shelf only where it keeps clear of the counter and the queue in front of it
      const two = D1 - D0 >= 16;
      if (two) put(breadShelf(k, o.seed + 1), A0 + 0.65, D0 + 8, 0, PA, 0);
      blockCells(A0, D0 + 2, A0 + 1, two ? D0 + 9 : D0 + 5);
      // glass case counter with breads, oven glowing behind
      const { ka, a1 } = backCounter(ic.wain, ic.case);
      for (let a = A0; a <= a1; a++) lot.set(a, 2, D1 - 3, (a % 3) ? ic.bread : ic.melon);
      lot.box(A0, 0, D1, Math.min(a1, A0 + 3), 6, D1, (a, y) => (y >= 2 && y <= 3 && a > A0 && a < A0 + 3 ? ic.oven : ic.brick));
      lot.box(midA - 1, 0, D0 + 5, midA + 1, 2, D0 + 6, ic.wain);
      lot.box(midA - 1, 3, D0 + 5, midA + 1, 3, D0 + 6, (a, _y, d) => ((a + d) % 2 ? ic.melon : ic.breadDark));
      spot('buy', ka, D1 - 2.5, 1.2, ka, D1 - 4.8);
      lampAt(ka, D1 - 1, 1.2, [1.0, 0.5, 0.2], 4, 1.0);
      lampAt(midA + 0.5, D0 + 4, 2.6, WARM, 7, 1.0);
      break;
    }
    case 'pharmacy': {
      shelfRun(A0, D0 + 2, A0 + 1, D1 - 1, 7, goods, c.trim);
      shelfRun(A0 + 4, D0 + 4, A0 + 5, D1 - 4, 5, goods, c.trim);
      const { ka } = backCounter(c.trim, ic.tileW);
      lot.box(A0, 5, D1, A0 + 3, 6, D1, ic.cross);
      spot('buy', ka, D1 - 2.5, 1.2, ka, D1 - 4.8);
      lampAt(midA + 0.5, D0 + 5, 2.7, COOL, 8, 1.0);
      break;
    }
    case 'hotel': {
      // the front desk across the back of the lobby, with the key cubbies on the wall behind it
      const hi = o.hotel!;
      const { ka, a1 } = backCounter(ryokan ? c.woodDark : ic.wainDark, ryokan ? c.hinoki : ic.marbleW);
      lot.set(Math.min(a1, Math.floor(ka) + 2), 4, D1 - 3, ic.brass); // the bell
      const wd = back ? pb : dep - 2;
      lot.box(A0 + 4, 5, wd, a1, 7, wd, (a, y) => (y === 6 && a % 2 === 1 ? (hash3(a, y, o.seed) < 0.6 ? ic.brass : ic.wain) : ic.wainDark));
      spot('buy', ka, D1 - 2.5, 1.2, ka, D1 - 4.5);
      // the lift (stairs in a ryokan) on the right wall by the back of the lobby
      const ld0 = D1 - 9, ld1 = D1 - 4, lm = (ld0 + ld1 + 1) / 2;
      if (ryokan) {
        for (let s = 0; s < 6; s++) lot.box(A1 - 2, 0, ld0 + s, A1, s * 2 + 1, ld0 + s, (_a, y) => (y === s * 2 + 1 ? c.hinoki : c.woodMid));
        lot.box(A1 - 3, 0, ld0, A1 - 3, 2, ld0, c.woodDark); // newel post
        room.lift = { stand: P(A1 - 0.5, ld0 - 1.6), pick: withY(P(A1 - 0.5, ld0 + 2), 1.4), facing: face(IN) };
      } else {
        lot.box(A1 + 1, 0, ld0, A1 + 1, 9, ld1, (_a, y, d) => (y === 9 ? (d === Math.floor(lm) || d === Math.floor(lm) - 1 ? ic.liftLit : c.steelDark)
          : d === ld0 || d === ld1 || y === 8 ? c.steelDark : d === Math.floor(lm) - 1 ? ic.steel : ic.liftDoor));
        lot.box(A1 + 1, 4, ld1 + 1, A1 + 1, 4, ld1 + 1, ic.liftLit); // call button
        room.lift = { stand: P(A1 - 1.5, lm), pick: withY(P(A1 + 0.5, lm), 1.6), facing: face(PA) };
      }
      // a sofa and a low table by the window for guests waiting on friends
      const sd0 = D0 + 2, sd1 = Math.min(D0 + 6, D1 - 10);
      if (sd1 - sd0 >= 2) {
        lot.box(A0, 0, sd0, A0 + 1, 1, sd1, ryokan ? ic.zabutonB : ic.velvet);
        lot.box(A0, 2, sd0, A0, 3, sd1, ryokan ? c.woodDark : ic.velvetDark);
        lot.box(A0 + 3, 0, sd0 + 1, A0 + 4, 1, sd1 - 1, (_a, y) => (y === 1 ? c.hinoki : ic.wainDark));
        npc('guest', A0 + 1, (sd0 + sd1 + 1) / 2, PA, true);
      }
      lot.box(midA - 2, -1, D0 + 3, Math.min(A1 - 3, midA + 3), -1, D1 - 5, (a, _y, d) => (a === midA - 2 || d === D0 + 3 ? ic.duvetGold : ryokan ? ic.zabutonB : ic.carpetRed));
      put(plantPot(k, 'bamboo', o.seed + 4), A1 - 0.6, D0 + 1.4, 0, OUT, 0.2);
      put(pendant(k, ryokan ? k.c.lanternWhite : k.c.lanternAmber), (A0 + A1 + 1) / 2, D0 + 6, 2.15, OUT);
      lampAt((A0 + A1 + 1) / 2, D0 + 5, 2.6, WARM, 8, 1.0);
      lampAt(ka, D1 - 2, 2.4, WARM, 5, 0.8);
      room.hotel = hi.id;
      break;
    }
    case 'soba': {
      // noodle-making station behind the left window: board, flour, the long knife
      lot.box(A0, 0, D0, leftA1, 2, D0 + 1, c.woodMid);
      lot.box(A0, 3, D0, leftA1, 3, D0 + 1, (a, _y, d) => ((a + d) % 3 === 0 ? ic.flour : ic.board));
      // raised tatami platform (zashiki) along the left wall with low tables and cushions
      const zd0 = D0 + 4, zd1 = D1 - 1, za1 = A0 + 4;
      lot.box(A0, 0, zd0, za1, 0, zd1, (a, _y, d) => (a === za1 || d === zd0 || d === zd1 ? c.tatamiEdge : c.tatami));
      for (let d = zd0 + 2; d + 2 <= zd1; d += 5) {
        lot.box(A0 + 1, 1, d, A0 + 2, 3, d + 1, c.woodDark);
        lot.set(A0 + 3, 1, d, ic.zabuton); lot.set(A0 + 3, 1, d + 1, ic.zabuton);
        lot.set(A0 + 1, 4, d, ic.cup);
        npc('guest', A0 + 3.6, d + 1, NA, true);
      }
      // counter on the right with the open kitchen behind it
      const ca = A1 - 3;
      counter(ca, D0 + 4, ca + 1, D1, c.cedar, c.hinoki);
      lot.box(A1, 0, D1 - 4, A1, 3, D1 - 1, ic.steelDark);
      lot.box(A1, 4, D1 - 4, A1, 4, D1 - 1, ic.steel);
      const [ex, ez] = P(A1 + 0.5, D1 - 2);
      b.emitters.push({ kind: 'steam', pos: [ex, 1.15, ez], rate: 0.9 });
      b.place(bowlStack(ic, o.seed), ...withY(P(ca + 1, D0 + 5.5), 1.0), turn(NA));
      for (let d = D0 + 6; d <= D1 - 1; d += 3) put(stool(k, k.c.woodDark), ca - 1.2, d + 0.5, 0, PA);
      npc('guest', ca - 1.2, D0 + 9.5, PA, true);
      npc('keeper', A1, D0 + 8, NA);
      put(lantern(k, k.c.lanternWhite, 4, 5, o.seed + 3), (A0 + A1 + 1) / 2, D0 + 6, 2.3, OUT);
      spot('buy', ca, D0 + 8, 1.2, ca - 2.4, D0 + 8);
      lampAt((A0 + A1 + 1) / 2, D0 + 6, 2.3, WARM, 7, 1.2);
      lampAt(A1 - 1, D1 - 3, 2.3, WHITE, 5, 0.8);
      if (o.restaurant) room.stall = o.restaurant.id;
      break;
    }
  }

  // restaurants: the chef works the counter, the player orders from in front of it
  if (o.restaurant) {
    const st = room.npcs.findIndex((n) => n.role === 'keeper');
    const spotI = room.spots.findIndex((s) => s.kind === 'buy');
    const keeper = st >= 0 ? room.npcs.splice(st, 1)[0] : null;
    const buy = spotI >= 0 ? room.spots.splice(spotI, 1)[0] : null;
    if (keeper && buy) {
      const [lx, lz] = front(w / 2, 0.6);
      b.stallAnchors.push({ id: o.restaurant.id, stand: buy.stand, vendor: [keeper.pos[0], keeper.pos[2], keeper.facing], label: [lx, 3.9, lz] });
      // dishes on display by the register
      const [fx, fz] = [buy.pos[0], buy.pos[2]];
      b.place(buildFood(o.restaurant.foods[0], b.pal), fx, 1.0, fz, turn(OUT));
    }
  }

  // back room: storage, with a spot for something small to hide
  if (back && !o.secret) {
    const s1 = BD1;
    put(crateStack(k, o.seed + 11), A0 + 2, s1 - 1, 0, OUT, 0.5); // in the corner, clear of both walls
    lot.box(A0 + 4, 0, s1, Math.min(bda - 2, A0 + 6), 6, s1, (a, y) => (y % 3 === 0 ? c.woodMid : goods[(a + y) % goods.length]));
    if (BD1 - BD0 >= 6) lot.box(A1, 0, BD0 + 2, A1, 4, BD0 + 4, (_a, y) => (y % 2 ? c.goodsF : c.woodMid));
    darumaAt(A1 - 0.5, BD1 - 0.5, 0);
    lampAt(bda + 1.5, (BD0 + BD1 + 1) / 2, 2.2, WHITE, 4.5, 0.7);
  } else if (!back) {
    darumaAt(A0 + 0.6, D0 + 1.1, 0);
  }

  // ---- the walls: a clock over the counter side, a calendar and a picture, menu strips or a poster
  {
    const wd = back ? pb : dep - 2; // the wall the room faces from the door
    const wr = rng(o.seed * 17 + 5); // (only outside the box callbacks, which a worker skips off its strip)
    // repaint wall cells only, never fill an opening
    const paint = (a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, col: number | ((a: number, y: number, d: number) => number)) =>
      lot.box(a0, y0, d0, a1, y1, d1, (a, y, d) => (lot.get(a, y, d) ? (typeof col === 'number' ? col : col(a, y, d)) : 0));
    if (A0 + 3 < bda - 1) {
      paint(A0 + 1, 8, wd, A0 + 3, 10, wd, (a, y) => (a === A0 + 2 && y === 9 ? ic.ink : c.trim));
      paint(A0 + 2, 9, wd, A0 + 2, 9, wd, ic.paper);
      paint(A0 + 2, 10, wd, A0 + 2, 10, wd, ic.ink);
    }
    if (kind === 'izakaya' || kind === 'soba') {
      // tanzaku: the paper menu strips along the wall, a brushed dish name on each
      for (let a = A0 + 5; a <= bda - 2; a += 2) paint(a, 5, wd, a, 9, wd, (aa, y) => (y === 9 ? c.lacquer : (y === 7 || y === 6) && hash3(aa, y, o.seed) < 0.7 ? ic.ink : ic.paper));
    } else if (A0 + 8 < bda - 1 && kind !== 'konbini' && kind !== 'pharmacy' && kind !== 'hotel') {
      const bg = [k.c.signRed, k.c.signBlue, k.c.signYellow, k.c.fabricGreen][Math.floor(wr() * 4)];
      paint(A0 + 5, 5, wd, A0 + 7, 8, wd, (a, y) => (y === 8 || a === A0 + 6 && y === 6 ? ic.paper : bg));
    }
    const sideA = wr() < 0.5 ? A0 - 1 : A1 + 1;
    if (D1 - D0 >= 8) {
      // a calendar with its red top, and a framed print further along
      paint(sideA, 5, D0 + 3, sideA, 7, D0 + 4, (_a, y) => (y === 7 ? c.lacquer : ic.paper));
      const art = [k.c.fabricBlue, k.c.pink, k.c.leaf][Math.floor(wr() * 3)];
      paint(sideA, 6, D0 + 6, sideA, 8, D0 + 8, (_a, y, d) => (y === 6 || y === 8 || d === D0 + 6 || d === D0 + 8 ? c.woodDark : art));
    }
  }

  void G;
  b.rooms.push(room);
}

function withY(p: [number, number], y: number): [number, number, number] {
  return [p[0], y, p[1]];
}

/** Voxel-space box of the interior air, for indoor ambient light. */
function voxBox(lot: Lot, a0: number, d0: number, a1: number, d1: number): [number, number, number, number, number, number] {
  const [x0, z0] = lot.xz(a0, d0), [x1, z1] = lot.xz(a1, d1);
  return [Math.min(x0, x1), G, Math.min(z0, z1), Math.max(x0, x1), G + 11, Math.max(z0, z1)];
}

/**
 * A ground floor you cannot walk into but can see when the cutaway opens it: a shuttered shop's
 * storeroom or the front room of a home behind a plain door.
 */
export function closedRoom(lot: Lot, kind: 'storage' | 'home', seed: number, trim: number): void {
  const b = lot.b as Builder, c = b.c, k = b.k, ic = b.ic;
  const w = lot.width, dep = lot.depth;
  const sw = w >= 15 ? 2 : 1;
  const A0 = sw, A1 = w - 1 - sw, D0 = 2, D1 = dep - 3;
  const home = kind === 'home';
  const finish = (y: number) => (y <= 3 ? (home ? ic.wain : c.concreteDark) : y === 4 ? trim : home ? c.plaster : c.concreteWall);
  lot.box(A0, 0, D0, A1, 11, D1, 0);
  lot.box(A0, -1, D0, A1, -1, D1, home ? (a: number, _y: number, d: number) => ((a - A0) % 6 === 0 || (d - D0) % 12 === 0 ? c.tatamiEdge : c.tatami) : (a: number, _y: number, d: number) => (hash3(a, d, seed) < 0.5 ? ic.doma : ic.domaB));
  lot.box(A0 - 1, 0, D0, A0 - 1, 11, D1, (_a, y) => finish(y));
  lot.box(A1 + 1, 0, D0, A1 + 1, 11, D1, (_a, y) => finish(y));
  lot.box(A0, 0, D0 - 1, A1, 11, D0 - 1, (a, y, d) => (lot.get(a, y, d) && lot.get(a, y, d - 1) ? finish(y) : lot.get(a, y, d)));
  lot.box(A0, 0, D1 + 1, A1, 11, D1 + 1, (_a, y) => finish(y));
  b.indoor.push(voxBox(lot, A0, D0, A1, D1));
  const r = rng(seed * 13 + 1);
  const P = (a: number, d: number) => lot.m(a, d);
  const mid = Math.floor((A0 + A1) / 2);
  if (home) {
    // genkan: a sunken entry by the door, then tatami, a kotatsu, a tansu chest and a little TV
    lot.box(mid - 1, -1, D0, mid + 1, -1, D0 + 2, c.stoneStep);
    lot.box(mid - 2, 0, D0 + 6, mid + 2, 1, D0 + 9, c.woodMid);
    lot.box(mid - 3, 0, D0 + 5, mid + 3, 0, D0 + 10, (a, _y, d) => (a === mid - 3 || a === mid + 3 || d === D0 + 5 || d === D0 + 10 ? ic.zabutonB : 0));
    lot.box(mid - 2, 2, D0 + 6, mid + 2, 2, D0 + 9, c.hinoki);
    lot.set(mid, 3, D0 + 7, ic.cup);
    lot.box(A0, 0, D1 - 1, A0 + 3, 6, D1, (_a, y) => (y % 2 ? c.woodDark : c.woodMid));
    lot.box(A1 - 3, 0, D1, A1, 1, D1, c.woodDark);
    lot.box(A1 - 3, 2, D1, A1 - 1, 4, D1, (a, y) => (a === A1 - 3 || y === 4 ? ic.record : ic.tank));
    b.place(plantPot(k, 'shrub', seed), ...pt(P(A1 - 0.5, D0 + 1.5)));
    const [lx, lz] = P((A0 + A1 + 1) / 2, D0 + 8);
    b.lamp(lx, 2.3, lz, [1.0, 0.75, 0.48], 6, 0.9);
  } else {
    // a shuttered shop's stock room: crates, boxes and a delivery bicycle waiting for Monday
    for (let i = 0; i < 6; i++) {
      const a = A0 + Math.floor(r() * Math.max(1, A1 - A0 - 2)), d = D0 + 2 + Math.floor(r() * Math.max(1, D1 - D0 - 4));
      const hgt = 1 + Math.floor(r() * 5);
      lot.box(a, 0, d, a + 1 + Math.floor(r() * 2), hgt, d + 1, (_x, y) => [c.goodsB, c.woodMid, c.goodsF, ic.paperWall][(y + i) % 4]);
    }
    lot.box(A0, 0, D1, A1, 7, D1, (a, y) => (y % 3 === 0 ? ic.steelDark : [c.goodsA, c.goodsC, ic.paperWall, 0][(a + y) % 4]));
    const [lx, lz] = P((A0 + A1 + 1) / 2, (D0 + D1) / 2);
    b.lamp(lx, 2.4, lz, [0.8, 0.9, 1.0], 5, 0.4);
  }
}

function pt(p: [number, number]): [number, number, number] {
  return [p[0], 0, p[1]];
}
