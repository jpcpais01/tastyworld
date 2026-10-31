import { hash3 } from './grid';
import { Prop } from './props';
import { V, G } from './layout';
import { Builder, WARM, WHITEWARM } from './tokyo';
import type { Beam } from '../engine/shafts';
import { paintColors, toProp, altarpiece, apostle, ceilingScene, sideAltar } from './paintings';

/**
 * The great interiors one walks into straight from the street: Sant'Andrea's nave in Amalfi and the prayer halls of
 * Istanbul's mosques. Everything here is world voxels and props in the chunk meshes (no extra draw calls): the hall's
 * insides are listed as an inner box, so the streamer only draws them near the player, its shell stays a shell. The
 * light that falls through the windows is drawn by engine/shafts.ts from the beams each hall lists.
 *
 * Voxel coordinates are builder voxels (x * V metres), like the city builders'. Placement never reads the grid:
 * every worker builds the same anchors and only keeps the voxels of its own strip.
 */

/** 'sit' is on a seat (y is its top); 'kneel' and 'sujud' (the prayer, going down to the carpet) are on the floor. */
export type HallPose = 'sit' | 'kneel' | 'sujud' | 'pray' | 'bow' | 'idle' | 'browse' | 'photo';

export interface HallAnchor {
  id: string;
  kind: 'church' | 'mosque';
  /** Floor plan of the hall's air (metres), its floor and the top of its interior. */
  rect: [number, number, number, number];
  floor: number;
  top: number;
  /** Voxel boxes (x0, y0, z0, x1, y1, z1, inclusive) whose contents are drawn near the player only. */
  inner: [number, number, number, number, number, number][];
  /** Windows the sun shines in through. */
  beams: Beam[];
  /** People who keep to the hall: where (y is the seat for sitters), facing which way, what they do. */
  people: { pos: [number, number, number]; face: number; seed: number; pose: HallPose; alt?: HallPose }[];
}

/** How high over its floor the iso cutaway opens a great hall (metres): the arcades, the mihrab and the altar stay. */
export const HALL_ROOM = 6;
/** How high the Duomo's far walls stand when the cutaway opens it (metres over its floor): to the aisles' vaults. */
export const DUOMO_WALLS = 40 * V;
/** And a mosque's: to its painted ceiling (the last layer of air is TOP = Y + H - 2). */
export const mosqueWalls = (H: number) => (H - 1) * V;

const pm = (v: number, m: number) => ((v % m) + m) % m;
const yM = (y: number) => (y - G) * V;

const cache = new WeakMap<Builder, ReturnType<typeof makeColors>>();
function colors(b: Builder) {
  let k = cache.get(b);
  if (!k) cache.set(b, (k = makeColors(b)));
  return k;
}

function makeColors(b: Builder) {
  const a = (hex: number, vary = 0.05, o: { emit?: number; night?: boolean } = {}) => b.pal.add(hex, { vary, ...o });
  const gl = (hex: number, emit: number) => b.pal.add(hex, { glass: true, emit });
  return {
    // stone, stucco and gilding
    marble: a(0xefebe2, 0.035), marbleWarm: a(0xe7ddc9, 0.04), marbleGrey: a(0xbab4aa, 0.05), marbleVein: a(0xa39d94, 0.06), marbleDark: a(0x5d5955, 0.05),
    rosso: a(0x973a30, 0.05), rossoDeep: a(0x6c2621, 0.05), verde: a(0x355f4c, 0.05), giallo: a(0xd5af67, 0.05), porphyry: a(0x6b2b35, 0.04), serpentine: a(0x2e5a3a, 0.04),
    stucco: a(0xf3eee3, 0.025), stuccoShade: a(0xdcd3c1, 0.03), cream: a(0xece2cd, 0.03),
    gold: a(0xd8ad45, 0.05, { emit: 0.07 }), goldDeep: a(0xa47a29, 0.05, { emit: 0.03 }), goldLight: a(0xf2d47d, 0.04, { emit: 0.12 }),
    // the painters' colours
    pSky: a(0x87a7c9, 0.05), pSkyDeep: a(0x4a6d9f, 0.05), pCloud: a(0xeee6d7, 0.04), pGlow: a(0xf4d89b, 0.04, { emit: 0.08 }), pRed: a(0xac3b30, 0.05), pBlue: a(0x2f4f8b, 0.05),
    pGreen: a(0x587b4b, 0.05), pFlesh: a(0xddaf87, 0.04), pFleshShade: a(0xb4805e, 0.04), pWhiteShade: a(0xd2cbbd, 0.03), pDark: a(0x3b2e27, 0.05), pOchre: a(0xbe8b3f, 0.05), pBrown: a(0x6f4b2d, 0.06), pWhite: a(0xf3efe6, 0.03),
    // wood, cloth, wax and metal
    walnut: a(0x5c3b25, 0.06), walnutDark: a(0x3d2718, 0.06), velvet: a(0x8b2027, 0.05), wax: a(0xf4ebd3, 0.03), flame: a(0xffc964, 0.02, { emit: 1 }),
    bronze: a(0x7e5c2e, 0.06), iron: a(0x2f2c2a, 0.04), tin: a(0xc8cbcf, 0.04), tinDark: a(0x7c8086, 0.04), water: a(0x6f8d97, 0.03),
    // glass: the stained windows glow a little by day as well
    sgRed: gl(0xc43b3b, 0.5), sgBlue: gl(0x3163c2, 0.5), sgGold: gl(0xeabb4b, 0.55), sgGreen: gl(0x3f9d63, 0.5), sgWhite: gl(0xf2ead2, 0.45), sgViolet: gl(0x7347a9, 0.45), sgTurq: gl(0x31a9b0, 0.5),
    lampGlass: a(0xffd78c, 0.03, { emit: 0.95 }), lampRed: a(0xd33c2c, 0.03, { emit: 0.9 }), crystal: gl(0xf3f1ea, 0.35),
    // carpets, tiles and painted plaster of the mosques
    carpet: a(0x9c2b2d, 0.045), carpetDeep: a(0x741a20, 0.045), carpetGold: a(0xcba55d, 0.045), carpetBlue: a(0x24406d, 0.045), carpetCream: a(0xe3d2a7, 0.04), carpetGreen: a(0x2f5e48, 0.045),
    tile: a(0xf3f1e9, 0.025), cobalt: a(0x1f4ca4, 0.035), turq: a(0x2ba9a5, 0.035), coral: a(0xc73b2f, 0.035), leaf: a(0x3d8b4d, 0.04), navy: a(0x18316b, 0.035),
    paint: a(0xf0e5cd, 0.025), paintRed: a(0xa94b3c, 0.035), paintIndigo: a(0x2d416e, 0.035), paintOchre: a(0xca9b53, 0.035),
    callig: a(0x1e4b38, 0.035), calligDark: a(0x1c1c23, 0.035), pearl: a(0xeae7dd, 0.03), limeIn: a(0xe8e0ce, 0.035), brass: a(0xc5a14f, 0.05, { emit: 0.04 }),
  };
}
type K = ReturnType<typeof makeColors>;

// ------------------------------------------------------------------------------------------- shared pieces

/**
 * A painted canvas, w x h cells (u across, v up from the bottom): a sky going from deep blue to cloud and gold
 * glory, saints in coloured robes on a bank of cloud, cherubs. Seen from a few metres it reads as a painting.
 */
function painting(k: K, u: number, v: number, w: number, h: number, seed: number): number {
  const t = v / Math.max(1, h - 1);
  const n = hash3(u >> 1, v >> 1, seed);
  let c = t > 0.72 ? k.pSkyDeep : t > 0.38 ? k.pSky : k.pCloud;
  if (n < 0.2 && t < 0.85 && t > 0.15) c = k.pCloud;
  const gx = w * (0.3 + 0.4 * hash3(seed, 1, 2)), gy = h * 0.74;
  const glow = Math.hypot(u + 0.5 - gx, (v + 0.5 - gy) * 1.3);
  const R = Math.min(w, h) * 0.2;
  if (glow < R) c = glow < R * 0.45 ? k.goldLight : k.pGlow;
  // the figures standing on the clouds
  const nf = w >= 14 ? 3 : w >= 9 ? 2 : 1;
  const robes = [k.pRed, k.pBlue, k.pGreen, k.pOchre, k.pWhite];
  for (let i = 0; i < nf; i++) {
    const fx = w * (i + 0.5) / nf + (hash3(seed, i, 7) - 0.5) * 1.5;
    const rx = Math.max(1, w / (nf * 3.6)), ry = h * 0.26, fy = h * 0.3;
    const dx = (u + 0.5 - fx) / rx, dy = (v + 0.5 - fy) / ry;
    const head = Math.hypot(u + 0.5 - fx, (v + 0.5 - (fy + ry + Math.max(0.9, rx * 0.55)))) <= Math.max(0.9, rx * 0.6);
    if (head) return k.pFlesh;
    const halo = Math.abs(Math.hypot(u + 0.5 - fx, (v + 0.5 - (fy + ry + rx * 0.6))) - Math.max(1.5, rx * 0.95)) < 0.5;
    if (halo && (seed + i) % 2 === 0 && v > fy + ry) return k.goldLight;
    if (dx * dx + dy * dy <= 1) return robes[Math.floor(hash3(seed, i, 3) * robes.length)];
  }
  if (t < 0.12) return n < 0.5 ? k.pBrown : k.pGreen;
  // a cherub or two in the sky
  if (h > 8 && hash3(u, v, seed + 9) < 0.02 && t > 0.5) return k.pFlesh;
  return c;
}

/** A gilt frame round a canvas (proud of the wall where `d` is the cell in front of it). */
function framed(k: K, u: number, v: number, w: number, h: number, seed: number): number {
  if (u === 0 || v === 0 || u === w - 1 || v === h - 1) return (u + v) % 3 === 0 ? k.goldLight : k.gold;
  return painting(k, u - 1, v - 1, w - 2, h - 2, seed);
}

/** A candlestick on its base, with its candle and the flame, for altars and stands (fine voxels). */
function candlestick(k: K, h: number): Prop {
  const p = new Prop(3, h + 4, 3);
  p.box(0, 0, 0, 2, 0, 2, k.gold);
  p.box(1, 1, 1, 1, h - 1, 1, (_x, y) => (y % 3 === 0 ? k.goldLight : k.gold));
  p.box(0, h - 1, 0, 2, h - 1, 2, k.gold);
  p.box(1, h, 1, 1, h + 2, 1, k.wax);
  p.set(1, h + 3, 1, k.flame);
  return p;
}

/** A crucifix on a little stepped base. */
function crucifix(k: K): Prop {
  const p = new Prop(7, 14, 3);
  p.box(1, 0, 0, 5, 0, 2, k.gold);
  p.box(2, 1, 1, 4, 1, 1, k.gold);
  p.box(3, 2, 1, 3, 13, 1, k.goldDeep);
  p.box(0, 10, 1, 6, 10, 1, k.goldDeep);
  p.box(3, 6, 0, 3, 10, 0, k.pFlesh);
  p.box(2, 10, 0, 4, 10, 0, k.pFlesh);
  p.set(3, 11, 0, k.pFlesh);
  return p;
}

/**
 * The great crucifix that hangs over the presbytery facing the pews: a gilt cross with trefoil ends and its title,
 * the body pale against the gold, head bowed under the crown of thorns, the white loincloth (front at z = 0).
 */
