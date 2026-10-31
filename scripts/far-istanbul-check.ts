/** Counts the far Istanbul instances and ground triangles: CITY=istanbul npx tsx scripts/far-istanbul-check.ts */
import { farIstanbul } from '../src/engine/farIstanbul';
import { WX0, WZ0, WX1, WZ1 } from '../src/world/layout';

const v = () => ({ value: null as unknown });
const sh = new Proxy({}, { get: () => v() }) as never;
const t0 = performance.now();
const far = farIstanbul(sh, [WX0, WZ0, WX1, WZ1]);
const g = far.houses.geometry as unknown as { instanceCount: number; attributes: Record<string, { data: { array: Float32Array } }> };
const arr = g.attributes.aBox.data.array;
const kinds = new Map<number, number>();
let lod = 0;
for (let i = 0; i < g.instanceCount; i++) {
  const k = arr[i * 12 + 7];
  kinds.set(k, (kinds.get(k) ?? 0) + 1);
  if (arr[i * 12 + 11] > 0) lod++;
}
console.log('instances', g.instanceCount, 'with lod', lod, 'tris', g.instanceCount * 12);
console.log('kinds', [...kinds.entries()].sort((a, b) => a[0] - b[0]).map(([k, n]) => `${k}:${n}`).join(' '));
console.log('ground tris', (far.ground.geometry.attributes.position.count / 3) | 0, 'build ms', (performance.now() - t0).toFixed(0));
