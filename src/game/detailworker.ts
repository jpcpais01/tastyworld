/// <reference lib="webworker" />
import { buildFinePerson, type Look } from '../world/characters';
import { meshBody } from '../world/bodymesh';
import type { MeshData } from '../world/mesher';

declare const self: DedicatedWorkerGlobalScope;

/** A request for a person's close-up body (see game/details.ts), and the mesh that answers it. */
export type DetailIn = { id: number; look: Look };
export type DetailOut = { id: number; md: MeshData };

self.onmessage = (e: MessageEvent<DetailIn>) => {
  const md = meshBody(buildFinePerson(e.data.look));
  self.postMessage({ id: e.data.id, md } satisfies DetailOut, [md.positions.buffer, md.attrs.buffer, md.indices.buffer, md.sway.buffer]);
};
