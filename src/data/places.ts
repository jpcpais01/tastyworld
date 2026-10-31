import type { IconName } from '../ui/emblems';
import type { RoomKind } from '../world/interiors';
import { randomLook, Look } from '../world/characters';
import { HOTEL } from './hotels';
import { ISTANBUL } from '../world/cityId';

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
  // Istanbul: white shirts and waistcoats behind the counters, the cook's white cap, the bazaar's cardigans
  waiter: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2b2b30, bottom: 0x2b2b30, hat: 'none' },
  usta: { topStyle: 'apron', top: 0xf4f1ea, accent: 0xf4f1ea, hat: 'chef', hatColor: 0xf4f1ea },
  bazaar: { topStyle: 'cardigan', top: 0x5a4a3a, accent: 0x8a2a2a, hat: 'none', glasses: true },
  sea: { topStyle: 'apron', top: 0x2b4c86, accent: 0xf4f1ea, hat: 'cap', hatColor: 0x2b3a62 },
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
  // ---------------------------------------------------------------- Istanbul (`names` hold [English, Turkish])
  kahve: {
    label: 'Coffee house',
    names: [['Kahveci Hüseyin', 'Kahveci Hüseyin'], ['Köşe Kahvesi', 'Köşe Kahvesi'], ['Han Kahvesi', 'Han Kahvesi']],
    keepers: ['Hüseyin Bey', 'Kadir Usta', 'Ercan'],
    keeperLook: LOOKS.waiter,
    lines: [
      'Turkish coffee is boiled once, slowly, in a little copper cezve. If it boils over, start again. No shortcuts.',
      'Sade, orta or şekerli? Plain, medium or sweet. You choose the sugar before I brew, not after.',
      'Do not drink to the bottom! The grounds stay in the cup. Some people turn it over and read your fortune in them.',
      'A cup of coffee commits one to forty years of friendship, the old proverb says. So now we are friends.',
    ],
    buy: [
      { icon: 'coffee', name: 'Türk kahvesi', price: 180, text: 'Thick, foamy and strong, with a glass of water and a cube of lokum on the saucer.', snack: true },
      { icon: 'tea', name: 'Çay', price: 60, text: 'Black tea in a tulip glass, the colour of a rabbit\'s blood, as they say here.', snack: true },
      { icon: 'milk', name: 'Ayran', price: 90, text: 'Cold salted yoghurt, frothy on top. The best thing on a hot afternoon.', snack: true },
    ],
  },
  cay: {
    label: 'Tea house',
    names: [['Çay Ocağı Yıldız', 'Çay Ocağı'], ['Lale Çay Evi', 'Lale Çay Evi']],
    keepers: ['Çaycı Remzi', 'Gülsüm Abla'],
    keeperLook: LOOKS.waiter,
    lines: [
      'Istanbul drinks more tea than anyone on earth. Ten glasses a day is nothing. I carry them on a swinging tray to every shop on the street.',
      'Two kettles, one on top of the other. Strong tea brews in the little one, hot water waits in the big one. You say how dark.',
      'A simit with your tea? Every morning of my life.',
    ],
    buy: [
      { icon: 'tea', name: 'Tavşan kanı çay', price: 60, text: 'Dark, clear tea in a tulip glass. Hold it by the rim, it is hot.', snack: true },
      { icon: 'simit', name: 'Simit', price: 80, text: 'A sesame ring, crisp outside, soft inside.', snack: true },
      { icon: 'drop', name: 'Elma çayı', price: 70, text: 'Sweet apple tea, the one every visitor falls for.', snack: true },
    ],
  },
  lokanta: {
    label: 'Lokanta',
    names: [['Esnaf Lokantası Şahin', 'Esnaf Lokantası'], ['Lokanta Hacı Baba', 'Hacı Baba'], ['Ev Yemekleri Nur', 'Ev Yemekleri'], ['Çarşı Lokantası', 'Çarşı Lokantası']],
    keepers: ['Şahin Usta', 'Hacı Bey', 'Nur Hanım', 'Mustafa'],
    keeperLook: LOOKS.usta,
    lines: [
      'Point at what you want. Everything in the steam tray was cooked this morning, the way our mothers cook.',
      'Esnaf lokantası means "tradesmen\'s restaurant". Shopkeepers, porters, bankers, all eat here at noon, side by side.',
      'Kuru fasulye with pilav is the national lunch. Beans, rice, a pickle. Simple and perfect.',
      'Bread is free and there is always more. Take it, take it.',
    ],
    buy: [
      { icon: 'bean', name: 'Kuru fasulye', price: 260, text: 'White beans slow-cooked with tomato and butter, with a spoon of pilav.', snack: true },
      { icon: 'pot', name: 'Mercimek çorbası', price: 160, text: 'Red lentil soup with lemon and a pinch of chilli. Dip your bread.', snack: true },
      { icon: 'rice', name: 'Tereyağlı pilav', price: 120, text: 'Buttery rice with toasted orzo, shiny and fluffy.', snack: true },
    ],
  },
  kebap: {
    label: 'Kebab house',
    names: [['Kebapçı Halil', 'Kebapçı'], ['Ocakbaşı Ali Usta', 'Ocakbaşı'], ['Urfa Sofrası', 'Urfa Sofrası']],
    keepers: ['Halil Usta', 'Ali Usta', 'Mahmut'],
    keeperLook: LOOKS.usta,
    lines: [
      'Adana is spicy, Urfa is not. Both are minced by hand with a big curved knife called a zırh.',
      'Charcoal only. Gas makes a kebab, charcoal makes a memory.',
      'Lahmacun: squeeze lemon, add parsley, roll it up and eat it with your hands. Forks are for tourists.',
    ],
    buy: [
      { icon: 'skewer', name: 'Adana kebap', price: 420, text: 'Hand-minced lamb and red pepper on a wide skewer, grilled over charcoal.', snack: true },
      { icon: 'wrap', name: 'Lahmacun', price: 180, text: 'Paper-thin flatbread with spiced mince, rolled round parsley and lemon.', snack: true },
      { icon: 'milk', name: 'Ayran', price: 90, text: 'Salty and cold. It puts the fire out.', snack: true },
    ],
  },
  pide: {
    label: 'Pide house',
    names: [['Karadeniz Pide', 'Karadeniz Pide Salonu'], ['Pideci Rıza', 'Pideci']],
    keepers: ['Rıza Usta', 'Temel'],
    keeperLook: LOOKS.baker,
    lines: [
      'Pide is a boat of bread. We are from the Black Sea coast, so ours have a lot of butter. A lot.',
      'Kaşarlı with an egg cracked on top. Stir the egg into the cheese while it is hot.',
      'The wood oven is older than me. My father built it in 1971.',
    ],
    buy: [
      { icon: 'pizza', name: 'Kıymalı pide', price: 300, text: 'A boat of crisp bread filled with spiced mince, sliced into strips.', snack: true },
      { icon: 'cheese', name: 'Kaşarlı yumurtalı pide', price: 280, text: 'Melted kaşar cheese and an egg, glossy with butter.', snack: true },
      { icon: 'milk', name: 'Ayran', price: 90, text: 'Frothy salted yoghurt in a copper cup.', snack: true },
    ],
  },
  borek: {
    label: 'Börek shop',
    names: [['Börekçi Saray', 'Börekçi'], ['Su Böreği Hatice', 'Su Böreği']],
    keepers: ['Saray Usta', 'Hatice Teyze'],
    keeperLook: LOOKS.baker,
    lines: [
      'Su böreği: the sheets of dough are boiled before they are layered. It takes all morning and it is gone by eleven.',
      'Peynirli, kıymalı, ıspanaklı. Cheese, mince or spinach. Or a little of each, like the locals.',
      'Börek and tea. That is breakfast. Anything else is decoration.',
    ],
    buy: [
      { icon: 'croissant', name: 'Su böreği', price: 160, text: 'Soft layers of boiled dough and white cheese, crisp at the edges.', snack: true },
      { icon: 'croissant', name: 'Kol böreği', price: 140, text: 'A coil of flaky pastry with spinach and feta.', snack: true },
      { icon: 'tea', name: 'Çay', price: 60, text: 'The other half of breakfast.', snack: true },
    ],
  },
  muhallebi: {
    label: 'Pudding shop',
    names: [['Muhallebici Sultan', 'Muhallebici'], ['Saray Muhallebicisi', 'Muhallebicisi']],
    keepers: ['Sultan Hanım', 'İsmail Bey'],
    keeperLook: LOOKS.white,
    lines: [
      'Tavuk göğsü is a milk pudding made with chicken breast. Yes, really. The palace cooks invented it and you cannot taste the chicken, only silk.',
      'Kazandibi means "bottom of the pot". We burn the pudding on purpose, then roll it up. The caramel is the best part.',
      'In the old days young couples came here to meet. Pudding was respectable. Cafés were not.',
    ],
    buy: [
      { icon: 'milk', name: 'Tavuk göğsü', price: 170, text: 'A silky milk pudding with a secret: shreds of chicken breast, dusted with cinnamon.', snack: true },
      { icon: 'rice', name: 'Fırın sütlaç', price: 150, text: 'Baked rice pudding with a burnished top, served cold.', snack: true },
      { icon: 'tart', name: 'Kazandibi', price: 170, text: 'Caramelised milk pudding from the bottom of the pan, rolled up.', snack: true },
    ],
  },
  lokum: {
    label: 'Lokum shop',
    names: [['Lokumcu Hacı Bekir', 'Lokumcu'], ['Lokum ve Şekerleme', 'Şekerleme']],
    keepers: ['Bekir Bey', 'Ayten Hanım'],
    keeperLook: LOOKS.bazaar,
    lines: [
      'Lokum means "a morsel for the throat". Starch, sugar and patience, stirred for hours in a copper pan.',
      'Rose, pistachio, double-roasted with hazelnuts. Taste first, buy after. That is the bazaar way.',
      'Two hundred years ago a confectioner on this street made the sultan\'s lokum. Now we make it for you.',
    ],
    buy: [
      { icon: 'sugar', name: 'Rose lokum', price: 120, text: 'Soft pink cubes in a cloud of icing sugar, scented with rosewater.', snack: true },
      { icon: 'sugar', name: 'Pistachio lokum', price: 160, text: 'Studded with green Antep pistachios. The one everyone takes home.' },
      { icon: 'honey', name: 'Akide candy', price: 90, text: 'Hard boiled sugar in a paper cone, the colours of a stained-glass window.' },
    ],
  },
  baharat: {
    label: 'Spice shop',
    names: [['Baharatçı Mısır', 'Baharatçı'], ['Aktar Yusuf', 'Aktar'], ['Kuruyemiş Ve Baharat', 'Kuruyemiş']],
    keepers: ['Mısır Bey', 'Yusuf Efendi', 'Selma Hanım'],
    keeperLook: LOOKS.bazaar,
    lines: [
      'This bazaar was paid for by the ships from Egypt, so people call it the Egyptian Bazaar. Spices came by sea from India, by camel from Persia.',
      'Pul biber, sumak, isot, kimyon. Smell this one. Urfa pepper, smoky like raisins and smoke.',
      'Saffron? Real saffron is red threads, never powder. If it is cheap, it is not saffron.',
      'Dried apricots, figs, mulberries. A handful is a lunch, my grandmother said.',
    ],
    buy: [
      { icon: 'chili', name: 'Pul biber', price: 140, text: 'A bag of red pepper flakes, sweet and gently hot. On everything.' },
      { icon: 'sprinkle', name: 'Sumac', price: 120, text: 'Dark red and lemony. Sprinkle it on onions and kebab.' },
      { icon: 'tea', name: 'Apple tea', price: 100, text: 'A tin of dried apple tea for home.' },
    ],
  },
  firin: {
    label: 'Bakery',
    names: [['Fırın Ekmek Evi', 'Fırın'], ['Tarihi Fırın', 'Tarihi Fırın']],
    keepers: ['Fırıncı Nuri', 'Ahmet Usta'],
    keeperLook: LOOKS.baker,
    lines: [
      'Bread twice a day, morning and afternoon. Istanbul will not eat yesterday\'s loaf.',
      'In the old city, people hang bread in a bag on a nail outside the bakery: "askıda ekmek", bread on the hook, for whoever cannot pay.',
      'Poğaça, açma, simit. Ask for them warm. We always have warm.',
    ],
    buy: [
      { icon: 'croissant', name: 'Poğaça', price: 70, text: 'A soft round bun with white cheese inside.', snack: true },
      { icon: 'toast', name: 'Açma', price: 70, text: 'A buttery ring of bread, softer than a simit.', snack: true },
      { icon: 'flour', name: 'Somun ekmek', price: 50, text: 'A crusty white loaf, still warm. Tear the end off on the way home.', snack: true },
    ],
  },
  balik: {
    label: 'Fish restaurant',
    names: [['Balıkçı Kenan', 'Balık Lokantası'], ['Haliç Balık', 'Haliç Balık']],
    keepers: ['Kenan Reis', 'Deniz'],
    keeperLook: LOOKS.sea,
    lines: [
      'Hamsi, the little Black Sea anchovy, comes in winter. Fried in corn flour, it is the city\'s favourite fish.',
      'Look at the eyes. Clear eyes, red gills, then it is fresh. Mine came off the boat this morning.',
      'The fish here pass through the Bosphorus twice a year, north to south and back. We just wait at the door.',
    ],
    buy: [
      { icon: 'fish', name: 'Hamsi tava', price: 320, text: 'A pan of fried anchovies fanned in a circle, with lemon and red onion.', snack: true },
      { icon: 'fish', name: 'Levrek ızgara', price: 480, text: 'Grilled sea bass with rocket and lemon.', snack: true },
      { icon: 'tomato', name: 'Çoban salatası', price: 120, text: 'Tomato, cucumber, onion and parsley, chopped small, with sumac.', snack: true },
    ],
  },
  hotel: { label: 'Hotel', names: [['Hotel', 'ホテル']], keepers: ['Receptionist'], keeperLook: {}, lines: [], buy: [] },
};

