import { hash3 } from './grid';
import { Prop } from './props';
import type { Builder } from './tokyo';

/**
 * The Duomo's paintings, done as pixel art on fine voxels (an eighth of a metre): the canvases are thin props laid
 * a hair in front of the wall or under the ceiling, twice the resolution of the world's own voxels, so the scenes
 * read: Christ in glory over the high altar, Saint Andrew called from his boat, his martyrdom on the saltire cross, his relics coming ashore at Amalfi
 * in 1208, his glory in heaven, the Immaculata among cherubs, apostles in their niches, the Madonna and Child.
 *
 * Each painting is an Img (u across, v up from the bottom) of palette colours; toProp lays it in the plane it hangs
 * in, turned so it reads the right way round for someone standing in front of it (or under it, looking up).
 */

const pm = (v: number, m: number) => ((v % m) + m) % m;

export function paintColors(b: Builder, glow = 0) {
  // glow: a faint light of their own, for a canvas the candles keep lit after dark (the altarpiece)
  const a = (hex: number, vary = 0.03, emit = 0) => b.pal.add(hex, { vary, emit: Math.max(emit, glow) });
  return {
    skyDeep: a(0x2e4c86), sky: a(0x5d86bf), skyLight: a(0x9dbbdc), glow: a(0xf6dfa4, 0.03, 0.1), glowHot: a(0xfff1c8, 0.02, 0.16),
    cloud: a(0xf1e8d8), cloudShade: a(0xc9bba6), cloudDark: a(0x9b8f86),
    flesh: a(0xe2b48d), fleshShade: a(0xb98361), hairDark: a(0x2f2119), hairBrown: a(0x6b4524), hairGrey: a(0xb8b2a8), hairWhite: a(0xeeeae2),
    red: a(0xb3352c), redDark: a(0x7a2220), blue: a(0x2d559b), blueDark: a(0x1c3466), green: a(0x4f7c45), greenDark: a(0x2f4c2c),
    ochre: a(0xc8933f), ochreDark: a(0x8f6326), white: a(0xf3efe6), whiteShade: a(0xc9c3b7), purple: a(0x6b3d7d), purpleDark: a(0x45264f),
    brown: a(0x6f4a2c), brownDark: a(0x47301d), sand: a(0xd9bd88), sandDark: a(0xb49563), sea: a(0x2f6a8c), seaDark: a(0x1f4a66), seaLight: a(0x8fc0d1),
    hill: a(0x52714a), hillFar: a(0x7d9a8c), stone: a(0xe4dccb), roof: a(0xb06a45), steel: a(0x9aa0a6), steelDark: a(0x5c6166),
    bg: a(0x3a2a22), bgLight: a(0x5d4636), niche: a(0x7a5d44),
    fleshLight: a(0xf3cfa6), fleshDeep: a(0x8a573c), storm: a(0x4a4f5e), stormDark: a(0x2c2d36), stormWarm: a(0x7a6a5e),
    horizon: a(0xe9b872), horizonDeep: a(0xb87a4a), woodLight: a(0xa47a4c), wood: a(0x6e4b2c), woodDark: a(0x3d2817), rope: a(0xcdb27c),
    earth: a(0x5a4430), earthDark: a(0x35281c), olive: a(0x55603a), oliveDark: a(0x343d26),
    gold: a(0xd8ad45, 0.04, 0.08), goldLight: a(0xf2d47d, 0.03, 0.12), goldDeep: a(0xa47a29, 0.04, 0.03),
  };
}
type P = ReturnType<typeof paintColors>;
export type PaintColors = P;

export class Img {
  readonly px: Uint16Array;
  constructor(readonly w: number, readonly h: number, fill = 0) { this.px = new Uint16Array(w * h).fill(fill); }
  set(u: number, v: number, c: number): void {
    u = Math.round(u); v = Math.round(v);
    if (c && u >= 0 && v >= 0 && u < this.w && v < this.h) this.px[v * this.w + u] = c;
  }
  get(u: number, v: number): number { return this.px[v * this.w + u]; }
  rect(u0: number, v0: number, u1: number, v1: number, c: number | ((u: number, v: number) => number)): void {
    for (let v = Math.round(v0); v <= Math.round(v1); v++) for (let u = Math.round(u0); u <= Math.round(u1); u++) this.set(u, v, typeof c === 'number' ? c : c(u, v));
  }
  ell(cu: number, cv: number, ru: number, rv: number, c: number | ((u: number, v: number) => number)): void {
    for (let v = Math.floor(cv - rv); v <= Math.ceil(cv + rv); v++)
      for (let u = Math.floor(cu - ru); u <= Math.ceil(cu + ru); u++)
        if (((u + 0.5 - cu) / ru) ** 2 + ((v + 0.5 - cv) / rv) ** 2 <= 1) this.set(u, v, typeof c === 'number' ? c : c(u, v));
  }
  line(u0: number, v0: number, u1: number, v1: number, c: number, thick = 1): void {
    const n = Math.ceil(Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0)) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const u = u0 + (u1 - u0) * i / n, v = v0 + (v1 - v0) * i / n;
      for (let a = 0; a < thick; a++) for (let b2 = 0; b2 < thick; b2++) this.set(Math.floor(u) + a, Math.floor(v) + b2, c);
    }
  }
}

// ------------------------------------------------------------------------------------------- painting kit

/** A sky from deep blue at the top through blue to a pale band low down, dithered where the bands meet. */
function sky(im: Img, k: P, seed: number, v0 = 0, warm = false): void {
  for (let v = v0; v < im.h; v++) for (let u = 0; u < im.w; u++) {
    const t = (v - v0) / Math.max(1, im.h - 1 - v0) + (hash3(u, v, seed) - 0.5) * 0.14;
    im.set(u, v, t > 0.68 ? k.skyDeep : t > 0.36 ? k.sky : warm ? (t > 0.16 ? k.glow : k.glowHot) : k.skyLight);
  }
}

/** A heavenly glow: gold light opening round (cu, cv), with rays. */
function glory(im: Img, k: P, cu: number, cv: number, r: number, rays = 12): void {
  for (let v = 0; v < im.h; v++) for (let u = 0; u < im.w; u++) {
    const d = Math.hypot(u + 0.5 - cu, (v + 0.5 - cv) * 0.9);
    if (d > r * 1.9) continue;
    const ang = Math.atan2(v + 0.5 - cv, u + 0.5 - cu);
    const ray = Math.abs(Math.sin(ang * rays / 2)) < 0.22;
    if (d < r * 0.55) im.set(u, v, k.glowHot);
    else if (d < r) im.set(u, v, ray ? k.goldLight : k.glow);
    else if (ray && d < r * 1.9) im.set(u, v, d < r * 1.4 ? k.glow : k.goldLight);
  }
}

