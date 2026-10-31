import { Grid } from './grid';
import { Palette } from './palette';
import { PART, PART_COUNT, type CharModel } from './characters';
import { AMALFI, ISTANBUL } from './cityId';

/** The birds of the city, commonest first. */
export type Species = 'pigeon' | 'sparrow' | 'crow' | 'wagtail' | 'bulbul' | 'dove' | 'kingfisher' | 'gull';

/** Bird voxels are 2.5 cm; small birds are drawn smaller still by their placement (see BIRD.size). */
export const BIRD_SCALE = 0.025;

/** Parts of a bird on the character skeleton: the body carries the head and both wings (see PARENT in the voxel shader). */
export const BIRD_PART = { body: PART.body, head: PART.head, wingL: PART.armL, wingR: PART.armR, tail: PART.tail, legs: PART.hips } as const;

type Region =
  | 'back' | 'rump' | 'flank' | 'breast' | 'belly' | 'neck' | 'head' | 'crown' | 'face' | 'throat' | 'eye' | 'beak' | 'leg'
  | 'tail' | 'tailTip' | 'wing' | 'wingTip';

interface Shape {
  /** Body length, width (odd) and height in voxels. */
  L: number; W: number; H: number;
  leg: number;
  /** Tail length, half width (0 = one voxel wide), and how far below the back it sits. */
  tail: number; tailW: number; tailDrop: number;
  /** Head cube size (odd) and how far it rises above the back. */
  head: number; neck: number;
  beak: number; beakH?: number;
  /** Each wing: span out from the body and chord at the root (fits half the back when folded). */
  span: number; chord: number;
}

/**
 * Plumage: a colour for each region. `u, v` locate the voxel in the region: along the body, across the
 * span of a wing (0 at the root), along a tail; `w` is the other axis (across, along the chord, across).
 */
type Paint = (r: Region, u: number, v: number, w: number) => number;

const SHAPES: Record<Species, Shape> = {
  pigeon: { L: 7, W: 5, H: 5, leg: 2, tail: 3, tailW: 1, tailDrop: 1, head: 3, neck: 2, beak: 1, span: 9, chord: 3 },
  dove: { L: 7, W: 5, H: 4, leg: 2, tail: 5, tailW: 1, tailDrop: 1, head: 3, neck: 1, beak: 1, span: 9, chord: 3 },
  sparrow: { L: 4, W: 3, H: 3, leg: 1, tail: 2, tailW: 0, tailDrop: 0, head: 3, neck: 1, beak: 1, span: 5, chord: 2 },
  crow: { L: 9, W: 7, H: 6, leg: 3, tail: 6, tailW: 1, tailDrop: 1, head: 5, neck: 1, beak: 3, beakH: 2, span: 13, chord: 4 },
  wagtail: { L: 5, W: 3, H: 3, leg: 2, tail: 7, tailW: 0, tailDrop: 0, head: 3, neck: 0, beak: 1, span: 6, chord: 2 },
  bulbul: { L: 5, W: 3, H: 4, leg: 1, tail: 5, tailW: 0, tailDrop: 1, head: 3, neck: 1, beak: 1, span: 6, chord: 2 },
  kingfisher: { L: 4, W: 3, H: 3, leg: 1, tail: 1, tailW: 0, tailDrop: 0, head: 3, neck: 0, beak: 3, span: 5, chord: 2 },
  gull: { L: 11, W: 7, H: 6, leg: 3, tail: 4, tailW: 1, tailDrop: 0, head: 4, neck: 1, beak: 3, beakH: 2, span: 19, chord: 4 },
};

type Colours = Partial<Record<Region, number>> & { base: number };

/** A plumage from flat region colours, with optional per-voxel touches on top. */
function flat(pal: Palette, c: Colours, touch?: (r: Region, u: number, v: number, w: number, col: (hex: number) => number) => number | undefined): Paint {
  const ids = new Map<number, number>();
  const col = (hex: number) => {
    let id = ids.get(hex);
    if (id === undefined) { id = pal.add(hex, { vary: 0.035 }); ids.set(hex, id); }
    return id;
  };
  return (r, u, v, w) => touch?.(r, u, v, w, col) ?? col(c[r] ?? c.base);
}

