import { paintColors, picture, toProp } from './paintings';
import { SparseGrid, rng, hash3 } from './grid';
import { Palette } from './palette';
import type { Lamp } from './lighting';
import { G, SX, SY, SZ, V, VX0, VZ0, ISX, ISY, ISZ, INTERIOR_ORIGIN } from './layout';

/** Extent of the original district (voxels from the origin), which the city grows around. */
const OSX = 288;
import {
  Prop, rotateProp, makePropColors, PropKit, lantern, giantLantern, verticalSign, boardSign, noren, vendingMachine,
  acUnit, crateStack, stool, plantPot, stoneLantern, incenseBurner, streetLamp, bench, bicycle, nobori, manekiNeko, wire,
  postBox, trafficMirror, bollard, scooter, aFrame, binCorner, flowerStand, bookCart, fishDisplay, breadShelf, jizo, meters,
  billboard, antenna, planterBox, cafeTable,
} from './props';
import { buildFood, FoodId } from './food';
import { buildCity, hillAt } from './city';
import { tokyoBeyond, beyondCell } from './tokyoEdge';
import { SwayBody, SWAY, swayKey } from './sway';
import { wrapLot, dressBlock, skin, lotFace } from './facades';
import { noteFront } from './dressing';
import type { HallAnchor } from './sacred';
import { shopFloor, closedRoom, interiorColors, daruma, IC, RoomAnchor, RoomKind, SecretAnchor, DarumaSpot, RestaurantSpec } from './interiors';
import { hotelFloors, type HotelAnchor } from './hotels';
import { hotelAt, type HotelInfo } from '../data/hotels';

export interface PlacedProp {
  prop: Prop;
  origin: [number, number, number]; // metres
  /** Separate meshes are kept out of the static chunk batches so the game can toggle them. */
  tag?: string;
  /** Global sway body id for each of the prop's bodies. */
  sway?: Uint16Array;
}

export interface StallAnchor {
  id: string;
  stand: [number, number]; // where the player stands to order (metres)
  vendor: [number, number, number]; // vendor feet + facing angle
  label: [number, number, number];
}

export interface Emitter {
  kind: 'steam' | 'smoke' | 'incense';
  pos: [number, number, number];
  rate: number;
}

/**
 * Something tall that may stand between the camera and the player. The cutaway lowers it as a whole
 * (see game/cutaway.ts): rect in metres, top of everything it owns, and the height it is cut down to.
 */
export interface Occluder {
  rect: [number, number, number, number];
  top: number;
  low: number;
  kind: 'building' | 'landmark' | 'tree';
  /** Occluders sharing a group always lower together. */
  group?: number;
  /** Height of its ground floor (metres) where the street is not at 0, on a hillside. */
  floor?: number;
  /**
   * A great hall one walks into (a cathedral's nave, a mosque's prayer hall): standing inside it the cutaway opens it
   * like a building's dollhouse, cut this many metres above its floor instead of a room's ceiling height.
   */
  room?: number;
  /** A great hall's inside wall height (metres over its floor): standing inside, the two far walls keep it. */
  walls?: number;
  /** Voxels of outer wall where it is thicker than a building's (world/owners.ts SHELL). */
  shell?: number;
  /**
   * A great hall's air, its floor plan inside the walls (metres): everything of the hall outside it (walls, front,
   * portico, apse) belongs to one of its four sides, and each side falls or stands as one piece.
   */
  air?: [number, number, number, number];
  /** Index of the great hall (in the same list) this one falls with, side by side: its bell tower, minarets, court. */
  follow?: number;
  /** Columns (metres) it owns even where a building's footprint overlaps them: a front wider than its neighbours' lots. */
  claim?: [number, number, number, number];
}

export interface Anchors {
  spawn: [number, number, number];
  stalls: StallAnchor[];
  hiddenDoor: { stand: [number, number]; label: [number, number, number]; reveal: [number, number, number] };
  interiorExit: [number, number];
  interiorSpawn: [number, number, number];
  chef: [number, number, number];
  counterStand: [number, number];
  manekis: [number, number, number][];
  graph: { nodes: [number, number][]; edges: [number, number][] };
  idlers: { id: string; pos: [number, number, number] }[];
  /** Street benches: centre x, z, the angle a sitter faces and the ground they stand on (0 when left out). */
  benches: [number, number, number, number?][];
  /** Single outdoor seats (café terrace stools): x, z, the angle a sitter faces and the ground (0 when left out). */
  stools: [number, number, number, number?][];
  /** Steps people sit on (x, z and the angle a sitter faces): they sit on the step itself, feet on the ones below. */
  stepSeats?: [number, number, number][];
  cats: [number, number, number][];
  /** People who keep to one spot all day (Istanbul's anglers on the bridge): where, facing which way, their look. */
  /** People who keep to one spot; `indoor` ones stand inside a shop, off the street's nav, at pos's own height. */
  extras?: { pos: [number, number, number]; face: number; seed: number; indoor?: boolean }[];
  emitters: Emitter[];
  /** Where fireflies dance on summer nights (metres). */
  fireflies: [number, number, number][];
  /** The box (x0, z0, x1, z1 in metres) where cherry petals drift; a city without the sakura leaves it out. */
  petals?: [number, number, number, number];
  vending: [number, number, number][];
  blockers: [number, number, number, number][];
  /** The pond the koi swim in (x0, z0, x1, z1); left out where there are none. */
  koiArea?: [number, number, number, number];
  /** Walkable ground-floor rooms behind the storefronts. */
  rooms: RoomAnchor[];
  /** The hotels: their lobbies are among the rooms, their guest rooms upstairs are here. */
  hotels: HotelAnchor[];
  /** Tiny daruma dolls hidden inside the shops. */
  darumas: [number, number, number][];
  secret: SecretAnchor | null;
  occluders: Occluder[];
  /** Overhead wires birds can sit on: end x, z, other end x, z, height of the top of the wire at its ends, sag (m). */
  wires: [number, number, number, number, number, number][];
  /** Skylights the sun shines down through (bazaar halls): top centre x, y, z, the opening's size x, z and the floor y (m). */
  shafts?: [number, number, number, number, number, number][];
  /** Covered markets lit warm all day: x0, z0, x1, z1 and the roof's height (m); at most three. */
  warm?: [number, number, number, number, number][];
  /** The great halls one walks into: a cathedral's nave, a mosque's prayer hall (see world/sacred.ts). */
  halls?: HallAnchor[];
}

export interface BuildResult {
  grid: SparseGrid;
  pal: Palette;
  props: PlacedProp[];
  lamps: Lamp[];
  anchors: Anchors;
  interior: { grid: SparseGrid; props: PlacedProp[]; lamps: Lamp[] };
  /** Voxel boxes of indoor air that get a soft ambient light. */
  indoor: [number, number, number, number, number, number][];
  /** Every sway body in the build (street and interior); voxels and vertices refer to them by 1-based id. */
  sway: SwayBody[];
  /** Street grid voxels (see swayKey) that belong to a sway body, e.g. sakura canopies. */
  swayCells: Map<number, number>;
  /** Hillside cities: the voxel layer each column's walk-map scan starts from (just above its highest floor). */
  navTop?: (x: number, z: number) => number;
  /** Hillside cities: the layer of the terrain's surface in each column, which is never a mass to cut away. */
  groundAt?: (x: number, z: number) => number;
}

export type Side = 's' | 'n' | 'e' | 'w';
const TURNS: Record<Side, number> = { s: 0, e: 1, n: 2, w: 3 };

function worldColors(pal: Palette) {
  const a = (hex: number, vary = 0.06, o: { emit?: number; night?: boolean; leaf?: boolean; glass?: boolean } = {}) => pal.add(hex, { vary, ...o });
  const F = { leaf: true }, GL = { glass: true };
  return {
    earth: a(0x6b5644, 0.1), bedrock: a(0x5b5550, 0.1),
    paveA: a(0xa59d92, 0.07), paveB: a(0x968e84, 0.07), paveC: a(0xb4ab9e, 0.06), grout: a(0x6f6962, 0.05),
    asphalt: a(0x55565c, 0.05), concrete: a(0x8d8a84, 0.07), concreteDark: a(0x6e6b66, 0.07), stain: a(0x5f5c57, 0.05),
    granite: a(0xc2bcb2, 0.06), graniteDark: a(0xa39d94, 0.06), curb: a(0xd2ccc2, 0.04), gravel: a(0xcfc6b4, 0.12),
    soil: a(0x5a4434, 0.1), grass: a(0x6c9a46, 0.14), grassDark: a(0x557f38, 0.14), clover: a(0x86b453, 0.12),
    petal: a(0xf2b8c8, 0.08), petalDeep: a(0xe58aa6, 0.08),
    canalStone: a(0x8a857c, 0.1), canalStoneDark: a(0x6f6a62, 0.1), mortar: a(0x5d5a54, 0.05), wetStone: a(0x55574f, 0.08),
    algae: a(0x4e6a3a, 0.14), pebble: a(0x7d7468, 0.16), sand: a(0x9c8a6a, 0.12), weed: a(0x3f7a3a, 0.16), weedLight: a(0x5f9a4a, 0.16),
    manhole: a(0x45423d, 0.04), grate: a(0x3a3835, 0.03), whiteLine: a(0xe8e2d4, 0.03),
    // building materials
    cream: a(0xeadcc2, 0.05), beige: a(0xd8c4a2, 0.05), sand2: a(0xcdb894, 0.05), mint: a(0xa9cbb6, 0.05), sky: a(0xa7bccb, 0.05),
    blush: a(0xe2b4a2, 0.05), terracotta: a(0xbd7656, 0.06), tileWhite: a(0xe6e4dd, 0.04), tileBrown: a(0x8f6a4f, 0.06),
    concreteWall: a(0xb7b3aa, 0.06), slate: a(0x6b7280, 0.05), olive: a(0x8f9a6a, 0.05), mustard: a(0xd9b25a, 0.05),
    trim: a(0xf2ede3, 0.03), trimDark: a(0x4b4440, 0.04),
    wood: a(0x8b5a3c, 0.08), woodDark: a(0x4f3424, 0.07), woodMid: a(0x6e4630, 0.08), hinoki: a(0xdcc092, 0.05), cedar: a(0x3a2c26, 0.06),
    glass: a(0x58738c, 0.05, GL), glassDark: a(0x3e5466, 0.05, GL), glassLit: a(0x6f8aa3, 0.05, { emit: 0.85, night: true, glass: true }),
    shopGlow: a(0xffd7a0, 0.04, { emit: 0.5 }), konbiniGlass: a(0xe6f6ff, 0.02, { emit: 0.85, glass: true }),
    shutterA: a(0xa9adb0, 0.02), shutterB: a(0x8e9295, 0.02),
    roofTile: a(0x434a58, 0.05), roofTileB: a(0x3a404c, 0.05), roofRidge: a(0x2c313b, 0.04), roofGreen: a(0x5f8f7f, 0.06), roofGreenB: a(0x527f70, 0.06),
    roofFlat: a(0x9e9a92, 0.06), parapet: a(0xb9b5ac, 0.05), tank: a(0xdfe2e0, 0.03), tankLeg: a(0x6a6d70, 0.04),
    lacquer: a(0xc8372d, 0.04), lacquerDark: a(0x9e2a23, 0.04), vermilion: a(0xde5a32, 0.04), templeWhite: a(0xf2ece0, 0.03),
    gold: a(0xd8a940, 0.05), stoneStep: a(0xb3ada3, 0.05), stone: a(0x9c978e, 0.1),
    awnRed: a(0xc9463d, 0.03), awnWhite: a(0xf1ece2, 0.03), awnGreen: a(0x3f7f5f, 0.03), awnBlue: a(0x35609a, 0.03), awnOrange: a(0xdf8a3c, 0.03), awnNavy: a(0x2b3a62, 0.03),
    trunk: a(0x4a3a32, 0.1), trunkDark: a(0x3a2d27, 0.1),
    sakura: a(0xf6bfd0, 0.1, F), sakuraB: a(0xf1a8bf, 0.1, F), sakuraC: a(0xfad6e0, 0.08, F), sakuraD: a(0xe892ad, 0.1, F),
    boat: a(0x7d5536, 0.07), boatDark: a(0x5a3b26, 0.07), boatRim: a(0xa8774a, 0.06), tarp: a(0x3f6e9a, 0.05),
    goodsA: a(0xe9504a, 0.05), goodsB: a(0xf2c74a, 0.05), goodsC: a(0x4aa3e9, 0.05), goodsD: a(0x6cc06a, 0.05), goodsE: a(0xf08ac0, 0.05), goodsF: a(0xffffff, 0.02),
    tableCloth: a(0xb83a32, 0.03),
    konbiniStripeA: a(0x2e9a5a, 0.02), konbiniStripeB: a(0x2b6fc4, 0.02), konbiniStripeC: a(0xf08a2c, 0.02),
    signLit: a(0xfff4dd, 0.02, { emit: 0.9 }),
    pole: a(0x9b9a95, 0.05),
    laundryA: a(0xf2efe6, 0.03), laundryB: a(0x8cb6e0, 0.04), laundryC: a(0xf09a9a, 0.04), laundryD: a(0xf5d76a, 0.04),
    tatami: a(0xc8c084, 0.06), tatamiEdge: a(0x3a5a3a, 0.04), plaster: a(0xe9e0cc, 0.04), shoji: a(0xf8f2e2, 0.02, { emit: 0.25 }),
    counterTop: a(0xe6cc9c, 0.03),
    tactile: a(0xe2b93a, 0.04), tactileDot: a(0xc99f28, 0.04), manholeBlue: a(0x3a5f8a, 0.05), manholeRed: a(0xa8443a, 0.05),
    leaf: a(0x4f8a3a, 0.14, F), leafDark: a(0x35662c, 0.14, F), pipe: a(0x9a9c98, 0.04), ivy: a(0x3f6e34, 0.16, F),
    namako: a(0x5d636b, 0.04), plasterWhite: a(0xf1ede4, 0.03), kuraBase: a(0x3a3638, 0.04), steelStair: a(0x6d7378, 0.04),
    awnYellow: a(0xe9b83a, 0.03), awnBrown: a(0x7a4a2e, 0.03), awnPink: a(0xe58aa6, 0.03),
    // the city around the old district
    neonPink: a(0xff5fb4, 0.03, { emit: 0.95 }), neonCyan: a(0x5ff0ff, 0.03, { emit: 0.95 }), neonViolet: a(0xa47bff, 0.03, { emit: 0.95 }),
    neonYellow: a(0xffdc5a, 0.03, { emit: 0.95 }), neonGreen: a(0x7dffa8, 0.03, { emit: 0.95 }), neonOrange: a(0xff9a4a, 0.03, { emit: 0.95 }),
    screenDark: a(0x1c2238, 0.04), screenA: a(0x4f7dff, 0.06, { emit: 0.85 }), screenB: a(0xff7ac2, 0.06, { emit: 0.85 }), screenC: a(0xfff1c2, 0.04, { emit: 0.9 }),
    glassBlue: a(0x5f87a8, 0.04, GL), glassTeal: a(0x4d8a92, 0.04, GL), glassNight: a(0x8fb4d6, 0.05, { emit: 0.7, night: true, glass: true }),
    steel: a(0x7d8389, 0.04), steelDark: a(0x50565c, 0.04), rail: a(0x8a8580, 0.05), ballast: a(0x6d675f, 0.12), sleeper: a(0x5a4636, 0.06),
    lineYellow: a(0xe8c547, 0.03), roadRed: a(0x8a4c45, 0.05),
    pine: a(0x2f5b3c, 0.12, F), pineB: a(0x3c6e46, 0.12, F), maple: a(0xd65a3a, 0.12, F), mapleB: a(0xe9853f, 0.12, F), keyaki: a(0x5d9a48, 0.14, F), keyakiB: a(0x7bb55a, 0.12, F),
    moss: a(0x5f7f3a, 0.14), torii: a(0xe0452e, 0.04), toriiBlack: a(0x2b2624, 0.03), foxWhite: a(0xf1ede6, 0.03),
    brick: a(0x9a5a44, 0.08), brickDark: a(0x7a4434, 0.08), water: a(0x3f6f7a, 0.05),
    // the wear on a city wall: grime under the sills, the form-tie holes of bare concrete, a rust run, a window's hood
    grime: a(0x8f8a80, 0.05), tieHole: a(0x8c8881, 0.03), rust: a(0x8a5a3a, 0.06), hood: a(0x9ea3a6, 0.04), amado: a(0xc9c1b0, 0.04),
  };
}

