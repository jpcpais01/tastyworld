import { neoShop } from '../neo/roles';
import type { CityId } from '../world/cityId';
import { CITY } from '../world/cityId';
import type { Look } from '../world/characters';
import { eur, lira, YEN_PER_EURO, YEN_PER_LIRA } from './money';

/**
 * Souvenirs: the things a traveller takes home. Every city has its trades (a carpet shop, a coppersmith, a
 * knife shop on Kappabashi, a limoncello cellar), each with its own catalogue from a few coins to a piece the
 * whole city has only one of. Shops of a trade share the everyday stock; the rare pieces are spread between them
 * and each one-of-a-kind piece sits in a single shop, so it pays to look in more than one.
 */

/** How special a piece is: everyday, well made, rare, or the only one in town. */
export type Tier = 'common' | 'fine' | 'rare' | 'treasure';
export const TIER: Record<Tier, { name: string; rank: number }> = {
  common: { name: 'Everyday', rank: 0 },
  fine: { name: 'Fine', rank: 1 },
  rare: { name: 'Rare', rank: 2 },
  treasure: { name: 'One of a kind', rank: 3 },
};

/** The voxel model a souvenir is drawn with (world/souvenirModels.ts), coloured by up to four colours. */
export type Shape =
  | 'plate' | 'bowl' | 'vase' | 'jug' | 'cup' | 'glass' | 'teapot' | 'cezve' | 'tray' | 'tile' | 'rug' | 'cloth'
  | 'lamp' | 'bottle' | 'jar' | 'box' | 'sweets' | 'sack' | 'soap' | 'bead' | 'coin' | 'ring' | 'book' | 'print'
  | 'scroll' | 'doll' | 'daruma' | 'fan' | 'knife' | 'slippers' | 'boots' | 'bag' | 'basket' | 'hat' | 'flower'
  | 'chime' | 'peppers' | 'top' | 'pouch' | 'stone' | 'cat' | 'clogs' | 'pot';

export interface Souvenir {
  id: string;
  city: CityId;
  trade: string;
  tier: Tier;
  /** In the wallet's yen (data/money.ts), written with the city's currency helper. */
  price: number;
  name: string;
  /** Its name in the local language, when that adds something. */
  local: string;
  text: string;
  shape: Shape;
  cols: number[];
}

export interface Trade {
  id: string;
  city: CityId;
  /** What the shop is, in English and in the local language: "Carpet shop", "Halıcı". */
  label: string;
  local: string;
  /** Words a shop's name is made of: brand + word (English) and the local spelling. */
  word: [string, string];
  /** Haggling is expected (the bazaar): the price on the tag is where the talking starts. */
  haggle?: boolean;
  /** How the keeper hands it over. */
  wrap: string;
  lines: string[];
  keeperLook: Partial<Look>;
  items: Souvenir[];
}

type Row = [id: string, tier: Tier, price: number, shape: Shape, cols: number[], name: string, local: string, text: string];

function trade(city: CityId, id: string, o: Omit<Trade, 'id' | 'city' | 'items'>, rows: Row[]): Trade {
  return {
    id, city, ...o,
    items: rows.map(([iid, tier, price, shape, cols, name, local, text]) => ({ id: `${city[0]}-${id}-${iid}`, city, trade: id, tier, price, shape, cols, name, local, text })),
  };
}

// ------------------------------------------------------------------------------------------------ keepers' clothes
const L = {
  apron: { topStyle: 'apron', top: 0xf2efe7, accent: 0x2f6b54, hat: 'none' },
  indigo: { topStyle: 'apron', top: 0x2b3a62, accent: 0x2b3a62, hat: 'none' },
  samue: { topStyle: 'jacket', top: 0x4a4038, accent: 0x2b2420, hat: 'headband', hatColor: 0xf2efe7 },
  cardigan: { topStyle: 'cardigan', top: 0x8a6a4a, accent: 0x5a4a3a, glasses: true, hat: 'none' },
  bazaar: { topStyle: 'cardigan', top: 0x5a4a3a, accent: 0x8a2a2a, hat: 'none', glasses: true },
  vest: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2b2b30, bottom: 0x2b2b30, hat: 'none' },
  jacket: { topStyle: 'jacket', top: 0x3a3a44, accent: 0x2b2b30, hat: 'none' },
  linen: { topStyle: 'tee', top: 0xf4f1ea, accent: 0xf4f1ea, hat: 'none' },
  stripe: { topStyle: 'apron', top: 0xf4f1ea, accent: 0x2f63a8, hat: 'none' },
  craft: { topStyle: 'apron', top: 0xe8dcc0, accent: 0x8a5a3a, hat: 'none', glasses: true },
} as Record<string, Partial<Look>>;

