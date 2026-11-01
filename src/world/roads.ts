// Tokyo's two traffic avenues as the cars, the signals and the crowd see them: where the carriageway runs,
// where the crosswalks are and which light guards each, the underpasses the avenues dive into at the edge of
// town, and the height of the road over Neon-dori's canal bridge. Everything here is plain geometry derived
// from constants (voxel units unless noted, x * V metres), so the city builder, its workers and the game agree
// without reading the grid.
import { V, VX0, VZ0, SX, SZ } from './layout';
import { shoreRoad, shoreOn, shoreCrossing, shoreY, shoreShade } from './shoreRoads';

const XW = VX0, XE = VX0 + SX - 1, ZS = VZ0 + SZ - 1;

export interface Avenue {
  name: string;
  ew: boolean;
  /** The whole street, pavements included (inclusive voxel rect, as in city.ts STREETS). */
  x0: number; z0: number; x1: number; z1: number;
}
export const HIKARI: Avenue = { name: 'Hikari-dori', ew: true, x0: XW, z0: -112, x1: XE, z1: -73 };
export const NEON: Avenue = { name: 'Neon-dori', ew: false, x0: 288, z0: -200, x1: 327, z1: ZS };
export const AVENUES = [HIKARI, NEON];

/** Pavement depth (voxels) on each side; the kerb is the next voxel, the carriageway starts after it. */
export const PAVE = 7;
/** Carriageway across an avenue (voxels from its first column / row): kerb at 7 and 32, road 8..31. */
export const ROAD0 = PAVE + 1, ROAD1 = 31;
/** Lane centres, metres from the avenue's centre line; traffic keeps left. */
export const LANE = 1.4;

/** Avenue centre line in metres (z for Hikari-dori, x for Neon-dori). */
export const centreOf = (a: Avenue) => ((a.ew ? a.z0 + a.z1 + 1 : a.x0 + a.x1 + 1) / 2) * V;

// ---------------------------------------------------------------------------------------------
// Crosswalks

export type Phase = 'ew' | 'ns' | 'mid';
export interface Crosswalk {
  id: number;
  av: Avenue;
  /** Zebra along the avenue, inclusive voxels. */
  lo: number; hi: number;
  /** Which light lets cars through: the scramble's two avenue phases, or a crossing's own. No light: -1 offset. */
  phase: Phase;
  /** Start of this light's cycle (s), so lights down an avenue roll green ahead of the traffic. */
  offset: number;
  signal: boolean;
  /** The scramble: every arm and both diagonals walk together. */
  scramble: boolean;
}

const cw: Omit<Crosswalk, 'id'>[] = [
  // Hikari-dori, west to east: Ki-no-michi's shrine path, Nishi-dori, the station, the scramble, Golden lane
  { av: HIKARI, lo: -168, hi: -153, phase: 'mid', offset: 4, signal: true, scramble: false },
  { av: HIKARI, lo: -40, hi: -1, phase: 'mid', offset: 15, signal: true, scramble: false },
  { av: HIKARI, lo: 136, hi: 151, phase: 'mid', offset: 30, signal: true, scramble: false },
  { av: HIKARI, lo: 288, hi: 327, phase: 'ew', offset: 0, signal: true, scramble: true },
  { av: HIKARI, lo: 448, hi: 463, phase: 'mid', offset: 22, signal: true, scramble: false },
  // Neon-dori, north to south: under the tracks, Ura-michi, Kaminari Lane to Center-gai, the canal banks, Minami-dori, Sakura-koji
  { av: NEON, lo: -200, hi: -185, phase: 'mid', offset: 0, signal: false, scramble: false },
  { av: NEON, lo: -24, hi: -1, phase: 'mid', offset: 6, signal: true, scramble: false },
  { av: NEON, lo: 40, hi: 59, phase: 'mid', offset: 12, signal: true, scramble: false },
  { av: NEON, lo: 150, hi: 158, phase: 'mid', offset: 20, signal: true, scramble: false },
  // the two canal bank crossings, a few steps apart, change together (the cars stop before the pair)
  { av: NEON, lo: 208, hi: 216, phase: 'mid', offset: 30, signal: true, scramble: false },
  { av: NEON, lo: 224, hi: 259, phase: 'mid', offset: 30, signal: true, scramble: false },
  { av: NEON, lo: 360, hi: 375, phase: 'mid', offset: 38, signal: true, scramble: false },
];
export const CROSSWALKS: Crosswalk[] = cw.map((c, id) => ({ ...c, id }));
export const SCRAMBLE = CROSSWALKS.find((c) => c.scramble)!;

