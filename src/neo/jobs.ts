/**
 * Work in Halcyon: gigs taken from the boards in the city's gig hubs. A gig is a short run of stops on the map
 * (pick up, carry, drop off) that may end in a task done on the spot (cook a dish, tune a data jack). The pin and
 * the compass lead to each stop; reach it and the next one is set. Pay comes at the end, with a bonus for speed.
 */

export type JobKind = 'courier' | 'dock' | 'kitchen' | 'data' | 'flyer';

export interface Stop {
  x: number;
  z: number;
  /** What the pin says. */
  name: string;
  /** What you are told on arrival. */
  arrive: string;
  /** A task to finish here before the next stop. */
  task?: 'cook' | 'tune';
  /** The stall whose recipe a kitchen shift cooks. */
  stall?: string;
  /** A story stop: who speaks the arrival line, in a dialogue rather than a toast. */
  who?: string;
}

export interface Gig {
  id: string;
  kind: JobKind;
  title: string;
  client: string;
  text: string;
  stops: Stop[];
  pay: number;
  /** Seconds to beat for the bonus (0: no clock). */
  par: number;
  bonus: number;
}

export interface ActiveGig extends Gig { at: number; t: number; earned: number }

export const JOB_NAME: Record<JobKind, { name: string; icon: string }> = {
  courier: { name: 'Food courier', icon: 'backpack' },
  dock: { name: 'Dock shift', icon: 'suitcase' },
  kitchen: { name: 'Kitchen shift', icon: 'knife' },
  data: { name: 'Data jack tuning', icon: 'signal' },
  flyer: { name: 'Holo-flyer run', icon: 'sparkle' },
};

/** Places a gig can use: food places to pick up from, street spots to deliver to, the docks' yards. */
export interface GigWorld {
  food: { id: string; name: string; x: number; z: number; stall?: string }[];
  street: [number, number][];
  yards: [number, number][];
  /** The name of the street at a spot. */
  where(x: number, z: number): string;
}

const CLIENTS = ['Mx. Tanaka-Reyes', 'a night nurse', 'Unit 4C', 'two students', 'a sleepy netrunner', 'the Moreno family', 'a dock foreman', 'someone called "K"', 'Grandma Sun', 'a jazz trio', 'a Helix intern', 'the pigeon man'];
const DATA_CLIENTS = ['Ghostline Collective', 'Kowa Telecom', 'an anonymous handle', 'the Stacks mesh net'];

const rngOf = (seed: number) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
const dist = (a: { x: number; z: number }, b: { x: number; z: number }) => Math.hypot(a.x - b.x, a.z - b.z);

