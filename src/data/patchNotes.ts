export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Player-facing patch notes, newest first. Every merge adds an entry. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.3.1',
    date: '2026-10-30',
    title: 'Light on your feet',
    items: [
      'Walking feels much smoother: you now slip around chairs, tree trunks, signs and other props instead of getting stuck on them, and glide along walls when you walk into them at an angle.',
      'Tap-to-walk finds its way through narrow gaps between stalls and tables that it used to give up on, and takes shorter routes.',
      'You can run! Hold Shift on a keyboard, drag the joystick further out on a phone, or double-tap where you want to go.',
    ],
  },
  {
    version: '0.3.0',
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
    version: '0.2.0',
    date: '2026-10-30',
    title: 'A fresh coat of paint',
    items: [
      'A brand new look for every menu: warm paper cards, rounder buttons and crisp new icons.',
      'The HUD is calmer and easier to read. A little sun, sunset or moon shows the time of day next to where you are.',
      'Missions ready to claim now jump to the top of your tracker and passport.',
      'Stall menus hang a noren curtain over the counter, and vendors greet you in their own speech bubble.',
      'Tasting cards show flavour as dots and lay the dish story out in tidy sections.',
      'Settings now use simple switches, grouped into Look, Sound and More.',
      'Dialogue shows how many lines are left, and cooking results award shiny new stars.',
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
