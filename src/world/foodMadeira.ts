import { rng } from './grid';
import { Prop } from './props';
import type { foodColors } from './food';

/** Funchal's dishes as voxel models (40 voxels to the metre, like every dish). */
type FC = ReturnType<typeof foodColors>;
const S = 1 / 40;

export type MadeiraFood =
  | 'bolocaco' | 'prego' | 'poncha' | 'nikita' | 'maracuja' | 'anona' | 'malasada' | 'brisa'
  | 'espetada' | 'milhofrito' | 'espada' | 'lapas' | 'atum' | 'caldeirada' | 'sopatomate' | 'vinhalhos'
  | 'bolomel' | 'queijada' | 'madeira' | 'broas' | 'chinesa' | 'nata' | 'picado' | 'sopatrigo' | 'gaiado' | 'pudim'
  | 'tremocos' | 'coral' | 'frango' | 'batatadoce' | 'sardinhas' | 'polvo' | 'cha' | 'torta' | 'gelado' | 'batido' | 'cachorro' | 'laranjada';

export const MADEIRA_FOODS: readonly MadeiraFood[] = ['bolocaco', 'prego', 'poncha', 'nikita', 'maracuja', 'anona', 'malasada', 'brisa',
  'espetada', 'milhofrito', 'espada', 'lapas', 'atum', 'caldeirada', 'sopatomate', 'vinhalhos',
  'bolomel', 'queijada', 'madeira', 'broas', 'chinesa', 'nata', 'picado', 'sopatrigo', 'gaiado', 'pudim',
  'tremocos', 'coral', 'frango', 'batatadoce', 'sardinhas', 'polvo', 'cha', 'torta', 'gelado', 'batido', 'cachorro', 'laranjada'];

/** A white plate with the island's blue rim. */
function plate(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1.2 ? ((x + z) % 4 ? c.ceramicBlue : c.ceramicWhite) : 0));
}

/** A deep bowl, `r` across at the top. */
function bowl(p: Prop, col: number, cx: number, cz: number, r: number, h: number): void {
  for (let y = 0; y <= h; y++) p.cylY(cx, cz, r - (h - y) * 0.6, y, y, col);
  p.cylY(cx, cz, r - 1, 1, h, 0);
}

/** The round flatbread: domed, speckled where the stone touched it. */
function caco(p: Prop, c: FC, cx: number, cz: number, r: number, y0: number, split = false): void {
  for (let y = 0; y < 4; y++) p.cylY(cx, cz, r - (y === 3 ? 1.5 : y === 0 ? 0.6 : 0), y0 + y, y0 + y, (x, yy, z) => {
    if (split && yy === y0 + 2) return Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1 ? c.breadCrust : c.leaf;
    const n = (x * 7 + z * 13 + yy * 3) % 11;
    return yy === y0 || yy === y0 + 3 ? (n < 2 ? c.char : c.breadCrust) : c.breadIn;
  });
}

function bolocaco(c: FC): Prop {
  const p = new Prop(24, 8, 24, S);
  p.box(1, 0, 1, 22, 0, 22, c.board);
  caco(p, c, 12, 12, 9.5, 1);
  // cut in wedges, garlic butter and parsley running in the cuts
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI;
    for (let d = -9; d <= 9; d++) { const x = Math.round(12 + Math.cos(a) * d), z = Math.round(12 + Math.sin(a) * d); p.set(x, 4, z, c.cheese); p.set(x, 3, z, c.oil); }
  }
  const r = rng(91);
  for (let k = 0; k < 14; k++) p.set(5 + Math.floor(r() * 14), 5, 5 + Math.floor(r() * 14), k % 2 ? c.parsley : c.onion);
  return p;
}

function prego(c: FC): Prop {
  const p = new Prop(24, 12, 22, S);
  p.box(1, 0, 1, 22, 0, 20, c.paper);
  caco(p, c, 12, 11, 9, 1);
  // the steak, lettuce and tomato showing between the halves
  p.cylY(12, 11, 9.4, 3, 3, (x, _y, z) => ((x + z) % 5 === 0 ? c.meatDark : c.meat));
  p.cylY(12, 11, 9.8, 4, 4, (x, _y, z) => ((x * 3 + z) % 4 === 0 ? c.tomato : c.lettuce));
  caco(p, c, 12, 11, 9, 5);
  p.box(18, 9, 4, 19, 9, 5, c.mustard);
  return p;
}

function poncha(c: FC): Prop {
  const p = new Prop(22, 18, 16, S);
  p.box(0, 0, 0, 21, 0, 15, c.board);
  // a short tumbler of cloudy gold, the caralhinho leaning in the jug, peanuts in their shells
  p.cylY(6, 8, 3.2, 1, 9, c.glass); p.cylY(6, 8, 2.5, 2, 8, c.poncha); p.cylY(6, 8, 2.5, 9, 9, 0);
  p.set(5, 9, 7, c.lemonPeel);
  p.cylY(15, 6, 3.6, 1, 11, c.glass); p.cylY(15, 6, 2.8, 2, 7, c.poncha); p.cylY(15, 6, 2.8, 8, 11, 0);
  p.box(15, 6, 6, 15, 17, 6, c.board); p.cylY(15, 6, 1.6, 2, 3, c.boardDark);
  for (const [x, z] of [[11, 12], [13, 13], [16, 12], [18, 13], [10, 14]]) { p.box(x, 1, z, x + 1, 1, z, c.peanut); p.set(x, 2, z, c.peanutDark); }
  return p;
}

