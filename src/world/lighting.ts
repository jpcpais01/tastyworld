import { Grid } from './grid';

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
  readonly sun: Uint8Array;
  readonly sky: Uint8Array;
  private lamps: Lamp[] = [];
  private buckets = new Map<number, Lamp[]>();
  private static readonly B = 16;

  constructor(readonly grid: Grid, readonly sunStep: [number, number]) {
    const { sx, sy, sz } = grid;
    this.sun = new Uint8Array(sx * sy * sz);
    this.sky = new Uint8Array(sx * sy * sz);
    this.propagate();
  }

  private propagate(): void {
    const g = this.grid;
    const { sx, sy, sz, data } = g;
    const n = sx * sz;
    let sunA = new Float32Array(n).fill(1);
    let skyA = new Float32Array(n).fill(1);
    let sunB = new Float32Array(n);
    let skyB = new Float32Array(n);
    const [ox, oz] = this.sunStep;
    const ix = Math.floor(ox), iz = Math.floor(oz);
    const fx = ox - ix, fz = oz - iz;
    const w00 = (1 - fx) * (1 - fz), w10 = fx * (1 - fz), w01 = (1 - fx) * fz, w11 = fx * fz;
    const at = (buf: Float32Array, x: number, z: number) => (x < 0 || z < 0 || x >= sx || z >= sz ? 1 : buf[z * sx + x]);

    for (let y = sy - 1; y >= 0; y--) {
      const base = y * n;
      for (let z = 0; z < sz; z++) {
        for (let x = 0; x < sx; x++) {
          const i = z * sx + x;
          if (data[base + i] !== 0) {
            sunB[i] = 0;
            skyB[i] = 0;
            continue;
          }
          if (y === sy - 1) {
            sunB[i] = 1;
            skyB[i] = 1;
          } else {
            const ax = x + ix, az = z + iz;
            sunB[i] = at(sunA, ax, az) * w00 + at(sunA, ax + 1, az) * w10 + at(sunA, ax, az + 1) * w01 + at(sunA, ax + 1, az + 1) * w11;
            skyB[i] =
              at(skyA, x, z) * 0.28 +
              (at(skyA, x - 2, z) + at(skyA, x + 2, z) + at(skyA, x, z - 2) + at(skyA, x, z + 2)) * 0.13 +
              (at(skyA, x - 1, z - 1) + at(skyA, x + 1, z + 1)) * 0.05;
          }
        }
      }
      // sky weights above sum to 0.9, renormalise so open sky stays at 1 while occluded columns darken
      for (let i = 0; i < n; i++) {
        skyB[i] = Math.min(1, skyB[i] / 0.9);
        this.sun[base + i] = (sunB[i] * 255 + 0.5) | 0;
        this.sky[base + i] = (skyB[i] * 255 + 0.5) | 0;
      }
      let t = sunA; sunA = sunB; sunB = t;
      t = skyA; skyA = skyB; skyB = t;
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

  /** Sample sun + sky at a point (coarse voxel units, cell centres at i+0.5), ignoring solid cells. */
  sample(px: number, py: number, pz: number, out: Float32Array): void {
    const g = this.grid;
    const x0 = Math.floor(px - 0.5), y0 = Math.floor(py - 0.5), z0 = Math.floor(pz - 0.5);
    const fx = px - 0.5 - x0, fy = py - 0.5 - y0, fz = pz - 0.5 - z0;
    let ws = 0, s = 0, k = 0;
    for (let c = 0; c < 8; c++) {
      const dx = c & 1, dy = (c >> 1) & 1, dz = (c >> 2) & 1;
      const w = (dx ? fx : 1 - fx) * (dy ? fy : 1 - fy) * (dz ? fz : 1 - fz);
      if (w <= 1e-5) continue;
      const x = x0 + dx, y = y0 + dy, z = z0 + dz;
      if (y >= g.sy) { ws += w; s += w * 255; k += w * 255; continue; }
      if (y < 0) continue;
      if (x < 0 || z < 0 || x >= g.sx || z >= g.sz) { ws += w; s += w * 255; k += w * 255; continue; }
      const i = y * g.sxz + z * g.sx + x;
      if (g.data[i] !== 0) continue;
      ws += w;
      s += w * this.sun[i];
      k += w * this.sky[i];
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
