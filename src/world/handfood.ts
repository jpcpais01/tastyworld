import { rng } from './grid';
import { Palette } from './palette';
import { Prop } from './props';
import { buildFood, foodColors, FoodId } from './food';

/**
 * Food as it is held and eaten: a vessel in one hand (boat, bowl, plate, cup), the food itself or a utensil in the
 * other, and the pieces that get eaten bite by bite. Voxel coordinates: x across, y up, z away from the eater.
 */

export type V3 = [number, number, number];

/** Something eaten in one go (or two bites): every edible voxel inside the ellipsoid around `at`. */
export interface Piece { at: V3; r: V3; noodle?: boolean }

export interface HandModel {
  prop: Prop;
  /** Sits in the middle of the fist. */
  grip: V3;
  /** Utensil tip, or the rim a drink is sipped from. */
  tip?: V3;
  /** Items bitten from one end: bites advance against this direction (the leading edge is furthest along it). */
  axis?: V3;
  /** Where the other hand holds a two-handed item. */
  grip2?: V3;
  pieces?: Piece[];
  /** Palette ids that are never eaten: paper, sticks, plates. */
  keep?: number[];
  /** A sauce to dip into. */
  dip?: V3;
  /** Own display scale (utensils are drawn smaller than the food). */
  k?: number;
}

export type Style =
  | 'toothpick' | 'pick' | 'hera' | 'pop' | 'skewer' | 'yakitori' | 'bite' | 'sandwich'
  | 'slurp' | 'soba' | 'dip' | 'chopsticks' | 'sushi' | 'spoon' | 'twirl' | 'sip';

export interface MealKit {
  style: Style;
  pal: Palette;
  /** Held in the -x hand. */
  vessel?: HandModel;
  /** Held in the +x hand: a utensil, or the food itself. */
  held?: HandModel;
  /** Morsels lifted from the vessel are wound noodles or a twirl of pasta instead of a copy of the piece. */
  noodle?: [number, number];
  pasta?: [number, number];
  /** Display scale of the models (voxels are 1/40 m before scaling). */
  scale: number;
  bites: number;
  /** Bites per morsel lifted from the vessel. */
  bitesPer: number;
  /** Bite radius in voxels. */
  biteR: number;
  steam: number;
  crunch: boolean;
  hot?: boolean;
  /** A drink: sips instead of bites. */
  drink?: boolean;
}

export const VOX = 1 / 40;

/** Build the hand kit for a dish, or for a shop snack (by its icon). */
export function mealKit(id: string): MealKit {
  const pal = new Palette();
  const c = foodColors(pal);
  const kit = (style: Style, o: Partial<MealKit>): MealKit => ({ style, pal, scale: 0.78, bites: 3, bitesPer: 1, biteR: 4, steam: 0, crunch: false, ...o });
  switch (id as FoodId) {
    case 'takoyaki': return kit('toothpick', { vessel: takoBoat(c), held: stick(c, c.pick, 15), bites: 4, steam: 0.9, hot: true });
    case 'monjayaki': return kit('hera', { vessel: monjaPlate(c, pal), held: hera(c), steam: 0.8, hot: true });
    case 'ningyoyaki': return kit('pop', { vessel: cakeBag(c), bites: 3 });
    case 'dango': return kit('skewer', { held: dangoStick(c), biteR: 3.6, scale: 0.75 });
    case 'taiyaki': return kit('bite', { held: taiyaki(c), biteR: 4.6, steam: 0.35, crunch: true, scale: 0.64 });
    case 'dorayaki': return kit('sandwich', { held: dorayaki(c), biteR: 4.6, scale: 0.66 });
    case 'yakitori': return kit('yakitori', { held: yakitori(c), biteR: 3.4, steam: 0.4, scale: 0.72 });
    case 'karaage': return kit('pick', { vessel: karaageCup(c), held: stick(c, c.skewer, 20), bites: 2, bitesPer: 2, biteR: 2.6, crunch: true, steam: 0.4 });
    case 'ramen': return kit('slurp', { vessel: ramenBowl(pal), held: chopsticks(c), noodle: [c.noodle, c.noodle], bites: 3, scale: 0.64, steam: 1, hot: true });
    case 'gyoza': return kit('dip', { vessel: gyozaPlate(c), held: chopsticks(c), bitesPer: 2, biteR: 3.2, crunch: true, steam: 0.6 });
    case 'nigiri': return kit('sushi', { vessel: geta(c), scale: 0.8 });
    case 'tamagoyaki': return kit('chopsticks', { vessel: tamagoPlate(c), held: chopsticks(c), bitesPer: 2, biteR: 3 });
    case 'purin': return kit('spoon', { vessel: purinGlass(c), held: spoon(c), scale: 0.8 });
    case 'napolitan': return kit('twirl', { vessel: pastaPlate(c), held: fork(c), pasta: [c.pasta, c.pastaHi], steam: 0.6 });
    case 'zarusoba': return kit('soba', { vessel: zaru(pal), held: chopsticks(c), noodle: [c.sobaN, c.sobaHi], scale: 0.6 });
    case 'tempura': return kit('dip', { vessel: tempuraTray(pal), held: chopsticks(c), bitesPer: 2, biteR: 3.4, crunch: true, scale: 0.62, steam: 0.4 });
  }
  return snackKit(id, kit, pal, c);
}

