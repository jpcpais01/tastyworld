import * as THREE from 'three';
import { FACE_WINDOW, type MeshData } from '../world/mesher';
import type { WorkerOut } from '../world/worker';
import { CHUNK, CHUNKS_X, CHUNKS_Z, V, WX0, WZ0 } from '../world/layout';
import { geometryFrom } from '../game/actors';
import { SHADOW_STATIC } from './shadows';
import { atlasTexture, useAtlas } from './atlas';

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
  /** What is inside the chunk's ground-floor rooms, drawn only near the view (full detail only). */
  inner: Inner | null;
  /** The block of chunks this one is drawn with when they are all coarse. */
  cl: Cluster;
}

/**
 * A block of up to CL x CL chunks (never across two workers' strips) that is drawn as one coarse mesh while none
 * of its chunks needs full detail: far from the view a single draw stands in for up to sixteen. While it is
 * drawn its chunks keep no meshes of their own; when one of them comes near, they all stream in again and the
 * block dissolves into them once every chunk in view has arrived.
 */
export interface Cluster {
  ix: number;
  iz: number;
  nx: number;
  nz: number;
  members: Chunk[];
  /** Its coarse mesh (null: the chunks draw themselves) and that mesh's level of detail. */
  mesh: THREE.Mesh | null;
  lod: number;
  pending: number | null;
  /** The level it is wanted at (null: some chunk needs full detail, or none is in view). */
  want: number | null;
  /** Last time (s) any of its chunks was in view. */
  seen: number;
}

interface Inner {
  mesh: THREE.Mesh;
  /** Ground rect of the contents (x0, z0, x1, z1). */
  rect: [number, number, number, number];
  /** 0 hidden .. 1 shown; in between it dissolves with its own dither material. */
  t: number;
  mat: THREE.ShaderMaterial | null;
}

/** A mesh dissolving in or out with the level-of-detail dither (an outgoing one is dropped at the end). */
interface Fade {
  owner: Chunk | Cluster;
  t: number;
  mat: THREE.ShaderMaterial;
  out: boolean;
}

/** Chunks per side of a cluster. */
const CL = 4;

/** Faces of a swaying prop can turn this far (m) past their resting plane. */
const SWAY_SLACK = 0.3;
const ALL = 63, WITH_SEAMS = 127;

/**
 * Before each draw of a chunk: submit only the run of its faces (laid out by direction, see orderFaces) whose
 * directions can face this camera. The GPU would discard the rest anyway, but only after transforming them.
 * The sun's shadow passes (which don't draw layer 0) get every direction, and the two-sided cutaway material
 * gets the seam faces too (inside a lowered building they stand in for missing walls).
 */
function facingRange(this: THREE.Mesh, _r: THREE.WebGLRenderer, _s: THREE.Scene, camera: THREE.Camera, geometry: THREE.BufferGeometry): void {
  const segs = geometry.userData.segs as Uint32Array;
  let mask = ALL;
  if ((this.material as THREE.Material).side === THREE.DoubleSide) mask = WITH_SEAMS;
  else if (camera.layers.isEnabled(0)) {
    if ((camera as THREE.OrthographicCamera).isOrthographicCamera) {
      // every face has the same view direction (the camera's +Z, already up to date for this render): one
      // side of each axis, the other being edge-on or turned away
      const m = camera.matrixWorld.elements, x = m[8], y = m[9], z = m[10], e = 0.02;
      mask = (x > -e ? 1 : 0) | (x < e ? 2 : 0) | (y > -e ? 4 : 0) | (y < e ? 8 : 0) | (z > -e ? 16 : 0) | (z < e ? 32 : 0);
    } else {
      // a +X face can only be seen from beyond its plane, and the chunk's +X planes are all past its min x
      const p = camera.position, b = geometry.boundingBox!, k = SWAY_SLACK;
      mask = (p.x > b.min.x - k ? 1 : 0) | (p.x < b.max.x + k ? 2 : 0) | (p.y > b.min.y - k ? 4 : 0) | (p.y < b.max.y + k ? 8 : 0) | (p.z > b.min.z - k ? 16 : 0) | (p.z < b.max.z + k ? 32 : 0);
    }
  }
  const [a, z] = FACE_WINDOW[mask];
  geometry.setDrawRange(segs[a], segs[z + 1] - segs[a]);
}

