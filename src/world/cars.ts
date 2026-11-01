// The cities' traffic, in voxels a tenth of a metre across: kei cars, hatchbacks, sedans, taxis with their roof
// lamps, minivans, kei trucks and box vans, in each city's own colours (Tokyo's white and silver kei cars and
// black taxis, Funchal's yellow taxis with their blue band, Amalfi's little Fiats and white taxis), the town
// buses (Funchal's yellow and orange, the blue SITA of the Amalfi coast) and Istanbul's T1 tram. Each is a rigid
// body for the character batch whose four wheels are parts of their own, so they turn on their axles (and the
// front pair steers) through the pose texture, and every car of one shape and paint shares a single mesh. Also
// here: the lit lenses of the traffic lights.
import { Grid, rng } from './grid';
import { perCity } from './cityId';
import { Palette } from './palette';
import { PART, PART_COUNT } from './charparts';
import type { CharModel } from './characters';
import { SIGNAL_LENS } from './props';
import { POLE } from './roads';

export const CAR_SCALE = 0.1;
/** Wheel parts: front left, front right, rear left, rear right (left is -x, the model faces +z). */
export const WHEEL_PARTS = [PART.head, PART.armL, PART.armR, PART.tail] as const;

export type CarKind = 'kei' | 'hatch' | 'sedan' | 'taxi' | 'minivan' | 'truck' | 'van' | 'bus' | 'tram';

export interface CarShape {
  kind: CarKind;
  model: CharModel;
  /** Metres: bumper to bumper, side to side, ground to roof. */
  length: number;
  width: number;
  height: number;
  /** Front axle to rear axle (m), and how far the axles' midpoint sits ahead of the body's centre. */
  wheelbase: number;
  axleMid: number;
  wheelR: number;
}

interface Paint { body: number; upper?: number; band?: number; plate: 'white' | 'yellow' | 'green' | 'eu' }

/** Paint per kind: the white, silver and black of Tokyo's streets, pastel kei cars, the taxi companies' colours. */
const TOKYO_PAINTS: Partial<Record<CarKind, Paint[]>> = {
  kei: [
    { body: 0xf3f1ec, plate: 'yellow' }, { body: 0xdacdb2, plate: 'yellow' }, { body: 0xa9d6c4, plate: 'yellow' },
    { body: 0xe9bcbc, plate: 'yellow' }, { body: 0x1f1f24, plate: 'yellow' }, { body: 0xb9bdc1, plate: 'yellow' },
    { body: 0x2c3552, plate: 'yellow' }, { body: 0xf0d77a, upper: 0xf3f1ec, plate: 'yellow' },
  ],
  hatch: [
    { body: 0xf2f0eb, plate: 'white' }, { body: 0xb7bbbf, plate: 'white' }, { body: 0xb1262b, plate: 'white' },
    { body: 0x2f5d9a, plate: 'white' }, { body: 0x1c1c20, plate: 'white' }, { body: 0x6a6e73, plate: 'white' },
  ],
  sedan: [{ body: 0xf4f2ee, plate: 'white' }, { body: 0x151518, plate: 'white' }, { body: 0xa9adb2, plate: 'white' }],
  taxi: [
    { body: 0x151519, plate: 'green' }, { body: 0x222a55, plate: 'green' },
    { body: 0xf1c12f, upper: 0x2f7d4f, plate: 'green' }, { body: 0xe8742a, upper: 0xf3f1ec, plate: 'green' },
  ],
  minivan: [{ body: 0xf3f1ec, plate: 'white' }, { body: 0x18181c, plate: 'white' }, { body: 0xb5b9bd, plate: 'white' }, { body: 0x27304a, plate: 'white' }],
  truck: [{ body: 0xf3f2ee, plate: 'yellow' }, { body: 0xe9e8e2, plate: 'yellow' }],
  van: [
    { body: 0xf4f3ef, band: 0x2f8a52, plate: 'green' }, { body: 0xf4f3ef, band: 0x2b5ea8, plate: 'green' },
    { body: 0xf4f3ef, band: 0xd23b2f, plate: 'green' }, { body: 0xf4f3ef, band: 0xee8a22, plate: 'green' },
  ],
};

/** Europe's cars: white, silver, grey, black, a few colours; plates white with the blue band. */
const euro = (cols: number[]): Paint[] => cols.map((body) => ({ body, plate: 'eu' as const }));

