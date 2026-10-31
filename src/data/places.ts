import type { IconName } from '../ui/emblems';
import type { RoomKind } from '../world/interiors';
import { randomLook, Look } from '../world/characters';
import { HOTEL } from './hotels';

/** Something small a shop sells over the counter. */
export interface Buyable { icon: IconName; name: string; price: number; text: string; snack?: boolean; }

export interface PlaceKind {
  label: string;
  names: [string, string][];
  keepers: string[];
  /** What the keeper wears, on top of a random look. */
  keeperLook: Partial<Look>;
  lines: string[];
  buy: Buyable[];
}

const LOOKS: Record<string, Partial<Look>> = {
  apron: { topStyle: 'apron', top: 0xf2efe7, accent: 0x2f6b54 },
  konbini: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2e9a5a, hat: 'none' },
  izakaya: { topStyle: 'tee', top: 0x2b3346, accent: 0x2b3346, hat: 'headband', hatColor: 0xf2efe7 },
  white: { topStyle: 'jacket', top: 0xf4f1ea, accent: 0xf4f1ea, glasses: true, hat: 'none' },
  cardigan: { topStyle: 'cardigan', top: 0x8a6a4a, accent: 0x5a4a3a, glasses: true, hat: 'none', hair: 0xb9b6b0 },
  fish: { topStyle: 'apron', top: 0x3f6e9a, accent: 0x2b3a62, hat: 'headband', hatColor: 0x2b5aa8 },
  baker: { topStyle: 'apron', top: 0xf7f4ee, accent: 0xa86a32, hat: 'chef', hatColor: 0xf7f4ee },
};

