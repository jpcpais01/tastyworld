/// <reference lib="webworker" />
import { WorldPart, PartInit } from './bake';
import type { MeshData } from './mesher';

declare const self: DedicatedWorkerGlobalScope;

/** Messages a world worker understands. */
export type WorkerIn =
  | { type: 'init'; part: number; parts: number }
  | { type: 'mesh'; id: number; ix: number; iz: number; lod: boolean };

/** Messages a world worker sends back. */
export type WorkerOut =
  | { type: 'progress'; stage: string; f: number }
  | { type: 'ready'; init: PartInit }
  | { type: 'mesh'; id: number; ix: number; iz: number; lod: boolean; mesh: MeshData | null };

const meshBuffers = (m: MeshData, out: Transferable[]) => out.push(m.positions.buffer, m.attrs.buffer, m.indices.buffer);

let part: WorldPart | null = null;

self.onmessage = (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === 'init') {
    let last = 0;
    part = new WorldPart(msg.part, msg.parts);
    const init = part.init((stage, f) => {
      const now = performance.now();
      if (now - last > 60 || f >= 1) {
        last = now;
        self.postMessage({ type: 'progress', stage, f } satisfies WorkerOut);
      }
    });
    const tr: Transferable[] = [init.height.buffer, init.nav.buffer, init.shore.buffer, init.lightmap.buffer];
    init.tagged.forEach((t) => meshBuffers(t.mesh, tr));
    if (init.interior) {
      init.interior.chunks.forEach((m) => meshBuffers(m, tr));
      tr.push(init.interior.nav.height.buffer, init.interior.lightmap.data.buffer, init.interior.height.buffer);
    }
    self.postMessage({ type: 'ready', init } satisfies WorkerOut, tr);
  } else if (msg.type === 'mesh' && part) {
    const mesh = part.mesh(msg.ix, msg.iz, msg.lod);
    const tr: Transferable[] = [];
    if (mesh) meshBuffers(mesh, tr);
    self.postMessage({ type: 'mesh', id: msg.id, ix: msg.ix, iz: msg.iz, lod: msg.lod, mesh } satisfies WorkerOut, tr);
  }
};
