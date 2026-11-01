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
  /** Ride the lift to a floor of a building (null: back down to the lobby). */
  goFloor(ha: HotelAnchor, rm: HotelRoomAnchor | null): void;
  /** Which floor of which building the player is on, if upstairs. */
  upstairs(): HotelRoomAnchor | null;
  dialogue(name: string, lines: string[], done?: () => void): void;
  shake(): void;
}

/** The city's secrets as the life panel lists them. */
export const SECRETS: { id: string; name: string; text: string; found: (s: SaveState, L: NeoLife) => boolean }[] = [
  { id: 'seeds', name: 'Seeds of the past', text: 'Three seed capsules from before the vats, hidden at the edges of the city.', found: (s) => s.manekis.length >= 3 },
  { id: 'greenhouse', name: 'The Greenhouse', text: 'Behind a rusted door in the Stacks, food still grows in real soil.', found: (s) => !!s.hiddenFound },
  { id: 'shelfseeds', name: 'Shop-shelf capsules', text: 'Seed capsules tucked away on the shelves of the city\'s shops.', found: (s) => s.darumas.length >= 3 },
  { id: 'helix', name: 'Terminal Seven', text: 'What Helix Dynamics keeps on its top floor.', found: (_s, L) => L.secrets.includes('helix') },
  { id: 'mail', name: 'Do not put this in writing', text: 'An open email on a Helix workstation.', found: (_s, L) => L.secrets.includes('helix-mail') },
  { id: 'trn', name: 'Beat TRN', text: 'The Neon Racer high score at Orbit Mall has stood since 2037.', found: (_s, L) => L.secrets.includes('trn') },
  { id: 'harvest', name: 'First harvest', text: 'Plant the old seed lines in the Greenhouse and see them through to the table.', found: (_s, L) => L.secrets.includes('harvest') },
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

  // ------------------------------------------------------------------ venues: Helix Dynamics and Orbit Mall
  private get helix(): number { return this.life.quests.helix ?? 0; }
  private set helix(v: number) { this.life.quests.helix = v; this.h.save(); }

  /** Floor names, and whether the lift will take you there. */
  private floors(ha: HotelAnchor): { rm: HotelRoomAnchor; label: string; sub: string; locked: string | null }[] {
    const office = HOTEL[ha.id]?.venue === 'office';
    return ha.rooms.map((rm) => {
      const f = rm.floor;
      if (!office) return { rm, label: `Level ${f}`, sub: ['', 'Fashion', 'Food court', 'Arcade'][f] ?? 'Shops', locked: null };
      const need = f <= 2 ? 2 : f === 3 ? 3 : 4;
      const label = ['', 'Open plan', 'Security', 'Executive', 'Restricted'][f];
      const sub = ['', 'Vat research, floor 1', 'Building security', 'Dr. Vey\'s office', 'Terminal Seven'][f];
      const locked = this.helix >= need ? null : f <= 2 ? 'Visitor pass needed' : f === 3 ? 'Override code needed' : 'Executive keycard needed';
      return { rm, label: `${f + 1}F · ${label}`, sub: this.helix >= need ? sub : '', locked };
    });
  }

  /** The lift: a floor list. */
  lift(ha: HotelAnchor): void {
    const info = HOTEL[ha.id];
    const here = this.h.upstairs();
    this.ui.lift(info.name, [
      { label: 'Lobby', sub: info.venue === 'office' ? 'Reception' : 'Information desk', locked: null, here: !here, go: () => this.h.goFloor(ha, null) },
      ...this.floors(ha).map((f) => ({ label: f.label, sub: f.sub, locked: f.locked, here: here?.id === f.rm.id, go: () => {
        if (f.locked) { this.h.play('fail'); this.h.ui.toast('lock', f.locked, info.venue === 'office' ? 'The lift reader blinks red. Helix keeps its floors locked.' : ''); return; }
        this.h.goFloor(ha, f.rm);
      } })),
    ]);
  }

  /** The front desk downstairs. */
  desk(ha: HotelAnchor, line: string): void {
    const info = HOTEL[ha.id];
    if (info.venue === 'mall') { this.h.dialogue(info.keeper, [line, 'Take the lift by the desk: fashion on 1, the food court on 2, the arcade on 3.']); return; }
    const suit = this.life.look?.topStyle === 'suit';
    if (this.helix === 0) { this.h.dialogue(info.keeper, [line]); return; }
    if (this.helix === 1) {
      if (!suit) { this.h.dialogue(info.keeper, ['Do you have an appointment?', 'No? Then I am afraid I cannot let you upstairs. Helix staff only.', '(She looks you up and down. Maybe if you looked like you worked here...)']); return; }
      this.h.dialogue(info.keeper, ['Oh! Sorry, I did not recognise you. New in Compliance?', 'Here is a visitor pass for floors two and three. Do not lose it, they charge us for every one.'], () => {
        this.helix = 2;
        this.h.play('ding');
        this.h.ui.toast('key', 'Visitor pass', 'The lift now goes to the open-plan floor and to Security. Wren said the code would be on a security console.', true);
      });
      return;
    }
    this.h.dialogue(info.keeper, [this.helix >= 5 ? 'There has been a... data incident. Not that you would know anything about that.' : 'Good to see you again. Badge in at the lift as usual.']);
  }

  // ------------------------------------------------------------------ the Greenhouse seed bed: First Harvest

  private q(k: string): number { return this.life.quests[k] ?? 0; }
  private setQ(k: string, v: number): void { this.life.quests[k] = v; this.h.save(); }

  /** What the seed bed in the Greenhouse offers right now. */
  bedPrompt(): [string, string, string] {
    const st = this.q('harvest'), grow = this.q('hGrow');
    if (st === 0) return ['leek', 'Seed bed', this.h.s.manekis.length >= 3 ? 'Plant the old seeds' : 'Look at the empty bed'];
    if (st >= 2) return ['tomato', 'Seed bed', 'Look at the bed'];
    if (grow >= 3) return ['tomato', 'Seed bed', 'Harvest'];
    return this.q('hWater') === this.life.day ? ['leek', 'Seed bed', 'Look at the shoots'] : ['drop', 'Seed bed', 'Water the bed'];
  }

  /**
   * First Harvest: bring Ines the three seed capsules from the city's edges, plant them, water the bed on three
   * different days, and she cooks what comes up. With SEEDVAULT out, the seeds go on to the hills.
   */
  seedBed(): void {
    const MORA = 'Dr. Ines Mora', st = this.q('harvest'), day = this.life.day;
    if (st === 0) {
      if (this.h.s.manekis.length < 3) {
        this.h.dialogue(MORA, this.helix >= 6 ? [
          'You are the one who pulled SEEDVAULT out of the Spire. Wren told me. Sit, sit.',
          'Helix let the seed bank in the hills die. But before the vats came, a few of us hid capsules of the old lines at the edges of the city.',
          'Find all three and bring them to this bed. We start again here.',
        ] : [
          'This bed is kept for the old lines: seeds from before the vats, the ones nobody sells any more.',
          'Years ago, a few of us hid capsules of them at the edges of the city. If you ever find all three, bring them here.',
        ]);
        return;
      }
      this.h.dialogue(MORA, [
        'All three capsules. You found all three.',
        'Tomato, runner bean, and a squash my grandmother grew. Kneel down, push them in a finger deep. Like that.',
        'Real seeds are slow. Water the bed once a day, three days, and come back hungry.',
      ], () => {
        this.life.quests.harvest = 1; this.life.quests.hWater = day; this.setQ('hGrow', 1);
        this.h.play('pop');
        this.h.ui.toast('leek', 'Planted', 'Water the bed on two more days and it is ready.', true);
      });
      return;
    }
    if (st >= 2) {
      this.h.dialogue(MORA, ['The bed is full of runners and fat green squash. Half of what grows here goes north to the hills now.', 'Come and eat whenever you like. You planted it.']);
      return;
    }
    const grow = this.q('hGrow');
    if (grow >= 3) {
      this.h.dialogue(MORA, [
        'Look at it. Tomatoes splitting with sun they have never seen. Beans. A squash the size of your head.',
        'Pick it with me, then sit. I am cooking.',
        'She roasts the squash in the wood oven, blisters the tomatoes, and tips the beans in with butter and salt. It tastes of something you did not know you had forgotten.',
        ...(this.helix >= 6 ? ['"With SEEDVAULT on every screen, the farms in the hills are asking for seed. These will be theirs. Your seeds."'] : []),
      ], () => {
        this.setQ('harvest', 2);
        if (!this.life.secrets.includes('harvest')) this.life.secrets.push('harvest');
        this.h.vitals()?.ate(100, 40);
        this.h.vitals()?.rested(15);
        this.h.play('chime');
        this.h.flash();
        this.h.ui.toast('tomato', 'First Harvest', 'A meal grown from the old seeds. Hunger full, health restored.', true);
        this.h.changed();
      });
      return;
    }
    if (this.q('hWater') === day) {
      const look = grow <= 1 ? 'Pale shoots, barely out of the soil. The squash has two round leaves like a pair of hands.'
        : 'Real leaves now, and the first yellow flowers on the squash. The beans have found the strings.';
      this.h.ui.toast('leek', 'Seed bed', `${look} Water it again tomorrow.`);
      return;
    }
    this.life.quests.hWater = day;
    this.setQ('hGrow', grow + 1);
    this.h.play('pop');
    this.h.ui.toast('drop', 'Watered', grow + 1 >= 3 ? 'Something is ready to pick. Ines is watching the bed.' : 'One more day of water and it is ready.', grow + 1 >= 3);
  }

  /** Wren, the netrunner by the Halo, who starts the Helix job and pays for it. */
  wren(name: string): boolean {
    const q = this.helix;
    if (q === 0) {
      this.h.dialogue(name, [
        'Hey. You are new. Good, nobody knows your face yet.',
        'Helix Dynamics, the black tower in the Spire. Their top floor runs a machine called Terminal Seven. Something on it scares the people who built it.',
        'I need someone to walk in and plug me in. Look like you belong, and the receptionist will give you a pass. Corpos only trust a suit.',
        'Get to Terminal Seven and I will make it worth two thousand credits. Deal?',
      ], () => { this.helix = 1; this.h.play('chime'); this.h.ui.toast('signal', 'Terminal Seven', 'Get a visitor pass at Helix Dynamics in the Spire. A suit from a tailor would help.', true); });
      return true;
    }
    if (q < 5) {
      const hint = q === 1 ? 'A suit. Atelier Vanta or Zenith Bespoke, both in the shops round the city. Then smile at reception.'
        : q === 2 ? 'Security is on the third floor. Their console has the lift override for the executive floor. Lock the bands and it is yours.'
          : q === 3 ? 'Dr. Vey runs the vat project. Her keycard opens the restricted floor. She leaves it on her desk; corpos always do.'
            : 'You have the keycard. Top floor, Terminal Seven. Plug in, lock the signal, and get out before the alarm.';
      this.h.dialogue(name, [hint]);
      return true;
    }
    if (q === 5) {
      this.h.dialogue(name, [
        'You did it. I have the file. Project SEEDVAULT.',
        'Helix bought the last seed bank in the hills ten years ago. They did not save it. They have been letting it die, so the vats are the only food left.',
        'Whoever runs the Greenhouse in the Stacks should see this. Here, your two thousand. You earned every credit.',
      ], () => { this.helix = 6; this.earn(2000); this.h.play('coin'); this.h.flash(); this.h.ui.toast('coin', `Paid ${TEXT.money(2000)}`, 'Wren is already uploading SEEDVAULT to every screen in the Mile.', true); });
      return true;
    }
    if (this.q('harvest') >= 2) { this.h.dialogue(name, ['Ines sent me a tomato. A real one. I did not eat it for a day, I just looked at it.', 'Ghost in the Spire, and now a farmer. The net does not know what to call you.']); return true; }
    this.h.dialogue(name, ['The feeds are full of SEEDVAULT. Helix shares fell off a cliff. Somebody said the hills are planting again.', 'Ghost in the Spire. That is what they call you on the net now.']);
    return true;
  }

  /** The main spot (bed) or the second spot (tea) on a venue floor. */
  spot(ha: HotelAnchor, rm: HotelRoomAnchor, which: 'main' | 'second'): void {
    const info = HOTEL[ha.id];
    if (info.venue === 'mall') return this.mallSpot(rm.floor, which);
    const f = rm.floor;
    if (which === 'second') {
      if (f === 4) { this.h.ui.toast('lock', 'Fuse panel', 'Somebody has written HELP in marker on the inside of the cover.'); return; }
      this.h.vitals()?.rested(6);
      this.h.ui.toast('coffee', 'Free corp coffee', 'Synth beans, but free. Your eyes open a little wider.');
      return;
    }
    if (f === 1) {
      this.h.dialogue('Open workstation', ['An email is open on the screen: "RE: RE: SEEDVAULT timeline. Do not put this in writing."', 'Another: "Reminder: the hills are off limits. Again. Stop asking."', 'A sticky note on the monitor: "Vey keeps her card on her desk. Every night. Every. Night."']);
      if (!this.life.secrets.includes('helix-mail')) this.life.secrets.push('helix-mail');
      return;
    }
    if (f === 2) {
      if (this.helix >= 3) { this.h.ui.toast('signal', 'Security console', 'Camera feeds loop over and over. Nobody is watching them anyway.'); return; }
      if (this.helix < 2) return;
      this.h.ui.toast('signal', 'Security console', 'Lock all three bands to pull the lift override.');
      this.ui.tune((sc) => {
        if (sc < 0) return;
        if (sc >= 2) { this.helix = 3; this.h.play('chime'); this.h.ui.toast('key', 'Override code: 7-7-0-4', 'The lift will now take you to the executive floor.', true); }
        else { this.h.play('fail'); this.h.ui.toast('lock', 'Signal lost', 'The console locks you out for a moment. Try again.'); }
      });
      return;
    }
    if (f === 3) {
      if (this.helix >= 4) { this.h.dialogue('Dr. Vey\'s desk', ['A framed photo: a young woman in a green field, holding a seedling. On the back: "Before. E.V."']); return; }
      this.h.dialogue('Dr. Vey\'s desk', ['A handwritten note: "Seven is not a terminal. It is a confession."', 'Under it, a keycard on a Helix lanyard: DR. E. VEY, EXECUTIVE.', 'You pocket it.'], () => {
        this.helix = 4; this.h.play('ding'); this.h.ui.toast('key', 'Executive keycard', 'The lift will take you to the restricted floor: Terminal Seven.', true);
      });
      return;
    }
    // Terminal Seven
    if (this.helix >= 5) { this.h.dialogue('Terminal Seven', ['FILE ALREADY COPIED. SESSION CLOSED.', 'A last line blinks on the screen: "Thank you."']); return; }
    this.h.ui.toast('signal', 'Terminal Seven', 'Plug Wren in: lock all three bands. Miss twice and the alarm goes.');
    this.ui.tune((sc) => {
      if (sc < 0) return;
      if (sc >= 2) {
        this.helix = 5;
        if (!this.life.secrets.includes('helix')) this.life.secrets.push('helix');
        this.h.play('chime');
        this.h.flash();
        this.h.dialogue('Terminal Seven', [
          'PROJECT SEEDVAULT. CLASSIFICATION: BLACK.',
          'Seed bank acquired 2030. Viability programme cancelled 2031. Remaining stock: 312 species. Decline: 40% per year.',
          'Objective: no food supply outside licensed vats by 2042.',
          'The download bar fills. Wren\'s voice in your ear: "Got it. Now walk out slowly."',
        ], () => this.h.ui.toast('signal', 'Get out and find Wren', 'Wren waits by the Halo for the file.', true));
      } else {
        this.h.play('fail');
        this.h.shake();
        this.h.dialogue('Terminal Seven', ['ALARM. UNAUTHORISED ACCESS.', 'Two guards walk you to the lift and down to the lobby. Next time, lock the signal faster.'], () => {
          this.h.goFloor(ha, null);
        });
      }
    });
  }

  private mallSpot(f: number, which: 'main' | 'second'): void {
    if (f === 1) {
      if (which === 'second') { this.h.ui.toast('coat', 'The mirror', 'Looking good. Halcyon agrees.'); this.openLife('wardrobe'); return; }
      const all: (keyof typeof BOUTIQUES)[] = ['street', 'tech', 'corpo', 'thrift'];
      const b = BOUTIQUES[all[this.life.day % all.length]];
      this.ui.boutique({ ...b, stock: [...new Set([...BOUTIQUES.street.stock.slice(0, 3), ...b.stock])] }, 'Orbit Fashion', 'Kiosk AI', 'Today\'s edit, chosen by an algorithm that has never been outside.');
      return;
    }
    if (f === 2) {
      if (which === 'second') {
        if (!this.spend(6)) { this.h.play('fail'); return; }
        this.h.vitals()?.ate(12, 1);
        this.h.ui.toast('drop', 'Glow boba', 'The pearls light up when you bite them.');
        return;
      }
      this.h.ui.shop('Orbit Food Court', 'FOOD COURT', 'Level 2 · twelve counters', 'Counter 4', 'Noodles, bao or the curry fries? Everybody gets the curry fries.', [
        { icon: 'ramen', name: 'Kelp noodles', price: 11, text: 'Hand-pulled at counter 2, in a broth that has been going since the mall opened.', snack: true },
        { icon: 'nikuman', name: 'Vat bao, two', price: 8, text: 'Fluffy, glossy, and only slightly suspicious.', snack: true },
        { icon: 'corn', name: 'Curry fries', price: 7, text: 'The Orbit classic. Do not ask what is in the curry.', snack: true },
      ], (it) => { if (!this.spend(it.price)) return false; this.h.vitals()?.ate(26, 2); this.h.play('coin'); return true; });
      return;
    }
    if (which === 'second') {
      if (!this.spend(3)) { this.h.play('fail'); return; }
      const won = Math.random() < 0.25;
      this.h.ui.toast(won ? 'cat' : 'chat', won ? 'You won a plush krill!' : 'So close', won ? 'The claw actually held on. A first in recorded history.' : 'The claw lets go at the very top. Of course it does.');
      return;
    }
    if (!this.spend(4)) { this.h.play('fail'); this.h.ui.toast('purse', 'Insert credits', 'Neon Racer takes 4 credits a go.'); return; }
    this.h.ui.toast('signal', 'Neon Racer', 'Lock the three bands to hit the boost gates.');
    this.ui.tune((sc) => {
      if (sc < 0) return;
      const prize = [0, 2, 6, 25][sc];
      if (prize) this.earn(prize);
      this.h.ui.toast('trophy', sc === 3 ? 'New high score!' : sc ? 'Not bad' : 'Crashed', sc === 3 ? `TRN is dethroned. The machine pays out ${TEXT.money(prize)}.` : prize ? `${TEXT.money(prize)} in tickets.` : 'Your car is a fireball. The crowd cheers anyway.');
      if (sc === 3 && !this.life.secrets.includes('trn')) { this.life.secrets.push('trn'); this.h.save(); }
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
