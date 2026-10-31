import { AMALFI, ISTANBUL, perCity } from './cityId';
import { Grid, rng } from './grid';
import { Palette } from './palette';
import { PART, PART_COUNT, CHAR_SCALE } from './charparts';
import { refinePerson, type Ink } from './persondetail';

/** Procedural voxel people and cats. Each voxel carries a part id so the shader can animate limbs. */

export { PART, PART_COUNT, CHAR_SCALE, CHAR_FINE, PROP_SCALE } from './charparts';
export const CAT_SCALE = 0.05;

export interface CharModel {
  grid: Grid;
  parts: Uint8Array;
  pal: Palette;
  scale: number;
  origin: [number, number, number];
  pivots: [number, number, number][];
  /**
   * Joint caps: extra voxels owned by the lower limb that sit hidden inside the upper one at rest and
   * swing out to fill the wedge that opens on the outside of a bent knee or elbow.
   */
  caps?: { grid: Grid; parts: Uint8Array };
  /**
   * Finer voxels carried by the body (the phone in the right hand, its own part, shrunk to nothing by the
   * pose while it is put away), meshed at PROP_SCALE from `origin`.
   */
  prop?: { grid: Grid; parts: Uint8Array; origin: [number, number, number] };
  /**
   * People only: the look this body was built from. Close up a person is drawn with the finer body that
   * buildFinePerson makes from it (same skeleton, half-size voxels); this model is their stand-in further away.
   */
  look?: Look;
}

export interface Look {
  skin: number;
  hair: number;
  hairStyle: 'short' | 'bob' | 'bun' | 'long' | 'bald' | 'spiky' | 'ponytail';
  top: number;
  topStyle: 'tee' | 'jacket' | 'apron' | 'yukata' | 'suit' | 'sailor' | 'vest' | 'cardigan' | 'happi';
  accent: number;
  bottom: number;
  skirt?: boolean;
  /** Knee-length shorts (ignored with a skirt). */
  shorts?: boolean;
  shoes: number;
  hat?: 'cap' | 'headband' | 'chef' | 'straw' | 'bucket' | 'beanie' | 'scarf' | 'none';
  hatColor?: number;
  backpack?: number;
  glasses?: boolean;
  charm?: boolean;
  /** A simit seller's tray of rings balanced on the head. */
  tray?: boolean;
  /** A full moustache, Istanbul's classic. */
  moustache?: boolean;
}

const SKINS = [0xf6d2b4, 0xeec39f, 0xe0ac86, 0xc98f6a, 0xa8714f, 0xf9dcc4];
const HAIRS = [0x1d1a1c, 0x2a1d17, 0x3b2a20, 0x5a3b26, 0x8a5a36, 0x6b6b70, 0xb9b6b0, 0x1d1a1c, 0x2a1d17];
const TOPS = [0xe8e4da, 0x3f6e9a, 0xd9534a, 0x4f9a6b, 0xf2c74a, 0x8a6fb0, 0x2b3a62, 0xf08ac0, 0x6a8a9a, 0xd98a5a, 0x2f2f35, 0xf4f1ea];
const BOTTOMS = [0x2b3a62, 0x3a3a40, 0x5a4a3a, 0x7a8a9a, 0x2f2f35, 0x8a6a4a, 0x4a5a3a];
const SHOES = [0x2a2a2e, 0xf2efe7, 0x6b4630, 0xc9463d, 0x3f6e9a];

