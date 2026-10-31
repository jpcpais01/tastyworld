// The city around the original district: avenues and lanes, the station under the railway viaduct, a
// shrine wood, a neon quarter of tall buildings, a covered shopping arcade, a park with a pond and an Inari
// hill with a tunnel of torii. Everything here is in builder voxel coordinates (x * V metres) unless noted.
//
// Every worker runs this with only its own strip of voxels (see Builder), so nothing that ends up in the
// anchors may depend on reading the grid.
import { hash3, rng } from './grid';
import { G, V, VX0, VZ0, SX, SZ, HILL } from './layout';
import { SWAY } from './sway';
import { dress, noteFront, noteGarden, noteTree } from './dressing';
import { wrapLot } from './facades';
import { tokyoEdge } from './tokyoEdge';
import { Builder, Lot, building, tiledRoof, sakuraTree, bridge, boat, surface, RED, WARM, WHITEWARM, COOL, Ground, Style, Side, BuildingOpts, hotelize } from './tokyo';
import {
  glyph, lantern, streetLamp, bench, vendingMachine, bicycle, stoneLantern, plantPot, postBox, boardSign, noren, nobori,
  scooter, binCorner, acUnit, crateStack, stool, wire, bollard, jizo,
} from './props';

const XW = VX0, XE = VX0 + SX - 1, ZN = VZ0, ZS = VZ0 + SZ - 1;

type Kind = 'avenue' | 'street' | 'lane' | 'alley' | 'arcade';
/** Inclusive voxel rect; `ew` streets run east-west. */
export interface Street { name: string; kind: Kind; x0: number; z0: number; x1: number; z1: number; ew: boolean }

export const STREETS: Street[] = [
  { name: 'Hikari-dori', kind: 'avenue', x0: XW, z0: -112, x1: XE, z1: -73, ew: true },
  { name: 'Minami-dori', kind: 'street', x0: XW, z0: 224, x1: XE, z1: 259, ew: true },
  { name: 'Ura-michi', kind: 'lane', x0: -1, z0: -24, x1: 288, z1: -1, ew: true },
  { name: 'Center-gai', kind: 'street', x0: 328, z0: 36, x1: XE, z1: 63, ew: true },
  { name: 'Kita-koji', kind: 'lane', x0: XW, z0: -32, x1: -41, z1: -17, ew: true },
  { name: 'Yanaka-koji', kind: 'lane', x0: XW, z0: 60, x1: -41, z1: 75, ew: true },
  { name: 'Gado-shita', kind: 'alley', x0: XW, z0: -200, x1: XE, z1: -185, ew: true },
  { name: 'Sakura-koji', kind: 'lane', x0: -1, z0: 360, x1: 288, z1: 375, ew: true },
  { name: 'Nishi-dori', kind: 'street', x0: -40, z0: -112, x1: -1, z1: ZS, ew: false },
  { name: 'Neon-dori', kind: 'avenue', x0: 288, z0: -200, x1: 327, z1: ZS, ew: false },
  { name: 'Ki-no-michi', kind: 'lane', x0: -168, z0: -72, x1: -153, z1: 151, ew: false },
  { name: 'Golden lane', kind: 'alley', x0: 448, z0: -72, x1: 463, z1: 151, ew: false },
  { name: 'Hikari Ginza', kind: 'arcade', x0: 128, z0: 260, x1: 159, z1: ZS, ew: false },
];

const inOld = (x: number, z: number) => x >= 0 && x <= 287 && z >= 0 && z <= 223;
const inRect = (x: number, z: number, r: [number, number, number, number]) => x >= r[0] && x <= r[2] && z >= r[1] && z <= r[3];

// districts (inclusive voxel rects)
const SHRINE: [number, number, number, number] = [XW, -184, -1, -113];
const PLAZA: [number, number, number, number] = [0, -156, 287, -113];
const STATION: [number, number, number, number] = [80, -184, 207, -157];
const PARK: [number, number, number, number] = [328, 260, XE, ZS];
const POND = { cx: 452, cz: 356, rx: 64, rz: 40 };
const ISLE = { cx: 474, cz: 350, r: 11 };

const pondD = (x: number, z: number) => Math.hypot((x - POND.cx) / POND.rx, (z - POND.cz) / POND.rz) + (hash3(x >> 2, 3, z >> 2) - 0.5) * 0.06;

/** Height of the Inari hill above the street (voxels), 0 outside it. */
export function hillAt(x: number, z: number): number {
  if (!inRect(x, z, HILL)) return 0;
  const cx = (HILL[0] + HILL[2]) / 2 - 20, cz = (HILL[1] + HILL[3]) / 2 + 30;
  const d = Math.hypot((x - cx) / 110, (z - cz) / 80);
  const edge = Math.min(x - HILL[0], HILL[2] - x, z - HILL[1], HILL[3] - z);
  const h = Math.max(0, 1 - d) * 22;
  return Math.max(0, Math.min(h, edge * 0.5) | 0);
}

// ---------------------------------------------------------------------------------------------
// Ground

export function streetAt(x: number, z: number): Street | null {
  for (const s of STREETS) if (x >= s.x0 && x <= s.x1 && z >= s.z0 && z <= s.z1) return s;
  return null;
}

function paintStreet(b: Builder, s: Street, x: number, z: number): number {
  const c = b.c;
  const across = s.ew ? z - s.z0 : x - s.x0, width = s.ew ? s.z1 - s.z0 + 1 : s.x1 - s.x0 + 1;
  const along = s.ew ? x : z;
  const fromEdge = Math.min(across, width - 1 - across);
  switch (s.kind) {
    case 'avenue': {
      if (fromEdge < 7) {
        // pavement with a tactile strip down the middle
        if (fromEdge === 3) return (along + across) % 2 ? c.tactile : c.tactileDot;
        if (along % 6 === 5 || fromEdge === 6) return c.grout;
        return hash3(along >> 1, across, 41) < 0.5 ? c.paveA : c.paveC;
      }
      if (fromEdge === 7) return c.curb;
      // zebra crossings where other streets meet the road
      for (const o of STREETS) {
        if (o === s || o.ew === s.ew) continue;
        const lo = s.ew ? o.x0 : o.z0, hi = s.ew ? o.x1 : o.z1;
        const cs = s.ew ? o.z0 <= s.z1 && o.z1 >= s.z0 : o.x0 <= s.x1 && o.x1 >= s.x0;
        if (!cs || along < lo - 6 || along > hi + 6) continue;
        if (o.kind === 'avenue') {
          // scramble crossing: stripes on all four sides and two diagonals across the middle
          const u = along - lo, n = hi - lo;
          if (u < 0 || u > n) return along % 4 < 2 ? c.whiteLine : c.asphalt;
          const v = across - 8, m = width - 17;
          if (v < 5 || v > m - 5) return u % 4 < 2 ? c.whiteLine : c.asphalt;
          if (u < 5 || u > n - 5) return v % 4 < 2 ? c.whiteLine : c.asphalt;
          const t1 = Math.abs(u / n - v / m), t2 = Math.abs(u / n - (1 - v / m));
          if ((t1 < 0.09 || t2 < 0.09) && (u + v) % 4 < 2) return c.whiteLine;
          return c.asphalt;
        }
        if (along >= lo && along <= hi) return along % 4 < 2 ? c.whiteLine : c.asphalt;
        return c.asphalt;
      }
      if (fromEdge === 9) return c.whiteLine;
      const mid = (width - 1) / 2;
      if (Math.abs(across - mid) < 1 && along % 10 < 6) return c.whiteLine;
      return hash3(x, z, 7) < 0.04 ? c.stain : c.asphalt;
    }
    case 'street': {
      // pedestrian shopping street: running-bond pavers with a lighter band down the middle
      if (fromEdge === 0) return c.curb;
      if (fromEdge === 1) return along % 10 < 2 ? c.grate : c.concreteDark;
      const row = Math.floor(across / 3);
      const off = row % 2 ? 3 : 0;
      if (across % 3 === 2 || (along + off) % 6 === 5) return c.grout;
      const h = hash3(Math.floor((along + off) / 6), row, s.x0 & 255);
      if (Math.abs(across - width / 2) < 4) return h < 0.5 ? c.paveC : c.granite;
      return h < 0.33 ? c.paveA : h < 0.66 ? c.paveB : c.paveC;
    }
    case 'arcade': {
      // glossy tiles with a pattern of diamonds
      const u = across - width / 2 + 0.5, v = along % 16 - 8;
      if (Math.abs(u) + Math.abs(v) < 4) return c.terracotta;
      if (fromEdge === 0) return c.graniteDark;
      return (along + across) % 2 ? c.tileWhite : c.paveC;
    }
    case 'lane': {
      if (fromEdge === 0) return along % 4 === 0 ? c.grate : c.concreteDark;
      const h = hash3(x >> 1, z >> 1, 15);
      return h < 0.07 ? c.stain : h < 0.5 ? c.concrete : c.paveB;
    }
    case 'alley': {
      if (across === 1) return along % 4 === 0 ? c.grate : c.concreteDark;
      const h = hash3(x >> 1, z >> 1, 25);
      return h < 0.1 ? c.stain : h < 0.18 ? c.wetStone : h < 0.6 ? c.concreteDark : c.concrete;
    }
  }
}

function ground(b: Builder, x: number, z: number): number {
  const c = b.c;
  if ((z >= 152 && z <= 170) || (z >= 201 && z <= 223)) {
    const s = streetAt(x, z);
    if (s && z >= 201) return paintStreet(b, s, x, z);
    return surface(b, x, z);
  }
  const s = streetAt(x, z);
  if (s) return paintStreet(b, s, x, z);
  if (inRect(x, z, PLAZA)) {
    // station square: big granite slabs, tactile lines leading to the gates
    if ((x - 140) % 48 === 0 && z > -150) return (x + z) % 2 ? c.tactile : c.tactileDot;
    if (x % 8 === 7 || z % 8 === 0) return c.graniteDark;
    return hash3(x >> 3, z >> 3, 51) < 0.5 ? c.granite : c.paveC;
  }
  if (inRect(x, z, SHRINE)) {
    const h = hash3(x, z, 61);
    return h < 0.4 ? c.moss : h < 0.7 ? c.soil : h < 0.85 ? c.grassDark : c.pebble;
  }
  if (inRect(x, z, PARK)) {
    const h = hash3(x, z, 71);
    return h < 0.05 ? c.clover : h < 0.5 ? c.grass : c.grassDark;
  }
  if (inRect(x, z, HILL)) return hash3(x, z, 81) < 0.5 ? c.grass : c.moss;
  // pavements and the ground under buildings
  return hash3(x >> 1, z >> 1, 91) < 0.5 ? c.paveA : c.paveB;
}

