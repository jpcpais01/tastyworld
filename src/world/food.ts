import { rng } from './grid';
import { Palette } from './palette';
import { Prop } from './props';
import { buildMadeiraFood, type MadeiraFood } from './foodMadeira';
import { buildIstanbulFood, type IstanbulFood } from './foodIstanbul';
import { buildTokyoFood, type TokyoFood } from './foodTokyo';

/** Voxel models of every dish. Pure data so they can be built in the worker (counter displays) and on the main thread (icons). */

export function foodColors(pal: Palette) {
  const a = (hex: number, vary = 0.07, emit = 0) => pal.add(hex, { vary, emit });
  return {
    tray: a(0xe8d2a6, 0.04), trayDark: a(0xc9ab78, 0.04),
    batter: a(0xd99a4e, 0.1), batterDark: a(0xa8642c, 0.1), batterLight: a(0xf0c27a, 0.08),
    sauce: a(0x5a2d17, 0.08), mayo: a(0xfbf3dc, 0.02), nori: a(0x2f6b2a, 0.15), bonito: a(0xe9b796, 0.15),
    pick: a(0xe6cf9c, 0.03), plate: a(0xf4f1ea, 0.02), plateBlue: a(0x3c62a0, 0.04), plateRim: a(0x2b4c86, 0.03),
    steel: a(0x50555c, 0.04), steelLight: a(0x9aa1a8, 0.03), monja: a(0xb98a52, 0.12), monjaCrisp: a(0x7a4d28, 0.12),
    cabbage: a(0xb9d98a, 0.1), mentaiko: a(0xf07a7a, 0.08), cheese: a(0xf6d36b, 0.06),
    dango: a(0xf3ead6, 0.04), mitarashi: a(0xb8732c, 0.08), mitarashiGloss: a(0xd9933c, 0.06),
    bean: a(0x5b1f22, 0.08), skewer: a(0xdcc08a, 0.03),
    chicken: a(0xc77a3c, 0.1), chickenGlaze: a(0x8a4318, 0.08), scallion: a(0x6fae4a, 0.1), scallionWhite: a(0xe8efd2, 0.05),
    karaage: a(0xc8803a, 0.14), karaageDark: a(0x9a5a24, 0.12), lemon: a(0xf5dc4a, 0.05), lettuce: a(0x8cc65a, 0.1),
    bowl: a(0xc9372c, 0.04), bowlIn: a(0x1f1f24, 0.03), broth: a(0x8a4a1c, 0.05), brothHi: a(0xb06a2a, 0.05),
    noodle: a(0xf2d88a, 0.06), chashu: a(0xc78b6a, 0.08), chashuEdge: a(0x8a4a2a, 0.06), eggWhite: a(0xfaf6ea, 0.02),
    yolk: a(0xf29a1c, 0.04), naruto: a(0xfbf7f2, 0.02), narutoPink: a(0xec6c8e, 0.03), menma: a(0xc9a050, 0.06),
    gyoza: a(0xf1e3c2, 0.05), gyozaBrown: a(0xb87332, 0.1), wing: a(0xd8a65e, 0.12),
    rice: a(0xfbfaf4, 0.03), tuna: a(0xc8283a, 0.06), kohada: a(0xb8c4cc, 0.08), kohadaDark: a(0x5a6a7a, 0.08),
    shrimp: a(0xf28a5a, 0.05), shrimpStripe: a(0xfbe2d2, 0.03), tamago: a(0xf6cf4a, 0.05), tamagoDark: a(0xd9a62a, 0.06),
    ikura: a(0xff6a2a, 0.1, 0.15), geta: a(0xc99a62, 0.05), getaDark: a(0x8a6038, 0.05), wasabi: a(0x8cbf4a, 0.06), ginger: a(0xf4b6b0, 0.05),
    paper: a(0xf6efe0, 0.03), paperRed: a(0xc8372d, 0.04), shiso: a(0x3f8a3a, 0.08),
    custard: a(0xf6d878, 0.04), caramel: a(0x8a4a1a, 0.06), cream: a(0xfbf6ec, 0.02), cherry: a(0xd8202a, 0.04), glass: pal.add(0xdcecf2, { glass: true }),
    pasta: a(0xe8823a, 0.08), pastaHi: a(0xf2a050, 0.06), pepper: a(0x4a9a3a, 0.08), sausage: a(0xc0504a, 0.06), onion: a(0xf3ecd8, 0.04), parmesan: a(0xf8f0d0, 0.04),
    zaru: a(0xc9a46a, 0.05), zaruDark: a(0x9a7a48, 0.05), sobaN: a(0x9c8a72, 0.07), sobaHi: a(0xb4a28a, 0.06), tsuyu: a(0x3a2010, 0.04), choko: a(0x2b3a62, 0.03), negi: a(0x9ccf6a, 0.08),
    tempura: a(0xf0c878, 0.12), tempuraHi: a(0xf8dc9a, 0.1), tail: a(0xe8603a, 0.05), shiso2: a(0x2f7a32, 0.08), daikon: a(0xf4f1e8, 0.04),
    // Amalfi
    pastry: a(0xe0a050, 0.1), pastryDark: a(0xb86e2c, 0.1), pastryLight: a(0xf2c47a, 0.08), sugar: a(0xfbf8f2, 0.02), ricotta: a(0xf6eccd, 0.04),
    sponge: a(0xf2d27a, 0.06), lemonCream: a(0xf6e08a, 0.04), lemonPeel: a(0xf2c81e, 0.05), conePaper: a(0xc9a46e, 0.05), conePaperDark: a(0x9a7a4c, 0.05),
    fry: a(0xe2b25a, 0.12), fryDark: a(0xbf8638, 0.1), calamari: a(0xf6ecd2, 0.05), anchovy: a(0x8a96a2, 0.08), dough: a(0xf0d8a0, 0.06), crust: a(0xc98a44, 0.1),
    tomato: a(0xc8321e, 0.06), mozzarella: a(0xfbf7ec, 0.02), basil: a(0x3f8a32, 0.08), wafer: a(0xd4964c, 0.06), waferDark: a(0xa86c30, 0.06),
    pistachio: a(0xa6c46a, 0.05), lemonGelato: a(0xf8ee9a, 0.04), stracciatella: a(0xf6f0e2, 0.03), granita: a(0xf6f2c6, 0.05), limoncello: a(0xf2e04a, 0.03, 0.12),
    chocolate: a(0x4a2a1a, 0.06), chocolateDark: a(0x2e1a10, 0.05), mussel: a(0x23263a, 0.06), musselIn: a(0xe8964a, 0.06), clam: a(0xd9cfc0, 0.06),
    squid: a(0xf0e6d6, 0.05), potato: a(0xe9cf86, 0.06), parsley: a(0x3a8a2e, 0.1), ceramicBlue: a(0x2f63a8, 0.04), ceramicYellow: a(0xe9c23a, 0.04), ceramicWhite: a(0xf5f1e6, 0.02),
    scialatielli: a(0xf0dc9a, 0.06), scialatielliHi: a(0xf8eab8, 0.05), oil: a(0xd9b84a, 0.04),
    // Istanbul
    simit: a(0xb8642a, 0.1), simitDark: a(0x8a4318, 0.08), sesame: a(0xf0dca0, 0.06), bread: a(0xd9a05a, 0.08), breadIn: a(0xf6e6c0, 0.04),
    mackerel: a(0x9aa4ae, 0.08), mackerelBack: a(0x3a4a5a, 0.08), redOnion: a(0xa84a7a, 0.06), pickleJuice: a(0xd83a5a, 0.04), gherkin: a(0x8aa83a, 0.08),
    carrot: a(0xe8803a, 0.06), offal: a(0x8a5a3a, 0.1), offalHi: a(0xa86a42, 0.1), chiliFlake: a(0xb8281e, 0.08), chestnut: a(0x5a2e16, 0.08),
    chestnutIn: a(0xe8c27a, 0.06), corn: a(0xf2c84a, 0.06), cornDark: a(0xd8a02a, 0.08), husk: a(0xc9b878, 0.06), dondurma: a(0xf8f4ea, 0.02),
    salep: a(0xefe2c8, 0.03), cinnamon: a(0x8a5a2a, 0.08), doner: a(0x9a5a2a, 0.1), donerHi: a(0xb8743a, 0.08), lavash: a(0xf0dcae, 0.05),
    ayran: a(0xfbfaf4, 0.02), copper: a(0xb87333, 0.06), copperDark: a(0x8a4f22, 0.06), baklava: a(0xd89a3a, 0.08), baklavaHi: a(0xf0c060, 0.06),
    antep: a(0x7aa83a, 0.08), kadayif: a(0xe88a2a, 0.1), kadayifHi: a(0xf4a840, 0.08), syrup: a(0xe8b04a, 0.04, 0.05), begendi: a(0xe8dcb8, 0.04),
    lambStew: a(0x7a3a1a, 0.08), stewSauce: a(0xb8401e, 0.06), manti: a(0xf2e2c0, 0.04), yoghurt: a(0xfbf8f0, 0.02), redButter: a(0xc8401e, 0.04),
    mint: a(0x5a8a3a, 0.1), tulipGlass: pal.add(0xe8c8a0, { glass: true }), tea: a(0x8a2a12, 0.04), iznik: a(0x2f63a8, 0.04), iznikRed: a(0xc8321e, 0.04),
    // Amalfi's restaurants
    espresso: a(0x2e1708, 0.04), crema: a(0xb8783a, 0.06), water: pal.add(0xcfe6ee, { glass: true }), sugarPack: a(0xe9c23a, 0.03),
    terracotta: a(0xb8643a, 0.06), terracottaDark: a(0x8a4428, 0.06), aubergine: a(0x6a3a2a, 0.08), aubergineIn: a(0x4a2438, 0.06), cheeseBrown: a(0xc88a3a, 0.08),
    spaghetti: a(0xf0d890, 0.05), spaghettiHi: a(0xf8e8b0, 0.04), clamDark: a(0xa89a88, 0.06), chili: a(0xd8281e, 0.05),
    broth2: a(0xd8a060, 0.06), fishSkin: a(0xc8ccd0, 0.06), fishSkin2: a(0xe8dcc8, 0.05), fishBack: a(0x6a7684, 0.07),
    plateCream: a(0xefe6d2, 0.03), crustHi: a(0xe0aa60, 0.08), char: a(0x3a2216, 0.06), board: a(0xa87a4a, 0.05), boardDark: a(0x8a6038, 0.05),
    loaf: a(0xf0d8a0, 0.06), breadCrust: a(0xb87a3a, 0.08), grill: a(0x6a4020, 0.06), tomatoHi: a(0xe8503a, 0.06),
    sausage2: a(0xa85a3a, 0.08), friarielli: a(0x3a6a22, 0.1), provola: a(0xf0dca0, 0.05),
    tarallo: a(0xe8c88a, 0.06), taralloDark: a(0xc89a5a, 0.06), almond: a(0xc8a070, 0.05), pepperBlack: a(0x2a2622, 0.05),
    crumb: a(0xc8862e, 0.12), crumbDark: a(0x9a5a1e, 0.1), baba: a(0xc8822e, 0.08), babaDark: a(0x9a5a1c, 0.08), babaGloss: a(0xe0a040, 0.05),
    amarena: a(0x6a0e1a, 0.04), babaSyrup: a(0xb8701e, 0.04), colatura: a(0xe8c87a, 0.05),
    octopus: a(0xa8405a, 0.08), octopusLight: a(0xe8a8a0, 0.06), potatoHi: a(0xf2dc9a, 0.05), olive: a(0x3a3a1e, 0.05),
    ragu: a(0x8a2416, 0.06), meat: a(0x7a4028, 0.08), meatDark: a(0x5a2a18, 0.06),
    candied: a(0x6aa83a, 0.15), shortcrust: a(0xd89a4a, 0.08), shortcrustHi: a(0xe8b060, 0.06), pastieraTop: a(0xe8c87a, 0.06), wheat: a(0xd8b878, 0.06),
    risotto: a(0xf2e6b8, 0.04), risottoHi: a(0xfaf2d0, 0.03), leaf: a(0x2f6a26, 0.08), pastaEdge: a(0xe8cc88, 0.05),
    // Madeira
    mustard: a(0xd9a62a, 0.05), poncha: a(0xe8b84a, 0.04, 0.04), peanut: a(0xc8a070, 0.08), peanutDark: a(0x8a6038, 0.08),
    nikita: a(0xf4ecd0, 0.03), pineapple: a(0xf2d050, 0.06), passion: a(0xf2c23a, 0.06), passionSkin: a(0x5a2a4a, 0.08),
    seed: a(0x2a2018, 0.05), anona: a(0x8ab05a, 0.08), anonaDark: a(0x5a7a3a, 0.08), trunkLite: a(0x8a6a48, 0.06),
    brisaLabel: a(0xe8b030, 0.04), laurel: a(0x2a5a22, 0.08), tunaSear: a(0x6a3a2a, 0.08), tunaPink: a(0xd8707a, 0.06),
    porkWine: a(0x8a3a2a, 0.08), orange: a(0xe8822a, 0.05), orangeIn: a(0xf2a84a, 0.05), garlicW: a(0xf6f0de, 0.03),
    honeyCake: a(0x4a2414, 0.06), honeyTop: a(0x6a3418, 0.06), walnut: a(0x8a5a30, 0.08), wine: a(0x9a4a1a, 0.04, 0.05),
    wineLabel: a(0xefe6cc, 0.03), wineLabelInk: a(0x6a1a1a, 0.04), bottleDark: a(0x1e2a1a, 0.04), broa: a(0x9a5a2a, 0.08),
    milkCoffee: a(0xc89a6a, 0.04), coffeeDark: a(0x3a2010, 0.04), pumpkin: a(0xe0882a, 0.06), gaiado: a(0x8a8a84, 0.08),
    pudim: a(0xe8a83a, 0.05), banana: a(0xf2d65a, 0.05), limpet: a(0x6a6458, 0.1), limpetIn: a(0xe0b060, 0.06),
    // Istanbul's second menu
    lahmacun: a(0xa8442a, 0.08), salgam: a(0x4a1030, 0.04), beanW: a(0xf2ead6, 0.04), beanSauce: a(0xc0562a, 0.06), lentil: a(0xe0863a, 0.04),
    tahini: a(0xdcc496, 0.04), fava: a(0xe6d690, 0.04), sarma: a(0x3e5a24, 0.08), melon: a(0xf2b460, 0.04), melonRind: a(0x8ab05a, 0.06),
    rose: a(0xf09aac, 0.04), potSkin: a(0x9a6a3a, 0.08), kiwi: a(0x7ab040, 0.06), boza: a(0xe6d2a0, 0.03), chickpea: a(0xe0b45a, 0.06),
    honeycomb: a(0xe8a82a, 0.06, 0.05), gold: a(0xd8a83a, 0.03),
    // Tokyo's second menu
    shokupan: a(0xfaf2e0, 0.02), dashiDaikon: a(0xe8d2a0, 0.04), eggBrown: a(0xc8904a, 0.05), chikuwa: a(0xf0e0c0, 0.04), chikuwaBurnt: a(0xb8783a, 0.08),
    konnyaku: a(0x8a8478, 0.12), porkCut: a(0xf2dcc8, 0.04), porkFat: a(0xfaf0e6, 0.02), lacquer: a(0x1e1a1a, 0.03), eel: a(0x8a4a1c, 0.06), eelDark: a(0x5a2a10, 0.06),
    ketchupRice: a(0xd8502e, 0.08), beef: a(0xc86a72, 0.06), tofu: a(0xf6f2e4, 0.02), shiitake: a(0x6a4a30, 0.08), chawan: a(0xf2e2a0, 0.03),
    kanten: pal.add(0xe6f2e8, { glass: true }), kantenB: a(0xd8ecd8, 0.03), mikan: a(0xf2a030, 0.04), ice: a(0xf2f6fa, 0.03), matchaSyrup: a(0x7aa83a, 0.06),
    raku: a(0x4a3a34, 0.08), rakuB: a(0x7a5a44, 0.08), matchaTea: a(0x6a9a32, 0.04), matchaFoam: a(0x9cc45a, 0.04), nerikiri: a(0xf0a0b0, 0.03), mapleLeaf: a(0xd8502a, 0.05),
    warabi: a(0xc8b890, 0.03), kinako: a(0xd8b060, 0.05), salmonFish: a(0xf2804a, 0.04), salmonFat: a(0xf8c4a4, 0.03), taiFish: a(0xf6e6e2, 0.03), scallop: a(0xf2e8d4, 0.03),
    ageCoat: a(0xd8a050, 0.06), ageDark: a(0xb07830, 0.06), soy2: a(0x2a1a10, 0.03), udon: a(0xf4ecd2, 0.03), curry: a(0x9a5a1a, 0.05), miso2: a(0xb88a4a, 0.04),
  };
}

