import './arrival.css';
import type { CityId } from '../world/cityId';

/**
 * The arrival veil: after the plane lands, something rolls in over the globe, hides the switch to the city, then
 * parts to show the streets. Each city has its own: Tokyo walks you through a split noren curtain in a flurry of
 * cherry petals, Amalfi sweeps lemon boughs and bougainvillea aside through sea mist, Istanbul turns a wall of
 * İznik tiles and lets the gulls out. Anywhere else gets the blocky clouds.
 *
 * Everything is DOM with transform and opacity transitions only, so it stays on the compositor while the city
 * loads underneath. The art is a handful of inline SVGs used as backgrounds (each rasterised once per size).
 * While it covers the screen it keeps moving (cloth sways, boughs stir, the tile wall ripples, clouds drift) for
 * as long as the city takes, so the wait is part of the landing and never a frozen frame.
 */
export interface Veil {
  /** Roll in; resolves once the screen is fully covered. */
  cover(): Promise<void>;
  /** How far the city underneath has got (0..1): a thin thread along the bottom fills up. */
  progress(f: number): void;
  /** Part to show what is underneath, then clean up. */
  part(): void;
}

/** The veil is dressed for night when the plane lands before 6:00 or from 19:00. */
export const nightAt = (hour: number): boolean => hour < 6 || hour >= 19;

interface Built { coverMs: number; partMs: number }
type Theme = (v: HTMLElement, night: boolean) => Built;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const f = (n: number, d = 1) => n.toFixed(d);
const el = (cls: string, css = '', html = ''): HTMLElement => {
  const e = document.createElement('div');
  e.className = cls;
  if (css) e.style.cssText = css;
  if (html) e.innerHTML = html;
  return e;
};
/** An SVG as a CSS url(), for background-image. */
const svg = (vb: string, body: string, defs = ''): string =>
  `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${defs ? `<defs>${defs}</defs>` : ''}${body}</svg>`)}")`;

/** Loose bits that blow in on the wind, tumble, then fly past the camera on the way out. */
function flutter(v: HTMLElement, imgs: string[], count: number, size: [number, number], wind: number): void {
  for (let k = 0; k < count; k++) {
    const x = rnd(-5, 105), y = rnd(-5, 105), s = rnd(size[0], size[1]);
    v.appendChild(el('fl', [
      `--x:${f(x)}%`, `--y:${f(y)}%`, `--s:${f(s, 2)}vmin`,
      `--fx:${f(-wind * rnd(40, 90))}vw`, `--fy:${f(rnd(-45, -10))}vh`,
      `--tx:${f(wind * rnd(50, 110))}vw`, `--ty:${f(rnd(-25, 35))}vh`, `--ts:${f(rnd(1.6, 3), 2)}`,
      `--d:${f(rnd(0, 0.45), 2)}s`, `--do:${f(rnd(0, 0.35), 2)}s`, `--sp:${f(rnd(1.4, 3.2), 2)}s`, `--r0:${f(rnd(0, 360), 0)}deg`,
      `--img:${imgs[k % imgs.length]}`,
    ].join(';'), '<i></i>'));
  }
}

/** Soft banks of mist that drift across and keep going when the veil parts. */
function mist(v: HTMLElement, dir: number): void {
  [[18, 0], [52, 0.12], [86, 0.06]].forEach(([y, d], k) => {
    const side = k % 2 ? -dir : dir;
    v.appendChild(el('ms', `--y:${y}%;--fx:${-side * 90}vw;--tx:${side * 110}vw;--d:${d}s`));
  });
}

// --------------------------------------------------------------------------------------------- the fallback
const clouds: Theme = (v) => {
  const cols = 4, rows = 4;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ((c + 0.5 + (Math.random() - 0.5) * 0.5) / cols) * 100, y = ((r + 0.5 + (Math.random() - 0.5) * 0.5) / rows) * 100;
    const len = Math.hypot(x - 50, y - 50) || 1;
    v.appendChild(el('puff', `--x:${f(x)}%;--y:${f(y)}%;--s:${f(46 + Math.random() * 22, 0)}vmax;--dx:${f(((x - 50) / len) * 70)}vmax;--dy:${f(((y - 50) / len) * 70)}vmax;--d:${f(Math.random() * 0.22, 2)}s`,
      '<i></i><i></i><i></i>'));
  }
  return { coverMs: 1150, partMs: 1400 };
};

