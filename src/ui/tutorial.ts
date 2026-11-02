import { icon, type IconName } from './emblems';
import { G } from './glyphs';

/**
 * The tutorial notebook (Settings > Game > Tutorial): a few flippable pages, each a small drawing made of the
 * game's own emblems, a one-line summary and the handful of things to know. Tasty World and 2040 each get their
 * own notebook; both are plain data so a new feature is one line here.
 */
export interface NotebookPage {
  title: string;
  /** The drawing: one big emblem and two small ones beside it. */
  art: [IconName, IconName, IconName];
  lead: string;
  /** Up to four points, each with its own little icon. Text may hold <kbd> keys. */
  items: [IconName, string][];
}

const k = (...keys: string[]) => keys.map((x) => `<kbd>${x}</kbd>`).join('');

const TASTY: NotebookPage[] = [
  {
    title: 'Getting around',
    art: ['walk', 'compass', 'eye'],
    lead: 'Wander the streets on foot. Every corner hides something to eat.',
    items: [
      ['walk', `Walk with ${k('WASD')} or tap where you want to go. On touch, drag to steer.`],
      ['pace2', `${k('Shift')} or the pace button cycles slow, normal and fast.`],
      ['rotL', `${k('Q')}${k('E')} turn the view. Scroll or pinch to zoom.`],
      ['eye', `${k('V')} walks in first person, to see the city at eye level.`],
    ],
  },
  {
    title: 'Eat everything',
    art: ['ramen', 'stall', 'chopsticks'],
    lead: 'Stalls, restaurants, bakeries and cafés line every street, each with its own menu.',
    items: [
      ['chat', `Walk up and press ${k('Space')} or tap to see the menu and order.`],
      ['chef', 'Help a vendor cook a dish to earn tips and stars.'],
      ['purse', 'Prices are real and paid in the local money. Watch your wallet.'],
      ['lantern', 'Every city keeps one hidden restaurant. Ask around.'],
    ],
  },
  {
    title: 'Sit down and stay',
    art: ['waiter', 'terrace', 'receipt'],
    lead: 'Take your food to a seat, or let a waiter look after you.',
    items: [
      ['seat', 'Benches, counters and terrace tables all take a seat.'],
      ['waiter', 'In restaurants a waiter brings the menu, then the bill.'],
      ['vitrine', 'Bakeries show their goods in a glass case. Point and pick.'],
      ['bag', `Snacks to go ride in your paper bag. ${k('B')} opens it.`],
    ],
  },
  {
    title: 'Food passport',
    art: ['passport', 'medal', 'star'],
    lead: 'Every new dish earns a stamp, a note on what it is, and a story.',
    items: [
      ['passport', `${k('P')} opens the passport: stamps, dishes and city notes.`],
      ['scroll', 'Missions give small goals, with money and treats as rewards.'],
      ['bookmark', 'Etiquette and words to know for every city live here too.'],
      ['trophy', 'Fill a city\'s pages to finish its passport.'],
    ],
  },
  {
    title: 'Map and pins',
    art: ['map', 'pin', 'compass'],
    lead: 'The pocket map shows every street, and a pin at every door that serves food.',
    items: [
      ['map', `${k('M')} or the compass opens the city map.`],
      ['pin', 'Tap a pin to set it as your goal. The compass points the way.'],
      ['target', 'The counter shows how many food places you have found.'],
      ['skyline', 'Landmarks, hotels and shops are marked too.'],
    ],
  },
  {
    title: 'Shops and souvenirs',
    art: ['daruma', 'chime', 'purse'],
    lead: 'Local shops sell everything from cheap trinkets to rare pieces.',
    items: [
      ['daruma', 'Browse the shelf, look closely, then buy what you love.'],
      ['chat', 'In some markets the price is only the start. Haggle.'],
      ['bookmark', 'What you buy goes on the souvenir shelf in your passport.'],
      ['headband', 'Some souvenirs can be worn while you walk.'],
    ],
  },
  {
    title: 'Hotels',
    art: ['bed', 'key', 'bell'],
    lead: 'Every city has hotels, from capsules to grand rooms with a view.',
    items: [
      ['bell', 'Ask at the front desk and pick a room you can afford.'],
      ['key', 'Your key opens your room. Take the lift or the stairs up.'],
      ['moon', 'Sleep in your bed to skip the night and wake at sunrise.'],
      ['sunrise', 'A good view from the window is part of the price.'],
    ],
  },
  {
    title: 'Photo mode',
    art: ['camera', 'image', 'focus'],
    lead: 'Stop and frame the moment. Your shots go into an album.',
    items: [
      ['camera', `${k('C')} or the camera button opens photo mode.`],
      ['focus', 'Orbit, zoom, tilt-shift and time of day are all yours to set.'],
      ['image', 'The album keeps your best photos. Share them from there.'],
    ],
  },
  {
    title: 'Travel the world',
    art: ['globe', 'plane', 'suitcase'],
    lead: 'Tokyo, Amalfi, Istanbul and Madeira, each with its own food, music and streets.',
    items: [
      ['depart', 'The end trip button sums up your visit: dishes, stamps, money.'],
      ['globe', 'Spin the globe and pick the next city.'],
      ['plane', 'Fly over the world and land somewhere new.'],
      ['coin', 'Money changes into each city\'s own currency.'],
    ],
  },
  {
    title: 'Travel together',
    art: ['people', 'heart', 'hands'],
    lead: 'Invite someone on your trip as a Friend or a Lover.',
    items: [
      ['ticket', 'The boarding pass makes an invite. Change Friend or Lover any time.'],
      ['wave', `${k('G')} waves to your friends.`],
      ['hands', `On a couple's trip, ${k('H')} holds hands. Whoever walks leads.`],
      ['bed', 'Share a hotel room and sleep side by side until morning.'],
    ],
  },
  {
    title: 'Make it yours',
    art: ['gear', 'sunset', 'music'],
    lead: 'The settings tune the city to your taste and your device.',
    items: [
      ['monitor', 'Quality and view distance. Auto picks for your device.'],
      ['sunset', 'Hold your favourite hour, or let the day cycle.'],
      ['music', 'Every city has its own songs, by day and by night.'],
      ['sparkle', 'What\'s new lists every update.'],
    ],
  },
];

