import type { NeoLife } from './state';

/**
 * The body's needs in 2040: health, hunger and sleep, each 0..100, drawn as three bars beside the clock.
 * Hunger and sleep run down in real time (faster on the move); health falls once either is empty and mends
 * slowly while both are comfortable. At zero health you black out and wake up at the clinic, a little poorer.
 */

/** Real seconds for a full stomach to empty, and for a night's sleep to wear off. */
const HUNGER_S = 22 * 60, SLEEP_S = 38 * 60;

export interface VitalsHooks {
  faint(): void;
  warn(kind: 'hunger' | 'sleep' | 'health', text: string): void;
}

export class Vitals {
  private bars: Record<'health' | 'hunger' | 'sleep', HTMLElement> | null = null;
  private warned = { hunger: false, sleep: false, health: false };
  private t = 0;
  private out = false;

  constructor(private life: NeoLife, private hooks: VitalsHooks) {}

  /** Mount the bars into the HUD's top-left column. */
  mount(host: HTMLElement): void {
    const el = document.createElement('div');
    el.className = 'glass vitals';
    el.innerHTML = (['health', 'hunger', 'sleep'] as const).map((k) => `<div class="vit v-${k}" title="${k[0].toUpperCase() + k.slice(1)}"><i class="vi">${ICON[k]}</i><span class="vb"><span class="vf"></span></span></div>`).join('');
    host.appendChild(el);
    this.bars = { health: el.querySelector('.v-health .vf')!, hunger: el.querySelector('.v-hunger .vf')!, sleep: el.querySelector('.v-sleep .vf')! };
    this.render();
  }

  /** dt in real seconds; `moving` 0 standing, 1 walking, 2 running. */
  update(dt: number, o: { active: boolean; moving: number; resting: boolean }): void {
    if (!o.active || this.out) return;
    const L = this.life;
    const burn = o.moving === 2 ? 1.8 : o.moving === 1 ? 1.2 : 1;
    L.hunger = clamp(L.hunger - (100 / HUNGER_S) * dt * burn);
    L.sleep = clamp(L.sleep - (100 / SLEEP_S) * dt * (o.resting ? 0.3 : 1));
    if (L.hunger <= 0 || L.sleep <= 0) L.health = clamp(L.health - dt * (L.hunger <= 0 && L.sleep <= 0 ? 0.9 : 0.45));
    else if (L.hunger > 40 && L.sleep > 30) L.health = clamp(L.health + dt * 0.06);
    // a word when a need gets low, once until it is seen to
    if (L.hunger < 22 && !this.warned.hunger) { this.warned.hunger = true; this.hooks.warn('hunger', 'Your stomach is growling. Find something to eat before you get weak.'); }
    if (L.sleep < 18 && !this.warned.sleep) { this.warned.sleep = true; this.hooks.warn('sleep', 'Your eyes are closing. Get a bed: a hotel, a capsule, or your own place.'); }
    if (L.health < 30 && !this.warned.health) { this.warned.health = true; this.hooks.warn('health', 'You feel faint. Eat, rest, or visit a clinic before you pass out.'); }
    if (L.hunger > 40) this.warned.hunger = false;
    if (L.sleep > 40) this.warned.sleep = false;
    if (L.health > 50) this.warned.health = false;
    if (L.health <= 0) { this.out = true; this.hooks.faint(); }
    this.t += dt;
    if (this.t > 0.5) { this.t = 0; this.render(); }
  }

  /** Back on your feet after fainting. */
  revive(): void {
    const L = this.life;
    L.health = 45; L.hunger = Math.max(L.hunger, 35); L.sleep = Math.max(L.sleep, 50);
    L.faints++;
    this.out = false;
    this.render();
  }

  ate(fill: number, heal = 0): void {
    this.life.hunger = clamp(this.life.hunger + fill);
    this.life.health = clamp(this.life.health + heal);
    this.pulse('hunger');
    this.render();
  }

  rested(amount: number): void {
    this.life.sleep = clamp(this.life.sleep + amount);
    this.life.health = clamp(this.life.health + amount * 0.25);
    this.pulse('sleep');
    this.render();
  }

  healed(amount: number): void {
    this.life.health = clamp(this.life.health + amount);
    this.pulse('health');
    this.render();
  }

  private pulse(k: 'health' | 'hunger' | 'sleep'): void {
    const b = this.bars?.[k]?.parentElement?.parentElement;
    if (!b) return;
    b.classList.remove('up');
    void b.offsetWidth;
    b.classList.add('up');
  }

  render(): void {
    if (!this.bars) return;
    for (const k of ['health', 'hunger', 'sleep'] as const) {
      const v = this.life[k];
      this.bars[k].style.width = `${v.toFixed(1)}%`;
      this.bars[k].parentElement!.parentElement!.classList.toggle('low', v < 25);
    }
  }
}

const clamp = (v: number) => Math.max(0, Math.min(100, v));

const svg = (b: string) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${b}</svg>`;
const ICON = {
  health: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10Z"/>'),
  hunger: svg('<path d="M4 11h16a8 8 0 0 1-16 0Z"/><path d="M9 7c0-1.5 1-1.5 1-3M14 7c0-1.5 1-1.5 1-3"/>'),
  sleep: svg('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>'),
};
