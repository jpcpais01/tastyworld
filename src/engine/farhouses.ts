import * as THREE from 'three';
import { COMMON } from './shaders';

/**
 * The villages past the edge of the Amalfi map, built on the same rules as the town's own houses so the two read as
 * one place: walls in the town's stucco colours, a floor every three metres, bays of three-voxel windows with green
 * or blue shutters folded back (or shut) and a sill under each, the door in the middle of the front, a white
 * cornice; balconies with iron rails and geraniums on the upper floors; barrel vaults, little domes, tiled hip roofs
 * or terraces with a parapet, a pergola or a setback room on top. Everything sits on the 0.25 m voxel grid, and the
 * shader paints the facades voxel by voxel.
 *
 * Each house is a handful of boxes (a body and its roof parts, balconies, poles), all instances of one cube in a
 * single draw. Balconies, rails, poles and pergolas drop out a few hundred metres off; the parapets and the upper
 * layers of the roofs a little further.
 */

/** A house site: middle, footprint, ground at its lowest and highest corner, which side faces downhill, a seed. */
export interface FarLot { x: number; z: number; w: number; d: number; lo: number; hi: number; front: number; seed: number }
/** A bell tower: where it stands, the ground there, its height and its stucco. */
export interface FarTower { x: number; z: number; ground: number; h: number; color: number }

const Q = 0.25;
const snap = (v: number) => Math.round(v / Q) * Q;

/** Part kinds (the shader's switch). */
const enum P { Body, Parapet, Vault, Dome, Slab, Rail, Pergola, Pole, Hip, Tower, BodyWhite, Majolica, Stone }

/** The town's stucco (sRGB), weighted as amalfi.ts PASTELS weights them. */
const WALLS = [0xf2eee6, 0xf2eee6, 0xefe6d6, 0xf0e2c2, 0xf0e2c2, 0xf0d68a, 0xf2dc6a, 0xe0ae66, 0xefc4a2, 0xe8b2a6, 0xd9917f, 0xc47a58, 0xbfd2d8, 0xc9d1b4, 0xd9cbb0];
const TRIMS = [0xf2eee6, 0xf2eee6, 0xe2dccf];

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/** A stone box laid on the ground (a path's tread or step): corners (m) and colour. */
export type FarStone = [number, number, number, number, number, number, number];

