import { Grid, rng, hash3 } from './grid';
import { Palette } from './palette';
import { SwayBody, SWAY } from './sway';

/** A small fine-resolution voxel model placed in the world. */
export class Prop {
  grid: Grid;
  /** Sway bodies with pivots in voxel units (see world/sway.ts). */
  bodies: SwayBody[] = [];
  /** Per voxel (grid layout): 1-based index into bodies, 0 = static. */
  swayIdx: Uint8Array | null = null;
  /** Set on overhead wires (see wire()): how far the middle sags, so birds know where to sit on it. */
  wireSag?: number;
  constructor(sx: number, sy: number, sz: number, public scale = 0.125) {
    this.grid = new Grid(sx, sy, sz);
  }
  /**
   * Make the voxels picked by `sel` (all of them by default) one rigid body that swings about `pivot`
   * (voxel units). Call it once the voxels are in place; later calls take over voxels they share.
   */
  sway(preset: SwayPreset, pivot: [number, number, number], axis: [number, number, number] = [0, 0, 0], sel?: (x: number, y: number, z: number) => boolean, reach?: number): void {
    const g = this.grid;
    const id = this.body(preset, pivot, axis, reach);
    for (let y = 0; y < g.sy; y++)
      for (let z = 0; z < g.sz; z++)
        for (let x = 0; x < g.sx; x++) {
          const i = y * g.sxz + z * g.sx + x;
          if (g.data[i] && (!sel || sel(x, y, z))) this.swayIdx![i] = id;
        }
  }
  /** Add a body without picking voxels yet; returns its 1-based id for mark(). */
  body(preset: SwayPreset, pivot: [number, number, number], axis: [number, number, number] = [0, 0, 0], reach?: number): number {
    this.swayIdx ??= new Uint8Array(this.grid.data.length);
    this.bodies.push({ ...preset, pivot, axis, reach: reach ?? (preset.up > 0 ? this.grid.sy - pivot[1] : pivot[1]) * this.scale });
    return this.bodies.length;
  }
  /** Put one voxel into body `id`. */
  mark(x: number, y: number, z: number, id: number): void {
    const g = this.grid;
    if (g.inside(x, y, z)) this.swayIdx![y * g.sxz + z * g.sx + x] = id;
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

type SwayPreset = Omit<SwayBody, 'pivot' | 'axis' | 'reach'>;

/** Rotate a prop around Y by quarter turns. Turn 1 maps "facing +Z" to "facing +X". */
export function rotateProp(p: Prop, turns: number): Prop {
  turns = ((turns % 4) + 4) % 4;
  if (turns === 0) return p;
  let cur = p;
  for (let t = 0; t < turns; t++) {
    const g = cur.grid;
    const n = new Prop(g.sz, g.sy, g.sx, cur.scale);
    const si = cur.swayIdx;
    if (si) n.swayIdx = new Uint8Array(si.length);
    for (let y = 0; y < g.sy; y++)
      for (let z = 0; z < g.sz; z++)
        for (let x = 0; x < g.sx; x++) {
          const v = g.get(x, y, z);
          if (!v) continue;
          n.set(z, y, g.sx - 1 - x, v);
          if (si) n.swayIdx![y * n.grid.sxz + (g.sx - 1 - x) * n.grid.sx + z] = si[y * g.sxz + z * g.sx + x];
        }
    // continuous voxel coords: (x, y, z) -> (z, y, sx - x); directions (x, y, z) -> (z, y, -x)
    n.bodies = cur.bodies.map((b) => ({ ...b, pivot: [b.pivot[2], b.pivot[1], g.sx - b.pivot[0]], axis: [b.axis[2], b.axis[1], -b.axis[0] || 0] }));
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
    leaf: a(0x4f8a3a, { vary: 0.14, leaf: true }),
    leafDark: a(0x35662c, { vary: 0.14, leaf: true }),
    leafLight: a(0x7fb04e, { vary: 0.12, leaf: true }),
    pine: a(0x2f5a35, { vary: 0.12, leaf: true }),
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
    postRed: a(0xd23a2e, { vary: 0.03 }),
    mirrorOrange: a(0xf07a2a, { vary: 0.03 }),
    mirror: a(0xcfe3ee, { emit: 0.2, vary: 0.02 }),
    cubRed: a(0xc8362e, { vary: 0.03 }),
    cubCream: a(0xefe6cf, { vary: 0.03 }),
    binBlue: a(0x2f6fb5, { vary: 0.03 }),
    binGreen: a(0x3c8a52, { vary: 0.03 }),
    binYellow: a(0xe8c23a, { vary: 0.03 }),
    netBlue: a(0x3a7fd0, { vary: 0.06 }),
    flowerRed: a(0xe0473f, { vary: 0.08 }),
    flowerYellow: a(0xf5cf3a, { vary: 0.08 }),
    flowerPurple: a(0x8d5fc0, { vary: 0.08 }),
    flowerWhite: a(0xfbf8f0, { vary: 0.04 }),
    flowerOrange: a(0xf29a3c, { vary: 0.08 }),
    bucket: a(0x9aa6b0, { vary: 0.04 }),
    bookA: a(0x9a3b32, { vary: 0.06 }), bookB: a(0x2f5a88, { vary: 0.06 }), bookC: a(0xd9c49a, { vary: 0.06 }), bookD: a(0x3f6b45, { vary: 0.06 }), bookE: a(0xe8e1cf, { vary: 0.04 }),
    ice: a(0xe4f3f8, { vary: 0.04 }),
    fishSilver: a(0xa8b4bc, { vary: 0.08 }), fishRed: a(0xd9604a, { vary: 0.06 }), fishDark: a(0x4a5560, { vary: 0.06 }),
    styro: a(0xf4f4ef, { vary: 0.02 }),
    bread: a(0xd9a05a, { vary: 0.08 }), breadDark: a(0xa86a32, { vary: 0.08 }),
    greenCross: a(0x34b25a, { emit: 0.8, vary: 0.02 }),
    bollard: a(0xe9e4da, { vary: 0.03 }),
    jizoStone: a(0x8e8a84, { vary: 0.1 }),
    meter: a(0xc9ccc6, { vary: 0.03 }),
    pipe: a(0x9a9c98, { vary: 0.04 }),
    umbrella: a(0x3a6ab0, { vary: 0.05 }),
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
  p.sway(SWAY.lantern, [cx, h + 3, cz]);
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
  p.sway(SWAY.giant, [cx, h + 4, cz]);
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
    // each panel swings on the rod by itself
    p.sway(SWAY.noren, [(x0 + x1 + 1) / 2, h + 1.5, 1], [1, 0, 0], (x, y) => x >= x0 && x <= x1 && y <= h);
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
      // every cane sways on its own from the soil
      const id = p.body({ ...SWAY.bamboo, freq: SWAY.bamboo.freq * (0.85 + i * 0.1) }, [x + 0.5, 4, z + 0.5]);
      for (let y = 4; y < h; y++) { p.set(x, y, z, y % 4 === 0 ? c.leafDark : c.leafLight); p.mark(x, y, z, id); }
      p.ellipsoid(x + 0.5, h, z + 0.5, 2, 1.5, 2, (xx, yy, zz) => { p.mark(xx, yy, zz, id); return (xx + yy + zz) % 3 ? c.leaf : c.leafLight; });
    }
    return p;
  }
  if (kind === 'pine') {
    const p = new Prop(9, 10, 9);
    p.box(2, 0, 2, 6, 2, 6, pot);
    p.box(4, 3, 4, 4, 6, 4, c.woodDark);
    p.ellipsoid(3.5, 6.5, 4.5, 3, 1.5, 2.5, c.pine);
    p.ellipsoid(6, 8, 4.5, 2.5, 1.3, 2.2, c.pine);
    p.sway(SWAY.pine, [4.5, 3, 4.5], undefined, (_x, y) => y >= 3);
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
  p.sway(kind === 'flowers' ? SWAY.flowers : SWAY.shrub, [3.5, 4, 3.5], undefined, (x, y, z) => p.get(x, y, z) !== pot);
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
  // the banner turns a little on its pole
  p.sway(SWAY.flag, [0.5, 0, 0.5], [0, 1, 0], (x) => x >= 1, 0);
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
  // swings about the line between its two ends, which stay put
  p.sway(SWAY.wire, [0, sagV + 1.5, 0.5], [1, 0, 0], undefined, 0);
  p.wireSag = sagV * s;
  return p;
}

export function utilityTransformer(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(5, 6, 4);
  p.cylY(2.5, 2, 2.2, 0, 4, c.acDark);
  p.cylY(2.5, 2, 1.2, 5, 5, c.steelDark);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Street furniture and shop dressing (v0.2)

/** Red cylindrical Japan Post box. */
export function postBox(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(6, 12, 6);
  p.cylY(3, 3, 2.6, 0, 1, c.charcoal);
  p.cylY(3, 3, 2.6, 2, 10, c.postRed);
  p.cylY(3, 3, 2.2, 11, 11, c.postRed);
  p.box(1, 8, 5, 4, 8, 5, c.black);
  p.box(2, 5, 5, 3, 6, 5, c.white);
  return p;
}

/** Orange-poled convex traffic mirror for blind corners. */
export function trafficMirror(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(9, 30, 3, 0.0625);
  p.box(4, 0, 1, 4, 22, 1, c.mirrorOrange);
  p.cylY(4.5, 1.5, 4.2, 22, 22, c.mirrorOrange);
  for (let y = 23; y <= 29; y++) {
    const r = Math.sqrt(Math.max(0, 16 - (y - 26) ** 2));
    for (let x = 0; x < 9; x++) if (Math.abs(x + 0.5 - 4.5) <= r) { p.set(x, y, 1, c.mirrorOrange); if (Math.abs(x + 0.5 - 4.5) <= r - 0.8 && y > 23 && y < 29) p.set(x, y, 2, c.mirror); }
  }
  return p;
}

export function bollard(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(3, 7, 3, 0.0625);
  p.box(0, 0, 0, 2, 6, 2, c.bollard);
  p.box(0, 4, 0, 2, 4, 2, c.mirrorOrange);
  return p;
}

/** A little delivery scooter (Super Cub style) with a top box. */
export function scooter(k: PropKit, body: number): Prop {
  const { c } = k;
  const p = new Prop(24, 18, 5, 0.0625);
  const wheel = (cx: number) => { for (let a = 0; a < 28; a++) { const t = (a / 28) * Math.PI * 2; p.box(Math.round(cx + Math.cos(t) * 3), Math.round(3 + Math.sin(t) * 3), 1, Math.round(cx + Math.cos(t) * 3), Math.round(3 + Math.sin(t) * 3), 3, c.tireBlack); } };
  wheel(4); wheel(19);
  p.box(7, 4, 1, 16, 6, 3, body);
  p.box(15, 6, 1, 18, 10, 3, body);
  p.box(17, 10, 0, 19, 13, 4, c.cubCream);
  p.box(18, 14, 0, 18, 14, 4, c.chrome);
  p.box(8, 7, 1, 13, 8, 3, c.black);
  p.box(2, 7, 0, 7, 12, 4, c.white);
  p.box(3, 9, 4, 6, 10, 4, c.postRed);
  p.box(20, 11, 2, 20, 12, 2, c.lampHead);
  return p;
}

/** A-frame chalkboard menu stand. */
export function aFrame(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(7, 12, 5, 0.0625);
  for (let y = 0; y < 12; y++) {
    const off = Math.round((11 - y) * 0.15);
    p.box(0, y, 4 - off, 6, y, 4 - off, y === 0 || y === 11 ? c.woodDark : c.charcoal);
    p.box(0, y, off, 6, y, off, c.woodDark);
  }
  for (let y = 3; y < 10; y += 2) for (let x = 1; x < 6; x++) if (r() < 0.6) p.set(x, y, 4 - Math.round((11 - y) * 0.15), r() < 0.2 ? c.flowerYellow : c.white);
  return p;
}

/** Colour-coded rubbish and recycling bins under a blue crow net. */
export function binCorner(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(14, 8, 5, 0.0625);
  p.box(0, 0, 0, 3, 6, 4, c.binBlue);
  p.box(5, 0, 0, 8, 6, 4, c.binGreen);
  p.box(10, 0, 0, 13, 6, 4, c.binYellow);
  for (let x = 0; x < 14; x++) if (x % 5 !== 4) p.box(x, 7, 0, x, 7, 4, (x + 0) % 2 ? c.netBlue : 0);
  return p;
}

/** Florist display: tiered buckets of cut flowers. */
export function flowerStand(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(16, 12, 7, 0.0625);
  p.box(0, 0, 0, 15, 3, 2, c.woodLight);
  p.box(0, 0, 3, 15, 1, 6, c.woodLight);
  const fl = [c.flowerRed, c.flowerYellow, c.flowerPurple, c.flowerWhite, c.flowerOrange, c.pink];
  for (let i = 0; i < 5; i++) {
    for (const [z0, y0] of [[0, 4], [4, 2]] as [number, number][]) {
      const x0 = i * 3 + 0;
      p.box(x0, y0, z0, x0 + 2, y0 + 2, z0 + 2, c.bucket);
      const col = fl[Math.floor(r() * fl.length)];
      for (let x = x0; x <= x0 + 2; x++) for (let z = z0; z <= z0 + 2; z++) {
        const h = y0 + 3 + Math.floor(r() * 3);
        p.box(x, y0 + 3, z, x, h - 1, z, c.leafDark);
        p.set(x, h, z, r() < 0.8 ? col : c.leafLight);
      }
      p.sway(SWAY.flowers, [x0 + 1.5, y0 + 3, z0 + 1.5], undefined, (x, y, z) => x >= x0 && x <= x0 + 2 && z >= z0 && z <= z0 + 2 && y >= y0 + 3);
    }
  }
  return p;
}

/** Second-hand book cart with spines facing out. */
export function bookCart(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(16, 9, 6, 0.0625);
  p.box(0, 0, 0, 15, 2, 5, c.woodDark);
  p.box(0, 3, 0, 15, 3, 5, c.wood);
  const bk = [c.bookA, c.bookB, c.bookC, c.bookD, c.bookE];
  for (let x = 1; x < 15; x++) {
    const h = 2 + Math.floor(r() * 3);
    const col = bk[Math.floor(r() * bk.length)];
    p.box(x, 4, 1, x, 3 + h, 4, col);
  }
  p.box(0, 4, 5, 15, 4, 5, c.wood);
  return p;
}

/** Fishmonger's crushed-ice tray with whole fish. */
export function fishDisplay(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(16, 8, 8, 0.0625);
  p.box(0, 0, 0, 15, 4, 7, c.styro);
  p.box(1, 5, 1, 14, 5, 6, c.ice);
  for (let i = 0; i < 6; i++) {
    const x0 = 1 + Math.floor(r() * 9), z = 1 + Math.floor(r() * 6), len = 4 + Math.floor(r() * 3);
    const col = [c.fishSilver, c.fishRed, c.fishDark][Math.floor(r() * 3)];
    p.box(x0, 6, z, Math.min(14, x0 + len - 1), 6, z, col);
    p.set(Math.min(14, x0 + len), 6, z, c.black);
  }
  for (let x = 2; x < 14; x += 4) p.box(x, 6, 0, x + 1, 7, 0, c.flowerYellow);
  return p;
}

/** Bakery shelf with buns and loaves. */
export function breadShelf(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(14, 10, 5, 0.0625);
  p.box(0, 0, 0, 13, 9, 0, c.woodLight);
  for (const y of [0, 4, 8]) p.box(0, y, 0, 13, y, 4, c.woodLight);
  for (const y of [1, 5]) for (let x = 1; x < 13; x += 3) if (r() < 0.85) p.box(x, y, 1, x + 1, y + 1, 3, r() < 0.5 ? c.bread : c.breadDark);
  return p;
}

/** Stone jizō statue wearing a red bib and cap. */
export function jizo(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(6, 12, 6, 0.0625);
  p.box(0, 0, 0, 5, 1, 5, c.stoneDark);
  p.box(1, 2, 1, 4, 7, 4, c.jizoStone);
  p.box(1, 5, 4, 4, 7, 5, c.catRedBib);
  p.ellipsoid(3, 9, 3, 2, 2, 2, c.jizoStone);
  p.box(1, 10, 1, 4, 11, 4, c.catRedBib);
  p.set(2, 9, 5, c.charcoal); p.set(3, 9, 5, c.charcoal);
  return p;
}

/** Wall-mounted electricity meter cluster. */
export function meters(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(6, 6, 2, 0.0625);
  p.box(0, 0, 0, 5, 5, 0, c.meter);
  p.box(1, 1, 1, 2, 3, 1, c.black);
  p.box(3, 1, 1, 4, 3, 1, c.black);
  p.box(1, 4, 1, 4, 4, 1, c.steelDark);
  return p;
}

/** Rooftop billboard with a bold graphic; lit at night. */
export function billboard(k: PropKit, bg: number, fg: number, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(24, 16, 3);
  for (const x of [3, 20]) p.box(x, 0, 1, x, 7, 1, c.steelDark);
  p.box(0, 7, 2, 23, 15, 2, bg);
  p.box(0, 7, 1, 23, 7, 1, c.steelDark);
  const g = glyph(r, 5), g2 = glyph(r, 5);
  for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) {
    if (g[y][x]) p.set(3 + x, 13 - y, 3 >= p.sz ? 2 : 2, fg);
    if (g2[y][x]) p.set(10 + x, 13 - y, 2, fg);
  }
  p.box(17, 9, 2, 21, 13, 2, fg === c.white ? c.neonYellow : c.white);
  p.box(0, 15, 0, 23, 15, 0, c.lampNight);
  return p;
}

/** A tall TV antenna on a mast. */
export function antenna(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(9, 24, 3, 0.0625);
  p.box(4, 0, 1, 4, 23, 1, c.steel);
  for (const y of [16, 19, 22]) p.box(0, y, 1, 8, y, 1, c.steel);
  for (let x = 0; x < 9; x += 2) p.box(x, 20, 0, x, 20, 2, c.steel);
  return p;
}

/** Rooftop vegetable/flower planter box. */
export function planterBox(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(12, 6, 4, 0.0625);
  p.box(0, 0, 0, 11, 2, 3, c.woodLight);
  for (let x = 0; x < 12; x++) for (let z = 0; z < 4; z++) {
    if (r() < 0.75) { const h = 3 + Math.floor(r() * 3); p.box(x, 3, z, x, h - 1, z, r() < 0.5 ? c.leaf : c.leafDark); if (r() < 0.25) p.set(x, h, z, [c.flowerRed, c.flowerYellow, c.flowerWhite][Math.floor(r() * 3)]); }
  }
  p.sway(SWAY.flowers, [6, 3, 2], undefined, (_x, y) => y >= 3, 0);
  return p;
}

/** Folded patio umbrella for café terraces. */
export function cafeTable(k: PropKit, cloth: number): Prop {
  const { c } = k;
  const p = new Prop(9, 18, 9, 0.0625);
  p.box(4, 0, 4, 4, 15, 4, c.steelDark);
  p.box(2, 0, 2, 6, 0, 6, c.steelDark);
  p.cylY(4.5, 4.5, 3.4, 6, 6, c.white);
  for (let y = 14; y <= 17; y++) p.cylY(4.5, 4.5, 4.4 - (y - 14) * 1.2, y, y, cloth);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Set dressing for the wider city (see world/dressing.ts)

/** A row of small pots against a house front, the way Tokyo backstreets grow their gardens. Faces +Z, 1 m long. */
export function potCluster(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(16, 15, 6, 0.0625);
  const pots = [c.terracotta, c.terracotta, c.glazeBlue, c.stone, c.white, c.bucket];
  let x = 0;
  while (x < 13) {
    const w = 3 + Math.floor(r() * 3);
    if (x + w > 16) break;
    const h = 2 + Math.floor(r() * 3);
    const z0 = r() < 0.5 ? 0 : 6 - w;
    const pot = pots[Math.floor(r() * pots.length)];
    p.box(x, 0, z0, x + w - 1, h - 1, z0 + w - 1, pot);
    p.box(x + 1, h - 1, z0 + 1, x + w - 2, h - 1, z0 + w - 2, c.coalDark); // soil
    const cx = x + w / 2, cz = z0 + w / 2;
    const roll = r();
    if (roll < 0.45) {
      // leafy, sometimes in flower
      const flower = r() < 0.5 ? [c.flowerRed, c.flowerPurple, c.flowerYellow, c.flowerWhite, c.pink][Math.floor(r() * 5)] : 0;
      const id = p.body(flower ? SWAY.flowers : SWAY.shrub, [cx, h, cz]);
      const rx = w / 2 + 0.6, ry = 1.6 + r() * 1.6;
      p.ellipsoid(cx, h + ry - 0.4, cz, rx, ry, rx, (xx, yy, zz) => { p.mark(xx, yy, zz, id); const n = (xx * 7 + yy * 13 + zz * 5) % 7; return flower && n === 0 ? flower : n < 3 ? c.leafDark : n < 5 ? c.leaf : c.leafLight; });
    } else if (roll < 0.75) {
      // tall stems: morning glory canes, herbs, a young maple
      const id = p.body(SWAY.grass, [cx, h, cz]);
      const tall = 5 + Math.floor(r() * 6);
      for (let i = 0; i < 3; i++) {
        const sx = x + 1 + Math.floor(r() * Math.max(1, w - 2)), sz = z0 + 1 + Math.floor(r() * Math.max(1, w - 2));
        const top = Math.min(14, h + tall - i);
        for (let y = h; y <= top; y++) { p.set(sx, y, sz, y === top && r() < 0.5 ? c.flowerPurple : y % 3 === 0 ? c.leafLight : c.leaf); p.mark(sx, y, sz, id); }
      }
    } else {
      // a succulent or a little clipped box ball
      const id = p.body(SWAY.pine, [cx, h, cz]);
      p.ellipsoid(cx, h + 1, cz, w / 2, 1.5, w / 2, (xx, yy, zz) => { p.mark(xx, yy, zz, id); return (xx + yy + zz) % 3 ? c.leafDark : c.pine; });
    }
    x += w + (r() < 0.5 ? 0 : 1);
  }
  return p;
}

/** A tuft of grass, sometimes with a wildflower. */
export function grassTuft(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(5, 7, 5, 0.0625);
  const n = 4 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * 5), z = Math.floor(r() * 5);
    const h = 1 + Math.floor(r() * 5);
    const blade = r() < 0.5 ? c.leaf : c.leafLight; // one colour a blade, so its sides stay single faces
    for (let y = 0; y <= h; y++) p.set(x, y, z, y < 2 ? c.leafDark : blade);
    if (h >= 4 && r() < 0.25) p.set(x, h + 1, z, [c.flowerWhite, c.flowerYellow, c.flowerPurple][Math.floor(r() * 3)]);
  }
  p.sway(SWAY.grass, [2.5, 0, 2.5]);
  return p;
}

/** A rounded garden bush (azalea, hydrangea or box), about a metre across. */
export function bush(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(9, 7, 9);
  const bloom = r() < 0.55 ? [c.pink, c.flowerWhite, c.flowerPurple, c.flowerRed, c.navy][Math.floor(r() * 5)] : 0;
  const rx = 3.4 + r() * 1.0, ry = 2.6 + r() * 0.8;
  // broad bands of colour rather than per-voxel noise, so the faces merge (it is all over the parks)
  p.ellipsoid(4.5, ry - 0.2, 4.5, rx, ry, rx * (0.85 + r() * 0.15), (x, y, z) => {
    if (bloom && y > 1 && hash3(x, y, z + seed) < 0.12) return bloom;
    return y < ry * 0.7 ? c.leafDark : hash3(x >> 1, y >> 1, (z >> 1) + seed) < 0.6 ? c.leaf : c.leafLight;
  });
  p.sway(SWAY.bush, [4.5, 0, 4.5]);
  return p;
}

/** Umbrella stand by a door: a steel bucket with a few handles poking out. */
export function umbrellaStand(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(4, 11, 4, 0.0625);
  p.box(0, 0, 0, 3, 5, 3, c.steelDark);
  p.box(1, 5, 1, 2, 5, 2, c.charcoal);
  const cols = [c.umbrella, c.fabricRed, c.vmGlass, c.black, c.fabricGreen, c.white];
  for (const [x, z] of [[1, 1], [2, 2], [1, 2], [2, 1]]) {
    if (r() < 0.25) continue;
    const top = 7 + Math.floor(r() * 3);
    const col = cols[Math.floor(r() * cols.length)];
    p.box(x, 6, z, x, top, z, col);
    p.set(x, top + 1, z, c.woodDark);
  }
  return p;
}

/** A pair of propane cylinders chained to a house wall. */
export function gasTanks(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(9, 15, 4, 0.0625);
  for (const x of [0, 5]) {
    p.box(x, 0, 0, x + 3, 12, 3, c.acGray);
    p.box(x, 9, 0, x + 3, 9, 3, c.steelDark);
    p.box(x + 1, 13, 1, x + 2, 14, 2, c.steel);
  }
  return p;
}

/** White pavement guard rail along the kerb, `len` metres along +X. */
export function guardRail(k: PropKit, len: number): Prop {
  const { c } = k;
  const n = Math.max(4, Math.round(len / 0.0625));
  const p = new Prop(n, 12, 2, 0.0625);
  for (let x = 0; x < n; x += 16) p.box(x, 0, 0, x + 1, 11, 1, c.white);
  p.box(n - 2, 0, 0, n - 1, 11, 1, c.white);
  p.box(0, 10, 0, n - 1, 11, 1, c.white);
  p.box(0, 5, 0, n - 1, 5, 0, c.white);
  return p;
}

/** A string of little triangle flags hanging between two points along +X (length and sag in metres). */
export function bunting(k: PropKit, length: number, sag: number, seed = 1): Prop {
  const { c } = k;
  const s = 0.0625;
  const n = Math.max(2, Math.round(length / s));
  const sagV = Math.max(1, Math.round(sag / s));
  const p = new Prop(n, sagV + 6, 1, s);
  const cols = [c.fabricRed, c.white, c.fabricBlue, c.signYellow, c.fabricGreen, c.pink, c.fabricOrange];
  const off = Math.floor(rng(seed)() * cols.length);
  let prevY = sagV + 5;
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const y = Math.round(sagV + 5 - sagV * 4 * t * (1 - t));
    for (let yy = Math.min(y, prevY); yy <= Math.max(y, prevY); yy++) p.set(i, yy, 0, c.white);
    prevY = y;
    // a flag every 6 voxels: 4 wide, tapering down to a point
    const f = i % 6;
    if (i > 2 && i < n - 4 && f < 4) {
      const col = cols[(Math.floor(i / 6) + off) % cols.length];
      const depth = f === 0 || f === 3 ? 2 : 4;
      for (let d = 1; d <= depth; d++) p.set(i, y - d, 0, col);
    }
  }
  p.sway(SWAY.bunting, [0, sagV + 5.5, 0.5], [1, 0, 0], undefined, 0);
  return p;
}

