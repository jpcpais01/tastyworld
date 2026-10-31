// Shared world constants (metres unless noted).
import { AMALFI } from './cityId';

export const V = 0.25; // coarse voxel size
export const VPM = 4; // voxels per metre
export const G = 12; // voxel layer of street level (world y = 0 at the top of layer G-1)
/**
 * The city is 216 x 168 m. Builder code works in voxel coordinates where voxel x sits at x * V metres;
 * the original district keeps 0..72 x 0..56 m and the city grows around it, so the world's first voxel
 * column is at (VX0, VZ0) = (-72 m, -56 m).
 */
export const VX0 = AMALFI ? -448 : -288, VZ0 = AMALFI ? -320 : -224;
/** Amalfi climbs from the sea up its cliffs, so its world is taller: 56 m of voxels against Tokyo's 40. */
export const SX = AMALFI ? 768 : 864, SY = AMALFI ? 224 : 160, SZ = AMALFI ? 640 : 672;
export const WX0 = VX0 * V, WZ0 = VZ0 * V;
export const WX1 = (VX0 + SX) * V, WZ1 = (VZ0 + SZ) * V;
export const WORLD_W = SX * V, WORLD_D = SZ * V;
export const WATER_Y = -0.55;
/** The Inari hill (inclusive voxel rect): the only ground above street level people walk on. */
export const HILL: [number, number, number, number] = AMALFI ? [0, 0, -1, -1] : [-288, 260, -41, 447];
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

const TOKYO_ZONES: StreetZone[] = [
  { id: 'plaza', name: 'Temple Plaza', jp: '寺の広場', rect: [0, 5, 7.5, 19.5] },
  { id: 'kaminari', name: 'Kaminari Lane', jp: '雷通り', rect: [7, 8.5, 72, 16.5] },
  { id: 'yokocho', name: 'Lantern Alley', jp: '思い出横丁', rect: [33.5, 16, 38, 38.2] },
  { id: 'passage', name: 'Nameless Passage', jp: '名もなき路地', rect: [37.4, 29.4, 46, 31.6] },
  { id: 'canal', name: 'Sakura Canal', jp: '桜運河', rect: [WX0, 37.8, WX1, 50] },
  { id: 'farbank', name: 'Cherry Bank', jp: '桜並木', rect: [WX0, 49.8, WX1, 56] },
  { id: 'hikari', name: 'Hikari-dori', jp: '光通り', rect: [-72, -28, 144, -18.25] },
  { id: 'ekimae', name: 'Station Square', jp: '駅前広場', rect: [0, -39, 72, -28] },
  { id: 'station', name: 'Hikari-machi Station', jp: '光町駅', rect: [20, -46, 52, -39] },
  { id: 'midori', name: 'Midori Shrine', jp: '緑神社', rect: [-72, -46, 0, -28] },
  { id: 'gado', name: 'Under the Tracks', jp: 'ガード下', rect: [-72, -56, 144, -46] },
  { id: 'uramichi', name: 'Ura-michi', jp: '裏道', rect: [0, -6.25, 72, 0] },
  { id: 'neon', name: 'Neon-dori', jp: 'ネオン通り', rect: [72, -50, 82, 112] },
  { id: 'center', name: 'Center-gai', jp: 'センター街', rect: [82, 9, 144, 16] },
  { id: 'golden', name: 'Golden Lane', jp: 'ゴールデン横丁', rect: [106, -18, 122, 38] },
  { id: 'nishi', name: 'Nishi-dori', jp: '西通り', rect: [-10, -28, 0, 112] },
  { id: 'yanaka', name: 'Yanaka Lanes', jp: '谷中', rect: [-72, -18, -10, 38] },
  { id: 'minami', name: 'Minami-dori', jp: '南通り', rect: [-72, 56, 144, 65] },
  { id: 'ginza', name: 'Hikari Ginza Arcade', jp: '光銀座商店街', rect: [20, 65, 52, 112] },
  { id: 'park', name: 'Hikari Park', jp: '光公園', rect: [82, 65, 144, 112] },
  { id: 'inari', name: 'Inari Hill', jp: '稲荷山', rect: [-72, 65, -10, 112] },
  { id: 'kakurega', name: 'Kakurega · Hidden Counter', jp: '隠れ家', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
];

/** Amalfi's quarters, streets and stairways (see world/amalfi.ts); `jp` holds the Italian name. */
const AMALFI_ZONES: StreetZone[] = [
  // the shore, from the beach round to the harbour and the headland
  { id: 'marina', name: 'Marina Grande', jp: 'la spiaggia', rect: [36, -16, 60, 39] },
  { id: 'molo', name: 'The Harbour', jp: 'il porto', rect: [36, 39, 88, 80] },
  { id: 'lungomare', name: 'Lungomare dei Cavalieri', jp: 'la marina', rect: [27, -52, 36, 80] },
  { id: 'galleria', name: 'Coast Road Tunnel', jp: 'la galleria', rect: [24, -80, 38, -52] },
  { id: 'capo', name: 'Capo di Atrani', jp: 'il capo', rect: [-40, -80, 24, -40] },
  // the old town round the cathedral
  { id: 'porta', name: 'Porta della Marina', jp: 'la porta', rect: [17, 3, 27, 15] },
  { id: 'piazza', name: 'Piazza Duomo', jp: 'la piazza', rect: [-4, -7, 21, 30] },
  { id: 'scalinata', name: 'The Duomo Steps', jp: 'la scalinata', rect: [-20, 8, -4, 20] },
  { id: 'duomo', name: "Sant'Andrea Cathedral", jp: 'il Duomo', rect: [-60, 3, -20, 27] },
  { id: 'chiostro', name: 'Cloister of Paradise', jp: 'il chiostro', rect: [-47, 28, -31, 44] },
  { id: 'ruga', name: 'Ruga dei Mercanti', jp: 'la ruga', rect: [-47, -1, -4, 3] },
  // up the valley
  { id: 'lorenzo', name: "Via Lorenzo d'Amalfi", jp: 'la via', rect: [-112, -14, -4, -1] },
  { id: 'dogi', name: 'Piazza dei Dogi', jp: 'i Dogi', rect: [-69, -16, -51, 0] },
  // the two flanks of the valley
  { id: 'ponente', name: 'Vicoli di Ponente', jp: 'i vicoli', rect: [-112, 3, 27, 80] },
  { id: 'mulini', name: 'Salita dei Mulini', jp: 'la salita', rect: [-112, -80, 24, -14] },
  { id: 'limoni', name: 'The Lemon Terraces', jp: 'i limoneti', rect: [-112, 44, -40, 80] },
  { id: 'limoni2', name: 'The Lemon Terraces', jp: 'i limoneti', rect: [-112, -80, -60, -40] },
  { id: 'grotta', name: 'La Grotta · Hidden Kitchen', jp: 'la grotta', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
];

export const ZONES: StreetZone[] = AMALFI ? AMALFI_ZONES : TOKYO_ZONES;

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
