// The same finish on every face of a building, not just the one facing the street: floor bands, windows with
// sills, a few stains, AC units, drainpipes, meters and back doors on the sides and backs of buildings and on
// the plain blocks that fill the middles of the old district.
//
// Everything is voxels baked into the chunk meshes. It repaints only voxels that still hold the plain wall
// colour, and only ever sticks things out into cells that are empty, so it never cuts into a neighbour, a room
// or a sign, and every worker strip paints its own cells the same way.
import { hash3 } from './grid';
import { G } from './layout';
import type { Builder, Lot } from './tokyo';

/** A wall face in builder voxel coordinates: cell t along it is (x + dx t, z + dz t), outside is (+nx, +nz). */
export interface Face { x: number; z: number; dx: number; dz: number; nx: number; nz: number; len: number }

export interface FaceStyle {
  /** Wall rows 0..h-1 above the street. */
  h: number;
  /** Ground floor height and upper floor height (voxels). */
  gh: number;
  fh: number;
  wall: number;
  trim: number;
  look: 'plain' | 'wood' | 'kura';
  seed: number;
  /** Ground floor: 0 bare, 1 small frosted windows and a meter, 2 a back door as well. */
  ground: 0 | 1 | 2;
  pipe: boolean;
  ac: boolean;
}

/** One face of a lot: 'l'/'r' are the side walls (a = 0 / w - 1), 'b' the back wall. Corners are left to the front. */
export function lotFace(lot: Lot, which: 'f' | 'l' | 'r' | 'b'): Face {
  const w = lot.width, dep = lot.depth;
  const [a0, d0, da, dd, oa, od, len] = which === 'f' ? [0, 0, 1, 0, 0, -1, w] : which === 'b' ? [w - 1, dep - 1, -1, 0, 0, 1, w] : which === 'l' ? [0, 0, 0, 1, -1, 0, dep] : [w - 1, dep - 1, 0, -1, 1, 0, dep];
  const [x, z] = lot.xz(a0, d0), [x1, z1] = lot.xz(a0 + da, d0 + dd), [xo, zo] = lot.xz(a0 + oa, d0 + od);
  return { x, z, dx: x1 - x, dz: z1 - z, nx: xo - x, nz: zo - z, len };
}

/** The four faces of a plain box (inclusive builder coords), each read left to right from outside. */
export function boxFaces(x0: number, z0: number, x1: number, z1: number): Face[] {
  return [
    { x: x0, z: z1, dx: 1, dz: 0, nx: 0, nz: 1, len: x1 - x0 + 1 },
    { x: x1, z: z0, dx: -1, dz: 0, nx: 0, nz: -1, len: x1 - x0 + 1 },
    { x: x1, z: z1, dx: 0, dz: -1, nx: 1, nz: 0, len: z1 - z0 + 1 },
    { x: x0, z: z0, dx: 0, dz: 1, nx: -1, nz: 0, len: z1 - z0 + 1 },
  ];
}

