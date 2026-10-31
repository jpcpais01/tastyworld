import { Grid, SparseGrid } from './grid';
import { LightField, Lamp } from './lighting';
import { meshGrid, mergeMeshes, splitInner, orderFaces, packAtlas, MeshData, LightFn } from './mesher';
import { Palette } from './palette';
import { buildTokyo, Anchors, PlacedProp, BuildResult, Window } from './tokyo';
import { buildAmalfi } from './amalfi';
import { buildIstanbul } from './istanbul';
import { AMALFI, ISTANBUL } from './cityId';
import { CHUNK, CHUNKS_X, CHUNKS_Z, G, V, VX0, VZ0, SX, SZ, INTERIOR_ORIGIN, ISX, ISZ, HILL } from './layout';
import { assemble } from './assemble';
import { solidBase, type Owners } from './owners';
import { packSway, swayKey, SWAY_PART } from './sway';
export { assemble };

// Sun travels from +x, -z towards the scene, about 42 degrees up.
export const SUN_STEP: [number, number] = [0.93, -0.58];

export interface NavData {
  sx: number;
  sz: number;
  ox: number; // world metres of cell (0,0) corner
  oz: number;
  height: Uint8Array; // standing voxel layer, 255 = blocked
}

export interface LightMap2D {
  sx: number;
  sz: number;
  ox: number;
  oz: number;
  cell: number; // metres
  data: Uint8Array; // 5 per cell: sun, sky, r, g, b
}

/** Everything about the world except the street meshes, which are streamed chunk by chunk (see WorldPart.mesh). */
export interface BakedWorld {
  tagged: { tag: string; mesh: MeshData }[];
  nav: NavData;
  lightmap: LightMap2D;
  interiorChunks: MeshData[];
  interiorNav: NavData;
  interiorLightmap: LightMap2D;
  /** Per-column height (voxels above street level) of the solid run that starts at the street, for section caps. */
  height: Uint8Array;
  interiorHeight: Uint8Array;
  /** Per-column occupancy of the 64 voxel layers from street level up, two 32-bit words per column (cutaway ray tests). */
  solid: Uint32Array;
  interiorSolid: Uint32Array;
  /** Column ownership and the final occluder list (registered ones plus the solid masses found in the bake). */
  owners: Owners;
  /** Signed distance to the water's edge per column: 128 + 16 x voxels (positive over open water). */
  shore: Uint8Array;
  /** Terrain under each column (voxels above street level) on a hillside city, or null where the city is flat. */
  ground: Uint8Array | null;
  /** Walk map and character light of each hotel room upstairs, by room id (the street map only knows the ground). */
  hotelRooms: Record<string, HotelRoomBake>;
  anchors: Anchors;
  /** Sway bodies of every part, stacked for the sway texture (see world/sway.ts). */
  sway: { data: Float32Array; width: number; height: number };
  stats: { lamps: number; ms: number; bytes: number };
}

export interface HotelRoomBake { nav: NavData; lightmap: LightMap2D }

/** What one worker hands back after building its strip of the city. */
export interface PartInit {
  part: number;
  /** Chunk rows this part owns, [r0, r1). */
  rows: [number, number];
  height: Uint8Array;
  solid: Uint32Array;
  nav: Uint8Array;
  shore: Uint8Array;
  /** Terrain under each column (voxels above street level), for cities that climb hills; null on flat ones. */
  ground: Uint8Array | null;
  lightmap: Uint8Array;
  tagged: { tag: string; mesh: MeshData }[];
  anchors: Anchors;
  interior: { chunks: MeshData[]; nav: NavData; lightmap: LightMap2D; height: Uint8Array; solid: Uint32Array } | null;
  /** The hotel rooms whose middle lies in this part's strip. */
  hotelRooms: ({ id: string } & HotelRoomBake)[];
  /** This part's sway bodies, packed (ids from part * SWAY_PART + 1). */
  sway: Float32Array;
  stats: { lamps: number; ms: number; bytes: number };
}

