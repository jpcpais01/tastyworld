import type { Builder, Lot, Style } from './tokyo';
import { G, V } from './layout';
import { hash3 } from './grid';
import type { HotelInfo, HotelRoomSpec, HotelTheme, RoomType } from '../data/hotels';
import type { RoomAnchor } from './interiors';

/**
 * Hotel rooms: real rooms on the upper floors of a real building. Each guest floor is hollowed behind the
 * facade (2.5 m to the ceiling), the facade's own windows on that floor are opened right through, and the room
 * is furnished from world voxels, so it lights, shadows and blocks like everything else. People walk there on a
 * small floor map of their own (see bake.ts), and the cutaway opens the building down to that floor.
 */

type P2 = [number, number];
type P3 = [number, number, number];

export interface HotelRoomAnchor {
  id: string;
  hotel: string;
  floor: number;
  type: RoomType;
  price: number;
  /** Floor height in metres above the street. */
  y: number;
  /** The room's air in metres (x0, z0, x1, z1). */
  rect: [number, number, number, number];
  /** The same cells in builder voxels (inclusive), and the voxel layer people stand in. */
  vox: [number, number, number, number];
  layer: number;
  /** Just inside the door, facing into the room. */
  spawn: [number, number, number];
  door: { stand: P2; pick: P3 };
  bed: { stand: P2; pick: P3; facing: number };
  window: { stand: P2; pick: P3; facing: number };
  tea: { stand: P2; pick: P3; facing: number };
}

export interface HotelAnchor {
  id: string;
  /** The lobby (a RoomAnchor of kind 'hotel'). */
  lobby: string;
  /** The building's footprint in metres. */
  rect: [number, number, number, number];
  /** Just inside the front door: where the map's pin and the guide lead. */
  entrance: P2;
  rooms: HotelRoomAnchor[];
}

const GH = 14, FH = 12; // ground and upper floor heights in voxels, as building() builds them

/** Window columns of an upper floor (facade coords), the same arithmetic building() cuts them with. */
export function windowSpans(style: Style, w: number): [number, number][] {
  const ww = style === 'modern' ? 5 : style === 'machiya' ? 6 : style === 'apartment' ? 6 : 3;
  const gap = style === 'modern' || style === 'apartment' ? 2 : 3;
  const n = Math.max(1, Math.floor((w - 2 + gap) / (ww + gap)));
  const used = n * ww + (n - 1) * gap;
  const start = Math.floor((w - used) / 2);
  return Array.from({ length: n }, (_, i) => [start + i * (ww + gap), start + i * (ww + gap) + ww - 1] as [number, number]);
}

interface Look {
  floor: (u: number, v: number) => number;
  wain: number; rail: number; wall: number; ceil: number;
  duvet: number; runner: number; head: number; curtain: number;
  rug: number; rugEdge: number; chair: number; chairBack: number;
  wood: number; top: number; door: number;
  lamp: [number, number, number];
}

