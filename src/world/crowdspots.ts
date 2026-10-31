// Places in the city where the crowd does particular things, in metres. Everything here is derived from
// the layout constants in world/city.ts (never from the voxel grid), and the crowd checks each spot against
// the nav grid before using it, so a spot a later prop happens to cover is simply dropped.
import { STREETS } from './city';
import { V } from './layout';
import { AMALFI, ISTANBUL } from './cityId';
import { LIDOS, lidoUmbrellas, freeBeachTowels } from './amalfiPlan';

type V2 = [number, number];
/** A place to stand and the direction to face while there. */
export interface Spot { x: number; z: number; face: number }

export type StreetKind = 'avenue' | 'street' | 'lane' | 'alley' | 'arcade';

const N = Math.PI, S = 0, E = Math.PI / 2, W = -Math.PI / 2;

/** The kind of new-city street at (x, z), with its centre line and direction, or null in the old district. */
export function streetAt(x: number, z: number): { kind: StreetKind; ew: boolean; centre: number; half: number } | null {
  if (AMALFI || ISTANBUL) return null;
  for (const s of STREETS) {
    if (x < s.x0 * V || x > (s.x1 + 1) * V || z < s.z0 * V || z > (s.z1 + 1) * V) continue;
    const a = s.ew ? s.z0 : s.x0, b = (s.ew ? s.z1 : s.x1) + 1;
    return { kind: s.kind, ew: s.ew, centre: ((a + b) / 2) * V, half: ((b - a) / 2) * V };
  }
  return null;
}

/**
 * Sideways offset from a street's centre line for someone walking along it: on avenues the two
 * pavements, on pedestrian streets mostly the clear middle, in narrow lanes close to the middle.
 */
export function laneFor(kind: StreetKind | null, r: number): number {
  const side = r < 0.5 ? -1 : 1, u = (r * 2) % 1;
  switch (kind) {
    case 'avenue': return side * (3.0 + u * 0.7);
    case 'street': return u < 0.8 ? side * u * 1.7 : side * (3.0 + (u - 0.8) * 3);
    case 'arcade': return side * u * 2.6;
    default: return side * u * 0.6;
  }
}

/** Shop windows along the busy streets: stand 0.7 m off the facade and look in. */
function windows(): Spot[] {
  const out: Spot[] = [];
  const along = (x0: number, x1: number, z: number, face: number, step: number) => { for (let x = x0; x <= x1; x += step) out.push({ x, z, face }); };
  const down = (z0: number, z1: number, x: number, face: number, step: number) => { for (let z = z0; z <= z1; z += step) out.push({ x, z, face }); };
  down(67, 110, 32.7, W, 3); down(68.5, 110, 39.05, E, 3); // Hikari Ginza arcade
  along(84, 142, 9.7, N, 3.5); along(85.5, 142, 15.05, S, 3.5); // Center-gai
  along(-70, 142, 56.7, N, 4.5); along(-68, 142, 64.05, S, 4.5); // Minami-dori
  along(2, 70, -18.95, S, 4); // Hikari-dori's shops
  down(-16, 36, 112.7, W, 3); down(-15, 36, 115.05, E, 3); // Golden lane
  down(-46, 110, 81.05, E, 5); // Neon-dori's towers
  return out;
}

export interface CrowdSpots {
  /** In front of the Midori shrine hall, at the Inari summit and at the island shrine in the park. */
  pray: Spot[];
  /** The shrine's purification basin. */
  purify: Spot[];
  /** Ticket gates: stand in front, walk through, the platforms beyond. */
  gates: { front: V2; back: V2 }[];
  /** Meeting point on the station square: people wait, check phones, wave when their friend comes. */
  meet: Spot[];
  /** The sento's entrance and the step in front of it. */
  sento: { door: V2; front: V2 };
  windows: Spot[];
  /** Jogging loop around the park pond (closed ring). */
  jog: V2[];
  /** Candidate centres for the morning radio calisthenics on the park lawn. */
  exercise: V2[];
  /** Swan boats: the loop they pedal on the pond, its height and the jetty they leave from. */
  boats: { cx: number; cz: number; rx: number; rz: number; y: number; dock: V2 };
  /** Boats out at sea instead (Amalfi's gozzi): each runs its own ring of the bay from early morning to dusk. */
  sea?: { cx: number; cz: number; rx: number; rz: number; y: number };
  /**
   * A beach: sunbeds and towels to lie on (the middle, `face` the way the head points, `top` the height of what
   * you lie on above the sand, `at` a free spot beside it to read the sand's height) and water to swim in.
   */
  beach?: { beds: (Spot & { top: number; at: V2 })[]; swim: V2[]; seaY: number };
}

