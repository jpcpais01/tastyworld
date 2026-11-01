import type { Look } from '../world/characters';
import type { RoomKind } from '../world/interiors';
import type { PlaceKind } from './places';

/**
 * Halcyon's walk-in rooms by kind: their names over the door, keepers and counters, in credits. They replace
 * the Tokyo set (data/places.ts) when the game is 2040, so no Halcyon shop is ever a Tokyo zakka.
 */

const L: Record<string, Partial<Look>> = {
  clerk: { topStyle: 'vest', top: 0x16161c, accent: 0x2ad8ff, hat: 'none' },
  cook: { topStyle: 'apron', top: 0x2a2a34, accent: 0xff5fb4, hat: 'headband', hatColor: 0xff5fb4 },
  barista: { topStyle: 'tee', top: 0x16161c, accent: 0x7dffa8, hat: 'beanie', hatColor: 0x16161c },
  medic: { topStyle: 'jacket', top: 0xf2efe7, accent: 0xd8282e, glasses: true, hat: 'none' },
  old: { topStyle: 'cardigan', top: 0x4a3a2a, accent: 0x6a3a7a, glasses: true, hat: 'none', hair: 0xb9b6b0 },
  fish: { topStyle: 'apron', top: 0x2a4a3a, accent: 0xffdc5a, hat: 'beanie', hatColor: 0xff9a4a },
  baker: { topStyle: 'apron', top: 0xf2efe7, accent: 0xff5fb4, hat: 'chef', hatColor: 0xf2efe7 },
};