function themeLook(b: Builder, t: HotelTheme): Look {
  const c = b.c, ic = b.ic;
  const planks = (a: number, bb: number, cc: number) => (u: number, v: number) => ((u + ((v >> 2) % 2) * 2) % 4 === 0 ? a : u % 2 ? bb : cc);
  const carpet = (a: number, bb: number) => (u: number, v: number) => ((u + v) % 4 === 0 || (u - v + 64) % 4 === 0 ? bb : a);
  const WARM: [number, number, number] = [1.0, 0.78, 0.52];
  switch (t) {
    case 'business': return { floor: carpet(ic.carpetBlue, ic.carpetBlueB), wain: ic.wpBlue, rail: ic.wpBlue, wall: ic.wpBlue, ceil: c.trim, duvet: ic.linen, runner: ic.runnerNavy, head: ic.headGrey, curtain: ic.duvetGrey, rug: ic.carpetBlueB, rugEdge: ic.carpetBlueB, chair: ic.headGrey, chairBack: ic.headGrey, wood: ic.plankLight, top: ic.plankLight, door: ic.plankLight, lamp: [1.0, 0.9, 0.78] };
    case 'boutique': return { floor: carpet(ic.carpetPlum, ic.carpetPlumB), wain: ic.wainDark, rail: c.gold, wall: ic.wpPlum, ceil: ic.wainDark, duvet: ic.duvetPlum, runner: ic.duvetGold, head: ic.velvet, curtain: ic.velvetDark, rug: ic.carpetPlumB, rugEdge: ic.duvetGold, chair: ic.velvet, chairBack: ic.velvetDark, wood: ic.wainDark, top: ic.wainDark, door: ic.wainDark, lamp: [1.0, 0.62, 0.7] };
    case 'guesthouse': return { floor: planks(ic.plank, ic.plankLight, ic.plankLight), wain: ic.sage, rail: c.trim, wall: ic.wpSage, ceil: c.trim, duvet: ic.duvetGreen, runner: ic.duvetGold, head: ic.plankLight, curtain: c.awnYellow, rug: ic.capsuleB, rugEdge: ic.capsuleC, chair: ic.duvetGreen, chairBack: ic.duvetGreen, wood: ic.plankLight, top: ic.plankLight, door: ic.plankLight, lamp: WARM };
    case 'park': return { floor: carpet(ic.carpetRed, ic.carpetRedB), wain: ic.wain, rail: ic.brass, wall: ic.wpWarm, ceil: c.plaster, duvet: ic.linen, runner: ic.runnerRed, head: ic.wainDark, curtain: ic.velvetDark, rug: ic.duvetGold, rugEdge: ic.carpetRedB, chair: ic.velvet, chairBack: ic.velvetDark, wood: ic.wainDark, top: c.hinoki, door: ic.wainDark, lamp: WARM };
    case 'sky': return { floor: carpet(ic.carpetSand, ic.carpetSandB), wain: ic.wpStone, rail: ic.wpStone, wall: ic.wpStone, ceil: c.trim, duvet: ic.linen, runner: ic.duvetGold, head: ic.headTan, curtain: ic.carpetSandB, rug: ic.marbleG, rugEdge: ic.marbleG, chair: ic.headGrey, chairBack: ic.headGrey, wood: ic.plankDark, top: ic.marbleW, door: ic.plankDark, lamp: [1.0, 0.86, 0.68] };
    case 'ryokan': return { floor: () => c.tatami, wain: c.plaster, rail: c.woodDark, wall: c.plaster, ceil: c.woodMid, duvet: ic.quilt, runner: ic.quiltB, head: c.woodDark, curtain: c.shoji, rug: c.tatami, rugEdge: c.tatami, chair: c.hinoki, chairBack: c.woodMid, wood: c.woodDark, top: c.hinoki, door: ic.paperWall, lamp: WARM };
    default: return { floor: planks(ic.plankB, ic.plank, ic.plankLight), wain: ic.wain, rail: c.woodDark, wall: ic.wpCream, ceil: c.plaster, duvet: ic.quilt, runner: ic.runnerRed, head: ic.headTan, curtain: ic.paperWall, rug: ic.duvetRed, rugEdge: ic.duvetGold, chair: ic.velvet, chairBack: ic.velvetDark, wood: c.woodMid, top: c.hinoki, door: c.woodMid, lamp: WARM };
  }
}