type FC = ReturnType<typeof foodColors>;
type KitFn = (style: Style, o: Partial<MealKit>) => MealKit;

/** Konbini, café, bar and bakery snacks, keyed by their menu icon. */
function snackKit(icon: string, kit: KitFn, pal: Palette, c: FC): MealKit {
  const a = (hex: number, vary = 0.05) => pal.add(hex, { vary });
  switch (icon) {
    case '🥤': return kit('sip', { held: can(a(0x2f7ad8), a(0xf4f1ea), c), drink: true, bites: 2 });
    case '☕': return kit('sip', { held: cup(c.plate, a(0x5a3218), c), drink: true, bites: 2, steam: 0.7 });
    case '🧋': return kit('sip', { held: glass(a(0x9cc46a), c, true), drink: true, bites: 2 });
    case '🍵': return kit('sip', { held: glass(a(0xc08a3a), c, true), drink: true, bites: 2 });
    case '🧃': return kit('sip', { held: bottle(a(0x7a3a12, 0.03), a(0xf2c74a), c), drink: true, bites: 1 });
    case '🍙': return kit('bite', { held: onigiri(c), biteR: 4 });
    case '🥪': return kit('bite', { held: sando(c, a(0xf6dc6a)), biteR: 4 });
    case '🍞': return kit('bite', { held: sando(c, c.bean), biteR: 4.4 });
    case '🥟': return kit('bite', { held: bun(a(0xf8f4ea, 0.03), a(0xe6dccb, 0.03), a(0xb06a40)), biteR: 4.4, steam: 0.7 });
    case '🍈': return kit('bite', { held: bun(a(0xe8c25a, 0.06), a(0xd8a640, 0.06), a(0xfbf0d0)), biteR: 4.4, crunch: true });
    case '🍛': return kit('bite', { held: bun(a(0xc8803a, 0.12), a(0x9a5a24, 0.1), a(0xb8742a)), biteR: 4.4, crunch: true });
    case '🥯': return kit('bite', { held: bun(a(0xc87a3a, 0.06), a(0xa85a2a, 0.06), c.bean, true), biteR: 4.4 });
    case '🍗': return kit('pick', { vessel: karaageCup(c), held: stick(c, c.pick, 15), bites: 2, bitesPer: 2, biteR: 2.6, crunch: true });
    case '🍢': return kit('bite', { held: chikuwa(a(0xf2e6c8, 0.03), a(0xb8742a, 0.1), c), biteR: 3.6 });
    case '🐟': return kit('bite', { held: saba(a(0xd9d2c4, 0.06), a(0x6a6f7a, 0.08), c), biteR: 4 });
    case '🫛': return kit('pop', { vessel: bowlOf(c, a(0x6fae4a, 0.1), a(0x8cc65a, 0.08)) });
    case '🥒': return kit('chopsticks', { vessel: bowlOf(c, a(0x8cc65a, 0.08), a(0xf2d84a, 0.05)), held: chopsticks(c), bitesPer: 1 });
  }
  return kit('bite', { held: bun(c.batter, c.batterDark, c.bean), biteR: 4.4 });
}

const ell = (p: Prop, at: V3, r: V3, col: number | ((x: number, y: number, z: number) => number)) => p.ellipsoid(at[0], at[1], at[2], r[0], r[1], r[2], col);
/** Top filled y of a column, or -1. */
const topAt = (p: Prop, x: number, z: number): number => { for (let y = p.sy - 1; y >= 0; y--) if (p.get(x, y, z)) return y; return -1; };

// ---------------------------------------------------------------------------------------------- utensils

function stick(_c: FC, col: number, len: number): HandModel {
  const p = new Prop(1, 1, len, VOX);
  p.box(0, 0, 0, 0, 0, len - 1, col);
  return { prop: p, grip: [0.5, 0.5, 2.5], tip: [0.5, 0.5, len - 1], k: 0.55 };
}

function chopsticks(c: FC): HandModel {
  const p = new Prop(3, 2, 26, VOX);
  for (let z = 0; z < 26; z++) {
    const col = z < 10 ? c.bowl : c.skewer;
    p.set(0, 1, z, col);
    p.set(z < 17 ? 2 : 1, z < 17 ? 1 : 0, z, col);
  }
  return { prop: p, grip: [1.5, 1, 6], tip: [0.8, 0.6, 25], k: 0.55 };
}

