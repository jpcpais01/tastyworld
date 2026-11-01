import type { Dish } from './dishes';
import type { StallInfo, Ingredient } from './stalls';
import type { IconName } from '../ui/emblems';
import { eur } from './money';

/**
 * Amalfi's second menu: eight more places up the stairs and along the lanes (MORE_FOOD_PLACES in
 * world/amalfiPlan.ts), each with two passport dishes. Prices are real Amalfi Coast prices of 2026, in euros.
 */

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

export const AMALFI_MORE_DISHES: Dish[] = [
  // ---- Salumeria Cuomo
  {
    id: 'tagliere', name: 'Tagliere Misto', jp: 'tagliere', romaji: 'ta-LYE-re MEE-sto', stall: 'salumeria', price: eur(18), dessert: false,
    tagline: 'A board of salame, prosciutto, aged provolone, olives and taralli, to share with a glass of wine.',
    origin: 'Campania, every village',
    history: 'Before refrigerators, a family\'s pig became a year of cured meat hung in the cellar. The salumeria grew out of that habit: the shop where the town bought its salame, its cheese and its olives, and stayed to taste them.',
    ingredients: ['Salame Napoli', 'Prosciutto from the hills', 'Provolone del Monaco', 'Gaeta olives', 'Taralli with fennel'],
    culture: 'Nobody orders a tagliere for one. It arrives on a wooden board in the middle of the table and everybody picks with their fingers.',
    tip: 'The provolone del Monaco is aged in caves. Try it last, it is the strongest.',
    flavor: { sweet: 0, savory: 5, umami: 4, crunch: 2 },
  },
  {
    id: 'panino', name: 'Panino con Mortadella e Provola', jp: 'panino', romaji: 'pa-NEE-no', stall: 'salumeria', price: eur(6.5), dessert: false,
    tagline: 'A crusty roll filled to order with mortadella, smoked provola and rocket.',
    origin: 'Italy, 1900s',
    history: 'Workers on the coast road carried bread and whatever the salumiere would slice into it. The word panino just means little bread, and the filling is whatever is on the counter today.',
    ingredients: ['Cafone bread roll', 'Mortadella', 'Smoked provola', 'Rocket', 'A drop of olive oil'],
    culture: 'You point at what you want on the counter and the salumiere slices it in front of you, paper-thin, on a hand-cranked slicer.',
    tip: 'Ask them to warm the roll so the provola softens.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 3 },
  },
  // ---- Trattoria La Marinella
  {
    id: 'paranza', name: 'Frittura di Paranza', jp: 'frittura di paranza', romaji: 'free-TOO-ra di pa-RAN-tsa', stall: 'marinella', price: eur(16), dessert: false,
    tagline: 'The little fish the boats could not sell, fried whole in a cone of paper.',
    origin: 'Gulf of Salerno, 1800s',
    history: 'The paranza was a pair of fishing boats dragging one net between them. The smallest fish they caught were too small to sell, so the fishermen\'s wives fried them whole and the town learned to love them.',
    ingredients: ['Red mullet, picarel and baby hake', 'Semolina flour', 'Olive oil', 'Sea salt', 'Lemon'],
    culture: 'You eat everything, heads and bones. Small fish fried hard enough go crisp all the way through.',
    tip: 'Squeeze the lemon at the last second, or the crust goes soft.',
    flavor: { sweet: 0, savory: 4, umami: 4, crunch: 5 },
  },
  {
    id: 'impepata', name: 'Impepata di Cozze', jp: 'impepata di cozze', romaji: 'im-pe-PA-ta di KOT-tse', stall: 'marinella', price: eur(14), dessert: false,
    tagline: 'Mussels opened in a hot pan with nothing but black pepper, garlic and their own sea water.',
    origin: 'Naples and its coast',
    history: 'It was the cheapest dish in the fishermen\'s quarters: mussels from the rocks, a pan and a lot of pepper. A Neapolitan saying claims it is what the poor ate on the Thursday before Easter, and the rich copied them.',
    ingredients: ['Mussels', 'A lot of black pepper', 'Garlic', 'Parsley', 'Grilled bread'],
    culture: 'The juice at the bottom is the best part. The bread is there to mop it up, and nobody uses a fork for that.',
    tip: 'Use an empty shell as tweezers to pull the next mussel out.',
    flavor: { sweet: 1, savory: 4, umami: 5, crunch: 1 },
  },
  // ---- Osteria del Campanile
  {
    id: 'genovese', name: 'Ziti alla Genovese', jp: 'ziti alla genovese', romaji: 'DZEE-tee al-la je-no-VE-ze', stall: 'osteria', price: eur(15), dessert: false,
    tagline: 'Long pasta broken by hand under onions and beef cooked down for six hours until sweet.',
    origin: 'Naples, 1400s',
    history: 'Despite the name it has nothing to do with Genoa. One story says Genoese cooks at the port of Naples first made it, another that a cook called Genovese did. Either way it is a Neapolitan Sunday dish.',
    ingredients: ['Ziti pasta', 'Two kilos of golden onions', 'Beef shin', 'White wine', 'Parmigiano'],
    culture: 'The ziti are long tubes that you snap into short pieces with your hands before they go in the water. The whole family helps.',
    tip: 'The onions melt into a brown cream. Black pepper on top and nothing else.',
    flavor: { sweet: 3, savory: 4, umami: 5, crunch: 0 },
  },
  {
    id: 'pastafagioli', name: 'Pasta e Fagioli', jp: 'pasta e fagioli', romaji: 'PA-sta e fa-JO-lee', stall: 'osteria', price: eur(11), dessert: false,
    tagline: 'Mixed broken pasta and borlotti beans cooked together until thick enough to hold a spoon.',
    origin: 'Southern Italy',
    history: 'Pasta mista was the broken ends at the bottom of every pasta sack, sold cheap. Cooked with beans, it fed families through the winter, and it is still how a grandmother says she loves you.',
    ingredients: ['Mixed broken pasta', 'Borlotti beans', 'Celery and garlic', 'A rind of parmesan', 'Olive oil'],
    culture: 'In Naples they say it should be azzeccata: so thick it sticks together. A watery one is sent back.',
    tip: 'A thread of raw olive oil on top just before eating.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 0 },
  },
  // ---- Graffe di Maria
  {
    id: 'graffa', name: 'Graffa Napoletana', jp: 'graffa', romaji: 'GRAF-fa', stall: 'graffe', price: eur(2), dessert: true,
    tagline: 'A potato-dough doughnut, fried until golden and rolled in sugar while hot.',
    origin: 'Naples, 1800s',
    history: 'The name comes from the Austrian Krapfen, brought by the Habsburg court. Neapolitan bakers added potato to the dough, which keeps it soft and light, and made it their own.',
    ingredients: ['Flour', 'Boiled potato', 'Yeast', 'Lemon zest', 'Granulated sugar'],
    culture: 'Morning snack, afternoon snack, the snack on the walk home from the beach. You will see sugar on half the shirts in town.',
    tip: 'Ask for one from the newest batch and eat it standing outside.',
    flavor: { sweet: 4, savory: 1, umami: 0, crunch: 2 },
  },
  {
    id: 'struffoli', name: 'Struffoli', jp: 'struffoli', romaji: 'STROOF-fo-lee', stall: 'graffe', price: eur(4.5), dessert: true,
    tagline: 'Hundreds of tiny fried dough balls bound in honey and covered in sprinkles.',
    origin: 'Naples, possibly from Greek settlers',
    history: 'The Greeks who founded Naples are said to have brought fried honey balls with them. Nuns in the convents kept the recipe and made them as Christmas gifts for noble families.',
    ingredients: ['Flour and eggs', 'Honey', 'Candied orange and citron', 'Coloured sprinkles', 'Limoncello in the dough'],
    culture: 'At Christmas every home has a ring of struffoli on the table. Here they make them all year for the visitors who ask.',
    tip: 'Break a piece off the ring with a spoon. Your fingers will be sticky either way.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 3 },
  },
  // ---- Il Chiosco dei Limoni
  {
    id: 'sorbetto', name: 'Sorbetto nel Limone', jp: 'sorbetto al limone', romaji: 'sor-BET-to', stall: 'chiosco', price: eur(6), dessert: true,
    tagline: 'Lemon sorbet served inside a hollowed-out Amalfi lemon.',
    origin: 'Amalfi Coast, 1900s',
    history: 'Snow carried down from the mountains was once mixed with lemon juice and sugar for the rich. The terraced lemon groves above Amalfi made the sorbet cheap, and serving it in its own fruit made it famous.',
    ingredients: ['Amalfi lemon juice and zest', 'Sugar', 'Water', 'The lemon itself'],
    culture: 'The groves above the town climb the cliffs in terraces under chestnut pergolas. The lemons are carried down on men\'s backs.',
    tip: 'Scrape the inside of the peel at the end. That is where the scent is.',
    flavor: { sweet: 3, savory: 0, umami: 0, crunch: 1 },
  },
  {
    id: 'spremuta', name: 'Spremuta di Agrumi', jp: 'spremuta', romaji: 'spre-MOO-ta', stall: 'chiosco', price: eur(5), dessert: false,
    tagline: 'Oranges and lemons squeezed in front of you, poured over ice.',
    origin: 'Southern Italy',
    history: 'Every bar on the coast has a press on the counter and a crate of fruit beside it. On hot days a spremuta is what you drink between the beach and the stairs.',
    ingredients: ['Blood or blond oranges', 'Amalfi lemon', 'Ice'],
    culture: 'In summer the kiosks keep the press going all afternoon. The peels pile up in crates for limoncello makers.',
    tip: 'Ask for half lemon. It is sharp, cold and wakes you up.',
    flavor: { sweet: 3, savory: 0, umami: 0, crunch: 0 },
  },
  // ---- Ristorante Lo Scoglio
  {
    id: 'scoglio', name: 'Spaghetti allo Scoglio', jp: 'spaghetti allo scoglio', romaji: 'SKO-lyo', stall: 'scogliera', price: eur(24), dessert: false,
    tagline: 'Spaghetti with clams, mussels, prawns and squid in a little tomato, all from the rocks.',
    origin: 'Coast of Campania',
    history: 'Scoglio means rock. The dish gathers everything that lives on and around the rocks of the coast, cooked fast in one pan so the pasta drinks up the sea.',
    ingredients: ['Spaghetti', 'Clams and mussels', 'Prawns and squid', 'Cherry tomatoes', 'Garlic, chilli, parsley'],
    culture: 'It comes in the pan it was cooked in, or on a huge plate for two. An empty bowl for the shells comes with it.',
    tip: 'Suck the prawn heads. Locals do, and that is where the flavour is.',
    flavor: { sweet: 2, savory: 4, umami: 5, crunch: 1 },
  },
  {
    id: 'calamari', name: 'Calamari Ripieni', jp: 'calamari ripieni', romaji: 'ka-la-MA-ree ree-PYE-nee', stall: 'scogliera', price: eur(20), dessert: false,
    tagline: 'Whole squid stuffed with bread, cheese, capers and olives, braised in tomato.',
    origin: 'Amalfi Coast',
    history: 'Nothing was wasted: the squid\'s tentacles were chopped into the stuffing with stale bread and whatever the kitchen had. It became a Christmas Eve dish when meat was not allowed.',
    ingredients: ['Squid', 'Stale bread', 'Pecorino', 'Capers and olives', 'Tomato sauce'],
    culture: 'Each squid is sewn shut with a toothpick so the filling stays in. The cook slices it at the table.',
    tip: 'Mop the sauce with bread. The squid has given it everything.',
    flavor: { sweet: 2, savory: 4, umami: 4, crunch: 1 },
  },
  // ---- Da Titina
  {
    id: 'pastapatate', name: 'Pasta e Patate con la Provola', jp: 'pasta e patate', romaji: 'PA-sta e pa-TA-te', stall: 'titina', price: eur(12), dessert: false,
    tagline: 'Pasta and potatoes cooked together, smoked provola stirred in until it stretches.',
    origin: 'Naples, home kitchens',
    history: 'A dish from the years when meat was rare: potato and pasta, both cheap, cooked in one pot. The provola turned it into a dish people now cross town for.',
    ingredients: ['Mixed pasta', 'Potatoes', 'Smoked provola', 'Celery, onion, tomato', 'A rind of parmesan'],
    culture: 'Nonna\'s kitchen dish. Restaurants that serve it are telling you they cook like home.',
    tip: 'Lift the spoon high. The provola should pull in strings.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 0 },
  },
  {
    id: 'frittatapasta', name: 'Frittata di Pasta', jp: 'frittata di pasta', romaji: 'free-TA-ta di PA-sta', stall: 'titina', price: eur(7), dessert: false,
    tagline: 'Yesterday\'s spaghetti with eggs and cheese, fried into a thick golden cake.',
    origin: 'Naples, home kitchens',
    history: 'Leftover pasta never went in the bin. Mixed with eggs and cheese and fried, it became the dish families carried to the beach on Sundays.',
    ingredients: ['Leftover spaghetti', 'Eggs', 'Parmesan and pecorino', 'Provola', 'Black pepper'],
    culture: 'It is eaten cold as often as hot, in wedges, on a towel on the beach.',
    tip: 'The crust is what you want. Take a wedge from the edge.',
    flavor: { sweet: 0, savory: 4, umami: 3, crunch: 3 },
  },
  // ---- Caseificio Sorrentino
  {
    id: 'bufala', name: 'Mozzarella di Bufala', jp: 'mozzarella di bufala', romaji: 'mot-tsa-REL-la di BOO-fa-la', stall: 'caseificio', price: eur(12), dessert: false,
    tagline: 'A whole buffalo mozzarella made this morning, torn open so the milk runs out.',
    origin: 'Plain of Salerno and Caserta',
    history: 'Water buffalo have grazed the marshes south of Salerno for a thousand years. Their milk is richer than cow\'s, and the curd is stretched by hand in hot water and pinched off: mozzare means to cut off.',
    ingredients: ['Buffalo milk curd', 'Hot water', 'Salt', 'Cherry tomatoes and basil on the side'],
    culture: 'A true bufala is eaten the day it is made and never kept in the fridge. Locals buy it in the morning and eat it at lunch.',
    tip: 'Do not cut it with a knife. Tear it and let the milk out.',
    flavor: { sweet: 2, savory: 3, umami: 3, crunch: 0 },
  },
  {
    id: 'provola', name: 'Provola al Limone', jp: 'provola alla piastra', romaji: 'PRO-vo-la', stall: 'caseificio', price: eur(10), dessert: false,
    tagline: 'Smoked provola grilled on a lemon leaf until it melts, with bread to scoop it.',
    origin: 'Amalfi Coast and Sorrento',
    history: 'Provola is mozzarella\'s smoked cousin, made from the same stretched curd and smoked over straw. Grilling it on a lemon leaf is the coast\'s trick: the leaf scents the cheese without burning it.',
    ingredients: ['Smoked provola', 'Fresh lemon leaves', 'Grilled bread', 'Black pepper'],
    culture: 'Families with lemon trees pick the leaves themselves. The restaurant uses leaves from the grove above it.',
    tip: 'Eat it before it sets. Melted provola waits for no one.',
    flavor: { sweet: 1, savory: 4, umami: 4, crunch: 1 },
  },
];

