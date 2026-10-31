// CITY=<tokyo|amalfi|istanbul> npx tsx scripts/ledge-check.ts [--all] [--max N]
// City code v2 rule 6: no drop or ledge the player can't step down or climb. Bakes the city and audits its walk map
// for raised ground the player can see but not walk up onto:
//  - plateaus: walkable areas (terraces, plinths, platforms, raised floors) the town's walk network can't step onto,
//    though they sit right beside it;
//  - ledges: places where the town meets higher ground of its own across a step too tall to climb, and the nearest
//    way round is a long detour (a plinth whose steps stop short, a terrace you must walk round the block to reach).
// Small raised things (benches, tables, crates, counters, rims) are left out by size.
// Prints each problem with its place and exits non-zero when any is found.
import { bakeWorld } from '../src/world/bake';
import { zoneAt, V, G } from '../src/world/layout';
import { CITY } from '../src/world/cityId';

const BLOCKED = 255, STEP = 2;
const MIN_PLATEAU = 48; // cells (3 m²): smaller raised tops are furniture
const MIN_CONTACT = 6; // cells of shared edge (1.5 m) before a plateau reads as ground you would walk onto
const MIN_RISE = 3; // voxels: anything taller than a step
const MAX_RISE = 24; // voxels (6 m): taller is a wall or a building, not a ledge one expects to climb
const DETOUR = 24; // metres: a way round longer than this (and 4x the gap) counts as no way up
const arg = (k: string) => { const i = process.argv.indexOf(k); return i >= 0 ? process.argv[i + 1] : undefined; };
const SHOW = Number(arg('--max') ?? 60);

const t = performance.now();
const w = bakeWorld();
const { sx, sz, ox, oz, height: H } = w.nav;
const n = sx * sz;
console.log(`${CITY}: baked in ${((performance.now() - t) / 1000).toFixed(1)} s, walk map ${sx}x${sz}`);

// connected regions by ordinary steps (4-neighbour, as Nav.landings does)
const comp = new Int32Array(n).fill(-1);
const size: number[] = [];
const q = new Int32Array(n);
for (let s0 = 0; s0 < n; s0++) {
  if (comp[s0] >= 0 || H[s0] === BLOCKED) continue;
  const id = size.length;
  let qh = 0, qt = 0;
  q[qt++] = s0; comp[s0] = id;
  while (qh < qt) {
    const c = q[qh++], cx = c % sx;
    for (const ni of [cx + 1 < sx ? c + 1 : -1, cx > 0 ? c - 1 : -1, c + sx < n ? c + sx : -1, c - sx]) {
      if (ni < 0 || comp[ni] >= 0 || H[ni] === BLOCKED || Math.abs(H[ni] - H[c]) > STEP) continue;
      comp[ni] = id; q[qt++] = ni;
    }
  }
  size.push(qt);
}
const [spx, , spz] = w.anchors.spawn;
const main = comp[Math.floor((spz - oz) / V) * sx + Math.floor((spx - ox) / V)];
let walk = 0; for (let i = 0; i < n; i++) if (H[i] !== BLOCKED) walk++;
console.log(`walkable cells ${walk}, town network ${size[main]} (${((size[main] / walk) * 100).toFixed(1)}%), regions ${size.length}`);

const at = (i: number) => [ox + ((i % sx) + 0.5) * V, oz + (Math.floor(i / sx) + 0.5) * V];
// on a planned hillside, name the ground kinds either side (for working out what to fix)
const planMod: any = process.argv.includes('--kinds') && CITY !== 'tokyo' ? await (CITY === 'amalfi' ? import('../src/world/amalfiPlan') : import('../src/world/istanbulPlan')) : null;
const plan = planMod ? (CITY === 'amalfi' ? planMod.amalfiPlan() : planMod.istanbulPlan()) : null;
/** Ground past the town's edge (Amalfi's wild slopes and crags, Istanbul's band beyond the edge): a natural or built end. */
const edgeMod: any = CITY === 'amalfi' ? await import('../src/world/amalfiPlan') : CITY === 'istanbul' ? await import('../src/world/istanbulPlan') : null;
const edgePlan = CITY === 'amalfi' ? edgeMod.amalfiPlan() : null;
const wildAt = (i: number) => {
  const [x, z] = at(i);
  if (CITY === 'istanbul') return edgeMod.beyond(x, z);
  if (CITY !== 'amalfi') return false;
  const vx = Math.floor(x / V), vz = Math.floor(z / V), c = edgeMod.col(vx, vz);
  return edgePlan.kind[c] === 0 && (edgePlan.crag[c] === 1 || edgeMod.wildRock(vx, vz, edgePlan.walk[c]));
};
const kindAt = (i: number) => { if (!plan) return ''; const [x, z] = at(i); const c = planMod.col(Math.floor(x / V), Math.floor(z / V)); return ` k${plan.lot[c] ? 'L' : plan.kind[c]}`; };
const where = (i: number) => { const [x, z] = at(i); return `(${x.toFixed(1)}, ${z.toFixed(1)}) ${zoneAt(x, z)?.name ?? '-'}${kindAt(i)}`; };
const m = (h: number) => ((h - G) * V).toFixed(2);

