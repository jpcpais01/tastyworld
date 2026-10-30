import { Grid, rng } from './grid';
import { Palette } from './palette';

/** A small fine-resolution voxel model placed in the world. */
export class Prop {
  grid: Grid;
  constructor(sx: number, sy: number, sz: number, public scale = 0.125) {
    this.grid = new Grid(sx, sy, sz);
  }
  get sx() { return this.grid.sx; }
  get sy() { return this.grid.sy; }
  get sz() { return this.grid.sz; }
  set(x: number, y: number, z: number, c: number) { this.grid.set(x, y, z, c); }
  get(x: number, y: number, z: number) { return this.grid.get(x, y, z); }
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number | ((x: number, y: number, z: number) => number)) {
    this.grid.box(x0, y0, z0, x1, y1, z1, c);
  }
  ellipsoid(cx: number, cy: number, cz: number, rx: number, ry: number, rz: number, c: number | ((x: number, y: number, z: number) => number)) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let z = Math.floor(cz - rz); z <= Math.ceil(cz + rz); z++)
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x + 0.5 - cx) / rx, dy = (y + 0.5 - cy) / ry, dz = (z + 0.5 - cz) / rz;
          if (dx * dx + dy * dy + dz * dz <= 1) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
        }
  }
  cylY(cx: number, cz: number, r: number, y0: number, y1: number, c: number | ((x: number, y: number, z: number) => number)) {
    for (let y = y0; y <= y1; y++)
      for (let z = Math.floor(cz - r); z <= Math.ceil(cz + r); z++)
        for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
          const dx = x + 0.5 - cx, dz = z + 0.5 - cz;
          if (dx * dx + dz * dz <= r * r) this.set(x, y, z, typeof c === 'function' ? c(x, y, z) : c);
        }
  }
}

/** Rotate a prop around Y by quarter turns. Turn 1 maps "facing +Z" to "facing +X". */
export function rotateProp(p: Prop, turns: number): Prop {
  turns = ((turns % 4) + 4) % 4;
  if (turns === 0) return p;
  let cur = p;
  for (let t = 0; t < turns; t++) {
    const g = cur.grid;
    const n = new Prop(g.sz, g.sy, g.sx, cur.scale);
    for (let y = 0; y < g.sy; y++)
      for (let z = 0; z < g.sz; z++)
        for (let x = 0; x < g.sx; x++) {
          const v = g.get(x, y, z);
          if (v) n.set(z, y, g.sx - 1 - x, v);
        }
    cur = n;
  }
  return cur;
}

/** Procedural kanji-like glyph on an n x n grid. */
export function glyph(r: () => number, n = 5): boolean[][] {
  for (let attempt = 0; attempt < 12; attempt++) {
    const g: boolean[][] = Array.from({ length: n }, () => Array(n).fill(false));
    const m = n - 1, mid = Math.floor(n / 2);
    const strokes = [
      () => { for (let i = 0; i < n; i++) g[0][i] = true; },
      () => { for (let i = 0; i < n; i++) g[m][i] = true; },
      () => { for (let i = 0; i < n; i++) g[mid][i] = true; },
      () => { for (let i = 1; i < m; i++) g[mid][i] = true; },
      () => { for (let i = 0; i < n; i++) g[i][0] = true; },
      () => { for (let i = 0; i < n; i++) g[i][m] = true; },
      () => { for (let i = 0; i < n; i++) g[i][mid] = true; },
      () => { for (let i = 0; i < mid + 1; i++) g[i][mid] = true; },
      () => { for (let i = 1; i < m; i++) { g[1][i] = true; g[m - 1][i] = true; g[i][1] = true; g[i][m - 1] = true; } },
      () => { for (let i = 0; i < n; i++) g[i][Math.min(m, i)] = true; },
      () => { for (let i = 0; i < n; i++) g[i][m - Math.min(m, i)] = true; },
      () => { g[0][mid] = true; g[1][mid] = true; },
    ];
    const k = 2 + Math.floor(r() * 3);
    for (let s = 0; s < k; s++) strokes[Math.floor(r() * strokes.length)]();
    let cnt = 0;
    for (const row of g) for (const v of row) if (v) cnt++;
    if (cnt >= n * 1.6 && cnt <= n * n * 0.62) return g;
  }
  const g: boolean[][] = Array.from({ length: n }, (_, y) => Array.from({ length: n }, (_, x) => y === 0 || x === Math.floor(n / 2)));
  return g;
}

