import type { Look } from '../world/characters';
import type { IconName } from '../ui/emblems';
import { AMALFI, ISTANBUL } from '../world/cityId';

/**
 * The seven places to stay. Each one is a real building in the city (picked by the corner of its lot), with a
 * lobby on the ground floor and one to three rooms upstairs, one room per floor. A hotel with two or more rooms
 * keeps a king room on its top guest floor. Rooms sit on floors 1 to 4 above the lobby: the cutaway's solid bits
 * reach 16 m, and that is high enough to see over most of the town.
 */

export type RoomType = 'single' | 'twin' | 'double' | 'king' | 'tatami';
/** Furnishing and colours of the rooms and the lobby. */
export type HotelTheme = 'inn' | 'ryokan' | 'business' | 'boutique' | 'guesthouse' | 'park' | 'sky' | 'pensione' | 'locanda' | 'palazzo' | 'marina';

export interface HotelRoomSpec {
  /** Floor above the lobby (1..4). In Japan the lobby is the first floor, so floor 1 holds room 201. */
  floor: number;
  type: RoomType;
  price: number;
}

export interface HotelInfo {
  id: string;
  name: string;
  jp: string;
  /** The street it stands on, as the map and the HUD say it. */
  street: string;
  blurb: string;
  theme: HotelTheme;
  /** Lot corner (builder voxels) of the building that becomes the hotel. */
  lot: [number, number];
  style: 'modern' | 'showa' | 'machiya' | 'apartment';
  floors: number;
  rooms: HotelRoomSpec[];
  keeper: string;
  keeperLook: Partial<Look>;
  lines: string[];
  /** Guests go up by the stairs rather than a lift. */
  stairs?: boolean;
}

const DESK: Partial<Look> = { topStyle: 'suit', top: 0x2b3a62, accent: 0xf2efe7, bottom: 0x2b3a62, hat: 'none', backpack: undefined };