// ================================================================================================ Tokyo (yen)
const TOKYO: Trade[] = [
  trade('tokyo', 'zakka', {
    label: 'Zakka shop', local: '雑貨', word: ['Zakka', '雑貨'],
    wrap: 'wrapped in crisp paper, folded with a corner tucked just so, and sealed with a little sticker',
    keeperLook: L.apron,
    lines: [
      'Zakka means "many things". If it is small and cheerful and makes a day better, we stock it.',
      'Tourists love the tenugui. Locals use them for everything: wiping sweat, wrapping lunch, even as a headband.',
      'The beckoning cat? Right paw up calls money, left paw up calls customers. Both up is greedy, my mother said.',
      'Omiyage, gifts for home, is serious business here. Everybody brings back something for the office.',
    ],
  }, [
    ['tenugui', 'common', 1100, 'cloth', [0xf4f1ea, 0xd8452f, 0x2b3a62], 'Goldfish tenugui', '手ぬぐい', 'A thin cotton towel printed with goldfish. Hang it as art, wrap a bento in it or tie it round your head.'],
    ['hashi', 'common', 1650, 'knife', [0xb02a22, 0xe8c040, 0x1f1f24], 'Lacquer chopsticks', '箸', 'Red lacquer with a gold sakura petal. Rest them on the holder, never stick them upright in the rice.'],
    ['maneki', 'common', 1800, 'cat', [0xf8f4ea, 0xd8452f, 0xe8b840], 'Maneki-neko', '招き猫', 'A white beckoning cat, right paw raised to call in good fortune.'],
    ['furin', 'common', 2200, 'chime', [0xdcecf2, 0xd8452f, 0xf4f1ea], 'Glass wind chime', '風鈴', 'A fūrin painted from the inside. Its ring is meant to make a hot summer afternoon feel cooler.'],
    ['furoshiki', 'fine', 3300, 'cloth', [0x2b3a62, 0xf4f1ea, 0xc8372d], 'Furoshiki cloth', '風呂敷', 'A square of indigo cotton printed with waves. It wraps a gift, a bottle, a lunch box, anything at all.'],
    ['kiriko', 'rare', 16500, 'glass', [0x2f63a8, 0xdcecf2, 0x2f63a8], 'Edo kiriko glass', '江戸切子', 'A cobalt glass cut by hand into chrysanthemums and fish-roe dots. The cutter worked on it for two days.'],
    ['imado', 'treasure', 128000, 'cat', [0xefe6d2, 0x7a4a2a, 0xc8a050], 'Taishō beckoning cat', '今戸焼の招き猫', 'An Imado-ware cat from about 1920, fired in Asakusa where the first maneki-neko were made. Its paint is worn soft by a century of hands.'],
  ]),
  trade('tokyo', 'toki', {
    label: 'Pottery shop', local: '器', word: ['Pottery', '陶器'],
    wrap: 'wrapped in sheets of newspaper, then in a box tied with string, every bowl its own parcel',
    keeperLook: L.indigo,
    lines: [
      'Every region has its clay. Mino, Arita, Mashiko, Bizen. Pick up a bowl and feel how heavy it wants to be.',
      'A chip in an old bowl is not a fault. We mend them with gold lacquer. Kintsugi, it is called.',
      'Japanese tableware does not come in matching sets. Every dish on the table is a little different, on purpose.',
    ],
  }, [
    ['mamezara', 'common', 880, 'plate', [0xf4f1ea, 0x2b4c86, 0x2b4c86], 'Mamezara dish', '豆皿', 'A tiny indigo plate for soy sauce or one pickle. People collect them by the dozen.'],
    ['chawan-mino', 'common', 1980, 'bowl', [0xe8dcc0, 0x7a5a3a, 0xf4f1ea], 'Mino rice bowl', '美濃焼', 'An everyday rice bowl from Gifu, glazed the colour of oatmeal. Half the bowls in Japan come from Mino.'],
    ['hasami', 'common', 2640, 'cup', [0xf4f1ea, 0x9aa1a8, 0xf4f1ea], 'Hasami mug', '波佐見焼', 'A heavy white porcelain mug from Nagasaki. It stacks, it survives dishwashers, it looks good doing it.'],
    ['yunomi', 'fine', 3300, 'cup', [0x7a5a3a, 0x3a2a1a, 0xc9a46a], 'Mashiko tea cup', '益子焼', 'A thick yunomi with a dark ash glaze, from the potters\' village Hamada Shōji made famous.'],
    ['arita', 'fine', 5500, 'plate', [0xf8f6f0, 0x2b4c86, 0xc8372d], 'Arita blue plate', '有田焼', 'Porcelain from Saga, painted in cobalt with a crane and pine. Arita has made it since 1616.'],
    ['hagi', 'rare', 38000, 'bowl', [0xf0d8c8, 0xe8c8b8, 0xc9a08a], 'Hagi tea bowl', '萩焼', 'A matcha bowl in soft pink glaze. Hagi ware is said to change colour as it is used, so it ages with its owner.'],
    ['bizen', 'treasure', 165000, 'vase', [0x8a4a2a, 0xc8603a, 0x5a2e1a], 'Bizen flower vase', '備前焼', 'Unglazed stoneware from a ten-day firing in a climbing kiln, scorched red where rice straw was wrapped round it. Signed by a master potter.'],
  ]),
  trade('tokyo', 'hamono', {
    label: 'Knife shop', local: '刃物', word: ['Cutlery', '刃物'],
    wrap: 'engraved with your name in katakana on the blade, then boxed in paulownia wood',
    keeperLook: L.samue,
    lines: [
      'Kappabashi is the kitchen street. Chefs from all over Tokyo come here for knives, pans and plastic food.',
      'Single bevel for the sushi chef, double bevel for the home cook. Hold it. Let your hand decide.',
      'Never put it in a dishwasher. Wash it, dry it, put it away. A good knife outlives its owner.',
      'We engrave your name for free. In katakana, so it looks very serious.',
    ],
  }, [
    ['toishi', 'common', 4400, 'stone', [0x9a6a4a, 0xc9a072, 0x7a5a3a], 'Whetstone', '砥石', 'A two-sided sharpening stone, 1000 and 6000 grit. Soak it, then slide the blade at the angle of a coin.'],
    ['hasami', 'common', 3800, 'knife', [0x9aa1a8, 0xc9ccd0, 0x2b2420], 'Hand-forged shears', '鋏', 'Black-forged kitchen scissors from Sakai. They cut herbs, string and lobster shells alike.'],
    ['petty', 'fine', 9900, 'knife', [0xc9ccd0, 0xeef0f2, 0x8a5a3a], 'Petty knife', 'ペティナイフ', 'A small all-rounder, 135 mm, with a magnolia-wood handle. For fruit, shallots and showing off.'],
    ['santoku', 'fine', 19800, 'knife', [0xb8bec4, 0xeef0f2, 0x5e3b26], 'Santoku knife', '三徳包丁', 'The "three virtues" knife: meat, fish and vegetables. Hand-forged in Sakai, the knife city near Osaka.'],
    ['gyuto', 'rare', 48000, 'knife', [0x8a9098, 0xd8dce0, 0x2b2420], 'Damascus gyuto', '牛刀', 'Sixty-seven layers of steel folded round a hard core, rippling like water on the blade. A chef\'s knife for a lifetime.'],
    ['yanagiba', 'treasure', 220000, 'knife', [0xd8dce0, 0xf4f6f8, 0x1f1f24], 'Honyaki yanagiba', '本焼柳刃', 'A sushi knife forged from a single piece of steel and water-quenched by a master who loses one blade in three to cracks. Ebony handle, buffalo-horn collar.'],
  ]),
  trade('tokyo', 'omocha', {
    label: 'Toy and craft shop', local: 'おもちゃ', word: ['Toys', 'おもちゃ'],
    wrap: 'popped into a paper bag printed with a cartoon tanuki, folded over twice',
    keeperLook: L.cardigan,
    lines: [
      'Kendama is two hundred years old and still the coolest toy in any playground. Try to land the ball on the spike.',
      'Kokeshi come from the hot spring towns of Tōhoku. Each town turns its own shape of head.',
      'Buy the daruma with blank eyes. Paint in one when you make a wish, the other when it comes true.',
    ],
  }, [
    ['origami', 'common', 550, 'box', [0xd8452f, 0xf5cf3a, 0x2f63a8], 'Origami paper', '折り紙', 'A pack of a hundred sheets in every colour, with the instructions for the crane.'],
    ['kendama', 'common', 1200, 'top', [0xd8202a, 0xc9a072, 0xd8202a], 'Kendama', 'けん玉', 'A wooden cup-and-ball with a red ball. Easy to learn, impossible to put down.'],
    ['daruma', 'common', 1500, 'daruma', [0xc8281e, 0xf4f1ea, 0xe8b840], 'Wish daruma', 'だるま', 'Round, red and bottom-heavy: knock it over and it rolls back up. Both eyes are blank, waiting for your wish.'],
    ['koma', 'common', 1650, 'top', [0x2f63a8, 0xf5cf3a, 0xd8452f], 'Edo spinning top', '江戸独楽', 'A turned wooden top painted in rings. Spun right, it seems to stand perfectly still.'],
    ['kokeshi', 'fine', 4400, 'doll', [0xd8452f, 0x1f1f24, 0xf5cf3a], 'Kokeshi doll', 'こけし', 'A lathe-turned doll from Naruko with a head that squeaks when it turns, painted with chrysanthemums.'],
    ['hagoita', 'rare', 18000, 'fan', [0xc8a050, 0xd8452f, 0xf4f1ea], 'Oshie hagoita', '押絵羽子板', 'A New Year battledore with a kabuki actor raised in padded silk. Asakusa holds a fair for them every December.'],
    ['karakuri', 'treasure', 180000, 'doll', [0x2b2420, 0xc8372d, 0xe8c040], 'Tea-serving karakuri', 'からくり人形', 'A clockwork doll that walks a cup of tea to a guest, bows, and walks back when the cup is lifted. A copy of an Edo-period design, made by a craftsman in Nagoya.'],
  ]),
  trade('tokyo', 'washi', {
    label: 'Paper shop', local: '和紙', word: ['Paper', '和紙'],
    wrap: 'slipped between two boards so not a sheet bends, then tied with a paper cord',
    keeperLook: L.apron,
    lines: [
      'Washi is made from mulberry bark. Hold it to the light and you can see the long fibres. It lasts a thousand years.',
      'The goshuin-chō is a book for temple stamps. Every shrine you visit, a monk writes the date in ink.',
      'A fan is not only for the heat. Dancers speak with them. Businessmen tap them when they are thinking.',
    ],
  }, [
    ['chiyogami', 'common', 660, 'box', [0xc8372d, 0xe8c040, 0x2b3a62], 'Chiyogami paper', '千代紙', 'Hand-printed paper in old kimono patterns: cranes, waves, cherry blossom.'],
    ['letter', 'common', 990, 'book', [0xf6efe0, 0x9a3b32, 0x6fae4a], 'Washi letter set', '便箋', 'Rough-edged writing paper with pressed maple leaves and matching envelopes.'],
    ['fudepen', 'common', 1100, 'knife', [0x1f1f24, 0xc8a050, 0x1f1f24], 'Brush pen', '筆ペン', 'A felt brush that writes like a calligrapher\'s, for New Year cards and practising kanji.'],
    ['goshuin', 'common', 1650, 'book', [0x2b3a62, 0xc8a050, 0xf6efe0], 'Temple stamp book', '御朱印帳', 'An accordion book bound in brocade. Take it to Sensō-ji first: their red seal is famous.'],
    ['sensu', 'fine', 3850, 'fan', [0xf6efe0, 0x5e3b26, 0xd8452f], 'Folding fan', '扇子', 'A bamboo sensu with hand-painted red maples. Kyoto-made, the ribs carved from a single piece.'],
    ['andon', 'rare', 24000, 'lamp', [0xf6efe0, 0xe8dcc0, 0x5e3b26], 'Washi andon lamp', '行灯', 'A floor lamp of Mino washi stretched over a cedar frame. Its glow is the colour of a paper lantern at a festival.'],
    ['kakejiku', 'treasure', 96000, 'scroll', [0xf6efe0, 0x1f1f24, 0x6b4a2a], 'Calligraphy scroll', '掛軸', 'A hanging scroll with one word, 一期一会: one time, one meeting. Brushed by the abbot of a Zen temple in Kamakura.'],
  ]),
  trade('tokyo', 'books', {
    label: 'Bookshop', local: '古本', word: ['Books', '書房'],
    wrap: 'slipped into a paper book cover so nobody on the train can see what you are reading',
    keeperLook: L.cardigan,
    lines: [
      'Jinbōchō has a hundred and fifty second-hand bookshops. We are the only one that sells cookbooks from the Edo period.',
      'Ah, that shelf at the back? Old books, old secrets. My grandfather built it himself.',
      'People here read standing in the shop for hours. Tachiyomi, we call it. I do not mind.',
    ],
  }, [
    ['shiori', 'common', 400, 'book', [0xe8e1cf, 0xc8372d, 0x6fae4a], 'Washi bookmark', 'しおり', 'Handmade paper with a pressed maple leaf.'],
    ['manga', 'common', 528, 'book', [0xf4f1ea, 0xd8452f, 0x1f1f24], 'Manga volume', '漫画', 'Volume one of a cooking manga about a ramen chef. Read it right to left.'],
    ['ukiyoe', 'fine', 4400, 'print', [0x5e3b26, 0xe8e1cf, 0x2f63a8], 'Great Wave print', '浮世絵', 'A modern woodblock print of Hokusai\'s wave, cut and printed by hand from eight blocks, the way it was in 1831.'],
    ['edo-cook', 'fine', 9800, 'book', [0xd9c49a, 0x2f5a88, 0x9a3b32], 'Edo cookbook', '豆腐百珍', 'A woodblock-printed book of recipes from 1782: tofu, a hundred ways. It was a bestseller.'],
    ['map', 'rare', 14000, 'print', [0x6b4a2a, 0xe8dcc0, 0x9a3b32], 'Old Tokyo map', '古地図', 'A 1930s pocket map of Tokyo\'s tram lines, folded and refolded by some long-ago commuter.'],
    ['hiroshige', 'treasure', 240000, 'print', [0x2b2420, 0xf0e2c0, 0x2b4c86], 'Hiroshige woodblock', '広重', 'A Meiji-era impression of Kinryūzan Temple in Asakusa from the One Hundred Famous Views of Edo: snow, a red gate, a lantern.'],
  ]),
  trade('tokyo', 'hana', {
    label: 'Florist', local: '花屋', word: ['Flowers', '花屋'],
    wrap: 'wrapped in brown paper with a twist of raffia, a card tucked in',
    keeperLook: { ...L.apron, accent: 0x6fae4a },
    lines: [
      'Flowers follow the seasons here: plum, then cherry, then hydrangea in the rainy season, chrysanthemums in autumn.',
      'Ikebana is about space as much as flowers. Three stems can say more than thirty.',
      'Never give four flowers. Shi, four, sounds like the word for death.',
    ],
  }, [
    ['himawari', 'common', 350, 'flower', [0xf5cf3a, 0x5e3b26, 0x4f8a3a], 'A single sunflower', 'ひまわり', 'Wrapped in brown paper with a twist of raffia.'],
    ['posy', 'common', 1500, 'flower', [0xf3a6b9, 0xfbf8f0, 0x9aa6b0], 'Seasonal posy', '花束', 'Small, careful and perfectly balanced. Ikebana for your backpack.'],
    ['kenzan', 'common', 2200, 'stone', [0x50555c, 0x9aa1a8, 0x2b2420], 'Kenzan pin frog', '剣山', 'A heavy brass bed of needles that holds ikebana stems exactly where you want them.'],
    ['kadoki', 'fine', 6600, 'vase', [0x3a4a3a, 0x6a7a5a, 0x2b2420], 'Ikebana vase', '花器', 'A low, wide vase with a dark green glaze, for arrangements that sweep sideways.'],
    ['bonsai', 'fine', 8800, 'flower', [0x35662c, 0x5e3b26, 0x8a4a2a], 'Juniper bonsai', '盆栽', 'A small shimpaku juniper, twelve years old, in a brown glazed pot. The nursery will ship it home.'],
    ['matsu', 'treasure', 160000, 'flower', [0x2f5a2a, 0x5a3a22, 0x5a4a3a], 'Old black pine bonsai', '黒松盆栽', 'A black pine trained for eighty years, three keepers before this one. It comes with its own care diary in three different hands.'],
  ]),
];

