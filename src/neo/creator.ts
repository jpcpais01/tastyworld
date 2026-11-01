import type { Look } from '../world/characters';
import { G } from '../ui/glyphs';

/**
 * 2040's character creator: a side panel over the city while the camera holds a close-up of the body being made.
 * Every change rebuilds the player at once (hooks.preview), so what you pick is what you see.
 */

const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Twelve skin tones, pale to deep, warm and cool. */
export const SKIN_TONES = [0xfbe3cf, 0xf6d2b4, 0xf0c8a8, 0xeec39f, 0xe6b58e, 0xe0ac86, 0xd09a72, 0xc98f6a, 0xb07a55, 0xa8714f, 0x8a5a3c, 0x6a4630];
const HAIR_NATURAL = [0x16161c, 0x2a1d17, 0x3b2a20, 0x5a3b26, 0x8a5a36, 0xb8763a, 0xd9b26a, 0x6b6b70, 0xb9b6b0, 0xf2efe7];
const HAIR_DYED = [0xff5fb4, 0x2ad8ff, 0xa47bff, 0x7dffa8, 0xffdc5a, 0xd8282e, 0xff9a4a, 0x3a6aff];
const CLOTH = [0x16161c, 0x1e1e26, 0x2a2a34, 0x2b3346, 0x1a2a4a, 0x3a2a3a, 0x8a1a2a, 0x4a3a2a, 0x2a4a3a, 0x5a5a62, 0xd8d8dc, 0xf2efe7, 0xf2c74a, 0xd9534a, 0x3f6e9a, 0x6a3a7a];
const NEON = [0x2ad8ff, 0xff5fb4, 0xa47bff, 0xffdc5a, 0x7dffa8, 0xff9a4a, 0xf2efe7, 0xd8282e, 0x16161c];

type Opt<T> = { label: string; value: T };
const HAIR_STYLES: Opt<Look['hairStyle']>[] = [
  { label: 'Crop', value: 'short' }, { label: 'Bob', value: 'bob' }, { label: 'Bun', value: 'bun' }, { label: 'Long', value: 'long' },
  { label: 'Spikes', value: 'spiky' }, { label: 'Tail', value: 'ponytail' }, { label: 'Shaved', value: 'bald' },
];
const TOPS: Opt<Look['topStyle']>[] = [
  { label: 'Street jacket', value: 'jacket' }, { label: 'Tee', value: 'tee' }, { label: 'Corp suit', value: 'suit' }, { label: 'Utility vest', value: 'vest' },
  { label: 'Long knit', value: 'cardigan' }, { label: 'Work apron', value: 'apron' }, { label: 'Happi coat', value: 'happi' },
];
const HATS: Opt<NonNullable<Look['hat']>>[] = [
  { label: 'None', value: 'none' }, { label: 'Cap', value: 'cap' }, { label: 'Beanie', value: 'beanie' }, { label: 'Bucket', value: 'bucket' },
  { label: 'Headband', value: 'headband' }, { label: 'Hood scarf', value: 'scarf' },
];
const LEGS: Opt<'trousers' | 'shorts' | 'skirt'>[] = [{ label: 'Trousers', value: 'trousers' }, { label: 'Shorts', value: 'shorts' }, { label: 'Skirt', value: 'skirt' }];

/** Starting archetypes: a full look in one tap, then tweak. */
export const ARCHETYPES: { id: string; name: string; text: string; look: Look }[] = [
  { id: 'runner', name: 'Netrunner', text: 'Lives on cold noodles and borrowed bandwidth.', look: { skin: 0xeec39f, hair: 0x2ad8ff, hairStyle: 'bob', top: 0x16161c, topStyle: 'jacket', accent: 0x2ad8ff, bottom: 0x1e1e26, shoes: 0x16161c, hat: 'none', glasses: true } },
  { id: 'courier', name: 'Courier', text: 'Knows every shortcut between the Stacks and the Spire.', look: { skin: 0xa8714f, hair: 0x16161c, hairStyle: 'short', top: 0xf2c74a, topStyle: 'vest', accent: 0x16161c, bottom: 0x2a2a34, shoes: 0xf2efe7, hat: 'cap', hatColor: 0x16161c, backpack: 0xff9a4a } },
  { id: 'corpo', name: 'Corpo', text: 'Helix badge, good shoes, bad conscience.', look: { skin: 0xf6d2b4, hair: 0x3b2a20, hairStyle: 'short', top: 0x2a2a34, topStyle: 'suit', accent: 0xf2efe7, bottom: 0x2a2a34, shoes: 0x16161c, hat: 'none' } },
  { id: 'chef', name: 'Street cook', text: 'Can cook anything on a wok and a car battery.', look: { skin: 0xe0ac86, hair: 0x2a1d17, hairStyle: 'bun', top: 0xf2efe7, topStyle: 'apron', accent: 0xd8282e, bottom: 0x2b3346, shoes: 0x16161c, hat: 'headband', hatColor: 0xd8282e } },
  { id: 'docker', name: 'Dock hand', text: 'Hauls krill at dawn, sings karaoke at midnight.', look: { skin: 0x8a5a3c, hair: 0x16161c, hairStyle: 'spiky', top: 0x2a4a3a, topStyle: 'vest', accent: 0xffdc5a, bottom: 0x4a3a2a, shoes: 0x16161c, hat: 'beanie', hatColor: 0xff9a4a, moustache: true } },
  { id: 'drifter', name: 'Drifter', text: 'Arrived on the night train with one bag and no plan.', look: { skin: 0xc98f6a, hair: 0xff5fb4, hairStyle: 'long', top: 0x3a2a3a, topStyle: 'cardigan', accent: 0xff5fb4, bottom: 0x16161c, skirt: true, shoes: 0xd8282e, hat: 'none' } },
];