// --------------------------------------------------------------------------------------------- Tokyo
/** The noren's dyed-out crest: a cherry blossom in a ring. */
const SAKURA_MON = (() => {
  const petal = 'M0 -9 C-13 -16 -21 -33 -12 -45 L0 -39 L12 -45 C21 -33 13 -16 0 -9Z';
  const petals = [0, 72, 144, 216, 288].map((a) => `<path d='${petal}' transform='rotate(${a})'/>`).join('');
  const stamens = [0, 72, 144, 216, 288].map((a) => `<circle cx='0' cy='-15' r='2.2' transform='rotate(${a + 36})'/>`).join('');
  return svg('-60 -60 120 120',
    `<circle r='55' fill='none' stroke='#fbf6ec' stroke-width='4.5'/><circle r='49.5' fill='none' stroke='#fbf6ec' stroke-width='1.2'/>` +
    `<g fill='#fbf6ec'>${petals}</g><circle r='8' fill='#26386f'/><g fill='#fbf6ec'>${stamens}</g><circle r='3.2' fill='#fbf6ec'/>`);
})();

const PETAL = svg('0 0 40 24',
  `<path d='M2 12 C8 1 26 0 37 6 L32 12 L37 18 C26 24 8 23 2 12Z' fill='url(#p)'/><path d='M6 12 Q20 10 30 12' stroke='#f08fab' stroke-width='0.8' fill='none' opacity='0.6'/>`,
  `<linearGradient id='p' x1='0' x2='1'><stop offset='0' stop-color='#f19bb5'/><stop offset='0.55' stop-color='#ffd6e2'/><stop offset='1' stop-color='#fff1f5'/></linearGradient>`);

/** A red paper chōchin with its bamboo ribs and black caps. */
const CHOCHIN = svg('0 0 60 90',
  `<clipPath id='b'><ellipse cx='30' cy='45' rx='27' ry='35'/></clipPath>` +
  `<ellipse cx='30' cy='45' rx='27' ry='35' fill='url(#g)'/>` +
  `<g clip-path='url(#b)' stroke='#7a1410' stroke-opacity='0.35' stroke-width='1.1' fill='none'>${
    Array.from({ length: 11 }, (_, k) => { const y = 16 + k * 5.8; return `<path d='M0 ${f(y)} Q30 ${f(y + 3.5)} 60 ${f(y)}'/>`; }).join('')}</g>` +
  `<ellipse cx='21' cy='33' rx='7' ry='13' fill='#fff' opacity='0.18'/>` +
  `<rect x='16' y='5' width='28' height='9' rx='2.5' fill='#1f1a18'/><rect x='16' y='76' width='28' height='9' rx='2.5' fill='#1f1a18'/>` +
  `<rect x='19' y='7' width='22' height='1.6' fill='#d9a441'/><rect x='19' y='81' width='22' height='1.6' fill='#d9a441'/>` +
  `<path d='M30 85 L30 90' stroke='#d9a441' stroke-width='2'/>`,
  `<radialGradient id='g' cx='0.42' cy='0.4' r='0.7'><stop offset='0' stop-color='#ff8a5c'/><stop offset='0.55' stop-color='#e2402b'/><stop offset='1' stop-color='#a91e17'/></radialGradient>`);

const tokyo: Theme = (v, night) => {
  const wide = innerWidth > innerHeight;
  const n = wide ? 6 : 4;
  v.style.setProperty('--mon', SAKURA_MON);
  const cur = el('nr-cur');
  for (let i = 0; i < n; i++) {
    const c = (n - 1) / 2, side = i < c ? -1 : 1, k = Math.abs(i - c) - 0.5;
    cur.appendChild(el('nr', `--i:${i};--n:${n};--k:${f(k, 2)};--side:${side};--sw:${f(rnd(0.8, 1.2), 2)}`, '<b></b>'));
  }
  cur.appendChild(el('nr-rod'));
  v.appendChild(cur);
  // two lanterns hang in front of the curtain
  for (const [x, len] of [[wide ? 13 : 16, rnd(16, 22)], [wide ? 87 : 84, rnd(10, 16)]]) {
    v.appendChild(el('lt', `--x:${x}%;--len:${f(len)}vh;--img:${CHOCHIN};--d:${f(rnd(0.15, 0.3), 2)}s`, '<i></i>'));
  }
  flutter(v, [PETAL], wide ? 26 : 20, [2.8, 5.2], 1);
  if (night) v.classList.add('lit');
  return { coverMs: 1200, partMs: 1750 };
};

