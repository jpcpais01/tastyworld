// Halcyon City, 2040: the cyberpunk city of the 2040 game, built on broken ground and grown up into the sky. The Halo
// crossing at the bottom of a bowl; the Spire's towers on their basalt ridge; the Lantern Market's crooked lanes up a
// long slope; the Stacks' megablocks terraced up a steep hill; the Neon Mile's bars on the flat; the Black Canal in
// its cut under the ridge and the Rust Docks out on their island. The ground plan is world/neoPlan.ts (pure); the
// buildings come from Tasty World's builder (world/tokyo.ts Lot and building, raised onto their terrace with
// Builder.lifted) and from Halcyon's own towers, megablocks and rooftops here.
import { SparseGrid, rng, hash3 } from './grid';
import type { Lamp } from './lighting';
import { G, V, VX0, VZ0, SX, SZ, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';
import { Builder, Lot, building, stall, WARM, COOL, WHITEWARM, RED, type BuildResult, type Window, type Anchors, type StallAnchor, type PlacedProp, type BuildingOpts, type Ground, type Style, type Side } from './tokyo';
import { neonDress, tree } from './city';
import { dressBlock } from './facades';
import { shopFloor } from './interiors';
import { Prop, rotateProp, streetLamp, bench, vendingMachine, wire, acUnit, crateStack, scooter, stool, plantPot, binCorner, utilityBox, hangingSign, lantern, glyph } from './props';
import { buildFood } from './food';
import { hiddenKitchenDress } from './dining';
import { HOTEL } from '../data/hotels';
import type { HotelInfo } from '../data/hotels';
import { neoPlan, K, isPath, col, layerOf, inMap, canalX, CANAL_HALF, BAY_X, PLAZA_R, PODIUM, SKYBRIDGE, SPIRE_Y, onSpire, type District, type LotPlan, type Plan, type PathSeg } from './neoPlan';

export { PLAZA_R };
const M = (m: number) => Math.round(m / V); // metres -> voxels
/** Metres above street level of a voxel layer. */
const Y = (layer: number) => (layer - G) * V;
const pm = (v: number, n: number) => ((v % n) + n) % n;

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
    beacon: a(0xff2a2a, 0.02, { emit: 1 }), flood: a(0xfff0d0, 0.02, { emit: 1 }), sodium: a(0xffb060, 0.02, { emit: 1 }), ledG: a(0x4aff7a, 0.02, { emit: 1 }),
    steel: a(0x6a7078, 0.04), steelDark: a(0x3a3e44, 0.04), yellowSteel: a(0xd8a830, 0.04), chrome: a(0xb8c0c8, 0.03),
    neon: [a(0xff4fa8, 0.02, { emit: 1 }), a(0x46e8ff, 0.02, { emit: 1 }), a(0xa070ff, 0.02, { emit: 1 }), a(0xffd84a, 0.02, { emit: 1 }), a(0x6dff9a, 0.02, { emit: 1 }), a(0xff7a3a, 0.02, { emit: 1 })],
    screen: [a(0x3a5aff, 0.08, { emit: 0.85 }), a(0xff4fa8, 0.08, { emit: 0.85 }), a(0x46e8ff, 0.08, { emit: 0.85 }), a(0xfff0c8, 0.05, { emit: 0.9 })],
    screenDark: a(0x12141c, 0.03),
    soil: a(0x3a2e26, 0.1), moss: a(0x3e5a32, 0.12, { leaf: true }), grow: a(0xc070ff, 0.03, { emit: 0.9 }), growLeaf: a(0x4a9a4a, 0.14, { leaf: true }), growLeafB: a(0x6aba5a, 0.12, { leaf: true }),
    // rock and retaining walls, the glass of the towers, the lit and unlit windows of the blocks
    basalt: a(0x34363a, 0.08), basaltDark: a(0x26282b, 0.08), rockRust: a(0x5a3428, 0.1), rubble: a(0x55534e, 0.12),
    retain: a(0x707274, 0.06), retainDark: a(0x55585b, 0.06), retainSeam: a(0x4a4c4f, 0.05), parapet: a(0x7a7c7e, 0.05),
    tealGlass: a(0x1f4a52, 0.04, { glass: true }), bronzeGlass: a(0x4a3a2a, 0.04, { glass: true }), greyGlass: a(0x3a4048, 0.04, { glass: true }),
    litWarm: a(0xffd49a, 0.06, { emit: 0.7, night: true, glass: true }), litCool: a(0xb8e0ff, 0.06, { emit: 0.7, night: true, glass: true }),
    sodiumWin: a(0xffa850, 0.06, { emit: 0.65, night: true, glass: true }), acGrey: a(0x9a9c9e, 0.05), tankRust: a(0x7a5038, 0.1),
    laundryA: a(0xd8d2c4, 0.06), laundryB: a(0xb04050, 0.06), laundryC: a(0x4a7ab0, 0.06),
  };
}
type NC = ReturnType<typeof neoColors>;
const NEON_RGB: [number, number, number][] = [[1, 0.35, 0.7], [0.3, 0.9, 1], [0.65, 0.45, 1], [1, 0.85, 0.35], [0.45, 1, 0.65], [1, 0.55, 0.3]];



// ---------------------------------------------------------------------------------------------
// Ground: the rock and the retaining walls, every street's surface, the canal, bridges, piers and railings

/** Columns of the plan near (x, z) whose kind holds, out to `reach` cells along the four axes: distance to the edge. */
function edgeDist(p: Plan, x: number, z: number, reach: number): number {
  const k = p.kind[col(x, z)];
  for (let d = 1; d <= reach; d++)
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx * d, zz = z + dz * d;
      if (!inMap(xx, zz) || p.kind[col(xx, zz)] !== k) return d;
    }
  return reach + 1;
}

/** The face colour of an exposed wall of ground (a cliff, a terrace's retaining wall, the canal's walls). */
function wallAt(n: NC, x: number, y: number, z: number, top: number, xm: number, zm: number, wet: boolean): number {
  const h = hash3(x, y, z);
  if (wet) return y < G - 4 ? (h < 0.5 ? n.algae : n.seaWallDark) : (Math.floor(y / 2) + Math.floor((x + z) / 4)) % 5 === 0 ? n.seaWallDark : n.seaWall;
  if (onSpire(xm, zm) || (Math.abs(xm) < 70 && zm < -36 && zm > -48)) {
    // the ridge is basalt: dark bands of rock, the odd rust-red seam and a scrub of moss under the lip
    const band = Math.floor((y + Math.floor(Math.sin(x * 0.07 + z * 0.05) * 3)) / 5);
    if (top - y < 2 && h < 0.35) return n.moss;
    if (pm(band, 7) === 3) return h < 0.5 ? n.rockRust : n.basaltDark;
    return pm(band, 2) ? (h < 0.15 ? n.basaltDark : n.basalt) : h < 0.2 ? n.basalt : n.basaltDark;
  }
  // everywhere else the hill was cut back behind cast concrete: panels with their formwork seams, weeping
  // drains, grime washed down from the top and moss in the joints
  const u = x + z;
  if (pm(y - G, 12) === 0 || pm(u, 24) === 0) return h < 0.3 ? n.moss : n.retainSeam;
  if (pm(u, 24) === 12 && pm(y - G, 12) === 6) return n.grate; // weep hole
  if (top - y < 3) return h < 0.4 ? n.moss : n.retainDark;
  return h < 0.08 ? n.retainDark : n.retain;
}

function surfaceAt(n: NC, p: Plan, x: number, z: number, xm: number, zm: number): number {
  const c = col(x, z), k = p.kind[c], w = p.walk[c];
  const h = hash3(x, 7, z);
  switch (k) {
    case K.Plaza: {
      // the Halo crossing: rings of dark pavers round the hologram, a ring of light set into the stone
      const r = Math.hypot(xm, zm);
      if (Math.abs(r - 15) < 0.2 || Math.abs(r - 6.2) < 0.15) return n.haloRing;
      if (Math.abs(r - PLAZA_R + 0.4) < 0.2) return n.kerb;
      const ring = Math.floor(r / 1.5), ang = Math.floor(((Math.atan2(zm, xm) + Math.PI) / (Math.PI * 2)) * (ring * 6 + 6));
      return r < 6 ? n.plazaGlass : (ring + ang) % 2 ? n.plazaA : n.plazaB;
    }
    case K.Avenue: {
      // basalt pavers in a herringbone, a strip of cyan guide light every few metres along the kerb
      const e = edgeDist(p, x, z, 6);
      if (e === 1) return n.kerb;
      if (e === 3 && pm(x + z, 16) < 2) return n.guideCyan;
      if (h > 0.985) return n.grate;
      return (pm(x >> 1, 2) + pm(z >> 1, 2) + pm(x + z, 3)) % 3 === 0 ? n.paverB : pm(x + 2 * z, 7) === 0 ? n.paverC : n.paver;
    }
    case K.Street: {
      // pavements either side of a wet carriageway the hover traffic flies over
      const e = edgeDist(p, x, z, 8);
      if (e <= 6) return e === 6 ? n.kerb : pm(x + z * 2, 4) === 0 ? n.paverC : n.paver;
      if (h > 0.996) return n.grate;
      return h < 0.18 ? n.puddle : h < 0.5 ? n.asphaltB : n.asphalt;
    }
    case K.Lane:
      if (edgeDist(p, x, z, 4) === 1 && pm(x + z, 3) === 0) return n.gutter;
      return h < 0.2 ? n.puddle : h < 0.55 ? n.laneB : n.lane;
    case K.Stair: {
      // a step's nose where the next column down the flight is lower
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, zz = z + dz;
        if (!inMap(xx, zz)) continue;
        const cc = col(xx, zz);
        if (p.kind[cc] === K.Stair && p.walk[cc] < w) return pm(x + z, 4) < 2 ? n.hazardY : n.steelDark;
      }
      return h < 0.25 ? n.concreteDark : n.concrete;
    }
    case K.Quay: {
      if (edgeDist(p, x, z, 3) === 1 && nearWater(p, x, z)) return pm(x + z, 4) < 2 ? n.hazardY : n.hazardK;
      return (pm(x >> 2, 2) + pm(z >> 2, 2)) & 1 ? n.quay : n.quayB;
    }
    case K.Deck: return (pm(x >> 1, 2) + pm(z >> 1, 2)) & 1 ? n.plazaA : pm(x + z, 24) === 0 ? n.guidePink : n.plazaB;
    case K.Bridge: return pm(x + z, 3) ? n.steel : n.steelDark;
    case K.Pier: return pm(x, 4) === 0 ? n.steelDark : n.quay;
    case K.Lot: return n.concreteDark;
    default:
      // ground nobody built on: rubble, gravel and weeds, the odd sheet of rusted iron
      return h < 0.3 ? n.moss : h < 0.55 ? n.soil : h < 0.8 ? n.rubble : h < 0.96 ? n.concreteDark : n.rustBrown;
  }
}