const TOKYO_HOTELS: HotelInfo[] = [
  {
    id: 'kaminariya', name: 'Hotel Kaminari-ya', jp: 'ホテル雷屋', street: 'Kaminari Lane', theme: 'inn',
    blurb: 'A family-run inn above the old shopping street, with creaky floors and the temple roofs out of the window.',
    lot: [181, 4], style: 'showa', floors: 3,
    rooms: [{ floor: 1, type: 'twin', price: 1800 }, { floor: 2, type: 'king', price: 3200 }],
    keeper: 'Mrs. Kanemoto', keeperLook: { topStyle: 'cardigan', top: 0xb0603a, accent: 0x6a3a22, hat: 'none', glasses: true, hair: 0x8a8a8e, backpack: undefined },
    lines: [
      'Welcome, welcome! My grandmother opened this inn the year the lane got its first streetlights.',
      'Breakfast is not included, but between us, the taiyaki stall opens at eight.',
      'The king room looks right over the lane. On a clear night you can count the lanterns.',
    ],
  },
  {
    id: 'hinode', name: 'Ryokan Hinode', jp: '旅館 日の出', street: 'Yanaka Lanes', theme: 'ryokan',
    blurb: 'One tatami room above a wooden townhouse. Futon, green tea and the quietest lane in town.',
    lot: [-228, 76], style: 'machiya', floors: 2,
    rooms: [{ floor: 1, type: 'tatami', price: 2400 }],
    keeper: 'Okami Setsuko', keeperLook: { topStyle: 'yukata', top: 0x2c3d73, accent: 0xe8dcc0, hat: 'none', hairStyle: 'bun', hair: 0x2a1d17, backpack: undefined },
    lines: [
      'Irasshaimase. Shoes off at the step, please. The tatami will thank you.',
      'We have only one room, so you will have the whole upstairs to yourself.',
      'Sleep on the futon tonight and the yukata in the cupboard is yours to wear. Ryokan rules!',
    ],
  },
  {
    id: 'hikari', name: 'Business Hotel Hikari', jp: 'ビジネスホテル光', street: 'Station Square', theme: 'business',
    blurb: 'Small, spotless and right by the station. The rooms are tiny, the beds are not.',
    lot: [48, -184], style: 'modern', floors: 9,
    rooms: [{ floor: 2, type: 'single', price: 1200 }, { floor: 3, type: 'double', price: 1900 }, { floor: 4, type: 'king', price: 3600 }],
    keeper: 'Clerk Hayashi', keeperLook: DESK,
    lines: [
      'Good evening. Check-in is from three, check-out is whenever you wake up. We are very flexible.',
      'Every room has a kettle, slippers and a pair of pyjamas. Salarymen sleep here in their thousands.',
      'The king room on the fifth floor looks right down on the scramble crossing. Very popular with photographers.',
    ],
  },
  {
    id: 'neonmoon', name: 'Hotel Neon Moon', jp: 'ホテル ネオン月', street: 'Neon-dori', theme: 'boutique',
    blurb: 'Velvet, dark wood and the whole of Neon-dori glowing through the glass.',
    lot: [328, -28], style: 'apartment', floors: 6,
    rooms: [{ floor: 3, type: 'double', price: 2600 }, { floor: 4, type: 'king', price: 4400 }],
    keeper: 'Concierge Rei', keeperLook: { topStyle: 'jacket', top: 0x2f2f35, accent: 0xb06aff, bottom: 0x2f2f35, hat: 'none', hairStyle: 'spiky', backpack: undefined },
    lines: [
      'Welcome to the Moon. We dim the lights so the street can do the decorating.',
      'Leave the curtains open tonight. The signs change colour every few minutes.',
      'Our king suite has the best seat on Neon-dori. Bring a snack from the konbini downstairs.',
    ],
  },
  {
    id: 'sakura', name: 'Guesthouse Sakura', jp: 'ゲストハウスさくら', street: 'Sakura Canal', theme: 'guesthouse',
    blurb: 'A cheerful little guesthouse on the canal. One room, one window, a hundred cherry trees.',
    lot: [396, 112], style: 'showa', floors: 4,
    rooms: [{ floor: 2, type: 'single', price: 1400 }],
    keeper: 'Miki', keeperLook: { topStyle: 'tee', top: 0xf08ac0, accent: 0xf2efe7, hat: 'beanie', hatColor: 0x3f6e9a, backpack: undefined },
    lines: [
      'Hi hi! Backpackers from all over the world have slept upstairs. Sign the wall map before you go!',
      'In spring the petals blow right in through the window. I sweep them up and keep them in a jar.',
      'The swan boats on the canal? Kids love them. I may or may not have raced one.',
    ],
  },
  {
    id: 'minami', name: 'Minami Park Hotel', jp: '南パークホテル', street: 'Minami-dori', theme: 'park',
    blurb: 'A proper old-fashioned hotel by the park, with brass keys and a doorman who remembers your name.',
    lot: [260, 260], style: 'modern', floors: 5,
    rooms: [{ floor: 2, type: 'twin', price: 2000 }, { floor: 3, type: 'double', price: 2400 }, { floor: 4, type: 'king', price: 3800 }],
    keeper: 'Mr. Shimizu', keeperLook: { ...DESK, top: 0x5a2a2a, glasses: true, hair: 0xb9b6b0 },
    lines: [
      'Good evening, and welcome to the Minami Park. We have kept the same brass keys since nineteen fifty-eight.',
      'From the king room you can see the park, the arcade and on a good day the station clock.',
      'Joggers go round the park pond at dawn. If you wake early, it is a lovely thing to watch.',
    ],
  },
  {
    id: 'sky', name: 'Hotel Sky Center-gai', jp: 'ホテルスカイ センター街', street: 'Center-gai', theme: 'sky',
    blurb: 'Glass, marble and a lift that hums. The fanciest beds in Hikari-machi, right above the shopping street.',
    lot: [396, 64], style: 'apartment', floors: 9,
    rooms: [{ floor: 3, type: 'double', price: 2800 }, { floor: 4, type: 'king', price: 5200 }],
    keeper: 'Ms. Arai', keeperLook: { ...DESK, top: 0x1f4f4a, accent: 0xe0b040, hairStyle: 'bob' },
    lines: [
      'Welcome to Hotel Sky. Your key card opens the lift; the lift does the rest.',
      'The king room has a deep bath and a window wider than the bed. Guests often forget to sleep.',
      'Center-gai never really closes. If the city is too loud, the curtains are blackout. But nobody closes them.',
    ],
  },
];

