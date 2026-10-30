import * as THREE from 'three';
import { meshGrid, STRIDE, MeshData } from '../world/mesher';
import { CharModel, PART, PART_COUNT, CHAR_SCALE } from '../world/characters';
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

export type Anim =
  | 'idle' | 'walk' | 'run' | 'cook' | 'eat' | 'wave' | 'sit' | 'sitEat' | 'bow'
  | 'talk' | 'listen' | 'phone' | 'photo' | 'browse' | 'startle';
/** Something carried in the hands while walking or standing. */
export type Hold = 'none' | 'food' | 'phone';

const tmpL = new Float32Array(5);
const NP = PART_COUNT;
/** Pose layout: pitch, yaw, roll per part, then the root offset. */
const PS = NP * 3 + 3, OFF = NP * 3;
const HIP_H = 8 * CHAR_SCALE; // hip pivot to sole
/**
 * How far below a seat's top surface a seated character's feet origin goes: in the sit pose the
 * underside of the thighs is this far above the origin (hip height minus half a thigh's thickness,
 * tilted). Checked by scripts/gait-check.ts.
 */
export const SIT_DROP = 0.415;
const TAU = Math.PI * 2;
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const expK = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/** Idle fidgets: glance around, stretch, scratch the head, check the time, shuffle the feet. */
const FIDGETS = 5;

/**
 * A voxel character (person or cat) animated in the vertex shader with a small skeleton.
 * Locomotion is procedural: stride length follows speed so planted feet do not slide, the hips
 * drop as the stance leg swings, the weight shifts over the standing foot and the arms swing
 * against the legs. Other actions cross-fade from whatever pose the actor was in.
 */
export class Actor {
  /** Called whenever a foot touches the ground in the walk or run cycle (footstep sounds). */
  static onStep: ((a: Actor, run: boolean) => void) | null = null;
  readonly root = new THREE.Group();
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.ShaderMaterial;
  private rot: THREE.Vector3[];
  private uOffset = { value: new THREE.Vector3() };
  private uCharLight = { value: new THREE.Vector3(1, 1, 0) };
  private uCharLamp = { value: new THREE.Vector3() };
  private uFlash = { value: 0 };
  anim: Anim = 'idle';
  hold: Hold = 'none';
  phase = Math.random() * 10;
  /** Ground speed in m/s; drives the stride. */
  speed = 0;
  facing = 0;
  targetFacing = 0;
  headYaw = 0;
  headYawTarget = 0;
  animT = Math.random() * 10;
  flash = 0;
  sun = 1;
  readonly isCat: boolean;

  private cur = new Float32Array(PS);
  private from = new Float32Array(PS);
  private act = new Float32Array(PS);
  private loco = new Float32Array(PS);
  private base: Anim = 'idle';
  private fade = 1;
  private vs = 0;
  private locoW = 0;
  private runW = 0;
  private holdW = 0;
  private held: Hold = 'none';
  private turn = 0;
  private fidget = -1;
  private fidgetT = 0;
  private fidgetDur = 1;
  private fidgetNext = 2 + Math.random() * 6;
  private fidgetSide = 1;
  // a little personality in every body
  private seed = Math.random() * 100;
  private swing = 0.85 + Math.random() * 0.3;
  private posture = (Math.random() - 0.4) * 0.07;
  private bounce = 0.8 + Math.random() * 0.4;

