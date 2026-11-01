/**
 * Offline cutaway render of ground-floor rooms (no WebGL): `CITY=x npx tsx scripts/room-shot.ts <out dir> [id-prefix ...]`.
 * Draws the room's voxels and props from above the door, the ceiling and the front wall left off, flat-shaded.
 */
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { buildWorld } from '../src/world/bake';
import { G, V } from '../src/world/layout';

const out = process.argv[2] ?? '.';
const want = process.argv.slice(3).filter((a) => !a.startsWith('--'));
const W = 720, H = 540;
const r = buildWorld();
const { pal } = r;
let grid = r.grid as { get(x: number, y: number, z: number): number }, props = r.props;
const INTERIOR = process.argv.includes('--interior');
if (INTERIOR) {
  // the hidden kitchen: its own grid at the origin, its props placed at INTERIOR_ORIGIN; shift the grid to match
  const [ox, , oz] = (await import('../src/world/layout')).INTERIOR_ORIGIN;
  const ig = r.interior.grid;
  grid = { get: (x, y, z) => ig.get(x - Math.round(ox / V), y, z - Math.round(oz / V)) };
  props = r.interior.props;
  r.anchors.rooms = [{ id: 'hidden', kind: 'cafe', nth: 0, rect: [ox + 0.5, oz + 0.5, ox + 15.5, oz + 11.5], door: [ox + 8, oz + 11.5], npcs: [], spots: [] } as any];
}
const NON = new Set(['shop', 'florist', 'books', 'pharmacy', 'hotel']);

function png(file: string, rgb: Uint8Array) {
  const crcT = new Int32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const crc = (b: Buffer) => { let c = -1; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; };
  const chunk = (t: string, d: Buffer) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const raw = Buffer.alloc((W * 3 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 3 + 1)] = 0; Buffer.from(rgb.buffer, y * W * 3, W * 3).copy(raw, y * (W * 3 + 1) + 1); }
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 2;
  writeFileSync(file, Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}