export type WC = ReturnType<typeof worldColors>;

/** Builder voxel columns a worker keeps: [x0, z0, x1, z1), exclusive end. */
export type Window = [number, number, number, number];

export class Builder {
  grid: SparseGrid;
  pal = new Palette();
  c: WC;
  k: PropKit;
  props: PlacedProp[] = [];
  lamps: Lamp[] = [];
  blockers: [number, number, number, number][] = [];
  emitters: Emitter[] = [];
  r = rng(20261030);
  ic: IC;
  rooms: RoomAnchor[] = [];
  hotels: HotelAnchor[] = [];
  roomCount: Partial<Record<RoomKind, number>> = {};
  darumaSpots: DarumaSpot[] = [];
  secret: SecretAnchor | null = null;
  indoor: [number, number, number, number, number, number][] = [];
  stallAnchors: StallAnchor[] = [];
  occluders: Occluder[] = [];
  benches: [number, number, number, number?][] = [];
  wires: Anchors['wires'] = [];
  shafts: [number, number, number, number, number, number][] = [];
  /** True when there is open air at a point (metres). */
  clear(x: number, y: number, z: number): boolean {
    return this.grid.get(Math.floor(x / V), Math.floor(y / V) + G, Math.floor(z / V)) === 0;
  }
  /** Footprints of props standing on the ground, so later ones can keep clear of them. */
  standing: [number, number, number, number][] = [];
  stools: [number, number, number, number?][] = [];
  /** Great halls one walks into (world/sacred.ts). */
  halls: HallAnchor[] = [];
  sway: SwayBody[] = [];
  swayCells = new Map<number, number>();
  /** When set, props placed next hang from this sway body (lanterns on a swinging wire). */
  swayParent = 0;
  /** Global ids of the bodies of the last placed prop. */
  lastSway: number[] = [];

  constructor(win?: Window) {
    const w = win ?? [VX0, VZ0, VX0 + SX, VZ0 + SZ];
    this.grid = new SparseGrid(VX0, VZ0, SX, SY, SZ, w[0], w[1], w[2], w[3]);
    this.c = worldColors(this.pal);
    this.k = { pal: this.pal, c: makePropColors(this.pal) };
    this.ic = interiorColors(this.pal);
  }

  /** Place a prop by its footprint centre (metres) and base height, rotated by quarter turns. */
  place(prop: Prop, cx: number, y: number, cz: number, turns = 0, tag?: string): Prop {
    const p = rotateProp(prop, turns);
    const sx = p.sx * p.scale, sz = p.sz * p.scale;
    const pl = this.placed(p, [cx - sx / 2, y, cz - sz / 2], tag);
    this.props.push(pl);
    if (prop.wireSag !== undefined) {
      // along x, or along z after an odd number of turns; the top of the end voxels is the perch height
      const half = (turns & 1 ? sz : sx) / 2 - p.scale, top = pl.origin[1] + p.sy * p.scale;
      this.wires.push(turns & 1 ? [cx, cz - half, cx, cz + half, top, prop.wireSag] : [cx - half, cz, cx + half, cz, top, prop.wireSag]);
    }
    if (!tag && y < 0.3) this.standing.push([cx - sx / 2, cz - sz / 2, cx + sx / 2, cz + sz / 2]);
    return p;
  }

  /** A prop at its (voxel-snapped) origin, with its sway bodies registered in world metres. */
  placed(p: Prop, o: [number, number, number], tag?: string): PlacedProp {
    const sc = p.scale;
    const origin: [number, number, number] = [Math.round(o[0] / sc) * sc, Math.round(o[1] / sc) * sc, Math.round(o[2] / sc) * sc];
    if (!p.bodies.length) { this.lastSway = []; return { prop: p, origin, tag }; }
    this.lastSway = p.bodies.map((bd) => {
      const pivot: [number, number, number] = [origin[0] + bd.pivot[0] * sc, origin[1] + bd.pivot[1] * sc, origin[2] + bd.pivot[2] * sc];
      return this.addSway({ ...bd, pivot, parent: this.swayParent });
    });
    return { prop: p, origin, tag, sway: Uint16Array.from(this.lastSway) };
  }

  /** Register a sway body (pivot in metres); returns its 1-based id. */
  addSway(bd: SwayBody): number {
    this.sway.push({ ...bd, phase: bd.phase ?? hash3(Math.round(bd.pivot[0] * 8), Math.round(bd.pivot[1] * 8), Math.round(bd.pivot[2] * 8)) * Math.PI * 2 });
    return this.sway.length;
  }

  /** Street-grid voxel (x, y, z) belongs to sway body `id`. */
  swayCell(x: number, y: number, z: number, id: number): void {
    const g = this.grid;
    if (g.inside(x, y, z)) this.swayCells.set(swayKey(g, x, y, z), id);
  }

  /** Lamp at a world position in metres. */
  lamp(x: number, y: number, z: number, col: [number, number, number], radiusM: number, intensity = 1): void {
    this.lamps.push({ x: x / V, y: y / V + G, z: z / V, r: col[0] * intensity, g: col[1] * intensity, b: col[2] * intensity, radius: radiusM / V });
  }

