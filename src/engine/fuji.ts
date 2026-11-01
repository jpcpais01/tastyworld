import * as THREE from 'three';

/**
 * Mount Fuji and the ranges in front of it, far to the west-south-west of Tokyo, as a voxel heightfield baked once
 * into a strip of sky. From the town the mountains are so far away that walking about never moves them, so they
 * are drawn like the sun: by direction. The bake walks each azimuth column front to back through the voxel grid
 * (the old "voxel space" way), and every texel it fills keeps which cube face it shows, what it is made of, a
 * bevel and grain shade, and how far away it is. The composite lights it with the hour's sun and sky and hazes it
 * by distance, so it turns red at dawn and dusk, blue at noon and pale under the moon, for one texture fetch.
 *
 * Proportions follow the real mountain: a flat crater top, concave flanks that sweep out to a wide apron, snow
 * fingers down the gullies and the Hoei crater's hump on the south-east flank (to the left, seen from Tokyo).
 * The Tanzawa range stands in front and hides its foot, Hakone's caldera rim to the left, Okutama's long ridges to
 * the right. The scene is drawn at about a third of the real distance and Fuji larger still, so the summit
 * stands clear above the rooftops, as it does from Tokyo's hills on a clear winter morning.
 */

export interface Backdrop {
  tex: THREE.DataTexture;
  /** Azimuth (atan2(x, z)) of the strip's centre, its width, and its lowest elevation and height (radians). */
  az: number; azSpan: number; el0: number; elSpan: number;
  /** The voxel grid's forward and side axes in world x, z (faces are lit in this frame). */
  fwd: [number, number]; side: [number, number];
}

const W = 2048, H = 384;
const AZ_SPAN = 70 * Math.PI / 180, EL0 = -1.2 * Math.PI / 180, EL_SPAN = 12.4 * Math.PI / 180;
/** Cube size (m), grid extent along the sightline and across it (m). */
const C = 125, A0 = 7000, A1 = 60000, B0 = -36000, B1 = 36000;
const NA = Math.round((A1 - A0) / C), NB = Math.round((B1 - B0) / C);
const EYE = 40;
/** Earth's curvature, less a little for refraction. */
const DROP = (1 - 0.13) / (2 * 6371e3);
/** Fuji's summit, straight down the sightline (a, b in metres). */
const FUJI_A = 30000, FUJI_B = 0;
/** Fuji is drawn 1.6 times its real size all round (the same shape seen from nearer), so it towers over Tanzawa. */
const FS = 1.6;
/** West, turned four degrees toward the south: just left of the canal's long view west. */
const AZ = -Math.PI / 2 + 4 * Math.PI / 180;

function hash(x: number, y: number): number {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function noise(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return (a * (1 - ux) + b * ux) * (1 - uy) + (c * (1 - ux) + d * ux) * uy;
}
function fbm(x: number, y: number, oct = 4): number {
  let v = 0, w = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += w * noise(x * f + i * 17.3, y * f - i * 9.1); w *= 0.5; f *= 2.03; }
  return v / (1 - Math.pow(0.5, oct));
}
/** Ridged noise: sharp crests, like eroded ranges. */
function ridged(x: number, y: number, oct = 4): number {
  let v = 0, w = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { v += w * (1 - Math.abs(2 * noise(x * f + i * 31.7, y * f + i * 5.3) - 1)); w *= 0.5; f *= 2.1; }
  return v / (1 - Math.pow(0.5, oct));
}
const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/** Fuji: concave flanks, a crater top, gullies, the Hoei hump. Metres above the sea. */
function fuji(a: number, b: number): number {
  const da = (a - FUJI_A) / 1000 / FS, db = (b - FUJI_B) / 1000 / FS;
  const r = Math.hypot(da, db * 1.05);
  let h: number;
  if (r < 0.35) h = 3776 - 150 * (1 - (r / 0.35) ** 2);
  else h = 3776 * (0.45 * Math.exp(-(r - 0.35) / 4) + 0.55 * Math.exp(-(r - 0.35) / 16));
  // radial gullies (the snow lies longest in them)
  const th = Math.atan2(db, da);
  const g = Math.pow(0.5 + 0.5 * Math.sin(th * 13 + 2.5 * noise(th * 3, 1.7)), 7);
  h -= 110 * g * smooth(0.7, 2.2, r) * smooth(8, 3.5, r);
  // Hoei: a parasitic cone on the south-east flank with the crater's bowl just above it
  const hx = da + 2.4, hy = db - 2.6;
  h += 260 * Math.exp(-(hx * hx + hy * hy) / 0.7);
  const cx = da + 1.9, cy = db - 2.05;
  h -= 280 * Math.exp(-(cx * cx + cy * cy) / 0.28);
  // the long apron stops at the plateau round the mountain, well behind Tanzawa
  return h * FS * smooth(11, 6.5, r);
}

