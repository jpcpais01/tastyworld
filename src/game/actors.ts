import * as THREE from 'three';
import { meshGrid, STRIDE, MeshData } from '../world/mesher';
import { CharModel, PART } from '../world/characters';
import { voxelMaterial, SharedUniforms } from '../engine/renderer';
import type { LightMap2D } from '../world/bake';

export function geometryFrom(m: MeshData): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
  const ib = new THREE.InterleavedBuffer(m.attrs, STRIDE);
  g.setAttribute('aPack', new THREE.InterleavedBufferAttribute(ib, 4, 0, false));
  g.setAttribute('aColor', new THREE.InterleavedBufferAttribute(ib, 4, 4, true));
  g.setAttribute('aLight', new THREE.InterleavedBufferAttribute(ib, 4, 8, true));
  g.setAttribute('aQuad', new THREE.InterleavedBufferAttribute(ib, 4, 12, false));
  if (m.vertexCount < 65536) g.setIndex(new THREE.BufferAttribute(Uint16Array.from(m.indices), 1));
  else g.setIndex(new THREE.BufferAttribute(m.indices, 1));
  const [x0, y0, z0, x1, y1, z1] = m.bounds;
  g.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
  g.boundingSphere = g.boundingBox.getBoundingSphere(new THREE.Sphere());
  return g;
}

/** Sample the baked character light map (sun, sky, lamp rgb) at a world position. */
export function sampleLightmap(lm: LightMap2D, x: number, z: number, out: Float32Array): void {
  const fx = (x - lm.ox) / lm.cell - 0.5, fz = (z - lm.oz) / lm.cell - 0.5;
  const x0 = Math.max(0, Math.min(lm.sx - 2, Math.floor(fx))), z0 = Math.max(0, Math.min(lm.sz - 2, Math.floor(fz)));
  const tx = Math.max(0, Math.min(1, fx - x0)), tz = Math.max(0, Math.min(1, fz - z0));
  for (let c = 0; c < 5; c++) {
    const a = lm.data[(z0 * lm.sx + x0) * 5 + c], b = lm.data[(z0 * lm.sx + x0 + 1) * 5 + c];
    const d = lm.data[((z0 + 1) * lm.sx + x0) * 5 + c], e = lm.data[((z0 + 1) * lm.sx + x0 + 1) * 5 + c];
    const v = (a * (1 - tx) + b * tx) * (1 - tz) + (d * (1 - tx) + e * tx) * tz;
    out[c] = c < 2 ? v / 255 : (v / 255) * 2;
  }
}

export type Anim = 'idle' | 'walk' | 'run' | 'cook' | 'eat' | 'wave' | 'sit' | 'bow';

const tmpL = new Float32Array(5);

/** A voxel character (person or cat) animated in the vertex shader. */
export class Actor {
  readonly root = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private rot: THREE.Vector2[];
  private uBob = { value: 0 };
  private uCharLight = { value: new THREE.Vector3(1, 1, 0) };
  private uCharLamp = { value: new THREE.Vector3() };
  private uFlash = { value: 0 };
  anim: Anim = 'idle';
  phase = Math.random() * 10;
  speed = 0;
  facing = 0;
  targetFacing = 0;
  headYaw = 0;
  headYawTarget = 0;
  animT = Math.random() * 10;
  flash = 0;
  sun = 1;
  readonly isCat: boolean;

  constructor(model: CharModel, shared: SharedUniforms, isCat = false) {
    this.isCat = isCat;
    const md = meshGrid({ grid: model.grid, pal: model.pal, scale: model.scale, origin: model.origin, parts: model.parts, greedy: false });
    const geo = geometryFrom(md);
    this.rot = Array.from({ length: 8 }, () => new THREE.Vector2());
    this.mat = voxelMaterial(shared, { CHARACTER: 1 }, {
      uPivot: { value: model.pivots.map((p) => new THREE.Vector3(...p)) },
      uRot: { value: this.rot },
      uBob: this.uBob,
      uCharLight: this.uCharLight,
      uCharLamp: this.uCharLamp,
      uFlash: this.uFlash,
    });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.frustumCulled = true;
    this.root.add(this.mesh);
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.mat.dispose();
  }

