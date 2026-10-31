import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';
import { hillY, shoreDist } from '../world/istanbulPlan';

/**
 * Istanbul past the edges of the playable map, in the same blocky language as the town: ground in flat-topped
 * terraces, buildings as boxes. Across the Golden Horn Karaköy's quays and the Galata hill with its tower; across
 * the Bosphorus the Asian shore, Üsküdar's mosques and the hill of Çamlıca; the Maiden's Tower on its rock in the
 * strait; south of the map the old city carries on over its hills to Topkapı, Hagia Sophia and the Blue Mosque;
 * west of it Fatih's hills, the great mosques along the ridge and the arches of the aqueduct.
 *
 * One mesh of terraced ground (cells growing with distance from the map) and one instanced draw of boxes whose
 * windows, roofs and lead the shader paints. Like Tokyo's far city, anything between the iso camera and the map
 * squats down so it never hides the streets.
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
const dome = (x: number, z: number, cx: number, cz: number, h: number, r: number) => h * Math.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (r * r));

/** The European shore of the Bosphorus (x) at z: Karaköy and Tophane north of the Horn, Sarayburnu and the Marmara south. */
const westShore = (z: number) => (z > 64 ? 30 + (z - 64) * 0.9 : z < -112 ? 30 + (-112 - z) * 0.28 + 30 * smooth(-112, -260, z) : 30);
/** The Asian shore across the strait, opening out into the Sea of Marmara to the south. */
const eastShore = (z: number) => 430 + 40 * Math.sin(z * 0.004) + Math.max(0, -380 - z) * 1.6;
/** The Golden Horn's far bank: Karaköy, then Kasımpaşa as the Horn bends north-west. */
const hornNorth = (x: number) => 64 + Math.max(0, -420 - x) * 0.35;

/** Metres of water (positive) or land (negative) at a spot, roughly: positive inside the water. */
function wet(x: number, z: number): number {
  const horn = x < westShore(Math.min(z, 64)) + 2 ? Math.min(z - 44, hornNorth(x) - z) : -1e3;
  const strait = Math.min(x - westShore(z), eastShore(z) - x);
  // the Maiden's Tower stands on its own rock in the strait
  const rock = 7 - Math.hypot(x - 175, z + 150);
  return Math.max(horn, strait) - Math.max(0, rock) * 10;
}

/** Ground height beyond the map (m): the seven hills, Galata and Beyoğlu, Üsküdar and Çamlıca; the sea floor. */
export function farHeight(x: number, z: number): number {
  const w = wet(x, z);
  if (w > 0) return Math.max(-30, -4 - w * 0.12);
  const d = -w;
  // the old city's hills, Galata and Beyoğlu across the Horn, the Asian hills, Çamlıca high above them
  const hills = Math.max(
    dome(x, z, -140, -8, 14, 70), dome(x, z, -40, -300, 26, 120), dome(x, z, -320, -110, 34, 140), dome(x, z, -470, 30, 40, 150),
    dome(x, z, 30, -200, 22, 60), dome(x, z, -30, 190, 34, 110), dome(x, z, -160, 330, 52, 190), dome(x, z, 120, 340, 40, 160),
    dome(x, z, 560, 110, 44, 160), dome(x, z, 820, 380, 150, 220), dome(x, z, 600, -260, 30, 160),
  );
  const h = 1.2 + hills * smooth(0, 40, d) + (fbm(x * 0.012, z * 0.012) - 0.5) * 6 * smooth(10, 80, d);
  return Math.max(0.8, h);
}

const enum Kind { Seabed, Quay, Town, Park, Scrub }

/** Parks and gardens: Gülhane and Topkapı's gardens, the slopes round the Maiden's Tower, the woods on Çamlıca. */
function parkAt(x: number, z: number): boolean {
  if (x > 10 && x < 95 && z < -150 && z > -250) return true;
  if (Math.hypot(x - 820, z - 380) < 150) return true;
  if (Math.hypot(x - 175, z + 150) < 9) return false;
  return fbm(x * 0.02 + 3, z * 0.02) > 0.7;
}