export interface PropKit {
  pal: Palette;
  c: Record<string, number>;
}

export function makePropColors(pal: Palette): Record<string, number> {
  const a = (hex: number, o = {}) => pal.add(hex, o);
  return {
    black: a(0x1d1a1c, { vary: 0.03 }),
    charcoal: a(0x2e2b2c),
    white: a(0xf3efe6, { vary: 0.03 }),
    paper: a(0xf6ecd6, { emit: 0.35, vary: 0.04 }),
    lanternRed: a(0xd8372b, { emit: 0.55, vary: 0.05 }),
    lanternRedDark: a(0xb22a22, { emit: 0.45, vary: 0.04 }),
    lanternWhite: a(0xf7efe0, { emit: 0.55, vary: 0.03 }),
    lanternAmber: a(0xf2a640, { emit: 0.6, vary: 0.04 }),
    ink: a(0x1a1414, { vary: 0.02 }),
    gold: a(0xd8a940, { vary: 0.05 }),
    brass: a(0xb08a3e, { vary: 0.06 }),
    bronze: a(0x5b4a35, { vary: 0.08 }),
    steel: a(0x9aa3ab, { vary: 0.04 }),
    steelDark: a(0x5d646b, { vary: 0.04 }),
    chrome: a(0xc9cfd4, { vary: 0.03 }),
    stone: a(0x9c978e, { vary: 0.1 }),
    stoneDark: a(0x77726b, { vary: 0.1 }),
    moss: a(0x6f8a4a, { vary: 0.12 }),
    wood: a(0x8b5a3c, { vary: 0.08 }),
    woodDark: a(0x5a3a28, { vary: 0.08 }),
    woodLight: a(0xd1ad7c, { vary: 0.06 }),
    hinoki: a(0xe2c79a, { vary: 0.05 }),
    lacquer: a(0xc0392b, { vary: 0.04 }),
    navy: a(0x23345e, { vary: 0.04 }),
    indigo: a(0x2c3d73, { vary: 0.04 }),
    norenRed: a(0xb3302a, { vary: 0.04 }),
    norenWhite: a(0xeee8dc, { vary: 0.03 }),
    norenBrown: a(0x6b4630, { vary: 0.04 }),
    norenGreen: a(0x2f6b54, { vary: 0.04 }),
    pink: a(0xf3a6b9, { vary: 0.06 }),
    neonPink: a(0xff5fa2, { emit: 0.95, vary: 0.02 }),
    neonCyan: a(0x52e6ff, { emit: 0.95, vary: 0.02 }),
    neonYellow: a(0xffd84a, { emit: 0.9, vary: 0.02 }),
    neonWhite: a(0xfff6e0, { emit: 0.85, vary: 0.02 }),
    neonRed: a(0xff4636, { emit: 0.95, vary: 0.02 }),
    neonGreen: a(0x6dff8a, { emit: 0.9, vary: 0.02 }),
    bulb: a(0xffe1a0, { emit: 1.0, vary: 0.02 }),
    signRed: a(0xc8322b, { vary: 0.03 }),
    signBlue: a(0x2b5aa8, { vary: 0.03 }),
    signYellow: a(0xf0c23b, { vary: 0.03 }),
    signGreen: a(0x2f8a5a, { vary: 0.03 }),
    signCream: a(0xf1e6c8, { vary: 0.03 }),
    signBlack: a(0x231f20, { vary: 0.03 }),
    vmWhite: a(0xe9ecef, { vary: 0.02 }),
    vmRed: a(0xd6312b, { vary: 0.03 }),
    vmBlue: a(0x2d6fc0, { vary: 0.03 }),
    vmPanel: a(0xdff4ff, { emit: 0.8, vary: 0.02 }),
    vmGlass: a(0x9fd7f0, { emit: 0.35, vary: 0.02 }),
    canRed: a(0xe6463c, { emit: 0.3 }),
    canBlue: a(0x3c7de6, { emit: 0.3 }),
    canGreen: a(0x3cb06a, { emit: 0.3 }),
    canYellow: a(0xf2c14a, { emit: 0.3 }),
    canOrange: a(0xf28a3c, { emit: 0.3 }),
    canWhite: a(0xf6f6f2, { emit: 0.3 }),
    acGray: a(0xd9dcd8, { vary: 0.03 }),
    acDark: a(0x8e938f, { vary: 0.03 }),
    crateYellow: a(0xf2c230, { vary: 0.04 }),
    crateRed: a(0xd6402f, { vary: 0.04 }),
    crateBlue: a(0x3266b8, { vary: 0.04 }),
    crateGreen: a(0x3d9a5c, { vary: 0.04 }),
    bottleBrown: a(0x6b3a16, { vary: 0.05 }),
    bottleGreen: a(0x2e6b3a, { vary: 0.05 }),
    leaf: a(0x4f8a3a, { vary: 0.14 }),
    leafDark: a(0x35662c, { vary: 0.14 }),
    leafLight: a(0x7fb04e, { vary: 0.12 }),
    pine: a(0x2f5a35, { vary: 0.12 }),
    terracotta: a(0xb8613f, { vary: 0.06 }),
    glazeBlue: a(0x2f5f8a, { vary: 0.05 }),
    coal: a(0xff6a1f, { emit: 0.9, vary: 0.2 }),
    coalDark: a(0x3a2420, { vary: 0.15 }),
    fireWarm: a(0xffb347, { emit: 1.0, vary: 0.05, night: true }),
    windowWarm: a(0xffcf86, { emit: 0.9, night: true, vary: 0.08 }),
    lampHead: a(0xfff1c8, { emit: 1.0, vary: 0.02 }),
    lampNight: a(0xfff1c8, { emit: 1.0, night: true, vary: 0.02 }),
    poleGray: a(0x8f9196, { vary: 0.05 }),
    poleGreen: a(0x3e5a4c, { vary: 0.05 }),
    tireBlack: a(0x232323, { vary: 0.03 }),
    bikeSilver: a(0xbfc5ca, { vary: 0.03 }),
    bikeRed: a(0xc63a3a, { vary: 0.03 }),
    bikeMint: a(0x7fc8b4, { vary: 0.03 }),
    fabricBlue: a(0x5d8ec8, { vary: 0.05 }),
    fabricWhite: a(0xf2efe7, { vary: 0.04 }),
    fabricRed: a(0xd9534a, { vary: 0.05 }),
    fabricOrange: a(0xe9893f, { vary: 0.05 }),
    fabricGreen: a(0x4f9a6b, { vary: 0.05 }),
    catWhite: a(0xfaf6ee, { vary: 0.02 }),
    catGold: a(0xf1c84b, { vary: 0.03 }),
    catRedBib: a(0xd6342c, { vary: 0.03 }),
  };
}

