// CITY=<id> npx tsx scripts/food-audit.ts
// Lists every place to eat in a city (stalls, restaurants, the hidden one, walk-in food rooms) and checks that the
// pocket map can pin each one (stall anchor or room door on the map) and counts it in the "food places found" tally.
import { buildWorld } from '../src/world/bake';
import { CITY } from '../src/world/cityId';
import { STALLS } from '../src/data/stalls';
import { DISHES } from '../src/data/dishes';
import { NON_FOOD_ROOMS } from '../src/world/interiors';
import { roomName } from '../src/data/places';
import { WX0, WX1, WZ0, WZ1 } from '../src/world/layout';

const a = buildWorld().anchors;
const stallIds = new Set(a.stalls.map((s) => s.id));
let bad = 0;
for (const st of STALLS) {
  const has = stallIds.has(st.id) || st.hidden;
  const dishes = DISHES.filter((d) => d.stall === st.id).length;
  if (!has) { bad++; console.log('STALL WITHOUT ANCHOR', st.id, st.name); }
  if (!dishes) console.log('stall with no dishes', st.id);
}
for (const s of a.stalls) {
  if (!STALLS.some((x) => x.id === s.id)) { bad++; console.log('ANCHOR WITHOUT STALL', s.id); }
  // vendor is [x, z, facing]: the map pin and walk-past discovery use its x, z, so it must stand by the counter
  const d = Math.hypot(s.vendor[0] - s.stand[0], s.vendor[1] - s.stand[1]);
  if (d > 4 || s.vendor[0] < WX0 || s.vendor[0] > WX1 || s.vendor[1] < WZ0 || s.vendor[1] > WZ1) { bad++; console.log('VENDOR FAR FROM ITS STAND', s.id, s.vendor, s.stand); }
}
const kinds: Record<string, number> = {};
let food = 0;
for (const r of a.rooms) {
  kinds[r.kind] = (kinds[r.kind] ?? 0) + 1;
  if (r.stall && !STALLS.some((x) => x.id === r.stall)) { bad++; console.log('ROOM WITH UNKNOWN STALL', r.id, r.stall); }
  if (r.stall || r.hotel || NON_FOOD_ROOMS.has(r.kind)) continue;
  food++;
  const [dx, dz] = r.door;
  if (dx < WX0 || dx > WX1 || dz < WZ0 || dz > WZ1) { bad++; console.log('ROOM DOOR OFF THE MAP', r.id, r.door); }
  if (process.env.V) console.log('room', r.id, r.kind, roomName(r.kind, r.nth)[0]);
}
console.log(CITY, 'stalls', STALLS.length, 'anchors', a.stalls.length, 'food rooms', food, 'total', STALLS.length + food, 'room kinds', kinds, 'bad', bad);
process.exit(bad ? 1 : 0);