/** The crosswalks drawn across an avenue (by its name, as STREETS has it). */
export const crosswalksOf = (name: string) => CROSSWALKS.filter((c) => c.av.name === name);

// ---------------------------------------------------------------------------------------------
// Signal timing (seconds). Ordinary crossings: cars go, amber, all red, people walk, the walk light blinks,
// all red. The scramble: Hikari-dori, Neon-dori, then everyone on foot at once, every which way.

const MID = { go: 26, amber: 3, clear: 2, walk: 13, blink: 4 };
export const MID_CYCLE = MID.go + MID.amber + MID.clear + MID.walk + MID.blink + MID.clear;
const SCR = { ew: 22, ns: 18, amber: 3, clear: 2, walk: 16, blink: 4 };
export const SCRAMBLE_CYCLE = SCR.ew + SCR.amber + SCR.clear + SCR.ns + SCR.amber + SCR.clear + SCR.walk + SCR.blink + SCR.clear;

export type CarLight = 'green' | 'amber' | 'red';
export type WalkLight = 'walk' | 'blink' | 'stop';

/** The car light a crossing shows to traffic of the given phase (`ns` or `ew` at the scramble) at clock t. */
export function carLight(c: Crosswalk, t: number, phase: Phase = c.phase): CarLight {
  if (!c.signal) return 'green';
  if (c.scramble) {
    const u = (((t - c.offset) % SCRAMBLE_CYCLE) + SCRAMBLE_CYCLE) % SCRAMBLE_CYCLE;
    const a0 = phase === 'ew' ? 0 : SCR.ew + SCR.amber + SCR.clear;
    const go = phase === 'ew' ? SCR.ew : SCR.ns;
    if (u >= a0 && u < a0 + go) return 'green';
    if (u >= a0 + go && u < a0 + go + SCR.amber) return 'amber';
    return 'red';
  }
  const u = (((t - c.offset) % MID_CYCLE) + MID_CYCLE) % MID_CYCLE;
  return u < MID.go ? 'green' : u < MID.go + MID.amber ? 'amber' : 'red';
}

/** What the walk light at a crossing says at clock t. */
export function walkLight(c: Crosswalk, t: number): WalkLight {
  if (!c.signal) return 'walk';
  if (c.scramble) {
    const u = (((t - c.offset) % SCRAMBLE_CYCLE) + SCRAMBLE_CYCLE) % SCRAMBLE_CYCLE;
    const w0 = SCR.ew + SCR.ns + 2 * (SCR.amber + SCR.clear);
    return u >= w0 && u < w0 + SCR.walk ? 'walk' : u >= w0 + SCR.walk && u < w0 + SCR.walk + SCR.blink ? 'blink' : 'stop';
  }
  const u = (((t - c.offset) % MID_CYCLE) + MID_CYCLE) % MID_CYCLE;
  const w0 = MID.go + MID.amber + MID.clear;
  return u >= w0 && u < w0 + MID.walk ? 'walk' : u >= w0 + MID.walk && u < w0 + MID.walk + MID.blink ? 'blink' : 'stop';
}

// ---------------------------------------------------------------------------------------------
// Underpasses: where each avenue reaches the edge of town its carriageway ramps down between retaining walls
// and runs on under the street out of the map, so the traffic comes and goes out of sight.

