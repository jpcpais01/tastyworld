import * as THREE from 'three';
import { COMMON } from './shaders';
import type { SharedUniforms } from './renderer';
import { tokyoTower } from './tokyoTower';

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
// shared haze: aerial perspective, thicker the further from the map and close to the ground, a little thinner
// higher up (the voxel city's own first-person fog is much thicker: it has to hide where loading stops)
vec3 farHaze(vec3 col, vec3 w, vec4 rect, vec3 fogColor, vec4 fog) {
  vec2 o = max(rect.xy - w.xz, w.xz - rect.zw);
  float out_ = max(0.0, max(o.x, o.y));
  float lift = mix(1.0, 0.65, smoothstep(4.0, 80.0, w.y));
  float a = (1.0 - exp(-out_ * 0.0048)) * lift;
  if (fog.w > 0.0) {
    float fd = max(0.0, distance(w, fog.xyz) - FOG_START) * fog.w * 0.3;
    a = max(a, (1.0 - exp(-fd * fd)) * lift);
  }
  // and all the way into the haze at the far edge of the city, where the ground plane ends
  a = mix(min(a, 0.8), 1.0, smoothstep(230.0, 330.0, out_));
  return mix(col, fogColor, a);
}
`;

// building parts: 0 plaster house wall, 1 shop / office block, 2 tower, 3 tile roof, 4 roof slab or
// equipment, 5 sign, 6 tree crown, 7 apartment block (balconies on its long faces); 8-10 Tokyo Tower (tokyoTower.ts)
const HOUSE = ['#ddd2bd', '#c8b39a', '#9e8670', '#b9bdc2', '#e8e2d6', '#cdbfa6', '#a7b2a6', '#d9c7b8'];
const ROOF = ['#4c5561', '#6b4d42', '#5a6559', '#3f4652', '#7a6a5c'];
const MID = ['#bcb8ae', '#d1c6b2', '#a9a19b', '#e0dbd1', '#94929a', '#c9b49c', '#b8c0c4', '#8e7f72', '#cfc9bd'];
const FLAT = ['#ecebe6', '#e6dcc6', '#cdb89a', '#9b6b55', '#b5b3ae', '#e3cfc6', '#c9d3c3', '#d8d4cc', '#a88f78'];
// towers: dark glass in a frame of the same family, or a stone / precast grid (seed above 0.6 picks stone)
const DARK = ['#3a4048', '#4a4f55', '#5b6168', '#2e353d', '#47524f'];
const STONE = ['#c9bda9', '#b0aaa0', '#d8d2c6', '#8f8a84', '#a99a88'];
const SIGN = ['#e8473a', '#f2c230', '#36c6d8', '#e85aa8', '#5bd16a', '#f08a2e'];
const TREE = ['#5c8a4a', '#4f7a43', '#6a9550', '#e9b4c4'];

/**
 * `tower` puts Tokyo Tower at that point (x, z), on a plaza with Foot Town under its legs; the blocks round it
 * are left clear.
 */
/**
 * `ring` dresses the strip of the ring road against the map: `open` keeps the road where a street of the town
 * carries on out, `green` turns it to lawn and trees where the town's woods and parks meet it, and everywhere
 * else houses stand shoulder to shoulder against the voxel town, so its edge never reads as a straight line.
 */
export interface Ring { open: Rect[]; green: Rect[] }

export function farCity(shared: SharedUniforms, rect: Rect, gaps: Rect[] = [], reach = 300, tower?: [number, number], ring?: Ring): { city: THREE.Mesh; ground: THREE.Mesh } {
  const [x0, z0, x1, z1] = rect;
  const parts: number[] = [];
  let seed = 9173;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length) % a.length];
  const col = new THREE.Color();
  /** Parts made while `keep` is set never squat in the iso view (the low trees along the ring). */
  let keep = 0;
  const part = (cx: number, cz: number, w: number, d: number, y0: number, h: number, kind: number, c: string, s = rnd()) => {
    col.set(c);
    parts.push(cx, cz, w, d, y0, h, kind, s, col.r, col.g, col.b, keep);
  };
  const outOf = (ax0: number, az0: number, ax1: number, az1: number) => Math.max(x0 - ax1, ax0 - x1, z0 - az1, az0 - z1);
  const site: Rect = tower ? [tower[0] - 52, tower[1] - 52, tower[0] + 52, tower[1] + 52] : [0, 0, 0, 0];
  const inGap = (ax0: number, az0: number, ax1: number, az1: number) =>
    [...gaps, site].some(([a, b, c, e]) => ax1 > a && ax0 < c && az1 > b && az0 < e);
  // Tokyo is a sea of low and mid-rise blocks; towers only gather in a few far-off business districts
  const CLUSTERS: [number, number, number][] = [[x1 + 210, z0 - 170, 120], [x0 - 190, z1 + 170, 95], [x0 - 230, z0 - 120, 80]];
  const cluster = (x: number, z: number) => CLUSTERS.reduce((m, [cx, cz, r]) => Math.max(m, 1 - Math.hypot(x - cx, z - cz) / r), 0);

  // flat roof furniture: parapet, water tank, stair house, a/c units, sometimes a billboard on legs
  const roof = (cx: number, cz: number, w: number, d: number, h: number, billboard: boolean) => {
    part(cx, cz, w + 0.2, d + 0.2, h, 0.45, 4, '#8d8b88');
    if (rnd() < 0.6) part(cx + (rnd() - 0.5) * (w - 3), cz + (rnd() - 0.5) * (d - 3), 2.2, 2.6, h, 2.6, 4, pick(['#cfccc4', '#b8b4ac']));
    if (rnd() < 0.55) { const t = 1.4 + rnd() * 1.2; part(cx + (rnd() - 0.5) * (w - t - 1), cz + (rnd() - 0.5) * (d - t - 1), t, t, h + 0.45, 1.4 + rnd() * 1.4, 4, '#dedcd4'); }
    if (rnd() < 0.5) part(cx + (rnd() - 0.5) * (w - 2), cz + (rnd() - 0.5) * (d - 2), 1.4, 0.9, h + 0.45, 0.8, 4, '#a9a7a0');
    if (billboard && w > 6) {
      const bw = Math.min(w - 1, 6 + rnd() * 3), along = w >= d;
      part(cx, cz, along ? 0.25 : 0.25, along ? 0.25 : 0.25, h, 1.2, 4, '#55524e');
      part(cx, cz, along ? bw : 0.3, along ? 0.3 : bw, h + 1.2, 2.6 + rnd() * 1.4, 5, pick(SIGN));
    }
  };

  const blade = (cx: number, cz: number, w: number, d: number, h: number, face: number) => {
    // a vertical sign on the street face (face: 0 -z, 2 +z)
    const sh = Math.min(h - 3.5, 3 + rnd() * 6), sy = 3.2 + rnd() * Math.max(0, h - sh - 4);
    const along = (rnd() - 0.5) * (w - 2);
    part(cx + along, face === 0 ? cz - d / 2 - 0.5 : cz + d / 2 + 0.5, 0.25, 1.0, sy, sh, 5, pick(SIGN));
  };

  const building = (lx0: number, lz0: number, lx1: number, lz1: number, k: number, c: number, face: number) => {
    const set = 0.3 + rnd() * 0.9;
    const w = lx1 - lx0 - set * 2, d = lz1 - lz0 - set * 2;
    if (w < 3 || d < 3) return;
    const cx = (lx0 + lx1) / 2, cz = (lz0 + lz1) / 2;
    const r = rnd();
    const pTower = c > 0.25 && k > 0.45 && w > 9 ? c * 0.55 : 0;
    const pHouse = Math.max(0.08, 0.62 - k * 0.7 - c * 0.5);
    if (r < pTower) {
      // a tower, as varied as real ones: slab or square, glass or stone, a set-back or none, rarely a mast
      const stone = rnd() < 0.4, ts = stone ? 0.6 + rnd() * 0.4 : rnd() * 0.6;
      const fc = stone ? pick(STONE) : pick(DARK);
      const fl = stone ? 3.4 : 3.8;
      const h = Math.round((40 + rnd() * 55 + c * c * 90) / fl) * fl;
      const ph = rnd() < 0.6 ? (1 + Math.floor(rnd() * 3)) * 3.4 : 0;
      if (ph) part(cx, cz, w, d, 0, ph, 1, pick(MID));
      const slab = rnd() < 0.4;
      const sw = w * (ph ? 0.8 : 1), sd = d * (ph ? 0.8 : 1) * (slab ? 0.55 : 1);
      let tw = sw, td = sd, top = h;
      if (h > 60 && rnd() < 0.35) {
        const sb = Math.round((h * (0.6 + rnd() * 0.2)) / fl) * fl;
        part(cx, cz, sw, sd, ph, sb - ph, 2, fc, ts);
        tw = sw * 0.78; td = sd * 0.78;
        part(cx, cz, tw, td, sb, h - sb, 2, fc, ts);
      } else part(cx, cz, sw, sd, ph, h - ph, 2, fc, ts);
      part(cx, cz, tw + 0.2, td + 0.2, top, 0.8, 4, stone ? fc : '#6c7076');
      if (rnd() < 0.6) part(cx + (rnd() - 0.5) * tw * 0.4, cz + (rnd() - 0.5) * td * 0.4, tw * 0.4, td * 0.4, top, 3 + rnd() * 2, 4, '#9a9893');
      if (rnd() < 0.15) part(cx, cz, 0.35, 0.35, top + 3, 6 + rnd() * 10, 4, '#d0d0d0');
    } else if (r < pTower + pHouse) {
      // a house: two or three floors, mostly a stepped tile roof, sometimes flat with a balcony rail
      const h = (rnd() < 0.65 ? 2 : 3) * 2.9 + 0.3;
      const hw = Math.min(w, 6 + rnd() * 5), hd = Math.min(d, 6 + rnd() * 5);
      const hx = cx + (rnd() - 0.5) * (w - hw), hz = cz + (rnd() - 0.5) * (d - hd);
      part(hx, hz, hw, hd, 0, h, 0, pick(HOUSE));
      if (rnd() < 0.75) {
        const rc = pick(ROOF), alongX = hw >= hd;
        const rw = alongX ? hw + 0.5 : hd + 0.5, rd = alongX ? hd + 0.5 : hw + 0.5;
        for (let i = 0; i < 3; i++) {
          const a = rw - i * 0.3, b = rd * (1 - i / 3);
          part(hx, hz, alongX ? a : b, alongX ? b : a, h + i * 0.5, 0.5, 3, rc);
        }
      } else part(hx, hz, hw + 0.15, hd + 0.15, h, 0.6, 4, '#9a9690');
    } else if (r < pTower + pHouse + 0.45) {
      // an apartment block: balconies down its long faces, often one floor shy of the full height at the back
      const floors = 3 + Math.floor(rnd() * (4 + k * 6 + c * 6));
      const h = floors * 2.9 + 0.6;
      const fc = pick(FLAT);
      part(cx, cz, w, d, 0, h, 7, fc);
      if (floors > 4 && rnd() < 0.35) {
        // a stepped top floor
        part(cx, cz - d * 0.15, w, d * 0.7, h, 2.9, 7, fc);
        roof(cx, cz - d * 0.15, w, d * 0.7, h + 2.9, false);
      } else roof(cx, cz, w, d, h, false);
    } else {
      // a shop or office building: ribbon windows, a bright ground floor, signs
      const floors = 3 + Math.floor(rnd() * (3 + k * 5 + c * 8));
      const h = floors * 3.4 + 0.6;
      part(cx, cz, w, d, 0, h, 1, pick(MID));
      roof(cx, cz, w, d, h, rnd() < 0.25);
      if (rnd() < 0.5) blade(cx, cz, w, d, h, face);
    }
  };

  if (tower) {
    tokyoTower(part, tower[0], tower[1]);
    // the plaza's trees: a ring of zelkovas and the odd cherry round the edge, clear of the legs
    const [tx, tz] = tower;
    for (let a = 0; a < 40; a++) {
      const t = (a / 40) * Math.PI * 2, r = 47 + rnd() * 3;
      const x = tx + Math.cos(t) * r, z = tz + Math.sin(t) * r;
      const s = 3.5 + rnd() * 2.5;
      part(x, z, 0.5, 0.5, 0, 2.4, 4, '#6b5240');
      part(x, z, s, s, 2 + rnd(), s * 0.85, 6, rnd() < 0.2 ? TREE[3] : pick(TREE.slice(0, 3)));
    }
  }

  // park blocks (centres), for the ground shader to green
  const parks: number[] = [];
  const xs = intervals(x0, x1, reach), zs = intervals(z0, z1, reach);
  for (const [bz0, bz1] of zs)
    for (const [bx0, bx1] of xs) {
      const out = outOf(bx0, bz0, bx1, bz1);
      if (out < RING - 0.01) continue;
      const k = Math.min(1, out / 220);
      const ne = cluster((bx0 + bx1) / 2, (bz0 + bz1) / 2);
      if (rnd() < 0.06 && out > 20 && parks.length < 64 && !inGap(bx0, bz0, bx1, bz1)) {
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
  if (ring) {
    const hit = (rs: Rect[], ax0: number, az0: number, ax1: number, az1: number) => rs.some(([a, b, c, e]) => ax1 > a && ax0 < c && az1 > b && az0 < e);
    const lot = (lx0: number, lz0: number, lx1: number, lz1: number, face: number) => {
      if (hit(ring.open, lx0, lz0, lx1, lz1) || inGap(lx0, lz0, lx1, lz1)) return;
      if (hit(ring.green, lx0, lz0, lx1, lz1)) {
        // the wood or the park carries on: a tree or two on the lawn, full height even in the iso view, as low
        // as the town's own trees beside them
        keep = 1;
        for (let i = 0; i < 2; i++) {
          const sz = 2.6 + rnd() * 1.8, tx = lx0 + 1 + rnd() * (lx1 - lx0 - 2), tz = lz0 + 1 + rnd() * (lz1 - lz0 - 2);
          const y = 1.8 + rnd() * 0.8, leaf = rnd() < 0.08 ? TREE[3] : pick(TREE.slice(0, 3));
          part(tx, tz, 0.5, 0.5, 0, y + 0.3, 4, '#6b5240');
          // a crown stepped in like the town's voxel trees: a broad tier and a narrower one on top
          part(tx, tz, sz, sz, y, sz * 0.55, 6, leaf);
          part(tx + (rnd() - 0.5) * 0.6, tz + (rnd() - 0.5) * 0.6, sz * 0.62, sz * 0.62, y + sz * 0.55, sz * 0.4, 6, leaf);
        }
        keep = 0;
        return;
      }
      building(lx0, lz0, lx1, lz1, 0, 0, face);
    };
    // lots of 5 to 9 m along each side of the ring, the corners taken by the east and west runs
    const run = (a0: number, a1: number, place: (s: number, e: number) => void) => {
      for (let a = a0; a < a1 - 2;) { const e = Math.min(a1, a + 5 + rnd() * 4); place(a, a1 - e < 4 ? a1 : e); a = a1 - e < 4 ? a1 : e; }
    };
    run(z0 - RING, z1 + RING, (a, e) => lot(x0 - RING, a, x0, e, 0));
    run(z0 - RING, z1 + RING, (a, e) => lot(x1, a, x1 + RING, e, 0));
    run(x0, x1, (a, e) => lot(a, z1, e, z1 + RING, 0));
    run(x0, x1, (a, e) => lot(a, z0 - RING, e, z0, 2));
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
  g.setAttribute('aKeep', new THREE.InterleavedBufferAttribute(ib, 1, 11));
  g.instanceCount = n;

  const mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
  const u = {
    uFogColor: shared.uFogColor, uSkyColor: shared.uSkyColor, uGroundColor: shared.uGroundColor, uSunColor: shared.uSunColor,
    uSunDir: shared.uSunDir, uWindowColor: shared.uWindowColor, uNight: shared.uNight, uLamp: shared.uLamp, uEmitDay: shared.uEmitDay,
    uFog: shared.uFog, uCamFwd: shared.uCamFwd,
    uRect: { value: new THREE.Vector4(x0, z0, x1, z1) }, uMid: { value: new THREE.Vector2(mx, mz) },
    uTime: shared.uTime, uSite: { value: new THREE.Vector4(...site) },
  };
  const city = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: u,
    vertexShader: /* glsl */ `
      in vec4 aBox; in vec4 aPart; in vec3 aCol; in float aKeep;
      uniform vec3 uCamFwd; uniform vec2 uMid;
      out vec3 vWorld; out vec3 vN; out vec3 vLocal; out vec3 vSize; out vec4 vPart; out vec3 vCol;
      void main() {
        float y0 = aPart.x, h = aPart.y, s = 1.0;
        // iso view: blocks between the camera and the map squat down so they never hide the streets
        if (projectionMatrix[3][3] == 1.0 && aKeep < 0.5) {
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
      uniform float uNight, uLamp, uEmitDay, uTime; uniform vec4 uFog; uniform vec4 uRect;
      in vec3 vWorld; in vec3 vN; in vec3 vLocal; in vec3 vSize; in vec4 vPart; in vec3 vCol;
      layout(location = 0) out vec4 outColor;
      // window mask in a cell of (period u, floor height), fading to its average where it would shimmer
      float grid(float u, float y, float pu, float fh, vec4 r, out vec2 cell) {
        cell = vec2(floor(u / pu), floor(y / fh));
        vec2 f = vec2(fract(u / pu), fract(y / fh));
        // each axis fades to its average on its own, so floor lines survive further out than the columns
        vec2 aa = smoothstep(vec2(0.3), vec2(0.7), vec2(fwidth(u) / pu, fwidth(y) / fh) * 1.6);
        float mx = mix(step(r.x, f.x) * step(f.x, r.y), r.y - r.x, aa.x);
        float my = mix(step(r.z, f.y) * step(f.y, r.w), r.w - r.z, aa.y);
        return mx * my;
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
            // a stone or precast grid with punched windows, or a curtain wall of dark tinted glass in a frame of
            // the same family that mirrors a little of the sky
            bool stone = seed > 0.6;
            win = stone ? grid(u, y, 2.0, 3.4, vec4(0.2, 0.8, 0.28, 0.86), cell) : grid(u, y, 1.5, 3.8, vec4(0.04, 0.96, 0.2, 0.97), cell);
            vec3 tint = mix(vec3(0.05, 0.07, 0.09), vec3(0.08, 0.1, 0.09), fract(seed * 7.3));
            float up = smoothstep(0.0, 160.0, vWorld.y);
            vec3 refl = tint + uSkyColor * mix(0.07, 0.17, up) + uFogColor * 0.05;
            // the odd floor with blinds drawn or lights on by day, so faces aren't uniform
            refl *= 0.88 + 0.24 * hash12(cell * vec2(0.37, 1.0) + seed * 53.0);
            albedo = mix(albedo, refl, win);
          } else if (kind == 7) {
            // apartment block: the long faces carry a balcony slab and rail at every floor with sliding doors
            // behind; the ends have a few small windows
            float faceLen = abs(n.x) > 0.5 ? vSize.z : vSize.x, other = abs(n.x) > 0.5 ? vSize.x : vSize.z;
            float fy = fract(y / 2.9);
            if (faceLen >= other) {
              win = grid(u, y, 3.4, 2.9, vec4(0.08, 0.92, 0.42, 0.95), cell);
              float aa = smoothstep(0.3, 0.7, fwidth(y) / 2.9 * 1.6);
              float rail = mix(step(fy, 0.36), 0.36, aa), lip = mix(step(0.36, fy) * step(fy, 0.42), 0.06, aa);
              albedo = mix(albedo, glass * 0.55 + vec3(0.015), win * (1.0 - rail));
              albedo = mix(albedo, min(albedo * 1.12 + 0.04, vec3(1.0)), rail);
              albedo *= 1.0 - 0.45 * lip;
              win *= 1.0 - rail;
            } else {
              win = grid(u + 0.7, y, 2.6, 2.9, vec4(0.35, 0.65, 0.45, 0.8), cell);
              albedo = mix(albedo, glass * 0.6 + vec3(0.02), win);
            }
          } else if (kind == 9) {
            // Tokyo Tower's observation decks: tall panes in white mullions that mirror the sky, lit warm at night
            win = grid(u, y, 2.4, 100.0, vec4(0.12, 0.88, -1.0, 2.0), cell);
            vec3 refl = vec3(0.04, 0.06, 0.08) + uSkyColor * 0.22 + uFogColor * 0.06;
            albedo = mix(srgb2lin(vec3(0.9, 0.89, 0.86)), refl, win);
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
        float glassy = (kind == 2 || kind == 9) && wall ? win : 0.0;
        if (kind == 1 || kind == 2) { if (n.y > 0.5) albedo = srgb2lin(vec3(0.55, 0.55, 0.54)) * (0.9 + 0.1 * g); }
        if (kind == 6) albedo *= 0.85 + 0.3 * hash12(floor(vWorld.xz * 1.5) + floor(vWorld.y * 1.5) * 7.0);

        // light like the city: hemisphere sky, sun, darker at the foot of walls
        float ndl = max(dot(n, uSunDir), 0.0);
        float ao = wall ? mix(0.55, 1.0, smoothstep(0.0, 2.5, vWorld.y)) : 1.0;
        if (kind == 3 || kind == 4) ao *= 0.9;
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = albedo * (uSunColor * ndl * (0.6 + 0.4 * ao) + hemi * ao + vec3(0.9, 0.7, 0.45) * uLamp * 0.12 * ao);
        // glass shows the sky it reflects rather than the light falling on it, with a glint on the sunny side
        col = mix(col, albedo * (vec3(1.0) + uSunColor * ndl * 0.6), glassy);
        
        // bevel highlight on the box edges, like the voxel edges of the real city
        vec2 fa, fe;
        if (abs(n.x) > 0.5) { fa = vec2(vLocal.z + vSize.z * 0.5, vLocal.y); fe = vSize.zy; }
        else if (abs(n.z) > 0.5) { fa = vec2(vLocal.x + vSize.x * 0.5, vLocal.y); fe = vSize.xy; }
        else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float d = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.18 + fw * 0.7, d)) * 0.25;

        // night: a scatter of lit rooms, bright shop fronts, glowing signs
        if (win > 0.0) {
          float on = step(hash12(cell * vec2(1.7, 3.1) + seed * 91.0 + n.xz * 7.0), (kind == 1 && y < 3.2) ? 0.7 : kind == 2 ? 0.06 + 0.12 * uNight : 0.1 + 0.16 * uNight);
          vec3 wc = kind == 2 ? mix(uWindowColor, vec3(1.5, 1.7, 1.9), 0.3 * step(0.5, fract(seed * 31.0))) : uWindowColor;
          col += win * on * wc * uNight * (0.3 + 0.25 * fract(seed * 13.7 + cell.y * 0.37));
        }
        if (kind == 5) col += albedo * emit * mix(uEmitDay, 2.6, uNight);
        vec3 glow = vec3(0.0);
        if (kind == 8) {
          // the Landmark Light: floodlights from the foot and the decks wash the whole lattice amber-orange after
          // dark, brightest low down and under the decks, the white bands glowing gold
          float up = vWorld.y;
          float flood = 0.55 + 0.45 * exp(-up / 60.0) + 0.35 * exp(-abs(up - 140.0) / 14.0) + 0.3 * exp(-abs(up - 245.0) / 10.0);
          glow = mix(vec3(1.0, 0.42, 0.1), vec3(1.0, 0.62, 0.25), step(0.6, vCol.g)) * flood * uNight * 0.9;
        } else if (kind == 9) {
          glow = win * uWindowColor * uNight * 0.9 + (1.0 - win) * vec3(1.0, 0.8, 0.55) * uNight * 0.15;
        } else if (kind == 10) {
          // aviation lights: a slow red pulse, the tip a little brighter
          float b = 0.25 + 0.75 * smoothstep(0.55, 1.0, sin((uTime * 0.5 + seed) * 6.2832) * 0.5 + 0.5);
          glow = vec3(1.0, 0.08, 0.04) * b * mix(0.8, 3.5, uNight);
        }
        // the tower is the one landmark that has to read from anywhere in the city: half the haze on its
        // international orange, and its lights carry through further still
        float haze = farHaze(vec3(0.0), vWorld, uRect, vec3(1.0), uFog).x * (kind >= 8 ? 0.5 : 1.0);
        col = mix(col, uFogColor, haze) + glow * (1.0 - 0.6 * haze);
        outColor = vec4(col, 1.0);
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
      uGreen: { value: Array.from({ length: 8 }, (_, i) => new THREE.Vector4(...(ring?.green[i] ?? [0, 0, 0, 0]))) },
      uOpen: { value: Array.from({ length: 12 }, (_, i) => new THREE.Vector4(...(ring?.open[i] ?? [0, 0, 0, 0]))) },
      uRing: { value: ring ? 1 : 0 },
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
      uniform vec4 uCanal, uAve0, uAve1, uSite; uniform vec2 uParks[32]; uniform int uParkN;
      uniform vec4 uGreen[8]; uniform vec4 uOpen[12]; uniform int uRing;
      in vec3 vWorld;
      layout(location = 0) out vec4 outColor;
      bool inside(vec2 p, vec4 r) { return p.x > r.x && p.x < r.z && p.y > r.y && p.y < r.w; }
      // within the ring road round the map
      bool inRing(vec2 p) {
        vec2 o = max(uRect.xy - p, p - uRect.zw);
        float d = max(o.x, o.y);
        return d > 0.0 && d < RING;
      }
      bool ringGreen(vec2 p) {
        if (!inRing(p)) return false;
        for (int i = 0; i < 12; i++) if (inside(p, uOpen[i])) return false;
        for (int i = 0; i < 8; i++) if (inside(p, uGreen[i])) return true;
        return false;
      }
      bool ringShut(vec2 p) {
        if (!inRing(p)) return false;
        for (int i = 0; i < 12; i++) if (inside(p, uOpen[i])) return false;
        return true;
      }
      void main() {
        if (vWorld.y < -1.0) { outColor = vec4(uFogColor, 1.0); return; }
        vec2 p = vWorld.xz;
        float fw = fwidth(p.x + p.y);
        float rx = axisRoad(p.x, uRect.x, uRect.z), rz = axisRoad(p.y, uRect.y, uRect.w);
        float road = max(rx, rz);
        vec3 alb;
        float grain = hash12(floor(p * 2.0));
        float lampGlow = 0.0;
        if (inside(p, uSite)) {
          // the tower's plaza: pale granite setts in a grid, a lawn ring round the edge under the trees
          vec2 c = p - (uSite.xy + uSite.zw) * 0.5;
          float r = length(c);
          vec2 g = abs(fract(p / 4.0) - 0.5);
          alb = srgb2lin(vec3(0.68, 0.66, 0.62)) * (1.0 - 0.12 * step(0.46, max(g.x, g.y)) * (1.0 - smoothstep(0.1, 0.3, fw)));
          if (r > 44.0) alb = srgb2lin(vec3(0.38, 0.55, 0.3)) * (0.9 + 0.2 * vnoise(p * 0.7));
          lampGlow = 0.6 * exp(-pow(r - 30.0, 2.0) * 0.02);
        } else if (inside(p, uCanal)) {
          // the canal carries on: dark water that takes the sky's colour
          float edge = min(p.y - uCanal.y, uCanal.w - p.y);
          vec3 water = mix(srgb2lin(vec3(0.16, 0.27, 0.3)), uSkyColor * 0.5, 0.35);
          vec3 stone = srgb2lin(vec3(0.62, 0.6, 0.56));
          alb = edge < 0.8 ? stone : water;
        } else if (uRing == 1 && ringGreen(p)) {
          // the hill's wood and the park run on past the edge of the town
          alb = srgb2lin(vec3(0.38, 0.55, 0.3)) * (0.85 + 0.25 * vnoise(p * 0.7));
        } else if (uRing == 1 && ringShut(p)) {
          // houses stand along the ring here: the pavement in front of and between them
          alb = srgb2lin(vec3(0.6, 0.58, 0.54));
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
