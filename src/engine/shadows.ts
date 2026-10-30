import * as THREE from 'three';
import { FS_VERT, VOXEL_VERT } from './shaders';

export type ShadowQuality = 'low' | 'medium' | 'high';

/** three.js layers: static world meshes (cached) and moving casters such as characters (every frame). */
export const SHADOW_STATIC = 1;
export const SHADOW_DYNAMIC = 2;

const SIZE: Record<ShadowQuality, number> = { low: 1024, medium: 1536, high: 2048 };
const TAPS: Record<ShadowQuality, number> = { low: 1, medium: 4, high: 8 };
/** Height band (m) whose receivers the map must cover; anything above falls back to the baked sun. */
const Y_LO = -1.6, Y_HI = 10;
/** First person: radius (m) around the eye covered by the map, past the fog start. */
const FP_R = 24;
/** Light camera distance from the region centre (m), so tall casters up-sun are still inside the depth range. */
const L_DIST = 150;

const DEPTH_VERT = /* glsl */ `
void main() { gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;
const DEPTH_FRAG = /* glsl */ `
layout(location = 0) out vec4 outColor;
void main() { outColor = vec4(1.0); }
`;
const COPY_FRAG = /* glsl */ `
precision highp float;
uniform highp sampler2D tSrc;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  gl_FragDepth = texture(tSrc, vUv).r;
  outColor = vec4(1.0);
}
`;

/**
 * Depth-only material for a voxel caster that moves in the vertex shader (characters). It shares the
 * caster's own uniform objects, so it always matches the pose drawn in the main pass.
 */
export function voxelDepthMaterial(defines: Record<string, string | number>, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VOXEL_VERT,
    fragmentShader: DEPTH_FRAG,
    uniforms,
    defines,
    side: THREE.BackSide,
    colorWrite: false,
  });
}

function target(size: number, compare: boolean): THREE.WebGLRenderTarget {
  const depth = new THREE.DepthTexture(size, size, THREE.UnsignedIntType);
  depth.format = THREE.DepthFormat;
  if (compare) {
    // hardware PCF: every tap is a bilinear 2x2 depth comparison
    depth.compareFunction = THREE.LessEqualCompare;
    depth.minFilter = depth.magFilter = THREE.LinearFilter;
  } else {
    depth.minFilter = depth.magFilter = THREE.NearestFilter;
  }
  return new THREE.WebGLRenderTarget(size, size, {
    format: THREE.RedFormat, type: THREE.UnsignedByteType, depthBuffer: true, depthTexture: depth,
    minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false,
  });
}

/**
 * Real-time sun shadows, kept cheap.
 *
 * One orthographic shadow map is fitted tightly to what the camera can see (the visible slab of street
 * and rooftops, projected along the sun) and snapped to whole texels, so shadows never shimmer.
 * The static world is drawn into a cached map that is only redrawn when the view leaves its margin, the
 * zoom changes a lot, or the set of visible world meshes changes. Each frame that cache is copied and the
 * characters are drawn on top. Casters draw their back faces only (the voxel world is closed), which
 * removes shadow acne without any depth bias.
 *
 * The voxel shader samples it with a few hardware PCF taps and falls back to the baked sun outside the
 * map, at night (the moon is too dim to need it) and on faces turned away from the sun.
 */
export class SunShadows {
  readonly cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, L_DIST * 2);
  readonly uniforms = {
    tShadow: { value: null as THREE.DepthTexture | null },
    uShadowMat: { value: new THREE.Matrix4() },
    /** strength (0 = baked only), normal offset (m), one texel in uv, taps */
    uShadow: { value: new THREE.Vector4(0, 0, 0, 0) },
  };
  private rtStatic: THREE.WebGLRenderTarget | null = null;
  private rtMap: THREE.WebGLRenderTarget | null = null;
  private size = 0;
  private taps = 4;
  private depthMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: DEPTH_VERT, fragmentShader: DEPTH_FRAG, side: THREE.BackSide, colorWrite: false,
  });
  private copyMat = new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: COPY_FRAG, uniforms: { tSrc: { value: null } },
    depthTest: true, depthWrite: true, depthFunc: THREE.AlwaysDepth, colorWrite: false,
  });
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.Camera();
  /** Cached region in light space: x0, y0, x1, y1 (m). Empty when the cache is stale. */
  private region: number[] | null = null;
  private sig = -1;
  private sunDir = new THREE.Vector3();
  private R = new THREE.Vector3();
  private U = new THREE.Vector3();
  private L = new THREE.Vector3();
  private dyn: THREE.Mesh[] = [];
  private v = new THREE.Vector3();
  private o = new THREE.Vector3();
  private d = new THREE.Vector3();
  private bias = new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
  /** Static redraws so far (for the debug readout). */
  redraws = 0;

  constructor(quality: ShadowQuality) {
    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    const m = new THREE.Mesh(tri, this.copyMat);
    m.frustumCulled = false;
    this.fsScene.add(m);
    this.setQuality(quality);
  }

  setQuality(q: ShadowQuality): void {
    this.taps = TAPS[q];
    const size = SIZE[q];
    if (size === this.size) return;
    this.size = size;
    this.rtStatic?.depthTexture?.dispose();
    this.rtStatic?.dispose();
    this.rtMap?.depthTexture?.dispose();
    this.rtMap?.dispose();
    this.rtStatic = target(size, false);
    this.rtMap = target(size, true);
    this.uniforms.tShadow.value = this.rtMap.depthTexture;
    this.region = null;
  }

  /** Force a redraw of the static cache (e.g. after swapping world meshes without changing their count). */
  invalidate(): void {
    this.region = null;
  }

  private basis(sun: THREE.Vector3): void {
    this.sunDir.copy(sun);
    this.L.copy(sun).normalize();
    this.cam.up.set(0, 1, 0);
    this.cam.position.set(0, 0, 0);
    this.cam.lookAt(-this.L.x, -this.L.y, -this.L.z);
    this.cam.updateMatrixWorld();
    this.R.setFromMatrixColumn(this.cam.matrixWorld, 0);
    this.U.setFromMatrixColumn(this.cam.matrixWorld, 1);
    this.region = null;
  }

  /**
   * Fit, redraw if needed and copy. `strength` fades the map in with the sun (0 skips everything).
   */
  update(gl: THREE.WebGLRenderer, scene: THREE.Scene, view: THREE.Camera, firstPerson: boolean, sun: THREE.Vector3, strength: number): void {
    const u = this.uniforms.uShadow.value;
    if (strength <= 0.001 || !this.rtStatic || !this.rtMap) { u.x = 0; return; }
    if (!sun.equals(this.sunDir)) this.basis(sun);

    // what the camera can see, as an AABB in light space (a, b) plus the mean depth along the sun (c)
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity, cs = 0;
    const add = (p: THREE.Vector3) => {
      const a = p.dot(this.R), b = p.dot(this.U);
      if (a < a0) a0 = a; if (a > a1) a1 = a;
      if (b < b0) b0 = b; if (b > b1) b1 = b;
      cs += p.dot(this.L);
    };
    if (firstPerson) {
      const e = view.position;
      for (let i = 0; i < 8; i++)
        add(this.v.set(e.x + (i & 1 ? FP_R : -FP_R), i & 2 ? Y_HI : Y_LO, e.z + (i & 4 ? FP_R : -FP_R)));
    } else {
      view.getWorldDirection(this.d);
      if (Math.abs(this.d.y) < 0.05) { u.x = 0; return; }
      for (let i = 0; i < 8; i++) {
        this.o.set(i & 1 ? 1 : -1, i & 2 ? 1 : -1, -1).unproject(view);
        const y = i & 4 ? Y_HI : Y_LO;
        add(this.v.copy(this.o).addScaledVector(this.d, (y - this.o.y) / this.d.y));
      }
    }

    // anything visible that casts into the cache must be part of it: redraw when that set changes
    let sig = 0, n = 0;
    this.dyn.length = 0;
    scene.traverseVisible((ob) => {
      if (ob.layers.isEnabled(SHADOW_STATIC)) { sig = (sig * 31 + ob.id) | 0; n++; }
      if (ob.layers.isEnabled(SHADOW_DYNAMIC) && (ob as THREE.Mesh).isMesh) this.dyn.push(ob as THREE.Mesh);
    });
    sig = (sig * 31 + n) | 0;

    const r = this.region;
    const needW = a1 - a0, needH = b1 - b0;
    const stale = !r || sig !== this.sig || a0 < r[0] || b0 < r[1] || a1 > r[2] || b1 > r[3]
      || needW * needH < 0.3 * (r[2] - r[0]) * (r[3] - r[1]);
    if (stale) {
      // margin so walking around doesn't redraw every few steps; sizes come in ~19% steps and the origin
      // sits on whole texels, so a redraw at the same zoom lands exactly on the previous texel grid
      const q = (x: number) => Math.pow(2, Math.ceil(Math.log2(x) * 4) / 4);
      const W = q(needW * 1.35 + 3), H = q(needH * 1.35 + 3);
      const tx = W / this.size, ty = H / this.size;
      const x0 = Math.floor(((a0 + a1) / 2 - W / 2) / tx) * tx, y0 = Math.floor(((b0 + b1) / 2 - H / 2) / ty) * ty;
      this.region = [x0, y0, x0 + W, y0 + H];
      this.sig = sig;
      const c = this.cam;
      const center = this.v.copy(this.R).multiplyScalar(x0 + W / 2).addScaledVector(this.U, y0 + H / 2).addScaledVector(this.L, cs / 8);
      c.position.copy(center).addScaledVector(this.L, L_DIST);
      c.left = -W / 2; c.right = W / 2; c.top = H / 2; c.bottom = -H / 2;
      c.updateProjectionMatrix();
      c.lookAt(center);
      c.updateMatrixWorld();
      this.uniforms.uShadowMat.value.copy(this.bias).multiply(c.projectionMatrix).multiply(c.matrixWorldInverse);
      u.y = Math.max(tx, ty) * 0.5;
      u.z = 1 / this.size;

      gl.setRenderTarget(this.rtStatic);
      gl.clear(true, true, false);
      c.layers.set(SHADOW_STATIC);
      scene.overrideMaterial = this.depthMat;
      gl.render(scene, c);
      scene.overrideMaterial = null;
      this.redraws++;
    }

    // per frame: copy the cached world, then draw the characters on top
    this.copyMat.uniforms.tSrc.value = this.rtStatic.depthTexture;
    gl.setRenderTarget(this.rtMap);
    gl.render(this.fsScene, this.fsCam);
    if (this.dyn.length) {
      const mats: THREE.Material[] = [];
      for (const m of this.dyn) { mats.push(m.material as THREE.Material); m.material = m.userData.shadowMat ?? this.depthMat; }
      this.cam.layers.set(SHADOW_DYNAMIC);
      gl.render(scene, this.cam);
      for (let i = 0; i < this.dyn.length; i++) this.dyn[i].material = mats[i];
    }
    gl.setRenderTarget(null);
    u.x = strength;
    u.w = this.taps;
  }
}
