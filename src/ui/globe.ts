import * as THREE from 'three';
import { WORLD } from '../data/worldmap';

/**
 * The pieces of the travel globe: a voxel planet built from the land mask (columns with biomes, trees, little towns
 * and landmarks), a shader ocean with shallows and surf, an atmosphere, voxel clouds, stars, the Tasty Air plane, its
 * runways and contrail, and a screen-space route line. Everything is lit by one sun, so day and night fall across the
 * globe where they really are.
 */

export const R = 1;
/** One voxel of land height. */
export const U = 0.0065;
export const OCEAN_R = R + U * 0.35;
/** Top of an airport cell (always one voxel high). */
export const GROUND_R = R + U;
const COLS = 144;
const CELL = WORLD.cell;
const PAD_N = 3;
const ROWS = PAD_N + WORLD.rows + 12;
const TOP = WORLD.lat0 + PAD_N * CELL; // 88.5°N
const BOTTOM = TOP - ROWS * CELL;
const MAX_H = 5;

export interface LatLon { lat: number; lon: number; }

// ------------------------------------------------------------------ small maths
const D2R = Math.PI / 180;

/** Unit vector of a place: +y is north, longitude 0 faces +z and east is +x. */
export function toDir(lat: number, lon: number, out = new THREE.Vector3()): THREE.Vector3 {
  const p = lat * D2R, l = lon * D2R;
  return out.set(Math.cos(p) * Math.sin(l), Math.sin(p), Math.cos(p) * Math.cos(l));
}

export function toLatLon(d: THREE.Vector3): LatLon {
  return { lat: Math.asin(Math.max(-1, Math.min(1, d.y))) / D2R, lon: Math.atan2(d.x, d.z) / D2R };
}

const Y = new THREE.Vector3(0, 1, 0);
/** East and north on the ground at a unit direction. */
export function tangents(d: THREE.Vector3, e: THREE.Vector3, n: THREE.Vector3): void {
  e.crossVectors(Y, d);
  if (e.lengthSq() < 1e-8) e.set(1, 0, 0);
  e.normalize();
  n.crossVectors(d, e).normalize();
}

/** A colour taken as is: the globe's shaders work straight in display colours. */
export const rgb = (hex: number) => new THREE.Color().setHex(hex, THREE.LinearSRGBColorSpace);

