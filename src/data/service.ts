import type { IconName } from '../ui/emblems';
import type { Look } from '../world/characters';
import type { RoomKind } from '../world/interiors';
import type { Buyable } from './places';
import { perCity } from '../world/cityId';
import { eur, lira } from './money';

/**
 * How a place feeds you, and the manners that go with it in each city.
 *
 * - `stall`: a street stall. Order over the counter, the cook hands it across, eat it there on your feet.
 * - `table`: table service. Take a seat, a waiter brings the menu, takes the order and serves each course at the
 *   table; the bill comes at the end, with the city's own cover charge and tipping custom.
 * - `counter`: a display case (bakeries, pastry shops, gelaterias, a bar's counter). Point at what you want, it goes
 *   in a paper bag; the first one is yours to eat now, the rest wait in your bag for a bench with a view.
 */
export type Service = 'stall' | 'table' | 'counter';

/** Rooms that sell from a case over the counter rather than serve at the tables. */
export const COUNTER_ROOMS: ReadonlySet<RoomKind> = new Set<RoomKind>(['bakery', 'konbini', 'firin', 'borek', 'lokum']);

/** Restaurants (StallInfo with a room) that sell over a display case instead of serving at the tables. */
const COUNTER_STALLS: Record<string, Service> = { ruocco: 'counter', dolceria: 'counter', duomo: 'counter', pastelaria: 'counter', gelataria: 'counter' };

/** How a stall or restaurant serves: its own `service`, else a restaurant serves at the tables and a stall over the counter. */
export function serviceOf(st: { id: string; restaurant?: boolean; service?: Service }): Service {
  return st.service ?? COUNTER_STALLS[st.id] ?? (st.restaurant ? 'table' : 'stall');
}

/** A tip choice on the bill: its label and what it adds to a total (both in the wallet's yen). */
export interface TipChoice { label: string; add: (total: number) => number }

export interface DiningCustom {
  /** The menu's name over the card, in English and in the local language. */
  menu: [string, string];
  /** The menu's sections, in the local language (English in brackets on the card). */
  sections: { food: [string, string]; sweet: [string, string]; drink: [string, string] };
  /** What the traveller says to call the waiter over. */
  call: string;
  /** The waiter's words: bringing the menu, taking the order, setting a plate down, bringing the bill, goodbye. */
  hello: string[];
  taken: string[];
  serve: string[];
  bill: string[];
  bye: string[];
  /** The bill's name, in English and locally. */
  billName: [string, string];
  /** What comes with the table and is charged per guest (coperto, couvert, otōshi). */
  cover?: { name: string; local: string; price: number; text: string; icon: IconName; only?: RoomKind[]; optional?: boolean };
  /** Tipping: the choices on the bill and a line on the custom. */
  tips: TipChoice[];
  tipNote: string;
  /** One line at the foot of the menu: something that comes free, or how ordering works here. */
  menuNote: string;
  /** How the bill is paid here. */
  payNote: string;
  /** House drinks every table-service place can bring. */
  drinks: Buyable[];
  /** Waiters: names and what they wear (on top of a random look). */
  waiters: string[];
  waiterLook: Partial<Look>;
}

/** Round a total up to the next whole `unit` (both in yen): the coins left on the saucer. */
const roundUp = (unit: number) => (t: number) => Math.ceil(t / unit) * unit - t;
const pct = (p: number, unit: number) => (t: number) => Math.round((t * p) / 100 / unit) * unit;

const TOKYO: DiningCustom = {
  menu: ['Menu', 'お品書き'],
  sections: { food: ['お料理', 'Dishes'], sweet: ['甘味', 'Sweets'], drink: ['お飲み物', 'Drinks'] },
  call: 'Sumimasen!',
  hello: ['Irasshaimase! Here is the menu. Oshibori, a hot towel for your hands.', 'Welcome! The tea is on the house. Call me when you are ready.'],
  taken: ['Kashikomarimashita! Right away.', 'Hai, one moment please!'],
  serve: ['Omatase shimashita! Sorry to keep you waiting.', 'Dōzo, please enjoy it while it is hot.'],
  bill: ['Here is the slip. You pay at the register on the way out.', 'Okaikei, the bill. Arigatō gozaimasu!'],
  bye: ['Arigatō gozaimashita! Come again!', 'Thank you very much! Mata dōzo!'],
  billName: ['Bill', 'お会計'],
  cover: { name: 'Otōshi', local: 'お通し', price: 400, icon: 'pickles', only: ['izakaya'], text: 'A little starter that comes with your seat in an izakaya. It is the table charge, not a mistake.' },
  tips: [{ label: 'No tip', add: () => 0 }],
  tipNote: 'Nobody tips in Japan: the price is the price, and a tip left on the table gets chased down the street. Say "gochisōsama deshita" instead.',
  menuNote: 'Green tea and cold water are free, and they keep coming.',
  payNote: 'In Japan the slip goes face down on the table and you pay at the register by the door.',
  drinks: [
    { icon: 'yunomi', name: 'Ocha', price: 0, snack: true, text: 'Free hot green tea, poured the moment you sit down.' },
    { icon: 'beer', name: 'Nama bīru', price: 600, snack: true, text: 'A draught lager in a frosted mug, a thumb of foam on top.' },
    { icon: 'tea', name: 'Oolong tea', price: 350, snack: true, text: 'Iced and unsweetened, the way Tokyo drinks it with fried food.' },
    { icon: 'can', name: 'Ramune', price: 300, snack: true, text: 'Lemon soda in a codd-neck bottle: pop the marble to open it.' },
  ],
  waiters: ['Yuki', 'Daichi', 'Mai', 'Kōta', 'Aoi', 'Shun', 'Rina', 'Haruto'],
  waiterLook: { topStyle: 'apron', top: 0x2b3346, accent: 0x2b3346, bottom: 0x2f2f35, hat: 'headband', hatColor: 0xf2efe7 },
};