function nikita(c: FC): Prop {
  const p = new Prop(14, 26, 14, S);
  // a tall glass, pineapple-pale froth, a scoop of vanilla on top, a long spoon and a straw
  for (let y = 0; y < 20; y++) p.cylY(7, 7, y < 2 ? 3 : 3.4 + y * 0.08, y, y, c.glass);
  p.cylY(7, 7, 3, 1, 18, (_x, y) => (y > 14 ? c.cream : y % 4 === 0 ? c.pineapple : c.nikita));
  p.ellipsoid(7, 20, 7, 3.8, 2.6, 3.8, c.cream);
  p.box(9, 14, 6, 9, 25, 6, c.steelLight); p.box(5, 16, 8, 5, 25, 8, c.chili);
  p.box(10, 19, 4, 12, 22, 4, c.pineapple); p.set(11, 23, 4, c.leaf);
  return p;
}

function maracuja(c: FC): Prop {
  const p = new Prop(24, 10, 22, S);
  p.box(1, 0, 1, 22, 0, 20, c.paper);
  // purple passion fruit halved (yellow pulp, black seeds), a long yellow banana passion fruit, a red tomato one
  for (const [cx, cz] of [[7, 7], [15, 7]]) {
    p.ellipsoid(cx, 2, cz, 3.6, 3, 3.6, (x, y, z) => (y >= 4 ? ((x + z) % 3 === 0 ? c.seed : c.passion) : c.passionSkin));
    p.cylY(cx, cz, 2.6, 4, 4, (x, _y, z) => ((x * 3 + z * 5) % 4 === 0 ? c.seed : c.passion));
    p.cylY(cx, cz, 2.6, 5, 7, 0);
  }
  p.ellipsoid(10, 2.5, 15, 7, 2.4, 2.4, (x) => (x % 4 === 0 ? c.lemonPeel : c.lemon));
  p.ellipsoid(19, 3, 15, 2.6, 3, 2.6, c.tomato);
  p.set(19, 6, 15, c.leaf);
  return p;
}

function anona(c: FC): Prop {
  const p = new Prop(22, 14, 22, S);
  plate(p, c, 11, 11, 10.5);
  // the green scaly heart, cut open: creamy white flesh, big black seeds
  p.ellipsoid(8, 5, 11, 5, 5, 5, (x, y, z) => ((x + y + z) % 3 === 0 ? c.anonaDark : c.anona));
  p.ellipsoid(15, 3, 11, 4.2, 3, 4.2, c.anona);
  p.cylY(15, 11, 3.4, 5, 5, (x, _y, z) => ((x * 5 + z * 3) % 7 === 0 ? c.seed : c.cream));
  p.cylY(15, 11, 3.4, 6, 8, 0);
  p.box(8, 10, 11, 8, 11, 11, c.trunkLite);
  p.box(4, 2, 17, 9, 2, 17, c.steelLight);
  return p;
}

function malasada(c: FC): Prop {
  const p = new Prop(22, 10, 20, S);
  p.box(1, 0, 1, 20, 0, 18, c.paper);
  // three puffed balls of fried dough, rolled in sugar, cane honey running over them
  for (const [cx, cz] of [[7, 7], [15, 8], [11, 14]]) p.ellipsoid(cx, 4, cz, 4.2, 3.8, 4.2, (x, y, z) => ((x + y * 2 + z) % 5 === 0 ? c.sugar : y > 5 ? c.fry : c.fryDark));
  for (let x = 6; x <= 16; x++) { const z = 8 + Math.round(Math.sin(x * 0.7) * 2); let y = 9; while (y > 1 && !p.get(x, y - 1, z)) y--; p.set(x, y, z, c.syrup); }
  return p;
}

function brisa(c: FC): Prop {
  const p = new Prop(16, 22, 14, S);
  // the little glass bottle with its orange label, a glass of fizzy gold beside it
  p.cylY(5, 7, 2.6, 0, 11, (_x, y) => (y >= 3 && y <= 7 ? (y === 5 ? c.ceramicWhite : c.brisaLabel) : c.glass));
  p.cylY(5, 7, 1.4, 12, 16, c.glass); p.cylY(5, 7, 1.6, 17, 17, c.brisaLabel);
  p.cylY(5, 7, 1.8, 1, 2, c.passion);
  p.cylY(11, 7, 2.8, 0, 9, c.glass); p.cylY(11, 7, 2.1, 1, 7, c.passion); p.cylY(11, 7, 2.1, 8, 9, 0);
  p.set(10, 7, 6, c.ceramicWhite); p.set(12, 5, 8, c.ceramicWhite);
  return p;
}