/** A bank of clouds: overlapping puffs, lit on top and shaded under. */
function clouds(im: Img, k: P, v0: number, v1: number, seed: number, u0 = 0, u1 = im.w): void {
  const n = Math.max(3, Math.round((u1 - u0) / 3.5));
  for (let i = 0; i < n; i++) {
    const cu = u0 + (i + 0.5) * (u1 - u0) / n + (hash3(i, seed, 1) - 0.5) * 2.5;
    const cv = v0 + (v1 - v0) * (0.35 + 0.4 * hash3(i, seed, 2));
    const r = 2.2 + hash3(i, seed, 3) * 2.2;
    im.ell(cu, cv, r * 1.25, r, (u, v) => (v + 0.5 < cv - r * 0.35 ? k.cloudShade : (u + v) % 7 === 0 && v + 0.5 < cv ? k.cloudDark : k.cloud));
  }
}

/** A cherub's head with two little wings. */
function cherub(im: Img, k: P, u: number, v: number): void {
  im.set(u - 1, v, k.white); im.set(u + 1, v, k.white); im.set(u - 1, v + 1, k.whiteShade); im.set(u + 1, v + 1, k.whiteShade);
  im.set(u, v, k.flesh); im.set(u, v + 1, k.hairBrown);
}

const DARK = (k: P) => new Map<number, number>([
  [k.red, k.redDark], [k.blue, k.blueDark], [k.green, k.greenDark], [k.ochre, k.ochreDark], [k.white, k.whiteShade], [k.purple, k.purpleDark],
  [k.brown, k.brownDark], [k.steel, k.steelDark], [k.gold, k.goldDeep],
]);

interface Fig {
  robe: number; mantle?: number; hair: number; beard?: number; halo?: boolean;
  arms?: 'down' | 'pray' | 'up' | 'out' | 'hold' | 'beckon';
  /** Wings (angels), a veil over the head in the mantle's colour (the Madonna), a helmet (soldiers). */
  wings?: boolean; veil?: boolean; helmet?: boolean;
}

/**
 * A standing figure H pixels tall with its feet at (cu, foot): robe widening to the hem with a shaded side, a mantle
 * slung from one shoulder, head and hair, a beard, a halo, arms by pose. Returns the head's centre and the hands.
 */
function figure(im: Img, k: P, cu: number, foot: number, H: number, f: Fig): { head: [number, number]; hands: [number, number][] } {
  const dark = DARK(k);
  const hs = Math.max(2, Math.round(H / 7));
  const neck = foot + H - hs - 1;
  const wb = Math.max(2, H * 0.2), ws = Math.max(1.5, H * 0.13);
  const hc: [number, number] = [cu, neck + hs / 2 + 0.5];
  if (f.wings) {
    im.ell(cu - ws - 1.5, neck - H * 0.12, Math.max(1.5, H * 0.14), H * 0.22, (u, v) => ((u + v) % 3 ? k.white : k.whiteShade));
    im.ell(cu + ws + 1.5, neck - H * 0.12, Math.max(1.5, H * 0.14), H * 0.22, (u, v) => ((u + v) % 3 ? k.white : k.whiteShade));
  }
  if (f.halo) im.ell(hc[0], hc[1], hs * 0.95 + 1, hs * 0.95 + 1, k.goldLight);
  // the robe, hem to shoulders, the side away from the light in shade
  for (let v = foot + 1; v <= neck; v++) {
    const t = (v - foot) / Math.max(1, neck - foot);
    const half = wb + (ws - wb) * t;
    for (let u = Math.floor(cu - half); u <= Math.ceil(cu + half) - 1; u++) {
      const edge = u + 0.5 > cu + half * 0.45;
      im.set(u, v, edge ? dark.get(f.robe) ?? f.robe : f.robe);
    }
  }
  // the mantle: from the left shoulder across to the right hip and down the left side
  if (f.mantle) {
    for (let v = foot + 1; v <= neck; v++) {
      const t = (v - foot) / Math.max(1, neck - foot);
      const half = wb + (ws - wb) * t;
      const cut = cu - half + (1 - t) * half * 1.4;
      for (let u = Math.floor(cu - half); u <= Math.ceil(cu + half) - 1; u++)
        if (u + 0.5 < cut || (t > 0.75 && u + 0.5 < cu - half * 0.2)) im.set(u, v, (u + v) % 5 === 0 ? dark.get(f.mantle) ?? f.mantle : f.mantle);
    }
  }
  // feet
  im.set(cu - 1, foot, k.brownDark); im.set(cu, foot, k.brownDark);
  // head: face, hair, beard, veil or helmet
  const h0 = Math.round(cu - hs / 2), v0 = neck + 1;
  im.rect(h0, v0, h0 + hs - 1, v0 + hs - 1, k.flesh);
  im.set(h0 + hs - 1, v0, k.fleshShade);
  im.rect(h0, v0 + hs - 1, h0 + hs - 1, v0 + hs - 1, f.hair);
  if (hs > 2) {
    im.set(h0, v0 + hs - 2, f.hair);
    // eyes under the brow, either side of the nose
    const ev = v0 + hs - 2;
    if (hs === 3) { im.set(h0 + 1, ev, k.fleshShade); } else { im.set(h0 + 1, ev, k.hairDark); im.set(h0 + hs - 2, ev, k.hairDark); }
  }
  if (f.beard) {
    im.rect(h0, v0, h0 + hs - 1, v0, f.beard);
    if (hs > 2) { im.set(h0, v0 + 1, f.beard); im.set(h0 + hs - 1, v0 + 1, f.beard); }
    if (hs > 3) im.set(h0 + (hs >> 1), v0 - 1, f.beard);
  }
  if (f.veil && f.mantle) { im.rect(h0 - 1, v0 - 1, h0 - 1, v0 + hs - 1, f.mantle); im.rect(h0 + hs, v0 - 1, h0 + hs, v0 + hs - 1, f.mantle); im.rect(h0 - 1, v0 + hs, h0 + hs, v0 + hs, f.mantle); }
  if (f.helmet) { im.rect(h0 - 1, v0 + hs - 1, h0 + hs, v0 + hs, k.steel); im.set(cu, v0 + hs + 1, k.red); }
  // arms and hands
  const sh = neck - 1, hands: [number, number][] = [];
  const arm = (du: number, dv: number, side: number) => {
    const s0 = cu + side * ws, e: [number, number] = [s0 + du * side, sh + dv];
    im.line(s0, sh, e[0], e[1], f.mantle && side < 0 ? f.mantle : f.robe, H > 14 ? 2 : 1);
    im.set(e[0], e[1], k.flesh);
    hands.push(e);
  };
  switch (f.arms ?? 'down') {
    case 'pray': im.set(cu, sh - H * 0.12, k.flesh); im.set(cu - 1, sh - H * 0.12, k.flesh); hands.push([cu, sh - H * 0.12]); break;
    case 'up': arm(H * 0.2, H * 0.3, -1); arm(H * 0.2, H * 0.3, 1); break;
    case 'out': arm(H * 0.3, H * 0.02, -1); arm(H * 0.3, H * 0.02, 1); break;
    case 'beckon': arm(H * 0.05, -H * 0.3, -1); arm(H * 0.32, H * 0.08, 1); break;
    case 'hold': arm(H * 0.06, -H * 0.25, -1); arm(H * 0.14, -H * 0.14, 1); break;
    default: break;
  }
  return { head: hc, hands };
}

