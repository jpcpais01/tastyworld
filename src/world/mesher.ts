import { Grid } from './grid';
import { Palette } from './palette';

/**
 * Greedy voxel mesher with per-vertex ambient occlusion, baked lighting and convex-edge flags.
 *
 * Faces whose four corners carry identical AO and lighting ("uniform" faces) and share a colour are merged
 * into large quads; everything else (soft shadow edges, AO creases, lamp falloff) stays per-voxel so the
 * smooth lighting is preserved exactly. Per-voxel colour jitter happens in the shader from the voxel cell,
 * so it does not prevent merging.
 *
 * Vertex layout (28 bytes):
 *   position: float32 x3 (object space)
 *   pack:  u8 x4 [face | scaleIdx << 3 | seam << 7, ao, edgeBits | vary << 4, sky | partId]
 *   color: u8 x4 [r, g, b, emissive code]  (code 1..127 always on, 129..255 night only, 128 foliage)
 *   light: u8 x4 [lamp r, lamp g, lamp b (x2 range), sun]
 *   quad:  u8 x4 [dist to u-min edge, to u-max, to v-min, to v-max] in voxels (for the bevel highlight)
 * plus a separate u16 per vertex: the sway body it belongs to (0 = static, see world/sway.ts).
 */

// face order: +X -X +Y -Y +Z -Z ; u x v = n
export const FACE_N = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const FACE_U = [[0, 1, 0], [0, 0, 1], [0, 0, 1], [1, 0, 0], [1, 0, 0], [0, 1, 0]];
const FACE_V = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [0, 0, 1], [0, 1, 0], [1, 0, 0]];
const AXIS_OF = (v: number[]) => (v[0] ? 0 : v[1] ? 1 : 2);
const CORNER_SU = [-1, 1, 1, -1];
const CORNER_SV = [-1, -1, 1, 1];
const AO_CURVE = [0.4, 0.62, 0.82, 1.0];

/** Voxel sizes known to the shader (index stored per vertex). */
export const SCALES = [0.25, 0.125, 0.0625, 0.075, 0.025, 0.05, 0.1, 0.5, 1.0];

export const STRIDE = 16; // attribute bytes per vertex

export interface MeshData {
  positions: Float32Array;
  attrs: Uint8Array;
  indices: Uint32Array;
  /** Per vertex: 1-based sway body id, 0 = static. */
  sway: Uint16Array;
  vertexCount: number;
  bounds: [number, number, number, number, number, number];
  /** Set when the indices end with the contents of ground-floor rooms (see splitInner): how many come before them. */
  shell?: number;
  /** Bounds of those room contents. */
  innerBounds?: [number, number, number, number, number, number];
  /** Set by orderFaces: where each segment of FACE_SEGMENTS starts in the indices, plus the end. */
  segs?: Uint32Array;
}

/** Per-vertex lighting callback: p in world metres + normal; fills out[0]=sun,out[1]=sky,out[2..4]=lamp rgb. */
export type LightFn = (wx: number, wy: number, wz: number, nx: number, ny: number, nz: number, out: Float32Array) => void;

export interface MeshOpts {
  grid: Grid;
  pal: Palette;
  scale: number;
  origin: [number, number, number];
  region?: [number, number, number, number]; // x0, x1, z0, z1 (exclusive end)
  light?: LightFn;
  /** Optional per-voxel part id grid (same dims) written into pack.w instead of sky. */
  parts?: Uint8Array;
  /** Disable merging (one quad per voxel face). */
  greedy?: boolean;
  /** Treat cells outside the grid below this layer as solid (hides the underside and cut edges of the ground). */
  groundBelow?: number;
  /** Sway body id of a voxel (grid index), 0 = static. Faces of different bodies never merge. */
  sway?: (vi: number) => number;
  /** Per-column owner ids (grid sx * sz): side faces between two different owners are kept even though both
   * cells are solid, so a building whose neighbour is cut away still shows its side wall. */
  seam?: Uint16Array;
}