function espetada(c: FC): Prop {
  const p = new Prop(28, 30, 16, S);
  // the iron stand with the laurel skewer hung from its hook, the beef chunks along it, the plate under to catch the juice
  plate(p, c, 14, 8, 7.5);
  p.box(2, 0, 7, 3, 0, 9, c.steel); p.box(2, 1, 8, 2, 28, 8, c.steel); p.box(2, 28, 8, 9, 28, 8, c.steel);
  p.box(9, 27, 8, 9, 27, 8, c.steel);
  p.box(14, 4, 8, 14, 26, 8, c.laurel); // the skewer hangs straight down, the laurel bark showing
  for (let y = 6; y <= 22; y += 4) p.ellipsoid(14, y + 1, 8, 2.6, 1.8, 2.6, (x, yy, z) => ((x + yy + z) % 4 === 0 ? c.char : yy % 2 ? c.meatDark : c.meat));
  p.box(12, 25, 7, 16, 25, 9, c.leaf); p.set(17, 24, 8, c.leaf);
  p.cylY(14, 8, 4, 1, 1, c.ragu);
  return p;
}

function milhofrito(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  // a little wicker basket of golden cornmeal cubes, flecks of kale in them
  p.box(2, 0, 2, 19, 3, 19, (x, y, z) => ((x + y + z) % 2 ? c.zaru : c.zaruDark));
  p.box(3, 1, 3, 18, 3, 18, 0);
  const r = rng(92);
  for (let k = 0; k < 16; k++) {
    const x = 4 + Math.floor(r() * 12), z = 4 + Math.floor(r() * 12), y = 1 + Math.floor(r() * 3);
    p.box(x, y, z, x + 2, y + 2, z + 2, (xx, yy, zz) => ((xx * 3 + yy + zz * 5) % 7 === 0 ? c.friarielli : (yy === y + 2 ? c.cornDark : c.corn)));
  }
  return p;
}

function espada(c: FC): Prop {
  const p = new Prop(28, 9, 22, S);
  plate(p, c, 14, 11, 10.5);
  // two golden fillets of scabbardfish, a fried banana, a spoon of passion fruit sauce
  for (const z of [7, 12]) p.box(5, 2, z, 19, 3, z + 3, (x, y) => (y === 3 ? (x % 3 === 0 ? c.fryDark : c.fry) : c.fishSkin2));
  p.ellipsoid(14, 2.5, 17, 6, 1.4, 1.6, (x) => (x % 3 === 0 ? c.cornDark : c.banana));
  p.cylY(21, 9, 2.4, 2, 2, (x, _y, z) => ((x + z) % 3 === 0 ? c.seed : c.passion));
  p.box(7, 4, 9, 8, 4, 10, c.lemon); p.set(16, 4, 8, c.parsley);
  return p;
}

function lapas(c: FC): Prop {
  const p = new Prop(26, 10, 22, S);
  // the black iron pan with its handle, limpets sizzling in garlic butter, half a lemon
  p.cylY(12, 11, 9.5, 0, 2, c.steel); p.cylY(12, 11, 8.5, 1, 2, c.cheese);
  p.box(21, 2, 10, 25, 2, 12, c.steel);
  const r = rng(93);
  for (let k = 0; k < 13; k++) {
    const a = r() * Math.PI * 2, d = r() * 6.5;
    const x = 12 + Math.cos(a) * d, z = 11 + Math.sin(a) * d;
    p.cylY(x, z, 1.9, 2, 2, c.limpet); p.cylY(x, z, 1.2, 3, 3, c.limpetIn); p.set(Math.round(x), 4, Math.round(z), c.limpet);
  }
  p.ellipsoid(6, 3.5, 6, 2.2, 1.4, 2.2, c.lemon);
  for (let k = 0; k < 10; k++) p.set(5 + Math.floor(r() * 14), 3, 4 + Math.floor(r() * 14), c.parsley);
  return p;
}

function atum(c: FC): Prop {
  const p = new Prop(26, 10, 24, S);
  plate(p, c, 13, 12, 11);
  // a thick seared tuna steak under soft onions, cubes of milho frito alongside
  p.box(5, 2, 7, 15, 5, 16, (x, y, z) => (y === 5 || x === 5 || x === 15 || z === 7 || z === 16 ? ((x + z) % 3 ? c.tunaSear : c.char) : c.tunaPink));
  for (let x = 6; x <= 14; x++) for (const z of [9, 12, 14]) if ((x + z) % 2) p.set(x, 6, z, c.onion);
  for (const [x, z] of [[17, 7], [19, 11], [17, 15]]) p.box(x, 2, z, x + 2, 4, z + 2, c.corn);
  p.set(10, 6, 11, c.parsley); p.box(19, 2, 17, 20, 3, 18, c.lemon);
  return p;
}

