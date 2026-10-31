import * as THREE from 'three';
import type { Nav } from './nav';

const PITCH = THREE.MathUtils.degToRad(36);
/** How far photo mode may tilt the iso camera (radians above the ground). */
const PHOTO_PITCH: [number, number] = [THREE.MathUtils.degToRad(22), THREE.MathUtils.degToRad(68)];
/** Eye height above the player's feet in first person (m). */
const EYE_H = 1.4;
const MAX_PITCH = 1.3;

const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * Isometric orthographic camera with smooth follow, 90 degree snap rotation and zoom, plus an
 * eye-level first-person mode that drives the renderer's perspective camera.
 */
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
  /** First-person mode: look direction (yaw matches actor facing, atan2(x, z)) and pitch. */
  fp = false;
  fpYaw = 0;
  /** Set when the player looks around by hand; while it holds, auto-walking leaves the view alone. */
  lookedByHand = false;
  fpPitch = 0;
  /** Player ground speed, for a gentle head bob. */
  fpSpeed = 0;
  private fpTurn = 0;
  /** Eases the first-person eye back and up a little (metres), e.g. to see your own hands while eating. */
  fpBack = 0;
  private fpBackCur = 0;
  private bobT = 0;
  /** Iso view angle above the ground; photo mode tilts it, otherwise it stays at the classic 36 degrees. */
  pitch = PITCH;
  private pitchCur = PITCH;
  /** Photo mode: the iso view's offset from the player (metres, on the ground). */
  readonly pan = new THREE.Vector3();
  private panCur = new THREE.Vector3();

  constructor(readonly cam: THREE.OrthographicCamera, readonly persp: THREE.PerspectiveCamera) {}

  /** The camera currently in use. */
  get view(): THREE.OrthographicCamera | THREE.PerspectiveCamera {
    return this.fp ? this.persp : this.cam;
  }

  /** Switch views. Entering looks the way the player faces; leaving picks the iso angle closest to the look direction. */
  setFirstPerson(on: boolean, facing: number): void {
    if (on === this.fp) return;
    this.fp = on;
    this.fpTurn = 0;
    if (on) {
      this.fpYaw = facing;
      this.fpPitch = -0.12;
    } else {
      this.yaw = Math.round((this.fpYaw + Math.PI - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
      this.yawCur = this.yaw;
    }
  }

  /** Mouse or drag look, in radians. */
  look(dYaw: number, dPitch: number): void {
    this.fpYaw = wrapAngle(this.fpYaw - dYaw);
    if (dYaw || dPitch) this.lookedByHand = true;
    this.fpPitch = THREE.MathUtils.clamp(this.fpPitch - dPitch, -MAX_PITCH, MAX_PITCH);
  }

  /** Ease the first-person view toward a heading (used while auto-walking a path). */
  turnToward(yaw: number, dt: number): void {
    this.fpYaw = wrapAngle(this.fpYaw + wrapAngle(yaw - this.fpYaw) * (1 - Math.exp(-dt * 3.5)));
  }

  snap(): void {
    this.cur.copy(this.target);
    this.yawCur = this.yaw;
    this.zoomCur = this.zoom;
    this.pitchCur = this.pitch;
    this.panCur.copy(this.pan);
  }

  rotate(dir: number): void {
    if (this.fp) { this.fpTurn -= (dir * Math.PI) / 4; this.lookedByHand = true; }
    else this.yaw += (dir * Math.PI) / 2;
  }

  /** Photo mode: turn the iso view freely (radians) and tilt it. */
  orbitBy(dYaw: number, dPitch: number): void {
    this.yaw += dYaw;
    this.pitch = THREE.MathUtils.clamp(this.pitch + dPitch, PHOTO_PITCH[0], PHOTO_PITCH[1]);
  }

  /** Back to the regular iso view: the classic tilt, no offset, and the nearest of the four diagonal angles. */
  settle(): void {
    this.pitch = PITCH;
    this.pan.set(0, 0, 0);
    this.yaw = Math.round((this.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
  }

  zoomBy(f: number): void {
    if (this.fp) return;
    this.zoom = THREE.MathUtils.clamp(this.zoom * f, this.minZoom, this.maxZoom);
  }

  /** Slow orbit used on the title screen. */
  setOrbit(speed: number): void {
    this.orbit = speed;
  }

  /** pxH: height of the render target in pixels, used to snap the view to whole pixels (kills crawling edges). */
  update(dt: number, aspect: number, pxH = 0): void {
    if (this.fp) { this.updateFirstPerson(dt); return; }
    if (this.orbit) this.yaw += this.orbit * dt;
    const k = 1 - Math.exp(-dt * 6);
    this.panCur.lerp(this.pan, 1 - Math.exp(-dt * 10));
    const t = this.target.clone().add(this.panCur);
    if (this.bounds) {
      t.x = THREE.MathUtils.clamp(t.x, this.bounds[0], this.bounds[2]);
      t.z = THREE.MathUtils.clamp(t.z, this.bounds[1], this.bounds[3]);
    }
    this.cur.lerp(t, k);
    this.yawCur += (this.yaw - this.yawCur) * (1 - Math.exp(-dt * 7));
    this.zoomCur += (this.zoom - this.zoomCur) * (1 - Math.exp(-dt * 8));
    this.pitchCur += (this.pitch - this.pitchCur) * (1 - Math.exp(-dt * 8));
    const h = this.zoomCur;
    const w = h * aspect;
    const c = this.cam;
    c.left = -w / 2; c.right = w / 2; c.top = h / 2; c.bottom = -h / 2;
    c.updateProjectionMatrix();
    const cp = Math.cos(this.pitchCur);
    const dir = new THREE.Vector3(Math.sin(this.yawCur) * cp, Math.sin(this.pitchCur), Math.cos(this.yawCur) * cp);
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

  private updateFirstPerson(dt: number): void {
    if (this.fpTurn) {
      const step = Math.abs(this.fpTurn) < 0.002 ? this.fpTurn : this.fpTurn * (1 - Math.exp(-dt * 12));
      this.fpYaw = wrapAngle(this.fpYaw + step);
      this.fpTurn -= step;
    }
    const c = this.persp;
    const moving = Math.min(1, this.fpSpeed / 3.2);
    this.bobT += dt * (5 + this.fpSpeed * 2.2) * (moving > 0.05 ? 1 : 0);
    const bob = Math.sin(this.bobT * 2) * 0.022 * moving;
    this.fpBackCur += (this.fpBack - this.fpBackCur) * (1 - Math.exp(-dt * 4));
    c.position.set(this.target.x - Math.sin(this.fpYaw) * this.fpBackCur, this.target.y + EYE_H + bob + this.fpBackCur * 0.5, this.target.z - Math.cos(this.fpYaw) * this.fpBackCur);
    if (this.shake > 0) {
      c.position.x += (Math.random() - 0.5) * this.shake * 0.3;
      c.position.y += (Math.random() - 0.5) * this.shake * 0.3;
      this.shake = Math.max(0, this.shake - dt * 0.5);
    }
    const cp = Math.cos(this.fpPitch);
    this.fwd.set(Math.sin(this.fpYaw) * cp, Math.sin(this.fpPitch), Math.cos(this.fpYaw) * cp);
    c.lookAt(c.position.x + this.fwd.x, c.position.y + this.fwd.y, c.position.z + this.fwd.z);
    c.updateMatrixWorld();
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
  /** `top` is the highest floor worth looking for (metres): the street's 12 m, or a room upstairs. */
  /** `bottom` is the lowest (a hillside town looks for ground well above and below the traveller). */
  pick(px: number, py: number, nav: Nav, extraHeights?: (x: number, z: number) => number | null, top = 12, bottom = -3): THREE.Vector3 | null {
    const ndc = new THREE.Vector3((px / window.innerWidth) * 2 - 1, -(py / window.innerHeight) * 2 + 1, -1);
    if (this.fp) return this.pickFirstPerson(ndc, nav, extraHeights);
    const origin = ndc.clone().unproject(this.cam);
    const dir = this.fwd.clone();
    // start where the ray is `top` metres above the street, march down to -3 m
    const t0 = (origin.y - top) / -dir.y;
    const p = origin.clone().addScaledVector(dir, Math.max(0, t0));
    const step = 0.08;
    const steps = Math.min(4000, Math.max(600, Math.ceil((top - bottom) / Math.max(0.05, -dir.y) / step)));
    for (let i = 0; i < steps; i++) {
      const floor = extraHeights?.(p.x, p.z) ?? (nav.walkable(p.x, p.z) ? nav.heightAt(p.x, p.z) : null);
      if (floor !== null && p.y <= floor + 0.02) return new THREE.Vector3(p.x, floor, p.z);
      if (p.y < bottom) break;
      p.addScaledVector(dir, step);
    }
    // fall back to the street plane (on a hillside: the level you stand on)
    const tp = (origin.y - (bottom <= -3 ? 0 : (top + bottom) / 2)) / -dir.y;
    return origin.clone().addScaledVector(dir, tp);
  }

  /** Eye ray march: stops at the first walkable floor, gives up at walls and anything that isn't floor. */
  private pickFirstPerson(ndc: THREE.Vector3, nav: Nav, extraHeights?: (x: number, z: number) => number | null): THREE.Vector3 | null {
    const origin = this.persp.position.clone();
    const dir = ndc.setZ(0.5).unproject(this.persp).sub(origin).normalize();
    if (dir.y > -0.03) return null;
    const p = origin.clone();
    const step = 0.08;
    for (let i = 0; i < 500; i++) {
      p.addScaledVector(dir, step);
      const floor = extraHeights?.(p.x, p.z) ?? (nav.walkable(p.x, p.z) ? nav.heightAt(p.x, p.z) : null);
      if (floor !== null) {
        if (p.y <= floor + 0.02) return new THREE.Vector3(p.x, floor, p.z);
      } else if (p.y < origin.y - 0.6) return null;
    }
    return null;
  }

  project(v: THREE.Vector3, out: THREE.Vector2): boolean {
    const p = v.clone().project(this.view);
    out.set((p.x * 0.5 + 0.5) * window.innerWidth, (-p.y * 0.5 + 0.5) * window.innerHeight);
    return p.z > -1 && p.z < 1;
  }
}
