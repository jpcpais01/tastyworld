// Halcyon City (2040): the street plan, pure data shared by the builder (world/neo.ts), the walkers' graph,
// the pocket map and the crowd. Metres, x east, z south; the city is 432 x 336 m centred on the Halo crossing.

export type District = 'lantern' | 'spire' | 'stacks' | 'neonmile' | 'docks';
export type Rect = [number, number, number, number];

/** A street: `ew` runs along x at z = c (else along z at x = c), `w` wide, from a0 to a1 along its length. */
export interface Seg { name: string; ew: boolean; c: number; w: number; a0: number; a1: number; kind: 'avenue' | 'street' | 'lane' | 'edge' | 'quay' }

export interface Region { d: District; rect: Rect; xs: [number, number][]; zs: [number, number][] }

export const NEO_W = { x0: -216, z0: -168, x1: 216, z1: 168 };
/** The canal's water and its two quays; the bay along the east edge. */
export const CANAL = { x0: 118, x1: 130, qw0: 112, qe1: 136 };
export const BAY_X = 204;
export const HALO: Rect = [-20, -20, 20, 20];

export const REGIONS: Region[] = [
  { d: 'lantern', rect: [-208, -160, -8, -8], xs: [[-150, 10], [-121, 4], [-92, 10], [-68, 4], [-44, 8]], zs: [[-124, 10], [-95, 4], [-66, 10], [-36, 4]] },
  { d: 'stacks', rect: [-208, 8, -8, 160], xs: [[-150, 10], [-121, 4], [-92, 10], [-68, 4], [-44, 8]], zs: [[34, 4], [62, 10], [92, 4], [120, 10]] },
  { d: 'spire', rect: [8, -160, 112, -8], xs: [[60, 10]], zs: [[-124, 10], [-66, 10]] },
  { d: 'neonmile', rect: [8, 8, 112, 160], xs: [[40, 8], [64, 4], [88, 8]], zs: [[34, 4], [62, 10], [92, 4], [120, 10]] },
  { d: 'docks', rect: [136, -160, 200, 160], xs: [[168, 8]], zs: [[-90, 10], [-40, 6], [0, 16], [40, 6], [90, 10]] },
];

const NAMES: Record<District, { x: string[]; z: string[] }> = {
  lantern: { x: ['Joss Street', 'Paper Lane', 'Wok Street', 'Incense Lane', 'Lantern Row'], z: ['Kowloon Road', 'Rice Lane', 'Silk Road', 'Steam Lane'] },
  stacks: { x: ['Block Street', 'Laundry Lane', 'Tower Street', 'Stair Lane', 'Stacks Row'], z: ['Fourth Lane', 'Commons Road', 'Ninth Lane', 'Echo Road'] },
  spire: { x: ['Helix Avenue'], z: ['Capital Road', 'Glass Road'] },
  neonmile: { x: ['Mile Street', 'Velvet Lane', 'Arcade Street'], z: ['Kiss Lane', 'Starlight Road', 'Bass Lane', 'Afterhours Road'] },
  docks: { x: ['Crane Street'], z: ['Pier Road', 'Rope Lane', 'Meridian Boulevard', 'Rust Lane', 'Harbour Road'] },
};

/** Every street, avenue and quay, in metres. */
export const SEGS: Seg[] = (() => {
  const s: Seg[] = [
    { name: 'Meridian Boulevard', ew: true, c: 0, w: 16, a0: -216, a1: BAY_X, kind: 'avenue' },
    { name: 'Spindle Avenue', ew: false, c: 0, w: 16, a0: -168, a1: 168, kind: 'avenue' },
    { name: 'North Ring', ew: true, c: -164, w: 8, a0: -216, a1: BAY_X, kind: 'edge' },
    { name: 'South Ring', ew: true, c: 164, w: 8, a0: -216, a1: BAY_X, kind: 'edge' },
    { name: 'West Ring', ew: false, c: -212, w: 8, a0: -168, a1: 168, kind: 'edge' },
    { name: 'Canal Walk', ew: false, c: (CANAL.qw0 + CANAL.x0) / 2, w: CANAL.x0 - CANAL.qw0, a0: -160, a1: 160, kind: 'quay' },
    { name: 'Dock Quay', ew: false, c: (CANAL.x1 + CANAL.qe1) / 2, w: CANAL.qe1 - CANAL.x1, a0: -160, a1: 160, kind: 'quay' },
    { name: 'Bayfront', ew: false, c: (200 + BAY_X) / 2, w: BAY_X - 200, a0: -160, a1: 160, kind: 'quay' },
  ];
  for (const r of REGIONS) {
    const [x0, z0, x1, z1] = r.rect;
    // (each runs on 4 m into the street, avenue or quay it meets)
    r.xs.forEach(([c, w], i) => s.push({ name: NAMES[r.d].x[i] ?? 'Lane', ew: false, c, w, a0: z0 - 4, a1: z1 + 4, kind: w <= 4 ? 'lane' : 'street' }));
    r.zs.forEach(([c, w], i) => c !== 0 && s.push({ name: NAMES[r.d].z[i] ?? 'Lane', ew: true, c, w, a0: x0 - 4, a1: x1 + 4, kind: w <= 4 ? 'lane' : 'street' }));
  }
  // the docks' two big cross streets carry on over the canal on footbridges to the quay on the far side
  for (const c of [-90, 90]) s.push({ name: c < 0 ? 'Pier Bridge' : 'Harbour Bridge', ew: true, c, w: 8, a0: CANAL.qw0, a1: CANAL.qe1, kind: 'street' });
  return s;
})();

