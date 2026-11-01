import { rng } from './grid';
import { Prop } from './props';
import type { foodColors } from './food';

/** Amalfi's second menu as voxel models (40 voxels to the metre, like every dish). */
type FC = ReturnType<typeof foodColors>;
const S = 1 / 40;

export type AmalfiFood =
  | 'tagliere' | 'panino' | 'paranza' | 'impepata' | 'genovese' | 'pastafagioli' | 'graffa' | 'struffoli'
  | 'sorbetto' | 'spremuta' | 'scoglio' | 'calamari' | 'pastapatate' | 'frittatapasta' | 'bufala' | 'provola';

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

/** The coast's plate: white, a ring of blue and yellow majolica at the rim. */
function maiolica(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (dist(x, z, cx, cz) > r - 1.3 ? ((x + z * 2) % 4 ? c.ceramicBlue : c.ceramicYellow) : 0));
}

/** A deep bowl, `r` across at the top, `h` high, hollow. */
function bowl(p: Prop, col: number | ((x: number, y: number, z: number) => number), cx: number, cz: number, r: number, h: number): void {
  for (let y = 0; y <= h; y++) p.cylY(cx, cz, r - (h - y) * 0.6, y, y, col);
  p.cylY(cx, cz, r - 1, 1, h, 0);
}

/** Scatter `n` voxels of a colour (or a picker) on top of whatever is in the circle. */
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

/** A heap of pasta strands or pieces in a bowl or on a plate, `top` voxels high in the middle. */
function heap(p: Prop, cx: number, cz: number, r: number, y0: number, top: number, col: (x: number, y: number, z: number) => number): void {
  for (let y = y0; y <= y0 + top; y++) p.cylY(cx, cz, r * Math.sqrt(1 - (y - y0) / (top + 1)), y, y, col);
}

// ------------------------------------------------------------------ the salumeria

function tagliere(c: FC): Prop {
  const p = new Prop(30, 8, 22, S);
  // an olive-wood board with its handle, salame, prosciutto folds, cheese wedges, olives and a few taralli
  p.box(1, 0, 2, 24, 1, 19, (x, y, z) => (y === 1 && (x + z) % 7 === 0 ? c.boardDark : c.board));
  p.box(25, 0, 8, 28, 1, 13, c.boardDark);
  p.cylY(27, 10.5, 1, 0, 1, 0);
  for (let i = 0; i < 4; i++) p.cylY(5 + i * 3.2, 6, 2.2, 2, 2, (x, _y, z) => (dist(x, z, 5 + i * 3.2, 6) < 1.2 && (x + z) % 2 ? c.porkFat : c.sausage2));
  for (let i = 0; i < 3; i++) p.ellipsoid(6 + i * 4.5, 3, 13, 2.4, 1.3, 2.6, (x, y) => ((x + y) % 3 ? c.beef : c.porkFat));
  for (const [x, z] of [[18, 5], [20, 9]]) p.box(x, 2, z, x + 3, 4, z + 2, (xx, y) => (y === 4 && xx === x ? c.cheeseBrown : c.provola));
  for (const [x, z] of [[19, 14], [21, 15], [20, 16], [22, 13]]) p.set(x, 2, z, c.olive);
  p.cylY(16, 16, 2, 2, 2, c.tarallo); p.cylY(16, 16, 0.9, 2, 2, 0);
  return p;
}

function panino(c: FC): Prop {
  const p = new Prop(26, 12, 14, S);
  // a long crusty roll split open: mortadella folds, provolone, rocket, on wax paper
  p.box(1, 0, 1, 24, 0, 12, c.paper);
  p.ellipsoid(12.5, 3, 7, 11, 2.6, 5, (x, y) => (y >= 3 ? c.breadCrust : (x % 3 ? c.bread : c.breadCrust)));
  p.box(2, 4, 3, 23, 5, 11, (x, y, z) => (y === 4 ? (z % 3 === 0 ? c.provola : c.beef) : (x + z) % 3 === 0 ? c.lettuce : c.porkCut));
  p.ellipsoid(12.5, 7.4, 7, 10.5, 2.2, 4.6, (x, y) => (y >= 8 ? c.breadCrust : (x % 4 ? c.bread : c.crust)));
  p.box(2, 6, 3, 23, 6, 11, (x, _y, z) => (z === 3 || z === 11 ? ((x % 2) ? c.lettuce : c.beef) : p.get(x, 6, z) || 0));
  return p;
}