const AMALFI: DiningCustom = {
  menu: ['Menu', 'Menù'],
  sections: { food: ['Piatti', 'Dishes'], sweet: ['Dolci', 'Sweets'], drink: ['Bevande', 'Drinks'] },
  call: 'Scusi!',
  hello: ['Buongiorno! Ecco il menù. Take your time, nobody rushes here.', 'Benvenuti! The view is free, the bread is on the way.'],
  taken: ['Perfetto! Subito.', 'Ottima scelta! Right away.'],
  serve: ['Ecco a lei. Buon appetito!', 'Prego! Straight from the kitchen.'],
  bill: ['Il conto, prego. Grazie mille!', 'Here is the bill. Was everything good?'],
  bye: ['Grazie, arrivederci!', 'A presto! Come back tomorrow.'],
  billName: ['Bill', 'Il conto'],
  cover: { name: 'Coperto', local: 'coperto', price: eur(2.5), icon: 'toast', text: 'Bread, the cloth and the table: a cover charge for each guest, normal all over Italy.' },
  tips: [{ label: 'No tip', add: () => 0 }, { label: 'Round up', add: roundUp(eur(1)) }, { label: 'A couple of euros', add: () => eur(2) }],
  tipNote: 'Service is in the price in Italy. Rounding up, or a coin or two for a lovely waiter, is kind, never expected.',
  menuNote: 'You never get the bill until you ask for it: "il conto, per favore".',
  payNote: 'Pay at the table. The coperto is on every bill, so do not be surprised.',
  drinks: [
    { icon: 'water', name: 'Acqua minerale', price: eur(2), snack: true, text: 'Naturale or frizzante, the first question every Italian waiter asks.' },
    { icon: 'wine', name: 'Vino della casa', price: eur(4.5), snack: true, text: 'A glass of the house white from the hills behind the town.' },
    { icon: 'beer', name: 'Birra alla spina', price: eur(4), snack: true, text: 'A cold draught lager, poured with a proper collar of foam.' },
    { icon: 'juice', name: 'Aranciata', price: eur(3), snack: true, text: 'Orange soda made with Sicilian oranges, bitter-sweet and fizzy.' },
  ],
  waiters: ['Marco', 'Giulia', 'Salvatore', 'Chiara', 'Gennaro', 'Francesca', 'Luca', 'Rosaria'],
  waiterLook: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2b2b30, bottom: 0x2b2b30, hat: 'none' },
};

