import './styles.css';
import * as THREE from 'three';
import { registerSW } from 'virtual:pwa-register';
import { Renderer, voxelMaterial, Quality } from './engine/renderer';
import { TimeOfDay } from './engine/timeOfDay';
import type { BakedWorld, LightMap2D } from './world/bake';
import type { MeshData } from './world/mesher';
import { buildPerson, buildCat, randomLook, Look } from './world/characters';
import { zoneAt, INTERIOR_ORIGIN } from './world/layout';
import type { FoodId } from './world/food';
import { Nav } from './game/nav';
import { Actor, geometryFrom } from './game/actors';
import { IsoCamera } from './game/camera';
import { Particles, Blobs, Koi } from './game/fx';
import { Audio } from './game/audio';
import { loadState, saveState, resetState, SaveState } from './game/state';
import { DISHES } from './data/dishes';
import { STALL, StallInfo } from './data/stalls';
import { MISSIONS, ITEMS, Mission } from './data/missions';
import { IDLERS, CAT_LINES } from './data/dialogue';
import { PATCH_NOTES } from './data/patchNotes';
import { PLACES, GUEST_LINES, CAPSULES, GACHA_PRICE, roomName, keeperOf, Buyable } from './data/places';
import type { RoomAnchor } from './world/interiors';
import { UI, GameHooks } from './ui/ui';
import { renderDishIcons } from './ui/icons';
import { Travel } from './ui/travel';
import type { Destination } from './data/destinations';
import type { Coop, Peer } from './net/coop';

registerSW({ immediate: true });

type V3 = [number, number, number];

interface Interactable {
  key: string;
  x: number;
  z: number;
  /** Where the player walks to before interacting. */
  stand: [number, number];
  /** Screen-pick anchor (label height). */
  pick: V3;
  r: number;
  inside: boolean;
  prompt(): [string, string, string] | null;
  act(): void;
}

interface Walker { actor: Actor; from: number; to: number; prev: number; path: [number, number][]; speed: number; wait: number; }
interface Cat { actor: Actor; home: V3; target: [number, number] | null; timer: number; }
/** A friend on a co-op trip, drawn from the samples they send. */
interface Remote { actor: Actor; look: string; tag: HTMLElement; name: string; tx: number; ty: number; tz: number; }

const ANIMS = ['idle', 'walk', 'run', 'cook', 'eat', 'wave', 'sit', 'bow'] as const;
const SEND_EVERY = 0.1; // seconds between co-op movement samples

const PLAYER_SPEED = 3.2;
const RUN_SPEED = 4.8; // Shift, a long joystick drag, or a double tap
const FP_FOG = 0.036; // first-person haze density, hides the draw distance
const VIEW_KEY = 'tastyworld.view';
const VENDOR_CALLS = ['Irasshaimase!', 'Fresh and hot!', 'Oishii yo!', 'Come, come!', 'Hai, dōzo!', 'Just made!'];

