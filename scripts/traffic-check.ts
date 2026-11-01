// Runs Tokyo's traffic with the street crowd for a few game hours against the baked world and checks that cars
// keep to the carriageway, never run into each other or anyone on foot, never wait for ever, and that the crowd
// keeps to the pavements and crosses at the crosswalks (npx tsx scripts/traffic-check.ts).
import { bakeWorld } from '../src/world/bake';
import { Nav } from '../src/game/nav';
import { Crowd } from '../src/game/crowd';
import { Traffic } from '../src/game/traffic';
import { offFoot, onCarriageway, crosswalkAt, roadY, NEON, HIKARI } from '../src/world/roads';
import { V } from '../src/world/layout';
import * as THREE from 'three';

const w = bakeWorld(() => {});
const nav = new Nav(w.nav);
nav.keepOff(offFoot);
const a = w.anchors;
const fake = () => {
  const root = new THREE.Group();
  return { root, get position() { return root.position; }, anim: 'idle', speed: 0, hold: 'none', targetFacing: 0, facing: 0, headYawTarget: 0, animT: 0, built: false, release() {}, pedals: true, dog: false, noBlob: false, isCat: false } as any;
};
const crowd = new Crowd(nav, a, { bubble: () => {}, serve: () => {}, quiet: () => false }, { person: fake, dog: fake, vehicle: fake, boat: fake });
const asked: (() => void)[] = [];
crowd.router = { find: (ax, az, bx, bz, done) => asked.length < 6 && asked.push(() => done(nav.findPath(ax, az, bx, bz))) > 0 };
crowd.populate({ walkers: 300, joggers: 6, dogs: 8, cyclists: 10, couriers: 6, boats: 2, exercise: 0 });
const traffic = new Traffic(null, null, false);
crowd.traffic = traffic;
let hour = 7.5;
crowd.settle(hour);
traffic.populate(hour);
console.log('routes', traffic.routeNames.length, traffic.routeNames.map((n) => `${n}:${traffic.route(n).len.toFixed(0)}m/${traffic.route(n).stops.length}`).join(' '));

