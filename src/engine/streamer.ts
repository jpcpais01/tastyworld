import * as THREE from 'three';
import type { MeshData } from '../world/mesher';
import type { WorkerOut } from '../world/worker';
import { CHUNK, CHUNKS_X, CHUNKS_Z, V, WX0, WZ0 } from '../world/layout';
import { geometryFrom } from '../game/actors';

const CM = CHUNK * V; // chunk side in metres

export interface Chunk {
  ix: number;
  iz: number;
  /** Tallest solid in the chunk (metres), from the height field, for culling before the mesh exists. */
  top: number;
  full: THREE.Mesh | null;
  lod: THREE.Mesh | null;
  pending: 'full' | 'lod' | null;
  /** What the view wants right now. */
  want: 'full' | 'lod' | null;
  /** Last time (s) the view wanted it at all. */
  seen: number;
  /** Cutaway: occluders the chunk can touch, and whether it currently uses the cutaway material. */
  occ: number[];
  cut: boolean;
}

export interface StreamView {
  cam: THREE.Camera;
  fp: boolean;
  /** The point the game is about (the player, or the title screen's focus). */
  focus: THREE.Vector3;
}

/**
 * Keeps the voxel city on the GPU only where the camera can see it. The world workers each own a strip
 * of chunk rows and mesh chunks on request; this decides which chunks are wanted (full detail in or near
 * the view, half resolution in the first-person distance), queues requests nearest first, swaps meshes
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
  /** Full-detail chunks kept around before the least recently seen are dropped. */
  budget: number;
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
    this.budget = mobile ? 110 : 190;
    for (let iz = 0; iz < CHUNKS_Z; iz++)
      for (let ix = 0; ix < CHUNKS_X; ix++) {
        let h = 0;
        for (let z = iz * CHUNK; z < (iz + 1) * CHUNK; z++)
          for (let x = ix * CHUNK; x < (ix + 1) * CHUNK; x++) h = Math.max(h, height[z * CHUNKS_X * CHUNK + x]);
        this.chunks.push({ ix, iz, top: h * V + 6, full: null, lod: null, pending: null, want: null, seen: -1e9, occ: [], cut: false });
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

  /** True when every chunk the view wants at full detail has arrived. */
  get settled(): boolean {
    for (const c of this.chunks) if (c.want === 'full' && !c.full) return false;
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
      this.planT = 0.12;
      this.plan(view);
    }
    this.pump(view.focus);
    if (this.waiters.length && this.settled) { const w = this.waiters; this.waiters = []; w.forEach((f) => f()); }
  }

  private plan(view: StreamView): void {
    const { cam, fp, focus } = view;
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
    for (const c of this.chunks) {
      const [x0, z0, x1, z1] = this.rect(c);
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      const dFocus = Math.hypot(cx - focus.x, cz - focus.z);
      let want: Chunk['want'] = null;
      if (fp) {
        const d = Math.hypot(cx - eye.x, cz - eye.z);
        if (d < 46) want = 'full';
        else if (d < 92) want = 'lod';
      } else {
        this.box.min.set(x0 - 1, -3, z0 - 1);
        this.box.max.set(x1 + 1, c.top, z1 + 1);
        if (dFocus < 14 || this.frustum.intersectsBox(this.box)) want = 'full';
      }
      c.want = want;
      if (want) c.seen = this.t;
    }
    this.evict(focus);
  }

  /** Send the most urgent requests to idle workers. */
  private pump(focus: THREE.Vector3): void {
    if (this.busy.every((b) => b >= 2)) return;
    const queue: { c: Chunk; lod: boolean; pri: number }[] = [];
    for (const c of this.chunks) {
      if (!c.want || c.pending) continue;
      const lod = c.want === 'lod';
      if (lod ? c.lod : c.full) continue;
      if (this.busy[this.partOf(c.iz)] >= 2) continue;
      const [x0, z0, x1, z1] = this.rect(c);
      const d = Math.hypot((x0 + x1) / 2 - focus.x, (z0 + z1) / 2 - focus.z);
      queue.push({ c, lod, pri: d + (lod ? 60 : 0) });
    }
    queue.sort((a, b) => a.pri - b.pri);
    for (const q of queue) {
      const p = this.partOf(q.c.iz);
      if (this.busy[p] >= 2) continue;
      this.busy[p]++;
      const id = this.nextId++;
      q.c.pending = q.lod ? 'lod' : 'full';
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
    if (!msg.mesh) {
      // nothing to draw (should not happen for the city, which always has ground): mark as loaded
      if (msg.lod) c.lod = new THREE.Mesh(); else c.full = new THREE.Mesh();
      return;
    }
    if (!c.want && this.t - c.seen > 2) return; // no longer needed
    const m = this.make(msg.mesh);
    if (msg.lod) {
      if (c.full && c.want !== 'lod') { this.drop(m); return; }
      if (c.full) { this.drop(c.full); c.full = null; }
      c.lod = m;
    } else {
      c.full = m;
      if (c.lod) { this.drop(c.lod); c.lod = null; }
    }
    this.group.add(m);
    this.resident.add(c);
    this.onMesh(c, m);
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
      if (c.full) full++;
      if (!c.want) stale.push(c);
    }
    stale.sort((a, b) => a.seen - b.seen);
    for (const c of stale) {
      const [x0, z0, x1, z1] = this.rect(c);
      const far = Math.hypot((x0 + x1) / 2 - focus.x, (z0 + z1) / 2 - focus.z) > 130;
      const old = this.t - c.seen > 20;
      if (full <= this.budget && !far && !old) break;
      if (this.t - c.seen < 1.5) continue;
      if (c.full) { this.drop(c.full); c.full = null; full--; }
      if (c.lod) { this.drop(c.lod); c.lod = null; }
      c.cut = false;
      this.resident.delete(c);
    }
  }

  /** Mesh objects currently drawn for a chunk (full detail wins over LOD). */
  meshOf(c: Chunk): THREE.Mesh | null {
    return c.full && c.full.geometry.attributes.position ? c.full : c.lod && c.lod.geometry.attributes.position ? c.lod : null;
  }
}