  block(x0: number, z0: number, x1: number, z1: number) {
    this.blockers.push([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  }

  /** Register a cutaway occluder from an inclusive voxel rect. */
  occlude(x0: number, z0: number, x1: number, z1: number, top: number, low: number, kind: Occluder['kind'], group?: number): void {
    this.occluders.push({ rect: [Math.min(x0, x1) * V, Math.min(z0, z1) * V, (Math.max(x0, x1) + 1) * V, (Math.max(z0, z1) + 1) * V], top, low, kind, group });
  }
}

export const RED: [number, number, number] = [1.0, 0.42, 0.22];
export const WARM: [number, number, number] = [1.0, 0.72, 0.42];
export const WHITEWARM: [number, number, number] = [1.0, 0.86, 0.66];
export const COOL: [number, number, number] = [0.62, 0.84, 1.0];

/** Facade-relative coordinate frame on a building lot. */
export class Lot {
  readonly width: number;
  readonly depth: number;
  constructor(public b: Builder, public x0: number, public z0: number, public x1: number, public z1: number, public side: Side) {
    const ns = side === 's' || side === 'n';
    this.width = ns ? x1 - x0 + 1 : z1 - z0 + 1;
    this.depth = ns ? z1 - z0 + 1 : x1 - x0 + 1;
  }
  xz(a: number, d: number): [number, number] {
    switch (this.side) {
      case 's': return [this.x0 + a, this.z1 - d];
      case 'n': return [this.x1 - a, this.z0 + d];
      case 'e': return [this.x1 - d, this.z1 - a];
      case 'w': return [this.x0 + d, this.z0 + a];
    }
  }
  /** Continuous facade coords -> world metres. */
  m(a: number, d: number): [number, number] {
    let x: number, z: number;
    switch (this.side) {
      case 's': x = this.x0 + a; z = this.z1 + 1 - d; break;
      case 'n': x = this.x1 + 1 - a; z = this.z0 + d; break;
      case 'e': x = this.x1 + 1 - d; z = this.z1 + 1 - a; break;
      case 'w': x = this.x0 + d; z = this.z0 + a; break;
    }
    return [x * V, z * V];
  }
  set(a: number, y: number, d: number, c: number) {
    const [x, z] = this.xz(a, d);
    this.b.grid.set(x, G + y, z, c);
  }
  get(a: number, y: number, d: number) {
    const [x, z] = this.xz(a, d);
    return this.b.grid.get(x, G + y, z);
  }
  box(a0: number, y0: number, d0: number, a1: number, y1: number, d1: number, c: number | ((a: number, y: number, d: number) => number)) {
    const [xa, za] = this.xz(a0, d0), [xb, zb] = this.xz(a1, d1);
    if (!this.b.grid.touches(xa, za, xb, zb)) return;
    for (let a = Math.min(a0, a1); a <= Math.max(a0, a1); a++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let d = Math.min(d0, d1); d <= Math.max(d0, d1); d++) this.set(a, y, d, typeof c === 'function' ? c(a, y, d) : c);
  }
  get turns() { return TURNS[this.side]; }
  /** Place a prop flush on the facade: centred at facade coordinate a (voxels), base height y (metres), protruding outward. */
  wallProp(p: Prop, a: number, y: number, out = 0, turnsExtra = 0): void {
    const rp = rotateProp(p, turnsExtra);
    const depthM = rp.sz * rp.scale;
    const [cx, cz] = this.m(a, -(depthM / 2 + out) / V);
    this.b.place(rp, cx, y, cz, this.turns);
  }
  /** Cells (a, y0..y1, d) hanging from a line at layer `top` swing on it as one piece, like a shirt on a laundry line. */
  hang(a: number, y0: number, y1: number, d: number, top: number): void {
    const [px, pz] = this.m(a + 0.5, d + 0.5);
    const [ax0, az0] = this.m(0, 0), [ax1, az1] = this.m(1, 0);
    const len = Math.hypot(ax1 - ax0, az1 - az0);
    const id = this.b.addSway({ ...SWAY.laundry, pivot: [px, (top + 0.5) * V, pz], axis: [(ax1 - ax0) / len, 0, (az1 - az0) / len], reach: 0 });
    const [x, z] = this.xz(a, d);
    for (let y = y0; y <= y1; y++) this.b.swayCell(x, G + y, z, id);
  }
  /** World metres of a point in front of the facade. */
  front(a: number, outM: number): [number, number] {
    return this.m(a, -outM / V);
  }
}

// ---------------------------------------------------------------------------------------------

export type Ground = 'stall' | 'shop' | 'shutter' | 'cafe' | 'izakaya' | 'konbini' | 'plain' | 'florist' | 'books' | 'fish' | 'bakery' | 'pharmacy' | 'kissa' | 'soba' | 'hotel';
const ROOM_GROUNDS: Ground[] = ['shop', 'cafe', 'izakaya', 'konbini', 'florist', 'books', 'fish', 'bakery', 'pharmacy', 'kissa', 'soba', 'hotel'];
export type Style = 'modern' | 'showa' | 'machiya' | 'izakaya' | 'apartment' | 'kura';

export interface BuildingOpts {
  floors: number;
  style: Style;
  ground: Ground;
  seed: number;
  wall?: number;
  awning?: [number, number];
  roof?: 'flat' | 'tiled';
  signs?: boolean;
  lanterns?: number; // lantern colour
  restaurant?: RestaurantSpec;
  secret?: boolean;
  /** Facade coordinate of the door's first column, when the middle of the facade is not reachable. */
  doorA?: number;
  hotel?: HotelInfo;
  /** For a hotel, the ground floor the building had before (its shop's hiding spot keeps the daruma where they were). */
  was?: Ground;
}

/** A building the hotel list names (by its lot) becomes that hotel: its look, its height and a lobby downstairs. */
export function hotelize(lot: Lot, o: BuildingOpts): BuildingOpts {
  const hi = hotelAt(lot.x0, lot.z0);
  return hi && !o.hotel ? { ...o, was: o.ground, ground: 'hotel', style: hi.style, floors: hi.floors, hotel: hi, awning: undefined, restaurant: undefined, secret: undefined, doorA: undefined, roof: 'flat' } : o;
}

export function building(lot: Lot, o: BuildingOpts): { H: number } {
  o = hotelize(lot, o);
  const b = lot.b, c = b.c, k = b.k;
  const r = rng(o.seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const w = lot.width, dep = lot.depth;
  const GH = 14, FH = 12;
  const H = GH + (o.floors - 1) * FH;
  const wood = o.style === 'machiya' || o.style === 'izakaya';
  const wall = o.wall ?? (wood ? pick([c.woodDark, c.cedar, c.woodMid]) : o.style === 'kura' ? c.plasterWhite : o.style === 'apartment' ? pick([c.tileWhite, c.tileBrown, c.beige, c.concreteWall, c.sky]) : pick([c.cream, c.beige, c.mint, c.sky, c.blush, c.tileWhite, c.concreteWall, c.sand2, c.terracotta, c.mustard, c.olive]));
  const trim = wood ? c.woodDark : o.style === 'kura' ? c.kuraBase : pick([c.trim, c.trimDark, c.tileBrown]);

  lot.box(0, 0, 0, w - 1, H - 1, dep - 1, wall);
  b.occlude(lot.x0, lot.z0, lot.x1, lot.z1, H * V + 3, 0.95, 'building');
  if (o.style === 'kura') {
    // namako-kabe: diagonal grid of tiles and raised plaster along the base, black skirt above
    lot.box(0, 0, 0, w - 1, 5, dep - 1, (a, y, d) => ((a + y + d) % 4 === 0 || (a - y - d + 400) % 4 === 0 ? c.plasterWhite : c.namako));
    lot.box(0, 6, 0, w - 1, 6, dep - 1, c.kuraBase);
  }
  // the backs are finished by wrapLot below; keep these draws so the rest of each building stays as it was
  for (let f = 1; f < o.floors; f++)
    for (let a = 2; a + 2 < w; a += 6) {
      if (r() < 0.25) continue;
      r(); r();
    }
  // drainpipe and gas/electric meters on the facade edge
  if (!wood && o.style !== 'kura') {
    const pa = r() < 0.5 ? 0 : w - 1;
    lot.box(pa, 0, -1, pa, H, -1, c.pipe);
    if (o.ground !== 'stall') lot.wallProp(meters(k), pa === 0 ? 1.4 : w - 1.4, 1.1, 0);
  }
  // tile pattern for tiled facades
  if (wall === c.tileWhite || wall === c.tileBrown) {
    lot.box(0, GH, 0, w - 1, H - 1, 0, (a, y) => ((a + y * 3) % 7 === 0 ? c.concreteWall : wall));
  }

  // cornice bands
  for (let f = 0; f < o.floors - 1; f++) {
    const yb = GH + f * FH - 1;
    lot.box(0, yb, -1, w - 1, yb, -1, trim);
  }
  if (o.style !== 'machiya') lot.box(0, H - 1, -1, w - 1, H - 1, -1, trim);

  // upper floors
  for (let f = 1; f < o.floors; f++) {
    const base = GH + (f - 1) * FH;
    if (o.style === 'kura') {
      // small barred windows with heavy plaster shutters
      for (let a = 3; a + 3 < w; a += 7) {
        lot.box(a, base + 4, 0, a + 2, base + 7, 0, (aa) => ((aa - a) % 2 ? c.kuraBase : 0));
        lot.box(a, base + 4, 1, a + 2, base + 7, 1, r() < 0.4 ? c.glassLit : c.kuraBase);
        lot.box(a - 2, base + 4, -1, a - 1, base + 7, -1, c.plasterWhite);
        lot.box(a - 1, base + 8, -1, a + 3, base + 8, -1, c.kuraBase);
      }
      continue;
    }
    const ww = o.style === 'modern' ? 5 : o.style === 'machiya' ? 6 : o.style === 'apartment' ? 6 : 3;
    const gap = o.style === 'modern' || o.style === 'apartment' ? 2 : 3;
    const n = Math.max(1, Math.floor((w - 2 + gap) / (ww + gap)));
    const used = n * ww + (n - 1) * gap;
    const start = Math.floor((w - used) / 2);
    const balcony = o.style === 'apartment' || (o.style !== 'machiya' && r() < 0.35);
    for (let i = 0; i < n; i++) {
      const a0 = start + i * (ww + gap), a1 = a0 + ww - 1;
      const lit = r() < 0.55;
      if (o.style === 'machiya') {
        // mushiko-mado: plaster window with vertical slats
        lot.box(a0, base + 3, 0, a1, base + 7, 0, (a) => (a % 2 === 0 ? c.woodDark : 0));
        lot.box(a0, base + 3, 1, a1, base + 7, 1, lit ? c.glassLit : c.plaster);
      } else {
        const tall = o.style === 'apartment' ? 1 : 3; // apartments get full-height sliding doors
        lot.box(a0, base + tall, 0, a1, base + 8, 0, 0);
        lot.box(a0, base + tall, 1, a1, base + 8, 1, lit ? c.glassLit : (r() < 0.5 ? c.glass : c.glassDark));
        if (!balcony && o.style !== 'apartment' && r() < 0.22) {
          // flower box under the window
          lot.box(a0, base + 2, -1, a1, base + 2, -1, c.woodMid);
          for (let a = a0; a <= a1; a++) lot.set(a, base + 3, -1, hash3(a, base, o.seed) < 0.35 ? c.petalDeep : c.leaf);
        }
        if (ww >= 5) lot.box(Math.floor((a0 + a1) / 2), base + 3, 1, Math.floor((a0 + a1) / 2), base + 8, 1, c.trim);
        if (!balcony) lot.box(a0, base + 2, -1, a1, base + 2, -1, c.trim);
        if (o.style === 'showa' && !balcony) {
          for (let a = a0; a <= a1; a++) if ((a - a0) % 2 === 0) lot.set(a, base + 3, -1, c.trimDark);
          lot.box(a0, base + 4, -1, a1, base + 4, -1, c.trimDark);
        }
        if (!balcony && r() < 0.3) lot.wallProp(acUnit(k), a0 + ww / 2, (base - 0.5) * V + 0.1 + 0.25, 0);
        // a thin hood over the glass against the rain, and on the old houses the box the night shutters slide into
        if (!balcony && o.style !== 'apartment') {
          const hv = hash3(a0, base, o.seed + 71);
          // (clear of the front corners, where the vertical signs hang)
          if (hv < 0.55) lot.box(Math.max(2, a0 - 1), base + 9, -1, Math.min(w - 3, a1 + 1), base + 9, -1, (a, y, d) => lot.get(a, y, d) || (o.style === 'showa' ? c.hood : c.concrete));
          if (o.style === 'showa' && hv > 0.45 && a1 + 2 < w - 2) lot.box(a1 + 1, base + 3, -1, a1 + 2, base + 8, -1, (a, y, d) => lot.get(a, y, d) || (y === base + 8 ? c.hood : c.amado));
        }
      }
    }
    if (balcony) {
      lot.box(1, base, -1, w - 2, base, -3, c.concrete);
      for (let a = 1; a <= w - 2; a++) {
        if (a % 2 === 1) lot.box(a, base + 1, -3, a, base + 3, -3, c.trimDark);
        lot.set(a, base + 4, -3, c.trimDark);
      }
      lot.box(1, base + 1, -1, 1, base + 4, -3, c.trimDark);
      lot.box(w - 2, base + 1, -1, w - 2, base + 4, -3, c.trimDark);
      // laundry
      if (r() < 0.7) {
        const cols = [c.laundryA, c.laundryB, c.laundryC, c.laundryD];
        lot.box(2, base + 9, -2, w - 3, base + 9, -2, c.pole);
        for (let a = 3; a < w - 3; a += 2) if (r() < 0.6) { lot.box(a, base + 6, -2, a, base + 8, -2, pick(cols)); lot.hang(a, base + 6, base + 8, -2, base + 9); }
      } else if (r() < 0.5) {
        lot.wallProp(plantPot(k, 'flowers', o.seed + f), 3, (base + 1) * V, 0.15);
      }
      if (o.style === 'apartment') {
        // partitions between flats and an outdoor AC unit on the balcony
        for (let a = 7; a < w - 3; a += 8) lot.box(a, base + 1, -1, a, base + 5, -2, c.concrete);
        if (r() < 0.6) lot.wallProp(acUnit(k), w - 4, (base + 1) * V, 0.05);
      }
    }
  }

  // ground floor
  const awn = o.awning ?? (o.ground === 'florist' ? [c.awnGreen, c.awnGreen] as [number, number] : o.ground === 'fish' ? [c.awnBlue, c.awnWhite] as [number, number] : o.ground === 'bakery' ? [c.awnBrown, c.awnYellow] as [number, number] :
    pick<[number, number]>([[c.awnRed, c.awnWhite], [c.awnGreen, c.awnWhite], [c.awnBlue, c.awnWhite], [c.awnOrange, c.awnWhite], [c.awnNavy, c.awnNavy], [c.awnYellow, c.awnWhite], [c.awnPink, c.awnWhite], [c.awnBrown, c.awnBrown]]));
  const awning = (a0: number, a1: number, y: number, len = 4) => {
    for (let dd = 1; dd <= len; dd++) {
      const yy = y - Math.floor((dd - 1) / 2);
      for (let a = a0; a <= a1; a++) lot.set(a, yy, -dd, ((a >> 1) & 1) ? awn[0] : awn[1]);
    }
    for (let a = a0; a <= a1; a++) lot.set(a, y - Math.floor((len - 1) / 2) - 1, -len, ((a >> 1) & 1) ? awn[0] : awn[1]);
  };

  // deep enough lots get a walkable room behind the storefront; shallow ones keep a display recess
  if (ROOM_GROUNDS.includes(o.ground) && dep >= 14 && w >= 10) {
    shopFloor(lot, { kind: o.ground as RoomKind, seed: o.seed, trim, awn, awning, lanterns: o.lanterns, restaurant: o.restaurant, secret: o.secret, doorA: o.doorA, hotel: o.hotel, spotKind: o.was && o.was !== 'hotel' && ROOM_GROUNDS.includes(o.was) ? o.was as RoomKind : undefined });
  } else switch (o.ground === 'kissa' ? 'cafe' : o.ground === 'soba' ? 'izakaya' : o.ground) {
    case 'shop': {
      lot.box(1, 0, 0, w - 2, 10, 2, 0);
      lot.box(1, 0, 3, w - 2, 10, 3, c.shopGlow);
      lot.box(1, 11, 0, w - 2, 11, 0, trim);
      // goods tables
      const goods = [c.goodsA, c.goodsB, c.goodsC, c.goodsD, c.goodsE, c.goodsF];
      lot.box(2, 0, -1, w - 3, 2, -2, c.woodMid);
      lot.box(2, 3, -1, w - 3, 3, -2, (a, _y, d) => goods[Math.floor(hash3(a, d, o.seed) * goods.length)]);
      for (let a = 2; a < w - 2; a++) if (hash3(a, 9, o.seed) < 0.5) lot.set(a, 4, -1, goods[Math.floor(hash3(a, 3, o.seed) * goods.length)]);
      lot.box(2, 0, 2, w - 3, 5, 2, (a, y) => ((a + y) % 3 === 0 ? goods[(a * 7 + y) % goods.length] : 0));
      awning(0, w - 1, 12, 4);
      const [lx, lz] = lot.front(w / 2, 0.8);
      b.lamp(lx, 2.2, lz, WARM, 4.5, 0.7);
      break;
    }
    case 'shutter': {
      lot.box(1, 0, 0, w - 2, 10, 0, 0);
      lot.box(1, 0, 1, w - 2, 10, 1, (_a, y) => (y % 2 ? c.shutterA : c.shutterB));
      lot.box(1, 11, -1, w - 2, 12, 0, c.shutterA);
      if (dep >= 14 && w >= 10) closedRoom(lot, 'storage', o.seed, trim);
      break;
    }
    case 'cafe': {
      lot.box(1, 0, 0, w - 2, 10, 0, 0);
      lot.box(1, 0, 1, w - 2, 10, 1, (a, y) => ((a - 1) % 4 === 0 || y === 0 || y === 10 ? c.wood : c.glassLit));
      lot.box(2, 1, 2, w - 3, 10, 2, c.shopGlow);
      awning(0, w - 1, 12, 3);
      lot.wallProp(plantPot(k, 'shrub', o.seed), 2, 0, 0.2);
      lot.wallProp(plantPot(k, 'bamboo', o.seed + 1), w - 3, 0, 0.2);
      if (r() < 0.6) {
        lot.wallProp(aFrame(k, o.seed + 2), w / 2 - 2, 0, 0.12);
        const [ax, az] = lot.front(w / 2 - 2, 0.3);
        b.block(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3);
      }
      const [lx, lz] = lot.front(w / 2, 0.8);
      b.lamp(lx, 2, lz, WARM, 5, 0.8);
      break;
    }
    case 'izakaya': {
      lot.box(0, 0, 0, w - 1, GH - 1, 0, c.woodDark);
      lot.box(1, 1, 0, w - 2, 9, 0, c.glassLit);
      for (let a = 1; a <= w - 2; a++) if (a % 2 === 0) lot.box(a, 1, -1, a, 9, -1, c.woodMid);
      // door
      const da = Math.max(2, Math.floor(w / 2) - 1);
      lot.box(da, 0, -1, da + 2, 9, 0, 0);
      lot.box(da, 0, 1, da + 2, 9, 1, c.shoji);
      lot.box(0, 10, -1, w - 1, 10, -2, c.cedar);
      lot.box(0, 11, -1, w - 1, 11, -1, c.roofTile);
      lot.wallProp(noren(k, 8, pick([k.c.navy, k.c.norenRed, k.c.norenBrown, k.c.indigo]), k.c.norenWhite, 6, 2), da + 1.5, 1.45, 0.02);
      const lc = o.lanterns ?? k.c.lanternRed;
      lot.wallProp(lantern(k, lc, 6, 8, o.seed), da - 1.5, 1.3, 0.35);
      const [lx, lz] = lot.front(da - 1.5, 0.5);
      b.lamp(lx, 1.8, lz, lc === k.c.lanternWhite ? WHITEWARM : RED, 4, 1.0);
      if (r() < 0.6) lot.wallProp(crateStack(k, o.seed), w - 2, 0, 0.1);
      if (o.signs !== false) lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, 3, o.seed), w / 2, 2.85, 0.0);
      break;
    }
    case 'konbini': {
      lot.box(1, 0, 0, w - 2, 10, 0, 0);
      lot.box(1, 0, 1, w - 2, 10, 1, (a) => ((a - 1) % 6 === 0 ? c.trim : c.konbiniGlass));
      lot.box(0, 11, -1, w - 1, 11, -1, c.konbiniStripeA);
      lot.box(0, 12, -1, w - 1, 12, -1, c.signLit);
      lot.box(0, 13, -1, w - 1, 13, -1, c.konbiniStripeB);
      lot.box(0, 10, -1, w - 1, 10, -1, c.konbiniStripeC);
      const [lx, lz] = lot.front(w / 2, 1.2);
      b.lamp(lx, 2.4, lz, COOL, 7.5, 1.0);
      break;
    }
    case 'florist':
    case 'books':
    case 'fish':
    case 'bakery': {
      lot.box(1, 0, 0, w - 2, 10, 2, 0);
      lot.box(1, 0, 3, w - 2, 10, 3, o.ground === 'fish' ? c.tileWhite : c.shopGlow);
      lot.box(1, 11, 0, w - 2, 11, 0, trim);
      const kind = o.ground;
      if (kind === 'florist') {
        lot.box(1, 0, 2, w - 2, 7, 2, (a, y) => ((a * 3 + y * 5) % 4 === 0 ? (hash3(a, y, o.seed) < 0.5 ? c.petalDeep : c.mustard) : (a + y) % 3 ? c.leaf : 0));
        awning(0, w - 1, 12, 4);
        lot.wallProp(flowerStand(k, o.seed), w / 2, 0, -0.62);
        lot.wallProp(plantPot(k, 'shrub', o.seed + 3), 1.6, 0, 0.12);
      } else if (kind === 'books') {
        lot.box(1, 0, 2, w - 2, 9, 2, (a, y) => (y % 3 === 0 ? c.woodMid : [c.lacquerDark, c.awnNavy, c.hinoki, c.awnGreen, c.trim][(a * 7 + y) % 5]));
        lot.wallProp(bookCart(k, o.seed), w / 2 - 2, 0, -0.6);
        lot.wallProp(bookCart(k, o.seed + 9), w / 2 + 2.2, 0, -0.6);
        awning(0, w - 1, 12, 3);
      } else if (kind === 'fish') {
        lot.wallProp(fishDisplay(k, o.seed), w / 2 - 2, 0, -0.62);
        lot.wallProp(fishDisplay(k, o.seed + 5), w / 2 + 2.2, 0, -0.62);
        lot.box(1, 8, 2, w - 2, 9, 2, (a) => (a % 3 ? c.awnBlue : c.trim));
        awning(0, w - 1, 12, 4);
      } else {
        lot.wallProp(breadShelf(k, o.seed), w / 2, 0, -0.72);
        lot.wallProp(aFrame(k, o.seed), w - 2.5, 0, 0.12);
        const [ax, az] = lot.front(w - 2.5, 0.3);
        b.block(ax - 0.3, az - 0.3, ax + 0.3, az + 0.3);
        awning(0, w - 1, 12, 3);
      }
      const [lx, lz] = lot.front(w / 2, 0.8);
      b.lamp(lx, 2.2, lz, kind === 'fish' ? COOL : WARM, 4.5, 0.7);
      break;
    }
    case 'pharmacy': {
      lot.box(1, 0, 0, w - 2, 10, 0, 0);
      lot.box(1, 0, 1, w - 2, 10, 1, (a) => ((a - 1) % 5 === 0 ? c.trim : c.konbiniGlass));
      lot.box(0, 11, -1, w - 1, 13, -1, c.trim);
      // green cross sign
      const ca = 3;
      lot.box(ca - 1, 12, -2, ca + 1, 12, -2, k.c.greenCross);
      lot.box(ca, 11, -2, ca, 13, -2, k.c.greenCross);
      lot.box(ca + 3, 12, -2, w - 3, 12, -2, (a) => (a % 2 ? k.c.signGreen : c.signLit));
      const [lx, lz] = lot.front(w / 2, 1.0);
      b.lamp(lx, 2.4, lz, [0.75, 1.0, 0.85], 5.5, 0.8);
      break;
    }
    case 'plain': {
      // a proper house front: a framed door under a little hood, a nameplate and post box, windows either side
      const m = Math.floor(w / 2);
      const kura = o.style === 'kura', glassy = o.style === 'modern' || o.style === 'apartment';
      const frame = wood ? c.woodDark : kura ? c.kuraBase : trim;
      lot.box(m - 1, 0, 0, m + 1, 8, 0, 0);
      lot.box(m - 1, 0, 1, m + 1, 8, 1, (a, y) => wood ? (y === 8 || (a - m) % 2 === 0 ? c.woodDark : c.shoji)
        : kura ? (a === m && y % 3 === 1 ? c.steelDark : c.woodDark)
        : glassy ? (y === 8 || a === m + 1 ? c.steel : c.glassLit)
        : y === 8 || y === 4 ? c.steel : c.shoji);
      lot.box(m - 2, 0, 0, m - 2, 9, 0, frame);
      lot.box(m + 2, 0, 0, m + 2, 9, 0, frame);
      lot.box(m - 2, 9, 0, m + 2, 9, 0, frame);
      lot.box(m - 2, 10, -1, m + 2, 10, -2, wood || kura ? c.roofTile : c.concrete);
      lot.set(m - 3, 6, 0, c.woodMid);
      lot.box(m - 3, 4, 0, m - 3, 5, 0, wood ? c.woodMid : c.steelDark);
      lot.set(m + 3, 8, 0, c.signLit);
      if (w >= 12) for (const a0 of [2, w - 5]) {
        if (a0 + 2 >= m - 3 && a0 <= m + 3) continue;
        const lit = hash3(a0, 7, o.seed) < 0.5;
        lot.box(a0, 3, 0, a0 + 2, 7, 0, 0);
        lot.box(a0, 3, 1, a0 + 2, 7, 1, (a, y) => wood ? (a % 2 ? c.woodDark : c.shoji)
          : kura ? (a % 2 ? c.kuraBase : c.glassDark)
          : a % 2 === 0 && !glassy ? c.trimDark : lit ? c.glassLit : y === 7 ? c.glassDark : c.glass);
        lot.box(a0, 2, 0, a0 + 2, 2, 0, frame);
        lot.box(a0, 8, 0, a0 + 2, 8, 0, frame);
      }
      if (dep >= 14 && w >= 10) closedRoom(lot, 'home', o.seed, trim);
      break;
    }
    default:
      break; // stalls are handled by stall()
  }

  // roofs
  const roof = o.roof ?? (o.style === 'machiya' || o.style === 'kura' ? 'tiled' : 'flat');
  if (roof === 'tiled') tiledRoof(lot, H, 2, 2);
  else flatRoof(lot, H, r, o.signs !== false && o.floors >= 3);

  // a darker plinth course where the walls meet the pavement (stone under timber), front and both sides
  const plinth = wood ? c.stone : o.style === 'kura' ? c.kuraBase : c.concreteDark;
  const base = (aa: number, yy: number, dd: number) => (lot.get(aa, yy, dd) === wall ? plinth : lot.get(aa, yy, dd));
  lot.box(0, 0, 0, w - 1, 0, 0, base);
  lot.box(0, 0, 1, 0, 0, dep - 1, base);
  lot.box(w - 1, 0, 1, w - 1, 0, dep - 1, base);

  // the same finish round the sides and back as on the front
  wrapLot(lot, { h: H, gh: GH, fh: FH, wall, trim, look: wood ? 'wood' : o.style === 'kura' ? 'kura' : 'plain', seed: o.seed * 5 + 3, pipe: !wood && o.style !== 'kura' });
  if (!wood && o.style !== 'kura') for (const which of ['f', 'l', 'r', 'b'] as const) skin(b, lotFace(lot, which), H, wall, o.seed * 11 + which.charCodeAt(0));
  if (o.hotel) {
    const lobby = b.rooms[b.rooms.length - 1];
    if (lobby?.hotel !== o.hotel.id) throw new Error(`hotel ${o.hotel.id}: the lot is too small for a lobby`);
    hotelFloors(lot, o.hotel, lobby, o.style);
  }

  // vertical sign
  if (o.signs !== false && o.floors >= 2 && r() < 0.75) {
    const bg = pick([k.c.signRed, k.c.signBlue, k.c.signYellow, k.c.signCream, k.c.signBlack, k.c.signGreen]);
    const neon = r() < 0.55;
    const fg = neon ? pick([k.c.neonPink, k.c.neonCyan, k.c.neonYellow, k.c.neonWhite, k.c.neonRed]) : (bg === k.c.signCream || bg === k.c.signYellow ? k.c.signBlack : k.c.white);
    const chars = Math.min(4, o.floors);
    const sign = verticalSign(k, bg, fg, chars, o.seed * 3 + 1, r() < 0.4);
    const a = r() < 0.5 ? 0.6 : w - 0.6;
    lot.wallProp(sign, a, GH * V + 0.3, 0, 1);
    if (neon) {
      const [sx, sz] = lot.front(a, 0.5);
      const col: [number, number, number] = fg === k.c.neonCyan ? [0.3, 0.8, 1] : fg === k.c.neonPink ? [1, 0.35, 0.7] : fg === k.c.neonYellow ? [1, 0.85, 0.3] : fg === k.c.neonRed ? [1, 0.3, 0.2] : [1, 0.95, 0.85];
      b.lamp(sx, GH * V + 1.6, sz, col, 4.5, 0.8);
    }
  }
  return { H };
}

export function flatRoof(lot: Lot, H: number, r: () => number, billboardOk = false) {
  const b = lot.b, c = b.c, k = b.k;
  const w = lot.width, dep = lot.depth;
  lot.box(0, H, 0, w - 1, H, dep - 1, (a, _y, d) => (a === 0 || d === 0 || a === w - 1 || d === dep - 1 ? c.parapet : 0));
  lot.box(1, H - 1, 1, w - 2, H - 1, dep - 2, c.roofFlat);
  // rooftop clutter
  if (w >= 12 && dep >= 12 && r() < 0.6) {
    // water tank
    const a = 3 + Math.floor(r() * (w - 10)), d = 4 + Math.floor(r() * (dep - 12));
    lot.box(a, H, d, a, H + 2, d, c.tankLeg); lot.box(a + 3, H, d, a + 3, H + 2, d, c.tankLeg);
    lot.box(a, H, d + 3, a, H + 2, d + 3, c.tankLeg); lot.box(a + 3, H, d + 3, a + 3, H + 2, d + 3, c.tankLeg);
    lot.box(a, H + 3, d, a + 3, H + 6, d + 3, c.tank);
    lot.set(a, H + 3, d, 0); lot.set(a + 3, H + 3, d + 3, 0); lot.set(a, H + 6, d + 3, 0); lot.set(a + 3, H + 6, d, 0);
  }
  const nAC = Math.floor(r() * 3);
  for (let i = 0; i < nAC; i++) {
    const [x, z] = lot.m(2 + r() * (w - 5), 2 + r() * (dep - 5));
    b.place(acUnit(k), x, H * V, z, Math.floor(r() * 4));
  }
  // antennas, planters, laundry, the odd billboard facing the street
  if (r() < 0.4) {
    const [x, z] = lot.m(2 + r() * (w - 4), 2 + r() * (dep - 4));
    b.place(antenna(k), x, H * V, z, Math.floor(r() * 2));
  }
  if (r() < 0.35 && dep > 8) {
    for (let i = 0; i < 2; i++) {
      const [x, z] = lot.m(3 + i * 4 + r(), dep - 3);
      b.place(planterBox(k, Math.floor(r() * 1e6)), x, H * V, z, lot.turns);
    }
  }
  if (r() < 0.3 && w > 10) {
    const d = 3 + Math.floor(r() * (dep - 6));
    lot.box(2, H, d, 2, H + 6, d, c.pole); lot.box(w - 3, H, d, w - 3, H + 6, d, c.pole);
    lot.box(2, H + 6, d, w - 3, H + 6, d, c.pole);
    const cols = [c.laundryA, c.laundryB, c.laundryC, c.laundryD];
    for (let a = 3; a < w - 3; a += 2) if (r() < 0.7) { lot.box(a, H + 3, d, a, H + 5, d, cols[Math.floor(r() * 4)]); lot.hang(a, H + 3, H + 5, d, H + 6); }
  }
  if (billboardOk && w >= 14 && r() < 0.4) {
    const bg = [k.c.signRed, k.c.signBlue, k.c.signYellow, k.c.signBlack][Math.floor(r() * 4)];
    lot.wallProp(billboard(k, bg, bg === k.c.signYellow ? k.c.signBlack : k.c.white, Math.floor(r() * 1e6)), w / 2, H * V, -0.7);
  }
  if (r() < 0.3 && w > 8) {
    // stair hut
    const a = w - 6, d = dep - 7;
    lot.box(a, H, d, a + 4, H + 7, d + 5, c.concreteWall);
    lot.box(a - 1, H + 8, d - 1, a + 5, H + 8, d + 6, c.parapet);
    lot.box(a + 1, H, d - 1 + 0, a + 2, H + 5, d - 1 + 0, 0);
  }
}

export function tiledRoof(lot: Lot, H: number, eave = 2, run = 2) {
  const b = lot.b, c = b.c;
  const w = lot.width, dep = lot.depth;
  // gable roof with ridge parallel to the facade
  const half = (dep + eave * 2) / 2;
  const layers = Math.ceil(half / run);
  for (let l = 0; l <= layers; l++) {
    const d0 = -eave + l * run, d1 = dep - 1 + eave - l * run;
    if (d0 > d1) break;
    const col = l === layers || d1 - d0 < run * 2 ? c.roofRidge : l % 2 ? c.roofTile : c.roofTileB;
    lot.box(-1, H + l, d0, w, H + l, d1, (a, _y, d) => (d === d0 || d === d1 ? (a % 2 ? c.roofTileB : c.roofTile) : col));
    if (l > 0) lot.box(-1, H + l - 1, d0, w, H + l - 1, d1, (a, y, d) => lot.get(a, y, d) || col);
  }
  // fill gable ends with wall
  for (let l = 0; l <= layers; l++) {
    const d0 = l * run, d1 = dep - 1 - l * run;
    if (d0 > d1) break;
    lot.box(0, H + l, d0, w - 1, H + l, d1, (a, y, d) => lot.get(a, y, d) || c.plaster);
  }
}

// ---------------------------------------------------------------------------------------------

interface StallSpec {
  id: string;
  foods: [FoodId, FoodId];
  awning: [number, number];
  noren: number;
  lantern: number;
  equip: 'griddle' | 'grill' | 'pot' | 'mold';
}

function stall(lot: Lot, spec: StallSpec, floors: number, seed: number, wall: number): StallAnchor {
  const b = lot.b, c = b.c, k = b.k;
  const w = lot.width;
  building(lot, { floors, style: 'showa', ground: 'stall', seed, wall, awning: spec.awning, signs: true });
  // niche
  lot.box(2, 0, 0, w - 3, 11, 7, 0);
  lot.box(2, 0, 8, w - 3, 11, 8, c.woodMid);
  lot.box(2, 0, 0, 2, 11, 7, c.woodMid);
  lot.box(w - 3, 0, 0, w - 3, 11, 7, c.woodMid);
  lot.box(2, 12, 0, w - 3, 12, 7, c.hinoki);
  // shelves with goods on the back wall
  lot.box(3, 6, 7, w - 4, 6, 7, c.hinoki);
  lot.box(3, 9, 7, w - 4, 9, 7, c.hinoki);
  lot.box(3, 7, 7, w - 4, 7, 7, (a) => [c.goodsA, c.goodsB, c.goodsF, 0][a % 4]);
  lot.box(3, 10, 7, w - 4, 10, 7, (a) => [c.goodsD, 0, c.goodsE, c.goodsB][a % 4]);
  // counter
  lot.box(3, 0, 0, w - 4, 3, 1, c.wood);
  lot.box(3, 3, -1, w - 4, 3, 1, c.counterTop);
  lot.box(3, 0, 0, w - 4, 0, 0, c.woodDark);
  // awning
  for (let dd = 1; dd <= 5; dd++) {
    const yy = 13 - Math.floor((dd - 1) / 2);
    for (let a = 0; a < w; a++) lot.set(a, yy, -dd, ((a >> 1) & 1) ? spec.awning[0] : spec.awning[1]);
  }
  for (let a = 0; a < w; a++) if (a % 2 === 0) lot.set(a, 10, -5, ((a >> 1) & 1) ? spec.awning[0] : spec.awning[1]);

  const opening = (w - 6) * V;
  const nW = Math.round(opening * 8);
  lot.wallProp(noren(k, nW, spec.noren, k.c.norenWhite, 5, Math.max(2, Math.round(nW / 7))), w / 2, 3.0 - 8 * 0.125, -0.02);
  lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, Math.max(3, Math.floor((w - 4) / 6)), seed + 5, k.c.woodDark), w / 2, 3.65, 0.0);
  lot.wallProp(lantern(k, spec.lantern, 5, 7, seed + 1), 1.2, 1.9, 0.35);
  lot.wallProp(lantern(k, spec.lantern, 5, 7, seed + 2), w - 1.2, 1.9, 0.35);
  const [l1x, l1z] = lot.front(1.2, 0.6);
  const [l2x, l2z] = lot.front(w - 1.2, 0.6);
  const lc = spec.lantern === k.c.lanternWhite ? WHITEWARM : spec.lantern === k.c.lanternAmber ? WARM : RED;
  b.lamp(l1x, 2.1, l1z, lc, 4.2, 1.0);
  b.lamp(l2x, 2.1, l2z, lc, 4.2, 1.0);
  const [ix, iz] = lot.m(w / 2, 4);
  b.lamp(ix, 2.4, iz, WARM, 6, 1.2);

  // equipment on the back counter
  const [ex, ez] = lot.m(w / 2, 5.5);
  const eq = equipment(k, spec.equip);
  b.place(eq, ex, 0, ez, lot.turns);
  const emitKind = spec.equip === 'grill' ? 'smoke' : 'steam';
  b.emitters.push({ kind: emitKind, pos: [ex, 1.15, ez], rate: spec.equip === 'grill' ? 1.4 : 1 });
  // food displays on the counter top
  const [f1x, f1z] = lot.m(w / 2 - 2.2, 0.2);
  const [f2x, f2z] = lot.m(w / 2 + 2.2, 0.2);
  b.place(buildFood(spec.foods[0], b.pal), f1x, 1.0, f1z, (lot.turns + 2) % 4);
  b.place(buildFood(spec.foods[1], b.pal), f2x, 1.0, f2z, (lot.turns + 2) % 4);
  // nobori banners
  lot.wallProp(nobori(k, spec.noren === k.c.norenRed ? k.c.norenWhite : k.c.norenRed, spec.noren === k.c.norenRed ? k.c.norenRed : k.c.norenWhite, seed + 7), -1.5, 0, 0.6);
  // stools in front
  const [s1x, s1z] = lot.front(w / 2 - 3, 0.9);
  const [s2x, s2z] = lot.front(w / 2 + 3, 0.9);
  b.place(stool(k, k.c.lacquer), s1x, 0, s1z);
  b.place(stool(k, k.c.lacquer), s2x, 0, s2z);

  const [sx, sz] = lot.front(w / 2, 1.0);
  const [vx, vz] = lot.m(w / 2, 3.2);
  const ang = [0, Math.PI / 2, Math.PI, -Math.PI / 2][lot.turns];
  const [lx, lz] = lot.front(w / 2, 0.6);
  return { id: spec.id, stand: [sx, sz], vendor: [vx, vz, ang], label: [lx, 4.6, lz] };
}