const HALIC: Partial<Look> = { topStyle: 'suit', top: 0x2b2b30, accent: 0xf4f1ea, bottom: 0x2b2b30, hat: 'none', backpack: undefined };
const W = (top: number, accent: number, extra: Partial<Look> = {}): Partial<Look> => ({ topStyle: 'vest', top, accent, hat: 'none', backpack: undefined, ...extra });

/**
 * Istanbul's twelve places to stay, on the flat streets near the water (the builder takes the twelve biggest low
 * buildings in order along the shore and up Sirkeci, so `lot` is unused here). Floors count from the ground floor
 * the Turkish way: room 101 is one floor up. `jp` holds the Turkish sign.
 */
const ISTANBUL_HOTELS: HotelInfo[] = [
  {
    id: 'halic', name: 'Otel Haliç', jp: 'Haliç Oteli', street: '', theme: 'inn',
    blurb: 'An old family hotel over the Golden Horn. The ferries hoot you awake.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'twin', price: 1600 }, { floor: 2, type: 'king', price: 2800 }],
    keeper: 'Kemal Bey', keeperLook: { topStyle: 'cardigan', top: 0x5a4a3a, accent: 0x3a2a20, glasses: true, hair: 0xb9b6b0, hat: 'none', backpack: undefined },
    lines: [
      'Hoş geldiniz! My father opened this hotel the year the old bridge burned. We are still here, the bridge is new.',
      'From the king room you can count the ferries. Forty a day, each with its own horn.',
      'Breakfast? Go to the boats. Simit and tea on the quay. That is the real Istanbul breakfast.',
    ],
  },
  {
    id: 'marti', name: 'Martı Pansiyon', jp: 'Martı Pansiyon', street: '', theme: 'guesthouse',
    blurb: 'A small guesthouse named after the gulls that sit on its roof. Cheap, clean, cheerful.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'single', price: 1100 }],
    keeper: 'Elif', keeperLook: W(0x3f6e9a, 0xf4f1ea, { hairStyle: 'ponytail', hair: 0x3b2a20 }),
    lines: [
      'The gulls? They live on the roof. They pay no rent and they wake everyone at five.',
      'One room, one bed, one big window. Everything a traveller needs.',
      'If you hear singing at dawn, it is the call to prayer from the New Mosque. It is beautiful, you will see.',
    ],
  },
  {
    id: 'sirkeci', name: 'Sirkeci Konak', jp: 'Sirkeci Konak Oteli', street: '', theme: 'boutique',
    blurb: 'A restored mansion near the old station, all velvet, brass and painted ceilings.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: 2200 }, { floor: 2, type: 'king', price: 3600 }],
    keeper: 'Selim Bey', keeperLook: HALIC,
    lines: [
      'The Orient Express used to end its journey at the station across the road. Our guests then came with steamer trunks.',
      'The ceilings are hand-painted, a hundred and twenty years old. Please do not throw pillows.',
      'The king room has a balcony. In the evening you can hear the whole street eating.',
    ],
  },
  {
    id: 'lale', name: 'Lale Otel', jp: 'Lale Otel', street: '', theme: 'inn',
    blurb: 'Tulips painted on every door. A grandmotherly hotel that smells of linden tea.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'twin', price: 1500 }, { floor: 2, type: 'double', price: 1900 }],
    keeper: 'Nesrin Hanım', keeperLook: { topStyle: 'cardigan', top: 0x8a2a3a, accent: 0x5a1a2a, hairStyle: 'bun', hair: 0x6b6b70, hat: 'none', backpack: undefined },
    lines: [
      'The tulip came from here, you know. The Dutch took it from the sultans\' gardens.',
      'Linden tea before bed, I insist. You will sleep like a stone.',
      'Shoes off on the carpets, please. They are older than both of us.',
    ],
  },
  {
    id: 'vapur', name: 'Hotel Vapur', jp: 'Vapur Otel', street: '', theme: 'business',
    blurb: 'Neat, modern and right by the ferry piers. You can hear the departure bell from the lobby.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'single', price: 1300 }, { floor: 2, type: 'double', price: 2000 }, { floor: 3, type: 'king', price: 3200 }],
    keeper: 'Murat', keeperLook: { topStyle: 'suit', top: 0x2b3a62, accent: 0xf2efe7, bottom: 0x2b3a62, hat: 'none', backpack: undefined },
    lines: [
      'Ferry to Kadıköy every twenty minutes. Feed the gulls a piece of simit from the back deck, everyone does.',
      'Wi-fi password is on the key card. Tea is in the lobby, all day, free.',
      'Top floor, king room: the Bosphorus out of one window and the Golden Horn out of the other.',
    ],
  },
  {
    id: 'kervan', name: 'Kervansaray Otel', jp: 'Kervansaray', street: '', theme: 'boutique',
    blurb: 'Built into an old merchants\' inn: thick stone walls, arched windows, a courtyard feeling.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: 2100 }, { floor: 2, type: 'king', price: 3400 }],
    keeper: 'Hakan Bey', keeperLook: W(0x5a1a2a, 0xc9a24a, { glasses: true }),
    lines: [
      'Merchants slept here three hundred years ago, with their camels in the yard. You get a nicer bed.',
      'The walls are a metre thick. Cool in summer, warm in winter, silent always.',
      'The Grand Bazaar is up the hill. Go early, before the crowds, and drink tea with the carpet sellers.',
    ],
  },
  {
    id: 'bogaz', name: 'Boğaz Manzara', jp: 'Boğaz Manzara Otel', street: '', theme: 'sky',
    blurb: 'A tall, thin hotel whose top room looks straight down the Bosphorus.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 2, type: 'double', price: 2400 }, { floor: 3, type: 'king', price: 4200 }],
    keeper: 'Zeynep', keeperLook: { topStyle: 'suit', top: 0x2f2f35, accent: 0xf4f1ea, bottom: 0x2f2f35, hairStyle: 'long', hair: 0x2a1d17, hat: 'none', backpack: undefined },
    lines: [
      'Manzara means view. We named the hotel after the only thing that matters.',
      'At night the bridges light up in colours. Leave the curtains open.',
      'Asia is just there, across the water. Ten minutes by ferry. Two continents in one day!',
    ],
  },
  {
    id: 'nar', name: 'Nar Konak', jp: 'Nar Konak', street: '', theme: 'inn',
    blurb: 'A wooden house hotel with a pomegranate tree at the door and creaking stairs.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: 1800 }],
    keeper: 'Gül Hanım', keeperLook: { topStyle: 'cardigan', top: 0xb0603a, accent: 0x6a3a22, hairStyle: 'bun', hair: 0x8a8a8e, hat: 'none', backpack: undefined },
    lines: [
      'Nar means pomegranate. The tree is older than the house, and the house is old.',
      'Pomegranate juice in the morning, squeezed in front of you. It stains, so wear red.',
      'One room only, so you are my only guest. I will worry about you like a son.',
    ],
  },
  {
    id: 'yildiz', name: 'Otel Yıldız', jp: 'Yıldız Oteli', street: '', theme: 'business',
    blurb: 'A practical, friendly hotel by the tram, the kind travelling salesmen have used for fifty years.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'twin', price: 1400 }, { floor: 2, type: 'single', price: 1200 }, { floor: 3, type: 'double', price: 1900 }],
    keeper: 'Orhan Bey', keeperLook: HALIC,
    lines: [
      'Yıldız means star. We have no stars from the guidebooks, but the sky on the roof has plenty.',
      'The tram rings its bell right under the window. You stop hearing it on the second night.',
      'Need a taxi, a ferry ticket, a barber? Ask Orhan. Orhan knows everyone.',
    ],
  },
  {
    id: 'ebru', name: 'Ebru Butik', jp: 'Ebru Butik Otel', street: '', theme: 'boutique',
    blurb: 'Named after marbled paper; every wall hangs a swirl of colour made on water.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: 2000 }, { floor: 2, type: 'king', price: 3300 }],
    keeper: 'Leyla', keeperLook: W(0x2f6b54, 0xf4f1ea, { hairStyle: 'bob', hair: 0x1d1a1c }),
    lines: [
      'Ebru is painting on water. You drop colours on thick water, swirl them with a comb and lay paper on top. No two are the same.',
      'My aunt makes them in the back room. If she is there, she will show you.',
      'The king room has the tulip ebru. Guests always ask to buy it. It is not for sale!',
    ],
  },
  {
    id: 'kubbe', name: 'Kubbe Otel', jp: 'Kubbe Otel', street: '', theme: 'park',
    blurb: 'A quiet hotel with a roof terrace facing the domes and minarets of the old city.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'twin', price: 1700 }, { floor: 2, type: 'double', price: 2200 }, { floor: 3, type: 'king', price: 3500 }],
    keeper: 'Ayşe Hanım', keeperLook: { topStyle: 'jacket', top: 0x6a4a7a, accent: 0xf4f1ea, hairStyle: 'long', hair: 0x3b2a20, hat: 'none', backpack: undefined },
    lines: [
      'Kubbe means dome. From the top room you can see six of them, and the gulls circling over each.',
      'When the call to prayer starts at dusk, go to the window. The whole city answers itself.',
      'Breakfast on the terrace: olives, cheese, tomatoes, honey, simit. A Turkish breakfast takes an hour, at least.',
    ],
  },
  {
    id: 'cinar', name: 'Çınar Pansiyon', jp: 'Çınar Pansiyon', street: '', theme: 'guesthouse',
    blurb: 'A backpackers\' favourite under an old plane tree, with a cat on every step.',
    lot: [0, 0], style: 'apartment', floors: 4,
    rooms: [{ floor: 1, type: 'single', price: 1000 }, { floor: 2, type: 'twin', price: 1300 }],
    keeper: 'Deniz', keeperLook: W(0xd9a24a, 0x3a2a20, { hairStyle: 'spiky', hair: 0x2a1d17 }),
    lines: [
      'Çınar is the plane tree outside. Istanbul\'s plane trees are hundreds of years old. Some have names.',
      'The cats? Pamuk, Duman and Sultan. Sultan is in charge.',
      'Free tea, free maps, free advice. The advice is: eat everything.',
    ],
  },
];