export type FoodId =
  | 'takoyaki' | 'monjayaki' | 'ningyoyaki' | 'dango' | 'taiyaki' | 'dorayaki'
  | 'yakitori' | 'karaage' | 'ramen' | 'gyoza' | 'nigiri' | 'tamagoyaki'
  | 'purin' | 'napolitan' | 'zarusoba' | 'tempura'
  | 'sfogliatella' | 'delizia' | 'cuoppo' | 'frittatina' | 'portafoglio' | 'montanara' | 'gelato' | 'granita'
  | 'limoncello' | 'caprese' | 'scialatielli' | 'totani'
  | 'simit' | 'pogaca' | 'balikekmek' | 'tursu' | 'midye' | 'kokorec' | 'kestane' | 'misir'
  | 'dondurma' | 'salep' | 'doner' | 'ayran' | 'baklava' | 'kunefe' | 'hunkar' | 'manti'
  | 'espresso' | 'cornetto' | 'ndunderi' | 'parmigiana' | 'vongole' | 'acquapazza' | 'margherita' | 'calzone'
  | 'bruschetta' | 'carrozza' | 'panuozzo' | 'taralli' | 'arancino' | 'crocche' | 'baba' | 'zeppola'
  | 'alici' | 'polpo' | 'sorrentina' | 'polpette' | 'melanzane' | 'pastiera' | 'risotto' | 'ravioli'
  | MadeiraFood | IstanbulFood | TokyoFood;

type FC = ReturnType<typeof foodColors>;

export function buildFood(id: FoodId, pal: Palette): Prop {
  const c = foodColors(pal);
  switch (id) {
    case 'takoyaki': return takoyaki(c);
    case 'monjayaki': return monjayaki(c);
    case 'ningyoyaki': return ningyoyaki(c);
    case 'dango': return dango(c);
    case 'taiyaki': return taiyaki(c);
    case 'dorayaki': return dorayaki(c);
    case 'yakitori': return yakitori(c);
    case 'karaage': return karaage(c);
    case 'ramen': return ramen(c);
    case 'gyoza': return gyoza(c);
    case 'nigiri': return nigiri(c);
    case 'tamagoyaki': return tamagoyaki(c);
    case 'purin': return purin(c);
    case 'napolitan': return napolitan(c);
    case 'zarusoba': return zarusoba(c);
    case 'tempura': return tempura(c);
    case 'sfogliatella': return sfogliatella(c);
    case 'delizia': return delizia(c);
    case 'cuoppo': return cuoppo(c);
    case 'frittatina': return frittatina(c);
    case 'portafoglio': return portafoglio(c);
    case 'montanara': return montanara(c);
    case 'gelato': return gelato(c);
    case 'granita': return granita(c);
    case 'limoncello': return limoncello(c);
    case 'caprese': return caprese(c);
    case 'scialatielli': return scialatielli(c);
    case 'totani': return totani(c);
    case 'simit': return simit(c);
    case 'pogaca': return pogaca(c);
    case 'balikekmek': return balikekmek(c);
    case 'tursu': return tursu(c);
    case 'midye': return midye(c);
    case 'kokorec': return kokorec(c);
    case 'kestane': return kestane(c);
    case 'misir': return misir(c);
    case 'dondurma': return dondurma(c);
    case 'salep': return salep(c);
    case 'doner': return doner(c);
    case 'ayran': return ayran(c);
    case 'baklava': return baklava(c);
    case 'kunefe': return kunefe(c);
    case 'hunkar': return hunkar(c);
    case 'manti': return manti(c);
    case 'espresso': return espresso(c);
    case 'cornetto': return cornetto(c);
    case 'ndunderi': return ndunderi(c);
    case 'parmigiana': return parmigiana(c);
    case 'vongole': return vongole(c);
    case 'acquapazza': return acquapazza(c);
    case 'margherita': return margherita(c);
    case 'calzone': return calzone(c);
    case 'bruschetta': return bruschetta(c);
    case 'carrozza': return carrozza(c);
    case 'panuozzo': return panuozzo(c);
    case 'taralli': return taralli(c);
    case 'arancino': return arancino(c);
    case 'crocche': return crocche(c);
    case 'baba': return baba(c);
    case 'zeppola': return zeppola(c);
    case 'alici': return alici(c);
    case 'polpo': return polpo(c);
    case 'sorrentina': return sorrentina(c);
    case 'polpette': return polpette(c);
    case 'melanzane': return melanzane(c);
    case 'pastiera': return pastiera(c);
    case 'risotto': return risotto(c);
    case 'ravioli': return ravioli(c);
    default: return buildTokyoFood(id as TokyoFood, c) ?? buildIstanbulFood(id as IstanbulFood, c) ?? buildMadeiraFood(id as MadeiraFood, c);
  }
}

const S = 1 / 40;

function takoyaki(c: FC): Prop {
  const p = new Prop(22, 12, 16, S);
  p.box(0, 0, 0, 21, 0, 15, c.tray);
  p.box(0, 1, 0, 21, 2, 0, c.trayDark); p.box(0, 1, 15, 21, 2, 15, c.trayDark);
  p.box(0, 1, 0, 0, 2, 15, c.trayDark); p.box(21, 1, 0, 21, 2, 15, c.trayDark);
  const r = rng(11);
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const cx = 4 + i * 7, cz = 4.5 + j * 7;
      p.ellipsoid(cx, 4.5, cz, 3.4, 3.2, 3.4, (_x, y) => (y >= 6 ? c.sauce : r() < 0.25 ? c.batterDark : c.batter));
    }
  // mayo zigzag
  for (let x = 1; x < 21; x++) {
    const z = 2 + Math.round(Math.abs(((x * 0.9) % 4) - 2) * 3);
    p.set(x, 8, z, c.mayo); p.set(x, 8, z + 6, c.mayo);
  }
  for (let k = 0; k < 40; k++) {
    const x = 1 + Math.floor(r() * 20), z = 1 + Math.floor(r() * 14);
    p.set(x, 8 + (r() < 0.5 ? 1 : 0), z, r() < 0.5 ? c.nori : c.bonito);
  }
  for (let k = 0; k < 9; k++) p.set(15 + k * 0.3, 8 + k, 10, c.pick);
  return p;
}