/** A gilt frame w0 pixels wide round the image: lit on the top and left edges, in shade at the bottom and right. */
function frame(im: Img, k: P, w0: number): void {
  for (let v = 0; v < im.h; v++) for (let u = 0; u < im.w; u++) {
    const e = Math.min(u, v, im.w - 1 - u, im.h - 1 - v);
    if (e >= w0) continue;
    const lit = u < w0 || v >= im.h - w0;
    im.set(u, v, e === w0 - 1 && w0 > 1 ? k.goldDeep : lit ? (pm(u + v, 4) === 0 ? k.gold : k.goldLight) : k.gold);
  }
}

// ------------------------------------------------------------------------------------------- the scenes

/** Andrew in glory: carried up on clouds with his cross, angels either side, cherubs in the gold light. */
function gloryOfAndrew(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.sky);
  sky(im, k, seed);
  glory(im, k, w / 2, h * 0.66, Math.min(w, h) * 0.42);
  clouds(im, k, 0, h * 0.3, seed);
  const H = Math.round(h * 0.42), foot = Math.round(h * 0.24);
  // the saltire behind him
  im.line(w * 0.18, foot + H * 0.95, w * 0.82, foot + H * 0.05, k.brown, 2);
  im.line(w * 0.18, foot + H * 0.05, w * 0.82, foot + H * 0.95, k.brown, 2);
  figure(im, k, w / 2, foot, H, { robe: k.green, mantle: k.ochre, hair: k.hairWhite, beard: k.hairWhite, halo: true, arms: 'up' });
  for (const s of [-1, 1]) figure(im, k, w / 2 + s * w * 0.33, foot + H * 0.45, Math.round(H * 0.5), { robe: s < 0 ? k.white : k.red, hair: k.hairBrown, wings: true, arms: 'pray' });
  for (let i = 0; i < 4; i++) cherub(im, k, Math.round(w * (0.15 + 0.7 * hash3(i, seed, 4))), Math.round(h * (0.78 + 0.16 * hash3(i, seed, 5))));
  return im;
}

/** The calling: Christ on the shore beckons, Andrew and Peter look up from their boat and nets on the lake. */
function calling(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.sky);
  sky(im, k, seed, Math.round(h * 0.6));
  // hills across the lake, the water, the shore
  for (let u = 0; u < w; u++) {
    const top = Math.round(h * 0.62 + 2 + Math.sin(u * 0.5 + seed) * 1.5 + Math.sin(u * 0.17) * 2);
    im.rect(u, h * 0.6, u, top, (_u, v) => (v > top - 2 ? k.hillFar : k.hill));
  }
  im.rect(0, h * 0.24, w - 1, h * 0.6, (u, v) => (hash3(u, v, seed) < 0.12 ? k.seaLight : (v + (u >> 2)) % 5 === 0 ? k.seaDark : k.sea));
  im.rect(0, 0, w - 1, h * 0.24, (u, v) => (hash3(u, v, seed + 1) < 0.15 ? k.sandDark : k.sand));
  // the boat with its mast and the net over the side, the two brothers in it
  const bu = w * 0.66, bv = Math.round(h * 0.38);
  for (let i = 0; i < 3; i++) im.rect(bu - 6 + i, bv - i, bu + 6 - i, bv - i, i === 0 ? k.brown : k.brownDark);
  im.line(bu + 1, bv + 1, bu + 1, bv + h * 0.3, k.brownDark);
  im.line(bu + 1, bv + h * 0.3, bu + 5, bv + 2, k.whiteShade);
  for (let i = 0; i < 5; i++) im.set(bu - 7 - (i & 1), bv - i - 1, k.steelDark);
  figure(im, k, bu - 3, bv + 1, Math.round(h * 0.17), { robe: k.ochre, hair: k.hairGrey, beard: k.hairGrey, arms: 'out' });
  figure(im, k, bu + 3, bv + 1, Math.round(h * 0.17), { robe: k.green, hair: k.hairBrown, beard: k.hairBrown, arms: 'down' });
  // Christ on the shore: red robe, blue mantle, his hand raised to call them
  figure(im, k, w * 0.27, Math.round(h * 0.06), Math.round(h * 0.46), { robe: k.red, mantle: k.blue, hair: k.hairBrown, beard: k.hairBrown, halo: true, arms: 'beckon' });
  return im;
}

