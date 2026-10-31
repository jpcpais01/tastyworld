import { rng } from './grid';
import { Palette } from './palette';
import { Prop } from './props';

/** Voxel models of every dish. Pure data so they can be built in the worker (counter displays) and on the main thread (icons). */

export function foodColors(pal: Palette) {
  const a = (hex: number, vary = 0.07, emit = 0) => pal.add(hex, { vary, emit });
  return {
    tray: a(0xe8d2a6, 0.04), trayDark: a(0xc9ab78, 0.04),
    batter: a(0xd99a4e, 0.1), batterDark: a(0xa8642c, 0.1), batterLight: a(0xf0c27a, 0.08),
    sauce: a(0x5a2d17, 0.08), mayo: a(0xfbf3dc, 0.02), nori: a(0x2f6b2a, 0.15), bonito: a(0xe9b796, 0.15),
    pick: a(0xe6cf9c, 0.03), plate: a(0xf4f1ea, 0.02), plateBlue: a(0x3c62a0, 0.04), plateRim: a(0x2b4c86, 0.03),
    steel: a(0x50555c, 0.04), steelLight: a(0x9aa1a8, 0.03), monja: a(0xb98a52, 0.12), monjaCrisp: a(0x7a4d28, 0.12),
    cabbage: a(0xb9d98a, 0.1), mentaiko: a(0xf07a7a, 0.08), cheese: a(0xf6d36b, 0.06),
    dango: a(0xf3ead6, 0.04), mitarashi: a(0xb8732c, 0.08), mitarashiGloss: a(0xd9933c, 0.06),
    bean: a(0x5b1f22, 0.08), skewer: a(0xdcc08a, 0.03),
    chicken: a(0xc77a3c, 0.1), chickenGlaze: a(0x8a4318, 0.08), scallion: a(0x6fae4a, 0.1), scallionWhite: a(0xe8efd2, 0.05),
    karaage: a(0xc8803a, 0.14), karaageDark: a(0x9a5a24, 0.12), lemon: a(0xf5dc4a, 0.05), lettuce: a(0x8cc65a, 0.1),
    bowl: a(0xc9372c, 0.04), bowlIn: a(0x1f1f24, 0.03), broth: a(0x8a4a1c, 0.05), brothHi: a(0xb06a2a, 0.05),
    noodle: a(0xf2d88a, 0.06), chashu: a(0xc78b6a, 0.08), chashuEdge: a(0x8a4a2a, 0.06), eggWhite: a(0xfaf6ea, 0.02),
    yolk: a(0xf29a1c, 0.04), naruto: a(0xfbf7f2, 0.02), narutoPink: a(0xec6c8e, 0.03), menma: a(0xc9a050, 0.06),
    gyoza: a(0xf1e3c2, 0.05), gyozaBrown: a(0xb87332, 0.1), wing: a(0xd8a65e, 0.12),
    rice: a(0xfbfaf4, 0.03), tuna: a(0xc8283a, 0.06), kohada: a(0xb8c4cc, 0.08), kohadaDark: a(0x5a6a7a, 0.08),
    shrimp: a(0xf28a5a, 0.05), shrimpStripe: a(0xfbe2d2, 0.03), tamago: a(0xf6cf4a, 0.05), tamagoDark: a(0xd9a62a, 0.06),
    ikura: a(0xff6a2a, 0.1, 0.15), geta: a(0xc99a62, 0.05), getaDark: a(0x8a6038, 0.05), wasabi: a(0x8cbf4a, 0.06), ginger: a(0xf4b6b0, 0.05),
    paper: a(0xf6efe0, 0.03), paperRed: a(0xc8372d, 0.04), shiso: a(0x3f8a3a, 0.08),
    custard: a(0xf6d878, 0.04), caramel: a(0x8a4a1a, 0.06), cream: a(0xfbf6ec, 0.02), cherry: a(0xd8202a, 0.04), glass: pal.add(0xdcecf2, { glass: true }),
    pasta: a(0xe8823a, 0.08), pastaHi: a(0xf2a050, 0.06), pepper: a(0x4a9a3a, 0.08), sausage: a(0xc0504a, 0.06), onion: a(0xf3ecd8, 0.04), parmesan: a(0xf8f0d0, 0.04),
    zaru: a(0xc9a46a, 0.05), zaruDark: a(0x9a7a48, 0.05), sobaN: a(0x9c8a72, 0.07), sobaHi: a(0xb4a28a, 0.06), tsuyu: a(0x3a2010, 0.04), choko: a(0x2b3a62, 0.03), negi: a(0x9ccf6a, 0.08),
    tempura: a(0xf0c878, 0.12), tempuraHi: a(0xf8dc9a, 0.1), tail: a(0xe8603a, 0.05), shiso2: a(0x2f7a32, 0.08), daikon: a(0xf4f1e8, 0.04),
    // Amalfi
    pastry: a(0xe0a050, 0.1), pastryDark: a(0xb86e2c, 0.1), pastryLight: a(0xf2c47a, 0.08), sugar: a(0xfbf8f2, 0.02), ricotta: a(0xf6eccd, 0.04),
    sponge: a(0xf2d27a, 0.06), lemonCream: a(0xf6e08a, 0.04), lemonPeel: a(0xf2c81e, 0.05), conePaper: a(0xc9a46e, 0.05), conePaperDark: a(0x9a7a4c, 0.05),
    fry: a(0xe2b25a, 0.12), fryDark: a(0xbf8638, 0.1), calamari: a(0xf6ecd2, 0.05), anchovy: a(0x8a96a2, 0.08), dough: a(0xf0d8a0, 0.06), crust: a(0xc98a44, 0.1),
    tomato: a(0xc8321e, 0.06), mozzarella: a(0xfbf7ec, 0.02), basil: a(0x3f8a32, 0.08), wafer: a(0xd4964c, 0.06), waferDark: a(0xa86c30, 0.06),
    pistachio: a(0xa6c46a, 0.05), lemonGelato: a(0xf8ee9a, 0.04), stracciatella: a(0xf6f0e2, 0.03), granita: a(0xf6f2c6, 0.05), limoncello: a(0xf2e04a, 0.03, 0.12),
    chocolate: a(0x4a2a1a, 0.06), chocolateDark: a(0x2e1a10, 0.05), mussel: a(0x23263a, 0.06), musselIn: a(0xe8964a, 0.06), clam: a(0xd9cfc0, 0.06),
    squid: a(0xf0e6d6, 0.05), potato: a(0xe9cf86, 0.06), parsley: a(0x3a8a2e, 0.1), ceramicBlue: a(0x2f63a8, 0.04), ceramicYellow: a(0xe9c23a, 0.04), ceramicWhite: a(0xf5f1e6, 0.02),
    scialatielli: a(0xf0dc9a, 0.06), scialatielliHi: a(0xf8eab8, 0.05), oil: a(0xd9b84a, 0.04),
    // Istanbul
    simit: a(0xb8642a, 0.1), simitDark: a(0x8a4318, 0.08), sesame: a(0xf0dca0, 0.06), bread: a(0xd9a05a, 0.08), breadIn: a(0xf6e6c0, 0.04),
    mackerel: a(0x9aa4ae, 0.08), mackerelBack: a(0x3a4a5a, 0.08), redOnion: a(0xa84a7a, 0.06), pickleJuice: a(0xd83a5a, 0.04), gherkin: a(0x8aa83a, 0.08),
    carrot: a(0xe8803a, 0.06), offal: a(0x8a5a3a, 0.1), offalHi: a(0xa86a42, 0.1), chiliFlake: a(0xb8281e, 0.08), chestnut: a(0x5a2e16, 0.08),
    chestnutIn: a(0xe8c27a, 0.06), corn: a(0xf2c84a, 0.06), cornDark: a(0xd8a02a, 0.08), husk: a(0xc9b878, 0.06), dondurma: a(0xf8f4ea, 0.02),
    salep: a(0xefe2c8, 0.03), cinnamon: a(0x8a5a2a, 0.08), doner: a(0x9a5a2a, 0.1), donerHi: a(0xb8743a, 0.08), lavash: a(0xf0dcae, 0.05),
    ayran: a(0xfbfaf4, 0.02), copper: a(0xb87333, 0.06), copperDark: a(0x8a4f22, 0.06), baklava: a(0xd89a3a, 0.08), baklavaHi: a(0xf0c060, 0.06),
    antep: a(0x7aa83a, 0.08), kadayif: a(0xe88a2a, 0.1), kadayifHi: a(0xf4a840, 0.08), syrup: a(0xe8b04a, 0.04, 0.05), begendi: a(0xe8dcb8, 0.04),
    lambStew: a(0x7a3a1a, 0.08), stewSauce: a(0xb8401e, 0.06), manti: a(0xf2e2c0, 0.04), yoghurt: a(0xfbf8f0, 0.02), redButter: a(0xc8401e, 0.04),
    mint: a(0x5a8a3a, 0.1), tulipGlass: pal.add(0xe8c8a0, { glass: true }), tea: a(0x8a2a12, 0.04), iznik: a(0x2f63a8, 0.04), iznikRed: a(0xc8321e, 0.04),
  };
}