/** Paint the surface layer everywhere outside the original district, then shape the pond and the hill. */
function paint(b: Builder) {
  const g = b.grid, c = b.c;
  for (let z = ZN; z <= ZS; z++) {
    if (z >= 171 && z <= 200) continue; // the canal
    for (let x = XW; x <= XE; x++) {
      if (inOld(x, z)) continue;
      if (!g.inside(x, G - 1, z)) continue;
      g.set(x, G - 1, z, ground(b, x, z));
    }
  }
  // the old north wall and the east konbini make way for the back alley and Neon-dori
  g.box(40, G, 0, 287, G + 10, 3, 0);
  // pond: stone rim, shallow edges, a pebble bed (the water plane sits at about layer G - 2.2)
  for (let z = POND.cz - POND.rz - 4; z <= POND.cz + POND.rz + 4; z++)
    for (let x = POND.cx - POND.rx - 4; x <= POND.cx + POND.rx + 4; x++) {
      const d = pondD(x, z);
      if (Math.hypot(x - ISLE.cx, z - ISLE.cz) < ISLE.r) continue;
      if (d < 1) {
        const depth = d > 0.9 ? 2 : d > 0.75 ? 4 : 6;
        g.box(x, G - depth, z, x, G - 1, z, 0);
        const h = hash3(x, 5, z);
        g.set(x, G - depth - 1, z, h < 0.5 ? c.pebble : h < 0.8 ? c.sand : c.algae);
        if (h > 0.965 && depth > 3) g.box(x, G - depth, z, x, G - depth + 1 + ((h * 100) | 0) % 2, z, c.weed);
      } else if (d < 1.07) {
        g.set(x, G - 1, z, hash3(x, 6, z) < 0.5 ? c.canalStone : c.stone);
        if (hash3(x, 7, z) < 0.18) g.set(x, G, z, c.canalStoneDark);
      }
    }
  // the island: a mossy mound
  for (let z = ISLE.cz - ISLE.r; z <= ISLE.cz + ISLE.r; z++)
    for (let x = ISLE.cx - ISLE.r; x <= ISLE.cx + ISLE.r; x++) {
      const d = Math.hypot(x - ISLE.cx, z - ISLE.cz) / ISLE.r;
      if (d >= 1) continue;
      g.set(x, G - 1, z, d > 0.85 ? c.canalStone : hash3(x, 8, z) < 0.5 ? c.moss : c.grass);
    }
  // the Inari hill: terraces of earth under grass
  for (let z = HILL[1]; z <= HILL[3]; z++)
    for (let x = HILL[0]; x <= HILL[2]; x++) {
      const h = hillAt(x, z);
      if (!h) continue;
      g.box(x, G - 1, z, x, G - 2 + h, z, c.earth);
      g.set(x, G - 1 + h, z, hash3(x, z, 82) < 0.55 ? c.grass : hash3(x, z, 83) < 0.6 ? c.moss : c.grassDark);
    }
}

// ---------------------------------------------------------------------------------------------
// Trees

type TreeKind = 'keyaki' | 'pine' | 'maple' | 'sakura';

/**
 * Street trees take `clear` (voxels of clean trunk under the crown, so it stays above people's heads) and
 * `spread` (crown size, for trees standing close to a facade).
 */
export function tree(b: Builder, x: number, z: number, seed: number, kind: TreeKind, yBase = G, clear = 0, spread = 1) {
  if (kind === 'sakura') { sakuraTree(b, x, z, seed, yBase); return; }
  const g = b.grid, c = b.c;
  const r = rng(seed);
  const pine = kind === 'pine';
  const h = pine ? 16 + Math.floor(r() * 6) : kind === 'maple' ? 10 + Math.floor(r() * 4) : 18 + Math.floor(r() * 8);
  // the crown rocks on the trunk as one piece from a little below where it starts
  const crownY = Math.max(clear - 2, pine ? h - 10 : kind === 'maple' ? h - 7 : h - 9);
  let tx = x, tz = z, id = 0;
  for (let y = 0; y < h; y++) {
    if (y > 5 && r() < (pine ? 0.4 : 0.2)) tx += r() < 0.5 ? 1 : -1;
    if (y > 5 && r() < 0.15) tz += r() < 0.5 ? 1 : -1;
    if (y === crownY) id = b.addSway({ ...SWAY.tree, amp: pine ? 0.009 : SWAY.tree.amp, pivot: [(tx + 1) * V, (yBase - G + y) * V, (tz + 1) * V], axis: [0, 0, 0], reach: 0 });
    g.box(tx, yBase + y, tz, tx + 1, yBase + y, tz + 1, y < 3 ? c.trunkDark : c.trunk);
    if (id) for (const [ax, az] of [[0, 0], [1, 0], [0, 1], [1, 1]]) b.swayCell(tx + ax, yBase + y, tz + az, id);
  }
  const cols = pine ? [c.pine, c.pineB, c.pine, c.leafDark] : kind === 'maple' ? [c.maple, c.mapleB, c.maple, c.leaf] : [c.keyaki, c.keyakiB, c.leaf, c.leafDark];
  const blobs: [number, number, number, number, number][] = [];
  if (pine) {
    // flat cloud-pruned pads on short limbs, as in a temple garden
    for (let i = 0; i < 4; i++) {
      const ang = r() * Math.PI * 2, rad = 3 + r() * 5;
      const py = yBase + h - 10 + i * 3 + Math.floor(r() * 2);
      const px = tx + Math.cos(ang) * rad, pz = tz + Math.sin(ang) * rad;
      for (let s = 0; s <= rad; s++) {
        const lx = Math.round(tx + Math.cos(ang) * s), lz = Math.round(tz + Math.sin(ang) * s);
        g.set(lx, py - 1, lz, c.trunk);
        b.swayCell(lx, py - 1, lz, id);
      }
      blobs.push([px, py, pz, 4 + r() * 2, 1.6]);
    }
    blobs.push([tx, yBase + h + 1, tz, 4, 2]);
  } else {
    const n = kind === 'maple' ? 4 : 6;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + r();
      const rad = ((kind === 'maple' ? 3 : 5) + r() * 3) * spread;
      blobs.push([tx + Math.cos(ang) * rad, yBase + h - 2 - r() * 4, tz + Math.sin(ang) * rad, (kind === 'maple' ? 4 + r() * 2 : 5 + r() * 3) * spread, kind === 'maple' ? 3 : 4 + r() * 2]);
    }
    blobs.push([tx, yBase + h + 2, tz, (kind === 'maple' ? 5 : 7) * spread, 4]);
  }
  let x0 = tx, z0 = tz, x1 = tx, z1 = tz;
  for (const [cx, cy, cz, rx, ry] of blobs) {
    x0 = Math.min(x0, cx - rx); z0 = Math.min(z0, cz - rx); x1 = Math.max(x1, cx + rx); z1 = Math.max(z1, cz + rx);
    for (let y = Math.max(Math.floor(cy - ry), yBase + clear); y <= cy + ry; y++)
      for (let zz = Math.floor(cz - rx); zz <= cz + rx; zz++)
        for (let xx = Math.floor(cx - rx); xx <= cx + rx; xx++) {
          const dx = (xx - cx) / rx, dy = (y - cy) / ry, dz = (zz - cz) / rx;
          const d = dx * dx + dy * dy + dz * dz;
          const nn = hash3(xx, y, zz);
          if (d < 1 - nn * 0.4 && nn > 0.1 && g.get(xx, y, zz) === 0) { g.set(xx, y, zz, cols[(nn * 97 | 0) % 4]); b.swayCell(xx, y, zz, id); }
        }
  }
  b.occlude(Math.floor(x0), Math.floor(z0), Math.ceil(x1), Math.ceil(z1), (yBase - G + h + 8) * V, (yBase - G) * V + 1.3, 'tree');
  b.block(x * V - 0.1, z * V - 0.1, x * V + 0.6, z * V + 0.6);
  noteTree(b, x, z);
}

// ---------------------------------------------------------------------------------------------
// Buildings

type Mix = 'shops' | 'homes' | 'tower' | 'bars' | 'canal' | 'arcade';

/** Lots of random widths along a frontage. For 's'/'n' lots `a` runs along x and `f` spans z; for 'e'/'w' the other way round. */
function frontage(b: Builder, side: Side, a0: number, a1: number, f0: number, f1: number, seed: number, mix: Mix, wMin = 16, wMax = 28) {
  const r = rng(seed);
  let a = a0, i = 0;
  while (a <= a1) {
    let w = wMin + Math.floor(r() * ((wMax - wMin) / 4 + 1)) * 4;
    if (a + w - 1 > a1 || a1 - (a + w - 1) < wMin) w = a1 - a + 1;
    const lot = side === 's' || side === 'n' ? new Lot(b, a, f0, a + w - 1, f1, side) : new Lot(b, f0, a, f1, a + w - 1, side);
    house(lot, seed * 31 + i, mix, r);
    a += w;
    i++;
  }
}

function house(lot: Lot, seed: number, mix: Mix, r: () => number) {
  const b = lot.b, c = b.c, k = b.k;
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)];
  const awnPairs: [number, number][] = [[c.awnRed, c.awnWhite], [c.awnGreen, c.awnWhite], [c.awnBlue, c.awnWhite], [c.awnOrange, c.awnWhite], [c.awnYellow, c.awnWhite], [c.awnPink, c.awnWhite], [c.awnNavy, c.awnNavy]];
  const lanternCol = pick([k.c.lanternRed, k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber]);
  let o: BuildingOpts;
  switch (mix) {
    case 'tower': {
      const ground: Ground = pick(['shop', 'cafe', 'izakaya', 'konbini', 'pharmacy', 'kissa', 'books', 'shop']);
      o = { floors: 6 + Math.floor(r() * 4), style: pick<Style>(['modern', 'modern', 'apartment']), ground, seed, wall: pick([c.tileWhite, c.concreteWall, c.slate, c.glassBlue, c.cream, c.sky, c.glassTeal]), awning: pick(awnPairs), lanterns: lanternCol };
      break;
    }
    case 'bars':
      o = { floors: 2 + (r() < 0.3 ? 1 : 0), style: 'izakaya', ground: 'izakaya', seed, lanterns: lanternCol, roof: r() < 0.6 ? 'tiled' : 'flat' };
      break;
    case 'homes': {
      const style = pick<Style>(['machiya', 'machiya', 'apartment', 'showa', 'kura', 'showa']);
      const ground: Ground = r() < 0.6 ? 'plain' : pick(['shop', 'florist', 'bakery', 'books', 'soba', 'cafe', 'shutter']);
      o = { floors: style === 'machiya' || style === 'kura' ? 2 : 2 + Math.floor(r() * 2), style, ground, seed, awning: pick(awnPairs), lanterns: lanternCol };
      break;
    }
    case 'canal': {
      const ground: Ground = pick(['cafe', 'cafe', 'kissa', 'izakaya', 'florist', 'bakery', 'books', 'plain']);
      const style: Style = ground === 'izakaya' ? 'izakaya' : pick(['machiya', 'showa', 'modern', 'kura']);
      o = { floors: style === 'machiya' || style === 'kura' ? 2 : 2 + Math.floor(r() * 3), style, ground, seed, awning: pick(awnPairs), lanterns: lanternCol };
      break;
    }
    case 'arcade': {
      const ground: Ground = pick(['shop', 'bakery', 'fish', 'florist', 'books', 'pharmacy', 'cafe', 'soba', 'shop', 'izakaya']);
      o = { floors: 2 + Math.floor(r() * 2), style: pick<Style>(['showa', 'showa', 'modern', 'machiya']), ground, seed, awning: pick(awnPairs), lanterns: lanternCol };
      break;
    }
    default: {
      const ground: Ground = pick(['shop', 'cafe', 'shutter', 'florist', 'books', 'bakery', 'pharmacy', 'fish', 'izakaya', 'soba']);
      const style: Style = ground === 'izakaya' ? 'izakaya' : r() < 0.2 ? 'machiya' : pick(['showa', 'modern', 'showa', 'apartment']);
      o = { floors: style === 'machiya' ? 2 : 2 + Math.floor(r() * 4), style, ground, seed, awning: pick(awnPairs), lanterns: lanternCol };
    }
  }
  if (o.ground === 'konbini') o.signs = false;
  if ((o.ground === 'pharmacy' || o.ground === 'soba') && lot.width < 20) o.ground = 'shop'; // their layouts need the width
  o = hotelize(lot, o);
  const nr = b.rooms.length;
  const { H } = building(lot, o);
  noteFront(lot, o.ground, o.style, mix, H, seed, b.rooms.slice(nr).map((rm) => rm.door));
  if (mix === 'tower') neonDress(lot, H, o.floors, seed);
  else if (o.style !== 'machiya' && o.style !== 'kura' && lot.width >= 12 && r() < 0.5) {
    lot.wallProp(lantern(k, r() < 0.5 ? k.c.lanternRed : k.c.lanternWhite, 5, 6, seed), lot.width / 2, 3.3, 0.15);
    const [lx, lz] = lot.front(lot.width / 2, 0.5);
    b.lamp(lx, 3.4, lz, WARM, 3.5, 0.7);
  }
}

