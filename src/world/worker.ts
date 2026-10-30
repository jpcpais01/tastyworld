/// <reference lib="webworker" />
import { bakeWorld, BakedWorld } from './bake';
import type { MeshData } from './mesher';

declare const self: DedicatedWorkerGlobalScope;

function collect(w: BakedWorld): Transferable[] {
  const out: Transferable[] = [];
  const mesh = (m: MeshData) => out.push(m.positions.buffer, m.attrs.buffer, m.indices.buffer);
  w.chunks.forEach(mesh);
  w.tagged.forEach((t) => mesh(t.mesh));
  w.interiorChunks.forEach(mesh);
  if (w.nav) out.push(w.nav.height.buffer, w.lightmap.data.buffer, w.interiorNav.height.buffer, w.interiorLightmap.data.buffer, w.height.buffer, w.interiorHeight.buffer, w.shore.buffer);
  return out;
}

self.onmessage = (e: MessageEvent<{ part: number; parts: number }>) => {
  const { part, parts } = e.data;
  let last = 0;
  const w = bakeWorld((stage, f) => {
    const now = performance.now();
    if (now - last > 60 || f >= 1) {
      last = now;
      self.postMessage({ type: 'progress', stage, f });
    }
  }, part, parts);
  self.postMessage({ type: 'done', world: w }, collect(w));
};