// --------------------------------------------------------------------------------------------- Amalfi
const leaf = (x: number, y: number, a: number, l: number, w: number, dark = '#2f6a33', light = '#4f9a42'): string =>
  `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(a, 0)})'>` +
  `<path d='M0 0 C${f(l * 0.25)} ${f(w)} ${f(l * 0.7)} ${f(w * 0.9)} ${f(l)} 0Z' fill='${dark}'/>` +
  `<path d='M0 0 C${f(l * 0.25)} ${f(-w)} ${f(l * 0.7)} ${f(-w * 0.9)} ${f(l)} 0Z' fill='${light}'/>` +
  `<path d='M${f(l * 0.04)} 0 Q${f(l * 0.5)} ${f(-w * 0.06)} ${f(l * 0.96)} 0' stroke='#e9f2c8' stroke-opacity='0.4' stroke-width='${f(w * 0.09, 2)}' fill='none'/></g>`;
const lemon = (x: number, y: number, a: number, r: number): string =>
  `<path d='M${f(x)} ${f(y - r)} L${f(x - 2)} ${f(y - r - 9)}' stroke='#5d4126' stroke-width='2.2' stroke-linecap='round'/>` +
  `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(a, 0)})'>` +
  `<path d='M${f(r * 1.18)} ${f(-r * 0.28)} Q${f(r * 1.62)} 0 ${f(r * 1.18)} ${f(r * 0.28)}Z' fill='#e4ad1e'/>` +
  `<path d='M${f(-r * 1.18)} ${f(-r * 0.22)} Q${f(-r * 1.42)} 0 ${f(-r * 1.18)} ${f(r * 0.22)}Z' fill='#d99f1b'/>` +
  `<ellipse rx='${f(r * 1.25)}' ry='${f(r)}' fill='url(#lm)'/>` +
  `<ellipse cx='${f(-r * 0.32)}' cy='${f(-r * 0.42)}' rx='${f(r * 0.48)}' ry='${f(r * 0.2)}' fill='#fffbe0' opacity='0.6'/></g>`;
const bract = (x: number, y: number, a: number, s: number): string =>
  `<g transform='translate(${f(x)} ${f(y)}) rotate(${f(a, 0)}) scale(${f(s, 2)})'>${[0, 120, 240].map((r) =>
    `<g transform='rotate(${r})'><path d='M0 0 C-9 -4 -10 -15 -4 -19 C-1 -21 1 -21 4 -19 C10 -15 9 -4 0 0Z' fill='url(#bg)'/>` +
    `<path d='M0 -2 L0 -16' stroke='#a3165f' stroke-opacity='0.45' stroke-width='0.8'/></g>`).join('')}` +
  `<circle r='2.6' fill='#fff4d6'/><circle r='1' fill='#f2c94c'/></g>`;
const AMALFI_DEFS =
  `<radialGradient id='lm' cx='0.38' cy='0.32' r='0.75'><stop offset='0' stop-color='#fff4a3'/><stop offset='0.45' stop-color='#f8d83d'/><stop offset='1' stop-color='#e0a21b'/></radialGradient>` +
  `<linearGradient id='bg' x1='0' y1='1' x2='0' y2='0'><stop offset='0' stop-color='#b51f6e'/><stop offset='0.6' stop-color='#e2479a'/><stop offset='1' stop-color='#f27cba'/></linearGradient>`;
