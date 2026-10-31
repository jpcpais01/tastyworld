import type { IconName } from '../ui/emblems';
import type { FoodId } from '../world/food';
import type { Look } from '../world/characters';
import { AMALFI, ISTANBUL } from '../world/cityId';

export type StepKind = 'pick' | 'mix' | 'heat' | 'chop' | 'order' | 'flip';

export interface Ingredient { name: string; icon: IconName; }

export interface Step {
  kind: StepKind;
  title: string;
  hint: string;
  /** pick: correct ingredients plus decoys; order: the correct sequence. */
  items?: Ingredient[];
  decoys?: Ingredient[];
  /** heat: rounds and needle speed; chop: number of cuts; mix: turns. */
  rounds?: number;
  speed?: number;
  label?: string;
}

export interface Recipe { dish: FoodId; steps: Step[]; }

export interface StallInfo {
  id: string;
  name: string;
  jp: string;
  street: string;
  vendor: string;
  vendorLook: Look;
  greeting: string[];
  dishes: FoodId[];
  recipe: Recipe;
  hidden?: boolean;
  /** Sit-down restaurant inside a building rather than a street stall. */
  restaurant?: boolean;
}

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

const TOKYO_STALLS: StallInfo[] = [
  {
    id: 'kimura', name: 'Kimura Ningyō-yaki', jp: '木村家 人形焼', street: 'Kaminari Lane', vendor: 'Kimura-san',
    vendorLook: { skin: 0xeec39f, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf2efe7, topStyle: 'apron', accent: 0x23345e, bottom: 0x3a3a40, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0xd8372b },
    greeting: ['Irasshaimase! Our moulds have been in the family for four generations.', 'Fresh from the iron! Try the pagoda one, it is the crowd favourite.'],
    dishes: ['ningyoyaki', 'dango'],
    recipe: {
      dish: 'ningyoyaki',
      steps: [
        { kind: 'pick', title: 'Gather the batter', hint: 'Choose the four batter ingredients and the filling.', items: [I('Flour', 'flour'), I('Egg', 'egg'), I('Honey', 'honey'), I('Sugar', 'sugar'), I('Red bean', 'bean')], decoys: [I('Wasabi', 'paste'), I('Soy sauce', 'soy'), I('Garlic', 'garlic')] },
        { kind: 'mix', title: 'Whisk until silky', hint: 'Draw circles in the bowl. Smooth and steady.', rounds: 6 },
        { kind: 'heat', title: 'Bake in the iron mould', hint: 'Stop the needle in the golden zone. Three moulds.', rounds: 3, speed: 1.1, label: 'Golden' },
      ],
    },
  },
  {
    id: 'sakuraya', name: 'Sakura-ya Taiyaki', jp: 'さくら屋 たい焼き', street: 'Kaminari Lane', vendor: 'Haruka',
    vendorLook: { skin: 0xf6d2b4, hair: 0x2a1d17, hairStyle: 'ponytail', top: 0x3f6e9a, topStyle: 'happi', accent: 0x2b5aa8, bottom: 0x2f2f35, shoes: 0xf2efe7, hat: 'headband', hatColor: 0xf2efe7 },
    greeting: ['Welcome! Tai means sea bream, and sea bream means good luck.', 'Head or tail first? Everyone has a strong opinion here!'],
    dishes: ['taiyaki', 'dorayaki'],
    recipe: {
      dish: 'taiyaki',
      steps: [
        { kind: 'mix', title: 'Make the batter', hint: 'Circle the whisk to mix flour, egg and milk.', rounds: 5 },
        { kind: 'order', title: 'Fill the fish mould', hint: 'Tap the steps in the right order.', items: [I('Pour batter', 'mixbowl'), I('Add red bean', 'bean'), I('Top with batter', 'mixbowl'), I('Close the mould', 'fish')] },
        { kind: 'heat', title: 'Toast both sides', hint: 'Flip when the fish is crisp and golden.', rounds: 2, speed: 1.3, label: 'Crisp' },
      ],
    },
  },
  {
    id: 'torikichi', name: 'Torikichi Yakitori', jp: '鳥吉 焼き鳥', street: 'Lantern Alley', vendor: 'Taishō Goro',
    vendorLook: { skin: 0xe0ac86, hair: 0x1d1a1c, hairStyle: 'spiky', top: 0xf2efe7, topStyle: 'tee', accent: 0xf2efe7, bottom: 0x2b3a62, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0x23345e, glasses: false },
    greeting: ['Oi, sit, sit! The tare pot has been bubbling since 1962.', 'Negima? Tsukune? You look like a tare person to me.'],
    dishes: ['yakitori', 'karaage'],
    recipe: {
      dish: 'yakitori',
      steps: [
        { kind: 'chop', title: 'Cut the chicken', hint: 'Tap when the knife is over each line.', rounds: 4, speed: 1.0 },
        { kind: 'order', title: 'Thread the negima', hint: 'Alternate chicken and leek on the skewer.', items: [I('Chicken', 'chicken'), I('Leek', 'leek'), I('Chicken', 'chicken'), I('Leek', 'leek')] },
        { kind: 'heat', title: 'Grill over binchōtan', hint: 'Turn the skewer at the perfect char. Twice.', rounds: 2, speed: 1.5, label: 'Charred' },
        { kind: 'pick', title: 'Glaze it', hint: 'Pick the ingredients of a classic tare.', items: [I('Soy sauce', 'soy'), I('Mirin', 'sake'), I('Sugar', 'sugar')], decoys: [I('Ketchup', 'tomato'), I('Milk', 'milk'), I('Chocolate', 'chocolate')] },
      ],
    },
  },
  {
    id: 'hoshi', name: 'Ramen Hoshi', jp: 'らーめん 星', street: 'Lantern Alley', vendor: 'Master Hoshino',
    vendorLook: { skin: 0xeec39f, hair: 0x2a1d17, hairStyle: 'short', top: 0x2f2f35, topStyle: 'tee', accent: 0x2f2f35, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0xc8372d },
    greeting: ['Shōyu, the Tokyo way. Clear soup, curly noodles, nothing to hide.', 'Slurp loudly, please. It is the best review you can give me.'],
    dishes: ['ramen', 'gyoza'],
    recipe: {
      dish: 'ramen',
      steps: [
        { kind: 'heat', title: 'Boil the noodles', hint: 'Lift them at the springy, al dente moment.', rounds: 1, speed: 1.6, label: 'Springy' },
        { kind: 'order', title: 'Build the bowl', hint: 'Tap in the order a ramen master would.', items: [I('Shōyu tare', 'soy'), I('Hot broth', 'pot'), I('Noodles', 'ramen'), I('Toppings', 'egg')] },
        { kind: 'pick', title: 'Choose the toppings', hint: 'Classic Tokyo shōyu toppings only.', items: [I('Chāshū', 'pork'), I('Ajitama egg', 'egg'), I('Menma', 'bamboo'), I('Naruto', 'naruto'), I('Nori', 'nori')], decoys: [I('Pineapple', 'pineapple'), I('Cheese', 'cheese'), I('Ketchup', 'tomato')] },
      ],
    },
  },
  {
    id: 'hachi', name: 'Teppan Yatai Hachi', jp: '鉄板屋台 八', street: 'Sakura Canal', vendor: 'Hachi-chan',
    vendorLook: { skin: 0xf9dcc4, hair: 0x5a3b26, hairStyle: 'bob', top: 0xd9534a, topStyle: 'happi', accent: 0xc8372d, bottom: 0x2b3a62, shoes: 0xc9463d, hat: 'headband', hatColor: 0xf2efe7 },
    greeting: ['Hai, hai! Takoyaki fresh off the iron, monja for the brave!', 'Watch the flip, that is the whole show!'],
    dishes: ['takoyaki', 'monjayaki'],
    recipe: {
      dish: 'takoyaki',
      steps: [
        { kind: 'pick', title: 'Prep the batter', hint: 'Choose what goes inside a takoyaki.', items: [I('Batter', 'mixbowl'), I('Octopus', 'octopus'), I('Tenkasu', 'crumbs'), I('Green onion', 'leek'), I('Red ginger', 'ginger')], decoys: [I('Banana', 'banana'), I('Chocolate', 'chocolate'), I('Strawberry', 'strawberry')] },
        { kind: 'flip', title: 'Flip the takoyaki', hint: 'Tap each ball when it turns golden. Not raw, not burnt!', rounds: 9 },
        { kind: 'order', title: 'Dress them up', hint: 'Sauce, mayo, aonori, then dancing bonito flakes.', items: [I('Takoyaki sauce', 'sauce'), I('Mayonnaise', 'mayo'), I('Aonori', 'sprinkle'), I('Katsuobushi', 'bonito')] },
      ],
    },
  },
  {
    id: 'kakurega', name: 'Kakurega', jp: '隠れ家', street: 'Nameless Passage', vendor: 'Chef Sato', hidden: true,
    vendorLook: { skin: 0xeec39f, hair: 0x6b6b70, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x2b3346, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0xf4f1ea },
    greeting: ['...So the lucky cats led you here. Welcome to Kakurega. Eight seats, no sign, no menu.', 'Omakase tonight. Please, sit.'],
    dishes: ['nigiri', 'tamagoyaki'],
    recipe: {
      dish: 'tamagoyaki',
      steps: [
        { kind: 'mix', title: 'Beat eggs with dashi', hint: 'Gentle circles, do not whip in air.', rounds: 5 },
        { kind: 'heat', title: 'Cook the thin layers', hint: 'Roll each layer just before it sets.', rounds: 3, speed: 1.4, label: 'Just set' },
        { kind: 'chop', title: 'Slice the block', hint: 'Even slices, the master is watching.', rounds: 4, speed: 1.2 },
      ],
    },
  },
  {
    id: 'komorebi', name: 'Kissa Komorebi', jp: '喫茶 木漏れ日', street: 'Sakura Canal', vendor: 'Master Kuroda', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x3a2418, bottom: 0x2f2f35, shoes: 0x2a2a2e, glasses: true },
    greeting: ['Welcome. Sit anywhere you like. The siphon coffee takes a moment, the purin takes all morning.', 'Same recipe since 1971. The jukebox only plays Shōwa songs, I am afraid.'],
    dishes: ['purin', 'napolitan'],
    recipe: {
      dish: 'purin',
      steps: [
        { kind: 'heat', title: 'Make the caramel', hint: 'Stop when the sugar turns deep amber, not black.', rounds: 1, speed: 1.2, label: 'Amber' },
        { kind: 'pick', title: 'Mix the custard', hint: 'Pick what goes into a kissaten purin.', items: [I('Eggs', 'egg'), I('Milk', 'milk'), I('Sugar', 'sugar'), I('Vanilla', 'vanilla')], decoys: [I('Soy sauce', 'soy'), I('Miso', 'miso'), I('Ketchup', 'tomato')] },
        { kind: 'mix', title: 'Stir gently', hint: 'Slow circles. Bubbles make holes in the custard.', rounds: 4 },
        { kind: 'heat', title: 'Steam until set', hint: 'Firm in the middle, glossy on top. Twice.', rounds: 2, speed: 1.0, label: 'Set' },
      ],
    },
  },
  {
    id: 'kikyo', name: 'Soba-dokoro Kikyō', jp: 'そば処 桔梗', street: 'Kaminari Lane', vendor: 'Fujita-san', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'short', top: 0x2c3d73, topStyle: 'happi', accent: 0xf2efe7, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'headband', hatColor: 0xf2efe7 },
    greeting: ['Irasshai! The noodles are cut by hand every morning in the front window.', 'Cold soba on a hot day, hot soba on a cold day. Either way, slurp!'],
    dishes: ['zarusoba', 'tempura'],
    recipe: {
      dish: 'zarusoba',
      steps: [
        { kind: 'pick', title: 'Measure the flour', hint: 'Classic ni-hachi soba: eight parts buckwheat, two parts wheat.', items: [I('Buckwheat flour', 'flour'), I('Wheat flour', 'flour'), I('Cold water', 'drop')], decoys: [I('Rice flour', 'rice'), I('Milk', 'milk'), I('Sugar', 'sugar')] },
        { kind: 'mix', title: 'Knead the dough', hint: 'Work it in circles until it is smooth as a pebble.', rounds: 6 },
        { kind: 'chop', title: 'Cut the noodles', hint: 'Thin, even strands. Tap as the knife crosses each line.', rounds: 5, speed: 1.3 },
        { kind: 'heat', title: 'Boil and rinse', hint: 'Just a minute! Lift them while they still have bite.', rounds: 1, speed: 1.7, label: 'Bite' },
      ],
    },
  },
];

