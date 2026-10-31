import { G } from './glyphs';
import { sharePhoto, canShareFiles, type Photo } from '../game/album';

/** Photo mode switches the player can flip; remembered between visits. */
export interface PhotoOptions {
  /** Rule-of-thirds guide on screen (never in the picture). */
  grid: boolean;
  /** The traveller shows in the shot. */
  me: boolean;
  /** Tilt-shift focus in the iso view. */
  focus: boolean;
  /** A small place-and-time stamp in the corner of the picture. */
  stamp: boolean;
}

const KEY = 'tastyworld.photo';

function loadOptions(): PhotoOptions {
  const d: PhotoOptions = { grid: false, me: true, focus: true, stamp: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return d; }
}

export interface PhotoHooks {
  shutter(): void;
  close(): void;
  view(): void;
  album(): void;
  options(o: PhotoOptions): void;
  click(): void;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

/** The photo mode overlay: the HUD steps aside for a viewfinder with a shutter, a few switches and the last shot. */
export class PhotoUI {
  readonly opts = loadOptions();
  private el: HTMLElement;
  private shot: HTMLElement;
  private flashEl: HTMLElement;
  private viewBtn: HTMLButtonElement;
  private lastBtn: HTMLButtonElement;
  private hintEl: HTMLElement;
  private shotTimer = 0;
  private lastUrl = '';
  private chips = new Map<keyof PhotoOptions, HTMLButtonElement>();

  constructor(private hooks: PhotoHooks) {
    const el = (this.el = h('div', 'photo hidden'));
    el.innerHTML = `
      <div class="ph-grid" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="ph-corners" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
      <div class="ph-top">
        <button class="glass ph-done" data-act="close" aria-label="Leave photo mode">${G.close}<span>Done</span></button>
        <div class="glass bar ph-tog" role="group" aria-label="Photo options"></div>
      </div>
      <div class="glass ph-hint"></div>
      <div class="ph-bottom">
        <button class="glass ph-round" data-act="view" aria-label="First-person view" aria-pressed="false">${G.eye}</button>
        <button class="ph-shutter" data-act="shutter" aria-label="Take a photo"><i></i></button>
        <button class="glass ph-round ph-last" data-act="album" aria-label="Open the album">${G.image}</button>
      </div>
      <div class="ph-flash"></div>
      <div class="ph-shot glass hidden"></div>`;
    document.getElementById('app')!.appendChild(el);
    this.shot = el.querySelector('.ph-shot')!;
    this.flashEl = el.querySelector('.ph-flash')!;
    this.viewBtn = el.querySelector('[data-act=view]')!;
    this.lastBtn = el.querySelector('[data-act=album]')!;
    this.hintEl = el.querySelector('.ph-hint')!;
    const tog = el.querySelector('.ph-tog')!;
    const names: [keyof PhotoOptions, string, string][] = [['grid', 'Grid', G.grid], ['me', 'Me', G.person], ['focus', 'Focus', G.focus], ['stamp', 'Stamp', G.caption]];
    for (const [k, label, ic] of names) {
      const b = h('button', 'chip', `${ic}<span>${label}</span>`) as HTMLButtonElement;
      b.title = { grid: 'Thirds grid', me: 'Show yourself in the shot', focus: 'Tilt-shift focus', stamp: 'Place and time stamp on the photo' }[k];
      b.onclick = (e) => {
        e.stopPropagation();
        this.opts[k] = !this.opts[k];
        this.hooks.click();
        this.paint();
        try { localStorage.setItem(KEY, JSON.stringify(this.opts)); } catch { /* storage blocked */ }
        this.hooks.options(this.opts);
      };
      this.chips.set(k, b);
      tog.appendChild(b);
    }
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-act]')) {
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const act = b.dataset.act;
        if (act === 'shutter') { this.hooks.shutter(); return; }
        this.hooks.click();
        if (act === 'close') this.hooks.close();
        else if (act === 'view') this.hooks.view();
        else if (act === 'album') this.hooks.album();
      });
    }
    // controls swallow their own touches so they never turn the camera underneath
    for (const b of el.querySelectorAll('button')) b.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.paint();
  }

  get isOpen(): boolean { return !this.el.classList.contains('hidden'); }

  open(fp: boolean, touch: boolean): void {
    this.el.classList.remove('hidden');
    this.shot.classList.add('hidden');
    this.setFirstPerson(fp, touch);
    this.hintEl.classList.remove('gone');
    clearTimeout(this.shotTimer);
    this.shotTimer = window.setTimeout(() => this.hintEl.classList.add('gone'), 5000);
  }

  close(): void {
    this.el.classList.add('hidden');
    clearTimeout(this.shotTimer);
  }

  setFirstPerson(fp: boolean, touch: boolean): void {
    this.viewBtn.classList.toggle('on', fp);
    this.viewBtn.setAttribute('aria-pressed', String(fp));
    this.el.classList.toggle('fp', fp);
    this.hintEl.textContent = touch
      ? fp ? 'Drag to look around · Tap the eye for the street view' : 'Drag to turn and tilt · Pinch to zoom · Two fingers to move'
      : fp ? 'Drag to look around · Space or Enter takes the photo' : 'Drag to turn and tilt · Scroll to zoom · WASD moves the camera · Space takes the photo';
  }

  private paint(): void {
    for (const [k, b] of this.chips) {
      b.classList.toggle('on', this.opts[k]);
      b.setAttribute('aria-pressed', String(this.opts[k]));
    }
    this.el.classList.toggle('grid', this.opts.grid);
  }

  /** The shutter: a white blink and the viewfinder corners snapping in. */
  flash(): void {
    for (const c of [this.flashEl, this.el]) {
      c.classList.remove('snap');
      void c.offsetWidth;
      c.classList.add('snap');
    }
  }

  /** The shot just taken, as a little print in the corner with ways to keep it. */
  showShot(p: Photo): void {
    if (this.lastUrl) URL.revokeObjectURL(this.lastUrl);
    this.lastUrl = URL.createObjectURL(p.thumb);
    this.lastBtn.innerHTML = `<img src="${this.lastUrl}" alt="">`;
    const share = canShareFiles();
    this.shot.innerHTML = `<img src="${this.lastUrl}" alt="Your photo"><div class="ph-shot-t"><b>Saved to your album</b><small>${esc(p.place)} · ${esc(p.clock)}</small></div>`;
    const btn = h('button', 'btn btn-red', `${share ? G.share : G.download}${share ? 'Share' : 'Save'}`) as HTMLButtonElement;
    btn.onclick = (e) => { e.stopPropagation(); this.hooks.click(); void sharePhoto(p); };
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.shot.appendChild(btn);
    this.shot.classList.remove('hidden');
    this.shot.classList.remove('in');
    void this.shot.offsetWidth;
    this.shot.classList.add('in');
    clearTimeout(this.shotTimer);
    this.shotTimer = window.setTimeout(() => this.shot.classList.add('hidden'), 6000);
  }
}