function caldeirada(c: FC): Prop {
  const p = new Prop(26, 14, 26, S);
  // a clay pot of stew: fish, potatoes, peppers, tomato broth
  bowl(p, c.terracotta, 13, 13, 11.5, 8);
  p.box(1, 6, 12, 2, 7, 14, c.terracottaDark); p.box(24, 6, 12, 25, 7, 14, c.terracottaDark);
  p.cylY(13, 13, 10, 1, 6, c.stewSauce);
  const r = rng(94);
  for (let k = 0; k < 14; k++) {
    const a = r() * Math.PI * 2, d = r() * 7, x = 13 + Math.cos(a) * d, z = 13 + Math.sin(a) * d;
    if (k % 3 === 0) p.ellipsoid(x, 6.5, z, 1.6, 1.2, 1.6, c.potato);
    else if (k % 3 === 1) p.box(Math.round(x) - 1, 6, Math.round(z), Math.round(x) + 2, 7, Math.round(z) + 1, c.fishSkin2);
    else p.box(Math.round(x), 7, Math.round(z), Math.round(x) + 1, 7, Math.round(z), r() < 0.5 ? c.pepper : c.chili);
  }
  for (let k = 0; k < 10; k++) p.set(7 + Math.floor(r() * 12), 8, 7 + Math.floor(r() * 12), c.parsley);
  return p;
}

function sopatomate(c: FC): Prop {
  const p = new Prop(24, 12, 24, S);
  // a deep bowl of tomato and onion soup, a poached egg on top, bread beside
  bowl(p, c.ceramicWhite, 11, 12, 9.5, 7);
  p.cylY(11, 12, 8, 1, 6, (x, _y, z) => ((x + z) % 5 === 0 ? c.onion : (x * 3 + z) % 7 === 0 ? c.tomatoHi : c.tomato));
  p.ellipsoid(11, 7, 12, 3.2, 1, 3.2, c.eggWhite); p.ellipsoid(11, 7.6, 12, 1.4, 0.8, 1.4, c.yolk);
  p.box(9, 7, 7, 9, 7, 7, c.leaf);
  p.box(20, 0, 4, 23, 3, 10, (_x, y) => (y === 3 ? c.breadCrust : c.loaf));
  return p;
}

function vinhalhos(c: FC): Prop {
  const p = new Prop(26, 9, 24, S);
  plate(p, c, 13, 12, 11);
  // chunks of wine-red fried pork, slices of orange, fried bread
  const r = rng(95);
  for (let k = 0; k < 9; k++) { const x = 6 + Math.floor(r() * 10), z = 7 + Math.floor(r() * 8); p.box(x, 2, z, x + 2, 3 + (k % 2), z + 2, (xx, y) => ((xx + y) % 3 === 0 ? c.char : c.porkWine)); }
  for (const [x, z] of [[19, 7], [19, 12]]) { p.cylY(x, z, 2.5, 2, 2, c.orange); p.cylY(x, z, 1.6, 2, 2, c.orangeIn); }
  p.box(17, 2, 15, 21, 3, 18, (_x, y) => (y === 3 ? c.fry : c.loaf));
  for (let k = 0; k < 6; k++) p.set(6 + Math.floor(r() * 12), 5, 6 + Math.floor(r() * 10), c.garlicW);
  p.box(7, 4, 15, 8, 4, 15, c.leaf);
  return p;
}

function bolomel(c: FC): Prop {
  const p = new Prop(24, 10, 22, S);
  plate(p, c, 12, 11, 10.5);
  // a broken wedge of the dark honey cake, almonds and walnuts studding the top
  for (let x = 4; x <= 18; x++) for (let z = 5; z <= 16; z++) {
    if (Math.abs(z - 10.5) > (x - 3) * 0.45 + 0.5) continue;
    const ragged = x === 18 ? (z % 2) : 0;
    for (let y = 2; y <= 6 - ragged; y++) p.set(x, y, z, y === 6 - ragged ? c.honeyTop : (x + y + z) % 6 === 0 ? c.candied : c.honeyCake);
  }
  for (const [x, z] of [[9, 10], [12, 9], [14, 12], [16, 10], [11, 12]]) p.set(x, 7, z, x % 2 ? c.almond : c.walnut);
  return p;
}

function queijada(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  // two star-shaped cheese tarts, the tops cracked golden
  for (const [cx, cz] of [[7, 8], [15, 13]]) {
    for (let z = cz - 6; z <= cz + 6; z++) for (let x = cx - 6; x <= cx + 6; x++) {
      const a = Math.atan2(z - cz, x - cx), d = Math.hypot(x - cx, z - cz);
      const star = 4.2 + 1.6 * Math.abs(Math.cos(a * 2.5));
      if (d > star) continue;
      for (let y = 1; y <= 3; y++) p.set(x, y, z, d > star - 1.2 ? c.shortcrust : y === 3 ? ((x + z) % 4 === 0 ? c.crustHi : c.pastieraTop) : c.ricotta);
    }
  }
  return p;
}

