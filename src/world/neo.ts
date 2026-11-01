// Halcyon City, 2040: the cyberpunk city of the 2040 game. A rain-dark grid of districts round the Halo crossing:
// the Lantern Market's night stalls, the Spire's corporate towers, the Stacks' housing blocks, the Neon Mile's bars,
// the Black Canal and the Rust Docks on the bay. Built on Tasty World's builder (world/tokyo.ts Lot and building),
// from the pure plan in world/neoPlan.ts.
import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, SX, SZ, V, VX0, VZ0, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, Lot, building, flatRoof, stall, WARM, COOL, WHITEWARM, RED, type BuildResult, type Window, type Anchors, type StallAnchor, type PlacedProp, type BuildingOpts, type Ground, type Style, type Side } from './tokyo';
import { neonDress, tree } from './city';
import { dressBlock } from './facades';
import { shopFloor } from './interiors';
import { Prop, rotateProp, streetLamp, bench, vendingMachine, wire, acUnit, crateStack, scooter, stool, plantPot, binCorner, utilityBox, hangingSign, lantern, glyph } from './props';
import { buildFood } from './food';
import { hiddenKitchenDress } from './dining';
import { HOTEL } from '../data/hotels';
import type { HotelInfo } from '../data/hotels';
import { SEGS, BLOCKS, BRIDGES, CANAL, BAY_X, neoGraph, type District, type Seg } from './neoPlan';

const M = (m: number) => Math.round(m / V); // metres -> voxels
/** The Halo's open square round the crossing (metres). */
export const PLAZA_R = 26;

