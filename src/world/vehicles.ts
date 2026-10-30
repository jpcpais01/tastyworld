// Bodies for the crowd's rides: bicycles and delivery scooters (the street props, drawn by the character
// renderer so they move and are lit like people) and the swan boats on the park pond.
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
