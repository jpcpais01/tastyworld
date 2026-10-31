import type { Quality } from '../engine/renderer';
import { CITY } from '../world/cityId';
import { ECONOMY, OLD_WALLET_SCALE, START_PURSE } from '../data/money';

export interface Settings {
  quality: Quality | 'auto';
  /** Volumes 0..1. */
  musicVol: number;
  ambVol: number;
  sfxVol: number;
  tilt: boolean;
  dayLength: number;
  /** A fixed hour of the day, or null to let the day and night cycle run. */
  timeOfDay: number | null;
  /** View distance 0..1 (see viewMetres); null follows the graphics quality. */
  viewDist: number | null;
  /** Very far view distance: pins it to VERY_FAR metres, over the slider (which keeps its own value for when it goes off). */
  veryFar: boolean;
  /** First-person field of view, degrees. */
  fov: number;
  /** Performance overlay (frame rate, timings, draw calls). */
  perf: boolean;
}

/** View distance setting (0..1) to metres. */
export const viewMetres = (v: number) => Math.round(60 + v * 240);
/** The view distance each graphics quality starts at. */
/** The very far view distance (metres), past the slider's top end. */
export const VERY_FAR = 600;
/** The view distance (metres) the settings ask for. */
export const viewSetting = (st: Settings, tier: Quality) => (st.veryFar ? VERY_FAR : viewMetres(st.viewDist ?? VIEW_DEFAULT[tier]));
export const VIEW_DEFAULT: Record<Quality, number> = { low: 0.3, medium: 0.45, high: 0.65 };

export interface SaveState {
  v: 1;
  /** The wallet, in yen wherever you are (data/money.ts). */
  yen: number;
  /** The price scale the wallet was saved under (ECONOMY); older saves had pocket-money prices. */
  econ?: number;
  tasted: Record<string, number>;
  cooked: Record<string, number>;
  manekis: number[];
  hiddenFound: boolean;
  claimed: string[];
  items: string[];
  wear: Record<string, boolean>;
  flags: { ateAtNight?: boolean; introSeen?: boolean; lastPatch?: string; metFumiko?: boolean; shelfOpen?: boolean; climbed?: boolean; photosA?: number };
  /** Indices of the hidden daruma found. */
  darumas: number[];
  /** Gachapon capsule ids collected. */
  capsules: string[];
  /** Ids of the shops and restaurants the player has stepped into. */
  rooms: string[];
  /** Ids of the stalls and restaurants the player has come across (they show on the city map). */
  seen: string[];
  /** Tonight's booking: the hotel, the room (HotelRoomAnchor id) and whether the night has been slept. */
  hotel?: { id: string; room: string; slept?: boolean } | null;
  /** Ids of the hotels the traveller has spent a night in. */
  stays: string[];
  /** The spot pinned on the city map, if any. */
  pin?: { x: number; z: number; name: string; jp?: string; id?: string } | null;
  settings: Settings;
  title?: string;
  /** How the traveller appears to friends on co-op trips. */
  profile: { name: string; color: number };
  playTime: number;
  /** Photos taken in photo mode (the pictures themselves live in the album, game/album.ts). */
  photos: number;
  /** The trip under way: the city and what the save looked like on landing (for the end-of-trip summary). */
  trip?: TripLog | null;
  /** The city-bound parts of the save (see LOCAL) for every city but the one being played, by city id. */
  cities?: Record<string, Partial<SaveState>>;
}

/** A snapshot taken on landing in a city, so the end of the trip can tell what it came to. */
export interface TripLog { city: string; t0: number; tasted: Record<string, number>; photos: number; yen: number; rooms: number }

/**
 * What belongs to one city: its hidden things, the rooms and stalls found, tonight's bed, the map pin and the
 * diary's flags. The wallet, the passport stamps, wardrobe and settings travel with you. Tokyo's are kept at the
 * top level of the save, as they were before there was a second city; the city being played is always there in
 * memory and the others wait under `cities`.
 */
const LOCAL = ['manekis', 'hiddenFound', 'darumas', 'rooms', 'seen', 'hotel', 'pin', 'flags'] as const;
type LocalKey = (typeof LOCAL)[number];
/** Tokyo's city-bound fields while another city is in memory, to write back where old saves expect them. */
let home: Partial<SaveState> | null = null;

function pickLocal(s: Partial<SaveState>): Partial<SaveState> {
  const o: Partial<Record<LocalKey, unknown>> = {};
  for (const k of LOCAL) if (s[k] !== undefined) o[k] = k === 'flags' ? { ...(s.flags ?? {}), lastPatch: undefined } : s[k];
  return o as Partial<SaveState>;
}

const KEY = 'tastyworld.save.v1';

export function defaultState(): SaveState {
  return {
    v: 1, yen: START_PURSE, econ: ECONOMY, tasted: {}, cooked: {}, manekis: [], hiddenFound: false, claimed: [], items: [], wear: {}, flags: {}, darumas: [], capsules: [], rooms: [], seen: [], stays: [], hotel: null,
    settings: { quality: 'auto', musicVol: 0.8, ambVol: 0.6, sfxVol: 0.8, tilt: true, dayLength: 720, timeOfDay: null, viewDist: null, veryFar: false, fov: 72, perf: false }, profile: { name: '', color: 0xe9573f }, playTime: 0, photos: 0,
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
    const lastPatch = s.flags?.lastPatch;
    if ((s.econ ?? 1) < ECONOMY) {
      // real prices arrived (v0.17.0): scale the old pocket money up, never below a new traveller's purse
      s.yen = Math.max(START_PURSE, Math.round((s.yen ?? 0) * OLD_WALLET_SCALE));
      s.econ = ECONOMY;
      if (s.trip) s.trip = { ...s.trip, yen: s.yen };
    }
    if (CITY !== 'tokyo') {
      home = pickLocal(s);
      const here = s.cities?.[CITY] ?? {};
      for (const k of LOCAL) delete s[k];
      Object.assign(s, here);
    }
    return { ...d, ...s, settings: { ...d.settings, ...old }, flags: { ...d.flags, ...(s.flags ?? {}), lastPatch }, profile: { ...d.profile, ...(s.profile ?? {}) } } as SaveState;
  } catch {
    return defaultState();
  }
}

/** The save as it goes to storage: the city being played filed under `cities` unless it is Tokyo. */
function stored(s: SaveState): SaveState {
  if (CITY === 'tokyo') return s;
  return { ...s, ...(home ?? {}), flags: { ...(home?.flags ?? {}), lastPatch: s.flags.lastPatch }, cities: { ...(s.cities ?? {}), [CITY]: pickLocal(s) } };
}

let pending = 0;
export function saveState(s: SaveState): void {
  clearTimeout(pending);
  pending = window.setTimeout(() => saveNow(s), 250);
}

/** Write the save straight away (before the page reloads into another city). */
export function saveNow(s: SaveState): void {
  clearTimeout(pending);
  try { localStorage.setItem(KEY, JSON.stringify(stored(s))); } catch { /* storage unavailable */ }
}

export function resetState(): SaveState {
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
  return defaultState();
}
