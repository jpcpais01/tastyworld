import * as THREE from 'three';
import { meshBody } from '../world/bodymesh';
import { buildCar, signalLenses, PAINTS, WHEEL_PARTS, LENS_PARTS, type CarKind, type CarShape } from '../world/cars';
import { POSE, type CharacterBatch } from './charbatch';
import { sampleLightmap } from './actors';
import type { LightMap2D } from '../world/bake';
import { V } from '../world/layout';
import {
  CROSSWALKS, SCRAMBLE, HIKARI, NEON, POLE, LANE, centreOf, carLight, walkLight, roadY, roadShade, signalPoles,
  type Crosswalk, type Phase, type Avenue, type SignalPole,
} from '../world/roads';

/**
 * Cars on Tokyo's two avenues. They come up out of the underpasses at the edge of town, keep left, stop at the
 * lights and for anyone in the road, turn at the scramble and dive back under the street; taxis now and then
 * pull into the rank north of the scramble, wait their turn and set off again. The traffic lights are live: the
 * lit lens of every signal head is drawn by the character batch, as are the cars, so a whole street of them is
 * one draw call, one shared mesh per make and paint, and the wheels turn and steer through the pose texture.
 *
 * The simulation is cheap: a car is a distance along a fixed path. It looks ahead along that path a few times a
 * second for the stop line it must heed, the car in front, or someone on foot, and brakes or pulls away.
 */

type V2 = [number, number];
const TAU = Math.PI * 2;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

// lane lines (metres)
const HC = centreOf(HIKARI), NC = centreOf(NEON);
const EB = HC - LANE, WB = HC + LANE, SB = NC + LANE, NB = NC - LANE;
const XW = HIKARI.x0 * V + 0.4, XE = (HIKARI.x1 + 1) * V - 0.4, ZS = (NEON.z1 + 1) * V - 0.4;
/** The turnaround in front of the railway viaduct, at the top of the taxi rank, and where the rank's first car waits. */
const UTURN_Z = -44.6, RANK_Z = -31.6;
const ACCEL = 2.2, BRAKE = 3.6, HARD = 8;
const MAX_CARS = { desktop: 44, mobile: 26 };

interface Path {
  /** x, z per point, and the distance along the path at each. */
  pts: Float32Array;
  cum: Float32Array;
  /** Speed limit at each point (slow round the corners). */
  vmax: Float32Array;
  len: number;
  /** Stop lines: where the line is (s), and where the path is clear of the crossing beyond it (exit). */
  stops: { s: number; exit: number; cross: Crosswalk; phase: Phase }[];
  /** Turns across another way's lane: wait short of `s` (where the nose would meet it) while a car on `q` nears `sq`. */
  yields: { s: number; q: Path; sq: number }[];
  /** Turning here (speed limited for a corner) at each point. */
  /** Where a taxi waits for its fare (s), -1 if this is no taxi's way in. */
  hold: number;
  /** Ends in the taxi rank (counts towards how many it holds). */
  rank: boolean;
}

interface Shape { gid: number; pivots: THREE.Vector3[]; car: CarShape }

interface Car {
  id: number;
  shape: Shape;
  path: Path;
  /** Distance of the car's centre along the path; its speed; how fast it likes to go. */
  s: number;
  v: number;
  cruise: number;
  copy: number;
  tex: Float32Array;
  shown: boolean;
  x: number; z: number; y: number; yaw: number; pitch: number;
  spin: number; steer: number; dive: number;
  /** Where the centre must stop (absolute s along the path), from the last look ahead. */
  stopS: number;
  scanT: number;
  blocker: Car | null;
  wait: number;
  ignore: Car | null;
  ignoreT: number;
  lightT: number;
  cur: number;
  released: boolean;
  /** What stopped it at the last look (for checks): 0 nothing, 1 a light, 2 the rank, 3 giving way, 4 a car, 5 no room past a crossing, 6 someone ahead, 7 someone beside. */
  why: number;
}

/** Someone on foot the cars look out for: the crowd answers whether anyone stands within r of a point. */
export interface TrafficPeople {
  occupied(x: number, z: number, r: number): boolean;
}

export class Traffic {
  readonly cars: Car[] = [];
  private shapes = new Map<string, Shape>();
  private routes: Record<string, Path> = {};
  private nextId = 1;
  private spawnT: Record<'W' | 'E' | 'S', number> = { W: 1, E: 2, S: 3 };
  private dispatchT = 12;
  /** The signals' clock (s). */
  clock = Math.random() * 600;
  private hidden = false;
  private max: number;
  private poles: { p: SignalPole; copy: number; tex: Float32Array; shown: boolean }[] = [];
  private mtx = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler(0, 0, 0, 'YXZ');
  private v3 = new THREE.Vector3();
  private one = new THREE.Vector3(1, 1, 1);
  private tmpL = new Float32Array(5);
  private samples = new Float32Array(96 * 3);

  constructor(private batch: CharacterBatch | null, private lightmap: LightMap2D | null, mobile: boolean) {
    this.max = mobile ? MAX_CARS.mobile : MAX_CARS.desktop;
    this.buildRoutes();
    this.buildSignals();
  }

