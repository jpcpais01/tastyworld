import * as THREE from 'three';
import { COMMON } from '../engine/shaders';
import { Prop } from '../world/props';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom } from '../game/actors';
import type { Renderer } from '../engine/renderer';

/**
 * The Halo's hologram: two koi of light circling inside the crossed rings above the crossing, bodies rippling as
 * they swim, drawn with scanlines and the odd glitch in the half-resolution particle pass (soft, additive, faded
 * where they pass behind things). At midnight the Halo sings: the koi blush pink, speed up, and the lyrics float
 * over the square, as DJ Nyx has been telling everyone.
 */

const CENTRE = new THREE.Vector3(0, 10.5, 0);
const S = 0.25;

/** A koi, nose at z = 0 and tail towards +z: a body of rings that swell and taper, fins, a fanned tail. */
function koi(pal: Palette, body: number, spot: number): Prop {
  const B = pal.add(body), P = pal.add(spot), E = pal.add(0x202028);
  const p = new Prop(11, 9, 30, S);
  const cx = 5, cy = 4;
  for (let z = 0; z < 22; z++) {
    const r = 3.4 * Math.sin((Math.PI * (z + 2.5)) / 26);
    for (let x = 0; x < 11; x++) for (let y = 0; y < 9; y++) {
      const dx = (x - cx) / Math.max(0.6, r), dy = (y - cy) / Math.max(0.5, r * 0.85);
      if (dx * dx + dy * dy > 1) continue;
      // the patches: big blotches along the back
      const blotch = y >= cy && Math.sin(z * 0.55 + x * 0.3) + Math.cos(z * 0.31 - 1) > 0.6;
      p.set(x, y, z, blotch ? P : B);
    }
  }
  p.set(cx - 2, cy + 1, 3, E); p.set(cx + 2, cy + 1, 3, E);
  // pectoral fins, sweeping back and out
  for (let i = 0; i < 4; i++) { p.box(cx - 3 - i, cy - 2, 6 + i, cx - 3 - i, cy - 2, 7 + i, B); p.box(cx + 3 + i, cy - 2, 6 + i, cx + 3 + i, cy - 2, 7 + i, B); }
  // the dorsal fin and the tail's fan
  p.box(cx, cy + 3, 8, cx, cy + 4, 15, P);
  for (let z = 22; z < 30; z++) {
    const h = Math.min(4, 1 + (z - 22) * 0.6);
    for (let y = Math.round(cy - h); y <= Math.round(cy + h); y++) if (y >= 0 && y < 9) p.set(cx, y, z, (z + y) % 3 ? P : B);
  }
  return p;
}

const VERT = /* glsl */ `
in vec4 aColor;
uniform float uTime;
uniform float uSwim;
out vec3 vCol;
out vec3 vWorld;
out vec4 vClip;
void main() {
  vec3 p = position;
  // the body ripples: a wave runs nose to tail, growing towards the tail
  float along = clamp(p.z / 7.5, 0.0, 1.0);
  p.x += sin(p.z * 0.9 - uTime * uSwim) * 0.35 * along * along;
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  vCol = aColor.rgb;
  vClip = projectionMatrix * viewMatrix * w;
  gl_Position = vClip;
}
`;

const FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tDepth;
uniform vec3 uClip;
uniform float uTime;
uniform float uGlitch;
uniform float uSing;
uniform vec3 uTint;
in vec3 vCol;
in vec3 vWorld;
in vec4 vClip;
layout(location = 0) out vec4 outColor;
void main() {
  // flat facets from the screen derivatives, so the voxel faces read even in pure light
  vec3 nrm = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  float facet = 0.55 + 0.45 * abs(nrm.y) + 0.2 * abs(nrm.x);
  float lum = dot(vCol, vec3(0.3, 0.55, 0.15));
  vec3 base = mix(uTint, vec3(1.0, 0.35, 0.75), clamp(uSing + (lum < 0.45 ? 0.55 : 0.0), 0.0, 1.0));
  // scanlines that crawl upward, and a glitch that tears a band sideways now and then
  float scan = 0.65 + 0.35 * sin(vWorld.y * 38.0 - uTime * 6.0);
  float band = step(0.93, fract(vWorld.y * 0.7 + uTime * 0.9)) * uGlitch;
  float a = (0.5 + 0.5 * lum) * facet * scan * (1.0 - band * 0.8) * (0.85 + 0.15 * sin(uTime * 23.0));
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float sd = texture(tDepth, suv).r;
  float lz = linZ(vClip.z / vClip.w * 0.5 + 0.5, uClip);
  a *= clamp((linZ(sd, uClip) - lz) * 0.8 + 0.25, 0.25, 1.0);
  outColor = vec4(base * a * 0.6, 0.0);
}
`;

/** What the Halo sings at midnight, a line every few seconds. */
export const HALO_SONG = [
  'City of rain, city of light,',
  'keep me awake, keep me tonight.',
  'Under the Halo nobody is lost,',
  'every street sign counting the cost.',
  'Two little fish in a circle of glass,',
  'swimming in time till the rain clouds pass.',
];

export class Hologram {
  private fish: THREE.Mesh[] = [];
  private mat: THREE.ShaderMaterial;
  private t = 0;
  private glitchT = 4;
  /** 0..1 while the Halo sings at midnight. */
  sing = 0;

  constructor(r: Renderer) {
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uTime: { value: 0 }, uSwim: { value: 4 }, uGlitch: { value: 0 }, uSing: { value: 0 }, uTint: { value: new THREE.Color(0.35, 0.95, 1.0) },
        tDepth: r.particleDepth, uClip: r.clip,
      },
      transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    for (const [body, spot] of [[0xf4f8ff, 0x3a3a44], [0xffe9a0, 0x50402a]] as [number, number][]) {
      const pal = new Palette();
      const md = meshGrid({ grid: koi(pal, body, spot).grid, pal, scale: S, origin: [-5.5 * S, -4.5 * S, -2], greedy: false });
      const m = new THREE.Mesh(geometryFrom(md), this.mat);
      m.frustumCulled = false;
      r.particleScene.add(m);
      this.fish.push(m);
    }
  }

  /** `visible`: out on the street (the hologram is the city's centre, seen from far off). */
  update(dt: number, singing: boolean, visible: boolean): void {
    for (const f of this.fish) f.visible = visible;
    if (!visible) return;
    this.sing += ((singing ? 1 : 0) - this.sing) * Math.min(1, dt * 1.5);
    this.t += dt * (1 + this.sing * 0.8);
    const u = this.mat.uniforms;
    u.uTime.value = this.t;
    u.uSwim.value = 4 + this.sing * 3;
    u.uSing.value = this.sing;
    // a glitch every so often: a quarter second of torn scanlines
    if ((this.glitchT -= dt) < 0) this.glitchT = 3 + Math.random() * 6;
    u.uGlitch.value = this.glitchT < 0.25 ? 1 : 0;
    this.fish.forEach((f, i) => {
      // two koi chasing each other round the pylon, rising and dipping a little out of step
      const a = this.t * 0.35 + i * Math.PI, R = 4.2;
      const x = Math.cos(a) * R, z = Math.sin(a) * R;
      f.position.set(CENTRE.x + x, CENTRE.y + Math.sin(this.t * 0.6 + i * 2) * 1.2, CENTRE.z + z);
      // facing along the circle (the nose leads): the koi's +z is its tail, so it looks back along -tangent
      f.rotation.set(Math.sin(this.t * 0.6 + i * 2 + 1.2) * 0.12, Math.PI - a, 0);
    });
  }
}