/** Today's board at a hub: four gigs, fresh every in-game hour. */
export function board(w: GigWorld, hub: { x: number; z: number }, seed: number): Gig[] {
  const r = rngOf(seed);
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const out: Gig[] = [];
  const near = (list: [number, number][], from: { x: number; z: number }, min: number, max: number) => {
    const ok = list.filter(([x, z]) => { const d = Math.hypot(x - from.x, z - from.z); return d >= min && d <= max; });
    return ok.length ? pick(ok) : pick(list);
  };
  // food courier: from a stall or kitchen to someone's door
  {
    const f = [...w.food].sort((a, b) => dist(a, hub) - dist(b, hub)).slice(0, 12);
    const from = pick(f);
    const [x, z] = near(w.street, from, 60, 170);
    const d = dist(from, { x, z }) + dist(hub, from);
    const client = pick(CLIENTS);
    out.push({
      id: `c${seed}`, kind: 'courier', title: `Deliver from ${from.name}`, client, text: `Pick up an order at ${from.name} and run it to ${client} on ${w.where(x, z)}. Hot food, so be quick.`,
      stops: [
        { x: from.x, z: from.z, name: `Pick up: ${from.name}`, arrive: 'Order bagged and sealed. Go!' },
        { x, z, name: `Deliver to ${client}`, arrive: `Delivered to ${client}. Still warm.` },
      ],
      pay: Math.round(24 + d * 0.16), par: Math.round(d / 1.7 + 25), bonus: Math.round(10 + d * 0.06),
    });
  }
  // kitchen shift: cook a stall's signature for the rush
  {
    const f = w.food.filter((x) => x.stall);
    if (f.length) {
      const st = pick(f);
      out.push({
        id: `k${seed}`, kind: 'kitchen', title: `Rush hour at ${st.name}`, client: st.name, text: `${st.name} is short a cook for the evening rush. Get there and cook the house dish. Pay goes up with your stars.`,
        stops: [{ x: st.x, z: st.z, name: `Kitchen shift: ${st.name}`, arrive: 'Apron on. The tickets are piling up.', task: 'cook', stall: st.stall }],
        pay: 45, par: 0, bonus: 0,
      });
    }
  }
  // the docks: three crates from the yard to the trucks
  if (w.yards.length >= 2) {
    const a = pick(w.yards);
    let b = pick(w.yards);
    for (let i = 0; i < 6 && b === a; i++) b = pick(w.yards);
    out.push({
      id: `d${seed}`, kind: 'dock', title: 'Krill crates, Rust Docks', client: 'Harbour Co-op', text: 'The morning boats came in heavy. Carry two loads of krill crates from the crane to the cold store before they spoil.',
      stops: [
        { x: a[0], z: a[1], name: 'Crane: crate 1', arrive: 'Crate up on your shoulder. Heavy.' },
        { x: b[0], z: b[1], name: 'Cold store: drop crate 1', arrive: 'Down it goes. One more.' },
        { x: a[0], z: a[1], name: 'Crane: crate 2', arrive: 'Last crate. Your back has opinions.' },
        { x: b[0], z: b[1], name: 'Cold store: drop crate 2', arrive: 'All in. The foreman nods at you.' },
      ],
      pay: 70 + Math.round(dist({ x: a[0], z: a[1] }, { x: b[0], z: b[1] }) * 0.4), par: 0, bonus: 0,
    });
  }
  // data jacks: tune two street jacks for the mesh
  {
    const p1 = near(w.street, hub, 30, 110);
    const p2 = near(w.street, { x: p1[0], z: p1[1] }, 40, 120);
    const client = pick(DATA_CLIENTS);
    out.push({
      id: `n${seed}`, kind: 'data', title: 'Tune two data jacks', client, text: `${client} needs two street jacks retuned before the night traffic. Find them, plug in and lock the signal.`,
      stops: [
        { x: p1[0], z: p1[1], name: `Data jack, ${w.where(p1[0], p1[1])}`, arrive: 'Jack open. Lock the three bands.', task: 'tune' },
        { x: p2[0], z: p2[1], name: `Data jack, ${w.where(p2[0], p2[1])}`, arrive: 'Second jack. Same drill.', task: 'tune' },
      ],
      pay: 95, par: 0, bonus: 0,
    });
  }
  // holo-flyers: three corners for an ad campaign
  {
    const a = near(w.street, hub, 20, 80), b = near(w.street, { x: a[0], z: a[1] }, 30, 90), c = near(w.street, { x: b[0], z: b[1] }, 30, 90);
    const d = Math.hypot(a[0] - hub.x, a[1] - hub.z) + Math.hypot(b[0] - a[0], b[1] - a[1]) + Math.hypot(c[0] - b[0], c[1] - b[1]);
    out.push({
      id: `f${seed}`, kind: 'flyer', title: 'Pin up holo-flyers', client: 'Club Ultraviolet', text: 'Stick three holo-flyers for Friday\'s show on the busiest corners. Quick money, sore feet.',
      stops: [a, b, c].map(([x, z], i) => ({ x, z, name: `Flyer ${i + 1} of 3, ${w.where(x, z)}`, arrive: i < 2 ? 'Flyer up. It flickers into a dancing tiger.' : 'Last one up. The tiger roars silently.' })),
      pay: Math.round(30 + d * 0.12), par: Math.round(d / 1.6 + 30), bonus: 20,
    });
  }
  return out;
}

/** The running gig: tells the host where to go next and pays at the end. */
export class GigRunner {
  gig: ActiveGig | null = null;

  start(g: Gig): void { this.gig = { ...g, at: 0, t: 0, earned: 0 }; }
  get stop(): Stop | null { return this.gig ? this.gig.stops[this.gig.at] ?? null : null; }
  get last(): boolean { return !!this.gig && this.gig.at === this.gig.stops.length - 1; }

  /** Seconds left for the bonus, or null without a clock. */
  get clock(): number | null { return this.gig && this.gig.par ? Math.max(0, this.gig.par - this.gig.t) : null; }

  tick(dt: number): void { if (this.gig) this.gig.t += dt; }

  /** Close enough to the current stop to arrive? */
  near(x: number, z: number): boolean {
    const s = this.stop;
    return !!s && Math.hypot(s.x - x, s.z - z) < 2.4;
  }

  /** Move on past the current stop; returns the pay when that was the last one. */
  advance(extra = 0): { done: boolean; pay: number; bonus: number } {
    const g = this.gig!;
    g.earned += extra;
    g.at++;
    if (g.at < g.stops.length) return { done: false, pay: 0, bonus: 0 };
    const bonus = g.par && g.t <= g.par ? g.bonus : 0;
    this.gig = null;
    return { done: true, pay: g.pay + g.earned, bonus };
  }

  quit(): void { this.gig = null; }
}