export function randomLook(seed: number): Look {
  const r = rng(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const hairStyles: Look['hairStyle'][] = ['short', 'short', 'bob', 'bun', 'long', 'spiky', 'ponytail', 'bald'];
  // a summer coast dresses lighter than a Tokyo street: tees and linen, shorts, straw hats and sunglasses
  const topStyles: Look['topStyle'][] = perCity({ tokyo: ['tee', 'tee', 'jacket', 'jacket', 'yukata', 'suit', 'sailor', 'vest', 'cardigan'], amalfi: ['tee', 'tee', 'tee', 'vest', 'jacket', 'cardigan', 'suit', 'tee'], istanbul: ['tee', 'tee', 'jacket', 'jacket', 'vest', 'cardigan', 'suit', 'tee', 'jacket'] });
  const topStyle = pick(topStyles);
  const hats: Look['hat'][] = perCity({ tokyo: ['none', 'none', 'none', 'none', 'cap', 'beanie', 'bucket', 'straw'], amalfi: ['none', 'none', 'none', 'none', 'cap', 'straw', 'straw', 'bucket'], istanbul: ['none', 'none', 'none', 'none', 'none', 'cap', 'beanie', 'cap'] });
  const look: Look = {
    skin: pick(SKINS), hair: pick(HAIRS), hairStyle: pick(hairStyles), top: pick(TOPS), topStyle,
    accent: pick(TOPS), bottom: pick(BOTTOMS), skirt: r() < 0.25, shoes: pick(SHOES), shorts: r() < (AMALFI ? 0.4 : 0.12),
    hat: pick(hats), hatColor: pick(TOPS), backpack: r() < 0.15 ? pick(TOPS) : undefined, glasses: r() < (AMALFI ? 0.35 : 0.15),
  };
  if (ISTANBUL) {
    // headscarves in soft prints and plain colours, long skirts or trousers under them; moustaches on the men
    look.shorts = r() < 0.05;
    if (r() < 0.24) { look.hat = 'scarf'; look.hatColor = SCARVES[Math.floor(r() * SCARVES.length)]; look.hairStyle = 'short'; look.skirt = r() < 0.6; }
    else if (!look.skirt && r() < 0.3) look.moustache = true;
  }
  return look;
}

const SCARVES = [0xc9a9a6, 0x7a8fa8, 0xe8dcc8, 0x9a6a7a, 0x5a6e5a, 0xd8b88a, 0x3e4a6a, 0xb86a5a, 0xf0e6ea, 0x8a7aa8];

/** A person as seen from a little way off: chunky voxels, cheap to build and draw (see CharModel.look). */
export function buildPerson(look: Look): CharModel {
  return coarsePerson(look).model;
}

/** The same person close up: twice the voxel resolution and finished in finer detail (world/persondetail.ts). */
export function buildFinePerson(look: Look): CharModel {
  const { model, ink } = coarsePerson(look);
  return refinePerson(model, look, ink);
}

function coarsePerson(look: Look): { model: CharModel; ink: Ink } {
  const W = 10, H = 25, D = 8;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D);
  const pal = new Palette();
  const C = (hex: number, vary = 0.04) => pal.add(hex, { vary });
  const set = (x: number, y: number, z: number, c: number, part: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return;
    grid.set(x, y, z, c);
    parts[y * W * D + z * W + x] = part;
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, part: number) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, c, part);
  };
  const skin = C(look.skin, 0.02), hair = C(look.hair, 0.06), top = C(look.top), accent = C(look.accent), bottom = C(look.bottom), shoes = C(look.shoes, 0.03);
  const dark = C(0x1d1a1c, 0.01), white = C(0xf8f6f0, 0.01), blush = C(0xf09a90, 0.02), mouth = C(0xb0584a, 0.02);

  // legs: everything below the waist hangs off the thighs and shins, so it moves with them instead of
  // sticking out of the hips as a stiff box
  const leg = (y0: number, y1: number, c: number) => { box(2, y0, 2, 4, y1, 5, c, PART.legL); box(5, y0, 2, 7, y1, 5, c, PART.legR); };
  if (look.topStyle === 'yukata') leg(2, 7, top); // the robe falls to the ankles
  else if (look.skirt) {
    // a knee-length skirt, flaring a single voxel at the hem
    leg(2, 3, skin); leg(4, 7, bottom);
    box(1, 4, 2, 1, 4, 5, bottom, PART.legL); box(8, 4, 2, 8, 4, 5, bottom, PART.legR);
  } else if (look.shorts) { leg(2, 4, skin); leg(5, 7, bottom); }
  else leg(2, 7, bottom);
  box(2, 0, 2, 4, 1, 6, shoes, PART.legL); box(5, 0, 2, 7, 1, 6, shoes, PART.legR);

  // torso
  box(2, 8, 2, 7, 14, 5, top, PART.body);
  // arms
  const sleeve = look.topStyle === 'tee' || look.topStyle === 'apron' || look.topStyle === 'vest' ? skin : top;
  box(0, 8, 3, 1, 9, 4, skin, PART.armL); box(8, 8, 3, 9, 9, 4, skin, PART.armR);
  box(0, 10, 3, 1, 12, 4, sleeve, PART.armL); box(8, 10, 3, 9, 12, 4, sleeve, PART.armR);
  box(0, 13, 3, 1, 14, 4, top, PART.armL); box(8, 13, 3, 9, 14, 4, top, PART.armR);

  switch (look.topStyle) {
    case 'jacket':
      box(2, 8, 2, 7, 14, 5, accent, PART.body);
      box(4, 8, 5, 5, 14, 5, top, PART.body);
      box(0, 10, 3, 1, 14, 4, accent, PART.armL); box(8, 10, 3, 9, 14, 4, accent, PART.armR);
      break;
    case 'suit': {
      const suit = C(0x2b3346), shirt = white, tie = C(0xb3302a);
      box(2, 8, 2, 7, 14, 5, suit, PART.body);
      box(4, 10, 5, 5, 14, 5, shirt, PART.body);
      box(4, 9, 5, 4, 13, 5, tie, PART.body);
      box(0, 10, 3, 1, 14, 4, suit, PART.armL); box(8, 10, 3, 9, 14, 4, suit, PART.armR);
      box(2, 2, 2, 4, 7, 5, suit, PART.legL); box(5, 2, 2, 7, 7, 5, suit, PART.legR);
      break;
    }
    case 'sailor': {
      const navy = C(0x23345e), red = C(0xc8372d);
      box(2, 8, 2, 7, 14, 5, white, PART.body);
      box(2, 13, 1, 7, 14, 2, navy, PART.body);
      box(3, 11, 5, 6, 14, 5, navy, PART.body);
      box(4, 11, 5, 5, 12, 5, red, PART.body);
      break;
    }
    case 'apron':
      // bib on the chest, the skirt of the apron in front of each thigh so it swings with the stride
      box(2, 8, 5, 7, 12, 6, accent, PART.body);
      box(3, 13, 5, 6, 13, 5, accent, PART.body);
      box(2, 4, 6, 4, 7, 6, accent, PART.legL); box(5, 4, 6, 7, 7, 6, accent, PART.legR);
      break;
    case 'yukata': {
      const obi = accent;
      box(2, 8, 2, 7, 14, 5, top, PART.body);
      box(2, 9, 2, 7, 10, 6, obi, PART.body);
      box(4, 11, 5, 5, 14, 5, C(0xf2efe7), PART.body);
      box(0, 10, 3, 1, 14, 4, top, PART.armL); box(8, 10, 3, 9, 14, 4, top, PART.armR);
      box(0, 9, 2, 1, 11, 5, top, PART.armL); box(8, 9, 2, 9, 11, 5, top, PART.armR);
      break;
    }
    case 'happi': {
      box(2, 8, 2, 7, 14, 5, accent, PART.body);
      box(2, 8, 5, 7, 8, 5, white, PART.body);
      box(3, 9, 5, 3, 14, 5, white, PART.body); box(6, 9, 5, 6, 14, 5, white, PART.body);
      box(0, 10, 3, 1, 14, 4, accent, PART.armL); box(8, 10, 3, 9, 14, 4, accent, PART.armR);
      box(0, 10, 3, 1, 10, 4, white, PART.armL); box(8, 10, 3, 9, 10, 4, white, PART.armR);
      break;
    }
    case 'vest':
      box(2, 8, 2, 7, 14, 2, accent, PART.body);
      box(2, 8, 5, 3, 14, 5, accent, PART.body); box(6, 8, 5, 7, 14, 5, accent, PART.body);
      box(2, 8, 3, 2, 14, 4, accent, PART.body); box(7, 8, 3, 7, 14, 4, accent, PART.body);
      break;
    case 'cardigan':
      box(2, 8, 2, 7, 14, 5, accent, PART.body);
      box(4, 9, 5, 5, 14, 5, top, PART.body);
      for (let y = 9; y <= 13; y += 2) set(3, y, 5, white, PART.body);
      box(0, 10, 3, 1, 14, 4, accent, PART.armL); box(8, 10, 3, 9, 14, 4, accent, PART.armR);
      break;
    default:
      if (look.accent !== look.top) box(2, 12, 5, 7, 12, 5, accent, PART.body);
  }

  // head
  box(2, 15, 1, 7, 21, 6, skin, PART.head);
  set(1, 18, 3, skin, PART.head); set(8, 18, 3, skin, PART.head);
  // face
  set(3, 18, 6, dark, PART.head); set(6, 18, 6, dark, PART.head);
  set(3, 19, 6, look.glasses ? dark : skin, PART.head); set(6, 19, 6, look.glasses ? dark : skin, PART.head);
  if (look.glasses) { box(2, 18, 6, 7, 18, 6, dark, PART.head); set(3, 18, 6, white, PART.head); set(6, 18, 6, white, PART.head); }
  set(2, 17, 6, blush, PART.head); set(7, 17, 6, blush, PART.head);
  set(4, 16, 6, mouth, PART.head); set(5, 16, 6, mouth, PART.head);
  const moustache = look.moustache ? C(look.hair === 0xb9b6b0 || look.hair === 0x6b6b70 ? look.hair : 0x1d1a1c) : -1;
  if (look.moustache) box(3, 17, 6, 6, 17, 6, moustache, PART.head);

  // hair
  const hs = look.hairStyle;
  if (hs !== 'bald') {
    box(2, 21, 1, 7, 22, 6, hair, PART.head);
    box(2, 16, 1, 7, 21, 1, hair, PART.head);
    box(2, 18, 1, 2, 21, 4, hair, PART.head); box(7, 18, 1, 7, 21, 4, hair, PART.head);
    box(2, 21, 6, 7, 21, 6, hair, PART.head);
    if (hs === 'bob' || hs === 'long') {
      box(1, 16, 1, 1, 21, 5, hair, PART.head); box(8, 16, 1, 8, 21, 5, hair, PART.head);
      box(2, 20, 6, 7, 20, 6, hair, PART.head);
      if (hs === 'long') box(2, 11, 0, 7, 16, 1, hair, PART.head);
    }
    if (hs === 'bun') box(4, 23, 2, 5, 24, 3, hair, PART.head);
    if (hs === 'ponytail') { box(4, 17, 0, 5, 20, 0, hair, PART.head); box(4, 15, 0, 5, 16, 0, hair, PART.head); }
    if (hs === 'spiky') { set(3, 23, 3, hair, PART.head); set(5, 23, 4, hair, PART.head); set(6, 23, 2, hair, PART.head); set(2, 22, 5, hair, PART.head); }
  } else {
    box(2, 18, 1, 2, 19, 3, C(0xb9b6b0), PART.head); box(7, 18, 1, 7, 19, 3, C(0xb9b6b0), PART.head);
  }

  // hats
  const hc = C(look.hatColor ?? 0xf2efe7);
  switch (look.hat) {
    case 'cap': box(2, 22, 1, 7, 23, 6, hc, PART.head); box(2, 22, 7, 7, 22, 7, hc, PART.head); break;
    case 'beanie': box(2, 21, 1, 7, 23, 6, hc, PART.head); box(1, 21, 1, 8, 21, 6, hc, PART.head); break;
    case 'bucket': box(1, 22, 0, 8, 22, 7, hc, PART.head); box(2, 23, 1, 7, 24, 6, hc, PART.head); break;
    case 'straw': { const st = C(0xe6c98a, 0.08); box(0, 22, 0, 9, 22, 7, st, PART.head); box(2, 23, 1, 7, 24, 6, st, PART.head); box(2, 23, 1, 7, 23, 6, C(0xc8372d), PART.head); break; }
    case 'scarf': // a headscarf wrapped round the head and under the chin, its ends over the shoulders behind
      box(2, 23, 1, 7, 23, 6, hc, PART.head);
      box(1, 15, 1, 1, 22, 6, hc, PART.head); box(8, 15, 1, 8, 22, 6, hc, PART.head);
      box(2, 15, 0, 7, 22, 0, hc, PART.head);
      box(2, 21, 6, 7, 22, 6, hc, PART.head);
      box(2, 15, 6, 2, 16, 6, hc, PART.head); box(7, 15, 6, 7, 16, 6, hc, PART.head);
      break;
    case 'chef': box(2, 21, 1, 7, 24, 6, white, PART.head); box(1, 23, 0, 8, 24, 7, white, PART.head); break;
    case 'headband': { const hb = C(look.hatColor ?? 0xf2efe7); box(2, 20, 1, 7, 20, 6, hb, PART.head); box(1, 20, 1, 1, 20, 6, hb, PART.head); box(8, 20, 1, 8, 20, 6, hb, PART.head); set(4, 20, 0, hb, PART.head); set(4, 19, 0, hb, PART.head); set(5, 18, 0, hb, PART.head); break; }
  }
  if (look.tray) {
    // a round wooden tray on a cloth pad, stacked with sesame rings
    const wood = C(0x8a5a36, 0.05), simit = C(0xb5652e, 0.08), sesame = C(0xe2c78e, 0.06);
    box(1, 23, 0, 8, 23, 7, wood, PART.head); box(0, 23, 1, 9, 23, 6, wood, PART.head);
    for (let z = 0; z < 8; z++) for (let x = 0; x < 10; x++) {
      if ((x === 0 || x === 9) && (z === 0 || z === 7)) continue;
      const ring = (x + z * 3) % 4;
      if (ring === 0) continue; // the holes of the rings
      set(x, 24, z, ring === 2 ? sesame : simit, PART.head);
    }
  }
  if (look.backpack !== undefined) {
    const bp = C(look.backpack);
    box(3, 8, 0, 6, 13, 1, bp, PART.body);
    box(3, 13, 1, 6, 13, 1, C(0x5a3a28), PART.body);
    if (look.charm) { set(6, 9, 0, C(0xd8372b), PART.body); set(6, 8, 0, C(0xd8372b), PART.body); }
  }

  // split the limbs at the knees and elbows, and the clothes below the waist off the torso
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
    const i = y * W * D + z * W + x;
    if (!grid.get(x, y, z)) continue;
    const pt = parts[i];
    if (pt === PART.body && y < 8) parts[i] = PART.hips;
    else if (pt === PART.legL && y <= 3) parts[i] = PART.shinL;
    else if (pt === PART.legR && y <= 3) parts[i] = PART.shinR;
    else if (pt === PART.armL && y <= 11) parts[i] = PART.foreL;
    else if (pt === PART.armR && y <= 11) parts[i] = PART.foreR;
  }

  // the lower limb carries a copy of the row above its joint, as deep as half the limb (2 rows at the
  // knee, 1 at the elbow), so the outside of a bend stays closed at any angle
  const caps = { grid: new Grid(W, H, D), parts: new Uint8Array(W * H * D) };
  const cap = (y: number, from: number, to: number, rows: number) => {
    for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) {
      const i = y * W * D + z * W + x;
      const c = grid.get(x, y, z);
      if (!c || parts[i] !== from) continue;
      // a cap row must stay hidden inside the limb above at rest
      if (rows > 1 && (parts[i + W * D] !== from || !grid.get(x, y + 1, z))) continue;
      for (let k = 0; k < rows; k++) { caps.grid.set(x, y + k, z, c); caps.parts[i + k * W * D] = to; }
    }
  };
  cap(4, PART.legL, PART.shinL, 2); cap(4, PART.legR, PART.shinR, 2);
  cap(12, PART.armL, PART.foreL, 1); cap(12, PART.armR, PART.foreR, 1);

  const s = CHAR_SCALE;
  const ox = -W / 2 * s, oz = -4 * s;
  const pivots: [number, number, number][] = [
    [0, 8 * s, oz + 4 * s], // torso bends at the waist
    [0, 15 * s, oz + 4 * s], // head at the neck
    [ox + 1 * s, 14.5 * s, oz + 4 * s], // left arm (x 0..1) at the shoulder
    [ox + 9 * s, 14.5 * s, oz + 4 * s], // right arm
    [ox + 3.5 * s, 8 * s, oz + 4 * s], // left thigh at the hip
    [ox + 6.5 * s, 8 * s, oz + 4 * s],
    [0, 0, 0],
    [0, 8 * s, oz + 4 * s], // hips
    [ox + 3.5 * s, 4 * s, oz + 4 * s], // left knee
    [ox + 6.5 * s, 4 * s, oz + 4 * s],
    [ox + 1 * s, 12 * s, oz + 4 * s], // left elbow
    [ox + 9 * s, 12 * s, oz + 4 * s],
    [ox + 9 * s, 8.5 * s, oz + 4.5 * s], // phone: tucked into the right fist while it is put away
  ];
  const coarse: CharModel = { grid, parts, pal, scale: s, origin: [ox, 0, oz], pivots, caps, look, prop: phone(pal, look, [ox + 6.75 * s, 6.4 * s, oz + 5.02 * s]) };
  return { model: coarse, ink: { skin, hair, top, accent, bottom, shoes, dark, white, blush, mouth, moustache } };
}

