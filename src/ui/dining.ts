import type { OrderItem } from '../game/service';
import { DINING, ORDER_MAX } from '../data/service';
import { TEXT } from '../data/cityText';
import { G } from './glyphs';
import { icon } from './emblems';

/**
 * The sheets of eating out: the menu card a waiter brings to the table, the bill, a bakery's display case and the
 * bag of things bought to eat later. They are built on the UI's panels (see UI.dineKit) and answer through callbacks.
 */

export interface DineKit {
  panel(cls: string, onClose?: () => void): HTMLElement;
  head(p: HTMLElement, title: string, jp?: string, sub?: string, icon?: string, onClose?: () => void): HTMLElement;
  close(): void;
  icons: Record<string, string>;
  play(name: 'click' | 'pop' | 'fail' | 'coin' | 'clink'): void;
  toast(ic: string, title: string, text: string): void;
  wallet(): number;
  tasted(id: string): boolean;
}

const h = (tag: string, cls = '', html = ''): HTMLElement => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const money = (n: number) => (n === 0 ? 'Free' : TEXT.money(n));

/** The picture of an item: the dish's own render, or its emblem. */
function pic(k: DineKit, it: OrderItem): string {
  const src = it.dish ? k.icons[it.id] : null;
  return src ? `<img src="${src}" alt="">` : `<span class="emo">${icon(it.icon ?? it.id)}</span>`;
}

export interface MenuOpts {
  place: string;
  local: string;
  waiter: string;
  line: string;
  items: OrderItem[];
  /** The cover charge for this place, and whether it can be sent back (the couvert). */
  cover: { name: string; local: string; price: number; text: string; optional?: boolean } | null;
  order(items: OrderItem[], cover: boolean): void;
  cancel(): void;
}

/** The menu card: tap dishes to add them to the order (one of each, up to ORDER_MAX), then order. */
export function menuCard(k: DineKit, o: MenuOpts): void {
  let sent = false;
  const p = k.panel('panel dine', () => { if (!sent) o.cancel(); });
  k.head(p, esc(o.place), esc(o.local), `${esc(DINING.menu[1])} · ${esc(o.waiter)}`, icon('waiter'), () => { if (!sent) o.cancel(); });
  const body = h('div', 'panel-body');
  body.appendChild(h('div', 'vendor-line', `<span class="ava">${esc(o.waiter.charAt(0))}</span><div class="say"><b>${esc(o.waiter)}</b>“${esc(o.line)}”</div>`));
  const card = h('div', 'menu-card');
  card.appendChild(h('div', 'mc-title', `<span>${esc(DINING.menu[1])}</span>`));
  const chosen = new Set<OrderItem>();
  let cover = !!o.cover;
  const foot = h('div', 'mc-foot');
  const sum = h('div', 'mc-sum');
  const go = h('button', 'btn btn-red btn-hero', '');
  foot.append(sum, go);
  const total = () => [...chosen].reduce((t, i) => t + i.price, 0) + (cover && o.cover ? o.cover.price : 0);
  const paint = () => {
    const n = chosen.size;
    sum.innerHTML = n ? `<b>${n} ${n === 1 ? 'thing' : 'things'}</b><span>${money(total())}${cover && o.cover ? ` · with ${esc(o.cover.name.toLowerCase())}` : ''}</span>` : `<b>Tap what you would like</b><span>up to ${ORDER_MAX}, one of each</span>`;
    go.innerHTML = `${G.check}Order`;
    go.toggleAttribute('disabled', !n);
  };
  const sections: [OrderItem['course'], [string, string]][] = [['food', DINING.sections.food], ['sweet', DINING.sections.sweet], ['drink', DINING.sections.drink]];
  for (const [course, [loc, en]] of sections) {
    const list = o.items.filter((i) => i.course === course);
    if (!list.length) continue;
    card.appendChild(h('div', 'mc-sec', `<span>${esc(loc)}</span><i></i><em>${esc(en)}</em>`));
    for (const it of list) {
      const fresh = it.dish && !k.tasted(it.id);
      const row = h('button', 'mc-item', `
        <div class="mc-pic">${pic(k, it)}</div>
        <div class="mc-txt"><b>${esc(it.name)}${it.local && it.local !== it.name ? `<span class="jp">${esc(it.local)}</span>` : ''}${fresh ? '<span class="badge red">New stamp</span>' : ''}</b>${it.text ? `<small>${esc(it.text)}</small>` : ''}</div>
        <div class="mc-price">${money(it.price)}</div>
        <div class="mc-tick">${G.check}</div>`);
      row.onclick = () => {
        if (chosen.has(it)) chosen.delete(it);
        else if (chosen.size >= ORDER_MAX) { k.play('fail'); k.toast('waiter', 'That is a feast', `A table for one takes up to ${ORDER_MAX} things at a time.`); return; }
        else chosen.add(it);
        row.classList.toggle('on', chosen.has(it));
        k.play('click');
        paint();
      };
      card.appendChild(row);
    }
  }
  if (o.cover) {
    const c = o.cover;
    const row = h(c.optional ? 'button' : 'div', 'mc-cover on', `<div class="mc-pic"><span class="emo">${icon(DINING.cover?.icon ?? 'toast')}</span></div>
      <div class="mc-txt"><b>${esc(c.name)}${c.local !== c.name.toLowerCase() ? `<span class="jp">${esc(c.local)}</span>` : ''}</b><small>${esc(c.text)}</small></div>
      <div class="mc-price">${money(c.price)}</div>${c.optional ? `<div class="mc-tick">${G.check}</div>` : ''}`);
    if (c.optional) row.onclick = () => { cover = !cover; row.classList.toggle('on', cover); k.play('click'); paint(); };
    card.appendChild(row);
  }
  card.appendChild(h('p', 'mc-note', esc(DINING.menuNote)));
  body.appendChild(card);
  p.appendChild(body);
  p.appendChild(foot);
  go.onclick = () => {
    if (!chosen.size) return;
    if (total() > k.wallet()) { k.play('fail'); k.toast('purse', 'Not enough money', 'Take something off the order, or help a vendor cook to earn tips.'); return; }
    sent = true;
    k.play('pop');
    const items = o.items.filter((i) => chosen.has(i));
    k.close();
    o.order(items, cover);
  };
  paint();
}

