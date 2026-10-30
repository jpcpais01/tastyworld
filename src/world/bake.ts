import { Grid } from './grid';
import { LightField, Lamp } from './lighting';
import { meshGrid, mergeMeshes, MeshData, LightFn } from './mesher';
import { Palette } from './palette';
import { buildTokyo, Anchors, PlacedProp } from './tokyo';
import { CHUNK, G, V, INTERIOR_ORIGIN } from './layout';

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

export interface BakedWorld {
  chunks: MeshData[];
  tagged: { tag: string; mesh: MeshData }[];
  nav: NavData;
  lightmap: LightMap2D;
  interiorChunks: MeshData[];
  interiorNav: NavData;
  interiorLightmap: LightMap2D;
  /** Per-column height (voxels above street level) of the solid run that starts at the street, for section caps. */
  height: Uint8Array;
  interiorHeight: Uint8Array;
  anchors: Anchors;
  stats: { faces: number; lamps: number; ms: number };
}

function lightFnFor(field: LightField, ox: number, oz: number): LightFn {
  // world metres -> coarse voxel coords of this field's grid
  return (wx, wy, wz, nx, ny, nz, out) => {
    const px = (wx - ox) / V + nx * 0.5, py = wy / V + G + ny * 0.5, pz = (wz - oz) / V + nz * 0.5;
    field.sample(px, py, pz, out);
    field.lampLight(px, py, pz, nx, ny, nz, out);
  };
}

function meshWorld(grid: Grid, pal: Palette, field: LightField, props: PlacedProp[], ox: number, oz: number, progress?: (f: number) => void, part = 0, parts = 1): { chunks: MeshData[]; tagged: { tag: string; mesh: MeshData }[] } {
  const light = lightFnFor(field, ox, oz);
  const cxN = Math.ceil(grid.sx / CHUNK), czN = Math.ceil(grid.sz / CHUNK);
  const buckets: PlacedProp[][] = Array.from({ length: cxN * czN }, () => []);
  const tagged: { tag: string; mesh: MeshData }[] = [];
  for (const p of props) {
    const sc = p.prop.scale;
    p.origin = [Math.round(p.origin[0] / sc) * sc, Math.round(p.origin[1] / sc) * sc, Math.round(p.origin[2] / sc) * sc];
    const mesh = () => meshGrid({ grid: p.prop.grid, pal, scale: p.prop.scale, origin: p.origin, light });
    if (p.tag) { if (part === 0) tagged.push({ tag: p.tag, mesh: mesh() }); continue; }
    const cx = p.origin[0] + (p.prop.sx * p.prop.scale) / 2 - ox;
    const cz = p.origin[2] + (p.prop.sz * p.prop.scale) / 2 - oz;
    const ix = Math.min(cxN - 1, Math.max(0, Math.floor(cx / V / CHUNK)));
    const iz = Math.min(czN - 1, Math.max(0, Math.floor(cz / V / CHUNK)));
    buckets[iz * cxN + ix].push(p);
  }
  const chunks: MeshData[] = [];
  let done = 0;
  const mine = Math.ceil((cxN * czN) / parts);
  for (let iz = 0; iz < czN; iz++)
    for (let ix = 0; ix < cxN; ix++) {
      if ((iz * cxN + ix) % parts !== part) continue;
      const x0 = ix * CHUNK, z0 = iz * CHUNK;
      const pieces: MeshData[] = [
        meshGrid({ grid, pal, scale: V, origin: [ox, -G * V, oz], region: [x0, Math.min(grid.sx, x0 + CHUNK), z0, Math.min(grid.sz, z0 + CHUNK)], light, groundBelow: G }),
      ];
      for (const p of buckets[iz * cxN + ix])
        pieces.push(meshGrid({ grid: p.prop.grid, pal, scale: p.prop.scale, origin: p.origin, light }));
      const m = mergeMeshes(pieces);
      if (m) chunks.push(m);
      progress?.(++done / mine);
    }
  return { chunks, tagged };
}

const BLOCKED = 255;

function computeHeight(grid: Grid): Uint8Array {
  const out = new Uint8Array(grid.sx * grid.sz);
  for (let z = 0; z < grid.sz; z++)
    for (let x = 0; x < grid.sx; x++) {
      let y = G;
      while (y < grid.sy && grid.get(x, y, z) !== 0) y++;
      out[z * grid.sx + x] = Math.min(255, y - G);
    }
  return out;
}

