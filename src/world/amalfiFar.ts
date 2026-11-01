import { SparseGrid } from './grid';
import { LightField } from './lighting';
import { meshGrid, mergeMeshes, packAtlas, type MeshData, type LightFn } from './mesher';
import { coarsen, SUN_STEP } from './bake';
import { Builder } from './tokyo';
import { amalfiColors, house, masonry, type AC } from './amalfi';
import type { LotPlan } from './amalfiPlan';
import { G, V } from './layout';
import { farTiles, type FarLot, type FarTile } from './farTiles';

/**
 * The villages on the slopes round Amalfi, built house by house with the town's own generator (amalfi.ts house():
 * the same stucco, shutters, balconies, cornices, weathering, roofs and terraces), each standing level on its uphill
 * side and carried downhill on a dry-stone terrace wall with a little paved terrace before its door. They are lit
 * and meshed like the town, a tile of houses at a time, at full detail or at half or quarter resolution (bake.ts
 * coarsen) for the distance; nothing is kept between requests but the plan.
 */

/** A house's frame: its voxel grid, where layer 0 sits in the world, and its middle. */
interface Built {
  grid: SparseGrid;
  /** World y (m) of the bottom of voxel layer 0. */
  y0: number;
  /** Stored columns [gx0, gx1) x [gz0, gz1), builder voxel coordinates (x * V metres). */
  gx0: number; gx1: number; gz0: number; gz1: number;
  light: LightFn;
  props: { grid: import('./grid').Grid; scale: number; origin: [number, number, number] }[];
}

/** A baked mesh, and per vertex its house's middle (x, z) and tile. */
export interface FarMesh { mesh: MeshData; home: Float32Array }

/** Most rows a far mesh's atlas may have (three planes stacked: 3 x 1024 texels high, inside any GPU's limit). */
const ATLAS_ROWS = 1024;

const SIDES: LotPlan['side'][] = ['e', 'w', 's', 'n'];
const snap = (v: number) => Math.round(v / V) * V;
const ceil8 = (v: number) => Math.ceil(v / 8) * 8;
const floor8 = (v: number) => Math.floor(v / 8) * 8;

export class FarTown {
  readonly tiles: FarTile[];
  private b = new Builder([0, 0, 0, 0]);
  private c: AC;

  constructor(readonly lots: FarLot[]) {
    this.tiles = farTiles(lots);
    this.c = amalfiColors(this.b);
  }

  /**
   * Tiles' houses at a level of detail (0 full, 1 half, 2 quarter resolution), merged into meshes whose atlases stay
   * under ATLAS_ROWS rows; each vertex carries its house's middle and its tile (see engine/fartown.ts).
   */
  mesh(tiles: number[], lod: number): FarMesh[] {
    const out: FarMesh[] = [];
    let pieces: MeshData[] = [], homes: number[] = [], rows = 0;
    const flush = () => {
      const merged = mergeMeshes(pieces);
      if (merged) {
        const home = new Float32Array(merged.vertexCount * 3);
        let v = 0;
        for (let k = 0; k < homes.length; k += 4) for (let j = 0; j < homes[k]; j++, v++) home.set([homes[k + 1], homes[k + 2], homes[k + 3]], v * 3);
        out.push({ mesh: packAtlas(merged), home });
      }
      pieces = []; homes = []; rows = 0;
    };
    for (const ti of tiles) {
      const t = this.tiles[ti];
      if (!t) continue;
      for (const i of t.houses) {
        const h = this.build(i), lt = this.lots[i], pal = this.b.pal;
        const mine: MeshData[] = [];
        if (lod === 0) {
          const dense = h.grid.extract(h.gx0, h.gx1, h.gz0, h.gz1, 0);
          mine.push(meshGrid({ grid: dense, pal, scale: V, origin: [(h.gx0 - 1) * V, h.y0, (h.gz0 - 1) * V], region: [1, h.gx1 - h.gx0 + 1, 1, h.gz1 - h.gz0 + 1], light: h.light, groundBelow: 1, atlas: true }));
          for (const p of h.props) mine.push(meshGrid({ grid: p.grid, pal, scale: p.scale, origin: p.origin, light: h.light, atlas: true }));
        } else {
          const f = lod === 1 ? 2 : 4;
          const dense = h.grid.extract(h.gx0 - f + 1, h.gx1 + f - 1, h.gz0 - f + 1, h.gz1 + f - 1, 0);
          const coarse = coarsen(dense, f);
          mine.push(meshGrid({ grid: coarse, pal, scale: f * V, origin: [(h.gx0 - f) * V, h.y0, (h.gz0 - f) * V], region: [1, coarse.sx - 1, 1, coarse.sz - 1], light: h.light, groundBelow: 1, atlas: true }));
        }
        // (a rough count of the atlas rows the house needs: its texels over the atlas's width)
        let texels = 0;
        for (const m of mine) for (let k = 0; k < (m.blocks?.dims.length ?? 0); k += 2) texels += m.blocks!.dims[k] * m.blocks!.dims[k + 1];
        const need = Math.ceil((texels * 1.25) / 256);
        if (rows && rows + need > ATLAS_ROWS) flush();
        rows += need;
        for (const m of mine) { pieces.push(m); homes.push(m.vertexCount, lt.x, lt.z, ti); }
      }
    }
    flush();
    return out;
  }