/** Amalfi's vendors (`jp` holds the Italian sign). */
const AMALFI_STALLS: StallInfo[] = [
  {
    id: 'pansa', name: 'Pasticceria Santa Rosa', jp: 'Pasticceria', street: 'Piazza Duomo', vendor: 'Signora Lucia',
    vendorLook: { skin: 0xe8b894, hair: 0x2a1d17, hairStyle: 'bun', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f63a8, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Buongiorno! Sfogliatelle straight from the oven. Listen to them crackle.', 'My grandmother made these for the bishop himself. Prego, prego!'],
    dishes: ['sfogliatella', 'delizia'],
    recipe: {
      dish: 'sfogliatella',
      steps: [
        { kind: 'pick', title: 'Make the filling', hint: 'Pick what goes inside a sfogliatella.', items: [I('Ricotta', 'cheese'), I('Semolina', 'flour'), I('Sugar', 'sugar'), I('Candied peel', 'sprinkle'), I('Egg', 'egg')], decoys: [I('Soy sauce', 'soy'), I('Garlic', 'garlic'), I('Tomato', 'tomato')] },
        { kind: 'order', title: 'Shape the shell', hint: 'Stretch, roll, slice, then push each slice into a cone.', items: [I('Stretch the dough', 'flour'), I('Roll the log', 'mixbowl'), I('Slice', 'knife'), I('Fill the cone', 'cheese')] },
        { kind: 'heat', title: 'Bake until it crackles', hint: 'Stop the needle in the golden zone.', rounds: 2, speed: 1.2, label: 'Golden' },
      ],
    },
  },
  {
    id: 'cuoppo', name: 'Friggitoria del Porto', jp: 'Friggitoria', street: 'The Harbour', vendor: 'Gennaro',
    vendorLook: { skin: 0xc98f6a, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'tee', accent: 0x2f63a8, bottom: 0x2b3a62, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2f63a8 },
    greeting: ['Uè! The boats came in at six. Everything you see swam this morning.', 'A cuoppo? Calamari, gamberi, alici. And lemon, always lemon.'],
    dishes: ['cuoppo', 'frittatina'],
    recipe: {
      dish: 'cuoppo',
      steps: [
        { kind: 'chop', title: 'Slice the calamari', hint: 'Tap when the knife is over each line.', rounds: 4, speed: 1.1 },
        { kind: 'pick', title: 'Into the cone', hint: 'Only the catch of the day goes in.', items: [I('Calamari', 'squid'), I('Prawns', 'shrimp'), I('Anchovies', 'fish'), I('Lemon', 'drop')], decoys: [I('Chocolate', 'chocolate'), I('Pineapple', 'pineapple'), I('Red bean', 'bean')] },
        { kind: 'heat', title: 'Fry in hot oil', hint: 'Lift the basket when it turns golden. Twice.', rounds: 2, speed: 1.5, label: 'Crisp' },
      ],
    },
  },
  {
    id: 'portafoglio', name: "Pizzeria 'O Vicolo", jp: 'Pizzeria', street: "Via Lorenzo d'Amalfi", vendor: 'Salvatore',
    vendorLook: { skin: 0xe0ac86, hair: 0x3b2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'tee', accent: 0xc8321e, bottom: 0x3a3a40, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Pizza a portafoglio! Folded like a wallet, easier on the wallet too.', 'Forty-eight hours of rise. You can taste the patience.'],
    dishes: ['portafoglio', 'montanara'],
    recipe: {
      dish: 'portafoglio',
      steps: [
        { kind: 'mix', title: 'Knead the dough', hint: 'Steady circles. The dough should feel like an earlobe.', rounds: 6 },
        { kind: 'order', title: 'Dress the pizza', hint: 'Tomato, mozzarella, basil, oil. In that order.', items: [I('Tomato', 'tomato'), I('Mozzarella', 'cheese'), I('Basil', 'leek'), I('Olive oil', 'drop')] },
        { kind: 'heat', title: 'Ninety seconds in the oven', hint: 'Pull it out when the crust is blistered, not burnt.', rounds: 1, speed: 1.7, label: 'Blistered' },
      ],
    },
  },
  {
    id: 'gelato', name: 'Gelateria del Molo', jp: 'Gelateria', street: 'Lungomare dei Cavalieri', vendor: 'Chiara',
    vendorLook: { skin: 0xf6d2b4, hair: 0x8a5a36, hairStyle: 'ponytail', top: 0xbfd2d8, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2b3a62, shoes: 0xf2efe7 },
    greeting: ['Ciao! Lemon from the terraces up there, pistachio from Bronte.', 'A granita to cool down? The sea breeze only does so much.'],
    dishes: ['gelato', 'granita'],
    recipe: {
      dish: 'granita',
      steps: [
        { kind: 'pick', title: 'Lemon granita', hint: 'Just four things. Nothing else.', items: [I('Lemon juice', 'drop'), I('Zest', 'sprinkle'), I('Sugar', 'sugar'), I('Water', 'milk')], decoys: [I('Soy sauce', 'soy'), I('Cheese', 'cheese'), I('Garlic', 'garlic')] },
        { kind: 'mix', title: 'Scrape the ice', hint: 'Rake the freezing juice into flakes.', rounds: 5 },
      ],
    },
  },
  {
    id: 'limonaia', name: 'La Limonaia', jp: 'Limonaia', street: 'Piazza dei Dogi', vendor: 'Zio Peppe',
    vendorLook: { skin: 0xc98f6a, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf2d98c, topStyle: 'vest', accent: 0x6e4a32, bottom: 0x5a4a3a, shoes: 0x6b4630, hat: 'straw', hatColor: 0xd9c08a },
    greeting: ['These lemons grew on my terraces, four hundred steps up. Smell that!', 'A little limoncello? Or the caprese, my wife\'s recipe. She won\'t tell me the secret either.'],
    dishes: ['limoncello', 'caprese'],
    recipe: {
      dish: 'limoncello',
      steps: [
        { kind: 'chop', title: 'Peel the lemons', hint: 'Only the yellow, never the bitter white.', rounds: 4, speed: 1.0 },
        { kind: 'order', title: 'Make the limoncello', hint: 'Steep, sweeten, bottle, chill.', items: [I('Peel in alcohol', 'drop'), I('Add syrup', 'sugar'), I('Bottle it', 'sake'), I('Into the freezer', 'chime')] },
      ],
    },
  },
  {
    id: 'grotta', name: 'La Grotta', jp: 'La Grotta', street: 'Vicoli di Ponente', vendor: 'Zia Carmela', hidden: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x6b6b70, hairStyle: 'bun', top: 0x2f2f35, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['...The three lemons brought you, eh? Sit. There is no menu. I cook what the sea gave us.', 'Scialatielli tonight. My husband cut them this morning.'],
    dishes: ['scialatielli', 'totani'],
    recipe: {
      dish: 'scialatielli',
      steps: [
        { kind: 'pick', title: 'The dough', hint: 'Scialatielli have milk and basil in them.', items: [I('Flour', 'flour'), I('Milk', 'milk'), I('Egg', 'egg'), I('Basil', 'leek'), I('Pecorino', 'cheese')], decoys: [I('Soy sauce', 'soy'), I('Chocolate', 'chocolate'), I('Red bean', 'bean')] },
        { kind: 'chop', title: 'Cut the ribbons', hint: 'Short and thick, by hand.', rounds: 5, speed: 1.2 },
        { kind: 'heat', title: 'Toss with the shellfish', hint: 'Stop when the shells open.', rounds: 2, speed: 1.4, label: 'Open' },
      ],
    },
  },
];

/** Istanbul's vendors (`jp` holds the Turkish sign). */
const ISTANBUL_STALLS: StallInfo[] = [
  {
    id: 'simitci', name: 'Simitçi Rüstem', jp: 'Simit', street: 'Eminönü Square', vendor: 'Rüstem Amca',
    vendorLook: { skin: 0xc98f6a, hair: 0x6b6b70, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0xc8321e, bottom: 0x3a3a40, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0xc8321e },
    greeting: ['Simit, taze simit! Fresh from the oven at five this morning.', 'One for you, one for the gulls. They are waiting, look.'],
    dishes: ['simit', 'pogaca'],
    recipe: {
      dish: 'simit',
      steps: [
        { kind: 'pick', title: 'The dough and the coat', hint: 'Simit is dipped in molasses, then rolled in sesame.', items: [I('Flour', 'flour'), I('Yeast water', 'drop'), I('Grape molasses', 'honey'), I('Sesame', 'sprinkle')], decoys: [I('Soy sauce', 'soy'), I('Chocolate', 'chocolate'), I('Tomato', 'tomato')] },
        { kind: 'order', title: 'Shape the ring', hint: 'Roll, twist, close the ring, dip and coat.', items: [I('Roll two ropes', 'flour'), I('Twist them', 'mixbowl'), I('Close the ring', 'simit'), I('Dip and coat', 'honey')] },
        { kind: 'heat', title: 'Into the stone oven', hint: 'Pull them out deep golden brown.', rounds: 2, speed: 1.2, label: 'Golden' },
      ],
    },
  },
  {
    id: 'balikci', name: 'Balıkçı Reis', jp: 'Balık Ekmek', street: 'Eminönü Quay', vendor: 'Reis Kemal',
    vendorLook: { skin: 0xa8714f, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'tee', accent: 0x2b4c86, bottom: 0x2b3a62, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2b4c86 },
    greeting: ['Balık ekmek! Hold on, the boat is rocking. Here, take it, quick!', 'Mackerel on the grill since six. A pickle juice with it? You must.'],
    dishes: ['balikekmek', 'tursu'],
    recipe: {
      dish: 'balikekmek',
      steps: [
        { kind: 'heat', title: 'Grill the fillets', hint: 'Lift them when the skin crackles. Two fillets.', rounds: 2, speed: 1.4, label: 'Crisp' },
        { kind: 'pick', title: 'Into the bread', hint: 'Only what goes in a real balık ekmek.', items: [I('Mackerel', 'fish'), I('Lettuce', 'leek'), I('Red onion', 'garlic'), I('Lemon', 'drop')], decoys: [I('Chocolate', 'chocolate'), I('Red bean', 'bean'), I('Pineapple', 'pineapple')] },
        { kind: 'chop', title: 'Slice the onion', hint: 'Thin rings. Tap on each line.', rounds: 4, speed: 1.1 },
      ],
    },
  },
  {
    id: 'midyeci', name: 'Midyeci Mardinli', jp: 'Midye', street: 'Bosphorus Quay', vendor: 'Mardinli Sinan',
    vendorLook: { skin: 0xc98f6a, hair: 0x2a1d17, hairStyle: 'spiky', top: 0x3a3a40, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e },
    greeting: ['Midye! Lemon? Of course lemon. Eat, eat, I keep count.', 'At night I do kokoreç too. You smell it from the other side of the bridge.'],
    dishes: ['midye', 'kokorec'],
    recipe: {
      dish: 'midye',
      steps: [
        { kind: 'pick', title: 'The spiced rice', hint: 'Sweet spices, currants and pine nuts.', items: [I('Rice', 'rice'), I('Onion', 'garlic'), I('Currants', 'bean'), I('Pine nuts', 'crumbs'), I('Cinnamon', 'sprinkle')], decoys: [I('Wasabi', 'paste'), I('Chocolate', 'chocolate'), I('Cheese', 'cheese')] },
        { kind: 'order', title: 'Stuff the mussels', hint: 'Open, fill, close, steam.', items: [I('Open the shell', 'knife'), I('Spoon in the rice', 'rice'), I('Close it', 'fish'), I('Steam in the pot', 'pot')] },
        { kind: 'heat', title: 'Steam until tender', hint: 'Stop when the rice is cooked through.', rounds: 1, speed: 1.3, label: 'Tender' },
      ],
    },
  },
  {
    id: 'kestaneci', name: 'Kestaneci Hüsnü', jp: 'Kestane', street: 'Galata Bridge', vendor: 'Hüsnü Dede',
    vendorLook: { skin: 0xe0ac86, hair: 0xb9b6b0, hairStyle: 'short', top: 0x5a4a3a, topStyle: 'jacket', accent: 0x3a2a20, bottom: 0x4a4038, shoes: 0x3a2a20, hat: 'beanie', hatColor: 0x3a3a40, glasses: true },
    greeting: ['Kestane kebap! Hot, hot. Keep your hands warm with the bag.', 'In summer, corn. In winter, chestnuts. Me, always.'],
    dishes: ['kestane', 'misir'],
    recipe: {
      dish: 'kestane',
      steps: [
        { kind: 'chop', title: 'Score the chestnuts', hint: 'A cross on each so they do not burst.', rounds: 5, speed: 1.0 },
        { kind: 'heat', title: 'Roast on the tray', hint: 'Turn them when the shell splits. Three rounds.', rounds: 3, speed: 1.2, label: 'Split' },
      ],
    },
  },
  {
    id: 'dondurmaci', name: 'Maraşlı Dondurmacı', jp: 'Dondurma', street: 'Hamidiye Street', vendor: 'Maraşlı Yusuf',
    vendorLook: { skin: 0xc98f6a, hair: 0x2a1d17, hairStyle: 'short', top: 0xb8281e, topStyle: 'vest', accent: 0xe8c24a, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0xb8281e },
    greeting: ['Dondurma! Ah-ah, not so fast... here! No, here! Ha, take it, take it.', 'Beaten for an hour with the paddle. That is why it stretches. Look!'],
    dishes: ['dondurma', 'salep'],
    recipe: {
      dish: 'dondurma',
      steps: [
        { kind: 'pick', title: 'Goat milk and orchid', hint: 'Salep and mastic make it stretch.', items: [I('Goat milk', 'milk'), I('Sugar', 'sugar'), I('Salep', 'flour'), I('Mastic', 'drop')], decoys: [I('Soy sauce', 'soy'), I('Garlic', 'garlic'), I('Tomato', 'tomato')] },
        { kind: 'mix', title: 'Beat it with the paddle', hint: 'Big strong circles. It fights back.', rounds: 8 },
      ],
    },
  },
  {
    id: 'durumcu', name: 'Dürümcü Hacı Usta', jp: 'Dürüm Evi', street: 'Sirkeci', vendor: 'Hacı Usta', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x3b2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Hoş geldin! The döner turned all morning for you. Dürüm with everything?', 'Ayran is on the house if you can hold the copper cup without spilling the foam.'],
    dishes: ['doner', 'ayran'],
    recipe: {
      dish: 'doner',
      steps: [
        { kind: 'chop', title: 'Shave the döner', hint: 'Long thin strokes down the spit.', rounds: 5, speed: 1.2 },
        { kind: 'order', title: 'Roll the dürüm', hint: 'Lavash, meat, salad, roll it tight.', items: [I('Warm the lavash', 'wrap'), I('Lay the meat', 'skewer'), I('Tomato and onion', 'tomato'), I('Roll it up', 'wrap')] },
      ],
    },
  },
  {
    id: 'baklavaci', name: 'Baklavacı Gaziantepli', jp: 'Baklava Salonu', street: 'Uzunçarşı', vendor: 'Gaziantepli Ömer', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x3b2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0x2f6b54, bottom: 0x2b2b30, shoes: 0x2a2a2e, glasses: true },
    greeting: ['Buyrun! Forty layers, pistachios from Antep, my grandfather\'s syrup. Sit, sit.', 'Künefe takes ten minutes. It is worth twenty.'],
    dishes: ['baklava', 'kunefe'],
    recipe: {
      dish: 'baklava',
      steps: [
        { kind: 'pick', title: 'Layers and filling', hint: 'Pastry, butter, pistachio, syrup.', items: [I('Yufka sheets', 'flour'), I('Butter', 'drop'), I('Pistachio', 'crumbs'), I('Syrup', 'honey')], decoys: [I('Garlic', 'garlic'), I('Soy sauce', 'soy'), I('Cheese', 'cheese')] },
        { kind: 'chop', title: 'Cut the diamonds', hint: 'Straight diagonal cuts across the tray.', rounds: 4, speed: 1.1 },
        { kind: 'heat', title: 'Bake and pour', hint: 'Golden, then the cold syrup on the hot tray.', rounds: 1, speed: 1.3, label: 'Golden' },
      ],
    },
  },
  {
    id: 'gizli', name: 'Gizli Mutfak', jp: 'Gizli Mutfak', street: 'The lanes above the bazaar', vendor: 'Hatice Hanım', hidden: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x8a8a8e, hairStyle: 'bun', top: 0x4a3a5a, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e, glasses: true },
    greeting: ['...So the three eyes brought you. Come, sit, take off your coat. There is no menu, I cook what I cooked for my children.', 'Hünkar beğendi today. The aubergines are already on the fire, smell them?'],
    dishes: ['hunkar', 'manti'],
    recipe: {
      dish: 'manti',
      steps: [
        { kind: 'pick', title: 'The dough and filling', hint: 'Egg dough, a pinch of lamb in each.', items: [I('Flour', 'flour'), I('Egg', 'egg'), I('Lamb mince', 'pork'), I('Onion', 'garlic')], decoys: [I('Chocolate', 'chocolate'), I('Pineapple', 'pineapple'), I('Red bean', 'bean')] },
        { kind: 'chop', title: 'Cut tiny squares', hint: 'Forty must fit on one spoon.', rounds: 6, speed: 1.3 },
        { kind: 'order', title: 'Dress the plate', hint: 'Mantı, garlic yoghurt, red butter, mint.', items: [I('Boiled mantı', 'pot'), I('Garlic yoghurt', 'milk'), I('Pepper butter', 'chili'), I('Dried mint', 'leek')] },
      ],
    },
  },
];

export const STALLS: StallInfo[] = ISTANBUL ? ISTANBUL_STALLS : AMALFI ? AMALFI_STALLS : TOKYO_STALLS;
export const STALL = Object.fromEntries(STALLS.map((s) => [s.id, s])) as Record<string, StallInfo>;
