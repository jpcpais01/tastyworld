import type { FoodId } from '../world/food';

export interface Dish {
  id: FoodId;
  name: string;
  jp: string;
  romaji: string;
  stall: string;
  price: number;
  dessert: boolean;
  tagline: string;
  origin: string;
  history: string;
  ingredients: string[];
  culture: string;
  tip: string;
  flavor: { sweet: number; savory: number; umami: number; crunch: number };
}

export const DISHES: Dish[] = [
  {
    id: 'takoyaki', name: 'Takoyaki', jp: 'たこ焼き', romaji: 'tako-yaki', stall: 'hachi', price: 600, dessert: false,
    tagline: 'Molten octopus dumplings, flipped by hand.',
    origin: 'Osaka, 1935',
    history: 'Street vendor Tomekichi Endō refined a beef-filled snack called rajio-yaki into the octopus version that swept Japan. Tokyo festivals adopted it so completely that a summer matsuri without a takoyaki stall feels unfinished.',
    ingredients: ['Dashi-thinned wheat batter', 'Boiled octopus', 'Tenkasu (tempura crumbs)', 'Pickled red ginger', 'Green onion'],
    culture: 'Cooks turn each ball with a pair of picks in a cast-iron pan full of half-spheres. The quarter turns are a performance, and crowds gather to watch.',
    tip: 'Let it cool for a breath. The centre stays lava-hot long after the outside is golden.',
    flavor: { sweet: 2, savory: 4, umami: 5, crunch: 2 },
  },
  {
    id: 'monjayaki', name: 'Monjayaki', jp: 'もんじゃ焼き', romaji: 'monja-yaki', stall: 'hachi', price: 900, dessert: false,
    tagline: "Tokyo's gooey griddle classic, eaten off tiny spatulas.",
    origin: 'Tsukishima, Tokyo, Meiji era',
    history: 'Children once wrote letters (moji) on hot griddles with runny batter as a cheap treat, called moji-yaki. It grew into monja, and Tsukishima now has a whole street of more than seventy monja shops.',
    ingredients: ['Very thin flour and dashi batter', 'Shredded cabbage', 'Mentaiko (spicy cod roe)', 'Mochi and cheese', 'Worcestershire sauce'],
    culture: 'The cabbage is built into a ring, the batter is poured into the middle, and everyone eats straight from the griddle with a hera, a spatula the size of a teaspoon.',
    tip: 'Press it flat and wait for the crispy layer. That scorched edge, the okoge, is the prize.',
    flavor: { sweet: 1, savory: 5, umami: 4, crunch: 3 },
  },
  {
    id: 'ningyoyaki', name: 'Ningyō-yaki', jp: '人形焼', romaji: 'ningyō-yaki', stall: 'kimura', price: 500, dessert: true,
    tagline: 'Little sponge cakes shaped like lanterns and pagodas.',
    origin: 'Ningyōchō, Tokyo, Meiji era',
    history: 'Born in the doll-makers\' district of Ningyōchō, these cakes moved to Asakusa where bakers pressed them into the shapes of the temple\'s landmarks: the thunder-gate lantern, the five-storey pagoda and the pigeons of the temple yard.',
    ingredients: ['Castella-style batter', 'Egg and honey', 'Sugar', 'Smooth red bean paste (koshi-an)'],
    culture: 'Watching the bakers through the shop window is part of the treat. Iron moulds clamp shut over the batter, flip, and open to reveal a row of tiny golden landmarks.',
    tip: 'Buy them warm and eat one on the spot. The rest travel well as omiyage for friends back home.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 1 },
  },
  {
    id: 'dango', name: 'Mitarashi Dango', jp: 'みたらし団子', romaji: 'mitarashi dango', stall: 'kimura', price: 350, dessert: true,
    tagline: 'Chewy rice dumplings in a glossy soy-caramel glaze.',
    origin: 'Kyoto, Shimogamo Shrine',
    history: 'Legend says the dumplings imitate bubbles rising from the shrine\'s Mitarashi purification pond. The sweet-and-salty glaze turned them into the most loved dango in Japan, Tokyo included.',
    ingredients: ['Joshinko rice flour', 'Shiratamako', 'Soy sauce', 'Sugar', 'Kuzu starch'],
    culture: 'The proverb "hana yori dango", dumplings over flowers, teases people who come to cherry-blossom picnics more for the snacks than for the blossoms.',
    tip: 'Eat them from the top down, and mind the glaze. It runs.',
    flavor: { sweet: 4, savory: 2, umami: 2, crunch: 0 },
  },
  {
    id: 'taiyaki', name: 'Taiyaki', jp: 'たい焼き', romaji: 'tai-yaki', stall: 'sakuraya', price: 300, dessert: true,
    tagline: 'A golden fish-shaped waffle stuffed with red bean.',
    origin: 'Azabu-Jūban, Tokyo, 1909',
    history: 'Naniwaya Sōhonten first cast the batter in the shape of a sea bream, or tai, a fish so expensive it was reserved for celebrations. The shop still makes them one by one in single moulds, a style fans call "tennen" (wild-caught).',
    ingredients: ['Wheat batter', 'Tsubu-an (chunky red bean)', 'Sugar', 'Baking soda'],
    culture: 'Tai rhymes with medetai, meaning auspicious, so even a humble snack carries a wish for good fortune. Everyone has an opinion on whether to eat the head or the tail first.',
    tip: 'Head first means the hot filling hits immediately. Tail first saves the best for last.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 3 },
  },
  {
    id: 'dorayaki', name: 'Dorayaki', jp: 'どら焼き', romaji: 'dora-yaki', stall: 'sakuraya', price: 350, dessert: true,
    tagline: 'Honey pancakes hugging a cloud of red bean.',
    origin: 'Ueno, Tokyo, 1914',
    history: 'The name means "gong cake". One story says the warrior-monk Benkei left his gong (dora) at a farmhouse, and the family cooked pancakes on it. Usagiya in Ueno created the two-pancake sandwich still copied today.',
    ingredients: ['Honey and egg pancake batter', 'Mirin', 'Tsubu-an red bean paste'],
    culture: 'Generations of children know dorayaki as Doraemon\'s favourite food. The robot cat will do almost anything for one.',
    tip: 'Pair it with a cup of hot green tea. The bitterness makes the honey sing.',
    flavor: { sweet: 5, savory: 0, umami: 1, crunch: 0 },
  },
  {
    id: 'yakitori', name: 'Yakitori', jp: '焼き鳥', romaji: 'yaki-tori', stall: 'torikichi', price: 700, dessert: false,
    tagline: 'Charcoal-grilled chicken skewers, glazed with tare.',
    origin: 'Tokyo, Meiji era onwards',
    history: 'Yakitori became the soul of Tokyo\'s postwar yokochō, tiny alleys where returning workers squeezed onto stools beside smoking grills. Many of those lanes, lantern-lit and only a few metres wide, still stand by the big stations.',
    ingredients: ['Chicken thigh', 'Negi (Japanese leek)', 'Tare: soy, mirin, sake, sugar', 'Binchōtan charcoal'],
    culture: 'Order by the skewer: negima (thigh and leek), tsukune (meatball), kawa (crispy skin). Choose tare for sweet and glossy or shio for salt that lets the charcoal speak. Some tare pots have been topped up for decades.',
    tip: 'A dash of shichimi pepper wakes up the tare.',
    flavor: { sweet: 2, savory: 5, umami: 4, crunch: 2 },
  },
  {
    id: 'karaage', name: 'Karaage', jp: '唐揚げ', romaji: 'kara-age', stall: 'torikichi', price: 600, dessert: false,
    tagline: 'Ginger-garlic fried chicken with a shattering crust.',
    origin: 'Tokyo, 1930s',
    history: 'The "kara" nods to Tang-dynasty China and the frying techniques that arrived from the continent. A Tokyo restaurant, Mikasa Kaikan, is credited with putting chicken karaage on the menu, and it has been Japan\'s favourite bentō filler ever since.',
    ingredients: ['Chicken thigh', 'Soy sauce', 'Ginger and garlic', 'Sake', 'Potato starch'],
    culture: 'Karaage is festival food, izakaya food, convenience-store food and home food. Every family swears by its own marinade.',
    tip: 'Squeeze the lemon only if your table agrees. Lemon on shared karaage is a famous debate.',
    flavor: { sweet: 1, savory: 5, umami: 4, crunch: 5 },
  },
  {
    id: 'ramen', name: 'Tokyo Shōyu Ramen', jp: '東京醤油ラーメン', romaji: 'shōyu rāmen', stall: 'hoshi', price: 950, dessert: false,
    tagline: 'Clear soy broth, springy curly noodles, pure comfort.',
    origin: 'Asakusa, Tokyo, 1910',
    history: 'Rairaiken opened in Asakusa with Chinese cooks serving Japanese customers and is often called Japan\'s first ramen shop. Its clear chicken-and-soy broth became the template for Tokyo-style ramen.',
    ingredients: ['Chicken and dashi broth', 'Shōyu tare', 'Curly wheat noodles', 'Chāshū pork', 'Menma, naruto, nori, scallion'],
    culture: 'Slurping is not rude here. It cools the noodles, carries the aroma and tells the chef you love it. Solo diners at the counter are completely normal.',
    tip: 'Taste the broth first, before anything else. That is where the chef\'s work lives.',
    flavor: { sweet: 1, savory: 5, umami: 5, crunch: 1 },
  },
  {
    id: 'gyoza', name: 'Yaki Gyōza', jp: '焼き餃子', romaji: 'yaki gyōza', stall: 'hoshi', price: 500, dessert: false,
    tagline: 'Pan-fried dumplings joined by a lacy crisp "wing".',
    origin: 'Postwar Japan, from Manchuria',
    history: 'Soldiers and settlers returning from northeast China after 1945 brought dumplings home. Japanese cooks pan-fried rather than boiled them, and a ramen shop without gyōza became unthinkable.',
    ingredients: ['Thin wheat wrappers', 'Ground pork', 'Cabbage and nira (garlic chives)', 'Garlic and ginger', 'Starch slurry for the wing'],
    culture: 'Utsunomiya and Hamamatsu compete every year for the title of Japan\'s gyōza capital, judged by how much the citizens eat.',
    tip: 'Dip in soy, vinegar and a drop of chilli oil. Mix your own ratio.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 4 },
  },
  {
    id: 'nigiri', name: 'Edomae Nigiri', jp: '江戸前寿司', romaji: 'edomae zushi', stall: 'kakurega', price: 2400, dessert: false,
    tagline: 'The original Tokyo fast food, perfected over two centuries.',
    origin: 'Edo (old Tokyo), 1820s',
    history: 'Hanaya Yohei is credited with pressing fish onto vinegared rice for customers in a hurry at street stalls near Edo Bay. Without refrigeration, fish was cured: kohada in vinegar, tuna marinated in soy (zuke), shrimp poached. Those techniques define Edomae sushi.',
    ingredients: ['Shari: vinegared rice', 'Akami (lean tuna), soy-marinated', 'Kohada (gizzard shad), vinegar-cured', 'Kuruma ebi (prawn)', 'Ikura and tamago'],
    culture: 'At an omakase counter the chef chooses for you, piece by piece, each brushed with exactly the right amount of nikiri soy. It is polite to eat each piece right away, by hand if you like.',
    tip: 'If the chef has already brushed on soy, skip the dish of soy sauce entirely.',
    flavor: { sweet: 1, savory: 3, umami: 5, crunch: 0 },
  },
  {
    id: 'tamagoyaki', name: 'Tamagoyaki', jp: '玉子焼き', romaji: 'tamago-yaki', stall: 'kakurega', price: 800, dessert: false,
    tagline: 'A sweet, layered omelette rolled in a square pan.',
    origin: 'Edo (old Tokyo)',
    history: 'Edo-style tamago is sweetened and enriched with dashi, cooked layer on layer in a rectangular makiyakinabe. Some sushi masters fold in ground shrimp so the finished block tastes almost like a soufflé cake.',
    ingredients: ['Eggs', 'Dashi', 'Sugar and mirin', 'A little light soy sauce'],
    culture: 'An old saying goes that you can judge a sushi shop by its tamago. Apprentices can spend years before they are trusted to make it.',
    tip: 'Eat it last, like dessert, to finish the meal on a soft and sweet note.',
    flavor: { sweet: 3, savory: 2, umami: 3, crunch: 0 },
  },
];

export const DISH = Object.fromEntries(DISHES.map((d) => [d.id, d])) as Record<FoodId, Dish>;
