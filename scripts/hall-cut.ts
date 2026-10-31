// CITY=amalfi|istanbul npx tsx scripts/hall-cut.ts
// Logic check of the great halls' cutaway: stand inside, look one way then turn, read the cut height met along
// each side just outside the hall's air (one value per side and owner), then watch a side ease over as the view turns.
import * as THREE from 'three';
import { bakeWorld } from '../src/world/bake';
import { Cutaway } from '../src/game/cutaway';
import { V } from '../src/world/layout';
const w = bakeWorld(() => {});
const cut = new Cutaway(w.owners, w.nav, w.interiorNav, { height: w.height, solid: w.solid, ground: w.ground ?? undefined }, { height: w.interiorHeight, solid: w.interiorSolid });
const d = (cut as any).data as Float32Array;
const own = w.owners.world, g = w.nav;
function cutAt(x: number, z: number, fx: number, fz: number): [number, number] {
  const k = Math.floor((x - g.ox) / V), j = Math.floor((z - g.oz) / V);
  const c = j * g.sx + k, id = own.id[c];
  if (!id) return [0, 1e4];
  const C = d.subarray(id * 4, id * 4 + 4), R = d.subarray((64 * 64 + id) * 4, (64 * 64 + id) * 4 + 4), S = d.subarray((64 * 128 + id) * 4, (64 * 128 + id) * 4 + 4);
  if (R[2] > 0) {
    const qx = x - R[0], qz = z - R[1], ex = Math.abs(qx) - R[2], ez = Math.abs(qz) - R[3];
    if (ex <= 0 && ez <= 0) return [id, C[2]];
    const hx = qx < 0 ? S[0] : S[1], hz = qz < 0 ? S[2] : S[3];
    return [id, ex > 0 && ez > 0 ? Math.max(hx, hz) : ex > 0 ? hx : hz];
  }
  if (!own.shell[c]) return [id, C[2]];
  return [id, x * fx + z * fz > C[3] ? C[1] : C[0]];
}
for (const h of w.anchors.halls ?? []) {
  const [x0, z0, x1, z1] = h.rect;
  const p = new THREE.Vector3((x0 + x1) / 2, h.floor, (z0 + z1) / 2);
  for (const [fx, fz] of [[0.6, 0.6], [-0.6, 0.6], [-0.6, -0.6]]) {
    const fwd = new THREE.Vector3(fx, -0.7, fz).normalize();
    for (let t = 0; t < 120; t++) cut.update(1 / 60, p, fwd, false, true);
    // each side: the heights met walking along it just outside the air, 1 m out
    const line = (name: string, pts: [number, number][]) => {
      const hs = new Map<string, number>();
      for (const [x, z] of pts) { const [id, hh] = cutAt(x, z, fx, fz); if (!id) continue; const key = `${id}:${hh >= 1e4 ? 'OFF' : (hh - h.floor).toFixed(2)}`; hs.set(key, (hs.get(key) ?? 0) + 1); }
      console.log(`  ${name}`, [...hs].map(([k, n]) => `${k} x${n}`).join('  '));
    };
    console.log(h.id, 'fwd', fx, fz);
    const pts = (a: [number, number], b: [number, number]) => Array.from({ length: 200 }, (_, i) => [a[0] + (b[0] - a[0]) * i / 199, a[1] + (b[1] - a[1]) * i / 199] as [number, number]);
    for (const off of [0.3, 1.0, 2.5]) {
      line(`-x ${off}`, pts([x0 - off, z0], [x0 - off, z1]));
      line(`+x ${off}`, pts([x1 + off, z0], [x1 + off, z1]));
      line(`-z ${off}`, pts([x0, z0 - off], [x1, z0 - off]));
      line(`+z ${off}`, pts([x0, z1 + off], [x1, z1 + off]));
    }
  }
}
{
  const h = w.anchors.halls![0];
  const [x0, z0, x1, z1] = h.rect;
  const p = new THREE.Vector3((x0 + x1) / 2, h.floor, (z0 + z1) / 2);
  let fwd = new THREE.Vector3(0.6, -0.7, 0.6).normalize();
  for (let t = 0; t < 120; t++) cut.update(1 / 60, p, fwd, false, true);
  fwd = new THREE.Vector3(-0.6, -0.7, 0.6).normalize();
  const out: string[] = [];
  for (let t = 0; t < 36; t++) { cut.update(1 / 60, p, fwd, false, true); if (t % 4 === 0) out.push(`${(t / 60).toFixed(2)}s -x ${(cutAt(x0 - 0.3, (z0 + z1) / 2, -0.6, 0.6)[1] - h.floor).toFixed(2)} +x ${(cutAt(x1 + 0.3, (z0 + z1) / 2, -0.6, 0.6)[1] - h.floor).toFixed(2)}`); }
  console.log(out.join('\n'));
}