function computeNav(grid: Grid, ox: number, oz: number, blockers: [number, number, number, number][], minH: number): NavData {
  const { sx, sz } = grid;
  const height = new Uint8Array(sx * sz).fill(BLOCKED);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      for (let y = G + 8; y >= 1; y--) {
        if (grid.get(x, y - 1, z) === 0) continue;
        let clear = true;
        for (let k = 0; k < 7; k++) if (grid.get(x, y + k, z) !== 0) { clear = false; break; }
        if (clear && y >= minH) height[z * sx + x] = y;
        break;
      }
    }
  for (const [x0, z0, x1, z1] of blockers) {
    const ax = Math.max(0, Math.floor((x0 - ox) / V)), bx = Math.min(sx - 1, Math.floor((x1 - ox) / V));
    const az = Math.max(0, Math.floor((z0 - oz) / V)), bz = Math.min(sz - 1, Math.floor((z1 - oz) / V));
    for (let z = az; z <= bz; z++) for (let x = ax; x <= bx; x++) height[z * sx + x] = BLOCKED;
  }
  return { sx, sz, ox, oz, height };
}

function computeLightmap(grid: Grid, field: LightField, nav: NavData, ox: number, oz: number): LightMap2D {
  const cell = 0.5;
  const step = cell / V;
  const sx = Math.ceil(grid.sx / step), sz = Math.ceil(grid.sz / step);
  const data = new Uint8Array(sx * sz * 5);
  const out = new Float32Array(5);
  for (let z = 0; z < sz; z++)
    for (let x = 0; x < sx; x++) {
      const vx = (x + 0.5) * step, vz = (z + 0.5) * step;
      const nh = nav.height[Math.min(nav.sz - 1, Math.floor(vz)) * nav.sx + Math.min(nav.sx - 1, Math.floor(vx))];
      const base = nh === BLOCKED ? G : nh;
      field.sample(vx, base + 4.5, vz, out);
      field.lampLight(vx, base + 5, vz, 0, 0, 0, out);
      const i = (z * sx + x) * 5;
      data[i] = Math.round(out[0] * 255);
      data[i + 1] = Math.round(out[1] * 255);
      data[i + 2] = Math.min(255, Math.round(out[2] * 127.5));
      data[i + 3] = Math.min(255, Math.round(out[3] * 127.5));
      data[i + 4] = Math.min(255, Math.round(out[4] * 127.5));
    }
  return { sx, sz, ox, oz, cell, data };
}

export function bakeWorld(progress?: (stage: string, f: number) => void, part = 0, parts = 1): BakedWorld {
  const t0 = performance.now();
  progress?.('Building Tokyo', 0.02);
  const res = buildTokyo();
  progress?.('Lighting the streets', 0.18);
  const field = new LightField(res.grid, SUN_STEP);
  for (const l of res.lamps) field.addLamp(l);
  progress?.('Placing lanterns', 0.32);
  const { chunks, tagged } = meshWorld(res.grid, res.pal, field, res.props, 0, 0, (f) => progress?.('Carving voxels', 0.32 + f * 0.55), part, parts);
  if (part !== 0) {
    return {
      chunks, tagged, nav: null as unknown as NavData, lightmap: null as unknown as LightMap2D, interiorChunks: [],
      interiorNav: null as unknown as NavData, interiorLightmap: null as unknown as LightMap2D,
      height: null as unknown as Uint8Array, interiorHeight: null as unknown as Uint8Array, anchors: res.anchors,
      stats: { faces: 0, lamps: 0, ms: performance.now() - t0 },
    };
  }
  const nav = computeNav(res.grid, 0, 0, res.anchors.blockers, 10);
  const lightmap = computeLightmap(res.grid, field, nav, 0, 0);

  progress?.('Preparing a secret', 0.9);
  const [iox, , ioz] = INTERIOR_ORIGIN;
  const ifield = new LightField(res.interior.grid, SUN_STEP);
  for (const l of res.interior.lamps as Lamp[]) ifield.addLamp(l);
  const im = meshWorld(res.interior.grid, res.pal, ifield, res.interior.props, iox, ioz);
  const interiorNav = computeNav(res.interior.grid, iox, ioz, [
    [iox + 2.0, ioz + 5.2, iox + 11.2, ioz + 6.8], // counter
    [iox + 1.4, ioz + 1.4, iox + 11.2, ioz + 2.8], // prep shelf
    [iox + 10.8, ioz + 0.4, iox + 14.2, ioz + 1.8], // alcove
  ], G);
  const interiorLightmap = computeLightmap(res.interior.grid, ifield, interiorNav, iox, ioz);

  let faces = 0;
  for (const c of chunks) faces += c.indices.length / 6;
  for (const c of im.chunks) faces += c.indices.length / 6;
  progress?.('Ready', 1);
  return {
    chunks, tagged, nav, lightmap,
    interiorChunks: im.chunks, interiorNav, interiorLightmap,
    height: computeHeight(res.grid), interiorHeight: computeHeight(res.interior.grid),
    anchors: res.anchors,
    stats: { faces, lamps: field.lampCount, ms: performance.now() - t0 },
  };
}