export const NEO_PLACES: Partial<Record<RoomKind, PlaceKind>> = {
  shop: {
    label: 'Corner shop',
    names: [['Lucky Circuit', 'LUCKY CIRCUIT'], ['Kowa Sundries', 'KOWA'], ['Night Owl Goods', 'NIGHT OWL'], ['Bit & Bolt', 'BIT+BOLT'], ['Ten Thousand Things', '万物']],
    keepers: ['Rix', 'Mama Teo', 'Pike', 'Juno', 'Old Wen'],
    keeperLook: L.clerk,
    lines: [
      'Batteries, umbrellas, phone shells, lucky cats. If the rain can break it, I sell a new one.',
      'The umbrellas glow. Not for style. So the drones see you.',
      'People say there are seed capsules hidden round the city, from before the vats. Old wives\' tales. Probably.',
    ],
    buy: [
      { icon: 'can', name: 'Umbrella, glow rim', price: 18, text: 'A clear umbrella with a light-up rim. Drones swerve round you.' },
      { icon: 'signal', name: 'Data chip, 1 TB', price: 12, text: 'Blank. Or so the label says.' },
      { icon: 'cat', name: 'Solar lucky cat', price: 22, text: 'It waves faster when the sun is out. It has not waved in weeks.' },
    ],
  },
  cafe: {
    label: 'Café',
    names: [['Café Static', 'STATIC'], ['Drip Protocol', 'DRIP'], ['Bean Machine', 'BEAN MACHINE'], ['Overcast', 'OVERCAST']],
    keepers: ['Lux', 'Moss', 'Bebe', 'Orin'],
    keeperLook: L.barista,
    lines: ['Real beans, from the last farm in the hills. Synth beans are half price. I will not judge. Out loud.', 'Charging ports at every table. Stay as long as you like. Order something.', 'The rain sounds better in here. We tuned the windows.'],
    buy: [
      { icon: 'coffee', name: 'Real-bean coffee', price: 9, text: 'Grown in actual soil, somewhere. Tastes like it.', snack: true },
      { icon: 'latte', name: 'Oat cloud latte', price: 7, text: 'Foam so thick it holds a holo-heart.', snack: true },
      { icon: 'toast', name: 'Toast stack', price: 6, text: 'Thick white toast, butter and condensed milk.', snack: true },
    ],
  },
  izakaya: {
    label: 'Bar',
    names: [['The Rusty Lantern', 'RUSTY LANTERN'], ['Bar Ultraviolet', 'ULTRAVIOLET'], ['Last Train', 'LAST TRAIN'], ['Static & Sake', 'STATIC SAKE'], ['Neon Tiger', 'NEON TIGER']],
    keepers: ['Bartender Ivo', 'Saffi', 'Big Nok', 'Mira', 'Duke'],
    keeperLook: L.cook,
    lines: ['Skewers on the grill, synth sake on the shelf, and nobody asks where you work.', 'Karaoke starts at ten. The machine only knows songs from before 2030.', 'A Helix engineer drank here every night for a year. Then one night she did not come back. Left her badge in the toilet.'],
    buy: [
      { icon: 'beer', name: 'Rain lager', price: 8, text: 'Brewed with filtered rainwater. Officially.', snack: true },
      { icon: 'skewer', name: 'Grill skewers', price: 7, text: 'Three sticks of glazed vat chicken off the coals.', snack: true },
      { icon: 'sake', name: 'Synth sake', price: 11, text: 'Warm, smooth, and made in a lab on the Mile.', snack: true },
    ],
  },
  konbini: {
    label: 'Konbini',
    names: [['24/7 Kowa Mart', 'KOWA MART'], ['FamilyNet', 'FAMILYNET'], ['NiteLite', 'NITELITE']],
    keepers: ['Clerk-bot V3', 'Ama', 'Tomas'],
    keeperLook: L.clerk,
    lines: ['Welcome. Hot food in the warmer, ration bars on aisle two, umbrellas by the door.', 'The onigiri are printed fresh every hour. The hour is negotiable.'],
    buy: [
      { icon: 'onigiri', name: 'Printed onigiri', price: 4, text: 'Perfectly triangular. Suspiciously so.', snack: true },
      { icon: 'nikuman', name: 'Warmer bun', price: 5, text: 'From the steam cabinet by the till.', snack: true },
      { icon: 'can', name: 'Volt soda', price: 3, text: 'Caffeine, sugar and a faint blue glow.', snack: true },
    ],
  },
  books: {
    label: 'Media shop',
    names: [['Paper Ghosts', 'PAPER GHOSTS'], ['Analog', 'ANALOG'], ['The Archive', 'ARCHIVE']],
    keepers: ['Archivist Pell', 'Nadia', 'Old Wen'],
    keeperLook: L.old,
    lines: ['Real paper books. People come in just to smell them.', 'Old maps of Halcyon from before the seawall. Half the streets are under the bay now.', 'Somebody pressed a leaf in one of these. A real leaf. I keep it under glass.'],
    buy: [
      { icon: 'scroll', name: 'Pre-flood city map', price: 25, text: 'Halcyon in 2020: green parks where the docks are now.' },
      { icon: 'bookmark', name: 'Paper novel', price: 14, text: 'A detective story set in a city that never stops raining. Relatable.' },
    ],
  },
  fish: {
    label: 'Fishmonger',
    names: [['Bay Catch', 'BAY CATCH'], ['Krill & Co.', 'KRILL+CO'], ['Tank Seven', 'TANK 7']],
    keepers: ['Mama Ruo', 'Ferro', 'Dita'],
    keeperLook: L.fish,
    lines: ['Tank-raised eel, bay krill, kelp by the metre. The sea gives less every year, so the tanks give more.', 'Real wild fish? Once a month, by auction, at four in the morning. Bring a lot of credits.'],
    buy: [{ icon: 'fish', name: 'Grilled tank eel', price: 9, text: 'Glazed and charred, on a stick.', snack: true }],
  },
  bakery: {
    label: 'Bakery',
    names: [['Rise', 'RISE'], ['Golden Crumb', 'GOLDEN CRUMB'], ['Ovenlight', 'OVENLIGHT']],
    keepers: ['Baker Anouk', 'Hiro', 'Mrs. Pak'],
    keeperLook: L.baker,
    lines: ['Flour from the vertical farms, butter from the vats, ovens from 1998. They are the best part.', 'Melon buns at seven, glow croissants at nine. Come early.'],
    buy: [
      { icon: 'croissant', name: 'Glow croissant', price: 5, text: 'Laminated, flaky, and faintly blue inside.', snack: true },
      { icon: 'melonpan', name: 'Melon bun', price: 4, text: 'Crackly sugar top. Some things never change.', snack: true },
    ],
  },
  pharmacy: {
    label: 'Street clinic',
    names: [['Halcyon Street Clinic', 'CLINIC'], ['Red Cross Booth 9', 'MEDIC 9'], ['Dr. Abara\'s Clinic', 'DR ABARA']],
    keepers: ['Dr. Abara', 'Nurse Kim', 'Medic Tove'],
    keeperLook: L.medic,
    lines: ['Patch-ups, vitamins, and no questions. Well, a few questions.', 'You look pale. When did you last eat something that was not from a vending machine?', 'Sleep is medicine. So is soup. I prescribe both.'],
    buy: [],
  },
  kissa: {
    label: 'Retro café',
    names: [['Kissa 1999', 'KISSA 1999'], ['Velvet Hour', 'VELVET HOUR'], ['Café Memoria', 'MEMORIA']],
    keepers: ['Master Kuro', 'Delphine', 'Mr. Faber'],
    keeperLook: L.old,
    lines: ['Siphon coffee and vinyl records. The future can wait at the door.', 'This booth has not moved since 1999. Neither has that regular.'],
    buy: [{ icon: 'coffee', name: 'Siphon coffee', price: 10, text: 'Brewed slowly over a little flame.', snack: true }],
  },
  soba: {
    label: 'Noodle bar',
    names: [['Noodle Nexus', 'NEXUS'], ['Slurp Station', 'SLURP'], ['Ramen 2040', 'RAMEN 2040']],
    keepers: ['Chef Ito', 'Big Lu', 'Mama Bao'],
    keeperLook: L.cook,
    lines: ['Kelp noodles, pulled by hand. The hand is a robot arm, but still.', 'Broth on since six this morning. It will be on until six tomorrow.'],
    buy: [{ icon: 'ramen', name: 'Noodle cup', price: 6, text: 'A paper cup of noodles to walk with.', snack: true }],
  },
  florist: {
    label: 'Plant shop',
    names: [['Green Room', 'GREEN ROOM'], ['Last Leaf', 'LAST LEAF']],
    keepers: ['Fern', 'Mr. Okada'],
    keeperLook: L.old,
    lines: ['Real plants, real soil. Most people just come in to breathe.', 'A basil plant costs more than a dinner on the Mile. Worth it.'],
    buy: [{ icon: 'flower', name: 'Potted basil', price: 30, text: 'Alive. Smells like a summer you never saw.' }],
  },
};