function spoon(c: FC): HandModel {
  const p = new Prop(5, 2, 18, VOX);
  p.box(2, 1, 0, 2, 1, 11, c.steelLight);
  p.box(1, 1, 3, 3, 1, 5, c.steelLight);
  p.box(0, 0, 12, 4, 0, 17, c.steelLight);
  p.box(0, 1, 12, 0, 1, 17, c.steelLight); p.box(4, 1, 12, 4, 1, 17, c.steelLight); p.box(1, 1, 17, 3, 1, 17, c.steelLight);
  return { prop: p, grip: [2.5, 1, 3.5], tip: [2.5, 1.2, 14.5], k: 0.55 };
}

function fork(c: FC): HandModel {
  const p = new Prop(5, 1, 19, VOX);
  p.box(1, 0, 0, 3, 0, 4, c.steelLight);
  p.box(2, 0, 5, 2, 0, 12, c.steelLight);
  p.box(0, 0, 13, 4, 0, 13, c.steelLight);
  for (const x of [0, 2, 4]) p.box(x, 0, 14, x, 0, 18, c.steelLight);
  return { prop: p, grip: [2.5, 0.5, 3], tip: [2.5, 0.5, 16.5], k: 0.55 };
}

function hera(c: FC): HandModel {
  const p = new Prop(4, 2, 15, VOX);
  p.box(1, 1, 0, 2, 1, 9, c.skewer);
  p.box(0, 0, 10, 3, 0, 14, c.steelLight);
  p.box(1, 1, 10, 2, 1, 10, c.steel);
  return { prop: p, grip: [1.5, 1, 3], tip: [2, 0.5, 12.5], k: 0.55 };
}

// ---------------------------------------------------------------------------------------------- street food

function takoBoat(c: FC): HandModel {
  const p = new Prop(18, 11, 14, VOX);
  p.box(0, 0, 0, 17, 0, 13, c.tray);
  p.box(0, 1, 0, 17, 2, 0, c.trayDark); p.box(0, 1, 13, 17, 2, 13, c.trayDark);
  p.box(0, 1, 0, 0, 2, 13, c.trayDark); p.box(17, 1, 0, 17, 2, 13, c.trayDark);
  const r = rng(31);
  const pieces: Piece[] = [];
  for (const [cx, cz] of [[5, 4], [12.5, 4.5], [5.5, 10], [12.5, 9.5]]) {
    ell(p, [cx, 4.4, cz], [3.4, 3.3, 3.4], (_x, y) => (y >= 6 ? c.sauce : r() < 0.25 ? c.batterDark : c.batter));
    pieces.push({ at: [cx, 5.2, cz], r: [3.9, 4.6, 3.9] });
  }
  // a zigzag of mayo, then nori and bonito flakes settling on top
  for (let x = 1; x < 17; x++) for (const z0 of [3, 9]) {
    const z = z0 + Math.round(Math.abs(((x * 0.9) % 4) - 2));
    const y = topAt(p, x, z);
    if (y >= 5) p.set(x, y + 1, z, c.mayo);
  }
  for (let k = 0; k < 46; k++) {
    const x = 1 + Math.floor(r() * 16), z = 1 + Math.floor(r() * 12);
    const y = topAt(p, x, z);
    if (y >= 4) p.set(x, y + 1, z, r() < 0.45 ? c.nori : c.bonito);
  }
  return { prop: p, grip: [9, 0, 7], pieces, keep: [c.tray, c.trayDark] };
}

function monjaPlate(c: FC, _pal: Palette): HandModel {
  const p = new Prop(18, 4, 18, VOX);
  p.cylY(9, 9, 8.6, 0, 0, c.steel);
  p.cylY(9, 9, 8.6, 1, 1, c.steel);
  const r = rng(32);
  p.cylY(9, 9, 7.6, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - 9, z + 0.5 - 9) > 6 ? c.monjaCrisp : r() < 0.15 ? c.cabbage : r() < 0.08 ? c.mentaiko : r() < 0.07 ? c.cheese : c.monja));
  for (let k = 0; k < 22; k++) {
    const x = 4 + Math.floor(r() * 10), z = 4 + Math.floor(r() * 10);
    p.set(x, 2, z, r() < 0.5 ? c.cabbage : r() < 0.5 ? c.mentaiko : c.monja);
  }
  const pieces: Piece[] = [[6, 7], [11.5, 6.5], [9, 11.5]].map(([x, z]) => ({ at: [x, 1.6, z] as V3, r: [2.8, 1.3, 2.8] as V3 }));
  return { prop: p, grip: [9, 0, 9], pieces, keep: [c.steel] };
}