// ---------------------------------------------------------------------------------------------
// Prop factories. All are built "facing +Z" (front at max z).

export function lantern(k: PropKit, body: number, w = 5, h = 6, seed = 1): Prop {
  const { c } = k;
  const p = new Prop(w, h + 3, w);
  const cx = w / 2, cz = w / 2;
  for (let y = 1; y < h - 1; y++) {
    const t = (y - 0.5) / (h - 2);
    const rr = (w / 2) * (0.72 + 0.28 * Math.sin(Math.PI * t));
    p.cylY(cx, cz, rr, y, y, body);
  }
  p.cylY(cx, cz, w / 2 - 1, 0, 0, c.black);
  p.cylY(cx, cz, w / 2 - 1, h - 1, h - 1, c.black);
  // glyph stripe front and back
  const r = rng(seed);
  for (let y = 2; y < h - 2; y++) {
    if (r() < 0.75) p.set(Math.floor(cx), y, w - 1, c.ink);
    if (r() < 0.75) p.set(Math.floor(cx), y, 0, c.ink);
  }
  // cord
  p.box(Math.floor(cx), h, Math.floor(cz), Math.floor(cx), h + 2, Math.floor(cz), c.black);
  return p;
}

export function giantLantern(k: PropKit): Prop {
  const { c } = k;
  const w = 22, h = 28;
  const p = new Prop(w + 2, h + 4, w + 2);
  const cx = (w + 2) / 2, cz = (w + 2) / 2;
  for (let y = 3; y < h - 2; y++) {
    const t = (y - 3) / (h - 5);
    const rr = (w / 2) * (0.8 + 0.2 * Math.sin(Math.PI * t));
    p.cylY(cx, cz, rr, y, y, (x, yy, z) => ((yy % 3 === 0) ? c.lanternRedDark : c.lanternRed) + 0 * (x + z));
  }
  // black lacquer rings top/bottom with gold trim
  p.cylY(cx, cz, w / 2 - 0.5, 0, 2, c.black);
  p.cylY(cx, cz, w / 2 - 0.5, 1, 1, c.gold);
  p.cylY(cx, cz, w / 2 - 0.5, h - 2, h, c.black);
  p.cylY(cx, cz, w / 2 - 0.5, h - 1, h - 1, c.gold);
  p.cylY(cx, cz, 3, h + 1, h + 3, c.black);
  // bold glyphs front & back
  const r = rng(77);
  for (let gi = 0; gi < 2; gi++) {
    const g = glyph(r, 5);
    for (let gy = 0; gy < 5; gy++)
      for (let gx = 0; gx < 5; gx++) {
        if (!g[gy][gx]) continue;
        for (let sy = 0; sy < 2; sy++)
          for (let sx = 0; sx < 2; sx++) {
            const x = Math.floor(cx) - 5 + gx * 2 + sx;
            const y = h - 6 - (gi * 11) - gy * 2 - sy;
            // project onto surface: find outermost voxel along z
            for (const dir of [1, -1]) {
              let z = dir > 0 ? p.sz - 1 : 0;
              while (z >= 0 && z < p.sz && !p.get(x, y, z)) z -= dir;
              if (z >= 0 && z < p.sz) p.set(x, y, z, c.ink);
            }
          }
      }
  }
  return p;
}

