/**
 * Where the street sounds come from, keyed by position (metres) so new districts can add their own.
 * Shop radios come from the walkable rooms instead (see STATIONS in game/audio.ts).
 */

export type Floor = 'stone' | 'wood' | 'tile' | 'gravel' | 'grass';

/** Ground underfoot outdoors; the smallest matching rect wins and anything else is paving stone. */
export const FLOORS: { rect: [number, number, number, number]; floor: Floor }[] = [
  { rect: [0, 5, 7.5, 19.5], floor: 'gravel' }, // temple plaza
  { rect: [0, 49.8, 72, 56], floor: 'grass' }, // cherry bank
];

/**
 * Point sources. temple: the big bell rung at dusk, dawn and now and then. crossing: a level crossing with
 * trains rolling through (the nearest one is heard). water: lapping water within r metres (ponds; the canal is
 * handled by the game).
 */
export const SOUND_SPOTS: { kind: 'temple' | 'crossing' | 'water'; pos: [number, number]; r?: number }[] = [
  { kind: 'temple', pos: [3.5, 9] },
  { kind: 'crossing', pos: [130, -10] },
];
