// Dense voxel grid. Value 0 = empty, otherwise a palette index.
export class Grid {
  readonly data: Uint16Array;
  readonly sxz: number;
  constructor(public readonly sx: number, public readonly sy: number, public readonly sz: number) {
    this.data = new Uint16Array(sx * sy * sz);
    this.sxz = sx * sz;
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return 0;
    return this.data[y * this.sxz + z * this.sx + x];
  }

  set(x: number, y: number, z: number, v: number): void {
    x |= 0; y |= 0; z |= 0;
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return;
    this.data[y * this.sxz + z * this.sx + x] = v;
  }

  /** Inclusive box fill. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number | ((x: number, y: number, z: number) => number)): void {
    const ax = Math.max(0, Math.min(x0, x1) | 0), bx = Math.min(this.sx - 1, Math.max(x0, x1) | 0);
    const ay = Math.max(0, Math.min(y0, y1) | 0), by = Math.min(this.sy - 1, Math.max(y0, y1) | 0);
    const az = Math.max(0, Math.min(z0, z1) | 0), bz = Math.min(this.sz - 1, Math.max(z0, z1) | 0);
    const fn = typeof v === 'function';
    for (let y = ay; y <= by; y++)
      for (let z = az; z <= bz; z++) {
        let i = y * this.sxz + z * this.sx + ax;
        for (let x = ax; x <= bx; x++, i++) this.data[i] = fn ? (v as (x: number, y: number, z: number) => number)(x, y, z) : (v as number);
      }
  }

  /** Fill only empty cells. */
  boxIfEmpty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
    this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => this.get(x, y, z) || v);
  }
}

/** Small deterministic PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