function monjayaki(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  p.cylY(12, 12, 11.5, 0, 0, c.steel);
  p.cylY(12, 12, 11.5, 1, 1, c.steel);
  p.cylY(12, 12, 10.5, 1, 1, 0);
  const r = rng(12);
  p.cylY(12, 12, 9.5, 1, 1, (x, _y, z) => {
    const d = Math.hypot(x - 12, z - 12);
    return d > 7.5 ? c.monjaCrisp : r() < 0.15 ? c.cabbage : r() < 0.08 ? c.mentaiko : r() < 0.06 ? c.cheese : c.monja;
  });
  for (let k = 0; k < 18; k++) p.set(5 + Math.floor(r() * 14), 2, 5 + Math.floor(r() * 14), r() < 0.5 ? c.cabbage : c.mentaiko);
  // little spatula (hera)
  p.box(14, 2, 3, 19, 2, 6, c.steelLight);
  p.box(19, 3, 4, 22, 5, 5, c.skewer);
  return p;
}

function ningyoyaki(c: FC): Prop {
  const p = new Prop(22, 12, 16, S);
  p.box(1, 0, 1, 20, 0, 14, c.paper);
  p.box(1, 1, 14, 20, 3, 14, c.paperRed);
  // pagoda
  p.box(3, 1, 4, 7, 3, 8, c.batter); p.box(4, 4, 5, 6, 5, 7, c.batter); p.box(2, 4, 3, 8, 4, 9, c.batterDark); p.box(5, 6, 6, 5, 7, 6, c.batterDark);
  // lantern
  p.ellipsoid(12, 3.5, 6, 2.6, 2.8, 2.6, c.batter); p.box(11, 6, 5, 13, 6, 7, c.batterDark); p.box(11, 1, 5, 13, 1, 7, c.batterDark);
  // bird
  p.ellipsoid(17.5, 2.5, 6, 2.6, 1.8, 2.2, c.batterLight); p.ellipsoid(18.5, 4.5, 6, 1.4, 1.4, 1.4, c.batterLight); p.set(20, 4, 6, c.batterDark);
  // row behind
  for (let i = 0; i < 3; i++) p.ellipsoid(5 + i * 6, 2.5, 11, 2.4, 2, 2, i === 1 ? c.batterLight : c.batter);
  return p;
}

function dango(c: FC): Prop {
  const p = new Prop(22, 9, 16, S);
  p.box(0, 0, 2, 21, 0, 13, c.plateBlue);
  p.box(0, 0, 2, 21, 0, 2, c.plateRim); p.box(0, 0, 13, 21, 0, 13, c.plateRim);
  for (const z of [5, 10]) {
    for (let x = 0; x < 22; x++) p.set(x, 4, z, c.skewer);
    for (let i = 0; i < 4; i++)
      p.ellipsoid(3 + i * 4.6, 4.5, z + 0.5, 2.3, 2.3, 2.3, (_x, y) => (y >= 5 ? (y >= 6 ? c.mitarashiGloss : c.mitarashi) : c.dango));
  }
  return p;
}

function taiyaki(c: FC): Prop {
  const p = new Prop(24, 8, 14, S);
  p.box(4, 0, 1, 19, 0, 12, c.paper);
  const body = (x: number, z: number) => {
    const t = (x - 2) / 18;
    if (t < 0 || t > 1) return false;
    const half = t < 0.75 ? 5.2 * Math.sin(Math.min(1, t / 0.75) * Math.PI * 0.95 + 0.15) : 2 + (t - 0.75) * 14;
    return Math.abs(z - 6.5) <= half;
  };
  for (let x = 0; x < 24; x++)
    for (let z = 0; z < 14; z++) {
      if (!body(x, z)) continue;
      const tail = x > 16;
      const h = tail ? 2 : 3 + (Math.abs(z - 6.5) < 3 ? 1 : 0);
      for (let y = 1; y <= h; y++) p.set(x, y, z, y === h && (x + z) % 3 === 0 ? c.batterDark : c.batter);
    }
  p.set(5, 5, 4, c.sauce); p.set(5, 5, 9, c.batterDark);
  for (let x = 8; x < 16; x += 2) for (let z = 3; z < 11; z += 3) p.set(x, 5, z, c.batterLight);
  p.set(3, 3, 6, c.bean); p.set(3, 3, 7, c.bean);
  return p;
}

function dorayaki(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.cylY(10, 10, 9, 0, 0, c.plate);
  p.cylY(10, 10, 8, 1, 2, c.batterLight);
  p.cylY(10, 10, 8, 3, 3, c.batterDark);
  p.cylY(10, 10, 7.5, 4, 4, c.bean);
  p.cylY(10, 10, 8, 5, 5, c.batterLight);
  p.cylY(10, 10, 7.5, 6, 6, c.batterDark);
  p.cylY(10, 10, 6.5, 7, 7, c.batter);
  p.cylY(10, 10, 4.5, 7, 7, c.batterDark);
  // cut half to show bean paste
  p.box(10, 1, 0, 19, 8, 19, 0);
  p.cylY(14, 10, 7.5, 0, 0, c.plate);
  p.box(14, 1, 3, 15, 3, 17, 0);
  for (let z = 4; z <= 16; z++) for (let y = 1; y <= 6; y++) if (p.get(9, y, z)) p.set(9, y, z, y === 4 ? c.bean : y > 4 ? c.batterLight : c.batterLight);
  return p;
}

function yakitori(c: FC): Prop {
  const p = new Prop(24, 8, 16, S);
  p.box(0, 0, 1, 23, 0, 14, c.plate);
  for (const z of [3, 7, 11]) {
    for (let x = 0; x < 24; x++) p.set(x, 3, z, c.skewer);
    for (let i = 0; i < 4; i++) {
      const x0 = 2 + i * 5;
      const isScallion = z === 7 && i % 2 === 1;
      p.box(x0, 2, z - 1, x0 + 3, 4, z + 1, isScallion ? c.scallionWhite : c.chicken);
      if (!isScallion) { p.box(x0, 5, z - 1, x0 + 3, 5, z + 1, c.chickenGlaze); p.set(x0 + 1, 5, z, c.chicken); }
      else p.box(x0, 5, z - 1, x0 + 3, 5, z + 1, c.scallion);
    }
  }
  return p;
}

function karaage(c: FC): Prop {
  const p = new Prop(20, 12, 20, S);
  p.cylY(10, 10, 9.5, 0, 0, c.plate);
  p.ellipsoid(6, 2, 13, 4, 1.4, 4, c.lettuce);
  const r = rng(14);
  const pts = [[8, 3, 8], [13, 3, 9], [10, 3, 13], [12, 6, 11], [7, 5, 11], [14, 3, 14]];
  for (const [x, y, z] of pts) p.ellipsoid(x, y, z, 3, 2.6, 2.8, () => (r() < 0.35 ? c.karaageDark : c.karaage));
  p.box(15, 1, 4, 17, 4, 5, c.lemon);
  return p;
}

function ramen(c: FC): Prop {
  const p = new Prop(22, 13, 22, S);
  for (let y = 0; y <= 8; y++) {
    const rr = 6.5 + y * 0.55;
    p.cylY(11, 11, rr, y, y, c.bowl);
  }
  p.cylY(11, 11, 4, 0, 0, c.bowlIn);
  p.cylY(11, 11, 10.2, 8, 8, c.bowlIn);
  p.cylY(11, 11, 9.6, 8, 8, (x, _y, z) => ((x + z) % 7 === 0 ? c.brothHi : c.broth));
  // noodles waves
  for (let x = 4; x < 18; x++) for (let z = 7; z < 15; z++) if ((x + Math.floor(z / 2)) % 3 === 0 && Math.hypot(x - 11, z - 11) < 8) p.set(x, 9, z, c.noodle);
  // chashu slices
  p.box(4, 9, 4, 9, 9, 8, c.chashu); p.box(4, 9, 4, 9, 9, 4, c.chashuEdge); p.box(4, 9, 4, 4, 9, 8, c.chashuEdge);
  // egg halves
  p.ellipsoid(14.5, 9.5, 6, 2.4, 1.2, 1.8, c.eggWhite); p.set(14, 10, 6, c.yolk); p.set(15, 10, 6, c.yolk);
  // nori standing
  p.box(16, 9, 12, 16, 13, 17, c.nori);
  // naruto
  p.cylY(10, 15, 1.8, 9, 9, c.naruto); p.set(10, 9, 15, c.narutoPink); p.set(9, 9, 14, c.narutoPink);
  // menma
  p.box(6, 9, 12, 7, 9, 15, c.menma);
  // scallions
  for (const [x, z] of [[11, 10], [12, 11], [10, 12], [13, 9], [12, 13]]) p.set(x, 10, z, c.scallion);
  return p;
}

function gyoza(c: FC): Prop {
  const p = new Prop(24, 7, 16, S);
  p.box(0, 0, 0, 23, 0, 15, c.plate);
  p.box(1, 1, 2, 22, 1, 13, c.wing);
  for (let i = 0; i < 5; i++) {
    const x0 = 2 + i * 4;
    p.box(x0, 2, 4, x0 + 2, 3, 11, c.gyoza);
    p.box(x0 + 1, 4, 5, x0 + 1, 4, 10, c.gyoza);
    p.box(x0, 1, 4, x0 + 2, 1, 11, c.gyozaBrown);
    for (let z = 5; z <= 10; z += 2) p.set(x0 + 1, 5, z, c.gyoza);
  }
  return p;
}

function nigiri(c: FC): Prop {
  const p = new Prop(28, 8, 14, S);
  p.box(0, 2, 1, 27, 2, 12, c.geta);
  p.box(2, 0, 2, 3, 1, 11, c.getaDark); p.box(24, 0, 2, 25, 1, 11, c.getaDark);
  const tops = [c.tuna, c.kohada, c.shrimp, c.tamago, c.ikura];
  for (let i = 0; i < 5; i++) {
    const x0 = 1 + i * 5;
    p.box(x0, 3, 4, x0 + 3, 4, 9, c.rice);
    const t = tops[i];
    if (i === 4) {
      p.box(x0, 3, 4, x0 + 3, 5, 9, c.nori);
      p.box(x0 + 1, 6, 5, x0 + 2, 6, 8, c.ikura);
    } else {
      p.box(x0, 5, 3, x0 + 3, 5, 10, t);
      if (i === 1) for (let z = 3; z <= 10; z += 2) p.set(x0 + 1, 5, z, c.kohadaDark);
      if (i === 2) for (let z = 4; z <= 10; z += 2) p.box(x0, 5, z, x0 + 3, 5, z, c.shrimpStripe);
      if (i === 3) p.box(x0 + 1, 6, 6, x0 + 2, 6, 7, c.nori);
    }
  }
  p.box(26, 3, 3, 27, 4, 4, c.wasabi);
  p.box(25, 3, 8, 27, 3, 10, c.ginger);
  return p;
}

function tamagoyaki(c: FC): Prop {
  const p = new Prop(22, 10, 16, S);
  p.box(0, 0, 1, 21, 0, 14, c.plateBlue);
  p.box(0, 0, 1, 21, 0, 1, c.plateRim); p.box(0, 0, 14, 21, 0, 14, c.plateRim);
  p.box(2, 1, 4, 14, 1, 11, c.shiso);
  for (let i = 0; i < 4; i++) {
    const x0 = 2 + i * 4;
    for (let y = 1; y <= 6; y++) for (let z = 5; z <= 10; z++) p.set(x0, y + 1, z, (y + z) % 3 === 0 ? c.tamagoDark : c.tamago);
    p.box(x0 + 1, 2, 5, x0 + 2, 7, 10, c.tamago);
    p.box(x0 + 1, 7, 5, x0 + 2, 7, 10, c.tamagoDark);
  }
  p.box(17, 1, 6, 20, 2, 9, c.plate);
  p.box(18, 3, 7, 19, 3, 8, c.ginger);
  return p;
}

