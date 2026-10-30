import * as THREE from 'three';
import { Actor, geometryFrom } from './actors';
import { meshGrid } from '../world/mesher';
import { voxelMaterial, SharedUniforms } from '../engine/renderer';
import { mealKit, MealKit, HandModel, Piece, V3, VOX, noodleBundle, pastaTwirl } from '../world/handfood';
import { Palette } from '../world/palette';
import { Prop } from '../world/props';
import type { Audio, SfxName } from './audio';

/**
 * Eating, as a little scene: the vendor plates up and hands the dish over, the traveller says itadakimasu, then eats
 * it bite by bite in a way that suits the dish (chopsticks and a slurp for ramen, a toothpick and a blow for
 * takoyaki, head first for taiyaki...). Bites really take voxels out of the food, crumbs fall, steam rises. Hands are
 * placed with the actors' arm IK, and everything is in the actor's own space so it reads the same in the iso view and
 * in first person.
 */

export interface MealHost {
  scene: THREE.Object3D;
  shared: SharedUniforms;
  audio: Audio;
  player: Actor;
  /** Who hands the food over (null: picked up from a vending machine or the counter). */
  vendor: Actor | null;
  firstPerson(): boolean;
  /** Iso camera heading (where the camera looks from), or null in first person. */
  viewYaw(): number | null;
  /** Can the player stand here? (the step towards the counter) */
  canStand(x: number, z: number): boolean;
  bubble(key: string, text: string, pos: [number, number, number], secs: number): void;
  /** Steam over the food and sparkles around the face (world positions; null hides them). */
  fx(steam: THREE.Vector3 | null, steamAmount: number, sparkle: THREE.Vector3 | null): void;
}

type At = 'rest' | 'mouth' | 'piece' | 'dip' | 'chest' | 'cheek' | 'low';
type Hold = 'grip' | 'tip' | 'lead' | 'mlead' | 'plead';
interface Key { at: At; off?: V3; from?: V3; rot?: V3; hold?: Hold; spin?: number }
type Ev = 'pick' | 'bite' | 'take' | 'eat' | 'dip' | 'blow' | 'slurp' | 'sip' | 'wobble' | 'clink';
interface Beat {
  d: number;
  r?: Key; l?: Key;
  head?: V3; lean?: number;
  /** Fired when the beat starts. */
  ev0?: Ev;
  /** Fired when the beat ends. */
  ev?: Ev;
  chew?: boolean;
  hafu?: boolean;
}

// rest spots in the actor's own space (x towards the +x hand, y up, z forward)
const REST_R: V3 = [0.15, 0.97, 0.3];
const REST_L: V3 = [-0.1, 0.93, 0.32];
// directions from a target back to the hand (arms are short, so hands mostly come in from the side)
const F_DOWN: V3 = [0.5, 0.8, -0.25];   // utensil comes down onto the plate from up and to the side
const F_MOUTH: V3 = [0.6, -0.45, 0.45]; // utensil points back up into the mouth
const F_ITEM: V3 = [0.7, -0.35, 0.6];   // food held out to the side, its end towards the mouth
const F_SPOON: V3 = [0.35, 0.75, -0.4];
const F_FORK: V3 = [0.25, 1, -0.15];
const TAU = Math.PI * 2;
/** The plate hand brings the plate over so the other hand can pick from it with its fingers. */
const OFFER: Key = { at: 'rest', off: [0.1, 0.03, -0.03], rot: [-0.25, 0, 0] };

const sstep = (x: number) => { const t = Math.min(1, Math.max(0, x)); return t * t * (3 - 2 * t); };
const v3 = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);

/** A voxel model in the scene that can lose voxels. */
class Held {
  readonly mesh: THREE.Mesh;
  readonly prop: Prop;
  private keep: Set<number>;
  dirty = true;

  constructor(readonly model: HandModel, private pal: Palette, mat: THREE.Material, scale: number, parent: THREE.Object3D) {
    this.prop = model.prop;
    this.keep = new Set(model.keep ?? []);
    this.mesh = new THREE.Mesh(new THREE.BufferGeometry(), mat);
    this.mesh.scale.setScalar(model.k ?? scale);
    this.mesh.matrixAutoUpdate = false;
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
    parent.add(this.mesh);
    this.rebuild();
  }

  rebuild(): void {
    if (!this.dirty) return;
    this.dirty = false;
    const g = this.prop.grid, grip = this.model.grip;
    const md = meshGrid({ grid: g, pal: this.pal, scale: VOX, origin: [-grip[0] * VOX, -grip[1] * VOX, -grip[2] * VOX], parts: new Uint8Array(g.sx * g.sy * g.sz), greedy: true });
    this.mesh.geometry.dispose();
    this.mesh.geometry = md.vertexCount ? geometryFrom(md) : new THREE.BufferGeometry();
  }

  edible(v: number): boolean { return v !== 0 && !this.keep.has(v); }

  /** Remove the edible voxels inside an ellipsoid; returns the palette ids taken. */
  carve(at: V3, r: V3, into?: Prop, intoOrigin?: V3): number[] {
    const g = this.prop.grid, out: number[] = [];
    for (let y = Math.max(0, Math.floor(at[1] - r[1])); y <= Math.min(g.sy - 1, Math.ceil(at[1] + r[1])); y++)
      for (let z = Math.max(0, Math.floor(at[2] - r[2])); z <= Math.min(g.sz - 1, Math.ceil(at[2] + r[2])); z++)
        for (let x = Math.max(0, Math.floor(at[0] - r[0])); x <= Math.min(g.sx - 1, Math.ceil(at[0] + r[0])); x++) {
          const dx = (x + 0.5 - at[0]) / r[0], dy = (y + 0.5 - at[1]) / r[1], dz = (z + 0.5 - at[2]) / r[2];
          if (dx * dx + dy * dy + dz * dz > 1) continue;
          const v = g.get(x, y, z);
          if (!this.edible(v)) continue;
          g.set(x, y, z, 0);
          out.push(v);
          if (into && intoOrigin) into.set(x - intoOrigin[0], y - intoOrigin[1], z - intoOrigin[2], v);
        }
    if (out.length) this.dirty = true;
    return out;
  }

  /** A bite: a scalloped scoop at the leading edge, three teeth-sized rounds side by side. */
  bite(lead: V3, dir: THREE.Vector3, r: number): number[] {
    const side = new THREE.Vector3(0, 1, 0).cross(dir);
    if (side.lengthSq() < 1e-4) side.set(1, 0, 0);
    side.normalize();
    const c = new THREE.Vector3(...lead).addScaledVector(dir, -r * 0.35);
    const out = this.carve([c.x, c.y, c.z], [r, r, r]);
    for (const s of [-1, 1]) {
      const q = c.clone().addScaledVector(side, s * r * 0.85).addScaledVector(dir, r * 0.2);
      out.push(...this.carve([q.x, q.y, q.z], [r * 0.55, r * 0.55, r * 0.55]));
    }
    return out;
  }