/** Funchal: small Renaults and Peugeots, yellow taxis with their blue band, white vans, the town's buses. */
const MADEIRA_PAINTS: Partial<Record<CarKind, Paint[]>> = {
  kei: euro([0xf2f1ec, 0xc9ccd0, 0xb52a2a, 0x2a4f8a, 0x1d1e22, 0x8ab9c9]),
  hatch: euro([0xf2f0eb, 0xb7bbbf, 0x6a6e73, 0x1c1c20, 0xa8262c, 0x2f5d9a, 0xd8d2c2, 0x3e6b4c]),
  sedan: euro([0xf4f2ee, 0x151518, 0x9fa4a9, 0x3a3f47]),
  taxi: [{ body: 0xf2c52a, band: 0x2a63b8, plate: 'eu' }],
  minivan: euro([0xf3f1ec, 0x5d6268, 0x18181c]),
  van: [{ body: 0xf4f3ef, plate: 'eu' }, { body: 0xf4f3ef, band: 0xd23b2f, plate: 'eu' }, { body: 0xf4f3ef, band: 0x2a63b8, plate: 'eu' }],
  bus: [{ body: 0xf6c32c, band: 0xe8742a, upper: 0xf3f1ec, plate: 'eu' }],
};

/** The Amalfi coast: Fiat 500s and Pandas in every colour, white taxis and vans, Piaggio Porters, the blue SITA buses. */
const AMALFI_PAINTS: Partial<Record<CarKind, Paint[]>> = {
  kei: euro([0xf2efe6, 0xc8302a, 0x8cc4d8, 0xe9d38a, 0x1d1e22, 0x7a9e6a, 0xb9bdc1, 0xe8a0a0]),
  hatch: euro([0xf2f0eb, 0xb7bbbf, 0x1c1c20, 0xa8262c, 0x2f5d9a, 0x6a6e73]),
  sedan: euro([0xf4f2ee, 0x151518, 0x9fa4a9]),
  taxi: [{ body: 0xf6f5f1, plate: 'eu' }],
  minivan: euro([0xf3f1ec, 0x18181c, 0x2b3550]),
  truck: euro([0xf3f2ee, 0x3f6fae, 0xe9e8e2]),
  van: [{ body: 0xf4f3ef, plate: 'eu' }, { body: 0xf4f3ef, band: 0x2f8a52, plate: 'eu' }],
  bus: [{ body: 0x2a5fb0, band: 0xf3f1ec, upper: 0x2a5fb0, plate: 'eu' }],
};

/** Istanbul: the tram of the T1 line, white and red. */
const ISTANBUL_PAINTS: Partial<Record<CarKind, Paint[]>> = {
  tram: [{ body: 0xf4f3ef, band: 0xc8282a, upper: 0xf4f3ef, plate: 'eu' }],
};

/** This city's paints per make (only the makes that drive here). */
export const PAINTS = perCity({ tokyo: TOKYO_PAINTS, madeira: MADEIRA_PAINTS, amalfi: AMALFI_PAINTS, istanbul: ISTANBUL_PAINTS, neo: {} });

interface Body {
  L: number; W: number; roof: number; belt: number;
  /** Cabin span along z (inclusive) at the belt line, and how far its front and back lean in per voxel up. */
  cab0: number; cab1: number; slopeF: number; slopeR: number;
  /** Front and rear axle rows. */
  zF: number; zR: number;
}

const BODIES: Partial<Record<CarKind, Body>> = {
  kei: { L: 34, W: 15, roof: 17, belt: 8, cab0: 1, cab1: 28, slopeF: 1.1, slopeR: 0.15, zF: 27, zR: 6 },
  hatch: { L: 39, W: 17, roof: 15, belt: 8, cab0: 3, cab1: 29, slopeF: 1.5, slopeR: 0.8, zF: 31, zR: 7 },
  sedan: { L: 46, W: 17, roof: 14, belt: 8, cab0: 10, cab1: 34, slopeF: 1.7, slopeR: 1.5, zF: 37, zR: 9 },
  taxi: { L: 46, W: 17, roof: 15, belt: 8, cab0: 10, cab1: 34, slopeF: 1.5, slopeR: 1.4, zF: 37, zR: 9 },
  minivan: { L: 46, W: 18, roof: 18, belt: 8, cab0: 1, cab1: 37, slopeF: 1.3, slopeR: 0.25, zF: 37, zR: 8 },
  truck: { L: 34, W: 15, roof: 17, belt: 8, cab0: 22, cab1: 32, slopeF: 0.4, slopeR: 0, zF: 28, zR: 6 },
  van: { L: 48, W: 18, roof: 17, belt: 8, cab0: 36, cab1: 45, slopeF: 1.0, slopeR: 0, zF: 40, zR: 8 },
};

const R = 3; // wheel radius (voxels)

