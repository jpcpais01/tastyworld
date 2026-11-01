// Set dressing for the city: the small things that make a street look lived in. Potted gardens, bikes, umbrella
// stands and wind chimes along the house fronts, lantern strings and bunting over the lanes, trees, planters and
// benches down the pedestrian streets, grass, bushes and a playground in the green.
//
// It runs once the city is built and reads only the builder's own lists (footprints, blockers, doors and the lots
// and gardens it was told about), never the voxel grid, so every worker strip places exactly the same things.
import { hash3, rng } from './grid';
import { G, V, HILL } from './layout';
import { Builder, Lot, Ground, Style, RED, WARM, WHITEWARM, COOL, OLD_GRAPH, OLD_KEEP } from './tokyo';
import {
  Prop, rotateProp, potCluster, plantPot, bicycle, umbrellaStand, gasTanks, crateStack, binCorner, hangingSign, furin, aFrame, stool, cafeTable, scooter, nobori,
  lantern, wire, bunting, streetPlanter, bannerPole, utilityBox, workBarrier, trafficCone, bench, bush, grassTuft, laundryRack, swingSet, slide, vendingMachine,
} from './props';
import { roadMarks, signals, rails, lanes, paper } from './details';
import { STREETS, Street, streetAt, tree, hillAt, INARI_PATH, CityResult } from './city';

// ---------------------------------------------------------------------------------------------
// What the city tells us while it builds

export interface Front { lot: Lot; ground: Ground; style: Style; mix: string; H: number; seed: number; doors: number[]; low: boolean }
type Rect = [number, number, number, number];
const notes = new WeakMap<Builder, { fronts: Front[]; gardens: Rect[]; trees: [number, number][] }>();
const notesOf = (b: Builder) => {
  let n = notes.get(b);
  if (!n) notes.set(b, (n = { fronts: [], gardens: [], trees: [] }));
  return n;
};

/** Facade coordinate a (voxels) of a point in metres. */
function aOf(lot: Lot, x: number, z: number): number {
  switch (lot.side) {
    case 's': return x / V - lot.x0;
    case 'n': return lot.x1 + 1 - x / V;
    case 'e': return lot.z1 + 1 - z / V;
    case 'w': return z / V - lot.z0;
  }
}

/** A building front to dress; `doors` are the room doors it got (world metres, just inside). `low` for one-storey sheds. */
export function noteFront(lot: Lot, ground: Ground, style: Style, mix: string, H: number, seed: number, doors: [number, number][], low = false): void {
  notesOf(lot.b).fronts.push({ lot, ground, style, mix, H, seed, doors: doors.map(([x, z]) => aOf(lot, x, z)), low });
}
/** A back garden (inclusive voxel rect). */
export function noteGarden(b: Builder, x0: number, z0: number, x1: number, z1: number): void {
  notesOf(b).gardens.push([x0, z0, x1, z1]);
}
/** A tree trunk (voxels), so tall things like the swings keep out from under its crown. */
export function noteTree(b: Builder, x: number, z: number): void {
  notesOf(b).trees.push([x, z]);
}

// ---------------------------------------------------------------------------------------------
// Free space: everything already standing on the ground, plus what we place

const CELL = 4;
class Space {
  private cells = new Map<number, number[]>();
  private key(ix: number, iz: number) { return (ix + 512) * 1024 + iz + 512; }
  add(r: Rect): void {
    for (let ix = Math.floor(r[0] / CELL); ix <= Math.floor(r[2] / CELL); ix++)
      for (let iz = Math.floor(r[1] / CELL); iz <= Math.floor(r[3] / CELL); iz++) {
        const k = this.key(ix, iz);
        let l = this.cells.get(k);
        if (!l) this.cells.set(k, (l = []));
        l.push(r[0], r[1], r[2], r[3]);
      }
  }
  free(r: Rect, pad = 0.04): boolean {
    for (let ix = Math.floor((r[0] - pad) / CELL); ix <= Math.floor((r[2] + pad) / CELL); ix++)
      for (let iz = Math.floor((r[1] - pad) / CELL); iz <= Math.floor((r[3] + pad) / CELL); iz++) {
        const l = this.cells.get(this.key(ix, iz));
        if (!l) continue;
        for (let i = 0; i < l.length; i += 4)
          if (r[0] - pad < l[i + 2] && r[2] + pad > l[i] && r[1] - pad < l[i + 3] && r[3] + pad > l[i + 1]) return false;
      }
    return true;
  }
}

interface PutOpts { y?: number; block?: boolean; pad?: number }