/** Amalfi's four: houses of the town (placed by the plan, see amalfiPlan's HOTEL_PLACES), stairs instead of lifts. */
const AMALFI_HOTELS: HotelInfo[] = [
  {
    id: 'marina', name: 'Albergo Marina Grande', jp: 'Albergo', street: 'The Harbour', theme: 'marina', stairs: true,
    blurb: 'A tall old harbour house against the cliff, blue shutters and every window full of boats and sea.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: 2200 }, { floor: 2, type: 'twin', price: 2400 }, { floor: 3, type: 'king', price: 4200 }],
    keeper: 'Signor Vincenzo', keeperLook: { topStyle: 'suit', top: 0x2b4c86, accent: 0xf4f1ea, bottom: 0x2b3a62, hat: 'none', hair: 0xb9b6b0, glasses: true, backpack: undefined },
    lines: [
      'Benvenuti! My grandfather was a fisherman, and he built this house so he could see his boat from his bed.',
      'From the top room you watch the ferries come in from Positano. At night the fishing lamps go out on the water.',
      'Breakfast? Go to the Bar del Duomo, ask Enzo for a cornetto, and tell him Vincenzo sent you.',
    ],
  },
  {
    id: 'limoni', name: 'Locanda dei Limoni', jp: 'Locanda', street: 'Salita dei Mulini', theme: 'locanda', stairs: true,
    blurb: 'A little inn up the steps among the lemon gardens. Majolica floors, lace curtains, the smell of blossom.',
    lot: [0, 0], style: 'modern', floors: 3,
    rooms: [{ floor: 1, type: 'double', price: 1800 }, { floor: 2, type: 'king', price: 3200 }],
    keeper: 'Signora Teresa', keeperLook: { topStyle: 'cardigan', top: 0xe9c23a, accent: 0xf4f1ea, bottom: 0x2f2f35, hat: 'none', hairStyle: 'bun', hair: 0x6b6b70, backpack: undefined },
    lines: [
      'You found us! Most people give up on the steps. The ones who keep climbing get the best sleep in Amalfi.',
      'In spring the whole house smells of lemon blossom. In summer, of lemons. In winter, of my limoncello.',
      'The room at the top looks right over the domes to the sea. Leave the shutters open and the sun will wake you.',
    ],
  },
  {
    id: 'palazzo', name: 'Palazzo Ruggiero', jp: 'Palazzo', street: "Via Lorenzo d'Amalfi", theme: 'palazzo', stairs: true,
    blurb: 'A merchant\'s palace from the days of the maritime republic: painted ceilings, a marble stair, silk on the walls.',
    lot: [0, 0], style: 'modern', floors: 5,
    rooms: [{ floor: 1, type: 'single', price: 2000 }, { floor: 2, type: 'double', price: 2800 }, { floor: 3, type: 'king', price: 4800 }],
    keeper: 'Dottoressa Ruggiero', keeperLook: { topStyle: 'suit', top: 0x6a1e2a, accent: 0xe9c23a, bottom: 0x2f2f35, hat: 'none', hairStyle: 'bob', hair: 0x2a1d17, backpack: undefined },
    lines: [
      'Welcome to the Palazzo. My family traded silk and pepper with Constantinople when Amalfi ruled the sea.',
      'Mind the marble stair, it has been polished by eight hundred years of feet.',
      'The king room has the painted ceiling. Lie on the bed and count the cherubs. There are thirty-one.',
    ],
  },
  {
    id: 'gabbiano', name: 'Pensione Il Gabbiano', jp: 'Pensione', street: 'Vicoli di Ponente', theme: 'pensione', stairs: true,
    blurb: 'A friendly family pensione high in the lanes, with a view straight over the piazza to the sea.',
    lot: [0, 0], style: 'modern', floors: 3,
    rooms: [{ floor: 1, type: 'twin', price: 1600 }, { floor: 2, type: 'king', price: 3000 }],
    keeper: 'Peppino', keeperLook: { topStyle: 'tee', top: 0xf4f1ea, accent: 0x2f63a8, bottom: 0x2b3a62, hat: 'none', hairStyle: 'short', hair: 0x2a1d17, backpack: undefined },
    lines: [
      'Ciao! It is called the Seagull because one of them sits on the roof every morning and shouts at my mother.',
      'From upstairs you can see the whole piazza, the Duomo steps and all the way out past the Molo.',
      'Hungry? Nonna Gemma is right below on the piazza. Tell her you are staying with us, she will give you extra.',
    ],
  },
];

