import type { IconName } from '../ui/emblems';

/** Places the traveller can fly to. Only open ones are playable; the rest show up on the map as "coming soon". */
export interface Destination {
  id: string;
  city: string;
  country: string;
  /** City name in the local script. */
  local: string;
  /** Airport-style code printed on boarding passes. */
  code: string;
  lat: number;
  lon: number;
  /** IANA time zone, for the local time on the map. */
  tz: string;
  open: boolean;
  /** One line about the streets you'll explore. */
  blurb: string;
  /** A taste of the menu: [icon, dish]. */
  menu: [IconName, string][];
}

export const DESTINATIONS: Destination[] = [
  {
    id: 'tokyo', city: 'Tokyo', country: 'Japan', local: '東京', code: 'TYO', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo', open: true,
    blurb: 'Lantern-lit alleys, yatai carts and a canal lined with cherry trees.',
    menu: [['octopus', 'Takoyaki'], ['ramen', 'Ramen'], ['dango', 'Dango'], ['sushi', 'Omakase']],
  },
  {
    id: 'seoul', city: 'Seoul', country: 'South Korea', local: '서울', code: 'SEL', lat: 37.57, lon: 126.98, tz: 'Asia/Seoul', open: false,
    blurb: 'Steamy night markets under neon, from Gwangjang to Myeongdong.',
    menu: [['chili', 'Tteokbokki'], ['pancake', 'Hotteok'], ['onigiri', 'Gimbap']],
  },
  {
    id: 'bangkok', city: 'Bangkok', country: 'Thailand', local: 'กรุงเทพฯ', code: 'BKK', lat: 13.75, lon: 100.5, tz: 'Asia/Bangkok', open: false,
    blurb: 'Woks roaring on Yaowarat Road and boats selling noodles on the canals.',
    menu: [['shrimp', 'Pad thai'], ['mango', 'Mango sticky rice'], ['skewer', 'Moo ping']],
  },
  {
    id: 'istanbul', city: 'Istanbul', country: 'Türkiye', local: 'İstanbul', code: 'IST', lat: 41.01, lon: 28.98, tz: 'Europe/Istanbul', open: true,
    blurb: 'Simit carts and fish boats at Eminönü, the Spice Bazaar, the Grand Bazaar and the call to prayer over the Golden Horn.',
    menu: [['simit', 'Simit'], ['fish', 'Balık ekmek'], ['wrap', 'Dürüm döner'], ['honey', 'Baklava']],
  },
  {
    id: 'amalfi', city: 'Amalfi', country: 'Italy', local: 'Amalfi', code: 'AMF', lat: 40.63, lon: 14.6, tz: 'Europe/Rome', open: true,
    blurb: 'A town stacked up the cliffs: stairways, lemon terraces and fried fish by the harbour.',
    menu: [['croissant', 'Sfogliatella'], ['squid', 'Cuoppo di mare'], ['pizza', 'Pizza a portafoglio'], ['vanilla', 'Gelato al limone']],
  },
  {
    id: 'lisbon', city: 'Lisbon', country: 'Portugal', local: 'Lisboa', code: 'LIS', lat: 38.72, lon: -9.14, tz: 'Europe/Lisbon', open: false,
    blurb: 'Tiled hills, yellow trams and sardines on the grill in June.',
    menu: [['tart', 'Pastel de nata'], ['sando', 'Bifana'], ['fish', 'Sardinhas']],
  },
  {
    id: 'mexico', city: 'Mexico City', country: 'Mexico', local: 'CDMX', code: 'MEX', lat: 19.43, lon: -99.13, tz: 'America/Mexico_City', open: false,
    blurb: 'Taquerías on every corner and elote carts ringing their bells.',
    menu: [['taco', 'Tacos al pastor'], ['corn', 'Elote'], ['tamale', 'Tamales']],
  },
];

export const DEST: Record<string, Destination> = Object.fromEntries(DESTINATIONS.map((d) => [d.id, d]));

export interface Home { city: string; code: string; lat: number; lon: number; }

