import * as THREE from 'three';
import * as GL from './globe';
import type { LatLon } from './globe';

export type { LatLon } from './globe';

/**
 * The travel map: a little voxel planet in its own WebGL canvas. Drag to spin it, pinch or scroll to zoom; pins are
 * DOM elements placed over it. Flying is a short film: the camera swoops down to the runway at home, the plane rolls,
 * lifts off through the clouds, cruises along the great circle while day and night sweep past underneath, and lands
 * on the other side, ready for the camera to dive into the city.
 */

interface Pin { el: HTMLElement; at: LatLon; pos: THREE.Vector3; dir: THREE.Vector3; }
/** A camera framing: look at `dir` at radius `rad`, from `dist` away, tilted `pitch` from overhead, facing `head`. */
interface Shot { dir: THREE.Vector3; rad: number; head: number; pitch: number; dist: number; fov: number; }

const LR = 0.022; // take-off roll, in globe radii
const RUNWAY = 0.038;
const LIFT = GL.U * 0.34; // runway surface above the airport cell
const MAP_PITCH = 0.3;
const MAP_FOV = 30;
const smooth = (a: number, b: number, x: number) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const wrapAng = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const coarse = () => matchMedia('(pointer: coarse)').matches;

function slerpDir(a: THREE.Vector3, b: THREE.Vector3, k: number, out: THREE.Vector3): THREE.Vector3 {
  const d = Math.max(-1, Math.min(1, a.dot(b))), th = Math.acos(d);
  if (th < 1e-5) return out.copy(b);
  if (Math.PI - th < 1e-3) { out.copy(a).lerp(b, k).add(new THREE.Vector3(0, 1e-3, 0)); return out.normalize(); }
  const s = Math.sin(th), wa = Math.sin((1 - k) * th) / s, wb = Math.sin(k * th) / s;
  return out.set(a.x * wa + b.x * wb, a.y * wa + b.y * wb, a.z * wa + b.z * wb).normalize();
}

/** The way from one place to another: a great circle, or a lap over the city when both are the same place. */
class Path {
  readonly a: THREE.Vector3;
  readonly b: THREE.Vector3;
  readonly theta: number;
  readonly loop: boolean;
  /** Length on the ground, in globe radii. */
  readonly len: number;
  /** Highest point of the arc above the ground. */
  readonly top: number;
  readonly hours: number;
  private fwd = new THREE.Vector3();
  private left = new THREE.Vector3();

  constructor(from: LatLon, to: LatLon) {
    this.a = GL.toDir(from.lat, from.lon);
    this.b = GL.toDir(to.lat, to.lon);
    this.theta = Math.acos(Math.max(-1, Math.min(1, this.a.dot(this.b))));
    this.loop = this.theta < 0.03;
    if (this.loop) {
      GL.tangents(this.a, this.fwd, this.left); // head east, circle round to the north
      this.len = Math.PI * 2 * 0.03;
      this.top = 0.03;
      this.hours = 0.5;
    } else {
      this.len = this.theta;
      this.top = 0.05 + 0.07 * this.theta / Math.PI;
      this.hours = (this.theta * 6371) / 850 + 0.6;
    }
  }

  /** Direction at s (0 = take-off, 1 = touchdown; beyond either end it carries straight on, for the runways). */
  dirAt(s: number, out: THREE.Vector3): THREE.Vector3 {
    if (this.loop) {
      const r = 0.03;
      let x: number, y: number;
      if (s < 0) { x = s * this.len; y = 0; } else if (s > 1) { x = (s - 1) * this.len; y = 0; } else { const f = Math.PI * 2 * s; x = r * Math.sin(f); y = r * (1 - Math.cos(f)); }
      return out.copy(this.a).addScaledVector(this.fwd, x).addScaledVector(this.left, y).normalize();
    }
    const th = this.theta, sn = Math.sin(th), wa = Math.sin((1 - s) * th) / sn, wb = Math.sin(s * th) / sn;
    return out.set(this.a.x * wa + this.b.x * wb, this.a.y * wa + this.b.y * wb, this.a.z * wa + this.b.z * wb).normalize();
  }

  altAt(s: number): number { return s > 0 && s < 1 ? this.top * Math.sin(Math.PI * s) : 0; }

  /** Compass heading at s, in radians clockwise from north. */
  headingAt(s: number): number {
    const d1 = this.dirAt(s, new THREE.Vector3()), d2 = this.dirAt(s + 1e-3, new THREE.Vector3());
    const e = new THREE.Vector3(), n = new THREE.Vector3();
    GL.tangents(d1, e, n);
    d2.sub(d1);
    return Math.atan2(d2.dot(e), d2.dot(n));
  }
}