function madeiraWine(c: FC): Prop {
  const p = new Prop(20, 22, 14, S);
  p.box(0, 0, 0, 19, 0, 13, c.board);
  // a tulip glass of amber wine, and the dark bottle with its cream label
  p.cylY(6, 7, 1.6, 1, 1, c.glass); p.box(6, 2, 7, 6, 7, 7, c.glass);
  for (let y = 8; y <= 14; y++) p.cylY(6, 7, y < 11 ? 2 + (y - 8) * 0.6 : 3.8 - (y - 11) * 0.3, y, y, c.glass);
  for (let y = 9; y <= 12; y++) p.cylY(6, 7, y < 11 ? 1.6 + (y - 9) * 0.6 : 2.8, y, y, c.wine);
  p.cylY(14, 7, 2.8, 1, 12, (_x, y) => (y >= 4 && y <= 8 ? (y === 6 ? c.wineLabelInk : c.wineLabel) : c.bottleDark));
  p.cylY(14, 7, 1.3, 13, 18, c.bottleDark); p.cylY(14, 7, 1.4, 19, 20, c.boardDark);
  return p;
}

function broas(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  plate(p, c, 11, 11, 10.5);
  // little round honey biscuits, cracked tops, one dipped in wine
  for (const [cx, cz] of [[7, 7], [14, 7], [7, 14], [14, 14], [11, 11]]) {
    p.cylY(cx, cz, 2.8, 2, 3, (x, y, z) => (y === 3 && (x + z) % 3 === 0 ? c.honeyTop : c.broa));
    p.set(cx, 4, cz, c.almond);
  }
  p.box(9, 2, 15, 12, 2, 15, c.wine);
  return p;
}

function chinesa(c: FC): Prop {
  const p = new Prop(18, 16, 16, S);
  // a tall glass of milky coffee on a saucer, a sugar packet, a little spoon
  p.cylY(8, 8, 5.4, 0, 0, c.plate);
  p.cylY(8, 8, 3, 1, 13, c.glass);
  p.cylY(8, 8, 2.3, 1, 11, (_x, y) => (y > 9 ? c.cream : y > 4 ? c.milkCoffee : c.coffeeDark));
  p.cylY(8, 8, 2.3, 12, 13, 0);
  p.box(12, 1, 3, 16, 1, 4, c.sugarPack); p.box(2, 1, 13, 9, 1, 13, c.steelLight);
  return p;
}

function nata(c: FC): Prop {
  const p = new Prop(22, 9, 20, S);
  p.box(1, 0, 1, 20, 0, 18, c.paper);
  // two custard tarts in fluted puff pastry, their tops blistered dark, cinnamon dusted
  for (const [cx, cz] of [[7, 8], [15, 11]]) {
    p.cylY(cx, cz, 4.6, 1, 4, (x, y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > 3.6 ? ((x + z + y) % 2 ? c.pastryLight : c.pastry) : c.custard));
    p.cylY(cx, cz, 3.6, 4, 4, (x, _y, z) => ((x * 5 + z * 3) % 6 === 0 ? c.char : (x + z) % 4 === 0 ? c.caramel : c.custard));
    p.set(cx, 5, cz, c.cinnamon);
  }
  return p;
}

function picado(c: FC): Prop {
  const p = new Prop(28, 12, 24, S);
  // an oval platter piled with chips and beef bites in garlic sauce, toothpicks stuck in
  for (let z = 1; z <= 22; z++) for (let x = 1; x <= 26; x++) if (((x - 13.5) / 12.5) ** 2 + ((z - 11.5) / 10.5) ** 2 <= 1) { p.set(x, 0, z, c.ceramicWhite); if (((x - 13.5) / 12.5) ** 2 + ((z - 11.5) / 10.5) ** 2 > 0.8) p.set(x, 1, z, c.ceramicWhite); }
  const r = rng(96);
  for (let k = 0; k < 26; k++) { const x = 5 + Math.floor(r() * 17), z = 5 + Math.floor(r() * 13); p.box(x, 1, z, x + 3, 1, z, c.potatoHi); }
  for (let k = 0; k < 14; k++) { const x = 6 + Math.floor(r() * 15), z = 6 + Math.floor(r() * 11); p.box(x, 2, z, x + 1, 3, z + 1, (xx, y) => ((xx + y) % 3 === 0 ? c.char : c.meat)); }
  for (let k = 0; k < 12; k++) p.set(6 + Math.floor(r() * 16), 4, 6 + Math.floor(r() * 12), k % 2 ? c.garlicW : c.parsley);
  for (const [x, z] of [[9, 9], [16, 12], [13, 15]]) p.box(x, 4, z, x, 8, z, c.pick);
  return p;
}

function sopatrigo(c: FC): Prop {
  const p = new Prop(24, 12, 24, S);
  // a deep bowl of wheat soup: grains, beans, pumpkin, kale, a piece of pork
  bowl(p, c.terracotta, 12, 12, 10, 7);
  p.cylY(12, 12, 8.5, 1, 6, (x, _y, z) => ((x * 3 + z * 7) % 5 === 0 ? c.wheat : c.broth2));
  const r = rng(97);
  for (let k = 0; k < 18; k++) {
    const a = r() * Math.PI * 2, d = r() * 6.5, x = Math.round(12 + Math.cos(a) * d), z = Math.round(12 + Math.sin(a) * d);
    p.set(x, 7, z, [c.wheat, c.bean, c.pumpkin, c.friarielli, c.potato][k % 5]);
    if (k % 5 === 2) p.set(x + 1, 7, z, c.pumpkin);
  }
  p.box(10, 7, 10, 12, 8, 11, c.meat);
  return p;
}

