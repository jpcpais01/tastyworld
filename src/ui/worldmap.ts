import { WORLD } from '../data/worldmap';

/**
 * The travel map: the world as a little voxel diorama seen from a tilted camera. Land is baked once
 * into an offscreen canvas; each frame draws the sea, the baked land (wrapped round horizontally),
 * drifting clouds and the flight route. Pins and the plane are DOM elements placed on top.
 */

const K = 0.72; // vertical squash of the tilted view
const UNIT = 0.42; // one voxel of height, in cells
const MAX_H = 5;

type Biome = 'snow' | 'tundra' | 'forest' | 'grass' | 'jungle' | 'sand' | 'rock' | 'peak';
// [top, front] colours
const COL: Record<Biome, [string, string]> = {
  snow: ['#f6f3ec', '#cfd8de'],
  tundra: ['#adc391', '#a88760'],
  forest: ['#6aa46a', '#9c7752'],
  grass: ['#8fc76f', '#b3865a'],
  jungle: ['#5eae60', '#9a734e'],
  sand: ['#f1d18f', '#d4a865'],
  rock: ['#bba996', '#94806c'],
  peak: ['#f7f5f0', '#c9c2b8'],
};
const SEA = '#9ed3d6';
const SHALLOW = 'rgba(214, 240, 232, 0.75)';

interface Cell { c: number; r: number; h: number; b: Biome; tree: boolean; shade: number; }
export interface LatLon { lat: number; lon: number; }
interface Pin { el: HTMLElement; lat: number; lon: number; }

function hash(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
const inBox = (lat: number, lon: number, a: number, b: number, c: number, d: number) => lat >= a && lat <= b && lon >= c && lon <= d;

function shadeHex(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (s: number) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * f)));
  return `rgb(${ch(16)},${ch(8)},${ch(0)})`;
}

/** Turn the land mask into voxel columns with a biome and a height. */
function buildCells(): Cell[] {
  const { cols, rows, lat0, cell, land } = WORLD;
  const isLand = (c: number, r: number) => r >= 0 && r < rows && land[r][((c % cols) + cols) % cols] === '#';
  const out: Cell[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!isLand(c, r)) continue;
    const lat = lat0 - (r + 0.5) * cell, lon = -180 + (c + 0.5) * cell;
    const al = Math.abs(lat);
    let inland = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) inland += isLand(c + dx, r + dy) ? 1 : 0;
    const n = hash(c, r);
    // mountain ranges, roughly
    let m = 0;
    if (inBox(lat, lon, 27, 40, 70, 102)) m = 3; // Himalaya and Tibet
    else if (inBox(lat, lon, -50, 8, -80, -66) && lon < -66 - Math.max(0, lat + 20) * 0.1) m = 2; // Andes
    else if (inBox(lat, lon, 33, 62, -128, -105)) m = 2; // Rockies
    else if (inBox(lat, lon, 61, 84, -55, -18)) m = 2; // Greenland ice sheet
    else if (inBox(lat, lon, 44, 48, 5, 16) || inBox(lat, lon, 38, 44, 40, 50) || inBox(lat, lon, 4, 15, 35, 42) || inBox(lat, lon, 36, 50, 66, 90)) m = 1;
    else if (inBox(lat, lon, -78, -60, -180, 180)) m = 1;
    let h = 1 + (m ? m - (n < 0.35 ? 1 : 0) : 0) + (inland === 9 && n > 0.78 ? 1 : 0);
    h = Math.min(MAX_H, Math.max(1, h));
    let b: Biome;
    const desert = inBox(lat, lon, 15, 32, -17, 34) || inBox(lat, lon, 13, 32, 34, 60) || inBox(lat, lon, -31, -19, 117, 145) || inBox(lat, lon, 38, 47, 90, 115)
      || inBox(lat, lon, 24, 36, 55, 72) || inBox(lat, lon, 28, 37, -117, -104) || inBox(lat, lon, -28, -19, 14, 25) || inBox(lat, lon, 39, 46, 52, 66);
    if (al > 66 || (lat > 60 && lon > -55 && lon < -18)) b = 'snow';
    else if (m >= 2 && h >= 3) b = h >= 4 || al > 45 ? 'peak' : 'rock';
    else if (desert) b = 'sand';
    else if (al > 58) b = 'tundra';
    else if (al > 46) b = 'forest';
    else if (al < 14) b = 'jungle';
    else b = 'grass';
    const tree = (b === 'forest' || b === 'jungle' || b === 'grass') && n > (b === 'grass' ? 0.86 : 0.7);
    out.push({ c, r, h, b, tree, shade: 0.96 + hash(r, c) * 0.08 });
  }
  return out;
}

