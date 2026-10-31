// CITY=amalfi|istanbul npx tsx scripts/hall-map.ts
// Prints a walk map of each great hall: '#' blocked, '+' walkable but not reached from the spawn, '.' reached,
// 'o' a hall person's spot.
import { bakeWorld } from '../src/world/bake';
import { Nav } from '../src/game/nav';

const w = bakeWorld(() => {});
const a = w.anchors;
const nav = new Nav(w.nav);
const [sx, , sz] = a.spawn;
for (const h of a.halls ?? []) {
  const [x0, z0, x1, z1] = h.rect;
  console.log(h.id, h.rect.map((v) => v.toFixed(1)).join(','));
  const step = 0.5;
  const rows: string[] = [];
  for (let z = z0 - 2; z <= z1 + 3; z += step) {
    let row = '';
    for (let x = x0 - 2; x <= x1 + 4; x += step) {
      const person = h.people.some((p) => Math.abs(p.pos[0] - x) < step / 2 && Math.abs(p.pos[2] - z) < step / 2);
      if (person) { row += 'o'; continue; }
      if (!nav.walkable(x, z)) { row += '#'; continue; }
      const p = nav.findPath(sx, sz, x, z);
      const ok = p && p.length && Math.hypot(p[p.length - 1][0] - x, p[p.length - 1][1] - z) < 0.6;
      row += ok ? '.' : '+';
    }
    rows.push(row);
  }
  console.log(rows.join('\n'));
}
