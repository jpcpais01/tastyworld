import type { Quality } from '../engine/renderer';

export interface Settings {
  quality: Quality | 'auto';
  music: boolean;
  sfx: boolean;
  tilt: boolean;
  dayLength: number;
}

export interface SaveState {
  v: 1;
  yen: number;
  tasted: Record<string, number>;
  cooked: Record<string, number>;
  manekis: number[];
  hiddenFound: boolean;
  claimed: string[];
  items: string[];
  wear: Record<string, boolean>;
  flags: { ateAtNight?: boolean; introSeen?: boolean; lastPatch?: string; metFumiko?: boolean };
  settings: Settings;
  title?: string;
  playTime: number;
}

const KEY = 'tastyworld.save.v1';

export function defaultState(): SaveState {
  return {
    v: 1, yen: 3000, tasted: {}, cooked: {}, manekis: [], hiddenFound: false, claimed: [], items: [], wear: {}, flags: {},
    settings: { quality: 'auto', music: true, sfx: true, tilt: true, dayLength: 720 }, playTime: 0,
  };
}

export function loadState(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw) as Partial<SaveState>;
    const d = defaultState();
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings ?? {}) }, flags: { ...d.flags, ...(s.flags ?? {}) } } as SaveState;
  } catch {
    return defaultState();
  }
}

let pending = 0;
export function saveState(s: SaveState): void {
  clearTimeout(pending);
  pending = window.setTimeout(() => {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* storage unavailable */ }
  }, 250);
}

export function resetState(): SaveState {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaultState();
}
