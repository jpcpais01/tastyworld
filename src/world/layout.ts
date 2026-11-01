// Shared world constants (metres unless noted).
import { AMALFI, ISTANBUL, MADEIRA, NEO } from './cityId';

export const V = 0.25; // coarse voxel size
export const VPM = 4; // voxels per metre
export const G = 12; // voxel layer of street level (world y = 0 at the top of layer G-1)
/**
 * The city is 216 x 168 m. Builder code works in voxel coordinates where voxel x sits at x * V metres;
 * the original district keeps 0..72 x 0..56 m and the city grows around it, so the world's first voxel
 * column is at (VX0, VZ0) = (-72 m, -56 m).
 */
/** Halcyon City (2040) is twice Tokyo's side: 432 x 336 m, centred on the Halo crossing. */
export const VX0 = NEO ? -864 : AMALFI || MADEIRA ? -448 : ISTANBUL ? -640 : -288, VZ0 = NEO ? -672 : AMALFI ? -320 : MADEIRA ? -352 : ISTANBUL ? -448 : -224;
/** Amalfi climbs from the sea up its cliffs, so its world is taller: 56 m of voxels against Tokyo's 40. */
/** Istanbul rolls over its hills more gently: 48 m of voxels, room for the minarets on the hilltop. */
export const SX = NEO ? 1728 : AMALFI || MADEIRA ? 768 : ISTANBUL ? 832 : 864, SY = AMALFI || MADEIRA ? 224 : ISTANBUL || NEO ? 192 : 160, SZ = NEO ? 1344 : AMALFI ? 640 : MADEIRA ? 704 : ISTANBUL ? 704 : 672;
export const WX0 = VX0 * V, WZ0 = VZ0 * V;
export const WX1 = (VX0 + SX) * V, WZ1 = (VZ0 + SZ) * V;
export const WORLD_W = SX * V, WORLD_D = SZ * V;
export const WATER_Y = -0.55;
/** The Inari hill (inclusive voxel rect): the only ground above street level people walk on. */
export const HILL: [number, number, number, number] = AMALFI || ISTANBUL || MADEIRA || NEO ? [0, 0, -1, -1] : [-288, 260, -41, 447];
export const CHUNK = 32; // voxel columns per chunk side
export const CHUNKS_X = SX / CHUNK, CHUNKS_Z = SZ / CHUNK;

// Interior diorama (hidden restaurant) lives far away from the street map.
export const INTERIOR_ORIGIN: [number, number, number] = NEO ? [600, 0, 10] : [320, 0, 10];
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

