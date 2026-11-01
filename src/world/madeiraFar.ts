import { FarTown, type FarKit } from './amalfiFar';
import { madeiraColors, house, masonry } from './funchal';
import type { FarLot } from './farTiles';

/**
 * The quintas and white houses climbing Funchal's amphitheatre past the map, built one by one by funchal.ts house()
 * (white plaster, basalt quoins and window frames, green shutters, tiled hip roofs) on black basalt terrace walls,
 * through the same worker bake and LOD as Amalfi's villages (world/amalfiFar.ts).
 */
const KIT = {
  colors: madeiraColors,
  house,
  masonry,
  // the terrace's edge: white plaster or bare basalt
  parapet: (c: ReturnType<typeof madeiraColors>, r: number) => (r < 0.55 ? c.whiteWarm : c.lava),
} as unknown as FarKit;

export const madeiraFarTown = (lots: FarLot[]) => new FarTown(lots, KIT);