function greatCrucifix(k: K): Prop {
  const p = new Prop(15, 24, 3);
  const cross = (x: number, y: number) => (x === 6 || x === 8 || y === 15 || y === 19 ? k.goldDeep : k.gold);
  p.box(6, 0, 1, 8, 23, 2, cross);
  p.box(0, 15, 1, 14, 19, 2, (x, y) => (y === 16 || y === 18 ? cross(x, y) : y === 15 || y === 19 ? (x < 2 || x > 12 ? k.goldLight : 0) : k.gold));
  p.box(1, 16, 1, 13, 18, 2, cross);
  for (const [x, y] of [[0, 17], [14, 17], [7, 23]] as const) p.box(Math.max(0, x - 1), y - 1, 1, Math.min(14, x + 1), Math.min(23, y + 1), 2, k.goldLight);
  // the title over his head
  p.box(5, 21, 0, 9, 22, 0, (x) => (x === 5 || x === 9 ? k.gold : k.pWhite));
  // the body: arms along the beam to the hands, the torso, the cloth, the legs together and the feet
  p.box(2, 17, 0, 5, 17, 0, k.pFlesh); p.box(9, 17, 0, 12, 17, 0, k.pFlesh);
  p.set(1, 17, 0, k.pFlesh); p.set(13, 17, 0, k.pFlesh);
  p.box(6, 11, 0, 8, 16, 0, (x, y) => (x === 8 || y === 11 ? k.pFleshShade : k.pFlesh));
  p.box(6, 9, 0, 8, 10, 0, (x) => (x === 8 ? k.pWhiteShade : k.pWhite));
  p.set(5, 10, 0, k.pWhite);
  p.box(7, 3, 0, 8, 8, 0, (x) => (x === 8 ? k.pFleshShade : k.pFlesh));
  p.box(7, 2, 0, 7, 2, 0, k.pFleshShade);
  p.box(7, 18, 0, 8, 19, 0, (x, y) => (y === 19 && x === 7 ? k.pBrown : k.pFlesh));
  p.box(6, 19, 0, 9, 19, 0, (x) => (x === 7 ? k.pBrown : x === 8 ? k.pBrown : 0));
  p.set(9, 20, 0, k.pDark); p.set(6, 20, 0, k.pDark);
  return p;
}

/** A tiered stand of votive candles, a few of them lit. */
function votives(k: K, seed: number): Prop {
  const p = new Prop(10, 9, 5);
  p.box(0, 0, 0, 9, 0, 4, k.iron);
  p.box(0, 1, 0, 0, 4, 4, k.iron); p.box(9, 1, 0, 9, 4, 4, k.iron);
  for (const [y, z] of [[4, 1], [5, 3]] as const) {
    p.box(0, y, z - 1, 9, y, z, k.iron);
    for (let x = 1; x < 9; x += 2) {
      if (hash3(x, y, seed) < 0.25) continue;
      p.set(x, y + 1, z, k.wax);
      if (hash3(x, z, seed + 1) < 0.7) p.set(x, y + 2, z, k.flame);
    }
  }
  return p;
}

/** A crystal and gilt chandelier: a baluster, two tiers of arms with candles, drops of crystal. */
function chandelier(k: K, seed: number): Prop {
  const p = new Prop(17, 16, 17);
  const c = 8;
  p.box(c, 0, c, c, 15, c, (_x, y) => (y % 4 === 0 ? k.goldLight : k.gold));
  p.ellipsoid(c + 0.5, 4.5, c + 0.5, 2, 2.5, 2, (x, y, z) => (hash3(x, y, z + seed) < 0.3 ? k.crystal : k.gold));
  for (const [r, y, n] of [[7, 5, 10], [4.5, 9, 6]] as const)
    for (let i = 0; i < n; i++) {
      const an = (i / n) * Math.PI * 2, ex = Math.round(c + Math.cos(an) * r), ez = Math.round(c + Math.sin(an) * r);
      for (let s = 1; s <= r; s++) p.set(Math.round(c + Math.cos(an) * s), y - (s === Math.round(r) ? 0 : s > r * 0.6 ? 1 : 0), Math.round(c + Math.sin(an) * s), k.gold);
      p.set(ex, y + 1, ez, k.goldLight);
      p.set(ex, y + 2, ez, k.wax);
      p.set(ex, y + 3, ez, k.flame);
      p.set(ex, y - 1, ez, k.crystal);
      if (y === 5) p.set(ex, y - 2, ez, k.crystal);
    }
  p.set(c, 0, c, k.crystal);
  return p;
}

/** A chain (or a rope), `h` fine voxels long, hanging from the top. */
function chain(k: K, h: number, col?: number): Prop {
  const p = new Prop(1, h, 1);
  p.box(0, 0, 0, 0, h - 1, 0, (_x, y) => (y % 2 ? (col ?? k.iron) : (col ?? k.iron)));
  return p;
}

/** A pew, `len` fine voxels long, facing -x: the seat 0.5 m up, the back on the +x side, carved ends. */
function pew(k: K, len: number): Prop {
  const p = new Prop(4, 8, len);
  p.box(0, 3, 0, 2, 3, len - 1, k.walnut);
  p.box(0, 0, 1, 0, 2, len - 2, k.walnutDark);
  p.box(3, 0, 0, 3, 7, len - 1, (_x, y) => (y === 7 ? k.walnutDark : k.walnut));
  for (const z of [0, len - 1]) p.box(0, 0, z, 3, 6, z, (x, y) => (y === 6 && x < 1 ? 0 : y > 4 && x === 0 ? 0 : k.walnutDark));
  // a little brass plate on each end, a kneeler along the front
  p.set(1, 4, 0, k.brass); p.set(1, 4, len - 1, k.brass);
  return p;
}

/** A rahle: the folding X-shaped Qur'an stand of carved wood, an open book on it. */
function rahle(k: K): Prop {
  const p = new Prop(4, 5, 5);
  for (let i = 0; i < 4; i++) { p.set(0, i, 1 + (i & 1), k.walnut); p.set(3, i, 1 + (i & 1), k.walnut); p.set(0, i, 3 - (i & 1), k.walnut); p.set(3, i, 3 - (i & 1), k.walnut); }
  p.box(0, 3, 0, 3, 3, 1, k.walnutDark); p.box(0, 3, 3, 3, 3, 4, k.walnutDark);
  p.box(0, 4, 0, 3, 4, 1, k.pearl); p.box(0, 4, 3, 3, 4, 4, k.pearl);
  p.set(1, 4, 1, k.pDark); p.set(2, 4, 3, k.pDark);
  return p;
}

/** A bronze figure of Saint Andrew with his saltire cross, on a plinth. */
function bronzeSaint(k: K): Prop {
  const p = new Prop(9, 22, 7);
  p.box(1, 0, 1, 7, 2, 5, k.marble);
  p.box(1, 3, 1, 7, 3, 5, k.gold);
  p.ellipsoid(4.5, 9, 3.5, 2, 6, 1.6, k.bronze);
  p.ellipsoid(4.5, 16.5, 3.5, 1.3, 1.5, 1.3, k.bronze);
  for (let i = 0; i < 9; i++) { p.set(i, 5 + i * 1.6, 1, k.bronze); p.set(8 - i, 5 + i * 1.6, 1, k.bronze); }
  p.box(3, 18, 3, 6, 18, 4, k.goldLight);
  return p;
}

// ------------------------------------------------------------------------------------------- Sant'Andrea

export interface DuomoFrame {
  /** The nave's voxel box (walls included), the floor layer, the height of its walls, the front screen and the door's middle. */
  X0: number; X1: number; Z0: number; Z1: number; Y: number; H: number; FX: number; zc: number;
  /** Amalfi's roof tiles, to close the roof up to the front screen. */
  roof: [number, number];
}

/**
 * Inside the Duomo: the baroque rebuilding of the 1700s inside the Arab-Norman shell. A nave of white and gold on
 * arcades of marble piers between two aisles, the gilded coffered ceiling with its painted canvases, the apse with
 * its conch of gold, the high altar under the painting of the saint's martyrdom on his cross, the two ambos of
 * Cosmatesque mosaic and the paschal candlesticks, choir stalls, side altars, confessionals and votive candles in
 * the aisles, the organ over the bronze doors, walnut pews, crystal chandeliers, and through a balustraded well in
 * the north aisle a glimpse of the frescoed crypt where Andrew's relics lie under his bronze statue.
 */
