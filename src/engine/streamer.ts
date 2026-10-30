import * as THREE from 'three';
import type { MeshData } from '../world/mesher';
import type { WorkerOut } from '../world/worker';
import { CHUNK, CHUNKS_X, CHUNKS_Z, V, WX0, WZ0 } from '../world/layout';
import { geometryFrom } from '../game/actors';
import { SHADOW_STATIC } from './shadows';

const CM = CHUNK * V; // chunk side in metres

export interface Chunk {
  ix: number;
  iz: number;
  /** Tallest solid in the chunk (metres), from the height field, for culling before the mesh exists. */
  top: number;
  /** Meshes by level of detail: 0 full detail with props, 1 half resolution, 2 quarter resolution. */
  lv: (THREE.Mesh | null)[];
  pending: number | null;
  /** The level the view wants right now (null: not at all). */
  want: number | null;
  /** Last time (s) the view wanted it at all. */
  seen: number;
  /** Cutaway: occluders the chunk can touch, and whether it currently uses the cutaway material. */
  occ: number[];
  cut: boolean;
  /** Cross-fade in progress: the mesh being replaced, still drawn with the complementary dither. */
  fade: Fade | null;
}

interface Fade {
  old: THREE.Mesh;
  next: THREE.Mesh;
  t: number;
  mIn: THREE.ShaderMaterial;
  mOut: THREE.ShaderMaterial;
}

/** Seconds a level-of-detail swap takes to dissolve from the old mesh into the new one. */
const FADE_TIME = 0.5;
/** Metres of head start a chunk already at full detail gets in the ranking, so the edge doesn't flicker as you walk. */
const KEEP = 18;

export interface StreamView {
  cam: THREE.Camera;
  fp: boolean;
  /** The point the game is about (the player, or the title screen's focus). */
  focus: THREE.Vector3;
}

/** Level-of-detail rings for a view distance (metres): full detail inside `full`, half inside `half`, quarter out to `far`. */
export function lodRings(dist: number): { full: number; half: number; far: number } {
  const full = Math.min(80, Math.max(46, dist * 0.4));
  return { full, half: Math.max(full + 20, dist * 0.68), far: dist + CHUNK * V };
}

/**
 * Keeps the voxel city on the GPU only where the camera can see it. The world workers each own a strip
 * of chunk rows and mesh chunks on request; this decides which chunks are wanted (full detail in or near
 * the view, then half and quarter resolution with distance), queues requests nearest first, swaps meshes
 * in as they arrive and frees chunks that have been out of sight for a while.
 */
export class Streamer {
  readonly chunks: Chunk[] = [];
  /** Chunks with a mesh in the scene. */
  readonly resident = new Set<Chunk>();
  private inflight = new Map<number, Chunk>();
  private busy: number[];
  private nextId = 1;
  private t = 0;
  private planT = 0;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private box = new THREE.Box3();
  private waiters: (() => void)[] = [];
  /** Where the focus is heading: chunks ahead of the walk are ranked as if already nearer. */
  private lead = new THREE.Vector3();
  private lastFocus = new THREE.Vector3(NaN, 0, 0);
  private vel = new THREE.Vector2();
  private fading = new Set<Chunk>();
  private fadePool: THREE.ShaderMaterial[] = [];
  /** Makes a world material with the LODFADE dither (a `uFade` uniform of its own); null disables fading. */
  fadeMaterial: (() => THREE.ShaderMaterial) | null = null;
  /** Full-detail chunks kept around before the least recently seen are dropped. */
  budget: number;
  /** View distance in metres (first person draws out to it; the iso view uses coarser chunks when zoomed far out). */
  dist = 120;
  /** Called for every mesh added to the scene (materials, layers, cutaway bookkeeping). */
  onMesh: (c: Chunk, m: THREE.Mesh) => void = () => {};