/** The guest floors of a hotel, built after the rest of the building. `lobby` is its ground-floor room. */
export function hotelFloors(lot: Lot, info: HotelInfo, lobby: RoomAnchor, style: Style): void {
  const b = lot.b, c = b.c, ic = b.ic;
  const w = lot.width, dep = lot.depth;
  const sw = w >= 15 ? 2 : 1;
  // at most 6 x 5.5 m: a deep or wide building keeps its solid core beyond
  const A0 = sw, A1 = Math.min(w - 1 - sw, A0 + 23);
  const D0 = 2, D1 = Math.min(dep - 3, D0 + 21);
  const Wr = A1 - A0 + 1, Dr = D1 - D0 + 1;
  const t = themeLook(b, info.theme);
  // which side the bed is on alternates from hotel to hotel
  const flip = (info.lot[0] + info.lot[1]) % 8 >= 4;
  const A = (u: number) => (flip ? A1 - u : A0 + u);
  const M = (u: number, v: number): P2 => lot.m(flip ? A1 + 1 - u : A0 + u, D0 + v);
  const ang = (from: P2, to: P2) => Math.atan2(to[0] - from[0], to[1] - from[1]);
  const spans = windowSpans(style, w);
  const [fx0, fz0] = lot.m(0, 0), [fx1, fz1] = lot.m(w, dep);
  const hotel: HotelAnchor = {
    id: info.id, lobby: lobby.id, rooms: [],
    rect: [Math.min(fx0, fx1), Math.min(fz0, fz1), Math.max(fx0, fx1), Math.max(fz0, fz1)],
    entrance: lobby.door,
  };

  for (const spec of info.rooms) hotel.rooms.push(room(spec));
  b.hotels.push(hotel);

  function room(spec: HotelRoomSpec): HotelRoomAnchor {
    const base = GH + (spec.floor - 1) * FH, F = base * V;
    const box = (u0: number, y0: number, v0: number, u1: number, y1: number, v1: number, col: number | ((u: number, y: number, v: number) => number)) =>
      lot.box(A(u0), base + y0, D0 + v0, A(u1), base + y1, D0 + v1, typeof col === 'number' ? col : (a, y, d) => col(flip ? A1 - a : a - A0, y - base, d - D0));
    const set = (u: number, y: number, v: number, col: number) => lot.set(A(u), base + y, D0 + v, col);
    const lamp = (u: number, v: number, y: number, col: [number, number, number], r: number, k: number) => { const [x, z] = M(u, v); b.lamp(x, F + y, z, col, r, k); };
    const ryokan = spec.type === 'tatami';

    // ---- shell: hollow the floor, lay the floor, the ceiling with its light, the walls
    box(0, 0, 0, Wr - 1, 9, Dr - 1, 0);
    box(0, -1, 0, Wr - 1, -1, Dr - 1, ryokan
      ? (u, _y, v) => (v < 3 ? (u % 4 === 0 ? ic.plankB : ic.plank) : u % 8 === 7 || (v - 3) % 4 === 3 ? c.tatamiEdge : c.tatami)
      : (u, _y, v) => t.floor(u, v));
    const cu = Math.floor(Wr / 2), cv = Math.floor(Dr / 2);
    box(0, 10, 0, Wr - 1, 10, Dr - 1, (u, _y, v) => (!ryokan && Math.abs(u - cu) <= 1 && Math.abs(v - cv) <= 1 ? ic.ceilLight : ryokan && u % 3 === 0 ? c.woodDark : t.ceil));
    const finish = (y: number, post = false) => (ryokan ? (post || y === 8 ? c.woodDark : c.plaster) : y <= 2 ? t.wain : y === 3 ? t.rail : t.wall);
    box(-1, 0, 0, -1, 9, Dr - 1, (_u, y, v) => finish(y, v % 6 === 5));
    box(Wr, 0, 0, Wr, 9, Dr - 1, (_u, y, v) => finish(y, v % 6 === 5));
    box(0, 0, Dr, Wr - 1, 9, Dr, (u, y) => finish(y, u % 6 === 5));
    // the front: open this floor's windows right through, curtains (or shoji) drawn back either side
    const tall = style === 'apartment' ? 1 : 3, top = style === 'machiya' ? 7 : 8;
    let best: [number, number] | null = null;
    for (const [s0, s1] of spans) {
      const a0 = Math.max(s0, A0), a1 = Math.min(s1, A1);
      if (a1 < a0) continue;
      lot.box(a0, base + tall, 1, a1, base + top, 1, (a, y, d) => (lot.get(a, y, d) === c.trim ? c.trim : 0));
      for (const ca of [s0 - 1, s1 + 1]) if (ca >= A0 && ca <= A1) lot.box(ca, base + Math.max(0, tall - 1), 2, ca, base + 8, 2, t.curtain);
      lot.box(Math.max(A0, s0 - 1), base + 9, 2, Math.min(A1, s1 + 1), base + 9, 2, ryokan ? c.woodDark : t.wood);
      const mid = (a0 + a1 + 1) / 2;
      if (!best || Math.abs(mid - (A0 + A1 + 1) / 2) < Math.abs((best[0] + best[1] + 1) / 2 - (A0 + A1 + 1) / 2)) best = [a0, a1];
    }
    lot.box(A0, base, 1, A1, base + 9, 1, (a, y, d) => {
      const v = lot.get(a, y, d);
      return v && v !== c.trim ? finish(y - base) : v;
    });

    // ---- the door to the corridor, in the back wall on the far side from the bed
    const ud = Wr - 7;
    box(ud, 0, Dr, ud + 4, 8, Dr, (u, y) => (y === 8 || u === ud || u === ud + 4 ? (ryokan ? c.woodDark : t.wood) : u === ud + 3 && y === 4 && !ryokan ? ic.brass : ryokan && y % 3 === 0 ? c.woodDark : t.door));
    const spawnAt = M(ud + 2.5, Dr - 1.4);
    const doorPick = M(ud + 2.5, Dr);
    // a wardrobe (an oshiire with sliding paper doors in the ryokan) beside it
    box(Wr - 2, 0, Dr - 6, Wr - 1, 8, Dr - 1, (_u, y, v) => (y === 0 || y === 8 || v === Dr - 6 || v === Dr - 1 ? t.wood : ryokan ? (y % 3 === 0 ? c.woodDark : ic.paperWall) : v === Dr - 4 && y === 4 ? ic.brass : t.door));

    // ---- where you sleep
    let bedStand: P2, bedPick: P3, bedFace: number;
    let tea: { stand: P2; pick: P3; facing: number };
    const lampAt = (v: number) => {
      box(0, 0, v, 1, 1, v + 1, t.wood);
      set(0, 2, v, c.steelDark);
      set(0, 3, v, ic.shade);
      lamp(0.5, v + 0.5, 0.95, t.lamp, 2.6, 0.55);
    };
    if (ryokan) {
      // two futons on the tatami, a low table with cushions, an alcove with a scroll and a branch in a vase
      const futon = (v0: number) => box(1, 0, v0, 8, 0, v0 + 3, (u, _y, v) => (u <= 2 ? ic.pillow : (v + u) % 4 === 0 ? ic.quiltB : ic.quilt));
      futon(6); futon(12);
      bedStand = M(10, 7.6); bedPick = [...M(4.5, 8), F + 0.4] as P3; bedFace = ang(bedStand, M(4.5, 7.6));
      box(10, 0, 8, 12, 0, 10, c.woodDark);
      box(10, 1, 8, 12, 1, 10, c.hinoki);
      set(11, 2, 9, c.woodDark); set(10, 2, 9, ic.cup); set(12, 2, 9, ic.cup);
      set(9, 0, 9, ic.zabuton); set(13, 0, 9, ic.zabuton);
      const teaStand = M(11.5, 12.2);
      tea = { stand: teaStand, pick: [...M(11.5, 9.5), F + 0.7] as P3, facing: ang(teaStand, M(11.5, 9.5)) };
      box(0, 0, Dr - 4, 4, 0, Dr - 1, ic.plankDark);
      box(1, 3, Dr, 3, 8, Dr, (u, y) => (y === 3 || y === 8 ? c.woodDark : u === 2 && (y === 5 || y === 6) ? ic.ink : ic.paper));
      set(2, 1, Dr - 2, ic.bottleD); set(2, 2, Dr - 2, ic.stem); set(2, 3, Dr - 2, ic.flowerR); set(3, 3, Dr - 2, ic.stem);
      // the window seat (hiroen): boards, two chairs and a little table, behind a shoji partition
      box(0, 0, 3, 1, 9, 3, (u, y) => (y % 3 === 0 || u === 0 ? c.woodDark : c.shoji));
      box(Wr - 2, 0, 3, Wr - 1, 9, 3, (u, y) => (y % 3 === 0 || u === Wr - 1 ? c.woodDark : c.shoji));
      box(2, 8, 3, Wr - 3, 9, 3, c.woodDark);
      box(1, 0, 0, 2, 1, 1, t.chair); box(1, 2, 0, 1, 3, 1, t.chairBack);
      box(3, 0, 0, 4, 1, 1, (_u, y) => (y === 1 ? c.hinoki : c.woodDark));
      box(5, 0, 0, 6, 1, 1, t.chair); box(6, 2, 0, 6, 3, 1, t.chairBack);
      // a paper andon lamp in the corner
      set(0, 0, 5, c.woodDark); set(0, 1, 5, ic.shade); set(0, 2, 5, ic.shade);
      lamp(0.5, 5.5, 0.6, t.lamp, 4, 0.8);
    } else {
      const beds: [number, number][] = spec.type === 'king' ? [[5, 12]] : spec.type === 'double' ? [[6, 11]] : spec.type === 'twin' ? [[5, 8], [11, 14]] : [[8, 11]];
      for (const [v0, v1] of beds) {
        box(0, 0, v0, 8, 0, v1, t.wood);
        box(1, 1, v0, 8, 1, v1, ic.linen);
        box(1, 2, v0, 8, 2, v1, (u) => (u <= 2 ? ic.pillow : u === 6 || u === 7 ? t.runner : t.duvet));
        box(0, 1, v0, 0, 4, v1, t.head);
      }
      const [v0, v1] = beds[0], vl = beds[beds.length - 1][1];
      if (spec.type === 'king') box(-1, 1, v0 - 1, -1, 6, v1 + 1, (_u, y) => (y === 6 ? t.wood : t.head)); // a padded wall behind the bed
      else box(-1, 5, v0, -1, 7, v1, (_u, y, v) => (y === 5 || y === 7 || v === v0 || v === v1 ? t.wood : info.theme === 'guesthouse' ? (hash3(v, y, 7) < 0.45 ? ic.mapLand : ic.mapSea) : [ic.duvetBlue, ic.mapLand, ic.duvetGold][(v + y) % 3]));
      lampAt(v0 - 2);
      if (spec.type !== 'single') lampAt(vl + 1);
      if (spec.type === 'twin') lampAt(beds[1][0] - 2);
      const vc = (v0 + v1 + 1) / 2;
      bedStand = M(10, vc); bedPick = [...M(4.5, vc), F + 0.8] as P3; bedFace = ang(bedStand, M(4.5, vc));
      // the desk with the kettle and the TV over it, and its chair
      box(Wr - 2, 0, 2, Wr - 1, 1, 2, t.wood);
      box(Wr - 2, 0, 7, Wr - 1, 1, 7, t.wood);
      box(Wr - 2, 2, 2, Wr - 1, 2, 7, t.top);
      box(Wr, 4, 2, Wr, 7, 7, (_u, y, v) => (y === 4 || y === 7 || v === 2 || v === 7 ? ic.tvFrame : ic.screen));
      set(Wr - 1, 3, 6, c.steelDark); set(Wr - 1, 4, 6, ic.steel); set(Wr - 2, 3, 5, ic.cup); set(Wr - 1, 3, 5, ic.cup);
      set(Wr - 1, 3, 3, c.steelDark); set(Wr - 1, 4, 3, ic.shade);
      lamp(Wr - 0.5, 3.5, 1.15, t.lamp, 2.4, 0.5);
      box(Wr - 3, 0, 4, Wr - 3, 1, 5, t.chair);
      box(Wr - 4, 0, 4, Wr - 4, 4, 5, (_u, y) => (y <= 1 ? t.chair : t.chairBack));
      const teaStand = M(Wr - 3, 8.1);
      tea = { stand: teaStand, pick: [...M(Wr - 0.5, 5.5), F + 0.9] as P3, facing: ang(teaStand, M(Wr - 1, 5.5)) };
      // an armchair and a side table in the window corner
      if (spec.type !== 'single') {
        box(0, 0, 0, 1, 1, 1, t.chair);
        box(0, 2, 0, 0, 3, 1, t.chairBack);
        box(2, 0, 0, 2, 1, 0, (_u, y) => (y === 1 ? t.top : t.wood));
      }
      // a rug between the bed and the desk
      if (Wr >= 18) box(10, -1, 3, Wr - 5, -1, 14, (u, _y, v) => (u === 10 || u === Wr - 5 || v === 3 || v === 14 ? t.rugEdge : t.rug));
      // a unit bath in the corner behind the bed: white walls, a door, a tub you can see from above
      if (Wr >= 18) {
        const bv = Dr - 6;
        box(0, -1, bv, 5, -1, Dr - 1, (u, _y, v) => ((u + v) % 2 ? ic.tileW : ic.tileG));
        box(5, 0, bv, 5, 9, Dr - 1, ic.tileW);
        box(0, 0, bv, 4, 9, bv, ic.tileW);
        box(5, 0, bv + 1, 5, 8, bv + 3, (_u, y, v) => (y === 8 || v === bv + 1 || v === bv + 3 ? t.wood : y === 4 && v === bv + 2 ? ic.brass : ic.pillow));
        box(0, 0, Dr - 3, 3, 1, Dr - 1, (u, y, v) => (y === 1 && u >= 1 && u <= 2 && v === Dr - 2 ? ic.tank : ic.pillow));
        box(0, 0, bv + 1, 0, 1, bv + 1, ic.pillow);
        set(4, 2, bv + 1, ic.steel); box(4, 0, bv + 1, 4, 1, bv + 1, ic.pillow);
        lamp(2.5, bv + 2.5, 2.2, [1.0, 0.95, 0.85], 2.4, 0.5);
      }
      // the boutique's violet neon line where the walls meet the ceiling
      if (info.theme === 'boutique') {
        box(-1, 9, 0, -1, 9, Dr - 1, c.neonViolet);
        box(0, 9, Dr, Wr - 1, 9, Dr, c.neonViolet);
        lamp(Wr / 2, Dr - 1, 2.2, [0.7, 0.45, 1.0], 6, 0.5);
      }
    }
    lamp(Wr / 2, Dr / 2, 2.3, t.lamp, 6.5, ryokan ? 0.7 : 0.9);

    // ---- the window to look out of: the opening nearest the middle of the room
    const [wa0, wa1] = best ?? [A0, A1];
    const wu = flip ? A1 + 1 - (wa0 + wa1 + 1) / 2 : (wa0 + wa1 + 1) / 2 - A0;
    const winStand = M(wu, 1.3);
    const [rx0, rz0] = M(0, 0), [rx1, rz1] = M(Wr, Dr);
    const [vx0, vz0] = lot.xz(A0, D0), [vx1, vz1] = lot.xz(A1, D1);
    // soft indoor light, and the furniture is only drawn near the player like any shop's
    b.indoor.push([Math.min(vx0, vx1), G + base, Math.min(vz0, vz1), Math.max(vx0, vx1), G + base + 10, Math.max(vz0, vz1)]);
    return {
      id: `${info.id}-${spec.floor}`, hotel: info.id, floor: spec.floor, type: spec.type, price: spec.price, y: F,
      rect: [Math.min(rx0, rx1), Math.min(rz0, rz1), Math.max(rx0, rx1), Math.max(rz0, rz1)],
      vox: [Math.min(vx0, vx1), Math.min(vz0, vz1), Math.max(vx0, vx1), Math.max(vz0, vz1)],
      layer: base,
      spawn: [spawnAt[0], spawnAt[1], ang(spawnAt, M(ud + 2.5, 0))],
      door: { stand: spawnAt, pick: [doorPick[0], F + 1.2, doorPick[1]] },
      bed: { stand: bedStand, pick: bedPick, facing: bedFace },
      window: { stand: winStand, pick: [...M(wu, 0), F + 1.5] as P3, facing: ang(winStand, M(wu, -2)) },
      tea,
    };
  }
}