/** One box of the far city: centre x, z, size w, d, foot y and height h, a seed, a kind (see the shader), a colour. */
type Box = [number, number, number, number, number, number, number, number, number, number, number];

const PASTEL = ['#efe2cc', '#f1d9a8', '#e9c3a0', '#dcc7b0', '#f3ece0', '#e3b8a0', '#d9cfc0', '#f0e6c8', '#c9b49a', '#e8d2c0', '#d3c4b6', '#f4efe6'];

export function farIstanbul(shared: SharedUniforms, rect: Rect): { ground: THREE.Mesh; houses: THREE.Mesh; ferries: THREE.Group; update: (dt: number) => void } {
  const [x0, z0, x1, z1] = rect;
  const outside = (x: number, z: number) => Math.max(x0 - x, x - x1, z0 - z, z - z1, 0);
  // where the far ground meets the map it has the map's own height, so the seam is a step at most
  const edgeY = (x: number, z: number) => {
    const ex = Math.max(x0, Math.min(x1, x)), ez = Math.max(z0, Math.min(z1, z));
    return shoreDist(ex, ez) < 0 ? -4 : hillY(ex, ez);
  };
  const H = (x: number, z: number) => {
    const o = outside(x, z);
    if (o <= 0) return -40; // under the map: the voxels are the ground there
    const far = farHeight(x, z), t = smooth(0, 60, o);
    const e = edgeY(x, z);
    // water stays water across the seam; land blends from the map's edge into the hills
    if (far < 0 || e < 0) return t > 0.5 || e < 0 ? Math.min(far, e < 0 ? far : e) : e * (1 - t) + far * t;
    return e * (1 - t) + far * t;
  };

  // grid lines: 2 m where the map meets the far ground, coarser and coarser away from it
  const axis = (a0: number, a1: number, lo: number, hi: number) => {
    const out: number[] = [];
    for (let a = a0; a <= a1 + 0.01; a += 4) out.push(a);
    let a = a0, s = 2;
    while (a > lo) { s = Math.min(40, s * 1.06); a -= s; out.unshift(a); }
    a = a1; s = 2;
    while (a < hi) { s = Math.min(40, s * 1.06); a += s; out.push(a); }
    return out;
  };
  const xs = axis(x0, x1, -1700, 1700), zs = axis(z0, z1, -1700, 1700);
  const nx = xs.length - 1, nz = zs.length - 1;
  // one flat terrace per cell, its height in whole steps (a metre near the town, more far out)
  const ch = new Float32Array(nx * nz), ck = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const cx = (xs[i] + xs[i + 1]) / 2, cz = (zs[j] + zs[j + 1]) / 2;
      const raw = H(cx, cz);
      const o = outside(cx, cz);
      const step = o < 30 ? 0.5 : o < 200 ? 1 : 2;
      const h = raw === -40 ? -40 : raw < 0 ? Math.min(-1, Math.round(raw / 2) * 2) : Math.round(raw / step) * step;
      ch[j * nx + i] = h;
      ck[j * nx + i] = h < 0 ? Kind.Seabed : h < 2.2 && -wet(cx, cz) < 10 ? Kind.Quay : parkAt(cx, cz) ? Kind.Park : h > 120 ? Kind.Scrub : Kind.Town;
    }
  const pos: number[] = [], nor: number[] = [], kin: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], k: number) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (let q = 0; q < 6; q++) { nor.push(...n); kin.push(k); }
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const h = ch[j * nx + i];
      if (h === -40) continue;
      const k = ck[j * nx + i];
      const ax = xs[i], bx = xs[i + 1], az = zs[j], bz = zs[j + 1];
      quad([ax, h, az], [ax, h, bz], [bx, h, bz], [bx, h, az], [0, 1, 0], k);
      // the riser to each lower neighbour (+x and +z here, -x and -z from the neighbour's side)
      const nb = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= nx || jj >= nz ? h : ch[jj * nx + ii] === -40 ? h : ch[jj * nx + ii]);
      const e = nb(i + 1, j), wv = nb(i - 1, j), n = nb(i, j + 1), s = nb(i, j - 1);
      if (e < h) quad([bx, h, az], [bx, h, bz], [bx, e, bz], [bx, e, az], [1, 0, 0], k);
      if (wv < h) quad([ax, h, bz], [ax, h, az], [ax, wv, az], [ax, wv, bz], [-1, 0, 0], k);
      if (n < h) quad([bx, h, bz], [ax, h, bz], [ax, n, bz], [bx, n, bz], [0, 0, 1], k);
      if (s < h) quad([ax, h, az], [bx, h, az], [bx, s, az], [ax, s, az], [0, 0, -1], k);
    }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  gg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  gg.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(kin), 1));
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;

  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2(mx, mz) },
  };
  const SQUASH = /* glsl */ `
    uniform vec3 uCamFwd; uniform vec2 uMid; uniform vec4 uRect;
    // iso view: ground between the camera and the map squats down so it never hides the streets
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
    // the haze over the water: hills across the strait fade blue-grey into the sky
    vec3 haze(vec3 col, vec3 w) {
      vec2 o = max(uRect.xy - w.xz, w.xz - uRect.zw);
      float out_ = max(0.0, max(o.x, o.y));
      float lift = mix(1.0, 0.75, smoothstep(20.0, 300.0, w.y));
      float a = (1.0 - exp(-out_ * 0.0014)) * lift;
      if (uFog.w > 0.0) {
        float fd = max(0.0, distance(w, uFog.xyz) - FOG_START) * uFog.w * 0.22;
        a = max(a, (1.0 - exp(-fd * fd)) * lift);
      }
      return mix(col, uFogColor, min(a, 0.9));
    }`;
  const ground = new THREE.Mesh(gg, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in float aKind;
      ${SQUASH}
      out vec3 vWorld; out vec3 vN; out float vKind;
      void main() {
        float s = squash(position.xz);
        vec3 p = vec3(position.x, position.y > 0.0 ? position.y * s : position.y, position.z);
        vWorld = position; vN = normal; vKind = aKind;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp;
      in vec3 vWorld; in vec3 vN; in float vKind;
      layout(location = 0) out vec4 outColor;
      void main() {
        vec3 n = normalize(vN);
        vec2 p = vWorld.xz;
        float k = vKind;
        // a voxel grain on every face: quarter-metre cells near, coarser far away
        vec2 cellp = n.y > 0.5 ? p : vec2(p.x + p.y, vWorld.y);
        float g = hash12(floor(cellp * 1.0)) * 0.5 + vnoise(cellp * 0.15) * 0.5;
        float lights = 0.0;
        vec3 alb;
        if (k < 0.5) alb = mix(srgb2lin(vec3(0.3, 0.34, 0.32)), srgb2lin(vec3(0.2, 0.26, 0.26)), vnoise(p * 0.05));
        else if (k < 1.5) { alb = mix(srgb2lin(vec3(0.6, 0.58, 0.54)), srgb2lin(vec3(0.5, 0.49, 0.47)), g); lights = 0.6; }
        else if (k < 2.5) {
          // the city between the buildings: setts and roofs and courtyards, a tree here and there
          alb = mix(srgb2lin(vec3(0.55, 0.5, 0.45)), srgb2lin(vec3(0.44, 0.4, 0.37)), g);
          alb = mix(alb, srgb2lin(vec3(0.27, 0.36, 0.2)), step(0.82, hash12(floor(p * 0.35))) * 0.8);
          lights = 1.0;
        } else if (k < 3.5) alb = mix(srgb2lin(vec3(0.2, 0.32, 0.16)), srgb2lin(vec3(0.28, 0.4, 0.2)), g);
        else alb = mix(srgb2lin(vec3(0.34, 0.4, 0.24)), srgb2lin(vec3(0.46, 0.46, 0.36)), g);
        if (n.y < 0.5) alb *= 0.82; // retaining walls of the terraces
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl + hemi);
        if (lights > 0.0 && n.y > 0.5) {
          vec2 c = floor(p * 0.3);
          float on = step(0.86, hash12(c + 3.7)) * lights;
          vec2 f = fract(p * 0.3) - 0.5;
          col += uWindowColor * on * exp(-dot(f, f) * 30.0) * uNight * 0.6;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  ground.frustumCulled = false;
  ground.renderOrder = 10; // after the world, so it only fills what the voxels leave empty

  // ---------------------------------------------------------------------------------------- buildings
  const parts: number[] = [];
  const col = new THREE.Color();
  const push = (b: Box) => parts.push(...b, 0);
  const box = (x: number, z: number, w: number, d: number, y: number, h: number, kind: number, hex: string, seed = 0.5) => {
    col.set(hex);
    push([x, z, w, d, y, h, seed, kind, col.r, col.g, col.b]);
  };
  /** A dome as voxel tiers, each a little narrower and lower than the last. */
  const domeAt = (x: number, z: number, r: number, y: number, kind = 2) => {
    const tiers = Math.max(3, Math.round(r / 1.2));
    for (let t = 0; t < tiers; t++) {
      const a = t / tiers, w = 2 * r * Math.cos(Math.asin(a)), th = r / tiers;
      box(x, z, Math.max(0.6, w), Math.max(0.6, w), y + r * a, th + 0.05, kind, '#8d98a2');
    }
    box(x, z, 0.4, 0.4, y + r, 1.6, 4, '#c9a24a'); // the gilt finial
  };
  const minaret = (x: number, z: number, y: number, h: number, w = 1.1) => {
    box(x, z, w * 1.5, w * 1.5, y, 3, 3, '#d8d2c4');
    box(x, z, w, w, y + 3, h - 3, 4, '#ece6d8');
    for (let t = 0; t < 4; t++) box(x, z, w * (1 - t * 0.22), w * (1 - t * 0.22), y + h + t * 0.9, 0.95, 2, '#8d98a2');
    box(x, z, 0.2, 0.2, y + h + 3.6, 1, 4, '#c9a24a');
  };
  /** A mosque: the prayer hall, its great dome on a drum, half-domes and small domes round it, the minarets at the corners. */
  const mosque = (x: number, z: number, s: number, minarets: number, hall = '#d8d2c4') => {
    const y = H(x, z) - 0.5;
    if (y < 0.5) return;
    box(x, z, 18 * s, 18 * s, y, 9 * s, 3, hall, 0.2);
    box(x, z + 15 * s, 18 * s, 12 * s, y, 5 * s, 3, hall, 0.4); // the courtyard's arcades
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) domeAt(x + dx * s, z + dz * s, 2.6 * s, y + 9 * s);
    for (const [dx, dz] of [[0, -6], [0, 6], [-6, 0], [6, 0]]) domeAt(x + dx * s, z + dz * s, 3.4 * s, y + 9 * s);
    box(x, z, 11 * s, 11 * s, y + 9 * s, 2.2 * s, 3, hall, 0.6); // the drum
    domeAt(x, z, 5.6 * s, y + 11.2 * s);
    const mh = 24 * s + 4;
    const corners = minarets >= 4 ? [[-10, -10], [10, -10], [-10, 21], [10, 21], [-10, 9], [10, 9]] : [[-10, -10], [10, -10]];
    for (const [dx, dz] of corners.slice(0, minarets)) minaret(x + dx * s, z + dz * s, y, mh * (dz > 15 ? 0.85 : 1));
  };

  // the city: blocks of flats and old houses on every patch of dry land, thinning out up the hills
  let seed = 1453;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26000 && parts.length / 12 < 5200; i++) {
    const r = 40 + Math.pow(rnd(), 1.6) * 1500, a = rnd() * Math.PI * 2;
    const x = mx + Math.cos(a) * r * 1.1, z = mz + Math.sin(a) * r;
    const o = outside(x, z);
    if (o < 5) continue;
    const w = 6 + rnd() * 8, dd = 6 + rnd() * 8;
    if (wet(x, z) > -w * 0.6 || parkAt(x, z)) continue;
    const hs4 = [H(x - w / 2, z - dd / 2), H(x + w / 2, z - dd / 2), H(x - w / 2, z + dd / 2), H(x + w / 2, z + dd / 2)];
    const lo = Math.min(...hs4), hi = Math.max(...hs4);
    if (lo < 0.8 || hi - lo > 8 || (hi > 140 && rnd() < 0.7)) continue;
    const tall = (o < 60 ? 6 + rnd() * 9 : 8 + rnd() * 16) * (hi > 60 ? 0.7 : 1);
    const tile = rnd() < 0.35 ? 1 : 0;
    box(x, z, w, dd, lo - 1.5, hi - lo + 1.5 + tall, tile, PASTEL[Math.floor(rnd() * PASTEL.length)], rnd());
  }
  // the landmarks, readable from the quays: Galata's tower on its hill across the Horn
  {
    const x = -25, z = 175, y = H(x, z) - 0.5;
    box(x, z, 9, 9, y, 30, 7, '#a89a86', 0.3);
    box(x, z, 10, 10, y + 30, 1, 7, '#b8ab96', 0.4);
    box(x, z, 9, 9, y + 31, 4, 7, '#a89a86', 0.7); // the gallery
    for (let t = 0; t < 7; t++) box(x, z, 9 - t * 1.25, 9 - t * 1.25, y + 35 + t * 1.3, 1.35, 2, '#6f7f8f');
    box(x, z, 0.3, 0.3, y + 44, 1.5, 4, '#c9a24a');
  }
  // Hagia Sophia's rose walls and great shallow dome, the Blue Mosque's cascade of domes and six minarets
  {
    const x = 35, z = -300, y = H(x, z) - 0.5;
    box(x, z, 34, 32, y, 13, 6, '#c98f6e', 0.3);
    for (const dx of [-11, 11]) box(x + dx, z, 8, 30, y + 13, 6, 6, '#c08466', 0.5); // the buttresses
    box(x, z, 18, 18, y + 13, 2, 6, '#c98f6e', 0.6);
    for (let t = 0; t < 5; t++) box(x, z, 18 - t * 3.4, 18 - t * 3.4, y + 15 + t * 1.2, 1.25, 2, '#8d98a2');
    for (const dz of [-9, 9]) domeAt(x, z + dz, 5, y + 13);
    for (const [dx, dz] of [[-18, -17], [18, -17], [-18, 17], [18, 17]]) minaret(x + dx, z + dz, y, 26, 1.2);
  }
  mosque(-35, -360, 1.6, 6, '#cfcac0');
  // Topkapı on the point: the Tower of Justice and the palace walls in the gardens
  {
    const x = 55, z = -190, y = H(x, z) - 0.5;
    box(x, z, 5, 5, y, 18, 7, '#d6cdbb', 0.2);
    for (let t = 0; t < 5; t++) box(x, z, 4.4 - t * 0.9, 4.4 - t * 0.9, y + 18 + t * 1.3, 1.35, 2, '#6f7f8f');
    for (const [bx, bz, bw, bd] of [[40, -175, 30, 10], [70, -205, 14, 26], [30, -215, 20, 12]]) box(bx, bz, bw, bd, H(bx, bz) - 0.5, 6, 1, '#efe6d4', 0.5);
    for (let k = 0; k < 140; k++) { const tx = 15 + rnd() * 78, tz = -248 + rnd() * 96; if (wet(tx, tz) < -3) box(tx, tz, 3 + rnd() * 3, 3 + rnd() * 3, H(tx, tz) - 0.3, 3 + rnd() * 5, 5, rnd() < 0.5 ? '#3f6a32' : '#2f5a2a', rnd()); }
  }
  // the Maiden's Tower on its rock
  {
    const x = 175, z = -150;
    box(x, z, 13, 10, -3, 4.2, 8, '#8a8580');
    box(x, z, 5, 5, 1.2, 9, 0, '#f2eee6', 0.9);
    box(x, z, 3, 3, 10.2, 3, 0, '#f2eee6', 0.9);
    for (let t = 0; t < 4; t++) box(x, z, 2.6 - t * 0.6, 2.6 - t * 0.6, 13.2 + t, 1, 2, '#6f7f8f');
  }
  // the great mosques along Fatih's ridge above the Horn, and the arches of the Valens aqueduct between the hills
  mosque(-310, -100, 1.5, 4);
  mosque(-470, -40, 1.7, 2);
  mosque(-430, 70, 1.3, 2);
  mosque(-230, 150, 1.0, 2); // Kasımpaşa across the Horn
  for (let k = 0; k <= 22; k++) {
    const x = -380 + k * 7, z = -170 + k * 1.2, g = H(x, z);
    box(x, z, 2.4, 3.4, g - 1, Math.max(4, 18 - (g - 20) * 0.7), 3, '#b9a98e', 0.1);
    box(x + 3.5, z + 0.6, 4.8, 3.4, g + Math.max(4, 18 - (g - 20) * 0.7) - 4, 4, 3, '#b9a98e', 0.1);
  }
  // Üsküdar's mosques on the Asian shore, and the great mosque on Çamlıca's hill
  mosque(470, 60, 1.2, 2);
  mosque(445, -30, 0.6, 1);
  mosque(560, 160, 1.1, 4);
  mosque(820, 380, 2.4, 6);

  const n = parts.length / 12;
  const g = new THREE.InstancedBufferGeometry();
  const unit = new THREE.BoxGeometry(1, 1, 1);
  unit.translate(0, 0.5, 0);
  g.index = unit.index;
  g.setAttribute('position', unit.attributes.position);
  g.setAttribute('normal', unit.attributes.normal);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(parts), 12);
  g.setAttribute('aBox', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  g.setAttribute('aPart', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  g.setAttribute('aCol', new THREE.InterleavedBufferAttribute(ib, 3, 8));
  g.instanceCount = n;
  const houses = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aBox; in vec4 aPart; in vec3 aCol;
      ${SQUASH}
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; out vec3 vSize; out vec4 vPart; out vec3 vCol;
      void main() {
        float y0 = aPart.x, h = aPart.y;
        vLocal = vec3(position.x * aBox.z, position.y * h, position.z * aBox.w);
        vec3 p = vec3(aBox.x + vLocal.x, y0 + vLocal.y, aBox.y + vLocal.z);
        vWorld = p; vN = normal; vSize = vec3(aBox.z, h, aBox.w); vPart = aPart; vCol = aCol;
        float s = squash(aBox.xy);
        if (s < 0.6) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        p.y *= s;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp;
      in vec3 vWorld; in vec3 vN; in vec3 vLocal; in vec3 vSize; in vec4 vPart; in vec3 vCol;
      layout(location = 0) out vec4 outColor;
      void main() {
        vec3 n = vN;
        float seed = vPart.z, kind = vPart.w;
        vec3 alb = srgb2lin(vCol);
        float fw = fwidth(vWorld.x + vWorld.z);
        float fine = 1.0 - smoothstep(0.25, 0.8, fw);
        bool wall = abs(n.y) < 0.5;
        float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
        float y = vLocal.y;
        float win = 0.0;
        vec2 cell = vec2(0.0);
        bool lead = kind > 1.5 && kind < 2.5, tree = kind > 4.5 && kind < 5.5, rock = kind > 7.5;
        // a quarter-metre grain, the voxels of the town carried out to the horizon
        alb *= 0.94 + 0.12 * hash12(floor(vec2(u * 4.0 + n.z * 13.0, y * 4.0)) + seed * 17.0);
        if (wall && !lead && !tree && !rock) {
          if (kind < 1.5 || kind > 5.5) {
            // flats and houses: a window every two metres, a floor every three; shutters on the old houses
            cell = vec2(floor((u + 40.0) / 2.0), floor(y / 3.0));
            vec2 f = vec2(fract((u + 40.0) / 2.0), fract(y / 3.0));
            win = step(0.3, f.x) * step(f.x, 0.7) * step(0.28, f.y) * step(f.y, 0.78) * step(2.0, y) * step(y, vSize.y - 1.2);
            alb = mix(alb, srgb2lin(vec3(0.16, 0.18, 0.2)), win * fine * 0.9);
          } else if (kind < 3.5) {
            // mosque walls: two rows of arched windows
            cell = vec2(floor((u + 40.0) / 2.4), floor(y / 3.4));
            vec2 f = vec2(fract((u + 40.0) / 2.4), fract(y / 3.4));
            win = step(0.35, f.x) * step(f.x, 0.65) * step(0.3, f.y) * step(f.y, 0.85 - abs(f.x - 0.5) * 0.4) * step(y, vSize.y - 1.0);
            alb = mix(alb, srgb2lin(vec3(0.12, 0.13, 0.15)), win * fine * 0.8);
          } else {
            // a minaret: the balconies are dark bands
            float band = step(0.72, fract(y / max(1.0, vSize.y) * 2.0)) * step(fract(y / max(1.0, vSize.y) * 2.0), 0.76);
            alb = mix(alb, srgb2lin(vec3(0.5, 0.48, 0.44)), band);
          }
        } else if (n.y > 0.5 && kind < 0.5) {
          alb = mix(alb * 0.86, srgb2lin(vec3(0.7, 0.7, 0.72)), step(0.82, hash12(floor(vLocal.xz * 0.6) + seed * 5.0))); // tanks and dishes
        } else if (n.y > 0.5 && kind < 1.5) {
          alb = srgb2lin(vec3(0.66, 0.3, 0.2)) * (0.85 + 0.15 * step(0.5, fract(vLocal.x * 2.0)));
        }
        if (tree) alb *= 0.8 + 0.4 * hash12(floor(vLocal.xz * 2.0 + vLocal.y * 2.0) + seed);
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * 0.9 + hemi);
        vec2 fa, fe;
        if (abs(n.x) > 0.5) { fa = vec2(vLocal.z + vSize.z * 0.5, vLocal.y); fe = vSize.zy; }
        else if (abs(n.z) > 0.5) { fa = vec2(vLocal.x + vSize.x * 0.5, vLocal.y); fe = vSize.xy; }
        else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float d = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.15 + fw * 0.7, d)) * 0.18;
        if (win > 0.0 && (kind < 1.5 || kind > 5.5)) {
          float on = step(hash12(cell * vec2(1.7, 3.1) + seed * 91.0 + n.xz * 7.0), 0.16 + 0.24 * uNight);
          col += win * on * uWindowColor * uNight * 0.5;
        }
        // the mosques are floodlit at night, warm on the stone and the lead
        if (kind > 1.5 && kind < 4.5 || kind > 5.5 && kind < 7.5) col += alb * uWindowColor * uNight * 0.35;
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  houses.frustumCulled = false;
  houses.renderOrder = 10;

  // ferries crossing the Bosphorus to Asia and back all day: a handful of boxes each, moved by one uniform
  const hm = houses.material as THREE.ShaderMaterial;
  const ferryVert = hm.vertexShader
    .replace('in vec4 aBox;', 'uniform vec2 uOff; in vec4 aBox;')
    .replace('vec3 p = vec3(aBox.x + vLocal.x, y0 + vLocal.y, aBox.y + vLocal.z);', 'vec3 p = vec3(aBox.x + uOff.x + vLocal.x, y0 + vLocal.y, aBox.y + uOff.y + vLocal.z);')
    .replace('squash(aBox.xy)', 'squash(aBox.xy + uOff)');
  const fp: number[] = [];
  const fbox = (x: number, z: number, w: number, d: number, y: number, h: number, kind: number, hex: string) => { col.set(hex); fp.push(x, z, w, d, y, h, 0.5, kind, col.r, col.g, col.b, 0); };
  // a Şehir Hatları vapur, 34 m: black hull, white bulwark and saloons, a yellow funnel with a black top, a wheelhouse at each end
  fbox(0, 0, 30, 8.4, -1.2, 2.4, 8, '#26282e');
  for (const e of [-1, 1]) { fbox(e * 16, 0, 3, 6.2, -1.2, 2.4, 8, '#26282e'); fbox(e * 17.6, 0, 1.4, 3.4, -1.0, 2.2, 8, '#26282e'); }
  fbox(0, 0, 33, 8.6, 1.2, 0.8, 8, '#f0ede6');
  fbox(0, 0, 27, 7.4, 2.0, 4.6, 6, '#f2efe8');
  fbox(0, 0, 21, 6.6, 6.6, 0.4, 8, '#d6d2ca');
  for (const e of [-1, 1]) fbox(e * 9.5, 0, 3, 5, 7.0, 2.0, 6, '#f2efe8');
  fbox(0, 0, 2.6, 2.2, 7.0, 3.6, 8, '#e9b830');
  fbox(0, 0, 2.7, 2.3, 10.6, 0.8, 8, '#1e1e20');
  const fg = new THREE.InstancedBufferGeometry();
  fg.index = unit.index;
  fg.setAttribute('position', unit.attributes.position);
  fg.setAttribute('normal', unit.attributes.normal);
  const fib = new THREE.InstancedInterleavedBuffer(new Float32Array(fp), 12);
  fg.setAttribute('aBox', new THREE.InterleavedBufferAttribute(fib, 4, 0));
  fg.setAttribute('aPart', new THREE.InterleavedBufferAttribute(fib, 4, 4));
  fg.setAttribute('aCol', new THREE.InterleavedBufferAttribute(fib, 3, 8));
  fg.instanceCount = fp.length / 12;
  const ferries = new THREE.Group();
  // two lines, each its own lane across the strait; they turn round just off the European piers and dwell at the Asian ones
  const routes = [{ z: -26, x0: 108, x1: eastShore(-26) - 24, t: 0 }, { z: -84, x0: 108, x1: eastShore(-84) - 24, t: 70 }];
  const boats = routes.map((r) => {
    const off = { value: new THREE.Vector2(r.x0, r.z) };
    const m = new THREE.Mesh(fg, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, uniforms: { ...u, uOff: off }, vertexShader: ferryVert, fragmentShader: hm.fragmentShader }));
    m.frustumCulled = false;
    m.renderOrder = 10;
    ferries.add(m);
    return { r, off };
  });
  const DWELL_EU = 6, DWELL_AS = 30, CROSS = 75;
  const cycle = 2 * CROSS + DWELL_EU + DWELL_AS;
  const update = (dt: number) => {
    for (const b of boats) {
      b.r.t = (b.r.t + dt) % cycle;
      let t = b.r.t, k: number;
      if (t < DWELL_EU) k = 0;
      else if ((t -= DWELL_EU) < CROSS) k = smooth(0, 1, t / CROSS);
      else if ((t -= CROSS) < DWELL_AS) k = 1;
      else k = 1 - smooth(0, 1, (t - DWELL_AS) / CROSS);
      b.off.value.set(b.r.x0 + (b.r.x1 - b.r.x0) * k, b.r.z);
    }
  };

  // the sea floor everywhere the ground mesh doesn't reach, deep enough that the water reads as open sea
  const R = 6000;
  const sea = new THREE.BufferGeometry();
  sea.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    -R, -32, -R, -R, -32, R, R, -32, R, -R, -32, -R, R, -32, R, R, -32, -R,
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
  return { ground, houses, ferries, update };
}