export function farHouses(uniforms: Record<string, THREE.IUniform>, SQUASH: string, HAZE: string, lots: FarLot[], towers: FarTower[], stones: FarStone[] = []): THREE.Mesh {
  const parts: number[] = [];
  // one box: corners (m), kind, colour, how soon it drops out (0 never, 1 near detail, 2 middle), and the house it
  // belongs to (its front ground level, which side is its front, a seed for its shutters, its own seed)
  let house: [number, number, number, number] = [0, 0, 0, 0];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: P, color: number, lod = 0) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) return;
    const [r, g, b] = rgb(color);
    parts.push((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y0, y1 - y0, house[3], kind, r, g, b, lod, ...house);
  };

  for (const lt of lots) {
    let seed = (lt.seed * 7919) % 2147483647 || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const x0 = snap(lt.x - lt.w / 2), x1 = x0 + Math.max(4 * Q * 4, snap(lt.w));
    const z0 = snap(lt.z - lt.d / 2), z1 = z0 + Math.max(4 * Q * 4, snap(lt.d));
    const w = x1 - x0, d = z1 - z0;
    // the house stands level with the ground on its uphill side; downhill it sits on a dry-stone terrace wall that
    // carries a little terrace out in front of its door, as every house on these slopes does
    const gy = snap(Math.max(lt.lo, lt.hi - 3));
    const floors = 2 + Math.floor(rnd() * 1.8);
    const top = gy + floors * 3;
    house = [gy, lt.front, rnd(), rnd()];
    const wall = WALLS[Math.floor(rnd() * WALLS.length)], trim = TRIMS[Math.floor(rnd() * TRIMS.length)];
    const roof = rnd();
    const flat = roof >= 0.58;
    // (a hair wider or narrower per house, so two neighbours' walls on the same grid line never flicker)
    const e = 0.004 + house[3] * 0.012;
    if (gy - lt.lo > 0.2) {
      const tx0 = x0 - (lt.front === 1 ? 2 : 0), tx1 = x1 + (lt.front === 0 ? 2 : 0), tz0 = z0 - (lt.front === 3 ? 2 : 0), tz1 = z1 + (lt.front === 2 ? 2 : 0);
      box(tx0 - e * 2, snap(lt.lo) - 1.5, tz0 - e * 2, tx1 + e * 2, gy, tz1 + e * 2, P.Stone, 0xb9b09e);
      if (lt.front === 0) box(x1 + 2 - Q, gy, z0, x1 + 2, gy + 0.75, z1, P.Parapet, trim, 2);
      else if (lt.front === 1) box(x0 - 2, gy, z0, x0 - 2 + Q, gy + 0.75, z1, P.Parapet, trim, 2);
      else if (lt.front === 2) box(x0, gy, z1 + 2 - Q, x1, gy + 0.75, z1 + 2, P.Parapet, trim, 2);
      else box(x0, gy, z0 - 2, x1, gy + 0.75, z0 - 2 + Q, P.Parapet, trim, 2);
    }
    box(x0 - e, gy - 0.5, z0 - e, x1 + e, top, z1 + e, flat || (roof >= 0.33 && roof < 0.43) ? P.Body : P.BodyWhite, wall);

    // balconies on the front, upper floors, on the shader's own window bays
    const alongZ = lt.front < 2, fw = alongZ ? d : w;
    const nU = Math.round(fw / Q), nb = Math.max(1, Math.floor(fw / 1.9)), pitch = nU / nb;
    for (let fl = 1; fl < floors; fl++)
      for (let k = 0; k < nb; k++) {
        if (rnd() >= 0.3) continue;
        const cv = Math.floor((k + 0.5) * pitch);
        const ua = (cv - 2) * Q, ub = (cv + 3) * Q;
        const yb = gy + fl * 3;
        // the face's u runs from the corner the shader starts from (see main() below)
        let bx0: number, bx1: number, bz0: number, bz1: number;
        if (lt.front === 0) { bx0 = x1; bx1 = x1 + 0.5; bz0 = z0 + ua; bz1 = z0 + ub; }
        else if (lt.front === 1) { bx0 = x0 - 0.5; bx1 = x0; bz0 = z1 - ub; bz1 = z1 - ua; }
        else if (lt.front === 2) { bz0 = z1; bz1 = z1 + 0.5; bx0 = x1 - ub; bx1 = x1 - ua; }
        else { bz0 = z0 - 0.5; bz1 = z0; bx0 = x0 + ua; bx1 = x0 + ub; }
        box(bx0, yb + 2 * Q, bz0, bx1, yb + 3 * Q, bz1, P.Slab, 0xe2dccf, 1);
        box(bx0, yb + 3 * Q, bz0, bx1, yb + 7 * Q, bz1, P.Rail, 0x2b2a2a, 1);
      }

    if (roof < 0.33) {
      // white barrel vault across the short side, in three courses
      const span = Math.min(w, d), hv = Math.max(0.75, snap(span * 0.275));
      const ls = [1, 0.78, 0.48], th = snap(hv / 3) || Q;
      for (let i = 0; i < 3; i++) {
        const half = snap((span * ls[i]) / 2);
        if (w >= d) box(x0, top + i * th, (z0 + z1) / 2 - half, x1, top + (i + 1) * th, (z0 + z1) / 2 + half, P.Vault, 0xf4f1ea, i ? 2 : 0);
        else box((x0 + x1) / 2 - half, top + i * th, z0, (x0 + x1) / 2 + half, top + (i + 1) * th, z1, P.Vault, 0xf4f1ea, i ? 2 : 0);
      }
    } else if (roof < 0.43 && Math.min(w, d) >= 4) {
      // a little dome on the terrace
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, rr = Math.min(w, d) / 2 - 0.75;
      [1, 0.72, 0.4].forEach((f, i) => { const h = snap(rr * f); box(cx - h, top + i * 0.5, cz - h, cx + h, top + (i + 1) * 0.5, cz + h, P.Dome, 0xf4f1ea, i ? 2 : 0); });
    } else if (roof < 0.58) {
      // tiled hip roof, stepping in
      const m = Math.min(w, d) / 6;
      for (let i = 0; i < 3; i++) { const s = snap(m * i); box(x0 + s, top + i * snap(m), z0 + s, x1 - s, top + (i + 1) * snap(m), z1 - s, P.Hip, 0xb5603f, i ? 2 : 0); }
    } else {
      // a terrace with a parapet; a room set back on the uphill half, or a pergola, or nothing but pots and air
      box(x0, top, z0, x1, top + 0.75, z0 + Q, P.Parapet, trim, 2);
      box(x0, top, z1 - Q, x1, top + 0.75, z1, P.Parapet, trim, 2);
      box(x0, top, z0 + Q, x0 + Q, top + 0.75, z1 - Q, P.Parapet, trim, 2);
      box(x1 - Q, top, z0 + Q, x1, top + 0.75, z1 - Q, P.Parapet, trim, 2);
      const extra = rnd();
      if (extra < 0.3 && floors >= 3) {
        const hx = snap(w / 2), hz = snap(d / 2);
        if (lt.front === 0) box(x0, top, z0, x0 + hx, top + 3, z1, P.BodyWhite, wall);
        else if (lt.front === 1) box(x1 - hx, top, z0, x1, top + 3, z1, P.BodyWhite, wall);
        else if (lt.front === 2) box(x0, top, z0, x1, top + 3, z0 + hz, P.BodyWhite, wall);
        else box(x0, top, z1 - hz, x1, top + 3, z1, P.BodyWhite, wall);
      } else if (extra < 0.72 && w >= 3 && d >= 3) {
        const px0 = x0 + 0.5, px1 = x1 - 0.5, pz0 = z0 + 0.5, pz1 = z1 - 0.5;
        box(px0, top + 2.25, pz0, px1, top + 2.5, pz1, P.Pergola, rnd() < 0.4 ? 0xd2368c : 0x3f6e2e, 1);
        for (const [px, pz] of [[px0, pz0], [px1 - Q, pz0], [px0, pz1 - Q], [px1 - Q, pz1 - Q]]) box(px, top, pz, px + Q, top + 2.25, pz + Q, P.Pole, 0x6e5a44, 1);
      }
    }
  }
  // bell towers, with their majolica domes
  for (const t of towers) {
    house = [snap(t.ground), 0, 0.5, 0.37];
    const x0 = snap(t.x - 1.75), z0 = snap(t.z - 1.75), s = 3.5, top = snap(t.ground + t.h);
    box(x0, t.ground - 1, z0, x0 + s, top, z0 + s, P.Tower, t.color);
    [1, 0.7, 0.42].forEach((f, i) => { const h = snap((s * f) / 2); box(x0 + s / 2 - h, top + i * 0.75, z0 + s / 2 - h, x0 + s / 2 + h, top + (i + 1) * 0.75, z0 + s / 2 + h, P.Majolica, 0x2f8a5a); });
  }

  // the paths' treads and steps
  house = [0, 0, 0, 0.5];
  for (const [ax, ay, az, bx, by, bz, c] of stones) box(ax, ay, az, bx, by, bz, P.Slab, c, 2);

  const n = parts.length / 16;
  const g = new THREE.InstancedBufferGeometry();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  cube.translate(0, 0.5, 0);
  g.index = cube.index;
  g.setAttribute('position', cube.attributes.position);
  g.setAttribute('normal', cube.attributes.normal);
  const ib = new THREE.InstancedInterleavedBuffer(new Float32Array(parts), 16);
  g.setAttribute('aBox', new THREE.InterleavedBufferAttribute(ib, 4, 0));
  g.setAttribute('aPart', new THREE.InterleavedBufferAttribute(ib, 4, 4));
  g.setAttribute('aCol', new THREE.InterleavedBufferAttribute(ib, 4, 8));
  g.setAttribute('aHouse', new THREE.InterleavedBufferAttribute(ib, 4, 12));
  g.instanceCount = n;
  const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms,
    vertexShader: /* glsl */ `
      in vec4 aBox; in vec4 aPart; in vec4 aCol; in vec4 aHouse;
      ${SQUASH}
      out vec3 vWorld; out vec3 vLocal; flat out vec3 vSize; flat out vec4 vPart; flat out vec4 vCol; flat out vec4 vHouse; flat out vec3 vN;
      void main() {
        float y0 = aPart.x, h = aPart.y;
        vLocal = vec3(position.x * aBox.z, position.y * h, position.z * aBox.w);
        vec3 p = vec3(aBox.x + vLocal.x, y0 + vLocal.y, aBox.y + vLocal.z);
        vWorld = p; vN = normal; vSize = vec3(aBox.z, h, aBox.w); vPart = aPart; vCol = aCol; vHouse = aHouse;
        // a house on squatted ground would be a painted rug: past a point it simply isn't drawn
        float s = squash(aBox.xy);
        // the small parts drop out with distance (from the eye; in the iso view, from the map's edge)
        float lod = aCol.w, far = 0.0;
        if (lod > 0.5) {
          vec2 o = max(uRect.xy - p.xz, p.xz - uRect.zw);
          far = projectionMatrix[3][3] == 1.0 ? max(0.0, max(o.x, o.y)) * 2.5 : distance(cameraPosition, p);
        }
        if (s < 0.6 || far > (lod > 1.5 ? 700.0 : 300.0)) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
        p.y *= s;
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      ${HAZE}
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir, uWindowColor;
      uniform float uNight;
      in vec3 vWorld; in vec3 vLocal; flat in vec3 vSize; flat in vec4 vPart; flat in vec4 vCol; flat in vec4 vHouse; flat in vec3 vN;
      layout(location = 0) out vec4 outColor;
      const float Q = 0.25;
      vec3 S(float r, float g, float b) { return srgb2lin(vec3(r, g, b) / 255.0); }
      void main() {
        vec3 n = vN;
        int kind = int(vPart.w + 0.5);
        float hseed = vHouse.w;
        // where on the face: u runs along it (from the corner farhouses.ts counts balconies from), y up it
        int face = n.y > 0.5 ? 4 : n.y < -0.5 ? 5 : n.x > 0.5 ? 0 : n.x < -0.5 ? 1 : n.z > 0.5 ? 2 : 3;
        float u = face == 0 ? vLocal.z + vSize.z * 0.5 : face == 1 ? vSize.z * 0.5 - vLocal.z : face == 2 ? vSize.x * 0.5 - vLocal.x : vLocal.x + vSize.x * 0.5;
        float fw = face < 2 ? vSize.z : vSize.x;
        bool wall = face < 4;
        // voxel coordinates on the face (or across the top), and where in its voxel this pixel is
        vec2 fc = wall ? vec2(u, vWorld.y - vHouse.x) / Q : vWorld.xz / Q;
        vec2 vc = floor(fc + 0.001), fr = fc - vc;
        float fwPx = fwidth(fc.x) + fwidth(fc.y);
        float fine = 1.0 - smoothstep(0.35, 1.2, fwPx);
        vec3 alb = srgb2lin(vCol.rgb);
        float tint = hash12(vc + float(face) * 17.3 + hseed * 91.0);
        float glow = 0.0;
        bool glass = false;

        if (kind == 0 || kind == 10 || kind == 9) {
          if (wall) {
            float topV = floor((vPart.x + vSize.y - vHouse.x) / Q + 0.5);
            float yv = vc.y, rt = topV - 1.0 - yv;
            float fl = floor(yv / 12.0), r = yv - fl * 12.0;
            float nU = floor(fw / Q + 0.5), uv = vc.x;
            float nb = max(1.0, floor(fw / 1.9)), pitch = nU / nb;
            float k = floor(uv / pitch), cv = floor((k + 0.5) * pitch), du = uv - cv;
            bool front = face == int(vHouse.y + 0.5);
            vec2 win = vec2(k, fl) + hseed * 53.0 + float(face) * 7.0;
            float shutSel = vHouse.z;
            vec3 shutter = shutSel < 0.55 ? S(61.0, 107.0, 75.0) : shutSel < 0.7 ? S(46.0, 85.0, 65.0) : shutSel < 0.85 ? S(79.0, 111.0, 134.0) : S(110.0, 74.0, 50.0);
            alb *= 0.96 + 0.08 * tint;
            if (kind == 9) {
              // a bell tower: arched openings for the bells under the dome, a clock face below
              if (rt >= 3.0 && rt <= 10.0 && abs(uv - nU * 0.5 + 0.5) <= 2.0 && !(rt == 10.0 && abs(uv - nU * 0.5 + 0.5) == 2.0)) alb = S(28.0, 26.0, 26.0);
              else if (rt >= 15.0 && rt <= 18.0 && abs(uv - nU * 0.5 + 0.5) <= 1.5) alb = S(242.0, 238.0, 230.0);
              if (rt == 0.0 || rt == 12.0) alb = S(242.0, 238.0, 230.0);
            } else if (rt == 0.0) {
              alb = S(242.0, 238.0, 230.0); // cornice
            } else if (yv >= 0.0 && yv < 2.0) {
              alb = mix(alb, S(158.0, 150.0, 138.0), 0.75); // plinth
            } else if (front && fl == 0.0 && k == floor(nb * 0.5) && du >= -1.0 && du <= 1.0 && r < 10.0 && !(r == 9.0 && du != 0.0)) {
              // the front door, a little arch over it
              alb = hash12(vec2(hseed * 13.0, 1.0)) < 0.5 ? S(90.0, 58.0, 38.0) : S(49.0, 80.0, 60.0);
              if (r < 9.0 && du == 0.0 && r > 0.0) alb *= 0.8;
            } else if (fw >= 1.9 && rt >= 4.0 && yv >= 0.0) {
              bool closed = hash12(win) < 0.22;
              if (abs(du) <= 1.0 && r >= 3.0 && r <= 8.0) {
                if (closed) alb = (mod(yv, 2.0) < 1.0 ? shutter : shutter * 0.8);
                else { glass = true; alb = S(61.0, 76.0, 88.0) * (r == 8.0 ? 0.6 : 1.0); glow = step(hash12(win * 1.37 + 3.0), 0.35); }
              } else if (!closed && abs(du) == 2.0 && r >= 3.0 && r <= 8.0) {
                alb = mod(yv, 2.0) < 1.0 ? shutter : shutter * 0.82;
              } else if (abs(du) <= 1.0 && r == 2.0) {
                alb = S(226.0, 220.0, 207.0); // sill
              }
            }
            // quoins up the corners of the taller houses, a terracotta downpipe at a front corner
            if (kind != 9 && hseed > 0.6 && topV > 40.0 && (uv <= 1.0 || uv >= nU - 2.0) && mod(floor(yv / 2.0) + (uv <= 1.0 ? 0.0 : 1.0), 2.0) < 1.0 && rt > 0.0) alb = S(221.0, 211.0, 191.0);
            if (kind != 9 && front && hseed < 0.55 && uv == nU - 2.0 && rt > 0.0) alb = S(196.0, 122.0, 88.0);
            // the foot of a wall is in shade
            alb *= mix(0.72, 1.0, smoothstep(0.0, 8.0, yv));
          } else {
            // a terrace of tiles in their joints, or whitewash
            alb = kind == 10 ? S(244.0, 241.0, 234.0) : S(197.0, 138.0, 100.0);
            alb *= 0.93 + 0.1 * tint;
            if (kind == 0) alb *= mix(1.0, 0.82, step(fr.x, 0.08) + step(fr.y, 0.08) > 0.0 ? fine : 0.0);
          }
        } else if (kind == 1 || kind == 2 || kind == 3 || kind == 4) {
          alb *= 0.95 + 0.07 * tint;
          if (kind == 1 && n.y > 0.5) alb *= 1.04; // the parapet's coping
        } else if (kind == 12) {
          // a terrace wall of dry stone: courses of grey limestone blocks, their joints in shadow
          vec2 st = wall ? vec2(u / 0.75 + floor(vWorld.y / 0.5) * 0.5, vWorld.y / 0.5) : vWorld.xz / 0.75;
          float joint = max(step(fract(st.x), 0.1), step(fract(st.y), 0.14)) * fine;
          alb *= (0.86 + 0.24 * hash12(floor(st) + hseed * 9.0)) * (1.0 - joint * 0.35);
          if (!wall) alb = mix(alb, S(196.0, 140.0, 104.0), 0.6); // the terrace's tiles
        } else if (kind == 8) {
          alb = mod(vc.x + vc.y, 2.0) < 1.0 ? S(181.0, 96.0, 63.0) : S(156.0, 79.0, 51.0);
          alb *= 0.94 + 0.1 * tint;
        } else if (kind == 11) {
          alb = mod(vc.x + vc.y, 2.0) < 1.0 ? S(47.0, 138.0, 90.0) : S(233.0, 194.0, 58.0);
        } else if (kind == 5) {
          // the rail: bars every other voxel under a top rail, pots of geraniums inside
          if (wall) {
            float row = floor((vWorld.y - vPart.x) / Q + 0.001);
            bool bar = row >= 3.0 || mod(vc.x, 2.0) < 1.0;
            if (!bar) {
              if (row == 0.0 && hash12(vc + hseed * 7.0) < 0.55) alb = hash12(vc + 2.0) < 0.55 ? S(216.0, 58.0, 58.0) : S(63.0, 110.0, 46.0);
              else discard;
            }
          } else if (n.y > 0.5) {
            vec2 lp = abs(vLocal.xz) - vSize.xz * 0.5 + Q;
            if (max(lp.x, lp.y) < 0.0) discard;
          } else discard;
        } else if (kind == 6) {
          // the pergola: chestnut beams every five voxels, leaves or bougainvillea on them, sky through the gaps
          vec2 wc = floor(vWorld.xz / Q + 0.001);
          bool beam = mod(wc.x, 5.0) < 1.0 || mod(wc.y, 5.0) < 1.0;
          float h = hash12(wc + 11.0);
          if (beam) alb = S(110.0, 90.0, 68.0);
          else if (h < 0.28) discard;
          else alb = h < 0.6 ? alb : h < 0.85 ? S(44.0, 84.0, 34.0) : S(94.0, 143.0, 58.0);
        }

        // light: sun and sky, the voxel edges catching it like the town's bevels
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * 0.9 + hemi);
        vec2 fa, fe;
        if (wall) { fa = vec2(u, vLocal.y); fe = vec2(fw, vSize.y); } else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float e = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.06 + fwPx * Q * 0.6, e)) * 0.16;
        if (glass) {
          // glass: the sky in it at a glance, warm light behind it after dark
          vec3 v = normalize(cameraPosition - vWorld);
          float fres = pow(1.0 - max(dot(v, n), 0.0), 3.0);
          col = mix(col, uSkyColor * 0.35, 0.08 + 0.45 * fres);
          col += glow * uWindowColor * uNight * 0.9;
        }
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