/** Amalfi: friends meet at the fountain in the piazza and joggers run the seafront and back. */
function amalfiSpots(): CrowdSpots {
  const meet: Spot[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 2.6 + (i % 3) * 0.9;
    meet.push({ x: 10 + Math.cos(a) * r, z: 12 + Math.sin(a) * r, face: Math.atan2(-Math.cos(a), -Math.sin(a)) + 0.6 });
  }
  const jog: V2[] = [];
  for (let z = -44; z <= 74; z += 6) jog.push([33.4, z]);
  for (let z = 74; z >= -44; z -= 6) jog.push([34.3, z]);
  // the lidos' sunbeds lie head to +z; the towels on the free beach either way along their length
  const beds: (Spot & { top: number; at: V2 })[] = [];
  for (const l of LIDOS) for (const [x, z] of lidoUmbrellas(l)) beds.push({ x: x + 1, z: z + 0.4, face: 0, top: 0.375, at: [x + 1, z + 2.2] });
  freeBeachTowels().forEach((t, i) => beds.push({ x: t.x, z: t.z, face: (t.alongX ? Math.PI / 2 : 0) + (i % 2 ? Math.PI : 0), top: 0.125, at: [t.x, t.z] }));
  // swimmers off the lidos, the shore runs along x = 50.25
  const swim: V2[] = [];
  for (let z = -27; z <= 28; z += 4.5) if (Math.abs(z - 9) > 4) swim.push([52 + ((z * 7.3) % 3 + 3) % 3, z]); // (not under the Molo)
  return {
    pray: [], purify: [], gates: [], meet,
    sento: { door: [1e4, 1e4], front: [1e4, 1e4] },
    windows: [], jog, exercise: [],
    boats: { cx: 1e4, cz: 1e4, rx: 1, rz: 1, y: -0.55, dock: [1e4, 1e4] },
    // the bay between the beach and the pier, kept clear of the swimmers and the moorings
    sea: { cx: 71, cz: -14, rx: 5, rz: 30, y: -0.55 }, // (clear of the Molo's round end at x 63)
    beach: { beds, swim, seaY: -0.55 },
  };
}

/**
 * Istanbul: the faithful pray before the New Mosque and the Süleymaniye, friends meet in the middle of Eminönü
 * square, joggers run the Bosphorus quay and fishing boats work the strait beyond the ferries.
 */
function istanbulSpots(): CrowdSpots {
  const pray: Spot[] = [];
  for (let x = 2.4; x <= 9.6; x += 0.8) pray.push({ x, z: 19.2, face: N });
  for (let x = -141; x <= -133; x += 0.8) pray.push({ x, z: -3.2, face: N });
  const meet: Spot[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 2.4 + (i % 3) * 0.9;
    meet.push({ x: 16 + Math.cos(a) * r, z: 36 + Math.sin(a) * r * 0.8, face: Math.atan2(-Math.cos(a), -Math.sin(a)) + 0.6 });
  }
  const jog: V2[] = [];
  for (let z = -104; z <= 30; z += 6) jog.push([25.2, z]);
  for (let z = 30; z >= -104; z -= 6) jog.push([26.4, z]);
  return {
    pray, purify: [], gates: [], meet,
    sento: { door: [1e4, 1e4], front: [1e4, 1e4] },
    windows: [], jog, exercise: [],
    boats: { cx: 1e4, cz: 1e4, rx: 1, rz: 1, y: -0.55, dock: [1e4, 1e4] },
    // the strait just off the ferry piers, inside the lanes the big ferries cross by
    sea: { cx: 74, cz: -33.5, rx: 8, rz: 16, y: -0.55 },
  };
}

export function crowdSpots(): CrowdSpots {
  if (AMALFI) return amalfiSpots();
  if (ISTANBUL) return istanbulSpots();
  const pray: Spot[] = [];
  for (let x = -41.3; x <= -38.8; x += 0.8) pray.push({ x, z: -38.3, face: N });
  pray.push({ x: -49.4, z: 95.85, face: S }, { x: -48.6, z: 95.85, face: S });
  pray.push({ x: 118.6, z: 89.3, face: N });
  const purify: Spot[] = [{ x: -35.6, z: -33.85, face: N }, { x: -34.6, z: -33.85, face: N }, { x: -36.7, z: -35.2, face: E }];
  const gates: { front: V2; back: V2 }[] = [];
  for (let x = 110; x <= 170; x += 6) gates.push({ front: [(x + 4) * V, -41.7], back: [(x + 4) * V, -44.9] });
  const meet: Spot[] = [];
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, r = 2.6 + (i % 3) * 1.1;
    meet.push({ x: 29 + Math.cos(a) * r, z: -33 + Math.sin(a) * r * 0.7, face: Math.atan2(-Math.cos(a), -Math.sin(a)) + 0.6 });
  }
  const jog: V2[] = [];
  for (let i = 0; i < 22; i++) { const a = (i / 22) * Math.PI * 2; jog.push([113 + Math.cos(a) * 19.4, 89 + Math.sin(a) * 12.25]); }
  return {
    pray, purify, gates, meet,
    sento: { door: [-26.9, 15.35], front: [-26.9, 16.6] },
    windows: windows(),
    jog,
    exercise: [[88.5, 72.5], [133, 72], [89, 104], [136, 104.5], [100, 70]],
    boats: { cx: 105.2, cz: 89, rx: 5.6, rz: 5.2, y: -0.55, dock: [106, 96.6] },
  };
}
