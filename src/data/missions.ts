import type { IconName } from '../ui/emblems';
import type { SaveState } from '../game/state';
import { DISH, DISHES } from './dishes';
import { CAPSULES } from './places';
import { STALLS } from './stalls';
import { HOTELS } from './hotels';
import { perCity } from '../world/cityId';

export interface Reward { yen?: number; item?: string; title?: string; }

export interface Mission {
  id: string;
  name: string;
  desc: string;
  progress: (s: SaveState) => [number, number];
  reward: Reward;
}

const tasted = (s: SaveState) => Object.keys(s.tasted);
const AMALFI_COUNT = DISHES.length;
const AMALFI_STALL_IDS = ['pansa', 'cuoppo', 'portafoglio', 'gelato', 'limonaia'];
/** Only this city's stamps count for its missions (the passport keeps every city's). */
const amalfiTasted = (s: SaveState) => tasted(s).filter((id) => DISHES.some((d) => d.id === id));
const AMALFI_TASTED = (s: SaveState) => amalfiTasted(s).length;
const HOTEL_IDS = HOTELS.map((h) => h.id);
const desserts = (s: SaveState) => tasted(s).filter((id) => DISH[id as keyof typeof DISH]?.dessert).length;

const TOKYO_MISSIONS: Mission[] = [
  { id: 'first-bite', name: 'First Bite', desc: 'Taste your first dish in Tokyo.', progress: (s) => [Math.min(1, tasted(s).length), 1], reward: { yen: 500 } },
  { id: 'trio', name: 'Street Food Trio', desc: 'Discover three street foods in Tokyo.', progress: (s) => [Math.min(3, tasted(s).length), 3], reward: { yen: 800, item: 'headband' } },
  { id: 'sweet', name: 'Sweet Tooth', desc: 'Find a traditional dessert in Tokyo.', progress: (s) => [Math.min(1, desserts(s)), 1], reward: { yen: 600 } },
  { id: 'apprentice', name: 'Apprentice Cook', desc: 'Help a vendor cook a dish.', progress: (s) => [Math.min(1, Object.keys(s.cooked).length), 1], reward: { yen: 500, item: 'happi' } },
  { id: 'alley', name: 'Lantern Alley Regular', desc: 'Taste all four dishes on Lantern Alley.', progress: (s) => [['yakitori', 'karaage', 'ramen', 'gyoza'].filter((d) => s.tasted[d]).length, 4], reward: { yen: 1000, item: 'charm' } },
  { id: 'night', name: 'Night Market', desc: 'Eat something after dark, when the lanterns glow.', progress: (s) => [s.flags.ateAtNight ? 1 : 0, 1], reward: { yen: 400 } },
  { id: 'cats', name: 'Lucky Cats', desc: 'Find the three maneki-neko hidden around the district.', progress: (s) => [s.manekis.length, 3], reward: { item: 'secret' } },
  { id: 'secret', name: 'The Secret Counter', desc: 'Dine at the hidden restaurant.', progress: (s) => [s.tasted['nigiri'] || s.tasted['tamagoyaki'] ? 1 : 0, 1], reward: { yen: 1500, item: 'chefhat' } },
  { id: 'stars', name: 'Three Stars', desc: 'Earn three stars on any cooking challenge.', progress: (s) => [Math.max(0, ...Object.values(s.cooked)) >= 3 ? 1 : 0, 1], reward: { yen: 700 } },
  { id: 'browse', name: 'Window Shopper', desc: 'Step inside ten different shops, cafés and bars.', progress: (s) => [Math.min(10, s.rooms.length), 10], reward: { yen: 800 } },
  { id: 'tables', name: 'Table for One', desc: 'Sit down to eat at Kissa Komorebi and Soba-dokoro Kikyō.', progress: (s) => [['komorebi', 'kikyo'].filter((st) => Object.keys(s.tasted).some((d) => DISH[d as keyof typeof DISH]?.stall === st)).length, 2], reward: { yen: 1000, item: 'noren' } },
  { id: 'gacha', name: 'Capsule Collector', desc: 'Collect six different gachapon capsule charms.', progress: (s) => [Math.min(6, s.capsules.length), 6], reward: { yen: 1200 } },
  { id: 'gacha-all', name: 'Gachapon Master', desc: `Complete the set of ${CAPSULES.length} capsule charms, golden shrimp included.`, progress: (s) => [s.capsules.length, CAPSULES.length], reward: { yen: 2500, title: 'Capsule Royalty' } },
  { id: 'shelf', name: 'Between the Pages', desc: 'An old bookshop on Kaminari Lane is hiding a room.', progress: (s) => [s.flags.shelfOpen ? 1 : 0, 1], reward: { yen: 1000 } },
  { id: 'hotel', name: 'A Bed for the Night', desc: 'Check into a hotel before dark and sleep until morning.', progress: (s) => [Math.min(1, s.stays.length), 1], reward: { yen: 600 } },
  { id: 'hotels', name: 'Hotel Hopper', desc: 'Spend a night in three different hotels.', progress: (s) => [Math.min(3, s.stays.length), 3], reward: { yen: 1500, title: 'Seasoned Traveller' } },
  { id: 'ryokan', name: 'Futon and Tatami', desc: 'Sleep on a futon at a traditional ryokan.', progress: (s) => [s.stays.includes('hinode') ? 1 : 0, 1], reward: { yen: 500, item: 'yukata' } },
  { id: 'daruma', name: 'Daruma Hunt', desc: 'Find the eight tiny daruma hidden inside the shops.', progress: (s) => [s.darumas.length, 8], reward: { yen: 2000, item: 'daruma' } },
  { id: 'photos', name: 'Say Cheese', desc: 'Take five photos in photo mode. The camera button sits by the view switch.', progress: (s) => [Math.min(5, s.photos ?? 0), 5], reward: { yen: 600 } },
  { id: 'master', name: 'Master of Tokyo', desc: `Collect all ${DISHES.length} food passport stamps.`, progress: (s) => [tasted(s).length, DISHES.length], reward: { yen: 3000, title: 'Tokyo Gourmet', item: 'gold' } },
];

