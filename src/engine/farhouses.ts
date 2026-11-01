import * as THREE from 'three';
import { COMMON } from './shaders';

/**
 * The bell towers of Atrani and Ravello on the slopes past the edge of the Amalfi map, with their majolica domes,
 * and the stone treads of the mule paths: instanced boxes on the 0.25 m voxel grid, one draw, the shader painting
 * them voxel by voxel. (The villages' houses are the town's own, in voxels: engine/fartown.ts.)
 */

/** A bell tower: where it stands, the ground there, its height and its stucco. */
export interface FarTower { x: number; z: number; ground: number; h: number; color: number }

const Q = 0.25;
const snap = (v: number) => Math.round(v / Q) * Q;

/** Part kinds (the shader's switch). */
const enum P { Slab = 4, Tower = 9, Majolica = 11 }

const rgb = (hex: number): [number, number, number] => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255];

/** A stone box laid on the ground (a path's tread or step): corners (m) and colour. */
export type FarStone = [number, number, number, number, number, number, number];

export function farHouses(uniforms: Record<string, THREE.IUniform>, SQUASH: string, HAZE: string, towers: FarTower[], stones: FarStone[] = []): THREE.Mesh {
  const parts: number[] = [];
  // one box: corners (m), kind, colour, how soon it drops out (0 never, 2 a few hundred metres off), and what it
  // belongs to (its ground level, two spare values, a seed)
  let house: [number, number, number, number] = [0, 0, 0, 0];
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, kind: P, color: number, lod = 0) => {
    if (x1 - x0 < 0.01 || y1 - y0 < 0.01 || z1 - z0 < 0.01) return;
    const [r, g, b] = rgb(color);
    parts.push((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y0, y1 - y0, house[3], kind, r, g, b, lod, ...house);
  };

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
      uniform vec3 uSkyColor, uGroundColor, uSunColor, uSunDir;
      in vec3 vWorld; in vec3 vLocal; flat in vec3 vSize; flat in vec4 vPart; flat in vec4 vCol; flat in vec4 vHouse; flat in vec3 vN;
      layout(location = 0) out vec4 outColor;
      const float Q = 0.25;
      vec3 S(float r, float g, float b) { return srgb2lin(vec3(r, g, b) / 255.0); }
      void main() {
        vec3 n = vN;
        int kind = int(vPart.w + 0.5);
        // where on the face: u runs along it, y up it
        int face = n.y > 0.5 ? 4 : n.y < -0.5 ? 5 : n.x > 0.5 ? 0 : n.x < -0.5 ? 1 : n.z > 0.5 ? 2 : 3;
        float u = face == 0 ? vLocal.z + vSize.z * 0.5 : face == 1 ? vSize.z * 0.5 - vLocal.z : face == 2 ? vSize.x * 0.5 - vLocal.x : vLocal.x + vSize.x * 0.5;
        float fw = face < 2 ? vSize.z : vSize.x;
        bool wall = face < 4;
        // voxel coordinates on the face (or across the top)
        vec2 fc = wall ? vec2(u, vWorld.y - vHouse.x) / Q : vWorld.xz / Q;
        vec2 vc = floor(fc + 0.001);
        float fwPx = fwidth(fc.x) + fwidth(fc.y);
        vec3 alb = srgb2lin(vCol.rgb);
        float tint = hash12(vc + float(face) * 17.3 + vHouse.w * 91.0);
        if (kind == 9 && wall) {
          // a bell tower: arched openings for the bells under the dome, a clock face below, white bands
          float topV = floor((vPart.x + vSize.y - vHouse.x) / Q + 0.5);
          float rt = topV - 1.0 - vc.y, mu = abs(vc.x - floor(fw / Q + 0.5) * 0.5 + 0.5);
          alb *= 0.96 + 0.08 * tint;
          if (rt >= 3.0 && rt <= 10.0 && mu <= 2.0 && !(rt == 10.0 && mu == 2.0)) alb = S(28.0, 26.0, 26.0);
          else if (rt >= 15.0 && rt <= 18.0 && mu <= 1.5) alb = S(242.0, 238.0, 230.0);
          if (rt == 0.0 || rt == 12.0) alb = S(242.0, 238.0, 230.0);
          alb *= mix(0.72, 1.0, smoothstep(0.0, 8.0, vc.y));
        } else if (kind == 11) {
          alb = mod(vc.x + vc.y, 2.0) < 1.0 ? S(47.0, 138.0, 90.0) : S(233.0, 194.0, 58.0);
        } else {
          alb *= 0.95 + 0.07 * tint;
        }

        // light: sun and sky, the voxel edges catching it like the town's bevels
        float ndl = max(dot(n, uSunDir), 0.0);
        vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
        vec3 col = alb * (uSunColor * ndl * 0.9 + hemi);
        vec2 fa, fe;
        if (wall) { fa = vec2(u, vLocal.y); fe = vec2(fw, vSize.y); } else { fa = vLocal.xz + vSize.xz * 0.5; fe = vSize.xz; }
        float e = min(min(fa.x, fe.x - fa.x), min(fa.y, fe.y - fa.y));
        col *= 1.0 + (1.0 - smoothstep(0.0, 0.06 + fwPx * Q * 0.6, e)) * 0.16;
        outColor = vec4(haze(col, vWorld), 1.0);
      }`,
  }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;
  return mesh;
}