export type FoodId =
  | 'takoyaki' | 'monjayaki' | 'ningyoyaki' | 'dango' | 'taiyaki' | 'dorayaki'
  | 'yakitori' | 'karaage' | 'ramen' | 'gyoza' | 'nigiri' | 'tamagoyaki'
  | 'purin' | 'napolitan' | 'zarusoba' | 'tempura'
  | 'sfogliatella' | 'delizia' | 'cuoppo' | 'frittatina' | 'portafoglio' | 'montanara' | 'gelato' | 'granita'
  | 'limoncello' | 'caprese' | 'scialatielli' | 'totani'
  | 'simit' | 'pogaca' | 'balikekmek' | 'tursu' | 'midye' | 'kokorec' | 'kestane' | 'misir'
  | 'dondurma' | 'salep' | 'doner' | 'ayran' | 'baklava' | 'kunefe' | 'hunkar' | 'manti';

type FC = ReturnType<typeof foodColors>;

export function buildFood(id: FoodId, pal: Palette): Prop {
  const c = foodColors(pal);
  switch (id) {
    case 'takoyaki': return takoyaki(c);
    case 'monjayaki': return monjayaki(c);
    case 'ningyoyaki': return ningyoyaki(c);
    case 'dango': return dango(c);
    case 'taiyaki': return taiyaki(c);
    case 'dorayaki': return dorayaki(c);
    case 'yakitori': return yakitori(c);
    case 'karaage': return karaage(c);
    case 'ramen': return ramen(c);
    case 'gyoza': return gyoza(c);
    case 'nigiri': return nigiri(c);
    case 'tamagoyaki': return tamagoyaki(c);
    case 'purin': return purin(c);
    case 'napolitan': return napolitan(c);
    case 'zarusoba': return zarusoba(c);
    case 'tempura': return tempura(c);
    case 'sfogliatella': return sfogliatella(c);
    case 'delizia': return delizia(c);
    case 'cuoppo': return cuoppo(c);
    case 'frittatina': return frittatina(c);
    case 'portafoglio': return portafoglio(c);
    case 'montanara': return montanara(c);
    case 'gelato': return gelato(c);
    case 'granita': return granita(c);
    case 'limoncello': return limoncello(c);
    case 'caprese': return caprese(c);
    case 'scialatielli': return scialatielli(c);
    case 'totani': return totani(c);
    case 'simit': return simit(c);
    case 'pogaca': return pogaca(c);
    case 'balikekmek': return balikekmek(c);
    case 'tursu': return tursu(c);
    case 'midye': return midye(c);
    case 'kokorec': return kokorec(c);
    case 'kestane': return kestane(c);
    case 'misir': return misir(c);
    case 'dondurma': return dondurma(c);
    case 'salep': return salep(c);
    case 'doner': return doner(c);
    case 'ayran': return ayran(c);
    case 'baklava': return baklava(c);
    case 'kunefe': return kunefe(c);
    case 'hunkar': return hunkar(c);
    case 'manti': return manti(c);
  }
}

const S = 1 / 40;

function takoyaki(c: FC): Prop {
  const p = new Prop(22, 12, 16, S);
  p.box(0, 0, 0, 21, 0, 15, c.tray);
  p.box(0, 1, 0, 21, 2, 0, c.trayDark); p.box(0, 1, 15, 21, 2, 15, c.trayDark);
  p.box(0, 1, 0, 0, 2, 15, c.trayDark); p.box(21, 1, 0, 21, 2, 15, c.trayDark);
  const r = rng(11);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const cx = 4 + i * 7, cz = 4.5 + j * 7;
      p.ellipsoid(cx, 4.5, cz, 3.4, 3.2, 3.4, (_x, y) => (y >= 6 ? c.sauce : r() < 0.25 ? c.batterDark : c.batter));
    }
  // mayo zigzag
  for (let x = 1; x < 21; x++) {
    const z = 2 + Math.round(Math.abs(((x * 0.9) % 4) - 2) * 3);
    p.set(x, 8, z, c.mayo); p.set(x, 8, z + 6, c.mayo);
  }
  for (let k = 0; k < 40; k++) {
    const x = 1 + Math.floor(r() * 20), z = 1 + Math.floor(r() * 14);
    p.set(x, 8 + (r() < 0.5 ? 1 : 0), z, r() < 0.5 ? c.nori : c.bonito);
  }
  for (let k = 0; k < 9; k++) p.set(15 + k * 0.3, 8 + k, 10, c.pick);
  return p;
}