// ------------------------------------------------------------------ the fish fry and the trattoria del porto

function paranza(c: FC): Prop {
  const p = new Prop(26, 9, 26, S);
  // a paper cone opened on a plate: little whole fish, red mullet tails, a lemon wedge
  maiolica(p, c, 13, 13, 12.5);
  p.box(5, 1, 5, 20, 1, 20, (x, _y, z) => (dist(x, z, 13, 13) < 8 ? c.paper : 0));
  const rr = rng(4114);
  for (let k = 0; k < 9; k++) {
    const x0 = 6 + Math.floor(rr() * 9), z0 = 6 + Math.floor(rr() * 12), y = 2 + Math.floor(rr() * 3);
    p.box(x0, y, z0, x0 + 5, y, z0, (x) => (x === x0 + 5 ? c.fishBack : x === x0 ? c.fryDark : k % 3 === 0 ? c.tomatoHi : c.fry));
  }
  p.box(18, 2, 16, 20, 3, 17, (_x, y) => (y === 3 ? c.lemon : c.lemonPeel));
  scatter(p, 12, 12, 6, 7, c.parsley, 4115);
  return p;
}

function impepata(c: FC): Prop {
  const p = new Prop(26, 11, 26, S);
  // a terracotta bowl of mussels in their juice, cracked black pepper, a slice of grilled bread
  bowl(p, (x, y, z) => ((x + y + z) % 5 === 0 ? c.terracottaDark : c.terracotta), 12, 12, 11, 4);
  p.cylY(12, 12, 8.5, 2, 2, c.broth2);
  const rr = rng(5521);
  for (let k = 0; k < 16; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 7, x = Math.round(12 + Math.cos(a) * d), z = Math.round(12 + Math.sin(a) * d), y = 3 + (k % 3);
    p.box(x - 1, y, z, x + 1, y, z + 1, (xx) => (xx === x - 1 ? c.mussel : xx === x ? c.musselIn : c.mussel));
  }
  scatter(p, 12, 12, 7, 14, c.pepperBlack, 5522);
  p.box(18, 4, 18, 24, 5, 23, (x, y, z) => (y === 5 && (x + z) % 3 === 0 ? c.char : y === 5 ? c.crust : c.breadIn));
  return p;
}

// ------------------------------------------------------------------ the osteria

function genovese(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // ziti broken by hand under a heap of melted onion and beef cooked down for hours
  maiolica(p, c, 13, 13, 12.5);
  heap(p, 13, 13, 9, 1, 4, (x, y, z) => ((x + z * 3 + y) % 4 === 0 ? c.pastaEdge : (x + y + z) % 2 ? c.caramel : c.mitarashiGloss));
  for (let k = 0; k < 10; k++) { const x = 8 + (k * 7) % 10, z = 8 + (k * 5) % 10; p.box(x, 3, z, x + 3, 3, z, c.spaghetti); }
  scatter(p, 13, 13, 5, 8, c.meatDark, 6630);
  scatter(p, 13, 13, 6, 10, c.parmesan, 6631);
  return p;
}

function pastafagioli(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // a deep bowl of mixed pasta and borlotti beans, a thread of oil and a basil leaf
  bowl(p, (x, y, z) => ((x + z) % 4 === 0 && y > 2 ? c.ceramicBlue : c.ceramicWhite), 13, 13, 11, 5);
  p.cylY(13, 13, 8.8, 4, 4, c.beanSauce);
  scatter(p, 13, 13, 8, 18, () => c.bean, 7741);
  scatter(p, 13, 13, 8, 18, () => c.pastaEdge, 7742);
  for (let a = 0; a < 12; a++) p.set(Math.round(13 + Math.cos(a / 2) * a * 0.55), 5, Math.round(13 + Math.sin(a / 2) * a * 0.55), c.oil);
  p.box(15, 6, 10, 17, 6, 11, c.basil);
  return p;
}

