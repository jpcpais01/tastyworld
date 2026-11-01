import { rng } from './grid';
import { Prop } from './props';
import type { foodColors } from './food';

/** Istanbul's second menu as voxel models (40 voxels to the metre, like every dish). */
type FC = ReturnType<typeof foodColors>;
const S = 1 / 40;

export type IstanbulFood =
  | 'iskender' | 'sutlac' | 'lahmacun' | 'salgam' | 'karapide' | 'hamsi' | 'kurufasulye' | 'mercimek'
  | 'kofte' | 'piyaz' | 'tavukgogsu' | 'kazandibi' | 'menemen' | 'kaymak' | 'meze' | 'kalamar'
  | 'kahve' | 'lokum' | 'karniyarik' | 'cacik' | 'kumpir' | 'waffle' | 'lokma' | 'boza' | 'gozleme' | 'cay';

export const ISTANBUL_FOODS: readonly IstanbulFood[] = ['iskender', 'sutlac', 'lahmacun', 'salgam', 'karapide', 'hamsi', 'kurufasulye', 'mercimek',
  'kofte', 'piyaz', 'tavukgogsu', 'kazandibi', 'menemen', 'kaymak', 'meze', 'kalamar',
  'kahve', 'lokum', 'karniyarik', 'cacik', 'kumpir', 'waffle', 'lokma', 'boza', 'gozleme', 'cay'];

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

/** A white plate with an İznik rim: a ring of blue with red tulip dots. */
function iznik(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (dist(x, z, cx, cz) > r - 1.2 ? ((x * 3 + z) % 5 ? c.iznik : c.iznikRed) : 0));
}

/** A deep bowl, `r` across at the top, `h` high, hollow. */
function bowl(p: Prop, col: number | ((x: number, y: number, z: number) => number), cx: number, cz: number, r: number, h: number): void {
  for (let y = 0; y <= h; y++) p.cylY(cx, cz, r - (h - y) * 0.6, y, y, col);
  p.cylY(cx, cz, r - 1, 1, h, 0);
}

/** A two-handled copper pan (sahan). */
function sahan(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 2, (x, y, z) => ((x + y + z) % 4 === 0 ? c.copperDark : c.copper));
  p.cylY(cx, cz, r - 1, 1, 2, 0);
  for (const s of [-1, 1]) p.box(Math.round(cx + s * (r + 0.5)) - (s < 0 ? 1 : 0), 2, Math.round(cz) - 1, Math.round(cx + s * (r + 0.5)) + (s > 0 ? 1 : 0), 2, Math.round(cz), c.copperDark);
}

/** Scatter `n` voxels of a colour (or a picker) at the top of what is in the circle. */
function scatter(p: Prop, cx: number, cz: number, r: number, n: number, col: number | (() => number), seed: number): void {
  const rr = rng(seed);
  for (let k = 0; k < n; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r;
    const x = Math.round(cx + Math.cos(a) * d - 0.5), z = Math.round(cz + Math.sin(a) * d - 0.5);
    let y = p.sy - 1;
    while (y > 0 && !p.get(x, y - 1, z)) y--;
    if (y < p.sy) p.set(x, y, z, typeof col === 'function' ? col() : col);
  }
}

