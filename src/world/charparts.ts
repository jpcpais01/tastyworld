/**
 * Part ids. People have a small skeleton: thighs hang from the hips, shins from the knees, forearms
 * from the elbows, and head and arms ride on the torso (see PARENT in the voxel shader).
 */
export const PART = { body: 0, head: 1, armL: 2, armR: 3, legL: 4, legR: 5, tail: 6, hips: 7, shinL: 8, shinR: 9, foreL: 10, foreR: 11, phone: 12 };
export const PART_COUNT = 13;
/** A person's skeleton unit: the voxel size of the coarse (far away) body, in metres. */
export const CHAR_SCALE = 0.075;
/** The voxel size of the close-up body, half a coarse voxel (see world/persondetail.ts). */
export const CHAR_FINE = CHAR_SCALE / 2;
/** Voxel size of the small things people carry in their hands (a phone), finer than the body. */
export const PROP_SCALE = 0.025;
