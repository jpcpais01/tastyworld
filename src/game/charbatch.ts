import * as THREE from 'three';
import { STRIDE, type MeshData } from '../world/mesher';
import { voxelMaterial, type SharedUniforms } from '../engine/renderer';
import { voxelDepthMaterial, SHADOW_DYNAMIC } from '../engine/shadows';

/** Bodies the batch can hold at once (crowd bodies far away are released, so this is never near). */
const MAX_BODIES = 1536;
/** Texels per body in the pose texture; the layout is in POSE. */
const ROW = 32;
/** Pose texture width: 64 bodies side by side per texture row (so a frame's upload is a few row-sized copies). */
const WIDTH = 2048;
const ROWS = Math.ceil(MAX_BODIES * ROW / WIDTH);
/** Where each body's values sit among its ROW texels (4 floats each), starting at texel id * ROW. */
export const POSE = {
  /** 13 texels: pitch, yaw, roll of each part, and how far it is shrunk to its pivot (1 = gone). */
  rot: 0,
  /** 13 texels: each part's pivot (fixed for a body). */
  pivot: 13,
  /** root offset xyz, hit flash */
  offset: 26,
  /** baked sun, sky, highlight */
  light: 27,
  /** lamp rgb */
  lamp: 28,
} as const;

/**
 * Every animated character (people, cats, dogs, bikes, swan boats, birds) drawn in one call.
 *
 * Bodies are different meshes, so they share one three.js BatchedMesh: one vertex buffer, one material,
 * one multi-draw with per-body frustum culling and front-to-back order. A body's skeleton pose, root
 * offset and lighting live in its row of a float texture that the voxel vertex shader reads (POSE_TEXTURE),
 * and its placement in the scene is the batch's per-instance matrix. The main pass and the sun shadow pass
 * are one draw each however many people are about, and the CPU no longer re-uploads ~40 uniforms per body.
 */
export class CharacterBatch {
  readonly mesh: THREE.BatchedMesh;
  /** Pose rows, MAX_BODIES x ROW texels of RGBA floats. Bodies write their own row (see Actor). */
  readonly data = new Float32Array(WIDTH * ROWS * 4);
  private pose: THREE.DataTexture;
  private geo = new Map<number, number>();
  private roots = new Map<number, THREE.Object3D>();
  private shown = new Map<number, boolean>();
  private copies = new Set<number>();
  private top = -1;
  /** Told when the main view starts (true) and finishes (false) drawing the bodies, so the perf overlay can time them apart. */
  onView: ((drawing: boolean) => void) | null = null;

  constructor(shared: SharedUniforms) {
    this.pose = new THREE.DataTexture(this.data, WIDTH, ROWS, THREE.RGBAFormat, THREE.FloatType);
    this.pose.magFilter = this.pose.minFilter = THREE.NearestFilter;
    this.pose.generateMipmaps = false;
    this.pose.needsUpdate = true;
    const tPose = { value: this.pose };
    const defines = { CHARACTER: 1, POSE_TEXTURE: 1 };
    const mat = voxelMaterial(shared, defines, { tPose });
    this.mesh = new THREE.BatchedMesh(MAX_BODIES, 1 << 19, 3 << 18, mat);
    // culled per body against whichever camera draws it (the view, or the sun for shadows)
    this.mesh.frustumCulled = false;
    this.mesh.perObjectFrustumCulled = true;
    this.mesh.sortObjects = true;
    this.mesh.layers.enable(SHADOW_DYNAMIC);
    this.mesh.userData.shadowMat = voxelDepthMaterial(defines, { uTime: shared.uTime, tPose });
    // the shadow pass swaps in its own material, so drawing with ours means the main view
    const m = this.mesh, cull = m.onBeforeRender;
    m.onBeforeRender = (...args) => { cull.apply(m, args); if (args[4] === mat) this.onView?.(true); };
    m.onAfterRender = (...args) => { if (args[4] === mat) this.onView?.(false); };
  }

  /** Adds a body; returns its id (its row in `data`). `root` places it and decides whether it shows. */
  add(md: MeshData, pivots: THREE.Vector3[], root: THREE.Object3D): number {
    const g = bodyGeometry(md);
    const m = this.mesh;
    const nv = md.vertexCount, ni = md.indices.length;
    if (m.unusedVertexCount < nv || m.unusedIndexCount < ni) m.optimize();
    if (m.unusedVertexCount < nv || m.unusedIndexCount < ni) {
      const used = (max: number, unused: number) => max - unused;
      const mv = used(m.geometry.attributes.position.count, m.unusedVertexCount), mi = used(m.geometry.index!.count, m.unusedIndexCount);
      m.setGeometrySize(Math.ceil((mv + nv) * 1.5), Math.ceil((mi + ni) * 1.5));
    }
    const gid = m.addGeometry(g);
    const id = m.addInstance(gid);
    this.geo.set(id, gid);
    this.roots.set(id, root);
    this.shown.set(id, true);
    const o = id * ROW * 4;
    this.data.fill(0, o, o + ROW * 4);
    for (let i = 0; i < pivots.length; i++) pivots[i].toArray(this.data, o + (POSE.pivot + i) * 4);
    this.top = Math.max(this.top, id);
    return id;
  }