  // ------------------------------------------------------------------ routes

  private buildRoutes(): void {
    const W = (b: Builder) => b.start(XW, EB, 1, 0);
    const E = (b: Builder) => b.start(XE, WB, -1, 0);
    const S = (b: Builder) => b.start(NB, ZS, 0, -1);
    // up Neon-dori's stub, round in front of the viaduct and down to the rank, then away from it
    const stub = (b: Builder) => b.toZ(UTURN_Z).turn(1, 0, 1.4).turn(0, 1, 1.4).hold(RANK_Z);
    const outS = (b: Builder) => b.toZ(ZS);
    const outE = (b: Builder) => b.toZ(EB - 2.5).turn(1, 0, 2.5).toX(XE);
    const r = this.routes;
    r.WE = W(new Builder()).toX(XE).done();
    r.WS = W(new Builder()).toX(SB - 3).turn(0, 1, 3).toZ(ZS).done();
    r.EW = E(new Builder()).toX(XW).done();
    r.ES = E(new Builder()).toX(SB + 2.5).turn(0, 1, 2.5).toZ(ZS).done();
    r.SW = S(new Builder()).toZ(WB + 2.5).turn(-1, 0, 2.5).toX(XW).done();
    r.SE = S(new Builder()).toZ(EB + 3).turn(1, 0, 3).toX(XE).done();
    // taxis for the rank: in from the west or the south, out to the south or the east (left turns and straight on,
    // so no two taxis turn across each other in the box)
    const ins: Record<string, (b: Builder) => Builder> = {
      W: (b) => W(b).toX(NB - 2.5).turn(0, -1, 2.5),
      S: (b) => S(b),
    };
    const outs: Record<string, (b: Builder) => Builder> = { S: outS, E: outE };
    for (const [a, fin] of Object.entries(ins)) for (const [o, fout] of Object.entries(outs)) r[`${a}R${o}`] = fout(stub(fin(new Builder()))).done(true);
    for (const p of Object.values(r)) this.findStops(p);
    this.findYields();
  }

  /**
   * Where a turning path cuts across or into another path's lane: a turn gives way to traffic going straight on,
   * and a right turn (the long way across, keeping left) to a left turn into the same lane.
   */
  private findYields(): void {
    const all = Object.values(this.routes);
    const step = 0.5, near = 2.4, CELL = 2.4;
    // every path sampled every 25 cm into a coarse grid, for nearest-point queries
    const grids = new Map<Path, Map<number, number[]>>();
    for (const q of all) {
      const g = new Map<number, number[]>();
      for (let u = 2; u < q.len; u += 0.25) {
        const [x, z] = this.at(q, u), k = (Math.floor(x / CELL) + 512) * 1024 + Math.floor(z / CELL) + 512;
        let l = g.get(k);
        if (!l) g.set(k, (l = []));
        l.push(x, z, u);
      }
      grids.set(q, g);
    }
    for (const p of all) for (const q of all) {
      if (p === q) continue;
      const g = grids.get(q)!;
      // once two paths have shared a lane they only part, which needs no giving way: from then on only the other
      // path further along than where they parted counts (a right turn across the lane a taxi comes back down, say)
      let floor = -Infinity;
      for (let s = 2; s < p.len; s += step) {
        const [x, z] = this.at(p, s);
        // the nearest point of the other path, and the nearest further along than where the two parted
        let t = -1, best = near * near, ta = -1, ba = near * near;
        const kx = Math.floor(x / CELL) + 512, kz = Math.floor(z / CELL) + 512;
        for (let ix = kx - 1; ix <= kx + 1; ix++) for (let iz = kz - 1; iz <= kz + 1; iz++) {
          const l = g.get(ix * 1024 + iz);
          if (l) for (let m = 0; m < l.length; m += 3) {
            const d = (l[m] - x) ** 2 + (l[m + 1] - z) ** 2;
            if (d < ba) { ba = d; ta = l[m + 2]; }
            if (d < best && l[m + 2] > floor) { best = d; t = l[m + 2]; }
          }
        }
        const [x2, z2] = this.at(p, s + 0.3);
        const head = (u: number) => {
          const [qx, qz] = this.at(q, u), [qx2, qz2] = this.at(q, u + 0.3);
          const d = Math.atan2(x2 - x, z2 - z) - Math.atan2(qx2 - qx, qz2 - qz);
          return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
        };
        // the same lane, the same way
        if (ta >= 0 && ba < 0.6 * 0.6 && head(ta) < 0.5) { floor = ta + 6; continue; }
        if (t < 0) continue;
        const da = head(t);
        if (da < 0.5) continue;
        const i = this.index(p, s);
        if (p.vmax[i] > 90 && p.vmax[Math.min(i + 1, p.vmax.length - 1)] > 90) continue;
        const j = this.index(q, t);
        const qTurn = q.vmax[j] < 90 || q.vmax[Math.min(j + 1, q.vmax.length - 1)] < 90;
        // both turning: only the right turn gives way
        if (!qTurn || (this.turnsRight(p, s) && !this.turnsRight(q, t))) p.yields.push({ s, q, sq: t });
        break;
      }
    }
    for (const p of all) p.yields.sort((u, w) => u.s - w.s);
  }