/** Halcyon City's districts (see world/neo.ts); `jp` holds the street-sign name. */
const NEO_ZONES: StreetZone[] = [
  { id: 'halo', name: 'Halo Crossing', jp: 'HALO ✕', rect: [-20, -20, 20, 20] },
  { id: 'meridian', name: 'Meridian Boulevard', jp: 'MERIDIAN BLVD', rect: [-216, -8, 216, 8] },
  { id: 'spindle', name: 'Spindle Avenue', jp: 'SPINDLE AVE', rect: [-8, -168, 8, 168] },
  { id: 'lantern', name: 'Lantern Market', jp: '燈市 LANTERN MKT', rect: [-216, -168, -8, -8] },
  { id: 'spire', name: 'The Spire District', jp: 'SPIRE DISTRICT', rect: [8, -168, 116, -8] },
  { id: 'stacks', name: 'The Stacks', jp: 'STACKS 層', rect: [-216, 8, -8, 168] },
  { id: 'neonmile', name: 'Neon Mile', jp: 'NEON MILE', rect: [8, 8, 116, 168] },
  { id: 'canal', name: 'Black Canal', jp: '黒運河', rect: [116, -168, 132, 168] },
  { id: 'docks', name: 'Rust Docks', jp: 'RUST DOCKS', rect: [132, -168, 216, 168] },
  { id: 'greenhouse', name: 'The Greenhouse · Hidden Table', jp: 'greenhouse', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
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

/** Istanbul's quarters round Eminönü (see world/istanbul.ts); `jp` holds the Turkish name. */
const ISTANBUL_ZONES: StreetZone[] = [
  { id: 'eminonu', name: 'Eminönü', jp: 'Tarihi Yarımada', rect: [-160, -112, 48, 64] },
  { id: 'kopru', name: 'Galata Bridge', jp: 'Galata Köprüsü', rect: [-23, 44, -13, 64] },
  { id: 'halic', name: 'Golden Horn Quay', jp: 'Haliç', rect: [-160, 36, 26, 44] },
  { id: 'kucukpazar', name: 'Küçükpazar', jp: 'Küçükpazar', rect: [-160, 22, -96, 36] },
  { id: 'meydan', name: 'Eminönü Square', jp: 'Eminönü Meydanı', rect: [-12, 30, 26, 44] },
  { id: 'yeni', name: 'The New Mosque', jp: 'Yeni Cami', rect: [-4, 2, 16, 30] },
  { id: 'bogaz', name: 'Bosphorus Quay', jp: 'Boğaz', rect: [22, -112, 30, 30] },
  { id: 'kadikoy', name: 'Kadıköy Ferry Pier', jp: 'Kadıköy İskelesi', rect: [30, -8, 48, 4] },
  { id: 'uskudar', name: 'Üsküdar Ferry Pier', jp: 'Üsküdar İskelesi', rect: [30, -52, 48, -40] },
  { id: 'halicpier', name: 'Golden Horn Ferry Pier', jp: 'Haliç İskelesi', rect: [-58, 44, -46, 64] },
  { id: 'misir', name: 'The Spice Bazaar', jp: 'Mısır Çarşısı', rect: [-64, 20, -8, 30] },
  { id: 'hamidiye', name: 'Hamidiye Street', jp: 'Hamidiye Caddesi', rect: [-32, -21, 20, -13] },
  { id: 'sirkeci', name: 'Sirkeci Tram Avenue', jp: 'Sirkeci', rect: [8, -112, 16, -2] },
  { id: 'gar', name: 'Sirkeci Station', jp: 'Sirkeci Garı', rect: [15, -58, 23, -36] },
  { id: 'uzuncarsi', name: 'Uzunçarşı', jp: 'Uzun Çarşı', rect: [-96, -46, -30, -18] },
  { id: 'kapali', name: 'The Grand Bazaar', jp: 'Kapalıçarşı', rect: [-152, -100, -102, -42] },
  { id: 'suleymaniye', name: 'Süleymaniye Mosque', jp: 'Süleymaniye Camii', rect: [-158, -34, -114, 12] },
  { id: 'teras', name: 'Süleymaniye Terrace', jp: 'Süleymaniye Terası', rect: [-158, 12, -112, 22] },
  { id: 'tahtakale', name: 'Tahtakale Lanes', jp: 'Tahtakale', rect: [-112, -14, -12, 36] },
  { id: 'cagaloglu', name: 'Cağaloğlu Lanes', jp: 'Cağaloğlu', rect: [-112, -112, 8, -46] },
  { id: 'gizli', name: 'Gizli Mutfak · Hidden Kitchen', jp: 'gizli mutfak', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
];

/** Funchal's quarters round the Sé and the seafront (see world/funchal.ts); `jp` holds the Portuguese name. */
const MADEIRA_ZONES: StreetZone[] = [
  { id: 'avenida', name: 'Avenida do Mar', jp: 'Avenida do Mar', rect: [27, -88, 35, 88] },
  { id: 'promenade', name: 'The Seafront', jp: 'a marginal', rect: [35, -88, 60, 88] },
  { id: 'marina', name: 'Marina do Funchal', jp: 'a marina', rect: [35, -72, 68, -20] },
  { id: 'arriaga', name: 'Avenida Arriaga', jp: 'Avenida Arriaga', rect: [-1, -88, 9, -42] },
  { id: 'alfandega', name: 'Rua da Alfândega', jp: 'Rua da Alfândega', rect: [17, -88, 22, 9] },
  { id: 'largo', name: 'Largo da Sé', jp: 'Largo da Sé', rect: [-10, -42, 14, -12] },
  { id: 'se', name: 'Sé do Funchal', jp: 'a Sé', rect: [-42, -38, -10, -18] },
  { id: 'ferreiros', name: 'Rua dos Ferreiros', jp: 'Rua dos Ferreiros', rect: [-72, -15, -10, -4] },
  { id: 'bispo', name: 'Rua do Bispo', jp: 'Rua do Bispo', rect: [-72, -53, -10, -40] },
  { id: 'aljube', name: 'Rua do Aljube', jp: 'Rua do Aljube', rect: [-1, -12, 5, 23] },
  { id: 'ribeira', name: 'Ribeira de João Gomes', jp: 'a ribeira', rect: [-112, 6, 40, 26] },
  { id: 'lavradores', name: 'Largo dos Lavradores', jp: 'Largo dos Lavradores', rect: [-4, 23, 12, 34] },
  { id: 'mercado', name: 'Mercado dos Lavradores', jp: 'o Mercado', rect: [-27, 23, -4, 45] },
  { id: 'jardim', name: 'Jardim Almirante Reis', jp: 'o jardim', rect: [12, 23, 26, 50] },
  { id: 'teleferico', name: 'Teleférico do Funchal', jp: 'o teleférico', rect: [14, 38, 23, 48] },
  { id: 'santamaria', name: 'Rua de Santa Maria', jp: 'Rua de Santa Maria', rect: [6, 34, 12, 88] },
  { id: 'zonavelha', name: 'Zona Velha', jp: 'a Zona Velha', rect: [-50, 46, 27, 88] },
  { id: 'forte', name: 'Fortaleza de São Tiago', jp: 'o forte', rect: [39, 62, 60, 88] },
  { id: 'socalcos', name: 'The Banana Terraces', jp: 'os socalcos', rect: [-112, -88, -46, 88] },
  { id: 'segredo', name: 'A Porta Pintada · Hidden Kitchen', jp: 'a porta pintada', rect: [INTERIOR_ORIGIN[0] - 10, 0, INTERIOR_ORIGIN[0] + 30, 30] },
];

export const ZONES: StreetZone[] = NEO ? NEO_ZONES : AMALFI ? AMALFI_ZONES : ISTANBUL ? ISTANBUL_ZONES : MADEIRA ? MADEIRA_ZONES : TOKYO_ZONES;

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
