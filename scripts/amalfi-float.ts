// CITY=amalfi npx tsx scripts/amalfi-float.ts [--all]
// Finds what floats in Amalfi: clumps of voxels in the world grid that touch nothing connected to the ground
// (a leaf, a lemon, a post hanging in the air), and props whose feet stand on nothing and touch no wall.
import { Builder, PlacedProp } from '../src/world/tokyo';
import { buildAmalfi } from '../src/world/amalfi';
import { Palette } from '../src/world/palette';
import { CITY } from '../src/world/cityId';
import { G, V } from '../src/world/layout';

if (CITY !== 'amalfi') { console.error('run with CITY=amalfi'); process.exit(1); }
const hexOf: number[] = [];
const add = Palette.prototype.add;
Palette.prototype.add = function (this: Palette, hex: number, ...rest: Parameters<typeof add> extends [number, ...infer R] ? R : never) {
  const i = add.call(this, hex, ...rest);
  hexOf[i] = hex;
  return i;
};
// name every prop after the line that placed it
const place = Builder.prototype.place;
Builder.prototype.place = function (this: Builder, ...args: Parameters<typeof place>) {
  const r = place.apply(this, args);
  const site = (new Error().stack ?? '').split('\n').slice(2).find((l) => /world\/amalfi\.ts/.test(l));
  const m = site?.match(/amalfi\.ts:(\d+)/);
  const last = this.props[this.props.length - 1];
  if (last && m) (last.prop as unknown as { name: string }).name = `amalfi:${m[1]} ${last.prop.sx}x${last.prop.sy}x${last.prop.sz}`;
  return r;
};

const t0 = performance.now();
const res = buildAmalfi();
const g = res.grid;
console.log('built in', ((performance.now() - t0) / 1000).toFixed(1), 's');
const SXg = g.sx, SYg = g.sy, SZg = g.sz;
const at = (x: number, y: number, z: number) => (y * SZg + z) * SXg + x;
const solid = new Uint8Array(SXg * SYg * SZg);
for (let y = 0; y < SYg; y++) for (let z = 0; z < SZg; z++) for (let x = 0; x < SXg; x++) if (g.get(x + g.x0, y, z + g.z0)) solid[at(x, y, z)] = 1;
// flood from the bottom layer: everything reached stands on the ground
const Q = 1 << 24, q = new Int32Array(Q);
let head = 0, tail = 0;
const push = (i: number) => { solid[i] = 2; q[tail] = i; tail = (tail + 1) % Q; };
for (let z = 0; z < SZg; z++) for (let x = 0; x < SXg; x++) if (solid[at(x, 0, z)] === 1) push(at(x, 0, z));
const flood = (onCell?: (i: number) => void) => {
  while (head !== tail) {
    const i = q[head]; head = (head + 1) % Q;
    onCell?.(i);
    const x = i % SXg, z = Math.floor(i / SXg) % SZg, y = Math.floor(i / (SXg * SZg));
    if (x > 0 && solid[i - 1] === 1) push(i - 1);
    if (x < SXg - 1 && solid[i + 1] === 1) push(i + 1);
    if (z > 0 && solid[i - SXg] === 1) push(i - SXg);
    if (z < SZg - 1 && solid[i + SXg] === 1) push(i + SXg);
    if (y > 0 && solid[i - SXg * SZg] === 1) push(i - SXg * SZg);
    if (y < SYg - 1 && solid[i + SXg * SZg] === 1) push(i + SXg * SZg);
  }
};
flood();
type Clump = { n: number; x: number; y: number; z: number; hex: Map<number, number> };
const clumps: Clump[] = [];
for (let i = 0; i < solid.length; i++) {
  if (solid[i] !== 1) continue;
  const c: Clump = { n: 0, x: 0, y: 0, z: 0, hex: new Map() };
  push(i);
  flood((j) => {
    const x = j % SXg, z = Math.floor(j / SXg) % SZg, y = Math.floor(j / (SXg * SZg));
    c.n++; c.x += x; c.y += y; c.z += z;
    const h = hexOf[g.get(x + g.x0, y, z + g.z0)] ?? -1;
    c.hex.set(h, (c.hex.get(h) ?? 0) + 1);
  });
  clumps.push(c);
}
const byHex = new Map<number, { clumps: number; voxels: number }>();
for (const c of clumps) for (const [h, n] of c.hex) { const e = byHex.get(h) ?? { clumps: 0, voxels: 0 }; e.clumps++; e.voxels += n; byHex.set(h, e); }
console.log(`floating clumps in the grid: ${clumps.length} (${clumps.reduce((s, c) => s + c.n, 0)} voxels)`);
for (const [h, e] of [...byHex].sort((a, b) => b[1].clumps - a[1].clumps)) console.log(`  #${h.toString(16).padStart(6, '0')}  ${e.clumps} clumps, ${e.voxels} voxels`);
const show = process.argv.includes('--all') ? clumps : clumps.sort((a, b) => b.n - a.n).slice(0, 25);
for (const c of show) {
  const m = (v: number) => (v / c.n);
  const hx = [...c.hex].sort((a, b) => b[1] - a[1]).map(([h, n]) => `#${h.toString(16)}x${n}`).join(' ');
  console.log(`  ${c.n} voxels at ${((m(c.x) + g.x0) * V).toFixed(1)}, ${((m(c.y) - G) * V).toFixed(1)}, ${((m(c.z) + g.z0) * V).toFixed(1)} m  ${hx}`);
}

