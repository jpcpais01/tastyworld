// Palette of voxel materials. Index 0 is reserved for "empty".
export interface PalOpts {
  /** Emissive strength 0..1. */
  emit?: number;
  /** If true, the emission only switches on at night (windows, lanterns). */
  night?: boolean;
  /** Per-voxel brightness jitter 0..1. */
  vary?: number;
  /** Foliage: lit softly by the bake only, never speckled by the real-time shadow map. */
  leaf?: boolean;
}

export class Palette {
  r: number[] = [0];
  g: number[] = [0];
  b: number[] = [0];
  emit: number[] = [0];
  night: boolean[] = [false];
  vary: number[] = [0];
  leaf: boolean[] = [false];
  private keys = new Map<string, number>();

  add(hex: number, o: PalOpts = {}): number {
    const vary = o.vary ?? 0.06;
    const key = `${hex}|${o.emit ?? 0}|${o.night ? 1 : 0}|${vary}|${o.leaf ? 1 : 0}`;
    const hit = this.keys.get(key);
    if (hit !== undefined) return hit;
    const i = this.r.length;
    if (i > 65535) throw new Error('palette full');
    this.r.push((hex >> 16) & 255);
    this.g.push((hex >> 8) & 255);
    this.b.push(hex & 255);
    this.emit.push(o.emit ?? 0);
    this.night.push(!!o.night);
    this.vary.push(vary);
    this.leaf.push(!!o.leaf);
    this.keys.set(key, i);
    return i;
  }
}