/** Small shop sign hanging from a bracket that sticks out of the facade (faces +Z, swings across the street). */
export function hangingSign(k: PropKit, bg: number, fg: number, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(2, 12, 11, 0.0625);
  p.box(0, 11, 0, 1, 11, 10, c.steelDark); // bracket arm
  p.box(0, 8, 0, 1, 10, 0, c.steelDark);
  for (const z of [3, 9]) p.set(0, 10, z, c.steel), p.set(1, 10, z, c.steel);
  p.box(0, 1, 2, 1, 9, 10, bg);
  p.box(0, 1, 2, 1, 1, 10, c.signBlack);
  const g = glyph(r, 4);
  for (let gy = 0; gy < 4; gy++) for (let gz = 0; gz < 4; gz++) if (g[gy][gz]) { p.set(0, 7 - gy, 4 + gz, fg); p.set(1, 7 - gy, 8 - gz, fg); }
  p.sway(SWAY.sign, [1, 10.5, 6], [0, 0, 1], (_x, y, z) => y <= 10 && z >= 2);
  return p;
}

/** Glass wind chime (furin) with its paper strip. */
export function furin(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const p = new Prop(3, 10, 3, 0.0625);
  p.box(1, 7, 1, 1, 9, 1, c.white);
  p.box(0, 4, 0, 2, 6, 2, c.vmGlass);
  p.set(1, 6, 1, [c.fabricRed, c.fabricBlue, c.fabricGreen][seed % 3]);
  p.box(1, 0, 1, 1, 3, 1, [c.paper, c.pink, c.flowerYellow][seed % 3]);
  p.sway(SWAY.chime, [1.5, 10, 1.5]);
  return p;
}

