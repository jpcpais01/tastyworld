/**
 * Food places added to a finished town (Amalfi and Funchal, v0.19.2). Where a street has no room left for a new
 * house, the place takes over the ground floor of the street house standing nearest its spot, so the rest of the
 * town keeps exactly its layout.
 */

interface Lot { x0: number; z0: number; x1: number; z1: number; base: number; top: number; side: 'n' | 's' | 'e' | 'w'; door: number; shop: boolean; food?: string; hotel?: string; secret?: boolean }

export interface TakenPlace { id: string; near: [number, number]; takeOver: true }

/** Turn the nearest fitting street house into each place; returns why any could not be placed. */
export function takeOverHouses(lots: Lot[], walk: Uint8Array, kind: Uint8Array, col: (x: number, z: number) => number, V: number, rock: number, paving: number, places: TakenPlace[]): string[] {
  const missed: string[] = [];
  for (const pl of places) {
    let best: Lot | null = null, bd = 6;
    for (const lt of lots) {
      // a house whose ground floor is on its street's level, the size of a restaurant
      if (lt.food || lt.hotel || lt.secret || lt.door < 0 || lt.base !== lt.door) continue;
      const alongX = lt.side === 'n' || lt.side === 's';
      const w = ((alongX ? lt.x1 - lt.x0 : lt.z1 - lt.z0) + 1) * V, dep = ((alongX ? lt.z1 - lt.z0 : lt.x1 - lt.x0) + 1) * V;
      if (w < 5.75 || w > 9.6 || dep < 5.5 || dep > 10.1) continue;
      const fx = lt.side === 'w' ? lt.x0 * V : lt.side === 'e' ? (lt.x1 + 1) * V : ((lt.x0 + lt.x1 + 1) / 2) * V;
      const fz = lt.side === 'n' ? lt.z0 * V : lt.side === 's' ? (lt.z1 + 1) * V : ((lt.z0 + lt.z1 + 1) / 2) * V;
      const d = Math.hypot(fx - pl.near[0], fz - pl.near[1]);
      if (d < bd) { bd = d; best = lt; }
    }
    if (!best) { missed.push(`${pl.id}: no street house near ${pl.near.join(',')}`); continue; }
    // its room sits a layer under the path like every restaurant's (navTop lifts the floor back to the door)
    best.food = pl.id; best.shop = true; best.base = best.door - 1;
    best.top = Math.min(214, Math.max(best.top, best.base + 4 + 3 * 12));
    for (let z = best.z0; z <= best.z1; z++) for (let x = best.x0; x <= best.x1; x++) walk[col(x, z)] = best.base;
    // pave the strip of hillside between the street and the open front up to the door's level
    const lt = best, [dx, dz] = lt.side === 'n' ? [0, -1] : lt.side === 's' ? [0, 1] : lt.side === 'w' ? [-1, 0] : [1, 0];
    const alongX = dx === 0;
    for (let u = alongX ? lt.x0 : lt.z0; u <= (alongX ? lt.x1 : lt.z1); u++) {
      let x = alongX ? u : dx < 0 ? lt.x0 - 1 : lt.x1 + 1, z = alongX ? (dz < 0 ? lt.z0 - 1 : lt.z1 + 1) : u;
      for (let k = 0; k < 4 && kind[col(x, z)] === rock; k++, x += dx, z += dz) { kind[col(x, z)] = paving; walk[col(x, z)] = lt.door; }
    }
  }
  return missed;
}
