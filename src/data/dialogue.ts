import type { Look } from '../world/characters';

export interface Idler { id: string; name: string; look: Look; lines: string[]; }

export const IDLERS: Record<string, Idler> = {
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

export const CAT_LINES = ['Nyaa~', 'The cat blinks at you slowly. That means trust.', 'Purrrr...', 'The cat stretches, then ignores you magnificently.'];
