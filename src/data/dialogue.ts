import type { Look } from '../world/characters';
import { AMALFI } from '../world/cityId';

export interface Idler { id: string; name: string; look: Look; lines: string[]; }

const TOKYO_IDLERS: Record<string, Idler> = {
  obaachan: {
    id: 'obaachan', name: 'Grandma Fumiko',
    look: { skin: 0xeec39f, hair: 0xb9b6b0, hairStyle: 'bun', top: 0xe8e4da, topStyle: 'cardigan', accent: 0x8a6fb0, bottom: 0x5a4a3a, shoes: 0x6b4630 },
    lines: [
      'Ara, a traveller! Ring the bell at the temple and toss a coin, it brings good luck for the road.',
      'In my day the lucky cats of this district guarded a secret counter. Find all three and they will show you the way.',
      'One cat sits by the little shrine near the pagoda. The others... they like quiet corners. Crates, cherry trees.',
    ],
  },
  salaryman: {
    id: 'salaryman', name: 'Tanaka-san',
    look: { skin: 0xe0ac86, hair: 0x1d1a1c, hairStyle: 'short', top: 0x2b3346, topStyle: 'suit', accent: 0x2b3346, bottom: 0x2b3346, shoes: 0x2a2a2e, glasses: true },
    lines: [
      'Long day. Ramen Hoshi down the alley fixes everything. Clear shōyu, like it was in 1910.',
      'These alleys are called yokochō. After the war, people built tiny counters here. Some still seat only six.',
      'If you see a passage with no name, don\'t ignore it. The best places in Tokyo have no sign at all.',
    ],
  },
  student: {
    id: 'student', name: 'Yui',
    look: { skin: 0xf6d2b4, hair: 0x2a1d17, hairStyle: 'long', top: 0xf8f6f0, topStyle: 'sailor', accent: 0x23345e, bottom: 0x23345e, skirt: true, shoes: 0x6b4630 },
    lines: [
      'The yatai by the water makes the best takoyaki. Try helping Hachi-chan flip them!',
      'Did you know monjayaki is Tokyo\'s own? Osaka has okonomiyaki, but we have monja!',
      'When the sakura bloom, everyone picnics under the trees. Hana yori dango, dumplings before flowers!',
    ],
  },
  fisherman: {
    id: 'fisherman', name: 'Old Man Ishida',
    look: { skin: 0xc98f6a, hair: 0x6b6b70, hairStyle: 'short', top: 0x5d8ec8, topStyle: 'vest', accent: 0x4a5a3a, bottom: 0x4a5a3a, shoes: 0x2a2a2e, hat: 'bucket', hatColor: 0x8a9a6a },
    lines: [
      'Edo was built on canals like this one. Fish came in by boat every morning.',
      'Sushi started as fast food at stalls by the bay. Cured fish, vinegared rice. Edomae, they call it.',
      'See the koi? They know when the yatai drops crumbs. Smart fish.',
    ],
  },
  tourist: {
    id: 'tourist', name: 'Marco from Naples',
    look: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'spiky', top: 0xf2c74a, topStyle: 'tee', accent: 0xd9534a, bottom: 0x7a8a9a, shoes: 0xf2efe7, hat: 'cap', hatColor: 0xd9534a, backpack: 0x3f6e9a },
    lines: [
      'Ciao! Back home I make pizza, but these little octopus balls? Magnifico.',
      'The giant red lantern on the gate weighs about 700 kilos. I checked twice.',
      'One day you should visit Naples. I will teach you real pizza, promise.',
    ],
  },
  florist: {
    id: 'florist', name: 'Aiko the florist',
    look: { skin: 0xf9dcc4, hair: 0x5a3b26, hairStyle: 'bob', top: 0xf4f1ea, topStyle: 'apron', accent: 0x4f9a6b, bottom: 0x3a3a40, shoes: 0x2a2a2e },
    lines: [
      'Taiyaki at Sakura-ya is shaped like a sea bream because "tai" sounds like "medetai", happy and lucky.',
      'The ningyō-yaki shop pours its batter into iron moulds of the pagoda and the lantern. So cute!',
      'At night this street turns orange and red. Come back after sunset, you will see.',
    ],
  },
};

