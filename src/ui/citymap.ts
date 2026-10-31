import { TEXT } from '../data/cityText';
import { AMALFI } from '../world/cityId';
import type { NavData } from '../world/bake';
import type { Occluder, StallAnchor } from '../world/tokyo';
import { V, G as STREET, WX0, WZ0, WX1, WZ1, WORLD_W, WORLD_D, ZONES, zoneAt } from '../world/layout';
import { STALLS, type StallInfo } from '../data/stalls';
import { DISHES } from '../data/dishes';
import { missionStalls, trackedMission } from '../data/missions';
import type { SaveState } from '../game/state';
import { HOTELS, ROOM_TYPE, type HotelInfo } from '../data/hotels';
import { G } from './glyphs';
import { icon } from './emblems';

/**
 * The pocket map: an illustrated, folded paper map of the city drawn from the world itself. The soft
 * washes (paper, water, parks, hill contours) are painted once into a raster; roofs, trees, the railway,
 * labels and markers are drawn as vectors every frame the map is open, so they stay crisp at any zoom.
 */

export interface MapWorld {
  nav: NavData;
  /** Signed distance to the water's edge per nav cell (see BakedWorld.shore). */
  shore: Uint8Array;
  occluders: Occluder[];
  stalls: StallAnchor[];
  /** Where the hidden restaurant is on the street (its interior lives off the map). */
  hiddenDoor: [number, number];
  /** Each hotel's front door (just inside it), by hotel id. */
  hotels: { id: string; entrance: [number, number] }[];
}

export interface Pin { x: number; z: number; name: string; jp?: string; id?: string }

export interface CityMapHost {
  /** Player position, facing (atan2(dx, dz)) and the camera's look direction on the ground. */
  player(): { x: number; z: number; facing: number; view: [number, number] };
  friends(): { id: string; name: string; color: number; x: number; z: number }[];
  pin(): Pin | null;
  /** The walking route to the pin, from the player. */
  route(): [number, number][] | null;
  setPin(p: Pin | null): void;
  worldMap(): void;
  close(): void;
  click(): void;
}

const K = 6; // raster px per metre
const MAX_SCALE = 24; // css px per metre
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
/** Smooth value noise, roughly 0..1, with features `cell` units apart. */
const vnoise = (x: number, y: number, cell: number) => {
  const fx = x / cell, fy = y / cell, ix = Math.floor(fx), iy = Math.floor(fy);
  const tx = fx - ix, ty = fy - iy, sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
};

// ---------------------------------------------------------------------------------------- palette
const C = {
  street: [250, 243, 227], block: [236, 224, 200], park: [206, 222, 172], hill: [224, 219, 176],
  shallow: [176, 213, 214], deep: [126, 176, 196], shoreInk: [84, 126, 150], ripple: [205, 232, 230], contour: [170, 146, 100],
  ink: '#4a382d', inkSoft: 'rgba(74, 56, 45, 0.55)', halo: 'rgba(251, 245, 232, 0.92)',
  tomato: '#e9573f', tomatoDeep: '#b93d27', sun: '#f4b63f', sunDeep: '#c88a14', vermilion: '#d65a3c', indigo: '#283a6e',
};
const ROOFS = ['#8f9dab', '#7f8d9d', '#c98468', '#99a6b0', '#d6ae76', '#a3b294', '#8a96a6', '#cf9a7e', '#b39a86', '#8f9dab'];
// Amalfi from above: whitewashed and pastel vaults and terraces
const PASTEL = ['#efe6d6', '#f1d9a8', '#eec2a6', '#e8c6c9', '#f3e8c4', '#dfd3c0', '#f0dcb8', '#e6b9a0'];
const TOWERS = ['#8d95aa', '#9aa3a8', '#7f8aa0', '#a49aa8'];
const GREENS = ['#8db67a', '#7eab6c', '#9cc283', '#86b07e'];
const SAKURA = ['#f1b6c4', '#eeaabb', '#f5c3cf'];
const PARKS = new Set(['park', 'inari', 'midori', 'farbank']);

// ---------------------------------------------------------------------------------------- places
type Glyph = 'train' | 'torii' | 'temple' | 'tree' | 'bag' | 'bath' | 'lantern' | 'bed';
const GLYPH: Record<Glyph, string> = {
  train: 'M7 3.5h10a3 3 0 0 1 3 3V15a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V6.5a3 3 0 0 1 3-3Z M4 10.5h16 M8.5 21l2-3 M15.5 21l-2-3 M8 14.5h.01 M16 14.5h.01',
  torii: 'M3 5.5c3.5 1.3 14.5 1.3 18 0 M5 9.5h14 M7 6.6V21 M17 6.6V21 M12 9.5V7',
  temple: 'M2.5 10.5 12 4l9.5 6.5 M5.5 10v9 M18.5 10v9 M3 19.5h18 M9.5 19.5v-5h5v5',
  tree: 'M12 21v-6 M12 15c-4 0-7-2.6-7-6.2a7 7 0 0 1 14 0c0 3.6-3 6.2-7 6.2Z',
  bag: 'M5 8h14l-1.2 12.5H6.2L5 8Z M9 8V6.5a3 3 0 0 1 6 0V8',
  bath: 'M5 20h14 M8 16c-1.6-2 1.6-3 0-5.2s1.6-3 0-5.3 M12 16c-1.6-2 1.6-3 0-5.2s1.6-3 0-5.3 M16 16c-1.6-2 1.6-3 0-5.2s1.6-3 0-5.3',
  bed: 'M3 19V6.5 M3 15.5h18V19 M21 15.5v-3a2.5 2.5 0 0 0-2.5-2.5H11v5.5 M7 12.4a1.6 1.6 0 1 0 0-.01',
  lantern: 'M12 2.5v2 M9 4.5h6 M7.5 8.2c0-2.1 2-3.7 4.5-3.7s4.5 1.6 4.5 3.7v5.6c0 2.1-2 3.7-4.5 3.7s-4.5-1.6-4.5-3.7V8.2Z M7.6 11h8.8 M9 19.5h6',
};
const ZONE_ICON: Record<string, Glyph> = { station: 'train', midori: 'torii', inari: 'torii', park: 'tree', ginza: 'bag', plaza: 'temple', gado: 'lantern' };
const DISTRICTS = new Set(['marina', 'molo', 'ponente', 'mulini', 'limoni', 'plaza', 'ekimae', 'station', 'midori', 'gado', 'park', 'inari', 'ginza', 'yanaka', 'canal']);
const EXTRA_PLACES: { name: string; jp: string; at: [number, number]; icon: Glyph }[] = [
  { name: 'Sento', jp: '銭湯', at: [-23.1, 8.6], icon: 'bath' },
];

interface Roof { x0: number; z0: number; x1: number; z1: number; top: number; fill: string; style: 'hip' | 'flat' | 'shrine' | 'glass' | 'rail' | 'chimney' | 'station' }
interface Tree { x: number; z: number; r: number; fill: string }
interface Label { name: string; jp: string; x: number; z: number; district: boolean; vertical: boolean; icon?: Glyph; zone?: string }
interface HotelMark { h: HotelInfo; x: number; z: number; sx: number; sy: number }
interface Marker { id: string; kind: 'stall' | 'resto' | 'hidden' | 'unknown'; st: StallInfo; x: number; z: number; sx: number; sy: number; target: boolean; done: number; total: number }

/**
 * Paint the soft layers of the map once: paper, blocks, water, park washes and hill contours. It is a
 * few hundred milliseconds of work, so it runs a band of rows at a time (see CityMap.prepare).
 */