export class Dresser {
  space = new Space();
  /** The crowd's walking graph (metres): street furniture keeps off it. */
  paths: [number, number, number, number][] = [];
  constructor(public b: Builder) {
    for (const r of b.blockers) this.space.add(r);
    for (const r of b.standing) this.space.add(r);
  }
  /** Footprint (metres) of `p` turned by `turns` and centred on (cx, cz). */
  rect(p: Prop, cx: number, cz: number, turns: number): Rect {
    const odd = ((turns % 4) + 4) % 2 === 1;
    const hx = (odd ? p.sz : p.sx) * p.scale / 2, hz = (odd ? p.sx : p.sz) * p.scale / 2;
    return [cx - hx, cz - hz, cx + hx, cz + hz];
  }
  /** Place a ground prop if its footprint is free; walkers go round it unless `block` is false. */
  put(p: Prop, cx: number, cz: number, turns = 0, o: PutOpts = {}): boolean {
    const r = this.rect(p, cx, cz, turns);
    if (!this.space.free(r, o.pad) || (o.block !== false && this.onPath(r))) return false;
    this.b.place(p, cx, o.y ?? 0, cz, turns);
    this.space.add(r);
    if (o.block !== false) this.b.block(r[0], r[1], r[2], r[3]);
    return true;
  }
  /** Ground prop flush against a facade, centred at facade coordinate a (voxels), `out` metres off the wall. */
  wallPut(lot: Lot, p: Prop, a: number, out: number, turnsExtra = 0, o: PutOpts = {}): boolean {
    const rp = rotateProp(p, turnsExtra);
    const [cx, cz] = lot.m(a, -(rp.sz * rp.scale / 2 + out) / V);
    return this.put(rp, cx, cz, lot.turns, o);
  }
  /** True when a rect comes within `r` metres of the walking graph. */
  onPath(q: Rect, r = 0.9): boolean {
    const cx = (q[0] + q[2]) / 2, cz = (q[1] + q[3]) / 2, hr = Math.hypot(q[2] - q[0], q[3] - q[1]) / 2;
    for (const [ax, az, bx, bz] of this.paths) {
      const lx = bx - ax, lz = bz - az, l2 = lx * lx + lz * lz || 1;
      const t = Math.max(0, Math.min(1, ((cx - ax) * lx + (cz - az) * lz) / l2));
      if (Math.hypot(cx - ax - lx * t, cz - az - lz * t) < r + hr) return true;
    }
    return false;
  }
  /** Mark a rect as taken without placing anything (tree pits, doorways). */
  take(r: Rect): void { this.space.add(r); }
}

// ---------------------------------------------------------------------------------------------

export function dress(b: Builder, city: CityResult): void {
  const n = notesOf(b);
  const d = new Dresser(b);
  for (const [i, j] of city.edges) if (i >= 0 && j >= 0) d.paths.push([...city.nodes[i], ...city.nodes[j]]);
  // the old district's walks, the links between the two, and the spots its people and cats stand on
  const node = (i: number) => (i < 0 ? OLD_GRAPH.nodes[-i - 1] : city.nodes[i]);
  for (const [i, j] of city.edges) if (i < 0 || j < 0) d.paths.push([...node(i), ...node(j)]);
  for (const [i, j] of OLD_GRAPH.edges) d.paths.push([...OLD_GRAPH.nodes[i], ...OLD_GRAPH.nodes[j]]);
  for (const [x, z] of OLD_KEEP) d.take([x - 0.7, z - 0.7, x + 0.7, z + 0.7]);
  for (const s of b.stallAnchors) d.take([s.stand[0] - 1.2, s.stand[1] - 1.2, s.stand[0] + 1.2, s.stand[1] + 1.2]);
  // keep every doorway clear first
  for (const f of n.fronts) for (const a of doorsOf(f)) {
    const h = doorHalf(f);
    const [x0, z0] = f.lot.front(a - h, 0), [x1, z1] = f.lot.front(a + h, 1.4);
    d.take([Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)]);
  }
  roadMarks(b);
  signals(d);
  rails(d);
  pedestrianStreets(d);
  plaza(d);
  for (const f of n.fronts) { front(d, f); paper(b, f); }
  overheads(d, n.fronts);
  lanes(d, n.fronts);
  park(d, n.trees);
  shrineWood(d);
  hill(d);
  for (const g of n.gardens) garden(d, g, n.trees);
}

/** Half the width (voxels) kept clear around a door: the doorway and its frame, and a step to the side. */
const doorHalf = (f: Front) => (f.doors.length ? 3.7 : f.ground === 'izakaya' || f.ground === 'soba' ? 3.2 : 2.7);