// ------------------------------------------------------------------ the friggitoria dolce

function graffa(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  // a fat ring doughnut of potato dough, fried golden and rolled in sugar, on a square of paper
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  for (let y = 1; y <= 5; y++) {
    const t = (y - 3) / 2.5;
    const ro = 8.5 * Math.sqrt(Math.max(0, 1 - t * t * 0.55)), ri = 3.2 + Math.abs(t) * 1.2;
    p.cylY(10.5, 10.5, ro, y, y, (x, yy, z) => (yy >= 4 && (x * 5 + z * 3) % 3 ? c.sugar : (x + z) % 4 ? c.pastry : c.pastryDark));
    p.cylY(10.5, 10.5, ri, y, y, 0);
  }
  return p;
}

function struffoli(c: FC): Prop {
  const p = new Prop(26, 12, 26, S);
  // a ring of tiny fried balls glued with honey, candied peel and hundreds-and-thousands
  maiolica(p, c, 13, 13, 12.5);
  for (let y = 1; y <= 6; y++) {
    const ro = 9.5 - (y - 1) * 0.9, ri = 2 + (y - 1) * 0.3;
    p.cylY(13, 13, ro, y, y, (x, yy, z) => ((x + yy + z) % 2 ? c.honeycomb : c.pastryLight));
    p.cylY(13, 13, ri, y, y, 0);
  }
  const sprinkle = [c.cherry, c.candied, c.lemonPeel, c.narutoPink, c.ceramicBlue];
  const rr = rng(8851);
  scatter(p, 13, 13, 9, 34, () => sprinkle[Math.floor(rr() * sprinkle.length)], 8852);
  return p;
}

// ------------------------------------------------------------------ the lemon kiosk

function sorbetto(c: FC): Prop {
  const p = new Prop(18, 18, 18, S);
  // a sfusato lemon hollowed out and filled with its own sorbet, its leaf still on, on a saucer
  p.cylY(9, 9, 8, 0, 0, c.ceramicWhite);
  p.cylY(9, 9, 8, 1, 1, (x, _y, z) => (dist(x, z, 9, 9) > 6.8 ? c.ceramicYellow : 0));
  p.ellipsoid(9, 6, 9, 6, 5.5, 6, (x, y, z) => ((x + y + z) % 5 === 0 ? c.lemonPeel : c.lemon));
  p.box(0, 8, 0, 17, 17, 17, 0);
  p.cylY(9, 9, 5, 7, 7, c.lemonGelato);
  p.ellipsoid(9, 8.5, 9, 4.4, 3.4, 4.4, (x, y, z) => ((x + y * 2 + z) % 6 === 0 ? c.lemonCream : c.lemonGelato));
  p.box(12, 9, 4, 15, 9, 5, c.leaf); p.box(13, 10, 3, 14, 10, 4, c.basil);
  return p;
}

function spremuta(c: FC): Prop {
  const p = new Prop(16, 20, 16, S);
  // a tall glass of fresh-squeezed orange and lemon, a half orange on the rim
  for (let y = 0; y <= 15; y++) p.cylY(8, 8, 4.4 + y * 0.08, y, y, (x, yy, z) => (yy === 0 ? c.ice : yy <= 12 ? (yy > 10 && (x + z) % 2 ? c.orangeIn : (x * 2 + yy + z) % 7 ? c.orange : c.orangeIn) : dist(x, z, 8, 8) > 3.8 + yy * 0.08 ? c.ice : 0));
  p.ellipsoid(12.5, 16, 8, 2.6, 2, 2.6, (_x, y) => (y >= 16 ? c.orangeIn : c.orange));
  p.box(7, 14, 7, 7, 19, 7, c.lemon);
  return p;
}