function neoColors(b: Builder) {
  const a = (hex: number, vary = 0.05, o: { emit?: number; night?: boolean; glass?: boolean; leaf?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
  return {
    // the ground: rain-dark asphalt, basalt pavers, worn concrete
    asphalt: a(0x2c2f36, 0.05), asphaltB: a(0x33363e, 0.05), puddle: a(0x22262e, 0.03), lineY: a(0xd9b84a, 0.03), lineW: a(0xcfd2d6, 0.03),
    paver: a(0x4a4d55, 0.06), paverB: a(0x55585f, 0.06), paverC: a(0x3f4249, 0.06), kerb: a(0x6c6f75, 0.04), grate: a(0x1f2124, 0.03),
    lane: a(0x3d3b3a, 0.08), laneB: a(0x47443f, 0.08), gutter: a(0x26282c, 0.04),
    quay: a(0x5e5d5a, 0.07), quayB: a(0x6a6864, 0.07), hazardY: a(0xe0b030, 0.03), hazardK: a(0x1e1e22, 0.03),
    seaWall: a(0x4f504f, 0.08), seaWallDark: a(0x3a3c3c, 0.08), algae: a(0x2f4a3a, 0.12), mud: a(0x2a2a28, 0.1),
    // light set into the ground
    guideCyan: a(0x46e8ff, 0.03, { emit: 0.9 }), guidePink: a(0xff4fa8, 0.03, { emit: 0.9 }), haloRing: a(0x7ff6ff, 0.02, { emit: 1.0 }),
    plazaA: a(0x2a2d38, 0.04), plazaB: a(0x353948, 0.04), plazaGlass: a(0x1a2a3a, 0.03, { glass: true }),
    // walls
    concrete: a(0x6b6d70, 0.07), concreteDark: a(0x4a4c50, 0.07), soot: a(0x3a3b3f, 0.06), tileGrey: a(0x8a8c8e, 0.05), tileTeal: a(0x3f6a6a, 0.05),
    rustRed: a(0x7a3e2c, 0.08), rustBrown: a(0x5a3a2a, 0.08), maroon: a(0x5a2a32, 0.05), navy: a(0x2a3248, 0.05), plum: a(0x3e2e48, 0.05),
    blackGlass: a(0x1c2430, 0.03, { glass: true }), blueGlass: a(0x2a4058, 0.04, { glass: true }), litGlass: a(0x7fa6c8, 0.04, { emit: 0.75, night: true, glass: true }),
    corrugated: a(0x6a7074, 0.06), corrugatedB: a(0x58606a, 0.06), container: [a(0xb0432e, 0.04), a(0x2e6a9a, 0.04), a(0xd8a63a, 0.04), a(0x3e7a4e, 0.04), a(0x8a8e92, 0.04), a(0x6a3a7a, 0.04)],
    steel: a(0x6a7078, 0.04), steelDark: a(0x3a3e44, 0.04), yellowSteel: a(0xd8a830, 0.04), chrome: a(0xb8c0c8, 0.03),
    neon: [a(0xff4fa8, 0.02, { emit: 1 }), a(0x46e8ff, 0.02, { emit: 1 }), a(0xa070ff, 0.02, { emit: 1 }), a(0xffd84a, 0.02, { emit: 1 }), a(0x6dff9a, 0.02, { emit: 1 }), a(0xff7a3a, 0.02, { emit: 1 })],
    screen: [a(0x3a5aff, 0.08, { emit: 0.85 }), a(0xff4fa8, 0.08, { emit: 0.85 }), a(0x46e8ff, 0.08, { emit: 0.85 }), a(0xfff0c8, 0.05, { emit: 0.9 })],
    screenDark: a(0x12141c, 0.03),
    soil: a(0x3a2e26, 0.1), moss: a(0x3e5a32, 0.12, { leaf: true }), grow: a(0xc070ff, 0.03, { emit: 0.9 }), growLeaf: a(0x4a9a4a, 0.14, { leaf: true }), growLeafB: a(0x6aba5a, 0.12, { leaf: true }),
  };
}
type NC = ReturnType<typeof neoColors>;
const NEON_RGB: [number, number, number][] = [[1, 0.35, 0.7], [0.3, 0.9, 1], [0.65, 0.45, 1], [1, 0.85, 0.35], [0.45, 1, 0.65], [1, 0.55, 0.3]];

// ---------------------------------------------------------------------------------------------
// Ground: streets, quays, the canal and the bay

const inBridge = (zm: number) => BRIDGES.some(([a, b]) => zm >= a && zm < b);
const isWater = (xm: number, zm: number) => (xm >= CANAL.x0 && xm < CANAL.x1 && !inBridge(zm)) || (xm >= BAY_X && !(Math.abs(zm + 38) < 2 || Math.abs(zm - 42) < 2 || Math.abs(zm - 120) < 2));

function segAt(xm: number, zm: number): Seg | null {
  let best: Seg | null = null;
  for (const s of SEGS) {
    const along = s.ew ? xm : zm, across = s.ew ? zm : xm;
    if (along < s.a0 || along >= s.a1 || Math.abs(across - s.c) > s.w / 2) continue;
    // where streets cross, the wider one paints the crossing
    if (!best || s.w > best.w) best = s;
  }
  return best;
}

function ground(b: Builder, n: NC) {
  const g = b.grid;
  const x0 = Math.max(VX0, g.wx0), x1 = Math.min(VX0 + SX, g.wx1), z0 = Math.max(VZ0, g.wz0), z1 = Math.min(VZ0 + SZ, g.wz1);
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      const xm = (x + 0.5) * V, zm = (z + 0.5) * V;
      if (isWater(xm, zm)) {
        // the canal bed, the bay floor
        g.set(x, 1, z, n.mud);
        for (let y = 0; y < 1; y++) g.set(x, y, z, n.mud);
        const h = hash3(x, 5, z);
        if (h > 0.97) g.set(x, 2, z, n.algae);
        continue;
      }
      // a sea wall where land meets water
      const wet = isWater(xm - V, zm) || isWater(xm + V, zm) || isWater(xm, zm - V) || isWater(xm, zm + V);
      for (let y = 0; y < G - 1; y++) g.set(x, y, z, wet ? (y < 8 ? (hash3(x, y, z) < 0.5 ? n.algae : n.seaWallDark) : (Math.floor(y / 2) + Math.floor((x + z) / 4)) % 5 === 0 ? n.seaWallDark : n.seaWall) : n.mud);
      g.set(x, G - 1, z, surfaceAt(n, x, z, xm, zm));
    }
}

function surfaceAt(n: NC, x: number, z: number, xm: number, zm: number): number {
  const h = hash3(x, 7, z);
  // the Halo crossing: rings of dark pavers round the hologram, a ring of light set into the stone
  const r = Math.hypot(xm, zm);
  if (r < PLAZA_R) {
    if (Math.abs(r - 15) < 0.2 || Math.abs(r - 6.2) < 0.15) return n.haloRing;
    const ring = Math.floor(r / 1.5), ang = Math.floor(((Math.atan2(zm, xm) + Math.PI) / (Math.PI * 2)) * (ring * 6 + 6));
    return r < 6 ? n.plazaGlass : (ring + ang) % 2 ? n.plazaA : n.plazaB;
  }
  const s = segAt(xm, zm);
  if (!s) return h < 0.5 ? n.concreteDark : n.concrete;
  const across = (s.ew ? zm : xm) - s.c, along = s.ew ? xm : zm, half = s.w / 2, edge = half - Math.abs(across);
  const vx = s.ew ? z : x, va = s.ew ? x : z;
  switch (s.kind) {
    case 'avenue': {
      // a pedestrian boulevard: basalt pavers in a herringbone, light strips down both sides of the middle,
      // a dark glass median with cyan guide lines
      if (Math.abs(Math.abs(across) - 2.2) < 0.13) return n.guideCyan;
      if (Math.abs(across) < 2.2) return (va >> 1) % 6 === 0 ? n.guidePink : n.plazaGlass;
      if (edge < 0.25) return n.kerb;
      if (h > 0.985) return n.grate;
      return ((va >> 1) + (vx >> 1)) % 3 === 0 ? n.paverB : (va + vx) % 7 === 0 ? n.paverC : n.paver;
    }
    case 'street':
    case 'edge': {
      // pavements either side of a wet carriageway; the hover traffic flies above it
      if (edge < 1.75) return edge > 1.5 ? n.kerb : (va + (vx & 1) * 2) % 4 === 0 ? n.paverC : n.paver;
      if (Math.abs(across) < 0.13 && (va >> 2) % 3 !== 0) return n.lineY;
      if (h > 0.996) return n.grate; // manholes
      return h < 0.18 ? n.puddle : h < 0.5 ? n.asphaltB : n.asphalt;
    }
    case 'lane':
      if (Math.abs(across) < 0.15) return (va & 3) === 0 ? n.grate : n.gutter;
      return h < 0.2 ? n.puddle : h < 0.55 ? n.laneB : n.lane;
    case 'quay': {
      const toWater = s.c < CANAL.x0 ? CANAL.x0 - xm : s.c > BAY_X - 4 ? BAY_X - xm : xm - CANAL.x1;
      if (toWater < 0.6 && toWater >= 0) return (Math.floor(along * 2) & 1) ? n.hazardY : n.hazardK;
      return ((Math.floor(along / 1.5) + Math.floor(across / 1.5)) & 1) ? n.quay : n.quayB;
    }
  }
  return n.concrete;
}

// ---------------------------------------------------------------------------------------------
// Buildings

interface Plan { x0: number; z0: number; x1: number; z1: number; side: Side; d: District; seed: number; use?: Use }
type Use = { stall?: string; restaurant?: { id: string; kind: Ground }; hotel?: HotelInfo; hidden?: boolean; helix?: boolean; mall?: boolean; home?: boolean };

/** The docks' two container yards, east of Crane Street at either end. */
export const YARDS: [number, number, number, number][] = [[172, -160, 200, -95], [172, 95, 200, 160]];
const isYard = (r: [number, number, number, number]) => YARDS.some((y) => y[0] === r[0] && y[1] === r[1]);
const DEPTH: Record<District, number> = { lantern: 48, spire: 64, stacks: 56, neonmile: 44, docks: 72 };
const WIDTH: Record<District, [number, number]> = { lantern: [16, 28], spire: [44, 76], stacks: [28, 44], neonmile: [20, 32], docks: [40, 72] };

/** Every lot of the city, front by front round each block, and the inner masses left over (voxels). */
function planLots(): { lots: Plan[]; cores: { rect: [number, number, number, number]; d: District; seed: number }[] } {
  const lots: Plan[] = [];
  const cores: { rect: [number, number, number, number]; d: District; seed: number }[] = [];
  let seed = 7000;
  const strip = (d: District, side: Side, a0: number, a1: number, f0: number, f1: number) => {
    const r = rng(seed += 17);
    const [wMin, wMax] = WIDTH[d];
    let a = a0;
    while (a <= a1) {
      let w = wMin + Math.floor(r() * ((wMax - wMin) / 4 + 1)) * 4;
      if (a + w - 1 > a1 || a1 - (a + w - 1) < wMin) w = a1 - a + 1;
      const ns = side === 's' || side === 'n';
      lots.push(ns ? { x0: a, z0: f0, x1: a + w - 1, z1: f1, side, d, seed: seed + a } : { x0: f0, z0: a, x1: f1, z1: a + w - 1, side, d, seed: seed + a });
      a += w;
    }
  };
  for (const bl of BLOCKS) {
    const [mx0, mz0, mx1, mz1] = bl.rect;
    if (isYard(bl.rect)) continue;
    const bx0 = M(mx0), bz0 = M(mz0), bx1 = M(mx1) - 1, bz1 = M(mz1) - 1;
    const w = bx1 - bx0 + 1, dd = bz1 - bz0 + 1;
    const D = Math.min(DEPTH[bl.d], Math.floor(dd / 2));
    strip(bl.d, 'n', bx0, bx1, bz0, bz0 + D - 1);
    strip(bl.d, 's', bx0, bx1, bz1 - D + 1, bz1);
    const mid0 = bz0 + D, mid1 = bz1 - D;
    if (mid1 - mid0 + 1 >= 16) {
      const Dx = Math.min(DEPTH[bl.d], Math.floor(w / 2));
      strip(bl.d, 'w', mid0, mid1, bx0, bx0 + Dx - 1);
      strip(bl.d, 'e', mid0, mid1, bx1 - Dx + 1, bx1);
      if (bx1 - Dx - (bx0 + Dx) + 1 > 0) cores.push({ rect: [bx0 + Dx, mid0, bx1 - Dx, mid1], d: bl.d, seed: seed += 3 });
    } else if (mid1 >= mid0) cores.push({ rect: [bx0, mid0, bx1, mid1], d: bl.d, seed: seed += 3 });
  }
  // the Halo's square stays open: no building within PLAZA_R of the crossing
  const off = (r: [number, number, number, number]) => {
    const nx = Math.max(r[0] * V, Math.min(0, (r[2] + 1) * V)), nz = Math.max(r[1] * V, Math.min(0, (r[3] + 1) * V));
    return Math.hypot(nx, nz) >= PLAZA_R;
  };
  return { lots: lots.filter((p) => off([p.x0, p.z0, p.x1, p.z1])), cores: cores.filter((c) => off(c.rect)) };
}

const widthOf = (p: Plan) => (p.side === 's' || p.side === 'n' ? p.x1 - p.x0 + 1 : p.z1 - p.z0 + 1);
const depthOf = (p: Plan) => (p.side === 's' || p.side === 'n' ? p.z1 - p.z0 + 1 : p.x1 - p.x0 + 1);

/** Hand the named places, hotels and secrets to lots, spread through their districts. */
function assign(lots: Plan[]) {
  const free = (d: District, ok: (p: Plan) => boolean = () => true) => lots.filter((p) => p.d === d && !p.use && ok(p));
  const spread = (cands: Plan[], n: number, k: number) => cands[Math.min(cands.length - 1, Math.floor(((k + 0.5) * cands.length) / n))];
  const stallOk = (p: Plan) => widthOf(p) >= 16 && widthOf(p) <= 32 && depthOf(p) >= 12;
  const roomOk = (p: Plan) => widthOf(p) >= 16 && depthOf(p) >= 16;
  const hotelOk = (p: Plan) => widthOf(p) >= 24 && depthOf(p) >= 24;
  const put = (d: District, uses: Use[], ok: (p: Plan) => boolean) => {
    uses.forEach((u, k) => {
      const c = free(d, ok);
      const p = spread(c, uses.length, k);
      if (p) p.use = u;
    });
  };
  const H = (id: string) => HOTEL[id];
  // the Boulevard's own: the grand old hotel and the 24-hour konbini, facing Meridian
  const onMeridian = (p: Plan) => (p.side === 's' && Math.abs(p.z1 + 1 - M(-8)) <= 1) || (p.side === 'n' && Math.abs(p.z0 - M(8)) <= 1);
  put('lantern', [{ hotel: H('meridian') }], (p) => onMeridian(p) && hotelOk(p));
  put('stacks', [{ restaurant: { id: 'konbini', kind: 'konbini' } }], (p) => onMeridian(p) && roomOk(p));
  // the Eel Den on the canal walk
  put('spire', [{ restaurant: { id: 'eelden', kind: 'izakaya' } }], (p) => p.side === 'e' && p.x1 + 1 === M(112) && roomOk(p));
  put('lantern', [{ stall: 'mamalin' }, { stall: 'bao9' }], stallOk);
  put('lantern', [{ hotel: H('capsule9') }, { hotel: H('lanternlofts') }], hotelOk);
  put('lantern', [{ restaurant: { id: 'phosaigon', kind: 'soba' } }, { restaurant: { id: 'dumpling', kind: 'izakaya' } }, { restaurant: { id: 'tart', kind: 'bakery' } }], roomOk);
  put('spire', [{ helix: true }], (p) => widthOf(p) >= 56 && depthOf(p) >= 56);
  put('spire', [{ hotel: H('spiresuites') }, { hotel: H('zenithres') }], hotelOk);
  put('spire', [{ restaurant: { id: 'printbar', kind: 'izakaya' } }, { restaurant: { id: 'synth', kind: 'cafe' } }, { restaurant: { id: 'kopi', kind: 'kissa' } }], roomOk);
  put('stacks', [{ hotel: H('stackshostel') }, { hotel: H('kowaflats') }], hotelOk);
  put('stacks', [{ restaurant: { id: 'myco', kind: 'izakaya' } }], roomOk);
  put('stacks', [{ hidden: true }], (p) => widthOf(p) >= 32 && depthOf(p) >= 20 && p.x0 > M(-150));
  put('neonmile', [{ hotel: H('neonnest') }, { hotel: H('orbitmall') }], hotelOk);
  put('neonmile', [{ stall: 'boba' }, { stall: 'takoyard' }], stallOk);
  put('neonmile', [{ restaurant: { id: 'greenbun', kind: 'cafe' } }, { restaurant: { id: 'mochi', kind: 'bakery' } }, { restaurant: { id: 'crepe', kind: 'kissa' } }, { restaurant: { id: 'ion', kind: 'izakaya' } }], roomOk);
  put('docks', [{ stall: 'krillking' }, { stall: 'cricket' }], (p) => depthOf(p) >= 12 && widthOf(p) >= 16);
  put('docks', [{ hotel: H('rainmotel') }], hotelOk);
  put('docks', [{ restaurant: { id: 'skewer', kind: 'izakaya' } }], roomOk);
}

/** The palette a district builds in. */
function districtLook(n: NC, d: District, r: () => number) {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (d) {
    case 'lantern': return { floors: 3 + Math.floor(r() * 4), style: pick<Style>(['showa', 'showa', 'modern', 'apartment']), wall: pick([n.soot, n.concreteDark, n.maroon, n.tileGrey, n.rustBrown, n.tileTeal, n.concrete]), grounds: ['shop', 'cafe', 'izakaya', 'soba', 'bakery', 'konbini', 'fish', 'books', 'kissa', 'izakaya', 'shop', 'pharmacy'] as Ground[] };
    case 'spire': return { floors: 8 + Math.floor(r() * 3), style: 'modern' as Style, wall: pick([n.blackGlass, n.blueGlass, n.concrete, n.steelDark, n.navy, n.blackGlass]), grounds: ['shop', 'cafe', 'konbini', 'pharmacy', 'kissa', 'shop', 'bakery', 'books'] as Ground[] };
    case 'stacks': return { floors: 6 + Math.floor(r() * 4), style: 'apartment' as Style, wall: pick([n.concrete, n.concreteDark, n.tileGrey, n.tileTeal, n.soot, n.plum, n.rustRed]), grounds: ['plain', 'plain', 'plain', 'shop', 'konbini', 'pharmacy', 'cafe', 'bakery', 'soba', 'books'] as Ground[] };
    case 'neonmile': return { floors: 3 + Math.floor(r() * 5), style: pick<Style>(['modern', 'showa', 'modern']), wall: pick([n.navy, n.plum, n.maroon, n.blackGlass, n.soot, n.steelDark]), grounds: ['izakaya', 'izakaya', 'cafe', 'shop', 'kissa', 'soba', 'bakery', 'shop', 'konbini', 'books'] as Ground[] };
    case 'docks': return { floors: 2 + Math.floor(r() * 2), style: pick<Style>(['modern', 'showa']), wall: pick([n.corrugated, n.corrugatedB, n.rustRed, n.rustBrown, n.concreteDark]), grounds: ['shop', 'izakaya', 'fish', 'soba', 'shop', 'plain', 'cafe'] as Ground[] };
  }
}

const AWN = (b: Builder): [number, number][] => [[b.c.awnRed, b.c.awnNavy], [b.c.awnNavy, b.c.awnNavy], [b.c.awnGreen, b.c.awnNavy], [b.c.awnOrange, b.c.awnBrown], [b.c.awnPink, b.c.awnNavy], [b.c.awnBlue, b.c.awnNavy]];

const STALL_LOOK: Record<string, { foods: [string, string]; equip: 'griddle' | 'grill' | 'pot' | 'mold' }> = {
  mamalin: { foods: ['kelpramen', 'chiliwonton'], equip: 'pot' },
  bao9: { foods: ['vatbao', 'rainbuns'], equip: 'pot' },
  boba: { foods: ['neonboba', 'neontea'], equip: 'mold' },
  takoyard: { foods: ['takoball', 'gridcake'], equip: 'mold' },
  krillking: { foods: ['krillskewer', 'satay'], equip: 'grill' },
  cricket: { foods: ['cricketwrap', 'curryfries'], equip: 'griddle' },
};
const REST_FOODS: Record<string, [string, string]> = {
  printbar: ['printsushi', 'onigiri3d'], myco: ['mycobowl', 'hotpot'], eelden: ['eelrice', 'gyudon'], greenbun: ['spirulinaburger', 'karaagebox'],
  phosaigon: ['pho', 'laksa'], dumpling: ['dumplings', 'friedrice'], synth: ['synthsteak', 'bibimbap'], mochi: ['glowmochi', 'icecream'],
  tart: ['eggtart', 'cheesecake'], crepe: ['crepe', 'mangoslush'], kopi: ['coldbrew', 'katsusando2'], konbini: ['rationbar', 'noodlecup'],
  ion: ['ionsoda', 'jellydrink'], skewer: ['beefskewer', 'tofuskewer'],
};

/** Cyberpunk dress over a building's front: cables down the facade, stacked AC units, a holo panel, a sign. */
function cyberDress(lot: Lot, n: NC, H: number, floors: number, seed: number, d: District) {
  const b = lot.b, k = b.k;
  const r = rng(seed * 13 + 5);
  const w = lot.width;
  // cables dropping down the face in a loose bundle
  if (floors >= 3 && r() < 0.7) {
    const a = 1 + Math.floor(r() * (w - 2));
    for (let y = 13; y < H - 1; y++) if (lot.get(a, y, -1) === 0 && hash3(a, y, seed) < 0.92) lot.set(a, y, -1, (y + a) % 5 === 0 ? n.steelDark : b.c.trimDark);
  }
  // AC units stacked up a side of the face
  if (floors >= 3 && r() < 0.6) {
    const a = r() < 0.5 ? 2.2 : w - 2.2;
    for (let f = 1; f < floors; f++) if (r() < 0.7) lot.wallProp(acUnit(k), a, (14 + (f - 1) * 12 + 1) * V, 0);
  }
  // a holo panel: a framed screen of soft colour bands on the face, or a hanging sign
  if (floors >= 4 && w >= 16 && r() < (d === 'neonmile' || d === 'lantern' ? 0.65 : 0.35)) {
    const a0 = 2 + Math.floor(r() * Math.max(1, w - 14)), a1 = Math.min(w - 3, a0 + 8 + Math.floor(r() * 6));
    const y0 = 14 + 12 * (1 + Math.floor(r() * Math.max(1, floors - 3))) + 2, y1 = Math.min(H - 3, y0 + 7 + Math.floor(r() * 6));
    const ph = r() * 9, sc = n.screen;
    if (y1 > y0 + 3) {
      lot.box(a0, y0, -1, a1, y1, -1, (a, y) => {
        if (a === a0 || a === a1 || y === y0 || y === y1) return n.screenDark;
        const t = Math.sin((a + ph) * 0.45 + y * 0.2) + Math.cos(y * 0.5 - ph);
        return t > 1.0 ? sc[3] : t > 0 ? sc[(seed & 1) ? 0 : 2] : sc[1];
      });
      const [sx, sz] = lot.front((a0 + a1) / 2, 1.2);
      b.lamp(sx, ((y0 + y1) / 2) * V, sz, [0.6, 0.6, 1], 7, 0.55);
    }
  }
  if (d === 'lantern' && r() < 0.5) {
    const ci = Math.floor(r() * 6);
    lot.wallProp(hangingSign(k, [k.c.signRed, k.c.signBlack, k.c.signBlue][ci % 3], [k.c.neonPink, k.c.neonCyan, k.c.neonYellow, k.c.neonGreen, k.c.neonRed, k.c.neonWhite][ci], seed), r() < 0.5 ? 1.2 : w - 1.2, 3.6, 0.4);
  }
}

function neonBuilding(lot: Lot, n: NC, o: BuildingOpts, d: District) {
  const { H } = building(lot, o);
  if (o.floors >= 3) neonDress(lot, H, o.floors, o.seed);
  cyberDress(lot, n, H, o.floors, o.seed, d);
  return H;
}

/** Helix Dynamics: the tallest tower in the Spire, black glass on a lit plinth, the company's helix up its face. */
function helixTower(lot: Lot, n: NC, seed: number) {
  const b = lot.b;
  const w = lot.width, dep = lot.depth;
  const floors = 13;
  const { H } = building(lot, { floors, style: 'modern', ground: 'hotel', hotel: HOTEL.helix, seed, wall: n.blackGlass, signs: false, roof: 'flat' });
  // the double helix in light up the middle of the face
  const mid = w / 2;
  for (let y = 16; y < H - 2; y++) {
    const t = y * 0.24;
    for (const ph of [0, Math.PI]) {
      const a = Math.round(mid + Math.sin(t + ph) * 5);
      lot.set(a, y, -1, ph ? n.neon[1] : n.neon[2]);
    }
    if (y % 6 === 0) for (let a = Math.round(mid - Math.abs(Math.sin(y * 0.24)) * 5); a <= Math.round(mid + Math.abs(Math.sin(y * 0.24)) * 5); a++) lot.set(a, y, -1, n.neon[3]);
  }
  // a crown: a lit band round the top and a mast
  lot.box(0, H, -1, w - 1, H, -1, n.neon[1]);
  lot.box(Math.floor(w / 2), H, Math.floor(dep / 2), Math.floor(w / 2), H + 14, Math.floor(dep / 2), n.steel);
  lot.set(Math.floor(w / 2), H + 15, Math.floor(dep / 2), n.neon[0]);
  // HELIX in big glyphs over the door
  const gr = rng(424242);
  for (let i = 0; i < 5; i++) {
    const gl = glyph(gr, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (gl[4 - y][x]) lot.set(Math.floor(w / 2) - 15 + i * 6 + x, 15 + y, -1, n.neon[1]);
  }
  const [lx, lz] = lot.front(w / 2, 2);
  b.lamp(lx, 4.5, lz, [0.35, 0.9, 1], 10, 0.9);
  b.lamp(lx, H * V * 0.6, lz, [0.6, 0.45, 1], 12, 0.6);
}

/** A row of warehouses on the docks keeps its roller doors; the rest are workshops and bars. */
function warehouse(lot: Lot, n: NC, seed: number) {
  const b = lot.b;
  const w = lot.width, dep = lot.depth;
  const r = rng(seed);
  const H = 22 + Math.floor(r() * 3) * 4;
  const wall = r() < 0.5 ? n.corrugated : n.corrugatedB;
  lot.box(0, 0, 0, w - 1, H - 1, dep - 1, (a, y) => (a % 2 === 0 ? wall : y % 8 === 0 ? n.rustBrown : wall));
  b.occlude(lot.x0, lot.z0, lot.x1, lot.z1, H * V + 3, 0.95, 'building');
  // the floor inside is a working shop (a dock hub, a trader, a gear outlet): its door sits in the first gap
  // between the roller doors, and the roller doors either side stay down
  const doorA = 16;
  shopFloor(lot, { kind: 'shop', seed, trim: n.yellowSteel, awn: [n.yellowSteel, n.steelDark], awning: () => {}, doorA });
  // big roller doors with a lit sign over them
  for (let a0 = 3; a0 + 12 < w - 2; a0 += 18) {
    if (a0 + 11 >= doorA - 1 && a0 <= doorA + 4) continue;
    lot.box(a0, 0, 0, a0 + 11, 13, 0, (_a, y) => (y % 2 ? n.steel : n.steelDark));
    lot.box(a0 - 1, 14, -1, a0 + 12, 14, -1, n.yellowSteel);
    lot.box(a0 + 2, 16, -1, a0 + 9, 17, -1, n.neon[(seed + a0) % 6]);
  }
  // a saw-tooth roof
  // (the glazing is the steep face of each tooth, lit from the work floor inside, mullions every few cells)
  for (let d = 0; d < dep; d += 8) {
    for (let s = 0; s < 6; s++) lot.box(0, H + s, d + s, w - 1, H + s, Math.min(dep - 1, d + 7), n.corrugatedB);
    const zf = Math.min(dep - 1, d + 7);
    lot.box(0, H + 1, zf, w - 1, H + 5, zf, (a, y) => (a % 4 === 0 || y === H + 5 ? n.steelDark : (a + y) % 3 ? n.blackGlass : n.litGlass));
  }
  dressBlock(b, lot.x0, lot.z0, lot.x1, lot.z1, H, wall, seed);
  const [lx, lz] = lot.front(w / 2, 1.2);
  b.lamp(lx, 4.2, lz, WARM, 7, 0.8);
}

// ---------------------------------------------------------------------------------------------
// Landmarks

/** The Halo: a ring of light 15 m across standing over the crossing on a black pylon. */
function halo(b: Builder, n: NC) {
  const g = b.grid;
  // pylon and plinth
  g.box(M(-2), G, M(-2), M(2) - 1, G + 1, M(2) - 1, n.steelDark);
  g.box(M(-0.75), G + 2, M(-0.75), M(0.75) - 1, G + 18, M(0.75) - 1, n.blackGlass);
  for (let y = G + 3; y < G + 18; y += 3) g.box(M(-0.75), y, M(-0.75), M(0.75) - 1, y, M(0.75) - 1, n.guideCyan);
  // two rings crossed at right angles, lit
  const cy = 20 + 22, R = 22;
  for (let t = 0; t < 360; t += 0.6) {
    const a = (t * Math.PI) / 180;
    const u = Math.round(Math.cos(a) * R), v = Math.round(Math.sin(a) * R) + cy;
    if (v < 18) continue;
    g.set(u, G + v, 0, n.haloRing); g.set(u, G + v, -1, n.haloRing);
    g.set(0, G + v, u, n.neon[0]); g.set(-1, G + v, u, n.neon[0]);
  }
  b.lamp(0, (cy + 4) * V, 0, [0.4, 0.95, 1], 18, 1.2);
  b.lamp(0, 2, 0, [0.5, 0.9, 1], 10, 0.7);
  b.block(-2.2, -2.2, 2.2, 2.2);
  b.occlude(M(-6), M(-6), M(6), M(6), 12, 2, 'landmark');
  // benches round the pylon, facing it, and a ring of trees in steel planters at the square's edge
  const k = b.k;
  for (const [x, z, t, ang] of [[0, -11, 0, 0], [0, 11, 2, Math.PI], [-11, 0, 1, Math.PI / 2], [11, 0, 3, -Math.PI / 2]] as [number, number, number, number][]) {
    for (const o of [-2.4, 2.4]) {
      const bx = x + (t & 1 ? 0 : o), bz = z + (t & 1 ? o : 0);
      b.place(bench(k), bx, 0, bz, t);
      b.benches.push([bx, bz, ang]);
      b.block(bx - 0.9, bz - 0.9, bx + 0.9, bz + 0.9);
    }
  }
  for (let i = 0; i < 8; i++) {
    const a = ((i + 0.5) / 8) * Math.PI * 2, x = Math.cos(a) * 20, z = Math.sin(a) * 20;
    const X = M(x), Z = M(z);
    g.box(X - 4, G, Z - 4, X + 4, G, Z + 4, n.steelDark);
    g.box(X - 3, G, Z - 3, X + 3, G, Z + 3, n.moss);
    tree(b, X, Z, 4400 + i, 'keyaki', G + 1, 12, 0.9);
    b.block(x - 1.1, z - 1.1, x + 1.1, z + 1.1);
    b.lamp(x, 0.4, z, [0.35, 0.9, 1], 3, 0.5);
  }
}

/** Footbridge decks and railings over the canal; the bay's piers. */
function bridges(b: Builder, n: NC) {
  const g = b.grid;
  for (const [za, zb] of BRIDGES) {
    const z0 = M(za), z1 = M(zb) - 1;
    for (let x = M(CANAL.x0); x < M(CANAL.x1); x++) {
      for (let z = z0; z <= z1; z++) {
        g.set(x, G - 1, z, (x + z) % 3 ? n.steel : n.steelDark);
        g.set(x, G - 2, z, n.steelDark);
      }
      // railings along both edges, lit along the top
      for (const z of [z0, z1]) { g.box(x, G, z, x, G + 3, z, x % 4 === 0 ? n.steelDark : 0); g.set(x, G + 4, z, n.guideCyan); }
    }
    // girders under the deck
    for (let x = M(CANAL.x0); x < M(CANAL.x1); x += 6) g.box(x, G - 5, z0, x, G - 3, z1, n.steelDark);
  }
  // piers into the bay
  for (const zc of [-38, 42, 120]) {
    for (let x = M(BAY_X); x < M(216); x++) for (let z = M(zc - 2); z < M(zc + 2); z++) {
      g.set(x, G - 1, z, (x & 3) === 0 ? n.steelDark : n.quay);
      for (let y = 2; y < G - 1; y++) if ((x & 7) === 0 && (z === M(zc - 2) || z === M(zc + 2) - 1)) g.set(x, y, z, n.steelDark);
    }
  }
}

/** A dockside gantry crane over the quay. */
function crane(b: Builder, n: NC, x: number, z: number) {
  const g = b.grid;
  const X = M(x), Z = M(z);
  for (const [dx, dz] of [[0, 0], [16, 0], [0, 12], [16, 12]]) g.box(X + dx, G, Z + dz, X + dx + 1, G + 64, Z + dz + 1, n.yellowSteel);
  g.box(X, G + 64, Z, X + 17, G + 66, Z + 13, n.yellowSteel);
  g.box(X - 40, G + 66, Z + 5, X + 30, G + 68, Z + 8, n.yellowSteel);
  g.box(X + 4, G + 56, Z + 2, X + 12, G + 63, Z + 10, n.steelDark);
  g.box(X - 30, G + 40, Z + 6, X - 30, G + 65, Z + 6, n.steelDark);
  g.box(X - 33, G + 36, Z + 3, X - 27, G + 39, Z + 9, n.container[1]);
  b.lamp(x + 2, 16.5, z + 1.5, [1, 0.3, 0.2], 4, 0.6);
  b.occlude(X - 40, Z, X + 30, Z + 13, 17.5, 2, 'landmark');
}

/** Containers stacked on the dock yard. */
function containers(b: Builder, n: NC, x0: number, z0: number, x1: number, z1: number, seed: number) {
  const g = b.grid, r = rng(seed);
  for (let x = M(x0); x + 24 <= M(x1); x += 26)
    for (let z = M(z0); z + 10 <= M(z1); z += 11) {
      const h = 1 + Math.floor(r() * 3);
      for (let l = 0; l < h; l++) {
        const col = n.container[Math.floor(r() * n.container.length)];
        g.box(x, G + l * 10, z, x + 23, G + l * 10 + 9, z + 9, (xx, yy) => ((xx - x) % 3 === 0 ? n.steelDark : yy === G + l * 10 + 9 ? n.steel : col));
      }
      b.block((x) * V, z * V, (x + 24) * V, (z + 10) * V);
    }
  b.occlude(M(x0), M(z0), M(x1) - 1, M(z1) - 1, 8, 2, 'landmark');
}

// ---------------------------------------------------------------------------------------------
// Street furniture

function holoPole(b: Builder, n: NC, seed: number): Prop {
  const p = new Prop(6, 40, 6);
  const k = b.k;
  p.box(2, 0, 2, 3, 30, 3, k.c.steelDark);
  p.box(1, 0, 1, 4, 1, 4, k.c.steelDark);
  const col = n.neon[seed % 6];
  p.box(0, 30, 0, 5, 39, 5, (x, y, z) => (x === 0 || x === 5 || z === 0 || z === 5 ? ((y + x + z) % 3 === 0 ? col : 0) : 0));
  p.box(1, 31, 1, 4, 38, 4, n.screen[seed % 4]);
  return p;
}

function trashBags(b: Builder, seed: number): Prop {
  const k = b.k, r = rng(seed);
  const p = new Prop(10, 6, 6);
  for (let i = 0; i < 4; i++) p.ellipsoid(2 + r() * 6, 2, 2 + r() * 2, 2.2, 2 + r(), 2, i % 2 ? k.c.black : k.c.charcoal);
  return p;
}

/** The seed capsules (the city's three hidden charms): a glass vial of glowing seeds in a steel collar. */
function seedCapsule(b: Builder, n: NC): Prop {
  const p = new Prop(5, 9, 5);
  const k = b.k;
  p.box(1, 0, 1, 3, 0, 3, k.c.steelDark);
  p.box(1, 1, 1, 3, 6, 3, (x, _y, z) => (x === 2 && z === 2 ? n.grow : n.plazaGlass));
  p.box(1, 3, 1, 3, 3, 3, k.c.steel);
  p.box(1, 7, 1, 3, 7, 3, k.c.chrome);
  p.set(2, 8, 2, n.growLeafB);
  return p;
}

function furnish(b: Builder, n: NC, vending: [number, number, number][]) {
  const k = b.k;
  const doors = b.rooms.map((rm) => rm.door);
  const stands = b.stallAnchors.map((s) => s.stand);
  const clear = (x: number, z: number, rad = 1.6) => !doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < rad + 1.2) && !stands.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < rad + 1)
    && !b.blockers.some(([a, c, bb, d]) => x > a - 0.4 && x < bb + 0.4 && z > c - 0.4 && z < d + 0.4);
  let i = 0;
  for (const s of SEGS) {
    if (s.kind === 'quay') continue;
    const step = s.kind === 'avenue' ? 9 : s.kind === 'lane' ? 7 : 11;
    for (let t = s.a0 + 6; t < s.a1 - 4; t += step, i++) {
      // stay off the crossings: nothing stands where another street meets this one
      const crossing = SEGS.some((q) => q !== s && q.ew !== s.ew && Math.abs(q.c - t) < q.w / 2 + 2 && s.c >= q.a0 && s.c <= q.a1);
      if (crossing) continue;
      if (Math.hypot(s.ew ? t : s.c, s.ew ? s.c : t) < 24) continue; // the Halo's plaza keeps clear
      for (const sgn of [-1, 1]) {
        const off = s.kind === 'avenue' ? sgn * 3.3 : s.kind === 'lane' ? sgn * (s.w / 2 - 0.45) : sgn * (s.w / 2 - 1.9);
        const x = s.ew ? t : s.c + off, z = s.ew ? s.c + off : t;
        const wx = Math.floor(x * 4) * V + 0.125, wz = Math.floor(z * 4) * V + 0.125;
        if (!clear(wx, wz)) continue;
        const pickI = (i * 7 + (sgn > 0 ? 3 : 0)) % 10;
        const face = s.ew ? (sgn < 0 ? 0 : 2) : (sgn < 0 ? 1 : 3);
        if (s.kind === 'lane') {
          // lanes: bins, bags, bikes and scooters against the walls
          if (pickI < 3) { b.place(trashBags(b, i), wx, 0, wz, face); b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5); }
          else if (pickI < 5) { b.place(crateStack(k, i), wx, 0, wz, face); b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5); }
          else if (pickI < 6) { b.place(scooter(k, [k.c.cubRed, k.c.vmBlue, k.c.black][i % 3]), wx, 0, wz, s.ew ? 0 : 1); b.block(wx - 0.8, wz - 0.4, wx + 0.8, wz + 0.4); }
          continue;
        }
        if (pickI === 0 || pickI === 5) {
          b.place(streetLamp(k), wx, 0, wz, face);
          b.lamp(wx, 3.6, wz, pickI ? COOL : [0.85, 0.75, 1], 8, 0.9);
          b.block(wx - 0.25, wz - 0.25, wx + 0.25, wz + 0.25);
        } else if (pickI === 2) {
          b.place(holoPole(b, n, i), wx, 0, wz, face);
          b.lamp(wx, 4.3, wz, NEON_RGB[i % 6], 6, 0.7);
          b.block(wx - 0.25, wz - 0.25, wx + 0.25, wz + 0.25);
        } else if (pickI === 3 && s.kind === 'avenue') {
          b.place(bench(k), wx, 0, wz, s.ew ? (sgn < 0 ? 2 : 0) : (sgn < 0 ? 3 : 1));
          b.benches.push([wx, wz, s.ew ? (sgn < 0 ? Math.PI : 0) : (sgn < 0 ? -Math.PI / 2 : Math.PI / 2)]);
          b.block(wx - 0.9, wz - 0.9, wx + 0.9, wz + 0.9);
        } else if (pickI === 7) {
          const col = [k.c.vmRed, k.c.vmBlue, k.c.vmWhite, k.c.black][i % 4];
          b.place(vendingMachine(k, col, i), wx, 0, wz, face);
          vending.push([wx, 0, wz]);
          b.lamp(wx, 1.2, wz, COOL, 3, 0.8);
          b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5);
        } else if (pickI === 8) {
          b.place(utilityBox(k, i), wx, 0, wz, face);
          b.block(wx - 0.4, wz - 0.4, wx + 0.4, wz + 0.4);
        } else if (pickI === 9 && s.kind !== 'avenue') {
          b.place(binCorner(k), wx, 0, wz, face);
          b.block(wx - 0.4, wz - 0.4, wx + 0.4, wz + 0.4);
        }
      }
      // wires and signs strung across narrow streets, lanterns over the market's lanes
      if (s.kind !== 'avenue' && (i % 2 === 0)) {
        const len = s.w;
        const cx = s.ew ? t : s.c, cz = s.ew ? s.c : t;
        b.place(wire(k, len, 0.35 + (i % 3) * 0.15), cx, 5.4 + (i % 4) * 0.5, cz, s.ew ? 1 : 0);
        if (s.w <= 10 && i % 4 === 0) {
          b.swayParent = b.lastSway[0] ?? 0;
          b.place(lantern(k, [k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber][i % 3], 4, 5, i), cx, 4.6 + (i % 4) * 0.5, cz);
          b.swayParent = 0;
          b.lamp(cx, 4.8, cz, i % 3 === 1 ? WHITEWARM : RED, 4, 0.6);
        }
      }
    }
  }
  // trees down the Boulevard's median planters and round the Spire's plazas
  for (let x = -200; x < 200; x += 24) {
    if (Math.abs(x) < 26 || (x > 108 && x < 140)) continue;
    tree(b, M(x), M(-5.2), 900 + x, 'keyaki', G, 14, 0.8);
    b.block(x - 0.3, -5.5, x + 0.5, -4.7);
  }
}

