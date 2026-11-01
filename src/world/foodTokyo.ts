import { rng } from './grid';
import { Prop } from './props';
import type { foodColors } from './food';

/** Tokyo's second menu as voxel models (40 voxels to the metre, like every dish). */
type FC = ReturnType<typeof foodColors>;
const S = 1 / 40;

export type TokyoFood =
  | 'oden' | 'yakionigiri' | 'tonkatsu' | 'katsusando' | 'unadon' | 'umaki' | 'omurice' | 'hambagu' | 'sukiyaki' | 'chawanmushi'
  | 'anmitsu' | 'kakigori' | 'fruitsando' | 'kurimupan' | 'matcha' | 'warabimochi' | 'sashimi' | 'agedashi' | 'sabashio' | 'nikujaga'
  | 'kitsune' | 'curryudon';

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

/** A deep bowl, `r` across at the top, `h` high, hollow. */
function bowl(p: Prop, col: number | ((x: number, y: number, z: number) => number), cx: number, cz: number, r: number, h: number): void {
  for (let y = 0; y <= h; y++) p.cylY(cx, cz, r - (h - y) * 0.6, y, y, col);
  p.cylY(cx, cz, r - 1, 1, h, 0);
}

function scatter(p: Prop, cx: number, cz: number, r: number, n: number, col: number | (() => number), seed: number): void {
  const rr = rng(seed);
  for (let k = 0; k < n; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * r;
    const x = Math.round(cx + Math.cos(a) * d - 0.5), z = Math.round(cz + Math.sin(a) * d - 0.5);
    let y = p.sy - 1;
    while (y > 0 && !p.get(x, y - 1, z)) y--;
    p.set(x, y, z, typeof col === 'function' ? col() : col);
  }
}

/** A rectangular plate, dark glaze with a light rim (the izakaya's mino-yaki). */
function slab(p: Prop, c: FC, x0: number, z0: number, x1: number, z1: number, col = c.plateBlue): void {
  p.box(x0, 0, z0, x1, 0, z1, col);
  p.box(x0, 1, z0, x1, 1, z1, (x, _y, z) => (x === x0 || x === x1 || z === z0 || z === z1 ? col : 0));
}

/** Two slices of soft white bread with a filling, cut to show the section. */
function sando(p: Prop, c: FC, x0: number, z0: number, w: number, fill: (x: number, y: number) => number): void {
  for (let x = x0; x < x0 + w; x++) for (let y = 1; y <= 10; y++) {
    const edge = y <= 2 || y >= 9;
    for (let z = z0; z < z0 + 8; z++) p.set(x, y, z, edge ? c.shokupan : z === z0 || z === z0 + 7 ? fill(x - x0, y) : c.shokupan);
  }
}

function oden(c: FC): Prop {
  const p = new Prop(24, 12, 22, S);
  // a shallow earthenware dish of dashi: a round of daikon, an egg, a chikuwa, a konnyaku triangle, karashi on the rim
  bowl(p, (x, y, z) => ((x + y + z) % 5 === 0 ? c.terracottaDark : c.choko), 12, 11, 10.5, 4);
  p.cylY(12, 11, 9.5, 1, 3, c.broth2);
  p.cylY(8, 8, 3.6, 3, 7, (_x, y) => (y === 7 ? c.dashiDaikon : c.dashiDaikon));
  p.ellipsoid(16, 5, 8, 2.6, 3, 2.6, (_x, y) => (y >= 6 ? c.eggBrown : c.eggBrown));
  for (let x = 6; x <= 17; x++) for (let y = 3; y <= 6; y++) for (let z = 13; z <= 16; z++) { const d = Math.hypot(y - 4.5, z - 14.5); if (d <= 2 && d > 0.9) p.set(x, y, z, x % 4 === 0 ? c.chikuwaBurnt : c.chikuwa); }
  for (let y = 3; y <= 7; y++) p.box(17, y, 14 - Math.floor((y - 3) / 2), 21 - (y - 3), y, 16, c.konnyaku);
  p.box(20, 5, 4, 21, 5, 5, c.mustard);
  return p;
}