const BOUGH = svg('0 0 200 140',
  `<path d='M4 78 C50 66 100 76 150 58 S188 48 198 42' stroke='#5d4126' stroke-width='4.5' fill='none' stroke-linecap='round'/>` +
  leaf(30, 72, -128, 44, 12) + leaf(46, 70, 52, 40, 11, '#2b6130', '#4a8f3d') + leaf(70, 72, -112, 46, 13) +
  leaf(98, 71, 70, 38, 11, '#336f35', '#5aa046') + leaf(132, 62, -100, 44, 12, '#2b6130', '#4a8f3d') + leaf(150, 58, 30, 42, 12) +
  leaf(176, 50, -70, 34, 10, '#336f35', '#5aa046') + leaf(186, 46, 10, 30, 9) +
  lemon(88, 100, 74, 17) + lemon(122, 94, 100, 15) + lemon(160, 78, 84, 12),
  AMALFI_DEFS);
const SPRIG = svg('0 0 200 140',
  `<path d='M10 128 C60 100 110 70 192 14' stroke='#5d4126' stroke-width='3.5' fill='none' stroke-linecap='round'/>` +
  leaf(40, 110, -150, 42, 12) + leaf(52, 104, 20, 44, 12, '#2b6130', '#4a8f3d') + leaf(84, 86, -140, 46, 13, '#336f35', '#5aa046') +
  leaf(98, 78, 10, 44, 12) + leaf(130, 58, -130, 40, 11, '#2b6130', '#4a8f3d') + leaf(146, 48, 0, 40, 11, '#336f35', '#5aa046') +
  leaf(176, 26, -110, 32, 10) + leaf(186, 20, -20, 28, 9) + lemon(70, 118, 60, 14),
  AMALFI_DEFS);
const BOUGAINVILLEA = svg('0 0 200 140',
  `<path d='M6 70 C40 60 80 84 120 70 S170 40 196 52' stroke='#6b4a2b' stroke-width='2.6' fill='none' stroke-linecap='round'/>` +
  `<path d='M80 78 C86 100 104 112 120 122 M126 66 C130 44 146 30 160 24' stroke='#6b4a2b' stroke-width='2' fill='none' stroke-linecap='round'/>` +
  leaf(24, 66, -120, 26, 9, '#3d7a3a', '#5d9f4a') + leaf(64, 72, 60, 24, 8, '#3d7a3a', '#5d9f4a') + leaf(150, 50, -60, 24, 8, '#3d7a3a', '#5d9f4a') +
  leaf(176, 46, 50, 22, 8, '#3d7a3a', '#5d9f4a') +
  bract(40, 60, 10, 0.95) + bract(62, 80, 50, 0.85) + bract(94, 74, -20, 1.05) + bract(110, 102, 30, 0.9) + bract(122, 120, 80, 0.8) +
  bract(134, 60, 0, 1) + bract(154, 30, 40, 0.9) + bract(174, 58, -30, 0.85) + bract(190, 44, 20, 0.75),
  AMALFI_DEFS);
const LOOSE_LEAF = svg('-2 -14 50 28', leaf(0, 0, 0, 46, 12));
const LOOSE_BRACT = svg('-22 -22 44 44', bract(0, 0, 0, 1), AMALFI_DEFS);

const amalfi: Theme = (v) => {
  mist(v, 1);
  const imgs = [BOUGH, SPRIG, BOUGAINVILLEA, BOUGH, SPRIG, BOUGH];
  const pick = Math.floor(rnd(0, imgs.length));
  const cols = 4, rows = 3;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = ((c + 0.5 + rnd(-0.25, 0.25)) / cols) * 100, y = ((r + 0.5 + rnd(-0.25, 0.25)) / rows) * 100;
    const len = Math.hypot(x - 50, y - 50) || 1;
    const rot = (x < 50 ? 0 : 180) + rnd(-35, 35);
    v.appendChild(el('bh', [
      `--x:${f(x)}%`, `--y:${f(y)}%`, `--s:${Math.random() < 0.5 ? 42 : 52}vmax`, `--r:${f(rot, 0)}deg`,
      `--dx:${f(((x - 50) / len) * 75)}vmax`, `--dy:${f(((y - 50) / len) * 75)}vmax`, `--d:${f(rnd(0, 0.24), 2)}s`,
      `--img:${imgs[(r * cols + c + pick) % imgs.length]}`,
    ].join(';')));
  }
  flutter(v, [LOOSE_LEAF, LOOSE_LEAF, LOOSE_BRACT], innerWidth > innerHeight ? 18 : 14, [3, 5.5], 1);
  return { coverMs: 1150, partMs: 1600 };
};