/** Seconds a level-of-detail swap takes to dissolve from the old mesh into the new one. */
const FADE_TIME = 0.5;
/** Metres of head start a chunk already at full detail gets in the ranking, so the edge doesn't flicker as you walk. */
const KEEP = 18;
/** Room contents shown within `inner` metres stay until this much further, so standing at the edge doesn't flicker. */
const INNER_KEEP = 4;

export interface StreamView {
  cam: THREE.Camera;
  fp: boolean;
  /** The point the game is about (the player, or the title screen's focus). */
  focus: THREE.Vector3;
  /** What is inside ground-floor rooms is drawn within this many metres (of the eye in first person, else of the focus). */
  inner: number;
  /**
   * Great halls (a cathedral, a mosque) the player is in or near, as [x0, z0, x1, z1] in metres: everything inside
   * them is drawn however far its chunk is, so a long nave never loses its far arcades.
   */
  halls?: readonly (readonly number[])[];
}

/** Level-of-detail rings for a view distance (metres): full detail inside `full`, half inside `half`, quarter out to `far`. */
export function lodRings(dist: number): { full: number; half: number; far: number } {
  const full = Math.min(80, Math.max(46, dist * 0.4));
  // half detail stops growing at 240 m: past that (very far view) the extra reach is all quarter resolution
  return { full, half: Math.max(full + 20, Math.min(dist * 0.68, 240)), far: dist + CHUNK * V };
}

/**
 * Keeps the voxel city on the GPU only where the camera can see it. The world workers each own a strip
 * of chunk rows and mesh chunks on request; this decides which chunks are wanted (full detail in or near
 * the view, then half and quarter resolution with distance), queues requests nearest first, swaps meshes
 * in as they arrive and frees chunks that have been out of sight for a while. Far out, whole blocks of
 * coarse chunks are meshed and drawn as one (see Cluster), so the draw count stays flat however much of
 * the city is in view.
 */
export class Streamer {
  readonly chunks: Chunk[] = [];
  readonly clusters: Cluster[] = [];
  /** Chunks with a mesh in the scene. */
  readonly resident = new Set<Chunk>();
  /** Clusters with a mesh in the scene. */
  readonly residentClusters = new Set<Cluster>();
  private inflight = new Map<number, Chunk | Cluster>();
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
  private fades = new Map<THREE.Mesh, Fade>();
  private rank = new Map<Cluster, number>();
  private fadePool: THREE.ShaderMaterial[] = [];
  /** Makes a world material with the LODFADE dither (a `uFade` uniform of its own); null disables fading. */
  fadeMaterial: (() => THREE.ShaderMaterial) | null = null;
  /** Full-detail chunks kept around before the least recently seen are dropped. */
  budget: number;
  /** View distance in metres (first person draws out to it; the iso view uses coarser chunks when zoomed far out). */
  dist = 120;
  /** Called for every chunk mesh added to the scene (materials, layers, cutaway bookkeeping). */
  onMesh: (c: Chunk, m: THREE.Mesh) => void = () => {};