class Buf {
  pos: Float32Array;
  att: Uint8Array;
  idx: Uint32Array;
  sw: Uint16Array;
  nv = 0;
  ni = 0;
  constructor(cap = 4096) {
    this.pos = new Float32Array(cap * 3);
    this.att = new Uint8Array(cap * STRIDE);
    this.idx = new Uint32Array(Math.ceil(cap * 1.5));
    this.sw = new Uint16Array(cap);
  }
  ensure(nv: number) {
    if (this.nv + nv <= this.pos.length / 3) return;
    const cap = Math.max((this.pos.length / 3) * 2, this.nv + nv);
    const p = new Float32Array(cap * 3); p.set(this.pos); this.pos = p;
    const a = new Uint8Array(cap * STRIDE); a.set(this.att); this.att = a;
    const i = new Uint32Array(Math.ceil(cap * 1.5)); i.set(this.idx); this.idx = i;
    const w = new Uint16Array(cap); w.set(this.sw); this.sw = w;
  }
}

const tmp = new Float32Array(5);
const SEAM_MIN = 16; // grid layer: street level (12) plus 1 m
const q = (val: number, m: number) => Math.min(63, Math.round(val * m));

// Scratch buffers shared by all mesh calls (slices are at most 300 x 300).
const MAXS = 320 * 320;
let scr: {
  keys: Float64Array; edgesM: Uint8Array; colM: Uint16Array; swM: Uint16Array; partM: Int8Array; lightM: Uint8Array; used: Uint8Array;
  cornerStamp: Int32Array; cornerVals: Float32Array;
} | null = null;
let stampBase = 1;
function scratch() {
  if (!scr) {
    scr = {
      keys: new Float64Array(MAXS), edgesM: new Uint8Array(MAXS), colM: new Uint16Array(MAXS), swM: new Uint16Array(MAXS), partM: new Int8Array(MAXS),
      lightM: new Uint8Array(MAXS * 6), used: new Uint8Array(MAXS),
      cornerStamp: new Int32Array(322 * 322), cornerVals: new Float32Array(322 * 322 * 5),
    };
  }
  return scr;
}

