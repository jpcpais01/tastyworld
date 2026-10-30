export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Player-facing patch notes, newest first. Every merge adds an entry. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.2.0',
    date: '2026-10-30',
    title: 'Clear views, busier streets',
    items: [
      'No more buildings in the way: anything between the camera and you is now sliced down to street level, like a dollhouse, so you can always see the lane you are walking on.',
      'On phones and tablets, twist two fingers to turn the view. Q and E still work on a keyboard, and so do the rotate buttons.',
      'Kaminari Lane is now laid out like a diorama: the side nearest you stays low and the far side rises taller.',
      'New shops line the streets: a florist, a second-hand bookshop, a fishmonger on ice, a bakery and a pharmacy with its green cross.',
      'New buildings: tiled apartment blocks with balconies, and white kura storehouses with their diamond-tiled walls.',
      'Every building is more detailed, with drainpipes, meters, flower boxes, back windows, rooftop antennas, planters, laundry lines and the odd billboard.',
      'More street life: parked delivery scooters, a red post box, a convex traffic mirror, jizō statues by the shrine, café tables by the canal, decorated manhole covers and yellow tactile paving.',
    ],
  },
  {
    version: '0.1.0',
    date: '2026-10-30',
    title: 'First stop: Tokyo',
    items: [
      'Explore a hand-crafted voxel corner of Tokyo: Kaminari Lane, Lantern Alley and the Sakura Canal, plus a temple plaza with a five-storey pagoda.',
      'Five food stalls and twelve traditional dishes, each with its origin, history, ingredients and cultural story.',
      'Help the vendors cook: flip takoyaki, grill yakitori, build a bowl of shōyu ramen and more.',
      'Your Japan Food Passport: collect stamps, complete missions and earn rewards for your traveller.',
      'Rumour has it three lucky cats guard a secret counter somewhere in the district...',
      'A full day and night cycle. Lanterns glow, neon hums and the canal reflects it all.',
      'Installable as an app and playable offline.',
    ],
  },
];