export function verticalSign(k: PropKit, bg: number, fg: number, chars = 3, seed = 1, bulbs = false): Prop {
  const { c } = k;
  const w = 6, ch = 6;
  const h = chars * ch + 3;
  const p = new Prop(w + 2, h + 2, 3);
  p.box(1, 1, 0, w, h, 2, bg);
  // frame
  p.box(1, 1, 0, w, 1, 2, c.signBlack);
  p.box(1, h, 0, w, h, 2, c.signBlack);
  if (bulbs) {
    for (let y = 2; y < h; y += 2) {
      p.set(1, y, 0, c.bulb); p.set(w, y, 0, c.bulb);
      p.set(1, y, 2, c.bulb); p.set(w, y, 2, c.bulb);
    }
  }
  const r = rng(seed);
  for (let i = 0; i < chars; i++) {
    const g = glyph(r, 4);
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) {
        if (!g[gy][gx]) continue;
        const x = 2 + gx, y = h - 2 - i * ch - gy;
        p.set(x, y, 2, fg);
        p.set(5 - gx + 0, y, 0, fg);
      }
  }
  // wall bracket
  p.box(0, 3, 1, 0, 3, 1, c.steelDark);
  p.box(0, h - 2, 1, 0, h - 2, 1, c.steelDark);
  return p;
}

/** Horizontal sign board (kanban), facing +Z. */
export function boardSign(k: PropKit, bg: number, fg: number, chars = 4, seed = 2, border?: number): Prop {
  const { c } = k;
  const cw = 6;
  const w = chars * cw + 3, h = 7;
  const p = new Prop(w, h, 2);
  p.box(0, 0, 0, w - 1, h - 1, 1, bg);
  if (border !== undefined) {
    p.box(0, 0, 1, w - 1, 0, 1, border);
    p.box(0, h - 1, 1, w - 1, h - 1, 1, border);
    p.box(0, 0, 1, 0, h - 1, 1, border);
    p.box(w - 1, 0, 1, w - 1, h - 1, 1, border);
  }
  const r = rng(seed);
  for (let i = 0; i < chars; i++) {
    const g = glyph(r, 4);
    for (let gy = 0; gy < 4; gy++)
      for (let gx = 0; gx < 4; gx++) if (g[gy][gx]) p.set(2 + i * cw + gx, h - 2 - gy, 1, fg);
  }
  void c;
  return p;
}

export function noren(k: PropKit, width: number, cloth: number, mark: number, h = 7, panels = 3): Prop {
  const { c } = k;
  const p = new Prop(width + 2, h + 2, 2);
  p.box(0, h + 1, 0, width + 1, h + 1, 1, c.woodDark); // rod
  const pw = Math.floor(width / panels);
  for (let i = 0; i < panels; i++) {
    const x0 = 1 + i * pw, x1 = i === panels - 1 ? width : x0 + pw - 2;
    p.box(x0, 1, 1, x1, h, 1, cloth);
    // little sway: bottom row offset
    p.box(x0, 0, 1, x1, 0, 1, (i % 2) ? cloth : 0);
    // mark in the centre
    const mx = Math.floor((x0 + x1) / 2);
    p.box(mx - 1, h - 4, 1, mx, h - 2, 1, mark);
    if (i % 2 === 0) p.set(mx - 1, h - 5, 1, mark);
  }
  return p;
}

