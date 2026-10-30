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
  };
}

export type FoodId =
  | 'takoyaki' | 'monjayaki' | 'ningyoyaki' | 'dango' | 'taiyaki' | 'dorayaki'
  | 'yakitori' | 'karaage' | 'ramen' | 'gyoza' | 'nigiri' | 'tamagoyaki';

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