const AMALFI_MISSIONS: Mission[] = [
  { id: 'a-first-bite', name: 'Primo Assaggio', desc: 'Taste your first dish in Amalfi.', progress: (s) => [Math.min(1, AMALFI_TASTED(s)), 1], reward: { yen: 500 } },
  { id: 'a-trio', name: 'Tre Assaggi', desc: 'Discover three street foods on the coast.', progress: (s) => [Math.min(3, AMALFI_TASTED(s)), 3], reward: { yen: 800, item: 'coppola' } },
  { id: 'a-sweet', name: 'Dolce Vita', desc: 'Find a pastry or a gelato in Amalfi.', progress: (s) => [Math.min(1, amalfiTasted(s).filter((id) => DISH[id as keyof typeof DISH]?.dessert).length), 1], reward: { yen: 600 } },
  { id: 'a-apprentice', name: 'Garzone', desc: 'Help an Amalfi vendor cook a dish.', progress: (s) => [Math.min(1, AMALFI_STALL_IDS.filter((st) => s.cooked[st]).length), 1], reward: { yen: 500, item: 'grembiule' } },
  { id: 'a-fried', name: 'Fritto Misto', desc: 'Eat both fried treats at the cuoppo stand by the harbour.', progress: (s) => [['cuoppo', 'frittatina'].filter((d) => s.tasted[d]).length, 2], reward: { yen: 700 } },
  { id: 'a-climb', name: 'A Thousand Steps', desc: 'Climb to the lemon terraces high above the town.', progress: (s) => [s.flags.climbed ? 1 : 0, 1], reward: { yen: 800, item: 'basket' } },
  { id: 'a-night', name: 'Sera d\'Estate', desc: 'Eat something after dark, when the lanterns come on along the stairs.', progress: (s) => [s.flags.ateAtNight ? 1 : 0, 1], reward: { yen: 400 } },
  { id: 'a-lemons', name: 'Limoni di Maiolica', desc: 'Find the three majolica lemons hidden around town.', progress: (s) => [s.manekis.length, 3], reward: { item: 'whisper' } },
  { id: 'a-secret', name: 'La Grotta', desc: 'Dine at the hidden kitchen in the rock.', progress: (s) => [s.tasted['scialatielli'] || s.tasted['totani'] ? 1 : 0, 1], reward: { yen: 1500, item: 'majolica' } },
  { id: 'a-stars', name: 'Bravo!', desc: 'Earn three stars on an Amalfi cooking challenge.', progress: (s) => [AMALFI_STALL_IDS.some((st) => (s.cooked[st] ?? 0) >= 3) ? 1 : 0, 1], reward: { yen: 700 } },
  { id: 'a-photos', name: 'Cartolina', desc: 'Take three photos of the coast in photo mode.', progress: (s) => [Math.min(3, s.flags.photosA ?? 0), 3], reward: { yen: 600 } },
  { id: 'a-master', name: 'Master of Amalfi', desc: `Collect all ${AMALFI_COUNT} Amalfi passport stamps.`, progress: (s) => [AMALFI_TASTED(s), AMALFI_COUNT], reward: { yen: 3000, title: 'Amalfi Gourmet', item: 'goldlemon' } },
];