export function hash(x: number, y: number): number {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

/** Where the sun is overhead at a moment (declination and the hour angle, ignoring the equation of time). */
export function sunDir(ms: number, out: THREE.Vector3): THREE.Vector3 {
  const d = new Date(ms);
  const day = (ms - Date.UTC(d.getUTCFullYear(), 0, 1)) / 864e5;
  const dec = -23.44 * Math.cos((2 * Math.PI / 365) * (day + 10));
  const hours = d.getUTCHours() + d.getUTCMinutes() / 60 + d.getUTCSeconds() / 3600;
  return toDir(dec, (12 - hours) * 15, out);
}

// ------------------------------------------------------------------ mesh building
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _n = new THREE.Vector3();

/**
 * Collects flat-shaded quads. Each vertex carries a colour, a face uv (whole numbers mark voxel edges) and an
 * emission code: 0 none, (0, 256) a scatter of night lights (whole part = seed, fraction = density), 300-499 a
 * surface that stays readable at night (the plane), 500-999 a steady glow, 1000+ a blinking light.
 */
class Quads {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  emit: number[] = [];
  idx: number[] = [];

  /** a, b, c, d go round the face; `out` points away from it (the winding is fixed to match). */
  quad(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3, out: THREE.Vector3, color: THREE.Color, emit = 0, vMax = 1): void {
    _n.crossVectors(_a.subVectors(b, a), _b.subVectors(d, a));
    if (_n.dot(out) < 0) { const t = b; b = d; d = t; _n.negate(); }
    _n.normalize();
    const uvs = [0, 0, 1, 0, 1, vMax, 0, vMax], base = this.pos.length / 3;
    for (const [k, p] of [a, b, c, d].entries()) {
      this.pos.push(p.x, p.y, p.z);
      this.nor.push(_n.x, _n.y, _n.z);
      this.col.push(color.r, color.g, color.b);
      this.uv.push(uvs[k * 2], uvs[k * 2 + 1]);
      this.emit.push(emit);
    }
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  /** A box around c with half sizes along three axes (which need not be unit or orthogonal to the world). */
  box(c: THREE.Vector3, ax: THREE.Vector3, ay: THREE.Vector3, az: THREE.Vector3, hx: number, hy: number, hz: number, color: THREE.Color | number, emit = 0, bottom = false): void {
    const col = typeof color === 'number' ? rgb(color) : color;
    const X = ax.clone().multiplyScalar(hx), Yv = ay.clone().multiplyScalar(hy), Z = az.clone().multiplyScalar(hz);
    const P = (sx: number, sy: number, sz: number) => c.clone().addScaledVector(X, sx).addScaledVector(Yv, sy).addScaledVector(Z, sz);
    const faces: [THREE.Vector3, number[][]][] = [
      [ay, [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]],
      [ax, [[1, -1, -1], [1, 1, -1], [1, 1, 1], [1, -1, 1]]],
      [ax.clone().negate(), [[-1, -1, -1], [-1, 1, -1], [-1, 1, 1], [-1, -1, 1]]],
      [az, [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]],
      [az.clone().negate(), [[-1, -1, -1], [1, -1, -1], [1, 1, -1], [-1, 1, -1]]],
    ];
    if (bottom) faces.push([ay.clone().negate(), [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]]);
    for (const [o, q] of faces) {
      const [p0, p1, p2, p3] = q.map(([x, y, z]) => P(x, y, z));
      // faces that wrap round the sides go round in the order up the box; keep uv v along local y
      this.quad(p0, p1, p2, p3, o, col, emit);
    }
  }

  geometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('emit', new THREE.Float32BufferAttribute(this.emit, 1));
    g.setIndex(this.idx);
    g.computeBoundingSphere();
    return g;
  }
}

const X3 = new THREE.Vector3(1, 0, 0), Y3 = new THREE.Vector3(0, 1, 0), Z3 = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------------ the land grid
type Biome = 'snow' | 'ice' | 'tundra' | 'forest' | 'grass' | 'jungle' | 'sand' | 'rock' | 'peak';
// [top, side]
const COL: Record<Biome, [number, number]> = {
  snow: [0xf4f1ea, 0xc9d4dc],
  ice: [0xe6f2f6, 0xb4cdd8],
  tundra: [0xa9bf8c, 0x9b7e5c],
  forest: [0x5f9d63, 0x8f6c4b],
  grass: [0x8cc56a, 0xae8156],
  jungle: [0x4fa35a, 0x8c6747],
  sand: [0xefcd8a, 0xcfa062],
  rock: [0xb4a28e, 0x8e7a66],
  peak: [0xf7f5f0, 0xbdb5ab],
};

interface Grid { h: Uint8Array; b: Biome[]; tree: Uint8Array; town: Uint8Array; }

const inBox = (lat: number, lon: number, a: number, b: number, c: number, d: number) => lat >= a && lat <= b && lon >= c && lon <= d;
const latOf = (r: number) => TOP - (r + 0.5) * CELL;
const lonOf = (c: number) => -180 + (c + 0.5) * CELL;
const wrapC = (c: number) => ((c % COLS) + COLS) % COLS;
export const cellOf = (at: LatLon): [number, number] => [Math.max(0, Math.min(ROWS - 1, Math.floor((TOP - at.lat) / CELL))), wrapC(Math.floor((at.lon + 180) / CELL))];

function buildGrid(force: LatLon[]): Grid {
  const n = ROWS * COLS;
  const g: Grid = { h: new Uint8Array(n), b: new Array(n), tree: new Uint8Array(n), town: new Uint8Array(n) };
  const mask = (r: number, c: number): boolean => {
    const lat = latOf(r), lon = lonOf(c), dr = r - PAD_N;
    if (dr >= 0 && dr < WORLD.rows) {
      if (WORLD.land[dr][wrapC(c)] === '#') return true;
      if (lat > 80.5) return hash(c, r * 7) > 0.35; // the edge of the Arctic pack ice
      return false;
    }
    if (lat > 0) return lat > 83 || hash(c, r * 7) > 0.3; // Arctic pack ice
    // Antarctica, with the peninsula reaching up towards South America
    if (inBox(lat, lon, -71, -62, -66, -56)) return true;
    return lat < -67 + Math.sin(lon * D2R * 2) * 2 + Math.sin(lon * D2R * 5 + 1) * 1.2 + (hash(c, r) - 0.5) * 1.5;
  };
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (mask(r, c)) g.h[r * COLS + c] = 1;
  const isLand = (r: number, c: number) => r >= 0 && r < ROWS && g.h[r * COLS + wrapC(c)] > 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c;
    if (!g.h[i]) continue;
    const lat = latOf(r), lon = lonOf(c), al = Math.abs(lat), dr = r - PAD_N;
    const nh = hash(c, r);
    if (dr < 0 || dr >= WORLD.rows) {
      const ant = lat < 0;
      g.b[i] = ant ? 'snow' : 'ice';
      g.h[i] = ant ? (lat < -75 ? 3 : lat < -70 ? 2 : 1) + (nh > 0.8 ? 1 : 0) : 1;
      continue;
    }
    let inland = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) inland += isLand(r + dy, c + dx) ? 1 : 0;
    let m = 0;
    if (inBox(lat, lon, 27, 40, 70, 102)) m = 3; // Himalaya and Tibet
    else if (inBox(lat, lon, -50, 8, -80, -66) && lon < -66 - Math.max(0, lat + 20) * 0.1) m = 2; // Andes
    else if (inBox(lat, lon, 33, 62, -128, -105)) m = 2; // Rockies
    else if (inBox(lat, lon, 61, 84, -55, -18)) m = 2; // Greenland ice sheet
    else if (inBox(lat, lon, 44, 48, 5, 16) || inBox(lat, lon, 38, 44, 40, 50) || inBox(lat, lon, 4, 15, 35, 42) || inBox(lat, lon, 36, 50, 66, 90)) m = 1;
    let h = 1 + (m ? m - (nh < 0.35 ? 1 : 0) : 0) + (inland === 9 && nh > 0.78 ? 1 : 0);
    h = Math.min(MAX_H, Math.max(1, h));
    const desert = inBox(lat, lon, 15, 32, -17, 34) || inBox(lat, lon, 13, 32, 34, 60) || inBox(lat, lon, -31, -19, 117, 145) || inBox(lat, lon, 38, 47, 90, 115)
      || inBox(lat, lon, 24, 36, 55, 72) || inBox(lat, lon, 28, 37, -117, -104) || inBox(lat, lon, -28, -19, 14, 25) || inBox(lat, lon, 39, 46, 52, 66);
    let b: Biome;
    if (al > 66 || (lat > 60 && lon > -55 && lon < -18)) b = 'snow';
    else if (m >= 2 && h >= 3) b = h >= 4 || al > 45 ? 'peak' : 'rock';
    else if (desert) b = 'sand';
    else if (al > 58) b = 'tundra';
    else if (al > 46) b = 'forest';
    else if (al < 14) b = 'jungle';
    else b = 'grass';
    g.h[i] = h;
    g.b[i] = b;
    g.tree[i] = (b === 'forest' || b === 'jungle' || b === 'grass' || b === 'tundra') && nh > (b === 'grass' ? 0.6 : b === 'tundra' ? 0.8 : 0.35) ? 1 : 0;
  }
  // airports: every place on the map stands on a flat, one-voxel cell, with a little town round it
  for (const at of force) {
    const [r, c] = cellOf(at), i = r * COLS + c;
    if (!g.h[i] || g.b[i] === 'ice' || g.b[i] === 'snow' || g.b[i] === 'peak' || g.b[i] === 'rock') g.b[i] = 'grass';
    g.h[i] = 1;
    g.tree[i] = 0;
    g.town[i] = 2;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const j = (r + dy) * COLS + wrapC(c + dx);
      if ((dx || dy) && r + dy >= 0 && r + dy < ROWS && g.h[j] && !g.town[j]) { g.town[j] = 1; g.tree[j] = 0; if (g.h[j] > 2) g.h[j] = 2; }
    }
  }
  return g;
}

