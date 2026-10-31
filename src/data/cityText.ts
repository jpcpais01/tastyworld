import { AMALFI, ISTANBUL } from '../world/cityId';

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
  charm: { one: string; found: string; seen: string; hint: string; first: string; next: string; all: string; allText: string; bubble: string };
  door: { closed: [string, string]; open: [string, string]; hint: string };
  hidden: { name: string; local: string; found: string; chef: [string, string]; exit: string; friend: string; friendHint: string };
  passport: { fact: string; tips: string[] };
  /** One euro is 100 of the wallet's units; Tokyo shows them as yen. */
  money: (n: number) => string;
  currency: string;
}

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
    one: 'Maneki-neko', found: 'It waves at you, as always', seen: 'A glinting lucky cat', hint: 'Take a closer look',
    first: 'A tiny maneki-neko, beckoning with its paw. There must be others.', next: 'Another one! Its paw points toward Lantern Alley.',
    all: 'All three lucky cats found!', allText: 'Their paws all point to a nameless passage off Lantern Alley…', bubble: 'Its paw beckons good fortune.',
  },
  door: { closed: ['A plain wooden wall', 'Look closer'], open: ['A door with no sign', 'Step inside'], hint: 'The wood is warm and smells of hinoki… Maybe the lucky cats know something.' },
  hidden: {
    name: 'Kakurega · Hidden Counter', local: '隠れ家', found: 'You found the hidden counter. Eight seats, no sign, no menu.',
    chef: ['Kakurega counter', 'Sit with Chef Sato'], exit: 'Back to Lantern Alley',
    friend: 'You know the one. Eight seats, no sign.', friendHint: 'Somewhere off Lantern Alley… the lucky cats know the way.',
  },
  passport: { fact: '', tips: [] },
  money: (n) => `¥${n.toLocaleString('en-US')}`,
  currency: '¥',
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
    one: 'Majolica lemon', found: 'Its glaze glows in the sun', seen: 'Something yellow glints', hint: 'Take a closer look',
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
    tips: ['Coffee is drunk standing at the bar, and cappuccino only before noon.', 'Pizza a portafoglio is folded in four and eaten walking.', 'Limoncello comes ice cold, after the meal, never before.', 'Say “permesso” when you squeeze past someone on the stairs.'],
  },
  money: (n) => `€${(n / 100).toFixed(2)}`,
  currency: '€',
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
    one: 'Nazar bead', found: 'Its blue eye watches over you', seen: 'Something blue glints', hint: 'Take a closer look',
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
    tips: ['Tea is offered everywhere, even in shops. Saying yes is polite, and it is free.', 'Bread is sacred: never throw it on the ground. People hang leftover bread on walls for the birds.', 'Take your shoes off before entering a mosque, and dress modestly.', 'Bargaining is expected in the bazaars, but always with a smile and over tea.'],
  },
  // one euro is about forty-five lira
  money: (n) => `₺${Math.max(1, Math.round(n * 0.45)).toLocaleString('en-US')}`,
  currency: '₺',
};

export const TEXT: CityText = ISTANBUL ? ISTANBUL_TEXT : AMALFI ? AMALFI_TEXT : TOKYO;
