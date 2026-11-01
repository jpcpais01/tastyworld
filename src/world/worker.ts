/// <reference lib="webworker" />
import { WorldPart, PartInit } from './bake';
import type { MeshData } from './mesher';
import type { FarLot } from './farTiles';
import { AMALFI, MADEIRA } from './cityId';

// the villages round Amalfi are baked by a worker of their own (engine/fartown.ts), imported only there
let farTown: Promise<import('./amalfiFar').FarTown> | null = null;

declare const self: DedicatedWorkerGlobalScope;

/** Messages a world worker understands. */
export type WorkerIn =
  | { type: 'init'; part: number; parts: number }
  | { type: 'mesh'; id: number; ix: number; iz: number; lod: number }
  | { type: 'owners'; id: Uint16Array }
  /** The houses on the slopes outside the map: lay them out, then mesh tiles of them at a level of detail. */
  | { type: 'farInit'; lots: FarLot[] }
  | { type: 'farMesh'; id: number; tiles: number[]; lod: number };

/** Messages a world worker sends back. */
export type WorkerOut =
  | { type: 'progress'; stage: string; f: number }
  | { type: 'ready'; init: PartInit }
  | { type: 'mesh'; id: number; ix: number; iz: number; lod: number; mesh: MeshData | null }
  | { type: 'farMesh'; id: number; meshes: { mesh: MeshData; home: Float32Array }[] };

const meshBuffers = (m: MeshData, out: Transferable[]) => {
  out.push(m.positions.buffer, m.attrs.buffer, m.indices.buffer, m.sway.buffer);
  if (m.atlas) out.push(m.atlas.data.buffer);
};

let part: WorldPart | null = null;

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  if (msg.type === 'farInit' && AMALFI) {
    farTown = import('./amalfiFar').then((m) => new m.FarTown(msg.lots));
  } else if (msg.type === 'farInit' && MADEIRA) {
    farTown = import('./madeiraFar').then((m) => m.madeiraFarTown(msg.lots));
  } else if (msg.type === 'farMesh' && farTown) {
    const meshes = (await farTown).mesh(msg.tiles, msg.lod);
    const tr: Transferable[] = [];
    for (const m of meshes) { meshBuffers(m.mesh, tr); tr.push(m.home.buffer); }
    self.postMessage({ type: 'farMesh', id: msg.id, meshes } satisfies WorkerOut, tr);
  } else if (msg.type === 'init') {
    let last = 0;
    part = new WorldPart(msg.part, msg.parts);
    const init = part.init((stage, f) => {
      const now = performance.now();
      if (now - last > 60 || f >= 1) {
        last = now;
        self.postMessage({ type: 'progress', stage, f } satisfies WorkerOut);
      }
    });
    const tr: Transferable[] = [init.height.buffer, init.solid.buffer, init.nav.buffer, init.shore.buffer, init.lightmap.buffer, init.sway.buffer];
    init.tagged.forEach((t) => meshBuffers(t.mesh, tr));
    for (const h of init.hotelRooms) tr.push(h.nav.height.buffer, h.lightmap.data.buffer);
    if (init.interior) {
      init.interior.chunks.forEach((m) => meshBuffers(m, tr));
      tr.push(init.interior.nav.height.buffer, init.interior.lightmap.data.buffer, init.interior.height.buffer, init.interior.solid.buffer);
    }
    self.postMessage({ type: 'ready', init } satisfies WorkerOut, tr);
  } else if (msg.type === 'owners' && part) {
    part.owners = msg.id;
  } else if (msg.type === 'mesh' && part) {
    const mesh = part.mesh(msg.ix, msg.iz, msg.lod);
    const tr: Transferable[] = [];
    if (mesh) meshBuffers(mesh, tr);
    self.postMessage({ type: 'mesh', id: msg.id, ix: msg.ix, iz: msg.iz, lod: msg.lod, mesh } satisfies WorkerOut, tr);
  }
};
