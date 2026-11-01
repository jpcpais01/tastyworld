import { V } from '../world/layout';
import { CITY } from '../world/cityId';
import { shoreRoad, shoreX, type ShoreRoad } from '../world/shoreRoads';
import type { CarKind } from '../world/cars';
import type { Anchors } from '../world/tokyo';
import { Builder, cityDensity, crossingZone, dropQueuedLines, pick, type LensPole, type Network, type Path, type StopPlane } from './traffic';

/**
 * The traffic on another city's shore road (world/shoreRoads.ts): cars in from both ends, keeping right, stopping
 * at the lights and giving way at the zebras, the town's buses calling at their stops. In Funchal they come round
 * the bay along the coast road and leave the same way; on the Amalfi coast they come out of the headland's tunnel
 * at one end and round the bend from Conca dei Marini at the other. In Istanbul the road is the T1's double track:
 * two trams run up and down the avenue, calling at Sirkeci, and run back the other way at each end of the line.
 */
export function shoreNet(signals: Anchors['signals'] = []): Network {
  const r = shoreRoad();
  if (!r) return quietNet();
  // the lenses go where the builder put up the poles (world/funchal.ts): mirrored poles, for keeping right
  const poles: LensPole[] = (signals ?? []).map((p) => ({ ...p, phase: 'mid', mirror: true }));
  return r.tram ? tramNet(r) : roadNet(r, poles);
}

/** A city with no road traffic of its own yet (Halcyon's streets belong to the crowd). */
function quietNet(): Network {
  return {
    max: { desktop: 0, mobile: 0 }, crossings: [], routes: () => ({}), planes: () => [], poles: () => [], arms: [],
    every: () => 1e9, next: () => null, populate: () => {}, density: () => 1, kerbM: 0, pace: 1, margin: 0, rank: false,
  };
}

/**
 * Lane centre (x) at z for traffic heading +z (`up`) or -z: keeping right, +z keeps to the low-x side. Over a bridge
 * with a footway on that side the lane eases over, so that a bus keeps clear of the people on it.
 */
const laneX = (r: ShoreRoad, z: number, up: boolean) => {
  const x = shoreX(r, z) + (up ? -r.lane : r.lane), f = r.footway;
  if (!up || !f) return x;
  const want = f.x1 + 0.4 + 1.3, d = Math.max(f.z0 - z, z - f.z1, 0);
  const t = Math.min(1, Math.max(0, 1 - (d - 2) / 6));
  return x + Math.max(0, want - x) * t * t * (3 - 2 * t);
};

/** Stop lines for every crossing, both ways. */
function planes(r: ShoreRoad): StopPlane[] {
  const out: StopPlane[] = [];
  for (const c of r.crossings) {
    const box = crossingZone(c, r.crossings);
    out.push({ av: r.av, at: (c.lo - 5) * V, dir: 1, cross: c, phase: 'mid', box });
    out.push({ av: r.av, at: (c.hi + 6) * V, dir: -1, cross: c, phase: 'mid', box });
  }
  return dropQueuedLines(out, r.crossings);
}

/** The way through from one end to the other, following the road round the bends beyond the map; buses' stops on it. */
function through(r: ShoreRoad, up: boolean, stops: number[]): Path {
  const b = new Builder();
  const z0 = up ? r.zS : r.zN, z1 = up ? r.zN : r.zS, dir = up ? 1 : -1;
  b.start(laneX(r, z0, up), z0, 0, dir);
  const halts = stops.slice().sort((p, q) => (p - q) * dir);
  let h = 0;
  for (let z = z0 + dir * 2; (z1 - z) * dir > -1e-6; z += dir * 2) {
    // a stop exactly where the centre of the bus should stand
    while (h < halts.length && (halts[h] - z) * dir < 0) { b.to(laneX(r, halts[h], up), halts[h]).halt(); h++; }
    b.to(laneX(r, z, up), z);
  }
  return b.done();
}

function roadNet(r: ShoreRoad, poles: LensPole[]): Network {
  const madeira = CITY === 'madeira';
  const kinds = (hour: number): [CarKind, number][] => {
    const day = hour >= 7 && hour < 20, late = hour < 6 || hour >= 22;
    return madeira
      ? [['hatch', 0.34], ['kei', 0.12], ['sedan', 0.12], ['taxi', late ? 0.3 : 0.14], ['minivan', 0.1], ['van', day ? 0.1 : 0.02], ['bus', day ? 0.07 : 0.02]]
      : [['kei', 0.3], ['hatch', 0.22], ['sedan', 0.07], ['taxi', 0.06], ['minivan', 0.1], ['van', day ? 0.08 : 0.02], ['truck', day ? 0.07 : 0.01], ['bus', day ? 0.08 : 0.02]];
  };
  // the buses run from early morning to late evening; through the night only cars
  const make = (hour: number): CarKind => {
    const k = pick(kinds(hour));
    return k === 'bus' && (hour < 6 || hour > 23) ? 'hatch' : k;
  };
  return {
    max: madeira ? { desktop: 26, mobile: 16 } : { desktop: 18, mobile: 12 },
    crossings: r.crossings,
    routes: () => ({ UP: through(r, true, r.stopsN), DOWN: through(r, false, r.stopsS) }),
    planes: () => planes(r),
    poles: () => poles,
    arms: ['S', 'N'],
    // the coast road is quieter than Funchal's avenue
    every: () => (madeira ? 9 : 13),
    next: (arm, hour) => ({ route: arm === 'S' ? 'UP' : 'DOWN', kind: make(hour) }),
    populate: (t, hour) => t.scatter(['UP', 'DOWN'], Math.round((madeira ? 26 : 18) * 0.5 * cityDensity(hour)), () => make(hour)),
    density: cityDensity,
    kerbM: r.kerbM,
    // narrow Amalfi takes it slowly
    pace: madeira ? 1 : 0.8,
    margin: 0.5,
    rank: false,
  };
}

function tramNet(r: ShoreRoad): Network {
  // each tram's centre stands half its length back from the end of the line
  const HALF = 14;
  const nS = r.zS + HALF, nN = r.zN - HALF;
  // each tram works its own track, up to the end of the line and back, calling at Sirkeci both ways; its two ends
  // are alike, so at each end it simply sets off back the way it came (no crossover for a long rigid car to swing
  // its ends out over the pavements)
  const routes = (): Record<string, Path> => {
    const out: Record<string, Path> = {};
    for (const [name, x] of [['A', r.cx - r.lane], ['B', r.cx + r.lane]] as [string, number][]) {
      out[`${name}U`] = new Builder().start(x, nS, 0, 1).halt().toZ(r.stopsN[0]).halt().toZ(nN).done(false, `${name}D`);
      out[`${name}D`] = new Builder().start(x, nN, 0, -1).halt().toZ(r.stopsS[0]).halt().toZ(nS).done(false, `${name}U`);
    }
    return out;
  };
  return {
    max: { desktop: 2, mobile: 2 },
    crossings: r.crossings,
    routes,
    planes: () => planes(r),
    poles: () => [],
    arms: [],
    every: () => 1,
    next: () => null,
    // one tram at each end of the line, setting off together
    populate: (t) => { t.addCar('AU', 'tram', 0); t.addCar('BD', 'tram', 0); },
    density: () => 1,
    kerbM: r.kerbM,
    pace: 0.62,
    // the tram keeps to its rails: only those on them (or right by them) hold it up
    margin: 0.2,
    rank: false,
  };
}