// props: the lowest layer should rest on something, unless the prop hangs on a wall
const solidAt = (x: number, y: number, z: number) => g.get(Math.floor(x / V), Math.floor(y / V) + G, Math.floor(z / V)) !== 0;
const bad: string[] = [];
const nameOf = (p: PlacedProp) => (p.prop as unknown as { name?: string }).name ?? `${p.prop.sx}x${p.prop.sy}x${p.prop.sz}`;
for (const p of res.props) {
  if (p.tag) continue;
  const pr = p.prop, s = pr.scale, [ox, oy, oz] = p.origin;
  let touches = false, base = -1, cells = 0, support = 0;
  for (let y = 0; y < pr.sy && !touches; y++) for (let z = 0; z < pr.sz && !touches; z++) for (let x = 0; x < pr.sx; x++) {
    if (!pr.get(x, y, z)) continue;
    const wx = ox + (x + 0.5) * s, wy = oy + (y + 0.5) * s, wz = oz + (z + 0.5) * s;
    // touching a wall at the side or a ceiling above: mounted, not standing
    if (solidAt(wx + s * 0.5 + 0.02, wy, wz) || solidAt(wx - s * 0.5 - 0.02, wy, wz) || solidAt(wx, wy, wz + s * 0.5 + 0.02) || solidAt(wx, wy, wz - s * 0.5 - 0.02) || solidAt(wx, wy + s * 0.5 + 0.02, wz)) { touches = true; break; }
    if (base < 0) base = y;
    if (y === base) { cells++; if (solidAt(wx, oy + y * s - 0.05, wz) || solidAt(wx, oy + y * s - 0.2, wz)) support++; }
  }
  if (touches || !cells) continue;
  if (support === 0) bad.push(`${nameOf(p).padEnd(28)} at ${ox.toFixed(2)}, ${oy.toFixed(2)}, ${oz.toFixed(2)}`);
}
console.log(`props standing on nothing: ${bad.length} of ${res.props.length}`);
for (const l of bad.slice(0, process.argv.includes('--all') ? 1e9 : 40)) console.log('  ' + l);

// --where: build again, noting the line of amalfi.ts that last wrote each floating voxel
if (process.argv.includes('--where')) {
  const { SparseGrid } = await import('../src/world/grid');
  const targets: [number, number, number, number][] = [];
  const tag = new Map<number, string>();
  {
    // (the clump search marked the floating voxels too, so flood from the floor once more)
    const s2 = new Uint8Array(solid.length);
    for (let i = 0; i < solid.length; i++) if (solid[i]) s2[i] = 1;
    const st: number[] = [];
    for (let z = 0; z < SZg; z++) for (let x = 0; x < SXg; x++) { const i = at(x, 0, z); if (s2[i] === 1) { s2[i] = 2; st.push(i); } }
    while (st.length) {
      const i = st.pop()!;
      const x = i % SXg, z = Math.floor(i / SXg) % SZg, y = Math.floor(i / (SXg * SZg));
      for (const j of [x > 0 ? i - 1 : -1, x < SXg - 1 ? i + 1 : -1, z > 0 ? i - SXg : -1, z < SZg - 1 ? i + SXg : -1, y > 0 ? i - SXg * SZg : -1, y < SYg - 1 ? i + SXg * SZg : -1])
        if (j >= 0 && s2[j] === 1) { s2[j] = 2; st.push(j); }
    }
    for (let i = 0; i < s2.length; i++) if (s2[i] === 1) {
      const x = i % SXg, z = Math.floor(i / SXg) % SZg, y = Math.floor(i / (SXg * SZg));
      targets.push([x + g.x0, y, z + g.z0, i]);
    }
  }
  // the two innermost lines of amalfi.ts on the stack (a helper and its caller)
  const site = () => (new Error().stack ?? '').split('\n').filter((s) => /world\/amalfi\.ts/.test(s)).slice(0, 2).map((l) => l.match(/amalfi\.ts:(\d+)/)?.[1]).join('<');
  const keys = new Set(targets.map(([x, y, z]) => `${x},${y},${z}`));
  const set0 = SparseGrid.prototype.set, box0 = SparseGrid.prototype.box;
  SparseGrid.prototype.set = function (this: InstanceType<typeof SparseGrid>, x: number, y: number, z: number, v: number) {
    if (v && keys.has(`${x | 0},${y | 0},${z | 0}`)) tag.set(((y | 0) * 1e6 + (z | 0) * 1e3 + (x | 0)), site());
    return set0.call(this, x, y, z, v);
  };
  SparseGrid.prototype.box = function (this: InstanceType<typeof SparseGrid>, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, v: number | ((x: number, y: number, z: number) => number)) {
    if (typeof v === 'number' && v) {
      const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1), az = Math.min(z0, z1), bz = Math.max(z0, z1);
      for (const [x, y, z] of targets) if (x >= ax && x <= bx && y >= ay && y <= by && z >= az && z <= bz) tag.set(y * 1e6 + z * 1e3 + x, site());
    }
    return box0.call(this, x0, y0, z0, x1, y1, z1, v);
  };
  buildAmalfi();
  const bySite = new Map<string, { n: number; at: string }>();
  for (const [x, y, z] of targets) {
    const ln = tag.get(y * 1e6 + z * 1e3 + x) ?? '?';
    const e = bySite.get(ln) ?? { n: 0, at: `${(x * V).toFixed(1)},${((y - G) * V).toFixed(1)},${(z * V).toFixed(1)}` };
    e.n++; bySite.set(ln, e);
  }
  console.log('floating voxels by the amalfi.ts line that wrote them:');
  for (const [ln, e] of [...bySite].sort((a, b) => b[1].n - a[1].n)) console.log(`  line ${ln}: ${e.n} voxels, e.g. at ${e.at}`);
}
