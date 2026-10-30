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
 * The in-game performance overlay (Settings, F3, or ?perf in the address). Frame pacing with percentiles and a
 * frame-time graph, CPU time split into simulation and render submission, GPU time from timer queries
 * where the browser offers them, and what was drawn: draw calls, triangles, shadow cache redraws.
 * Costs nothing while hidden: no queries, no counters, no DOM writes.
 */
export class Perf {
  private el: HTMLDivElement | null = null;
  private text!: HTMLPreElement;
  private graph!: HTMLCanvasElement;
  private ms = new Float32Array(HISTORY);
  private head = 0;
  private filled = 0;
  private t0 = 0;
  private simMs = 0;
  private renderMs = 0;
  private sim = 0;
  private submit = 0;
  private gpu = -1;
  private gpuSum = 0;
  private gpuN = 0;
  private sumN = 0;
  private shown = 0;
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null = null;
  private queries: WebGLQuery[] = [];
  private free: WebGLQuery[] = [];
  private querying = false;
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

  /** Start of a frame; `dt` is the time since the last one (ms). */
  begin(dtMs: number): void {
    if (!this.el) return;
    this.ms[this.head] = dtMs;
    this.head = (this.head + 1) % HISTORY;
    this.filled = Math.min(HISTORY, this.filled + 1);
    this.renderer.info.reset();
    this.t0 = performance.now();
    this.pollGpu();
  }

  /** Simulation done; rendering starts. */
  beginRender(): void {
    if (!this.el) return;
    const now = performance.now();
    this.simMs = now - this.t0;
    this.t0 = now;
    if (this.ext && !this.querying) {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const q = this.free.pop() ?? gl.createQuery();
      if (q) { gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q); this.queries.push(q); this.querying = true; }
    }
  }

  endRender(c: PerfCounters): void {
    if (!this.el) return;
    this.renderMs = performance.now() - this.t0;
    if (this.querying && this.ext) {
      (this.renderer.getContext() as WebGL2RenderingContext).endQuery(this.ext.TIME_ELAPSED_EXT);
      this.querying = false;
    }
    this.sim += this.simMs;
    this.submit += this.renderMs;
    this.sumN++;
    this.counters = c;
    if (performance.now() - this.shown > 250) this.show();
  }

  private pollGpu(): void {
    const ext = this.ext;
    if (!ext) return;
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    while (this.queries.length) {
      const q = this.queries[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.queries.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      if (!gl.getParameter(ext.GPU_DISJOINT_EXT)) { this.gpuSum += ns / 1e6; this.gpuN++; }
      this.free.push(q);
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
    if (this.gpuN) { this.gpu = this.gpuSum / this.gpuN; this.gpuSum = this.gpuN = 0; }
    const sim = this.sim / Math.max(1, this.sumN), sub = this.submit / Math.max(1, this.sumN);
    this.sim = this.submit = this.sumN = 0;
    const info = this.renderer.info, c = this.counters;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    const f1 = (x: number) => x.toFixed(1);
    const tris = info.render.triangles;
    this.text.textContent = [
      `${Math.round(1000 / Math.max(0.1, recent))} fps  ${f1(recent)} ms   p50 ${f1(pick(0.5))}  p99 ${f1(pick(0.99))}  max ${f1(sorted[n - 1] ?? 0)}`,
      `cpu  sim ${f1(sim)}  render ${f1(sub)}   gpu ${this.ext ? (this.gpu >= 0 ? f1(this.gpu) : '…') : 'n/a'} ms`,
      `draws ${info.render.calls}  tris ${tris >= 1e6 ? (tris / 1e6).toFixed(2) + 'M' : Math.round(tris / 1e3) + 'k'}  shadow redraws ${this.redraws() - this.redraws0}`,
      `chunks ${c.chunks}  people ${c.people}  ${c.quality} @ ${c.scale.toFixed(2)}x  ${this.renderer.domElement.width}×${this.renderer.domElement.height}`
        + (mem ? `  heap ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : ''),
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
