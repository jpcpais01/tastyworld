import type { Dish } from './dishes';
import type { StallInfo, Ingredient } from './stalls';
import type { CityText } from './cityText';
import type { Idler } from './dialogue';
import type { HotelInfo } from './hotels';
import type { IconName } from '../ui/emblems';
import { eur, YEN_PER_EURO } from './money';

/**
 * Funchal, Madeira: everything the island's capital says and sells. The old town (Zona Velha) with its painted
 * doors, the Sé, the farmers' market, the marina and the seafront, the cable car up to Monte. Prices are real
 * Funchal prices of 2026, in euros through the wallet's yen.
 */

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

export const MADEIRA_DISHES: Dish[] = [
  {
    id: 'bolocaco', name: 'Bolo do Caco', jp: 'bolo do caco', romaji: 'BO-lu du KA-ku', stall: 'caco', price: eur(3.5), dessert: false,
    tagline: 'A round flatbread baked on a hot basalt stone, split and soaked in garlic butter.',
    origin: 'Madeira, 1500s',
    history: 'The first settlers baked bread on a caco, a slab of the island\'s basalt heated over the fire. Sweet potato went into the dough when the island grew it, and the soft, chewy round became the bread of every Madeiran table.',
    ingredients: ['Wheat flour', 'Mashed sweet potato', 'Yeast and salt', 'Butter', 'Garlic and parsley'],
    culture: 'It comes to the table hot before every meal, sliced in wedges with garlic butter running out. At street parties it is the bread round every espetada and every sandwich.',
    tip: 'Eat it while the butter is still melting. Cold bolo do caco is a different, lesser thing.',
    flavor: { sweet: 1, savory: 4, umami: 2, crunch: 2 },
  },
  {
    id: 'prego', name: 'Prego no Bolo do Caco', jp: 'prego no caco', romaji: 'PRE-gu nu KA-ku', stall: 'caco', price: eur(8.5), dessert: false,
    tagline: 'A thin garlicky steak, seared on the plate, folded into a hot bolo do caco.',
    origin: 'Portugal and Madeira, 1900s',
    history: 'The prego (a nail, for the garlic hammered into the meat) is Portugal\'s steak sandwich. On Madeira it moved into the island\'s own bread, and the seafront kiosks have sold it to fishermen, students and night owls ever since.',
    ingredients: ['Thin beef steak', 'Garlic', 'Bolo do caco', 'Butter', 'Lettuce and tomato'],
    culture: 'Late at night after the festas, a prego in a caco is what everyone queues for. Mustard and piri-piri sit on the counter.',
    tip: 'Ask for it com tudo, with everything, and hold it in its paper.',
    flavor: { sweet: 0, savory: 5, umami: 4, crunch: 2 },
  },
  {
    id: 'poncha', name: 'Poncha', jp: 'poncha', romaji: 'PON-sha', stall: 'poncha', price: eur(3), dessert: false, drink: 'cold',
    tagline: 'Sugar-cane rum, honey and lemon, stirred hard with a wooden caralhinho.',
    origin: 'Câmara de Lobos, 1600s',
    history: 'Fishermen of Câmara de Lobos warmed up with aguardente, the island\'s cane spirit, cut with honey and lemon. Sailors carried the punch round the world, but the stick-stirred original never left Madeira.',
    ingredients: ['Aguardente de cana', 'Bee honey or cane honey', 'Lemon juice', 'Lemon zest'],
    culture: 'It is mixed in front of you in a jug, beaten with the caralhinho, a stick with a knob at the end. Peanuts in their shells come with it, and the shells go on the floor.',
    tip: 'Sip it. The honey hides the rum, and the rum will find you anyway.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'nikita', name: 'Nikita', jp: 'nikita', romaji: 'nee-KEE-ta', stall: 'poncha', price: eur(4.5), dessert: true, drink: 'cold',
    tagline: 'Pineapple, vanilla ice cream and cold white wine, blended into a tall frothy glass.',
    origin: 'Funchal, 1980s',
    history: 'Named after an Elton John song that played everywhere one summer, the nikita was invented in a Funchal bar and became the island\'s favourite summer treat. Nobody agrees on which bar.',
    ingredients: ['Vanilla ice cream', 'Pineapple', 'White wine or beer', 'Sugar'],
    culture: 'Half dessert, half drink, served with a long spoon and a straw. Locals order it at the end of a hot afternoon on a terrace by the sea.',
    tip: 'Spoon first, straw after.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'maracuja', name: 'Maracujá', jp: 'maracujá', romaji: 'ma-ra-ku-ZHA', stall: 'frutas', price: eur(3), dessert: true,
    tagline: 'Passion fruit of every kind: purple, banana, tomato, lemon. Halved for you to scoop.',
    origin: 'Mercado dos Lavradores',
    history: 'Madeira\'s warm valleys grow fruit from three continents. Passion fruit came from South America and found the island so much to its liking that a dozen varieties now climb the terraces round Funchal.',
    ingredients: ['Purple passion fruit', 'Banana passion fruit', 'Lemon passion fruit', 'A spoon'],
    culture: 'The market sellers cut fruit open for you to taste. The banana passion fruit is long and yellow, the tomato one is red, and each one tastes different.',
    tip: 'Scoop out the seeds and all. The crunch is the best part.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 3 },
  },
  {
    id: 'anona', name: 'Anona', jp: 'anona', romaji: 'a-NO-na', stall: 'frutas', price: eur(2.5), dessert: true,
    tagline: 'The custard apple: green scales outside, creamy white flesh that tastes of pear and vanilla.',
    origin: 'Madeira, 1700s',
    history: 'The cherimoya came over from the Andes and Madeira became one of the few places in Europe where it grows. The island\'s anona has its own protected name and its own festival in Faial every spring.',
    ingredients: ['Ripe anona', 'A spoon', 'A squeeze of orange, if you like'],
    culture: 'It is ripe when it gives under your thumb. Madeirans eat it with a spoon straight from the skin and spit the big black seeds.',
    tip: 'Never bite the seeds. Spoon around them.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'malasada', name: 'Malasada', jp: 'malasada', romaji: 'ma-la-SA-da', stall: 'malasadas', price: eur(1.8), dessert: true,
    tagline: 'A puffy fried dough ball rolled in sugar, with a drizzle of cane honey.',
    origin: 'Madeira, Carnival',
    history: 'Before Lent, Madeiran households used up their lard and sugar frying malasadas on Fat Tuesday. Emigrants took them to Hawaii, where they became famous, but on the island they still taste of Carnival.',
    ingredients: ['Flour and eggs', 'Milk and yeast', 'Lemon zest', 'Sugar', 'Mel de cana (cane honey)'],
    culture: 'At Carnival every bakery has trays of them. The rest of the year you find them at fairs and festa stalls, hot from the oil.',
    tip: 'Ask for honey on top, mel de cana. It makes it Madeiran.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 2 },
  },
  {
    id: 'brisa', name: 'Brisa Maracujá', jp: 'brisa', romaji: 'BREE-za', stall: 'malasadas', price: eur(1.5), dessert: false, drink: 'cold',
    tagline: 'Madeira\'s own fizzy passion fruit soda, in a cold glass bottle.',
    origin: 'Funchal, 1960s',
    history: 'A Funchal bottler made the first Brisa from the island\'s passion fruit, and it never left. Madeirans abroad ask relatives to bring cases of it home.',
    ingredients: ['Passion fruit juice', 'Sparkling water', 'Sugar'],
    culture: 'It comes with every bolo do caco and every espetada at the festas. The orange label is part of the island\'s summer.',
    tip: 'Drink it from the bottle, ice cold.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'espetada', name: 'Espetada', jp: 'espetada', romaji: 'esh-pe-TA-da', stall: 'espetada', price: eur(18), dessert: false,
    tagline: 'Beef chunks rubbed with garlic and salt, grilled on a laurel branch, hung over the table.',
    origin: 'Estreito de Câmara de Lobos, 1800s',
    history: 'At the wine harvest festas, families skewered beef on branches of the island\'s laurel and grilled it over the embers. The laurel flavours the meat, and the skewer now hangs from a hook over your table.',
    ingredients: ['Beef rump', 'Coarse salt', 'Garlic', 'Bay laurel', 'Bolo do caco and milho frito on the side'],
    culture: 'The waiter hangs the iron skewer from a stand in the middle of the table. You slide the pieces off yourself, and catch the juices with bolo do caco.',
    tip: 'Mop the plate under the skewer with the bread. That is the best bite.',
    flavor: { sweet: 0, savory: 5, umami: 5, crunch: 2 },
  },
  {
    id: 'milhofrito', name: 'Milho Frito', jp: 'milho frito', romaji: 'MEE-lyu FREE-tu', stall: 'espetada', price: eur(4.5), dessert: false,
    tagline: 'Cubes of cornmeal set with kale and herbs, fried crisp outside and soft within.',
    origin: 'Madeira, 1800s',
    history: 'Cornmeal porridge (milho cozido) fed the island\'s poor for two hundred years. Left overnight it set firm, and frying the cubes the next day made something better than the original.',
    ingredients: ['Cornmeal', 'Kale (couve)', 'Garlic and thyme', 'Lard or olive oil', 'Salt'],
    culture: 'It comes in a little basket with espetada and with fish. Madeirans argue about whether it should be golden or nearly brown.',
    tip: 'Eat the corner cubes first, they are the crispest.',
    flavor: { sweet: 1, savory: 3, umami: 1, crunch: 4 },
  },
  {
    id: 'espada', name: 'Espada com Banana', jp: 'espada com banana', romaji: 'esh-PA-da kom ba-NA-na', stall: 'espada', price: eur(17), dessert: false,
    tagline: 'Fillets of black scabbardfish, fried golden, with fried banana and passion fruit sauce.',
    origin: 'Madeira, 1900s',
    history: 'The black scabbardfish lives a kilometre down and is caught on long lines at night, mostly off Câmara de Lobos. It looks like a monster and tastes like butter, and Madeira is one of the only places that fishes for it.',
    ingredients: ['Black scabbardfish (espada preta)', 'Egg and flour', 'Madeira banana', 'Passion fruit', 'Lemon and garlic'],
    culture: 'The pairing with banana sounds strange until you try it. Every restaurant in Funchal serves it, and the fish market lays the long black fish out each morning.',
    tip: 'A bite of fish, a bite of banana, a little sauce. Then decide.',
    flavor: { sweet: 3, savory: 4, umami: 3, crunch: 2 },
  },
  {
    id: 'lapas', name: 'Lapas Grelhadas', jp: 'lapas', romaji: 'LA-pash', stall: 'espada', price: eur(13), dessert: false,
    tagline: 'Limpets grilled in their shells on a hot iron pan, with garlic butter and lemon.',
    origin: 'Madeira, always',
    history: 'Limpets have been prised off the island\'s black rocks for as long as people have lived here. Picking them is now limited to a season, which only makes the sizzling pans in Zona Velha more welcome.',
    ingredients: ['Limpets', 'Garlic butter', 'Lemon', 'Coarse salt'],
    culture: 'The pan comes to the table still spitting. You pick the limpets out with a fork and mop the butter with bolo do caco.',
    tip: 'Squeeze the lemon at once, while the butter still hisses.',
    flavor: { sweet: 0, savory: 4, umami: 5, crunch: 1 },
  },
  {
    id: 'atum', name: 'Bife de Atum', jp: 'bife de atum', romaji: 'BEE-fe de a-TUM', stall: 'atum', price: eur(16), dessert: false,
    tagline: 'A thick tuna steak, marinated in garlic and wine, seared and served with milho frito.',
    origin: 'Madeira and the Azores',
    history: 'Bigeye and yellowfin tuna pass Madeira every summer, and the island\'s boats still catch them one at a time on pole and line. The steak is cooked like beef, which is why it is called a bife.',
    ingredients: ['Tuna steak', 'Garlic and oregano', 'Wine vinegar', 'Olive oil', 'Milho frito'],
    culture: 'In summer every marina restaurant writes atum on its board in chalk. Islanders like it cooked through with onions; visitors ask for it pink.',
    tip: 'Squeeze lemon over the onions on top.',
    flavor: { sweet: 1, savory: 4, umami: 5, crunch: 1 },
  },
  {
    id: 'caldeirada', name: 'Caldeirada', jp: 'caldeirada', romaji: 'kal-day-RA-da', stall: 'atum', price: eur(15), dessert: false,
    tagline: 'A fisherman\'s stew of the day\'s fish, potatoes, tomato and peppers, in its pot.',
    origin: 'The Portuguese coast',
    history: 'Fishermen cooked the unsold part of the catch in a caldeira, a pot, on the boat or the beach. Every port in Portugal has its own; Madeira\'s adds the island\'s sweet peppers and a splash of wine.',
    ingredients: ['Mixed fish', 'Potatoes', 'Tomato and onion', 'Peppers', 'White wine and parsley'],
    culture: 'It is brought to the table in the pot it cooked in, and everyone helps themselves. Bread is for the broth at the bottom.',
    tip: 'Save bread for the end. The broth is the reward.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 0 },
  },
  {
    id: 'sopatomate', name: 'Sopa de Tomate e Cebola', jp: 'sopa de tomate', romaji: 'SO-pa de tu-MA-te', stall: 'tasca', price: eur(9), dessert: false,
    tagline: 'A thick tomato and onion soup with an egg poached in it and potatoes underneath.',
    origin: 'Madeira, 1800s',
    history: 'A cheap supper from the island\'s gardens: ripe tomatoes, onions and potatoes, with an egg cracked in at the end for the hungriest. It is still what grandmothers cook when someone comes home.',
    ingredients: ['Ripe tomatoes', 'Onions', 'Potatoes', 'A poached egg', 'Bay leaf and olive oil'],
    culture: 'In the tascas it is a whole meal: a deep bowl, the egg on top, bread on the side.',
    tip: 'Break the yolk into the soup before your first spoonful.',
    flavor: { sweet: 2, savory: 4, umami: 3, crunch: 0 },
  },
  {
    id: 'vinhalhos', name: 'Carne Vinha d\'Alhos', jp: 'vinha d\'alhos', romaji: 'VEE-nya DA-lyush', stall: 'tasca', price: eur(13), dessert: false,
    tagline: 'Pork soaked for days in wine, vinegar, garlic and bay, then slowly fried.',
    origin: 'Madeira, Christmas',
    history: 'Before refrigerators, the Christmas pig was kept in wine vinegar and garlic. The dish travelled with Madeiran emigrants to Goa, where it became vindaloo, but it is still the island\'s festive table.',
    ingredients: ['Pork shoulder', 'Wine vinegar', 'Lots of garlic', 'Bay leaves', 'Oranges and bread'],
    culture: 'At Christmas the house smells of it for a week. Tascas serve it all year with slices of orange and bread fried in the pork fat.',
    tip: 'Eat it with the orange. It cuts through the garlic.',
    flavor: { sweet: 1, savory: 5, umami: 4, crunch: 1 },
  },
  {
    id: 'bolomel', name: 'Bolo de Mel', jp: 'bolo de mel', romaji: 'BO-lu de MEL', stall: 'pastelaria', price: eur(3.5), dessert: true,
    tagline: 'The island\'s dark, spiced cane-honey cake, studded with nuts. Broken, never cut.',
    origin: 'Madeira, 1500s',
    history: 'When sugar made Madeira rich, the dark molasses left behind went into a cake with spices from the Indies. It keeps for a year, so it is baked on 8 December and eaten all through Christmas.',
    ingredients: ['Mel de cana (cane honey)', 'Flour and lard', 'Cinnamon, clove and aniseed', 'Walnuts and almonds', 'Candied peel'],
    culture: 'Custom says you never cut it with a knife. You break it with your hands, and a piece of the family\'s cake goes to every visitor.',
    tip: 'Break it, never cut it, and have a glass of Madeira with it.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 2 },
  },
  {
    id: 'queijada', name: 'Queijada', jp: 'queijada', romaji: 'kay-ZHA-da', stall: 'pastelaria', price: eur(1.8), dessert: true,
    tagline: 'A little star-shaped tart filled with fresh cheese, sugar and lemon.',
    origin: 'Madeira, convents',
    history: 'The convents of Funchal turned fresh cheese, eggs and sugar into small tarts with crimped edges. Madeira\'s queijadas are star-shaped and baked until the top just cracks.',
    ingredients: ['Fresh cheese', 'Sugar', 'Eggs', 'Lemon zest', 'Pastry shell'],
    culture: 'People buy them by the half dozen in a paper bag and eat them walking.',
    tip: 'Eat the points of the star first.',
    flavor: { sweet: 4, savory: 1, umami: 0, crunch: 2 },
  },
  {
    id: 'madeira', name: 'Vinho Madeira', jp: 'vinho Madeira', romaji: 'VEE-nyu ma-DAY-ra', stall: 'adega', price: eur(5), dessert: false, drink: 'cold',
    tagline: 'A glass of Madeira wine, aged warm for years, nutty and sweet and nearly immortal.',
    origin: 'Madeira, 1600s',
    history: 'Wine shipped across the equator in hot holds came back better than it left. Madeira learned to age its wine warm on purpose, and the result keeps for centuries: the American founders toasted independence with it.',
    ingredients: ['Sercial, Verdelho, Boal or Malmsey grapes', 'Grape spirit', 'Years in warm casks'],
    culture: 'The lodges in Funchal let you taste from casks older than your grandparents. A sweet Malmsey goes with bolo de mel; a dry Sercial before dinner.',
    tip: 'Swirl, smell the walnuts and caramel, then sip slowly.',
    flavor: { sweet: 4, savory: 1, umami: 1, crunch: 0 },
  },
  {
    id: 'broas', name: 'Broas de Mel', jp: 'broas de mel', romaji: 'BRO-ash de MEL', stall: 'adega', price: eur(4), dessert: true,
    tagline: 'Honey biscuits with cinnamon and lemon, made for dipping in Madeira wine.',
    origin: 'Madeira, Christmas',
    history: 'The same cane honey that makes bolo de mel goes into little biscuits, baked in their thousands for Christmas. Wine lodges keep a jar on the counter.',
    ingredients: ['Cane honey', 'Flour', 'Butter', 'Cinnamon', 'Lemon zest'],
    culture: 'A broa dipped in a glass of Madeira is the island\'s way to finish a visit.',
    tip: 'Dip, count to two, bite.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 4 },
  },
  {
    id: 'chinesa', name: 'Chinesa', jp: 'chinesa', romaji: 'shee-NE-za', stall: 'cafe', price: eur(1.5), dessert: false, drink: 'hot',
    tagline: 'Funchal\'s milky coffee, served in a tall glass with a saucer.',
    origin: 'Funchal',
    history: 'Lisbon has its galão; Funchal has the chinesa, a milky coffee in a glass. Nobody knows why it is called the Chinese one, and every café owner has a different story.',
    ingredients: ['Espresso', 'Hot milk', 'Sugar'],
    culture: 'It is the morning drink at the café counters round the Sé, with a pastel de nata or a slice of bolo de mel.',
    tip: 'Hold the glass by its rim. It is hotter than it looks.',
    flavor: { sweet: 2, savory: 0, umami: 0, crunch: 0 },
  },
  {
    id: 'nata', name: 'Pastel de Nata', jp: 'pastel de nata', romaji: 'pash-TEL de NA-ta', stall: 'cafe', price: eur(1.4), dessert: true,
    tagline: 'A blistered custard tart in crackling puff pastry, dusted with cinnamon.',
    origin: 'Lisbon, 1830s',
    history: 'Monks at Belém made custard tarts from egg yolks left over after starching their habits with the whites. When the monastery closed, the recipe went to a bakery, and the tart conquered Portugal and its islands.',
    ingredients: ['Puff pastry', 'Egg yolks', 'Cream and milk', 'Sugar and lemon', 'Cinnamon'],
    culture: 'Every café has a tray in the window, burnt spots and all. Cinnamon and icing sugar sit on the counter.',
    tip: 'The darker the blisters, the better the tart.',
    flavor: { sweet: 4, savory: 0, umami: 0, crunch: 4 },
  },
  {
    id: 'picado', name: 'Picado', jp: 'picado', romaji: 'pee-KA-du', stall: 'picado', price: eur(14), dessert: false,
    tagline: 'A sharing platter of beef bites in garlic and wine sauce over chips, eaten with toothpicks.',
    origin: 'Madeira, 1980s',
    history: 'Snack bars round Funchal began cutting beef into bites, frying it with garlic, wine and piri-piri and piling it on chips. It became the island\'s favourite thing to share over beer.',
    ingredients: ['Beef', 'Garlic', 'White wine', 'Piri-piri', 'Chips'],
    culture: 'A platter goes in the middle of the table with a pot of toothpicks. Friends pick at it for an hour.',
    tip: 'Dip the chips in the sauce at the bottom.',
    flavor: { sweet: 0, savory: 5, umami: 4, crunch: 3 },
  },
  {
    id: 'sopatrigo', name: 'Sopa de Trigo', jp: 'sopa de trigo', romaji: 'SO-pa de TREE-gu', stall: 'picado', price: eur(6.5), dessert: false,
    tagline: 'A hearty wheat soup with pork, beans, pumpkin and sweet potato.',
    origin: 'Madeira\'s hills',
    history: 'Up in the villages above Funchal, whole wheat grains, beans and a bit of pork cooked slowly all morning in the fields. The soup is still served on cold days in the snack bars by the market.',
    ingredients: ['Whole wheat grains', 'Pork', 'Beans', 'Pumpkin and sweet potato', 'Couve (kale)'],
    culture: 'Market porters eat it at ten in the morning, before the second half of their day.',
    tip: 'A spoon of piri-piri, then stir.',
    flavor: { sweet: 2, savory: 4, umami: 3, crunch: 1 },
  },
  {
    id: 'gaiado', name: 'Gaiado', jp: 'gaiado', romaji: 'gai-A-du', stall: 'segredo', price: eur(12), dessert: false,
    tagline: 'Skipjack tuna, salted and dried in the sun on the rocks, then grilled with garlic and oil.',
    origin: 'Caniçal and Paul do Mar',
    history: 'Fishing villages dried tuna in the sun for the months when no boats could go out. The salty, smoky fish is now rare, and the few who still make it sell it to people who know to ask.',
    ingredients: ['Sun-dried skipjack', 'Garlic', 'Olive oil', 'Boiled potatoes', 'Onion'],
    culture: 'Nobody puts gaiado on a printed menu. It is something a cook gives you when you have found the right door.',
    tip: 'Small bites, lots of potato, a sip of something cold.',
    flavor: { sweet: 0, savory: 5, umami: 5, crunch: 2 },
  },
  {
    id: 'pudim', name: 'Pudim de Maracujá', jp: 'pudim de maracujá', romaji: 'pu-DEEN de ma-ra-ku-ZHA', stall: 'segredo', price: eur(4.5), dessert: true,
    tagline: 'A wobbly passion fruit pudding glazed with its own seeds.',
    origin: 'Madeira, grandmothers',
    history: 'Every Madeiran family has a passion fruit pudding recipe, and every one says theirs is right. It is made with condensed milk, eggs and the fruit from the vine in the yard.',
    ingredients: ['Passion fruit', 'Condensed milk', 'Eggs', 'Gelatine', 'Sugar'],
    culture: 'It is the dessert of Sunday lunch, cut in wedges, the seeds on top glistening.',
    tip: 'Get a spoonful of the seeds with every bite.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 1 },
  },
];

