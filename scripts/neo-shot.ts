/**
 * Offline oblique render of the whole of Halcyon City (no WebGL): `CITY=neo npx tsx scripts/neo-shot.ts out.png [step]`.
 * Looks north from over the south edge, every `step`-th voxel column drawn as a stack of voxels, flat-shaded by face.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { buildWorld } from '../src/world/bake';

const out = process.argv[2] ?? 'neo.png';
const step = Number(process.argv[3] ?? 2);
const r = buildWorld();
const { grid, pal } = r;
const x0 = grid.wx0, x1 = grid.wx1, z0 = grid.wz0, z1 = grid.wz1, sy = grid.sy;
const K = 0.6; // depth foreshortening: screen rows per voxel of z
const W = Math.ceil((x1 - x0) / step), H = Math.ceil(((z1 - z0) * K + sy) / step);
const rgb = new Uint8Array(W * H * 3).fill(18);
const shade = (c: number, f: number, o: number) => {
  const e = pal.emit[c] ?? 0;
  rgb[o] = Math.min(255, pal.r[c] * (f + e)); rgb[o + 1] = Math.min(255, pal.g[c] * (f + e)); rgb[o + 2] = Math.min(255, pal.b[c] * (f + e));
};
for (let z = z0; z < z1; z += step)
  for (let x = x0; x < x1; x += step) {
    const sx = ((x - x0) / step) | 0;
    for (let y = 0; y < sy; y++) {
      const c = grid.get(x, y, z);
      if (!c) continue;
      // a face shows if the voxel above or in front is empty: tops lighter, fronts darker
      const top = !grid.get(x, y + 1, z), front = !grid.get(x, y, z + step);
      if (!top && !front) continue;
      const sr = Math.floor(((z - z0) * K + (sy - y)) / step);
      if (sr < 0 || sr >= H) continue;
      shade(c, top ? 1.0 : 0.62, (sr * W + sx) * 3);
    }
  }
const raw = Buffer.alloc((W * 3 + 1) * H);
for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b: Buffer) => { let c = -1; for (const v of b) c = crcT[(c ^ v) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
writeFileSync(out, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
console.log('wrote', out, W, H);
