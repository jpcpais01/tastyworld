import type { SaveState } from '../game/state';
import type { Audio } from '../game/audio';
import { G, svg } from './glyphs';
import { icon } from './emblems';
import { CITY, type CityId } from '../world/cityId';
import { TEXT } from '../data/cityText';
import { TIER, TRADES, SOUVENIR, haggleFloor, moneyIn, roundPrice, type Souvenir, type Trade } from '../data/souvenirs';

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const money = TEXT.money;
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

/** A shop the player has walked up to: who keeps it, what it sells today, and how to pay. */
export interface ShopVisit {
  trade: Trade;
  name: string;
  local: string;
  keeper: string;
  /** The street or hall it stands in. */
  place: string;
  line: string;
  stock: Souvenir[];
  seed: number;
  /** Take the money and put it in the bag. False when the purse is too light. */
  pay(it: Souvenir, price: number): boolean;
  /** The keeper's body language: a bow when you come and go, a shrug, a big smile on a deal. */
  react(mood: 'deal' | 'no' | 'think'): void;
}

/** What the shop view needs from the UI around it. */
export interface ShopHost {
  s: SaveState;
  audio: Audio;
  /** A panel with the sign and the head, ready for a body. */
  open(name: string, local: string, sub: string): HTMLElement;
  close(): void;
  toast(icon: string, title: string, text: string, gold?: boolean): void;
  /** Icons (data URLs) for these souvenirs, rendered on demand. */
  icons(items: Souvenir[]): Record<string, string>;
}

const NO_MONEY = 'Help a vendor cook to earn tips, or finish missions in your passport.';

/** Lines a bazaar keeper says while the price comes down (and when it will not). */
const HAGGLE = {
  open: ['For you, my friend, special price.', 'This one? Ah, you have a good eye. It is my favourite.', 'Please, sit. Tea is coming. Now, tell me what you think it is worth.', 'Everybody wants this one. I will be sad to see it go.'],
  counter: ['Ahh, {o}? You are killing me. {c}, and only because I like your face.', '{o}... my children will eat bread and water tonight. {c}.', 'Hm. Let us meet in the middle, like brothers. {c}.', 'You drive a hard bargain. {c}, final. Almost final.'],
  insult: ['{o}?! For that I cannot even buy the string it hangs on.', 'Please. I am serious man. Give me a serious price.', 'You are joking with me. I like jokes. Not this one.'],
  deal: ['Tamam, tamam! {p}. You win. Do not tell my wife.', 'Anlaştık, we agree! {p}. A good price for both of us.', 'Deal! You bargain like a local. {p}.', 'Hayırlı olsun, may it bring you joy. {p}.'],
  last: ['{c}. That is my last word. I swear on my mother.', 'No more, my friend. {c} or nothing.'],
  back: ['Wait, wait! Come back! {c}, my last price, only for you.', 'Where are you going? Okay, okay. {c}. Because it is you.'],
  pay: ['A man of honour pays the first price. God bless you.', 'Very good! You are my favourite customer today.'],
};
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w)\}/g, (_m, k) => v[k] ?? '');

/** The shelf, the close look at one piece, the haggle and the hand-over. */
export class ShopView {
  private body!: HTMLElement;
  private recalled = new Set<string>();
  constructor(private host: ShopHost, private v: ShopVisit) {}

  show(): void {
    const t = this.v.trade;
    const p = this.host.open(this.v.name, this.v.local, `${esc(t.label)} · ${esc(this.v.keeper)} · ${esc(this.v.place)}`);
    p.classList.add('sv-shop');
    this.body = h('div', 'panel-body');
    p.appendChild(this.body);
    this.shelf(this.v.line);
  }

  private owned(id: string) { return this.host.s.souvenirs[id] !== undefined; }

  private say(line: string): string {
    return `<div class="vendor-line"><span class="ava">${esc(this.v.keeper.replace(/^(Mrs?\.|Ms\.|Old|Dona|Senhor|Signora|Don) /, '').charAt(0))}</span><div class="say"><b>${esc(this.v.keeper)}</b>“${esc(line)}”</div></div>`;
  }