const dt = 1 / 30;
const SECS = Number(process.env.SECS ?? 480), STEPS = Math.round(SECS / dt); // real seconds: a game day is 12 minutes
// the player strolls up and down Neon-dori's west pavement and over the scramble, so the cars meet people
const pl = { x: 72.9, z: 0, speed: 1.2, running: false, eating: false, facing: 0 };
const seen = new Set<number>();
let maxCars = 0, overlapF = 0, hitF = 0, offRoadF = 0, carF = 0, maxStill = 0, footRoadT = 0, footT = 0, jayT = 0, kerbWaits = 0, onBridge = 0;
const stillT = new Map<number, number>();
const jayAt = new Map<string, number>(), hitAt = new Map<string, number>();
const obb = (c: any) => ({ x: c.x, z: c.z, cy: Math.cos(c.yaw), sy: Math.sin(c.yaw), hl: c.shape.car.length / 2, hw: c.shape.car.width / 2 });
const inBox = (b: ReturnType<typeof obb>, x: number, z: number, m: number) => {
  const rx = x - b.x, rz = z - b.z, lz = rx * b.sy + rz * b.cy, lx = rx * b.cy - rz * b.sy;
  return Math.abs(lz) < b.hl + m && Math.abs(lx) < b.hw + m;
};
let trafficMs = 0;
const overAt = new Map<string, number>();
const t0 = performance.now();
for (let s = 0; s < STEPS; s++) {
  hour = 7.5 + (s * dt * 24) / 720;
  pl.z = -40 + 140 * (0.5 + 0.5 * Math.sin(s * dt * 0.01));
  for (const f of asked.splice(0)) f();
  crowd.update(dt, hour, pl, [], 45);
  for (const _ of crowd.visible()) { /* */ }
  const tt = performance.now();
  traffic.update(dt, hour, [pl.x, pl.z], [], crowd, 45);
  trafficMs += performance.now() - tt;
  const cars = traffic.cars as any[];
  maxCars = Math.max(maxCars, cars.length);
  const boxes = cars.map(obb);
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    seen.add(c.id);
    carF++;
    if (!onCarriageway(c.x, c.z) && !(c.x > NEON.x0 * V && c.x < (NEON.x1 + 1) * V)) offRoadF++;
    if (c.z > 42.75 && c.z < 50 && c.x > 72 && c.x < 82) onBridge++;
    for (let j = i + 1; j < cars.length; j++) {
      const o = cars[j];
      if (Math.hypot(c.x - o.x, c.z - o.z) > 6) continue;
      // corners of one inside the other (shrunk a little: voxel bodies have rounded ends)
      const b = boxes[j], bi = boxes[i];
      const corner = [[1, 1], [1, -1], [-1, 1], [-1, -1]].some(([u, v]) => inBox(b, c.x + bi.sy * u * (bi.hl - 0.3) + bi.cy * v * (bi.hw - 0.2), c.z + bi.cy * u * (bi.hl - 0.3) - bi.sy * v * (bi.hw - 0.2), 0));
      if (corner) { overlapF++; const nm = (q: any) => traffic.routeNames.find((n) => traffic.route(n) === q.path); const k = `${Math.round(c.x)},${Math.round(c.z)} ${nm(c)}/${nm(o)}`; overAt.set(k, (overAt.get(k) ?? 0) + 1); }
    }
    const st = c.v < 0.1 && !(c.path.hold >= 0 && !c.released) ? (stillT.get(c.id) ?? 0) + dt : 0;
    stillT.set(c.id, st);
    maxStill = Math.max(maxStill, st);
  }
  for (const wk of crowd.walkers as any[]) {
    if (wk.hidden) continue;
    const p = wk.actor.position;
    if (wk.doing?.k === 'kerb' && wk._k !== wk.doing) { wk._k = wk.doing; kerbWaits++; }
    if (wk.dist > 50) continue;
    footT += dt;
    if (onCarriageway(p.x, p.z)) { footRoadT += dt; if (!crosswalkAt(p.x, p.z, 1.5)) { jayT += dt; const k = `${Math.round(p.x / 4) * 4},${Math.round(p.z / 4) * 4} ${wk.mode}`; jayAt.set(k, (jayAt.get(k) ?? 0) + dt); } }
    for (const b of boxes) if (inBox(b, p.x, p.z, -0.1) && Math.abs(roadY(p.x, p.z)) < 0.6) {
      const c = cars[boxes.indexOf(b)];
      if (c.v > 1) { hitF++; const k = `${Math.round(p.x)},${Math.round(p.z)} ${wk.mode} crosswalk ${crosswalkAt(p.x, p.z, 1.5)?.id ?? '-'}`; hitAt.set(k, (hitAt.get(k) ?? 0) + 1); }
    }
  }
}
const ms = performance.now() - t0;
if (process.env.DUMP) for (const c of traffic.cars as any[]) {
  const name = traffic.routeNames.find((n) => traffic.route(n) === c.path);
  console.log(name, 'id', c.id, 's', c.s.toFixed(1), 'v', c.v.toFixed(2), 'at', c.x.toFixed(1), c.z.toFixed(1), 'stop in', (c.stopS - c.s).toFixed(1), 'blocker', c.blocker?.id ?? '-', 'why', c.why, 'still', (stillT.get(c.id) ?? 0).toFixed(0));
}
console.log(`sim ${(ms / 1000).toFixed(1)} s for ${SECS} s (${(SECS / 30).toFixed(1)} game h), traffic+crowd per frame ${(ms / STEPS).toFixed(3)} ms (traffic ${(trafficMs / STEPS).toFixed(3)} ms)`);
console.log('cars seen', seen.size, 'most at once', maxCars, 'on the bridge (car-frames)', onBridge);
console.log('car-frames overlapping another', overlapF, 'off the road', offRoadF, 'of', carF);
console.log('longest wait (s, not counting the rank)', maxStill.toFixed(1));
console.log('moving car through someone on foot (frames)', hitF);
console.log('on foot near the player: in the road', ((footRoadT / footT) * 100).toFixed(2) + '%', 'jaywalking', ((jayT / footT) * 100).toFixed(2) + '%', 'kerb waits', kerbWaits);
if (process.env.DUMP) {
  console.log('jaywalk spots', [...jayAt].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v.toFixed(0)}s`).join(' | '));
  console.log('overlap spots', [...overAt].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k}:${v}`).join(' | '));
  console.log('hit spots', [...hitAt].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, v]) => `${k}:${v}`).join(' | '));
}
const ok = seen.size > 60 && overlapF < carF * 0.002 && offRoadF === 0 && maxStill < 120 && hitF === 0 && jayT / footT < 0.01 && onBridge > 0 && kerbWaits > 0;
console.log(ok ? 'traffic OK' : 'TRAFFIC PROBLEMS');
if (!ok) process.exit(1);
