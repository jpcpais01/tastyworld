import type { SaveState } from '../game/state';
import type { UI } from '../ui/ui';
import type { Anchors } from '../world/tokyo';
import type { RoomAnchor } from '../world/interiors';
import type { HotelAnchor, HotelRoomAnchor } from '../world/hotels';
import { HOTEL } from '../data/hotels';
import { STALL, STALLS } from '../data/stalls';
import { PLACES } from '../data/places';
import { TEXT } from '../data/cityText';
import { zoneAt } from '../world/layout';
import type { Vitals } from './vitals';
import { defaultLife, type NeoLife } from './state';
import { BOUTIQUES } from './wardrobe';
import { neoShop, neoShopIdentity, HUB_LINES } from './roles';
import { board, GigRunner, JOB_NAME, type Gig, type GigWorld } from './jobs';
import { LifeUI, GigChip, FLAT_NAME, type ClinicItem } from './lifeui';

/**
 * The life sim of 2040 wired into the game: who runs which counter (boutiques, clinics, gig hubs, letting
 * desks), the gig running on the map, the flat you rent or own, the kitchen in it, and the turning of the days.
 * main.ts hands it a small host and asks it what a room's keeper does.
 */

export interface LifeHost {
  s: SaveState;
  ui: UI;
  anchors: Anchors;
  play(n: 'click' | 'pop' | 'fail' | 'coin' | 'clink' | 'chime' | 'ding'): void;
  /** Where the player stands, and whether they are out on the street (not in a room or upstairs). */
  pos(): { x: number; z: number };
  outdoors(): boolean;
  setPin(p: { x: number; z: number; name: string; id?: string } | null): void;
  pinId(): string | null | undefined;
  dressed(): void;
  save(): void;
  changed(): void;
  vitals(): Vitals | null;
  hour(): number;
  flash(): void;
}

/** The city's secrets as the life panel lists them. */
export const SECRETS: { id: string; name: string; text: string; found: (s: SaveState, L: NeoLife) => boolean }[] = [
  { id: 'seeds', name: 'Seeds of the past', text: 'Three seed capsules from before the vats, hidden at the edges of the city.', found: (s) => s.manekis.length >= 3 },
  { id: 'greenhouse', name: 'The Greenhouse', text: 'Behind a rusted door in the Stacks, food still grows in real soil.', found: (s) => !!s.hiddenFound },
  { id: 'shelfseeds', name: 'Shop-shelf capsules', text: 'Seed capsules tucked away on the shelves of the city\'s shops.', found: (s) => s.darumas.length >= 3 },
  { id: 'helix', name: 'Terminal Seven', text: 'What Helix Dynamics keeps on its top floor.', found: (_s, L) => L.secrets.includes('helix') },
  { id: 'regular', name: 'A regular', text: 'Work ten gigs and the dispatchers start saving you the good ones.', found: (_s, L) => Object.values(L.shifts).reduce((a, b) => a + b, 0) >= 10 },
];

export class NeoLifeSys {
  readonly gigs = new GigRunner();
  readonly ui: LifeUI;
  private chip: GigChip | null = null;
  private world: GigWorld;
  private boards = new Map<string, { hour: number; gigs: Gig[] }>();
  private lastHour = -1;
  private busy = false;

  constructor(private h: LifeHost) {
    const kit = h.ui.dineKit();
    this.ui = new LifeUI(kit, {
      life: () => this.life,
      money: (n) => TEXT.money(n),
      spend: (n) => this.spend(n),
      dressed: () => h.dressed(),
      saved: () => h.save(),
      day: () => this.life.day,
    });
    const a = h.anchors;
    const food = a.stalls.filter((st) => STALL[st.id]).map((st) => ({ id: st.id, name: STALL[st.id].name, x: st.stand[0], z: st.stand[1], stall: STALL[st.id].recipe ? st.id : undefined }));
    const nodes = a.graph.nodes.filter(([x, z]) => Math.hypot(x, z) > 30);
    this.world = {
      food,
      street: nodes,
      yards: nodes.filter(([x, z]) => x > 150 && Math.abs(z) > 80),
      where: (x, z) => zoneAt(x, z)?.name ?? 'the street',
    };
  }

