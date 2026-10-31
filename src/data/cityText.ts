import { perCity } from '../world/cityId';

/** The words that change from city to city: names, the diary, the hidden restaurant's riddle and the till. */
export interface CityText {
  name: string;
  local: string;
  /** The neighbourhood on the pocket map. */
  district: [string, string];
  sticker: string;
  loading: [string, string, string];
  intro: string[];
  vendorCalls: string[];
  /** The three hidden charms that open the secret restaurant. */
  charm: { icon: string; one: string; found: string; seen: string; hint: string; first: string; next: string; all: string; allText: string; bubble: string };
  door: { closed: [string, string]; open: [string, string]; hint: string };
  hidden: { name: string; local: string; found: string; chef: [string, string]; exit: string; friend: string; friendHint: string };
  /** The passport's city page: the city, one thing about its streets, etiquette and a few words. */
  passport: { fact: string; streets: [string, string]; tips: string[]; words: [string, string][] };
  /** The country on the passport, in its own language, and its flag's style in the stamp book. */
  country: string;
  flag: '' | 'it' | 'tr';
  /** Under the district's name on the pocket map. */
  region: string;
  /** The ink of a passport stamp: the city across it and a mark for the dish. */
  stamp: { city: string; mark: (dish: { name: string; jp: string }) => string };
  /** What hangs over a stall's sheet: Tokyo's noren curtain, or a striped awning in its colour. */
  sign: { kind: 'noren' } | { kind: 'awning'; color: string };
  /** The city hides daruma in its shops and sells gachapon capsules (the Bag's Finds). */
  finds: boolean;
  /** Said when a dish is finished, at the foot of its card. */
  thanks: string;
  /** Local words under the settings and patch-notes titles. */
  panels: { settings: string; notes: string };
  /** What the hidden restaurant is, beside its street. */
  hiddenKind: string;
  /** Over the counter as a dish is handed across, and the traveller's own words as they eat and drink. */
  meal: { serve: string[]; start: string; startDrink: string; yum: string[]; yumDrink: string };
  /** The line on waking from a daytime nap. */
  nap: string;
  /** The kettle in a hotel room: its name, the prompt, and the toast once it is made. */
  tea: { name: string; act: string; title: string; text: string };
  /** One euro is 100 of the wallet's units; Tokyo shows them as yen. */
  money: (n: number) => string;
  currency: string;
  /** The wallet a new traveller starts with, as the HUD shows it before the save loads. */
  startPurse: string;
}

/** The first letter of a dish's name, for stamps in cities that write in Latin letters. */
const initial = (d: { name: string }) => d.name.charAt(0).toUpperCase();

