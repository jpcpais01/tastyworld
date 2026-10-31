import { perCity } from '../world/cityId';

/**
 * Money. The wallet counts in yen wherever you are, and each city prices things in its own money at rounded
 * late-2026 exchange rates: €1 = ¥180 and ₺1 = ¥3 (so €1 = ₺60). Ten euro cents and one lira are whole yen,
 * so a price written as eur(2.80) or lira(220) is exact, and the wallet never drifts by a stray cent.
 */
export const YEN_PER_EURO = 180;
export const YEN_PER_LIRA = 3;

/** A price in euros, in the wallet's yen. */
export const eur = (e: number): number => Math.round(e * YEN_PER_EURO);
/** A price in Turkish lira, in the wallet's yen. */
export const lira = (t: number): number => Math.round(t * YEN_PER_LIRA);

/**
 * What a new traveller sets off with: about a week of street food and mid-range hotels, in round local money
 * for the city the game starts in (¥150,000 ≈ €830 ≈ ₺50,000).
 */
export const START_PURSE = perCity({ tokyo: 150_000, amalfi: eur(850), istanbul: lira(50_000) });

/** A vendor's tip for each star of a cooking challenge: three stars pays about an hour of part-time work. */
export const TIP_PER_STAR = perCity({ tokyo: 500, amalfi: eur(4), istanbul: lira(150) });

/** Saves from before real prices hold pocket money (¥3,000 to start, rooms at ¥2,000): scale them up once. */
export const ECONOMY = 2;
export const OLD_WALLET_SCALE = 8;