export interface BillOpts {
  place: string;
  items: OrderItem[];
  cover: { name: string; price: number } | null;
  pay(tip: number): void;
}

/** The bill: what was eaten, the cover, a tip as the city does it, and pay. */
export function billCard(k: DineKit, o: BillOpts): void {
  let paid = false;
  const sub = o.items.reduce((t, i) => t + i.price, 0) + (o.cover?.price ?? 0);
  const done = (tip: number) => { if (paid) return; paid = true; o.pay(tip); };
  // closing the bill without choosing pays it as it stands
  const p = k.panel('panel dine bill', () => done(0));
  k.head(p, esc(DINING.billName[1]), '', `${esc(o.place)} · ${esc(DINING.billName[0])}`, icon('receipt'), () => done(0));
  const body = h('div', 'panel-body');
  const slip = h('div', 'slip');
  slip.appendChild(h('div', 'slip-head', `<b>${esc(o.place)}</b><span>${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>`));
  for (const it of o.items) slip.appendChild(h('div', 'slip-line', `<span>${esc(it.name)}</span><i></i><span>${money(it.price)}</span>`));
  if (o.cover) slip.appendChild(h('div', 'slip-line soft', `<span>${esc(o.cover.name)}</span><i></i><span>${money(o.cover.price)}</span>`));
  const tipLine = h('div', 'slip-line soft hidden', '');
  const tot = h('div', 'slip-total', '');
  slip.append(tipLine, tot);
  body.appendChild(slip);
  let tip = 0;
  const paint = () => {
    tipLine.classList.toggle('hidden', !tip);
    tipLine.innerHTML = `<span>Tip</span><i></i><span>${money(tip)}</span>`;
    tot.innerHTML = `<span>Total</span><b>${money(sub + tip)}</b>`;
  };
  if (DINING.tips.length > 1) {
    const seg = h('div', 'seg tips');
    DINING.tips.forEach((t, i) => {
      const b = h('button', i === 0 ? 'on' : '', esc(t.label));
      b.onclick = () => { k.play('click'); tip = t.add(sub); seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); paint(); };
      seg.appendChild(b);
    });
    body.appendChild(seg);
  }
  body.appendChild(h('p', 'mc-note', `${esc(DINING.tipNote)} ${esc(DINING.payNote)}`));
  p.appendChild(body);
  const foot = h('div', 'mc-foot');
  const go = h('button', 'btn btn-red btn-hero', `${icon('purse')}Pay`);
  go.onclick = () => { done(Math.min(tip, Math.max(0, k.wallet() - sub))); k.close(); };
  foot.append(h('div', 'mc-sum', `<b>${esc(DINING.billName[1])}</b><span>${o.items.length} ${o.items.length === 1 ? 'thing' : 'things'}</span>`), go);
  p.appendChild(foot);
  paint();
}

export interface CaseOpts {
  place: string;
  local: string;
  keeper: string;
  line: string;
  items: OrderItem[];
  /** How many more the bag can take (on top of the first one, eaten now). */
  room: number;
  buy(items: OrderItem[]): void;
}

