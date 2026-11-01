import * as THREE from 'three';
import { voxelMaterial, type SharedUniforms } from './renderer';
import { atlasTexture, useAtlas } from './atlas';
import { lodRings } from './streamer';
import { geometryFrom } from '../game/actors';
import { farTiles, type FarLot, type FarTile } from '../world/farTiles';
import type { MeshData } from '../world/mesher';
import type { WorkerIn, WorkerOut } from '../world/worker';

/**
 * The villages on the slopes round Amalfi, drawn with the town's own voxels (world/amalfiFar.ts builds every house
 * with the town's house generator, in a worker of its own). One base mesh holds all of them at 1 m voxels, a couple
 * of draws for the whole coast; tiles near the eye are drawn at half or full detail by meshes of their own, and the
 * base leaves those tiles out (a bit per tile in uFine). Fine meshes are asked for nearest first and dropped once
 * they have been out of use for a while.
 */

interface Tile {
  t: FarTile;
  box: THREE.Box3;
  /** Resident meshes at full (0) and half (1) detail. */
  lv: [THREE.Mesh[] | null, THREE.Mesh[] | null];
  /** Last time each level was wanted (s). */
  used: [number, number];
  pending: number | null;
  want: 0 | 1 | null;
  shown: 0 | 1 | null;
}

/** Fine meshes kept at most (full, half), and how long one out of use stays. */
const KEEP = [10, 28], LINGER = 8;

export class FarTown {
  readonly group = new THREE.Group();
  private tiles: Tile[];
  private worker: Worker;
  private matBase: THREE.ShaderMaterial;
  private matFine: THREE.ShaderMaterial;
  private fine = new Int32Array(4);
  private inflight = new Map<number, { tile: number; lod: number }>();
  private nextId = 1;
  private t = 0;
  private swept = 0;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4();
  private baseReady: Promise<void>;
  private camFwd: THREE.Vector3;

  constructor(private gl: THREE.WebGLRenderer, shared: SharedUniforms, rect: [number, number, number, number], lots: FarLot[], name: string) {
    this.tiles = farTiles(lots).map((t) => {
      let lo = Infinity, hi = -Infinity;
      for (const i of t.houses) { lo = Math.min(lo, lots[i].lo - 2); hi = Math.max(hi, lots[i].hi + 22); }
      return { t, box: new THREE.Box3(new THREE.Vector3(t.x0, lo, t.z0), new THREE.Vector3(t.x1, hi, t.z1)), lv: [null, null], used: [-1e9, -1e9], pending: null, want: null, shown: null };
    });
    const extra = () => ({ tAtlas: { value: null }, uFarRect: { value: new THREE.Vector4(...rect) } });
    this.matBase = voxelMaterial(shared, { ATLAS: 1, FAR: 1, FARBASE: 1 }, { ...extra(), uFine: { value: this.fine } });
    this.matFine = voxelMaterial(shared, { ATLAS: 1, FAR: 1 }, extra());
    this.camFwd = shared.uCamFwd.value;
    this.worker = new Worker(new URL('../world/worker.ts', import.meta.url), { type: 'module', name });
    this.worker.postMessage({ type: 'farInit', lots } satisfies WorkerIn);
    this.baseReady = new Promise((resolve) => {
      this.worker.onmessage = (e: MessageEvent<WorkerOut>) => {
        if (e.data.type !== 'farMesh') return;
        const job = this.inflight.get(e.data.id);
        this.inflight.delete(e.data.id);
        if (!job) return;
        const meshes = e.data.meshes.map((m) => this.make(m.mesh, m.home, job.lod === 2 ? this.matBase : this.matFine));
        if (job.lod === 2) { this.group.add(...meshes); resolve(); return; }
        const tl = this.tiles[job.tile];
        tl.pending = null;
        tl.lv[job.lod] = meshes;
        tl.used[job.lod] = this.t;
      };
    });
    this.request(this.tiles.map((_, i) => i), 2);
  }

  /** Resolves once every house is drawn at least coarsely. */
  ready(): Promise<void> { return this.baseReady; }

  private request(tiles: number[], lod: number): void {
    const id = this.nextId++;
    this.inflight.set(id, { tile: tiles[0], lod });
    if (lod < 2) this.tiles[tiles[0]].pending = lod;
    this.worker.postMessage({ type: 'farMesh', id, tiles, lod } satisfies WorkerIn);
  }

  private make(md: MeshData, home: Float32Array, mat: THREE.Material): THREE.Mesh {
    const g = geometryFrom(md);
    g.deleteAttribute('aSway');
    g.setAttribute('aHome', new THREE.BufferAttribute(home, 3));
    const m = new THREE.Mesh(g, mat);
    if (md.atlas) useAtlas(m, atlasTexture(this.gl, md.atlas));
    m.matrixAutoUpdate = false;
    m.renderOrder = 10;
    return m;
  }

