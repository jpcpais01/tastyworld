import { rng } from './grid';
import { Prop } from './props';
import type { Palette } from './palette';

/**
 * Halcyon City's street food, 2040, as voxel models (40 voxels to the metre, like every dish). Kelp noodles, vat
 * meat, printed sushi, cricket flour and bioluminescent sweets; and in the hidden greenhouse, food grown in soil.
 * Built from a small kit (bowls, skewers, buns, cups, boxes) so each dish is its colours and its toppings.
 */
const S = 1 / 40;

export type NeoFood =
  | 'kelpramen' | 'vatbao' | 'krillskewer' | 'neonboba' | 'printsushi' | 'cricketwrap' | 'spirulinaburger' | 'mycobowl'
  | 'ionsoda' | 'glowmochi' | 'rainbuns' | 'eelrice' | 'chiliwonton' | 'curryfries' | 'hotpot' | 'coldbrew'
  | 'eggtart' | 'gyudon' | 'gridcake' | 'mangoslush' | 'rationbar' | 'noodlecup' | 'beefskewer' | 'tofuskewer'
  | 'pho' | 'laksa' | 'dumplings' | 'friedrice' | 'karaagebox' | 'onigiri3d' | 'takoball' | 'synthsteak'
  | 'neontea' | 'jellydrink' | 'cheesecake' | 'crepe' | 'katsusando2' | 'bibimbap' | 'satay' | 'icecream'
  | 'realsteak' | 'gardensalad';

export const NEO_FOODS: readonly NeoFood[] = ['kelpramen', 'vatbao', 'krillskewer', 'neonboba', 'printsushi', 'cricketwrap', 'spirulinaburger', 'mycobowl',
  'ionsoda', 'glowmochi', 'rainbuns', 'eelrice', 'chiliwonton', 'curryfries', 'hotpot', 'coldbrew', 'eggtart', 'gyudon', 'gridcake', 'mangoslush',
  'rationbar', 'noodlecup', 'beefskewer', 'tofuskewer', 'pho', 'laksa', 'dumplings', 'friedrice', 'karaagebox', 'onigiri3d', 'takoball', 'synthsteak',
  'neontea', 'jellydrink', 'cheesecake', 'crepe', 'katsusando2', 'bibimbap', 'satay', 'icecream', 'realsteak', 'gardensalad'];

export const isNeoFood = (id: string): id is NeoFood => (NEO_FOODS as readonly string[]).includes(id);