  /** Lift a piece out: the voxels move to a new little model whose grip is the piece's centre. */
  take(pc: Piece): { model: HandModel; cols: number[] } {
    const pad = 1;
    const ox = Math.floor(pc.at[0] - pc.r[0]) - pad, oy = Math.floor(pc.at[1] - pc.r[1]) - pad, oz = Math.floor(pc.at[2] - pc.r[2]) - pad;
    const p = new Prop(Math.ceil(pc.r[0] * 2) + pad * 2 + 2, Math.ceil(pc.r[1] * 2) + pad * 2 + 2, Math.ceil(pc.r[2] * 2) + pad * 2 + 2, VOX);
    const cols = this.carve(pc.at, pc.r, p, [ox, oy, oz]);
    return { model: { prop: p, grip: [pc.at[0] - ox, pc.at[1] - oy, pc.at[2] - oz] }, cols };
  }

  /** The edible voxel furthest along a direction (null when it's all gone). */
  lead(dir: THREE.Vector3): V3 | null {
    const g = this.prop.grid;
    let best = -Infinity, bx = 0, by = 0, bz = 0;
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      if (!this.edible(g.get(x, y, z))) continue;
      const d = (x + 0.5) * dir.x + (y + 0.5) * dir.y + (z + 0.5) * dir.z;
      if (d > best) { best = d; bx = x + 0.5; by = y + 0.5; bz = z + 0.5; }
    }
    return best === -Infinity ? null : [bx, by, bz];
  }

  /** Model point (voxels) to the model's own metres, before its rotation. */
  local(v: V3, out: THREE.Vector3): THREE.Vector3 {
    const k = this.mesh.scale.x, g = this.model.grip;
    return out.set((v[0] - g[0]) * VOX * k, (v[1] - g[1]) * VOX * k, (v[2] - g[2]) * VOX * k);
  }

  /** Model point (voxels) to world. */
  world(v: V3, out: THREE.Vector3): THREE.Vector3 {
    const g = this.model.grip;
    return out.set((v[0] - g[0]) * VOX, (v[1] - g[1]) * VOX, (v[2] - g[2]) * VOX).applyMatrix4(this.mesh.matrix);
  }

  /** World point into model voxels. */
  toModel(w: THREE.Vector3): V3 {
    const g = this.model.grip;
    const p = w.clone().applyMatrix4(this.mesh.matrix.clone().invert());
    return [p.x / VOX + g[0], p.y / VOX + g[1], p.z / VOX + g[2]];
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
  }
}

interface HandState { pos: THREE.Vector3; q: THREE.Quaternion }
interface Crumb { p: THREE.Vector3; v: THREE.Vector3; life: number; spin: number; mesh: number }

/** One dish being served and eaten. */
export class Meal {
  readonly kit: MealKit;
  /** Point the camera should look at, and how close (iso view height in metres). */
  readonly focus = new THREE.Vector3();
  zoom = 9.5;
  /** First-person look pitch while eating. */
  pitch = -0.15;
  finished = false;
  private mat: THREE.ShaderMaterial;
  private vessel: Held | null = null;
  private held: Held | null = null;
  private morsel: Held | null = null;
  private morselMode: 'tip' | 'hand' | 'noodle' = 'tip';
  private morselBites = 0;
  private slurpT = -1;
  private beats: Beat[] = [];
  private bi = -1;
  private bt = 0;
  private phase: 'serve' | 'present' | 'pass' | 'thanks' | 'eat' | 'yum' | 'end' = 'serve';
  private phaseT = 0;
  private pieceI = 0;
  private biteN = 0;
  private hands: [HandState, HandState] = [{ pos: new THREE.Vector3(), q: new THREE.Quaternion() }, { pos: new THREE.Vector3(), q: new THREE.Quaternion() }];
  private from: [HandState, HandState] = [{ pos: new THREE.Vector3(), q: new THREE.Quaternion() }, { pos: new THREE.Vector3(), q: new THREE.Quaternion() }];
  private headFrom = new THREE.Vector3();
  private head = new THREE.Vector3();
  private leanFrom = 0;
  private lean = 0;
  private chewT = 0;
  private hafuT = 0;
  private blowT = 0;
  private wobT = 0;
  private yumT = 0;
  private lead: V3 | null = null;
  private leadDir = new THREE.Vector3();
  private crumbs: Crumb[] = [];
  private crumbMeshes: THREE.InstancedMesh[] = [];
  private crumbCols: number[] = [];
  private passFrom = new THREE.Matrix4();
  private start = new THREE.Vector3();
  private stepTo: THREE.Vector3 | null = null;
  private speed = 1;
  private vendorFacing = 0;
  private faced = 0;
  private tmp = new THREE.Vector3();
  private tmp2 = new THREE.Vector3();
  private tmp3 = new THREE.Vector3();
  private tq = new THREE.Quaternion();
  private m4 = new THREE.Matrix4();
  private uni: { uCharLight: THREE.IUniform<THREE.Vector3>; uCharLamp: THREE.IUniform<THREE.Vector3> };

  constructor(readonly id: string, private host: MealHost, private onDone: () => void) {
    this.kit = mealKit(id);
    const zero = () => Array.from({ length: 12 }, () => new THREE.Vector3());
    this.uni = { uCharLight: { value: new THREE.Vector3(1, 1, 0) }, uCharLamp: { value: new THREE.Vector3() } };
    this.mat = voxelMaterial(host.shared, { CHARACTER: 1 }, {
      uPivot: { value: zero() }, uRot: { value: zero() }, uOffset: { value: new THREE.Vector3() },
      uCharLight: this.uni.uCharLight, uCharLamp: this.uni.uCharLamp, uFlash: { value: 0 },
    });
    const k = this.kit;
    if (k.vessel) this.vessel = new Held(k.vessel, k.pal, this.mat, k.scale, host.scene);
    if (k.held) this.held = new Held(k.held, k.pal, this.mat, k.scale, host.scene);
    const pl = host.player;
    this.start.copy(pl.position);
    // step up to the counter so hands can meet over it
    const v = host.vendor;
    if (v) {
      this.vendorFacing = v.targetFacing;
      const dx = pl.position.x - v.position.x, dz = pl.position.z - v.position.z, d = Math.hypot(dx, dz);
      const want = 1.35;
      if (d > want + 0.05) {
        const tx = v.position.x + (dx / d) * want, tz = v.position.z + (dz / d) * want;
        // as far forward as the floor allows
        for (let f = 1; f > 0.05; f -= 0.2) {
          const x = pl.position.x + (tx - pl.position.x) * f, z = pl.position.z + (tz - pl.position.z) * f;
          if (host.canStand(x, z)) { this.stepTo = new THREE.Vector3(x, pl.position.y, z); break; }
        }
      }
      v.targetFacing = Math.atan2(pl.position.x - v.position.x, pl.position.z - v.position.z);
      v.anim = 'cook';
      host.audio.play('sizzle');
    } else this.phase = 'thanks';
    this.focus.copy(pl.position).add(this.tmp.set(0, 1, 0));
    this.buildBeats();
    for (const h of this.hands) h.pos.set(0, 0.9, 0.25);
    this.hands[0].pos.set(REST_L[0], REST_L[1], REST_L[2]);
    this.hands[1].pos.set(REST_R[0], REST_R[1], REST_R[2]);
  }

  get eating(): boolean { return !this.finished; }

  /** Tap to hurry along. */
  hurry(): void { this.speed = 2.6; }

