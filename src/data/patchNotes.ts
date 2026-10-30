export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Player-facing patch notes, newest first. Every merge adds an entry. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.4.2',
    date: '2026-10-30',
    title: 'Clear water',
    items: [
      'Took the foam off Sakura Canal. The water is clean and glassy again, and it still drifts downstream with ripples, soft lapping edges and the odd floating cherry petal.',
    ],
  },
  {
    version: '0.4.1',
    date: '2026-10-30',
    title: 'Notes on top',
    items: [
      'Fixed the "What\'s new" notes opening behind the title screen. Menus and dialogue now always sit on top.',
    ],
  },
  {
    version: '0.4.0',
    date: '2026-10-30',
    title: 'A living canal',
    items: [
      'Sakura Canal flows now. The water drifts gently downstream, carrying ripples, streaks of foam and the odd fallen cherry petal.',
      'The water has softer, more natural edges. Waves lap against the banks, foam gathers in lacy bands along the stones, and the walls look wet just above the waterline.',
      'The canal banks are wilder, with tumbled boulders along the walls, reed beds and lily pads on the far side.',
      'The see-through view is smarter. Only what is actually between the camera and you gets cut away, so buildings beside you and farther off stay whole.',
      'The cut now sits lower, just above the floor. Its edge melts away voxel by voxel instead of in a noisy dotted fringe.',
      'Less flicker: the camera now moves in whole pixels, so thin details like poles, signs and neon stop shimmering while you walk, and the cut-away edges no longer flicker.',
    ],
  },
  {
    version: '0.3.2',
    date: '2026-10-30',
    title: 'Sounds of the street',
    items: [
      'A brand new soundtrack: a cozy, laid-back tune with koto, electric piano, warm bass and soft brushed drums. It slows down and gets quieter after dark.',
      'Tokyo sounds alive: sparrows chirp in the daytime, bell crickets sing at night, wind chimes tinkle in the breeze and the canal laps gently.',
      'Stand near a grill to hear it crackle and sizzle.',
      'Every sound effect has been remade to be softer and friendlier: wooden taps, bubbly pops, little coin bells, a proper knife on a chopping board and a much cuter cat.',
      'Step into the hidden restaurant and the street music drifts in, muffled, from outside.',
      'Sound now pauses when you switch away from the game.',
    ],
  },
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