export function vendingMachine(k: PropKit, body: number, seed = 3): Prop {
  const { c } = k;
  const p = new Prop(8, 15, 6);
  p.box(0, 0, 0, 7, 14, 5, body);
  p.box(1, 11, 5, 6, 13, 5, c.vmPanel);
  const cans = [c.canRed, c.canBlue, c.canGreen, c.canYellow, c.canOrange, c.canWhite];
  const r = rng(seed);
  p.box(1, 5, 5, 6, 10, 5, c.vmGlass);
  for (let row = 0; row < 3; row++)
    for (let col = 0; col < 6; col++) {
      const cc = cans[Math.floor(r() * cans.length)];
      p.set(1 + col, 6 + row * 2, 5, cc);
    }
  p.box(1, 1, 5, 6, 2, 5, c.black);
  p.box(5, 3, 5, 6, 4, 5, c.steelDark);
  p.box(0, 14, 0, 7, 14, 5, c.steelDark);
  return p;
}

export function acUnit(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(6, 5, 3);
  p.box(0, 0, 0, 5, 4, 2, c.acGray);
  for (let y = 1; y <= 3; y++) for (let x = 1; x <= 3; x++) if (!(x === 2 && y === 2)) p.set(x, y, 2, c.acDark);
  p.set(2, 2, 2, c.steel);
  p.box(5, 0, 2, 5, 4, 2, c.acDark);
  return p;
}

export function crateStack(k: PropKit, seed = 4): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(8, 10, 8);
  const cols = [c.crateYellow, c.crateRed, c.crateBlue, c.crateGreen];
  const stacks = [[0, 0], [4, 0], [0, 4], [4, 4]];
  for (const [sx, sz] of stacks) {
    if (r() < 0.25) continue;
    const n = 1 + Math.floor(r() * 3);
    const col = cols[Math.floor(r() * cols.length)];
    for (let i = 0; i < n; i++) {
      const y0 = i * 3;
      p.box(sx, y0, sz, sx + 3, y0 + 2, sz + 3, col);
      p.box(sx + 1, y0 + 2, sz + 1, sx + 2, y0 + 2, sz + 2, i === n - 1 ? (r() < 0.6 ? c.bottleBrown : c.bottleGreen) : col);
      p.set(sx + 1, y0 + 1, sz + 3, c.white);
    }
  }
  return p;
}

export function stool(k: PropKit, top: number): Prop {
  const { c } = k;
  const p = new Prop(3, 4, 3);
  p.box(1, 0, 1, 1, 2, 1, c.chrome);
  p.box(0, 3, 0, 2, 3, 2, top);
  p.box(0, 0, 0, 2, 0, 2, c.chrome);
  p.set(0, 0, 0, 0); p.set(2, 0, 2, 0); p.set(0, 0, 2, 0); p.set(2, 0, 0, 0);
  return p;
}

export function plantPot(k: PropKit, kind: 'shrub' | 'bamboo' | 'pine' | 'flowers', seed = 5): Prop {
  const { c } = k;
  const r = rng(seed);
  const pot = r() < 0.5 ? c.terracotta : c.glazeBlue;
  if (kind === 'bamboo') {
    const p = new Prop(6, 22, 6);
    p.box(1, 0, 1, 4, 3, 4, pot);
    for (let i = 0; i < 4; i++) {
      const x = 1 + Math.floor(r() * 4), z = 1 + Math.floor(r() * 4);
      const h = 14 + Math.floor(r() * 7);
      for (let y = 4; y < h; y++) p.set(x, y, z, y % 4 === 0 ? c.leafDark : c.leafLight);
      p.ellipsoid(x + 0.5, h, z + 0.5, 2, 1.5, 2, (xx, yy, zz) => ((xx + yy + zz) % 3 ? c.leaf : c.leafLight));
    }
    return p;
  }
  if (kind === 'pine') {
    const p = new Prop(9, 10, 9);
    p.box(2, 0, 2, 6, 2, 6, pot);
    p.box(4, 3, 4, 4, 6, 4, c.woodDark);
    p.ellipsoid(3.5, 6.5, 4.5, 3, 1.5, 2.5, c.pine);
    p.ellipsoid(6, 8, 4.5, 2.5, 1.3, 2.2, c.pine);
    return p;
  }
  const p = new Prop(7, 9, 7);
  p.box(1, 0, 1, 5, 3, 5, pot);
  p.ellipsoid(3.5, 6, 3.5, 3.2, 3, 3.2, (x, y, z) => {
    const h = (x * 7 + y * 13 + z * 5) % 9;
    if (kind === 'flowers' && h === 0) return c.pink;
    if (kind === 'flowers' && h === 4) return c.white;
    return h < 3 ? c.leafDark : h < 6 ? c.leaf : c.leafLight;
  });
  return p;
}