/** The hotels of the city on this trip. */
export const HOTELS: HotelInfo[] = ISTANBUL ? ISTANBUL_HOTELS : AMALFI ? AMALFI_HOTELS : TOKYO_HOTELS;
export { ISTANBUL_HOTELS };

/** Whether guests climb the stairs to their rooms (a ryokan, every house on the coast) rather than take a lift. */
export const byStairs = (h: HotelInfo): boolean => !!h.stairs || h.theme === 'ryokan';

export const HOTEL: Record<string, HotelInfo> = Object.fromEntries(HOTELS.map((h) => [h.id, h]));

/** The hotel whose building stands on a lot, by the lot's corner. */
export function hotelAt(x0: number, z0: number): HotelInfo | undefined {
  return TOKYO_HOTELS.find((h) => h.lot[0] === x0 && h.lot[1] === z0);
}

const TOKYO_ROOM_TYPE: Record<RoomType, { name: string; jp: string; text: string; icon: IconName }> = {
  single: { name: 'Single room', jp: 'シングル', text: 'A snug room with a single bed, a desk and a kettle.', icon: 'bed' },
  twin: { name: 'Twin room', jp: 'ツイン', text: 'Two beds side by side, in case a friend needs one.', icon: 'bed' },
  double: { name: 'Double room', jp: 'ダブル', text: 'A wide bed, an armchair by the window and room to stretch.', icon: 'bed' },
  king: { name: 'King room', jp: 'キング', text: 'The best room in the house: a huge bed, a sofa and the widest view.', icon: 'crown' },
  tatami: { name: 'Tatami room', jp: '和室', text: 'Futon on fresh tatami, a low table and a window seat over the lane.', icon: 'futon' },
};

