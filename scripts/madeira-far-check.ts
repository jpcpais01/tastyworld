/**
 * The houses round Funchal (world/madeiraFar.ts): every house built with the town's generator has windows and a
 * front door, and what each level of detail costs. CITY=madeira npx tsx scripts/madeira-far-check.ts
 */
import { farMadeira as farCoast } from '../src/engine/farMadeira';
import { WX0, WZ0, WX1, WZ1 } from '../src/world/layout';
import { madeiraFarTown } from '../src/world/madeiraFar';

const v = () => ({ value: null as unknown });
const far = farCoast(new Proxy({}, { get: () => v() }) as never, [WX0, WZ0, WX1, WZ1]);
const town = madeiraFarTown(far.lots);
const t = town as unknown as { c: Record<string, number>; build(i: number): { grid: { sy: number; get(x: number, y: number, z: number): number }; gx0: number; gx1: number; gz0: number; gz1: number } };
const c = t.c;
let bad = 0;
for (let i = 0; i < far.lots.length; i++) {
  const h = t.build(i);
  let glass = 0, door = 0;
  for (let y = 0; y < h.grid.sy; y++) for (let z = h.gz0; z < h.gz1; z++) for (let x = h.gx0; x < h.gx1; x++) {
    const q = h.grid.get(x, y, z);
    if (q === c.glass || q === c.glassLit) glass++;
    else if (q === c.piperno) door++;
  }
  if (glass < 40 || !door) { bad++; console.log('house', i, 'at', far.lots[i].x.toFixed(0), far.lots[i].z.toFixed(0), 'glass', glass, 'door frame', door); }
}
console.log(`${far.lots.length} houses in ${town.tiles.length} tiles; ${bad} without windows or a door`);
const all = town.tiles.map((_, i) => i);
for (const lod of [2, 1, 0]) {
  const t0 = performance.now();
  const ms = lod === 2 ? town.mesh(all, 2) : all.flatMap((i) => town.mesh([i], lod));
  const tris = ms.reduce((a, m) => a + m.mesh.indices.length / 3, 0);
  console.log(`lod ${lod}: ${ms.length} meshes, ${tris} triangles (${(tris / far.lots.length) | 0} a house), tallest atlas ${Math.max(...ms.map((m) => m.mesh.atlas!.height))} rows, ${(performance.now() - t0) | 0} ms`);
}
if (bad) process.exit(1);