// ------------------------------------------------------------------ land mesh
const TOWN = [0xf3e3c8, 0xe7b28a, 0xd98f6a, 0xeeeae2, 0xc9d3d9, 0xf1cf8e];

function landGeometry(g: Grid): THREE.BufferGeometry {
  const q = new Quads();
  const colr = new THREE.Color(), side = new THREE.Color(), tmp = new THREE.Color();
  const height = (r: number, c: number) => (r >= 0 && r < ROWS ? g.h[r * COLS + wrapC(c)] : 0);
  const radius = (h: number) => (h ? R + h * U : R - U * 1.5);
  const ctr = new THREE.Vector3(), e = new THREE.Vector3(), n = new THREE.Vector3(), out = new THREE.Vector3();
  const v = (lat: number, lon: number, rad: number) => toDir(lat, lon).multiplyScalar(rad);
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const i = r * COLS + c, h = g.h[i];
    if (!h) continue;
    const la0 = TOP - r * CELL, la1 = la0 - CELL, lo0 = -180 + c * CELL, lo1 = lo0 + CELL;
    const rt = radius(h), b = g.b[i];
    const shade = 0.94 + hash(r * 3, c * 5) * 0.1;
    colr.setHex(COL[b][0], THREE.LinearSRGBColorSpace).multiplyScalar(shade);
    side.setHex(COL[b][1], THREE.LinearSRGBColorSpace).multiplyScalar(shade);
    toDir(latOf(r), lonOf(c), ctr);
    // night lights: towns glow, the countryside is a sparse scatter
    let emit = 0;
    if (g.town[i] === 1) emit = 1 + Math.floor(hash(c, r * 11) * 200) + 0.55;
    else if (g.town[i]) emit = 0;
    else if (b !== 'snow' && b !== 'ice' && b !== 'peak' && b !== 'rock' && hash(c * 13, r) > 0.55) emit = 1 + Math.floor(hash(r, c * 17) * 200) + 0.08 + hash(c, r * 3) * 0.2;
    q.quad(v(la0, lo0, rt), v(la0, lo1, rt), v(la1, lo1, rt), v(la1, lo0, rt), ctr, colr, emit);
    // walls, wherever the neighbour is lower (the sea counts as below the sea floor)
    const walls: [number, number, number, number, number, number][] = [
      [r - 1, c, la0, lo0, la0, lo1], [r + 1, c, la1, lo0, la1, lo1], [r, c - 1, la0, lo0, la1, lo0], [r, c + 1, la0, lo1, la1, lo1],
    ];
    for (const [nr, nc, aLa, aLo, bLa, bLo] of walls) {
      const nh = height(nr, nc);
      if (nh >= h) continue;
      const rb = radius(nh);
      out.copy(toDir((aLa + bLa) / 2, (aLo + bLo) / 2, _a)).sub(ctr);
      tmp.copy(side);
      if (nr < r) tmp.multiplyScalar(1.06); // walls that face the pole catch less light anyway; keep them lively
      q.quad(v(aLa, aLo, rt), v(bLa, bLo, rt), v(bLa, bLo, rb), v(aLa, aLo, rb), out, tmp, 0, nh ? h - nh : h + 1.5);
    }
    tangents(ctr, e, n);
    const cw = CELL * D2R * Math.cos(latOf(r) * D2R) * R, ch = CELL * D2R * R; // cell size on the ground
    const top = ctr.clone().multiplyScalar(rt);
    if (g.tree[i]) {
      const count = b === 'jungle' || b === 'forest' ? 4 : b === 'tundra' ? 1 : 2;
      for (let k = 0; k < count; k++) {
        const ox = (hash(c * 7 + k, r) - 0.5) * cw * 0.72, oz = (hash(r * 5 + k, c) - 0.5) * ch * 0.72;
        const s = (0.075 + hash(k, c + r) * 0.04) * ch;
        const tall = b === 'forest' || b === 'tundra' ? 1.7 : 1.1;
        const base = top.clone().addScaledVector(e, ox).addScaledVector(n, oz);
        const leaf = b === 'forest' ? 0x3d7a4e : b === 'tundra' ? 0x5a8a5c : b === 'jungle' ? 0x2f8a45 : 0x4a9449;
        q.box(base.clone().addScaledVector(ctr, s * tall), e, ctr, n, s, s * tall, s, rgb(leaf).multiplyScalar(0.92 + hash(k, r) * 0.16));
      }
    }
    if (g.town[i] === 1) {
      for (let k = 0; k < 7; k++) {
        const ox = (hash(c * 3 + k, r * 7) - 0.5) * cw * 0.8, oz = (hash(r * 3 + k, c * 7) - 0.5) * ch * 0.8;
        const w = (0.025 + hash(k * 3, c + r) * 0.025) * ch, tall = w * (0.8 + hash(k, r * c) ** 2 * 2.6);
        const base = top.clone().addScaledVector(e, ox).addScaledVector(n, oz).addScaledVector(ctr, tall);
        q.box(base, e, ctr, n, w, tall, w * (0.8 + hash(c, k) * 0.5), TOWN[(k + r + c) % TOWN.length], 1 + Math.floor(hash(k, c) * 200) + 0.5);
      }
    }
  }
  return q.geometry();
}