function cakeBag(c: FC): HandModel {
  const p = new Prop(13, 13, 9, VOX);
  p.box(0, 0, 0, 12, 7, 8, c.paper);
  p.box(1, 1, 1, 11, 7, 7, 0);
  p.box(0, 3, 0, 12, 3, 0, c.paperRed); p.box(0, 3, 8, 12, 3, 8, c.paperRed);
  // a pagoda, a lantern and a pigeon, standing up in the bag
  p.box(2, 3, 3, 4, 8, 5, c.batter); p.box(1, 8, 2, 5, 8, 6, c.batterDark); p.box(2, 9, 3, 4, 10, 5, c.batter); p.set(3, 11, 4, c.batterDark);
  ell(p, [6.5, 7.5, 4.5], [1.9, 3, 1.9], c.batterLight); p.box(5, 10, 3, 7, 10, 5, c.batterDark); p.box(5, 4, 3, 7, 4, 5, c.batterDark);
  ell(p, [10, 6.5, 4.5], [1.6, 2.6, 1.8], c.batter); ell(p, [10.5, 9.4, 4.5], [1.2, 1.2, 1.2], c.batter); p.set(10, 9, 3, c.sauce); p.set(11, 9, 5, c.batterDark);
  const pieces: Piece[] = [{ at: [6.5, 7, 4.5], r: [2.3, 4.2, 2.4] }, { at: [3, 7, 4], r: [2.4, 5, 2.6] }, { at: [10.2, 7.5, 4.5], r: [2.2, 4, 2.4] }];
  return { prop: p, grip: [6.5, 0, 4.5], pieces, keep: [c.paper, c.paperRed] };
}

function dangoStick(c: FC): HandModel {
  const p = new Prop(7, 26, 7, VOX);
  p.box(3, 0, 3, 3, 25, 3, c.skewer);
  for (const yc of [8.5, 14, 19.5])
    ell(p, [3.5, yc, 3.5], [2.9, 2.8, 2.9], (_x, y, z) => (y + 0.5 >= yc + 0.6 || z <= 1 ? (y + 0.5 >= yc + 1.8 ? c.mitarashiGloss : c.mitarashi) : c.dango));
  const pieces: Piece[] = [19.5, 14, 8.5].map((y) => ({ at: [3.5, y, 3.5] as V3, r: [3.4, 2.9, 3.4] as V3 }));
  return { prop: p, grip: [3.5, 2.5, 3.5], axis: [0, 1, 0], pieces, keep: [c.skewer] };
}

function yakitori(c: FC): HandModel {
  const p = new Prop(5, 5, 24, VOX);
  p.box(2, 2, 0, 2, 2, 23, c.skewer);
  const pieces: Piece[] = [];
  [17, 12.5, 8].forEach((z0, i) => {
    pieces.push({ at: [2.5, 2.5, Math.round(z0) + 2], r: [3.4, 3.4, 2.4] });
    const negi = i === 1;
    for (let z = Math.round(z0); z <= Math.round(z0) + 3; z++)
      for (let y = 0; y <= 4; y++) for (let x = 0; x <= 4; x++) {
        if ((x === 0 || x === 4) && (y === 0 || y === 4)) continue;
        p.set(x, y, z, negi ? (y >= 3 ? c.scallion : c.scallionWhite) : y >= 4 ? c.chickenGlaze : (x + z) % 4 === 0 ? c.chickenGlaze : c.chicken);
      }
  });
  return { prop: p, grip: [2.5, 2.5, 2], axis: [0, 0, 1], pieces, keep: [c.skewer] };
}

function taiyaki(c: FC): HandModel {
  // stands on its belly, flat sides facing left and right; tail at z 0, head at z 21
  const p = new Prop(9, 13, 23, VOX);
  const half = (t: number) => (t < 0.2 ? 2 + (0.2 - t) * 22 : 5.3 * Math.sin(Math.min(1, (t - 0.2) / 0.8) * Math.PI * 0.92 + 0.14));
  for (let z = 0; z <= 21; z++) {
    const t = z / 21, hh = half(t);
    for (let y = 0; y < 13; y++) {
      const dy = Math.abs(y + 0.5 - 6.5);
      if (dy > hh) continue;
      const core = t > 0.22 && t < 0.92 && dy < hh - 1.6;
      const thick = t < 0.2 ? 1 : core ? 3 : 2;
      for (let x = 4 - thick; x <= 4 + thick; x++) {
        const inner = core && Math.abs(x - 4) <= 1;
        const scale = (y + z) % 3 === 0 && Math.abs(x - 4) === thick && t > 0.25 && t < 0.8;
        p.set(x, y, z, inner ? c.bean : scale ? c.batterDark : y + 0.5 > 6.5 + hh - 1 ? c.batterDark : c.batter);
      }
    }
  }
  for (const x of [1, 7]) { p.set(x, 7, 18, c.sauce); p.set(x, 8, 18, c.batterLight); }
  // paper sleeve around the tail
  for (let z = 0; z <= 7; z++) for (let y = 0; y < 13; y++) {
    if (!p.get(4, y, z) || p.get(4, y, z) === c.paper) continue;
    let lo = 4, hi = 4;
    while (p.get(lo - 1, y, z) && p.get(lo - 1, y, z) !== c.paper) lo--;
    while (p.get(hi + 1, y, z) && p.get(hi + 1, y, z) !== c.paper) hi++;
    const col = z === 7 ? c.paperRed : c.paper;
    p.set(lo - 1, y, z, col); p.set(hi + 1, y, z, col);
    if (!p.get(4, y + 1, z)) p.box(lo - 1, y + 1, z, hi + 1, y + 1, z, col);
    if (y > 0 && !p.get(4, y - 1, z)) p.box(lo - 1, y - 1, z, hi + 1, y - 1, z, col);
  }
  return { prop: p, grip: [4.5, 6.5, 3], axis: [0, 0, 1], keep: [c.paper, c.paperRed] };
}