export const AMALFI_MORE_STALLS: StallInfo[] = [
  {
    id: 'salumeria', name: 'Salumeria Cuomo', jp: 'Salumeria', street: 'Salita dei Mulini', vendor: 'Gennaro', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x3a2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x8a2a22, bottom: 0x2f2f35, shoes: 0x2a2a2e, moustache: true },
    greeting: ['Taste this salame first. Then tell me you want the small board.', 'The provolone hangs in a cave in the hills for a year. It earns its smell.'],
    dishes: ['tagliere', 'panino'],
    recipe: {
      dish: 'panino',
      steps: [
        { kind: 'pick', title: 'Fill the roll', hint: 'What the salumiere slices into it.', items: [I('Mortadella', 'pork'), I('Smoked provola', 'cheese'), I('Rocket', 'leek'), I('Olive oil', 'drop')], decoys: [I('Jam', 'strawberry'), I('Soy sauce', 'soy'), I('Chocolate', 'chocolate')] },
        { kind: 'chop', title: 'Slice it thin', hint: 'Turn the slicer: thin as paper.', rounds: 5, speed: 1.2 },
        { kind: 'heat', title: 'Warm the roll', hint: 'Just until the provola softens.', rounds: 1, speed: 1.3, label: 'Warm' },
      ],
    },
  },
  {
    id: 'marinella', name: 'Trattoria La Marinella', jp: 'Trattoria', street: 'Salita dei Mulini', vendor: 'Salvatore', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x1d1a1c, hairStyle: 'short', top: 0x2f5d9a, topStyle: 'tee', accent: 0xf4f1ea, bottom: 0x3a3a40, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2f5d9a },
    greeting: ['My brother brings the paranza up from the boats every morning. Whatever is small and silver, I fry.', 'Mussels and pepper. My grandmother said if you do not sneeze, you used too little.'],
    dishes: ['paranza', 'impepata'],
    recipe: {
      dish: 'paranza',
      steps: [
        { kind: 'pick', title: 'Coat the fish', hint: 'The coast fries in semolina.', items: [I('Small fish', 'fish'), I('Semolina', 'flour'), I('Sea salt', 'sprinkle')], decoys: [I('Breadcrumbs', 'crumbs'), I('Egg', 'egg'), I('Sugar', 'sugar')] },
        { kind: 'heat', title: 'Into the hot oil', hint: 'Out the moment they go golden.', rounds: 2, speed: 1.5, label: 'Golden' },
        { kind: 'order', title: 'Serve the cone', hint: 'Tap in order.', items: [I('Roll the paper', 'wrap'), I('Fill with fish', 'fish'), I('Salt', 'sprinkle'), I('Lemon on top', 'drop')] },
      ],
    },
  },
  {
    id: 'osteria', name: 'Osteria del Campanile', jp: 'Osteria', street: 'Vicoli di Ponente', vendor: 'Nonna Carmela', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0xcfccc4, hairStyle: 'bun', top: 0x3a3a40, topStyle: 'cardigan', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['The genovese went on the fire at six this morning. Six hours of onions, no shortcuts.', 'Pasta e fagioli should stand up by itself. If it does not, it is soup.'],
    dishes: ['genovese', 'pastafagioli'],
    recipe: {
      dish: 'genovese',
      steps: [
        { kind: 'chop', title: 'The onions', hint: 'A mountain of them. Keep going.', rounds: 6, speed: 1.0 },
        { kind: 'pick', title: 'Into the pot', hint: 'No tomato in a genovese.', items: [I('Onions', 'leek'), I('Beef', 'pork'), I('White wine', 'drop'), I('Ziti', 'flour')], decoys: [I('Tomato', 'tomato'), I('Cream', 'milk'), I('Soy sauce', 'soy')] },
        { kind: 'heat', title: 'Slow, slow', hint: 'Until the onions are a brown cream.', rounds: 3, speed: 0.9, label: 'Melted' },
      ],
    },
  },
  {
    id: 'graffe', name: 'Graffe di Maria', jp: 'Friggitoria', street: 'Piazza Duomo', vendor: 'Maria', restaurant: true,
    vendorLook: { skin: 0xe8b894, hair: 0x5a3a2a, hairStyle: 'ponytail', top: 0xf4f1ea, topStyle: 'apron', accent: 0xe9c23a, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['A graffa still warm, rolled in sugar. Careful, the sugar goes everywhere.', 'Struffoli are a Christmas sweet, but the tourists ask in August. So I make them in August.'],
    dishes: ['graffa', 'struffoli'],
    recipe: {
      dish: 'graffa',
      steps: [
        { kind: 'pick', title: 'The dough', hint: 'The Neapolitan secret is a boiled potato.', items: [I('Flour', 'flour'), I('Boiled potato', 'mixbowl'), I('Yeast', 'sprinkle'), I('Lemon zest', 'drop')], decoys: [I('Rice', 'rice'), I('Tomato', 'tomato'), I('Fish', 'fish')] },
        { kind: 'heat', title: 'Fry the rings', hint: 'Turn them once, golden both sides.', rounds: 2, speed: 1.3, label: 'Golden' },
        { kind: 'mix', title: 'Roll in sugar', hint: 'While they are still hot.', rounds: 4 },
      ],
    },
  },
  {
    id: 'chiosco', name: 'Il Chiosco dei Limoni', jp: 'Chiosco', street: 'Salita dei Mulini', vendor: 'Pasquale', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x6b6b70, hairStyle: 'short', top: 0xf2dc6a, topStyle: 'tee', accent: 0x3f8a32, bottom: 0xf4f1ea, shoes: 0x6b4630, hat: 'straw', hatColor: 0xd9c08a },
    greeting: ['These lemons were on the tree this morning. Up there, on the terraces, see?', 'You climbed all these stairs. You deserve something cold.'],
    dishes: ['sorbetto', 'spremuta'],
    recipe: {
      dish: 'sorbetto',
      steps: [
        { kind: 'chop', title: 'Hollow the lemons', hint: 'Cut the cap, scoop the inside.', rounds: 4, speed: 1.1 },
        { kind: 'pick', title: 'The sorbet', hint: 'Only three things in it.', items: [I('Lemon juice', 'drop'), I('Sugar', 'sugar'), I('Water', 'pot')], decoys: [I('Milk', 'milk'), I('Egg', 'egg'), I('Chocolate', 'chocolate')] },
        { kind: 'mix', title: 'Churn it', hint: 'Keep it moving as it freezes.', rounds: 5 },
      ],
    },
  },
  {
    id: 'scogliera', name: 'Ristorante Lo Scoglio', jp: 'Ristorante', street: 'The Harbour', vendor: 'Chef Enzo', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x2a1d17, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0x2f6fae, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Everything on this plate lived on the rocks below us yesterday.', 'Calamari ripieni, like my mother made on Christmas Eve. I make them every evening.'],
    dishes: ['scoglio', 'calamari'],
    recipe: {
      dish: 'scoglio',
      steps: [
        { kind: 'pick', title: 'From the rocks', hint: 'Everything that lives there.', items: [I('Clams', 'shrimp'), I('Mussels', 'shrimp'), I('Prawns', 'shrimp'), I('Squid', 'squid'), I('Cherry tomatoes', 'tomato')], decoys: [I('Cream', 'milk'), I('Cheese', 'cheese'), I('Pork', 'pork')] },
        { kind: 'heat', title: 'Open the shells', hint: 'Lid on, high heat, just until they open.', rounds: 2, speed: 1.5, label: 'Open' },
        { kind: 'mix', title: 'Toss with spaghetti', hint: 'Finish the pasta in the pan.', rounds: 5 },
      ],
    },
  },
  {
    id: 'titina', name: 'Da Titina', jp: 'Cucina di casa', street: 'Vicoli di Ponente', vendor: 'Titina', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x8a8680, hairStyle: 'bob', top: 0xd9917f, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x3a3a40, shoes: 0x2a2a2e },
    greeting: ['No menu here. I cook what I cooked for my children, and you eat it.', 'The frittata is made with yesterday\'s pasta. In this house nothing is thrown away.'],
    dishes: ['pastapatate', 'frittatapasta'],
    recipe: {
      dish: 'pastapatate',
      steps: [
        { kind: 'chop', title: 'Dice the potatoes', hint: 'Small cubes, they must melt.', rounds: 5, speed: 1.1 },
        { kind: 'pick', title: 'Into the pot', hint: 'Home cooking, nothing fancy.', items: [I('Potatoes', 'mixbowl'), I('Mixed pasta', 'flour'), I('Smoked provola', 'cheese'), I('Tomato', 'tomato')], decoys: [I('Soy sauce', 'soy'), I('Honey', 'honey'), I('Shrimp', 'shrimp')] },
        { kind: 'mix', title: 'Stir in the provola', hint: 'Off the heat, until it strings.', rounds: 4 },
      ],
    },
  },
  {
    id: 'caseificio', name: 'Caseificio Sorrentino', jp: 'Caseificio', street: 'Vicoli di Ponente', vendor: 'Luigi', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x3a2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f7a5a, bottom: 0xf4f1ea, shoes: 0xf4f1ea, hat: 'cap', hatColor: 0xf4f1ea },
    greeting: ['The milk came from the buffalo at Paestum before dawn. The mozzarella was made at seven.', 'Never put a bufala in the fridge. Never. It is a crime.'],
    dishes: ['bufala', 'provola'],
    recipe: {
      dish: 'bufala',
      steps: [
        { kind: 'heat', title: 'Warm the curd', hint: 'Hot water, until it turns elastic.', rounds: 2, speed: 1.2, label: 'Elastic' },
        { kind: 'mix', title: 'Stretch it', hint: 'Pull and fold, pull and fold.', rounds: 5 },
        { kind: 'chop', title: 'Pinch off the balls', hint: 'Mozzare: cut them off by hand.', rounds: 4, speed: 1.1 },
      ],
    },
  },
];