/**
 * Turns the frame on the canvas into a photo. Call right after the frame is drawn (the WebGL drawing buffer
 * is only readable until the browser shows it). Copies once on the main thread; JPEG encoding is async.
 */
export function capture(src: HTMLCanvasElement, stamp: { place: string; clock: string } | null): Promise<{ blob: Blob; thumb: Blob; w: number; h: number }> {
  const w = src.width, hgt = src.height;
  const c = document.createElement('canvas');
  c.width = w; c.height = hgt;
  const g = c.getContext('2d')!;
  g.drawImage(src, 0, 0);
  // the thumbnail is cut before the stamp, so the album grid stays clean
  const tw = 360, th = Math.round((tw * hgt) / w);
  const tc = document.createElement('canvas');
  tc.width = tw; tc.height = th;
  const tg = tc.getContext('2d')!;
  tg.imageSmoothingQuality = 'high';
  tg.drawImage(c, 0, 0, tw, th);
  if (stamp) drawStamp(g, w, hgt, stamp.place, stamp.clock);
  const jpeg = (cv: HTMLCanvasElement, q: number) => new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('encode failed'))), 'image/jpeg', q));
  return Promise.all([jpeg(c, 0.92), jpeg(tc, 0.8)]).then(([blob, thumb]) => ({ blob, thumb, w, h: hgt }));
}

/** A cream tag in the lower left: the game's name in tomato over the place and time. */
function drawStamp(g: CanvasRenderingContext2D, w: number, hgt: number, place: string, clock: string): void {
  const s = Math.max(0.6, Math.min(w, hgt) / 900);
  const pad = 14 * s, m = 22 * s;
  const title = 'Tasty World';
  const sub = `${place} · ${clock}`;
  g.font = `600 ${22 * s}px Fredoka, ui-rounded, system-ui, sans-serif`;
  const tw = g.measureText(title).width;
  g.font = `700 ${14 * s}px 'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif`;
  const sw = g.measureText(sub).width;
  const bw = Math.max(tw, sw) + pad * 2, bh = 62 * s;
  const x = m, y = hgt - m - bh;
  g.save();
  g.shadowColor = 'rgba(20, 12, 8, 0.35)';
  g.shadowBlur = 16 * s;
  g.shadowOffsetY = 4 * s;
  g.fillStyle = 'rgba(255, 250, 242, 0.92)';
  g.beginPath();
  g.roundRect(x, y, bw, bh, 14 * s);
  g.fill();
  g.restore();
  g.fillStyle = '#e9573f';
  g.fillRect(x, y + 14 * s, 4 * s, bh - 28 * s);
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#e9573f';
  g.font = `600 ${22 * s}px Fredoka, ui-rounded, system-ui, sans-serif`;
  g.fillText(title, x + pad, y + 29 * s);
  g.fillStyle = '#6f6158';
  g.font = `700 ${14 * s}px 'Nunito Variable', Nunito, ui-rounded, system-ui, sans-serif`;
  g.fillText(sub, x + pad, y + 50 * s);
}
