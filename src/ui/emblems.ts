import { G, svg } from './glyphs';

/**
 * Emblems: the game's own icons for food, souvenirs, finds and events, drawn in the same
 * line style as the interface glyphs. Parts with class "t" get a soft tint of the stroke colour.
 */
/** Round dots at "x y x y ..." points. */
const dots = (pts: string) => {
  const n = pts.split(' ');
  let d = '';
  for (let i = 0; i + 1 < n.length; i += 2) d += `M${n[i]} ${n[i + 1]}h.01`;
  return `<path stroke-width="2.6" d="${d}"/>`;
};

export const E = {
  // ---------------------------------------------------------------- places and events
  bed: svg('<path class="t" d="M3 12.5h18v4H3z"/><path d="M3 7v12.5M21 12.5v7M3 16.5h18"/><rect x="5" y="9.5" width="5" height="3" rx="1.2"/>'),
  futon: svg('<rect class="t" x="3" y="9" width="18" height="8" rx="1.5"/><rect x="4.5" y="10.5" width="4.5" height="5" rx="1.2"/><path d="M11.5 9v8M2.5 19.5h19"/>'),
  key: svg('<circle class="t" cx="7.5" cy="12" r="4"/><circle cx="7.5" cy="12" r="1.2"/><path d="M11.5 12H21M17.5 12v3M20 12v2.5"/>'),
  bell: svg('<path class="t" d="M4.5 16.5a7.5 7.5 0 0 1 15 0Z"/><path d="M3 16.5h18M3 19.5h18M12 9V7M10.5 7h3"/>'),
  lift: svg('<rect class="t" x="5" y="7" width="14" height="13.5" rx="1"/><path d="M12 7v13.5M9.5 4.5 12 2l2.5 2.5"/>'),
  stairs: svg('<path class="t" d="M3 20.5V16h4.5v-4.5H12V7h4.5V3.5H21v17H3Z"/>'),
  suitcase: svg('<rect class="t" x="4" y="7.5" width="16" height="12" rx="2"/><path d="M9 7.5V5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 5v2.5M8 7.5v12M16 7.5v12"/>'),
  skyline: svg('<path class="t" d="M3 20.5V11h4V7h4v6h3V5h4v8h3v7.5H3Z"/><path d="M2 20.5h20"/>' + dots('9 10 16 8.5 16 11.5 5 14')),
  yukata: svg('<path class="t" d="M8 3.5 4 6l1 5.5 2-.8v9.8h10v-9.8l2 .8L20 6l-4-2.5"/><path d="M8 3.5 12 10l4-6.5M7 13h10M12 10l-3 10.5"/>'),
  sunrise: svg('<path class="t" d="M6 15a6 6 0 0 1 12 0Z"/><path d="M3 18.5h18M6 15a6 6 0 0 1 12 0M12 2.5v4M9.5 5 12 2.5 14.5 5M4.6 9.6l1.6 1.6M19.4 9.6l-1.6 1.6"/>'),
  stall: svg('<path class="t" d="M3 9h18l-2-4.5H5L3 9Z"/><path d="M3 9a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0"/><path d="M5 12.5v8h14v-8M9.5 20.5v-4.5h5v4.5"/>'),
  door: svg('<rect class="t" x="5" y="3" width="14" height="18" rx="1.2"/><path d="M12 3v18M5 9h14M5 15h14"/><path stroke-width="2.6" d="M14.5 12h.01"/>'),
  wall: svg('<rect x="3.5" y="4" width="17" height="16" rx="1.5"/><path d="M3.5 9.3h17M3.5 14.6h17M10 4v5.3M15 9.3v5.3M8 14.6V20"/>'),
  lantern: svg('<path d="M12 2.5v2M9.5 4.5h5M9.5 19.5h5M12 19.5v2"/><path class="t" d="M9 4.5h6c3 1.8 4.5 4.3 4.5 7.5S18 17.7 15 19.5H9C6 17.7 4.5 15.2 4.5 12S6 6.3 9 4.5Z"/><path d="M5 9.5h14M5 14.5h14"/>'),
  daruma: svg('<path class="t" d="M12 3.5c4.4 0 7 3.6 7 8.3 0 5-3 8.7-7 8.7s-7-3.7-7-8.7c0-4.7 2.6-8.3 7-8.3Z"/><ellipse cx="12" cy="11" rx="3.6" ry="3"/><circle cx="10.6" cy="10.6" r="1" fill="currentColor" stroke="none"/><circle cx="13.4" cy="10.6" r=".8" stroke-width="1.2"/><path d="M9 17h6"/>'),
  cat: svg('<path class="t" d="M5 10.5 4.5 4l4.3 3.2a9 9 0 0 1 6.4 0L19.5 4 19 10.5c.6 1 1 2.2 1 3.5 0 3.9-3.6 6.5-8 6.5s-8-2.6-8-6.5c0-1.3.4-2.5 1-3.5Z"/><path stroke-width="2.6" d="M9 13h.01M15 13h.01"/><path d="M10.5 16.2c.5.4 1 .6 1.5.6s1-.2 1.5-.6"/>'),
  paw: svg('<path class="t" d="M12 12.5c-3 0-5.5 3-5.5 5.2 0 1.6 1.2 2.3 2.6 2.3 1.2 0 1.9-.6 2.9-.6s1.7.6 2.9.6c1.4 0 2.6-.7 2.6-2.3 0-2.2-2.5-5.2-5.5-5.2Z"/><circle cx="5.3" cy="11" r="1.8"/><circle cx="9.2" cy="6.5" r="1.8"/><circle cx="14.8" cy="6.5" r="1.8"/><circle cx="18.7" cy="11" r="1.8"/>'),
  chat: svg('<path class="t" d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v7a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4A2.5 2.5 0 0 1 4 13.5v-7Z"/><path stroke-width="2.6" d="M8.5 10h.01M12 10h.01M15.5 10h.01"/>'),
  scroll: svg('<path class="t" d="M6 6h12v12H6z" stroke="none"/><rect x="4" y="3" width="16" height="3" rx="1.5"/><rect x="4" y="18" width="16" height="3" rx="1.5"/><path d="M6 6v12M18 6v12M9 10h6M9 13.5h4"/>'),
  capsule: svg('<path class="t" d="M3.5 12a8.5 8.5 0 0 1 17 0Z"/><circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h6.5M14 12h6.5"/><circle cx="12" cy="12" r="2"/>'),
  purse: svg('<path class="t" d="M4 11c0-1.5 1.2-2.5 2.5-2.5h11c1.3 0 2.5 1 2.5 2.5v6.5a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V11Z"/><circle cx="10.4" cy="6.2" r="1.6"/><circle cx="13.6" cy="6.2" r="1.6"/><path d="M4 12h16"/>'),
  confetti: svg('<path class="t" d="M4 20.5 8 9l7 7-11 4.5Z"/><path d="M13 4.5c.5 1.5 0 3-1.5 3.5M19.5 11c-1.5-.5-3 0-3.5 1.5M20 4l-3 3"/><path stroke-width="2.6" d="M15.5 3h.01M21 8.5h.01M18 15.5h.01"/>'),
  camera: svg('<path class="t" d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.6l1.5-2.3h5.8L16.4 7H19a1.5 1.5 0 0 1 1.5 1.5v9A1.5 1.5 0 0 1 19 19H5a1.5 1.5 0 0 1-1.5-1.5v-9Z"/><circle cx="12" cy="12.8" r="3.4"/><circle cx="12" cy="12.8" r="1.2"/>' + dots('17.3 9.6')),
  compass: svg('<circle cx="12" cy="12" r="8.5"/><path class="t" d="m15.5 8.5-2 5-5 2 2-5 5-2Z"/>'),
  signal: svg('<path d="M12 11v9.5M9 20.5h6"/><circle cx="12" cy="9" r="1.6"/><path d="M8.5 5.5a5 5 0 0 0 0 7M15.5 5.5a5 5 0 0 1 0 7M5.5 3a9 9 0 0 0 0 12M18.5 3a9 9 0 0 1 0 12"/>'),
  fire: svg('<path class="t" d="M12 21c-3.9 0-6.5-2.7-6.5-6.2 0-3.4 2.4-5.4 3.8-8.3.5 2 1.4 3 2.7 3.5C12 7 12.8 4.8 14.8 3c.4 3.2 3.7 5.5 3.7 11.3 0 3.8-2.6 6.7-6.5 6.7Z"/><path d="M12 21c-1.6 0-2.8-1.2-2.8-2.8 0-1.8 1.6-2.7 2.3-4.2 1.7 1 3.3 2.4 3.3 4.2 0 1.6-1.2 2.8-2.8 2.8Z"/>'),
  knife: svg('<g transform="rotate(-35 12 12)"><path class="t" d="M9 9.5h12.5c0 3.2-3.5 5.5-8 5.5H9V9.5Z"/><rect x="2.5" y="10.3" width="6.5" height="3.6" rx="1.6"/></g>'),
  trophy: svg('<path class="t" d="M7 4h10v5a5 5 0 0 1-10 0V4Z"/><path d="M7 6H4.5v1.5a3 3 0 0 0 3 3M17 6h2.5v1.5a3 3 0 0 1-3 3M12 14v3.5M8.5 20.5h7M10 17.5h4"/>'),
  crown: svg('<path class="t" d="M4.5 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1.5 10h-15Z"/><path d="M4.5 20.5h15"/>'),
  medal: svg('<path d="M8 3h3l1.5 5M16 3h-3l-1.5 5"/><circle class="t" cx="12" cy="14.5" r="6"/><path stroke-width="1.6" d="m12 11.7.9 1.8 2 .3-1.4 1.4.3 2-1.8-.9-1.8.9.3-2-1.4-1.4 2-.3.9-1.8Z"/>'),
  // ---------------------------------------------------------------- souvenirs and wearables
  headband: svg('<path class="t" d="M3 9c3-1.5 6-2 9-2s6 .5 9 2v4c-3-1.5-6-2-9-2s-6 .5-9 2V9Z"/><circle cx="12" cy="9" r="1.8" fill="currentColor" stroke="none"/><path d="M17.5 12l1.5 7M20 12.5l2 5"/>'),
  coat: svg('<path class="t" d="M8.5 3.5 3 6.5l1.5 5L7 10.5v10h10v-10l2.5 1L21 6.5l-5.5-3"/><path d="M8.5 3.5 12 12l3.5-8.5M12 12v8.5"/>'),
  noren: svg('<path d="M3 4h18"/><rect class="t" x="4.5" y="4" width="4.3" height="13.5" rx=".8"/><rect class="t" x="9.85" y="4" width="4.3" height="13.5" rx=".8"/><rect class="t" x="15.2" y="4" width="4.3" height="13.5" rx=".8"/><circle cx="12" cy="10" r="1.3"/>'),
  towel: svg('<path d="M3.5 4h17"/><rect class="t" x="5" y="4" width="14" height="16" rx="1"/><path d="M5 10c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0M5 14.5c1.2-1 2.3-1 3.5 0s2.3 1 3.5 0 2.3-1 3.5 0 2.3 1 3.5 0"/>'),
  chopsticks: svg('<path d="M5 3.5 13.5 17M10.5 3.5 16 17"/><rect class="t" x="4" y="17" width="16" height="3.5" rx="1.75"/>'),
  chime: svg('<path d="M12 2.5v4M12 12v3"/><path class="t" d="M6.5 12a5.5 5.5 0 0 1 11 0Z"/><rect x="10" y="15" width="4" height="6" rx=".8"/>'),
  flower: svg('<path d="M12 14v7M12 18.5c-1.5-1.6-3.3-2-5-1.5.6 1.7 2.6 2.3 5 1.5Z"/><g class="t"><ellipse cx="12" cy="4.8" rx="1.8" ry="2.4"/><ellipse cx="12" cy="4.8" rx="1.8" ry="2.4" transform="rotate(72 12 9)"/><ellipse cx="12" cy="4.8" rx="1.8" ry="2.4" transform="rotate(144 12 9)"/><ellipse cx="12" cy="4.8" rx="1.8" ry="2.4" transform="rotate(216 12 9)"/><ellipse cx="12" cy="4.8" rx="1.8" ry="2.4" transform="rotate(288 12 9)"/></g><circle cx="12" cy="9" r="2" fill="currentColor" stroke="none"/>'),
  posy: svg('<path class="t" d="M7 11.5h10l-4 9.5h-2l-4-9.5Z"/><circle cx="8.3" cy="8" r="2.5"/><circle cx="15.7" cy="8" r="2.5"/><circle cx="12" cy="5" r="2.5"/>'),
  bookmark: svg('<path class="t" d="M7 3h10v18l-5-4-5 4V3Z"/><path d="M12 13V8.5M12 10.5c1.5-.3 2.3-1.3 2.3-2.8-1.5 0-2.3 1-2.3 2.8ZM12 11.5c-1.5-.3-2.3-1.3-2.3-2.8 1.5 0 2.3 1 2.3 2.8Z"/>'),
  plaster: svg('<g transform="rotate(-45 12 12)"><rect class="t" x="2.5" y="8" width="19" height="8" rx="4"/><rect x="9" y="8" width="6" height="8"/></g><path stroke-width="2" d="M11 11h.01M13 13h.01M13 11h.01M11 13h.01"/>'),
  // ---------------------------------------------------------------- snacks and drinks
  can: svg('<path class="t" d="M7 5.5h10V19a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 7 19V5.5Z"/><path d="M8 3.5h8M7 9h10M7 16h10"/>'),
  coffee: svg('<path class="t" d="M4.5 9h12v5a5 5 0 0 1-5 5h-2a5 5 0 0 1-5-5V9Z"/><path d="M16.5 10.5h1.5a2.5 2.5 0 0 1 0 5h-1.8M3.5 21h15M8.5 3.5c0 1.5 1 1.5 1 3M12 3.5c0 1.5 1 1.5 1 3"/>'),
  latte: svg('<path class="t" d="M6 7.5h12l-1.4 12.5a1.5 1.5 0 0 1-1.5 1.3H8.9a1.5 1.5 0 0 1-1.5-1.3L6 7.5Z"/><path d="M13 7.5 15 2.5M6.6 12.5h10.8"/><rect x="9" y="14.5" width="2.6" height="2.6" rx=".5"/>'),
  beer: svg('<path class="t" d="M5.5 8h10v11a1.5 1.5 0 0 1-1.5 1.5H7A1.5 1.5 0 0 1 5.5 19V8Z"/><path d="M15.5 10.5h1.8a1.8 1.8 0 0 1 1.8 1.8v3.4a1.8 1.8 0 0 1-1.8 1.8h-1.8M5 8.2a2.3 2.3 0 0 1 2.4-3.4 3 3 0 0 1 5.4-.6 2.4 2.4 0 0 1 3.3 3.8M9 11v6.5M12 11v6.5"/>'),
  wine: svg('<path class="t" d="M7.5 3.5h9c.4 4.5-.6 8.5-4.5 8.5s-4.9-4-4.5-8.5Z"/><path d="M12 12v8M8.5 20.5h7M7.6 7.5h8.8"/>'),
  water: svg('<path class="t" d="M6.5 6.5h11l-1.2 12.7a1.5 1.5 0 0 1-1.5 1.3H9.2a1.5 1.5 0 0 1-1.5-1.3L6.5 6.5Z"/><path d="M7 11.5c1.7-.8 3.3.8 5 0s3.3.8 5 0M12 2.5c-1 1.3-1.5 2.1-1.5 2.8a1.5 1.5 0 0 0 3 0c0-.7-.5-1.5-1.5-2.8Z"/>'),
  juice: svg('<path class="t" d="M6.5 8h11l-1.3 11.2a1.5 1.5 0 0 1-1.5 1.3H9.3a1.5 1.5 0 0 1-1.5-1.3L6.5 8Z"/><path d="M14 8l2.5-5.5h2M7 12h10"/><circle cx="17.5" cy="7.5" r="2.6"/>'),
  yunomi: svg('<path class="t" d="M6.5 5.5h11l-.8 13.3a1.8 1.8 0 0 1-1.8 1.7H9.1a1.8 1.8 0 0 1-1.8-1.7L6.5 5.5Z"/><path d="M6.8 10.5h10.4M10 14.5c1 .6 3 .6 4 0"/>'),
  terrace: svg('<path class="t" d="M3 8.5 12 3l9 5.5Z"/><path d="M12 8.5v12M8 20.5h8M6.5 13.5h11M4.5 13.5v7M19.5 13.5v7M4.5 17h3M16.5 17h3"/>'),
  seat: svg('<path class="t" d="M7 3.5h10v8H7z"/><path d="M5.5 11.5h13v2.5h-13zM7 14v6.5M17 14v6.5M8.5 17.5h7"/>'),
  receipt: svg('<path class="t" d="M6 3h12v17.5l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3V3Z"/><path d="M9 7.5h6M9 11h6M9 14.5h3.5"/>'),
  waiter: svg('<path class="t" d="M4 15.5a8 8 0 0 1 16 0Z"/><path d="M2.5 15.5h19M12 7.5v-2M10.5 5.5h3M5 19h14"/>'),
  vitrine: svg('<path class="t" d="M3.5 9.5h17v6h-17z"/><path d="M3.5 9.5 6 5h12l2.5 4.5M3.5 15.5v5h17v-5"/><path stroke-width="2.6" d="M7 12.5h.01M12 12.5h.01M17 12.5h.01"/>'),
  tea: svg('<path class="t" d="M6 8h12l-1 10.5a2 2 0 0 1-2 1.8H9a2 2 0 0 1-2-1.8L6 8Z"/><path d="M6.4 12h11.2M10 3c0 1.3 1 1.3 1 2.5M13.5 3c0 1.3 1 1.3 1 2.5"/>'),
  vitamin: svg('<path class="t" d="M8.5 9.5a2 2 0 0 1 1-1.7V6h5v1.8a2 2 0 0 1 1 1.7v10a1.5 1.5 0 0 1-1.5 1.5h-4a1.5 1.5 0 0 1-1.5-1.5v-10Z"/><path d="M9.5 3h5v3h-5zM8.5 12.5h7v4h-7"/>'),
  toast: svg('<path class="t" d="M5.5 20.5v-9.3A3.8 3.8 0 0 1 7.5 4h9a3.8 3.8 0 0 1 2 7.2v9.3h-13Z"/><rect x="10" y="11" width="4" height="3" rx=".6"/>'),
  edamame: svg('<path class="t" d="M4.5 18.5C3 15 9 5 18 4.5c2 0 2.5 1 1.5 3C16 14 9 19.5 4.5 18.5Z"/><circle cx="8.5" cy="14.5" r="1.6"/><circle cx="12" cy="11" r="1.6"/><circle cx="15.5" cy="7.8" r="1.6"/>'),
  pickles: svg('<path class="t" d="M3 14h18a9 4.5 0 0 1-18 0Z"/><circle cx="8" cy="10.5" r="2.6"/><circle cx="15.5" cy="10" r="2.6"/><path stroke-width="2.4" d="M8 10.5h.01M15.5 10h.01"/><path d="M11 13.5c.5-2 1.5-3 3-3.3"/>'),
  onigiri: svg('<path class="t" d="M10.3 4.6a2 2 0 0 1 3.4 0l6.6 11.3A2.6 2.6 0 0 1 18 19.8H6a2.6 2.6 0 0 1-2.3-3.9l6.6-11.3Z"/><path fill="currentColor" d="M8.5 15h7v4.8h-7z"/>'),
  nikuman: svg('<path class="t" d="M3.5 17.5c0-5 3.8-9.5 8.5-9.5s8.5 4.5 8.5 9.5a1.5 1.5 0 0 1-1.5 1.5h-14a1.5 1.5 0 0 1-1.5-1.5Z"/><path d="M12 8c-.5 1.5-.3 2.5.5 3.5M9.3 9c.3 1 1 1.8 2.2 2.3M14.7 9c-.3 1-1 1.8-2 2.3"/>'),
  gyoza: svg('<path class="t" d="M3 13c2.5 4 5.5 5.5 9 5.5s6.5-1.5 9-5.5c-2-1.5-5.5-2.5-9-2.5S5 11.5 3 13Z"/><path d="M6.5 11.5c.3 1 .9 1.6 1.7 2M10.3 10.7c.2 1.1.6 1.8 1.4 2.3M14 10.7c.1 1.1.5 1.8 1.3 2.3M17.6 11.5c0 1-.4 1.6-1 2.1"/>'),
  sando: svg('<path class="t" d="M3.5 18.5 12 5l8.5 13.5h-17Z"/><path d="M6.2 14.2c2 .8 3.8.8 5.8 0s3.8-.8 5.8 0"/>'),
  chicken: svg('<path class="t" d="M9.5 14.5c-1.5-3.5-.5-7.5 3-9.5s7.5-.5 8 3-2 6.5-5 7.5c-2.2.7-4.5.5-6-1Z"/><path d="M9.5 14.5 6.6 17.4"/><circle cx="4.6" cy="17.6" r="1.6"/><circle cx="6.4" cy="19.4" r="1.6"/>'),
  chikuwa: svg('<path class="t" d="M6.5 8h12v8h-12a4 4 0 0 1 0-8Z"/><circle cx="18.5" cy="12" r="4"/><circle cx="18.5" cy="12" r="1.4"/><path d="M8 9.5v5M11.5 9.5v5"/>'),
  fish: svg('<path class="t" d="M2.5 12c2-3.6 5-5.5 8.5-5.5 3 0 5.3 1.6 7 3.8L21.5 8v8L18 13.7c-1.7 2.2-4 3.8-7 3.8-3.5 0-6.5-1.9-8.5-5.5Z"/><circle cx="7.3" cy="11" r="1" fill="currentColor" stroke="none"/>'),
  melonpan: svg('<path class="t" d="M3.5 16.5a8.5 8.5 0 0 1 17 0v1a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5v-1Z"/><path stroke-width="1.5" d="M8 10l6.5 9M12 8.2 18 16.5M5.2 13l4 6M16 10l-6.5 9M12 8.2 6 16.5M18.8 13l-4 6"/>'),
  currypan: svg('<ellipse class="t" cx="12" cy="13" rx="9" ry="6"/>' + dots('8 11 12 9.8 16 11 10 14 14 14 6.5 14.5 17.5 14.5 12 16.8')),
  anpan: svg('<circle class="t" cx="12" cy="12" r="8.5"/><circle cx="12" cy="11.5" r="2.6"/>' + dots('11 11 13 12 12 10.5')),
  // ---------------------------------------------------------------- dishes and street food
  sushi: svg('<path class="t" d="M4 15c0-2 2.5-3.2 8-3.2s8 1.2 8 3.2v1.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V15Z"/><path class="t" d="M3.5 11c2-3 6-4.5 10-4.5 3.5 0 6 1.5 7 3.5-3 1.6-13 3-17 1Z"/><path d="M10 7.2l1.4 3M14.2 6.6l1 3"/>'),
  ramen: svg('<path class="t" d="M3 11h18a9 9 0 0 1-18 0Z"/><path d="M8 20.5h8M13.5 3 10 11M19 4l-6.5 7M5.5 8.2c1-.8 2-.8 3 0"/>'),
  dango: svg('<path d="M12 2v1.5M12 19.5V22"/><circle class="t" cx="12" cy="6.2" r="2.6"/><circle class="t" cx="12" cy="11.5" r="2.6"/><circle class="t" cx="12" cy="16.8" r="2.6"/>'),
  takoyaki: svg('<path class="t" d="M3 13.5h18l-2 5.5a2 2 0 0 1-1.9 1.3H6.9A2 2 0 0 1 5 19l-2-5.5Z"/><circle cx="7.5" cy="10.5" r="3"/><circle cx="16.5" cy="10.5" r="3"/><circle cx="12" cy="9" r="3"/><path d="M17.5 4.5 20.5 2"/>'),
  shrimp: svg('<path class="t" d="M4.5 19.5c-1.5-1.5-1-4 1-6l7-7c1.5-1.5 4-1.5 5 0s0 3.5-1.5 5l-7 7c-1.8 1.8-3.5 2.5-4.5 1Z"/><path d="M17.5 6.5 19.5 3l1.5 3.3-3.5.2Z"/><path d="M8 13.5l1 1M10.5 11l1 1M13 8.5l1 1"/>'),
  octopus: svg('<path class="t" d="M6 11.5a6 6 0 0 1 12 0v2H6v-2Z"/><path d="M6 13.5c0 3-2.5 4-2.5 6M9.5 13.5c0 3-1 4.5-1 6.5M14.5 13.5c0 3 1 4.5 1 6.5M18 13.5c0 3 2.5 4 2.5 6"/><path stroke-width="2.6" d="M9.5 10h.01M14.5 10h.01"/>'),
  squid: svg('<path class="t" d="M12 2.5c2.5 2 4 5 4 8v3H8v-3c0-3 1.5-6 4-8Z"/><path d="M8 13.5c-.5 3-2 4.5-3 7M10.5 13.5c0 3-.5 5-1 7.5M13.5 13.5c0 3 .5 5 1 7.5M16 13.5c.5 3 2 4.5 3 7"/><path stroke-width="2.6" d="M10 9.5h.01M14 9.5h.01"/>'),
  chili: svg('<path class="t" d="M6 7.5c-1.5 6 1 12.5 11 13 1 0 1.5-1 .5-1.5C12 16.5 10 12 10 7.5H6Z"/><path d="M8 7.5c0-2 1-3.5 3-4.5"/>'),
  pancake: svg('<ellipse class="t" cx="12" cy="9.5" rx="8" ry="3"/><path d="M4 9.5v3c0 1.7 3.6 3 8 3s8-1.3 8-3v-3M4 12.5v3c0 1.7 3.6 3 8 3s8-1.3 8-3v-3"/>'),
  mango: svg('<path class="t" d="M14 6c4 0 6.5 3.5 6 7.5-.5 4.5-5 7-9.5 7-3.5 0-6.5-2-6.5-5 0-2 1.5-3 3-3.5C8.5 8.5 11 6 14 6Z"/><path d="M14 6c0-1.5.5-2.5 2-3"/>'),
  skewer: svg('<g transform="rotate(-45 12 12)"><path d="M1 12h4M9 12h1M14 12h1M19 12h4"/><rect class="t" x="5" y="8.5" width="4" height="7" rx="1.5"/><rect class="t" x="10" y="8.5" width="4" height="7" rx="1.5"/><rect class="t" x="15" y="8.5" width="4" height="7" rx="1.5"/></g>'),
  simit: svg('<path class="t" fill-rule="evenodd" d="M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17Zm0 5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>' + dots('8.2 6.6 15 5.9 18 10 17 16 10 18.4 5.6 13')),
  wrap: svg('<path class="t" d="M5 6.5c3-2.5 11-2.5 14 0L13 21h-2L5 6.5Z"/><path d="M5 6.5c2 2 12 2 14 0M7.5 11.5c2.5 1 6.5 1 9 0"/>'),
  pizza: svg('<path class="t" d="M12 21 3.5 5.5c5.5-3 11.5-3 17 0L12 21Z"/><path d="M4.8 8c4.5-2.2 9.9-2.2 14.4 0"/><circle cx="10" cy="10.8" r="1.3"/><circle cx="14" cy="13.2" r="1.3"/>'),
  croissant: svg('<path class="t" d="M3.5 15c0-4 4-8 8.5-8s8.5 4 8.5 8c-1.5 1-3 1-4 .5-1 1.5-2.7 2-4.5 2s-3.5-.5-4.5-2c-1 .5-2.5.5-4-.5Z"/><path d="M9 8c.5 2.5 1 5 .5 9M15 8c-.5 2.5-1 5-.5 9"/>'),
  tart: svg('<path class="t" d="M3.5 11h17l-2 7.5a2 2 0 0 1-2 1.5h-9a2 2 0 0 1-2-1.5L3.5 11Z"/><path d="M5 11c1.5-2 4-3 7-3s5.5 1 7 3M7.5 14.5l.5 3M12 14.5v3M16.5 14.5l-.5 3"/>'),
  taco: svg('<path class="t" d="M3 18a9 9 0 0 1 18 0H3Z"/><path d="M5 12.5c1-1 2-1 3 0s2 1 3 0 2-1 3 0 2 1 3 0 1.5-.8 2-.5"/>'),
  corn: svg('<path class="t" d="M9 5.5c1.5-2.5 4.5-2.5 6 0 1 3 1 7-1 10.5L12 19l-2-3c-2-3.5-2-7.5-1-10.5Z"/><path d="M12 4.5v13M9.3 9h5.4M9.3 12.5h5.4M12 21c-3-1-5-3-6-6M12 21c3-1 5-3 6-6"/>'),
  tamale: svg('<path class="t" d="M6 4.5h12l-2.5 15h-7L6 4.5Z"/><path d="M8.5 19.5 12 21.5l3.5-2M7.4 9h9.2"/>'),
  // ---------------------------------------------------------------- ingredients
  egg: svg('<path class="t" d="M12 3.5c3.5 0 6.5 5.5 6.5 10a6.5 6.5 0 0 1-13 0c0-4.5 3-10 6.5-10Z"/>'),
  bean: svg('<ellipse class="t" cx="8" cy="15.5" rx="3.6" ry="2.8"/><ellipse class="t" cx="16" cy="15.5" rx="3.6" ry="2.8"/><ellipse class="t" cx="12" cy="9.5" rx="3.6" ry="2.8"/>'),
  flour: svg('<path class="t" d="M7 7.5c-1.8 2.5-2.5 6-2.5 9 0 2.5 1.5 4 3.5 4h8c2 0 3.5-1.5 3.5-4 0-3-.7-6.5-2.5-9H7Z"/><path d="M7 7.5 6 4.5l3 1.2L12 4l3 1.7 3-1.2-1 3M10 14.5h4"/>'),
  rice: svg('<path class="t" d="M5 12c0-3 3-5.5 7-5.5s7 2.5 7 5.5"/><path d="M3.5 12h17a8.5 8 0 0 1-17 0ZM9 20h6"/>'),
  mixbowl: svg('<path class="t" d="M3 12h18a9 8 0 0 1-18 0Z"/><path d="M13 12l5-9"/><ellipse cx="18.5" cy="3.8" rx="1.3" ry="2" transform="rotate(30 18.5 3.8)"/>'),
  drop: svg('<path class="t" d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5Z"/>'),
  milk: svg('<path class="t" d="M7 9l2-3.5h6L17 9v11.5H7V9Z"/><path d="M9 3h6v2.5H9zM7 9h10M10 13.5h4"/>'),
  sugar: svg('<rect class="t" x="4" y="12" width="7" height="7" rx="1.2"/><rect class="t" x="13" y="12" width="7" height="7" rx="1.2"/><rect class="t" x="8.5" y="4.5" width="7" height="7" rx="1.2"/>'),
  honey: svg('<path class="t" d="M6.5 9h11v9a2.5 2.5 0 0 1-2.5 2.5H9A2.5 2.5 0 0 1 6.5 18V9Z"/><path d="M7.5 5h9v4h-9zM6.5 13h11M12 13v2.5"/>'),
  soy: svg('<path class="t" d="M7.5 10a4.5 4.5 0 0 1 9 0v9a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19v-9Z"/><path d="M9.5 6V3.5h5V6M14.5 4.5l3-1M7.5 13.5h9"/>'),
  sake: svg('<path class="t" d="M10 3h4v2c0 1.5 4 4 4 9.5 0 4-2.5 6.5-6 6.5s-6-2.5-6-6.5C6 9 10 6.5 10 5V3Z"/><path d="M6.4 13h11.2"/>'),
  sauce: svg('<path class="t" d="M5.5 10h11v8.5a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2V10Z"/><path d="M4.5 10h13M14 10l4.5-7.5"/>'),
  mayo: svg('<path class="t" d="M8 9h8l.5 10a1.5 1.5 0 0 1-1.5 1.5H9A1.5 1.5 0 0 1 7.5 19L8 9Z"/><path d="M9.5 9V6.5h5V9M12 6.5V3"/>'),
  miso: svg('<path class="t" d="M4.5 10h15l-1.3 9a2 2 0 0 1-2 1.7H7.8a2 2 0 0 1-2-1.7L4.5 10Z"/><path d="M3.5 10h17M8 10c0-2.5 2-4 4-4s4 1.5 4 4"/>'),
  paste: svg('<path class="t" d="M5 18.5c0-2.5 2-3.5 3-4 0-2.5 1.5-4 3.5-4.5 0-2 1-4.5 2.5-5.5.5 2.5 2.5 3.5 2.5 6 2 .5 2.5 2.5 2.5 4 1 .5 1.5 1.5 1.5 3 0 .5-.5 1-1 1H6a1 1 0 0 1-1-1Z"/>'),
  sprinkle: svg(dots('6 6 10 4.5 14 6.5 18 5 8 10 12 9 16 10.5 5.5 14 10 13.5 14 15 18.5 13.5 8 18 12 19 16 18.5')),
  bonito: svg('<path class="t" d="M4 15c2-4 5-6.5 9-6.5 3 0 5.5 1.5 7 4-2.5-1-5-1-7 0s-3.5 3.5-3.5 6C7 18 5 17 4 15Z"/><path d="M8 5.5c1.5-1.5 3.5-1.5 4.5 0M14.5 4c1.2-.8 2.5-.8 3.5.2"/>'),
  crumbs: svg('<circle class="t" cx="7" cy="9" r="2.2"/><circle class="t" cx="14.5" cy="6.8" r="1.7"/><circle class="t" cx="16.5" cy="14.5" r="2.4"/><circle class="t" cx="9" cy="16.5" r="1.7"/>' + dots('12 12 19.5 9.5 5 13.5 13 19.5')),
  pot: svg('<path class="t" d="M4.5 10h15v7a3.5 3.5 0 0 1-3.5 3.5H8A3.5 3.5 0 0 1 4.5 17v-7Z"/><path d="M2.5 10h19M2.5 12.5h2M19.5 12.5h2M9 3.5c0 1.5 1 1.5 1 3M13.5 3.5c0 1.5 1 1.5 1 3"/>'),
  pork: svg('<circle class="t" cx="12" cy="12" r="8"/><path d="M12 12a1.5 1.5 0 1 1 1.5 1.5 3.5 3.5 0 1 1-3.5-3.5 5 5 0 1 1 5 5"/>'),
  naruto: svg('<circle class="t" cx="12" cy="12" r="8.5"/><path d="M12 12c0-1 1.5-1 1.5 0 0 1.8-3 1.8-3 0 0-2.5 4.5-2.5 4.5 0 0 3.5-6 3.5-6 0"/>'),
  nori: svg('<rect class="t" x="4.5" y="4.5" width="15" height="15" rx="1.5"/><path d="M8 9.5c1-1 2-1 3 0M13 14.5c1-1 2-1 3 0"/>'),
  bamboo: svg('<path class="t" d="M12 2.5c3 3 5.5 8 5.5 12.5a5.5 5.5 0 0 1-11 0C6.5 10.5 9 5.5 12 2.5Z"/><path d="M7.8 12c2.2 1 6.2 1 8.4 0M6.8 16.3c2.7 1.3 7.7 1.3 10.4 0"/>'),
  leek: svg('<path class="t" d="M4.5 21 3 19.5l9-9 2.5 2.5-9 8Z"/><path d="M12 10.5 14 3.5M13.3 11.8l7.2-4.3M14.5 13l6.5-.5M3 19.5 1.8 20.7M4.5 21l-1 1"/>'),
  garlic: svg('<path class="t" d="M12 4c0 2-5.5 4.5-5.5 9.5 0 4 2.5 6.5 5.5 6.5s5.5-2.5 5.5-6.5C17.5 8.5 12 6 12 4Z"/><path d="M12 4V2.5M12 10c-1.5 2-1.8 6 0 10M12 10c1.5 2 1.8 6 0 10"/>'),
  ginger: svg('<path class="t" d="M4 15c0-2 1.5-3 3-3 .5-2 2-3 3.5-2.5C11 7.5 12.5 6.5 14 7c1-1.5 3-1.5 3.5 0 2 0 3 1.5 2.5 3-.5 2-2.5 2.5-4 2.5-1 2.5-3 4-5.5 4.5C7.5 17.5 4 17 4 15Z"/><path d="M9 13.5c1 .3 2 .2 3-.5"/>'),
  tomato: svg('<circle class="t" cx="12" cy="13.5" r="7.5"/><path d="M9 6.5l3 1.5 3-1.5M12 8V4.5"/>'),
  cheese: svg('<path class="t" d="M3 18V12.5l14-6.5 4 6.5V18H3Z"/><path d="M3 12.5h18"/><circle cx="8" cy="15.3" r="1.2"/><circle cx="15" cy="15.2" r="1.4"/>'),
  chocolate: svg('<rect class="t" x="5" y="3.5" width="14" height="17" rx="2"/><path d="M5 9.2h14M5 14.8h14M12 3.5v17"/>'),
  banana: svg('<path class="t" d="M4 15.5c4 3 10 3 14-2 2-2.5 2.5-6 2-9l-1.5-.5c-.5 4-3 7.5-6.5 9-2.5 1-5 1-7.5.5L4 15.5Z"/><path d="M19.5 4.5 19.2 2.5"/>'),
  pineapple: svg('<path class="t" d="M12 9c3.3 0 5.5 2.6 5.5 6S15.3 21 12 21s-5.5-2.6-5.5-6S8.7 9 12 9Z"/><path d="M12 9V5M12 7.5 9 3.5M12 7.5l3-4M9 12.5l6 5.5M15 12.5 9 18"/>'),
  strawberry: svg('<path class="t" d="M12 21c-4-2-7-6-7-9.5C5 9 7 7.5 9 7.5c1.2 0 2.2.4 3 1 .8-.6 1.8-1 3-1 2 0 4 1.5 4 4 0 3.5-3 7.5-7 9.5Z"/><path d="M9 4.5 12 7l3-2.5M12 7V3"/>' + dots('9.5 12 14.5 12 12 15 9.5 16.5 14.5 16.5')),
  vanilla: svg('<path d="M6 20c3-6 7-11 13-15"/><path class="t" d="M12 10.5c-.5-2.5.5-4.5 3-5.5.5 2.5-.5 4.5-3 5.5ZM10 13.5c-2.2-1.4-4.4-1.4-6 .5 2.2 1.4 4.4 1.4 6-.5Z"/>'),
};