/** Facade coordinates of a front's doors (rooms report theirs; the rest are where building() cuts them). */
function doorsOf(f: Front): number[] {
  if (f.doors.length) return f.doors;
  const w = f.lot.width;
  if (f.ground === 'izakaya' || f.ground === 'soba') return [Math.max(2, Math.floor(w / 2) - 1) + 1.5];
  if (f.low) return [];
  return [Math.floor(w / 2) + 0.5];
}

const facing = (lot: Lot): Street | null => {
  const [x, z] = lot.front(lot.width / 2, 1);
  return streetAt(Math.floor(x / V), Math.floor(z / V));
};

// ---------------------------------------------------------------------------------------------
// House fronts: pots, bikes, umbrella stands, gas bottles, crates; a sign or a wind chime overhead

function front(d: Dresser, f: Front): void {
  const { lot } = f, b = d.b, k = b.k, w = lot.width;
  const r = rng(f.seed * 13 + 5);
  const st = facing(lot);
  if (st?.kind === 'arcade' && f.mix !== 'arcade') return;
  const avenue = st?.kind === 'avenue';
  const home = f.ground === 'plain' || f.ground === 'shutter';
  const bar = f.ground === 'izakaya' || f.ground === 'soba';
  // shop fronts have window sills and door frames standing a voxel proud of the wall
  const out = home && !f.doors.length ? 0.03 : 0.28;
  const doors = doorsOf(f);
  const dh = doorHalf(f);
  const nearDoor = (a0: number, a1: number) => doors.some((da) => a1 > da - dh && a0 < da + dh);

  // overhead first: a hanging shop sign at one end, a wind chime under the eaves
  // (heights fit under each front's cornice, awning or shutter box; the others have fascias in the way)
  const awninged = ['shop', 'cafe', 'books', 'bakery', 'florist', 'fish'].includes(f.ground);
  const arcade = f.mix === 'arcade'; // its steel frames stand against the fronts
  if (awninged && !arcade && !f.low && w >= 10 && r() < 0.55) {
    const bg = [k.c.signRed, k.c.signCream, k.c.signBlue, k.c.signGreen, k.c.woodDark, k.c.signBlack][Math.floor(r() * 6)];
    const fg = bg === k.c.signCream ? k.c.signBlack : k.c.white;
    lot.wallProp(hangingSign(k, bg, fg, f.seed), r() < 0.5 ? 1.4 : w - 1.4, 1.95, 0);
  }
  const fa = 3 + r() * (w - 6);
  if ((awninged || home) && !arcade && !f.low && f.mix !== 'tower' && !nearDoor(fa - 1, fa + 1) && r() < (home ? 0.4 : 0.25)) {
    const a = fa;
    lot.wallProp(furin(k, f.seed), a, (f.ground === 'shutter' ? 11 : home ? 13 : 12) * V - 0.625, 0.03);
  }
  // steam from the kitchen vent of noodle bars and bakeries
  if ((f.ground === 'soba' || f.ground === 'bakery' || f.ground === 'izakaya') && r() < 0.45) {
    const [sx, sz] = lot.front(r() < 0.5 ? 1.5 : w - 1.5, 0.2);
    b.emitters.push({ kind: 'steam', pos: [sx, 3.1, sz], rate: 0.22 });
  }
  if (f.mix === 'tower' && !avenue && r() < 0.6) return;
  const flags = () => {
    const cloth = [k.c.norenRed, k.c.navy, k.c.signYellow, k.c.signGreen, k.c.norenWhite][Math.floor(r() * 5)];
    return nobori(k, cloth, cloth === k.c.norenWhite || cloth === k.c.signYellow ? k.c.norenRed : k.c.white, Math.floor(r() * 1e5));
  };
  if (f.ground === 'shop') {
    // the goods tables fill the front; a banner flag stands out past the awning at one or both ends
    if (!avenue) for (const a of [1.5, w - 1.5]) if (r() < 0.6) d.wallPut(lot, flags(), a, 1.15);
    return;
  }

  // the clutter, in slots along the facade
  type Item = { p: () => Prop; len: number; turns?: number; out?: number; after?: (a: number) => void };
  const pots = (): Item => ({ p: () => potCluster(k, Math.floor(r() * 1e6)), len: 4 });
  const pot = (): Item => ({ p: () => plantPot(k, (['bamboo', 'pine', 'shrub', 'flowers'] as const)[Math.floor(r() * 4)], Math.floor(r() * 1e6)), len: 3 });
  const bike = (): Item => ({ p: () => bicycle(k, [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed, k.c.vmBlue, k.c.cubCream][Math.floor(r() * 5)]), len: 5.6 });
  const brolly = (): Item => ({ p: () => umbrellaStand(k, Math.floor(r() * 1e6)), len: 1.4 });
  const gas = (): Item => ({ p: () => gasTanks(k), len: 2.6 });
  const crates = (): Item => ({ p: () => crateStack(k, Math.floor(r() * 1e6)), len: 4.2 });
  const bins = (): Item => ({ p: () => binCorner(k), len: 3.6 });
  const vend = (): Item => ({ p: () => vendingMachine(k, [k.c.vmRed, k.c.vmBlue, k.c.vmWhite][Math.floor(r() * 3)], Math.floor(r() * 1e5)), len: 4.4, after: (a) => {
    const [x, z] = lot.front(a, 0.9);
    b.lamp(x, 1.2, z, COOL, 3, 0.7);
  } });
  const cabinet = (): Item => ({ p: () => utilityBox(k, Math.floor(r() * 100)), len: 3.4 });
  // a little road works against the wall: a barrier, cones either side
  const works = (): Item => ({ p: () => workBarrier(k), len: 9.5, after: (a) => {
    for (const da of [-3.9, 3.9]) d.wallPut(lot, trafficCone(k), a + da, out + 0.05);
  } });
  const board = (): Item => ({ p: () => aFrame(k, Math.floor(r() * 1e5)), len: 2.2 });
  const moped = (): Item => ({ p: () => scooter(k, [k.c.vmRed, k.c.vmBlue, k.c.cubCream, k.c.bikeMint][Math.floor(r() * 4)]), len: 6.4 });
  // a banner flag on its pole, out past the eaves and awnings
  const flag = (): Item => ({ p: flags, len: 3.6, out: 1.15 });
  // the standing bar: an upturned crate for a table, a stool either side
  const perch = (): Item => ({ p: () => crateStack(k, Math.floor(r() * 1e6)), len: 7.4, after: (a) => {
    for (const da of [-2.7, 2.7]) d.wallPut(lot, stool(k, k.c.lacquer), a + da, out + 0.1);
  } });
  // a café table out front with two stools
  const terrace = (): Item => ({ p: () => cafeTable(k, [k.c.white, k.c.norenRed, k.c.signCream][Math.floor(r() * 3)]), len: 6.4, out: 0.35, after: (a) => {
    for (const da of [-2.3, 2.3]) d.wallPut(lot, stool(k, k.c.woodDark), a + da, out + 0.3);
  } });
  const lane = !st || st.kind === 'lane' || st.kind === 'alley';
  const eatery = f.ground === 'cafe' || f.ground === 'kissa' || f.ground === 'bakery';
  // the avenue pavements keep their walking lanes: only slim things flush with the wall
  const menu: [number, () => Item][] = avenue ? [[3, pots], [1.5, brolly], [1, bins], [bar || f.ground === 'cafe' ? 2 : 1, board], [0.6, gas], [1.2, bike]]
    : home ? [[5, pots], [2, pot], [2.5, bike], [1, brolly], [1.2, gas], [0.8, bins], [0.8, cabinet], [1, moped], [lane ? 0.9 : 0, vend], [lane ? 0.12 : 0, works]]
    : bar ? [[3, crates], [1.5, brolly], [1.5, pots], [1, pot], [0.8, gas], [0.4, vend], [2.5, perch], [2, board], [1, flag], [0.6, bins]]
    : [[3, pots], [2.5, pot], [1.5, bike], [1.2, brolly], [0.6, crates], [0.5, vend], [0.3, cabinet], [1.8, board], [1.2, flag], [0.7, moped], [eatery ? 2.5 : 0, terrace]];
  const total = menu.reduce((s, [wgt]) => s + wgt, 0);
  const pickItem = () => { let t = r() * total; for (const [wgt, f] of menu) if ((t -= wgt) < 0) return f(); return menu[0][1](); };
  let placed = 0;
  const most = avenue ? 3 : home ? 7 : 6;
  for (let a = 1.4 + r() * 1.2; a < w - 1.4 && placed < most; ) {
    const it = pickItem();
    if (a + it.len > w - 1.3) { a += 1; continue; }
    if (nearDoor(a, a + it.len)) { a += 1.5; continue; }
    if (d.wallPut(lot, it.p(), a + it.len / 2, it.out ?? out, it.turns ?? 0)) { it.after?.(a + it.len / 2); placed++; a += it.len + 0.35 + r() * 1.6; } else a += 1.5;
  }
}