  get position(): THREE.Vector3 {
    return this.root.position;
  }

  light(lm: LightMap2D): void {
    sampleLightmap(lm, this.root.position.x, this.root.position.z, tmpL);
    this.sun = tmpL[0];
    this.uCharLight.value.set(tmpL[0], Math.max(0.35, tmpL[1]), 0);
    this.uCharLamp.value.set(tmpL[2], tmpL[3], tmpL[4]);
  }

  update(dt: number): void {
    this.animT += dt;
    // smooth facing
    let d = this.targetFacing - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 12);
    this.root.rotation.y = this.facing;
    let hd = this.headYawTarget - this.headYaw;
    hd = Math.atan2(Math.sin(hd), Math.cos(hd));
    this.headYaw += hd * Math.min(1, dt * 5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.uFlash.value = this.flash * 0.6;

    const r = this.rot;
    for (const v of r) v.set(0, 0);
    let bob = 0;
    const t = this.animT;
    if (this.isCat) {
      if (this.anim === 'walk' || this.anim === 'run') {
        this.phase += dt * this.speed * 9;
        const s = Math.sin(this.phase) * 0.7;
        r[PART.armL].x = s; r[PART.armR].x = -s; r[PART.legL].x = -s; r[PART.legR].x = s;
        bob = Math.abs(Math.cos(this.phase)) * 0.015;
      } else if (this.anim === 'sit') {
        r[PART.legL].x = -1.2; r[PART.legR].x = -1.2;
        bob = -0.04;
      }
      r[PART.tail].y = Math.sin(t * 2.2) * 0.5;
      r[PART.tail].x = 0.3 + Math.sin(t * 1.3) * 0.15;
      r[PART.head].y = this.headYaw;
      this.uBob.value = bob;
      return;
    }
    switch (this.anim) {
      case 'walk':
      case 'run': {
        const k = this.anim === 'run' ? 1.25 : 1;
        this.phase += dt * this.speed * 4.6;
        const s = Math.sin(this.phase);
        r[PART.legL].x = s * 0.62 * k; r[PART.legR].x = -s * 0.62 * k;
        r[PART.armL].x = -s * 0.5 * k; r[PART.armR].x = s * 0.5 * k;
        r[PART.head].x = 0.04;
        bob = Math.abs(Math.cos(this.phase)) * 0.035 * k;
        break;
      }
      case 'cook':
        r[PART.armR].x = -1.1 + Math.sin(t * 7) * 0.25;
        r[PART.armL].x = -0.8 + Math.sin(t * 3.5 + 1) * 0.12;
        r[PART.head].x = 0.25;
        bob = Math.sin(t * 7) * 0.006;
        break;
      case 'eat':
        r[PART.armR].x = -2.0 + Math.max(0, Math.sin(t * 4)) * 0.4;
        r[PART.head].x = -0.1 + Math.max(0, Math.sin(t * 4)) * 0.1;
        bob = Math.sin(t * 8) * 0.008;
        break;
      case 'wave':
        r[PART.armR].x = -2.7;
        r[PART.armR].y = Math.sin(t * 9) * 0.35;
        bob = Math.abs(Math.sin(t * 4.5)) * 0.01;
        break;
      case 'bow':
        r[PART.head].x = 0.5;
        bob = -0.02;
        break;
      default: {
        // idle: breathing and the occasional glance
        bob = Math.sin(t * 2.0) * 0.006;
        r[PART.armL].x = Math.sin(t * 2.0) * 0.03;
        r[PART.armR].x = -Math.sin(t * 2.0) * 0.03;
      }
    }
    r[PART.head].y = this.headYaw;
    this.uBob.value = bob;
  }
}
