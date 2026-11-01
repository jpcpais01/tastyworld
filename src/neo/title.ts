import type { SaveState } from '../game/state';
import { G } from '../ui/glyphs';
import { PATCH_NOTES } from '../data/patchNotes';

/** 2040's title screen over the slow orbit of Halcyon City: carry on a life, start a new one, or play together. */

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const touch = () => matchMedia('(pointer: coarse)').matches;

export interface TitleHooks {
  /** Carry on the saved life. */
  play(): void;
  /** Make a character (a new life, or a new look for this one). */
  create(): void;
  host(): void;
  join(): void;
  notes(): void;
  click(): void;
}

export function neoTitle(el: HTMLElement, s: SaveState, hooks: TitleHooks): void {
  const life = s.life;
  const has = !!life?.look && !!life.name;
  el.innerHTML = `
    <div class="title-top t2040">
      <h1 class="title-logo">20<span>40</span></h1>
      <div class="title-tag">${has ? `Welcome back, ${esc(life!.name)} · day ${life!.day}` : 'Halcyon City · live, work, eat, dig for secrets'}</div>
    </div>
    <div class="title-card">
      <div class="modes">
        ${has ? `<button class="mode solo" id="t-play"><span class="mi">${G.play}</span><span class="mt"><b>Continue as ${esc(life!.name)}</b><small>${life!.home ? 'Wake up at home' : 'Back to the streets'}</small></span><span class="mgo">${G.arrow}</span></button>` : ''}
        <button class="mode ${has ? 'coop' : 'solo'}" id="t-new"><span class="mi">${G.person}</span><span class="mt"><b>${has ? 'Change your look' : 'New life'}</b><small>${has ? 'Back to the mirror' : 'Make your character'}</small></span><span class="mgo">${G.arrow}</span></button>
        <button class="mode coop" id="t-host"><span class="mi">${G.people}</span><span class="mt"><b>Play with a friend</b><small>Share a code, explore the city together</small></span><span class="mgo">${G.arrow}</span></button>
      </div>
      <div class="title-row">
        <button class="btn btn-ghost" id="t-join">${G.ticket}Got a code?</button>
        <button class="btn btn-ghost" id="t-notes">${G.sparkle}What's new · v${PATCH_NOTES[0].version}</button>
        <a class="btn btn-ghost" href="/">${G.globe}Tasty World</a>
      </div>
      <div class="title-hint">${touch() ? '<b>Tap</b> to walk · <b>Drag</b> to look · <b>Pinch</b> to zoom' : '<b>Click</b> or <b>WASD</b> to walk · <b>Q</b>/<b>E</b> to rotate · <b>Scroll</b> to zoom'}</div>
    </div>`;
  el.classList.remove('hidden');
  const go = (fn: () => void) => () => { hooks.click(); fn(); };
  if (has) (el.querySelector('#t-play') as HTMLElement).onclick = go(hooks.play);
  (el.querySelector('#t-new') as HTMLElement).onclick = go(hooks.create);
  (el.querySelector('#t-host') as HTMLElement).onclick = go(() => (has ? hooks.host() : hooks.create()));
  (el.querySelector('#t-join') as HTMLElement).onclick = go(hooks.join);
  (el.querySelector('#t-notes') as HTMLElement).onclick = go(hooks.notes);
}