function iskender(c: FC): Prop {
  const p = new Prop(26, 9, 26, S);
  iznik(p, c, 13, 13, 12.5);
  // cubes of pide under the meat, the tomato sauce round the edge, a mound of yoghurt, the roast pepper
  for (let x = 4; x <= 21; x++) for (let z = 5; z <= 18; z++) if (dist(x, z, 13, 12) < 8.5) p.set(x, 1, z, (x + z) % 3 ? c.breadIn : c.bread);
  for (let x = 5; x <= 20; x++) for (let z = 5; z <= 18; z++) {
    if (dist(x, z, 12.5, 11.5) > 7.6) continue;
    p.set(x, 2, z, (x * 3 + z) % 4 === 0 ? c.donerHi : c.doner);
    if ((x + z * 2) % 3 === 0) p.set(x, 3, z, (x + z) % 2 ? c.doner : c.stewSauce);
  }
  p.cylY(13, 13, 10.5, 1, 1, (x, _y, z) => (p.get(x, 1, z) ? p.get(x, 1, z) : c.stewSauce));
  p.ellipsoid(19.5, 2, 19, 3.2, 2.2, 3, c.yoghurt);
  // the browned butter pooled and glossy over the meat
  for (let x = 7; x <= 17; x++) for (let z = 7; z <= 15; z++) if ((x * 7 + z * 5) % 6 === 0) p.set(x, 4, z, c.redButter);
  p.box(4, 2, 18, 9, 3, 19, c.pepper); p.ellipsoid(7, 2.5, 20.5, 1.6, 1.4, 1.6, c.tomato);
  return p;
}

function sutlac(c: FC): Prop {
  const p = new Prop(20, 12, 20, S);
  p.cylY(10, 10, 9, 0, 0, c.plate);
  // a clay güveç bowl of baked rice pudding, its skin freckled brown, hazelnut on top
  bowl(p, (x, y, z) => ((x + y + z) % 5 === 0 ? c.terracottaDark : c.terracotta), 10, 10, 7.5, 8);
  p.cylY(10, 10, 6.4, 1, 7, c.cream);
  p.cylY(10, 10, 6.4, 8, 8, (x, _y, z) => ((x * 7 + z * 11) % 5 < 2 ? c.caramel : (x + z) % 4 === 0 ? c.babaGloss : c.custard));
  p.box(9, 9, 9, 10, 9, 10, c.walnut);
  return p;
}

function lahmacun(c: FC): Prop {
  const p = new Prop(28, 7, 28, S);
  p.box(1, 0, 1, 26, 0, 26, c.paper);
  // a paper-thin round spread with spiced lamb, a fan of parsley and sumac onion, two lemon wedges
  p.cylY(14, 14, 12, 1, 1, (x, _y, z) => (dist(x, z, 14, 14) > 11 ? c.crust : (x * 5 + z * 3) % 7 === 0 ? c.char : c.lavash));
  p.cylY(14, 14, 10.8, 2, 2, (x, _y, z) => ((x * 3 + z * 7) % 5 === 0 ? c.chiliFlake : (x + z) % 3 === 0 ? c.lambStew : c.lahmacun));
  scatter(p, 10, 12, 4, 14, () => c.parsley, 801);
  scatter(p, 17, 16, 3.5, 8, () => c.redOnion, 802);
  p.box(20, 3, 6, 23, 4, 8, c.lemon); p.box(5, 3, 19, 7, 4, 22, c.lemon);
  return p;
}

function salgam(c: FC): Prop {
  const p = new Prop(16, 22, 14, S);
  // a tall glass of dark purple turnip juice with a pickled carrot standing in it
  p.cylY(7, 7, 3.6, 0, 15, c.glass);
  p.cylY(7, 7, 2.9, 1, 13, c.salgam);
  p.cylY(7, 7, 2.9, 14, 15, 0);
  p.box(8, 6, 7, 8, 19, 8, c.carrot); p.box(9, 16, 7, 9, 20, 7, c.carrot);
  p.cylY(13, 7, 2, 0, 0, c.plate); p.box(12, 1, 6, 14, 2, 8, c.gherkin);
  return p;
}