/** The martyrdom at Patras: Andrew bound to the X-shaped cross, soldiers below, an angel bringing the crown and palm. */
function martyrdom(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.sky);
  sky(im, k, seed);
  glory(im, k, w * 0.72, h * 0.9, w * 0.32, 10);
  clouds(im, k, h * 0.74, h * 0.96, seed, 0, w * 0.45);
  // the hill of execution and the city of Patras behind it
  for (let u = 0; u < w; u += 3) { const t = Math.round(h * 0.2 + hash3(u, 0, seed) * 4); im.rect(u, h * 0.15, u + 2, t, (uu, v) => (v === t ? k.roof : (uu + v) % 3 ? k.stone : k.whiteShade)); }
  im.rect(0, 0, w - 1, h * 0.15, (u, v) => (hash3(u, v, seed) < 0.2 ? k.brownDark : k.brown));
  // the saltire, its beams crossing at the saint's waist, lit along one edge
  const cx = w / 2, cy = h * 0.5, a = Math.min(w * 0.42, h * 0.3);
  const beam = (s0: number) => {
    im.line(cx - a * s0, cy - a * 1.15, cx + a * s0, cy + a * 1.15, k.brownDark, 3);
    im.line(cx - a * s0, cy - a * 1.15 + 1, cx + a * s0, cy + a * 1.15 + 1, k.brown, 1);
  };
  beam(1); beam(-1);
  // the saint bound to it: arms along the upper beams, legs along the lower ones, white cloth, white beard, halo
  const s = a * 0.85;
  im.line(cx - 2, cy + 3, cx - s, cy + s * 1.15, k.flesh, 2);
  im.line(cx + 1, cy + 3, cx + s, cy + s * 1.15, k.flesh, 2);
  im.line(cx - 2, cy - 3, cx - s * 0.75, cy - s * 0.95, k.fleshShade, 2);
  im.line(cx + 1, cy - 3, cx + s * 0.75, cy - s * 0.95, k.fleshShade, 2);
  im.ell(cx, cy + 9.5, 3.6, 3.6, k.goldLight);
  im.rect(cx - 2, cy - 3, cx + 2, cy + 6, (u, v) => (u === Math.round(cx + 2) || v === Math.round(cy + 6) - 6 ? k.fleshShade : k.flesh));
  im.rect(cx - 2, cy - 3, cx + 2, cy - 1, (u) => (u === Math.round(cx + 2) ? k.whiteShade : k.white));
  im.rect(cx - 1, cy + 7, cx + 1, cy + 10, k.flesh);
  im.rect(cx - 1, cy + 7, cx + 1, cy + 7, k.hairWhite);
  im.set(cx - 1, cy + 8, k.hairWhite); im.set(cx + 1, cy + 8, k.hairWhite);
  im.set(cx - 1, cy + 9, k.hairDark); im.set(cx + 1, cy + 9, k.hairDark);
  im.rect(cx - 1, cy + 11, cx + 1, cy + 11, k.hairWhite);
  // the angel coming down with the martyr's crown and palm
  const ang = figure(im, k, w * 0.74, h * 0.74, Math.round(h * 0.18), { robe: k.white, hair: k.hairBrown, wings: true, arms: 'hold' });
  im.ell(ang.hands[0][0] - 1, ang.hands[0][1], 1.5, 1, k.gold);
  im.line(ang.hands[1][0], ang.hands[1][1], ang.hands[1][0] + 2, ang.hands[1][1] + 4, k.green);
  // soldiers and the grieving Maximilla below
  for (const [u, robe] of [[w * 0.14, k.red], [w * 0.86, k.purple]] as const) {
    const f = figure(im, k, u, Math.round(h * 0.04), Math.round(h * 0.22), { robe, hair: k.hairDark, helmet: true, arms: 'hold' });
    im.line(f.hands[1][0], f.hands[1][1] - 3, f.hands[1][0] + 1, f.hands[1][1] + h * 0.14, k.steelDark);
  }
  figure(im, k, w * 0.38, Math.round(h * 0.03), Math.round(h * 0.15), { robe: k.white, mantle: k.blue, hair: k.hairBrown, veil: true, arms: 'pray' });
  return im;
}

/** 1208: the relics come ashore at Amalfi from Constantinople, the town on its cliffs welcoming the ship. */
function arrival(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.sky);
  sky(im, k, seed, Math.round(h * 0.45), true);
  // the coast on the right: cliffs, white houses climbing them, the bell tower
  for (let u = 0; u < w; u++) {
    const top = Math.round(h * 0.45 + Math.max(0, (u - w * 0.35)) * 1.6 + Math.sin(u * 0.7) * 1.2);
    for (let v = Math.round(h * 0.35); v <= Math.min(h - 1, top); v++) {
      const house = u > w * 0.45 && hash3(u >> 1, v >> 1, seed) < 0.55;
      im.set(u, v, house ? ((v & 1) === 0 && hash3(u >> 1, v >> 1, seed + 1) < 0.4 ? k.roof : k.stone) : (u + v) % 4 === 0 ? k.greenDark : k.hill);
    }
  }
  im.rect(w * 0.72, h * 0.5, w * 0.72 + 1, h * 0.72, (_u, v) => (v % 4 === 0 ? k.ochre : k.stone));
  im.rect(w * 0.72, h * 0.73, w * 0.72 + 1, h * 0.75, k.green);
  // the sea and the ship with its red-crossed sails
  im.rect(0, h * 0.14, w * 0.6, h * 0.44, (u, v) => (hash3(u, v, seed) < 0.1 ? k.seaLight : (v + (u >> 2)) % 6 === 0 ? k.seaDark : k.sea));
  const su = w * 0.3, sv = Math.round(h * 0.3);
  for (let i = 0; i < 3; i++) im.rect(su - 6 + i, sv - i, su + 6 - i, sv - i, i === 0 ? k.brown : k.brownDark);
  im.line(su, sv + 1, su, sv + h * 0.28, k.brownDark);
  im.rect(su - 4, sv + 5, su + 4, sv + h * 0.24, (u, v) => (Math.abs(u - su) < 0.6 || v === Math.round(sv + h * 0.16) ? k.red : k.white));
  im.set(su + 1, sv + h * 0.28, k.red); im.set(su + 2, sv + h * 0.28, k.red);
  // the shore below, the bishop in his mitre and the townsfolk kneeling
  im.rect(0, 0, w - 1, h * 0.14, (u, v) => (hash3(u, v, seed + 2) < 0.18 ? k.sandDark : k.sand));
  const bp = figure(im, k, w * 0.62, 1, Math.round(h * 0.26), { robe: k.white, mantle: k.gold, hair: k.hairGrey, beard: k.hairGrey, arms: 'out' });
  im.rect(bp.head[0] - 1, bp.head[1] + 2, bp.head[0] + 1, bp.head[1] + 3, k.white); im.set(bp.head[0], bp.head[1] + 4, k.gold);
  for (const [u, robe] of [[w * 0.18, k.blue], [w * 0.36, k.red], [w * 0.84, k.green]] as const)
    figure(im, k, u, 1, Math.round(h * 0.13), { robe, hair: k.hairDark, arms: 'pray' });
  return im;
}