export function meshGrid(o: MeshOpts): MeshData {
  const { grid, pal, scale, origin, light, parts, sway, seam } = o;
  const greedy = o.greedy !== false;
  const scaleIdx = SCALES.findIndex((s) => Math.abs(s - scale) < 1e-6);
  if (scaleIdx < 0) throw new Error('unknown voxel scale ' + scale);
  const [x0, x1, z0, z1] = o.region ?? [0, grid.sx, 0, grid.sz];
  const lo = [x0, 0, z0], hi = [x1, grid.sy, z1];
  const b = new Buf(8192);
  const { sx, sxz, data } = grid;
  const gb = o.groundBelow ?? -1;
  const gsx = grid.sx, gsy = grid.sy, gsz = grid.sz;
  const pyOf = (vi: number) => Math.floor(vi / sxz);
  // Animated characters: each body part is its own closed solid, so faces where two parts touch are
  // kept (they show when a limb swings away) and AO / edges only see voxels of the same part.
  let curPart = -1;
  const solid = (x: number, y: number, z: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= gsx || y >= gsy || z >= gsz) return y < gb;
    const i = y * sxz + z * sx + x;
    return data[i] !== 0 && (curPart < 0 || parts![i] === curPart);
  };
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  const { keys, edgesM, colM, swM, partM, lightM, used, cornerStamp, cornerVals } = scratch();
  const maxU = keys.length;

  const cAo = [0, 0, 0, 0];
  const cL = new Float32Array(20); // 4 corners x (sun, sky, r, g, b)
  let stamp = stampBase;
  const p = [0, 0, 0];

  const emit = (f: number, px: number, py: number, pz: number, w: number, h: number, col: number, edges: number, aoIdx: number[], lightVals: Float32Array | null, uni: Uint8Array | null, uniOff: number, part: number, sw: number, seamF = 0) => {
    const n = FACE_N[f], u = FACE_U[f], v = FACE_V[f];
    b.ensure(4);
    const base = b.nv;
    const bx = px + (n[0] > 0 ? 1 : 0), by = py + (n[1] > 0 ? 1 : 0), bz = pz + (n[2] > 0 ? 1 : 0);
    // code 128 (night-only, zero strength) never emits: it marks foliage for the shadow lookup
    const em = pal.emit[col] > 0 ? (pal.night[col] ? 128 : 0) + Math.max(1, Math.round(pal.emit[col] * 127)) : pal.leaf[col] ? 128 : 0;
    const vary = Math.min(15, Math.round(pal.vary[col] / 0.02));
    for (let k = 0; k < 4; k++) {
      const cu = k === 1 || k === 2 ? 1 : 0;
      const cv = k >= 2 ? 1 : 0;
      const cx = bx + (u[0] * w) * cu + (v[0] * h) * cv;
      const cy = by + (u[1] * w) * cu + (v[1] * h) * cv;
      const cz = bz + (u[2] * w) * cu + (v[2] * h) * cv;
      const wx = origin[0] + cx * scale, wy = origin[1] + cy * scale, wz = origin[2] + cz * scale;
      const vi = b.nv++;
      b.sw[vi] = sw;
      b.pos[vi * 3] = wx; b.pos[vi * 3 + 1] = wy; b.pos[vi * 3 + 2] = wz;
      if (wx < minX) minX = wx; if (wx > maxX) maxX = wx;
      if (wy < minY) minY = wy; if (wy > maxY) maxY = wy;
      if (wz < minZ) minZ = wz; if (wz > maxZ) maxZ = wz;
      const o16 = vi * STRIDE;
      const at = b.att;
      at[o16] = f | (scaleIdx << 3) | (seamF << 7);
      at[o16 + 2] = edges | (vary << 4);
      at[o16 + 4] = pal.r[col]; at[o16 + 5] = pal.g[col]; at[o16 + 6] = pal.b[col]; at[o16 + 7] = em;
      if (uni) {
        at[o16 + 1] = Math.round(AO_CURVE[uni[uniOff]] * 255);
        at[o16 + 3] = part >= 0 ? part : uni[uniOff + 2] * 4 + 2;
        at[o16 + 8] = uni[uniOff + 3] * 4; at[o16 + 9] = uni[uniOff + 4] * 4; at[o16 + 10] = uni[uniOff + 5] * 4;
        at[o16 + 11] = uni[uniOff + 1] * 4 + 2;
      } else {
        const L = lightVals!;
        at[o16 + 1] = Math.round(AO_CURVE[aoIdx[k]] * 255);
        at[o16 + 3] = part >= 0 ? part : Math.round(Math.min(1, L[k * 5 + 1]) * 255);
        at[o16 + 8] = Math.min(255, Math.round(L[k * 5 + 2] * 127.5));
        at[o16 + 9] = Math.min(255, Math.round(L[k * 5 + 3] * 127.5));
        at[o16 + 10] = Math.min(255, Math.round(L[k * 5 + 4] * 127.5));
        at[o16 + 11] = Math.round(Math.min(1, L[k * 5]) * 255);
      }
      at[o16 + 12] = cu * w; at[o16 + 13] = (1 - cu) * w; at[o16 + 14] = cv * h; at[o16 + 15] = (1 - cv) * h;
    }
    const ii = b.ni;
    b.ni += 6;
    if (b.idx.length < b.ni) { const ni = new Uint32Array(b.idx.length * 2); ni.set(b.idx); b.idx = ni; }
    const flip = !uni && aoIdx[0] + aoIdx[2] < aoIdx[1] + aoIdx[3];
    if (!flip) {
      b.idx[ii] = base; b.idx[ii + 1] = base + 1; b.idx[ii + 2] = base + 2;
      b.idx[ii + 3] = base; b.idx[ii + 4] = base + 2; b.idx[ii + 5] = base + 3;
    } else {
      b.idx[ii] = base + 1; b.idx[ii + 1] = base + 2; b.idx[ii + 2] = base + 3;
      b.idx[ii + 3] = base + 1; b.idx[ii + 4] = base + 3; b.idx[ii + 5] = base;
    }
  };

  for (let f = 0; f < 6; f++) {
    const n = FACE_N[f], u = FACE_U[f], v = FACE_V[f];
    const na = AXIS_OF(n), ua = AXIS_OF(u), va = AXIS_OF(v);
    const U = hi[ua] - lo[ua], Vn = hi[va] - lo[va];
    if (U * Vn > maxU) throw new Error('slice too large');
    const strides = [1, sxz, sx], dims = [gsx, gsy, gsz];
    const sN = strides[na], sU = strides[ua], sV = strides[va];
    const dn = n[na];
    const dimN = dims[na];
    for (let s = lo[na]; s < hi[na]; s++) {
      let any = false;
      stamp++;
      keys.fill(-2, 0, U * Vn);
      const ns = s + dn;
      const nIn = ns >= 0 && ns < dimN;
      const outsideSolid = !nIn && (na === 1 ? ns < gb : false);
      for (let iv = 0; iv < Vn; iv++) {
        let vi = s * sN + lo[ua] * sU + (lo[va] + iv) * sV - sU;
        for (let iu = 0; iu < U; iu++) {
          vi += sU;
          const col = data[vi];
          if (col === 0) continue;
          p[na] = s; p[ua] = lo[ua] + iu; p[va] = lo[va] + iv;
          const x = p[0], y = p[1], z = p[2];
          let seamFace = false;
          if (nIn ? data[vi + dn * sN] !== 0 && (!parts || parts[vi + dn * sN] === parts[vi]) : outsideSolid || (na !== 1 && pyOf(vi) < gb)) {
            // nothing below waist height is ever cut, so faces there stay buried behind the stub
            if (!seam || !nIn || na === 1 || y < SEAM_MIN) continue;
            const a = seam[z * gsx + x], o2 = seam[(z + n[2]) * gsx + x + n[0]];
            if (!a || !o2 || a === o2) continue;
            seamFace = true;
          }
          curPart = parts ? parts[vi] : -1;
          const mi = iv * U + iu;
          const lx = x + n[0], ly = y + n[1], lz = z + n[2];
          any = true;
          let edges = 0;
          if (!solid(x - u[0], y - u[1], z - u[2])) edges |= 1;
          if (!solid(x + u[0], y + u[1], z + u[2])) edges |= 2;
          if (!solid(x - v[0], y - v[1], z - v[2])) edges |= 4;
          if (!solid(x + v[0], y + v[1], z + v[2])) edges |= 8;
          const bx = x + (n[0] > 0 ? 1 : 0), by = y + (n[1] > 0 ? 1 : 0), bz = z + (n[2] > 0 ? 1 : 0);
          for (let k = 0; k < 4; k++) {
            const su = CORNER_SU[k], sv = CORNER_SV[k];
            const s1 = solid(lx + u[0] * su, ly + u[1] * su, lz + u[2] * su) ? 1 : 0;
            const s2 = solid(lx + v[0] * sv, ly + v[1] * sv, lz + v[2] * sv) ? 1 : 0;
            const sc = solid(lx + u[0] * su + v[0] * sv, ly + u[1] * su + v[1] * sv, lz + u[2] * su + v[2] * sv) ? 1 : 0;
            cAo[k] = s1 && s2 ? 0 : 3 - (s1 + s2 + sc);
            const cu = k === 1 || k === 2 ? 1 : 0, cv = k >= 2 ? 1 : 0;
            if (light) {
              const ci = (iu + cu) + (iv + cv) * (U + 1);
              const c5 = ci * 5;
              if (cornerStamp[ci] !== stamp) {
                const cx = bx + u[0] * cu + v[0] * cv, cy = by + u[1] * cu + v[1] * cv, cz = bz + u[2] * cu + v[2] * cv;
                light(origin[0] + cx * scale, origin[1] + cy * scale, origin[2] + cz * scale, n[0], n[1], n[2], tmp);
                cornerVals[c5] = tmp[0]; cornerVals[c5 + 1] = tmp[1]; cornerVals[c5 + 2] = tmp[2]; cornerVals[c5 + 3] = tmp[3]; cornerVals[c5 + 4] = tmp[4];
                cornerStamp[ci] = stamp;
              }
              cL[k * 5] = cornerVals[c5]; cL[k * 5 + 1] = cornerVals[c5 + 1]; cL[k * 5 + 2] = cornerVals[c5 + 2]; cL[k * 5 + 3] = cornerVals[c5 + 3]; cL[k * 5 + 4] = cornerVals[c5 + 4];
            } else {
              cL[k * 5] = 1; cL[k * 5 + 1] = 1; cL[k * 5 + 2] = 0; cL[k * 5 + 3] = 0; cL[k * 5 + 4] = 0;
            }
          }
          if (seamFace) {
            // buried until the neighbour is cut away: light it like an open outside wall, not the dark inside
            for (let k = 0; k < 4; k++) {
              cAo[k] = 3;
              cL[k * 5] = 0.8; cL[k * 5 + 1] = 0.95; cL[k * 5 + 2] = 0; cL[k * 5 + 3] = 0; cL[k * 5 + 4] = 0;
            }
          }
          const part = parts ? parts[vi] : -1;
          const sw = sway ? sway(vi) : 0;
          // uniform test on quantised values
          // character parts merge too, but only within one part (each part moves on its own)
          let uniform = greedy && cAo[0] === cAo[1] && cAo[1] === cAo[2] && cAo[2] === cAo[3];
          let qs = 0, qk = 0, qr = 0, qg = 0, qb = 0;
          if (uniform) {
            qs = q(cL[0], 63); qk = q(cL[1], 63); qr = q(cL[2], 31.875); qg = q(cL[3], 31.875); qb = q(cL[4], 31.875);
            for (let k = 1; k < 4 && uniform; k++) {
              if (q(cL[k * 5], 63) !== qs || q(cL[k * 5 + 1], 63) !== qk || q(cL[k * 5 + 2], 31.875) !== qr || q(cL[k * 5 + 3], 31.875) !== qg || q(cL[k * 5 + 4], 31.875) !== qb) uniform = false;
            }
          }
          if (!uniform) {
            emit(f, x, y, z, 1, 1, col, edges, cAo, cL, null, 0, part, sw, seamFace ? 1 : 0);
            continue;
          }
          keys[mi] = (((((((col * 4 + cAo[0]) * 64 + qs) * 64 + qk) * 64 + qr) * 64 + qg) * 64 + qb) * 16 + part + 1) * 2 + (seamFace ? 1 : 0);
          edgesM[mi] = edges;
          colM[mi] = col;
          partM[mi] = part;
          swM[mi] = sw;
          const lo6 = mi * 6;
          lightM[lo6] = cAo[0]; lightM[lo6 + 1] = qs; lightM[lo6 + 2] = qk; lightM[lo6 + 3] = qr; lightM[lo6 + 4] = qg; lightM[lo6 + 5] = qb;
          used[mi] = 0;
        }
      }
      if (!any) continue;
      // greedy merge of uniform faces
      for (let iv = 0; iv < Vn; iv++)
        for (let iu = 0; iu < U; iu++) {
          const mi = iv * U + iu;
          const key = keys[mi];
          if (key < 0 || used[mi]) continue;
          const sw = swM[mi];
          let w = 1;
          while (iu + w < U && w < 255 && keys[mi + w] === key && swM[mi + w] === sw && !used[mi + w]) w++;
          let h = 1;
          outer: while (iv + h < Vn && h < 255) {
            const row = (iv + h) * U + iu;
            for (let k = 0; k < w; k++) if (keys[row + k] !== key || swM[row + k] !== sw || used[row + k]) break outer;
            h++;
          }
          let eU0 = 1, eU1 = 2, eV0 = 4, eV1 = 8;
          for (let jv = 0; jv < h; jv++) {
            const row = (iv + jv) * U + iu;
            for (let ju = 0; ju < w; ju++) used[row + ju] = 1;
            if (!(edgesM[row] & 1)) eU0 = 0;
            if (!(edgesM[row + w - 1] & 2)) eU1 = 0;
          }
          for (let ju = 0; ju < w; ju++) {
            if (!(edgesM[iv * U + iu + ju] & 4)) eV0 = 0;
            if (!(edgesM[(iv + h - 1) * U + iu + ju] & 8)) eV1 = 0;
          }
          p[na] = s; p[ua] = lo[ua] + iu; p[va] = lo[va] + iv;
          emit(f, p[0], p[1], p[2], w, h, colM[mi], eU0 | eU1 | eV0 | eV1, cAo, null, lightM, mi * 6, partM[mi], sw, key % 2);
        }
    }
  }
  stampBase = stamp + 1;
  return {
    positions: b.pos.slice(0, b.nv * 3),
    attrs: b.att.slice(0, b.nv * STRIDE),
    indices: b.idx.slice(0, b.ni),
    sway: b.sw.slice(0, b.nv),
    vertexCount: b.nv,
    bounds: [minX, minY, minZ, maxX, maxY, maxZ],
  };
}