export function dressFace(b: Builder, f: Face, s: FaceStyle): void {
  const g = b.grid, c = b.c;
  if (f.len < 6 || s.h < 6) return;
  const X = (t: number) => f.x + f.dx * t, Z = (t: number) => f.z + f.dz * t;
  const own = (t: number, y: number) => t >= 0 && t < f.len && y < s.h && g.get(X(t), G + y, Z(t)) === s.wall;
  const paint = (t: number, y: number, v: number) => { if (own(t, y)) g.set(X(t), G + y, Z(t), v); };
  const open = (t: number, y: number) => g.get(X(t) + f.nx, G + y, Z(t) + f.nz) === 0 && g.get(X(t), G + y, Z(t)) !== 0;
  const stick = (t: number, y: number, v: number) => { if (open(t, y)) g.set(X(t) + f.nx, G + y, Z(t) + f.nz, v); };
  const H = (t: number, y: number, k: number) => hash3(X(t) * 3 + k, y, Z(t) * 5 + s.seed);
  const plain = s.look === 'plain';

  // floor bands and the coping line run all the way round
  if (s.trim !== s.wall) {
    for (let y = s.gh - 1; y < s.h - 1; y += s.fh) for (let t = 0; t < f.len; t++) paint(t, y, s.trim);
    for (let t = 0; t < f.len; t++) paint(t, s.h - 1, s.trim);
  }

  // upper floors: windows with a sill and lintel, a stain under some, an AC unit beside some
  for (let base = s.gh; base + 9 <= s.h; base += s.fh) {
    for (let t = 3; t + 5 < f.len; t += 7) {
      const h = H(t, base, 1);
      if (h < 0.28) continue;
      let ok = true;
      for (let y = base + 3; y <= base + 7 && ok; y++) for (let u = t; u <= t + 2; u++) if (!own(u, y)) ok = false;
      if (!ok) continue;
      const lit = h > 0.72;
      for (let y = base + 3; y <= base + 7; y++)
        for (let u = t; u <= t + 2; u++)
          paint(u, y, s.look === 'wood' ? ((u - t) % 2 ? c.woodDark : lit ? c.glassLit : c.plaster) : s.look === 'kura' ? ((u - t) % 2 ? c.kuraBase : lit ? c.glassLit : c.glassDark) : lit ? c.glassLit : y === base + 7 ? c.glassDark : c.glass);
      if (plain) {
        for (let u = t; u <= t + 2; u++) { paint(u, base + 8, s.trim); stick(u, base + 2, c.trim); }
        if (h > 0.86) { paint(t + 1, base + 2, c.stain); paint(t + 1, base + 1, c.stain); }
      } else for (let u = t - 1; u <= t + 3; u++) paint(u, base + 8, s.look === 'kura' ? c.kuraBase : c.woodDark);
      if (s.ac && plain && H(t, base, 2) < 0.4 && t + 6 < f.len) {
        let free = true;
        for (let u = t + 4; u <= t + 6 && free; u++) for (let y = base + 3; y <= base + 4; y++) if (!open(u, y)) free = false;
        if (free) for (let u = t + 4; u <= t + 6; u++) { stick(u, base + 4, c.tileWhite); stick(u, base + 3, u === t + 5 ? c.grate : c.tileWhite); }
      }
    }
  }

  // ground floor: frosted windows, a meter, a back door with its lamp
  if (s.ground) {
    let door = -1;
    if (s.ground === 2 && f.len >= 10) {
      const t = 2 + Math.floor(H(0, 0, 3) * (f.len - 8));
      let ok = true;
      for (let y = 0; y <= 8 && ok; y++) for (let u = t; u <= t + 2; u++) if (!own(u, y)) ok = false;
      if (ok) {
        door = t;
        for (let y = 0; y <= 7; y++) for (let u = t; u <= t + 2; u++) paint(u, y, plain ? c.steel : c.woodMid);
        paint(t + 2, 4, c.trimDark);
        for (let u = t; u <= t + 2; u++) paint(u, 8, s.trim === s.wall ? c.woodDark : s.trim);
        stick(t + 1, 9, c.signLit);
        if (plain) for (let u = t - 1; u <= t + 3; u++) stick(u, 10, c.concrete); // a little rain hood
      }
    }
    for (let t = 4; t + 4 < f.len; t += 9) {
      if (door >= 0 && t + 2 >= door - 1 && t <= door + 4) continue;
      if (H(t, 0, 4) < 0.45) continue;
      let ok = true;
      for (let y = 4; y <= 7 && ok; y++) for (let u = t; u <= t + 1; u++) if (!own(u, y)) ok = false;
      if (!ok) continue;
      for (let y = 4; y <= 6; y++) for (let u = t; u <= t + 1; u++) paint(u, y, s.look === 'wood' ? (u === t ? c.woodDark : c.shoji) : c.shoji);
      for (let u = t; u <= t + 1; u++) paint(u, 7, s.look === 'plain' ? s.trim : c.woodDark);
    }
    if (plain && H(1, 0, 5) < 0.7) for (let y = 4; y <= 5; y++) for (let u = f.len - 3; u <= f.len - 2; u++) stick(u, y, y === 5 && u === f.len - 3 ? c.signLit : c.steel);
  }

  // rain streaks running down from the coping
  if (plain) for (let t = 1; t + 1 < f.len; t++) {
    const h = H(t, s.h, 6);
    if (h < 0.07) for (let y = s.h - 2; y >= s.h - (h < 0.03 ? 5 : 3); y--) paint(t, y, c.stain);
  }

  // one drainpipe down the near end
  if (s.pipe && f.len >= 8) {
    const t = 1;
    let ok = true;
    for (let y = 0; y < s.h && ok; y++) if (!open(t, y)) ok = false;
    if (ok) for (let y = 0; y < s.h; y++) stick(t, y, c.pipe);
  }
}

