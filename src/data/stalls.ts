import type { IconName } from '../ui/emblems';
import type { FoodId } from '../world/food';
import type { Look } from '../world/characters';

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

export const STALLS: StallInfo[] = [
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

export const STALL = Object.fromEntries(STALLS.map((s) => [s.id, s])) as Record<string, StallInfo>;
