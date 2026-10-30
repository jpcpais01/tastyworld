/**
 * Rigid sway. A sway body is a group of voxels (a lantern, one noren panel, a wire, a sakura canopy) that
 * rotates as a whole about a pivot, so its voxels keep their shape and only the object tilts. Bodies are
 * stored in a small float texture and every vertex carries the id of its body (0 = static); the vertex
 * shader (swayVertex in engine/shaders.ts) does the motion from a shared wind field, so nothing moves on
 * the CPU and the world stays batched in its chunks.
 */
export interface SwayBody {
  /** Metres (props) or prop voxel units while still inside a Prop. */
  pivot: [number, number, number];
  /** Unit hinge axis, or [0, 0, 0] for a free pendulum / plant that can lean any way. */
  axis: [number, number, number];
  /** +1 stands up from the pivot (plants, trees, flags), -1 hangs below it (lanterns, cloth, wires). */
  up: 1 | -1;
  /** Radians of lean in a full breeze. */
  amp: number;
  /** Swing rate in radians per second. */
  freq: number;
  /** How far the body reaches from the pivot (m); people within that height band can brush it. 0 = out of reach. */
  reach: number;
  /** Radians of lean when someone brushes right past. */
  push: number;
  /** 1-based id of a body this one hangs from (a lantern on a swinging wire), 0 = none. */
  parent?: number;
  /** Per-body phase so neighbours never swing in step (filled in when placed). */
  phase?: number;
}

/** Bodies per texture row; each body takes three RGBA float texels. */
export const SWAY_ROW = 128;
export const SWAY_TEXELS = 3;
/**
 * Ids reserved per world worker. Each worker runs the city builder over its own strip, and what it places can
 * depend on what lies inside that strip, so every worker numbers its own bodies from part * SWAY_PART and ships
 * its own table; the sway texture stacks the tables (SWAY_PART / SWAY_ROW rows each).
 */
export const SWAY_PART = 16384; // 4 workers at most (main.ts), so ids fit the u16 vertex attribute

/** Key of a street voxel (builder coords) in Builder.swayCells. */
export function swayKey(g: { x0: number; z0: number; sx: number; sz: number }, x: number, y: number, z: number): number {
  return (y * g.sz + (z - g.z0)) * g.sx + (x - g.x0);
}

/** Pack bodies for the sway texture: (pivot, parent) (axis, amp) (freq, phase, signed reach, push); ids start at `base` + 1. */
export function packSway(bodies: SwayBody[], base = 0): Float32Array {
  const width = SWAY_ROW * SWAY_TEXELS;
  const height = Math.max(1, Math.ceil(bodies.length / SWAY_ROW));
  const data = new Float32Array(width * height * 4);
  bodies.forEach((b, i) => {
    const o = ((Math.floor(i / SWAY_ROW) * width) + (i % SWAY_ROW) * SWAY_TEXELS) * 4;
    data.set([b.pivot[0], b.pivot[1], b.pivot[2], b.parent ? b.parent + base : 0], o);
    data.set([b.axis[0], b.axis[1], b.axis[2], b.amp], o + 4);
    data.set([b.freq, b.phase ?? 0, b.reach * b.up, b.push], o + 8);
  });
  return data;
}

/** Stack the parts' tables (see SWAY_PART) into one texture's worth of data. */
export function stackSway(parts: { part: number; sway: Float32Array }[]): { data: Float32Array; width: number; height: number } {
  const width = SWAY_ROW * SWAY_TEXELS, rows = SWAY_PART / SWAY_ROW;
  let height = 1;
  for (const p of parts) height = Math.max(height, p.part * rows + p.sway.length / (width * 4));
  const data = new Float32Array(width * height * 4);
  for (const p of parts) data.set(p.sway, p.part * rows * width * 4);
  return { data, width, height };
}

// Presets, tuned to stay subtle: a few degrees at most, slow enough to read as a breeze, not a storm.
type Preset = Omit<SwayBody, 'pivot' | 'axis' | 'reach'>;
export const SWAY = {
  /** Paper lantern on a cord. */
  lantern: { up: -1, amp: 0.075, freq: 1.9, push: 0.3 },
  /** The giant temple-gate lantern barely moves. */
  giant: { up: -1, amp: 0.012, freq: 1.0, push: 0 },
  /** One noren panel hinged on its rod. */
  noren: { up: -1, amp: 0.11, freq: 1.6, push: 0.75 },
  /** Signboard hanging from the overhead wires. */
  sign: { up: -1, amp: 0.05, freq: 1.4, push: 0 },
  /** Overhead wire swinging about the line between its two ends. */
  wire: { up: -1, amp: 0.11, freq: 1.15, push: 0 },
  /** Nobori banner turning on its pole. */
  flag: { up: 1, amp: 0.2, freq: 2.0, push: 0 },
  /** Shirt or towel on a laundry line. */
  laundry: { up: -1, amp: 0.13, freq: 1.8, push: 0 },
  /** Potted shrub or flowers bending from the soil. */
  shrub: { up: 1, amp: 0.05, freq: 1.9, push: 0.32 },
  /** A single bamboo cane. */
  bamboo: { up: 1, amp: 0.07, freq: 1.4, push: 0.28 },
  /** Bonsai pine: stiff. */
  pine: { up: 1, amp: 0.02, freq: 1.3, push: 0.1 },
  /** Cut flowers, planter greens. */
  flowers: { up: 1, amp: 0.08, freq: 2.2, push: 0.3 },
  /** Sakura canopy rocking on its trunk. */
  tree: { up: 1, amp: 0.016, freq: 0.75, push: 0 },
  /** Grass tuft, reeds. */
  grass: { up: 1, amp: 0.12, freq: 2.6, push: 0.45 },
  /** Garden bush on the ground. */
  bush: { up: 1, amp: 0.035, freq: 1.6, push: 0.22 },
  /** Little bunting flags on a string. */
  bunting: { up: -1, amp: 0.15, freq: 1.3, push: 0 },
  /** Glass wind chime under the eaves: the liveliest thing in the street. */
  chime: { up: -1, amp: 0.2, freq: 2.8, push: 0 },
  /** A playground swing seat on its chains. */
  swing: { up: -1, amp: 0.1, freq: 1.4, push: 0.7 },
} satisfies Record<string, Preset>;