function karapide(c: FC): Prop {
  const p = new Prop(34, 9, 16, S);
  p.box(0, 0, 0, 33, 0, 15, c.board);
  // a canoe of bread, pinched at the ends: melted kaşar, a runny egg in the middle, butter on the crust
  for (let x = 1; x <= 32; x++) {
    const t = Math.abs(x - 16.5) / 16, half = 6.2 * Math.sqrt(Math.max(0, 1 - t * t * t));
    if (half < 0.6) continue;
    for (let z = 0; z <= 15; z++) {
      const dz = Math.abs(z + 0.5 - 8);
      if (dz > half) continue;
      const rim = dz > half - 1.6;
      p.set(x, 1, z, c.breadCrust);
      p.set(x, 2, z, rim ? c.crust : c.cheese);
      if (rim) { p.set(x, 3, z, (x + z) % 4 ? c.crustHi : c.char); }
      else if ((x + z) % 5 === 0) p.set(x, 3, z, c.cheeseBrown);
    }
  }
  p.ellipsoid(16.5, 3, 8, 3.6, 0.9, 2.6, c.eggWhite);
  p.ellipsoid(16.5, 3.6, 8, 1.6, 1, 1.4, c.yolk);
  for (const x of [8, 25]) p.box(x, 4, 7, x + 1, 4, 8, c.cheese);
  return p;
}

function hamsi(c: FC): Prop {
  const p = new Prop(26, 7, 26, S);
  p.cylY(13, 13, 12.5, 0, 0, c.plate);
  // anchovies fried head to tail in a wheel, a crust of corn flour, red onion, rocket and lemon in the middle
  for (let k = 0; k < 18; k++) {
    const a = (k / 18) * Math.PI * 2;
    for (let d = 3.5; d <= 11; d += 0.5) {
      const w = d > 10 ? 0.4 : 0.9;
      const x = Math.round(13 + Math.cos(a) * d - 0.5), z = Math.round(13 + Math.sin(a) * d - 0.5);
      p.set(x, 1, z, d > 10.2 ? c.fishBack : (k + Math.round(d)) % 3 ? c.fry : c.fryDark);
      if (w > 0.5) p.set(x, 2, z, (k + Math.round(d)) % 4 ? c.fry : c.crumb);
    }
  }
  p.cylY(13, 13, 3.2, 2, 2, (x, _y, z) => ((x + z) % 3 === 0 ? c.redOnion : (x * z) % 2 ? c.leaf : c.lettuce));
  p.box(12, 3, 12, 14, 4, 13, c.lemon);
  return p;
}

function kurufasulye(c: FC): Prop {
  const p = new Prop(28, 9, 22, S);
  p.box(1, 0, 1, 26, 0, 20, c.ceramicWhite);
  p.box(1, 1, 1, 26, 1, 1, c.plateRim); p.box(1, 1, 20, 26, 1, 20, c.plateRim);
  // white beans in their tomato sauce on one side, a dome of butter rice with orzo on the other
  for (let x = 3; x <= 13; x++) for (let z = 3; z <= 18; z++) {
    if (dist(x, z, 8.5, 10.5) > 6.5) continue;
    p.set(x, 1, z, c.beanSauce);
    p.set(x, 2, z, (x * 3 + z * 5) % 3 === 0 ? c.beanSauce : c.beanW);
    if ((x + z) % 4 === 0) p.set(x, 3, z, c.beanW);
  }
  p.ellipsoid(19.5, 1, 10.5, 6, 4.4, 6.4, (x, y, z) => ((x * 7 + y * 3 + z * 5) % 9 === 0 ? c.pastaEdge : c.rice));
  p.box(4, 3, 4, 5, 3, 4, c.pepper);
  return p;
}

function mercimek(c: FC): Prop {
  const p = new Prop(24, 11, 22, S);
  p.cylY(10, 11, 9.5, 0, 0, c.plate);
  // a deep bowl of smooth red lentil soup, a ribbon of red pepper butter, mint, lemon and bread beside it
  bowl(p, c.ceramicWhite, 10, 11, 7.5, 7);
  p.cylY(10, 11, 6.5, 1, 6, c.lentil);
  for (let k = 0; k < 14; k++) { const a = k * 0.55, d = 1 + k * 0.32; p.set(Math.round(10 + Math.cos(a) * d - 0.5), 7, Math.round(11 + Math.sin(a) * d - 0.5), c.redButter); }
  p.set(9, 7, 13, c.mint); p.set(12, 7, 9, c.mint);
  p.box(19, 1, 5, 22, 2, 8, c.lemon);
  p.box(18, 1, 12, 23, 4, 18, (x, y) => (y === 4 || x === 18 || x === 23 ? c.bread : c.breadIn));
  return p;
}