/** Concatenate several meshes into one. */
export function mergeMeshes(list: MeshData[]): MeshData | null {
  const parts = list.filter((m) => m.vertexCount > 0);
  if (!parts.length) return null;
  let nv = 0, ni = 0;
  for (const m of parts) { nv += m.vertexCount; ni += m.indices.length; }
  const positions = new Float32Array(nv * 3);
  const attrs = new Uint8Array(nv * STRIDE);
  const indices = new Uint32Array(ni);
  const sway = new Uint16Array(nv);
  let ov = 0, oi = 0;
  const bounds: MeshData['bounds'] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const m of parts) {
    positions.set(m.positions, ov * 3);
    attrs.set(m.attrs, ov * STRIDE);
    sway.set(m.sway, ov);
    for (let k = 0; k < m.indices.length; k++) indices[oi + k] = m.indices[k] + ov;
    for (let k = 0; k < 3; k++) {
      bounds[k] = Math.min(bounds[k], m.bounds[k]);
      bounds[k + 3] = Math.max(bounds[k + 3], m.bounds[k + 3]);
    }
    ov += m.vertexCount;
    oi += m.indices.length;
  }
  return { positions, attrs, indices, sway, vertexCount: nv, bounds };
}

/**
 * Moves the faces that lie inside any of `boxes` (x0, y0, z0, x1, y1, z1 in metres) to the end of the index
 * list and records where they start, so they can be drawn on their own. A face counts as inside when its
 * centre is strictly within a box, which leaves out the faces on the box's own planes: a room's walls,
 * floor and ceiling stay with the rest.
 */