export function duomoInterior(b: Builder, f: DuomoFrame): HallAnchor {
  const k = colors(b);
  const g = b.grid;
  const { X0, X1, Z0, Z1, Y, H, FX, zc } = f;
  const floorY = yM(Y);
  // the hall's air: walls of three voxels, the front screen closes it at the east
  const IX0 = X0 + 3, IX1 = X1, IZ0 = Z0 + 3, IZ1 = Z1 - 3;
  // nave between the arcades, aisles outside them
  const NZ0 = IZ0 + 17, NZ1 = IZ1 - 17;
  const cz = (NZ0 + NZ1 + 1) / 2;
  const CEIL = Y + 68, AISLE = Y + Math.round(DUOMO_WALLS / V), ENT = Y + 56;
  // the apse (a conch of radius AR on the nave's axis) and the presbytery raised two steps in front of it
  const AX = IX0 + 16, AR = 19;
  const PX0 = IX0 + 30, PRES = PX0 - 1;
  const piers: number[] = [];
  for (let px = PX0; px + 3 <= IX1 - 6; px += 16) piers.push(px);
  const lastPier = piers[piers.length - 1];
  const m = (v: number) => v * V;
  const inApse = (x: number, y: number, z: number) => (y < Y + 44 ? Math.hypot(x + 0.5 - AX, z + 0.5 - cz) <= AR : Math.hypot(x + 0.5 - AX, y - (Y + 44), z + 0.5 - cz) <= AR);
  // the crypt under the north aisle, seen down a well
  const CW = { x0: PX0 - 13, x1: PX0 - 6, z0: IZ0 + 3, z1: IZ0 + 10 };
  const CR = { x0: IX0 + 1, x1: PX0 - 2, z0: IZ0, z1: NZ0 + 4, y0: Y - 14, y1: Y - 4 };

  const hall: HallAnchor = {
    id: 'duomo', kind: 'church',
    rect: [m(IX0), m(IZ0), m(IX1 + 1), m(IZ1 + 1)], floor: floorY, top: yM(CEIL),
    inner: [[IX0, Y, IZ0, IX1, CEIL - 1, IZ1], [CR.x0, CR.y0, CR.z0, CR.x1, CR.y1, CR.z1]],
    beams: [], people: [],
  };
  b.indoor.push([IX0, Y, IZ0, IX1, CEIL - 1, IZ1]);
  b.indoor.push([CR.x0, CR.y0, CR.z0, CR.x1, CR.y1, CR.z1]);

  // ---- what every worker registers: props, lamps, seats, people, beams
  // pews in two blocks either side of the middle aisle, facing the altar
  const PZ = [[NZ0 + 3, Math.floor(cz) - 5], [Math.ceil(cz) + 4, NZ1 - 3]] as const;
  const rows: number[] = [];
  for (let x = PX0 + 6; x <= IX1 - 22; x += 5) rows.push(x);
  rows.forEach((xr, ri) => {
    for (const [z0, z1] of PZ) {
      const len = (z1 - z0 + 1) * 2;
      const bx = m(xr + 1), bz = m((z0 + z1 + 1) / 2);
      b.place(pew(k, len), bx, floorY, bz);
      b.block(m(xr), m(z0), m(xr + 2), m(z1 + 1));
      // a few of the faithful at prayer in the front rows; the other seats are free for whoever comes in
      const half = (z1 - z0 + 1) * V / 4;
      if (ri < 4 && hash3(ri, z0, 41) < 0.7) {
        const sz = bz + (hash3(ri, z0, 43) < 0.5 ? -half : half);
        hall.people.push({ pos: [bx + 0.04, floorY + 0.5, sz], face: -Math.PI / 2, seed: 900 + ri * 7 + z0, pose: 'sit' });
      } else for (const s of [-1, 1]) b.benches.push([bx, bz + s * half, -Math.PI / 2, floorY]);
    }
  });
  // chandeliers down the nave on long chains, the sanctuary lamp over the altar
  for (let i = 0; i < 4; i++) {
    const x = m(PX0 + 12 + i * 22), y = floorY + 3.6;
    b.place(chandelier(k, i), x, y, m(cz));
    b.place(chain(k, Math.round((yM(CEIL - 1) - y - 2) / 0.125)), x, y + 2, m(cz));
    b.lamp(x, y + 0.8, m(cz), WARM, 10, 0.95);
  }
  {
    const x = m(AX + 3), y = floorY + 0.5 + 3.4;
    const lampP = new Prop(3, 4, 3);
    lampP.box(0, 1, 0, 2, 2, 2, k.lampRed); lampP.box(1, 0, 1, 1, 0, 1, k.gold); lampP.box(0, 3, 0, 2, 3, 2, k.gold);
    b.place(lampP, x, y, m(cz));
    b.place(chain(k, Math.round((yM(CEIL - 1) - y - 0.5) / 0.125), k.gold), x, y + 0.5, m(cz));
    b.lamp(x, y, m(cz), [1, 0.4, 0.3], 4, 0.6);
  }
  // the high altar's candles and crucifix, the lamps of the apse
  for (const dz of [-6.5, -4.5, -2.5, 2.5, 4.5, 6.5]) b.place(candlestick(k, 9), m(AX - 2), floorY + 0.5 + 1.0 + 0.25, m(cz + dz));
  // the altar cross turned to the pews, and the great crucifix hung over the presbytery facing them
  b.place(crucifix(k), m(AX - 2), floorY + 0.5 + 1.0 + 1.25, m(cz), 3);
  {
    const x = m(AX + 8), y = floorY + 2.9, top = y + 3.0;
    b.place(greatCrucifix(k), x, y, m(cz), 3);
    b.place(chain(k, Math.round((yM(CEIL - 1) - top) / 0.125), k.gold), x, top, m(cz));
    b.lamp(x + 2.5, floorY + 3.2, m(cz), WARM, 5, 0.5);
  }
  // the paintings: pixel art on fine voxels laid over their canvases (see world/paintings.ts)
  {
    const pc = paintColors(b), F = 0.0625;
    // the altarpiece on the apse wall, facing down the nave (+x)
    const z0 = Math.floor(cz) - 6, z1 = Math.ceil(cz) + 5, y0 = Y + 10, y1 = Y + 34;
    b.place(toProp(altarpiece(pc, (z1 - z0 + 1) * 2, (y1 - y0 + 1) * 2), 'x', true), m(IX0 + 1) + F, yM(y0), m((z0 + z1 + 1) / 2));
    // apostles over the arcades, facing into the nave from both sides
    piers.forEach((px, i) => {
      if (px === lastPier) return;
      for (const [zn, face] of [[NZ0, 1], [NZ1, -1]] as const) {
        const im = apostle(pc, 20, 34, i * 2 + (face > 0 ? 0 : 1));
        b.place(toProp(im, 'z', face < 0), m(px + 10), yM(Y + 35), face > 0 ? m(zn + 1) + F : m(zn) - F);
      }
    });
    // the ceiling's canvases, upright for someone looking up towards the altar
    for (let i = 0; AX + 21 * i + 20 <= IX1; i++)
      b.place(toProp(ceilingScene(pc, i, 20, 36), 'y', true, true), m(AX + 21 * i + 12), yM(CEIL) - 2 * F, m(NZ0 + 20));
    // the side altars' paintings
    [piers[1] + 10, piers[3] + 10].forEach((x, i) => {
      for (const [zw, out] of [[IZ0, 1], [IZ1, -1]] as const)
        b.place(toProp(sideAltar(pc, i * 2 + (out > 0 ? 0 : 1), 12, 28), 'z', out < 0), m(x), yM(Y + 6), out > 0 ? m(zw + 1) + F : m(zw) - F);
    });
  }
  b.lamp(m(AX), floorY + 2.6, m(cz), WARM, 8, 0.85);
  b.lamp(m(IX0 + 2), floorY + 5.5, m(cz), WHITEWARM, 7, 0.6);
  // votive candles and their glow by the side altars, a lamp in each aisle
  const SIDE = [piers[1] + 10, piers[3] + 10];
  for (const x of SIDE) for (const [z, out] of [[IZ0 + 6, 1], [IZ1 - 6, -1]] as const) {
    b.place(votives(k, x + z), m(x + 7), floorY, m(z - out * 2.5), 0);
    b.block(m(x + 6.4), m(z - out * 2.5) - 0.35, m(x + 7.6) + 0.1, m(z - out * 2.5) + 0.35);
    b.lamp(m(x + 7), floorY + 1.2, m(z - out * 2.5), WARM, 4, 0.55);
    b.lamp(m(x), floorY + 2.5, m(z - out * 1.5), WARM, 5, 0.5);
  }
  for (const x of SIDE) b.lamp(m(x), floorY + 6, m(IZ0 + 7), WHITEWARM, 8, 0.4);
  for (const x of SIDE) b.lamp(m(x), floorY + 6, m(IZ1 - 7), WHITEWARM, 8, 0.4);
  // the crypt: its altar candles and the saint
  b.place(bronzeSaint(k), m(CR.x0 + 6), yM(CR.y0), m(IZ0 + 6.5), 1);
  for (const dz of [-2.5, 2.5]) b.place(candlestick(k, 8), m(CR.x0 + 2), yM(CR.y0) + 1.0, m(IZ0 + 6.5 + dz));
  b.lamp(m(CR.x0 + 7), yM(CR.y0) + 2, m(IZ0 + 6.5), WARM, 8, 1.0);
  b.lamp(m((CW.x0 + CW.x1) / 2), yM(CR.y0) + 2.5, m((CW.z0 + CW.z1) / 2), WARM, 6, 0.6);
  b.block(m(CW.x0 - 1), m(CW.z0 - 1), m(CW.x1 + 2), m(CW.z1 + 2));
  // people: at the side altars, at the altar rail, a sacristan, visitors at the back
  hall.people.push(
    { pos: [m(SIDE[0]), floorY, m(IZ0 + 7)], face: Math.PI, seed: 931, pose: 'pray' },
    { pos: [m(SIDE[1] - 1), floorY, m(IZ1 - 7)], face: 0, seed: 932, pose: 'pray' },
    { pos: [m(PX0 + 3), floorY, m(cz - 6)], face: -Math.PI / 2, seed: 933, pose: 'pray' },
    { pos: [m(AX + 6), floorY + 0.5, m(cz + 9)], face: Math.PI / 2 + 0.6, seed: 934, pose: 'idle', alt: 'bow' },
    { pos: [m(IX1 - 10), floorY, m(cz + 3)], face: -Math.PI / 2 + 0.2, seed: 935, pose: 'photo', alt: 'browse' },
    { pos: [m(IX1 - 12), floorY, m(NZ1 - 2)], face: -Math.PI / 2 - 0.4, seed: 936, pose: 'browse', alt: 'idle' },
    { pos: [m(CW.x1 + 3), floorY, m(CW.z0 + 3)], face: -Math.PI / 2, seed: 937, pose: 'browse', alt: 'idle' },
  );
  // the sun: through the rose and the two lancets of the front, and the high windows of the aisles
  hall.beams.push({ x: m(FX + 4), y: yM(Y + 57) + 0.125, z: m(zc + 0.5), w: 14 * V, h: 14 * V, nx: 1, nz: 0, tint: [1, 0.86, 0.72] });
  for (const z0 of [zc - 19, zc + 17]) hall.beams.push({ x: m(FX + 4), y: yM(Y + 55), z: m(z0 + 1.5), w: 0.75, h: 3.4, nx: 1, nz: 0, tint: [0.85, 0.8, 1] });
  for (let x = X0 + 6; x < X1 - 6; x += 12) {
    hall.beams.push({ x: m(x + 2), y: yM(Y + 32), z: m(Z0), w: 1.0, h: 3.0, nx: 0, nz: -1, tint: [1, 0.92, 0.8] });
    hall.beams.push({ x: m(x + 2), y: yM(Y + 32), z: m(Z1 + 1), w: 1.0, h: 3.0, nx: 0, nz: 1, tint: [1, 0.92, 0.8] });
  }
  b.halls.push(hall);

  if (!g.touches(X0, Z0, X1 + 4, Z1)) return hall;

  // ---- the voxels
  g.box(IX0, Y, IZ0, IX1, CEIL - 1, IZ1, 0);
  // the roof runs on up to the front screen (it stopped two voxels short, over what was solid)
  for (let i = 0; i < 9; i++) g.box(X1 - 1, Y + H + 1 + i, Z0 + i, X1, Y + H + 1 + i, Z1 - i, (x) => (x % 2 ? f.roof[0] : f.roof[1]));

  // floors: diagonal chequer in the nave with a runner of yellow lozenges down the middle and a porphyry rota
  // before the steps, a plainer chequer in the aisles, Cosmatesque roundels on the presbytery
  const rotaX = PX0 + 7;
  g.box(IX0, Y - 1, IZ0, IX1, Y - 1, IZ1, (x, _y, z) => {
    const inNave = z >= NZ0 && z <= NZ1;
    if (!inNave) return ((x >> 2) + (z >> 2)) & 1 ? k.marbleGrey : k.marble;
    const dz = Math.abs(z + 0.5 - cz);
    const rr = Math.hypot(x + 0.5 - rotaX, z + 0.5 - cz);
    if (rr < 3.2) return k.porphyry;
    if (rr < 4.2) return k.gold;
    if (rr < 5.2) return pm(Math.floor(Math.atan2(z + 0.5 - cz, x + 0.5 - rotaX) * 4), 2) ? k.serpentine : k.marble;
    if (dz < 4) {
      const q = Math.abs(pm(x, 8) - 3.5) + Math.abs(dz * 1.6 - 3);
      return q < 2.2 ? k.giallo : q < 3 ? k.rosso : k.marble;
    }
    if (dz < 5) return k.rossoDeep;
    return (((x + z) >> 2) + ((x - z) >> 2)) & 1 ? k.marbleGrey : k.marble;
  });
  const cosmati = (x: number, z: number) => {
    const cx0 = IX0 + 4 + Math.round((x - IX0 - 4) / 10) * 10, d = Math.hypot(x + 0.5 - cx0, z + 0.5 - cz);
    if (d < 1.5) return k.porphyry;
    if (d < 2.5) return k.gold;
    if (d < 3.6) return pm(Math.floor(Math.atan2(z + 0.5 - cz, x + 0.5 - cx0) * 3), 2) ? k.serpentine : k.marble;
    if (d < 4.4) return k.rosso;
    return pm(x + z, 3) === 0 ? k.serpentine : pm(x - z, 3) === 0 ? k.porphyry : k.marble;
  };
  // the presbytery platform (two layers) and its step
  g.box(IX0, Y, NZ0, PRES, Y + 1, NZ1, (x, y, z) => {
    if (x < AX && !inApse(x, y, z)) return k.stucco;
    if (y === Y) return k.marbleGrey;
    return x === PRES ? k.goldDeep : cosmati(x, z);
  });
  g.box(PX0, Y, NZ0, PX0 + 1, Y, NZ1, (x) => (x === PX0 ? k.marbleWarm : k.marble));

  // the apse: a curved wall of marble panels and gilt pilasters, then a conch of gold rays and blue stars
  g.box(IX0, Y + 2, NZ0, AX - 1, CEIL - 1, NZ1, (x, y, z) => {
    if (inApse(x, y, z)) return 0;
    const ang = Math.atan2(z + 0.5 - cz, AX - x - 0.5);
    if (y >= Y + 44) {
      const rim = Math.hypot(x + 0.5 - AX, y - (Y + 44), z + 0.5 - cz) < AR + 1.2;
      if (!rim) return k.stucco;
      if (y < Y + 46) return k.goldLight;
      if (hash3(x, y, z) < 0.05) return k.pBlue;
      return pm(Math.floor((ang + Math.PI / 2) * 7.6), 2) ? k.gold : k.goldDeep;
    }
    const pil = pm(Math.floor((ang + Math.PI / 2) * 5.1), 4) === 0;
    if (y > Y + 40) return k.goldDeep;
    if (pil) return y > Y + 37 ? k.goldLight : y < Y + 4 ? k.marbleGrey : k.marbleWarm;
    if (y < Y + 4) return k.marbleGrey;
    const panel = (y - Y) % 12 > 2 && (y - Y) % 12 < 11;
    return panel ? ((y + x + z) % 9 === 0 ? k.rossoDeep : k.rosso) : k.marble;
  });
  // the triumphal arch where the conch opens to the nave, the spandrels above it
  g.box(AX, Y + 44, NZ0, AX + 1, CEIL - 1, NZ1, (_x, y, z) => {
    const r = Math.hypot(y - (Y + 44), z + 0.5 - cz);
    if (r <= AR) return 0;
    if (r < AR + 1.6) return k.goldLight;
    if (r < AR + 2.4) return k.gold;
    return hash3(z, y, 77) < 0.04 ? k.goldLight : k.stucco;
  });
  // the altarpiece on the flat of the apse: the saint on his saltire cross, framed between red marble columns,
  // a broken pediment, and a glory of gilt rays round the dove above it
  {
    const ax = IX0, z0 = Math.floor(cz) - 6, z1 = Math.ceil(cz) + 5, y0 = Y + 10, y1 = Y + 34;
    const w = z1 - z0 + 1, h = y1 - y0 + 1;
    g.box(ax, y0, z0, ax, y1, z1, (_x, y, z) => {
      const u = z - z0, v = y - y0;
      if (u === 0 || v === 0 || u === w - 1 || v === h - 1) return k.goldLight;
      if (u === 1 || v === 1 || u === w - 2 || v === h - 2) return k.gold;
      const s = (u - 1.5) / (w - 3), t = (v - 1.5) / (h - 3);
      // the X-shaped cross, the saint bound to it, the sky breaking over him and the crowd below
      if (Math.abs(s - t) < 0.06 || Math.abs(s - (1 - t)) < 0.06) return t > 0.12 && t < 0.92 ? k.pBrown : k.pDark;
      const dx = (s - 0.5) / 0.1, dy = (t - 0.52) / 0.22;
      if (dx * dx + dy * dy <= 1) return t < 0.45 ? k.pRed : k.pFlesh;
      if (Math.hypot(s - 0.5, (t - 0.8) * 1.4) < 0.07) return k.pFlesh;
      if (Math.hypot(s - 0.5, (t - 0.82) * 1.4) < 0.12 && t > 0.82) return k.goldLight;
      if (t < 0.16) return hash3(u, v, 5) < 0.5 ? [k.pRed, k.pBlue, k.pOchre, k.pGreen][Math.floor(hash3(u >> 1, 1, 9) * 4)] : k.pDark;
      if (Math.hypot(s - 0.7, t - 0.95) < 0.25) return k.pGlow;
      return t > 0.6 ? k.pSkyDeep : hash3(u >> 1, v >> 1, 6) < 0.3 ? k.pCloud : k.pSky;
    });
    for (const zz of [z0 - 3, z1 + 2]) {
      g.box(ax, Y + 2, zz, ax + 1, Y + 36, zz + 1, (_x, y) => (y < Y + 4 ? k.marbleGrey : y > Y + 34 ? k.gold : (y + zz) % 7 === 0 ? k.rossoDeep : k.rosso));
      g.box(ax, Y + 37, zz - 1, ax + 2, Y + 37, zz + 2, k.goldLight);
    }
    g.box(ax, Y + 37, z0 - 4, ax + 2, Y + 38, z1 + 3, (_x, y) => (y === Y + 38 ? k.goldLight : k.gold));
    // the broken pediment: two raking halves that stop short of the middle
    for (let i = 0; i < 5; i++) {
      g.box(ax, Y + 39 + i, z0 - 4 + i * 2, ax + 1, Y + 39 + i, z0 - 3 + i * 2, k.gold);
      g.box(ax, Y + 39 + i, z1 + 2 - i * 2, ax + 1, Y + 39 + i, z1 + 3 - i * 2, k.gold);
    }
    const gy = Y + 49;
    for (let y = gy - 6; y <= gy + 6; y++) for (let z = Math.floor(cz) - 7; z <= Math.ceil(cz) + 6; z++) {
      const r = Math.hypot(y + 0.5 - gy, z + 0.5 - cz);
      if (r > 6.5) continue;
      const ray = pm(Math.floor((Math.atan2(y + 0.5 - gy, z + 0.5 - cz) + Math.PI) * 4), 2) === 0;
      const c = r < 1.5 ? k.pWhite : r < 2.6 ? k.goldLight : ray ? k.gold : 0;
      if (c) g.set(ax, y, z, c);
    }
  }

  // aisle ceilings: white vaults with gilt ribs and a rosette in every bay
  for (const [z0, z1] of [[IZ0, NZ0 - 4], [NZ1 + 4, IZ1]] as const) {
    g.box(IX0, AISLE, z0, IX1, CEIL + 1, z1, (x, y, z) => {
      if (y > AISLE) return k.stucco;
      const px = piers.reduce((acc, p) => (p <= x ? p : acc), IX0);
      const u = (x - px) / 16, v = (z - z0) / (z1 - z0);
      if (x - px < 1) return k.gold;
      if (Math.abs(u - v) < 0.05 || Math.abs(u - (1 - v)) < 0.05) return k.gold;
      if (Math.hypot((u - 0.5) * 16, (v - 0.5) * (z1 - z0)) < 1.2) return k.goldLight;
      return k.stucco;
    });
  }
  // the arcades: marble piers, round arches gilt underneath, a wall going up to the ceiling above them
  // the pier at or before x (the town lies at negative x, so 'none' is -Infinity)
  const bayOf = (x: number) => { let p = -Infinity; for (const q of piers) if (q <= x) p = q; return p; };
  for (const [z0, z1, nave, aisleSide] of [[NZ0 - 3, NZ0 - 1, NZ0 - 1, NZ0 - 3], [NZ1 + 1, NZ1 + 3, NZ1 + 1, NZ1 + 3]] as const) {
    g.box(IX0, Y, z0, IX1, CEIL + 1, z1, (x, y, z) => {
      const px = bayOf(x);
      if ((x >= PX0 && px !== lastPier) || (px === lastPier && x <= lastPier + 3)) {
        const o = x - px;
        if (o > 3) {
          // under the arch
          const t = (o - 3.5 - 6) / 6.5;
          const top = Y + 24 + Math.round(6.5 * Math.sqrt(Math.max(0, 1 - t * t)));
          if (y < top) return 0;
          if (y < top + 2) return y === top ? k.goldDeep : k.gold;
        } else {
          // the pier: a moulded base, the impost gilt where the arches spring
          if (y < Y + 2) return k.marbleGrey;
          if (y >= Y + 25 && y <= Y + 26) return k.gold;
          if (y < Y + 25) return z === nave || z === aisleSide ? (y % 6 === 0 ? k.marbleVein : k.marbleWarm) : k.marble;
        }
      }
      if (y === AISLE - 1 && z === aisleSide) return k.goldDeep;
      if (z !== nave) return k.stucco;
      return y < Y + 3 ? k.marbleGrey : k.stucco;
    });
  }
  // pilasters on the piers, their gilt capitals carrying the entablature that runs round the nave
  for (const zn of [NZ0, NZ1]) {
    for (const px of piers) g.box(px, Y, zn, px + 3, ENT - 1, zn, (x, y) => {
      if (y < Y + 3) return k.marbleGrey;
      if (y >= ENT - 4) return (x + y) % 2 ? k.goldLight : k.gold;
      return x === px || x === px + 3 ? k.marbleWarm : (y >> 1) % 2 ? k.marble : k.stuccoShade;
    });
    g.box(AX + 2, ENT, zn, IX1, ENT + 2, zn, (x, y) => (y === ENT ? k.goldDeep : y === ENT + 1 ? (x % 2 ? k.gold : k.stucco) : k.goldLight));
    g.box(AX + 2, ENT + 2, zn === NZ0 ? zn + 1 : zn - 1, IX1, ENT + 2, zn === NZ0 ? zn + 1 : zn - 1, k.gold);
    // a canvas in a gilt frame in every bay above the arches, a painted medallion in the attic over the cornice
    piers.forEach((px, i) => {
      if (px === lastPier) return;
      const x0 = px + 5, x1 = px + 14, y0 = Y + 35, y1 = Y + 51;
      g.box(x0, y0, zn, x1, y1, zn, (x, y) => framed(k, x - x0, y - y0, x1 - x0 + 1, y1 - y0 + 1, i * 13 + zn));
      g.box(x0 + 3, Y + 33, zn, x1 - 3, Y + 33, zn, k.gold);
      const mx = px + 9.5, my = ENT + 7;
      for (let y = my - 4; y <= my + 4; y++) for (let x = px + 5; x <= px + 14; x++) {
        const e = Math.hypot((x + 0.5 - mx) / 4.6, (y + 0.5 - my) / 3.6);
        if (e > 1) continue;
        g.set(x, y, zn, e > 0.78 ? k.gold : Math.hypot(x + 0.5 - mx, y + 1 - my) < 1.3 ? k.pFlesh : y < my - 1 ? (i % 2 ? k.pRed : k.pBlue) : k.pSky);
      }
    });
  }
  // the coffered ceiling: gilt beams, painted canvases down the middle, blue coffers with gold rosettes either side
  const zBeam = (v: number) => v <= 2 || (v >= 12 && v <= 14) || (v >= 25 && v <= 27) || v >= 37;
  g.box(AX + 2, CEIL - 1, NZ0, IX1, CEIL, NZ1, (x, y, z) => {
    const u = pm(x - AX, 21), v = z - NZ0;
    const beam = u <= 2 || zBeam(v);
    if (y === CEIL - 1) {
      if (!beam) return 0;
      const mid = u === 1 || v === 1 || v === 13 || v === 26 || v === 38;
      return mid ? k.goldDeep : k.gold;
    }
    if (beam) return k.gold;
    if (v >= 15 && v <= 24) return painting(k, u - 3, v - 15, 18, 10, Math.floor((x - AX) / 21) * 31 + 7);
    const cu = pm(u - 3, 9), cv = v < 12 ? v - 3 : v - 28;
    if (cu === 0 || cv === 0 || cu === 8 || cv === 8) return k.goldDeep;
    const r = Math.hypot(cu - 4, cv - 4);
    if (r < 1.2) return k.goldLight;
    if (r < 2.4 && pm(Math.floor(Math.atan2(cv - 4, cu - 4) * 2.55), 2) === 0) return k.gold;
    return k.pBlue;
  });
  for (let x = AX + 22; x <= IX1; x += 21) for (const v of [1, 13, 26, 38]) g.set(x, CEIL - 2, NZ0 + v, k.goldLight);
  // over the nave's cornice up to the ceiling the wall is a white attic (the medallions are on it)

  // the altar rail, the high altar, the tabernacle and the gradine of candles
  for (const [z0, z1] of [[NZ0 + 1, NZ0 + 14], [NZ1 - 14, NZ1 - 1]] as const)
    g.box(PRES - 1, Y + 2, z0, PRES - 1, Y + 5, z1, (_x, y, z) => (y === Y + 5 ? k.marble : y === Y + 2 ? k.marbleGrey : pm(z, 2) ? k.marbleWarm : 0));
  {
    const a0 = AX - 3, a1 = AX + 1, z0 = Math.floor(cz) - 7, z1 = Math.ceil(cz) + 6;
    g.box(a0, Y + 2, z0, a1, Y + 4, z1, (x, y, z) => {
      if (x !== a1) return k.marble;
      const u = z - z0, w = z1 - z0;
      if (y === Y + 2 || u === 0 || u === w) return k.goldDeep;
      if (Math.abs(u - w / 2) < 0.6 || (y === Y + 3 && Math.abs(u - w / 2) < 2)) return k.goldLight;
      return u % 5 === 0 ? k.gold : u < w / 2 ? k.verde : k.rosso;
    });
    g.box(a0, Y + 5, z0 - 1, a1 + 1, Y + 5, z1 + 1, k.marble);
    g.box(a0, Y + 6, z0, a0 + 1, Y + 6, z1, (x) => (x === a0 + 1 ? k.goldDeep : k.marble));
    g.box(a0, Y + 6, Math.floor(cz) - 2, a0 + 2, Y + 9, Math.ceil(cz) + 1, (x, y, z) => (x === a0 + 2 && y < Y + 9 && Math.abs(z + 0.5 - cz) < 1.1 ? k.goldLight : k.gold));
    g.box(a0 + 1, Y + 10, Math.floor(cz) - 1, a0 + 1, Y + 10, Math.ceil(cz), k.goldLight);
  }
  // choir stalls of walnut down both sides of the presbytery
  for (const [zs, zb] of [[NZ0 + 1, NZ0], [NZ1 - 1, NZ1]] as const) {
    g.box(AX, Y + 2, zb, PRES - 8, Y + 9, zb, (x, y) => (y === Y + 9 ? k.gold : (x - AX) % 3 === 0 ? k.walnutDark : k.walnut));
    g.box(AX, Y + 2, zs, PRES - 8, Y + 3, zs, (x, y) => (y === Y + 3 ? ((x - AX) % 3 === 0 ? k.walnutDark : k.walnut) : k.walnutDark));
  }
  // the two ambos of mosaic at the front of the presbytery, and the paschal candlesticks
  for (const [z0, z1] of [[NZ0 + 3, NZ0 + 6], [NZ1 - 6, NZ1 - 3]] as const) {
    const x0 = PRES - 5, x1 = PRES - 2;
    g.box(x0 + 1, Y + 2, z0 + 1, x1 - 1, Y + 7, z1 - 1, (_x, y) => (y === Y + 7 ? k.gold : k.marbleWarm));
    g.box(x0, Y + 8, z0, x1, Y + 12, z1, (x, y, z) => {
      const edge = x === x0 || x === x1 || z === z0 || z === z1;
      if (!edge) return y === Y + 8 ? k.marble : 0;
      if (y === Y + 12 || y === Y + 8) return k.gold;
      return pm(x + z + y, 3) === 0 ? k.porphyry : pm(x + z + y, 3) === 1 ? k.serpentine : k.gold;
    });
  }
  for (const zz of [NZ0 + 10, NZ1 - 10]) {
    g.box(PRES - 3, Y + 2, zz, PRES - 2, Y + 15, zz + 1, (x, y, z) => (y === Y + 2 || y === Y + 15 ? k.gold : pm(y + x * 2 + z, 4) === 0 ? k.gold : pm(y + x * 2 + z, 4) === 2 ? k.porphyry : k.marble));
    g.box(PRES - 3, Y + 16, zz, PRES - 3, Y + 18, zz, k.wax);
    g.set(PRES - 3, Y + 19, zz, k.flame);
  }

  // side altars against the aisle walls under framed paintings between green marble columns
  for (const x of SIDE) for (const [zw, out] of [[IZ0, 1], [IZ1, -1]] as const) {
    g.box(x - 4, Y, zw, x + 3, Y + 3, zw + out * 2, (xx, y, z) => (y === Y + 3 ? k.marble : z === zw + out * 2 ? (xx === x - 4 || xx === x + 3 ? k.goldDeep : (xx + y) % 4 === 0 ? k.gold : k.rosso) : k.marbleWarm));
    g.box(x - 4, Y + 4, zw, x + 3, Y + 4, zw, k.marble);
    g.box(x - 3, Y + 6, zw, x + 2, Y + 19, zw, (xx, y) => framed(k, xx - (x - 3), y - (Y + 6), 6, 14, x * 3 + zw));
    for (const xx of [x - 6, x + 5]) g.box(xx, Y, zw, xx + 1, Y + 20, zw + out, (_q, y) => (y < Y + 2 ? k.marbleGrey : y > Y + 18 ? k.gold : k.verde));
    g.box(x - 7, Y + 21, zw, x + 6, Y + 21, zw + out, k.goldLight);
    for (let i = 0; i < 4; i++) g.box(x - 6 + i * 2, Y + 22 + i, zw, x + 5 - i * 2, Y + 22 + i, zw, k.gold);
  }
  // a confessional in each aisle: a walnut booth, the priest's door in the middle, red curtains either side
  for (const [zw, out] of [[IZ0, 1], [IZ1, -1]] as const) {
    const x = piers[2] + 10, zf = zw + out * 4;
    g.box(x - 5, Y, zw, x + 4, Y + 11, zf, (xx, y, z) => {
      if (y >= Y + 10) return (xx + y) % 2 ? k.gold : k.walnutDark;
      if (z !== zf) return k.walnut;
      if (xx >= x - 1 && xx <= x && y < Y + 9) return y === Y + 5 && xx === x ? k.brass : k.walnutDark;
      if ((xx <= x - 3 || xx >= x + 2) && y > Y && y < Y + 9) return k.velvet;
      return k.walnut;
    });
    g.box(x - 2, Y + 12, zw, x + 1, Y + 13, zw + out * 2, k.gold);
  }
  // holy water stoups by the doors
  for (const zz of [Math.floor(cz) - 9, Math.ceil(cz) + 8]) {
    g.box(IX1 - 5, Y, zz, IX1 - 5, Y + 2, zz, k.marbleGrey);
    g.box(IX1 - 6, Y + 3, zz - 1, IX1 - 4, Y + 3, zz + 1, (x, _y, z) => (x === IX1 - 5 && z === zz ? k.water : k.marble));
  }

  // the organ loft over the doors on two columns, its gilt balustrade, the organ's pipes in walnut towers
  {
    const lx = IX1 - 7;
    for (const zz of [Math.floor(cz) - 12, Math.ceil(cz) + 10]) g.box(lx, Y, zz, lx + 1, Y + 29, zz + 1, (_x, y) => (y < Y + 2 ? k.marbleGrey : y > Y + 26 ? k.gold : k.marbleWarm));
    g.box(lx, Y + 30, NZ0, IX1, Y + 31, NZ1, (x, y, z) => (y === Y + 30 ? ((x + z) % 4 === 0 ? k.gold : k.walnut) : k.walnutDark));
    g.box(lx, Y + 32, NZ0, lx, Y + 35, NZ1, (_x, y, z) => (y === Y + 35 ? k.goldLight : y === Y + 32 ? k.gold : pm(z, 3) === 0 ? k.gold : k.walnut));
    const tower = (z0: number, z1: number, top: number) => {
      g.box(IX1 - 3, Y + 32, z0, IX1, top, z1, (x, y, z) => {
        if (y === top) return k.gold;
        if (x !== IX1 - 3) return k.walnutDark;
        if (z === z0 || z === z1) return k.walnut;
        const ph = Math.round(Math.abs(z - (z0 + z1) / 2) * 1.3);
        if (y > top - 2 - ph) return k.walnut;
        if (y === Y + 35) return k.iron;
        return pm(z, 2) ? k.tin : k.tinDark;
      });
    };
    tower(NZ0, NZ0 + 9, Y + 46);
    tower(NZ1 - 9, NZ1, Y + 46);
    tower(NZ0 + 10, NZ1 - 10, Y + 40);
  }
  // the doorway through the front screen, the bronze doors swung back inside, a marble frame round it
  g.box(FX, Y, zc - 4, FX + 3, Y + 15, zc + 3, 0);
  for (const zz of [zc - 5, zc + 4]) g.box(IX1 - 4, Y, zz, IX1 - 1, Y + 15, zz, (x, y) => ((x + y) % 4 === 0 ? k.goldDeep : k.bronze));
  g.box(IX1, Y, zc - 6, IX1, Y + 17, zc + 5, (_x, y, z) => (z >= zc - 4 && z <= zc + 3 && y <= Y + 15 ? 0 : y > Y + 15 ? k.gold : k.marble));
  // the rose window and the lancets of the front open through the screen: stained glass seen from inside
  {
    const ry = Y + 57;
    for (let y = ry - 9; y <= ry + 9; y++)
      for (let z = zc - 9; z <= zc + 9; z++) {
        const r = Math.hypot(z + 0.5 - zc, y + 0.5 - ry);
        if (r >= 7.2) continue;
        const ang = Math.atan2(y + 0.5 - ry, z + 0.5 - zc);
        const spoke = Math.abs(Math.sin(ang * 6)) < 0.3;
        if (r < 1.6 || (r > 3.2 && r < 4) || spoke) { g.box(FX, y, z, FX + 2, y, z, k.marble); continue; }
        g.box(FX, y, z, FX + 1, y, z, 0);
        g.set(FX + 2, y, z, r < 3.2 ? (pm(Math.floor(ang * 1.9), 2) ? k.sgGold : k.sgRed) : pm(Math.floor((ang + Math.PI) * 6 / Math.PI), 2) ? k.sgBlue : k.sgGreen);
      }
    for (const z0 of [zc - 19, zc + 17]) for (let y = Y + 48; y <= Y + 61; y++) {
      const zs = y === Y + 61 ? [z0 + 1] : [z0, z0 + 1, z0 + 2];
      for (const z of zs) {
        g.box(FX, y, z, FX + 1, y, z, 0);
        g.set(FX + 2, y, z, [k.sgBlue, k.sgRed, k.sgGold, k.sgBlue, k.sgGreen, k.sgViolet][pm(y + (z - z0) * 2, 6)]);
      }
    }
  }
  // the aisle windows: stained glass inside the clear outer pane, a reveal through the wall
  for (let x = X0 + 6; x < X1 - 6; x += 12) for (const [zo, zi, zr] of [[Z0, Z0 + 1, Z0 + 2], [Z1, Z1 - 1, Z1 - 2]] as const) {
    for (let y = Y + 26; y <= Y + 37; y++) for (let xx = x; xx <= x + 3; xx++) {
      g.set(xx, y, zr, 0);
      const lead = (y - Y) % 4 === 0 || xx === x || xx === x + 3;
      g.set(xx, y, zi, lead ? k.sgWhite : [k.sgBlue, k.sgGold, k.sgRed, k.sgGreen][pm(xx + y + zo, 4)]);
    }
  }

  // the crypt: a vaulted room under the north aisle, frescoed and gilt, its altar and the saint's bronze
  g.box(CR.x0, CR.y0, CR.z0, CR.x1, CR.y1, CR.z1, 0);
  g.box(CR.x0, CR.y0 - 1, CR.z0, CR.x1, CR.y0 - 1, CR.z1, (x, _y, z) => (((x >> 1) + (z >> 1)) & 1 ? k.marbleGrey : k.marbleWarm));
  g.box(CR.x0, CR.y1 + 1, CR.z0, CR.x1, Y - 2, CR.z1, (x, y, z) => {
    if (y > CR.y1 + 1) return k.stucco;
    const u = pm(x - CR.x0, 8), v = pm(z - CR.z0, 8);
    if (u === 0 || v === 0) return k.gold;
    if (Math.abs(u - v) < 1 || Math.abs(u - (8 - v)) < 1) return k.goldDeep;
    return hash3(x, y, z) < 0.12 ? k.goldLight : k.pSkyDeep;
  });
  // its walls painted with saints between gilt pilasters, where the room meets the rock
  for (const [x0, z0, x1, z1] of [[CR.x0, CR.z0 - 1, CR.x1, CR.z0 - 1], [CR.x0, CR.z1 + 1, CR.x1, CR.z1 + 1], [CR.x0 - 1, CR.z0, CR.x0 - 1, CR.z1], [CR.x1 + 1, CR.z0, CR.x1 + 1, CR.z1]] as const)
    g.box(x0, CR.y0, z0, x1, CR.y1, z1, (x, y, z) => {
      const u = x0 === x1 ? z : x;
      if (pm(u, 9) === 0) return k.gold;
      if (y < CR.y0 + 3) return k.marbleGrey;
      return painting(k, pm(u, 9) - 1, y - CR.y0 - 3, 8, CR.y1 - CR.y0 - 2, Math.floor(u / 9) * 5 + x0);
    });
  g.box(CR.x0, CR.y0, IZ0 + 3, CR.x0 + 2, CR.y0 + 3, IZ0 + 10, (x, y) => (y === CR.y0 + 3 ? k.marble : x === CR.x0 + 2 ? k.gold : k.marbleWarm));
  // the well: an opening in the aisle floor railed with marble balusters
  g.box(CW.x0, Y - 3, CW.z0, CW.x1, Y - 1, CW.z1, 0);
  g.box(CW.x0, Y - 3, CW.z0, CW.x1, Y - 3, CW.z1, 0);
  for (let z = CW.z0 - 1; z <= CW.z1 + 1; z++) for (let x = CW.x0 - 1; x <= CW.x1 + 1; x++) {
    const edge = x === CW.x0 - 1 || x === CW.x1 + 1 || z === CW.z0 - 1 || z === CW.z1 + 1;
    if (!edge) continue;
    g.box(x, Y, z, x, Y + 2, z, (_x, y) => (y === Y ? k.marbleGrey : pm(x + z, 2) === 0 ? k.marbleWarm : 0));
    g.set(x, Y + 3, z, k.gold);
  }
  return hall;
}