function kofte(c: FC): Prop {
  const p = new Prop(28, 8, 24, S);
  p.box(1, 0, 1, 26, 0, 22, c.ceramicWhite);
  // a row of small charred meatballs, a blistered long green pepper, a grilled tomato, bread to the side
  for (let k = 0; k < 6; k++) {
    const x = 4 + k * 3.4, z = 9 + (k % 2) * 1.2;
    p.ellipsoid(x, 1.5, z, 1.9, 1.4, 2.6, (xx, yy, zz) => ((xx + yy * 2 + zz) % 4 === 0 ? c.char : (xx + zz) % 3 ? c.meat : c.meatDark));
  }
  for (let x = 3; x <= 22; x++) p.box(x, 1, 15 + Math.round(Math.sin(x * 0.4)), x, 2, 16 + Math.round(Math.sin(x * 0.4)), (x * 3) % 5 === 0 ? c.char : c.pepper);
  p.ellipsoid(22, 2, 19, 2.6, 2.2, 2.6, (x, y) => (y > 2 && x % 2 ? c.char : c.tomato));
  p.box(20, 1, 3, 25, 3, 7, (x, y) => (y === 3 || x === 20 ? c.bread : c.breadIn));
  return p;
}

function piyaz(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  iznik(p, c, 11, 11, 10.5);
  // white beans dressed with tahini and vinegar, red onion with sumac, parsley, quarters of boiled egg
  p.cylY(11, 11, 8, 1, 1, c.tahini);
  scatter(p, 11, 11, 7.5, 70, () => c.beanW, 811);
  scatter(p, 11, 11, 7, 22, () => c.redOnion, 812);
  scatter(p, 11, 11, 7, 18, () => c.parsley, 813);
  for (const [x, z] of [[7, 7], [14, 13], [8, 14]] as const) { p.box(x, 2, z, x + 1, 3, z + 1, c.eggWhite); p.set(x, 4, z, c.yolk); }
  return p;
}

function tavukgogsu(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  p.cylY(11, 11, 10, 0, 0, c.plate);
  // a block of silky pudding beaten with threads of chicken, cinnamon dusted on top
  p.box(5, 1, 6, 16, 4, 15, (x, y, z) => ((x * 3 + y + z * 5) % 11 === 0 ? c.cream : c.salep));
  p.box(5, 5, 6, 16, 5, 15, (x, _y, z) => ((x + z) % 3 === 0 ? c.cinnamon : (x * z) % 7 === 0 ? c.cinnamon : 0));
  return p;
}

function kazandibi(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  p.cylY(11, 11, 10, 0, 0, c.plate);
  // two rolls of pudding, the scorched caramel side outwards
  for (const z0 of [6, 12]) for (let x = 5; x <= 16; x++) for (let y = 0; y <= 5; y++) for (let z = 0; z <= 5; z++) {
    const d = Math.hypot(y - 2.5, z - 2.5);
    if (d > 3) continue;
    p.set(x, 1 + y, z0 + z, d > 2.1 ? ((x + y + z) % 3 ? c.caramel : c.babaDark) : c.salep);
  }
  scatter(p, 11, 11, 6, 8, () => c.cinnamon, 821);
  return p;
}

function menemen(c: FC): Prop {
  const p = new Prop(26, 7, 22, S);
  // the copper sahan it was cooked in: soft eggs stirred through tomato and green pepper, chilli flakes
  sahan(p, c, 13, 11, 9);
  p.cylY(13, 11, 7.8, 1, 2, (x, y, z) => {
    const n = (x * 7 + z * 13 + y * 3) % 10;
    return n < 3 ? c.tomato : n < 5 ? c.tomatoHi : n < 6 ? c.pepper : n < 8 ? c.tamago : c.yolk;
  });
  scatter(p, 13, 11, 6, 10, () => c.chiliFlake, 831);
  scatter(p, 13, 11, 6, 5, () => c.parsley, 832);
  return p;
}