function dorayaki(c: FC): HandModel {
  const p = new Prop(17, 9, 17, VOX);
  p.cylY(8.5, 8.5, 7.8, 0, 0, c.batterDark);
  p.cylY(8.5, 8.5, 8.2, 1, 2, c.batterLight);
  p.cylY(8.5, 8.5, 7.6, 3, 4, c.bean);
  p.cylY(8.5, 8.5, 8.2, 5, 6, c.batterLight);
  p.cylY(8.5, 8.5, 7.8, 7, 7, c.batterDark);
  p.cylY(8.5, 8.5, 4.6, 7, 7, c.batter);
  p.cylY(8.5, 8.5, 2.2, 7, 7, c.batterDark);
  return { prop: p, grip: [16.5, 3.5, 7.5], grip2: [0.5, 3.5, 7.5], axis: [0, 0, 1] };
}

function karaageCup(c: FC): HandModel {
  const p = new Prop(12, 11, 12, VOX);
  p.cylY(6, 6, 5.6, 0, 6, (x, y) => (y >= 2 && y <= 3 && x % 2 ? c.paperRed : c.paper));
  p.cylY(6, 6, 4.6, 1, 6, 0);
  p.cylY(6, 6, 4.6, 1, 3, c.paper);
  p.cylY(6, 6, 4.4, 4, 4, c.lettuce);
  const r = rng(34);
  const at: V3[] = [[4, 6.5, 4.5], [8.2, 6.8, 5.2], [5.8, 7.6, 8.4]];
  for (const q of at) ell(p, q, [2.7, 2.4, 2.6], () => (r() < 0.35 ? c.karaageDark : c.karaage));
  p.box(9, 5, 8, 10, 8, 8, c.lemon);
  return { prop: p, grip: [6, 0, 6], pieces: at.map((q) => ({ at: q, r: [3, 2.8, 2.9] as V3 })), keep: [c.paper, c.paperRed, c.lettuce, c.lemon] };
}

function ramenBowl(pal: Palette): HandModel {
  const prop = buildFood('ramen', pal);
  const c = foodColors(pal);
  return {
    prop, grip: [11, 0, 11], tip: [11, 9, 1.5],
    pieces: [{ at: [9.5, 9.4, 11], r: [3.2, 1.2, 3.2], noodle: true }, { at: [6.5, 9.2, 6], r: [3.2, 1.5, 2.8] }, { at: [12.5, 9.4, 13.5], r: [3.4, 1.2, 3], noodle: true }, { at: [14.5, 9.8, 6], r: [2.8, 1.6, 2.2] }],
    keep: [c.bowl, c.bowlIn, c.broth, c.brothHi, c.nori, c.naruto, c.narutoPink],
  };
}

function gyozaPlate(c: FC): HandModel {
  const p = new Prop(21, 6, 14, VOX);
  p.box(0, 0, 0, 20, 0, 13, c.plate);
  p.box(0, 1, 0, 20, 1, 0, c.plate); p.box(0, 1, 13, 20, 1, 13, c.plate);
  p.box(1, 1, 2, 13, 1, 11, c.wing);
  const pieces: Piece[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 2 + i * 4;
    p.box(x0, 1, 3, x0 + 2, 1, 10, c.gyozaBrown);
    p.box(x0, 2, 3, x0 + 2, 3, 10, c.gyoza);
    p.box(x0 + 1, 4, 4, x0 + 1, 4, 9, c.gyoza);
    for (let z = 4; z <= 9; z += 2) p.set(x0 + 1, 5, z, c.gyoza);
    pieces.push({ at: [x0 + 1.5, 3, 6.5], r: [2, 3.4, 4.6] });
  }
  // a little dish of vinegar soy with chilli oil
  p.cylY(17, 7, 2.9, 1, 2, c.plateBlue);
  p.cylY(17, 7, 2.1, 2, 2, c.tsuyu);
  p.set(17, 2, 6, c.mentaiko);
  return { prop: p, grip: [10, 0, 7], pieces, keep: [c.plate, c.plateBlue, c.tsuyu, c.mentaiko], dip: [17, 2.6, 7] };
}