/** The Immaculata: Mary in white and blue on the crescent moon, crowned with stars, among clouds and cherubs. */
function immaculata(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.sky);
  sky(im, k, seed);
  glory(im, k, w / 2, h * 0.6, Math.min(w, h) * 0.45, 16);
  clouds(im, k, 0, h * 0.28, seed);
  const foot = Math.round(h * 0.24), H = Math.round(h * 0.5);
  im.ell(w / 2, foot, w * 0.22, 1.6, k.goldLight);
  const f = figure(im, k, w / 2, foot + 1, H, { robe: k.white, mantle: k.blue, hair: k.hairBrown, veil: true, arms: 'pray' });
  for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; im.set(f.head[0] + Math.cos(a) * 4.5, f.head[1] + 1 + Math.sin(a) * 4.5, k.goldLight); }
  for (let i = 0; i < 5; i++) cherub(im, k, Math.round(w * (0.12 + 0.76 * hash3(i, seed, 6))), Math.round(h * (0.16 + 0.12 * hash3(i, seed, 7))));
  return im;
}

/** An apostle standing in a painted niche, with what tells him apart: Peter's keys, Paul's sword, John's cup... */
export function apostle(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.bg);
  // the niche: a round-headed arch of warm light behind him, a step under his feet
  const nw = w * 0.36, top = h * 0.72;
  im.rect(w / 2 - nw, 2, w / 2 + nw, top, (u, v) => (hash3(u, v, seed) < 0.15 ? k.bgLight : k.niche));
  im.ell(w / 2, top, nw + 0.5, nw * 0.9, (u, v) => (hash3(u, v, seed) < 0.15 ? k.bgLight : k.niche));
  im.rect(0, 0, w - 1, 1, k.brownDark);
  const ROBES = [[k.blue, k.ochre], [k.red, k.green], [k.green, k.red], [k.purple, k.ochre], [k.ochre, k.blue], [k.white, k.red]] as const;
  const [robe, mantle] = ROBES[seed % ROBES.length];
  const old = seed % 3 !== 1;
  const f = figure(im, k, w / 2, 2, Math.round(h * 0.78), { robe, mantle, hair: old ? k.hairGrey : k.hairBrown, beard: old ? k.hairGrey : undefined, halo: true, arms: 'hold' });
  const [lh, rh] = f.hands;
  switch (seed % 5) {
    case 0: im.line(rh[0], rh[1], rh[0] + 1, rh[1] + 4, k.goldLight); im.line(rh[0] + 1, rh[1] + 3, rh[0] + 3, rh[1] + 3, k.goldLight); break; // keys
    case 1: im.line(rh[0], rh[1] - 5, rh[0] + 1, rh[1] + 6, k.steel); im.line(rh[0] - 1, rh[1] + 1, rh[0] + 2, rh[1] + 1, k.goldDeep); break; // sword
    case 2: im.rect(rh[0], rh[1], rh[0] + 1, rh[1] + 2, k.gold); break; // cup
    case 3: im.line(rh[0] - 3, rh[1] - 4, rh[0] + 3, rh[1] + 6, k.brown); im.line(rh[0] + 3, rh[1] - 4, rh[0] - 3, rh[1] + 6, k.brown); break; // saltire
    default: im.line(rh[0], rh[1] - 6, rh[0], rh[1] + 8, k.brownDark); im.set(rh[0] + 1, rh[1] + 6, k.white); break; // pilgrim's staff
  }
  im.rect(lh[0] - 2, lh[1], lh[0], lh[1] + 2, seed % 2 ? k.red : k.redDark); // the book in his other hand
  frame(im, k, 2);
  return im;
}

/** The Madonna and Child: Mary in red and blue holding the child, gold behind them. */
function madonna(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.bg);
  im.ell(w / 2, h * 0.62, w * 0.42, h * 0.5, (u, v) => (hash3(u, v, seed) < 0.2 ? k.gold : k.goldDeep));
  const f = figure(im, k, w / 2, 1, h - 3, { robe: k.red, mantle: k.blue, hair: k.hairBrown, veil: true, halo: true, arms: 'hold' });
  const [cu, cv] = [f.hands[0][0] + 1, f.hands[0][1] + 2];
  im.ell(cu, cv + 1, 1.6, 1.6, k.goldLight);
  im.rect(cu - 1, cv - 2, cu, cv, k.flesh);
  im.set(cu, cv + 1, k.flesh); im.set(cu - 1, cv + 1, k.flesh);
  frame(im, k, 1);
  return im;
}

/** Saint Andrew alone, old and white-bearded, holding his cross. */
function andrew(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.bg);
  sky(im, k, seed, 0, true);
  im.rect(0, 0, w - 1, 2, k.brown);
  const f = figure(im, k, w / 2, 2, h - 5, { robe: k.green, mantle: k.ochre, hair: k.hairWhite, beard: k.hairWhite, halo: true, arms: 'hold' });
  const [hu, hv] = f.hands[1];
  im.line(hu - 3, hv - 5, hu + 2, hv + 7, k.brown); im.line(hu + 2, hv - 5, hu - 3, hv + 7, k.brown);
  frame(im, k, 1);
  return im;
}

/**
 * A fresco on the crypt's walls, w x h: a saint standing on a strip of ground under a pale sky that warms to gold
 * round his head, each with his robe colours and what he carries. Narrow panels (where the wall runs out) get
 * the sky alone, with a cherub.
 */
export function fresco(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.skyLight);
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    const t = v / Math.max(1, h - 1) + (hash3(u, v, seed) - 0.5) * 0.12;
    im.set(u, v, t > 0.8 ? k.sky : t > 0.45 ? k.skyLight : k.cloud);
  }
  im.rect(0, 0, w - 1, 1, (u, v) => (v === 1 && hash3(u, v, seed + 1) < 0.5 ? k.green : k.greenDark));
  if (w < 9) { cherub(im, k, Math.floor(w / 2), Math.round(h * 0.7)); return im; }
  const ROBES = [[k.red, k.blue], [k.green, k.ochre], [k.purple, k.white], [k.blue, k.red], [k.ochre, k.green], [k.white, k.purple]] as const;
  const [robe, mantle] = ROBES[seed % ROBES.length];
  const old = seed % 3 !== 2;
  const H = Math.round(h * 0.8);
  glory(im, k, w / 2, 2 + H - 1, H * 0.22, 8);
  const f = figure(im, k, Math.floor(w / 2), 2, H, { robe, mantle, hair: old ? k.hairGrey : k.hairBrown, beard: old ? k.hairGrey : undefined, halo: true, arms: seed % 2 ? 'hold' : 'pray' });
  if (seed % 2) {
    const [lh, rh] = f.hands;
    if (seed % 4 === 1) im.line(rh[0], rh[1] - 4, rh[0], rh[1] + 5, k.brownDark); // a staff
    else { im.line(rh[0] - 2, rh[1] - 3, rh[0] + 2, rh[1] + 4, k.brown); im.line(rh[0] + 2, rh[1] - 3, rh[0] - 2, rh[1] + 4, k.brown); } // the saltire
    im.rect(lh[0] - 1, lh[1], lh[0], lh[1] + 1, k.redDark); // a book
  }
  return im;
}

