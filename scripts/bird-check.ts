// Spreads the city's birds over the baked world, then follows the player around town for one game day,
// checking the flocks: where they live, that they scatter, fly clear of walls, land on real ground and roost at night.
import { bakeWorld } from '../src/world/bake';
import { Birds } from '../src/game/birds';
import { buildBird, VARIANTS, type Species } from '../src/world/birds';
import { meshGrid } from '../src/world/mesher';
import { zoneAt } from '../src/world/layout';

let fail = 0;
const bad = (msg: string) => { fail++; console.log('FAIL ' + msg); };

// every model meshes, and stays a small bird
for (const sp of Object.keys(VARIANTS) as Species[])
  for (let v = 0; v < VARIANTS[sp]; v++) {
    const m = buildBird(sp, v);
    const md = meshGrid({ grid: m.grid, pal: m.pal, scale: m.scale, origin: m.origin, parts: m.parts });
    const [x0, y0, z0, x1, y1, z1] = md.bounds;
    if (v === 0) console.log(`${sp.padEnd(10)} ${md.indices.length / 3} tris, ${(x1 - x0).toFixed(2)} x ${(y1 - y0).toFixed(2)} x ${(z1 - z0).toFixed(2)} m (wings spread)`);
    if (y0 < -1e-6 || y1 > 0.5 || md.indices.length / 3 > 1200) bad(`${sp}/${v} model out of bounds or heavy`);
  }

const w = bakeWorld(() => {});
const t0 = performance.now();
const birds = new Birds({ nav: w.nav, height: w.height, solid: w.solid, shore: w.shore, lightmap: w.lightmap, anchors: w.anchors }, null);
const B = birds as any;
console.log(`spots found in ${(performance.now() - t0).toFixed(0)} ms`);
const per: Record<string, number> = {};
for (const s of birds.spots) per[s.sp + (s.ground ? '' : '@perch')] = (per[s.sp + (s.ground ? '' : '@perch')] ?? 0) + 1;
console.log('spots', birds.spots.length, per);
const count = (m: Map<number, unknown[]>) => [...m.values()].reduce((n, l) => n + l.length, 0);
console.log(`perches: ${count(B.roofs)} roof, ${count(B.wires)} wire (${w.anchors.wires.length} wires), ${B.banks.length} bank`);
if (!birds.spots.some((s) => s.sp === 'kingfisher')) bad('no kingfisher anywhere');
if ((per.pigeon ?? 0) < 20) bad('too few pigeon flocks');
// Amalfi has no overhead wires: its small birds keep to the ground and the roofs
if ((process.env.CITY !== 'amalfi' && count(B.wires) < 50) || count(B.roofs) < 200) bad('too few perches');
// perches are in open air
for (const m of [B.roofs, B.wires] as Map<number, { x: number; y: number; z: number }[]>[])
  for (const l of m.values()) for (const p of l) if (birds.solidAt(p.x, p.y + 0.05, p.z)) { bad(`perch inside a wall at ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)}`); break; }

// a day out: around the plaza, along Kaminari Lane, the canal, the station square and the shrine
const route: [number, number][] = [[4, 12], [30, 12], [60, 12], [50, 30], [36, 36], [20, 52], [-20, 52], [-40, -36], [30, -33], [60, -33], [4, 12]];
const dt = 1 / 30, STEPS = 30 * 60 * 12;
let leg = 0, legT = 0, nan = 0, inWall = 0, flightFrames = 0, sunk = 0, maxLive = 0, flushes = 0, lands = 0, dives = 0;
const wallBy: Record<string, number> = {};
const seen = new Set<string>(), states: Record<string, number> = {};
const prev = new Map<object, string>();
let nightPerched = 0, nightGround = 0, eatVisits = 0;
const player = { x: 4, z: 12, speed: 0 };
for (let s = 0; s < STEPS; s++) {
  const hour = (6 + (s * dt / 720) * 24) % 24;
  // walk the route, running some of the way, with a stop to eat now and then
  const [ax, az] = route[leg], [bx, bz] = route[(leg + 1) % route.length];
  const run = Math.sin(s * dt * 0.3) > 0.6, eat = Math.sin(s * dt * 0.02) > 0.85;
  player.speed = eat ? 0 : run ? 4.8 : 1.4;
  legT += (player.speed * dt) / Math.max(1, Math.hypot(bx - ax, bz - az));
  if (legT >= 1) { legT = 0; leg = (leg + 1) % route.length; }
  player.x = ax + (bx - ax) * legT; player.z = az + (bz - az) * legT;
  birds.update(dt, hour, player.x, player.z, 40, [player], null, eat ? [player.x, player.z] : null);
  maxLive = Math.max(maxLive, birds.count);
  for (const b of birds.birds as any[]) {
    seen.add(b.sp);
    states[b.state] = (states[b.state] ?? 0) + 1;
    if (!Number.isFinite(b.x + b.y + b.z + b.yaw + b.pitch)) nan++;
    const was = prev.get(b);
    if (was === 'ground' && b.state === 'fly' && b.then !== 'perch') flushes++;
    if (was === 'fly' && b.state === 'ground') lands++;
    if (b.state === 'dive' && was !== 'dive') dives++;
    prev.set(b, b.state);
    if (b.state === 'fly') {
      flightFrames++;
      const t = b.ft / b.fT;
      if (t > 0.15 && t < 0.85 && birds.solidAt(b.x, b.y, b.z)) { inWall++; const k = b.then + (b.f1.y > 15 ? ':leave' : b.f0.y > 15 ? ':return' : ''); wallBy[k] = (wallBy[k] ?? 0) + 1; }
    }
    if (b.state === 'ground') {
      if (Math.abs(b.y - B.navY(b.x, b.z)) > 0.06) sunk++;
      if (Number.isNaN(B.groundAt(b.x, b.z))) sunk++;
      if (eat && Math.hypot(b.x - player.x, b.z - player.z) < 1.4) eatVisits++;
    }
    if ((hour > 21 || hour < 3) && b.state === 'perch') nightPerched++;
    if ((hour > 21 || hour < 3) && b.state === 'ground') nightGround++;
  }
}
console.log('species seen', [...seen].join(', '), '| most at once', maxLive);
console.log('states', states);
console.log(`flushes ${flushes}, landings ${lands}, kingfisher dives ${dives}, birds at someone's lunch ${eatVisits} frames`);
console.log(`night: ${nightPerched} perched / ${nightGround} on the ground (bird-frames)`);
if (nan) bad(`${nan} NaN positions`);
console.log('in walls by flight', wallBy);
if (inWall > flightFrames * 0.002) bad(`${inWall} of ${flightFrames} flight frames inside walls`);
if (sunk) bad(`${sunk} bird-frames off the ground or on bad ground`);
if (flushes < 20) bad('birds hardly scatter');
if (nightGround > nightPerched * 0.05) bad('birds out foraging at night');
if (seen.size < 5) bad('too few species met');
for (const s of birds.spots) if (s.on && zoneAt(s.x, s.z)?.id === 'kakurega') bad('birds in the hidden restaurant');
console.log(fail ? `${fail} problem(s)` : 'birds OK');
process.exit(fail ? 1 : 0);