/** Builds a car (deterministic per kind and paint). */
export function buildCar(kind: CarKind, paintIdx: number, seed = 1): CarShape {
  const paints = PAINTS[kind] ?? TOKYO_PAINTS[kind]!;
  const paint = paints[paintIdx % paints.length];
  if (kind === 'bus') return buildBus(paint);
  if (kind === 'tram') return buildTram(paint);
  const B = BODIES[kind]!;
  const pal = new Palette();
  const r = rng(seed * 31 + paintIdx * 7 + kind.length);
  const body = pal.add(paint.body, { vary: 0.015 });
  const bodyDark = pal.add(shade(paint.body, 0.78), { vary: 0.015 });
  const upper = paint.upper !== undefined ? pal.add(paint.upper, { vary: 0.015 }) : body;
  const glass = pal.add(0x2b3a48, { glass: true });
  const trim = pal.add(0x24262a, { vary: 0.02 });
  const tyre = pal.add(0x1b1b1d, { vary: 0.02 });
  const hub = pal.add(0xc3c8cc, { vary: 0.02 });
  const hubDark = pal.add(0x5d6369, { vary: 0.02 });
  const inside = pal.add(0x2d2a2a, { vary: 0.03 });
  const head = pal.add(0xfff4dc, { emit: 0.9, night: true, vary: 0.01 });
  const tail = pal.add(0xd8241e, { emit: 0.75, night: true, vary: 0.01 });
  const amber = pal.add(0xf29a2e, { vary: 0.02 });
  const plateCol = pal.add(paint.plate === 'yellow' ? 0xf0d040 : paint.plate === 'green' ? 0x2f7a46 : 0xf2f2ee, { vary: 0.01 });
  const plateInk = pal.add(paint.plate === 'green' ? 0xf2f2ee : 0x2f6a40, { vary: 0.01 });
  const chrome = pal.add(0xd5dade, { vary: 0.02 });

  const { L, W, roof, belt } = B;
  const GW = W + 2, GH = roof + 4, GD = L;
  const g = new Grid(GW, GH, GD);
  const parts = new Uint8Array(GW * GH * GD);
  const x1 = W; // body columns 1..W
  const mid = (GW - 1) / 2;
  const set = (x: number, y: number, z: number, v: number, part = 0) => {
    if (!g.inside(x, y, z)) return;
    g.set(x, y, z, v);
    parts[y * GW * GD + z * GW + x] = part;
  };
  const arch = (y: number, z: number) => [B.zF, B.zR].some((zc) => (y + 0.5 - R) ** 2 + (z + 0.5 - zc) ** 2 < (R + 0.9) ** 2);
  const front = (y: number) => Math.round(B.cab1 - (y - belt - 1) * B.slopeF);
  const rear = (y: number) => Math.round(B.cab0 + (y - belt - 1) * B.slopeR);
  const boxy = kind === 'van' || kind === 'truck';

  // lower body: from the sills (y 2) to the belt, rounded at the four corners, wheel arches cut out
  for (let z = 0; z < L; z++) for (let y = 2; y <= belt; y++) for (let x = 1; x <= x1; x++) {
    const edgeX = x === 1 || x === x1, endZ = z === 0 || z === L - 1;
    if (edgeX && endZ && !boxy) continue;
    // the hood and boot slope down a voxel towards the bumpers
    if (y === belt && (z === L - 1 || (z === 0 && kind !== 'kei' && kind !== 'minivan' && !boxy))) continue;
    if ((x <= 3 || x >= x1 - 2) && y < belt - 1 && arch(y, z)) continue;
    const sideCol = y === belt - 3 ? bodyDark : body; // a crease along the side
    set(x, y, z, edgeX ? sideCol : body);
  }
  // bumpers, grille, lamps and plates
  for (let x = 1; x <= x1; x++) {
    for (const z of [0, L - 1]) { set(x, 2, z, trim); if (!(boxy && z === 0)) set(x, 3, z, trim); }
  }
  for (const x of [1, 2, 3, x1 - 2, x1 - 1, x1]) {
    set(x, belt - 1, L - 1, head); if (x !== 1 && x !== x1) set(x, belt - 2, L - 1, head);
    if (x === 1 || x === x1 || x === 2 || x === x1 - 1) { set(x, belt - 1, 0, tail); set(x, belt - 2, 0, tail); set(x, belt - 3, 0, x === 1 || x === x1 ? amber : tail); }
  }
  for (let x = 5; x <= x1 - 4; x++) for (const y of [belt - 2, belt - 1]) set(x, y, L - 1, (x + y) % 2 ? trim : bodyDark);
  const euBlue = pal.add(0x24409a, { vary: 0.01 });
  for (const z of [0, L - 1]) for (let x = Math.round(mid) - 2; x <= Math.round(mid) + 2; x++) for (const y of [4, 5]) {
    // a European plate: the blue band at its left end, black letters on white
    if (paint.plate === 'eu') set(x, y, z, x === Math.round(mid) + (z === 0 ? 2 : -2) ? euBlue : y === 5 && (x + z) % 2 ? trim : plateCol);
    else set(x, y, z, y === 5 && (x + z) % 2 ? plateInk : plateCol);
  }
  // door lines and handles along both sides
  const doors = kind === 'truck' ? [B.cab0 + 1] : kind === 'van' ? [B.cab0 + 1] : kind === 'kei' || kind === 'hatch' ? [B.cab1 - 9, B.cab0 + 8] : [B.cab1 - 10, Math.round((B.cab0 + B.cab1) / 2) - 3];
  for (const x of [1, x1]) for (const dz of doors) {
    for (let y = 3; y <= belt; y++) if (g.get(x, y, dz)) set(x, y, dz, bodyDark);
    set(x, belt - 1, dz + 2, chrome);
  }

  // cabin: glass all round between the pillars, roof on top, leaning in front and back
  const cabTop = roof;
  for (let y = belt + 1; y <= cabTop; y++) {
    const zf = front(y), zr = rear(y);
    const inset = y >= cabTop - 1 ? 1 : 0; // the glass leans in towards the roof
    for (let z = zr; z <= zf; z++) for (let x = 1 + inset; x <= x1 - inset; x++) {
      const sideX = x === 1 + inset || x === x1 - inset;
      const endZ = z === zr || z === zf;
      if (y === cabTop) { if (!(sideX && endZ)) set(x, y, z, upper); continue; }
      if (!sideX && !endZ) { set(x, y, z, inside); continue; }
      // pillars: the corners, and a B pillar between the doors
      const pillar = (sideX && (z <= zr + (kind === 'kei' || kind === 'minivan' ? 1 : 0) || z >= zf - 1)) || (sideX && Math.abs(z - Math.round((zf + zr) / 2)) < 1 && kind !== 'truck');
      set(x, y, z, pillar ? upper : glass);
    }
  }

  // kei truck: an open bed behind the cab with drop sides; box van: the tall cargo box
  if (kind === 'truck') {
    for (let z = 0; z < B.cab0; z++) for (let x = 1; x <= x1; x++) {
      set(x, belt, z, z === 0 || x === 1 || x === x1 ? body : bodyDark);
      if (x === 1 || x === x1 || z === 0) for (let y = belt + 1; y <= belt + 3; y++) set(x, y, z, y === belt + 3 ? trim : body);
    }
    // a guard frame behind the cab, and whatever it carries today
    for (let x = 1; x <= x1; x++) set(x, belt + 4, B.cab0 - 1, trim);
    const load = r();
    const crates = [0x2b6cb0, 0xd8372b, 0x3f9a5b].map((h) => pal.add(h, { vary: 0.04 }));
    // stacked plastic crates
    if (load < 0.5) for (let z = 3; z + 3 < B.cab0 - 1; z += 5) for (let x = 3; x + 3 <= x1 - 2; x += 5) g.box(x, belt + 1, z, x + 3, belt + 3, z + 3, crates[(x + z) % 3]);
    else if (load < 0.8) for (let z = 3; z < B.cab0 - 3; z++) for (let x = 3; x <= x1 - 2; x++) set(x, belt + 1, z, pal.add(0x4f6a3a, { vary: 0.12 })); // a tarp
  } else if (kind === 'van') {
    const top = roof + 3;
    for (let z = 0; z < B.cab0; z++) for (let y = belt; y <= top; y++) for (let x = 1; x <= x1; x++) {
      const sideX = x === 1 || x === x1;
      const col = paint.band !== undefined && (y === belt + 4 || y === belt + 5) && (sideX || z === 0) ? pal.add(paint.band, { vary: 0.015 }) : y === top ? bodyDark : body;
      set(x, y, z, col);
    }
    for (let y = belt; y < top; y++) set(Math.round(mid), y, 0, bodyDark); // rear doors
  }

  // mirrors on stalks at the base of the windscreen
  const zm = Math.min(L - 2, front(belt + 1) - 1);
  for (const x of [0, GW - 1]) { set(x, belt + 1, zm, upper); set(x, belt + 2, zm, upper); }
  // taxis: the lamp on the roof and the red vacant light in the windscreen
  // a taxi's band of colour along its sides (Funchal's blue)
  if (kind === 'taxi' && paint.band !== undefined) {
    const band = pal.add(paint.band, { vary: 0.015 });
    for (let z = 1; z < L - 1; z++) for (const x of [1, x1]) for (const y of [belt - 3, belt - 2]) if (g.get(x, y, z)) set(x, y, z, band);
  }
  if (kind === 'taxi' && paint.plate === 'eu') {
    // Europe's taxis: a white TAXI sign across the roof, lit after dark
    const zc = Math.round((front(roof) + rear(roof)) / 2);
    const lamp = pal.add(0xf8f2dc, { emit: 0.8, night: true, vary: 0.01 });
    const ink = pal.add(0x2a2a2e, { vary: 0.01 });
    for (let x = Math.round(mid) - 3; x <= Math.round(mid) + 3; x++) {
      set(x, roof + 1, zc, trim);
      for (const z of [zc - 1, zc, zc + 1]) set(x, roof + 2, z, z !== zc && (x + z) % 3 === 0 ? ink : lamp);
    }
  } else if (kind === 'taxi') {
    const zc = Math.round((front(roof) + rear(roof)) / 2);
    const lamp = pal.add(paintIdx % 2 ? 0xf6e7c4 : 0xffd27a, { emit: 0.85, night: true, vary: 0.01 });
    for (let x = Math.round(mid) - 2; x <= Math.round(mid) + 2; x++) for (let z = zc - 1; z <= zc + 1; z++) { set(x, roof + 1, z, lamp); if (Math.abs(x - mid) < 2) set(x, roof + 2, z, lamp); }
    set(x1 - 2, belt + 1, front(belt + 1), pal.add(0xff3322, { emit: 0.8, vary: 0.01 }));
  }

  // wheels: tyres two voxels wide flush with the sides, a silver hub with a dark spoke so they are seen to turn
  const pivots: [number, number, number][] = Array.from({ length: PART_COUNT }, () => [0, 0, 0]);
  const ox = -GW / 2 * CAR_SCALE, oz = -GD / 2 * CAR_SCALE;
  const wheels: [number, number, number][] = [[1, B.zF, WHEEL_PARTS[0]], [x1 - 1, B.zF, WHEEL_PARTS[1]], [1, B.zR, WHEEL_PARTS[2]], [x1 - 1, B.zR, WHEEL_PARTS[3]]];
  for (const [xw, zc, part] of wheels) {
    for (let y = 0; y < 2 * R; y++) for (let z = zc - R; z < zc + R; z++) {
      const dy = y + 0.5 - R, dz = z + 0.5 - zc, d = Math.hypot(dy, dz);
      if (d > R) continue;
      for (let x = xw; x <= xw + 1; x++) {
        const outer = xw === 1 ? x === 1 : x === x1;
        const hubCell = outer && d < 1.8;
        set(x, y, z, hubCell ? (Math.abs(dy) < 0.6 && dz > 0 ? hubDark : hub) : tyre, part);
      }
    }
    pivots[part] = [ox + (xw + 1) * CAR_SCALE, R * CAR_SCALE, oz + zc * CAR_SCALE];
  }

  const model: CharModel = { grid: g, parts, pal, scale: CAR_SCALE, origin: [ox, 0, oz], pivots };
  const height = (kind === 'van' ? roof + 4 : kind === 'taxi' ? roof + 3 : roof + 1) * CAR_SCALE;
  return {
    kind, model,
    length: L * CAR_SCALE, width: W * CAR_SCALE, height,
    wheelbase: (B.zF - B.zR) * CAR_SCALE, axleMid: ((B.zF + B.zR) / 2 - L / 2) * CAR_SCALE, wheelR: R * CAR_SCALE,
  };
}