const TOKYO: CityText = {
  name: 'Tokyo', local: '東京', district: ['Hikari-machi', '光町'], sticker: '東京 · 屋台',
  loading: ['Hanging the lanterns…', 'Raising the rooftops…', 'Itadakimasu!'],
  intro: [
    'Day one in Tokyo! The air smells of grilled soy and sweet batter.',
    'Visit the food stalls to taste local dishes and collect stamps in my Food Passport.',
    'Vendors will even let me help cook. Locals love to share stories, too.',
    'And Grandma Fumiko by the temple said something about lucky cats…',
    'But first things first: I need a bed for tonight. There are seven hotels in town, and the sun sets at seven. Check in before dark!',
  ],
  vendorCalls: ['Irasshaimase!', 'Fresh and hot!', 'Oishii yo!', 'Come, come!', 'Hai, dōzo!', 'Just made!'],
  charm: {
    icon: 'cat', one: 'Maneki-neko', found: 'It waves at you, as always', seen: 'A glinting lucky cat', hint: 'Take a closer look',
    first: 'A tiny maneki-neko, beckoning with its paw. There must be others.', next: 'Another one! Its paw points toward Lantern Alley.',
    all: 'All three lucky cats found!', allText: 'Their paws all point to a nameless passage off Lantern Alley…', bubble: 'Its paw beckons good fortune.',
  },
  door: { closed: ['A plain wooden wall', 'Look closer'], open: ['A door with no sign', 'Step inside'], hint: 'The wood is warm and smells of hinoki… Maybe the lucky cats know something.' },
  hidden: {
    name: 'Kakurega · Hidden Counter', local: '隠れ家', found: 'You found the hidden counter. Eight seats, no sign, no menu.',
    chef: ['Kakurega counter', 'Sit with Chef Sato'], exit: 'Back to Lantern Alley',
    friend: 'You know the one. Eight seats, no sign.', friendHint: 'Somewhere off Lantern Alley… the lucky cats know the way.',
  },
  passport: {
    fact: 'Once the fishing village of Edo, Tokyo became the shogun\'s capital in 1603 and grew into the largest city on Earth. Its food culture was born on the street: sushi, tempura and soba all started as quick snacks sold from stalls to busy workers.',
    streets: ['Yatai & yokochō', 'Yatai are portable food carts that appear at dusk. Yokochō are narrow alleys packed with tiny counters, many dating from the post-war markets of the 1940s.'],
    tips: ['Say “itadakimasu” before eating and “gochisōsama” after.', 'Eat near the stall instead of walking with your food.', 'Slurping noodles is a compliment to the cook.', 'No tipping in real Tokyo! Here, vendors reward your help in the kitchen.'],
    words: [['Irasshaimase', 'Welcome!'], ['Oishii', 'Delicious'], ['Omakase', '“I leave it to you”, the chef\'s choice'], ['Kanpai', 'Cheers']],
  },
  country: '日本', flag: '', region: 'Tokyo · 東京',
  stamp: { city: 'TOKYO', mark: (d) => d.jp.slice(0, 2) },
  sign: { kind: 'noren' },
  finds: true,
  thanks: 'ごちそうさまでした',
  panels: { settings: '設定', notes: 'お知らせ' },
  hiddenKind: 'Omakase counter',
  meal: { serve: ['Hai, dōzo!', 'Here you go!', 'Hai, omachi dō sama!', 'Enjoy it while it\'s hot!'], start: 'Itadakimasu!', startDrink: 'Kanpai!', yum: ['Oishii~!', 'Umai!', 'Mmm, oishii!'], yumDrink: 'Ahh~ ♪' },
  nap: 'Two hours later, fresh as a daikon.',
  tea: { name: 'Kettle', act: 'Make a cup of green tea', title: 'Green tea', text: 'The kettle clicks off. A tea bag from the tray, hot water and a moment to yourself.' },
  money: (n) => `¥${n.toLocaleString('en-US')}`,
  currency: '¥',
  startPurse: '3,000',
};