// --------------------------------------------------------------------------------------------- Istanbul
/**
 * One İznik tile. Corner and edge motifs are drawn whole on the tile's edges, so four tiles meet in a full cobalt
 * rosette and two in a full red palmette, like a real panel.
 */
const IZNIK = (() => {
  const C = '#1f4c9c', T = '#2a9c96', R = '#c8392c', G = '#3b8d5e', W = '#fbf7ee';
  const rosette = (x: number, y: number) =>
    `<g transform='translate(${x} ${y})'><circle r='21' fill='${C}'/>${
      Array.from({ length: 8 }, (_, k) => `<ellipse cy='-12' rx='4.6' ry='8.5' fill='${W}' transform='rotate(${k * 45})'/>`).join('')}` +
    `${Array.from({ length: 8 }, (_, k) => `<circle cy='-12' r='2' fill='${T}' transform='rotate(${k * 45})'/>`).join('')}<circle r='6' fill='${R}'/><circle r='2.4' fill='${W}'/></g>`;
  const palmette = (x: number, y: number, a: number) =>
    `<g transform='translate(${x} ${y}) rotate(${a + 45})' fill='${C}'><circle cx='5.5' r='5.6'/><circle cx='-5.5' r='5.6'/><circle cy='5.5' r='5.6'/><circle cy='-5.5' r='5.6'/></g>` +
    `<circle cx='${x}' cy='${y}' r='5' fill='${R}'/><circle cx='${x}' cy='${y}' r='1.8' fill='${W}'/>`;
  const saz = (a: number) =>
    `<g transform='rotate(${a} 50 50)'><path d='M60 60 C70 54 82 62 84 78 C78 72 72 74 68 70 C70 76 66 78 60 60Z' fill='${G}'/>` +
    `<path d='M61 61 C68 60 76 66 80 74' stroke='${W}' stroke-width='0.9' fill='none' opacity='0.7'/></g>`;
  const vine = (a: number) =>
    `<g transform='rotate(${a} 50 50)' fill='none' stroke='${C}' stroke-width='1.3' stroke-linecap='round'><path d='M50 26 C44 16 34 14 26 18'/><path d='M50 26 C56 16 66 14 74 18'/></g>` +
    `<g transform='rotate(${a} 50 50)' fill='${T}'><circle cx='26' cy='18' r='2.2'/><circle cx='74' cy='18' r='2.2'/></g>`;
  const tulip = `<path d='M50 60 C43 57 41 47 44 40 L47.5 45 L50 36 L52.5 45 L56 40 C59 47 57 57 50 60Z' fill='${R}' stroke='${C}' stroke-width='1'/>` +
    `<path d='M50 60 L50 65' stroke='${G}' stroke-width='1.6'/><path d='M50 64 C46 62 44 64 43 66 M50 64 C54 62 56 64 57 66' stroke='${G}' stroke-width='1.3' fill='none'/>`;
  const medallion = Array.from({ length: 8 }, (_, k) => `<circle cy='-17' r='8' transform='rotate(${k * 45})'/>`).join('');
  return svg('0 0 100 100',
    `<rect width='100' height='100' fill='${W}'/>` +
    [0, 90, 180, 270].map(vine).join('') + [0, 90, 180, 270].map(saz).join('') +
    rosette(0, 0) + rosette(100, 0) + rosette(0, 100) + rosette(100, 100) +
    palmette(50, 0, 0) + palmette(50, 100, 0) + palmette(0, 50, 90) + palmette(100, 50, 90) +
    `<g transform='translate(50 50)'><g fill='${C}'>${medallion}<circle r='20'/></g><g fill='${T}' transform='scale(0.82)'>${medallion}<circle r='20'/></g><circle r='15' fill='${W}'/></g>` +
    tulip);
})();