  get life(): NeoLife { return (this.h.s.life ??= defaultLife()); }

  private spend(n: number): boolean {
    if (this.h.s.yen < n) return false;
    this.h.s.yen -= n;
    this.h.changed();
    return true;
  }

  private earn(n: number): void {
    this.h.s.yen += n;
    this.life.earned += n;
    this.h.changed();
  }

  /** The gig card goes under the vitals. */
  mount(host: HTMLElement): void {
    this.chip = new GigChip(host, () => this.openLife('work'));
    this.chip.set(this.gigs);
  }

  // ------------------------------------------------------------------ rooms
  /**
   * What a Halcyon room's keeper does when you talk to them, or null to leave it to the usual counter. `keeper`
   * is the keeper's name and `line` what they say first.
   */
  roomAct(rm: RoomAnchor, keeper: string, line: () => string): (() => void) | null {
    if (rm.hotel || rm.stall) return null;
    if (rm.kind === 'pharmacy') {
      const [name] = PLACES.pharmacy.names[rm.nth % PLACES.pharmacy.names.length];
      return () => this.ui.clinic(name, keeper, line(), (id) => this.clinic(id));
    }
    if (rm.kind !== 'shop') return null;
    const role = neoShop(rm.nth);
    const id = neoShopIdentity(rm.nth);
    if (role.role === 'boutique' && id) {
      const b = BOUTIQUES[role.kind];
      let k = 0;
      return () => this.ui.boutique(b, id.name, keeper, b.lines[(rm.nth + k++) % b.lines.length]);
    }
    if (role.role === 'gig' && id) {
      const [x, z] = rm.door;
      let k = 0;
      return () => this.ui.gigBoard(id.name, keeper, HUB_LINES[(rm.nth + k++) % HUB_LINES.length], this.boardAt(rm.id, x, z), this.gigs, (g) => this.take(g), () => this.quit());
    }
    return null;
  }

  private clinic(id: ClinicItem): void {
    const v = this.h.vitals();
    if (id === 'patch') { v?.healed(100); this.h.ui.toast('plaster', 'All patched up', 'Health back to full. Try not to need us again too soon.'); }
    else if (id === 'gel') { v?.ate(28, 4); this.h.ui.toast('drop', 'Nutri-gel', 'Tastes of nothing. Fills you up anyway.'); }
    else { v?.rested(30); this.h.ui.toast('vitamin', 'Wake stim', 'Your eyes open very wide. That should hold for a while.'); }
    this.h.changed();
  }

  private boardAt(id: string, x: number, z: number): Gig[] {
    const hr = Math.floor(this.h.hour()) + this.life.day * 24;
    const b = this.boards.get(id);
    if (b && b.hour === hr) return b.gigs;
    const gigs = board(this.world, { x, z }, (hr * 7919 + id.length * 104729 + Math.round(x * 31 + z * 17)) >>> 0);
    this.boards.set(id, { hour: hr, gigs });
    return gigs;
  }

  // ------------------------------------------------------------------ gigs
  private take(g: Gig): void {
    this.gigs.start(g);
    const s = g.stops[0];
    this.h.setPin({ x: s.x, z: s.z, name: s.name, id: 'gig' });
    this.h.ui.toast(JOB_NAME[g.kind].icon, g.title, `${s.name}. Your pin and compass will lead the way.`);
    this.chip?.set(this.gigs);
  }

  quit(): void {
    if (!this.gigs.gig) return;
    this.gigs.quit();
    if (this.h.pinId() === 'gig') this.h.setPin(null);
    this.h.ui.toast('chat', 'Gig dropped', 'No pay, no hard feelings. The board will have more.');
    this.chip?.set(this.gigs);
  }