  constructor(
    private workers: Worker[],
    private partOf: (iz: number) => number,
    height: Uint8Array,
    private group: THREE.Group,
    private material: () => THREE.Material,
    mobile: boolean,
  ) {
    this.busy = workers.map(() => 0);
    this.budget = mobile ? 130 : 240;
    for (let iz = 0; iz < CHUNKS_Z; iz++)
      for (let ix = 0; ix < CHUNKS_X; ix++) {
        let h = 0;
        for (let z = iz * CHUNK; z < (iz + 1) * CHUNK; z++)
          for (let x = ix * CHUNK; x < (ix + 1) * CHUNK; x++) h = Math.max(h, height[z * CHUNKS_X * CHUNK + x]);
        this.chunks.push({ ix, iz, top: h * V + 6, lv: [null, null, null], pending: null, want: null, seen: -1e9, occ: [], cut: false, fade: null });
      }
    workers.forEach((w, i) => {
      w.addEventListener('message', (e: MessageEvent<WorkerOut>) => { if (e.data.type === 'mesh') this.arrive(i, e.data); });
    });
  }

  chunkAt(x: number, z: number): Chunk | null {
    const ix = Math.floor((x - WX0) / CM), iz = Math.floor((z - WZ0) / CM);
    if (ix < 0 || iz < 0 || ix >= CHUNKS_X || iz >= CHUNKS_Z) return null;
    return this.chunks[iz * CHUNKS_X + ix];
  }

  /** World-space box of a chunk (x0, z0, x1, z1 in metres). */
  rect(c: Chunk): [number, number, number, number] {
    return [WX0 + c.ix * CM, WZ0 + c.iz * CM, WX0 + (c.ix + 1) * CM, WZ0 + (c.iz + 1) * CM];
  }

  /** Ground distance from a chunk's centre to a point (m). Runs per chunk per frame, so no allocations. */
  private dist2d(c: Chunk, p: THREE.Vector3): number {
    return Math.hypot(WX0 + (c.ix + 0.5) * CM - p.x, WZ0 + (c.iz + 0.5) * CM - p.z);
  }

  /** True when every chunk the view wants at full detail has arrived. */
  get settled(): boolean {
    for (const c of this.chunks) if (c.want === 0 && !c.lv[0]) return false;
    return true;
  }

  /** Resolves once the current view is fully streamed in. */
  ready(): Promise<void> {
    if (this.settled) return Promise.resolve();
    return new Promise((r) => this.waiters.push(r));
  }

