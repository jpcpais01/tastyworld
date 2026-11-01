// CITY=neo npx tsx scripts/neo-plan.ts [out.png]: draws Halcyon's ground plan (kinds, levels, lots) to a PNG.
import { neoPlan, K } from '../src/world/neoPlan';
import { SX, SZ, G } from '../src/world/layout';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const t = performance.now();
const p = neoPlan();
console.log('plan ms', (performance.now() - t) | 0, 'segs', p.segs.length, 'lots', p.lots.length, 'nodes', p.nodes.length, 'edges', p.edges.length);
const by: Record<string, number> = {};
for (const l of p.lots) by[`${l.d}:${l.use}`] = (by[`${l.d}:${l.use}`] ?? 0) + 1;
console.log(by);
const S = 2, W = SX / S, H = SZ / S;
const img = Buffer.alloc(W * H * 3);
const KC: Record<number, [number, number, number]> = {
  [K.Ground]: [90, 80, 70], [K.Water]: [30, 50, 90], [K.Quay]: [150, 150, 140], [K.Plaza]: [90, 220, 240], [K.Avenue]: [230, 230, 230], [K.Street]: [200, 200, 190],
  [K.Lane]: [170, 160, 150], [K.Stair]: [240, 200, 60], [K.Bridge]: [240, 120, 200], [K.Lot]: [0, 0, 0], [K.Deck]: [255, 80, 80], [K.Pier]: [120, 100, 80],
};
for (let z = 0; z < H; z++)
  for (let x = 0; x < W; x++) {
    const c = z * S * SX + x * S, k = p.kind[c];
    const lv = Math.max(0, p.walk[c] - G) / 4; // metres
    let col = KC[k] ?? [255, 0, 255];
    if (k === K.Lot) { const l = p.lots[p.lot[c] - 1]; const h = (l.seed % 7) * 10; const edge = p.lot[c] !== p.lot[c + 1] || p.lot[c] !== p.lot[c + SX]; col = edge ? [20, 20, 20] : [40 + h + lv * 5, 30 + lv * 6, 60 + lv * 4]; }
    else if (k === K.Ground) col = [60 + lv * 5, 55 + lv * 4, 45 + lv * 3];
    const sh = k === K.Lot || k === K.Ground ? 1 : 0.7 + Math.min(0.3, lv / 50);
    const i = (z * W + x) * 3; img[i] = Math.min(255, col[0] * sh); img[i + 1] = Math.min(255, col[1] * sh); img[i + 2] = Math.min(255, col[2] * sh);
  }
const table = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
const crc = (b: Buffer) => { let c = ~0; for (let i = 0; i < b.length; i++) c = table[(c ^ b[i]) & 255] ^ (c >>> 8); return ~c >>> 0; };
const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
const raw = Buffer.alloc(H * (W * 3 + 1));
for (let z = 0; z < H; z++) img.copy(raw, z * (W * 3 + 1) + 1, z * W * 3, (z + 1) * W * 3);
const hdr = Buffer.alloc(13); hdr.writeUInt32BE(W, 0); hdr.writeUInt32BE(H, 4); hdr[8] = 8; hdr[9] = 2;
writeFileSync(process.argv[2] ?? 'neo-plan.png', Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', hdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