/** The foot of the mountains: the Kanto plain, rising behind Tanzawa to Fuji's skirts. */
const plain = (ak: number, bk: number) => 20 + 620 * smooth(18, 32, ak) * smooth(-30, -8, -Math.abs(bk) * 0.6);

/** Everything else: the plain, the Tama hills, Tanzawa, Hakone, Okutama (only where each one stands). */
function land(a: number, b: number): number {
  const ak = a / 1000, bk = b / 1000;
  let h = plain(ak, bk) + 50 * fbm(ak * 0.4, bk * 0.4, 3);
  // Tama hills: low wooded swells on the near horizon
  if (ak > 7.5 && ak < 14) h = Math.max(h, 40 + 140 * fbm(ak * 0.55 + 3, bk * 0.5, 3) * smooth(7.5, 9.5, ak) * smooth(14, 11, ak));
  // Tanzawa: a crumpled ridge in front of Fuji, highest a little left of centre
  const ra = 15 + 1.2 * Math.sin(bk / 6.5) - 0.06 * bk;
  const tz = Math.exp(-(((ak - ra) / 2.4) ** 2)) * smooth(-17, -9, bk) * smooth(13, 7, bk);
  if (tz > 0.01) h = Math.max(h, 140 + 1050 * tz * (0.35 + 0.8 * ridged(ak * 0.6, bk * 0.55, 3) ** 1.6) * (0.85 + 0.25 * Math.exp(-(((bk - 2) / 5) ** 2))));
  // Hakone: a caldera rim round a central cone, to the left of Fuji
  const hr = Math.hypot(ak - 24, bk - 15.5);
  if (hr < 9) {
    const rim = Math.exp(-(((hr - 4.6) / 1.3) ** 2)) * (820 + 280 * ridged(ak * 0.7 + 5, bk * 0.7, 3));
    const cone = 1300 * Math.exp(-((hr / 1.6) ** 2));
    h = Math.max(h, 250 + Math.max(rim, cone - 250) * smooth(9, 6, hr));
  }
  // Okutama and Chichibu: long dark ridges to the right, rising further north
  const ok = smooth(-8, -16, bk) * smooth(19, 25, ak) * smooth(52, 44, ak);
  if (ok > 0.01) h = Math.max(h, 300 + (850 + 20 * Math.min(30, Math.max(0, -bk - 8))) * ok * (0.45 + 0.7 * ridged(ak * 0.35 + 11, bk * 0.32, 3)));
  return h;
}

