import * as THREE from 'three';
import type { Nav } from './nav';

const PITCH = THREE.MathUtils.degToRad(36);

/** Isometric orthographic camera with smooth follow, 90 degree snap rotation and zoom. */
export class IsoCamera {
  target = new THREE.Vector3();
  private cur = new THREE.Vector3();
  yaw = Math.PI / 4;
  private yawCur = Math.PI / 4;
  zoom = 18;
  private zoomCur = 18;
  minZoom = 9;
  maxZoom = 34;
  bounds: [number, number, number, number] | null = [2, 3, 70, 54];
  shake = 0;
  readonly fwd = new THREE.Vector3();
  readonly right = new THREE.Vector3();
  readonly up = new THREE.Vector3();
  private orbit = 0;

  constructor(readonly cam: THREE.OrthographicCamera) {}

  snap(): void {
    this.cur.copy(this.target);
    this.yawCur = this.yaw;
    this.zoomCur = this.zoom;
  }

  rotate(dir: number): void {
    this.yaw += (dir * Math.PI) / 2;
  }

  zoomBy(f: number): void {
    this.zoom = THREE.MathUtils.clamp(this.zoom * f, this.minZoom, this.maxZoom);
  }

  /** Slow orbit used on the title screen. */
  setOrbit(speed: number): void {
    this.orbit = speed;
  }

  /** pxH: height of the render target in pixels, used to snap the view to whole pixels (kills crawling edges). */
  update(dt: number, aspect: number, pxH = 0): void {
    if (this.orbit) this.yaw += this.orbit * dt;
    const k = 1 - Math.exp(-dt * 6);
    const t = this.target.clone();
    if (this.bounds) {
      t.x = THREE.MathUtils.clamp(t.x, this.bounds[0], this.bounds[2]);
      t.z = THREE.MathUtils.clamp(t.z, this.bounds[1], this.bounds[3]);
    }
    this.cur.lerp(t, k);
    this.yawCur += (this.yaw - this.yawCur) * (1 - Math.exp(-dt * 7));
    this.zoomCur += (this.zoom - this.zoomCur) * (1 - Math.exp(-dt * 8));
    const h = this.zoomCur;
    const w = h * aspect;
    const c = this.cam;
    c.left = -w / 2; c.right = w / 2; c.top = h / 2; c.bottom = -h / 2;
    c.updateProjectionMatrix();
    const dir = new THREE.Vector3(Math.sin(this.yawCur) * Math.cos(PITCH), Math.sin(PITCH), Math.cos(this.yawCur) * Math.cos(PITCH));
    const focus = this.cur.clone();
    if (this.shake > 0) {
      focus.x += (Math.random() - 0.5) * this.shake;
      focus.z += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.5);
    } else if (pxH > 0) {
      // move the view in whole render pixels so static voxels never shimmer while the camera glides
      const texel = h / pxH;
      const rx = new THREE.Vector3(0, 1, 0).cross(dir).normalize();
      const uy = dir.clone().cross(rx);
      const r = focus.dot(rx), u = focus.dot(uy);
      focus.addScaledVector(rx, Math.round(r / texel) * texel - r).addScaledVector(uy, Math.round(u / texel) * texel - u);
    }
    c.position.copy(focus).addScaledVector(dir, 120);
    c.lookAt(focus);
    c.updateMatrixWorld();
    this.fwd.copy(dir).negate();
    this.right.setFromMatrixColumn(c.matrixWorld, 0);
    this.up.setFromMatrixColumn(c.matrixWorld, 1);
  }

  /** Camera-relative ground directions for keyboard movement. */
  groundAxes(): { fwd: THREE.Vector2; right: THREE.Vector2 } {
    const f = new THREE.Vector2(this.fwd.x, this.fwd.z).normalize();
    const r = new THREE.Vector2(this.right.x, this.right.z).normalize();
    return { fwd: f, right: r };
  }

  /** Screen pixel -> point on the walkable surface (marches the view ray over the heightfield). */
  pick(px: number, py: number, nav: Nav, extraHeights?: (x: number, z: number) => number | null): THREE.Vector3 | null {
    const ndc = new THREE.Vector3((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1, -1);
    const origin = ndc.clone().unproject(this.cam);
    const dir = this.fwd.clone();
    // start where the ray is 12 m above the street, march down to -3 m
    const t0 = (origin.y - 12) / -dir.y;
    const p = origin.clone().addScaledVector(dir, Math.max(0, t0));
    const step = 0.08;
    for (let i = 0; i < 600; i++) {
      const floor = extraHeights?.(p.x, p.z) ?? (nav.walkable(p.x, p.z) ? nav.heightAt(p.x, p.z) : null);
      if (floor !== null && p.y <= floor + 0.02) return new THREE.Vector3(p.x, floor, p.z);
      if (p.y < -3) break;
      p.addScaledVector(dir, step);
    }
    // fall back to the street plane
    const tp = (origin.y - 0) / -dir.y;
    return origin.clone().addScaledVector(dir, tp);
  }

  project(v: THREE.Vector3, out: THREE.Vector2): boolean {
    const p = v.clone().project(this.cam);
    out.set((p.x * 0.5 + 0.5) * window.innerWidth, (-p.y * 0.5 + 0.5) * window.innerHeight);
    return p.z > -1 && p.z < 1;
  }
}
