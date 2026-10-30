export interface PatchNote {
  version: string;
  date: string;
  title: string;
  items: string[];
}

/** Player-facing patch notes, newest first. Every merge adds an entry. */
export const PATCH_NOTES: PatchNote[] = [
  {
    version: '0.8.3',
    date: '2026-10-30',
    title: 'Real sun shadows',
    items: [
      'Everything in the street now casts a proper shadow in the sun: shop signs, lanterns, awnings, stools, air conditioners on the roofs, and every person and cat walking by, you included.',
      'Shadows are crisp near the ground with soft edges, and they stay perfectly still while the camera follows you, no flicker or crawling edges.',
      'Cherry trees keep their soft glow in the sun instead of getting speckled.',
      'At dusk the sharp shadows fade gently into the moonlit night, and the lanterns take over as before.',
      'Built to be light: the street\'s shadows are only redrawn when you walk far or zoom a lot, so phones stay smooth. Low quality uses a lighter version.',
    ],
  },
  {
    version: '0.8.2',
    date: '2026-10-30',
    title: 'Solid all round',
    items: [
      'Fixed being able to see through the sides of everyone\'s body: torsos, hips, shoulders and necks are solid from every angle now, for you, the locals and your co-op friends.',
      'Bent elbows and knees no longer open a hole on the outside of the joint. Swing an arm, sit down or break into a run and the limb stays in one piece.',
    ],
  },
  {
    version: '0.8.1',
    date: '2026-10-30',
    title: 'A quieter, cozier street',
    items: [
      'No more chattering voices in your ear. Busy streets now have a soft, distant murmur of people instead, which fades away when the street empties out and at night.',
      'Footsteps are much quieter and softer, like rubber soles on stone, with gentle variation from step to step. Other people\'s steps only reach you when they pass close by.',
      'Shop radios play a little lower, and the presenter now lets the music do the talking: just a soft chime between songs.',
      'Crows, bicycle bells and the passing train come by less often, so the street stays calm.',
    ],
  },
  {
    version: '0.8.0',
    date: '2026-10-30',
    title: 'A cozier HUD',
    items: [
      'A brand new HUD made of small pieces of warm, smoky glass that sit in the world instead of covering it.',
      'Where you are and the time now share one slim pill, with a little sun, sunset or moon.',
      'Missions are down to a single chip with a progress ring. When a reward is ready it glows red: tap it to claim.',
      'Your yen, passport, map and settings live together in one bar.',
      'The controls list shows for a few seconds when you arrive, then tucks behind a small keyboard button. Hover it to see them again.',
      'Stall and shop curtains are real noren now: fabric panels hanging from a wooden rod, one character per panel, swaying gently.',
      'Menus got a makeover: a dark stall-front header over warm paper, with softer cards and no more glaring white.',
      'Dialogue and notifications use the same warm glass as the HUD.',
    ],
  },
  {
    version: '0.7.6',
    date: '2026-10-30',
    title: 'Take a seat',
    items: [
      'Fixed customers in some cafés sitting on top of each other: smaller cafés squeezed a table in where the counter stools were. Every seat now has room around it and one person on it.',
      'People sit on their seats properly now, on the stool rather than sunk into it, at every café, izakaya, soba counter and bench. Stools at the counters and tables moved out a little so knees fit underneath instead of through the wood.',
      'The kissa booths are deeper, with a proper padded seat in front of each high back and a table on one leg, so the people across from each other no longer bump knees.',
      'Passers-by can now also take a coffee break on the café terrace stools along the canal promenade.',
    ],
  },
  {
    version: '0.7.5',
    date: '2026-10-30',
    title: 'Solid ground all the way',
    items: [
      'No more peeking into the void. The ground now carries on past the edges of the map into the soft haze, and there is a floor under everything, so the ends of the canal and the edges of the street never show empty space, from above or at eye level.',
    ],
  },
  {
    version: '0.7.4',
    date: '2026-10-30',
    title: 'A street you can hear',
    items: [
      'Footsteps! Yours and everyone else\'s, and they change with the ground: paving stones, the temple gravel, the grass on Cherry Bank and wooden or tiled shop floors.',
      'People chatting nearby murmur away in their own little made-up language, vendors call out when they greet you, and the regulars in shops natter over their food. Further off you hear the hum of the crowd.',
      'Some shops keep a radio on: the kissa plays jazz, the izakaya an old ballad, and others a bit of city pop, with a chatty DJ in between. The background tune steps back while you listen.',
      'Sounds now come from where they happen: they pan as you turn the camera, fade with distance and come through muffled from the other side of a wall.',
      'More life around town: a bush warbler in the morning, crows at dusk, bicycle bells, a level crossing in the distance, the ramen cart\'s flute late at night, and the temple bell at dusk and dawn.',
    ],
  },
  {
    version: '0.7.3',
    date: '2026-10-30',
    title: 'A shorter list of departures',
    items: [
      'Marrakech is no longer on the world map. The coming-soon destinations are now Seoul, Bangkok, Istanbul, Naples, Lisbon and Mexico City.',
    ],
  },
  {
    version: '0.7.2',
    date: '2026-10-30',
    title: 'A cleaner see-through view',
    items: [
      'The see-through circle is gone. Now, when a building, a tree or the big gate stands between the camera and you, the whole thing lowers smoothly to a clean cut just above the floor, so you always see yourself and the room or street you are in.',
      'Only what actually blocks your view is lowered. Buildings beside you or farther away stay whole, and they rise back gently once you have walked past. No more flickering or half-cut blobs while you walk or turn the camera.',
      'Inside a shop it works like a dollhouse: the walls nearest the camera drop to waist height, the ceiling and the floors above lift away, and the back wall, the shelves and the furniture stay where they are.',
      'The hidden restaurant works the same way, from every camera angle.',
    ],
  },
  {
    version: '0.7.1',
    date: '2026-10-30',
    title: 'A street full of life',
    items: [
      'Everyone walks better, you included. Feet stay planted on the ground instead of skating, knees bend as each leg swings through, the hips sway over the standing foot, the shoulders twist against the stride and the arms swing with bent elbows. Walking speeds up smoothly into a run, with a real bounce and lean, and eases back down when you stop.',
      'Standing still is never stiff: people breathe, shift their weight from foot to foot and fidget, glancing around, stretching, scratching their heads, checking the time or shuffling their feet. Bows now bend from the waist, sitters bend their knees and waves come from the shoulder.',
      'The people of Tokyo now have a day of their own. They queue at the stalls, get served and walk off with a snack, eat it on the canal benches, pop into bakeries, cafés, bookshops and konbini, and fill the izakaya in the evening. Commuters hurry (and sometimes run) through the morning and evening rush, and the streets thin out late at night as people head home.',
      'Some people walk around in pairs, side by side. They sit together on the same bench, and one waits outside with a phone while the other shops. Friends who bump into each other stop for a chat, with gestures, nods and the odd laugh, and if you stand close you might overhear them.',
      'Passers-by step around each other and around you instead of walking through or freezing in place. They glance at you as you pass, sometimes say hello if you stop next to them (or ask where you got that snack), and jump out of the way if you sprint into them.',
      'The story characters, shopkeepers and regulars have their own habits too: a tourist taking photos, Tanaka-san glued to a phone, regulars nibbling at their food.',
      'Removed the big floating name pills over the food stalls. Walk up to a stall and its name still shows in the prompt.',
    ],
  },
  {
    version: '0.7.0',
    date: '2026-10-30',
    title: 'Travel together',
    items: [
      'A new home menu: choose a Solo trip or a Co-op trip.',
      'Both open a hand-built voxel map of the world, with clouds drifting over the oceans. Pick where to fly and watch your plane take off from your home city. Tokyo is open now; Seoul, Bangkok, Istanbul, Naples, Lisbon, Marrakech and Mexico City are coming soon.',
      'Co-op trips print you a plane ticket with a six-letter code. Send it to a friend (or share the link) and they check in under "Got a ticket?" to see where you are flying and who is on board.',
      'Explore Tokyo together: you see each other walk, run and eat in real time, with a name tag over your friend that points the way when they wander off screen. Wave hello with the hand button or G.',
      'Your friend\'s discoveries pop up as you play, and the sky follows the trip leader\'s clock so you share the same sunset.',
      'Pick your name and a colour for your cap on the boarding pass. Friends can join a trip any time, even after you land, and the map button can invite a friend mid-trip.',
    ],
  },
  {
    version: '0.6.2',
    date: '2026-10-30',
    title: 'Crisp signs',
    items: [
      'Fixed shop signs flickering with jagged dark triangles across their lettering, most visible up close in first-person view. Signs, lanterns and other street details now sit cleanly on the buildings behind them.',
    ],
  },
  {
    version: '0.6.1',
    date: '2026-10-30',
    title: 'Clear water',
    items: [
      'Took the foam off Sakura Canal. The water is clean and glassy again, and it still drifts downstream with ripples, soft lapping edges and the odd floating cherry petal.',
    ],
  },
  {
    version: '0.6.0',
    date: '2026-10-30',
    title: 'Step inside',
    items: [
      'Almost every shop on the street now has a real ground floor you can walk into: cafés, izakaya, a konbini, bakeries, bookshops, florists, a fishmonger, zakka shops and a drugstore, each furnished in its own style.',
      'When a building is cut away in front of you, you now see the rooms inside it instead of a solid block. Shuttered shops show their stock rooms and homes show their tatami front rooms.',
      'Shopkeepers stand behind their counters and regulars sit at tables and bars. Talk to them for stories, tips and the odd hint, and buy snacks and souvenirs over the counter.',
      'Two new sit-down restaurants: Kissa Komorebi, a retro coffee house by the canal, and Soba-dokoro Kikyō on Kaminari Lane, where the noodles are cut by hand in the window. Four new dishes to taste and cook: purin, spaghetti Napolitan, zaru soba and ebi tempura.',
      'Gachapon machines in the konbini and a zakka shop. Collect all twelve capsule charms, if you can find the rare golden shrimp.',
      'Eight tiny daruma dolls are hidden inside the shops, mostly in their back rooms. A new Finds section in your passport keeps count.',
      'One old bookshop on Kaminari Lane has a shelf with a red book that is not quite pushed in...',
      'New missions: Window Shopper, Table for One, Capsule Collector, Gachapon Master, Between the Pages and Daruma Hunt.',
    ],
  },
  {
    version: '0.5.0',
    date: '2026-10-30',
    title: 'See Tokyo through your own eyes',
    items: [
      'New first-person view! Tap the eye button or press V to walk the streets at eye level, and again to return to the overhead view. The game remembers which view you like.',
      'On a computer, click to look around with the mouse and walk with WASD (Shift to run). Q and E turn you in quick steps, and clicking on a stall or person in reach talks to them.',
      'On a phone, drag on the left side of the screen to walk and on the right side to look around. Tapping still walks you to a spot or a stall.',
      'Up close you get a real sky at the horizon, with a soft glow around the sun and moon, and the far end of the streets fades gently into the evening haze.',
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