  /** Walking off: finish at once, leftovers vanish. */
  stop(): void {
    if (this.finished) return;
    this.release();
    this.finished = true;
    this.onDone();
  }

  dispose(): void {
    this.release();
    this.vessel?.dispose();
    this.held?.dispose();
    this.morsel?.dispose();
    for (const m of this.crumbMeshes) { m.removeFromParent(); m.geometry.dispose(); }
    this.mat.dispose();
    this.host.fx(null, 0, null);
  }

  private release(): void {
    const pl = this.host.player;
    pl.reach[0].on = pl.reach[1].on = false;
    pl.pose.chew = 0;
    const v = this.host.vendor;
    if (v) { v.reach[0].on = v.reach[1].on = false; v.pose.lean = 0; if (v.anim !== 'cook') v.anim = 'cook'; v.targetFacing = this.vendorFacing; }
  }

  // ------------------------------------------------------------------------------------------- script

  private buildBeats(): void {
    const k = this.kit, B: Beat[] = [];
    const pieces = k.vessel?.pieces ?? k.held?.pieces ?? [];
    const n = k.drink ? k.bites : Math.max(1, Math.min(k.bites, k.vessel ? pieces.length : 99));
    for (let i = 0; i < n; i++) B.push(...this.style(i, n));
    if (k.style === 'slurp') B.push(...drinkBroth());
    this.beats = B;
  }

  /** The beats of one bite. Hands: r holds the food or the utensil, l the plate, bowl or cup. */
  private style(i: number, n: number): Beat[] {
    const k = this.kit, last = i === n - 1;
    const jig = (s: number): V3 => [Math.sin(i * 2.3) * s, 0, Math.cos(i * 1.7) * s * 0.5];
    const hover = (from: V3, up = 0.07): Beat => ({ d: 0.38, r: { at: 'piece', off: [0, up, 0], from, hold: 'tip' }, head: [0.32, -0.05, 0] });
    const down = (from: V3, ev: Ev = 'pick', d = 0.18): Beat => ({ d, r: { at: 'piece', off: [0, 0.006, 0], from, hold: 'tip' }, ev, head: [0.34, -0.05, 0] });
    const toMouth = (hold: Hold, from: V3, gap = 0.0, d = 0.42): Beat => ({ d, r: { at: 'mouth', off: [0, 0, gap], from, hold }, head: [0.04, 0, 0] });
    const rest = (d = 0.62): Beat => ({ d, r: { at: 'rest', off: jig(0.015) }, head: [0.14, 0, Math.sin(i * 2.1) * 0.08], chew: true });
    const twoBites = (hold: Hold, from: V3): Beat[] => k.bitesPer > 1
      ? [toMouth(hold, from, 0.07, 0.38), { ...toMouth(hold, from, -0.004, 0.16), ev: 'bite' }, { d: 0.42, r: { at: 'mouth', off: [0.03, -0.07, 0.13], from, hold }, head: [0.1, 0, 0.05], chew: true }, toMouth(hold, from, 0.05, 0.24), { ...toMouth(hold, from, -0.004, 0.15), ev: 'eat' }]
      : [toMouth(hold, from, 0.06, 0.4), { ...toMouth(hold, from, -0.004, 0.16), ev: 'eat' }];
    switch (k.style) {
      case 'toothpick':
        return [hover(F_DOWN), down(F_DOWN), toMouth('tip', F_MOUTH, 0.12, 0.45),
          ...(k.hot ? [{ d: 0.7, ev0: 'blow' as Ev, head: [-0.02, 0, 0] as V3 }] : []),
          { ...toMouth('tip', F_MOUTH, 0.01, 0.2), ev: 'eat' }, { ...rest(0.75), hafu: k.hot }];
      case 'pick':
        return [hover(F_DOWN), down(F_DOWN), ...twoBites('mlead', F_MOUTH), rest()];
      case 'hera':
        return [hover([0.45, 0.6, -0.35], 0.05), { d: 0.16, r: { at: 'piece', off: [0, 0.004, 0], from: [0.45, 0.6, -0.35], hold: 'tip' }, ev: 'clink', head: [0.34, 0, 0] },
          { d: 0.15, r: { at: 'piece', off: [0.02, 0.004, 0.01], from: [0.45, 0.6, -0.35], hold: 'tip' }, head: [0.34, 0, 0] },
          { d: 0.15, r: { at: 'piece', off: [-0.02, 0.004, -0.01], from: [0.45, 0.6, -0.35], hold: 'tip' }, ev: 'pick', head: [0.34, 0, 0] },
          toMouth('tip', F_MOUTH, 0.12, 0.4), { d: 0.5, ev0: 'blow' }, { ...toMouth('tip', F_MOUTH, 0.01, 0.2), ev: 'eat' }, { ...rest(0.7), hafu: true }];
      case 'pop':
        return [{ d: 0.38, r: { at: 'piece', off: [0, 0.03, -0.01], hold: 'grip', rot: [0.3, 0, 0] }, l: OFFER, head: [0.36, -0.1, 0] }, { d: 0.14, ev: 'pick', head: [0.36, -0.1, 0] },
          { d: 0.42, r: { at: 'mouth', off: [0.02, -0.02, 0.2], hold: 'grip', rot: [0, -0.4, 0] }, head: [0.12, 0, 0.12] },
          { d: 0.55, r: { at: 'mouth', off: [0.02, -0.01, 0.2], hold: 'grip', rot: [0, 0.6, 0.2] }, head: [0.1, 0.05, -0.1] },
          { d: 0.24, r: { at: 'mouth', off: [0, 0, 0.02], hold: 'grip', rot: [0, 0, 0] }, ev: 'eat', head: [0, 0, 0] }, { ...rest(), hafu: true }];
      case 'skewer':
        return [{ d: 0.48, r: { at: 'mouth', off: [0, 0, 0.08], from: [0.25, -0.75, 0.6], hold: 'plead' }, head: [0.02, 0, 0.16] },
          { d: 0.18, r: { at: 'mouth', off: [0, 0, 0.01], from: [0.25, -0.75, 0.6], hold: 'plead' }, ev: 'take', head: [0.04, 0, 0.2] },
          { d: 0.3, r: { at: 'mouth', off: [0.06, -0.12, 0.12], from: [0.25, -0.75, 0.6], hold: 'plead' }, head: [-0.06, 0, 0.12], chew: true }, rest(0.55)];
      case 'yakitori':
        return [{ d: 0.48, r: { at: 'mouth', off: [0, 0, 0.06], from: [1, -0.15, 0.4], hold: 'plead' }, head: [0.04, 0.12, 0] },
          { d: 0.18, r: { at: 'mouth', off: [0, 0, 0.01], from: [1, -0.15, 0.4], hold: 'plead' }, head: [0.06, 0.15, 0] },
          { d: 0.26, r: { at: 'mouth', off: [0.13, -0.02, 0.06], from: [1, -0.15, 0.4], hold: 'plead' }, ev0: 'take', head: [0.02, -0.22, -0.06], chew: true }, rest(0.6)];
      case 'bite': case 'sandwich': {
        const from: V3 = k.style === 'sandwich' ? [0, -0.25, 1] : F_ITEM;
        return [{ d: 0.5, r: { at: 'mouth', off: [0, 0, 0.07], from, hold: 'lead' }, head: [0.06, 0, 0] },
          { d: 0.17, r: { at: 'mouth', off: [0, 0, -0.006], from, hold: 'lead' }, ev: 'bite', head: [0.1, 0, 0] },
          { d: 0.3, r: { at: 'mouth', off: [0.02, -0.08, 0.16], from, hold: 'lead' }, head: [0.0, 0, 0.06], chew: true }, rest(last ? 0.5 : 0.65)];
      }
      case 'slurp': case 'soba': {
        const pc = this.pieceAt(i);
        const dip: Beat[] = k.style === 'soba' ? [{ d: 0.38, r: { at: 'dip', off: [0, 0.05, 0], from: F_DOWN, hold: 'tip' }, head: [0.3, 0, 0] }, { d: 0.18, r: { at: 'dip', off: [0, 0, 0], from: F_DOWN, hold: 'tip' }, ev: 'dip', head: [0.32, 0, 0] }] : [];
        return [hover(F_DOWN, 0.06), down(F_DOWN, 'pick', 0.22),
          { d: 0.45, r: { at: 'mouth', off: [0.02, pc?.noodle ? 0.1 : 0, 0.15], from: F_MOUTH, hold: 'tip' }, head: [0.02, 0, 0] }, ...dip,
          { d: 0.3, r: { at: 'mouth', off: [0, pc?.noodle ? 0.035 : 0, 0.05], from: F_MOUTH, hold: 'tip' }, head: [0.06, 0, 0] },
          pc?.noodle ? { d: 0.85, ev0: 'slurp', head: [0.1, 0, 0] } : { d: 0.15, ev: 'eat' }, rest(0.55)];
      }
      case 'dip':
        return [hover(F_DOWN), down(F_DOWN), { d: 0.38, r: { at: 'dip', off: [0, 0.05, 0], from: F_DOWN, hold: 'tip' }, head: [0.3, 0, 0] },
          { d: 0.16, r: { at: 'dip', off: [0, 0.004, 0], from: F_DOWN, hold: 'tip' }, ev: 'dip', head: [0.32, 0, 0] },
          ...twoBites('mlead', F_MOUTH), rest()];
      case 'chopsticks':
        return [hover(F_DOWN), down(F_DOWN), ...twoBites('mlead', F_MOUTH), rest()];
      case 'sushi':
        return [{ d: 0.38, r: { at: 'piece', off: [0, 0.02, 0], hold: 'grip' }, l: OFFER, head: [0.34, -0.08, 0] }, { d: 0.12, ev: 'pick', head: [0.34, -0.08, 0] },
          { d: 0.36, r: { at: 'mouth', off: [0.03, -0.05, 0.16], hold: 'grip', rot: [0, -0.3, 0] }, head: [0.12, 0, 0] },
          { d: 0.4, r: { at: 'mouth', off: [0.03, -0.04, 0.15], hold: 'grip', rot: [0, -0.3, Math.PI] }, head: [0.1, 0, 0.08] },
          { d: 0.24, r: { at: 'mouth', off: [0, 0, 0.02], hold: 'grip', rot: [0, -1.4, Math.PI] }, ev: 'eat', head: [0.02, 0, 0] }, { ...rest(0.75), head: [0.18, 0, 0.12] }];
      case 'spoon':
        return [hover(F_SPOON, 0.06), down(F_SPOON, 'pick', 0.22), { d: 0.12, ev0: 'wobble' }, toMouth('tip', F_MOUTH, 0.1, 0.4),
          { ...toMouth('tip', F_MOUTH, 0.005, 0.18), ev: 'eat' }, { ...rest(0.7), head: [0.16, 0, 0.14] }];
      case 'twirl':
        return [hover(F_FORK, 0.06), { d: 0.15, r: { at: 'piece', off: [0, 0.01, 0], from: F_FORK, hold: 'tip' }, head: [0.34, 0, 0] },
          { d: 0.9, r: { at: 'piece', off: [0, 0.016, 0], from: F_FORK, hold: 'tip', spin: 2 }, ev0: 'pick', head: [0.36, 0, 0] },
          toMouth('tip', F_MOUTH, 0.1, 0.42), { ...toMouth('tip', F_MOUTH, 0.005, 0.18), ev: 'eat' }, rest()];
      case 'sip':
        return [{ d: 0.45, r: { at: 'mouth', off: [0, 0, 0.012], hold: 'tip', rot: [-0.5, 0, 0] }, head: [0.02, 0, 0] },
          { d: 0.95, r: { at: 'mouth', off: [0, 0.005, 0.006], hold: 'tip', rot: [-1.25, 0, 0] }, ev0: 'sip', head: [-0.14, 0, 0] },
          { d: 0.5, r: { at: 'rest' }, head: [0.12, 0, 0] }];
    }
    return [];

  }

