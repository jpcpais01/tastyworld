// Top-down picture of Amalfi's ground plan (heights shaded, paths and lots coloured), for layout work.
import { writeFileSync } from 'fs';
import { istanbulPlan, K } from '../src/world/istanbulPlan';
import { SX, SZ, G } from '../src/world/layout';
const p = istanbulPlan();
const out = Buffer.alloc(SX * SZ * 3);
const pal: Record<number, [number, number, number]> = {
  [K.Ground]: [120, 110, 90], [K.Sea]: [40, 90, 150], [K.Quay]: [170, 170, 170], 
  [K.Square]: [230, 220, 200], [K.Street]: [240, 200, 120], [K.Stair]: [255, 120, 80], [K.Lane]: [250, 240, 150], [K.Lot]: [230, 160, 140],
  [K.Covered]: [150, 60, 150], [K.Pier]: [200, 200, 210], [K.Steps]: [255, 80, 160], [K.Bridge]: [90, 90, 120], [K.Court]: [255, 255, 200], [K.Park]: [80, 160, 70], [K.Terrace]: [200, 230, 160], [K.Tram]: [120, 120, 150], [K.Mosque]: [250, 250, 255],
};
for (let i = 0; i < SX * SZ; i++) {
  const c = pal[p.kind[i]] ?? [255, 0, 255];
  const h = (p.walk[i] - G) / 70;
  const f = 0.55 + 0.45 * Math.min(1, Math.max(0, h));
  const lotEdge = p.lot[i] && (p.lot[i - 1] !== p.lot[i] || p.lot[i - SX] !== p.lot[i]);
  out[i * 3] = lotEdge ? 60 : c[0] * f; out[i * 3 + 1] = lotEdge ? 40 : c[1] * f; out[i * 3 + 2] = lotEdge ? 30 : c[2] * f;
}
writeFileSync(process.argv[2] ?? 'plan.ppm', Buffer.concat([Buffer.from(`P6 ${SX} ${SZ} 255\n`), out]));
console.log('lots', p.lots.length, 'segs', p.segs.length, 'nodes', p.nodes.length);
const steep = p.segs.filter((s) => { const l = Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]); return l > 0 && Math.abs(s.b[1] - s.a[1]) / l > 0.75; });
console.log('steep segs', steep.map((s) => `${s.a.map((v) => v.toFixed(0))}->${s.b.map((v) => v.toFixed(0))}`).join(' | '));
const uses: Record<string, number> = {};
for (const l of p.lots) uses[`${l.use}/${l.on}`] = (uses[`${l.use}/${l.on}`] ?? 0) + 1;
console.log('uses', JSON.stringify(uses));
import { hillY } from '../src/world/istanbulPlan';
for (const [x, z] of [[-140, -8], [-126, -71], [-100, 30], [-60, 0], [-20, -60], [0, -100], [-120, 20], [-112, -30], [-94, -44], [-48, -26]]) console.log('hill', x, z, hillY(x, z).toFixed(2));