const desk = (top: number, accent = 0xf4f1ea) => ({ topStyle: 'suit' as const, top, accent, bottom: 0x2b3a62, hat: 'none' as const, backpack: undefined });

export const MADEIRA_STALLS: StallInfo[] = [
  {
    id: 'caco', name: 'Quiosque do Caco', jp: 'quiosque', street: 'Avenida do Mar', vendor: 'Seu Agostinho',
    vendorLook: { skin: 0xc98f6a, hair: 0x2a2220, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f7a5a, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2f7a5a },
    greeting: ['Bom dia! The caco stone is hot. Bread in five minutes, garlic butter in four.', 'A prego? I hammer the garlic in myself. That is why it is called a nail.'],
    dishes: ['bolocaco', 'prego'],
    recipe: {
      dish: 'bolocaco',
      steps: [
        { kind: 'pick', title: 'Make the dough', hint: 'Pick what goes into a bolo do caco.', items: [I('Flour', 'flour'), I('Sweet potato', 'egg'), I('Yeast', 'sugar'), I('Salt', 'sprinkle')], decoys: [I('Soy sauce', 'soy'), I('Chocolate', 'chocolate'), I('Red bean', 'bean')] },
        { kind: 'heat', title: 'Bake on the basalt', hint: 'Flip it when the underside is speckled brown.', rounds: 2, speed: 1.3, label: 'Speckled' },
        { kind: 'order', title: 'Garlic butter', hint: 'Split, butter, garlic, parsley.', items: [I('Split it', 'knife'), I('Butter', 'drop'), I('Garlic', 'garlic'), I('Parsley', 'leek')] },
      ],
    },
  },
  {
    id: 'poncha', name: 'Poncha da Velha', jp: 'bar de poncha', street: 'Rua de Santa Maria', vendor: 'Dona Fátima',
    vendorLook: { skin: 0xd9a27a, hair: 0x3a2a22, hairStyle: 'bun', top: 0x8a2e2a, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, skirt: true, shoes: 0x2a2a2e },
    greeting: ['Uma ponchinha? Honey from my cousin\'s bees in Santana.', 'Watch the caralhinho. Thirty turns, no fewer. Peanut shells go on the floor!'],
    dishes: ['poncha', 'nikita'],
    recipe: {
      dish: 'poncha',
      steps: [
        { kind: 'chop', title: 'Zest the lemons', hint: 'Tap as the knife passes each lemon.', rounds: 3, speed: 1.1 },
        { kind: 'pick', title: 'Into the jug', hint: 'Only four things in a real poncha.', items: [I('Aguardente', 'sake'), I('Honey', 'honey'), I('Lemon juice', 'drop'), I('Zest', 'sprinkle')], decoys: [I('Milk', 'milk'), I('Tomato', 'tomato'), I('Garlic', 'garlic')] },
        { kind: 'mix', title: 'Beat it with the caralhinho', hint: 'Spin the stick between your palms. Fast!', rounds: 7 },
      ],
    },
  },
  {
    id: 'frutas', name: 'Banca da Dona Rosa', jp: 'banca de fruta', street: 'Mercado dos Lavradores', vendor: 'Dona Rosa',
    vendorLook: { skin: 0xc98f6a, hair: 0x2a1d17, hairStyle: 'bun', top: 0xf4f1ea, topStyle: 'apron', accent: 0xd8282e, bottom: 0xd8282e, skirt: true, shoes: 0x2a2a2e, hat: 'scarf', hatColor: 0xd8282e },
    greeting: ['Prove, prove! Taste before you buy. This one tastes like banana, this one like lemon.', 'Anona from Faial, maracujá from my own terrace. Nothing here came on a boat.'],
    dishes: ['maracuja', 'anona'],
    recipe: {
      dish: 'maracuja',
      steps: [
        { kind: 'pick', title: 'Fill the basket', hint: 'Pick the island\'s fruit, nothing imported.', items: [I('Passion fruit', 'mango'), I('Banana', 'banana'), I('Pineapple', 'pineapple'), I('Anona', 'vanilla')], decoys: [I('Rice', 'rice'), I('Soy sauce', 'soy'), I('Cheese', 'cheese')] },
        { kind: 'chop', title: 'Halve the fruit', hint: 'One clean cut through each one.', rounds: 4, speed: 1.2 },
      ],
    },
  },
  {
    id: 'malasadas', name: 'Malasadas da Sé', jp: 'malasadas', street: 'Largo da Sé', vendor: 'Ricardo',
    vendorLook: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'short', top: 0xf2c74a, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x2b3a62, shoes: 0xf2efe7, glasses: true },
    greeting: ['Every day is Carnival at my cart. Malasadas, hot, with cane honey.', 'A Brisa with that? Passion fruit soda, made here since my father was a boy.'],
    dishes: ['malasada', 'brisa'],
    recipe: {
      dish: 'malasada',
      steps: [
        { kind: 'mix', title: 'Beat the dough', hint: 'Slap and fold until it is soft and shiny.', rounds: 6 },
        { kind: 'heat', title: 'Fry until puffed', hint: 'Lift them out when they turn golden.', rounds: 2, speed: 1.5, label: 'Golden' },
        { kind: 'order', title: 'Finish them', hint: 'Drain, roll in sugar, drizzle honey.', items: [I('Drain', 'drop'), I('Roll in sugar', 'sugar'), I('Cane honey', 'honey')] },
      ],
    },
  },
  {
    id: 'espetada', name: 'Casa da Espetada', jp: 'casa de pasto', street: 'Funchal', vendor: 'Senhor Duarte', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x6b6b70, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x6e2a22, bottom: 0x2f2f35, shoes: 0x2a2a2e, moustache: true },
    greeting: ['The laurel branches are from the forest up above Monte. Smell them on the grill.', 'Sit! The skewer hangs over your table, and you help yourself. That is the rule.'],
    dishes: ['espetada', 'milhofrito'],
    recipe: {
      dish: 'espetada',
      steps: [
        { kind: 'chop', title: 'Cut the beef', hint: 'Big cubes. Tap at each line.', rounds: 4, speed: 1.1 },
        { kind: 'pick', title: 'Season it', hint: 'Madeirans keep it simple.', items: [I('Coarse salt', 'sprinkle'), I('Garlic', 'garlic'), I('Bay laurel', 'leek')], decoys: [I('Sugar', 'sugar'), I('Soy sauce', 'soy'), I('Chocolate', 'chocolate')] },
        { kind: 'heat', title: 'Over the embers', hint: 'Turn it when it is crusted, not charred.', rounds: 2, speed: 1.4, label: 'Crusted' },
      ],
    },
  },
  {
    id: 'espada', name: 'Restaurante O Espada', jp: 'restaurante', street: 'Zona Velha', vendor: 'Dona Lurdes', restaurant: true,
    vendorLook: { skin: 0xd9a27a, hair: 0x5a3a2a, hairStyle: 'bob', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2b3a62, bottom: 0x2b3a62, shoes: 0x2a2a2e },
    greeting: ['The espada came up from a thousand metres last night. Ugly fish, beautiful taste.', 'Lapas on the hot pan? You will hear them before you see them.'],
    dishes: ['espada', 'lapas'],
    recipe: {
      dish: 'espada',
      steps: [
        { kind: 'pick', title: 'The plate', hint: 'What goes with espada on Madeira?', items: [I('Black scabbardfish', 'fish'), I('Banana', 'banana'), I('Passion fruit', 'mango'), I('Lemon', 'drop')], decoys: [I('Rice cake', 'rice'), I('Pork', 'pork'), I('Nori', 'nori')] },
        { kind: 'order', title: 'Fry the fillets', hint: 'Lemon, flour, egg, into the pan.', items: [I('Lemon and garlic', 'drop'), I('Flour', 'flour'), I('Egg', 'egg'), I('Pan', 'pot')] },
        { kind: 'heat', title: 'Golden both sides', hint: 'Stop the needle in the golden zone.', rounds: 2, speed: 1.3, label: 'Golden' },
      ],
    },
  },
  {
    id: 'atum', name: 'Marisqueira da Marina', jp: 'marisqueira', street: 'Marina do Funchal', vendor: 'Chef Nuno', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f6fae, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['The tuna boats came in at dawn. Pole and line, one fish at a time.', 'Caldeirada in the pot, for two or for four. Bread for the broth!'],
    dishes: ['atum', 'caldeirada'],
    recipe: {
      dish: 'atum',
      steps: [
        { kind: 'pick', title: 'The marinade', hint: 'Garlic, wine, herbs, oil.', items: [I('Garlic', 'garlic'), I('Wine vinegar', 'drop'), I('Oregano', 'leek'), I('Olive oil', 'drop')], decoys: [I('Honey', 'honey'), I('Banana', 'banana'), I('Miso', 'miso')] },
        { kind: 'heat', title: 'Sear the steak', hint: 'Hot pan, short time.', rounds: 2, speed: 1.6, label: 'Seared' },
      ],
    },
  },
  {
    id: 'tasca', name: 'Tasca do Tomate', jp: 'tasca', street: 'Funchal', vendor: 'Avó Conceição', restaurant: true,
    vendorLook: { skin: 0xe8b894, hair: 0xd2cec6, hairStyle: 'bun', top: 0x2f2f35, topStyle: 'cardigan', accent: 0xf4f1ea, bottom: 0x2f2f35, skirt: true, shoes: 0x2a2a2e },
    greeting: ['Sit down, menino. Soup first, always soup first.', 'The pork has been in the wine and garlic since Thursday. Since Thursday!'],
    dishes: ['sopatomate', 'vinhalhos'],
    recipe: {
      dish: 'sopatomate',
      steps: [
        { kind: 'chop', title: 'Onions and tomatoes', hint: 'Tap at each line.', rounds: 4, speed: 1.0 },
        { kind: 'mix', title: 'Stir the pot', hint: 'Slowly, until the tomatoes fall apart.', rounds: 5 },
        { kind: 'order', title: 'Finish the bowl', hint: 'Potatoes, soup, an egg on top.', items: [I('Potatoes', 'egg'), I('Soup', 'pot'), I('Poach an egg', 'egg')] },
      ],
    },
  },
  {
    id: 'pastelaria', name: 'Pastelaria Bolo de Mel', jp: 'pastelaria', street: 'Funchal', vendor: 'Dona Graça', restaurant: true,
    vendorLook: { skin: 0xf0c6a4, hair: 0x8a5a36, hairStyle: 'ponytail', top: 0xf6e6c8, topStyle: 'apron', accent: 0x6e3a22, bottom: 0x2f2f35, shoes: 0xf2efe7 },
    greeting: ['Break it with your hands, never a knife! My grandmother would come back to haunt me.', 'Queijadas still warm. The star points are the crunchy bit.'],
    dishes: ['bolomel', 'queijada'],
    recipe: {
      dish: 'bolomel',
      steps: [
        { kind: 'pick', title: 'Spice the dough', hint: 'Pick the honey cake\'s spices.', items: [I('Cane honey', 'honey'), I('Cinnamon', 'sprinkle'), I('Walnuts', 'bean'), I('Candied peel', 'sprinkle')], decoys: [I('Garlic', 'garlic'), I('Soy sauce', 'soy'), I('Fish', 'fish')] },
        { kind: 'mix', title: 'Work the dough', hint: 'It is heavy. Keep going.', rounds: 6 },
        { kind: 'heat', title: 'Bake it slowly', hint: 'Dark, not burnt.', rounds: 1, speed: 1.0, label: 'Dark' },
      ],
    },
  },
  {
    id: 'adega', name: 'Adega Velha', jp: 'adega', street: 'Funchal', vendor: 'Senhor Henrique', restaurant: true,
    vendorLook: { skin: 0xe8b894, hair: 0xb9b6b0, hairStyle: 'short', top: 0x5a2a22, topStyle: 'vest', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x6b4630, glasses: true },
    greeting: ['This cask was filled the year my father was born. Taste. Nutty, no?', 'Malmsey with the broas, Sercial before dinner. Never the other way round.'],
    dishes: ['madeira', 'broas'],
    recipe: {
      dish: 'madeira',
      steps: [
        { kind: 'order', title: 'Taste like a lodge master', hint: 'Look, swirl, smell, sip.', items: [I('Look at the colour', 'eye'), I('Swirl', 'drop'), I('Smell', 'flower'), I('Sip', 'sake')] },
        { kind: 'pick', title: 'Pick the grapes', hint: 'The four noble grapes of Madeira.', items: [I('Sercial', 'drop'), I('Verdelho', 'drop'), I('Boal', 'drop'), I('Malmsey', 'drop')], decoys: [I('Tomato', 'tomato'), I('Rice', 'rice'), I('Banana', 'banana')] },
      ],
    },
  },
  {
    id: 'cafe', name: 'Café da Sé', jp: 'café', street: 'Largo da Sé', vendor: 'Tiago', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x3b2a20, hairStyle: 'spiky', top: 0x2f2f35, topStyle: 'vest', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Uma chinesa? In a glass, like a real Funchalense.', 'The natas come out of the oven every hour, on the hour. Cinnamon is on the counter.'],
    dishes: ['chinesa', 'nata'],
    recipe: {
      dish: 'nata',
      steps: [
        { kind: 'pick', title: 'The custard', hint: 'What goes in a pastel de nata?', items: [I('Egg yolks', 'egg'), I('Milk', 'milk'), I('Sugar', 'sugar'), I('Lemon peel', 'sprinkle')], decoys: [I('Garlic', 'garlic'), I('Fish', 'fish'), I('Soy sauce', 'soy')] },
        { kind: 'heat', title: 'Blister the tops', hint: 'Very hot oven. Stop at the dark spots.', rounds: 2, speed: 1.7, label: 'Blistered' },
      ],
    },
  },
  {
    id: 'picado', name: 'Snack-Bar O Lavrador', jp: 'snack-bar', street: 'Funchal', vendor: 'Rui', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x2a2220, hairStyle: 'short', top: 0x2f7a5a, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x2b3a62, shoes: 0x2a2a2e },
    greeting: ['A picado for the table? Toothpicks in the pot, friends in the chairs.', 'The porters from the market come for the wheat soup at ten. There is always a bowl left.'],
    dishes: ['picado', 'sopatrigo'],
    recipe: {
      dish: 'picado',
      steps: [
        { kind: 'chop', title: 'Cut the beef', hint: 'Small bites. Tap at each line.', rounds: 5, speed: 1.2 },
        { kind: 'pick', title: 'The sauce', hint: 'Garlic, wine and a bit of fire.', items: [I('Garlic', 'garlic'), I('White wine', 'sake'), I('Piri-piri', 'chili'), I('Butter', 'drop')], decoys: [I('Honey', 'honey'), I('Chocolate', 'chocolate'), I('Milk', 'milk')] },
        { kind: 'heat', title: 'Sauté', hint: 'Fast and hot.', rounds: 2, speed: 1.6, label: 'Sizzling' },
      ],
    },
  },
  {
    id: 'segredo', name: 'A Porta Pintada', jp: 'tasca escondida', street: 'Behind a painted door', vendor: 'Tia Amélia', hidden: true, restaurant: true,
    vendorLook: { skin: 0xd9a27a, hair: 0x9a9690, hairStyle: 'bun', top: 0x2f2f35, topStyle: 'apron', accent: 0xe8b04a, bottom: 0x2f2f35, skirt: true, shoes: 0x2a2a2e, hat: 'scarf', hatColor: 0x2f2f35 },
    greeting: ['So the azulejos showed you the door. Sit. I cook what my mother cooked.', 'Gaiado from Paul do Mar, dried on the rocks. You will not find it on any menu.'],
    dishes: ['gaiado', 'pudim'],
    recipe: {
      dish: 'gaiado',
      steps: [
        { kind: 'pick', title: 'Simple and old', hint: 'Fish, fire, oil, garlic.', items: [I('Dried tuna', 'fish'), I('Garlic', 'garlic'), I('Olive oil', 'drop'), I('Potatoes', 'egg')], decoys: [I('Sugar', 'sugar'), I('Cream', 'milk'), I('Chocolate', 'chocolate')] },
        { kind: 'heat', title: 'Over the coals', hint: 'Just warm it through.', rounds: 1, speed: 1.2, label: 'Smoky' },
      ],
    },
  },
];