for (const room of r.anchors.rooms) {
  if (NON.has(room.kind)) continue;
  if (want.length && !want.some((w) => room.id.startsWith(w))) continue;
  const [rx0, rz0, rx1, rz1] = room.rect;
  const cx = (rx0 + rx1) / 2, cz = (rz0 + rz1) / 2;
  // front: the side of the rect the door is nearest
  const dd = [room.door[1] - rz0, rx1 - room.door[0], rz1 - room.door[1], room.door[0] - rx0]; // -z, +x, +z, -x
  const side = dd.indexOf(Math.min(...dd));
  const outV = [[0, -1], [1, 0], [0, 1], [-1, 0]][side];
  // floor: walk up from below at the door until 7 clear layers
  const gx = Math.floor(room.door[0] / V), gz = Math.floor(room.door[1] / V);
  let fy = G - 8;
  for (let y = G - 8; y < G + 120; y++) { let ok = grid.get(gx, y, gz) !== 0; for (let k = 1; k <= 7 && ok; k++) if (grid.get(gx, y + k, gz)) ok = false; if (ok) { fy = y + 1; break; } }
  const floorM = (fy - G) * V;
  const top = fy + 11; // the ceiling slab and above are left off
  // camera: from the front, up and to one side
  const az = Math.atan2(outV[0], outV[1]) + 0.55, el = 0.72;
  const f = [-Math.sin(az) * Math.cos(el), -Math.sin(el), -Math.cos(az) * Math.cos(el)];
  const rt = [Math.cos(az), 0, -Math.sin(az)];
  const up = [rt[1] * f[2] - rt[2] * f[1], rt[2] * f[0] - rt[0] * f[2], rt[0] * f[1] - rt[1] * f[0]];
  const span = Math.max(rx1 - rx0, rz1 - rz0) + 3;
  const s = Math.min(W, H) / (span * 1.15);
  const zb = new Float32Array(W * H).fill(Infinity);
  const img = new Uint8Array(W * H * 3);
  for (let i = 0; i < W * H; i++) { img[i * 3] = 24; img[i * 3 + 1] = 26; img[i * 3 + 2] = 32; }
  const L = [0.35, 0.85, 0.4];
  const quad = (p: number[][], n: number[], col: number) => {
    const nf = n[0] * f[0] + n[1] * f[1] + n[2] * f[2];
    if (nf >= 0) return;
    const sp = p.map((q) => { const x = q[0] - cx, y = q[1] - floorM, z = q[2] - cz; return [W / 2 + (x * rt[0] + y * rt[1] + z * rt[2]) * s, H * 0.55 - (x * up[0] + y * up[1] + z * up[2]) * s, x * f[0] + y * f[1] + z * f[2]]; });
    const lit = 0.5 + 0.5 * Math.max(0, n[0] * L[0] + n[1] * L[1] + n[2] * L[2]);
    const e = pal.emit[col];
    const R = Math.min(255, pal.r[col] * (lit + e)), Gc = Math.min(255, pal.g[col] * (lit + e)), B = Math.min(255, pal.b[col] * (lit + e));
    for (const [a, b, c] of [[0, 1, 2], [0, 2, 3]]) {
      const A = sp[a], Bp = sp[b], C = sp[c];
      const minX = Math.max(0, Math.floor(Math.min(A[0], Bp[0], C[0]))), maxX = Math.min(W - 1, Math.ceil(Math.max(A[0], Bp[0], C[0])));
      const minY = Math.max(0, Math.floor(Math.min(A[1], Bp[1], C[1]))), maxY = Math.min(H - 1, Math.ceil(Math.max(A[1], Bp[1], C[1])));
      const den = (Bp[1] - C[1]) * (A[0] - C[0]) + (C[0] - Bp[0]) * (A[1] - C[1]);
      if (Math.abs(den) < 1e-9) continue;
      for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((Bp[1] - C[1]) * (px - C[0]) + (C[0] - Bp[0]) * (py - C[1])) / den;
        const w1 = ((C[1] - A[1]) * (px - C[0]) + (A[0] - C[0]) * (py - C[1])) / den;
        const w2 = 1 - w0 - w1;
        if (w0 < -1e-4 || w1 < -1e-4 || w2 < -1e-4) continue;
        const z = w0 * A[2] + w1 * Bp[2] + w2 * C[2];
        const i = y * W + x;
        if (z < zb[i]) { zb[i] = z; img[i * 3] = R; img[i * 3 + 1] = Gc; img[i * 3 + 2] = B; }
      }
    }
  };
  const cube = (x0: number, y0: number, z0: number, sz: number, col: number, open: (k: number) => boolean) => {
    const x1 = x0 + sz, y1 = y0 + sz, z1 = z0 + sz;
    if (open(0)) quad([[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], [1, 0, 0], col);
    if (open(1)) quad([[x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0]], [-1, 0, 0], col);
    if (open(2)) quad([[x0, y1, z0], [x0, y1, z1], [x1, y1, z1], [x1, y1, z0]], [0, 1, 0], col);
    if (open(3)) quad([[x0, y0, z0], [x1, y0, z0], [x1, y0, z1], [x0, y0, z1]], [0, -1, 0], col);
    if (open(4)) quad([[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], [0, 0, 1], col);
    if (open(5)) quad([[x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [x1, y0, z0]], [0, 0, -1], col);
  };
  const D6 = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  // the room's columns, a wall's thickness round them; nothing in front of the front wall's inner face
  const vx0 = Math.floor(rx0 / V) - 2, vx1 = Math.ceil(rx1 / V) + 2, vz0 = Math.floor(rz0 / V) - 2, vz1 = Math.ceil(rz1 / V) + 2;
  const keep = (x: number, z: number) => {
    const mx = (x + 0.5) * V, mz = (z + 0.5) * V;
    const along = (mx - cx) * outV[0] + (mz - cz) * outV[1];
    const half = side % 2 === 0 ? (rz1 - rz0) / 2 : (rx1 - rx0) / 2;
    return along < half - 0.05;
  };
  for (let x = vx0; x <= vx1; x++) for (let z = vz0; z <= vz1; z++) {
    if (!keep(x, z)) continue;
    for (let y = fy - 1; y < top; y++) {
      const c = grid.get(x, y, z);
      if (!c) continue;
      cube(x * V, (y - G) * V, z * V, V, c, (k) => { const d = D6[k]; const nx = x + d[0], ny = y + d[1], nz = z + d[2]; return ny >= top || !keep(nx, nz) || grid.get(nx, ny, nz) === 0; });
    }
  }
  for (const p of props) {
    const [ox, oy, oz] = p.origin, g = p.prop.grid, sc = p.prop.scale;
    if (ox > rx1 + 1 || ox + g.sx * sc < rx0 - 1 || oz > rz1 + 1 || oz + g.sz * sc < rz0 - 1) continue;
    if (oy > floorM + 2.8 || oy + g.sy * sc < floorM - 0.3) continue;
    if (!keep(Math.floor((ox + g.sx * sc / 2) / V), Math.floor((oz + g.sz * sc / 2) / V))) continue;
    for (let y = 0; y < g.sy; y++) for (let z = 0; z < g.sz; z++) for (let x = 0; x < g.sx; x++) {
      const c = g.get(x, y, z);
      if (!c) continue;
      cube(ox + x * sc, oy + y * sc, oz + z * sc, sc, c, (k) => { const d = D6[k]; return !g.get(x + d[0], y + d[1], z + d[2]); });
    }
  }
  // people: little markers where the NPCs are
  for (const n of room.npcs) cube(n.pos[0] - 0.12, n.pos[1] + (n.sit ? 0 : 0) , n.pos[2] - 0.12, 0.24, pal.add(n.role === 'keeper' ? 0x2266ff : 0xff22aa), () => true);
  png(`${out}/${room.id}.png`, img);
  console.log('shot', room.id);
}