function monjayaki(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  p.cylY(12, 12, 11.5, 0, 0, c.steel);
  p.cylY(12, 12, 11.5, 1, 1, c.steel);
  p.cylY(12, 12, 10.5, 1, 1, 0);
  const r = rng(12);
  p.cylY(12, 12, 9.5, 1, 1, (x, _y, z) => {
    const d = Math.hypot(x - 12, z - 12);
    return d > 7.5 ? c.monjaCrisp : r() < 0.15 ? c.cabbage : r() < 0.08 ? c.mentaiko : r() < 0.06 ? c.cheese : c.monja;
  });
  for (let k = 0; k < 18; k++) p.set(5 + Math.floor(r() * 14), 2, 5 + Math.floor(r() * 14), r() < 0.5 ? c.cabbage : c.mentaiko);
  // little spatula (hera)
  p.box(14, 2, 3, 19, 2, 6, c.steelLight);
  p.box(19, 3, 4, 22, 5, 5, c.skewer);
  return p;
}

function ningyoyaki(c: FC): Prop {
  const p = new Prop(22, 12, 16, S);
  p.box(1, 0, 1, 20, 0, 14, c.paper);
  p.box(1, 1, 14, 20, 3, 14, c.paperRed);
  // pagoda
  p.box(3, 1, 4, 7, 3, 8, c.batter); p.box(4, 4, 5, 6, 5, 7, c.batter); p.box(2, 4, 3, 8, 4, 9, c.batterDark); p.box(5, 6, 6, 5, 7, 6, c.batterDark);
  // lantern
  p.ellipsoid(12, 3.5, 6, 2.6, 2.8, 2.6, c.batter); p.box(11, 6, 5, 13, 6, 7, c.batterDark); p.box(11, 1, 5, 13, 1, 7, c.batterDark);
  // bird
  p.ellipsoid(17.5, 2.5, 6, 2.6, 1.8, 2.2, c.batterLight); p.ellipsoid(18.5, 4.5, 6, 1.4, 1.4, 1.4, c.batterLight); p.set(20, 4, 6, c.batterDark);
  // row behind
  for (let i = 0; i < 3; i++) p.ellipsoid(5 + i * 6, 2.5, 11, 2.4, 2, 2, i === 1 ? c.batterLight : c.batter);
  return p;
}

function dango(c: FC): Prop {
  const p = new Prop(22, 9, 16, S);
  p.box(0, 0, 2, 21, 0, 13, c.plateBlue);
  p.box(0, 0, 2, 21, 0, 2, c.plateRim); p.box(0, 0, 13, 21, 0, 13, c.plateRim);
  for (const z of [5, 10]) {
    for (let x = 0; x < 22; x++) p.set(x, 4, z, c.skewer);
    for (let i = 0; i < 4; i++)
      p.ellipsoid(3 + i * 4.6, 4.5, z + 0.5, 2.3, 2.3, 2.3, (_x, y) => (y >= 5 ? (y >= 6 ? c.mitarashiGloss : c.mitarashi) : c.dango));
  }
  return p;
}

function taiyaki(c: FC): Prop {
  const p = new Prop(24, 8, 14, S);
  p.box(4, 0, 1, 19, 0, 12, c.paper);
  const body = (x: number, z: number) => {
    const t = (x - 2) / 18;
    if (t < 0 || t > 1) return false;
    const half = t < 0.75 ? 5.2 * Math.sin(Math.min(1, t / 0.75) * Math.PI * 0.95 + 0.15) : 2 + (t - 0.75) * 14;
    return Math.abs(z - 6.5) <= half;
  };
  for (let x = 0; x < 24; x++)
    for (let z = 0; z < 14; z++) {
      if (!body(x, z)) continue;
      const tail = x > 16;
      const h = tail ? 2 : 3 + (Math.abs(z - 6.5) < 3 ? 1 : 0);
      for (let y = 1; y <= h; y++) p.set(x, y, z, y === h && (x + z) % 3 === 0 ? c.batterDark : c.batter);
    }
  p.set(5, 5, 4, c.sauce); p.set(5, 5, 9, c.batterDark);
  for (let x = 8; x < 16; x += 2) for (let z = 3; z < 11; z += 3) p.set(x, 5, z, c.batterLight);
  p.set(3, 3, 6, c.bean); p.set(3, 3, 7, c.bean);
  return p;
}

function dorayaki(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.cylY(10, 10, 9, 0, 0, c.plate);
  p.cylY(10, 10, 8, 1, 2, c.batterLight);
  p.cylY(10, 10, 8, 3, 3, c.batterDark);
  p.cylY(10, 10, 7.5, 4, 4, c.bean);
  p.cylY(10, 10, 8, 5, 5, c.batterLight);
  p.cylY(10, 10, 7.5, 6, 6, c.batterDark);
  p.cylY(10, 10, 6.5, 7, 7, c.batter);
  p.cylY(10, 10, 4.5, 7, 7, c.batterDark);
  // cut half to show bean paste
  p.box(10, 1, 0, 19, 8, 19, 0);
  p.cylY(14, 10, 7.5, 0, 0, c.plate);
  p.box(14, 1, 3, 15, 3, 17, 0);
  for (let z = 4; z <= 16; z++) for (let y = 1; y <= 6; y++) if (p.get(9, y, z)) p.set(9, y, z, y === 4 ? c.bean : y > 4 ? c.batterLight : c.batterLight);
  return p;
}

function yakitori(c: FC): Prop {
  const p = new Prop(24, 8, 16, S);
  p.box(0, 0, 1, 23, 0, 14, c.plate);
  for (const z of [3, 7, 11]) {
    for (let x = 0; x < 24; x++) p.set(x, 3, z, c.skewer);
    for (let i = 0; i < 4; i++) {
      const x0 = 2 + i * 5;
      const isScallion = z === 7 && i % 2 === 1;
      p.box(x0, 2, z - 1, x0 + 3, 4, z + 1, isScallion ? c.scallionWhite : c.chicken);
      if (!isScallion) { p.box(x0, 5, z - 1, x0 + 3, 5, z + 1, c.chickenGlaze); p.set(x0 + 1, 5, z, c.chicken); }
      else p.box(x0, 5, z - 1, x0 + 3, 5, z + 1, c.scallion);
    }
  }
  return p;
}

function karaage(c: FC): Prop {
  const p = new Prop(20, 12, 20, S);
  p.cylY(10, 10, 9.5, 0, 0, c.plate);
  p.ellipsoid(6, 2, 13, 4, 1.4, 4, c.lettuce);
  const r = rng(14);
  const pts = [[8, 3, 8], [13, 3, 9], [10, 3, 13], [12, 6, 11], [7, 5, 11], [14, 3, 14]];
  for (const [x, y, z] of pts) p.ellipsoid(x, y, z, 3, 2.6, 2.8, () => (r() < 0.35 ? c.karaageDark : c.karaage));
  p.box(15, 1, 4, 17, 4, 5, c.lemon);
  return p;
}

