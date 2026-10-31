import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';
import { hillY, shoreY, valleyZ, ROAD_X0, ROAD_X1 } from '../world/amalfiPlan';

/**
 * The Amalfi Coast past the edges of the playable map. The Lattari mountains climb from the town's two flanks to
 * ridges well over a thousand metres inland; the Valle dei Mulini carries on up behind the town; the headland to
 * the east hides Atrani in its own little valley, with Ravello on the ridge above it; to the west the coast road
 * clings to the cliffs past Conca dei Marini towards Positano. Out to sea there is only the gulf, all the way to
 * the horizon (the composite shader draws the water over the sea floor laid down here).
 *
 * One mesh of ground whose spacing grows with distance from the map, and one instanced draw of houses: boxes in
 * pastel stucco whose windows, shutters and roof terraces the shader paints. Like the far city in Tokyo, anything
 * between the iso camera and the map squats down so it never hides the streets.
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
  const wA = 26 + inland * 0.06;
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
  h = Math.min(h, d * 3.2 + 2);
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
const PASTEL = ['#f1e6d3', '#f3dca6', '#efc6a6', '#e9c3c7', '#f5ecc8', '#e2d5c0', '#f3d9b4', '#e8b89c', '#f7f2e8', '#dfe3d6'];

export function farCoast(shared: SharedUniforms, rect: Rect): { ground: THREE.Mesh; houses: THREE.Mesh } {
  const [x0, z0, x1, z1] = rect;
  const outside = (x: number, z: number) => Math.max(x0 - x, x - x1, z0 - z, z - z1, 0);
  // height where the far ground meets the map: what the map itself has at its edge, so the seam is a step at most
  const edgeY = (x: number, z: number) => {
    const ex = Math.max(x0, Math.min(x1, x)), ez = Math.max(z0, Math.min(z1, z));
    if (ex < ROAD_X0) return hillY(ex, ez) - 0.4;
    if (ex <= ROAD_X1) return ez < -52 ? hillY(ex, ez) + 4 : 1.6;
    return shoreY(ex, ez);
  };
  const H = (x: number, z: number) => {
    const o = outside(x, z);
    if (o <= 0) return -40; // under the map: the voxels are the ground there
    const far = farHeight(x, z), t = smooth(0, 90, o);
    let h = edgeY(x, z) * (1 - t) + far * t;
    // the coast road carries on out of the map, cut into the cliff a little way above the sea
    const rd = Math.abs(x - (coastX(z) - 10));
    if (z > z1 && rd < 4.5) h = Math.min(h, 1.6 + Math.max(0, z - z1) * 0.12);
    return h;
  };

  // grid lines: fine where the map meets the far ground, coarser and coarser away from it
  const axis = (a0: number, a1: number, lo: number, hi: number) => {
    const out: number[] = [];
    for (let a = a0; a <= a1 + 0.01; a += 4) out.push(a);
    let a = a0, s = 4;
    while (a > lo) { s = Math.min(48, s * 1.07); a -= s; out.unshift(a); }
    a = a1; s = 4;
    while (a < hi) { s = Math.min(48, s * 1.07); a += s; out.push(a); }
    return out;
  };
  const xs = axis(x0, x1, -1500, 700), zs = axis(z0, z1, -1500, 1500);
  const nx = xs.length, nz = zs.length;
  const pos = new Float32Array(nx * nz * 3), kind = new Float32Array(nx * nz);
  const hs = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) hs[j * nx + i] = H(xs[i], zs[j]);
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i, x = xs[i], z = zs[j], h = hs[k];
      pos[k * 3] = x; pos[k * 3 + 1] = h; pos[k * 3 + 2] = z;
      const hx = hs[j * nx + Math.min(nx - 1, i + 1)] - hs[j * nx + Math.max(0, i - 1)];
      const hz = hs[Math.min(nz - 1, j + 1) * nx + i] - hs[Math.max(0, j - 1) * nx + i];
      const run = (xs[Math.min(nx - 1, i + 1)] - xs[Math.max(0, i - 1)]) + (zs[Math.min(nz - 1, j + 1)] - zs[Math.max(0, j - 1)]);
      const slope = (Math.abs(hx) + Math.abs(hz)) / Math.max(1, run * 0.5);
      const d = coastX(z) - x;
      let kd: Kind;
      if (h < -0.3) kd = Kind.Seabed;
      else if (h < 2.2 && d < 14 && slope < 0.5) kd = Math.abs(d - 10) < 4.5 && z > z1 ? Kind.Road : Kind.Beach;
      else if (z > z1 && Math.abs(x - (coastX(z) - 10)) < 4 && h < 40) kd = Kind.Road;
      else if (slope > 1.35) kd = Kind.Rock;
      else if (h < 420 && slope < 0.95 && fbm(x * 0.02, z * 0.02) > 0.42) kd = Kind.Terrace;
      else if (h > 520 || fbm(x * 0.01 + 9, z * 0.01) > 0.62) kd = Kind.Wood;
      else kd = Kind.Maquis;
      for (const v of VILLAGES) if (Math.hypot(x - v.x, z - v.z) < v.r * 0.9 && kd !== Kind.Seabed && slope < 1.6) kd = Kind.Village;
      kind[k] = kd;
    }
  const idx: number[] = [];
  for (let j = 0; j < nz - 1; j++)
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, e = c + 1;
      // cells wholly over the map are left out: the city is there
      if (hs[a] === -40 && hs[b] === -40 && hs[c] === -40 && hs[e] === -40) continue;
      idx.push(a, c, b, b, c, e);
    }
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  gg.setAttribute('aKind', new THREE.BufferAttribute(kind, 1));
  gg.setIndex(idx);
  gg.computeVertexNormals();
  // and a floor for the open sea, out to the horizon in every direction
  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;

  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2(mx, mz) },
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
        float fd = max(0.0, distance(w, uFog.xyz) - FOG_START) * uFog.w * 0.22;
        a = max(a, (1.0 - exp(-fd * fd)) * lift);
      }
      return mix(col, uFogColor, min(a, 0.92));
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
        // squatted ground loses its relief too: no contour stripes or steep-slope shading on a flattened hill
        float keep = smoothstep(0.45, 0.95, s);
        vWorld = vec3(position.x, mix(min(position.y, 0.0), position.y, keep), position.z);
        vN = normalize(mix(vec3(0.0, 1.0, 0.0), normal, keep)); vKind = aKind;
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
        float fw = fwidth(p.x + p.y);
        float k = vKind;
        float g = vnoise(p * 0.35) * 0.6 + vnoise(p * 1.7) * 0.4;
        float fine = 1.0 - smoothstep(0.4, 2.0, fw);
        vec3 alb;
        float lights = 0.0;
        if (k > 4.5 && k < 5.5) {
          // the sea floor: sand and weed, seen through the water
          alb = mix(srgb2lin(vec3(0.42, 0.45, 0.4)), srgb2lin(vec3(0.2, 0.3, 0.26)), vnoise(p * 0.08));
        } else if (k > 3.5 && k < 4.5) {
          alb = mix(srgb2lin(vec3(0.62, 0.6, 0.56)), srgb2lin(vec3(0.5, 0.48, 0.45)), g);
        } else if (k > 2.5 && k < 3.5) {
          alb = srgb2lin(vec3(0.36, 0.36, 0.37));
          lights = 0.4;
        } else if (k < 0.5) {
          // limestone cliffs: pale and streaked, ochre where the rock is fresh
          float streak = vnoise(vec2(p.x * 0.05 + p.y * 0.05, vWorld.y * 0.35));
          alb = mix(srgb2lin(vec3(0.66, 0.62, 0.55)), srgb2lin(vec3(0.5, 0.44, 0.37)), streak * 0.7 + g * 0.3);
          alb = mix(alb, srgb2lin(vec3(0.42, 0.5, 0.33)), smoothstep(0.55, 0.9, n.y) * 0.6);
        } else if (k > 1.5 && k < 2.5) {
          // lemon terraces: green rows under dark pergola nets, stepped by dry-stone walls every few metres
          float row = fract(vWorld.y / 3.2);
          alb = mix(srgb2lin(vec3(0.33, 0.47, 0.2)), srgb2lin(vec3(0.24, 0.33, 0.16)), g);
          float wall = smoothstep(0.82, 0.9, row) * fine;
          alb = mix(alb, srgb2lin(vec3(0.6, 0.57, 0.5)), wall * 0.7);
          alb = mix(alb, srgb2lin(vec3(0.75, 0.68, 0.25)), step(0.93, hash12(floor(p * 0.9))) * 0.35 * fine);
        } else if (k > 5.5 && k < 6.5) {
          alb = mix(srgb2lin(vec3(0.45, 0.5, 0.33)), srgb2lin(vec3(0.62, 0.58, 0.5)), g);
          lights = 1.0;
        } else if (k > 6.5) {
          // chestnut and holm-oak woods on the high slopes
          alb = mix(srgb2lin(vec3(0.17, 0.27, 0.13)), srgb2lin(vec3(0.24, 0.33, 0.16)), g);
        } else {
          // maquis: myrtle, broom and rock
          alb = mix(srgb2lin(vec3(0.33, 0.42, 0.22)), srgb2lin(vec3(0.5, 0.5, 0.38)), g * 0.8 + 0.2 * vnoise(p * 0.02));
        }
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl + hemi);
        // a few lamps along the road and in the villages after dark
        if (lights > 0.0) {
          vec2 c = floor(p * 0.25);
          float on = step(0.9 - lights * 0.06, hash12(c + 3.7));
          vec2 f = fract(p * 0.25) - 0.5;
          col += uWindowColor * on * exp(-dot(f, f) * 40.0) * uNight * 0.5;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  ground.frustumCulled = false;
  ground.renderOrder = 10; // after the world, so it only fills what the voxels leave empty

  // houses: in the villages, one by one on the slope, each a box with a terrace or a little dome on top
  const parts: number[] = [];
  const col = new THREE.Color();
  for (const v of VILLAGES) {
    let seed = v.seed * 7919;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < v.n * 3 && parts.length / 12 < 1400; i++) {
      if (parts.length / 12 >= 1400) break;
      const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * v.r;
      const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r;
      if (outside(x, z) < 6) continue;
      const w = 4.5 + rnd() * 4.5, dd = 4 + rnd() * 4;
      const hs4 = [H(x - w / 2, z - dd / 2), H(x + w / 2, z - dd / 2), H(x - w / 2, z + dd / 2), H(x + w / 2, z + dd / 2)];
      const lo = Math.min(...hs4), hi = Math.max(...hs4);
      if (lo < 0.8 || hi - lo > 9) continue; // in the sea, or too steep to build on
      const tall = 5.5 + rnd() * 7;
      col.set(PASTEL[Math.floor(rnd() * PASTEL.length)]);
      parts.push(x, z, w, dd, lo - 1.5, hi - lo + 1.5 + tall, rnd(), rnd() < 0.3 ? 1 : 0, col.r, col.g, col.b, 0);
    }
  }
  // a bell tower or two: Atrani's San Salvatore and Ravello's cathedral
  for (const [x, z, y, c] of [[24, -258, 0, '#e8d7b0'], [-288, -200, 0, '#efe6d6']] as const) {
    const h = H(x, z);
    col.set(c);
    parts.push(x, z, 3.5, 3.5, h - 1, 22 + y, 0.5, 2, col.r, col.g, col.b, 0);
  }
  const n = parts.length / 12;
  const g = new THREE.InstancedBufferGeometry();
  const box = new THREE.BoxGeometry(1, 1, 1);
  box.translate(0, 0.5, 0);
  g.index = box.index;
  g.setAttribute('position', box.attributes.position);
  g.setAttribute('normal', box.attributes.normal);
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
        // a house on squatted ground would be a painted rug: past a point it simply isn't drawn
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
        if (wall) {
          // tall windows with green or blue shutters, a floor every three metres; the foot is in the ground
          cell = vec2(floor((u + 40.0) / 2.2), floor(y / 3.0));
          vec2 f = vec2(fract((u + 40.0) / 2.2), fract(y / 3.0));
          win = step(0.32, f.x) * step(f.x, 0.68) * step(0.25, f.y) * step(f.y, 0.8) * step(vSize.y - y, vSize.y - 1.5) * step(y, vSize.y - 1.0);
          float open = step(0.45, hash12(cell + seed * 37.0));
          vec3 shutter = mix(srgb2lin(vec3(0.27, 0.42, 0.33)), srgb2lin(vec3(0.24, 0.36, 0.5)), step(0.6, seed));
          alb = mix(alb, open > 0.5 ? srgb2lin(vec3(0.08, 0.08, 0.09)) : shutter, win * fine);
          if (kind > 1.5) {
            // a bell tower: majolica tiles in its little dome, an arched opening for the bells
            float bells = step(vSize.y - 5.0, y) * step(y, vSize.y - 2.0) * step(0.3, fract(u / 3.5 + 0.5)) * step(fract(u / 3.5 + 0.5), 0.7);
            alb = mix(alb, srgb2lin(vec3(0.1, 0.1, 0.1)), bells * fine);
          }
          // a band of shadow at the foot
          alb *= mix(0.7, 1.0, smoothstep(0.0, 2.5, y - (vSize.y - vSize.y)));
        } else if (n.y > 0.5) {
          // roof: a white terrace, or a dome of whitewash over a vault; majolica on the towers
          alb = kind > 1.5 ? mix(srgb2lin(vec3(0.15, 0.45, 0.32)), srgb2lin(vec3(0.85, 0.7, 0.2)), step(0.5, fract((vLocal.x + vLocal.z) * 1.2))) : kind > 0.5 ? srgb2lin(vec3(0.9, 0.88, 0.84)) : alb * 1.05;
        }
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * 0.9 + hemi);
        // edges catch the light like the voxel bevels in town
        vec2 fa, fe;
        if (abs(n.x) > 0.5) { fa = vec2(vLocal.z + vSize.z * 0.5, vLocal.y); fe = vSize.zy; }
        else if (abs(n.z) > 0.5) { fa = vec2(vLocal.x + vSize.x * 0.5, vLocal.y); fe = vSize.xy; }
        else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float d = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.15 + fw * 0.7, d)) * 0.2;
        if (win > 0.0) {
          float on = step(hash12(cell * vec2(1.7, 3.1) + seed * 91.0 + n.xz * 7.0), 0.18 + 0.2 * uNight);
          col += win * on * uWindowColor * uNight * 0.45;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  houses.frustumCulled = false;
  houses.renderOrder = 10;

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
