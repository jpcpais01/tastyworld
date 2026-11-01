import type { Dish } from './dishes';
import type { StallInfo, Ingredient } from './stalls';
import type { IconName } from '../ui/emblems';
import { lira } from './money';

/**
 * Istanbul's second menu: the lokantas, pide salons, köfte houses, pudding shops, the meyhane, the breakfast house,
 * the coffee house and the lokanta inside the Grand Bazaar, and the street carts (kumpir, lokma, gözleme).
 * Prices are real Istanbul prices of 2026, in lira through the wallet's yen. `jp` holds the Turkish name.
 */

const I = (name: string, icon: IconName): Ingredient => ({ name, icon });

export const ISTANBUL_MORE_DISHES: Dish[] = [
  // ---- Bursalı İskenderci
  {
    id: 'iskender', name: 'İskender Kebap', jp: 'iskender kebap', romaji: 'ees-KEN-der ke-BAP', stall: 'iskenderci', price: lira(650), dessert: false,
    tagline: 'Thin döner over cubes of pide, tomato sauce, sizzling butter poured at the table.',
    origin: 'Bursa, 1867',
    history: 'İskender Efendi of Bursa turned the lamb spit upright and shaved it thin, and his family still runs the shop by the old covered market. His plate of meat over bread, sauce and browned butter is copied in every city of Turkey.',
    ingredients: ['Thin-shaved lamb döner', 'Cubes of soft pide', 'Tomato sauce', 'Browned sheep\'s butter', 'Thick yoghurt', 'Roast pepper and tomato'],
    culture: 'The waiter brings the butter last, still foaming in a little copper pan, and pours it over the plate in front of you. Then, by custom, nobody talks until the plate is clean.',
    tip: 'Mix a little yoghurt into each forkful. Afterwards, the house sends a bowl of şıra or a sweet.',
    flavor: { sweet: 1, savory: 5, umami: 5, crunch: 1 },
  },
  {
    id: 'sutlac', name: 'Fırın Sütlaç', jp: 'fırın sütlaç', romaji: 'fuh-RUN sut-LACH', stall: 'iskenderci', price: lira(160), dessert: true,
    tagline: 'Rice pudding baked in a clay bowl until the top is freckled brown.',
    origin: 'Ottoman palace kitchens, 1400s',
    history: 'Rice cooked in milk was a sweet of the palace, served at the Sultan\'s feasts and in the soup kitchens of the mosques. Baking it in a hot oven, so the skin caramelises in leopard spots, is the Istanbul pudding shops\' own touch.',
    ingredients: ['Rice', 'Whole milk', 'Sugar', 'Rice flour', 'Vanilla', 'Cinnamon or hazelnut on top'],
    culture: 'Every lokanta keeps a tray of sütlaç in the cold cabinet by the door. It is eaten cold, even in winter, often straight after a hot kebab.',
    tip: 'Break the brown skin first. It is the part people fight over.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 0 },
  },
  // ---- Urfalı Lahmacun Salonu
  {
    id: 'lahmacun', name: 'Lahmacun', jp: 'lahmacun', romaji: 'LAH-ma-joon', stall: 'lahmacuncu', price: lira(150), dessert: false,
    tagline: 'A paper-thin flatbread spread with spiced minced lamb, rolled round parsley and lemon.',
    origin: 'Şanlıurfa and Gaziantep, southeast Turkey',
    history: 'The name is Arabic for "dough with meat". Cooks from the southeast brought it to Istanbul in the 1960s and 70s, and the long wood ovens of the lahmacun salons have been firing ever since.',
    ingredients: ['Thin wheat dough', 'Minced lamb', 'Tomato and pepper paste', 'Onion and garlic', 'Isot pepper', 'Parsley, lemon, sumac onions'],
    culture: 'You lay parsley, onion and a squeeze of lemon on top, roll it up like a cigar and eat it with your hands. Two or three is a normal lunch.',
    tip: 'It must come straight from the oven, edges crisp. Ask for it acılı for the chilli.',
    flavor: { sweet: 1, savory: 5, umami: 4, crunch: 3 },
  },
  {
    id: 'salgam', name: 'Şalgam Suyu', jp: 'şalgam suyu', romaji: 'shal-GAHM soo-YOO', stall: 'lahmacuncu', price: lira(50), dessert: false, drink: 'cold',
    tagline: 'A dark purple fermented carrot juice, sour and salty, with a pickled carrot in the glass.',
    origin: 'Adana and the south, centuries old',
    history: 'Purple carrots, a handful of bulgur and salt are left to ferment in barrels for weeks. The sour, earthy juice is the south\'s drink with kebabs, and it travelled north with the kebab houses.',
    ingredients: ['Purple carrots', 'Turnip', 'Bulgur', 'Salt', 'Water', 'Hot pepper (acılı) or mild'],
    culture: 'People either love it or cannot finish the glass. Lovers order it hot (acılı), with a long pickled carrot to chew on.',
    tip: 'Take a sip after every bite of lahmacun. It cuts the fat like nothing else.',
    flavor: { sweet: 0, savory: 4, umami: 2, crunch: 1 },
  },
  // ---- Karadenizli Pide Salonu
  {
    id: 'karapide', name: 'Kaşarlı Yumurtalı Pide', jp: 'kaşarlı pide', romaji: 'ka-shar-LUH PEE-deh', stall: 'karadenizli', price: lira(300), dessert: false,
    tagline: 'A boat of bread from the wood oven, full of melted kaşar, a runny egg and butter.',
    origin: 'The Black Sea coast',
    history: 'Bakers from Trabzon and Samsun opened pide salons all over Istanbul. Their canoe-shaped pide, pinched at the ends, is baked on the floor of a wood oven in four minutes.',
    ingredients: ['Wheat dough', 'Kaşar cheese', 'Egg', 'Butter', 'Sucuk or minced meat (optional)'],
    culture: 'The pide comes out of the oven on a long wooden peel, gets a knob of butter rubbed on the crust, and is cut across in strips at the counter.',
    tip: 'Stir the yolk into the cheese, then tear off the crust to dip.',
    flavor: { sweet: 1, savory: 5, umami: 4, crunch: 3 },
  },
  {
    id: 'hamsi', name: 'Hamsi Tava', jp: 'hamsi tava', romaji: 'HAHM-see ta-VAH', stall: 'karadenizli', price: lira(350), dessert: false,
    tagline: 'Black Sea anchovies in a corn-flour crust, fried in a wheel in the pan.',
    origin: 'The Black Sea coast',
    history: 'When the winter shoals of hamsi come down the Bosphorus, the whole coast eats them. There are songs, jokes and a hundred recipes for the little fish, even a sweet one.',
    ingredients: ['Fresh anchovies', 'Coarse corn flour', 'Salt', 'Sunflower oil', 'Red onion and rocket', 'Lemon'],
    culture: 'The fish are laid head to tail in a round pan so they fry into a wheel, then flipped onto a plate in one go.',
    tip: 'Eat them whole, bones and all. Only the head comes off, between two fingers.',
    flavor: { sweet: 0, savory: 4, umami: 4, crunch: 4 },
  },
  // ---- Esnaf Lokantası Kardeşler
  {
    id: 'kurufasulye', name: 'Kuru Fasulye Pilav', jp: 'kuru fasulye', romaji: 'koo-ROO fa-sool-YEH', stall: 'esnaf', price: lira(220), dessert: false,
    tagline: 'White beans slow-cooked with tomato and butter, a mound of buttery rice beside them.',
    origin: 'Anatolia, a national dish',
    history: 'Beans arrived from the Americas in the 1600s and Anatolia took them to heart. Istanbul\'s esnaf lokantaları, the tradesmen\'s canteens, serve beans and rice every single day, and some have done so for a hundred years.',
    ingredients: ['Dried white beans', 'Tomato and pepper paste', 'Onion', 'Butter or pastırma', 'Rice pilaf with orzo'],
    culture: 'In the canteens you point at the steaming trays in the window and the cook fills your plate. Beans and rice, with a pickle and a glass of ayran, is the classic tradesman\'s lunch.',
    tip: 'Mix the beans into the rice on your plate. Everyone does.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 0 },
  },
  {
    id: 'mercimek', name: 'Mercimek Çorbası', jp: 'mercimek çorbası', romaji: 'mer-jee-MEK chor-ba-SUH', stall: 'esnaf', price: lira(110), dessert: false,
    tagline: 'Smooth red lentil soup with a ribbon of pepper butter, lemon on the side.',
    origin: 'Anatolia',
    history: 'Turkey starts the day, ends the night and cures colds with soup. Red lentil is the most loved of all, on every lokanta\'s stove from six in the morning.',
    ingredients: ['Red lentils', 'Onion and carrot', 'Butter', 'Paprika and mint', 'Lemon', 'Bread on the side'],
    culture: 'A bowl comes with all the bread you want. Squeeze in lemon, add chilli flakes from the shaker, and dip.',
    tip: 'Ask for it with a drizzle of pepper butter. It is the cook\'s pride.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 0 },
  },
  // ---- Tarihi Köfteci Selim Usta
  {
    id: 'kofte', name: 'Izgara Köfte', jp: 'ızgara köfte', romaji: 'UHZ-ga-ra kuf-TEH', stall: 'koftecisi', price: lira(380), dessert: false,
    tagline: 'Little grilled meatballs off the charcoal, with roast peppers and a hot pepper sauce.',
    origin: 'Sultanahmet, Istanbul, early 1900s',
    history: 'Köfte shops by the old Hippodrome have fed the workers of the Sultanahmet quarter for over a century. Each keeps its recipe of lamb, beef, bread and onion a family secret.',
    ingredients: ['Lamb and beef mince', 'Stale bread', 'Onion', 'Cumin and black pepper', 'Grilled green pepper and tomato'],
    culture: 'Köfte comes with nothing but bread, a roast pepper and a jar of chilli sauce on the table. Piyaz on the side is almost the law.',
    tip: 'Ask for "bir buçuk", one and a half portions, if you are hungry. It is a normal order.',
    flavor: { sweet: 0, savory: 5, umami: 5, crunch: 2 },
  },
  {
    id: 'piyaz', name: 'Piyaz', jp: 'piyaz', romaji: 'pee-YAHZ', stall: 'koftecisi', price: lira(120), dessert: false,
    tagline: 'White bean salad with onion, parsley, egg and a tahini-vinegar dressing.',
    origin: 'Antalya and Istanbul',
    history: 'The köfte houses of Istanbul serve their bean salad with vinegar and oil, while Antalya pours tahini over it. Many places now do a bit of both.',
    ingredients: ['White beans', 'Red onion with sumac', 'Parsley', 'Boiled egg', 'Tahini, vinegar and olive oil'],
    culture: 'A small plate of piyaz is shared in the middle of the table. It is the cool half of the köfte meal.',
    tip: 'Spoon some onto your bread with a piece of köfte.',
    flavor: { sweet: 1, savory: 3, umami: 2, crunch: 2 },
  },
  // ---- Muhallebici Nurettin
  {
    id: 'tavukgogsu', name: 'Tavuk Göğsü', jp: 'tavuk göğsü', romaji: 'ta-VOOK guh-SOO', stall: 'muhallebici', price: lira(160), dessert: true,
    tagline: 'A silky milk pudding made with chicken breast, dusted with cinnamon.',
    origin: 'Topkapı Palace, 1400s',
    history: 'Chicken pounded into milk was a delicacy of medieval Europe and the Ottoman court alike. Europe forgot it; Istanbul\'s pudding shops kept it, and still beat the threads of chicken into the milk by hand.',
    ingredients: ['Chicken breast, pulled into threads', 'Milk', 'Sugar', 'Rice flour', 'Cinnamon'],
    culture: 'Nobody guesses there is chicken in it. Tell your friends only after they have finished.',
    tip: 'Ask for it with a little cinnamon. The texture is the point: chewy, stretchy, soft.',
    flavor: { sweet: 4, savory: 1, umami: 1, crunch: 0 },
  },
  {
    id: 'kazandibi', name: 'Kazandibi', jp: 'kazandibi', romaji: 'ka-ZAHN-dee-bee', stall: 'muhallebici', price: lira(160), dessert: true,
    tagline: 'The same pudding, burnt on the bottom of the pan on purpose, then rolled up.',
    origin: 'Istanbul pudding shops',
    history: 'The name means "bottom of the cauldron". Cooks scorch the pudding on a hot tray until it caramelises, cut it in strips and roll it so the dark side shows.',
    ingredients: ['Milk pudding (with or without chicken)', 'Sugar', 'Rice flour', 'A scorched caramel base', 'Cinnamon'],
    culture: 'The pudding shops of Istanbul once sold only milk sweets, chicken soup and börek. They were the city\'s cafés before cafés.',
    tip: 'Start from the burnt edge.',
    flavor: { sweet: 4, savory: 0, umami: 1, crunch: 1 },
  },
  // ---- Kahvaltı Evi Nazar
  {
    id: 'menemen', name: 'Menemen', jp: 'menemen', romaji: 'MEN-eh-men', stall: 'kahvaltici', price: lira(220), dessert: false,
    tagline: 'Eggs scrambled into tomato and green pepper, in the little pan they were cooked in.',
    origin: 'Menemen, near İzmir',
    history: 'Named after a town near İzmir, menemen is breakfast across Turkey. The country argues, endlessly and with passion, about whether it should have onion in it.',
    ingredients: ['Eggs', 'Tomatoes', 'Green peppers', 'Butter or olive oil', 'Chilli flakes', 'Onion (or not!)'],
    culture: 'It comes bubbling in a two-handled copper sahan. You eat straight from the pan, scooping with bread.',
    tip: 'Never ask for a fork. Tear the bread and dip.',
    flavor: { sweet: 2, savory: 4, umami: 3, crunch: 0 },
  },
  {
    id: 'kaymak', name: 'Bal Kaymak', jp: 'bal kaymak', romaji: 'BAHL kai-MAHK', stall: 'kahvaltici', price: lira(260), dessert: true,
    tagline: 'Thick clotted buffalo cream with a pool of comb honey, on warm bread.',
    origin: 'Afyon and the buffalo farms of Istanbul',
    history: 'Kaymak is skimmed from buffalo milk simmered for hours and left to set overnight. The water buffalo of the Kağıthane valley once supplied the whole city.',
    ingredients: ['Buffalo milk clotted cream', 'Comb honey', 'Fresh bread', 'Tea alongside'],
    culture: 'A Sunday serpme kahvaltı, the "scattered" breakfast, covers the table with thirty small plates. Bal kaymak is the one everyone reaches for first.',
    tip: 'Spread the kaymak thick, then the honey. Never the other way round.',
    flavor: { sweet: 5, savory: 1, umami: 1, crunch: 0 },
  },
  // ---- Meyhane Kumkapı Akşamı
  {
    id: 'meze', name: 'Meze Tabağı', jp: 'meze tabağı', romaji: 'MEH-zeh ta-ba-UH', stall: 'meyhane', price: lira(450), dessert: false,
    tagline: 'Cold meze to share: haydari, ezme, fava, stuffed vine leaves, white cheese, melon.',
    origin: 'The meyhanes of Kumkapı and Beyoğlu',
    history: 'The meyhane was where Greek, Armenian, Jewish and Turkish Istanbul sat down together. Its meze tray carries all of them: fava from the islands, dolma from the palace, cheese and melon from everywhere.',
    ingredients: ['Haydari (thick yoghurt and herbs)', 'Acılı ezme (spicy tomato)', 'Fava (broad bean purée)', 'Yaprak sarma', 'Beyaz peynir', 'Melon'],
    culture: 'A meyhane night lasts hours. The waiter brings the tray round, you point at what you want, and fish and music follow.',
    tip: 'White cheese and melon is the classic pair. Take both.',
    flavor: { sweet: 2, savory: 4, umami: 3, crunch: 2 },
  },
  {
    id: 'kalamar', name: 'Kalamar Tava', jp: 'kalamar tava', romaji: 'ka-la-MAHR ta-VAH', stall: 'meyhane', price: lira(450), dessert: false,
    tagline: 'Rings of squid fried in a light crust, with garlic walnut tarator sauce.',
    origin: 'The Aegean and the Bosphorus',
    history: 'Fried squid with tarator, a sauce of walnut, bread and garlic, is the first hot meze of the night in every fish meyhane. Tarator itself goes back to the Ottoman kitchen.',
    ingredients: ['Squid rings', 'Flour and beer batter', 'Tarator: walnut, bread, garlic, lemon', 'Lemon wedge'],
    culture: 'It arrives when the cold meze are half gone, a signal that the hot dishes have begun.',
    tip: 'Dip each ring in the tarator and squeeze lemon over the lot.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 4 },
  },
  // ---- Kahveci Muhsin Efendi (Grand Bazaar)
  {
    id: 'kahve', name: 'Türk Kahvesi', jp: 'türk kahvesi', romaji: 'TURK kah-veh-SEE', stall: 'kahveci', price: lira(130), dessert: false, drink: 'hot',
    tagline: 'Coffee as fine as flour, boiled slowly in a copper cezve, served with its foam.',
    origin: 'Istanbul, 1555',
    history: 'Two Syrian merchants opened the first coffee houses in Istanbul in 1555, and the city never looked back. Turkish coffee and its culture are on UNESCO\'s list of the world\'s intangible heritage.',
    ingredients: ['Very finely ground arabica', 'Cold water', 'Sugar (sade, orta or şekerli: none, medium, sweet)', 'A glass of water', 'A piece of lokum'],
    culture: '"A cup of coffee is remembered for forty years," goes the proverb. When the cup is drunk, turn it upside down on its saucer and let a friend read your fortune in the grounds.',
    tip: 'Order orta, medium sweet, and do not drink the last sip: it is the grounds.',
    flavor: { sweet: 2, savory: 1, umami: 1, crunch: 0 },
  },
  {
    id: 'lokum', name: 'Lokum', jp: 'lokum', romaji: 'lo-KOOM', stall: 'kahveci', price: lira(160), dessert: true,
    tagline: 'Turkish delight: soft cubes of rose, lemon and pistachio, dusted with sugar.',
    origin: 'Istanbul, 1777',
    history: 'Hacı Bekir came to Istanbul from the mountains and opened a sweet shop near the Spice Bazaar in 1777. His soft starch-and-sugar lokum was so loved that it travelled to Europe as "Turkish delight".',
    ingredients: ['Sugar', 'Corn starch', 'Rosewater or lemon', 'Pistachios or hazelnuts', 'Powdered sugar'],
    culture: 'A cube of lokum always comes with Turkish coffee. Boxes of it are what every visitor takes home.',
    tip: 'Rose is the classic. Double-roasted pistachio is the treat.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 1 },
  },
  // ---- Kalpakçılar Lokantası (Grand Bazaar)
  {
    id: 'karniyarik', name: 'Karnıyarık', jp: 'karnıyarık', romaji: 'kar-NUH-ya-ruk', stall: 'kalpakcilar', price: lira(300), dessert: false,
    tagline: 'A whole fried aubergine split open and filled with minced meat, tomato and peppers.',
    origin: 'Ottoman Istanbul',
    history: 'The name means "split belly". The Ottoman kitchen used aubergine in more than a hundred dishes, and this baked one is a weekday favourite of every home and lokanta.',
    ingredients: ['Aubergines', 'Minced beef', 'Onion and garlic', 'Tomatoes and green pepper', 'Parsley', 'Rice on the side'],
    culture: 'The bazaar\'s lokantas serve the shopkeepers of the halls at midday. They know when the karnıyarık comes out of the oven and queue for it.',
    tip: 'Eat it with rice and cacık. Hot food, cold yoghurt.',
    flavor: { sweet: 2, savory: 5, umami: 4, crunch: 0 },
  },
  {
    id: 'cacik', name: 'Cacık', jp: 'cacık', romaji: 'jah-JUK', stall: 'kalpakcilar', price: lira(90), dessert: false,
    tagline: 'Cold yoghurt with cucumber, garlic, mint and a thread of olive oil.',
    origin: 'All of Turkey',
    history: 'Yoghurt is a Turkish word and a Turkish gift to the world. Thinned with water and filled with cucumber, it becomes cacık: half salad, half soup, the cooling side of every summer meal.',
    ingredients: ['Yoghurt', 'Cucumber', 'Garlic', 'Dried mint and dill', 'Olive oil', 'Cold water and ice'],
    culture: 'It is eaten with a spoon, sometimes drunk from the bowl, next to anything rich, spicy or fried.',
    tip: 'Pour a little over your rice.',
    flavor: { sweet: 0, savory: 3, umami: 1, crunch: 2 },
  },
  // ---- Kumpirci Ortaköylü (cart)
  {
    id: 'kumpir', name: 'Kumpir', jp: 'kumpir', romaji: 'koom-PEER', stall: 'kumpirci', price: lira(320), dessert: false,
    tagline: 'A giant baked potato, mashed with butter and cheese, piled with twenty toppings.',
    origin: 'Ortaköy, Istanbul, 1990s',
    history: 'The kumpir stands under the Ortaköy mosque by the Bosphorus turned a baked potato into a show. The potato is split, its inside whipped with butter and kaşar, then you point at the toppings one by one.',
    ingredients: ['A huge baked potato', 'Butter and kaşar cheese', 'Corn, olives, pickles', 'Sausage, Russian salad', 'Red cabbage, ketchup and mayonnaise'],
    culture: 'Couples walk the seafront with one kumpir and two forks. Choosing the toppings is half the fun.',
    tip: 'Say "karışık" and you get a bit of everything.',
    flavor: { sweet: 2, savory: 5, umami: 3, crunch: 2 },
  },
  {
    id: 'waffle', name: 'Ortaköy Waffle', jp: 'waffle', romaji: 'VAH-fle', stall: 'kumpirci', price: lira(280), dessert: true,
    tagline: 'A hot waffle buried in chocolate, fruit and crushed pistachio.',
    origin: 'Ortaköy, Istanbul, 2000s',
    history: 'Next to the kumpir stands, the waffle stands grew up, and the pair became the seafront\'s evening ritual. The waffle is folded, painted with chocolate and covered edge to edge.',
    ingredients: ['Waffle batter', 'Milk and dark chocolate', 'Banana, strawberry, kiwi', 'Crushed pistachio', 'Coconut and sprinkles'],
    culture: 'Kumpir first, waffle after, then a walk along the water. It is what young Istanbul does on a summer night.',
    tip: 'Eat it folded in its paper, chocolate side up.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 2 },
  },
  // ---- Lokmacı Hayri (cart)
  {
    id: 'lokma', name: 'Lokma', jp: 'lokma', romaji: 'lok-MAH', stall: 'lokmaci', price: lira(100), dessert: true,
    tagline: 'Golden fried dough balls, soaked in syrup, crisp outside and soft within.',
    origin: 'Anatolia and the Aegean, centuries old',
    history: 'Lokma means "a mouthful". The dough is squeezed through the fist and dropped into hot oil, then into syrup. The recipe is close to the honey balls given to the winners of the ancient Olympic games.',
    ingredients: ['Flour, yeast and water batter', 'Sunflower oil', 'Sugar syrup with lemon', 'Cinnamon (optional)'],
    culture: 'When someone dies, or a shop opens, a family pays a lokma cart to fry for the whole street. Free lokma means "say a prayer" or "share our luck".',
    tip: 'Stab them with the little wooden fork while they are still hot.',
    flavor: { sweet: 5, savory: 0, umami: 0, crunch: 3 },
  },
  {
    id: 'boza', name: 'Boza', jp: 'boza', romaji: 'bo-ZAH', stall: 'lokmaci', price: lira(80), dessert: true, drink: 'cold',
    tagline: 'A thick, tangy fermented millet drink, with cinnamon and roasted chickpeas on top.',
    origin: 'Central Asia and Ottoman Istanbul',
    history: 'Boza came west with the Turks from Central Asia. In 1876 a family from the Balkans opened a boza house in Vefa that still serves it from the same marble counter.',
    ingredients: ['Millet', 'Sugar', 'Water', 'Natural ferment', 'Cinnamon', 'Leblebi (roasted chickpeas)'],
    culture: 'On cold winter nights the bozacı walks the streets calling "Boo-zaaa!", a sound every old Istanbullu remembers.',
    tip: 'Sprinkle the chickpeas on, a few at a time, and eat them with a spoon as you drink.',
    flavor: { sweet: 3, savory: 0, umami: 1, crunch: 1 },
  },
  // ---- Gözlemeci Ayşe Teyze (cart)
  {
    id: 'gozleme', name: 'Gözleme', jp: 'gözleme', romaji: 'guz-leh-MEH', stall: 'gozlemeci', price: lira(180), dessert: false,
    tagline: 'Hand-rolled dough folded round cheese and spinach, cooked on a domed iron sac.',
    origin: 'Anatolian villages',
    history: 'Village women have rolled yufka dough with a thin rod and cooked it on the convex sac for centuries. In the city they set up their griddles at markets and tea gardens, sitting on cushions as they roll.',
    ingredients: ['Yufka dough', 'White cheese', 'Spinach', 'Potato or minced meat (other fillings)', 'Butter brushed on top'],
    culture: 'Watching the dough go from a ball to a sheet the size of a table, in a minute, with one thin rolling pin, is the show.',
    tip: 'Eat it hot, folded in paper, with a glass of tea.',
    flavor: { sweet: 1, savory: 4, umami: 3, crunch: 3 },
  },
  {
    id: 'cay', name: 'Çay', jp: 'çay', romaji: 'CHAI', stall: 'gozlemeci', price: lira(25), dessert: false, drink: 'hot',
    tagline: 'Black tea from the Black Sea hills, brewed in a double teapot, served in a tulip glass.',
    origin: 'Rize, 1940s',
    history: 'Turkey began growing tea on the rainy hills of Rize only in the 1940s, and now drinks more per person than any country on earth. Coffee was the old drink; tea is the everyday one.',
    ingredients: ['Rize black tea', 'Water', 'A double teapot (çaydanlık)', 'Sugar cubes'],
    culture: 'Tea is offered to customers in shops, to guests in homes and to strangers on the ferry. Saying no once is polite; saying no twice is rare.',
    tip: 'Ask for it açık (light) or demli (strong). Hold the glass by the rim: it is hot.',
    flavor: { sweet: 1, savory: 1, umami: 1, crunch: 0 },
  },
];