function equipment(k: PropKit, kind: StallSpec['equip']): Prop {
  const { c } = k;
  const p = new Prop(16, 10, 6);
  p.box(0, 0, 0, 15, 6, 5, c.steelDark);
  p.box(0, 6, 0, 15, 6, 5, c.steel);
  if (kind === 'griddle') {
    p.box(1, 7, 1, 14, 7, 4, c.black);
    for (let x = 2; x < 14; x += 2) for (let z = 1; z < 5; z += 2) p.set(x, 7, z, c.gold);
  } else if (kind === 'grill') {
    p.box(1, 7, 1, 14, 7, 4, c.coal);
    for (let x = 1; x < 15; x += 2) p.box(x, 8, 1, x, 8, 4, c.steel);
    for (let x = 2; x < 14; x += 3) { p.box(x, 9, 0, x, 9, 5, c.woodLight); p.box(x, 9, 2, x, 9, 3, c.wood); }
  } else if (kind === 'pot') {
    p.cylY(4, 3, 2.6, 7, 9, c.steel);
    p.cylY(4, 3, 2, 9, 9, c.woodLight);
    p.cylY(11, 3, 2.6, 7, 8, c.steel);
    p.cylY(11, 3, 2, 8, 8, c.white);
  } else {
    p.box(1, 7, 1, 14, 7, 4, c.black);
    for (let x = 2; x < 14; x += 4) p.box(x, 8, 1, x + 2, 8, 4, c.brass);
  }
  return p;
}

// ---------------------------------------------------------------------------------------------
// Terrain

