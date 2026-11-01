// Top-down picture of Funchal's ground plan (heights shaded, paths and lots coloured), for layout work.
import { writeFileSync } from 'fs';
import { madeiraPlan, K } from '../src/world/madeiraPlan';
import { SX, SZ, G } from '../src/world/layout';
const p = madeiraPlan();
const out = Buffer.alloc(SX * SZ * 3);
const pal: Record<number, [number, number, number]> = {
  [K.Rock]: [120, 110, 90], [K.Sea]: [40, 90, 150], [K.Sand]: [200, 190, 160], [K.Quay]: [170, 170, 170], [K.Road]: [60, 60, 66], [K.Walk]: [190, 190, 190],
  [K.Piazza]: [230, 220, 200], [K.Street]: [240, 200, 120], [K.Stair]: [255, 120, 80], [K.Lane]: [250, 240, 150], [K.Garden]: [90, 150, 60], [K.Lot]: [230, 160, 140],
  [K.Tunnel]: [20, 20, 20], [K.Covered]: [150, 60, 150], [K.Pier]: [200, 200, 210], [K.Steps]: [255, 80, 160], [K.Shingle]: [140, 135, 125], [K.Church]: [250, 250, 255], [K.Channel]: [20, 140, 200],
};
for (let i = 0; i < SX * SZ; i++) {
  const c = pal[p.kind[i]] ?? [255, 0, 255];
  const h = (p.walk[i] - G) / 160;
  const f = 0.55 + 0.45 * Math.min(1, Math.max(0, h));
  const lotEdge = p.lot[i] && (p.lot[i - 1] !== p.lot[i] || p.lot[i - SX] !== p.lot[i]);
  out[i * 3] = lotEdge ? 60 : c[0] * f; out[i * 3 + 1] = lotEdge ? 40 : c[1] * f; out[i * 3 + 2] = lotEdge ? 30 : c[2] * f;
}
writeFileSync(process.argv[2] ?? 'plan.ppm', Buffer.concat([Buffer.from(`P6 ${SX} ${SZ} 255\n`), out]));
console.log('lots', p.lots.length, 'segs', p.segs.length, 'nodes', p.nodes.length);
const steep = p.segs.filter((s) => { const l = Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]); return l > 0 && Math.abs(s.b[1] - s.a[1]) / l > 0.75; });
console.log('steep segs', steep.map((s) => `${s.a.map((v) => v.toFixed(0))}->${s.b.map((v) => v.toFixed(0))}`).join(' | '));
import { FOOD_MISSED } from '../src/world/madeiraPlan';
console.log('missed', FOOD_MISSED.join(' | '));
console.log('food/hotel lots', p.lots.filter((l) => l.food || l.hotel || l.secret).map((l) => l.food ?? l.hotel ?? 'secret').join(' '));
