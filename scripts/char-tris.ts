// Triangle counts and build times of a person's two bodies, close-up and plain (npx tsx scripts/char-tris.ts).
import { meshBody } from '../src/world/bodymesh';
import { buildPerson, buildFinePerson, randomLook } from '../src/world/characters';
const tris = (m: Parameters<typeof meshBody>[0]) => meshBody(m).indices.length / 3;
for (let i = 0; i < 20; i++) tris(buildFinePerson(randomLook(i)));
const n = 200;
let bf = 0, bc = 0, tf = 0, tc = 0, mf = 0, mc = 0, max = 0;
for (let i = 0; i < n; i++) {
  const look = randomLook(i * 7 + 1);
  let t = performance.now();
  const f = buildFinePerson(look); bf += performance.now() - t;
  t = performance.now(); const c = buildPerson(look); bc += performance.now() - t;
  t = performance.now(); const nf = tris(f); mf += performance.now() - t;
  t = performance.now(); const nc = tris(c); mc += performance.now() - t;
  tf += nf; tc += nc; max = Math.max(max, nf);
}
const ms = (v: number) => (v / n).toFixed(2) + ' ms';
console.log(`close-up: ${Math.round(tf / n)} tris (max ${max}), build ${ms(bf)}, mesh ${ms(mf)}`);
console.log(`plain:    ${Math.round(tc / n)} tris, build ${ms(bc)}, mesh ${ms(mc)}`);