// ================================================================================================ Istanbul (lira)
const ISTANBUL: Trade[] = [
  trade('istanbul', 'carpet', {
    label: 'Carpet shop', local: 'Halıcı', word: ['Carpets', 'Halıcılık'], haggle: true,
    wrap: 'folded small, wrapped in brown paper and tied with string, with a handle of twisted twine for the plane',
    keeperLook: L.jacket,
    lines: [
      'Sit, sit. Çay! Bring tea for our guest. No, no, you do not have to buy. Just look. Looking is free.',
      'Turn it over. See the knots on the back? Count them. Hand-knotted, every one. A machine carpet has no back.',
      'A kilim is woven flat, a carpet is knotted with a pile. The kilim is for the nomad\'s tent, the carpet for the palace.',
      'Every carpet has one mistake woven in on purpose. Only God is perfect.',
    ],
  }, [
    ['coaster', 'common', lira(250), 'tile', [0xa8323a, 0x2b4c86, 0xf0e2c0], 'Kilim coasters', 'Kilim bardak altlığı', 'Six little squares of real kilim, backed with leather. The cheapest way to take a carpet home.'],
    ['cushion', 'common', lira(650), 'cloth', [0xa8323a, 0xe8b840, 0x2b4c86], 'Kilim cushion cover', 'Kilim yastık', 'Cut from a worn-out kilim, so the colours are softened by years of feet.'],
    ['heybe', 'fine', lira(2200), 'bag', [0xa8323a, 0x2b4c86, 0xf0e2c0], 'Saddlebag', 'Heybe', 'A double bag woven to hang over a donkey, now hung on a wall in Paris or Tokyo.'],
    ['kilim', 'fine', lira(4800), 'rug', [0xb8402a, 0x2b4c86, 0xf0e2c0], 'Anatolian kilim', 'Kilim', 'A flat-woven rug from the villages near Konya, red and indigo, with the hooked "hands on hips" motif for motherhood.'],
    ['kayseri', 'rare', lira(14000), 'rug', [0x7a2a2a, 0xe8c8a0, 0x2b3a62], 'Kayseri wool carpet', 'Kayseri halısı', 'A hand-knotted wool carpet with a prayer-arch design, about a metre by a metre and a half.'],
    ['hereke', 'treasure', lira(45000), 'rug', [0xc8a050, 0x8a1a2a, 0x2b4c86], 'Hereke silk rug', 'Hereke ipek halı', 'Pure silk, a million knots in a small rug, woven in the town that made carpets for the Ottoman palaces. It changes colour as you walk round it.'],
  ]),
  trade('istanbul', 'lamp', {
    label: 'Lamp shop', local: 'Lambacı', word: ['Lamps', 'Aydınlatma'], haggle: true,
    wrap: 'its glass wrapped in a whole newspaper, then sat in a box full of crumpled paper, chain coiled on top',
    keeperLook: L.bazaar,
    lines: [
      'Each little piece of glass is set by hand, one by one, with a pair of tweezers. A big lamp takes a week.',
      'At night we light them all, hundreds. Tourists stop in the street and forget to close their mouths.',
      'The bulb? Any bulb. The colour is in the glass, not the light.',
    ],
  }, [
    ['tealight', 'common', lira(350), 'glass', [0xc8321e, 0x2f63a8, 0xe8b840], 'Mosaic candle holder', 'Mozaik mumluk', 'A little glass cup covered in mosaic. Put a tealight in it and the table turns to stained glass.'],
    ['small', 'common', lira(1200), 'lamp', [0x2f63a8, 0xe8b840, 0x2f8a6a], 'Mosaic lamp', 'Mozaik lamba', 'A hand-set globe of blue and gold glass on a brass chain. The colours fill a room.'],
    ['table', 'fine', lira(3800), 'lamp', [0xc8321e, 0xe8803a, 0xf5cf3a], 'Mosaic table lamp', 'Masa lambası', 'A tulip-shaped lamp on a brass stand, covered in red and amber mosaic like embers.'],
    ['chandelier', 'rare', lira(9500), 'lamp', [0x8a3aa8, 0x2f8a6a, 0xe8b840], 'Three-globe chandelier', 'Avize', 'Three mosaic globes on a brass branch, purple, green and gold. You will need a big suitcase.'],
    ['kandil', 'treasure', lira(38000), 'lamp', [0xc8a050, 0x2f8a6a, 0xdcecf2], 'Ottoman mosque lamp', 'Osmanlı kandil', 'A nineteenth-century brass and glass lamp that once hung on long chains in a mosque in Bursa, pierced with stars.'],
  ]),
  trade('istanbul', 'ceramic', {
    label: 'Tile and ceramics shop', local: 'Çini', word: ['Ceramics', 'Çini'], haggle: true,
    wrap: 'swaddled in bubble wrap and two pages of yesterday\'s Hürriyet, then a box, then more bubble wrap',
    keeperLook: L.craft,
    lines: [
      'İznik blue, İznik turquoise and İznik red. The red was the secret: a tomato red made of clay, raised on the glaze like a jewel.',
      'Look at the tiles in the Blue Mosque and the Rüstem Paşa mosque. Twenty thousand of them, all by hand.',
      'Tulips, carnations, hyacinths. The Ottomans loved tulips so much they had a whole era named after them.',
    ],
  }, [
    ['tile', 'common', lira(600), 'tile', [0xf4f1ea, 0x2f63a8, 0xc8321e], 'Tulip tile', 'Lale çini', 'A hand-painted tile with a red tulip and blue saz leaves, the pattern of the palace kitchens.'],
    ['bowl', 'common', lira(850), 'bowl', [0xf4f1ea, 0x2f63a8, 0x2f8a8a], 'İznik-pattern bowl', 'Çini kase', 'A small bowl painted with carnations and leaves, for olives or for keys by the door.'],
    ['plate', 'fine', lira(2400), 'plate', [0xf4f1ea, 0x2f63a8, 0xc8321e], 'Kütahya plate', 'Kütahya tabak', 'A wall plate from Kütahya with a ring of tulips round a rosette. The painter\'s signature is on the back.'],
    ['vase', 'fine', lira(4200), 'vase', [0x2f8a8a, 0xf4f1ea, 0x2b4c86], 'Turquoise vase', 'Çini vazo', 'A tall vase in İznik turquoise with white cloud bands. Fired twice, painted three times.'],
    ['iznik', 'rare', lira(12000), 'plate', [0xf8f6f0, 0x1f4a98, 0xc8281e], 'Signed İznik plate', 'İznik tabak', 'A quartz-frit plate from İznik itself, where the kilns were relit in the 1990s. Raised coral red, the hardest colour there is.'],
    ['panel', 'treasure', lira(42000), 'tile', [0xf8f6f0, 0x1f4a98, 0x2f8a6a], 'İznik tile panel', 'Çini pano', 'Six tiles that make one great spray of tulips, cypress and plum blossom, copied from the walls of the Topkapı harem by a master painter.'],
  ]),
  trade('istanbul', 'copper', {
    label: 'Coppersmith', local: 'Bakırcı', word: ['Copper', 'Bakırcılık'], haggle: true,
    wrap: 'given a last polish with a cloth, then wrapped in a page of newspaper and a black plastic bag',
    keeperLook: L.craft,
    lines: [
      'Hear that? Tak, tak, tak. My son is hammering a tray in the back. Every dent is a hammer blow.',
      'Copper pots are lined with tin inside, so the food never touches the copper. Every few years we tin them again.',
      'A cezve must be narrow at the top. The foam is the soul of the coffee, and it must not escape.',
    ],
  }, [
    ['cezve', 'common', lira(700), 'cezve', [0xb87333, 0x8a4f22, 0x2b2420], 'Copper cezve', 'Cezve', 'A small hammered pot with a long handle, made for two cups of Turkish coffee. Brew it slowly.'],
    ['tas', 'common', lira(1200), 'bowl', [0xc8ccd0, 0xb87333, 0x9aa1a8], 'Hamam bowl', 'Hamam tası', 'A tinned copper bowl, engraved all over, for pouring warm water over yourself at the bath.'],
    ['tray', 'fine', lira(2600), 'tray', [0xb87333, 0xd89a5a, 0x8a4f22], 'Hammered tray', 'Bakır tepsi', 'A round tray, beaten out of one sheet of copper and chased with a band of leaves. Built to carry tea.'],
    ['ibrik', 'fine', lira(5500), 'jug', [0xb87333, 0x8a4f22, 0xd89a5a], 'Copper ewer', 'İbrik', 'A tall water jug with a swan-neck spout, for washing hands before a meal the old way.'],
    ['sahan', 'rare', lira(9800), 'pot', [0xb87333, 0x9aa1a8, 0x2b2420], 'Copper pot set', 'Sahan takımı', 'Three lidded copper pans, freshly tinned inside, that fit one inside the other.'],
    ['ottoman', 'treasure', lira(28000), 'jug', [0x8a5a2a, 0xc8a050, 0x5a3a1a], 'Ottoman copper ewer', 'Osmanlı ibrik', 'A two-hundred-year-old ewer with the maker\'s stamp and three owners\' names engraved round its neck in Ottoman script.'],
  ]),
  trade('istanbul', 'textile', {
    label: 'Textile shop', local: 'Kumaşçı', word: ['Textiles', 'Tekstil'], haggle: true,
    wrap: 'folded in tissue paper and slipped into a paper bag with rope handles',
    keeperLook: L.bazaar,
    lines: [
      'Feel this. Bursa silk. Bursa was the end of the Silk Road, the caravans came there to sell their thread.',
      'The peştemal is the hamam towel. Thin, light, dries in an hour. Better than any fluffy towel, believe me.',
      'Oya is the lace on the edge of a headscarf. In the villages the flowers tell you if a girl is happy, sad or in love.',
    ],
  }, [
    ['pestemal', 'common', lira(450), 'cloth', [0x2f8a8a, 0xf4f1ea, 0x2b4c86], 'Peştemal towel', 'Peştemal', 'A flat-woven cotton hamam towel in teal stripes with a fringe. Beach, bath, picnic, scarf.'],
    ['oya', 'common', lira(900), 'cloth', [0xf4f1ea, 0xe8803a, 0x6a9a3a], 'Oya-edged scarf', 'Oyalı yazma', 'A printed cotton headscarf trimmed with tiny needle-lace flowers.'],
    ['suzani', 'fine', lira(1400), 'cloth', [0xa8323a, 0xf0e2c0, 0x2b4c86], 'Embroidered cushion', 'Süzani yastık', 'A cushion covered in big embroidered suns and pomegranates, the work of a whole winter.'],
    ['silk', 'fine', lira(1800), 'cloth', [0x8a3aa8, 0xe8b840, 0x2f8a8a], 'Silk scarf', 'İpek eşarp', 'A Bursa silk scarf printed with a tulip pattern from an Ottoman kaftan.'],
    ['ikat', 'rare', lira(8500), 'cloth', [0xc8281e, 0xe8b840, 0x2b2420], 'Silk ikat bolt', 'İpek ikat', 'Three metres of hand-woven silk ikat. The threads were tie-dyed before weaving, so the pattern blurs like a flame.'],
    ['kemha', 'treasure', lira(34000), 'cloth', [0xa8202a, 0xc8a050, 0x2b4c86], 'Silk velvet cushion', 'Çatma yastık', 'A cushion face of Ottoman çatma, silk velvet woven with gold thread in carnations, nearly two centuries old.'],
  ]),
  trade('istanbul', 'jewel', {
    label: 'Jeweller', local: 'Kuyumcu', word: ['Jewellery', 'Kuyumculuk'], haggle: true,
    wrap: 'laid in a velvet box, and the box in a little bag with the shop\'s name in gold',
    keeperLook: L.vest,
    lines: [
      'Gold is sold by weight here, the price of the day plus the craftsman\'s work. Ask the weight. Always ask the weight.',
      'At a Turkish wedding the guests pin gold coins on the bride and groom. We sell a lot of little coins.',
      'Turquoise. Do you know the name? It means "Turkish stone". It came to Europe through here.',
    ],
  }, [
    ['brooch', 'common', lira(300), 'bead', [0x1f4a98, 0xf4f1ea, 0x6ab8e8, 0xc8a050], 'Evil-eye pin', 'Nazar iğnesi', 'A tiny nazar on a gold pin, the kind grandmothers fix on a new baby\'s clothes.'],
    ['pendant', 'common', lira(1100), 'coin', [0xc9ccd0, 0x1f4a98, 0xf4f1ea], 'Silver nazar pendant', 'Gümüş nazar kolye', 'Sterling silver round a blue glass eye, on a fine chain.'],
    ['earrings', 'fine', lira(2400), 'ring', [0xc9ccd0, 0x2f8a6a, 0x7a2a2a], 'Ottoman earrings', 'Osmanlı küpe', 'Silver drops with filigree and a green stone, in the style of the palace jewellery in the Topkapı treasury.'],
    ['turquoise', 'fine', lira(3200), 'ring', [0xc9ccd0, 0x3ab8b0, 0x2b2420], 'Turquoise ring', 'Firuze yüzük', 'A silver ring with a turquoise from the mines of Persia, set high so the light gets under it.'],
    ['coin', 'rare', lira(18000), 'coin', [0xe8c040, 0xc8a050, 0x7a2a2a], 'Gold coin pendant', 'Reşat altını kolye', 'A 22-karat Ottoman-style gold coin with the sultan\'s tughra, framed in a twisted gold rim.'],
    ['tughra', 'treasure', lira(45000), 'ring', [0xe8c040, 0xc8202a, 0x2b2420], 'Ruby signet ring', 'Yakut mühür yüzük', 'A gold signet ring set with a Burmese ruby, the seal carved as a tughra. The jeweller\'s grandfather made it in 1952 and never sold it until now.'],
  ]),
  trade('istanbul', 'leather', {
    label: 'Leather shop', local: 'Deri', word: ['Leather', 'Deri'], haggle: true,
    wrap: 'stuffed with tissue so it keeps its shape, then put in a cloth dust bag',
    keeperLook: L.jacket,
    lines: [
      'Smell it. Real leather smells like this. Plastic smells like nothing.',
      'We cut it in the back and sew it upstairs. Come back in two hours and I make you a jacket to measure.',
      'Do not pay the first price! Nobody pays the first price. Well, some do. I like those people very much.',
    ],
  }, [
    ['wallet', 'common', lira(900), 'bag', [0x8a4a2a, 0x5a2e16, 0xc8a050], 'Leather wallet', 'Deri cüzdan', 'Vegetable-tanned leather, hand-stitched with waxed thread. It darkens beautifully with use.'],
    ['belt', 'common', lira(1500), 'bag', [0x5a2e16, 0x3a1e10, 0xc8a050], 'Tooled belt', 'Kemer', 'A wide belt with a stamped border of leaves and a brass buckle.'],
    ['satchel', 'fine', lira(5500), 'bag', [0xa86a32, 0x7a4a22, 0xc8a050], 'Leather satchel', 'Deri çanta', 'A big shoulder bag in tan leather that will carry a laptop, a lunch and a whole day in the bazaar.'],
    ['jacket', 'rare', lira(14000), 'bag', [0x2b2420, 0x1f1a16, 0x9aa1a8], 'Made-to-measure jacket', 'Deri ceket', 'Lambskin as soft as a glove, cut to your measurements in the workshop upstairs while you have lunch.'],
  ]),
  trade('istanbul', 'spice', {
    label: 'Spice shop', local: 'Baharatçı', word: ['Spices', 'Baharat'],
    wrap: 'vacuum-sealed in a clear bag so the smell does not fill your whole suitcase, with a printed label',
    keeperLook: L.bazaar,
    lines: [
      'Pul biber, sumak, isot, kimyon. Smell this one. Urfa pepper, dried in the sun by day and wrapped up at night.',
      'Saffron? Real saffron is red threads, never powder. If it is cheap, it is not saffron.',
      'We weigh it in front of you. A hundred grams, two hundred. Taste first. Go on.',
    ],
  }, [
    ['kofte', 'common', lira(90), 'sack', [0x9a5a2a, 0xc8803a, 0xf0e2c0], 'Köfte spice mix', 'Köfte baharatı', 'Cumin, black pepper, sweet paprika and dried mint, for meatballs like the ones in Sultanahmet.'],
    ['sumac', 'common', lira(100), 'sack', [0x8a2a2a, 0xa83a3a, 0xf0e2c0], 'Sumac', 'Sumak', 'Dark red and lemony. Sprinkle it on onions and kebab.'],
    ['pulbiber', 'common', lira(120), 'sack', [0xc8281e, 0xd8402a, 0xf0e2c0], 'Pul biber', 'Pul biber', 'Red pepper flakes, sweet and gently hot. On eggs, soup, everything.'],
    ['isot', 'common', lira(150), 'sack', [0x4a1a12, 0x6a2a1a, 0xf0e2c0], 'Urfa isot pepper', 'İsot', 'Almost black, smoky and raisiny. The pepper of Şanlıurfa.'],
    ['saffron', 'fine', lira(950), 'jar', [0xc8281e, 0xe8803a, 0xc8a050], 'Safranbolu saffron', 'Safran', 'Two grams of threads in a little glass jar, from the town that is named after it.'],
    ['chest', 'rare', lira(3600), 'box', [0x6a3a1a, 0xc8a050, 0xc8281e], 'Spice chest', 'Baharat sandığı', 'A carved wooden box of twelve spices in little brass-lidded tins, with a card that tells you what goes with what.'],
  ]),
  trade('istanbul', 'tea', {
    label: 'Tea shop', local: 'Çaycı', word: ['Tea', 'Çay Evi'],
    wrap: 'in a tin, and the tin in a paper bag, and a free sample of apple tea dropped in on top',
    keeperLook: L.vest,
    lines: [
      'We drink tea from Rize, on the Black Sea. Mountains, mist and rain. Turkey grows almost all of its own tea.',
      'A çaydanlık is two pots, one on top of the other. Strong tea in the little one, hot water in the big one.',
      'The tulip glass shows the colour. Rabbit\'s blood red is perfect.',
    ],
  }, [
    ['apple', 'common', lira(180), 'box', [0xc8281e, 0xe8c040, 0x6a9a3a], 'Apple tea', 'Elma çayı', 'A tin of dried apple tea for home. Every visitor falls for it. Locals mostly drink black.'],
    ['rosehip', 'common', lira(160), 'sack', [0xb8281e, 0xd84a3a, 0xf0e2c0], 'Rosehip tea', 'Kuşburnu', 'Tart red rosehips, good for colds, says every grandmother.'],
    ['rize', 'common', lira(250), 'box', [0x2f6b3a, 0xe8c040, 0xc8281e], 'Rize black tea', 'Rize çayı', 'A kilo of black tea from the Black Sea hills. The real everyday tea of Istanbul.'],
    ['glasses', 'common', lira(650), 'glass', [0x8a2a12, 0xdcecf2, 0xc8a050], 'Tulip tea glasses', 'İnce belli bardak', 'Six slim-waisted glasses with saucers. Hold them by the rim: they are hot.'],
    ['caydanlik', 'fine', lira(1400), 'teapot', [0x9aa1a8, 0xc9ccd0, 0x2b2420], 'Double teapot', 'Çaydanlık', 'The stacked kettle every Turkish kitchen has. Water below, tea above, steam in between.'],
    ['zarf', 'rare', lira(7500), 'glass', [0xc9ccd0, 0x8a2a12, 0xe8e8ea], 'Silver tea set', 'Gümüş zarflı çay takımı', 'Six tulip glasses in engraved silver holders with a silver tray, the kind brought out for an engagement.'],
  ]),
  trade('istanbul', 'nuts', {
    label: 'Dried fruit and nut shop', local: 'Kuruyemişçi', word: ['Nuts', 'Kuruyemiş'],
    wrap: 'scooped into a paper bag, weighed, twisted shut and put in a bigger bag with a handful extra',
    keeperLook: L.vest,
    lines: [
      'Antep pistachios are small and green and the best in the world. I will fight anyone who says otherwise.',
      'Dried apricots from Malatya. The dark ones are dried without sulphur: uglier, sweeter.',
      'Pestil is fruit leather, cevizli sucuk is walnuts dipped in grape juice again and again until they look like a sausage.',
    ],
  }, [
    ['figs', 'common', lira(280), 'sack', [0x7a4a3a, 0x9a6a4a, 0xf0e2c0], 'Dried figs', 'Kuru incir', 'Fat dried figs from Aydın, threaded on a string.'],
    ['apricot', 'common', lira(260), 'sack', [0xe8803a, 0xf0a050, 0xf0e2c0], 'Malatya apricots', 'Kayısı', 'Orange, chewy and honey-sweet.'],
    ['sucuk', 'common', lira(220), 'peppers', [0x6a2a1a, 0x8a3a2a, 0xc9a46a], 'Walnut sucuk', 'Cevizli sucuk', 'Walnuts on a string, dipped in thickened grape must until they look like a sausage.'],
    ['pistachio', 'common', lira(600), 'sack', [0x8aa83a, 0xa8c46a, 0xf0e2c0], 'Antep pistachios', 'Antep fıstığı', 'Half a kilo of roasted Gaziantep pistachios, salted in the shell.'],
    ['basket', 'fine', lira(1600), 'basket', [0xc9a46a, 0xe8803a, 0x8aa83a], 'Dried fruit basket', 'Kuruyemiş sepeti', 'A woven basket of figs, apricots, mulberries, pistachios and hazelnuts under cellophane and a bow.'],
  ]),
  trade('istanbul', 'lokum', {
    label: 'Turkish delight shop', local: 'Lokumcu', word: ['Lokum', 'Lokumcusu'],
    wrap: 'packed in a painted tin with a sheet of greaseproof paper between every layer',
    keeperLook: L.bazaar,
    lines: [
      'Lokum means "a morsel for the throat". Starch, sugar and patience, stirred for hours in a copper pan.',
      'Rose, pistachio, double-roasted with hazelnuts. Taste first, buy after. That is the bazaar way.',
      'Two hundred years ago a confectioner made the sultan\'s lokum near here. We still use his recipe. Probably.',
    ],
  }, [
    ['akide', 'common', lira(80), 'jar', [0xc8281e, 0xf5cf3a, 0xf4f1ea], 'Akide candy', 'Akide şekeri', 'Hard boiled sugar in a paper cone, the colours of a stained-glass window. Janissaries were given it as a reward.'],
    ['rose', 'common', lira(300), 'sweets', [0xf0a0b8, 0xfbf6ec, 0xc8281e], 'Rose lokum', 'Gül lokumu', 'Soft pink cubes in a cloud of icing sugar, scented with rosewater.'],
    ['pistachio', 'common', lira(450), 'sweets', [0x9ac46a, 0xfbf6ec, 0x2f6b3a], 'Pistachio lokum', 'Fıstıklı lokum', 'Studded with green Antep pistachios. The one everyone takes home.'],
    ['double', 'fine', lira(600), 'sweets', [0xc89a5a, 0xe8c88a, 0x5a2e16], 'Double-roasted lokum', 'Çifte kavrulmuş', 'Cooked twice, thick and chewy, packed with hazelnuts.'],
    ['palace', 'rare', lira(1800), 'box', [0x5a2e16, 0xc8a050, 0xa8202a], 'Palace lokum box', 'Saray lokumu', 'A carved wooden box of twelve kinds, from mastic to bitter orange, with the shop\'s seal in red wax.'],
  ]),
  trade('istanbul', 'soap', {
    label: 'Hamam goods shop', local: 'Hamam eşyası', word: ['Hamam', 'Hamam'],
    wrap: 'wrapped in a peştemal and tied with a ribbon, as a hamam gift should be',
    keeperLook: L.craft,
    lines: [
      'Go to the hamam once and you will understand. The heat, the marble, the scrub. You come out a new person.',
      'Olive oil soap from Ayvalık and terebinth soap from Antep. Pure, no perfume, three ingredients.',
      'The kese is the rough mitt. The attendant scrubs you, and you see how much of you was dirt. Every time.',
    ],
  }, [
    ['olive', 'common', lira(90), 'soap', [0x8a9a4a, 0xa8b86a, 0xe8dcc0], 'Olive oil soap', 'Zeytinyağlı sabun', 'A green bar from Ayvalık on the Aegean, cut and stamped by hand.'],
    ['bittim', 'common', lira(120), 'soap', [0x5a6a3a, 0x7a8a4a, 0xe8dcc0], 'Terebinth soap', 'Bıttım sabunu', 'Made from wild pistachio oil in Gaziantep. Smells of resin and pine.'],
    ['kese', 'common', lira(180), 'pouch', [0xe8c040, 0xc8281e, 0xf4f1ea], 'Kese mitt', 'Kese', 'The rough silk mitt for the hamam scrub. Use it once a week, gently. Or not gently.'],
    ['tas', 'fine', lira(1100), 'bowl', [0xc9ccd0, 0xd8dce0, 0x9aa1a8], 'Silver hamam bowl', 'Hamam tası', 'A dish of nickel silver, embossed all over with flowers, for pouring water at the basin.'],
    ['nalin', 'rare', lira(6500), 'clogs', [0x5a2e16, 0xf4f1ea, 0xc8a050], 'Pearl-inlaid nalın', 'Sedefli nalın', 'Tall wooden bath clogs inlaid with mother-of-pearl, the kind brides once wore to their pre-wedding hamam.'],
  ]),
  trade('istanbul', 'nazar', {
    label: 'Evil-eye shop', local: 'Nazarcı', word: ['Nazar', 'Nazar Boncuğu'], haggle: true,
    wrap: 'dropped into a little cotton pouch with a drawstring, a spare bead added "for luck"',
    keeperLook: L.bazaar,
    lines: [
      'The nazar catches the jealous look before it reaches you. If it cracks, it did its job. Get a new one.',
      'Real ones are blown in Görece, near İzmir, by a few families. The fire is in a little clay furnace.',
      'On cars, on babies, over doors, in airports. There is no place in Turkey without a nazar.',
    ],
  }, [
    ['keyring', 'common', lira(50), 'bead', [0x1f4a98, 0xf4f1ea, 0x6ab8e8, 0x1f1f24], 'Nazar keyring', 'Nazar anahtarlık', 'A glass eye on a key ring. Hand them out at home like sweets.'],
    ['bracelet', 'common', lira(150), 'bead', [0x2b4c86, 0xf4f1ea, 0x6ab8e8, 0x1f1f24], 'Nazar bracelet', 'Nazar bileklik', 'A string of tiny eyes on red cord.'],
    ['hanging', 'common', lira(350), 'bead', [0x1f4a98, 0xf4f1ea, 0x6ab8e8, 0x1f1f24], 'Nazar wall hanging', 'Nazar duvar süsü', 'Three eyes on a cord with a brass bell, to hang inside the front door.'],
    ['big', 'fine', lira(1200), 'bead', [0x16388a, 0xfbf8f2, 0x5aa8e0, 0x0f0f14], 'Big glass nazar', 'Büyük nazar', 'A nazar as big as a plate, with a satisfying weight. It will protect a whole flat.'],
    ['gorece', 'rare', lira(4500), 'bead', [0x0f3a8a, 0xfbf8f2, 0x4a98d8, 0x0a0a10], 'Görece master bead', 'Görece nazarı', 'Blown by one of the last masters in Görece, the glass streaked and alive. He signed the box in pencil.'],
  ]),
  trade('istanbul', 'bakkal', {
    label: 'Corner grocer', local: 'Bakkal', word: ['Grocer', 'Bakkaliyesi'],
    wrap: 'bagged in thin plastic, with a "kolay gelsin", may it come easy',
    keeperLook: L.vest,
    lines: [
      'The bakkal is the heart of the street. Bread, gossip, newspapers, and I know everybody\'s mother.',
      'Nar ekşisi, pomegranate molasses. A spoon in a salad and it sings.',
      'Want to send bread down to the old lady on the fourth floor? She lowers a basket on a rope. We fill it.',
    ],
  }, [
    ['nar', 'common', lira(220), 'bottle', [0x6a1a1a, 0xc8281e, 0xf4f1ea], 'Pomegranate molasses', 'Nar ekşisi', 'Thick, dark and sour-sweet, boiled down from pure pomegranate juice.'],
    ['pekmez', 'common', lira(260), 'jar', [0x3a1a10, 0xe8c040, 0xc8281e], 'Grape molasses', 'Üzüm pekmezi', 'Mix it with tahini and dip bread in it. Breakfast of champions.'],
    ['oil', 'common', lira(650), 'bottle', [0x8a9a2a, 0x2f6b3a, 0xe8c040], 'Ayvalık olive oil', 'Zeytinyağı', 'Cold-pressed, peppery and green, from the olive groves on the north Aegean.'],
    ['kahve', 'common', lira(280), 'box', [0x5a2e16, 0xc8a050, 0xf4f1ea], 'Turkish coffee', 'Türk kahvesi', 'Ground as fine as flour in a silver packet. Boil it in a cezve, slowly.'],
  ]),
  trade('istanbul', 'kahve', {
    label: 'Coffee roaster', local: 'Kurukahveci', word: ['Coffee', 'Kahvecisi'],
    wrap: 'ground fresh in front of you and folded into a waxed paper packet, still warm',
    keeperLook: L.vest,
    lines: [
      'Smell that? The queue round the corner is for us. We have roasted coffee on this street since 1871.',
      'Turkish coffee is ground finer than anything. The finest grind in the world.',
      'Menengiç is coffee made from wild pistachio. No caffeine, all flavour. Try it.',
    ],
  }, [
    ['ground', 'common', lira(320), 'box', [0x5a2e16, 0xf4f1ea, 0xc8a050], 'Fresh-ground coffee', 'Taze çekilmiş kahve', 'Two hundred and fifty grams, ground while you wait. The smell will follow you home.'],
    ['menengic', 'common', lira(280), 'jar', [0x4a3a1a, 0x8a9a4a, 0xf4f1ea], 'Menengiç coffee', 'Menengiç kahvesi', 'A creamy paste of roasted wild pistachio, stirred into hot milk.'],
    ['cups', 'fine', lira(1200), 'cup', [0xf4f1ea, 0xc8a050, 0x2f63a8], 'Coffee cup set', 'Kahve fincanı', 'Two little porcelain cups with saucers, gilded at the rim. Keep the grounds for fortune telling.'],
    ['zarf', 'rare', lira(9000), 'cup', [0xc9ccd0, 0xf4f1ea, 0xe8e8ea], 'Silver zarf cups', 'Zarflı fincan', 'Six porcelain cups in pierced silver holders, the way coffee was served to the pashas.'],
  ]),
  trade('istanbul', 'sahaf', {
    label: 'Second-hand bookseller', local: 'Sahaf', word: ['Books', 'Sahaf'], haggle: true,
    wrap: 'put in a big paper envelope with the shop\'s stamp in purple ink',
    keeperLook: L.cardigan,
    lines: [
      'The booksellers\' bazaar has been here since Byzantine times. Before that, who knows. Paper is very patient.',
      'Ebru is marbled paper. Paint floats on water thick with tragacanth gum, and you lay the paper on top.',
      'That photograph? The Galata Bridge in 1890. Wooden then. Same fishermen, I think.',
    ],
  }, [
    ['postcard', 'common', lira(150), 'print', [0xe8dcc0, 0x8a6a4a, 0x5a4a3a], 'Old postcard', 'Eski kartpostal', 'A sepia postcard of the Golden Horn, posted in 1912 to someone in Marseille.'],
    ['ebru', 'common', lira(700), 'print', [0x2b4c86, 0xc8281e, 0xe8c040], 'Marbled paper', 'Ebru', 'A sheet of ebru with "tulip" and "nightingale\'s nest" patterns combed into the paint.'],
    ['hat', 'common', lira(900), 'print', [0xc8a050, 0x1f1f24, 0xf0e2c0], 'Calligraphy print', 'Hat baskısı', 'A print of a pear-shaped calligraphy, a whole sentence drawn as a single shape.'],
    ['map', 'fine', lira(1600), 'print', [0x6b4a2a, 0xe8dcc0, 0x2b4c86], 'Constantinople map', 'Eski harita', 'A reprint of an 1880s map of the city, with the old wooden houses of every street drawn in.'],
    ['album', 'rare', lira(6500), 'book', [0x3a2a1a, 0xc8a050, 0xe8dcc0], 'Album of old photographs', 'Fotoğraf albümü', 'Twenty albumen prints of Istanbul in the 1890s by a studio in Pera: ferries, bazaars, a street dog asleep in the sun.'],
    ['hilye', 'treasure', lira(40000), 'scroll', [0xf0e2c0, 0x1f1f24, 0xc8a050], 'Hilye calligraphy panel', 'Hilye-i şerif', 'An illuminated panel by a living master calligrapher, its lines in soot ink framed with gold leaf and marbled borders.'],
  ]),
  trade('istanbul', 'shoes', {
    label: 'Slipper maker', local: 'Yemenici', word: ['Slippers', 'Yemenici'], haggle: true,
    wrap: 'stuffed with newspaper, toes together, in a box with a picture of a slipper on it',
    keeperLook: L.craft,
    lines: [
      'Yemeni are soft leather shoes, made on a wooden last. No glue. Stitched, all of it.',
      'In the old days you could tell a man\'s job by his shoes. Red for the Muslims, black for the Greeks, blue for the Jews.',
      'Take your shoes off at the door of every home. And the mosque. That is why we make slippers.',
    ],
  }, [
    ['house', 'common', lira(600), 'slippers', [0xa8202a, 0xe8c040, 0xf4f1ea], 'Embroidered slippers', 'Nakışlı terlik', 'Velvet house slippers embroidered in gold thread, with turned-up toes.'],
    ['yemeni', 'common', lira(1100), 'slippers', [0x8a4a2a, 0x5a2e16, 0xc8a050], 'Leather yemeni', 'Yemeni', 'Soft hand-stitched leather shoes, light as socks. Walk the bazaar all day in them.'],
    ['carik', 'fine', lira(2400), 'slippers', [0xc8281e, 0x7a1a1a, 0xe8c040], 'Ottoman çarık', 'Çarık', 'Pointed red leather shoes with a curled toe, like the ones in the old miniature paintings.'],
  ]),
];