function ramen(c: FC): Prop {
  const p = new Prop(22, 13, 22, S);
  for (let y = 0; y <= 8; y++) {
    const rr = 6.5 + y * 0.55;
    p.cylY(11, 11, rr, y, y, c.bowl);
  }
  p.cylY(11, 11, 4, 0, 0, c.bowlIn);
  p.cylY(11, 11, 10.2, 8, 8, c.bowlIn);
  p.cylY(11, 11, 9.6, 8, 8, (x, _y, z) => ((x + z) % 7 === 0 ? c.brothHi : c.broth));
  // noodles waves
  for (let x = 4; x < 18; x++) for (let z = 7; z < 15; z++) if ((x + Math.floor(z / 2)) % 3 === 0 && Math.hypot(x - 11, z - 11) < 8) p.set(x, 9, z, c.noodle);
  // chashu slices
  p.box(4, 9, 4, 9, 9, 8, c.chashu); p.box(4, 9, 4, 9, 9, 4, c.chashuEdge); p.box(4, 9, 4, 4, 9, 8, c.chashuEdge);
  // egg halves
  p.ellipsoid(14.5, 9.5, 6, 2.4, 1.2, 1.8, c.eggWhite); p.set(14, 10, 6, c.yolk); p.set(15, 10, 6, c.yolk);
  // nori standing
  p.box(16, 9, 12, 16, 13, 17, c.nori);
  // naruto
  p.cylY(10, 15, 1.8, 9, 9, c.naruto); p.set(10, 9, 15, c.narutoPink); p.set(9, 9, 14, c.narutoPink);
  // menma
  p.box(6, 9, 12, 7, 9, 15, c.menma);
  // scallions
  for (const [x, z] of [[11, 10], [12, 11], [10, 12], [13, 9], [12, 13]]) p.set(x, 10, z, c.scallion);
  return p;
}

function gyoza(c: FC): Prop {
  const p = new Prop(24, 7, 16, S);
  p.box(0, 0, 0, 23, 0, 15, c.plate);
  p.box(1, 1, 2, 22, 1, 13, c.wing);
  for (let i = 0; i < 5; i++) {
    const x0 = 2 + i * 4;
    p.box(x0, 2, 4, x0 + 2, 3, 11, c.gyoza);
    p.box(x0 + 1, 4, 5, x0 + 1, 4, 10, c.gyoza);
    p.box(x0, 1, 4, x0 + 2, 1, 11, c.gyozaBrown);
    for (let z = 5; z <= 10; z += 2) p.set(x0 + 1, 5, z, c.gyoza);
  }
  return p;
}

function nigiri(c: FC): Prop {
  const p = new Prop(28, 8, 14, S);
  p.box(0, 2, 1, 27, 2, 12, c.geta);
  p.box(2, 0, 2, 3, 1, 11, c.getaDark); p.box(24, 0, 2, 25, 1, 11, c.getaDark);
  const tops = [c.tuna, c.kohada, c.shrimp, c.tamago, c.ikura];
  for (let i = 0; i < 5; i++) {
    const x0 = 1 + i * 5;
    p.box(x0, 3, 4, x0 + 3, 4, 9, c.rice);
    const t = tops[i];
    if (i === 4) {
      p.box(x0, 3, 4, x0 + 3, 5, 9, c.nori);
      p.box(x0 + 1, 6, 5, x0 + 2, 6, 8, c.ikura);
    } else {
      p.box(x0, 5, 3, x0 + 3, 5, 10, t);
      if (i === 1) for (let z = 3; z <= 10; z += 2) p.set(x0 + 1, 5, z, c.kohadaDark);
      if (i === 2) for (let z = 4; z <= 10; z += 2) p.box(x0, 5, z, x0 + 3, 5, z, c.shrimpStripe);
      if (i === 3) p.box(x0 + 1, 6, 6, x0 + 2, 6, 7, c.nori);
    }
  }
  p.box(26, 3, 3, 27, 4, 4, c.wasabi);
  p.box(25, 3, 8, 27, 3, 10, c.ginger);
  return p;
}

function tamagoyaki(c: FC): Prop {
  const p = new Prop(22, 10, 16, S);
  p.box(0, 0, 1, 21, 0, 14, c.plateBlue);
  p.box(0, 0, 1, 21, 0, 1, c.plateRim); p.box(0, 0, 14, 21, 0, 14, c.plateRim);
  p.box(2, 1, 4, 14, 1, 11, c.shiso);
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 4;
    for (let y = 1; y <= 6; y++) for (let z = 5; z <= 10; z++) p.set(x0, y + 1, z, (y + z) % 3 === 0 ? c.tamagoDark : c.tamago);
    p.box(x0 + 1, 2, 5, x0 + 2, 7, 10, c.tamago);
    p.box(x0 + 1, 7, 5, x0 + 2, 7, 10, c.tamagoDark);
  }
  p.box(17, 1, 6, 20, 2, 9, c.plate);
  p.box(18, 3, 7, 19, 3, 8, c.ginger);
  return p;
}

function purin(c: FC): Prop {
  const p = new Prop(20, 16, 20, S);
  // footed glass dish
  p.cylY(10, 10, 3, 0, 0, c.glass);
  p.cylY(10, 10, 1.4, 1, 2, c.glass);
  p.cylY(10, 10, 9, 3, 3, c.glass);
  // the custard, a flat-topped cone with caramel running down
  for (let y = 4; y <= 11; y++) p.cylY(10, 10, 6.4 - (y - 4) * 0.35, y, y, (x, yy, z) => (yy >= 10 || (yy >= 8 && (x + z) % 3 === 0) ? c.caramel : c.custard));
  // whipped cream rosette and a cherry
  p.ellipsoid(10, 12.5, 10, 2.2, 1.4, 2.2, c.cream);
  p.ellipsoid(10, 14, 10, 1.2, 1.2, 1.2, c.cherry);
  p.set(10, 15, 11, c.shiso);
  p.ellipsoid(4.5, 4.5, 6, 1.6, 1, 1.6, c.cream);
  return p;
}

function napolitan(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  p.cylY(12, 12, 11.5, 0, 0, c.plate);
  p.cylY(12, 12, 10.5, 1, 1, c.plate);
  const r = rng(21);
  // a heap of ketchup-glazed spaghetti
  for (let y = 2; y <= 6; y++) p.cylY(12, 12, 8.2 - (y - 2) * 1.5, y, y, () => (r() < 0.3 ? c.pastaHi : c.pasta));
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = r() * 7;
    const x = Math.round(12 + Math.cos(a) * d), z = Math.round(12 + Math.sin(a) * d);
    let y = 7; while (y > 2 && !p.get(x, y - 1, z)) y--;
    p.set(x, y, z, k % 3 === 0 ? c.pepper : k % 3 === 1 ? c.sausage : c.onion);
  }
  for (let k = 0; k < 10; k++) p.set(9 + Math.floor(r() * 6), 7, 9 + Math.floor(r() * 6), c.parmesan);
  // fork
  p.box(19, 1, 6, 19, 1, 15, c.steelLight); p.box(18, 1, 15, 20, 1, 17, c.steelLight);
  return p;
}