// ---------------------------------------------------------------------------------------------
// Strings of lanterns over the lanes and alleys, bunting over the shopping streets

function overheads(d: Dresser, fronts: Front[]): void {
  const b = d.b, k = b.k;
  // a wall of some building on each side to tie the wire to, clear of the signs at the corners of the facades
  const wallOn = (s: Street, first: boolean, along: number) => fronts.some(({ lot, H, mix }) => {
    if (H < 22) return false;
    const edge = s.ew ? (first ? lot.z1 + 1 === s.z0 : lot.z0 === s.z1 + 1) : (first ? lot.x1 + 1 === s.x0 : lot.x0 === s.x1 + 1);
    if (!edge) return false;
    const facade = s.ew ? lot.side === (first ? 's' : 'n') : lot.side === (first ? 'e' : 'w');
    const m = !facade ? 2 : mix === 'tower' ? 7 : 3;
    return s.ew ? along >= lot.x0 + m && along <= lot.x1 - m : along >= lot.z0 + m && along <= lot.z1 - m;
  });
  for (const s of STREETS) {
    if (s.kind === 'avenue' || s.kind === 'arcade' || s.name === 'Gado-shita') continue; // (the viaduct strings its own)
    const step = s.kind === 'alley' ? 20 : s.kind === 'lane' ? 30 : 44;
    const lo = s.ew ? s.x0 : s.z0, hi = s.ew ? s.x1 : s.z1;
    const width = (s.ew ? s.z1 - s.z0 : s.x1 - s.x0) + 1;
    const mid = s.ew ? (s.z0 + s.z1 + 1) / 2 : (s.x0 + s.x1 + 1) / 2;
    const r = rng(lo * 7 + mid);
    for (let at = lo + 10; at < hi - 8; at += step) {
      // the nearest spot to `at` with a wall on both sides
      let along = NaN;
      for (const dv of [0, 2, -2, 4, -4, 6, -6, 8, -8]) {
        const u = at + dv;
        if (STREETS.some((o) => o !== s && o.ew !== s.ew && u >= (s.ew ? o.x0 : o.z0) - 10 && u <= (s.ew ? o.x1 : o.z1) + 10)) continue;
        if (wallOn(s, true, u) && wallOn(s, false, u)) { along = u; break; }
      }
      if (Number.isNaN(along)) continue;
      const len = width * V - 0.06, turns = s.ew ? 1 : 0;
      const [cx, cz] = s.ew ? [(along + 0.5) * V, mid * V] : [mid * V, (along + 0.5) * V];
      const top = 5.0 + r() * 0.4; // wire ends, clear of first-floor balconies
      if (s.kind === 'street') {
        const sag = 0.7;
        const p = bunting(k, len, sag, along);
        b.place(p, cx, top - (p.sy - 0.5) * p.scale, cz, turns);
        continue;
      }
      // a wire with paper lanterns, the middle ones a little lower
      const sag = 0.45 + r() * 0.25;
      const wp = wire(k, len, sag);
      const y0 = top - (wp.sy - 0.5) * wp.scale;
      b.place(wp, cx, y0, cz, turns);
      b.swayParent = b.lastSway[0];
      const nl = s.kind === 'alley' ? 4 : 3;
      const cols = s.kind === 'alley' ? [k.c.lanternRed, k.c.lanternRed, k.c.lanternAmber] : [k.c.lanternRed, k.c.lanternWhite, k.c.lanternAmber];
      const col = cols[Math.floor(r() * cols.length)];
      for (let i = 0; i < nl; i++) {
        const t = 0.3 + 0.4 * i / (nl - 1); // clear of balconies near the walls
        const sagV = Math.max(1, Math.round(sag / 0.0625));
        const wy = y0 + (sagV + 1 - sagV * 4 * t * (1 - t)) * 0.0625;
        const u = (t - 0.5) * len;
        const lp = lantern(k, i % 2 ? col : cols[(cols.indexOf(col) + 1) % cols.length], 4, 5, along * 7 + i);
        b.place(lp, s.ew ? cx : cx + u, wy - lp.sy * lp.scale, s.ew ? cz + u : cz);
      }
      b.swayParent = 0;
      b.lamp(cx, top - sag - 0.6, cz, s.kind === 'alley' ? RED : WARM, 4, 0.55);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Pedestrian streets: two rows of trees, planters, benches and bike stands either side of a clear middle

function pedestrianStreets(d: Dresser): void {
  const b = d.b, k = b.k, g = b.grid, c = b.c;
  for (const s of STREETS) {
    if (s.kind !== 'street') continue;
    const width = (s.ew ? s.z1 - s.z0 : s.x1 - s.x0) + 1;
    const mid = s.ew ? (s.z0 + s.z1 + 1) / 2 : (s.x0 + s.x1 + 1) / 2;
    const lo = s.ew ? s.x0 : s.z0, hi = s.ew ? s.x1 : s.z1;
    const narrow = width < 32;
    const off = narrow ? 7.5 : 9.5; // voxels from the middle to each row: between the crowd's middle lanes and the window shoppers
    let i = 0;
    for (let along = lo + 14; along < hi - 10; along += 22, i++) {
      if (STREETS.some((o) => o !== s && o.ew !== s.ew && along >= (s.ew ? o.x0 : o.z0) - 14 && along <= (s.ew ? o.x1 : o.z1) + 14)) continue;
      if (!s.ew && along >= 150 && along <= 220) continue; // the canal
      for (const side of [-1, 1]) {
        const u = along + (side > 0 ? 11 : 0); // stagger the two rows
        if (u > hi - 10) continue;
        const v = mid + side * off;
        const [x, z] = s.ew ? [u * V, v * V] : [v * V, u * V];
        const turns = s.ew ? (side < 0 ? 0 : 2) : (side < 0 ? 1 : 3); // benches face the middle
        const kind = narrow ? (i + (side > 0 ? 1 : 0)) % 2 ? 'planter' : 'bench' : ['tree', 'pole', 'bench', 'bikes', 'tree', 'planter', 'pole', 'bench'][(i + (side > 0 ? 2 : 0)) % 8];
        if (kind === 'tree') {
          const pit: Rect = [x - 0.75, z - 0.75, x + 0.75, z + 0.75];
          if (!d.space.free(pit, 0.2) || d.onPath(pit)) continue;
          d.take(pit);
          const vx = Math.round(x / V), vz = Math.round(z / V);
          for (let zz = vz - 3; zz <= vz + 2; zz++) for (let xx = vx - 3; xx <= vx + 2; xx++) {
            const edge = xx === vx - 3 || xx === vx + 2 || zz === vz - 3 || zz === vz + 2;
            g.set(xx, G - 1, zz, edge ? c.graniteDark : hash3(xx, zz, 5) < 0.3 ? c.moss : c.grate);
          }
          tree(b, vx - 1, vz - 1, 8000 + u * 7 + side, 'keyaki', G, 13, 0.6);
        } else if (kind === 'pole') {
          const cl = [k.c.norenRed, k.c.navy, k.c.norenWhite, k.c.indigo][(u >> 3) % 4];
          if (d.put(bannerPole(k, cl, cl === k.c.norenWhite ? k.c.norenRed : k.c.white, u), x, z, turns, { pad: 0.1 })) b.lamp(x, 3.6, z, WHITEWARM, 6, 0.75);
        } else if (kind === 'planter') {
          d.put(streetPlanter(k, u * 5 + side), x, z, s.ew ? 0 : 1);
        } else if (kind === 'bench') {
          if (d.put(bench(k), x, z, turns)) b.benches.push([x, z, turns * Math.PI / 2]);
        } else {
          const col = [k.c.bikeSilver, k.c.bikeMint, k.c.bikeRed];
          for (let j = 0; j < 2; j++) {
            const w = (j - 0.5) * 1.5;
            d.put(bicycle(k, col[(u + j) % 3]), s.ew ? x + w : x, s.ew ? z : z + w, s.ew ? 0 : 1);
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// The station square: more shade, more seats

function plaza(d: Dresser): void {
  const b = d.b, k = b.k, g = b.grid, c = b.c;
  for (const [px, pz] of [[16, -140], [86, -141], [198, -140], [276, -141]]) {
    const ring: Rect = [(px - 6) * V, (pz - 6) * V, (px + 7) * V, (pz + 7) * V];
    if (!d.space.free(ring, 0.6) || d.onPath(ring, 1.2)) continue;
    d.take(ring);
    for (let a = 0; a < 24; a++) {
      const t = (a / 24) * Math.PI * 2;
      g.box(Math.round(px + Math.cos(t) * 5), G, Math.round(pz + Math.sin(t) * 5), Math.round(px + Math.cos(t) * 5), G + 1, Math.round(pz + Math.sin(t) * 5), c.granite);
    }
    for (let zz = pz - 4; zz <= pz + 4; zz++) for (let xx = px - 4; xx <= px + 4; xx++) if (Math.hypot(xx - px, zz - pz) < 4.5) g.set(xx, G - 1, zz, hash3(xx, zz, 9) < 0.4 ? c.moss : c.soil);
    b.block((px - 5) * V, (pz - 5) * V, (px + 6) * V, (pz + 6) * V);
    tree(b, px, pz, 4300 + px, px % 3 ? 'keyaki' : 'maple', G, 10, 0.85);
    // benches either side of the ring, facing out
    for (const sd of [-1, 1]) {
      const x = (px + 0.5 + sd * 9) * V, z = (pz + 0.5) * V, turns = sd < 0 ? 3 : 1;
      if (d.put(bench(k), x, z, turns)) b.benches.push([x, z, turns * Math.PI / 2]);
    }
  }
  // planters along the avenue side and a pair of vending machines by the bike racks
  for (let x = 54; x < 230; x += 14) {
    if (x > 98 && x < 162) continue;
    d.put(streetPlanter(k, x), (x + 0.5) * V, -120 * V, 0);
  }
  for (let i = 0; i < 2; i++) {
    const x = (24 + i * 4.5) * V, z = -152 * V;
    if (d.put(vendingMachine(k, [k.c.vmBlue, k.c.vmWhite][i], 950 + i), x, z, 0)) b.lamp(x, 1.2, z + 0.5, [0.62, 0.84, 1.0], 3, 0.8);
  }
}

// ---------------------------------------------------------------------------------------------
// The green: grass and flowers in the park, a playground; the shrine wood and the hill get undergrowth

const PARK: Rect = [328, 260, 575, 447];
const POND = { cx: 452, cz: 356, rx: 64, rz: 40 };
const pondD = (x: number, z: number) => Math.hypot((x - POND.cx) / POND.rx, (z - POND.cz) / POND.rz);
const onParkPath = (x: number, z: number) => {
  const dd = pondD(x, z);
  return (dd >= 1.05 && dd < 1.4) || (x >= 436 && x <= 455 && z < POND.cz - POND.rz) || (z >= 348 && z <= 367 && x < POND.cx - POND.rx);
};

/** Scatter grass tufts and bushes over a region; `ok` says where (voxels), `y` gives the ground height (voxels above G). */
function scatter(d: Dresser, seed: number, rect: Rect, tufts: number, bushes: number, ok: (x: number, z: number) => boolean, y = (_x: number, _z: number) => 0): void {
  const k = d.b.k;
  const r = rng(seed);
  const flat = (x0: number, z0: number, n: number) => {
    const h = y(x0, z0);
    for (let z = z0; z <= z0 + n; z++) for (let x = x0; x <= x0 + n; x++) if (y(x, z) !== h || !ok(x, z)) return -1;
    return h;
  };
  for (let i = 0, tries = 0; i < bushes && tries < bushes * 6; tries++) {
    const x = Math.floor(rect[0] + r() * (rect[2] - rect[0] - 5)), z = Math.floor(rect[1] + r() * (rect[3] - rect[1] - 5));
    const h = flat(x, z, 5);
    if (h < 0) continue;
    if (d.put(bush(k, Math.floor(r() * 1e6)), (x + 2.75) * V, (z + 2.75) * V, Math.floor(r() * 4), { y: h * V })) i++;
  }
  for (let i = 0, tries = 0; i < tufts && tries < tufts * 4; tries++) {
    const x = Math.floor(rect[0] + r() * (rect[2] - rect[0] - 2)), z = Math.floor(rect[1] + r() * (rect[3] - rect[1] - 2));
    const h = flat(x, z, 1);
    if (h < 0) continue;
    // tufts come in little clumps
    const n = 1 + Math.floor(r() * 3);
    for (let j = 0; j < n; j++) {
      const jx = (x + 0.6 + j * 0.9 * (r() < 0.5 ? 1 : -0.6)) * V, jz = (z + 0.6 + j * 0.7) * V;
      if (flat(Math.floor(jx / V), Math.floor(jz / V), 1) !== h) continue;
      if (d.put(grassTuft(k, Math.floor(r() * 1e6)), jx, jz, 0, { y: h * V, block: false, pad: 0.02 })) i++;
    }
  }
}

function park(d: Dresser, trees: [number, number][]): void {
  const b = d.b, k = b.k, g = b.grid, c = b.c;
  const underCrown = (x: number, z: number, rr: number) => trees.some(([tx, tz]) => Math.abs(tx - x) < rr && Math.abs(tz - z) < rr);
  // the playground in the quiet north-east corner: sand under a swing set and a slide, benches for the parents
  {
    const x0 = 524, z0 = 268, x1 = 566, z1 = 298;
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const e = Math.min(x - x0, x1 - x, z - z0, z1 - z);
      if (e < 0) continue;
      g.set(x, G - 1, z, e === 0 ? c.graniteDark : hash3(x, z, 77) < 0.5 ? c.sand2 : c.sand);
    }
    const spots: [number, number][] = [[534, 278], [548, 288], [540, 290], [556, 276], [530, 290]];
    let swing = false, sl = false;
    for (const [x, z] of spots) {
      if (underCrown(x, z, 14)) continue;
      if (!swing) { swing = d.put(swingSet(k), x * V, z * V, 0, { pad: 0.6 }); if (swing) continue; }
      if (!sl) sl = d.put(slide(k), x * V, z * V, 1, { pad: 0.5 });
    }
    for (const [x, z, t] of [[528, 296, 2], [562, 296, 2], [545, 270, 0]] as [number, number, number][]) {
      const bx = (x + 0.5) * V, bz = (z + 0.5) * V;
      if (d.put(bench(k), bx, bz, t)) b.benches.push([bx, bz, t * Math.PI / 2]);
    }
  }
  // flower patches on the lawn
  const r = rng(4646);
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(PARK[0] + 8 + r() * (PARK[2] - PARK[0] - 16)), z = Math.floor(PARK[1] + 8 + r() * (PARK[3] - PARK[1] - 16));
    if (pondD(x, z) < 1.45 || onParkPath(x, z)) continue;
    const col = [c.petalDeep, c.mustard, c.petal, c.templeWhite][i % 4];
    const rr = 2 + r() * 2.5;
    for (let zz = Math.floor(z - rr); zz <= z + rr; zz++) for (let xx = Math.floor(x - rr); xx <= x + rr; xx++) {
      if (Math.hypot(xx - x, zz - z) > rr || onParkPath(xx, zz)) continue;
      const h = hash3(xx, zz, 31);
      if (h < 0.45) g.set(xx, G - 1, zz, h < 0.3 ? col : c.clover);
    }
  }
  scatter(d, 4747, [PARK[0] + 3, PARK[1] + 3, PARK[2] - 3, PARK[3] - 3], 170, 46, (x, z) => pondD(x, z) > 1.12 && !onParkPath(x, z) && !(x >= 522 && x <= 568 && z >= 266 && z <= 300));
}

const SHRINE: Rect = [-288, -184, -1, -113];
function shrineWood(d: Dresser): void {
  scatter(d, 5151, [SHRINE[0] + 2, SHRINE[1] + 2, SHRINE[2] - 2, SHRINE[3] - 4], 140, 30, (x, z) =>
    !(x >= -178 && x <= -143) && !(x >= -206 && x <= -115 && z <= -150));
}

function hill(d: Dresser): void {
  const near = (x: number, z: number) => {
    const px = x * V, pz = z * V;
    for (let i = 0; i + 1 < INARI_PATH.length; i++) {
      const [ax, az] = INARI_PATH[i], [bx, bz] = INARI_PATH[i + 1];
      const lx = bx - ax, lz = bz - az, l2 = lx * lx + lz * lz;
      const t = Math.max(0, Math.min(1, ((px - ax) * lx + (pz - az) * lz) / l2));
      if (Math.hypot(px - ax - lx * t, pz - az - lz * t) < 3.4) return true;
    }
    const [sx, sz] = INARI_PATH[INARI_PATH.length - 1];
    return Math.hypot(px - sx, pz - sz - 1.2) < 5;
  };
  scatter(d, 6161, [HILL[0] + 3, HILL[1] + 8, HILL[2] - 3, HILL[3] - 3], 170, 40, (x, z) => !near(x, z) && !(x >= -153 && x <= -127 && z <= 270), hillAt);
}

/** Back gardens: a laundry pole, shrubs and grass between the trees and sheds. */
function garden(d: Dresser, [x0, z0, x1, z1]: Rect, trees: [number, number][]): void {
  const k = d.b.k;
  const r = rng(x0 * 31 + z0);
  for (let x = x0 + 6; x < x1 - 14; x += 26 + Math.floor(r() * 16)) {
    if (trees.some(([tx, tz]) => tx > x - 10 && tx < x + 22 && Math.abs(tz - z1 + 2.6) < 10)) continue; // low pine pads
    if (r() < 0.6) d.put(laundryRack(k, x + z0), (x + 6) * V, (z1 - 2.6) * V, 0, { pad: 0.2 });
  }
  scatter(d, x0 * 7 + z0, [x0 + 1, z0 + 1, x1 - 1, z1 - 1], Math.floor((x1 - x0) / 5), Math.floor((x1 - x0) / 14), () => true);
}

