// Shared world constants (metres unless noted).
export const V = 0.25; // coarse voxel size
export const VPM = 4; // voxels per metre
export const G = 12; // voxel layer of street level (world y = 0 at the top of layer G-1)
/**
 * The city is 216 x 168 m. Builder code works in voxel coordinates where voxel x sits at x * V metres;
 * the original district keeps 0..72 x 0..56 m and the city grows around it, so the world's first voxel
 * column is at (VX0, VZ0) = (-72 m, -56 m).
 */
export const VX0 = -288, VZ0 = -224;
export const SX = 864, SY = 160, SZ = 672;
export const WX0 = VX0 * V, WZ0 = VZ0 * V;
export const WX1 = (VX0 + SX) * V, WZ1 = (VZ0 + SZ) * V;
export const WORLD_W = SX * V, WORLD_D = SZ * V;
export const WATER_Y = -0.55;
export const CHUNK = 32; // voxel columns per chunk side
export const CHUNKS_X = SX / CHUNK, CHUNKS_Z = SZ / CHUNK;

// Interior diorama (hidden restaurant) lives far away from the street map.
export const INTERIOR_ORIGIN: [number, number, number] = [320, 0, 10];
export const ISX = 64, ISY = 40, ISZ = 48;

export interface StreetZone {
  id: string;
  name: string;
  jp: string;
  rect: [number, number, number, number]; // x0, z0, x1, z1 metres
}

export const ZONES: StreetZone[] = [
  { id: 'plaza', name: 'Temple Plaza', jp: '寺の広場', rect: [0, 5, 7.5, 19.5] },
  { id: 'kaminari', name: 'Kaminari Lane', jp: '雷通り', rect: [7, 8.5, 72, 16.5] },
  { id: 'yokocho', name: 'Lantern Alley', jp: '思い出横丁', rect: [33.5, 16, 38, 38.2] },
  { id: 'passage', name: 'Nameless Passage', jp: '名もなき路地', rect: [37.4, 29.4, 46, 31.6] },
  { id: 'canal', name: 'Sakura Canal', jp: '桜運河', rect: [WX0, 37.8, WX1, 50] },
  { id: 'farbank', name: 'Cherry Bank', jp: '桜並木', rect: [WX0, 49.8, WX1, 56] },
  { id: 'kakurega', name: 'Kakurega · Hidden Counter', jp: '隠れ家', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
];

/** Districts and streets registered by the city builder (see world/city.ts), checked after ZONES. */
export const CITY_ZONES: StreetZone[] = [];

export function zoneAt(x: number, z: number): StreetZone | null {
  // prefer the most specific (smallest) zone
  let best: StreetZone | null = null;
  let bestA = Infinity;
  for (const list of [ZONES, CITY_ZONES])
    for (const zn of list) {
      const [x0, z0, x1, z1] = zn.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
        const a = (x1 - x0) * (z1 - z0);
        if (a < bestA) { best = zn; bestA = a; }
      }
    }
  return best;
}