export type EmblemName = keyof typeof E;
export type IconName = EmblemName | keyof typeof G;

/** Markup for an icon: an emblem or glyph by name, or a picture (data: URL, such as a dish render). */
export function icon(name: string): string {
  if (name.startsWith('data:')) return `<img src="${name}" alt="">`;
  const s = (E as Record<string, string>)[name] ?? (G as Record<string, string>)[name];
  if (!s && import.meta.env.DEV) console.warn(`[icons] unknown icon "${name}"`);
  return s ?? '';
}

// ---------------------------------------------------------------- flags (simplified, in their own colours)
// No <clipPath id> inside: the same markup is stamped many times on one page, and a shared id resolves to the
// first copy in the document. When that copy sat in a hidden list, every flag on the travel map came out blank.
// The rounded corners are clipped by CSS (.flag clip-path) instead, which needs no ids.
const flag = (body: string) =>
  `<svg class="flag" viewBox="0 0 30 20" preserveAspectRatio="none" aria-hidden="true">${body}<rect x=".5" y=".5" width="29" height="19" rx="2.5" fill="none" stroke="rgba(0,0,0,.16)"/></svg>`;
const stripes = (dir: 'h' | 'v', cols: string[], w = cols.map(() => 1)) => {
  const tot = w.reduce((a, b) => a + b, 0);
  let at = 0;
  return cols.map((c, i) => {
    const p = (at / tot) * (dir === 'h' ? 20 : 30), s = (w[i] / tot) * (dir === 'h' ? 20 : 30);
    at += w[i];
    return dir === 'h' ? `<rect y="${p}" width="30" height="${s + 0.02}" fill="${c}"/>` : `<rect x="${p}" width="${s + 0.02}" height="20" fill="${c}"/>`;
  }).join('');
};

