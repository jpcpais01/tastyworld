import type { Dish } from './dishes';
import type { StallInfo, Ingredient } from './stalls';
import type { IconName } from '../ui/emblems';

/**
 * Tokyo's second menu: eleven of the district's own izakayas, cafés, soba shops and bakeries whose cooks now serve
 * passport dishes (see TOKYO_RESTAURANTS in world/tokyo.ts). Prices are real Tokyo prices of 2026, in yen.
 */

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

export const TOKYO_MORE_DISHES: Dish[] = [
  // ---- Oden Kotobuki
  {
    id: 'oden', name: 'Oden', jp: 'おでん', romaji: 'oden', stall: 'odenya', price: 650, dessert: false,
    tagline: 'Daikon, egg, fish cakes and konnyaku, simmered for hours in a clear dashi.',
    origin: 'Edo (old Tokyo), 1800s',
    history: 'Oden began as grilled tofu with miso (dengaku) and became a stew in Edo, where street carts kept a pot of dashi bubbling all night. Today every konbini has an oden case by the till each winter.',
    ingredients: ['Kombu and bonito dashi', 'Daikon radish', 'Boiled egg', 'Chikuwa and hanpen fish cakes', 'Konnyaku', 'Karashi mustard'],
    culture: 'You choose piece by piece from the square pot. The daikon, which drinks the broth all day, is what regulars point at first.',
    tip: 'A dab of yellow karashi on each piece. Not too much, it bites.',
    flavor: { sweet: 1, savory: 4, umami: 5, crunch: 0 },
  },
  {
    id: 'yakionigiri', name: 'Yaki Onigiri', jp: '焼きおにぎり', romaji: 'yaki onigiri', stall: 'odenya', price: 380, dessert: false,
    tagline: 'A rice ball grilled over charcoal and brushed with soy until it crackles.',
    origin: 'All of Japan',
    history: 'Rice balls are as old as Japanese travel. Grilling them and painting them with soy turns a humble lunch into the last dish of a night out, when the stomach wants rice.',
    ingredients: ['Short-grain rice', 'Soy sauce', 'Mirin', 'A little butter (sometimes)', 'Charcoal'],
    culture: 'At an izakaya, ordering yaki onigiri is the polite signal that you are nearly ready to go home.',
    tip: 'The crust on the bottom is the best part. Eat it while it still crunches.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 4 },
  },
  // ---- Tonkatsu Yamabuki
  {
    id: 'tonkatsu', name: 'Rōsu Katsu Teishoku', jp: 'とんかつ定食', romaji: 'tonkatsu teishoku', stall: 'katsu', price: 1900, dessert: false,
    tagline: 'A thick pork loin cutlet in a shattering panko crust, with a mountain of cabbage.',
    origin: 'Ginza, Tokyo, 1899',
    history: 'Rengatei in Ginza adapted the French côtelette for Japanese diners, and in 1929 a Tokyo cook fried a thick cut of pork in deep oil and called it tonkatsu. Tokyo still has temples of katsu where the oil is changed by the hour.',
    ingredients: ['Pork loin', 'Panko breadcrumbs', 'Egg and flour', 'Shredded cabbage', 'Tonkatsu sauce and sesame', 'Rice, miso soup, pickles'],
    culture: 'You grind your own sesame seeds in a little ridged bowl at the table and stir in the thick sauce. Cabbage and rice refills are free.',
    tip: 'Salt the first slice, sauce the second. Then decide.',
    flavor: { sweet: 2, savory: 5, umami: 4, crunch: 5 },
  },
  {
    id: 'katsusando', name: 'Katsu Sando', jp: 'カツサンド', romaji: 'katsu sando', stall: 'katsu', price: 950, dessert: false,
    tagline: 'A pork cutlet in sauce between pillowy crustless white bread.',
    origin: 'Ueno, Tokyo, 1930s',
    history: 'A Ueno katsu shop made sandwiches for the geisha of the neighbourhood, small enough not to smudge their lipstick. Shinkansen travellers now buy them by the box.',
    ingredients: ['Pork cutlet', 'Tonkatsu sauce', 'Karashi butter', 'Shokupan milk bread', 'Shredded cabbage'],
    culture: 'The edges are cut off cleanly so the cross-section shows. It is the perfect ekiben, the train lunch.',
    tip: 'Eat it cold. The sauce soaks into the bread and that is the point.',
    flavor: { sweet: 2, savory: 4, umami: 3, crunch: 3 },
  },
  // ---- Unagi Kawasemi
  {
    id: 'unadon', name: 'Unajū', jp: 'うな重', romaji: 'unajū', stall: 'unagi', price: 4800, dessert: false,
    tagline: 'Charcoal-grilled eel glazed with sweet tare over rice in a lacquered box.',
    origin: 'Edo (old Tokyo), 1800s',
    history: 'Edo-style eel is split down the back (samurai did not like the belly cut), steamed and then grilled, so it is softer than eel elsewhere. Some Tokyo shops have topped up the same tare for over two hundred years.',
    ingredients: ['Freshwater eel', 'Tare: soy, mirin, sugar, sake', 'Rice', 'Sanshō pepper', 'Kimosui (eel liver soup)'],
    culture: 'The Day of the Ox in midsummer is eel day. Tokyo queues outside the unagi shops to fight the heat.',
    tip: 'A pinch of sanshō pepper, then eat each mouthful with rice soaked in the tare.',
    flavor: { sweet: 3, savory: 4, umami: 5, crunch: 1 },
  },
  {
    id: 'umaki', name: 'Umaki', jp: 'う巻き', romaji: 'umaki', stall: 'unagi', price: 1200, dessert: false,
    tagline: 'A sweet rolled omelette with a strip of glazed eel in the middle.',
    origin: 'Edo (old Tokyo)',
    history: 'Unagi shops wrap the trimmings of their eel in dashi omelette, layer by layer in a square pan. It is eaten while the eel is being grilled, which can take thirty minutes.',
    ingredients: ['Eggs', 'Dashi', 'Glazed eel', 'Mirin and sugar', 'Grated daikon'],
    culture: 'At a good unagi shop the eel is only grilled when you order. The umaki is how they keep you happy while you wait.',
    tip: 'A little grated daikon with soy on each slice.',
    flavor: { sweet: 3, savory: 3, umami: 4, crunch: 0 },
  },
  // ---- Yōshoku Tsubame-tei
  {
    id: 'omurice', name: 'Omurice', jp: 'オムライス', romaji: 'omu-raisu', stall: 'yoshoku', price: 1300, dessert: false,
    tagline: 'Ketchup chicken rice wrapped in a soft omelette, sauced with demi-glace.',
    origin: 'Ginza, Tokyo, 1900s',
    history: 'Tokyo\'s yōshoku houses, "Western food" restaurants, invented dishes that the West never knew. Omurice was made for a regular with a weak stomach and became one of the most loved dishes in Japan.',
    ingredients: ['Rice fried with chicken and ketchup', 'Eggs', 'Butter', 'Demi-glace or ketchup', 'Parsley'],
    culture: 'In some shops the cook slices the omelette open at the table and it spills over the rice like a blanket.',
    tip: 'Ask for demi-glace. Ketchup is for children, the cook says, smiling.',
    flavor: { sweet: 3, savory: 4, umami: 4, crunch: 0 },
  },
  {
    id: 'hambagu', name: 'Hambāgu', jp: 'ハンバーグ', romaji: 'hanbāgu', stall: 'yoshoku', price: 1500, dessert: false,
    tagline: 'A juicy beef and pork patty on a sizzling iron plate, with a fried egg.',
    origin: 'Tokyo, 1950s',
    history: 'Hamburg steak arrived with German sailors and stayed. In postwar Tokyo it became every child\'s birthday dinner, served on a hot iron plate with demi-glace and a fried egg.',
    ingredients: ['Beef and pork mince', 'Onion and panko', 'Egg', 'Demi-glace', 'Corn, carrot and potatoes'],
    culture: 'The iron plate arrives spitting, with a paper bib for you. Cut the patty and the juices run out.',
    tip: 'Burst the egg yolk over the patty.',
    flavor: { sweet: 2, savory: 5, umami: 5, crunch: 1 },
  },
  // ---- Sukiyaki Matsukaze
  {
    id: 'sukiyaki', name: 'Sukiyaki', jp: 'すき焼き', romaji: 'suki-yaki', stall: 'sukiyaki', price: 5200, dessert: false,
    tagline: 'Marbled beef cooked at the table in a sweet soy broth, dipped in raw egg.',
    origin: 'Tokyo, 1870s',
    history: 'When Japan lifted its ban on eating beef in the 1870s, gyūnabe beef pots swept Tokyo, and the Asakusa houses that served them became sukiyaki restaurants. Some still have the same tatami rooms.',
    ingredients: ['Thin marbled beef', 'Warishita: soy, mirin, sugar', 'Tofu, negi, shiitake', 'Shirataki noodles', 'Raw egg for dipping'],
    culture: 'The nakai-san cooks the first slices for you in the iron pot, then leaves you to it.',
    tip: 'Dip each slice in the beaten egg. It cools it and makes it silk.',
    flavor: { sweet: 4, savory: 4, umami: 5, crunch: 0 },
  },
  {
    id: 'chawanmushi', name: 'Chawanmushi', jp: '茶碗蒸し', romaji: 'chawan-mushi', stall: 'sukiyaki', price: 700, dessert: false,
    tagline: 'A trembling egg custard steamed in a lidded cup, with shrimp and ginkgo inside.',
    origin: 'Nagasaki and Edo, 1700s',
    history: 'A savoury custard steamed in a tea cup, it came to Edo from the trading port of Nagasaki. Each spoonful finds something: a ginkgo nut, a shrimp, a slice of kamaboko.',
    ingredients: ['Eggs', 'Dashi', 'Shrimp and chicken', 'Ginkgo nut and shiitake', 'Mitsuba leaf'],
    culture: 'It comes with a wooden spoon and its own little lid. Lift the lid slowly to see the steam.',
    tip: 'Eat it hot, before the meat course. It settles the stomach.',
    flavor: { sweet: 1, savory: 3, umami: 4, crunch: 0 },
  },
  // ---- Kanmidokoro Hōzuki
  {
    id: 'anmitsu', name: 'Cream Anmitsu', jp: 'クリームあんみつ', romaji: 'kurīmu anmitsu', stall: 'kanmi', price: 950, dessert: true,
    tagline: 'Agar jelly cubes, red bean, fruit, mochi and soft-serve, with black sugar syrup.',
    origin: 'Ginza, Tokyo, 1930',
    history: 'A Ginza sweet shop added red bean paste to mitsumame, a bowl of agar jelly and beans, and called it anmitsu. Ice cream on top came later, and Asakusa\'s sweet shops have served it ever since.',
    ingredients: ['Kanten (agar) jelly', 'Red bean paste', 'Shiratama mochi', 'Fruit: mandarin, cherry', 'Kuromitsu syrup', 'Vanilla soft-serve'],
    culture: 'Kanmidokoro are Japanese sweet cafés. People sit and talk over anmitsu after shopping, especially on rainy days.',
    tip: 'Pour all the black syrup in. Do not be shy.',
    flavor: { sweet: 5, savory: 0, umami: 1, crunch: 0 },
  },
  {
    id: 'kakigori', name: 'Uji Kintoki Kakigōri', jp: '宇治金時かき氷', romaji: 'uji kintoki kakigōri', stall: 'kanmi', price: 1100, dessert: true,
    tagline: 'A tower of feathery shaved ice under matcha syrup, sweet red beans and condensed milk.',
    origin: 'Heian Japan, 1000s',
    history: 'Shaved ice with syrup is in The Pillow Book, a thousand years ago, when only nobles could afford ice from mountain stores. Today a flag with the kanji 氷 (ice) outside a shop means summer has started.',
    ingredients: ['Block ice, shaved fine', 'Matcha syrup', 'Azuki red beans', 'Condensed milk', 'Shiratama mochi'],
    culture: 'Good shops shave the ice by hand-cranked machine so it is light as snow. Eat fast or eat a puddle.',
    tip: 'Dig in from the side so the tower does not fall.',
    flavor: { sweet: 5, savory: 0, umami: 1, crunch: 1 },
  },
  // ---- Bakery Komugi
  {
    id: 'fruitsando', name: 'Fruit Sando', jp: 'フルーツサンド', romaji: 'furūtsu sando', stall: 'pan', price: 780, dessert: true,
    tagline: 'Whipped cream and whole strawberries, kiwi and mandarin in soft white bread, cut to show the flowers.',
    origin: 'Tokyo fruit parlours, 1920s',
    history: 'Tokyo\'s grand fruit parlours, where melons sell for the price of a dinner, put their fruit in sandwiches for ladies\' lunches. Bakeries now arrange the fruit so the cut reveals a flower.',
    ingredients: ['Shokupan milk bread', 'Lightly sweet whipped cream', 'Strawberries', 'Kiwi', 'Mandarin'],
    culture: 'A fruit sando is a gift as much as a snack. Its cross-section fills Tokyo phones every spring.',
    tip: 'Hold it upright. The cream escapes if you squeeze.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'kurimupan', name: 'Kurīmu Pan', jp: 'クリームパン', romaji: 'kurīmu pan', stall: 'pan', price: 280, dessert: true,
    tagline: 'A soft glove-shaped bun full of vanilla custard.',
    origin: 'Shinjuku, Tokyo, 1904',
    history: 'Nakamuraya bakery in Shinjuku tasted a cream puff and swapped the red bean in their buns for custard. The bun is pressed into a glove shape so the baker knows which one has cream.',
    ingredients: ['Sweet milk dough', 'Egg custard', 'Vanilla', 'Egg wash'],
    culture: 'Japanese bakeries are self-service: take a tray and tongs, pick, and pay. Kurīmu pan is always near the till.',
    tip: 'Warm from the oven is best. Check the little sign by the tray.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 0 },
  },
  // ---- Chaya Kaede
  {
    id: 'matcha', name: 'Matcha and Wagashi', jp: '抹茶と和菓子', romaji: 'maccha to wagashi', stall: 'chaya', price: 900, dessert: false, drink: 'hot',
    tagline: 'Whisked green tea in a rough bowl, with a seasonal sweet shaped like a flower.',
    origin: 'Kyoto and Edo, 1500s',
    history: 'Powdered tea came from China with Zen monks and Sen no Rikyū turned drinking it into the tea ceremony. In Edo, roadside tea houses (chaya) served a bowl to tired travellers.',
    ingredients: ['Matcha powder', 'Hot water (80°C)', 'A bamboo whisk', 'Nerikiri sweet: white bean paste and rice flour'],
    culture: 'Eat the sweet first, then turn the bowl twice so the pretty side faces away, and drink in three and a half sips.',
    tip: 'The last sip is slurped on purpose. It says it was good.',
    flavor: { sweet: 2, savory: 1, umami: 3, crunch: 0 },
  },
  {
    id: 'warabimochi', name: 'Warabi Mochi', jp: 'わらび餅', romaji: 'warabi mochi', stall: 'chaya', price: 750, dessert: true,
    tagline: 'Trembling bracken-starch jelly dusted in roasted soybean flour, with black syrup.',
    origin: 'Nara and Kyoto, 900s',
    history: 'Made from the starch of bracken roots, warabi mochi was a favourite of Emperor Daigo. Real bracken starch is now rare and costly, and the best shops still use it.',
    ingredients: ['Warabi (bracken) starch', 'Sugar and water', 'Kinako (roasted soybean flour)', 'Kuromitsu (black sugar syrup)'],
    culture: 'In summer, warabi mochi sellers once rang bells in the streets like ice-cream vans.',
    tip: 'Do not breathe in while eating. The kinako makes you cough.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 0 },
  },
  // ---- Sakaba Isaribi
  {
    id: 'sashimi', name: 'Sashimi Moriawase', jp: '刺身盛り合わせ', romaji: 'sashimi moriawase', stall: 'sakaba', price: 2200, dessert: false,
    tagline: 'Tuna, salmon, sea bream and scallop, sliced at the counter, on crushed ice and shiso.',
    origin: 'Edo (old Tokyo)',
    history: 'Edo had the fish of its own bay and Nihonbashi\'s market. Slicing raw fish (sashimi, "pierced body") into pieces at the right angle was a cook\'s first lesson, and still is.',
    ingredients: ['Maguro (tuna)', 'Salmon', 'Tai (sea bream)', 'Hotate (scallop)', 'Daikon threads, shiso, wasabi'],
    culture: 'An izakaya\'s sashimi plate shows off what came in that morning. Ask the master what is good today.',
    tip: 'Put the wasabi on the fish, not in the soy.',
    flavor: { sweet: 1, savory: 3, umami: 5, crunch: 1 },
  },
  {
    id: 'agedashi', name: 'Agedashi Tōfu', jp: '揚げ出し豆腐', romaji: 'agedashi tōfu', stall: 'sakaba', price: 580, dessert: false,
    tagline: 'Silken tofu fried in a light starch coat, sitting in hot dashi with grated daikon.',
    origin: 'Edo (old Tokyo), 1782',
    history: 'Tōfu Hyakuchin, "A Hundred Tofu Dishes", a bestselling cookbook of 1782, already has agedashi tofu. It is still on every izakaya menu.',
    ingredients: ['Silken tofu', 'Potato starch', 'Dashi, soy and mirin', 'Grated daikon and ginger', 'Spring onion and bonito'],
    culture: 'The bonito flakes on top dance in the heat when it arrives. Watch them before you eat.',
    tip: 'Eat it fast, while the crust is still crisp under the broth.',
    flavor: { sweet: 1, savory: 3, umami: 4, crunch: 2 },
  },
  // ---- Robata Kogarashi
  {
    id: 'sabashio', name: 'Saba Shioyaki', jp: '鯖の塩焼き', romaji: 'saba no shioyaki', stall: 'robata', price: 950, dessert: false,
    tagline: 'A salted mackerel fillet grilled over coals until the skin blisters.',
    origin: 'All of Japan',
    history: 'Salting and grilling is the oldest way of cooking fish in Japan. Under the railway arches of Tokyo the robata grills turn out mackerel to salarymen all evening.',
    ingredients: ['Mackerel', 'Salt', 'Grated daikon', 'Lemon or sudachi', 'A drop of soy'],
    culture: 'In a robatayaki the cook kneels behind a wide grill and passes your plate across on a long wooden paddle.',
    tip: 'Daikon and a squeeze of lemon on every bite.',
    flavor: { sweet: 0, savory: 4, umami: 4, crunch: 2 },
  },
  {
    id: 'nikujaga', name: 'Nikujaga', jp: '肉じゃが', romaji: 'niku-jaga', stall: 'robata', price: 650, dessert: false,
    tagline: 'Beef and potato simmered sweet and gentle in soy and dashi: Japan\'s mother\'s cooking.',
    origin: 'The Imperial Navy, 1890s',
    history: 'The story goes that a naval cook was asked to make British beef stew without wine or butter and used soy and sugar instead. Whatever the truth, it became the taste of home for every Japanese family.',
    ingredients: ['Thin beef', 'Potatoes', 'Onion and carrot', 'Shirataki noodles', 'Soy, mirin, sugar, dashi'],
    culture: 'Nikujaga is the dish people mean when they say "ofukuro no aji", the taste of mum\'s cooking.',
    tip: 'Break the potato with your chopsticks and let it drink the broth.',
    flavor: { sweet: 3, savory: 4, umami: 4, crunch: 0 },
  },
  // ---- Udon Kosuge
  {
    id: 'kitsune', name: 'Kitsune Udon', jp: 'きつねうどん', romaji: 'kitsune udon', stall: 'udon', price: 780, dessert: false,
    tagline: 'Thick chewy udon in hot dashi, under a big sweet fried tofu pouch.',
    origin: 'Osaka, 1893, loved in Tokyo',
    history: 'An Osaka udon cook put the sweet fried tofu he served on the side into the bowl. Foxes (kitsune) are said to love fried tofu, and the name stuck. Tokyo makes it with a darker soy broth.',
    ingredients: ['Wheat udon noodles', 'Dashi and soy broth', 'Aburaage tofu pouch in sweet soy', 'Kamaboko', 'Spring onion'],
    culture: 'Inari shrines are guarded by fox statues, and people leave fried tofu for them.',
    tip: 'Shichimi pepper from the table, and slurp.',
    flavor: { sweet: 3, savory: 4, umami: 4, crunch: 0 },
  },
  {
    id: 'curryudon', name: 'Karē Udon', jp: 'カレーうどん', romaji: 'karē udon', stall: 'udon', price: 980, dessert: false,
    tagline: 'Udon in a thick dashi curry with pork and onion. Wear the paper bib.',
    origin: 'Meguro, Tokyo, 1904',
    history: 'A Tokyo soba shop thickened its dashi with curry to win customers back from the new Western restaurants. It worked, and curry udon spread across Japan.',
    ingredients: ['Udon noodles', 'Dashi', 'Japanese curry roux', 'Pork and onion', 'Spring onion'],
    culture: 'Every udon shop hands out a paper bib with this one. Splashes are guaranteed.',
    tip: 'Slurp slowly, and wear the bib.',
    flavor: { sweet: 2, savory: 5, umami: 4, crunch: 0 },
  },
];