  private pieceAt(i: number): Piece | undefined {
    return (this.kit.vessel?.pieces ?? this.kit.held?.pieces)?.[i];
  }

  // ------------------------------------------------------------------------------------------- per frame

  /** Before the actors animate: advance the scene and aim the hands. */
  update(dt: number): void {
    if (this.finished) return;
    dt *= this.speed;
    const pl = this.host.player, v = this.host.vendor;
    this.uni.uCharLight.value.copy(pl.lighting.uCharLight.value);
    this.uni.uCharLamp.value.copy(pl.lighting.uCharLamp.value);
    this.phaseT += dt;
    this.chewT -= dt; this.hafuT -= dt; this.blowT -= dt; this.wobT -= dt;
    pl.pose.chew = this.chewT > 0 ? 1 : 0;
    pl.pose.bob = this.hafuT > 0 ? Math.abs(Math.sin(this.phaseT * 9)) * 0.01 : 0;
    const mouth = this.mouthM(this.tmp);
    this.pitch = this.phase === 'serve' || this.phase === 'present' || this.phase === 'pass' ? -0.2 : -0.62;
    // the camera looks at what matters: the counter while serving, the food while eating
    const fw = new THREE.Vector3();
    this.toWorldM(fw.copy(mouth).add(this.tmp2.set(0, -0.15, 0.15)));
    if (v && (this.phase === 'serve' || this.phase === 'present' || this.phase === 'pass')) {
      fw.lerp(this.tmp2.set(v.position.x, pl.position.y + 1.05, v.position.z), 0.4);
      this.zoom = 10;
    } else this.zoom = 8.2;
    this.focus.lerp(fw, 1 - Math.exp(-dt * 4));

    switch (this.phase) {
      case 'serve': {
        if (this.stepTo) pl.position.lerp(this.stepTo, 1 - Math.exp(-dt * 5));
        if (v) pl.targetFacing = Math.atan2(v.position.x - pl.position.x, v.position.z - pl.position.z);
        this.restPose(pl, 0.05, [0.05, 0, 0]);
        if (this.phaseT > 1.05) this.next('present');
        break;
      }
      case 'present': {
        if (!v) { this.next('thanks'); break; }
        v.anim = 'idle';
        const u = sstep(this.phaseT / 0.7);
        v.pose.lean = 0.22 * u;
        v.pose.pitch = 0.2;
        this.offer(v, 0.26 + 0.14 * u);
        this.restPose(pl, 0.12 * u, [0.12, 0, 0]);
        // the player reaches out too
        this.reachFor(this.objWorld(this.tmp2), 0.6 * u);
        if (this.phaseT > 0.2 && this.phaseT - dt <= 0.2) {
          const q = v.position;
          this.host.bubble('meal-vendor', pick(['Hai, dōzo!', 'Here you go!', 'Hai, omachi dō sama!', 'Enjoy it while it\'s hot!']), [q.x, q.y + 2.15, q.z], 1.8);
        }
        if (this.phaseT > 0.85) {
          this.passFrom.copy(this.main().mesh.matrix);
          this.host.audio.play('rustle');
          this.next('pass');
        }
        break;
      }
      case 'pass': {
        const u = sstep(this.phaseT / 0.5);
        if (v) {
          v.pose.lean = 0.22 * (1 - u);
          if (this.phaseT > 0.35 && v.anim !== 'bow') { v.reach[0].on = v.reach[1].on = false; v.anim = 'bow'; v.pose.pitch = 0; }
          else if (v.anim !== 'bow') this.offer(v, 0.4);
        }
        this.restPose(pl, 0.12 * (1 - u), [0.12, 0, 0]);
        this.holdPose();
        if (this.phaseT > 0.62) {
          if (v) setTimeout(() => { if (v.anim === 'bow') { v.anim = 'cook'; v.targetFacing = this.vendorFacing; } }, 900);
          this.next('thanks');
        }
        break;
      }
      case 'thanks': {
        // a little bow over the food: itadakimasu
        const yaw = this.host.viewYaw();
        if (yaw !== null && this.faced === 0) { this.faced = 1; pl.targetFacing = yaw + 0.55; }
        const u = Math.sin(Math.min(1, this.phaseT / 0.9) * Math.PI);
        this.restPose(pl, 0.18 * u, [0.22 * u + 0.08, 0, 0]);
        this.holdPose();
        if (this.phaseT - dt <= 0.05 && this.phaseT > 0.05) {
          const p = pl.position;
          this.host.bubble('meal-me', this.kit.drink ? 'Kanpai!' : 'Itadakimasu!', [p.x, p.y + 2.1, p.z], 1.4);
        }
        if (this.phaseT > 1.0) { this.next('eat'); this.nextBeat(); }
        break;
      }
      case 'eat': this.eat(dt); break;
      case 'yum': {
        // hands to the cheeks, a happy wiggle
        const t = this.phaseT;
        const w = Math.sin(t * 7) * 0.02;
        this.setReach(0, this.tmp2.set(-0.17, 1.24 + w, 0.16));
        this.setReach(1, this.tmp2.set(0.17, 1.24 - w, 0.16));
        this.setHead(pl, -0.06, 0, Math.sin(t * 5) * 0.16);
        pl.pose.lean = -0.04;
        pl.pose.bob = Math.abs(Math.sin(t * 6)) * 0.012;
        if (this.yumT === 0) {
          this.yumT = 1;
          const p = pl.position;
          this.host.audio.play('yum');
          this.host.bubble('meal-me', this.kit.drink ? 'Ahh~ ♪' : pick(['Oishii~!', 'Umai!', 'Mmm, oishii!']), [p.x, p.y + 2.1, p.z], 1.6);
        }
        if (t > 1.45) {
          this.release();
          pl.pose.roll = pl.pose.pitch = pl.pose.bob = pl.pose.lean = 0;
          this.next('end');
        }
        break;
      }
      case 'end':
        if (this.phaseT > 0.2) { this.finished = true; this.onDone(); }
        break;
    }
    // steam over hot food while there is food left
    const steamOn = this.kit.steam > 0 && (this.phase === 'eat' || this.phase === 'thanks' || this.phase === 'pass' || this.phase === 'present');
    const src = this.vessel ?? this.held;
    let steamAt: THREE.Vector3 | null = null;
    if (steamOn && src && src.mesh.visible) {
      steamAt = new THREE.Vector3(src.model.prop.sx / 2, src.model.prop.sy * 0.7, src.model.prop.sz / 2);
      src.world([steamAt.x, steamAt.y, steamAt.z], steamAt);
    }
    let sparkle: THREE.Vector3 | null = null;
    if (this.phase === 'yum') this.toWorldM(sparkle = new THREE.Vector3(0, 1.45, 0.1));
    const blow = this.blowT > 0 ? 1 : 0;
    this.host.fx(steamAt, Math.min(1, this.kit.steam * (0.6 + blow * 0.8) * (1 - this.biteN / (this.beatsBites() + 1) * 0.5)), sparkle);
  }