const ISTANBUL_STALL_IDS = ['simitci', 'balikci', 'midyeci', 'kestaneci', 'dondurmaci', 'durumcu', 'baklavaci'];
const ISTANBUL_MISSIONS: Mission[] = [
  { id: 'i-first-bite', name: 'Afiyet Olsun', desc: 'Taste your first dish in Istanbul.', progress: (s) => [Math.min(1, AMALFI_TASTED(s)), 1], reward: { yen: 500 } },
  { id: 'i-trio', name: 'Üç Lezzet', desc: 'Discover three street foods in Istanbul.', progress: (s) => [Math.min(3, AMALFI_TASTED(s)), 3], reward: { yen: 800, item: 'fes' } },
  { id: 'i-sweet', name: 'Tatlı Dil', desc: 'Find a sweet: baklava, künefe, salep or the stretchy ice cream.', progress: (s) => [Math.min(1, amalfiTasted(s).filter((id) => DISH[id as keyof typeof DISH]?.dessert).length), 1], reward: { yen: 600 } },
  { id: 'i-apprentice', name: 'Çırak', desc: 'Help an Istanbul vendor cook a dish.', progress: (s) => [Math.min(1, ISTANBUL_STALL_IDS.filter((st) => s.cooked[st]).length), 1], reward: { yen: 500, item: 'onluk' } },
  { id: 'i-quay', name: 'By the Boats', desc: 'Eat a balık ekmek and drink a pickle juice on the quay.', progress: (s) => [['balikekmek', 'tursu'].filter((d) => s.tasted[d]).length, 2], reward: { yen: 700 } },
  { id: 'i-tables', name: 'Sit Down, Sit Down', desc: 'Eat at the dürüm house and the baklava house up the hill.', progress: (s) => [['durumcu', 'baklavaci'].filter((st) => Object.keys(s.tasted).some((d) => DISH[d as keyof typeof DISH]?.stall === st)).length, 2], reward: { yen: 1000 } },
  { id: 'i-climb', name: 'Seven Hills', desc: 'Climb to the terrace of the great mosque on the hill.', progress: (s) => [s.flags.climbed ? 1 : 0, 1], reward: { yen: 800, item: 'tespih' } },
  { id: 'i-browse', name: 'Çarşı Wanderer', desc: 'Step inside ten different shops, tea houses and lokantas.', progress: (s) => [Math.min(10, s.rooms.length), 10], reward: { yen: 800 } },
  { id: 'i-night', name: 'Istanbul Nights', desc: 'Eat something after dark, when the minarets light up.', progress: (s) => [s.flags.ateAtNight ? 1 : 0, 1], reward: { yen: 400 } },
  { id: 'i-nazar', name: 'Three Blue Eyes', desc: 'Find the three nazar beads hidden around Eminönü.', progress: (s) => [s.manekis.length, 3], reward: { item: 'fisilti' } },
  { id: 'i-secret', name: 'Gizli Mutfak', desc: 'Dine at the hidden kitchen behind the door with no sign.', progress: (s) => [s.tasted['hunkar'] || s.tasted['manti'] ? 1 : 0, 1], reward: { yen: 1500, item: 'cezve' } },
  { id: 'i-stars', name: 'Eline Sağlık', desc: 'Earn three stars on an Istanbul cooking challenge.', progress: (s) => [ISTANBUL_STALL_IDS.some((st) => (s.cooked[st] ?? 0) >= 3) ? 1 : 0, 1], reward: { yen: 700 } },
  { id: 'i-hotel', name: 'A Bed by the Bosphorus', desc: 'Check into a hotel before dark and sleep until morning.', progress: (s) => [Math.min(1, s.stays.filter((h) => HOTEL_IDS.includes(h)).length), 1], reward: { yen: 600 } },
  { id: 'i-hotels', name: 'Twelve Doors', desc: 'Spend a night in four different Istanbul hotels.', progress: (s) => [Math.min(4, s.stays.filter((h) => HOTEL_IDS.includes(h)).length), 4], reward: { yen: 1500, title: 'Seasoned Traveller' } },
  { id: 'i-photos', name: 'Kartpostal', desc: 'Take three photos of the city in photo mode.', progress: (s) => [Math.min(3, s.flags.photosA ?? 0), 3], reward: { yen: 600 } },
  { id: 'i-master', name: 'Master of Istanbul', desc: `Collect all ${AMALFI_COUNT} Istanbul passport stamps.`, progress: (s) => [AMALFI_TASTED(s), AMALFI_COUNT], reward: { yen: 3000, title: 'Istanbul Gourmet', item: 'goldtulip' } },
];

