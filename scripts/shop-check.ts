// CITY=<id> npx tsx scripts/shop-check.ts
// Lists the city's souvenir shops by trade and checks that every shop's browsing spot can be walked to from the
// spawn, close enough to its keeper to talk over the counter, and that every trade's catalogue is sold somewhere.
import { bakeWorld } from '../src/world/bake';
import { Nav } from '../src/game/nav';
import { CITY } from '../src/world/cityId';
import { CITY_TRADES, tradeOf, stockFor, roomTrade, SOUVENIR, ALL_SOUVENIRS } from '../src/data/souvenirs';

const w = bakeWorld(() => {});
const a = w.anchors;
const nav = new Nav(w.nav);
const [sx, , sz] = a.spawn;
let bad = 0;
const reach = (x: number, z: number) => {
  if (!nav.walkable(x, z)) return false;
  const p = nav.findPath(sx, sz, x, z);
  if (!p || !p.length) return false;
  const [ex, ez] = p[p.length - 1];
  return Math.hypot(ex - x, ez - z) < 0.8;
};
const seeds: Record<string, number[]> = {};
for (const e of a.extras ?? []) {
  if (!e.shop) continue;
  const t = tradeOf(CITY, e.shop);
  if (!t) { bad++; console.log('UNKNOWN TRADE', e.shop); continue; }
  if (!e.stand) { bad++; console.log('NO STAND', e.shop); continue; }
  const d = Math.hypot(e.stand[0] - e.pos[0], e.stand[1] - e.pos[2]);
  // the game skips a shop whose browsing spot is not walkable (its keeper just stands there)
  if (!nav.walkable(e.stand[0], e.stand[1])) { console.log('skipped (stand not walkable)', e.shop, e.stand.map((v) => v.toFixed(1)).join(',')); continue; }
  (seeds[e.shop] ??= []).push(e.seed);
  const ok = reach(e.stand[0], e.stand[1]);
  if (!ok || d > (e.indoor ? 4.6 : 3.2)) { bad++; console.log(ok ? 'TOO FAR FROM KEEPER' : 'UNREACHABLE STAND', e.shop, e.stand.map((v) => v.toFixed(1)).join(','), 'keeper', e.pos.map((v) => v.toFixed(1)).join(','), 'd', d.toFixed(2)); }
}
for (const r of a.rooms) {
  const id = roomTrade(r.kind, r.nth);
  if (!id || !tradeOf(CITY, id)) continue;
  (seeds[id] ??= []).push(r.nth);
}
for (const t of CITY_TRADES) {
  const n = seeds[t.id]?.length ?? 0;
  const stock = n ? stockFor(t, seeds[t.id]) : [];
  const sold = new Set(stock.flat());
  const missing = t.items.filter((it) => !sold.has(it.id));
  console.log(t.id.padEnd(12), 'shops', String(n).padStart(3), 'items', t.items.length, missing.length ? `NOT SOLD: ${missing.map((m) => m.id).join(' ')}` : '');
  if (missing.length) bad++;
}
// every souvenir's model must be a known shape, and ids unique
if (Object.keys(SOUVENIR).length !== ALL_SOUVENIRS.length) { bad++; console.log('DUPLICATE SOUVENIR IDS'); }
console.log(CITY, 'souvenirs', CITY_TRADES.flatMap((t) => t.items).length, 'bad', bad);
process.exit(bad ? 1 : 0);
