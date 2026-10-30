import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';

/**
 * The rest of Tokyo past the edges of the playable map. Streets carry on from the ring road round the map
 * in a grid of blocks; each block is cut into lots and every lot gets a building made of a few stacked boxes:
 * two-storey houses with stepped tile roofs near the map, five to eight storey shops and offices with rooftop
 * tanks and blade signs further out, glass towers on the horizon (most of them beyond the neon side), and the
 * odd park. Everything is one instanced draw of plain boxes; windows, tiles, voxel grain and the bevelled
 * edges of the real city are drawn by the shader, which fades its own detail out where it would shimmer.
 * The streets themselves are painted on the ground apron by a matching shader, lit by lamps at night.
 */

/** Width of a street and of a block between streets (m), and the ring road round the map. */
const ROAD = 5, BLOCK = 31, RING = 6;
const PERIOD = ROAD + BLOCK;

type Rect = [number, number, number, number];

/** Block intervals along one axis: outward from both sides of the map, and across it. */
function intervals(a0: number, a1: number, reach: number): [number, number][] {
  const out: [number, number][] = [];
  for (let e = a0 - RING; e > a0 - reach; e -= PERIOD) out.push([e - BLOCK, e]);
  for (let s = a0; s < a1; s += PERIOD) out.push([s, Math.min(a1, s + BLOCK)]);
  for (let s = a1 + RING; s < a1 + reach; s += PERIOD) out.push([s, s + BLOCK]);
  return out;
}

const AXIS_ROAD = /* glsl */ `
const float ROAD = ${ROAD.toFixed(1)}, BLOCK = ${BLOCK.toFixed(1)}, RING = ${RING.toFixed(1)}, PERIOD = ${PERIOD.toFixed(1)};
// distance (m) into the street along one axis, or negative inside a block (the same grid the city is built on)
float axisRoad(float x, float a0, float a1) {
  float t;
  if (x < a0 - RING) t = mod(a0 - RING - x, PERIOD);
  else if (x < a0) return x - (a0 - RING);
  else if (x <= a1) t = mod(x - a0, PERIOD);
  else if (x < a1 + RING) return a1 + RING - x;
  else t = mod(x - a1 - RING, PERIOD);
  return t > BLOCK ? min(t - BLOCK, PERIOD - t) : -min(t, BLOCK - t);
}
// shared haze: thicker the further from the map, plus the first-person fog
vec3 farHaze(vec3 col, vec3 w, vec4 rect, vec3 fogColor, vec4 fog) {
  vec2 o = max(rect.xy - w.xz, w.xz - rect.zw);
  float out_ = max(0.0, max(o.x, o.y));
  col = mix(col, fogColor, 1.0 - exp(-out_ * 0.0055));
  if (fog.w > 0.0) {
    float fd = max(0.0, distance(w, fog.xyz) - FOG_START) * fog.w;
    col = mix(col, fogColor, 1.0 - exp(-fd * fd));
  }
  return col;
}
`;

// building parts: 0 plaster house wall, 1 shop / office block, 2 glass tower, 3 tile roof, 4 roof slab or
// equipment, 5 sign, 6 tree crown
const HOUSE = ['#ddd2bd', '#c8b39a', '#9e8670', '#b9bdc2', '#e8e2d6', '#cdbfa6'];
const ROOF = ['#4c5561', '#6b4d42', '#5a6559', '#3f4652'];
const MID = ['#bcb8ae', '#d1c6b2', '#a9a19b', '#e0dbd1', '#94929a', '#c9b49c', '#b8c0c4'];
const GLASS = ['#5d7891', '#6f8798', '#4e6a73', '#7b8fa6'];
const SIGN = ['#e8473a', '#f2c230', '#36c6d8', '#e85aa8', '#5bd16a', '#f08a2e'];
const TREE = ['#5c8a4a', '#4f7a43', '#6a9550', '#e9b4c4'];

