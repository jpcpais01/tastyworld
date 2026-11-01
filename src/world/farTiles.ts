/**
 * The houses on the slopes past the edge of the Amalfi map, as farcoast.ts lays them out, grouped into tiles that are
 * baked and drawn together (world/amalfiFar.ts bakes them in a worker, engine/fartown.ts draws them). Plain data, so
 * the page and the worker can both import it.
 */

/** A house site: middle, footprint (m), ground at its lowest and highest corner, which side faces downhill
 * (0 +x, 1 -x, 2 +z, 3 -z), a seed. */
export interface FarLot { x: number; z: number; w: number; d: number; lo: number; hi: number; front: number; seed: number }

/** A tile: the houses in it (indices into the lot list) and the ground rect they cover (m). */
export interface FarTile { houses: number[]; x0: number; z0: number; x1: number; z1: number }

/** Tile side (m). Small enough that a tile near town and one up the mountain take different levels of detail. */
export const FAR_TILE = 48;
/** Most houses a tile bakes together (its atlas must stay a modest texture). */
const MAX_PER_TILE = 12;

export function farTiles(lots: readonly FarLot[]): FarTile[] {
  const cells = new Map<string, number[]>();
  lots.forEach((lt, i) => {
    const k = `${Math.floor(lt.x / FAR_TILE)},${Math.floor(lt.z / FAR_TILE)}`;
    let c = cells.get(k);
    if (!c) cells.set(k, (c = []));
    c.push(i);
  });
  const tiles: FarTile[] = [];
  for (const k of [...cells.keys()].sort()) {
    const all = cells.get(k)!;
    for (let s = 0; s < all.length; s += MAX_PER_TILE) {
      const houses = all.slice(s, s + MAX_PER_TILE);
      let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
      for (const i of houses) {
        const lt = lots[i];
        x0 = Math.min(x0, lt.x - lt.w / 2 - 3); x1 = Math.max(x1, lt.x + lt.w / 2 + 3);
        z0 = Math.min(z0, lt.z - lt.d / 2 - 3); z1 = Math.max(z1, lt.z + lt.d / 2 + 3);
      }
      tiles.push({ houses, x0, z0, x1, z1 });
    }
  }
  return tiles;
}