// a region counts as ground only where it is roomy: some cell of it with a 1.25 m square of the region all round
// (a parapet, a kerb or a bench top is never that wide)
const CORE = 2;
const roomy = new Uint8Array(size.length);
for (let i = 0; i < n; i++) {
  const c = comp[i];
  if (c < 0 || roomy[c] || size[c] < MIN_PLATEAU) continue;
  const ix = i % sx, iz = Math.floor(i / sx);
  if (ix < CORE || iz < CORE || ix >= sx - CORE || iz >= sz - CORE) continue;
  let ok = true;
  for (let dz = -CORE; dz <= CORE && ok; dz++) for (let dx = -CORE; dx <= CORE && ok; dx++) if (comp[i + dz * sx + dx] !== c) ok = false;
  if (ok) roomy[c] = 1;
}

// 1. plateaus beside the town that it can't step onto
interface Plateau { id: number; cells: number; contact: number; rise: number; minRise: number; at: number; top: number }
const pl = new Map<number, Plateau>();
for (let i = 0; i < n; i++) {
  const c = comp[i];
  if (c < 0 || c === main || !roomy[c]) continue;
  const ix = i % sx;
  for (const j of [ix + 1 < sx ? i + 1 : -1, ix > 0 ? i - 1 : -1, i + sx < n ? i + sx : -1, i - sx]) {
    if (j < 0 || comp[j] !== main) continue;
    const rise = H[i] - H[j];
    if (rise < MIN_RISE || rise > MAX_RISE) continue;
    let p = pl.get(c);
    if (!p) pl.set(c, (p = { id: c, cells: size[c], contact: 0, rise: 0, minRise: 99, at: i, top: H[i] }));
    p.contact++;
    p.rise = Math.max(p.rise, rise);
    if (rise < p.minRise) { p.minRise = rise; p.at = j; }
  }
}
// a plateau that is mostly the wild ground past the town's edge is where the town ends, not a ledge
const wildCells = new Map<number, number>();
for (let i = 0; i < n; i++) if (pl.has(comp[i]) && wildAt(i)) wildCells.set(comp[i], (wildCells.get(comp[i]) ?? 0) + 1);
const edges = [...pl.values()].filter((p) => p.contact >= MIN_CONTACT && (wildCells.get(p.id) ?? 0) * 2 > p.cells);
const plateaus = [...pl.values()].filter((p) => p.contact >= MIN_CONTACT && (wildCells.get(p.id) ?? 0) * 2 <= p.cells).sort((a, b) => b.cells - a.cells);

// 2. ledges inside the town: low and high cells of the town side by side, joined only by a long way round
const seg = new Int32Array(n).fill(-1);
interface Ledge { lo: number; hi: number; rise: number; cells: number; detour: number }
const ledges: Ledge[] = [];
const dist = new Float32Array(n);
const stampA = new Int32Array(n);
let stamp = 0;
/** Walking distance in metres from a to b over the town (capped). */
const walkDist = (a: number, b: number, cap: number) => {
  stamp++;
  let qh = 0, qt = 0;
  q[qt++] = a; stampA[a] = stamp; dist[a] = 0;
  while (qh < qt) {
    const c = q[qh++];
    if (c === b) return dist[c];
    if (dist[c] > cap) break;
    const cx = c % sx;
    for (const ni of [cx + 1 < sx ? c + 1 : -1, cx > 0 ? c - 1 : -1, c + sx < n ? c + sx : -1, c - sx]) {
      if (ni < 0 || stampA[ni] === stamp || comp[ni] !== main || Math.abs(H[ni] - H[c]) > STEP) continue;
      stampA[ni] = stamp; dist[ni] = dist[c] + V; q[qt++] = ni;
    }
  }
  return Infinity;
};
for (let i = 0; i < n; i++) {
  if (comp[i] !== main || seg[i] >= 0) continue;
  const ix = i % sx;
  let hi = -1;
  for (const j of [ix + 1 < sx ? i + 1 : -1, ix > 0 ? i - 1 : -1, i + sx < n ? i + sx : -1, i - sx])
    if (j >= 0 && comp[j] === main && H[j] - H[i] >= MIN_RISE && H[j] - H[i] <= MAX_RISE) { hi = j; break; }
  if (hi < 0) continue;
  // flood this run of low cells along the foot of the ledge (8-neighbour, same rule)
  const id = ledges.length;
  const run = [i]; seg[i] = id;
  let best = { lo: i, hi, rise: H[hi] - H[i] };
  for (let k = 0; k < run.length; k++) {
    const c = run[k], cx = c % sx;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        const X = cx + dx, Z = Math.floor(c / sx) + dz;
        if (X < 0 || Z < 0 || X >= sx || Z >= sz) continue;
        const d = Z * sx + X;
        if (seg[d] >= 0 || comp[d] !== main) continue;
        let h2 = -1;
        for (const j of [X + 1 < sx ? d + 1 : -1, X > 0 ? d - 1 : -1, d + sx < n ? d + sx : -1, d - sx])
          if (j >= 0 && comp[j] === main && H[j] - H[d] >= MIN_RISE && H[j] - H[d] <= MAX_RISE) { h2 = j; break; }
        if (h2 < 0) continue;
        seg[d] = id; run.push(d);
        if (H[h2] - H[d] > best.rise) best = { lo: d, hi: h2, rise: H[h2] - H[d] };
      }
  }
  ledges.push({ ...best, cells: run.length, detour: 0 });
}
/** A top a column wide (a slot between two houses' walls) is no ground anyone stands on. */
const sliver = (i: number) => {
  // the ground walkable from it within two cells either way: a terrace's corner has nine or more, a slot five
  const ix = i % sx, iz = Math.floor(i / sx), seen = new Set([i]), st = [i];
  while (st.length) {
    const c = st.pop()!, cx = c % sx;
    for (const j of [c + 1, c - 1, c + sx, c - sx]) {
      const jx = j % sx, jz = Math.floor(j / sx);
      if (j < 0 || j >= n || Math.abs(jx - cx) > 1 || Math.abs(jx - ix) > 2 || Math.abs(jz - iz) > 2 || seen.has(j)) continue;
      if (comp[j] !== main || Math.abs(H[j] - H[c]) > STEP) continue;
      seen.add(j); st.push(j);
    }
  }
  return seen.size < 9;
};
const longLedges = ledges.filter((l) => l.cells >= MIN_CONTACT && !wildAt(l.hi) && !sliver(l.hi));
for (const l of longLedges) l.detour = walkDist(l.lo, l.hi, 400);
const blocked = longLedges.filter((l) => l.detour > Math.max(DETOUR, l.cells * V * 3)).sort((a, b) => b.detour - a.detour);