export function farCity(shared: SharedUniforms, rect: Rect, gaps: Rect[] = [], reach = 300): { city: THREE.Mesh; ground: THREE.Mesh } {
  const [x0, z0, x1, z1] = rect;
  const parts: number[] = [];
  let seed = 9173;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];
  const col = new THREE.Color();
  const part = (cx: number, cz: number, w: number, d: number, y0: number, h: number, kind: number, c: string, s = rnd()) => {
    col.set(c);
    parts.push(cx, cz, w, d, y0, h, kind, s, col.r, col.g, col.b, 0);
  };
  const outOf = (ax0: number, az0: number, ax1: number, az1: number) => Math.max(x0 - ax1, ax0 - x1, z0 - az1, az0 - z1);
  const inGap = (ax0: number, az0: number, ax1: number, az1: number) => gaps.some(([a, b, c, e]) => ax1 > a && ax0 < c && az1 > b && az0 < e);
  const neX = x1 + 90, neZ = z0 - 70;

  const building = (lx0: number, lz0: number, lx1: number, lz1: number, k: number, ne: number, face: number) => {
    const set = 0.4 + rnd() * 0.8;
    const w = lx1 - lx0 - set * 2, d = lz1 - lz0 - set * 2;
    if (w < 3 || d < 3) return;
    const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2;
    const r = rnd();
    const tall = Math.max(k * k * 0.55, ne * 0.8);
    if (r < 0.62 - tall * 0.7 && k < 0.7) {
      // a house: two or three floors and a stepped tile roof along its longer side
      const h = (rnd() < 0.7 ? 2 : 3) * 2.9 + 0.3;
      part(cx, cz, w, d, 0, h, 0, pick(HOUSE));
      const rc = pick(ROOF), alongX = w >= d;
      const rw = alongX ? w + 0.5 : d + 0.5, rd = alongX ? d + 0.5 : w + 0.5;
      const steps = 3;
      for (let i = 0; i < steps; i++) {
        const f = 1 - i / steps;
        const a = rw - i * 0.3, b = rd * f;
        part(cx, cz, alongX ? a : b, alongX ? b : a, h + i * 0.5, 0.5, 3, rc);
      }
    } else if (r < 0.93 - tall * 0.5) {
      // a shop or office block with a parapet, roof tanks and maybe a sign on the street side
      const floors = 4 + Math.floor(rnd() * 5 + k * 6 + ne * 6);
      const h = floors * 3.2 + 0.8;
      part(cx, cz, w, d, 0, h, 1, pick(MID));
      part(cx, cz, w - 0.2, d - 0.2, h, 0.35, 4, '#8d8b88');
      if (rnd() < 0.7) {
        const tw = 1.5 + rnd() * 1.5;
        part(cx + (rnd() - 0.5) * (w - tw - 1), cz + (rnd() - 0.5) * (d - tw - 1), tw, tw, h + 0.35, 1.6 + rnd() * 1.6, 4, '#d6d4cc');
      }
      if (rnd() < 0.5) part(cx + (rnd() - 0.5) * (w - 2), cz + (rnd() - 0.5) * (d - 2), 1.6, 1.0, h + 0.35, 0.9, 4, '#b9b7b0');
      if (rnd() < 0.55 && floors > 3) {
        // a vertical blade sign on the street face (face: 0 -z, 1 +x, 2 +z, 3 -x)
        const sh = Math.min(h - 3.5, 4 + rnd() * 7), sy = 3.2 + rnd() * Math.max(0, h - sh - 4);
        const along = (rnd() - 0.5) * (Math.min(w, d) - 2);
        const sc = pick(SIGN);
        if (face === 0) part(cx + along, cz - d / 2 - 0.5, 0.25, 1.0, sy, sh, 5, sc);
        else if (face === 2) part(cx + along, cz + d / 2 + 0.5, 0.25, 1.0, sy, sh, 5, sc);
        else if (face === 1) part(cx + w / 2 + 0.5, cz + along, 1.0, 0.25, sy, sh, 5, sc);
        else part(cx - w / 2 - 0.5, cz + along, 1.0, 0.25, sy, sh, 5, sc);
      }
    } else {
      // a tower: glass shaft, a set-back crown and a mast
      let h = 30 + rnd() * 40 + k * 40 + ne * rnd() * 90;
      h = Math.round(h / 3.6) * 3.6;
      part(cx, cz, w, d, 0, h, 2, pick(GLASS));
      const cw = w * (0.55 + rnd() * 0.2), cd = d * (0.55 + rnd() * 0.2), ch = 3.6 * (1 + Math.floor(rnd() * 3));
      part(cx, cz, cw, cd, h, ch, 2, pick(GLASS));
      part(cx, cz, w + 0.3, d + 0.3, h - 0.6, 0.6, 4, '#c8ccd2');
      if (rnd() < 0.5) part(cx, cz, 0.35, 0.35, h + ch, 4 + rnd() * 8, 4, '#d8d8d8');
    }
  };

  // park blocks (centres), for the ground shader to green
  const parks: number[] = [];
  const xs = intervals(x0, x1, reach), zs = intervals(z0, z1, reach);
  for (const [bz0, bz1] of zs)
    for (const [bx0, bx1] of xs) {
      const out = outOf(bx0, bz0, bx1, bz1);
      if (out < RING - 0.01) continue;
      const k = Math.min(1, out / 220);
      const ne = Math.max(0, 1 - Math.hypot((bx0 + bx1) / 2 - neX, (bz0 + bz1) / 2 - neZ) / 170);
      if (rnd() < 0.06 && out > 20 && parks.length < 64) {
        // a park: trees on grass (the ground shader greens the block)
        for (let i = 0; i < 9; i++) {
          const s = 3 + rnd() * 3.5, tx = bx0 + 3 + rnd() * (bx1 - bx0 - 6), tz = bz0 + 3 + rnd() * (bz1 - bz0 - 6);
          part(tx, tz, 0.5, 0.5, 0, 2.2, 4, '#6b5240');
          part(tx, tz, s, s, 1.8 + rnd(), s * 0.8, 6, rnd() < 0.15 ? TREE[3] : pick(TREE.slice(0, 3)));
        }
        parks.push((bx0 + bx1) / 2, (bz0 + bz1) / 2);
        continue;
      }
      // two rows of lots, each facing its own street
      const half = (bz1 - bz0) / 2;
      for (let row = 0; row < 2; row++) {
        const lz0 = bz0 + row * half, lz1 = lz0 + half;
        let lx = bx0;
        while (lx < bx1 - 3) {
          const big = rnd() < 0.15 + k * 0.25;
          let lw = big ? 12 + rnd() * 10 : 6 + rnd() * 6;
          if (bx1 - (lx + lw) < 5) lw = bx1 - lx;
          const lx1 = Math.min(bx1, lx + lw);
          if (!inGap(lx, lz0, lx1, lz1) && outOf(lx, lz0, lx1, lz1) > RING - 0.01) building(lx, lz0, lx1, lz1, k, ne, row === 0 ? 0 : 2);
          lx = lx1;
        }
      }
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

  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp, uEmitDay: shared.uEmitDay,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2(mx, mz) },
  };
  const city = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aBox; in vec4 aPart; in vec3 aCol;
      uniform vec3 uCamFwd; uniform vec2 uMid;
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; out vec3 vSize; out vec4 vPart; out vec3 vCol;
      void main() {
        float y0 = aPart.x, h = aPart.y, s = 1.0;
        // iso view: blocks between the camera and the map squat down so they never hide the streets
        if (projectionMatrix[3][3] == 1.0) {
          vec2 dir = normalize(aBox.xy - uMid);
          float camSide = -dot(dir, normalize(uCamFwd.xz));
          s = mix(1.0, 0.12, smoothstep(-0.2, 0.5, camSide));
        }
        vLocal = vec3(position.x * aBox.z, position.y * h, position.z * aBox.w);
        vec3 p = vec3(aBox.x + vLocal.x, (y0 + vLocal.y) * s, aBox.y + vLocal.z);
        vWorld = p; vN = normal; vSize = vec3(aBox.z, h, aBox.w); vPart = aPart; vCol = aCol;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${AXIS_ROAD}
      uniform vec3 uFogColor, uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp, uEmitDay; uniform vec4 uFog; uniform vec4 uRect;
      in vec3 vWorld; in vec3 vN; in vec3 vLocal; in vec3 vSize; in vec4 vPart; in vec3 vCol;
      layout(location = 0) out vec4 outColor;
      // window mask in a cell of (period u, floor height), fading to its average where it would shimmer
      float grid(float u, float y, float pu, float fh, vec4 r, out vec2 cell) {
        cell = vec2(floor(u / pu), floor(y / fh));
        vec2 f = vec2(fract(u / pu), fract(y / fh));
        float m = step(r.x, f.x) * step(f.x, r.y) * step(r.z, f.y) * step(f.y, r.w);
        float aa = smoothstep(0.35, 0.8, max(fwidth(u) / pu, fwidth(y) / fh) * 3.0);
        return mix(m, (r.y - r.x) * (r.w - r.z), aa);
      }
      void main() {
        int kind = int(vPart.z + 0.5);
        float seed = vPart.w;
        vec3 n = vN;
        vec3 albedo = srgb2lin(vCol);
        // voxel grain: half-metre cells, like the real city's per-voxel jitter (gone where it would shimmer)
        vec3 vc = floor(vWorld * 2.0 - n * 0.25);
        float g = hash12(vc.xz + vc.y * 17.13);
        float fw = fwidth(vWorld.x + vWorld.z);
        albedo *= 1.0 + (g - 0.5) * 0.1 * (1.0 - smoothstep(0.2, 0.5, fw));
        bool wall = abs(n.y) < 0.5;
        float u = abs(n.x) > 0.5 ? vLocal.z : vLocal.x;
        float y = vPart.x + vLocal.y;
        float win = 0.0, emit = 0.0;
        vec2 cell = vec2(0.0);
        vec3 glass = mix(uSkyColor, uFogColor, 0.5) * 0.5;
        if (wall) {
          if (kind == 0) {
            win = grid(u + 0.4, y, 2.6, 2.9, vec4(0.28, 0.74, 0.32, 0.78), cell);
            albedo = mix(albedo, glass * 0.6 + vec3(0.02), win);
          } else if (kind == 1) {
            win = grid(u, y, 1.6, 3.2, vec4(0.08, 0.92, 0.36, 0.8), cell);
            // the ground floor is a shop front: wide and bright
            if (y < 3.2) { win = grid(u, y, 4.0, 3.2, vec4(0.06, 0.94, 0.05, 0.7), cell); }
            albedo = mix(albedo, glass + vec3(0.03), win);
          } else if (kind == 2) {
            win = grid(u, y, 1.8, 3.6, vec4(0.06, 0.94, 0.2, 1.0), cell);
            albedo = mix(albedo * 1.4, srgb2lin(vCol) * 0.55 + glass * 0.5, win);
          } else if (kind == 5) {
            // a lit sign: a column of characters
            float c = step(0.2, fract(y / 1.1)) * step(fract(y / 1.1), 0.85) * step(0.2, fract(u * 3.0 + 0.5));
            emit = 0.5 + 0.5 * c;
          }
        } else if (kind == 3) {
          // tile rows
          float r = fract((abs(vSize.x) >= abs(vSize.z) ? vLocal.z : vLocal.x) * 3.0);
          albedo *= mix(0.86 + 0.14 * step(0.5, r), 0.93, smoothstep(0.1, 0.3, fw));
        }
        if (kind == 1 || kind == 2) { if (n.y > 0.5) albedo = srgb2lin(vec3(0.55, 0.55, 0.54)) * (0.9 + 0.1 * g); }
        if (kind == 6) albedo *= 0.85 + 0.3 * hash12(floor(vWorld.xz * 1.5) + floor(vWorld.y * 1.5) * 7.0);

        // light like the city: hemisphere sky, sun, darker at the foot of walls
        float ndl = max(dot(n, uSunDir), 0.0);
        float ao = wall ? mix(0.55, 1.0, smoothstep(0.0, 2.5, vWorld.y)) : 1.0;
        if (kind == 3 || kind == 4) ao *= 0.9;
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = albedo * (uSunColor * ndl * (0.6 + 0.4 * ao) + hemi * ao + vec3(0.9, 0.7, 0.45) * uLamp * 0.12 * ao);

        // bevel highlight on the box edges, like the voxel edges of the real city
        vec2 fa, fe;
        if (abs(n.x) > 0.5) { fa = vec2(vLocal.z + vSize.z * 0.5, vLocal.y); fe = vSize.zy; }
        else if (abs(n.z) > 0.5) { fa = vec2(vLocal.x + vSize.x * 0.5, vLocal.y); fe = vSize.xy; }
        else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float d = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.18 + fw * 0.7, d)) * 0.25;

        // night: a scatter of lit rooms, bright shop fronts, glowing signs
        if (win > 0.0) {
          float on = step(hash12(cell * vec2(1.7, 3.1) + seed * 91.0 + n.xz * 7.0), (kind == 1 && y < 3.2) ? 0.7 : 0.1 + 0.16 * uNight);
          vec3 wc = kind == 2 ? mix(uWindowColor, vec3(1.6, 1.9, 2.2), 0.5) : uWindowColor;
          col += win * on * wc * uNight * (0.3 + 0.25 * fract(seed * 13.7 + cell.y * 0.37));
        }
        if (kind == 5) col += albedo * emit * mix(uEmitDay, 2.6, uNight);
        if (kind == 2 && vSize.y < 12.0 && vPart.x > 20.0 && wall) {
          // the crown of a tower: a band of light at night
          float band = step(vSize.y - 1.2, vLocal.y) * step(vLocal.y, vSize.y - 0.5);
          col += band * mix(vec3(1.0, 0.35, 0.7), vec3(0.3, 0.9, 1.0), step(0.5, seed)) * uNight * 2.0;
        }
        outColor = vec4(farHaze(col, vWorld, uRect, uFogColor, uFog), 1.0);
      }`,
  }));
  city.frustumCulled = false;

  // streets, pavements, parks and the canal on the ground round the map, and a floor under everything
  const R = reach + 40;
  const X0 = x0 - R, Z0 = z0 - R, X1 = x1 + R, Z1 = z1 + R;
  const quads: number[][] = [
    [X0, Z0, X1, z0, 0], [X0, z1, X1, Z1, 0], [X0, z0, x0, z1, 0], [x1, z0, X1, z1, 0],
    [X0 - 300, Z0 - 300, X1 + 300, Z1 + 300, -3.1],
  ];
  const pos: number[] = [];
  for (const [a, b, c, e, y] of quads) pos.push(a, y, b, a, y, e, c, y, e, a, y, b, c, y, e, c, y, b);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
  const parkArr = new Float32Array(64);
  parkArr.set(parks.slice(0, 64));
  const gap = (i: number) => new THREE.Vector4(...(gaps[i] ?? [0, 0, 0, 0]));
  const ground = new THREE.Mesh(gg, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      ...u,
      uCanal: { value: gap(0) }, uAve0: { value: gap(1) }, uAve1: { value: gap(2) },
      uParks: { value: Array.from({ length: 32 }, (_, i) => new THREE.Vector2(parkArr[i * 2], parkArr[i * 2 + 1])) },
      uParkN: { value: Math.min(32, parks.length / 2) },
    },
    vertexShader: /* glsl */ `
      out vec3 vWorld;
      void main() { vWorld = position; gl_Position = projectionMatrix * viewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${AXIS_ROAD}
      uniform vec3 uFogColor, uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight, uLamp; uniform vec4 uFog; uniform vec4 uRect;
      uniform vec4 uCanal, uAve0, uAve1; uniform vec2 uParks[32]; uniform int uParkN;
      in vec3 vWorld;
      layout(location = 0) out vec4 outColor;
      bool inside(vec2 p, vec4 r) { return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }
      void main() {
        if (vWorld.y < -1.0) { outColor = vec4(uFogColor, 1.0); return; }
        vec2 p = vWorld.xz;
        float fw = fwidth(p.x + p.y);
        float rx = axisRoad(p.x, uRect.x, uRect.z), rz = axisRoad(p.y, uRect.y, uRect.w);
        float road = max(rx, rz);
        vec3 alb;
        float grain = hash12(floor(p * 2.0));
        float lampGlow = 0.0;
        if (inside(p, uCanal)) {
          // the canal carries on: dark water that takes the sky's colour
          float edge = min(p.y - uCanal.y, uCanal.w - p.y);
          vec3 water = mix(srgb2lin(vec3(0.16, 0.27, 0.3)), uSkyColor * 0.5, 0.35);
          vec3 stone = srgb2lin(vec3(0.62, 0.6, 0.56));
          alb = edge < 0.8 ? stone : water;
        } else if (road > 0.0 || inside(p, uAve0) || inside(p, uAve1)) {
          // asphalt with a dashed centre line; kerbs and pavement along the edge
          float t = road > 0.0 ? road : 3.0;
          alb = srgb2lin(vec3(0.33, 0.33, 0.35));
          float along = rx > rz ? p.y : p.x;
          float dash = step(abs(t - ROAD * 0.5), 0.08) * step(0.5, fract(along / 3.0)) * (1.0 - smoothstep(0.1, 0.3, fw));
          alb = mix(alb, srgb2lin(vec3(0.85, 0.83, 0.75)), dash);
          if (t < 1.2 && road > 0.0) alb = srgb2lin(vec3(0.64, 0.62, 0.58));
          // street lamps along the kerbs every 12 m
          float lp = abs(fract(along / 12.0) - 0.5) * 12.0;
          lampGlow = exp(-(lp * lp + (t - 0.6) * (t - 0.6)) * 0.45);
        } else {
          alb = srgb2lin(vec3(0.55, 0.53, 0.5));
          for (int i = 0; i < 32; i++) {
            if (i >= uParkN) break;
            vec2 q = abs(p - uParks[i]);
            if (max(q.x, q.y) < BLOCK * 0.5) { alb = srgb2lin(vec3(0.38, 0.55, 0.3)) * (0.9 + 0.2 * vnoise(p * 0.7)); break; }
          }
        }
        alb *= 1.0 + (grain - 0.5) * 0.08 * (1.0 - smoothstep(0.2, 0.5, fw));
        vec3 col = alb * (uSunColor * max(uSunDir.y, 0.0) + uSkyColor);
        col += alb * uWindowColor * lampGlow * uNight * 0.6;
        outColor = vec4(farHaze(col, vWorld, uRect, uFogColor, uFog), 1.0);
      }`,
    side: THREE.DoubleSide,
  }));
  ground.frustumCulled = false;
  ground.renderOrder = 10; // after the world, so it only fills what the voxels leave empty
  return { city, ground };
}