/** Distance from the coast, for shallows and surf: 0 on land, 1 out at sea. Equirectangular, south row first. */
function coastTexture(g: Grid): THREE.DataTexture {
  const S = 4, W = COLS * S, H = ROWS * S, P = 6 * S, WP = W + 2 * P;
  const d = new Float32Array(WP * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < WP; x++) {
    const r = ROWS - 1 - Math.floor(y / S), c = wrapC(Math.floor((x - P) / S));
    d[y * WP + x] = g.h[r * COLS + c] ? 0 : 1e9;
  }
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= WP || y >= H ? 1e9 : d[y * WP + x]);
  // two-pass chamfer distance (3-4 metric)
  for (let y = 0; y < H; y++) for (let x = 0; x < WP; x++) {
    const i = y * WP + x;
    d[i] = Math.min(d[i], at(x - 1, y) + 3, at(x, y - 1) + 3, at(x - 1, y - 1) + 4, at(x + 1, y - 1) + 4);
  }
  for (let y = H - 1; y >= 0; y--) for (let x = WP - 1; x >= 0; x--) {
    const i = y * WP + x;
    d[i] = Math.min(d[i], at(x + 1, y) + 3, at(x, y + 1) + 3, at(x + 1, y + 1) + 4, at(x - 1, y + 1) + 4);
  }
  const px = new Uint8Array(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const cells = d[y * WP + x + P] / 3 / S;
    const v = Math.round(Math.min(1, cells / 5) * 255);
    px.set([v, v, v, 255], (y * W + x) * 4);
  }
  const t = new THREE.DataTexture(px, W, H, THREE.RGBAFormat);
  t.wrapS = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export interface Land { geo: THREE.BufferGeometry; coast: THREE.DataTexture; heights: Uint8Array; }
let cached: { key: string; land: Land } | null = null;

/** The land, built once per set of airports and kept for the next time the map opens. */
export function buildLand(force: LatLon[]): Land {
  const key = force.map((f) => `${f.lat.toFixed(2)},${f.lon.toFixed(2)}`).join('|');
  if (cached?.key === key) return cached.land;
  const g = buildGrid(force);
  cached = { key, land: { geo: landGeometry(g), coast: coastTexture(g), heights: g.h } };
  return cached.land;
}

/** Height of the ground (land top or sea surface) at a place. */
export function groundAt(land: Land, at: LatLon): number {
  const [r, c] = cellOf(at), h = land.heights[r * COLS + c];
  return h ? R + h * U : OCEAN_R;
}

// ------------------------------------------------------------------ the plane, runways, landmarks
/** The Tasty Air airliner, nose along +z, left wing along +x, wheels at y = 0, about one unit long. */
export function planeGeometry(): THREE.BufferGeometry {
  const q = new Quads();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const b = (x: number, y: number, z: number, hx: number, hy: number, hz: number, c: number, emit = 300) => q.box(P(x, y, z), X3, Y3, Z3, hx, hy, hz, c, emit, true);
  const WHITE = 0xfbf7ef, TOMATO = 0xe9573f, GREY = 0xd9d4cb, DARK = 0x3b3f52;
  b(0, 0.14, -0.02, 0.07, 0.07, 0.42, WHITE); // fuselage
  b(0, 0.13, 0.43, 0.055, 0.055, 0.04, WHITE); // nose
  b(0, 0.155, 0.4, 0.058, 0.02, 0.035, DARK); // cockpit windows
  b(0, 0.115, 0.0, 0.072, 0.012, 0.4, TOMATO); // the tomato cheat line
  b(0, 0.165, -0.02, 0.0715, 0.012, 0.34, 0x46506e, 1 + 37 + 0.85); // cabin windows, lit at night
  b(0, 0.13, -0.46, 0.05, 0.05, 0.05, WHITE); // tail cone
  b(0, 0.27, -0.4, 0.012, 0.11, 0.08, TOMATO); // fin
  b(0, 0.31, -0.36, 0.013, 0.035, 0.03, 0xf4b63f); // the gold sun on the fin
  b(0, 0.16, -0.42, 0.2, 0.012, 0.05, GREY); // tailplane
  b(0, 0.11, 0.04, 0.5, 0.016, 0.1, GREY); // wings
  b(0, 0.11, -0.01, 0.48, 0.015, 0.06, 0xece8e0);
  for (const s of [1, -1]) {
    b(0.21 * s, 0.07, 0.1, 0.045, 0.04, 0.09, 0xb9c0c9); // engines
    b(0.21 * s, 0.07, 0.19, 0.035, 0.03, 0.005, DARK);
    b(0.49 * s, 0.13, 0.03, 0.012, 0.02, 0.025, s > 0 ? 0xff3b30 : 0x34d058, 1000); // red on the left, green on the right
    b(0.05 * s, 0.025, -0.02, 0.012, 0.025, 0.02, DARK); // main gear
  }
  b(0, 0.03, 0.34, 0.01, 0.03, 0.012, DARK); // nose gear
  b(0, 0.39, -0.44, 0.01, 0.01, 0.01, 0xffffff, 1000); // tail strobe
  return q.geometry();
}