const nearWater = (p: Plan, x: number, z: number) => {
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [0, 2], [0, -2]]) if (inMap(x + dx, z + dz) && p.kind[col(x + dx, z + dz)] === K.Water) return true;
  return false;
};

function ground(b: Builder, n: NC, p: Plan) {
  const g = b.grid;
  const x0 = Math.max(VX0, g.wx0), x1 = Math.min(VX0 + SX, g.wx1), z0 = Math.max(VZ0, g.wz0), z1 = Math.min(VZ0 + SZ, g.wz1);
  const waterBed = layerOf(-2.5);
  const at = (x: number, z: number) => (inMap(x, z) ? p.walk[col(x, z)] : G);
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      const c = col(x, z), k = p.kind[c], w = p.walk[c];
      const xm = (x + 0.5) * V, zm = (z + 0.5) * V;
      if (k === K.Water) {
        g.box(x, 0, z, x, w - 1, z, n.mud);
        if (hash3(x, 5, z) > 0.97) g.set(x, w, z, n.algae);
        continue;
      }
      const overWater = xm >= BAY_X || Math.abs(xm - canalX(zm)) < CANAL_HALF;
      if ((k === K.Bridge || k === K.Pier) && overWater) {
        // a deck on girders over the water, piles down to the bed every few metres
        g.box(x, 0, z, x, waterBed - 1, z, n.mud);
        g.set(x, w - 1, z, surfaceAt(n, p, x, z, xm, zm));
        g.set(x, w - 2, z, n.steelDark);
        if (pm(x, 16) === 0 && pm(z, 16) < 2) g.box(x, waterBed, z, x, w - 3, z, n.steelDark);
        else if (k === K.Bridge && pm(x + z, 8) === 0) g.set(x, w - 3, z, n.steelDark);
        continue;
      }
      // solid ground: rock or fill to just under the surface, the surface itself on top
      g.box(x, 0, z, x, w - 2, z, n.mud);
      g.set(x, w - 1, z, surfaceAt(n, p, x, z, xm, zm));
      // the faces that show: down to the lowest neighbour (a cliff, a retaining wall, a quay wall, a step's riser)
      const lo = Math.min(at(x + 1, z), at(x - 1, z), at(x, z + 1), at(x, z - 1));
      if (lo < w - 1) {
        const wet = nearWater(p, x, z);
        for (let y = Math.max(0, lo - 1); y < w - 1; y++) g.set(x, y, z, k === K.Stair && w - y < 3 ? n.concreteDark : wallAt(n, x, y, z, w, xm, zm, wet));
      }
    }
  // railings where a walk ends at a drop (a cliff top, a terrace's edge, a bridge over the water)
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      const c = col(x, z), k = p.kind[c];
      if (k === K.Lot || k === K.Water) continue;
      const w = p.walk[c];
      // any edge over a drop of more than a step: a rail along a street's edge, a parapet round the waste ground
      // above a cut (so nothing reads as a ledge one ought to be able to climb)
      let drop = false;
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const xx = x + dx, zz = z + dz;
        if (!inMap(xx, zz)) continue;
        const cc = col(xx, zz), kk = p.kind[cc];
        if (kk === K.Lot) continue;
        if (p.walk[cc] <= w - 3 && !(k === K.Stair && kk === K.Stair)) { drop = true; break; }
      }
      if (!drop) continue;
      if (!isPath(k)) { g.box(x, w, z, x, w + 3, z, hash3(x, w, z) < 0.3 ? n.retainDark : n.parapet); continue; }
      const post = pm(x + z, 6) === 0;
      g.box(x, w, z, x, w + 3, z, post ? n.steelDark : 0);
      g.set(x, w + 4, z, k === K.Bridge || k === K.Deck ? n.guideCyan : n.steel);
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

/**
 * A Halcyon shopfront over what the builder made: a neon lip along the canopy's edge, a lit sign band across the
 * fascia, tubes of light up both sides of the front, and inside a strip of coloured light under the ceiling along
 * both walls, so every shop glows out into the rain.
 */
function cyberFront(lot: Lot, n: NC, o: BuildingOpts, d: District) {
  const b = lot.b, w = lot.width, dep = lot.depth;
  const r = rng(o.seed * 31 + 7);
  const ni = Math.floor(r() * n.neon.length), tube = n.neon[ni], tube2 = n.neon[(ni + 1 + Math.floor(r() * 4)) % n.neon.length];
  const rgb = NEON_RGB[ni];
  // the canopy: its outermost row, lit along its lowest voxel
  let dmin = 0;
  for (let dd = -1; dd >= -6; dd--) { let any = false; for (let y = 8; y <= 13; y++) if (lot.get(w >> 1, y, dd)) any = true; if (any) dmin = dd; else break; }
  if (dmin < 0)
    for (let a = 0; a < w; a++)
      for (let y = 8; y <= 13; y++) if (lot.get(a, y, dmin)) { lot.set(a, y, dmin, tube); break; }
  // the sign band over the canopy (or over the door if there is none): dark ends, a lit field with a glyph rhythm
  if (w >= 12) {
    const a0 = 1, a1 = w - 2, y = 13;
    let free = true;
    for (let a = a0; a <= a1 && free; a++) if (lot.get(a, y, -1) || lot.get(a, y + 1, -1)) free = false;
    if (free) {
      const field = r() < 0.5 ? n.screen[Math.floor(r() * n.screen.length)] : tube2;
      lot.box(a0, y, -1, a1, y + 1, -1, (a, yy) => (a === a0 || a === a1 ? n.screenDark : (a * 3 + yy + o.seed) % 7 === 0 ? n.screenDark : field));
      const [sx, sz] = lot.front(w / 2, 0.9);
      b.lamp(sx, 3.6, sz, rgb, 5, 0.6);
    }
  }
  // tubes up both edges of the front, standing proud of the wall
  for (const a of [0, w - 1]) for (let y = 1; y <= 11; y++) if (!lot.get(a, y, -1) && lot.get(a, y, 0)) lot.set(a, y, -1, y % 4 === 0 ? n.steelDark : tube);
  // inside: a strip of light under the ceiling along each side wall of the front room
  for (const [a, side] of [[1, 0], [2, 1], [w - 2, w - 1], [w - 3, w - 2]] as [number, number][])
    for (let dd = 2; dd < Math.min(dep - 3, 20); dd++)
      for (let y = 13; y >= 8; y--) {
        if (lot.get(a, y, dd) !== 0) continue;
        if (lot.get(a, y + 1, dd) && lot.get(side, y, dd)) lot.set(a, y, dd, (dd & 3) === 0 ? n.steelDark : d === 'lantern' ? tube : tube2);
        break;
      }
}