// ================================================================================================ Amalfi (euro)
const AMALFI: Trade[] = [
  trade('amalfi', 'ceramica', {
    label: 'Ceramics shop', local: 'Ceramiche', word: ['Ceramics', 'Ceramiche'],
    wrap: 'wrapped in tissue, then bubble wrap, and boxed with a note: "fatto a mano, made by hand"',
    keeperLook: L.stripe,
    lines: [
      'Vietri is just down the coast. Every family there has a kiln, and every kiln has its own blues and yellows.',
      'Lemons, fish, donkeys. Those are the three things on Amalfi plates. And sometimes a saint.',
      'We can paint your name on it, or your street number. Come back tomorrow, the glaze needs a night.',
    ],
  }, [
    ['magnet', 'common', eur(4), 'tile', [0xf5f1e6, 0xf2c81e, 0x3f8a32], 'Lemon magnet', 'Calamita', 'A little majolica lemon for the fridge, painted with three green leaves.'],
    ['cup', 'common', eur(12), 'cup', [0xf5f1e6, 0x2f63a8, 0xe9c23a], 'Espresso cup', 'Tazzina', 'A tiny cup and saucer painted with lemons. Exactly enough for one caffè.'],
    ['number', 'common', eur(18), 'tile', [0xf5f1e6, 0x2f63a8, 0xe9c23a], 'House number tile', 'Numero civico', 'A hand-painted tile with your house number, wreathed in lemons. They will paint any number.'],
    ['cruet', 'fine', eur(35), 'bottle', [0xf5f1e6, 0x2f63a8, 0xe9c23a], 'Olive oil cruet', 'Oliera', 'A pear-shaped oil bottle with a cork stopper, painted with a sunflower.'],
    ['plate', 'fine', eur(45), 'plate', [0xf5f1e6, 0xe9c23a, 0x2f63a8], 'Lemon plate', 'Piatto ai limoni', 'A wall plate thick with painted lemons and leaves round a blue rim. Every one is a little different.'],
    ['platter', 'rare', eur(180), 'plate', [0xf8f2e0, 0x2f8a6a, 0xe8803a], 'Vietri serving platter', 'Piatto da portata', 'A huge oval platter painted with a fisherman, his gozzo and a swordfish, by the oldest workshop in Vietri.'],
    ['riggiola', 'treasure', eur(850), 'tile', [0xf0e2c0, 0x2f63a8, 0xc8603a], 'Church floor tile', 'Riggiola antica', 'An eighteenth-century majolica tile from the floor of a chapel in Ravello, worn smooth in the middle by two hundred years of kneeling.'],
  ]),
  trade('amalfi', 'limoncello', {
    label: 'Limoncello cellar', local: 'Limoncelleria', word: ['Limoncello', 'Limoncello'],
    wrap: 'its cork sealed with yellow wax, and the bottle rolled in corrugated card',
    keeperLook: L.stripe,
    lines: [
      'Sfusato amalfitano: our lemons. Long, pointed, thick skin, sweet enough to eat like an apple.',
      'Only the peel goes in. Peel, alcohol, sugar, water. Thirty days. No secrets, only good lemons.',
      'Keep the bottle in the freezer and serve it in a frozen glass. After dinner, never before.',
    ],
  }, [
    ['candies', 'common', eur(5), 'jar', [0xf2e04a, 0xf6eccd, 0x3f8a32], 'Lemon candies', 'Caramelle al limone', 'Hard sweets filled with lemon powder, in a tin with a painted lemon on it.'],
    ['mini', 'common', eur(4), 'bottle', [0xf2e04a, 0xf6eccd, 0xc8a050], 'Mini limoncello', 'Mignon', 'Five centilitres in a tiny bottle shaped like a lemon. Hard to give away, easy to drink.'],
    ['bottle', 'common', eur(16), 'bottle', [0xf2e04a, 0xf6eccd, 0x3f8a32], 'Limoncello', 'Limoncello', 'Half a litre made in the back room from lemons picked on the terraces above the town.'],
    ['crema', 'common', eur(18), 'bottle', [0xf8f0c8, 0xf2c81e, 0x3f8a32], 'Crema di limoncello', 'Crema di limone', 'Limoncello made with milk instead of water: soft, creamy, dangerous.'],
    ['soap', 'common', eur(6), 'soap', [0xf2e04a, 0xf8f0c8, 0x3f8a32], 'Lemon soap', 'Sapone al limone', 'A bar scented with sfusato peel, wrapped in paper with a lemon stamp.'],
    ['painted', 'fine', eur(65), 'bottle', [0xf5f1e6, 0xf2c81e, 0x2f63a8], 'Limoncello in majolica', 'Bottiglia dipinta', 'A litre of the good one in a hand-painted ceramic bottle you will keep long after it is empty.'],
    ['riserva', 'rare', eur(120), 'box', [0x5e3b26, 0xf2e04a, 0xc8a050], 'Family riserva', 'Riserva di famiglia', 'Three bottles from the old family terrace, numbered by hand, in a chestnut box. Only sixty are made each year.'],
  ]),
  trade('amalfi', 'carta', {
    label: 'Paper workshop', local: 'Cartiera', word: ['Paper', 'Cartiera'],
    wrap: 'laid between sheets of its own paper and tied with a ribbon and a wax seal',
    keeperLook: L.craft,
    lines: [
      'Amalfi made paper before almost anyone in Europe. The mills in the Valle dei Mulini ran on the stream for seven centuries.',
      'Bambagina: cotton rags beaten to pulp, lifted on a wire sieve, pressed and dried. Every sheet has a soft, deckled edge.',
      'Hold it to the window. See the watermark? That is the mill\'s mark. Every sheet signs itself.',
    ],
  }, [
    ['cards', 'common', eur(9), 'book', [0xf6eccd, 0xe0d4b0, 0x3f8a32], 'Deckled cards', 'Biglietti', 'Six cards and envelopes of rough cotton paper with a pressed lemon leaf.'],
    ['set', 'common', eur(15), 'book', [0xf6eccd, 0xa86a32, 0xc8a050], 'Writing paper set', 'Carta da lettere', 'Twenty sheets of watermarked bambagina in a folder, for the letter you have been meaning to write.'],
    ['seal', 'fine', eur(28), 'box', [0x5e3b26, 0xb8281e, 0xc8a050], 'Wax seal kit', 'Sigillo', 'A brass seal with the Amalfi cross, three sticks of red wax and a little spoon.'],
    ['notebook', 'fine', eur(38), 'book', [0x8a5a3a, 0xf6eccd, 0xc8a050], 'Leather notebook', 'Quaderno in pelle', 'Handmade paper bound in soft leather with a long wraparound strap.'],
    ['album', 'rare', eur(160), 'book', [0xf0e2c0, 0xc8a050, 0x5e3b26], 'Bambagina album', 'Album di nozze', 'A wedding album of hand-made pages, each lifted from the vat by the master papermaker. Six weeks to make.'],
    ['ledger', 'treasure', eur(600), 'book', [0x5a3a22, 0xe8dcc0, 0x8a2a1a], 'Paper mill ledger', 'Registro antico', 'A ledger from 1820 on the mill\'s own paper, its pages full of orders for paper to Naples, Rome and Marseille.'],
  ]),
  trade('amalfi', 'lino', {
    label: 'Linen and sandal shop', local: 'Lino e sandali', word: ['Linen', 'Lini'],
    wrap: 'folded round a sheet of tissue and slipped into a white cotton bag',
    keeperLook: L.linen,
    lines: [
      'Moda Positano: white linen, bare feet, lemons. In the sixties the whole world came here to dress like this.',
      'The sandals? Made while you wait. Pick the sole, pick the straps, sit down, have a coffee.',
      'Linen should crease. If it does not crease, it is not linen.',
    ],
  }, [
    ['towel', 'common', eur(12), 'cloth', [0xf6f2ea, 0xf2c81e, 0x3f8a32], 'Lemon tea towel', 'Strofinaccio', 'A linen tea towel printed with sfusato lemons.'],
    ['scarf', 'common', eur(29), 'cloth', [0xa8d4e8, 0xf6f2ea, 0x2f63a8], 'Linen scarf', 'Sciarpa di lino', 'A light scarf the blue of the bay at eleven in the morning.'],
    ['shirt', 'fine', eur(59), 'cloth', [0xf8f6f0, 0xe8e2d4, 0xd9cfc0], 'Linen shirt', 'Camicia di lino', 'A loose white linen shirt with mother-of-pearl buttons. The uniform of the coast.'],
    ['sandals', 'fine', eur(85), 'slippers', [0xc89a5a, 0xf2c81e, 0x8a5a3a], 'Made-to-measure sandals', 'Sandali su misura', 'Leather sandals cut and stitched to your feet in twenty minutes, with a lemon on the strap.'],
    ['cloth', 'rare', eur(140), 'cloth', [0xf8f6f0, 0xf2c81e, 0x3f8a32], 'Embroidered tablecloth', 'Tovaglia ricamata', 'A linen tablecloth for eight, embroidered with lemon branches by a woman in Atrani who has done it for fifty years.'],
  ]),
  trade('amalfi', 'bottega', {
    label: 'Delicatessen', local: 'Bottega', word: ['Deli', 'Bottega'],
    wrap: 'bundled in brown paper, the jars wrapped in pages of Il Mattino, with a sprig of bay',
    keeperLook: L.apron,
    lines: [
      'Colatura di alici: anchovies layered with salt in a chestnut barrel. The drops that come out of the bottom are gold.',
      'Pasta from Gragnano, dried slowly in the sea wind. Bronze dies, so the sauce clings.',
      'Peperoncino on a string over every kitchen door. For the food, and for the evil eye.',
    ],
  }, [
    ['pasta', 'common', eur(4), 'box', [0xe8d090, 0x2f63a8, 0xf6f2ea], 'Gragnano pasta', 'Pasta di Gragnano', 'Half a kilo of bronze-cut paccheri, rough as sandpaper, from the pasta town over the hills.'],
    ['chili', 'common', eur(6), 'peppers', [0xc8281e, 0xa81a1a, 0xc9a46a], 'String of chillies', 'Treccia di peperoncini', 'Dried red chillies braided on a string. Hang it by the stove.'],
    ['tomato', 'common', eur(8), 'jar', [0xc8321e, 0x3f8a32, 0xf6f2ea], 'Sun-dried tomatoes', 'Pomodori secchi', 'Tomatoes dried on the roofs and packed in oil with oregano and garlic.'],
    ['colatura', 'common', eur(12), 'bottle', [0xb8742a, 0xf6f2ea, 0x2f63a8], 'Colatura di alici', 'Colatura di Cetara', 'Amber anchovy essence from Cetara, the little fishing town next door. A few drops on spaghetti.'],
    ['oil', 'common', eur(14), 'bottle', [0xd9b84a, 0xf2c81e, 0x3f8a32], 'Lemon olive oil', 'Olio al limone', 'Olives and lemons crushed together in the press. Pour it on fish, salad, ice cream.'],
    ['aged', 'fine', eur(38), 'bottle', [0x8a4a1a, 0xc8a050, 0x5e3b26], 'Aged colatura', 'Colatura stravecchia', 'Three years in chestnut wood, darker and deeper, in a numbered bottle.'],
  ]),
];