// ---------------------------------------------------------------------------------------------
// Buses and trams

/** A town bus, 11 m long: a long glass side between slim pillars, doors on the kerb side, the route in lights. */
function buildBus(paint: Paint): CarShape {
  const L = 108, W = 25, ROOF = 30, RB = 5, zF = L - 22, zR = 24;
  const pal = new Palette();
  const body = pal.add(paint.body, { vary: 0.012 });
  const bodyDark = pal.add(shade(paint.body, 0.78), { vary: 0.015 });
  const band = paint.band !== undefined ? pal.add(paint.band, { vary: 0.015 }) : bodyDark;
  const upper = paint.upper !== undefined ? pal.add(paint.upper, { vary: 0.012 }) : body;
  const glass = pal.add(0x24323e, { glass: true });
  const trim = pal.add(0x222428, { vary: 0.02 });
  const tyre = pal.add(0x1b1b1d, { vary: 0.02 });
  const hub = pal.add(0xb8bec4, { vary: 0.02 });
  const hubDark = pal.add(0x50565c, { vary: 0.02 });
  const inside = pal.add(0x3a3c40, { vary: 0.04 });
  const seat = pal.add(0x2c4a7a, { vary: 0.05 });
  const head = pal.add(0xfff4dc, { emit: 0.9, night: true, vary: 0.01 });
  const tail = pal.add(0xd8241e, { emit: 0.75, night: true, vary: 0.01 });
  const sign = pal.add(0xffa62a, { emit: 0.9, vary: 0.02 });
  const signDark = pal.add(0x1a1a1c, { vary: 0.01 });
  const plate = pal.add(0xf2f2ee, { vary: 0.01 });
  const roofBox = pal.add(0xd6d8da, { vary: 0.02 });
  const GW = W + 2, GH = ROOF + 5, GD = L;
  const g = new Grid(GW, GH, GD);
  const parts = new Uint8Array(GW * GH * GD);
  const set = (x: number, y: number, z: number, v: number, part = 0) => {
    if (!g.inside(x, y, z)) return;
    g.set(x, y, z, v);
    parts[y * GW * GD + z * GW + x] = part;
  };
  const arch = (y: number, z: number) => [zF, zR].some((zc) => (y + 0.5 - RB) ** 2 + (z + 0.5 - zc) ** 2 < (RB + 1) ** 2);
  // doors on the right (-x, the model faces +z): one by the driver, one in the middle
  const door = (z: number) => (z >= L - 13 && z <= L - 5) || (z >= 52 && z <= 61);
  for (let z = 0; z < L; z++) for (let y = 2; y <= ROOF; y++) for (let x = 1; x <= W; x++) {
    const sideX = x === 1 || x === W, endZ = z === 0 || z === L - 1, top = y === ROOF;
    if ((sideX && endZ) && (y < 4 || top)) continue; // rounded corners
    if (sideX && y < 12 && arch(y, z)) continue;
    if (!sideX && !endZ && !top) { if (y === 9 && x > 2 && x < W - 1 && z > 4 && z < L - 14 && z % 8 < 4) set(x, y, z, seat); else if (y === 3) set(x, y, z, inside); continue; }
    let col = body;
    if (top) col = upper;
    else if (y <= 3) col = bodyDark;
    else if (y >= 9 && y <= 11 && !endZ) col = band;
    if (sideX && y >= 13 && y <= 26 && z > 3 && z < L - 3) col = z % 13 === 0 ? upper : glass;
    if (sideX && x === 1 && door(z) && y >= 4 && y <= 26) col = z === L - 13 || z === L - 5 || z === 52 || z === 61 || z === 56 ? trim : glass;
    if (endZ && z === L - 1 && y >= 10 && y <= 26 && x > 1 && x < W) col = glass; // the windscreen
    if (endZ && z === L - 1 && y >= 27 && y <= 29 && x > 3 && x < W - 2) col = (x + y) % 3 === 0 ? signDark : sign; // the route board
    if (endZ && z === 0 && y >= 18 && y <= 26 && x > 3 && x < W - 2) col = glass;
    set(x, y, z, col);
  }
  for (const x of [2, 3, W - 2, W - 1]) { set(x, 6, L - 1, head); set(x, 7, L - 1, head); set(x, 6, 0, tail); set(x, 7, 0, tail); set(x, 8, 0, tail); }
  for (let x = 1; x <= W; x++) { set(x, 2, L - 1, trim); set(x, 2, 0, trim); }
  for (let x = 10; x <= 15; x++) for (const z of [0, L - 1]) { set(x, 4, z, plate); set(x, 5, z, plate); }
  // the air conditioning on the roof, and mirrors out on stalks
  for (let z = 56; z < 80; z++) for (let x = 6; x <= W - 5; x++) { set(x, ROOF + 1, z, roofBox); if (x > 7 && x < W - 6 && z > 57 && z < 78) set(x, ROOF + 2, z, roofBox); }
  for (const x of [0, GW - 1]) for (let y = 20; y <= 25; y++) set(x, y, L - 2, trim);
  return finish(g, parts, pal, [[1, zF], [W - 1, zF], [1, zR], [W - 1, zR]], RB, tyre, hub, hubDark, set, 'bus', L, W, ROOF + 1);
}