const AMALFI_TEXT: CityText = {
  name: 'Amalfi', local: 'Amalfi', district: ['Amalfi', 'Costiera Amalfitana'], sticker: 'Amalfi · Costiera',
  loading: ['Hanging the laundry…', 'Painting the shutters…', 'Buon appetito!'],
  intro: [
    'Day one in Amalfi! The town tumbles down the cliffs to the sea, and everything smells of lemons.',
    'The stalls round the piazza and down by the harbour each have their own speciality. Every dish is a stamp in my passport.',
    'The streets here are stairs. Lanes, ramps and tunnels climb all the way up to the lemon terraces. My legs will hate me.',
    'Nonna Assunta by the fountain said something about three lemons made of majolica…',
  ],
  vendorCalls: ['Venite, venite!', 'Caldo caldo!', 'Assaggiate!', 'Prego, prego!', 'Freschissimo!', 'Appena sfornato!'],
  charm: {
    icon: 'sparkle', one: 'Majolica lemon', found: 'Its glaze glows in the sun', seen: 'Something yellow glints', hint: 'Take a closer look',
    first: 'A little lemon of painted majolica, warm from the sun. Nonna said there were three.', next: 'Another one! Its leaf points up the stairs behind the Duomo.',
    all: 'All three majolica lemons found!', allText: 'Their leaves all point up the stairs behind the cathedral, to a door in the rock…', bubble: 'Blue leaves, yellow glaze, a potter\'s initials.',
  },
  door: { closed: ['An old door in the rock', 'Look closer'], open: ['A door in the rock', 'Step inside'], hint: 'Cool air and the smell of garlic seep from under the door… Maybe the lemons know something.' },
  hidden: {
    name: 'La Grotta · Hidden Kitchen', local: 'cucina nascosta', found: 'You found the kitchen in the rock. One table, one cook, whatever the boats brought in.',
    chef: ['La Grotta', 'Sit with Zia Carmela'], exit: 'Back to the stairs',
    friend: 'You know the one. A door in the rock, one table.', friendHint: 'Up the stairs behind the Duomo… the majolica lemons know the way.',
  },
  passport: {
    fact: 'Once the capital of a sea republic that traded with Constantinople and Cairo, Amalfi gave the Mediterranean its first maritime code. Today its fortune is lemons: the thick-skinned sfusato grown on terraces stacked up the cliffs, and the sweets and liqueur made from them.',
    streets: ['Scale e limoni', 'The town has more stairs than streets. Lanes climb from the piazza through tunnels and under houses to the terraces, where lemons grow under chestnut pergolas and are still carried down by hand.'],
    tips: ['Coffee is drunk standing at the bar, and cappuccino only before noon.', 'Pizza a portafoglio is folded in four and eaten walking.', 'Limoncello comes ice cold, after the meal, never before.', 'Say “permesso” when you squeeze past someone on the stairs.'],
    words: [['Buongiorno', 'Good morning'], ['Buonissimo', 'Delicious'], ['Un cuoppo', 'A paper cone of fried things'], ['Salute', 'Cheers']],
  },
  country: 'Italia', flag: 'it', region: 'Costiera Amalfitana · Italy',
  stamp: { city: 'AMALFI', mark: initial },
  sign: { kind: 'awning', color: '#e2b42c' },
  finds: false,
  thanks: 'Grazie, era buonissimo!',
  panels: { settings: 'Impostazioni', notes: 'Novità' },
  hiddenKind: 'Hidden kitchen',
  meal: { serve: ['Ecco qua!', 'Here you go!', 'Prego!', 'Buon appetito!'], start: 'Buon appetito!', startDrink: 'Salute!', yum: ['Buonissimo!', 'Che bontà!', 'Mmm, delizioso!'], yumDrink: 'Ahh, che fresco!' },
  nap: 'Two hours later, rested like a cat on a warm step.',
  tea: { name: 'Moka pot', act: 'Make a little coffee', title: 'Caffè', text: 'The moka gurgles on the ring. A thimble of strong coffee, a twist of lemon peel and a moment to yourself.' },
  money: (n) => `€${(n / 100).toFixed(2)}`,
  currency: '€',
  startPurse: '30.00',
};