export const FLAGS: Record<string, string> = {
  tokyo: flag('<rect width="30" height="20" fill="#fff"/><circle cx="15" cy="10" r="6" fill="#bc002d"/>'),
  seoul: flag('<rect width="30" height="20" fill="#fff"/><path d="M10 10a5 5 0 0 1 10 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 0-5 0Z" fill="#cd2e3a"/><path d="M10 10a5 5 0 0 0 10 0 2.5 2.5 0 0 1-5 0 2.5 2.5 0 0 0-5 0Z" fill="#0047a0"/><path d="M4 5.5l2.5-2.5M5 6.5l2.5-2.5M22.5 4l2.5 2.5M23.5 3l2.5 2.5M4 14.5 6.5 17M23.5 17l2.5-2.5M22.5 16l2.5-2.5" stroke="#111" stroke-width="1.1"/>'),
  bangkok: flag(stripes('h', ['#a51931', '#f4f5f8', '#2d2a4a', '#f4f5f8', '#a51931'], [1, 1, 2, 1, 1])),
  istanbul: flag('<rect width="30" height="20" fill="#e30a17"/><circle cx="11.5" cy="10" r="5" fill="#fff"/><circle cx="12.8" cy="10" r="4" fill="#e30a17"/><path d="m18.6 10 -2.6.9 1.6-2.2v2.7l-1.6-2.2Z" fill="#fff"/>'),
  amalfi: flag(stripes('v', ['#009246', '#fff', '#ce2b37'])),
  madeira: flag(stripes('v', ['#0b5aa8', '#ffcc00', '#0b5aa8']) + '<path d="M13 6h4v2.6h2.6v2.8H17V14h-4v-2.6h-2.6V8.6H13Z" fill="#fff" stroke="#d21034" stroke-width="1.2"/>'),
  lisbon: flag(stripes('v', ['#006600', '#ff0000'], [2, 3]) + '<circle cx="12" cy="10" r="3.6" fill="#ffcc00"/><circle cx="12" cy="10" r="2" fill="#ff0000" stroke="#fff" stroke-width=".7"/>'),
  mexico: flag(stripes('v', ['#006847', '#fff', '#ce1126']) + '<circle cx="15" cy="10" r="2.4" fill="none" stroke="#8c5a2b" stroke-width="1.2"/>'),
};