export function splitInner(md: MeshData, boxes: number[][]): MeshData {
  const { positions: p, indices } = md, n = indices.length;
  if (!boxes.length) return md;
  const out = new Uint32Array(n), inner: number[] = [];
  const ib: MeshData['bounds'] = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  const e = 0.01;
  let o = 0;
  // faces are quads: six indices over four consecutive vertices
  for (let i = 0; i < n; i += 6) {
    let v = indices[i];
    for (let k = 1; k < 6; k++) v = Math.min(v, indices[i + k]);
    const cx = (p[v * 3] + p[v * 3 + 3] + p[v * 3 + 6] + p[v * 3 + 9]) / 4;
    const cy = (p[v * 3 + 1] + p[v * 3 + 4] + p[v * 3 + 7] + p[v * 3 + 10]) / 4;
    const cz = (p[v * 3 + 2] + p[v * 3 + 5] + p[v * 3 + 8] + p[v * 3 + 11]) / 4;
    const hit = boxes.some((b) => cx > b[0] + e && cx < b[3] - e && cy > b[1] + e && cy < b[4] - e && cz > b[2] + e && cz < b[5] - e);
    if (!hit) { out.set(indices.subarray(i, i + 6), o); o += 6; continue; }
    inner.push(i);
    for (let c = 0; c < 4; c++) for (let k = 0; k < 3; k++) {
      ib[k] = Math.min(ib[k], p[(v + c) * 3 + k]);
      ib[k + 3] = Math.max(ib[k + 3], p[(v + c) * 3 + k]);
    }
  }
  if (!inner.length) return md;
  const shell = o;
  for (const i of inner) { out.set(indices.subarray(i, i + 6), o); o += 6; }
  return { ...md, indices: out, shell, innerBounds: ib };
}