export function stoneLantern(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(9, 19, 9);
  p.box(1, 0, 1, 7, 1, 7, c.stoneDark);
  p.box(3, 2, 3, 5, 8, 5, c.stone);
  p.box(2, 9, 2, 6, 9, 6, c.stone);
  p.box(2, 10, 2, 6, 13, 6, c.stone);
  p.box(3, 11, 2, 5, 12, 6, c.fireWarm);
  p.box(2, 11, 3, 6, 12, 5, c.fireWarm);
  p.box(3, 11, 3, 5, 12, 5, c.stone);
  p.box(0, 14, 0, 8, 14, 8, c.stoneDark);
  p.box(1, 15, 1, 7, 15, 7, c.stone);
  p.box(3, 16, 3, 5, 16, 5, c.stone);
  p.box(4, 17, 4, 4, 18, 4, c.stone);
  p.set(0, 15, 0, c.stoneDark); p.set(8, 15, 8, c.stoneDark); p.set(0, 15, 8, c.stoneDark); p.set(8, 15, 0, c.stoneDark);
  for (let i = 0; i < 6; i++) p.set(1 + ((i * 5) % 7), 1, 1 + ((i * 3) % 7), c.moss);
  return p;
}

export function incenseBurner(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(17, 22, 17);
  for (const [x, z] of [[3, 3], [13, 3], [3, 13], [13, 13]]) p.box(x, 0, z, x, 4, z, c.bronze);
  p.cylY(8.5, 8.5, 7, 4, 4, c.bronze);
  for (let y = 5; y <= 9; y++) p.cylY(8.5, 8.5, 7.5 - (y - 5) * 0.3, y, y, y === 7 ? c.brass : c.bronze);
  p.cylY(8.5, 8.5, 5.5, 9, 9, c.coalDark);
  p.cylY(8.5, 8.5, 2, 9, 9, c.coal);
  for (const [x, z] of [[4, 4], [12, 4], [4, 12], [12, 12]]) p.box(x, 10, z, x, 15, z, c.bronze);
  for (let y = 16; y <= 18; y++) p.cylY(8.5, 8.5, 9 - (y - 16) * 2.8, y, y, c.bronze);
  p.box(0, 16, 0, 16, 16, 0, c.bronze);
  p.box(0, 16, 16, 16, 16, 16, c.bronze);
  p.cylY(8.5, 8.5, 1, 19, 21, c.brass);
  return p;
}

export function streetLamp(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(7, 34, 4);
  p.box(1, 0, 1, 2, 1, 2, c.poleGreen);
  p.box(1, 2, 1, 1, 30, 1, c.poleGreen);
  p.box(1, 30, 1, 5, 30, 1, c.poleGreen);
  p.box(4, 31, 0, 6, 32, 2, c.poleGreen);
  p.box(4, 28, 0, 6, 29, 2, c.lampNight);
  p.box(5, 27, 1, 5, 27, 1, c.lampNight);
  return p;
}

export function bench(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(14, 6, 5);
  for (const x of [1, 12]) { p.box(x, 0, 0, x, 3, 0, c.steelDark); p.box(x, 0, 4, x, 3, 4, c.steelDark); p.box(x, 3, 0, x, 5, 0, c.steelDark); }
  p.box(0, 3, 0, 13, 3, 4, c.wood);
  for (let x = 0; x < 14; x++) if (x % 3 === 2) p.set(x, 3, 2, 0);
  p.box(0, 5, 0, 13, 5, 0, c.wood);
  return p;
}