function terrain(b: Builder) {
  const g = b.grid, c = b.c;
  // bedrock + earth
  const XE = VX0 + SX - 1, ZE = VZ0 + SZ - 1;
  g.box(VX0, 0, VZ0, XE, G - 2, ZE, c.earth);
  // surface layer: the original district keeps its hand-laid paving, the rest of the city is painted by city.ts
  for (let z = 0; z < 224; z++)
    for (let x = 0; x < OSX; x++) if (g.inside(x, G - 1, z)) g.set(x, G - 1, z, surface(b, x, z));
  // canal, running the full width of the city
  g.box(VX0, 4, 172, XE, G - 1, 199, 0);
  for (let z = 172; z <= 199; z++)
    for (let x = VX0; x <= XE; x++) {
      const h = hash3(x, 3, z);
      g.set(x, 3, z, h < 0.5 ? c.pebble : h < 0.8 ? c.sand : c.canalStoneDark);
      if (h > 0.985) g.set(x, 4, z, c.canalStoneDark);
      if (h > 0.93 && h < 0.95) { const hh = 1 + Math.floor(hash3(x, 9, z) * 4); g.box(x, 4, z, x, 4 + hh, z, hh > 2 ? c.weed : c.weedLight); }
    }
  // canal walls
  for (const zw of [171, 200])
    for (let x = VX0; x <= XE; x++)
      for (let y = 4; y < G; y++) {
        const course = Math.floor((y - 4) / 2);
        const off = course % 2 ? 3 : 0;
        const mortar = (y - 4) % 2 === 1 && false ? true : (x + off) % 6 === 0;
        let col = mortar ? c.mortar : hash3(Math.floor((x + off) / 6), course, zw) < 0.5 ? c.canalStone : c.canalStoneDark;
        if (y <= 9) col = mortar ? c.mortar : y <= 8 ? c.algae : c.wetStone;
        g.set(x, y, zw, col);
      }
  // canal steps down to the water near the yatai
  for (let s = 0; s < 6; s++) g.box(124, G - 1 - s, 172 + s, 135, G - 1 - s, 172 + s, c.stoneStep);

  // Break up the straight canal edges: riprap boulders at the foot of both walls, reed beds and
  // lily pads along the quieter far bank. The water plane sits at layer ~9.8, so tops at 9+ poke out.
  const boatsX: [number, number][] = [[18, 42], [148, 174], [234, 256]];
  const bridgesX: [number, number][] = [[54, 73], [210, 229], [122, 137]];
  const free = (x: number, ranges: [number, number][]) => !ranges.some(([a, b2]) => x >= a && x <= b2);
  const boulder = (cx: number, cz: number, rad: number, top: number, seed: number) => {
    for (let z = Math.floor(cz - rad); z <= cz + rad; z++)
      for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
        if (x < VX0 || x > XE || z < 172 || z > 199) continue;
        const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) / rad;
        if (d > 1) continue;
        const h = Math.round(top - d * d * 2.5 + (hash3(x, seed, z) - 0.5));
        for (let y = 4; y <= h; y++) g.set(x, y, z, y >= 9 ? (hash3(x, y, z) < 0.3 ? c.algae : c.canalStone) : hash3(x, y, z) < 0.5 ? c.wetStone : c.canalStoneDark);
      }
  };
  const rr = rng(4242);
  for (let x = VX0 + 2; x < XE - 2; x += 3 + Math.floor(rr() * 6)) {
    if (free(x, bridgesX)) boulder(x + rr() * 2, 172.4 + rr() * 1.2, 1.2 + rr() * 1.3, 8 + Math.floor(rr() * 3), x);
    if (free(x, bridgesX) && free(x, boatsX)) boulder(x + rr() * 2, 198.6 - rr() * 1.2, 1.2 + rr() * 1.5, 8 + Math.floor(rr() * 3), x + 999);
  }
  // reed beds and lily pads in a few stretches of the far bank
  for (const [x0, x1] of [[2, 16], [76, 118], [178, 208], [258, 286]] as [number, number][]) {
    for (let x = x0; x <= x1; x++)
      for (let z = 193; z <= 199; z++) {
        const hsh = hash3(x, 77, z);
        const edge = 199 - z;
        if (edge <= 2 && hsh < 0.45) {
          const h = 9 + Math.floor(hash3(x, 78, z) * 4);
          for (let y = 4; y <= h; y++) g.set(x, y, z, y === h ? (hash3(x, y, z) < 0.5 ? c.sand2 : c.weedLight) : y > 9 ? c.weedLight : c.weed);
        } else if (edge >= 2 && edge <= 6 && hsh > 0.86 && g.get(x, 9, z) === 0) {
          g.set(x, 9, z, hash3(x, 79, z) < 0.12 ? c.petalDeep : c.grass);
          if (hash3(x + 1, 79, z) < 0.6 && x + 1 <= x1) g.set(x + 1, 9, z, c.grassDark);
        }
      }
  }
}

export function surface(b: Builder, x: number, z: number): number {
  const c = b.c;
  // street 1: running-bond pavers
  if (z >= 36 && z < 64 && x >= 24) {
    if (z === 36 || z === 63) return c.curb;
    // gutters with drain grates along both edges
    if (z === 37 || z === 62) return x % 10 < 2 ? c.grate : c.concreteDark;
    // decorated manhole covers
    for (const mx of [88, 196, 252]) {
      const dx = x - mx, dz = z - 49;
      if (dx * dx + dz * dz <= 6) return dx * dx + dz * dz >= 5 ? c.manhole : (x + z) % 3 === 0 ? c.manholeRed : c.manholeBlue;
    }
    const row = Math.floor((z - 37) / 3);
    const off = row % 2 ? 3 : 0;
    if ((z - 37) % 3 === 2 || (x + off) % 6 === 5) return c.grout;
    const h = hash3(Math.floor((x + off) / 6), row, 7);
    if (z >= 47 && z <= 52) return h < 0.5 ? c.paveC : c.paveA;
    return h < 0.33 ? c.paveA : h < 0.66 ? c.paveB : c.paveC;
  }
  // temple plaza: gravel with stone path
  if (x < 28 && z >= 18 && z < 82) {
    if (z >= 44 && z <= 55) {
      if ((x % 6 === 5) || (z - 44) % 6 === 5) return c.grout;
      return hash3(Math.floor(x / 6), Math.floor(z / 6), 2) < 0.5 ? c.granite : c.graniteDark;
    }
    return c.gravel;
  }
  // alley + passage: worn concrete with gutter
  if ((x >= 136 && x < 150 && z >= 64 && z < 152) || (z >= 118 && z < 126 && x >= 150 && x < 182)) {
    if (x === 137 && z >= 64 && z < 152) return z % 4 === 0 ? c.grate : c.concreteDark;
    const h = hash3(x >> 1, z >> 1, 5);
    if (h < 0.08) return c.stain;
    if (x >= 142 && x <= 145 && z >= 98 && z <= 101) return (x + z) % 2 ? c.manhole : c.grate;
    return h < 0.5 ? c.concrete : c.concreteDark;
  }
  // canal promenade
  if (z >= 152 && z < 172) {
    if (z >= 169) return c.curb;
    // tactile guide strip for the visually impaired, as on every Japanese pavement
    if (z === 159 || z === 160) return (x + z) % 2 === 0 ? c.tactileDot : c.tactile;
    // tree pits
    for (const tx of TREE_X) if (Math.abs(x - tx) <= 3 && z >= 162 && z <= 168) return hash3(x, z, 1) < 0.35 ? c.petal : c.soil;
    if ((x % 8 === 7) || (z - 152) % 4 === 3) return c.graniteDark;
    const h = hash3(x >> 3, (z - 152) >> 2, 9);
    const p = hash3(x, z, 4);
    if (p < 0.05) return c.petal;
    return h < 0.5 ? c.granite : c.paveC;
  }
  // far bank
  if (z >= 200) {
    if (z === 200) return c.curb;
    if (z >= 204 && z <= 211) {
      const p = hash3(x, z, 6);
      return p < 0.08 ? c.petal : p < 0.12 ? c.petalDeep : c.sand2;
    }
    const p = hash3(x, z, 8);
    return p < 0.06 ? c.petal : p < 0.3 ? c.clover : p < 0.65 ? c.grass : c.grassDark;
  }
  return c.concreteDark;
}

const TREE_X = [20, 44, 92, 116, 156, 180, 248, 272];

export function sakuraTree(b: Builder, x: number, z: number, seed: number, yBase = G) {
  const g = b.grid, c = b.c;
  const r = rng(seed);
  const h = 14 + Math.floor(r() * 5);
  // the crown (upper trunk, branches and blossom) rocks as one piece from just below the first branch
  const crownY = h - 6;
  let id = 0;
  // trunk with a lean
  let tx = x, tz = z;
  for (let y = 0; y < h; y++) {
    if (y > 4 && r() < 0.3) tx += r() < 0.5 ? 1 : -1;
    if (y > 4 && r() < 0.2) tz += r() < 0.5 ? 1 : -1;
    g.box(tx, yBase + y, tz, tx + 1, yBase + y, tz + 1, y < 3 ? c.trunkDark : c.trunk);
    if (y === crownY) id = b.addSway({ ...SWAY.tree, pivot: [(tx + 1) * V, (yBase + y - G) * V, (tz + 1) * V], axis: [0, 0, 0], reach: 0 });
    if (y >= crownY) for (let k = 0; k < 4; k++) b.swayCell(tx + (k & 1), yBase + y, tz + (k >> 1), id);
  }
  // branches
  const tips: [number, number, number][] = [];
  for (let i = 0; i < 5; i++) {
    const ang = (i / 5) * Math.PI * 2 + r();
    let bx = tx, by = yBase + h - 3 - Math.floor(r() * 4), bz = tz;
    const len = 5 + Math.floor(r() * 5);
    for (let s = 0; s < len; s++) {
      bx += Math.cos(ang) * 1.0; bz += Math.sin(ang) * 1.0; by += r() < 0.5 ? 1 : 0;
      g.set(Math.round(bx), by, Math.round(bz), c.trunk);
      b.swayCell(Math.round(bx), by, Math.round(bz), id);
    }
    tips.push([bx, by, bz]);
  }
  tips.push([tx, yBase + h + 1, tz]);
  let bx0 = tx, bz0 = tz, bx1 = tx, bz1 = tz;
  for (const [cx, , cz] of tips) { bx0 = Math.min(bx0, cx - 8); bz0 = Math.min(bz0, cz - 8); bx1 = Math.max(bx1, cx + 8); bz1 = Math.max(bz1, cz + 8); }
  b.occlude(Math.floor(bx0), Math.floor(bz0), Math.ceil(bx1), Math.ceil(bz1), (yBase - G + h + 7) * V, (yBase - G) * V + 1.3, 'tree');
  const cols = [c.sakura, c.sakuraB, c.sakuraC, c.sakuraD];
  for (const [cx, cy, cz] of tips) {
    const rx = 5 + r() * 3, ry = 3.5 + r() * 2, rz = 5 + r() * 3;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y++)
      for (let zz = Math.floor(cz - rz); zz <= cz + rz; zz++)
        for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
          const dx = (xx - cx) / rx, dy = (y - cy) / ry, dz = (zz - cz) / rz;
          const d = dx * dx + dy * dy + dz * dz;
          const n = hash3(xx, y, zz);
          if (d < 1 - n * 0.35 && n > 0.08) {
            if (g.get(xx, y, zz) === 0) { g.set(xx, y, zz, cols[(n * 97 | 0) % 4]); b.swayCell(xx, y, zz, id); }
          }
        }
  }
}

export function boat(b: Builder, x0: number, z0: number, len: number, seed: number) {
  const g = b.grid, c = b.c;
  const r = rng(seed);
  const yb = 8; // keel below the water line
  for (let i = 0; i < len; i++) {
    const t = i / (len - 1);
    const taper = Math.min(1, Math.min(t, 1 - t) * 5);
    const half = Math.max(1, Math.round(3 * taper));
    const zc = z0 + 3;
    for (let y = yb; y <= yb + 3; y++) {
      const hw = y === yb ? half - 1 : half;
      for (let dz = -hw; dz <= hw; dz++) {
        const edge = Math.abs(dz) === hw || y === yb;
        g.set(x0 + i, y, zc + dz, edge ? (y === yb + 3 ? c.boatRim : c.boat) : y === yb + 1 ? c.boatDark : 0);
      }
    }
    if (i > 2 && i < len - 3 && i % 4 === 0) g.box(x0 + i, yb + 2, zc - half + 1, x0 + i, yb + 2, zc + half - 1, c.boatRim);
  }
  if (r() < 0.6) g.box(x0 + Math.floor(len / 2) - 2, yb + 2, z0 + 2, x0 + Math.floor(len / 2) + 1, yb + 3, z0 + 4, c.tarp);
}

export function bridge(b: Builder, x0: number, x1: number, style: 'red' | 'stone') {
  const g = b.grid, c = b.c, k = b.k;
  const zA = 166, zB = 205;
  for (let z = zA; z <= zB; z++) {
    const t = (z - zA) / (zB - zA);
    const rise = Math.round(Math.sin(t * Math.PI) * (style === 'red' ? 7 : 4));
    const top = G - 1 + rise;
    const deck = style === 'red' ? c.wood : c.stoneStep;
    g.box(x0, top - 1, z, x1, top, z, (x) => (style === 'red' && (x - x0) % 2 === 0 ? c.woodMid : deck));
    if (z >= 172 && z <= 199) g.box(x0, top - 3, z, x1, top - 2, z, style === 'red' ? c.lacquerDark : c.canalStone);
    else g.box(x0, G - 1, z, x1, top - 2, z, style === 'red' ? c.woodDark : c.canalStone);
    // railings
    const rail = style === 'red' ? c.lacquer : c.stone;
    for (const xr of [x0, x1]) {
      if (z % 4 === 0 || z === zA || z === zB) g.box(xr, top + 1, z, xr, top + 4, z, rail);
      g.set(xr, top + 4, z, rail);
      g.set(xr, top + 2, z, rail);
      if (style === 'red' && (z === zA || z === zB || z === 172 || z === 199)) g.set(xr, top + 5, z, c.gold);
    }
  }
  if (style === 'red') {
    for (const z of [zA, zB]) {
      b.lamp((x0 + 0.5) * V, 1.6, z * V, WARM, 3, 0.6);
    }
  }
  void k;
}

// ---------------------------------------------------------------------------------------------
// Landmarks

function temple(b: Builder) {
  const g = b.grid, c = b.c;
  // raised stone platform
  g.box(0, G, 22, 7, G + 3, 77, c.stoneStep);
  for (let s = 0; s < 4; s++) g.box(8 + s, G, 42 - s, 8 + s, G + 3 - s, 57 + s, c.stoneStep);
  // hall body
  g.box(0, G + 4, 26, 3, G + 18, 73, c.templeWhite);
  for (let z = 26; z <= 73; z += 6) g.box(4, G + 4, z, 5, G + 18, z + 1, c.lacquer);
  g.box(4, G + 17, 26, 5, G + 18, 73, c.lacquer);
  g.box(3, G + 4, 44, 3, G + 14, 55, c.woodDark);
  g.box(3, G + 5, 45, 3, G + 13, 54, c.shoji);
  // offering box
  g.box(6, G + 4, 46, 7, G + 6, 53, c.woodDark);
  g.box(6, G + 7, 46, 7, G + 7, 53, c.gold);
  // big hip roof with upturned eaves
  for (let l = 0; l < 12; l++) {
    const inset = l * 2 - (l < 2 ? 0 : 1);
    const z0 = 18 + inset, z1 = 81 - inset;
    const x1 = 11 - l;
    if (z0 > z1 || x1 < 0) break;
    const col = l % 2 ? c.roofGreen : c.roofGreenB;
    g.box(0, G + 19 + l, z0, x1, G + 19 + l, z1, col);
  }
  g.box(0, G + 19, 17, 12, G + 19, 17, c.roofGreenB);
  g.box(0, G + 19, 82, 12, G + 19, 82, c.roofGreenB);
  g.box(0, G + 30, 40, 1, G + 31, 59, c.gold);
  b.lamp(8 * V, 2.5, 50 * V, WARM, 5, 0.7);
  b.occlude(0, 17, 12, 82, 8.2, 1.95, 'landmark');
}