function yakionigiri(c: FC): Prop {
  const p = new Prop(22, 12, 16, S);
  slab(p, c, 0, 0, 21, 15);
  // two triangles of rice grilled brown and glossy with soy, a pickle
  for (const x0 of [2, 11]) for (let y = 0; y < 9; y++) {
    const hw = (8 - y) * 0.48 + 0.5;
    for (let x = 0; x < 9; x++) for (let z = 4; z < 11; z++) if (Math.abs(x + 0.5 - 4.5) <= hw) p.set(x0 + x, 1 + y, z, z === 4 || z === 10 || Math.abs(x + 0.5 - 4.5) > hw - 1 || y === 8 ? ((x + y + z) % 3 ? c.mitarashi : c.chashuEdge) : c.rice);
  }
  p.box(9, 1, 12, 12, 2, 13, c.ceramicYellow);
  return p;
}

function tonkatsu(c: FC): Prop {
  const p = new Prop(30, 10, 24, S);
  // the teishoku tray: the sliced cutlet on cabbage, a bowl of rice, miso soup
  p.box(0, 0, 0, 29, 0, 23, c.board);
  p.box(2, 1, 2, 19, 1, 21, c.ceramicWhite);
  for (let x = 3; x <= 9; x++) for (let z = 4; z <= 19; z++) p.set(x, 2 + ((x + z) % 3 === 0 ? 1 : 0), z, (x * z) % 5 === 0 ? c.lettuce : c.cabbage);
  for (let k = 0; k < 6; k++) {
    const z0 = 4 + k * 2.6 | 0;
    p.box(10, 2, z0, 17, 4, z0 + 1, (x, y, z) => (y === 4 || x === 10 || x === 17 ? ((x + z) % 3 ? c.tempura : c.tempuraHi) : z === z0 ? c.porkCut : c.porkCut));
    p.box(11, 3, z0, 16, 3, z0, (x) => (x === 11 || x === 16 ? c.porkFat : c.porkCut));
  }
  p.box(18, 2, 16, 19, 3, 19, c.lemon);
  bowl(p, c.choko, 24, 7, 4, 5); p.ellipsoid(24, 5.5, 7, 3, 1.6, 3, c.rice);
  bowl(p, c.bowl, 24, 17, 4, 5); p.cylY(24, 17, 3, 4, 4, c.miso2); p.set(24, 5, 17, c.negi);
  return p;
}

function katsusando(c: FC): Prop {
  const p = new Prop(24, 12, 14, S);
  p.box(0, 0, 0, 23, 0, 13, c.paper);
  // two halves cut to show the cutlet in its sauce between the white bread
  for (const x0 of [2, 13]) sando(p, c, x0, 3, 9, (_x, y) => (y >= 6 && y <= 7 ? c.sauce : y >= 4 && y <= 5 ? c.porkCut : y === 3 || y === 8 ? c.tempura : c.cabbage));
  return p;
}

function unadon(c: FC): Prop {
  const p = new Prop(28, 11, 22, S);
  // the lacquered box (jū): black outside, red inside, rice and the glazed eel fillets laid across
  p.box(1, 0, 1, 26, 6, 20, (x, y, z) => (x === 1 || x === 26 || z === 1 || z === 20 || y === 0 ? (y >= 5 ? c.bowl : c.lacquer) : 0));
  p.box(2, 1, 2, 25, 4, 19, c.rice);
  for (const z0 of [3, 11]) p.box(3, 5, z0, 24, 6, z0 + 6, (x, y, z) => (y === 6 && (x + z) % 4 === 0 ? c.eelDark : (x % 5 === 0 ? c.eelDark : c.eel)));
  scatter(p, 14, 11, 8, 12, () => c.leaf, 701);
  p.box(1, 0, 21, 26, 1, 21, c.lacquer);
  return p;
}

function umaki(c: FC): Prop {
  const p = new Prop(24, 10, 16, S);
  slab(p, c, 0, 0, 23, 15, c.ceramicWhite);
  // slices of rolled omelette with the eel in the middle, grated daikon
  for (let k = 0; k < 4; k++) {
    const x0 = 2 + k * 4;
    p.box(x0, 1, 4, x0 + 2, 7, 11, (x, y, z) => (x === x0 && y >= 3 && y <= 5 && z >= 6 && z <= 9 ? c.eel : (y + (z >> 1)) % 3 === 0 ? c.tamagoDark : c.tamago));
  }
  p.ellipsoid(20, 2, 8, 2, 1.6, 2.4, c.daikon);
  return p;
}