/** A runway in the plane's frame (along +z), centred on the origin. */
export function runwayGeometry(len: number, wide: number): THREE.BufferGeometry {
  const q = new Quads();
  const P = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const t = U * 0.12;
  q.box(P(0, t, 0), X3, Y3, Z3, wide * 1.5, t, len / 2 + wide, 0x9fb38a); // apron grass
  q.box(P(0, t * 2.2, 0), X3, Y3, Z3, wide / 2, t * 0.6, len / 2, 0x55596a);
  for (let z = -len / 2 + wide * 1.6; z < len / 2 - wide * 1.6; z += wide * 1.6) q.box(P(0, t * 2.9, z), X3, Y3, Z3, wide * 0.05, t * 0.15, wide * 0.4, 0xf3efe6);
  for (const s of [1, -1]) {
    for (let k = -2; k <= 2; k++) q.box(P(k * wide * 0.16, t * 2.9, s * (len / 2 - wide * 0.5)), X3, Y3, Z3, wide * 0.05, t * 0.15, wide * 0.35, 0xf3efe6);
    for (let z = -len / 2; z <= len / 2 + 1e-6; z += len / 8) q.box(P(s * wide * 0.6, t * 3, z), X3, Y3, Z3, wide * 0.06, t * 0.5, wide * 0.06, 0xffe7a8, 600);
  }
  // a little terminal with a control tower beside the runway
  q.box(P(-wide * 1.25, t * 2 + wide * 0.25, 0), X3, Y3, Z3, wide * 0.32, wide * 0.25, len * 0.16, 0xf3e3c8, 1 + 91 + 0.7);
  q.box(P(-wide * 1.25, t * 2 + wide * 0.8, len * 0.2), X3, Y3, Z3, wide * 0.1, wide * 0.8, wide * 0.1, 0xeeeae2);
  q.box(P(-wide * 1.25, t * 2 + wide * 1.65, len * 0.2), X3, Y3, Z3, wide * 0.17, wide * 0.08, wide * 0.17, 0x7fb2c4, 1 + 23 + 0.9);
  return q.geometry();
}