function neonBuilding(lot: Lot, n: NC, o: BuildingOpts, d: District) {
  const { H } = building(lot, o);
  if (o.ground !== 'plain' && o.ground !== 'hotel') cyberFront(lot, n, o, d);
  if (o.floors >= 3) neonDress(lot, H, o.floors, o.seed, 0.22);
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
// Halcyon's own buildings: glass towers, concrete megablocks, the rooftops' clutter

type Box = [number, number, number, number]; // inclusive voxel rect x0, z0, x1, z1

interface TowerLook { glass: number; dark: number; lit: number; fin: number; band: number; neon: number; litFrac: number; bay: number; floor: number }

/** The register a tower is cut from: its glass, the fins between the bays, the spandrel bands, its light. */
function towerLook(n: NC, r: () => number, d: District): TowerLook {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const corp = d === 'spire' || d === 'halo';
  return {
    glass: pick(corp ? [n.blackGlass, n.blueGlass, n.tealGlass, n.blackGlass, n.bronzeGlass] : [n.blackGlass, n.blueGlass, n.greyGlass]),
    dark: n.blackGlass,
    lit: pick([n.litGlass, n.litGlass, n.litWarm, n.litCool]),
    fin: pick(corp ? [n.steelDark, n.chrome, n.steel, n.navy] : [n.concreteDark, n.concrete, n.steelDark, n.soot]),
    band: pick(corp ? [n.steelDark, n.navy, n.concreteDark, n.soot] : [n.concrete, n.concreteDark, n.tileGrey, n.soot]),
    neon: n.neon[Math.floor(r() * n.neon.length)],
    litFrac: 0.18 + r() * 0.3,
    bay: pick([4, 5, 6, 8]),
    floor: 14,
  };
}

/**
 * A tower: a shaft of curtain wall from layer y0 up to y1, stepping in at one or two setbacks, its floors banded,
 * bays split by fins, a scatter of lit windows, light up its corners, a crown and a mast with a beacon on top.
 */
function tower(b: Builder, n: NC, box: Box, y0: number, y1: number, seed: number, d: District, o: { screen?: Side; crown?: boolean; ribs?: boolean } = {}) {
  const g = b.grid, r = rng(seed);
  const L = towerLook(n, r, d);
  let [x0, z0, x1, z1] = box;
  const tiers = y1 - y0 > 220 ? 3 : y1 - y0 > 120 ? 2 : 1;
  let y = y0;
  const ribs = o.ribs ?? r() < 0.4;
  const top = y1;
  for (let t = 0; t < tiers; t++) {
    const yt = t === tiers - 1 ? top : y + Math.round(((top - y0) * (0.45 + r() * 0.2)) / tiers) + (t === 0 ? 20 : 0);
    if (x1 - x0 < 8 || z1 - z0 < 8) break;
    // the inside of the shaft is never seen: one cheap fill
    g.box(x0 + 1, y, z0 + 1, x1 - 1, yt - 1, z1 - 1, n.soot);
    const face = (u: number, yy: number, fid: number, len: number) => {
      const fl = Math.floor((yy - y0) / L.floor), fy = (yy - y0) % L.floor;
      if (u === 0 || u === len) return ribs && (fl + fid) % 3 === 0 ? L.neon : L.fin; // the corners, lit on a ribbed tower
      if (fy < 2) return L.band;
      if (u % L.bay === 0) return L.fin;
      const bay = Math.floor(u / L.bay);
      return hash3(fl * 7 + fid, bay, seed) < L.litFrac ? L.lit : (fl + bay) % 5 === 0 ? L.dark : L.glass;
    };
    for (let yy = y; yy < yt; yy++) {
      for (let x = x0; x <= x1; x++) { g.set(x, yy, z0, face(x - x0, yy, 0, x1 - x0)); g.set(x, yy, z1, face(x1 - x, yy, 2, x1 - x0)); }
      for (let z = z0 + 1; z < z1; z++) { g.set(x0, yy, z, face(z1 - z, yy, 3, z1 - z0)); g.set(x1, yy, z, face(z - z0, yy, 1, z1 - z0)); }
    }
    // the setback's terrace: a lit parapet round the roof of the tier below
    g.box(x0, yt, z0, x1, yt, z1, n.steelDark);
    if (t < tiers - 1) {
      g.box(x0, yt + 1, z0, x1, yt + 1, z0, L.neon); g.box(x0, yt + 1, z1, x1, yt + 1, z1, L.neon);
      g.box(x0, yt + 1, z0, x0, yt + 1, z1, L.neon); g.box(x1, yt + 1, z0, x1, yt + 1, z1, L.neon);
      const s = 3 + Math.floor(r() * 5);
      x0 += s; z0 += s; x1 -= s; z1 -= s;
      if (r() < 0.5) { x0 += Math.floor(r() * 6); } else { z1 -= Math.floor(r() * 6); }
    }
    y = yt + 1;
  }
  // the crown: plant boxes, a lit band, a mast and the red light for the sky lanes
  const cx = (x0 + x1) >> 1, cz = (z0 + z1) >> 1;
  if (o.crown ?? true) {
    g.box(x0 + 2, y, z0 + 2, x1 - 2, y + 5, z1 - 2, n.steelDark);
    g.box(x0 + 2, y + 3, z0 + 2, x1 - 2, y + 3, z1 - 2, L.neon);
    const mh = 16 + Math.floor(r() * 30);
    g.box(cx, y + 6, cz, cx, Math.min(g.sy - 2, y + 6 + mh), cz, n.steel);
    g.set(cx, Math.min(g.sy - 1, y + 7 + mh), cz, n.beacon);
    b.lamp(cx * V, Y(Math.min(g.sy - 1, y + 7 + mh)), cz * V, [1, 0.2, 0.2], 6, 0.6);
  }
  // a screen the height of several floors on one face
  if (o.screen) holoScreen(b, n, box, o.screen, y0 + 20 + Math.floor(r() * 20), Math.min(top - 8, y0 + 70 + Math.floor(r() * 40)), seed);
  b.occlude(box[0], box[1], box[2], box[3], Y(top) + 6, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/** A great holo screen hung on a building's face, banded in slow colour, framed in black; it lights the street. */
function holoScreen(b: Builder, n: NC, box: Box, side: Side, y0: number, y1: number, seed: number) {
  if (y1 - y0 < 10) return;
  const g = b.grid, r = rng(seed * 3 + 1);
  const [x0, z0, x1, z1] = box;
  const ns = side === 'n' || side === 's';
  const len = ns ? x1 - x0 : z1 - z0;
  const w = Math.min(len - 4, 18 + Math.floor(r() * 18));
  if (w < 8) return;
  const a0 = (ns ? x0 : z0) + Math.floor((len - w) / 2), a1 = a0 + w;
  const e = side === 's' ? z1 + 1 : side === 'n' ? z0 - 1 : side === 'e' ? x1 + 1 : x0 - 1;
  const ph = r() * 9, sc = n.screen, motif = Math.floor(r() * 3);
  for (let a = a0; a <= a1; a++)
    for (let y = y0; y <= y1; y++) {
      let v: number;
      if (a === a0 || a === a1 || y === y0 || y === y1) v = n.screenDark;
      else if (motif === 0) { const t = Math.sin((a + ph) * 0.35 + y * 0.12) + Math.cos(y * 0.3 - ph); v = t > 1 ? sc[3] : t > 0 ? sc[seed & 1 ? 0 : 2] : sc[1]; }
      else if (motif === 1) { const cy = (y0 + y1) / 2, ca = (a0 + a1) / 2; const rr = Math.hypot((a - ca) * 1.2, y - cy); v = rr < (y1 - y0) * 0.28 ? sc[3] : pm(Math.floor(rr), 4) < 2 ? sc[1] : sc[0]; }
      else v = pm(Math.floor((y - y0) / 3) + Math.floor((a - a0) / 5), 3) === 0 ? sc[2] : (y - y0) % 3 === 0 ? n.screenDark : sc[seed % 4];
      if (ns) g.set(a, y, e, v); else g.set(e, y, a, v);
    }
  const mid = (a0 + a1) / 2, ym = Y((y0 + y1) / 2);
  const out = side === 's' ? 1 : side === 'n' ? -1 : side === 'e' ? 1 : -1;
  if (ns) b.lamp(mid * V, ym, (e + out * 8) * V, [0.6, 0.55, 1], 14, 0.8); else b.lamp((e + out * 8) * V, ym, mid * V, [0.6, 0.55, 1], 14, 0.8);
}

/**
 * A concrete megablock: a slab of flats from layer y0 to y1, every floor a row of windows (some lit, some dark,
 * some boarded), balcony cages and AC units stuck all over it, laundry, a stair core up one end lit in sodium.
 */
function megablock(b: Builder, n: NC, box: Box, y0: number, y1: number, seed: number, front: Side) {
  const g = b.grid, r = rng(seed);
  const [x0, z0, x1, z1] = box;
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const wall = pick([n.concrete, n.concreteDark, n.tileGrey, n.tileTeal, n.plum, n.soot, n.rustRed, n.navy]);
  const trim = pick([n.concreteDark, n.soot, n.steelDark]);
  g.box(x0 + 1, y0, z0 + 1, x1 - 1, y1 - 1, z1 - 1, n.soot);
  const FH = 11, lit = pick([n.litWarm, n.litGlass, n.litCool]);
  const face = (u: number, yy: number, fid: number, len: number) => {
    const fl = Math.floor((yy - y0) / FH), fy = (yy - y0) % FH;
    if (u <= 1 || u >= len - 1) return trim;
    if (fy === 0) return trim;
    const bay = Math.floor((u - 2) / 6), bu = (u - 2) % 6;
    if (fy >= 3 && fy <= 8 && bu >= 1 && bu <= 4) {
      const hv = hash3(fl * 13 + fid, bay, seed);
      return hv < 0.3 ? lit : hv < 0.36 ? n.screen[Math.floor(hv * 100) % 4] : hv < 0.42 ? n.corrugated : n.blackGlass;
    }
    return hash3(u, yy, fid + seed) < 0.06 ? n.soot : wall;
  };
  for (let yy = y0; yy < y1; yy++) {
    for (let x = x0; x <= x1; x++) { g.set(x, yy, z0, face(x - x0, yy, 0, x1 - x0)); g.set(x, yy, z1, face(x1 - x, yy, 2, x1 - x0)); }
    for (let z = z0 + 1; z < z1; z++) { g.set(x0, yy, z, face(z1 - z, yy, 3, z1 - z0)); g.set(x1, yy, z, face(z - z0, yy, 1, z1 - z0)); }
  }
  // balcony cages and AC boxes stuck to the faces: a few per floor, more on the street front
  const stick = (side: Side, a: number, yy: number, v: number, depth = 1) => {
    for (let k = 1; k <= depth; k++) {
      if (side === 's') g.set(a, yy, z1 + k, v); else if (side === 'n') g.set(a, yy, z0 - k, v);
      else if (side === 'e') g.set(x1 + k, yy, a, v); else g.set(x0 - k, yy, a, v);
    }
  };
  for (const side of ['s', 'n', 'e', 'w'] as Side[]) {
    const ns = side === 's' || side === 'n', a0 = ns ? x0 : z0, a1 = ns ? x1 : z1;
    const busy = side === front ? 0.5 : 0.22;
    for (let fl = 1; (fl + 1) * FH + y0 < y1; fl++)
      for (let a = a0 + 3; a + 5 < a1; a += 6) {
        const hv = hash3(a, fl, seed + side.charCodeAt(0));
        const yy = y0 + fl * FH;
        if (hv < busy * 0.45) {
          // a balcony cage: a floor slab, bars and a lit window behind
          for (let u = a; u < a + 5; u++) { stick(side, u, yy, n.steelDark, 3); stick(side, u, yy + 6, n.steelDark, 3); }
          for (const u of [a, a + 2, a + 4]) for (let q = 1; q < 6; q++) { if (side === 's') g.set(u, yy + q, z1 + 3, n.steel); else if (side === 'n') g.set(u, yy + q, z0 - 3, n.steel); else if (side === 'e') g.set(x1 + 3, yy + q, u, n.steel); else g.set(x0 - 3, yy + q, u, n.steel); }
          if (hv < busy * 0.15) for (let u = a + 1; u < a + 4; u++) stick(side, u, yy + 1 + Math.floor(hash3(u, fl, 3) * 2), pick([n.laundryA, n.laundryB, n.laundryC]), 2);
        } else if (hv < busy) {
          // an AC box under the window
          for (let u = a + 1; u < a + 4; u++) for (let q = 1; q <= 2; q++) stick(side, u, yy + q, n.acGrey, 2);
        } else if (hv > 0.97) {
          // a neon sign in a window
          stick(side, a + 1, yy + 4, n.neon[Math.floor(hv * 600) % 6]); stick(side, a + 2, yy + 4, n.neon[Math.floor(hv * 600) % 6]);
        }
      }
  }
  // the stair core: a lit slot up the full height of one end
  const sx = r() < 0.5 ? x0 : x1;
  for (let yy = y0 + 2; yy < y1 - 2; yy++) if ((yy - y0) % FH > 1) for (let z = ((z0 + z1) >> 1) - 1; z <= ((z0 + z1) >> 1) + 1; z++) g.set(sx, yy, z, (yy & 3) === 0 ? n.steelDark : n.sodiumWin);
  b.lamp(sx * V, Y((y0 + y1) >> 1), ((z0 + z1) >> 1) * V, [1, 0.7, 0.4], 8, 0.5);
  b.occlude(x0, z0, x1, z1, Y(y1) + 4, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/** The roof of a mass at layer y: parapet, water tanks, fans, dishes, an antenna farm, a rooftop sign. */
function roofClutter(b: Builder, n: NC, box: Box, y: number, seed: number, d: District) {
  const g = b.grid, r = rng(seed * 5 + 9);
  const [x0, z0, x1, z1] = box;
  if (x1 - x0 < 8 || z1 - z0 < 8) return;
  g.box(x0, y, z0, x1, y, z0, n.parapet); g.box(x0, y, z1, x1, y, z1, n.parapet);
  g.box(x0, y, z0, x0, y, z1, n.parapet); g.box(x1, y, z0, x1, y, z1, n.parapet);
  const spot = () => [x0 + 2 + Math.floor(r() * Math.max(1, x1 - x0 - 10)), z0 + 2 + Math.floor(r() * Math.max(1, z1 - z0 - 10))];
  // a water tank on legs
  if (r() < 0.7) {
    const [a, c] = spot();
    for (const [dx, dz] of [[0, 0], [5, 0], [0, 5], [5, 5]]) g.box(a + dx, y, c + dz, a + dx, y + 3, c + dz, n.steelDark);
    g.box(a, y + 4, c, a + 5, y + 10, c + 5, (xx, yy, zz) => ((xx === a || xx === a + 5) && (zz === c || zz === c + 5) ? 0 : yy % 3 === 0 ? n.rustBrown : n.tankRust));
  }
  // fan boxes and ducts
  for (let i = 0; i < 2 + Math.floor(r() * 3); i++) {
    const [a, c] = spot();
    g.box(a, y, c, a + 3, y + 2, c + 3, n.acGrey);
    g.set(a + 1, y + 3, c + 1, n.steelDark); g.set(a + 2, y + 3, c + 2, n.steelDark);
  }
  // an antenna farm and a dish
  if (r() < 0.6) {
    const [a, c] = spot();
    for (let i = 0; i < 3; i++) g.box(a + i * 2, y, c + (i & 1), a + i * 2, y + 8 + Math.floor(r() * 14), c + (i & 1), n.steel);
    if (r() < 0.5) g.box(a + 6, y + 1, c, a + 8, y + 3, c, n.chrome);
  }
  // a rooftop sign in big neon glyphs, facing the street below
  if ((d === 'neonmile' || d === 'lantern' || d === 'halo') && r() < 0.45) {
    const col = n.neon[Math.floor(r() * 6)], gr = rng(seed);
    const cnt = Math.min(5, Math.floor((x1 - x0 - 4) / 7));
    for (let i = 0; i < cnt; i++) {
      const gl = glyph(gr, 5);
      for (let yy = 0; yy < 5; yy++) for (let xx = 0; xx < 5; xx++) if (gl[4 - yy][xx]) g.set(x0 + 3 + i * 7 + xx, y + 4 + yy * 2, z1 - 2, col), g.set(x0 + 3 + i * 7 + xx, y + 5 + yy * 2, z1 - 2, col);
      g.box(x0 + 3 + i * 7 + 2, y, z1 - 2, x0 + 3 + i * 7 + 2, y + 3, z1 - 2, n.steelDark);
    }
    b.lamp((x0 + x1) * 0.5 * V, Y(y + 8), (z1 + 2) * V, NEON_RGB[Math.floor(r() * 6)], 9, 0.6);
  }
}


// ---------------------------------------------------------------------------------------------
// Lots: who lives where, and what each lot becomes

type Use = { stall?: string; restaurant?: { id: string; kind: Ground }; hotel?: HotelInfo; hidden?: boolean; helix?: boolean };

const widthOf = (l: LotPlan) => (l.side === 's' || l.side === 'n' ? l.x1 - l.x0 + 1 : l.z1 - l.z0 + 1);
const depthOf = (l: LotPlan) => (l.side === 's' || l.side === 'n' ? l.z1 - l.z0 + 1 : l.x1 - l.x0 + 1);
const touchesEdge = (l: LotPlan) => l.x0 <= VX0 + 2 || l.z0 <= VZ0 + 2 || l.x1 >= VX0 + SX - 3 || l.z1 >= VZ0 + SZ - 3;

/** Hand the named places, hotels and secrets to street-front lots, spread through their districts. */
function assign(lots: LotPlan[]): Map<number, Use> {
  const uses = new Map<number, Use>();
  const fronts = lots.filter((l) => l.use === 'front');
  const free = (d: District | District[], ok: (l: LotPlan) => boolean = () => true) => fronts.filter((l) => (Array.isArray(d) ? d.includes(l.d) : l.d === d) && !uses.has(l.id) && ok(l));
  const spread = (c: LotPlan[], n: number, k: number) => c[Math.min(c.length - 1, Math.floor(((k + 0.5) * c.length) / n))];
  const put = (d: District | District[], list: Use[], ok: (l: LotPlan) => boolean) => list.forEach((u, k) => {
    const c = free(d, ok);
    const l = spread(c, list.length, k);
    if (l) uses.set(l.id, u); else console.warn(`neo: no lot for ${JSON.stringify(u).slice(0, 60)}`);
  });
  const stallOk = (l: LotPlan) => widthOf(l) >= 16 && widthOf(l) <= 40 && depthOf(l) >= 14 && l.on !== K.Stair;
  const roomOk = (l: LotPlan) => widthOf(l) >= 22 && depthOf(l) >= 28 && l.on !== K.Stair;
  const hotelOk = (l: LotPlan) => widthOf(l) >= 26 && depthOf(l) >= 26 && l.on !== K.Stair;
  const H = (id: string) => HOTEL[id];
  // first the big ones: Helix on the ridge, the Halo's grand hotel and its 24-hour konbini
  put('spire', [{ helix: true }], (l) => widthOf(l) >= 56 && depthOf(l) >= 56);
  put('halo', [{ hotel: H('meridian') }], hotelOk);
  put(['halo', 'stacks'], [{ restaurant: { id: 'konbini', kind: 'konbini' } }], (l) => roomOk(l) && Math.hypot(l.x0 * V, l.z0 * V) < 60);
  put('sump', [{ restaurant: { id: 'eelden', kind: 'izakaya' } }], roomOk);
  put('lantern', [{ stall: 'mamalin' }, { stall: 'bao9' }], stallOk);
  put('lantern', [{ hotel: H('capsule9') }, { hotel: H('lanternlofts') }], hotelOk);
  put('lantern', [{ restaurant: { id: 'phosaigon', kind: 'soba' } }, { restaurant: { id: 'dumpling', kind: 'izakaya' } }, { restaurant: { id: 'tart', kind: 'bakery' } }], roomOk);
  put('spire', [{ hotel: H('spiresuites') }, { hotel: H('zenithres') }], hotelOk);
  put('spire', [{ restaurant: { id: 'printbar', kind: 'izakaya' } }, { restaurant: { id: 'synth', kind: 'cafe' } }, { restaurant: { id: 'kopi', kind: 'kissa' } }], roomOk);
  put('stacks', [{ hotel: H('stackshostel') }, { hotel: H('kowaflats') }], hotelOk);
  put('stacks', [{ restaurant: { id: 'myco', kind: 'izakaya' } }], roomOk);
  put('stacks', [{ hidden: true }], (l) => widthOf(l) >= 32 && depthOf(l) >= 24 && l.on !== K.Stair);
  put('neonmile', [{ hotel: H('neonnest') }, { hotel: H('orbitmall') }], hotelOk);
  put('neonmile', [{ stall: 'boba' }, { stall: 'takoyard' }], stallOk);
  put('neonmile', [{ restaurant: { id: 'greenbun', kind: 'cafe' } }, { restaurant: { id: 'mochi', kind: 'bakery' } }, { restaurant: { id: 'crepe', kind: 'kissa' } }, { restaurant: { id: 'ion', kind: 'izakaya' } }], roomOk);
  put('docks', [{ stall: 'krillking' }, { stall: 'cricket' }], (l) => depthOf(l) >= 14 && widthOf(l) >= 16 && widthOf(l) <= 48);
  put('docks', [{ hotel: H('rainmotel') }], hotelOk);
  put('docks', [{ restaurant: { id: 'skewer', kind: 'izakaya' } }], roomOk);
  return uses;
}

/** The shop floors each district's street fronts open onto. */
const GROUNDS: Record<District, Ground[]> = {
  halo: ['shop', 'cafe', 'konbini', 'izakaya', 'pharmacy', 'shop'],
  lantern: ['shop', 'cafe', 'izakaya', 'soba', 'bakery', 'fish', 'books', 'kissa', 'izakaya', 'shop', 'pharmacy', 'florist'],
  spire: ['shop', 'cafe', 'kissa', 'books', 'pharmacy', 'shop'],
  stacks: ['plain', 'shop', 'konbini', 'pharmacy', 'cafe', 'bakery', 'soba', 'plain', 'izakaya'],
  neonmile: ['izakaya', 'izakaya', 'cafe', 'shop', 'kissa', 'soba', 'bakery', 'konbini', 'books', 'shop'],
  sump: ['izakaya', 'soba', 'fish', 'shop', 'plain'],
  docks: ['shop', 'izakaya', 'fish', 'soba', 'plain', 'cafe'],
};

function wallFor(n: NC, d: District, r: () => number): number {
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  switch (d) {
    case 'lantern': return pick([n.soot, n.concreteDark, n.maroon, n.tileGrey, n.rustBrown, n.tileTeal, n.concrete]);
    case 'spire': case 'halo': return pick([n.blackGlass, n.blueGlass, n.concrete, n.steelDark, n.navy, n.blackGlass]);
    case 'stacks': return pick([n.concrete, n.concreteDark, n.tileGrey, n.tileTeal, n.soot, n.plum, n.rustRed]);
    case 'neonmile': return pick([n.navy, n.plum, n.maroon, n.blackGlass, n.soot, n.steelDark]);
    default: return pick([n.corrugated, n.corrugatedB, n.rustRed, n.rustBrown, n.concreteDark]);
  }
}

/** Tag every cutaway occluder added since `from` with one group, so a building and the tower on it lower as one. */
function group(b: Builder, from: number, id: number) {
  for (let i = from; i < b.occluders.length; i++) b.occluders[i].group = id;
}

function buildLots(b: Builder, n: NC, p: Plan, uses: Map<number, Use>): { stalls: StallAnchor[]; hidden: LotPlan | null } {
  const k = b.k, awn = AWN(b);
  const stalls: StallAnchor[] = [];
  let hidden: LotPlan | null = null;
  for (const l of p.lots) {
    const box: Box = [l.x0, l.z0, l.x1, l.z1];
    const r = rng(l.seed);
    const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
    const dy = l.base - G, seed = l.seed;
    // whatever stands here must at least bury the slope behind it, and a storey more
    const bury = Math.max(0, l.hi - l.base) + 14;
    const edge = touchesEdge(l) ? 1.4 : 1;
    const occ0 = b.occluders.length;
    if (l.use === 'podium') { podium(b, n, p, l); continue; }
    if (l.use === 'back') {
      backLot(b, n, l, box, bury, edge);
      group(b, occ0, 20000 + l.id);
      continue;
    }
    const lot = new Lot(b, l.x0, l.z0, l.x1, l.z1, l.side);
    const u = uses.get(l.id);
    // the old market keeps its striped awnings and paper lanterns; everywhere else a shop has a steel canopy
    const old = l.d === 'lantern' || l.d === 'sump';
    const canopy = (): [number, number] => old ? pick(awn) : pick<[number, number]>([[n.steelDark, n.steelDark], [n.navy, n.steelDark], [n.blackGlass, n.steelDark], [n.plum, n.soot], [n.maroon, n.soot], [n.steel, n.steelDark]]);
    const lamps = (a: number[]) => (old ? pick(a) : undefined);
    const wall = wallFor(n, l.d, r);
    let H = 0; // the height (voxels) of what the Tokyo builder put up, from the lot's floor
    if (u?.stall) {
      const sl = STALL_LOOK[u.stall];
      const sa = b.lifted(dy, box, () => stall(lot, { id: u.stall!, foods: sl.foods as never, awning: pick(awn), noren: pick([k.c.norenRed, k.c.navy, k.c.norenBrown, k.c.indigo]), lantern: pick([k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber]), equip: sl.equip }, 3, seed, wall));
      sa.label[1] += Y(l.base);
      stalls.push(sa);
      H = 14 + 2 * 12;
    } else if (u?.helix) {
      b.lifted(dy, box, () => helixTower(lot, n, seed));
      H = 14 + 12 * 12;
    } else if (u?.hotel) {
      const h = u.hotel;
      H = b.lifted(dy, box, () => neonBuilding(lot, n, { floors: h.floors, style: h.style, ground: 'hotel', seed, wall, hotel: h, roof: 'flat' }, l.d));
    } else if (u?.restaurant) {
      const foods = REST_FOODS[u.restaurant.id] as never;
      H = b.lifted(dy, box, () => neonBuilding(lot, n, { floors: 3 + Math.floor(r() * 3), style: pick<Style>(['showa', 'modern']), ground: u.restaurant!.kind, seed, wall, awning: canopy(), restaurant: { id: u.restaurant!.id, foods }, lanterns: lamps([k.c.lanternRed, k.c.lanternWhite]) }, l.d));
    } else if (u?.hidden) {
      // a plain housing block front; the Greenhouse door is the unmarked one beside the entrance
      H = b.lifted(dy, box, () => neonBuilding(lot, n, { floors: 5, style: 'apartment', ground: 'plain', seed, wall: n.concreteDark }, l.d));
      hidden = l;
    } else if (l.d === 'docks' && widthOf(l) >= 40 && r() < 0.5) {
      b.lifted(dy, box, () => warehouse(lot, n, seed));
      H = 34;
    } else {
      let ground: Ground = pick(GROUNDS[l.d]);
      if ((ground === 'pharmacy' || ground === 'soba') && widthOf(l) < 20) ground = 'shop';
      // a shop wants room for its counter and cases, and a door onto level street, not a flight of steps
      if (widthOf(l) < 22 || depthOf(l) < 28 || l.on === K.Stair) ground = 'plain';
      const floors = l.d === 'lantern' ? 3 + Math.floor(r() * 4) : l.d === 'sump' ? 2 + Math.floor(r() * 3) : l.d === 'docks' ? 2 + Math.floor(r() * 2) : l.d === 'neonmile' ? 3 + Math.floor(r() * 5) : l.d === 'stacks' ? 4 + Math.floor(r() * 3) : 3;
      const style: Style = l.d === 'stacks' ? 'apartment' : l.d === 'spire' || l.d === 'halo' ? 'modern' : pick<Style>(['showa', 'modern', 'showa', 'apartment']);
      const o: BuildingOpts = { floors, style, ground, seed, wall, awning: canopy(), lanterns: lamps([k.c.lanternRed, k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber]) };
      if (ground === 'konbini') o.signs = false;
      H = b.lifted(dy, box, () => neonBuilding(lot, n, o, l.d));
    }
    // what rises above the street front: towers over the Halo and on the ridge, megablocks on the Stacks,
    // the Mile's taller hotels and the market's odd Kowloon stack
    const roof = l.base + H;
    const inset: Box = [l.x0 + 1, l.z0 + 1, l.x1 - 1, l.z1 - 1];
    if (u?.helix || u?.stall) { /* their own crowns */ }
    else if ((l.d === 'halo' || l.d === 'spire') && widthOf(l) >= 36 && depthOf(l) >= 36) {
      tower(b, n, inset, roof + 1, Math.min(b.grid.sy - 60, roof + Math.round((l.d === 'halo' ? 200 + r() * 160 : 160 + r() * 200) * edge)), seed, l.d, { screen: l.side });
    } else if (l.d === 'stacks' && !u?.hotel) {
      const top = Math.max(roof + 24, l.base + Math.round((90 + r() * 90) * edge), l.base + bury);
      megablock(b, n, inset, roof + 1, top, seed, l.side);
      roofClutter(b, n, inset, top, seed, l.d);
    } else if (l.d === 'neonmile' && widthOf(l) >= 28 && depthOf(l) >= 32 && r() < 0.65) {
      // the Mile's hotels and arcades rise into lit towers over the bars
      const top = Math.min(b.grid.sy - 60, roof + 110 + Math.floor(r() * 200));
      tower(b, n, inset, roof + 1, top, seed, l.d, { screen: l.side, ribs: true });
    } else if (l.d === 'lantern' && r() < 0.3 && widthOf(l) >= 24) {
      const top = roof + 40 + Math.floor(r() * 60);
      megablock(b, n, inset, roof + 1, top, seed, l.side);
      roofClutter(b, n, inset, top, seed, l.d);
    } else if (roof < l.base + bury) {
      // a lot cut deep into the slope: its back rises with the hill as a plain block over the shop front
      const back: Box = l.side === 's' ? [l.x0, l.z0, l.x1, l.z1 - 12] : l.side === 'n' ? [l.x0, l.z0 + 12, l.x1, l.z1] : l.side === 'e' ? [l.x0, l.z0, l.x1 - 12, l.z1] : [l.x0 + 12, l.z0, l.x1, l.z1];
      megablock(b, n, back, roof + 1, l.base + bury + 12, seed, l.side);
      roofClutter(b, n, back, l.base + bury + 12, seed, l.d);
    }
    group(b, occ0, 20000 + l.id);
  }
  return { stalls, hidden };
}

/** A lot behind the street fronts: no door, just mass, by district. */
function backLot(b: Builder, n: NC, l: LotPlan, box: Box, bury: number, edge: number) {
  const r = rng(l.seed + 1);
  const w = l.x1 - l.x0 + 1, dd = l.z1 - l.z0 + 1;
  const y0 = l.base;
  switch (l.d) {
    case 'spire':
    case 'halo': {
      if (w >= 40 && dd >= 40) { tower(b, n, box, y0, Math.min(b.grid.sy - 60, y0 + Math.max(bury, Math.round((140 + r() * 260) * edge))), l.seed, l.d); return; }
      megablock(b, n, box, y0, y0 + Math.max(bury, 60 + Math.floor(r() * 60)), l.seed, 's');
      roofClutter(b, n, box, y0 + Math.max(bury, 60), l.seed, l.d);
      return;
    }
    case 'stacks': {
      const top = y0 + Math.max(bury, Math.round((90 + r() * 110) * edge));
      megablock(b, n, box, y0, top, l.seed, 's');
      roofClutter(b, n, box, top, l.seed, l.d);
      return;
    }
    case 'docks': {
      if (l.x0 * V > 100) { containers(b, n, l.x0 * V, l.z0 * V, (l.x1 + 1) * V, (l.z1 + 1) * V, l.seed, y0); return; }
      const top = y0 + Math.max(bury, 26 + Math.floor(r() * 20));
      shed(b, n, box, y0, top, l.seed);
      return;
    }
    default: {
      const top = y0 + Math.max(bury, Math.round((l.d === 'neonmile' ? 50 + r() * 90 : 36 + r() * 70) * edge));
      if (l.d === 'neonmile' && w >= 36 && dd >= 36 && r() < 0.7) { tower(b, n, box, y0, Math.min(b.grid.sy - 60, top + 140 + Math.floor(r() * 120)), l.seed, l.d, { ribs: true }); return; }
      megablock(b, n, box, y0, top, l.seed, 's');
      roofClutter(b, n, box, top, l.seed, l.d);
    }
  }
}

/** A corrugated dock shed with a saw-tooth roof, its walls streaked with rust. */
function shed(b: Builder, n: NC, box: Box, y0: number, y1: number, seed: number) {
  const g = b.grid, r = rng(seed);
  const [x0, z0, x1, z1] = box;
  const wall = r() < 0.5 ? n.corrugated : n.corrugatedB;
  g.box(x0, y0, z0, x1, y1 - 1, z1, (x, y, z) => ((x + z) % 2 === 0 ? wall : (y - y0) % 8 === 0 ? n.rustBrown : hash3(x, y, z) < 0.05 ? n.rustRed : wall));
  for (let zz = z0; zz <= z1; zz += 8)
    for (let s = 0; s < 5; s++) g.box(x0, y1 + s, zz + s, x1, y1 + s, Math.min(z1, zz + 7), s === 4 ? n.litGlass : n.corrugatedB);
  b.occlude(x0, z0, x1, z1, Y(y1) + 2, Y(y0) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(y0);
}

/**
 * The dock podium the skybridge lands on: a windowless block of server halls to the ridge's height, its roof a
 * deck of glass pavers with planters and benches, its flanks hung with screens over the canal.
 */
function podium(b: Builder, n: NC, p: Plan, l: LotPlan) {
  const g = b.grid;
  const deck = l.deck!;
  for (let z = l.z0; z <= l.z1; z++)
    for (let x = l.x0; x <= l.x1; x++) {
      if (p.lot[col(x, z)] !== l.id) continue;
      g.box(x, l.base, z, x, deck - 1, z, (xx, y, zz) => {
        const edge = xx === l.x0 || xx === l.x1 || zz === l.z0 || zz === l.z1;
        if (!edge) return n.soot;
        if ((y - l.base) % 16 < 2) return n.steelDark;
        return hash3(xx, y, zz) < 0.04 ? n.ledG : pm(xx + zz, 12) === 0 ? n.steel : n.navy;
      });
      g.set(x, deck - 1, z, (pm(x >> 1, 2) + pm(z >> 1, 2)) & 1 ? n.plazaA : n.plazaB);
    }
  holoScreen(b, n, [l.x0, l.z0, l.x1, l.z1], 'w', l.base + 16, deck - 8, l.seed);
  holoScreen(b, n, [l.x0, l.z0, l.x1, l.z1], 's', l.base + 12, deck - 10, l.seed + 1);
  b.occlude(l.x0, l.z0, l.x1, l.z1, Y(deck) + 0.5, Y(l.base) + 0.95, 'building');
  b.occluders[b.occluders.length - 1].floor = Y(l.base);
  // up on the deck: planters with real trees, benches facing the ridge
  const k = b.k;
  const cx = (l.x0 + l.x1) / 2 * V, yd = Y(deck);
  for (const dz of [-1.2, 2.6]) {
    const tz = SKYBRIDGE.z + dz * 2.2;
    g.box(M(cx - 1), deck, M(tz) - 3, M(cx + 1), deck, M(tz) + 3, n.steelDark);
  }
  b.place(bench(k), cx + 3, yd, SKYBRIDGE.z - 2.6, 0); b.benches.push([cx + 3, SKYBRIDGE.z - 2.6, 0, yd]); b.block(cx + 2.1, SKYBRIDGE.z - 3, cx + 3.9, SKYBRIDGE.z - 2.2);
  b.lamp(cx, yd + 3, SKYBRIDGE.z, [0.4, 0.9, 1], 9, 0.7);
}

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
  // the rings of light set in the paving glow up onto whoever stands on them, and the pink ring overhead tints the square
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    b.lamp(Math.cos(a) * 15, 0.7, Math.sin(a) * 15, [0.45, 0.95, 1], 6, 0.5);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.3;
    b.lamp(Math.cos(a) * 6.2, 0.7, Math.sin(a) * 6.2, [0.45, 0.95, 1], 4.5, 0.5);
  }
  b.lamp(0, 9, 0, [1, 0.4, 0.75], 24, 0.45);
}


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



// ---------------------------------------------------------------------------------------------
// The docks' yards, the skybridge

/** Containers stacked on a dock yard standing on layer `B` (rect in metres). */
function containers(b: Builder, n: NC, x0: number, z0: number, x1: number, z1: number, seed: number, B: number) {
  const g = b.grid, r = rng(seed);
  for (let x = M(x0) + 1; x + 24 <= M(x1); x += 26)
    for (let z = M(z0) + 1; z + 10 <= M(z1); z += 11) {
      const h = 1 + Math.floor(r() * 4);
      for (let l = 0; l < h; l++) {
        const colr = n.container[Math.floor(r() * n.container.length)];
        const y0 = B + l * 10;
        g.box(x, y0, z, x + 23, y0 + 9, z + 9, (xx, yy) => ((xx - x) % 3 === 0 ? n.steelDark : yy === y0 + 9 ? n.steel : colr));
        const top = l === h - 1, roll = r();
        if (top && l > 0 && roll < 0.3) {
          // someone lives up here: a window cut in each long side, lit from inside, a strip of neon over it
          for (const zz of [z, z + 9]) {
            g.box(x + 6, y0 + 3, zz, x + 15, y0 + 6, zz, n.litGlass);
            g.box(x + 6, y0 + 7, zz, x + 15, y0 + 7, zz, n.neon[Math.floor(r() * 6)]);
          }
        } else if (roll < 0.45) g.box(x + 23, y0 + 5, z + 4, x + 23, y0 + 5, z + 5, n.ledG);
      }
    }
  b.block(x0, z0, x1, z1);
  b.occlude(M(x0), M(z0), M(x1) - 1, M(z1) - 1, Y(B) + 10.5, Y(B) + 2, 'landmark');
  b.occluders[b.occluders.length - 1].floor = Y(B);
  // a gantry crane over the yard, floodlights under its boom
  if (x1 - x0 > 12 && z1 - z0 > 20) crane(b, n, x0 + 2, (z0 + z1) / 2 - 2, B);
}

/** A dockside gantry crane, its legs at (x, z) metres, standing on layer `B`. */
function crane(b: Builder, n: NC, x: number, z: number, B: number) {
  const g = b.grid;
  const X = M(x), Z = M(z), y = Y(B);
  for (const [dx, dz] of [[0, 0], [16, 0], [0, 12], [16, 12]]) g.box(X + dx, B, Z + dz, X + dx + 1, B + 64, Z + dz + 1, n.yellowSteel);
  g.box(X, B + 64, Z, X + 17, B + 66, Z + 13, n.yellowSteel);
  g.box(X - 30, B + 66, Z + 5, X + 60, B + 68, Z + 8, n.yellowSteel);
  g.box(X + 4, B + 56, Z + 2, X + 12, B + 63, Z + 10, n.steelDark);
  g.box(X + 4, B + 58, Z + 2, X + 4, B + 61, Z + 10, n.litGlass);
  for (const [bx, bz] of [[0, 0], [16, 12]]) g.set(X + bx, B + 66, Z + bz, n.beacon);
  g.box(X - 30, B + 68, Z + 6, X - 30, B + 68, Z + 7, n.beacon); g.box(X + 60, B + 68, Z + 6, X + 60, B + 68, Z + 7, n.beacon);
  for (const fx of [-24, 24, 44]) {
    g.box(X + fx, B + 65, Z + 5, X + fx + 1, B + 65, Z + 8, n.flood);
    b.lamp((X + fx) * V + 0.25, y + 14, (Z + 6.5) * V, [1, 0.92, 0.75], 16, 0.7);
  }
  b.block(x - 0.1, z - 0.1, x + 0.6, z + 0.6); b.block(x + 3.9, z - 0.1, x + 4.6, z + 0.6); b.block(x - 0.1, z + 2.9, x + 0.6, z + 3.6); b.block(x + 3.9, z + 2.9, x + 4.6, z + 3.6);
  b.occlude(X - 30, Z, X + 60, Z + 13, y + 17.5, y + 2, 'landmark');
  b.occluders[b.occluders.length - 1].floor = y;
}

/** The skybridge's glass walls, its roof truss and the lights down its length; a deep girder under the span. */
function skybridge(b: Builder, n: NC, p: Plan) {
  const g = b.grid;
  const zc = SKYBRIDGE.z, hw = SKYBRIDGE.w / 2;
  const yL = layerOf(SPIRE_Y);
  const za = M(zc - hw), zb = M(zc + hw) - 1;
  for (let x = M(52); x < M(PODIUM[0] + 1.5); x++) {
    if (p.kind[col(x, za + 2)] !== K.Bridge) continue;
    for (const z of [za, zb]) {
      g.box(x, yL, z, x, yL + 9, z, pm(x, 8) === 0 ? n.steelDark : n.plazaGlass);
      g.set(x, yL + 10, z, n.steelDark);
    }
    // the roof: ribs every two metres, a cyan line down the middle
    if (pm(x, 8) === 0) g.box(x, yL + 10, za, x, yL + 10, zb, n.steelDark);
    g.set(x, yL + 11, M(zc), n.guideCyan);
    // under the span, a truss
    const over = Math.abs(x * V - canalX(zc)) < CANAL_HALF + 1;
    if (over) {
      g.box(x, yL - 6, za, x, yL - 2, za, pm(x, 6) < 2 ? n.steelDark : 0);
      g.box(x, yL - 6, zb, x, yL - 2, zb, pm(x, 6) < 2 ? n.steelDark : 0);
      g.box(x, yL - 7, za, x, yL - 7, zb, n.steelDark);
      if (pm(x, 12) === 0) b.lamp(x * V, SPIRE_Y - 2, zc, [0.4, 0.9, 1], 6, 0.5);
    }
    if (pm(x, 24) === 0) b.lamp(x * V, SPIRE_Y + 2.4, zc, [0.6, 0.95, 1], 6, 0.6);
  }
  b.occlude(M(52), za, M(PODIUM[0] + 1.5), zb, SPIRE_Y + 3, SPIRE_Y + 0.6, 'landmark');
  b.occluders[b.occluders.length - 1].floor = SPIRE_Y;
}

// ---------------------------------------------------------------------------------------------
// Street furniture, along every street whatever way it runs

function furnish(b: Builder, n: NC, p: Plan, vending: [number, number, number][]) {
  const k = b.k;
  const doors = b.rooms.map((rm) => rm.door);
  const stands = b.stallAnchors.map((s) => s.stand);
  const clear = (x: number, z: number, rad = 1.6) => !doors.some(([dx, dz]) => Math.hypot(dx - x, dz - z) < rad + 1.2) && !stands.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < rad + 1)
    && !b.blockers.some(([a, c, bb, d]) => x > a - 0.4 && x < bb + 0.4 && z > c - 0.4 && z < d + 0.4);
  // flat path under a prop's footprint, at one level
  const flatAt = (x: number, z: number, r = 2): number => {
    const X = Math.floor(x / V), Z = Math.floor(z / V);
    if (!inMap(X, Z)) return -1;
    const c0 = col(X, Z), k0 = p.kind[c0], w0 = p.walk[c0];
    if (!isPath(k0) || k0 === K.Stair || k0 === K.Bridge || k0 === K.Plaza) return -1;
    for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
      if (!inMap(X + dx, Z + dz)) return -1;
      const c = col(X + dx, Z + dz);
      if (!isPath(p.kind[c]) || p.walk[c] !== w0) return -1;
    }
    return w0;
  };
  let i = 0;
  for (const s of p.segs) {
    if (s.kind === K.Stair || s.kind === K.Bridge || s.kind === K.Pier || s.kind === K.Deck) continue;
    const [ax, , az] = s.a, [bx, , bz] = s.b;
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 6) continue;
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    const alongX = Math.abs(ux) >= Math.abs(uz);
    const step = s.kind === K.Avenue ? 9 : s.kind === K.Lane ? 7 : 11;
    for (let t = 4; t < len - 3; t += step, i++) {
      const cx = ax + ux * t, cz = az + uz * t;
      if (Math.hypot(cx, cz) < PLAZA_R + 3) continue; // the Halo's plaza keeps clear
      for (const sgn of [-1, 1]) {
        const off = s.kind === K.Lane ? s.w / 2 - 0.45 : s.w / 2 - (s.kind === K.Quay ? 0.9 : 1.5);
        const x = cx - uz * off * sgn, z = cz + ux * off * sgn;
        const wx = Math.floor(x * 4) * V + 0.125, wz = Math.floor(z * 4) * V + 0.125;
        const w = flatAt(wx, wz);
        if (w < 0 || !clear(wx, wz)) continue;
        const y = Y(w);
        const pickI = (i * 7 + (sgn > 0 ? 3 : 0)) % 10;
        // face across the street (towards its middle)
        const face = alongX ? (sgn * ux > 0 ? 2 : 0) : (sgn * uz < 0 ? 3 : 1);
        if (s.kind === K.Lane) {
          if (pickI < 3) { b.place(trashBags(b, i), wx, y, wz, face); b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5); }
          else if (pickI < 5) { b.place(crateStack(k, i), wx, y, wz, face); b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5); }
          else if (pickI < 6) { b.place(scooter(k, [k.c.cubRed, k.c.vmBlue, k.c.black][i % 3]), wx, y, wz, alongX ? 0 : 1); b.block(wx - 0.8, wz - 0.8, wx + 0.8, wz + 0.8); }
          continue;
        }
        if (pickI === 0 || pickI === 5) {
          b.place(streetLamp(k), wx, y, wz, face);
          b.lamp(wx, y + 3.6, wz, s.d === 'docks' ? [1, 0.7, 0.42] : pickI ? COOL : [0.85, 0.75, 1], 8, 0.9);
          b.block(wx - 0.25, wz - 0.25, wx + 0.25, wz + 0.25);
        } else if (pickI === 2) {
          b.place(holoPole(b, n, i), wx, y, wz, face);
          b.lamp(wx, y + 4.3, wz, NEON_RGB[i % 6], 6, 0.7);
          b.block(wx - 0.25, wz - 0.25, wx + 0.25, wz + 0.25);
        } else if (pickI === 3 && (s.kind === K.Avenue || s.kind === K.Quay)) {
          b.place(bench(k), wx, y, wz, face);
          b.benches.push([wx, wz, [0, Math.PI / 2, Math.PI, -Math.PI / 2][face] ?? 0, y]);
          b.block(wx - 0.9, wz - 0.9, wx + 0.9, wz + 0.9);
        } else if (pickI === 7) {
          const colr = [k.c.vmRed, k.c.vmBlue, k.c.vmWhite, k.c.black][i % 4];
          b.place(vendingMachine(k, colr, i), wx, y, wz, face);
          vending.push([wx, y, wz]);
          b.lamp(wx, y + 1.2, wz, COOL, 3, 0.8);
          b.block(wx - 0.5, wz - 0.5, wx + 0.5, wz + 0.5);
        } else if (pickI === 8) {
          b.place(utilityBox(k, i), wx, y, wz, face);
          b.block(wx - 0.4, wz - 0.4, wx + 0.4, wz + 0.4);
        } else if (pickI === 9 && s.kind !== K.Avenue) {
          b.place(binCorner(k), wx, y, wz, face);
          b.block(wx - 0.4, wz - 0.4, wx + 0.4, wz + 0.4);
        }
      }
      // wires and signs strung across narrow streets, lanterns over the market's lanes
      if (s.kind !== K.Avenue && s.kind !== K.Quay && i % 2 === 0) {
        const w = flatAt(cx, cz, 0);
        if (w < 0) continue;
        const y = Y(w);
        b.place(wire(k, s.w + 1, 0.35 + (i % 3) * 0.15), cx, y + 5.4 + (i % 4) * 0.5, cz, alongX ? 1 : 0);
        if ((s.d === 'lantern' || s.d === 'sump' || i % 4 === 0) && s.w <= 6) {
          b.swayParent = b.lastSway[0] ?? 0;
          b.place(lantern(k, [k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber][i % 3], 4, 5, i), cx, y + 4.6 + (i % 4) * 0.5, cz);
          b.swayParent = 0;
          b.lamp(cx, y + 4.8, cz, i % 3 === 1 ? WHITEWARM : RED, 4, 0.6);
        }
      }
    }
  }
  // steam from the manholes and the market's vents
  let e = 0;
  for (const s of p.segs) {
    if (s.kind !== K.Street && s.kind !== K.Lane) continue;
    if (e++ % 3) continue;
    const cx = (s.a[0] + s.b[0]) / 2, cz = (s.a[2] + s.b[2]) / 2, w = flatAt(cx, cz, 0);
    if (w >= 0) b.emitters.push({ kind: 'steam', pos: [cx, Y(w) + 0.1, cz], rate: 0.6 });
  }
}