/** Plumages of each species: pigeons come in the street colours (blue bar, chequer, dark, red, pied). */
function plumage(sp: Species, variant: number, pal: Palette): Paint {
  // Istanbul shares the hooded crows and collared doves of the Mediterranean, but its sparrows are plain house sparrows
  const local = AMALFI || (ISTANBUL && sp !== 'sparrow') ? italian(sp, pal) : null;
  if (local) return local;
  switch (sp) {
    case 'pigeon': {
      const morphs = [
        { base: 0x8f96a3, wing: 0x9ea5b1, bar: 0x2d2f36, check: 0 },
        { base: 0x7f8593, wing: 0x8b919d, bar: 0x34363e, check: 1 },
        { base: 0x50535c, wing: 0x575a63, bar: 0x2a2b31, check: 0 },
        { base: 0xa1816a, wing: 0xb48c70, bar: 0x6e4a36, check: 0 },
        { base: 0xd9d7d1, wing: 0xe4e2dc, bar: 0x8f939c, check: 1 },
      ];
      const m = morphs[variant % morphs.length];
      return flat(pal, {
        base: m.base, back: m.wing, wing: m.wing, wingTip: 0x34363d, rump: 0xb9bec6, tail: m.base, tailTip: 0x2b2c32,
        neck: 0x4f7d6a, throat: 0x7a5a86, head: m.base, crown: m.base, face: m.base, breast: m.base,
        eye: 0xe2862a, beak: 0x3a3436, leg: 0xd46a6a,
      }, (r, u, v, w, col) => {
        // two dark bars across the folded wing, or a chequer of dark feather centres
        if (r === 'wing' && v < 0.55 && (m.check ? (Math.round(u * 7) + w) % 2 === 0 : (w === 1 || w === 2) && u > 0.2 && u < 0.5)) return col(m.bar);
        if (r === 'neck' && u > 0.5) return col(0x7a5a86); // green shading to purple on the nape
        if (r === 'beak' && v > 0) return col(0xe9e5dc); // the pale cere
        if (variant === 4 && r !== 'wing' && r !== 'eye' && r !== 'leg' && r !== 'beak' && (u * 13 + w * 5) % 7 < 2) return col(0x6f7380); // pied
        return undefined;
      });
    }
    case 'dove': // Oriental turtle dove: scaly rufous wings, a striped neck patch
      return flat(pal, {
        base: 0xa48b7c, back: 0x9a7563, wing: 0xb06d42, wingTip: 0x3e3a3c, rump: 0x7b7a80, tail: 0x5a585c, tailTip: 0xc8c4bc,
        head: 0x9f8f8c, crown: 0x8e8a8e, face: 0xa79790, throat: 0xb3a097, breast: 0xb79a8a, belly: 0xbaa598,
        neck: 0xa48b7c, eye: 0xe0802a, beak: 0x4a3e3e, leg: 0xc0605e,
      }, (r, u, v, w, col) => {
        if (r === 'wing' && v < 0.6 && (Math.round(u * 6) + w) % 2 === 0) return col(0x3d302c);
        if (r === 'neck' && w !== 0 && v % 2 === 0) return col(0x2a2628);
        if (r === 'neck' && w !== 0) return col(0x8fa4b4);
        return undefined;
      });
    case 'sparrow': // Eurasian tree sparrow: chestnut cap, white cheeks with a black spot, black bib
      return flat(pal, {
        base: 0x8a6643, back: 0x8f6a44, rump: 0x7d6650, wing: 0x7c5434, wingTip: 0x4a3626, flank: 0xb8ad98, breast: 0xcdc4b2,
        belly: 0xd8d0c0, tail: 0x5f4632, tailTip: 0x4c3828, head: 0xeee8da, crown: 0x8a4a2c, face: 0xeee8da, throat: 0x262224,
        neck: 0x8a4a2c, eye: 0x161416, beak: 0x2a2526, leg: 0xb38c6a,
      }, (r, u, v, w, col) => {
        if (r === 'back' && (u * 9 + w * 3) % 4 < 1) return col(0x2e2218); // streaks
        if (r === 'head' && v === 1 && u > 0.3) return col(0x1e1a1c); // the cheek spot
        if (r === 'wing' && v < 0.35 && w === 1) return col(0xefe6d6); // pale wing bar
        return undefined;
      });
    case 'crow': // jungle crow: glossy black with a heavy bill
      return flat(pal, { base: 0x1c1b21, back: 0x25283a, wing: 0x22253a, wingTip: 0x15151b, tail: 0x1d1f2c, eye: 0x0c0c0e, beak: 0x121216, leg: 0x16161a },
        (r, u, _v, w, col) => (r === 'wing' && (Math.round(u * 8) + w) % 3 === 0 ? col(0x2f3550) : undefined)); // a blue sheen
    case 'wagtail': // white wagtail: black and white, a white face and wing panel
      return flat(pal, {
        base: 0x2a2a2e, back: 0x2c2c31, rump: 0x2a2a2e, wing: 0x26262a, wingTip: 0x1c1c20, flank: 0x9a9ca4, breast: 0x1e1e22,
        belly: 0xf0eee8, tail: 0x1e1e22, tailTip: 0x1e1e22, head: 0xf2f0ea, face: 0xf2f0ea, crown: 0x1e1e22, throat: 0x1e1e22,
        neck: 0x1e1e22, eye: 0x101012, beak: 0x18181a, leg: 0x1d1d20,
      }, (r, u, v, w, col) => {
        if (r === 'wing' && v < 0.6 && u < 0.6) return col(0xf0eee8);
        if (r === 'tail' && w !== 0) return col(0xf0eee8);
        if (r === 'head' && v === 2 && u > 0.6) return col(0x1e1e22); // the eye stripe
        return undefined;
      });
    case 'bulbul': // brown-eared bulbul: grey, a chestnut ear patch, a long tail
      return flat(pal, {
        base: 0x777b84, back: 0x6f727b, rump: 0x6c6f76, wing: 0x6f6a66, wingTip: 0x55514f, flank: 0x80838c, breast: 0x7e828b,
        belly: 0x8e9199, tail: 0x5e5d62, tailTip: 0x4e4d52, head: 0x7a7e88, crown: 0x8a8e97, face: 0x8a4a32, throat: 0x8c9098,
        neck: 0x777b84, eye: 0x2a1c1a, beak: 0x1b1a1c, leg: 0x2e2a2a,
      }, (r, u, _v, w, col) => (r === 'breast' && (Math.round(u * 5) + w) % 2 === 0 ? col(0xa9acb4) : undefined)); // pale scaling
    case 'kingfisher': // common kingfisher: electric blue above, orange below, a long black bill
      return flat(pal, {
        base: 0x2381ba, back: 0x37c2dc, rump: 0x45d0e6, wing: 0x1f6f9c, wingTip: 0x1b5b82, flank: 0xe07a30, breast: 0xe07a30,
        belly: 0xe48a3e, tail: 0x1f6f9c, tailTip: 0x1b5b82, head: 0x2381ba, crown: 0x2381ba, face: 0xe07a30, throat: 0xf2ecdf,
        neck: 0xf2ecdf, eye: 0x101012, beak: 0x141416, leg: 0xe0453a,
      }, (r, u, v, w, col) => {
        if (r === 'wing' && (Math.round(u * 6) + w) % 3 === 0) return col(0x46b8dc); // spangles
        if (r === 'crown' && (Math.round(u * 4) + v) % 2 === 0) return col(0x46b8dc);
        return undefined;
      });
    case 'gull': // yellow-legged gull: white, a pale grey mantle, black wing tips with white mirrors, a yellow bill
      return flat(pal, {
        base: 0xf2f1ee, back: 0xa9b0ba, rump: 0xf2f1ee, wing: 0xa9b0ba, wingTip: 0x1d1d22, flank: 0xeceae6, breast: 0xf4f3f0,
        belly: 0xf4f3f0, tail: 0xf2f1ee, tailTip: 0xf2f1ee, head: 0xf5f4f1, crown: 0xf5f4f1, face: 0xf5f4f1, throat: 0xf5f4f1,
        neck: 0xf2f1ee, eye: 0xe8d070, beak: 0xe8c43a, leg: 0xe2c048,
      }, (r, u, v, w, col) => {
        if (r === 'wingTip' && (Math.round(u * 5) + v + w) % 4 === 0) return col(0xf2f1ee); // the white mirrors
        if (r === 'wing' && w === 0 && v > 0.2) return col(0xf2f1ee); // the white trailing edge
        if (r === 'beak' && v > 0 && u > 0.5) return col(0xd2402e); // the red spot
        return undefined;
      });
  }
}

