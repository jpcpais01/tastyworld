// Checks every placed prop against the voxel world: sitting on something (not floating or sunk into the
// ground), not buried in walls, and not overlapping other standing props. Run: npm run check:props
import { buildTokyo, Builder, PlacedProp } from '../src/world/tokyo';
import { G, V } from '../src/world/layout';

// name every prop after the line that placed it, so reports point straight at the code
const place = Builder.prototype.place;
Builder.prototype.place = function (this: Builder, ...args: Parameters<typeof place>) {
  const r = place.apply(this, args);
  const site = (new Error().stack ?? '').split('\n').slice(2).find((l) => /world\/(tokyo|interiors)\.ts/.test(l) && !/wallProp|\bput\b/.test(l));
  const m = site?.match(/(\w+)\.ts:(\d+)/);
  const last = this.props[this.props.length - 1];
  if (last && m) (last.prop as unknown as { name: string }).name = `${m[1]}:${m[2]} ${last.prop.sx}x${last.prop.sy}x${last.prop.sz}`;
  return r;
};

const res = buildTokyo();
const g = res.grid;
type Issue = { kind: string; name: string; at: string; detail: string };
const issues: Issue[] = [];
const nameOf = (p: PlacedProp) => (p.prop as unknown as { name?: string }).name ?? `${p.prop.sx}x${p.prop.sy}x${p.prop.sz}@${p.prop.scale}`;
const solidAt = (x: number, y: number, z: number) => g.get(Math.floor(x / V), Math.floor(y / V) + G, Math.floor(z / V)) !== 0;

const boxes: { p: PlacedProp; b: number[] }[] = [];
for (const p of res.props) {
  if (p.tag) continue;
  const pr = p.prop, s = pr.scale;
  const [ox, oy, oz] = p.origin;
  let n = 0, inside = 0, bottom = -1;
  let minX = 1e9, maxX = -1e9, minZ = 1e9, maxZ = -1e9, minY = 1e9;
  for (let y = 0; y < pr.sy; y++) for (let z = 0; z < pr.sz; z++) for (let x = 0; x < pr.sx; x++) {
    if (!pr.get(x, y, z)) continue;
    n++;
    if (bottom < 0) bottom = y;
    const wx = ox + (x + 0.5) * s, wy = oy + (y + 0.5) * s, wz = oz + (z + 0.5) * s;
    if (solidAt(wx, wy, wz)) inside++;
    minY = Math.min(minY, oy + y * s);
    // footprint of the part a person could bump into (the lowest 60 cm)
    if (oy + y * s < minY + 0.6) {
      minX = Math.min(minX, ox + x * s); maxX = Math.max(maxX, ox + (x + 1) * s);
      minZ = Math.min(minZ, oz + z * s); maxZ = Math.max(maxZ, oz + (z + 1) * s);
    }
  }
  if (!n) continue;
  const at = `${((minX + maxX) / 2).toFixed(2)},${minY.toFixed(2)},${((minZ + maxZ) / 2).toFixed(2)}`;
  if (inside / n > 0.12) issues.push({ kind: 'buried', name: nameOf(p), at, detail: `${((inside / n) * 100).toFixed(0)}% inside solid voxels` });
  // standing props: is the floor right under the lowest voxels? (wall-mounted ones float on purpose)
  if (minY < 0.6) {
    let support = 0, cells = 0, sunk = 0;
    for (let y = 0; y < pr.sy; y++) {
      let any = false;
      for (let z = 0; z < pr.sz; z++) for (let x = 0; x < pr.sx; x++) {
        if (!pr.get(x, y, z)) continue;
        any = true; cells++;
        const wx = ox + (x + 0.5) * s, wz = oz + (z + 0.5) * s, wy = oy + y * s;
        if (solidAt(wx, wy - 0.02, wz)) support++;
        if (solidAt(wx, wy + 0.02, wz)) sunk++;
      }
      if (any) break;
    }
    if (cells && support / cells < 0.5 && oy < 0.2) // (hung ones, like the giant chōchin, float on purpose)
      issues.push({ kind: 'floating', name: nameOf(p), at, detail: `${support}/${cells} base voxels on ground` });
    if (cells && sunk / cells > 0.5) issues.push({ kind: 'sunk', name: nameOf(p), at, detail: `${sunk}/${cells} base voxels inside the ground` });
    boxes.push({ p, b: [minX, minZ, maxX, maxZ, minY] });
  }
}
// standing props overlapping each other
for (let i = 0; i < boxes.length; i++)
  for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].b, b = boxes[j].b;
    const ox = Math.min(a[2], b[2]) - Math.max(a[0], b[0]), oz = Math.min(a[3], b[3]) - Math.max(a[1], b[1]);
    if (ox > 0.08 && oz > 0.08 && Math.abs(a[4] - b[4]) < 0.3) issues.push({ kind: 'overlap', name: nameOf(boxes[i].p) + ' + ' + nameOf(boxes[j].p), at: `${((a[0] + a[2]) / 2).toFixed(2)},${((a[1] + a[3]) / 2).toFixed(2)}`, detail: `${ox.toFixed(2)} x ${oz.toFixed(2)} m` });
  }
