import { rng } from './grid';
import { Prop } from './props';
import type { foodColors } from './food';

/** Funchal's second menu as voxel models (40 voxels to the metre, like every dish). */
type FC = ReturnType<typeof foodColors>;
const S = 1 / 40;

export type MadeiraMoreFood =
  | 'acorda' | 'cuscuz' | 'bacalhau' | 'pastelbacalhau' | 'arroz' | 'caramujos'
  | 'sonhos' | 'funcho' | 'sopacastanha' | 'licorcastanha' | 'galao' | 'boloarroz';

const dist = (x: number, z: number, cx: number, cz: number) => Math.hypot(x + 0.5 - cx, z + 0.5 - cz);

/** The island's everyday plate: white with a blue rim, like a plain azulejo. */
function plate(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (dist(x, z, cx, cz) > r - 1.2 ? ((x + z) % 4 ? c.ceramicBlue : c.ceramicWhite) : 0));
}

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
    if (y < p.sy) p.set(x, y, z, typeof col === 'function' ? col() : col);
  }
}

/** A clay pot (púcaro) of soup. */
function pucaro(p: Prop, c: FC, cx: number, cz: number, r: number, h: number, soup: (x: number, z: number) => number): void {
  bowl(p, (x, y, z) => ((x + y + z) % 5 === 0 ? c.terracottaDark : c.terracotta), cx, cz, r, h);
  p.cylY(cx, cz, r - 1.6, h - 1, h - 1, (x, _y, z) => soup(x, z));
}

// ------------------------------------------------------------------ the casa de pasto

function acorda(c: FC): Prop {
  const p = new Prop(26, 11, 26, S);
  // bread soup with garlic and coriander, a poached egg floating on top
  pucaro(p, c, 13, 13, 11, 5, (x, z) => ((x + z) % 3 ? c.broth2 : c.breadIn));
  scatter(p, 13, 13, 8, 14, () => c.bread, 1301);
  p.ellipsoid(13, 5, 13, 3.4, 1.4, 3.2, c.eggWhite);
  p.ellipsoid(13, 6, 13, 1.5, 1, 1.5, c.yolk);
  scatter(p, 13, 13, 8, 16, c.parsley, 1302);
  scatter(p, 13, 13, 7, 5, c.garlicW, 1303);
  return p;
}

function cuscuz(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  // Madeira's own steamed wheat couscous, crumbly and yellow, beside a piece of stewed pork
  plate(p, c, 13, 13, 12.5);
  for (let y = 1; y <= 4; y++) p.cylY(10, 13, 7 - (y - 1) * 1.4, y, y, (x, yy, z) => ((x + yy + z) % 3 ? c.wheat : c.corn));
  p.ellipsoid(18.5, 3, 15, 3, 2, 3, (x, y) => ((x + y) % 3 ? c.porkWine : c.meatDark));
  p.cylY(18.5, 15, 3.5, 1, 1, c.stewSauce);
  scatter(p, 10, 13, 5, 6, c.parsley, 1404);
  return p;
}

// ------------------------------------------------------------------ the bacalhoeiro

function bacalhau(c: FC): Prop {
  const p = new Prop(28, 10, 28, S);
  // salt cod à Gomes de Sá: flakes of cod, sliced potato, onion, boiled egg and black olives
  plate(p, c, 14, 14, 13.5);
  p.cylY(14, 14, 10, 1, 1, (x, _y, z) => ((x + z) % 3 ? c.potatoHi : c.potato));
  for (let k = 0; k < 12; k++) {
    const x = 7 + (k * 5) % 14, z = 7 + (k * 7) % 14;
    if (dist(x, z, 14, 14) < 9) p.box(x, 2, z, x + 2, 3, z + 1, (xx, y) => (y === 3 && xx === x + 1 ? c.fishSkin2 : c.calamari));
  }
  for (const [x, z] of [[10, 18], [18, 10]]) { p.box(x, 3, z, x + 2, 3, z + 2, c.eggWhite); p.set(x + 1, 4, z + 1, c.yolk); }
  scatter(p, 14, 14, 9, 8, c.olive, 1505);
  scatter(p, 14, 14, 9, 10, c.onion, 1506);
  scatter(p, 14, 14, 8, 10, c.parsley, 1507);
  for (let a = 0; a < 12; a++) p.set(Math.round(14 + Math.cos(a) * 9), 2, Math.round(14 + Math.sin(a) * 9), c.oil);
  return p;
}