interface Flight {
  path: Path;
  t: number;
  speed: number;
  hold: number; roll: number; air: number; out: number;
  /** Ground speed at lift-off and touchdown, in s per second. */
  v: number;
  done: (() => void) | null;
}

interface Puff { p: THREE.Vector3; age: number; }

export class WorldMap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private gl: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(MAP_FOV, 1, 0.01, 90);
  private u = GL.sharedUniforms();
  private pinLayer: HTMLElement;
  private pins: Pin[] = [];
  private land: GL.Land | null = null;
  private built = false;
  // scene parts
  private planeMesh!: THREE.Mesh;
  private shadow!: THREE.Mesh;
  private runways: THREE.Mesh[] = [];
  private landmarks = new Map<string, { mesh: THREE.Mesh; at: LatLon }>();
  private clouds!: THREE.Group;
  private puffs!: THREE.InstancedMesh;
  private puffFade!: THREE.InstancedBufferAttribute;
  private trail: Puff[] = [];
  private trailClock = 0;
  private routeMesh: THREE.Mesh | null = null;
  private routeMat!: THREE.ShaderMaterial;
  private stars!: THREE.Points;
  private disposables: { dispose(): void }[] = [];
  // camera
  private view: Shot = { dir: new THREE.Vector3(0, 0, 1), rad: GL.R, head: 0, pitch: MAP_PITCH, dist: 2.5, fov: MAP_FOV };
  private target: THREE.Vector3 | null = null;
  private zoom = 1;
  private intro = 0;
  private spin = { lon: 0, lat: 0 };
  private insets = { top: 0, bottom: 0, left: 0, right: 0 };
  /** Where on screen the camera's focus sits (eases with the insets, and to the centre while flying). */
  private off = { x: NaN, y: NaN };
  private pointers = new Map<number, { x: number; y: number }>();
  private pinch = 0;
  // travel
  private path: Path | null = null;
  private flight: Flight | null = null;
  private from: Shot | null = null;
  private dive: { t: number; ms: number; from: Shot; done: () => void } | null = null;
  private clock = 0;
  private simHours = 0;
  private flightHours = 0;
  private raf = 0;
  private last = 0;
  private frameNo = 0;
  private ro: ResizeObserver;
  private vw = 1;
  private vh = 1;
  private dpr = 1;
  /** Set when the user has spun the globe by hand. */
  panned = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'wm';
    this.gl = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.gl.setClearColor(0x131a3c, 1);
    this.canvas = this.gl.domElement;
    this.pinLayer = document.createElement('div');
    this.pinLayer.className = 'wm-pins';
    this.el.append(this.canvas, this.pinLayer);
    parent.appendChild(this.el);
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.up(e));
    this.canvas.addEventListener('wheel', (e) => { e.preventDefault(); if (!this.busy) this.zoom = Math.max(0.7, Math.min(3.4, this.zoom * Math.exp(-e.deltaY * 0.0015))); }, { passive: false });
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.resize();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    for (const d of this.disposables) d.dispose();
    this.routeMesh?.geometry.dispose();
    this.gl.dispose();
    this.gl.forceContextLoss();
    this.el.remove();
  }

  private get busy(): boolean { return !!(this.flight || this.dive); }

  /** Screen space the map should keep its focus inside (e.g. not under the bottom sheet). */
  setInsets(top: number, bottom: number, left = 0, right = 0): void {
    this.insets = { top, bottom, left, right };
  }

  addPin(el: HTMLElement, at: LatLon): void {
    this.pinLayer.appendChild(el);
    this.pins.push({ el, at: { lat: at.lat, lon: at.lon }, pos: new THREE.Vector3(), dir: GL.toDir(at.lat, at.lon) });
  }

  /** Smoothly turn a place to the middle of the free screen area. */
  focus(at: LatLon, snap = false): void {
    const d = GL.toDir(at.lat, at.lon);
    this.panned = false;
    this.spin = { lon: 0, lat: 0 };
    if (snap) {
      // the first look: the globe turns in from the west and settles
      this.view.dir.copy(GL.toDir(at.lat - 8, at.lon - 55));
      this.intro = 1;
    }
    this.target = d;
  }

  /** Show the route between two places. */
  setRoute(a: LatLon | null, b?: LatLon): void {
    if (this.flight) return;
    this.path = a && b ? new Path(a, b) : null;
    if (this.built) this.placeRoute();
  }

  /** Speed the rest of the flight up (the skip button). */
  skip(): void {
    if (this.flight) this.flight.speed = 5;
    if (this.dive) this.dive.ms = Math.min(this.dive.ms, this.dive.t + 250);
  }

  /**
   * Fly the plane along the current route. Resolves once it has stopped on the runway. The sun runs on with the
   * flight, so it lands at `arrive` o'clock local (sun) time when given, or after the real flight time otherwise.
   */
  fly(arrive?: number): Promise<void> {
    const path = this.path;
    if (!path || this.flight) return Promise.resolve();
    if (arrive !== undefined) {
      const now = new Date(), utc = now.getUTCHours() + now.getUTCMinutes() / 60;
      const lon = GL.toLatLon(path.b).lon;
      this.flightHours = (((arrive - lon / 15 - utc) % 24) + 24) % 24;
    } else this.flightHours = path.hours;
    const air = path.loop ? 3.2 : 2.6 + 2.6 * path.theta / Math.PI;
    const roll = 1.4;
    return new Promise((done) => {
      this.from = { ...this.view, dir: this.view.dir.clone() };
      this.flight = { path, t: 0, speed: 1, hold: 0.8, roll, air, out: 1, v: (2 * LR) / path.len / roll, done };
      this.target = null;
      this.pointers.clear();
    });
  }

  /** After landing: the camera dives down into the city. */
  diveIn(ms = 1300): Promise<void> {
    return new Promise((done) => {
      this.dive = { t: 0, ms, from: { ...this.view, dir: this.view.dir.clone() }, done };
    });
  }

  // ------------------------------------------------------------------ building
  private build(): void {
    this.built = true;
    const u = this.u;
    const force = this.pins.map((p) => p.at);
    this.land = GL.buildLand(force);
    const voxel = GL.voxelMaterial(u);
    const landMesh = new THREE.Mesh(this.land.geo, voxel);
    landMesh.matrixAutoUpdate = false;
    const ocean = new THREE.Mesh(new THREE.SphereGeometry(GL.OCEAN_R, 128, 64), GL.oceanMaterial(u, this.land.coast));
    const atmoR = 1.1;
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(atmoR, 64, 32), GL.atmosphereMaterial(u, atmoR));
    atmo.renderOrder = 3;
    this.scene.add(landMesh, ocean, atmo);
    this.disposables.push(this.land.geo, this.land.coast, voxel, ocean.geometry, ocean.material as THREE.Material, atmo.geometry, atmo.material as THREE.Material);
    // stars
    const n = 700, sp = new Float32Array(n * 3), size = new Float32Array(n), seed = new Float32Array(n);
    const v = new THREE.Vector3();
    for (let i = 0, j = 0; i < n; j++) {
      v.set(GL.hash(j, 1) * 2 - 1, GL.hash(j, 2) * 2 - 1, GL.hash(j, 3) * 2 - 1);
      if (v.lengthSq() > 1 || v.lengthSq() < 0.01) continue;
      v.normalize().multiplyScalar(60);
      sp.set([v.x, v.y, v.z], i * 3);
      size[i] = 1 + Math.pow(GL.hash(i, 4), 6) * 2.6;
      seed[i] = GL.hash(i, 5);
      i++;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    sg.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    sg.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.stars = new THREE.Points(sg, GL.starsMaterial(this.dpr));
    this.stars.frustumCulled = false;
    this.scene.add(this.stars);
    this.disposables.push(sg, this.stars.material as THREE.Material);
    // clouds, kept clear of the airports so take-off and landing stay in view
    const away = force.map((f) => GL.toDir(f.lat, f.lon));
    const box = new THREE.BoxGeometry(1, 1, 1);
    const blocks: THREE.Matrix4[] = [];
    const e = new THREE.Vector3(), nn = new THREE.Vector3(), s = new THREE.Vector3();
    for (let i = 0, made = 0; made < 54 && i < 400; i++) {
      const lat = -58 + GL.hash(i, 31) * 128, lon = -180 + GL.hash(i, 37) * 360;
      const d = GL.toDir(lat, lon);
      if (away.some((a) => a.dot(d) > Math.cos(0.13))) continue;
      made++;
      GL.tangents(d, e, nn);
      const alt = 0.03 + GL.hash(i, 41) * 0.016, k = 1.1 + GL.hash(i, 43) * 1.1;
      const parts = 3 + Math.floor(GL.hash(i, 47) * 4);
      for (let j = 0; j < parts; j++) {
        const ox = (GL.hash(i * 9 + j, 51) - 0.5) * 0.04 * k, oz = (GL.hash(i * 9 + j, 53) - 0.5) * 0.022 * k;
        const sx = (0.012 + GL.hash(i * 9 + j, 57) * 0.016) * k, sy = (0.005 + GL.hash(i * 9 + j, 59) * 0.005) * k, sz = (0.01 + GL.hash(i * 9 + j, 61) * 0.012) * k;
        const c = d.clone().multiplyScalar(GL.R + alt + (j === 0 ? sy * 0.4 : 0)).addScaledVector(e, ox).addScaledVector(nn, oz);
        const up = c.clone().normalize();
        const m = new THREE.Matrix4().makeBasis(e, up, nn.clone().negate());
        m.scale(s.set(sx, j === 0 ? sy * 1.5 : sy, sz)).setPosition(c);
        blocks.push(m);
      }
    }
    const cm = new THREE.InstancedMesh(box, GL.cloudMaterial(u), blocks.length);
    blocks.forEach((m, i) => cm.setMatrixAt(i, m));
    cm.frustumCulled = false;
    this.clouds = new THREE.Group();
    this.clouds.add(cm);
    this.scene.add(this.clouds);
    this.disposables.push(box, cm.material as THREE.Material);
    // the plane, its shadow and contrail
    const pg = GL.planeGeometry();
    this.planeMesh = new THREE.Mesh(pg, voxel);
    this.planeMesh.matrixAutoUpdate = false;
    this.planeMesh.visible = false;
    this.planeMesh.frustumCulled = false;
    const shg = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    this.shadow = new THREE.Mesh(shg, GL.shadowMaterial());
    this.shadow.matrixAutoUpdate = false;
    this.shadow.visible = false;
    this.shadow.renderOrder = 1;
    const pb = new THREE.BoxGeometry(1, 1, 1);
    this.puffFade = new THREE.InstancedBufferAttribute(new Float32Array(140), 1);
    this.puffFade.setUsage(THREE.DynamicDrawUsage);
    pb.setAttribute('aFade', this.puffFade);
    this.puffs = new THREE.InstancedMesh(pb, GL.puffMaterial(u), 140);
    this.puffs.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.puffs.frustumCulled = false;
    this.puffs.renderOrder = 2;
    this.scene.add(this.planeMesh, this.shadow, this.puffs);
    this.disposables.push(pg, shg, this.shadow.material as THREE.Material, pb, this.puffs.material as THREE.Material);
    // runways at both ends of the route
    const rg = GL.runwayGeometry(RUNWAY, 0.0065);
    for (let i = 0; i < 2; i++) {
      const m = new THREE.Mesh(rg, voxel);
      m.matrixAutoUpdate = false;
      m.visible = false;
      this.runways.push(m);
      this.scene.add(m);
    }
    this.disposables.push(rg);
    // landmarks at every destination
    for (const p of this.pins) {
      const id = p.el.dataset.place;
      const g = id ? GL.landmarkGeometry(id) : null;
      if (!g || !id) continue;
      const m = new THREE.Mesh(g, voxel);
      m.matrixAutoUpdate = false;
      this.landmarks.set(id, { mesh: m, at: p.at });
      this.scene.add(m);
      this.disposables.push(g);
    }
    this.routeMat = GL.routeMaterial(u);
    this.disposables.push(this.routeMat);
    for (const p of this.pins) p.pos.copy(p.dir).multiplyScalar(GL.groundAt(this.land, p.at) + 0.002);
    this.placeRoute();
  }

  /** Put a mesh on the ground at a direction, facing a heading (radians clockwise from north). */
  private place(m: THREE.Object3D, dir: THREE.Vector3, heading: number, scale: number, rad: number): void {
    const e = new THREE.Vector3(), n = new THREE.Vector3();
    GL.tangents(dir, e, n);
    const fwd = n.clone().multiplyScalar(Math.cos(heading)).addScaledVector(e, Math.sin(heading));
    const left = new THREE.Vector3().crossVectors(dir, fwd);
    m.matrix.makeBasis(left.multiplyScalar(scale), dir.clone().multiplyScalar(scale), fwd.multiplyScalar(scale)).setPosition(dir.clone().multiplyScalar(rad));
    m.matrixWorldNeedsUpdate = true;
  }

  private placeRoute(): void {
    if (this.routeMesh) { this.scene.remove(this.routeMesh); this.routeMesh.geometry.dispose(); this.routeMesh = null; }
    const p = this.path;
    for (const r of this.runways) r.visible = !!p;
    // landmarks stand beside their runway, or just east of town when no route is shown
    for (const [, lm] of this.landmarks) {
      const d = GL.toDir(lm.at.lat, lm.at.lon);
      const atEnd = p && d.dot(p.b) > 0.99999 ? 1 : p && d.dot(p.a) > 0.99999 ? 0 : -1;
      // the terminal is on the runway's right, so the landmark goes on its left
      const run = atEnd < 0 || !p ? 0 : p.headingAt(atEnd ? 1 : 0), left = run - Math.PI / 2;
      const e = new THREE.Vector3(), n = new THREE.Vector3();
      GL.tangents(d, e, n);
      const side = n.multiplyScalar(Math.cos(left)).addScaledVector(e, Math.sin(left));
      const at = d.clone().addScaledVector(side, 0.012).normalize();
      this.place(lm.mesh, at, run, 0.0045, GL.GROUND_R + GL.U * 0.24);
    }
    this.planeMesh.visible = !!p && !p.loop;
    if (!p) return;
    const pts: THREE.Vector3[] = [], d = new THREE.Vector3();
    const N = Math.max(24, Math.round(p.len * 90));
    for (let i = 0; i <= N; i++) {
      const s = i / N;
      pts.push(p.dirAt(s, d).clone().multiplyScalar(GL.GROUND_R + LIFT + 0.003 + p.altAt(s)));
    }
    this.routeMesh = new THREE.Mesh(GL.routeGeometry(pts), this.routeMat);
    this.routeMesh.frustumCulled = false;
    this.routeMesh.renderOrder = 4;
    this.routeMat.uniforms.uLen.value = this.routeMesh.geometry.userData.len;
    this.routeMat.uniforms.uProg.value = 0;
    this.scene.add(this.routeMesh);
    // runways: home along the take-off heading, destination along the landing one
    const homeS = (-LR + RUNWAY * 0.44) / p.len, destS = 1 + (RUNWAY * 0.38) / p.len;
    this.place(this.runways[0], p.dirAt(homeS, d), p.headingAt(homeS), 1, GL.GROUND_R);
    this.place(this.runways[1], p.dirAt(destS, d), p.headingAt(destS), 1, GL.GROUND_R);
    this.runways[1].visible = !p.loop;
    // the plane waits at the start of the home runway
    this.posePlane(p, -LR / p.len, 0);
  }

  // ------------------------------------------------------------------ the flight
  /** Where the flight is at time t: path position s, and how far through the cruise (0 to 1). */
  private flightAt(f: Flight): { s: number; air: number; ground: boolean; stopped: boolean } {
    const s0 = -LR / f.path.len;
    let t = f.t - f.hold;
    if (t < 0) return { s: s0, air: 0, ground: true, stopped: false };
    if (t < f.roll) { const k = t / f.roll; return { s: s0 * (1 - k * k), air: 0, ground: true, stopped: false }; }
    t -= f.roll;
    if (t < f.air) {
      const x = t / f.air, m = f.v * f.air;
      const s = (-2 * x ** 3 + 3 * x ** 2) + m * (x ** 3 - 2 * x ** 2 + x) + m * (x ** 3 - x ** 2); // Hermite, matching the ground speed at both ends
      return { s, air: x, ground: false, stopped: false };
    }
    t = Math.min(t - f.air, f.out);
    return { s: 1 + f.v * (t - (t * t) / (2 * f.out)), air: 1, ground: true, stopped: t >= f.out };
  }

  private planeScale(alt: number): number { return Math.min(0.042, 0.022 + 0.24 * alt); }

  private posePlane(p: Path, s: number, roll: number): { dir: THREE.Vector3; rad: number; head: number; alt: number } {
    const dir = p.dirAt(s, new THREE.Vector3()), alt = p.altAt(s);
    const rad = GL.GROUND_R + LIFT + alt;
    const pos = dir.clone().multiplyScalar(rad);
    const ahead = p.dirAt(s + 2e-3, new THREE.Vector3()).multiplyScalar(GL.GROUND_R + LIFT + p.altAt(s + 2e-3));
    const fwd = ahead.sub(pos).normalize();
    const up = dir.clone().addScaledVector(fwd, -dir.dot(fwd)).normalize().applyAxisAngle(fwd, roll);
    const left = new THREE.Vector3().crossVectors(up, fwd);
    const k = this.planeScale(alt);
    this.planeMesh.matrix.makeBasis(left.multiplyScalar(k), up.multiplyScalar(k), fwd.clone().multiplyScalar(k)).setPosition(pos);
    this.planeMesh.matrixWorldNeedsUpdate = true;
    // shadow on whatever is below
    const ll = GL.toLatLon(dir);
    const g = this.land ? GL.groundAt(this.land, ll) : GL.OCEAN_R;
    const gs = k * (1.1 + alt * 18);
    const sm = this.shadow.material as THREE.ShaderMaterial;
    sm.uniforms.uAlpha.value = 0.34 * (1 - smooth(0.0, 0.07, alt));
    this.place(this.shadow, dir, p.headingAt(s), 1, Math.max(g, GL.GROUND_R + (alt < 0.002 ? LIFT : 0)) + 0.0004);
    this.shadow.matrix.scale(new THREE.Vector3(gs, 1, gs * 1.1));
    return { dir, rad, head: p.headingAt(s), alt };
  }

  private chase(dir: THREE.Vector3, rad: number, head: number, kind: 'take' | 'cruise' | 'land', theta: number): Shot {
    if (kind === 'take') return { dir, rad, head: head + 0.85, pitch: 1.12, dist: 0.11, fov: 48 };
    if (kind === 'land') return { dir, rad, head: head - 0.8, pitch: 1.1, dist: 0.115, fov: 48 };
    return { dir, rad, head: head + 0.35, pitch: 0.92, dist: 0.3 + 0.3 * theta / Math.PI, fov: 44 };
  }

  private mix(a: Shot, b: Shot, k: number, bump = 0): Shot {
    const dir = slerpDir(a.dir, b.dir, k, new THREE.Vector3());
    const sep = Math.acos(Math.max(-1, Math.min(1, a.dir.dot(b.dir))));
    return {
      dir,
      rad: lerp(a.rad, b.rad, k),
      head: a.head + wrapAng(b.head - a.head) * k,
      pitch: lerp(a.pitch, b.pitch, k),
      dist: Math.exp(lerp(Math.log(a.dist), Math.log(b.dist), k)) * (1 + bump * Math.sin(Math.PI * k) * sep),
      fov: lerp(a.fov, b.fov, k),
    };
  }

  private stepFlight(f: Flight, dt: number): void {
    f.t += dt * f.speed;
    const st = this.flightAt(f);
    const p = f.path;
    const roll = st.ground ? 0 : Math.sin(f.t * 0.9) * 0.07 * smooth(0, 0.15, st.air) * (1 - smooth(0.85, 1, st.air)) + (p.loop ? 0.35 * Math.sin(Math.PI * st.air) : 0);
    const pl = this.posePlane(p, st.s, roll);
    this.planeMesh.visible = true;
    this.shadow.visible = true;
    // the camera
    const take = this.chase(pl.dir, pl.rad, pl.head, 'take', p.theta);
    const cruise = this.chase(pl.dir, pl.rad, pl.head, 'cruise', p.theta);
    const land = this.chase(pl.dir, pl.rad, pl.head, 'land', p.theta);
    let shot = this.mix(take, cruise, smooth(0.03, 0.3, st.air));
    shot = this.mix(shot, land, smooth(0.7, 0.97, st.air));
    const m = smooth(0, 1.7, f.t);
    if (m < 1 && this.from) shot = this.mix(this.from, shot, m, 0.5);
    this.view = shot;
    // the route fills in behind the plane and fades while the camera is down low
    this.routeMat.uniforms.uProg.value = Math.max(0, Math.min(1, st.s));
    this.routeMat.uniforms.uAlpha.value = smooth(0.12, 0.3, st.air) * (1 - smooth(0.72, 0.9, st.air)) * 0.9;
    // time flies: the sun moves on as the hours pass
    this.simHours = this.flightHours * st.air;
    // contrail from both engines while airborne
    this.trailClock -= dt;
    if (!st.ground && pl.alt > 0.004 && this.trailClock <= 0) {
      this.trailClock = 0.03;
      const mx = this.planeMesh.matrix;
      for (const x of [0.21, -0.21]) this.trail.push({ p: new THREE.Vector3(x, 0.07, -0.05).applyMatrix4(mx), age: 0 });
      while (this.trail.length > 140) this.trail.shift();
    }
    if (st.stopped && f.done) {
      const done = f.done;
      f.done = null;
      done();
    }
  }

  private stepTrail(dt: number): void {
    const m = new THREE.Matrix4(), e = new THREE.Vector3(), n = new THREE.Vector3(), up = new THREE.Vector3(), sv = new THREE.Vector3();
    const k = this.planeScale(1);
    let i = 0;
    for (const p of this.trail) {
      p.age += dt;
      const life = p.age / 1.8;
      if (life >= 1) continue;
      up.copy(p.p).normalize();
      GL.tangents(up, e, n);
      const s = k * (0.07 + 0.16 * Math.sqrt(life));
      m.makeBasis(e, up, n.negate()).scale(sv.set(s, s, s)).setPosition(p.p);
      this.puffs.setMatrixAt(i, m);
      this.puffFade.setX(i, (1 - life) * (1 - life) * Math.min(1, p.age * 10) * 0.8);
      i++;
    }
    this.trail = this.trail.filter((p) => p.age < 1.8);
    for (let j = i; j < 140; j++) this.puffFade.setX(j, 0);
    this.puffs.count = Math.max(1, i);
    this.puffs.instanceMatrix.needsUpdate = true;
    this.puffFade.needsUpdate = true;
  }

  // ------------------------------------------------------------------ camera
  private resize(): void {
    const vw = this.el.clientWidth, vh = this.el.clientHeight;
    if (!vw || !vh) return;
    this.vw = vw; this.vh = vh;
    this.dpr = Math.min(coarse() ? 1.75 : 2, window.devicePixelRatio || 1);
    this.gl.setPixelRatio(this.dpr);
    this.gl.setSize(vw, vh, false);
    this.u.uRes.value.set(vw / 2, vh / 2);
    if (this.stars) (this.stars.material as THREE.ShaderMaterial).uniforms.uDpr.value = this.dpr;
  }

  private get focusPoint(): [number, number] {
    const i = this.insets;
    return [(i.left + this.vw - i.right) / 2, (i.top + this.vh - i.bottom) / 2];
  }

  /** Camera distance that makes the globe fill the free part of the screen. */
  private fitDist(): number {
    const i = this.insets;
    const fw = Math.max(200, this.vw - i.left - i.right), fh = Math.max(200, this.vh - i.top - i.bottom);
    const rs = 0.46 * Math.min(fw, fh * 1.06) * this.zoom;
    const T = (rs / (this.vh / 2)) * Math.tan((MAP_FOV / 2) * (Math.PI / 180));
    return Math.max(0.3, GL.R / Math.sin(Math.atan(T)) - GL.R);
  }

  private mapShot(): Shot {
    return { dir: this.view.dir, rad: GL.R, head: 0, pitch: MAP_PITCH, dist: this.fitDist() * (1 + this.intro * 0.5), fov: MAP_FOV };
  }

  private applyCamera(s: Shot): void {
    const e = new THREE.Vector3(), n = new THREE.Vector3();
    GL.tangents(s.dir, e, n);
    const fwd = n.multiplyScalar(Math.cos(s.head)).addScaledVector(e, Math.sin(s.head));
    const look = s.dir.clone().multiplyScalar(s.rad);
    const cam = this.camera;
    cam.position.copy(look).addScaledVector(s.dir, s.dist * Math.cos(s.pitch)).addScaledVector(fwd, -s.dist * Math.sin(s.pitch));
    const floor = (this.land ? GL.groundAt(this.land, GL.toLatLon(cam.position.clone().normalize())) : GL.R) + 0.006;
    if (cam.position.length() < floor) cam.position.setLength(floor);
    cam.up.copy(s.dir).multiplyScalar(Math.sin(s.pitch)).addScaledVector(fwd, Math.cos(s.pitch));
    cam.lookAt(look);
    const alt = cam.position.length() - GL.R;
    cam.near = Math.max(0.0015, Math.min(0.5, alt * 0.2));
    cam.far = 90;
    cam.fov = s.fov;
    cam.aspect = this.vw / this.vh;
    cam.setViewOffset(this.vw, this.vh, this.vw / 2 - this.off.x, this.vh / 2 - this.off.y, this.vw, this.vh);
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    this.u.uCam.value.copy(cam.position);
  }

  // ------------------------------------------------------------------ input
  private down(e: PointerEvent): void {
    if (this.busy) return;
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this.spin = { lon: 0, lat: 0 };
    if (this.pointers.size === 2) this.pinch = this.pinchDist();
  }

  private pinchDist(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private move(e: PointerEvent): void {
    const p = this.pointers.get(e.pointerId);
    if (!p || this.busy) return;
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    p.x = e.clientX; p.y = e.clientY;
    if (this.pointers.size >= 2) {
      const d = this.pinchDist();
      if (this.pinch > 0) this.zoom = Math.max(0.7, Math.min(3.4, this.zoom * (d / this.pinch)));
      this.pinch = d;
      return;
    }
    // degrees per pixel at the focus point
    const k = ((2 * this.view.dist * Math.tan((this.view.fov / 2) * Math.PI / 180)) / this.vh) * (180 / Math.PI);
    this.turn(-dx * k, dy * k);
    this.spin = { lon: -dx * k * 60, lat: dy * k * 60 };
    if (Math.abs(dx) + Math.abs(dy) > 3) { this.panned = true; this.target = null; this.intro = 0; }
  }

  private up(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = 0;
  }

  private turn(dLon: number, dLat: number): void {
    const ll = GL.toLatLon(this.view.dir);
    const lat = Math.max(-62, Math.min(74, ll.lat + dLat));
    GL.toDir(lat, ll.lon + dLon / Math.max(0.3, Math.cos(lat * Math.PI / 180)), this.view.dir);
  }

  // ------------------------------------------------------------------ frame
  private frame(now: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    if (!this.vw || this.vw < 2) return;
    if (!this.built) this.build();
    this.clock += dt;
    this.frameNo++;
    // a boarding pass blurs the map behind it: no need to redraw it at full rate
    const behind = !this.busy && !!this.el.parentElement?.querySelector('.bp-wrap');
    if (behind && this.frameNo % 3) return;
    const step = behind ? dt * 3 : dt;
    this.u.uTime.value = this.clock;
    (this.stars.material as THREE.ShaderMaterial).uniforms.uTime.value = this.clock;
    GL.sunDir(Date.now() + this.simHours * 3600e3, this.u.uSun.value);
    this.clouds.rotation.y += step * 0.0015;

    if (this.dive) {
      const dv = this.dive;
      dv.t += step * 1000;
      const k = Math.min(1, dv.t / dv.ms), ease = k * k * (3 - 2 * k);
      const to: Shot = { dir: dv.from.dir, rad: GL.GROUND_R, head: dv.from.head + 0.6, pitch: 0.05, dist: 0.012, fov: 58 };
      this.view = this.mix(dv.from, to, ease);
      if (k >= 1) { this.dive = null; dv.done(); }
    } else if (this.flight) {
      this.stepFlight(this.flight, step);
    } else {
      // map mode: glide to the target, or coast after a fling
      if (this.target) {
        const k = 1 - Math.exp(-step * (this.intro > 0 ? 2.6 : 4.2));
        slerpDir(this.view.dir, this.target, k, this.view.dir);
        if (this.view.dir.dot(this.target) > 0.999999) this.target = null;
      } else if (Math.abs(this.spin.lon) + Math.abs(this.spin.lat) > 0.01 && !this.pointers.size) {
        this.turn(this.spin.lon * step, this.spin.lat * step);
        const f = Math.exp(-step * 4);
        this.spin.lon *= f; this.spin.lat *= f;
      }
      this.intro = Math.max(0, this.intro - step * 0.9);
      const want = this.mapShot();
      // ease the camera back into map framing (after a flight is cancelled, or on resize)
      const v = this.view;
      v.rad = lerp(v.rad, want.rad, 0.2);
      v.head = v.head + wrapAng(want.head - v.head) * 0.2;
      v.pitch = lerp(v.pitch, want.pitch, 0.2);
      v.dist = Math.exp(lerp(Math.log(v.dist), Math.log(want.dist), 1 - Math.exp(-step * 6)));
      v.fov = lerp(v.fov, want.fov, 0.2);
      if (this.routeMesh) this.routeMat.uniforms.uAlpha.value = Math.min(1, this.routeMat.uniforms.uAlpha.value + step * 3);
    }
    this.stepTrail(step);
    const [fx, fy] = this.busy ? [this.vw / 2, this.vh / 2] : this.focusPoint;
    const ko = Number.isFinite(this.off.x) ? 1 - Math.exp(-step * 5) : 1;
    this.off.x = lerp(this.off.x || fx, fx, ko);
    this.off.y = lerp(this.off.y || fy, fy, ko);
    this.applyCamera(this.view);
    this.gl.render(this.scene, this.camera);
    this.placePins();
  }

  private placePins(): void {
    const cam = this.camera.position, v = new THREE.Vector3(), to = new THREE.Vector3();
    for (const p of this.pins) {
      to.subVectors(cam, p.pos).normalize();
      const facing = p.dir.dot(to);
      const a = this.busy ? 0 : smooth(0.0, 0.18, facing);
      v.copy(p.pos).project(this.camera);
      const x = (v.x + 1) / 2 * this.vw, y = (1 - v.y) / 2 * this.vh;
      const off = a <= 0.01 || v.z > 1 || x < -80 || x > this.vw + 80 || y < -80 || y > this.vh + 80;
      p.el.style.visibility = off ? 'hidden' : '';
      if (off) continue;
      p.el.style.opacity = a < 1 ? a.toFixed(2) : '';
      p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
  }
}
