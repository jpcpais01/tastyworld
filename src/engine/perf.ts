import type * as THREE from 'three';

const HISTORY = 240; // frames kept for the percentiles and the graph

/** Extra numbers the game reports each frame (shown as they are). */
export interface PerfCounters {
  chunks: number;
  people: number;
  scale: number;
  quality: string;
}

/**
 * The in-game performance overlay (Settings, F3, or ?perf in the address): frame pacing with percentiles
 * and a frame-time graph, what each part of the game costs on the CPU and on the GPU, and what was drawn.
 *
 * The game splits a frame into named laps (`lap` after each system on the CPU, `pass` before each render
 * pass, which also switches a GPU timer query). GPU results are read back a few frames later without
 * waiting, and everything is averaged over a quarter second. While hidden every call returns at once:
 * no clocks, no queries, no counters, no DOM writes.
 */
export class Perf {
  private el: HTMLDivElement | null = null;
  private text!: HTMLPreElement;
  private graph!: HTMLCanvasElement;
  private ms = new Float32Array(HISTORY);
  private head = 0;
  private filled = 0;
  private t = 0;
  private frames = 0;
  private shown = 0;
  /** Summed milliseconds per label over the current window. */
  private cpu = new Map<string, number>();
  private gpu = new Map<string, number>();
  private gpuFrames = 0;
  /** Last window's per-frame averages, shown until the next one. */
  private cpuAvg: [string, number][] = [];
  private gpuAvg: [string, number][] = [];
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  /** Timer queries in flight, oldest first, with their label and whether they close a frame. */
  private queries: { q: WebGLQuery; label: string; last: boolean }[] = [];
  private free: WebGLQuery[] = [];
  private open: { q: WebGLQuery; label: string; last: boolean } | null = null;
  /** The render pass being issued. */
  private stage: string | null = null;
  private redraws0 = 0;
  counters: PerfCounters = { chunks: 0, people: 0, scale: 1, quality: '' };

  /** `onKey` hears F3, so the game can flip its setting (which then calls toggle). */
  constructor(private renderer: THREE.WebGLRenderer, private redraws: () => number, onKey: () => void) {
    if (new URLSearchParams(location.search).has('perf')) this.toggle(true);
    window.addEventListener('keydown', (e) => { if (e.code === 'F3') { e.preventDefault(); onKey(); } });
  }

  get on(): boolean {
    return !!this.el;
  }

  toggle(on = !this.el): void {
    const info = this.renderer.info;
    if (!on) {
      this.el?.remove();
      this.el = null;
      info.autoReset = true;
      return;
    }
    if (this.el) return;
    const el = document.createElement('div');
    el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;pointer-events:none;padding:6px 8px;border-radius:8px;'
      + 'background:rgba(20,16,14,.78);color:#f4ead8;font:11px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';
    this.text = document.createElement('pre');
    this.text.style.cssText = 'margin:0 0 4px;font:inherit;white-space:pre';
    this.graph = document.createElement('canvas');
    this.graph.width = HISTORY;
    this.graph.height = 40;
    this.graph.style.cssText = `display:block;width:${HISTORY}px;height:40px`;
    el.append(this.text, this.graph);
    document.body.appendChild(el);
    this.el = el;
    // counted per frame (three.js otherwise resets them on every render call, and a frame has many)
    info.autoReset = false;
    this.ext = this.renderer.getContext().getExtension('EXT_disjoint_timer_query_webgl2');
    this.redraws0 = this.redraws();
    this.filled = 0;
  }

  /** Start of a frame; `dtMs` is the time since the last one. */
  begin(dtMs: number): void {
    if (!this.el) return;
    this.ms[this.head] = dtMs;
    this.head = (this.head + 1) % HISTORY;
    this.filled = Math.min(HISTORY, this.filled + 1);
    this.renderer.info.reset();
    this.pollGpu();
    this.t = performance.now();
  }

  /** CPU time since the previous lap (or the frame's start) goes to `label`. */
  lap(label: string): void {
    if (!this.el) return;
    const now = performance.now();
    this.cpu.set(label, (this.cpu.get(label) ?? 0) + now - this.t);
    this.t = now;
  }

  /**
   * A render pass starts: the GPU work issued from here on is timed as `label`, and the CPU spent issuing
   * the previous pass goes to "draw <that pass>".
   */
  pass(label: string): void {
    if (!this.el) return;
    this.lap(this.stage ? `draw ${this.stage}` : 'render');
    this.stage = label;
    this.switchQuery(label, false);
  }

  /** End of the frame's GPU work and CPU time. */
  end(c: PerfCounters): void {
    if (!this.el) return;
    this.lap(this.stage ? `draw ${this.stage}` : 'render');
    this.stage = null;
    this.switchQuery(null, true);
    this.frames++;
    this.counters = c;
    if (performance.now() - this.shown > 250) this.show();
  }

