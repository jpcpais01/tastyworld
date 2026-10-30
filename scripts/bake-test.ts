import { bakeWorld } from '../src/world/bake';
const t = performance.now();
const w = bakeWorld((s, f) => process.stdout.write(`${s} ${(f * 100) | 0}%  ${((performance.now() - t) | 0)}ms\n`));
console.log('baked', 'lamps', w.stats.lamps, 'ms', w.stats.ms | 0, 'world MB', (w.stats.bytes / 1e6).toFixed(1), 'heap MB', (process.memoryUsage().heapUsed / 1e6).toFixed(0), 'rss MB', (process.memoryUsage().rss / 1e6).toFixed(0));
{
  // mesh every chunk once, full and half resolution, to measure the streamed totals
  const { CHUNKS_X, CHUNKS_Z } = await import('../src/world/layout');
  let verts = 0, lodVerts = 0, n = 0, maxV = 0;
  const tm = performance.now();
  for (let iz = 0; iz < CHUNKS_Z; iz++) for (let ix = 0; ix < CHUNKS_X; ix++) {
    const m = w.part.mesh(ix, iz, false); if (m) { verts += m.vertexCount; n++; maxV = Math.max(maxV, m.vertexCount); }
    if (process.argv.includes('--lod')) { const l = w.part.mesh(ix, iz, true); if (l) lodVerts += l.vertexCount; }
  }
  console.log('chunks', n, 'verts', verts, 'max chunk verts', maxV, 'lod verts', lodVerts, 'mesh ms', (performance.now() - tm) | 0);
}
console.log('tagged', w.tagged.map((t) => t.tag + ':' + t.mesh.vertexCount));
console.log('interior chunks', w.interiorChunks.length);
let walk = 0; for (const h of w.nav.height) if (h !== 255) walk++;
console.log('walkable cells', walk, '/', w.nav.height.length);
const a = w.anchors;
const navH = (x: number, z: number) => w.nav.height[Math.floor((z - w.nav.oz) / 0.25) * w.nav.sx + Math.floor((x - w.nav.ox) / 0.25)];
console.log('spawn', navH(a.spawn[0], a.spawn[2]));
for (const s of a.stalls) console.log('stall', s.id, s.stand.map(v=>v.toFixed(1)), navH(s.stand[0], s.stand[1]));
for (const n of a.graph.nodes) if (navH(n[0], n[1]) === 255) console.log('BLOCKED node', n);
for (const m of a.manekis) console.log('maneki', m, navH(m[0] + 0.6, m[2]), navH(m[0] - 0.6, m[2]), navH(m[0], m[2]+0.6), navH(m[0], m[2]-0.6));
for (const i of a.idlers) console.log('idler', i.id, navH(i.pos[0], i.pos[2]));
for (const c of a.cats) console.log('cat', c, navH(c[0], c[2]));
console.log('door stand', navH(a.hiddenDoor.stand[0], a.hiddenDoor.stand[1]));
const inav = w.interiorNav;
const inH = (x: number, z: number) => inav.height[Math.floor((z - inav.oz) / 0.25) * inav.sx + Math.floor((x - inav.ox) / 0.25)];
console.log('interior spawn', inH(a.interiorSpawn[0], a.interiorSpawn[2]), 'counter stand', inH(a.counterStand[0], a.counterStand[1]), 'chef', inH(a.chef[0], a.chef[2]));

// ---- ground-floor rooms: every door, stand and secret must be reachable from the spawn
import { Nav } from '../src/game/nav';
const nav = new Nav(w.nav);
const reach = (x: number, z: number, tol = 0.6) => {
  const p = nav.findPath(a.spawn[0], a.spawn[2], x, z);
  if (!p || !p.length) return false;
  const [ex, ez] = p[p.length - 1];
  return Math.hypot(ex - x, ez - z) < tol;
};
let bad = 0;
console.log('rooms', a.rooms.length, a.rooms.map((r) => r.id).join(' '));
for (const r of a.rooms) {
  const issues: string[] = [];
  if (!reach(r.door[0], r.door[1])) issues.push('door');
  for (const s of r.spots) if (!reach(s.stand[0], s.stand[1])) issues.push(`${s.kind}@${s.stand.map((v) => v.toFixed(1))}`);
  if (issues.length) { bad++; console.log('ROOM', r.id, 'rect', r.rect.map((v) => v.toFixed(1)).join(','), 'unreachable:', issues.join(' ')); }
}
for (const s of a.stalls) if (!reach(s.stand[0], s.stand[1])) { bad++; console.log('STALL unreachable', s.id); }
a.darumas.forEach((d, i) => { const ok = reach(d[0], d[2], 1.2); if (!ok) bad++; console.log('daruma', i, d.map((v) => v.toFixed(1)).join(','), ok ? 'ok' : 'TOO FAR'); });
if (a.secret) {
  console.log('secret shelf stand reachable', reach(a.secret.shelfStand[0], a.secret.shelfStand[1]));
  nav.setBlocked('shelf', a.secret.gate, true);
  console.log('secret note reachable while closed (should be false)', reach(a.secret.noteStand[0], a.secret.noteStand[1]));
  nav.setBlocked('shelf', a.secret.gate, false);
  console.log('secret note reachable when open', reach(a.secret.noteStand[0], a.secret.noteStand[1]));
}
console.log('rooms with problems', bad);
