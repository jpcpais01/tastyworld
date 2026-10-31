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
 * windows, roofs and lead the shader paints. The shores you look at across the water (Galata and Beyoğlu, Üsküdar) are
 * laid out in rows along the contours, every house with its front to the water, cornices, balconies, bay windows and
 * awnings on the near rows; those small parts carry a distance past which the vertex shader drops them. Like Tokyo's
 * far city, anything between the iso camera and the map squats down so it never hides the streets.
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
const westShore = (z: number) => (z > HORN_N ? 30 + (z - HORN_N) * 0.9 : z < -112 ? 30 + (-112 - z) * 0.28 + 30 * smooth(-112, -260, z) : 30);
/** The Asian shore across the strait, opening out into the Sea of Marmara to the south. */
const eastShore = (z: number) => 430 + 40 * Math.sin(z * 0.004) + Math.max(0, -380 - z) * 1.6;
/** Where the Golden Horn's far bank meets the Bosphorus: Karaköy, 190 m across the water from Eminönü. */
const HORN_N = 234;
/** The Golden Horn's far bank: Karaköy, then Kasımpaşa as the Horn narrows and bends north-west. */
const hornNorth = (x: number) => HORN_N - Math.max(0, -100 - x) * 0.12 + Math.max(0, -420 - x) * 0.45;

/** Metres of water (positive) or land (negative) at a spot, roughly: positive inside the water. */
function wet(x: number, z: number): number {
  const horn = x < 34 ? Math.min(z - 44, hornNorth(x) - z) : -1e3;
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
    dome(x, z, 30, -200, 22, 60), dome(x, z, -30, 330, 34, 110), dome(x, z, -160, 330, 52, 190), dome(x, z, 120, 340, 40, 160),
    dome(x, z, 560, 110, 44, 160), dome(x, z, 820, 380, 150, 220), dome(x, z, 600, -260, 30, 160),
  );
  const h = 1.2 + hills * smooth(3, 90, d) + (fbm(x * 0.012, z * 0.012) - 0.5) * 6 * smooth(10, 80, d);
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

/** What the shader paints on a box. */
const P = {
  Flats: 0, Tile: 1, Lead: 2, Hall: 3, Minaret: 4, Tree: 5, Civic: 6, Lit: 7, Rock: 8,
  /** a striped shop awning */ Awning: 9,
  /** a stack of balconies, one slab and railing per floor, open between */ Balcony: 10,
  /** an Ottoman bay window (cumba), glazed all round */ Bay: 11,
  /** a lantern, lit at night */ Lamp: 12,
  /** stone with narrow arched slits, floodlit at night (Galata's tower) */ Tower: 14,
} as const;
/** Positive modulo, for patterns on coordinates that run negative. */
const pm = (v: number, n: number) => ((v % n) + n) % n;
/**
 * A Şehir Hatları vapur, 34 m along x: black hull, white bulwark and saloons, a yellow funnel with a black top, a
 * wheelhouse at each end. Each part is [x, z, w, d, y, h, kind, colour].
 */