const NAMES = ['Kai', 'Nova', 'Juno', 'Rook', 'Sable', 'Ash', 'Mika', 'Zed', 'Iris', 'Onyx', 'Lux', 'Rio', 'Vesper', 'Teo', 'Wren', 'Echo'];

export interface CreatorHooks {
  preview(look: Look): void;
  done(name: string, look: Look): void;
  back(): void;
  click(): void;
}

export function openCreator(root: HTMLElement, start: { name: string; look: Look | null }, hooks: CreatorHooks): () => void {
  let look: Look = { ...(start.look ?? ARCHETYPES[Math.floor(Math.random() * ARCHETYPES.length)].look) };
  let name = start.name || NAMES[Math.floor(Math.random() * NAMES.length)];
  const el = document.createElement('div');
  el.className = 'cc2040 zui';
  root.appendChild(el);
  let tab = 'body';

  const swatches = (key: string, list: number[], cur: number | undefined) =>
    `<div class="cc-sw">${list.map((c) => `<button data-k="${key}" data-v="${c}" class="${cur === c ? 'on' : ''}" style="--c:${hex(c)}" aria-label="${hex(c)}"></button>`).join('')}</div>`;
  const chips = <T,>(key: string, list: Opt<T>[], cur: T) =>
    `<div class="cc-chips">${list.map((o) => `<button data-k="${key}" data-v="${String(o.value)}" class="${cur === o.value ? 'on' : ''}">${o.label}</button>`).join('')}</div>`;
  const legs = () => (look.skirt ? 'skirt' : look.shorts ? 'shorts' : 'trousers');

  const render = () => {
    const body = tab === 'body'
      ? `<h4>Skin tone</h4>${swatches('skin', SKIN_TONES, look.skin)}
         <h4>Hair</h4>${chips('hairStyle', HAIR_STYLES, look.hairStyle)}
         <h4>Hair colour</h4>${swatches('hair', HAIR_NATURAL, look.hair)}${swatches('hair', HAIR_DYED, look.hair)}
         <h4>Face</h4><div class="cc-chips"><button data-k="glasses" class="${look.glasses ? 'on' : ''}">Shades</button><button data-k="moustache" class="${look.moustache ? 'on' : ''}">Moustache</button></div>`
      : tab === 'wear'
        ? `<h4>Top</h4>${chips('topStyle', TOPS, look.topStyle)}${swatches('top', CLOTH, look.top)}
           <h4>Neon trim</h4>${swatches('accent', NEON, look.accent)}
           <h4>Legs</h4>${chips('legs', LEGS, legs())}${swatches('bottom', CLOTH, look.bottom)}
           <h4>Shoes</h4>${swatches('shoes', [0x16161c, 0x2a2a34, 0xf2efe7, 0xd8282e, 0x2ad8ff, 0xff5fb4, 0x6b4630, 0xf2c74a], look.shoes)}`
        : `<h4>Headwear</h4>${chips('hat', HATS, look.hat ?? 'none')}${look.hat && look.hat !== 'none' ? swatches('hatColor', [...CLOTH.slice(0, 8), ...NEON.slice(0, 6)], look.hatColor) : ''}
           <h4>Bag</h4><div class="cc-chips"><button data-k="bag" class="${look.backpack === undefined ? 'on' : ''}" data-v="none">None</button><button data-k="bag" data-v="pack" class="${look.backpack !== undefined ? 'on' : ''}">Backpack</button></div>
           ${look.backpack !== undefined ? swatches('backpack', NEON.slice(0, 8), look.backpack) : ''}
           <h4>Cyberware</h4><div class="cc-chips"><button data-k="implant" data-v="none" class="${look.implant === undefined ? 'on' : ''}">No implant</button><button data-k="implant" data-v="on" class="${look.implant !== undefined ? 'on' : ''}">Face implant</button><button data-k="chrome" class="${look.chrome ? 'on' : ''}">Chrome arm</button></div>
           ${look.implant !== undefined ? swatches('implant', NEON.slice(0, 7), look.implant) : ''}`;
    el.innerHTML = `
      <div class="cc-head">
        <button class="round-btn" data-a="back" aria-label="Back">${G.back}</button>
        <div><div class="eyebrow">New life · Halcyon City</div><h2>Who are you?</h2></div>
      </div>
      <label class="cc-name"><small>Name</small><input id="cc-name" maxlength="16" spellcheck="false" autocomplete="off" value="${esc(name)}"></label>
      <div class="cc-arch">${ARCHETYPES.map((a) => `<button data-arch="${a.id}" title="${esc(a.text)}">${a.name}</button>`).join('')}</div>
      <div class="cc-tabs">${[['body', 'Body'], ['wear', 'Clothes'], ['gear', 'Gear']].map(([id, l]) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${l}</button>`).join('')}</div>
      <div class="cc-body">${body}</div>
      <div class="cc-foot">
        <button class="btn btn-ghost" data-a="dice">${G.sparkle}Random</button>
        <button class="btn btn-hero" data-a="go">Wake up in Halcyon${G.arrow}</button>
      </div>`;
    const input = el.querySelector('#cc-name') as HTMLInputElement;
    input.addEventListener('input', () => { name = input.value; });
    input.addEventListener('keydown', (e) => e.stopPropagation());
  };

  const apply = () => { hooks.preview({ ...look }); render(); };
  el.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!t) return;
    hooks.click();
    if (t.dataset.a === 'back') { hooks.back(); return; }
    if (t.dataset.a === 'go') { hooks.done((name.trim() || 'Nova').slice(0, 16), { ...look }); return; }
    if (t.dataset.a === 'dice') {
      const r = (a: number[]) => a[Math.floor(Math.random() * a.length)];
      look = {
        skin: r(SKIN_TONES), hair: Math.random() < 0.35 ? r(HAIR_DYED) : r(HAIR_NATURAL), hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)].value,
        top: r(CLOTH), topStyle: TOPS[Math.floor(Math.random() * 5)].value, accent: r(NEON), bottom: r(CLOTH.slice(0, 10)), shoes: r([0x16161c, 0xf2efe7, 0xd8282e, 0x2ad8ff]),
        skirt: Math.random() < 0.2, shorts: Math.random() < 0.1, hat: HATS[Math.floor(Math.random() * HATS.length)].value, hatColor: r(CLOTH),
        glasses: Math.random() < 0.35, moustache: Math.random() < 0.15, backpack: Math.random() < 0.3 ? r(NEON) : undefined,
        implant: Math.random() < 0.3 ? r(NEON.slice(0, 7)) : undefined, chrome: Math.random() < 0.15,
      };
      name = NAMES[Math.floor(Math.random() * NAMES.length)];
      apply();
      return;
    }
    if (t.dataset.tab) { tab = t.dataset.tab; render(); return; }
    if (t.dataset.arch) { const a = ARCHETYPES.find((q) => q.id === t.dataset.arch); if (a) { look = { ...a.look }; apply(); } return; }
    const k = t.dataset.k, v = t.dataset.v;
    if (!k) return;
    const L = look as unknown as Record<string, unknown>;
    if (k === 'glasses') look.glasses = !look.glasses;
    else if (k === 'moustache') look.moustache = !look.moustache;
    else if (k === 'chrome') look.chrome = !look.chrome;
    else if (k === 'implant' && (v === 'none' || v === 'on')) look.implant = v === 'none' ? undefined : look.implant ?? NEON[0];
    else if (k === 'legs') { look.skirt = v === 'skirt'; look.shorts = v === 'shorts'; }
    else if (k === 'bag') look.backpack = v === 'none' ? undefined : look.backpack ?? NEON[0];
    else if (k === 'hairStyle' || k === 'topStyle' || k === 'hat') L[k] = v;
    else L[k] = Number(v);
    apply();
  });
  apply();
  return () => el.remove();
}
