import * as THREE from 'three';
import { PARTICLE_VERT, PARTICLE_FRAG, BLOB_VERT, BLOB_FRAG } from '../engine/shaders';
import type { Renderer } from '../engine/renderer';
import type { Emitter } from '../world/tokyo';
import { rng } from '../world/grid';
import { Prop } from '../world/props';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom } from './actors';
import { voxelMaterial } from '../engine/renderer';

const KIND = { steam: 0, smoke: 1, incense: 2, petal: 3, firefly: 4, sparkle: 5 };
const MEAL_STEAM = 10, MEAL_SPARKLE = 10;

/** All particles in one instanced draw call, animated entirely on the GPU. */
export class Particles {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private sparkleStart = 0;
  private mealStart = 0;
  private mealOn = false;
  private origins: Float32Array;
  private seeds: Float32Array;
  private geo: THREE.InstancedBufferGeometry;

  constructor(r: Renderer, emitters: Emitter[], sparkles: [number, number, number][], fireflies: [number, number, number][], petals?: [number, number, number, number]) {
    const list: { o: [number, number, number]; s: [number, number, number, number] }[] = [];
    const rnd = rng(7);
    for (const e of emitters) {
      const n = e.kind === 'smoke' ? 22 : e.kind === 'incense' ? 18 : 14;
      const kind = KIND[e.kind];
      for (let i = 0; i < n; i++) list.push({ o: [e.pos[0] + (rnd() - 0.5) * 0.4, e.pos[1], e.pos[2] + (rnd() - 0.5) * 0.4], s: [i / n + rnd() * 0.05, 0.8 + rnd() * 0.5 * e.rate, e.kind === 'smoke' ? 0.32 : 0.26, kind] });
    }
    if (petals) {
      const [x0, z0, x1, z1] = petals;
      for (let i = 0; i < 520; i++) list.push({ o: [x0 + rnd() * (x1 - x0), rnd() * 7, z0 + rnd() * (z1 - z0)], s: [rnd(), 0.6 + rnd() * 0.8, 0.07, KIND.petal] });
    }
    for (const f of fireflies) list.push({ o: [f[0] + (rnd() - 0.5) * 2, f[1] + rnd() * 1.2, f[2] + (rnd() - 0.5) * 2], s: [rnd(), 0.5 + rnd(), 0.09, KIND.firefly] });
    this.sparkleStart = list.length;
    for (const sp of sparkles) for (let i = 0; i < 6; i++) list.push({ o: [sp[0] + (rnd() - 0.5) * 0.5, sp[1] + 0.2 + rnd() * 0.6, sp[2] + (rnd() - 0.5) * 0.5], s: [rnd(), 0.8 + rnd(), 0.07, KIND.sparkle] });
    // steam over food being eaten and a sparkle of delight, moved around by the meal (see game/meal.ts)
    this.mealStart = list.length;
    for (let i = 0; i < MEAL_STEAM; i++) list.push({ o: [0, -50, 0], s: [i / MEAL_STEAM, 1.6, 0.085, KIND.steam] });
    for (let i = 0; i < MEAL_SPARKLE; i++) list.push({ o: [0, -50, 0], s: [i / MEAL_SPARKLE, 1.1 + rnd() * 0.6, 0.06, KIND.sparkle] });

    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0]), 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    this.origins = new Float32Array(list.length * 3);
    this.seeds = new Float32Array(list.length * 4);
    list.forEach((p, i) => { this.origins.set(p.o, i * 3); this.seeds.set(p.s, i * 4); });
    geo.setAttribute('aOrigin', new THREE.InstancedBufferAttribute(this.origins, 3));
    geo.setAttribute('aSeed', new THREE.InstancedBufferAttribute(this.seeds, 4));
    geo.instanceCount = list.length;
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: PARTICLE_VERT,
      fragmentShader: PARTICLE_FRAG,
      uniforms: {
        uTime: r.shared.uTime,
        uCamRight: { value: new THREE.Vector3(1, 0, 0) },
        uCamUp: { value: new THREE.Vector3(0, 1, 0) },
        uWind: { value: new THREE.Vector3(0.35, 0, 0.12) },
        uNight: r.shared.uNight,
        uLight: { value: new THREE.Color(1, 1, 1) },
        tDepth: r.particleDepth,
        uClip: r.clip,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    r.particleScene.add(this.mesh);
  }

  /** Hide the sparkles of a found lucky cat. */
  hideSparkle(index: number): void {
    const a = this.geo.getAttribute('aOrigin') as THREE.InstancedBufferAttribute;
    for (let i = 0; i < 6; i++) {
      const k = this.sparkleStart + index * 6 + i;
      if (k * 3 + 1 < this.origins.length) this.origins[k * 3 + 1] = -50;
    }
    a.needsUpdate = true;
  }

  /** Steam (amount 0..1 shows that share of the wisps) and sparkles, at world positions; null hides them. */
  meal(steam: THREE.Vector3 | null, amount: number, sparkle: THREE.Vector3 | null): void {
    if (!steam && !sparkle && !this.mealOn) return;
    this.mealOn = !!(steam || sparkle);
    const o = this.origins, n = Math.round(MEAL_STEAM * Math.min(1, Math.max(0, amount)));
    for (let i = 0; i < MEAL_STEAM; i++) {
      const k = (this.mealStart + i) * 3;
      if (steam && i < n) { o[k] = steam.x + Math.sin(i * 2.4) * 0.04; o[k + 1] = steam.y; o[k + 2] = steam.z + Math.cos(i * 2.4) * 0.04; }
      else o[k + 1] = -50;
    }
    for (let i = 0; i < MEAL_SPARKLE; i++) {
      const k = (this.mealStart + MEAL_STEAM + i) * 3, a = (i / MEAL_SPARKLE) * Math.PI * 2;
      if (sparkle) { o[k] = sparkle.x + Math.cos(a) * 0.32; o[k + 1] = sparkle.y + Math.sin(a * 3) * 0.12; o[k + 2] = sparkle.z + Math.sin(a) * 0.32; }
      else o[k + 1] = -50;
    }
    (this.geo.getAttribute('aOrigin') as THREE.InstancedBufferAttribute).needsUpdate = true;
  }

  update(right: THREE.Vector3, up: THREE.Vector3, light: THREE.Color): void {
    this.mat.uniforms.uCamRight.value.copy(right);
    this.mat.uniforms.uCamUp.value.copy(up);
    this.mat.uniforms.uLight.value.copy(light);
  }
}