function geta(c: FC): HandModel {
  const p = new Prop(22, 8, 11, VOX);
  p.box(0, 2, 1, 21, 2, 9, c.geta);
  p.box(2, 0, 2, 3, 1, 8, c.getaDark); p.box(18, 0, 2, 19, 1, 8, c.getaDark);
  const tops = [c.tuna, c.shrimp, c.tamago];
  const pieces: Piece[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 1 + i * 6;
    p.box(x0, 3, 3, x0 + 3, 4, 7, c.rice);
    p.box(x0, 5, 2, x0 + 3, 5, 8, tops[i]);
    if (i === 1) for (let z = 3; z <= 8; z += 2) p.box(x0, 5, z, x0 + 3, 5, z, c.shrimpStripe);
    if (i === 2) p.box(x0 + 1, 3, 5, x0 + 2, 6, 5, c.nori);
    pieces.push({ at: [x0 + 1.5, 4.5, 5], r: [2.6, 2.6, 4.2] });
  }
  p.box(19, 3, 2, 20, 4, 3, c.wasabi);
  p.box(19, 3, 6, 21, 3, 8, c.ginger);
  return { prop: p, grip: [11, 0, 5], pieces, keep: [c.geta, c.getaDark, c.wasabi, c.ginger] };
}

function tamagoPlate(c: FC): HandModel {
  const p = new Prop(19, 9, 12, VOX);
  p.box(0, 0, 0, 18, 0, 11, c.plateBlue);
  p.box(0, 0, 0, 18, 0, 0, c.plateRim); p.box(0, 0, 11, 18, 0, 11, c.plateRim);
  p.box(1, 1, 2, 15, 1, 9, c.shiso);
  const pieces: Piece[] = [];
  for (let i = 0; i < 3; i++) {
    const x0 = 2 + i * 5;
    for (let x = x0; x <= x0 + 2; x++) for (let y = 2; y <= 7; y++) for (let z = 3; z <= 8; z++)
      p.set(x, y, z, x === x0 && (y + z) % 3 === 0 ? c.tamagoDark : y === 7 ? c.tamagoDark : c.tamago);
    pieces.push({ at: [x0 + 1.5, 5, 6], r: [2, 3.6, 3.6] });
  }
  p.box(16, 1, 4, 17, 2, 6, c.daikon);
  return { prop: p, grip: [9, 0, 6], pieces, keep: [c.plateBlue, c.plateRim, c.shiso, c.daikon] };
}

function purinGlass(c: FC): HandModel {
  const p = new Prop(15, 15, 15, VOX);
  p.cylY(7.5, 7.5, 2.6, 0, 0, c.glass);
  p.cylY(7.5, 7.5, 1.2, 1, 2, c.glass);
  p.cylY(7.5, 7.5, 7, 3, 3, c.glass);
  p.cylY(7.5, 7.5, 7, 4, 4, c.glass);
  p.cylY(7.5, 7.5, 6.1, 4, 4, 0);
  for (let y = 4; y <= 10; y++) p.cylY(7.5, 7.5, 5 - (y - 4) * 0.33, y, y, (x, yy, z) => (yy >= 9 || (yy >= 6 && (x * 3 + z) % 5 === 0) ? c.caramel : c.custard));
  ell(p, [7.5, 11.6, 7.5], [2.2, 1.3, 2.2], c.cream);
  ell(p, [7.5, 13, 7.5], [1.2, 1.2, 1.2], c.cherry);
  p.set(7, 14, 8, c.shiso);
  const pieces: Piece[] = [{ at: [7.5, 12, 7.5], r: [2.9, 2.4, 2.9] }, { at: [7.5, 9, 7.5], r: [3.8, 1.6, 3.8] }, { at: [7.5, 6, 7.5], r: [5.6, 2.4, 5.6] }];
  return { prop: p, grip: [7.5, 0, 7.5], pieces, keep: [c.glass] };
}

function pastaPlate(c: FC): HandModel {
  const p = new Prop(21, 8, 21, VOX);
  p.cylY(10.5, 10.5, 10, 0, 0, c.plate);
  p.cylY(10.5, 10.5, 10, 1, 1, c.plate);
  p.cylY(10.5, 10.5, 9, 1, 1, 0);
  const r = rng(35);
  for (let y = 1; y <= 5; y++) p.cylY(10.5, 10.5, 7.6 - (y - 1) * 1.3, y, y, () => (r() < 0.3 ? c.pastaHi : c.pasta));
  for (let k = 0; k < 24; k++) {
    const a = r() * Math.PI * 2, d = r() * 6.5;
    const x = Math.round(10.5 + Math.cos(a) * d), z = Math.round(10.5 + Math.sin(a) * d);
    const y = topAt(p, x, z);
    if (y >= 1) p.set(x, y + 1, z, k % 3 === 0 ? c.pepper : k % 3 === 1 ? c.sausage : c.onion);
  }
  for (let k = 0; k < 10; k++) { const x = 8 + Math.floor(r() * 6), z = 8 + Math.floor(r() * 6); p.set(x, topAt(p, x, z) + 1, z, c.parmesan); }
  const pieces: Piece[] = [{ at: [10.5, 5, 10.5], r: [4.2, 3.4, 4.2] }, { at: [7, 2.5, 9], r: [4, 3, 4.6] }, { at: [13.5, 2.5, 12], r: [4.6, 3, 4.6] }];
  return { prop: p, grip: [10.5, 0, 10.5], pieces, keep: [c.plate] };
}