const BLOCKED = 255;

/** The builder of the city this page is visiting. */
export function buildWorld(win?: Window): BuildResult {
  return ISTANBUL ? buildIstanbul(win) : AMALFI ? buildAmalfi(win) : buildTokyo(win);
}
/** Extra voxel rows a strip keeps on its -z side (long sun shadows from tall buildings) and +z side (sky light). */
const HALO_LO = 112, HALO_HI = 40;

function lightFnFor(field: LightField): LightFn {
  // world metres -> builder voxel coords
  return (wx, wy, wz, nx, ny, nz, out) => {
    const px = wx / V + nx * 0.5, py = wy / V + G + ny * 0.5, pz = wz / V + nz * 0.5;
    field.sample(px, py, pz, out);
    field.lampLight(px, py, pz, nx, ny, nz, out);
  };
}

/** Signed distance to the shoreline for columns [x0,x1) x [z0,z1) (builder coords), see BakedWorld.shore. */
function computeShore(grid: SparseGrid, x0: number, z0: number, x1: number, z1: number): Uint8Array {
  const R = 8;
  const sx = x1 - x0, sz = z1 - z0;
  const wz0 = z0 - R, wsz = sz + 2 * R;
  const waterTop = G - 3; // columns whose solid top is at or below this layer are open water
  const isWater = new Uint8Array(sx * wsz);
  for (let z = 0; z < wsz; z++)
    for (let x = 0; x < sx; x++) {
      // open water: nothing solid from just under the street up to well above it
      let y = waterTop;
      while (y <= G + 30 && grid.get(x0 + x, y, wz0 + z) === 0) y++;
      isWater[z * sx + x] = y > G + 30 ? 1 : 0;
    }
  // summed-area table: columns whose whole (2R+1)^2 window is one kind are far from any shore
  const SW = sx + 1;
  const sat = new Int32Array(SW * (wsz + 1));
  for (let z = 0; z < wsz; z++) {
    let row = 0;
    for (let x = 0; x < sx; x++) { row += isWater[z * sx + x]; sat[(z + 1) * SW + x + 1] = sat[z * SW + x + 1] + row; }
  }
  const far = 128 + Math.round((Math.sqrt(R * R + 1) - 0.5) * 16);
  const out = new Uint8Array(sx * sz);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const w = isWater[(z + R) * sx + x];
      const xa = Math.max(0, x - R), xb = Math.min(sx, x + R + 1), za = z, zb = z + 2 * R + 1;
      const cnt = sat[zb * SW + xb] - sat[za * SW + xb] - sat[zb * SW + xa] + sat[za * SW + xa];
      if (cnt === 0 || cnt === (xb - xa) * (zb - za)) { out[z * sx + x] = Math.max(0, Math.min(255, w ? far : 256 - far)); continue; }
      let best = R * R + 1;
      for (let dz = -R; dz <= R; dz++) {
        const zz = z + R + dz;
        if (zz < 0 || zz >= wsz || z0 + z + dz < VZ0 || z0 + z + dz >= VZ0 + SZ) continue;
        for (let dx = -R; dx <= R; dx++) {
          const xx = x + dx;
          if (xx < 0 || xx >= sx) continue;
          if (isWater[zz * sx + xx] !== w) { const d = dx * dx + dz * dz; if (d < best) best = d; }
        }
      }
      const d = Math.sqrt(best) - 0.5;
      out[z * sx + x] = Math.max(0, Math.min(255, Math.round(128 + (w ? d : -d) * 16)));
    }
  return out;
}

function computeHeight(grid: SparseGrid, x0: number, z0: number, x1: number, z1: number): Uint8Array {
  const sx = x1 - x0;
  const out = new Uint8Array(sx * (z1 - z0));
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      let y = G;
      while (y < grid.sy && grid.get(x, y, z) !== 0) y++;
      out[(z - z0) * sx + x - x0] = Math.min(255, y - G);
    }
  return out;
}