/** Soft contact shadows under characters, one instanced draw. */
export class Blobs {
  readonly mesh: THREE.Mesh;
  private data: Float32Array;
  private radius: Float32Array;
  private geo: THREE.InstancedBufferGeometry;
  count = 0;

  constructor(scene: THREE.Scene, max = 64) {
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0, -0.5, 0.5, 0, -0.5, 0.5, 0, 0.5, -0.5, 0, 0.5]), 3));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    this.data = new Float32Array(max * 4);
    this.radius = new Float32Array(max);
    geo.setAttribute('aBlob', new THREE.InstancedBufferAttribute(this.data, 4).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('aRadius', new THREE.InstancedBufferAttribute(this.radius, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = geo;
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: BLOB_VERT, fragmentShader: BLOB_FRAG,
      transparent: true, depthWrite: false,
      blending: THREE.CustomBlending, blendSrc: THREE.ZeroFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    scene.add(this.mesh);
  }

  begin(): void { this.count = 0; }
  add(x: number, y: number, z: number, r: number, strength: number): void {
    if (this.count * 4 >= this.data.length) return;
    this.data.set([x, y, z, strength], this.count * 4);
    this.radius[this.count] = r;
    this.count++;
  }
  end(): void {
    this.geo.instanceCount = this.count;
    (this.geo.getAttribute('aBlob') as THREE.InstancedBufferAttribute).needsUpdate = true;
    (this.geo.getAttribute('aRadius') as THREE.InstancedBufferAttribute).needsUpdate = true;
  }
}

/** Koi gliding under the canal surface. Rendered in the scene so the water shades them. */
export class Koi {
  private mesh: THREE.InstancedMesh;
  private fish: { cx: number; cz: number; rx: number; rz: number; sp: number; ph: number; y: number }[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();

  constructor(scene: THREE.Scene, r: Renderer, area: [number, number, number, number]) {
    const pal = new Palette();
    const orange = pal.add(0xff7a2a, { vary: 0.05 }), white = pal.add(0xfaf4ea, { vary: 0.03 }), red = pal.add(0xe0402a, { vary: 0.04 }), dark = pal.add(0x1d1a1c);
    const p = new Prop(5, 3, 12, 0.05);
    p.ellipsoid(2.5, 1.5, 5.5, 2.2, 1.3, 5, (x, _y, z) => ((x + z * 3) % 5 < 2 ? white : z % 4 < 2 ? orange : red));
    p.box(2, 1, 0, 2, 2, 1, orange); p.box(1, 1, 0, 3, 1, 0, orange);
    p.set(1, 2, 10, dark); p.set(3, 2, 10, dark);
    const md = meshGrid({ grid: p.grid, pal, scale: 0.05, origin: [-0.125, -0.075, -0.3], greedy: false });
    const geo = geometryFrom(md);
    const mat = voxelMaterial(r.shared, { KOI: 1 });
    const n = 16;
    this.mesh = new THREE.InstancedMesh(geo, mat, n);
    this.mesh.frustumCulled = false;
    const rnd = rng(42);
    const [x0, z0, x1, z1] = area;
    for (let i = 0; i < n; i++) {
      this.fish.push({ cx: x0 + 3 + rnd() * (x1 - x0 - 6), cz: (z0 + z1) / 2, rx: 2 + rnd() * 6, rz: (z1 - z0) / 2 - 1.2, sp: (0.15 + rnd() * 0.2) * (rnd() < 0.5 ? 1 : -1), ph: rnd() * 6.28, y: -1.0 - rnd() * 0.6 });
    }
    scene.add(this.mesh);
  }

  update(t: number): void {
    this.fish.forEach((f, i) => {
      const a = t * f.sp + f.ph;
      const x = f.cx + Math.cos(a) * f.rx, z = f.cz + Math.sin(a * 1.7) * f.rz;
      const dx = -Math.sin(a) * f.rx * f.sp, dz = Math.cos(a * 1.7) * 1.7 * f.rz * f.sp;
      const yaw = Math.atan2(dx, dz) + Math.sin(t * 6 + f.ph) * 0.12;
      this.p.set(x, f.y + Math.sin(t * 0.7 + f.ph) * 0.1, z);
      this.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/**
 * Light shafts down from the bazaars' skylights and dome oculi: soft beams leaning away from the sun, dust
 * drifting in them, gone at night and when the sun is low. Every beam in one instanced draw of four sides each,
 * into the half-resolution particle buffer, faded where the scene stands in front of it.
 */
export class Shafts {
  readonly mesh: THREE.Mesh;
  private mat: THREE.ShaderMaterial;

  constructor(r: Renderer, list: [number, number, number, number, number, number][]) {
    const geo = new THREE.InstancedBufferGeometry();
    // four sides of a unit box (x and z in -0.5..0.5, y 0 at the top, 1 at the floor), u across each side
    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    const sides: [number, number, number, number][] = [[-0.5, -0.5, 0.5, -0.5], [0.5, -0.5, 0.5, 0.5], [0.5, 0.5, -0.5, 0.5], [-0.5, 0.5, -0.5, -0.5]];
    for (const [ax, az, bx, bz] of sides) {
      const o = pos.length / 3;
      pos.push(ax, 0, az, bx, 0, bz, bx, 1, bz, ax, 1, az);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2));
    geo.setIndex(idx);
    const top = new Float32Array(list.length * 4), size = new Float32Array(list.length * 3);
    list.forEach(([x, y, z, sx, sz, fy], i) => { top.set([x, y, z, i * 7.31], i * 4); size.set([sx, sz, Math.max(0.5, y - fy)], i * 3); });
    geo.setAttribute('aTop', new THREE.InstancedBufferAttribute(top, 4));
    geo.setAttribute('aSize', new THREE.InstancedBufferAttribute(size, 3));
    geo.instanceCount = list.length;
    this.mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: /* glsl */ `
        in vec4 aTop;
        in vec3 aSize;
        uniform vec3 uSunDir;
        out vec2 vUv;
        out float vSeed;
        out vec4 vClip;
        void main() {
          float t = position.y;
          // the beam leans away from the sun, and spreads a little on its way down
          vec2 lean = -uSunDir.xz / max(uSunDir.y, 0.4);
          vec3 p = aTop.xyz + vec3(position.x * aSize.x * (1.0 + t * 0.35), -t * aSize.z, position.z * aSize.y * (1.0 + t * 0.35));
          p.xz += lean * t * aSize.z;
          vUv = uv;
          vSeed = aTop.w;
          vClip = projectionMatrix * viewMatrix * vec4(p, 1.0);
          gl_Position = vClip;
        }`,
      fragmentShader: /* glsl */ `
        precision highp float;
        uniform sampler2D tDepth;
        uniform vec3 uClip;
        uniform vec3 uColor;
        uniform float uStrength;
        uniform float uTime;
        in vec2 vUv;
        in float vSeed;
        in vec4 vClip;
        layout(location = 0) out vec4 outColor;
        float linZ(float d, vec3 clip) { return clip.z > 0.5 ? clip.x * clip.y / (clip.y - d * (clip.y - clip.x)) : clip.x + d * (clip.y - clip.x); }
        void main() {
          float across = sin(3.14159 * vUv.x);
          across *= across;
          float t = vUv.y;
          float a = across * smoothstep(0.0, 0.06, t) * (1.0 - t * 0.5) * (1.0 - smoothstep(0.82, 1.0, t));
          // motes of dust turning slowly in the light
          a *= 0.8 + 0.2 * sin(t * 37.0 + uTime * 0.6 + vSeed) * sin(vUv.x * 13.0 - uTime * 0.4 + vSeed * 3.0);
          vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
          float lz = linZ(vClip.z / vClip.w * 0.5 + 0.5, uClip);
          a *= clamp((linZ(texture(tDepth, suv).r, uClip) - lz) * 1.5, 0.0, 1.0);
          if (uClip.z > 0.5) a *= smoothstep(0.4, 1.6, lz);
          a *= uStrength;
          outColor = vec4(uColor * a, 0.0);
        }`,
      uniforms: {
        uSunDir: r.shared.uSunDir,
        uTime: r.shared.uTime,
        uColor: { value: new THREE.Color(1, 0.86, 0.62) },
        uStrength: { value: 0 },
        tDepth: r.particleDepth,
        uClip: r.clip,
      },
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.CustomBlending,
      blendSrc: THREE.OneFactor,
      blendDst: THREE.OneMinusSrcAlphaFactor,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.visible = list.length > 0;
    r.particleScene.add(this.mesh);
  }

  /** The beams follow the sun: strongest at midday, gone below about fifteen degrees and at night. */
  update(sunDir: THREE.Vector3, sunColor: THREE.Color, night: number): void {
    const s = THREE.MathUtils.smoothstep(sunDir.y, 0.22, 0.55) * (1 - night);
    this.mat.uniforms.uStrength.value = s * 0.22;
    this.mat.uniforms.uColor.value.copy(sunColor).multiplyScalar(0.9).lerp(new THREE.Color(1, 0.84, 0.6), 0.35);
    this.mesh.visible = s > 0.01 && (this.mesh.geometry as THREE.InstancedBufferGeometry).instanceCount > 0;
  }
}
