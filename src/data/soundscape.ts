/** Where the (quiet) street sounds come from, keyed by position (metres) so new districts can add their own. */
import { perCity } from '../world/cityId';

export type Floor = 'stone' | 'wood' | 'tile' | 'gravel' | 'grass';

/** Ground underfoot outdoors; the smallest matching rect wins and anything else is paving stone. */
export const FLOORS: { rect: [number, number, number, number]; floor: Floor }[] = perCity({
  tokyo: [
    { rect: [0, 5, 7.5, 19.5], floor: 'gravel' }, // temple plaza
    { rect: [0, 49.8, 72, 56], floor: 'grass' }, // cherry bank
  ],
  amalfi: [],
  istanbul: [],
  madeira: [],
  neo: [],
});

/** Point sources. water: gently lapping water within r metres (ponds; the canal is handled by the game). */
export const SOUND_SPOTS: { kind: 'water'; pos: [number, number]; r?: number }[] = [];