function pastelbacalhau(c: FC): Prop {
  const p = new Prop(24, 8, 20, S);
  // three cod fritters shaped between two spoons, fried crisp, on a paper napkin
  p.box(1, 0, 1, 22, 0, 18, c.paper);
  for (const [x, z] of [[6, 6], [14, 7], [10, 13]]) {
    p.ellipsoid(x, 3, z, 4, 2.4, 2.6, (xx, y, zz) => ((xx + y + zz) % 4 === 0 ? c.fryDark : (xx + zz) % 3 ? c.fry : c.batterLight));
  }
  p.box(17, 1, 13, 20, 2, 15, (_x, y) => (y === 2 ? c.lemon : c.lemonPeel));
  return p;
}

// ------------------------------------------------------------------ the marisqueira

function arroz(c: FC): Prop {
  const p = new Prop(26, 12, 26, S);
  // seafood rice, wet and red with tomato, prawns, clams and mussels, in a clay pot
  pucaro(p, c, 13, 13, 11, 5, (x, z) => ((x * 2 + z) % 3 ? c.ketchupRice : c.rice));
  scatter(p, 13, 13, 8, 18, () => c.rice, 1608);
  for (const [x, z] of [[9, 10], [16, 9]]) { p.box(x, 5, z, x + 3, 5, z, c.shrimp); p.set(x + 3, 6, z, c.shrimpStripe); p.set(x, 6, z, c.tail); }
  for (const [x, z] of [[11, 16], [17, 15], [8, 13]]) p.box(x, 5, z, x + 1, 6, z + 1, (xx, y) => (y === 6 ? c.clam : xx === x ? c.clamDark : c.musselIn));
  for (const [x, z] of [[14, 13], [13, 17]]) p.box(x, 5, z, x + 2, 5, z + 1, (xx) => (xx === x + 1 ? c.musselIn : c.mussel));
  scatter(p, 13, 13, 7, 12, c.parsley, 1609);
  return p;
}

function caramujos(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  // sea snails from the rocks, boiled with garlic and bay, a pin to pick them out
  bowl(p, c.ceramicWhite, 12, 12, 10.5, 3);
  const rr = rng(1710);
  for (let k = 0; k < 14; k++) {
    const a = rr() * Math.PI * 2, d = Math.sqrt(rr()) * 6.5, x = 12 + Math.cos(a) * d, z = 12 + Math.sin(a) * d, y = 2 + (k % 3) * 1.2;
    p.ellipsoid(x, y + 0.6, z, 1.5, 1.3, 1.5, (xx, yy, zz) => ((xx + yy + zz) % 2 ? c.limpet : c.chocolateDark));
    p.set(Math.round(x), Math.round(y + 2), Math.round(z), c.limpetIn);
  }
  scatter(p, 12, 12, 6, 4, c.laurel, 1711);
  p.box(18, 4, 4, 22, 4, 4, c.steelLight); p.set(22, 5, 4, c.cherry);
  return p;
}

// ------------------------------------------------------------------ the confeitaria

function sonhos(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  // "dreams": airy fritters rolled in cinnamon sugar, a jug of cane honey beside them
  plate(p, c, 12, 12, 11.5);
  for (const [x, z, y] of [[8, 8, 2], [15, 9, 2], [9, 15, 2], [15, 15, 2], [12, 12, 4.5]]) {
    p.ellipsoid(x, y + 1, z, 3.2, 2.6, 3.2, (xx, yy, zz) => ((xx * 3 + yy + zz) % 4 === 0 ? c.cinnamon : (xx + zz) % 3 ? c.pastry : c.sugar));
  }
  scatter(p, 12, 12, 8, 18, c.sugar, 1812);
  p.cylY(20, 20, 2, 1, 5, (_x, y) => (y === 5 ? c.honeyTop : c.ceramicWhite));
  p.cylY(20, 20, 1.2, 5, 5, c.honeyCake);
  return p;
}

