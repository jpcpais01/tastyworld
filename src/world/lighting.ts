import { SparseGrid } from './grid';

/**
 * Baked lighting for the static world.
 *
 * Sun shadows are computed by propagating light down through the voxel volume layer by layer along the
 * (fixed) sun direction. Each layer samples the layer above bilinearly, which naturally widens the
 * penumbra with distance from the occluder (contact-hardening soft shadows) at a cost of O(volume).
 * Sky visibility uses the same idea with a widening vertical cone, which gives large-scale ambient
 * occlusion: deep alleys and spaces under awnings get darker, open streets stay bright.
 *
 * Lamps (lanterns, signs, vending machines) are baked per vertex with a short occlusion march. Their
 * contribution is scaled at runtime by the night factor, so the whole day/night cycle is free.
 */

export interface Lamp {
  x: number; y: number; z: number; // coarse voxel space
  r: number; g: number; b: number; // linear-ish colour * intensity
  radius: number; // voxels
}

export class LightField {
  /** Per brick of the grid: >= 0 slot into the pools, < 0 uniform light -(sun | sky << 8) - 1. */
  private table: Int32Array;
  private sunPool: Uint8Array;
  private skyPool: Uint8Array;
  private slots = 0;
  private lamps: Lamp[] = [];
  private buckets = new Map<number, Lamp[]>();
  private static readonly B = 16;
  static work = 0;

  constructor(readonly grid: SparseGrid, readonly sunStep: [number, number]) {
    this.table = new Int32Array(grid.table.length).fill(-(255 | (255 << 8)) - 1);
    this.sunPool = new Uint8Array(512 * 1024);
    this.skyPool = new Uint8Array(512 * 1024);
    this.propagate();
  }

  get bytes(): number {
    return this.sunPool.byteLength + this.skyPool.byteLength + this.table.byteLength;
  }

  private alloc(bi: number): number {
    const t = this.slots++;
    if ((t + 1) * 512 > this.sunPool.length) {
      const a = new Uint8Array(this.sunPool.length * 2); a.set(this.sunPool); this.sunPool = a;
      const b = new Uint8Array(this.skyPool.length * 2); b.set(this.skyPool); this.skyPool = b;
    }
    const u = this.table[bi];
    if (u < 0) {
      const v = -u - 1;
      this.sunPool.fill(v & 255, t << 9, (t + 1) << 9);
      this.skyPool.fill(v >> 8, t << 9, (t + 1) << 9);
    }
    this.table[bi] = t;
    return t;
  }