const NEONS = (b: Builder) => [b.c.neonPink, b.c.neonCyan, b.c.neonViolet, b.c.neonYellow, b.c.neonGreen, b.c.neonOrange];
const NEON_RGB: [number, number, number][] = [[1, 0.4, 0.75], [0.35, 0.9, 1], [0.65, 0.5, 1], [1, 0.86, 0.35], [0.5, 1, 0.65], [1, 0.6, 0.3]];

/** Friendly neon on a tall building: blade signs, glowing bands, a screen, a crown of light. */
function neonDress(lot: Lot, H: number, floors: number, seed: number) {
  const b = lot.b, c = b.c;
  const r = rng(seed * 7 + 3);
  const w = lot.width;
  const neons = NEONS(b);
  const ni = Math.floor(r() * neons.length), nj = (ni + 1 + Math.floor(r() * 4)) % neons.length;
  const n1 = neons[ni], n2 = neons[nj];
  const GH = 14, FH = 12;
  // a blade sign standing out from the corner, a column of glyphs edged in light
  if (w >= 12) {
    const a = r() < 0.5 ? 1 : w - 2;
    const y0 = GH + 2, y1 = Math.min(H - 3, GH + 2 + 6 * Math.min(6, floors));
    const gr = rng(seed);
    const chars: boolean[][][] = [];
    for (let i = 0; i < 8; i++) chars.push(glyph(gr, 5));
    lot.box(a, y0, -1, a, y1, -8, (_a, y, d) => {
      if (y === y0 || y === y1 || d === -1 || d === -8) return n1;
      const cy = y - y0 - 1, ci = Math.floor(cy / 6), gy = cy % 6, gx = -d - 2;
      if (gy < 5 && gx >= 0 && gx < 5 && chars[ci % 8][4 - gy][gx]) return n2;
      return c.screenDark;
    });
    const [sx, sz] = lot.front(a + 0.5, 1.2);
    b.lamp(sx, (y0 + y1) / 2 * V, sz, NEON_RGB[nj], 7, 0.8);
  }
  // glowing bands along some floor lines
  for (let f = 1; f < floors - 1; f++) if (r() < 0.35) lot.box(0, GH + f * FH - 1, -1, w - 1, GH + f * FH - 1, -1, r() < 0.5 ? n1 : n2);
  // a screen on the facade, showing soft gradients
  if (floors >= 7 && w >= 18 && r() < 0.6) {
    const a0 = 3, a1 = w - 4, y0 = GH + FH * 2 + 1, y1 = y0 + 14;
    const phase = r() * 10;
    lot.box(a0, y0, -1, a1, y1, -1, (a, y) => {
      if (a === a0 || a === a1 || y === y0 || y === y1) return c.screenDark;
      const t = Math.sin((a + phase) * 0.3 + y * 0.15) + Math.sin(y * 0.4 - phase);
      return t > 0.9 ? c.screenC : t > -0.2 ? c.screenA : c.screenB;
    });
    const [sx, sz] = lot.front(w / 2, 1.5);
    b.lamp(sx, (y0 + y1) / 2 * V, sz, [0.6, 0.7, 1], 9, 0.6);
  }
  // a crown of light along the parapet, and a rooftop sign on some
  lot.box(0, H, -1, w - 1, H, -1, n1);
  if (r() < 0.5 && w >= 14) {
    const gr = rng(seed + 9);
    const n = Math.min(4, Math.floor((w - 4) / 6));
    const a0 = Math.floor((w - n * 6) / 2);
    lot.box(a0 - 1, H + 1, 2, a0 + n * 6, H + 1, 2, c.steelDark);
    for (let i = 0; i < n; i++) {
      const gl = glyph(gr, 5);
      for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (gl[4 - y][x]) lot.set(a0 + i * 6 + x, H + 2 + y, 2, i % 2 ? n2 : n1);
    }
  }
  // the colour of the neon on the pavement
  const [lx, lz] = lot.front(w / 2, 2);
  b.lamp(lx, 4.5, lz, NEON_RGB[ni], 8, 0.6);
}

// ---------------------------------------------------------------------------------------------
// The railway viaduct, with little bars in its arches