  /** Is the path bending to the right at s? (Heading angle atan2(dx, dz) falls turning right, with z to the south.) */
  private turnsRight(p: Path, s: number): boolean {
    const [ax, az] = this.at(p, s - 0.6), [bx, bz] = this.at(p, s), [cx, cz] = this.at(p, s + 0.6);
    let d = Math.atan2(cx - bx, cz - bz) - Math.atan2(bx - ax, bz - az);
    d = Math.atan2(Math.sin(d), Math.cos(d));
    return d < 0;
  }

  /** The path point just before s. */
  private index(p: Path, s: number): number {
    let lo = 0, hi = p.cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.cum[m] <= s) lo = m; else hi = m; }
    return lo;
  }

  /** Where a path crosses each stop line in the direction it guards. */
  private findStops(p: Path): void {
    const planes: { av: Avenue; at: number; dir: 1 | -1; cross: Crosswalk; phase: Phase; box: [number, number, number, number] }[] = [];
    // the stretch of road a car must not stop in: the zebra and a car's length past it, or the scramble's whole box
    const zone = (c: Crosswalk): [number, number, number, number] => {
      if (c.scramble) return [NEON.x0 * V, (NEON.x1 + 1) * V, HIKARI.z0 * V, (HIKARI.z1 + 1) * V];
      // a crossing a few steps from the next (the canal bank pair) makes one stretch with it
      let l0 = c.lo, h0 = c.hi;
      for (const o of CROSSWALKS) if (o.signal && !o.scramble && o.av === c.av && o.lo - h0 < 16 && l0 - o.hi < 16) { l0 = Math.min(l0, o.lo); h0 = Math.max(h0, o.hi); }
      const a = c.av, lo = (l0 - 2) * V, hi = (h0 + 3) * V, w0 = a.ew ? a.z0 * V : a.x0 * V, w1 = (a.ew ? a.z1 + 1 : a.x1 + 1) * V;
      return a.ew ? [lo, hi, w0, w1] : [w0, w1, lo, hi];
    };
    for (const c of CROSSWALKS) {
      if (!c.signal) continue;
      const ph: Phase = c.scramble ? 'ew' : 'mid';
      planes.push({ av: c.av, at: (c.lo - 5) * V, dir: 1, cross: c, phase: ph, box: zone(c) });
      planes.push({ av: c.av, at: (c.hi + 6) * V, dir: -1, cross: c, phase: ph, box: zone(c) });
    }
    // Neon-dori's two arms of the scramble
    planes.push({ av: NEON, at: (HIKARI.z0 - 5) * V, dir: 1, cross: SCRAMBLE, phase: 'ns', box: zone(SCRAMBLE) });
    planes.push({ av: NEON, at: (HIKARI.z1 + 6) * V, dir: -1, cross: SCRAMBLE, phase: 'ns', box: zone(SCRAMBLE) });
    // no waiting at a line where the queue would stand on the next crossing back (the canal bank pair): the
    // cars stop before the first of the two
    const LEN = 5 / V;
    for (let i = planes.length - 1; i >= 0; i--) {
      const pl = planes[i], at = pl.at / V, b0 = pl.dir > 0 ? at - LEN : at, b1 = pl.dir > 0 ? at : at + LEN;
      if (CROSSWALKS.some((c) => c.signal && !c.scramble && c !== pl.cross && c.av === pl.av && c.lo <= b1 && c.hi >= b0)) planes.splice(i, 1);
    }
    const n = p.pts.length / 2;
    for (let i = 0; i + 1 < n; i++) {
      const ax = p.pts[i * 2], az = p.pts[i * 2 + 1], bx = p.pts[i * 2 + 2], bz = p.pts[i * 2 + 3];
      for (const pl of planes) {
        const ew = pl.av.ew;
        const a = ew ? ax : az, b = ew ? bx : bz, lat = ew ? (az + bz) / 2 : (ax + bx) / 2;
        const c = centreOf(pl.av);
        if (Math.abs(lat - c) > 3.2) continue;
        if ((b - a) * pl.dir <= 0) continue;
        if ((pl.at - a) * pl.dir < 0 || (pl.at - b) * pl.dir > 0) continue;
        const t = (pl.at - a) / (b - a || 1);
        const at = p.cum[i] + t * (p.cum[i + 1] - p.cum[i]);
        const [x0, x1, z0, z1] = pl.box;
        let exit = at + 1;
        for (; exit < p.len; exit += 0.5) {
          const [x, z] = this.at(p, exit);
          if ((x < x0 - 0.3 || x > x1 + 0.3 || z < z0 - 0.3 || z > z1 + 0.3) && exit > at + 2) break;
        }
        p.stops.push({ s: at, exit: Math.min(exit, p.len), cross: pl.cross, phase: pl.phase });
      }
    }
    p.stops.sort((u, w) => u.s - w.s);
  }

  // ------------------------------------------------------------------ signals

  private buildSignals(): void {
    if (!this.batch) return;
    const m = signalLenses();
    const gid = this.batch.shared(meshBody(m));
    const pivots = m.pivots.map((p) => new THREE.Vector3(...p));
    for (const p of signalPoles()) {
      const copy = this.batch.addCopy(gid, pivots);
      const tex = this.batch.texels(copy);
      // placed the way Builder.place puts the prop: footprint snapped to the prop's voxels, turned about its centre
      const odd = p.turns & 1;
      const sx = (odd ? POLE.sz : POLE.sx) * POLE.scale, sz = (odd ? POLE.sx : POLE.sz) * POLE.scale;
      const ox = Math.round((p.x - sx / 2) / POLE.scale) * POLE.scale, oz = Math.round((p.z - sz / 2) / POLE.scale) * POLE.scale;
      this.mtx.makeRotationY((p.turns * Math.PI) / 2).setPosition(ox + sx / 2, p.y, oz + sz / 2);
      this.batch.place(copy, this.mtx);
      tex[POSE.light * 4] = 1; tex[POSE.light * 4 + 1] = 1;
      this.poles.push({ p, copy, tex, shown: true });
    }
  }

  private lightSignals(): void {
    const t = this.clock, blinkOn = (t * 2) % 1 < 0.55;
    for (const pl of this.poles) {
      const c = CROSSWALKS[pl.p.cross];
      const car = carLight(c, t, pl.p.phase === 'mid' ? c.phase : pl.p.phase);
      const walk = walkLight(c, t);
      const o = pl.tex, w = (part: number, on: boolean) => { o[(POSE.rot + part) * 4 + 3] = on ? 0 : 1; };
      w(LENS_PARTS.green, car === 'green');
      w(LENS_PARTS.amber, car === 'amber');
      w(LENS_PARTS.red, car === 'red');
      w(LENS_PARTS.walk, walk === 'walk' || (walk === 'blink' && blinkOn));
      w(LENS_PARTS.stop, walk === 'stop');
    }
  }

  /**
   * Is a moving car's body (grown by r) over the point? People on foot in the road check before each step. (A car
   * standing still is waiting for them: they walk on round it.)
   */
  carAt(x: number, z: number, r: number): boolean {
    for (const o of this.cars) {
      if (o.v < 0.4) continue;
      const dx = x - o.x, dz = z - o.z, hl = o.shape.car.length / 2 + r;
      if (dx * dx + dz * dz > (hl + 1.2) ** 2) continue;
      const c = Math.cos(o.yaw), s = Math.sin(o.yaw);
      if (Math.abs(dx * s + dz * c) < hl && Math.abs(dx * c - dz * s) < o.shape.car.width / 2 + r) return true;
    }
    return false;
  }

  /** May someone on foot step out onto this crossing now? */
  walkOk(c: Crosswalk | null): boolean {
    return !c || walkLight(c, this.clock) === 'walk';
  }

  // ------------------------------------------------------------------ cars

  private shape(kind: CarKind, paint: number): Shape {
    const key = `${kind}:${paint}`;
    let s = this.shapes.get(key);
    if (!s) {
      const car = buildCar(kind, paint, paint + 1);
      s = { gid: this.batch ? this.batch.shared(meshBody(car.model)) : -1, pivots: car.model.pivots.map((p) => new THREE.Vector3(...p)), car };
      this.shapes.set(key, s);
    }
    return s;
  }

  private pickKind(hour: number, taxi: boolean): CarKind {
    if (taxi) return 'taxi';
    const night = hour < 5 || hour >= 22;
    const day = hour >= 7 && hour < 19;
    const w: [CarKind, number][] = [
      ['kei', 0.24], ['hatch', 0.18], ['sedan', 0.1], ['taxi', night ? 0.45 : 0.18], ['minivan', 0.13],
      ['truck', day ? 0.06 : 0.01], ['van', day ? 0.11 : 0.03],
    ];
    let u = Math.random() * w.reduce((a, [, x]) => a + x, 0);
    for (const [k, x] of w) if ((u -= x) <= 0) return k;
    return 'kei';
  }

  /** Taxis in the rank or on their way to it. */
  private ranked(): number {
    let n = 0;
    for (const c of this.cars) if (c.path.rank && !c.released) n++;
    return n;
  }

  private spawn(path: Path, kind: CarKind, s = 0): Car | null {
    if (this.cars.length >= this.max) return null;
    const shape = this.shape(kind, Math.floor(Math.random() * PAINTS[kind].length));
    const copy = this.batch ? this.batch.addCopy(shape.gid, shape.pivots) : -1;
    const tex = this.batch ? this.batch.texels(copy) : new Float32Array(32 * 4);
    const car: Car = {
      id: this.nextId++, shape, path, s, v: s > 0 ? 0 : 7, cruise: rnd(7.2, 9.6) * (kind === 'truck' || kind === 'van' ? 0.9 : 1),
      copy, tex, shown: true, x: 0, z: 0, y: 0, yaw: 0, pitch: 0, spin: Math.random() * TAU, steer: 0, dive: 0,
      stopS: Infinity, scanT: Math.random() * 0.1, blocker: null, wait: 0, ignore: null, ignoreT: 0, lightT: 0, cur: 0, released: false, why: 0,
    };
    this.cars.push(car);
    this.pose(car, 0, true);
    this.light(car);
    return car;
  }

  private remove(c: Car): void {
    if (this.batch) this.batch.remove(c.copy);
    const i = this.cars.indexOf(c);
    if (i >= 0) { this.cars[i] = this.cars[this.cars.length - 1]; this.cars.pop(); }
  }

  /** Something within `r` of path point s on any car's body? (used to keep spawns apart) */
  private clearAt(x: number, z: number, r: number): boolean {
    for (const c of this.cars) if ((c.x - x) ** 2 + (c.z - z) ** 2 < r * r) return false;
    return true;
  }

  /** Fill the streets as if the traffic had been running a while, and a few taxis in the rank. */
  populate(hour: number): void {
    const names = ['WE', 'WS', 'EW', 'ES', 'SW', 'SE'];
    const want = Math.round(this.max * 0.5 * this.density(hour));
    for (let tries = 0; tries < want * 6 && this.cars.length < want; tries++) {
      const p = this.routes[names[Math.floor(Math.random() * names.length)]];
      const s = rnd(4, p.len - 4);
      const [x, z] = this.at(p, s);
      if (Math.abs(x) > 1e4 || !this.clearAt(x, z, 9)) continue;
      const c = this.spawn(p, this.pickKind(hour, false), s);
      if (c) c.v = c.cruise * 0.6;
    }
    const rank = this.routes[`SR${Math.random() < 0.5 ? 'S' : 'E'}`];
    for (let i = 0; i < 3; i++) this.spawn(rank, 'taxi', rank.hold - i * 5.6);
  }

  /** How busy the roads are, 0..1, by the hour: quiet before dawn, rush hours, a long busy day. */
  private density(hour: number): number {
    const h = ((hour % 24) + 24) % 24;
    const bump = (c: number, w: number) => Math.exp(-(((h - c) / w) ** 2));
    const base = h < 5 ? 0.18 : h < 6.5 ? 0.18 + (h - 5) * 0.3 : h < 22 ? 0.72 : 0.72 - (h - 22) * 0.25;
    return clamp(base + 0.3 * bump(8.3, 1.2) + 0.25 * bump(18.2, 1.4), 0.15, 1);
  }

  private spawning(dt: number, hour: number): void {
    const dens = this.density(hour);
    for (const arm of ['W', 'E', 'S'] as const) {
      if ((this.spawnT[arm] -= dt) > 0) continue;
      // Neon-dori gets the scramble's shorter green and the rank's taxis: fewer cars come up it
      this.spawnT[arm] = (arm === 'S' ? rnd(9, 19) : rnd(6.5, 14)) / dens;
      const taxiIn = arm !== 'E' && Math.random() < 0.14 && this.ranked() < 4;
      const kind = this.pickKind(hour, taxiIn);
      let name: string;
      if (taxiIn) name = `${arm}R${Math.random() < 0.5 ? 'S' : 'E'}`;
      else {
        const u = Math.random();
        name = arm === 'W' ? (u < 0.62 ? 'WE' : 'WS') : arm === 'E' ? (u < 0.62 ? 'EW' : 'ES') : (u < 0.52 ? 'SW' : 'SE');
      }
      const p = this.routes[name];
      const [x, z] = this.at(p, 0);
      if (!this.clearAt(x, z, 9)) { this.spawnT[arm] = 1; continue; }
      this.spawn(p, kind);
    }
  }

  // ------------------------------------------------------------------ every frame

  setVisible(on: boolean): void {
    if (this.hidden === !on) return;
    this.hidden = !on;
    for (const c of this.cars) this.show(c, on && c.shown);
    if (this.batch) for (const p of this.poles) this.batch.show(p.copy, on);
  }

  /**
   * `pl` is the player (and `friends` the co-op guests), whom every driver stops for; `people` the crowd.
   * `viewR` is how far the player sees: cars further away are not drawn.
   */
  update(dt: number, hour: number, pl: V2, friends: V2[], people: TrafficPeople | null, viewR: number): void {
    dt = Math.min(dt, 0.1);
    this.clock += dt;
    this.lightSignals();
    this.spawning(dt, hour);
    // the rank: every so often the first taxi in line takes a fare and pulls out
    if ((this.dispatchT -= dt) <= 0) {
      this.dispatchT = rnd(14, 38);
      let head: Car | null = null;
      for (const c of this.cars) if (c.path.hold >= 0 && !c.released && c.s > c.path.hold - 1.2 && c.v < 0.3) head = c;
      if (head) head.released = true;
      else this.dispatchT = 3;
    }
    for (const c of this.cars) {
      if ((c.scanT -= dt) <= 0) { c.scanT = 0.1; this.look(c, pl, friends, people); }
      this.drive(c, dt);
    }
    for (let i = this.cars.length - 1; i >= 0; i--) if (this.cars[i].s >= this.cars[i].path.len - 0.1) this.remove(this.cars[i]);
    for (const c of this.cars) {
      const near = (c.x - pl[0]) ** 2 + (c.z - pl[1]) ** 2 < (viewR + 14) ** 2;
      if (near !== c.shown) { c.shown = near; this.show(c, near && !this.hidden); }
      this.pose(c, dt, near);
      if (near && (c.lightT -= dt) <= 0) this.light(c);
    }
  }

  /** Looks down the road ahead: the stop line to heed, the car in front, anyone on foot. Sets c.stopS. */
  private look(c: Car, pl: V2, friends: V2[], people: TrafficPeople | null): void {
    const p = c.path, sh = c.shape.car;
    const halfL = sh.length / 2, halfW = sh.width / 2;
    const front = c.s + halfL;
    let stop = Infinity;
    c.why = 0;
    c.blocker = null;
    // lights: stop at a red, and at an amber we can still stop for
    let box: { s: number; exit: number } | null = null;
    for (const st of p.stops) {
      const d = st.s - front;
      if (d < -0.2) continue;
      if (d > 60) break;
      const l = carLight(st.cross, this.clock, st.phase);
      if (l === 'red' || (l === 'amber' && d > (c.v * c.v) / (2 * BRAKE) + 0.5)) { stop = st.s - 0.3 - halfL; c.why = 1; break; }
      // a green ahead: only go on over if there is room for us past the crossing (never block the box)
      if (!box && d < 30) box = st;
    }
    // the rank: wait for a fare
    if (p.hold >= 0 && !c.released && c.s < p.hold + 0.5 && p.hold < stop) { stop = p.hold; c.why = 2; }
    // turning across another lane: give way to anyone coming along it
    for (const y of p.yields) {
      const d = y.s - front;
      // under way across the lane: carry on over it (but one standing in it still waits for what is coming)
      if (d < 0.6 && (c.v > 0.8 || d < -halfL * 2)) continue;
      if (d > 30) break;
      const at = d < 0.6 ? c.s : y.s - 0.9 - halfL;
      if (at >= stop) break;
      for (const o of this.cars) {
        if (o.path !== y.q) continue;
        const ohl = o.shape.car.length / 2;
        // one coming along gets the way; one standing still only if it is standing right where we would cross
        const win = o.v > 0.5 ? o.v * 3.6 + 2 : 0.3;
        if (o.s + ohl > y.sq - win && o.s - ohl < y.sq + 1.6) { stop = at; c.blocker = null; c.why = 3; break; }
      }
    }
    // the car in front, or one turning across our way
    let reach = Math.max(7, (c.v * c.v) / (2 * BRAKE) + 7);
    if (box) reach = Math.max(reach, box.exit + sh.length + 2 - front);
    if (c.ignoreT > 0) c.ignoreT -= 0.1; else c.ignore = null;
    const smp = this.samples;
    let n = 0;
    for (let d = 0.4; d <= reach && front + d <= p.len && n < 96; d += 0.9) {
      const [px, pz] = this.at(p, front + d, c.cur);
      smp[n * 3] = px; smp[n * 3 + 1] = pz; smp[n * 3 + 2] = front + d; n++;
    }
    let queue = Infinity;
    for (const o of this.cars) {
      if (o === c || o === c.ignore) continue;
      const dx = o.x - c.x, dz = o.z - c.z;
      if (dx * dx + dz * dz > (reach + 6) ** 2) continue;
      const oc = Math.cos(o.yaw), os = Math.sin(o.yaw);
      const hl = o.shape.car.length / 2 + 0.3, hw = o.shape.car.width / 2 + halfW + 0.15;
      for (let i = 0; i < n; i++) {
        // into the other car's frame: its +z is forward (os, oc), its +x is (oc, -os)
        const rx = smp[i * 3] - o.x, rz = smp[i * 3 + 1] - o.z;
        const lz = rx * os + rz * oc, lx = rx * oc - rz * os;
        if (Math.abs(lz) < hl && Math.abs(lx) < hw) {
          const at = smp[i * 3 + 2];
          const want = at - 0.9 - c.v * 0.5 - halfL;
          if (want < stop) { stop = want; c.blocker = o; c.why = 4; }
          // a slow queue past the crossing (not a car turning across it, which we just wait behind)
          if (o.v < 2.5 && box && at >= box.exit - 0.5) queue = Math.min(queue, at);
          break;
        }
      }
    }
    // a queue that would leave us standing on the crossing: wait at the line until it moves up
    if (box && queue < box.exit + sh.length + 0.6) {
      const line = box.s - 0.3 - halfL;
      if (line < stop && c.s <= line + 0.05) { stop = line; c.why = 5; }
    }
    // anyone on foot in the road ahead (the crowd only knows the people near the player, who are the ones seen)
    const look = Math.max(4, (c.v * c.v) / (2 * BRAKE) + 4);
    for (let d = -0.3; d <= look; d += 1.1) {
      const s = front + d;
      if (s > p.len || s - 1.4 - halfL > stop) break;
      const [px, pz] = this.at(p, s);
      let hit = (px - pl[0]) ** 2 + (pz - pl[1]) ** 2 < (halfW + 0.55) ** 2;
      for (const f of friends) hit ||= (px - f[0]) ** 2 + (pz - f[1]) ** 2 < (halfW + 0.55) ** 2;
      if (!hit && people) hit = people.occupied(px, pz, halfW + 0.5);
      if (hit) { if (s - 1.4 - halfL < stop) { stop = s - 1.4 - halfL; c.why = 6; } c.blocker = null; break; }
    }
    // caught on a crossing as the people flood over it: stand still while anyone is right beside the car
    if (people && stop > c.s) {
      const sx = Math.sin(c.yaw), cz = Math.cos(c.yaw);
      for (const k of [-halfL + 0.6, 0, halfL - 0.4]) {
        if (people.occupied(c.x + sx * k, c.z + cz * k, halfW + 0.45)) { stop = c.s; c.blocker = null; c.why = 7; break; }
      }
    }
    c.stopS = stop;
  }

  private drive(c: Car, dt: number): void {
    const p = c.path;
    // slow for the corners ahead, and to stop where we must
    let want = c.cruise;
    const sh = c.shape.car;
    for (let i = c.cur; i < p.vmax.length && p.cum[i] < c.s + 28; i++) {
      const d = Math.max(0, p.cum[i] - c.s - sh.length * 0.3);
      want = Math.min(want, Math.sqrt(p.vmax[i] * p.vmax[i] + 2 * BRAKE * d));
    }
    const gap = c.stopS - c.s;
    want = Math.min(want, gap <= 0 ? 0 : Math.sqrt(2 * BRAKE * gap));
    if (gap < 0.05 && c.v < 1) want = 0;
    const was = c.v;
    if (want > c.v) c.v = Math.min(want, c.v + ACCEL * (1 - c.v / 14) * dt);
    else c.v = Math.max(want, c.v - (gap < 2 ? HARD : BRAKE * 1.4) * dt);
    c.v = Math.max(0, c.v);
    // nose dips under braking, lifts pulling away
    c.dive += (clamp((was - c.v) / Math.max(dt, 1e-3), -3, 6) * 0.006 - c.dive) * Math.min(1, dt * 6);
    // stuck behind someone stuck behind us (two cars turning across each other): the elder goes first
    if (c.v < 0.1 && c.blocker) {
      c.wait += dt;
      const b = c.blocker;
      if (c.wait > 4 && b.v < 0.1 && b.blocker === c && c.id < b.id) { c.ignore = b; c.ignoreT = 3; c.wait = 0; }
    } else c.wait = 0;
    c.s = Math.min(p.len, c.s + c.v * dt);
    while (c.cur + 1 < p.cum.length && p.cum[c.cur + 1] < c.s) c.cur++;
  }

  /** Path point at distance s (clamped to the ends). */
  private at(p: Path, s: number, hint = 0): V2 {
    const cum = p.cum;
    let i = hint;
    if (s <= 0) return [p.pts[0], p.pts[1]];
    if (s >= p.len) { const n = cum.length - 1; return [p.pts[n * 2], p.pts[n * 2 + 1]]; }
    if (cum[i] > s) i = 0;
    // binary search from the hint
    let lo = i, hi = cum.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (cum[m] <= s) lo = m; else hi = m; }
    const t = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
    return [p.pts[lo * 2] + (p.pts[hi * 2] - p.pts[lo * 2]) * t, p.pts[lo * 2 + 1] + (p.pts[hi * 2 + 1] - p.pts[lo * 2 + 1]) * t];
  }

  /** Places the body from its axles, tips it up the ramps and over the bridge, turns and steers the wheels. */
  private pose(c: Car, dt: number, draw = true): void {
    const sh = c.shape.car, p = c.path;
    const sm = c.s + sh.axleMid;
    const [fx, fz] = this.at(p, sm + sh.wheelbase / 2, c.cur), [rx, rz] = this.at(p, sm - sh.wheelbase / 2, c.cur);
    const yF = roadY(fx, fz), yR = roadY(rx, rz);
    const yaw = Math.atan2(fx - rx, fz - rz);
    // how sharply the path bends just ahead: the front wheels follow it
    const [ax, az] = this.at(p, sm + sh.wheelbase / 2 + 1.2, c.cur);
    let bend = Math.atan2(ax - fx, az - fz) - yaw;
    bend = Math.atan2(Math.sin(bend), Math.cos(bend));
    c.steer += (clamp(bend * 1.6, -0.55, 0.55) - c.steer) * Math.min(1, dt * 8);
    c.spin = (c.spin + (c.v * dt) / sh.wheelR) % TAU;
    const cx = (fx + rx) / 2 - Math.sin(yaw) * sh.axleMid, cz = (fz + rz) / 2 - Math.cos(yaw) * sh.axleMid;
    c.x = cx; c.z = cz; c.yaw = yaw;
    c.y = (yF + yR) / 2;
    c.pitch = Math.atan2(yF - yR, sh.wheelbase) - c.dive;
    if (!draw) return;
    const o = c.tex;
    for (let i = 0; i < 4; i++) {
      const k = (POSE.rot + WHEEL_PARTS[i]) * 4;
      o[k] = c.spin;
      o[k + 1] = i < 2 ? c.steer : 0;
    }
    if (!this.batch) return;
    this.e.set(-c.pitch, yaw, 0);
    this.q.setFromEuler(this.e);
    this.mtx.compose(this.v3.set(cx, c.y, cz), this.q, this.one);
    this.batch.place(c.copy, this.mtx);
  }

  private light(c: Car): void {
    c.lightT = rnd(0.2, 0.35);
    const o = c.tex, L = this.tmpL;
    if (this.lightmap) sampleLightmap(this.lightmap, c.x, c.z, L); else L.set([1, 1, 0, 0, 0]);
    const sh = roadShade(c.x, c.z, c.y);
    o[POSE.light * 4] = L[0] * sh;
    o[POSE.light * 4 + 1] = Math.max(0.35 * sh, L[1] * sh);
    o[POSE.light * 4 + 2] = 0;
    // the orange sodium lamps down in the tunnels
    const sodium = 1 - sh;
    o[POSE.lamp * 4] = L[2] * sh + sodium * 0.55;
    o[POSE.lamp * 4 + 1] = L[3] * sh + sodium * 0.3;
    o[POSE.lamp * 4 + 2] = L[4] * sh + sodium * 0.06;
  }

  private show(c: Car, on: boolean): void {
    if (this.batch) this.batch.show(c.copy, on);
  }

  /** Cars currently on the roads (for checks and the perf overlay). */
  get count(): number {
    return this.cars.length;
  }

  /** Route names (for checks). */
  get routeNames(): string[] {
    return Object.keys(this.routes);
  }

  /** A route (for checks). */
  route(name: string): Path {
    return this.routes[name];
  }

  /** Spawns a car on a route at s (for checks). */
  addCar(name: string, kind: CarKind, s: number): void {
    this.spawn(this.routes[name], kind, s);
  }
}

