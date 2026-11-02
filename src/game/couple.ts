/**
 * Walking hand in hand on a couple's trip: where each of the two reaches, and how the one who isn't steering keeps in
 * step beside the one who is. Pure maths so scripts/coop-check.ts can test it without a browser.
 */

/** Gap between the two walkers, centre to centre: a held hand each side of the middle, inside both arms' reach. */
export const HAND_GAP = 0.85;

/**
 * The hand an actor at (ax, az) facing `facing` holds out to someone at (bx, bz), and the point it reaches for in its
 * own space (x across, y up, z forward): halfway between them at hip height. side 1 = the +x arm.
 */
export function handReach(ax: number, az: number, facing: number, bx: number, bz: number): { side: number; x: number; y: number; z: number } {
  const dx = bx - ax, dz = bz - az, c = Math.cos(facing), s = Math.sin(facing);
  const lx = dx * c - dz * s, lz = dx * s + dz * c;
  const side = lx >= 0 ? 1 : 0;
  return { side, x: (side ? 1 : -1) * clamp(Math.abs(lx) / 2, 0.34, 0.62), y: 0.66, z: clamp(lz / 2, -0.2, 0.3) };
}

export interface Walker { x: number; z: number; facing: number; speed: number }

/**
 * One frame of keeping in step: heads for the spot a hand's reach to the side of the partner (a touch ahead when they
 * walk), with hysteresis so it does not stutter. `on` is carried between frames. Null when there is nothing to do.
 */
export function followStep(on: boolean, me: { x: number; z: number }, mate: Walker, maxSpeed: number, walkSpeed: number): { on: boolean; dx: number; dz: number; speed: number } {
  const f = mate.facing, c = Math.cos(f), s = Math.sin(f);
  const lx = (me.x - mate.x) * c - (me.z - mate.z) * s;
  const sx = lx >= 0 ? HAND_GAP : -HAND_GAP;
  const lead = Math.min(mate.speed, maxSpeed) * 0.15;
  const tx = mate.x + sx * c + s * lead, tz = mate.z - sx * s + c * lead;
  const dMate = Math.hypot(mate.x - me.x, mate.z - me.z), dx = tx - me.x, dz = tz - me.z, d = Math.hypot(dx, dz);
  const moving = mate.speed > 0.2;
  if (!on && ((moving && dMate > 1.0) || dMate > 1.35)) on = true;
  if (on && (d < 0.12 || (!moving && (d < 0.2 || dMate < 1.0)))) on = false;
  if (!on || d < 1e-3) return { on, dx: 0, dz: 0, speed: 0 };
  const speed = moving ? clamp(mate.speed + (d - 0.1) * 2.5, 0, maxSpeed * 1.1) : Math.min(walkSpeed * 0.7, d * 3);
  return { on, dx: dx / d, dz: dz / d, speed };
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));
