// Bodies for the crowd's rides: bicycles and delivery scooters (the street props, drawn by the character
// renderer so they move and are lit like people), the swan boats on the park pond and Amalfi's gozzi.
import { Grid, rng } from './grid';
import { Palette } from './palette';
import { bicycle, scooter, makePropColors } from './props';
import { CharModel, rigidModel } from './characters';

const FRAMES = [0xc9463d, 0x3f6e9a, 0xf2efe7, 0x2f2f35, 0x4f9a6b, 0xf2c74a, 0xe8a0b8];
const COMPANIES = [0xd8372b, 0x3f9a5b, 0x2b6cb0, 0xf2a03a];

/** A city bicycle (front basket, step-through frame) at the people's voxel scale. */
export function bikeModel(seed: number): CharModel {
  const pal = new Palette();
  const c = makePropColors(pal);
  const frame = pal.add(FRAMES[Math.floor(rng(seed)() * FRAMES.length)], { vary: 0.03 });
  return rigidModel(bicycle({ pal, c }, frame).grid, pal, 0.075, true);
}

/** A delivery scooter with its box on the back, in a delivery company's colour. */
export function scooterModel(seed: number): CharModel {
  const pal = new Palette();
  const c = makePropColors(pal);
  const body = pal.add(COMPANIES[Math.floor(rng(seed)() * COMPANIES.length)], { vary: 0.03 });
  return rigidModel(scooter({ pal, c }, body).grid, pal, 0.075, true);
}

/** A pedal swan boat for two, 2.5 m long: white hull, raised wings, a long neck and an orange beak. */
export function swanBoatModel(seed: number): CharModel {
  const pal = new Palette();
  const r = rng(seed);
  const white = pal.add(0xf4f1ea, { vary: 0.03 }), shade = pal.add(0xd9d4c8, { vary: 0.03 });
  const beak = pal.add(0xf08a2a, { vary: 0.02 }), black = pal.add(0x1d1a1c, { vary: 0.01 });
  const seat = pal.add([0x3f6e9a, 0xd9534a, 0x4f9a6b, 0xf2c74a][Math.floor(r() * 4)], { vary: 0.03 });
  const W = 13, H = 14, D = 21;
  const g = new Grid(W, H, D);
  const cx = (W - 1) / 2;
  for (let z = 0; z < 18; z++) {
    // rounded plan: narrow at the stern, widest at the middle, a pointed bow
    const t = z / 17;
    const hw = 1.5 + 4.6 * Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.5) * (t > 0.8 ? 1 - (t - 0.8) * 3.2 : 1);
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - cx);
      if (dx > hw) continue;
      for (let y = 0; y <= 4; y++) {
        // the hull narrows towards the keel
        if (dx > hw - (y === 0 ? 1.5 : y === 1 ? 0.6 : 0)) continue;
        const rim = y === 4 || dx > hw - 1;
        const well = z >= 3 && z <= 13 && dx < hw - 1 && y >= 2;
        if (well && !rim) continue;
        g.set(x, y, z, y === 0 ? shade : white);
      }
    }
  }
  // the bench across the well, a footwell in front of it
  g.box(2, 2, 3, 10, 3, 5, seat);
  g.box(2, 4, 2, 10, 5, 2, seat);
  // wings folded up along the sides
  for (const x of [0, W - 1]) for (let z = 3; z <= 12; z++) for (let y = 4; y <= 5 + Math.round((z - 3) * 0.35); y++) g.set(x, y, z, (z + y) % 4 === 0 ? shade : white);
  // the neck curving up from the bow, head and beak
  for (let y = 4; y <= 11; y++) { const z = 16 + Math.round(Math.max(0, y - 8) * 0.4); g.box(5, y, z, 7, y, z + 1, white); }
  g.box(5, 11, 17, 7, 13, 19, white);
  g.box(6, 11, 20, 6, 12, 20, beak);
  g.set(5, 12, 19, black); g.set(7, 12, 19, black);
  return rigidModel(g, pal, 0.125);
}

/**
 * An Amalfi gozzo, 5 m long: a white wooden hull with a coloured band along the gunwale, a pointed stem at both ends,
 * two thwarts and an outboard motor on the transom. Bow towards +z.
 */