const FERRY: [number, number, number, number, number, number, number, string][] = [
  [0, 0, 30, 8.4, -1.2, 2.4, P.Rock, '#26282e'],
  ...[-1, 1].flatMap((e): [number, number, number, number, number, number, number, string][] => [[e * 16, 0, 3, 6.2, -1.2, 2.4, P.Rock, '#26282e'], [e * 17.6, 0, 1.4, 3.4, -1.0, 2.2, P.Rock, '#26282e']]),
  [0, 0, 33, 8.6, 1.2, 0.8, P.Rock, '#f0ede6'],
  [0, 0, 27, 7.4, 2.0, 4.6, P.Civic, '#f2efe8'],
  [0, 0, 21, 6.6, 6.6, 0.4, P.Rock, '#d6d2ca'],
  ...[-1, 1].map((e): [number, number, number, number, number, number, number, string] => [e * 9.5, 0, 3, 5, 7.0, 2.0, P.Civic, '#f2efe8']),
  [0, 0, 2.6, 2.2, 7.0, 3.6, P.Rock, '#e9b830'],
  [0, 0, 2.7, 2.3, 10.6, 0.8, P.Rock, '#1e1e20'],
];

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
  const pos: number[] = [], nor: number[] = [], kin: number[] = [], cel: number[] = [];
  const mid = (i: number, j: number) => [(xs[i] + xs[i + 1]) / 2, (zs[j] + zs[j + 1]) / 2];
  /**
   * One face of a terrace. `own` is the middle of its cell, `nb` the middle of the cell whose top a riser's foot (c and
   * d) stands on. In the iso view each cell squats by the amount for its own middle, so tops stay flat and level and
   * every riser runs from one top to the other: the ground stays boxes, never a smooth slope.
   */
  const quad = (a: number[], b: number[], c: number[], d: number[], n: number[], k: number, own: number[], nb = own) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    cel.push(...own, ...own, ...nb, ...own, ...nb, ...nb);
    for (let q = 0; q < 6; q++) { nor.push(...n); kin.push(k); }
  };
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const h = ch[j * nx + i];
      if (h === -40) continue;
      const k = ck[j * nx + i];
      const ax = xs[i], bx = xs[i + 1], az = zs[j], bz = zs[j + 1];
      const own = mid(i, j);
      quad([ax, h, az], [ax, h, bz], [bx, h, bz], [bx, h, az], [0, 1, 0], k, own);
      // the riser to each lower neighbour (+x and +z here, -x and -z from the neighbour's side); a level neighbour
      // gets one too, from its -x or -z side, flat until the two squat apart
      const nb = (ii: number, jj: number) => (ii < 0 || jj < 0 || ii >= nx || jj >= nz ? null : ch[jj * nx + ii] === -40 ? null : ch[jj * nx + ii]);
      const e = nb(i + 1, j), wv = nb(i - 1, j), n = nb(i, j + 1), s = nb(i, j - 1);
      const lvl = h > 0;
      if (e !== null && (e < h || (lvl && e === h))) quad([bx, h, az], [bx, h, bz], [bx, e, bz], [bx, e, az], [1, 0, 0], k, own, mid(i + 1, j));
      if (wv !== null && wv < h) quad([ax, h, bz], [ax, h, az], [ax, wv, az], [ax, wv, bz], [-1, 0, 0], k, own, mid(i - 1, j));
      if (n !== null && (n < h || (lvl && n === h))) quad([bx, h, bz], [ax, h, bz], [ax, n, bz], [bx, n, bz], [0, 0, 1], k, own, mid(i, j + 1));
      if (s !== null && s < h) quad([ax, h, az], [bx, h, az], [bx, s, az], [ax, s, az], [0, 0, -1], k, own, mid(i, j - 1));
    }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  gg.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nor), 3));
  gg.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(kin), 1));
  gg.setAttribute('aCell', new THREE.BufferAttribute(new Float32Array(cel), 2));
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
      in float aKind; in vec2 aCell;
      ${SQUASH}
      out vec3 vWorld; out vec3 vN; out float vKind;
      void main() {
        // squat by the amount for the middle of the cell this height belongs to: tops stay level
        float s = squash(aCell);
        vec3 p = vec3(position.x, position.y > 0.0 ? position.y * s : position.y, position.z);
        vWorld = position; vN = normal; vKind = aKind;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp; uniform vec3 uCamFwd;
      in vec3 vWorld; in vec3 vN; in float vKind;
      layout(location = 0) out vec4 outColor;
      void main() {
        vec3 n = normalize(vN);
        // a riser whose lower neighbour squatted less than its own cell now faces the other way
        if (n.y < 0.5 && dot(n, uCamFwd) > 0.0) n = -n;
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
          alb = mix(alb, srgb2lin(vec3(0.27, 0.36, 0.2)), step(0.74, hash12(floor(p * 0.35))) * 0.8);
          lights = 1.0;
        } else if (k < 3.5) alb = mix(srgb2lin(vec3(0.2, 0.32, 0.16)), srgb2lin(vec3(0.28, 0.4, 0.2)), g);
        else alb = mix(srgb2lin(vec3(0.34, 0.4, 0.24)), srgb2lin(vec3(0.46, 0.46, 0.36)), g);
        if (n.y < 0.5) {
          if (k > 1.5) {
            // the terraces' retaining walls: stone in courses, ivy and fig spilling down them, green on the park slopes
            float course = step(0.86, fract(vWorld.y * 1.6));
            vec3 stone = mix(srgb2lin(vec3(0.63, 0.58, 0.5)), srgb2lin(vec3(0.52, 0.48, 0.42)), g) * (1.0 - course * 0.16);
            float ivy = smoothstep(0.42, 0.62, vnoise(vec2(p.x + p.y, vWorld.y * 1.5) * 0.22) * 0.75 + g * 0.25 + (k > 2.5 ? 0.35 : 0.0));
            alb = mix(stone, mix(srgb2lin(vec3(0.19, 0.3, 0.14)), srgb2lin(vec3(0.27, 0.38, 0.18)), g), ivy);
          } else alb *= 0.82;
        }
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
  // the terrace you'd actually stand on at a spot (the ground mesh's own flat cells), so houses sit on it exactly
  const cellOf = (arr: number[], v: number) => {
    let lo = 0, hi = arr.length - 2;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (arr[m] <= v) lo = m; else hi = m - 1; }
    return lo;
  };
  const T = (x: number, z: number) => ch[cellOf(zs, z) * nx + cellOf(xs, x)];
  // which 2 m cells are built on, so houses stand shoulder to shoulder without running into one another
  const OCC = 2, ON = 1800;
  const occ = new Uint8Array(ON * ON);
  const cells = (x: number, z: number, w: number, d: number, shrink: number, f: (i: number) => boolean) => {
    const sx = Math.max(0, w / 2 - shrink), sz = Math.max(0, d / 2 - shrink);
    const i0 = Math.floor((x - sx) / OCC) + ON / 2, i1 = Math.floor((x + sx) / OCC) + ON / 2;
    const j0 = Math.floor((z - sz) / OCC) + ON / 2, j1 = Math.floor((z + sz) / OCC) + ON / 2;
    for (let j = Math.max(0, j0); j <= Math.min(ON - 1, j1); j++)
      for (let i = Math.max(0, i0); i <= Math.min(ON - 1, i1); i++) if (!f(j * ON + i)) return false;
    return true;
  };
  const free = (x: number, z: number, w: number, d: number) => cells(x, z, w, d, OCC, (c) => occ[c] === 0);
  const claim = (x: number, z: number, w: number, d: number) => { cells(x, z, w, d, 0, (c) => ((occ[c] = 1), true)); };

  const parts: number[] = [];
  const col = new THREE.Color();
  /**
   * One box: centre x, z, size w (along x) and d (along z), foot y, height h, the shader's kind (P), a colour, a seed;
   * lod > 0 drops it past that many metres from the camera, for the small things only the near shore needs.
   */
  const box = (x: number, z: number, w: number, d: number, y: number, h: number, kind: number, hex: string, seed = 0.5, lod = 0) => {
    col.set(hex);
    parts.push(x, z, w, d, y, h, seed, kind, col.r, col.g, col.b, lod);
  };
  /** A round tower's section as three crossed boxes, which reads as round from any side. */
  const round = (x: number, z: number, r: number, y: number, h: number, kind: number, hex: string, seed = 0.5, lod = 0) => {
    box(x, z, 2 * r, 1.2 * r, y, h, kind, hex, seed, lod);
    box(x, z, 1.2 * r, 2 * r, y, h, kind, hex, seed, lod);
    box(x, z, 1.72 * r, 1.72 * r, y, h, kind, hex, seed, lod);
  };
  /**
   * A house: the walls, and on the tiled ones a low hipped roof in the town's own way, courses stepping in under the
   * eaves (a few shrinking boxes), so the far roofs read like the voxel roofs of the streets you walk.
   */
  const house = (x: number, z: number, w: number, d: number, y: number, h: number, tile: number, hex: string, seed: number) => {
    box(x, z, w, d, y, h, tile, hex, seed);
    if (tile !== P.Tile) return;
    const roof = seed < 0.5 ? '#a8563a' : '#8f4530';
    for (let t = 0; t < 4; t++) {
      const ww = w + 0.6 - t * 1.4, dd2 = d + 0.6 - t * 1.4;
      if (ww < 1 || dd2 < 1) break;
      box(x, z, ww, dd2, y + h + t * 0.5, 0.5, P.Tile, roof, seed, t < 2 ? 0 : t === 2 ? 1100 : 800);
    }
  };
  /** A dome as voxel tiers, each a little narrower and lower than the last. */
  const domeAt = (x: number, z: number, r: number, y: number, kind: number = P.Lead) => {
    const tiers = Math.max(3, Math.round(r / 1.2));
    for (let t = 0; t < tiers; t++) {
      const a = t / tiers, w = 2 * r * Math.cos(Math.asin(a)), th = r / tiers;
      box(x, z, Math.max(0.6, w), Math.max(0.6, w), y + r * a, th + 0.05, kind, '#8d98a2');
    }
    box(x, z, 0.4, 0.4, y + r, 1.6, P.Minaret, '#c9a24a'); // the gilt finial
  };
  const minaret = (x: number, z: number, y: number, h: number, w = 1.1) => {
    box(x, z, w * 1.5, w * 1.5, y, 3, P.Hall, '#d8d2c4');
    box(x, z, w, w, y + 3, h - 3, P.Minaret, '#ece6d8');
    for (let t = 0; t < 4; t++) box(x, z, w * (1 - t * 0.22), w * (1 - t * 0.22), y + h + t * 0.9, 0.95, P.Lead, '#8d98a2');
    box(x, z, 0.2, 0.2, y + h + 3.6, 1, P.Minaret, '#c9a24a');
  };
  /** A mosque: the prayer hall, its great dome on a drum, half-domes and small domes round it, the minarets at the corners. */
  const mosque = (x: number, z: number, s: number, minarets: number, hall = '#d8d2c4') => {
    const y = H(x, z) - 0.5;
    if (y < 0.5) return;
    claim(x, z + 5.5 * s, 24 * s, 36 * s);
    box(x, z, 18 * s, 18 * s, y, 9 * s, P.Hall, hall, 0.2);
    box(x, z + 15 * s, 18 * s, 12 * s, y, 5 * s, P.Hall, hall, 0.4); // the courtyard's arcades
    for (const [dx, dz] of [[-6, -6], [6, -6], [-6, 6], [6, 6]]) domeAt(x + dx * s, z + dz * s, 2.6 * s, y + 9 * s);
    for (const [dx, dz] of [[0, -6], [0, 6], [-6, 0], [6, 0]]) domeAt(x + dx * s, z + dz * s, 3.4 * s, y + 9 * s);
    box(x, z, 11 * s, 11 * s, y + 9 * s, 2.2 * s, P.Hall, hall, 0.6); // the drum
    domeAt(x, z, 5.6 * s, y + 11.2 * s);
    const mh = 24 * s + 4;
    const corners = minarets >= 4 ? [[-10, -10], [10, -10], [-10, 21], [10, 21], [-10, 9], [10, 9]] : [[-10, -10], [10, -10]];
    for (const [dx, dz] of corners.slice(0, minarets)) minaret(x + dx * s, z + dz * s, y, mh * (dz > 15 ? 0.85 : 1));
  };
  let seed = 1453;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rnd() * a.length)];
  /** A tree on the hillside: a dark cypress, or a plane or fig with its trunk under a round crown. */
  const tree = (x: number, z: number, y: number, s = 1, lod = 0) => {
    if (rnd() < 0.42) {
      const hh = (6 + rnd() * 5) * s;
      box(x, z, 1.8 * s, 1.8 * s, y - 0.3, hh * 0.62, P.Tree, '#3f6236', rnd(), lod);
      box(x, z, 1.1 * s, 1.1 * s, y - 0.3 + hh * 0.62, hh * 0.38, P.Tree, '#46693b', rnd(), lod || 900);
    } else {
      const cw = (3.4 + rnd() * 2.6) * s;
      box(x, z, 0.6, 0.6, y - 0.3, 2.4 * s, P.Rock, '#6e5a44', 0.5, lod || 600);
      box(x, z, cw, cw, y + 1.8 * s, (2.6 + rnd() * 1.6) * s, P.Tree, pick(['#5b8a45', '#6a9650', '#4f7f3e', '#7a9c52']), rnd(), lod);
    }
  };
  /** A quay lamp: an iron post and a lantern that glows at night. */
  const lamp = (x: number, z: number, y: number) => {
    box(x, z, 0.22, 0.22, y - 0.2, 4.2, P.Rock, '#2e3033', 0.5, 700);
    box(x, z, 0.7, 0.7, y + 4.0, 0.7, P.Lamp, '#f3e7c8', 0.5, 900);
  };

  // ------------------------------------------------------------------- the landmarks first, so the houses keep clear of them
  // Galata's tower on its hill across the Horn: a round stone shaft with string courses, the cantilevered gallery and its
  // arcade, the cornice, and the tall conical cap in lead with its gilt finial; a little square round its foot
  {
    const x = -25, z = 300, y = H(x, z) - 0.6;
    claim(x, z, 22, 22);
    box(x, z, 20, 20, y - 0.2, 0.7, P.Rock, '#b8ae9c', 0.5, 900); // the square's paving
    round(x, z, 5.6, y, 3.2, P.Tower, '#9d8f7b', 0.2);
    round(x, z, 5.1, y + 3.2, 30, P.Tower, '#a89a86', 0.4);
    for (const k of [11, 21]) round(x, z, 5.35, y + 3.2 + k, 0.45, P.Rock, '#b9ac97', 0.5, 1200);
    round(x, z, 6.1, y + 33.2, 0.55, P.Rock, '#b9ac97', 0.5); // the gallery's floor
    round(x, z, 6.0, y + 33.75, 0.9, P.Balcony, '#2b2c2e', 0.2, 1200); // and its railing
    round(x, z, 4.9, y + 33.2, 5.4, P.Hall, '#b3a68f', 0.7); // the arcade of the top storey
    round(x, z, 5.4, y + 38.6, 0.7, P.Rock, '#c0b39e', 0.5); // the cornice
    for (let t = 0; t < 10; t++) {
      const r = 5.0 * (1 - t / 10.5);
      round(x, z, Math.max(0.35, r), y + 39.3 + t * 1.45, 1.5, P.Lead, '#5d6974', 0.5);
    }
    box(x, z, 0.3, 0.3, y + 53.8, 2.2, P.Minaret, '#c9a24a');
  }
  // the Galata Bridge carries on across the Horn to Karaköy: the deck on its piers, lamps along both rails
  box(-18, (64 + HORN_N) / 2 + 2, 9, HORN_N - 60, 0.5, 1.0, P.Rock, '#8c9096');
  for (let z = 70; z < HORN_N; z += 12) box(-18, z, 6, 2.5, -4, 4.5, P.Rock, '#9a958c');
  for (let z = 68; z < HORN_N + 2; z += 8) for (const x of [-22.2, -13.8]) { box(x, z, 0.25, 0.25, 1.5, 3.8, P.Rock, '#3c3d40', 0.5, 900); box(x, z, 0.55, 0.55, 5.2, 0.5, P.Lamp, '#f3e7c8', 0.5, 1000); }
  claim(-18, HORN_N + 8, 14, 18); // where the bridge lands in Karaköy
  // the ferry piers along the Horn: Karaköy's by the bridge, Kasımpaşa's and Hasköy's up the water. Each is a stone deck on
  // the water, the pier hall with its hipped roof and clock turret, a pontoon, and at Karaköy a vapur tied up alongside
  const pier = (x: number, side: 'n' | 'e', zz: number, big: boolean) => {
    const L = big ? 26 : 16, D = big ? 11 : 8, hw = big ? 17 : 11, hd = big ? 7.5 : 6;
    // n: the deck runs along x on the Horn's north bank, its front to the south; e: along z on the Asian shore, front west
    const [cx, cz, w, d] = side === 'n' ? [x, zz - D / 2 + 1, L, D] : [zz - D / 2 + 1, x, D, L];
    box(cx, cz, w, d, -2.0, 3.3, P.Rock, '#9b958a', 0.5);
    claim(cx, cz, w + 4, d + 6);
    const [hx, hz, hW, hD] = side === 'n' ? [x, zz - D / 2 + 1 + (D - hd) / 2 - 0.5, hw, hd] : [zz - D / 2 + 1 + (D - hd) / 2 - 0.5, x, hd, hw];
    house(hx, hz, hW, hD, 1.3, big ? 6 : 4.5, P.Tile, '#ece4d2', 0.7);
    box(hx, hz, 2.6, 2.6, 1.3 + (big ? 6 : 4.5) + 1.6, 3.2, P.Civic, '#ece4d2', 0.3); // the clock turret
    for (let t = 0; t < 3; t++) box(hx, hz, 2.4 - t * 0.7, 2.4 - t * 0.7, 1.3 + (big ? 6 : 4.5) + 4.8 + t * 0.6, 0.6, P.Lead, '#5d6974');
    const [px, pz, pw, pd] = side === 'n' ? [x, zz - D - 2.2, L - 4, 3.4] : [zz - D - 2.2, x, 3.4, L - 4];
    box(px, pz, pw, pd, -0.95, 0.75, P.Rock, '#6d6a66', 0.5, 1200); // the pontoon
    const [l1x, l1z] = side === 'n' ? [x - L / 2 + 1, zz - D + 1.5] : [zz - D + 1.5, x - L / 2 + 1];
    const [l2x, l2z] = side === 'n' ? [x + L / 2 - 1, zz - D + 1.5] : [zz - D + 1.5, x + L / 2 - 1];
    lamp(l1x, l1z, 1.3); lamp(l2x, l2z, 1.3);
  };
  pier(8, 'n', HORN_N, true);
  for (const b of FERRY) box(10 + b[0], HORN_N - 18.6 + b[1], b[2], b[3], b[4], b[5], b[6], b[7], 0.5, 1400);
  pier(-150, 'n', hornNorth(-150), false);
  pier(-290, 'n', hornNorth(-290), false);
  // Galataport along the Bosphorus at Tophane: the long low terminal stepping along the quay, gardens on its roofs
  for (let z = 252; z < 340; z += 13) {
    const x = westShore(z) - 10, y = Math.max(1.2, T(x, z));
    claim(x, z, 14, 13);
    box(x, z, 12, 12, y - 0.5, 5.6, P.Civic, '#dcd8ce', 0.15);
    box(x, z, 9, 9, y + 5.1, 0.6, P.Tree, '#4a7438', 0.4, 1200);
  }
  mosque(-110, 256, 0.7, 1); // Azapkapı, by the Horn
  mosque(36, 262, 0.72, 1, '#dcd6c8'); // Kılıç Ali Paşa at Tophane
  mosque(68, 302, 0.6, 2, '#e2dccf'); // Nusretiye, its minarets slender as pencils
  mosque(-230, 290, 1.0, 2); // Kasımpaşa across the Horn
  // the Arab mosque's square minaret, once a church's belfry, among Karaköy's roofs
  {
    const x = -62, z = 268, y = H(x, z) - 0.5;
    claim(x, z, 8, 8);
    box(x, z, 4.4, 4.4, y, 20, P.Civic, '#c7b9a2', 0.2);
    box(x, z, 5.0, 5.0, y + 20, 0.6, P.Rock, '#b7a990');
    for (let t = 0; t < 4; t++) box(x, z, 4.2 - t * 1.0, 4.2 - t * 1.0, y + 20.6 + t * 1.1, 1.15, P.Lead, '#6f7f8f');
  }
  // Hagia Sophia's rose walls and great shallow dome, the Blue Mosque's cascade of domes and six minarets
  {
    const x = 35, z = -300, y = H(x, z) - 0.5;
    claim(x, z, 44, 42);
    box(x, z, 34, 32, y, 13, P.Civic, '#c98f6e', 0.3);
    for (const dx of [-11, 11]) box(x + dx, z, 8, 30, y + 13, 6, P.Civic, '#c08466', 0.5); // the buttresses
    box(x, z, 18, 18, y + 13, 2, P.Civic, '#c98f6e', 0.6);
    for (let t = 0; t < 5; t++) box(x, z, 18 - t * 3.4, 18 - t * 3.4, y + 15 + t * 1.2, 1.25, P.Lead, '#8d98a2');
    for (const dz of [-9, 9]) domeAt(x, z + dz, 5, y + 13);
    for (const [dx, dz] of [[-18, -17], [18, -17], [-18, 17], [18, 17]]) minaret(x + dx, z + dz, y, 26, 1.2);
  }
  mosque(-35, -360, 1.6, 6, '#cfcac0');
  // Topkapı on the point: the Tower of Justice and the palace walls in the gardens
  {
    const x = 55, z = -190, y = H(x, z) - 0.5;
    box(x, z, 5, 5, y, 18, P.Lit, '#d6cdbb', 0.2);
    for (let t = 0; t < 5; t++) box(x, z, 4.4 - t * 0.9, 4.4 - t * 0.9, y + 18 + t * 1.3, 1.35, P.Lead, '#6f7f8f');
    for (const [bx, bz, bw, bd] of [[40, -175, 30, 10], [70, -205, 14, 26], [30, -215, 20, 12]]) box(bx, bz, bw, bd, H(bx, bz) - 0.5, 6, P.Tile, '#efe6d4', 0.5);
    for (let k = 0; k < 140; k++) { const tx = 15 + rnd() * 78, tz = -248 + rnd() * 96; if (wet(tx, tz) < -3) box(tx, tz, 3 + rnd() * 3, 3 + rnd() * 3, H(tx, tz) - 0.3, 3 + rnd() * 5, P.Tree, rnd() < 0.5 ? '#3f6a32' : '#2f5a2a', rnd()); }
  }
  // the Maiden's Tower on its rock
  {
    const x = 175, z = -150;
    box(x, z, 13, 10, -3, 4.2, P.Rock, '#8a8580');
    box(x, z, 5, 5, 1.2, 9, P.Flats, '#f2eee6', 0.9);
    box(x, z, 3, 3, 10.2, 3, P.Flats, '#f2eee6', 0.9);
    for (let t = 0; t < 4; t++) box(x, z, 2.6 - t * 0.6, 2.6 - t * 0.6, 13.2 + t, 1, P.Lead, '#6f7f8f');
  }
  // the great mosques along Fatih's ridge above the Horn, and the arches of the Valens aqueduct between the hills
  mosque(-310, -100, 1.5, 4);
  mosque(-470, -40, 1.7, 2);
  mosque(-430, 70, 1.3, 2);
  for (let k = 0; k <= 22; k++) {
    const x = -380 + k * 7, z = -170 + k * 1.2, g = H(x, z);
    claim(x + 1.7, z, 8, 4);
    box(x, z, 2.4, 3.4, g - 1, Math.max(4, 18 - (g - 20) * 0.7), P.Hall, '#b9a98e', 0.1);
    box(x + 3.5, z + 0.6, 4.8, 3.4, g + Math.max(4, 18 - (g - 20) * 0.7) - 4, 4, P.Hall, '#b9a98e', 0.1);
  }
  // Üsküdar's mosques on the Asian shore, and the great mosque on Çamlıca's hill
  mosque(470, 60, 1.2, 2);
  mosque(445, -30, 0.6, 1);
  mosque(560, 160, 1.1, 4);
  mosque(820, 380, 2.4, 6);
  // the Asian piers where the ferries tie up, each beside its lane across the strait
  for (const zz of [-26, -84]) pier(zz + 9, 'e', eastShore(zz + 9), true);
  // Haydarpaşa station on its point: the long stone block, its two round corner towers under pointed lead caps
  {
    const x = eastShore(-330) + 16, z = -330, y = Math.max(1.2, H(x, z)) - 0.5;
    claim(x, z, 22, 50);
    box(x, z, 16, 40, y, 15, P.Civic, '#cdb08a', 0.25);
    box(x, z, 17, 41, y + 15, 0.7, P.Rock, '#bfa27e');
    box(x, z, 12, 34, y + 15.7, 3, P.Lead, '#5d6974');
    for (const dz of [-20, 20]) {
      round(x - 6, z + dz, 3.4, y, 21, P.Civic, '#cdb08a', 0.6);
      for (let t = 0; t < 6; t++) round(x - 6, z + dz, Math.max(0.3, 3.3 * (1 - t / 6)), y + 21 + t * 1.3, 1.35, P.Lead, '#5d6974');
    }
  }
  // the Selimiye barracks above Harem: four long wings round a parade ground, a tower with a pyramid roof at each corner
  {
    const x = eastShore(-230) + 52, z = -230, y = Math.max(1.2, H(x, z)) - 0.8;
    claim(x, z, 66, 66);
    for (const [dx, dz, w, d] of [[0, -28, 56, 8], [0, 28, 56, 8], [-28, 0, 8, 56], [28, 0, 8, 56]]) house(x + dx, z + dz, w, d, y, 10, P.Tile, '#e6dcc6', 0.3);
    for (const [dx, dz] of [[-28, -28], [28, -28], [-28, 28], [28, 28]]) {
      box(x + dx, z + dz, 9, 9, y, 16, P.Civic, '#e6dcc6', 0.7);
      for (let t = 0; t < 5; t++) box(x + dx, z + dz, 9.6 - t * 1.9, 9.6 - t * 1.9, y + 16 + t * 0.9, 0.9, P.Lead, '#5d6974');
    }
  }
  // Levent's towers far up the European side, the skyline you see over Beyoğlu's ridge on a clear day
  for (let k = 0; k < 11; k++) {
    const x = 240 + rnd() * 380, z = 1430 + rnd() * 220, y = H(x, z) - 1, w = 18 + rnd() * 16, d = 18 + rnd() * 14, h = 80 + rnd() * 120;
    box(x, z, w, d, y, h, P.Flats, pick(['#6f7f8c', '#8a96a0', '#c9ccc8', '#5d6b78']), 0.9);
    box(x, z, w * 0.7, d * 0.7, y + h, 6 + rnd() * 10, P.Flats, '#9aa3aa', 0.9);
  }

  // ------------------------------------------------------------------- the hillside quarters you look at across the water
  const WOOD = ['#b5523b', '#7a3b2e', '#c99a4b', '#6d5a4a', '#9aa39a', '#d9b47a', '#8a4b3a', '#e7d6b5', '#c7c0ad'];
  const PERA = ['#e8dcc4', '#d9c7a6', '#efe2cc', '#d8cbb4', '#e3b8a0', '#c9b49a', '#f1d9a8', '#dcc7b0', '#cfc3b0'];
  const MODERN = ['#f3efe6', '#e9e4da', '#dfe0dc', '#f1e6d2', '#e6d8c2', '#d6d3cc'];
  const AWNING = ['#a8323a', '#2f6b4a', '#2f4f7a', '#c58b2e', '#7a2f2a', '#e8dcc0'];
  const shade = (hex: string, k: number) => '#' + col.set(hex).multiplyScalar(k).getHexString();
  /**
   * A hillside quarter in rows along the contours, the houses shoulder to shoulder with their fronts to the water and a
   * stepped lane between each row and the next, so the hill climbs in roofs and facades instead of bare terraces. Side
   * 'n' is the Horn's north bank (rows run along x, fronts face south), 'e' the Asian shore (rows along z, fronts west).
   * Three kinds of house: old wooden ones with a bay window (cumba) under a tiled roof; Pera's stone and stucco blocks
   * with cornices, iron balconies, shop awnings and mansards or corner domes; and newer flats with long balconies and a
   * set-back top floor. The near rows get the small things; the far rows only walls and roofs.
   */
  const rowTown = (side: 'n' | 'e', a0: number, aEnd: (b: number) => number, shore: (a: number) => number, rows: number, detailRows: number, woodP: number, modernP: number) => {
    const xz = (a: number, b: number): [number, number] => (side === 'n' ? [a, b] : [b, a]);
    const at = (a: number, b: number, wa: number, db: number, y: number, h: number, kind: number, hex: string, s = 0.5, lod = 0) =>
      side === 'n' ? box(a, b, wa, db, y, h, kind, hex, s, lod) : box(b, a, db, wa, y, h, kind, hex, s, lod);
    const Tl = (a: number, b: number) => { const [x, z] = xz(a, b); return T(x, z); };
    const wetl = (a: number, b: number) => { const [x, z] = xz(a, b); return wet(x, z); };
    let off = 9;
    for (let r = 0; r < rows; r++) {
      // the upper rows, seen only as the skyline over the near ones, in bigger blocks: fewer boxes for the same roofs
      const big = r >= detailRows * 2 ? 1.6 : 1;
      const depth = (8 + rnd() * 4) * big;
      if (r > 0) off += 2.5 + rnd() * 2.5;
      const detail = r < detailRows;
      let a = a0 + rnd() * 5;
      for (let guard = 0; guard < 500 && a <= aEnd(shore(a) + off); guard++) {
        const roll = rnd();
        const style = roll < woodP + r * 0.012 ? 0 : roll < woodP + modernP ? 2 : 1; // 0 wooden, 1 Pera, 2 flats
        const wa = (style === 0 ? 5 + rnd() * 2.5 : style === 1 ? 7 + rnd() * 5 : 9 + rnd() * 5) * big;
        const db = style === 0 ? Math.min(depth, (7 + rnd() * 2) * big) : depth;
        const ac = a + wa / 2;
        const b0 = shore(ac) + off; // the front
        const [cx, cz] = xz(ac, b0 + db / 2);
        const [wx, wz] = side === 'n' ? [wa, db] : [db, wa];
        a += wa + (rnd() < 0.1 ? 3 + rnd() * 2 : style === 0 ? 0.4 : 0);
        if (outside(cx, cz) < Math.max(wa, db) / 2 + 1) continue;
        if (wetl(ac - wa / 2, b0) > -1.5 || wetl(ac + wa / 2, b0) > -1.5 || parkAt(cx, cz) || !free(cx, cz, wx, wz)) continue;
        const fl = Tl(ac - wa / 2, b0), fr = Tl(ac + wa / 2, b0), bl = Tl(ac - wa / 2, b0 + db), br = Tl(ac + wa / 2, b0 + db);
        const lo = Math.min(fl, fr, bl, br), hi = Math.max(fl, fr, bl, br), gf = Math.min(fl, fr);
        if (lo < 0.8 || hi - lo > 12) continue;
        claim(cx, cz, wx, wz);
        const base = lo - 0.5;
        const floors = style === 0 ? 2 + (rnd() < 0.55 ? 1 : 0) : style === 1 ? 4 + Math.floor(rnd() * 3) : 5 + Math.floor(rnd() * 4);
        const nf = floors + Math.round((hi - lo) / 4);
        const h = nf * 3 + (style === 0 ? 0.4 : 0.8), top = base + h;
        const s = rnd();
        // the first floor line at least a storey above the street in front: bay windows and balconies start there
        const yF = base + 3 * Math.ceil((gf + 2.4 - base) / 3);
        if (style === 0) {
          const hex = pick(WOOD);
          house(cx, cz, wx, wz, base, h, P.Tile, hex, s);
          if (detail && top - 0.4 - yF > 2.4) {
            const cw = Math.min(wa - 1.6, 2.6 + rnd() * 1.2);
            at(ac, b0 - 0.45, cw, 0.9, yF, top - 0.4 - yF, P.Bay, shade(hex, 0.92), s, 900);
          }
          continue;
        }
        const hex = style === 1 ? pick(PERA) : pick(MODERN);
        at(ac, b0 + db / 2, wa, db, base, h, P.Flats, hex, s);
        const nb = Math.floor((top - 2.2 - yF) / 3) + 1;
        if (detail) {
          const trim = shade(hex, 1.12);
          if (style === 1) {
            at(ac, b0 - 0.05, wa + 0.5, 0.5, top - 0.55, 0.65, P.Rock, trim, 0.5, 1000); // the cornice
            at(ac, b0 - 0.02, wa + 0.2, 0.36, yF - 0.32, 0.3, P.Rock, trim, 0.5, 650); // the string course over the shops
          }
          if (nb > 0) at(ac, b0 - 0.45, style === 1 ? wa * (0.45 + rnd() * 0.25) : wa - 0.8, 0.9, yF, 3 * (nb - 1) + 0.2, P.Balcony, shade(hex, 0.95), style === 1 ? s * 0.49 : 0.51 + s * 0.49, 800);
          if ((r < 3 || rnd() < 0.3) && Math.abs(fr - fl) < 1.6 && rnd() < 0.7)
            at(ac, b0 - 0.75, wa - 1.2, 1.5, gf + 2.5, 0.28, P.Awning, pick(AWNING), rnd(), 550);
        }
        // the roofs: mansards in slate, a corner dome, a set-back top floor, water tanks
        const rr = rnd();
        if (style === 1 && rr < 0.3) {
          at(ac, b0 + db / 2, wa - 1.2, db - 1.2, top, 2.4, P.Lead, '#5f6872', s);
          at(ac, b0 + db / 2, wa - 3, db - 3, top + 2.4, 0.5, P.Lead, '#4f5862', s, 1000);
        } else if (style === 1 && rr < 0.42 && detail) {
          const dc = ac + (rnd() < 0.5 ? -1 : 1) * (wa / 2 - 1.5);
          at(dc, b0 + 1.5, 2.8, 2.8, top, 1.8, P.Flats, hex, s);
          const [dx, dz] = xz(dc, b0 + 1.5);
          domeAt(dx, dz, 1.4, top + 1.8);
        } else if (style === 2 && rr < 0.55) {
          at(ac, b0 + db * 0.6, wa * 0.55, db * 0.5, top, 2.8, P.Flats, hex, s);
        } else if (detail && rr < 0.8) {
          at(ac + (rnd() - 0.5) * (wa - 2), b0 + db * (0.4 + rnd() * 0.4), 1.3, 1.3, top, 1.2, P.Flats, '#e8e8e6', 0.9, 500);
        }
      }
      off += depth;
    }
  };
  // the north bank: Karaköy's quays, Galata and Beyoğlu up the hill, Kasımpaşa as the Horn bends; rows stop short of the
  // Bosphorus, where Tophane and Cihangir look down on Galataport
  rowTown('n', -330, (b) => westShore(b) - 12, hornNorth, 34, 9, 0.28, 0.22);
  // the Asian shore: Üsküdar and Kuzguncuk to the north, Harem and Kadıköy to the south
  rowTown('e', -400, () => 250, eastShore, 17, 5, 0.34, 0.38);

  // the quay lamps and plane trees along the Horn's north bank and the Asian waterfront
  for (let x = -322; x < 26; x += 16) {
    if (Math.abs(x + 18) < 9) continue;
    const z = hornNorth(x) + 3.5, y = T(x, z);
    if (y < 0.5 || y > 3 || !free(x, z, 1, 1)) continue;
    lamp(x, z, y);
    if (pm(x, 32) < 16 && free(x + 8, z + 2, 4, 4)) { claim(x + 8, z + 2, 4, 4); tree(x + 8, z + 2, y, 0.9, 1200); }
  }
  for (let z = -390; z < 250; z += 18) {
    const x = eastShore(z) + 3.5, y = T(x, z);
    if (y < 0.5 || y > 3 || !free(x, z, 1, 1)) continue;
    lamp(x, z, y);
  }
  // fishing boats tied up along the north bank
  for (let k = 0; k < 16; k++) {
    const x = -320 + rnd() * 290;
    if (Math.abs(x + 18) < 12 || Math.abs(x + 150) < 12) continue;
    const z = hornNorth(x) - 3.5 - rnd() * 2;
    box(x, z, 5.5, 2.0, -1.0, 1.1, P.Rock, pick(['#f0ece2', '#2f4f7a', '#e8dcc0', '#a8323a']), 0.5, 1100);
    box(x - 0.8, z, 1.8, 1.4, 0.1, 1.2, P.Flats, '#f2efe8', 0.5, 800);
  }
  // trees in the gaps the houses leave on the facing hills: cypresses and planes over the lanes and in the gardens
  const plant = (ax: number, bx: number, az: number, bz: number, tries: number, want: number, lod: number) => {
    let got = 0;
    for (let i = 0; i < tries && got < want; i++) {
      const x = ax + rnd() * (bx - ax), z = az + rnd() * (bz - az);
      if (outside(x, z) < 4 || wet(x, z) > -3) continue;
      const y = T(x, z);
      if (y < 0.8 || !cells(x, z, 3, 3, 0, (c) => occ[c] === 0)) continue;
      claim(x, z, 3, 3);
      tree(x, z, y, 0.8 + rnd() * 0.5, lod);
      got++;
    }
  };
  plant(-340, 330, HORN_N, 760, 8000, 650, 0);
  plant(380, 760, -420, 260, 5000, 380, 0);

  // the rest of the city: blocks of flats and old houses on every patch of dry land, thinning out up the hills
  const scatter0 = parts.length / 12;
  for (let i = 0; i < 26000 && parts.length / 12 - scatter0 < 5200; i++) {
    const r = 40 + Math.pow(rnd(), 1.6) * 1500, a = rnd() * Math.PI * 2;
    const x = mx + Math.cos(a) * r * 1.1, z = mz + Math.sin(a) * r;
    const o = outside(x, z);
    const w = 6 + rnd() * 8, dd = 6 + rnd() * 8;
    if (o < Math.max(w, dd) / 2 + 0.5) continue;
    if (wet(x, z) > -w * 0.6 || parkAt(x, z) || !free(x, z, w, dd)) continue;
    const hs4 = [H(x - w / 2, z - dd / 2), H(x + w / 2, z - dd / 2), H(x - w / 2, z + dd / 2), H(x + w / 2, z + dd / 2)];
    const lo = Math.min(...hs4), hi = Math.max(...hs4);
    if (lo < 0.8 || hi - lo > 8 || (hi > 140 && rnd() < 0.7)) continue;
    claim(x, z, w, dd);
    const tall = (o < 60 ? 6 + rnd() * 9 : 8 + rnd() * 16) * (hi > 60 ? 0.7 : 1);
    const tile = rnd() < 0.35 ? P.Tile : P.Flats;
    house(x, z, w, dd, lo - 1.5, hi - lo + 1.5 + tall, tile, PASTEL[Math.floor(rnd() * PASTEL.length)], rnd());
    // a garden tree now and then among them, so the far hills aren't only boxes
    if (rnd() < 0.12) {
      const tx = x + (w / 2 + 2.5) * (rnd() < 0.5 ? -1 : 1), tz = z + (rnd() - 0.5) * dd;
      const ty = H(tx, tz);
      if (ty > 0.8 && wet(tx, tz) < -3 && free(tx, tz, 3, 3)) { claim(tx, tz, 3, 3); tree(tx, tz, ty, 1.2, 0); }
    }
  }
  // right up against the map's west and south sides, so the town's own houses run on into these without a gap
  const pack = (ax: number, bx: number, az: number, bz: number, tries: number, lo0: number, hi0: number) => {
    for (let i = 0; i < tries; i++) {
      const x = ax + rnd() * (bx - ax), z = az + rnd() * (bz - az);
      const w = 5 + rnd() * 7, dd = 5 + rnd() * 7;
      if (outside(x, z) < Math.max(w, dd) / 2 + 0.5) continue;
      if (wet(x, z) > -w * 0.5 || parkAt(x, z)) continue;
      const hs4 = [H(x - w / 2, z - dd / 2), H(x + w / 2, z - dd / 2), H(x - w / 2, z + dd / 2), H(x + w / 2, z + dd / 2)];
      const lo = Math.min(...hs4), hi = Math.max(...hs4);
      if (lo < 0.8 || hi - lo > 10) continue;
      claim(x, z, w, dd);
      house(x, z, w, dd, lo - 1.5, hi - lo + 1.5 + lo0 + rnd() * (hi0 - lo0), rnd() < 0.45 ? P.Tile : P.Flats, PASTEL[Math.floor(rnd() * PASTEL.length)], rnd());
    }
  };
  pack(x0 - 70, x0, z0 - 70, z1, 1400, 5, 12);
  pack(x0, x1, z0 - 70, z0, 1400, 5, 12);

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
  g.setAttribute('aLod', new THREE.InterleavedBufferAttribute(ib, 1, 11));
  g.instanceCount = n;
  const houses = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aBox; in vec4 aPart; in vec3 aCol; in float aLod;
      ${SQUASH}
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; out vec3 vSize; out vec4 vPart; out vec3 vCol;
      void main() {
        float y0 = aPart.x, h = aPart.y;
        vLocal = vec3(position.x * aBox.z, position.y * h, position.z * aBox.w);
        vec3 p = vec3(aBox.x + vLocal.x, y0 + vLocal.y, aBox.y + vLocal.z);
        vWorld = p; vN = normal; vSize = vec3(aBox.z, h, aBox.w); vPart = aPart; vCol = aCol;
        // the small things (balconies, awnings, lamps, the top courses of roofs) drop out past their distance
        if (aLod > 0.0 && distance(cameraPosition.xz, p.xz) > aLod) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
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
        float seed = vPart.z;
        int k = int(vPart.w + 0.5);
        vec3 alb = srgb2lin(vCol);
        float fw = fwidth(vWorld.x + vWorld.z);
        float fine = 1.0 - smoothstep(0.25, 0.8, fw);
        bool wall = abs(n.y) < 0.5;
        float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
        float y = vLocal.y;
        float win = 0.0, frame = 0.0, shop = 0.0;
        vec2 cell = vec2(0.0);
        bool homes = k == 0 || k == 1 || k == 6 || k == 7 || k == 11;
        // a quarter-metre grain, the voxels of the town carried out to the horizon
        alb *= 0.94 + 0.12 * hash12(floor(vec2(u * 4.0 + n.z * 13.0, y * 4.0)) + seed * 17.0);
        // balconies: a slab on every floor line and a railing on it, iron bars (seed < 0.5) or a solid parapet; between
        // them the stack is glazed and walled like the facade behind it, so it reads as the balconied bay of the front.
        // No discard here: the far city must keep early depth rejection behind the town's voxels
        float fy = mod(y, 3.0);
        bool rail = k == 10 && fy <= 1.05;
        if (rail) {
          if (fy > 0.24) {
            float bar = seed < 0.5 ? mix(0.6, step(0.45, fract(u * 5.0)), fine) : 0.0;
            alb = mix(alb * 0.9, srgb2lin(vec3(0.16, 0.16, 0.17)), seed < 0.5 ? 1.0 - bar * 0.55 : 0.0);
          }
        } else if (k == 9) {
          alb = mix(alb, srgb2lin(vec3(0.93, 0.9, 0.84)), step(0.5, fract(u * 1.4)) * 0.85); // awning stripes
        } else if (wall && (homes || k == 10)) {
          if (k == 11) {
            // a bay window: glazed nearly all round, a sill and a corbel below
            cell = vec2(floor((u + 40.0) / 0.9), floor(y / 3.0));
            vec2 f = vec2(fract((u + 40.0) / 0.9), fract(y / 3.0));
            win = step(0.14, f.x) * step(f.x, 0.86) * step(0.22, f.y) * step(f.y, 0.8) * step(0.5, y);
          } else {
            // windows on a pitch of its own for every house, a frame round each; shutters on some old houses;
            // shop fronts on the ground floor of the blocks
            float sp = 1.7 + fract(seed * 7.31) * 0.9, hw = 0.17 + fract(seed * 3.17) * 0.09;
            cell = vec2(floor((u + 40.0) / sp), floor(y / 3.0));
            vec2 f = vec2(fract((u + 40.0) / sp), fract(y / 3.0));
            shop = (k == 0 && cell.y < 0.5 && vSize.y > 9.0) ? 1.0 : 0.0;
            float wy0 = mix(0.28, 0.1, shop), wy1 = mix(0.78, 0.86, shop), whw = mix(hw, 0.42, shop);
            float inside = step(abs(f.x - 0.5), whw) * step(wy0, f.y) * step(f.y, wy1);
            float outer = step(abs(f.x - 0.5), whw + 0.07) * step(wy0 - 0.04, f.y) * step(f.y, wy1 + 0.05);
            float ok = step(k == 10 ? 0.0 : 1.2, y) * step(y, vSize.y - 1.0);
            win = inside * ok;
            frame = (outer - inside) * ok * (1.0 - shop);
            alb *= 1.0 + frame * fine * 0.28;
            if (k == 1 && seed < 0.4) {
              float sh = step(abs(f.x - 0.5), whw + 0.17) * step(wy0, f.y) * step(f.y, wy1) * (1.0 - step(abs(f.x - 0.5), whw + 0.07)) * ok;
              alb = mix(alb, seed < 0.2 ? srgb2lin(vec3(0.24, 0.36, 0.26)) : srgb2lin(vec3(0.36, 0.24, 0.17)), sh * fine);
            }
          }
        } else if (wall && k == 14) {
          // Galata's stone: narrow arched slits, few and far between
          cell = vec2(floor((u + 40.0) / 3.4), floor(y / 5.2));
          vec2 f = vec2(fract((u + 40.0) / 3.4), fract(y / 5.2));
          float slit = step(abs(f.x - 0.5), 0.07) * step(0.35, f.y) * step(f.y, 0.78 - abs(f.x - 0.5) * 0.8) * step(4.0, y);
          alb = mix(alb, srgb2lin(vec3(0.1, 0.1, 0.11)), slit * fine * 0.9);
          alb *= 1.0 - step(0.96, fract(y / 1.3)) * 0.12 * fine; // the courses of stone
        } else if (wall && k == 3) {
          // mosque walls: two rows of arched windows
          cell = vec2(floor((u + 40.0) / 2.4), floor(y / 3.4));
          vec2 f = vec2(fract((u + 40.0) / 2.4), fract(y / 3.4));
          float w3 = step(0.35, f.x) * step(f.x, 0.65) * step(0.3, f.y) * step(f.y, 0.85 - abs(f.x - 0.5) * 0.4) * step(y, vSize.y - 1.0);
          alb = mix(alb, srgb2lin(vec3(0.12, 0.13, 0.15)), w3 * fine * 0.8);
        } else if (wall && k == 4) {
          // a minaret: the balconies are dark bands
          float band = step(0.72, fract(y / max(1.0, vSize.y) * 2.0)) * step(fract(y / max(1.0, vSize.y) * 2.0), 0.76);
          alb = mix(alb, srgb2lin(vec3(0.5, 0.48, 0.44)), band);
        } else if (n.y > 0.5 && k == 0) {
          alb = mix(alb * 0.86, srgb2lin(vec3(0.7, 0.7, 0.72)), step(0.82, hash12(floor(vLocal.xz * 0.6) + seed * 5.0))); // tanks and dishes
        } else if (n.y > 0.5 && (k == 1 || k == 11)) {
          alb = srgb2lin(vec3(0.66, 0.3, 0.2)) * (0.85 + 0.15 * step(0.5, fract(vLocal.x * 2.0)));
        }
        if (k == 5) alb *= 0.8 + 0.4 * hash12(floor(vLocal.xz * 2.0 + vLocal.y * 2.0) + seed);
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * 0.9 + hemi);
        vec2 fa, fe;
        if (abs(n.x) > 0.5) { fa = vec2(vLocal.z + vSize.z * 0.5, vLocal.y); fe = vSize.zy; }
        else if (abs(n.z) > 0.5) { fa = vec2(vLocal.x + vSize.x * 0.5, vLocal.y); fe = vSize.xy; }
        else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float d = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.15 + fw * 0.7, d)) * 0.18;
        if (win > 0.0) {
          // the glass: dark, with the sky in it by day; at night a share of the rooms lit, warm or the blue of a screen
          vec3 glass = srgb2lin(vec3(0.1, 0.12, 0.14)) * hemi + uSkyColor * 0.14 * (1.0 - uNight);
          col = mix(col, glass, win * fine * 0.92);
          float hr = hash12(cell * vec2(1.7, 3.1) + seed * 91.0 + n.xz * 7.0);
          float on = step(hr, mix(0.16 + 0.26 * uNight, 0.6, shop));
          vec3 tint = mix(vec3(1.0, 0.86, 0.66), vec3(0.75, 0.85, 1.0), step(0.85, fract(hr * 13.7)));
          col += win * on * uWindowColor * tint * uNight * mix(0.55, 0.8, shop);
        }
        if (k == 12) col += uWindowColor * uNight * 2.2; // the lanterns
        // the mosques, the tower and the old stone halls are floodlit at night, warm on the stone and the lead
        if (k == 2 || k == 3 || k == 4 || k == 6 || k == 7 || k == 14) col += alb * uWindowColor * uNight * 0.35;
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
  for (const f of FERRY) fbox(...f);
  const fg = new THREE.InstancedBufferGeometry();
  fg.index = unit.index;
  fg.setAttribute('position', unit.attributes.position);
  fg.setAttribute('normal', unit.attributes.normal);
  const fib = new THREE.InstancedInterleavedBuffer(new Float32Array(fp), 12);
  fg.setAttribute('aBox', new THREE.InterleavedBufferAttribute(fib, 4, 0));
  fg.setAttribute('aPart', new THREE.InterleavedBufferAttribute(fib, 4, 4));
  fg.setAttribute('aCol', new THREE.InterleavedBufferAttribute(fib, 3, 8));
  fg.setAttribute('aLod', new THREE.InterleavedBufferAttribute(fib, 1, 11));
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