  /** Builds house i in a voxel grid of its own and lights it. */
  private build(i: number): Built {
    const lt = this.lots[i], b = this.b, c = this.c;
    let seed = (lt.seed * 7919) % 2147483647 || 1;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // the footprint on the town's grid, a metre and a bit of terrace out in front of the door
    const vw = Math.max(18, Math.round(lt.w / V)), vd = Math.max(18, Math.round(lt.d / V));
    const x0 = Math.round((lt.x - lt.w / 2) / V), z0 = Math.round((lt.z - lt.d / 2) / V), x1 = x0 + vw - 1, z1 = z0 + vd - 1;
    const gy = snap(Math.max(lt.lo, lt.hi - 3));
    // the terrace wall goes down a metre and a half into the slope below the lowest corner
    const base = Math.max(6, Math.round((gy - lt.lo + 1.5) / V));
    const y0 = gy - base * V;
    const floors = 2 + Math.floor(rnd() * 1.8);
    const top = base + 4 + floors * 12;
    const T = 8; // terrace depth (voxels)
    const tx0 = x0 - (lt.front === 1 ? T : 0), tx1 = x1 + (lt.front === 0 ? T : 0), tz0 = z0 - (lt.front === 3 ? T : 0), tz1 = z1 + (lt.front === 2 ? T : 0);
    const M = 12;
    const gx0 = floor8(tx0 - M), gx1 = ceil8(tx1 + M + 1), gz0 = floor8(tz0 - M), gz1 = ceil8(tz1 + M + 1);
    const g = new SparseGrid(gx0, gz0, gx1 - gx0, ceil8(top + 34), gz1 - gz0);
    b.grid = g;
    b.props = []; b.lamps = []; b.indoor = []; b.occluders = []; b.sway = []; b.swayCells = new Map(); b.standing = []; b.wires = [];

    // where the ground is outside the house, as the standing layer the house's facade rules ask for: the terrace
    // in front, the slope rising to the uphill side behind, falling away below the terrace wall in front
    const rise = Math.max(0, lt.hi - gy) / V, drop = Math.max(0, gy - lt.lo) / V;
    const inTerrace = (x: number, z: number) => x >= tx0 && x <= tx1 && z >= tz0 && z <= tz1;
    const back = (x: number, z: number) => {
      // 0 at the front wall, 1 at the back wall
      const t = lt.front === 0 ? (x1 - x) / (x1 - x0) : lt.front === 1 ? (x - x0) / (x1 - x0) : lt.front === 2 ? (z1 - z) / (z1 - z0) : (z - z0) / (z1 - z0);
      return t;
    };
    const ground = (x: number, z: number): number => {
      if (inTerrace(x, z)) return base;
      const t = back(x, z);
      if (t < 0) return base - Math.round(drop);
      return base + Math.round(Math.min(1, t) * rise);
    };

    // the terrace: dry-stone courses, cotto tiles on top, a low parapet along its open edges
    g.box(tx0, 0, tz0, tx1, base - 2, tz1, (x, y, z) => masonry(c, x, y, z, false));
    g.box(tx0, base - 1, tz0, tx1, base - 1, tz1, (x, _y, z) => ((x + z) & 1 ? c.cotto : c.cottoB));
    const pc = rnd() < 0.6 ? c.whiteWarm : c.dryStone;
    const parapet = (x: number, z: number) => { g.box(x, base, z, x, base + 1, z, pc); g.set(x, base + 2, z, c.sill); };
    if (base > 6 || drop > 2) {
      if (lt.front === 0) for (let z = tz0; z <= tz1; z++) parapet(tx1, z);
      else if (lt.front === 1) for (let z = tz0; z <= tz1; z++) parapet(tx0, z);
      else if (lt.front === 2) for (let x = tx0; x <= tx1; x++) parapet(x, tz1);
      else for (let x = tx0; x <= tx1; x++) parapet(x, tz0);
      // a geranium or two in pots on the parapet
      for (let k = 0; k < 2; k++) if (rnd() < 0.6) {
        const a = 2 + Math.floor(rnd() * (lt.front < 2 ? tz1 - tz0 - 4 : tx1 - tx0 - 4));
        const [px, pz] = lt.front === 0 ? [tx1, tz0 + a] : lt.front === 1 ? [tx0, tz0 + a] : lt.front === 2 ? [tx0 + a, tz1] : [tx0 + a, tz0];
        g.set(px, base + 3, pz, c.terracotta);
        g.set(px, base + 4, pz, rnd() < 0.6 ? c.geranium : c.leaf);
      }
    }

    const plan: LotPlan = { id: i + 1, x0, z0, x1, z1, base, top, side: SIDES[lt.front], door: base, seed: lt.seed, shop: false };
    house(b, c, null, plan, ground);
    // the town's lamps burn as warm (see buildAmalfi)
    for (const l of b.lamps) { l.r *= 1.3; l.g *= 1.3; l.b *= 1.25; l.radius *= 1.15; }

    g.compact();
    const field = new LightField(g, SUN_STEP);
    for (const l of b.lamps) field.addLamp(l);
    for (const bx of b.indoor) field.indoor(bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], 0.62);
    const light: LightFn = (wx, wy, wz, nx, ny, nz, out) => {
      const px = wx / V + nx * 0.5, py = (wy - y0) / V + ny * 0.5, pz = wz / V + nz * 0.5;
      field.sample(px, py, pz, out);
      field.lampLight(px, py, pz, nx, ny, nz, out);
    };
    // props are placed in the town's metres (layer G at y 0): move them to this house's layers
    const props = b.props.map((p) => {
      const sc = p.prop.scale;
      const o = p.origin.map((v) => Math.round(v / sc) * sc);
      return { grid: p.prop.grid, scale: sc, origin: [o[0], o[1] + G * V + y0, o[2]] as [number, number, number] };
    });
    return { grid: g, y0, gx0, gx1, gz0, gz1, light, props };
  }
}