function zaru(pal: Palette): HandModel {
  const prop = buildFood('zarusoba', pal);
  const c = foodColors(pal);
  return {
    prop, grip: [14, 0, 10], dip: [23.5, 5.6, 6],
    pieces: [{ at: [8, 5.5, 8], r: [3.6, 3, 3.6], noodle: true }, { at: [12.5, 5, 11], r: [3.6, 3, 3.6], noodle: true }, { at: [10, 4, 9.5], r: [6.5, 3, 6], noodle: true }],
    keep: [c.bowl, c.zaru, c.zaruDark, c.choko, c.tsuyu, c.plate, c.negi, c.wasabi],
  };
}

function tempuraTray(pal: Palette): HandModel {
  const prop = buildFood('tempura', pal);
  const c = foodColors(pal);
  return {
    prop, grip: [13, 0, 10], dip: [21.5, 3.6, 15],
    pieces: [{ at: [11, 3.4, 6.5], r: [9.5, 2.8, 2.6] }, { at: [11, 3.4, 11.5], r: [9.5, 2.8, 2.6] }, { at: [7, 3.5, 15.5], r: [3.2, 1.6, 1.6] }],
    keep: [c.getaDark, c.paper, c.choko, c.tsuyu, c.daikon, c.shiso2],
  };
}

// ---------------------------------------------------------------------------------------------- snacks and drinks

function can(body: number, band: number, c: FC): HandModel {
  const p = new Prop(7, 12, 7, VOX);
  p.cylY(3.5, 3.5, 3.3, 0, 10, (_x, y) => (y >= 4 && y <= 6 ? band : body));
  p.cylY(3.5, 3.5, 2.6, 11, 11, c.steelLight);
  p.set(3, 11, 1, c.steel);
  return { prop: p, grip: [3.5, 4, 3.5], tip: [3.5, 11.5, 1] };
}

function cup(body: number, drink: number, c: FC): HandModel {
  const p = new Prop(9, 8, 7, VOX);
  p.cylY(3.5, 3.5, 3.2, 0, 6, body);
  p.cylY(3.5, 3.5, 2.4, 6, 6, drink);
  p.box(7, 2, 3, 8, 2, 3, body); p.box(7, 5, 3, 8, 5, 3, body); p.box(8, 3, 3, 8, 4, 3, body);
  p.set(1, 0, 3, c.plateRim);
  return { prop: p, grip: [6.5, 3.5, 3.5], tip: [3.5, 6.6, 0.8] };
}

function glass(drink: number, c: FC, ice: boolean): HandModel {
  const p = new Prop(7, 12, 7, VOX);
  p.cylY(3.5, 3.5, 3.3, 0, 11, c.glass);
  p.cylY(3.5, 3.5, 2.5, 1, 9, drink);
  if (ice) { p.set(2, 9, 3, c.glass); p.set(4, 8, 2, c.glass); p.set(3, 10, 4, c.glass); }
  p.cylY(3.5, 3.5, 2.5, 10, 11, 0);
  return { prop: p, grip: [3.5, 4, 3.5], tip: [3.5, 11.5, 0.8] };
}

function bottle(body: number, label: number, c: FC): HandModel {
  const p = new Prop(5, 11, 5, VOX);
  p.cylY(2.5, 2.5, 2.3, 0, 6, (_x, y) => (y >= 2 && y <= 4 ? label : body));
  p.cylY(2.5, 2.5, 1.3, 7, 8, body);
  p.cylY(2.5, 2.5, 1.3, 9, 10, c.steelLight);
  return { prop: p, grip: [2.5, 3, 2.5], tip: [2.5, 10.5, 1.5] };
}

function onigiri(c: FC): HandModel {
  const p = new Prop(13, 12, 6, VOX);
  for (let y = 0; y < 12; y++) {
    const hw = (11 - y) * 0.55 + 0.6;
    for (let x = 0; x < 13; x++) for (let z = 0; z < 6; z++) if (Math.abs(x + 0.5 - 6.5) <= hw) p.set(x, y, z, c.rice);
  }
  for (let y = 0; y <= 4; y++) for (let x = 4; x <= 8; x++) { p.set(x, y, 0, c.nori); p.set(x, y, 5, c.nori); }
  p.box(4, 0, 0, 8, 0, 5, c.nori);
  p.box(5, 4, 1, 7, 6, 4, c.tuna);
  return { prop: p, grip: [6.5, 1.5, 3], axis: [0, 1, 0] };
}