/** Amalfi's own birds where they differ from Tokyo's: Italian sparrows, hooded crows, collared doves. */
function italian(sp: Species, pal: Palette): Paint | null {
  switch (sp) {
    case 'sparrow': // Italian sparrow: chestnut crown, white cheeks, a black bib
      return flat(pal, {
        base: 0x8a6643, back: 0x92683f, rump: 0x847262, wing: 0x7e5432, wingTip: 0x4a3626, flank: 0xbdb3a2, breast: 0xd2cbbb,
        belly: 0xdcd5c6, tail: 0x5f4632, tailTip: 0x4c3828, head: 0xf0ece2, crown: 0x9a4a24, face: 0xf0ece2, throat: 0x1e1a1c,
        neck: 0x9a4a24, eye: 0x161416, beak: 0x2a2526, leg: 0xb38c6a,
      }, (r, u, v, w, col) => {
        if (r === 'back' && (u * 9 + w * 3) % 4 < 1) return col(0x2e2218);
        if (r === 'breast' && v === 0 && u > 0.5) return col(0x1e1a1c); // the bib runs onto the breast
        if (r === 'wing' && v < 0.35 && w === 1) return col(0xefe6d6);
        return undefined;
      });
    case 'crow': // hooded crow: ash grey body, black head, wings and tail
      return flat(pal, {
        base: 0x8d8d93, back: 0x8f8f95, rump: 0x88888e, flank: 0x8a8a90, breast: 0x8d8d93, belly: 0x939399,
        wing: 0x1c1b21, wingTip: 0x15151b, tail: 0x1d1f2c, tailTip: 0x15151b, head: 0x1c1b21, crown: 0x1c1b21, face: 0x1c1b21,
        throat: 0x1c1b21, neck: 0x8d8d93, eye: 0x0c0c0e, beak: 0x121216, leg: 0x16161a,
      });
    case 'dove': // Eurasian collared dove: pale buff-grey, a black half collar
      return flat(pal, {
        base: 0xc2b3a6, back: 0xb3a597, wing: 0xb1a294, wingTip: 0x5a5452, rump: 0xa9a6a8, tail: 0xa8a29c, tailTip: 0xe8e4dc,
        head: 0xc8bcb4, crown: 0xbdb5b2, face: 0xcabfb6, throat: 0xd2c8c0, breast: 0xcbb5ae, belly: 0xd6cbc2,
        neck: 0xc2b3a6, eye: 0xb02a2a, beak: 0x2a2526, leg: 0xb8606a,
      }, (r, _u, v, w, col) => (r === 'neck' && w !== 0 && v === 0 ? col(0x1c1a1c) : undefined));
    default:
      return null;
  }
}

