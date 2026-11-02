/**
 * Co-op logic check (no browser): friends vs couple trips over the local transport, who is whose partner, the
 * hand each walker holds out, and keeping in step while walking hand in hand. Run: npx tsx scripts/coop-check.ts
 */
Object.assign(globalThis, { location: { search: '?net=local' }, window: globalThis });
const { Coop } = await import('../src/net/coop');
const { handReach, followStep, HAND_GAP } = await import('../src/game/couple');

let fails = 0;
const ok = (c: boolean, msg: string) => { console.log(`${c ? 'ok  ' : 'FAIL'} ${msg}`); if (!c) fails++; };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (f: () => boolean, ms = 4000) => { const t = Date.now(); while (!f() && Date.now() - t < ms) await wait(20); return f(); };

// ---- protocol: the leader's choice reaches everyone, partners are leader + seat 1B
const code = 'ACDEFG';
const me = (name: string) => ({ name, color: 0xe9573f, wear: [] });
const host = await Coop.open(code, true, 'tokyo', me('Ana'));
const g1 = await Coop.open(code, false, '', me('Bo'));
ok(await until(() => host.peers.size === 1 && g1.peers.size === 1 && !!g1.seat), 'host and guest find each other');
ok(g1.bond === 'friend' && !g1.partner && !host.partner, 'default trip is friends, no partner');
host.setBond('lover');
ok(await until(() => g1.bond === 'lover'), 'guest takes the leader\'s couple choice');
ok(g1.seat === '1B' && host.partner?.name === 'Bo' && g1.partner?.name === 'Ana', 'leader and seat 1B are partners');
g1.setBond('friend');
ok(g1.bond === 'lover', 'a guest cannot change the bond');
const g2 = await Coop.open(code, false, '', me('Cy'));
ok(await until(() => g2.peers.size === 2 && !!g2.seat && g2.bond === 'lover'), 'third traveller joins the couple\'s trip');
await until(() => [...host.peers.values()].every((p) => p.seat));
console.log('  seats', g1.seat, g2.seat, [...host.peers.values()].map((p) => p.name + ':' + p.seat).join(' '));
ok(g2.seat !== '1B' && !g2.partner && host.partner?.name === 'Bo', 'a third traveller is a friend, not a partner');
const got: string[] = [];
g1.onEvent = (_p, e) => got.push(e.k);
host.sendEvent({ k: 'hand', on: true });
host.sendEvent({ k: 'room', hotel: 'h', room: 'r' });
ok(await until(() => got.length === 2), 'partner events arrive');
host.setBond('friend');
ok(await until(() => g1.bond === 'friend' && !g1.partner), 'back to friends: no partner');
host.leave(); g1.leave(); g2.leave();

// ---- hands: each reaches towards the other, inside an arm's reach of the shoulder
const SH = [0.3, 0.906], ARM = 0.1875 + 0.26;
for (const [f, side] of [[0, 1], [Math.PI / 2, 1], [Math.PI, 0], [-2.3, 0]] as const) {
  // partner to the walker's +x side in its own frame: world offset of local (gap, 0) rotated by facing
  const sgn = side ? 1 : -1;
  const bx = sgn * HAND_GAP * Math.cos(f), bz = -sgn * HAND_GAP * Math.sin(f);
  const h = handReach(0, 0, f, bx, bz);
  const d = Math.hypot(Math.abs(h.x) - SH[0], h.y - SH[1], h.z);
  ok(h.side === side && Math.sign(h.x) === sgn && d < ARM, `facing ${f.toFixed(2)}: reaches with side ${h.side}, ${d.toFixed(2)} m from the shoulder`);
}

// ---- keeping in step: the leader walks a curve, the follower stays beside them; both stopping settles
const dt = 1 / 60;
const lead = { x: 0, z: 0, facing: 0, speed: 0 }, fol = { x: 1.6, z: -0.6 };
let on = false, maxGap = 0, frames = 0;
for (let t = 0; t < 12; t += dt) {
  const walking = t < 9;
  lead.speed = walking ? 3.2 : 0;
  lead.facing += walking ? dt * 0.35 : 0;
  lead.x += Math.sin(lead.facing) * lead.speed * dt; lead.z += Math.cos(lead.facing) * lead.speed * dt;
  const st = followStep(on, fol, lead, 4.8, 3.2);
  on = st.on;
  fol.x += st.dx * st.speed * dt; fol.z += st.dz * st.speed * dt;
  const gap = Math.hypot(lead.x - fol.x, lead.z - fol.z);
  if (t > 1.5) maxGap = Math.max(maxGap, gap);
  if (t > 10.5 && st.speed > 0) frames++;
}
ok(maxGap < 1.5, `follower keeps within ${maxGap.toFixed(2)} m while walking (hands hold under 3 m)`);
ok(frames === 0, 'follower settles once the leader stops');

// both clients run the follow at once (nobody steering): they must meet and stop, not chase each other round
const A = { x: 0, z: 0, facing: 0, speed: 0 }, B = { x: 1.3, z: 0.9, facing: 2, speed: 0 };
let onA = false, onB = false, moving = 0;
for (let t = 0; t < 6; t += dt) {
  const sa = followStep(onA, A, B, 4.8, 3.2), sb = followStep(onB, B, A, 4.8, 3.2);
  onA = sa.on; onB = sb.on;
  A.x += sa.dx * sa.speed * dt; A.z += sa.dz * sa.speed * dt; A.speed = sa.speed;
  B.x += sb.dx * sb.speed * dt; B.z += sb.dz * sb.speed * dt; B.speed = sb.speed;
  if (sa.speed) A.facing = Math.atan2(sa.dx, sa.dz);
  if (sb.speed) B.facing = Math.atan2(sb.dx, sb.dz);
  if (t > 4 && (sa.speed || sb.speed)) moving++;
}
const g = Math.hypot(A.x - B.x, A.z - B.z);
ok(moving === 0 && g < 1.4 && g > 0.5, `two idle followers settle ${g.toFixed(2)} m apart`);

console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