function pagoda(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const cx = 12, cz = 9;
  let y = G;
  g.box(cx - 8, y, cz - 8, cx + 8, y + 2, cz + 8, c.stoneStep);
  y += 3;
  for (let tier = 0; tier < 5; tier++) {
    const half = 5 - Math.floor(tier * 0.6);
    const hBody = tier === 0 ? 8 : 6;
    g.box(cx - half, y, cz - half, cx + half, y + hBody - 1, cz + half, c.lacquer);
    // white lattice windows
    for (const s of [-half, half]) {
      g.box(cx - 1, y + 2, cz + s, cx + 1, y + hBody - 3, cz + s, c.templeWhite);
      g.box(cx + s, y + 2, cz - 1, cx + s, y + hBody - 3, cz + 1, c.templeWhite);
    }
    y += hBody;
    // eaves
    const e = half + 4;
    g.box(cx - e, y, cz - e, cx + e, y, cz + e, c.roofTileB);
    g.box(cx - e + 1, y + 1, cz - e + 1, cx + e - 1, y + 1, cz + e - 1, c.roofTile);
    g.box(cx - e + 3, y + 2, cz - e + 3, cx + e - 3, y + 2, cz + e - 3, c.roofTileB);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) g.set(cx + sx * e, y + 1, cz + sz * e, c.roofTileB);
    y += 3;
  }
  // spire
  const sp = new Prop(5, 48, 5);
  for (let i = 0; i < 48; i++) sp.box(2, i, 2, 2, i, 2, k.c.gold);
  for (let i = 4; i < 36; i += 4) sp.box(0, i, 0, 4, i, 4, k.c.gold);
  sp.box(1, 40, 1, 3, 43, 3, k.c.gold);
  b.place(sp, (cx + 0.5) * V, (y - G) * V, (cz + 0.5) * V);
  b.occlude(cx - 9, cz - 9, cx + 9, cz + 9, (y - G) * V + 6.5, 1.7, 'landmark');
}

function gate(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  // Thunder gate across Kaminari Lane at x 28..41
  const pillars: [number, number][] = [[29, 37], [38, 37], [29, 61], [38, 61]];
  for (const [x, z] of pillars) g.box(x, G, z, x + 1, G + 17, z + 1, c.lacquer);
  // side chambers with lattice
  for (const [z0, z1] of [[33, 40], [58, 66]]) {
    g.box(28, G, z0, 40, G + 1, z1, c.stoneStep);
    g.box(29, G + 2, z0, 39, G + 15, z1, (x, y, z) => ((x + y + z) % 2 === 0 ? c.lacquerDark : c.woodDark));
    g.box(29, G + 16, z0, 39, G + 17, z1, c.lacquer);
  }
  // lintels
  g.box(28, G + 16, 37, 40, G + 17, 62, c.lacquer);
  g.box(28, G + 18, 34, 40, G + 18, 65, c.woodDark);
  // hip roof
  for (let l = 0; l < 9; l++) {
    const ex = 5 - Math.floor(l * 0.8), ez = 6 - l;
    const x0 = 28 - ex + l, x1 = 40 + ex - l, z0 = 30 - Math.min(0, ez) + l * 2 - 2, z1 = 69 + Math.min(0, ez) - l * 2 + 2;
    if (x0 > x1 || z0 > z1) break;
    g.box(x0, G + 19 + l, z0, x1, G + 19 + l, z1, l % 2 ? c.roofTile : c.roofTileB);
  }
  g.box(33, G + 28, 38, 35, G + 29, 61, c.roofRidge);
  // giant lantern hanging in the middle
  b.place(giantLantern(k), 34.5 * V, 0.3, 49.5 * V);
  b.block(34.5 * V - 1.4, 49.5 * V - 1.4, 34.5 * V + 1.4, 49.5 * V + 1.4);
  b.lamp(34.5 * V, 2.4, 49.5 * V, RED, 7.5, 1.4);
  // the side chambers go down to waist height; the middle stops under the lintel so the giant lantern stays
  b.occlude(23, 28, 45, 41, 7.8, 0.95, 'landmark', 1);
  b.occlude(23, 42, 45, 57, 7.8, 3.9, 'landmark', 1);
  b.occlude(23, 58, 45, 71, 7.8, 0.95, 'landmark', 1);
}

// ---------------------------------------------------------------------------------------------

/** The old district's walking graph (metres); the city's joins onto it. */
export const OLD_GRAPH: { nodes: [number, number][]; edges: [number, number][] } = {
  nodes: [
    [11.5, 12.5], [35.7, 12.5], [69, 12.5], // 0..2 Kaminari
    [35.7, 17], [35.7, 37.5], // 3..4 alley
    [2.5, 40.0], [15.9, 40.0], [35.7, 40.0], [54.9, 40.0], [69.5, 40.0], // 5..9 promenade
    [15.9, 51.8], [54.9, 51.8], [2.5, 52], [69.5, 52], // 10..13 far bank
    [22, 12.5], [52, 12.5], [26, 40.8], [45, 40.0], [35, 51.0], // 14..18
    [5.5, 15.0], // 19 plaza
  ],
  edges: [[19, 0], [0, 14], [14, 1], [1, 15], [15, 2], [1, 3], [3, 4], [4, 7], [5, 6], [6, 16], [16, 7], [7, 17], [17, 8], [8, 9], [6, 10], [8, 11], [12, 10], [10, 18], [18, 11], [11, 13]],
};
/** Where the old district's idlers, cats and the player's first steps stand (metres): kept clear of clutter. */
export const OLD_KEEP: [number, number][] = [
  [11.2, 12.5], [44.6, 30.5], [43.0, 30.5],
  [6.6, 9.6], [36.6, 27.2], [22.0, 40.0], [44.5, 50.5], [20.0, 15.2], [58.5, 9.7],
  [34.4, 30.4], [12.2, 40.2], [49.4, 52.3],
];