/** A gull from above: body and swept wings, wings on their own layer so they can beat. */
const GULL_BODY = svg('0 0 100 100',
  `<path d='M27 50 L33 46.5 L33 53.5Z' fill='#d7dde2'/><ellipse cx='50' cy='50' rx='19' ry='5.4' fill='#f7f6f1'/>` +
  `<circle cx='68' cy='50' r='4.8' fill='#fbfaf6'/><path d='M72 48.6 L80 50 L72 51.4Z' fill='#f0bf2e'/><circle cx='69.5' cy='48.3' r='0.9' fill='#2a2a2a'/>`);
const GULL_WINGS = (() => {
  const w = `<path d='M45 47 L57 47 C61 36 58 25 50 17 C45 12 39 8 30 5 C37 13 41 22 43 30 C44 37 44 42 45 47Z' fill='#c3ccd3'/>` +
    `<path d='M30 5 C37 13 41 22 42.5 27 L48 25 C45 18 39 11 30 5Z' fill='#2f3438'/><circle cx='36' cy='11' r='1.1' fill='#fff'/>` +
    `<path d='M47 46 C51 36 52 27 49 20' stroke='#e7ebee' stroke-width='1.2' fill='none'/>`;
  return svg('0 0 100 100', `${w}<g transform='translate(0 100) scale(1 -1)'>${w}</g>`);
})();

const istanbul: Theme = (v) => {
  v.style.setProperty('--tile', IZNIK);
  const W = innerWidth, H = innerHeight, s = Math.ceil(Math.max(W, H) / (W > H ? 7 : 5.5));
  // a tile corner (a whole rosette) sits on the middle of the screen
  const kx = Math.ceil(W / 2 / s), ky = Math.ceil(H / 2 / s);
  const x0 = W / 2 - kx * s, y0 = H / 2 - ky * s;
  const far = Math.hypot(kx, ky);
  for (let r = 0; r < 2 * ky; r++) for (let c = 0; c < 2 * kx; c++) {
    const d = Math.hypot(c + 0.5 - kx, r + 0.5 - ky) / far;
    v.appendChild(el('tl', `left:${f(x0 + c * s, 0)}px;top:${f(y0 + r * s, 0)}px;width:${s}px;height:${s}px;--dd:${f(d, 3)};--fl:${(c + r) % 2 ? 1 : -1}`));
  }
  mist(v, -1);
  const gulls = W > H ? 7 : 5;
  for (let k = 0; k < gulls; k++) {
    const a = (k / gulls) * Math.PI * 2 + rnd(-0.3, 0.3), dist = rnd(70, 95);
    const tx = Math.cos(a) * dist, ty = Math.sin(a) * dist * 0.75;
    v.appendChild(el('gl', [
      `--x:${f(50 + Math.cos(a) * rnd(4, 12))}%`, `--y:${f(50 + Math.sin(a) * rnd(4, 12))}%`, `--s:${f(rnd(8, 11))}vmin`,
      `--tx:${f(tx)}vmax`, `--ty:${f(ty)}vmax`, `--a:${f((Math.atan2(ty, tx) * 180) / Math.PI, 0)}deg`, `--ts:${f(rnd(2, 3.2), 2)}`,
      `--d:${f(0.15 + rnd(0, 0.4), 2)}s`, `--fp:${f(rnd(0.26, 0.36), 2)}s`, `--body:${GULL_BODY}`, `--wings:${GULL_WINGS}`,
    ].join(';'), '<i></i><b></b>'));
  }
  return { coverMs: 1200, partMs: 2000 };
};

// --------------------------------------------------------------------------------------------- Madeira
/**
 * A Portuguese azulejo in cobalt on white: a quarter of a big rosette in each corner (four tiles join into one whole
 * flower), a passion flower in the middle, scrolls between. The tiles of the panel flip in from the middle out.
 */