function computeSolid(grid: SparseGrid, x0: number, z0: number, x1: number, z1: number, ground: Uint8Array | null = null): Uint32Array {
  const sx = x1 - x0;
  const out = new Uint32Array(sx * (z1 - z0) * 2);
  for (let z = z0; z < z1; z++)
    for (let x = x0; x < x1; x++) {
      const ci = (z - z0) * sx + x - x0, c = ci * 2;
      // the 64 layers start at the street, or just under the terrain on a hillside (see solidBase)
      const y0 = G + solidBase(ground, ci), top = Math.min(grid.sy, y0 + 64);
      for (let y = y0; y < top; y++) if (grid.get(x, y, z) !== 0) out[c + ((y - y0) >> 5)] |= 1 << ((y - y0) & 31);
    }
  return out;
}

/**
 * Standing layer of each column of [x0,x1) x [z0,z1): the top of the highest floor at or under `top` with 7 voxels
 * of headroom, if it is at least minH. `top` is just above street level for the streets; a room upstairs passes
 * its own.
 */
function computeNav(grid: SparseGrid, x0: number, z0: number, x1: number, z1: number, blockers: [number, number, number, number][], minH: number, top = G + 8, topAt?: (x: number, z: number) => number): Uint8Array {
  const sx = x1 - x0, sz = z1 - z0;
  const height = new Uint8Array(sx * sz).fill(BLOCKED);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      if (x0 + x >= HILL[0] && x0 + x <= HILL[2] && z0 + z >= HILL[1] && z0 + z <= HILL[3]) {
        // on the hill, the lowest open ground (the path runs under torii beams and trees)
        for (let y = G - 1; y < G + 32; y++) {
          if (grid.get(x0 + x, y - 1, z0 + z) === 0) continue;
          let clear = true;
          for (let k = 0; k < 7; k++) if (grid.get(x0 + x, y + k, z0 + z) !== 0) { clear = false; break; }
          if (clear) { if (y >= minH) height[z * sx + x] = y; break; }
        }
        continue;
      }
      for (let y = topAt ? topAt(x0 + x, z0 + z) : top; y >= 1; y--) {
        if (grid.get(x0 + x, y - 1, z0 + z) === 0) continue;
        let clear = true;
        for (let k = 0; k < 7; k++) if (grid.get(x0 + x, y + k, z0 + z) !== 0) { clear = false; break; }
        if (clear && y >= minH) height[z * sx + x] = y;
        break;
      }
    }
  for (const [bx0, bz0, bx1, bz1] of blockers) {
    const ax = Math.max(0, Math.floor(bx0 / V) - x0), bx = Math.min(sx - 1, Math.floor(bx1 / V) - x0);
    const az = Math.max(0, Math.floor(bz0 / V) - z0), bz = Math.min(sz - 1, Math.floor(bz1 / V) - z0);
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) height[z * sx + x] = BLOCKED;
  }
  return height;
}

/** Character light map, 0.5 m cells, over columns [x0,x1) x [z0,z1) (builder coords, even). */
function computeLightmap(field: LightField, nav: Uint8Array, x0: number, z0: number, x1: number, z1: number): Uint8Array {
  const step = 2;
  const nsx = x1 - x0, nsz = z1 - z0;
  const sx = Math.ceil(nsx / step), sz = Math.ceil(nsz / step);
  const data = new Uint8Array(sx * sz * 5);
  const out = new Float32Array(5);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const vx = (x + 0.5) * step, vz = (z + 0.5) * step;
      const nh = nav[Math.min(nsz - 1, Math.floor(vz)) * nsx + Math.min(nsx - 1, Math.floor(vx))];
      const base = nh === BLOCKED ? G : nh;
      field.sample(x0 + vx, base + 4.5, z0 + vz, out);
      field.lampLight(x0 + vx, base + 5, z0 + vz, 0, 0, 0, out);
      const i = (z * sx + x) * 5;
      data[i] = Math.round(out[0] * 255);
      data[i + 1] = Math.round(out[1] * 255);
      data[i + 2] = Math.min(255, Math.round(out[2] * 127.5));
      data[i + 3] = Math.min(255, Math.round(out[3] * 127.5));
      data[i + 4] = Math.min(255, Math.round(out[4] * 127.5));
    }
  return data;
}