// ================================================================================================ Madeira (euro)
const MADEIRA: Trade[] = [
  trade('madeira', 'bordado', {
    label: 'Embroidery shop', local: 'Bordados', word: ['Embroidery', 'Bordados'],
    wrap: 'folded in tissue in a flat box, with the lead seal of the Madeira Embroidery Institute on a cord',
    keeperLook: L.linen,
    lines: [
      'Bordado Madeira. Every real piece carries a little lead seal from the Institute. No seal, not Madeira.',
      'The pattern is pricked onto the linen, then the women embroider at home, in the villages. One tablecloth can take months.',
      'An English lady, Miss Phelps, started the trade in the 1850s. Now Madeira embroidery is in palaces all over the world.',
    ],
  }, [
    ['magnet', 'common', eur(4), 'tile', [0xf6f2ea, 0x2f63a8, 0xf6f2ea], 'Embroidered magnet', 'Íman bordado', 'A tiny embroidered flower in a frame for the fridge.'],
    ['lenco', 'common', eur(18), 'cloth', [0xf8f6f0, 0x2f63a8, 0xf8f6f0], 'Embroidered handkerchief', 'Lenço bordado', 'Fine cotton with a corner of blue flowers and the Institute seal.'],
    ['napkins', 'fine', eur(45), 'cloth', [0xf8f6f0, 0xe8dcc0, 0x8a6a4a], 'Napkin set', 'Guardanapos', 'Four linen napkins with white-on-white flowers, the stitches finer than rice grains.'],
    ['runner', 'fine', eur(120), 'cloth', [0xf0e8d8, 0x2f63a8, 0xf8f6f0], 'Table runner', 'Caminho de mesa', 'A long linen runner with blue garlands and cut-work holes, bordado azul.'],
    ['toalha', 'rare', eur(680), 'cloth', [0xf8f6f0, 0xd8cfc0, 0xf8f6f0], 'Embroidered tablecloth', 'Toalha bordada', 'A linen tablecloth for twelve, six months of one woman\'s evenings in Camacha. She stitched her initials under a leaf.'],
    ['veil', 'treasure', eur(1200), 'cloth', [0xfbf8f2, 0xf0e8d8, 0xe8dcc0], 'Bridal veil, 1950s', 'Véu de noiva', 'An organdie wedding veil embroidered in white thread for a Funchal bride in 1954, kept in its box ever since.'],
  ]),
  trade('madeira', 'vinho', {
    label: 'Wine lodge', local: 'Vinhos', word: ['Wines', 'Vinhos'],
    wrap: 'laid in a wooden box with straw, the lodge\'s name branded on the lid',
    keeperLook: L.vest,
    lines: [
      'Madeira wine was made by accident. Barrels crossed the equator in ships, cooked in the heat, and came back better.',
      'Sercial is dry, Verdelho half dry, Boal half sweet, Malvasia sweet. Four grapes, four moods.',
      'Open a bottle and it lasts for months. A wine that has been to the tropics is not afraid of the air.',
    ],
  }, [
    ['honey', 'common', eur(8), 'box', [0x5a2e16, 0xc8a050, 0xa86a32], 'Bolo de mel', 'Bolo de mel', 'The island\'s cane honey cake, dark and spiced, wrapped in paper. It keeps for a year. Break it by hand, never cut it.'],
    ['poncha', 'common', eur(12), 'bottle', [0xe8c040, 0xf6f2ea, 0x2f6b3a], 'Bottled poncha', 'Poncha', 'Aguardente, honey and lemon in a bottle, for when you miss the bar in Câmara de Lobos.'],
    ['five', 'common', eur(15), 'bottle', [0x8a3a1a, 0xf6f2ea, 0x2b2420], 'Five-year Madeira', 'Madeira 5 anos', 'A blend for every day, medium sweet, tasting of figs and walnuts.'],
    ['ten', 'fine', eur(32), 'bottle', [0x6a2a10, 0xe8dcc0, 0xc8a050], 'Ten-year Verdelho', 'Verdelho 10 anos', 'Half dry, with burnt orange and smoke. The one to have with soup.'],
    ['malvasia', 'fine', eur(55), 'bottle', [0x4a1a08, 0xe8dcc0, 0xc8a050], 'Fifteen-year Malvasia', 'Malvasia 15 anos', 'Sweet, dark and endless, like coffee and toffee and marmalade at once.'],
    ['colheita', 'rare', eur(95), 'bottle', [0x3a1408, 0xf0e2c0, 0x8a2a1a], 'Boal colheita 1998', 'Colheita', 'A single-harvest wine aged in the lodge\'s attic, where the summer heat does what the ships once did.'],
    ['frasqueira', 'treasure', eur(1400), 'bottle', [0x2a0e04, 0xe8dcc0, 0x1f1f24], 'Frasqueira Malvasia 1900', 'Frasqueira', 'A vintage Malvasia from 1900, older than anyone in Funchal, rebottled by hand and sealed with black wax. It will outlive you too.'],
  ]),
  trade('madeira', 'artesanato', {
    label: 'Crafts shop', local: 'Artesanato', word: ['Crafts', 'Artesanato'],
    wrap: 'tucked into a basket from Camacha, which they throw in free',
    keeperLook: L.craft,
    lines: [
      'Camacha wickerwork: willow cut in winter, boiled, peeled and woven. Chairs, baskets, even a sled for the Monte toboggan.',
      'The carapuça is the wool hat with the little tail. Farmers wore them in the mountains.',
      'The brinquinho is a pole of little dolls with castanets and bottle caps. Shake it and the whole party starts.',
    ],
  }, [
    ['tile', 'common', eur(12), 'tile', [0xf6f2ea, 0x2f63a8, 0x2f63a8], 'Azulejo tile', 'Azulejo', 'A blue and white tile with a little sailing ship, the way Portuguese houses are faced.'],
    ['carapuca', 'common', eur(25), 'hat', [0x2b4c86, 0xc8281e, 0xe8c040], 'Carapuça hat', 'Carapuça', 'A pointed blue wool hat lined in red with a little tail, from the island\'s folk costume.'],
    ['basket', 'common', eur(28), 'basket', [0xc9a46a, 0xa8844a, 0xc9a46a], 'Camacha basket', 'Cesto de vime', 'A wicker basket woven in Camacha, still smelling of willow.'],
    ['brinquinho', 'fine', eur(35), 'doll', [0xc8281e, 0x2b4c86, 0xe8c040], 'Brinquinho', 'Brinquinho', 'A folk rattle of little costumed dolls on a pole, with castanets. Shake it at a festa.'],
    ['botas', 'fine', eur(90), 'boots', [0xe8dcc0, 0xc8281e, 0x5a3a22], 'Botas de vilão', 'Botas de vilão', 'Soft boots of natural leather with a red stripe and folded tops, made by one of the last bootmakers in Funchal.'],
    ['chair', 'rare', eur(320), 'basket', [0xb89a5a, 0x8a6a3a, 0xc9a46a], 'Wicker armchair', 'Cadeira de vime', 'A Camacha armchair, three days of weaving. They ship it home in a crate.'],
    ['painel', 'treasure', eur(950), 'tile', [0xf0e8d8, 0x1f4a98, 0xe8c040], 'Seventeenth-century azulejo', 'Painel de azulejos', 'Four tiles from a Lisbon church of the 1680s, blue on white, a cherub and a vine. Rescued, documented and sold with papers.'],
  ]),
  trade('madeira', 'flores', {
    label: 'Flower stall', local: 'Flores', word: ['Flowers', 'Flores'],
    wrap: 'boxed in a cardboard tube with a breathing hole, ready for the hand luggage',
    keeperLook: { topStyle: 'vest', top: 0xc8281e, accent: 0xe8c040, bottom: 0x2b2b30, hat: 'none' },
    lines: [
      'The strelitzia is the bird of paradise. Orange wings, blue beak. The island\'s flower.',
      'Madeira is a garden in the middle of the ocean. Anything grows here. Throw a seed and run.',
      'We wear this costume for the tourists, but my grandmother wore it for real, selling flowers on these same steps.',
    ],
  }, [
    ['seeds', 'common', eur(3), 'box', [0x3f8a32, 0xe8803a, 0xf6f2ea], 'Seed packet', 'Sementes', 'Strelitzia seeds in a paper packet. They take years to flower. Be patient.'],
    ['protea', 'common', eur(8), 'flower', [0xf0a0b8, 0x3f8a32, 0x8a5a3a], 'Protea', 'Protea', 'A king protea as big as a fist, pink and furry. It dries beautifully.'],
    ['strelitzia', 'common', eur(10), 'flower', [0xe8803a, 0x2f63a8, 0x3f8a32], 'Bird of paradise', 'Estrelícia', 'Three strelitzias wrapped for the flight home.'],
    ['orchid', 'fine', eur(18), 'flower', [0xf8f2ea, 0xb85aa8, 0xf6f2ea], 'Orchid in a box', 'Orquídea', 'A white orchid packed to survive the plane, from the orchid farm up the hill.'],
  ]),
];

