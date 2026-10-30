// Simulates the street crowd for one game day against the baked world and checks nobody gets
// stuck, walks through walls for long or ends up with a broken position.
import { bakeWorld } from '../src/world/bake';
import { Nav } from '../src/game/nav';
import { Crowd } from '../src/game/crowd';
import { randomLook } from '../src/world/characters';
import * as THREE from 'three';

const w = bakeWorld(() => {});
const nav = new Nav(w.nav);
const a = w.anchors;
let bubbles = 0, served = 0;
type Fake = { root: THREE.Group; position: THREE.Vector3; anim: string; speed: number; hold: string; targetFacing: number; facing: number; headYawTarget: number; animT: number };
const fakes: Fake[] = [];
const fake = () => {
  const root = new THREE.Group();
  const f = { root, get position() { return root.position; }, anim: 'idle', speed: 0, hold: 'none', targetFacing: 0, facing: 0, headYawTarget: 0, animT: 0, built: false, release() {}, pedals: true, dog: false, noBlob: false, isCat: false } as any;
  fakes.push(f);
  return f;
};
const crowd = new Crowd(nav, a, { bubble: () => { bubbles++; }, serve: () => { served++; }, quiet: () => false }, { person: fake, dog: fake, vehicle: fake, boat: fake });
crowd.populate({ walkers: 150, joggers: 8, dogs: 8, cyclists: 10, couriers: 6, boats: 3, exercise: 9 });
let hour = 6;
crowd.settle(hour);
const dt = 1 / 30;
const anims: Record<string, number> = {};
const doings: Record<string, number> = {};
const goals: Record<string, number> = {};
let outT = 0, blockedT = 0, nan = 0, maxStill = 0;
const still = crowd.walkers.map(() => 0), last = crowd.walkers.map((w) => w.actor.position.clone());
const places: Record<string, number> = {};
let maxOut = 0;
const player = { x: 35.7, z: 40, speed: 0, running: false, eating: false, facing: 0 };
const t0 = performance.now();
const STEPS = 30 * 60 * 12; // one game day (12 min)
for (let s = 0; s < STEPS; s++) {
  hour = (6 + (s * dt / 720) * 24) % 24;
  // the player wanders along the promenade, sometimes running
  player.x = 20 + 30 * (0.5 + 0.5 * Math.sin(s * dt * 0.05));
  player.running = Math.sin(s * dt * 0.3) > 0.7;
  player.speed = player.running ? 4.8 : Math.sin(s * dt * 0.11) > 0 ? 3.2 : 0;
  crowd.update(dt, hour, player, [], 40);
  for (const _ of crowd.visible()) { /* hides and shows bodies like the game does */ }
  for (const f of fakes) f.facing = f.targetFacing, f.animT += dt;
  for (const [i, wk] of crowd.walkers.entries()) {
    if (wk.hidden) continue;
    const p = wk.actor.position;
    if (!Number.isFinite(p.x + p.y + p.z)) nan++;
    outT += dt;
    anims[wk.actor.anim] = (anims[wk.actor.anim] ?? 0) + 1;
    const gk = (wk as any).goal.k + ((wk as any).goal.room ? ':' + (wk as any).goal.room.kind : '');
    if ((wk as any)._g !== gk) { (wk as any)._g = gk; goals[gk] = (goals[gk] ?? 0) + 1; }
    const k = wk.lead ? 'follow' : wk.doing?.k === 'seq' ? 'seq:' + wk.doing.steps[wk.doing.i].anim : wk.doing?.k ?? (wk.path.length ? 'walking' : 'deciding');
    if ((wk as any).place && (wk as any)._p !== (wk as any).place.name) { (wk as any)._p = (wk as any).place.name; places[(wk as any).place.name] = (places[(wk as any).place.name] ?? 0) + 1; }
    doings[k] = (doings[k] ?? 0) + 1;
    if (wk.doing?.k !== 'sit' && (wk as any).mode !== 'ride' && nav.standHeightVox(p.x, p.z) === 255) blockedT += dt;
    if (p.distanceTo(last[i]) < 0.002 && !wk.doing && !wk.lead) still[i] += dt; else still[i] = 0;
    maxStill = Math.max(maxStill, still[i]);
    last[i].copy(p);
  }
  maxOut = Math.max(maxOut, crowd.walkers.filter((x) => !x.hidden).length);
  if (s % (30 * 60) === 0) console.log('hour', hour.toFixed(1), 'out', crowd.walkers.filter((x) => !x.hidden).length, 'riders', crowd.walkers.filter((x) => !x.hidden && (x as any).mode === 'ride').length, 'joggers', crowd.walkers.filter((x) => !x.hidden && (x as any).mode === 'jog').length);
}
console.log('sim ms', (performance.now() - t0) | 0, 'per frame ms', ((performance.now() - t0) / STEPS).toFixed(3));
console.log('nan', nan, 'seconds standing on blocked cells', blockedT.toFixed(1), `(${((blockedT / outT) * 100).toFixed(2)}% of time out)`, 'longest idle w/o activity', maxStill.toFixed(1));
console.log('anims', anims);
console.log('doing', doings);
console.log('goals', goals);
console.log('trips', places, 'most out at once', maxOut, 'bodies', fakes.length);
console.log('bubbles', bubbles, 'served', served);
const ok = nan === 0 && maxStill < 20 && blockedT / outT < 0.004 && (doings.browse ?? 0) > 0 && (doings.sit ?? 0) > 0 && (doings.chat ?? 0) > 0 && (doings['seq:pray'] ?? 0) > 0 && maxOut > 100;
console.log(ok ? 'crowd OK' : 'CROWD PROBLEMS');
if (!ok) process.exit(1);