export function buildTokyo(win?: Window): BuildResult {
  const b = new Builder(win);
  const g = b.grid, c = b.c, k = b.k;
  const r = b.r;
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  // a building whose front the dressing pass fills with the street's clutter
  const noted = (lot: Lot, o: BuildingOpts, mix: string) => {
    o = hotelize(lot, o);
    const nr = b.rooms.length;
    const { H } = building(lot, o);
    noteFront(lot, o.ground, o.style, mix, H, o.seed, b.rooms.slice(nr).map((rm) => rm.door));
  };

  terrain(b);
  temple(b);
  pagoda(b);
  gate(b);

  const stalls: StallAnchor[] = [];
  const awnPairs: [number, number][] = [[c.awnRed, c.awnWhite], [c.awnGreen, c.awnWhite], [c.awnBlue, c.awnWhite], [c.awnOrange, c.awnWhite]];
  const izakayaLanterns = [k.c.lanternRed, k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber];

  // the side of a street nearest the default camera stays low (diorama layout); the far side rises
  // `force` swaps in a hand-placed shop; the random picks still run so the rest of the street keeps its layout
  type Force = { ground: Ground; style?: Style; floors?: number; restaurant?: RestaurantSpec; secret?: boolean };
  const streetShop = (lot: Lot, seed: number, lanternAlt: boolean, near = false, force?: Force) => {
    const ground0: Ground = pick(['shop', 'shop', 'cafe', 'shutter', 'florist', 'books', 'bakery', 'pharmacy', 'fish']);
    const style0: Style = r() < 0.22 ? 'machiya' : r() < 0.12 ? 'kura' : pick(['showa', 'modern', 'showa', 'apartment']);
    const floors0 = style0 === 'machiya' || style0 === 'kura' ? 2 : near ? 2 + Math.floor(r() * 2) : 2 + Math.floor(r() * 4);
    const awning = ground0 === 'shop' || ground0 === 'cafe' ? pick(awnPairs) : undefined;
    const ground = force?.ground ?? ground0, floors = force?.floors ?? floors0;
    const o = hotelize(lot, { floors, style: force?.style ?? style0, ground, seed, awning: ground === 'shop' || ground === 'cafe' || ground === 'kissa' ? awning ?? awnPairs[seed % awnPairs.length] : undefined, restaurant: force?.restaurant, secret: force?.secret });
    noted(lot, o, 'shops');
    const style = o.style;
    const [fx, fz] = lot.front(lot.width / 2, 0.3);
    if (!o.hotel && style !== 'machiya' && style !== 'kura' && b.clear(fx, 3.6, fz)) {
      lot.wallProp(lantern(k, lanternAlt ? k.c.lanternRed : k.c.lanternWhite, 5, 6, seed), lot.width / 2, 3.3, 0.15);
      const [lx, lz] = lot.front(lot.width / 2, 0.5);
      b.lamp(lx, 3.4, lz, lanternAlt ? RED : WHITEWARM, 3.5, 0.8);
    }
  };

  // --- Kaminari Lane, north side (facades face +z at z=35)
  {
    let x = 42, i = 0;
    while (x < 280) {
      let w = 16 + Math.floor(r() * 4) * 3;
      if (x + w > 280) w = 280 - x;
      if (w < 10) { g.box(x, G, 4, 279, G + 16, 35, c.concreteWall); dressBlock(b, x, 4, 279, 35, 17, c.concreteWall, 71); break; }
      const lot = new Lot(b, x, 4, x + w - 1, 35, 's');
      if (i === 2) {
        stalls.push(stall(lot, { id: 'kimura', foods: ['ningyoyaki', 'dango'], awning: [c.awnRed, c.awnWhite], noren: k.c.norenRed, lantern: k.c.lanternRed, equip: 'mold' }, 3, 101, c.cream));
      } else if (i === 4) streetShop(lot, 1000 + i, false, false, { ground: 'konbini', style: 'modern', floors: 3 });
      else if (i === 6) streetShop(lot, 1000 + i, false, false, { ground: 'soba', style: 'machiya', floors: 2, restaurant: { id: 'kikyo', foods: ['zarusoba', 'tempura'] } });
      else streetShop(lot, 1000 + i, i % 2 === 1);
      x += w;
      i++;
    }
    g.box(40, G, 0, OSX - 1, G + 10, 3, c.concreteWall);
    dressBlock(b, 40, 0, OSX - 1, 3, 11, c.concreteWall, 72, 'wall');
  }

  // --- Kaminari Lane, south side (facades face -z at z=64)
  {
    const segs: [number, number][] = [[42, 111], [174, 279]];
    let i = 0;
    for (const [sx0, sx1] of segs) {
      let x = sx0, j = 0;
      while (x <= sx1) {
        let w = 16 + Math.floor(r() * 4) * 3;
        if (x + w - 1 > sx1) w = sx1 - x + 1;
        if (w < 10) { g.box(x, G, 64, sx1, G + 16, 91, c.concreteWall); dressBlock(b, x, 64, sx1, 91, 17, c.concreteWall, 73); break; }
        // the western block's back half belongs to the buildings behind (fillBlock), so those lots are shallower
        const lot = new Lot(b, x, 64, x + w - 1, sx0 === 42 ? 81 : 91, 'n');
        if (sx0 === 174 && j === 1) {
          stalls.push(stall(lot, { id: 'sakuraya', foods: ['taiyaki', 'dorayaki'], awning: [c.awnBlue, c.awnWhite], noren: k.c.navy, lantern: k.c.lanternWhite, equip: 'mold' }, 2, 202, c.mint));
        } else if (sx0 === 174 && j === 2) streetShop(lot, 2000 + i, i % 2 === 0, true, { ground: 'books', style: 'showa', secret: true });
        else streetShop(lot, 2000 + i, i % 2 === 0, true);
        x += w;
        i++;
        j++;
      }
    }
  }
  // (the east end of Kaminari Lane opens onto Neon-dori; city.ts builds the corner blocks)

  // --- west edges around the plaza
  building(new Lot(b, 22, 4, 41, 31, 'w'), { floors: 2, style: 'machiya', ground: 'shop', seed: 61, awning: [c.awnNavy, c.awnNavy], doorA: 17 });
  building(new Lot(b, 28, 67, 41, 91, 'w'), { floors: 2, style: 'machiya', ground: 'cafe', seed: 62 });

  // --- block interiors (seen from above)
  const fillBlock = (x0: number, z0: number, x1: number, z1: number, seed: number) => {
    const rr = rng(seed);
    for (let z = z0; z <= z1; z += 14)
      for (let x = x0; x <= x1; x += 14) {
        const h = 8 + Math.floor(rr() * 4) * 6;
        const xe = Math.min(x1, x + 13), ze = Math.min(z1, z + 13);
        const lot = new Lot(b, x, z, xe, ze, 's');
        const wall = pick([c.concreteWall, c.beige, c.sand2, c.slate, c.cream]);
        lot.box(0, 0, 0, lot.width - 1, h - 1, lot.depth - 1, wall);
        dressBlock(b, x, z, xe, ze, h, wall, seed * 97 + x * 3 + z);
        if (rr() < 0.4) tiledRoof(lot, h, 0, 2);
        else flatRoof(lot, h, rr);
        b.occlude(x, z, xe, ze, h * V + 2, 0.95, 'landmark');
      }
  };
  fillBlock(0, 92, 111, 123, 31);
  fillBlock(42, 82, 111, 91, 34);
  fillBlock(174, 92, 279, 117, 32);
  fillBlock(182, 118, 279, 127, 33);
  g.box(0, G, 82, 23, G + 10, 91, c.concreteWall); // stops short of the café's potted bamboo
  dressBlock(b, 0, 82, 23, 91, 11, c.concreteWall, 74, 'wall');

  // --- Lantern Alley (x 136..149): west side faces +x at x=135, east side faces -x at x=150
  {
    let z = 64, i = 0, placed = false;
    while (z < 152) {
      if (!placed && z >= 74) {
        stalls.push(stall(new Lot(b, 112, z, 135, z + 15, 'e'), { id: 'torikichi', foods: ['yakitori', 'karaage'], awning: [c.awnNavy, c.awnRed], noren: k.c.norenRed, lantern: k.c.lanternRed, equip: 'grill' }, 2, 303, c.woodDark));
        placed = true;
        z += 16;
        continue;
      }
      let w = 10 + Math.floor(r() * 3) * 2;
      if (z + w > 152 || 152 - (z + w) < 6) w = 152 - z;
      noted(new Lot(b, 112, z, 135, z + w - 1, 'e'), { floors: 2, style: 'izakaya', ground: 'izakaya', seed: 3000 + i, lanterns: pick(izakayaLanterns), roof: r() < 0.5 ? 'tiled' : 'flat' }, 'bars');
      z += w;
      i++;
    }
    z = 64; i = 0; placed = false;
    const eastLot = (z0: number, z1: number) => {
      noted(new Lot(b, 150, z0, 173, z1, 'w'), { floors: 2, style: 'izakaya', ground: 'izakaya', seed: 3500 + i, lanterns: pick(izakayaLanterns), roof: r() < 0.5 ? 'tiled' : 'flat' }, 'bars');
      i++;
    };
    while (z < 118) {
      if (!placed && z >= 92) {
        stalls.push(stall(new Lot(b, 150, z, 173, z + 17, 'w'), { id: 'hoshi', foods: ['ramen', 'gyoza'], awning: [c.awnRed, c.awnRed], noren: k.c.norenBrown, lantern: k.c.lanternAmber, equip: 'pot' }, 3, 404, c.terracotta));
        placed = true;
        z += 18;
        continue;
      }
      let w = 10 + Math.floor(r() * 3) * 2;
      const limit = placed ? 118 : 92;
      if (z + w > limit || limit - (z + w) < 6) w = limit - z;
      if (w <= 0) break;
      eastLot(z, z + w - 1);
      z += w;
    }
    z = 126;
    while (z < 152) {
      let w = 10 + Math.floor(r() * 3) * 2;
      if (z + w > 152 || 152 - (z + w) < 6) w = 152 - z;
      eastLot(z, z + w - 1);
      z += w;
    }
    // overhead tangle of wires and lanterns across the alley
    for (let zz = 70; zz < 150; zz += 9) {
      b.place(wire(k, 3.5, 0.35 + r() * 0.3), 35.75, 4.2 + r() * 0.6, zz * V, 1);
      if (zz % 2 === 0) {
        b.swayParent = b.lastSway[0];
        b.place(lantern(k, pick(izakayaLanterns), 4, 5, zz), 35.75, 3.2, zz * V + 0.12);
        b.swayParent = 0;
        b.lamp(35.75, 3.3, zz * V, RED, 3.2, 0.7);
      }
    }
    for (const zz of [64.6, 151.4]) {
      const hs = boardSign(k, k.c.signRed, k.c.neonWhite, 5, Math.round(zz));
      hs.sway(SWAY.sign, [hs.sx / 2, hs.sy, 1], [1, 0, 0]);
      b.place(hs, 35.75, 4.3, zz * V, 0);
      b.lamp(35.75, 4.8, zz * V, [1, 0.5, 0.4], 4, 0.6);
    }
  }

  // --- Nameless passage (z 118..125, x 150..181)
  {
    g.box(150, G, 118, 181, G + 30, 125, 0);
    g.box(150, G, 117, 181, G + 9, 117, c.cedar);
    g.box(150, G, 126, 181, G + 9, 126, c.woodDark);
    g.box(182, G, 116, 185, G + 12, 127, c.cedar);
    g.box(182, G + 10, 116, 185, G + 12, 127, c.roofTile);
    for (let x = 152; x < 180; x += 7) b.place(wire(k, 2, 0.15), x * V, 3.0 + (x % 3) * 0.2, 30.5, 1);
    b.place(crateStack(k, 93), 41.0, 0, 29.95);
    b.block(40.5, 29.45, 41.5, 30.45);
    b.place(plantPot(k, 'bamboo', 94), 43.6, 0, 31.2);
    b.place(bicycle(k, k.c.bikeMint), 39.5, 0, 31.3, 0);
    b.lamp(41, 2.4, 30.5, WARM, 3, 0.35);
  }

  // --- Canal-facing lots (facades face +z at z=151)
  {
    const segs: [number, number, number][] = [[0, 111, 124], [174, 279, 128]];
    let i = 0;
    for (const [sx0, sx1, z0] of segs) {
      let x = sx0;
      while (x <= sx1) {
        let w = 16 + Math.floor(r() * 3) * 4;
        if (x + w - 1 > sx1 || sx1 - (x + w - 1) < 10) w = sx1 - x + 1;
        const lot = new Lot(b, x, z0, x + w - 1, 151, 's');
        const ground0: Ground = pick(['cafe', 'cafe', 'shop', 'izakaya', 'plain', 'florist', 'bakery', 'books']);
        const style0: Style = ground0 === 'izakaya' ? 'izakaya' : r() < 0.3 ? 'machiya' : r() < 0.12 ? 'kura' : pick(['showa', 'modern', 'apartment']);
        const floors0 = style0 === 'machiya' || style0 === 'kura' ? 2 : 2 + Math.floor(r() * 3);
        const awning = ground0 === 'shop' || ground0 === 'cafe' ? pick(awnPairs) : undefined;
        const lanterns = pick(izakayaLanterns);
        // the old kissaten by the canal
        const kissa = i === 2;
        const ground: Ground = kissa ? 'kissa' : ground0, style: Style = kissa ? 'showa' : style0, floors = kissa ? 3 : floors0;
        noted(lot, { floors, style, ground, seed: 5000 + i, awning: kissa ? [c.awnRed, c.awnWhite] : awning, lanterns, restaurant: kissa ? { id: 'komorebi', foods: ['purin', 'napolitan'] } : undefined }, 'canal');
        x += w;
        i++;
      }
    }
  }

  // --- Promenade dressing
  const vending: [number, number, number][] = [];
  {
    for (const tx of TREE_X) {
      sakuraTree(b, tx, 165, 700 + tx);
      b.block(tx * V - 0.1, 165 * V - 0.1, tx * V + 0.65, 165 * V + 0.65);
    }
    for (let x = 4; x < OSX - 4; x += 4) {
      if ((x >= 54 && x <= 73) || (x >= 210 && x <= 229) || (x >= 122 && x <= 137)) continue;
      g.box(x, G, 170, x, G + 2, 170, c.stone);
      if (x + 4 < OSX - 4 && !(x + 4 >= 54 && x + 4 <= 73) && !(x + 4 >= 210 && x + 4 <= 229) && !(x + 4 >= 122 && x + 4 <= 137)) g.box(x, G + 2, 170, x + 3, G + 2, 170, c.stone);
    }
    // (75: clear of the red bridge's ramp; 4 and 28: lamp heads out of the cherry canopies)
    for (const lx of [4, 28, 75, 104, 140, 168, 200, 236, 260]) {
      b.place(streetLamp(k), lx * V + 0.3, 0, 168.6 * V, 0);
      b.lamp(lx * V + 0.8, 3.4, 168.6 * V, WHITEWARM, 7, 1.0);
      b.block(lx * V, 168.6 * V - 0.25, lx * V + 0.5, 168.6 * V + 0.25);
    }
    for (const bx of [80, 196, 243]) { b.place(bench(k), bx * V, 0, 167.2 * V, 0); b.benches.push([bx * V, 167.2 * V, 0]); b.block(bx * V - 0.9, 167.2 * V - 0.35, bx * V + 0.9, 167.2 * V + 0.35); }
    const clearOf = (x: number, half: number) => {
      for (const rm of b.rooms) if (Math.abs(rm.door[1] - 38.4) < 2.4 && Math.abs(rm.door[0] - x) < 1.0 + half) return false;
      for (const [ax, az, bx, bz] of b.standing) if (ax < x + half && bx > x - half && az < 38.8 && bz > 38.0) return false; // planters by the doors
      return true;
    };
    for (const [vx0, vc] of [[29.6, k.c.vmRed], [30.7, k.c.vmBlue], [60.5, k.c.vmWhite]] as [number, number][]) {
      let vx = vx0;
      while (!clearOf(vx, 0.5)) vx += 1.1;
      b.place(vendingMachine(k, vc, Math.round(vx * 10)), vx, 0, 38.4, 0);
      vending.push([vx, 0, 39.2]);
      b.lamp(vx, 1.2, 38.9, COOL, 3.2, 0.9);
      b.block(vx - 0.5, 38.0, vx + 0.5, 38.8);
    }
    let bk = 51.25;
    while (!clearOf(bk, 1.3)) bk += 1.1;
    b.place(bicycle(k, k.c.bikeRed), bk - 0.65, 0, 38.3, 0);
    b.place(bicycle(k, k.c.bikeSilver), bk + 0.65, 0, 38.3, 0);
    b.block(bk - 1.35, 38.0, bk + 1.35, 38.6);
    for (let x = 6; x < 70; x += 2.6) {
      if ((x > 13.5 && x < 18.3) || (x > 52.5 && x < 57.3)) continue;
      const red = Math.round(x) % 2 === 1;
      if (!b.clear(x, 2.8, 42.55)) continue; // lost in a cherry canopy
      b.place(lantern(k, red ? k.c.lanternRed : k.c.lanternWhite, 4, 5, Math.round(x * 10)), x, 2.55, 42.55);
      b.lamp(x, 2.7, 42.55, red ? RED : WHITEWARM, 3.2, 0.55);
    }
  }

  // --- Yatai (stall E) on the promenade, customers on the canal side
  {
    const x0 = 96, z0 = 154;
    const yat = new Lot(b, x0, z0, x0 + 19, z0 + 7, 's');
    // counter height (1 m) like every stall, so the cook shows over it and the hand-over clears it
    yat.box(1, 0, 1, 18, 2, 6, c.wood);
    yat.box(0, 3, 0, 19, 3, 6, c.counterTop);
    yat.box(2, 0, 7, 3, 1, 7, c.trunkDark); yat.box(16, 0, 7, 17, 1, 7, c.trunkDark);
    for (const a of [1, 18]) for (const d of [1, 6]) yat.box(a, 5, d, a, 11, d, c.woodDark);
    yat.box(-1, 12, -1, 20, 12, 7, (a) => (a % 2 ? c.roofTile : c.roofTileB));
    yat.box(0, 13, 1, 19, 13, 5, c.roofTileB);
    yat.box(1, 14, 2, 18, 14, 4, c.roofRidge);
    const cx = (x0 + 10) * V;
    const front = (z0 + 8) * V; // 40.5
    stalls.push({ id: 'hachi', stand: [cx, front + 1.0], vendor: [cx, z0 * V - 0.45, 0], label: [cx, 4.4, front + 0.4] });
    b.place(noren(k, 34, k.c.norenRed, k.c.norenWhite, 5, 5), cx, 2.1, front + 0.12);
    b.place(lantern(k, k.c.lanternRed, 5, 7, 81), (x0 - 0.2) * V, 1.8, front + 0.1);
    b.place(lantern(k, k.c.lanternRed, 5, 7, 82), (x0 + 20.2) * V, 1.8, front + 0.1);
    b.lamp((x0 - 0.2) * V, 2.0, front + 0.3, RED, 4.5, 1.1);
    b.lamp((x0 + 20.2) * V, 2.0, front + 0.3, RED, 4.5, 1.1);
    b.lamp(cx, 2.4, front - 1, WARM, 5, 0.9);
    const teppan = new Prop(18, 2, 6);
    teppan.box(0, 0, 0, 17, 0, 5, k.c.black);
    for (let x = 1; x < 9; x += 2) for (let z = 1; z < 5; z += 2) teppan.set(x, 1, z, k.c.gold);
    teppan.box(11, 1, 1, 16, 1, 4, k.c.brass);
    b.place(teppan, cx, 1.0, z0 * V + 0.55);
    b.emitters.push({ kind: 'steam', pos: [cx - 0.5, 1.2, z0 * V + 0.55], rate: 1.2 });
    b.place(buildFood('takoyaki', b.pal), cx - 0.9, 1.0, front - 0.35, 0);
    b.place(buildFood('monjayaki', b.pal), cx + 0.9, 1.0, front - 0.35, 0);
    for (const sx of [-1.6, 0, 1.6]) b.place(stool(k, k.c.lacquer), cx + sx, 0, front + 0.45);
    b.place(boardSign(k, k.c.signRed, k.c.white, 4, 83), cx, 3.05, front + 0.42, 0); // hangs off the eave, clear of the roof
    b.place(nobori(k, k.c.norenWhite, k.c.norenRed, 84), (x0 - 1.4) * V, 0, (z0 + 6) * V, 0);
    b.block(x0 * V, z0 * V, (x0 + 20) * V, front);
  }

  // --- Keep walkers out of the canal (boulders, reeds and boats poke above the water), except on the
  // bridges and the landing steps by the yatai
  for (const [x0, x1] of [[0, 56], [72, 124], [136, 212], [228, 288]] as [number, number][]) b.block(x0 * V, 172 * V, x1 * V, 200 * V - 0.01);

  // --- Canal: boats
  boat(b, 150, 175, 22, 1);
  boat(b, 236, 192, 18, 2);
  boat(b, 20, 191, 20, 3);

  // --- Bridges
  bridge(b, 56, 71, 'red');
  bridge(b, 212, 227, 'stone');

  // --- Far bank
  {
    for (const tx of [10, 34, 88, 112, 140, 166, 190, 244, 268]) {
      sakuraTree(b, tx, 213, 900 + tx);
      b.block(tx * V - 0.1, 213 * V - 0.1, tx * V + 0.65, 213 * V + 0.65);
    }
    let x = 0;
    while (x < OSX) {
      const w = Math.min(OSX - x, 20 + Math.floor(r() * 3) * 4);
      const lot = new Lot(b, x, 216, x + w - 1, 223, 'n');
      lot.box(0, 0, 0, w - 1, 9, lot.depth - 1, pick([c.plaster, c.woodDark, c.cedar]));
      lot.box(2, 1, 0, w - 3, 7, 0, (a) => (a % 2 ? c.woodDark : c.shoji));
      tiledRoof(lot, 10, 2, 2);
      x += w;
    }
    for (const [sx, sz] of [[12.5, 51.6], [63.2, 52.6]] as [number, number][]) {
      b.place(stoneLantern(k), sx, 0, sz, 0);
      b.lamp(sx, 1.5, sz, WARM, 3, 0.8);
      b.block(sx - 0.5, sz - 0.5, sx + 0.5, sz + 0.5);
    }
    for (const bx of [28, 120, 170]) { b.place(bench(k), bx * V, 0, 53.0, 2); b.benches.push([bx * V, 53.0, Math.PI]); b.block(bx * V - 0.9, 52.7, bx * V + 0.9, 53.3); }
  }

  // --- Plaza dressing
  {
    b.place(incenseBurner(k), 5.0, 0, 12.5);
    b.block(3.9, 11.4, 6.1, 13.6);
    b.emitters.push({ kind: 'incense', pos: [5.0, 2.6, 12.5], rate: 1 });
    b.lamp(5.0, 1.4, 12.5, [1, 0.5, 0.2], 3, 0.8);
    for (const [x, z] of [[3.6, 7.0], [3.6, 18.2], [6.2, 18.2]] as [number, number][]) { // (one at the north corner: the corner shop takes the other spot)
      b.place(stoneLantern(k), x, 0, z);
      b.lamp(x, 1.5, z, WARM, 3.2, 0.7);
      b.block(x - 0.5, z - 0.5, x + 0.5, z + 0.5);
    }
    // tiny hokora shrine in the north-west corner
    g.box(10, G, 19, 15, G + 1, 23, c.stoneStep);
    g.box(11, G + 2, 20, 14, G + 5, 22, c.woodDark);
    g.box(10, G + 6, 19, 15, G + 6, 23, c.roofTile);
    g.box(11, G + 7, 20, 14, G + 7, 22, c.roofRidge);
    b.place(plantPot(k, 'pine', 42), 6.4, 0, 19.6);
  }

  // utility poles with wires along Kaminari Lane
  for (let x = 48; x < 276; x += 40) {
    for (const z of [37, 62]) {
      g.box(x, G, z, x, G + 26, z, c.pole);
      g.box(x - 2, G + 24, z, x + 2, G + 24, z, c.pole);
      b.block(x * V - 0.1, z * V - 0.1, x * V + 0.35, z * V + 0.35);
    }
    if (x + 40 < 280) {
      b.place(wire(k, 10, 0.6), (x + 20.5) * V, 5.25, 37.5 * V, 0);
      b.place(wire(k, 10, 0.6), (x + 20.5) * V, 5.25, 62.5 * V, 0);
      b.place(wire(k, 10, 0.4), (x + 20.5) * V, 5.45, 37.5 * V, 0);
    }
    b.place(wire(k, 6.25, 0.5), (x + 0.5) * V, 5.25, 50 * V, 1);
  }
  // lantern strings across Kaminari Lane
  for (let x = 46; x < 276; x += 22) {
    b.place(wire(k, 6.25, 0.3), x * V, 4.1, 50 * V, 1);
    b.swayParent = b.lastSway[0];
    for (let j = 0; j < 4; j++) {
      const z = 9.9 + j * 1.6;
      b.place(lantern(k, j % 2 ? k.c.lanternRed : k.c.lanternWhite, 4, 5, x * 10 + j), x * V, 3.55 - Math.sin(((j + 0.5) / 4) * Math.PI) * 0.22, z);
    }
    b.swayParent = 0;
    b.lamp(x * V, 3.6, 12.5, WARM, 4, 0.5);
  }

  // --- Street furniture: the small clutter that makes a Tokyo street feel lived in
  {
    const solid = (x: number, z: number, hx: number, hz: number) => b.block(x - hx, z - hz, x + hx, z + hz);
    // slide parked things along the kerb so they never sit in front of a shop door
    // ...or on top of something already standing there (A-frame menus, planters, other parked bikes).
    // (No voxel reads here: the café stools become crowd seats, and only part of the grid exists in each worker.)
    const dodge = (x0: number, z: number, half = 0.8) => {
      const hit = ([ax, az, bx, bz]: [number, number, number, number], x: number) => ax < x + half + 0.05 && bx > x - half - 0.05 && az < z + 0.3 && bz > z - 0.3;
      const door = (x: number) => b.rooms.some((rm) => Math.abs(rm.door[0] - x) < 0.8 + half && Math.abs(rm.door[1] - z) < 2.4);
      const free = (x: number) => !door(x) && !b.blockers.some((o) => hit(o, x)) && !b.standing.some((o) => hit(o, x));
      // nearest free spot, searching outwards along the kerb; if there is none nearby, it isn't parked there at all
      for (let k = 0; k < 40; k++) {
        const x = x0 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.25;
        if (free(x)) return x;
      }
      return null;
    };
    // parked delivery scooters and bicycles along the north facades of Kaminari Lane
    for (const [x0, col] of [[19.6, k.c.cubRed], [46.8, k.c.vmBlue], [61.4, k.c.cubRed]] as [number, number][]) {
      const x = dodge(x0, 9.42);
      if (x === null) continue;
      b.place(scooter(k, col), x, 0, 9.42, 0);
      solid(x, 9.42, 0.8, 0.22);
    }
    const bx = dodge(39.5, 9.35, 1.2) ?? 39.5;
    for (const x of [bx - 0.8, bx, bx + 0.8]) b.place(bicycle(k, [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed][Math.round(x * 10) % 3]), x, 0, 9.35, 0);
    solid(bx, 9.35, 1.2, 0.2);
    // post box and recycling corner by the konbini
    b.place(postBox(k), 68.9, 0, 9.5, 0);
    solid(68.9, 9.5, 0.4, 0.4);
    b.place(binCorner(k), 69.45, 0, 15.2, 3);
    solid(69.45, 15.2, 0.3, 0.5);
    // convex mirror and bollards at the mouth of Lantern Alley
    b.place(trafficMirror(k), 34.2, 0, 16.3, 0);
    solid(34.2, 16.3, 0.12, 0.12);
    for (const x of [34.9, 36.6]) { b.place(bollard(k), x, 0, 16.15, 0); solid(x, 16.15, 0.12, 0.12); }
    // jizō statues keeping watch beside the hokora
    for (const x of [2.45, 4.35]) { b.place(jizo(k), x, 0, 6.0, 0); solid(x, 6.0, 0.22, 0.22); } // on the gravel, off the temple's stone base
    // café terrace tables on the promenade
    const tablesAt: number[] = [];
    for (const [x0, col] of [[9.6, k.c.fabricRed], [11.4, k.c.fabricWhite], [43.6, k.c.fabricGreen], [45.4, k.c.fabricWhite], [65.2, k.c.fabricOrange]] as [number, number][]) {
      const x = dodge(x0, 38.65, 0.6);
      if (x === null) continue;
      // a table nudged out of a doorway must not land on its neighbour's stool
      if (tablesAt.some((t) => Math.abs(t - x) < 1.4)) continue;
      tablesAt.push(x);
      b.place(cafeTable(k, col), x, 0, 38.65, 0);
      solid(x, 38.65, 0.3, 0.3);
      b.place(stool(k, k.c.woodLight), x + 0.6, 0, 38.65);
      b.stools.push([x + 0.6, 38.65, -Math.PI / 2]);
    }
    // a scooter and planters on the far bank lane
    // (in front of the far bank's row houses, whose fronts are at z = 54)
    b.place(scooter(k, k.c.cubCream), 24.3, 0, 53.7, 2); // beside the cherry tree, not on its trunk
    solid(24.3, 53.7, 0.8, 0.22);
    for (const x of [40, 48.5, 57]) { b.place(plantPot(k, 'shrub', Math.round(x)), x, 0, 53.5); solid(x, 53.5, 0.3, 0.3); }
  }

  // --- Lucky cats (hidden clue statues)
  const manekis: [number, number, number][] = [
    [3.15, 0, 6.3], // in front of the little hokora shrine
    [34.3, 0, 36.6], // tucked beside the crates at the south end of the alley
    [64.15, 0, 52.6], // by the stone lantern under the cherry trees on the far bank
  ];
  for (const m of manekis) b.place(manekiNeko(k), m[0], m[1], m[2], 1);

  // --- Hidden door (two variants toggled at runtime), on the end wall at x = 45.5 m facing -x
  {
    const closed = new Prop(2, 20, 16);
    for (let z = 0; z < 16; z++) for (let y = 0; y < 20; y++) closed.set(0, y, z, z % 3 === 0 ? k.c.woodDark : k.c.charcoal);
    closed.box(0, 6, 7, 0, 7, 8, k.c.steelDark);
    const open = new Prop(3, 22, 18);
    open.box(2, 0, 0, 2, 21, 17, k.c.woodDark);
    open.box(1, 0, 3, 1, 15, 14, k.c.windowWarm);
    open.box(1, 0, 2, 1, 15, 2, k.c.woodDark); open.box(1, 0, 15, 1, 15, 15, k.c.woodDark);
    open.box(0, 16, 1, 1, 17, 16, k.c.woodDark);
    open.box(0, 9, 3, 0, 15, 14, (_x, _y, z) => (z % 4 === 0 ? 0 : k.c.indigo));
    open.box(0, 11, 7, 0, 13, 10, k.c.norenWhite);
    const lx = 182 * V, lz = 122 * V;
    b.place(closed, lx - 0.125, 0, lz, 0, 'door-closed');
    b.place(open, lx - 0.19, 0, lz, 0, 'door-open');
    b.place(lantern(k, k.c.lanternWhite, 5, 7, 999), lx - 0.55, 1.95, lz + 1.4, 0, 'door-open');
    b.place(lantern(k, k.c.lanternWhite, 5, 7, 998), lx - 0.55, 1.95, lz - 1.4, 0, 'door-open');
  }

  // --- Daruma dolls: one in the bookshop's secret room, the rest spread over different kinds of shop
  const darumas: [number, number, number][] = [];
  {
    const spots = b.darumaSpots;
    const chosen: DarumaSpot[] = spots.filter((s) => s.secret).slice(0, 1);
    const far = (p: [number, number, number]) => chosen.every((q) => Math.hypot(q.pos[0] - p[0], q.pos[2] - p[2]) > 6);
    const order: RoomKind[] = ['izakaya', 'konbini', 'bakery', 'florist', 'fish', 'cafe', 'pharmacy', 'shop', 'books', 'soba', 'kissa'];
    for (const kd of order) {
      if (chosen.length >= 8) break;
      // prefer the second shop of a kind, so the first one the player walks into is not the only place to look
      const of = spots.filter((s) => s.kind === kd && !s.secret);
      const s = [...of.slice(1), ...of.slice(0, 1)].find((q) => far(q.pos));
      if (s) chosen.push(s);
    }
    for (let i = 0; chosen.length < 8 && i < spots.length; i++) if (!chosen.includes(spots[i]) && far(spots[i].pos)) chosen.push(spots[i]);
    chosen.forEach((s, i) => {
      b.place(daruma(b.ic), s.pos[0], s.pos[1], s.pos[2], i % 4);
      darumas.push([s.pos[0], s.pos[1], s.pos[2]]);
    });
  }
  stalls.push(...b.stallAnchors);

  // the city around the old district
  const city = buildCity(b);

  const anchors: Anchors = {
    spawn: [11.2, 0, 12.5],
    stalls,
    hiddenDoor: { stand: [44.6, 30.5], label: [45.0, 3.2, 30.5], reveal: [43.0, 0, 30.5] },
    interiorExit: [0, 0],
    interiorSpawn: [0, 0, 0],
    chef: [0, 0, 0],
    counterStand: [0, 0],
    manekis,
    graph: { nodes: OLD_GRAPH.nodes.map(([x, z]) => [x, z] as [number, number]), edges: OLD_GRAPH.edges.map(([i, j]) => [i, j] as [number, number]) },
    idlers: [
      { id: 'obaachan', pos: [6.6, 0, 9.6] },
      { id: 'salaryman', pos: [36.6, 0, 27.2] },
      { id: 'student', pos: [22.0, 0, 40.0] },
      { id: 'fisherman', pos: [44.5, 0, 50.5] },
      { id: 'tourist', pos: [20.0, 0, 15.2] },
      { id: 'florist', pos: [58.5, 0, 9.7] },
    ],
    benches: b.benches,
    stools: b.stools,
    cats: [[34.4, 0, 30.4], [12.2, 0, 40.2], [49.4, 0, 52.3], ...city.cats],
    emitters: b.emitters,
    vending,
    blockers: b.blockers,
    koiArea: [1, 43.4, 71, 49.6],
    // fireflies over the canal bank on summer nights, and the cherry petals drifting along it
    fireflies: (() => { const fr = rng(7); return Array.from({ length: 46 }, () => [fr() * 70 + 1, 0.6 + fr() * 1.2, 41 + fr() * 13] as [number, number, number]); })(),
    petals: [0, 36, 72, 54],
    rooms: b.rooms,
    hotels: b.hotels,
    darumas,
    secret: b.secret,
    occluders: b.occluders,
    wires: b.wires,
  };

  // nothing to sit on, sleep on or buy from behind the town's edge
  {
    const inside = (x: number, z: number) => !tokyoBeyond(x, z);
    anchors.benches = anchors.benches.filter(([x, z]) => inside(x, z));
    anchors.stools = anchors.stools.filter(([x, z]) => inside(x, z));
    anchors.cats = anchors.cats.filter(([x, , z]) => inside(x, z));
    anchors.vending = anchors.vending.filter(([x, , z]) => inside(x, z));
  }

  // join the city's street graph onto the old district's (negative indices name old nodes)
  {
    const base = anchors.graph.nodes.length;
    anchors.graph.nodes.push(...city.nodes);
    const id = (i: number) => (i < 0 ? -i - 1 : base + i);
    for (const [a, bb] of city.edges) anchors.graph.edges.push([id(a), id(bb)]);
    anchors.idlers.push(...city.idlers);
  }

  // shop rooms: things indoors only stir, but still sway when someone brushes past
  for (const bd of b.sway) {
    const vx = bd.pivot[0] / V, vy = bd.pivot[1] / V + G - 0.5, vz = bd.pivot[2] / V;
    if (b.indoor.some(([x0, y0, z0, x1, y1, z1]) => vx >= x0 && vx <= x1 + 1 && vy >= y0 && vy <= y1 + 1 && vz >= z0 && vz <= z1 + 1)) bd.amp *= INDOOR_SWAY;
  }
  const s0 = b.sway.length;
  const interior = buildInterior(b, anchors);
  for (let i = s0; i < b.sway.length; i++) b.sway[i].amp *= INDOOR_SWAY;
  return { grid: g, pal: b.pal, props: b.props, lamps: b.lamps, anchors, interior, indoor: b.indoor, sway: b.sway, swayCells: b.swayCells, navTop: (x, z) => {
    // on the Inari hill the ground follows the slope: looked for a metre over it, so no treetop or bush is ground
    if (beyondCell(x, z)) return 0;
    const h = hillAt(x, z);
    return h > 0 ? G + h + 4 : G + 8;
  } };
}