export function gozzoModel(seed: number): CharModel {
  const pal = new Palette();
  const r = rng(seed);
  const white = pal.add(0xf2efe8, { vary: 0.03 }), keel = pal.add(0x4a3a2e, { vary: 0.05 }), wood = pal.add(0xb08458, { vary: 0.06 });
  const band = pal.add([0x2f5d9a, 0xb83a2c, 0x2f7a5a, 0xe9c23a, 0x5aa0c8][Math.floor(r() * 5)], { vary: 0.04 });
  const motor = pal.add(0x2b2a2a, { vary: 0.03 }), cowl = pal.add(r() < 0.5 ? 0xe8e4dc : 0xd8402e, { vary: 0.03 });
  const W = 13, H = 11, D = 40;
  const g = new Grid(W, H, D);
  const cx = (W - 1) / 2;
  for (let z = 2; z < D; z++) {
    const t = (z - 2) / (D - 3);
    const half = (W / 2 - 0.5) * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08)) ** 0.6;
    for (let x = 0; x < W; x++) {
      const dx = Math.abs(x - cx);
      if (dx > half + 0.3) continue;
      const rim = dx > half - 1;
      const yb = Math.round((dx / Math.max(1, half)) * 2);
      // the stem rises at the bow
      for (let y = yb; y <= 5 + (t > 0.93 ? 2 : 0); y++) {
        if (!rim && y > 1) { if (y === 2) g.set(x, y, z, wood); continue; }
        g.set(x, y, z, y >= 4 ? band : y === 0 ? keel : white);
      }
    }
  }
  for (const z of [6, 22]) g.box(2, 3, z, W - 3, 3, z + 1, wood);
  // outboard on the transom: the cowl above, the leg down into the water
  g.box(5, 4, 0, 7, 6, 2, cowl);
  g.box(6, 1, 0, 6, 3, 1, motor);
  return rigidModel(g, pal, 0.125);
}

/**
 * A cabin of the cable car up to Monte: an eight-seat gondola, red with a white roof and bands of glass all round,
 * hanging from its grip on a bent arm. Its origin is the bottom of the cabin; the grip is 4 m above it.
 */
export const CABIN_HANG = 54 * 0.075;
export function cabinModel(seed: number): CharModel {
  const pal = new Palette();
  const r = rng(seed);
  const red = pal.add(0xd83a2a, { vary: 0.03 }), white = pal.add(0xf4f1ea, { vary: 0.02 }), glass = pal.add(0x9ab8c8, { vary: 0.03 });
  const dark = pal.add(0x2b2a2a, { vary: 0.01 }), steel = pal.add(0x8a8e90, { vary: 0.02 });
  const num = pal.add(r() < 0.5 ? 0xf2c74a : 0xf4f1ea, { vary: 0.02 });
  const W = 24, D = 26, H = 56;
  const g = new Grid(W, H, D);
  const cx = W / 2, cz = D / 2;
  for (let y = 0; y < 27; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    // rounded corners, a little narrower at the floor and under the roof
    const inset = y < 3 ? 3 - y : y > 23 ? y - 23 : 0;
    const ex = Math.abs(x + 0.5 - cx) - (cx - 1 - inset), ez = Math.abs(z + 0.5 - cz) - (cz - 1 - inset);
    if (ex > 0 || ez > 0 || (ex > -3 && ez > -3 && Math.hypot(ex + 3, ez + 3) > 3)) continue;
    const shell = ex > -1.5 || ez > -1.5 || y === 0 || y >= 25;
    if (!shell) continue;
    let v = red;
    if (y >= 25) v = white;
    else if (y >= 12 && y <= 22) v = (x % 6 === 0 || z % 6 === 0) && !(y > 13 && y < 21) ? red : glass;
    else if (y === 11 || y === 23) v = white;
    else if (y < 3) v = dark;
    if (y === 7 && z === 0 && x > 9 && x < 14) v = num;
    g.set(x, y, z, v);
  }
  // the hanger: up from the roof, bent over to the grip above the middle
  for (let y = 27; y < 52; y++) { g.set(Math.round(cx), y, Math.round(cz), steel); g.set(Math.round(cx) - 1, y, Math.round(cz), steel); }
  for (let x = Math.round(cx) - 3; x <= Math.round(cx) + 3; x++) for (let y = 52; y < H; y++) g.set(x, y, Math.round(cz), y > 53 ? dark : steel);
  return rigidModel(g, pal, 0.075);
}