/** Wooden planter with flowers for the middle of a pedestrian street, 1.5 m along +X. */
export function streetPlanter(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(12, 7, 4);
  p.box(0, 0, 0, 11, 2, 3, c.woodDark);
  p.box(1, 2, 1, 10, 2, 2, c.coalDark);
  const fl = [c.flowerRed, c.flowerYellow, c.flowerPurple, c.flowerWhite, c.pink, c.flowerOrange];
  const a = fl[Math.floor(r() * fl.length)], bb = fl[Math.floor(r() * fl.length)];
  for (let i = 0; i < 4; i++) {
    const x0 = 1 + i * 2.5;
    const id = p.body(SWAY.flowers, [x0 + 1.25, 3, 2]);
    p.ellipsoid(x0 + 1.25, 3.4, 2, 1.6, 1.4 + r() * 1.2, 1.4, (x, y, z) => { p.mark(x, y, z, id); const n = (x * 5 + y * 7 + z * 3) % 6; return n === 0 ? a : n === 3 ? bb : n < 3 ? c.leaf : c.leafDark; });
  }
  return p;
}

/** Laundry pole on two stands in a garden, with towels and shirts drying. 3 m along +X. */
export function laundryRack(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const r = rng(seed);
  const p = new Prop(24, 15, 5);
  for (const x of [0, 23]) { p.box(x, 0, 2, x, 14, 2, c.steelDark); p.box(x, 0, 0, x, 0, 4, c.steelDark); p.box(x, 13, 1, x, 13, 3, c.steelDark); }
  p.box(0, 14, 2, 23, 14, 2, c.steel);
  const cols = [c.white, c.fabricBlue, c.pink, c.flowerYellow, c.fabricGreen, c.white, c.fabricRed];
  let x = 2;
  while (x < 21) {
    const w = 2 + Math.floor(r() * 3), h = 4 + Math.floor(r() * 4);
    if (x + w > 22) break;
    const col = cols[Math.floor(r() * cols.length)];
    p.box(x, 14 - h, 2, x + w - 1, 13, 2, col);
    if (r() < 0.4) p.box(x, 14 - h, 2, x + w - 1, 14 - h, 2, c.white); // a stripe at the hem
    p.sway(SWAY.laundry, [x + w / 2, 14.5, 2.5], [1, 0, 0], (xx, yy) => xx >= x && xx < x + w && yy <= 13);
    x += w + 1;
  }
  return p;
}