export const PLACES: Record<RoomKind, PlaceKind> = {
  shop: {
    label: 'Zakka shop',
    names: [['Hinata Zakka', 'ひなた雑貨'], ['Tsubame-dō', 'つばめ堂'], ['Kumo Goods', 'くも商店'], ['Marumaru', 'まるまる'], ['Ginkgo Variety', 'いちょう屋']],
    keepers: ['Mrs. Aoki', 'Kenta', 'Mr. Maeda', 'Sachiko', 'Old Mr. Hori'],
    keeperLook: LOOKS.apron,
    lines: [
      'Zakka means "many things". Chopsticks, towels, cat ornaments... if it is small and cute, we have it.',
      'Tourists love the tenugui towels. Locals use them for everything: wiping sweat, wrapping lunch, even as a headband.',
      'Have you tried the gachapon machines? Two hundred yen for a mystery capsule. My nephew has a whole shelf of them.',
      'Somebody keeps hiding little red daruma in the shops around here. I found one behind my boxes once. Good luck, they say!',
    ],
    buy: [
      { icon: 'towel', name: 'Tenugui towel', price: 600, text: 'A printed cotton towel with little goldfish. Locals use them for everything.' },
      { icon: 'chopsticks', name: 'Lacquer chopsticks', price: 800, text: 'Red lacquer with a gold sakura petal. Rest them on the holder, never stick them upright in rice.' },
      { icon: 'chime', name: 'Glass wind chime', price: 900, text: 'A fūrin. Its ring is meant to make a hot summer day feel cooler.' },
    ],
  },
  cafe: {
    label: 'Café',
    names: [['Café Ginkgo', 'カフェ 銀杏'], ['Mado Coffee', 'まど珈琲'], ['Café Nagi', 'カフェ 凪'], ['Hidamari', 'ひだまり']],
    keepers: ['Barista Ren', 'Mio', 'Mr. Okada', 'Hana'],
    keeperLook: LOOKS.apron,
    lines: [
      'Hand-drip, one cup at a time. Tokyo has some of the most patient baristas in the world.',
      'The morning set comes with thick toast and a boiled egg. In Nagoya they give you that for free with coffee!',
      'Sit as long as you like. Cafés here are a living room for people with tiny apartments.',
    ],
    buy: [
      { icon: 'coffee', name: 'Hand-drip coffee', price: 480, text: 'Slow-poured, light and fruity. You can taste the patience.', snack: true },
      { icon: 'latte', name: 'Iced matcha latte', price: 560, text: 'Bitter green tea, sweet milk, lots of ice.', snack: true },
      { icon: 'toast', name: 'Thick toast set', price: 520, text: 'Four centimetres of fluffy shokupan with butter and ogura red bean.', snack: true },
    ],
  },
  izakaya: {
    label: 'Izakaya',
    names: [['Izakaya Tanuki', '居酒屋 たぬき'], ['Hyōtan', 'ひょうたん'], ['Sakaba Tsuki', '酒場 月'], ['Tori-ya Kiku', '鳥屋 菊'], ['Nomikui Ume', '呑み食い 梅'], ['Kanpai-ya', '乾杯屋'], ['Akachōchin', '赤提灯'], ['Shōchū Bar Kame', '焼酎 亀']],
    keepers: ['Master Ogawa', 'Mama-san Keiko', 'Taishō Ben', 'Ryū', 'Okami Yoshie', 'Master Jun', 'Shin-chan', 'Old Tetsu'],
    keeperLook: LOOKS.izakaya,
    lines: [
      'Irasshai! Sit, sit. First a drink, then we talk. That small dish? That is otōshi, a little starter that comes with your seat.',
      'This alley used to be a black market after the war. Now it is twenty bars, each one smaller than a train carriage.',
      'A red lantern outside means a cheap and friendly place. Akachōchin, we call them.',
      'Kanpai! Wait for everyone to have a glass before you drink, that is the only rule.',
    ],
    buy: [
      { icon: 'tea', name: 'Oolong tea', price: 300, text: 'Iced oolong in a tall glass. The non-drinker\'s kanpai.', snack: true },
      { icon: 'edamame', name: 'Edamame', price: 350, text: 'Salted green soybeans, popped straight from the pod.', snack: true },
      { icon: 'pickles', name: 'Pickles platter', price: 400, text: 'Tsukemono: crunchy cucumber, yellow takuan and pink ginger.', snack: true },
    ],
  },
  konbini: {
    label: 'Konbini',
    names: [['Hoshi Mart', 'ほしマート'], ['Yoru Mart', 'よるマート']],
    keepers: ['Clerk Satō', 'Clerk Nguyen'],
    keeperLook: LOOKS.konbini,
    lines: [
      'Irasshaimasē! Would you like your bentō warmed up?',
      'We are open twenty-four hours, three hundred and sixty-five days. You can pay bills here, send parcels, even buy concert tickets.',
      'Onigiri have a clever wrapper: pull tab one, then the corners, and the nori stays crisp.',
      'The capsule machines by the door? Kids love them. Adults too, honestly.',
    ],
    buy: [
      { icon: 'onigiri', name: 'Tuna-mayo onigiri', price: 160, text: 'Pull tab 1, then corners 2 and 3. The nori stays crisp. Genius.', snack: true },
      { icon: 'nikuman', name: 'Nikuman bun', price: 180, text: 'A fluffy steamed bun stuffed with pork, from the warmer by the till.', snack: true },
      { icon: 'sando', name: 'Egg sando', price: 280, text: 'Soft white bread, crustless, full of creamy egg salad. A konbini legend.', snack: true },
      { icon: 'chicken', name: 'Hot-case karaage', price: 220, text: 'Five crispy fried chicken bites in a paper cup, with a tiny toothpick.', snack: true },
    ],
  },
  florist: {
    label: 'Florist',
    names: [['Hanaya Sumire', '花屋 すみれ'], ['Flower Tsubaki', 'フラワー 椿'], ['Kaori-en', '香り園']],
    keepers: ['Sumire-san', 'Daisuke', 'Mrs. Kanda'],
    keeperLook: { ...LOOKS.apron, accent: 0x6fae4a },
    lines: [
      'Flowers follow the seasons here: plum, then cherry, then hydrangea in the rainy season, chrysanthemums in autumn.',
      'Ikebana is about space as much as flowers. Three stems can say more than thirty.',
      'Never give four flowers. Shi, four, sounds like the word for death.',
    ],
    buy: [
      { icon: 'flower', name: 'A single sunflower', price: 300, text: 'Wrapped in brown paper with a twist of raffia.' },
      { icon: 'posy', name: 'Seasonal posy', price: 700, text: 'Small, careful and perfectly balanced. Ikebana for your backpack.' },
    ],
  },
  books: {
    label: 'Bookshop',
    names: [['Furuhon Ōta', '古本 太田'], ['Shiori Books', 'しおり書房'], ['Tsukiyo Bunko', '月夜文庫']],
    keepers: ['Old Mr. Ōta', 'Shiori-san', 'Professor Mori'],
    keeperLook: LOOKS.cardigan,
    lines: [
      'Jinbōchō has a hundred and fifty second-hand bookshops. We are the only one that sells cookbooks from the Edo period.',
      'Ah, that shelf at the back? Old books, old secrets. My grandfather built it himself.',
      'People here read standing in the shop for hours. Tachiyomi, we call it. I do not mind.',
    ],
    buy: [
      { icon: 'book', name: 'Old Edo cookbook', price: 1200, text: 'A woodblock-printed book of recipes from 1802. Mostly tofu, a hundred ways.' },
      { icon: 'bookmark', name: 'Washi bookmark', price: 250, text: 'Handmade paper with a pressed maple leaf.' },
    ],
  },
  fish: {
    label: 'Fishmonger',
    names: [['Uoya Kaneshō', '魚屋 金正'], ['Sakana Marui', '魚 丸井']],
    keepers: ['Kanesho-san', 'Big Taka'],
    keeperLook: LOOKS.fish,
    lines: [
      'Up at three for the market at Toyosu. The tuna auction starts at half past five, every day.',
      'Look at the eyes: clear and bright means fresh. Cloudy eyes, walk away.',
      'Kohada, aji, saba... the shiny "hikarimono" fish are the true taste of Edomae sushi.',
    ],
    buy: [
      { icon: 'chikuwa', name: 'Chikuwa fish cake', price: 200, text: 'A grilled tube of fish paste. Kids eat them straight from the bag.', snack: true },
      { icon: 'fish', name: 'Grilled salted saba', price: 450, text: 'Mackerel with crackling skin, wrapped to go.', snack: true },
    ],
  },
  bakery: {
    label: 'Bakery',
    names: [['Pan-ya Komugi', 'パン屋 こむぎ'], ['Boulangerie Kona', 'ブーランジェリー 粉'], ['Asahi Bakery', '朝日ベーカリー']],
    keepers: ['Baker Yoko', 'Mr. Komugi', 'Asahi-san'],
    keeperLook: LOOKS.baker,
    lines: [
      'Japanese bakeries pick bread with tongs onto a little tray. Grab one by the door!',
      'Melon pan has no melon in it. It is named for its crackly, melon-skin top.',
      'Anpan was invented in Tokyo in 1874, for the Emperor himself. Sweet bean paste in soft bread.',
    ],
    buy: [
      { icon: 'melonpan', name: 'Melon pan', price: 220, text: 'Crackly cookie crust, fluffy inside, still warm from the oven.', snack: true },
      { icon: 'currypan', name: 'Curry pan', price: 250, text: 'A deep-fried bun full of thick Japanese curry. Crunchy, then spicy.', snack: true },
      { icon: 'anpan', name: 'Anpan', price: 200, text: 'Soft bun with sweet red bean paste and a sprinkle of sesame.', snack: true },
    ],
  },
  pharmacy: {
    label: 'Drugstore',
    names: [['Midori Drug', 'みどり薬局'], ['Sakura Pharmacy', 'さくら薬局']],
    keepers: ['Pharmacist Endō', 'Pharmacist Yamada'],
    keeperLook: LOOKS.white,
    lines: [
      'Japanese drugstores sell everything: snacks, sunscreen, socks, and medicine at the counter in the back.',
      'Feeling tired from walking? Try one of the little vitamin drinks. Salarymen swear by them.',
    ],
    buy: [
      { icon: 'vitamin', name: 'Vitamin drink', price: 250, text: 'A tiny brown bottle with a big promise. You feel energetic. Probably.', snack: true },
      { icon: 'plaster', name: 'Cute plasters', price: 300, text: 'Bandages printed with tiny shiba dogs.' },
    ],
  },
  kissa: { label: 'Kissaten', names: [['Kissa Komorebi', '喫茶 木漏れ日']], keepers: ['Master Kuroda'], keeperLook: {}, lines: [], buy: [] },
  soba: { label: 'Soba shop', names: [['Soba-dokoro Kikyō', 'そば処 桔梗']], keepers: ['Fujita-san'], keeperLook: {}, lines: [], buy: [] },
  // each hotel has its own name, keeper and lines (data/hotels.ts)
  hotel: { label: 'Hotel', names: [['Hotel', 'ホテル']], keepers: ['Receptionist'], keeperLook: {}, lines: [], buy: [] },
};

