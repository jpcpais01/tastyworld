import type { Look } from '../world/characters';
import type { MeshData } from '../world/mesher';
import type { DetailIn, DetailOut } from './detailworker';

/**
 * Close-up bodies built off the main thread. A person's fine body is eight times the voxels of the coarse one
 * and takes a few milliseconds to build and mesh, so a worker does it while the coarse body stands in; the
 * answer comes back a frame or two later and the body swaps over (see Actor.prefer).
 */
export class BodyDetails {
  private worker: Worker;
  private waiting = new Map<number, (md: MeshData) => void>();
  private nextId = 1;

  constructor(private maxInFlight = 4) {
    this.worker = new Worker(new URL('./detailworker.ts', import.meta.url), { type: 'module', name: 'details' });
    this.worker.onmessage = (e: MessageEvent<DetailOut>) => {
      const done = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      done?.(e.data.md);
    };
  }

  /** Asks for the close-up mesh of `look`; false when too busy to take it now (ask again on a later frame). */
  request(look: Look, done: (md: MeshData) => void): boolean {
    if (this.waiting.size >= this.maxInFlight) return false;
    const id = this.nextId++;
    this.waiting.set(id, done);
    this.worker.postMessage({ id, look } satisfies DetailIn);
    return true;
  }
}