// ------------------------------------------------------------------------------------------- the mosques

export interface MosqueFrame {
  id: string;
  /** The prayer hall's voxel box (its one-voxel walls included), floor layer and wall height (voxels). */
  X0: number; Z0: number; X1: number; Z1: number; Y: number; H: number;
  /** The dome: centre, radius, the layer its drum starts on; the half-domes (centre x, z and radius). */
  cx: number; cz: number; R: number; DY: number;
  semis: [number, number, number][];
  /** The great door in the Z1 wall (its x range), the qibla wall is Z0. */
  door: [number, number];
  /** Whether the outer wall's voxel at (x, y, z) is a window (glass or grille) the inside must leave open. */
  opening: (x: number, y: number, z: number) => boolean;
  /** Whether it is one of the upper lights (coloured glass) rather than a lower grilled window. */
  upper: (y: number) => boolean;
  /** İznik tiles all over the walls (the New Mosque) or only round the mihrab (Süleymaniye's restraint). */
  rich: boolean;
  /** The city's own stone and lead, for the ledges under the half-domes. */
  stone: number; lead: number;
}

/** İznik tiles: white ground, cobalt and turquoise, coral-red tulips and carnations, green leaves (u across, v up). */
function iznik(k: K, u: number, v: number, panel: number): number {
  const a = pm(u, 8), b = pm(v, 8);
  const r = Math.hypot(a - 3.5, b - 3.5);
  if (panel === 1) {
    // a tall panel: a cypress-like tree of flowers rising up the middle
    const w = 3 - Math.abs(pm(v, 24) - 12) / 6;
    if (Math.abs(a - 3.5) < w * 0.5 && pm(v, 3) !== 0) return k.leaf;
    if (Math.abs(a - 3.5) < w && pm(v, 3) === 0) return pm(v, 6) ? k.coral : k.cobalt;
  }
  if (r > 4.6) return k.cobalt;
  if (r > 4.0) return pm(a + b, 2) ? k.turq : k.cobalt;
  if (r < 1.0) return k.coral;
  if (r < 1.8) return k.tile;
  if (r < 2.6) return pm(Math.floor(Math.atan2(b - 3.5, a - 3.5) * 2.55), 2) ? k.cobalt : k.turq;
  if (Math.abs(a - b) < 0.6 || Math.abs(a - (7 - b)) < 0.6) return k.leaf;
  return k.tile;
}