function purin(c: FC): Prop {
  const p = new Prop(20, 16, 20, S);
  // footed glass dish
  p.cylY(10, 10, 3, 0, 0, c.glass);
  p.cylY(10, 10, 1.4, 1, 2, c.glass);
  p.cylY(10, 10, 9, 3, 3, c.glass);
  // the custard, a flat-topped cone with caramel running down
  for (let y = 4; y <= 11; y++) p.cylY(10, 10, 6.4 - (y - 4) * 0.35, y, y, (x, yy, z) => (yy >= 10 || (yy >= 8 && (x + z) % 3 === 0) ? c.caramel : c.custard));
  // whipped cream rosette and a cherry
  p.ellipsoid(10, 12.5, 10, 2.2, 1.4, 2.2, c.cream);
  p.ellipsoid(10, 14, 10, 1.2, 1.2, 1.2, c.cherry);
  p.set(10, 15, 11, c.shiso);
  p.ellipsoid(4.5, 4.5, 6, 1.6, 1, 1.6, c.cream);
  return p;
}

function napolitan(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  p.cylY(12, 12, 11.5, 0, 0, c.plate);
  p.cylY(12, 12, 10.5, 1, 1, c.plate);
  const r = rng(21);
  // a heap of ketchup-glazed spaghetti
  for (let y = 2; y <= 6; y++) p.cylY(12, 12, 8.2 - (y - 2) * 1.5, y, y, () => (r() < 0.3 ? c.pastaHi : c.pasta));
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = r() * 7;
    const x = Math.round(12 + Math.cos(a) * d), z = Math.round(12 + Math.sin(a) * d);
    let y = 7; while (y > 2 && !p.get(x, y - 1, z)) y--;
    p.set(x, y, z, k % 3 === 0 ? c.pepper : k % 3 === 1 ? c.sausage : c.onion);
  }
  for (let k = 0; k < 10; k++) p.set(9 + Math.floor(r() * 6), 7, 9 + Math.floor(r() * 6), c.parmesan);
  // fork
  p.box(19, 1, 6, 19, 1, 15, c.steelLight); p.box(18, 1, 15, 20, 1, 17, c.steelLight);
  return p;
}

function zarusoba(c: FC): Prop {
  const p = new Prop(28, 9, 20, S);
  // square bamboo zaru on a lacquer tray
  p.box(0, 0, 0, 27, 0, 19, c.bowl);
  p.box(1, 1, 1, 19, 2, 18, (x, y, z) => (y === 2 && x > 1 && x < 19 && z > 1 && z < 18 ? ((x + z) % 2 ? c.zaru : c.zaruDark) : c.zaruDark));
  const r = rng(23);
  for (let y = 3; y <= 6; y++)
    for (let z = 4; z <= 15; z++)
      for (let x = 4; x <= 16; x++) {
        const d = Math.hypot((x - 10) / 6.5, (z - 9.5) / 6, (y - 3) / 4);
        if (d < 1 && r() < 0.8) p.set(x, y, z, (x + y * 2) % 4 === 0 ? c.sobaHi : c.sobaN);
      }
  for (let k = 0; k < 14; k++) p.set(7 + Math.floor(r() * 7), 7, 7 + Math.floor(r() * 6), c.nori);
  // dipping cup with tsuyu, a little dish of negi and wasabi
  for (let y = 1; y <= 5; y++) p.cylY(23.5, 6, 3, y, y, c.choko);
  p.cylY(23.5, 6, 2.2, 5, 5, c.tsuyu);
  p.box(21, 1, 12, 26, 1, 17, c.plate);
  p.box(22, 2, 13, 23, 2, 15, c.negi); p.box(25, 2, 14, 25, 3, 15, c.wasabi);
  return p;
}

function tempura(c: FC): Prop {
  const p = new Prop(26, 10, 20, S);
  p.box(0, 0, 0, 25, 0, 19, c.getaDark);
  p.box(1, 1, 1, 24, 1, 18, c.paper);
  const r = rng(27);
  // two prawns with crisp batter, curled tails up
  for (const z0 of [5, 10]) {
    for (let x = 3; x <= 17; x++) {
      const rr = 2.2 - Math.abs(x - 10) * 0.06;
      p.ellipsoid(x, 3.4, z0 + 1.5, 0.9, rr, rr, () => (r() < 0.35 ? c.tempuraHi : c.tempura));
    }
    p.box(18, 3, z0 + 1, 19, 5, z0 + 2, c.tail); p.set(20, 6, z0 + 1, c.tail);
  }
  // shiso leaf and a sweet potato slice
  p.box(4, 2, 15, 10, 2, 17, c.shiso2);
  p.box(5, 3, 15, 9, 4, 16, c.tempura);
  // tentsuyu with grated daikon
  for (let y = 1; y <= 3; y++) p.cylY(21.5, 15, 2.6, y, y, c.choko);
  p.cylY(21.5, 15, 1.8, 3, 3, c.tsuyu);
  p.ellipsoid(21.5, 4, 15, 1.2, 0.8, 1.2, c.daikon);
  return p;
}

// ---------------------------------------------------------------------------------------------- Amalfi

/** A plate in the coast's hand-painted majolica: white with a blue and yellow rim. */
function majolica(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1.2 ? ((x + z) % 3 ? c.ceramicBlue : c.ceramicYellow) : c.ceramicWhite));
  p.cylY(cx, cz, r - 1.2, 1, 1, 0);
}

function sfogliatella(c: FC): Prop {
  const p = new Prop(22, 12, 20, S);
  p.box(1, 0, 1, 20, 0, 18, c.paper);
  // the shell: a fan of crisp layers, ridged, closing to a point at the back
  for (let z = 3; z <= 16; z++)
    for (let x = 3; x <= 18; x++) {
      const t = (x - 3) / 15;
      const half = 6.6 * Math.sin(Math.PI * (0.25 + t * 0.75)) ;
      if (Math.abs(z - 9.5) > half) continue;
      const h = 2 + Math.round((1 - Math.abs(z - 9.5) / Math.max(1, half)) * 5 * (0.4 + t * 0.6));
      for (let y = 1; y <= h; y++) p.set(x, y, z, x % 2 === 0 ? c.pastryDark : y === h ? c.pastryLight : c.pastry);
    }
  for (let k = 0; k < 30; k++) { const x = 5 + (k * 7) % 13, z = 5 + (k * 5) % 10; let y = 9; while (y > 1 && !p.get(x, y - 1, z)) y--; p.set(x, y, z, c.sugar); }
  return p;
}

function delizia(c: FC): Prop {
  const p = new Prop(22, 14, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a dome of lemon sponge soaked and glazed in lemon cream
  p.ellipsoid(11, 2, 11, 7, 9, 7, (_x, y) => (y > 2 ? c.lemonCream : c.sponge));
  for (let x = 4; x <= 18; x++) for (let z = 4; z <= 18; z++) if (!p.get(x, 2, z) && Math.hypot(x - 10.5, z - 10.5) < 7.2) p.set(x, 2, z, c.lemonCream);
  p.box(10, 11, 10, 12, 11, 12, c.cream);
  p.box(10, 12, 11, 12, 12, 11, c.lemonPeel);
  p.set(11, 12, 10, c.basil);
  return p;
}

function cuoppo(c: FC): Prop {
  const p = new Prop(16, 24, 16, S);
  // a cone of brown paper standing in a holder, brimming with fried squid rings, prawns and anchovies
  for (let y = 0; y < 16; y++) p.cylY(8, 8, 1.5 + y * 0.42, y, y, (x, yy, z) => ((x + z + yy) % 7 === 0 ? c.conePaperDark : c.conePaper));
  for (let y = 2; y < 16; y++) p.cylY(8, 8, 0.7 + y * 0.42, y, y, 0);
  const r = rng(51);
  for (let k = 0; k < 18; k++) {
    const a = r() * Math.PI * 2, d = r() * 4.5, y = 14 + r() * 5;
    const x = 8 + Math.cos(a) * d, z = 8 + Math.sin(a) * d;
    const kind = k % 3;
    if (kind === 0) for (let t = 0; t < 8; t++) { const aa = (t / 8) * Math.PI * 2; p.set(Math.round(x + Math.cos(aa) * 1.6), Math.round(y), Math.round(z + Math.sin(aa) * 1.6), r() < 0.4 ? c.fryDark : c.fry); }
    else if (kind === 1) p.ellipsoid(x, y, z, 1.6, 1.1, 1.1, () => (r() < 0.3 ? c.fryDark : c.fry));
    else { p.box(Math.round(x) - 2, Math.round(y), Math.round(z), Math.round(x) + 2, Math.round(y), Math.round(z), c.anchovy); }
  }
  p.box(11, 16, 6, 12, 19, 7, c.lemon);
  return p;
}

function frittatina(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.box(1, 0, 1, 18, 0, 18, c.paper);
  // a golden disc of fried bucatini and béchamel, broken open
  p.cylY(10, 10, 7.5, 1, 6, (x, y, z) => (y === 6 || Math.hypot(x + 0.5 - 10, z + 0.5 - 10) > 6.6 ? ((x + z) % 3 ? c.fry : c.fryDark) : c.batterLight));
  for (let x = 4; x <= 16; x++) for (let y = 2; y <= 5; y++) if ((x + y) % 2 === 0) p.set(x, y, 3, c.pastaHi);
  return p;
}

function portafoglio(c: FC): Prop {
  const p = new Prop(22, 12, 18, S);
  p.box(0, 0, 0, 21, 0, 17, c.paper);
  p.box(0, 1, 0, 21, 5, 0, c.paper);
  // the "wallet": a small pizza folded in four, tomato and mozzarella showing at the open edge
  for (let x = 3; x <= 18; x++) for (let z = 2; z <= 14; z++) {
    const h = Math.round(7 - Math.abs(z - 8) * 0.5);
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h ? (x % 5 === 0 ? c.crust : c.dough) : c.dough);
  }
  for (let x = 4; x <= 17; x++) { p.set(x, 4, 15, c.tomato); p.set(x, 5, 15, x % 3 ? c.mozzarella : c.tomato); p.set(x, 3, 15, c.crust); }
  p.box(9, 8, 7, 10, 8, 8, c.basil);
  return p;
}

function montanara(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  majolica(p, c, 11, 11, 10.5);
  p.cylY(11, 11, 8, 1, 3, (x, y, z) => (Math.hypot(x + 0.5 - 11, z + 0.5 - 11) > 7 || y < 3 ? c.fry : c.tomato));
  const r = rng(53);
  for (let k = 0; k < 16; k++) p.set(6 + Math.floor(r() * 10), 4, 6 + Math.floor(r() * 10), r() < 0.5 ? c.parmesan : c.mozzarella);
  p.box(10, 4, 10, 12, 4, 11, c.basil);
  return p;
}

function gelato(c: FC): Prop {
  const p = new Prop(14, 26, 14, S);
  // a waffle cone with lemon and pistachio
  for (let y = 0; y < 14; y++) p.cylY(7, 7, 0.8 + y * 0.36, y, y, (x, yy, z) => ((x + yy + z) % 3 === 0 ? c.waferDark : c.wafer));
  p.ellipsoid(7, 16, 7, 5, 3.6, 5, c.pistachio);
  p.ellipsoid(7, 20.5, 7, 4.4, 3.4, 4.4, c.lemonGelato);
  p.box(6, 24, 6, 7, 24, 7, c.lemonPeel);
  return p;
}