const AZULEJO = (() => {
  const C = '#1d4a9a', L = '#6f95cf', W = '#fbf8f1';
  const corner = (x: number, y: number) =>
    `<g transform='translate(${x} ${y})'><circle r='22' fill='${C}'/>${
      Array.from({ length: 12 }, (_, k) => `<ellipse cy='-15' rx='3.6' ry='7' fill='${W}' transform='rotate(${k * 30})'/>`).join('')}<circle r='7' fill='${W}'/><circle r='3.4' fill='${C}'/></g>`;
  const scroll = (a: number) =>
    `<g transform='rotate(${a} 50 50)' fill='none' stroke='${C}' stroke-width='2.2' stroke-linecap='round'><path d='M50 6 C50 16 40 18 36 26 C33 32 38 36 42 34'/><path d='M50 6 C50 16 60 18 64 26 C67 32 62 36 58 34'/></g>` +
    `<g transform='rotate(${a} 50 50)' fill='${L}'><circle cx='42' cy='34' r='2.6'/><circle cx='58' cy='34' r='2.6'/></g>`;
  // the passion flower: ten petals, a fringe of filaments, the five-armed centre
  const petals = Array.from({ length: 10 }, (_, k) => `<ellipse cy='-11' rx='3.2' ry='8' fill='${L}' transform='rotate(${k * 36 + 18})'/>`).join('');
  const fringe = Array.from({ length: 24 }, (_, k) => `<path d='M0 -6 L0 -12' stroke='${C}' stroke-width='1.1' transform='rotate(${k * 15})'/>`).join('');
  const arms = Array.from({ length: 5 }, (_, k) => `<path d='M0 0 L0 -6' stroke='${C}' stroke-width='1.8' stroke-linecap='round' transform='rotate(${k * 72})'/>`).join('');
  return svg('0 0 100 100',
    `<rect width='100' height='100' fill='${W}'/>` + [0, 90, 180, 270].map(scroll).join('') +
    corner(0, 0) + corner(100, 0) + corner(0, 100) + corner(100, 100) +
    `<g transform='translate(50 50)'>${petals}${fringe}<circle r='5' fill='${W}' stroke='${C}' stroke-width='1.2'/>${arms}<circle r='1.8' fill='${C}'/></g>`);
})();

/** A jacaranda blossom: a little purple trumpet seen from the side. */
const JACARANDA = svg('-12 -12 24 24', `<path d='M-8 -2 C-4 -7 4 -7 8 -3 C6 0 6 3 8 6 C3 8 -4 7 -8 2 C-6 1 -6 -1 -8 -2Z' fill='#8b6bd0'/><path d='M-6 0 C-2 -3 3 -3 6 0' stroke='#c7b4ef' stroke-width='1.3' fill='none'/>`);
/** A petal of bird-of-paradise orange. */
const STRELITZIA = svg('-14 -6 28 12', `<path d='M-13 0 C-6 -6 6 -5 13 0 C6 5 -6 6 -13 0Z' fill='#f08a24'/><path d='M-10 0 L10 0' stroke='#ffc066' stroke-width='1.2'/>`);

const madeira: Theme = (v) => {
  v.style.setProperty('--tile', AZULEJO);
  const W = innerWidth, H = innerHeight, s = Math.ceil(Math.max(W, H) / (W > H ? 7 : 5.5));
  const kx = Math.ceil(W / 2 / s), ky = Math.ceil(H / 2 / s);
  const x0 = W / 2 - kx * s, y0 = H / 2 - ky * s;
  const far = Math.hypot(kx, ky);
  for (let r = 0; r < 2 * ky; r++) for (let c = 0; c < 2 * kx; c++) {
    const d = Math.hypot(c + 0.5 - kx, r + 0.5 - ky) / far;
    v.appendChild(el('tl', `left:${f(x0 + c * s, 0)}px;top:${f(y0 + r * s, 0)}px;width:${s}px;height:${s}px;--dd:${f(d, 3)};--fl:${(c + r) % 2 ? 1 : -1}`));
  }
  mist(v, 1);
  flutter(v, [JACARANDA, JACARANDA, JACARANDA, STRELITZIA], W > H ? 22 : 16, [3, 5.5], 1);
  return { coverMs: 1200, partMs: 2000 };
};

/** Every city chooses its own arrival; destinations without a city yet get the clouds. */
const THEMES: Record<CityId, Theme> = { tokyo, amalfi, istanbul, madeira };

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

/**
 * The veil for landing in `dest` (a destination id), at night or by day. Make it at take-off: it is built, its art
 * decoded and painted once while the plane is in the air, so the first time it rolls in is as smooth as the tenth.
 *
 * A `held` veil is already covering: it is put back up as a page loads into another city, over the same wash the
 * page painted first (index.html), and fades its pieces in once their art is decoded.
 */