/**
 * The face directions (FACE_N order) in the order orderFaces lays them out. Some appear twice so that every
 * set a camera can need is one contiguous run: all six (the first six), and +Y with one X and one Z side
 * (any iso view, and most distant chunks in first person). See FACE_WINDOW.
 */
export const FACE_SEGMENTS = [3, 0, 4, 2, 1, 5, 2, 0];

/** For each 6-bit set of face directions, the shortest run of FACE_SEGMENTS [first, last] that holds them all. */
export const FACE_WINDOW: [number, number][] = Array.from({ length: 64 }, (_, mask) => {
  let best: [number, number] = [0, 5];
  for (let a = 0; a < FACE_SEGMENTS.length; a++)
    for (let b = a; b < FACE_SEGMENTS.length; b++) {
      let have = 0;
      for (let k = a; k <= b; k++) have |= 1 << FACE_SEGMENTS[k];
      if ((have & mask) === mask && b - a < best[1] - best[0]) best = [a, b];
    }
  return best;
});

/**
 * Lays the faces before `md.shell` (all of them when it is unset) out by direction in FACE_SEGMENTS order,
 * so a draw can submit only the faces that can face the camera. The room contents after `shell` keep their place.
 */
export function orderFaces(md: MeshData): MeshData {
  const { indices, attrs } = md, end = md.shell ?? indices.length;
  const byFace: number[][] = [[], [], [], [], [], []];
  for (let i = 0; i < end; i += 6) byFace[attrs[indices[i] * STRIDE] & 7].push(i);
  let n = indices.length - end;
  for (const f of FACE_SEGMENTS) n += byFace[f].length * 6;
  const out = new Uint32Array(n), segs = new Uint32Array(FACE_SEGMENTS.length + 1);
  let o = 0;
  FACE_SEGMENTS.forEach((f, k) => {
    segs[k] = o;
    for (const i of byFace[f]) { out.set(indices.subarray(i, i + 6), o); o += 6; }
  });
  segs[FACE_SEGMENTS.length] = o;
  out.set(indices.subarray(end), o);
  return { ...md, indices: out, segs, shell: md.shell === undefined ? undefined : o };
}