const ISTANBUL_TEXT: CityText = {
  name: 'Istanbul', local: 'İstanbul', district: ['Eminönü', 'Tarihi Yarımada'], sticker: 'İstanbul · Eminönü',
  loading: ['Brewing the tea…', 'Raising the minarets…', 'Afiyet olsun!'],
  intro: [
    'Day one in Istanbul! Gulls, ferry horns, grilled fish and the smell of cinnamon from the Spice Bazaar.',
    'Street carts and boats all along the quay, and two sit-down places up the hill. Every dish is a stamp in my passport.',
    'The streets climb from the water past the bazaars to the great mosque on the hill. Gentle, but my legs will notice.',
    'Ayşe Teyze by the New Mosque said something about three little blue eyes, tied where nobody looks…',
    'But first a bed. There are twelve hotels down by the water and along the tram, and the sun sets at seven. Check in before dark!',
  ],
  vendorCalls: ['Buyrun!', 'Sıcak sıcak!', 'Taze taze!', 'Gel gel!', 'Afiyet olsun!', 'Yeni çıktı!'],
  charm: {
    icon: 'sparkle', one: 'Nazar bead', found: 'Its blue eye watches over you', seen: 'Something blue glints', hint: 'Take a closer look',
    first: 'A little nazar, a blue glass eye against bad luck, tied where nobody looks. Ayşe Teyze said there were three.', next: 'Another one! Its eye seems to look up the hill, toward the lanes behind the bazaar.',
    all: 'All three nazar beads found!', allText: 'All three eyes look the same way: up the lanes north of the Grand Bazaar, to a door with no sign…', bubble: 'Blue glass, a white ring, a dark pupil. It is watching.',
  },
  door: { closed: ['A plain wooden door', 'Look closer'], open: ['A door with no sign', 'Step inside'], hint: 'The smell of charred aubergine and butter seeps from under the door… Maybe the nazar beads know something.' },
  hidden: {
    name: 'Gizli Mutfak · Hidden Kitchen', local: 'gizli mutfak', found: 'You found the hidden kitchen. Four tables, no sign, and a grandmother who cooks for whoever finds the door.',
    chef: ['Gizli Mutfak', 'Sit with Hatice Hanım'], exit: 'Back to the lanes',
    friend: 'You know the one. A door with no sign, four tables.', friendHint: 'Up the lanes behind the Grand Bazaar… the nazar beads know the way.',
  },
  passport: {
    fact: 'Byzantium, Constantinople, Istanbul: the capital of two empires for sixteen centuries, the only great city on two continents. Its cooking gathers the whole Ottoman world, from Balkan pastries and Arab sweets to Anatolian kebabs, Persian rice and the fish of the Bosphorus.',
    streets: ['Çarşı & iskele', 'Eminönü is where the city has always shopped and sailed: the vaulted Spice Bazaar, the Grand Bazaar\'s sixty streets up the hill, and the ferry piers where boats cross between Europe and Asia all day long.'],
    tips: ['Tea is offered everywhere, even in shops. Saying yes is polite, and it is free.', 'Bread is sacred: never throw it on the ground. People hang leftover bread on walls for the birds.', 'Take your shoes off before entering a mosque, and dress modestly.', 'Bargaining is expected in the bazaars, but always with a smile and over tea.'],
    words: [['Merhaba', 'Hello'], ['Afiyet olsun', 'Enjoy your meal'], ['Çok güzel', 'Very beautiful, very good'], ['Teşekkürler', 'Thank you']],
  },
  country: 'Türkiye', flag: 'tr', region: 'Eminönü · İstanbul',
  stamp: { city: 'ISTANBUL', mark: initial },
  sign: { kind: 'awning', color: '#c8432f' },
  finds: false,
  thanks: 'Elinize sağlık!',
  panels: { settings: 'Ayarlar', notes: 'Yenilikler' },
  hiddenKind: 'Hidden kitchen',
  meal: { serve: ['Buyrun!', 'Here you go!', 'Afiyet olsun!', 'Sıcak sıcak, buyrun!'], start: 'Afiyet olsun!', startDrink: 'Şerefe!', yum: ['Çok güzel!', 'Nefis!', 'Mmm, harika!'], yumDrink: 'Ohh, oh!' },
  nap: 'Two hours later, rested like a ferry cat in the sun.',
  tea: { name: 'Çaydanlık', act: 'Brew a glass of çay', title: 'Çay', text: 'The double kettle hisses. Strong tea from the top pot, hot water from the bottom, a tulip glass and two sugar cubes.' },
  // one euro is about forty-five lira
  money: (n) => `₺${Math.max(1, Math.round(n * 0.45)).toLocaleString('en-US')}`,
  currency: '₺',
  startPurse: '1,350',
};

export const TEXT: CityText = perCity({ tokyo: TOKYO, amalfi: AMALFI_TEXT, istanbul: ISTANBUL_TEXT });

/** A place's local name, or nothing when it only repeats the English one (Piazza dei Dogi needs no “i Dogi”). */
export function localName(name: string, local: string): string {
  const words = (s: string) => s.replace(/ı/g, 'i').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  const own = new Set(words(name));
  const loc = words(local);
  return loc.length && loc.every((w) => own.has(w)) ? '' : local;
}