/** Painted plaster: cream, with bands of red and indigo rumi scrolls (u along the wall, v the layer). */
function kalem(k: K, u: number, v: number): number {
  const band = pm(v, 12);
  if (band === 0 || band === 4) return k.paintRed;
  if (band > 0 && band < 4) {
    const s = Math.sin((u + v * 0.5) * 0.8) * 1.4 + 1.5;
    return Math.abs(band - s) < 0.7 ? k.paintIndigo : pm(u + band, 5) === 0 ? k.paintOchre : k.paint;
  }
  return pm(u * 3 + v, 31) === 0 ? k.paintOchre : k.paint;
}

/** A band of thuluth in gold and white on cobalt (u along, v the row of the band, h its height). */
function inscription(k: K, u: number, v: number, h: number, seed: number): number {
  if (v === 0 || v === h - 1) return k.gold;
  const n = hash3(u >> 1, 0, seed);
  const tall = n < 0.35 && pm(u, 2) === 0;
  if (tall) return k.tile;
  if (v === 1 && hash3(u, 1, seed) < 0.55) return k.tile;
  if (v === h - 2 && hash3(u, 2, seed) < 0.12) return k.gold;
  return k.cobalt;
}

/** A calligraphic roundel (levha): a gilt rim, a dark green field, a word in gold sweeping across it. */
function roundel(k: K, du: number, dv: number, r: number, seed: number): number {
  const d = Math.hypot(du, dv);
  if (d > r) return 0;
  if (d > r - 0.9) return k.gold;
  if (d > r - 1.5) return k.goldDeep;
  const s = du / r, t = dv / r;
  // three tall strokes, a long swash under them, dots
  for (let i = 0; i < 3; i++) {
    const sx = -0.45 + i * 0.42 + (hash3(seed, i, 1) - 0.5) * 0.15;
    if (Math.abs(s - sx) < 0.09 && t > -0.25 && t < 0.55 - i * 0.1) return k.goldLight;
  }
  if (Math.abs(t - (-0.35 + s * s * 0.5)) < 0.09 && Math.abs(s) < 0.75) return k.goldLight;
  if (Math.hypot(s - 0.1, t + 0.62) < 0.1 || Math.hypot(s + 0.55, t - 0.2) < 0.08) return k.goldLight;
  return k.callig;
}