export class WorldMap {
  readonly el: HTMLElement;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pinLayer: HTMLElement;
  private plane: HTMLElement;
  private cells = buildCells();
  private heights = new Uint8Array(WORLD.cols * WORLD.rows);
  private base: HTMLCanvasElement | null = null;
  private dots: CanvasPattern | null = null;
  private S = 10;
  private dpr = 1;
  private w = 0;
  private hgt = 0;
  private oy = 0;
  private cam = { x: 0, y: 0 };
  private target = { x: 0, y: 0 };
  private vel = { x: 0, y: 0 };
  private insets = { top: 0, bottom: 0, left: 0, right: 0 };
  private drag: { id: number; x: number; y: number; moved: number } | null = null;
  private pins: Pin[] = [];
  private clouds: { x: number; y: number; s: number; v: number; seed: number }[] = [];
  private waves: { x: number; y: number; p: number }[] = [];
  private route: { a: LatLon; b: LatLon; t: number; flying: boolean } | null = null;
  private follow = false;
  private focused: LatLon | null = null;
  private raf = 0;
  private last = 0;
  private time = 0;
  private ro: ResizeObserver;
  /** Set when the user has panned the map, so selection changes may re-centre it again. */
  panned = false;

  constructor(parent: HTMLElement) {
    this.el = document.createElement('div');
    this.el.className = 'wm';
    this.canvas = document.createElement('canvas');
    this.ctx = this.canvas.getContext('2d')!;
    this.pinLayer = document.createElement('div');
    this.pinLayer.className = 'wm-pins';
    this.plane = document.createElement('div');
    this.plane.className = 'wm-plane hidden';
    this.plane.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12c0-.9-.7-1.5-1.6-1.5H14L9.6 3H7.4l2.2 7.5H5.2L3.6 8.3H2l1 3.7-1 3.7h1.6l1.6-2.2h4.4L7.4 21h2.2l4.4-7.5h5.4c.9 0 1.6-.6 1.6-1.5Z"/></svg>';
    this.el.append(this.canvas, this.pinLayer, this.plane);
    parent.appendChild(this.el);
    for (const cl of this.cells) this.heights[cl.r * WORLD.cols + cl.c] = cl.h;
    for (let i = 0; i < 9; i++) this.clouds.push({ x: hash(i, 7) * WORLD.cols, y: 4 + hash(i, 9) * (WORLD.rows - 10), s: 0.55 + hash(i, 11) * 0.5, v: 0.25 + hash(i, 13) * 0.35, seed: i });
    for (let i = 0; this.waves.length < 70 && i < 2000; i++) {
      const c = Math.floor(hash(i, 21) * WORLD.cols), r = Math.floor(hash(i, 23) * WORLD.rows);
      if (WORLD.land[r][c] === '#' || (r > 0 && WORLD.land[r - 1][c] === '#')) continue;
      this.waves.push({ x: c + 0.5, y: r + 0.5, p: hash(i, 25) * 6.28 });
    }
    this.canvas.addEventListener('pointerdown', (e) => this.down(e));
    this.canvas.addEventListener('pointermove', (e) => this.move(e));
    this.canvas.addEventListener('pointerup', (e) => this.up(e));
    this.canvas.addEventListener('pointercancel', (e) => this.up(e));
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(this.el);
    this.resize();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  dispose(): void {
    cancelAnimationFrame(this.raf);
    this.ro.disconnect();
    this.el.remove();
  }

  /** Screen space the map should keep its focus inside (e.g. not under the bottom sheet). */
  setInsets(top: number, bottom: number, left = 0, right = 0): void {
    this.insets = { top, bottom, left, right };
  }

  addPin(el: HTMLElement, at: LatLon): void {
    this.pinLayer.appendChild(el);
    this.pins.push({ el, lat: at.lat, lon: at.lon });
  }

  /** Smoothly bring a place into the middle of the free screen area. */
  focus(at: LatLon, snap = false): void {
    this.focused = { lat: at.lat, lon: at.lon };
    if (!this.w) { this.cam = { x: NaN, y: NaN }; return; } // not laid out yet: resize() comes back here
    const p = this.toMap(at);
    // stay on the copy of the world nearest to where we are looking
    const W = this.w;
    if (Number.isFinite(this.cam.x)) p.x += Math.round((this.cam.x - p.x) / W) * W;
    this.target = { x: p.x, y: p.y };
    this.panned = false;
    if (snap || !Number.isFinite(this.cam.x)) this.cam = { ...this.target };
  }

  /** Show a dashed route between two places (t = how much of it has been flown). */
  setRoute(a: LatLon | null, b?: LatLon): void {
    this.route = a && b ? { a, b, t: 0, flying: false } : null;
    this.plane.classList.add('hidden');
  }

  /** Fly the plane along the current route. Resolves on landing. */
  fly(ms = 2600): Promise<void> {
    const rt = this.route;
    if (!rt) return Promise.resolve();
    rt.flying = true;
    this.follow = true;
    this.plane.classList.remove('hidden');
    const t0 = performance.now();
    return new Promise((resolve) => {
      const step = () => {
        const k = Math.min(1, (performance.now() - t0) / ms);
        rt.t = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        if (k < 1) requestAnimationFrame(step);
        else { this.follow = false; resolve(); }
      };
      requestAnimationFrame(step);
    });
  }

  // ------------------------------------------------------------------ geometry
  private heightAt(c: number, r: number): number {
    const cc = ((Math.floor(c) % WORLD.cols) + WORLD.cols) % WORLD.cols, rr = Math.floor(r);
    return rr >= 0 && rr < WORLD.rows ? this.heights[rr * WORLD.cols + cc] : 0;
  }

  /** Map-space pixel position of a place, on top of the land it stands on. */
  private toMap(at: LatLon): { x: number; y: number } {
    const c = (at.lon + 180) / WORLD.cell, r = (WORLD.lat0 - at.lat) / WORLD.cell;
    const h = this.heightAt(c, r);
    return { x: c * this.S, y: this.oy + r * this.S * K - h * UNIT * this.S + this.S * K * 0.5 };
  }

  private get focusPoint(): [number, number] {
    const vw = this.canvas.clientWidth, vh = this.canvas.clientHeight, i = this.insets;
    return [(i.left + vw - i.right) / 2, (i.top + vh - i.bottom) / 2];
  }

  private toScreen(mx: number, my: number): [number, number] {
    const [fx, fy] = this.focusPoint;
    let dx = mx - this.cam.x;
    dx -= Math.round(dx / this.w) * this.w;
    return [fx + dx, fy + my - this.cam.y];
  }

  // ------------------------------------------------------------------ baking
  private resize(): void {
    const vw = this.el.clientWidth, vh = this.el.clientHeight;
    if (!vw || !vh) return;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(vh * this.dpr);
    const S = Math.round(Math.max(8, Math.min(18, Math.min(vw / 80, vh / 34))) * 2) / 2;
    if (S !== this.S || !this.base) {
      const fx = this.cam.x / (this.w || 1), fy = (this.cam.y - this.oy) / (this.hgt || 1);
      this.S = S;
      this.bake();
      if (Number.isFinite(fx) && fx) { this.cam.x = this.target.x = fx * this.w; this.cam.y = this.target.y = this.oy + fy * this.hgt; }
      else if (this.focused) this.focus(this.focused, true);
    }
  }

  private bake(): void {
    const S = this.S, d = this.dpr;
    this.w = WORLD.cols * S;
    this.oy = MAX_H * UNIT * S + S;
    this.hgt = WORLD.rows * S * K;
    const cv = document.createElement('canvas');
    cv.width = Math.ceil(this.w * d);
    cv.height = Math.ceil((this.oy + this.hgt + S * 2) * d);
    const g = cv.getContext('2d')!;
    g.scale(d, d);
    const H = S * K, U = UNIT * S;
    const land = (c: number, r: number) => this.heightAt(c, r) > 0;
    // shallows and the land's shadow on the water
    g.fillStyle = SHALLOW;
    for (const cl of this.cells) {
      const x = cl.c * S, y = this.oy + cl.r * H;
      g.beginPath();
      g.roundRect(x - S * 0.55, y - H * 0.5, S * 2.1, H * 2.1, S * 0.6);
      g.fill();
    }
    g.fillStyle = 'rgba(30, 80, 90, 0.16)';
    for (const cl of this.cells) if (!land(cl.c, cl.r + 1)) g.fillRect(cl.c * S, this.oy + (cl.r + 1) * H, S, H * 0.45);
    // voxel columns, back (north) to front (south)
    for (const cl of this.cells) {
      const x = cl.c * S, gy = this.oy + cl.r * H, top = gy - cl.h * U;
      const [tc, fc] = COL[cl.b];
      // front face, only the part that sticks out above the cell in front of it
      const front = this.heightAt(cl.c, cl.r + 1);
      if (front < cl.h) {
        g.fillStyle = shadeHex(fc, cl.shade);
        g.fillRect(x, top + H, S + 0.5, (cl.h - front) * U + 0.5);
        g.fillStyle = 'rgba(0,0,0,0.08)';
        g.fillRect(x, top + H + (cl.h - front) * U - Math.max(1, U * 0.2), S + 0.5, Math.max(1, U * 0.2));
      }
      g.fillStyle = shadeHex(tc, cl.shade);
      g.fillRect(x, top, S + 0.5, H + 0.5);
      // a lighter lip where the top meets a lower neighbour behind
      if (this.heightAt(cl.c, cl.r - 1) < cl.h) { g.fillStyle = 'rgba(255,255,255,0.28)'; g.fillRect(x, top, S + 0.5, Math.max(1, H * 0.14)); }
      if (cl.tree) {
        const tw = S * 0.46, tx = x + (S - tw) / 2 + (hash(cl.r, cl.c * 3) - 0.5) * S * 0.3, ty = top + H * 0.45;
        g.fillStyle = cl.b === 'forest' ? '#3f7f52' : '#4c9450';
        g.fillRect(tx, ty - tw * 1.3, tw, tw * K);
        g.fillStyle = cl.b === 'forest' ? '#356b46' : '#3f7d43';
        g.fillRect(tx, ty - tw * 1.3 + tw * K, tw, tw * 0.75);
      }
    }
    this.base = cv;
    // a soft dotted texture for the sea
    const dot = document.createElement('canvas');
    const ds = Math.round(S * 1.5 * d);
    dot.width = dot.height = ds;
    const dg = dot.getContext('2d')!;
    dg.fillStyle = 'rgba(255,255,255,0.22)';
    dg.beginPath();
    dg.arc(ds / 2, ds / 2, Math.max(1, d * 1.1), 0, Math.PI * 2);
    dg.fill();
    this.dots = this.ctx.createPattern(dot, 'repeat');
  }

  // ------------------------------------------------------------------ input
  private down(e: PointerEvent): void {
    this.canvas.setPointerCapture(e.pointerId);
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, moved: 0 };
    this.vel = { x: 0, y: 0 };
  }