/** Sway body id of each voxel of a placed prop (see world/sway.ts), offset by the part's id base. */
function propSway(p: PlacedProp, base: number): ((vi: number) => number) | undefined {
  const idx = p.prop.swayIdx, ids = p.sway;
  if (!idx || !ids) return undefined;
  return (vi) => (idx[vi] ? ids[idx[vi] - 1] + base : 0);
}

/** Mesh columns [x0,x1) x [z0,z1) of a sparse grid (builder coords) plus the props given, at full detail. */
function meshRegion(grid: SparseGrid, pal: Palette, light: LightFn, x0: number, z0: number, x1: number, z1: number, props: PlacedProp[], cells: Map<number, number>, base: number, owners: Uint16Array | null): MeshData | null {
  const dense = grid.extract(x0, x1, z0, z1, G);
  // column owners under the dense grid (with its border), so faces between two buildings are kept
  let seam: Uint16Array | undefined;
  if (owners) {
    seam = new Uint16Array(dense.sx * dense.sz);
    for (let z = 0; z < dense.sz; z++) {
      const wz = z0 - 1 + z - VZ0;
      if (wz < 0 || wz >= SZ) continue;
      for (let x = 0; x < dense.sx; x++) {
        const wx = x0 - 1 + x - VX0;
        if (wx >= 0 && wx < SX) seam[z * dense.sx + x] = owners[wz * SX + wx];
      }
    }
  }
  // dense voxel (with its one-voxel border) -> builder voxel -> sway body
  const sway = cells.size ? (vi: number) => {
    const y = Math.floor(vi / dense.sxz), r = vi - y * dense.sxz, z = Math.floor(r / dense.sx);
    const id = cells.get(swayKey(grid, x0 - 1 + r - z * dense.sx, y, z0 - 1 + z));
    return id ? id + base : 0;
  } : undefined;
  const pieces: MeshData[] = [
    meshGrid({ grid: dense, pal, scale: V, origin: [(x0 - 1) * V, -G * V, (z0 - 1) * V], region: [1, x1 - x0 + 1, 1, z1 - z0 + 1], light, groundBelow: G, sway, seam, atlas: true }),
  ];
  for (const p of props) pieces.push(meshGrid({ grid: p.prop.grid, pal, scale: p.prop.scale, origin: p.origin, light, sway: propSway(p, base), atlas: true }));
  return mergeMeshes(pieces);
}

/**
 * Half-resolution copy of a chunk for distant views: 50 cm voxels, each the most common colour of its
 * 2x2x2 block when at least three of the eight are solid (thin rails and wires drop out, walls stay).
 */
/** Coarse mesh of a chunk: cells of f x f x f voxels (f = 2 or 4) take the most common colour when mostly solid. */
function meshLod(grid: SparseGrid, pal: Palette, light: LightFn, x0: number, z0: number, x1: number, z1: number, f: number): MeshData | null {
  const fine = grid.extract(x0 - f + 1, x1 + f - 1, z0 - f + 1, z1 + f - 1, G); // f-voxel border = one coarse cell
  const cw = (x1 - x0) / f + 2, cd = (z1 - z0) / f + 2, ch = Math.ceil(grid.sy / f);
  const coarse = new Grid(cw, ch, cd);
  const n3 = f * f * f, need = (n3 * 3) >> 3;
  const cols = new Uint16Array(n3);
  const fy = fine.sy;
  for (let y = 0; y < ch; y++)
    for (let z = 0; z < cd; z++)
      for (let x = 0; x < cw; x++) {
        let n = 0;
        for (let k = 0; k < n3; k++) {
          const yy = y * f + Math.floor(k / f) % f;
          if (yy >= fy) continue;
          const v = fine.get(x * f + (k % f), yy, z * f + Math.floor(k / (f * f)));
          if (v) cols[n++] = v;
        }
        if (n < need) continue;
        let best = cols[0], bc = 0;
        for (let i = 0; i < n; i++) {
          if (i && cols[i] === cols[i - 1]) continue;
          let c = 0;
          for (let j = 0; j < n; j++) if (cols[j] === cols[i]) c++;
          if (c > bc) { bc = c; best = cols[i]; }
        }
        coarse.set(x, y, z, best);
      }
  return meshGrid({ grid: coarse, pal, scale: f * V, origin: [(x0 - f) * V, -G * V, (z0 - f) * V], region: [1, cw - 1, 1, cd - 1], light, groundBelow: G / f, atlas: true });
}

