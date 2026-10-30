// Checks the procedural walk cycle keeps a foot on the ground and planted feet from skating.
import * as THREE from 'three';
import { Actor } from '../src/game/actors';
import { buildPerson, randomLook, PART } from '../src/world/characters';
import { makeSharedUniforms } from '../src/engine/renderer';

const PARENT = [-1, 0, 0, 0, 7, 7, -1, -1, 4, 5, 2, 3];
const model = buildPerson(randomLook(3));
const a = new Actor(model, makeSharedUniforms() as any);
const rot = (a as any).rot as THREE.Vector3[];
const off = (a as any).uOffset.value as THREE.Vector3;
const piv = model.pivots.map((p) => new THREE.Vector3(...p));
const m3 = (x: number, y: number, z: number) => {
  const ry = new THREE.Matrix3().set(Math.cos(y), 0, Math.sin(y), 0, 1, 0, -Math.sin(y), 0, Math.cos(y));
  const rx = new THREE.Matrix3().set(1, 0, 0, 0, Math.cos(x), -Math.sin(x), 0, Math.sin(x), Math.cos(x));
  const rz = new THREE.Matrix3().set(Math.cos(z), -Math.sin(z), 0, Math.sin(z), Math.cos(z), 0, 0, 0, 1);
  return ry.multiply(rx).multiply(rz);
};
const xform = (part: number, p0: THREE.Vector3) => {
  const p = p0.clone();
  for (let j = part; j >= 0; j = PARENT[j]) { const r = rot[j]; p.sub(piv[j]).applyMatrix3(m3(r.x, r.y, r.z)).add(piv[j]); }
  return p.add(off);
};
const s = model.scale, oz = model.origin[2];
const soleL = new THREE.Vector3(model.origin[0] + 3.5 * s, 0, oz + 4 * s);
const soleR = new THREE.Vector3(model.origin[0] + 6.5 * s, 0, oz + 4 * s);
const hand = new THREE.Vector3(model.origin[0] + 9 * s, 8 * s, oz + 4 * s);
let bad = 0;
const mouth = new THREE.Vector3(0, 16 * s, oz + 7 * s);
for (const [anim, v] of [['walk', 1.1], ['walk', 3.2], ['run', 4.8]] as const) {
  a.anim = anim; a.speed = v;
  for (let i = 0; i < 120; i++) a.update(1 / 60); // settle
  let minLow = 1, maxLow = -1, slip = 0, n = 0, prevL: THREE.Vector3 | null = null, prevR: THREE.Vector3 | null = null;
  const dt = 1 / 120;
  for (let i = 0; i < 240; i++) {
    a.update(dt);
    const L = xform(PART.shinL, soleL), R = xform(PART.shinR, soleR);
    const low = Math.min(L.y, R.y);
    minLow = Math.min(minLow, low); maxLow = Math.max(maxLow, low);
    // planted foot: the lower one should move backwards at the body's speed (world foot ~ still)
    if (prevL && prevR) {
      const st = L.y < R.y ? [L, prevL] : [R, prevR];
      if (st[0].y < 0.02) { slip += Math.abs((st[0].z - st[1].z) / dt + v); n++; }
    }
    prevL = L; prevR = R;
  }
  if (anim === 'walk' && (minLow < -0.01 || maxLow > 0.01 || slip / Math.max(1, n) > (v < 2 ? 0.4 : 1.8))) bad++;
  console.log(anim, v, 'lowest foot y range', minLow.toFixed(3), maxLow.toFixed(3), 'planted-foot slip m/s', (slip / Math.max(1, n)).toFixed(2), 'contact frames', n);
}
a.anim = 'eat'; a.speed = 0;
for (let i = 0; i < 300; i++) a.update(1 / 60);
let best = 9;
for (let i = 0; i < 300; i++) { a.update(1 / 60); best = Math.min(best, xform(PART.foreR, hand).distanceTo(mouth)); }
console.log('eat: closest hand-to-mouth', best.toFixed(3));
a.anim = 'sit';
for (let i = 0; i < 120; i++) a.update(1 / 60);
console.log('sit: knee', xform(PART.legL, new THREE.Vector3(model.origin[0] + 3.5 * s, 4 * s, oz + 4 * s)).toArray().map((v) => v.toFixed(2)), 'sole', xform(PART.shinL, soleL).toArray().map((v) => v.toFixed(2)));
a.anim = 'wave';
for (let i = 0; i < 120; i++) a.update(1 / 60);
console.log('wave: hand', xform(PART.foreR, hand).toArray().map((v) => v.toFixed(2)));
a.anim = 'idle';
for (let i = 0; i < 2000; i++) { a.update(1 / 60); const L = xform(PART.shinL, soleL), R = xform(PART.shinR, soleR); if (Math.min(L.y, R.y) > 0.03 || Math.min(L.y, R.y) < -0.03) { bad++; console.log('idle foot off ground', i, L.y.toFixed(3), R.y.toFixed(3)); break; } }
console.log(bad ? 'GAIT PROBLEMS' : 'gait OK');
if (bad) process.exit(1);
