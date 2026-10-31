/**
 * Tokyo Tower, out past the north end of the city: a 333 m lattice tower in international orange and white, built
 * from one-metre voxels like everything else and folded into the far city's single instanced draw.
 *
 * The lattice is voxelised once at load: four legs joined by great arches on every face, the shaft tapering in a
 * smooth curve with X-braced panels that get shorter as it narrows, the two-storey main deck at 145 m, the top deck
 * at 250 m and the antenna to the tip. The voxels are then merged into runs (along x, else z, else y), so the whole
 * tower is a few thousand boxes. Decks, Foot Town under the legs and the plaza round it are placed as plain boxes.
 *
 * Kinds (shaded in farcity.ts): 8 lattice steel (floodlit orange at night), 9 deck glass, 10 aviation light.
 */

export type PartFn = (cx: number, cz: number, w: number, d: number, y0: number, h: number, kind: number, c: string, s?: number) => void;

export const TOWER_ORANGE = '#e4571f', TOWER_WHITE = '#ece8df';

/** Half-width of the square shaft (m) at height y: 40 at the ground, 10 at the main deck, 4 at the top deck. */
export function towerHalf(y: number): number {
  if (y <= 250) return 4 + 36 * Math.pow(1 - y / 250, 1.95);
  // the antenna's lattice: 3 m tapering to 1 m by 300 m
  return Math.max(1, 3 - (y - 256) / 22);
}

const ARCH = 50; // height of the arches between the legs (m)
const LEG = 12; // depth of a leg at its foot (m)
const TOP = 300; // where the lattice ends and the mast begins

/** The orange and white bands: eleven up to the top deck, shrinking as they climb, then short ones on the antenna. */
function band(y: number): number {
  if (y < 250) return Math.min(10, Math.floor(11 * Math.pow(y / 250, 1 / 0.85)));
  return 11 + Math.floor((y - 250) / 7);
}
const bandColour = (b: number) => (b <= 10 ? (b % 2 === 0 ? TOWER_ORANGE : TOWER_WHITE) : b % 2 === 0 ? TOWER_WHITE : TOWER_ORANGE);

