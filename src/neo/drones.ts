import * as THREE from 'three';
import { COMMON } from '../engine/shaders';
import { Prop } from '../world/props';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom } from '../game/actors';
import { voxelMaterial, type Renderer } from '../engine/renderer';
import { SEGS } from '../world/neoPlan';

/**
 * Drones over Halcyon's streets, below the sky lanes: delivery drones ferrying a parcel up and down the streets,
 * and patrol drones that hover along the avenues flashing red and blue, sweeping a searchlight over the crowd
 * after dark. Bodies are instanced voxels; the light bars swap colour by toggling two instanced meshes; the beams
 * are additive cones in the soft particle pass.
 */

const S = 0.125;
const COURIERS = 14, PATROLS = 5;

function quad(pal: Palette, body: number, parcel: number | null): Prop {
  const B = pal.add(body, { vary: 0.03 }), D = pal.add(0x16161c), R = pal.add(0x3a3a44), E = pal.add(0xfff4dc, { emit: 0.9 });
  const p = new Prop(13, 6, 13, S);
  // a body in the middle, four arms out to the rotors, a lamp underneath
  p.box(4, 3, 4, 8, 4, 8, B);
  for (let i = 0; i < 13; i++) { p.set(i, 4, i, D); p.set(12 - i, 4, i, D); }
  for (const [x, z] of [[0, 0], [10, 0], [0, 10], [10, 10]] as [number, number][]) p.box(x, 5, z, x + 2, 5, z + 2, R);
  p.set(6, 2, 6, E);
  if (parcel !== null) {
    const P = pal.add(parcel, { vary: 0.05 }), T = pal.add(0xe8d8a8);
    p.box(5, 0, 5, 7, 1, 7, P);
    p.box(6, 0, 5, 6, 1, 7, T);
  }
  return p;
}

/** A small light bar for a patrol drone's back, in one colour. */
function bar(pal: Palette, col: number): Prop {
  const p = new Prop(13, 6, 13, S);
  const L = pal.add(col, { emit: 1.0 });
  p.box(4, 5, 5, 8, 5, 7, L);
  return p;
}

interface Drone { seg: number; t: number; dir: 1 | -1; speed: number; y: number; off: number; bob: number; patrol: boolean; slot: number; pause: number }