  /**
   * Layer-by-layer sweep from the top. Work is tracked per 8x8 brick column: a brick is only computed when it
   * holds something solid or a neighbour in the layer above is not fully lit, so open sky above the roofs costs
   * next to nothing however tall the tallest tower is.
   */
  private propagate(): void {
    const g = this.grid;
    const X0 = g.wx0, Z0 = g.wz0;
    const sx = g.wx1 - g.wx0, sz = g.wz1 - g.wz0, sy = g.sy;
    if (((X0 - g.x0) & 7) || ((Z0 - g.z0) & 7) || (sx & 7) || (sz & 7)) throw new Error('light window must be brick aligned');
    const n = sx * sz;
    const bxOff = (X0 - g.x0) >> 3, bzOff = (Z0 - g.z0) >> 3;
    const nbx = sx >> 3, nbz = sz >> 3, nb = nbx * nbz;
    // highest brick row that holds anything solid in the window: above it the light is simply 1
    let top = -1;
    for (let byi = g.by - 1; byi >= 0 && top < 0; byi--)
      for (let bzi = 0; bzi < nbz && top < 0; bzi++)
        for (let bxi = 0; bxi < nbx; bxi++) {
          const t = g.table[(byi * g.bz + bzi + bzOff) * g.bx + bxi + bxOff];
          if (t !== -1) { top = byi * 8 + 7; break; }
        }
    // padded layer buffers: a two-cell border of open sky outside the window needs no bounds checks
    const PW = sx + 4, PD = sz + 4;
    let sunA = new Float32Array(PW * PD).fill(1);
    let skyA = new Float32Array(PW * PD).fill(1);
    let sunB = new Float32Array(PW * PD).fill(1);
    let skyB = new Float32Array(PW * PD).fill(1);
    let dirtyA = new Uint8Array(nb), dirtyB = new Uint8Array(nb);
    const stSun = new Uint8Array(n * 8), stSky = new Uint8Array(n * 8);
    const [ox, oz] = this.sunStep;
    const ix = Math.floor(ox), iz = Math.floor(oz);
    const fx = ox - ix, fz = oz - iz;
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    const sOff = iz * PW + ix; // sun source offset in the padded buffers
    const pool = g.pool, table = g.table;

    // per brick: does the B buffer hold anything but open sky? (skipped bricks then need no rewrite)
    let litA = new Uint8Array(nb).fill(1), litB = new Uint8Array(nb).fill(1); // 1 all lit, 2 all dark, 0 mixed
    const skipped = new Uint8Array(nb * 8);

    for (let y = Math.min(sy - 1, top); y >= 0; y--) {
      const byi = y >> 3, ly = (y & 7) << 6, so = (y & 7) * n, lyi = (y & 7) * nb;
      for (let bzi = 0; bzi < nbz; bzi++)
        for (let bxi = 0; bxi < nbx; bxi++) {
          const bi = bzi * nbx + bxi;
          const t = table[(byi * g.bz + bzi + bzOff) * g.bx + bxi + bxOff];
          let need = t === -1 ? 0 : t < 0 ? 2 : 1;
          for (let dz = -1; dz <= 1 && !need; dz++) {
            const zz = bzi + dz;
            if (zz < 0 || zz >= nbz) continue;
            for (let dx = -1; dx <= 1; dx++) {
              const xx = bxi + dx;
              if (xx >= 0 && xx < nbx && dirtyA[zz * nbx + xx]) { need = 1; break; }
            }
          }
          skipped[lyi + bi] = 0;
          if (need === 2) {
            // solid through and through: no light inside
            if (litB[bi] !== 2) {
              for (let k = 0; k < 8; k++) {
                const pr = (bzi * 8 + k + 2) * PW + bxi * 8 + 2;
                sunB.fill(0, pr, pr + 8);
                skyB.fill(0, pr, pr + 8);
              }
              litB[bi] = 2;
            }
            skipped[lyi + bi] = 2;
            dirtyB[bi] = 1;
            continue;
          }
          if (!need) {
            if (litB[bi] !== 1) {
              for (let k = 0; k < 8; k++) {
                const pr = (bzi * 8 + k + 2) * PW + bxi * 8 + 2;
                sunB.fill(1, pr, pr + 8);
                skyB.fill(1, pr, pr + 8);
              }
              litB[bi] = 1;
            }
            skipped[lyi + bi] = 1;
            dirtyB[bi] = 0;
            continue;
          }
          const po0 = t >= 0 ? (t << 9) | ly : -1;
          let dirty = 0;
          for (let k = 0; k < 8; k++) {
            const z = bzi * 8 + k;
            for (let j = 0; j < 8; j++) {
              const x = bxi * 8 + j;
              const i = z * sx + x, p = (z + 2) * PW + x + 2;
              let su = 0, sk = 0;
              if (po0 < 0 || pool[po0 | (k << 3) | j] === 0) {
                const q = p + sOff;
                su = sunA[q] * w00 + sunA[q + 1] * w10 + sunA[q + PW] * w01 + sunA[q + PW + 1] * w11;
                // sky weights sum to 0.9, renormalised so open sky stays at 1 while occluded columns darken
                sk = (skyA[p] * 0.28 + (skyA[p - 2] + skyA[p + 2] + skyA[p - 2 * PW] + skyA[p + 2 * PW]) * 0.13 + (skyA[p - PW - 1] + skyA[p + PW + 1]) * 0.05) / 0.9;
                if (sk > 0.996) sk = 1;
                if (su > 0.996) su = 1;
              }
              sunB[p] = su;
              skyB[p] = sk;
              if (su < 1 || sk < 1) dirty = 1;
              stSun[so + i] = (su * 255 + 0.5) | 0;
              stSky[so + i] = (sk * 255 + 0.5) | 0;
            }
          }
          dirtyB[bi] = dirty;
          litB[bi] = dirty ? 0 : 1;
          LightField.work++;
        }
      let t = sunA; sunA = sunB; sunB = t;
      t = skyA; skyA = skyB; skyB = t;
      let d = dirtyA; dirtyA = dirtyB; dirtyB = d;
      d = litA; litA = litB; litB = d;
      if ((y & 7) === 0) this.store(byi, stSun, stSky, skipped, sx, n, bxOff, bzOff, nbx, nbz, Math.min(sy - 1, top));
    }
  }

