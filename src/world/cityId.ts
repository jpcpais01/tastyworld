/** The cities a trip can land in. Each page load builds exactly one of them. */
export type CityId = 'tokyo' | 'amalfi' | 'istanbul';
export const CITIES: readonly CityId[] = ['tokyo', 'amalfi', 'istanbul'];
export const CITY_KEY = 'tastyworld.city';

const known = (v: unknown): CityId | null => (CITIES as readonly unknown[]).includes(v) ? v as CityId : null;

/**
 * Picked once, when this module is first evaluated, so every constant that depends on it (world size, palettes,
 * menus) can stay a plain const. The page reads ?city= or the last city visited; a world worker is told by its
 * name ('city:amalfi'); scripts read the CITY environment variable.
 */
export const CITY: CityId = (() => {
  const g = globalThis as unknown as { document?: unknown; name?: string; location?: { search: string }; localStorage?: Storage; process?: { env: Record<string, string | undefined> } };
  if (g.process?.env) return known(g.process.env.CITY) ?? 'tokyo';
  if (!g.document) return known(g.name?.startsWith('city:') ? g.name.slice(5) : null) ?? 'tokyo';
  try {
    const q = known(new URLSearchParams(g.location?.search ?? '').get('city'));
    if (q) return q;
    return known(g.localStorage?.getItem(CITY_KEY)) ?? 'tokyo';
  } catch {
    return 'tokyo';
  }
})();

export const AMALFI = CITY === 'amalfi';
export const ISTANBUL = CITY === 'istanbul';
/** Cities built on a heightfield (streets climb, labels and seats follow the ground), not on Tokyo's flat street level. */
export const HILLSIDE = AMALFI || ISTANBUL;

/**
 * Pick this city's entry. Every city must be listed, so a new CityId fails to compile until it has its own words,
 * dishes and sounds instead of quietly inheriting Tokyo's.
 */
export const perCity = <T>(m: Record<CityId, T>): T => m[CITY];

export const isCity = (id: string): id is CityId => known(id) !== null;

/**
 * What to pick up after the page reloads into another city: board straight away (the plane has landed and the
 * arrival veil is up, by day or by night), host a co-op trip, or join one.
 */
export type Resume = { board: CityId; night?: boolean } | { host: CityId } | { ticket: string };
/** index.html reads this key too, before anything else paints (see the landing script there). */
const RESUME_KEY = 'tastyworld.resume';

/** Reload the page into another city (the caller saves first), carrying on with `then` once it has loaded. */
export function goToCity(id: CityId, then: Resume): void {
  try {
    localStorage.setItem(CITY_KEY, id);
    sessionStorage.setItem(RESUME_KEY, JSON.stringify(then));
  } catch { /* storage blocked: ?city= still works */ }
  const q = new URLSearchParams(location.search);
  q.set('city', id);
  location.replace(`${location.pathname}?${q}${location.hash}`);
}

/** The step carried over from the page that sent us here, without using it up. */
export function peekResume(): Resume | null {
  try {
    const raw = sessionStorage.getItem(RESUME_KEY);
    return raw ? JSON.parse(raw) as Resume : null;
  } catch {
    return null;
  }
}

/** The step carried over from the page that sent us here, read once. */
export function takeResume(): Resume | null {
  const r = peekResume();
  try { sessionStorage.removeItem(RESUME_KEY); } catch { /* storage blocked */ }
  return r;
}