function paintBase(w: MapWorld): { canvas: HTMLCanvasElement; step: (ms: number) => boolean } {
  const W = Math.round(WORLD_W * K), H = Math.round(WORLD_D * K);
  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const ctx = cv.getContext('2d')!;
  const BAND = 8;
  const img = ctx.createImageData(W, BAND);
  const out = img.data;
  const { sx, sz, ox, oz, height: nh } = w.nav;
  const shore = w.shore;
  const parks = ZONES.filter((zn) => PARKS.has(zn.id)).map((zn) => zn.rect);
  const cellAt = (cx: number, cz: number) => (cx < 0 || cz < 0 || cx >= sx || cz >= sz ? 255 : nh[cz * sx + cx]);
  const shoreAt = (cx: number, cz: number) => shore[clamp(cz, 0, sz - 1) * sx + clamp(cx, 0, sx - 1)];
  const lvl = (h: number) => (h === 255 ? -1 : Math.floor(Math.max(0, h - STREET) / (AMALFI ? 12 : 4)));
  let row = 0;
  const band = (y0: number) => {
    for (let py = y0; py < y0 + BAND && py < H; py++) {
      const z = WZ0 + (py + 0.5) / K;
      const fz = (z - oz) / V - 0.5, iz = Math.floor(fz), tz = fz - iz, cz = Math.floor((z - oz) / V);
      for (let px = 0; px < W; px++) {
        const x = WX0 + (px + 0.5) / K;
        const fx = (x - ox) / V - 0.5, ix = Math.floor(fx), tx = fx - ix, cx = Math.floor((x - ox) / V);
        // water's edge distance in voxels, interpolated so the banks come out as smooth curves
        const s0 = shoreAt(ix, iz) + (shoreAt(ix + 1, iz) - shoreAt(ix, iz)) * tx;
        const s1 = shoreAt(ix, iz + 1) + (shoreAt(ix + 1, iz + 1) - shoreAt(ix, iz + 1)) * tx;
        const s = (s0 + (s1 - s0) * tz - 128) / 16;
        const grain = (hash(px, py) - 0.5) * 7 + (vnoise(px, py, 90) - 0.5) * 9;
        let r: number, g: number, b: number;
        if (s > 0) {
          const d = smooth(0, 7, s) * (0.75 + 0.5 * vnoise(x, z, 9));
          r = C.shallow[0] + (C.deep[0] - C.shallow[0]) * d; g = C.shallow[1] + (C.deep[1] - C.shallow[1]) * d; b = C.shallow[2] + (C.deep[2] - C.shallow[2]) * d;
          // ripple lines that follow the bank, the way old maps draw water
          for (const at of [1.7, 3.6]) {
            const k = 1 - smooth(0.12, 0.34, Math.abs(s - at));
            r += (C.ripple[0] - r) * k * 0.7; g += (C.ripple[1] - g) * k * 0.7; b += (C.ripple[2] - b) * k * 0.7;
          }
          const e = 1 - smooth(0.25, 0.8, s);
          r += (C.shoreInk[0] - r) * e; g += (C.shoreInk[1] - g) * e; b += (C.shoreInk[2] - b) * e;
          r += grain * 0.6; g += grain * 0.6; b += grain * 0.6;
        } else {
          const h = cellAt(cx, cz);
          const base = h === 255 ? C.block : C.street;
          r = base[0]; g = base[1]; b = base[2];
          if (h !== 255 && h > STREET + 1) {
            const k = smooth(1, AMALFI ? 170 : 26, h - STREET) * 0.85 + 0.15;
            r += (C.hill[0] - r) * k; g += (C.hill[1] - g) * k; b += (C.hill[2] - b) * k;
          }
          for (const [x0, z0, x1, z1] of parks) {
            if (x < x0 || x > x1 || z < z0 || z > z1) continue;
            const edge = Math.min(x - x0, x1 - x, z - z0, z1 - z);
            const k = smooth(0, 2.5, edge + (vnoise(x, z, 3) - 0.5) * 2.2) * (0.62 + 0.3 * vnoise(x, z, 14));
            r += (C.park[0] - r) * k; g += (C.park[1] - g) * k; b += (C.park[2] - b) * k;
          }
          // contour lines every metre of height
          const l = lvl(h);
          if (l > 0 || lvl(cellAt(cx + 1, cz)) > 0 || lvl(cellAt(cx, cz + 1)) > 0) {
            const lr = lvl(cellAt(cx + 1, cz)), ld = lvl(cellAt(cx, cz + 1));
            if (h !== 255 && ((lr >= 0 && lr !== l) || (ld >= 0 && ld !== l))) { r += (C.contour[0] - r) * 0.55; g += (C.contour[1] - g) * 0.55; b += (C.contour[2] - b) * 0.55; }
          }
          // a damp shadow along the bank
          if (s > -1.4) { const d = smooth(-1.4, 0, s) * 16; r -= d; g -= d * 0.9; b -= d * 0.7; }
          r += grain; g += grain; b += grain;
        }
        const o = ((py - y0) * W + px) * 4;
        out[o] = r; out[o + 1] = g; out[o + 2] = b; out[o + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, y0);
  };
  return {
    canvas: cv,
    step: (ms: number) => {
      const end = performance.now() + ms;
      while (row < H) { band(row); row += BAND; if (performance.now() > end) break; }
      return row >= H;
    },
  };
}

function roofsOf(w: MapWorld): { roofs: Roof[]; trees: Tree[] } {
  const roofs: Roof[] = [], trees: Tree[] = [];
  for (const o of w.occluders) {
    const [x0, z0, x1, z1] = o.rect;
    if (x0 > WX1 || z0 > WZ1 || x1 < WX0 || z1 < WZ0) continue; // the hidden restaurant's walls
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, h = hash(Math.round(cx * 4), Math.round(cz * 4));
    const zone = zoneAt(cx, cz)?.id ?? '';
    if (o.kind === 'tree') {
      const sakura = zone === 'farbank' || zone === 'canal' || zone === 'plaza' || (PARKS.has(zone) && h < 0.3);
      const list = sakura ? SAKURA : GREENS;
      trees.push({ x: cx, z: cz, r: Math.max(0.8, Math.max(x1 - x0, z1 - z0) * 0.34), fill: list[Math.floor(h * list.length)] });
      continue;
    }
    const tall = o.top - (o.floor ?? 0) >= 13 && !AMALFI;
    let style: Roof['style'] = tall || AMALFI ? 'flat' : 'hip';
    let fill = tall ? TOWERS[Math.floor(h * TOWERS.length)] : AMALFI ? PASTEL[Math.floor(h * PASTEL.length)] : ROOFS[Math.floor(h * ROOFS.length)];
    if (o.kind === 'landmark') {
      if (zone === 'gado' && x1 - x0 > 40) { style = 'rail'; fill = '#d9ccb4'; }
      else if (zone === 'station') { style = 'station'; fill = '#6f929a'; }
      else if (zone === 'ginza') { style = 'glass'; fill = '#bcd8dc'; }
      else if (x1 - x0 < 2.5 && z1 - z0 < 2.5 && o.top > 12) { style = 'chimney'; fill = '#b0644a'; }
      else { style = 'shrine'; fill = C.vermilion; }
    }
    roofs.push({ x0, z0, x1, z1, top: o.top, fill, style });
  }
  // big roofs first so small ones sit on top
  roofs.sort((a, b) => (b.x1 - b.x0) * (b.z1 - b.z0) - (a.x1 - a.x0) * (a.z1 - a.z0));
  return { roofs, trees };
}

function labelsOf(): Label[] {
  const out: Label[] = [];
  for (const zn of ZONES) {
    if (zn.id === 'kakurega' || zn.id === 'grotta') continue;
    const [x0, z0, x1, z1] = zn.rect;
    const district = DISTRICTS.has(zn.id);
    out.push({ name: zn.name, jp: zn.jp, x: (x0 + x1) / 2, z: (z0 + z1) / 2, district, vertical: !district && z1 - z0 > (x1 - x0) * 1.8, icon: ZONE_ICON[zn.id], zone: zn.id });
  }
  if (!AMALFI) for (const p of EXTRA_PLACES) out.push({ name: p.name, jp: p.jp, x: p.at[0], z: p.at[1], district: false, vertical: false, icon: p.icon });
  // districts claim their space before the streets
  return out.sort((a, b) => Number(b.district) - Number(a.district));
}

const paths = new Map<string, Path2D>();
const glyphPath = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

export class CityMap {
  private base: HTMLCanvasElement | null = null;
  private painter: ReturnType<typeof paintBase> | null = null;
  private roofs: Roof[];
  private trees: Tree[];
  private labels = labelsOf();
  private imgs = new Map<string, HTMLImageElement>();
  // view
  private el: HTMLElement | null = null;
  private cv!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private card!: HTMLElement;
  private w = 1;
  private h = 1;
  private dpr = 1;
  private cx = 36;
  private cz = 28;
  private scale = 5;
  private goal = { cx: 36, cz: 28, scale: 5, on: false };
  private vel = [0, 0];
  private raf = 0;
  private last = 0;
  private t0 = 0;
  private pinT = -9;
  private sel: { kind: 'marker'; m: Marker } | { kind: 'hotel'; m: HotelMark } | { kind: 'pin' } | { kind: 'friend'; name: string; x: number; z: number } | null = null;
  private markers: Marker[] = [];
  private hotelMarks: HotelMark[] = [];
  private pointers = new Map<number, { x: number; y: number }>();
  private drag = { moved: 0, pinch: 0, lastT: 0 };
  private ro: ResizeObserver | null = null;
  private s!: SaveState;
  private icons: Record<string, string> = {};
  private filter = { food: true, missions: true, friends: true, hotels: true };

  constructor(private world: MapWorld, private host: CityMapHost) {
    ({ roofs: this.roofs, trees: this.trees } = roofsOf(world));
  }

  /**
   * Paint the map ahead of time, a few milliseconds per call (call it every frame until it says it is
   * done). With no budget it finishes in one go.
   */
  prepare(ms = Infinity): boolean {
    if (this.base) return true;
    this.painter ??= paintBase(this.world);
    if (!this.painter.step(ms)) return false;
    this.base = this.painter.canvas;
    this.painter = null;
    return true;
  }

  get isOpen(): boolean { return !!this.el; }

  /** Build the map sheet. The caller mounts it as a full-screen overlay and calls closed() when it goes. */
  open(s: SaveState, icons: Record<string, string>): HTMLElement {
    this.prepare();
    this.s = s;
    this.icons = icons;
    this.markers = this.buildMarkers();
    this.hotelMarks = HOTELS.flatMap((h) => {
      const a = this.world.hotels.find((x) => x.id === h.id);
      return a ? [{ h, x: a.entrance[0], z: a.entrance[1], sx: 0, sy: 0 }] : [];
    });
    const el = document.createElement('div');
    el.className = 'cmap';
    el.innerHTML = `
      <div class="cm-sheet">
        <canvas class="cm-view" aria-label="Map of the city"></canvas>
        <div class="cm-folds" aria-hidden="true"></div>
        <div class="cm-title"><span class="eyebrow">Pocket map</span><h2>${TEXT.district[0]} <span class="jp">${TEXT.district[1]}</span></h2><small>${AMALFI ? 'Costiera Amalfitana · Italy' : 'Tokyo · 東京'}</small></div>
        <button class="cm-btn cm-close" data-a="close" aria-label="Fold the map away">${G.close}</button>
        <div class="cm-tools">
          <button class="cm-btn" data-a="in" aria-label="Zoom in">${G.plus}</button>
          <button class="cm-btn" data-a="out" aria-label="Zoom out"><svg class="g" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/></svg></button>
          <button class="cm-btn" data-a="me" aria-label="Where am I">${G.target}</button>
          <button class="cm-btn" data-a="world" aria-label="World map">${G.plane}</button>
        </div>
        <div class="cm-legend">
          <button class="cm-chip on" data-f="food"><i class="dotc"></i>Food</button>
          <button class="cm-chip on" data-f="missions"><i class="dotc mq"></i>Mission</button>
          <button class="cm-chip on" data-f="hotels"><i class="dotc ht"></i>Hotels</button>
          <button class="cm-chip on hidden" data-f="friends"><i class="dotc pal"></i>Friends</button>
        </div>
        <div class="cm-hint">Tap anywhere to pin a spot</div>
        <div class="cm-card hidden"></div>
      </div>`;
    this.el = el;
    this.cv = el.querySelector('canvas')!;
    this.ctx = this.cv.getContext('2d')!;
    this.card = el.querySelector('.cm-card')!;
    el.querySelector('[data-f="friends"]')!.classList.toggle('hidden', !this.host.friends().length);
    el.addEventListener('pointerdown', (e) => e.stopPropagation());
    el.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      e.stopPropagation();
      this.host.click();
      const a = b.dataset.a, f = b.dataset.f as keyof CityMap['filter'] | undefined;
      if (a === 'close') this.host.close();
      else if (a === 'in') this.zoomAt(this.w / 2, this.h / 2, 1.6);
      else if (a === 'out') this.zoomAt(this.w / 2, this.h / 2, 1 / 1.6);
      else if (a === 'me') { const p = this.host.player(); this.flyTo(p.x, p.z, Math.max(this.scale, 6)); }
      else if (a === 'world') this.host.worldMap();
      else if (f) { this.filter[f] = !this.filter[f]; b.classList.toggle('on', this.filter[f]); }
    });
    this.bindInput();
    // start on the player, close enough to read the street names
    const p = this.host.player();
    this.cx = p.x; this.cz = p.z;
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.cv);
    this.resize();
    this.scale = this.goal.scale = clamp(9, this.minScale(), MAX_SCALE);
    this.clampView();
    const pin = this.host.pin();
    if (pin) this.select({ kind: 'pin' });
    void document.fonts?.load('600 14px Fredoka').then(() => this.redraw());
    this.t0 = this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.tick(t));
    return el;
  }

  /** The overlay went away. */
  closed(): void {
    cancelAnimationFrame(this.raf);
    this.ro?.disconnect();
    this.ro = null;
    this.el = null;
    this.pointers.clear();
  }

  // ------------------------------------------------------------------ data
  private buildMarkers(): Marker[] {
    const s = this.s;
    const { next } = trackedMission(s);
    const targets = new Set(next ? missionStalls(next, s) : []);
    const out: Marker[] = [];
    for (const st of STALLS) {
      const a = this.world.stalls.find((x) => x.id === st.id);
      if (!a) continue;
      const dishes = DISHES.filter((d) => d.stall === st.id);
      const done = dishes.filter((d) => s.tasted[d.id]).length;
      const seen = s.seen.includes(st.id) || done > 0;
      if (st.hidden && !s.hiddenFound) continue;
      const [x, z] = st.hidden ? this.world.hiddenDoor : [a.vendor[0], a.vendor[2]];
      const kind: Marker['kind'] = !seen ? 'unknown' : st.hidden ? 'hidden' : st.restaurant ? 'resto' : 'stall';
      out.push({ id: st.id, kind, st, x, z, sx: 0, sy: 0, target: targets.has(st.id), done, total: dishes.length });
      const icon = dishes[0] && this.icons[dishes[0].id];
      if (icon && !this.imgs.has(st.id)) { const im = new Image(); im.onload = () => this.redraw(); im.src = icon; this.imgs.set(st.id, im); }
    }
    return out;
  }

  // ------------------------------------------------------------------ view
  private minScale(): number { return Math.min(this.w / WORLD_W, this.h / WORLD_D) * 0.92; }

  private resize(): void {
    const r = this.cv.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.cv.width = Math.round(this.w * this.dpr); this.cv.height = Math.round(this.h * this.dpr);
    this.scale = clamp(this.scale, this.minScale(), MAX_SCALE);
    this.goal.scale = clamp(this.goal.scale, this.minScale(), MAX_SCALE);
    this.clampView();
    this.redraw();
  }

  /** Keep some of the city on screen however far you pan. */
  private clampView(): void {
    const mx = Math.max(0, WORLD_W / 2 - this.w / this.scale / 2 + 12), mz = Math.max(0, WORLD_D / 2 - this.h / this.scale / 2 + 12);
    const ccx = (WX0 + WX1) / 2, ccz = (WZ0 + WZ1) / 2;
    this.cx = clamp(this.cx, ccx - mx, ccx + mx);
    this.cz = clamp(this.cz, ccz - mz, ccz + mz);
  }

  private toScreen(x: number, z: number): [number, number] { return [this.w / 2 + (x - this.cx) * this.scale, this.h / 2 + (z - this.cz) * this.scale]; }
  private toWorld(sx: number, sy: number): [number, number] { return [this.cx + (sx - this.w / 2) / this.scale, this.cz + (sy - this.h / 2) / this.scale]; }

  private zoomAt(sx: number, sy: number, f: number, animate = true): void {
    const ns = clamp((this.goal.on ? this.goal.scale : this.scale) * f, this.minScale(), MAX_SCALE);
    const [wx, wz] = this.toWorld(sx, sy);
    // keep the point under the cursor where it is
    const ncx = wx - (sx - this.w / 2) / ns, ncz = wz - (sy - this.h / 2) / ns;
    if (animate) this.goal = { cx: ncx, cz: ncz, scale: ns, on: true };
    else { this.scale = ns; this.cx = ncx; this.cz = ncz; this.goal.on = false; this.clampView(); }
    this.redraw();
  }

  private flyTo(x: number, z: number, scale: number): void {
    this.goal = { cx: x, cz: z, scale: clamp(scale, this.minScale(), MAX_SCALE), on: true };
    this.vel = [0, 0];
    this.redraw();
  }

  private dirty = true;
  private redraw(): void { this.dirty = true; }

  private tick(now: number): void {
    if (!this.el) return;
    this.raf = requestAnimationFrame((t) => this.tick(t));
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    if (this.goal.on) {
      const k = 1 - Math.exp(-dt * 9);
      this.cx += (this.goal.cx - this.cx) * k; this.cz += (this.goal.cz - this.cz) * k;
      this.scale *= Math.pow(this.goal.scale / this.scale, k);
      if (Math.abs(this.goal.scale - this.scale) < 0.002 * this.scale && Math.hypot(this.goal.cx - this.cx, this.goal.cz - this.cz) * this.scale < 0.5) {
        this.scale = this.goal.scale; this.cx = this.goal.cx; this.cz = this.goal.cz; this.goal.on = false;
      }
      this.clampView();
      this.dirty = true;
    } else if (!this.pointers.size && Math.hypot(this.vel[0], this.vel[1]) > 4) {
      // a flick keeps gliding for a moment
      this.cx -= (this.vel[0] * dt) / this.scale; this.cz -= (this.vel[1] * dt) / this.scale;
      const f = Math.exp(-dt * 5);
      this.vel[0] *= f; this.vel[1] *= f;
      this.clampView();
      this.dirty = true;
    }
    // the player, friends and pulses move: redraw at a gentle rate when nothing else asks
    if (this.dirty || now - this.drawnAt > 33) this.draw(now);
  }
  private drawnAt = 0;

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    const cv = this.cv;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
      this.goal.on = false;
      this.vel = [0, 0];
      if (this.pointers.size === 1) this.drag.moved = 0;
      else this.drag.moved = 99;
      this.drag.pinch = this.pinchDist();
      this.drag.lastT = performance.now();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.offsetX - p.x, dy = e.offsetY - p.y;
      const n = this.pointers.size;
      if (n === 1) {
        this.drag.moved += Math.hypot(dx, dy);
        if (this.drag.moved > 6) {
          this.cx -= dx / this.scale; this.cz -= dy / this.scale;
          const now = performance.now(), dtm = Math.max(1, now - this.drag.lastT) / 1000;
          this.vel = [this.vel[0] * 0.6 + (dx / dtm) * 0.4, this.vel[1] * 0.6 + (dy / dtm) * 0.4];
          this.drag.lastT = now;
        }
      } else {
        // pinch: zoom around the middle of the two fingers, and pan with it
        const before = this.mid();
        p.x = e.offsetX; p.y = e.offsetY;
        const d = this.pinchDist(), after = this.mid();
        if (this.drag.pinch > 0 && d > 0) this.zoomAt(after[0], after[1], d / this.drag.pinch, false);
        this.cx -= (after[0] - before[0]) / this.scale; this.cz -= (after[1] - before[1]) / this.scale;
        this.drag.pinch = d;
      }
      p.x = e.offsetX; p.y = e.offsetY;
      this.clampView();
      this.redraw();
    });
    const up = (e: PointerEvent) => {
      if (!this.pointers.has(e.pointerId)) return;
      const tap = this.pointers.size === 1 && this.drag.moved <= 6;
      this.pointers.delete(e.pointerId);
      if (performance.now() - this.drag.lastT > 90) this.vel = [0, 0];
      if (tap && e.type === 'pointerup') this.tap(e.offsetX, e.offsetY);
      this.drag.pinch = this.pinchDist();
    };
    cv.addEventListener('pointerup', up);
    cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0022));
      this.zoomAt(e.offsetX, e.offsetY, f, false);
    }, { passive: false });
    cv.addEventListener('dblclick', (e) => this.zoomAt(e.offsetX, e.offsetY, 2));
  }

  private mid(): [number, number] {
    const ps = [...this.pointers.values()];
    return [(ps[0].x + ps[1].x) / 2, (ps[0].y + ps[1].y) / 2];
  }
  private pinchDist(): number {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  private tap(sx: number, sy: number): void {
    // markers first: the nearest within reach of a finger
    let best: Marker | null = null, bd = 22;
    for (const m of this.markers) {
      if (!this.shown(m)) continue;
      const d = Math.hypot(m.sx - sx, m.sy - sy);
      if (d < bd) { bd = d; best = m; }
    }
    if (best) { this.host.click(); this.select({ kind: 'marker', m: best }); return; }
    if (this.filter.hotels) for (const m of this.hotelMarks) {
      if (Math.hypot(m.sx - sx, m.sy - sy) < 20) { this.host.click(); this.select({ kind: 'hotel', m }); return; }
    }
    if (this.filter.friends) for (const f of this.host.friends()) {
      const [fx, fy] = this.toScreen(f.x, f.z);
      if (Math.hypot(fx - sx, fy - sy) < 20) { this.host.click(); this.select({ kind: 'friend', name: f.name, x: f.x, z: f.z }); return; }
    }
    const pin = this.host.pin();
    if (pin) {
      const [px, py] = this.toScreen(pin.x, pin.z);
      if (Math.hypot(px - sx, py - sy + 14) < 20) { this.select({ kind: 'pin' }); return; }
    }
    const [tx, tz] = this.toWorld(sx, sy);
    if (tx < WX0 || tx > WX1 || tz < WZ0 || tz > WZ1) return;
    const [x, z] = this.walkable(tx, tz);
    const zn = zoneAt(x, z);
    this.host.click();
    this.setPin({ x, z, name: zn && zn.id !== 'passage' || this.s.hiddenFound ? zn?.name ?? 'Pinned spot' : 'Pinned spot', jp: zn?.jp });
  }

  /** The nearest spot someone can stand on (a tap on a roof pins the street in front of it). */
  private walkable(x: number, z: number): [number, number] {
    const { sx, sz, ox, oz, height } = this.world.nav;
    const cx = Math.floor((x - ox) / V), cz = Math.floor((z - oz) / V);
    for (let r = 0; r < 40; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ix = cx + dx, iz = cz + dz;
          if (ix < 0 || iz < 0 || ix >= sx || iz >= sz || height[iz * sx + ix] === 255) continue;
          return r ? [ox + (ix + 0.5) * V, oz + (iz + 0.5) * V] : [x, z];
        }
    return [x, z];
  }

  private setPin(p: Pin | null): void {
    this.host.setPin(p);
    this.pinT = p ? performance.now() : -9;
    this.select(p ? { kind: 'pin' } : null);
  }

  private select(sel: CityMap['sel']): void {
    this.sel = sel;
    const card = this.card;
    card.classList.toggle('hidden', !sel);
    this.el?.querySelector('.cm-sheet')?.classList.toggle('carded', !!sel);
    this.el?.querySelector('.cm-hint')?.classList.toggle('gone', !!sel || !!this.host.pin());
    this.redraw();
    if (!sel) return;
    const pin = this.host.pin();
    const dist = (x: number, z: number) => {
      const p = this.host.player();
      const route = pin && Math.hypot(pin.x - x, pin.z - z) < 0.5 ? this.host.route() : null;
      let m = 0;
      if (route?.length) { let ax = p.x, az = p.z; for (const [bx, bz] of route) { m += Math.hypot(bx - ax, bz - az); ax = bx; az = bz; } }
      else m = Math.hypot(x - p.x, z - p.z) * 1.25;
      const mins = Math.max(1, Math.round(m / 3.2 / 60));
      return m < 6 ? 'You are here' : `${m < 100 ? Math.round(m / 5) * 5 : Math.round(m / 10) * 10} m · about ${mins} min on foot`;
    };
    let html = '';
    let guide: Pin | null = null;
    if (sel.kind === 'marker') {
      const { m } = sel, st = m.st;
      const a = this.world.stalls.find((x) => x.id === st.id)!;
      const stand: [number, number] = st.hidden ? this.world.hiddenDoor : a.stand;
      guide = { x: stand[0], z: stand[1], name: m.kind === 'unknown' ? 'Something smells good' : st.name, jp: m.kind === 'unknown' ? undefined : st.jp, id: st.id };
      const img = this.icons[DISHES.find((d) => d.stall === st.id)?.id ?? ''];
      const sub = m.kind === 'unknown' ? 'Follow your nose to find out what is cooking here.'
        : `${esc(st.street)} · ${st.hidden ? 'Omakase counter' : st.restaurant ? 'Restaurant' : 'Street stall'}`;
      const tasted = m.kind === 'unknown' ? '' : m.done >= m.total ? `<span class="cm-tag ok">${G.check}All ${m.total} tasted</span>` : `<span class="cm-tag">${m.done}/${m.total} tasted</span>`;
      html = `<div class="cm-ic${m.kind === 'unknown' ? ' q' : ''}">${m.kind === 'unknown' ? '?' : img ? `<img src="${img}" alt="">` : G.bowl}</div>
        <div class="cm-tx"><b>${esc(guide.name)}${guide.jp ? `<span class="jp">${guide.jp}</span>` : ''}</b><small>${sub}</small><div class="cm-meta">${tasted}${m.target ? `<span class="cm-tag mq">${G.sparkle}Mission</span>` : ''}<span class="cm-dist">${dist(stand[0], stand[1])}</span></div></div>`;
    } else if (sel.kind === 'hotel') {
      const h = sel.m.h, booked = this.s.hotel?.id === h.id;
      guide = { x: sel.m.x, z: sel.m.z, name: h.name, jp: h.jp, id: `hotel-${h.id}` };
      const from = Math.min(...h.rooms.map((r) => r.price));
      const rooms = h.rooms.map((r) => ROOM_TYPE[r.type].icon).join('');
      html = `<div class="cm-ic hotel">${icon('bed')}</div>
        <div class="cm-tx"><b>${esc(h.name)}<span class="jp">${h.jp}</span></b><small>${esc(h.street)} · ${esc(h.blurb)}</small><div class="cm-meta">${booked ? `<span class="cm-tag ok">${G.check}Your room</span>` : `<span class="cm-tag">${rooms} from ¥${from.toLocaleString('en-US')}</span>`}${this.s.stays.includes(h.id) ? `<span class="cm-tag ok">Stayed here</span>` : ''}<span class="cm-dist">${dist(sel.m.x, sel.m.z)}</span></div></div>`;
    } else if (sel.kind === 'friend') {
      guide = { x: sel.x, z: sel.z, name: sel.name };
      html = `<div class="cm-ic">${G.people}</div><div class="cm-tx"><b>${esc(sel.name)}</b><small>On this trip with you</small><div class="cm-meta"><span class="cm-dist">${dist(sel.x, sel.z)}</span></div></div>`;
    } else if (pin) {
      html = `<div class="cm-ic flag">${G.pin}</div><div class="cm-tx"><b>${esc(pin.name)}${pin.jp ? `<span class="jp">${pin.jp}</span>` : ''}</b><small>Follow the gold beacon and the compass</small><div class="cm-meta"><span class="cm-dist">${dist(pin.x, pin.z)}</span></div></div>`;
    }
    const pinned = !!pin && !!guide && Math.hypot(pin.x - guide.x, pin.z - guide.z) < 0.5;
    const isPin = sel.kind === 'pin' || pinned;
    card.innerHTML = `${html}<div class="cm-acts">${isPin ? `<button class="btn btn-soft" data-c="clear">Clear pin</button>` : `<button class="btn btn-red" data-c="guide">${G.pin}Guide me</button>`}</div><button class="cm-x" data-c="x" aria-label="Close">${G.close}</button>`;
    card.querySelectorAll<HTMLButtonElement>('button[data-c]').forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        this.host.click();
        const c = b.dataset.c;
        if (c === 'clear') this.setPin(null);
        else if (c === 'guide' && guide) { this.host.setPin(guide); this.pinT = performance.now(); this.select(sel); }
        else this.select(null);
      };
    });
  }

  private shown(m: Marker): boolean { return this.filter.food || (this.filter.missions && m.target); }

  // ------------------------------------------------------------------ drawing
  private draw(now: number): void {
    this.dirty = false;
    this.drawnAt = now;
    const c = this.ctx, s = this.scale, dpr = this.dpr, W = this.w, H = this.h;
    const t = (now - this.t0) / 1000;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = '#eadcc2';
    c.fillRect(0, 0, W, H);
    const [ox, oz] = this.toScreen(0, 0);
    // the painted layers
    if (this.base) {
      c.imageSmoothingEnabled = true;
      c.imageSmoothingQuality = 'high';
      c.drawImage(this.base, ox + WX0 * s, oz + WZ0 * s, WORLD_W * s, WORLD_D * s);
    }
    // world-space vectors
    c.setTransform(dpr * s, 0, 0, dpr * s, dpr * ox, dpr * oz);
    const [vx0, vz0] = this.toWorld(-20, -20), [vx1, vz1] = this.toWorld(W + 20, H + 20);
    const px = 1 / s; // one css pixel in metres
    this.drawGrid(c, px);
    this.drawRoofs(c, px, vx0, vz0, vx1, vz1);
    this.drawTrees(c, px, vx0, vz0, vx1, vz1);
    // the frame around the city
    c.strokeStyle = C.ink; c.lineWidth = 1.6 * px;
    c.strokeRect(WX0, WZ0, WORLD_W, WORLD_D);
    c.lineWidth = 0.7 * px;
    c.strokeRect(WX0 - 5 * px, WZ0 - 5 * px, WORLD_W + 10 * px, WORLD_D + 10 * px);
    // screen space: route, labels, markers, people
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.drawRoute(c);
    this.drawLabels(c);
    this.drawMarkers(c, t);
    this.drawHotels(c, t);
    this.drawFriends(c);
    this.drawPin(c, now);
    this.drawPlayer(c, t);
    this.drawRose(c);
  }

  private drawGrid(c: CanvasRenderingContext2D, px: number): void {
    c.strokeStyle = 'rgba(120, 84, 50, 0.09)';
    c.lineWidth = px;
    c.beginPath();
    for (let x = WX0 + 24; x < WX1; x += 24) { c.moveTo(x, WZ0); c.lineTo(x, WZ1); }
    for (let z = WZ0 + 24; z < WZ1; z += 24) { c.moveTo(WX0, z); c.lineTo(WX1, z); }
    c.stroke();
  }

  private drawRoofs(c: CanvasRenderingContext2D, px: number, vx0: number, vz0: number, vx1: number, vz1: number): void {
    const s = this.scale;
    const detail = s >= 3.2;
    const vis = this.roofs.filter((r) => r.x1 >= vx0 && r.x0 <= vx1 && r.z1 >= vz0 && r.z0 <= vz1);
    // soft shadows, the sun low in the north-west
    c.fillStyle = 'rgba(84, 54, 30, 0.2)';
    c.beginPath();
    for (const r of vis) {
      if (r.style === 'rail') continue;
      const d = Math.min(r.top, 22) * 0.075;
      c.rect(r.x0 + d * 0.55, r.z0 + d, r.x1 - r.x0, r.z1 - r.z0);
    }
    c.fill();
    for (const r of vis) {
      const w = r.x1 - r.x0, h = r.z1 - r.z0;
      c.fillStyle = r.fill;
      if (r.style === 'chimney') {
        const rad = Math.max(w, h) / 2;
        c.beginPath(); c.arc(r.x0 + w / 2, r.z0 + h / 2, rad, 0, Math.PI * 2); c.fill();
        c.strokeStyle = C.ink; c.lineWidth = px; c.stroke();
        c.fillStyle = '#3b2a22'; c.beginPath(); c.arc(r.x0 + w / 2, r.z0 + h / 2, rad * 0.5, 0, Math.PI * 2); c.fill();
        continue;
      }
      c.fillRect(r.x0, r.z0, w, h);
      if (r.style === 'rail') { this.drawRail(c, r, px, vx0, vx1); continue; }
      if (r.style === 'glass') {
        c.strokeStyle = 'rgba(255, 255, 255, 0.55)'; c.lineWidth = 1.2 * px;
        c.beginPath();
        for (let z = r.z0 + 1.5; z < r.z1; z += 1.5) { c.moveTo(r.x0 + 0.4, z); c.lineTo(r.x1 - 0.4, z); }
        c.stroke();
        c.fillStyle = 'rgba(255, 255, 255, 0.25)'; c.fillRect(r.x0, r.z0, w * 0.4, h);
      } else if (r.style === 'flat' || r.style === 'station') {
        // parapet and a lighter roof deck, a little plant on top
        const inset = Math.min(0.55, w / 6, h / 6);
        c.fillStyle = 'rgba(255, 255, 255, 0.18)'; c.fillRect(r.x0 + inset, r.z0 + inset, w - inset * 2, h - inset * 2);
        if (detail && w > 3 && h > 3) {
          c.fillStyle = 'rgba(60, 40, 30, 0.18)';
          const hh = hash(Math.round(r.x0 * 4), Math.round(r.z0 * 4));
          c.fillRect(r.x0 + inset + 0.6 + hh * (w - inset * 2 - 2.2), r.z0 + inset + 0.6, 1, 0.8);
          c.fillRect(r.x0 + w * 0.5, r.z1 - inset - 1.4, 1.2, 0.8);
        }
        if (r.style === 'station') {
          c.strokeStyle = 'rgba(255, 255, 255, 0.4)'; c.lineWidth = 1.2 * px;
          c.beginPath(); c.moveTo(r.x0 + 1, (r.z0 + r.z1) / 2); c.lineTo(r.x1 - 1, (r.z0 + r.z1) / 2); c.stroke();
        }
      } else {
        // hip roof: lit slopes face the north-west sun, the others fall into shade
        const along = w >= h, half = (along ? h : w) / 2;
        const cxm = r.x0 + w / 2, czm = r.z0 + h / 2;
        const a: [number, number] = along ? [r.x0 + half, czm] : [cxm, r.z0 + half];
        const b: [number, number] = along ? [r.x1 - half, czm] : [cxm, r.z1 - half];
        c.fillStyle = 'rgba(255, 250, 240, 0.2)';
        c.beginPath(); c.moveTo(r.x0, r.z0); c.lineTo(r.x1, r.z0); c.lineTo(b[0], b[1]); c.lineTo(a[0], a[1]); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(r.x0, r.z0); c.lineTo(a[0], a[1]); c.lineTo(r.x0, r.z1); c.closePath(); c.fill();
        c.fillStyle = 'rgba(60, 30, 20, 0.12)';
        c.beginPath(); c.moveTo(r.x0, r.z1); c.lineTo(r.x1, r.z1); c.lineTo(b[0], b[1]); c.lineTo(a[0], a[1]); c.closePath(); c.fill();
        c.beginPath(); c.moveTo(r.x1, r.z0); c.lineTo(b[0], b[1]); c.lineTo(r.x1, r.z1); c.closePath(); c.fill();
        if (detail) {
          c.strokeStyle = 'rgba(74, 56, 45, 0.35)'; c.lineWidth = 0.8 * px;
          c.beginPath();
          c.moveTo(r.x0, r.z0); c.lineTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.lineTo(r.x1, r.z0);
          c.moveTo(r.x0, r.z1); c.lineTo(a[0], a[1]); c.moveTo(b[0], b[1]); c.lineTo(r.x1, r.z1);
          c.stroke();
        }
      }
      c.strokeStyle = C.ink; c.lineWidth = clamp(0.5 + s * 0.07, 0.7, 1.5) * px;
      c.strokeRect(r.x0, r.z0, w, h);
    }
  }

  private drawRail(c: CanvasRenderingContext2D, r: Roof, px: number, vx0: number, vx1: number): void {
    const x0 = Math.max(r.x0, vx0), x1 = Math.min(r.x1, vx1);
    const h = r.z1 - r.z0;
    c.strokeStyle = C.ink; c.lineWidth = 1.2 * px;
    c.strokeRect(r.x0, r.z0, r.x1 - r.x0, h);
    for (const tz of [r.z0 + h * 0.3, r.z0 + h * 0.7]) {
      if (this.scale >= 2.5) {
        c.strokeStyle = 'rgba(92, 70, 52, 0.55)'; c.lineWidth = 0.32;
        c.beginPath();
        for (let x = Math.floor(x0 / 0.8) * 0.8; x < x1; x += 0.8) { c.moveTo(x, tz - 0.75); c.lineTo(x, tz + 0.75); }
        c.stroke();
      }
      c.strokeStyle = '#5b4637'; c.lineWidth = Math.max(0.12, 1.1 * px);
      c.beginPath(); c.moveTo(x0, tz - 0.5); c.lineTo(x1, tz - 0.5); c.moveTo(x0, tz + 0.5); c.lineTo(x1, tz + 0.5); c.stroke();
    }
  }

  private drawTrees(c: CanvasRenderingContext2D, px: number, vx0: number, vz0: number, vx1: number, vz1: number): void {
    const vis = this.trees.filter((t) => t.x + t.r >= vx0 && t.x - t.r <= vx1 && t.z + t.r >= vz0 && t.z - t.r <= vz1);
    c.fillStyle = 'rgba(70, 60, 30, 0.2)';
    c.beginPath();
    for (const t of vis) { c.moveTo(t.x + t.r * 1.25, t.z + t.r * 0.5); c.arc(t.x + t.r * 0.25, t.z + t.r * 0.5, t.r, 0, Math.PI * 2); }
    c.fill();
    const lw = clamp(0.5 + this.scale * 0.06, 0.6, 1.3) * px;
    for (const t of vis) {
      c.fillStyle = t.fill;
      c.beginPath(); c.arc(t.x, t.z, t.r, 0, Math.PI * 2); c.fill();
      c.strokeStyle = 'rgba(52, 70, 40, 0.6)'; c.lineWidth = lw; c.stroke();
      c.fillStyle = 'rgba(255, 255, 235, 0.3)';
      c.beginPath(); c.arc(t.x - t.r * 0.3, t.z - t.r * 0.3, t.r * 0.42, 0, Math.PI * 2); c.fill();
    }
  }

  private drawRoute(c: CanvasRenderingContext2D): void {
    const route = this.host.route();
    const pin = this.host.pin();
    if (!route?.length || !pin) return;
    const p = this.host.player();
    c.lineJoin = c.lineCap = 'round';
    c.beginPath();
    const [sx, sy] = this.toScreen(p.x, p.z);
    c.moveTo(sx, sy);
    for (const [x, z] of route) { const [a, b] = this.toScreen(x, z); c.lineTo(a, b); }
    c.strokeStyle = 'rgba(255, 250, 238, 0.95)'; c.lineWidth = 7; c.setLineDash([]); c.stroke();
    c.strokeStyle = C.tomatoDeep; c.lineWidth = 3.2; c.setLineDash([0.1, 7.5]); c.lineDashOffset = -performance.now() / 60;
    c.stroke();
    c.setLineDash([]);
  }

  private drawLabels(c: CanvasRenderingContext2D): void {
    const s = this.scale;
    const taken: [number, number, number, number][] = [];
    const free = (x0: number, y0: number, x1: number, y1: number) => {
      for (const [a, b, cc, d] of taken) if (x0 < cc && x1 > a && y0 < d && y1 > b) return false;
      taken.push([x0, y0, x1, y1]);
      return true;
    };
    c.lineJoin = 'round';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    for (const l of this.labels) {
      if (l.zone === 'passage' && !this.s.hiddenFound) continue;
      const [x, y] = this.toScreen(l.x, l.z);
      if (x < -200 || y < -60 || x > this.w + 200 || y > this.h + 60) continue;
      if (l.district) {
        const size = clamp(10 + s * 0.9, 12, 17);
        c.font = `600 ${size}px Fredoka, ui-rounded, system-ui, sans-serif`;
        const tw = c.measureText(l.name).width;
        const iconY = l.icon ? y - size - 6 : y;
        if (!free(x - tw / 2 - 4, iconY - (l.icon ? 14 : 0) - size / 2, x + tw / 2 + 4, y + size + 4)) continue;
        if (l.icon) this.badge(c, x, iconY, 13, l.icon, l.zone === 'midori' || l.zone === 'inari' || l.zone === 'plaza' ? C.vermilion : l.zone === 'park' ? '#4f9a6a' : l.zone === 'station' ? '#3f6e7a' : '#8a5a3a');
        c.strokeStyle = C.halo; c.lineWidth = 4.5; c.strokeText(l.name, x, y);
        c.fillStyle = l.zone === 'canal' ? '#2f5e78' : C.ink; c.fillText(l.name, x, y);
        if (s >= 3) {
          c.font = `500 ${size * 0.66}px ${'Hiragino Mincho ProN, Yu Mincho, Noto Serif JP, serif'}`;
          c.strokeStyle = C.halo; c.lineWidth = 3; c.strokeText(l.jp, x, y + size * 0.95);
          c.fillStyle = 'rgba(74, 56, 45, 0.7)'; c.fillText(l.jp, x, y + size * 0.95);
        }
      } else {
        if (s < (l.icon ? 3.2 : 2.4)) continue;
        const size = clamp(7 + s * 0.45, 9.5, 12);
        c.font = `800 ${size}px Nunito Variable, Nunito, system-ui, sans-serif`;
        const text = l.name.toUpperCase();
        if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '1.5px';
        const tw = c.measureText(text).width;
        const box = l.vertical ? [x - size, y - tw / 2 - 4, x + size, y + tw / 2 + 4] : [x - tw / 2 - 4, y - size, x + tw / 2 + 4, y + size];
        if (!free(box[0], box[1], box[2], box[3])) { if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px'; continue; }
        c.save();
        c.translate(x, y);
        if (l.vertical) c.rotate(-Math.PI / 2);
        let ty = 0;
        if (l.icon) { this.badge(c, 0, -size - 4, 10, l.icon, '#3f6e7a'); ty = 4; }
        c.strokeStyle = C.halo; c.lineWidth = 3.5; c.strokeText(text, 0, ty);
        c.fillStyle = 'rgba(92, 66, 48, 0.82)'; c.fillText(text, 0, ty);
        c.restore();
        if ('letterSpacing' in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = '0px';
      }
    }
  }

  /** A round paper sticker with a line icon. */
  private badge(c: CanvasRenderingContext2D, x: number, y: number, r: number, g: Glyph, col: string): void {
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(60, 36, 20, 0.22)';
    c.beginPath(); c.arc(0.8, 1.6, r, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fffaf0';
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill();
    c.strokeStyle = col; c.lineWidth = 1.8; c.stroke();
    const k = (r * 1.25) / 24;
    c.scale(k, k);
    c.translate(-12, -12);
    c.strokeStyle = col; c.lineWidth = 2.2; c.lineCap = c.lineJoin = 'round';
    c.stroke(glyphPath(GLYPH[g]));
    c.restore();
  }

  private drawMarkers(c: CanvasRenderingContext2D, t: number): void {
    const sel = this.sel?.kind === 'marker' ? this.sel.m : null;
    const big = this.scale >= 2.6;
    for (const m of this.markers) {
      const [x, y] = this.toScreen(m.x, m.z);
      m.sx = x; m.sy = y - (m.kind === 'unknown' ? 0 : 16);
      if (!this.shown(m) || x < -40 || y < -40 || x > this.w + 40 || y > this.h + 60) continue;
      const target = m.target && this.filter.missions;
      if (m.kind === 'unknown') {
        const r = big ? 10 : 8;
        c.setLineDash([3, 3]);
        c.fillStyle = 'rgba(255, 250, 238, 0.75)'; c.strokeStyle = C.inkSoft; c.lineWidth = 1.5;
        c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
        c.setLineDash([]);
        c.font = `600 ${r * 1.3}px Fredoka, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillStyle = C.ink; c.fillText('?', x, y + 0.5);
        if (target) this.sparkleRing(c, x, y, r + 5, t);
        continue;
      }
      // a teardrop pin standing on the stall, the dish inside
      const r = (big ? 13 : 10) * (sel === m ? 1.18 : 1);
      const cy = y - r - 5;
      const col = m.kind === 'hidden' ? '#33251d' : m.kind === 'resto' ? C.indigo : C.tomato;
      c.fillStyle = 'rgba(60, 36, 20, 0.25)';
      c.beginPath(); c.ellipse(x + 1, y + 1, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); c.fill();
      if (target) this.sparkleRing(c, x, cy, r + 5, t);
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x - r * 0.35, y - 4, x - r, cy + r * 0.55, x - r, cy);
      c.arc(x, cy, r, Math.PI, 0);
      c.bezierCurveTo(x + r, cy + r * 0.55, x + r * 0.35, y - 4, x, y);
      c.fillStyle = col; c.fill();
      c.strokeStyle = 'rgba(40, 24, 16, 0.5)'; c.lineWidth = 1; c.stroke();
      c.fillStyle = '#fffaf0';
      c.beginPath(); c.arc(x, cy, r - 2.6, 0, Math.PI * 2); c.fill();
      const im = this.imgs.get(m.id);
      if (im?.complete && im.naturalWidth) { const k = (r - 2.6) * 1.7; c.drawImage(im, x - k / 2, cy - k / 2, k, k); }
      else { c.fillStyle = col; c.beginPath(); c.arc(x, cy, r * 0.3, 0, Math.PI * 2); c.fill(); }
      if (m.done >= m.total) {
        // every dish tasted: a small stamp
        c.fillStyle = '#4f9a6a'; c.beginPath(); c.arc(x + r * 0.8, cy - r * 0.75, 5.5, 0, Math.PI * 2); c.fill();
        c.strokeStyle = '#fff'; c.lineWidth = 1.6; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(x + r * 0.8 - 2.6, cy - r * 0.75); c.lineTo(x + r * 0.8 - 0.6, cy - r * 0.75 + 2); c.lineTo(x + r * 0.8 + 2.8, cy - r * 0.75 - 2); c.stroke();
      }
      m.sy = cy;
      if (this.scale >= 11 || sel === m) {
        c.font = `600 ${11.5}px Fredoka, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top';
        c.strokeStyle = C.halo; c.lineWidth = 3.5; c.strokeText(m.st.name, x, y + 3);
        c.fillStyle = C.ink; c.fillText(m.st.name, x, y + 3);
      }
    }
  }

  /** Hotels: a plum pin with a bed. They sparkle while you still need somewhere to sleep tonight. */
  private drawHotels(c: CanvasRenderingContext2D, t: number): void {
    if (!this.filter.hotels) return;
    const sel = this.sel?.kind === 'hotel' ? this.sel.m : null;
    const big = this.scale >= 2.6;
    const need = !this.s.hotel;
    for (const m of this.hotelMarks) {
      const [x, y] = this.toScreen(m.x, m.z);
      const r = (big ? 12 : 9) * (sel === m ? 1.18 : 1);
      const cy = y - r - 5;
      m.sx = x; m.sy = cy;
      if (x < -40 || y < -40 || x > this.w + 40 || y > this.h + 60) continue;
      const booked = this.s.hotel?.id === m.h.id;
      const col = booked ? '#4f9a6a' : '#7b3f86';
      c.fillStyle = 'rgba(60, 36, 20, 0.25)';
      c.beginPath(); c.ellipse(x + 1, y + 1, r * 0.45, r * 0.18, 0, 0, Math.PI * 2); c.fill();
      if (need) this.sparkleRing(c, x, cy, r + 5, t);
      c.beginPath();
      c.moveTo(x, y);
      c.bezierCurveTo(x - r * 0.35, y - 4, x - r, cy + r * 0.55, x - r, cy);
      c.arc(x, cy, r, Math.PI, 0);
      c.bezierCurveTo(x + r, cy + r * 0.55, x + r * 0.35, y - 4, x, y);
      c.fillStyle = col; c.fill();
      c.strokeStyle = 'rgba(40, 24, 16, 0.5)'; c.lineWidth = 1; c.stroke();
      c.save();
      c.translate(x, cy);
      const k = (r * 1.3) / 24;
      c.scale(k, k);
      c.translate(-12, -12);
      c.strokeStyle = '#fffaf0'; c.lineWidth = 2.4; c.lineCap = c.lineJoin = 'round';
      c.stroke(glyphPath(GLYPH.bed));
      c.restore();
      if (this.scale >= 9 || sel === m || booked) {
        c.font = `600 ${11.5}px Fredoka, system-ui, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'top';
        c.strokeStyle = C.halo; c.lineWidth = 3.5; c.strokeText(m.h.name, x, y + 3);
        c.fillStyle = C.ink; c.fillText(m.h.name, x, y + 3);
      }
    }
  }

  private sparkleRing(c: CanvasRenderingContext2D, x: number, y: number, r: number, t: number): void {
    const p = 0.5 + 0.5 * Math.sin(t * 3.2);
    c.strokeStyle = `rgba(244, 182, 63, ${0.5 + p * 0.45})`;
    c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, r + p * 2, 0, Math.PI * 2); c.stroke();
    c.fillStyle = C.sun;
    for (let i = 0; i < 3; i++) {
      const a = t * 0.8 + (i * Math.PI * 2) / 3, sx = x + Math.cos(a) * (r + 2), sy = y + Math.sin(a) * (r + 2);
      c.beginPath();
      for (let k = 0; k < 8; k++) { const rr = k % 2 ? 1.2 : 3.4, aa = (k * Math.PI) / 4; c.lineTo(sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr); }
      c.fill();
    }
  }

  private drawFriends(c: CanvasRenderingContext2D): void {
    if (!this.filter.friends) return;
    for (const f of this.host.friends()) {
      const [x, y] = this.toScreen(f.x, f.z);
      const col = `#${f.color.toString(16).padStart(6, '0')}`;
      c.fillStyle = 'rgba(40, 24, 16, 0.25)';
      c.beginPath(); c.arc(x + 1, y + 2, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, 10, 0, Math.PI * 2); c.fill();
      c.fillStyle = col; c.beginPath(); c.arc(x, y, 8, 0, Math.PI * 2); c.fill();
      c.font = '600 10.5px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#fff'; c.fillText(f.name.charAt(0).toUpperCase(), x, y + 0.5);
      if (this.scale >= 3) {
        c.font = '600 11px Fredoka, system-ui, sans-serif'; c.textBaseline = 'top';
        c.strokeStyle = C.halo; c.lineWidth = 3.5; c.strokeText(f.name, x, y + 12);
        c.fillStyle = col; c.fillText(f.name, x, y + 12);
      }
    }
  }

  private drawPin(c: CanvasRenderingContext2D, now: number): void {
    const pin = this.host.pin();
    if (!pin) return;
    const [x, y0] = this.toScreen(pin.x, pin.z);
    // drops in with a little bounce
    const k = clamp((now - this.pinT) / 450, 0, 1);
    const drop = k < 1 ? (1 - k) * (1 - k) * -40 + Math.sin(k * Math.PI) * -6 : 0;
    const y = y0 + drop;
    const pulse = (now / 1000) % 1.6 / 1.6;
    c.strokeStyle = `rgba(200, 138, 20, ${0.6 * (1 - pulse)})`;
    c.lineWidth = 2;
    c.beginPath(); c.ellipse(x, y0, 6 + pulse * 18, (6 + pulse * 18) * 0.45, 0, 0, Math.PI * 2); c.stroke();
    c.fillStyle = 'rgba(60, 36, 20, 0.3)';
    c.beginPath(); c.ellipse(x + 1, y0 + 1, 5, 2.2, 0, 0, Math.PI * 2); c.fill();
    // a flag on a pole
    c.strokeStyle = '#3b2a22'; c.lineWidth = 2; c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 30); c.stroke();
    c.beginPath();
    c.moveTo(x + 1, y - 30); c.quadraticCurveTo(x + 10, y - 33, x + 19, y - 28); c.quadraticCurveTo(x + 10, y - 23, x + 1, y - 18); c.closePath();
    c.fillStyle = C.sun; c.fill();
    c.strokeStyle = C.sunDeep; c.lineWidth = 1.2; c.stroke();
    c.fillStyle = '#3b2a22'; c.beginPath(); c.arc(x, y - 31, 2.4, 0, Math.PI * 2); c.fill();
  }

  private drawPlayer(c: CanvasRenderingContext2D, t: number): void {
    const p = this.host.player();
    const [x, y] = this.toScreen(p.x, p.z);
    // what the camera is looking at: a soft wedge
    const va = Math.atan2(p.view[1], p.view[0]);
    const g = c.createRadialGradient(x, y, 4, x, y, 56);
    g.addColorStop(0, 'rgba(233, 87, 63, 0.32)');
    g.addColorStop(1, 'rgba(233, 87, 63, 0)');
    c.fillStyle = g;
    c.beginPath(); c.moveTo(x, y); c.arc(x, y, 56, va - 0.55, va + 0.55); c.closePath(); c.fill();
    const pulse = (t % 1.8) / 1.8;
    c.strokeStyle = `rgba(233, 87, 63, ${0.55 * (1 - pulse)})`; c.lineWidth = 2;
    c.beginPath(); c.arc(x, y, 9 + pulse * 16, 0, Math.PI * 2); c.stroke();
    c.save();
    c.translate(x, y);
    c.rotate(Math.PI - p.facing);
    c.fillStyle = 'rgba(40, 24, 16, 0.3)';
    c.beginPath(); c.arc(1, 2, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(0, 0, 10, 0, Math.PI * 2); c.fill();
    c.fillStyle = C.tomato; c.beginPath(); c.arc(0, 0, 8, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff';
    c.beginPath(); c.moveTo(0, -5.5); c.lineTo(4.2, 4); c.lineTo(0, 2); c.lineTo(-4.2, 4); c.closePath(); c.fill();
    c.restore();
  }

  /** A little compass rose in the corner, and a scale bar. */
  private drawRose(c: CanvasRenderingContext2D): void {
    const phone = this.w < 560;
    const r = phone ? 18 : 22, x = phone ? 36 : this.w - 46, y = this.h - (phone ? 38 : 52);
    c.save();
    c.translate(x, y);
    c.fillStyle = 'rgba(251, 245, 232, 0.85)';
    c.beginPath(); c.arc(0, 0, r + 6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = C.inkSoft; c.lineWidth = 1;
    c.beginPath(); c.arc(0, 0, r + 6, 0, Math.PI * 2); c.stroke();
    c.beginPath(); c.arc(0, 0, r - 3, 0, Math.PI * 2); c.stroke();
    for (let i = 0; i < 4; i++) {
      c.rotate(Math.PI / 2);
      c.beginPath(); c.moveTo(0, -r); c.lineTo(4, 0); c.lineTo(0, 0); c.closePath();
      c.fillStyle = i === 3 ? C.tomato : C.ink; c.fill();
      c.beginPath(); c.moveTo(0, -r); c.lineTo(-4, 0); c.lineTo(0, 0); c.closePath();
      c.fillStyle = i === 3 ? C.tomatoDeep : '#8a7566'; c.fill();
    }
    c.font = '600 10px Fredoka, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = C.ink; c.strokeStyle = C.halo; c.lineWidth = 3;
    c.strokeText('N', 0, -r - 1); c.fillText('N', 0, -r - 1);
    c.restore();
    // scale bar: a round number of metres about 60 px long
    const m = [5, 10, 20, 25, 50, 100].find((v) => v * this.scale >= 46) ?? 100;
    const len = m * this.scale, bx = phone ? x + r + 16 : x - len - r - 16, by = y + r + 1;
    c.strokeStyle = C.ink; c.lineWidth = 1.5;
    c.beginPath(); c.moveTo(bx, by - 4); c.lineTo(bx, by); c.lineTo(bx + len, by); c.lineTo(bx + len, by - 4); c.stroke();
    c.fillStyle = C.ink; c.fillRect(bx, by - 2, len / 2, 2);
    c.font = '800 10px Nunito Variable, Nunito, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'bottom';
    c.strokeStyle = C.halo; c.lineWidth = 3; c.strokeText(`${m} m`, bx + len / 2, by - 4); c.fillText(`${m} m`, bx + len / 2, by - 4);
  }
}

