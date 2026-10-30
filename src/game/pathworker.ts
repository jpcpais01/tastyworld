/// <reference lib="webworker" />
import { Nav } from './nav';
import type { NavData } from '../world/bake';

declare const self: DedicatedWorkerGlobalScope;

/** Messages the path worker understands (see game/paths.ts). */
export type PathIn =
  | { type: 'init'; nav: NavData }
  | { type: 'find'; id: number; ax: number; az: number; bx: number; bz: number }
  | { type: 'block'; key: string; rect: [number, number, number, number]; blocked: boolean };

export type PathOut = { id: number; path: [number, number][] | null };

let nav: Nav | null = null;

self.onmessage = (e: MessageEvent<PathIn>) => {
  const m = e.data;
  if (m.type === 'init') nav = new Nav(m.nav);
  else if (m.type === 'block') nav?.setBlocked(m.key, m.rect, m.blocked);
  else self.postMessage({ id: m.id, path: nav ? nav.findPath(m.ax, m.az, m.bx, m.bz) : null } satisfies PathOut);
};
