import { Palette } from './palette';
import { Prop } from './props';
import type { Shape } from '../data/souvenirs';

/**
 * Little voxel models of the souvenirs, for the shop shelves and the bag (rendered into icons by ui/icons.ts).
 * Each shape is built on a 24 x 26 x 24 grid from a few primitives: solids of revolution (bowls, bottles, lamps),
 * boxes, and discs standing up to face the camera (beads, tiles, prints). `cols` are the souvenir's own colours.
 */
const N = 24, H = 26, C = 12;
const BRASS = 0xc8a050, WOOD = 0x8a5a3a, DARK = 0x2b2420, SKIN = 0xf6dcc0, CREAM = 0xf0e6d0;

const hash = (x: number, y: number, z: number) => {
  let h = Math.imul(x * 374761393 + y * 668265263 + z * 2147483647, 1274126177);
  h ^= h >>> 13; h = Math.imul(h, 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

class M {
  p = new Prop(N, H, N, 0.0625);
  private ids = new Map<string, number>();
  constructor(private pal: Palette) {}
  c(hex: number, emit = 0): number {
    const k = `${hex}|${emit}`;
    let i = this.ids.get(k);
    if (i === undefined) { i = this.pal.add(hex, { vary: 0.035, emit }); this.ids.set(k, i); }
    return i;
  }
  set(x: number, y: number, z: number, hex: number, emit = 0) { this.p.set(x, y, z, this.c(hex, emit)); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, col: number | ((x: number, y: number, z: number) => number)) {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const v = typeof col === 'number' ? col : col(x, y, z);
      if (v >= 0) this.set(x, y, z, v);
    }
  }
  /**
   * A solid of revolution round the vertical axis at (cx, cz): `r(y)` its radius at each layer, `col` the colour of
   * each voxel (given its distance d from the axis and angle a); a shell keeps only the outer `shell` voxels above
   * `floor` (an open bowl or cup).
   */
  lathe(y0: number, y1: number, r: (y: number) => number, col: (y: number, d: number, a: number, x: number, z: number) => number, o: { shell?: number; floor?: number; cx?: number; cz?: number; emit?: number } = {}) {
    const cx = o.cx ?? C, cz = o.cz ?? C;
    for (let y = y0; y <= y1; y++) {
      const R = r(y);
      if (R <= 0) continue;
      for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
        const dx = x + 0.5 - cx, dz = z + 0.5 - cz, d = Math.hypot(dx, dz);
        if (d > R) continue;
        if (o.shell && y > (o.floor ?? y0) && d < R - o.shell) continue;
        const v = col(y, d, Math.atan2(dz, dx), x, z);
        if (v >= 0) this.set(x, y, z, v, o.emit ?? 0);
      }
    }
  }
  /** A disc standing up in the x-y plane, facing +z (towards the camera), z0..z1 thick. */
  disc(cx: number, cy: number, z0: number, z1: number, r: number, col: (d: number, dx: number, dy: number) => number, emit = 0) {
    for (let y = 0; y < H; y++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
      if (d > r) continue;
      const v = col(d, dx, dy);
      if (v >= 0) for (let z = z0; z <= z1; z++) this.set(x, y, z, v, emit);
    }
  }
  sphere(cx: number, cy: number, cz: number, r: number, col: (x: number, y: number, z: number, dx: number, dy: number, dz: number) => number, emit = 0) {
    for (let y = 0; y < H; y++) for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
      if (dx * dx + dy * dy + dz * dz > r * r) continue;
      const v = col(x, y, z, dx, dy, dz);
      if (v >= 0) this.set(x, y, z, v, emit);
    }
  }
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * Math.max(0, Math.min(1, t));
/** A profile through points [y, r], straight between them. */
const prof = (pts: [number, number][]) => (y: number) => {
  if (y < pts[0][0] || y > pts[pts.length - 1][0]) return 0;
  for (let i = 1; i < pts.length; i++) if (y <= pts[i][0]) { const [y0, r0] = pts[i - 1], [y1, r1] = pts[i]; return y1 === y0 ? r1 : lerp(r0, r1, (y - y0) / (y1 - y0)); }
  return 0;
};
const sector = (a: number, n: number) => Math.floor(((a + Math.PI) / (2 * Math.PI)) * n) % n;