const AMALFI_IDLERS: Record<string, Idler> = {
  nonna: {
    id: 'nonna', name: 'Nonna Assunta',
    look: { skin: 0xe8b894, hair: 0xd2cec6, hairStyle: 'bun', top: 0x2f2f35, topStyle: 'cardigan', accent: 0x6a4a8a, bottom: 0x2f2f35, skirt: true, shoes: 0x2a2a2e },
    lines: [
      'Benvenuto, figlio mio! Sit, sit. Have you eaten? You look thin.',
      'My grandmother said the old potters hid three lemons of majolica around town. Find them and the grotta will open for you.',
      'One lemon looks down on the sea from the Duomo steps. Another hides near the boats. The third waits by the lemon seller in Piazza dei Dogi, up Via Lorenzo.',
    ],
  },
  pescatore: {
    id: 'pescatore', name: 'Tonino the fisherman',
    look: { skin: 0xb07a52, hair: 0x6b6b70, hairStyle: 'short', top: 0x3f6e9a, topStyle: 'vest', accent: 0xf4f1ea, bottom: 0x4a4a52, shorts: true, shoes: 0x6b4630, hat: 'beanie', hatColor: 0x2b3a62 },
    lines: [
      'These gozzi are painted the same way for three hundred years. Blue for the sea, white for luck.',
      'The totani come in at night. You fish them with a lamp, like stealing the moon.',
      'Amalfi was a sea republic once, richer than Venice. Now we sell anchovies to tourists, and I am happy.',
    ],
  },
  limonaio: {
    id: 'limonaio', name: 'Gennaro the lemon grower',
    look: { skin: 0xc98f6a, hair: 0x3b2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x6a8a3a, bottom: 0x5a4a3a, shoes: 0x6b4630, hat: 'straw', hatColor: 0xe0c58a },
    lines: [
      'Sfusato amalfitano. Thick skin, sweet pith, you can eat it like an apple. Go on, try.',
      'Every lemon on this hill came down on a man\'s back. Forty kilos a basket, a thousand steps.',
      'The chestnut poles of the pergolas? My grandfather cut them. The trees outlive us all.',
    ],
  },
  painter: {
    id: 'painter', name: 'Lucia the painter',
    look: { skin: 0xf6d2b4, hair: 0x8a5a36, hairStyle: 'ponytail', top: 0xf2c74a, topStyle: 'apron', accent: 0x3f6e9a, bottom: 0x2b3a62, shoes: 0xf2efe7 },
    lines: [
      'From these steps the whole town falls into the sea. I paint it every morning and it never sits still.',
      'The cathedral front is striped like a cassata. Arab, Byzantine, Norman, all in one face.',
      'Climb past the cloister at sunset. The houses go pink, then gold, then blue.',
    ],
  },
  lifeguard: {
    id: 'lifeguard', name: 'Ciro the lifeguard',
    look: { skin: 0xa8714f, hair: 0x1d1a1c, hairStyle: 'spiky', top: 0xd9534a, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0xd9534a, shorts: true, shoes: 0xf2efe7, hat: 'cap', hatColor: 0xf4f1ea, glasses: true },
    lines: [
      'Cuoppo first, then the swim. Not the other way round, trust me.',
      'The beach is pebbles, not sand. Wear shoes or dance like a crab.',
      'Ferries to Positano leave from the long pier. The view from the water is the real Amalfi.',
    ],
  },
  priest: {
    id: 'priest', name: 'Don Matteo',
    look: { skin: 0xeec39f, hair: 0x6b6b70, hairStyle: 'short', top: 0x1d1a1c, topStyle: 'suit', accent: 0xf4f1ea, bottom: 0x1d1a1c, shoes: 0x2a2a2e, glasses: true },
    lines: [
      'Sixty-two steps to Sant\'Andrea. The faithful count them, the tourists complain about them.',
      'The bronze doors came from Constantinople in 1060. Older than most countries.',
      'Pansa has made sfogliatelle since 1830. Even a priest is allowed one sin before mass.',
    ],
  },
};

export const IDLERS: Record<string, Idler> = AMALFI ? AMALFI_IDLERS : TOKYO_IDLERS;

export const CAT_LINES = AMALFI ? ['Miao.', 'The cat squints at the sea, unimpressed.', 'Purrrr...', 'The cat rolls over on the warm stone.'] : ['Nyaa~', 'The cat blinks at you slowly. That means trust.', 'Purrrr...', 'The cat stretches, then ignores you magnificently.'];

/** Snippets overheard from passers-by. */
const TOKYO_CHAT = [
  'Have you tried the takoyaki by the canal?',
  'Same time next week?',
  'No way! Really?',
  'My treat this time.',
  'The queue at Hoshi was so long today.',
  'Look, the lanterns are coming on.',
  'I could eat another one, honestly.',
  'Ahaha, stop it!',
  'Is that new? It suits you.',
  'Let\'s grab a coffee at Komorebi.',
  'Mmm, smells like grilled tare.',
  'My grandmother used to live on this street.',
];
const TOKYO_GREET: Record<'morning' | 'day' | 'evening', string[]> = {
  morning: ['Ohayō!', 'Good morning!', 'Early start?'],
  day: ['Konnichiwa!', 'Hello there!', 'Enjoying Tokyo?'],
  evening: ['Konbanwa!', 'Good evening!', 'Lovely night for a stroll.'],
};
const TOKYO_STARTLE = ['Whoa!', 'Abunai!', 'Careful!', 'Sumimasen!', 'Eek!'];
const TOKYO_ENVY = ['That looks delicious!', 'Ooh, where did you get that?', 'Now I\'m hungry...'];

const AMALFI_CHAT = [
  'Andiamo al mare dopo?',
  'Pansa or nothing, I told you.',
  'Madonna, these stairs!',
  'Another limoncello? Just a small one.',
  'Look at the light on the water.',
  'My cousin has a boat, we can go to Positano.',
  'Ma dai! Seriously?',
  'The gelato by the gate, the lemon one, go.',
  'Mamma is waiting with the pasta.',
  'Ciao bella, see you at the piazza.',
  'Smells like fried anchovies down there.',
  'Sunday we climb to the lemon terraces.',
];
const AMALFI_GREET: Record<'morning' | 'day' | 'evening', string[]> = {
  morning: ['Buongiorno!', 'Good morning!', 'Caffè already?'],
  day: ['Ciao!', 'Salve!', 'Enjoying Amalfi?'],
  evening: ['Buonasera!', 'Good evening!', 'Bella serata, eh?'],
};
const AMALFI_STARTLE = ['Mamma mia!', 'Attenzione!', 'Piano, piano!', 'Scusi!', 'Uè!'];
const AMALFI_ENVY = ['Che buono!', 'Where did you find that?', 'Now I want one too...'];

export const CROWD_CHAT = AMALFI ? AMALFI_CHAT : TOKYO_CHAT;
export const CROWD_GREET = AMALFI ? AMALFI_GREET : TOKYO_GREET;
export const CROWD_STARTLE = AMALFI ? AMALFI_STARTLE : TOKYO_STARTLE;
export const CROWD_ENVY = AMALFI ? AMALFI_ENVY : TOKYO_ENVY;