  /** Decide what is wanted for a view and keep the request queue full. Call every frame. */
  update(dt: number, view: StreamView, active = true): void {
    this.t += dt;
    if (active && (this.planT -= dt) <= 0) {
      const dtPlan = 0.12 - this.planT;
      this.planT = 0.12;
      this.track(view.focus, dtPlan);
      this.plan(view);
    }
    this.pump(this.lead);
    if (this.fading.size) this.stepFades(dt);
    if (this.waiters.length && this.settled) { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  }

  /** Smoothed walking velocity, and the point a second or two ahead of it. Jumps (travel, doors) reset it. */
  private track(focus: THREE.Vector3, dt: number): void {
    const lf = this.lastFocus;
    if (Number.isNaN(lf.x) || Math.hypot(focus.x - lf.x, focus.z - lf.z) > 12 || dt <= 0) this.vel.set(0, 0);
    else {
      const k = 1 - Math.exp(-dt * 3);
      this.vel.x += ((focus.x - lf.x) / dt - this.vel.x) * k;
      this.vel.y += ((focus.z - lf.z) / dt - this.vel.y) * k;
    }
    lf.copy(focus);
    const ahead = 2.2, max = 14;
    let lx = this.vel.x * ahead, lz = this.vel.y * ahead;
    const l = Math.hypot(lx, lz);
    if (l > max) { lx *= max / l; lz *= max / l; }
    this.lead.set(focus.x + lx, focus.y, focus.z + lz);
  }

  private plan(view: StreamView): void {
    const { cam, fp } = view;
    const focus = this.lead;
    cam.updateMatrixWorld();
    // a slightly larger frustum than the screen, so chunks arrive just before they scroll into view
    if (cam instanceof THREE.OrthographicCamera) {
      const k = 1.3;
      const save = [cam.left, cam.right, cam.top, cam.bottom];
      cam.left *= k; cam.right *= k; cam.top *= k; cam.bottom *= k;
      cam.updateProjectionMatrix();
      this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      [cam.left, cam.right, cam.top, cam.bottom] = save;
      cam.updateProjectionMatrix();
    } else {
      this.m4.multiplyMatrices((cam as THREE.PerspectiveCamera).projectionMatrix, cam.matrixWorldInverse);
    }
    this.frustum.setFromProjectionMatrix(this.m4);
    const eye = cam.position;
    const ring = lodRings(this.dist);
    const wanted: { c: Chunk; d: number }[] = [];
    for (const c of this.chunks) {
      const [x0, z0, x1, z1] = this.rect(c);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const dFocus = Math.hypot(cx - focus.x, cz - focus.z);
      let want: Chunk['want'] = null;
      this.box.min.set(x0 - 1, -3, z0 - 1);
      this.box.max.set(x1 + 1, c.top, z1 + 1);
      if (fp) {
        // all around close by; further out only what the eye can see (turning round streams the rest in)
        const d = Math.hypot(cx - eye.x, cz - eye.z);
        if (d < 30) want = 0;
        else if (d < ring.far && this.frustum.intersectsBox(this.box)) {
          // a chunk keeps the finer level a little past the ring it earned it in
          const h = c.lv[0] || c.pending === 0 ? 8 : 0, h1 = c.lv[1] || c.pending === 1 ? 8 : 0;
          want = d < ring.full + h ? 0 : d < ring.half + h1 ? 1 : 2;
        }
      } else if (dFocus < 14 || this.frustum.intersectsBox(this.box)) {
        want = 0;
        // rank by distance ahead of the walk, with a head start for chunks already at full detail
        wanted.push({ c, d: dFocus - (c.lv[0] || c.pending === 0 ? KEEP : 0) });
      }
      c.want = want;
      if (want !== null) c.seen = this.t;
    }
    // zoomed far out in the iso view: keep full detail near the focus and draw the outskirts coarser
    if (wanted.length > this.budget * 0.8) {
      wanted.sort((a, b) => a.d - b.d);
      for (let i = Math.floor(this.budget * 0.8); i < wanted.length; i++) wanted[i].c.want = 1;
    }
    this.evict(view.focus);
  }

  /** Send the most urgent requests to idle workers. */
  private pump(focus: THREE.Vector3): void {
    if (this.busy.every((b) => b >= 2)) return;
    const queue: { c: Chunk; lod: number; pri: number }[] = [];
    for (const c of this.chunks) {
      if (c.want === null || c.pending !== null) continue;
      const lod = c.want;
      if (c.lv[lod]) continue;
      if (this.busy[this.partOf(c.iz)] >= 2) continue;
      queue.push({ c, lod, pri: this.dist2d(c, focus) + lod * 60 });
    }
    queue.sort((a, b) => a.pri - b.pri);
    for (const q of queue) {
      const p = this.partOf(q.c.iz);
      if (this.busy[p] >= 2) continue;
      this.busy[p]++;
      const id = this.nextId++;
      q.c.pending = q.lod;
      this.inflight.set(id, q.c);
      this.workers[p].postMessage({ type: 'mesh', id, ix: q.c.ix, iz: q.c.iz, lod: q.lod });
    }
  }

  private arrive(part: number, msg: Extract<WorkerOut, { type: 'mesh' }>): void {
    this.busy[part]--;
    const c = this.inflight.get(msg.id);
    this.inflight.delete(msg.id);
    if (!c) return;
    c.pending = null;
    const lv = msg.lod;
    if (!msg.mesh) {
      // nothing to draw (should not happen for the city, which always has ground): mark as loaded
      c.lv[lv] = new THREE.Mesh();
      return;
    }
    if (c.want === null && this.t - c.seen > 2) return; // no longer needed
    // a coarser mesh is only worth showing while it is still wanted or nothing finer is there
    if (c.want !== null && c.want < lv && c.lv.some((m, i) => m && i < lv)) return;
    const m = this.make(msg.mesh);
    this.endFade(c);
    // keep one mesh per chunk: the new one replaces whatever was drawn before, dissolving in over it
    let old: THREE.Mesh | null = null;
    for (let i = 0; i < 3; i++) if (c.lv[i]) {
      if (!old && c.lv[i]!.geometry.attributes.position) old = c.lv[i];
      else this.drop(c.lv[i]!);
      c.lv[i] = null;
    }
    c.lv[lv] = m;
    this.group.add(m);
    this.resident.add(c);
    this.onMesh(c, m);
    if (old) {
      if (this.fadeMaterial && !c.cut && old.material === m.material) this.startFade(c, old, m);
      else this.drop(old);
    }
  }

  private startFade(c: Chunk, old: THREE.Mesh, next: THREE.Mesh): void {
    const mk = () => this.fadePool.pop() ?? this.fadeMaterial!();
    const mIn = mk(), mOut = mk();
    mIn.uniforms.uFade.value.set(0, 0);
    mOut.uniforms.uFade.value.set(0, 1);
    c.fade = { old, next, t: 0, mIn, mOut };
    old.material = mOut;
    next.material = mIn;
    // the shadow cache only needs redrawing once, when the swap is complete
    next.layers.disable(SHADOW_STATIC);
    this.fading.add(c);
  }

  private stepFades(dt: number): void {
    for (const c of this.fading) {
      const f = c.fade!;
      f.t += dt / FADE_TIME;
      if (f.t >= 1) { this.endFade(c); continue; }
      const s = f.t * f.t * (3 - 2 * f.t);
      f.mIn.uniforms.uFade.value.x = s;
      f.mOut.uniforms.uFade.value.x = s;
    }
  }

  /** Finish a chunk's cross-fade now (the new mesh takes over fully). Safe to call when none is running. */
  endFade(c: Chunk): void {
    const f = c.fade;
    if (!f) return;
    c.fade = null;
    this.fading.delete(c);
    this.drop(f.old);
    this.fadePool.push(f.mIn, f.mOut);
    if (f.next.material === f.mIn) f.next.material = this.material();
    f.next.layers.enable(SHADOW_STATIC);
  }

  private make(md: MeshData): THREE.Mesh {
    const g = geometryFrom(md);
    // the GPU keeps its copy; the CPU arrays can go once uploaded
    const release = function (this: { array: ArrayLike<number> | null }) { this.array = null; };
    for (const a of Object.values(g.attributes)) {
      const buf = (a as THREE.InterleavedBufferAttribute).data ?? a;
      (buf as unknown as THREE.BufferAttribute).onUpload(release as () => void);
    }
    g.index?.onUpload(release as () => void);
    const m = new THREE.Mesh(g, this.material());
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    return m;
  }

  private drop(m: THREE.Mesh): void {
    m.removeFromParent();
    m.geometry.dispose();
  }

  /** Free chunks nobody has looked at for a while, oldest first, once over budget (or long gone). */
  private evict(focus: THREE.Vector3): void {
    const stale: Chunk[] = [];
    let full = 0;
    for (const c of this.resident) {
      if (c.lv[0]) full++;
      if (c.want === null) stale.push(c);
    }
    stale.sort((a, b) => a.seen - b.seen);
    for (const c of stale) {
      const far = this.dist2d(c, focus) > Math.max(130, this.dist + 30);
      const old = this.t - c.seen > 20;
      if (full <= this.budget && !far && !old) break;
      if (this.t - c.seen < 1.5) continue;
      if (c.lv[0]) full--;
      this.endFade(c);
      for (let i = 0; i < 3; i++) if (c.lv[i]) { this.drop(c.lv[i]!); c.lv[i] = null; }
      c.cut = false;
      this.resident.delete(c);
    }
  }

  /** The mesh currently drawn for a chunk, if any. */
  meshOf(c: Chunk): THREE.Mesh | null {
    return c.lv.find((m) => m && m.geometry.attributes.position) ?? null;
  }
}
