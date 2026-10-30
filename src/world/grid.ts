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

/**
 * Sparse voxel volume for the city: 8^3 bricks, where a brick whose voxels all hold the same value
 * (open air, solid earth, the inside of a wall) costs nothing but its table entry. Coordinates are
 * builder voxel coordinates; the volume covers [x0, x0 + sx) x [0, sy) x [z0, z0 + sz). A window
 * (wx0..wx1, wz0..wz1) limits what is stored: writes outside it are dropped and reads return 0, so a
 * worker can run the whole city builder while keeping only its own strip.
 */
export class SparseGrid {
  readonly bx: number;
  readonly by: number;
  readonly bz: number;
  /** >= 0: brick slot; < 0: uniform brick of value -(t + 1). */
  readonly table: Int32Array;
  pool: Uint16Array;
  slots = 0;
  private free: number[] = [];

  constructor(
    readonly x0: number, readonly z0: number, readonly sx: number, readonly sy: number, readonly sz: number,
    readonly wx0 = x0, readonly wz0 = z0, readonly wx1 = x0 + sx, readonly wz1 = z0 + sz,
  ) {
    this.bx = Math.ceil(sx / 8);
    this.by = Math.ceil(sy / 8);
    this.bz = Math.ceil(sz / 8);
    this.table = new Int32Array(this.bx * this.by * this.bz).fill(-1);
    this.pool = new Uint16Array(512 * 256);
  }

  inside(x: number, y: number, z: number): boolean {
    return x >= this.wx0 && z >= this.wz0 && x < this.wx1 && z < this.wz1 && y >= 0 && y < this.sy;
  }

  /** Does the box (inclusive, builder coords) touch the stored window at all? */
  touches(x0: number, z0: number, x1: number, z1: number): boolean {
    return Math.max(x0, x1) >= this.wx0 && Math.min(x0, x1) < this.wx1 && Math.max(z0, z1) >= this.wz0 && Math.min(z0, z1) < this.wz1;
  }

  get(x: number, y: number, z: number): number {
    if (x < this.wx0 || z < this.wz0 || x >= this.wx1 || z >= this.wz1 || y < 0 || y >= this.sy) return 0;
    x -= this.x0; z -= this.z0;
    const t = this.table[((y >> 3) * this.bz + (z >> 3)) * this.bx + (x >> 3)];
    return t < 0 ? -t - 1 : this.pool[(t << 9) | ((y & 7) << 6) | ((z & 7) << 3) | (x & 7)];
  }

  set(x: number, y: number, z: number, v: number): void {
    x |= 0; y |= 0; z |= 0;
    if (x < this.wx0 || z < this.wz0 || x >= this.wx1 || z >= this.wz1 || y < 0 || y >= this.sy) return;
    x -= this.x0; z -= this.z0;
    const bi = ((y >> 3) * this.bz + (z >> 3)) * this.bx + (x >> 3);
    let t = this.table[bi];
    if (t < 0) {
      if (-t - 1 === v) return;
      t = this.alloc(bi, -t - 1);
    }
    this.pool[(t << 9) | ((y & 7) << 6) | ((z & 7) << 3) | (x & 7)] = v;
  }

  private alloc(bi: number, fill: number): number {
    let t = this.free.pop();
    if (t === undefined) {
      t = this.slots++;
      if ((t + 1) * 512 > this.pool.length) {
        const p = new Uint16Array(this.pool.length * 2);
        p.set(this.pool);
        this.pool = p;
      }
    }
    this.pool.fill(fill, t << 9, (t + 1) << 9);
    this.table[bi] = t;
    return t;
  }