/** A small voxel landmark for each destination, in the same frame (up +y, about 1 unit tall). */
export function landmarkGeometry(id: string): THREE.BufferGeometry | null {
  const q = new Quads();
  const b = (x: number, y: number, z: number, hx: number, hy: number, hz: number, c: number, emit = 0) => q.box(new THREE.Vector3(x, y, z), X3, Y3, Z3, hx, hy, hz, c, emit);
  const LIT = 1 + 53 + 0.6;
  switch (id) {
    case 'tokyo': // a vermilion torii and a red-and-white tower behind it
      for (const s of [1, -1]) b(0.3 * s, 0.4, 0, 0.06, 0.4, 0.06, 0xe5482f);
      b(0, 0.84, 0, 0.5, 0.05, 0.08, 0x2e2a2a);
      b(0, 0.66, 0, 0.38, 0.04, 0.05, 0xe5482f);
      for (const [y, w, c] of [[0.5, 0.22, 0xe9573f], [1.2, 0.16, 0xf6f1e8], [1.75, 0.11, 0xe9573f], [2.15, 0.06, 0xf6f1e8]] as const) b(0, y, -0.75, w, 0.3, w, c, c === 0xf6f1e8 ? LIT : 0);
      b(0, 2.6, -0.75, 0.025, 0.25, 0.025, 0xffffff, 1000);
      break;
    case 'seoul': // Namsan tower on its hill
      b(0, 0.15, 0, 0.6, 0.15, 0.6, 0x6aa46a);
      b(0, 1.1, 0, 0.07, 0.85, 0.07, 0xd9d4cb);
      b(0, 1.95, 0, 0.22, 0.12, 0.22, 0xf6f1e8, LIT);
      b(0, 2.35, 0, 0.03, 0.3, 0.03, 0xe9573f, 1000);
      break;
    case 'bangkok': // a golden chedi
      for (const [y, w] of [[0.1, 0.55], [0.32, 0.42], [0.55, 0.3], [0.8, 0.2], [1.05, 0.12], [1.35, 0.05]] as const) b(0, y, 0, w, 0.12, w, 0xf2bf3a, y < 0.3 ? LIT : 0);
      b(0, 1.6, 0, 0.02, 0.15, 0.02, 0xffe7a8, 600);
      break;
    case 'istanbul': // a domed mosque between two minarets
      b(0, 0.2, 0, 0.45, 0.2, 0.45, 0xe9e1d2, LIT);
      b(0, 0.5, 0, 0.32, 0.1, 0.32, 0xb8c4cc);
      b(0, 0.66, 0, 0.2, 0.08, 0.2, 0xb8c4cc);
      b(0, 0.78, 0, 0.08, 0.05, 0.08, 0xb8c4cc);
      for (const s of [1, -1]) { b(0.62 * s, 0.75, 0.3, 0.05, 0.75, 0.05, 0xf3efe6); b(0.62 * s, 1.58, 0.3, 0.03, 0.1, 0.03, 0x8fa2ad, 600); }
      break;
    case 'amalfi': // pastel houses stacked up a green cliff, the cathedral's striped tower at the foot
      b(-0.1, 0.35, -0.2, 0.6, 0.35, 0.35, 0x6f8f4e);
      b(-0.2, 0.85, -0.35, 0.45, 0.2, 0.22, 0x7f9a5c);
      for (const [x, y, z, c] of [[0.35, 0.12, 0.25, 0xf3e3b5], [0.05, 0.12, 0.3, 0xf2c6a8], [-0.25, 0.12, 0.28, 0xf6efe3], [0.2, 0.42, 0.05, 0xe8b9c2], [-0.1, 0.42, 0.08, 0xf3d27a], [-0.35, 0.72, -0.1, 0xf6efe3], [0.05, 0.72, -0.12, 0xf2c6a8]] as const) b(x, y, z, 0.12, 0.12, 0.1, c, LIT);
      b(0.5, 0.45, 0.35, 0.06, 0.45, 0.06, 0xe6c86a);
      b(0.5, 0.95, 0.35, 0.035, 0.06, 0.035, 0x5d9a6a, 600);
      break;
    case 'madeira': // white houses with red roofs up a green island, the Sé's tiled spire, a cable car cabin on its wire
      b(-0.15, 0.4, -0.15, 0.6, 0.4, 0.45, 0x4f8a3e);
      b(-0.3, 1.0, -0.3, 0.38, 0.25, 0.28, 0x5f9a4a);
      for (const [x, y, z] of [[0.35, 0.1, 0.3], [0.05, 0.1, 0.35], [-0.25, 0.1, 0.32], [0.25, 0.45, 0.05], [-0.1, 0.45, 0.1], [-0.35, 0.82, -0.05]] as const) { b(x, y, z, 0.11, 0.1, 0.09, 0xf6f1e8, LIT); b(x, y + 0.13, z, 0.12, 0.03, 0.1, 0xc4583a); }
      b(0.52, 0.4, 0.2, 0.06, 0.4, 0.06, 0xf6f1e8);
      b(0.52, 0.88, 0.2, 0.045, 0.08, 0.045, 0x2a5aa8, 600);
      b(0.1, 1.15, 0.45, 0.07, 0.06, 0.07, 0xd83a2a);
      break;
    case 'lisbon': // the Belém tower
      b(0, 0.3, 0, 0.32, 0.3, 0.32, 0xeee4cf, LIT);
      b(0, 0.85, 0, 0.2, 0.3, 0.2, 0xeee4cf, LIT);
      for (const [x, z] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) b(0.17 * x, 1.2, 0.17 * z, 0.04, 0.05, 0.04, 0xeee4cf);
      b(0.5, 0.06, 0, 0.18, 0.06, 0.12, 0xf4c430); // and a yellow tram going by
      break;
    case 'mexico': // a stepped pyramid
      for (const [y, w] of [[0.1, 0.7], [0.3, 0.55], [0.5, 0.4], [0.7, 0.26]] as const) b(0, y, 0, w, 0.1, w, 0xc8b08a);
      b(0, 0.88, 0, 0.14, 0.08, 0.14, 0xb5523b, LIT);
      b(0, 0.4, 0.55, 0.1, 0.3, 0.1, 0xb59e7a);
      break;
    default:
      return null;
  }
  return q.geometry();
}

// ------------------------------------------------------------------ shaders
export interface Shared { uSun: { value: THREE.Vector3 }; uTime: { value: number }; uCam: { value: THREE.Vector3 }; uRes: { value: THREE.Vector2 }; }

export function sharedUniforms(): Shared {
  return { uSun: { value: new THREE.Vector3(1, 0, 0) }, uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uRes: { value: new THREE.Vector2(1, 1) } };
}

/** Day, night and the warm band in between, the same everywhere on the globe. */
const LIGHT = /* glsl */ `
  uniform vec3 uSun;
  uniform float uTime;
  float dayOf(vec3 up) { return smoothstep(-0.14, 0.16, dot(up, uSun)); }
  vec3 dusk(vec3 col, float day) { return col * mix(vec3(1.0), vec3(1.16, 0.86, 0.72), (1.0 - abs(day * 2.0 - 1.0)) * 0.7); }
  float hash2(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
`;