  private beatsBites(): number { return this.kit.bites; }

  /** After the actors animate: glue the food to the hands, fly the crumbs. */
  place(dt: number): void {
    if (this.finished) return;
    const pl = this.host.player, v = this.host.vendor;
    pl.root.updateMatrixWorld();
    v?.root.updateMatrixWorld();
    const main = this.main();
    const other = main === this.vessel ? this.held : null;
    if (this.phase === 'serve') {
      for (const h of [this.vessel, this.held, this.morsel]) if (h) h.mesh.visible = false;
    } else if (this.phase === 'present' && v) {
      main.mesh.visible = true;
      if (other) other.mesh.visible = false;
      this.offerMatrix(v, main);
    } else if (this.phase === 'pass') {
      main.mesh.visible = true;
      if (other) other.mesh.visible = false;
      const u = sstep(this.phaseT / 0.5);
      this.attach(pl, main === this.vessel ? 0 : 1, main);
      const a = new THREE.Vector3(), b = new THREE.Vector3(), qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), s = new THREE.Vector3();
      this.passFrom.decompose(a, qa, s);
      main.mesh.matrix.decompose(b, qb, s);
      a.lerp(b, u); a.y += Math.sin(u * Math.PI) * 0.06;
      qa.slerp(qb, u);
      main.mesh.matrix.compose(a, qa, s);
    } else {
      if (this.vessel) { this.vessel.mesh.visible = true; this.attach(pl, 0, this.vessel); }
      if (this.held) {
        const show = this.phase !== 'thanks' || this.held === main || this.phaseT > 0.5;
        this.held.mesh.visible = show && this.phase !== 'yum' && this.phase !== 'end';
        this.attach(pl, 1, this.held);
      }
      if (this.phase === 'yum' || this.phase === 'end') {
        // the empties are tucked away
        const u = sstep(this.phaseT / 0.35);
        for (const h of [this.vessel, this.held]) if (h && this.phase === 'yum') { h.mesh.visible = u < 1; h.mesh.matrix.scale(this.tmp.setScalar(Math.max(0.001, 1 - u))); }
        if (this.phase === 'end') for (const h of [this.vessel, this.held]) if (h) h.mesh.visible = false;
      }
      if (this.vessel && this.wobT > 0) {
        // purun: the custard jiggles after a scoop
        const w = Math.sin((0.5 - this.wobT) * 40) * this.wobT * 0.16;
        this.vessel.mesh.matrix.scale(this.tmp.set(1 - w * 0.5, 1 + w, 1 - w * 0.5));
      }
    }
    if (this.morsel) this.placeMorsel(pl);
    for (const h of [this.vessel, this.held, this.morsel]) h?.rebuild();
    this.updateCrumbs(dt * this.speed, pl.position.y);
  }

  private main(): Held { return (this.vessel ?? this.held)!; }

  private next(p: Meal['phase']): void {
    this.phase = p;
    this.phaseT = 0;
  }

  /** World transform of the main dish while the vendor holds it. */
  private objWorld(out: THREE.Vector3): THREE.Vector3 {
    const m = this.main().mesh.matrix;
    out.setFromMatrixPosition(m);
    return this.fromWorldM(out);
  }

  /** Vendor holds the dish out with both hands. */
  private offer(v: Actor, z: number): void {
    const half = this.halfWidth(this.main()) + 0.03;
    v.reach[0].on = v.reach[1].on = true;
    v.reach[0].pos.set(-half, 0.98, z);
    v.reach[1].pos.set(half, 0.98, z);
  }

  private offerMatrix(v: Actor, h: Held): void {
    const a = v.grip(0, new THREE.Vector3()), b = v.grip(1, new THREE.Vector3());
    const mid = a.add(b).multiplyScalar(0.5);
    mid.y += h.model.grip[1] ? 0 : 0.03;
    v.root.localToWorld(mid);
    const q = new THREE.Quaternion().setFromAxisAngle(this.tmp.set(0, 1, 0), v.facing + Math.PI);
    h.mesh.matrix.compose(mid, q, this.tmp.setScalar(h.mesh.scale.x));
  }

  private halfWidth(h: Held): number { return h.prop.sx * 0.5 * VOX * h.mesh.scale.x; }

  /** Player reaches both hands either side of a point (their own space). */
  private reachFor(p: THREE.Vector3, w: number): void {
    const half = this.halfWidth(this.main()) + 0.03;
    this.setReach(0, this.tmp3.lerpVectors(this.tmp.set(REST_L[0], REST_L[1], REST_L[2]), this.tmp2.set(p.x - half, p.y, p.z), w));
    this.setReach(1, this.tmp3.lerpVectors(this.tmp.set(REST_R[0], REST_R[1], REST_R[2]), this.tmp2.set(p.x + half, p.y, p.z), w));
  }

  private restPose(pl: Actor, lean: number, head: V3): void {
    // the first-person eye doesn't follow the waist, so keep the body nearly upright there
    pl.pose.lean = this.host.firstPerson() ? lean * 0.25 : lean;
    this.setHead(pl, head[0], head[1], head[2]);
  }

  /** Holding the dish in front, ready to eat: the bowl in one hand, the other free or on the utensil. */
  private holdPose(): void {
    const fp = this.host.firstPerson();
    this.anchor('rest', 0, this.hands[0].pos, fp);
    this.anchor('rest', 1, this.hands[1].pos, fp);
    this.hands[0].q.setFromEuler(new THREE.Euler(-0.2, 0, 0));
    this.hands[1].q.setFromEuler(new THREE.Euler(0, 0, 0));
    if (!this.vessel && this.held) this.freeHand();
    if (this.kit.style === 'sandwich' && this.held?.model.grip2) this.secondHand();
    this.setReach(0, this.hands[0].pos);
    this.setReach(1, this.hands[1].pos);
  }

  /** Glue a model's grip to a hand. Its orientation is the hand's key orientation in the actor's space. */
  private attach(a: Actor, side: number, h: Held): void {
    const g = a.grip(1 - side, new THREE.Vector3());
    const q = mirrorQ(this.hands[side].q, this.tq);
    // plates sit on top of the palm
    if (side === 0 && h === this.vessel) g.y += 0.035;
    this.m4.compose(g, q, this.tmp.setScalar(h.mesh.scale.x));
    h.mesh.matrix.multiplyMatrices(a.root.matrixWorld, this.m4);
  }

  private placeMorsel(pl: Actor): void {
    const m = this.morsel!;
    m.mesh.visible = true;
    const held = this.held;
    if (this.morselMode === 'hand' || !held) { this.attach(pl, 1, m); return; }
    const tip = held.world(held.model.tip ?? held.model.grip, new THREE.Vector3());
    let q = new THREE.Quaternion().setFromRotationMatrix(this.m4.extractRotation(held.mesh.matrix));
    if (this.morselMode === 'noodle') {
      // noodles hang straight down from the chopsticks
      const e = new THREE.Euler().setFromQuaternion(q, 'YXZ');
      q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, e.y, 0, 'YXZ'));
    }
    let sy = 1;
    if (this.slurpT >= 0) sy = Math.max(0.02, 1 - this.slurpT);
    m.mesh.matrix.compose(tip, q, this.tmp.set(m.mesh.scale.x, m.mesh.scale.x * sy, m.mesh.scale.x));
  }

  // ------------------------------------------------------------------------------------------- eating

  private eat(dt: number): void {
    const pl = this.host.player;
    if (this.bi >= this.beats.length) { this.next('yum'); return; }
    const b = this.beats[this.bi];
    this.bt += dt;
    if (this.slurpT >= 0 && (this.slurpT += dt / 0.8) >= 1) {
      // the last of the noodles disappears with a final slurp
      this.slurpT = -1;
      this.morsel?.dispose();
      this.morsel = null;
      this.biteN++;
      this.chewT = 0.8;
    }
    const u = sstep(this.bt / b.d);
    const fp = this.host.firstPerson();
    for (let side = 0; side < 2; side++) {
      const key = side ? b.r : b.l;
      const st = this.hands[side], fr = this.from[side];
      if (key) {
        const tp = new THREE.Vector3(), tq = new THREE.Quaternion();
        this.resolve(key, side, tp, tq, fp, this.bt / b.d);
        st.pos.lerpVectors(fr.pos, tp, u);
        st.q.slerpQuaternions(fr.q, tq, u);
      } else if (side === 0 && !b.l) {
        // the plate hand stays put, a little sway
        this.anchor('rest', 0, st.pos, fp);
        st.pos.y += Math.sin(this.phaseT * 1.3) * 0.006;
        if (this.vessel) st.q.slerp(this.tq.setFromEuler(new THREE.Euler(-0.22, 0, 0)), 0.1);
      }
    }
    if (!this.vessel && this.held && !b.l) this.freeHand();
    if (this.kit.style === 'sandwich' && this.held?.model.grip2) this.secondHand();
    this.setReach(0, this.hands[0].pos);
    this.setReach(1, this.hands[1].pos);
    const hd = b.head ?? [0.12, 0, 0];
    this.head.lerpVectors(this.headFrom, this.tmp.set(hd[0], hd[1], hd[2]), u);
    this.lean = this.leanFrom + ((b.lean ?? 0.04) - this.leanFrom) * u;
    this.setHead(pl, this.head.x, this.head.y, this.head.z);
    pl.pose.lean = this.lean;
    if (this.bt >= b.d) {
      if (b.ev) this.event(b.ev);
      if (b.chew) this.chewT = 0.8;
      if (b.hafu) this.hafuT = 0.7;
      this.nextBeat();
    }
  }

  private nextBeat(): void {
    this.bi++;
    this.bt = 0;
    for (let s = 0; s < 2; s++) { this.from[s].pos.copy(this.hands[s].pos); this.from[s].q.copy(this.hands[s].q); }
    this.headFrom.copy(this.head);
    this.leanFrom = this.lean;
    const b = this.beats[this.bi];
    if (!b) return;
    // a new bite: find where to bite next
    if (b.r?.hold === 'lead' && this.held && (!this.lead || this.bi === 0 || this.beats[this.bi - 1]?.ev === 'bite' || this.beats[this.bi - 1]?.r?.hold !== 'lead')) {
      const ax = this.held.model.axis ?? [0, 0, 1];
      this.leadDir.set(ax[0], ax[1], ax[2]).normalize();
      this.lead = this.held.lead(this.leadDir);
    }
    if (b.r?.hold === 'mlead' && this.morsel) {
      // the end of the morsel that faces the mouth
      const mouthW = this.toWorldM(this.mouthM(new THREE.Vector3()));
      const c = this.morsel.model.grip;
      const mm = this.morsel.toModel(mouthW);
      this.leadDir.set(mm[0] - c[0], mm[1] - c[1], mm[2] - c[2]).normalize();
      this.lead = this.morsel.lead(this.leadDir);
    }
    if (b.ev0) this.event(b.ev0);
  }

  /** One-handed foods: the other hand cups underneath the food, or hangs loose for a drink or a skewer. */
  private freeHand(): void {
    const h = this.hands[0].pos;
    if (this.kit.style === 'bite' && this.held?.mesh.visible) {
      const c = this.held.world([this.held.prop.sx / 2, 0, this.held.prop.sz / 2], new THREE.Vector3());
      this.fromWorldM(c);
      h.set(c.x - 0.02, c.y - 0.07, c.z - 0.02);
    } else h.set(-0.24, 0.66, 0.1);
  }

  private secondHand(): void {
    const h = this.held!;
    const p = h.local(h.model.grip2!, new THREE.Vector3()).applyQuaternion(this.hands[1].q);
    const g = this.gripM(1, new THREE.Vector3());
    this.hands[0].pos.copy(g.add(p));
  }

  // The choreography is written for a right-handed eater, so it runs in the actor's space mirrored in x: meal
  // side 1 (the utensil hand) is the actor's arm 0, and side 0 (the plate hand) is arm 1.
  private mouthM(out: THREE.Vector3): THREE.Vector3 { this.host.player.mouth(out); out.x = -out.x; return out; }
  private gripM(side: number, out: THREE.Vector3): THREE.Vector3 { this.host.player.grip(1 - side, out); out.x = -out.x; return out; }
  private setReach(side: number, p: THREE.Vector3): void { const r = this.host.player.reach[1 - side]; r.on = true; r.pos.set(-p.x, p.y, p.z); }
  private toWorldM(v: THREE.Vector3): THREE.Vector3 { v.x = -v.x; return this.host.player.root.localToWorld(v); }
  private fromWorldM(v: THREE.Vector3): THREE.Vector3 { this.host.player.root.worldToLocal(v); v.x = -v.x; return v; }
  /** Head turns are for the third-person view; in first person the camera sits in the head, so they stay small. */
  private setHead(pl: Actor, pitch: number, yaw: number, roll: number): void {
    const k = this.host.firstPerson() ? 0.3 : 1;
    pl.pose.pitch = pitch * k; pl.pose.yaw = -yaw * k; pl.pose.roll = -roll * k;
  }

  /** Where a key puts the hand (actor space) and how it turns the thing held. */
  private resolve(key: Key, side: number, pos: THREE.Vector3, q: THREE.Quaternion, fp: boolean, u: number): void {
    const a = this.anchor(key.at, side, new THREE.Vector3(), fp);
    if (key.off) a.add(this.tmp.set(key.off[0], key.off[1], key.off[2]));
    const h = side ? (this.morselMode === 'hand' && this.morsel ? this.morsel : this.held) : this.vessel;
    // orientation
    let axis = new THREE.Vector3(0, 0, 1);
    if (h) {
      const m = h.model;
      if (m.tip) axis.set(m.tip[0] - m.grip[0], m.tip[1] - m.grip[1], m.tip[2] - m.grip[2]).normalize();
      else if (m.axis) axis.set(...m.axis).normalize();
    }
    if (key.from) aim(axis, v3(key.from).normalize().negate(), q);
    else q.setFromEuler(new THREE.Euler(...(key.rot ?? [0, 0, 0]), 'YXZ'));
    if (key.spin) q.multiply(this.tq.setFromAxisAngle(axis, key.spin * TAU * sstep(u)));
    if (key.from && key.rot) q.premultiply(this.tq.setFromAxisAngle(v3(key.from).normalize(), key.rot[2]));
    // the point of the held thing that should land on the anchor
    const off = new THREE.Vector3();
    const hold = key.hold ?? 'grip';
    if (h && hold === 'tip' && h.model.tip) h.local(h.model.tip, off);
    else if (h && hold === 'lead' && this.lead) h.local(this.lead, off);
    else if (h && hold === 'plead') {
      // skewers: the far side of the next piece along the stick
      const pc = this.pieceAt(this.biteN), ax = h.model.axis ?? [0, 0, 1];
      if (pc) h.local([pc.at[0] + ax[0] * pc.r[0] * 0.5, pc.at[1] + ax[1] * pc.r[1] * 0.5, pc.at[2] + ax[2] * pc.r[2] * 0.5], off);
    } else if (h && hold === 'mlead') {
      if (h.model.tip) h.local(h.model.tip, off);
      if (this.morsel && this.lead) off.add(this.morsel.local(this.lead, new THREE.Vector3()));
    }
    off.applyQuaternion(q);
    pos.copy(a).sub(off);
  }

  /** Anchor points in the actor's own space. In first person they come up and in a bit to stay in view. */
  private anchor(at: At, side: number, out: THREE.Vector3, fp: boolean): THREE.Vector3 {
    switch (at) {
      case 'rest':
        out.set(...(side ? REST_R : REST_L));
        // first person: the plate comes to the middle and a little forward, under the eyes
        if (fp) { out.x = side ? out.x * 0.9 : 0.02; out.y += 0.04; out.z += 0.08; }
        return out;
      case 'low': return out.set(0.2, 0.86, 0.22);
      case 'mouth': return this.mouthM(out);
      case 'chest': return out.set(0, 1.0, 0.28);
      case 'cheek': return out.set(side ? 0.17 : -0.17, 1.24, 0.16);
      case 'piece': case 'dip': {
        const ves = this.vessel;
        if (!ves) return out.set(...REST_R);
        const p = at === 'dip' ? ves.model.dip : this.pieceAt(this.pieceI)?.at ?? [ves.prop.sx / 2, ves.prop.sy / 2, ves.prop.sz / 2];
        ves.world(p ?? ves.model.grip, out);
        return this.fromWorldM(out);
      }
    }
  }

  private event(e: Ev): void {
    const au = this.host.audio, k = this.kit;
    switch (e) {
      case 'pick': {
        const pc = this.pieceAt(this.pieceI);
        if (!pc || !this.vessel) break;
        this.pieceI++;
        this.morsel?.dispose();
        let model: HandModel;
        if (pc.noodle && k.noodle) { this.vessel.carve(pc.at, pc.r); model = noodleBundle(k.pal, k.noodle); this.morselMode = 'noodle'; }
        else if (k.pasta) { this.vessel.carve(pc.at, pc.r); model = pastaTwirl(k.pal, k.pasta); this.morselMode = 'tip'; }
        else { model = this.vessel.take(pc).model; this.morselMode = k.held ? 'tip' : 'hand'; }
        if (k.style === 'sushi' || k.style === 'pop') this.morselMode = 'hand';
        this.morsel = new Held(model, k.pal, this.mat, k.scale, this.host.scene);
        this.morselBites = k.bitesPer;
        this.slurpT = -1;
        au.play(k.style === 'spoon' || k.style === 'twirl' ? 'clink' : 'click');
        break;
      }
      case 'bite': {
        let cols: number[] = [];
        if (this.morsel && this.lead) { cols = this.morsel.bite(this.lead, this.leadDir, k.biteR); this.morselBites--; }
        else if (this.held && this.lead) { cols = this.held.bite(this.lead, this.leadDir, k.biteR); this.biteN++; }
        au.play(k.crunch ? 'crunch' : 'bite');
        this.crumbBurst(cols, k.crunch ? 9 : 5);
        this.chewT = 0.9;
        break;
      }
      case 'take': {
        const pc = this.pieceAt(this.biteN);
        if (pc && this.held) {
          const cols = this.held.carve(pc.at, pc.r);
          this.crumbBurst(cols, 3);
        }
        this.biteN++;
        au.play('bite');
        this.chewT = 1;
        break;
      }
      case 'eat': {
        const m = this.morsel;
        if (m) {
          const cols: number[] = [];
          const g = m.prop.grid;
          for (let i = 0; i < g.data.length; i += 7) if (g.data[i]) cols.push(g.data[i]);
          this.crumbBurst(cols, k.crunch ? 6 : 3);
          m.dispose();
          this.morsel = null;
        }
        this.biteN++;
        au.play(k.crunch ? 'crunch' : 'bite');
        this.chewT = 1;
        break;
      }
      case 'slurp':
        this.slurpT = 0;
        au.play('slurp');
        break;
      case 'sip': au.play('sip'); this.chewT = 0; break;
      case 'dip': au.play('drip'); break;
      case 'blow': au.play('blow'); this.blowT = 0.7; break;
      case 'wobble': this.wobT = 0.5; break;
      case 'clink': au.play('clink'); break;
    }
  }

  // ------------------------------------------------------------------------------------------- crumbs

  private crumbBurst(cols: number[], n: number): void {
    if (!cols.length || this.host.firstPerson() && n > 6) n = 6;
    const at = this.toWorldM(this.mouthM(new THREE.Vector3()).add(this.tmp.set(0, -0.03, 0.04)));
    for (let i = 0; i < n; i++) {
      const col = cols[Math.floor(Math.random() * cols.length)];
      let mi = this.crumbCols.indexOf(col);
      if (mi < 0) {
        if (this.crumbCols.length >= 4) mi = Math.floor(Math.random() * 4);
        else mi = this.crumbMesh(col);
      }
      if (this.crumbs.length > 40) this.crumbs.shift();
      this.crumbs.push({
        p: at.clone().add(this.tmp.set((Math.random() - 0.5) * 0.06, 0, (Math.random() - 0.5) * 0.06)),
        v: new THREE.Vector3((Math.random() - 0.5) * 0.9, Math.random() * 0.8 + 0.2, (Math.random() - 0.5) * 0.9),
        life: 0, spin: Math.random() * 6, mesh: mi,
      });
    }
  }

  private crumbMesh(col: number): number {
    const p = new Prop(1, 1, 1, VOX);
    p.set(0, 0, 0, col);
    const md = meshGrid({ grid: p.grid, pal: this.kit.pal, scale: VOX, origin: [-0.5 * VOX, -0.5 * VOX, -0.5 * VOX], parts: new Uint8Array(1), greedy: true });
    const m = new THREE.InstancedMesh(geometryFrom(md), this.mat, 16);
    m.count = 0;
    m.frustumCulled = false;
    this.host.scene.add(m);
    this.crumbMeshes.push(m);
    this.crumbCols.push(col);
    return this.crumbMeshes.length - 1;
  }

  private updateCrumbs(dt: number, floor: number): void {
    for (const m of this.crumbMeshes) m.count = 0;
    const s = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.crumbs = this.crumbs.filter((c) => (c.life += dt) < 2.2);
    for (const c of this.crumbs) {
      if (c.p.y > floor + 0.012) {
        c.v.y -= 6 * dt;
        c.p.addScaledVector(c.v, dt);
        if (c.p.y <= floor + 0.012) { c.p.y = floor + 0.012; c.v.multiplyScalar(0.3); c.v.y = Math.abs(c.v.y) * 0.4; }
      }
      const m = this.crumbMeshes[c.mesh];
      if (!m || m.count >= 16) continue;
      const k = (c.life > 1.6 ? Math.max(0, 1 - (c.life - 1.6) / 0.6) : 1) * this.kit.scale * 0.9;
      e.set(c.spin * c.life, c.spin, 0);
      q.setFromEuler(e);
      this.m4.compose(c.p, q, s.setScalar(Math.max(0.001, k)));
      m.setMatrixAt(m.count++, this.m4);
    }
    for (const m of this.crumbMeshes) m.instanceMatrix.needsUpdate = true;
  }
}