export const MISSIONS: Mission[] = perCity({ tokyo: TOKYO_MISSIONS, amalfi: AMALFI_MISSIONS, istanbul: ISTANBUL_MISSIONS });
/** The mission for the hidden restaurant, which stays secret until its door is found. */
export const SECRET_MISSION = perCity({ tokyo: 'secret', amalfi: 'a-secret', istanbul: 'i-secret' });

/** The one mission the HUD follows: a reward to claim first, otherwise the one closest to done. */
export function trackedMission(s: SaveState): { next: Mission | null; ready: Mission[] } {
  const open = MISSIONS.filter((m) => !s.claimed.includes(m.id));
  const ready = open.filter((m) => { const [a, b] = m.progress(s); return a >= b; });
  const live = open.filter((m) => m.id !== SECRET_MISSION || s.hiddenFound);
  const frac = (m: Mission) => { const [a, b] = m.progress(s); return a / b; };
  return { next: ready[0] ?? [...live].sort((x, y) => frac(y) - frac(x))[0] ?? null, ready };
}

/** Stalls where the player can move a mission along, for the city map. */
export function missionStalls(m: Mission, s: SaveState): string[] {
  const [a, b] = m.progress(s);
  if (a >= b) return [];
  const all = STALLS.filter((st) => !st.hidden || s.hiddenFound);
  const untasted = (pick: (d: (typeof DISHES)[number]) => boolean) =>
    all.filter((st) => DISHES.some((d) => d.stall === st.id && !s.tasted[d.id] && pick(d))).map((st) => st.id);
  switch (m.id) {
    case 'first-bite': case 'trio': case 'master': case 'a-first-bite': case 'a-trio': case 'a-master':
    case 'i-first-bite': case 'i-trio': case 'i-master': return untasted(() => true);
    case 'sweet': case 'a-sweet': case 'i-sweet': return untasted((d) => d.dessert);
    case 'i-quay': return untasted((d) => d.stall === 'balikci');
    case 'i-tables': return ['durumcu', 'baklavaci'].filter((id) => !Object.keys(s.tasted).some((d) => DISH[d as keyof typeof DISH]?.stall === id));
    case 'a-fried': return untasted((d) => d.stall === 'cuoppo');
    case 'alley': return untasted((d) => ['yakitori', 'karaage', 'ramen', 'gyoza'].includes(d.id));
    case 'tables': return ['komorebi', 'kikyo'].filter((id) => !Object.keys(s.tasted).some((d) => DISH[d as keyof typeof DISH]?.stall === id));
    case 'apprentice': case 'stars': case 'a-apprentice': case 'a-stars': case 'i-apprentice': case 'i-stars': return all.filter((st) => !st.hidden).map((st) => st.id);
    case 'secret': return s.hiddenFound ? ['kakurega'] : [];
    case 'a-secret': return s.hiddenFound ? ['grotta'] : [];
    case 'i-secret': return s.hiddenFound ? ['gizli'] : [];
    default: return [];
  }
}