const NEO_PAGES: NotebookPage[] = [
  {
    title: 'Halcyon City, 2040',
    art: ['skyline', 'walk', 'eye'],
    lead: 'A rain-soaked city of towers, canals and neon. You start with a body, a name and not much else.',
    items: [
      ['walk', `Walk with ${k('WASD')} or tap where you want to go. On touch, drag to steer.`],
      ['pace2', `${k('Shift')} cycles pace. ${k('Q')}${k('E')} turn the view.`],
      ['eye', `${k('V')} walks in first person, under the neon.`],
      ['person', `${k('L')} opens your life: needs, work, home and secrets.`],
    ],
  },
  {
    title: 'Stay alive',
    art: ['heart', 'ramen', 'moon'],
    lead: 'Health, hunger and sleep run down as you live. Look after all three.',
    items: [
      ['bowl', 'Eat at noodle bars, food stalls or from a vending machine.'],
      ['moon', 'Sleep at home to get your strength back.'],
      ['plaster', 'Street clinics patch you up when health runs low.'],
      ['fire', 'Let hunger or sleep hit zero and you pass out, and pay for it.'],
    ],
  },
  {
    title: 'Work for credits',
    art: ['signal', 'backpack', 'coin'],
    lead: 'Gig boards hand out shifts. Every job pays in credits.',
    items: [
      ['backpack', 'Food courier: pick up an order, rush it to the door.'],
      ['suitcase', 'Dock shift: haul crates from the crane to the cold store.'],
      ['knife', 'Kitchen shift: cook tickets at a stall.'],
      ['signal', 'Data jacks and holo-flyers for the quick and the curious.'],
    ],
  },
  {
    title: 'A place to live',
    art: ['home', 'key', 'bed'],
    lead: 'Lettings agents rent out flats by the day, or sell them outright.',
    items: [
      ['key', 'Rent a flat or save up and buy one to own.'],
      ['bed', 'Your bed is where you sleep through the night.'],
      ['pot', 'Stock the fridge and cook your own meals at home.'],
      ['lift', 'Take the lift to any floor. Some floors hide things.'],
    ],
  },
  {
    title: 'Look the part',
    art: ['coat', 'headband', 'plaster'],
    lead: 'Boutiques sell street, thrift, tech and corporate wear. Clinics sell chrome.',
    items: [
      ['coat', 'Try on clothes and keep what you buy in your wardrobe.'],
      ['person', 'Change your outfit from the life panel.'],
      ['plaster', 'Clinics fit implants, visors, masks and tattoos.'],
    ],
  },
  {
    title: 'Bars and nights out',
    art: ['beer', 'music', 'can'],
    lead: 'Bars, noodle counters and vending machines keep the city fed after dark.',
    items: [
      ['beer', 'Bars pour drinks late into the night.'],
      ['can', 'Vending machines are cheap. Some are generous.'],
      ['passport', `${k('P')} keeps every dish and drink you try.`],
      ['map', `${k('M')} opens the map with a pin at every door.`],
    ],
  },
  {
    title: 'Quests and secrets',
    art: ['lock', 'flower', 'cat'],
    lead: 'People talk. Listen, and the city opens up.',
    items: [
      ['lock', 'Something is kept on the top floor of Helix Dynamics.'],
      ['flower', 'The Greenhouse keeps old seeds. Grow them to the table.'],
      ['cat', 'Feed a stray and it may follow you home.'],
      ['star', 'Secrets found are listed in your life panel.'],
    ],
  },
  {
    title: 'The living city',
    art: ['drop', 'signal', 'sparkle'],
    lead: 'Rain, sky traffic, patrol drones and a hologram that never sleeps.',
    items: [
      ['drop', 'When it rains, people open umbrellas and streets shine.'],
      ['signal', 'Patrol drones sweep the streets with searchlights at night.'],
      ['sparkle', 'Watch the Halo over the crossing, especially at midnight.'],
    ],
  },
  {
    title: 'Photos and friends',
    art: ['camera', 'people', 'hands'],
    lead: 'Frame the neon, or bring someone along.',
    items: [
      ['camera', `${k('C')} opens photo mode. Shots go into your album.`],
      ['ticket', 'Invite a Friend or a Lover to play with you.'],
      ['hands', `${k('G')} waves, ${k('H')} holds hands with your partner.`],
      ['home', 'Your home opens to your partner too.'],
    ],
  },
];