function kaymak(c: FC): Prop {
  const p = new Prop(24, 8, 22, S);
  p.cylY(10, 11, 9, 0, 0, c.plate);
  // a thick slab of clotted cream rolled at the edge, comb honey glistening on it, bread alongside
  p.box(4, 1, 6, 15, 3, 15, (_x, y) => (y === 3 ? c.cream : c.eggWhite));
  p.box(5, 4, 7, 9, 4, 11, c.syrup);
  p.box(9, 4, 9, 13, 5, 14, (x, y, z) => ((x + z) % 2 && y === 5 ? c.honeycomb : (x + z) % 3 ? c.syrup : c.honeycomb));
  p.box(18, 1, 6, 23, 4, 15, (x, y) => (y === 4 || x === 18 ? c.bread : c.breadIn));
  return p;
}

function meze(c: FC): Prop {
  const p = new Prop(30, 7, 24, S);
  // a wooden tray of little white dishes: haydari, spicy ezme, fava, vine leaves, white cheese and melon
  p.box(0, 0, 0, 29, 0, 23, c.board);
  p.box(0, 1, 0, 29, 1, 0, c.boardDark); p.box(0, 1, 23, 29, 1, 23, c.boardDark);
  const dish = (cx: number, cz: number, fill: (x: number, z: number) => number) => {
    p.cylY(cx, cz, 4.4, 1, 2, c.ceramicWhite);
    p.cylY(cx, cz, 3.4, 2, 2, (x, _y, z) => fill(x, z));
  };
  dish(5.5, 6, (x, z) => ((x + z) % 4 === 0 ? c.mint : c.yoghurt));
  dish(14.5, 6, (x, z) => ((x * 3 + z) % 5 === 0 ? c.parsley : (x + z) % 2 ? c.tomato : c.chili));
  dish(23.5, 6, (x, z) => ((x + z) % 6 === 0 ? c.oil : c.fava));
  dish(5.5, 17, () => c.plate);
  for (const [x, z] of [[4, 16], [6, 18], [4, 18]] as const) p.box(x, 3, z, x + 1, 3, z, c.sarma);
  dish(14.5, 17, () => c.plate);
  p.box(13, 3, 15, 16, 5, 18, c.mozzarella);
  dish(23.5, 17, () => c.plate);
  p.box(21, 3, 15, 26, 4, 17, (_x, y, z) => (z === 17 && y === 3 ? c.melonRind : c.melon));
  return p;
}

function kalamar(c: FC): Prop {
  const p = new Prop(26, 8, 24, S);
  p.cylY(13, 12, 11.5, 0, 0, c.ceramicWhite);
  p.cylY(13, 12, 11.5, 1, 1, (x, _y, z) => (dist(x, z, 13, 12) > 10.4 ? c.ceramicBlue : 0));
  // rings of fried squid heaped on the plate, a bowl of white walnut tarator, lemon
  for (let k = 0; k < 9; k++) {
    const a = k * 2.1, d = (k % 3) * 2.6 + 1.5, cx = 10 + Math.cos(a) * d, cz = 12 + Math.sin(a) * d, y0 = 1 + (k % 2);
    for (let z = 0; z <= 6; z++) for (let x = 0; x <= 6; x++) {
      const r = Math.hypot(x - 3, z - 3);
      if (r > 3.1 || r < 1.6) continue;
      p.set(Math.round(cx + x - 3), y0, Math.round(cz + z - 3), (x + z + k) % 3 ? c.fry : c.fryDark);
    }
  }
  p.cylY(19.5, 17.5, 3.2, 1, 3, c.ceramicWhite);
  p.cylY(19.5, 17.5, 2.4, 3, 3, (x, _y, z) => ((x + z) % 4 === 0 ? c.walnut : c.begendi));
  p.box(19, 1, 5, 22, 2, 7, c.lemon);
  return p;
}