/** Sides and back of a lot building, matched to its front. */
export function wrapLot(lot: Lot, s: Omit<FaceStyle, 'ground' | 'pipe' | 'ac'> & { pipe: boolean }): void {
  const b = lot.b;
  dressFace(b, lotFace(lot, 'b'), { ...s, ground: 2, ac: true });
  dressFace(b, lotFace(lot, 'l'), { ...s, ground: 1, pipe: false, ac: true, seed: s.seed + 1 });
  dressFace(b, lotFace(lot, 'r'), { ...s, ground: 1, pipe: s.pipe, ac: true, seed: s.seed + 2 });
}

/** A plain filler block with the same finish as the buildings round it, or a boundary wall with a coping and stains. */
export function dressBlock(b: Builder, x0: number, z0: number, x1: number, z1: number, h: number, wall: number, seed: number, kind: 'block' | 'wall' = 'block'): void {
  const block = kind === 'block';
  boxFaces(x0, z0, x1, z1).forEach((f, i) => dressFace(b, f, {
    h, gh: 12, fh: 12, wall, trim: block ? b.c.trim : b.c.concreteDark, look: 'plain', seed: seed * 4 + i,
    ground: block ? (i % 2 ? 1 : 2) : 0, pipe: block && i < 2, ac: block,
  }));
  if (block) boxFaces(x0, z0, x1, z1).forEach((f, i) => skin(b, f, h, wall, seed * 4 + i + 1));
}

/**
 * The wear of the city on a wall, over every face of a lot once its windows are in: grime run down from the sills
 * and the coping, and on bare concrete the grid of form-tie holes and panel joints Tokyo's newer blocks show.
 * Repaints only cells still in the wall's own colour.
 */
export function skin(b: Builder, f: Face, h: number, wall: number, seed: number): void {
  const g = b.grid, c = b.c;
  if (f.len < 4 || h < 8) return;
  const X = (t: number) => f.x + f.dx * t, Z = (t: number) => f.z + f.dz * t;
  const at = (t: number, y: number) => g.get(X(t), G + y, Z(t));
  const paint = (t: number, y: number, v: number) => { if (at(t, y) === wall) g.set(X(t), G + y, Z(t), v); };
  const concrete = wall === c.concreteWall;
  if (concrete) {
    // panels 6 voxels wide and tall, a joint between them, two tie holes on each
    for (let t = 0; t < f.len; t++) for (let y = 1; y < h - 1; y++) {
      const u = (X(t) + Z(t)) % 6, v = y % 6;
      if (u === 0 && hash3(t, y >> 3, seed) < 0.6) paint(t, y, c.tieHole);
      else if ((u === 2 || u === 4) && (v === 2 || v === 4)) paint(t, y, c.tieHole);
    }
  }
  for (let t = 0; t < f.len; t++) {
    // under an opening (a window's sill, a recess, a hood), now and then a grey run of grime
    for (let y = 2; y < h - 1; y++) {
      if (at(t, y) !== wall) continue;
      const above = at(t, y + 1);
      if (above !== 0 && above !== c.glass && above !== c.glassLit && above !== c.glassDark && above !== c.shoji) continue;
      const k = hash3(X(t) * 7 + y, seed, Z(t) * 3);
      if (k > 0.22) continue;
      const len = 1 + Math.floor(k * 18);
      for (let yy = y; yy > Math.max(0, y - len); yy--) paint(t, yy, k < 0.05 ? c.rust : c.grime);
    }
    // and down from the coping
    const k = hash3(X(t), h + seed, Z(t) * 5);
    if (k < 0.06) for (let y = h - 2; y >= h - 3 - Math.floor(k * 80); y--) paint(t, y, c.grime);
  }
}