function omurice(c: FC): Prop {
  const p = new Prop(28, 11, 22, S);
  p.cylY(14, 11, 12, 0, 0, c.plate);
  // the omelette football split along the top, the rice peeking out, demi-glace round it
  p.cylY(14, 11, 11, 1, 1, (x, _y, z) => (dist(x, z, 14, 11) > 9 ? c.sauce : 0));
  p.ellipsoid(14, 1, 11, 9, 5.6, 5.4, (x, y, z) => (y >= 5 && Math.abs(z + 0.5 - 11) < 1.6 ? c.ketchupRice : (x + y + z) % 6 === 0 ? c.tamagoDark : c.tamago));
  p.box(8, 6, 10, 20, 6, 11, c.tamago);
  p.box(12, 7, 10, 16, 7, 11, c.sauce);
  p.box(13, 8, 11, 14, 8, 11, c.parsley);
  return p;
}

function hambagu(c: FC): Prop {
  const p = new Prop(30, 11, 22, S);
  // the sizzling iron plate on its wooden board: the patty under demi-glace, a fried egg, corn, carrot, potatoes
  p.box(0, 0, 0, 29, 1, 21, c.board);
  p.cylY(15, 11, 10, 2, 2, c.steel);
  p.cylY(15, 11, 10, 3, 3, (x, _y, z) => (dist(x, z, 15, 11) > 9 ? c.steel : 0));
  p.ellipsoid(13, 3, 11, 6.5, 3, 5, (x, y, z) => (y >= 5 ? c.sauce : (x + z) % 4 === 0 ? c.meatDark : c.meat));
  p.cylY(13, 11, 3.2, 6, 6, c.eggWhite); p.cylY(13, 11, 1.4, 7, 7, c.yolk);
  p.box(20, 3, 5, 23, 3, 8, c.corn); p.box(20, 3, 10, 23, 4, 12, c.carrot); p.ellipsoid(21.5, 4, 15.5, 2, 1.6, 2, c.potatoHi);
  return p;
}

function sukiyaki(c: FC): Prop {
  const p = new Prop(28, 12, 26, S);
  // the shallow iron pot: folded slices of marbled beef, tofu, negi, shiitake, shirataki in the sweet broth; the egg bowl
  p.cylY(12, 13, 11, 0, 3, c.steel);
  p.cylY(12, 13, 10, 1, 3, 0);
  p.cylY(12, 13, 10, 1, 1, c.broth);
  for (let k = 0; k < 4; k++) p.box(5 + k * 4, 2, 6, 7 + k * 4, 3, 12, (x, y, z) => ((x + z * 3) % 5 === 0 ? c.porkFat : y === 3 ? c.beef : c.meat));
  p.box(5, 2, 15, 9, 4, 18, (x, y) => (y === 4 && x % 2 ? c.cheeseBrown : c.tofu));
  for (let x = 11; x <= 19; x++) p.box(x, 2, 15 + (x % 2), x, 3, 15 + (x % 2), x % 3 ? c.negi : c.scallionWhite);
  for (const [x, z] of [[13, 19], [17, 19], [10, 20]] as const) p.box(x, 2, z, x + 1, 3, z + 1, c.shiitake);
  bowl(p, c.ceramicWhite, 24, 4, 3.4, 4); p.cylY(24, 4, 2.4, 3, 3, c.yolk);
  return p;
}

function chawanmushi(c: FC): Prop {
  const p = new Prop(18, 14, 16, S);
  p.box(1, 0, 1, 16, 0, 14, c.board);
  // the lidded cup lifted aside: the pale custard with a shrimp, a ginkgo nut and a leaf of mitsuba on top
  bowl(p, c.ceramicBlue, 7, 8, 4.6, 8);
  p.cylY(7, 8, 3.6, 1, 7, c.chawan);
  p.box(6, 8, 7, 8, 8, 8, c.shrimp); p.set(5, 8, 9, c.ceramicYellow); p.box(8, 8, 9, 9, 8, 9, c.shiso);
  p.cylY(14, 5, 3, 1, 1, c.ceramicBlue); p.cylY(14, 5, 1, 2, 2, c.ceramicBlue);
  return p;
}