/** A point along the first street of that name (fraction t, metres off its middle), at its own height. */
function along(p: Plan, name: string, t: number, off = 0): [number, number, number] {
  const s = p.segs.find((q) => q.name === name) ?? p.segs[0];
  const [ax, , az] = s.a, [bx, , bz] = s.b;
  const len = Math.hypot(bx - ax, bz - az) || 1;
  const x = ax + (bx - ax) * t - ((bz - az) / len) * off, z = az + (bz - az) * t + ((bx - ax) / len) * off;
  const X = Math.floor(x / V), Z = Math.floor(z / V);
  return [x, inMap(X, Z) ? Y(p.walk[col(X, Z)]) : 0, z];
}

// ---------------------------------------------------------------------------------------------

export function buildNeo(win?: Window): BuildResult {
  const b = new Builder(win);
  const n = neoColors(b);
  const k = b.k;
  const p = neoPlan();
  ground(b, n, p);
  halo(b, n);
  const uses = assign(p.lots);
  const { stalls, hidden } = buildLots(b, n, p, uses);
  skybridge(b, n, p);
  const vending: [number, number, number][] = [];
  furnish(b, n, p, vending);

  // the three seed capsules, tucked where only the curious look: the far end of the Sump under the ridge,
  // the top of the Stacks, the end of the North Pier
  const sump = p.segs.find((s) => s.name === 'The Sump')!;
  const sky = p.segs.filter((s) => s.name === 'Sky Row' || s.name === 'Laundry Lane');
  const top = sky.length ? sky[sky.length - 1] : p.segs.find((s) => s.d === 'stacks')!;
  const pier = p.segs.find((s) => s.name === 'North Pier')!;
  const capsule = (s: PathSeg, end: 'a' | 'b', off: number): [number, number, number] => {
    const [ax, , az] = s[end], [bx, , bz] = s[end === 'a' ? 'b' : 'a'];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    const x = ax + ((bx - ax) / len) * 1.2 - ((bz - az) / len) * off, z = az + ((bz - az) / len) * 1.2 + ((bx - ax) / len) * off;
    return [x, Y(p.walk[col(Math.floor(x / V), Math.floor(z / V))]), z];
  };
  const manekis: [number, number, number][] = [capsule(sump, 'a', sump.w / 2 - 0.6), capsule(top, 'a', top.w / 2 - 0.6), capsule(pier, 'b', 1.2)];
  for (const m of manekis) b.place(seedCapsule(b, n), m[0], m[1], m[2], 0);

  // the Greenhouse door: an unmarked steel door in a Stacks housing block
  const hd: Anchors['hiddenDoor'] = { stand: [0, 0], label: [0, 3, 0], reveal: [0, 0, 0] };
  if (hidden) {
    const h = hidden as LotPlan;
    const lot = new Lot(b, h.x0, h.z0, h.x1, h.z1, h.side);
    const a = lot.width / 2 + 7;
    const yb = Y(h.base);
    b.lifted(h.base - G, [h.x0, h.z0, h.x1, h.z1], () => {
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
      const [lx, lz] = lot.front(a, 0.5);
      b.lamp(lx, 2.6, lz, [0.8, 0.5, 1], 3, 0.5);
    });
    const [sx, sz] = lot.front(a, 0.9);
    const [lx, lz] = lot.front(a, 0.5);
    const [rx, rz] = lot.front(a, 2.5);
    hd.stand = [sx, sz]; hd.label = [lx, yb + 3.2, lz]; hd.reveal = [rx, yb, rz];
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
  const anchors: Anchors = {
    spawn: [4, 0, 4],
    stalls,
    hiddenDoor: hd,
    interiorExit: [0, 0], interiorSpawn: [0, 0, 0], chef: [0, 0, 0], counterStand: [0, 0],
    manekis,
    graph: { nodes: p.nodes, edges: p.edges },
    idlers: [
      { id: 'saul', pos: [-9.5, 0, 9.5] },
      { id: 'courier', pos: along(p, 'Meridian Boulevard', 0.6, 3.5) },
      { id: 'netrunner', pos: along(p, 'Capital Road', 0.5, 2.5) },
      { id: 'preacher', pos: [12, 0, -12.5] },
      { id: 'dockhand', pos: along(p, 'Crane Street', 0.5, 2.5) },
      { id: 'dj', pos: along(p, 'Mile Street', 0.5, 2.4) },
      { id: 'ripper', pos: along(p, 'Glass Road Low', 0.5, 1.5) },
      { id: 'gran', pos: along(p, 'Kowloon Road', 0.55, 1.8) },
      { id: 'busker', pos: along(p, 'Meridian Boulevard', 0.5, -3.5) },
      { id: 'cop', pos: [21, 0, -4.5] },
      { id: 'kid', pos: along(p, 'Kiss Lane', 0.5, 1.2) },
      { id: 'fisher', pos: along(p, 'Canal Walk', 0.5, -1.5) },
    ],
    benches: b.benches,
    stools: b.stools, cafeTables: b.cafeTables,
    cats: [along(p, 'Kowloon Road', 0.3, -1.8), along(p, 'Fourth Lane', 0.5), along(p, 'Velvet Lane', 0.5), along(p, 'Crane Street', 0.3, -2), along(p, 'Commons Road', 0.4), along(p, 'The Sump', 0.4)],
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
  const interior = buildGreenhouse(b, anchors, n);
  return {
    grid: b.grid, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells,
    // the standing layer is looked for just above each column's floor: a building's columns start at its ground
    // floor (nobody stands on its roof), the podium's at its deck, streets and stairs a little over their surface
    navTop: (x, z) => {
      if (!inMap(x, z)) return 0;
      const ci = col(x, z), id = p.lot[ci];
      if (id) { const l = p.lots[id - 1]; return Math.min(b.grid.sy - 8, l.deck !== undefined ? l.deck + 3 : l.base + 8); } // as Tokyo's G + 8: its buildings' floors and steps
      return Math.min(b.grid.sy - 8, p.walk[ci] + 3);
    },
    groundAt: (x, z) => (inMap(x, z) ? Math.max(G, p.lot[col(x, z)] ? p.lots[p.lot[col(x, z)] - 1].base : p.walk[col(x, z)]) : G),
  };
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
