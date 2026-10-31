import type { Look } from '../world/characters';
import type { IconName } from '../ui/emblems';

/**
 * The seven places to stay. Each one is a real building in the city (picked by the corner of its lot), with a
 * lobby on the ground floor and one to three rooms upstairs, one room per floor. A hotel with two or more rooms
 * keeps a king room on its top guest floor. Rooms sit on floors 1 to 4 above the lobby: the cutaway's solid bits
 * reach 16 m, and that is high enough to see over most of the town.
 */

export type RoomType = 'single' | 'twin' | 'double' | 'king' | 'tatami';
/** Furnishing and colours of the rooms and the lobby. */
export type HotelTheme = 'inn' | 'ryokan' | 'business' | 'boutique' | 'guesthouse' | 'park' | 'sky';

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
}

const DESK: Partial<Look> = { topStyle: 'suit', top: 0x2b3a62, accent: 0xf2efe7, bottom: 0x2b3a62, hat: 'none', backpack: undefined };

export const HOTELS: HotelInfo[] = [
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

export const HOTEL: Record<string, HotelInfo> = Object.fromEntries(HOTELS.map((h) => [h.id, h]));

/** The hotel whose building stands on a lot, by the lot's corner. */
export function hotelAt(x0: number, z0: number): HotelInfo | undefined {
  return HOTELS.find((h) => h.lot[0] === x0 && h.lot[1] === z0);
}

export const ROOM_TYPE: Record<RoomType, { name: string; jp: string; text: string; icon: IconName }> = {
  single: { name: 'Single room', jp: 'シングル', text: 'A snug room with a single bed, a desk and a kettle.', icon: 'bed' },
  twin: { name: 'Twin room', jp: 'ツイン', text: 'Two beds side by side, in case a friend needs one.', icon: 'bed' },
  double: { name: 'Double room', jp: 'ダブル', text: 'A wide bed, an armchair by the window and room to stretch.', icon: 'bed' },
  king: { name: 'King room', jp: 'キング', text: 'The best room in the house: a huge bed, a sofa and the widest view.', icon: 'crown' },
  tatami: { name: 'Tatami room', jp: '和室', text: 'Futon on fresh tatami, a low table and a window seat over the lane.', icon: 'futon' },
};

/** Room number as the door says it: floor 1 above the lobby is the 2nd floor in Japan, so room 201. */
export const roomNo = (floor: number) => `${floor + 1}01`;

/** Guests waiting in the lobbies have travel stories to tell. */
export const HOTEL_GUEST_LINES: string[] = [
  'I booked the king room on a whim. The bed is so big I lost my phone in it.',
  'Check in before dark, they told me. Then I spent three hours at the takoyaki stall anyway.',
  'From up there you can see the whole street glowing. I watched it until midnight.',
  'Tomorrow I am trying a different hotel. Seven in town, and I want to sleep in all of them!',
  'The ryokan in Yanaka gives you a yukata. I wore mine to breakfast. Nobody blinked.',
  'Leave the curtains open. Waking up to the city is the best alarm clock.',
];
