// CITY=madeira npx tsx scripts/madeira-check.ts [--strips]
// Bakes Madeira and checks that everything the player needs can be reached on foot from the spawn: the stalls,
// the idlers, the majolica lemons, the hidden door, the cats and every node of the crowd's walking graph.
// With --strips it also bakes the town in four strips, as the browser's workers do, and compares them.
import { bakeWorld, WorldPart } from '../src/world/bake';
import { assemble } from '../src/world/assemble';
import { Nav } from '../src/game/nav';
import { CITY } from '../src/world/cityId';

if (CITY !== 'madeira') { console.error('run with CITY=madeira'); process.exit(1); }
const t = performance.now();
const w = bakeWorld((s, f) => { if (f === 0 || f === 1) process.stdout.write(`${s} ${(f * 100) | 0}%  ${((performance.now() - t) | 0)}ms\n`); });
console.log('baked: lamps', w.stats.lamps, 'ms', w.stats.ms | 0, 'world MB', (w.stats.bytes / 1e6).toFixed(1), 'rss MB', (process.memoryUsage().rss / 1e6).toFixed(0));
const a = w.anchors;
const nav = new Nav(w.nav);
let walk = 0; for (const h of w.nav.height) if (h !== 255) walk++;
console.log('walkable cells', walk, '/', w.nav.height.length, 'occluders', a.occluders.length, 'benches', a.benches.length);
const [sx, , sz] = a.spawn;
console.log('spawn walkable', nav.walkable(sx, sz), 'height', nav.heightAt(sx, sz).toFixed(2));
const reach = (x: number, z: number, tol = 0.8) => {
  const p = nav.findPath(sx, sz, x, z);
  if (!p || !p.length) return false;
  const [ex, ez] = p[p.length - 1];
  return Math.hypot(ex - x, ez - z) < tol;
};
let bad = 0;
const check = (what: string, x: number, z: number, tol = 0.8) => {
  const ok = nav.walkable(x, z) && reach(x, z, tol);
  if (!ok) { bad++; console.log('UNREACHABLE', what, x.toFixed(1), z.toFixed(1), 'walkable', nav.walkable(x, z)); }
  return ok;
};
for (const s of a.stalls) { check(`stall ${s.id}`, s.stand[0], s.stand[1]); console.log('stall', s.id, 'y', nav.heightAt(s.stand[0], s.stand[1]).toFixed(2), 'vendor y', nav.heightAt(s.vendor[0], s.vendor[1]).toFixed(2)); }
for (const i of a.idlers) check(`idler ${i.id}`, i.pos[0], i.pos[2]);
for (const c of a.cats) check('cat', c[0], c[2]);
a.manekis.forEach((m, i) => {
  const near = [[0.7, 0], [-0.7, 0], [0, 0.7], [0, -0.7]].some(([dx, dz]) => nav.walkable(m[0] + dx, m[2] + dz) && reach(m[0] + dx, m[2] + dz));
  if (!near) { bad++; console.log('UNREACHABLE lemon', i, m); } else console.log('lemon', i, 'ok at y', nav.heightAt(m[0], m[2]).toFixed(2));
});
check('hidden door', a.hiddenDoor.stand[0], a.hiddenDoor.stand[1]);
// the great halls: walked into from the street, everyone in them standing on their floor
for (const h of a.halls ?? []) {
  const [x0, z0, x1, z1] = h.rect;
  const mid: [number, number] = h.kind === 'church' ? [x1 - 3, (z0 + z1) / 2] : [(x0 + x1) / 2, (z0 + z1) / 2];
  if (check(`hall ${h.id}`, mid[0], mid[1], 1.2)) console.log('hall', h.id, 'floor', h.floor.toFixed(2), 'nav', nav.heightAt(mid[0], mid[1]).toFixed(2), 'people', h.people.length, 'beams', h.beams.length);
  for (const p of h.people) {
    if (p.pose === 'sit') continue;
    if (check(`hall ${h.id} ${p.pose}`, p.pos[0], p.pos[2], 1.2) && Math.abs(nav.heightAt(p.pos[0], p.pos[2]) - p.pos[1]) > 0.3) { bad++; console.log('FLOATING hall person', h.id, p.pos.map((v) => v.toFixed(1)).join(','), 'ground', nav.heightAt(p.pos[0], p.pos[2]).toFixed(2)); }
  }
}
console.log('hidden door y', nav.heightAt(a.hiddenDoor.stand[0], a.hiddenDoor.stand[1]).toFixed(2), 'label', a.hiddenDoor.label);
let nb = 0;
a.graph.nodes.forEach(([x, z], i) => { if (!nav.walkable(x, z) || !reach(x, z, 1.5)) { nb++; if (nb < 40) console.log('graph node off the walk', i, x.toFixed(1), z.toFixed(1), 'walkable', nav.walkable(x, z)); } });
console.log('graph nodes', a.graph.nodes.length, 'unreachable', nb);
for (const b of a.benches.slice(0, 400)) {
  const [x, , z] = b.approach ? [b.approach[0], 0, b.approach[1]] : [0, 0, 0];
  if (b.approach && !nav.walkable(x, z)) { console.log('bench approach blocked', x.toFixed(1), z.toFixed(1)); }
}
const inav = new Nav(w.interiorNav);
console.log('interior spawn', inav.walkable(a.interiorSpawn[0], a.interiorSpawn[2]), 'counter', inav.walkable(a.counterStand[0], a.counterStand[1]), 'exit', inav.walkable(a.interiorExit[0], a.interiorExit[1]));
// heights reached: the highest walkable ground (the lemon terraces should be well above the town)
let top = 0; for (let i = 0; i < w.nav.height.length; i++) { const h = w.nav.height[i]; if (h !== 255 && h > top) top = h; }
console.log('highest walkable layer', top, '=', ((top - 12) * 0.25).toFixed(1), 'm');
{
  // how far up can you walk from the spawn? flood fill the nav graph
  const { sx: nx, sz: nz, height } = w.nav;
  const seen = new Uint8Array(nx * nz);
  const ci = Math.floor((sz - w.nav.oz) / 0.25) * nx + Math.floor((sx - w.nav.ox) / 0.25);
  const q = [ci]; seen[ci] = 1; let n = 0, hi = 0;
  while (q.length) {
    const c = q.pop()!; n++;
    const h = height[c]; if (h > hi) hi = h;
    const x = c % nx, z = (c / nx) | 0;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const X = x + dx, Z = z + dz;
      if (X < 0 || Z < 0 || X >= nx || Z >= nz) continue;
      const d = Z * nx + X;
      if (seen[d] || height[d] === 255 || Math.abs(height[d] - h) > 2) continue;
      seen[d] = 1; q.push(d);
    }
  }
  console.log('cells reachable from spawn', n, 'of', walk, `(${((n / walk) * 100).toFixed(0)}%)`, 'highest reachable', ((hi - 12) * 0.25).toFixed(1), 'm');
}
console.log('problems', bad);

if (process.argv.includes('--strips')) {
  const parts = 4;
  const inits = Array.from({ length: parts }, (_, i) => new WorldPart(i, parts).init());
  const w4 = assemble(inits);
  let diff = 0;
  for (let i = 0; i < w.nav.height.length; i++) if (w.nav.height[i] !== w4.nav.height[i]) diff++;
  let hd = 0;
  for (let i = 0; i < w.height.length; i++) if (w.height[i] !== w4.height[i]) hd++;
  console.log('strip bake: nav cells differing', diff, 'height cells differing', hd, 'occluders', w.anchors.occluders.length, w4.anchors.occluders.length);
}