/**
 * A Monte toboggan: a wicker two-seater on a pair of greased wooden runners, the way the carreiros have driven
 * visitors down the steep streets from Monte since the 1850s. Its front (the runners' curl) is at +z.
 */
export function tobogganModel(seed: number): CharModel {
  const pal = new Palette();
  const r = rng(seed);
  const wicker = pal.add(0xc9a46a, { vary: 0.06 }), wickerD = pal.add(0xa8844e, { vary: 0.05 });
  const wood = pal.add(0x6a4a30, { vary: 0.04 }), cushion = pal.add(r() < 0.5 ? 0xd83a2a : 0x2f5a8a, { vary: 0.03 });
  const W = 14, H = 14, D = 26;
  const g = new Grid(W, H, D);
  // the runners, curling up at the front
  for (const x of [2, 11]) { for (let z = 1; z < 24; z++) g.set(x, 0, z, wood); g.set(x, 1, 24, wood); g.set(x, 2, 25, wood); }
  for (const z of [4, 12, 20]) for (let x = 2; x <= 11; x++) g.set(x, 1, z, wood);
  // the basket seat: a low wicker box with a high back and arms, a cushion on the seat
  for (let y = 2; y < 13; y++) for (let z = 2; z < 22; z++) for (let x = 1; x < 13; x++) {
    const back = z < 5, side = x === 1 || x === 12, front = z === 21;
    if (y <= 3) { g.set(x, y, z, (x + z) % 2 ? wicker : wickerD); continue; }
    if (back && y < 13 || side && y < 8 || front && y < 6) g.set(x, y, z, (x + y + z) % 2 ? wicker : wickerD);
    else if (y === 4 && z < 20) g.set(x, y, z, cushion);
  }
  return rigidModel(g, pal, 0.075);
}

/**
 * A common dolphin for the bay: grey back, pale flanks and belly, a short beak, the dorsal fin and level flukes.
 * Its length runs along z, the beak at +z; the origin is under the middle of the body.
 */
export function dolphinModel(seed: number): CharModel {
  const pal = new Palette();
  const back = pal.add(seed % 2 ? 0x4a5560 : 0x56606a, { vary: 0.02 }), flank = pal.add(0x9aa4ac, { vary: 0.02 }), belly = pal.add(0xe2e4e2, { vary: 0.02 });
  const eye = pal.add(0x161616, { vary: 0 });
  const W = 16, H = 14, D = 44, g = new Grid(W, H, D), cx = W / 2, cy = 5.5;
  for (let z = 0; z < D; z++) {
    const t = z / (D - 1);
    // stout behind the head, tapering to the tail stock; the beak a narrow snout out front
    const r = t > 0.9 ? 1.6 : t > 0.82 ? 1.6 + (0.9 - t) * 38 : 4.6 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.06)), 0.7) + 0.4;
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const dx = x + 0.5 - cx, dy = (y + 0.5 - cy) * 1.15;
      if (Math.hypot(dx, dy) > r) continue;
      g.set(x, y, z, dy > r * 0.35 ? back : dy > -r * 0.3 ? flank : belly);
    }
  }
  // flukes, level and swept back, at the tail
  for (let z = 0; z < 5; z++) for (let x = 0; x < W; x++) if (Math.abs(x + 0.5 - cx) < 2 + (5 - z) * 1.3 && Math.abs(x + 0.5 - cx) > z * 0.4) g.set(x, Math.round(cy), z, back);
  // the dorsal fin, raked back
  for (let y = 0; y < 5; y++) for (let z = 20 - y; z < 26 - y * 1.4; z++) g.set(Math.floor(cx), Math.round(cy + 4.6) + y, z, back);
  // flippers and eyes
  for (let i = 0; i < 3; i++) { g.set(Math.round(cx - 4.5 - i), Math.round(cy - 2), 30 - i, flank); g.set(Math.round(cx + 3.5 + i), Math.round(cy - 2), 30 - i, flank); }
  g.set(Math.round(cx - 3), Math.round(cy + 1), 36, eye); g.set(Math.round(cx + 2), Math.round(cy + 1), 36, eye);
  return rigidModel(g, pal, 0.05);
}