function kahve(c: FC): Prop {
  const p = new Prop(20, 12, 18, S);
  // a hammered copper tray: the little cup of coffee with its foam, a glass of water, a cube of lokum
  p.cylY(10, 9, 9, 0, 0, (x, _y, z) => ((x + z) % 3 === 0 ? c.copperDark : c.copper));
  p.cylY(7, 9, 3.6, 1, 1, c.ceramicWhite);
  p.cylY(7, 9, 2.6, 2, 7, (_x, y) => (y === 7 ? c.gold : c.ceramicWhite));
  p.cylY(7, 9, 1.9, 6, 7, (x, _y, z) => ((x + z) % 3 === 0 ? c.crema : c.coffeeDark));
  p.box(4, 4, 9, 4, 6, 9, c.ceramicWhite);
  p.cylY(14.5, 6, 2, 1, 9, c.water);
  p.box(13, 1, 12, 15, 3, 14, c.rose); p.set(14, 4, 13, c.sugar);
  return p;
}

function lokum(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  iznik(p, c, 11, 11, 10.5);
  // cubes of Turkish delight: rose, lemon, pistachio, dusted in powdered sugar
  const cols = [c.rose, c.lemonCream, c.rose, c.antep, c.rose, c.lemonCream, c.antep, c.rose, c.lemonCream];
  for (let k = 0; k < 9; k++) {
    const x0 = 5 + (k % 3) * 4, z0 = 5 + Math.floor(k / 3) * 4;
    p.box(x0, 1, z0, x0 + 2, 3, z0 + 2, (x, y, z) => (y === 3 && (x + z) % 2 ? c.sugar : cols[k]));
    if (cols[k] === c.antep) p.set(x0 + 1, 2, z0, c.pistachio);
  }
  return p;
}

function karniyarik(c: FC): Prop {
  const p = new Prop(28, 10, 22, S);
  iznik(p, c, 14, 11, 10.5);
  // a whole aubergine split down the belly, filled with mince, a slice of tomato and a green pepper on top
  for (let x = 5; x <= 22; x++) {
    const t = Math.abs(x - 13.5) / 9, half = 3.8 * Math.sqrt(Math.max(0, 1 - t * t));
    for (let z = 0; z < 22; z++) for (let y = 0; y <= 4; y++) {
      const dz = Math.abs(z + 0.5 - 11), d = Math.hypot(dz / half, (y + 0.5 - 2) / 2.4);
      if (d > 1) continue;
      p.set(x, 1 + y, z, d > 0.75 ? c.aubergineIn : y >= 3 ? c.meat : c.aubergine);
    }
  }
  p.box(4, 3, 10, 5, 4, 12, c.leaf);
  for (let x = 8; x <= 19; x++) for (let z = 10; z <= 12; z++) p.set(x, 5, z, (x + z) % 3 ? c.meat : c.meatDark);
  p.box(12, 6, 10, 14, 6, 12, c.tomato);
  p.box(16, 6, 11, 19, 6, 11, c.pepper);
  return p;
}

function cacik(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.cylY(10, 10, 9, 0, 0, c.plate);
  // a bowl of cold yoghurt with grated cucumber, mint and a thread of olive oil
  bowl(p, c.ceramicWhite, 10, 10, 7, 6);
  p.cylY(10, 10, 6, 1, 5, c.yoghurt);
  scatter(p, 10, 10, 5, 22, () => c.gherkin, 841);
  scatter(p, 10, 10, 5, 9, () => c.mint, 842);
  for (let k = 0; k < 8; k++) p.set(7 + k, 7, 10 + Math.round(Math.sin(k)), c.oil);
  return p;
}