/** A playground swing set: green A-frames, two seats on chains. 2.75 m along +X. */
export function swingSet(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(22, 19, 9);
  for (const x of [0, 21]) for (let y = 0; y <= 17; y++) {
    const dz = Math.round((17 - y) * 4 / 17);
    p.set(x, y, 4 - dz, c.poleGreen); p.set(x, y, 4 + dz, c.poleGreen);
  }
  p.box(0, 18, 4, 21, 18, 4, c.poleGreen);
  for (const sx of [5, 14]) {
    p.box(sx, 4, 4, sx, 17, 4, c.steel);
    p.box(sx + 2, 4, 4, sx + 2, 17, 4, c.steel);
    p.box(sx, 3, 3, sx + 2, 3, 5, sx === 5 ? c.fabricRed : c.fabricBlue);
    p.sway(SWAY.swing, [sx + 1.5, 18.5, 4.5], [1, 0, 0], (x, y) => x >= sx && x <= sx + 2 && y <= 17);
  }
  return p;
}

/** A small playground slide, ladder at the back. Slides down towards +Z. */
export function slide(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(6, 15, 20);
  for (const x of [0, 5]) p.box(x, 0, 16, x, 14, 16, c.poleGreen), p.box(x, 0, 19, x, 14, 19, c.poleGreen);
  for (let y = 2; y <= 11; y += 3) p.box(1, y, 19, 4, y, 19, c.steel);
  p.box(0, 11, 16, 5, 11, 19, c.signYellow);
  p.box(0, 14, 16, 5, 14, 19, c.fabricRed);
  for (let z = 0; z < 16; z++) {
    const h = Math.max(0, Math.round((z / 15) * 10));
    p.box(1, h, z, 4, h, z, c.fabricOrange);
    p.set(0, h + 1, z, c.fabricOrange); p.set(5, h + 1, z, c.fabricOrange);
    if (z % 5 === 4 && h > 1) p.box(2, 0, z, 3, h - 1, z, c.poleGreen);
  }
  return p;
}