  private arrive(): void {
    const g = this.gigs.gig!, s = this.gigs.stop!;
    const done = (extra = 0, note = s.arrive) => {
      const r = this.gigs.advance(extra);
      this.h.play('pop');
      if (!r.done) {
        const n = this.gigs.stop!;
        this.h.setPin({ x: n.x, z: n.z, name: n.name, id: 'gig' });
        this.h.ui.toast(JOB_NAME[g.kind].icon, note, `Next: ${n.name}.`);
      } else {
        if (this.h.pinId() === 'gig') this.h.setPin(null);
        const pay = r.pay + r.bonus;
        this.earn(pay);
        this.life.shifts[g.kind] = (this.life.shifts[g.kind] ?? 0) + 1;
        this.h.play('coin');
        this.h.flash();
        this.h.ui.toast('coin', `Paid ${TEXT.money(pay)}`, `${note}${r.bonus ? ` Speed bonus: ${TEXT.money(r.bonus)}.` : ''}`, true);
        this.h.save();
      }
      this.chip?.set(this.gigs);
      this.busy = false;
    };
    this.busy = true;
    if (s.task === 'cook') {
      const st = STALL[s.stall!] ?? STALLS.find((x) => x.recipe);
      if (!st) { done(); return; }
      this.h.ui.toast('knife', s.arrive, `Cook ${st.name}'s house dish.`);
      this.h.ui.cookRecipe(st.recipe, (stars) => {
        if (stars < 0) { this.busy = false; this.h.ui.toast('knife', 'Shift on hold', 'Walk back up to the counter when you are ready.'); this.cool = 4; return; }
        this.h.vitals()?.ate(10, 0);
        done(stars * 18, stars >= 3 ? 'Perfect service. The regulars cheered.' : stars ? 'Shift done. Nobody sent anything back.' : 'Shift done. Rough, but you showed up.');
      });
      return;
    }
    if (s.task === 'tune') {
      this.h.ui.toast('signal', s.arrive, 'Stop each band inside the window.');
      this.ui.tune((score) => {
        if (score < 0) { this.busy = false; this.cool = 4; return; }
        done(score * 12, score === 3 ? 'Signal locked clean.' : 'Signal holding. Just.');
      });
      return;
    }
    done();
  }

  /** Seconds before a stop you walked away from can trigger again. */
  private cool = 0;

  // ------------------------------------------------------------------ homes
  /** The flat you live in, if it is in this building. */
  homeIn(hotel: string): HotelRoomAnchor | null {
    const hm = this.life.home;
    if (!hm || !this.homeValid()) return null;
    return this.h.anchors.hotels.find((x) => x.id === hotel)?.rooms.find((r) => r.id === hm.id) ?? null;
  }

  isHome(roomId: string): boolean { return this.life.home?.id === roomId && this.homeValid(); }

  homeValid(): boolean {
    const hm = this.life.home;
    return !!hm && (hm.owned || hm.paidTo >= this.life.day);
  }

  homeName(): string | null {
    const hm = this.life.home;
    if (!hm) return null;
    const ha = this.h.anchors.hotels.find((x) => x.rooms.some((r) => r.id === hm.id));
    const rm = ha?.rooms.find((r) => r.id === hm.id);
    return ha && rm ? `${HOTEL[ha.id]?.name ?? 'Flat'} ${rm.floor + 1}01` : null;
  }

  /** A residence's front desk lets flats instead of booking nights. */
  lettings(ha: HotelAnchor, line: string): void {
    const info = HOTEL[ha.id];
    const specs = info.rooms;
    const flats = ha.rooms.map((r, i) => ({ id: r.id, floor: r.floor, type: r.type, price: r.price, buy: specs[i]?.buy }));
    this.ui.lettings(info, line, flats, (id, buy) => {
      const f = flats.find((x) => x.id === id)!;
      const cost = buy ? f.buy! : f.price;
      if (!this.spend(cost)) return false;
      const L = this.life;
      const same = L.home?.id === id;
      if (buy) L.home = { id, owned: true, paidTo: 0 };
      else L.home = { id, owned: false, paidTo: (same ? Math.max(L.home!.paidTo, L.day) : L.day) + 7 };
      this.h.play('coin');
      setTimeout(() => this.h.play('ding'), 380);
      const t = FLAT_NAME[f.type] ?? FLAT_NAME.double;
      this.h.ui.toast('key', buy ? `${t.name} ${f.floor + 1}01 is yours` : `${t.name} ${f.floor + 1}01`, buy
        ? `Keys, deeds and a bottle of synth fizz from ${info.keeper}. Nobody can take this one away.`
        : `${same ? 'Another week paid.' : 'The keys are yours.'} Take the ${info.stairs ? 'stairs' : 'lift'} up: bed, kitchen and wardrobe are waiting.`, true);
      this.h.flash();
      this.h.save();
      return true;
    });
  }