const initial = (d: { name: string }) => d.name.split(/\s+/).map((w) => w[0]).filter((ch) => ch && ch === ch.toUpperCase()).slice(0, 3).join('');

export const MADEIRA_TEXT: CityText = {
  name: 'Madeira', local: 'Funchal', district: ['Funchal', 'Ilha da Madeira'], sticker: 'Funchal · Madeira',
  loading: ['Painting the doors…', 'Laying the calçada…', 'Bom apetite!'],
  intro: [
    'Day one in Funchal! Black basalt, white walls, jacarandas, and mountains going straight up out of the sea.',
    'Stalls on the seafront, a market full of fruit I have never seen, and the old town where every door is a painting. Every dish is a stamp.',
    'The town climbs the hill in terraces of bananas and vines. Above it all, the cable car swings up to Monte.',
    'Avó Conceição at the tasca said three azulejo tiles hide a door nobody can find…',
  ],
  vendorCalls: ['Prove, prove!', 'Quentinho!', 'Olha o bolo do caco!', 'Fresquinho!', 'Venha provar!', 'Acabadinho de fazer!'],
  charm: {
    icon: 'sparkle', one: 'Azulejo tile', found: 'Blue and white, a passion flower painted on it', seen: 'A tile glints blue', hint: 'Take a closer look',
    first: 'A loose azulejo tile, a passion flower painted in cobalt. Avó said there were three.', next: 'Another one. Its flower points towards the painted doors of Rua de Santa Maria.',
    all: 'All three azulejos found!', allText: 'Laid side by side they make a door, a door painted like a garden, in the old town…', bubble: 'Cobalt on white, glazed by hand.',
  },
  door: { closed: ['A door painted like a garden', 'Look closer'], open: ['The painted door, ajar', 'Step inside'], hint: 'Garlic and woodsmoke behind the paint… Maybe the azulejos know something.' },
  hidden: {
    name: 'A Porta Pintada · Hidden Tasca', local: 'tasca escondida', found: 'You found the tasca behind the painted door. One table, Tia Amélia, and food no menu has.',
    chef: ['A Porta Pintada', 'Sit with Tia Amélia'], exit: 'Back to Rua de Santa Maria',
    friend: 'You know the one. A painted door, one table.', friendHint: 'In the old town, the painted doors… the azulejos know which one.',
  },
  passport: {
    fact: 'Madeira rose out of the Atlantic as a volcano, and Funchal is named after the wild fennel (funcho) the first sailors found on its shore in 1419. Sugar made it rich, wine made it famous, and its levadas carry water across mountains to terraces of bananas and vines.',
    streets: ['Calçada e levadas', 'The pavements are calçada: black basalt and white limestone cobbles laid by hand in waves and stars. Above the town, terraces climb the hill, watered by levadas, stone channels you can walk along for hours.'],
    tips: ['Coffee is a bica, milky coffee in a glass is a chinesa.', 'Bolo de mel is broken by hand, never cut with a knife.', 'Poncha is strong. Sip it, and leave the peanut shells on the floor.', 'Say “com licença” when you squeeze past someone.'],
    words: [['Bom dia', 'Good morning'], ['Obrigado / Obrigada', 'Thank you'], ['Que delícia!', 'Delicious!'], ['Saúde', 'Cheers']],
  },
  country: 'Portugal', flag: 'pt', region: 'Ilha da Madeira · Portugal',
  stamp: { city: 'FUNCHAL', mark: initial },
  sign: { kind: 'awning', color: '#2f7a5a' },
  finds: false,
  thanks: 'Obrigado, estava uma delícia!',
  panels: { settings: 'Definições', notes: 'Novidades' },
  hiddenKind: 'Hidden tasca',
  meal: { serve: ['Aqui está!', 'Here you go!', 'Bom apetite!', 'Faz favor!'], start: 'Bom apetite!', startDrink: 'Saúde!', yum: ['Que delícia!', 'Está ótimo!', 'Mmm, maravilha!'], yumDrink: 'Ahh, que fresquinho!' },
  nap: 'Two hours later, fresh as the Atlantic.',
  tea: { icon: 'coffee', view: 'Look out over the bay', name: 'Coffee pot', act: 'Make a little coffee', title: 'Café', text: 'The little pot bubbles. A spoon of sugar, the shutters open, the bay and the cruise ships below.' },
  money: (n) => `€${(n / YEN_PER_EURO).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
  currency: '€',
};

export const MADEIRA_IDLERS: Record<string, Idler> = {
  avo: {
    id: 'avo', name: 'Avó Conceição',
    look: { skin: 0xe8b894, hair: 0xd2cec6, hairStyle: 'bun', top: 0x2f2f35, topStyle: 'cardigan', accent: 0x6a4a8a, bottom: 0x2f2f35, skirt: true, shoes: 0x2a2a2e },
    lines: [
      'Bem-vindo, menino! Have you eaten? A bolo do caco at least. You look pale.',
      'My mother said three azulejo tiles were hidden round Funchal by a tile painter in love. Find them and a door will open for you.',
      'One looks at the Sé from the square. One hides by the boats in the marina. The third is in the market, among the fruit.',
    ],
  },
  pescador: {
    id: 'pescador', name: 'Zé the fisherman',
    look: { skin: 0xb07a52, hair: 0x6b6b70, hairStyle: 'short', top: 0x2f6fae, topStyle: 'vest', accent: 0xf4f1ea, bottom: 0x4a4a52, shorts: true, shoes: 0x6b4630, hat: 'beanie', hatColor: 0x8a2e2a },
    lines: [
      'Espada lives a kilometre down. We fish it at night with lines two kilometres long.',
      'The tuna come in summer. Pole and line, one at a time. My grandfather did it the same way.',
      'See the mountains? Clouds come in every afternoon and sit on them like a hat.',
    ],
  },
  levadeiro: {
    id: 'levadeiro', name: 'Senhor Manuel the levadeiro',
    look: { skin: 0xc98f6a, hair: 0x3b2a20, hairStyle: 'short', top: 0x5a7a3a, topStyle: 'vest', accent: 0xf4f1ea, bottom: 0x5a4a3a, shoes: 0x6b4630, hat: 'straw', hatColor: 0xd9c08a },
    lines: [
      'I keep the levada running. Two thousand kilometres of channels on this island, all dug by hand.',
      'Follow the water and you will never get lost. It goes round the mountain, never over it.',
      'Bananas down here, vines higher up, laurel forest at the top. The water feeds them all.',
    ],
  },
  bordadeira: {
    id: 'bordadeira', name: 'Dona Isabel the embroiderer',
    look: { skin: 0xf0c6a4, hair: 0x5a3a2a, hairStyle: 'bob', top: 0xf4f1ea, topStyle: 'cardigan', accent: 0x2f63a8, bottom: 0x2b3a62, skirt: true, shoes: 0x2a2a2e, glasses: true },
    lines: [
      'Bordado da Madeira. Every stitch by hand, a tablecloth takes me half a year.',
      'An English wine merchant\'s daughter started it, 1850. Now the whole island embroiders.',
      'The painted doors in Rua de Santa Maria? Artists did them so the old street would not die. It worked.',
    ],
  },
  turista: {
    id: 'turista', name: 'Greta from Hamburg',
    look: { skin: 0xf6d2b4, hair: 0xe8c890, hairStyle: 'ponytail', top: 0xe8743a, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x3a5a7a, shorts: true, shoes: 0xf2efe7, hat: 'bucket', hatColor: 0xf4f1ea, backpack: 0x2f7a5a },
    lines: [
      'I came for a week of levada walks. Then I found the poncha bars. Now my legs only walk to Zona Velha.',
      'Take the cable car to Monte and come down in the wicker toboggan! Two men in straw hats steer it. Terrifying!',
      'The market! I bought a fruit that tastes like pineapple and banana at once. Nobody could tell me its name.',
    ],
  },
  padre: {
    id: 'padre', name: 'Padre António',
    look: { skin: 0xe0ac86, hair: 0x6b6b70, hairStyle: 'short', top: 0x1f1f24, topStyle: 'suit', accent: 0xf4f1ea, bottom: 0x1f1f24, shoes: 0x1f1f24, glasses: true },
    lines: [
      'Look up inside the Sé. The ceiling is cedar, carved with ivory, five hundred years old.',
      'King Manuel paid for this cathedral with sugar money. Sugar was white gold then.',
      'On the Feast of the Assumption the whole island walks up to Monte to light a candle.',
    ],
  },
};

export const MADEIRA_CHAT = [
  'Vamos à poncha logo?',
  'The bolo do caco on the avenida, the green kiosk, go.',
  'These hills, my God!',
  'Look, the cruise ship is in.',
  'My uncle has bananas up in São Martinho.',
  'A sério? Seriously?',
  'Clouds on Pico do Arieiro again.',
  'Sunday we walk the levada to Monte.',
  'Mãe is waiting with the espetada.',
  'Até logo, see you at the market.',
  'Smells like garlic butter down there.',
  'The jacarandas are early this year.',
];
export const MADEIRA_GREET: Record<'morning' | 'day' | 'evening', string[]> = {
  morning: ['Bom dia!', 'Good morning!', 'Uma bica já?'],
  day: ['Olá!', 'Boa tarde!', 'Enjoying Funchal?'],
  evening: ['Boa noite!', 'Good evening!', 'Que noite bonita!'],
};
export const MADEIRA_STARTLE = ['Ai, cuidado!', 'Com licença!', 'Olha lá!', 'Desculpe!', 'Eh lá!'];
export const MADEIRA_ENVY = ['Que bom aspeto!', 'Where did you find that?', 'Now I want one too...'];
export const MADEIRA_CAT_LINES = ['Miau.', 'The cat blinks at the bay, unimpressed.', 'Purrrr...', 'The cat stretches on the warm black stone.'];

export const MADEIRA_HOTELS: HotelInfo[] = [
  {
    id: 'jacaranda', name: 'Quinta das Jacarandás', jp: 'quinta', street: 'Funchal', theme: 'palazzo', stairs: true,
    blurb: 'An old merchant\'s quinta up the hill, white and black stone, jacarandas at the gate and the whole bay below.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: eur(190) }, { floor: 2, type: 'twin', price: eur(210) }, { floor: 3, type: 'king', price: eur(360) }],
    keeper: 'Senhor Vasconcelos', keeperLook: desk(0x2f4a3a),
    lines: [
      'Bem-vindo! An English wine family built this house in 1820. They knew where to put a window.',
      'From the top room you see the cruise ships come in at dawn, lit up like small towns.',
      'Breakfast is on the terrace under the jacarandas. In spring the tables turn purple.',
    ],
  },
  {
    id: 'cais', name: 'Hotel do Cais', jp: 'hotel', street: 'Marina do Funchal', theme: 'marina', stairs: true,
    blurb: 'A tall harbour house over the marina, green shutters and the masts right under the windows.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: eur(150) }, { floor: 2, type: 'twin', price: eur(160) }, { floor: 3, type: 'king', price: eur(280) }],
    keeper: 'Dona Marta', keeperLook: { ...desk(0x2f6fae), hairStyle: 'bob', hair: 0x3a2a22 },
    lines: [
      'The yachts here have crossed the Atlantic. Some stop for a week and stay a year.',
      'At New Year the fireworks go off all round the bay. From the top room you can see every one.',
      'For dinner, go to the Marisqueira on the quay. Tell Nuno that Marta sent you.',
    ],
  },
  {
    id: 'santamaria', name: 'Residencial Santa Maria', jp: 'residencial', street: 'Rua de Santa Maria', theme: 'pensione', stairs: true,
    blurb: 'A little guesthouse in the old town, its own front door painted with flowers, poncha bars on both sides.',
    lot: [0, 0], style: 'modern', floors: 3,
    rooms: [{ floor: 1, type: 'single', price: eur(70) }, { floor: 2, type: 'double', price: eur(110) }],
    keeper: 'Senhor Jaime', keeperLook: { topStyle: 'vest', top: 0x8a2e2a, accent: 0xf4f1ea, bottom: 0x2f2f35, hat: 'none', hair: 0x6b6b70, backpack: undefined },
    lines: [
      'The street is loud until midnight and silent by one. Then the only sound is the sea.',
      'My door was painted by a student from Lisbon. Every guest takes a photo of it.',
      'Try the poncha next door, but only one. Two at most. Fine, three.',
    ],
  },
  {
    id: 'bordado', name: 'Casa do Bordado', jp: 'casa de hóspedes', street: 'Funchal', theme: 'locanda', stairs: true,
    blurb: 'A family guesthouse where the embroiderers used to work: white linen everywhere, a banana tree in the yard.',
    lot: [0, 0], style: 'modern', floors: 3,
    rooms: [{ floor: 1, type: 'double', price: eur(120) }, { floor: 2, type: 'king', price: eur(190) }],
    keeper: 'Dona Isilda', keeperLook: { topStyle: 'cardigan', top: 0x2f63a8, accent: 0xf4f1ea, bottom: 0x2f2f35, hat: 'none', hairStyle: 'bun', hair: 0x8a8a8e, backpack: undefined, glasses: true },
    lines: [
      'Every pillowcase in this house was embroidered by my mother. Please do not drool on them.',
      'The bananas in the yard are ours. Take one in the morning, they are better than any in the shops.',
      'Walk up the hill after breakfast and you will find a levada. Follow it, it goes all the way to Monte.',
    ],
  },
  {
    id: 'se', name: 'Pensão da Sé', jp: 'pensão', street: 'Largo da Sé', theme: 'inn', stairs: true,
    blurb: 'An old pension beside the cathedral, its bells marking the hours and the calçada square under the windows.',
    lot: [0, 0], style: 'modern', floors: 3,
    rooms: [{ floor: 1, type: 'twin', price: eur(95) }, { floor: 2, type: 'double', price: eur(125) }],
    keeper: 'Senhor Albino', keeperLook: { topStyle: 'cardigan', top: 0x6e4a32, accent: 0xf4f1ea, bottom: 0x2f2f35, hat: 'none', hair: 0xb9b6b0, backpack: undefined },
    lines: [
      'The Sé rings every hour. After the first night, you will sleep through it. Mostly.',
      'The cathedral ceiling is cedar from the island\'s own forests. Ask Padre António to show you.',
      'Café da Sé is just there. A chinesa and a nata, and the day can start.',
    ],
  },
  {
    id: 'monte', name: 'Hotel Vista Monte', jp: 'hotel', street: 'Funchal', theme: 'sky', stairs: true,
    blurb: 'A modern hotel high on the terraces, glass along the front, the cable car gliding past the windows.',
    lot: [0, 0], style: 'modern', floors: 4,
    rooms: [{ floor: 1, type: 'double', price: eur(170) }, { floor: 2, type: 'twin', price: eur(180) }, { floor: 3, type: 'king', price: eur(320) }],
    keeper: 'Sofia', keeperLook: { ...desk(0x1f2a3a), hairStyle: 'ponytail', hair: 0x2a1d17 },
    lines: [
      'Wave at the cable car. Half of them wave back.',
      'Above us there are terraces of bananas, then vines, then the laurel forest. Then clouds.',
      'Six hotels in Funchal, and every one has a view. Ours has the highest.',
    ],
  },
];

export const MADEIRA_ROOM_TYPE = {
  single: { name: 'Single room', jp: 'quarto individual', text: 'A small white room with a carved bed, an embroidered cover and the shutters open on the bay.', icon: 'bed' as IconName },
  twin: { name: 'Twin room', jp: 'quarto duplo', text: 'Two beds under white linen, and a window full of rooftops and Atlantic.', icon: 'bed' as IconName },
  double: { name: 'Double room', jp: 'quarto de casal', text: 'A wide bed under an embroidered cover, an armchair by the window, a coffee pot on the side.', icon: 'bed' as IconName },
  king: { name: 'Suite', jp: 'suite', text: 'The best room in the house: the widest bed, a sofa and the whole bay through the windows.', icon: 'crown' as IconName },
  tatami: { name: 'Tatami room', jp: 'tatami', text: '', icon: 'futon' as IconName },
};

export const MADEIRA_HOTEL_GUEST_LINES: string[] = [
  'I asked for a sea view. The owner said every room in Funchal has one. He was right.',
  'The hill to my hotel nearly killed me. Then I saw the view from the window and forgave it.',
  'Six hotels in town, and I want to sleep in all of them. Tomorrow, the quinta on the hill.',
  'The receptionist poured me a glass of Madeira wine at check-in. I like this island.',
  'Leave the shutters open. The cruise ships light up the bay at night.',
  'Breakfast with passion fruit, bolo do caco and the cathedral bells. I am never going home.',
];

export const MADEIRA_GUEST_LINES: string[] = [
  'I ordered espetada and they hung it from a hook over my table. Best thing I have ever eaten off a stick.',
  'Espada with banana. I laughed when I read it. I am not laughing now, I am ordering a second one.',
  'Bolo do caco with garlic butter before every meal. My doctor will hear about this.',
  'The poncha lady made mine with thirty turns of the stick. I counted. I could still count, then.',
  'I tried every passion fruit in the market. The banana one won.',
  'Somebody told me there is a tasca behind one of the painted doors. Nobody would tell me which.',
];

/** Items the Madeira missions give. */
export const MADEIRA_ITEMS: Record<string, { name: string; icon: IconName; desc: string }> = {
  carapuca: { name: 'Carapuça', icon: 'headband', desc: 'The little pointed wool cap of the island\'s farmers, with its tassel on top.' },
  avental: { name: 'Bordado apron', icon: 'towel', desc: 'An apron with Madeira embroidery on the pocket, a gift from a Funchal cook.' },
  caralhinho: { name: 'Caralhinho', icon: 'chopsticks', desc: 'The wooden stick poncha is beaten with. Thirty turns, no fewer.' },
  cesto: { name: 'Wicker basket', icon: 'bag', desc: 'Woven in Camacha, like the toboggans that slide down from Monte.' },
  azulejo: { name: 'Azulejo tile', icon: 'flower', desc: 'A cobalt passion flower on white, the fourth tile of the set.' },
  sussurro: { name: 'A whispered address', icon: 'chat', desc: 'Rua de Santa Maria, the door painted like a garden. Knock twice.' },
  bordado: { name: 'Embroidered napkin', icon: 'towel', desc: 'Six restaurants in Funchal, and one napkin embroidered by hand to remember them by.' },
  goldazulejo: { name: 'Golden azulejo', icon: 'medal', desc: 'Your Madeira passport is complete. The whole island knows your name.' },
};