export function bakeFuji(): Backdrop {
  const fwd: [number, number] = [Math.sin(AZ), Math.cos(AZ)];
  const side: [number, number] = [Math.sin(AZ + Math.PI / 2), Math.cos(AZ + Math.PI / 2)];
  // the heightfield in whole cubes, and each cell's own grain and snowline
  const lay = new Uint8Array(NA * NB);
  const snow = new Float32Array(NA * NB);
  for (let j = 0; j < NB; j++) for (let i = 0; i < NA; i++) {
    const a = A0 + (i + 0.5) * C, b = B0 + (j + 0.5) * C;
    // the ranges fade out toward the ends of the strip, so it never stops on a cliff
    const ang = Math.abs(Math.atan2(b, a));
    const base = plain(a / 1000, b / 1000);
    const dr = Math.hypot((a - FUJI_A) / 1000, (b - FUJI_B) / 1000) / FS;
    let h = land(a, b);
    if (dr < 16) h = Math.max(h, fuji(a, b));
    h = base + (h - base) * smooth(AZ_SPAN / 2, AZ_SPAN / 2 - 0.12, ang);
    lay[j * NA + i] = Math.max(0, Math.min(255, Math.round(h / C)));
    if (dr < 12) {
      const th = Math.atan2(b - FUJI_B, a - FUJI_A);
      const gully = Math.pow(0.5 + 0.5 * Math.sin(th * 13 + 2.5 * noise(th * 3, 1.7)), 7);
      snow[j * NA + i] = FS * (2600 - 650 * gully * smooth(1, 2.5, dr) + 140 * (hash(i, j) - 0.5));
    } else snow[j * NA + i] = 1e9;
  }

  const data = new Uint8Array(W * H * 4);
  const rowEl = (r: number) => EL0 + ((r + 0.5) / H) * EL_SPAN;
  const rowOf = (el: number) => Math.floor(((el - EL0) / EL_SPAN) * H);
  for (let x = 0; x < W; x++) {
    const phi = ((x + 0.5) / W - 0.5) * AZ_SPAN;
    const da = Math.cos(phi), db = Math.sin(phi);
    // start where the ray enters the grid's near edge
    let t = A0 / da;
    let pa = (A0 - A0) / C + 1e-6, pb = (t * db - B0) / C;
    let ci = Math.floor(pa), cj = Math.floor(pb);
    const si = 1, sj = db >= 0 ? 1 : -1;
    const dti = C / Math.max(1e-9, Math.abs(da)), dtj = C / Math.max(1e-9, Math.abs(db));
    let ti = t + (ci + 1 - pa) * dti;
    let tj = t + (sj > 0 ? cj + 1 - pb : pb - cj) * dtj;
    let face = 0;
    let filled = 0; // rows filled from the bottom
    let first = true;
    while (ci >= 0 && ci < NA && cj >= 0 && cj < NB && filled < H) {
      const k = ci + cj * NA;
      const top = lay[k] * C;
      const drop = t * t * DROP;
      const elTop = Math.atan2(top - EYE - drop, t);
      const r1 = Math.min(H, rowOf(elTop) + 1);
      if (r1 > filled) {
        for (let r = filled; r < r1; r++) {
          const el = rowEl(r);
          const z = EYE + Math.tan(el) * t + drop;
          let mat = z > snow[k] ? 2 : z > FS * 1900 + 260 * hash(ci * 3, cj * 7) ? 1 : z > 170 ? 0 : 3;
          if (first && el < 0.0005) continue; // the near plain below the horizon: the sky's own ground shows there
          if (mat === 3 && lay[k] * C > 400) mat = 0;
          if (mat === 0 && snow[k] < 1e8) mat = 1; // Fuji's own flanks read as dark scoria from afar, not green
          const lf = (z / C) % 1;
          const grain = hash(ci * 131 + Math.floor(z / C), cj * 71);
          const bevel = lf > 0.84 ? 0.32 : lf < 0.08 ? -0.18 : 0;
          const o = (r * W + x) * 4;
          data[o] = mat * 4 + face;
          data[o + 1] = Math.round(Math.max(0, Math.min(1, 0.5 + (grain - 0.5) * 0.4 + bevel)) * 255);
          data[o + 2] = Math.min(255, Math.round((t / 64000) * 255));
          data[o + 3] = 255;
        }
        filled = r1;
      }
      first = false;
      // next cell, remembering which face the ray goes in through
      if (ti < tj) { t = ti; ti += dti; ci += si; face = 0; }
      else { t = tj; tj += dtj; cj += sj; face = sj > 0 ? 1 : 2; }
    }
  }
  const tex = new THREE.DataTexture(data, W, H, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.magFilter = tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return { tex, az: AZ, azSpan: AZ_SPAN, el0: EL0, elSpan: EL_SPAN, fwd, side };
}