/**
 * One worker's share of the city: a strip of chunk rows. It runs the whole (deterministic) city builder
 * but only stores voxels in its strip plus a halo, bakes their light, and then meshes chunks on request.
 */
export class WorldPart {
  readonly rows: [number, number];
  private res!: BuildResult;
  private light!: LightFn;
  private buckets: PlacedProp[][] = [];
  private rooms: number[][] = [];
  /** World column owners (see world/owners.ts), sent once every part is ready; chunks meshed after keep shared walls. */
  owners: Uint16Array | null = null;
  private t0 = performance.now();

  /** First sway id of this part, minus one. */
  get swayBase(): number { return this.part * SWAY_PART; }

  constructor(readonly part: number, readonly parts: number) {
    const per = Math.ceil(CHUNKS_Z / parts);
    this.rows = [Math.min(CHUNKS_Z, part * per), Math.min(CHUNKS_Z, (part + 1) * per)];
  }

  /** Strip in builder voxel z. */
  get z0(): number { return VZ0 + this.rows[0] * CHUNK; }
  get z1(): number { return VZ0 + this.rows[1] * CHUNK; }

  init(progress?: (stage: string, f: number) => void): PartInit {
    const { z0, z1 } = this;
    const wz0 = Math.max(VZ0, z0 - HALO_LO), wz1 = Math.min(VZ0 + SZ, z1 + HALO_HI);
    progress?.(ISTANBUL ? 'Building Istanbul' : AMALFI ? 'Building Amalfi' : 'Building Tokyo', 0.04);
    const res = (this.res = buildWorld([VX0, wz0, VX0 + SX, wz1]));
    if (res.sway.length >= SWAY_PART) throw new Error(`too many sway bodies: ${res.sway.length}`);
    res.grid.compact();
    progress?.('Lighting the streets', 0.4);
    const field = new LightField(res.grid, SUN_STEP);
    for (const l of res.lamps) field.addLamp(l);
    for (const bx of res.indoor) field.indoor(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 0.62);
    // ground-floor rooms in metres, whose contents are drawn near the player only (the station hall is a
    // landmark seen from across the square, so it keeps its insides); the great halls one walks into, the
    // cathedral's nave and the mosques' prayer halls, are rooms too however tall
    const halls = new Set((res.anchors.halls ?? []).flatMap((h) => h.inner.map((b) => b.join())));
    this.rooms = res.indoor.filter((b) => b[4] - b[1] <= 11 || halls.has(b.join()))
      .map((b) => [b[0] * V, (b[1] - G) * V, b[2] * V, (b[3] + 1) * V, (b[4] + 1 - G) * V, (b[5] + 1) * V]);
    this.light = lightFnFor(field);
    progress?.('Placing lanterns', 0.75);
    // props go to the chunk under their footprint centre; tagged ones are meshed separately by their owner strip
    this.buckets = Array.from({ length: CHUNKS_X * CHUNKS_Z }, () => []);
    const tagged: PartInit['tagged'] = [];
    for (const p of res.props) {
      const sc = p.prop.scale;
      p.origin = [Math.round(p.origin[0] / sc) * sc, Math.round(p.origin[1] / sc) * sc, Math.round(p.origin[2] / sc) * sc];
      const cx = (p.origin[0] + (p.prop.sx * sc) / 2) / V, cz = (p.origin[2] + (p.prop.sz * sc) / 2) / V;
      const ix = Math.min(CHUNKS_X - 1, Math.max(0, Math.floor((cx - VX0) / CHUNK)));
      const iz = Math.min(CHUNKS_Z - 1, Math.max(0, Math.floor((cz - VZ0) / CHUNK)));
      if (iz < this.rows[0] || iz >= this.rows[1]) continue;
      if (p.tag) tagged.push({ tag: p.tag, mesh: packAtlas(meshGrid({ grid: p.prop.grid, pal: res.pal, scale: sc, origin: p.origin, light: this.light, sway: propSway(p, this.swayBase), atlas: true })) });
      else this.buckets[iz * CHUNKS_X + ix].push(p);
    }
    progress?.('Paving the streets', 0.85);
    const x0 = VX0, x1 = VX0 + SX;
    const nav = computeNav(res.grid, x0, z0, x1, z1, res.anchors.blockers, 10, G + 8, res.navTop);
    let ground: Uint8Array | null = null;
    if (res.groundAt) {
      ground = new Uint8Array((x1 - x0) * (z1 - z0));
      for (let z = z0; z < z1; z++) for (let x = x0; x < x1; x++) ground[(z - z0) * (x1 - x0) + x - x0] = Math.max(0, Math.min(255, res.groundAt(x, z) - G));
    }
    const lightmap = computeLightmap(field, nav, x0, z0, x1, z1);
    const height = computeHeight(res.grid, x0, z0, x1, z1);
    const solid = computeSolid(res.grid, x0, z0, x1, z1, ground);
    const shore = computeShore(res.grid, x0, z0, x1, z1);

    // hotel rooms upstairs: a small walk map and light map of their own, baked by the part their middle is in
    const hotelRooms: PartInit['hotelRooms'] = [];
    for (const h of res.anchors.hotels)
      for (const rm of h.rooms) {
        const [vx0, vz0, vx1, vz1] = rm.vox;
        const cz = (vz0 + vz1) >> 1;
        if (cz < z0 || cz >= z1) continue;
        // even-aligned and one cell wider all round (blocked), as the light map wants
        const nx0 = (vx0 - 2) & ~1, nz0 = (vz0 - 2) & ~1, nx1 = (vx1 + 4) & ~1, nz1 = (vz1 + 4) & ~1;
        const layer = G + rm.layer;
        const rnav = computeNav(res.grid, nx0, nz0, nx1, nz1, [], layer, layer + 8);
        const sx = nx1 - nx0;
        for (let z = nz0; z < nz1; z++)
          for (let x = nx0; x < nx1; x++)
            if (x < vx0 || x > vx1 || z < vz0 || z > vz1) rnav[(z - nz0) * sx + x - nx0] = BLOCKED;
        hotelRooms.push({
          id: rm.id,
          nav: { sx, sz: nz1 - nz0, ox: nx0 * V, oz: nz0 * V, height: rnav },
          lightmap: { sx: sx / 2, sz: (nz1 - nz0) / 2, ox: nx0 * V, oz: nz0 * V, cell: 0.5, data: computeLightmap(field, rnav, nx0, nz0, nx1, nz1) },
        });
      }

    let interior: PartInit['interior'] = null;
    if (this.part === 0) {
      progress?.('Preparing a secret', 0.93);
      const [iox, , ioz] = INTERIOR_ORIGIN;
      const ig = res.interior.grid;
      const ifield = new LightField(ig, SUN_STEP);
      for (const l of res.interior.lamps as Lamp[]) ifield.addLamp(l);
      // the interior grid's voxel (0,0) sits at the interior origin
      const ilight: LightFn = (wx, wy, wz, nx, ny, nz, out) => {
        const px = (wx - iox) / V + nx * 0.5, py = wy / V + G + ny * 0.5, pz = (wz - ioz) / V + nz * 0.5;
        ifield.sample(px, py, pz, out);
        ifield.lampLight(px, py, pz, nx, ny, nz, out);
      };
      const dense = ig.extract(0, ISX, 0, ISZ, G);
      const pieces = [meshGrid({ grid: dense, pal: res.pal, scale: V, origin: [iox - V, -G * V, ioz - V], region: [1, ISX + 1, 1, ISZ + 1], light: ilight, groundBelow: G, atlas: true })];
      for (const p of res.interior.props) {
        const sc = p.prop.scale;
        p.origin = [Math.round(p.origin[0] / sc) * sc, Math.round(p.origin[1] / sc) * sc, Math.round(p.origin[2] / sc) * sc];
        pieces.push(meshGrid({ grid: p.prop.grid, pal: res.pal, scale: sc, origin: p.origin, light: ilight, sway: propSway(p, this.swayBase), atlas: true }));
      }
      const merged = mergeMeshes(pieces), im = merged && packAtlas(merged);
      const blockers: [number, number, number, number][] = [
        [2.0, 5.2, 11.2, 6.8], // counter
        [1.4, 1.4, 11.2, 2.8], // prep shelf
        [10.8, 0.4, 14.2, 1.8], // alcove
      ];
      const inav = computeNav(ig, 0, 0, ISX, ISZ, blockers, G);
      const ilm = computeLightmap(ifield, inav, 0, 0, ISX, ISZ);
      interior = {
        chunks: im ? [im] : [],
        nav: { sx: ISX, sz: ISZ, ox: iox, oz: ioz, height: inav },
        lightmap: { sx: ISX / 2, sz: ISZ / 2, ox: iox, oz: ioz, cell: 0.5, data: ilm },
        height: computeHeight(ig, 0, 0, ISX, ISZ),
        solid: computeSolid(ig, 0, 0, ISX, ISZ),
      };
    }
    progress?.('Ready', 1);
    return {
      part: this.part, rows: this.rows, height, solid, nav, shore, ground, lightmap, tagged, anchors: res.anchors, interior, hotelRooms,
      sway: packSway(res.sway, this.swayBase),
      stats: { lamps: res.lamps.length, ms: performance.now() - this.t0, bytes: res.grid.bytes + field.bytes },
    };
  }