function anmitsu(c: FC): Prop {
  const p = new Prop(20, 14, 20, S);
  p.cylY(10, 10, 8.5, 0, 0, c.plate);
  // a glass dish of clear agar cubes, red bean, white mochi, mandarin and a cherry, soft-serve on top, black syrup
  bowl(p, c.glass, 10, 10, 7.5, 6);
  p.cylY(10, 10, 6.5, 1, 4, (x, y, z) => ((x + y + z) % 3 === 0 ? c.kanten : (x + z) % 2 ? c.kantenB : c.kanten));
  p.ellipsoid(6, 5, 7, 2.4, 1.6, 2.4, c.bean);
  for (const [x, z] of [[13, 6], [14, 9]] as const) p.ellipsoid(x, 5, z, 1.4, 1.2, 1.4, c.dango);
  p.box(5, 5, 12, 7, 5, 14, c.mikan);
  p.cylY(11, 12, 2.6, 5, 8, c.cream); p.cylY(11, 12, 1.6, 9, 10, c.cream); p.set(11, 11, 12, c.cream);
  p.set(14, 6, 13, c.cherry);
  p.box(8, 5, 9, 9, 5, 10, c.caramel);
  return p;
}

function kakigori(c: FC): Prop {
  const p = new Prop(20, 26, 20, S);
  p.cylY(10, 10, 8, 0, 0, c.plate);
  // a mountain of feathery shaved ice in a glass bowl, matcha syrup running down, red beans and condensed milk
  bowl(p, c.glass, 10, 10, 6, 4);
  for (let y = 4; y <= 21; y++) {
    const r = 7.2 * Math.sqrt(Math.max(0, 1 - ((y - 4) / 18) ** 2));
    p.cylY(10, 10, r, y, y, (x, yy, z) => (yy > 13 || (x * 3 + z + yy) % 5 < 3 ? c.matchaSyrup : c.ice));
  }
  p.ellipsoid(13, 9, 6, 2.6, 2, 2.6, c.bean);
  for (let x = 7; x <= 12; x++) p.set(x, 21 - Math.abs(x - 10), 10, c.cream);
  return p;
}

function fruitsando(c: FC): Prop {
  const p = new Prop(24, 12, 14, S);
  p.box(0, 0, 0, 23, 0, 13, c.paper);
  // two halves cut through the whole strawberries, kiwi and mandarin so the section shows a flower in the cream
  for (const [x0, berry] of [[2, c.cherry], [13, c.kiwi]] as [number, number][]) sando(p, c, x0, 3, 9, (x, y) => {
    const d = Math.hypot(x - 4, y - 5.5);
    return d < 1.5 ? c.cream : d < 2.8 ? berry : (x < 2 && y >= 4 && y <= 7) ? c.mikan : c.cream;
  });
  return p;
}

function kurimupan(c: FC): Prop {
  const p = new Prop(20, 10, 18, S);
  p.box(0, 0, 0, 19, 0, 17, c.paper);
  // the glove-shaped bun, glossy brown, one torn open to show the custard
  for (const z0 of [2, 9]) {
    p.ellipsoid(9, 2, z0 + 3, 7.5, 3.2, 3.2, (_x, y) => (y >= 4 ? c.pastryDark : c.pastry));
    for (let k = 0; k < 4; k++) p.box(15, 1, z0 + k * 2 - 0, 16, 2, z0 + k * 2, c.pastryDark);
  }
  p.box(3, 3, 12, 7, 4, 13, c.custard);
  return p;
}

function matcha(c: FC): Prop {
  const p = new Prop(24, 12, 18, S);
  // a lacquer tray: the rough raku bowl of frothy green tea and a maple-leaf nerikiri on a kaishi paper
  p.box(0, 0, 0, 23, 0, 17, c.lacquer); p.box(0, 1, 0, 23, 1, 0, c.lacquer); p.box(0, 1, 17, 23, 1, 17, c.lacquer);
  bowl(p, (x, y, z) => ((x * 3 + y + z) % 4 === 0 ? c.rakuB : c.raku), 8, 9, 6, 7);
  p.cylY(8, 9, 5, 2, 6, c.matchaTea); p.cylY(8, 9, 4.6, 7, 7, (x, _y, z) => ((x + z) % 3 ? c.matchaFoam : c.matchaTea));
  p.box(15, 1, 5, 21, 1, 13, c.paper);
  p.ellipsoid(18, 3, 9, 2.8, 1.8, 2.8, (x, _y, z) => ((x + z) % 4 === 0 ? c.mapleLeaf : c.nerikiri));
  return p;
}