function sando(c: FC, filling: number): HandModel {
  const p = new Prop(14, 12, 6, VOX);
  for (let y = 0; y < 12; y++) {
    const hw = (11 - y) * 0.62 + 0.4;
    for (let x = 0; x < 14; x++) for (let z = 0; z < 6; z++) if (Math.abs(x + 0.5 - 7) <= hw) p.set(x, y, z, z === 0 || z === 5 ? c.rice : z === 1 || z === 4 ? c.rice : filling);
  }
  return { prop: p, grip: [7, 1.5, 3], axis: [0, 1, 0] };
}

function bun(top: number, side: number, filling: number, sesame = false): HandModel {
  const p = new Prop(12, 9, 12, VOX);
  ell(p, [6, 3.6, 6], [5.6, 3.8, 5.6], (x, y, z) => (Math.hypot(x + 0.5 - 6, z + 0.5 - 6) < 2.6 && y >= 2 && y <= 4 ? filling : y >= 4 ? ((x + z) % 3 === 0 && sesame ? side : top) : side));
  if (sesame) for (let k = 0; k < 6; k++) p.set(4 + k % 3 * 2, 7, 4 + Math.floor(k / 3) * 3, side);
  return { prop: p, grip: [6, 3.5, 1], axis: [0, 0, 1] };
}

function chikuwa(body: number, burnt: number, c: FC): HandModel {
  const p = new Prop(6, 6, 20, VOX);
  for (let z = 0; z < 20; z++) for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
    const d = Math.hypot(x + 0.5 - 3, y + 0.5 - 3);
    if (d < 3 && d > 1.2) p.set(x, y, z, d > 2.3 && (z % 4 < 2 || y > 3) ? burnt : body);
  }
  p.box(2, 2, 0, 3, 3, 3, c.paper);
  return { prop: p, grip: [3, 3, 2], axis: [0, 0, 1], keep: [c.paper] };
}

function saba(skin: number, back: number, c: FC): HandModel {
  const p = new Prop(6, 7, 20, VOX);
  p.box(1, 0, 0, 4, 5, 19, skin);
  p.box(1, 5, 0, 4, 6, 19, back);
  for (let z = 1; z < 19; z += 3) p.box(0, 2, z, 5, 4, z, c.chashuEdge);
  p.box(0, 0, 0, 5, 6, 4, c.paper);
  return { prop: p, grip: [3, 3, 2], axis: [0, 0, 1], keep: [c.paper, c.chashuEdge] };
}

function bowlOf(c: FC, a: number, b: number): HandModel {
  const p = new Prop(13, 7, 13, VOX);
  for (let y = 0; y <= 4; y++) p.cylY(6.5, 6.5, 4 + y * 0.5, y, y, c.plateBlue);
  p.cylY(6.5, 6.5, 5.4, 1, 4, 0);
  p.cylY(6.5, 6.5, 5, 1, 2, c.plateBlue);
  const at: V3[] = [[4.5, 4, 5], [8.5, 4, 5.5], [6.5, 4.5, 8.5]];
  at.forEach((q, i) => ell(p, q, [1.8, 1.2, 2.4], i % 2 ? b : a));
  return { prop: p, grip: [6.5, 0, 6.5], pieces: at.map((q) => ({ at: q, r: [2.1, 1.6, 2.7] as V3 })), keep: [c.plateBlue] };
}

/** Noodles hanging from a pair of chopsticks: the top (where they are held) is the grip. */
export function noodleBundle(pal: Palette, cols: [number, number], len = 16): HandModel {
  const p = new Prop(5, len, 3, VOX);
  for (let s = 0; s < 5; s++) {
    const ph = s * 1.7;
    for (let y = 0; y < len - (s % 2) * 2; y++) {
      const x = Math.max(0, Math.min(4, Math.round(s + Math.sin(y * 0.55 + ph) * 0.6)));
      p.set(x, len - 1 - y, s % 3, (y + s) % 4 === 0 ? cols[1] : cols[0]);
    }
  }
  void pal;
  return { prop: p, grip: [2.5, len - 0.5, 1.5] };
}

/** A forkful of spaghetti wound into a little nest. */
export function pastaTwirl(pal: Palette, cols: [number, number]): HandModel {
  const p = new Prop(7, 6, 7, VOX);
  const r = rng(36);
  p.ellipsoid(3.5, 3, 3.5, 3.2, 2.6, 3.2, () => (r() < 0.35 ? cols[1] : cols[0]));
  for (let y = 0; y < 2; y++) p.set(2 + y, y, 1, cols[0]);
  void pal;
  return { prop: p, grip: [3.5, 3, 3.5] };
}
