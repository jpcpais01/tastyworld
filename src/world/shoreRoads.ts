// The roads of the cities other than Tokyo, as the cars, the crowd and the builders see them. Each is one straight
// two-way carriageway running north-south (along z) through the map: Funchal's Avenida do Mar between the old town
// and the sea, Amalfi's coast road along the beach and into the headland's tunnel, and in Istanbul the T1 tram's
// double track down the avenue through Sirkeci. Traffic keeps right. Plain geometry from constants, like
// world/roads.ts, so the builders, the path workers and the game agree without reading the grid.
import { V, VX0, VZ0, SX, SZ, G } from './layout';
import { CITY } from './cityId';
import type { Avenue, Crosswalk } from './roads';
import { ROAD_Y as MADEIRA_ROAD_Y, farRoadX as madeiraFarX, ribZ, FOOTWAY_X, BRIDGE_HALF } from './madeiraPlan';
import { farRoadX as amalfiFarX, TUNNEL_Z } from './amalfiPlan';
import { istanbulPlan, col as istanbulCol } from './istanbulPlan';

export interface ShoreRoad {
  /** The carriageway (inclusive voxel columns x0..x1) over the rows z0..z1 it runs through the map. */
  av: Avenue;
  /** Centre line and half width of the carriageway (m), and each lane's centre off the centre line. */
  cx: number;
  half: number;
  lane: number;
  /** Where the cars come in and leave (z, m): past both ends of the map, out of sight. */
  zS: number;
  zN: number;
  crossings: Crosswalk[];
  /** The road is under rock south of this z (m): Amalfi's tunnel through the headland. */
  tunnelZ: number;
  /** Istanbul: rails, not a road. One tram on each track, out and back. */
  tram: boolean;
  /** How far past the kerbs (m) a driver watches a zebra for people about to step out. */
  kerbM: number;
  /** A footway over a bridge, off the carriageway: x < x1 for z0 < z < z1 (Funchal's ribeira; none elsewhere). */
  footway: { x1: number; z0: number; z1: number } | null;
  /** Where the buses (or the tram) stop for their passengers: z of the stop (m) for each direction. */
  stopsS: number[];
  stopsN: number[];
}

const ZW = VZ0 * V, ZE = (VZ0 + SZ) * V;

/** A crossing over the shore road between z0 and z1 (m), with its own light or a plain zebra where cars give way. */
function crossing(av: Avenue, id: number, z0: number, z1: number, signal: boolean, offset = 0): Crosswalk {
  return { id, av, lo: Math.round(z0 / V), hi: Math.round(z1 / V) - 1, phase: 'mid', offset, signal, scramble: false };
}

function avenue(name: string, cx: number, half: number, z0: number, z1: number): Avenue {
  return { name, ew: false, x0: Math.round((cx - half) / V), x1: Math.round((cx + half) / V) - 1, z0: Math.round(z0 / V), z1: Math.round(z1 / V) - 1 };
}

function madeira(): ShoreRoad {
  const av = avenue('Avenida do Mar', 31, 3.75, ZW, ZE);
  const rz = ribZ(31);
  // at the foot of every street down to the sea: lights by the Largo and the Jardim, zebras at the rest
  const at: [number, boolean, number][] = [[-60, false, 0], [-27, true, 0], [rz, false, 0], [30, false, 0], [40, true, 14], [66, false, 0], [76, false, 0]];
  return {
    av, cx: 31, half: 3.75, lane: 1.8, zS: ZW - 46, zN: ZE + 46, tunnelZ: -Infinity, tram: false, kerbM: 0.5,
    footway: { x1: FOOTWAY_X, z0: rz - BRIDGE_HALF, z1: rz + BRIDGE_HALF },
    crossings: at.map(([z, sig, off], i) => crossing(av, i, z - 2, z + 2, sig, off)),
    // the bus stops of the Horários do Funchal, one each way, on the straight between the Largo and the ribeira
    stopsS: [8], stopsN: [-8],
  };
}

function amalfi(): ShoreRoad {
  const av = avenue('Statale Amalfitana', 31, 2.75, ZW, ZE);
  // a zebra from the sea gate down to the beach, and one at the harbour
  const at = [9, 40];
  return {
    av, cx: 31, half: 2.75, lane: 1.4, zS: ZW - 34, zN: ZE + 46, tunnelZ: TUNNEL_Z, tram: false, kerbM: 0.5, footway: null,
    crossings: at.map((z, i) => crossing(av, i, z - 2, z + 2, false)),
    // the blue SITA buses stop on the seafront by the piazza, where the whole coast changes buses
    stopsS: [24], stopsN: [-2],
  };
}