  owns(iz: number): boolean {
    return iz >= this.rows[0] && iz < this.rows[1];
  }

  /** Mesh of chunk (ix, iz): full detail with props (lod 0), or coarse at half (1) or quarter (2) resolution. */
  mesh(ix: number, iz: number, lod: number): MeshData | null {
    const x0 = VX0 + ix * CHUNK, z0 = VZ0 + iz * CHUNK;
    if (lod) {
      const md = meshLod(this.res.grid, this.res.pal, this.light, x0, z0, x0 + CHUNK, z0 + CHUNK, lod === 1 ? 2 : 4);
      return md && packAtlas(orderFaces(md));
    }
    const md = meshRegion(this.res.grid, this.res.pal, this.light, x0, z0, x0 + CHUNK, z0 + CHUNK, this.buckets[iz * CHUNKS_X + ix], this.res.swayCells, this.swayBase, this.owners);
    return md && packAtlas(orderFaces(splitInner(md, this.rooms.filter((b) => b[0] < (x0 + CHUNK) * V && b[3] > x0 * V && b[2] < (z0 + CHUNK) * V && b[5] > z0 * V))));
  }
}

/** Single-threaded bake for scripts and checks. Returns the world plus the part, which can mesh any chunk. */
export function bakeWorld(progress?: (stage: string, f: number) => void): BakedWorld & { part: WorldPart } {
  const part = new WorldPart(0, 1);
  const w = assemble([part.init(progress)]);
  part.owners = w.owners.world.id;
  return { ...w, part };
}