  // ------------------------------------------------------------------------------------- the shelf
  shelf(line: string): void {
    const { trade, stock } = this.v;
    const icons = this.host.icons(stock);
    const have = trade.items.filter((it) => this.owned(it.id)).length;
    this.body.innerHTML = this.say(line);
    const note = h('div', 'sv-note', `${trade.haggle ? `<span class="sv-chip haggle">${G.coin}Prices are for haggling</span>` : ''}<span class="sv-chip">${G.bag}${have} of ${trade.items.length} from this trade in your bag</span>`);
    this.body.appendChild(note);
    const grid = h('div', 'sv-grid');
    const sorted = [...stock].sort((a, b) => TIER[a.tier].rank - TIER[b.tier].rank || a.price - b.price);
    for (const it of sorted) {
      const got = this.owned(it.id);
      const tile = h('button', `sv-tile t-${it.tier}${got ? ' got' : ''}`, `
        <div class="sv-img">${icons[it.id] ? `<img src="${icons[it.id]}" alt="">` : ''}${got ? `<span class="badge">${G.check}Yours</span>` : it.tier === 'treasure' ? '<span class="badge gold">Only one</span>' : it.tier === 'rare' ? '<span class="badge red">Rare</span>' : ''}</div>
        <div class="sv-name">${esc(it.name)}</div>
        <div class="sv-price">${got ? 'In your bag' : money(it.price)}</div>`);
      tile.onclick = () => { this.host.audio.play('click'); this.detail(it); };
      grid.appendChild(tile);
    }
    this.body.appendChild(grid);
    const missing = trade.items.filter((it) => !stock.includes(it) && !this.owned(it.id));
    if (missing.length) this.body.appendChild(h('p', 'fine', `Not every ${esc(trade.label.toLowerCase())} has the same pieces. ${missing.length === 1 ? 'One more is' : `${missing.length} more are`} on the shelves of another ${esc(trade.label.toLowerCase())} in town.`));
  }

  // ------------------------------------------------------------------------------------- one piece, up close
  private card(it: Souvenir, extra = ''): HTMLElement {
    const icons = this.host.icons([it]);
    return h('div', `sv-detail t-${it.tier}`, `
      <div class="sv-stage">${icons[it.id] ? `<img src="${icons[it.id]}" alt="">` : ''}</div>
      <div class="sv-info">
        <span class="sv-tier">${TIER[it.tier].name}</span>
        <h3>${esc(it.name)}${it.local && it.local !== it.name ? `<span class="jp">${esc(it.local)}</span>` : ''}</h3>
        <p>${esc(it.text)}</p>
        ${extra}
      </div>`);
  }

  detail(it: Souvenir): void {
    const got = this.owned(it.id);
    this.body.innerHTML = '';
    this.body.appendChild(this.backBtn(() => this.shelf(pick(this.v.trade.lines))));
    this.body.appendChild(this.card(it, `<div class="sv-ask">${got ? `${G.check}In your bag, bought for ${money(this.host.s.souvenirs[it.id])}` : `${this.v.trade.haggle ? 'Asking' : 'Price'} <b>${money(it.price)}</b>`}</div>`));
    if (got) return;
    const row = h('div', 'sv-actions');
    const buy = h('button', 'btn btn-red', `${G.bag}${this.v.trade.haggle ? `Pay ${money(it.price)}` : `Buy · ${money(it.price)}`}`);
    buy.onclick = () => this.buy(it, it.price, this.v.trade.haggle ? pick(HAGGLE.pay) : '');
    row.appendChild(buy);
    if (this.v.trade.haggle) {
      const hg = h('button', 'btn btn-soft', `${icon('chat')}Haggle`);
      hg.onclick = () => { this.host.audio.play('pop'); this.haggle(it); };
      row.appendChild(hg);
    }
    this.body.appendChild(row);
  }

  private backBtn(go: () => void): HTMLElement {
    const b = h('button', 'sv-back', `${G.back}Back to the shelf`);
    b.onclick = () => { this.host.audio.play('click'); go(); };
    return b;
  }