function granita(c: FC): Prop {
  const p = new Prop(14, 18, 14, S);
  for (let y = 0; y < 12; y++) p.cylY(7, 7, 4.2 + y * 0.18, y, y, c.glass);
  p.cylY(7, 7, 4, 1, 11, 0);
  const r = rng(54);
  for (let y = 1; y <= 13; y++) p.cylY(7, 7, y > 11 ? 5.5 - (y - 11) * 1.6 : 4, y, y, () => (r() < 0.25 ? c.lemonGelato : c.granita));
  p.box(9, 10, 6, 9, 17, 6, c.cherry);
  p.box(5, 14, 7, 6, 14, 7, c.lemonPeel);
  return p;
}

function limoncello(c: FC): Prop {
  const p = new Prop(20, 14, 16, S);
  majolica(p, c, 10, 8, 7.5);
  // a frosted little glass and the bottle beside it
  p.cylY(7, 8, 2.2, 1, 6, c.glass);
  p.cylY(7, 8, 1.6, 2, 6, c.limoncello);
  p.cylY(15, 8, 2.8, 0, 8, (_x, y) => (y >= 3 && y <= 5 ? c.ceramicYellow : c.limoncello));
  p.cylY(15, 8, 1.2, 9, 12, c.glass);
  p.box(14, 13, 7, 15, 13, 8, c.geta);
  p.box(10, 1, 12, 12, 2, 14, c.lemon);
  return p;
}

function caprese(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a wedge of flourless chocolate and almond cake under icing sugar
  for (let x = 4; x <= 18; x++) for (let z = 5; z <= 16; z++) {
    if (Math.abs(z - 10.5) > (x - 3) * 0.42) continue;
    for (let y = 1; y <= 6; y++) p.set(x, y, z, y === 6 ? c.sugar : y === 1 ? c.chocolateDark : c.chocolate);
  }
  p.ellipsoid(6, 2.5, 15, 2.2, 1.4, 2.2, c.cream);
  return p;
}

function scialatielli(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  majolica(p, c, 13, 13, 12.5);
  const r = rng(55);
  // thick short ribbons of fresh pasta tossed with clams, mussels and cherry tomatoes
  for (let y = 2; y <= 6; y++) p.cylY(13, 13, 9 - (y - 2) * 1.5, y, y, () => (r() < 0.35 ? c.scialatielliHi : c.scialatielli));
  for (let k = 0; k < 9; k++) {
    const a = r() * Math.PI * 2, d = 3 + r() * 6;
    const x = Math.round(13 + Math.cos(a) * d), z = Math.round(13 + Math.sin(a) * d);
    let y = 8; while (y > 2 && !p.get(x, y - 1, z)) y--;
    if (k % 3 === 0) { p.box(x, y, z, x + 2, y, z + 1, c.mussel); p.set(x + 1, y, z, c.musselIn); }
    else if (k % 3 === 1) p.box(x, y, z, x + 1, y, z + 1, c.clam);
    else p.ellipsoid(x, y + 0.5, z, 1.2, 1.2, 1.2, c.tomato);
  }
  for (let k = 0; k < 14; k++) p.set(8 + Math.floor(r() * 10), 7, 8 + Math.floor(r() * 10), c.parsley);
  return p;
}

function totani(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  // a deep bowl of squid rings and potatoes stewed with tomato and parsley
  for (let y = 0; y <= 6; y++) p.cylY(12, 12, 7 + y * 0.7, y, y, c.ceramicYellow);
  p.cylY(12, 12, 10.5, 1, 6, 0);
  p.cylY(12, 12, 10, 1, 4, c.tomato);
  const r = rng(56);
  for (let k = 0; k < 16; k++) {
    const a = r() * Math.PI * 2, d = r() * 7.5;
    const x = 12 + Math.cos(a) * d, z = 12 + Math.sin(a) * d;
    if (k % 2) p.ellipsoid(x, 5, z, 1.4, 1.2, 1.4, c.potato);
    else for (let t = 0; t < 8; t++) { const aa = (t / 8) * Math.PI * 2; p.set(Math.round(x + Math.cos(aa) * 1.6), 5, Math.round(z + Math.sin(aa) * 1.6), c.squid); }
  }
  for (let k = 0; k < 10; k++) p.set(7 + Math.floor(r() * 10), 6, 7 + Math.floor(r() * 10), c.parsley);
  return p;
}

// ---------------------------------------------------------------------------------------------- Istanbul

/** A plate with an İznik rim: white, a ring of blue with red tulip dots. */
function iznikPlate(p: Prop, c: FC, cx: number, cz: number, r: number): void {
  p.cylY(cx, cz, r, 0, 0, c.ceramicWhite);
  p.cylY(cx, cz, r, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - cx, z + 0.5 - cz) > r - 1.2 ? ((x * 3 + z) % 5 ? c.iznik : c.iznikRed) : 0));
}

/** A ring in the xz plane: a torus of radius R and tube r, lying on y0. */
function ring(p: Prop, cx: number, cz: number, R: number, r: number, y0: number, col: (x: number, y: number, z: number) => number): void {
  for (let y = 0; y <= Math.ceil(r * 2); y++) for (let z = 0; z < p.grid.sz; z++) for (let x = 0; x < p.grid.sx; x++) {
    const d = Math.hypot(x + 0.5 - cx, z + 0.5 - cz) - R, dy = y + 0.5 - r;
    if (d * d + dy * dy <= r * r) p.set(x, y0 + y, z, col(x, y0 + y, z));
  }
}

function simit(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  // a ring of twisted dough dipped in grape molasses and rolled in sesame
  ring(p, 11, 11, 6.4, 2.6, 1, (x, y, z) => (y >= 4 && (x * 5 + z * 3) % 4 === 0 ? c.sesame : (Math.atan2(z - 11, x - 11) * 6 + y) % 2 < 1 ? c.simitDark : c.simit));
  return p;
}

function pogaca(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  p.box(1, 0, 1, 20, 0, 20, c.paper);
  for (const [x, z] of [[7, 8], [15, 8], [11, 15]] as const) {
    p.ellipsoid(x, 1.5, z, 4.2, 4, 4.2, (_x, y) => (y >= 4 ? c.bread : c.breadIn));
    p.box(x - 1, 5, z - 1, x, 5, z, c.sesame);
  }
  return p;
}

function balikekmek(c: FC): Prop {
  const p = new Prop(26, 12, 14, S);
  p.box(0, 0, 0, 25, 0, 13, c.paper);
  // half a loaf split open: a grilled mackerel fillet, lettuce, red onion
  for (let x = 2; x <= 23; x++) for (let z = 2; z <= 11; z++) {
    const e = Math.abs(z - 6.5) / 5;
    if (e > 1) continue;
    const h = Math.round(4 * Math.sqrt(1 - e * e));
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h || x === 2 || x === 23 ? c.bread : c.breadIn);
  }
  p.box(3, 5, 4, 22, 5, 9, c.lettuce);
  p.box(4, 6, 4, 21, 7, 9, (x, y) => (y === 7 && x % 3 === 0 ? c.chashuEdge : y === 7 ? c.mackerelBack : c.mackerel));
  for (let x = 5; x <= 20; x += 3) p.set(x, 8, 6 + (x % 2), c.redOnion);
  for (let x = 2; x <= 23; x++) for (let z = 3; z <= 10; z++) { const e = Math.abs(z - 6.5) / 4.5; if (e <= 1) p.set(x, 9 + Math.round(1.5 * Math.sqrt(1 - e * e)), z, c.bread); }
  p.box(22, 6, 10, 24, 7, 12, c.lemon);
  return p;
}

function tursu(c: FC): Prop {
  const p = new Prop(16, 18, 14, S);
  // a glass of pink pickle juice and a dish of pickles: cucumber, carrot, cabbage, hot pepper
  p.cylY(5, 7, 3.2, 0, 12, c.glass);
  p.cylY(5, 7, 2.5, 1, 11, c.pickleJuice);
  p.cylY(5, 7, 2.5, 12, 12, 0);
  p.cylY(12, 7, 3.6, 0, 1, c.plate);
  p.box(10, 2, 5, 11, 3, 9, c.gherkin); p.box(13, 2, 6, 14, 2, 8, c.carrot); p.box(12, 3, 7, 13, 3, 9, c.cabbage); p.box(11, 4, 6, 11, 6, 6, c.pepper);
  return p;
}

function midye(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  p.cylY(11, 11, 10, 0, 0, c.plate);
  // stuffed mussels on the half shell, spiced rice inside, with lemon wedges
  const r = rng(71);
  for (let k = 0; k < 7; k++) {
    const a = (k / 7) * Math.PI * 2, x = 11 + Math.cos(a) * 5.6, z = 11 + Math.sin(a) * 5.6;
    p.ellipsoid(x, 1.2, z, 2.2, 1.2, 3.2, c.mussel);
    p.ellipsoid(x, 2.2, z, 1.6, 1, 2.4, () => (r() < 0.2 ? c.musselIn : r() < 0.15 ? c.cinnamon : c.rice));
  }
  p.box(10, 1, 10, 12, 2, 12, c.lemon);
  return p;
}

function kokorec(c: FC): Prop {
  const p = new Prop(24, 12, 14, S);
  p.box(0, 0, 0, 23, 0, 13, c.paper);
  // chopped grilled lamb intestines with tomato, oregano and chilli in half a loaf
  for (let x = 2; x <= 21; x++) for (let z = 2; z <= 11; z++) {
    const e = Math.abs(z - 6.5) / 5;
    if (e > 1) continue;
    const h = Math.round(4 * Math.sqrt(1 - e * e));
    for (let y = 1; y <= h; y++) p.set(x, y, z, y === h || x === 2 || x === 21 ? c.bread : c.breadIn);
  }
  const r = rng(72);
  for (let x = 3; x <= 20; x++) for (let z = 4; z <= 9; z++) { p.set(x, 5, z, r() < 0.5 ? c.offal : c.offalHi); if (r() < 0.6) p.set(x, 6, z, r() < 0.2 ? c.tomato : r() < 0.2 ? c.chiliFlake : r() < 0.5 ? c.offal : c.offalHi); }
  return p;
}

function kestane(c: FC): Prop {
  const p = new Prop(16, 18, 14, S);
  // a paper bag of roast chestnuts, some split open
  p.box(1, 0, 1, 14, 10, 12, c.paper);
  p.box(2, 1, 2, 13, 10, 11, 0);
  p.box(1, 7, 1, 14, 7, 1, c.paperRed);
  const r = rng(73);
  for (let k = 0; k < 9; k++) {
    const x = 4 + (k % 3) * 3.5, z = 4 + Math.floor(k / 3) * 3, y = 9 + r() * 4;
    p.ellipsoid(x, y, z, 1.8, 1.4, 1.6, c.chestnut);
    if (k % 2 === 0) p.box(Math.round(x), Math.round(y + 1), Math.round(z), Math.round(x), Math.round(y + 1), Math.round(z) + 1, c.chestnutIn);
  }
  return p;
}

function misir(c: FC): Prop {
  const p = new Prop(10, 10, 28, S);
  // a cob of grilled corn in its peeled-back husk, salted
  for (let z = 4; z <= 25; z++) {
    const rr = 3.4 * Math.sin(Math.PI * (z - 2) / 26);
    for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
      const d = Math.hypot(x + 0.5 - 5, y + 0.5 - 5);
      if (d <= rr) p.set(x, y, z, (x + y * 2 + z) % 5 === 0 ? c.cornDark : c.corn);
    }
  }
  for (let z = 0; z <= 5; z++) { p.box(3, 1, z, 6, 2, z, c.husk); p.box(1, 4, z, 2, 6, z, c.husk); p.box(7, 4, z, 8, 6, z, c.husk); }
  return p;
}