/** The notebook for the game being played. */
export function notebookPages(neo: boolean): NotebookPage[] {
  return neo ? NEO_PAGES : TASTY;
}

/** An icon missing from the set falls back to a glyph, so a page never draws blank. */
const art = (name: IconName) => icon(name) || G.sparkle;

export interface NotebookHost { play: (n: 'click' | 'rustle') => void }

/**
 * Builds the notebook into `p` (a panel already holding its head). Pages share one grid cell so the book is as tall
 * as its tallest page and never jumps or scrolls while flipping. Returns a teardown for the key listener.
 */
export function notebook(p: HTMLElement, pages: NotebookPage[], host: NotebookHost, start = 0, onPage?: (i: number) => void): () => void {
  const book = document.createElement('div');
  book.className = 'panel-body nb';
  const sheet = document.createElement('div');
  sheet.className = 'nb-book';
  sheet.innerHTML = '<div class="nb-rings" aria-hidden="true"></div>';
  const stack = document.createElement('div');
  stack.className = 'nb-pages';
  sheet.appendChild(stack);
  const els = pages.map((pg, i) => {
    const el = document.createElement('section');
    el.className = 'nb-page';
    el.setAttribute('aria-label', `Page ${i + 1} of ${pages.length}: ${pg.title}`);
    el.innerHTML = `
      <div class="nb-art" aria-hidden="true"><i class="a0">${art(pg.art[0])}</i><i class="a1">${art(pg.art[1])}</i><i class="a2">${art(pg.art[2])}</i></div>
      <div class="nb-text">
        <h3><span class="nb-no">${i + 1}</span>${pg.title}</h3>
        <p class="nb-lead">${pg.lead}</p>
        <ul>${pg.items.map(([ic, t]) => `<li><i>${art(ic)}</i><span>${t}</span></li>`).join('')}</ul>
      </div>`;
    stack.appendChild(el);
    return el;
  });
  book.appendChild(sheet);

  const nav = document.createElement('div');
  nav.className = 'nb-nav';
  const prev = document.createElement('button');
  prev.className = 'btn btn-soft nb-prev';
  prev.setAttribute('aria-label', 'Previous page');
  prev.innerHTML = `<span class="flip">${G.arrow}</span>`;
  const next = document.createElement('button');
  next.className = 'btn btn-soft nb-next';
  next.setAttribute('aria-label', 'Next page');
  next.innerHTML = G.arrow;
  const dots = document.createElement('div');
  dots.className = 'nb-dots';
  const dotEls = pages.map((pg, i) => {
    const d = document.createElement('button');
    d.setAttribute('aria-label', `Page ${i + 1}: ${pg.title}`);
    d.onclick = () => go(i);
    dots.appendChild(d);
    return d;
  });
  nav.append(prev, dots, next);
  book.appendChild(nav);
  p.appendChild(book);

  let at = -1;
  const go = (i: number) => {
    i = Math.max(0, Math.min(pages.length - 1, i));
    if (i === at) return;
    const fwd = i > at;
    if (at >= 0) {
      host.play('rustle');
      const out = els[at];
      out.className = `nb-page out ${fwd ? 'fwd' : 'back'}`;
    }
    els[i].className = `nb-page on${at >= 0 ? (fwd ? ' fwd' : ' back') : ''}`;
    at = i;
    dotEls.forEach((d, j) => d.classList.toggle('on', j === i));
    prev.disabled = i === 0;
    next.disabled = i === pages.length - 1;
    onPage?.(i);
  };
  prev.onclick = () => go(at - 1);
  next.onclick = () => go(at + 1);

  // swipe sideways to turn a page
  let sx = 0, sy = 0, down = false;
  sheet.addEventListener('pointerdown', (e) => { down = true; sx = e.clientX; sy = e.clientY; });
  sheet.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.4) go(at + (dx < 0 ? 1 : -1));
  });
  sheet.addEventListener('pointercancel', () => { down = false; });

  // arrow keys turn pages; caught before the game sees them so the player does not walk off
  const key = (e: KeyboardEvent) => {
    if (e.code !== 'ArrowLeft' && e.code !== 'ArrowRight') return;
    e.preventDefault();
    e.stopImmediatePropagation();
    go(at + (e.code === 'ArrowRight' ? 1 : -1));
  };
  window.addEventListener('keydown', key, true);
  go(start);
  return () => window.removeEventListener('keydown', key, true);
}