  constructor(
    private workers: Worker[],
    private partOf: (iz: number) => number,
    height: Uint8Array,
    private group: THREE.Group,
    private material: () => THREE.Material,
    mobile: boolean,
    private renderer: THREE.WebGLRenderer,
  ) {
    this.busy = workers.map(() => 0);
    this.budget = mobile ? 130 : 240;
    // clusters: CL x CL blocks, restarted at every worker's strip so each is meshed whole by one worker
    const band: number[] = [];
    for (let iz = 0; iz < CHUNKS_Z; iz++) band.push(iz > 0 && partOf(iz) === partOf(iz - 1) && iz - band[iz - 1] < CL ? band[iz - 1] : iz);
    const clusterAt = new Map<number, Cluster>();
    for (let iz = 0; iz < CHUNKS_Z; iz++)
      for (let ix = 0; ix < CHUNKS_X; ix++) {
        let h = 0;
        for (let z = iz * CHUNK; z < (iz + 1) * CHUNK; z++)
          for (let x = ix * CHUNK; x < (ix + 1) * CHUNK; x++) h = Math.max(h, height[z * CHUNKS_X * CHUNK + x]);
        const key = band[iz] * CHUNKS_X + Math.floor(ix / CL) * CL;
        let k = clusterAt.get(key);
        if (!k) {
          k = { ix: Math.floor(ix / CL) * CL, iz: band[iz], nx: 0, nz: 0, members: [], mesh: null, lod: 0, pending: null, want: null, seen: -1e9 };
          clusterAt.set(key, k);
          this.clusters.push(k);
        }
        k.nx = Math.max(k.nx, ix - k.ix + 1);
        k.nz = Math.max(k.nz, iz - k.iz + 1);
        const c: Chunk = { ix, iz, top: h * V + 6, lv: [null, null, null], pending: null, want: null, seen: -1e9, occ: [], cut: false, inner: null, cl: k };
        k.members.push(c);
        this.chunks.push(c);
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

  /** World-space box of a chunk or cluster (x0, z0, x1, z1 in metres). */
  rect(c: Chunk | Cluster): [number, number, number, number] {
    const nx = 'nx' in c ? c.nx : 1, nz = 'nz' in c ? c.nz : 1;
    return [WX0 + c.ix * CM, WZ0 + c.iz * CM, WX0 + (c.ix + nx) * CM, WZ0 + (c.iz + nz) * CM];
  }

  /** Meshes in the scene (chunks and clusters), for the debug readout. */
  get meshCount(): number {
    return this.resident.size + this.residentClusters.size;
  }

  /** Ground distance from a chunk's (or cluster's) centre to a point (m). Runs per chunk per frame, so no allocations. */
  private dist2d(c: Chunk | Cluster, p: THREE.Vector3): number {
    const nx = 'nx' in c ? c.nx : 1, nz = 'nz' in c ? c.nz : 1;
    return Math.hypot(WX0 + (c.ix + nx / 2) * CM - p.x, WZ0 + (c.iz + nz / 2) * CM - p.z);
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
    if (this.fades.size) this.stepFades(dt);
    for (const k of this.residentClusters) this.release(k);
    this.stepInner(dt, view);
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
          const h = c.lv[0] || c.pending === 0 ? 8 : 0, h1 = c.lv[1] || c.pending === 1 || (c.cl.mesh && c.cl.lod === 1) || c.cl.pending === 1 ? 8 : 0;
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
    // zoomed far out in the iso view: keep full detail near the focus and draw the outskirts coarser. Whole
    // clusters are ranked (by their nearest chunk), so the full-detail patch is made of them and every cluster
    // past it is drawn as one coarse mesh, not split chunk by chunk along the edge.
    if (wanted.length > this.budget * 0.8) {
      const rank = this.rank;
      rank.clear();
      for (const { c, d } of wanted) { const r = rank.get(c.cl); if (r === undefined || d < r) rank.set(c.cl, d); }
      const order = [...rank].sort((a, b) => a[1] - b[1]);
      let n = 0;
      const cap = Math.floor(this.budget * 0.8);
      for (const [k] of order) {
        if (n < cap) { for (const c of k.members) if (c.want === 0) n++; }
        else for (const c of k.members) if (c.want === 0) c.want = 1;
      }
    }
    // a cluster is drawn whole while none of its chunks needs full detail (or is cut away), at the finest
    // level any of them wants
    for (const k of this.clusters) {
      let fine = false, lod: number | null = null;
      for (const c of k.members) {
        if (c.want === null) continue;
        if (c.want === 0 || c.cut) { fine = true; break; }
        lod = lod === null ? c.want : Math.min(lod, c.want);
      }
      k.want = fine ? null : lod;
      if (fine || lod !== null) k.seen = this.t;
    }
    this.evict(view.focus);
  }

  /** Send the most urgent requests to idle workers. */
  private pump(focus: THREE.Vector3): void {
    if (this.busy.every((b) => b >= 2)) return;
    const queue: { c: Chunk | Cluster; lod: number; pri: number; part: number }[] = [];
    for (const c of this.chunks) {
      // a chunk drawn by its cluster asks for nothing of its own
      if (c.want === null || c.pending !== null || c.cl.want !== null) continue;
      const lod = c.want;
      if (c.lv[lod]) continue;
      const part = this.partOf(c.iz);
      if (this.busy[part] >= 2) continue;
      queue.push({ c, lod, pri: this.dist2d(c, focus) + lod * 60, part });
    }
    for (const k of this.clusters) {
      if (k.want === null || k.pending !== null || (k.mesh && k.lod === k.want)) continue;
      const part = this.partOf(k.iz);
      if (this.busy[part] >= 2) continue;
      queue.push({ c: k, lod: k.want, pri: this.dist2d(k, focus) + k.want * 60, part });
    }
    queue.sort((a, b) => a.pri - b.pri);
    for (const q of queue) {
      if (this.busy[q.part] >= 2) continue;
      this.busy[q.part]++;
      const id = this.nextId++;
      q.c.pending = q.lod;
      this.inflight.set(id, q.c);
      const nx = 'nx' in q.c ? q.c.nx : 1, nz = 'nz' in q.c ? q.c.nz : 1;
      this.workers[q.part].postMessage({ type: 'mesh', id, ix: q.c.ix, iz: q.c.iz, lod: q.lod, nx, nz });
    }
  }

  private arrive(part: number, msg: Extract<WorkerOut, { type: 'mesh' }>): void {
    this.busy[part]--;
    const c = this.inflight.get(msg.id);
    this.inflight.delete(msg.id);
    if (!c) return;
    c.pending = null;
    if ('members' in c) { this.arriveCluster(c, msg); return; }
    const lv = msg.lod;
    if (!msg.mesh) {
      // nothing to draw (should not happen for the city, which always has ground): mark as loaded
      c.lv[lv] = new THREE.Mesh();
      return;
    }
    if (c.want === null && this.t - c.seen > 2) return; // no longer needed
    if (c.cl.want !== null) return; // its cluster draws it now
    // a coarser mesh is only worth showing while it is still wanted or nothing finer is there
    if (c.want !== null && c.want < lv && c.lv.some((m, i) => m && i < lv)) return;
    const m = this.make(msg.mesh);
    this.endFade(c);
    this.dropInner(c);
    // keep one mesh per chunk: the new one replaces whatever was drawn before, dissolving in over it
    let old: THREE.Mesh | null = null;
    for (let i = 0; i < 3; i++) if (c.lv[i]) {
      if (!old && c.lv[i]!.geometry.attributes.position) old = c.lv[i];
      else this.drop(c.lv[i]!);
      c.lv[i] = null;
    }
    c.lv[lv] = m;
    this.group.add(m);
    const im = m.children[0] as THREE.Mesh | undefined;
    if (im) {
      const [x0, , z0, x1, , z1] = msg.mesh.innerBounds!;
      c.inner = { mesh: im, rect: [x0, z0, x1, z1], t: 0, mat: null };
    }
    this.resident.add(c);
    this.onMesh(c, m);
    if (c.cl.mesh) {
      // its cluster is still drawn: wait under it until all of the cluster's chunks in view are here
      m.visible = false;
      if (old) this.drop(old);
    } else if (old) {
      if (this.fadeMaterial && !c.cut && old.visible) this.swap(c, old, m);
      else this.drop(old);
    }
  }

  private arriveCluster(k: Cluster, msg: Extract<WorkerOut, { type: 'mesh' }>): void {
    // only while still wanted (its chunks may have taken over meanwhile), and never coarser than what it shows
    // (a block of city always has ground, so an empty one is not expected)
    if (!msg.mesh || k.want === null || (k.mesh && msg.lod > k.want)) return;
    const m = this.make(msg.mesh);
    m.userData.shadowKeep = true;
    this.group.add(m);
    this.residentClusters.add(k);
    const old = k.mesh;
    k.mesh = m;
    k.lod = msg.lod;
    const fade = !!this.fadeMaterial && !!old;
    if (old) {
      if (this.fadeMaterial) this.fadeOut(k, old);
      else this.drop(old);
    }
    // the chunks it stands in for give up their meshes
    let shown = false;
    for (const c of k.members) {
      this.endFade(c);
      this.dropInner(c);
      for (let i = 0; i < 3; i++) {
        const cm = c.lv[i];
        if (!cm) continue;
        c.lv[i] = null;
        if (cm.visible && cm.geometry.attributes.position && this.fadeMaterial && !c.cut) { this.fadeOut(c, cm); shown = true; }
        else this.drop(cm);
      }
      this.resident.delete(c);
    }
    if (fade || shown) this.fadeIn(k, m);
  }

  /**
   * A cluster no longer wanted whole (one of its chunks came near) gives way once every chunk of it in view has
   * its own mesh, dissolving into them.
   */
  private release(k: Cluster): void {
    if (!k.mesh) return;
    if (k.want !== null) {
      // whole again and drawn at the level wanted: chunk meshes that arrived meanwhile are not needed
      if (k.lod === k.want) for (const c of k.members) this.dropHidden(c);
      return;
    }
    let any = false;
    for (const c of k.members) {
      if (c.want === null) continue;
      any = true;
      if (!c.lv.some((m) => m)) return;
    }
    if (!any) return; // nothing of it in view: it stays until evicted
    for (const c of k.members) for (const m of c.lv) if (m && !m.visible) {
      m.visible = true;
      if (this.fadeMaterial && !c.cut) this.fadeIn(c, m);
    }
    const old = k.mesh;
    k.mesh = null;
    if (this.fadeMaterial) this.fadeOut(k, old);
    else this.drop(old);
    this.residentClusters.delete(k);
  }

  /** Drop the meshes a chunk keeps hidden under its cluster. */
  private dropHidden(c: Chunk): void {
    let left = false;
    for (let i = 0; i < 3; i++) {
      const m = c.lv[i];
      if (!m) continue;
      if (m.visible) { left = true; continue; }
      if (i === 0) this.dropInner(c);
      this.drop(m);
      c.lv[i] = null;
    }
    if (!left) this.resident.delete(c);
  }

  /** A chunk's mesh replaced by a finer or coarser one: the two dissolve into each other. */
  private swap(c: Chunk, old: THREE.Mesh, next: THREE.Mesh): void {
    this.fadeOut(c, old);
    this.fadeIn(c, next);
  }

  /**
   * Dissolve a mesh in. One fading in and one fading out over the same span use complementary dithers, so
   * between them every pixel is covered exactly once.
   */
  private fadeIn(owner: Chunk | Cluster, m: THREE.Mesh): void {
    const mat = this.fadePool.pop() ?? this.fadeMaterial!();
    mat.uniforms.uFade.value.set(0, 0);
    m.material = mat;
    // the sun's shadow cache takes it in once it is complete
    m.layers.disable(SHADOW_STATIC);
    this.fades.set(m, { owner, t: 0, mat, out: false });
  }

  /** Dissolve a mesh out; it is dropped at the end. */
  private fadeOut(owner: Chunk | Cluster, m: THREE.Mesh): void {
    const mat = this.fadePool.pop() ?? this.fadeMaterial!();
    mat.uniforms.uFade.value.set(0, 1);
    m.material = mat;
    for (const ch of m.children) (ch as THREE.Mesh).material = mat;
    this.fades.set(m, { owner, t: 0, mat, out: true });
  }

  private stepFades(dt: number): void {
    for (const [m, f] of this.fades) {
      f.t += dt / FADE_TIME;
      if (f.t >= 1) { this.finish(m, f); continue; }
      f.mat.uniforms.uFade.value.x = f.t * f.t * (3 - 2 * f.t);
    }
  }

  private finish(m: THREE.Mesh, f: Fade): void {
    this.fades.delete(m);
    this.fadePool.push(f.mat);
    if (f.out) { this.drop(m); return; }
    if (m.material === f.mat) m.material = this.material();
    m.layers.enable(SHADOW_STATIC);
  }

  /** Finish a chunk's dissolves now (its current mesh takes over fully). Safe to call when none is running. */
  endFade(c: Chunk): void {
    for (const [m, f] of this.fades) if (f.owner === c) this.finish(m, f);
  }

  private make(md: MeshData): THREE.Mesh {
    const g = geometryFrom(md);
    // the GPU keeps its copy; the CPU arrays can go once uploaded
    const release = function (this: { array: ArrayLike<number> | null }) { this.array = null; };
    for (const a of Object.values(g.attributes)) {
      const buf = (a as THREE.InterleavedBufferAttribute).data ?? a;
      (buf as unknown as THREE.BufferAttribute).onUpload(release as () => void);
    }
    let ig: THREE.BufferGeometry | null = null;
    if (md.shell !== undefined) {
      // room contents: their own draw over the same vertex buffers, from the tail of the index list
      const all = g.index!.array;
      ig = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) ig.setAttribute(name, a);
      ig.setIndex(new THREE.BufferAttribute(all.subarray(md.shell), 1));
      ig.index!.onUpload(release as () => void);
      const [x0, y0, z0, x1, y1, z1] = md.innerBounds!;
      ig.boundingBox = new THREE.Box3(new THREE.Vector3(x0, y0, z0), new THREE.Vector3(x1, y1, z1));
      ig.boundingSphere = ig.boundingBox.getBoundingSphere(new THREE.Sphere());
      g.setIndex(new THREE.BufferAttribute(all.subarray(0, md.shell), 1));
    }
    g.index?.onUpload(release as () => void);
    const m = new THREE.Mesh(g, this.material());
    if (md.segs) { g.userData.segs = md.segs; m.onBeforeRender = facingRange; }
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    // the world is static: a streamed mesh leaving the view leaves its shadow right, so the sun's shadow cache
    // is never redrawn for one going (see engine/shadows.ts)
    m.userData.shadowKeep = true;
    m.layers.enable(SHADOW_STATIC);
    if (ig) {
      const im = new THREE.Mesh(ig, m.material);
      im.matrixAutoUpdate = false;
      im.userData.shadowKeep = true;
      // always in the sun's shadow cache (so coming and going never redraws it), out of the view until near
      im.layers.set(SHADOW_STATIC);
      m.add(im);
    }
    if (md.atlas) {
      const tex = atlasTexture(this.renderer, md.atlas);
      useAtlas(m, tex);
      for (const ch of m.children) useAtlas(ch as THREE.Mesh, tex);
    }
    return m;
  }

  private drop(m: THREE.Mesh): void {
    const f = this.fades.get(m);
    if (f) { this.fades.delete(m); this.fadePool.push(f.mat); }
    m.removeFromParent();
    m.geometry.dispose();
    (m.userData.atlas as THREE.Texture | undefined)?.dispose();
    for (const ch of m.children) (ch as THREE.Mesh).geometry.dispose();
  }

  /**
   * Room contents fade in as the view comes within `inner` metres and out again past it. Shown, they wear
   * the chunk's own material (so the cutaway and level-of-detail dissolves apply to them as well).
   */
  private stepInner(dt: number, view: StreamView): void {
    const p = view.fp ? view.cam.position : view.focus;
    for (const c of this.resident) {
      const n = c.inner;
      if (!n) continue;
      const [x0, z0, x1, z1] = n.rect;
      const d = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1));
      const hall = view.halls?.some((r) => x0 < r[2] && x1 > r[0] && z0 < r[3] && z1 > r[1]) ?? false;
      const want = hall || d < view.inner + (n.t > 0 ? INNER_KEEP : 0) ? 1 : 0;
      // a cut building has its own material to wear, so it snaps (it is near the player anyway)
      if (c.cut) n.t = want;
      else if (n.t !== want) n.t = want ? Math.min(1, n.t + dt / FADE_TIME) : Math.max(0, n.t - dt / FADE_TIME);
      const shell = n.mesh.parent as THREE.Mesh;
      if (n.t > 0 && n.t < 1) {
        if (!n.mat) {
          if (!this.fadeMaterial) { n.t = want; continue; }
          n.mat = this.fadePool.pop() ?? this.fadeMaterial();
        }
        n.mat.uniforms.uFade.value.set(n.t * n.t * (3 - 2 * n.t), 0);
        n.mesh.material = n.mat;
      } else {
        if (n.mat) { this.fadePool.push(n.mat); n.mat = null; }
        n.mesh.material = shell.material;
      }
      if (n.t > 0) n.mesh.layers.enable(0);
      else n.mesh.layers.disable(0);
    }
  }

  private dropInner(c: Chunk): void {
    const n = c.inner;
    if (!n) return;
    if (n.mat) this.fadePool.push(n.mat);
    c.inner = null;
  }

  /** Free chunks (and clusters) nobody has looked at for a while, oldest first, once over budget (or long gone). */
  private evict(focus: THREE.Vector3): void {
    const stale: Chunk[] = [];
    let full = 0;
    for (const c of this.resident) {
      if (c.lv[0]) full++;
      if (c.want === null) stale.push(c);
    }
    stale.sort((a, b) => a.seen - b.seen);
    const farOff = Math.max(130, this.dist + 30);
    for (const c of stale) {
      const far = this.dist2d(c, focus) > farOff;
      const old = this.t - c.seen > 20;
      if (full <= this.budget && !far && !old) break;
      if (this.t - c.seen < 1.5) continue;
      if (c.lv[0]) full--;
      this.endFade(c);
      this.dropInner(c);
      for (let i = 0; i < 3; i++) if (c.lv[i]) { this.drop(c.lv[i]!); c.lv[i] = null; }
      c.cut = false;
      this.resident.delete(c);
    }
    // a cluster is cheap to keep (one coarse mesh): it goes once all of it has been out of view a while
    for (const k of this.residentClusters) {
      if (k.want !== null || !k.mesh || this.t - k.seen < 20) continue;
      for (const c of k.members) for (const m of c.lv) if (m) m.visible = true;
      this.drop(k.mesh);
      k.mesh = null;
      this.residentClusters.delete(k);
    }
  }

  /** The mesh currently drawn for a chunk, if any. */
  meshOf(c: Chunk): THREE.Mesh | null {
    return c.lv.find((m) => m && m.geometry.attributes.position) ?? null;
  }
}
