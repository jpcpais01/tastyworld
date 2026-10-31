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

/** The ceiling's canvases, from the altar back to the doors. */
export function ceilingScene(k: P, i: number, w: number, h: number): Img {
  const f = [gloryOfAndrew, calling, martyrdom, arrival, immaculata][i % 5];
  const im = f(k, w, h, 31 + i * 7);
  frame(im, k, 1);
  return im;
}

/** Sketch helpers on an Img drawn as if it were 48 x 100: thick segments with their side, ellipses with their offsets. */
function sketch(im: Img, seed: number) {
  const S = im.h / 100;
  const X = (u: number) => u * im.w / 48, Y = (v: number) => v * S;
  const noise = (u: number, v: number, s = 0) => hash3(u, v, seed + s);
  // pixels within r of a-b, told which side they lie on (-1..1 across, + to the left of a->b) and how far along (0..1)
  const seg = (a: [number, number], b: [number, number], r: number, c: (u: number, v: number, side: number, t: number) => number) => {
    const [ax, ay] = [X(a[0]), Y(a[1])], [bx, by] = [X(b[0]), Y(b[1])], R = r * S;
    const dx = bx - ax, dy = by - ay, L2 = Math.max(1e-6, dx * dx + dy * dy), L = Math.sqrt(L2);
    for (let v = Math.floor(Math.min(ay, by) - R - 1); v <= Math.ceil(Math.max(ay, by) + R + 1); v++)
      for (let u = Math.floor(Math.min(ax, bx) - R - 1); u <= Math.ceil(Math.max(ax, bx) + R + 1); u++) {
        const px = u + 0.5 - ax, py = v + 0.5 - ay;
        const t = Math.max(0, Math.min(1, (px * dx + py * dy) / L2));
        const ex = px - dx * t, ey = py - dy * t;
        if (ex * ex + ey * ey > R * R) continue;
        im.set(u, v, c(u, v, (px * -dy + py * dx) / L / R, t));
      }
  };
  const disc = (cu: number, cv: number, ru: number, rv: number, c: number | ((u: number, v: number, du: number, dv: number) => number)) =>
    im.ell(X(cu), Y(cv), ru * S, rv * S, (u, v) => (typeof c === 'number' ? c : c(u, v, (u + 0.5 - X(cu)) / (ru * S), (v + 0.5 - Y(cv)) / (rv * S))));
  // a shape given by its half width at each height (sketch units): c gets the offset across (-1..1) and the height
  const body = (v0: number, v1: number, mid: (v: number) => number, half: (v: number) => number, c: (u: number, v: number, du: number, sv: number) => number) => {
    for (let v = Math.round(Y(v0)); v <= Math.round(Y(v1)); v++) {
      const sv = v / S, m = mid(sv), hw = half(sv);
      if (hw <= 0) continue;
      for (let u = Math.round(X(m - hw)); u <= Math.round(X(m + hw)) - 1; u++) im.set(u, v, c(u, v, (u + 0.5 - X(m)) / X(hw), sv));
    }
  };
  return { S, X, Y, noise, seg, disc, body };
}

/**
 * The altarpiece: Christ in glory, the Redeemer standing on the clouds in a blaze of gold. Red robe, blue mantle
 * over his shoulder, the right hand raised in blessing, the left holding the orb of the world with its cross, the
 * halo with the cross in it; two angels kneel on the clouds at his feet, cherubs about him. Drawn at twice the
 * fine voxels' density (about 48 x 100) so his face and hands read.
 */