export function arrivalVeil(parent: HTMLElement, dest: string, night: boolean, held = false): Veil {
  const theme = (THEMES as Record<string, Theme | undefined>)[dest] ?? clouds;
  const v = el(`veil ${theme !== clouds ? `arr-${dest}` : 'arr-clouds'}${night ? ' night' : ''}`);
  const bar = el('vp', '', '<i></i>');
  let size = '', times = { coverMs: 0, partMs: 0 };
  const build = () => {
    v.replaceChildren();
    v.removeAttribute('style');
    size = `${innerWidth}x${innerHeight}`;
    times = theme(v, night);
    v.appendChild(bar);
    // parse every SVG once up front (data URLs are cached by the image loader, so the backgrounds reuse them)
    const urls = new Set<string>();
    for (const e of [v, ...v.querySelectorAll<HTMLElement>('[style]')]) {
      for (const m of e.style.cssText.matchAll(/url\("(data:image\/svg\+xml,[^"]+)"\)/g)) urls.add(m[1]);
    }
    return Promise.all([...urls].map((u) => { const i = new Image(); i.src = u; return i.decode().catch(() => {}); }));
  };
  /** Lay everything out in its covering pose, nearly transparent, for two frames, then put it back unseen. */
  let warming: Promise<void> | null = null;
  const warm = () => warming ??= (async () => {
    v.classList.add('warm', 'on');
    void v.offsetWidth;
    await frame(); await frame();
    v.classList.remove('on');
    void v.offsetWidth;
    v.classList.remove('warm');
    warming = null;
  })();
  let shown: Promise<void>;
  // a trip that never lands (closed mid-flight) should not leave it behind
  let stale = 0;
  if (held) {
    // straight into the covering pose, no roll-in; the pieces fade in over the wash once their art is ready
    v.classList.add('on', 'held');
    parent.appendChild(v);
    shown = Promise.race([build(), sleep(450)]).then(async () => {
      await frame();
      v.classList.add('shown');
      await sleep(260);
      v.classList.remove('held', 'shown');
    });
  } else {
    parent.appendChild(v);
    shown = build().then(warm);
    stale = window.setTimeout(() => v.remove(), 180000);
  }
  return {
    cover: async () => {
      clearTimeout(stale);
      if (!v.isConnected) parent.appendChild(v);
      if (held) { await shown; return; }
      if (size !== `${innerWidth}x${innerHeight}`) { await warming; await build(); }
      await warming;
      await warm();
      v.classList.add('on');
      await sleep(times.coverMs);
    },
    progress: (f) => {
      v.classList.add('busy');
      bar.style.setProperty('--f', Math.max(0, Math.min(1, f)).toFixed(3));
    },
    part: () => {
      void shown.then(() => {
        v.classList.add('out');
        setTimeout(() => v.remove(), times.partMs);
      });
    },
  };
}

// --------------------------------------------------------------------------------------------- across a reload
/**
 * Flying to another city reloads the page (each page builds one city). The old page leaves with the veil covering
 * the screen; the new one puts it straight back up (boot.ts) and it keeps playing while the city is built, until
 * the game lifts it. index.html marks the page with data-land first, so not even one frame of the old loading
 * screen shows in between.
 */
let carried: Veil | null = null;

/** Put the veil back up as the page loads; resolves once it is showing (or soon after, whatever the art does). */
export function holdLanding(parent: HTMLElement, dest: string, night: boolean): Promise<void> {
  carried = arrivalVeil(parent, dest, night, true);
  return carried.cover();
}

/** The veil carried over the reload, if the page has one up. */
export const landing = (): Veil | null => carried;

/** Lift the carried veil (the city is ready underneath). */
export function endLanding(): void {
  const v = carried;
  carried = null;
  if (!v) return;
  v.part();
  document.documentElement.removeAttribute('data-land');
}

/** Something went wrong building the city: drop the veil at once so the loading screen can say what. */
export function dropLanding(): void {
  carried = null;
  document.documentElement.removeAttribute('data-land');
  document.querySelectorAll('.veil').forEach((e) => e.remove());
}