// ---------------------------------------------------------------------------------------------

export function buildNeo(win?: Window): BuildResult {
  const b = new Builder(win);
  const n = neoColors(b);
  const k = b.k;
  ground(b, n);
  bridges(b, n);
  halo(b, n);

  const { lots, cores } = planLots();
  assign(lots);
  const stalls: StallAnchor[] = [];
  let hidden: Plan | null = null;
  const awn = AWN(b);
  for (const p of lots) {
    const lot = new Lot(b, p.x0, p.z0, p.x1, p.z1, p.side);
    const r = rng(p.seed);
    const look = districtLook(n, p.d, r);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const u = p.use;
    const seed = p.seed;
    if (u?.stall) {
      const sl = STALL_LOOK[u.stall];
      stalls.push(stall(lot, { id: u.stall, foods: sl.foods as never, awning: pick(awn), noren: pick([k.c.norenRed, k.c.navy, k.c.norenBrown, k.c.indigo]), lantern: pick([k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber]), equip: sl.equip }, Math.min(look.floors, 4), seed, look.wall));
      continue;
    }
    if (u?.helix) { helixTower(lot, n, seed); continue; }
    if (u?.hotel) {
      const h = u.hotel;
      neonBuilding(lot, n, { floors: h.floors, style: h.style, ground: 'hotel', seed, wall: look.wall, hotel: h, roof: 'flat' }, p.d);
      continue;
    }
    if (u?.restaurant) {
      const foods = REST_FOODS[u.restaurant.id] as never;
      neonBuilding(lot, n, { floors: Math.min(look.floors, 6), style: look.style, ground: u.restaurant.kind, seed, wall: look.wall, awning: pick(awn), restaurant: { id: u.restaurant.id, foods }, lanterns: pick([k.c.lanternRed, k.c.lanternWhite]) }, p.d);
      continue;
    }
    if (u?.hidden) {
      // a plain housing block front; the Greenhouse door is the unmarked one beside the entrance
      neonBuilding(lot, n, { floors: 7, style: 'apartment', ground: 'plain', seed, wall: n.concreteDark }, p.d);
      hidden = p;
      continue;
    }
    if (p.d === 'docks' && r() < 0.45 && widthOf(p) >= 40) { warehouse(lot, n, seed); continue; }
    let ground: Ground = pick(look.grounds);
    if ((ground === 'pharmacy' || ground === 'soba') && widthOf(p) < 20) ground = 'shop';
    const o: BuildingOpts = { floors: look.floors, style: look.style, ground, seed, wall: look.wall, awning: pick(awn), lanterns: pick([k.c.lanternRed, k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber]) };
    if (ground === 'konbini') o.signs = false;
    neonBuilding(lot, n, o, p.d);
  }
  // the hearts of the blocks: back buildings, lower, dressed the same
  for (const c of cores) {
    const r = rng(c.seed);
    const [x0, z0, x1, z1] = c.rect;
    const look = districtLook(n, c.d, r);
    const h = Math.max(16, (look.floors - 1) * 12 + 14 - 12);
    const lot = new Lot(b, x0, z0, x1, z1, 's');
    lot.box(0, 0, 0, lot.width - 1, h - 1, lot.depth - 1, look.wall);
    dressBlock(b, x0, z0, x1, z1, h, look.wall, c.seed);
    flatRoof(lot, h, r);
    b.occlude(x0, z0, x1, z1, h * V + 2, 0.95, 'landmark');
  }

  // the docks: cranes over the bay, container yards
  for (const [x0, z0, x1, z1] of YARDS) {
    containers(b, n, x0 + 2, z0 + 3, x1 - 9, z1 - 3, x0 * 7 + z0);
    crane(b, n, x1 - 8, (z0 + z1) / 2 - 2);
  }
  // boats
  const vending: [number, number, number][] = [];
  furnish(b, n, vending);

  // the three seed capsules, tucked where only the curious look
  const manekis: [number, number, number][] = [[-119.6, 0, -158.6], [110.4, 0, 150.2], [198.6, 0, -2.4]];
  for (const m of manekis) b.place(seedCapsule(b, n), m[0], m[1], m[2], 0);

  // the Greenhouse door: an unmarked steel door in a Stacks housing block
  const hd: Anchors['hiddenDoor'] = { stand: [0, 0], label: [0, 3, 0], reveal: [0, 0, 0] };
  if (hidden) {
    const lot = new Lot(b, hidden.x0, hidden.z0, hidden.x1, hidden.z1, hidden.side);
    const a = lot.width / 2 + 7;
    const closed = new Prop(2, 20, 16);
    for (let z = 0; z < 16; z++) for (let y = 0; y < 20; y++) closed.set(0, y, z, z % 4 === 0 ? k.c.steelDark : k.c.charcoal);
    closed.box(0, 9, 12, 0, 10, 13, n.neon[4]);
    const open = new Prop(3, 22, 18);
    open.box(2, 0, 0, 2, 21, 17, k.c.steelDark);
    open.box(1, 0, 3, 1, 15, 14, n.grow);
    open.box(1, 0, 2, 1, 15, 2, k.c.steelDark); open.box(1, 0, 15, 1, 15, 15, k.c.steelDark);
    open.box(0, 16, 1, 1, 17, 16, k.c.steelDark);
    open.box(0, 3, 4, 0, 12, 13, (_x, y, z) => ((y + z) % 3 === 0 ? n.growLeafB : (y + z) % 3 === 1 ? n.growLeaf : 0));
    // the door props are modelled facing -x: turn them to face the lot's street
    const turnsOut = (lot.turns + 1) % 4;
    const [cx, cz] = lot.front(a, 0.06);
    const [ox, oz] = lot.front(a, 0.1);
    b.place(rotateProp(closed, 0), cx, 0, cz, turnsOut, 'door-closed');
    b.place(rotateProp(open, 0), ox, 0, oz, turnsOut, 'door-open');
    const [sx, sz] = lot.front(a, 0.9);
    const [lx, lz] = lot.front(a, 0.5);
    const [rx, rz] = lot.front(a, 2.5);
    hd.stand = [sx, sz]; hd.label = [lx, 3.2, lz]; hd.reveal = [rx, 0, rz];
    b.lamp(lx, 2.6, lz, [0.8, 0.5, 1], 3, 0.5);
  }

  // daruma-style hidden finds: little glowing seed sprouts in a few shops
  const darumas: [number, number, number][] = [];
  {
    const spots = b.darumaSpots;
    const step = Math.max(1, Math.floor(spots.length / 8));
    for (let i = 0; i < spots.length && darumas.length < 8; i += step) {
      const s = spots[i];
      b.place(seedCapsule(b, n), s.pos[0], s.pos[1], s.pos[2], 0);
      darumas.push([s.pos[0], s.pos[1], s.pos[2]]);
    }
  }

  stalls.push(...b.stallAnchors);
  const graph = neoGraph();
  const anchors: Anchors = {
    spawn: [4, 0, 4],
    stalls,
    hiddenDoor: hd,
    interiorExit: [0, 0], interiorSpawn: [0, 0, 0], chef: [0, 0, 0], counterStand: [0, 0],
    manekis,
    graph,
    idlers: [
      { id: 'saul', pos: [-9.5, 0, 9.5] },
      { id: 'courier', pos: [-60, 0, 4.5] },
      { id: 'netrunner', pos: [60, 0, -96] },
      { id: 'preacher', pos: [12, 0, -12.5] },
      { id: 'dockhand', pos: [168, 0, -20] },
      { id: 'dj', pos: [64, 0, 76] },
    ],
    benches: b.benches,
    stools: b.stools, cafeTables: b.cafeTables,
    cats: [[-121, 0, -110], [-68, 0, 80], [64, 0, 100], [168, 0, 60], [-121, 0, 140], [115, 0, -30]],
    emitters: b.emitters,
    fireflies: [],
    vending,
    blockers: b.blockers,
    rooms: b.rooms,
    hotels: b.hotels,
    darumas,
    secret: b.secret,
    occluders: b.occluders,
    wires: b.wires,
  };
  // steam from the market's manholes and vents
  for (let i = 0; i < 18; i++) {
    const s = SEGS[(i * 5) % SEGS.length];
    const t = s.a0 + ((i * 37) % Math.max(1, s.a1 - s.a0 - 12)) + 6;
    anchors.emitters.push({ kind: 'steam', pos: [s.ew ? t : s.c, 0.1, s.ew ? s.c : t], rate: 0.6 });
  }
  const interior = buildGreenhouse(b, anchors, n);
  return { grid: b.grid, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells, navTop: () => G + 8 };
}