  private drop(m: THREE.Mesh): void {
    this.group.remove(m);
    m.geometry.dispose();
    (m.userData.atlas as THREE.Texture | undefined)?.dispose();
  }

  /** The far coast's squat at a point in the iso view (engine/farcoast.ts SQUASH): below 0.6 nothing is drawn. */
  private squat(x: number, z: number, rect: THREE.Vector4): number {
    const mx = (rect.x + rect.z) / 2, mz = (rect.y + rect.w) / 2;
    const dx = x - mx, dz = z - mz, l = Math.hypot(dx, dz), fl = Math.hypot(this.camFwd.x, this.camFwd.z) || 1;
    if (l < 1) return 1;
    const side = -(dx * this.camFwd.x + dz * this.camFwd.z) / (l * fl);
    const out = Math.max(0, rect.x - x, x - rect.z, rect.y - z, z - rect.w);
    const ss = (a: number, b: number, v: number) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
    return 1 - 0.97 * ss(-0.3, 0.25, side) * ss(0, 24, out);
  }

  /**
   * Picks each tile's level: in first person by distance from the eye, on the town's own rings (engine/streamer.ts);
   * in the iso view by distance from the focus, where the view sees them at the town's own scale.
   */
  update(dt: number, cam: THREE.Camera, fp: boolean, focus: THREE.Vector3, dist: number): void {
    this.t += dt;
    cam.updateMatrixWorld();
    this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.m4);
    const ring = lodRings(dist), eye = cam.position;
    const rect = (this.matFine.uniforms.uFarRect.value as THREE.Vector4);
    const p = fp ? eye : focus;
    for (const tl of this.tiles) {
      const b = tl.box;
      const d = Math.hypot(Math.max(b.min.x - p.x, 0, p.x - b.max.x), Math.max(b.min.z - p.z, 0, p.z - b.max.z));
      let want: Tile['want'] = null;
      if (this.frustum.intersectsBox(b) && (fp || this.squat((b.min.x + b.max.x) / 2, (b.min.z + b.max.z) / 2, rect) >= 0.6)) {
        // (a tile keeps the finer level a little past the ring it earned it in)
        const h0 = tl.lv[0] || tl.pending === 0 ? 8 : 0, h1 = tl.lv[1] || tl.pending === 1 ? 8 : 0;
        const full = fp ? ring.full : 70, half = fp ? ring.half : 170;
        want = d < full + h0 ? 0 : d < half + h1 ? 1 : null;
      }
      tl.want = want;
      if (want !== null) tl.used[want] = this.t;
    }
    // ask for the nearest missing level, one tile at a time
    if (!this.inflight.size) {
      let best = -1, bestD = Infinity;
      this.tiles.forEach((tl, i) => {
        if (tl.want === null || tl.lv[tl.want] || tl.pending !== null) return;
        const b = tl.box, d = Math.hypot((b.min.x + b.max.x) / 2 - p.x, (b.min.z + b.max.z) / 2 - p.z) + tl.want * 60;
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) this.request([best], this.tiles[best].want!);
    }
    // show the wanted level, or whatever finer one is still there while it comes; the base draws the rest
    this.fine.fill(0);
    this.tiles.forEach((tl, i) => {
      const show: Tile['shown'] = tl.want !== null && tl.lv[tl.want] ? tl.want : tl.want !== null && tl.lv[tl.want ^ 1] ? ((tl.want ^ 1) as 0 | 1) : null;
      if (show !== tl.shown) {
        if (tl.shown !== null) for (const m of tl.lv[tl.shown] ?? []) this.group.remove(m);
        if (show !== null) this.group.add(...tl.lv[show]!);
        tl.shown = show;
      }
      if (show !== null) this.fine[i >> 5] |= 1 << (i & 31);
    });
    // now and then, drop the fine meshes longest out of use, past the budget or past their time
    if (this.t - this.swept < 0.5) return;
    this.swept = this.t;
    for (const lod of [0, 1] as const) {
      const held = this.tiles.filter((tl) => tl.lv[lod] && tl.shown !== lod).sort((a, b) => a.used[lod] - b.used[lod]);
      let n = this.tiles.filter((tl) => tl.lv[lod]).length;
      for (const tl of held) {
        if (n <= KEEP[lod] && this.t - tl.used[lod] < LINGER) break;
        for (const m of tl.lv[lod]!) this.drop(m);
        tl.lv[lod] = null;
        n--;
      }
    }
  }
}
