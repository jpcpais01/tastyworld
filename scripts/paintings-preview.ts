// npx tsx scripts/paintings-preview.ts <out dir>
// Writes the Duomo's paintings (world/paintings.ts) as PNGs, eight pixels per fine voxel, to look them over.
import { paintColors, altarpiece, apostle, ceilingScene, sideAltar, fresco, medallion, picture, Img } from '../src/world/paintings';
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
const hex: number[] = [0];
const b = { pal: { add: (h: number) => { hex.push(h); return hex.length - 1; } } } as never;
const k = paintColors(b);
function png(im: Img, file: string, S = 8) {
  const W = im.w * S, H = im.h * S;
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) {
    raw[y * (W * 3 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const c = hex[im.get(Math.floor(x / S), im.h - 1 - Math.floor(y / S))] ?? 0xff00ff;
      const o = y * (W * 3 + 1) + 1 + x * 3;
      raw[o] = c >> 16; raw[o + 1] = (c >> 8) & 255; raw[o + 2] = c & 255;
    }
  }
  const crc = (buf: Buffer) => { let c = ~0; for (const x of buf) { c ^= x; for (let i = 0; i < 8; i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
const out = process.argv[2];
png(altarpiece(k, 24, 50), `${out}/altar.png`, 12);
for (let i = 0; i < 5; i++) png(ceilingScene(k, i, 20, 36), `${out}/ceil${i}.png`);
for (let i = 0; i < 5; i++) png(apostle(k, 20, 34, i), `${out}/apostle${i}.png`);
for (let i = 0; i < 2; i++) png(sideAltar(k, i, 12, 28), `${out}/side${i}.png`);
for (let i = 0; i < 4; i++) png(fresco(k, 16, 16, i), `${out}/fresco${i}.png`);
png(fresco(k, 6, 16, 1), `${out}/fresco-narrow.png`);
for (let i = 0; i < 2; i++) png(medallion(k, 20, 18, i), `${out}/medallion${i}.png`);
png(picture(k, 'coast', 12, 8, 1), `${out}/pic-coast.png`);
png(picture(k, 'coast', 18, 8, 2), `${out}/pic-coast-wide.png`);
png(picture(k, 'lemons', 18, 8, 3), `${out}/pic-lemons.png`);
png(picture(k, 'bosphorus', 12, 8, 1), `${out}/pic-bosphorus.png`);
png(picture(k, 'madonna', 6, 9, 1), `${out}/pic-madonna.png`);
png(picture(k, 'fuji', 10, 16, 1, true), `${out}/pic-fuji.png`);
png(picture(k, 'plum', 6, 12, 1, true), `${out}/pic-plum.png`);
png(picture(k, 'fuji', 10, 10, 1), `${out}/pic-fuji-print.png`);
png(picture(k, 'wave', 6, 6, 1), `${out}/pic-wave.png`);
png(picture(k, 'fuji', 6, 6, 2), `${out}/pic-fuji-small.png`);