function gaiado(c: FC): Prop {
  const p = new Prop(26, 9, 22, S);
  plate(p, c, 13, 11, 10.5);
  // dark grilled strips of dried tuna with garlic and oil, boiled potatoes and onion rings
  for (const z of [6, 9, 12]) p.box(5, 2, z, 15, 3, z + 1, (x, y) => (y === 3 && x % 3 === 0 ? c.char : (x + z) % 4 === 0 ? c.tunaSear : c.gaiado));
  for (const [x, z] of [[18, 7], [19, 12], [16, 16]]) p.ellipsoid(x, 3, z, 2, 1.6, 2, c.potato);
  for (let x = 6; x <= 14; x += 2) p.set(x, 4, 8, c.garlicW);
  for (let x = 6; x <= 14; x++) p.set(x, 4, 14, (x % 3) ? 0 : c.onion);
  p.box(5, 2, 15, 12, 2, 16, c.oil);
  return p;
}

function pudim(c: FC): Prop {
  const p = new Prop(22, 12, 22, S);
  plate(p, c, 11, 11, 10.5);
  // a wedge of pale yellow passion fruit pudding, glazed on top with its seeds
  for (let x = 4; x <= 18; x++) for (let z = 5; z <= 16; z++) {
    if (Math.abs(z - 10.5) > (x - 3) * 0.42 + 0.5) continue;
    for (let y = 2; y <= 7; y++) p.set(x, y, z, y === 7 ? ((x * 3 + z * 5) % 4 === 0 ? c.seed : c.passion) : c.pudim);
  }
  p.set(17, 8, 10, c.mint); p.set(16, 8, 11, c.mint);
  return p;
}

function tremocos(c: FC): Prop {
  const p = new Prop(24, 7, 18, S);
  // a saucer of golden lupins glistening in brine, a second one for the skins, a sprig of parsley
  p.cylY(8, 9, 6.5, 0, 0, c.ceramicWhite); p.cylY(8, 9, 6.5, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - 8, z + 0.5 - 9) > 5.5 ? c.ceramicWhite : 0));
  const r = rng(311);
  for (let k = 0; k < 22; k++) { const a = r() * Math.PI * 2, d = r() * 4.6; const x = 8 + Math.cos(a) * d, z = 9 + Math.sin(a) * d; p.ellipsoid(x, 2, z, 1.3, 1, 1.1, (xx) => (xx % 3 === 0 ? c.cornDark : c.corn)); }
  p.set(7, 4, 8, c.parsley); p.set(9, 4, 10, c.garlicW);
  p.cylY(18.5, 9, 4, 0, 1, c.ceramicWhite);
  for (const [x, z] of [[17, 8], [19, 10], [18, 11], [20, 8]]) p.set(x, 2, z, c.husk);
  return p;
}

function coral(c: FC): Prop {
  const p = new Prop(16, 26, 14, S);
  // the brown bottle with its red and white label, a small glass of gold with a collar of foam
  p.cylY(5, 7, 2.6, 0, 13, (_x, y) => (y >= 4 && y <= 9 ? (y === 6 || y === 7 ? c.ceramicWhite : c.paperRed) : c.bottleDark));
  p.cylY(5, 7, 1.3, 14, 20, c.bottleDark); p.cylY(5, 7, 1.5, 21, 21, c.paperRed);
  p.cylY(11.5, 7, 2.6, 0, 10, c.glass); p.cylY(11.5, 7, 1.9, 1, 8, c.honeyTop); p.cylY(11.5, 7, 2, 9, 10, c.cream);
  return p;
}

function frango(c: FC): Prop {
  const p = new Prop(30, 10, 24, S);
  plate(p, c, 15, 12, 11.5);
  // half a chicken split flat, charred and glossy with chilli oil, a pile of chips, a wedge of lemon
  p.ellipsoid(11, 3.5, 11, 7, 2.6, 5.2, (x, y, z) => ((x * 3 + z * 5 + y) % 7 === 0 ? c.char : (x + z) % 5 === 0 ? c.chili : c.chickenGlaze));
  p.ellipsoid(7, 3, 16, 2.5, 1.6, 1.8, c.chickenGlaze);
  const r = rng(212);
  for (let k = 0; k < 14; k++) { const x = 18 + Math.floor(r() * 6), z = 6 + Math.floor(r() * 12), y = 2 + Math.floor(r() * 2); if (r() < 0.5) p.box(x, y, z, x + 3, y, z, c.fry); else p.box(x, y, z, x, y, z + 3, c.fry); }
  p.box(9, 6, 9, 10, 6, 10, c.parsley); p.box(21, 2, 18, 22, 3, 19, c.lemon);
  return p;
}