// ------------------------------------------------------------------ the restaurant on the rocks

function scoglio(c: FC): Prop {
  const p = new Prop(28, 11, 28, S);
  // spaghetti allo scoglio: clams, mussels, prawns and squid on tomato-red pasta, on a wide plate
  maiolica(p, c, 14, 14, 13.5);
  heap(p, 14, 14, 9.5, 1, 3, (x, y, z) => ((x * 2 + z + y) % 3 === 0 ? c.tomato : (x + z) % 2 ? c.spaghetti : c.spaghettiHi));
  for (const [x, z] of [[9, 10], [17, 9], [12, 18], [19, 16]]) p.box(x, 4, z, x + 1, 5, z + 1, (xx, y) => (y === 5 ? c.clam : xx === x ? c.clamDark : c.musselIn));
  for (const [x, z] of [[14, 11], [8, 15]]) p.box(x, 4, z, x + 2, 4, z + 1, (xx) => (xx === x + 1 ? c.musselIn : c.mussel));
  for (const [x, z] of [[11, 13], [16, 14]]) { p.box(x, 5, z, x + 3, 5, z, c.shrimp); p.set(x + 3, 6, z, c.shrimpStripe); p.set(x, 6, z, c.tail); }
  for (const [x, z] of [[18, 12], [10, 8]]) { p.cylY(x, z, 1.4, 5, 5, c.squid); p.cylY(x, z, 0.6, 5, 5, 0); }
  scatter(p, 14, 14, 8, 10, c.parsley, 9971);
  return p;
}

function calamari(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // a squid stuffed with bread, cheese and capers, sliced, in tomato sauce
  maiolica(p, c, 13, 13, 12.5);
  p.cylY(13, 13, 9.5, 1, 1, (x, _y, z) => ((x + z) % 5 ? c.tomato : c.tomatoHi));
  p.ellipsoid(13, 3.5, 13, 8, 2.6, 3.2, (x) => (x % 4 === 0 ? c.breadIn : c.squid));
  for (let x = 7; x <= 19; x += 4) p.box(x, 2, 11, x, 6, 15, 0);
  for (let x = 8; x <= 18; x += 4) p.box(x, 3, 12, x, 4, 14, (_x, y, z) => (y === 4 && z === 13 ? c.olive : c.breadIn));
  p.box(21, 2, 11, 23, 3, 15, (_x, y, z) => (y === 3 && z % 2 ? c.squid : c.octopusLight));
  scatter(p, 13, 13, 8, 9, c.parsley, 1120);
  return p;
}

// ------------------------------------------------------------------ home cooking at Titina's

function pastapatate(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // pasta e patate with provola melted in until it strings, in a deep plate
  bowl(p, (x, y, z) => ((x + z) % 5 === 0 && y > 2 ? c.ceramicYellow : c.ceramicWhite), 13, 13, 11, 5);
  p.cylY(13, 13, 8.8, 4, 4, (x, _y, z) => ((x + z) % 3 ? c.potatoHi : c.provola));
  scatter(p, 13, 13, 8, 14, () => c.potato, 2231);
  scatter(p, 13, 13, 8, 16, () => c.pastaEdge, 2232);
  for (let k = 0; k < 4; k++) p.box(8 + k * 3, 5, 12 + (k % 2), 10 + k * 3, 5, 12 + (k % 2), c.mozzarella);
  scatter(p, 13, 13, 6, 6, c.pepperBlack, 2233);
  p.box(16, 6, 9, 17, 6, 10, c.basil);
  return p;
}