function dondurma(c: FC): Prop {
  const p = new Prop(14, 30, 14, S);
  // a cone of stretchy Maraş ice cream, beaten so long it stands up tall
  for (let y = 0; y < 13; y++) p.cylY(7, 7, 0.8 + y * 0.36, y, y, (x, yy, z) => ((x + yy + z) % 3 === 0 ? c.waferDark : c.wafer));
  p.cylY(7, 7, 5, 13, 22, (_x, y) => (y > 20 ? c.dondurma : c.dondurma));
  p.ellipsoid(7, 23, 7, 4.4, 3, 4.4, c.dondurma);
  p.box(6, 25, 6, 8, 26, 8, c.antep);
  return p;
}

function salep(c: FC): Prop {
  const p = new Prop(18, 14, 14, S);
  p.cylY(9, 7, 6.5, 0, 0, c.plate);
  // a cup of hot orchid-root milk, thick as custard, dusted with cinnamon
  p.cylY(9, 7, 4, 1, 9, c.ceramicWhite);
  p.cylY(9, 7, 3.2, 3, 9, c.salep);
  p.box(8, 9, 6, 10, 9, 8, c.cinnamon); p.set(7, 9, 7, c.cinnamon); p.set(11, 9, 6, c.cinnamon);
  p.box(13, 4, 7, 14, 4, 7, c.ceramicWhite); p.box(14, 5, 7, 14, 7, 7, c.ceramicWhite); p.box(13, 8, 7, 14, 8, 7, c.ceramicWhite);
  return p;
}

function doner(c: FC): Prop {
  const p = new Prop(26, 10, 16, S);
  p.box(0, 0, 0, 25, 0, 15, c.paper);
  // a dürüm: lavash rolled round shaved döner, tomato, onion and parsley, open at one end
  for (let x = 3; x <= 22; x++) for (let y = 1; y <= 8; y++) for (let z = 3; z <= 12; z++) {
    const d = Math.hypot(y - 4.5, z - 7.5);
    if (d > 4.4) continue;
    p.set(x, y, z, d > 3.4 ? c.lavash : x > 19 ? ((y + z) % 3 === 0 ? c.tomato : (y + z) % 3 === 1 ? c.parsley : c.donerHi) : c.doner);
  }
  for (let x = 3; x <= 12; x++) for (let y = 1; y <= 8; y++) for (let z = 3; z <= 12; z++) if (Math.hypot(y - 4.5, z - 7.5) <= 4.6 && Math.hypot(y - 4.5, z - 7.5) > 3.6) p.set(x, y, z, c.paper);
  return p;
}

function ayran(c: FC): Prop {
  const p = new Prop(14, 16, 14, S);
  // a hammered copper cup of ayran with its froth standing up
  p.cylY(7, 7, 4.4, 0, 11, (x, y, z) => ((x + y + z) % 4 === 0 ? c.copperDark : c.copper));
  p.cylY(7, 7, 3.6, 1, 11, c.ayran);
  p.ellipsoid(7, 11.5, 7, 3.6, 2, 3.6, c.ayran);
  p.box(11, 4, 6, 12, 4, 8, c.copperDark); p.box(12, 5, 6, 12, 8, 8, c.copperDark); p.box(11, 9, 6, 12, 9, 8, c.copperDark);
  return p;
}

function baklava(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  iznikPlate(p, c, 11, 11, 10.5);
  // diamonds of paper-thin layers glossy with syrup, crowned with ground pistachio
  for (const [x0, z0] of [[5, 5], [12, 5], [5, 12], [12, 12]] as const)
    for (let x = 0; x < 6; x++) for (let z = 0; z < 6; z++) {
      if (Math.abs(x - 2.5) + Math.abs(z - 2.5) > 3.6) continue;
      for (let y = 1; y <= 4; y++) p.set(x0 + x, y, z0 + z, y === 4 ? (Math.abs(x - 2.5) + Math.abs(z - 2.5) < 1.6 ? c.antep : c.baklavaHi) : y % 2 ? c.baklava : c.antep);
    }
  return p;
}

function kunefe(c: FC): Prop {
  const p = new Prop(22, 8, 22, S);
  // a copper pan: shredded kadayıf baked crisp round a layer of melting cheese, soaked in syrup, pistachio on top
  p.cylY(11, 11, 10, 0, 2, c.copper);
  p.cylY(11, 11, 9, 1, 2, 0);
  p.cylY(11, 11, 8.6, 1, 4, (x, y, z) => (y === 2 && Math.hypot(x + 0.5 - 11, z + 0.5 - 11) < 7 ? c.cheese : (x + z + y) % 3 ? c.kadayif : c.kadayifHi));
  p.cylY(11, 11, 3, 5, 5, c.antep);
  for (let k = 0; k < 10; k++) p.set(6 + (k * 7) % 11, 5, 6 + (k * 3) % 11, c.syrup);
  return p;
}

function hunkar(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  iznikPlate(p, c, 12, 12, 11.5);
  // the sultan's delight: a bed of smoky aubergine and cheese béchamel under a slow-cooked lamb stew
  p.cylY(12, 12, 9, 1, 2, c.begendi);
  for (let k = 0; k < 9; k++) {
    const a = (k / 9) * Math.PI * 2, d = k % 3 === 0 ? 0 : 3.4;
    p.ellipsoid(12 + Math.cos(a) * d, 3.5, 12 + Math.sin(a) * d, 1.8, 1.4, 1.8, c.lambStew);
  }
  p.cylY(12, 12, 4.6, 3, 3, (x, _y, z) => (p.get(x, 3, z) ? c.lambStew : c.stewSauce));
  p.box(11, 5, 11, 12, 5, 12, c.parsley);
  return p;
}

function manti(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  // a deep plate of tiny lamb dumplings under garlic yoghurt and red pepper butter, dried mint
  for (let y = 0; y <= 3; y++) p.cylY(11, 11, 7.5 + y * 0.9, y, y, c.ceramicWhite);
  p.cylY(11, 11, 9.6, 1, 3, 0);
  const r = rng(74);
  for (let k = 0; k < 26; k++) { const a = r() * Math.PI * 2, d = r() * 7; p.box(Math.round(11 + Math.cos(a) * d), 1, Math.round(11 + Math.sin(a) * d), Math.round(11 + Math.cos(a) * d) + 1, 2, Math.round(11 + Math.sin(a) * d), c.manti); }
  p.cylY(11, 11, 5.5, 3, 3, c.yoghurt);
  for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = r() * 6; p.set(Math.round(11 + Math.cos(a) * d), 4, Math.round(11 + Math.sin(a) * d), k % 3 === 0 ? c.mint : c.redButter); }
  return p;
}

// ---------------------------------------------------------------------------------------------- Amalfi's restaurants

/** A shallow terracotta oven dish, `w` by `d`, walls `h` high, hollow inside. */
function terracotta(p: Prop, c: FC, x0: number, z0: number, w: number, d: number, h: number): void {
  p.box(x0, 0, z0, x0 + w - 1, h, z0 + d - 1, (x, y, z) => (y === h && (x + z) % 2 ? c.terracottaDark : c.terracotta));
  p.box(x0 + 1, 1, z0 + 1, x0 + w - 2, h, z0 + d - 2, 0);
}

/** Scatter `n` voxels of `col` on top of whatever is in the box. */
function sprinkleOn(p: Prop, x0: number, z0: number, x1: number, z1: number, n: number, col: number, seed: number, minY = 1): void {
  const r = rng(seed);
  for (let k = 0; k < n; k++) {
    const x = x0 + Math.floor(r() * (x1 - x0 + 1)), z = z0 + Math.floor(r() * (z1 - z0 + 1));
    let y = p.sy - 1; while (y > 0 && !p.get(x, y - 1, z)) y--;
    if (y >= minY) p.set(x, y, z, col);
  }
}

function espresso(c: FC): Prop {
  const p = new Prop(20, 12, 16, S);
  // saucer, the little thick cup with its crema, a spoon and the glass of water that always comes with it
  p.cylY(7, 8, 5.6, 0, 0, c.plate);
  p.cylY(7, 8, 5.6, 1, 1, (x, _y, z) => (Math.hypot(x + 0.5 - 7, z + 0.5 - 8) > 4.6 ? c.plate : 0));
  p.cylY(7, 8, 3.2, 1, 6, c.plate);
  p.cylY(7, 8, 2.3, 3, 6, 0);
  p.cylY(7, 8, 2.3, 5, 5, (x, _y, z) => ((x * 3 + z) % 5 === 0 ? c.espresso : c.crema));
  p.box(10, 3, 8, 11, 3, 8, c.plate); p.box(11, 4, 8, 11, 5, 8, c.plate); p.box(10, 6, 8, 11, 6, 8, c.plate);
  p.box(1, 1, 13, 8, 1, 13, c.steelLight); p.box(1, 1, 12, 2, 1, 14, c.steelLight);
  p.cylY(16, 5, 2.4, 0, 9, c.glass); p.cylY(16, 5, 1.7, 1, 9, 0); p.cylY(16, 5, 1.7, 1, 6, c.water);
  p.box(12, 0, 11, 15, 0, 14, c.sugarPack);
  return p;
}

function cornetto(c: FC): Prop {
  const p = new Prop(22, 9, 18, S);
  p.box(1, 0, 1, 20, 0, 16, c.paper);
  // a crescent of laminated pastry, fat in the middle and tapering at the horns, glazed and sugared
  for (let t = 0; t <= 1.0001; t += 0.04) {
    const a = Math.PI * (0.12 + 0.76 * t), x = 11 + Math.cos(a) * 7, z = 4 + Math.sin(a) * 7.5;
    const r = 1.2 + 2.9 * Math.sin(Math.PI * t);
    p.ellipsoid(x, r + 0.6, z, r, r * 0.85, r, (xx, yy, zz) => ((xx + zz + Math.round(t * 9)) % 4 === 0 ? c.pastryDark : yy >= r * 1.4 ? c.pastryLight : c.pastry));
  }
  sprinkleOn(p, 4, 6, 18, 14, 26, c.sugar, 71, 3);
  return p;
}

function ndunderi(c: FC): Prop {
  const p = new Prop(24, 9, 24, S);
  majolica(p, c, 12, 12, 11.5);
  // Minori's ricotta dumplings in a light tomato sauce, basil and a snow of grated cheese
  p.cylY(12, 12, 8.5, 1, 1, c.tomato);
  const r = rng(72);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
    const x = 6.5 + i * 3.6 + (r() - 0.5), z = 6.5 + j * 3.6 + (r() - 0.5);
    if (Math.hypot(x - 12, z - 12) > 8) continue;
    p.ellipsoid(x, 2.6, z, 1.7, 1.3, 1.4, (_x, y) => (y >= 3 ? c.ricotta : c.dough));
  }
  sprinkleOn(p, 6, 6, 18, 18, 22, c.parmesan, 73, 2);
  p.box(11, 4, 11, 13, 4, 12, c.basil); p.set(12, 4, 13, c.basil);
  return p;
}