function batatadoce(c: FC): Prop {
  const p = new Prop(24, 9, 22, S);
  plate(p, c, 12, 11, 10);
  // fat wedges of golden sweet potato, caramel at the edges, a pinch of salt
  const r = rng(77);
  for (let k = 0; k < 9; k++) {
    const x = 5 + Math.floor(r() * 11), z = 5 + Math.floor(r() * 10), y = 2 + (k > 5 ? 2 : 0), along = r() < 0.5;
    p.box(x, y, z, x + (along ? 5 : 1), y + 1, z + (along ? 1 : 5), (xx, yy, zz) => ((xx + zz + yy) % 4 === 0 ? c.caramel : yy === y + 1 ? c.pumpkin : c.fry));
  }
  p.set(10, 6, 10, c.sugar); p.set(13, 6, 9, c.sugar);
  return p;
}

function sardinhas(c: FC): Prop {
  const p = new Prop(30, 9, 24, S);
  plate(p, c, 15, 12, 11.5);
  // a slice of bread under three grilled sardines, boiled potatoes, a little pepper and onion salad
  p.box(6, 2, 6, 17, 2, 16, (x, _y, z) => (x === 6 || x === 17 || z === 6 || z === 16 ? c.breadCrust : c.breadIn));
  for (const z of [7, 10.5, 14]) {
    const zz = Math.round(z);
    p.box(5, 3, zz, 17, 4, zz + 1, (x, y) => (x < 7 ? c.mackerelBack : y === 4 ? ((x + zz) % 3 === 0 ? c.char : c.mackerelBack) : c.mackerel));
    p.set(18, 3, zz, c.mackerelBack); p.set(19, 3, zz, c.mackerel);
  }
  for (const [x, z] of [[21, 7], [23, 11]]) p.ellipsoid(x, 3, z, 2.2, 1.8, 2.2, c.potato);
  for (let k = 0; k < 8; k++) p.set(20 + (k % 4), 2, 15 + (k >> 2), k % 3 === 0 ? c.tomato : k % 3 === 1 ? c.pepper : c.redOnion);
  p.set(22, 3, 15, c.parsley);
  return p;
}

function polvo(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  bowl(p, c.ceramicWhite, 12, 12, 10, 4);
  // chunks of tender octopus, rings of red onion, red and green pepper, coriander, a gloss of olive oil
  const r = rng(54);
  for (let k = 0; k < 16; k++) { const a = r() * Math.PI * 2, d = r() * 6.5; const x = 12 + Math.cos(a) * d, z = 12 + Math.sin(a) * d; p.ellipsoid(x, 4, z, 1.6, 1.2, 1.4, (xx, yy) => (yy > 4 ? c.octopus : (xx % 2 ? c.octopusLight : c.octopus))); }
  for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = r() * 7; p.set(Math.round(12 + Math.cos(a) * d), 5, Math.round(12 + Math.sin(a) * d), [c.redOnion, c.pepper, c.lettuce, c.parsley][k % 4]); }
  p.set(9, 3, 14, c.oil); p.set(15, 3, 9, c.oil);
  return p;
}

function cha(c: FC): Prop {
  const p = new Prop(26, 18, 18, S);
  // a china teapot with a blue band, a cup of pale gold tea on its saucer, a sprig of lemon verbena
  p.ellipsoid(8, 6, 9, 5, 5, 5, (_x, y) => (y === 6 || y === 7 ? c.ceramicBlue : c.ceramicWhite));
  p.cylY(8, 9, 2, 11, 11, c.ceramicWhite); p.set(8, 12, 9, c.ceramicBlue);
  for (let k = 0; k < 4; k++) p.set(13 + k, 6 + k, 9, c.ceramicWhite);
  p.box(1, 5, 9, 2, 8, 9, c.ceramicWhite);
  p.cylY(20, 9, 4.5, 0, 0, c.ceramicWhite); p.cylY(20, 9, 3, 1, 4, c.ceramicWhite); p.cylY(20, 9, 2.3, 2, 4, c.tea);
  p.box(23, 2, 9, 24, 3, 9, c.ceramicWhite);
  p.set(18, 1, 13, c.leaf); p.set(19, 1, 14, c.leaf); p.set(20, 1, 14, c.mint);
  return p;
}

function torta(c: FC): Prop {
  const p = new Prop(24, 9, 20, S);
  p.cylY(12, 10, 9, 0, 0, c.ceramicWhite);
  // a wedge of almond tart: a crisp shortcrust base, a deep layer of sliced almonds set in shining caramel
  for (let x = 5; x <= 19; x++) for (let z = 5; z <= 15; z++) {
    if (Math.abs(z - 10) > (x - 5) * 0.38 + 0.5) continue;
    for (let y = 1; y <= 5; y++) p.set(x, y, z, y <= 2 ? (x === 19 ? c.shortcrustHi : c.shortcrust) : y === 5 ? ((x * 3 + z * 7) % 4 === 0 ? c.almond : c.caramel) : (x + z + y) % 3 === 0 ? c.almond : c.honeyTop);
  }
  p.box(3, 1, 15, 10, 1, 15, c.steelLight);
  return p;
}