export function buildSouvenir(shape: Shape, cols: number[], pal: Palette): Prop {
  const m = new M(pal);
  const [c0, c1 = c0, c2 = c1, c3 = DARK] = cols;
  switch (shape) {
    case 'plate': {
      m.lathe(0, 0, () => 5.5, () => c0);
      m.lathe(1, 1, () => 10, (_y, d, a) => d > 8.6 ? c0 : d < 2.4 ? c2 : d > 3.6 && d < 6.6 ? (sector(a, 8) % 2 ? c2 : c1) : d >= 6.6 && d < 7.4 ? c2 : c1);
      m.lathe(2, 2, () => 10.2, (_y, d) => d > 8.9 ? c0 : -1);
      break;
    }
    case 'bowl': {
      m.lathe(0, 0, () => 3.8, () => c0);
      m.lathe(1, 7, prof([[1, 4.4], [4, 7.8], [7, 9.4]]), (y, d, a) => {
        const R = prof([[1, 4.4], [4, 7.8], [7, 9.4]])(y);
        if (d < R - 1.1) return y === 1 ? (d < 2 ? c2 : c1) : c1;
        return y === 7 ? c2 : y >= 4 && y <= 5 ? (sector(a, 12) % 2 ? c2 : c0) : c0;
      }, { shell: 1.6, floor: 1 });
      break;
    }
    case 'vase': {
      const r = prof([[0, 3.2], [2, 4.6], [7, 6.4], [11, 4.4], [15, 2.4], [17, 2.4], [19, 3.4]]);
      m.lathe(0, 19, r, (y, _d, a) => y >= 15 ? c2 : y >= 6 && y <= 9 ? (sector(a, 10) % 2 ? c1 : c0) : y === 11 ? c1 : c0, { shell: 1.2, floor: 16 });
      break;
    }
    case 'jug': {
      const r = prof([[0, 3.4], [1, 4.4], [5, 6], [9, 4.6], [12, 2.4], [15, 2.2], [17, 3.2]]);
      m.lathe(0, 17, r, (y) => y === 9 || y === 10 ? c2 : y >= 15 ? c1 : c0, { shell: 1.2, floor: 15 });
      // the spout, rising forward; the handle behind
      for (let i = 0; i <= 8; i++) m.box(C + 4 + Math.round(i * 0.75), 6 + i, C - 1, C + 5 + Math.round(i * 0.75), 6 + i, C, c0);
      for (let y = 5; y <= 15; y++) { const x = C - 6 - Math.round(Math.sin(((y - 5) / 10) * Math.PI) * 3); m.box(x, y, C - 1, x, y, C, c1); }
      break;
    }
    case 'pot': {
      m.lathe(0, 5, prof([[0, 5.8], [1, 6.6], [5, 6.8]]), (y, d) => d < 5.5 && y > 0 ? 0xc9ccd0 : y === 4 ? c1 : c0, { shell: 1.3, floor: 0 });
      m.lathe(6, 7, prof([[6, 7.2], [7, 5.4]]), () => c0);
      m.lathe(8, 9, () => 1.4, () => c2);
      for (const s of [-1, 1]) m.box(C + s * 8 - (s < 0 ? 1 : 0), 4, C - 1, C + s * 8 + (s > 0 ? 1 : 0) - (s < 0 ? 0 : 0), 5, C, c2);
      m.lathe(0, 3, prof([[0, 4.2], [3, 4.8]]), (_y, d) => (d < 3.6 ? 0xc9ccd0 : c0), { shell: 1, floor: 0, cx: C + 5, cz: C + 6 });
      break;
    }
    case 'cup': {
      m.lathe(0, 0, () => 7.2, (_y, d) => (d > 6.2 ? c1 : c2 === c0 ? c0 : c2));
      m.lathe(1, 7, prof([[1, 3.2], [3, 4.2], [7, 4.8]]), (y, d) => {
        if (d < prof([[1, 3.2], [3, 4.2], [7, 4.8]])(y) - 1 && y >= 1) return y === 6 || y === 7 ? 0x3a1a0a : c0;
        return y === 7 || y === 5 ? c1 : c0;
      }, { shell: 1, floor: 1 });
      // coffee to the brim (the inside shows from above)
      m.lathe(6, 6, () => 3.6, () => 0x3a1a0a);
      for (const [dy, dx] of [[2, 6], [3, 7], [4, 7], [5, 7], [6, 6]] as const) m.set(C + dx - 1, dy, C, c0);
      break;
    }
    case 'glass': {
      m.lathe(0, 0, () => 6, (_y, d) => (d > 5 ? c2 : c2));
      const r = prof([[1, 2.2], [3, 3], [5, 1.9], [6, 2.2], [10, 3.4]]);
      m.lathe(1, 10, r, (y, _d, a, x, z) => y === 10 ? c1 : c0 === c2 && hash(x, y, z) < 0.3 ? c1 : (sector(a, 10) + y) % 4 === 0 ? c1 : c0, { emit: 0.15 });
      break;
    }
    case 'teapot': {
      m.lathe(0, 9, prof([[0, 3.6], [2, 5.6], [5, 6], [8, 4.4], [9, 3.4]]), (y) => (y === 4 ? c1 : c0));
      m.lathe(10, 10, () => 3.4, () => c1);
      m.lathe(11, 12, () => 1.3, () => c2);
      for (let i = 0; i <= 6; i++) m.box(C + 5 + i, 3 + i, C - 1, C + 5 + i, 3 + i, C, c0);
      for (let y = 3; y <= 9; y++) { const x = C - 6 - Math.round(Math.sin(((y - 3) / 6) * Math.PI) * 2.5); m.box(x, y, C - 1, x, y, C, c2); }
      break;
    }
    case 'cezve': {
      m.lathe(0, 8, prof([[0, 3.6], [2, 4], [5, 3], [8, 3.6]]), (y, d) => (y === 8 ? c1 : d < 2 && y > 0 ? 0x3a1a0a : y === 2 ? c1 : c0), { shell: 1, floor: 0 });
      m.lathe(7, 7, () => 2.4, () => 0x5a2e16);
      m.box(C + 3, 7, C - 1, C + 11, 7, C, c2);
      m.box(C + 9, 6, C - 1, C + 11, 8, C, c2);
      break;
    }
    case 'tray': {
      m.lathe(0, 0, () => 10.6, (_y, d, a) => (d > 3.2 && d < 4 ? c1 : d > 6.4 && d < 7.2 ? c1 : d > 4 && d < 6.4 && sector(a, 16) % 2 ? c2 : c0));
      m.lathe(1, 1, () => 10.6, (_y, d) => (d > 9.6 ? c2 : -1));
      break;
    }
    case 'tile': {
      m.box(5, 0, C - 3, 18, 0, C + 2, WOOD);
      m.box(4, 1, C, 19, 16, C + 1, (x, y) => {
        const u = Math.abs(x + 0.5 - 12), v = Math.abs(y + 0.5 - 8.5);
        if (u > 7 || v > 7) return c1;
        if (u + v < 2.2) return c2;
        if (Math.abs(u - v) < 0.8 && u + v < 8) return c1;
        if (Math.hypot(u - 7.5, v - 7.5) < 3.2) return c2;
        if (u + v < 5 && u + v > 3.6) return c2;
        return c0;
      });
      break;
    }
    case 'rug': {
      // laid out flat, rolled at the back
      m.box(3, 0, 6, 20, 0, 21, (x, _y, z) => {
        const u = Math.abs(x + 0.5 - 12), v = Math.abs(z + 0.5 - 13.5);
        if (u > 7.5 || v > 6.5) return c2;
        if (u > 6.5 || v > 5.5) return c1;
        const l = u / 6 + v / 5;
        if (l < 0.35) return c2;
        if (l < 0.62) return c1;
        if (l < 0.72) return c2;
        if ((x + z) % 4 === 0 && l > 0.9) return c2;
        return c0;
      });
      for (let z = 6; z <= 21; z += 2) { m.set(2, 0, z, CREAM); m.set(21, 0, z, CREAM); }
      for (let y = 0; y <= 3; y++) for (let z = 1; z <= 5; z++) if (Math.hypot(y - 1.5, z - 3) < 2.4) m.box(3, y, z, 20, y, z, (x) => (Math.hypot(y - 1.5, z - 3) > 1.6 ? (x % 3 === 0 ? c2 : c0) : c1));
      break;
    }
    case 'cloth': {
      for (let i = 0; i < 3; i++) {
        const y = i * 2, o = i === 1 ? 1 : 0;
        m.box(5 + o, y, 6 - o, 18 + o, y + 1, 17 - o, (x, yy, z) => {
          if (i === 2 && (z === 6 || z === 17)) return c2;
          if (yy === y + 1 && i === 2) return (x + z) % 5 === 0 ? c1 : (Math.floor(x / 3) + Math.floor(z / 3)) % 2 ? c0 : (c1 === c0 ? c2 : c0);
          return (x + i) % 4 < 2 ? c0 : c1;
        });
      }
      // the folded edge, with a fringe
      for (let z = 7; z <= 16; z += 2) m.set(19, 0, z, c2);
      break;
    }
    case 'lamp': {
      m.box(C - 1, 22, C - 1, C, 25, C, BRASS);
      m.lathe(19, 21, prof([[19, 3.4], [21, 1.6]]), () => BRASS);
      m.sphere(C, 13.5, C, 6.2, (x, y, z) => {
        const n = hash(x >> 1, y >> 1, z >> 1);
        return y === 13 || y === 14 ? BRASS : n < 0.36 ? c0 : n < 0.68 ? c1 : n < 0.9 ? c2 : 0xf4f1ea;
      }, 0.55);
      m.lathe(5, 7, prof([[5, 0.8], [7, 2.2]]), () => BRASS);
      break;
    }
    case 'bottle': {
      m.lathe(0, 10, () => 3.4, (y, _d, a) => (y >= 3 && y <= 7 && Math.cos(a - Math.PI / 2) > -0.2 ? (y === 3 || y === 7 ? c2 : c1) : c0), { emit: 0.08 });
      m.lathe(11, 12, prof([[11, 2.8], [12, 1.8]]), () => c0, { emit: 0.08 });
      m.lathe(13, 16, () => 1.3, () => c0, { emit: 0.08 });
      m.lathe(17, 18, () => 1.5, () => c2);
      break;
    }
    case 'jar': {
      m.lathe(0, 8, prof([[0, 3.8], [1, 4.4], [8, 4.4]]), (y, _d, a) => (y >= 3 && y <= 6 && Math.cos(a - Math.PI / 2) > 0 ? c1 : c0));
      m.lathe(9, 10, () => 4.8, () => c2);
      m.lathe(11, 11, () => 1.6, () => c2);
      break;
    }
    case 'box': {
      m.box(5, 0, 7, 18, 5, 16, (x, y, z) => (x === 11 || x === 12 || z === 11 || z === 12 ? c2 : (y === 2 && (x + z) % 3 === 0 ? c1 : c0)));
      m.box(4, 6, 6, 19, 7, 17, (x, _y, z) => (x === 11 || x === 12 || z === 11 || z === 12 ? c2 : c1));
      m.box(10, 8, 10, 13, 9, 13, (x, y, z) => ((x + y + z) % 2 ? c2 : -1));
      break;
    }
    case 'sweets': {
      m.box(3, 0, 5, 20, 2, 18, (x, y, z) => (x === 3 || x === 20 || z === 5 || z === 18 ? (y === 2 ? BRASS : WOOD) : y < 2 ? WOOD : -1));
      for (let gz = 0; gz < 4; gz++) for (let gx = 0; gx < 5; gx++) {
        const x0 = 4 + gx * 3.2, z0 = 6 + gz * 3.1, col = (gx + gz) % 3 === 2 ? c2 : (gx + gz) % 2 ? c1 : c0;
        m.box(Math.round(x0), 2, Math.round(z0), Math.round(x0) + 1, 3, Math.round(z0) + 1, (x, y, z) => (y === 3 && hash(x, y, z) < 0.35 ? 0xfbf8f2 : col));
      }
      break;
    }
    case 'sack': {
      m.lathe(0, 7, prof([[0, 4.4], [3, 5.6], [7, 5.4]]), (y, _d, a) => (y === 7 ? c2 : sector(a, 18) % 2 && y % 2 ? 0xd8c8a0 : 0xc9b48a), { shell: 1, floor: 0 });
      m.lathe(8, 8, () => 6.2, (_y, d) => (d > 4.8 ? c2 : c0));
      m.lathe(7, 12, prof([[7, 4.8], [12, 0.8]]), (y, _d, _a, x, z) => (hash(x, y, z) < 0.25 ? c1 : c0));
      break;
    }
    case 'soap': {
      m.box(4, 0, 6, 15, 3, 13, (x, y, z) => (y === 3 && x > 6 && x < 13 && z > 8 && z < 11 ? c2 : c0));
      m.box(7, 4, 9, 18, 7, 16, (x, y, z) => (y === 7 && x > 9 && x < 16 && z > 11 && z < 14 ? c2 : c1));
      m.box(9, 8, 10, 16, 9, 15, () => c0);
      break;
    }
    case 'bead': {
      m.disc(C, 11, C, C + 1, 9, (d) => (d > 7 ? c0 : d > 4.6 ? c1 : d > 2.6 ? c2 : c3), 0.05);
      m.box(C - 1, 20, C, C, 24, C, 0xc8281e);
      m.box(C - 2, 24, C, C + 1, 24, C, 0xc8281e);
      break;
    }
    case 'coin': {
      m.disc(C, 10, C, C + 1, 7.2, (d, dx, dy) => (d > 6.2 ? c1 : d < 2.6 ? c2 : (Math.abs(dx) < 0.8 || Math.abs(dy) < 0.8) && d < 5.4 ? c1 : c0), 0.04);
      for (let i = 0; i < 7; i++) { m.set(C - 1 - i, 17 + i, C, c1); m.set(C + i, 17 + i, C, c1); }
      break;
    }
    case 'ring': {
      m.box(5, 0, 7, 18, 4, 16, (_x, y) => (y === 4 ? 0x7a1a2a : DARK));
      m.box(6, 5, 8, 17, 5, 15, 0x9a2a3a);
      for (let a = 0; a < 64; a++) {
        const t = (a / 64) * Math.PI * 2, x = Math.round(C - 0.5 + Math.cos(t) * 3.6), y = Math.round(10 + Math.sin(t) * 3.6);
        m.box(x, y, C - 1, x, y, C, c0);
      }
      m.box(C - 2, 14, C - 2, C + 1, 15, C + 1, c1);
      m.set(C - 1, 16, C - 1, c1, 0.3); m.set(C, 16, C, c1, 0.3);
      break;
    }
    case 'book': {
      m.box(5, 0, 6, 18, 3, 17, (x, y, z) => (y === 0 || y === 3 || x === 5 ? (x === 5 || x === 6 ? c1 : c0) : z === 6 || z === 17 || x === 18 ? (y % 1 === 0 ? 0xf4ecd8 : c0) : c0));
      m.box(9, 4, 9, 15, 4, 14, (x, _y, z) => (z === 9 || z === 14 || x === 9 || x === 15 ? c2 : -1));
      m.box(11, 4, 11, 13, 4, 12, c2);
      break;
    }
    case 'print': {
      m.box(7, 0, C - 2, 16, 0, C + 1, WOOD);
      m.box(4, 1, C, 19, 19, C, (x, y) => {
        if (x === 4 || x === 19 || y === 1 || y === 19) return c0;
        const wave = 6 + Math.sin(x * 0.7) * 1.6 + (x > 11 ? (x - 11) * 0.9 : 0);
        if (y < wave) return (x + y) % 3 === 0 ? 0xf4f1ea : c2;
        if (y < 11 && x < 10 && y > 15 - x) return 0xf4f1ea; // the far mountain's snow
        if (Math.hypot(x - 15, y - 15) < 2) return 0xc8281e;
        return c1;
      });
      break;
    }
    case 'scroll': {
      m.box(5, 21, C, 18, 21, C, c2);
      m.box(4, 21, C, 4, 21, C, DARK); m.box(19, 21, C, 19, 21, C, DARK);
      m.box(6, 3, C, 17, 20, C, (x, y) => {
        if (x === 6 || x === 17 || y <= 5 || y >= 18) return c2;
        // one character, brushed: a bar across, a stroke down, two sweeping away
        if (y === 15 && x >= 8 && x <= 15) return c1;
        if ((x === 11 || x === 12) && y >= 8 && y <= 16) return c1;
        if (y >= 8 && y <= 12 && (x === 19 - y || x === y - 1)) return c1;
        return c0;
      });
      m.box(5, 2, C, 18, 2, C, c2);
      m.set(4, 2, C, DARK); m.set(19, 2, C, DARK);
      break;
    }
    case 'doll': {
      m.lathe(0, 10, prof([[0, 3.6], [2, 3], [10, 3.2]]), (y, _d, a, x, z) => (y === 0 ? c2 : y === 10 ? c1 : Math.cos(a - Math.PI / 2) > 0.3 && hash(x >> 1, y >> 1, z >> 1) < 0.45 ? c2 : c0));
      m.sphere(C, 14.5, C, 4, (_x, y, _z, dx, _dy, dz) => {
        if (y >= 16 || dz < -0.5 || (y >= 15 && Math.abs(dx) > 2.5)) return c1;
        if (y === 14 && Math.abs(Math.abs(dx) - 1.3) < 0.6 && dz > 2) return DARK;
        if (y === 13 && Math.abs(dx) < 0.6 && dz > 2) return 0xc8281e;
        return SKIN;
      });
      break;
    }
    case 'daruma': {
      const r = prof([[0, 4.4], [2, 6.4], [6, 6.8], [10, 5.6], [13, 3]]);
      m.lathe(0, 13, r, (y, d, a) => {
        const front = Math.cos(a - Math.PI / 2);
        if (front > 0.6 && y >= 6 && y <= 10 && d > r(y) - 1.4) return y === 8 && Math.abs(Math.sin(a - Math.PI / 2)) > 0.18 && Math.abs(Math.sin(a - Math.PI / 2)) < 0.4 ? 0xf4f1ea : y === 6 || y === 10 ? c2 : c1;
        if (front > 0.4 && y >= 2 && y <= 4) return c2;
        return c0;
      });
      break;
    }
    case 'fan': {
      m.disc(C, 3, C, C, 11, (d, dx, dy) => {
        if (dy < 0) return -1;
        if (d < 3.2) return d < 1.6 ? c1 : -1;
        const ang = Math.atan2(dy, dx), rib = Math.abs(((ang / Math.PI) * 12) % 1 - 0.5) < 0.09;
        if (d < 5) return rib ? c1 : -1;
        if (d > 10.2) return c1;
        if (Math.hypot(dx + 3, dy - 7) < 2.2 || Math.hypot(dx - 4, dy - 6) < 1.6) return c2;
        return rib ? c1 : c0;
      });
      m.box(C - 1, 0, C - 1, C, 2, C, c1);
      break;
    }
    case 'knife': {
      m.box(2, 0, 7, 22, 0, 16, 0xc9a072);
      for (let x = 3; x <= 15; x++) {
        const w = x > 12 ? 15 - x : 3;
        m.box(x, 1, 13 - w, x, 1, 12, (_x, _y, z) => (z === 13 - w ? c1 : c0));
      }
      m.box(16, 1, 10, 16, 2, 12, DARK);
      m.box(17, 1, 10, 21, 2, 12, c2);
      break;
    }
    case 'slippers': {
      for (const x0 of [5, 13]) {
        m.box(x0, 0, 4, x0 + 5, 0, 18, c1 === c0 ? DARK : c1);
        m.box(x0, 1, 9, x0 + 5, 2, 18, (x, y, z) => (y === 2 && (x + z) % 3 === 0 ? c2 : c0));
        m.box(x0 + 1, 3, 13, x0 + 4, 3, 18, (x, _y, z) => ((x + z) % 2 ? c2 : c0));
        m.box(x0 + 2, 1, 19, x0 + 3, 4, 19, c0);
        m.box(x0 + 2, 5, 18, x0 + 3, 5, 18, c0);
      }
      break;
    }
    case 'boots': {
      for (const x0 of [4, 13]) {
        m.box(x0, 0, 7, x0 + 5, 0, 17, 0x3a2a1a);
        m.box(x0, 1, 7, x0 + 5, 2, 17, c0);
        m.box(x0, 3, 7, x0 + 5, 11, 11, (_x, y) => (y === 9 ? c1 : c0));
        m.box(x0 - 1, 12, 6, x0 + 6, 13, 12, (_x, y) => (y === 13 ? c2 : c0));
      }
      break;
    }
    case 'bag': {
      m.box(5, 0, 9, 18, 9, 14, c0);
      m.box(5, 5, 15, 18, 10, 15, c1);
      m.box(5, 10, 9, 18, 10, 15, c1);
      m.box(11, 6, 16, 12, 7, 16, c2);
      for (let i = 0; i <= 20; i++) { const t = (i / 20) * Math.PI, x = Math.round(11.5 + Math.cos(t) * 6), y = Math.round(10 + Math.sin(t) * 6); m.box(x, y, 11, x, y, 12, c1); }
      break;
    }
    case 'basket': {
      const r = prof([[0, 5], [8, 7.4]]);
      m.lathe(0, 8, r, (y, _d, a) => ((y + sector(a, 16)) % 2 ? c0 : c1), { shell: 1.2, floor: 0 });
      if (c2 !== c0) m.lathe(7, 9, prof([[7, 6], [9, 3.4]]), (y, _d, _a, x, z) => (hash(x, y, z) < 0.4 ? 0x9a6a3a : c2));
      for (let i = 0; i <= 24; i++) { const t = (i / 24) * Math.PI, x = Math.round(11.5 + Math.cos(t) * 7), y = Math.round(8 + Math.sin(t) * 8); m.box(x, y, C - 1, x, y, C, c0); }
      break;
    }
    case 'hat': {
      m.lathe(0, 13, prof([[0, 6.4], [2, 6], [12, 1.4], [13, 0.8]]), (y) => (y <= 1 ? c1 : c0));
      for (const s of [-1, 1]) m.box(C - 1 + s * 6 - (s < 0 ? 0 : 1), 0, C - 2, C + s * 6 - (s < 0 ? 0 : 1), 2, C + 1, c1);
      m.box(C, 14, C - 1, C, 15, C - 1, c2); m.box(C, 16, C - 2, C, 16, C - 3, c2);
      break;
    }
    case 'flower': {
      m.lathe(0, 5, prof([[0, 3.2], [5, 4.4]]), (y, d) => (y === 5 && d < 3.6 ? 0x4a3020 : c2));
      m.box(C - 1, 6, C - 1, C, 12, C, c1 === c0 ? 0x4f8a3a : c1);
      m.box(C + 1, 9, C - 1, C + 3, 9, C, 0x4f8a3a);
      m.sphere(C, 15.5, C, 4.6, (x, y, z, _dx, _dy, dz) => (dz > 3 && Math.abs(x + 0.5 - C) < 1.6 && Math.abs(y + 0.5 - 15.5) < 1.6 ? c1 : hash(x, y, z) < 0.2 ? c3 === DARK ? c0 : c3 : c0));
      break;
    }
    case 'chime': {
      m.box(C - 1, 19, C - 1, C, 20, C, DARK);
      m.lathe(13, 18, prof([[13, 5], [16, 4.2], [18, 1.6]]), (y, _d, a) => (y === 15 && sector(a, 8) % 2 ? c1 : y === 16 && sector(a, 8) % 2 === 0 ? c1 : c0), { shell: 1, floor: 18, emit: 0.2 });
      m.box(C - 1, 9, C - 1, C, 13, C, DARK);
      m.box(C - 2, 1, C, C + 1, 8, C, (_x, y) => (y === 6 ? c1 : c2));
      break;
    }
    case 'peppers': {
      m.box(C - 1, 1, C, C, 23, C, c2);
      for (let y = 3; y <= 20; y += 2) for (const s of [-1, 1]) {
        if ((y >> 1) % 2 === (s > 0 ? 0 : 1) && y % 4 !== 3) continue;
        const col = (y + s) % 3 ? c0 : c1;
        for (let k = 0; k < 4; k++) m.box(C + s * (1 + k) - (s < 0 ? 1 : 0), y - k, C, C + s * (1 + k) - (s < 0 ? 1 : 0), y - k, C + (k < 2 ? 1 : 0), col);
      }
      break;
    }
    case 'top': {
      const r = prof([[0, 0.8], [1, 2.2], [4, 6.2], [6, 6.4], [7, 4], [8, 1.4], [12, 1.2]]);
      m.lathe(0, 12, r, (y) => (y <= 2 ? DARK : y === 4 ? c1 : y === 5 ? c2 : y === 6 ? c1 : y >= 8 ? c1 : c0));
      break;
    }
    case 'pouch': {
      m.box(6, 0, 9, 17, 11, 14, (x, y, z) => ((x === 6 || x === 17) && (y === 0 || y === 11) ? -1 : y === 9 ? c1 : (x + y + z) % 4 === 0 ? c2 : c0));
      m.box(8, 12, 10, 15, 13, 13, c0);
      m.box(11, 14, 11, 12, 16, 12, c1);
      m.box(10, 17, 11, 13, 17, 12, c1);
      break;
    }
    case 'stone': {
      m.box(3, 0, 6, 20, 1, 17, c2);
      m.box(5, 2, 8, 18, 3, 15, c0);
      m.box(5, 4, 8, 18, 5, 15, (x, _y, z) => (c1 === c0 && (x + z) % 2 ? 0x9aa1a8 : c1));
      break;
    }
    case 'cat': {
      m.lathe(0, 8, prof([[0, 4.6], [6, 4.2], [8, 3.8]]), (y, _d, a) => {
        const front = Math.cos(a - Math.PI / 2);
        if (y === 7 && front > -0.3) return c1;
        if (front > 0.75 && y >= 2 && y <= 5) return c2;
        return c0;
      });
      m.sphere(C, 12.5, C, 4.4, (_x, y, _z, dx, _dy, dz) => {
        if (y === 13 && dz > 2.5 && Math.abs(Math.abs(dx) - 1.6) < 0.6) return DARK;
        if (y === 12 && dz > 3 && Math.abs(dx) < 0.6) return 0xe88a9a;
        return c0;
      });
      for (const s of [-1, 1]) m.box(C - 1 + s * 2 + (s < 0 ? -1 : 0), 16, C - 1, C + s * 2 + (s < 0 ? -1 : 0), 17, C, (_x, y) => (y === 16 ? 0xe88a9a : c0));
      // the beckoning paw, raised beside the face
      m.box(C + 4, 9, C, C + 5, 15, C + 1, (_x, y) => (y === 15 ? 0xe88a9a : c0));
      m.box(C, 6, C + 4, C, 6, C + 4, c2);
      break;
    }
    case 'clogs': {
      for (const x0 of [5, 13]) {
        m.box(x0, 0, 6, x0 + 5, 4, 8, c0);
        m.box(x0, 0, 14, x0 + 5, 4, 16, c0);
        m.box(x0, 5, 5, x0 + 5, 6, 18, (x, y, z) => (y === 6 && (x + z) % 3 === 0 ? c1 : c0));
        m.box(x0, 7, 13, x0 + 5, 8, 15, c2);
      }
      break;
    }
  }
  return m.p;
}
