import * as THREE from 'three';
import {
  VOXEL_VERT, VOXEL_FRAG, FS_VERT, DOWN_FRAG, UP_FRAG, HALF_FRAG, COMPOSITE_FRAG, NUDGES,
} from './shaders';
import { WATER_Y } from '../world/layout';
import { SunShadows } from './shadows';
import { Sky, SKY_GLSL, skyUniforms, cloudUniforms } from './sky';

export type Quality = 'low' | 'medium' | 'high';

/**
 * 64 x 64 random values that tile, filtered and repeating: value noise for the drifting cloud shadows at
 * the cost of a texture fetch (the pattern repeats every 64 cells, about 1.4 km, so it never shows).
 */
function latticeNoise(): THREE.DataTexture {
  const n = 64, data = new Uint8Array(n * n);
  let seed = 7919;
  for (let i = 0; i < data.length; i++) data[i] = ((seed = (seed * 16807) % 2147483647) / 2147483647) * 255;
  const t = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

/** Uniforms shared by every voxel material (world chunks, props, characters). */
export function makeSharedUniforms() {
  return {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.62, 0.66, -0.4).normalize() },
    uSunColor: { value: new THREE.Color(1, 1, 1) },
    uSkyColor: { value: new THREE.Color(0.5, 0.6, 0.8) },
    uGroundColor: { value: new THREE.Color(0.3, 0.27, 0.25) },
    uFogColor: { value: new THREE.Color(0.7, 0.75, 0.85) },
    uWindowColor: { value: new THREE.Color(2.4, 1.6, 0.8) },
    /** Glass voxels inside this box (metres) are drawn clear: the window wall of the hotel room the player is in. */
    uClearGlass: { value: [new THREE.Vector3(1e9, 1e9, 1e9), new THREE.Vector3(-1e9, -1e9, -1e9)] },
    /** Nothing is drawn inside this box: what stands just outside that room's windows, while the player looks out. */
    uClearOut: { value: [new THREE.Vector3(1e9, 1e9, 1e9), new THREE.Vector3(-1e9, -1e9, -1e9)] },
    uLamp: { value: 0 },
    uNight: { value: 0 },
    uEmitDay: { value: 0.5 },
    uCloud: { value: 0.25 },
    ...cloudUniforms(),
    /** Covered markets: warm light and lamps lit all day inside these rects (x0, z0, x1, z1 m), under each top. */
    uWarm: { value: [new THREE.Vector4(1, 1, 0, 0), new THREE.Vector4(1, 1, 0, 0), new THREE.Vector4(1, 1, 0, 0)] },
    uWarmTop: { value: new THREE.Vector3(-1e9, -1e9, -1e9) },
    tNoise: { value: latticeNoise() },
    uBounds: { value: new THREE.Vector4(0, 0, 72, 56) },
    uCamFwd: { value: new THREE.Vector3(0, -1, 0) },
    uCutOn: { value: 0 },
    /** First-person distance fog: camera position and density (0 = off). */
    uFog: { value: new THREE.Vector4(0, 0, 0, 0) },
    tHeight: { value: null as THREE.Texture | null },
    // an integer sampler must never see the default (float) placeholder texture, so it starts with an empty one
    tSolid: { value: emptySolid() as THREE.Texture },
    uHeightRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    tOwner: { value: null as THREE.Texture | null },
    tCut: { value: null as THREE.Texture | null },
    uViewProj: { value: new THREE.Matrix4() },
    // real-time sun shadow map (engine/shadows.ts); the renderer points these at its own
    tShadow: { value: null as THREE.Texture | null },
    uShadowMat: { value: new THREE.Matrix4() },
    uShadow: { value: new THREE.Vector4(0, 0, 0, 0) },
    /** Sway bodies (world/sway.ts), the breeze (direction x, z, strength) and people who brush past. */
    tSway: { value: null as THREE.Texture | null },
    uWind: { value: new THREE.Vector4(1, 0, 0.5, 0) },
    uNudge: { value: Array.from({ length: NUDGES }, () => new THREE.Vector4()) },
  };
}
export type SharedUniforms = ReturnType<typeof makeSharedUniforms>;

export function voxelMaterial(shared: SharedUniforms, defines: Record<string, string | number> = {}, extra: Record<string, THREE.IUniform> = {}): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: VOXEL_VERT,
    fragmentShader: VOXEL_FRAG,
    uniforms: { ...shared, ...extra },
    defines,
  });
}

