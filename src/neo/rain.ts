import * as THREE from 'three';
import { COMMON } from '../engine/shaders';
import type { Renderer } from '../engine/renderer';

/**
 * Halcyon's rain: streaks falling through a box that follows the camera, all on the GPU in one instanced draw
 * (with the other particles, so it costs one half-resolution pass). Showers come and go with the hours; under a
 * roof the rain stops. Each streak is kept at least a pixel and a half wide and dimmed by what it grew, so from
 * high up the rain reads as a soft sheen rather than a shimmer.
 */

const N = 2600;
const BOX = new THREE.Vector3(46, 26, 46);

const VERT = /* glsl */ `
in vec4 aSeed; // x, z in the box (0..1), phase, speed
uniform float uTime;
uniform float uRain;
uniform vec3 uCenter;
uniform vec3 uBox;
uniform vec3 uCamRight;
uniform vec2 uWind;
uniform vec2 uPartRes;
out vec2 vUv;
out float vAlpha;
out vec4 vClip;
void main() {
  // only the first uRain share of the drops fall: a drizzle is the same rain with most drops left out
  float on = step(fract(aSeed.z * 7.13), uRain);
  float fall = 15.0 + aSeed.w * 6.0;
  vec3 base = uCenter - uBox * 0.5;
  float y = uBox.y - mod(uTime * fall + aSeed.z * uBox.y, uBox.y);
  // each drop wraps round the box as the camera moves, so the rain never ends at an edge
  vec2 xz = mod(vec2(aSeed.x, aSeed.y) * uBox.xz - (base.xz + uWind * (uBox.y - y) * 0.06), uBox.xz) + base.xz;
  vec3 p = vec3(xz.x, base.y + y, xz.y);
  vec3 dir = normalize(vec3(uWind.x * 0.06, -1.0, uWind.y * 0.06));
  float len = 0.55 + aSeed.w * 0.35, wid = 0.018;
  vec4 cc = projectionMatrix * viewMatrix * vec4(p, 1.0);
  float px = wid * projectionMatrix[0][0] / cc.w * 0.5 * uPartRes.x;
  float a = 0.4 * on;
  // a drop thinner than a pixel and a half is widened to that and dimmed by the square root of what it grew
  // (and drawn a little longer, like the eye's own motion blur), so far rain still reads as rain
  if (px < 1.5 && px > 0.0) { float g = 1.5 / px; wid *= g; a /= sqrt(g); len *= 1.0 + min(g, 12.0) * 0.12; }
  // fade in at the top of the box and out near its sides, so the box itself never shows
  vec2 e = abs(xz - uCenter.xz) / (uBox.xz * 0.5);
  a *= smoothstep(1.0, 0.75, max(e.x, e.y)) * smoothstep(0.0, 2.0, y) * smoothstep(uBox.y, uBox.y - 3.0, y);
  vAlpha = a;
  vUv = position.xy + 0.5;
  vec3 wp = p + dir * position.y * len + uCamRight * position.x * wid;
  vClip = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  gl_Position = vClip;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tDepth;
uniform vec3 uClip;
uniform vec3 uTint;
in vec2 vUv;
in float vAlpha;
in vec4 vClip;
layout(location = 0) out vec4 outColor;
void main() {
  float a = vAlpha * (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.35, vUv.y);
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float sd = texture(tDepth, suv).r;
  float lz = linZ(vClip.z / vClip.w * 0.5 + 0.5, uClip);
  a *= clamp((linZ(sd, uClip) - lz) * 3.0, 0.0, 1.0);
  if (uClip.z > 0.5) a *= smoothstep(0.4, 1.4, lz);
  outColor = vec4(uTint * a, a * 0.6);
}
`;

export class Rain {
  private mat: THREE.ShaderMaterial;
  private mesh: THREE.Mesh;
  /** 0..1, eased toward the weather's target. */
  amount = 0;
  private cover = 1;
  private right = new THREE.Vector3();

  constructor(r: Renderer) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const seeds = new Float32Array(N * 4);
    let s = 9973;
    const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < N; i++) seeds.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 4));
    geo.instanceCount = N;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: r.shared.uTime, uRain: { value: 0 }, uCenter: { value: new THREE.Vector3() }, uBox: { value: BOX },
        uCamRight: { value: new THREE.Vector3(1, 0, 0) }, uWind: { value: new THREE.Vector2(1.2, 0.5) }, uPartRes: r.particleRes,
        tDepth: r.particleDepth, uClip: r.clip, uTint: { value: new THREE.Color(0.75, 0.85, 1.0) },
      },
      // the streak's long axis points down the fall, which turns its winding over: draw both faces
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    r.particleScene.add(this.mesh);
  }

  /** How hard it should be raining at this hour of this day (0 dry .. 1 a downpour). */
  static weather(hour: number, day: number): number {
    // a shower roughly every few hours, longer and heavier at night; each day keeps its own pattern
    const t = hour + day * 24;
    const w = Math.sin(t * 0.9 + day * 1.7) * 0.6 + Math.sin(t * 0.37 + 2.1) * 0.5 + (hour >= 19 || hour < 4 ? 0.35 : 0);
    return Math.max(0, Math.min(1, (w - 0.1) * 1.3));
  }

  update(dt: number, cam: THREE.Camera, center: THREE.Vector3, target: number, sheltered: boolean, tint: THREE.Color): void {
    this.amount += (target - this.amount) * Math.min(1, dt * 0.25);
    this.cover += ((sheltered ? 0 : 1) - this.cover) * Math.min(1, dt * 3);
    const a = this.amount * this.cover;
    this.mesh.visible = a > 0.01;
    if (!this.mesh.visible) return;
    const u = this.mat.uniforms;
    u.uRain.value = a;
    u.uCenter.value.set(center.x, center.y + BOX.y / 2 - 2, center.z);
    this.right.setFromMatrixColumn(cam.matrixWorld, 0).normalize();
    u.uCamRight.value.copy(this.right);
    (u.uTint.value as THREE.Color).copy(tint).multiplyScalar(0.9).add(new THREE.Color(0.1, 0.12, 0.16));
  }
}