/** The tram's range on the avenue (m, where its nose stops): the terminus by Eminönü, and the roadworks' end. */
export const TRAM_N = -4, TRAM_S = -101;

function istanbul(): ShoreRoad {
  // the track bed: two tracks a metre and a half either side of x = 12, and room for a tram's sides
  const av = avenue('Tram avenue', 12, 2.9, -104, -2);
  // people cross the tracks every few steps, where the setts are worn smooth, when no tram is coming; the platforms
  // of the Sirkeci stop have crossings at both ends and in the middle
  const crossings = [-98, -88, -79, -70, -60, -50, -44, -30, -16, -9, -3.5].map((z, i) => crossing(av, i, z - 1.5, Math.min(-2, z + 1.5), false));
  return {
    av, cx: 12, half: 2.9, lane: 1.5, zS: TRAM_S, zN: TRAM_N, tunnelZ: -Infinity, tram: true, kerbM: 0, footway: null, crossings,
    stopsS: [-30], stopsN: [-30],
  };
}

let road: ShoreRoad | null | undefined;
/** This city's shore road (null in Tokyo, whose avenues are world/roads.ts). */
export function shoreRoad(): ShoreRoad | null {
  if (road === undefined) road = CITY === 'madeira' ? madeira() : CITY === 'amalfi' ? amalfi() : CITY === 'istanbul' ? istanbul() : null;
  return road;
}

// ---------------------------------------------------------------------------------------------
// Queries in metres

const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

/** On the carriageway (between the kerbs, in the map). */
export function shoreOn(r: ShoreRoad, x: number, z: number): boolean {
  const a = r.av, f = r.footway;
  if (f && x < f.x1 && z > f.z0 && z < f.z1) return false;
  return x >= a.x0 * V && x < (a.x1 + 1) * V && z >= a.z0 * V && z < (a.z1 + 1) * V;
}

/** The crossing whose zebra (with `spare` metres either side) holds (x, z), if (x, z) is on or by the carriageway. */
export function shoreCrossing(r: ShoreRoad, x: number, z: number, spare: number): Crosswalk | null {
  const a = r.av;
  if (x < (a.x0 - 1) * V || x >= (a.x1 + 2) * V) return null;
  for (const c of r.crossings) if (z >= c.lo * V - spare && z < (c.hi + 1) * V + spare) return c;
  return null;
}

/** Istanbul's avenue climbs a little: the setts' height down the middle (m), smoothed over the quarter-metre steps. */
let tramY: Float32Array | null = null;
function istanbulY(z: number): number {
  if (!tramY) {
    const p = istanbulPlan();
    tramY = new Float32Array(SZ);
    const x = Math.floor(12 / V);
    for (let i = 0; i < SZ; i++) tramY[i] = (p.walk[istanbulCol(x, VZ0 + i)] - G) * V;
  }
  // average over four metres, so a car glides up the steps
  const i0 = Math.floor(z / V) - VZ0;
  let s = 0, n = 0;
  for (let i = i0 - 8; i <= i0 + 8; i++) { s += tramY[clamp(i, 0, SZ - 1)]; n++; }
  return s / n;
}

/** Height of the road surface (world metres) under a car at (x, z): in the map, and out along the road beyond it. */
export function shoreY(r: ShoreRoad, _x: number, z: number): number {
  if (r.tram) return istanbulY(z);
  const yMap = CITY === 'madeira' ? MADEIRA_ROAD_Y : 2.0;
  // out of the map the far ground carries the road on, a little lower and climbing in half-metre blocks; the cars
  // ease down onto it over the first few metres (the tunnel runs on level under the headland)
  const out = z < ZW ? (r.tunnelZ > -Infinity ? 0 : ZW - z) : Math.max(0, z - ZE);
  if (out <= 0) return yMap;
  const far = 1.6 + out * (CITY === 'amalfi' ? 0.12 : 0.05) - 0.2;
  return yMap + (far - yMap) * clamp(out / 10, 0, 1);
}

/** The centre line of the road at z (x, m): straight through the map, bending away with the coast beyond it. */
export function shoreX(r: ShoreRoad, z: number): number {
  if (r.tram || (z >= ZW && z <= ZE) || (z < ZW && r.tunnelZ > -Infinity)) return r.cx;
  const far = CITY === 'madeira' ? madeiraFarX(z) : amalfiFarX(z);
  const edge = z < ZW ? ZW : ZE;
  // the far road leaves the map down the middle of the shore road: ease from one to the other
  return r.cx + (far - r.cx) * clamp(Math.abs(z - edge) / 12, 0, 1);
}