/** Every trade in the world, by city. */
/** Halcyon City's shops: gadgets, holo prints, street art and the black market (2040). */
const NEO: Trade[] = [
  trade('neo', 'gadget', {
    label: 'Gadget shop', local: 'CHROME & JUNK', word: ['Chrome', 'CHROME'], wrap: 'sealed in an antistatic pouch',
    keeperLook: { topStyle: 'jacket', top: 0x1e1e26, accent: 0x5ff0ff, bottom: 0x1e1e26, hat: 'none', glasses: true },
    lines: ['Everything here works. Mostly. Ninety-day warranty, which I honour on Tuesdays.', 'That one fell off a delivery drone. Legally speaking, it is lost property.', 'Want an upgrade? I do not do surgery. Ask at the back alley clinics, not me.'],
  }, [
    ['cable', 'common', 40, 'box', [0x1e1e26, 0x5ff0ff, 0xf2f2f2], 'Glow cable', 'GLOW CABLE', 'A charging cable that glows the colour of your battery.'],
    ['drone', 'fine', 220, 'box', [0x2a2a34, 0xff5fb4, 0xf2f2f2], 'Pocket drone', 'MICRO DRONE', 'A palm-sized drone that follows you and takes terrible photos.'],
    ['visor', 'fine', 380, 'hat', [0x16161c, 0x2ad8ff, 0xa47bff], 'AR visor', 'AR VISOR', 'Overlays the city with tags, prices and the names of strangers.'],
    ['chip', 'rare', 900, 'coin', [0xc8a040, 0x16161c, 0x5ff0ff], 'Vintage chip', 'MEMORY CHIP', 'A memory chip from 2019. Nobody knows what is on it.'],
    ['robocat', 'treasure', 2400, 'cat', [0xd8dce0, 0x5ff0ff, 0x16161c], 'Robot cat', 'NEKO-UNIT', 'A refurbished companion cat. It purrs at 40 Hz and never needs feeding.'],
  ]),
  trade('neo', 'prints', {
    label: 'Holo print shop', local: 'HOLO PRINTS', word: ['Holo', 'HOLO'], wrap: 'rolled into a tube',
    keeperLook: { topStyle: 'tee', top: 0xff5fb4, accent: 0xf2efe7, bottom: 0x2a2a34, hat: 'beanie', hatColor: 0x16161c },
    lines: ['Every print is the city on a different night. I shoot from the rooftops.', 'Turn it in the light. The rain moves.', 'The Halo at midnight is my best seller. Everybody wants the Halo.'],
  }, [
    ['postcard', 'common', 12, 'print', [0x2ad8ff, 0xff5fb4, 0x16161c], 'Holo postcard', 'POSTCARD', 'The Halo crossing in the rain. The rain moves when you tilt it.'],
    ['poster', 'fine', 90, 'print', [0xa47bff, 0x16161c, 0xffdc5a], 'Neon Mile poster', 'POSTER', 'A metre of neon signs printed in light.'],
    ['map', 'rare', 300, 'scroll', [0xd8c8a0, 0x2a2a34, 0xd8282e], 'Old city map', 'MAP 2019', 'Halcyon before the floods, when the bottom floor was the only floor.'],
  ]),
  trade('neo', 'curios', {
    label: 'Curio stall', local: 'CURIOS', word: ['Lucky', 'LUCKY'], wrap: 'wrapped in old newspaper, the last paper in town',
    keeperLook: { topStyle: 'cardigan', top: 0x8a6a4a, accent: 0xd8282e, bottom: 0x2a2a34, hat: 'none', glasses: true },
    lines: ['Things from before. Real things. Touch nothing you cannot afford.', 'That cat waves its paw with a little motor now. Progress.', 'Paper books! Real paper! They smell of the past.'],
  }, [
    ['luckycat', 'common', 25, 'cat', [0xf2efe7, 0xd8282e, 0xc8a040], 'Motorised lucky cat', 'LUCKY CAT', 'It waves its paw forever, on a solar cell.'],
    ['book', 'fine', 120, 'book', [0x8a2a2a, 0xe8d8b8, 0xc8a040], 'Paper novel', 'PAPER BOOK', 'A paperback from 2008. Somebody underlined all the sad parts.'],
    ['seedpot', 'rare', 450, 'pot', [0x8a5a3a, 0x4a9a3a, 0x6ab84a], 'Potted basil', 'REAL BASIL', 'A real basil plant in real soil. Water it. Please water it.'],
  ]),
];