function parmigiana(c: FC): Prop {
  const p = new Prop(24, 10, 20, S);
  terracotta(p, c, 0, 0, 24, 20, 6);
  // layers of fried aubergine, tomato and mozzarella; a corner already served shows them
  for (let x = 1; x <= 22; x++) for (let z = 1; z <= 18; z++) {
    if (x > 14 && z > 10) continue;
    for (let y = 1; y <= 7; y++) p.set(x, y, z, y === 7 ? ((x * 5 + z * 3) % 7 < 2 ? c.cheeseBrown : c.mozzarella) : y % 2 ? c.aubergine : y === 4 ? c.mozzarella : c.tomato);
  }
  for (let x = 15; x <= 22; x++) for (let z = 11; z <= 18; z++) p.set(x, 1, z, c.tomato);
  sprinkleOn(p, 2, 2, 13, 17, 10, c.basil, 74, 8);
  return p;
}

function vongole(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  p.cylY(13, 13, 12.5, 0, 1, c.ceramicWhite);
  p.cylY(13, 13, 11.3, 1, 1, 0);
  const r = rng(75);
  // spaghetti in a nest of fine strands, glossy with oil, and the clams opened among them
  for (let y = 1; y <= 5; y++) p.cylY(13, 13, 9 - (y - 1) * 1.6, y, y, (x, yy, z) => ((x + z * 2 + yy) % 3 === 0 ? c.spaghettiHi : c.spaghetti));
  for (let k = 0; k < 13; k++) {
    const a = r() * Math.PI * 2, d = 2.5 + r() * 6.5;
    const x = Math.round(13 + Math.cos(a) * d), z = Math.round(13 + Math.sin(a) * d);
    let y = 8; while (y > 1 && !p.get(x, y - 1, z)) y--;
    p.box(x, y, z, x + 1, y, z + 1, c.clam); p.set(x + 1, y + 1, z, c.clamDark); p.set(x, y, z, c.musselIn);
  }
  sprinkleOn(p, 6, 6, 20, 20, 18, c.parsley, 76, 2);
  sprinkleOn(p, 8, 8, 18, 18, 5, c.chili, 77, 2);
  return p;
}

function acquapazza(c: FC): Prop {
  const p = new Prop(28, 10, 20, S);
  // a wide shallow bowl of "crazy water": a whole sea bream poached with cherry tomatoes, garlic and parsley
  p.cylY(14, 10, 9.6, 0, 0, c.ceramicBlue);
  for (let y = 1; y <= 3; y++) p.box(2, y, 1, 25, y, 18, (x, _y, z) => (x === 2 || x === 25 || z === 1 || z === 18 ? c.ceramicBlue : 0));
  p.box(3, 1, 2, 24, 2, 17, c.broth2);
  for (let x = 6; x <= 20; x++) {
    const t = (x - 6) / 14, rr = 3.2 * Math.sin(Math.PI * (0.15 + t * 0.85)) + 0.4;
    p.ellipsoid(x, 3, 9.5, 0.7, rr * 0.8, rr, (_x, y, z) => (y >= 4 ? c.fishBack : Math.abs(z + 0.5 - 9.5) > rr - 1 ? c.fishSkin : c.fishSkin2));
  }
  p.box(21, 2, 7, 22, 5, 12, c.fishBack); p.box(23, 3, 6, 23, 6, 13, c.fishBack);
  p.set(8, 4, 8, c.chocolateDark);
  for (const [x, z] of [[5, 4], [9, 15], [16, 3], [19, 15], [24, 10], [12, 4]]) p.ellipsoid(x, 3, z, 1.3, 1.3, 1.3, c.tomato);
  sprinkleOn(p, 4, 3, 23, 16, 20, c.parsley, 78, 3);
  for (const [x, z] of [[7, 13], [15, 14], [22, 5]]) p.set(x, 3, z, c.onion);
  return p;
}

function margherita(c: FC): Prop {
  const p = new Prop(28, 7, 28, S);
  p.cylY(14, 14, 13.6, 0, 0, c.plateCream);
  // a soft Neapolitan pie: a puffed, leopard-spotted rim, tomato, torn fior di latte, basil, oil
  p.cylY(14, 14, 12, 1, 1, c.dough);
  p.cylY(14, 14, 12, 2, 3, (x, y, z) => {
    const d = Math.hypot(x + 0.5 - 14, z + 0.5 - 14);
    return d > 10 ? ((x * 7 + z * 3 + y) % 9 === 0 ? c.char : y === 3 && d < 11.2 ? c.crustHi : c.crust) : y === 2 ? c.tomato : 0;
  });
  for (const [x, z] of [[9, 10], [17, 9], [14, 15], [8, 17], [19, 18], [13, 20], [20, 13]]) p.ellipsoid(x, 3, z, 1.8, 0.9, 1.6, c.mozzarella);
  for (const [x, z] of [[12, 12], [16, 17], [10, 19], [18, 10]]) { p.box(x, 3, z, x + 1, 3, z, c.basil); p.set(x, 3, z + 1, c.basil); }
  sprinkleOn(p, 6, 6, 22, 22, 8, c.oil, 79, 3);
  return p;
}

function calzone(c: FC): Prop {
  const p = new Prop(26, 11, 20, S);
  p.cylY(13, 10, 9.6, 0, 0, c.plateCream);
  // a half moon puffed in the oven, crimped edge, a spoon of tomato on top
  for (let x = 3; x <= 22; x++) for (let z = 3; z <= 17; z++) {
    const u = (x - 12.5) / 10, v = (z - 3) / 14;
    if (u * u + v * v > 1) continue;
    const h = Math.round(1 + 6 * Math.sqrt(Math.max(0, 1 - u * u - v * v)) * Math.min(1, v * 4));
    for (let y = 1; y <= h; y++) p.set(x, y, z, z === 3 ? ((x % 2) ? c.crust : c.crustHi) : y === h ? ((x * 3 + z * 5) % 11 === 0 ? c.char : c.crust) : c.dough);
  }
  p.ellipsoid(12.5, 7, 9, 3.2, 0.8, 2.4, c.tomato);
  p.box(12, 8, 9, 13, 8, 9, c.basil);
  sprinkleOn(p, 8, 6, 17, 12, 6, c.parmesan, 80, 7);
  return p;
}

function bruschetta(c: FC): Prop {
  const p = new Prop(26, 9, 16, S);
  p.box(0, 0, 0, 25, 1, 15, (x, y) => (y === 1 && x % 6 === 0 ? c.boardDark : c.board));
  // three slices of grilled country bread under chopped tomato, garlic, basil and green oil
  for (const x0 of [1, 9, 17]) {
    p.box(x0, 2, 3, x0 + 6, 3, 12, (x, y, z) => (y === 2 || x === x0 || x === x0 + 6 || z === 3 || z === 12 ? c.breadCrust : (x + z) % 4 === 0 ? c.grill : c.loaf));
    const r = rng(81 + x0);
    for (let k = 0; k < 16; k++) p.set(x0 + 1 + Math.floor(r() * 5), 4, 4 + Math.floor(r() * 8), r() < 0.75 ? c.tomato : c.tomatoHi);
    p.set(x0 + 3, 5, 7, c.basil); p.set(x0 + 2, 5, 8, c.basil);
  }
  sprinkleOn(p, 1, 3, 24, 12, 8, c.oil, 84, 4);
  return p;
}

function carrozza(c: FC): Prop {
  const p = new Prop(24, 9, 18, S);
  p.box(1, 0, 1, 22, 0, 16, c.paper);
  // two fried triangles of bread and mozzarella, the cheese stretching out of the cut
  for (const [x0, flip] of [[2, false], [12, true]] as [number, boolean][]) {
    for (let x = 0; x < 10; x++) for (let z = 0; z < 13; z++) {
      if ((flip ? 9 - x : x) * 1.3 > z) continue;
      for (let y = 1; y <= 5; y++) p.set(x0 + x, y, 2 + z, y === 3 ? c.mozzarella : (x + z + y) % 5 === 0 ? c.fryDark : c.fry);
    }
  }
  p.box(11, 2, 6, 12, 3, 11, c.mozzarella); p.box(10, 3, 8, 13, 3, 9, c.mozzarella);
  p.box(18, 1, 13, 21, 2, 15, c.lemon);
  return p;
}

function panuozzo(c: FC): Prop {
  const p = new Prop(28, 11, 16, S);
  p.box(1, 0, 2, 26, 0, 13, c.paper);
  // pizza dough baked as a long loaf, split and stuffed with sausage, friarielli greens and smoked provola
  for (const [x0, x1] of [[2, 12], [15, 25]]) {
    p.box(x0, 1, 4, x1, 2, 11, c.crust);
    p.box(x0, 3, 4, x1, 3, 11, (x, _y, z) => ((x + z) % 3 === 0 ? c.sausage2 : (x + z) % 3 === 1 ? c.friarielli : c.provola));
    p.box(x0, 4, 4, x1, 4, 11, (x, _y, z) => ((x * 2 + z) % 4 === 0 ? c.friarielli : c.provola));
    for (let x = x0; x <= x1; x++) for (let z = 4; z <= 11; z++) {
      const h = 5 + Math.round(2.2 * Math.sin(Math.PI * (z - 3.5) / 8.5));
      for (let y = 5; y <= h; y++) p.set(x, y, z, y === h ? ((x * 3 + z) % 7 === 0 ? c.char : c.crustHi) : c.crust);
    }
  }
  return p;
}

