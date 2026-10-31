import * as THREE from 'three';
import type { SharedUniforms } from './renderer';

/**
 * Sun shafts: the light that falls through a great hall's windows (a cathedral's rose and its aisle windows, the
 * ring of windows round a mosque's dome) drawn as soft dusty beams. Each window is a prism swept from its opening
 * along the real sun's direction down to the floor, where it ends in a warm patch on the stone or the carpet, so
 * the beams turn with the time of day and fade out when the sun leaves that side of the building or sets.
 *
 * One additive mesh per hall, a few dozen quads, built once. Only the hall the player is in (or looking into, in
 * first person) is drawn. In the iso view the cutaway opens the hall at some height; the beams are cut there too.
 */

/** A window the sun can shine through: its centre and size (metres), the outward normal, an optional tint. */
export interface Beam { x: number; y: number; z: number; w: number; h: number; nx: number; nz: number; tint?: [number, number, number] }

export interface ShaftHall { rect: [number, number, number, number]; floor: number; beams: Beam[] }

const MAX_LEN = 34; // metres a beam may run before it reaches the floor (a low sun)

export class Shafts {
  private groups: { mesh: THREE.Mesh; hall: ShaftHall; mat: THREE.ShaderMaterial }[] = [];

  constructor(scene: THREE.Scene, shared: SharedUniforms, halls: ShaftHall[]) {
    for (const hall of halls) {
      if (!hall.beams.length) continue;
      const mat = shaftMaterial(shared, hall.floor);
      const mesh = new THREE.Mesh(beamGeometry(hall), mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 9;
      mesh.visible = false;
      scene.add(mesh);
      this.groups.push({ mesh, hall, mat });
    }
  }

  /**
   * Shows the beams of the hall around p (the player). `room` is how high over its floor the iso cutaway opens
   * the hall the player stands in (null when the cutaway is off).
   */
  update(p: THREE.Vector3, fp: boolean, room: number | null): void {
    for (const g of this.groups) {
      const [x0, z0, x1, z1] = g.hall.rect;
      const d = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1));
      const inside = d === 0 && p.y > g.hall.floor - 1.5;
      // in first person the beams show through the door as you come near; in the iso view only from inside
      // (from outside a lowered hall is cut at its floor, and its beams would hang in the air)
      g.mesh.visible = fp ? d < 26 : inside;
      g.mat.uniforms.uTop.value = fp || room === null ? 1e4 : g.hall.floor + room;
    }
  }
}

function beamGeometry(hall: ShaftHall): THREE.BufferGeometry {
  // per vertex: the point on the window it starts from, how far along the beam (0 at the window, 1 at the floor),
  // the window's outward normal and its tint; the vertex shader sweeps it along the sun
  const base: number[] = [], along: number[] = [], nrm: number[] = [], tint: number[] = [], idx: number[] = [];
  for (const b of hall.beams) {
    // the window's corners: across it (perpendicular to its normal, in the horizontal) and up
    const tx = -b.nz, tz = b.nx;
    const c: [number, number, number][] = [
      [b.x - tx * b.w / 2, b.y - b.h / 2, b.z - tz * b.w / 2],
      [b.x + tx * b.w / 2, b.y - b.h / 2, b.z + tz * b.w / 2],
      [b.x + tx * b.w / 2, b.y + b.h / 2, b.z + tz * b.w / 2],
      [b.x - tx * b.w / 2, b.y + b.h / 2, b.z - tz * b.w / 2],
    ];
    const col = b.tint ?? [1, 1, 1];
    const v0 = base.length / 3;
    // eight vertices: the window (0..3) and where each corner meets the floor (4..7)
    for (const t of [0, 1]) for (const q of c) {
      base.push(q[0], q[1], q[2]);
      along.push(t);
      nrm.push(b.nx, 0, b.nz);
      tint.push(col[0], col[1], col[2]);
    }
    // the four sides of the prism, and the patch of sun on the floor (its far end)
    for (let i = 0; i < 4; i++) {
      const a = v0 + i, bb = v0 + ((i + 1) & 3);
      idx.push(a, bb, bb + 4, a, bb + 4, a + 4);
    }
    idx.push(v0 + 4, v0 + 5, v0 + 6, v0 + 4, v0 + 6, v0 + 7);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(base, 3));
  g.setAttribute('aAlong', new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3));
  g.setAttribute('aTint', new THREE.Float32BufferAttribute(tint, 3));
  g.setIndex(idx);
  return g;
}

function shaftMaterial(u: SharedUniforms, floor: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uSunDir: u.uSunDir, uSunColor: u.uSunColor, uNight: u.uNight, uTime: u.uTime, tNoise: u.tNoise, uFloor: { value: floor }, uTop: { value: 1e4 } },
    vertexShader: /* glsl */ `
      attribute float aAlong;
      attribute vec3 aN;
      attribute vec3 aTint;
      uniform vec3 uSunDir;
      uniform float uFloor;
      varying vec3 vW;
      varying vec3 vTint;
      varying float vT;
      varying float vLit;
      void main() {
        // light travels away from the sun; a sun on the other side of the wall, or under the horizon, lights nothing
        vec3 d = -normalize(uSunDir);
        vLit = smoothstep(0.02, 0.22, dot(uSunDir, aN)) * smoothstep(0.03, 0.2, uSunDir.y);
        float len = min(${MAX_LEN.toFixed(1)}, (position.y - uFloor - 0.02) / max(0.03, -d.y));
        vec3 w = position + d * len * aAlong;
        vW = w; vTint = aTint; vT = aAlong;
        gl_Position = projectionMatrix * viewMatrix * vec4(w, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunColor;
      uniform float uNight;
      uniform float uTime;
      uniform float uTop;
      uniform float uFloor;
      uniform sampler2D tNoise;
      varying vec3 vW;
      varying vec3 vTint;
      varying float vT;
      varying float vLit;
      void main() {
        if (vW.y > uTop || vLit < 0.003) discard;
        vec3 V = isOrthographic ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : normalize(vW - cameraPosition);
        // a face seen edge on is where the beam's edge is: fade it, so the beam reads as a soft volume
        vec3 fn = normalize(cross(dFdx(vW), dFdy(vW)));
        float face = abs(dot(fn, V));
        bool floorPatch = abs(fn.y) > 0.9 && vW.y < uFloor + 0.08;
        // dust drifting through the light: two layers of slow noise
        vec2 q = vW.xz * 0.35 + vW.y * vec2(0.21, -0.17);
        float n1 = texture2D(tNoise, q * 0.25 + vec2(uTime * 0.004, uTime * 0.003)).r;
        float n2 = texture2D(tNoise, q * 0.9 - vec2(uTime * 0.007, -uTime * 0.005)).r;
        float dust = 0.55 + 0.6 * n1 * n2 * 2.0;
        float day = vLit * (1.0 - uNight);
        vec3 sun = uSunColor * vTint;
        float a;
        if (floorPatch) {
          // the warm patch where the beam lands
          a = 0.16 * (0.8 + 0.4 * n1);
        } else {
          // strongest just inside the window, thinning as it falls
          float fall = (1.0 - vT * 0.65) * smoothstep(0.0, 0.06, vT);
          a = 0.052 * fall * dust * pow(face, 0.7);
        }
        gl_FragColor = vec4(sun * a * day, 1.0);
      }`,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}
