import { Grid } from './grid';
import type { Palette } from './palette';
import type { CharModel, Look } from './characters';
import { PART, CHAR_FINE } from './charparts';

/** Palette entries of the coarse person that the fine pass recolours or reuses. */
export interface Ink {
  skin: number; hair: number; top: number; accent: number; bottom: number; shoes: number;
  dark: number; white: number; blush: number; mouth: number; moustache: number;
}

const mix = (a: number, b: number, t: number) => {
  let o = 0;
  for (const s of [16, 8, 0]) o |= Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t) << s;
  return o;
};
const luma = (c: number) => (0.3 * ((c >> 16) & 255) + 0.59 * ((c >> 8) & 255) + 0.11 * (c & 255)) / 255;

/**
 * The close-up body of a person: the coarse model at twice the resolution (half-size voxels, so the same
 * skeleton, pivots and poses), its edges rounded off one fine voxel, and finished with the small things a
 * coarse voxel cannot hold: shiny eyes, soft brows, a smile, shaped ears, bangs and hair strands, shoe soles
 * and laces, belts, hems, cuffs, collars, zips, buttons and pockets, pleats, a pompom on a beanie.
 * It stays a chunky toy figure on purpose: no nose, no fingers, no teeth, nothing that reads as real skin.
 */
export function refinePerson(coarse: CharModel, look: Look, ink: Ink): CharModel {
  const cg = coarse.grid, cp = coarse.parts, pal: Palette = coarse.pal;
  const W = cg.sx * 2, H = cg.sy * 2, D = cg.sz * 2, WD = W * D;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D);
  const at = (x: number, y: number, z: number) => y * WD + z * W + x;
  const inb = (x: number, y: number, z: number) => x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < D;
  const get = (x: number, y: number, z: number) => grid.get(x, y, z);
  const partAt = (x: number, y: number, z: number) => parts[at(x, y, z)];
  const put = (x: number, y: number, z: number, c: number, part: number) => {
    if (!inb(x, y, z)) return;
    grid.set(x, y, z, c);
    parts[at(x, y, z)] = part;
  };
  /** Recolours a voxel that is there (keeping its part); `only` limits it to voxels of that colour. */
  const paint = (x: number, y: number, z: number, c: number, only = -1) => {
    const v = get(x, y, z);
    if (v && (only < 0 || v === only)) grid.set(x, y, z, c);
  };
  const clear = (x: number, y: number, z: number) => { if (inb(x, y, z)) { grid.set(x, y, z, 0); parts[at(x, y, z)] = 0; } };
  const C = (hex: number, vary = 0.03) => pal.add(hex, { vary });
  const exposed = (x: number, y: number, z: number) =>
    !get(x - 1, y, z) || !get(x + 1, y, z) || !get(x, y - 1, z) || !get(x, y + 1, z) || !get(x, y, z - 1) || !get(x, y, z + 1);

  // 1. every coarse voxel becomes 2 x 2 x 2 fine ones
  for (let y = 0; y < cg.sy; y++) for (let z = 0; z < cg.sz; z++) for (let x = 0; x < cg.sx; x++) {
    const c = cg.get(x, y, z);
    if (!c) continue;
    const p = cp[y * cg.sx * cg.sz + z * cg.sx + x];
    for (let k = 0; k < 8; k++) put(x * 2 + (k & 1), y * 2 + ((k >> 1) & 1), z * 2 + (k >> 2), c, p);
  }

  // 2. round the edges: drop the fine voxel on every outside edge of a part that is at least three fine voxels
  // thick both ways (so ears, brims and straps keep their shape). Soles stay flat on the ground.
  {
    const data = grid.data, ST = [1, WD, W], DIM = [W, H, D], c = [0, 0, 0];
    const drop: number[] = [];
    // a step of `s` along axis `ax` from voxel i (at coordinate c[ax]) lands on a voxel of part p, k steps in
    const solidAt = (i: number, ax: number, s: number) => { const q = c[ax] + s; return q >= 0 && q < DIM[ax] && data[i + s * ST[ax]] !== 0; };
    const partOf = (i: number, ax: number, s: number, p: number) => { const q = c[ax] + s; return q >= 0 && q < DIM[ax] && data[i + s * ST[ax]] !== 0 && parts[i + s * ST[ax]] === p; };
    for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = at(x, y, z);
      if (!data[i]) continue;
      const p = parts[i];
      c[0] = x; c[1] = y; c[2] = z;
      let gone = false;
      for (let a = 0; a < 2 && !gone; a++) for (let b = a + 1; b < 3 && !gone; b++) {
        for (let k = 0; k < 4 && !gone; k++) {
          const sa = k & 1 ? 1 : -1, sb = k & 2 ? 1 : -1;
          if (y <= 1 && ((a === 1 && sa < 0) || (b === 1 && sb < 0))) continue; // the sole stays flat
          if (solidAt(i, a, sa) || solidAt(i, b, sb)) continue;
          gone = partOf(i, a, -sa, p) && partOf(i, a, -2 * sa, p) && partOf(i, b, -sb, p) && partOf(i, b, -2 * sb, p);
        }
      }
      if (gone) drop.push(i);
    }
    for (const i of drop) { data[i] = 0; parts[i] = 0; }
  }

  // fine coordinates of the coarse layout (coarse x2): head x4..15, y30..43, z2..13 (face at z13);
  // torso x4..15, y16..29, z4..11; arms x0..3 / x16..19, z6..9; thighs y8..15, shins y4..7, shoes y0..3
  const FZ = 13;
  const hs = look.hairStyle;
  const scarf = look.hat === 'scarf';
  const fringe = hs === 'bob' || hs === 'long';

  // 3. the face, redrawn at the finer grain
  for (let y = 30; y <= 41; y++) for (let z = 12; z <= 13; z++) for (let x = 4; x <= 15; x++) {
    const v = get(x, y, z);
    if (v === ink.dark || v === ink.white || v === ink.blush || v === ink.mouth || v === ink.moustache) grid.set(x, y, z, ink.skin);
  }
  const eye = ink.dark, shine = ink.white;
  for (const ex of [6, 12]) {
    for (let y = 35; y <= 37; y++) for (let x = ex; x <= ex + 1; x++) paint(x, y, FZ, eye);
    paint(ex + 1, 37, FZ, shine); // the catch-light that keeps them friendly
  }
  if (!fringe) {
    // soft brows, halfway between skin and hair so they never look stern
    const brow = C(mix(look.skin, look.hair, 0.6), 0.02);
    for (const bx of [6, 12]) { paint(bx, 39, FZ, brow, ink.skin); paint(bx + 1, 39, FZ, brow, ink.skin); }
  }
  if (look.glasses) {
    // warm tortoiseshell frames, so the eyes still read inside them
    const frame = C(0x6e4127, 0.03);
    for (const gx of [5, 11]) {
      for (let x = gx; x <= gx + 3; x++) { paint(x, 34, FZ, frame); paint(x, 38, FZ, frame); }
      for (let y = 35; y <= 37; y++) { paint(gx, y, FZ, frame); paint(gx + 3, y, FZ, frame); }
    }
    paint(9, 37, FZ, frame); paint(10, 37, FZ, frame);
    for (let z = 9; z <= 12; z++) { paint(4, 37, z, frame, ink.skin); paint(15, 37, z, frame, ink.skin); }
  } else {
    const cheek = C(mix(look.skin, 0xf09a90, 0.55), 0.02);
    paint(5, 34, FZ, cheek); paint(6, 34, FZ, cheek); paint(13, 34, FZ, cheek); paint(14, 34, FZ, cheek);
  }
  // a small closed smile, corners up
  paint(9, 32, FZ, ink.mouth); paint(10, 32, FZ, ink.mouth);
  if (look.moustache) {
    const mo = ink.moustache;
    for (let x = 8; x <= 11; x++) paint(x, 34, FZ, mo);
    for (let x = 7; x <= 12; x++) paint(x, 33, FZ, mo);
  } else { paint(8, 33, FZ, ink.mouth); paint(11, 33, FZ, ink.mouth); }
  // 2040's face gear goes over the features just drawn
  if (look.tattoo !== undefined) {
    const t = pal.add(look.tattoo, { emit: 0.5 });
    for (let y = 33; y <= 40; y++) paint(5, y, FZ, t);
    paint(6, 40, FZ, t); paint(7, 40, FZ, t); paint(4, 36, FZ, t); paint(6, 33, FZ, t);
  }
  if (look.visor !== undefined) {
    const v = pal.add(look.visor, { emit: 0.9 }), vb = pal.add(mix(look.visor, 0xffffff, 0.45), { emit: 1 });
    for (let y = 35; y <= 38; y++) for (let x = 4; x <= 15; x++) paint(x, y, FZ, y === 37 ? vb : v);
  }
  if (look.mask) {
    const plate = pal.add(0x22252c, { vary: 0.03 }), slat = pal.add(0x3a3e48, { vary: 0.02 });
    for (let y = 30; y <= 34; y++) for (let x = 5; x <= 14; x++) paint(x, y, FZ, y === 32 ? slat : plate);
  }

  // ears: one fine voxel thin, a little taller than wide, with a warmer inside
  if (get(2, 36, 6) === ink.skin) {
    const inner = C(mix(look.skin, 0xd9826e, 0.3), 0.02);
    for (const [out, ear] of [[2, 3], [17, 16]] as const) {
      for (let y = 36; y <= 37; y++) for (let z = 6; z <= 7; z++) clear(out, y, z);
      for (let y = 35; y <= 38; y++) for (let z = 6; z <= 8; z++) put(ear, y, z, ink.skin, PART.head);
      put(ear, 36, 7, inner, PART.head); put(ear, 37, 7, inner, PART.head);
    }
  }

  // 4. hair: bangs along the hairline, strands down the back and sides, a tie on ponytails and buns
  if (hs !== 'bald' && !scarf) {
    const strand = C(mix(look.hair, 0x000000, 0.22), 0.04);
    const line = fringe ? 40 : 42; // lowest row of hair across the forehead
    const tufts = fringe ? [5, 6, 8, 9, 11, 13, 14] : [5, 6, 7, 10, 13, 14];
    if (get(9, line, FZ) === ink.hair) for (const x of tufts) paint(x, line - 1, FZ, ink.hair, ink.skin);
    for (let y = 24; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      if (get(x, y, z) !== ink.hair || !exposed(x, y, z)) continue;
      if (get(x, y + 1, z) && z < FZ && (x + z) % 3 === 0 && y < 44) grid.set(x, y, z, strand);
    }
    const tie = C(look.hatColor ?? look.accent, 0.02);
    if (hs === 'ponytail') for (let x = 8; x <= 11; x++) for (let z = 0; z <= 1; z++) paint(x, 39, z, tie);
    if (hs === 'bun') for (let x = 8; x <= 11; x++) for (let z = 4; z <= 7; z++) paint(x, 46, z, tie);
  }

  // 5. shoes: a contrasting sole and two laces on each toe
  {
    const L = luma(look.shoes);
    const sole = C(L < 0.25 ? 0xefebe2 : L > 0.6 ? 0xb9b2a4 : 0x3a3330, 0.02);
    const lace = C(L > 0.6 ? 0x6a6560 : 0xf4f1ea, 0.01);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) paint(x, 0, z, sole, ink.shoes);
    for (const lx of [6, 12]) { paint(lx, 3, 12, lace, ink.shoes); paint(lx + 1, 3, 12, lace, ink.shoes); paint(lx, 3, 13, lace, ink.shoes); paint(lx + 1, 3, 13, lace, ink.shoes); }
  }

  // 6. legs: trouser cuffs and a belt, or a pleated skirt
  const legs = look.topStyle !== 'yukata';
  if (legs && look.skirt) {
    const pleat = C(mix(look.bottom, 0x000000, 0.14), 0.03);
    for (let y = 8; y <= 15; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      if (get(x, y, z) === ink.bottom && x % 2 === 0 && exposed(x, y, z)) grid.set(x, y, z, pleat);
    }
  } else if (legs) {
    const cuff = C(mix(look.bottom, 0x000000, 0.16), 0.03);
    const hem = look.shorts ? 10 : 4;
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) paint(x, hem, z, cuff, ink.bottom);
    const belt = C(0x4a3426, 0.03), buckle = C(0xd9b45a, 0.02);
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) paint(x, 15, z, belt, ink.bottom);
    paint(9, 15, 11, buckle, belt); paint(10, 15, 11, buckle, belt);
  }

  // 7. tops
  const topDark = C(mix(look.top, 0x000000, 0.15), 0.03);
  const accDark = C(mix(look.accent, 0x000000, 0.18), 0.03);
  const front = 11; // torso front
  switch (look.topStyle) {
    case 'jacket': {
      const zip = C(0xa8a8ae, 0.02);
      for (let y = 17; y <= 28; y++) { paint(8, y, front, zip, ink.top); paint(11, y, front, zip, ink.top); }
      for (const px of [5, 13]) for (let y = 18; y <= 19; y++) { paint(px, y, front, accDark); paint(px + 1, y, front, accDark); }
      for (let z = 0; z < D; z++) for (const x of [0, 1, 2, 3, 16, 17, 18, 19]) paint(x, 20, z, accDark, ink.accent);
      break;
    }
    case 'suit': {
      const suit = get(4, 20, front), tie = C(0xb3302a, 0.02), knot = C(0x8f2420, 0.02);
      for (let y = 17; y <= 29; y++) for (let x = 8; x <= 11; x++) {
        const mid = x === 9 || x === 10;
        let c = suit;
        if (y >= 26 || (y >= 21 && mid)) c = ink.white;
        if (mid && y >= 19 && y <= 26) c = tie;
        if (mid && y >= 27 && y <= 28) c = knot;
        paint(x, y, front, c);
      }
      paint(13, 25, front, ink.white); paint(14, 25, front, ink.white); // pocket square
      paint(10, 17, front, ink.dark); // a button
      break;
    }
    case 'sailor': {
      // the red scarf tied in a bow: two wings narrowing into a darker knot
      const navy = get(6, 22, front), red = get(9, 23, front), knot = C(0x9a2a22, 0.02);
      for (let y = 22; y <= 25; y++) for (let x = 7; x <= 12; x++) {
        const mid = y === 23 || y === 24;
        paint(x, y, front, x === 7 || x === 12 || (mid && (x === 8 || x === 11)) ? red : mid ? knot : navy);
      }
      break;
    }
    case 'apron': {
      for (let x = 8; x <= 11; x++) for (let y = 26; y <= 27; y++) paint(x, y, front, ink.top, ink.accent);
      for (const sx of [6, 7, 12, 13]) for (let y = 26; y <= 29; y++) put(sx, y, front, ink.accent, PART.body);
      for (let x = 8; x <= 11; x++) for (let y = 18; y <= 19; y++) paint(x, y, 13, accDark);
      break;
    }
    case 'yukata': {
      // the collar crosses left over right in a V, small flowers on the cloth
      const collar = get(8, 24, front);
      for (let y = 22; y <= 29; y++) for (let x = 7; x <= 12; x++) paint(x, y, front, ink.top, collar);
      for (let y = 22; y <= 29; y++) {
        const k = Math.floor((y - 22) / 3);
        paint(9 - k, y, front, collar); paint(10 + k, y, front, collar);
        for (let x = 10 - k; x <= 9 + k; x++) if (k >= 1 && y >= 26) paint(x, y, front, ink.skin);
      }
      const flower = C(mix(look.accent, 0xffffff, 0.35), 0.03);
      for (let y = 4; y <= 29; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
        if (get(x, y, z) === ink.top && (x * 7 + y * 3 + z * 5) % 13 === 0 && exposed(x, y, z)) grid.set(x, y, z, flower);
      }
      break;
    }
    case 'vest':
      for (const y of [18, 21, 24]) paint(7, y, front, ink.dark, ink.accent);
      break;
    case 'cardigan':
      for (let y = 18; y <= 27; y++) for (let x = 6; x <= 7; x++) paint(x, y, front, ink.accent, ink.white);
      for (const y of [19, 22, 25]) paint(7, y, front, ink.white);
      for (let z = 0; z < D; z++) for (const x of [0, 1, 2, 3, 16, 17, 18, 19]) paint(x, 20, z, accDark, ink.accent);
      break;
    case 'happi':
      break;
    default: {
      // tee: a round neck, a hem, sleeve bands
      for (let x = 8; x <= 11; x++) paint(x, 29, front, ink.skin, ink.top);
      paint(9, 28, front, ink.skin, ink.top); paint(10, 28, front, ink.skin, ink.top);
      for (let z = 0; z < D; z++) for (let x = 4; x <= 15; x++) paint(x, 16, z, topDark, ink.top);
      for (let z = 0; z < D; z++) for (const x of [0, 1, 2, 3, 16, 17, 18, 19]) paint(x, 26, z, topDark, ink.top);
    }
  }

  // 8. hats
  const hc = look.hatColor ?? 0xf2efe7;
  switch (look.hat) {
    case 'cap':
      put(9, 48, 7, C(mix(hc, 0x000000, 0.2)), PART.head); put(10, 48, 7, C(mix(hc, 0x000000, 0.2)), PART.head);
      put(9, 48, 8, C(mix(hc, 0x000000, 0.2)), PART.head); put(10, 48, 8, C(mix(hc, 0x000000, 0.2)), PART.head);
      break;
    case 'beanie': {
      const knit = get(9, 46, 7), rib = C(mix(hc, 0x000000, 0.14)), pom = C(mix(hc, 0xffffff, 0.45), 0.05);
      for (let y = 42; y <= 43; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if ((x + z) % 2 === 0) paint(x, y, z, rib, knit);
      for (let y = 48; y <= 49; y++) for (let z = 6; z <= 9; z++) for (let x = 8; x <= 11; x++) {
        if ((x === 8 || x === 11) && (z === 6 || z === 9)) continue;
        put(x, y, z, pom, PART.head);
      }
      break;
    }
    case 'bucket':
      for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) paint(x, 46, z, C(mix(hc, 0x000000, 0.18)));
      break;
    case 'straw': {
      const straw = get(9, 49, 7), weave = C(mix(0xe6c98a, 0x8a6a3a, 0.22), 0.06);
      for (let y = 44; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (get(x, y, z) === straw && (x + y + z) % 2 === 0) grid.set(x, y, z, weave);
      break;
    }
    case 'chef': {
      const white = ink.white, fold = C(0xe2ded5, 0.02);
      for (let y = 46; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (get(x, y, z) === white && x % 3 === 0 && exposed(x, y, z)) grid.set(x, y, z, fold);
      break;
    }
    case 'scarf': {
      const scarfC = get(9, 46, 7), dot = C(mix(hc, 0xffffff, 0.4), 0.03);
      for (let y = 30; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) if (get(x, y, z) === scarfC && (x * 3 + y * 5 + z) % 7 === 0 && exposed(x, y, z)) grid.set(x, y, z, dot);
      break;
    }
  }

  // 9. a backpack: straps over the shoulders and down the chest, a front pocket and a zip
  if (look.backpack !== undefined) {
    const bp = get(9, 20, 0);
    if (bp) {
      const strap = C(mix(look.backpack, 0x000000, 0.3), 0.03), zip = C(0xd8d4cc, 0.02);
      for (const sx of [6, 13]) {
        for (let y = 17; y <= 29; y++) { paint(sx, y, front, strap, ink.top); paint(sx, y, front, strap, ink.accent); }
      }
      for (let y = 17; y <= 21; y++) for (let x = 7; x <= 12; x++) paint(x, y, 0, strap, bp);
      for (let x = 7; x <= 12; x++) paint(x, 23, 0, zip, bp);
    }
  }

  // 10. joint caps at the finer grain: the knee cap is the thigh's bottom four rows, the elbow's two
  const caps = { grid: new Grid(W, H, D), parts: new Uint8Array(W * H * D) };
  const cap = (y0: number, from: number, to: number, rows: number) => {
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const c = get(x, y0, z);
      if (!c || partAt(x, y0, z) !== from) continue;
      for (let k = 0; k < rows; k++) {
        if (!get(x, y0 + k, z) || partAt(x, y0 + k, z) !== from) break; // stays hidden inside the limb at rest
        caps.grid.set(x, y0 + k, z, c);
        caps.parts[at(x, y0 + k, z)] = to;
      }
    }
  };
  cap(8, PART.legL, PART.shinL, 4); cap(8, PART.legR, PART.shinR, 4);
  cap(24, PART.armL, PART.foreL, 2); cap(24, PART.armR, PART.foreR, 2);

  return { ...coarse, grid, parts, scale: CHAR_FINE, caps };
}