/** People sitting in cafés and bars have opinions, and the odd hint. */
const TOKYO_GUEST_LINES: string[] = [
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

const ISTANBUL_GUEST_LINES: string[] = [
  'Somebody ties little blue eyes in odd places around the bazaar. Nazar beads, against bad luck. I have seen one on the bridge too.',
  'Take the ferry to the Asian side at sunset. It costs less than a glass of tea and it is the best view in the world.',
  'The fishermen on the bridge catch tiny fish all day. Nobody knows what they do with them all.',
  'When the call to prayer starts, listen. One mosque begins, then another answers, and another, all over the hills.',
  'I have lived here sixty years and I still get lost in the Grand Bazaar. Sixty-four streets!',
  'Tea? Of course tea. Here we do not ask if you want tea, we ask how many sugars.',
  'Eat a balık ekmek by the boats. Then a pickle juice. Then thank me.',
  'My grandfather was a hamal, a porter. He carried a piano up the hill to Süleymaniye on his back.',
  'A cat sleeping on your chair? Sit somewhere else. That is the rule in Istanbul.',
  'Up the stairs behind the market there is a door with no sign. My aunt swears the best mantı in the city is behind it.',
];

export const GUEST_LINES: string[] = ISTANBUL ? ISTANBUL_GUEST_LINES : TOKYO_GUEST_LINES;

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