const PHONE_CASES = [0x26262c, 0xe9e5dc, 0xd9748f, 0x4f7fae, 0xe8b84a, 0x5f9a78, 0x8a6fb0];

/**
 * A phone on the inside of the right fist, reaching across towards the left one: a coloured case at the back
 * and a lit screen in a dark bezel at the front, a touch big (10 x 17.5 cm) so it reads next to chunky hands.
 * When the forearms come up to the chest, it sits between the hands with the screen turned up to the eyes.
 */
function phone(pal: Palette, look: Look, origin: [number, number, number]): NonNullable<CharModel['prop']> {
  const W = 4, H = 7, D = 2;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D).fill(PART.phone);
  const cs = pal.add(PHONE_CASES[(look.skin ^ look.top ^ look.hair) % PHONE_CASES.length], { vary: 0.02 });
  const bezel = pal.add(0x17171b, { vary: 0.01 });
  const screen = pal.add(0xbfe2ff, { vary: 0.05, emit: 0.55 });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    grid.set(x, y, 0, cs);
    grid.set(x, y, 1, y === 0 || y === H - 1 ? bezel : screen);
  }
  return { grid, parts, origin };
}

export function buildCat(seed: number): CharModel {
  const r = rng(seed);
  const W = 6, H = 8, D = 14;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D);
  const pal = new Palette();
  const coats = [[0x2a2628, 0x2a2628], [0xf2efe7, 0xe0a050], [0xe0a050, 0xf2efe7], [0x9a9aa0, 0x6a6a70], [0xf2efe7, 0x2a2628]];
  const [main, spot] = coats[Math.floor(r() * coats.length)];
  const cm = pal.add(main, { vary: 0.04 }), cs = pal.add(spot, { vary: 0.04 });
  const eye = pal.add(0xc8e04a, { vary: 0.01 }), nose = pal.add(0xf09aa0, { vary: 0.01 }), dark = pal.add(0x1d1a1c, { vary: 0.01 });
  const set = (x: number, y: number, z: number, c: number, part: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return;
    grid.set(x, y, z, c); parts[y * W * D + z * W + x] = part;
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, part: number) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, c, part);
  };
  // legs
  box(1, 0, 3, 1, 2, 3, cm, PART.legL); box(4, 0, 3, 4, 2, 3, cm, PART.legR);
  box(1, 0, 8, 1, 2, 8, cm, PART.armL); box(4, 0, 8, 4, 2, 8, cm, PART.armR);
  // body
  box(1, 3, 2, 4, 5, 9, cm, PART.body);
  box(2, 5, 4, 3, 5, 7, cs, PART.body);
  // head
  box(1, 4, 10, 4, 7, 13, cm, PART.head);
  set(1, 8, 11, cm, PART.head); set(4, 8, 11, cm, PART.head);
  set(1, 6, 13, eye, PART.head); set(4, 6, 13, eye, PART.head);
  set(2, 5, 13, nose, PART.head); set(3, 5, 13, dark, PART.head);
  if (r() < 0.5) set(2, 7, 12, cs, PART.head);
  // tail
  box(2, 5, 0, 3, 5, 1, cm, PART.tail); box(2, 6, 0, 3, 7, 0, cs, PART.tail);
  const s = CAT_SCALE;
  const ox = -W / 2 * s, oz = -D / 2 * s;
  const pivots: [number, number, number][] = [
    [0, 0, 0],
    [0, 5 * s, oz + 10 * s],
    [ox + 1.5 * s, 3 * s, oz + 8.5 * s],
    [ox + 4.5 * s, 3 * s, oz + 8.5 * s],
    [ox + 1.5 * s, 3 * s, oz + 3.5 * s],
    [ox + 4.5 * s, 3 * s, oz + 3.5 * s],
    [0, 5.5 * s, oz + 2 * s],
    [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  ];
  return { grid, parts, pal, scale: s, origin: [ox, 0, oz], pivots };
}