  /** Cook at home: pick up groceries from the pantry and play one of the city's recipes. */
  kitchen(): void {
    if (this.busy) return;
    const cost = 6;
    const pool = STALLS.filter((x) => x.recipe && !x.hidden);
    const st = pool[(this.life.homeCooked * 5 + this.life.day) % pool.length];
    if (!this.spend(cost)) { this.h.play('fail'); this.h.ui.toast('purse', 'The fridge is empty', `Groceries cost ${TEXT.money(cost)}. Earn a little first.`); return; }
    this.h.ui.toast('knife', `Tonight: ${st.name}'s recipe`, `Groceries ${TEXT.money(cost)}. Let's see if you can match the original.`);
    this.h.ui.cookRecipe(st.recipe, (stars) => {
      if (stars < 0) return;
      this.life.homeCooked++;
      this.h.vitals()?.ate(30 + stars * 12, 6 + stars * 3);
      this.h.play('chime');
      this.h.ui.toast('chopsticks', stars >= 3 ? 'Better than the stall' : stars ? 'A good home meal' : 'Edible. Mostly.', `You ate at your own table. ${this.life.homeCooked} meal${this.life.homeCooked === 1 ? '' : 's'} cooked at home.`);
      this.h.save();
    });
  }

  // ------------------------------------------------------------------ life panel
  openLife(tab?: string): void {
    const L = this.life;
    const shifts = Object.values(L.shifts).reduce((a, b) => a + b, 0);
    this.ui.lifePanel({
      tab,
      stats: [
        { label: 'Credits', value: TEXT.money(this.h.s.yen) },
        { label: 'Gigs done', value: String(shifts) },
        { label: 'Clothes owned', value: String(L.owned.length) },
        { label: 'Home meals', value: String(L.homeCooked) },
        { label: 'Days lived', value: String(L.day) },
        { label: 'Blackouts', value: String(L.faints) },
      ],
      secrets: SECRETS.map((x) => ({ name: x.name, text: x.text, found: x.found(this.h.s, L) })),
      homeName: this.homeValid() ? this.homeName() : null,
      runner: this.gigs,
      quit: () => this.quit(),
    });
  }

  // ------------------------------------------------------------------ every frame
  frame(dt: number, busy: boolean): void {
    // the days turn at midnight; rent comes due
    const hr = this.h.hour();
    if (this.lastHour >= 0 && hr < this.lastHour - 12) this.newDay();
    this.lastHour = hr;
    if (!this.gigs.gig) return;
    this.gigs.tick(dt);
    if (this.cool > 0) this.cool -= dt;
    else if (!busy && !this.busy && this.h.outdoors()) {
      const p = this.h.pos();
      if (this.gigs.near(p.x, p.z)) this.arrive();
    }
    this.chip?.set(this.gigs);
  }

  private newDay(): void {
    const L = this.life;
    L.day++;
    const hm = L.home;
    if (hm && !hm.owned) {
      const left = hm.paidTo - L.day;
      if (left === 1) this.h.ui.toast('key', 'Rent due tomorrow', `${this.homeName() ?? 'Your flat'}: pay another week at the front desk.`);
      else if (left < 0) {
        this.h.ui.toast('key', 'Locked out', `The rent on ${this.homeName() ?? 'your flat'} ran out. Pay at the front desk to get back in.`);
      }
    }
    this.h.save();
  }
}