function kumpir(c: FC): Prop {
  const p = new Prop(26, 14, 20, S);
  // a giant potato in foil on a paper boat, split and heaped with corn, olives, pickles, sausage, red cabbage, sauces
  p.box(1, 0, 2, 24, 0, 17, c.paper);
  p.box(1, 1, 2, 24, 2, 2, c.paper); p.box(1, 1, 17, 24, 2, 17, c.paper);
  p.ellipsoid(12.5, 3, 10, 10.5, 4.2, 6.8, (x, y, z) => (y <= 2 ? c.steelLight : (x + z) % 5 === 0 ? c.potSkin : c.potatoHi));
  p.ellipsoid(12.5, 6, 10, 8.5, 2.6, 5, (x, y, z) => ((x + y + z) % 4 === 0 ? c.cheese : c.potatoHi));
  const tops = [c.corn, c.olive, c.gherkin, c.sausage, c.redOnion, c.carrot, c.corn, c.olive];
  scatter(p, 12.5, 10, 7, 80, (() => { let i = 0; return () => tops[i++ % tops.length]; })(), 851);
  for (let x = 6; x <= 19; x++) { p.set(x, 11, 9 + (x % 2), c.tomato); if (x % 2) p.set(x, 11, 11, c.mayo); }
  return p;
}

function waffle(c: FC): Prop {
  const p = new Prop(28, 9, 18, S);
  p.box(0, 0, 1, 27, 0, 16, c.paper);
  // a waffle grid painted with chocolate and covered with banana, strawberry, kiwi and pistachio
  p.box(2, 1, 3, 25, 3, 14, (x, y, z) => (y === 3 && (x % 3 === 0 || z % 3 === 0) ? c.waferDark : c.wafer));
  p.box(3, 4, 4, 24, 4, 13, (x, _y, z) => ((x + z) % 7 === 0 ? c.chocolateDark : c.chocolate));
  const fruit: [number, number, number][] = [];
  for (let k = 0; k < 10; k++) fruit.push([4 + (k % 5) * 4.2, 6 + Math.floor(k / 5) * 4, k]);
  for (const [x, z, k] of fruit) {
    const col = k % 3 === 0 ? c.banana : k % 3 === 1 ? c.cherry : c.kiwi;
    p.cylY(x + 1, z + 1, 1.6, 5, 5, col);
    if (col === c.kiwi) p.set(Math.round(x + 0.5), 6, Math.round(z + 0.5), c.seed);
  }
  scatter(p, 14, 8.5, 9, 30, () => c.antep, 861);
  return p;
}

function lokma(c: FC): Prop {
  const p = new Prop(22, 10, 18, S);
  // a paper tray of golden fried dough balls glossy with syrup, cinnamon, a little wooden fork
  p.box(1, 0, 1, 20, 0, 16, c.paper);
  p.box(1, 1, 1, 20, 1, 1, c.paperRed); p.box(1, 1, 16, 20, 1, 16, c.paperRed);
  const rr = rng(871);
  for (let k = 0; k < 13; k++) {
    const x = 4 + (k % 5) * 3.3 + rr(), z = 4 + Math.floor(k / 5) * 4 + rr(), y = 2.4 + (k % 4 === 0 ? 2 : 0);
    p.ellipsoid(x, y, z, 1.9, 1.8, 1.9, (xx, yy, zz) => ((xx + yy + zz) % 4 === 0 ? c.syrup : (xx + zz) % 3 ? c.fry : c.fryDark));
  }
  scatter(p, 11, 8.5, 7, 8, () => c.cinnamon, 872);
  p.box(17, 4, 3, 17, 4, 12, c.skewer);
  return p;
}

function boza(c: FC): Prop {
  const p = new Prop(18, 16, 16, S);
  p.cylY(8, 8, 6.5, 0, 0, c.plate);
  // a glass of thick pale boza, cinnamon on the top, a dish of roasted chickpeas
  p.cylY(7, 8, 3.8, 1, 11, c.glass);
  p.cylY(7, 8, 3.1, 2, 10, c.boza);
  p.cylY(7, 8, 3.1, 11, 11, (x, _y, z) => ((x + z) % 2 ? c.cinnamon : c.boza));
  p.cylY(14, 4, 2.6, 0, 1, c.ceramicWhite);
  for (const [x, z] of [[13, 3], [15, 4], [14, 5], [13, 5]] as const) p.set(x, 2, z, c.chickpea);
  return p;
}

