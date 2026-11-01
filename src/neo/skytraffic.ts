import * as THREE from 'three';
import { Prop } from '../world/props';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom } from '../game/actors';
import { voxelMaterial, type Renderer } from '../engine/renderer';
import { SKY_LANES } from '../world/neoPlan';

/**
 * Halcyon's sky lanes: flying cars running in both directions along the avenues and the rings, high over the
 * streets, white lights ahead and red behind. Three liveries share one instanced draw each; every car is moved
 * on the CPU (a few dozen matrices a frame).
 */

interface Lane { ew: boolean; c: number; y: number; a0: number; a1: number }
interface Car { lane: Lane; dir: 1 | -1; off: number; t: number; speed: number; bob: number; mesh: number; slot: number }

const LANES: Lane[] = SKY_LANES;

const LIVERIES: [number, number][] = [[0x1a1c24, 0x2ad8ff], [0xe8e4da, 0xff5fb4], [0xf2c74a, 0x16161c]];
const PER = 14;

function carProp(pal: Palette, body: number, trim: number): Prop {
  const B = pal.add(body, { vary: 0.03 }), T = pal.add(trim, { vary: 0.02, emit: 0.6 }), G = pal.add(0x2a3a52, { vary: 0.02, glass: true });
  const D = pal.add(0x101116), H = pal.add(0xfff4dc, { emit: 1.0 }), R = pal.add(0xff2a3a, { emit: 1.0 }), J = pal.add(0x46e8ff, { emit: 0.9 });
  // 7 wide, 4 high, 16 long (z forward), 0.25 m voxels: a low wedge with a canopy and two thruster pods
  const p = new Prop(9, 5, 16, 0.25);
  p.box(1, 0, 1, 7, 1, 14, B);
  p.box(2, 2, 4, 6, 3, 10, G);
  p.box(2, 2, 11, 6, 2, 12, B);
  p.box(1, 1, 0, 7, 1, 0, T);
  p.box(0, 0, 3, 0, 1, 6, D); p.box(8, 0, 3, 8, 1, 6, D);
  p.box(0, 0, 10, 0, 1, 13, D); p.box(8, 0, 10, 8, 1, 13, D);
  p.set(0, 0, 4, J); p.set(8, 0, 4, J); p.set(0, 0, 11, J); p.set(8, 0, 11, J);
  p.set(2, 1, 15, H); p.set(6, 1, 15, H); p.set(3, 1, 15, H); p.set(5, 1, 15, H);
  p.box(2, 1, 0, 6, 1, 0, R);
  return p;
}

export class SkyTraffic {
  private meshes: THREE.InstancedMesh[] = [];
  private cars: Car[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private s = new THREE.Vector3(1, 1, 1);
  private p = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);

  constructor(scene: THREE.Scene, r: Renderer) {
    const mat = voxelMaterial(r.shared);
    LIVERIES.forEach(([body, trim], k) => {
      const pal = new Palette();
      const prop = carProp(pal, body, trim);
      const md = meshGrid({ grid: prop.grid, pal, scale: 0.25, origin: [-1.125, 0, -2], greedy: false });
      const mesh = new THREE.InstancedMesh(geometryFrom(md), mat, PER);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes[k] = mesh;
    });
    let seed = 31337;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    const total = PER * LIVERIES.length;
    for (let i = 0; i < total; i++) {
      const lane = LANES[i % LANES.length];
      const k = i % LIVERIES.length;
      this.cars.push({ lane, dir: rnd() < 0.5 ? 1 : -1, off: 0, t: rnd(), speed: 16 + rnd() * 10, bob: rnd() * 6.28, mesh: k, slot: this.meshes[k].count++ });
    }
    for (const c of this.cars) c.off = c.dir * 3.2;
  }

  update(dt: number, time: number): void {
    for (const c of this.cars) {
      const L = c.lane, span = L.a1 - L.a0;
      c.t = (c.t + (c.speed * dt * c.dir) / span + 1) % 1;
      const a = L.a0 + c.t * span;
      const y = L.y + Math.sin(time * 0.6 + c.bob) * 0.4 + (c.dir > 0 ? 0 : 2.5);
      if (L.ew) this.p.set(a, y, L.c + c.off); else this.p.set(L.c + c.off, y, a);
      const yaw = L.ew ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
      this.q.setFromAxisAngle(this.up, yaw);
      this.m.compose(this.p, this.q, this.s);
      this.meshes[c.mesh].setMatrixAt(c.slot, this.m);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}