export function voxelMaterial(u: Shared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: u.uSun, uTime: u.uTime },
    vertexShader: /* glsl */ `
      attribute vec3 color;
      attribute float emit;
      varying vec3 vN; varying vec3 vC; varying vec3 vW; varying vec2 vUv; varying float vE;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); vC = color; vUv = uv; vE = emit;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT}
      varying vec3 vN; varying vec3 vC; varying vec3 vW; varying vec2 vUv; varying float vE;
      void main() {
        vec3 n = normalize(vN), up = normalize(vW);
        float day = dayOf(up);
        // a soft bevel on every voxel edge
        vec2 f = fract(vUv + 1e-4), e = min(f, 1.0 - f);
        float rim = smoothstep(0.0, 0.1, min(e.x, e.y));
        vec3 c = vC * (0.84 + 0.16 * rim);
        float lam = max(dot(n, uSun), 0.0), hemi = 0.5 + 0.5 * dot(n, up);
        vec3 lit = c * (0.5 + 0.62 * lam) * (0.86 + 0.14 * hemi);
        vec3 dark = c * (vE >= 300.0 && vE < 500.0 ? vec3(0.46, 0.5, 0.68) : vec3(0.15, 0.19, 0.34)) * (0.75 + 0.25 * hemi);
        vec3 col = dusk(mix(dark, lit, day), day);
        if (vE >= 1000.0) col = vC * (0.35 + 1.4 * step(0.82, fract(uTime * 0.9 + vW.x * 7.0)));
        else if (vE >= 500.0) col = mix(col, vC * 1.25, 0.35 + 0.65 * (1.0 - day));
        else if (vE > 0.0 && vE < 300.0) {
          vec2 g = vUv * 6.0, id = floor(g);
          float on = step(hash2(id + floor(vE) * 1.37), fract(vE));
          float dotm = smoothstep(0.26, 0.08, length(fract(g) - 0.5));
          col += (1.0 - day) * on * dotm * vec3(1.0, 0.76, 0.42) * 1.25;
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
}

export function oceanMaterial(u: Shared, coast: THREE.Texture): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: u.uSun, uTime: u.uTime, uCam: u.uCam, uCoast: { value: coast } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${LIGHT}
      uniform vec3 uCam;
      uniform sampler2D uCoast;
      varying vec3 vW;
      void main() {
        vec3 n = normalize(vW);
        float lat = asin(clamp(n.y, -1.0, 1.0)), lon = atan(n.x, n.z);
        vec2 uv = vec2(lon / 6.2831853 + 0.5, (degrees(lat) - (${BOTTOM.toFixed(2)})) / ${(TOP - BOTTOM).toFixed(2)});
        float d = texture2D(uCoast, uv).r;
        vec3 c = mix(vec3(0.52, 0.86, 0.82), vec3(0.25, 0.63, 0.78), smoothstep(0.0, 0.32, d));
        c = mix(c, vec3(0.15, 0.42, 0.68), smoothstep(0.32, 1.0, d));
        // gentle swell and the surf rolling in on every shore
        float sw = sin(lon * 160.0 + uTime * 1.2 + sin(lat * 90.0) * 2.0) * sin(lat * 140.0 - uTime * 0.8);
        c += 0.025 * sw * (1.0 - d * 0.5);
        float surf = smoothstep(0.17, 0.04, d) * (0.5 + 0.5 * sin(uTime * 2.2 - d * 70.0 + sin(lon * 40.0) * 2.0));
        c = mix(c, vec3(0.96, 0.99, 0.98), surf * 0.75);
        vec3 v = normalize(uCam - vW);
        float day = dayOf(n), lam = max(dot(n, uSun), 0.0);
        float spec = pow(max(dot(n, normalize(uSun + v)), 0.0), 90.0) * 0.55;
        float fres = pow(1.0 - max(dot(n, v), 0.0), 3.0);
        vec3 lit = c * (0.62 + 0.45 * lam) + spec * day + fres * vec3(0.55, 0.75, 0.9) * 0.3;
        vec3 dark = c * vec3(0.11, 0.15, 0.3) + fres * vec3(0.12, 0.18, 0.4) * 0.35;
        // moonlight on the night side
        dark += pow(max(dot(n, normalize(-uSun + v * 2.0)), 0.0), 120.0) * vec3(0.25, 0.3, 0.45) * (1.0 - day);
        gl_FragColor = vec4(dusk(mix(dark, lit, day), day), 1.0);
      }`,
  });
}

/**
 * A glow round the limb, blue by day, amber at dusk, deep violet at night. Drawn additively on the inside of a
 * larger shell, so it also becomes the sky when the camera flies down low.
 */
export function atmosphereMaterial(u: Shared, outer: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: u.uSun, uTime: u.uTime, uCam: u.uCam },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() { vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: /* glsl */ `
      ${LIGHT}
      uniform vec3 uCam;
      varying vec3 vW;
      void main() {
        vec3 rd = normalize(vW - uCam);
        float tc = max(dot(-uCam, rd), 0.0);
        vec3 p = uCam + rd * tc;            // where the view ray passes closest to the centre
        float b = length(p);
        float k = clamp((b - ${R.toFixed(3)}) / ${(outer - R).toFixed(3)}, 0.0, 1.0);
        float glow = b > ${R.toFixed(3)} ? pow(1.0 - k, 2.4) : pow(b / ${R.toFixed(3)}, 10.0) * 0.55;
        float s = dot(normalize(p), uSun);
        vec3 col = mix(vec3(0.16, 0.18, 0.42), vec3(1.0, 0.58, 0.36), smoothstep(-0.35, 0.0, s));
        col = mix(col, vec3(0.5, 0.75, 1.0), smoothstep(0.0, 0.35, s));
        gl_FragColor = vec4(col * glow * mix(0.5, 0.85, smoothstep(-0.3, 0.2, s)), 1.0);
      }`,
    side: THREE.BackSide,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
}

/** Voxel clouds (instanced boxes), lit by the sun, grey-blue at night. */
export function cloudMaterial(u: Shared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: u.uSun, uTime: u.uTime },
    vertexShader: /* glsl */ `
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vUv = uv;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT}
      varying vec3 vN; varying vec3 vW; varying vec2 vUv;
      void main() {
        vec3 n = normalize(vN), up = normalize(vW);
        float day = dayOf(up), lam = max(dot(n, uSun), 0.0), hemi = dot(n, up);
        vec2 e = min(vUv, 1.0 - vUv);
        float rim = smoothstep(0.0, 0.12, min(e.x, e.y));
        vec3 c = vec3(1.0) * (0.9 + 0.1 * rim) * (0.8 + 0.2 * smoothstep(-1.0, 1.0, hemi));
        vec3 lit = c * (0.72 + 0.35 * lam);
        vec3 dark = c * vec3(0.24, 0.27, 0.42);
        gl_FragColor = vec4(dusk(mix(dark, lit, day), day), 1.0);
      }`,
  });
}

