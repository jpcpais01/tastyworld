import * as THREE from 'three';
import type { Renderer } from './renderer';

/** Time-of-day keyframes. Every lighting parameter is interpolated from these. */
interface Key {
  h: number;
  sun: number; sunCol: number;
  sky: number; ground: number; ambient: number;
  skyTop: number; skyHorizon: number;
  fog: number;
  lamp: number; night: number;
  exposure: number; bloom: number;
  scatter: number; deep: number;
  gradeS: number; gradeH: number;
  cloud: number;
  particle: number;
}

const K: Key[] = [
  { h: 0, sun: 0.16, sunCol: 0x7d9cff, sky: 0x2b3f78, ground: 0x1a1830, ambient: 0.75, skyTop: 0x0b1030, skyHorizon: 0x2a2858, fog: 0x1d2142, lamp: 1, night: 1, exposure: 1.25, bloom: 0.9, scatter: 0x0a2a3a, deep: 0x020812, gradeS: 0xb8c4ff, gradeH: 0xffe6c8, cloud: 0, particle: 0x8090c0 },
  { h: 4.5, sun: 0.16, sunCol: 0x7d9cff, sky: 0x2b3f78, ground: 0x1a1830, ambient: 0.75, skyTop: 0x0b1030, skyHorizon: 0x2a2858, fog: 0x1d2142, lamp: 1, night: 1, exposure: 1.25, bloom: 0.9, scatter: 0x0a2a3a, deep: 0x020812, gradeS: 0xb8c4ff, gradeH: 0xffe6c8, cloud: 0, particle: 0x8090c0 },
  { h: 6, sun: 0.75, sunCol: 0xff9a6a, sky: 0x8a8ec8, ground: 0x4a3a40, ambient: 0.8, skyTop: 0x6a78c0, skyHorizon: 0xf3b0a0, fog: 0xcaa6b4, lamp: 0.35, night: 0.3, exposure: 1.1, bloom: 0.7, scatter: 0x2a4a5a, deep: 0x0a1420, gradeS: 0xd8c8ff, gradeH: 0xfff0e0, cloud: 0.1, particle: 0xd8c0c8 },
  { h: 8, sun: 1.25, sunCol: 0xfff0d8, sky: 0x9fc0ec, ground: 0x6a5a4c, ambient: 0.85, skyTop: 0x76a8e8, skyHorizon: 0xd8e8f4, fog: 0xc8d8e8, lamp: 0, night: 0, exposure: 1.0, bloom: 0.5, scatter: 0x1f6f72, deep: 0x06262c, gradeS: 0xf0f4ff, gradeH: 0xfff8ec, cloud: 0.28, particle: 0xffffff },
  { h: 14.5, sun: 1.3, sunCol: 0xfff3e0, sky: 0xa6c6ee, ground: 0x6e5e50, ambient: 0.85, skyTop: 0x6ea4e8, skyHorizon: 0xdcecf6, fog: 0xcadaea, lamp: 0, night: 0, exposure: 1.0, bloom: 0.5, scatter: 0x1f6f72, deep: 0x06262c, gradeS: 0xf0f4ff, gradeH: 0xfff8ec, cloud: 0.3, particle: 0xffffff },
  { h: 17, sun: 1.15, sunCol: 0xffc68a, sky: 0xb0b6d8, ground: 0x6e5040, ambient: 0.8, skyTop: 0x7a90d0, skyHorizon: 0xffd2a0, fog: 0xe8c8b0, lamp: 0.15, night: 0.1, exposure: 1.02, bloom: 0.6, scatter: 0x2e6260, deep: 0x082028, gradeS: 0xe0d8ff, gradeH: 0xffe8cc, cloud: 0.2, particle: 0xffe8d0 },
  { h: 18.3, sun: 0.65, sunCol: 0xff7a48, sky: 0x9a80b8, ground: 0x4a3038, ambient: 0.78, skyTop: 0x4a4c9a, skyHorizon: 0xff9a78, fog: 0xc88a98, lamp: 0.75, night: 0.6, exposure: 1.1, bloom: 0.85, scatter: 0x2a3a58, deep: 0x0a1020, gradeS: 0xc8b8ff, gradeH: 0xffd8b8, cloud: 0.1, particle: 0xffc8b8 },
  { h: 19.6, sun: 0.22, sunCol: 0x8a8cff, sky: 0x40508e, ground: 0x221e38, ambient: 0.78, skyTop: 0x141a48, skyHorizon: 0x4a3a7a, fog: 0x2a2a56, lamp: 1, night: 1, exposure: 1.22, bloom: 0.95, scatter: 0x0e2a40, deep: 0x030a16, gradeS: 0xb8c0ff, gradeH: 0xffe2c4, cloud: 0, particle: 0x9098c8 },
  { h: 24, sun: 0.16, sunCol: 0x7d9cff, sky: 0x2b3f78, ground: 0x1a1830, ambient: 0.75, skyTop: 0x0b1030, skyHorizon: 0x2a2858, fog: 0x1d2142, lamp: 1, night: 1, exposure: 1.25, bloom: 0.9, scatter: 0x0a2a3a, deep: 0x020812, gradeS: 0xb8c4ff, gradeH: 0xffe6c8, cloud: 0, particle: 0x8090c0 },
];