function zarusoba(c: FC): Prop {
  const p = new Prop(28, 9, 20, S);
  // square bamboo zaru on a lacquer tray
  p.box(0, 0, 0, 27, 0, 19, c.bowl);
  p.box(1, 1, 1, 19, 2, 18, (x, y, z) => (y === 2 && x > 1 && x < 19 && z > 1 && z < 18 ? ((x + z) % 2 ? c.zaru : c.zaruDark) : c.zaruDark));
  const r = rng(23);
  for (let y = 3; y <= 6; y++)
    for (let z = 4; z <= 15; z++)
      for (let x = 4; x <= 16; x++) {
        const d = Math.hypot((x - 10) / 6.5, (z - 9.5) / 6, (y - 3) / 4);
        if (d < 1 && r() < 0.8) p.set(x, y, z, (x + y * 2) % 4 === 0 ? c.sobaHi : c.sobaN);
      }
  for (let k = 0; k < 14; k++) p.set(7 + Math.floor(r() * 7), 7, 7 + Math.floor(r() * 6), c.nori);
  // dipping cup with tsuyu, a little dish of negi and wasabi
  for (let y = 1; y <= 5; y++) p.cylY(23.5, 6, 3, y, y, c.choko);
  p.cylY(23.5, 6, 2.2, 5, 5, c.tsuyu);
  p.box(21, 1, 12, 26, 1, 17, c.plate);
  p.box(22, 2, 13, 23, 2, 15, c.negi); p.box(25, 2, 14, 25, 3, 15, c.wasabi);
  return p;
}

function tempura(c: FC): Prop {
  const p = new Prop(26, 10, 20, S);
  p.box(0, 0, 0, 25, 0, 19, c.getaDark);
  p.box(1, 1, 1, 24, 1, 18, c.paper);
  const r = rng(27);
  // two prawns with crisp batter, curled tails up
  for (const z0 of [5, 10]) {
    for (let x = 3; x <= 17; x++) {
      const rr = 2.2 - Math.abs(x - 10) * 0.06;
      p.ellipsoid(x, 3.4, z0 + 1.5, 0.9, rr, rr, () => (r() < 0.35 ? c.tempuraHi : c.tempura));
    }
    p.box(18, 3, z0 + 1, 19, 5, z0 + 2, c.tail); p.set(20, 6, z0 + 1, c.tail);
  }
  // shiso leaf and a sweet potato slice
  p.box(4, 2, 15, 10, 2, 17, c.shiso2);
  p.box(5, 3, 15, 9, 4, 16, c.tempura);
  // tentsuyu with grated daikon
  for (let y = 1; y <= 3; y++) p.cylY(21.5, 15, 2.6, y, y, c.choko);
  p.cylY(21.5, 15, 1.8, 3, 3, c.tsuyu);
  p.ellipsoid(21.5, 4, 15, 1.2, 0.8, 1.2, c.daikon);
  return p;
}

// ---------------------------------------------------------------------------------------------- Amalfi

/** A plate in the coast's hand-painted majolica: white with a blue and yellow rim. */
function majolica(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1.2 ? ((x + z) % 3 ? c.ceramicBlue : c.ceramicYellow) : c.ceramicWhite));
  p.cylY(cx, cz, r - 1.2, 1, 1, 0);
}

function sfogliatella(c: FC): Prop {
  const p = new Prop(22, 12, 20, S);
  p.box(1, 0, 1, 20, 0, 18, c.paper);
  // the shell: a fan of crisp layers, ridged, closing to a point at the back
  for (let z = 3; z <= 16; z++)
    for (let x = 3; x <= 18; x++) {
      const t = (x - 3) / 15;
      const half = 6.6 * Math.sin(Math.PI * (0.25 + t * 0.75)) ;
      if (Math.abs(z - 9.5) > half) continue;
      const h = 2 + Math.round((1 - Math.abs(z - 9.5) / Math.max(1, half)) * 5 * (0.4 + t * 0.6));
      for (let y = 1; y <= h; y++) p.set(x, y, z, x % 2 === 0 ? c.pastryDark : y === h ? c.pastryLight : c.pastry);
    }
  for (let k = 0; k < 30; k++) { const x = 5 + (k * 7) % 13, z = 5 + (k * 5) % 10; let y = 9; while (y > 1 && !p.get(x, y - 1, z)) y--; p.set(x, y, z, c.sugar); }
  return p;
}

function delizia(c: FC): Prop {
  const p = new Prop(22, 14, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a dome of lemon sponge soaked and glazed in lemon cream
  p.ellipsoid(11, 2, 11, 7, 9, 7, (_x, y) => (y > 2 ? c.lemonCream : c.sponge));
  for (let x = 4; x <= 18; x++) for (let z = 4; z <= 18; z++) if (!p.get(x, 2, z) && Math.hypot(x - 10.5, z - 10.5) < 7.2) p.set(x, 2, z, c.lemonCream);
  p.box(10, 11, 10, 12, 11, 12, c.cream);
  p.box(10, 12, 11, 12, 12, 11, c.lemonPeel);
  p.set(11, 12, 10, c.basil);
  return p;
}

function cuoppo(c: FC): Prop {
  const p = new Prop(16, 24, 16, S);
  // a cone of brown paper standing in a holder, brimming with fried squid rings, prawns and anchovies
  for (let y = 0; y < 16; y++) p.cylY(8, 8, 1.5 + y * 0.42, y, y, (x, yy, z) => ((x + z + yy) % 7 === 0 ? c.conePaperDark : c.conePaper));
  for (let y = 2; y < 16; y++) p.cylY(8, 8, 0.7 + y * 0.42, y, y, 0);
  const r = rng(51);
  for (let k = 0; k < 18; k++) {
    const a = r() * Math.PI * 2, d = r() * 4.5, y = 14 + r() * 5;
    const x = 8 + Math.cos(a) * d, z = 8 + Math.sin(a) * d;
    const kind = k % 3;
    if (kind === 0) for (let t = 0; t < 8; t++) { const aa = (t / 8) * Math.PI * 2; p.set(Math.round(x + Math.cos(aa) * 1.6), Math.round(y), Math.round(z + Math.sin(aa) * 1.6), r() < 0.4 ? c.fryDark : c.fry); }
    else if (kind === 1) p.ellipsoid(x, y, z, 1.6, 1.1, 1.1, () => (r() < 0.3 ? c.fryDark : c.fry));
    else { p.box(Math.round(x) - 2, Math.round(y), Math.round(z), Math.round(x) + 2, Math.round(y), Math.round(z), c.anchovy); }
  }
  p.box(11, 16, 6, 12, 19, 7, c.lemon);
  return p;
}

function frittatina(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.box(1, 0, 1, 18, 0, 18, c.paper);
  // a golden disc of fried bucatini and béchamel, broken open
  p.cylY(10, 10, 7.5, 1, 6, (x, y, z) => (y === 6 || Math.hypot(x + 0.5 - 10, z + 0.5 - 10) > 6.6 ? ((x + z) % 3 ? c.fry : c.fryDark) : c.batterLight));
  for (let x = 4; x <= 16; x++) for (let y = 2; y <= 5; y++) if ((x + y) % 2 === 0) p.set(x, y, 3, c.pastaHi);
  return p;
}

function portafoglio(c: FC): Prop {
  const p = new Prop(22, 12, 18, S);
  p.box(0, 0, 0, 21, 0, 17, c.paper);
  p.box(0, 1, 0, 21, 5, 0, c.paper);
  // the "wallet": a small pizza folded in four, tomato and mozzarella showing at the open edge
  for (let x = 3; x <= 18; x++) for (let z = 2; z <= 14; z++) {
    const h = Math.round(7 - Math.abs(z - 8) * 0.5);
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h ? (x % 5 === 0 ? c.crust : c.dough) : c.dough);
  }
  for (let x = 4; x <= 17; x++) { p.set(x, 4, 15, c.tomato); p.set(x, 5, 15, x % 3 ? c.mozzarella : c.tomato); p.set(x, 3, 15, c.crust); }
  p.box(9, 8, 7, 10, 8, 8, c.basil);
  return p;
}