function fsMaterial(frag: string, uniforms: Record<string, THREE.IUniform>): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    vertexShader: FS_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
  });
}

export class Renderer {
  readonly gl: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly particleScene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;
  /** Eye-level camera for first-person view. Its far plane is the draw distance (the fog hides the cut). */
  readonly persp = new THREE.PerspectiveCamera(72, 1, 0.06, 80);
  firstPerson = false;
  /** near, far, 1 when perspective: lets depth-based effects work in metres with either camera. */
  readonly clip: THREE.IUniform<THREE.Vector3> = { value: new THREE.Vector3(1, 400, 0) };
  readonly shared = makeSharedUniforms();
  /** Depth texture uniform shared with particle materials (refreshed every frame). */
  readonly particleDepth: THREE.IUniform<THREE.Texture | null> = { value: null };
  /** And the scene's colour, for light that lands on it (the halls' sun shafts). */
  readonly particleColor: THREE.IUniform<THREE.Texture | null> = { value: null };
  /** Size of the half-res particle buffer in pixels (particles keep a minimum on-screen size). */
  readonly particleRes: THREE.IUniform<THREE.Vector2> = { value: new THREE.Vector2(1, 1) };
  quality: Quality;
  renderScale = 1;
  /** Hears each render pass start by name (the perf overlay times them on the GPU). */
  onPass: ((name: string) => void) | null = null;
  private pixelRatio = 1;
  private rtScene!: THREE.WebGLRenderTarget;
  private rtHalf!: THREE.WebGLRenderTarget;
  private rtParticles!: THREE.WebGLRenderTarget;
  private bloom: THREE.WebGLRenderTarget[] = [];
  private fsScene = new THREE.Scene();
  private fsCam = new THREE.Camera();
  private fsMesh: THREE.Mesh;
  private matDown: THREE.ShaderMaterial;
  private matUp: THREE.ShaderMaterial;
  private matHalf: THREE.ShaderMaterial;
  readonly composite: THREE.ShaderMaterial;
  readonly shadows: SunShadows;
  readonly sky: Sky;
  private fwd = new THREE.Vector3();
  private w = 1;
  private h = 1;
  /** Render target height in pixels. */
  get pixelHeight(): number { return this.h; }
  private frameTimes: number[] = [];
  private lastAdapt = 0;
  autoQuality = true;

