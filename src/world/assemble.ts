import type { BakedWorld, PartInit } from './bake';
import { CHUNK, SX, SZ, WX0, WZ0 } from './layout';

/** Stitch the strips of all parts into one world description. */
export function assemble(inits: PartInit[]): BakedWorld {
  inits.sort((a, b) => a.part - b.part);
  const a0 = inits[0];
  const nav = new Uint8Array(SX * SZ), height = new Uint8Array(SX * SZ), shore = new Uint8Array(SX * SZ);
  const lm = new Uint8Array((SX / 2) * (SZ / 2) * 5);
  let ms = 0, bytes = 0;
  for (const p of inits) {
    const r0 = p.rows[0] * CHUNK;
    nav.set(p.nav, r0 * SX);
    height.set(p.height, r0 * SX);
    shore.set(p.shore, r0 * SX);
    lm.set(p.lightmap, (r0 / 2) * (SX / 2) * 5);
    ms = Math.max(ms, p.stats.ms);
    bytes += p.stats.bytes;
  }
  const tagged = inits.flatMap((p) => p.tagged);
  const int = a0.interior!;
  return {
    tagged,
    nav: { sx: SX, sz: SZ, ox: WX0, oz: WZ0, height: nav },
    lightmap: { sx: SX / 2, sz: SZ / 2, ox: WX0, oz: WZ0, cell: 0.5, data: lm },
    interiorChunks: int.chunks, interiorNav: int.nav, interiorLightmap: int.lightmap,
    height, interiorHeight: int.height, shore,
    anchors: a0.anchors,
    stats: { lamps: a0.stats.lamps, ms, bytes },
  };
}