/** The painted medallion in the attic over a bay: an oval in a gilt rim, an evangelist half-length against the sky. */
export function medallion(k: P, w: number, h: number, seed: number): Img {
  const im = new Img(w, h, k.skyLight);
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) im.set(u, v, v > h * 0.6 + (hash3(u, v, seed) - 0.5) * 2 ? k.sky : k.skyLight);
  glory(im, k, w / 2, h * 0.62, Math.min(w, h) * 0.22, 8);
  const robes = [[k.red, k.blue], [k.green, k.red], [k.blue, k.ochre], [k.purple, k.green]] as const;
  const [robe, mantle] = robes[seed % robes.length];
  const f = figure(im, k, Math.floor(w / 2), -Math.round(h * 0.55), Math.round(h * 1.2), { robe, mantle, hair: seed % 2 ? k.hairGrey : k.hairBrown, beard: seed % 2 ? k.hairGrey : undefined, halo: true, arms: 'hold' });
  im.rect(f.hands[1][0] - 1, f.hands[1][1], f.hands[1][0] + 1, f.hands[1][1] + 2, k.white); // his gospel, open
  // the oval: outside it nothing (the wall shows), its rim in gold lit from above
  const cu = w / 2, cv = h / 2;
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    const e = Math.hypot((u + 0.5 - cu) / (w / 2), (v + 0.5 - cv) / (h / 2));
    if (e > 1) im.px[v * w + u] = 0;
    else if (e > 0.84) im.px[v * w + u] = v + 0.5 > cv ? k.goldLight : k.gold;
  }
  return im;
}

/**
 * A small framed picture for a house, a hotel or a shop, w x h with its frame: `kind` picks the subject, the frame
 * is gilt, dark wood, or brocade-mounted silk for a hanging scroll.
 */
