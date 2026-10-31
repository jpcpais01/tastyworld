import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';
import { farHouses, type FarLot, type FarTower } from './farhouses';
import { hillY, shoreY, headlandY, valleyZ, ROAD_X0, ROAD_X1 } from '../world/amalfiPlan';

/**
 * The Amalfi Coast past the edges of the playable map. The Lattari mountains climb from the town's two flanks to
 * ridges well over a thousand metres inland; the Valle dei Mulini carries on up behind the town; the headland to
 * the east hides Atrani in its own little valley, with Ravello on the ridge above it; to the west the coast road
 * clings to the cliffs past Conca dei Marini towards Positano. Out to sea there is only the gulf, all the way to
 * the horizon (the composite shader draws the water over the sea floor laid down here).
 *
 * All of it voxels, like the town: the ground is columns of blocks, 2 m at the map's edge and doubling outwards to
 * 32 m on the far ridges, wooded and terraced and broken into cliffs; stone pines, holm oaks, cypresses, chestnuts
 * and lemon trees stand on the slopes near town; the villages are built on the town's own rules (farhouses.ts).
 * Like the far city in Tokyo, anything between the iso camera and the map squats
 * down so it never hides the streets.
 */

type Rect = [number, number, number, number];

const smooth = (e0: number, e1: number, x: number) => { const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
const hash = (x: number, z: number) => { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); };
function vnoise(x: number, z: number): number {
  const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}
const fbm = (x: number, z: number) => vnoise(x, z) * 0.5 + vnoise(x * 2.1 + 5, z * 2.1 - 3) * 0.3 + vnoise(x * 4.3 - 7, z * 4.3 + 1) * 0.2;

/** The water's edge (x) along the coast at z, beyond the map. */
export function coastX(z: number): number {
  if (z > 0) {
    // west: the coast bends gently seaward past Conca dei Marini, a headland every few hundred metres
    const t = Math.max(0, z - 80);
    return 46 + t * 0.22 + 22 * Math.sin(t * 0.011) * smooth(0, 120, t) + 9 * Math.sin(t * 0.031 + 1.3) * smooth(0, 60, t);
  }
  // east: under the headland, then Atrani's cove behind it and the coast on towards Minori
  const t = Math.max(0, -80 - z);
  const cove = 52 * Math.exp(-(((z + 265) / 42) ** 2));
  return 36 - t * 0.08 + 10 * Math.sin(t * 0.017) * smooth(0, 80, t) - cove;
}

/** Valley floors carved into the mountains: the Mulini behind Amalfi, the Dragone behind Atrani. */
function valley(x: number, z: number, h: number): number {
  const inland = Math.max(0, -x);
  // the Valle dei Mulini: a cleft winding up behind the town, its floor climbing gently
  const vz = x < -112 ? valleyZ(-112) + 18 * Math.sin((x + 112) * 0.009) : valleyZ(x);
  const wA = 40 + inland * 0.08;
  const floorA = 10.6 + Math.max(0, -112 - x) * 0.16;
  const kA = Math.exp(-(((z - vz) / wA) ** 2)) * smooth(-40, -140, x) * smooth(-1400, -700, x);
  h += (Math.min(h, floorA) - h) * kA * 0.92;
  // the Valle del Dragone behind Atrani, opening into its cove
  const vzB = -265 + 30 * Math.sin(inland * 0.006);
  const wB = 22 + inland * 0.05;
  const floorB = 3 + inland * 0.12;
  const kB = Math.exp(-(((z - vzB) / wB) ** 2)) * smooth(-1300, -600, x);
  h += (Math.min(h, floorB) - h) * kB * 0.9;
  return h;
}

/** Ground height beyond the map (m): mountains inland, cliffs to the sea, the sea floor beyond the coast. */
export function farHeight(x: number, z: number): number {
  const cx = coastX(z);
  const d = cx - x; // inland distance from the water's edge
  if (d < 0) return Math.max(-38, -6 + d * 0.09); // the sea floor shelves away
  // the Lattari range: steep from the sea, ridges over a thousand metres a kilometre inland
  let h = 640 * (1 - Math.exp(-d / 520)) + 60 * smooth(0, 30, d);
  h *= 0.82 + 0.36 * fbm(x * 0.004, z * 0.004);
  h += (fbm(x * 0.013, z * 0.013) - 0.5) * 70 * smooth(0, 80, d);
  // sea cliffs: a sheer drop over the last few metres
  h = Math.min(h, d * 2.4 + 2);
  h = valley(x, z, h);
  return h;
}

/** What the far ground is at a spot, for its colour (the shader adds the detail). */
const enum Kind { Rock, Maquis, Terrace, Road, Beach, Seabed, Village, Wood }