export interface Underpass {
  av: Avenue;
  /** +1 when the ramp runs down towards increasing x (or z), -1 towards decreasing. */
  dir: 1 | -1;
  /** Along the avenue (voxels): the last level column at the top of the ramp, and the tunnel mouth. */
  top: number;
  mouth: number;
}
/** Voxels the ramp drops, and how many columns each one-voxel step runs. */
export const DROP = 10, STEP = 5;
export const UNDERPASSES: Underpass[] = [
  { av: HIKARI, dir: -1, top: XW + 12 + DROP * STEP, mouth: XW + 12 },
  { av: HIKARI, dir: 1, top: XE - 12 - DROP * STEP, mouth: XE - 12 },
  { av: NEON, dir: 1, top: ZS - 12 - DROP * STEP, mouth: ZS - 12 },
];

/** Voxels the carriageway has dropped at `along` (0 at street level, up to DROP in the tunnel). */
export function rampDrop(u: Underpass, along: number): number {
  const e = (along - u.top) * u.dir;
  return e <= 0 ? 0 : Math.min(DROP, Math.ceil(e / STEP));
}

/** The underpass whose trench or tunnel holds voxel column (x, z), if any (kerbs and walls included). */
export function underpassAt(x: number, z: number): Underpass | null {
  for (const u of UNDERPASSES) {
    const a = u.av, along = a.ew ? x : z, across = a.ew ? z - a.z0 : x - a.x0;
    if (across < PAVE || across > ROAD1 + 1) continue;
    if ((along - u.top) * u.dir > 0) return u;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Neon-dori's canal bridge: the deck humps up two voxels over the water (rows 166..201), one on each approach.

export const BRIDGE = { x0: NEON.x0, x1: NEON.x1, z0: 160, z1: 207, zA: 166, zB: 201 };
/** Voxels the bridge deck stands above the street at row z (0 off the bridge). */
export function bridgeRise(z: number): number {
  if (z < BRIDGE.z0 || z > BRIDGE.z1) return 0;
  return z >= BRIDGE.zA && z <= BRIDGE.zB ? 2 : 1;
}

// ---------------------------------------------------------------------------------------------
// Queries in metres

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/**
 * Height of the road surface (metres above the street) under a car at (x, z): smooth through the voxel
 * steps of the ramps and the bridge, so a car glides up and down them instead of hopping.
 */
function tokyoRoadY(x: number, z: number): number {
  for (const u of UNDERPASSES) {
    const a = u.av, along = (a.ew ? x : z) / V;
    const across = (a.ew ? z : x) / V - (a.ew ? a.z0 : a.x0);
    if (across < PAVE - 1 || across > ROAD1 + 2) continue;
    // through the middle of each riser: the first is at top + 1 (going +), each STEP columns on
    const e = u.dir > 0 ? along - (u.top + 1) : u.top - along;
    if (e > -3) return clamp(-0.125 - e * 0.05, -DROP * V, 0);
  }
  if (x >= NEON.x0 * V && x <= (NEON.x1 + 1) * V) {
    const zv = z / V;
    if (zv > BRIDGE.z0 - 4 && zv < BRIDGE.z1 + 5) {
      // risers at rows 160, 166 going up and 202, 208 coming down
      const up = clamp(0.125 + (zv - 160) * (0.25 / 6), 0, 0.5), down = clamp(0.375 - (zv - 202) * (0.25 / 6), 0, 0.5);
      return Math.min(up, down);
    }
  }
  return 0;
}

/** How much daylight reaches a car at (x, z) at road height y: 1 in the open, dimmer down a ramp, dark in a tunnel. */
function tokyoShade(x: number, z: number, y: number): number {
  if (y >= 0) return 1;
  for (const u of UNDERPASSES) {
    const along = (u.av.ew ? x : z) / V;
    const past = (along - u.mouth) * u.dir; // columns beyond the mouth, under the roof
    if (past > -2 && Math.abs((u.av.ew ? z : x) - centreOf(u.av)) < 4) return clamp(0.55 - (past + 2) * 0.12, 0.04, 0.55) * clamp(1 + y * 0.2, 0.5, 1);
  }
  return clamp(1 + y * 0.18, 0.5, 1);
}

/** True on an avenue's carriageway (between the kerbs), the scramble's box included. */
function tokyoOn(x: number, z: number): boolean {
  for (const a of AVENUES) {
    const along = (a.ew ? x : z) / V, acr = (a.ew ? z : x) / V - (a.ew ? a.z0 : a.x0);
    if (along < (a.ew ? a.x0 : a.z0) || along > (a.ew ? a.x1 : a.z1) + 1) continue;
    if (acr >= ROAD0 && acr < ROAD1 + 1) return true;
  }
  return false;
}

/** The crosswalk whose zebra (with a metre to spare either side) holds (x, z), if (x, z) is on a carriageway. */
function tokyoCrosswalk(x: number, z: number, spare: number): Crosswalk | null {
  // the scramble is one big crossing, its corners to the kerbs of all four arms
  if (x >= NEON.x0 * V - spare && x <= (NEON.x1 + 1) * V + spare && z >= HIKARI.z0 * V - spare && z <= (HIKARI.z1 + 1) * V + spare) return SCRAMBLE;
  for (const c of CROSSWALKS) {
    const a = c.av, along = (a.ew ? x : z) / V, acr = (a.ew ? z : x) / V - (a.ew ? a.z0 : a.x0);
    if (acr < ROAD0 - 1 || acr >= ROAD1 + 2) continue;
    if (along >= c.lo - spare / V && along < c.hi + 1 + spare / V) return c;
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// The city's roads: Tokyo's avenues above, or the other cities' shore road (world/shoreRoads.ts)

const SHORE = shoreRoad();

/** Height of the road surface under a car at (x, z): metres above Tokyo's street level, world height elsewhere. */
export const roadY = (x: number, z: number): number => (SHORE ? shoreY(SHORE, x, z) : tokyoRoadY(x, z));

/** How much daylight reaches a car at (x, z) at road height y: 1 in the open, dim down a ramp, dark in a tunnel. */
export const roadShade = (x: number, z: number, y: number): number => (SHORE ? shoreShade(SHORE, x, z) : tokyoShade(x, z, y));

/** True on a carriageway (between the kerbs). */
export const onCarriageway = (x: number, z: number): boolean => (SHORE ? shoreOn(SHORE, x, z) : tokyoOn(x, z));

/** The crosswalk whose zebra (with `spare` metres either side) holds (x, z), if (x, z) is on a carriageway. */
export const crosswalkAt = (x: number, z: number, spare = 1): Crosswalk | null => (SHORE ? shoreCrossing(SHORE, x, z, spare) : tokyoCrosswalk(x, z, spare));

/** Road people on foot keep off: a carriageway away from its crosswalks (walking routes only cross there). */
export const offFoot = (x: number, z: number): boolean => onCarriageway(x, z) && !crosswalkAt(x, z, 0);

/**
 * Where someone walking from (ax, az) to (bx, bz) steps off the kerb onto a carriageway, and the crossing
 * there; null when the walk stays on the pavement (or starts out in the road already).
 */
export function kerbStep(ax: number, az: number, bx: number, bz: number): { x: number; z: number; c: Crosswalk | null } | null {
  if (onCarriageway(ax, az)) return null;
  const d = Math.hypot(bx - ax, bz - az);
  const n = Math.ceil(d / 0.2);
  for (let i = 1; i <= n; i++) {
    const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (onCarriageway(x, z)) {
      const back = Math.max(0, t - 0.45 / Math.max(d, 1e-3));
      return { x: ax + (bx - ax) * back, z: az + (bz - az) * back, c: crosswalkAt(x, z, 1.5) };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------
// Signal poles: one for each direction of traffic, on the kerb after the crosswalk, its arm out over the lane
// and its lamps facing the oncoming cars; walk lights on the poles face across the road.

export interface SignalPole {
  /** Footprint centre (metres) and quarter turns of the signalPole prop (its arm runs along +X at turns 0). */
  x: number; z: number; turns: number;
  /** Where the pole itself stands (metres), and the height of the ground there (up on the bridge). */
  fx: number; fz: number; y: number;
  cross: number;
  phase: Phase;
}

export function signalPoles(): SignalPole[] {
  const out: SignalPole[] = [];
  // the scramble also stands across Neon-dori: its arms north and south of the box get poles of their own
  const runs: { c: Crosswalk; a: Avenue; lo: number; hi: number }[] = CROSSWALKS.filter((c) => c.signal).map((c) => ({ c, a: c.av, lo: c.lo, hi: c.hi }));
  runs.push({ c: SCRAMBLE, a: NEON, lo: HIKARI.z0, hi: HIKARI.z1 });
  for (const { c, a, lo, hi } of runs) {
    for (const dir of [1, -1] as const) {
      const along = dir > 0 ? hi + 3 : lo - 3;
      // traffic keeps left: going +x on Hikari-dori is the -z kerb; going +z on Neon-dori is the +x kerb
      const kerbLow = a.ew ? dir > 0 : dir < 0;
      const across = kerbLow ? PAVE - 1 : ROAD1 + 2;
      const ax = a.ew ? along : (a.x0 + across), az = a.ew ? (a.z0 + across) : along;
      // arm reaching from the kerb over the lane: Hikari-dori's arms point along z, Neon-dori's along x
      // +X is turns 0, -Z turns 1, -X turns 2, +Z turns 3
      const turns = a.ew ? (kerbLow ? 3 : 1) : (kerbLow ? 0 : 2);
      const y = a === NEON ? bridgeRise(along) * V : 0;
      out.push({ ...poleCentre((ax + 0.5) * V, (az + 0.5) * V, turns), fx: (ax + 0.5) * V, fz: (az + 0.5) * V, y, turns, cross: c.id, phase: c.scramble ? (a.ew ? 'ew' : 'ns') : 'mid' });
    }
  }
  return out;
}

/** Signal pole prop layout (prop voxels, 0.125 m): the pole stands at (1, 1); see props.signalPole. */
export const POLE = { sx: 16, sy: 40, sz: 4, foot: [1.5, 1.5] as [number, number], scale: 0.125 };

/** Footprint centre of a signalPole (mirrored or not) turned by `turns` whose pole foot lands on (x, z) metres. */
export function poleCentre(x: number, z: number, turns: number, mirror = false): { x: number; z: number } {
  let [px, pz] = POLE.foot, sx = POLE.sx, sz = POLE.sz;
  if (mirror) px = sx - px;
  for (let t = 0; t < ((turns % 4) + 4) % 4; t++) { [px, pz] = [pz, sx - px]; [sx, sz] = [sz, sx]; }
  return { x: x + (sx / 2 - px) * POLE.scale, z: z + (sz / 2 - pz) * POLE.scale };
}

// ---------------------------------------------------------------------------------------------
// Guard rails along the kerbs, open at the crosswalks, the scramble and the taxi rank

/** Kerb runs that carry a guard rail: [avenue, low or high kerb, from, to] along voxels, inclusive. */
export function railRuns(): { av: Avenue; high: boolean; lo: number; hi: number }[] {
  const out: { av: Avenue; high: boolean; lo: number; hi: number }[] = [];
  for (const a of AVENUES) {
    const lo0 = a.ew ? a.x0 : a.z0, hi0 = a.ew ? a.x1 : a.z1;
    // gaps: every crosswalk (with a step either side), the trenches (they have their own parapets), Neon-dori's
    // stub north of the scramble (the taxi rank), and where a street joins from one side only
    const gaps: [number, number][] = CROSSWALKS.filter((c) => c.av === a).map((c) => [c.lo - 4, c.hi + 4]);
    for (const u of UNDERPASSES) if (u.av === a) gaps.push(u.dir > 0 ? [u.top - 2, hi0 + 20] : [lo0 - 20, u.top + 2]);
    if (a === NEON) gaps.push([lo0 - 20, HIKARI.z1 + 4]);
    for (const high of [false, true]) {
      let start = lo0;
      const sorted = gaps.slice().sort((p, q) => p[0] - q[0]);
      for (const [g0, g1] of sorted) {
        if (g0 - 1 >= start + 8) out.push({ av: a, high, lo: start, hi: g0 - 1 });
        start = Math.max(start, g1 + 1);
      }
      if (hi0 >= start + 8) out.push({ av: a, high, lo: start, hi: hi0 });
    }
  }
  return out;
}

export const AVENUE_BOUNDS = { XW, XE, ZS };