const BEAM_VERT = /* glsl */ `
uniform float uLen;
out float vH;
out float vEdge;
out vec4 vClip;
void main() {
  // the cone's apex at the drone, opening downwards; vH 0 at the lamp .. 1 at the ground
  vH = clamp(-position.y / uLen, 0.0, 1.0);
  vec4 w = modelMatrix * vec4(position, 1.0);
  // fade the silhouette: faces seen edge-on are where a light cone has no hard outline
  vec3 n = normalize(mat3(modelMatrix) * normal);
  vEdge = abs(dot(n, normalize(cameraPosition - w.xyz)));
  vClip = projectionMatrix * viewMatrix * w;
  gl_Position = vClip;
}
`;
const BEAM_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tDepth;
uniform vec3 uClip;
uniform float uOn;
in float vH;
in float vEdge;
in vec4 vClip;
layout(location = 0) out vec4 outColor;
void main() {
  float a = uOn * 0.1 * (1.0 - vH * 0.8) * smoothstep(0.0, 0.08, vH) * vEdge * vEdge;
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float sd = texture(tDepth, suv).r;
  float lz = linZ(vClip.z / vClip.w * 0.5 + 0.5, uClip);
  a *= clamp((linZ(sd, uClip) - lz) * 0.6, 0.0, 1.0);
  outColor = vec4(vec3(0.85, 0.92, 1.0) * a, 0.0);
}
`;

export class Drones {
  private drones: Drone[] = [];
  private courier: THREE.InstancedMesh;
  private patrol: THREE.InstancedMesh;
  private red: THREE.InstancedMesh;
  private blue: THREE.InstancedMesh;
  private beams: THREE.Mesh[] = [];
  private beamMat: THREE.ShaderMaterial;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private v = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private t = 0;
  private segs = SEGS.filter((s) => s.kind !== 'quay' && s.a1 - s.a0 > 60);

  constructor(scene: THREE.Object3D, r: Renderer) {
    const mat = voxelMaterial(r.shared);
    const make = (prop: (pal: Palette) => Prop, n: number) => {
      const pal = new Palette();
      const md = meshGrid({ grid: prop(pal).grid, pal, scale: S, origin: [-6.5 * S, 0, -6.5 * S], greedy: false });
      const mesh = new THREE.InstancedMesh(geometryFrom(md), mat, n);
      mesh.frustumCulled = false;
      mesh.count = n;
      scene.add(mesh);
      return mesh;
    };
    this.courier = make((pal) => quad(pal, 0xf2c74a, 0x8a6a4a), COURIERS);
    this.patrol = make((pal) => quad(pal, 0x1a1c24, null), PATROLS);
    this.red = make((pal) => bar(pal, 0xff2a3a), PATROLS);
    this.blue = make((pal) => bar(pal, 0x2a6aff), PATROLS);
    this.beamMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG,
      uniforms: { uLen: { value: 11 }, uOn: { value: 0 }, tDepth: r.particleDepth, uClip: r.clip },
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    // an open cone 11 m long, apex up at the origin
    const cone = new THREE.ConeGeometry(2.4, 11, 20, 6, true);
    cone.translate(0, -5.5, 0);
    for (let i = 0; i < PATROLS; i++) {
      const b = new THREE.Mesh(cone, this.beamMat);
      b.frustumCulled = false;
      r.particleScene.add(b);
      this.beams.push(b);
    }
    let seed = 4242;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < COURIERS + PATROLS; i++) {
      const patrol = i >= COURIERS;
      this.drones.push({
        seg: Math.floor(rnd() * this.segs.length), t: rnd(), dir: rnd() < 0.5 ? 1 : -1, speed: patrol ? 3 : 7 + rnd() * 4,
        y: patrol ? 11 + rnd() * 2 : 8 + rnd() * 3, off: (rnd() - 0.5) * 4, bob: rnd() * 6.28, patrol, slot: patrol ? i - COURIERS : i, pause: 0,
      });
    }
  }

  update(dt: number, night: number, visible: boolean): void {
    for (const m of [this.courier, this.patrol, this.red, this.blue]) m.visible = visible;
    for (const b of this.beams) b.visible = visible && night > 0.05;
    if (!visible) return;
    this.t += dt;
    const flip = Math.floor(this.t * 2.5) % 2 === 0;
    this.red.visible = flip; this.blue.visible = !flip;
    this.beamMat.uniforms.uOn.value = night;
    for (const d of this.drones) {
      const s = this.segs[d.seg], span = s.a1 - s.a0;
      // patrols stop now and then to hover over a spot, sweeping the beam
      if (d.pause > 0) d.pause -= dt;
      else {
        d.t += (d.speed * dt * d.dir) / span;
        if (d.patrol && Math.random() < dt * 0.05) d.pause = 4 + Math.random() * 5;
      }
      if (d.t > 1 || d.t < 0) {
        // at the end of the street turn onto another one, nearest to where we are
        d.t = Math.min(1, Math.max(0, d.t));
        const here = s.ew ? [s.a0 + d.t * span, s.c] : [s.c, s.a0 + d.t * span];
        let best = d.seg, bd = 1e9;
        for (let k = 0; k < this.segs.length; k++) {
          if (k === d.seg) continue;
          const o = this.segs[k];
          if (o.ew === s.ew) continue;
          const along = o.ew ? here[0] : here[1], across = o.ew ? here[1] - o.c : here[0] - o.c;
          if (along < o.a0 || along > o.a1) continue;
          const dd = Math.abs(across) + Math.random() * 30;
          if (dd < bd) { bd = dd; best = k; }
        }
        const o = this.segs[best];
        d.seg = best;
        d.t = ((o.ew ? here[0] : here[1]) - o.a0) / (o.a1 - o.a0);
        d.dir = Math.random() < 0.5 ? 1 : -1;
      }
      const o = this.segs[d.seg], a = o.a0 + d.t * (o.a1 - o.a0);
      const y = d.y + Math.sin(this.t * 1.7 + d.bob) * 0.25;
      if (o.ew) this.v.set(a, y, o.c + d.off); else this.v.set(o.c + d.off, y, a);
      const yaw = (o.ew ? (d.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : d.dir > 0 ? 0 : Math.PI) + (d.pause > 0 ? Math.sin(this.t * 0.8 + d.bob) * 0.6 : 0);
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(this.v, this.q, this.one);
      if (d.patrol) {
        this.patrol.setMatrixAt(d.slot, this.m);
        this.red.setMatrixAt(d.slot, this.m);
        this.blue.setMatrixAt(d.slot, this.m);
        // the beam leans forward and sweeps side to side
        const b = this.beams[d.slot];
        b.position.copy(this.v);
        b.rotation.set(0.25 + Math.sin(this.t * 0.9 + d.bob) * 0.12, yaw, Math.sin(this.t * 0.6 + d.bob * 2) * 0.3, 'YXZ');
      } else this.courier.setMatrixAt(d.slot, this.m);
    }
    for (const m of [this.courier, this.patrol, this.red, this.blue]) m.instanceMatrix.needsUpdate = true;
  }
}