/** Shopping-street lamp post with a cloth banner on an arm (arm along +X); the banner swings from the arm. */
export function bannerPole(k: PropKit, cloth: number, fg: number, seed = 1): Prop {
  const { c } = k;
  const p = new Prop(7, 32, 3);
  p.box(0, 0, 0, 2, 1, 2, c.poleGreen);
  p.box(1, 2, 1, 1, 29, 1, c.poleGreen);
  p.box(0, 30, 0, 2, 30, 2, c.poleGreen);
  p.box(0, 28, 0, 2, 29, 2, c.lampNight);
  p.box(1, 27, 1, 6, 27, 1, c.poleGreen);
  p.box(3, 15, 1, 6, 26, 1, cloth);
  p.box(3, 15, 1, 6, 15, 1, fg);
  const g = glyph(rng(seed), 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) if (g[y][x] && x < 4) p.set(3 + x, 24 - y * 2, 1, fg);
  p.sway({ ...SWAY.noren, push: 0 }, [4.5, 27, 1.5], [1, 0, 0], (x, y) => x >= 3 && y <= 26, 0);
  return p;
}

// ---------------------------------------------------------------------------------------------
// Street detail: signals, cones, utility boxes (see world/dressing.ts)

/** Traffic signal on a pole with its arm reaching out along +X over the road, a walk signal on the pole facing +Z. */
export function trafficLight(k: PropKit, phase = 0): Prop {
  const { c } = k;
  const p = new Prop(14, 38, 3);
  p.box(0, 0, 0, 2, 1, 2, c.poleGray);
  p.box(1, 2, 1, 1, 36, 1, c.poleGray);
  p.box(1, 35, 1, 13, 35, 1, c.poleGray);
  // three-lamp head hanging under the arm, facing +Z: one lamp lit
  p.box(6, 32, 0, 13, 34, 2, c.charcoal);
  const lit = [c.neonGreen, c.neonYellow, c.neonRed][phase % 3];
  for (const [i, x] of [[0, 7], [1, 9.5], [2, 12]] as [number, number][]) p.box(Math.floor(x), 33, 2, Math.floor(x) + (i === 1 ? 0 : 0), 33, 2, i === (phase % 3) ? lit : c.black);
  // pedestrian signal: red man over blue-green man
  p.box(2, 20, 0, 4, 25, 2, c.charcoal);
  p.box(3, 23, 2, 3, 24, 2, phase % 3 === 0 ? c.black : c.neonRed);
  p.box(3, 21, 2, 3, 22, 2, phase % 3 === 0 ? c.neonGreen : c.black);
  // push-button box
  p.box(2, 10, 1, 2, 12, 2, c.signYellow);
  return p;
}