/** Indoors there is only a draught. */
const INDOOR_SWAY = 0.25;


// ---------------------------------------------------------------------------------------------
// Kakurega: the hidden sushi counter, a dollhouse diorama with the two camera-facing walls removed.

function buildInterior(b: Builder, anchors: Anchors): BuildResult['interior'] {
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
  // floor slab and tatami / stone
  g.box(0, 0, 0, ISX - 1, G - 1, ISZ - 1, c.earth);
  for (let z = 0; z < ISZ; z++) for (let x = 0; x < ISX; x++) {
    const tat = z < 20;
    g.set(x, G - 1, z, tat ? ((x % 8 === 0 || z % 16 === 0) ? c.tatamiEdge : c.tatami) : ((x + z) % 2 ? c.granite : c.graniteDark));
  }
  // back walls (x = 0 side and z = 0 side), the other two are open to the camera
  g.box(0, G, 0, 1, G + 15, ISZ - 1, c.plaster);
  g.box(0, G, 0, ISX - 1, G + 15, 1, c.plaster);
  for (let z = 4; z < ISZ; z += 10) g.box(2, G, z, 2, G + 15, z, c.woodDark);
  for (let x = 4; x < ISX; x += 10) g.box(x, G, 2, x, G + 15, 2, c.woodDark);
  g.box(0, G + 14, 0, ISX - 1, G + 15, 2, c.woodDark);
  g.box(0, G + 14, 0, 2, G + 15, ISZ - 1, c.woodDark);
  // shoji windows glowing
  g.box(0, G + 4, 10, 1, G + 11, 20, (x, y, z) => (x === 1 && (y % 3 === 0 || z % 3 === 0) ? c.woodDark : c.shoji));
  g.box(0, G + 4, 30, 1, G + 11, 40, (x, y, z) => (x === 1 && (y % 3 === 0 || z % 3 === 0) ? c.woodDark : c.shoji));
  // tokonoma alcove with a hanging scroll and ikebana
  g.box(44, G, 2, 56, G + 12, 4, c.plaster);
  g.box(44, G, 2, 56, G + 1, 6, c.woodDark);
  place(toProp(picture(paintColors(b), 'fuji', 10, 16, 7, true), 'z', false), 50.5 * V, 1.0, 5 * V + 0.0625);
  // hinoki counter (L-shaped) with chef area behind
  g.box(8, G, 22, 44, G + 2, 25, c.hinoki);
  g.box(8, G + 3, 21, 44, G + 3, 26, c.counterTop);
  g.box(8, G, 22, 44, G, 25, c.woodDark);
  // chef's prep shelf against the back wall
  g.box(6, G, 6, 44, G + 3, 10, c.woodMid);
  g.box(6, G + 4, 6, 44, G + 4, 10, c.hinoki);
  // sake bottles & neta case
  const bottles = [k.c.bottleBrown, k.c.bottleGreen, k.c.white, k.c.navy];
  for (let x = 8; x < 42; x += 3) {
    const col = bottles[(x / 3) % 4 | 0];
    g.box(x, G + 9, 2, x, G + 11, 3, col);
  }
  g.box(6, G + 8, 2, 44, G + 8, 4, c.hinoki);
  // the neta case, one cell tall and open in the middle where the chef hands the plate across
  for (const [x0, x1] of [[12, 21], [32, 40]]) g.box(x0, G + 4, 21, x1, G + 4, 22, c.glassLit);
  // stools along the counter
  for (let i = 0; i < 6; i++) place(stool(k, k.c.woodDark), (10.5 + i * 5.5) * V, 0, 30 * V);
  // lanterns & lights
  place(lantern(k, k.c.lanternWhite, 5, 7, 501), 18 * V, 2.4, 23.5 * V);
  place(lantern(k, k.c.lanternWhite, 5, 7, 502), 34 * V, 2.4, 23.5 * V);
  lamp(18 * V, 2.5, 23.5 * V, WARM, 6, 1.4);
  lamp(34 * V, 2.5, 23.5 * V, WARM, 6, 1.4);
  lamp(30 * V, 2.0, 8 * V, WHITEWARM, 6, 0.8);
  lamp(4 * V, 2.2, 15 * V, WHITEWARM, 4, 0.6);
  lamp(4 * V, 2.2, 35 * V, WHITEWARM, 4, 0.6);
  lamp(50 * V, 2.2, 6 * V, WARM, 4, 0.6);
  place(plantPot(k, 'pine', 503), 50 * V, 0.5, 5 * V);
  place(plantPot(k, 'bamboo', 504), 58 * V, 0, 40 * V);
  place(plantPot(k, 'bamboo', 505), 4 * V, 0, 44 * V);
  // food on the counter
  place(buildFood('nigiri', b.pal), 22.5 * V, 1.0, 24 * V, 2);
  place(buildFood('tamagoyaki', b.pal), 31.5 * V, 1.0, 24 * V, 2);
  // entrance door frame (front-right open side)
  g.box(56, G, 44, 63, G + 12, 47, c.cedar);
  g.box(58, G, 44, 61, G + 9, 44, c.shoji);

  anchors.interiorSpawn = [ox + 14.75, 0, oz + 10.0];
  anchors.interiorExit = [ox + 14.9, oz + 10.6];
  anchors.chef = [ox + 6.5, 0, oz + 4.4];
  anchors.counterStand = [ox + 6.5, oz + 7.3];
  return { grid: g, props, lamps };
}