function montanara(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  majolica(p, c, 11, 11, 10.5);
  p.cylY(11, 11, 8, 1, 3, (x, y, z) => (Math.hypot(x + 0.5 - 11, z + 0.5 - 11) > 7 || y < 3 ? c.fry : c.tomato));
  const r = rng(53);
  for (let k = 0; k < 16; k++) p.set(6 + Math.floor(r() * 10), 4, 6 + Math.floor(r() * 10), r() < 0.5 ? c.parmesan : c.mozzarella);
  p.box(10, 4, 10, 12, 4, 11, c.basil);
  return p;
}

function gelato(c: FC): Prop {
  const p = new Prop(14, 26, 14, S);
  // a waffle cone with lemon and pistachio
  for (let y = 0; y < 14; y++) p.cylY(7, 7, 0.8 + y * 0.36, y, y, (x, yy, z) => ((x + yy + z) % 3 === 0 ? c.waferDark : c.wafer));
  p.ellipsoid(7, 16, 7, 5, 3.6, 5, c.pistachio);
  p.ellipsoid(7, 20.5, 7, 4.4, 3.4, 4.4, c.lemonGelato);
  p.box(6, 24, 6, 7, 24, 7, c.lemonPeel);
  return p;
}

function granita(c: FC): Prop {
  const p = new Prop(14, 18, 14, S);
  for (let y = 0; y < 12; y++) p.cylY(7, 7, 4.2 + y * 0.18, y, y, c.glass);
  p.cylY(7, 7, 4, 1, 11, 0);
  const r = rng(54);
  for (let y = 1; y <= 13; y++) p.cylY(7, 7, y > 11 ? 5.5 - (y - 11) * 1.6 : 4, y, y, () => (r() < 0.25 ? c.lemonGelato : c.granita));
  p.box(9, 10, 6, 9, 17, 6, c.cherry);
  p.box(5, 14, 7, 6, 14, 7, c.lemonPeel);
  return p;
}

function limoncello(c: FC): Prop {
  const p = new Prop(20, 14, 16, S);
  majolica(p, c, 10, 8, 7.5);
  // a frosted little glass and the bottle beside it
  p.cylY(7, 8, 2.2, 1, 6, c.glass);
  p.cylY(7, 8, 1.6, 2, 6, c.limoncello);
  p.cylY(15, 8, 2.8, 0, 8, (_x, y) => (y >= 3 && y <= 5 ? c.ceramicYellow : c.limoncello));
  p.cylY(15, 8, 1.2, 9, 12, c.glass);
  p.box(14, 13, 7, 15, 13, 8, c.geta);
  p.box(10, 1, 12, 12, 2, 14, c.lemon);
  return p;
}

function caprese(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a wedge of flourless chocolate and almond cake under icing sugar
  for (let x = 4; x <= 18; x++) for (let z = 5; z <= 16; z++) {
    if (Math.abs(z - 10.5) > (x - 3) * 0.42) continue;
    for (let y = 1; y <= 6; y++) p.set(x, y, z, y === 6 ? c.sugar : y === 1 ? c.chocolateDark : c.chocolate);
  }
  p.ellipsoid(6, 2.5, 15, 2.2, 1.4, 2.2, c.cream);
  return p;
}

function scialatielli(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  majolica(p, c, 13, 13, 12.5);
  const r = rng(55);
  // thick short ribbons of fresh pasta tossed with clams, mussels and cherry tomatoes
  for (let y = 2; y <= 6; y++) p.cylY(13, 13, 9 - (y - 2) * 1.5, y, y, () => (r() < 0.35 ? c.scialatielliHi : c.scialatielli));
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2, d = 3 + r() * 6;
    const x = Math.round(13 + Math.cos(a) * d), z = Math.round(13 + Math.sin(a) * d);
    let y = 8; while (y > 2 && !p.get(x, y - 1, z)) y--;
    if (k % 3 === 0) { p.box(x, y, z, x + 2, y, z + 1, c.mussel); p.set(x + 1, y, z, c.musselIn); }
    else if (k % 3 === 1) p.box(x, y, z, x + 1, y, z + 1, c.clam);
    else p.ellipsoid(x, y + 0.5, z, 1.2, 1.2, 1.2, c.tomato);
  }
  for (let k = 0; k < 14; k++) p.set(8 + Math.floor(r() * 10), 7, 8 + Math.floor(r() * 10), c.parsley);
  return p;
}

function totani(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  // a deep bowl of squid rings and potatoes stewed with tomato and parsley
  for (let y = 0; y <= 6; y++) p.cylY(12, 12, 7 + y * 0.7, y, y, c.ceramicYellow);
  p.cylY(12, 12, 10.5, 1, 6, 0);
  p.cylY(12, 12, 10, 1, 4, c.tomato);
  const r = rng(56);
  for (let k = 0; k < 16; k++) {
    const a = r() * Math.PI * 2, d = r() * 7.5;
    const x = 12 + Math.cos(a) * d, z = 12 + Math.sin(a) * d;
    if (k % 2) p.ellipsoid(x, 5, z, 1.4, 1.2, 1.4, c.potato);
    else for (let t = 0; t < 8; t++) { const aa = (t / 8) * Math.PI * 2; p.set(Math.round(x + Math.cos(aa) * 1.6), 5, Math.round(z + Math.sin(aa) * 1.6), c.squid); }
  }
  for (let k = 0; k < 10; k++) p.set(7 + Math.floor(r() * 10), 6, 7 + Math.floor(r() * 10), c.parsley);
  return p;
}