/** A display case: tap the pastries you want (several of a kind if you like); pay, and they go in a paper bag. */
export function vitrine(k: DineKit, o: CaseOpts): void {
  const p = k.panel('panel dine');
  k.head(p, esc(o.place), esc(o.local), `At the counter · ${esc(o.keeper)}`, icon('vitrine'));
  const body = h('div', 'panel-body');
  body.appendChild(h('div', 'vendor-line', `<span class="ava">${esc(o.keeper.charAt(0))}</span><div class="say"><b>${esc(o.keeper)}</b>“${esc(o.line)}”</div>`));
  const glass = h('div', 'case');
  const counts = new Map<OrderItem, number>();
  const n = () => [...counts.values()].reduce((a, b) => a + b, 0);
  const total = () => [...counts.entries()].reduce((t, [i, c]) => t + i.price * c, 0);
  const foot = h('div', 'mc-foot');
  const sum = h('div', 'mc-sum');
  const go = h('button', 'btn btn-red btn-hero', '');
  foot.append(sum, go);
  const max = o.room + 1;
  const paint = () => {
    const c = n();
    sum.innerHTML = c ? `<b>${c} in the bag</b><span>${money(total())} · the first one is for now</span>` : `<b>Point at what you want</b><span>${max > 1 ? `up to ${max}, the rest wait in your bag` : 'your bag is full: one to eat now'}</span>`;
    go.innerHTML = `${icon('purse')}Pay`;
    go.toggleAttribute('disabled', !c);
  };
  for (const it of o.items) {
    const fresh = it.dish && !k.tasted(it.id);
    const tile = h('div', 'case-tile', `<div class="ct-pic">${pic(k, it)}${fresh ? '<span class="badge red">New</span>' : ''}</div><b>${esc(it.name)}</b><span class="ct-price">${money(it.price)}</span>
      <div class="ct-step"><button class="minus" aria-label="One less">−</button><span class="ct-n">0</span><button class="plus" aria-label="One more">+</button></div>`);
    const nEl = tile.querySelector('.ct-n')!;
    const set = (v: number) => { counts.set(it, v); if (!v) counts.delete(it); nEl.textContent = String(v); tile.classList.toggle('on', v > 0); paint(); };
    tile.querySelector<HTMLButtonElement>('.plus')!.onclick = (e) => { e.stopPropagation(); if (n() >= max) { k.play('fail'); k.toast('bag', 'The bag is full', 'Eat something from it first.'); return; } k.play('click'); set((counts.get(it) ?? 0) + 1); };
    tile.querySelector<HTMLButtonElement>('.minus')!.onclick = (e) => { e.stopPropagation(); const v = counts.get(it) ?? 0; if (v) { k.play('click'); set(v - 1); } };
    tile.onclick = () => (tile.querySelector('.plus') as HTMLButtonElement).click();
    glass.appendChild(tile);
  }
  body.appendChild(glass);
  body.appendChild(h('p', 'mc-note', 'The first one is wrapped in a paper napkin to eat right away; the rest go in your bag for later. Find a bench with a view.'));
  p.appendChild(body);
  p.appendChild(foot);
  go.onclick = () => {
    const c = n();
    if (!c) return;
    if (total() > k.wallet()) { k.play('fail'); k.toast('purse', 'Not enough money', 'Put something back, or help a vendor cook to earn tips.'); return; }
    const list: OrderItem[] = [];
    for (const it of o.items) for (let i = 0; i < (counts.get(it) ?? 0); i++) list.push(it);
    k.play('coin');
    k.close();
    o.buy(list);
  };
  paint();
}

export interface BagOpts {
  items: { id: string; name: string; dish: boolean; icon?: string; city: string }[];
  seated: boolean;
  eat(i: number): void;
}

/** What is in the bag: eat one of them now (sitting down makes it a picnic). */
export function bagSheet(k: DineKit, o: BagOpts): void {
  const p = k.panel('panel dine');
  k.head(p, 'Your bag', '', o.seated ? 'A good spot for a bite' : 'Bought to eat later', G.bag);
  const body = h('div', 'panel-body');
  if (!o.items.length) body.appendChild(h('p', 'mc-note', 'Empty. Bakeries, pastry shops and gelaterias put what you buy in a paper bag: the first one is for right away, the rest come here.'));
  const list = h('div', 'bag-list');
  o.items.forEach((it, i) => {
    const src = it.dish ? k.icons[it.id] : null;
    const row = h('div', 'bag-item', `<div class="mc-pic">${src ? `<img src="${src}" alt="">` : `<span class="emo">${icon(it.icon ?? it.id)}</span>`}</div><div class="mc-txt"><b>${esc(it.name)}</b><small>${esc(it.city)}</small></div>`);
    const b = h('button', 'btn btn-soft', 'Eat');
    b.onclick = () => { k.play('pop'); k.close(); o.eat(i); };
    row.appendChild(b);
    list.appendChild(row);
  });
  body.appendChild(list);
  if (o.items.length && !o.seated) body.appendChild(h('p', 'mc-note', 'Tip: sit on a bench, a step or a café chair first. Food tastes better with a view.'));
  p.appendChild(body);
}