/** Rough positions for common time zones, so the flight can start from where the player is. */
const ZONES: Record<string, [number, number, string?]> = {
  'Europe/Lisbon': [38.7, -9.1, 'LIS'], 'Atlantic/Madeira': [32.6, -16.9, 'FNC'], 'Atlantic/Azores': [37.7, -25.7, 'PDL'],
  'Europe/London': [51.5, -0.1, 'LHR'], 'Europe/Dublin': [53.3, -6.3, 'DUB'], 'Europe/Madrid': [40.4, -3.7, 'MAD'], 'Europe/Paris': [48.9, 2.35, 'CDG'],
  'Europe/Brussels': [50.8, 4.4, 'BRU'], 'Europe/Amsterdam': [52.4, 4.9, 'AMS'], 'Europe/Berlin': [52.5, 13.4, 'BER'], 'Europe/Zurich': [47.4, 8.5, 'ZRH'],
  'Europe/Rome': [41.9, 12.5, 'FCO'], 'Europe/Vienna': [48.2, 16.4, 'VIE'], 'Europe/Prague': [50.1, 14.4, 'PRG'], 'Europe/Warsaw': [52.2, 21.0, 'WAW'],
  'Europe/Stockholm': [59.3, 18.1, 'ARN'], 'Europe/Oslo': [59.9, 10.8, 'OSL'], 'Europe/Copenhagen': [55.7, 12.6, 'CPH'], 'Europe/Helsinki': [60.2, 24.9, 'HEL'],
  'Europe/Athens': [38.0, 23.7, 'ATH'], 'Europe/Istanbul': [41.0, 29.0, 'IST'], 'Europe/Kiev': [50.5, 30.5, 'KBP'], 'Europe/Kyiv': [50.5, 30.5, 'KBP'], 'Europe/Moscow': [55.8, 37.6, 'SVO'],
  'America/New_York': [40.7, -74.0, 'JFK'], 'America/Toronto': [43.7, -79.4, 'YYZ'], 'America/Chicago': [41.9, -87.6, 'ORD'], 'America/Denver': [39.7, -105.0, 'DEN'],
  'America/Los_Angeles': [34.1, -118.2, 'LAX'], 'America/Vancouver': [49.3, -123.1, 'YVR'], 'America/Mexico_City': [19.4, -99.1, 'MEX'],
  'America/Sao_Paulo': [-23.6, -46.6, 'GRU'], 'America/Argentina/Buenos_Aires': [-34.6, -58.4, 'EZE'], 'America/Bogota': [4.7, -74.1, 'BOG'], 'America/Lima': [-12.0, -77.0, 'LIM'],
  'America/Santiago': [-33.4, -70.6, 'SCL'], 'Africa/Cairo': [30.0, 31.2, 'CAI'], 'Africa/Lagos': [6.5, 3.4, 'LOS'], 'Africa/Johannesburg': [-26.2, 28.0, 'JNB'],
  'Africa/Nairobi': [-1.3, 36.8, 'NBO'], 'Africa/Casablanca': [33.6, -7.6, 'CMN'], 'Asia/Dubai': [25.2, 55.3, 'DXB'], 'Asia/Kolkata': [19.1, 72.9, 'BOM'],
  'Asia/Bangkok': [13.75, 100.5, 'BKK'], 'Asia/Singapore': [1.35, 103.8, 'SIN'], 'Asia/Hong_Kong': [22.3, 114.2, 'HKG'], 'Asia/Shanghai': [31.2, 121.5, 'PVG'],
  'Asia/Seoul': [37.6, 127.0, 'ICN'], 'Asia/Tokyo': [35.7, 139.7, 'HND'], 'Asia/Manila': [14.6, 121.0, 'MNL'], 'Asia/Jakarta': [-6.2, 106.8, 'CGK'],
  'Australia/Sydney': [-33.9, 151.2, 'SYD'], 'Australia/Melbourne': [-37.8, 145.0, 'MEL'], 'Australia/Perth': [-31.95, 115.9, 'PER'], 'Pacific/Auckland': [-36.8, 174.8, 'AKL'],
};

/** Where the player is flying from, guessed from their time zone. */
export function homeCity(): Home {
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* very old browser */ }
  const city = tz.includes('/') && !tz.startsWith('Etc/') ? tz.split('/').pop()!.replace(/_/g, ' ') : 'Home';
  const z = ZONES[tz];
  if (z) return { city, code: z[2] ?? city.slice(0, 3).toUpperCase(), lat: z[0], lon: z[1] };
  // unknown zone: put home on the right meridian at a temperate latitude
  const lon = Math.max(-170, Math.min(170, -new Date().getTimezoneOffset() / 4));
  return { city, code: city.slice(0, 3).toUpperCase(), lat: 40, lon };
}