export const ITEMS: Record<string, { name: string; icon: IconName; desc: string }> = {
  headband: { name: 'Hachimaki headband', icon: 'headband', desc: 'A red-and-white headband worn by festival cooks. Now you look the part.' },
  happi: { name: 'Happi coat', icon: 'coat', desc: 'A festival jacket in indigo. Vendors nod at you with respect.' },
  charm: { name: 'Lantern charm', icon: 'lantern', desc: 'A tiny red lantern for your backpack. It glows at night.' },
  secret: { name: 'A whisper', icon: 'paw', desc: 'The lucky cats all point down a nameless passage off Lantern Alley...' },
  chefhat: { name: 'Itamae\'s blessing', icon: 'knife', desc: 'Chef Sato let you help behind the counter. A rare honour.' },
  daruma: { name: 'Lucky daruma', icon: 'daruma', desc: 'All eight found. Paint in the second eye, and your wish comes true.' },
  noren: { name: 'Regular\'s noren', icon: 'noren', desc: 'The masters at Komorebi and Kikyō now greet you by name.' },
  yukata: { name: 'Cotton yukata', icon: 'yukata', desc: 'The okami of Ryokan Hinode let you keep the indigo yukata. Locals will think you live here.' },
  coppola: { name: 'Coppola cap', icon: 'headband', desc: 'A flat linen cap, as worn by every nonno on every bench in Campania.' },
  grembiule: { name: 'Pastry apron', icon: 'coat', desc: 'A floury white apron from the pasticceria. You smell faintly of lemon.' },
  basket: { name: 'Lemon basket', icon: 'flower', desc: 'Gennaro lent you a wicker basket for the terraces. It is heavier than it looks.' },
  whisper: { name: 'A whisper', icon: 'paw', desc: 'The three lemons all point up the stairs behind the cathedral, to a door in the rock...' },
  majolica: { name: 'Majolica tile', icon: 'chopsticks', desc: 'Zia Carmela gave you a hand-painted tile from the grotta wall. Blue, yellow, a little lemon.' },
  goldlemon: { name: 'Golden lemon', icon: 'medal', desc: 'Your Amalfi passport is complete. The whole coast knows your name.' },
  fes: { name: 'Red fez', icon: 'headband', desc: 'A felt fez with a black tassel, from a hat shop in the Grand Bazaar. Nobody wears them any more, which is why it is fun.' },
  onluk: { name: 'Usta\'s apron', icon: 'coat', desc: 'A white apron from the cook\'s own hook. Eline sağlık: health to your hands.' },
  tespih: { name: 'Prayer beads', icon: 'chime', desc: 'Amber tespih beads from the terrace tea man. Old men click them for hours on every bench in the city.' },
  fisilti: { name: 'A whisper', icon: 'paw', desc: 'The three blue eyes all look up the lanes behind the Grand Bazaar, to a door with no sign...' },
  cezve: { name: 'Copper cezve', icon: 'coffee', desc: 'Hatice Hanım gave you her small copper coffee pot. "For your own kitchen. Boil it slowly."' },
  goldtulip: { name: 'Golden tulip', icon: 'medal', desc: 'Your Istanbul passport is complete. The ferry captains know your name.' },
  gold: { name: 'Gold stamp', icon: 'medal', desc: 'Your Japan passport is complete. Seoul is calling.' },
};
