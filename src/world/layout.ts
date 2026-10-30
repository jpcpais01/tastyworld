// Shared world constants (metres unless noted).
export const V = 0.25; // coarse voxel size
export const VPM = 4; // voxels per metre
export const G = 12; // voxel layer of street level (world y = 0 at the top of layer G-1)
export const SX = 288, SY = 76, SZ = 224;
export const WORLD_W = SX * V, WORLD_D = SZ * V;
export const WATER_Y = -0.55;
export const CHUNK = 32; // voxel columns per chunk side

// Interior diorama (hidden restaurant) lives far away from the street map.
export const INTERIOR_ORIGIN: [number, number, number] = [140, 0, 10];
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
  { id: 'canal', name: 'Sakura Canal', jp: '桜運河', rect: [0, 37.8, 72, 50] },
  { id: 'farbank', name: 'Cherry Bank', jp: '桜並木', rect: [0, 49.8, 72, 56] },
  { id: 'kakurega', name: 'Kakurega · Hidden Counter', jp: '隠れ家', rect: [130, 0, 170, 30] },
];

export function zoneAt(x: number, z: number): StreetZone | null {
  // prefer the most specific (smallest) zone
  let best: StreetZone | null = null;
  let bestA = Infinity;
  for (const zn of ZONES) {
    const [x0, z0, x1, z1] = zn.rect;
    if (x >= x0 && x <= x1 && z >= z0 && z <= z1) {
      const a = (x1 - x0) * (z1 - z0);
      if (a < bestA) { best = zn; bestA = a; }
    }
  }
  return best;
}
