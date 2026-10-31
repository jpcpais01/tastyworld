import type { BakedWorld, PartInit } from './bake';
import { CHUNK, SX, SZ, WX0, WZ0, INTERIOR_ORIGIN, ISX, ISZ, V } from './layout';
import { buildOwners } from './owners';
import { stackSway } from './sway';

/** Stitch the strips of all parts into one world description. */
export function assemble(inits: PartInit[]): BakedWorld {
  inits.sort((a, b) => a.part - b.part);
  const a0 = inits[0];
  const nav = new Uint8Array(SX * SZ), height = new Uint8Array(SX * SZ), shore = new Uint8Array(SX * SZ);
  const ground = a0.ground ? new Uint8Array(SX * SZ) : null;
  const solid = new Uint32Array(SX * SZ * 2);
  const lm = new Uint8Array((SX / 2) * (SZ / 2) * 5);
  let ms = 0, bytes = 0;
  for (const p of inits) {
    const r0 = p.rows[0] * CHUNK;
    nav.set(p.nav, r0 * SX);
    height.set(p.height, r0 * SX);
    solid.set(p.solid, r0 * SX * 2);
    shore.set(p.shore, r0 * SX);
    if (ground && p.ground) ground.set(p.ground, r0 * SX);
    lm.set(p.lightmap, (r0 / 2) * (SX / 2) * 5);
    ms = Math.max(ms, p.stats.ms);
    bytes += p.stats.bytes;
  }
  const tagged = inits.flatMap((p) => p.tagged);
  const int = a0.interior!;
  // who owns each column decides where the cutaway may cut, and where the mesher keeps faces between neighbours
  const [iox, , ioz] = INTERIOR_ORIGIN;
  const owners = buildOwners(a0.anchors.occluders, [
    // the Kakurega's two tall walls lower like any building when they come between camera and player
    { rect: [iox, ioz, iox + 3 * V, ioz + ISZ * V], top: 4.5, low: 0.95, kind: 'landmark' },
    { rect: [iox, ioz, iox + ISX * V, ioz + 3 * V], top: 4.5, low: 0.95, kind: 'landmark' },
  ], { ox: WX0, oz: WZ0, sx: SX, sz: SZ }, { ox: iox, oz: ioz, sx: ISX, sz: ISZ },
  { height, solid, walk: nav, ground: ground ?? undefined }, { height: int.height, solid: int.solid });
  return {
    tagged,
    nav: { sx: SX, sz: SZ, ox: WX0, oz: WZ0, height: nav },
    lightmap: { sx: SX / 2, sz: SZ / 2, ox: WX0, oz: WZ0, cell: 0.5, data: lm },
    interiorChunks: int.chunks, interiorNav: int.nav, interiorLightmap: int.lightmap,
    height, interiorHeight: int.height, solid, interiorSolid: int.solid, owners, shore, ground,
    hotelRooms: Object.fromEntries(inits.flatMap((p) => p.hotelRooms.map(({ id, nav: n, lightmap }) => [id, { nav: n, lightmap }]))),
    anchors: a0.anchors,
    sway: stackSway(inits),
    stats: { lamps: a0.stats.lamps, ms, bytes },
  };
}