function viaduct(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const z0 = ZN, z1 = -201, top = G + 24;
  // deck, parapets and track
  g.box(XW, top - 3, z0, XE, top, z1, c.concrete);
  g.box(XW, top - 4, z0, XE, top - 4, z1, c.concreteDark);
  for (const zp of [z0, z1]) g.box(XW, top + 1, zp, XE, top + 4, zp, (_x, y) => (y === top + 3 ? c.awnGreen : c.concreteWall));
  for (const zt of [z0 + 5, z0 + 14]) {
    g.box(XW, top + 1, zt - 2, XE, top + 1, zt + 5, (x) => (x % 3 === 0 ? c.sleeper : c.ballast));
    g.box(XW, top + 2, zt, XE, top + 2, zt, c.rail);
    g.box(XW, top + 2, zt + 3, XE, top + 2, zt + 3, c.rail);
  }
  // catenary masts
  for (let x = XW + 8; x <= XE; x += 48) {
    g.box(x, top + 1, z0 + 1, x, top + 22, z0 + 1, c.steel);
    g.box(x, top + 1, z1 - 1, x, top + 22, z1 - 1, c.steel);
    g.box(x, top + 22, z0 + 1, x, top + 22, z1 - 1, c.steel);
    g.box(x, top + 19, z0 + 4, x, top + 19, z1 - 4, c.steelDark);
  }
  b.occlude(XW, z0, XE, z1, (top - G + 22) * V, 0.6, 'landmark');
  // piers every 32 voxels; in between, an arch bay with a tiny bar, a bike park or a shutter
  const r = rng(808);
  for (let x = XW; x <= XE; x += 32) {
    g.box(x, G, z0, x + 3, top - 4, z1, c.concrete);
    g.box(x, top - 8, z0, x + 3, top - 4, z1, c.concreteDark);
    const bx0 = x + 4, bx1 = Math.min(XE, x + 31);
    if (bx1 - bx0 < 12) continue;
    // arch soffit
    for (let xx = bx0; xx <= bx1; xx++) {
      const t = (xx - bx0) / (bx1 - bx0);
      const drop = Math.round((1 - Math.sin(t * Math.PI)) * 5);
      g.box(xx, top - 5 - drop, z0, xx, top - 5, z1, c.concreteWall);
    }
    const w = bx1 - bx0 + 1;
    const lot = new Lot(b, bx0, z0, bx1, z1, 's');
    const kind = r();
    if (kind < 0.62) {
      // gado-shita izakaya: a closed bar front under the tracks, lanterns, crates and stools outside
      lot.box(0, 0, 0, w - 1, 13, 0, c.woodDark);
      lot.box(1, 1, 0, w - 2, 9, 0, (a) => (a % 3 === 0 ? c.woodMid : c.glassLit));
      const da = Math.floor(w / 2) - 1;
      lot.box(da, 0, 0, da + 2, 9, 0, c.shoji);
      lot.box(0, 10, -1, w - 1, 10, -2, c.cedar);
      lot.wallProp(noren(k, 10, [k.c.navy, k.c.norenRed, k.c.indigo][Math.floor(r() * 3)], k.c.norenWhite, 6, 2), da + 1.5, 1.5, 0.02);
      const col = [k.c.lanternRed, k.c.lanternRed, k.c.lanternWhite][Math.floor(r() * 3)];
      for (const a of [3, w - 3]) {
        lot.wallProp(lantern(k, col, 5, 7, x + a), a, 1.9, 0.3);
        const [lx, lz] = lot.front(a, 0.6);
        b.lamp(lx, 2.2, lz, col === k.c.lanternWhite ? WHITEWARM : RED, 4.5, 1.0);
      }
      lot.wallProp(boardSign(k, k.c.signCream, k.c.signBlack, 3, x), w / 2, 2.9, 0.0);
      // an upturned beer crate table with stools: the classic standing bar outside
      const [tx, tz] = lot.front(w - 6, 0.9);
      b.place(crateStack(k, 5000 + x), tx, 0, tz);
      b.block(tx - 0.5, tz - 0.5, tx + 0.5, tz + 0.5);
      for (const s of [-0.85, 0.85]) b.place(stool(k, k.c.lacquer), tx + s, 0, tz);
    } else if (kind < 0.8) {
      // bicycle parking with a corrugated shutter behind
      lot.box(0, 0, 0, w - 1, 12, 0, (_a, y) => (y % 2 ? c.shutterA : c.shutterB));
      for (let a = 3; a < w - 3; a += 3) {
        const [px, pz] = lot.front(a + 0.5, 0.6);
        b.place(bicycle(k, [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed][(a + x) % 3]), px, 0, pz, 1);
      }
      const [p0x, p0z] = lot.front(1, 0), [p1x, p1z] = lot.front(w - 1, 1.2);
      b.block(p0x, p0z, p1x, p1z);
    } else {
      // a little yakitori counter open to the lane, with a red-and-white curtain
      lot.box(0, 0, 0, w - 1, 13, 0, c.cream);
      lot.box(2, 0, 0, w - 3, 9, 0, 0);
      lot.box(2, 0, 2, w - 3, 9, 2, c.woodDark);
      lot.box(2, 0, 1, w - 3, 2, 1, c.wood);
      lot.box(2, 3, 1, w - 3, 3, 1, c.hinoki);
      lot.box(1, 10, -1, w - 2, 10, -3, (a) => (a % 4 < 2 ? c.awnRed : c.awnWhite));
      const [sx, sz] = lot.front(w / 2, -0.2);
      b.emitters.push({ kind: 'smoke', pos: [sx, 1.3, sz], rate: 0.6 });
      b.lamp(sx, 2.2, sz + 0.6, WARM, 5, 1.0);
      for (let a = 4; a < w - 3; a += 5) {
        const [tx, tz] = lot.front(a, 0.55);
        b.place(stool(k, k.c.lacquer), tx, 0, tz);
      }
      const [b0x, b0z] = lot.front(2, -0.5), [b1x, b1z] = lot.front(w - 2, 0.2);
      b.block(b0x, b0z, b1x, b1z);
    }
  }
  // paper lanterns strung along the lane under the tracks
  for (let x = XW + 20; x < XE; x += 13) {
    if (x >= 288 && x <= 327) continue;
    b.place(wire(k, 3.6, 0.3), x * V, 3.9, -192.5 * V, 0);
    if (x % 2 === 0) {
      b.swayParent = b.lastSway[0];
      b.place(lantern(k, x % 3 ? k.c.lanternRed : k.c.lanternWhite, 4, 5, x), x * V, 3.0, -192.5 * V);
      b.swayParent = 0;
      b.lamp(x * V, 3.2, -192.5 * V, x % 3 ? RED : WHITEWARM, 3.2, 0.6);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The station and its square

function station(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const [x0, z0, x1, z1] = STATION;
  const top = G + 30;
  // body: cream stone with tall arched windows, a hall open to the square
  g.box(x0, G, z0, x1, top, z1, c.cream);
  g.box(x0 + 4, G, z0 + 2, x1 - 4, G + 19, z1 - 1, 0);
  g.box(x0 + 4, G + 20, z0 + 2, x1 - 4, G + 20, z1 - 1, c.concreteWall);
  // inside: a row of ticket gates, departure boards, a kiosk
  for (let x = x0 + 30; x <= x1 - 30; x += 6) {
    g.box(x, G, z0 + 10, x + 1, G + 3, z0 + 14, c.steel);
    g.box(x, G + 4, z0 + 10, x + 1, G + 4, z0 + 14, c.screenA);
  }
  g.box(x0 + 30, G + 13, z0 + 3, x1 - 30, G + 17, z0 + 3, (x, y) => (y === G + 13 || y === G + 17 ? c.steelDark : (x + y) % 3 ? c.screenDark : c.neonYellow));
  g.box(x0 + 8, G, z0 + 4, x0 + 18, G + 4, z0 + 8, c.konbiniStripeA);
  g.box(x0 + 8, G + 5, z0 + 4, x0 + 18, G + 5, z0 + 8, c.signLit);
  b.lamp((x0 + x1) / 2 * V, 4.2, (z0 + 12) * V, WHITEWARM, 14, 1.0);
  b.lamp((x0 + 14) * V, 2, (z0 + 10) * V, COOL, 5, 0.8);
  b.indoor.push([x0 + 4, G, z0 + 2, x1 - 4, G + 19, z1 - 1]);
  // facade: three big doorways between columns, glass above
  for (let x = x0; x <= x1; x++) {
    const bay = (x - x0) % 16;
    if (bay < 3) { g.box(x, G, z1, x, top - 4, z1 + 1, c.templeWhite); continue; }
    const door = x > x0 + 8 && x < x1 - 8 && (x - x0) % 32 > 6 && (x - x0) % 32 < 28;
    g.box(x, door ? G + 13 : G, z1, x, top - 6, z1, (_x, y) => (y % 6 === 0 ? c.trim : c.glassNight));
    if (door) g.box(x, G, z1, x, G + 12, z1, 0);
  }
  g.box(x0, top - 5, z1, x1, top - 4, z1 + 2, c.trim);
  // name board with lit glyphs and a clock
  const gr = rng(77);
  const cx = Math.floor((x0 + x1) / 2);
  g.box(cx - 26, top - 2, z1 + 1, cx + 26, top + 6, z1 + 1, c.awnNavy);
  for (let i = 0; i < 6; i++) {
    const gl = glyph(gr, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (gl[4 - y][x]) g.set(cx - 22 + i * 8 + x, top + y, z1 + 2, c.signLit);
  }
  for (let y = -5; y <= 5; y++) for (let x = -5; x <= 5; x++) {
    const d = Math.hypot(x, y);
    if (d <= 5.4) g.set(cx + x, top + 15 + y, z1 + 1, d > 4.4 ? c.gold : (x === 0 && y > 0 && y < 4) || (y === 0 && x > 0 && x < 3) ? c.trimDark : c.templeWhite);
  }
  g.box(cx - 7, top + 1, z1 - 2, cx + 7, top + 9, z1, c.cream);
  // canopy over the entrances
  g.box(x0 + 6, G + 13, z1 + 2, x1 - 6, G + 13, z1 + 9, c.steelDark);
  g.box(x0 + 6, G + 14, z1 + 2, x1 - 6, G + 14, z1 + 9, c.glassBlue);
  for (let x = x0 + 8; x < x1 - 6; x += 16) g.box(x, G, z1 + 9, x, G + 12, z1 + 9, c.steelDark);
  // a hipped roof edge
  g.box(x0 - 1, top + 1, z0, x1 + 1, top + 1, z1 + 1, c.roofGreenB);
  g.box(x0 + 2, top + 2, z0 + 2, x1 - 2, top + 2, z1 - 1, c.roofGreen);
  b.occlude(x0, z0, x1, z1 + 9, (top - G + 12) * V, 0.95, 'building');
  for (let x = x0 + 8; x < x1 - 6; x += 16) b.block((x - 0.2) * V, (z1 + 8.8) * V, (x + 1.2) * V, (z1 + 10.2) * V);
  for (let x = x0 + 30; x <= x1 - 30; x += 6) b.block(x * V, (z0 + 10) * V, (x + 2) * V, (z0 + 15) * V);
  b.block((x0 + 8) * V, (z0 + 4) * V, (x0 + 19) * V, (z0 + 9) * V);

  // the square: a great zelkova in a round seat, a clock post, a police box, flower beds, bike racks
  const [px, pz] = [143, -134];
  tree(b, px, pz, 4242, 'keyaki');
  for (let a = 0; a < 32; a++) {
    const t = (a / 32) * Math.PI * 2;
    const x = Math.round(px + Math.cos(t) * 9), z = Math.round(pz + Math.sin(t) * 9);
    g.box(x, G, z, x, G + 1, z, c.granite);
  }
  b.block((px - 9) * V, (pz - 9) * V, (px + 10) * V, (pz + 10) * V);
  for (let i = 0; i < 4; i++) {
    const t = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const x = (px + Math.cos(t) * 11.5) * V, z = (pz + Math.sin(t) * 11.5) * V;
    const turns = [3, 0, 1, 2][i];
    b.place(bench(k), x, 0, z, turns);
    b.benches.push([x, z, [Math.PI / 2, 0, -Math.PI / 2, Math.PI][i] + 0]);
  }
  // clock post
  g.box(60, G, -128, 60, G + 18, -128, c.steelDark);
  g.box(58, G + 18, -130, 62, G + 22, -126, c.trim);
  g.box(57, G + 19, -129, 63, G + 21, -127, c.templeWhite);
  b.block(14.8, -32.2, 15.4, -31.8);
  // koban: a tiny police box with its red lamp
  g.box(232, G, -140, 243, G + 11, -131, c.cream);
  g.box(234, G, -131, 237, G + 8, -131, c.glassLit);
  g.box(232, G + 12, -141, 243, G + 12, -130, c.slate);
  g.box(237, G + 9, -130, 238, G + 10, -130, c.lacquer);
  b.lamp(237.5 * V, 2.5, -129 * V, [1, 0.25, 0.2], 3.5, 0.9);
  b.block(232 * V, -140 * V, 244 * V, -130 * V);
  b.occlude(232, -141, 243, -130, 4, 0.95, 'building');
  // flower beds along the front
  for (const fx of [20, 250]) {
    g.box(fx, G, -124, fx + 24, G, -116, c.granite);
    for (let z = -123; z <= -117; z++) for (let x = fx + 1; x < fx + 24; x++) {
      const h = hash3(x, 9, z);
      g.set(x, G, z, h < 0.3 ? c.leaf : h < 0.5 ? c.leafDark : h < 0.7 ? c.petalDeep : h < 0.85 ? c.mustard : c.templeWhite);
    }
    b.block(fx * V, -124 * V, (fx + 25) * V, -115 * V);
  }
  // bike racks and vending machines by the station side
  for (let x = 30; x < 70; x += 3) b.place(bicycle(k, [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed, k.c.bikeSilver][x % 4]), x * V, 0, -149 * V, 1);
  b.block(29 * V, -151 * V, 71 * V, -147 * V);
  // vending machines against the station's west end
  for (let i = 0; i < 3; i++) {
    const vx = (82.5 + i * 4.5) * V;
    b.place(vendingMachine(k, [k.c.vmRed, k.c.vmBlue, k.c.vmWhite][i], 900 + i), vx, 0, -38.6, 0);
    b.lamp(vx, 1.2, -38.0, COOL, 3, 0.8);
  }
  b.block(81 * V, -38.95, 96 * V, -38.2);
  // a row of street lamps along the front of the square
  for (let x = 10; x < 287; x += 40) {
    b.place(streetLamp(k), x * V, 0, -114.5 * V, 0);
    b.lamp(x * V + 0.5, 3.4, -114.5 * V, WHITEWARM, 7, 0.9);
    b.block(x * V - 0.2, -115 * V, x * V + 0.4, -114 * V);
  }
  // towers either side of the station, facing the square
  frontage(b, 's', 0, 79, -184, -157, 4101, 'tower', 20, 32);
  frontage(b, 's', 208, 287, -184, -157, 4102, 'tower', 20, 32);
}

// ---------------------------------------------------------------------------------------------
// Shrine in the wood

function torii(b: Builder, x0: number, z: number, span: number, h: number, ew = true, col?: number) {
  const g = b.grid, c = b.c;
  const red = col ?? c.torii;
  // posts at x0 and x0 + span (or along z when !ew), lintel and the upswept top beam
  const P = (a: number, y: number, t: number) => (ew ? g.set(x0 + a, y, z + t, red) : g.set(z + t, y, x0 + a, red));
  for (const a of [0, span]) for (let y = G; y < G + h; y++) { P(a, y, 0); if (y < G + 2) { P(a, y, 0); } }
  for (const a of [0, span]) { if (ew) g.box(x0 + a, G, z, x0 + a, G + 1, z, c.toriiBlack); else g.box(z, G, x0 + a, z, G + 1, x0 + a, c.toriiBlack); }
  for (let a = -1; a <= span + 1; a++) P(a, G + h - 3, 0);
  for (let a = -2; a <= span + 2; a++) { P(a, G + h, 0); if (ew) g.set(x0 + a, G + h + 1, z, c.toriiBlack); else g.set(z, G + h + 1, x0 + a, c.toriiBlack); }
  for (const a of [-2, span + 2]) P(a, G + h + 1, 0);
}

function shrine(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const [sx0, sz0, sx1, sz1] = SHRINE;
  const ax0 = -168, ax1 = -153; // the approach lines up with Ki-no-michi across the avenue
  // the approach: gravel with a stone path, lanterns in pairs
  for (let z = sz0 + 30; z <= sz1; z++) for (let x = ax0 - 2; x <= ax1 + 2; x++) {
    const stone = x >= ax0 + 4 && x <= ax1 - 4;
    g.set(x, G - 1, z, stone ? ((x + (z >> 1)) % 4 === 0 ? c.graniteDark : c.granite) : c.gravel);
  }
  torii(b, ax0 - 2, sz1 - 2, ax1 - ax0 + 4, 22);
  torii(b, ax0 - 1, sz1 - 34, ax1 - ax0 + 2, 18);
  for (let z = sz1 - 10; z > sz0 + 34; z -= 12) for (const x of [ax0 - 5, ax1 + 5]) {
    b.place(stoneLantern(k), x * V, 0, z * V);
    b.lamp(x * V, 1.5, z * V, WARM, 3.2, 0.7);
    b.block(x * V - 0.5, z * V - 0.5, x * V + 0.5, z * V + 0.5);
  }
  // komainu guardians on plinths by the inner gate
  for (const x of [ax0 - 4, ax1 + 4]) {
    g.box(x - 1, G, sz1 - 38, x + 1, G + 3, sz1 - 36, c.stoneStep);
    g.box(x - 1, G + 4, sz1 - 38, x + 1, G + 6, sz1 - 36, c.stone);
    g.set(x, G + 7, sz1 - 36, c.stone);
    b.block((x - 1) * V, (sz1 - 38) * V, (x + 2) * V, (sz1 - 35) * V);
  }
  // purification pavilion
  {
    const px0 = ax1 + 8, pz0 = sz1 - 30;
    g.box(px0, G, pz0, px0 + 8, G + 2, pz0 + 4, c.stone);
    g.box(px0 + 1, G + 2, pz0 + 1, px0 + 7, G + 2, pz0 + 3, c.water);
    for (const [x, z] of [[px0, pz0 - 1], [px0 + 8, pz0 - 1], [px0, pz0 + 5], [px0 + 8, pz0 + 5]]) g.box(x, G, z, x, G + 11, z, c.woodDark);
    for (let l = 0; l < 3; l++) g.box(px0 - 2 + l, G + 12 + l, pz0 - 3 + l, px0 + 10 - l, G + 12 + l, pz0 + 7 - l, l === 2 ? c.roofRidge : c.roofGreen);
    b.block(px0 * V, (pz0 - 1) * V, (px0 + 9) * V, (pz0 + 6) * V);
    b.occlude(px0 - 2, pz0 - 3, px0 + 10, pz0 + 7, 4, 1.3, 'landmark');
  }
  // the main hall on a stone base, copper roof
  {
    const hx0 = ax0 - 18, hx1 = ax1 + 18, hz0 = sz0 + 2, hz1 = sz0 + 26;
    g.box(hx0, G, hz0, hx1, G + 3, hz1, c.stoneStep);
    for (let s = 0; s < 4; s++) g.box(ax0 + 1, G, hz1 + 1 + s, ax1 - 1, G + 3 - s - 1, hz1 + 1 + s, c.stoneStep);
    g.box(hx0 + 2, G + 4, hz0 + 2, hx1 - 2, G + 18, hz1 - 4, c.templeWhite);
    for (let x = hx0 + 2; x <= hx1 - 2; x += 6) g.box(x, G + 4, hz1 - 4, x + 1, G + 18, hz1 - 3, c.torii);
    g.box(hx0 + 2, G + 17, hz1 - 3, hx1 - 2, G + 18, hz1 - 3, c.torii);
    g.box(ax0, G + 4, hz1 - 3, ax1, G + 14, hz1 - 3, c.woodDark);
    g.box(ax0 + 1, G + 5, hz1 - 3, ax1 - 1, G + 13, hz1 - 3, c.shoji);
    g.box(ax0 + 2, G + 4, hz1 - 1, ax1 - 2, G + 6, hz1, c.woodDark);
    g.box(ax0 + 2, G + 7, hz1 - 1, ax1 - 2, G + 7, hz1, c.gold);
    for (let l = 0; l < 12; l++) {
      const x0 = hx0 - 4 + l * 2, x1 = hx1 + 4 - l * 2, z0 = hz0 - 2 + l, z1 = hz1 + 2 - l;
      if (x0 > x1 || z0 > z1) break;
      g.box(x0, G + 19 + l, z0, x1, G + 19 + l, z1, l % 2 ? c.roofGreen : c.roofGreenB);
    }
    // the shimenawa rope with paper streamers
    g.box(ax0 - 1, G + 15, hz1 - 1, ax1 + 1, G + 15, hz1 - 1, c.sand2);
    for (let x = ax0 + 1; x < ax1; x += 4) g.box(x, G + 13, hz1 - 1, x, G + 14, hz1 - 1, c.templeWhite);
    b.lamp((ax0 + ax1) / 2 * V, 2.4, (hz1 + 2) * V, WARM, 6, 0.9);
    b.block(hx0 * V, hz0 * V, (hx1 + 1) * V, (hz1 + 0.5) * V);
    b.occlude(hx0 - 4, hz0 - 2, hx1 + 4, hz1 + 4, 9, 1.9, 'landmark');
    // ema boards and an omikuji rack
    g.box(hx1 + 6, G, hz1 - 2, hx1 + 16, G + 7, hz1 - 2, (x, y) => (y < 3 || x === hx1 + 6 || x === hx1 + 16 ? c.woodDark : (x + y) % 2 ? c.hinoki : c.wood));
    g.box(hx0 - 16, G, hz1 - 2, hx0 - 6, G + 6, hz1 - 2, (x, y) => (y < 2 || x === hx0 - 16 || x === hx0 - 6 ? c.woodDark : (x * 7 + y) % 3 ? c.templeWhite : c.woodDark));
    b.block((hx1 + 6) * V, (hz1 - 2.5) * V, (hx1 + 17) * V, (hz1 - 1) * V);
    b.block((hx0 - 16) * V, (hz1 - 2.5) * V, (hx0 - 5) * V, (hz1 - 1) * V);
  }
  // the sacred wood: an old camphor-like keyaki by the hall, pines and maples, and a low stone fence
  const r = rng(1313);
  for (let z = sz0 + 6; z < sz1 - 4; z += 14)
    for (let x = sx0 + 6; x < sx1 - 4; x += 15) {
      const jx = x + Math.floor(r() * 8), jz = z + Math.floor(r() * 8);
      if (jx > ax0 - 26 && jx < ax1 + 26) continue;
      tree(b, jx, jz, 1300 + x * 7 + z, r() < 0.45 ? 'keyaki' : r() < 0.6 ? 'pine' : 'maple');
    }
  for (let x = sx0; x <= sx1; x++) {
    if (x >= ax0 - 2 && x <= ax1 + 2) continue;
    g.box(x, G, sz1, x, G + (x % 6 === 0 ? 3 : 2), sz1, c.stone);
  }
  b.block(sx0 * V, sz1 * V, (ax0 - 2) * V, (sz1 + 1) * V);
  b.block((ax1 + 3) * V, sz1 * V, (sx1 + 1) * V, (sz1 + 1) * V);
}

// ---------------------------------------------------------------------------------------------
// The covered arcade

function arcade(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const x0 = 128, x1 = 159, z0 = 260, z1 = ZS;
  const top = G + 22;
  // frames every 16 voxels, a lattice roof with glazing strips
  for (let z = z0; z <= z1; z += 16) {
    for (const x of [x0, x1]) g.box(x, G, z, x, top, z, c.steelDark);
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const y = top + Math.round(Math.sin(t * Math.PI) * 4);
      g.box(x, top, z, x, y, z, c.steel);
    }
  }
  for (let z = z0; z <= z1; z++) {
    if (z >= 360 && z <= 375) continue;
    for (let x = x0; x <= x1; x++) {
      const t = (x - x0) / (x1 - x0);
      const y = top + Math.round(Math.sin(t * Math.PI) * 4);
      if (z % 4 === 0 || x === x0 || x === x1) g.set(x, y, z, c.steel);
      else if (z % 4 === 2) g.set(x, y, z, c.glassBlue);
    }
  }
  b.occlude(x0, z0, x1, z1, (top - G + 6) * V, 3.6, 'landmark');
  // gateway sign at the north entrance, lit glyphs on red
  const gr = rng(560);
  g.box(x0, top - 6, z0, x1, top - 1, z0, c.lacquer);
  for (let i = 0; i < 4; i++) {
    const gl = glyph(gr, 5);
    for (let y = 0; y < 5; y++) for (let x = 0; x < 5; x++) if (gl[4 - y][x]) g.set(x0 + 4 + i * 7 + x, top - 6 + y, z0 - 1, c.signLit);
  }
  g.box(x0, top - 7, z0 - 1, x1, top - 7, z0 - 1, c.neonYellow);
  // hanging decorations: lantern rows and paper sakura garlands, banners
  for (let z = z0 + 8; z < z1; z += 16) {
    if (z >= 356 && z <= 379) continue;
    b.place(wire(k, 7.8, 0.4, k.c.white), (x0 + x1 + 1) / 2 * V, 3.9, (z + 0.5) * V, 0);
    b.swayParent = b.lastSway[0];
    for (let x = x0 + 4; x < x1 - 2; x += 5) {
      const col = (x + z) % 3 === 0 ? k.c.lanternWhite : k.c.lanternRed;
      b.place(lantern(k, col, 4, 5, x * 31 + z), x * V, 3.0, (z + 0.5) * V);
    }
    b.swayParent = 0;
    b.lamp((x0 + x1) / 2 * V, 3.3, z * V, WARM, 6, 0.8);
    for (let x = x0 + 2; x < x1; x += 2) g.set(x, top - 1 - ((x >> 1) % 2), z + 4, (x >> 1) % 3 === 0 ? c.petal : (x >> 1) % 3 === 1 ? c.petalDeep : c.leaf);
  }
  // shops both sides, broken by the cross lane
  for (const [za, zb] of [[z0, 359], [376, z1]] as [number, number][]) {
    frontage(b, 'e', za, zb, 80, 127, 4200 + za, 'arcade', 12, 20);
    frontage(b, 'w', za, zb, 160, 207, 4300 + za, 'arcade', 12, 20);
  }
  // a fruit stand and a few nobori out front
  for (let z = z0 + 12; z < z1; z += 28) {
    b.place(nobori(k, [k.c.norenRed, k.c.navy, k.c.norenWhite][z % 3], k.c.white, z), (x0 + 3.5) * V, 0, z * V);
    b.place(nobori(k, [k.c.norenWhite, k.c.norenRed, k.c.navy][z % 3], k.c.norenRed, z + 1), (x1 - 2.5) * V, 0, (z + 6) * V);
  }
}

// ---------------------------------------------------------------------------------------------
// Park with a pond and an island shrine

function park(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const [x0, z0, x1, z1] = PARK;
  // paths: a ring around the pond and two straight walks to the gates
  const path = (x: number, z: number) => g.set(x, G - 1, z, hash3(x, z, 72) < 0.5 ? c.sand2 : c.gravel);
  for (let z = z0; z <= z1; z++)
    for (let x = x0; x <= x1; x++) {
      const d = pondD(x, z);
      if (d >= 1.12 && d < 1.32) path(x, z);
      if (x >= 440 && x <= 451 && z < POND.cz - POND.rz) path(x, z);
      if (z >= 352 && z <= 363 && x < POND.cx - POND.rx) path(x, z);
    }
  // a low hedge fence along the streets with gates
  for (let x = x0; x <= x1; x++) if (!(x >= 438 && x <= 453)) g.box(x, G, z0, x, G + 2, z0 + 1, c.leafDark);
  for (let z = z0; z <= z1; z++) if (!(z >= 350 && z <= 365)) g.box(x0, G, z, x0 + 1, G + 2, z, c.leafDark);
  for (let x = x0; x <= x1; x++) g.box(x, G, z1, x, G + 2, z1, c.leafDark);
  for (let z = z0; z <= z1; z++) g.box(x1, G, z, x1, G + 2, z, c.leafDark);
  b.block(x0 * V, z0 * V, 438 * V, (z0 + 2) * V); b.block(454 * V, z0 * V, (x1 + 1) * V, (z0 + 2) * V);
  b.block(x0 * V, z0 * V, (x0 + 2) * V, 350 * V); b.block(x0 * V, 366 * V, (x0 + 2) * V, (z1 + 1) * V);
  // the pond's water is the canal's water plane; keep walkers out
  for (let z = POND.cz - POND.rz; z < POND.cz + POND.rz; z += 2) {
    const t = (z + 1 - POND.cz) / POND.rz;
    const hw = POND.rx * Math.sqrt(Math.max(0, 1 - t * t)) * 1.02;
    b.block((POND.cx - hw) * V, z * V, (POND.cx + hw) * V, (z + 2) * V);
  }
  // trees: cherries around the water, zelkovas and pines further out, a few maples for colour
  const r = rng(2121);
  for (let i = 0; i < 18; i++) {
    const t = (i / 18) * Math.PI * 2 + r() * 0.2;
    const x = Math.round(POND.cx + Math.cos(t) * POND.rx * 1.48), z = Math.round(POND.cz + Math.sin(t) * POND.rz * 1.55);
    if (x < x0 + 6 || x > x1 - 6 || z < z0 + 6 || z > z1 - 6) continue;
    if (Math.abs(x - 445) < 14 && z < POND.cz) continue;
    if (Math.abs(z - 357) < 14 && x < POND.cx) continue;
    tree(b, x, z, 2100 + i, i % 3 === 0 ? 'maple' : 'sakura');
  }
  for (let z = z0 + 8; z < z1 - 6; z += 22)
    for (let x = x0 + 8; x < x1 - 6; x += 24) {
      const jx = x + Math.floor(r() * 8), jz = z + Math.floor(r() * 8);
      if (pondD(jx, jz) < 1.75) continue;
      if (Math.abs(jx - 445) < 12 || Math.abs(jz - 357) < 12) continue;
      tree(b, jx, jz, 2200 + x * 3 + z, r() < 0.5 ? 'keyaki' : 'pine');
    }
  // benches facing the water, lamps along the ring
  for (let i = 0; i < 10; i++) {
    const t = (i / 10) * Math.PI * 2 + 0.3;
    const x = (POND.cx + Math.cos(t) * POND.rx * 1.36) * V, z = (POND.cz + Math.sin(t) * POND.rz * 1.4) * V;
    // the nearest quarter turn that faces the pond
    const face = Math.atan2(POND.cz * V - z, POND.cx * V - x);
    const q = Math.round(((Math.PI / 2 - face) / (Math.PI / 2)) + 8) % 4;
    if (i % 2) {
      b.place(bench(k), x, 0, z, q);
      b.benches.push([x, z, Math.PI / 2 - q * Math.PI / 2]);
    } else {
      b.place(streetLamp(k), x, 0, z, q);
      b.lamp(x, 3.4, z, WHITEWARM, 7, 0.9);
      b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
    }
  }
  // the island's little shrine and the red bridge out to it
  {
    const ix = ISLE.cx, iz = ISLE.cz;
    g.box(ix - 3, G, iz - 3, ix + 3, G, iz + 3, c.stoneStep);
    g.box(ix - 2, G + 1, iz - 2, ix + 2, G + 5, iz + 2, c.torii);
    g.box(ix - 1, G + 2, iz + 2, ix + 1, G + 4, iz + 2, c.woodDark);
    for (let l = 0; l < 3; l++) g.box(ix - 4 + l, G + 6 + l, iz - 4 + l, ix + 4 - l, G + 6 + l, iz + 4 - l, l === 2 ? c.gold : c.roofGreen);
    tree(b, ix + 6, iz - 6, 2301, 'pine');
    b.lamp(ix * V, 1.6, (iz + 4) * V, WARM, 4, 0.7);
    // arched bridge from the south shore
    const bx0 = ix - 2, bx1 = ix + 2, bz0 = iz + ISLE.r - 2, bz1 = POND.cz + POND.rz + 3;
    for (let z = bz0; z <= bz1; z++) {
      const t = (z - bz0) / (bz1 - bz0);
      const top = G - 1 + Math.round(Math.sin(t * Math.PI) * 5);
      g.box(bx0, top - 1, z, bx1, top, z, c.wood);
      g.box(bx0, G - 6, z, bx1, top - 2, z, (x) => (z % 6 === 0 && (x === bx0 || x === bx1) ? c.lacquerDark : 0));
      for (const xr of [bx0 - 1, bx1 + 1]) { g.set(xr, top + 2, z, c.lacquer); if (z % 3 === 0) g.box(xr, top + 1, z, xr, top + 2, z, c.lacquer); }
    }
    b.occlude(ix - 8, iz - 8, ix + 8, iz + 8, 3, 1.2, 'landmark');
  }
  // swan boats tied up at a little jetty
  {
    const jx = POND.cx - 30, jz = POND.cz + POND.rz - 3;
    g.box(jx, G - 1, jz - 2, jx + 10, G - 1, jz + 6, c.wood);
    for (let i = 0; i < 2; i++) {
      const sx = jx + 1 + i * 6, sz = jz - 7;
      g.box(sx, G - 3, sz, sx + 3, G - 2, sz + 4, c.templeWhite);
      g.box(sx + 1, G - 1, sz + 3, sx + 2, G + 1, sz + 4, c.templeWhite);
      g.set(sx + 1, G + 1, sz + 4, c.vermilion);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Inari hill: a path climbing through a tunnel of torii to a fox shrine

/** The path up the hill (metres), from the street to the summit. */
export const INARI_PATH: [number, number][] = [[-35, 64.6], [-35, 72], [-42, 78], [-52, 80], [-58, 86], [-55, 92], [-49, 95]];

function inari(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  // walk the path, flattening a 2 m wide trail into the slope and raising a torii every 50 cm
  let n = 0;
  for (let i = 0; i + 1 < INARI_PATH.length; i++) {
    const [ax, az] = INARI_PATH[i], [bx, bz] = INARI_PATH[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / len, uz = (bz - az) / len;
    for (let s = 0; s < len; s += 0.25) {
      const mx = ax + ux * s, mz = az + uz * s;
      const vx = Math.round(mx / V), vz = Math.round(mz / V);
      const h = Math.min(hillAt(vx, vz), 20);
      for (let w = -4; w <= 4; w++) {
        const px = Math.round(mx / V - uz * w), pz = Math.round(mz / V + ux * w);
        const hh = hillAt(px, pz);
        if (hh > h) g.box(px, G - 1 + h + 1, pz, px, G - 1 + hh, pz, 0);
        if (hh < h) g.box(px, G - 1 + hh, pz, px, G - 2 + h, pz, c.earth);
        g.set(px, G - 1 + h, pz, Math.abs(w) <= 2 ? (hash3(px, pz, 4) < 0.5 ? c.stoneStep : c.gravel) : c.moss);
      }
      if (n++ % 2 === 0 && s > 1) {
        // a torii across the trail: posts beside it, beams over it
        const posts = [-4, 4].map((w) => [Math.round(mx / V - uz * w), Math.round(mz / V + ux * w)]);
        for (const [px, pz] of posts) {
          const base = G + Math.min(hillAt(px, pz), h) ;
          g.box(px, base, pz, px, G + h + 11, pz, c.torii);
          g.set(px, base, pz, c.toriiBlack);
        }
        for (let w = -5; w <= 5; w++) {
          const px = Math.round(mx / V - uz * w), pz = Math.round(mz / V + ux * w);
          g.set(px, G + h + 9, pz, c.torii);
          g.set(px, G + h + 12, pz, Math.abs(w) === 5 ? c.torii : c.toriiBlack);
          if (Math.abs(w) < 5) g.set(px, G + h + 12, pz, c.toriiBlack);
        }
      }
    }
  }
  // the summit: a small vermilion shrine with fox guardians, a bench with a view
  {
    const [mx, mz] = INARI_PATH[INARI_PATH.length - 1];
    const sx = Math.round(mx / V), sz = Math.round(mz / V);
    const h = hillAt(sx, sz);
    const y0 = G + h;
    g.box(sx - 10, y0 - 1, sz - 4, sx + 10, y0 - 1, sz + 14, c.gravel);
    g.box(sx - 10, y0, sz - 4, sx + 10, y0 + 8, sz + 14, 0);
    g.box(sx - 4, y0, sz + 6, sx + 4, y0 + 1, sz + 12, c.stoneStep);
    g.box(sx - 3, y0 + 2, sz + 7, sx + 3, y0 + 8, sz + 11, c.torii);
    g.box(sx - 1, y0 + 2, sz + 7, sx + 1, y0 + 6, sz + 7, c.woodDark);
    for (let l = 0; l < 4; l++) g.box(sx - 5 + l, y0 + 9 + l, sz + 5 + l, sx + 5 - l, y0 + 9 + l, sz + 13 - l, l === 3 ? c.roofRidge : c.roofTile);
    for (const fx of [sx - 6, sx + 6]) {
      g.box(fx - 1, y0, sz + 4, fx + 1, y0 + 2, sz + 6, c.stoneStep);
      // a white fox sitting up, red bib, tail curled
      g.box(fx - 1, y0 + 3, sz + 4, fx + 1, y0 + 5, sz + 6, c.foxWhite);
      g.box(fx, y0 + 6, sz + 4, fx, y0 + 7, sz + 5, c.foxWhite);
      g.set(fx, y0 + 5, sz + 4, c.torii);
      g.set(fx + (fx < sx ? -1 : 1), y0 + 7, sz + 5, c.foxWhite);
      b.block((fx - 1) * V, (sz + 4) * V, (fx + 2) * V, (sz + 7) * V);
    }
    b.lamp(sx * V, h * V + 1.8, (sz + 4) * V, WARM, 5, 0.9);
    b.block((sx - 4) * V, (sz + 6) * V, (sx + 5) * V, (sz + 13) * V);
    b.occlude(sx - 6, sz + 4, sx + 6, sz + 14, h * V + 4, h * V + 1, 'landmark');
  }
  // the hill's wood
  const r = rng(3131);
  for (let z = HILL[1] + 10; z < HILL[3] - 6; z += 16)
    for (let x = HILL[0] + 8; x < HILL[2] - 6; x += 17) {
      const jx = x + Math.floor(r() * 8), jz = z + Math.floor(r() * 8);
      let near = false;
      for (const [px, pz] of INARI_PATH) if (Math.hypot(jx * V - px, jz * V - pz) < 5) near = true;
      if (near) continue;
      tree(b, jx, jz, 3100 + x * 5 + z, r() < 0.4 ? 'maple' : r() < 0.6 ? 'pine' : 'keyaki', G + hillAt(jx, jz));
    }
  // stone fox and a big torii at the foot of the hill, by the street
  torii(b, -147, 262, 14, 24);
  for (const x of [-151, -129]) {
    g.box(x, G, 262, x + 2, G + 3, 264, c.stoneStep);
    g.box(x, G + 4, 262, x + 2, G + 6, 264, c.foxWhite);
    g.box(x + 1, G + 7, 262, x + 1, G + 8, 263, c.foxWhite);
    g.set(x + 1, G + 6, 262, c.torii);
    b.block(x * V, 262 * V, (x + 3) * V, 265 * V);
  }
  b.place(jizo(k), -36 * V, 0, 262 * V);
}

// ---------------------------------------------------------------------------------------------
// Residential corners: gardens, a sento with its chimney, potted plants and bicycles

function gardens(b: Builder, x0: number, z0: number, x1: number, z1: number, seed: number) {
  const g = b.grid, c = b.c;
  const r = rng(seed);
  noteGarden(b, x0, z0, x1, z1);
  for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
    const h = hash3(x, z, seed);
    g.set(x, G - 1, z, h < 0.5 ? c.grass : h < 0.8 ? c.grassDark : c.soil);
  }
  for (let x = x0; x <= x1; x += 18 + Math.floor(r() * 10)) {
    const z = z0 + 3 + Math.floor(r() * Math.max(1, z1 - z0 - 6));
    tree(b, x + 4, z, seed + x, r() < 0.4 ? 'maple' : r() < 0.5 ? 'pine' : 'keyaki');
    // a little shed or a vegetable plot
    if (r() < 0.5) {
      g.box(x + 9, G, z0 + 1, x + 13, G + 6, z0 + 4, c.woodMid);
      g.box(x + 8, G + 7, z0, x + 14, G + 7, z0 + 5, c.steelDark);
      b.block((x + 9) * V, (z0 + 1) * V, (x + 14) * V, (z0 + 5) * V);
    } else {
      for (let zz = z0 + 1; zz < Math.min(z1, z0 + 7); zz += 2) for (let xx = x + 8; xx < x + 15; xx++) g.set(xx, G, zz, hash3(xx, zz, 3) < 0.6 ? c.leaf : c.mustard);
      b.block((x + 8) * V, (z0 + 1) * V, (x + 15) * V, Math.min(z1, z0 + 7) * V);
    }
  }
}

function sento(b: Builder, x0: number, z0: number, x1: number, z1: number) {
  const g = b.grid, c = b.c, k = b.k;
  const lot = new Lot(b, x0, z0, x1, z1, 's');
  const { H } = building(lot, { floors: 2, style: 'machiya', ground: 'plain', seed: 7070, wall: c.plaster, roof: 'tiled' });
  // the grand gabled entrance with a noren
  const w = lot.width;
  const ma = Math.floor(w / 2);
  lot.box(ma - 6, 0, -4, ma + 6, 0, -1, c.stoneStep);
  for (const a of [ma - 6, ma + 6]) lot.box(a, 1, -4, a, 14, -4, c.woodDark);
  for (let l = 0; l < 6; l++) lot.box(ma - 8 + l, 15 + l, -6, ma + 8 - l, 15 + l, 0, l === 5 ? c.roofRidge : c.roofTile);
  lot.wallProp(noren(k, 18, k.c.indigo, k.c.norenWhite, 7, 2), ma + 0.5, 1.3, 0.05);
  const [lx, lz] = lot.front(ma, 1.2);
  b.lamp(lx, 2.6, lz, WARM, 5, 1.0);
  b.emitters.push({ kind: 'steam', pos: [lx, 3.4, lz - 4], rate: 0.4 });
  // the tall brick chimney behind
  const [cx, cz] = lot.xz(w - 5, lot.depth - 5);
  for (let y = G; y < G + H + 64; y++) {
    const rr = y > G + H + 58 ? 2 : 3;
    g.box(cx - rr, y, cz - rr, cx + rr, y, cz + rr, (x, yy, z) => (x === cx - rr || x === cx + rr || z === cz - rr || z === cz + rr ? ((yy + x + z) % 5 === 0 ? c.brickDark : c.brick) : g.get(x, yy, z)));
  }
  g.box(cx - 3, G + H + 50, cz - 3, cx + 3, G + H + 50, cz + 3, c.trim);
  b.occlude(cx - 3, cz - 3, cx + 3, cz + 3, (H + 64) * V, 3, 'landmark');
}

// ---------------------------------------------------------------------------------------------
// Street furniture along the new streets

function furnish(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const r = rng(6060);
  const doors = b.rooms.map((rm) => rm.door);
  for (const s of STREETS) {
    if (s.kind === 'arcade') continue;
    const len = s.ew ? s.x1 - s.x0 : s.z1 - s.z0;
    const step = s.kind === 'avenue' ? 48 : s.kind === 'street' ? 40 : 56;
    for (let t = 12; t < len - 6; t += step) {
      const along = (s.ew ? s.x0 : s.z0) + t;
      // keep clear of crossings and the canal
      if (STREETS.some((o) => o !== s && o.ew !== s.ew && along >= (s.ew ? o.x0 : o.z0) - 8 && along <= (s.ew ? o.x1 : o.z1) + 8)) continue;
      if (!s.ew && along >= 160 && along <= 210) continue;
      if (s.ew && inOld(along, s.z0)) continue;
      const side = (t / step) % 2 ? 1 : 0;
      const across = side ? (s.ew ? s.z1 : s.x1) - 3 : (s.ew ? s.z0 : s.x0) + 3;
      // slide along the kerb until neither the post nor its clutter (2.4 m on) stands in front of a door
      let a = along * V;
      const xzAt = (u: number): [number, number] => (s.ew ? [u, across * V] : [across * V, u]);
      const byDoor = (u: number) => [u - 0.8, u + 0.8, u + 1.6, u + 3.4].some((v) => { const [px, pz] = xzAt(v); return doors.some(([dx, dz]) => Math.hypot(dx - px, dz - pz) < 2.8); });
      for (let k = 0; k < 4 && byDoor(a); k++) a += 1.5;
      if (byDoor(a)) continue;
      // the whole group (pole, then up to 4 m of bikes or plants) must stay on this street's own pavement
      const u0 = a / V - 4, u1 = a / V + 18;
      if (u1 > (s.ew ? s.x1 : s.z1) - 2) continue;
      if (STREETS.some((o) => o !== s && o.ew !== s.ew && u1 >= (s.ew ? o.x0 : o.z0) - 4 && u0 <= (s.ew ? o.x1 : o.z1) + 4)) continue;
      if (!s.ew && u1 >= 156 && u0 <= 214) continue;
      const [x, z] = xzAt(a);
      if (s.kind === 'avenue' || s.kind === 'street') {
        b.place(streetLamp(k), x, 0, z, s.ew ? (side ? 2 : 0) : (side ? 3 : 1));
        b.lamp(x, 3.6, z, WHITEWARM, 7, 0.9);
        b.block(x - 0.3, z - 0.3, x + 0.3, z + 0.3);
      } else {
        // utility pole with a transformer can and wires, the lanes' street lights
        const vx = Math.round(x / V), vz = Math.round(z / V);
        g.box(vx, G, vz, vx, G + 34, vz, c.concrete);
        g.box(s.ew ? vx - 3 : vx, G + 30, s.ew ? vz : vz - 3, s.ew ? vx + 3 : vx, G + 30, s.ew ? vz : vz + 3, c.steelDark);
        g.box(vx, G + 22, vz, vx, G + 24, vz, c.steel);
        b.lamp(x, 4.2, z, WHITEWARM, 6, 0.7);
        b.block(x - 0.15, z - 0.15, x + 0.4, z + 0.4);
        b.place(wire(k, step * V - 0.3, 0.6), s.ew ? x + step * V / 2 : x, 7.4, s.ew ? z : z + step * V / 2, s.ew ? 0 : 1);
      }
      // now and then: a vending machine pair, parked bikes, a post box, potted plants
      const roll = r();
      const off = 2.4;
      const [fx, fz] = s.ew ? [x + off, z] : [x, z + off];
      if (roll < 0.25 && s.kind !== 'avenue') {
        const turns = s.ew ? (side ? 2 : 0) : (side ? 3 : 1);
        b.place(vendingMachine(k, [k.c.vmRed, k.c.vmBlue, k.c.vmWhite][Math.floor(r() * 3)], Math.floor(r() * 1e5)), fx, 0, fz, turns);
        b.lamp(fx, 1.2, fz, COOL, 3, 0.8);
        b.block(fx - 0.5, fz - 0.5, fx + 0.5, fz + 0.5);
      } else if (roll < 0.45) {
        for (let i = 0; i < 3; i++) b.place(bicycle(k, [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed][i]), s.ew ? fx + i * 0.7 : fx, 0, s.ew ? fz : fz + i * 0.7, s.ew ? 0 : 1);
        if (s.ew) b.block(fx - 0.7, fz - 0.35, fx + 2.1, fz + 0.35); else b.block(fx - 0.35, fz - 0.7, fx + 0.35, fz + 2.1);
      } else if (roll < 0.55) {
        b.place(postBox(k), fx, 0, fz);
        b.block(fx - 0.3, fz - 0.3, fx + 0.3, fz + 0.3);
      } else if (roll < 0.75 && s.kind !== 'avenue') {
        b.place(plantPot(k, r() < 0.5 ? 'bamboo' : 'shrub', Math.floor(r() * 1e5)), fx, 0, fz);
        b.place(plantPot(k, 'flowers', Math.floor(r() * 1e5)), s.ew ? fx + 0.8 : fx, 0, s.ew ? fz : fz + 0.8);
        if (s.ew) b.block(fx - 0.4, fz - 0.4, fx + 1.2, fz + 0.4); else b.block(fx - 0.4, fz - 0.4, fx + 0.4, fz + 1.2);
      } else if (roll < 0.85) {
        b.place(binCorner(k), fx, 0, fz, s.ew ? 0 : 1);
        b.block(fx - 0.4, fz - 0.4, fx + 0.4, fz + 0.4);
      } else if (s.kind === 'lane' || s.kind === 'alley') {
        b.place(scooter(k, [k.c.cubRed, k.c.cubCream, k.c.vmBlue][Math.floor(r() * 3)]), fx, 0, fz, s.ew ? 0 : 1);
        b.block(fx - 0.9, fz - 0.9, fx + 0.9, fz + 0.9);
      }
    }
  }
  // the back alley behind Kaminari Lane: meters, AC units, bins and the odd potted tree against the backs
  for (let x = 44; x < 274; x += 9 + Math.floor(r() * 9)) {
    const z = 0.55;
    const roll = r();
    if (roll < 0.35) { b.place(acUnit(k), x * V, 0, z, 2); b.block(x * V - 0.4, 0, x * V + 0.4, 0.9); }
    else if (roll < 0.55) { b.place(binCorner(k), x * V, 0, z, 2); b.block(x * V - 0.4, 0, x * V + 0.4, 0.9); }
    else if (roll < 0.75) { b.place(plantPot(k, r() < 0.5 ? 'bamboo' : 'pine', x), x * V, 0, z); b.block(x * V - 0.4, 0, x * V + 0.4, 0.9); }
    else if (roll < 0.85) { b.place(crateStack(k, x), x * V, 0, z + 0.1); b.block(x * V - 0.5, 0, x * V + 0.5, 1.1); }
  }
  // a cat-friendly bollard pair at each end of the alley
  for (const x of [-0.5, 72.3]) for (const z of [-5.2, -1.2]) { b.place(bollard(k), x, 0, z); b.block(x - 0.12, z - 0.12, x + 0.12, z + 0.12); }
}

// ---------------------------------------------------------------------------------------------
// Canal: the promenade, its trees and the far bank continue east and west, with two new bridges

function canal(b: Builder) {
  const g = b.grid, c = b.c, k = b.k;
  const outside = (x: number) => x < 0 || x > 287;
  // stone railing along the water, tree pits, lamps and benches on the promenade
  for (let x = XW + 4; x < XE - 4; x += 4) {
    if (!outside(x) || (x >= -42 && x <= 1) || (x >= 286 && x <= 329)) continue;
    g.box(x, G, 170, x, G + 2, 170, c.stone);
    g.box(x, G + 2, 170, x + 3, G + 2, 170, c.stone);
  }
  let i = 0;
  for (let x = XW + 12; x < XE - 8; x += 24, i++) {
    if (!outside(x) || (x >= -48 && x <= 6) || (x >= 280 && x <= 334)) continue;
    for (let z = 162; z <= 168; z++) for (let xx = x - 3; xx <= x + 3; xx++) g.set(xx, G - 1, z, hash3(xx, z, 1) < 0.35 ? c.petal : c.soil);
    sakuraTree(b, x, 165, 7000 + x);
    b.block(x * V - 0.1, 165 * V - 0.1, x * V + 0.65, 165 * V + 0.65);
    // far bank cherries too
    sakuraTree(b, x + 12, 211, 7500 + x);
    b.block((x + 12) * V - 0.1, 211 * V - 0.1, (x + 12) * V + 0.65, 211 * V + 0.65);
    if (i % 2 === 0) {
      const lx = (x + 12) * V;
      b.place(streetLamp(k), lx, 0, 168 * V, 0);
      b.lamp(lx + 0.5, 3.4, 168 * V, WHITEWARM, 7, 1.0);
      b.block(lx - 0.3, 168 * V - 0.25, lx + 0.2, 168 * V + 0.25);
    } else {
      const bx = (x + 12) * V;
      b.place(bench(k), bx, 0, 167.2 * V, 0);
      b.benches.push([bx, 167.2 * V, 0]);
      b.block(bx - 0.9, 167.2 * V - 0.35, bx + 0.9, 167.2 * V + 0.35);
    }
  }
  // far bank houses for the new stretches
  for (const [a0, a1] of [[XW, -41], [328, XE]] as [number, number][]) {
    const r = rng(a0 & 0xffff);
    let x = a0;
    while (x <= a1) {
      const w = Math.min(a1 - x + 1, 20 + Math.floor(r() * 3) * 4);
      const lot = new Lot(b, x, 216, x + w - 1, 223, 'n');
      const wall = [c.plaster, c.woodDark, c.cedar][Math.floor(r() * 3)];
      lot.box(0, 0, 0, w - 1, 9, lot.depth - 1, wall);
      lot.box(2, 1, 0, w - 3, 7, 0, (a) => (a % 2 ? c.woodDark : c.shoji));
      lot.box(0, 0, 0, w - 1, 0, lot.depth - 1, (a, _y, d) => (lot.get(a, 0, d) === wall ? c.stone : lot.get(a, 0, d)));
      lot.box(0, 8, -1, w - 1, 8, -1, c.woodDark);
      wrapLot(lot, { h: 10, gh: 10, fh: 12, wall, trim: c.woodDark, look: wall === c.plaster ? 'plain' : 'wood', seed: x * 7 + 5, pipe: wall === c.plaster });
      tiledRoof(lot, 10, 2, 2);
      noteFront(lot, 'plain', 'machiya', 'canal', 10, x * 7 + 3, [], true);
      x += w;
    }
  }
  // keep walkers out of the water except on the bridges (the old district blocks its own stretch)
  for (const [x0, x1] of [[XW, -39], [-2, -1], [288, 290], [325, XE]] as [number, number][]) b.block(x0 * V, 172 * V, (x1 + 1) * V, 200 * V - 0.01);
  bridge(b, -38, -3, 'stone');
  bridge(b, 291, 324, 'stone');
  boat(b, -140, 176, 20, 11);
  boat(b, 400, 190, 22, 12);
  boat(b, -250, 186, 18, 13);
}

// ---------------------------------------------------------------------------------------------

export interface CityResult {
  nodes: [number, number][];
  /** Edges between city nodes (indices into nodes) and links to the old district's nodes (negative: -(i + 1)). */
  edges: [number, number][];
  idlers: { id: string; pos: [number, number, number] }[];
  cats: [number, number, number][];
}

export function buildCity(b: Builder): CityResult {
  paint(b);
  viaduct(b);
  station(b);
  shrine(b);
  arcade(b);
  park(b);
  inari(b);
  canal(b);

  // the old district's east end opens onto Neon-dori: its walls become building fronts
  building(new Lot(b, 280, 0, 287, 35, 'e'), { floors: 4, style: 'modern', ground: 'plain', seed: 4401, wall: b.c.tileWhite });
  building(new Lot(b, 280, 64, 287, 151, 'e'), { floors: 5, style: 'apartment', ground: 'plain', seed: 4402 });

  // north block between the back alley and Hikari-dori
  frontage(b, 's', 0, 287, -44, -25, 4001, 'shops');
  frontage(b, 'n', 0, 287, -72, -45, 4002, 'shops');

  // the neon quarter east of Neon-dori
  for (const [za, zb] of [[-72, 35], [64, 151]] as [number, number][]) {
    frontage(b, 'w', za, zb, 328, 375, 4500 + za, 'tower', 20, 32);
    frontage(b, 'e', za, zb, 424, 447, 4600 + za, 'bars', 8, 12);
    frontage(b, 'w', za, zb, 464, 487, 4700 + za, 'bars', 8, 12);
  }
  for (const [xa, xb] of [[376, 423], [488, XE]] as [number, number][]) {
    frontage(b, 'n', xa, xb, -72, -21, 4800 + xa, 'tower', 20, 32);
    frontage(b, 's', xa, xb, -20, 35, 4900 + xa, 'tower', 20, 32);
    frontage(b, 'n', xa, xb, 64, 111, 5000 + xa, 'tower', 20, 28);
    frontage(b, 's', xa, xb, 112, 151, 5100 + xa, 'canal', 16, 24);
  }
  // towers north of the avenue, east of Neon-dori
  frontage(b, 's', 328, XE, -144, -113, 5200, 'tower', 20, 32);
  frontage(b, 'n', 328, XE, -184, -145, 5300, 'bars', 12, 16);

  // the residential west: lanes of low houses, gardens in the middle of the blocks, a bathhouse
  for (const [xa, xb] of [[XW, -193], [-128, -89]] as [number, number][]) {
    frontage(b, 'n', xa, xb, -72, -53, 5400 + xa, 'homes');
    frontage(b, 's', xa, xb, -52, -33, 5500 + xa, 'homes');
    frontage(b, 'n', xa, xb, -16, 13, 5600 + xa, 'homes');
    gardens(b, xa, 14, xb, 29, 5650 + xa);
    if (xa === -128) sento(b, xa, 30, xb, 59);
    else frontage(b, 's', xa, xb, 30, 59, 5700 + xa, 'homes');
    frontage(b, 'n', xa, xb, 76, 107, 5800 + xa, 'homes');
    gardens(b, xa, 108, xb, 119, 5850 + xa);
    frontage(b, 's', xa, xb, 120, 151, 5900 + xa, 'canal');
  }
  for (const [za, zb] of [[-72, -33], [-16, 59], [76, 151]] as [number, number][]) {
    frontage(b, 'e', za, zb, -88, -41, 6000 + za, 'homes', 16, 24);
    frontage(b, 'e', za, zb, -192, -169, 6100 + za, 'homes', 12, 20);
    frontage(b, 'w', za, zb, -152, -129, 6200 + za, 'homes', 12, 20);
  }

  // south of Minami-dori, around the arcade
  for (const [xa, xb] of [[0, 79], [208, 287]] as [number, number][]) {
    frontage(b, 'n', xa, xb, 260, 303, 6300 + xa, 'shops');
    frontage(b, 's', xa, xb, 316, 359, 6400 + xa, 'homes');
    frontage(b, 'n', xa, xb, 376, 415, 6500 + xa, 'homes');
    gardens(b, xa, 304, xb, 315, 6450 + xa);
    gardens(b, xa, 416, xb, ZS, 6550 + xa);
  }

  furnish(b);
  const res = graph();
  dress(b, res);
  tokyoEdge(b);
  return res;
}

/** Street graph for the walkers: junctions and points along the new streets (metres). */
function graph(): CityResult {
  const nodes: [number, number][] = [];
  const edges: [number, number][] = [];
  const at = (x: number, z: number) => { nodes.push([x, z]); return nodes.length - 1; };
  const link = (a: number, b: number) => edges.push([a, b]);
  const old = (i: number) => -(i + 1);
  // Nishi-dori (x -5) and Neon-dori (x 76.9), north to south
  const nx = -5.1, ex = 76.9;
  const nN = at(nx, -23.1), nAlley = at(nx, -3.1), nPlaza = at(nx, 4.3), nKita = at(nx, -6.1), nYan = at(nx, 16.9), nProm = at(nx, 40), nFar = at(nx, 52), nMin = at(nx, 60.4), nS = at(nx, 92);
  const eN = at(ex, -23.1), eAlley = at(ex, -3.1), eKam = at(ex, 12.5), eProm = at(ex, 40), eFar = at(ex, 52), eMin = at(ex, 60.4), eS = at(ex, 92), eGado = at(ex, -48.1);
  for (const [a, bb] of [[nN, nKita], [nKita, nAlley], [nAlley, nPlaza], [nPlaza, nYan], [nYan, nProm], [nProm, nFar], [nFar, nMin], [nMin, nS], [eGado, eN], [eN, eAlley], [eAlley, eKam], [eKam, eProm], [eProm, eFar], [eFar, eMin], [eMin, eS]]) link(a, bb);
  // to the old district: the plaza, Kaminari Lane's east end, the promenade and far bank ends
  link(nPlaza, old(19)); link(eKam, old(2)); link(nProm, old(5)); link(nFar, old(12)); link(eProm, old(9)); link(eFar, old(13));
  // Hikari-dori and the station square
  const hW = at(-60, -23.1), hShrine = at(-40, -23.1), hSt = at(36, -23.1), hE = at(120, -23.1), sq = at(29, -33), stIn = at(36, -41.5), gado = at(36, -48.1), gadoW = at(-40, -48.1), gadoE = at(120, -48.1);
  for (const [a, bb] of [[hW, hShrine], [hShrine, nN], [nN, hSt], [hSt, eN], [eN, hE], [hSt, sq], [sq, stIn], [gado, gadoW], [gado, eGado], [eGado, gadoE]]) link(a, bb);
  const shrine = at(-40, -34), hall = at(-40, -38.5);
  link(hShrine, shrine); link(shrine, hall);
  // the back alley
  const ua = at(36, -3.1);
  link(nAlley, ua); link(ua, eAlley);
  // west lanes
  const kW = at(-60, -6.1), yW = at(-60, 16.9), kiN = at(-40, -6.1), kiY = at(-40, 16.9), kiP = at(-40, 40);
  for (const [a, bb] of [[nKita, kiN], [kiN, kW], [nYan, kiY], [kiY, yW], [kiN, kiY], [kiY, kiP], [kiP, nProm], [hShrine, kiN]]) link(a, bb);
  // the neon quarter: Center-gai and Golden lane
  const cg1 = at(100, 12.5), cg2 = at(114, 12.5), cg3 = at(135, 12.5), gl1 = at(114, -10), gl2 = at(114, 30), gl3 = at(114, -23.1);
  for (const [a, bb] of [[eKam, cg1], [cg1, cg2], [cg2, cg3], [cg2, gl1], [gl1, gl3], [gl3, hE], [cg2, gl2], [gl2, at(114, 40)]]) link(a, bb);
  link(nodes.length - 1, eProm);
  // Minami-dori, the arcade, the park and the hill
  const mA = at(36, 60.4), mPark = at(111, 60.4), mHill = at(-40, 60.4);
  link(nMin, mA); link(mA, eMin); link(eMin, mPark); link(nMin, mHill);
  const ar1 = at(35.9, 70), ar2 = at(35.9, 91.9), ar3 = at(35.9, 105);
  link(mA, ar1); link(ar1, ar2); link(ar2, ar3);
  const sk = at(10, 91.9);
  link(ar2, sk); link(sk, nS); link(ar2, at(64, 91.9)); link(nodes.length - 1, eS);
  const pk1 = at(111, 70), pk2 = at(95, 89), pk3 = at(124, 99), pkW = at(84, 89.4);
  link(mPark, pk1); link(pk1, pk2); link(pk2, pk3); link(pkW, pk2); link(pkW, eS);
  const hill1 = at(-35, 66), hill2 = at(-49, 95);
  link(mHill, hill1); link(hill1, hill2);
  return {
    nodes, edges,
    idlers: [],
    cats: [[-60, 0, 7], [36, 0, -47.5], [112, 0, 20], [95, 0, 101], [-42, 0, 92]],
  };
}
