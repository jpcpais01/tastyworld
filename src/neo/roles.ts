import type { Look } from '../world/characters';
import { BOUTIQUES, type BoutiqueKind } from './wardrobe';

/**
 * What each of Halcyon's general shops is, by its number among them: a boutique of one style, a gig hub with a
 * job board, one of the souvenir trades, or a plain corner shop. The same rule names it on the map and decides
 * what its keeper does, so the sign and the counter always agree.
 */
export type NeoShop = { role: 'boutique'; kind: BoutiqueKind } | { role: 'gig' } | { role: 'trade'; trade: string } | { role: 'plain' };

const CYCLE: NeoShop[] = [
  { role: 'boutique', kind: 'street' }, { role: 'gig' }, { role: 'boutique', kind: 'thrift' }, { role: 'boutique', kind: 'tech' },
  { role: 'trade', trade: 'gadget' }, { role: 'boutique', kind: 'corpo' }, { role: 'trade', trade: 'prints' }, { role: 'gig' },
  { role: 'trade', trade: 'curios' }, { role: 'plain' },
];

export function neoShop(nth: number): NeoShop { return CYCLE[nth % CYCLE.length]; }

const HUBS: [string, string][] = [['GigHub', 'GIGHUB'], ['Hustle Exchange', 'HUSTLE'], ['Work Now', 'WORK NOW'], ['Odd Jobs Co-op', 'ODD JOBS']];
const HUB_KEEPERS = ['Dispatcher Vee', 'Mr. Batista', 'Kit', 'Auntie Odile'];
export const HUB_LOOK: Partial<Look> = { topStyle: 'vest', top: 0xf2c74a, accent: 0x16161c, hat: 'cap', hatColor: 0x16161c };
export const HUB_LINES = [
  'Board refreshes every hour. Couriers, kitchens, docks, data. Take one, finish it, get paid.',
  'Fast hands, fast feet, fast credits. The bonus clock is real, by the way.',
  'Half this city runs on gigs. The other half pretends it does not.',
];

/** Name over the door and keeper of a Halcyon general shop that is a boutique or gig hub (null otherwise). */
export function neoShopIdentity(nth: number): { name: string; local: string; keeper: string; look: Partial<Look> } | null {
  const s = neoShop(nth);
  const k = Math.floor(nth / CYCLE.length);
  if (s.role === 'boutique') {
    const b = BOUTIQUES[s.kind];
    return { name: b.names[k % b.names.length], local: b.label.toUpperCase(), keeper: b.keepers[k % b.keepers.length], look: b.keeperLook };
  }
  if (s.role === 'gig') {
    const i = (k * 2 + (nth % CYCLE.length === 7 ? 1 : 0)) % HUBS.length;
    return { name: HUBS[i][0], local: HUBS[i][1], keeper: HUB_KEEPERS[i], look: HUB_LOOK };
  }
  return null;
}