const ISTANBUL_ROOM_TYPE: typeof TOKYO_ROOM_TYPE = {
  single: { name: 'Single room', jp: 'Tek kişilik', text: 'A snug room with a single bed, a kilim and a tea tray.', icon: 'bed' },
  twin: { name: 'Twin room', jp: 'İki yataklı', text: 'Two beds side by side under woven covers.', icon: 'bed' },
  double: { name: 'Double room', jp: 'Çift kişilik', text: 'A wide bed with a carved headboard, an armchair by the window.', icon: 'bed' },
  king: { name: 'King room', jp: 'Süit', text: 'The best room in the house: a huge bed, a sofa and the widest view of the water.', icon: 'crown' },
  tatami: { name: 'Tatami room', jp: 'Tatami', text: '', icon: 'futon' },
};
const AMALFI_ROOM_TYPE: typeof TOKYO_ROOM_TYPE = {
  single: { name: 'Single room', jp: 'camera singola', text: 'A small white room with an iron bed, a writing desk and the shutters open on the town.', icon: 'bed' },
  twin: { name: 'Twin room', jp: 'camera doppia', text: 'Two iron beds on a majolica floor, and a window full of rooftops and sea.', icon: 'bed' },
  double: { name: 'Double room', jp: 'camera matrimoniale', text: 'A big bed under a painted headboard, an armchair by the French window, a moka on the side.', icon: 'bed' },
  king: { name: 'Suite', jp: 'suite', text: 'The best room in the house: the widest bed, a sofa and the whole coast through the windows.', icon: 'crown' },
  tatami: { name: 'Tatami room', jp: 'tatami', text: '', icon: 'futon' },
};
export const ROOM_TYPE = ISTANBUL ? ISTANBUL_ROOM_TYPE : AMALFI ? AMALFI_ROOM_TYPE : TOKYO_ROOM_TYPE;

