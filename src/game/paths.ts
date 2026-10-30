import type { NavData } from '../world/bake';
import type { PathIn, PathOut } from './pathworker';

type V2 = [number, number];

/** Finds walking routes without blocking the caller (see PathService). */
export interface Router {
  /** Starts a search; `done` gets the waypoints (or null when there is no way). False when too busy to take it now. */
  find(ax: number, az: number, bx: number, bz: number, done: (path: V2[] | null) => void): boolean;
}

/**
 * A* off the main thread. A route across the city can expand hundreds of thousands of cells, tens of
 * milliseconds on a slow CPU, so the crowd and the map's route guide ask a worker that keeps its own copy
 * of the walkable grid. Answers come back a frame or two later; callers already treat "not yet" as "try
 * again shortly". Runtime changes to the grid (a door opening) are mirrored with `block`.
 */
export class PathService implements Router {
  private worker: Worker;
  private waiting = new Map<number, (path: V2[] | null) => void>();
  private nextId = 1;

  /** `nav` is copied, so the caller's grid stays its own. */
  constructor(nav: NavData, private maxInFlight = 6) {
    this.worker = new Worker(new URL('./pathworker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<PathOut>) => {
      const done = this.waiting.get(e.data.id);
      this.waiting.delete(e.data.id);
      done?.(e.data.path);
    };
    this.worker.postMessage({ type: 'init', nav: { ...nav, height: nav.height.slice() } } satisfies PathIn);
  }

  find(ax: number, az: number, bx: number, bz: number, done: (path: V2[] | null) => void): boolean {
    if (this.waiting.size >= this.maxInFlight) return false;
    const id = this.nextId++;
    this.waiting.set(id, done);
    this.worker.postMessage({ type: 'find', id, ax, az, bx, bz } satisfies PathIn);
    return true;
  }

  /** Mirror of Nav.setBlocked for the worker's grid. */
  block(key: string, rect: [number, number, number, number], blocked: boolean): void {
    this.worker.postMessage({ type: 'block', key, rect, blocked } satisfies PathIn);
  }
}
