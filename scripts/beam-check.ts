// CITY=amalfi|istanbul npx tsx scripts/beam-check.ts
// Checks that every great hall's sun beam starts on its window: across the beam's face, just outside its inner face,
// the built grid holds glass wherever the beam's panes let light through (and the panes are that glass's colour),
// and just inside it is air.
import { buildWorld } from '../src/world/bake';
import { V, G } from '../src/world/layout';
import { GLASS_VARY } from '../src/world/palette';

const w = buildWorld();
const { grid, pal } = w;
let bad = 0, total = 0;
for (const h of w.anchors.halls ?? []) {
  let ok = 0;
  h.beams.forEach((b, bi) => {
    const p = b.panes;
    if (!p) return;
    const tx = -b.nz, tz = b.nx;
    for (let j = 0; j < p.rows; j++) for (let i = 0; i < p.cols; i++) {
      const hex = p.rgb[j * p.cols + i];
      // the pane's centre on the inner face, then a quarter voxel into the glass and a quarter voxel into the room
      const a = ((i + 0.5) / p.cols - 0.5) * b.w, up = ((j + 0.5) / p.rows - 0.5) * b.h;
      const fx = b.x + tx * a, fy = b.y + up, fz = b.z + tz * a;
      const at = (d: number) => grid.get(Math.floor((fx + b.nx * d) / V), Math.floor(fy / V + G), Math.floor((fz + b.nz * d) / V));
      const glass = at(V * 0.25), room = at(-V * 0.25);
      total++;
      if (p.cols === 1 && p.rows === 1) {
        // the drum's windows run round a circle: their centre must be glass, the colour the beam carries
        // (within a voxel: the ring is drawn on the grid)
        const near = [-0.25, 0, 0.25].flatMap((o) => [0.25, 0.75].map((d) => grid.get(Math.floor((fx + tx * o + b.nx * V * d) / V), Math.floor(fy / V + G), Math.floor((fz + tz * o + b.nz * V * d) / V))));
        if (!near.some((c) => c && pal.vary[c] >= GLASS_VARY - 0.001)) { bad++; console.log('NOT GLASS', h.id, bi, fx.toFixed(2), fy.toFixed(2), fz.toFixed(2), glass); }
        else ok++;
        continue;
      }
      const isGlass = glass !== 0 && pal.vary[glass] >= GLASS_VARY - 0.001;
      const colour = isGlass ? (pal.r[glass] << 16) | (pal.g[glass] << 8) | pal.b[glass] : -1;
      if (hex >= 0 && (!isGlass || colour !== hex)) { bad++; console.log('PANE OFF GLASS', h.id, bi, i, j, fx.toFixed(2), fy.toFixed(2), fz.toFixed(2), 'grid', glass, colour.toString(16), 'pane', hex.toString(16)); continue; }
      if (hex >= 0 && room !== 0) { bad++; console.log('NO AIR INSIDE', h.id, bi, i, j, fx.toFixed(2), fy.toFixed(2), fz.toFixed(2), room); continue; }
      ok++;
    }
  });
  console.log(h.id, 'beams', h.beams.length, 'panes ok', ok);
}
console.log(bad ? `${bad} of ${total} panes off their windows` : `all ${total} panes on their windows`);
process.exit(bad ? 1 : 0);