export type PictureKind = 'coast' | 'lemons' | 'bosphorus' | 'fuji' | 'plum' | 'wave' | 'madonna';
export function picture(k: P, kind: PictureKind, w: number, h: number, seed: number, scroll = false): Img {
  const im = new Img(w, h, k.white);
  const f0 = scroll || kind === 'madonna' ? 0 : 1; // frame width
  const W = w - 2 * f0, H = h - 2 * f0;
  const set = (u: number, v: number, c: number) => { if (u >= 0 && v >= 0 && u < W && v < H) im.set(u + f0, v + f0, c); };
  const fill = (fn: (u: number, v: number) => number) => { for (let v = 0; v < H; v++) for (let u = 0; u < W; u++) set(u, v, fn(u, v)); };
  const n = (u: number, v: number, s = 0) => hash3(u, v, seed + s);
  switch (kind) {
    case 'coast': {
      // the Amalfi coast: blue sea, the cliffs with a white town, a sail
      const sea = Math.round(H * 0.4);
      fill((u, v) => (v < sea ? (n(u, v) < 0.2 ? k.seaLight : k.sea) : v > H - 2 ? k.sky : k.skyLight));
      for (let u = 0; u < W; u++) {
        const top = sea + Math.round((1 - u / W) * (H - sea) * 0.85);
        for (let v = sea; v < top; v++) set(u, v, v < top - 1 && (u + v) % 3 === 0 ? k.stone : u < W * 0.35 && v > sea + 1 ? k.roof : k.hill);
      }
      set(Math.round(W * 0.7), sea, k.white); set(Math.round(W * 0.7), sea + 1, k.white);
      break;
    }
    case 'lemons': {
      // a still life: lemons and a blue jug on a white cloth, a dark ground
      fill((u, v) => (v < H * 0.35 ? k.whiteShade : n(u, v) < 0.2 ? k.bgLight : k.bg));
      for (let i = 0; i < 3; i++) { const lu = Math.round(W * (0.25 + i * 0.18)), lv = Math.round(H * 0.4); set(lu, lv, k.goldLight); set(lu + 1, lv, k.gold); set(lu, lv + 1, k.goldLight); }
      for (let v = Math.round(H * 0.38); v < H * 0.8; v++) { set(W - 3, v, k.blue); set(W - 2, v, k.blueDark); }
      set(Math.round(W * 0.42), Math.round(H * 0.55), k.green);
      break;
    }
    case 'bosphorus': {
      // a ferry crossing the Bosphorus, the far shore with a mosque's dome and minarets, a pale sky
      const sea = Math.round(H * 0.45);
      fill((u, v) => (v < sea ? (n(u, v) < 0.15 ? k.seaLight : k.sea) : v === sea ? k.hillFar : k.skyLight));
      const du = Math.round(W * 0.6);
      set(du, sea + 1, k.stone); set(du + 1, sea + 1, k.stone); set(du - 1, sea + 1, k.stone); set(du, sea + 2, k.stone);
      for (const mu of [du - 3, du + 3]) for (let v = sea + 1; v < sea + 4; v++) set(mu, v, k.white);
      const fu = Math.round(W * (0.2 + 0.2 * (seed & 1)));
      for (let u = fu; u < fu + 4; u++) set(u, sea - 2, k.white);
      for (let u = fu; u < fu + 4; u++) set(u, sea - 3, u === fu ? k.blueDark : k.white);
      set(fu + 2, sea - 1, k.ochre); set(fu + 2, sea - 1, k.ochre);
      set(fu + 1, sea - 1, k.white);
      break;
    }
    case 'madonna': {
      // the shrine's majolica Madonna: blue mantle, white veil, a gold halo, on yellow tiles in a blue border
      fill((u, v) => (u === 0 || v === 0 || u === W - 1 || v === H - 1 ? k.blue : (u + v) % 2 ? k.goldLight : k.glow));
      const cu = Math.floor(W / 2);
      for (let v = 1; v < H - 3; v++) for (let u = cu - 2 + (v > H * 0.6 ? 1 : 0); u <= cu + 1 - (v > H * 0.6 ? 1 : 0) + (v < 3 ? 1 : 0); u++) set(u, v, u === cu + 1 && v < H * 0.6 ? k.blueDark : k.blue);
      set(cu - 1, H - 4, k.flesh); set(cu, H - 4, k.flesh); set(cu - 1, H - 3, k.white); set(cu, H - 3, k.white);
      set(cu - 2, H - 3, k.gold); set(cu + 1, H - 3, k.gold); set(cu - 1, H - 2, k.gold); set(cu, H - 2, k.gold);
      set(cu - 1, Math.round(H * 0.45), k.flesh); set(cu, Math.round(H * 0.45), k.white); // the child in her arms
      break;
    }
    case 'fuji': case 'plum': case 'wave': {
      // ink and a little colour on paper: Fuji over a band of mist under a red sun, a plum branch in flower, a wave
      const paper = (u: number, v: number) => (n(u, v, 3) < 0.1 ? k.whiteShade : k.white);
      const p0 = scroll ? 2 : 0, p1 = scroll ? H - 3 : H; // a scroll's brocade mounts, top and bottom
      fill((u, v) => (v < p0 || v >= p1 ? (v === 0 || v === H - 1 ? k.brownDark : k.ochreDark) : paper(u, v)));
      const PW = W, PH = p1 - p0;
      const at = (u: number, v: number, c: number) => { if (u >= 0 && u < PW && v >= 0 && v < PH) set(u, p0 + v, c); };
      if (kind === 'fuji') {
        const cu = (PW - 1) / 2, base = Math.max(1, Math.round(PH * 0.2)), peak = Math.round(PH * 0.72);
        for (let v = base; v < PH; v++) for (let u = 0; u < PW; u++) at(u, v, v > PH * 0.78 ? k.sky : k.skyLight); // the sky, graded
        for (let v = base; v <= peak; v++) {
          const t = (v - base) / Math.max(1, peak - base), half = (1 - t) * PW * 0.5 + 0.3;
          for (let u = Math.round(cu - half); u <= Math.round(cu + half); u++) {
            const snow = t > 0.58 - (u % 2) * 0.12;
            at(u, v, snow ? (u > cu ? k.whiteShade : k.white) : u > cu ? k.blueDark : k.steelDark);
          }
        }
        for (let u = 0; u < PW; u++) at(u, base, n(u, 0, 4) < 0.6 ? k.cloud : k.cloudShade); // the mist at its foot
        for (let v = 0; v < base; v++) for (let u = 0; u < PW; u++) at(u, v, (u + v) % 3 ? k.greenDark : k.oliveDark);
        at(PW - 2, PH - 2, k.red); if (PW > 6) { at(PW - 3, PH - 2, k.red); at(PW - 2, PH - 3, k.red); at(PW - 3, PH - 3, k.red); }
      } else if (kind === 'plum') {
        // an old branch rising from the lower left, twigs off it, blossoms red and white along them
        const pts: [number, number][] = [];
        for (let v = 0; v < PH; v++) pts.push([Math.round(v * (PW - 2) / Math.max(1, PH - 1) + (v % 3 === 1 ? 1 : 0)), v]);
        for (const [u, v] of pts) at(u, v, k.hairDark);
        for (let i = 1; i < pts.length - 1; i += 2) {
          const [u, v] = pts[i];
          const side = i % 4 === 1 ? -1 : 1;
          at(u + side, v + 1, k.hairDark);
          at(u + side * 2, v + 1, i % 3 ? k.red : k.white);
          at(u - side, v, k.red);
        }
        at(PW - 1, PH - 1, k.red); // the seal
      } else {
        // the great wave curling over, its foam claws, Fuji small in the trough
        for (let v = 0; v < PH; v++) for (let u = 0; u < PW; u++) {
          const crest = PH * (0.35 + 0.45 * Math.max(0, 1 - Math.abs(u - PW * 0.3) / (PW * 0.45)));
          if (v < crest) at(u, v, v >= crest - 1 ? k.white : (u + 2 * v) % 5 === 0 ? k.skyLight : k.blueDark);
        }
        at(PW - 2, Math.round(PH * 0.35), k.steelDark); at(PW - 2, Math.round(PH * 0.35) + 1, k.white);
      }
      break;
    }
  }
  // the frame: gilt for the south, dark wood for Japan's prints
  if (f0) for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    if (u > 0 && v > 0 && u < w - 1 && v < h - 1) continue;
    im.set(u, v, kind === 'wave' || kind === 'fuji' ? k.brownDark : v === h - 1 || u === 0 ? k.goldLight : k.gold);
  }
  return im;
}

/** The ceiling's canvases, from the altar back to the doors. */
export function ceilingScene(k: P, i: number, w: number, h: number): Img {
  const f = [gloryOfAndrew, calling, martyrdom, arrival, immaculata][i % 5];
  const im = f(k, w, h, 31 + i * 7);
  frame(im, k, 1);
  return im;
}

/**
 * Pixel sprite: rows from the top, one character per pixel ('.' leaves what is there), placed with its top-left
 * pixel at (u0, vTop).
 */
function sprite(im: Img, rows: string[], u0: number, vTop: number, map: Record<string, number>): void {
  rows.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.' && ch !== ' ') im.set(u0 + i, vTop - r, map[ch]); }));
}

/** Christ in glory, standing on the clouds: hair, face, beard, the red robe, the blue mantle, the blessing hand, the orb. */
const CHRIST = [
  '.......HHHHH......',
  '......HHHDHHH.....',
  '......HLLFFSH.....',
  '.....HHLEFESHD....',
  '..L..HHLFSFSHD....',
  '..LF.HDLFFFSHD....',
  '.LFF.HDBBMBBHD....',
  '.LFFS.D.BBBu.D....',
  '..FS..RRBBBUUu....',
  '..RR.RRRRBUUUUu...',
  '..RrRRRRRrUUUUuu..',
  '...RrRRRRrUUUUUu..',
  '...rRRRRRrUUUUUu..',
  '....RRRRRrUUUUuU..',
  '....RRRRRrUUUUgu..',
  '....RRrRRrUUUWKk..',
  '....RRrRRrUUUKKk..',
  '....RRrRRrUUUFkk..',
  '....UUORRrUUuFF...',
  '....uUUOORrUUu....',
  '.....uUUUOOUUu....',
  '.....RRuUUUOOUu...',
  '.....RRRruUUUUu...',
  '.....RRrRRuUUUUu..',
  '....RRRrRRUUuUUu..',
  '....RRRrRRUUuUUu..',
  '....RRRRrRUUuUUUu.',
  '....RRRRrRUUUuUUu.',
  '...RRRRRrRUUUuUUu.',
  '...RRRRRrRUUUuUUu.',
  '...rRRRRrRrUUUuUu.',
  '...rRRRRRrrUUUuUu.',
  '...rrRRRRrrUUUUuu.',
  '....rrrrrrrruuuuu.',
  '.....LF..FS.......',
];