function frittatapasta(c: FC): Prop {
  const p = new Prop(26, 8, 26, S);
  // yesterday's spaghetti fried into a thick golden cake, cut in a wedge to show the strands
  maiolica(p, c, 13, 13, 12.5);
  p.cylY(13, 13, 9, 1, 4, (x, y, z) => (y === 4 || dist(x, z, 13, 13) > 8.2 ? ((x + z) % 3 ? c.crust : c.crumbDark) : (x * 3 + y + z) % 4 ? c.spaghetti : c.tomato));
  for (let y = 1; y <= 4; y++) for (let x = 13; x <= 23; x++) for (let z = 13; z <= 23; z++) if (z - 13 <= (x - 13) * 0.8) p.set(x, y, z, 0);
  for (let y = 1; y <= 4; y++) for (let x = 13; x <= 22; x++) { const z = 13 + Math.floor((x - 13) * 0.8); if (dist(x, z, 13, 13) < 9) p.set(x, y, z, (x + y) % 2 ? c.spaghettiHi : c.provola); }
  scatter(p, 11, 11, 6, 6, c.basil, 3341);
  return p;
}

// ------------------------------------------------------------------ the dairy

function bufala(c: FC): Prop {
  const p = new Prop(26, 12, 26, S);
  // a whole buffalo mozzarella, torn open so the milk runs, with cherry tomatoes and basil
  maiolica(p, c, 13, 13, 12.5);
  p.cylY(13, 13, 8, 1, 1, c.cream);
  p.ellipsoid(12, 5, 12, 6, 4.4, 6, (x, y, z) => ((x + y * 2 + z) % 9 === 0 ? c.ricotta : c.mozzarella));
  p.box(12, 5, 12, 18, 10, 18, 0);
  p.cylY(12, 12, 3, 5, 5, (x, _y, z) => (dist(x, z, 12, 12) < 3 ? c.cream : 0));
  for (const [x, z] of [[19, 9], [20, 13], [18, 17], [8, 19]]) p.ellipsoid(x, 2.5, z, 1.6, 1.4, 1.6, (xx, y) => (y >= 3 && xx === x ? c.tomatoHi : c.tomato));
  for (const [x, z] of [[17, 18], [7, 8], [16, 6]]) p.box(x, 2, z, x + 1, 2, z + 1, c.basil);
  for (let a = 0; a < 10; a++) p.set(Math.round(20 - a), 2, Math.round(20 - a * 0.3), c.oil);
  return p;
}

function provola(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // smoked provola melted in a small terracotta dish, a lemon leaf underneath, bread to scoop
  p.cylY(11, 11, 9, 0, 0, c.terracottaDark);
  p.cylY(11, 11, 9, 1, 3, (x, _y, z) => (dist(x, z, 11, 11) > 8 ? c.terracotta : 0));
  p.cylY(11, 11, 8, 1, 2, (x, _y, z) => ((x + z) % 4 === 0 ? c.cheeseBrown : c.provola));
  p.cylY(11, 11, 7.5, 3, 3, (x, _y, z) => ((x * 3 + z) % 5 < 2 ? c.cheeseBrown : (x + z) % 7 === 0 ? c.crumbDark : c.provola));
  p.box(9, 1, 9, 13, 1, 13, c.leaf);
  for (const [x, z] of [[19, 19], [22, 16]]) p.box(x, 0, z, x + 3, 2, z + 3, (_x, y) => (y === 2 ? c.crust : c.breadIn));
  return p;
}

export function buildAmalfiFood(id: AmalfiFood, c: FC): Prop | null {
  switch (id) {
    case 'tagliere': return tagliere(c);
    case 'panino': return panino(c);
    case 'paranza': return paranza(c);
    case 'impepata': return impepata(c);
    case 'genovese': return genovese(c);
    case 'pastafagioli': return pastafagioli(c);
    case 'graffa': return graffa(c);
    case 'struffoli': return struffoli(c);
    case 'sorbetto': return sorbetto(c);
    case 'spremuta': return spremuta(c);
    case 'scoglio': return scoglio(c);
    case 'calamari': return calamari(c);
    case 'pastapatate': return pastapatate(c);
    case 'frittatapasta': return frittatapasta(c);
    case 'bufala': return bufala(c);
    case 'provola': return provola(c);
  }
  return null;
}