/** People sitting in cafés and bars have opinions, and the odd hint. */
export const GUEST_LINES: string[] = [
  'They say the old bookshop on Kaminari Lane has a shelf that holds more than books.',
  'Somebody hides tiny red daruma in the back rooms of the shops. My kid found one between the crates.',
  'Have you eaten at the soba shop with the noodle window? You can watch them cut the noodles from the street.',
  'The kissaten by the canal still uses a siphon for coffee. Like a chemistry class, but delicious.',
  'Gachapon machines in the konbini... I have spent more on those than on lunch this month.',
  'If you find all the daruma, paint in the other eye. That is how you make a wish come true.',
  'The red lantern bars on Lantern Alley are the best. Six seats, one cook, a hundred stories.',
  'I come here every day after work. The chairs remember me.',
  'Tourists eat at the stalls. Locals eat where there is no sign.',
  'The master here has made the same dish for forty years. Why change something perfect?',
];

export interface Capsule { id: string; name: string; icon: IconName; rare?: boolean; }

/** Gachapon capsule charms: tiny food keychains. */
export const CAPSULES: Capsule[] = [
  { id: 'takoyaki', name: 'Mini takoyaki', icon: 'takoyaki' },
  { id: 'taiyaki', name: 'Tiny taiyaki', icon: 'fish' },
  { id: 'ramen', name: 'Pocket ramen', icon: 'ramen' },
  { id: 'onigiri', name: 'Onigiri buddy', icon: 'onigiri' },
  { id: 'dango', name: 'Dango trio', icon: 'dango' },
  { id: 'sushi', name: 'Salmon nigiri', icon: 'sushi' },
  { id: 'melonpan', name: 'Melon pan', icon: 'melonpan' },
  { id: 'gyoza', name: 'Gyoza pal', icon: 'gyoza' },
  { id: 'lantern', name: 'Red lantern', icon: 'lantern' },
  { id: 'maneki', name: 'Maneki-neko', icon: 'cat' },
  { id: 'daruma', name: 'Daruma', icon: 'daruma' },
  { id: 'golden', name: 'Golden shrimp tempura', icon: 'shrimp', rare: true },
];

export const GACHA_PRICE = 200;

export function roomName(kind: RoomKind, nth: number, hotel?: string): [string, string] {
  const h = hotel ? HOTEL[hotel] : undefined;
  if (h) return [h.name, h.jp];
  const n = PLACES[kind].names;
  return n[nth % n.length];
}

export function keeperOf(kind: RoomKind, nth: number, seed: number, hotel?: string): { name: string; look: Look } {
  const h = hotel ? HOTEL[hotel] : undefined;
  if (h) return { name: h.keeper, look: { ...randomLook(seed), backpack: undefined, ...h.keeperLook } as Look };
  const p = PLACES[kind];
  const look = { ...randomLook(seed), backpack: undefined, ...p.keeperLook } as Look;
  return { name: p.keepers[nth % p.keepers.length], look };
}