export function tokyoTower(part: PartFn, tx: number, tz: number): number {
  const C = 41, N = C * 2 + 1, NY = TOP;
  const vox = new Uint8Array(N * N * NY);
  const at = (i: number, j: number, k: number) => (j * N + k) * N + i;
  const set = (x: number, j: number, z: number) => {
    const i = x + C, k = z + C;
    if (i >= 0 && i < N && k >= 0 && k < N && j >= 0 && j < NY) vox[at(i, j, k)] = 1;
  };

  // panel levels: each panel about as tall as the shaft is half wide, 4 to 14 m
  const levels: number[] = [0];
  while (levels[levels.length - 1] < TOP) {
    const y = levels[levels.length - 1];
    levels.push(Math.min(TOP, y + Math.round(Math.max(4, Math.min(14, towerHalf(y) * 0.9)))));
  }
  const panelOf = new Int32Array(NY);
  for (let p = 0, j = 0; j < NY; j++) {
    while (levels[p + 1] <= j) p++;
    panelOf[j] = p;
  }
  // the decks hide the lattice behind them; no need to voxelise it
  const hidden = (j: number) => (j >= 143 && j < 160) || (j >= 247 && j < 257);

  /** One lattice face: corner posts, a girder at each panel level and X-bracing in each bay, along u in [-h, h]. */
  const face = (j: number, h: number, put: (u: number) => void, keep: (u: number) => boolean) => {
    const p = panelOf[j], ya = levels[p], yb = levels[p + 1];
    const f = (j + 0.5 - ya) / (yb - ya);
    const bays = h > 20 ? 3 : h > 9 ? 2 : 1;
    const bw = (2 * h) / bays;
    const slope = bw / (yb - ya);
    const post = j < 150 ? 2 : 1;
    for (let u = -h; u <= h; u++) {
      if (!keep(u)) continue;
      let on = j === ya || Math.abs(u) > h - post;
      if (!on) {
        const b = Math.min(bays - 1, Math.floor((u + h) / bw));
        const lu = u + h - b * bw;
        const d1 = Math.abs(lu - f * bw), d2 = Math.abs(lu - (1 - f) * bw);
        on = Math.min(d1, d2) <= Math.max(0.5, slope / 2) || Math.abs(lu) < 0.5; // diagonals and the bay posts
      }
      if (on) put(u);
    }
  };

  for (let j = 0; j < NY; j++) {
    if (hidden(j)) continue;
    const y = j + 0.5;
    const h = Math.round(towerHalf(y));
    // the arch between the legs on every face, and how much it rises over this layer (so flat crowns stay solid)
    const arch = (yy: number) => (yy < ARCH ? (towerHalf(0) - LEG) * Math.sqrt(1 - (yy / ARCH) ** 2) : 0);
    const a = arch(y), da = Math.abs(arch(y) - arch(y + 1));
    const keep = (u: number) => Math.abs(u) >= a - 0.5 - Math.max(1.5, da) || a === 0;
    const rib = (u: number) => a > 0 && Math.abs(u) < a + 0.5 && Math.abs(u) >= a - 0.5 - Math.max(1.5, da);
    for (const s of [-1, 1]) {
      face(j, h, (u) => set(u, j, s * h), (u) => keep(u));
      face(j, h, (u) => set(s * h, j, u), (u) => keep(u));
      if (a > 0) for (let u = -h; u <= h; u++) if (rib(u)) { set(u, j, s * h); set(s * h, j, u); }
    }
    // the legs' inner faces, out to the corners, while they stand apart
    if (y < ARCH) {
      const L = Math.min(h - Math.round(a), LEG);
      const inner = h - L;
      if (inner > 0)
        for (const sx of [-1, 1])
          for (const sz of [-1, 1]) {
            face(j, Math.ceil(L / 2), (u) => set(sx * inner, j, sz * (inner + Math.ceil(L / 2) + u)), () => true);
            face(j, Math.ceil(L / 2), (u) => set(sx * (inner + Math.ceil(L / 2) + u), j, sz * inner), () => true);
          }
    }
    // a solid ring girder under each deck, and a floor of steel through the shaft every few panels
    if (j === 142 || j === 246) for (let u = -h; u <= h; u++) for (const s of [-1, 1]) { set(u, j, s * h); set(s * h, j, u); }
  }

  // merge the voxels into runs and emit them, coloured by band
  const used = new Uint8Array(vox.length);
  let boxes = 0;
  const emit = (i: number, j: number, k: number, lx: number, ly: number, lz: number) => {
    const b = band(j + ly * 0.5);
    part(tx + i - C + (lx - 1) / 2, tz + k - C + (lz - 1) / 2, lx, lz, j, ly, 8, bandColour(b), 0.5);
    boxes++;
  };
  for (let j = 0; j < NY; j++)
    for (let k = 0; k < N; k++)
      for (let i = 0; i < N; i++) {
        const q = at(i, j, k);
        if (!vox[q] || used[q]) continue;
        const b = band(j);
        let lx = 1;
        while (i + lx < N && vox[at(i + lx, j, k)] && !used[at(i + lx, j, k)]) lx++;
        if (lx > 1) { for (let t = 0; t < lx; t++) used[at(i + t, j, k)] = 1; emit(i, j, k, lx, 1, 1); continue; }
        let lz = 1;
        while (k + lz < N && vox[at(i, j, k + lz)] && !used[at(i, j, k + lz)]) lz++;
        if (lz > 1) { for (let t = 0; t < lz; t++) used[at(i, j, k + t)] = 1; emit(i, j, k, 1, 1, lz); continue; }
        let ly = 1;
        while (j + ly < NY && vox[at(i, j + ly, k)] && !used[at(i, j + ly, k)] && band(j + ly) === b) ly++;
        for (let t = 0; t < ly; t++) used[at(i, j + t, k)] = 1;
        emit(i, j, k, 1, ly, 1);
      }

  // the main deck: two storeys of glass between white slabs, the roof stepped in with its plant
  const deck = (y: number, half: number, floors: number, fh: number) => {
    part(tx, tz, half * 2 + 1, half * 2 + 1, y, 1, 4, '#d9d6cf');
    for (let f = 0; f < floors; f++) {
      part(tx, tz, half * 2, half * 2, y + 1 + f * (fh + 1), fh, 9, '#2f3c48', f / floors);
      part(tx, tz, half * 2 + 0.6, half * 2 + 0.6, y + 1 + f * (fh + 1) + fh, 1, 4, TOWER_WHITE);
    }
    const top = y + 1 + floors * (fh + 1);
    part(tx, tz, half * 2 - 3, half * 2 - 3, top, 1.5, 4, '#bdb9b1');
    return top + 1.5;
  };
  const mainTop = deck(143, 14, 2, 6.5);
  // the special deck high above
  const topTop = deck(247, 6.5, 1, 6.5);
  part(tx, tz, 5, 5, topTop, 1, 4, TOWER_ORANGE);
  // the mast above the lattice: orange and white in short bands, narrowing to the tip at 333 m
  for (let y = TOP, i = 0; y < 333; i++) {
    const h = Math.min(333 - y, 6);
    const w = y < 315 ? 1.6 : 0.8;
    part(tx, tz, w, w, y, h, 8, i % 2 ? TOWER_ORANGE : TOWER_WHITE, 0.5);
    y += h;
  }
  // aviation lights: the deck roof corners, up the antenna, the tip (s = blink phase)
  const light = (x: number, z: number, y: number, s: number, w = 0.7) => part(x, z, w, w, y, w, 10, '#ff2a1e', s);
  for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    light(tx + dx * 12.5, tz + dz * 12.5, mainTop, 0.1);
    light(tx + dx * 5.5, tz + dz * 5.5, topTop, 0.35);
    light(tx + dx * 1.6, tz + dz * 1.6, 285, 0.6, 0.6);
  }
  light(tx, tz, 333, 0.85, 1.1);

  // Foot Town under the legs: a four-storey block of shops and cafés, signs on its face, a plaza round it
  part(tx, tz, 46, 40, 0, 17, 1, '#d8d3c8');
  part(tx, tz, 46.4, 40.4, 17, 0.6, 4, '#8d8b88');
  part(tx - 9, tz + 4, 14, 10, 17.6, 3, 4, '#bcb8ae');
  for (const dx of [-14, -4, 8, 17]) part(tx + dx, tz + 20.5, 0.3, 1.2, 4 + (dx & 3), 7, 5, ['#e8473a', '#f2c230', '#36c6d8', '#e85aa8'][(dx + 16) % 4]);
  part(tx, tz + 20.2, 16, 0.3, 13.5, 2.4, 5, '#e8473a'); // the name board over the entrance
  return boxes;
}