function neoColors(pal: Palette) {
  const a = (hex: number, vary = 0.06, emit = 0) => pal.add(hex, { vary, emit });
  return {
    bowlBlack: a(0x1c1d24, 0.03), bowlRim: a(0x2ad8ff, 0.02, 0.8), bowlWhite: a(0xeef0f2, 0.02), bowlRed: a(0xb8202e, 0.03),
    kelpBroth: a(0x3a5a2a, 0.06), kelpNoodle: a(0x7ab060, 0.08), kelpDark: a(0x2a4a20, 0.08), brothRed: a(0xb8401e, 0.05), brothGold: a(0xd8a040, 0.05),
    brothCoco: a(0xe8b860, 0.05), noodle: a(0xf2dc96, 0.06), riceNoodle: a(0xf4f0e2, 0.03), egg: a(0xfaf6ea, 0.02), yolk: a(0xf29a1c, 0.04),
    vatPork: a(0xd8907a, 0.06), vatPorkDark: a(0x9a4a32, 0.06), bun: a(0xf6f0e2, 0.03), bunShadow: a(0xe0d6c0, 0.03), steamer: a(0xc9a46a, 0.05), steamerDark: a(0x9a7a48, 0.05),
    krill: a(0xf2705a, 0.08), krillHi: a(0xffa080, 0.06), stick: a(0xd8c08a, 0.03), glaze: a(0x8a3a18, 0.06), beef: a(0x7a3020, 0.08), beefHi: a(0xa8503a, 0.06),
    tofu: a(0xf2e8c8, 0.03), tofuSear: a(0xc8904a, 0.06), cup: a(0xe8f4fa, 0.02, 0), cupGlass: pal.add(0xd8eef6, { glass: true }), straw: a(0xff4fa8, 0.02, 0.5),
    bobaPink: a(0xff6ac8, 0.05, 0.75), bobaCyan: a(0x4ff0ff, 0.05, 0.75), pearl: a(0x1a1418, 0.04), milkTea: a(0xd8b08a, 0.04), lid: a(0x2a2a34, 0.02),
    ion: a(0x6affd0, 0.04, 0.8), ionCan: a(0x2a3a8a, 0.03), ionLabel: a(0xf2f2f2, 0.02), mochiGlow: a(0x9a7bff, 0.06, 0.85), mochiGlowB: a(0x5ff0c8, 0.06, 0.85), mochiGlowC: a(0xff7ab8, 0.06, 0.85),
    rice: a(0xfbfaf4, 0.03), nori: a(0x1e3a1e, 0.1), salmonPrint: a(0xff8a5a, 0.03), tunaPrint: a(0xe03048, 0.03), printGrid: a(0xffb090, 0.02),
    tortilla: a(0xd8b070, 0.06), tortillaDark: a(0xa8803a, 0.06), cricket: a(0x5a3a1e, 0.1), lettuce: a(0x8cc65a, 0.1), salsa: a(0xd8402a, 0.06),
    burgerBun: a(0x2f8a5a, 0.06), burgerBunHi: a(0x4fb07a, 0.05), patty: a(0x5a2e1a, 0.08), cheese: a(0xf6c84a, 0.04), tomato: a(0xd8321e, 0.05),
    myco: a(0xc8b090, 0.08), mycoDark: a(0x8a6a4a, 0.08), mycoCap: a(0xe8d8b8, 0.06), sesame: a(0xf0dca0, 0.06), scallion: a(0x6fae4a, 0.1),
    eel: a(0x8a4a1c, 0.06), eelDark: a(0x4a2410, 0.06), wonton: a(0xf2e2c0, 0.04), chiliOil: a(0xc8281e, 0.05, 0.08), fries: a(0xf2c860, 0.06),
    curry: a(0x9a5a1a, 0.05), boxRed: a(0xd8282e, 0.03), boxBlack: a(0x16161c, 0.02), boxNeon: a(0x2ad8ff, 0.02, 0.85), boxPink: a(0xff3f9a, 0.02, 0.85),
    hotpotMetal: a(0x6a7078, 0.04), brothDark: a(0x5a2410, 0.05), mushroom: a(0x9a7a5a, 0.08), greens: a(0x3f8a32, 0.1), coffee: a(0x2a160a, 0.03), cream: a(0xf6ecd8, 0.02),
    tart: a(0xd89a4a, 0.08), custard: a(0xf6d050, 0.04), custardBurn: a(0x9a5a1a, 0.08), grid: a(0xd8a050, 0.1), gridDark: a(0xa86a2a, 0.1), mayo: a(0xfbf3dc, 0.02),
    sauce: a(0x4a2410, 0.06), mango: a(0xf2a830, 0.05, 0.1), ration: a(0x8a8a6a, 0.06), rationWrap: a(0x3a4a3a, 0.04), rationLabel: a(0xffd040, 0.03, 0.4),
    noodleCup: a(0xf4f4f0, 0.02), cupBand: a(0xff3f6a, 0.02), pho: a(0xd8b878, 0.04), basil: a(0x2f7a2a, 0.08), lime: a(0x8ac83a, 0.05), laksa: a(0xe8823a, 0.05),
    dumpling: a(0xf4ead2, 0.03), friedRice: a(0xe8c87a, 0.08), pea: a(0x6ab83a, 0.06), karaage: a(0xc8803a, 0.12), onigiri: a(0xfbfaf4, 0.02), takoball: a(0xd99a4e, 0.1),
    steak: a(0x6a2a1a, 0.06), steakIn: a(0xc8505a, 0.05), steakChar: a(0x2a1410, 0.06), plate: a(0xf4f1ea, 0.02), plateDark: a(0x2a2a30, 0.02),
    neonTea: a(0xff8ae0, 0.04, 0.5), jelly: a(0x7affc0, 0.06, 0.55), jellyPouch: a(0xe8e8f0, 0.02), cheesecake: a(0xf6e6c0, 0.03), cheesecakeTop: a(0x9a5aff, 0.05, 0.45),
    crepe: a(0xf0c878, 0.06), berry: a(0xb8203a, 0.05), shokupan: a(0xfaf2e0, 0.02), katsu: a(0xd8a050, 0.08), bibim: a(0x2a2a30, 0.03), carrot: a(0xe8803a, 0.06),
    gochu: a(0xc8281e, 0.05), peanut: a(0xc8904a, 0.08), iceA: a(0xff9ad8, 0.04, 0.3), iceB: a(0x9ad8ff, 0.04, 0.3), cone: a(0xd4964c, 0.06),
    soil: a(0x4a3020, 0.1), leaf: a(0x4a9a3a, 0.12), leafB: a(0x6ab84a, 0.12), radish: a(0xd84a6a, 0.06), wood: a(0x8a5a3c, 0.06),
  };
}
type NC = ReturnType<typeof neoColors>;
type Col = number | ((x: number, y: number, z: number) => number);

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