interface Village { x: number; z: number; r: number; n: number; seed: number }
// Atrani in its cove, Ravello on the ridge, Pontone and Pogerola on the slopes, the town's own outskirts up the
// valley and along the coast, Conca dei Marini and Positano far to the west
const VILLAGES: Village[] = [
  { x: 10, z: -262, r: 46, n: 120, seed: 1 },
  { x: -300, z: -205, r: 70, n: 110, seed: 2 },
  { x: -235, z: -110, r: 40, n: 45, seed: 3 },
  { x: -390, z: 95, r: 55, n: 60, seed: 4 },
  { x: -170, z: -14, r: 58, n: 70, seed: 5 },
  { x: -60, z: 120, r: 60, n: 60, seed: 6 },
  { x: -60, z: -120, r: 50, n: 45, seed: 7 },
  { x: 120, z: 480, r: 70, n: 60, seed: 8 },
  { x: 250, z: 1150, r: 120, n: 160, seed: 9 },
];

/** Block size wanted at a distance (m) from the map: 2 m blocks at its edge, doubling outwards to 32 m ones. */
const want = (d: number) => (d < 32 ? 2 : d < 120 ? 4 : d < 320 ? 8 : d < 760 ? 16 : 32);
const ROOT = 64, TILE = 512;
/** Normals of the five faces a block shows (it never shows its bottom). */
const NRM: [number, number, number][] = [[0, 1, 0], [1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1]];

/**
 * The tree kinds of the coast, each five boxes (a trunk and four lumps of crown), as offset and size in metres:
 * the umbrella stone pine, the holm oak, the cypress, the chestnut of the high woods and the lemon of the terraces.
 */
const TREE_BOXES: [number, number, number, number, number, number][][] = [
  [[0, 0, 0, 0.55, 7.2, 0.55], [0, 6.6, 0, 7.2, 1.5, 6.4], [0.4, 7.9, -0.3, 5.0, 1.1, 4.6], [1.4, 8.8, 0.8, 2.6, 0.7, 2.4], [-2.8, 6.2, 1.6, 2.6, 1.1, 2.2]],
  [[0, 0, 0, 0.55, 2.4, 0.55], [0, 1.9, 0, 4.4, 2.6, 4.0], [0.2, 4.3, 0.1, 3.2, 1.3, 3.0], [1.7, 2.6, 1.0, 2.2, 1.7, 2.0], [-1.7, 2.3, -0.7, 2.0, 1.5, 2.4]],
  [[0, 0, 0, 0.4, 1.4, 0.4], [0, 1.0, 0, 1.7, 5.0, 1.7], [0, 5.8, 0, 1.25, 2.2, 1.25], [0, 7.8, 0, 0.75, 1.2, 0.75], [0, 1.5, 0, 2.0, 2.4, 2.0]],
  [[0, 0, 0, 0.75, 3.2, 0.75], [0, 2.7, 0, 6.0, 3.4, 5.6], [-0.2, 5.9, 0.2, 4.4, 1.7, 4.2], [2.7, 3.2, 1.3, 2.6, 2.1, 3.0], [-2.5, 3.0, -1.6, 3.0, 2.0, 2.4]],
  [[0, 0, 0, 0.3, 0.9, 0.3], [0, 0.7, 0, 2.4, 1.6, 2.2], [0.1, 2.2, 0, 1.6, 0.8, 1.6], [0.95, 1.0, 0.6, 1.2, 1.0, 1.0], [-0.9, 1.1, -0.5, 1.0, 0.8, 1.2]],
];