// the customer's side of every counter stays clear (stools are fine, they are meant to be there)
const isStool = (p: PlacedProp) => p.prop.sx === 3 && p.prop.sy === 4 && p.prop.sz === 3;
const stands: [string, number, number][] = [
  ...res.anchors.stalls.map((st) => [`stall ${st.id}`, st.stand[0], st.stand[1]] as [string, number, number]),
  ...res.anchors.rooms.flatMap((rm) => rm.spots.map((sp) => [`${rm.id} ${sp.kind}`, sp.stand[0], sp.stand[1]] as [string, number, number])),
];
for (const [what, sx, sz] of stands)
  for (const { p, b } of boxes) {
    if (isStool(p)) continue;
    const dx = Math.max(b[0] - sx, 0, sx - b[2]), dz = Math.max(b[1] - sz, 0, sz - b[3]);
    if (Math.hypot(dx, dz) < 0.3) issues.push({ kind: 'counter', name: nameOf(p), at: `${sx.toFixed(2)},${sz.toFixed(2)}`, detail: `in front of ${what}` });
  }
const by: Record<string, number> = {};
for (const i of issues) by[i.kind] = (by[i.kind] ?? 0) + 1;
for (const i of issues) console.log(i.kind.padEnd(9), i.name.padEnd(30), i.at.padEnd(22), i.detail);
console.log('props', res.props.length, 'issues', JSON.stringify(by));
if (process.argv.includes('--strict') && issues.length) process.exit(1);
if (process.argv.includes('--why')) {
  const [qx, qz] = process.argv[process.argv.indexOf('--why') + 1].split(',').map(Number);
  for (const p of res.props) {
    const s = p.prop.scale, [ox, oy, oz] = p.origin;
    if (Math.abs(ox + (p.prop.sx * s) / 2 - qx) > 0.3 || Math.abs(oz + (p.prop.sz * s) / 2 - qz) > 0.3) continue;
    const hits = new Map<string, number>();
    for (let y = 0; y < p.prop.sy; y++) for (let z = 0; z < p.prop.sz; z++) for (let x = 0; x < p.prop.sx; x++) {
      if (!p.prop.get(x, y, z)) continue;
      const vx = Math.floor((ox + (x + 0.5) * s) / V), vy = Math.floor((oy + (y + 0.5) * s) / V) + G, vz = Math.floor((oz + (z + 0.5) * s) / V);
      const v = g.get(vx, vy, vz); if (v) hits.set(`${vx},${vy - G},${vz} pal${v}`, 1);
    }
    console.log('prop', p.prop.sx, p.prop.sy, p.prop.sz, 'hits', [...hits.keys()].slice(0, 12).join(' | '));
  }
}