  private move(e: PointerEvent): void {
    const dr = this.drag;
    if (!dr || dr.id !== e.pointerId || this.follow) return;
    const dx = e.clientX - dr.x, dy = e.clientY - dr.y;
    dr.x = e.clientX; dr.y = e.clientY;
    dr.moved += Math.abs(dx) + Math.abs(dy);
    this.cam.x -= dx; this.cam.y -= dy;
    this.clampY();
    this.target = { ...this.cam };
    this.vel = { x: -dx * 60, y: -dy * 60 };
    if (dr.moved > 6) this.panned = true;
  }

  private up(e: PointerEvent): void {
    if (this.drag?.id === e.pointerId) this.drag = null;
  }

  private clampY(): void {
    const vh = this.canvas.clientHeight - this.insets.top - this.insets.bottom;
    const lo = this.oy - this.S * 2 + vh * 0.25, hi = this.oy + this.hgt - vh * 0.25;
    this.cam.y = lo < hi ? Math.max(lo, Math.min(hi, this.cam.y)) : (this.oy + this.hgt / 2);
  }

  // ------------------------------------------------------------------ drawing
  private routePoint(t: number): { x: number; y: number; ang: number } | null {
    const rt = this.route;
    if (!rt) return null;
    const a = this.toMap(rt.a), b = this.toMap(rt.b);
    b.x += Math.round((a.x - b.x) / this.w) * this.w;
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - dist * 0.3;
    const u = 1 - t;
    const x = u * u * a.x + 2 * u * t * cx + t * t * b.x, y = u * u * a.y + 2 * u * t * cy + t * t * b.y;
    const tx = 2 * u * (cx - a.x) + 2 * t * (b.x - cx), ty = 2 * u * (cy - a.y) + 2 * t * (b.y - cy);
    return { x, y, ang: Math.atan2(ty, tx) };
  }