  // ------------------------------------------------------------------------------------- pazarlık
  private haggle(it: Souvenir): void {
    const city = CITY;
    const ask = it.price;
    const floor = roundPrice(city, ask * haggleFloor(it.id, this.v.seed));
    let cur = ask;
    let patience = 3;
    let offer = roundPrice(city, ask * 0.6);
    const stepOf = () => Math.max(roundPrice(city, ask * 0.05), roundPrice(city, 1));
    let final = false;
    this.v.react('think');
    const render = (line: string, mood: 'open' | 'counter' | 'no' | 'last') => {
      this.body.innerHTML = '';
      this.body.appendChild(this.backBtn(() => this.detail(it)));
      this.body.appendChild(this.card(it, `<div class="sv-ask">Asking <s>${money(ask)}</s> now <b>${money(cur)}</b></div>`));
      const talk = h('div', `sv-haggle m-${mood}`);
      talk.innerHTML = this.say(line) + `<div class="sv-patience" aria-label="Patience">${[0, 1, 2].map((i) => `<i class="${i < patience ? 'on' : ''}"></i>`).join('')}<span>${patience > 1 ? 'Enjoying this' : patience === 1 ? 'Losing patience' : 'Done talking'}</span></div>`;
      if (!final) {
        const ctl = h('div', 'sv-offer', `<button class="btn btn-soft sv-step" data-d="-1" aria-label="Lower">${svg('<path d="M5 12h14"/>')}</button><div class="sv-val"><small>Your offer</small><b></b><small class="pc"></small></div><button class="btn btn-soft sv-step" data-d="1" aria-label="Raise">${G.plus}</button>`);
        const val = ctl.querySelector('b')!, pc = ctl.querySelector('.pc')!;
        const paint = () => { val.textContent = money(offer); pc.textContent = `${Math.round((offer / ask) * 100)}% of the first price`; };
        paint();
        ctl.querySelectorAll<HTMLButtonElement>('.sv-step').forEach((b) => {
          b.onclick = () => {
            this.host.audio.play('click');
            offer = Math.max(roundPrice(city, ask * 0.3), Math.min(cur, offer + Number(b.dataset.d) * stepOf()));
            paint();
          };
        });
        talk.appendChild(ctl);
      }
      const row = h('div', 'sv-actions');
      if (!final) {
        const go = h('button', 'btn btn-red', `${icon('chat')}Offer`);
        go.onclick = () => make();
        row.appendChild(go);
      }
      const take = h('button', final ? 'btn btn-red' : 'btn btn-soft', `${G.check}Deal at ${money(cur)}`);
      take.onclick = () => this.buy(it, cur, fill(pick(HAGGLE.deal), { p: money(cur) }), ask);
      row.appendChild(take);
      const leave = h('button', 'btn btn-soft', `${G.walk}Walk away`);
      leave.onclick = () => walk();
      row.appendChild(leave);
      talk.appendChild(row);
      this.body.appendChild(talk);
    };
    const make = () => {
      const o = offer, v = { o: money(o) };
      if (o >= cur || o >= floor) { cur = Math.min(cur, o); this.buy(it, cur, fill(pick(HAGGLE.deal), { p: money(cur) }), ask); return; }
      if (o < ask * 0.5) {
        patience -= 2;
        this.host.audio.play('fail');
        this.v.react('no');
      } else {
        patience -= 1;
        this.host.audio.play('pop');
        this.v.react('think');
        cur = Math.max(floor, roundPrice(city, (cur + o) / 2 + ask * 0.03));
      }
      if (patience <= 0) {
        final = true;
        cur = Math.max(floor, roundPrice(city, floor * 1.06));
        render(fill(pick(HAGGLE.last), { c: money(cur) }), 'last');
        return;
      }
      offer = Math.min(offer, cur);
      render(o < ask * 0.5 ? fill(pick(HAGGLE.insult), v) : fill(pick(HAGGLE.counter), { ...v, c: money(cur) }), o < ask * 0.5 ? 'no' : 'counter');
    };
    const walk = () => {
      this.host.audio.play('click');
      if (!this.recalled.has(it.id) && cur > floor) {
        // the oldest move in the bazaar: you turn to go, and the price follows you out of the door
        this.recalled.add(it.id);
        cur = floor;
        final = true;
        this.v.react('think');
        render(fill(pick(HAGGLE.back), { c: money(cur) }), 'last');
        return;
      }
      this.shelf(pick(['Come back any time. The tea is always hot.', 'Okay, okay. Look around. You will come back, I know it.']));
    };
    render(pick(HAGGLE.open), 'open');
  }

  // ------------------------------------------------------------------------------------- the hand-over
  private buy(it: Souvenir, price: number, line: string, ask?: number): void {
    if (!this.v.pay(it, price)) {
      this.host.audio.play('fail');
      this.host.toast('purse', 'Not enough money', `${it.name} is ${money(price)}. ${NO_MONEY}`);
      return;
    }
    this.v.react('deal');
    this.host.audio.play(it.tier === 'treasure' || it.tier === 'rare' ? 'chime' : 'coin');
    setTimeout(() => this.host.audio.play('rustle'), 380);
    this.body.innerHTML = '';
    const saved = ask && ask > price ? `<div class="sv-ask">${G.check}You paid <b>${money(price)}</b>, ${Math.round((1 - price / ask) * 100)}% off the first price</div>` : `<div class="sv-ask">${G.check}Paid <b>${money(price)}</b></div>`;
    const card = this.card(it, saved);
    card.classList.add('bought');
    card.querySelector('.sv-stage')!.insertAdjacentHTML('beforeend', `<span class="sv-stamp">${it.tier === 'treasure' ? 'Treasure' : 'Yours'}</span>`);
    this.body.appendChild(card);
    this.body.insertAdjacentHTML('afterbegin', this.say(line || pick(['Thank you! Enjoy it.', 'A very good choice.', 'It will look wonderful at home.'])));
    this.body.appendChild(h('p', 'sv-wrap', `${esc(this.v.keeper)} hands it over ${esc(this.v.trade.wrap)}.`));
    const row = h('div', 'sv-actions');
    const more = h('button', 'btn btn-soft', `${G.grid}Keep browsing`);
    more.onclick = () => { this.host.audio.play('click'); this.shelf(pick(this.v.trade.lines)); };
    const done = h('button', 'btn btn-red', `${G.check}Done`);
    done.onclick = () => { this.host.audio.play('click'); this.host.close(); };
    row.append(more, done);
    this.body.appendChild(row);
  }
}