export function altarpiece(k: P, w: number, h: number): Img {
  const im = new Img(w, h, k.goldDeep);
  const { S, X, Y, noise, seg, disc, body } = sketch(im, 5);
  const Hc: [number, number] = [23.5, 75.5]; // his head

  // ---- the glory: white gold at his head, deepening to amber at the edges, rays all round
  for (let v = 0; v < h; v++) for (let u = 0; u < w; u++) {
    const su = u * 48 / w, sv = v / S;
    const dx = su - Hc[0], dy = (sv - Hc[1]) * 0.62;
    const d = Math.hypot(dx, dy), n = (noise(u, v) - 0.5) * 3;
    const ray = Math.abs(Math.sin(Math.atan2(dy, dx) * 12)) < 0.32;
    im.set(u, v, d < 9 + n ? k.glowHot : d < 15 + n ? (ray ? k.glowHot : k.glow) : d < 23 + n ? (ray ? k.glow : k.goldLight) : d < 31 + n ? (ray ? k.goldLight : k.gold) : ray ? k.gold : k.goldDeep);
  }

  // ---- clouds under his feet and up the sides, lit from above, cherubs peeping out of them
  const puffs: [number, number, number][] = [
    [4, 8, 6], [13, 6, 6], [24, 5, 7], [35, 6, 6], [44, 8, 6], [8, 16, 5], [40, 16, 5], [17, 13, 5], [31, 13, 5], [24, 14, 5],
    [3, 24, 4], [45, 24, 4], [2, 34, 3], [46, 34, 3],
  ];
  for (const [cu, cv, r] of puffs) disc(cu, cv, r * 1.2, r, (u, v, du, dv) => (dv > 0.45 ? k.cloud : dv > -0.15 ? (noise(u, v, 2) < 0.2 ? k.cloud : k.cloudShade) : du > 0.3 || dv < -0.6 ? k.cloudDark : k.cloudShade));
  const cherub2 = (cu: number, cv: number, flip: number) => {
    disc(cu - 1.7 * flip, cv + 0.4, 1.5, 0.8, k.white); disc(cu + 1.7 * flip, cv + 0.4, 1.5, 0.8, k.whiteShade);
    disc(cu, cv, 1.2, 1.3, (_u, _v, du) => (du * flip > 0.4 ? k.fleshShade : k.flesh));
    disc(cu, cv + 1.0, 1.2, 0.55, k.hairBrown);
  };
  cherub2(10, 10, 1); cherub2(38, 10, -1); cherub2(24, 8, 1);

  // ---- two angels kneeling on the clouds either side, wings up, hands joined, faces turned to him
  const angel = (cu: number, side: number, robe: number) => {
    disc(cu - side * 2.6, 31, 2.0, 6.0, (u, v, du) => (du * side < -0.3 ? k.whiteShade : noise(u, v, 3) < 0.2 ? k.whiteShade : k.white)); // wing
    body(17, 29, () => cu, (sv) => 3.2 - (sv - 17) * 0.1, (_u, _v, du) => (du * side < -0.45 ? DARK(k).get(robe) ?? robe : robe));
    disc(cu + side * 1.2, 18.6, 3.2, 2.0, (_u, _v, du) => (du * side < -0.3 ? DARK(k).get(robe) ?? robe : robe)); // the knee
    seg([cu + side * 0.6, 27], [cu + side * 2.6, 25], 0.75, () => k.flesh); // forearms to the joined hands
    disc(cu + side * 2.9, 25.4, 0.7, 0.9, k.fleshLight);
    disc(cu + side * 0.4, 31.2, 1.35, 1.5, (_u, _v, du) => (du * side < -0.3 ? k.fleshShade : k.flesh));
    disc(cu - side * 0.2, 32.1, 1.4, 0.9, k.hairBrown); // curls
  };
  angel(9, 1, k.green); angel(39, -1, k.white);

  // ---- Christ
  // the halo first, behind him: a gold disc with the cross in it, rimmed
  disc(Hc[0] + 0.5, Hc[1] + 0.8, 8.4, 8.4, (_u, _v, du, dv) => {
    const r = Math.hypot(du, dv);
    if (r > 0.86) return k.goldDeep;
    const arm = (Math.abs(du) < 0.14 && dv > 0.35) || (Math.abs(dv) < 0.14 && Math.abs(du) > 0.4);
    return arm ? k.red : r > 0.7 ? k.gold : k.goldLight;
  });
  // feet, bare, on the cloud
  disc(21.6, 17.2, 1.5, 0.8, k.flesh); disc(26.6, 17.0, 1.5, 0.8, k.fleshShade);
  // the red robe, hem to neck, falling in folds; light from the upper left
  body(17.6, 69, (sv) => 24 + (sv < 30 ? (30 - sv) * 0.04 : 0), (sv) => (sv > 64 ? 4.2 + (sv - 64) * -0.25 : 4.2 + (64 - sv) * 0.085),
    (_u, _v, du, sv) => {
      const fold = sv < 52 && (Math.abs(du + 0.22 - Math.sin(sv * 0.25) * 0.05) < 0.1 || Math.abs(du - 0.3) < 0.08);
      return du < -0.62 || du > 0.62 || fold ? k.redDark : k.red;
    });
  // the blue mantle: over his left shoulder (our right), across his body from the right hip down to the hem
  body(17.6, 70.5, (sv) => (sv > 46 ? 27.4 + (sv - 46) * 0.03 : 24 + (sv - 17.6) * 0.12), (sv) => (sv > 46 ? 3.6 - Math.max(0, sv - 66) * 0.6 : 3.4 + (46 - sv) * 0.12),
    (_u, _v, du, sv) => (du > 0.5 || (sv < 44 && Math.abs(du + 0.1 - (44 - sv) * 0.01) < 0.12) ? k.blueDark : k.blue));
  // the mantle's swag across the waist, its lining turned out in gold
  seg([19.2, 42.4], [27.6, 46.4], 1.4, (_u, _v, s) => (s > 0.4 ? k.ochre : s < -0.4 ? k.blueDark : k.blue));
  // the right arm raised in blessing (our left): red sleeve, the hand up with two fingers raised
  seg([20.0, 66.4], [15.6, 57.6], 1.7, (_u, _v, s) => (s > 0.2 ? k.red : k.redDark));
  seg([15.6, 57.6], [14.2, 65.0], 1.45, (_u, _v, s) => (s < -0.2 ? k.red : k.redDark));
  disc(14.0, 66.6, 1.05, 1.3, (_u, _v, du) => (du > 0.3 ? k.fleshShade : k.flesh));
  seg([13.6, 67.6], [13.6, 69.2], 0.36, () => k.flesh); seg([14.4, 67.6], [14.5, 69.0], 0.36, () => k.fleshLight);
  // the left arm bent at the waist, holding up the orb with its little gold cross
  seg([28.2, 66.4], [30.6, 56.4], 1.6, (_u, _v, s) => (s < -0.2 ? k.blueDark : k.blue));
  seg([30.6, 56.4], [31.4, 52.4], 1.2, (_u, _v, s) => (s > 0 ? k.red : k.redDark));
  disc(31.4, 50.8, 2.0, 2.0, (_u, _v, du, dv) => (Math.abs(dv + 0.15) < 0.16 ? k.gold : du + dv * -0.6 < -0.3 ? k.skyLight : du > 0.35 ? k.blueDark : k.sky));
  seg([31.4, 52.8], [31.4, 55.2], 0.3, () => k.goldLight); seg([30.6, 54.3], [32.2, 54.3], 0.3, () => k.goldLight);
  disc(30.0, 49.8, 0.95, 0.9, k.flesh); // the hand under it
  // the head, pixel by pixel: long brown hair parted in the middle and falling to the shoulders, the face lit from
  // our left, eyes looking out at us, a short beard a little forked
  const HEAD = [
    '...HHHH...',
    '..HHHDHH..',
    '.HHHLDHHH.',
    '.HHLLFFSHD',
    'HHLLFFFSHD',
    'HHLEFFESHD',
    'HHLFFNFSHD',
    'HHLFFNSSHD',
    'HDLBFFFBSD',
    'HDBBMMBBBD',
    'HD.BBBBB.D',
    'HD..BBB..D',
    'HD...B...D',
  ];
  const HC: Record<string, number> = { H: k.hairBrown, D: k.hairDark, L: k.fleshLight, F: k.flesh, S: k.fleshShade, E: k.hairDark, N: k.fleshShade, B: k.hairBrown, M: k.fleshDeep };
  HEAD.forEach((row, r) => [...row].forEach((ch, i) => { if (ch !== '.') im.set(Math.round(X(19 + i)), Math.round(Y(81 - r)), HC[ch]); }));
  // the beard's shading on the far side
  im.set(Math.round(X(26)), Math.round(Y(71)), k.hairDark);

  frame(im, k, 2);
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