/** Contrail puffs: instanced boxes that fade out (per-instance aFade). */
export function puffMaterial(u: Shared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSun: u.uSun, uTime: u.uTime },
    vertexShader: /* glsl */ `
      attribute float aFade;
      varying float vA; varying vec3 vW; varying vec3 vN;
      void main() {
        mat4 m = modelMatrix * instanceMatrix;
        vec4 w = m * vec4(position, 1.0);
        vW = w.xyz; vN = normalize(mat3(m) * normal); vA = aFade;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      ${LIGHT}
      varying float vA; varying vec3 vW; varying vec3 vN;
      void main() {
        if (vA <= 0.0) discard;
        float day = dayOf(normalize(vW)), lam = max(dot(normalize(vN), uSun), 0.0);
        vec3 col = mix(vec3(0.3, 0.33, 0.5), vec3(0.92 + 0.08 * lam), day);
        gl_FragColor = vec4(col, vA * 0.75);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

export function starsMaterial(dpr: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDpr: { value: dpr } },
    vertexShader: /* glsl */ `
      attribute float aSize; attribute float aSeed;
      uniform float uTime; uniform float uDpr;
      varying float vA;
      void main() {
        vA = 0.55 + 0.45 * sin(uTime * (0.8 + aSeed * 1.7) + aSeed * 40.0);
        gl_PointSize = aSize * uDpr;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main() {
        vec2 p = abs(gl_PointCoord - 0.5);
        float a = (1.0 - smoothstep(0.15, 0.5, max(p.x, p.y))) * vA;   // little square stars, to match the voxels
        gl_FragColor = vec4(vec3(1.0, 0.95, 0.85), a);
      }`,
    transparent: true,
    depthWrite: false,
  });
}

/** A soft shadow under the plane. */
export function shadowMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uAlpha: { value: 0.3 } },
    vertexShader: /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uAlpha; varying vec2 vUv;
      void main() { float d = length((vUv - 0.5) * vec2(2.0, 1.0)); gl_FragColor = vec4(0.06, 0.1, 0.18, uAlpha * smoothstep(0.5, 0.15, d)); }`,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

/**
 * The route: a line of constant screen width (expanded in the vertex shader), solid where the plane has flown,
 * marching dashes ahead, tomato with a white edge.
 */
export function routeGeometry(points: THREE.Vector3[]): THREE.BufferGeometry {
  const n = points.length;
  const pos = new Float32Array(n * 6), oth = new Float32Array(n * 6), side = new Float32Array(n * 2), u = new Float32Array(n * 2);
  let len = 0;
  for (let i = 0; i < n; i++) {
    if (i) len += points[i].distanceTo(points[i - 1]);
    const p = points[i], o = points[i < n - 1 ? i + 1 : i - 1], flip = i < n - 1 ? 1 : -1;
    for (let k = 0; k < 2; k++) {
      pos.set([p.x, p.y, p.z], (i * 2 + k) * 3);
      oth.set([o.x, o.y, o.z], (i * 2 + k) * 3);
      side[i * 2 + k] = (k ? 1 : -1) * flip;
      u[i * 2 + k] = len;
    }
  }
  const idx: number[] = [];
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aOther', new THREE.BufferAttribute(oth, 3));
  g.setAttribute('aSide', new THREE.BufferAttribute(side, 1));
  g.setAttribute('aU', new THREE.BufferAttribute(u, 1));
  g.setIndex(idx);
  g.userData.len = len;
  g.computeBoundingSphere();
  return g;
}

export function routeMaterial(u: Shared): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uRes: u.uRes, uTime: u.uTime, uProg: { value: 0 }, uLen: { value: 1 }, uWidth: { value: 3.5 }, uAlpha: { value: 1 }, uDash: { value: 0.025 } },
    vertexShader: /* glsl */ `
      attribute vec3 aOther; attribute float aSide; attribute float aU;
      uniform vec2 uRes; uniform float uWidth;
      varying float vU; varying float vS;
      void main() {
        vec4 a = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec4 b = projectionMatrix * modelViewMatrix * vec4(aOther, 1.0);
        vec2 sa = a.xy / a.w * uRes, sb = b.xy / b.w * uRes;
        vec2 dir = normalize(sb - sa + 1e-6);
        vec2 nrm = vec2(-dir.y, dir.x) * aSide;
        a.xy += nrm * uWidth / uRes * a.w;
        gl_Position = a;
        vU = aU; vS = aSide;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTime; uniform float uProg; uniform float uLen; uniform float uAlpha; uniform float uDash;
      varying float vU; varying float vS;
      void main() {
        float done = step(vU, uProg * uLen);
        if (done < 0.5 && fract((vU - uTime * 0.03) / uDash) > 0.55) discard;
        float edge = abs(vS);
        vec3 col = edge > 0.55 ? vec3(1.0, 0.98, 0.95) : vec3(0.914, 0.341, 0.247);
        gl_FragColor = vec4(col, uAlpha * (1.0 - smoothstep(0.85, 1.0, edge) * 0.6));
      }`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}
