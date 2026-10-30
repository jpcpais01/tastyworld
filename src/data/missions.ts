import type { SaveState } from '../game/state';
import { DISH } from './dishes';

export interface Reward { yen?: number; item?: string; title?: string; }

export interface Mission {
  id: string;
  name: string;
  desc: string;
  progress: (s: SaveState) => [number, number];
  reward: Reward;
}

const tasted = (s: SaveState) => Object.keys(s.tasted);
const desserts = (s: SaveState) => tasted(s).filter((id) => DISH[id as keyof typeof DISH]?.dessert).length;

export const MISSIONS: Mission[] = [
  { id: 'first-bite', name: 'First Bite', desc: 'Taste your first dish in Tokyo.', progress: (s) => [Math.min(1, tasted(s).length), 1], reward: { yen: 500 } },
  { id: 'trio', name: 'Street Food Trio', desc: 'Discover three street foods in Tokyo.', progress: (s) => [Math.min(3, tasted(s).length), 3], reward: { yen: 800, item: 'headband' } },
  { id: 'sweet', name: 'Sweet Tooth', desc: 'Find a traditional dessert in Tokyo.', progress: (s) => [Math.min(1, desserts(s)), 1], reward: { yen: 600 } },
  { id: 'apprentice', name: 'Apprentice Cook', desc: 'Help a vendor cook a dish.', progress: (s) => [Math.min(1, Object.keys(s.cooked).length), 1], reward: { yen: 500, item: 'happi' } },
  { id: 'alley', name: 'Lantern Alley Regular', desc: 'Taste all four dishes on Lantern Alley.', progress: (s) => [['yakitori', 'karaage', 'ramen', 'gyoza'].filter((d) => s.tasted[d]).length, 4], reward: { yen: 1000, item: 'charm' } },
  { id: 'night', name: 'Night Market', desc: 'Eat something after dark, when the lanterns glow.', progress: (s) => [s.flags.ateAtNight ? 1 : 0, 1], reward: { yen: 400 } },
  { id: 'cats', name: 'Lucky Cats', desc: 'Find the three maneki-neko hidden around the district.', progress: (s) => [s.manekis.length, 3], reward: { item: 'secret' } },
  { id: 'secret', name: 'The Secret Counter', desc: 'Dine at the hidden restaurant.', progress: (s) => [s.tasted['nigiri'] || s.tasted['tamagoyaki'] ? 1 : 0, 1], reward: { yen: 1500, item: 'chefhat' } },
  { id: 'stars', name: 'Three Stars', desc: 'Earn three stars on any cooking challenge.', progress: (s) => [Math.max(0, ...Object.values(s.cooked)) >= 3 ? 1 : 0, 1], reward: { yen: 700 } },
  { id: 'master', name: 'Master of Tokyo', desc: 'Collect all 12 food passport stamps.', progress: (s) => [tasted(s).length, 12], reward: { yen: 3000, title: 'Tokyo Gourmet', item: 'gold' } },
];

export const ITEMS: Record<string, { name: string; icon: string; desc: string }> = {
  headband: { name: 'Hachimaki headband', icon: '🎌', desc: 'A red-and-white headband worn by festival cooks. Now you look the part.' },
  happi: { name: 'Happi coat', icon: '🧥', desc: 'A festival jacket in indigo. Vendors nod at you with respect.' },
  charm: { name: 'Lantern charm', icon: '🏮', desc: 'A tiny red lantern for your backpack. It glows at night.' },
  secret: { name: 'A whisper', icon: '🐾', desc: 'The lucky cats all point down a nameless passage off Lantern Alley...' },
  chefhat: { name: 'Itamae\'s blessing', icon: '🔪', desc: 'Chef Sato let you help behind the counter. A rare honour.' },
  gold: { name: 'Gold stamp', icon: '🥇', desc: 'Your Japan passport is complete. Seoul is calling.' },
};