/** A round bowl `r` across, `h` high, hollow, its rim one colour. */
function bowl(p: Prop, body: Col, rim: number, cx: number, cz: number, r: number, h: number): void {
  for (let y = 0; y <= h; y++) p.cylY(cx, cz, r - (h - y) * 0.6, y, y, y === h ? rim : body);
  p.cylY(cx, cz, r - 1.2, 1, h, 0);
}

/** Noodles (or rice) heaped in a bowl's liquid, then toppings scattered over it. */
function soup(p: Prop, broth: number, noodle: number, cx: number, cz: number, r: number, level: number, seed: number): void {
  p.cylY(cx, cz, r - 1.4, 1, level, broth);
  const rr = rng(seed);
  for (let k = 0; k < 40; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * (r - 2.5);
    const x = Math.round(cx + Math.cos(a) * d - 0.5), z = Math.round(cz + Math.sin(a) * d - 0.5);
    p.set(x, level, z, noodle);
    if (rr() < 0.4) p.set(x + 1, level, z, noodle);
  }
}

function sprinkle(p: Prop, cx: number, cz: number, r: number, n: number, col: number | (() => number), seed: number): void {
  const rr = rng(seed);
  for (let k = 0; k < n; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r;
    const x = Math.round(cx + Math.cos(a) * d - 0.5), z = Math.round(cz + Math.sin(a) * d - 0.5);
    let y = p.sy - 1;
    while (y > 0 && !p.get(x, y - 1, z)) y--;
    p.set(x, y, z, typeof col === 'function' ? col() : col);
  }
}

/** Skewers lying side by side on a slate, `n` of them, each a run of chunks. */
function skewers(p: Prop, c: NC, n: number, chunk: (k: number, i: number) => number, base: number): void {
  p.box(0, 0, 0, p.sx - 1, 0, p.sz - 1, base);
  for (let i = 0; i < n; i++) {
    const z = 2 + i * 4;
    p.box(1, 2, z + 1, p.sx - 2, 2, z + 1, c.stick);
    for (let k = 0; k < 4; k++) {
      const x0 = 4 + k * 4;
      p.box(x0, 1, z, x0 + 2, 3, z + 2, chunk(k, i));
    }
  }
}

/** A tall cup with a lid and straw; `fill(y)` colours the drink. Glass shows it through. */
function cup(p: Prop, c: NC, cx: number, cz: number, r: number, h: number, fill: (y: number) => number, glass = true): void {
  for (let y = 0; y < h; y++) p.cylY(cx, cz, r - (h - y) * 0.05, y, y, glass ? c.cupGlass : c.cup);
  p.cylY(cx, cz, r - 1, 1, h - 2, (_x, y) => fill(y));
  p.cylY(cx, cz, r, h, h, c.lid);
  p.box(Math.floor(cx) + 1, h + 1, Math.floor(cz), Math.floor(cx) + 1, h + 6, Math.floor(cz), c.straw);
}

/** A takeaway box: open top, its walls in `wall`, a stripe of `band` round it. */
function box(p: Prop, x0: number, z0: number, x1: number, z1: number, h: number, wall: number, band: number): void {
  p.box(x0, 0, z0, x1, h, z1, (x, y, z) => (x === x0 || x === x1 || z === z0 || z === z1 || y === 0 ? (y === Math.floor(h / 2) ? band : wall) : 0));
}