function funcho(c: FC): Prop {
  const p = new Prop(20, 8, 20, S);
  // fennel candies: hard sugar sticks, pale green and white, in a twist of paper, as at the island's fairs
  p.box(2, 0, 2, 17, 0, 17, c.paper);
  p.box(2, 1, 2, 17, 1, 2, c.paperRed); p.box(2, 1, 17, 17, 1, 17, c.paperRed);
  const cols = [c.kantenB, c.matchaFoam, c.sugar, c.cabbage];
  for (let k = 0; k < 9; k++) {
    const z = 4 + (k % 5) * 2.6, y = 1 + Math.floor(k / 5) * 2, x0 = 4 + (k % 3);
    p.box(x0, y, Math.round(z), x0 + 9, y + 1, Math.round(z) + 1, (x, yy) => ((x + yy) % 3 === 0 ? c.sugar : cols[k % cols.length]));
  }
  return p;
}

// ------------------------------------------------------------------ the chestnut house, up at Curral

function sopacastanha(c: FC): Prop {
  const p = new Prop(26, 11, 26, S);
  // chestnut soup with beans and a little pork, thick and brown, from the Curral das Freiras valley
  pucaro(p, c, 13, 13, 11, 5, (x, z) => ((x + z) % 4 ? c.chestnut : c.walnut));
  scatter(p, 13, 13, 8, 14, () => c.chestnutIn, 1913);
  scatter(p, 13, 13, 8, 8, () => c.bean, 1914);
  scatter(p, 13, 13, 8, 6, () => c.porkWine, 1915);
  scatter(p, 13, 13, 7, 8, c.parsley, 1916);
  return p;
}

function licorcastanha(c: FC): Prop {
  const p = new Prop(16, 16, 16, S);
  // a small glass of chestnut liqueur and two roasted chestnuts on a saucer
  p.cylY(8, 8, 7, 0, 0, c.ceramicWhite);
  p.cylY(7, 7, 2.8, 1, 1, c.ice);
  for (let y = 2; y <= 9; y++) p.cylY(7, 7, 2.6 + (y - 2) * 0.12, y, y, (x, yy, z) => (dist(x, z, 7, 7) > 2.1 + (yy - 2) * 0.12 ? c.ice : yy <= 8 ? c.walnut : 0));
  for (const [x, z] of [[12, 11], [11, 4]]) p.ellipsoid(x, 2, z, 1.8, 1.4, 1.8, (_x, y) => (y >= 2 ? c.chestnut : c.chestnutIn));
  return p;
}

// ------------------------------------------------------------------ the café

function galao(c: FC): Prop {
  const p = new Prop(14, 20, 14, S);
  // a tall glass of milky coffee with a long spoon, the way Funchal drinks it all day
  // the glass shows its layers: coffee-dark milk below, a cap of foam, clear rim above
  for (let y = 0; y <= 13; y++) p.cylY(7, 7, 4, y, y, (x, yy, z) => (yy === 0 ? c.ice : dist(x, z, 7, 7) > 3.3 && yy > 11 ? c.ice : yy <= 8 ? ((x + yy + z) % 5 ? c.milkCoffee : c.cream) : yy <= 11 ? c.cream : 0));
  p.box(9, 9, 7, 9, 17, 7, c.steelLight);
  return p;
}

function boloarroz(c: FC): Prop {
  const p = new Prop(16, 18, 16, S);
  // the rice-flour muffin, tall and golden, sugar-crusted on top, in its paper band
  p.cylY(8, 8, 5.4, 0, 7, (x, _y, z) => ((Math.atan2(z - 8, x - 8) * 6) % 2 > 1 ? c.paper : c.wineLabel));
  for (let y = 8; y <= 13; y++) p.cylY(8, 8, 6.2 - Math.max(0, y - 10) * 1.2, y, y, (x, yy, z) => (yy >= 12 && (x + z) % 2 ? c.sugar : (x + yy + z) % 4 ? c.pastryLight : c.pastry));
  return p;
}

export function buildMadeiraMoreFood(id: MadeiraMoreFood, c: FC): Prop | null {
  switch (id) {
    case 'acorda': return acorda(c);
    case 'cuscuz': return cuscuz(c);
    case 'bacalhau': return bacalhau(c);
    case 'pastelbacalhau': return pastelbacalhau(c);
    case 'arroz': return arroz(c);
    case 'caramujos': return caramujos(c);
    case 'sonhos': return sonhos(c);
    case 'funcho': return funcho(c);
    case 'sopacastanha': return sopacastanha(c);
    case 'licorcastanha': return licorcastanha(c);
    case 'galao': return galao(c);
    case 'boloarroz': return boloarroz(c);
  }
  return null;
}
