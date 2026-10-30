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

/** All particles in one instanced draw call, animated entirely on the GPU. */
export class Particles {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private sparkleStart = 0;
  private origins: Float32Array;
  private seeds: Float32Array;
  private geo: THREE.InstancedBufferGeometry;

  constructor(r: Renderer, emitters: Emitter[], sparkles: [number, number, number][]) {
    const list: { o: [number, number, number]; s: [number, number, number, number] }[] = [];
    const rnd = rng(7);
    for (const e of emitters) {
      const n = e.kind === 'smoke' ? 22 : e.kind === 'incense' ? 18 : 14;
      const kind = KIND[e.kind];
      for (let i = 0; i < n; i++) list.push({ o: [e.pos[0] + (rnd() - 0.5) * 0.4, e.pos[1], e.pos[2] + (rnd() - 0.5) * 0.4], s: [i / n + rnd() * 0.05, 0.8 + rnd() * 0.5 * e.rate, e.kind === 'smoke' ? 0.32 : 0.26, kind] });
    }
    for (let i = 0; i < 520; i++) list.push({ o: [rnd() * 72, rnd() * 7, 36 + rnd() * 18], s: [rnd(), 0.6 + rnd() * 0.8, 0.07, KIND.petal] });
    for (let i = 0; i < 46; i++) list.push({ o: [rnd() * 70 + 1, 0.6 + rnd() * 1.2, 41 + rnd() * 13], s: [rnd(), 0.5 + rnd(), 0.09, KIND.firefly] });
    this.sparkleStart = list.length;
    for (const sp of sparkles) for (let i = 0; i < 6; i++) list.push({ o: [sp[0] + (rnd() - 0.5) * 0.5, sp[1] + 0.2 + rnd() * 0.6, sp[2] + (rnd() - 0.5) * 0.5], s: [rnd(), 0.8 + rnd(), 0.07, KIND.sparkle] });

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