function plate(p: Prop, col: number, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, col);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (dist(x, z, cx, cz) > r - 1.2 ? col : 0));
}

function buns(p: Prop, c: NC, fill: number): void {
  // a bamboo steamer with three buns, one split open on its filling
  p.cylY(11, 11, 10, 0, 4, (x, y, z) => (dist(x, z, 11, 11) > 9 ? (y % 2 ? c.steamer : c.steamerDark) : y === 0 ? c.steamerDark : 0));
  for (const [x, z, open] of [[7, 8, false], [15, 8, false], [11, 15, true]] as [number, number, boolean][]) {
    p.ellipsoid(x, 4, z, 3.6, 3, 3.6, (_x, y) => (y <= 3 ? c.bunShadow : c.bun));
    if (open) p.box(x - 2, 5, z - 1, x + 1, 6, z, fill);
  }
}

export function buildNeoFood(id: string, pal: Palette): Prop | null {
  if (!isNeoFood(id)) return null;
  const c = neoColors(pal);
  const seed = id.length * 977;
  const rr = rng(seed + 99);
  switch (id) {
    case 'kelpramen': case 'pho': case 'laksa': case 'hotpot': case 'noodlecup': {
      const p = new Prop(24, 14, 24, S);
      if (id === 'noodlecup') {
        for (let y = 0; y <= 12; y++) p.cylY(12, 12, 7 + y * 0.18, y, y, y === 5 || y === 6 ? c.cupBand : c.noodleCup);
        p.cylY(12, 12, 8, 1, 12, 0);
        soup(p, c.brothGold, c.noodle, 12, 12, 9, 10, seed);
        sprinkle(p, 12, 12, 5, 8, c.scallion, seed + 1);
        p.box(13, 11, 4, 14, 13, 18, c.stick);
        return p;
      }
      if (id === 'hotpot') {
        bowl(p, c.hotpotMetal, c.hotpotMetal, 12, 12, 11, 7);
        p.box(0, 5, 11, 1, 6, 13, c.hotpotMetal); p.box(22, 5, 11, 23, 6, 13, c.hotpotMetal);
        p.box(12, 1, 2, 12, 6, 22, c.hotpotMetal);
        p.cylY(12, 12, 9.5, 1, 5, (x) => (x < 12 ? c.brothRed : c.brothGold));
        sprinkle(p, 12, 12, 8, 30, () => [c.mushroom, c.greens, c.tofu, c.vatPork][Math.floor(rr() * 4)], seed);
        return p;
      }
      const broth = id === 'kelpramen' ? c.kelpBroth : id === 'pho' ? c.pho : c.laksa;
      const noodle = id === 'kelpramen' ? c.kelpNoodle : c.riceNoodle;
      bowl(p, c.bowlBlack, id === 'kelpramen' ? c.bowlRim : c.bowlBlack, 12, 12, 11.5, 8);
      soup(p, broth, noodle, 12, 12, 11.5, 7, seed);
      if (id === 'kelpramen') {
        p.ellipsoid(8, 8, 9, 2.4, 1.6, 2.4, (_x, y) => (y >= 8 ? c.yolk : c.egg));
        p.box(13, 8, 6, 18, 8, 10, c.vatPork); p.box(13, 8, 6, 18, 8, 6, c.vatPorkDark);
        p.box(5, 8, 14, 9, 10, 15, c.nori); p.box(5, 8, 16, 9, 9, 16, c.kelpDark);
        sprinkle(p, 14, 15, 3, 10, c.scallion, seed + 3);
      } else if (id === 'pho') {
        p.box(8, 8, 8, 14, 8, 12, c.beefHi);
        sprinkle(p, 12, 14, 5, 14, c.basil, seed + 2); p.ellipsoid(17, 8, 8, 1.6, 1, 1.6, c.lime);
      } else {
        sprinkle(p, 12, 12, 7, 16, c.krill, seed + 4); p.ellipsoid(8, 8, 15, 2.2, 1.4, 2.2, (_x, y) => (y >= 8 ? c.yolk : c.egg));
        sprinkle(p, 15, 9, 3, 6, c.basil, seed + 5);
      }
      return p;
    }
    case 'mycobowl': case 'eelrice': case 'gyudon': case 'friedrice': case 'bibimbap': case 'curryfries': {
      const p = new Prop(22, 12, 22, S);
      if (id === 'curryfries') {
        box(p, 2, 4, 19, 17, 8, c.boxBlack, c.boxNeon);
        for (let k = 0; k < 40; k++) { const x = 4 + (k * 7) % 14, z = 6 + (k * 3) % 10; p.box(x, 4 + (k % 4), z, x, 9 + (k % 3), z, c.fries); }
        p.box(5, 9, 8, 15, 9, 13, c.curry);
        return p;
      }
      bowl(p, id === 'bibimbap' ? c.bibim : c.bowlWhite, id === 'bibimbap' ? c.hotpotMetal : c.bowlRed, 11, 11, 10.5, 7);
      p.cylY(11, 11, 9, 1, 6, id === 'friedrice' ? c.friedRice : c.rice);
      if (id === 'mycobowl') {
        for (const [x, z] of [[7, 8], [12, 7], [15, 12], [9, 14], [13, 15]]) { p.box(x, 7, z, x, 8, z, c.mycoDark); p.ellipsoid(x + 0.5, 9, z + 0.5, 2, 1, 2, c.mycoCap); }
        sprinkle(p, 11, 11, 7, 12, c.sesame, seed);
      } else if (id === 'eelrice') {
        p.box(5, 7, 6, 17, 7, 15, (x) => (x % 3 === 0 ? c.eelDark : c.eel));
        sprinkle(p, 11, 11, 5, 8, c.sesame, seed);
      } else if (id === 'gyudon') {
        sprinkle(p, 11, 11, 8, 40, () => (rr() < 0.7 ? c.beef : c.myco), seed);
        p.ellipsoid(11, 8, 11, 1.8, 1, 1.8, c.yolk);
      } else if (id === 'friedrice') {
        sprinkle(p, 11, 11, 8, 20, () => (rr() < 0.5 ? c.pea : c.carrot), seed);
      } else {
        const zones = [c.carrot, c.greens, c.mushroom, c.beef, c.krill];
        for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; p.ellipsoid(11 + Math.cos(a) * 5, 7, 11 + Math.sin(a) * 5, 2.4, 1, 2.4, zones[k]); }
        p.ellipsoid(11, 8, 11, 2, 1, 2, c.yolk); p.box(13, 8, 9, 14, 8, 10, c.gochu);
      }
      return p;
    }
    case 'vatbao': return (() => { const p = new Prop(22, 10, 22, S); buns(p, c, c.vatPork); return p; })();
    case 'rainbuns': return (() => { const p = new Prop(22, 10, 22, S); buns(p, c, c.custard); return p; })();
    case 'dumplings': case 'chiliwonton': case 'takoball': {
      const p = new Prop(22, 10, 22, S);
      plate(p, id === 'chiliwonton' ? c.bowlWhite : c.plateDark, 11, 11, 10);
      const pts: [number, number][] = [[6, 6], [11, 6], [16, 6], [6, 11], [11, 11], [16, 11], [6, 16], [11, 16], [16, 16]];
      for (const [x, z] of pts) p.ellipsoid(x, 2.5, z, 2.4, id === 'takoball' ? 2.4 : 1.6, 2.4, id === 'takoball' ? c.takoball : c.dumpling);
      if (id === 'chiliwonton') sprinkle(p, 11, 11, 9, 40, c.chiliOil, seed);
      if (id === 'takoball') { sprinkle(p, 11, 11, 8, 20, c.sauce, seed); sprinkle(p, 11, 11, 8, 12, c.mayo, seed + 1); }
      return p;
    }
    case 'krillskewer': case 'beefskewer': case 'tofuskewer': case 'satay': {
      const p = new Prop(22, 5, 15, S);
      const col = id === 'krillskewer' ? [c.krill, c.krillHi] : id === 'beefskewer' ? [c.beef, c.beefHi] : id === 'tofuskewer' ? [c.tofu, c.tofuSear] : [c.glaze, c.peanut];
      skewers(p, c, 3, (k, i) => col[(k + i) % 2], c.boxBlack);
      if (id === 'satay') p.box(18, 1, 1, 21, 2, 4, c.peanut);
      return p;
    }
    case 'neonboba': case 'ionsoda': case 'coldbrew': case 'mangoslush': case 'neontea': {
      const p = new Prop(12, 26, 12, S);
      if (id === 'ionsoda') {
        p.cylY(6, 6, 4.5, 0, 16, (_x, y) => (y > 5 && y < 11 ? c.ionLabel : y === 16 ? c.hotpotMetal : c.ionCan));
        p.cylY(6, 6, 4, 6, 10, (x, y, z) => ((x + z + y) % 3 === 0 ? c.ion : c.ionLabel));
        return p;
      }
      const fill = id === 'neonboba' ? (y: number) => (y < 4 ? c.pearl : y < 10 ? c.bobaPink : c.bobaCyan)
        : id === 'coldbrew' ? (y: number) => (y > 14 ? c.cream : c.coffee)
          : id === 'mangoslush' ? () => c.mango : (y: number) => (y < 3 ? c.pearl : c.neonTea);
      cup(p, c, 6, 6, 5, 18, fill);
      return p;
    }
    case 'jellydrink': {
      const p = new Prop(12, 22, 8, S);
      p.box(2, 0, 2, 9, 14, 5, c.jellyPouch);
      p.box(3, 2, 2, 8, 12, 2, (x, y) => ((x + y) % 3 ? c.jelly : c.jellyPouch));
      p.box(5, 15, 3, 6, 19, 4, c.lid);
      return p;
    }
    case 'glowmochi': {
      const p = new Prop(22, 8, 14, S);
      p.box(0, 0, 0, 21, 0, 13, c.plateDark);
      const cols = [c.mochiGlow, c.mochiGlowB, c.mochiGlowC];
      for (let i = 0; i < 3; i++) p.ellipsoid(4.5 + i * 6.5, 3, 7, 2.8, 2.6, 2.8, cols[i]);
      return p;
    }
    case 'printsushi': case 'onigiri3d': {
      const p = new Prop(26, 8, 12, S);
      p.box(0, 0, 0, 25, 1, 11, c.boxBlack);
      if (id === 'onigiri3d') {
        for (let i = 0; i < 3; i++) {
          const cx = 4 + i * 8;
          for (let y = 2; y < 8; y++) p.box(cx - 3 + Math.floor((y - 2) / 2), y, 3, cx + 3 - Math.floor((y - 2) / 2), y, 8, c.onigiri);
          p.box(cx - 2, 2, 8, cx + 2, 4, 8, c.nori);
        }
        return p;
      }
      for (let i = 0; i < 4; i++) {
        const x0 = 2 + i * 6;
        p.box(x0, 2, 3, x0 + 4, 3, 8, c.rice);
        p.box(x0, 4, 2, x0 + 4, 4, 9, (x, _y, z) => ((x + z) % 2 === 0 ? c.printGrid : i % 2 ? c.tunaPrint : c.salmonPrint));
      }
      return p;
    }
    case 'cricketwrap': case 'katsusando2': {
      const p = new Prop(24, 10, 14, S);
      p.box(0, 0, 0, 23, 0, 13, c.boxBlack);
      if (id === 'katsusando2') {
        for (let x = 3; x < 21; x++) for (let y = 1; y <= 9; y++) for (let z = 4; z < 10; z++) {
          const edge = y <= 2 || y >= 8;
          p.set(x, y, z, edge ? c.shokupan : z === 4 ? (y === 5 ? c.sauce : c.katsu) : c.shokupan);
        }
        return p;
      }
      for (let x = 2; x < 22; x++) for (let y = 1; y < 8; y++) for (let z = 3; z < 11; z++) {
        const d = Math.hypot(y - 4, z - 7);
        if (d < 3.6) p.set(x, y, z, d > 2.6 ? (x % 5 === 0 ? c.tortillaDark : c.tortilla) : x > 18 ? [c.cricket, c.lettuce, c.salsa][(y + z) % 3] : c.tortilla);
      }
      return p;
    }
    case 'spirulinaburger': {
      const p = new Prop(18, 16, 18, S);
      p.cylY(9, 9, 7.5, 0, 2, c.burgerBun);
      p.cylY(9, 9, 8, 3, 3, c.lettuce);
      p.cylY(9, 9, 7.5, 4, 6, c.patty);
      p.cylY(9, 9, 8, 7, 7, c.cheese);
      p.cylY(9, 9, 7, 8, 8, c.tomato);
      p.ellipsoid(9, 10, 9, 7.5, 4, 7.5, (_x, y) => (y < 10 ? c.burgerBun : c.burgerBunHi));
      sprinkle(p, 9, 9, 5, 10, c.sesame, seed);
      return p;
    }
    case 'eggtart': case 'cheesecake': case 'gridcake': case 'crepe': case 'icecream': {
      const p = new Prop(20, 16, 20, S);
      if (id === 'eggtart') {
        for (const [x, z] of [[6, 6], [14, 6], [10, 14]]) { p.cylY(x, z, 4, 0, 2, c.tart); p.cylY(x, z, 3, 2, 2, c.custard); p.set(x, 3, z, c.custardBurn); }
      } else if (id === 'cheesecake') {
        plate(p, c.plateDark, 10, 10, 9);
        p.box(5, 1, 6, 14, 6, 13, c.cheesecake); p.box(5, 7, 6, 14, 7, 13, c.cheesecakeTop);
      } else if (id === 'gridcake') {
        p.box(1, 0, 1, 18, 3, 18, (x, y, z) => (y === 3 && (x % 3 === 0 || z % 3 === 0) ? c.gridDark : c.grid));
        sprinkle(p, 10, 10, 7, 30, c.sauce, seed); sprinkle(p, 10, 10, 7, 20, c.mayo, seed + 1);
      } else if (id === 'crepe') {
        for (let y = 0; y < 14; y++) { const r = 1 + y * 0.45; p.cylY(10, 10, r, y, y, y > 9 ? c.cream : c.crepe); }
        sprinkle(p, 10, 10, 4, 8, c.berry, seed);
      } else {
        for (let y = 0; y < 9; y++) p.cylY(10, 10, 0.6 + y * 0.42, y, y, c.cone);
        p.ellipsoid(10, 11, 10, 4, 3, 4, (_x, y) => (y < 11 ? c.iceA : c.iceB));
      }
      return p;
    }
    case 'karaagebox': {
      const p = new Prop(20, 12, 16, S);
      box(p, 1, 1, 18, 14, 7, c.boxRed, c.boxPink);
      for (let k = 0; k < 9; k++) p.ellipsoid(4 + (k % 3) * 5, 7 + (k % 2), 4 + Math.floor(k / 3) * 4, 2.4, 2, 2.2, c.karaage);
      return p;
    }
    case 'rationbar': {
      const p = new Prop(20, 4, 8, S);
      p.box(0, 0, 0, 19, 3, 7, (x) => (x > 13 ? c.ration : x === 13 ? c.rationLabel : c.rationWrap));
      p.box(3, 3, 2, 9, 3, 5, c.rationLabel);
      return p;
    }
    case 'synthsteak': case 'realsteak': {
      const p = new Prop(24, 8, 20, S);
      plate(p, id === 'realsteak' ? c.wood : c.plateDark, 12, 10, 10);
      p.ellipsoid(11, 3, 10, 6.5, 2, 4.5, (x, y, z) => (y >= 4 ? ((x + z) % 3 === 0 ? c.steakChar : c.steak) : z < 7 ? c.steakIn : c.steak));
      if (id === 'realsteak') { sprinkle(p, 18, 13, 2.5, 8, c.leafB, seed); p.ellipsoid(18, 2, 7, 1.6, 1, 1.6, c.radish); }
      else sprinkle(p, 12, 10, 5, 6, c.boxNeon, seed);
      return p;
    }
    case 'gardensalad': {
      const p = new Prop(22, 10, 22, S);
      bowl(p, c.wood, c.wood, 11, 11, 10.5, 5);
      p.cylY(11, 11, 9, 1, 4, c.leaf);
      sprinkle(p, 11, 11, 8, 50, () => [c.leaf, c.leafB, c.radish, c.tomato, c.carrot][Math.floor(rr() * 5)], seed);
      return p;
    }
  }
  return null;
}