  constructor(canvas: HTMLCanvasElement, quality: Quality) {
    this.quality = quality;
    this.gl = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance', stencil: false, depth: true });
    this.gl.autoClear = false;
    this.gl.outputColorSpace = THREE.LinearSRGBColorSpace;
    this.camera = new THREE.OrthographicCamera(-10, 10, 10, -10, 1, 400);
    this.shadows = new SunShadows(quality);
    this.shared.tShadow = this.shadows.uniforms.tShadow;
    this.shared.uShadowMat = this.shadows.uniforms.uShadowMat;
    this.shared.uShadow = this.shadows.uniforms.uShadow;

    const tri = new THREE.BufferGeometry();
    tri.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
    this.fsMesh = new THREE.Mesh(tri);
    this.fsMesh.frustumCulled = false;
    this.fsScene.add(this.fsMesh);

    this.matDown = fsMaterial(DOWN_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: 1.0 }, uFirst: { value: 0 } });
    this.matUp = fsMaterial(UP_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() }, uRadius: { value: 1 } });
    this.matUp.blending = THREE.AdditiveBlending;
    this.matUp.transparent = true;
    this.matHalf = fsMaterial(HALF_FRAG, { tSrc: { value: null }, uTexel: { value: new THREE.Vector2() } });
    const skyU = skyUniforms();
    this.composite = fsMaterial(COMPOSITE_FRAG.replace('//#SKY', SKY_GLSL), {
      ...skyU, tCloud: this.shared.tCloud, uCloudGeo: this.shared.uCloudGeo, uCloudMap: this.shared.uCloudMap,
      tScene: { value: null }, tDepth: { value: null }, tBloom: { value: null }, tHalf: { value: null }, tParticles: { value: null },
      uInvViewProj: { value: new THREE.Matrix4() }, uViewProj: { value: new THREE.Matrix4() },
      uCamFwd: { value: this.shared.uCamFwd.value }, uRes: { value: new THREE.Vector2() }, uClip: this.clip,
      uFog: this.shared.uFog, uFogColor: this.shared.uFogColor,
      uTime: this.shared.uTime, uWaterY: { value: WATER_Y }, uSunDir: this.shared.uSunDir, uSunColor: this.shared.uSunColor,
      uSkyTop: { value: new THREE.Color() }, uSkyHorizon: { value: new THREE.Color() },
      uWaterDeep: { value: new THREE.Color(0.02, 0.09, 0.1) }, uWaterScatter: { value: new THREE.Color(0.05, 0.22, 0.24) },
      uBloom: { value: 0.6 }, uExposure: { value: 1 }, uTilt: { value: 0.6 }, uSSR: { value: 1 }, uShafts: { value: 1 },
      uGradeShadow: { value: new THREE.Color(1, 1, 1) }, uGradeHigh: { value: new THREE.Color(1, 1, 1) },
      uSaturation: { value: 1.08 }, uVignette: { value: 0.55 }, uFade: { value: 1 },
      uWaterBounds: { value: new THREE.Vector4(-5, 42.9, 80, 50.1) }, uSea: { value: 0 }, uWet: { value: 0 }, uWetY: { value: 0 },
      tShore: { value: null }, uShoreRect: { value: new THREE.Vector4(0, 0, 1, 1) },
    });
    this.sky = new Sky(this.shared, skyU, this.shared, this.composite.uniforms.uSkyTop.value, this.composite.uniforms.uSkyHorizon.value);
    this.resize();
  }

  get isMobile(): boolean {
    return matchMedia('(pointer: coarse)').matches;
  }

  private msaa(): number {
    return this.quality === 'high' ? 4 : this.quality === 'medium' ? 2 : 0;
  }

  resize(): void {
    const dprCap = this.isMobile ? (this.quality === 'high' ? 2 : 1.6) : this.quality === 'low' ? 1 : 2;
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, dprCap) * this.renderScale;
    const cw = window.innerWidth, ch = window.innerHeight;
    this.gl.setPixelRatio(1);
    this.gl.setSize(Math.max(1, Math.round(cw * this.pixelRatio)), Math.max(1, Math.round(ch * this.pixelRatio)), false);
    this.gl.domElement.style.width = cw + 'px';
    this.gl.domElement.style.height = ch + 'px';
    const w = Math.max(2, Math.round(cw * this.pixelRatio));
    const h = Math.max(2, Math.round(ch * this.pixelRatio));
    this.w = w;
    this.h = h;
    this.disposeTargets();
    const depthTexture = new THREE.DepthTexture(w, h, THREE.UnsignedIntType);
    this.rtScene = new THREE.WebGLRenderTarget(w, h, {
      type: THREE.HalfFloatType, format: THREE.RGBAFormat, samples: this.msaa(), depthBuffer: true, depthTexture,
      minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
    });
    const half = (d: number, type: THREE.TextureDataType = THREE.HalfFloatType) =>
      new THREE.WebGLRenderTarget(Math.max(1, Math.round(w / d)), Math.max(1, Math.round(h / d)), { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false });
    this.rtHalf = half(2);
    this.rtParticles = half(2, THREE.HalfFloatType);
    this.particleRes.value.set(this.rtParticles.width, this.rtParticles.height);
    this.bloom = [half(4), half(8), half(16), half(32)];
    this.composite.uniforms.uRes.value.set(w, h);
    this.persp.aspect = cw / Math.max(1, ch);
    this.persp.updateProjectionMatrix();
  }

  /** The camera the scene is drawn with. */
  get view(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    return this.firstPerson ? this.persp : this.camera;
  }

  private disposeTargets() {
    this.rtScene?.depthTexture?.dispose();
    this.rtScene?.dispose();
    this.rtHalf?.dispose();
    this.rtParticles?.dispose();
    for (const b of this.bloom) b.dispose();
  }

  setQuality(q: Quality): void {
    if (q === this.quality) return;
    this.quality = q;
    this.shadows.setQuality(q);
    this.resize();
  }

  private pass(mat: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null, clear = true) {
    this.fsMesh.material = mat;
    this.gl.setRenderTarget(target);
    if (clear) this.gl.clear(true, false, false);
    this.gl.render(this.fsScene, this.fsCam);
  }

  /** Track frame times and nudge the render scale to hold a smooth frame rate. */
  adapt(dt: number, now: number): void {
    if (!this.autoQuality) return;
    this.frameTimes.push(dt);
    if (this.frameTimes.length > 90) this.frameTimes.shift();
    if (now - this.lastAdapt < 2500 || this.frameTimes.length < 60) return;
    const sorted = [...this.frameTimes].sort((a, b) => a - b);
    const p50 = sorted[Math.floor(sorted.length * 0.5)];
    let changed = false;
    if (p50 > 21 && this.renderScale > 0.55) { this.renderScale = Math.max(0.55, this.renderScale - 0.12); changed = true; }
    else if (p50 < 13.5 && this.renderScale < 1) { this.renderScale = Math.min(1, this.renderScale + 0.08); changed = true; }
    if (changed) { this.lastAdapt = now; this.frameTimes.length = 0; this.resize(); }
    else this.lastAdapt = now - 1500;
  }

  render(): void {
    const gl = this.gl;
    const cam = this.view;
    cam.updateMatrixWorld();
    this.clip.value.set(cam.near, cam.far, this.firstPerson ? 1 : 0);
    this.shared.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    // the sky first: it sets the haze colour every far shader fades into
    this.sky.update(this.shared.uTime.value, cam.getWorldDirection(this.fwd), (m, t) => this.pass(m, t));
    // sun shadows fade in with the sun; by night the moon is too dim to need them and the baked light carries it
    const sc = this.shared.uSunColor.value;
    const sunLum = sc.r * 0.2126 + sc.g * 0.7152 + sc.b * 0.0722;
    this.onPass?.('shadows');
    this.shadows.update(gl, this.scene, cam, this.firstPerson, this.shared.uSunDir.value, THREE.MathUtils.smoothstep(sunLum, 0.075, 0.15));
    // scene
    this.onPass?.('world');
    gl.setRenderTarget(this.rtScene);
    gl.setClearColor(0x000000, 1);
    gl.clear(true, true, false);
    gl.render(this.scene, cam);

    // half-res copy (tilt-shift source)
    this.onPass?.('bloom');
    this.matHalf.uniforms.tSrc.value = this.rtScene.texture;
    this.matHalf.uniforms.uTexel.value.set(1 / this.w, 1 / this.h);
    this.pass(this.matHalf, this.rtHalf);

    // bloom: downsample chain with bright pass, then additive tent upsample
    let src = this.rtHalf.texture;
    let sw = this.rtHalf.width, sh = this.rtHalf.height;
    for (let i = 0; i < this.bloom.length; i++) {
      this.matDown.uniforms.tSrc.value = src;
      this.matDown.uniforms.uTexel.value.set(1 / sw, 1 / sh);
      this.matDown.uniforms.uFirst.value = i === 0 ? 1 : 0;
      this.pass(this.matDown, this.bloom[i]);
      src = this.bloom[i].texture;
      sw = this.bloom[i].width; sh = this.bloom[i].height;
    }
    for (let i = this.bloom.length - 1; i > 0; i--) {
      const s = this.bloom[i];
      this.matUp.uniforms.tSrc.value = s.texture;
      this.matUp.uniforms.uTexel.value.set(1 / s.width, 1 / s.height);
      this.pass(this.matUp, this.bloom[i - 1], false);
    }

    // particles into a half-res premultiplied buffer
    this.onPass?.('particles');
    this.particleDepth.value = this.rtScene.depthTexture;
    this.particleColor.value = this.rtScene.texture;
    gl.setRenderTarget(this.rtParticles);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, false, false);
    gl.render(this.particleScene, cam);

    // composite to screen
    this.onPass?.('water+post');
    const u = this.composite.uniforms;
    u.tScene.value = this.rtScene.texture;
    u.tDepth.value = this.rtScene.depthTexture;
    u.tBloom.value = this.bloom[0].texture;
    u.tHalf.value = this.rtHalf.texture;
    u.tParticles.value = this.rtParticles.texture;
    u.uViewProj.value.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
    u.uInvViewProj.value.copy(u.uViewProj.value).invert();
    u.uSSR.value = this.quality === 'low' ? 0 : 1;
    u.uShafts.value = this.quality === 'high' ? 1 : 0;
    u.uCloudSteps.value = this.quality === 'high' ? 56 : this.quality === 'medium' ? 40 : 24;
    this.pass(this.composite, null);
  }

  get depthTexture(): THREE.DepthTexture {
    return this.rtScene.depthTexture as THREE.DepthTexture;
  }
}

function emptySolid(): THREE.DataTexture {
  const t = new THREE.DataTexture(new Uint32Array(2), 1, 1, THREE.RGIntegerFormat, THREE.UnsignedIntType);
  t.internalFormat = 'RG32UI';
  t.needsUpdate = true;
  return t;
}
