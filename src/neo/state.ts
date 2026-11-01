import type { Look } from '../world/characters';

/**
 * 2040's life sim, kept in the save beside Tasty World's fields (the save itself lives under its own key, see
 * game/state.ts): the body's needs, work, the wardrobe, a home and the quest log.
 */
export interface NeoLife {
  /** The character made at the start: a name and a body. */
  name: string;
  look: Look | null;
  /** 0..100 each. Health falls when hunger or sleep run out. */
  health: number;
  hunger: number;
  sleep: number;
  /** Shifts worked, by job id, and credits earned in all. */
  shifts: Record<string, number>;
  earned: number;
  /** Clothes owned (wardrobe item ids) and what is worn in each slot. */
  owned: string[];
  outfit: Record<string, string>;
  /** Home: a rented flat (paid until a game day) or one owned outright. */
  home: { id: string; owned: boolean; paidTo: number } | null;
  /** Game days lived (the clock rolls over at midnight). */
  day: number;
  /** Ingredients in the home fridge, by id. */
  fridge: Record<string, number>;
  /** Dishes cooked at home. */
  homeCooked: number;
  /** Quest stages by quest id, and secrets found. */
  quests: Record<string, number>;
  secrets: string[];
  /** Times the body gave out (knocked out from hunger or exhaustion). */
  faints: number;
  /** Floors visited in multi-storey buildings ('building:floor'). */
  floors: string[];
}

export function defaultLife(): NeoLife {
  return {
    name: '', look: null, health: 100, hunger: 80, sleep: 85, shifts: {}, earned: 0, owned: [], outfit: {}, home: null, day: 1,
    fridge: {}, homeCooked: 0, quests: {}, secrets: [], faints: 0, floors: [],
  };
}
