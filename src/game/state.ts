import type { Quality } from '../engine/renderer';

export interface Settings {
  quality: Quality | 'auto';
  /** Volumes 0..1. */
  musicVol: number;
  ambVol: number;
  sfxVol: number;
  tilt: boolean;
  dayLength: number;
  /** View distance 0..1 (see viewMetres); null follows the graphics quality. */
  viewDist: number | null;
  /** First-person field of view, degrees. */
  fov: number;
}

/** View distance setting (0..1) to metres. */
export const viewMetres = (v: number) => Math.round(60 + v * 240);
/** The view distance each graphics quality starts at. */
export const VIEW_DEFAULT: Record<Quality, number> = { low: 0.2, medium: 0.35, high: 0.55 };

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
  flags: { ateAtNight?: boolean; introSeen?: boolean; lastPatch?: string; metFumiko?: boolean; shelfOpen?: boolean };
  /** Indices of the hidden daruma found. */
  darumas: number[];
  /** Gachapon capsule ids collected. */
  capsules: string[];
  /** Ids of the shops and restaurants the player has stepped into. */
  rooms: string[];
  /** Ids of the stalls and restaurants the player has come across (they show on the city map). */
  seen: string[];
  /** The spot pinned on the city map, if any. */
  pin?: { x: number; z: number; name: string; jp?: string; id?: string } | null;
  settings: Settings;
  title?: string;
  /** How the traveller appears to friends on co-op trips. */
  profile: { name: string; color: number };
  playTime: number;
}

const KEY = 'tastyworld.save.v1';

export function defaultState(): SaveState {
  return {
    v: 1, yen: 3000, tasted: {}, cooked: {}, manekis: [], hiddenFound: false, claimed: [], items: [], wear: {}, flags: {}, darumas: [], capsules: [], rooms: [], seen: [],
    settings: { quality: 'auto', musicVol: 0.8, ambVol: 0.6, sfxVol: 0.8, tilt: true, dayLength: 720, viewDist: null, fov: 72 }, profile: { name: '', color: 0xe9573f }, playTime: 0,
  };
}

export function loadState(): SaveState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw) as Partial<SaveState>;
    const d = defaultState();
    // older saves had on/off switches for music and effects
    const old = (s.settings ?? {}) as Partial<Settings> & { music?: boolean; sfx?: boolean };
    if (old.music === false && old.musicVol === undefined) old.musicVol = 0;
    if (old.sfx === false && old.sfxVol === undefined) { old.sfxVol = 0; old.ambVol = 0; }
    delete old.music; delete old.sfx;
    return { ...d, ...s, settings: { ...d.settings, ...old }, flags: { ...d.flags, ...(s.flags ?? {}) }, profile: { ...d.profile, ...(s.profile ?? {}) } } as SaveState;
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