/** Red and white traffic cone. */
export function trafficCone(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(5, 9, 5, 0.0625);
  p.box(0, 0, 0, 4, 0, 4, c.fabricRed);
  for (let y = 1; y < 9; y++) {
    const r = 2.2 - y * 0.2;
    p.cylY(2.5, 2.5, r, y, y, y === 4 || y === 5 ? c.white : c.fabricRed);
  }
  return p;
}

/** Yellow and black road-works barrier, 1.5 m along +X. */
export function workBarrier(k: PropKit): Prop {
  const { c } = k;
  const p = new Prop(24, 12, 3, 0.0625);
  for (const x of [1, 21]) { p.box(x, 0, 0, x + 1, 11, 0, c.steelDark); p.box(x - 1, 0, 0, x + 2, 0, 2, c.steelDark); }
  p.box(0, 7, 1, 23, 10, 1, (x) => ((x >> 2) % 2 ? c.signYellow : c.black));
  p.box(0, 3, 1, 23, 4, 1, (x) => ((x >> 2) % 2 ? c.signYellow : c.black));
  return p;
}

/** Grey utility cabinet on its plinth (electric or telecom), 0.75 m wide, door facing +Z. */
export function utilityBox(k: PropKit, seed = 1): Prop {
  const { c } = k;
  const p = new Prop(12, 18, 6, 0.0625);
  p.box(0, 0, 0, 11, 1, 5, c.stoneDark);
  p.box(0, 2, 0, 11, 17, 5, c.acGray);
  p.box(1, 3, 5, 10, 16, 5, c.poleGray);
  p.box(9, 9, 5, 9, 10, 5, c.steelDark);
  p.box(2, 13, 5, 4, 15, 5, (seed & 1) ? c.signYellow : c.white); // warning sticker
  return p;
}