function playerLook(wear: Record<string, boolean>, color = 0xd8452f): Look {
  const l: Look = {
    skin: 0xf0c8a8, hair: 0x3b2a20, hairStyle: 'short', top: 0xf2efe7, topStyle: 'tee', accent: color,
    bottom: 0x3f6e9a, shoes: 0xf2efe7, hat: 'cap', hatColor: color, backpack: color === 0xf4b63f ? 0xd8452f : 0xe3a937,
  };
  if (wear.happi) { l.topStyle = 'happi'; l.top = 0x2c3d73; l.accent = 0xf2efe7; }
  if (wear.headband) { l.hat = 'headband'; l.hatColor = 0xd8372b; }
  if (wear.chefhat) { l.hat = 'chef'; l.hatColor = 0xf7f4ee; }
  if (wear.charm) l.charm = true;
  return l;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class Game {
  r: Renderer;
  tod = new TimeOfDay();
  cam: IsoCamera;
  audio = new Audio();
  ui: UI;
  s: SaveState;
  w!: BakedWorld;
  navWorld!: Nav;
  navInside!: Nav;
  nav!: Nav;
  lm!: LightMap2D;
  inside = false;
  started = false;
  travel: Travel;
  coop: Coop | null = null;
  /** The travel map covers the screen, so the 3D world can rest. */
  private covered = false;
  private remotes = new Map<string, Remote>();
  private sendT = 0;
  private waveT = 0;
  private lookColor = 0;

  private worldGroup = new THREE.Group();
  private insideGroup = new THREE.Group();
  private chunks: { mesh: THREE.Mesh; box: THREE.Box3; cut: boolean }[] = [];
  private matWorld!: THREE.ShaderMaterial;
  private matCut!: THREE.ShaderMaterial;
  private heightWorld!: THREE.DataTexture;
  private heightInside!: THREE.DataTexture;
  private cutOn = 0;
  private doorClosed = new THREE.Group();
  private shelfClosed = new THREE.Group();
  private shelfOpen = new THREE.Group();
  /** Keepers and regulars inside the shops; only simulated when the player is close. */
  private roomActors: { actor: Actor; room: RoomAnchor; keeper: boolean; facing: number; sit: boolean; anim: 'idle' | 'cook' | 'sit'; talk: number; seed: number }[] = [];
  private roomHere: RoomAnchor | null = null;
  private doorOpen = new THREE.Group();

  player!: Actor;
  private path: [number, number][] = [];
  private pending: Interactable | null = null;
  private pathRun = false;
  private lastTap = { t: 0, x: 0, y: 0 };
  private slideSide = 1;
  private eatT = 0;
  private walkers: Walker[] = [];
  private pathCache = new Map<string, [number, number][]>();
  private idlers: { actor: Actor; id: string; home: V3; baseFacing: number; talk: number; waved: boolean }[] = [];
  private vendors: { actor: Actor; stall: StallInfo; ang: number; waveT: number }[] = [];
  private cats: Cat[] = [];
  private chef!: Actor;
  private blobs!: Blobs;
  private koi!: Koi;
  private particles!: Particles;
  private interactables: Interactable[] = [];
  private near: Interactable | null = null;
  private notified = new Set<string>();
  private keys = new Set<string>();
  private joy: { id: number; sx: number; sy: number; x: number; y: number; active: boolean; run: boolean; t: number } | null = null;
  private pinch: { d: number; a: number; twist: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  /** First-person look drag (right side of a touch screen, or a mouse drag without pointer lock). */
  private lookPtr: { id: number; x: number; y: number; sx: number; sy: number; t: number; moved: boolean } | null = null;
  private wasInside = false;
  private last = performance.now();
  private hudT = 0;
  private callT = 6;
  private v2 = new THREE.Vector2();
  private v3 = new THREE.Vector3();

  constructor() {
    this.s = loadState();
    const canvas = document.getElementById('gl') as HTMLCanvasElement;
    const mobile = matchMedia('(pointer: coarse)').matches;
    const q: Quality = this.s.settings.quality === 'auto' ? (mobile ? 'medium' : 'high') : this.s.settings.quality;
    this.r = new Renderer(canvas, q);
    this.cam = new IsoCamera(this.r.camera, this.r.persp);
    this.r.scene.add(this.worldGroup, this.insideGroup);
    this.insideGroup.visible = false;
    const hooks: GameHooks = {
      buy: (d, st) => this.buy(d, st),
      cooked: (d, st, stars) => this.cooked(d, st, stars),
      claim: (m) => this.claim(m),
      wearChanged: () => { this.rebuildPlayer(); this.save(); this.shareProfile(); },
      settingsChanged: () => { this.applySettings(); this.save(); },
      reset: () => { resetState(); location.reload(); },
      panel: (open) => { if (open) { this.path = []; this.joy = null; } },
    };
    this.ui = new UI(this.s, this.audio, hooks);
    this.ui.onPrompt = () => this.interact();
    this.ui.onRotate = (d) => this.cam.rotate(d);
    this.ui.onView = () => this.setFirstPerson(!this.cam.fp);
    this.travel = new Travel(this.s, this.audio, {
      save: () => {
        this.save();
        if (this.started && this.lookColor !== this.s.profile.color) this.rebuildPlayer();
      },
      board: (d, coop) => this.start(d, coop),
      cover: (on) => { this.covered = on; },
      notes: () => this.ui.notes(),
      coop: () => this.coop,
      attach: (coop) => this.setCoop(coop),
      leave: () => this.setCoop(null),
      overlay: (el, onClose) => this.ui.overlay(el, onClose),
      close: () => this.ui.close(),
      toast: (i, t, x) => this.ui.toast(i, t, x),
    });
    this.ui.onMap = () => this.travel.openMap('view');
    this.ui.onParty = () => this.travel.ticket();
    this.ui.onWave = () => this.wave();
    this.applySettings();
    window.addEventListener('resize', () => this.r.resize());
  }

  // ------------------------------------------------------------------ loading
  async load(): Promise<void> {
    const parts = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const progress = new Array(parts).fill(0);
    let stage = 'Packing your bags…';
    const results = await Promise.all(Array.from({ length: parts }, (_, part) => new Promise<BakedWorld>((resolve, reject) => {
      const worker = new Worker(new URL('./world/worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (e: MessageEvent<{ type: string; stage?: string; f?: number; world?: BakedWorld }>) => {
        if (e.data.type === 'progress') {
          progress[part] = e.data.f ?? 0;
          if (part === 0 && e.data.stage) stage = e.data.stage + '…';
          this.ui.loading(progress.reduce((a, b) => a + b, 0) / parts * 0.9, stage);
        } else if (e.data.type === 'done') {
          resolve(e.data.world!);
          worker.terminate();
        }
      };
      worker.onerror = (err) => reject(err);
      worker.postMessage({ part, parts });
    })));
    const w = results[0];
    for (let i = 1; i < results.length; i++) w.chunks.push(...results[i].chunks);
    this.w = w;
    this.ui.loading(0.93, 'Hanging the lanterns…');
    await sleep(16);
    this.buildScene();
    this.ui.loading(0.97, 'Plating the dishes…');
    await sleep(16);
    this.ui.icons = renderDishIcons(this.r.gl, DISHES.map((d) => d.id));
    this.ui.loading(1, 'Itadakimasu!');
    // warm up shaders with one frame
    this.tod.apply(this.r);
    this.updateCamera(0.016);
    this.r.render();
  }

  private mesh(md: MeshData, mat: THREE.Material, group: THREE.Group): THREE.Mesh {
    const m = new THREE.Mesh(geometryFrom(md), mat);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
    return m;
  }

  private buildScene(): void {
    const w = this.w, a = w.anchors, sh = this.r.shared;
    this.matWorld = voxelMaterial(sh);
    this.matCut = voxelMaterial(sh, { CUTAWAY: 1 });
    for (const md of w.chunks) {
      const m = this.mesh(md, this.matWorld, this.worldGroup);
      this.chunks.push({ mesh: m, box: m.geometry.boundingBox!.clone(), cut: false });
    }
    this.worldGroup.add(this.doorClosed, this.doorOpen, this.shelfClosed, this.shelfOpen);
    const tagGroups: Record<string, THREE.Group> = { 'door-closed': this.doorClosed, 'door-open': this.doorOpen, 'shelf-closed': this.shelfClosed, 'shelf-open': this.shelfOpen };
    for (const t of w.tagged) {
      const m = this.mesh(t.mesh, this.matWorld, tagGroups[t.tag] ?? this.worldGroup);
      this.chunks.push({ mesh: m, box: m.geometry.boundingBox!.clone(), cut: false });
    }
    for (const md of w.interiorChunks) this.mesh(md, this.matCut, this.insideGroup);
    const heightTex = (data: Uint8Array, sx: number, sz: number) => {
      const t = new THREE.DataTexture(data, sx, sz, THREE.RedFormat, THREE.UnsignedByteType);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    this.heightWorld = heightTex(w.height, w.nav.sx, w.nav.sz);
    this.heightInside = heightTex(w.interiorHeight, w.interiorNav.sx, w.interiorNav.sz);
    this.setHeightField(false);
    const shore = new THREE.DataTexture(w.shore, w.nav.sx, w.nav.sz, THREE.RedFormat, THREE.UnsignedByteType);
    shore.magFilter = shore.minFilter = THREE.LinearFilter;
    shore.generateMipmaps = false;
    shore.needsUpdate = true;
    this.r.composite.uniforms.tShore.value = shore;
    this.r.composite.uniforms.uShoreRect.value.set(w.nav.ox, w.nav.oz, 1 / (w.nav.sx * 0.25), 1 / (w.nav.sz * 0.25));
    this.navWorld = new Nav(w.nav);
    this.navInside = new Nav(w.interiorNav);
    this.nav = this.navWorld;
    this.lm = w.lightmap;
    this.setDoor(this.s.manekis.length >= 3);

    this.blobs = new Blobs(this.r.scene, 64);
    this.koi = new Koi(this.worldGroup as unknown as THREE.Scene, this.r, a.koiArea);
    this.particles = new Particles(this.r, a.emitters, [...a.manekis, ...a.darumas]);
    for (const i of this.s.manekis) this.particles.hideSparkle(i);
    for (const i of this.s.darumas) this.particles.hideSparkle(a.manekis.length + i);

    // player
    this.rebuildPlayer();
    this.player.position.set(a.spawn[0], 0, a.spawn[2]);
    this.player.facing = this.player.targetFacing = Math.PI * 0.5;

    // vendors
    for (const sa of a.stalls) {
      const st = STALL[sa.id];
      if (!st) continue;
      const act = new Actor(buildPerson(st.vendorLook), sh);
      act.position.set(sa.vendor[0], this.navWorld.heightAt(sa.vendor[0], sa.vendor[1]), sa.vendor[1]);
      act.facing = act.targetFacing = sa.vendor[2];
      act.anim = 'cook';
      this.worldGroup.add(act.root);
      this.vendors.push({ actor: act, stall: st, ang: sa.vendor[2], waveT: 0 });
      this.ui.label(`stall-${st.id}`, this.plateHtml(st), 'plate', [...sa.label]);
      this.interactables.push({
        key: `stall-${st.id}`, x: sa.stand[0], z: sa.stand[1], stand: sa.stand, pick: [sa.label[0], 1.4, sa.label[2]], r: 1.5, inside: false,
        prompt: () => ['🍢', st.name, `Talk to ${st.vendor}`],
        act: () => this.openStall(st, act, [sa.vendor[0], sa.vendor[1]]),
      });
    }
    // shops, cafés and bars behind the storefronts
    for (const rm of a.rooms) this.buildRoom(rm);
    // tiny daruma hidden in the back rooms
    a.darumas.forEach((d, i) => {
      this.interactables.push({
        key: `daruma-${i}`, x: d[0], z: d[2], stand: [d[0], d[2]], pick: [d[0], d[1] + 0.3, d[2]], r: 1.4, inside: false,
        prompt: () => this.s.darumas.includes(i) ? ['🔴', 'Daruma', 'One eye painted, one to go'] : ['✨', 'Something small and red', 'Take a closer look'],
        act: () => this.findDaruma(i),
      });
    });
    // the bookshop's secret reading room
    const sec = a.secret;
    if (sec) {
      this.setShelf(!!this.s.flags.shelfOpen);
      this.interactables.push({
        key: 'shelf', x: sec.shelf[0], z: sec.shelf[2], stand: sec.shelfStand, pick: sec.shelf, r: 1.5, inside: false,
        prompt: () => this.s.flags.shelfOpen ? ['📚', 'Reading room', 'The shelf stands open'] : ['📕', 'A red book sticks out', 'Pull it'],
        act: () => this.pullBook(),
      });
      this.interactables.push({
        key: 'note', x: sec.note[0], z: sec.note[2], stand: sec.noteStand, pick: sec.note, r: 1.5, inside: false,
        prompt: () => this.s.flags.shelfOpen ? ['📜', 'An old recipe card', 'Read it'] : null,
        act: () => {
          if (!this.s.flags.shelfOpen) return;
          this.audio.play('pop');
          this.ui.dialogue('A recipe card, 1952', [
            '"Tamagoyaki for the night counter. Four eggs, dashi, a spoon of sugar, a pinch of salt. Roll it while it is still shy of set."',
            '"Young Sato asks for this every week. One day he will have a counter of his own, with no sign on the door."',
            'Someone has written underneath in newer ink: "He did. Follow the lucky cats."',
          ]);
        },
      });
    }
    // chef inside the hidden restaurant
    const kak = STALL.kakurega;
    this.chef = new Actor(buildPerson(kak.vendorLook), sh);
    this.chef.position.set(a.chef[0], 0, a.chef[2]);
    this.chef.facing = this.chef.targetFacing = 0;
    this.chef.anim = 'cook';
    this.insideGroup.add(this.chef.root);
    this.interactables.push({
      key: 'chef', x: a.counterStand[0], z: a.counterStand[1], stand: a.counterStand, pick: [a.chef[0], 1.6, a.chef[2]], r: 1.6, inside: true,
      prompt: () => ['🍣', 'Kakurega counter', 'Sit with Chef Sato'],
      act: () => this.openStall(kak, this.chef, [a.chef[0], a.chef[2]]),
    });
    this.interactables.push({
      key: 'exit', x: a.interiorExit[0], z: a.interiorExit[1], stand: a.interiorExit, pick: [a.interiorExit[0], 1.2, a.interiorExit[1]], r: 1.3, inside: true,
      prompt: () => ['🚪', 'Back to Lantern Alley', 'Slide the door open'],
      act: () => void this.teleport(false),
    });

    // idlers with stories
    for (const id of a.idlers) {
      const info = IDLERS[id.id];
      if (!info) continue;
      const act = new Actor(buildPerson(info.look), sh);
      act.position.set(id.pos[0], this.navWorld.heightAt(id.pos[0], id.pos[2]), id.pos[2]);
      const face = Math.random() * Math.PI * 2;
      act.facing = act.targetFacing = face;
      this.worldGroup.add(act.root);
      const entry = { actor: act, id: id.id, home: id.pos, baseFacing: face, talk: 0, waved: false };
      this.idlers.push(entry);
      this.interactables.push({
        key: `idler-${id.id}`, x: id.pos[0], z: id.pos[2], stand: [id.pos[0], id.pos[2]], pick: [id.pos[0], 1.3, id.pos[2]], r: 1.5, inside: false,
        prompt: () => ['💬', info.name, 'Chat'],
        act: () => this.talk(entry),
      });
    }

    // pedestrians wandering the street graph
    const n = this.r.isMobile ? 8 : 14;
    const nodes = a.graph.nodes;
    for (let i = 0; i < n; i++) {
      const act = new Actor(buildPerson(randomLook(1000 + i * 7)), sh);
      const from = (i * 7) % nodes.length;
      act.position.set(nodes[from][0], 0, nodes[from][1]);
      this.worldGroup.add(act.root);
      const wk: Walker = { actor: act, from, to: from, prev: -1, path: [], speed: 1.05 + ((i * 37) % 10) / 22, wait: i * 0.4 };
      this.walkers.push(wk);
    }

    // cats
    a.cats.forEach((c, i) => {
      const act = new Actor(buildCat(77 + i * 13), sh, true);
      act.position.set(c[0], this.navWorld.heightAt(c[0], c[2]), c[2]);
      act.anim = 'sit';
      act.facing = act.targetFacing = i * 2.1;
      this.worldGroup.add(act.root);
      const cat: Cat = { actor: act, home: c, target: null, timer: 3 + i * 2 };
      this.cats.push(cat);
      this.interactables.push({
        key: `cat-${i}`, x: c[0], z: c[2], stand: [c[0], c[2]], pick: [c[0], 0.5, c[2]], r: 1.2, inside: false,
        prompt: () => ['🐈', 'Neighbourhood cat', 'Pet the cat'],
        act: () => {
          const p = cat.actor.position;
          this.audio.play('meow');
          cat.actor.anim = 'sit';
          cat.target = null;
          cat.timer = 5;
          cat.actor.targetFacing = Math.atan2(this.player.position.x - p.x, this.player.position.z - p.z);
          this.ui.bubble(`cat-${i}`, CAT_LINES[Math.floor(Math.random() * CAT_LINES.length)], [p.x, p.y + 0.8, p.z]);
        },
      });
    });
    // keep cat interactables following the cats
    // lucky cats
    a.manekis.forEach((m, i) => {
      this.interactables.push({
        key: `maneki-${i}`, x: m[0], z: m[2], stand: [m[0], m[2]], pick: [m[0], 0.6, m[2]], r: 1.4, inside: false,
        prompt: () => this.s.manekis.includes(i) ? ['🐱', 'Maneki-neko', 'It waves at you, as always'] : ['✨', 'A glinting lucky cat', 'Take a closer look'],
        act: () => this.findManeki(i),
      });
    });
    // vending machines
    a.vending.forEach((v, i) => {
      this.interactables.push({
        key: `vend-${i}`, x: v[0], z: v[2], stand: [v[0], v[2]], pick: [v[0], 1.4, v[2]], r: 1.3, inside: false,
        prompt: () => ['🥤', 'Vending machine', 'Buy a drink · ¥130'],
        act: () => this.vend(),
      });
    });
    // the hidden door
    const hd = a.hiddenDoor;
    this.interactables.push({
      key: 'door', x: hd.stand[0], z: hd.stand[1], stand: hd.stand, pick: hd.label, r: 1.5, inside: false,
      prompt: () => this.s.manekis.length >= 3 ? ['🏮', 'A door with no sign', 'Step inside'] : ['🧱', 'A plain wooden wall', 'Look closer'],
      act: () => {
        if (this.s.manekis.length >= 3) void this.teleport(true);
        else {
          this.audio.play('click');
          this.ui.bubble('door-hint', 'The wood is warm and smells of hinoki… Maybe the lucky cats know something.', [hd.label[0], 2.2, hd.label[2]], 4);
        }
      },
    });

    // notifications already earned before this session should not re-toast
    for (const m of MISSIONS) { const [x, y] = m.progress(this.s); if (x >= y) this.notified.add(m.id); }
  }

  private buildRoom(rm: RoomAnchor): void {
    const sh = this.r.shared;
    const place = PLACES[rm.kind];
    const [name, jp] = roomName(rm.kind, rm.nth);
    const buy = rm.spots.find((sp) => sp.kind === 'buy');
    rm.npcs.forEach((n, i) => {
      const keeper = n.role === 'keeper';
      const info = keeper ? keeperOf(rm.kind, rm.nth, n.seed) : { name: 'Regular', look: randomLook(n.seed) };
      const act = new Actor(buildPerson(info.look), sh);
      act.position.set(n.pos[0], n.sit ? n.pos[1] - 0.58 : this.navWorld.heightAt(n.pos[0], n.pos[2]), n.pos[2]);
      act.facing = act.targetFacing = n.facing;
      const anim = n.sit ? 'sit' : keeper && (rm.kind === 'izakaya' || rm.kind === 'bakery') ? 'cook' : 'idle';
      act.anim = anim;
      act.root.visible = false;
      this.worldGroup.add(act.root);
      const entry = { actor: act, room: rm, keeper, facing: n.facing, sit: n.sit, anim: anim as 'idle' | 'cook' | 'sit', talk: 0, seed: n.seed };
      this.roomActors.push(entry);
      if (keeper && buy) {
        // the keeper serves from the counter: one stop to chat and buy
        this.interactables.push({
          key: `room-${rm.id}`, x: buy.pos[0], z: buy.pos[2], stand: buy.stand, pick: [n.pos[0], 1.6, n.pos[2]], r: 1.7, inside: false,
          prompt: () => [place.buy[0]?.icon ?? '💬', name, `Talk to ${info.name}`],
          act: () => {
            this.faceEachOther(act, n.sit);
            act.anim = 'bow';
            setTimeout(() => { act.anim = anim; }, 1200);
            this.audio.play('pop');
            const line = place.lines[entry.talk++ % place.lines.length];
            this.ui.shop(name, jp, `${place.label} · ${info.name}`, info.name, line, place.buy, (it) => this.buyThing(it));
          },
        });
      } else {
        const stand: [number, number] = [n.pos[0], n.pos[2]];
        this.interactables.push({
          key: `npc-${rm.id}-${i}`, x: n.pos[0], z: n.pos[2], stand, pick: [n.pos[0], 1.25, n.pos[2]], r: 1.5, inside: false,
          prompt: () => ['💬', keeper ? info.name : 'A regular', keeper ? name : 'Chat'],
          act: () => {
            this.faceEachOther(act, n.sit);
            this.audio.play('pop');
            const lines = keeper && place.lines.length ? place.lines : GUEST_LINES;
            const line = lines[(entry.seed + entry.talk++) % lines.length];
            if (!n.sit) act.anim = 'wave';
            this.ui.dialogue(keeper ? info.name : 'A regular', [line], () => { act.anim = anim; act.targetFacing = n.facing; act.headYawTarget = 0; });
          },
        });
      }
    });
    for (const sp of rm.spots) {
      if (sp.kind !== 'gacha') continue;
      this.interactables.push({
        key: `gacha-${rm.id}`, x: sp.pos[0], z: sp.pos[2], stand: sp.stand, pick: [sp.pos[0], 1.0, sp.pos[2]], r: 1.4, inside: false,
        prompt: () => ['🎰', 'Gachapon', `Turn the handle · ¥${GACHA_PRICE}`],
        act: () => this.gacha(sp.pos),
      });
    }
  }

  private faceEachOther(act: Actor, sitting: boolean): void {
    const p = this.player.position, q = act.position;
    this.player.targetFacing = Math.atan2(q.x - p.x, q.z - p.z);
    const want = Math.atan2(p.x - q.x, p.z - q.z);
    if (sitting) act.headYawTarget = THREE.MathUtils.clamp(Math.atan2(Math.sin(want - act.facing), Math.cos(want - act.facing)), -1, 1);
    else act.targetFacing = want;
  }

  private buyThing(it: Buyable): boolean {
    if (this.s.yen < it.price) return false;
    this.s.yen -= it.price;
    this.audio.play('coin');
    this.ui.toast(it.icon, it.name, it.text);
    if (it.snack) { this.eatT = 3.2; this.player.anim = 'eat'; }
    this.afterChange();
    return true;
  }

  private gacha(pos: V3): void {
    if (this.s.yen < GACHA_PRICE) { this.audio.play('fail'); this.ui.toast('👛', 'Not enough yen', `A capsule costs ¥${GACHA_PRICE}.`); return; }
    this.s.yen -= GACHA_PRICE;
    // the golden shrimp is rare; everything else is equally likely
    const roll = Math.random();
    const pool = CAPSULES.filter((c) => !c.rare);
    const cap = roll < 0.05 ? CAPSULES.find((c) => c.rare)! : pool[Math.floor(Math.random() * pool.length)];
    const isNew = !this.s.capsules.includes(cap.id);
    if (isNew) this.s.capsules.push(cap.id);
    this.audio.play(isNew ? 'chime' : 'coin');
    this.ui.bubble('gacha', 'Gacha-gacha… pon!', [pos[0], 1.6, pos[2]], 1.6);
    setTimeout(() => {
      this.ui.toast(cap.icon, isNew ? `New capsule: ${cap.name}` : `Another ${cap.name}`, isNew ? `${this.s.capsules.length} of ${CAPSULES.length} charms collected.${cap.rare ? ' The rare one!' : ''}` : 'A duplicate. Try again?', isNew);
      if (isNew) this.player.flash = 1;
    }, 650);
    this.afterChange();
  }

  private findDaruma(i: number): void {
    const d = this.w.anchors.darumas[i];
    if (this.s.darumas.includes(i)) {
      this.audio.play('chime');
      this.ui.bubble(`daruma-${i}`, 'Fall down seven times, stand up eight.', [d[0], d[1] + 0.8, d[2]]);
      return;
    }
    this.s.darumas.push(i);
    this.particles.hideSparkle(this.w.anchors.manekis.length + i);
    this.audio.play('chime');
    this.player.flash = 1;
    const n = this.s.darumas.length;
    if (n < 8) this.ui.toast('🔴', `Daruma ${n} / 8`, n === 1 ? 'A tiny daruma doll with one eye painted in. Someone has hidden these around the shops.' : 'Another one, tucked away where only the curious look.', true);
    else { this.ui.toast('🎉', 'All eight daruma found!', 'Claim your reward in the Food Passport.', true); this.cam.shake = 0.12; }
    this.afterChange();
  }

  private setShelf(open: boolean): void {
    const sec = this.w.anchors.secret;
    if (!sec) return;
    this.shelfClosed.visible = !open;
    this.shelfOpen.visible = open;
    this.navWorld.setBlocked('shelf', sec.gate, !open);
  }

  private pullBook(): void {
    if (this.s.flags.shelfOpen) { this.audio.play('click'); return; }
    this.s.flags.shelfOpen = true;
    this.audio.play('door');
    this.cam.shake = 0.12;
    this.setShelf(true);
    this.ui.toast('📚', 'A hidden room!', 'The bookshelf swings aside. Behind it: a tiny reading room nobody has dusted in years.', true);
    this.afterChange();
  }

  private roomAt(x: number, z: number): RoomAnchor | null {
    for (const rm of this.w.anchors.rooms) {
      const [x0, z0, x1, z1] = rm.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return rm;
    }
    return null;
  }

  private plateHtml(st: StallInfo): string {
    const done = st.dishes.every((d) => this.s.tasted[d]);
    return `<div class="pn">${st.name}${done ? ' <span class="seen">✓</span>' : ''}<small>${st.jp}</small></div>`;
  }

  private setDoor(open: boolean): void {
    this.doorClosed.visible = !open;
    this.doorOpen.visible = open;
    const hd = this.w.anchors.hiddenDoor;
    if (open && !this.s.hiddenFound) this.ui.label('door', '?', 'marker', [hd.label[0], hd.label[1], hd.label[2]]);
    else this.ui.removeLabel('door');
  }

  rebuildPlayer(): void {
    const old = this.player;
    this.lookColor = this.s.profile.color;
    this.player = new Actor(buildPerson(playerLook(this.s.wear, this.s.profile.color)), this.r.shared);
    if (old) {
      this.player.position.copy(old.position);
      this.player.facing = this.player.targetFacing = old.facing;
      old.root.removeFromParent();
      old.dispose();
      this.player.flash = 1;
    }
    this.r.scene.add(this.player.root);
  }

  // ------------------------------------------------------------------ start
  title(): void {
    this.cam.target.set(34, 0, 30);
    this.cam.zoom = 30;
    this.cam.setOrbit(0.05);
    this.cam.snap();
    this.ui.loaded();
    this.travel.title();
    this.bindInput();
    requestAnimationFrame((t) => this.frame(t));
  }

  private start(_dest: Destination, coop: Coop | null): void {
    this.started = true;
    this.rebuildPlayer(); // the colour may have changed at the gate
    if (coop) {
      // friends land a step apart instead of on top of each other
      if (!coop.host) {
        const p = this.player.position, h = this.navWorld.standHeightVox(p.x, p.z);
        const off = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1]].find(([dx, dz]) => this.navWorld.canStand(p.x + dx, p.z + dz, h));
        if (off) p.set(p.x + off[0], p.y, p.z + off[1]);
      }
      this.setCoop(coop);
    }
    this.cam.setOrbit(0);
    this.cam.yaw = Math.round((this.cam.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
    this.cam.zoom = this.r.isMobile ? 15 : 17;
    this.ui.showHud(true);
    this.applySettings();
    let fp = false;
    try { fp = localStorage.getItem(VIEW_KEY) === 'fp'; } catch { /* storage blocked */ }
    if (fp) this.setFirstPerson(true, true);
    if (!this.s.flags.introSeen) {
      this.s.flags.introSeen = true;
      this.s.flags.lastPatch = PATCH_NOTES[0].version;
      this.save();
      setTimeout(() => this.ui.dialogue('Your travel diary', [
        'Day one in Tokyo! The air smells of grilled soy and sweet batter.',
        'Visit the food stalls to taste local dishes and collect stamps in my Food Passport.',
        'Vendors will even let me help cook. Locals love to share stories, too.',
        'And Grandma Fumiko by the temple said something about lucky cats…',
      ]), 700);
    } else if (this.s.flags.lastPatch !== PATCH_NOTES[0].version) {
      this.s.flags.lastPatch = PATCH_NOTES[0].version;
      this.save();
      setTimeout(() => this.ui.notes(), 600);
    }
  }

  // ------------------------------------------------------------------ game actions
  save(): void { saveState(this.s); }

  applySettings(): void {
    const st = this.s.settings;
    const mobile = matchMedia('(pointer: coarse)').matches;
    if (st.quality === 'auto') { this.r.autoQuality = true; this.r.setQuality(mobile ? 'medium' : 'high'); }
    else { this.r.autoQuality = false; this.r.renderScale = 1; this.r.setQuality(st.quality); this.r.resize(); }
    this.audio.setMusic(st.music);
    this.audio.setSfx(st.sfx);
    this.r.composite.uniforms.uTilt.value = st.tilt && !this.cam.fp ? 0.6 : 0;
    this.tod.dayLength = st.dayLength;
  }

  private buy(d: FoodId, _st: StallInfo): boolean {
    const dish = DISHES.find((x) => x.id === d)!;
    if (this.s.yen < dish.price) return false;
    this.s.yen -= dish.price;
    this.eat(d);
    this.audio.play('coin');
    return true;
  }

  private eat(d: FoodId): void {
    if (!this.s.tasted[d]) this.coop?.sendEvent({ k: 'stamp', dish: d });
    this.s.tasted[d] = (this.s.tasted[d] ?? 0) + 1;
    if (this.tod.isNight) this.s.flags.ateAtNight = true;
    this.eatT = 3.2;
    this.player.anim = 'eat';
    this.afterChange();
  }

  private cooked(d: FoodId, _st: StallInfo, stars: number): number {
    this.s.cooked[d] = Math.max(this.s.cooked[d] ?? 0, stars);
    const tip = stars * 150;
    this.s.yen += tip;
    this.eat(d);
    return tip;
  }

  private claim(m: Mission): void {
    if (this.s.claimed.includes(m.id)) return;
    this.s.claimed.push(m.id);
    const r = m.reward;
    if (r.yen) this.s.yen += r.yen;
    if (r.item && !this.s.items.includes(r.item)) this.s.items.push(r.item);
    if (r.title) this.s.title = r.title;
    this.audio.play('coin');
    const it = r.item ? ITEMS[r.item] : null;
    this.ui.toast(it?.icon ?? '💴', `${m.name} claimed`, [r.yen ? `+¥${r.yen.toLocaleString('en-US')}` : '', it ? it.name : '', r.title ? `Title: ${r.title}` : ''].filter(Boolean).join(' · '), true);
    this.player.flash = 1;
    this.afterChange();
  }

  private afterChange(): void {
    for (const m of MISSIONS) {
      if (this.notified.has(m.id) || this.s.claimed.includes(m.id)) continue;
      const [a, b] = m.progress(this.s);
      if (a >= b) {
        this.notified.add(m.id);
        setTimeout(() => {
          this.audio.play('success');
          this.ui.toast('🎯', `Mission complete: ${m.name}`, 'Claim your reward in the Food Passport.', true);
        }, 900);
      }
    }
    for (const v of this.vendors) this.ui.label(`stall-${v.stall.id}`, this.plateHtml(v.stall), 'plate', this.labelPos(v.stall.id));
    this.ui.refresh();
    this.save();
  }

  private labelPos(id: string): V3 {
    const sa = this.w.anchors.stalls.find((s) => s.id === id)!;
    return [...sa.label];
  }

  private openStall(st: StallInfo, vendor: Actor, at: [number, number]): void {
    const p = this.player.position;
    this.player.targetFacing = Math.atan2(at[0] - p.x, at[1] - p.z);
    vendor.targetFacing = Math.atan2(p.x - at[0], p.z - at[1]);
    const v = this.vendors.find((x) => x.actor === vendor);
    if (v) v.waveT = 1.6;
    else { vendor.anim = 'bow'; setTimeout(() => { vendor.anim = 'cook'; }, 1400); }
    this.audio.play('pop');
    this.ui.stall(st);
  }

  private talk(e: { actor: Actor; id: string; talk: number }): void {
    const info = IDLERS[e.id];
    const p = this.player.position, q = e.actor.position;
    this.player.targetFacing = Math.atan2(q.x - p.x, q.z - p.z);
    e.actor.targetFacing = Math.atan2(p.x - q.x, p.z - q.z);
    e.actor.anim = 'wave';
    this.audio.play('pop');
    const line = info.lines[e.talk % info.lines.length];
    e.talk++;
    if (e.id === 'obaachan') this.s.flags.metFumiko = true;
    this.ui.dialogue(info.name, [line], () => { e.actor.anim = 'idle'; });
  }

  private findManeki(i: number): void {
    if (this.s.manekis.includes(i)) {
      this.audio.play('chime');
      const m = this.w.anchors.manekis[i];
      this.ui.bubble(`maneki-${i}`, 'Its paw beckons good fortune.', [m[0], 1.1, m[2]]);
      return;
    }
    this.s.manekis.push(i);
    this.particles.hideSparkle(i);
    this.audio.play('chime');
    this.player.flash = 1;
    const n = this.s.manekis.length;
    if (n < 3) this.ui.toast('🐱', `Lucky cat ${n} / 3`, n === 1 ? 'A tiny maneki-neko, beckoning with its paw. There must be others.' : 'Another one! Its paw points toward Lantern Alley.', true);
    else {
      this.ui.toast('🏮', 'All three lucky cats found!', 'Their paws all point to a nameless passage off Lantern Alley…', true);
      this.setDoor(true);
      this.cam.shake = 0.15;
    }
    this.afterChange();
  }

  private vend(): void {
    if (this.s.yen < 130) { this.audio.play('fail'); this.ui.toast('👛', 'Not enough yen', 'Even a can of tea costs ¥130.'); return; }
    this.s.yen -= 130;
    const drinks = [['🍵', 'Hot green tea', 'Clunk! A warm can rolls out. Japanese machines sell hot and cold drinks.'], ['🧋', 'Royal milk tea', 'Sweet, creamy and warm. A vending machine classic.'], ['🥤', 'Ramune soda', 'Pop the marble to open it!'], ['☕', 'Canned coffee', 'Tokyo runs on canned coffee.']];
    const d = drinks[Math.floor(Math.random() * drinks.length)];
    this.audio.play('coin');
    this.ui.toast(d[0], d[1], d[2]);
    this.afterChange();
  }

  /** Switch between the isometric view and first person. */
  private setFirstPerson(on: boolean, quiet = false): void {
    if (!this.started || on === this.cam.fp) return;
    this.cam.setFirstPerson(on, this.player.facing);
    this.r.firstPerson = on;
    this.ui.setFirstPerson(on);
    this.r.composite.uniforms.uTilt.value = this.s.settings.tilt && !on ? 0.6 : 0;
    this.lookPtr = null;
    this.joy = null;
    this.pinch = null;
    if (on) this.cutOn = 0;
    else {
      this.player.facing = this.player.targetFacing = this.cam.fpYaw;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    try { localStorage.setItem(VIEW_KEY, on ? 'fp' : 'iso'); } catch { /* storage blocked */ }
    if (!quiet) {
      this.audio.play('whoosh');
      if (on) this.ui.toast('👀', 'First-person view', this.r.isMobile
        ? 'Drag on the left to walk, on the right to look around. Tap the eye to switch back.'
        : 'Click to look around with the mouse, WASD to walk. Press V to switch back.');
    }
  }

  private requestLook(): void {
    if (this.ui.busy) return;
    const canvas = this.r.gl.domElement;
    try { void Promise.resolve(canvas.requestPointerLock()).catch(() => {}); } catch { /* unsupported */ }
  }

  private setHeightField(inside: boolean): void {
    const n = inside ? this.w.interiorNav : this.w.nav;
    const sh = this.r.shared;
    sh.tHeight.value = inside ? this.heightInside : this.heightWorld;
    sh.uHeightRect.value.set(n.ox, n.oz, 1 / (n.sx * 0.25), 1 / (n.sz * 0.25));
  }

  private async teleport(inside: boolean): Promise<void> {
    const fade = document.getElementById('fade')!;
    this.audio.play('door');
    fade.classList.add('on');
    await sleep(650);
    const a = this.w.anchors;
    this.inside = inside;
    this.worldGroup.visible = !inside;
    this.insideGroup.visible = inside;
    this.nav = inside ? this.navInside : this.navWorld;
    this.lm = inside ? this.w.interiorLightmap : this.w.lightmap;
    this.setHeightField(inside);
    this.path = [];
    this.pending = null;
    const [iox, , ioz] = INTERIOR_ORIGIN;
    if (inside) {
      this.player.position.set(a.interiorSpawn[0], 0, a.interiorSpawn[2]);
      this.player.facing = this.player.targetFacing = Math.PI;
      this.cam.bounds = [iox + 4, ioz + 3, iox + 12, ioz + 9];
      this.cam.yaw = Math.PI / 4;
      this.cam.zoom = 11;
      this.r.shared.uBounds.value.set(iox + 0.5, ioz + 0.5, iox + 15.5, ioz + 11.5);
      if (!this.s.hiddenFound) {
        this.s.hiddenFound = true;
        this.coop?.sendEvent({ k: 'secret' });
        this.ui.removeLabel('door');
        setTimeout(() => this.ui.toast('🚪', 'Kakurega · 隠れ家', 'You found the hidden counter. Eight seats, no sign, no menu.', true), 700);
        this.afterChange();
      }
      this.chef.anim = 'bow';
      setTimeout(() => { this.chef.anim = 'cook'; }, 1600);
    } else {
      const hd = a.hiddenDoor;
      this.player.position.set(hd.stand[0] - 0.6, 0, hd.stand[1]);
      this.player.facing = this.player.targetFacing = -Math.PI / 2;
      this.cam.bounds = [2, 3, 70, 54];
      this.cam.zoom = this.r.isMobile ? 15 : 17;
      this.r.shared.uBounds.value.set(0, 0, 72, 56);
    }
    this.player.position.y = this.nav.heightAt(this.player.position.x, this.player.position.z);
    this.cam.target.copy(this.player.position);
    this.cam.snap();
    await sleep(120);
    fade.classList.remove('on');
  }

  private interact(): void {
    if (this.ui.advanceDialogue()) return;
    if (this.ui.busy || !this.near) return;
    this.path = [];
    this.near.act();
  }

  // ------------------------------------------------------------------ co-op
  /** Start (or stop, with null) sharing this trip with friends. */
  private setCoop(coop: Coop | null): void {
    if (this.coop && this.coop !== coop) this.coop.leave();
    this.coop = coop;
    for (const id of [...this.remotes.keys()]) this.dropRemote(id);
    if (!coop) { this.ui.party('', null); return; }
    this.shareProfile();
    if (this.started) coop.setInWorld(true);
    coop.onPeers = () => this.partyChip();
    coop.onJoin = (p) => {
      if (!this.started) return;
      this.audio.play('chime');
      this.ui.toast('🛬', `${p.name} joined the trip!`, p.inWorld ? 'They just landed in Tokyo. Look for their name tag.' : 'They are at the gate and will land any moment.');
    };
    coop.onLeave = (p) => {
      if (this.started) this.ui.toast('👋', `${p.name} left the trip`, 'Their ticket still works if they want to come back.');
      this.dropRemote(p.id);
    };
    coop.onEvent = (p, e) => this.coopEvent(p, e);
    this.partyChip();
  }

  private shareProfile(): void {
    this.coop?.setProfile({ name: this.s.profile.name.trim() || 'Traveller', color: this.s.profile.color, wear: Object.keys(this.s.wear).filter((k) => this.s.wear[k]) });
  }

  private partyChip(): void {
    const c = this.coop;
    if (!c) return;
    const code = `${c.code.slice(0, 3)}-${c.code.slice(3)}`;
    this.ui.party(code, [{ name: this.s.profile.name.trim() || 'You', color: this.s.profile.color, here: true }, ...c.list.map((p) => ({ name: p.name, color: p.color, here: p.inWorld }))]);
  }

  private coopEvent(p: Peer, e: Parameters<NonNullable<Coop['onEvent']>>[1]): void {
    if (!this.started) return;
    const rm = this.remotes.get(p.id);
    if (e.k === 'wave') {
      if (rm) {
        const q = rm.actor.position;
        this.ui.bubble(`wave-${p.id}`, '👋', [q.x, q.y + 2.05, q.z], 1.6);
      }
      this.audio.play('pop');
    } else if (e.k === 'stamp') {
      const d = DISHES.find((x) => x.id === e.dish);
      if (d) this.ui.toast(this.ui.icons[d.id] ?? '🍽️', `${p.name} tasted ${d.name}`, this.s.tasted[d.id] ? 'You have that stamp too. Compare notes!' : 'You haven\'t tried that one yet…');
    } else if (e.k === 'secret') {
      this.ui.toast('🏮', `${p.name} found a hidden counter!`, this.s.hiddenFound ? 'You know the one. Eight seats, no sign.' : 'Somewhere off Lantern Alley… the lucky cats know the way.');
    }
  }

  private wave(): void {
    if (!this.coop || !this.started) return;
    this.waveT = 1.4;
    this.audio.play('pop');
    this.coop.sendEvent({ k: 'wave' });
  }

  private dropRemote(id: string): void {
    const rm = this.remotes.get(id);
    if (!rm) return;
    rm.actor.root.removeFromParent();
    rm.actor.dispose();
    rm.tag.remove();
    this.remotes.delete(id);
  }

  /** Send our movement to friends at a steady rate. */
  private syncCoop(dt: number): void {
    const c = this.coop;
    if (!c || !this.started) return;
    this.sendT -= dt;
    if (this.sendT > 0) return;
    this.sendT = SEND_EVERY;
    const pl = this.player, p = pl.position;
    const r2 = (n: number) => Math.round(n * 100) / 100;
    c.sendState([r2(p.x), r2(p.y), r2(p.z), r2(pl.targetFacing), Math.max(0, ANIMS.indexOf(pl.anim)), r2(pl.speed), this.inside ? 1 : 0, c.host ? r2(this.tod.hour) : -1]);
  }

  /** Friends: glide toward their latest sample, and follow the trip leader's clock. */
  private updateRemotes(dt: number): void {
    const c = this.coop;
    if (!c) return;
    const k = 1 - Math.exp(-dt * 12);
    for (const p of c.list) {
      const st = p.st;
      if (!st || !p.inWorld) { if (this.remotes.has(p.id)) this.dropRemote(p.id); continue; }
      const lookKey = `${p.color}|${p.wear.join(',')}`;
      let rm = this.remotes.get(p.id);
      if (rm && rm.look !== lookKey) { this.dropRemote(p.id); rm = undefined; }
      if (!rm) {
        const wear: Record<string, boolean> = {};
        for (const w of p.wear) wear[w] = true;
        const actor = new Actor(buildPerson(playerLook(wear, p.color)), this.r.shared);
        actor.position.set(st[0], st[1], st[2]);
        actor.facing = actor.targetFacing = st[3];
        actor.flash = 1;
        this.r.scene.add(actor.root);
        const tag = document.createElement('div');
        tag.className = 'buddy';
        tag.style.setProperty('--c', `#${p.color.toString(16).padStart(6, '0')}`);
        tag.innerHTML = '<span class="bn"></span><span class="arr"></span>';
        document.getElementById('labels')!.appendChild(tag);
        rm = { actor, look: lookKey, tag, name: '', tx: st[0], ty: st[1], tz: st[2] };
        this.remotes.set(p.id, rm);
      }
      if (rm.name !== p.name) { rm.name = p.name; (rm.tag.querySelector('.bn') as HTMLElement).textContent = p.name; }
      const a = rm.actor, q = a.position;
      rm.tx = st[0]; rm.ty = st[1]; rm.tz = st[2];
      if (Math.hypot(rm.tx - q.x, rm.tz - q.z) > 4) q.set(rm.tx, rm.ty, rm.tz); // came through a door
      else { q.x += (rm.tx - q.x) * k; q.y += (rm.ty - q.y) * k; q.z += (rm.tz - q.z) * k; }
      a.targetFacing = st[3];
      const anim = ANIMS[st[4]] ?? 'idle';
      a.anim = anim;
      a.speed = st[5];
      a.root.visible = (st[6] === 1) === this.inside && this.started;
      if (!c.host && st[7] >= 0) {
        // keep the sky in step with the trip leader
        let dh = st[7] - this.tod.hour;
        dh -= Math.round(dh / 24) * 24;
        if (Math.abs(dh) > 0.25) this.tod.hour = st[7];
        else this.tod.hour = (this.tod.hour + dh * Math.min(1, dt * 2) + 24) % 24;
      }
    }
    for (const id of [...this.remotes.keys()]) if (!c.peers.has(id)) this.dropRemote(id);
  }

  /** Name tags over friends; when a friend is off screen the tag waits at the edge, pointing their way. */
  private placeTags(): void {
    const W = window.innerWidth, H = window.innerHeight, m = 44;
    for (const rm of this.remotes.values()) {
      const a = rm.actor;
      if (!a.root.visible || this.ui.open) { rm.tag.style.display = 'none'; continue; }
      this.v3.set(a.position.x, a.position.y + 1.75, a.position.z);
      const ok = this.cam.project(this.v3, this.v2);
      let x = this.v2.x, y = this.v2.y;
      if (!ok) { x = W - x; y = H; } // behind the camera in first person
      const edge = !ok || x < m || x > W - m || y < m + 40 || y > H - m;
      rm.tag.style.display = '';
      rm.tag.classList.toggle('edge', edge);
      if (edge) {
        const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
        const s = Math.min((W / 2 - m) / Math.max(1e-3, Math.abs(dx)), (H / 2 - m - 20) / Math.max(1e-3, Math.abs(dy)));
        x = cx + dx * s; y = cy + dy * s;
        (rm.tag.querySelector('.arr') as HTMLElement).style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
      }
      rm.tag.style.left = `${x.toFixed(1)}px`;
      rm.tag.style.top = `${y.toFixed(1)}px`;
    }
  }

  // ------------------------------------------------------------------ input
  private bindInput(): void {
    const canvas = this.r.gl.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
      this.keys.add(e.code);
      if (!this.started) return;
      switch (e.code) {
        case 'Space': case 'Enter': case 'KeyF': e.preventDefault(); this.interact(); break;
        case 'KeyQ': this.cam.rotate(-1); break;
        case 'KeyE': this.cam.rotate(1); break;
        case 'KeyP': this.ui.open ? this.ui.close() : this.ui.passport(); break;
        case 'KeyM': this.ui.open ? this.ui.close() : this.ui.map(); break;
        case 'KeyV': if (!this.ui.busy) this.setFirstPerson(!this.cam.fp); break;
        case 'KeyG': if (!this.ui.busy) this.wave(); break;
        case 'Escape': this.ui.endDialogue(); this.ui.close(); break;
        case 'Equal': case 'NumpadAdd': this.cam.zoomBy(0.85); break;
        case 'Minus': case 'NumpadSubtract': this.cam.zoomBy(1.18); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement === canvas && this.cam.fp && !this.ui.busy) this.cam.look(e.movementX * 0.0022, e.movementY * 0.0022);
    });
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.start();
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.cam.fp) { this.fpPointerDown(e); return; }
      if (this.pointers.size === 2) {
        const [p1, p2] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: Math.atan2(p2.y - p1.y, p2.x - p1.x), twist: 0 };
        this.joy = null;
      } else if (this.pointers.size === 1) {
        this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0, active: false, run: false, t: performance.now() };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      const lp = this.lookPtr;
      if (lp && lp.id === e.pointerId) {
        const k = e.pointerType === 'mouse' ? 0.004 : 0.0058;
        if (!lp.moved && Math.hypot(e.clientX - lp.sx, e.clientY - lp.sy) > 8) lp.moved = true;
        if (lp.moved && !this.ui.busy) this.cam.look((e.clientX - lp.x) * k, (e.clientY - lp.y) * k);
        lp.x = e.clientX; lp.y = e.clientY;
        return;
      }
      if (this.pinch && this.pointers.size >= 2) {
        const [p1, p2] = [...this.pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (d > 0 && this.pinch.d > 0) this.cam.zoomBy(this.pinch.d / d);
        this.pinch.d = d;
        // two-finger twist rotates the view in 90 degree steps
        const a = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        let da = a - this.pinch.a;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        this.pinch.a = a;
        this.pinch.twist += da;
        if (Math.abs(this.pinch.twist) > 0.55) {
          this.cam.rotate(this.pinch.twist > 0 ? 1 : -1);
          this.pinch.twist = 0;
          this.audio.play('whoosh');
        }
        return;
      }
      const j = this.joy;
      if (j && j.id === e.pointerId) {
        const dx = e.clientX - j.sx, dy = e.clientY - j.sy;
        if (!j.active && Math.hypot(dx, dy) > 14) { j.active = true; this.path = []; this.pending = null; }
        if (j.active) {
          const len = Math.hypot(dx, dy), k = Math.min(1, len / 70) / Math.max(1e-3, len);
          j.x = dx * k; j.y = dy * k;
          j.run = len > 105; // drag well past the stick's reach to break into a run
        }
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const lp = this.lookPtr;
      if (lp && lp.id === e.pointerId) {
        this.lookPtr = null;
        if (!lp.moved && performance.now() - lp.t < 450 && e.type === 'pointerup') {
          // a mouse click grabs the pointer for mouse look, a touch tap walks or interacts like in the iso view
          if (e.pointerType === 'mouse') this.requestLook();
          else this.tap(e.clientX, e.clientY);
        }
        return;
      }
      const j = this.joy;
      if (j && j.id === e.pointerId) {
        if (!j.active && performance.now() - j.t < 450 && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
        this.joy = null;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  /** First person: with the mouse locked a click uses whatever is under the crosshair; touches split into a stick (left) and look (right). */
  private fpPointerDown(e: PointerEvent): void {
    const canvas = this.r.gl.domElement;
    if (e.pointerType === 'mouse') {
      if (document.pointerLockElement === canvas) {
        if (e.button === 0) this.fpUse();
        return;
      }
      this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
      return;
    }
    if (e.clientX < window.innerWidth * 0.45 && !this.joy) {
      this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0, active: false, run: false, t: performance.now() };
    } else if (!this.lookPtr) {
      this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    }
  }

  /** Locked-mouse click: interact with what's in reach, or walk to the thing under the crosshair. */
  private fpUse(): void {
    if (this.ui.advanceDialogue()) return;
    if (!this.started || this.ui.busy) return;
    if (this.near) { this.interact(); return; }
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let best: Interactable | null = null, bd = 60;
    for (const it of this.interactables) {
      if (it.inside !== this.inside) continue;
      const sp = this.screen(it.pick);
      if (!sp) continue;
      const d = Math.hypot(sp[0] - cx, sp[1] - cy);
      if (d < bd) { bd = d; best = it; }
    }
    if (!best) return;
    const p = this.player.position;
    const path = this.nav.findPath(p.x, p.z, best.stand[0], best.stand[1]);
    if (path) { this.path = path; this.pending = best; this.audio.play('click'); }
  }

  private tap(x: number, y: number): void {
    if (!this.started || this.ui.busy) return;
    // tapped an interactable?
    let best: Interactable | null = null, bd = 46;
    for (const it of this.interactables) {
      if (it.inside !== this.inside) continue;
      const sp = this.screen(it.pick);
      if (!sp) continue;
      const d = Math.hypot(sp[0] - x, sp[1] - y);
      if (d < bd) { bd = d; best = it; }
    }
    this.ui.tapRing(x, y);
    // a quick second tap near the first one runs there instead of walking
    const now = performance.now(), lt = this.lastTap;
    this.pathRun = now - lt.t < 380 && Math.hypot(x - lt.x, y - lt.y) < 48;
    this.lastTap = { t: this.pathRun ? 0 : now, x, y };
    const p = this.player.position;
    if (best) {
      if (Math.hypot(best.x - p.x, best.z - p.z) < best.r) { this.near = best; this.interact(); return; }
      const path = this.nav.findPath(p.x, p.z, best.stand[0], best.stand[1]);
      if (path) { this.path = path; this.pending = best; this.audio.play('click'); }
      return;
    }
    const hit = this.cam.pick(x, y, this.nav);
    if (!hit) return;
    const path = this.nav.findPath(p.x, p.z, hit.x, hit.z);
    this.pending = null;
    if (path) this.path = path;
  }

  private screen(p: V3): [number, number] | null {
    this.v3.set(p[0], p[1], p[2]);
    if (!this.cam.project(this.v3, this.v2)) return null;
    const m = 80;
    if (this.v2.x < -m || this.v2.y < -m || this.v2.x > window.innerWidth + m || this.v2.y > window.innerHeight + m) return null;
    return [this.v2.x, this.v2.y];
  }

  // ------------------------------------------------------------------ simulation
  private movePlayer(dt: number): void {
    const pl = this.player, p = pl.position;
    let dx = 0, dz = 0, speed = 0, run = false;
    if (!this.ui.busy && this.started) {
      const k = this.keys;
      let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      let rt = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      if (this.joy?.active) { f = -this.joy.y; rt = this.joy.x; }
      if (f || rt) {
        this.path = [];
        this.pending = null;
        const ax = this.cam.groundAxes();
        dx = ax.fwd.x * f + ax.right.x * rt;
        dz = ax.fwd.y * f + ax.right.y * rt;
        const len = Math.hypot(dx, dz);
        run = this.joy?.active ? this.joy.run : k.has('ShiftLeft') || k.has('ShiftRight');
        speed = (run ? RUN_SPEED : PLAYER_SPEED) * Math.min(1, Math.hypot(f, rt));
        dx /= len; dz /= len;
      } else if (this.path.length) {
        const [tx, tz] = this.path[0];
        const ddx = tx - p.x, ddz = tz - p.z, d = Math.hypot(ddx, ddz);
        if (d < 0.12) {
          this.path.shift();
          if (!this.path.length && this.pending) {
            const it = this.pending;
            this.pending = null;
            this.player.targetFacing = Math.atan2(it.x - p.x, it.z - p.z);
            this.near = it;
            it.act();
          }
        } else {
          dx = ddx / d; dz = ddz / d;
          run = this.pathRun || this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
          speed = (run ? RUN_SPEED : PLAYER_SPEED) * (this.path.length === 1 ? Math.min(1, 0.35 + d) : 1);
        }
      }
    }
    if (speed > 0) {
      const hv = this.nav.standHeightVox(p.x, p.z);
      const from = hv === 255 ? 12 : hv;
      const step = speed * dt;
      if (this.path.length > 0) {
        p.x += dx * step; p.z += dz * step;
        pl.targetFacing = Math.atan2(dx, dz);
        if (this.cam.fp) this.cam.turnToward(pl.targetFacing, dt);
      } else {
        // free movement slides along walls and nudges round corners, chairs and tree trunks
        const m = this.nav.slide(p.x, p.z, dx, dz, step, from, this.slideSide);
        if (m) {
          const mx = m.x - p.x, mz = m.z - p.z;
          p.x = m.x; p.z = m.z;
          this.slideSide = m.side;
          speed *= Math.hypot(mx, mz) / step;
          pl.targetFacing = Math.atan2(mx, mz);
        } else speed = 0;
      }
    }
    if (!this.path.length) this.pathRun = false;
    p.y += (this.nav.heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 14);
    pl.speed = speed / 1.4;
    if (this.eatT > 0) { this.eatT -= dt; if (speed > 0) this.eatT = 0; }
    if (this.waveT > 0) { this.waveT -= dt; if (speed > 0) this.waveT = 0; }
    pl.anim = speed > 0 ? (run && speed > PLAYER_SPEED ? 'run' : 'walk') : this.waveT > 0 ? 'wave' : this.eatT > 0 ? 'eat' : 'idle';
    pl.update(dt);
    pl.light(this.lm);
  }

  private legPath(a: number, b: number): [number, number][] {
    const key = `${a}-${b}`;
    let p = this.pathCache.get(key);
    if (!p) {
      const n = this.w.anchors.graph.nodes;
      p = this.navWorld.findPath(n[a][0], n[a][1], n[b][0], n[b][1]) ?? [n[b]];
      this.pathCache.set(key, p);
    }
    return p;
  }

  private updateWalkers(dt: number): void {
    const g = this.w.anchors.graph;
    const pp = this.player.position;
    for (const wk of this.walkers) {
      const a = wk.actor, p = a.position;
      if (wk.wait > 0) {
        wk.wait -= dt;
        a.anim = 'idle';
      } else if (!wk.path.length) {
        const nbrs = g.edges.filter((e) => e[0] === wk.to || e[1] === wk.to).map((e) => (e[0] === wk.to ? e[1] : e[0]));
        let next = nbrs[Math.floor(Math.random() * nbrs.length)];
        if (nbrs.length > 1 && next === wk.prev) next = nbrs.find((x) => x !== wk.prev)!;
        wk.prev = wk.to;
        wk.from = wk.to;
        wk.to = next;
        wk.path = this.legPath(wk.from, wk.to).slice();
        if (Math.random() < 0.25) wk.wait = 1 + Math.random() * 3;
      } else {
        const [tx, tz] = wk.path[0];
        const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
        const blocked = Math.hypot(pp.x - p.x, pp.z - p.z) < 0.7 && (pp.x - p.x) * dx + (pp.z - p.z) * dz > 0 && !this.inside;
        if (d < 0.15) wk.path.shift();
        else if (blocked) a.anim = 'idle';
        else {
          const s = wk.speed * dt;
          p.x += (dx / d) * s; p.z += (dz / d) * s;
          a.targetFacing = Math.atan2(dx, dz);
          a.anim = 'walk';
          a.speed = wk.speed / 1.4;
        }
      }
      p.y = this.navWorld.heightAt(p.x, p.z);
    }
  }

  private updateCats(dt: number): void {
    for (const c of this.cats) {
      const a = c.actor, p = a.position;
      c.timer -= dt;
      if (c.target) {
        const dx = c.target[0] - p.x, dz = c.target[1] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { c.target = null; a.anim = 'sit'; c.timer = 4 + Math.random() * 8; }
        else { p.x += (dx / d) * 0.55 * dt; p.z += (dz / d) * 0.55 * dt; a.targetFacing = Math.atan2(dx, dz); a.anim = 'walk'; a.speed = 0.5; }
      } else if (c.timer <= 0) {
        const tx = c.home[0] + (Math.random() - 0.5) * 3, tz = c.home[2] + (Math.random() - 0.5) * 3;
        if (this.navWorld.canStand(tx, tz, this.navWorld.standHeightVox(p.x, p.z), 0.1)) c.target = [tx, tz];
        else c.timer = 1;
      }
      p.y = this.navWorld.heightAt(p.x, p.z);
    }
  }

  private updateNPCs(dt: number): void {
    const pp = this.player.position;
    if (!this.inside) {
      this.updateWalkers(dt);
      this.updateCats(dt);
      for (const v of this.vendors) {
        if (v.waveT > 0) { v.waveT -= dt; v.actor.anim = 'wave'; if (v.waveT <= 0) { v.actor.anim = 'cook'; v.actor.targetFacing = v.ang; } }
        const d = Math.hypot(pp.x - v.actor.position.x, pp.z - v.actor.position.z);
        v.actor.headYawTarget = d < 4 && v.waveT <= 0 ? THREE.MathUtils.clamp(Math.atan2(pp.x - v.actor.position.x, pp.z - v.actor.position.z) - v.actor.facing, -0.8, 0.8) : 0;
      }
      for (const e of this.idlers) {
        const q = e.actor.position;
        const d = Math.hypot(pp.x - q.x, pp.z - q.z);
        if (d < 3.2) {
          const want = Math.atan2(pp.x - q.x, pp.z - q.z);
          if (!e.waved && this.started) { e.waved = true; e.actor.anim = 'wave'; setTimeout(() => { if (e.actor.anim === 'wave') e.actor.anim = 'idle'; }, 1500); }
          e.actor.targetFacing = want;
        } else if (d > 6) { e.waved = false; e.actor.targetFacing = e.baseFacing; }
      }
      // keep cat prompts on the moving cats
      this.cats.forEach((c, i) => {
        const it = this.interactables.find((x) => x.key === `cat-${i}`);
        if (it) { it.x = it.stand[0] = c.actor.position.x; it.z = it.stand[1] = c.actor.position.z; it.pick[0] = it.x; it.pick[2] = it.z; }
      });
      // a vendor nearby calls out now and then
      this.callT -= dt;
      if (this.callT <= 0 && this.started) {
        this.callT = 7 + Math.random() * 8;
        const close = this.vendors.filter((v) => { const d = Math.hypot(pp.x - v.actor.position.x, pp.z - v.actor.position.z); return d > 2.5 && d < 11; });
        if (close.length && !this.ui.busy) {
          const v = close[Math.floor(Math.random() * close.length)];
          const q = v.actor.position;
          this.ui.bubble(`call-${v.stall.id}`, VENDOR_CALLS[Math.floor(Math.random() * VENDOR_CALLS.length)], [q.x, q.y + 2.1, q.z], 2.4);
        }
      }
    }
    const all: Actor[] = this.inside ? [this.chef] : [...this.vendors.map((v) => v.actor), ...this.idlers.map((e) => e.actor), ...this.walkers.map((w) => w.actor), ...this.cats.map((c) => c.actor)];
    // shop keepers and regulars: only the ones near the player are shown and animated
    for (const e of this.roomActors) {
      const q = e.actor.position;
      const d = Math.hypot(pp.x - q.x, pp.z - q.z);
      const on = !this.inside && d < 24;
      e.actor.root.visible = on;
      if (!on) continue;
      all.push(e.actor);
      if (e.keeper && !e.sit && d < 3.5 && !this.ui.busy) e.actor.headYawTarget = THREE.MathUtils.clamp(Math.atan2(Math.sin(Math.atan2(pp.x - q.x, pp.z - q.z) - e.actor.facing), Math.cos(Math.atan2(pp.x - q.x, pp.z - q.z) - e.actor.facing)), -0.8, 0.8);
      else if (!this.ui.busy) e.actor.headYawTarget = 0;
    }
    this.blobs.begin();
    const pl = this.player.position;
    if (!this.cam.fp) this.blobs.add(pl.x, pl.y + 0.02, pl.z, 0.62, 0.5);
    for (const rm of this.remotes.values()) {
      if (!rm.actor.root.visible) continue;
      all.push(rm.actor);
    }
    for (const a of all) {
      a.update(dt);
      const dx = a.position.x - pl.x, dz = a.position.z - pl.z;
      if (dx * dx + dz * dz < 900) {
        a.light(this.lm);
        this.blobs.add(a.position.x, a.position.y + 0.02, a.position.z, a.isCat ? 0.4 : 0.6, 0.45);
      }
    }
    this.blobs.end();
  }

  private updateNear(): void {
    const p = this.player.position;
    let best: Interactable | null = null, bd = Infinity;
    // in first person, prefer what you're looking at
    const fp = this.cam.fp, f = this.cam.fwd, fl = Math.hypot(f.x, f.z) || 1;
    for (const it of this.interactables) {
      if (it.inside !== this.inside) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d >= it.r) continue;
      const score = fp ? d - (((it.x - p.x) * f.x + (it.z - p.z) * f.z) / (fl * Math.max(d, 0.05))) * 0.8 : d;
      if (score < bd) { bd = score; best = it; }
    }
    this.near = best;
    const pr = best && this.started && !this.ui.busy ? best.prompt() : null;
    if (pr && best) this.ui.prompt(best.key + pr[1], pr[0], pr[1], pr[2]);
    else this.ui.prompt('', '', '');
  }

  /**
   * Buildings between the camera and the player are sliced just above the street (see CUTAWAY in the
   * voxel shader). Only chunks that can contain sliced fragments use the more expensive material.
   */
  private updateCutaway(dt: number): void {
    const p = this.player.position;
    const sh = this.r.shared;
    this.cutOn += ((this.started && !this.cam.fp ? 1 : 0) - this.cutOn) * Math.min(1, dt * 3);
    const R = THREE.MathUtils.clamp(this.cam.zoom * 0.27, 3.6, 7) * (this.inside ? 0.8 : 1);
    sh.uCutOn.value = this.cutOn;
    sh.uCutRadius.value = R;
    sh.uCutH.value = p.y + 1.1; // between voxel layers so the section cap never z-fights a floor
    sh.uCutPos.value.set(p.x, p.y, p.z);
    sh.uCamFwd.value.copy(this.cam.fwd);
    if (this.inside) return;
    const fx = this.cam.fwd.x, fz = this.cam.fwd.z, fl = Math.hypot(fx, fz) || 1;
    const ax = fx / fl, az = fz / fl;
    for (const c of this.chunks) {
      const b = c.box;
      let aMin = Infinity, lMin = Infinity, lMax = -Infinity;
      for (let i = 0; i < 4; i++) {
        const dx = (i & 1 ? b.max.x : b.min.x) - p.x, dz = (i & 2 ? b.max.z : b.min.z) - p.z;
        const al = dx * ax + dz * az, la = dx * az - dz * ax;
        aMin = Math.min(aMin, al); lMin = Math.min(lMin, la); lMax = Math.max(lMax, la);
      }
      const lat = lMin > 0 ? lMin : lMax < 0 ? -lMax : 0;
      const cut = this.cutOn > 0.01 && lat < R + 0.5 && aMin < 0.5;
      if (cut !== c.cut) { c.cut = cut; c.mesh.material = cut ? this.matCut : this.matWorld; }
    }
  }

  private updateCamera(dt: number): void {
    if (this.cam.fp) {
      this.cam.target.copy(this.player.position);
      this.cam.fpSpeed = this.player.speed * 1.4;
      if (this.inside !== this.wasInside) this.cam.fpYaw = this.player.facing; // just came through a door
    } else if (this.started) this.cam.target.copy(this.player.position).add(this.v3.set(0, 0.6, 0));
    this.wasInside = this.inside;
    this.cam.update(dt, window.innerWidth / Math.max(1, window.innerHeight), this.r.pixelHeight);
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const raw = now - this.last;
    this.last = now;
    const dt = Math.min(0.05, raw / 1000);
    const sh = this.r.shared;
    this.syncCoop(dt);
    if (this.covered) return;
    sh.uTime.value += dt;
    this.tod.update(dt);
    this.tod.apply(this.r);
    if (this.inside) { sh.uLamp.value = Math.max(sh.uLamp.value, 0.95); sh.uSunColor.value.multiplyScalar(0.35); }
    if (this.started) this.s.playTime += dt;

    this.movePlayer(dt);
    this.updateRemotes(dt);
    this.updateNPCs(dt);
    this.updateNear();
    this.updateCamera(dt);
    this.updateCutaway(dt);
    const fp = this.cam.fp;
    this.player.root.visible = !fp;
    const eye = this.r.persp.position;
    sh.uFog.value.set(eye.x, eye.y, eye.z, fp && !this.inside ? FP_FOG : 0);
    if (document.pointerLockElement && (!fp || this.ui.busy)) document.exitPointerLock();
    this.koi.update(sh.uTime.value);
    this.particles.update(this.cam.right, this.cam.up, this.tod.particleLight);
    const pl = this.player.position;
    this.ui.updateLabels((p) => this.screen(p), (p) => {
      const d = Math.hypot(p[0] - pl.x, p[2] - pl.z);
      return Math.max(0.0, Math.min(1, 1.6 - d / 14));
    });
    this.placeTags();

    // HUD + audio at a calmer rate
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.25;
      const rm = this.inside ? null : this.roomAt(pl.x, pl.z);
      if (rm !== this.roomHere) {
        this.roomHere = rm;
        if (rm && this.started && !this.s.rooms.includes(rm.id)) { this.s.rooms.push(rm.id); this.afterChange(); }
      }
      const rn = rm ? roomName(rm.kind, rm.nth) : null;
      const z = this.inside ? { name: 'Kakurega · Hidden Counter', jp: '隠れ家' } : rn ? { name: rn[0], jp: rn[1] } : zoneAt(pl.x, pl.z) ?? { name: 'Tokyo', jp: '東京' };
      this.ui.location(z.name, z.jp, this.tod.label());
      let sizzle = 0;
      if (!this.inside) for (const e of this.w.anchors.emitters) {
        if (e.kind === 'incense') continue;
        const d = Math.hypot(e.pos[0] - pl.x, e.pos[2] - pl.z);
        sizzle = Math.max(sizzle, 1 - d / 7);
      }
      const water = this.inside ? 0 : Math.max(0, 1 - Math.abs(pl.z - 46.5) / 9);
      this.audio.ambience(Math.max(0, sizzle), water, this.tod.night, this.inside);
      if (this.started && Math.floor(this.s.playTime) % 10 === 0) this.save();
    }
    this.audio.tick(this.tod.night);
    this.r.render();
    this.r.adapt(raw, now);
  }
}

async function boot() {
  let game: Game;
  try {
    game = new Game();
  } catch (e) {
    console.error(e);
    document.getElementById('load-stage')!.textContent = 'Your browser needs WebGL 2 to visit Tokyo. Try a recent Chrome, Safari or Firefox.';
    return;
  }
  try {
    await game.load();
    game.title();
  } catch (e) {
    console.error(e);
    game.ui.loadError('Something went wrong while building Tokyo.');
  }
}

void boot();