  private switchQuery(label: string | null, last: boolean): void {
    const ext = this.ext;
    if (!ext) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    if (this.open) {
      gl.endQuery(ext.TIME_ELAPSED_EXT);
      this.open.last = last;
      this.queries.push(this.open);
      this.open = null;
    }
    if (label === null) return;
    // a pile-up means results are not coming back (lost context, throttled tab): stop timing until they do
    if (this.queries.length > 64) return;
    const q = this.free.pop() ?? gl.createQuery();
    if (!q) return;
    gl.beginQuery(ext.TIME_ELAPSED_EXT, q);
    this.open = { q, label, last: false };
  }

  private pollGpu(): void {
    const ext = this.ext;
    if (!ext) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (this.queries.length) {
      const e = this.queries[0];
      if (!gl.getQueryParameter(e.q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.queries.shift();
      const ns = gl.getQueryParameter(e.q, gl.QUERY_RESULT) as number;
      if (!disjoint) this.gpu.set(e.label, (this.gpu.get(e.label) ?? 0) + ns / 1e6);
      if (e.last) this.gpuFrames++;
      this.free.push(e.q);
    }
  }

  private show(): void {
    this.shown = performance.now();
    const n = this.filled;
    const sorted = Array.from(this.ms.subarray(0, n)).sort((a, b) => a - b);
    const pick = (f: number) => sorted[Math.min(n - 1, Math.floor(n * f))] ?? 0;
    let recent = 0, rn = Math.min(n, 30);
    for (let i = 1; i <= rn; i++) recent += this.ms[(this.head - i + HISTORY) % HISTORY];
    recent /= Math.max(1, rn);
    const avg = (m: Map<string, number>, k: number): [string, number][] =>
      [...m].map(([l, v]): [string, number] => [l, v / k]).sort((a, b) => b[1] - a[1]);
    if (this.frames) { this.cpuAvg = avg(this.cpu, this.frames); this.cpu.clear(); this.frames = 0; }
    if (this.gpuFrames) { this.gpuAvg = avg(this.gpu, this.gpuFrames); this.gpu.clear(); this.gpuFrames = 0; }
    const info = this.renderer.info, c = this.counters;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const f1 = (x: number) => x.toFixed(1);
    const tris = info.render.triangles;
    const total = (l: [string, number][]) => l.reduce((a, [, v]) => a + v, 0);
    // a bar of up to 12 blocks, full at the 120 fps budget (8.3 ms)
    const bar = (v: number) => '█'.repeat(Math.min(12, Math.round(v / 8.33 * 12)));
    const rows = (l: [string, number][]) => l.filter(([, v]) => v >= 0.05).map(([k, v]) => `  ${k.padEnd(16)}${v.toFixed(2).padStart(6)} ${bar(v)}`);
    this.text.textContent = [
      `${Math.round(1000 / Math.max(0.1, recent))} fps  ${f1(recent)} ms   p50 ${f1(pick(0.5))}  p99 ${f1(pick(0.99))}  max ${f1(sorted[n - 1] ?? 0)}`,
      `draws ${info.render.calls}  tris ${tris >= 1e6 ? (tris / 1e6).toFixed(2) + 'M' : Math.round(tris / 1e3) + 'k'}  shadow redraws ${this.redraws() - this.redraws0}`,
      `chunks ${c.chunks}  people ${c.people}  ${c.quality} @ ${c.scale.toFixed(2)}x  ${this.renderer.domElement.width}×${this.renderer.domElement.height}`
        + (mem ? `  heap ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : ''),
      `CPU ${f1(total(this.cpuAvg))} ms`,
      ...rows(this.cpuAvg),
      this.ext ? `GPU ${this.gpuAvg.length ? f1(total(this.gpuAvg)) : '…'} ms` : 'GPU timing not available in this browser',
      ...rows(this.gpuAvg),
    ].join('\n');
    this.drawGraph();
  }

  /** Frame times, oldest left; the lines mark 120 and 60 fps. */
  private drawGraph(): void {
    const g = this.graph.getContext('2d');
    if (!g) return;
    const H = this.graph.height, scale = H / 33.3;
    g.clearRect(0, 0, HISTORY, H);
    for (let i = 0; i < this.filled; i++) {
      const v = this.ms[(this.head - this.filled + i + HISTORY) % HISTORY];
      g.fillStyle = v > 17.5 ? '#ff6b5a' : v > 9 ? '#ffc65a' : '#8fdc8a';
      const h = Math.min(H, v * scale);
      g.fillRect(HISTORY - this.filled + i, H - h, 1, h);
    }
    g.fillStyle = 'rgba(255,255,255,.35)';
    g.fillRect(0, H - Math.round(8.33 * scale), HISTORY, 1);
    g.fillRect(0, H - Math.round(16.67 * scale), HISTORY, 1);
  }
}