/** Room number as the door says it: floor 1 above the lobby is the 2nd floor in Japan (room 201), the 1st in Turkey and Italy (101). */
export const roomNo = (floor: number) => `${ISTANBUL || AMALFI ? floor : floor + 1}01`;

/** Guests waiting in the lobbies have travel stories to tell. */
const TOKYO_HOTEL_GUEST_LINES: string[] = [
  'I booked the king room on a whim. The bed is so big I lost my phone in it.',
  'Check in before dark, they told me. Then I spent three hours at the takoyaki stall anyway.',
  'From up there you can see the whole street glowing. I watched it until midnight.',
  'Tomorrow I am trying a different hotel. Seven in town, and I want to sleep in all of them!',
  'The ryokan in Yanaka gives you a yukata. I wore mine to breakfast. Nobody blinked.',
  'Leave the curtains open. Waking up to the city is the best alarm clock.',
];

const AMALFI_HOTEL_GUEST_LINES: string[] = [
  'I asked for a sea view. The owner laughed and said every room in Amalfi has a sea view. He was right.',
  'Two hundred steps to my room. Two hundred! But the lemon garden at the top made me forget all of them.',
  'Leave the shutters open tonight. The fishing boats go out with their lamps and the whole bay twinkles.',
  'Four hotels in town, and I want to sleep in all of them. Tomorrow, the Palazzo.',
  'The signora brought me a limoncello at midnight. I did not ask. I did not refuse.',
  'Breakfast on the terrace, the bells of the Duomo, a cornetto. I am never going home.',
];

const ISTANBUL_HOTEL_GUEST_LINES: string[] = [
  'I took the room over the water. The ferries hoot all night and I loved every one.',
  'Twelve hotels in this little corner of town! I am trying a new one every night.',
  'Check in before the evening call to prayer, the receptionist said. Then I ate balık ekmek for two hours.',
  'They brought tea to my room without asking. I think that is just what happens here.',
  'From the top floor you can see two continents. I waved at Asia.',
  'The breakfast here is a whole table. I have stopped eating lunch.',
];
export const HOTEL_GUEST_LINES: string[] = ISTANBUL ? ISTANBUL_HOTEL_GUEST_LINES : AMALFI ? AMALFI_HOTEL_GUEST_LINES : TOKYO_HOTEL_GUEST_LINES;
