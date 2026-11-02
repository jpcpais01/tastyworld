/**
 * Co-op travel: friends share a trip through a "plane ticket" code. Peers find each other through
 * public Nostr relays (Trystero) and then talk directly over WebRTC, so there is no game server.
 * Add ?net=local to the URL to use a BroadcastChannel instead (two tabs on one machine, for testing),
 * or ?relay=ws://host:port to signal through your own Nostr relay.
 */
import type { MessageAction } from 'trystero';

/** `look`: 2040's made character, worn instead of Tasty World's traveller outfit. */
export interface Profile { name: string; color: number; wear: string[]; look?: import('../world/characters').Look; }

export interface Peer extends Profile {
  id: string;
  host: boolean;
  dest: string;
  seat: string;
  inWorld: boolean;
  /** When they opened the ticket: two guests who picked the same seat at once settle it by who came first. */
  since: number;
  /** Latest movement sample: x, y, z, facing, anim, speed, inside, hour. */
  st: number[] | null;
  at: number;
}

/**
 * How the trip leader set up the trip: travelling with friends, or as a couple. On a couple's trip the leader and
 * the passenger in seat 1B are partners (they can hold hands, share a room and a bite); anyone else is a friend.
 */
export type Bond = 'friend' | 'lover';

export type CoopEvent = { k: 'wave' } | { k: 'stamp'; dish: string } | { k: 'secret' } | { k: 'cat' }
  /** Partners only: hands held (or let go), a room shared, lights out together, a bite offered. */
  | { k: 'hand'; on: boolean } | { k: 'room'; hotel: string; room: string } | { k: 'sleep'; room: string } | { k: 'share'; dish: string };

interface Hello extends Profile { v: number; host: boolean; dest: string; seat: string; inWorld: boolean; bond?: Bond; since?: number; }

type Json = null | string | number | boolean | Json[] | { [k: string]: Json };

interface Transport {
  send(kind: string, data: Json, to?: string): void;
  onMessage: (kind: string, data: Json, from: string) => void;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  leave(): void;
}

const PROTOCOL = 1;
const APP_ID = 'tastyworld-coop-v1';
export const ALPHABET = 'ACDEFGHJKLMNPQRTUVWXY34679';


/** A fresh six-letter ticket code, avoiding letters that are easy to confuse. */
export function newCode(): string {
  const r = crypto.getRandomValues(new Uint8Array(6));
  return [...r].map((n) => ALPHABET[n % ALPHABET.length]).join('');
}

/** Normalise what a player typed into a ticket code (or '' if it can't be one). */
export function parseCode(s: string): string {
  const c = s.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return c.length === 6 && [...c].every((ch) => ALPHABET.includes(ch)) ? c : '';
}

export const prettyCode = (c: string) => `${c.slice(0, 3)}-${c.slice(3)}`;

/** Flight number and gate printed on the boarding pass, derived from the code. */
export function flightOf(code: string): { flight: string; gate: string } {
  let h = 7;
  for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return { flight: `TW ${100 + (h % 900)}`, gate: String(1 + ((h >>> 10) % 24)).padStart(2, '0') };
}

async function trysteroTransport(room: string, password: string): Promise<Transport> {
  const { joinRoom } = await import('trystero');
  const relay = new URLSearchParams(location.search).get('relay');
  const r = joinRoom({ appId: APP_ID, password, relayConfig: relay ? { urls: [relay] } : { redundancy: 6 } }, room);
  const kinds = ['hi', 'st', 'ev', 'bye'];
  const t: Transport = {
    onMessage: () => {}, onJoin: () => {}, onLeave: () => {},
    send: (kind, data, to) => { void actions[kind].send(data, to ? { target: to } : undefined).catch(() => {}); },
    leave: () => { void r.leave(); },
  };
  const actions: Record<string, MessageAction<Json>> = {};
  for (const k of kinds) {
    const a = r.makeAction<Json>(k);
    a.onMessage = (data, ctx) => t.onMessage(k, data, ctx.peerId);
    actions[k] = a;
  }
  r.onPeerJoin = (id) => t.onJoin(id);
  r.onPeerLeave = (id) => t.onLeave(id);
  return t;
}

/** Same protocol over a BroadcastChannel: every tab of this browser on the same ticket. */
function localTransport(room: string): Transport {
  const self = Math.random().toString(36).slice(2, 10);
  const ch = new BroadcastChannel(`tw-${room}`);
  const seen = new Map<string, number>();
  const t: Transport = {
    onMessage: () => {}, onJoin: () => {}, onLeave: () => {},
    send: (kind, data, to) => ch.postMessage({ from: self, to, kind, data }),
    leave: () => { ch.postMessage({ from: self, kind: '_bye' }); ch.close(); clearInterval(beat); },
  };
  ch.onmessage = (e: MessageEvent<{ from: string; to?: string; kind: string; data: Json }>) => {
    const m = e.data;
    if (m.to && m.to !== self) return;
    if (m.kind === '_bye') { if (seen.delete(m.from)) t.onLeave(m.from); return; }
    if (!seen.has(m.from)) { seen.set(m.from, Date.now()); t.onJoin(m.from); if (m.kind === '_ping') ch.postMessage({ from: self, kind: '_ping' }); }
    seen.set(m.from, Date.now());
    if (m.kind !== '_ping') t.onMessage(m.kind, m.data, m.from);
  };
  const beat = window.setInterval(() => {
    ch.postMessage({ from: self, kind: '_ping' });
    for (const [id, at] of seen) if (Date.now() - at > 5000) { seen.delete(id); t.onLeave(id); }
  }, 1000);
  setTimeout(() => ch.postMessage({ from: self, kind: '_ping' }), 0);
  return t;
}