/** A great ring of oil lamps hung low over the floor, an inner ring and a cluster in the middle (fine voxels). */
function lampRing(k: K, r: number): Prop {
  const n = Math.ceil(r * 2 + 4);
  const p = new Prop(n, 9, n);
  const c = n / 2;
  for (let z = 0; z < n; z++) for (let x = 0; x < n; x++) {
    const d = Math.hypot(x + 0.5 - c, z + 0.5 - c);
    if (Math.abs(d - r) < 0.75) p.set(x, 6, z, k.iron);
    if (Math.abs(d - r * 0.55) < 0.7) p.set(x, 8, z, k.iron);
    if (Math.abs(d - r) < 0.75 && pm(x * 7 + z * 3, 5) === 0) { p.set(x, 5, z, k.brass); p.set(x, 4, z, k.lampGlass); p.set(x, 3, z, k.lampGlass); }
    if (Math.abs(d - r * 0.55) < 0.7 && pm(x * 5 + z * 11, 6) === 0) { p.set(x, 7, z, k.brass); p.set(x, 6, z, k.lampGlass); }
  }
  // spokes from the outer ring to the middle, the big lamp of the centre with its ostrich egg
  for (let i = 0; i < 8; i++) {
    const an = i / 8 * Math.PI * 2;
    for (let s = 2; s < r; s += 0.5) p.set(Math.floor(c + Math.cos(an) * s), 6, Math.floor(c + Math.sin(an) * s), k.iron);
  }
  p.ellipsoid(c, 4, c, 1.6, 2.4, 1.6, (_x, y) => (y === 4 ? k.brass : k.lampGlass));
  p.box(Math.floor(c), 6, Math.floor(c), Math.floor(c), 8, Math.floor(c), k.brass);
  return p;
}

/**
 * Inside a mosque: the carpet in rows facing the qibla, İznik tiles and painted plaster, the four great piers and
 * the arches that carry the dome, pendentives, the dome and the half-domes painted inside, the drum's ring of
 * windows, the mihrab in its marble frame with the great candlesticks, the minbar's stair and its spire, the
 * preacher's chair, the muezzins' platform, galleries, calligraphic roundels on the piers, the ring of lamps hung
 * low on its chains, Qur'an stands, the shoe racks by the door, and the faithful.
 */