  constructor(model: CharModel, shared: SharedUniforms, isCat = false) {
    this.isCat = isCat;
    const md = meshGrid({ grid: model.grid, pal: model.pal, scale: model.scale, origin: model.origin, parts: model.parts, greedy: false });
    const geo = geometryFrom(md);
    this.rot = Array.from({ length: NP }, () => new THREE.Vector3());
    const piv = Array.from({ length: NP }, (_, i) => new THREE.Vector3(...(model.pivots[i] ?? [0, 0, 0])));
    this.mat = voxelMaterial(shared, { CHARACTER: 1 }, {
      uPivot: { value: piv },
      uRot: { value: this.rot },
      uOffset: this.uOffset,
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

  /** True while the walk cycle is still winding down. */
  get moving(): boolean {
    return this.anim === 'walk' || this.anim === 'run';
  }

  light(lm: LightMap2D): void {
    sampleLightmap(lm, this.root.position.x, this.root.position.z, tmpL);
    this.sun = tmpL[0];
    this.uCharLight.value.set(tmpL[0], Math.max(0.35, tmpL[1]), 0);
    this.uCharLamp.value.set(tmpL[2], tmpL[3], tmpL[4]);
  }

  update(dt: number): void {
    this.animT += dt;
    // smooth facing; remember how fast we turn to lean into curves
    let d = this.targetFacing - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    const df = d * Math.min(1, dt * 12);
    this.facing += df;
    this.turn += (df / Math.max(dt, 1e-3) - this.turn) * expK(10, dt);
    this.root.rotation.y = this.facing;
    let hd = this.headYawTarget - this.headYaw;
    hd = Math.atan2(Math.sin(hd), Math.cos(hd));
    this.headYaw += hd * Math.min(1, dt * 5);
    this.flash = Math.max(0, this.flash - dt * 2.5);
    this.uFlash.value = this.flash * 0.6;

    const moving = this.moving;
    this.vs += ((moving ? this.speed : 0) - this.vs) * expK(moving ? 7 : 5, dt);
    this.locoW += ((moving ? 1 : 0) - this.locoW) * expK(moving ? 9 : 6, dt);
    this.runW += ((this.anim === 'run' ? 1 : 0) - this.runW) * expK(5, dt);
    if (this.hold !== 'none') this.held = this.hold;
    this.holdW += ((this.hold !== 'none' ? 1 : 0) - this.holdW) * expK(6, dt);

    // cross-fade whenever the underlying action changes
    const base: Anim = moving ? 'idle' : this.anim;
    if (base !== this.base) {
      this.from.set(this.cur);
      this.fade = 0;
      this.base = base;
      if (base !== 'idle') this.fidget = -1;
    }
    this.fade = Math.min(1, this.fade + dt * 4);

    const act = this.act;
    act.fill(0);
    if (this.isCat) this.catPose(dt, act);
    else {
      this.tickFidget(dt, base);
      this.actionPose(base, act);
      if (this.locoW > 0.002 || this.vs > 0.01) {
        this.locoPose(dt, this.loco);
        mixInto(act, this.loco, this.locoW);
      }
      if (this.holdW > 0.002) this.holdPose(act, this.holdW);
      // lean into turns
      const lean = THREE.MathUtils.clamp(-this.turn * this.vs * 0.03, -0.16, 0.16) * this.locoW;
      act[0 * 3 + 2] += lean;
      act[7 * 3 + 2] += lean * 0.6;
    }
    const f = sstep(0, 1, this.fade), cur = this.cur, from = this.from;
    for (let i = 0; i < PS; i++) cur[i] = from[i] + (act[i] - from[i]) * f;

    const r = this.rot;
    for (let i = 0; i < NP; i++) r[i].set(cur[i * 3], cur[i * 3 + 1], cur[i * 3 + 2]);
    r[PART.head].y += this.headYaw;
    this.uOffset.value.set(cur[OFF], cur[OFF + 1], cur[OFF + 2]);
  }

  private tickFidget(dt: number, base: Anim): void {
    if (base !== 'idle' || this.holdW > 0.5) { this.fidget = -1; return; }
    if (this.fidget >= 0) {
      this.fidgetT += dt;
      if (this.fidgetT >= this.fidgetDur) { this.fidget = -1; this.fidgetNext = 3 + Math.random() * 7; }
    } else if ((this.fidgetNext -= dt) <= 0) {
      this.fidget = Math.floor(Math.random() * FIDGETS);
      // glancing around is the most common, and makes no sense while already looking at someone
      if (Math.abs(this.headYawTarget) > 0.05 && this.fidget === 0) this.fidget = 4;
      this.fidgetT = 0;
      this.fidgetDur = [2.2, 2.4, 2.0, 2.2, 1.6][this.fidget] * (0.85 + Math.random() * 0.3);
      this.fidgetSide = Math.random() < 0.5 ? -1 : 1;
    }
  }

  /** Standing weight: breathing, a slow shift from foot to foot, one knee relaxed. */
  private stance(p: Float32Array, t: number): void {
    const br = Math.sin(t * 1.9 + this.seed);
    const ws = Math.sin(t * 0.37 + this.seed * 1.7);
    set(p, PART.body, 0.02 + this.posture + br * 0.012, 0, ws * 0.02);
    set(p, PART.hips, 0, 0, -ws * 0.03);
    set(p, PART.head, -this.posture * 0.5 + br * 0.008, 0, -ws * 0.015);
    set(p, PART.armL, br * 0.02, 0, -0.07);
    set(p, PART.armR, -br * 0.02, 0, 0.07);
    set(p, PART.foreL, -0.12, 0, 0);
    set(p, PART.foreR, -0.12, 0, 0);
    const kl = Math.max(0, ws) * 0.16, kr = Math.max(0, -ws) * 0.16;
    set(p, PART.legL, -kl * 0.45, 0, 0); set(p, PART.shinL, kl, 0, 0);
    set(p, PART.legR, -kr * 0.45, 0, 0); set(p, PART.shinR, kr, 0, 0);
    p[OFF] = ws * 0.012;
    p[OFF + 1] = -0.004 + br * 0.003 - (kl + kr) * 0.02;
  }

  private sitLegs(p: Float32Array, t: number): void {
    const sw = Math.sin(t * 0.8 + this.seed) * 0.08;
    set(p, PART.legL, -1.45, 0, -0.04); set(p, PART.legR, -1.45, 0, 0.04);
    set(p, PART.shinL, 1.25 + sw, 0, 0); set(p, PART.shinR, 1.25 - sw, 0, 0);
    set(p, PART.body, 0.05 + this.posture * 0.5 + Math.sin(t * 1.9) * 0.01, 0, 0);
    p[OFF + 1] = Math.sin(t * 1.9) * 0.003;
  }

  private eatArms(p: Float32Array, t: number): void {
    const bite = Math.pow(Math.max(0, Math.sin(t * 2.6 + this.seed)), 3);
    set(p, PART.armR, -0.55 - 0.4 * bite, -0.5, 0);
    set(p, PART.foreR, -1.45 - 0.5 * bite, 0, 0);
    set(p, PART.armL, -0.45, 0.4, 0);
    set(p, PART.foreL, -1.1, 0, 0);
    const chew = Math.max(0, Math.sin(t * 9)) * 0.03 * (1 - bite);
    add(p, PART.head, 0.16 - 0.14 * bite + chew, 0, 0);
  }

  private actionPose(base: Anim, p: Float32Array): void {
    const t = this.animT;
    switch (base) {
      case 'cook': {
        this.stance(p, t);
        const flip = Math.pow(Math.max(0, Math.sin(t * 1.3 + this.seed)), 10);
        set(p, PART.body, 0.13 + Math.sin(t * 3.5) * 0.02, Math.sin(t * 0.9) * 0.06, p[2]);
        set(p, PART.armR, -0.65 + Math.sin(t * 7) * 0.22 - flip * 0.6, -0.25, 0);
        set(p, PART.foreR, -0.85 - flip * 0.45, 0, 0);
        set(p, PART.armL, -0.5 + Math.sin(t * 3.5 + 1) * 0.1, 0.25, 0);
        set(p, PART.foreL, -0.75, 0, 0);
        set(p, PART.head, 0.22 - flip * 0.18, 0, 0);
        p[OFF + 1] += Math.sin(t * 7) * 0.004;
        break;
      }
      case 'eat':
        this.stance(p, t);
        this.eatArms(p, t);
        break;
      case 'wave': {
        this.stance(p, t);
        set(p, PART.armR, -0.25, 0, 2.3);
        set(p, PART.foreR, 0, 0, 0.55 + Math.sin(t * 9) * 0.45);
        add(p, PART.body, 0, 0, -0.05);
        add(p, PART.head, 0, 0, 0.08);
        p[OFF + 1] += Math.abs(Math.sin(t * 4.5)) * 0.006;
        break;
      }
      case 'bow':
        this.stance(p, t);
        set(p, PART.body, 0.55, 0, 0);
        set(p, PART.head, 0.2, 0, 0);
        set(p, PART.armL, 0.05, 0, -0.03); set(p, PART.armR, 0.05, 0, 0.03);
        set(p, PART.foreL, -0.1, 0, 0); set(p, PART.foreR, -0.1, 0, 0);
        break;
      case 'sit':
        // seated on a stool, bench or cushion: knees bent, hands resting on the lap or the table
        this.sitLegs(p, t);
        set(p, PART.armL, -0.55 + Math.sin(t * 1.3) * 0.03, 0.12, 0);
        set(p, PART.foreL, -0.55, 0, 0);
        set(p, PART.armR, -0.6 + Math.max(0, Math.sin(t * 0.9)) * 0.2, -0.12, 0);
        set(p, PART.foreR, -0.55 - Math.max(0, Math.sin(t * 0.9)) * 0.25, 0, 0);
        set(p, PART.head, 0.05 + Math.sin(t * 0.6) * 0.05, 0, Math.sin(t * 0.43) * 0.04);
        break;
      case 'sitEat':
        this.sitLegs(p, t);
        this.eatArms(p, t);
        break;
      case 'talk': {
        this.stance(p, t);
        const g1 = Math.sin(t * 2.7 + this.seed), g2 = Math.sin(t * 4.1 + this.seed);
        set(p, PART.armR, -0.35 + 0.2 * g1, -0.25, 0.1);
        set(p, PART.foreR, -1.0 + 0.35 * g2, 0, 0);
        set(p, PART.armL, -0.2 + 0.15 * Math.sin(t * 1.9), 0.15, -0.1);
        set(p, PART.foreL, -0.6 - 0.35 * Math.max(0, Math.sin(t * 2.3)), 0, 0);
        add(p, PART.head, 0.04 + 0.05 * Math.sin(t * 5.3), 0, 0.06 * Math.sin(t * 1.1));
        add(p, PART.body, 0, 0.08 * Math.sin(t * 1.4), 0);
        break;
      }
      case 'listen': {
        this.stance(p, t);
        const nod = Math.pow(Math.max(0, Math.sin(t * 1.15 + this.seed)), 6);
        const laugh = Math.pow(Math.max(0, Math.sin(t * 0.37 + this.seed)), 24);
        set(p, PART.armL, -0.5, 0.7, 0); set(p, PART.foreL, -1.55, 0, 0);
        set(p, PART.armR, -0.62, -0.7, 0); set(p, PART.foreR, -1.5, 0, 0);
        add(p, PART.head, nod * 0.16 - laugh * 0.15, 0, 0.05);
        add(p, PART.body, -laugh * 0.1, 0, 0);
        p[OFF + 1] += laugh * Math.abs(Math.sin(t * 16)) * 0.008;
        break;
      }
      case 'phone':
        this.stance(p, t);
        this.phoneArms(p, t, 1);
        break;
      case 'photo': {
        this.stance(p, t);
        const snap = Math.pow(Math.max(0, Math.sin(t * 1.7)), 30);
        set(p, PART.armR, -1.25, -0.35, 0); set(p, PART.foreR, -0.55 - snap * 0.1, 0, 0);
        set(p, PART.armL, -1.25, 0.35, 0); set(p, PART.foreL, -0.55, 0, 0);
        set(p, PART.head, -0.05, 0, 0);
        add(p, PART.body, -0.05, 0, 0);
        break;
      }
      case 'browse': {
        this.stance(p, t);
        set(p, PART.armR, -0.45, -0.45, 0); set(p, PART.foreR, -1.95, 0, 0);
        set(p, PART.armL, -0.35, 0.6, 0); set(p, PART.foreL, -1.35, 0, 0);
        add(p, PART.head, 0.14 + Math.sin(t * 0.5) * 0.06, Math.sin(t * 0.6 + this.seed) * 0.35, 0.04);
        break;
      }
      case 'startle':
        this.stance(p, t);
        set(p, PART.body, -0.22, 0, 0);
        set(p, PART.head, -0.15, 0, 0);
        set(p, PART.armL, -0.7, 0, -0.5); set(p, PART.armR, -0.7, 0, 0.5);
        set(p, PART.foreL, -1.1, 0, 0); set(p, PART.foreR, -1.1, 0, 0);
        set(p, PART.shinL, 0.15, 0, 0); set(p, PART.shinR, 0.15, 0, 0);
        p[OFF + 1] += 0.012;
        break;
      default: {
        this.stance(p, t);
        if (this.fidget >= 0) this.fidgetPose(p, t);
      }
    }
  }

  private phoneArms(p: Float32Array, t: number, w: number): void {
    const scroll = Math.max(0, Math.sin(t * 3.1)) * 0.06;
    lerpPart(p, PART.armR, -0.6, -0.45, 0, w); lerpPart(p, PART.foreR, -1.25 - scroll, 0, 0, w);
    lerpPart(p, PART.armL, -0.6, 0.45, 0, w); lerpPart(p, PART.foreL, -1.25, 0, 0, w);
    p[PART.head * 3] += 0.4 * w;
  }

  private fidgetPose(p: Float32Array, t: number): void {
    const u = this.fidgetT / this.fidgetDur;
    const e = sstep(0, 0.22, u) * (1 - sstep(0.75, 1, u));
    const sd = this.fidgetSide;
    switch (this.fidget) {
      case 0: // glance around
        add(p, PART.head, -0.04 * e, sd * 0.75 * e * Math.sin(Math.min(1, u * 1.6) * Math.PI * 0.5), 0);
        add(p, PART.body, 0, sd * 0.12 * e, 0);
        break;
      case 1: // stretch
        lerpPart(p, PART.armL, -2.9, 0.1, -0.15, e); lerpPart(p, PART.armR, -2.9, -0.1, 0.15, e);
        lerpPart(p, PART.foreL, -0.35, 0, 0, e); lerpPart(p, PART.foreR, -0.35, 0, 0, e);
        add(p, PART.body, -0.12 * e, 0, 0);
        add(p, PART.head, -0.2 * e, 0, 0);
        p[OFF + 1] += 0.012 * e;
        break;
      case 2: // scratch the head
        lerpPart(p, PART.armR, -2.4, -0.3, 0.35, e);
        lerpPart(p, PART.foreR, -1.7 + Math.sin(t * 15) * 0.15, 0, 0, e);
        add(p, PART.head, 0.08 * e, 0, 0.15 * e);
        break;
      case 3: // check the time
        lerpPart(p, PART.armL, -0.85, 0.5, 0, e); lerpPart(p, PART.foreL, -1.5, 0, 0, e);
        add(p, PART.head, 0.35 * e, -0.3 * e, 0);
        break;
      default: { // shuffle the feet
        const a = Math.max(0, Math.sin(u * TAU)) * e, b = Math.max(0, -Math.sin(u * TAU)) * e;
        add(p, PART.legL, -0.22 * a, 0, 0); add(p, PART.shinL, 0.5 * a, 0, 0);
        add(p, PART.legR, -0.22 * b, 0, 0); add(p, PART.shinR, 0.5 * b, 0, 0);
        p[OFF] += (b - a) * 0.012;
      }
    }
  }

  /**
   * Walk and run cycle with planted feet. Each leg spends a share of the cycle on the ground,
   * sweeping back at exactly the body's speed, then swings through with the knee bent. The hips
   * ride at whatever height keeps the lower foot on the ground.
   */
  private locoPose(dt: number, p: Float32Array): void {
    p.fill(0);
    const v = this.vs, run = this.runW, L = HIP_H;
    const amp = Math.min(1, v / 0.25); // ease the cycle in and out from a standstill
    const A = THREE.MathUtils.lerp(Math.min(0.75, 0.2 + 0.13 * v), 0.85, run) * amp;
    const beta = THREE.MathUtils.lerp(0.62 - 0.03 * Math.min(3, v), 0.38, run); // stance share
    // a planted foot travels 2 L sin A while the body covers the same ground; brisk walks get a
    // touch of glide so short legs need not patter
    const glide = 1 + 0.3 * THREE.MathUtils.clamp((v - 1.5) / 1.7, 0, 1) * (1 - run);
    const stance = Math.max(0.12, 2 * L * Math.sin(Math.max(A, 0.15)));
    const half = Math.floor(this.phase / Math.PI);
    this.phase = (this.phase + (TAU * v * beta * dt) / (stance * glide)) % TAU;
    // the left foot plants at the start of the cycle, the right one half a cycle later
    if (Math.floor(this.phase / Math.PI) !== half && amp > 0.5) Actor.onStep?.(this, run > 0.5);
    const u0 = this.phase / TAU;
    const K = THREE.MathUtils.lerp(0.55 + 0.25 * Math.min(1, v / 3), 1.6, run) * amp;
    let lift = 0;
    // weight shift: the body sways over the standing foot while the legs angle in to keep both feet put
    const w = Math.cos(TAU * (u0 - beta / 2)); // +1 with the weight on the left foot
    const roll = 0.035 * w * amp * (1 - 0.5 * run);
    const sway = -0.014 * w * amp * (1 - 0.6 * run), hipRoll = -roll * 0.8;
    const splay = -(sway / L + hipRoll);
    const leg = (u: number, thigh: number, shin: number, side: number): number => {
      let th: number, kn: number, g: number;
      if (u < beta) {
        const q = u / beta;
        th = -A + 2 * A * q;
        kn = 0.3 * run * Math.sin(Math.PI * q) * amp + 0.04 * amp;
        g = -Math.cos(Math.PI * q);
      } else {
        const q = (u - beta) / (1 - beta);
        th = A * Math.cos(Math.PI * q) - 0.12 * run * Math.sin(Math.PI * q);
        kn = K * Math.sin(Math.PI * q) + 0.04 * amp;
        g = Math.cos(Math.PI * q);
      }
      set(p, thigh, th - 0.06 * run, 0, side * 0.02 + splay);
      set(p, shin, kn, 0, 0);
      // height of the hip above this sole
      lift = Math.max(lift, 0.5 * L * Math.cos(th - 0.06 * run) + 0.5 * L * Math.cos(th - 0.06 * run + kn));
      return g;
    };
    const gL = leg(u0, PART.legL, PART.shinL, -1);
    const gR = leg((u0 + 0.5) % 1, PART.legR, PART.shinR, 1);
    // arms swing against the legs, elbows bend more as the pace picks up
    const Aa = THREE.MathUtils.lerp(A * 0.8 * this.swing, 0.95 * amp, run);
    const abd = 0.06 + 0.14 * run;
    set(p, PART.armL, -Aa * gL - 0.2 * run, 0, -abd);
    set(p, PART.armR, -Aa * gR - 0.2 * run, 0, abd);
    const eb = THREE.MathUtils.lerp(0.22 + 0.06 * v, 1.35, run);
    set(p, PART.foreL, -(eb + 0.3 * Math.max(0, gR) * amp), 0, 0);
    set(p, PART.foreR, -(eb + 0.3 * Math.max(0, gL) * amp), 0, 0);
    // shoulders twist against the hips, the torso leans with speed and tips over the standing foot
    const lean = 0.04 + this.posture + 0.025 * Math.min(v, 3) * (1 - run) + 0.2 * run;
    const twist = 0.3 * A * (gL - gR) * 0.5;
    set(p, PART.body, lean, twist, roll);
    set(p, PART.hips, 0, -twist * 0.3, hipRoll);
    set(p, PART.head, -lean * 0.6 + 0.03, -twist * 0.8, -roll * 0.8);
    const hop = run * 0.035 * amp * Math.sin(2 * TAU * u0 - 3.96);
    p[OFF] = sway;
    p[OFF + 1] = (lift - L) + hop * this.bounce;
  }

  private holdPose(p: Float32Array, w: number): void {
    const t = this.animT;
    if (this.held === 'phone') { this.phoneArms(p, t, w); return; }
    const bite = Math.pow(Math.max(0, Math.sin(t * 0.9 + this.seed)), 12);
    lerpPart(p, PART.armR, -0.55 - 0.4 * bite, -0.45, 0, w);
    lerpPart(p, PART.foreR, -1.45 - 0.45 * bite, 0, 0, w);
    p[PART.head * 3] += (0.08 - 0.1 * bite) * w;
  }

  private catPose(dt: number, p: Float32Array): void {
    const t = this.animT;
    if (this.locoW > 0.01) {
      this.phase += dt * this.vs * 8;
      const s = Math.sin(this.phase) * 0.7 * this.locoW;
      set(p, PART.armL, s, 0, 0); set(p, PART.armR, -s, 0, 0); set(p, PART.legL, -s, 0, 0); set(p, PART.legR, s, 0, 0);
      p[OFF + 1] = Math.abs(Math.cos(this.phase)) * 0.015 * this.locoW;
      set(p, PART.head, Math.sin(this.phase * 2) * 0.04, 0, 0);
    } else if (this.base === 'sit') {
      set(p, PART.legL, -1.2, 0, 0); set(p, PART.legR, -1.2, 0, 0);
      set(p, PART.head, Math.sin(t * 0.5) * 0.05, 0, Math.sin(t * 0.31) * 0.06);
      p[OFF + 1] = -0.04;
    }
    set(p, PART.tail, 0.3 + Math.sin(t * 1.3) * 0.15, Math.sin(t * 2.2) * 0.5, 0);
  }
}

function set(p: Float32Array, part: number, x: number, y: number, z: number): void {
  p[part * 3] = x; p[part * 3 + 1] = y; p[part * 3 + 2] = z;
}
function add(p: Float32Array, part: number, x: number, y: number, z: number): void {
  p[part * 3] += x; p[part * 3 + 1] += y; p[part * 3 + 2] += z;
}
function lerpPart(p: Float32Array, part: number, x: number, y: number, z: number, w: number): void {
  const i = part * 3;
  p[i] += (x - p[i]) * w; p[i + 1] += (y - p[i + 1]) * w; p[i + 2] += (z - p[i + 2]) * w;
}
function mixInto(a: Float32Array, b: Float32Array, w: number): void {
  for (let i = 0; i < a.length; i++) a[i] += (b[i] - a[i]) * w;
}