export function farCoast(shared: SharedUniforms, rect: Rect): { ground: THREE.Group; houses: THREE.Mesh } {
  const [x0, z0, x1, z1] = rect;
  const outside = (x: number, z: number) => Math.max(x0 - x, x - x1, z0 - z, z - z1, 0);
  // height where the far ground meets the map: what the map itself has at its edge, so the seam is a step at most
  const edgeY = (x: number, z: number) => {
    const ex = Math.max(x0, Math.min(x1, x)), ez = Math.max(z0, Math.min(z1, z));
    if (ex < ROAD_X0) return hillY(ex, ez) - 0.4;
    if (ex <= ROAD_X1) return ez < -52 ? hillY(ex, ez) + 4 : 1.6;
    return Math.max(shoreY(ex, ez), headlandY(ex, ez));
  };
  const H = (x: number, z: number) => {
    const o = outside(x, z);
    const far = farHeight(x, z), t = smooth(0, 130, o);
    let h = edgeY(x, z) * (1 - t) + far * t;
    // the coast road carries on out of the map, cut into the cliff a little way above the sea
    const rd = Math.abs(x - (coastX(z) - 10));
    if (z > z1 && rd < 4.5) h = Math.min(h, 1.6 + Math.max(0, z - z1) * 0.12);
    return h;
  };

  // ---- the ground as voxel blocks: a quadtree of square columns, 2 m at the map's edge and doubling outwards, so
  // a block always covers about the same slice of the view from town. Each column is drawn as its top and the
  // sides that stand above its neighbours; nothing hidden is ever meshed.
  const RX0 = x0 - ROOT * 23, RZ0 = z0 - ROOT * 24;
  const NI = 23 + Math.ceil((x1 - x0) / ROOT) + 11, NJ = 48 + Math.ceil((z1 - z0) / ROOT);
  const cellDist = (x: number, z: number, s: number) => Math.hypot(Math.max(x0 - x - s, x - x1, 0), Math.max(z0 - z - s, z - z1, 0));
  const split = (x: number, z: number, s: number) => s > 2 && s > want(cellDist(x, z, s));
  const key = (x: number, z: number, s: number) => (Math.round((x - RX0) / 2) * 4096 + Math.round((z - RZ0) / 2)) * 8 + Math.log2(s);
  const lx: number[] = [], lz: number[] = [], ls: number[] = [], top: number[] = [], base: number[] = [], kinds: number[] = [], flags: number[] = [];
  const index = new Map<number, number>();
  const leaf = (x: number, z: number, s: number) => {
    const cx = x + s / 2, cz = z + s / 2, r = Math.max(2, s / 2);
    const h = H(cx, cz);
    const slope = (Math.abs(H(cx + r, cz) - H(cx - r, cz)) + Math.abs(H(cx, cz + r) - H(cx, cz - r))) / (2 * r);
    const d = coastX(cz) - cx;
    let kd: Kind;
    if (h < -0.3) kd = Kind.Seabed;
    else if (h < 2.2 && d < 14 && slope < 0.5) kd = Math.abs(d - 10) < 4.5 && cz > z1 ? Kind.Road : Kind.Beach;
    else if (cz > z1 && Math.abs(cx - (coastX(cz) - 10)) < 4 && h < 40) kd = Kind.Road;
    // bare rock only on the sea cliffs and the sheerest crags: everything else wears scrub, woods or terraces
    else if (slope > 3 || (d < 45 && slope > 1.5)) kd = Kind.Rock;
    else if (h < 420 && slope < 1.1 && fbm(cx * 0.02, cz * 0.02) > 0.42) kd = Kind.Terrace;
    else if (h > 300 || fbm(cx * 0.01 + 9, cz * 0.01) > 0.45) kd = Kind.Wood;
    else kd = Kind.Maquis;
    for (const v of VILLAGES) if (Math.hypot(cx - v.x, cz - v.z) < v.r * 0.9 && kd !== Kind.Seabed && slope < 1.6) kd = Kind.Village;
    // steps of half a block (the shore and the road in half metres, so the beach stays out of the sea)
    const fineStep = kd === Kind.Beach || kd === Kind.Road || cellDist(x, z, s) < 6 || Math.abs(h) < 2.5;
    const step = fineStep ? 0.5 : s / 2;
    const b = Math.floor(h / step) * step;
    // woods and scrub break into a canopy of blocks: some columns stand a step proud, all leaves
    const rh = hash(cx * 0.37, cz * 0.53);
    const proud = h > 3 && (kd === Kind.Wood ? rh < 0.5 : kd === Kind.Maquis ? rh < 0.3 : false);
    const t = b + (proud ? (s <= 4 ? Math.max(step, 1) : s / 4) : 0);
    index.set(key(x, z, s), lx.length);
    lx.push(x); lz.push(z); ls.push(s); base.push(b); top.push(t); kinds.push(kd);
    flags.push(Math.log2(s) + (proud ? 8 : 0));
  };
  const visit = (x: number, z: number, s: number): void => {
    if (x >= x0 && x + s <= x1 && z >= z0 && z + s <= z1) return; // under the map: the town is there
    if (!split(x, z, s)) { leaf(x, z, s); return; }
    const h = s / 2;
    visit(x, z, h); visit(x + h, z, h); visit(x, z + h, h); visit(x + h, z + h, h);
  };
  for (let j = 0; j < NJ; j++) for (let i = 0; i < NI; i++) visit(RX0 + i * ROOT, RZ0 + j * ROOT, ROOT);
  /** The block whose column holds (x, z): its index, -2 under the map, -1 past the edge of the world. */
  const find = (px: number, pz: number) => {
    if (px >= x0 && px < x1 && pz >= z0 && pz < z1) return -2;
    const i = Math.floor((px - RX0) / ROOT), j = Math.floor((pz - RZ0) / ROOT);
    if (i < 0 || j < 0 || i >= NI || j >= NJ) return -1;
    let x = RX0 + i * ROOT, z = RZ0 + j * ROOT, s = ROOT;
    while (split(x, z, s)) { s /= 2; if (px >= x + s) x += s; if (pz >= z + s) z += s; }
    return index.get(key(x, z, s)) ?? -1;
  };
  /** The ground (without the canopy) at a point, for what stands on it. */
  const groundAt = (x: number, z: number) => { const n = find(x, z); return n >= 0 ? base[n] : H(x, z); };

  interface Buf { pos: number[]; info: number[]; tops: number[]; idx: number[]; lo: [number, number, number]; hi: [number, number, number] }
  const tiles = new Map<number, Buf>();
  const tileOf = (x: number, z: number) => {
    const k = Math.floor((x - RX0) / TILE) * 1000 + Math.floor((z - RZ0) / TILE);
    let t = tiles.get(k);
    if (!t) tiles.set(k, (t = { pos: [], info: [], tops: [], idx: [], lo: [1e9, 1e9, 1e9], hi: [-1e9, -1e9, -1e9] }));
    return t;
  };
  const quad = (b: Buf, c: number[][], n: number, kd: number, hs: number, fl: number, ty: number) => {
    // wind the quad to face its normal
    const N = NRM[n];
    const ux = c[1][0] - c[0][0], uy = c[1][1] - c[0][1], uz = c[1][2] - c[0][2];
    const vx = c[2][0] - c[0][0], vy = c[2][1] - c[0][1], vz = c[2][2] - c[0][2];
    const dot = (uy * vz - uz * vy) * N[0] + (uz * vx - ux * vz) * N[1] + (ux * vy - uy * vx) * N[2];
    const o = b.pos.length / 3;
    for (const p of dot < 0 ? [c[0], c[3], c[2], c[1]] : c) {
      b.pos.push(p[0], p[1], p[2]); b.info.push(n, kd, hs, fl); b.tops.push(ty);
      for (let a = 0; a < 3; a++) { b.lo[a] = Math.min(b.lo[a], p[a]); b.hi[a] = Math.max(b.hi[a], p[a]); }
    }
    b.idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  };
  for (let n = 0; n < lx.length; n++) {
    const x = lx[n], z = lz[n], s = ls[n], t = top[n], kd = kinds[n], fl = flags[n];
    const hs = Math.floor(hash(x * 0.71 + 3, z * 0.29 - 1) * 255);
    const b = tileOf(x + s / 2, z + s / 2);
    quad(b, [[x, t, z], [x, t, z + s], [x + s, t, z + s], [x + s, t, z]], 0, kd, hs, fl, t);
    // the sides, down to each neighbour that is lower (a neighbour is never less than half this block's size)
    const k = s >= 4 ? 2 : 1, seg = s / k;
    for (let f = 1; f <= 4; f++) {
      const alongZ = f <= 2, X = f === 1 ? x + s : x, Z = f === 3 ? z + s : z;
      let prev = -3, lo = 0, from = 0;
      const flush = (until: number) => {
        if (prev === -2 || lo >= t) return;
        const a = from * seg, e = until * seg;
        if (alongZ) quad(b, [[X, lo, z + a], [X, t, z + a], [X, t, z + e], [X, lo, z + e]], f, kd, hs, fl, t);
        else quad(b, [[x + a, lo, Z], [x + a, t, Z], [x + e, t, Z], [x + e, lo, Z]], f, kd, hs, fl, t);
      };
      for (let q = 0; q < k; q++) {
        const u = (q + 0.5) * seg;
        const m = alongZ ? find(X + (f === 1 ? 0.1 : -0.1), z + u) : find(x + u, Z + (f === 3 ? 0.1 : -0.1));
        if (q > 0 && m === prev) continue;
        if (q > 0) flush(q);
        prev = m; from = q; lo = m === -1 ? -40 : m >= 0 ? top[m] : 0;
      }
      flush(k);
    }
  }

  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2((x0 + x1) / 2, (z0 + z1) / 2) },
    uOrigin: { value: new THREE.Vector2(RX0, RZ0) },
  };
  const SQUASH = /* glsl */ `
    uniform vec3 uCamFwd; uniform vec2 uMid; uniform vec4 uRect;
    // iso view: ground between the camera and the map squats down so it never hides the streets (the town
    // climbs to the map's edge, so the squatting starts right there)
    float squash(vec2 xz) {
      if (projectionMatrix[3][3] != 1.0) return 1.0;
      vec2 dir = xz - uMid;
      float l = length(dir);
      if (l < 1.0) return 1.0;
      float camSide = -dot(dir / l, normalize(uCamFwd.xz));
      vec2 o = max(uRect.xy - xz, xz - uRect.zw);
      float out_ = max(0.0, max(o.x, o.y));
      return mix(1.0, 0.03, smoothstep(-0.3, 0.25, camSide) * smoothstep(0.0, 24.0, out_));
    }`;
  const HAZE = /* glsl */ `
    uniform vec3 uFogColor; uniform vec4 uFog; uniform vec4 uRect;
    // aerial perspective over kilometres of coast: blue-grey ridges fading into the sky, thinner up high
    vec3 haze(vec3 col, vec3 w) {
      vec2 o = max(uRect.xy - w.xz, w.xz - uRect.zw);
      float out_ = max(0.0, max(o.x, o.y));
      float lift = mix(1.0, 0.7, smoothstep(20.0, 600.0, w.y));
      float a = (1.0 - exp(-out_ * 0.0016)) * lift;
      if (uFog.w > 0.0) {
        float fd = max(0.0, distance(w, uFog.xyz) - FOG_START) * uFog.w * 0.12;
        a = max(a, (1.0 - exp(-fd * fd)) * lift);
      }
      return mix(col, uFogColor, min(a, 0.92));
    }`;
  const groundMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aInfo; in float aTop;
      ${SQUASH}
      out vec3 vWorld; out float vTop; flat out vec4 vInfo; flat out vec3 vN;
      const vec3 NRM[5] = vec3[5](vec3(0, 1, 0), vec3(1, 0, 0), vec3(-1, 0, 0), vec3(0, 0, 1), vec3(0, 0, -1));
      void main() {
        float s = squash(position.xz);
        vec3 p = vec3(position.x, position.y > 0.0 ? position.y * s : position.y, position.z);
        // squatted ground loses its relief too: no cliffs or canopy painted on a flattened hill
        float keep = smoothstep(0.45, 0.95, s);
        vWorld = vec3(position.x, mix(min(position.y, 0.0), position.y, keep), position.z);
        vTop = mix(min(aTop, 0.0), aTop, keep);
        vInfo = aInfo; vN = NRM[int(aInfo.x + 0.5)];
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp;
      uniform vec2 uOrigin;
      in vec3 vWorld; in float vTop; flat in vec4 vInfo; flat in vec3 vN;
      layout(location = 0) out vec4 outColor;
      vec3 lin(float r, float g, float b) { return srgb2lin(vec3(r, g, b)); }
      void main() {
        vec3 n = vN;
        float k = vInfo.y, cellH = vInfo.z / 255.0;
        float lvl = mod(vInfo.w, 8.0), sz = exp2(lvl);
        bool proud = vInfo.w > 7.5, top = n.y > 0.5;
        // where on the block: across its face (u) and down from its top edge (dn), in metres
        vec2 rel = vWorld.xz - uOrigin;
        float u = abs(n.x) > 0.5 ? rel.y : rel.x;
        float dn = vTop - vWorld.y;
        vec2 face = top ? rel : vec2(u, vWorld.y);
        float fw = max(fwidth(face.x), fwidth(face.y));
        // each block shows a grid of sub-voxels a quarter of its size (never finer than half a metre), each its own tint
        float sub = max(0.5, sz * 0.25);
        vec2 sc = floor(face / sub + 1e-3);
        float fine = 1.0 - smoothstep(sub * 0.25, sub * 0.7, fw);
        float tint = mix(1.0, 0.86 + 0.26 * hash12(sc + vInfo.z), fine) * (0.9 + 0.2 * cellH);
        vec3 alb;
        float lights = 0.0;
        // the green lip on top of a side, a ragged line of sub-voxels
        float lip = (sub * 0.6 + 0.12) * (0.6 + 0.8 * hash12(vec2(floor(u / sub), vTop)));
        bool grassy = k > 0.5 && k < 2.5 || k > 5.5;
        bool lipped = !top && grassy && dn < lip;
        if (k > 4.5 && k < 5.5) {
          // the sea floor: sand and weed, seen through the water
          alb = mix(lin(0.42, 0.45, 0.4), lin(0.2, 0.3, 0.26), vnoise(vWorld.xz * 0.08));
        } else if (k > 3.5 && k < 4.5) {
          // the coast's grey pebbles, and their sea wall
          alb = top ? mix(lin(0.6, 0.58, 0.55), lin(0.47, 0.46, 0.44), hash12(sc * 1.3)) : lin(0.62, 0.58, 0.5);
        } else if (k > 2.5 && k < 3.5) {
          alb = top ? lin(0.33, 0.33, 0.35) : lin(0.64, 0.6, 0.52);
          lights = 0.4;
        } else if (proud || ((top || lipped) && grassy)) {
          // foliage: holm oak and chestnut woods dark and dense, the scrub lower down warmer, lemon terraces bright
          vec3 a = k > 6.5 ? lin(0.13, 0.25, 0.11) : k > 1.5 && k < 2.5 ? lin(0.3, 0.46, 0.15) : k > 5.5 ? lin(0.36, 0.45, 0.24) : lin(0.25, 0.37, 0.15);
          vec3 b = k > 6.5 ? lin(0.22, 0.36, 0.14) : k > 1.5 && k < 2.5 ? lin(0.22, 0.36, 0.12) : k > 5.5 ? lin(0.48, 0.5, 0.36) : lin(0.38, 0.45, 0.2);
          alb = mix(a, b, hash12(sc * 0.7 + 11.0) * 0.6 + cellH * 0.4);
          if (proud && !top) alb *= 0.78;
          if (k > 1.5 && k < 2.5 && top) {
            // lemon terraces: the dark nets of the pergolas over the rows, a glint of fruit in the leaves
            vec2 g = fract(vWorld.xz / 3.0);
            float net = max(step(g.x, 0.07), step(g.y, 0.07)) * fine;
            alb = mix(alb, lin(0.17, 0.2, 0.14), net * 0.55);
            alb = mix(alb, lin(0.9, 0.78, 0.18), step(0.9, hash12(floor(vWorld.xz * 2.0))) * 0.75 * (1.0 - smoothstep(0.25, 0.6, fw)));
          }
        } else if (k > 1.5 && k < 2.5) {
          // the terraces' dry-stone walls: courses of grey limestone
          vec2 st = vec2(u / 0.9 + floor(vWorld.y / 0.45) * 0.5, vWorld.y / 0.45);
          float joint = max(step(fract(st.x), 0.06), step(fract(st.y), 0.1)) * fine;
          alb = mix(lin(0.62, 0.59, 0.53), lin(0.5, 0.48, 0.44), hash12(floor(st)));
          alb *= 1.0 - joint * 0.3;
        } else if ((k > 0.5 && k < 1.5 || k > 6.5) && hash12(sc * 0.9 + 4.0) > (cellH < 0.25 ? 0.5 : 0.1)) {
          // the scrub and the woods hang down over the steps of the slope: holm oak, myrtle, ivy and broom
          alb = mix(k > 6.5 ? lin(0.11, 0.21, 0.1) : lin(0.21, 0.32, 0.13), k > 6.5 ? lin(0.18, 0.3, 0.12) : lin(0.32, 0.4, 0.18), hash12(sc * 0.7 + 3.0));
        } else {
          // limestone: pale and streaked in strata, ochre where fresh, moss and ivy in the cracks
          float strata = vnoise(vec2(u * 0.05, vWorld.y * 0.4));
          alb = mix(lin(0.7, 0.66, 0.58), lin(0.52, 0.45, 0.37), strata * 0.7 + hash12(sc) * 0.3);
          if (top) alb = mix(alb, lin(0.4, 0.47, 0.3), 0.55);
          // (even the crags carry clumps of holm oak and caper in their ledges)
          else alb = mix(alb, lin(0.22, 0.34, 0.15), step(k > 0.5 ? 0.6 : 0.68, hash12(sc * 0.9 + 4.0)) * 0.9);
        }
        alb *= tint;
        if (k > 5.5) lights = 1.0;
        if (!top) lights = 0.0;
        // a block's edges catch the light, like the voxel bevels in town
        vec2 fa = top ? mod(rel, sz) : vec2(mod(u, sz), dn);
        float d = top ? min(min(fa.x, sz - fa.x), min(fa.y, sz - fa.y)) : min(min(fa.x, sz - fa.x), fa.y);
        float bevel = (1.0 - smoothstep(0.0, 0.05 * sz + fw * 0.8, d)) * 0.16;
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        // the foot of a tall side sits in the shade of the slope
        float occl = top ? 1.0 : mix(0.82, 1.0, 1.0 - smoothstep(0.0, sz * 1.5, dn));
        vec3 col = alb * (uSunColor * ndl + hemi) * occl * (1.0 + bevel);
        // a few lamps along the road and in the villages after dark
        if (lights > 0.0) {
          vec2 c = floor(vWorld.xz * 0.25);
          float on = step(0.9 - lights * 0.06, hash12(c + 3.7));
          vec2 f = fract(vWorld.xz * 0.25) - 0.5;
          col += uWindowColor * on * exp(-dot(f, f) * 40.0) * uNight * 0.5;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  });
  const ground = new THREE.Group();
  for (const b of tiles.values()) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(b.pos), 3));
    g.setAttribute('aInfo', new THREE.BufferAttribute(new Uint8Array(b.info), 4));
    g.setAttribute('aTop', new THREE.BufferAttribute(new Float32Array(b.tops), 1));
    g.setIndex(b.pos.length / 3 > 65535 ? new THREE.BufferAttribute(new Uint32Array(b.idx), 1) : new THREE.BufferAttribute(new Uint16Array(b.idx), 1));
    // bounds reach down to the sea: in the iso view a hill on the camera's side squats to the ground
    g.boundingBox = new THREE.Box3(new THREE.Vector3(b.lo[0], Math.min(b.lo[1], -1), b.lo[2]), new THREE.Vector3(...b.hi));
    g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
    const m = new THREE.Mesh(g, groundMat);
    m.renderOrder = 10; // after the world, so it only fills what the voxels leave empty
    m.matrixAutoUpdate = false;
    ground.add(m);
  }

  // ---- trees: on the scrub and in the woods near town, and lemons in rows on the terraces
  const trees: number[] = [];
  for (let n = 0; n < lx.length; n++) {
    const s = ls[n], kd = kinds[n];
    if (s > 8 || flags[n] >= 8 || !(kd === Kind.Maquis || kd === Kind.Wood || kd === Kind.Terrace)) continue;
    const x = lx[n], z = lz[n];
    const many = s === 8 ? 2 : 1;
    for (let q = 0; q < many; q++) {
      const r = (a: number) => hash(x * 0.13 + a * 17.1 + q * 5.3, z * 0.19 - a * 3.7 + q * 9.1);
      const p = kd === Kind.Terrace ? (s === 2 ? 0.45 : 0.75) : s === 2 ? 0.25 : s === 4 ? 0.6 : 0.85;
      if (r(0) > p) continue;
      const tx = x + s * (0.3 + 0.4 * r(1)) + (many > 1 ? (q - 0.5) * s * 0.4 : 0), tz = z + s * (0.3 + 0.4 * r(2));
      const y = base[n];
      if (y < 2.5) continue;
      let type: number;
      const r3 = r(3);
      if (kd === Kind.Terrace) type = 4;
      else if (kd === Kind.Wood) type = y > 350 ? 3 : r3 < 0.6 ? 1 : 3;
      else type = r3 < 0.32 ? 0 : r3 < 0.75 ? 1 : 2;
      const scale = (type === 4 ? 0.9 : 0.8) + r(4) * 0.45 + (s === 8 ? 0.2 : 0);
      trees.push(tx, y - 0.25, tz, type, scale, r(5));
    }
  }
  const tbox = new THREE.BoxGeometry(1, 1, 1);
  tbox.translate(0, 0.5, 0);
  // five boxes per tree, the trunk without its foot
  const tPos: number[] = [], tNrm: number[] = [], tPart: number[] = [], tIdx: number[] = [];
  const bp = tbox.attributes.position, bn = tbox.attributes.normal, bi = tbox.index!;
  for (let part = 0; part < 5; part++) {
    const o = tPos.length / 3;
    for (let v = 0; v < bp.count; v++) { tPos.push(bp.getX(v), bp.getY(v), bp.getZ(v)); tNrm.push(bn.getX(v), bn.getY(v), bn.getZ(v)); tPart.push(part); }
    for (let i = 0; i < bi.count; i += 3) {
      const a = bi.getX(i), b = bi.getX(i + 1), c = bi.getX(i + 2);
      if (part === 0 && bn.getY(a) < -0.5) continue; // (a crown's underside shows from the street below)
      tIdx.push(o + a, o + b, o + c);
    }
  }
  tbox.dispose();
  const tg = new THREE.InstancedBufferGeometry();
  tg.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
  tg.setAttribute('normal', new THREE.Float32BufferAttribute(tNrm, 3));
  tg.setAttribute('aPart', new THREE.Float32BufferAttribute(tPart, 1));
  tg.setIndex(tIdx);
  const tb = new THREE.InstancedInterleavedBuffer(new Float32Array(trees), 6);
  tg.setAttribute('aTree', new THREE.InterleavedBufferAttribute(tb, 4, 0));
  tg.setAttribute('aVar', new THREE.InterleavedBufferAttribute(tb, 2, 4));
  tg.instanceCount = trees.length / 6;
  const glslBoxes = (f: (b: number[]) => string) => TREE_BOXES.flat().map(f).join(', ');
  const treeMesh = new THREE.Mesh(tg, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in float aPart; in vec4 aTree; in vec2 aVar;
      ${SQUASH}
      const vec3 OFF[25] = vec3[25](${glslBoxes((b) => `vec3(${b[0].toFixed(2)}, ${b[1].toFixed(2)}, ${b[2].toFixed(2)})`)});
      const vec3 SIZ[25] = vec3[25](${glslBoxes((b) => `vec3(${b[3].toFixed(2)}, ${b[4].toFixed(2)}, ${b[5].toFixed(2)})`)});
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; flat out float vPart; flat out float vType; flat out float vSeed;
      void main() {
        int i = int(aTree.w + 0.5) * 5 + int(aPart + 0.5);
        vec3 off = OFF[i], siz = SIZ[i];
        // mirrored at random so no two trees of a kind share a silhouette
        off.xz *= vec2(aVar.y > 0.5 ? -1.0 : 1.0, fract(aVar.y * 7.0) > 0.5 ? -1.0 : 1.0);
        vLocal = position * siz;
        vec3 p = aTree.xyz + (vLocal + off) * aVar.x;
        vWorld = p; vN = normal; vPart = aPart; vType = aTree.w; vSeed = aVar.y;
        // a tree on squatted ground isn't drawn at all
        float s = squash(aTree.xz);
        if (s < 0.6) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        p.y = aTree.y * s + (p.y - aTree.y);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir;
      in vec3 vWorld; in vec3 vN; in vec3 vLocal; flat in float vPart; flat in float vType; flat in float vSeed;
      layout(location = 0) out vec4 outColor;
      vec3 lin(float r, float g, float b) { return srgb2lin(vec3(r, g, b)); }
      void main() {
        vec3 n = normalize(vN);
        int t = int(vType + 0.5);
        // leaves in half-metre voxels, each its own shade
        vec3 q = vWorld * 2.0 + n * 0.25;
        vec2 f2 = abs(n.y) > 0.5 ? q.xz : abs(n.x) > 0.5 ? q.zy : q.xy;
        vec2 cell = floor(f2);
        float fw = max(fwidth(f2.x), fwidth(f2.y));
        float fine = 1.0 - smoothstep(0.4, 0.9, fw);
        vec3 alb;
        if (vPart < 0.5) alb = t == 0 ? lin(0.45, 0.33, 0.25) : lin(0.33, 0.27, 0.22);
        else {
          vec3 a = t == 0 ? lin(0.16, 0.29, 0.17) : t == 1 ? lin(0.17, 0.27, 0.13) : t == 2 ? lin(0.1, 0.2, 0.12) : t == 3 ? lin(0.27, 0.4, 0.16) : lin(0.21, 0.4, 0.14);
          alb = a * (0.88 + 0.24 * vSeed);
          alb *= mix(1.0, 0.8 + 0.4 * hash12(cell + vSeed * 31.0), fine);
          // lemons hang thick in the terrace trees
          if (t == 4) alb = mix(alb, lin(0.95, 0.8, 0.15), step(0.84, hash12(cell * 1.7 + 5.0)) * fine * step(n.y, 0.5));
        }
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        // a crown is darker underneath and inside, brighter on its sunlit top
        float occl = n.y < -0.5 ? 0.55 : mix(0.7, 1.0, clamp(vLocal.y / 1.2, 0.0, 1.0));
        vec3 col = alb * (uSunColor * ndl + hemi) * occl;
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  treeMesh.frustumCulled = false;
  treeMesh.renderOrder = 10;
  ground.add(treeMesh);

  // houses: in the villages, one by one on the slope, each facing downhill (see farhouses.ts)
  const lots: FarLot[] = [];
  for (const v of VILLAGES) {
    let seed = v.seed * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < v.n * 3 && lots.length < 1400; i++) {
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * v.r;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      if (outside(x, z) < 6) continue;
      const w = 4.5 + rnd() * 4.5, dd = 4 + rnd() * 4;
      const hs4 = [groundAt(x - w / 2, z - dd / 2), groundAt(x + w / 2, z - dd / 2), groundAt(x - w / 2, z + dd / 2), groundAt(x + w / 2, z + dd / 2), groundAt(x, z)];
      const lo = Math.min(...hs4), hi = Math.max(...hs4);
      if (lo < 0.8 || hi - lo > 9) continue; // in the sea, or too steep to build on
      const sides = [groundAt(x + w / 2 + 2, z), groundAt(x - w / 2 - 2, z), groundAt(x, z + dd / 2 + 2), groundAt(x, z - dd / 2 - 2)];
      const front = sides.indexOf(Math.min(...sides));
      lots.push({ x, z, w, d: dd, lo, hi, front, seed: Math.floor(rnd() * 1e6) + 1 });
    }
  }
  // a bell tower or two: Atrani's San Salvatore and Ravello's cathedral
  const towers: FarTower[] = ([[24, -258, 0xe8d7b0], [-288, -200, 0xefe6d6]] as const).map(([x, z, color]) => ({ x, z, ground: groundAt(x, z), h: 22, color }));
  const houses = farHouses(u, SQUASH, HAZE, lots, towers);

  // the sea floor everywhere the ground mesh doesn't reach, deep enough that the water reads as open sea
  const R = 6000;
  const sea = new THREE.BufferGeometry();
  sea.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -R, -40, -R, -R, -40, R, R, -40, R, -R, -40, -R, R, -40, R, R, -40, -R,
  ]), 3));
  const floor = new THREE.Mesh(sea, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `out vec3 vWorld; void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uFogColor;
      in vec3 vWorld;
      layout(location = 0) out vec4 outColor;
      void main() { outColor = vec4(uFogColor * 0.2, 1.0); }`,
  }));
  floor.frustumCulled = false;
  floor.renderOrder = 11;
  ground.add(floor);
  return { ground, houses };
}
