// How often does a coarse LOD chunk show a different colour on top than the full-detail world?
// Run per city: CITY=tokyo npx tsx scripts/lod-top-check.ts
import { bakeWorld, coarsen } from '../src/world/bake';
import { CHUNK, CHUNKS_X, CHUNKS_Z, G, VX0, VZ0 } from '../src/world/layout';

const w = bakeWorld();
const res = (w.part as any).res;
const grid = res.grid, pal = res.pal;
const dist = (a: number, b: number) => !a ? 999 : Math.abs(pal.r[a] - pal.r[b]) + Math.abs(pal.g[a] - pal.g[b]) + Math.abs(pal.b[a] - pal.b[b]);
const hex = (c: number) => ((pal.r[c] << 16) | (pal.g[c] << 8) | pal.b[c]).toString(16).padStart(6, '0');
for (const f of [2, 4]) {
  let cols = 0, bad = 0;
  const pairs = new Map<string, number>();
  for (let iz = 0; iz < CHUNKS_Z; iz++) for (let ix = 0; ix < CHUNKS_X; ix++) {
    const x0 = VX0 + ix * CHUNK, z0 = VZ0 + iz * CHUNK;
    const fine = grid.extract(x0 - f + 1, x0 + CHUNK + f - 1, z0 - f + 1, z0 + CHUNK + f - 1, G);
    const coarse = coarsen(fine, f);
    // fine column (fx, fz) in chunk space -> dense index fx + f, coarse cell (fx / f) + 1
    for (let fz = 0; fz < CHUNK; fz++) for (let fx = 0; fx < CHUNK; fx++) {
      let top = 0;
      for (let y = fine.sy - 1; y >= 0; y--) { const v = fine.get(fx + f, y, fz + f); if (v) { top = v; break; } }
      if (!top) continue;
      const cx = (fx >> (f === 2 ? 1 : 2)) + 1, cz = (fz >> (f === 2 ? 1 : 2)) + 1;
      let ct = 0;
      for (let y = coarse.sy - 1; y >= 0; y--) { const v = coarse.get(cx, y, cz); if (v) { ct = v; break; } }
      cols++;
      if (dist(ct, top) > 60) {
        bad++;
        const k = `${hex(top)} -> ${ct ? hex(ct) : 'none'}`;
        pairs.set(k, (pairs.get(k) ?? 0) + 1);
      }
    }
  }
  console.log(`f=${f}: ${((bad / cols) * 100).toFixed(1)}% of columns show a clearly different top colour (or none)`);
  console.log([...pairs].sort((a, b) => b[1] - a[1]).slice(0, 14).map(([k, n]) => `  ${k}  ${(n / cols * 100).toFixed(2)}%`).join('\n'));
}