export function bicycle(k: PropKit, frame: number): Prop {
  const { c } = k;
  const p = new Prop(22, 14, 3, 0.0625);
  const wheel = (cx: number) => {
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2;
      p.set(Math.round(cx + Math.cos(t) * 4.2), Math.round(4.5 + Math.sin(t) * 4.2), 1, c.tireBlack);
    }
    p.set(Math.round(cx), 4, 1, c.bikeSilver);
  };
  wheel(4.5); wheel(17);
  for (let i = 0; i <= 10; i++) p.set(5 + i, 5 + Math.round(i * 0.3), 1, frame);
  for (let i = 0; i <= 6; i++) p.set(9 + Math.round(i * 0.2), 5 + i, 1, frame);
  for (let i = 0; i <= 7; i++) p.set(15 + Math.round(i * 0.25), 7 + i * 0.6, 1, frame);
  p.box(8, 11, 0, 11, 11, 2, c.tireBlack); // saddle
  p.box(15, 12, 0, 19, 13, 2, c.bikeSilver); // basket
  p.box(16, 12, 1, 18, 12, 1, 0);
  p.box(15, 12, 0, 15, 12, 2, c.bikeSilver);
  return p;
}

export function nobori(k: PropKit, cloth: number, fg: number, seed = 9): Prop {
  const { c } = k;
  const p = new Prop(7, 28, 2);
  p.box(0, 0, 0, 0, 27, 0, c.steel);
  p.box(1, 26, 0, 5, 26, 0, c.steel);
  p.box(1, 8, 0, 5, 25, 0, cloth);
  const r = rng(seed);
  for (let i = 0; i < 3; i++) {
    const g = glyph(r, 3);
    for (let gy = 0; gy < 3; gy++) for (let gx = 0; gx < 3; gx++) if (g[gy][gx]) p.set(2 + gx, 23 - i * 5 - gy, 0, fg);
  }
  p.box(1, 8, 0, 5, 8, 0, fg);
  p.box(1, 25, 0, 5, 25, 0, fg);
  return p;
}

export function manekiNeko(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(10, 14, 9, 0.0625);
  p.box(1, 0, 1, 8, 1, 8, c.lacquer); // cushion
  p.ellipsoid(5, 5, 4.5, 3.6, 3.6, 3.2, c.catWhite); // body
  p.ellipsoid(5, 10, 4.5, 3.3, 2.8, 2.9, c.catWhite); // head
  p.box(2, 12, 3, 3, 13, 5, c.catWhite); p.box(7, 12, 3, 8, 13, 5, c.catWhite); // ears
  p.set(2, 12, 6, c.pink); p.set(8, 12, 6, c.pink);
  p.box(3, 7, 7, 7, 7, 7, c.catRedBib);
  p.set(5, 6, 8, c.catGold);
  p.set(4, 10, 7, c.ink); p.set(6, 10, 7, c.ink); p.set(5, 9, 7, c.pink);
  // raised paw
  p.box(8, 8, 4, 9, 12, 5, c.catWhite);
  p.set(9, 12, 5, c.pink);
  p.ellipsoid(3, 2.5, 7, 1.2, 1.2, 1.2, c.catGold); // coin
  p.box(1, 4, 5, 1, 6, 6, c.catGold); // spot
  p.box(6, 11, 4, 7, 12, 5, c.ink);
  return p;
}

/** Wire hanging between two points along +X: length in metres, sag in metres. */
export function wire(k: PropKit, length: number, sag: number, col?: number): Prop {
  const { c } = k;
  const s = 0.0625;
  const n = Math.max(2, Math.round(length / s));
  const sagV = Math.max(1, Math.round(sag / s));
  const p = new Prop(n, sagV + 2, 1, s);
  let prevY = sagV + 1;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = Math.round(sagV + 1 - sagV * 4 * t * (1 - t));
    const lo = Math.min(y, prevY), hi = Math.max(y, prevY);
    for (let yy = lo; yy <= hi; yy++) p.set(i, yy, 0, col ?? c.black);
    prevY = y;
  }
  return p;
}

export function utilityTransformer(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(5, 6, 4);
  p.cylY(2.5, 2, 2.2, 0, 4, c.acDark);
  p.cylY(2.5, 2, 1.2, 5, 5, c.steelDark);
  return p;
}