/**
 * The altarpiece: Christ in glory, the Redeemer standing on the clouds in a blaze of gold, his right hand raised in
 * blessing, the orb of the world in his left, the halo with its cross behind his head, cherubs in the clouds.
 * Pixel art at the fine voxels' density, like every painting in the game (24 x 50, frame included).
 */
export function altarpiece(k: P, w: number, h: number): Img {
  const im = new Img(w, h, k.goldDeep);
  const seed = 5;
  const u0 = Math.round(w / 2 - 9), top = h - 5; // the sprite's top-left
  const hc: [number, number] = [u0 + 9, top - 3]; // the middle of his face
  // the glory: white gold round his head, deepening to amber at the edges, rays all round
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    const dx = u + 0.5 - hc[0], dy = (v + 0.5 - hc[1]) * 0.6;
    const d = Math.hypot(dx, dy), n = (hash3(u, v, seed) - 0.5) * 1.6;
    const ray = Math.abs(Math.sin(Math.atan2(dy, dx) * 8)) < 0.3;
    im.set(u, v, d < 5 + n ? k.glowHot : d < 8 + n ? (ray ? k.glowHot : k.glow) : d < 12 + n ? (ray ? k.glow : k.goldLight) : d < 16 + n ? (ray ? k.goldLight : k.gold) : ray ? k.gold : k.goldDeep);
  }
  // the clouds he stands on, lit from above, cherubs' heads among them
  for (const [cu, cv, r] of [[3, 4, 3.4], [8, 3, 3.2], [13, 3.5, 3.4], [18, 3, 3.2], [22, 4.5, 3], [5, 8, 2.6], [19, 8, 2.6], [12, 7.5, 2.8], [2, 12, 2], [22, 12, 2]] as [number, number, number][])
    im.ell(cu * w / 24, cv, r * 1.25, r, (u, v) => (v + 0.5 > cv + r * 0.4 ? k.cloud : v + 0.5 > cv - r * 0.2 ? (hash3(u, v, seed + 1) < 0.25 ? k.cloud : k.cloudShade) : k.cloudDark));
  for (const [cu, cv] of [[3, 9], [20, 9]]) {
    im.set(cu - 1, cv, k.white); im.set(cu + 1, cv, k.whiteShade);
    im.set(cu, cv, k.flesh); im.set(cu, cv + 1, k.hairBrown);
  }
  // the halo with its cross, behind his head
  im.ell(hc[0], hc[1] + 0.5, 4.6, 4.6, (u, v) => {
    const du = u + 0.5 - hc[0], dv = v + 0.5 - hc[1] - 0.5, r = Math.hypot(du, dv);
    if (r > 3.9) return k.goldDeep;
    if ((Math.abs(du) < 0.6 && dv > 1.5) || (Math.abs(dv) < 0.6 && Math.abs(du) > 2.2)) return k.red;
    return r > 3.0 ? k.gold : k.goldLight;
  });
  sprite(im, CHRIST, u0, top, {
    H: k.hairBrown, D: k.hairDark, L: k.fleshLight, F: k.flesh, S: k.fleshShade, E: k.hairDark, B: k.hairBrown, M: k.fleshDeep,
    R: k.red, r: k.redDark, U: k.blue, u: k.blueDark, O: k.ochre, W: k.skyLight, K: k.sky, k: k.blueDark, g: k.goldLight,
  });
  frame(im, k, 1);
  return im;
}

export function sideAltar(k: P, i: number, w: number, h: number): Img {
  return i % 2 ? andrew(k, w, h, 40 + i) : madonna(k, w, h, 40 + i);
}

/**
 * The image as a thin prop of fine voxels in its plane. `plane` 'x' hangs it on a wall facing +x or -x (u runs
 * along z), 'z' on a wall facing +z or -z (u along x), 'y' under a ceiling (u along z, v along x). `flip` mirrors u,
 * `flipV` (ceilings) mirrors v, so that it reads the right way for whoever stands before it.
 */
export function toProp(im: Img, plane: 'x' | 'y' | 'z', flip: boolean, flipV = false, scale = 0.125): Prop {
  const p = plane === 'x' ? new Prop(1, im.h, im.w, scale) : plane === 'z' ? new Prop(im.w, im.h, 1, scale) : new Prop(im.h, 1, im.w, scale);
  for (let v = 0; v < im.h; v++) for (let u = 0; u < im.w; u++) {
    const c = im.get(u, v), uu = flip ? im.w - 1 - u : u, vv = flipV ? im.h - 1 - v : v;
    if (plane === 'x') p.set(0, v, uu, c);
    else if (plane === 'z') p.set(uu, v, 0, c);
    else p.set(vv, 0, uu, c);
  }
  return p;
}

/**
 * Hang a picture flat on a wall, in fine voxels like every painting in the game: (x, z) is a point on the wall's
 * face in metres (the middle of the picture along the wall), y its bottom, (nx, nz) the way it faces (along x or z).
 */
export function hang(b: Builder, im: Img, x: number, y: number, z: number, nx: number, nz: number): void {
  const F = 0.0625;
  if (Math.abs(nx) > Math.abs(nz)) b.place(toProp(im, 'x', nx > 0), x + Math.sign(nx) * F, y, z);
  else b.place(toProp(im, 'z', nz < 0), x, y, z + Math.sign(nz) * F);
}

/** hang() in a lot's own coordinates: `m` maps (a, d) to metres, (a, d) is on the wall's face, (da, dd) points into the room. */
export function hangIn(b: Builder, im: Img, m: (a: number, d: number) => [number, number], a: number, d: number, da: number, dd: number, y: number): void {
  const [x, z] = m(a, d), [x1, z1] = m(a + da, d + dd);
  hang(b, im, x, y, z, x1 - x, z1 - z);
}