/** Daylight reaching a car at (x, z): dark in Amalfi's tunnel, dimmer near its mouth. */
export function shoreShade(r: ShoreRoad, _x: number, z: number): number {
  if (z >= r.tunnelZ + 2) return 1;
  return clamp(0.55 - (r.tunnelZ + 2 - z) * 0.12, 0.04, 0.55);
}

// ---------------------------------------------------------------------------------------------
// Signal poles at the crossings with lights: a pole for each direction on its own kerb (traffic keeps right),
// after the crossing, its arm out over the lane and its lamps facing the oncoming cars. Keeping right puts the arm
// on the other side of the pole from Tokyo's, so these are the mirrored pole (props.signalPole(k, true)).

export interface ShorePole {
  /** Footprint centre (metres) and quarter turns of the mirrored signalPole prop, and the ground it stands on. */
  x: number; z: number; y: number; turns: number;
  /** Where the pole itself stands (metres). */
  fx: number; fz: number;
  cross: number;
}

export function shorePoles(r: ShoreRoad, footCentre: (x: number, z: number, turns: number) => { x: number; z: number }, ground: (x: number, z: number) => number): ShorePole[] {
  const out: ShorePole[] = [];
  for (const c of r.crossings) {
    if (!c.signal) continue;
    for (const dir of [1, -1] as const) {
      // going +z keeps to the low-x kerb, its pole past the crossing; going -z the high-x kerb
      const along = dir > 0 ? c.hi + 3 : c.lo - 3;
      const ax = dir > 0 ? r.av.x0 - 2 : r.av.x1 + 2;
      const fx = (ax + 0.5) * V, fz = (along + 0.5) * V;
      // the mirrored prop's arm runs along -X at turns 0, its lamps facing +Z: right for traffic going -z
      const turns = dir > 0 ? 2 : 0;
      out.push({ ...footCentre(fx, fz, turns), fx, fz, y: ground(fx, fz), turns, cross: c.id });
    }
  }
  return out;
}

/**
 * Road markings at (x, z) (m, a voxel's centre): the zebras' white bars, the stop lines before the lights and the
 * dashed centre line. The tram's setts have none.
 */
export function shoreMark(r: ShoreRoad, x: number, z: number): boolean {
  if (r.tram || !shoreOn(r, x, z)) return false;
  const a = r.av, u = Math.floor(z / V);
  for (const c of r.crossings) {
    // bars half a metre wide, parallel to the traffic, a kerb's width clear of each side
    if (u >= c.lo && u <= c.hi) return x > a.x0 * V + 0.25 && x < (a.x1 + 1) * V - 0.25 && Math.floor((x - a.x0 * V - 0.25) / 0.5) % 2 === 0;
    if (c.signal && ((u >= c.lo - 4 && u <= c.lo - 3 && x < r.cx - 0.1) || (u >= c.hi + 3 && u <= c.hi + 4 && x > r.cx + 0.1))) return true;
    if (u >= c.lo - 6 && u <= c.hi + 6) return false;
  }
  return Math.abs(x - r.cx) < 0.13 && ((z % 6) + 6) % 6 < 3;
}

/**
 * Where a walking-graph node standing on the carriageway goes instead: onto the pavement beside it (Funchal's town
 * side, Amalfi's sea side, the avenue's west side in Istanbul), and out of Amalfi's tunnel to its mouth.
 */
export function offRoad(x: number, z: number): [number, number] {
  const r = shoreRoad();
  if (!r) return [x, z];
  const a = r.av;
  if (x < (a.x0 - 1) * V || x >= (a.x1 + 2) * V || z < a.z0 * V || z >= (a.z1 + 1) * V) return [x, z];
  const zz = z < r.tunnelZ + 3 ? r.tunnelZ + 3 : z, f = r.footway;
  if (f && z > f.z0 && z < f.z1) return [(a.x0 * V + f.x1) / 2, z];
  return [CITY === 'amalfi' ? (a.x1 + 1) * V + 1.1 : a.x0 * V - (CITY === 'istanbul' ? 1.1 : 0.85), zz];
}

/** World extent of the map along z (m), for the far-road ends. */
export const SHORE_MAP = { ZW, ZE, XW: VX0 * V, XE: (VX0 + SX) * V };