const ISTANBUL: DiningCustom = {
  menu: ['Menu', 'Menü'],
  sections: { food: ['Yemekler', 'Dishes'], sweet: ['Tatlılar', 'Sweets'], drink: ['İçecekler', 'Drinks'] },
  call: 'Bakar mısınız?',
  hello: ['Hoş geldiniz! Here is the menu. Çay is on the way.', 'Buyurun, welcome! Sit, sit. The bread is fresh from the oven.'],
  taken: ['Hemen geliyor! Coming right up.', 'Tabii efendim, right away!'],
  serve: ['Afiyet olsun! Enjoy it.', 'Buyurun. Careful, the plate is hot!'],
  bill: ['Hesap, buyurun. Thank you!', 'Here is the bill, afiyet olsun!'],
  bye: ['Güle güle! Come again!', 'Teşekkürler, iyi günler!'],
  billName: ['Bill', 'Hesap'],
  tips: [{ label: 'No tip', add: () => 0 }, { label: '5%', add: pct(5, lira(5)) }, { label: '10%', add: pct(10, lira(5)) }],
  tipNote: 'Bahşiş, the tip: about ten per cent in a restaurant. At a tea house you just leave the change.',
  menuNote: 'Bread is free and keeps coming, and the first glass of tea is often on the house.',
  payNote: 'Ask for "hesap" and the bill comes on a little tray. Leave the tip in cash for the waiter.',
  drinks: [
    { icon: 'drop', name: 'Çay', price: lira(30), snack: true, text: 'Black tea in a tulip glass, red as a fox and strong as you like.' },
    { icon: 'water', name: 'Su', price: lira(15), snack: true, text: 'A cold glass of water, served in a sealed little cup as often as not.' },
    { icon: 'coffee', name: 'Türk kahvesi', price: lira(120), snack: true, text: 'Thick, sweet and served with a glass of water and a cube of lokum.' },
    { icon: 'juice', name: 'Şalgam', price: lira(60), snack: true, text: 'Spicy purple carrot juice from Adana. The perfect thing with a kebap.' },
  ],
  waiters: ['Mehmet', 'Elif', 'Emre', 'Zeynep', 'Murat', 'Ayşe', 'Burak', 'Selin'],
  waiterLook: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2b2b30, bottom: 0x2b2b30, hat: 'none' },
};

const MADEIRA: DiningCustom = {
  menu: ['Menu', 'Ementa'],
  sections: { food: ['Pratos', 'Dishes'], sweet: ['Sobremesas', 'Sweets'], drink: ['Bebidas', 'Drinks'] },
  call: 'Se faz favor!',
  hello: ['Boa tarde! Aqui está a ementa. The bolo do caco is fresh from the stone.', 'Bem-vindo! Sit wherever you like, I will bring the menu.'],
  taken: ['Muito bem! Já vem.', 'Com certeza, right away!'],
  serve: ['Aqui está. Bom apetite!', 'Bom proveito! Mind the plate, it is hot.'],
  bill: ['A conta, se faz favor. Obrigado!', 'Here is the bill. Was everything good?'],
  bye: ['Obrigado, até à próxima!', 'Volte sempre! Come back soon.'],
  billName: ['Bill', 'A conta'],
  cover: { name: 'Couvert', local: 'couvert', price: eur(2.5), icon: 'toast', optional: true, text: 'Bolo do caco with garlic butter and a dish of olives, brought to the table. You only pay for it if you keep it.' },
  tips: [{ label: 'No tip', add: () => 0 }, { label: 'Round up', add: roundUp(eur(1)) }, { label: '10%', add: pct(10, eur(0.5)) }],
  tipNote: 'Tips are welcome, never asked for: round up in a café, five to ten per cent in a restaurant.',
  menuNote: 'The couvert comes to the table on its own. Send it back if you do not want it, and it is off the bill.',
  payNote: 'Ask for "a conta" and pay at the table.',
  drinks: [
    { icon: 'water', name: 'Água', price: eur(1.5), snack: true, text: 'Still or sparkling, from springs high in the laurel forest.' },
    { icon: 'wine', name: 'Copo de vinho Madeira', price: eur(4), snack: true, text: 'A small glass of medium-dry Verdelho, the island\'s famous fortified wine.' },
    { icon: 'juice', name: 'Sumo de maracujá', price: eur(3), snack: true, text: 'Fresh passion fruit juice, tart and perfumed.' },
    { icon: 'coffee', name: 'Bica', price: eur(1), snack: true, text: 'A short black coffee, Lisbon\'s word for an espresso.' },
  ],
  waiters: ['João', 'Ana', 'Rui', 'Marta', 'Nuno', 'Sofia', 'Tiago', 'Rita'],
  waiterLook: { topStyle: 'vest', top: 0xf4f1ea, accent: 0x2b2b30, bottom: 0x2b2b30, hat: 'none' },
};

export const DINING: DiningCustom = perCity({ tokyo: TOKYO, amalfi: AMALFI, istanbul: ISTANBUL, madeira: MADEIRA });

/** Menu icons that are drunk, and the ones that are sweets (for the menu's sections). */
export const DRINK_ICONS: ReadonlySet<string> = new Set(['coffee', 'latte', 'tea', 'can', 'vitamin', 'milk', 'drop', 'water', 'wine', 'beer', 'juice', 'yunomi']);
export const SWEET_ICONS: ReadonlySet<string> = new Set(['tart', 'sugar', 'melonpan', 'anpan', 'croissant', 'bean', 'pudding', 'cake']);

/** Seconds the kitchen takes over a course before the waiter carries it out. */
export const KITCHEN_SECS = { drink: 2.5, food: 5.5, sweet: 3.5 };

/** How many things a single order can hold (a table for one). */
export const ORDER_MAX = 4;
/** How many things the bag holds. */
export const BAG_MAX = 8;