/**
 * Istanbul's T1 tram, 28 m in five modules joined by dark bellows: white with a red skirt and a red line under the
 * windows, a cab at each end (alike, so the tram simply runs back the other way at the end of the line), doors
 * along both sides, its pantograph up to the wire.
 */
function buildTram(paint: Paint): CarShape {
  const L = 280, W = 24, ROOF = 32, RB = 4, zF = L - 48, zR = 48;
  const pal = new Palette();
  const body = pal.add(paint.body, { vary: 0.01 });
  const red = pal.add(paint.band ?? 0xc8282a, { vary: 0.015 });
  const glass = pal.add(0x22303c, { glass: true });
  const trim = pal.add(0x232428, { vary: 0.02 });
  const bellows = pal.add(0x2a2b2e, { vary: 0.03 });
  const tyre = pal.add(0x2a2a2c, { vary: 0.02 });
  const hub = pal.add(0x6a6e72, { vary: 0.02 });
  const hubDark = pal.add(0x3a3e42, { vary: 0.02 });
  const inside = pal.add(0x4a4c50, { vary: 0.04 });
  const head = pal.add(0xfff4dc, { emit: 0.9, night: true, vary: 0.01 });
  const marker = pal.add(0xd8241e, { emit: 0.7, night: true, vary: 0.01 });
  const sign = pal.add(0xffa62a, { emit: 0.9, vary: 0.02 });
  const roofGrey = pal.add(0xc4c8cc, { vary: 0.02 });
  const iron = pal.add(0x3c3e42, { vary: 0.02 });
  const GW = W + 2, GH = ROOF + 9, GD = L;
  const g = new Grid(GW, GH, GD);
  const parts = new Uint8Array(GW * GH * GD);
  const set = (x: number, y: number, z: number, v: number, part = 0) => {
    if (!g.inside(x, y, z)) return;
    g.set(x, y, z, v);
    parts[y * GW * GD + z * GW + x] = part;
  };
  const joints = [56, 112, 168, 224];
  const nose = (z: number) => Math.min(z, L - 1 - z); // distance from the nearer end
  for (let z = 0; z < L; z++) {
    const n = nose(z), joint = joints.some((j) => Math.abs(z - j) <= 1);
    for (let y = 2; y <= ROOF; y++) {
      // the cabs taper towards each end, the roof line dropping a little over the windscreen
      const inset = n < 4 ? 4 - n : 0;
      if (y === ROOF && n < 6) continue;
      for (let x = 1 + Math.min(inset, 3); x <= W - Math.min(inset, 3); x++) {
        const sideX = x === 1 + Math.min(inset, 3) || x === W - Math.min(inset, 3), endZ = n === 0, top = y === ROOF || (y === ROOF - 1 && n < 6);
        if (!sideX && !endZ && !top) { if (y === 3) set(x, y, z, inside); continue; }
        let col = body;
        if (joint) col = bellows;
        else if (y <= 5) col = red;
        else if (y === 10) col = red;
        else if (top) col = roofGrey;
        if (!joint && sideX && y >= 12 && y <= 27 && n > 8) col = (z % 28 === 0 || (z % 56 > 22 && z % 56 < 34 && y > 25)) ? body : glass;
        // doors: glass to the floor, with a dark frame, two per module on each side
        if (!joint && sideX && y >= 4 && y <= 27 && n > 12 && (z % 56 === 26 || z % 56 === 34)) col = trim;
        if (!joint && sideX && y >= 6 && y <= 27 && n > 12 && z % 56 > 26 && z % 56 < 34) col = glass;
        if (endZ && y >= 12 && y <= 28 && x > 3 && x < W - 2) col = glass; // the windscreen
        if (n === 1 && y >= 29 && y <= 30 && x > 5 && x < W - 4) col = sign;
        set(x, y, z, col);
      }
    }
  }
  // lamps at both ends, alike: headlamps low, red markers at the corners
  for (const z of [0, L - 1]) {
    for (const x of [5, 6, W - 5, W - 4]) { set(x, 7, z, head); set(x, 8, z, head); }
    for (const x of [4, W - 3]) set(x, 27, z, marker);
    for (let x = 4; x <= W - 3; x++) set(x, 2, z, trim);
  }
  // the roof: boxes for the cooling and the gear over each module, the pantograph on the middle one, folded up to the wire
  for (const z0 of [14, 70, 182, 238]) for (let z = z0; z < z0 + 26; z++) for (let x = 6; x <= W - 5; x++) set(x, ROOF + 1, z, roofGrey);
  const pz = 140;
  for (let x = 8; x <= W - 7; x++) set(x, ROOF + 1, pz, iron);
  for (let i = 0; i < 6; i++) { set(Math.round(W / 2), ROOF + 2 + i, pz - 6 + i * 2, iron); set(Math.round(W / 2), ROOF + 2 + i, pz - 5 + i * 2, iron); }
  for (let x = 6; x <= W - 5; x++) set(x, ROOF + 8, pz + 6, iron);
  return finish(g, parts, pal, [[1, zF], [W - 1, zF], [1, zR], [W - 1, zR]], RB, tyre, hub, hubDark, set, 'tram', L, W, ROOF + 1);
}