const ca = new THREE.Color(), cb = new THREE.Color();
function lerpCol(out: THREE.Color, a: number, b: number, t: number, mul = 1) {
  ca.setHex(a).convertSRGBToLinear();
  cb.setHex(b).convertSRGBToLinear();
  out.copy(ca).lerp(cb, t).multiplyScalar(mul);
}

/** Grading tints: normalised so the brightest channel is 1, then softened towards white. */
function grade(out: THREE.Color, a: number, b: number, t: number) {
  ca.setHex(a);
  cb.setHex(b);
  out.copy(ca).lerp(cb, t);
  const m = Math.max(out.r, out.g, out.b, 1e-3);
  out.multiplyScalar(1 / m);
  out.lerp(new THREE.Color(1, 1, 1), 0.45);
}

export class TimeOfDay {
  hour = 16.6;
  /** Real seconds for a full day. */
  dayLength = 720;
  frozen = false;
  particleLight = new THREE.Color(1, 1, 1);
  night = 0;

  update(dt: number): void {
    if (!this.frozen) this.hour = (this.hour + (dt / this.dayLength) * 24) % 24;
  }

  label(): string {
    const h = Math.floor(this.hour), m = Math.floor((this.hour - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }

  get isNight(): boolean {
    return this.hour >= 19 || this.hour < 5.5;
  }

  apply(r: Renderer): void {
    let i = 0;
    while (i < K.length - 2 && K[i + 1].h <= this.hour) i++;
    const a = K[i], b = K[i + 1];
    let t = (this.hour - a.h) / Math.max(1e-4, b.h - a.h);
    t = t * t * (3 - 2 * t);
    const s = r.shared, u = r.composite.uniforms;
    const mix = (x: number, y: number) => x + (y - x) * t;
    lerpCol(s.uSunColor.value, a.sunCol, b.sunCol, t, mix(a.sun, b.sun));
    lerpCol(s.uSkyColor.value, a.sky, b.sky, t, mix(a.ambient, b.ambient));
    lerpCol(s.uGroundColor.value, a.ground, b.ground, t, mix(a.ambient, b.ambient));
    lerpCol(s.uFogColor.value, a.fog, b.fog, t);
    lerpCol(u.uSkyTop.value, a.skyTop, b.skyTop, t);
    lerpCol(u.uSkyHorizon.value, a.skyHorizon, b.skyHorizon, t);
    lerpCol(u.uWaterScatter.value, a.scatter, b.scatter, t);
    lerpCol(u.uWaterDeep.value, a.deep, b.deep, t);
    grade(u.uGradeShadow.value, a.gradeS, b.gradeS, t);
    grade(u.uGradeHigh.value, a.gradeH, b.gradeH, t);
    lerpCol(this.particleLight, a.particle, b.particle, t);
    s.uLamp.value = mix(a.lamp, b.lamp);
    s.uNight.value = mix(a.night, b.night);
    this.night = s.uNight.value;
    s.uCloud.value = mix(a.cloud, b.cloud);
    u.uExposure.value = mix(a.exposure, b.exposure);
    u.uBloom.value = mix(a.bloom, b.bloom);
  }
}
