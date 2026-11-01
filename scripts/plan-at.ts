// CITY=amalfi|istanbul npx tsx scripts/plan-at.ts x z r
// The plan round a point (metres): each column's kind (# a house lot) and, beside it, its ground height in voxels
// over the lowest column shown. For working out what ledge-check reports.
import { CITY } from '../src/world/cityId';
import { V, G } from '../src/world/layout';
const mod: any = CITY === 'amalfi' ? await import('../src/world/amalfiPlan') : CITY === 'madeira' ? await import('../src/world/madeiraPlan') : await import('../src/world/istanbulPlan');
const p = CITY === 'amalfi' ? mod.amalfiPlan() : CITY === 'madeira' ? mod.madeiraPlan() : mod.istanbulPlan();
const [x, z, r] = process.argv.slice(2).map(Number);
const cx = Math.floor(x / V), cz = Math.floor(z / V), R = Math.round(r / V);
const ch = '0123456789ABCDEFGHIJ';
console.log('kind map then height (voxel - min) map');
let base = 999;
for (let Z = cz - R; Z <= cz + R; Z++) for (let X = cx - R; X <= cx + R; X++) base = Math.min(base, p.walk[mod.col(X, Z)]);
for (let Z = cz - R; Z <= cz + R; Z++) {
  let a = '', b = '';
  for (let X = cx - R; X <= cx + R; X++) {
    const c = mod.col(X, Z);
    a += p.lot[c] ? '#' : ch[p.kind[c]];
    const d = p.walk[c] - base;
    b += d < 62 ? '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'[d] : '^';
  }
  console.log(a + '  ' + b);
}
console.log('base', ((base - G) * V).toFixed(2));