if (edges.length) console.log(`\nthe town's edge: ${edges.length} wild slopes past it rise beside the walk (not counted)`);
console.log(`\nPLATEAUS beside the town that can't be stepped onto: ${plateaus.length}`);
for (const p of plateaus.slice(0, SHOW))
  console.log(`  ${p.cells.toString().padStart(6)} cells, top ${m(p.top)} m, rise ${(p.minRise * V).toFixed(2)}-${(p.rise * V).toFixed(2)} m along ${(p.contact * V).toFixed(1)} m  at ${where(p.at)}`);
console.log(`\nLEDGES with no way up close by: ${blocked.length} (of ${longLedges.length} ledge runs)`);
for (const l of blocked.slice(0, SHOW))
  console.log(`  rise ${(l.rise * V).toFixed(2)} m along ${(l.cells * V).toFixed(1)} m, way round ${Number.isFinite(l.detour) ? l.detour.toFixed(0) + ' m' : 'none'}  foot ${m(H[l.lo])} m at ${where(l.lo)} top${kindAt(l.hi)}`);
// --at x,z[,r]: a walk map around a point, one character per 25 cm cell: '#' can't stand, a..z the town's walk
// network at 0..25 voxels over the lowest cell shown, A..Z the same height off the network ('^' higher still, '_' lower)
const atArg = arg('--at');
if (atArg) {
  const [x, z, r = 8] = atArg.split(',').map(Number);
  const cx = Math.floor((x - ox) / V), cz = Math.floor((z - oz) / V), R = Math.round(r / V);
  let base = 255;
  for (let Z = cz - R; Z <= cz + R; Z++) for (let X = cx - R; X <= cx + R; X++) { const h = H[Z * sx + X]; if (h !== BLOCKED) base = Math.min(base, h); }
  // (centred on the point's own height where the ground shown spans more than the letters do)
  const hc = H[cz * sx + cx];
  if (hc !== BLOCKED) base = Math.max(base, hc - 12);
  console.log(`\nwalk map round (${x}, ${z}), x right, z down; a = ${m(base)} m`);
  for (let Z = cz - R; Z <= cz + R; Z++) {
    let row = '';
    for (let X = cx - R; X <= cx + R; X++) {
      const i = Z * sx + X, h = H[i];
      if (X === cx && Z === cz) { row += '@'; continue; }
      if (h === BLOCKED) { row += '#'; continue; }
      const d = h - base;
      row += d < 0 ? '_' : d > 25 ? '^' : String.fromCharCode((comp[i] === main ? 97 : 65) + d);
    }
    console.log(row);
  }
}
const bad = plateaus.length + blocked.length;
console.log(`\nproblems ${bad}`);
if (process.argv.includes('--json')) {
  const out = { plateaus: plateaus.map((p) => ({ at: at(p.at), cells: p.cells, top: m(p.top), rise: [p.minRise, p.rise] })), ledges: blocked.map((l) => ({ lo: at(l.lo), hi: at(l.hi), rise: l.rise, len: l.cells * V, detour: l.detour })) };
  console.log(JSON.stringify(out));
}
process.exit(bad && !process.argv.includes('--all') ? 1 : 0);
