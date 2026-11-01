import type { Mission } from '../data/missions';
import type { SaveState } from '../game/state';
import { NEO_DISHES } from '../data/neo';
import { defaultLife } from './state';

/** Halcyon's goals: the food log, and a life in the city (work, a home, clothes, the secrets under the neon). */
const life = (s: SaveState) => s.life ?? defaultLife();
const ate = (s: SaveState) => NEO_DISHES.filter((d) => s.tasted[d.id]).length;
const shifts = (s: SaveState) => Object.values(life(s).shifts).reduce((a, b) => a + b, 0);
const desserts = (s: SaveState) => NEO_DISHES.filter((d) => d.dessert && s.tasted[d.id]).length;

export const NEO_MISSIONS: Mission[] = [
  { id: 'n-first-bite', name: 'First Bite', desc: 'Eat your first dish in Halcyon.', progress: (s) => [Math.min(1, ate(s)), 1], reward: { yen: 40 } },
  { id: 'n-trio', name: 'Street Food Trio', desc: 'Taste three different dishes from the stalls and kitchens.', progress: (s) => [Math.min(3, ate(s)), 3], reward: { yen: 80 } },
  { id: 'n-first-shift', name: 'Clock In', desc: 'Work your first shift anywhere in the city.', progress: (s) => [Math.min(1, shifts(s)), 1], reward: { yen: 60 } },
  { id: 'n-grind', name: 'The Grind', desc: 'Work ten shifts.', progress: (s) => [Math.min(10, shifts(s)), 10], reward: { yen: 400, title: 'Working Stiff' } },
  { id: 'n-jobs', name: 'Jack of All Trades', desc: 'Work at four different jobs.', progress: (s) => [Math.min(4, Object.keys(life(s).shifts).length), 4], reward: { yen: 300 } },
  { id: 'n-drip', name: 'New Drip', desc: 'Buy a piece of clothing and wear it.', progress: (s) => [Math.min(1, life(s).owned.length), 1], reward: { yen: 50 } },
  { id: 'n-wardrobe', name: 'Wardrobe', desc: 'Own eight pieces of clothing and accessories.', progress: (s) => [Math.min(8, life(s).owned.length), 8], reward: { yen: 300, title: 'Street Icon' } },
  { id: 'n-home', name: 'A Place of Your Own', desc: 'Rent or buy a flat.', progress: (s) => [life(s).home ? 1 : 0, 1], reward: { yen: 100 } },
  { id: 'n-owner', name: 'Property Ladder', desc: 'Buy a home outright.', progress: (s) => [life(s).home?.owned ? 1 : 0, 1], reward: { yen: 1500, title: 'Homeowner' } },
  { id: 'n-chef', name: 'Home Cooking', desc: 'Cook three meals in your own kitchen.', progress: (s) => [Math.min(3, life(s).homeCooked), 3], reward: { yen: 120 } },
  { id: 'n-sweet', name: 'Sweet Tooth', desc: 'Try three desserts or sweet drinks.', progress: (s) => [Math.min(3, desserts(s)), 3], reward: { yen: 80 } },
  { id: 'n-hotel', name: 'A Bed for the Night', desc: 'Sleep a night in a hotel.', progress: (s) => [Math.min(1, s.stays.length), 1], reward: { yen: 60 } },
  { id: 'n-floors', name: 'Going Up', desc: 'Visit ten upper floors in the city\'s towers and malls.', progress: (s) => [Math.min(10, life(s).floors.length), 10], reward: { yen: 250 } },
  { id: 'n-seeds', name: 'Seeds of the Past', desc: 'Find the three seed capsules hidden in Halcyon.', progress: (s) => [s.manekis.length, 3], reward: { item: 'neoseed' } },
  { id: 'n-secret', name: 'The Greenhouse', desc: 'Eat at the hidden table where food still grows in soil.', progress: (s) => [s.tasted['realsteak'] || s.tasted['gardensalad'] ? 1 : 0, 1], reward: { yen: 500, item: 'neochef' } },
  { id: 'n-helix', name: 'Terminal Seven', desc: 'Wren says Helix Dynamics hides something on its top floor.', progress: (s) => [life(s).secrets.includes('helix') ? 1 : 0, 1], reward: { yen: 2000, title: 'Ghost in the Spire' } },
  { id: 'n-harvest', name: 'First Harvest', desc: 'Plant the old seed capsules in the Greenhouse and see them grow.', progress: (s) => [(life(s).quests.harvest ?? 0) >= 2 ? 1 : 0, 1], reward: { yen: 1000, title: 'Seedkeeper' } },
  { id: 'n-secrets', name: 'Under the Neon', desc: 'Uncover five of the city\'s secrets.', progress: (s) => [Math.min(5, life(s).secrets.length), 5], reward: { yen: 800, title: 'Urban Legend' } },
  { id: 'n-master', name: 'Halcyon Gourmet', desc: `Fill your food log with all ${NEO_DISHES.length} dishes.`, progress: (s) => [ate(s), NEO_DISHES.length], reward: { yen: 3000, title: 'Halcyon Gourmet', item: 'neogold' } },
];