/** A rotation seen in a mirror (x flipped): same turn, opposite handedness of the axes it moves. */
function mirrorQ(q: THREE.Quaternion, out: THREE.Quaternion): THREE.Quaternion {
  return out.set(q.x, -q.y, -q.z, q.w);
}

/** Rotation that points a model's axis along a direction while keeping its top up as far as it can. */
function aim(axis: THREE.Vector3, dir: THREE.Vector3, out: THREE.Quaternion): THREE.Quaternion {
  const upL = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const basis = (z: THREE.Vector3, up: THREE.Vector3) => {
    const x = new THREE.Vector3().crossVectors(up, z);
    if (x.lengthSq() < 1e-6) x.set(1, 0, 0);
    x.normalize();
    const y = new THREE.Vector3().crossVectors(z, x).normalize();
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z));
  };
  const ql = basis(axis.clone().normalize(), upL);
  const upW = Math.abs(axis.y) > 0.9 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const qw = basis(dir.clone().normalize(), upW);
  return out.copy(qw).multiply(ql.invert());
}

/** Ramen ends with the bowl lifted for the last of the broth. */
function drinkBroth(): Beat[] {
  return [{ d: 0.5, r: { at: 'low' }, l: { at: 'mouth', off: [0, -0.01, 0.02], hold: 'tip', rot: [-0.45, 0, 0] }, head: [0.06, 0, 0] },
    { d: 0.95, r: { at: 'low' }, l: { at: 'mouth', off: [0, 0, 0.01], hold: 'tip', rot: [-0.85, 0, 0] }, ev0: 'sip', head: [-0.08, 0, 0] },
    { d: 0.5, r: { at: 'low' }, l: { at: 'rest' }, head: [0.12, 0, 0] }];
}

const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];

export type { SfxName };
