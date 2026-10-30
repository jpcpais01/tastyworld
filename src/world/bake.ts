import { Grid, SparseGrid } from './grid';
import { LightField, Lamp } from './lighting';
import { meshGrid, mergeMeshes, MeshData, LightFn } from './mesher';
import { Palette } from './palette';
import { buildTokyo, Anchors, PlacedProp, BuildResult } from './tokyo';
import { CHUNK, CHUNKS_X, CHUNKS_Z, G, V, VX0, VZ0, SX, SZ, INTERIOR_ORIGIN, ISX, ISZ, HILL } from './layout';
import { assemble } from './assemble';
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
  /** Signed distance to the water's edge per column: 128 + 16 x voxels (positive over open water). */
  shore: Uint8Array;
  anchors: Anchors;
  stats: { lamps: number; ms: number; bytes: number };
}

/** What one worker hands back after building its strip of the city. */
export interface PartInit {
  part: number;
  /** Chunk rows this part owns, [r0, r1). */
  rows: [number, number];
  height: Uint8Array;
  nav: Uint8Array;
  shore: Uint8Array;
  lightmap: Uint8Array;
  tagged: { tag: string; mesh: MeshData }[];
  anchors: Anchors;
  interior: { chunks: MeshData[]; nav: NavData; lightmap: LightMap2D; height: Uint8Array } | null;
  stats: { lamps: number; ms: number; bytes: number };
}

const BLOCKED = 255;
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

function computeNav(grid: SparseGrid, x0: number, z0: number, x1: number, z1: number, blockers: [number, number, number, number][], minH: number): Uint8Array {
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
      for (let y = G + 8; y >= 1; y--) {
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

/** Mesh columns [x0,x1) x [z0,z1) of a sparse grid (builder coords) plus the props given, at full detail. */
function meshRegion(grid: SparseGrid, pal: Palette, light: LightFn, x0: number, z0: number, x1: number, z1: number, props: PlacedProp[]): MeshData | null {
  const dense = grid.extract(x0, x1, z0, z1, G);
  const pieces: MeshData[] = [
    meshGrid({ grid: dense, pal, scale: V, origin: [(x0 - 1) * V, -G * V, (z0 - 1) * V], region: [1, x1 - x0 + 1, 1, z1 - z0 + 1], light, groundBelow: G }),
  ];
  for (const p of props) pieces.push(meshGrid({ grid: p.prop.grid, pal, scale: p.prop.scale, origin: p.origin, light }));
  return mergeMeshes(pieces);
}

/**
 * Half-resolution copy of a chunk for distant views: 50 cm voxels, each the most common colour of its
 * 2x2x2 block when at least three of the eight are solid (thin rails and wires drop out, walls stay).
 */
function meshLod(grid: SparseGrid, pal: Palette, light: LightFn, x0: number, z0: number, x1: number, z1: number): MeshData | null {
  const fine = grid.extract(x0 - 1, x1 + 1, z0 - 1, z1 + 1, G); // two-voxel border = one coarse cell
  const cw = (x1 - x0) / 2 + 2, cd = (z1 - z0) / 2 + 2, ch = Math.ceil(grid.sy / 2);
  const coarse = new Grid(cw, ch, cd);
  const cols = new Uint16Array(8);
  for (let y = 0; y < ch; y++)
    for (let z = 0; z < cd; z++)
      for (let x = 0; x < cw; x++) {
        let n = 0;
        for (let k = 0; k < 8; k++) {
          const v = fine.get(x * 2 + (k & 1), y * 2 + ((k >> 1) & 1), z * 2 + (k >> 2));
          if (v) cols[n++] = v;
        }
        if (n < 3) continue;
        let best = cols[0], bc = 0;
        for (let i = 0; i < n; i++) {
          let c = 0;
          for (let j = 0; j < n; j++) if (cols[j] === cols[i]) c++;
          if (c > bc) { bc = c; best = cols[i]; }
        }
        coarse.set(x, y, z, best);
      }
  return meshGrid({ grid: coarse, pal, scale: 0.5, origin: [(x0 - 2) * V, -G * V, (z0 - 2) * V], region: [1, cw - 1, 1, cd - 1], light, groundBelow: G / 2 });
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
  private t0 = performance.now();

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
    progress?.('Building Tokyo', 0.04);
    const res = (this.res = buildTokyo([VX0, wz0, VX0 + SX, wz1]));
    res.grid.compact();
    progress?.('Lighting the streets', 0.4);
    const field = new LightField(res.grid, SUN_STEP);
    for (const l of res.lamps) field.addLamp(l);
    for (const bx of res.indoor) field.indoor(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 0.62);
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
      if (p.tag) tagged.push({ tag: p.tag, mesh: meshGrid({ grid: p.prop.grid, pal: res.pal, scale: sc, origin: p.origin, light: this.light }) });
      else this.buckets[iz * CHUNKS_X + ix].push(p);
    }
    progress?.('Paving the streets', 0.85);
    const x0 = VX0, x1 = VX0 + SX;
    const nav = computeNav(res.grid, x0, z0, x1, z1, res.anchors.blockers, 10);
    const lightmap = computeLightmap(field, nav, x0, z0, x1, z1);
    const height = computeHeight(res.grid, x0, z0, x1, z1);
    const shore = computeShore(res.grid, x0, z0, x1, z1);

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
      const pieces = [meshGrid({ grid: dense, pal: res.pal, scale: V, origin: [iox - V, -G * V, ioz - V], region: [1, ISX + 1, 1, ISZ + 1], light: ilight, groundBelow: G })];
      for (const p of res.interior.props) {
        const sc = p.prop.scale;
        p.origin = [Math.round(p.origin[0] / sc) * sc, Math.round(p.origin[1] / sc) * sc, Math.round(p.origin[2] / sc) * sc];
        pieces.push(meshGrid({ grid: p.prop.grid, pal: res.pal, scale: sc, origin: p.origin, light: ilight }));
      }
      const im = mergeMeshes(pieces);
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
      };
    }
    progress?.('Ready', 1);
    return {
      part: this.part, rows: this.rows, height, nav, shore, lightmap, tagged, anchors: res.anchors, interior,
      stats: { lamps: res.lamps.length, ms: performance.now() - this.t0, bytes: res.grid.bytes + field.bytes },
    };
  }

  owns(iz: number): boolean {
    return iz >= this.rows[0] && iz < this.rows[1];
  }

  /** Mesh of chunk (ix, iz): full detail with props, or the coarse half-resolution version. */
  mesh(ix: number, iz: number, lod: boolean): MeshData | null {
    const x0 = VX0 + ix * CHUNK, z0 = VZ0 + iz * CHUNK;
    if (lod) return meshLod(this.res.grid, this.res.pal, this.light, x0, z0, x0 + CHUNK, z0 + CHUNK);
    return meshRegion(this.res.grid, this.res.pal, this.light, x0, z0, x0 + CHUNK, z0 + CHUNK, this.buckets[iz * CHUNKS_X + ix]);
  }
}

/** Single-threaded bake for scripts and checks. Returns the world plus the part, which can mesh any chunk. */
export function bakeWorld(progress?: (stage: string, f: number) => void): BakedWorld & { part: WorldPart } {
  const part = new WorldPart(0, 1);
  const w = assemble([part.init(progress)]);
  return { ...w, part };
}