  /** Move one finished brick row of light from the staging layers into bricks (uniform ones stay table entries). */
  private store(byi: number, stSun: Uint8Array, stSky: Uint8Array, skipped: Uint8Array, sx: number, n: number, bxOff: number, bzOff: number, nbx: number, nbz: number, top: number): void {
    const g = this.grid;
    const yTop = Math.min(7, top - byi * 8); // layers above `top` were never written: fully lit
    for (let bzi = 0; bzi < nbz; bzi++)
      for (let bxi = 0; bxi < nbx; bxi++) {
        const bi = (byi * g.bz + bzi + bzOff) * g.bx + bxi + bxOff;
        const nb = nbx * nbz, bl = bzi * nbx + bxi;
        const first = skipped[bl];
        let same = first !== 0 && yTop === 7;
        for (let ly = 1; ly <= yTop && same; ly++) if (skipped[ly * nb + bl] !== first) same = false;
        if (same) { this.table[bi] = first === 1 ? -(255 | (255 << 8)) - 1 : -1; continue; }
        if (yTop < 7) {
          let lit = true;
          for (let ly = 0; ly <= yTop && lit; ly++) if (skipped[ly * nb + bl] !== 1) lit = false;
          if (lit) { this.table[bi] = -(255 | (255 << 8)) - 1; continue; }
        }
        // skipped layers are open sky or solid rock: make their staging say so before comparing / copying
        for (let ly = 0; ly <= yTop; ly++) {
          const sk = skipped[ly * nb + bl];
          if (!sk) continue;
          const v = sk === 1 ? 255 : 0;
          for (let k = 0; k < 8; k++) {
            const row = ly * n + (bzi * 8 + k) * sx + bxi * 8;
            stSun.fill(v, row, row + 8); stSky.fill(v, row, row + 8);
          }
        }
        const s0 = yTop < 7 ? 255 : stSun[bzi * 8 * sx + bxi * 8], k0 = yTop < 7 ? 255 : stSky[bzi * 8 * sx + bxi * 8];
        let uni = true;
        for (let ly = 0; ly <= yTop && uni; ly++)
          for (let k = 0; k < 8 && uni; k++) {
            const row = ly * n + (bzi * 8 + k) * sx + bxi * 8;
            for (let j = 0; j < 8; j++) if (stSun[row + j] !== s0 || stSky[row + j] !== k0) { uni = false; break; }
          }
        if (uni) { this.table[bi] = -(s0 | (k0 << 8)) - 1; continue; }
        const t = this.alloc(bi);
        for (let ly = 0; ly < 8; ly++)
          for (let k = 0; k < 8; k++) {
            const o = (t << 9) | (ly << 6) | (k << 3);
            if (ly > yTop) { this.sunPool.fill(255, o, o + 8); this.skyPool.fill(255, o, o + 8); continue; }
            const row = ly * n + (bzi * 8 + k) * sx + bxi * 8;
            this.sunPool.set(stSun.subarray(row, row + 8), o);
            this.skyPool.set(stSky.subarray(row, row + 8), o);
          }
      }
  }

  /** Sun and sky (0..255) of an air cell in builder voxel coords; outside the window it is open sky. */
  private light(x: number, y: number, z: number, out: Float32Array): void {
    const g = this.grid;
    if (y >= g.sy || x < g.wx0 || z < g.wz0 || x >= g.wx1 || z >= g.wz1) { out[0] = 255; out[1] = 255; return; }
    const lx = x - g.x0, lz = z - g.z0;
    const t = this.table[((y >> 3) * g.bz + (lz >> 3)) * g.bx + (lx >> 3)];
    if (t < 0) { const v = -t - 1; out[0] = v & 255; out[1] = v >> 8; return; }
    const i = (t << 9) | ((y & 7) << 6) | ((lz & 7) << 3) | (lx & 7);
    out[0] = this.sunPool[i];
    out[1] = this.skyPool[i];
  }