function warabimochi(c: FC): Prop {
  const p = new Prop(20, 9, 20, S);
  p.cylY(10, 10, 9, 0, 0, c.plateBlue);
  // trembling cubes of bracken jelly under a drift of kinako, black syrup on the side
  for (let k = 0; k < 7; k++) {
    const x = 4 + (k % 3) * 4.4, z = 4 + Math.floor(k / 3) * 4.4;
    p.box(Math.round(x), 1, Math.round(z), Math.round(x) + 2, 3, Math.round(z) + 2, (_x, y) => (y === 3 ? c.kinako : c.warabi));
  }
  scatter(p, 10, 10, 7, 30, () => c.kinako, 711);
  p.cylY(16, 15, 2, 1, 3, c.ceramicWhite); p.cylY(16, 15, 1.2, 3, 3, c.caramel);
  return p;
}

function sashimi(c: FC): Prop {
  const p = new Prop(28, 10, 24, S);
  // a wooden boat of crushed ice and shiso: slices of red tuna, salmon, white sea bream and scallops, daikon, wasabi
  p.box(1, 0, 3, 26, 2, 20, (x, y, z) => (x === 1 || x === 26 || z === 3 || z === 20 || y === 0 ? c.geta : c.ice));
  p.box(2, 3, 4, 25, 3, 19, c.ice);
  for (let k = 0; k < 4; k++) p.box(3 + k * 2, 4, 5, 4 + k * 2, 6, 10, (_x, y) => (y === 6 ? c.tuna : c.tuna));
  for (let k = 0; k < 4; k++) p.box(3 + k * 2, 4, 12, 4 + k * 2, 6, 17, (x, y) => ((x + y) % 2 ? c.salmonFish : c.salmonFat));
  for (let k = 0; k < 3; k++) p.box(14 + k * 2, 4, 5, 15 + k * 2, 5, 10, (x) => (x % 2 ? c.taiFish : c.fishSkin2));
  for (const [x, z] of [[15, 14], [19, 14]] as const) p.cylY(x, z, 1.8, 4, 5, c.scallop);
  p.box(22, 4, 5, 24, 6, 17, (x, y, z) => ((x + y + z) % 2 ? c.daikon : c.scallionWhite));
  p.box(20, 4, 17, 21, 4, 18, c.shiso); p.ellipsoid(21, 5.5, 17.5, 1, 1, 1, c.wasabi);
  return p;
}

function agedashi(c: FC): Prop {
  const p = new Prop(20, 12, 20, S);
  // a deep bowl of hot dashi, three cubes of crisp-coated tofu, grated daikon and ginger, onion, dancing bonito
  bowl(p, c.choko, 10, 10, 8, 6);
  p.cylY(10, 10, 6.6, 1, 3, c.broth2);
  for (const [x, z] of [[6, 7], [11, 6], [8, 12]] as const) p.box(x, 2, z, x + 3, 6, z + 3, (xx, y, zz) => (y === 6 || xx === x || zz === z ? c.ageCoat : c.tofu));
  p.ellipsoid(12.5, 7, 12.5, 1.6, 1, 1.6, c.daikon); p.set(12, 8, 12, c.ginger);
  scatter(p, 10, 10, 4, 8, () => c.negi, 712);
  scatter(p, 10, 10, 3, 10, () => c.bonito, 713);
  return p;
}

function sabashio(c: FC): Prop {
  const p = new Prop(30, 8, 18, S);
  slab(p, c, 0, 0, 29, 17, c.ceramicWhite);
  // a salted mackerel fillet, the skin blistered black over silver and blue stripes, daikon and lemon
  for (let x = 3; x <= 21; x++) for (let z = 4; z <= 13; z++) {
    if (Math.abs(z + 0.5 - 8.5) > 5 - Math.abs(x - 12) * 0.12) continue;
    p.set(x, 1, z, c.fishSkin2);
    p.set(x, 2, z, (x * 7 + z * 3) % 9 === 0 ? c.char : (z + Math.floor(x / 2)) % 3 === 0 ? c.mackerelBack : (x + z) % 4 === 0 ? c.chashuEdge : c.mackerel);
  }
  p.ellipsoid(25, 2, 6, 2.2, 1.6, 2.2, c.daikon); p.set(25, 4, 6, c.soy2);
  p.box(23, 1, 11, 26, 2, 13, c.lemon);
  return p;
}