/** A small dog on the cat skeleton: shiba, black-and-tan, white or brown, with a curled or straight tail. */
export function buildDog(seed: number): CharModel {
  const r = rng(seed);
  const W = 6, H = 10, D = 15;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D);
  const pal = new Palette();
  const coats = [[0xd98a45, 0xf6efe2], [0x2a2628, 0xc98f5a], [0xf4f1ea, 0xf4f1ea], [0x8a5a36, 0xd9b48a], [0xe0c49a, 0xf6efe2]];
  const [main, belly] = coats[Math.floor(r() * coats.length)];
  const cm = pal.add(main, { vary: 0.04 }), cb = pal.add(belly, { vary: 0.04 });
  const dark = pal.add(0x1d1a1c, { vary: 0.01 }), collar = pal.add([0xd8372b, 0x3f6e9a, 0x4f9a6b, 0xf2c74a][Math.floor(r() * 4)], { vary: 0.01 });
  const set = (x: number, y: number, z: number, c: number, part: number) => {
    if (x < 0 || y < 0 || z < 0 || x >= W || y >= H || z >= D) return;
    grid.set(x, y, z, c); parts[y * W * D + z * W + x] = part;
  };
  const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: number, part: number) => {
    for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) set(x, y, z, c, part);
  };
  // legs (a little longer than a cat's), white socks on the pale coats
  const sock = main === 0xd98a45 || main === 0xe0c49a ? cb : cm;
  for (const [x, z, part] of [[1, 3, PART.legL], [4, 3, PART.legR], [1, 9, PART.armL], [4, 9, PART.armR]] as const) {
    box(x, 0, z, x, 3, z, cm, part); set(x, 0, z, sock, part);
  }
  // body with a pale belly
  box(1, 4, 2, 4, 6, 10, cm, PART.body);
  box(2, 4, 3, 3, 4, 9, cb, PART.body);
  // collar, head, snout, pointed ears
  box(1, 7, 10, 4, 7, 10, collar, PART.head);
  box(1, 6, 11, 4, 9, 13, cm, PART.head);
  box(2, 6, 14, 3, 7, 14, cb, PART.head);
  set(2, 7, 14, dark, PART.head); set(3, 7, 14, dark, PART.head);
  set(1, 8, 13, dark, PART.head); set(4, 8, 13, dark, PART.head);
  if (r() < 0.6) { set(1, 9, 12, cm, PART.head); set(4, 9, 12, cm, PART.head); } // ears up
  else { box(0, 7, 11, 0, 8, 12, cm, PART.head); box(5, 7, 11, 5, 8, 12, cm, PART.head); } // floppy
  // tail: curled over the back or straight out
  if (r() < 0.55) { box(2, 7, 1, 3, 8, 2, cm, PART.tail); set(2, 9, 2, cb, PART.tail); }
  else box(2, 6, 0, 3, 6, 1, cm, PART.tail);
  const s = 0.0625; // a touch bigger than a cat
  const ox = -W / 2 * s, oz = -D / 2 * s;
  const pivots: [number, number, number][] = [
    [0, 0, 0],
    [0, 7 * s, oz + 11 * s],
    [ox + 1.5 * s, 4 * s, oz + 9.5 * s],
    [ox + 4.5 * s, 4 * s, oz + 9.5 * s],
    [ox + 1.5 * s, 4 * s, oz + 3.5 * s],
    [ox + 4.5 * s, 4 * s, oz + 3.5 * s],
    [0, 6.5 * s, oz + 2 * s],
    [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0], [0, 0, 0],
  ];
  return { grid, parts, pal, scale: s, origin: [ox, 0, oz], pivots };
}

/**
 * A rigid model (a bicycle, a scooter, a boat) for the character renderer, so it is lit by the same
 * light map as the people on it. `alongX` models (props drawn side-on, front at +x) are turned to face +z.
 */
export function rigidModel(src: Grid, pal: Palette, scale: number, alongX = false): CharModel {
  const W = alongX ? src.sz : src.sx, H = src.sy, D = alongX ? src.sx : src.sz;
  const grid = new Grid(W, H, D);
  for (let y = 0; y < H; y++) for (let z = 0; z < D; z++) for (let x = 0; x < W; x++) grid.set(x, y, z, alongX ? src.get(z, y, x) : src.get(x, y, z));
  const pivots: [number, number, number][] = Array.from({ length: PART_COUNT }, () => [0, 0, 0]);
  return { grid, parts: new Uint8Array(W * H * D), pal, scale, origin: [-W / 2 * scale, 0, -D / 2 * scale], pivots };
}