  /** Inclusive box fill. Whole bricks covered by a constant fill become uniform. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number | ((x: number, y: number, z: number) => number)): void {
    const ax = Math.max(this.wx0, Math.min(x0, x1) | 0), bx = Math.min(this.wx1 - 1, Math.max(x0, x1) | 0);
    const ay = Math.max(0, Math.min(y0, y1) | 0), by = Math.min(this.sy - 1, Math.max(y0, y1) | 0);
    const az = Math.max(this.wz0, Math.min(z0, z1) | 0), bz = Math.min(this.wz1 - 1, Math.max(z0, z1) | 0);
    if (ax > bx || ay > by || az > bz) return;
    if (typeof v === 'function') {
      for (let y = ay; y <= by; y++)
        for (let z = az; z <= bz; z++)
          for (let x = ax; x <= bx; x++) this.set(x, y, z, v(x, y, z));
      return;
    }
    // walk brick by brick; full bricks are set uniform, partial ones voxel by voxel
    const lx0 = ax - this.x0, lx1 = bx - this.x0, lz0 = az - this.z0, lz1 = bz - this.z0;
    for (let byi = ay >> 3; byi <= by >> 3; byi++)
      for (let bzi = lz0 >> 3; bzi <= lz1 >> 3; bzi++)
        for (let bxi = lx0 >> 3; bxi <= lx1 >> 3; bxi++) {
          const yA = Math.max(ay, byi * 8), yB = Math.min(by, byi * 8 + 7);
          const zA = Math.max(lz0, bzi * 8), zB = Math.min(lz1, bzi * 8 + 7);
          const xA = Math.max(lx0, bxi * 8), xB = Math.min(lx1, bxi * 8 + 7);
          const bi = (byi * this.bz + bzi) * this.bx + bxi;
          if (yB - yA === 7 && zB - zA === 7 && xB - xA === 7) {
            const t = this.table[bi];
            if (t >= 0) this.free.push(t);
            this.table[bi] = -v - 1;
            continue;
          }
          let t = this.table[bi];
          if (t < 0) {
            if (-t - 1 === v) continue;
            t = this.alloc(bi, -t - 1);
          }
          for (let y = yA; y <= yB; y++)
            for (let z = zA; z <= zB; z++) {
              const o = (t << 9) | ((y & 7) << 6) | ((z & 7) << 3);
              this.pool.fill(v, o | (xA & 7), (o | (xB & 7)) + 1);
            }
        }
  }

  /** Fill only empty cells. */
  boxIfEmpty(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
    this.box(x0, y0, z0, x1, y1, z1, (x, y, z) => this.get(x, y, z) || v);
  }

  /** Turn bricks that ended up uniform back into table entries (after building). */
  compact(): void {
    for (let bi = 0; bi < this.table.length; bi++) {
      const t = this.table[bi];
      if (t < 0) continue;
      const o = t << 9, v = this.pool[o];
      let uni = true;
      for (let i = 1; i < 512; i++) if (this.pool[o + i] !== v) { uni = false; break; }
      if (uni) { this.table[bi] = -v - 1; this.free.push(t); }
    }
  }

  /** Bytes held by brick storage. */
  get bytes(): number {
    return this.pool.byteLength + this.table.byteLength;
  }

  /**
   * Dense copy of a column range (builder coords, exclusive end) with a one-voxel border, for meshing.
   * Cells outside the world below `groundBelow` read as solid (value 1) so the ground's cut edge stays hidden.
   */
  extract(x0: number, x1: number, z0: number, z1: number, groundBelow: number): Grid {
    const w = x1 - x0 + 2, d = z1 - z0 + 2;
    const out = new Grid(w, this.sy, d);
    const wX0 = this.x0, wX1 = this.x0 + this.sx, wZ0 = this.z0, wZ1 = this.z0 + this.sz;
    for (let y = 0; y < this.sy; y++)
      for (let z = 0; z < d; z++) {
        const gz = z0 - 1 + z;
        let i = y * out.sxz + z * w;
        for (let x = 0; x < w; x++, i++) {
          const gx = x0 - 1 + x;
          if (gx < wX0 || gx >= wX1 || gz < wZ0 || gz >= wZ1) out.data[i] = y < groundBelow ? 1 : 0;
          else out.data[i] = this.get(gx, y, gz);
        }
      }
    return out;
  }
}
