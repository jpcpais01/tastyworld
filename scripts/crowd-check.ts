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
const crowd = new Crowd(nav, a, { bubble: () => { bubbles++; }, serve: () => { served++; }, quiet: () => false });
type Fake = { root: THREE.Group; position: THREE.Vector3; anim: string; speed: number; hold: string; targetFacing: number; facing: number; headYawTarget: number; animT: number };
const fakes: Fake[] = [];
let prev: any = null;
for (let i = 0; i < 18; i++) {
  const root = new THREE.Group();
  const f: Fake = { root, get position() { return root.position; }, anim: 'idle', speed: 0, hold: 'none', targetFacing: 0, facing: 0, headYawTarget: 0, animT: 0 } as any;
  fakes.push(f);
  const pair = i % 5 === 4 && prev;
  prev = crowd.add(f as any, randomLook(1000 + i * 7), (i * 7) % a.graph.nodes.length, pair ? prev : undefined);
}
let hour = 6;
crowd.settle(hour);
const dt = 1 / 30;
const anims: Record<string, number> = {};
const doings: Record<string, number> = {};
const goals: Record<string, number> = {};
let blockedT = 0, nan = 0, maxStill = 0;
const still = fakes.map(() => 0), last = fakes.map((f) => f.position.clone());
const player = { x: 35.7, z: 40, speed: 0, running: false, eating: false, facing: 0 };
const t0 = performance.now();
const STEPS = 30 * 60 * 12; // one game day (12 min)
for (let s = 0; s < STEPS; s++) {
  hour = (6 + (s * dt / 720) * 24) % 24;
  // the player wanders along the promenade, sometimes running
  player.x = 20 + 30 * (0.5 + 0.5 * Math.sin(s * dt * 0.05));
  player.running = Math.sin(s * dt * 0.3) > 0.7;
  player.speed = player.running ? 4.8 : Math.sin(s * dt * 0.11) > 0 ? 3.2 : 0;
  crowd.update(dt, hour, player);
  for (const f of fakes) f.facing = f.targetFacing, f.animT += dt;
  for (const [i, wk] of crowd.walkers.entries()) {
    if (wk.hidden) continue;
    const p = wk.actor.position;
    if (!Number.isFinite(p.x + p.y + p.z)) nan++;
    anims[wk.actor.anim] = (anims[wk.actor.anim] ?? 0) + 1;
    const gk = (wk as any).goal.k + ((wk as any).goal.room ? ':' + (wk as any).goal.room.kind : '');
    if ((wk as any)._g !== gk) { (wk as any)._g = gk; goals[gk] = (goals[gk] ?? 0) + 1; }
    const k = wk.lead ? 'follow' : wk.doing?.k ?? (wk.path.length ? 'walking' : 'deciding');
    doings[k] = (doings[k] ?? 0) + 1;
    if (wk.doing?.k !== 'sit' && nav.standHeightVox(p.x, p.z) === 255) blockedT += dt;
    if (p.distanceTo(last[i]) < 0.002 && !wk.doing && !wk.lead) still[i] += dt; else still[i] = 0;
    maxStill = Math.max(maxStill, still[i]);
    last[i].copy(p);
  }
  if (s % (30 * 60) === 0) console.log('hour', hour.toFixed(1), 'out', crowd.walkers.filter((x) => !x.hidden).length);
}
console.log('sim ms', (performance.now() - t0) | 0, 'per frame ms', ((performance.now() - t0) / STEPS).toFixed(3));
console.log('nan', nan, 'seconds standing on blocked cells', blockedT.toFixed(1), 'longest idle w/o activity', maxStill.toFixed(1));
console.log('anims', anims);
console.log('doing', doings);
console.log('goals', goals);
console.log('bubbles', bubbles, 'served', served);
const ok = nan === 0 && maxStill < 20 && blockedT < 60 && (doings.browse ?? 0) > 0 && (doings.sit ?? 0) > 0 && (doings.chat ?? 0) > 0;
console.log(ok ? 'crowd OK' : 'CROWD PROBLEMS');
if (!ok) process.exit(1);