function gelado(c: FC): Prop {
  const p = new Prop(14, 30, 14, S);
  // a crisp wafer cone, a scoop of pale banana, a scoop of passion fruit on top with its black seeds
  for (let y = 0; y < 14; y++) p.cylY(7, 7, 0.8 + y * 0.22, y, y, (x, yy, z) => ((x + z + yy) % 3 === 0 ? c.waferDark : c.wafer));
  p.ellipsoid(7, 16, 7, 3.8, 3.2, 3.8, c.banana);
  p.ellipsoid(7, 21.5, 7, 3.6, 3.2, 3.6, (x, y, z) => ((x * 3 + y * 5 + z * 7) % 6 === 0 ? c.seed : c.passion));
  p.set(7, 25, 7, c.mint);
  return p;
}

function batido(c: FC): Prop {
  const p = new Prop(14, 30, 14, S);
  // a tall glass of thick banana milkshake, a froth of cream, a red and white straw and a slice of banana
  for (let y = 0; y < 22; y++) p.cylY(7, 7, y < 2 ? 2.8 : 3 + y * 0.05, y, y, c.glass);
  p.cylY(7, 7, 2.6, 1, 19, (_x, y) => (y > 17 ? c.cream : c.custard));
  p.ellipsoid(7, 21, 7, 3.2, 1.6, 3.2, c.cream);
  for (let y = 12; y < 29; y++) p.set(9, y, 6, y % 2 ? c.paperRed : c.ceramicWhite);
  p.box(3, 20, 7, 4, 22, 7, c.banana);
  return p;
}

function cachorro(c: FC): Prop {
  const p = new Prop(30, 10, 16, S);
  p.box(1, 0, 1, 28, 0, 14, c.paper);
  // a long roll pressed on the grill, sausage and melted cheese inside, crisp potato sticks heaped on, mustard
  p.box(3, 1, 4, 26, 3, 11, (x, y, z) => (y === 1 ? (x % 4 === 0 ? c.char : c.breadCrust) : z === 4 || z === 11 ? c.breadCrust : c.breadIn));
  p.box(4, 4, 6, 25, 4, 9, c.cheese);
  p.box(2, 4, 7, 27, 5, 8, c.sausage);
  const r = rng(908);
  for (let k = 0; k < 40; k++) { const x = 4 + Math.floor(r() * 21), z = 5 + Math.floor(r() * 6); p.set(x, 6 + (r() < 0.4 ? 1 : 0), z, r() < 0.5 ? c.fry : c.potatoHi); }
  for (let x = 5; x < 25; x += 2) p.set(x, 7 + (x % 4 === 1 ? 1 : 0), 7 + (x % 3), c.mustard);
  return p;
}

function laranjada(c: FC): Prop {
  const p = new Prop(16, 26, 14, S);
  // the clear glass bottle of orange soda with its old label, a glass with ice beside it
  p.cylY(5, 7, 2.6, 0, 12, (_x, y) => (y >= 4 && y <= 8 ? (y === 6 ? c.paper : c.orange) : c.orangeIn));
  p.cylY(5, 7, 1.3, 13, 19, c.glass); p.cylY(5, 7, 1.0, 13, 15, c.orangeIn); p.cylY(5, 7, 1.5, 20, 20, c.steel);
  p.cylY(11.5, 7, 2.6, 0, 9, c.glass); p.cylY(11.5, 7, 1.9, 1, 7, c.orange); p.cylY(11.5, 7, 2, 8, 9, 0);
  p.set(11, 7, 6, c.ceramicWhite); p.set(12, 6, 8, c.ceramicWhite);
  return p;
}

export function buildMadeiraFood(id: MadeiraFood, c: FC): Prop {
  switch (id) {
    case 'bolocaco': return bolocaco(c);
    case 'prego': return prego(c);
    case 'poncha': return poncha(c);
    case 'nikita': return nikita(c);
    case 'maracuja': return maracuja(c);
    case 'anona': return anona(c);
    case 'malasada': return malasada(c);
    case 'brisa': return brisa(c);
    case 'espetada': return espetada(c);
    case 'milhofrito': return milhofrito(c);
    case 'espada': return espada(c);
    case 'lapas': return lapas(c);
    case 'atum': return atum(c);
    case 'caldeirada': return caldeirada(c);
    case 'sopatomate': return sopatomate(c);
    case 'vinhalhos': return vinhalhos(c);
    case 'bolomel': return bolomel(c);
    case 'queijada': return queijada(c);
    case 'madeira': return madeiraWine(c);
    case 'broas': return broas(c);
    case 'chinesa': return chinesa(c);
    case 'nata': return nata(c);
    case 'picado': return picado(c);
    case 'sopatrigo': return sopatrigo(c);
    case 'gaiado': return gaiado(c);
    case 'pudim': return pudim(c);
    case 'tremocos': return tremocos(c);
    case 'coral': return coral(c);
    case 'frango': return frango(c);
    case 'batatadoce': return batatadoce(c);
    case 'sardinhas': return sardinhas(c);
    case 'polvo': return polvo(c);
    case 'cha': return cha(c);
    case 'torta': return torta(c);
    case 'gelado': return gelado(c);
    case 'batido': return batido(c);
    case 'cachorro': return cachorro(c);
    case 'laranjada': return laranjada(c);
  }
}