export const TRADES: Record<CityId, Trade[]> = { tokyo: TOKYO, istanbul: ISTANBUL, amalfi: AMALFI, madeira: MADEIRA, neo: NEO };
export const ALL_SOUVENIRS: Souvenir[] = Object.values(TRADES).flat().flatMap((t) => t.items);
export const SOUVENIR: Record<string, Souvenir> = Object.fromEntries(ALL_SOUVENIRS.map((s) => [s.id, s]));
export const tradeOf = (city: CityId, id: string): Trade | undefined => TRADES[city].find((t) => t.id === id);
/** This city's trades and souvenirs. */
export const CITY_TRADES = TRADES[CITY];
export const CITY_SOUVENIRS = CITY_TRADES.flatMap((t) => t.items);

/** A price in a city's own money, wherever the traveller is now. */
export function moneyIn(city: CityId, n: number): string {
  if (city === 'tokyo') return `¥${n.toLocaleString('en-US')}`;
  if (city === 'istanbul') return `₺${Math.round(n / YEN_PER_LIRA).toLocaleString('en-US')}`;
  return `€${(n / YEN_PER_EURO).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** A price rounded the way a haggling shopkeeper would say it: to 10, 50 or 100 of the city's money. */
export function roundPrice(city: CityId, yen: number): number {
  if (city === 'istanbul') { const t = yen / YEN_PER_LIRA, step = t < 400 ? 10 : t < 3000 ? 50 : 100; return lira(Math.max(step, Math.round(t / step) * step)); }
  if (city === 'tokyo') { const step = yen < 5000 ? 10 : 100; return Math.max(step, Math.round(yen / step) * step); }
  const e = yen / YEN_PER_EURO, step = e < 20 ? 0.5 : e < 100 ? 1 : 5;
  return eur(Math.max(step, Math.round(e / step) * step));
}

// ------------------------------------------------------------------------------------------- where the trades are sold
/** Istanbul's shops (world/bazaars.ts and the street shops in world/istanbul.ts) by what they keep on the shelves. */
export function istanbulTrade(kind: string, seed: number): string {
  // the Grand Bazaar's cloth merchants sell slippers as often as scarves, and the spice sellers weigh out tea
  if (kind === 'textile' && seed % 3 === 0) return 'shoes';
  if (kind === 'spice' && seed % 3 === 1) return 'tea';
  if (kind === 'kuruyemis' && seed % 2 === 1) return 'bakkal';
  return ISTANBUL_SHOP_TRADE[kind];
}
const ISTANBUL_SHOP_TRADE: Record<string, string> = {
  carpet: 'carpet', lamp: 'lamp', ceramic: 'ceramic', copper: 'copper', textile: 'textile', jewel: 'jewel', leather: 'leather',
  spice: 'spice', tea: 'tea', nuts: 'nuts', lokum: 'lokum', soap: 'soap', nazar: 'nazar',
  bakkal: 'bakkal', kuruyemis: 'nuts', ceramics: 'ceramic', lamps: 'lamp', kahve: 'kahve', books: 'sahaf', shoes: 'shoes',
};
/** Tokyo's general shops each specialise, in turn, by their number on the street. */
const TOKYO_SHOP_TRADES = ['zakka', 'toki', 'hamono', 'omocha', 'washi'];
/** The trade a Tokyo walk-in room sells, if it sells souvenirs. */
export function roomTrade(kind: string, nth: number): string | null {
  if (CITY === 'neo') { const s = kind === 'shop' ? neoShop(nth) : null; return s?.role === 'trade' ? s.trade : null; }
  if (kind === 'shop') return TOKYO_SHOP_TRADES[nth % TOKYO_SHOP_TRADES.length];
  if (kind === 'books') return 'books';
  if (kind === 'florist') return 'hana';
  return null;
}

// ------------------------------------------------------------------------------------------- shop names and keepers
const BRANDS: Record<CityId, [string, string][]> = {
  tokyo: [['Hinata', 'ひなた'], ['Tsubame', 'つばめ'], ['Kumo', 'くも'], ['Marumaru', 'まるまる'], ['Ginkgo', 'いちょう'], ['Komorebi', 'こもれび'], ['Kikuya', '菊屋'], ['Yamato', '大和'], ['Shirokane', '白金'], ['Asakusa', '浅草']],
  istanbul: [['Öztürk', 'Öztürk'], ['Kardeşler', 'Kardeşler'], ['Galata', 'Galata'], ['Sultan', 'Sultan'], ['Yıldız', 'Yıldız'], ['Lale', 'Lale'], ['Hacı Baba', 'Hacı Baba'], ['Deniz', 'Deniz'], ['Anadolu', 'Anadolu'], ['Topkapı', 'Topkapı'], ['Kapalı', 'Kapalı'], ['Hilal', 'Hilal']],
  amalfi: [['Esposito', 'Esposito'], ['Cuomo', 'Cuomo'], ['Amatruda', 'Amatruda'], ['Pansa', 'Pansa'], ['Del Pizzo', 'Del Pizzo'], ['Ruocco', 'Ruocco'], ['Milano', 'Milano']],
  neo: [['Neon', 'NEON'], ['Kowa', 'KOWA'], ['Vanta', 'VANTA'], ['Zenith', 'ZENITH'], ['Halo', 'HALO'], ['Rook', 'ROOK']],
  madeira: [['Freitas', 'Freitas'], ['Gouveia', 'Gouveia'], ['Teixeira', 'Teixeira'], ['Abreu', 'Abreu'], ['Camacha', 'Camacha'], ['Sousa', 'Sousa'], ['Vieira', 'Vieira']],
};
const KEEPERS: Record<CityId, string[]> = {
  tokyo: ['Mrs. Aoki', 'Kenta', 'Mr. Maeda', 'Sachiko', 'Old Mr. Hori', 'Yumi', 'Mr. Takeda', 'Ms. Ishii', 'Haruto', 'Mrs. Endō'],
  istanbul: ['Mehmet Bey', 'Ahmet Usta', 'Ayşe Hanım', 'Murat', 'Selim Bey', 'Hasan Amca', 'Zeynep', 'Kemal Usta', 'Emre', 'Fatma Teyze', 'Orhan Bey', 'Cem', 'Hüseyin Efendi', 'Elif'],
  amalfi: ['Signora Rosa', 'Gennaro', 'Antonella', 'Don Peppe', 'Carmela', 'Salvatore', 'Lucia'],
  neo: ['Rix', 'Mama Teo', 'Static', 'Old Wen', 'Juno', 'Pike'],
  madeira: ['Dona Graça', 'Senhor Manuel', 'Fátima', 'João', 'Dona Lurdes', 'Rui', 'Conceição'],
};

/** The k-th shop of a trade in its city: its name, the name over the door and its keeper. */
export function shopIdentity(t: Trade, k: number, seed: number): { name: string; local: string; keeper: string } {
  const brands = BRANDS[t.city], ti = TRADES[t.city].indexOf(t);
  const [be, bl] = brands[(ti * 3 + k * 11) % brands.length];
  const [we, wl] = t.word;
  const keepers = KEEPERS[t.city];
  const keeper = keepers[(ti * 7 + k * 3 + (seed >>> 0) % 5) % keepers.length];
  switch (t.city) {
    case 'tokyo': return { name: `${be} ${we}`, local: `${bl}${wl}`, keeper };
    case 'istanbul': return { name: `${be} ${we}`, local: `${bl} ${wl}`, keeper };
    // on the coast and the island the sign is the name: Ceramiche Esposito, Bordados Freitas
    default: return { name: `${wl} ${bl}`, local: `${wl} ${bl}`, keeper };
  }
}

// ------------------------------------------------------------------------------------------- stock
const hash = (a: number, b: number) => { let x = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35); x ^= x >>> 15; x = Math.imul(x, 0x27d4eb2d); return ((x ^ (x >>> 13)) >>> 0) / 4294967296; };
const strHash = (s: string) => { let x = 7; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619); return x >>> 0; };

/**
 * What each shop of one trade keeps (seeds of every shop of that trade in the city, in a stable order): every
 * shop has the everyday and fine pieces; each rare one is in about half of them (and always in at least one); each
 * one-of-a-kind piece is in exactly one.
 */
export function stockFor(t: Trade, seeds: number[]): string[][] {
  const out = seeds.map(() => [] as string[]);
  for (const it of t.items) {
    if (it.tier === 'common' || it.tier === 'fine') { for (const s of out) s.push(it.id); continue; }
    const h = seeds.map((sd) => hash(sd, strHash(it.id)));
    const best = h.indexOf(Math.min(...h));
    h.forEach((v, i) => { if (i === best || (it.tier === 'rare' && v < 0.45)) out[i].push(it.id); });
  }
  return out;
}

/** The keeper's walk-away point when haggling over a piece: a share of the asking price, the same every visit. */
export function haggleFloor(itemId: string, seed: number): number {
  return 0.66 + hash(strHash(itemId), seed) * 0.16;
}