// ---------------------------------------------------------------------------------------------- Istanbul

/** A plate with an İznik rim: white, a ring of blue with red tulip dots. */
function iznikPlate(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1.2 ? ((x * 3 + z) % 5 ? c.iznik : c.iznikRed) : 0));
}

/** A ring in the xz plane: a torus of radius R and tube r, lying on y0. */
function ring(p: Prop, cx: number, cz: number, R: number, r: number, y0: number, col: (x: number, y: number, z: number) => number): void {
  for (let y = 0; y <= Math.ceil(r * 2); y++) for (let z = 0; z < p.grid.sz; z++) for (let x = 0; x < p.grid.sx; x++) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) - R, dy = y + 0.5 - r;
    if (d * d + dy * dy <= r * r) p.set(x, y0 + y, z, col(x, y0 + y, z));
  }
}

function simit(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  // a ring of twisted dough dipped in grape molasses and rolled in sesame
  ring(p, 11, 11, 6.4, 2.6, 1, (x, y, z) => (y >= 4 && (x * 5 + z * 3) % 4 === 0 ? c.sesame : (Math.atan2(z - 11, x - 11) * 6 + y) % 2 < 1 ? c.simitDark : c.simit));
  return p;
}

function pogaca(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  for (const [x, z] of [[7, 8], [15, 8], [11, 15]] as const) {
    p.ellipsoid(x, 1.5, z, 4.2, 4, 4.2, (_x, y) => (y >= 4 ? c.bread : c.breadIn));
    p.box(x - 1, 5, z - 1, x, 5, z, c.sesame);
  }
  return p;
}

function balikekmek(c: FC): Prop {
  const p = new Prop(26, 12, 14, S);
  p.box(0, 0, 0, 25, 0, 13, c.paper);
  // half a loaf split open: a grilled mackerel fillet, lettuce, red onion
  for (let x = 2; x <= 23; x++) for (let z = 2; z <= 11; z++) {
    const e = Math.abs(z - 6.5) / 5;
    if (e > 1) continue;
    const h = Math.round(4 * Math.sqrt(1 - e * e));
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h || x === 2 || x === 23 ? c.bread : c.breadIn);
  }
  p.box(3, 5, 4, 22, 5, 9, c.lettuce);
  p.box(4, 6, 4, 21, 7, 9, (x, y) => (y === 7 && x % 3 === 0 ? c.chashuEdge : y === 7 ? c.mackerelBack : c.mackerel));
  for (let x = 5; x <= 20; x += 3) p.set(x, 8, 6 + (x % 2), c.redOnion);
  for (let x = 2; x <= 23; x++) for (let z = 3; z <= 10; z++) { const e = Math.abs(z - 6.5) / 4.5; if (e <= 1) p.set(x, 9 + Math.round(1.5 * Math.sqrt(1 - e * e)), z, c.bread); }
  p.box(22, 6, 10, 24, 7, 12, c.lemon);
  return p;
}

function tursu(c: FC): Prop {
  const p = new Prop(16, 18, 14, S);
  // a glass of pink pickle juice and a dish of pickles: cucumber, carrot, cabbage, hot pepper
  p.cylY(5, 7, 3.2, 0, 12, c.glass);
  p.cylY(5, 7, 2.5, 1, 11, c.pickleJuice);
  p.cylY(5, 7, 2.5, 12, 12, 0);
  p.cylY(12, 7, 3.6, 0, 1, c.plate);
  p.box(10, 2, 5, 11, 3, 9, c.gherkin); p.box(13, 2, 6, 14, 2, 8, c.carrot); p.box(12, 3, 7, 13, 3, 9, c.cabbage); p.box(11, 4, 6, 11, 6, 6, c.pepper);
  return p;
}

function midye(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  p.cylY(11, 11, 10, 0, 0, c.plate);
  // stuffed mussels on the half shell, spiced rice inside, with lemon wedges
  const r = rng(71);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2, x = 11 + Math.cos(a) * 5.6, z = 11 + Math.sin(a) * 5.6;
    p.ellipsoid(x, 1.2, z, 2.2, 1.2, 3.2, c.mussel);
    p.ellipsoid(x, 2.2, z, 1.6, 1, 2.4, () => (r() < 0.2 ? c.musselIn : r() < 0.15 ? c.cinnamon : c.rice));
  }
  p.box(10, 1, 10, 12, 2, 12, c.lemon);
  return p;
}

function kokorec(c: FC): Prop {
  const p = new Prop(24, 12, 14, S);
  p.box(0, 0, 0, 23, 0, 13, c.paper);
  // chopped grilled lamb intestines with tomato, oregano and chilli in half a loaf
  for (let x = 2; x <= 21; x++) for (let z = 2; z <= 11; z++) {
    const e = Math.abs(z - 6.5) / 5;
    if (e > 1) continue;
    const h = Math.round(4 * Math.sqrt(1 - e * e));
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h || x === 2 || x === 21 ? c.bread : c.breadIn);
  }
  const r = rng(72);
  for (let x = 3; x <= 20; x++) for (let z = 4; z <= 9; z++) { p.set(x, 5, z, r() < 0.5 ? c.offal : c.offalHi); if (r() < 0.6) p.set(x, 6, z, r() < 0.2 ? c.tomato : r() < 0.2 ? c.chiliFlake : r() < 0.5 ? c.offal : c.offalHi); }
  return p;
}

function kestane(c: FC): Prop {
  const p = new Prop(16, 18, 14, S);
  // a paper bag of roast chestnuts, some split open
  p.box(1, 0, 1, 14, 10, 12, c.paper);
  p.box(2, 1, 2, 13, 10, 11, 0);
  p.box(1, 7, 1, 14, 7, 1, c.paperRed);
  const r = rng(73);
  for (let k = 0; k < 9; k++) {
    const x = 4 + (k % 3) * 3.5, z = 4 + Math.floor(k / 3) * 3, y = 9 + r() * 4;
    p.ellipsoid(x, y, z, 1.8, 1.4, 1.6, c.chestnut);
    if (k % 2 === 0) p.box(Math.round(x), Math.round(y + 1), Math.round(z), Math.round(x), Math.round(y + 1), Math.round(z) + 1, c.chestnutIn);
  }
  return p;
}