/** Builds a path from straight runs and quarter turns, keeping left, in metres. */
class Builder {
  private pts: number[] = [];
  private vmax: number[] = [];
  private x = 0; private z = 0; private hx = 1; private hz = 0;
  private holdAt = NaN;

  start(x: number, z: number, hx: number, hz: number): this {
    this.x = x; this.z = z; this.hx = hx; this.hz = hz;
    this.push(x, z, 99);
    return this;
  }

  private push(x: number, z: number, vmax: number): void {
    this.pts.push(x, z);
    this.vmax.push(vmax);
  }

  /** Straight on until x (or z) reaches the value, in steps of a few metres. */
  toX(x: number): this { return this.run(Math.abs(x - this.x)); }
  toZ(z: number): this { return this.run(Math.abs(z - this.z)); }

  private run(d: number): this {
    const n = Math.max(1, Math.ceil(d / 4));
    const x0 = this.x, z0 = this.z;
    for (let i = 1; i <= n; i++) this.push(x0 + this.hx * (d * i) / n, z0 + this.hz * (d * i) / n, 99);
    this.x = x0 + this.hx * d; this.z = z0 + this.hz * d;
    return this;
  }

  /** A quarter turn of radius r onto heading (hx, hz). */
  turn(hx: number, hz: number, r: number): this {
    const cx = this.x + hx * r, cz = this.z + hz * r;
    const a0 = Math.atan2(-hz, -hx), a1 = Math.atan2(this.hz, this.hx);
    let sweep = a1 - a0;
    sweep = Math.atan2(Math.sin(sweep), Math.cos(sweep));
    const n = Math.max(4, Math.ceil((Math.abs(sweep) * r) / 0.4));
    const vt = Math.sqrt(2.3 * r);
    for (let i = 1; i <= n; i++) {
      const a = a0 + (sweep * i) / n;
      this.push(cx + Math.cos(a) * r, cz + Math.sin(a) * r, vt);
    }
    this.x = cx + this.hx * r; this.z = cz + this.hz * r;
    this.hx = hx; this.hz = hz;
    return this;
  }

  /** A taxi waits here (taxi rank head) until it is sent off. */
  hold(z: number): this {
    this.toZ(z);
    this.holdAt = this.pts.length / 2 - 1;
    return this;
  }

  done(rank = false): Path {
    const n = this.pts.length / 2;
    const pts = Float32Array.from(this.pts), cum = new Float32Array(n), vmax = Float32Array.from(this.vmax);
    for (let i = 1; i < n; i++) cum[i] = cum[i - 1] + Math.hypot(pts[i * 2] - pts[i * 2 - 2], pts[i * 2 + 1] - pts[i * 2 - 1]);
    return { pts, cum, vmax, len: cum[n - 1], stops: [], yields: [], hold: Number.isNaN(this.holdAt) ? -1 : cum[this.holdAt], rank };
  }
}