// ---------------------------------------------------------------------------------------------
// The Greenhouse: Dr. Ines Mora's hidden table, a grow room of real soil under violet light.

function buildGreenhouse(b: Builder, anchors: Anchors, n: NC): BuildResult['interior'] {
  const g = new SparseGrid(0, 0, ISX, ISY, ISZ);
  const c = b.c, k = b.k;
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
  // floor: worn concrete with soil beds
  g.box(0, 0, 0, ISX - 1, G - 1, ISZ - 1, n.mud);
  for (let z = 0; z < ISZ; z++) for (let x = 0; x < ISX; x++) g.set(x, G - 1, z, (x + z) % 5 === 0 ? n.concreteDark : n.concrete);
  // back walls of old brick and glass, the other two open to the camera
  g.box(0, G, 0, 1, G + 15, ISZ - 1, n.rustBrown);
  g.box(0, G, 0, ISX - 1, G + 15, 1, n.rustBrown);
  g.box(0, G + 4, 6, 1, G + 13, 40, (_x, y, z) => (z % 6 === 0 || y % 5 === 0 ? n.steelDark : n.blackGlass));
  g.box(6, G + 4, 0, 58, G + 13, 1, (x, y) => (x % 6 === 0 || y % 5 === 0 ? n.steelDark : n.blackGlass));
  // grow racks along the back wall: three shelves of greens under violet light
  for (const z0 of [4]) for (let x = 6; x < 58; x += 13) {
    g.box(x, G, z0, x + 10, G, z0 + 3, n.steelDark);
    for (const sy of [0, 5, 10]) {
      g.box(x, G + sy, z0, x + 10, G + sy, z0 + 3, n.steel);
      g.box(x, G + sy + 1, z0, x + 10, G + sy + 2, z0 + 3, (xx, yy, zz) => ((xx + zz + yy) % 3 ? n.growLeaf : n.growLeafB));
      g.box(x, G + sy + 4, z0, x + 10, G + sy + 4, z0 + 3, (xx) => (xx % 2 ? n.grow : n.steelDark));
    }
    for (const xx of [x, x + 10]) g.box(xx, G, z0, xx, G + 14, z0, n.steelDark);
  }
  // soil beds with real tomato vines in the middle of the room
  for (const [x0, z0] of [[6, 34], [40, 34]] as [number, number][]) {
    g.box(x0, G, z0, x0 + 14, G + 1, z0 + 6, n.steelDark);
    g.box(x0 + 1, G + 1, z0 + 1, x0 + 13, G + 1, z0 + 5, n.soil);
    for (let x = x0 + 2; x <= x0 + 12; x += 2) {
      g.box(x, G + 2, z0 + 3, x, G + 7, z0 + 3, n.growLeaf);
      if (hash3(x, 3, z0) < 0.6) g.set(x, G + 5, z0 + 2, b.c.awnRed);
    }
  }
  // the long table: a single slab of reclaimed wood with stools
  g.box(14, G, 21, 46, G + 2, 24, c.woodDark);
  g.box(13, G + 3, 20, 47, G + 3, 25, c.counterTop);
  for (let i = 0; i < 6; i++) place(stool(k, k.c.woodDark), (16.5 + i * 5.5) * V, 0, 29 * V);
  // the doctor's prep bench against the back wall, with the steak on the counter
  g.box(6, G, 12, 44, G + 3, 15, c.woodMid);
  g.box(6, G + 4, 12, 44, G + 4, 15, n.steel);
  place(buildFood('realsteak', b.pal), 26 * V, 1.0, 22.5 * V, 2);
  place(buildFood('gardensalad', b.pal), 34 * V, 1.0, 22.5 * V, 2);
  place(plantPot(k, 'shrub', 41), 58 * V, 0, 40 * V);
  place(plantPot(k, 'bamboo', 42), 4 * V, 0, 44 * V);
  place(plantPot(k, 'flowers', 43), 52 * V, 0, 10 * V);
  hiddenKitchenDress({ pal: b.pal, g, place, lamp, G, style: 'jp', wood: c.woodDark, top: c.lacquerDark, cushion: [c.lacquer, b.ic.zabutonB], seed: 2040 });
  lamp(20 * V, 2.6, 22 * V, [0.85, 0.55, 1], 6, 1.2);
  lamp(40 * V, 2.6, 22 * V, [0.85, 0.55, 1], 6, 1.2);
  lamp(30 * V, 3.0, 6 * V, [0.75, 0.45, 1], 8, 1.0);
  lamp(14 * V, 2.0, 36 * V, WARM, 5, 0.8);
  lamp(48 * V, 2.0, 36 * V, WARM, 5, 0.8);
  // the way out
  g.box(56, G, 44, 63, G + 12, 47, n.steelDark);
  g.box(58, G, 44, 61, G + 9, 44, n.grow);
  anchors.interiorSpawn = [ox + 14.75, 0, oz + 10.0];
  anchors.interiorExit = [ox + 14.9, oz + 10.6];
  anchors.chef = [ox + 6.5, 0, oz + 4.4];
  anchors.counterStand = [ox + 6.5, oz + 7.3];
  return { grid: g, props, lamps };
}