function nikujaga(c: FC): Prop {
  const p = new Prop(22, 12, 22, S);
  // a deep earthenware bowl: chunks of potato and carrot, ribbons of beef and onion, shirataki, a few green peas
  bowl(p, (x, y, z) => ((x + y + z) % 6 === 0 ? c.terracottaDark : c.terracotta), 11, 11, 9, 6);
  p.cylY(11, 11, 7.6, 1, 3, c.broth);
  const r = rng(714);
  for (let k = 0; k < 7; k++) { const a = r() * Math.PI * 2, d = r() * 4.6; p.ellipsoid(11 + Math.cos(a) * d, 4.5, 11 + Math.sin(a) * d, 2, 1.8, 2, k % 3 ? c.potatoHi : c.potato); }
  scatter(p, 11, 11, 6, 22, () => (r() < 0.5 ? c.meat : r() < 0.5 ? c.onion : c.carrot), 715);
  scatter(p, 11, 11, 5, 5, () => c.pepper, 716);
  return p;
}

/** A big noodle bowl of broth with thick udon showing. */
function udonBowl(p: Prop, c: FC, broth: number): void {
  bowl(p, c.choko, 12, 12, 10.5, 7);
  p.cylY(12, 12, 9.4, 1, 6, broth);
  for (let x = 4; x <= 20; x++) for (let z = 4; z <= 20; z++) if (dist(x, z, 12, 12) < 8.6 && (x * 2 + z) % 5 === 0) p.set(x, 6, z, c.udon);
}

function kitsune(c: FC): Prop {
  const p = new Prop(24, 11, 24, S);
  udonBowl(p, c, c.broth);
  // the big pouch of sweet fried tofu, two slices of kamaboko, onion
  p.box(5, 7, 6, 14, 8, 14, (x, y, z) => (y === 8 && (x + z) % 3 === 0 ? c.ageDark : c.ageCoat));
  p.box(16, 7, 8, 18, 8, 9, (_x, y) => (y === 8 ? c.narutoPink : c.naruto)); p.box(16, 7, 12, 18, 8, 13, (_x, y) => (y === 8 ? c.narutoPink : c.naruto));
  scatter(p, 15, 16, 3, 9, () => c.negi, 717);
  return p;
}

function curryudon(c: FC): Prop {
  const p = new Prop(24, 11, 24, S);
  udonBowl(p, c, c.curry);
  // thick curry over the noodles, slices of pork and onion, a heap of green onion
  p.cylY(12, 12, 8, 6, 6, (x, _y, z) => ((x * 3 + z) % 5 === 0 ? c.udon : c.curry));
  scatter(p, 12, 12, 6, 14, () => c.meat, 718);
  scatter(p, 12, 12, 6, 8, () => c.onion, 719);
  p.ellipsoid(14, 7, 10, 2.4, 1, 2.4, c.negi);
  return p;
}

export function buildTokyoFood(id: TokyoFood, c: FC): Prop | null {
  switch (id) {
    case 'oden': return oden(c);
    case 'yakionigiri': return yakionigiri(c);
    case 'tonkatsu': return tonkatsu(c);
    case 'katsusando': return katsusando(c);
    case 'unadon': return unadon(c);
    case 'umaki': return umaki(c);
    case 'omurice': return omurice(c);
    case 'hambagu': return hambagu(c);
    case 'sukiyaki': return sukiyaki(c);
    case 'chawanmushi': return chawanmushi(c);
    case 'anmitsu': return anmitsu(c);
    case 'kakigori': return kakigori(c);
    case 'fruitsando': return fruitsando(c);
    case 'kurimupan': return kurimupan(c);
    case 'matcha': return matcha(c);
    case 'warabimochi': return warabimochi(c);
    case 'sashimi': return sashimi(c);
    case 'agedashi': return agedashi(c);
    case 'sabashio': return sabashio(c);
    case 'nikujaga': return nikujaga(c);
    case 'kitsune': return kitsune(c);
    case 'curryudon': return curryudon(c);
  }
  return null;
}
