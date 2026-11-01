import * as THREE from 'three';
import { Prop } from '../world/props';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom, type Actor } from '../game/actors';
import { voxelMaterial, type Renderer } from '../engine/renderer';

/**
 * Halcyon's umbrellas: when a shower comes in, people on foot put up umbrellas with lit shafts and glowing rims,
 * held up in the right hand by the arm IK. One instanced draw per colour; only bodies drawn this frame get one.
 */

/** What the crowd hands over for each walker: the body, and whether it walks (not runs, rides or sits). */
export interface UmbrellaHolder { actor: Actor; onFoot: boolean; key: number; always?: boolean }

const COLOURS: [number, number][] = [[0x1a2a3a, 0x46e8ff], [0x2a1a2e, 0xff5fb4], [0x26221a, 0xffc24a], [0x1c1c22, 0xe8f4ff], [0x182a22, 0x6aff9a]];
const PER = 48;
const S = 0.125;

function umbrella(pal: Palette, canopy: number, glow: number): Prop {
  // the canopy is translucent fabric lit from its own shaft: a dim wash of the glow colour over the dark cloth
  const tint = new THREE.Color(canopy).lerp(new THREE.Color(glow), 0.4).getHex();
  const C = pal.add(tint, { vary: 0.04, emit: 0.22 }), L = pal.add(glow, { emit: 1.0 }), D = pal.add(glow, { emit: 0.55, vary: 0.05 });
  const H = pal.add(0x101014);
  // 13 x 11 x 13 at 1/8 m: the shaft rises from the grip (y 0) to a shallow dome 1.2 m up
  const p = new Prop(13, 11, 13, S);
  p.box(6, 0, 6, 6, 1, 6, H);
  p.box(6, 2, 6, 6, 10, 6, L);
  for (let x = 0; x < 13; x++) for (let z = 0; z < 13; z++) {
    const r = Math.hypot(x - 6, z - 6);
    if (r <= 6.4 && r > 5.3) p.set(x, 8, z, D); // the lit rim
    else if (r <= 5.3) p.set(x, 9, z, C);
    if (r <= 3.4) p.set(x, 10, z, C);
    // ribs: thin glowing spokes on the underside, every 45 degrees
    if (r > 1 && r <= 5.3 && (Math.abs(x - 6) < 0.5 || Math.abs(z - 6) < 0.5 || Math.abs(Math.abs(x - 6) - Math.abs(z - 6)) < 0.5)) p.set(x, 8, z, D);
  }
  return p;
}

export class Umbrellas {
  private meshes: THREE.InstancedMesh[] = [];
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private one = new THREE.Vector3(1, 1, 1);
  private v = new THREE.Vector3();
  private up = new THREE.Vector3(0, 1, 0);
  private held = new Set<Actor>();

  constructor(scene: THREE.Object3D, r: Renderer) {
    const mat = voxelMaterial(r.shared);
    for (const [c, g] of COLOURS) {
      const pal = new Palette();
      const md = meshGrid({ grid: umbrella(pal, c, g).grid, pal, scale: S, origin: [-6.5 * S, 0, -6.5 * S], greedy: false });
      const mesh = new THREE.InstancedMesh(geometryFrom(md), mat, PER);
      mesh.frustumCulled = false;
      mesh.count = 0;
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  update(holders: Iterable<UmbrellaHolder>, rain: number): void {
    const counts = this.meshes.map(() => 0);
    const now = new Set<Actor>();
    for (const h of holders) {
      const a = h.actor;
      // `always`: the crowd has already decided who carries one (see Crowd.brolly); the player always does
      const on = h.onFoot && !!h.always && rain > 0.15;
      const r = a.reach[1];
      if (!on) {
        if (this.held.has(a)) r.on = false;
        continue;
      }
      // the right fist up in front of the shoulder, the shaft straight up from it
      r.on = true;
      r.pos.set(0.24, 1.02, 0.22);
      now.add(a);
      const k = h.key % this.meshes.length;
      if (counts[k] >= PER) continue;
      a.grip(1, this.v);
      this.v.applyMatrix4(a.root.matrixWorld);
      // drawn only once the arm is most of the way up, so it never floats at the hip
      if (r.w < 0.6) continue;
      this.q.setFromAxisAngle(this.up, a.facing);
      this.m.compose(this.v, this.q, this.one);
      this.meshes[k].setMatrixAt(counts[k]++, this.m);
    }
    for (const a of this.held) if (!now.has(a)) a.reach[1].on = false;
    this.held = now;
    this.meshes.forEach((m, k) => { m.count = counts[k]; m.instanceMatrix.needsUpdate = true; });
  }
}