/** How many plumages a species has. */
export const VARIANTS: Record<Species, number> = { pigeon: 5, dove: 1, sparrow: 1, crow: 1, wagtail: 1, bulbul: 1, kingfisher: 1, gull: 1 };

/**
 * A bird on the character skeleton, standing on the origin and facing +z. The wings are built spread
 * (their rest pose); a bird folds them by turning each one back along its body (see game/birds.ts),
 * where it lies on the back like a folded wing.
 */
export function buildBird(sp: Species, variant = 0): CharModel {
  const S = SHAPES[sp];
  const pal = new Palette();
  const paint = plumage(sp, variant, pal);
  const hw = (S.W - 1) / 2, hh = (S.head - 1) / 2;
  const ox = S.span + hw + 1; // grid column of the body's centre line
  const zb = S.tail; // first body row
  const zEnd = zb + S.L - 1; // last body row
  const yb0 = S.leg, yb1 = S.leg + S.H - 1;
  const hy0 = yb1 - 1 + S.neck, hz0 = zEnd - 1;
  const W = 2 * ox + 1, H = hy0 + S.head + 1, D = hz0 + S.head + S.beak + 1;
  const grid = new Grid(W, H, D);
  const parts = new Uint8Array(W * H * D);
  const set = (x: number, y: number, z: number, c: number, part: number) => {
    const gx = ox + x;
    if (gx < 0 || y < 0 || z < 0 || gx >= W || y >= H || z >= D) return;
    grid.set(gx, y, z, c); parts[y * W * D + z * W + gx] = part;
  };
  const P = BIRD_PART;
  // legs and toes
  const zl = zb + Math.floor(S.L * 0.45), lx = Math.min(1, hw);
  for (const x of lx ? [-lx, lx] : [0]) {
    for (let y = 0; y < S.leg; y++) set(x, y, zl, paint('leg', 0, y, 0), P.legs);
    set(x, 0, zl + 1, paint('leg', 0, 0, 1), P.legs);
  }
  // body, its ends and long edges rounded off
  for (let z = zb; z <= zEnd; z++)
    for (let y = yb0; y <= yb1; y++)
      for (let x = -hw; x <= hw; x++) {
        const edgeX = Math.abs(x) === hw && hw > 0, end = z === zb || z === zEnd;
        if (end && (edgeX || y === yb0 || y === yb1) && S.W > 3) continue;
        if (end && y === yb0 && S.W <= 3) continue;
        if (edgeX && (y === yb0 || y === yb1)) continue;
        const u = (z - zb) / Math.max(1, S.L - 1);
        const r: Region = y === yb1 ? 'back' : z === zb ? 'rump' : z >= zEnd - 1 && y > yb0 ? 'breast' : y === yb0 ? 'belly' : edgeX ? 'flank' : 'breast';
        set(x, y, z, paint(r, u, y - yb0, x + hw), P.body);
      }
  // tail, fanned a little at the tip
  const ty = yb1 - S.tailDrop;
  for (let z = zb - S.tail; z < zb + 1; z++) {
    const k = zb - z, tw = S.tailW + (k >= S.tail - 1 && S.tailW > 0 ? 1 : 0);
    for (let x = -tw; x <= tw; x++) set(x, ty, z, paint(k >= S.tail - 1 ? 'tailTip' : 'tail', k / S.tail, 0, x + tw), P.tail);
  }
  // neck and head
  for (let y = yb1; y < hy0; y++)
    for (let z = hz0; z <= zEnd; z++)
      for (let x = -Math.min(hh, hw); x <= Math.min(hh, hw); x++) set(x, y, z, paint('neck', (y - yb1) / Math.max(1, S.neck), y - yb1, x), P.head);
  for (let y = hy0; y < hy0 + S.head; y++)
    for (let z = hz0; z < hz0 + S.head; z++)
      for (let x = -hh; x <= hh; x++) {
        const top = y === hy0 + S.head - 1, front = z === hz0 + S.head - 1, low = y === hy0;
        if (S.head > 3 && (Math.abs(x) === hh && (top || low) || (front && top))) continue;
        const r: Region = top ? 'crown' : low && z > hz0 ? 'throat' : front ? 'face' : 'head';
        set(x, y, z, paint(r, (z - hz0) / (S.head - 1), y - hy0, x + hh), P.head);
      }
  // eyes on the sides, up near the front
  const ey = hy0 + Math.max(1, S.head - 2), ez = hz0 + S.head - 2;
  set(-hh, ey, ez, paint('eye', 0, 0, 0), P.head); set(hh, ey, ez, paint('eye', 0, 0, 0), P.head);
  // bill
  const by = hy0 + 1;
  for (let k = 0; k < S.beak; k++)
    for (let j = 0; j < (S.beakH ?? 1) - (k === S.beak - 1 && (S.beakH ?? 1) > 1 ? 1 : 0); j++) set(0, by + j, hz0 + S.head + k, paint('beak', k, j, 0), P.head);
  // wings, spread flat at the shoulder line just above the back, tapering to the tip
  const yw = yb1 + 1, zs = zEnd - 1;
  for (let d = 1; d <= S.span; d++) {
    const t = d / S.span, c = Math.max(1, S.chord - Math.floor(t * t * (S.chord - 1) + 0.0001) + (t > 0.25 && t < 0.7 && S.chord > 2 ? 1 : 0));
    for (let k = 0; k < c; k++) {
      const r: Region = t > 0.7 ? 'wingTip' : 'wing';
      // u runs from the root to the tip (the folded wing's length), w along the chord (across the back once folded)
      set(-hw - d, yw, zs - k, paint(r, t, k / Math.max(1, S.chord), k), P.wingL);
      set(hw + d, yw, zs - k, paint(r, t, k / Math.max(1, S.chord), k), P.wingR);
    }
  }
  const s = BIRD_SCALE;
  // grid units -> metres, the centre line at x = 0 and the legs at z = 0
  const m = (gx: number, gy: number, gz: number): [number, number, number] => [(gx - ox - 0.5) * s, gy * s, (gz - zl - 0.5) * s];
  const pivots: [number, number, number][] = Array.from({ length: PART_COUNT }, () => [0, 0, 0]);
  pivots[P.body] = m(ox + 0.5, yb0 + S.H / 2, zb + S.L / 2);
  pivots[P.head] = m(ox + 0.5, yb1 + 1, zEnd);
  pivots[P.wingL] = m(ox - hw, yw + 0.5, zs + 1);
  pivots[P.wingR] = m(ox + hw + 1, yw + 0.5, zs + 1);
  pivots[P.tail] = m(ox + 0.5, ty + 0.5, zb + 0.5);
  return { grid, parts, pal, scale: s, origin: [-(ox + 0.5) * s, 0, -(zl + 0.5) * s], pivots };
}