export const ISTANBUL_MORE_STALLS: StallInfo[] = [
  {
    id: 'iskenderci', name: 'Bursalı İskenderci', jp: 'İskender Salonu', street: 'Sirkeci', vendor: 'Kerem Usta', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x2b2018, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x8a2a2a, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'none' },
    greeting: ['Hoş geldiniz! Sit, the butter is already on the fire.', 'From Bursa, my grandfather\'s recipe. Do not talk while you eat it, just eat.'],
    dishes: ['iskender', 'sutlac'],
    recipe: {
      dish: 'iskender',
      steps: [
        { kind: 'chop', title: 'Shave the lamb thin', hint: 'Long, thin strokes down the spit.', rounds: 5, speed: 1.2 },
        { kind: 'order', title: 'Build the plate', hint: 'Bread first, then meat, sauce, butter last.', items: [I('Pide cubes', 'flour'), I('Shaved lamb', 'skewer'), I('Tomato sauce', 'tomato'), I('Yoghurt', 'milk'), I('Sizzling butter', 'drop')] },
        { kind: 'heat', title: 'Brown the butter', hint: 'Stop when it foams and smells of hazelnut.', rounds: 1, speed: 1.4, label: 'Nutty' },
      ],
    },
  },
  {
    id: 'lahmacuncu', name: 'Urfalı Lahmacun Salonu', jp: 'Lahmacun', street: 'Hamidiye Street', vendor: 'Urfalı Mahmut', restaurant: true,
    vendorLook: { skin: 0xc98f6a, hair: 0x1d1a1c, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Buyurun! Thin as paper, hot as the oven. How many, two? Three?', 'Lemon, parsley, roll it up. Şalgam? Hot or mild?'],
    dishes: ['lahmacun', 'salgam'],
    recipe: {
      dish: 'lahmacun',
      steps: [
        { kind: 'pick', title: 'The topping', hint: 'Lamb, onion, tomato, pepper paste.', items: [I('Minced lamb', 'pork'), I('Onion', 'garlic'), I('Tomato', 'tomato'), I('Pepper paste', 'paste')], decoys: [I('Chocolate', 'chocolate'), I('Banana', 'banana'), I('Seaweed', 'nori')] },
        { kind: 'mix', title: 'Knead the mince', hint: 'Work it with your hands until it is smooth.', rounds: 5 },
        { kind: 'heat', title: 'Into the wood oven', hint: 'Crisp edges, two minutes, no more.', rounds: 2, speed: 1.5, label: 'Crisp' },
      ],
    },
  },
  {
    id: 'karadenizli', name: 'Karadenizli Pide Salonu', jp: 'Pide Salonu', street: 'Eminönü', vendor: 'Rizeli Temel', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0x3b2a20, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2b4c86, bottom: 0x2b3a62, shoes: 0x2a2a2e, hat: 'cap', hatColor: 0x2b3a62 },
    greeting: ['Uşağum, welcome! From Rize, the Black Sea. Pide or hamsi? Both!', 'The hamsi came down the Bosphorus this morning. Fresh, fresh!'],
    dishes: ['karapide', 'hamsi'],
    recipe: {
      dish: 'karapide',
      steps: [
        { kind: 'order', title: 'Shape the boat', hint: 'Roll, fill, pinch, egg.', items: [I('Roll the dough long', 'flour'), I('Spread the kaşar', 'cheese'), I('Pinch the ends', 'flour'), I('Crack an egg in', 'egg')] },
        { kind: 'heat', title: 'Bake on the oven floor', hint: 'Golden crust, runny yolk.', rounds: 2, speed: 1.3, label: 'Golden' },
        { kind: 'pick', title: 'Finish it', hint: 'What goes on as it leaves the oven?', items: [I('Butter', 'drop')], decoys: [I('Honey', 'honey'), I('Soy sauce', 'soy'), I('Ketchup', 'sauce')] },
      ],
    },
  },
  {
    id: 'esnaf', name: 'Esnaf Lokantası Kardeşler', jp: 'Esnaf Lokantası', street: 'Tahtakale', vendor: 'Recep Abi', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0x8a8a8e, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Come, look in the trays! Beans, rice, soup, everything cooked this morning.', 'Forty years we have fed the shopkeepers here. Sit, I bring bread.'],
    dishes: ['kurufasulye', 'mercimek'],
    recipe: {
      dish: 'mercimek',
      steps: [
        { kind: 'pick', title: 'Into the pot', hint: 'Lentils, onion, carrot, butter.', items: [I('Red lentils', 'bean'), I('Onion', 'garlic'), I('Carrot', 'tomato'), I('Butter', 'drop')], decoys: [I('Sugar', 'sugar'), I('Seaweed', 'nori'), I('Vanilla', 'vanilla')] },
        { kind: 'mix', title: 'Blend it smooth', hint: 'Round and round until silky.', rounds: 6 },
        { kind: 'heat', title: 'Pepper butter', hint: 'Sizzle the paprika, do not burn it.', rounds: 1, speed: 1.4, label: 'Red' },
      ],
    },
  },
  {
    id: 'koftecisi', name: 'Tarihi Köfteci Selim Usta', jp: 'Köfteci', street: 'Mimar Kemalettin', vendor: 'Selim Usta', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'none', glasses: true },
    greeting: ['Since 1928! The recipe? Even my son does not know it all.', 'Köfte, piyaz, bread. Nothing else, because nothing else is needed.'],
    dishes: ['kofte', 'piyaz'],
    recipe: {
      dish: 'kofte',
      steps: [
        { kind: 'pick', title: 'The secret mix', hint: 'Meat, bread, onion, spice.', items: [I('Lamb and beef', 'pork'), I('Stale bread', 'flour'), I('Onion', 'garlic'), I('Cumin', 'sprinkle')], decoys: [I('Sugar', 'sugar'), I('Mango', 'mango'), I('Wasabi', 'paste')] },
        { kind: 'mix', title: 'Knead and rest', hint: 'Knead long, so they hold on the grill.', rounds: 6 },
        { kind: 'flip', title: 'Over the charcoal', hint: 'Turn each köfte when it is browned.', rounds: 6 },
      ],
    },
  },
  {
    id: 'muhallebici', name: 'Muhallebici Nurettin', jp: 'Muhallebici', street: 'Uzunçarşı', vendor: 'Nurettin Bey', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'jacket', accent: 0x2f6b54, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'none', glasses: true },
    greeting: ['Welcome, welcome! A pudding? There is chicken in this one. No, really. Try it.', 'My father beat the milk by hand. So do I. Machines make it rubbery.'],
    dishes: ['tavukgogsu', 'kazandibi'],
    recipe: {
      dish: 'kazandibi',
      steps: [
        { kind: 'pick', title: 'The pudding', hint: 'Milk, sugar, rice flour.', items: [I('Milk', 'milk'), I('Sugar', 'sugar'), I('Rice flour', 'flour')], decoys: [I('Garlic', 'garlic'), I('Chilli', 'chili'), I('Soy sauce', 'soy')] },
        { kind: 'mix', title: 'Stir without stopping', hint: 'Steady circles, or it catches.', rounds: 7 },
        { kind: 'heat', title: 'Burn the bottom', hint: 'Dark caramel, not black.', rounds: 1, speed: 1.2, label: 'Caramel' },
      ],
    },
  },
  {
    id: 'kahvaltici', name: 'Kahvaltı Evi Nazar', jp: 'Kahvaltı Evi', street: 'Ankara Avenue', vendor: 'Zeynep Hanım', restaurant: true,
    vendorLook: { skin: 0xeec39f, hair: 0x3b2a20, hairStyle: 'bun', top: 0x8a2a2a, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2f2f35, shoes: 0x2a2a2e },
    greeting: ['Günaydın! Breakfast all day here. Tea is coming.', 'Menemen with onion or without? Careful, people have fallen out over this.'],
    dishes: ['menemen', 'kaymak'],
    recipe: {
      dish: 'menemen',
      steps: [
        { kind: 'chop', title: 'Peppers and tomatoes', hint: 'Small, even pieces.', rounds: 4, speed: 1.0 },
        { kind: 'order', title: 'Into the copper pan', hint: 'Butter, peppers, tomatoes, eggs.', items: [I('Butter', 'drop'), I('Green peppers', 'leek'), I('Tomatoes', 'tomato'), I('Eggs', 'egg')] },
        { kind: 'mix', title: 'Stir the eggs in', hint: 'Gently, keep it soft.', rounds: 4 },
      ],
    },
  },
  {
    id: 'meyhane', name: 'Meyhane Kumkapı Akşamı', jp: 'Meyhane', street: 'Kennedy Avenue', vendor: 'Aleko Usta', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x8a8a8e, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'vest', accent: 0x2b2b30, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'none' },
    greeting: ['Akşamlar hayırlı olsun! The meze tray is coming round, point at what you like.', 'Fish, music, friends. A meyhane night never ends early.'],
    dishes: ['meze', 'kalamar'],
    recipe: {
      dish: 'kalamar',
      steps: [
        { kind: 'chop', title: 'Cut the rings', hint: 'Even rings across the squid.', rounds: 5, speed: 1.2 },
        { kind: 'pick', title: 'The tarator', hint: 'Walnut, bread, garlic, lemon.', items: [I('Walnuts', 'crumbs'), I('Bread', 'flour'), I('Garlic', 'garlic'), I('Lemon', 'drop')], decoys: [I('Chocolate', 'chocolate'), I('Strawberry', 'strawberry'), I('Miso', 'miso')] },
        { kind: 'flip', title: 'Fry the rings', hint: 'Pull each one out when it turns pale gold.', rounds: 5 },
      ],
    },
  },
  {
    id: 'kahveci', name: 'Kahveci Muhsin Efendi', jp: 'Kahvehane', street: 'Grand Bazaar', vendor: 'Muhsin Efendi', restaurant: true,
    vendorLook: { skin: 0xd8a07a, hair: 0xb9b6b0, hairStyle: 'short', top: 0x5a4a3a, topStyle: 'vest', accent: 0x8a2a2a, bottom: 0x2b2b30, shoes: 0x2a2a2e, hat: 'none', glasses: true },
    greeting: ['Sit, sit. Sade, orta, şekerli? Coffee takes its time, so do I.', 'When you finish, turn the cup over. My wife reads the grounds on Thursdays.'],
    dishes: ['kahve', 'lokum'],
    recipe: {
      dish: 'kahve',
      steps: [
        { kind: 'order', title: 'Fill the cezve', hint: 'Cold water, coffee, sugar, then the flame.', items: [I('Cold water', 'drop'), I('Fine coffee', 'coffee'), I('Sugar', 'sugar'), I('Low flame', 'fire')] },
        { kind: 'mix', title: 'Stir once, gently', hint: 'Only until it dissolves.', rounds: 3 },
        { kind: 'heat', title: 'Raise the foam', hint: 'Lift it off just before it boils over.', rounds: 2, speed: 1.5, label: 'Foam' },
      ],
    },
  },
  {
    id: 'kalpakcilar', name: 'Kalpakçılar Lokantası', jp: 'Çarşı Lokantası', street: 'Grand Bazaar', vendor: 'Hayriye Abla', restaurant: true,
    vendorLook: { skin: 0xe0ac86, hair: 0x2b2018, hairStyle: 'bun', top: 0xf4f1ea, topStyle: 'apron', accent: 0x2f6b54, bottom: 0x2f2f35, shoes: 0x2a2a2e, hat: 'none' },
    greeting: ['The shopkeepers come at noon, so you came at the right time. Karnıyarık is just out.', 'Hot food, cold cacık. That is how the bazaar eats.'],
    dishes: ['karniyarik', 'cacik'],
    recipe: {
      dish: 'karniyarik',
      steps: [
        { kind: 'heat', title: 'Fry the aubergines', hint: 'Soft and glossy, turn them as they brown.', rounds: 2, speed: 1.2, label: 'Soft' },
        { kind: 'chop', title: 'Onion, pepper, tomato', hint: 'Chop fine for the filling.', rounds: 4, speed: 1.1 },
        { kind: 'order', title: 'Stuff and bake', hint: 'Split, fill, top, bake.', items: [I('Split the belly', 'knife'), I('Fill with meat', 'pork'), I('Tomato and pepper on top', 'tomato'), I('Into the oven', 'fire')] },
      ],
    },
  },
  {
    id: 'kumpirci', name: 'Kumpirci Ortaköylü', jp: 'Kumpir', street: 'Bosphorus Quay', vendor: 'Ortaköylü Barış',
    vendorLook: { skin: 0xeec39f, hair: 0x2b2018, hairStyle: 'spiky', top: 0x2b4c86, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x2b3a62, shoes: 0xf2efe7, hat: 'cap', hatColor: 0xc8372d },
    greeting: ['Kumpir! Biggest potatoes in Istanbul! Pick, pick, I fill.', 'Waffle after? Everybody says no, then everybody comes back.'],
    dishes: ['kumpir', 'waffle'],
    recipe: {
      dish: 'kumpir',
      steps: [
        { kind: 'mix', title: 'Whip the inside', hint: 'Butter and kaşar into the hot potato.', rounds: 5 },
        { kind: 'pick', title: 'The toppings', hint: 'Choose the ones that belong on a kumpir.', items: [I('Corn', 'corn'), I('Olives', 'bean'), I('Pickles', 'pickles'), I('Sausage', 'pork')], decoys: [I('Chocolate', 'chocolate'), I('Red bean paste', 'paste'), I('Honey', 'honey')] },
        { kind: 'order', title: 'Dress it', hint: 'Toppings, then the sauces.', items: [I('Spoon on the toppings', 'mixbowl'), I('Ketchup', 'sauce'), I('Mayonnaise', 'mayo')] },
      ],
    },
  },
  {
    id: 'lokmaci', name: 'Lokmacı Hayri', jp: 'Lokma', street: 'Eminönü Square', vendor: 'Hayri Amca',
    vendorLook: { skin: 0xd8a07a, hair: 0xb9b6b0, hairStyle: 'short', top: 0xf4f1ea, topStyle: 'apron', accent: 0xf4f1ea, bottom: 0x3a3a40, shoes: 0x2a2a2e, hat: 'chef', hatColor: 0xf4f1ea },
    greeting: ['Lokma, hot from the oil! Today they are on the house of the bakery owner. His shop opened!', 'Boza in the evening, lokma all day. Take a fork.'],
    dishes: ['lokma', 'boza'],
    recipe: {
      dish: 'lokma',
      steps: [
        { kind: 'mix', title: 'Beat the batter', hint: 'Until it stretches and bubbles.', rounds: 6 },
        { kind: 'flip', title: 'Squeeze and fry', hint: 'Tap each ball when it turns golden.', rounds: 8 },
        { kind: 'pick', title: 'Into the syrup', hint: 'What do they swim in?', items: [I('Sugar syrup', 'honey'), I('Lemon', 'drop')], decoys: [I('Soy sauce', 'soy'), I('Ketchup', 'sauce'), I('Miso', 'miso')] },
      ],
    },
  },
  {
    id: 'gozlemeci', name: 'Gözlemeci Ayşe Teyze', jp: 'Gözleme', street: 'Golden Horn Quay', vendor: 'Ayşe Teyze',
    vendorLook: { skin: 0xe0ac86, hair: 0x3b2a20, hairStyle: 'bun', top: 0x8a5a7a, topStyle: 'cardigan', accent: 0xf4f1ea, bottom: 0x4a3a5a, shoes: 0x2a2a2e, hat: 'none' },
    greeting: ['Come, child, sit. Cheese or spinach? I roll it fresh.', 'Tea is ready too. Here, take a glass, you look tired.'],
    dishes: ['gozleme', 'cay'],
    recipe: {
      dish: 'gozleme',
      steps: [
        { kind: 'mix', title: 'Roll the yufka', hint: 'Round and round with the thin rod.', rounds: 6 },
        { kind: 'pick', title: 'The filling', hint: 'Cheese and spinach.', items: [I('White cheese', 'cheese'), I('Spinach', 'leek')], decoys: [I('Chocolate', 'chocolate'), I('Shrimp', 'shrimp'), I('Pineapple', 'pineapple')] },
        { kind: 'heat', title: 'On the sac', hint: 'Turn it when it blisters brown.', rounds: 2, speed: 1.3, label: 'Brown' },
      ],
    },
  },
];