/** Wheels as parts of their own (tyres flush with the sides, a hub with a dark spoke), and the shape's measures. */
function finish(
  g: Grid, parts: Uint8Array, pal: Palette, at: [number, number][], RB: number, tyre: number, hub: number, hubDark: number,
  set: (x: number, y: number, z: number, v: number, part?: number) => void, kind: CarKind, L: number, W: number, H: number,
): CarShape {
  const GW = g.sx, GD = g.sz;
  const pivots: [number, number, number][] = Array.from({ length: PART_COUNT }, () => [0, 0, 0]);
  const ox = -GW / 2 * CAR_SCALE, oz = -GD / 2 * CAR_SCALE;
  at.forEach(([xw, zc], i) => {
    const part = WHEEL_PARTS[i];
    for (let y = 0; y < 2 * RB; y++) for (let z = zc - RB; z < zc + RB; z++) {
      const dy = y + 0.5 - RB, dz = z + 0.5 - zc, d = Math.hypot(dy, dz);
      if (d > RB) continue;
      for (let x = xw; x <= xw + 1; x++) {
        const outer = xw === 1 ? x === 1 : x === W;
        set(x, y, z, outer && d < RB * 0.6 ? (Math.abs(dy) < 0.6 && dz > 0 ? hubDark : hub) : tyre, part);
      }
    }
    pivots[part] = [ox + (xw + 1) * CAR_SCALE, RB * CAR_SCALE, oz + zc * CAR_SCALE];
  });
  const model: CharModel = { grid: g, parts, pal, scale: CAR_SCALE, origin: [ox, 0, oz], pivots };
  const [zF, zR] = [at[0][1], at[2][1]];
  return {
    kind, model,
    length: L * CAR_SCALE, width: W * CAR_SCALE, height: H * CAR_SCALE,
    wheelbase: (zF - zR) * CAR_SCALE, axleMid: ((zF + zR) / 2 - L / 2) * CAR_SCALE, wheelR: RB * CAR_SCALE,
  };
}