type Look = StallInfo['vendorLook'];
const izakayaLook = (hair: number, band: number): Look => ({ skin: 0xe0ac86, hair, hairStyle: 'short', top: 0x2b3346, topStyle: 'tee', accent: 0x2b3346, bottom: 0x2b3346, shoes: 0x2a2a2e, hat: 'headband', hatColor: band });

export const TOKYO_MORE_STALLS: StallInfo[] = [
  {
    id: 'odenya', name: 'Oden Kotobuki', jp: 'おでん 寿', street: 'Hikari Ginza Arcade', vendor: 'Okami Setsuko', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0xb9b6b0, hairStyle: 'bun', top: 0x5a4a6a, topStyle: 'apron', accent: 0xf2efe7, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Irasshai. The daikon has been in the pot since this morning. It is ready now.', 'Point at what you like. Karashi is on the counter.'],
    dishes: ['oden', 'yakionigiri'],
    recipe: {
      dish: 'oden',
      steps: [
        { kind: 'pick', title: 'Into the dashi pot', hint: 'Daikon, egg, fish cakes, konnyaku.', items: [I('Daikon', 'leek'), I('Boiled egg', 'egg'), I('Fish cake', 'chikuwa'), I('Kombu dashi', 'pot')], decoys: [I('Chocolate', 'chocolate'), I('Pineapple', 'pineapple'), I('Cheese', 'cheese')] },
        { kind: 'chop', title: 'Score the daikon', hint: 'Shallow cuts so it drinks the broth.', rounds: 4, speed: 1.0 },
        { kind: 'heat', title: 'Hold a gentle simmer', hint: 'Never a boil, or the broth clouds.', rounds: 2, speed: 1.0, label: 'Simmer' },
      ],
    },
  },
  {
    id: 'katsu', name: 'Tonkatsu Yamabuki', jp: 'とんかつ 山吹', street: 'Hikari Ginza Arcade', vendor: 'Master Ishida', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Irasshaimase. Rōsu or hire? The loin has the fat, the fat has the flavour.', 'Grind your sesame while it fries. Four minutes, no more.'],
    dishes: ['tonkatsu', 'katsusando'],
    recipe: {
      dish: 'tonkatsu',
      steps: [
        { kind: 'order', title: 'Bread the cutlet', hint: 'Flour, egg, then panko.', items: [I('Flour', 'flour'), I('Beaten egg', 'egg'), I('Panko', 'crumbs')] },
        { kind: 'heat', title: 'Deep fry', hint: 'Lift it out golden, not brown.', rounds: 2, speed: 1.3, label: 'Golden' },
        { kind: 'chop', title: 'Slice and serve', hint: 'Clean cuts across the cutlet.', rounds: 5, speed: 1.2 },
      ],
    },
  },
  {
    id: 'unagi', name: 'Unagi Kawasemi', jp: 'うなぎ 翡翠', street: 'Hikari Ginza Arcade', vendor: 'Master Kawai', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x8a8a8e, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'happi', accent: 0x23345e, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0x23345e },
    greeting: ['Welcome. The eel is grilled only when you order. Have an umaki while you wait.', 'This tare? My grandfather started it. We only ever add to it.'],
    dishes: ['unadon', 'umaki'],
    recipe: {
      dish: 'unadon',
      steps: [
        { kind: 'order', title: 'The Edo way', hint: 'Split, skewer, steam, grill.', items: [I('Split down the back', 'knife'), I('Skewer', 'skewer'), I('Steam', 'pot'), I('Grill on charcoal', 'fire')] },
        { kind: 'heat', title: 'Glaze in the tare', hint: 'Dip and grill, three times.', rounds: 3, speed: 1.2, label: 'Glossy' },
        { kind: 'pick', title: 'Finish it', hint: 'What goes on the box at the table?', items: [I('Sanshō pepper', 'sprinkle')], decoys: [I('Ketchup', 'sauce'), I('Mayonnaise', 'mayo'), I('Cheese', 'cheese')] },
      ],
    },
  },
  {
    id: 'yoshoku', name: 'Yōshoku Tsubame-tei', jp: '洋食 つばめ亭', street: 'Center-gai', vendor: 'Chef Morita', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0x3a2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Welcome to Tsubame-tei! Our demi-glace simmers for a week.', 'Omurice, cut open at the table. Watch closely now.'],
    dishes: ['omurice', 'hambagu'],
    recipe: {
      dish: 'omurice',
      steps: [
        { kind: 'pick', title: 'Chicken rice', hint: 'Rice, chicken, onion, ketchup.', items: [I('Rice', 'rice'), I('Chicken', 'chicken'), I('Onion', 'garlic'), I('Ketchup', 'sauce')], decoys: [I('Red bean', 'bean'), I('Seaweed', 'nori'), I('Natto', 'soy')] },
        { kind: 'mix', title: 'Beat the eggs', hint: 'Quick circles, three eggs.', rounds: 5 },
        { kind: 'heat', title: 'Set the omelette', hint: 'Soft and shiny inside.', rounds: 1, speed: 1.4, label: 'Soft' },
      ],
    },
  },
  {
    id: 'sukiyaki', name: 'Sukiyaki Matsukaze', jp: 'すき焼き 松風', street: 'Center-gai', vendor: 'Nakai Fumiko', restaurant: true,
    vendorLook: { skin: 0xf6d2b4, hair: 0x2a1d17, hairStyle: 'bun', top: 0x8a3a4a, topStyle: 'yukata', accent: 0xe8c86a, bottom: 0x8a3a4a, shoes: 0xf2efe7 },
    greeting: ['Yōkoso. Please, take off your shoes. I will cook the first slices for you.', 'Since Meiji, this room has smelled of sweet soy and beef.'],
    dishes: ['sukiyaki', 'chawanmushi'],
    recipe: {
      dish: 'sukiyaki',
      steps: [
        { kind: 'order', title: 'The Kantō way', hint: 'Fat, beef, warishita, vegetables.', items: [I('Melt beef fat', 'pot'), I('Lay the beef', 'pork'), I('Pour warishita', 'soy'), I('Tofu and negi', 'leek')] },
        { kind: 'heat', title: 'Just cooked', hint: 'Pink in the middle, pull it now.', rounds: 3, speed: 1.4, label: 'Pink' },
        { kind: 'mix', title: 'Beat the egg', hint: 'For dipping. Smooth and loose.', rounds: 4 },
      ],
    },
  },
  {
    id: 'kanmi', name: 'Kanmidokoro Hōzuki', jp: '甘味処 ほおずき', street: 'Sakura Canal', vendor: 'Mrs. Hayashi', restaurant: true,
    vendorLook: { skin: 0xf6d2b4, hair: 0xb9b6b0, hairStyle: 'bun', top: 0xd88a9a, topStyle: 'apron', accent: 0xf2efe7, bottom: 0x2f2f35, shoes: 0x2a2a2e, glasses: true },
    greeting: ['Welcome! Something sweet? The ice flags are up, so kakigōri season has begun.', 'Pour all the kuromitsu. Everybody saves some and then regrets it.'],
    dishes: ['anmitsu', 'kakigori'],
    recipe: {
      dish: 'kakigori',
      steps: [
        { kind: 'mix', title: 'Crank the ice shaver', hint: 'Steady turns, fine as snow.', rounds: 7 },
        { kind: 'order', title: 'Build the tower', hint: 'Ice, syrup, ice, beans, milk.', items: [I('Shaved ice', 'drop'), I('Matcha syrup', 'tea'), I('More ice', 'drop'), I('Red beans', 'bean'), I('Condensed milk', 'milk')] },
      ],
    },
  },
  {
    id: 'pan', name: 'Bakery Komugi', jp: 'ベーカリー 小麦', street: 'Kaminari Lane', vendor: 'Baker Aya', restaurant: true,
    vendorLook: { skin: 0xf6d2b4, hair: 0x5a3a2a, hairStyle: 'ponytail', top: 0xf7f4ee, topStyle: 'apron', accent: 0xa86a32, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf7f4ee },
    greeting: ['Irasshaimase! The kurīmu pan just came out. Take a tray and tongs!', 'The fruit sando? Cut it in half, see? A little flower.'],
    dishes: ['fruitsando', 'kurimupan'],
    recipe: {
      dish: 'fruitsando',
      steps: [
        { kind: 'mix', title: 'Whip the cream', hint: 'Until it holds a peak.', rounds: 6 },
        { kind: 'pick', title: 'The fruit', hint: 'Bright, whole and fresh.', items: [I('Strawberry', 'strawberry'), I('Mandarin', 'mango'), I('Kiwi', 'leek')], decoys: [I('Garlic', 'garlic'), I('Tuna', 'fish'), I('Soy sauce', 'soy')] },
        { kind: 'chop', title: 'Cut through the middle', hint: 'One clean stroke across.', rounds: 2, speed: 0.9 },
      ],
    },
  },
  {
    id: 'chaya', name: 'Chaya Kaede', jp: '茶屋 楓', street: 'Yanaka Lanes', vendor: 'Sensei Tomoe', restaurant: true,
    vendorLook: { skin: 0xf6d2b4, hair: 0x1d1a1c, hairStyle: 'bun', top: 0x3f6e5a, topStyle: 'yukata', accent: 0xe8d8b0, bottom: 0x3f6e5a, shoes: 0xf2efe7 },
    greeting: ['Welcome. Sit, rest your feet. The water is just at eighty degrees.', 'This sweet is a maple leaf for the autumn. Eat it before the tea.'],
    dishes: ['matcha', 'warabimochi'],
    recipe: {
      dish: 'matcha',
      steps: [
        { kind: 'order', title: 'Prepare the bowl', hint: 'Warm, dry, matcha, water.', items: [I('Warm the bowl', 'drop'), I('Wipe it dry', 'towel'), I('Two scoops of matcha', 'tea'), I('Hot water', 'pot')] },
        { kind: 'mix', title: 'Whisk in an M', hint: 'Fast, light strokes until it foams.', rounds: 8 },
      ],
    },
  },
  {
    id: 'sakaba', name: 'Sakaba Isaribi', jp: '酒場 漁火', street: 'Lantern Alley', vendor: 'Master Kondō', restaurant: true,
    vendorLook: izakayaLook(0x1d1a1c, 0xd8372b),
    greeting: ['Irasshai! What is good today? The tuna. Always ask me that.', 'Agedashi, fresh from the oil. Watch the bonito dance.'],
    dishes: ['sashimi', 'agedashi'],
    recipe: {
      dish: 'sashimi',
      steps: [
        { kind: 'chop', title: 'Slice the fish', hint: 'One long pull of the knife each time.', rounds: 6, speed: 1.3 },
        { kind: 'pick', title: 'Garnish the plate', hint: 'What goes with sashimi?', items: [I('Daikon threads', 'leek'), I('Shiso leaf', 'nori'), I('Wasabi', 'paste')], decoys: [I('Ketchup', 'sauce'), I('Chocolate', 'chocolate'), I('Mayonnaise', 'mayo')] },
      ],
    },
  },
  {
    id: 'robata', name: 'Robata Kogarashi', jp: '炉端 木枯らし', street: 'Under the Tracks', vendor: 'Master Gen', restaurant: true,
    vendorLook: izakayaLook(0x8a8a8e, 0xf2efe7),
    greeting: ['Yo! Sit, sit. The trains will rattle the glasses, nobody minds.', 'Mackerel tonight. And nikujaga, like your mother made.'],
    dishes: ['sabashio', 'nikujaga'],
    recipe: {
      dish: 'sabashio',
      steps: [
        { kind: 'pick', title: 'Season simply', hint: 'Only what the fish needs.', items: [I('Salt', 'sugar'), I('Mackerel', 'fish')], decoys: [I('Honey', 'honey'), I('Curry', 'sauce'), I('Cheese', 'cheese')] },
        { kind: 'flip', title: 'Over the coals', hint: 'Turn each fillet when the skin blisters.', rounds: 4 },
        { kind: 'chop', title: 'Grate the daikon', hint: 'Steady strokes.', rounds: 4, speed: 1.0 },
      ],
    },
  },
  {
    id: 'udon', name: 'Udon Kosuge', jp: 'うどん 小菅', street: 'Hikari-dori', vendor: 'Kosuge-san', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'short', top: 0xf2efe7, topStyle: 'happi', accent: 0x2c6a4a, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0x2c6a4a },
    greeting: ['Irasshai! Noodles made this morning, by foot. Yes, we knead with our feet.', 'Curry udon? Here is your bib.'],
    dishes: ['kitsune', 'curryudon'],
    recipe: {
      dish: 'kitsune',
      steps: [
        { kind: 'mix', title: 'Knead the dough', hint: 'Fold and press. Udon needs muscle.', rounds: 7 },
        { kind: 'chop', title: 'Cut the noodles', hint: 'Thick, even strands.', rounds: 6, speed: 1.2 },
        { kind: 'order', title: 'Build the bowl', hint: 'Noodles, broth, tofu, onion.', items: [I('Boiled udon', 'pot'), I('Hot dashi', 'drop'), I('Sweet fried tofu', 'bean'), I('Spring onion', 'leek')] },
      ],
    },
  },
];