/** Footbridges over the canal (z ranges, metres); the ring roads and the Boulevard cross on their own decks. */
export const BRIDGES: [number, number][] = [[-168, -160], [-94, -86], [-8, 8], [86, 94], [160, 168]];

export function segRect(s: Seg): Rect {
  return s.ew ? [s.a0, s.c - s.w / 2, s.a1, s.c + s.w / 2] : [s.c - s.w / 2, s.a0, s.c + s.w / 2, s.a1];
}

/** Free spans between cuts along one axis (metres). */
export function spans(lo: number, hi: number, cuts: [number, number][]): [number, number][] {
  const out: [number, number][] = [];
  let a = lo;
  for (const [c, w] of [...cuts].sort((p, q) => p[0] - q[0])) {
    const s0 = c - w / 2, s1 = c + w / 2;
    if (s0 > a) out.push([a, s0]);
    a = Math.max(a, s1);
  }
  if (hi > a) out.push([a, hi]);
  return out;
}

export interface Block { d: District; rect: Rect }

export const BLOCKS: Block[] = REGIONS.flatMap((r) => {
  const [x0, z0, x1, z1] = r.rect;
  const out: Block[] = [];
  for (const [ax, bx] of spans(x0, x1, r.xs)) for (const [az, bz] of spans(z0, z1, r.zs)) out.push({ d: r.d, rect: [ax, az, bx, bz] });
  return out;
});

export function districtAt(x: number, z: number): District | null {
  for (const r of REGIONS) if (x >= r.rect[0] && x <= r.rect[2] && z >= r.rect[1] && z <= r.rect[3]) return r.d;
  return null;
}

/** The walkers' street graph: a node at every crossing and street end, edges along each street. */
export function neoGraph(): { nodes: [number, number][]; edges: [number, number][] } {
  const nodes: [number, number][] = [];
  const edges: [number, number][] = [];
  const key = new Map<string, number>();
  const at = (x: number, z: number) => {
    const k = `${Math.round(x * 2)},${Math.round(z * 2)}`;
    let i = key.get(k);
    if (i === undefined) { i = nodes.length; nodes.push([x, z]); key.set(k, i); }
    return i;
  };
  const walk = SEGS;
  for (const s of walk) {
    const stops: number[] = [s.a0 + 1, s.a1 - 1];
    for (const t of walk) {
      if (t.ew === s.ew) continue;
      // t crosses s where t's centre line meets s's span, and s's centre line lies along t's span
      if (t.c > s.a0 - 1 && t.c < s.a1 + 1 && s.c > t.a0 - 1 && s.c < t.a1 + 1) stops.push(t.c);
    }
    // along long streets, a node every ~24 m so walkers spread out
    const sorted = [...new Set(stops.map((v) => Math.round(v * 2) / 2))].sort((a, b) => a - b);
    const fine: number[] = [];
    for (let i = 0; i < sorted.length; i++) {
      fine.push(sorted[i]);
      if (i + 1 < sorted.length) {
        const gap = sorted[i + 1] - sorted[i], n = Math.floor(gap / 24);
        for (let j = 1; j <= n; j++) fine.push(sorted[i] + (gap * j) / (n + 1));
      }
    }
    // walkers keep to one side of a wide avenue
    const off = s.kind === 'avenue' ? 4.5 : 0;
    for (const o of off ? [-off, off] : [0]) {
      let prev = -1;
      for (const v of fine) {
        const id = s.ew ? at(v, s.c + o) : at(s.c + o, v);
        if (prev >= 0 && prev !== id) edges.push([prev, id]);
        prev = id;
      }
    }
    if (off) {
      // cross the avenue at every junction
      for (const v of fine) {
        const a = s.ew ? at(v, s.c - off) : at(s.c - off, v), b2 = s.ew ? at(v, s.c + off) : at(s.c + off, v);
        if (sorted.includes(v)) edges.push([a, b2]);
      }
    }
  }
  // tie each node that sits on another street's centre into that street (crossings of an avenue's side walks)
  for (const s of SEGS.filter((q) => q.kind === 'avenue')) {
    for (let i = 0; i < nodes.length; i++) {
      const [x, z] = nodes[i];
      const along = s.ew ? x : z, across = s.ew ? z : x;
      if (along < s.a0 || along > s.a1 || Math.abs(across - s.c) > 0.01) continue;
      for (const o of [-4.5, 4.5]) edges.push([i, s.ew ? at(x, s.c + o) : at(s.c + o, z)]);
    }
  }
  return { nodes, edges };
}