  private frame(now: number): void {
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = Math.min(0.05, (now - (this.last || now)) / 1000);
    this.last = now;
    this.time += dt;
    if (!this.base) return;
    // camera: follow the plane, glide to the target, or coast after a fling
    if (this.follow) {
      const p = this.routePoint(this.route!.t);
      if (p) this.target = { x: p.x, y: p.y };
    }
    if (!this.drag && (Math.abs(this.vel.x) > 1 || Math.abs(this.vel.y) > 1) && this.panned) {
      this.cam.x += this.vel.x * dt; this.cam.y += this.vel.y * dt;
      this.vel.x *= Math.exp(-dt * 6); this.vel.y *= Math.exp(-dt * 6);
      this.clampY();
      this.target = { ...this.cam };
    } else if (!this.drag) {
      const k = 1 - Math.exp(-dt * (this.follow ? 7 : 4.5));
      this.cam.x += (this.target.x - this.cam.x) * k;
      this.cam.y += (this.target.y - this.cam.y) * k;
    }
    const g = this.ctx, d = this.dpr, vw = this.canvas.clientWidth, vh = this.canvas.clientHeight, S = this.S;
    g.setTransform(d, 0, 0, d, 0, 0);
    g.fillStyle = SEA;
    g.fillRect(0, 0, vw, vh);
    const [ox, oy] = this.toScreen(0, 0);
    if (this.dots) {
      g.save();
      g.translate(ox % (S * 1.5), oy % (S * 1.5));
      g.fillStyle = this.dots;
      g.fillRect(-S * 2, -S * 2, vw + S * 4, vh + S * 4);
      g.restore();
    }
    // waves bobbing on the sea
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = Math.max(1, S * 0.14);
    g.lineCap = 'round';
    g.beginPath();
    for (const wv of this.waves) {
      const [sx, sy] = this.toScreen(wv.x * S, this.oy + wv.y * S * K);
      if (sx < -20 || sx > vw + 20 || sy < -20 || sy > vh + 20) continue;
      const b = Math.sin(this.time * 1.6 + wv.p);
      if (b < 0.1) continue;
      const len = S * 0.8 * b;
      g.moveTo(sx - len, sy + b * 1.5);
      g.quadraticCurveTo(sx, sy - S * 0.3 + b * 1.5, sx + len, sy + b * 1.5);
    }
    g.stroke();
    // the land, repeated round the globe
    const bw = this.base.width / d, bh = this.base.height / d;
    let x0 = ox - Math.ceil(ox / this.w) * this.w;
    for (; x0 < vw; x0 += this.w) if (x0 + bw > 0) g.drawImage(this.base, x0, oy, bw, bh);
    // clouds and their shadows
    for (const cl of this.clouds) {
      cl.x = (cl.x + cl.v * dt) % WORLD.cols;
      const [sx, sy] = this.toScreen(cl.x * S, this.oy + cl.y * S * K - S * 3.2);
      if (sx < -S * 6 || sx > vw + S * 6 || sy < -S * 6 || sy > vh + S * 8) continue;
      const s = cl.s * S;
      const puffs: [number, number, number][] = [[0, 0, 2.2], [1.5, -0.6, 1.8], [-1.4, 0.2, 1.5], [0.6, 0.5, 1.6]];
      g.fillStyle = 'rgba(30, 70, 80, 0.10)';
      for (const [px, py, r] of puffs) g.fillRect(sx + px * s - r * s / 2 + s * 0.8, sy + py * s + S * 3.4, r * s, r * s * K * 0.8);
      for (const [px, py, r] of puffs) {
        g.fillStyle = '#e4ecef';
        g.fillRect(sx + px * s - r * s / 2, sy + py * s + r * s * K * 0.5, r * s, r * s * 0.35);
      }
      for (const [px, py, r] of puffs) {
        g.fillStyle = '#ffffff';
        g.fillRect(sx + px * s - r * s / 2, sy + py * s - r * s * K * 0.5, r * s, r * s * K);
      }
    }
    // the route
    const rt = this.route;
    if (rt) {
      const N = 48;
      const pts: [number, number][] = [];
      for (let i = 0; i <= N; i++) {
        const p = this.routePoint(i / N)!;
        pts.push(this.toScreen(p.x, p.y));
      }
      const cut = Math.round(rt.t * N);
      g.lineCap = 'round';
      g.lineJoin = 'round';
      if (cut > 0) {
        g.setLineDash([]);
        g.strokeStyle = 'rgba(255,255,255,0.9)';
        g.lineWidth = Math.max(3, S * 0.42);
        g.beginPath();
        pts.slice(0, cut + 1).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
        g.stroke();
        g.strokeStyle = '#e9573f';
        g.lineWidth = Math.max(1.5, S * 0.2);
        g.stroke();
      }
      g.setLineDash([S * 0.5, S * 0.55]);
      g.lineDashOffset = -this.time * S * 1.2;
      g.strokeStyle = '#e9573f';
      g.lineWidth = Math.max(1.5, S * 0.2);
      g.beginPath();
      pts.slice(cut).forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
      g.stroke();
      g.setLineDash([]);
      if (rt.flying) {
        const p = this.routePoint(rt.t)!;
        const [px, py] = this.toScreen(p.x, p.y);
        const lift = Math.sin(rt.t * Math.PI) * S * 1.6;
        // shadow on the ground, plane above it
        g.fillStyle = 'rgba(30, 60, 70, 0.22)';
        g.beginPath();
        g.ellipse(px, py, S * 0.9, S * 0.4, 0, 0, Math.PI * 2);
        g.fill();
        this.plane.style.transform = `translate(${px.toFixed(1)}px, ${(py - lift).toFixed(1)}px) rotate(${p.ang.toFixed(3)}rad) scale(${(1 + lift / (S * 8)).toFixed(3)})`;
      }
    }
    // pins
    for (const pin of this.pins) {
      const m = this.toMap(pin);
      const [sx, sy] = this.toScreen(m.x, m.y);
      const off = sx < -80 || sx > vw + 80 || sy < -80 || sy > vh + 80;
      pin.el.style.visibility = off ? 'hidden' : '';
      if (!off) pin.el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px)`;
    }
  }
}