function shade(hex: number, f: number): number {
  const r = ((hex >> 16) & 255) * f, g = ((hex >> 8) & 255) * f, b = (hex & 255) * f;
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}

// ---------------------------------------------------------------------------------------------
// Traffic light lenses

/** Lens parts: the car lamps, then the walk light's two figures. */
export const LENS_PARTS = { green: PART.head, amber: PART.armL, red: PART.armR, walk: PART.legL, stop: PART.tail } as const;

/** The lit lenses of a signalPole (props.ts), at the pole's own voxel scale, each lamp a part that can be shrunk away. */
export function signalLenses(mirror = false): CharModel {
  const pal = new Palette();
  const s = POLE.scale;
  const g = new Grid(POLE.sx, POLE.sy, POLE.sz);
  const parts = new Uint8Array(POLE.sx * POLE.sy * POLE.sz);
  const pivots: [number, number, number][] = Array.from({ length: PART_COUNT }, () => [0, 0, 0]);
  const ox = -POLE.sx / 2 * s, oz = -POLE.sz / 2 * s;
  const cols = { green: 0x35e8b0, amber: 0xffb22a, red: 0xff3a24, walk: 0x40e0b8, stop: 0xff4030 } as const;
  for (const key of Object.keys(LENS_PARTS) as (keyof typeof LENS_PARTS)[]) {
    const col = pal.add(cols[key], { emit: 1, vary: 0.02 });
    const cells = SIGNAL_LENS[key];
    let cx = 0, cy = 0, cz = 0;
    for (const [x0, y, z] of cells) {
      const x = mirror ? POLE.sx - 1 - x0 : x0;
      g.set(x, y, z, col);
      parts[y * POLE.sx * POLE.sz + z * POLE.sx + x] = LENS_PARTS[key];
      cx += x + 0.5; cy += y + 0.5; cz += z + 0.5;
    }
    const n = cells.length;
    pivots[LENS_PARTS[key]] = [ox + (cx / n) * s, (cy / n) * s, oz + (cz / n) * s];
  }
  return { grid: g, parts, pal, scale: s, origin: [ox, 0, oz], pivots };
}