// ------------------------------------------------------------------------------------------- the souvenir shelf at home
const FLAG: Record<CityId, string> = { tokyo: '', amalfi: 'it', istanbul: 'tr', madeira: 'pt', neo: '' };
const NAME: Record<CityId, string> = { tokyo: 'Tokyo', amalfi: 'Amalfi', istanbul: 'Istanbul', madeira: 'Madeira', neo: 'Halcyon' };

/** The bag's souvenir pages: what came home from each city, and how much is still out there. */
export function souvenirPages(host: ShopHost, page: HTMLElement, rerender: () => void): void {
  const s = host.s;
  const cities = (Object.keys(TRADES) as CityId[]).sort((a, b) => (a === CITY ? -1 : b === CITY ? 1 : 0));
  const wrap = h('div', 'sec sv-bag', `<h4>Souvenirs</h4>`);
  let any = false;
  for (const city of cities) {
    const all = TRADES[city].flatMap((t) => t.items);
    const got = all.filter((it) => s.souvenirs[it.id] !== undefined);
    if (!got.length && city !== CITY) continue;
    any = true;
    const rare = all.filter((it) => it.tier === 'rare' || it.tier === 'treasure');
    const rareGot = rare.filter((it) => s.souvenirs[it.id] !== undefined).length;
    const block = h('div', 'sv-city', `<div class="pp-cover"><div class="pp-flag${FLAG[city] ? ` ${FLAG[city]}` : ''}"><i></i></div><div><b>${NAME[city]}</b><p>${got.length ? `${rareGot} of ${rare.length} rare pieces found.` : city === CITY ? 'Nothing yet. The shops are full of things to take home.' : ''}</p><div class="pbar"><span><i style="width:${(got.length / all.length) * 100}%"></i></span>${got.length}/${all.length}</div></div></div>`);
    if (got.length) {
      const icons = host.icons(got);
      const grid = h('div', 'sv-grid small');
      for (const it of got.sort((a, b) => TIER[b.tier].rank - TIER[a.tier].rank)) {
        const tile = h('button', `sv-tile t-${it.tier} got`, `<div class="sv-img">${icons[it.id] ? `<img src="${icons[it.id]}" alt="">` : ''}</div><div class="sv-name">${esc(it.name)}</div>`);
        tile.onclick = () => { host.audio.play('click'); showPiece(host, page, it, rerender); };
        grid.appendChild(tile);
      }
      block.appendChild(grid);
    }
    wrap.appendChild(block);
  }
  if (any) page.appendChild(wrap);
}

function showPiece(host: ShopHost, page: HTMLElement, it: Souvenir, rerender: () => void): void {
  const icons = host.icons([it]);
  const tr = TRADES[it.city].find((t) => t.id === it.trade);
  page.innerHTML = '';
  const b = h('button', 'sv-back', `${G.back}Back to the bag`);
  b.onclick = () => { host.audio.play('click'); rerender(); };
  page.appendChild(b);
  page.appendChild(h('div', `sv-detail t-${it.tier}`, `
    <div class="sv-stage">${icons[it.id] ? `<img src="${icons[it.id]}" alt="">` : ''}</div>
    <div class="sv-info">
      <span class="sv-tier">${TIER[it.tier].name}</span>
      <h3>${esc(it.name)}${it.local && it.local !== it.name ? `<span class="jp">${esc(it.local)}</span>` : ''}</h3>
      <p>${esc(it.text)}</p>
      <div class="sv-ask">From a ${esc((tr?.label ?? 'shop').toLowerCase())} in ${NAME[it.city]} · paid ${moneyIn(it.city, host.s.souvenirs[it.id] ?? it.price)}</div>
    </div>`));
}

/** Every souvenir id in the save that still exists (old saves, renamed pieces). */
export const knownSouvenirs = (s: SaveState) => Object.keys(s.souvenirs).filter((id) => SOUVENIR[id]);