  /**
   * A mesh many bodies share (a flock of birds of one plumage): add it once, then place copies with
   * addCopy. Kept for the life of the batch.
   */
  shared(md: MeshData): number {
    const g = bodyGeometry(md), m = this.mesh;
    if (m.unusedVertexCount < md.vertexCount || m.unusedIndexCount < md.indices.length) m.optimize();
    if (m.unusedVertexCount < md.vertexCount || m.unusedIndexCount < md.indices.length) {
      const mv = m.geometry.attributes.position.count - m.unusedVertexCount, mi = m.geometry.index!.count - m.unusedIndexCount;
      m.setGeometrySize(Math.ceil((mv + md.vertexCount) * 1.5), Math.ceil((mi + md.indices.length) * 1.5));
    }
    return m.addGeometry(g);
  }

  /**
   * A body drawing a shared mesh. Its owner places it with place() and shows or hides it with show()
   * (there is no root object to follow), and writes its pose texels like any body. Returns its id.
   */
  addCopy(gid: number, pivots: THREE.Vector3[]): number {
    const id = this.mesh.addInstance(gid);
    this.copies.add(id);
    const o = id * ROW * 4;
    this.data.fill(0, o, o + ROW * 4);
    for (let i = 0; i < pivots.length; i++) pivots[i].toArray(this.data, o + (POSE.pivot + i) * 4);
    this.top = Math.max(this.top, id);
    return id;
  }

  /** Placement of a copy (see addCopy). */
  place(id: number, m: THREE.Matrix4): void {
    this.mesh.setMatrixAt(id, m);
  }

  /** Visibility of a copy (see addCopy). */
  show(id: number, on: boolean): void {
    this.mesh.setVisibleAt(id, on);
  }

  /** The texels of body `id` in `data` (pose, pivots, offset, light; see POSE). */
  texels(id: number): Float32Array {
    return this.data.subarray(id * ROW * 4, (id + 1) * ROW * 4);
  }

  remove(id: number): void {
    if (this.copies.delete(id)) { this.mesh.deleteInstance(id); return; }
    const gid = this.geo.get(id);
    if (gid === undefined) return;
    this.mesh.deleteGeometry(gid); // (and its instance)
    this.geo.delete(id);
    this.roots.delete(id);
    this.shown.delete(id);
  }

  /** Once a frame before drawing: placement and visibility from each body's root, and the pose upload. */
  sync(): void {
    const m = this.mesh;
    let top: THREE.Object3D = m;
    while (top.parent) top = top.parent;
    for (const [id, root] of this.roots) {
      // shown when the root and all its parents are visible, in the same scene as the batch
      let on = true, o: THREE.Object3D | null = root, last: THREE.Object3D = root;
      for (; o && on; o = o.parent) { on = o.visible; last = o; }
      on &&= last === top;
      if (on !== this.shown.get(id)) { m.setVisibleAt(id, on); this.shown.set(id, on); }
      if (!on) continue;
      root.updateWorldMatrix(true, false);
      m.setMatrixAt(id, root.matrixWorld);
    }
    if (this.top >= 0) {
      // three.js uploads update ranges one texture row at a time
      const end = (this.top + 1) * ROW * 4, rowLen = WIDTH * 4;
      this.pose.clearUpdateRanges();
      for (let o = 0; o < end; o += rowLen) this.pose.addUpdateRange(o, Math.min(rowLen, end - o));
      this.pose.needsUpdate = true;
    }
  }

  /** Bodies currently held (for the perf overlay). */
  get count(): number {
    return this.geo.size + this.copies.size;
  }
}

/** A body's geometry with plain (non-interleaved) attributes, so the batch can copy it with typed array sets. */
function bodyGeometry(md: MeshData): THREE.BufferGeometry {
  const n = md.vertexCount, a = md.attrs;
  const pack = new Uint8Array(n * 4), color = new Uint8Array(n * 4), quad = new Uint8Array(n * 4);
  for (let v = 0; v < n; v++) {
    const s = v * STRIDE, d = v * 4;
    for (let k = 0; k < 4; k++) {
      pack[d + k] = a[s + k];
      color[d + k] = a[s + 4 + k];
      quad[d + k] = a[s + 12 + k];
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(md.positions, 3));
  g.setAttribute('aPack', new THREE.BufferAttribute(pack, 4));
  g.setAttribute('aColor', new THREE.BufferAttribute(color, 4, true));
  g.setAttribute('aQuad', new THREE.BufferAttribute(quad, 4));
  g.setIndex(new THREE.BufferAttribute(md.indices, 1));
  return g;
}
