// Fine detail for the city, the layer that makes it read as a real place: manholes, drains, stop lines and
// arrows on the roads, signals at the avenue crossings, mirrors and a tangle of cables in the lanes, posters
// in shop windows and on shutters and bare side walls.
//
// Like the dressing pass it never reads the grid to decide where a prop goes (so every worker strip places
// the same props). It does read it to repaint voxels in place, which only ever changes that worker's own strip.
import { hash3, rng } from './grid';
import { G, V } from './layout';
import { Builder } from './tokyo';
import { glyph, trafficMirror, wire, signalPole, guardRail } from './props';
import { STREETS, Street } from './city';
import { crosswalksOf, signalPoles, railRuns, bridgeRise, HIKARI, NEON, PAVE, ROAD1 } from './roads';
import type { Dresser, Front } from './dressing';

/** Where another street crosses `s`: its extent along `s`. */
function crossings(s: Street): { o: Street; lo: number; hi: number }[] {
  const out: { o: Street; lo: number; hi: number }[] = [];
  for (const o of STREETS) {
    if (o === s || o.ew === s.ew) continue;
    const meets = s.ew ? o.z0 <= s.z1 + 1 && o.z1 >= s.z0 - 1 : o.x0 <= s.x1 + 1 && o.x1 >= s.x0 - 1;
    if (meets) out.push({ o, lo: s.ew ? o.x0 : o.z0, hi: s.ew ? o.x1 : o.z1 });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Road surface

export function roadMarks(b: Builder): void {
  const g = b.grid, c = b.c;
  for (const s of STREETS) {
    if (s.kind === 'arcade') continue;
    const lo = s.ew ? s.x0 : s.z0, hi = s.ew ? s.x1 : s.z1;
    const a0 = s.ew ? s.z0 : s.x0, width = (s.ew ? s.z1 - s.z0 : s.x1 - s.x0) + 1;
    // the avenues' crosswalks are laid out in world/roads.ts (the scramble belongs to both)
    const X = s.kind === 'avenue'
      ? [...crosswalksOf(s.name).map((c) => ({ o: s, lo: c.lo, hi: c.hi })), ...(s.name === NEON.name ? [{ o: s, lo: HIKARI.z0, hi: HIKARI.z1 }] : [])]
      : crossings(s);
    const at = (along: number, across: number) => (s.ew ? [along, a0 + across] : [a0 + across, along]) as [number, number];
    const set = (along: number, across: number, col: number) => { const [x, z] = at(along, across); g.set(x, G - 1, z, col); };
    const inCrossing = (u: number, m: number) => X.some(({ lo: l, hi: h }) => u >= l - m && u <= h + m);
    // a round cover: plain iron, or on the shopping streets one with a painted motif
    const manhole = (u: number, v: number, r: number, motif = 0) => {
      for (let du = -Math.ceil(r); du <= r; du++) for (let dv = -Math.ceil(r); dv <= r; dv++) {
        const d = Math.hypot(du, dv);
        if (d > r) continue;
        const ring = d > r - 0.9;
        set(u + du, v + dv, ring ? c.grate : motif && d < r - 1.4 ? motif : c.manhole); // flat runs merge into few quads
      }
    };
    if (s.kind === 'avenue') {
      const mid = Math.floor(width / 2);
      for (let u = lo + 4; u <= hi - 4; u++) {
        if (inCrossing(u, 7)) continue;
        // drains in the gutters, a manhole now and then in each half
        if (u % 10 === 0) { set(u, 8, c.grate); set(u, width - 9, c.grate); }
        if ((u - lo) % 72 === 30) manhole(u, 13, 1.8);
        if ((u - lo) % 72 === 66) manhole(u, width - 14, 1.8);
        // the odd patch of newer asphalt where the road was dug up
        if (hash3(u >> 3, 7, s.x0) < 0.06 && (u & 7) === 0)
          for (let du = 0; du < 7; du++) for (let v = mid + 2; v <= mid + 6; v++) if (!inCrossing(u + du, 7)) set(u + du, v, c.concreteDark);
      }
      // traffic keeps left: going up `along` uses the half nearer a0 on east-west roads, the far half north-south
      for (const { lo: l, hi: h } of X) {
        for (const dir of [1, -1]) {
          const near = s.ew ? dir > 0 : dir < 0;
          const v0 = near ? 8 : mid + 1, v1 = near ? mid - 1 : width - 9;
          const stop = dir > 0 ? l - 4 : h + 4;
          if (stop < lo + 2 || stop > hi - 2) continue;
          for (let v = v0; v <= v1; v++) { set(stop, v, c.whiteLine); set(stop - dir, v, c.whiteLine); }
          // a straight-ahead arrow further back
          const tip = stop - dir * 6, vc = Math.round((v0 + v1) / 2);
          for (let u = 0; u < 12; u++) {
            const w = u < 3 ? u : 0;
            for (let dv = -w; dv <= w; dv++) set(tip - dir * u, vc + dv, c.whiteLine);
          }
          // the diamond that warns of a crossing ahead
          const dm = stop - dir * 30;
          if (dm > lo + 4 && dm < hi - 4 && !inCrossing(dm, 10))
            for (let du = -4; du <= 4; du++) { const w = 2 - Math.abs(du) / 2; set(dm + du, vc - Math.round(w), c.whiteLine); set(dm + du, vc + Math.round(w), c.whiteLine); }
        }
      }
    } else {
      const mid = Math.floor(width / 2);
      const motif = s.kind === 'street' ? c.petal : 0;
      for (let u = lo + 20; u <= hi - 10; u += s.kind === 'street' ? 36 : 44) {
        if (inCrossing(u, 4)) continue;
        manhole(u, mid + (s.kind === 'street' ? 0 : (u >> 2) % 2 ? 2 : -3), s.kind === 'street' ? 2.4 : 1.8, motif);
      }
      // lanes stop where they meet a bigger street: a stop line and the painted 止まれ
      if (s.kind === 'lane' || s.kind === 'alley') {
        const gr = rng(lo * 13 + a0);
        const stopChars = [glyph(gr, 5), glyph(gr, 5)];
        for (const { o, lo: l, hi: h } of X) {
          if (o.kind === 'lane' || o.kind === 'alley' || o.kind === 'arcade') continue;
          for (const dir of [1, -1]) {
            const stop = dir > 0 ? l - 2 : h + 2;
            if (stop < lo + 14 || stop > hi - 14) continue;
            for (let v = 2; v < width - 2; v++) set(stop, v, c.whiteLine);
            // two characters read from the driver's seat, bottom first
            for (let ch = 0; ch < 2; ch++)
              for (let gy = 0; gy < 5; gy++) for (let gx = 0; gx < 5; gx++) {
                if (!stopChars[ch][gy][gx]) continue;
                const u = stop - dir * (4 + (1 - ch) * 7 + (4 - gy)), v = Math.floor(width / 2) - 2 + (dir > 0 ? gx : 4 - gx);
                set(u, v, c.whiteLine);
              }
          }
        }
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Signals at the avenue crossings

export function signals(d: Dresser): void {
  const b = d.b, k = b.k;
  // one pole per direction of traffic at every crossing with lights (world/roads.ts), its arm over the lane;
  // the lit lenses are drawn live by game/traffic.ts on top of the dark lamps
  for (const p of signalPoles()) {
    b.place(signalPole(k), p.x, p.y, p.z, p.turns);
    const foot: [number, number, number, number] = [p.fx - 0.2, p.fz - 0.2, p.fx + 0.2, p.fz + 0.2];
    d.take(foot);
    b.block(foot[0], foot[1], foot[2], foot[3]);
  }
}

/**
 * White guard fences along the avenues' kerbs, open at the crosswalks: the pavement is for people, the road for
 * the traffic, and everyone crosses at the zebras.
 */
export function rails(d: Dresser): void {
  const b = d.b, k = b.k;
  for (const r of railRuns()) {
    const a = r.av, across = r.high ? ROAD1 + 1 : PAVE;
    // two-metre panels, each at the height of the ground under it (up over Neon-dori's bridge)
    for (let u = r.lo; u <= r.hi; u += 8) {
      const u1 = Math.min(r.hi, u + 7);
      let len = u1 - u + 1;
      if (a === NEON && bridgeRise(u) !== bridgeRise(u1)) len = [...Array(len).keys()].findIndex((i) => bridgeRise(u + i) !== bridgeRise(u)) || len;
      const end = u + len - 1;
      const y = a === NEON ? bridgeRise(u) * V : 0;
      const mid = ((u + end + 1) / 2) * V, cr = (( a.ew ? a.z0 : a.x0) + across + 0.5) * V;
      const [x, z] = a.ew ? [mid, cr] : [cr, mid];
      b.place(guardRail(k, len * V - 0.02), x, y, z, a.ew ? 0 : 1);
      const rect: [number, number, number, number] = a.ew ? [u * V, cr - 0.12, (end + 1) * V, cr + 0.12] : [cr - 0.12, u * V, cr + 0.12, (end + 1) * V];
      d.take(rect);
      b.block(rect[0], rect[1], rect[2], rect[3]);
      u = end - 7;
    }
  }
}


// ---------------------------------------------------------------------------------------------
// Lanes: convex mirrors at the blind corners, and the cables strung every which way between the houses

export function lanes(d: Dresser, fronts: Front[]): void {
  const b = d.b, k = b.k;
  for (const s of STREETS) {
    if (s.kind !== 'lane' && s.kind !== 'alley') continue;
    const lo = s.ew ? s.x0 : s.z0, hi = s.ew ? s.x1 : s.z1;
    const a0 = s.ew ? s.z0 : s.x0, a1 = s.ew ? s.z1 : s.x1;
    const width = a1 - a0 + 1;
    for (const { lo: l, hi: h } of crossings(s)) {
      for (const dir of [1, -1]) {
        const along = dir > 0 ? l - 3 : h + 3;
        if (along < lo + 4 || along > hi - 4) continue;
        const across = (along + a0) % 2 ? a0 + 2 : a1 - 2; // clear of slats and sills a voxel proud of the fronts
        const [x, z] = s.ew ? [(along + 0.5) * V, (across + 0.5) * V] : [(across + 0.5) * V, (along + 0.5) * V];
        // facing back down the lane, at whoever is coming
        const turns = s.ew ? (dir > 0 ? 3 : 1) : (dir > 0 ? 2 : 0);
        d.put(trafficMirror(k), x, z, turns, { pad: 0.05 });
      }
    }
    // cables: from one house to the one across, at the height of the lower roof
    const H = (first: boolean, u: number) => {
      let best = 0;
      for (const { lot, H: hh } of fronts) {
        const edge = s.ew ? (first ? lot.z1 + 1 === s.z0 : lot.z0 === s.z1 + 1) : (first ? lot.x1 + 1 === s.x0 : lot.x0 === s.x1 + 1);
        if (!edge) continue;
        const inside = s.ew ? u >= lot.x0 + 4 && u <= lot.x1 - 4 : u >= lot.z0 + 4 && u <= lot.z1 - 4; // clear of corner signs
        if (inside) best = Math.max(best, hh);
      }
      return best;
    };
    const r = rng(lo * 5 + a0 * 3);
    for (let u = lo + 17; u < hi - 6; u += 13 + Math.floor(r() * 10)) {
      if (crossings(s).some(({ lo: l, hi: h }) => u >= l - 6 && u <= h + 6)) continue;
      const h = Math.min(H(true, u), H(false, u));
      if (h < 24) continue;
      const n = 1 + (r() < 0.45 ? 1 : 0);
      for (let i = 0; i < n; i++) {
        const top = Math.min(7.6, h * V - 0.45) - i * (0.35 + r() * 0.3);
        if (top < 5.6) continue;
        const sag = 0.25 + r() * 0.35;
        const wp = wire(k, width * V - 0.06, sag, i && r() < 0.4 ? k.c.charcoal : undefined);
        const along = (u + i * 0.6 + 0.5) * V, mid = (a0 + width / 2) * V;
        b.place(wp, s.ew ? along : mid, top - (wp.sy - 0.5) * wp.scale, s.ew ? mid : along, s.ew ? 1 : 0);
      }
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Paper: posters in the shop windows, notices on the shutters, bills pasted on bare side walls

export function paper(b: Builder, f: Front): void {
  const { lot } = f, c = b.c, k = b.k, w = lot.width;
  const r = rng(f.seed * 29 + 11);
  const glass = new Set([c.glassLit, c.konbiniGlass, c.glass, c.glassDark]);
  const shutters = new Set([c.shutterA, c.shutterB]);
  const heads = [k.c.signRed, k.c.signBlue, k.c.signYellow, k.c.fabricGreen, k.c.pink, k.c.signBlack];
  // a sheet: header band, then paper with a line or two of print; `ok` says which cells it may cover
  const sheet = (a0: number, y0: number, d: number, sw: number, sh: number, ok: (v: number) => boolean) => {
    const head = heads[Math.floor(r() * heads.length)], seed = Math.floor(r() * 1e4);
    lot.box(a0, y0, d, a0 + sw - 1, y0 + sh - 1, d, (a, y, dd) => {
      const v = lot.get(a, y, dd);
      if (!ok(v)) return v;
      if (y === y0 + sh - 1) return head;
      return (y - y0) % 2 === 1 && hash3(a >> 1, y, seed) < 0.6 ? k.c.ink : k.c.paper; // lines of print, not speckle
    });
  };
  if (f.doors.length || f.ground === 'konbini' || f.ground === 'pharmacy' || f.ground === 'cafe') {
    const n = f.ground === 'konbini' || f.ground === 'pharmacy' ? 3 : 1 + (r() < 0.5 ? 1 : 0);
    for (let i = 0; i < n; i++) sheet(2 + Math.floor(r() * Math.max(1, w - 5)), 4 + Math.floor(r() * 2), 0, 2, 3, (v) => glass.has(v));
  }
  if (f.ground === 'shutter') for (let i = 0; i < 2; i++) sheet(2 + Math.floor(r() * Math.max(1, w - 5)), 4 + Math.floor(r() * 3), 1, 2 + Math.floor(r() * 2), 3, (v) => shutters.has(v));
  // a bare side wall facing open ground at street level gets bills pasted on it
  if (!f.low && r() < 0.5) {
    const [a, out] = r() < 0.5 ? [0, -1] : [w - 1, w];
    const d0 = 2 + Math.floor(r() * 4);
    lot.box(a, 2, d0, a, 7, d0 + 4, (aa, y, d) => {
      const v = lot.get(aa, y, d);
      if (!v || glass.has(v) || lot.get(out, y, d) !== 0 || lot.get(out, 0, d) !== 0) return v;
      const sheetN = Math.floor((d - d0) / 2.5);
      const head = heads[(sheetN + f.seed) % heads.length];
      if ((d - d0) % 5 === 2 && y > 4) return v; // gaps between the bills
      return y === 7 || y === 4 && sheetN === 1 ? head : y === 5 ? k.c.ink : k.c.paper;
    });
  }
}