  /**
   * Rooms under a roof get a soft indoor ambient (ceiling lights, light through the shop windows) so
   * they read in daylight too; at night their lamps take over.
   */
  indoor(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number): void {
    const g = this.grid;
    const val = Math.round(v * 255);
    for (let y = Math.max(0, y0); y <= Math.min(g.sy - 1, y1); y++)
      for (let z = Math.max(g.wz0, z0); z <= Math.min(g.wz1 - 1, z1); z++)
        for (let x = Math.max(g.wx0, x0); x <= Math.min(g.wx1 - 1, x1); x++) {
          if (g.get(x, y, z) !== 0) continue;
          const lx = x - g.x0, lz = z - g.z0;
          const bi = ((y >> 3) * g.bz + (lz >> 3)) * g.bx + (lx >> 3);
          let t = this.table[bi];
          if (t < 0) {
            if ((((-t - 1) >> 8) & 255) >= val) continue;
            t = this.alloc(bi);
          }
          const i = (t << 9) | ((y & 7) << 6) | ((lz & 7) << 3) | (lx & 7);
          if (this.skyPool[i] < val) this.skyPool[i] = val;
        }
  }

  addLamp(l: Lamp): void {
    this.lamps.push(l);
    const B = LightField.B;
    const r = Math.ceil(l.radius / B);
    const cx = Math.floor(l.x / B), cz = Math.floor(l.z / B);
    for (let dz = -r; dz <= r; dz++)
      for (let dx = -r; dx <= r; dx++) {
        const k = (cz + dz) * 4096 + (cx + dx);
        let b = this.buckets.get(k);
        if (!b) this.buckets.set(k, (b = []));
        b.push(l);
      }
  }

  get lampCount(): number {
    return this.lamps.length;
  }

  private tmp = new Float32Array(2);

  /** Sample sun + sky at a point (builder voxel units, cell centres at i+0.5), ignoring solid cells. */
  sample(px: number, py: number, pz: number, out: Float32Array): void {
    const g = this.grid, tmp = this.tmp;
    const x0 = Math.floor(px - 0.5), y0 = Math.floor(py - 0.5), z0 = Math.floor(pz - 0.5);
    const fx = px - 0.5 - x0, fy = py - 0.5 - y0, fz = pz - 0.5 - z0;
    let ws = 0, s = 0, k = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      if (w <= 1e-5) continue;
      const x = x0 + dx, y = y0 + dy, z = z0 + dz;
      if (y < 0) continue;
      if (g.get(x, y, z) !== 0) continue;
      this.light(x, y, z, tmp);
      ws += w;
      s += w * tmp[0];
      k += w * tmp[1];
    }
    if (ws < 1e-5) { out[0] = 0; out[1] = 0; return; }
    out[0] = s / ws / 255;
    out[1] = k / ws / 255;
  }

  /** Accumulate lamp light at p (coarse voxel units) for a surface with normal n. Writes rgb into out[2..4]. */
  lampLight(px: number, py: number, pz: number, nx: number, ny: number, nz: number, out: Float32Array): void {
    out[2] = 0; out[3] = 0; out[4] = 0;
    const B = LightField.B;
    const list = this.buckets.get(Math.floor(pz / B) * 4096 + Math.floor(px / B));
    if (!list) return;
    const g = this.grid;
    for (let li = 0; li < list.length; li++) {
      const l = list[li];
      let dx = l.x - px, dy = l.y - py, dz = l.z - pz;
      const d2 = dx * dx + dy * dy + dz * dz;
      const r2 = l.radius * l.radius;
      if (d2 >= r2) continue;
      const d = Math.sqrt(d2) + 1e-4;
      dx /= d; dy /= d; dz /= d;
      let ndl = 1;
      if (nx !== 0 || ny !== 0 || nz !== 0) {
        ndl = nx * dx + ny * dy + nz * dz;
        if (ndl <= -0.2) continue;
        ndl = Math.min(1, (ndl + 0.2) / 1.2);
      }
      let att = 1 - d2 / r2;
      att = att * att / (1 + d * 0.08);
      // occlusion march, coarse steps, stop short of the lamp body
      let occ = 1;
      const steps = Math.floor(d - 2);
      for (let s = 1.2; s < steps; s += 1.0) {
        const x = Math.floor(px + dx * s), y = Math.floor(py + dy * s), z = Math.floor(pz + dz * s);
        if (g.get(x, y, z) !== 0) { occ = 0.08; break; }
      }
      const k = att * ndl * occ;
      out[2] += l.r * k;
      out[3] += l.g * k;
      out[4] += l.b * k;
    }
  }
}