export function mosqueInterior(b: Builder, f: MosqueFrame): HallAnchor {
  const k = colors(b);
  const g = b.grid;
  const { X0, Z0, X1, Z1, Y, H, cx, cz, R, DY } = f;
  const floorY = yM(Y);
  const AX0 = X0 + 2, AX1 = X1 - 2, AZ0 = Z0 + 2, AZ1 = Z1 - 2;
  const TOP = Y + H - 2; // the last layer of air under the ceiling
  const m = (v: number) => v * V;
  // the dome's square: piers at its corners, arches between them
  const a = Math.min(R - 1, Math.floor((X1 - X0) / 2) - 10), bz = Math.min(R - 1, Math.floor((Z1 - Z0) / 2) - 8);
  const piers: [number, number][] = [[cx - a, cz - bz], [cx + a, cz - bz], [cx - a, cz + bz], [cx + a, cz + bz]];
  const mx = Math.floor(cx); // the mihrab's axis
  const ringR = Math.round(R * 0.62), ringY = Y + 11;
  const galleries = !f.rich;

  const hall: HallAnchor = {
    id: f.id, kind: 'mosque',
    rect: [m(AX0), m(AZ0), m(AX1 + 1), m(AZ1 + 1)], floor: floorY, top: yM(DY + 8 + R),
    inner: [[AX0, Y, AZ0, AX1, TOP, AZ1]],
    beams: [], people: [],
  };
  b.indoor.push([AX0, Y, AZ0, AX1, TOP, AZ1]);

  // ---- props, lamps, people and light
  b.place(lampRing(k, ringR / 0.5), m(cx), yM(ringY), m(cz));
  const chainLen = Math.max(8, Math.round((yM(DY) - yM(ringY) - 1.0) / 0.125));
  for (let i = 0; i < 16; i++) {
    const an = i / 16 * Math.PI * 2, rr = i % 2 ? ringR * 0.55 : ringR;
    b.place(chain(k, chainLen), m(cx + Math.cos(an) * rr), yM(ringY) + 0.875, m(cz + Math.sin(an) * rr));
  }
  for (let i = 0; i < 8; i++) {
    const an = (i + 0.5) / 8 * Math.PI * 2;
    b.lamp(m(cx + Math.cos(an) * ringR), yM(ringY) + 0.4, m(cz + Math.sin(an) * ringR), WARM, 9, 0.7);
  }
  b.lamp(m(cx), yM(ringY) + 0.4, m(cz), WARM, 8, 0.6);
  b.lamp(m(mx), floorY + 2.4, m(AZ0 + 5), WARM, 7, 0.75);
  // Qur'an stands with readers sitting on the carpet before them, facing the qibla; others at prayer in a row
  const face = Math.PI; // towards -z, the qibla wall
  const readers: [number, number][] = [[cx - a + 6, cz - bz + 6], [cx + a - 7, cz - bz + 9], [cx - 6, cz + 4], [cx + a + 6, cz + 2], [cx - a - 7, cz - 4]];
  readers.forEach(([x, z], i) => {
    b.place(rahle(k), m(x), floorY, m(z - 3));
    b.block(m(x) - 0.3, m(z - 3) - 0.35, m(x) + 0.3, m(z - 3) + 0.35);
    hall.people.push({ pos: [m(x), floorY, m(z)], face, seed: 1200 + i * 17 + R, pose: 'kneel' });
  });
  for (let i = 0; i < 5; i++) {
    const x = cx - 8 + i * 4, z = AZ0 + 14;
    hall.people.push({ pos: [m(x), floorY, m(z)], face, seed: 1300 + i * 13 + R, pose: i % 2 ? 'idle' : 'sujud', alt: i % 2 ? 'bow' : undefined });
  }
  hall.people.push(
    { pos: [m(cx + 4), floorY, m(AZ0 + 22)], face, seed: 1400 + R, pose: 'kneel' },
    { pos: [m(f.door[0] - 6), floorY, m(AZ1 - 7)], face: Math.PI + 0.3, seed: 1401 + R, pose: 'photo', alt: 'browse' },
    { pos: [m(f.door[1] + 7), floorY, m(AZ1 - 10)], face: Math.PI - 0.5, seed: 1402 + R, pose: 'browse', alt: 'idle' },
    { pos: [m(cx - 3), floorY, m(cz + bz - 6)], face: Math.PI + 0.2, seed: 1403 + R, pose: 'browse', alt: 'photo' },
  );
  // the sun through the drum's ring of windows, and through the coloured upper lights of the walls
  for (let s = 0; s < 48; s += 2) {
    const an = -Math.PI + (s + 0.5) * Math.PI / 24, ca = Math.cos(an), sa = Math.sin(an);
    hall.beams.push({ x: m(cx + ca * R), y: yM(DY + 3.5) + 0.125, z: m(cz + sa * R), w: (2 * Math.PI * R / 48) * V * 0.9, h: 4 * V, nx: ca, nz: sa, tint: [1, 0.93, 0.8] });
  }
  const up = H - 16;
  for (let x = X0; x + 9 <= X1; x += 12) {
    hall.beams.push({ x: m(x + 6), y: yM(Y + up + 4.5), z: m(Z0), w: 1.5, h: 2.0, nx: 0, nz: -1, tint: [1, 0.8, 0.62] });
    hall.beams.push({ x: m(x + 6), y: yM(Y + up + 4.5), z: m(Z1 + 1), w: 1.5, h: 2.0, nx: 0, nz: 1, tint: [1, 0.8, 0.62] });
  }
  for (let z = Z0; z + 9 <= Z1; z += 12) {
    hall.beams.push({ x: m(X0), y: yM(Y + up + 4.5), z: m(z + 6), w: 1.5, h: 2.0, nx: -1, nz: 0, tint: [1, 0.8, 0.62] });
    hall.beams.push({ x: m(X1 + 1), y: yM(Y + up + 4.5), z: m(z + 6), w: 1.5, h: 2.0, nx: 1, nz: 0, tint: [1, 0.8, 0.62] });
  }
  // what stands on the floor and must be walked round (the voxels below block the rest)
  b.halls.push(hall);

  if (!g.touches(X0 - 2, Z0 - 2, X1 + 2, Z1 + 2)) return hall;

  // ---- the voxels: hollow the hall out
  g.box(AX0, Y, AZ0, AX1, TOP, AZ1, 0);
  // the inner face of the walls, one voxel inside the outer one: tiles, a band of inscription, painted plaster,
  // and the windows left open (the upper lights in coloured glass)
  const skin = (x: number, y: number, _z: number, ox: number, oz: number, u: number, wall: 'qibla' | 'side' | 'door') => {
    const row = y - Y;
    if (f.opening(ox, y, oz)) return f.upper(y) ? [k.sgRed, k.sgBlue, k.sgGold, k.sgGreen, k.sgTurq][pm(u + row * 2, 5)] : 0;
    const tiles = f.rich ? (wall === 'qibla' ? row < H - 14 : row < 12) : wall === 'qibla' && Math.abs(x + 0.5 - mx) < 16 && row < 20;
    if (tiles) return row === 0 ? k.navy : iznik(k, u, row, wall === 'qibla' && pm(Math.floor(u / 8), 3) === 1 ? 1 : 0);
    if (row < 4) return f.rich ? k.navy : (row === 3 ? k.marbleGrey : k.marble);
    const ib = f.rich ? (wall === 'qibla' ? H - 14 : 12) : 12;
    if (row >= ib && row < ib + 3) return inscription(k, u, row - ib, 3, Math.floor(u / 40) + X0);
    return kalem(k, u, row);
  };
  g.box(X0 + 1, Y, Z0 + 1, X1 - 1, TOP + 1, Z1 - 1, (x, y, z) => {
    if (x === X0 + 1) return skin(x, y, z, X0, z, z, 'side');
    if (x === X1 - 1) return skin(x, y, z, X1, z, -z, 'side');
    if (z === Z0 + 1) return skin(x, y, z, x, Z0, -x, 'qibla');
    if (z === Z1 - 1) return skin(x, y, z, x, Z1, x, 'door');
    return y === TOP + 1 ? k.paint : 0;
  });
  // the ceiling, painted, and under the dome and the half-domes opened up to them
  const square = (x: number, z: number) => Math.abs(x + 0.5 - cx) < a && Math.abs(z + 0.5 - cz) < bz;
  const dMain = (x: number, z: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);
  g.box(AX0, TOP + 1, AZ0, AX1, TOP + 2, AZ1, (x, y, z) => {
    const d = dMain(x, z);
    if (d < R - 1.5) return 0;
    if (!square(x, z) && f.semis.some(([sx, sz, r]) => Math.hypot(x + 0.5 - sx, z + 0.5 - sz) < r - 2)) return 0;
    if (y === TOP + 2) return k.paint;
    return square(x, z) ? (pm(Math.floor(d), 3) === 0 ? k.paintRed : pm(x + z, 4) === 0 ? k.paintOchre : k.paint) : kalem(k, x, z);
  });
  // a ledge closes the half-domes where they overhang the walls
  for (const [sx, sz, r] of f.semis)
    g.box(Math.floor(sx - r), TOP + 1, Math.floor(sz - r), Math.ceil(sx + r), TOP + 2, Math.ceil(sz + r), (x, y, z) => {
      if (x >= AX0 && x <= AX1 && z >= AZ0 && z <= AZ1) return g.get(x, y, z);
      if (x >= X0 && x <= X1 && z >= Z0 && z <= Z1) return g.get(x, y, z);
      return Math.hypot(x + 0.5 - sx, z + 0.5 - sz) < r - 1 ? (y === TOP + 2 ? f.lead : f.stone) : g.get(x, y, z);
    });
  // inside the drum and the dome: nothing but the dome itself (the half-domes lean on it from outside)
  const DS = DY + 8;
  g.box(Math.floor(cx - R + 2), TOP + 3, Math.floor(cz - R + 2), Math.ceil(cx + R - 2), DS + R, Math.ceil(cz + R - 2), (x, y, z) => {
    const d = dMain(x, z);
    if (d >= R - 1.5) return g.get(x, y, z);
    if (y < DS) return 0;
    const d3 = Math.hypot(x + 0.5 - cx, y - DS, z + 0.5 - cz);
    if (d3 < R - 2) return 0;
    if (d3 >= R - 1) return g.get(x, y, z);
    // the dome's inner face, painted: a medallion of calligraphy at the crown, sixteen ribs, a band of
    // inscription round the springing
    const dy = y - DS;
    if (dy > R * 0.84) return roundel(k, x + 0.5 - cx, z + 0.5 - cz, R * 0.55, 7) || k.gold;
    if (dy > R * 0.78) return k.goldDeep;
    if (dy < 3) return inscription(k, Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * R), dy, 3, 9);
    const ang = Math.atan2(z + 0.5 - cz, x + 0.5 - cx);
    const sec = (ang + Math.PI) / (Math.PI * 2) * 16;
    if (Math.abs(sec - Math.round(sec)) < 0.06) return k.paintRed;
    const w = Math.abs(Math.sin(sec * Math.PI) * 6 - (dy / R) * 6);
    return w < 0.8 ? k.paintIndigo : w < 1.4 ? k.paintOchre : k.paint;
  });
  // the drum's inner face between its windows
  for (let y = DY; y < DY + 8; y++) for (let z = Math.floor(cz - R - 1); z <= cz + R + 1; z++) for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x++) {
    const d = dMain(x, z);
    if (d > R - 0.5 || d < R - 1.5) continue;
    const win = y - DY >= 2 && y - DY <= 5 && Math.floor((Math.atan2(z + 0.5 - cz, x + 0.5 - cx) + Math.PI) * 24 / Math.PI) % 2 === 0;
    if (!win) g.set(x, y, z, y === DY || y === DY + 7 ? k.paintRed : y === DY + 1 || y === DY + 6 ? k.gold : k.paintIndigo);
  }
  // the half-domes inside: fluted in cream and red, gilt at the rim
  for (const [sx, sz, r] of f.semis)
    for (let y = TOP + 1; y <= TOP + 1 + r; y++) for (let z = Math.floor(sz - r); z <= Math.ceil(sz + r); z++) for (let x = Math.floor(sx - r); x <= Math.ceil(sx + r); x++) {
      if (dMain(x, z) < R - 1.5) continue;
      const d3 = Math.hypot(x + 0.5 - sx, z + 0.5 - sz, y - (TOP + 1));
      if (d3 < r - 2 || d3 >= r - 1) continue;
      if (x < X0 || x > X1 || z < Z0 || z > Z1) continue;
      const ang = Math.atan2(z + 0.5 - sz, x + 0.5 - sx);
      g.set(x, y, z, y - (TOP + 1) < 2 ? k.gold : pm(Math.floor((ang + Math.PI) * 5), 2) ? k.paint : k.paintRed);
    }
  // the piers: marble below, tiled or painted, a stalactite capital where the arches spring
  const spring = TOP - 14;
  for (const [px, pz] of piers)
    g.box(Math.floor(px - 3), Y, Math.floor(pz - 3), Math.floor(px + 2), TOP + 2, Math.floor(pz + 2), (x, y, z) => {
      const row = y - Y, edge = Math.abs(x + 0.5 - px) > 2.4 || Math.abs(z + 0.5 - pz) > 2.4;
      if (row < 2) return k.marbleGrey;
      if (row < 8) return edge && pm(row, 3) === 0 ? k.marbleVein : k.marble;
      if (f.rich && row < 16) return iznik(k, x + z, row, 0);
      if (y >= spring - 2 && y <= spring) return pm(x + z + y, 2) ? k.marble : k.goldDeep;
      return kalem(k, x + z, row);
    });
  // the great arches between the piers: red and white voussoirs, the wall over them up to the dome's ring
  const arch = (u: number, half: number) => {
    const t = Math.min(1, Math.abs(u) / half);
    return spring + Math.round(12 * Math.sqrt(Math.max(0, 1 - t * t)) * 0.8 + 12 * 0.2 * (1 - t));
  };
  for (const zz of [Math.floor(cz - bz), Math.floor(cz + bz) - 1]) g.box(Math.floor(cx - a + 3), spring, zz, Math.floor(cx + a - 4), TOP + 2, zz + 1, (x, y) => {
    const top = arch(x + 0.5 - cx, a - 3);
    if (y < top) return 0;
    if (y < top + 2) return pm(x + (y >> 1), 2) ? k.paintRed : k.marble;
    return kalem(k, x, y - Y);
  });
  for (const xx of [Math.floor(cx - a), Math.floor(cx + a) - 1]) g.box(xx, spring, Math.floor(cz - bz + 3), xx + 1, TOP + 2, Math.floor(cz + bz - 4), (_x, y, z) => {
    const top = arch(z + 0.5 - cz, bz - 3);
    if (y < top) return 0;
    if (y < top + 2) return pm(z + (y >> 1), 2) ? k.paintRed : k.marble;
    return kalem(k, z, y - Y);
  });
  // pendentives: the corners between the square and the dome's ring curve down to the piers
  g.box(Math.floor(cx - a), TOP - 9, Math.floor(cz - bz), Math.ceil(cx + a) - 1, TOP + 2, Math.ceil(cz + bz) - 1, (x, y, z) => {
    if (!square(x, z)) return g.get(x, y, z);
    const d = dMain(x, z);
    if (d < R - 1.5 + (TOP + 2 - y) * 0.9) return g.get(x, y, z);
    return pm(Math.floor(d) + y, 5) === 0 ? k.gold : kalem(k, x + z, y - Y);
  });
  // the calligraphic roundels on the piers, facing across the hall
  piers.forEach(([px, pz], i) => {
    const xf = px < cx ? Math.floor(px + 3) : Math.floor(px - 4), cy = Y + Math.round(H * 0.5);
    for (let y = cy - 6; y <= cy + 6; y++) for (let z = Math.floor(pz - 6); z <= Math.ceil(pz + 6); z++) {
      const c = roundel(k, z + 0.5 - pz, y + 0.5 - cy, 5.5, i * 3 + R);
      if (c) g.set(xf, y, z, c);
    }
  });
  // the carpet in rows facing the qibla, a border round it, stone and the shoe racks by the door
  const shoes = AZ1 - 4;
  g.box(AX0, Y - 1, AZ0, AX1, Y - 1, AZ1, (x, _y, z) => {
    if (z > shoes) return ((x + z) >> 1) & 1 ? k.marbleGrey : k.marble;
    const e = Math.min(x - AX0, AX1 - x, z - AZ0, shoes - z);
    if (e === 0) return k.carpetBlue;
    if (e === 1) return k.carpetGold;
    if (e === 2) return k.carpetBlue;
    if (Math.abs(x + 0.5 - mx) < 3 && z - AZ0 < 10) return z - AZ0 === 9 || Math.abs(x + 0.5 - mx) > 2.2 ? k.carpetGold : k.carpetGreen;
    const v = pm(z - AZ0 - 3, 6), u = pm(x - AX0 - 3, 5);
    if (v === 5) return k.carpetGold;
    if (u === 0) return k.carpetDeep;
    if (v === 4 && u === 2) return k.carpetGold;
    if (v === 3 && (u === 1 || u === 3)) return k.carpetGold;
    if (v === 1 && u === 2) return k.carpetCream;
    return k.carpet;
  });
  for (const [x0, x1] of [[AX0, f.door[0] - 6], [f.door[1] + 6, AX1]] as const)
    g.box(x0, Y, AZ1 - 1, x1, Y + 5, AZ1, (x, y, z) => (y === Y + 5 || pm(y - Y, 2) === 0 ? k.walnut : z === AZ1 ? k.walnutDark : pm(x, 3) === 0 ? k.walnutDark : hash3(x, y, z) < 0.3 ? [k.pDark, k.pBrown, k.pRed][Math.floor(hash3(z, y, x) * 3)] : 0));
  // the great door: open, its leaves folded back inside
  g.box(f.door[0], Y, Z1 - 1, f.door[1], Y + 10, Z1, 0);
  for (const xx of [f.door[0] - 1, f.door[1] + 1]) g.box(xx, Y, AZ1 - 4, xx, Y + 10, AZ1, (_x, y, z) => (pm(y + z, 3) === 0 ? k.brass : k.walnutDark));
  // the mihrab: a marble frame on the qibla wall, a niche under a hood of stalactites, an inscription over it,
  // a cresting, colonnettes; the great candlesticks either side
  {
    const z0 = AZ0, x0 = mx - 8, x1 = mx + 7, yTop = Y + Math.min(31, H - 6);
    g.box(x0, Y, z0, x1, yTop, z0 + 2, (x, y, z) => {
      const u = x - x0, row = y - Y, inN = x >= mx - 4 && x <= mx + 3;
      const archTop = 18 + Math.round(4 * (1 - Math.abs(x + 0.5 - mx) / 4.5));
      if (inN && row < archTop && z > z0) return 0;
      if (inN && row < archTop) return row < 2 ? k.marbleGrey : f.rich ? iznik(k, x, row, 0) : (row % 4 === 0 ? k.marbleVein : k.marble);
      if (inN && row < 25 && z === z0 + 1 && row >= archTop) return pm(x + row, 2) ? k.marble : k.goldDeep; // the hood
      if (row >= yTop - Y - 5 && row <= yTop - Y - 2) return inscription(k, u, row - (yTop - Y - 5), 4, 3);
      if (row === yTop - Y) return pm(x, 2) ? k.marble : 0;
      if (u <= 1 || u >= x1 - x0 - 1) return k.marble;
      if (z === z0 + 2) return f.rich ? iznik(k, u, row, 1) : (pm(u + row, 6) === 0 ? k.goldDeep : k.marble);
      return k.marble;
    });
    for (const xx of [mx - 5, mx + 4]) g.box(xx, Y, z0 + 3, xx, Y + 18, z0 + 3, (_x, y) => (pm(y - Y, 5) === 0 ? k.gold : k.marble));
    for (const xx of [mx - 11, mx + 10]) {
      g.box(xx, Y, z0 + 4, xx + 1, Y + 1, z0 + 5, k.brass);
      g.box(xx, Y + 2, z0 + 4, xx, Y + 7, z0 + 4, (_x, y) => (pm(y, 2) ? k.brass : k.gold));
      g.box(xx, Y + 8, z0 + 4, xx, Y + 11, z0 + 4, k.wax);
      g.set(xx, Y + 12, z0 + 4, k.flame);
    }
  }
  // the minbar: a straight marble stair up to a little kiosk under a spire, its sides pierced with lattice,
  // a gate with a crown at its foot
  {
    const x0 = mx + 12, x1 = x0 + 3, zt = AZ0, zg = AZ0 + 26, topH = 12;
    const step = (z: number) => (z <= zt + 4 ? topH : Math.max(1, Math.round(topH * (zg - z) / (zg - zt - 4))));
    g.box(x0, Y, zt, x1, Y + topH + 3, zg - 1, (x, y, z) => {
      const h = step(z), side = x === x0 || x === x1, row = y - Y;
      if (!side) return row < h ? (row === h - 1 ? k.marbleWarm : k.marble) : 0;
      if (row > h + 2) return 0;
      if (row === h + 2 || row === 0) return k.marbleGrey;
      return pm(z + row, 4) === 0 || pm(z - row, 4) === 0 ? k.marbleVein : k.marble;
    });
    g.box(x0 - 1, Y, zg, x1 + 1, Y + 17, zg + 1, (x, y) => {
      const row = y - Y;
      if (x > x0 && x < x1 && row < 10) return 0;
      if (row > 13) return pm(x + row, 2) ? k.marble : row === 17 ? 0 : k.gold;
      return row === 10 || row === 13 ? k.gold : k.marble;
    });
    for (const [x, z] of [[x0, zt], [x1, zt], [x0, zt + 4], [x1, zt + 4]]) g.box(x, Y + topH, z, x, Y + topH + 9, z, k.marble);
    for (let i = 0; i < 13; i++) {
      const hw = 2.6 * (1 - i / 13);
      g.box(Math.floor(x0 + 1.5 - hw), Y + topH + 10 + i, Math.floor(zt + 2 - hw), Math.ceil(x0 + 1.5 + hw), Y + topH + 10 + i, Math.ceil(zt + 2 + hw), (x, _y, z) => (Math.max(Math.abs(x + 0.5 - (x0 + 2)), Math.abs(z + 0.5 - (zt + 2.5))) <= hw + 0.5 ? (i === 0 ? k.gold : pm(i, 3) === 0 ? k.marbleGrey : k.marble) : 0));
    }
    g.box(x0 + 1, Y + topH + 23, zt + 2, x0 + 1, Y + topH + 26, zt + 2, k.gold);
  }
  // the preacher's chair, walnut inlaid with mother of pearl, on the other side of the mihrab
  {
    const x0 = mx - 18, x1 = mx - 15, z0 = AZ0 + 9, z1 = AZ0 + 12;
    g.box(x0, Y, z0, x1, Y + 5, z1, (x, y, z) => (y === Y + 5 ? k.walnutDark : pm(x + y + z, 3) === 0 ? k.pearl : k.walnut));
    g.box(x0, Y + 6, z0, x1, Y + 10, z0, (x, y) => (y === Y + 10 ? k.gold : pm(x + y, 2) ? k.pearl : k.walnut));
    g.box(x0 + 1, Y, z1 + 1, x1 - 1, Y + 2, z1 + 2, (_x, y, z) => (y - Y < z1 + 3 - z ? k.walnut : 0));
  }
  // the muezzins' platform on slender columns by the rear left pier, railed in marble lattice
  {
    const [px, pz] = piers[2];
    const x0 = Math.floor(px + 4), x1 = x0 + 9, z0 = Math.floor(pz - 10), z1 = Math.floor(pz - 2);
    g.box(x0, Y + 9, z0, x1, Y + 10, z1, (x, y, z) => (y === Y + 9 ? (pm(x + z, 3) === 0 ? k.gold : k.paint) : k.carpet));
    for (const [x, z] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) g.box(x, Y, z, x, Y + 8, z, (_x, y) => (y === Y + 8 || y === Y ? k.gold : k.marble));
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      if (x !== x0 && x !== x1 && z !== z0 && z !== z1) continue;
      g.box(x, Y + 11, z, x, Y + 13, z, (_x, y) => (y === Y + 13 ? k.marbleWarm : pm(x + z + y, 2) ? k.marble : 0));
    }
  }
  // galleries along the side walls on columns, behind a pierced wooden balustrade (Süleymaniye's are of stone)
  if (galleries) for (const [g0, g1, rail] of [[AX0, AX0 + 5, AX0 + 6], [AX1 - 5, AX1, AX1 - 6]] as const) {
    const z0 = AZ0 + 14, z1 = AZ1 - 8;
    g.box(g0, Y + 15, z0, g1, Y + 16, z1, (x, y, z) => (y === Y + 15 ? (pm(x + z, 4) === 0 ? k.paintRed : k.paint) : k.carpet));
    g.box(rail, Y + 15, z0, rail, Y + 19, z1, (_x, y, z) => (y === Y + 19 ? k.marbleWarm : y === Y + 15 ? k.paintRed : pm(z + y, 2) ? k.marble : 0));
    for (let z = z0; z <= z1; z += 12) g.box(rail, Y, z, rail, Y + 14, z, (_x, y) => (y > Y + 12 ? k.gold : y < Y + 1 ? k.marbleGrey : k.marble));
  }
  // the qibla wall's two smaller roundels either side of the mihrab
  for (const dx of [-22, 21]) {
    const cxr = mx + dx + 0.5, cyr = Y + 16;
    for (let y = cyr - 4; y <= cyr + 4; y++) for (let x = Math.floor(cxr - 4); x <= Math.ceil(cxr + 4); x++) {
      const c = roundel(k, x + 0.5 - cxr, y + 0.5 - cyr, 3.6, dx + R);
      if (c && !f.opening(x, y, Z0)) g.set(x, y, AZ0, c);
    }
  }
  return hall;
}