function taralli(c: FC): Prop {
  const p = new Prop(22, 9, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a heap of crunchy rings made with lard, black pepper and almonds
  const r = rng(85);
  const rings: [number, number, number][] = [[7, 2, 7], [14, 2, 7], [7, 2, 14], [14, 2, 14], [10.5, 4, 10.5], [10.5, 2, 10.5]];
  for (const [x, y, z] of rings) for (let t = 0; t < 14; t++) {
    const a = (t / 14) * Math.PI * 2, xx = Math.round(x + Math.cos(a) * 2.6), zz = Math.round(z + Math.sin(a) * 2.6);
    p.set(xx, y, zz, r() < 0.2 ? c.almond : r() < 0.3 ? c.taralloDark : c.tarallo);
    p.set(xx, y + 1, zz, r() < 0.15 ? c.pepperBlack : c.tarallo);
  }
  return p;
}

function arancino(c: FC): Prop {
  const p = new Prop(18, 18, 18, S);
  p.box(2, 0, 2, 15, 0, 15, c.paper);
  // a pear of saffron rice around ragù and peas, rolled in crumbs and fried
  for (let y = 1; y <= 15; y++) {
    const t = (y - 1) / 14, rr = t < 0.45 ? 5.6 * Math.sqrt(Math.sin(Math.PI * Math.min(1, t / 0.9))) + 0.6 : 5.8 * (1 - (t - 0.45) / 0.55) + 0.8;
    p.cylY(9, 9, rr, y, y, (x, yy, z) => ((x * 3 + yy * 5 + z) % 6 === 0 ? c.crumbDark : c.crumb));
  }
  p.cylY(9, 9, 1, 16, 16, c.crumbDark);
  return p;
}

function crocche(c: FC): Prop {
  const p = new Prop(22, 8, 18, S);
  p.box(1, 0, 1, 20, 0, 16, c.paper);
  // three potato croquettes, crumbed, one broken open on its soft centre and a thread of provola
  for (const [z, open] of [[4, false], [9, false], [14, true]] as [number, boolean][]) {
    for (let x = 4; x <= 17; x++) {
      if (open && x > 10 && x < 12) continue;
      p.ellipsoid(x, 2.4, z, 0.8, 2, 2, (xx, y, zz) => (open && (xx === 10 || xx === 12) && Math.hypot(y + 0.5 - 2.4, zz + 0.5 - z) < 1.4 ? c.potato : (xx + y + zz) % 4 === 0 ? c.crumbDark : c.crumb));
    }
    if (open) p.box(10, 2, z, 12, 2, z, c.provola);
  }
  return p;
}

function baba(c: FC): Prop {
  const p = new Prop(20, 16, 20, S);
  majolica(p, c, 10, 10, 9.5);
  // a mushroom of yeast cake drunk on rum syrup, with whipped cream and an amarena cherry
  p.cylY(10, 10, 4.2, 1, 6, (x, y, z) => ((x + y + z) % 4 === 0 ? c.babaDark : c.baba));
  p.ellipsoid(10, 8, 10, 5.6, 4.6, 5.6, (_x, y) => (y >= 11 ? c.babaGloss : c.baba));
  p.cylY(10, 10, 4.2, 1, 3, c.babaDark);
  p.ellipsoid(10, 13, 10, 2, 1.4, 2, c.cream);
  p.box(9, 14, 9, 10, 15, 10, c.amarena);
  p.box(3, 1, 3, 5, 1, 5, c.babaSyrup); p.box(14, 1, 15, 16, 1, 16, c.babaSyrup);
  return p;
}

function zeppola(c: FC): Prop {
  const p = new Prop(20, 10, 20, S);
  p.box(1, 0, 1, 18, 0, 18, c.paper);
  // a ring of choux pastry, piped with custard, crowned with amarena cherries and icing sugar
  for (let t = 0; t < 40; t++) {
    const a = (t / 40) * Math.PI * 2;
    p.ellipsoid(10 + Math.cos(a) * 5, 2.4, 10 + Math.sin(a) * 5, 2.6, 2.2, 2.6, (x, y, z) => ((x * 2 + z + y) % 5 === 0 ? c.pastryDark : c.pastry));
  }
  for (let t = 0; t < 24; t++) { const a = (t / 24) * Math.PI * 2; p.set(Math.round(10 + Math.cos(a) * 5), 5, Math.round(10 + Math.sin(a) * 5), c.custard); }
  p.ellipsoid(10, 5.4, 10, 2.2, 1.2, 2.2, c.custard);
  p.box(10, 6, 10, 11, 7, 11, c.amarena);
  p.box(5, 5, 9, 5, 5, 9, c.amarena);
  sprinkleOn(p, 3, 3, 17, 17, 24, c.sugar, 86, 3);
  return p;
}

function alici(c: FC): Prop {
  const p = new Prop(26, 10, 26, S);
  majolica(p, c, 13, 13, 12.5);
  // spaghetti with colatura, the amber anchovy essence of Cetara: garlic, parsley, toasted crumbs, a little chilli
  const r = rng(87);
  for (let y = 2; y <= 6; y++) p.cylY(13, 13, 8.6 - (y - 2) * 1.6, y, y, (x, yy, z) => ((x * 2 + z + yy) % 3 === 0 ? c.spaghettiHi : c.colatura));
  sprinkleOn(p, 6, 6, 20, 20, 24, c.parsley, 88, 3);
  sprinkleOn(p, 7, 7, 19, 19, 14, c.crumb, 89, 3);
  sprinkleOn(p, 8, 8, 18, 18, 6, c.onion, 90, 3);
  for (let k = 0; k < 3; k++) { const x = 9 + Math.floor(r() * 8), z = 9 + Math.floor(r() * 8); p.box(x, 7, z, x + 2, 7, z, c.anchovy); }
  return p;
}

function polpo(c: FC): Prop {
  const p = new Prop(26, 9, 26, S);
  majolica(p, c, 13, 13, 12.5);
  // octopus braised in its own juices with potatoes, tentacles curled over the top, olives and capers
  const r = rng(91);
  for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; p.ellipsoid(13 + Math.cos(a) * 6, 2.5, 13 + Math.sin(a) * 6, 1.8, 1.4, 1.8, () => (r() < 0.3 ? c.potatoHi : c.potato)); }
  for (let arm = 0; arm < 5; arm++) {
    const a0 = (arm / 5) * Math.PI * 2;
    for (let t = 0; t < 1; t += 0.05) {
      const a = a0 + t * 2.2, d = 1.5 + t * 7, rr = 1.6 - t * 1.1;
      p.ellipsoid(13 + Math.cos(a) * d, 3 + rr * 0.5, 13 + Math.sin(a) * d, rr + 0.3, rr, rr + 0.3, (x, y, z) => (y <= 3 && (x + z) % 2 === 0 ? c.octopusLight : c.octopus));
    }
  }
  for (const [x, z] of [[7, 9], [18, 17], [10, 19], [19, 8]]) p.set(x, 4, z, c.olive);
  sprinkleOn(p, 6, 6, 20, 20, 16, c.parsley, 92, 3);
  return p;
}

function sorrentina(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  // a terracotta cocotte of potato gnocchi baked in tomato and basil under bubbling mozzarella
  p.cylY(11, 11, 10.5, 0, 6, (x, y, z) => (y === 6 && (x + z) % 2 ? c.terracottaDark : c.terracotta));
  p.cylY(11, 11, 9.4, 1, 6, 0);
  p.cylY(11, 11, 9.4, 1, 4, c.tomato);
  const r = rng(93);
  for (let k = 0; k < 18; k++) { const a = r() * Math.PI * 2, d = r() * 7.5; p.ellipsoid(11 + Math.cos(a) * d, 4.6, 11 + Math.sin(a) * d, 1.4, 1, 1.2, c.dough); }
  for (let x = 3; x <= 19; x++) for (let z = 3; z <= 19; z++) {
    if (Math.hypot(x + 0.5 - 11, z + 0.5 - 11) > 8.8 || (x * 7 + z * 13) % 5 > 2) continue;
    let y = 9; while (y > 1 && !p.get(x, y - 1, z)) y--;
    p.set(x, y, z, (x + z * 3) % 7 === 0 ? c.cheeseBrown : c.mozzarella);
  }
  p.box(10, 7, 10, 12, 7, 11, c.basil); p.box(11, 7, 12, 11, 7, 12, c.basil);
  return p;
}

function polpette(c: FC): Prop {
  const p = new Prop(24, 10, 24, S);
  // a bowl of grandmother's meatballs in Sunday ragù, a slice of bread to mop it up
  for (let y = 0; y <= 5; y++) p.cylY(11, 11, 6 + y * 0.8, y, y, c.ceramicWhite);
  p.cylY(11, 11, 9.4, 5, 5, (x, _y, z) => ((x + z) % 3 ? c.ceramicBlue : c.ceramicYellow));
  p.cylY(11, 11, 9.4 - 0.8, 1, 5, 0);
  p.cylY(11, 11, 8.6, 1, 3, c.ragu);
  for (const [x, z] of [[8, 8], [14, 8], [8, 14], [14, 14], [11, 11]]) p.ellipsoid(x, 4, z, 2.6, 2.2, 2.6, (xx, y, zz) => ((xx * 3 + y + zz) % 5 === 0 ? c.meatDark : y <= 3 ? c.ragu : c.meat));
  sprinkleOn(p, 5, 5, 17, 17, 10, c.parmesan, 94, 4);
  p.box(9, 7, 10, 10, 7, 11, c.basil);
  p.box(18, 0, 18, 23, 2, 23, (x, y, z) => (y === 2 || x === 18 || z === 18 ? c.breadCrust : c.loaf));
  return p;
}

function melanzane(c: FC): Prop {
  const p = new Prop(22, 12, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // Amalfi's August oddity: fried aubergine layered with chocolate, ricotta and candied citron
  for (let layer = 0; layer < 3; layer++) {
    const y0 = 1 + layer * 3;
    p.box(5, y0, 6, 16, y0, 15, c.aubergineIn);
    p.box(5, y0 + 1, 6, 16, y0 + 2, 15, (x, y, z) => (x === 5 || x === 16 || z === 6 || z === 15 ? c.chocolateDark : y === y0 + 1 && layer < 2 ? c.ricotta : c.chocolate));
  }
  sprinkleOn(p, 6, 7, 15, 14, 14, c.candied, 95, 10);
  sprinkleOn(p, 6, 7, 15, 14, 10, c.almond, 96, 10);
  p.box(2, 1, 17, 5, 1, 19, c.chocolate);
  return p;
}

function pastiera(c: FC): Prop {
  const p = new Prop(22, 10, 22, S);
  majolica(p, c, 11, 11, 10.5);
  // a slice of the Easter tart: shortcrust, wheat berries in ricotta and orange flower, a lattice on top
  for (let x = 3; x <= 19; x++) for (let z = 4; z <= 18; z++) {
    const w = (x - 2) * 0.48;
    if (Math.abs(z - 11) > w) continue;
    const rim = x >= 18 || Math.abs(z - 11) > w - 1.2;
    for (let y = 1; y <= 6; y++) p.set(x, y, z, y === 1 || rim ? c.shortcrust : y === 6 ? ((x + z) % 5 === 0 || (x - z + 40) % 5 === 0 ? c.shortcrustHi : c.pastieraTop) : (x * 3 + y + z) % 5 === 0 ? c.wheat : c.ricotta);
  }
  sprinkleOn(p, 6, 6, 18, 16, 20, c.sugar, 97, 6);
  p.box(4, 1, 17, 5, 2, 18, c.candied);
  return p;
}

function risotto(c: FC): Prop {
  const p = new Prop(26, 8, 26, S);
  p.cylY(13, 13, 12.5, 0, 1, c.ceramicWhite);
  p.cylY(13, 13, 11, 1, 1, 0);
  // risotto with Amalfi lemon: creamy rice, zest, a thin slice and a lemon leaf
  const r = rng(98);
  p.cylY(13, 13, 9.4, 1, 2, () => (r() < 0.25 ? c.risottoHi : c.risotto));
  p.cylY(13, 13, 7, 3, 3, () => (r() < 0.25 ? c.risottoHi : c.risotto));
  sprinkleOn(p, 6, 6, 20, 20, 26, c.lemonPeel, 99, 2);
  p.cylY(17, 10, 2.8, 4, 4, (x, _y, z) => (Math.hypot(x + 0.5 - 17, z + 0.5 - 10) > 2 ? c.lemonPeel : c.lemonCream));
  p.box(8, 4, 14, 12, 4, 15, c.leaf); p.set(13, 4, 15, c.leaf);
  sprinkleOn(p, 8, 8, 18, 18, 6, c.pepperBlack, 100, 2);
  return p;
}

function ravioli(c: FC): Prop {
  const p = new Prop(24, 8, 24, S);
  majolica(p, c, 12, 12, 11.5);
  // Capri's half-moon ravioli of caciotta and marjoram in a fresh tomato sauce
  p.cylY(12, 12, 8.4, 1, 1, c.tomato);
  for (const [x, z, a] of [[8, 8, 0], [15, 8, 1], [8, 15, 1], [15, 15, 0], [11.5, 11.5, 0]] as [number, number, number][]) {
    for (let u = -3; u <= 3; u++) for (let v = 0; v <= 3; v++) {
      if (u * u / 10 + v * v / 10 > 1) continue;
      const xx = Math.round(x + (a ? v - 1.5 : u)), zz = Math.round(z + (a ? u : v - 1.5));
      const edge = u * u / 10 + v * v / 10 > 0.55 || v === 0;
      p.set(xx, 2, zz, edge ? c.pastaEdge : c.dough); if (!edge) p.set(xx, 3, zz, c.dough);
    }
  }
  for (const [x, z] of [[9, 9], [14, 14], [12, 6]]) p.ellipsoid(x, 3.5, z, 1, 1, 1, c.tomato);
  p.box(11, 4, 11, 12, 4, 12, c.basil);
  sprinkleOn(p, 6, 6, 18, 18, 10, c.parmesan, 101, 3);
  return p;
}