function misir(c: FC): Prop {
  const p = new Prop(10, 10, 28, S);
  // a cob of grilled corn in its peeled-back husk, salted
  for (let z = 4; z <= 25; z++) {
    const rr = 3.4 * Math.sin(Math.PI * (z - 2) / 26);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5);
      if (d <= rr) p.set(x, y, z, (x + y * 2 + z) % 5 === 0 ? c.cornDark : c.corn);
    }
  }
  for (let z = 0; z <= 5; z++) { p.box(3, 1, z, 6, 2, z, c.husk); p.box(1, 4, z, 2, 6, z, c.husk); p.box(7, 4, z, 8, 6, z, c.husk); }
  return p;
}

function dondurma(c: FC): Prop {
  const p = new Prop(14, 30, 14, S);
  // a cone of stretchy Maraş ice cream, beaten so long it stands up tall
  for (let y = 0; y < 13; y++) p.cylY(7, 7, 0.8 + y * 0.36, y, y, (x, yy, z) => ((x + yy + z) % 3 === 0 ? c.waferDark : c.wafer));
  p.cylY(7, 7, 5, 13, 22, (_x, y) => (y > 20 ? c.dondurma : c.dondurma));
  p.ellipsoid(7, 23, 7, 4.4, 3, 4.4, c.dondurma);
  p.box(6, 25, 6, 8, 26, 8, c.antep);
  return p;
}

function salep(c: FC): Prop {
  const p = new Prop(18, 14, 14, S);
  p.cylY(9, 7, 6.5, 0, 0, c.plate);
  // a cup of hot orchid-root milk, thick as custard, dusted with cinnamon
  p.cylY(9, 7, 4, 1, 9, c.ceramicWhite);
  p.cylY(9, 7, 3.2, 3, 9, c.salep);
  p.box(8, 9, 6, 10, 9, 8, c.cinnamon); p.set(7, 9, 7, c.cinnamon); p.set(11, 9, 6, c.cinnamon);
  p.box(13, 4, 7, 14, 4, 7, c.ceramicWhite); p.box(14, 5, 7, 14, 7, 7, c.ceramicWhite); p.box(13, 8, 7, 14, 8, 7, c.ceramicWhite);
  return p;
}

function doner(c: FC): Prop {
  const p = new Prop(26, 10, 16, S);
  p.box(0, 0, 0, 25, 0, 15, c.paper);
  // a dürüm: lavash rolled round shaved döner, tomato, onion and parsley, open at one end
  for (let x = 3; x <= 22; x++) for (let y = 1; y <= 8; y++) for (let z = 3; z <= 12; z++) {
    const d = Math.hypot(y - 4.5, z - 7.5);
    if (d > 4.4) continue;
    p.set(x, y, z, d > 3.4 ? c.lavash : x > 19 ? ((y + z) % 3 === 0 ? c.tomato : (y + z) % 3 === 1 ? c.parsley : c.donerHi) : c.doner);
  }
  for (let x = 3; x <= 12; x++) for (let y = 1; y <= 8; y++) for (let z = 3; z <= 12; z++) if (Math.hypot(y - 4.5, z - 7.5) <= 4.6 && Math.hypot(y - 4.5, z - 7.5) > 3.6) p.set(x, y, z, c.paper);
  return p;
}

function ayran(c: FC): Prop {
  const p = new Prop(14, 16, 14, S);
  // a hammered copper cup of ayran with its froth standing up
  p.cylY(7, 7, 4.4, 0, 11, (x, y, z) => ((x + y + z) % 4 === 0 ? c.copperDark : c.copper));
  p.cylY(7, 7, 3.6, 1, 11, c.ayran);
  p.ellipsoid(7, 11.5, 7, 3.6, 2, 3.6, c.ayran);
  p.box(11, 4, 6, 12, 4, 8, c.copperDark); p.box(12, 5, 6, 12, 8, 8, c.copperDark); p.box(11, 9, 6, 12, 9, 8, c.copperDark);
  return p;
}

function baklava(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  iznikPlate(p, c, 11, 11, 10.5);
  // diamonds of paper-thin layers glossy with syrup, crowned with ground pistachio
  for (const [x0, z0] of [[5, 5], [12, 5], [5, 12], [12, 12]] as const)
    for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) {
      if (Math.abs(x - 2.5) + Math.abs(z - 2.5) > 3.6) continue;
      for (let y = 1; y <= 4; y++) p.set(x0 + x, y, z0 + z, y === 4 ? (Math.abs(x - 2.5) + Math.abs(z - 2.5) < 1.6 ? c.antep : c.baklavaHi) : y % 2 ? c.baklava : c.antep);
    }
  return p;
}

function kunefe(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  // a copper pan: shredded kadayıf baked crisp round a layer of melting cheese, soaked in syrup, pistachio on top
  p.cylY(11, 11, 10, 0, 2, c.copper);
  p.cylY(11, 11, 9, 1, 2, 0);
  p.cylY(11, 11, 8.6, 1, 4, (x, y, z) => (y === 2 && Math.hypot(x + 0.5 - 11, z + 0.5 - 11) < 7 ? c.cheese : (x + z + y) % 3 ? c.kadayif : c.kadayifHi));
  p.cylY(11, 11, 3, 5, 5, c.antep);
  for (let k = 0; k < 10; k++) p.set(6 + (k * 7) % 11, 5, 6 + (k * 3) % 11, c.syrup);
  return p;
}

function hunkar(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  iznikPlate(p, c, 12, 12, 11.5);
  // the sultan's delight: a bed of smoky aubergine and cheese béchamel under a slow-cooked lamb stew
  p.cylY(12, 12, 9, 1, 2, c.begendi);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, d = k % 3 === 0 ? 0 : 3.4;
    p.ellipsoid(12 + Math.cos(a) * d, 3.5, 12 + Math.sin(a) * d, 1.8, 1.4, 1.8, c.lambStew);
  }
  p.cylY(12, 12, 4.6, 3, 3, (x, _y, z) => (p.get(x, 3, z) ? c.lambStew : c.stewSauce));
  p.box(11, 5, 11, 12, 5, 12, c.parsley);
  return p;
}

function manti(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  // a deep plate of tiny lamb dumplings under garlic yoghurt and red pepper butter, dried mint
  for (let y = 0; y <= 3; y++) p.cylY(11, 11, 7.5 + y * 0.9, y, y, c.ceramicWhite);
  p.cylY(11, 11, 9.6, 1, 3, 0);
  const r = rng(74);
  for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, d = r() * 7; p.box(Math.round(11 + Math.cos(a) * d), 1, Math.round(11 + Math.sin(a) * d), Math.round(11 + Math.cos(a) * d) + 1, 2, Math.round(11 + Math.sin(a) * d), c.manti); }
  p.cylY(11, 11, 5.5, 3, 3, c.yoghurt);
  for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = r() * 6; p.set(Math.round(11 + Math.cos(a) * d), 4, Math.round(11 + Math.sin(a) * d), k % 3 === 0 ? c.mint : c.redButter); }
  return p;
}
