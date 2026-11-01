import type { Dish } from './dishes';
import type { StallInfo, Ingredient } from './stalls';
import type { IconName } from '../ui/emblems';
import { eur } from './money';

/**
 * Funchal's second menu: six more places in the old town and up the hill (MORE_FOOD_PLACES in
 * world/madeiraPlan.ts), each with two passport dishes. Prices are real Funchal prices of 2026, in euros.
 */

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

export const MADEIRA_MORE_DISHES: Dish[] = [
  // ---- Casa de Pasto O Lavrador
  {
    id: 'acorda', name: 'Açorda Madeirense', jp: 'açorda', romaji: 'a-SOR-da', stall: 'pasto', price: eur(7.5), dessert: false,
    tagline: 'Bread soaked in a garlic and herb broth, with a poached egg on top.',
    origin: 'Madeira and mainland Portugal',
    history: 'Açorda comes from the Arabic tharid, bread in broth, a dish of the Moorish centuries in Portugal. On Madeira it was what farm families ate before the walk to the terraces: cheap, hot and filling.',
    ingredients: ['Day-old bread', 'Garlic', 'Fresh oregano and coriander', 'Olive oil', 'A poached egg'],
    culture: 'Madeirans make it thinner than mainland açorda, almost a soup, and add fresh oregano that grows wild on the island.',
    tip: 'Break the egg into the broth and stir. That is the sauce.',
    flavor: { sweet: 0, savory: 4, umami: 3, crunch: 1 },
  },
  {
    id: 'cuscuz', name: 'Cuscuz Madeirense', jp: 'cuscuz', romaji: 'kush-KUSH', stall: 'pasto', price: eur(9), dessert: false,
    tagline: 'The island\'s own steamed wheat couscous, served with pork stewed in wine and garlic.',
    origin: 'Madeira, 1500s',
    history: 'Couscous reached Madeira with the North African slaves and workers of the sugar plantations. It never left: Madeiran women still roll the grains by hand and dry them in the sun, the only place in Portugal that does.',
    ingredients: ['Hand-rolled wheat couscous', 'Pork', 'Wine and garlic', 'Bay leaf', 'Parsley'],
    culture: 'Home-made cuscuz is sold in paper bags at the farmers\' market. Restaurants that serve it are proud of it.',
    tip: 'Mix the pork sauce into the couscous. It drinks it up.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 1 },
  },
  // ---- O Bacalhoeiro
  {
    id: 'bacalhau', name: 'Bacalhau à Gomes de Sá', jp: 'bacalhau', romaji: 'ba-ka-LYAU', stall: 'bacalhoeiro', price: eur(16), dessert: false,
    tagline: 'Flaked salt cod baked with potatoes, onion, egg and black olives.',
    origin: 'Porto, 1800s; eaten in every Portuguese town',
    history: 'Portuguese fishermen have sailed to Newfoundland for cod since the 1500s and salted it to bring it home. A Porto merchant called Gomes de Sá gave this recipe to a friend, and it spread through the whole country, islands included.',
    ingredients: ['Salt cod, soaked for two days', 'Potatoes', 'Onion and garlic', 'Boiled eggs', 'Black olives and olive oil'],
    culture: 'People say there is a bacalhau recipe for every day of the year. At Christmas Eve, it is the only dish on the table.',
    tip: 'Pour more olive oil over it at the table. Nobody will judge you.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 1 },
  },
  {
    id: 'pastelbacalhau', name: 'Pastéis de Bacalhau', jp: 'pastéis de bacalhau', romaji: 'pash-TAYSH de ba-ka-LYAU', stall: 'bacalhoeiro', price: eur(4.5), dessert: false,
    tagline: 'Cod and potato fritters, shaped between two spoons and fried crisp.',
    origin: 'Portugal, 1900s',
    history: 'Leftover cod and potato made into fritters. They became the snack of every Portuguese café counter, and a little wedding and christening food too.',
    ingredients: ['Salt cod', 'Mashed potato', 'Egg', 'Onion and parsley', 'Oil for frying'],
    culture: 'They sit in a glass case on the counter and are eaten standing, with a glass of wine or a beer, at any hour.',
    tip: 'Good ones are crisp outside and almost fluffy inside. Bite one before ordering three.',
    flavor: { sweet: 0, savory: 4, umami: 3, crunch: 4 },
  },
  // ---- Marisqueira do Ilhéu
  {
    id: 'arroz', name: 'Arroz de Marisco', jp: 'arroz de marisco', romaji: 'a-ROSH de ma-REESH-ku', stall: 'ilheu', price: eur(22), dessert: false,
    tagline: 'A wet tomato rice full of prawns, clams and mussels, brought to the table in its pot.',
    origin: 'Portuguese coast',
    history: 'Unlike a dry paella, Portuguese seafood rice is soupy, cooked in a stock made from the shells. Every coastal town has its version; Funchal\'s uses limpets and clams from its own rocks.',
    ingredients: ['Carolino rice', 'Prawns, clams and mussels', 'Tomato and onion', 'Shellfish stock', 'Coriander'],
    culture: 'It is ordered for two at least and served in the pot with a ladle. Nobody minds a little left over in the bottom.',
    tip: 'Eat it right away. The rice keeps cooking in the broth.',
    flavor: { sweet: 2, savory: 4, umami: 5, crunch: 1 },
  },
  {
    id: 'caramujos', name: 'Caramujos', jp: 'caramujos', romaji: 'ka-ra-MOO-zhush', stall: 'ilheu', price: eur(8), dessert: false,
    tagline: 'Small sea snails from the island\'s rocks, boiled with garlic and bay, eaten with a pin.',
    origin: 'Madeira',
    history: 'Island families gathered caramujos and limpets on the rocky shore at low tide for as long as there have been people on Madeira. Now they are bar food: a little bowl next to a cold beer.',
    ingredients: ['Sea snails', 'Garlic', 'Bay leaf', 'Sea salt', 'Black pepper'],
    culture: 'The pin comes with the bowl. You twist each snail out of its shell, which takes patience and is half the fun.',
    tip: 'Turn the pin with the spiral of the shell, not against it.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 1 },
  },
  // ---- Confeitaria Felisberta
  {
    id: 'sonhos', name: 'Sonhos com Mel de Cana', jp: 'sonhos', romaji: 'SO-nyush', stall: 'confeitaria', price: eur(3.5), dessert: true,
    tagline: 'Airy fried dough puffs rolled in cinnamon sugar and drizzled with sugarcane honey.',
    origin: 'Portugal; Madeira\'s honey version',
    history: 'Sonhos, dreams, are a Christmas sweet across Portugal. On Madeira they are dipped in mel de cana, the dark syrup made from the island\'s sugar cane, the crop that made Madeira rich in the 1500s.',
    ingredients: ['Flour, eggs and butter', 'Orange zest', 'Cinnamon sugar', 'Mel de cana (sugarcane honey)'],
    culture: 'At Christmas Madeiran kitchens fry them by the hundred. The confeitaria makes them all year.',
    tip: 'Tear one open. If it is hollow and light inside, it is a good one.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 2 },
  },
  {
    id: 'funcho', name: 'Rebuçados de Funcho', jp: 'rebuçados de funcho', romaji: 're-boo-SA-dush de FOON-shu', stall: 'confeitaria', price: eur(2.5), dessert: true,
    tagline: 'Hard fennel candies, pale green and white, made with island sugar and wild fennel.',
    origin: 'Madeira, 1800s',
    history: 'Wild fennel grows all over Madeira; Funchal itself is named after it. Sugar boilers turned it into candy sticks sold at every church festival, the arraial.',
    ingredients: ['Island sugar', 'Wild fennel', 'Water', 'A little lemon'],
    culture: 'Children buy them at the arraiais in summer, and grandparents keep a paper twist of them in a pocket.',
    tip: 'Do not bite. Let it melt slowly and the fennel comes through.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 4 },
  },
  // ---- Casa da Castanha
  {
    id: 'sopacastanha', name: 'Sopa de Castanha', jp: 'sopa de castanha', romaji: 'SO-pa de kash-TA-nya', stall: 'castanha', price: eur(6), dessert: false,
    tagline: 'A thick chestnut soup with beans and pork, from the Curral das Freiras valley.',
    origin: 'Curral das Freiras, Madeira',
    history: 'The nuns of Santa Clara fled pirates to this deep valley in 1566. Chestnut trees fed the village for centuries, and its chestnut festival every November still draws the whole island.',
    ingredients: ['Chestnuts', 'Beans', 'Pork', 'Onion', 'Sweet potato'],
    culture: 'In the valley, every family has its own trees and its own recipe. In town it is a winter dish.',
    tip: 'Ask for a slice of bolo do caco to dip.',
    flavor: { sweet: 3, savory: 4, umami: 3, crunch: 0 },
  },
  {
    id: 'licorcastanha', name: 'Licor de Castanha', jp: 'licor de castanha', romaji: 'li-KOR de kash-TA-nya', stall: 'castanha', price: eur(3), dessert: false,
    tagline: 'A small glass of sweet chestnut liqueur with two roasted chestnuts on the side.',
    origin: 'Curral das Freiras, Madeira',
    history: 'The valley distils its chestnuts into a sweet brown liqueur. It is the drink of the chestnut festival, poured from big bottles into tiny glasses.',
    ingredients: ['Chestnuts', 'Sugarcane spirit', 'Sugar', 'Cinnamon'],
    culture: 'It is offered to visitors at the door of valley houses. Saying no is rude.',
    tip: 'Sip, then eat a chestnut, then sip again.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 0 },
  },
  // ---- Café do Miradouro
  {
    id: 'galao', name: 'Galão', jp: 'galão', romaji: 'ga-LAUN', stall: 'teatro', price: eur(1.8), dessert: false,
    tagline: 'A tall glass of milky coffee, a long spoon, and nowhere to be.',
    origin: 'Portugal, 1900s',
    history: 'The galão is Portugal\'s answer to the latte, older and served in a glass. Every café in Funchal pulls hundreds a day for people reading the paper under the jacarandas.',
    ingredients: ['Espresso', 'Lots of hot milk', 'Sugar on the side'],
    culture: 'It comes in a glass, not a cup, so you see the layers. Ordering one with a bolo de arroz is breakfast for half the island.',
    tip: 'Hold the glass by the rim. It is hotter than it looks.',
    flavor: { sweet: 2, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'boloarroz', name: 'Bolo de Arroz', jp: 'bolo de arroz', romaji: 'BO-lu de a-ROSH', stall: 'teatro', price: eur(1.6), dessert: true,
    tagline: 'A tall rice-flour muffin with a sugar crust, baked in its own paper band.',
    origin: 'Portugal, 1900s',
    history: 'Rice flour made these cakes lighter and cheaper than plain wheat. They became the standard partner of the café galão all over Portugal.',
    ingredients: ['Rice flour and wheat flour', 'Eggs and butter', 'Lemon zest', 'Sugar on top'],
    culture: 'You peel the paper band and eat it in strips, dunking each in the galão.',
    tip: 'The sugar crust on top is the best bite. Save it for last.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 2 },
  },
];

export const MADEIRA_MORE_STALLS: StallInfo[] = [
  {
    id: 'pasto', name: 'Casa de Pasto O Lavrador', jp: 'casa de pasto', street: 'Funchal', vendor: 'Dona Fátima', restaurant: true,
    vendorLook: { skin: 0xd9a27a, hair: 0x6b6b70, hairStyle: 'bun', top: 0x3a3a40, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Cuscuz from my sister in Santana, rolled by hand and dried in the sun.', 'Açorda, the way the farmers ate it before climbing to the terraces.'],
    dishes: ['acorda', 'cuscuz'],
    recipe: {
      dish: 'acorda',
      steps: [
        { kind: 'pick', title: 'The broth', hint: 'Bread, garlic and herbs.', items: [I('Day-old bread', 'toast'), I('Garlic', 'garlic'), I('Oregano', 'leek'), I('Olive oil', 'drop')], decoys: [I('Soy sauce', 'soy'), I('Chocolate', 'chocolate'), I('Rice', 'rice')] },
        { kind: 'heat', title: 'Poach the egg', hint: 'Into the hot broth, white set, yolk soft.', rounds: 1, speed: 1.3, label: 'Set' },
        { kind: 'mix', title: 'Stir it all', hint: 'Until the bread melts into the broth.', rounds: 4 },
      ],
    },
  },
  {
    id: 'bacalhoeiro', name: 'O Bacalhoeiro', jp: 'restaurante', street: 'Rua de Santa Maria', vendor: 'Senhor Albano', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x2b3a62, bottom: 0x2f2f35, shoes: 0x2a2a2e, moustache: true },
    greeting: ['Three hundred and sixty-five ways to cook bacalhau. Today: Gomes de Sá.', 'The cod soaked two days in fresh water. Changed four times. I do not cheat.'],
    dishes: ['bacalhau', 'pastelbacalhau'],
    recipe: {
      dish: 'pastelbacalhau',
      steps: [
        { kind: 'pick', title: 'The mix', hint: 'Cod and potato, and what holds them.', items: [I('Salt cod', 'fish'), I('Mashed potato', 'mixbowl'), I('Egg', 'egg'), I('Parsley', 'leek')], decoys: [I('Sugar', 'sugar'), I('Banana', 'banana'), I('Miso', 'miso')] },
        { kind: 'mix', title: 'Shape with two spoons', hint: 'Three sides, like a little rugby ball.', rounds: 5 },
        { kind: 'heat', title: 'Fry them', hint: 'Golden all round.', rounds: 2, speed: 1.4, label: 'Golden' },
      ],
    },
  },
  {
    id: 'ilheu', name: 'Marisqueira do Ilhéu', jp: 'marisqueira', street: 'Zona Velha', vendor: 'Chef Rui', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f6fae, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2f6fae },
    greeting: ['The caramujos came off the rocks by the fort this morning.', 'Arroz de marisco for two. You will want it for three.'],
    dishes: ['arroz', 'caramujos'],
    recipe: {
      dish: 'arroz',
      steps: [
        { kind: 'pick', title: 'Into the pot', hint: 'A wet rice, red and full of the sea.', items: [I('Rice', 'rice'), I('Prawns', 'shrimp'), I('Clams', 'shrimp'), I('Tomato', 'tomato'), I('Shell stock', 'pot')], decoys: [I('Cheese', 'cheese'), I('Chocolate', 'chocolate'), I('Honey', 'honey')] },
        { kind: 'heat', title: 'Simmer', hint: 'Off the heat while it is still soupy.', rounds: 2, speed: 1.2, label: 'Soupy' },
      ],
    },
  },
  {
    id: 'confeitaria', name: 'Confeitaria Felisberta', jp: 'confeitaria', street: 'Rua da Sé', vendor: 'Dona Felisberta', restaurant: true,
    vendorLook: { skin: 0xe8b894, hair: 0x5a3a2a, hairStyle: 'bob', top: 0xf09aac, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Sonhos with mel de cana from the mill at Porto da Cruz. Dreams, we call them.', 'Funcho candies, like at the arraial. Funchal is named after the fennel, you know.'],
    dishes: ['sonhos', 'funcho'],
    recipe: {
      dish: 'sonhos',
      steps: [
        { kind: 'mix', title: 'Beat the dough', hint: 'Eggs one at a time, until glossy.', rounds: 5 },
        { kind: 'heat', title: 'Fry the dreams', hint: 'They puff up and turn themselves over.', rounds: 2, speed: 1.3, label: 'Puffed' },
        { kind: 'pick', title: 'To finish', hint: 'The Madeiran way.', items: [I('Cinnamon sugar', 'sugar'), I('Sugarcane honey', 'honey')], decoys: [I('Salt', 'sprinkle'), I('Soy sauce', 'soy'), I('Garlic', 'garlic')] },
      ],
    },
  },
  {
    id: 'castanha', name: 'Casa da Castanha', jp: 'tasca', street: 'Caminho do Monte', vendor: 'Senhor Agostinho', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x3a2a20, hairStyle: 'short', top: 0x6b5a3a, topStyle: 'cardigan', accent: 0xf2d98c, bottom: 0x3a3a40, shoes: 0x6b4630, hat: 'beanie', hatColor: 0x6e2a22 },
    greeting: ['My chestnuts come down from Curral das Freiras, where the nuns hid from the pirates.', 'Soup first, then a little glass of licor. Then you will want to stay.'],
    dishes: ['sopacastanha', 'licorcastanha'],
    recipe: {
      dish: 'sopacastanha',
      steps: [
        { kind: 'chop', title: 'Peel the chestnuts', hint: 'Score each one first.', rounds: 5, speed: 1.0 },
        { kind: 'pick', title: 'Into the pot', hint: 'A valley soup.', items: [I('Chestnuts', 'bean'), I('Beans', 'bean'), I('Pork', 'pork'), I('Onion', 'leek')], decoys: [I('Fish', 'fish'), I('Sugar', 'sugar'), I('Nori', 'nori')] },
        { kind: 'heat', title: 'Cook it thick', hint: 'Until the chestnuts fall apart.', rounds: 2, speed: 1.1, label: 'Thick' },
      ],
    },
  },
  {
    id: 'teatro', name: 'Café do Miradouro', jp: 'café', street: 'The Banana Terraces', vendor: 'Tiago', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x1e1a1a, bottom: 0x1e1a1a, shoes: 0x2a2a2e },
    greeting: ['A galão and a bolo de arroz. That is breakfast, lunch and the afternoon in Funchal.', 'Sit by the window. From up here you can see the whole bay.'],
    dishes: ['galao', 'boloarroz'],
    recipe: {
      dish: 'galao',
      steps: [
        { kind: 'order', title: 'Build the galão', hint: 'Tap in order.', items: [I('Pull the espresso', 'coffee'), I('Steam the milk', 'milk'), I('Pour into the glass', 'drop'), I('Sugar on the side', 'sugar')] },
        { kind: 'mix', title: 'Froth the milk', hint: 'Light and hot, not boiling.', rounds: 4 },
      ],
    },
  },
];
