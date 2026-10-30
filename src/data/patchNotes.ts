export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Player-facing patch notes, newest first. Every merge adds an entry. */
export const PATCH_NOTES: PatchNote[] = [
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
