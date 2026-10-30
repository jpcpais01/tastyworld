// Rasterises the app icon (a steaming red bowl on a twilight tile) into PNGs without dependencies.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => { let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const c = Buffer.alloc(4); c.writeUInt32BE(crc(td));
  return Buffer.concat([len, td, c]);
}
function png(w, h, rgba) {
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++) { raw[y * (w * 4 + 1)] = 0; rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4); }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
const hex = (h) => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));

/** Signed-distance helpers in a 512 unit space. */
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => { const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r; };
const sdEllipse = (x, y, cx, cy, rx, ry) => (Math.hypot((x - cx) / rx, (y - cy) / ry) - 1) * Math.min(rx, ry);

function shade(x, y, maskable) {
  // layers painted back to front: [colour, coverage]
  let col = [0, 0, 0], a = 0;
  const over = (c, cov) => { col = mix(col, c, cov); a = a + (1 - a) * cov; };
  const aa = (d) => clamp(0.5 - d / 1.2);
  const tile = maskable ? -1 : sdRoundRect(x, y, 256, 256, 256, 256, 112);
  const bgT = clamp(Math.hypot(x - 256, y - 150) / 420);
  over(mix(hex(0x4a3576), hex(0x1b1430), bgT), aa(tile));
  const s = maskable ? 0.8 : 1; // keep the art inside the maskable safe zone
  const X = (x - 256) / s + 256, Y = (y - 256) / s + 256 + (maskable ? 10 : 0);
  // steam
  for (const sx of [196, 256, 316]) {
    if (Y < 50 || Y > 200) continue;
    const t = (200 - Y) / 150;
    const cx = sx + Math.sin(t * Math.PI * 2) * 22;
    const d = Math.abs(X - cx) - 11;
    over(hex(0xfff3e0), aa(d / s) * 0.85 * clamp(1.2 - t * 0.3));
  }
  over(hex(0x7a3a1c), aa(sdEllipse(X, Y, 256, 262, 172, 34) / s));
  over(hex(0xf2d88a), aa(sdEllipse(X, Y, 256, 256, 160, 22) / s));
  // bowl body: lower half-ellipse
  if (Y >= 262) {
    const d = sdEllipse(X, Y, 256, 262, 172, 160);
    over(mix(hex(0xea5a3e), hex(0xa92f22), clamp((Y - 262) / 160)), aa(d / s));
  }
  over(hex(0xfff3e0), aa(sdRoundRect(X, Y, 256, 327, 56, 27, 12) / s) * 0.92);
  over(hex(0xbc002d), aa((Math.hypot(X - 256, Y - 327) - 15) / s));
  return [...col, a];
}

function render(size, maskable) {
  const buf = Buffer.alloc(size * size * 4);
  const ss = 3;
  for (let py = 0; py < size; py++)
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, al = 0;
      for (let j = 0; j < ss; j++)
        for (let i = 0; i < ss; i++) {
          const [cr, cg, cb, ca] = shade(((px + (i + 0.5) / ss) / size) * 512, ((py + (j + 0.5) / ss) / size) * 512, maskable);
          r += cr * ca; g += cg * ca; b += cb * ca; al += ca;
        }
      const o = (py * size + px) * 4;
      buf[o] = al ? Math.round(r / al) : 0; buf[o + 1] = al ? Math.round(g / al) : 0; buf[o + 2] = al ? Math.round(b / al) : 0;
      buf[o + 3] = Math.round((al / (ss * ss)) * 255);
    }
  return png(size, size, buf);
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', render(192, false));
writeFileSync('public/icons/icon-512.png', render(512, false));
writeFileSync('public/icons/icon-maskable-512.png', render(512, true));
console.log('icons written');