function gozleme(c: FC): Prop {
  const p = new Prop(30, 8, 20, S);
  p.box(0, 0, 0, 29, 0, 19, c.board);
  // a long folded flatbread, browned in blisters from the sac, cut open to show cheese and spinach
  for (let x = 2; x <= 27; x++) for (let z = 3; z <= 16; z++) {
    const top = (x * 7 + z * 13) % 9 === 0 ? c.char : (x * 3 + z) % 5 === 0 ? c.crustHi : c.lavash;
    p.set(x, 1, z, c.lavash); p.set(x, 3, z, top);
    p.set(x, 2, z, x === 2 || x === 27 || z === 3 || z === 16 ? c.lavash : (x + z) % 3 ? c.mozzarella : c.leaf);
  }
  // one piece cut and pulled apart
  p.box(14, 1, 3, 15, 3, 16, 0);
  p.box(14, 2, 4, 14, 2, 15, (_x, _y, z) => (z % 2 ? c.leaf : c.mozzarella));
  for (let x = 4; x <= 26; x += 4) p.set(x, 4, 9, c.oil);
  return p;
}

function cay(c: FC): Prop {
  const p = new Prop(16, 16, 16, S);
  // a red-rimmed saucer, a tulip glass of deep red tea, two sugar cubes and a tiny spoon
  p.cylY(8, 8, 6.5, 0, 0, (x, _y, z) => (dist(x, z, 8, 8) > 5.5 ? c.iznikRed : c.ceramicWhite));
  for (let y = 1; y <= 11; y++) {
    const r = y < 3 ? 2.2 : y < 6 ? 2.6 - (y - 3) * 0.25 : 1.9 + (y - 6) * 0.22;
    p.cylY(8, 8, r, y, y, c.tulipGlass);
  }
  for (let y = 2; y <= 9; y++) p.cylY(8, 8, (y < 3 ? 1.6 : y < 6 ? 1.9 - (y - 3) * 0.25 : 1.3 + (y - 6) * 0.22), y, y, c.tea);
  for (let y = 10; y <= 11; y++) p.cylY(8, 8, 1.3 + (y - 6) * 0.22, y, y, 0);
  p.box(12, 1, 6, 13, 2, 7, c.sugar); p.box(12, 1, 9, 13, 2, 10, c.sugar);
  p.box(3, 1, 8, 3, 1, 12, c.steelLight);
  return p;
}

export function buildIstanbulFood(id: IstanbulFood, c: FC): Prop | null {
  switch (id) {
    case 'iskender': return iskender(c);
    case 'sutlac': return sutlac(c);
    case 'lahmacun': return lahmacun(c);
    case 'salgam': return salgam(c);
    case 'karapide': return karapide(c);
    case 'hamsi': return hamsi(c);
    case 'kurufasulye': return kurufasulye(c);
    case 'mercimek': return mercimek(c);
    case 'kofte': return kofte(c);
    case 'piyaz': return piyaz(c);
    case 'tavukgogsu': return tavukgogsu(c);
    case 'kazandibi': return kazandibi(c);
    case 'menemen': return menemen(c);
    case 'kaymak': return kaymak(c);
    case 'meze': return meze(c);
    case 'kalamar': return kalamar(c);
    case 'kahve': return kahve(c);
    case 'lokum': return lokum(c);
    case 'karniyarik': return karniyarik(c);
    case 'cacik': return cacik(c);
    case 'kumpir': return kumpir(c);
    case 'waffle': return waffle(c);
    case 'lokma': return lokma(c);
    case 'boza': return boza(c);
    case 'gozleme': return gozleme(c);
    case 'cay': return cay(c);
  }
  return null;
}