export class Coop {
  readonly peers = new Map<string, Peer>();
  inWorld = false;
  seat: string;
  /** Friends or a couple: the leader's choice, which everyone else takes from the leader's hello. */
  bond: Bond = 'friend';
  private readonly since = Date.now() + Math.random();
  onPeers: (() => void) | null = null;
  onJoin: ((p: Peer) => void) | null = null;
  onLeave: ((p: Peer) => void) | null = null;
  onEvent: ((p: Peer, e: CoopEvent) => void) | null = null;
  private constructor(private t: Transport, readonly code: string, readonly host: boolean, public dest: string, public me: Profile) {
    this.seat = host ? '1A' : '';
    t.onJoin = (id) => this.hello(id);
    t.onLeave = (id) => this.drop(id);
    t.onMessage = (kind, data, from) => this.message(kind, data, from);
  }

  /** Open (host) or join (guest) the trip behind a ticket code. */
  static async open(code: string, host: boolean, dest: string, me: Profile): Promise<Coop> {
    const room = `trip-${code}`;
    const local = new URLSearchParams(location.search).get('net') === 'local';
    const t = local ? localTransport(room) : await trysteroTransport(room, code);
    return new Coop(t, code, host, dest, me);
  }

  get list(): Peer[] { return [...this.peers.values()]; }
  get hostPeer(): Peer | undefined { return this.list.find((p) => p.host); }

  setProfile(me: Profile): void { this.me = me; this.hello(); }
  setInWorld(on: boolean): void { this.inWorld = on; this.hello(); }
  /** Leader only: travel as friends or as a couple (sent to everyone straight away). */
  setBond(b: Bond): void { if (!this.host || b === this.bond) return; this.bond = b; this.hello(); this.onPeers?.(); }

  /** On a couple's trip, the other half of the couple (leader and seat 1B), if they are here. */
  get partner(): Peer | undefined {
    if (this.bond !== 'lover') return undefined;
    if (this.host) return this.list.find((p) => p.seat === '1B');
    return this.seat === '1B' ? this.hostPeer : undefined;
  }

  /** Movement sample, sent ~10 times a second while in the world. */
  sendState(st: number[]): void { if (this.peers.size) this.t.send('st', st); }
  sendEvent(e: CoopEvent): void { if (this.peers.size) this.t.send('ev', e as unknown as Json); }

  leave(): void {
    this.t.send('bye', null);
    this.t.leave();
    this.peers.clear();
    this.onPeers?.();
  }

  private hello(to?: string): void {
    // guests take the next free seat once they've heard from the others
    if (!this.seat && this.peers.size) {
      const taken = new Set(this.list.map((p) => p.seat));
      for (const l of 'BCDEF') if (!taken.has(`1${l}`)) { this.seat = `1${l}`; break; }
    }
    const hi: Hello = { v: PROTOCOL, ...this.me, host: this.host, dest: this.dest, seat: this.seat, inWorld: this.inWorld, bond: this.bond, since: this.since };
    this.t.send('hi', hi as unknown as Json, to);
  }

  private drop(id: string): void {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    this.onLeave?.(p);
    this.onPeers?.();
  }

  private message(kind: string, data: Json, from: string): void {
    if (kind === 'hi') {
      const hi = data as unknown as Hello;
      if (!hi || hi.v !== PROTOCOL) return;
      const old = this.peers.get(from);
      const p: Peer = {
        id: from, name: String(hi.name || 'Traveller').slice(0, 18), color: Number(hi.color) || 0xe9573f, wear: Array.isArray(hi.wear) ? hi.wear.slice(0, 8) : [],
        host: !!hi.host, dest: String(hi.dest), seat: String(hi.seat || ''), inWorld: !!hi.inWorld, since: Number(hi.since) || 0, st: old?.st ?? null, at: performance.now(),
        look: hi.look && typeof hi.look === 'object' ? hi.look : undefined,
      };
      this.peers.set(from, p);
      if (p.host && !this.host) { this.dest = p.dest; this.bond = hi.bond === 'lover' ? 'lover' : 'friend'; }
      // two guests took the same seat at once: whoever opened the ticket later moves along (seat 1B is the partner's)
      const clash = !this.host && !p.host && !!this.seat && p.seat === this.seat && p.since < this.since;
      if (clash) this.seat = '';
      if (!old) {
        this.hello(from); // make sure they know us too
        this.onJoin?.(p);
      } else if (!this.seat) this.hello();
      if (clash && !old) this.hello();
      this.onPeers?.();
    } else if (kind === 'st') {
      const p = this.peers.get(from);
      if (p && Array.isArray(data) && data.length >= 8) { p.st = data as number[]; p.at = performance.now(); }
    } else if (kind === 'ev') {
      const p = this.peers.get(from);
      if (p && data && typeof data === 'object') this.onEvent?.(p, data as unknown as CoopEvent);
    } else if (kind === 'bye') this.drop(from);
  }
}
