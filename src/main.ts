import './styles.css';
import * as THREE from 'three';
import { registerSW } from 'virtual:pwa-register';
import { Renderer, voxelMaterial, Quality } from './engine/renderer';
import { farCity } from './engine/farcity';
import { SHADOW_STATIC } from './engine/shadows';
import { TimeOfDay } from './engine/timeOfDay';
import { Perf } from './engine/perf';
import type { BakedWorld, LightMap2D, PartInit } from './world/bake';
import { assemble } from './world/assemble';
import type { WorkerIn, WorkerOut } from './world/worker';
import { Streamer, StreamView } from './engine/streamer';
import type { MeshData } from './world/mesher';
import { buildPerson, buildCat, buildDog, randomLook, Look } from './world/characters';
import { bikeModel, scooterModel, swanBoatModel } from './world/vehicles';
import { zoneAt, INTERIOR_ORIGIN, WX0, WZ0, WX1, WZ1 } from './world/layout';
import { Meal } from './game/meal';
import type { FoodId } from './world/food';
import { Nav } from './game/nav';
import { PathService } from './game/paths';
import { Actor, Anim, geometryFrom, SIT_DROP } from './game/actors';
import { Crowd } from './game/crowd';
import { CharacterBatch } from './game/charbatch';
import { IsoCamera } from './game/camera';
import { Particles, Blobs, Koi } from './game/fx';
import { Birds, type Threat } from './game/birds';
import { Cutaway } from './game/cutaway';
import { Audio } from './game/audio';
import { loadState, saveState, resetState, SaveState, viewMetres, VIEW_DEFAULT } from './game/state';
import { DISHES } from './data/dishes';
import { STALL, StallInfo } from './data/stalls';
import { MISSIONS, ITEMS, Mission } from './data/missions';
import { IDLERS, CAT_LINES } from './data/dialogue';
import { PATCH_NOTES } from './data/patchNotes';
import { PLACES, GUEST_LINES, CAPSULES, GACHA_PRICE, roomName, keeperOf, Buyable } from './data/places';
import type { RoomAnchor } from './world/interiors';
import type { HotelAnchor, HotelRoomAnchor } from './world/hotels';
import { HOTEL, HOTELS, HOTEL_GUEST_LINES, ROOM_TYPE, roomNo } from './data/hotels';
import { UI, GameHooks } from './ui/ui';
import { renderDishIcons } from './ui/icons';
import { Travel } from './ui/travel';
import { CityMap, type Pin } from './ui/citymap';
import { Beacon } from './game/guide';
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
  /** A hotel room upstairs that this belongs to (it is only there while the player is in that room). */
  room?: string;
  prompt(): [string, string, string] | null;
  act(): void;
}

interface Cat { actor: Actor; home: V3; target: [number, number] | null; timer: number; it: Interactable | null; }
/** A friend on a co-op trip, drawn from the samples they send. */
interface Remote { actor: Actor; look: string; tag: HTMLElement; name: string; tx: number; ty: number; tz: number; }

// synced to friends by index: only ever append
const ANIMS: readonly Anim[] = ['idle', 'walk', 'run', 'cook', 'eat', 'wave', 'sit', 'bow', 'sitEat', 'talk', 'listen', 'phone', 'photo', 'browse', 'startle'];
const SEND_EVERY = 0.1; // seconds between co-op movement samples

const PLAYER_SPEED = 3.2;
const RUN_SPEED = 4.8; // Shift, a long joystick drag, or a double tap
const BODY_R = 0.32; // how wide a person is to the sway shader (a cat is 0.1)
const VIEW_KEY = 'tastyworld.view';
const VENDOR_CALLS = ['Irasshaimase!', 'Fresh and hot!', 'Oishii yo!', 'Come, come!', 'Hai, dōzo!', 'Just made!'];

function playerLook(wear: Record<string, boolean>, color = 0xd8452f): Look {
  const l: Look = {
    skin: 0xf0c8a8, hair: 0x3b2a20, hairStyle: 'short', top: 0xf2efe7, topStyle: 'tee', accent: color,
    bottom: 0x3f6e9a, shoes: 0xf2efe7, hat: 'cap', hatColor: color, backpack: color === 0xf4b63f ? 0xd8452f : 0xe3a937,
  };
  if (wear.yukata) { l.topStyle = 'yukata'; l.top = 0x2c3d73; l.accent = 0xe8dcc0; }
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
  private cityMap!: CityMap;
  private beacon!: Beacon;
  /** The walk to the pinned spot: corners still ahead of the player, last one the pin. */
  private route: [number, number][] | null = null;
  private paths!: PathService;
  private routeT = 0;
  private guideEl: HTMLElement | null = null;
  private walkLeft = 0;
  private sendT = 0;
  private waveT = 0;
  private lookColor = 0;

  private worldGroup = new THREE.Group();
  private insideGroup = new THREE.Group();
  private chunks: { mesh: THREE.Mesh; box: THREE.Box3; cut: boolean; occ: number[] }[] = [];
  private cutaway!: Cutaway;
  private workers: Worker[] = [];
  private partOf: (iz: number) => number = () => 0;
  private streamer!: Streamer;
  /** View distance in metres (settings). */
  private viewDist = 120;
  private matWorld!: THREE.ShaderMaterial;
  /** Scratch list of people near the player, nearest first, for the sway shader. */
  private nudgers: [number, Actor][] = [];
  private drawn: Actor[] = [];
  /** Every character's body, drawn in one call. */
  private chars: CharacterBatch;
  private perf!: Perf;
  private matCut!: THREE.ShaderMaterial;
  private heightWorld!: THREE.DataTexture;
  private heightInside!: THREE.DataTexture;
  private solidWorld!: THREE.DataTexture;
  private solidInside!: THREE.DataTexture;
  private doorClosed = new THREE.Group();
  private shelfClosed = new THREE.Group();
  private shelfOpen = new THREE.Group();
  /** Keepers and regulars inside the shops; only simulated when the player is close. */
  private roomActors: { actor: Actor; room: RoomAnchor; keeper: boolean; facing: number; sit: boolean; anim: 'idle' | 'cook' | 'sit'; talk: number; seed: number; snackT: number }[] = [];
  private roomHere: RoomAnchor | null = null;
  /** The hotel room the player is in upstairs (it has its own walk map and light), or null on the street. */
  private upstairs: { room: HotelRoomAnchor; hotel: HotelAnchor; nav: Nav; lm: LightMap2D } | null = null;
  private roomNavs = new Map<string, Nav>();
  /** Hotel rooms already shown this session (the first visit gets a word of welcome). */
  private roomsSeen = new Set<string>();
  /** Lights out in a hotel bed (input waits), and whether the window view switched to first person. */
  private sleeping = false;
  private windowView = false;
  private dusk = false;
  private doorOpen = new THREE.Group();

  player!: Actor;
  private path: [number, number][] = [];
  private pending: Interactable | null = null;
  private pathRun = false;
  private lastTap = { t: 0, x: 0, y: 0 };
  private slideSide = 1;
  private eatT = 0;
  /** The dish being served and eaten right now, and who is serving at the counter we last spoke at. */
  private meal: Meal | null = null;
  private server: Actor | null = null;
  private mealZoom = 0;
  private crowd!: Crowd;
  private idlers: { actor: Actor; id: string; home: V3; baseFacing: number; talk: number; waved: boolean; habit: Anim; habitT: number }[] = [];
  private vendors: { actor: Actor; stall: StallInfo; ang: number; waveT: number }[] = [];
  private cats: Cat[] = [];
  private chef!: Actor;
  private blobs!: Blobs;
  private koi!: Koi;
  private birds!: Birds;
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
    this.perf = new Perf(this.r.gl, () => this.r.shadows.redraws, () => {
      this.s.settings.perf = !this.s.settings.perf;
      this.applySettings();
      this.save();
    });
    this.cam = new IsoCamera(this.r.camera, this.r.persp);
    this.chars = new CharacterBatch(this.r.shared);
    this.r.scene.add(this.chars.mesh);
    this.r.onPass = (name) => this.perf.pass(name);
    this.chars.onView = (drawing) => this.perf.pass(drawing ? 'characters' : 'world');
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
    this.ui.onMap = () => this.openCityMap();
    this.ui.onParty = () => this.travel.ticket();
    this.ui.onWave = () => this.wave();
    this.applySettings();
    window.addEventListener('resize', () => this.r.resize());
  }

  // ------------------------------------------------------------------ loading
  async load(): Promise<void> {
    // each worker builds the whole city but keeps only its strip of chunk rows; fewer on phones to save memory
    const cores = navigator.hardwareConcurrency || 2;
    const parts = Math.max(1, Math.min(this.r.isMobile ? 2 : 4, cores - 1));
    const progress = new Array(parts).fill(0);
    let stage = 'Packing your bags…';
    this.workers = Array.from({ length: parts }, () => new Worker(new URL('./world/worker.ts', import.meta.url), { type: 'module' }));
    const inits = await Promise.all(this.workers.map((worker, part) => new Promise<PartInit>((resolve, reject) => {
      const on = (e: MessageEvent<WorkerOut>) => {
        if (e.data.type === 'progress') {
          progress[part] = e.data.f;
          if (part === 0) stage = e.data.stage + '…';
          this.ui.loading(progress.reduce((a, b) => a + b, 0) / parts * 0.8, stage);
        } else if (e.data.type === 'ready') {
          worker.removeEventListener('message', on);
          resolve(e.data.init);
        }
      };
      worker.addEventListener('message', on);
      worker.onerror = (err) => reject(err);
      worker.postMessage({ type: 'init', part, parts } satisfies WorkerIn);
    })));
    this.w = assemble(inits);
    // chunks meshed from here on keep the walls between neighbouring buildings (see world/owners.ts)
    for (const wk of this.workers) wk.postMessage({ type: 'owners', id: this.w.owners.world.id } satisfies WorkerIn);
    const rowsOf = inits.map((p) => p.rows);
    this.partOf = (iz: number) => Math.max(0, rowsOf.findIndex(([r0, r1]) => iz >= r0 && iz < r1));
    this.ui.loading(0.82, 'Hanging the lanterns…');
    await sleep(16);
    this.buildScene();
    // stream in what the title screen shows before lifting the curtain
    this.ui.loading(0.86, 'Raising the rooftops…');
    this.titleView();
    this.updateCamera(0.016);
    const done = this.streamer.ready();
    const tick = setInterval(() => this.streamer.update(0.05, this.streamView()), 50);
    await done;
    clearInterval(tick);
    this.ui.loading(0.97, 'Plating the dishes…');
    await sleep(16);
    this.ui.icons = renderDishIcons(this.r.gl, DISHES.map((d) => d.id));
    this.ui.loading(1, 'Itadakimasu!');
    // warm up shaders with one frame
    this.tod.apply(this.r);
    this.chars.sync();
    this.r.render();
  }

  /** What the chunk streamer should keep loaded for the current camera. */
  private streamView(): StreamView {
    const fp = this.cam.fp;
    // room contents: 20 m around you in first person; in the iso view as far as the crowd is drawn (about the
    // screen) up to 36 m: zoomed further out, a glimpse through a doorway is a few pixels, not worth a draw each
    const inner = fp ? 20 : Math.min(36, Math.max(20, this.cam.zoom * 1.3 + 8));
    return { cam: this.r.view, fp, focus: this.started ? this.player.position : this.cam.target, inner };
  }

  private mesh(md: MeshData, mat: THREE.Material, group: THREE.Group): THREE.Mesh {
    const m = new THREE.Mesh(geometryFrom(md), mat);
    m.layers.enable(SHADOW_STATIC);
    m.matrixAutoUpdate = false;
    m.updateMatrix();
    group.add(m);
    return m;
  }

  private buildScene(): void {
    const w = this.w, a = w.anchors, sh = this.r.shared;
    const sw = new THREE.DataTexture(w.sway.data, w.sway.width, w.sway.height, THREE.RGBAFormat, THREE.FloatType);
    sw.magFilter = sw.minFilter = THREE.NearestFilter;
    sw.generateMipmaps = false;
    sw.needsUpdate = true;
    sh.tSway.value = sw;
    this.matWorld = voxelMaterial(sh, { SWAY: 1 });
    this.matCut = voxelMaterial(sh, { CUTAWAY: 1, SWAY: 1 });
    // double-sided so a neighbour's unmeshed party wall shows its far side instead of a hole
    this.matCut.side = THREE.DoubleSide;
    this.worldGroup.add(this.doorClosed, this.doorOpen, this.shelfClosed, this.shelfOpen);
    // the rest of Tokyo beyond the map, with gaps where the canal and the two avenues carry on
    const far = farCity(sh, [WX0, WZ0, WX1, WZ1], [[-1e4, 39.5, 1e4, 53], [-1e4, -28.5, 1e4, -17.5], [71.5, -1e4, 82.5, 1e4]]);
    this.worldGroup.add(far.ground, far.city);
    sh.uBounds.value.set(WX0, WZ0, WX1, WZ1);
    this.cam.bounds = [WX0 + 2, WZ0 + 2, WX1 - 2, WZ1 - 2];
    this.r.composite.uniforms.uWaterBounds.value.set(WX0 - 5, WZ0 - 5, WX1 + 5, WZ1 + 5);
    const tagGroups: Record<string, THREE.Group> = { 'door-closed': this.doorClosed, 'door-open': this.doorOpen, 'shelf-closed': this.shelfClosed, 'shelf-open': this.shelfOpen };
    for (const t of w.tagged) {
      const m = this.mesh(t.mesh, this.matWorld, tagGroups[t.tag] ?? this.worldGroup);
      this.chunks.push({ mesh: m, box: m.geometry.boundingBox!.clone(), cut: false, occ: [] });
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
    const solidTex = (data: Uint32Array, sx: number, sz: number) => {
      const t = new THREE.DataTexture(data, sx, sz, THREE.RGIntegerFormat, THREE.UnsignedIntType);
      t.internalFormat = 'RG32UI';
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    this.solidWorld = solidTex(w.solid, w.nav.sx, w.nav.sz);
    this.solidInside = solidTex(w.interiorSolid, w.interiorNav.sx, w.interiorNav.sz);
    this.cutaway = new Cutaway(w.owners, w.nav, w.interiorNav, { height: w.height, solid: w.solid }, { height: w.interiorHeight, solid: w.interiorSolid });
    sh.tCut.value = this.cutaway.cut;
    for (const c of this.chunks) c.occ = this.cutaway.touching(c.box.min.x, c.box.min.z, c.box.max.x, c.box.max.z);
    this.streamer = new Streamer(this.workers, this.partOf, w.height, this.worldGroup, () => this.matWorld, this.r.isMobile);
    this.streamer.dist = this.viewDist;
    this.streamer.fadeMaterial = () => voxelMaterial(sh, { SWAY: 1, LODFADE: 1 }, { uFade: { value: new THREE.Vector2() } });
    this.streamer.onMesh = (c, m) => {
      const [x0, z0, x1, z1] = this.streamer.rect(c);
      c.occ = this.cutaway.touching(x0, z0, x1, z1);
      m.material = c.cut ? this.matCut : this.matWorld;
      m.layers.enable(SHADOW_STATIC);
    };
    this.setHeightField(false);
    // compile the cutaway shader up front (the Kakurega uses it too) so the first building to lower doesn't hitch
    this.insideGroup.visible = true;
    // and the level-of-detail dissolve, so the first swap doesn't either
    const fadeProbe = new THREE.Mesh(new THREE.BufferGeometry(), this.streamer.fadeMaterial());
    this.insideGroup.add(fadeProbe);
    this.r.gl.compile(this.r.scene, this.r.camera);
    fadeProbe.removeFromParent();
    this.insideGroup.visible = false;
    const shore = new THREE.DataTexture(w.shore, w.nav.sx, w.nav.sz, THREE.RedFormat, THREE.UnsignedByteType);
    shore.magFilter = shore.minFilter = THREE.LinearFilter;
    shore.generateMipmaps = false;
    shore.needsUpdate = true;
    this.r.composite.uniforms.tShore.value = shore;
    this.r.composite.uniforms.uShoreRect.value.set(w.nav.ox, w.nav.oz, 1 / (w.nav.sx * 0.25), 1 / (w.nav.sz * 0.25));
    this.navWorld = new Nav(w.nav);
    this.paths = new PathService(w.nav);
    this.navInside = new Nav(w.interiorNav);
    this.nav = this.navWorld;
    this.lm = w.lightmap;
    this.setDoor(this.s.manekis.length >= 3);

    this.blobs = new Blobs(this.r.scene, 160);
    this.koi = new Koi(this.worldGroup as unknown as THREE.Scene, this.r, a.koiArea);
    this.particles = new Particles(this.r, a.emitters, [...a.manekis, ...a.darumas]);
    this.beacon = new Beacon(this.r.scene);
    this.cityMap = new CityMap({ nav: w.nav, shore: w.shore, occluders: a.occluders, stalls: a.stalls, hiddenDoor: a.hiddenDoor.stand, hotels: a.hotels }, {
      player: () => {
        const [x, z] = this.mapPos();
        const f = this.cam.fwd, fl = Math.hypot(f.x, f.z) || 1;
        return { x, z, facing: this.player.facing, view: [f.x / fl, f.z / fl] };
      },
      friends: () => (this.coop?.list ?? []).filter((p) => p.st && p.inWorld).map((p) => {
        const st = p.st!, [x, z] = st[6] === 1 ? this.w.anchors.hiddenDoor.stand : [st[0], st[2]];
        return { id: p.id, name: p.name, color: p.color, x, z };
      }),
      pin: () => this.s.pin ?? null,
      route: () => this.route,
      setPin: (p) => this.setPin(p),
      worldMap: () => this.travel.openMap('view'),
      close: () => this.ui.close(),
      click: () => this.audio.play('click'),
    });
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
      const act = new Actor(buildPerson(st.vendorLook), this.chars);
      act.position.set(sa.vendor[0], this.navWorld.heightAt(sa.vendor[0], sa.vendor[1]), sa.vendor[1]);
      act.facing = act.targetFacing = sa.vendor[2];
      act.anim = 'cook';
      this.worldGroup.add(act.root);
      this.vendors.push({ actor: act, stall: st, ang: sa.vendor[2], waveT: 0 });
      this.interactables.push({
        key: `stall-${st.id}`, x: sa.stand[0], z: sa.stand[1], stand: sa.stand, pick: [sa.label[0], 1.4, sa.label[2]], r: 1.5, inside: false,
        prompt: () => ['stall', st.name, `Talk to ${st.vendor}`],
        act: () => this.openStall(st, act, [sa.vendor[0], sa.vendor[1]]),
      });
    }
    // shops, cafés and bars behind the storefronts
    for (const rm of a.rooms) this.buildRoom(rm);
    this.buildHotels();
    // tiny daruma hidden in the back rooms
    a.darumas.forEach((d, i) => {
      this.interactables.push({
        key: `daruma-${i}`, x: d[0], z: d[2], stand: [d[0], d[2]], pick: [d[0], d[1] + 0.3, d[2]], r: 1.4, inside: false,
        prompt: () => this.s.darumas.includes(i) ? ['daruma', 'Daruma', 'One eye painted, one to go'] : ['sparkle', 'Something small and red', 'Take a closer look'],
        act: () => this.findDaruma(i),
      });
    });
    // the bookshop's secret reading room
    const sec = a.secret;
    if (sec) {
      this.setShelf(!!this.s.flags.shelfOpen);
      this.interactables.push({
        key: 'shelf', x: sec.shelf[0], z: sec.shelf[2], stand: sec.shelfStand, pick: sec.shelf, r: 1.5, inside: false,
        prompt: () => this.s.flags.shelfOpen ? ['book', 'Reading room', 'The shelf stands open'] : ['book', 'A red book sticks out', 'Pull it'],
        act: () => this.pullBook(),
      });
      this.interactables.push({
        key: 'note', x: sec.note[0], z: sec.note[2], stand: sec.noteStand, pick: sec.note, r: 1.5, inside: false,
        prompt: () => this.s.flags.shelfOpen ? ['scroll', 'An old recipe card', 'Read it'] : null,
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
    this.chef = new Actor(buildPerson(kak.vendorLook), this.chars);
    this.chef.position.set(a.chef[0], 0, a.chef[2]);
    this.chef.facing = this.chef.targetFacing = 0;
    this.chef.anim = 'cook';
    this.insideGroup.add(this.chef.root);
    this.interactables.push({
      key: 'chef', x: a.counterStand[0], z: a.counterStand[1], stand: a.counterStand, pick: [a.chef[0], 1.6, a.chef[2]], r: 1.6, inside: true,
      prompt: () => ['sushi', 'Kakurega counter', 'Sit with Chef Sato'],
      act: () => this.openStall(kak, this.chef, [a.chef[0], a.chef[2]]),
    });
    this.interactables.push({
      key: 'exit', x: a.interiorExit[0], z: a.interiorExit[1], stand: a.interiorExit, pick: [a.interiorExit[0], 1.2, a.interiorExit[1]], r: 1.3, inside: true,
      prompt: () => ['door', 'Back to Lantern Alley', 'Slide the door open'],
      act: () => void this.teleport(false),
    });

    // idlers with stories
    for (const id of a.idlers) {
      const info = IDLERS[id.id];
      if (!info) continue;
      const act = new Actor(buildPerson(info.look), this.chars);
      act.position.set(id.pos[0], this.navWorld.heightAt(id.pos[0], id.pos[2]), id.pos[2]);
      const face = Math.random() * Math.PI * 2;
      act.facing = act.targetFacing = face;
      this.worldGroup.add(act.root);
      const habit: Anim = id.id === 'tourist' ? 'photo' : id.id === 'salaryman' || id.id === 'student' ? 'phone' : id.id === 'florist' ? 'browse' : 'idle';
      const entry = { actor: act, id: id.id, home: id.pos, baseFacing: face, talk: 0, waved: false, habit, habitT: 3 + Math.random() * 8 };
      this.idlers.push(entry);
      this.interactables.push({
        key: `idler-${id.id}`, x: id.pos[0], z: id.pos[2], stand: [id.pos[0], id.pos[2]], pick: [id.pos[0], 1.3, id.pos[2]], r: 1.5, inside: false,
        prompt: () => ['chat', info.name, 'Chat'],
        act: () => this.talk(entry),
      });
    }

    // your own footsteps follow the walk cycle, softly
    Actor.onStep = (act, run) => { if (act === this.player) this.audio.step(act.position.x, act.position.z, run); };
    this.audio.setRooms(a.rooms.map((rm) => ({ rect: rm.rect, kind: rm.kind })));

    // the city's people going about their day; bodies are only built when they first come into view
    const lazy = (act: Actor) => { act.root.visible = false; this.worldGroup.add(act.root); return act; };
    this.crowd = new Crowd(this.navWorld, a, {
      bubble: (key, text, pos, secs) => this.ui.bubble(key, text, pos, secs),
      serve: (id, x, z) => {
        const v = this.vendors.find((q) => q.stall.id === id);
        if (!v || v.waveT > 0) return;
        v.waveT = 1.2;
        v.actor.targetFacing = Math.atan2(x - v.actor.position.x, z - v.actor.position.z);
      },
      quiet: () => !this.started || this.ui.busy,
    }, {
      person: (look) => lazy(new Actor(buildPerson(look), this.chars, false, true)),
      dog: (seed) => { const d = lazy(new Actor(buildDog(seed), this.chars, true, true)); d.dog = true; return d; },
      vehicle: (kind, seed) => lazy(new Actor(kind === 'bike' ? bikeModel(seed) : scooterModel(seed), this.chars, true, true)),
      boat: (seed) => lazy(new Actor(swanBoatModel(seed), this.chars, true, true)),
    });
    this.crowd.router = this.paths;
    for (const id of a.idlers) this.crowd.addObstacle(id.pos[0], id.pos[2]);
    const m = this.r.isMobile;
    this.crowd.populate(m
      ? { walkers: 85, joggers: 4, dogs: 4, cyclists: 5, couriers: 3, boats: 2, exercise: 6 }
      : { walkers: 190, joggers: 8, dogs: 8, cyclists: 10, couriers: 6, boats: 3, exercise: 9 });
    this.crowd.settle(this.tod.hour);
    // pigeons, sparrows, crows and the rest, on the ground, the roofs and the wires
    this.birds = new Birds({ nav: w.nav, height: w.height, solid: w.solid, shore: w.shore, lightmap: w.lightmap, anchors: a }, this.chars);

    // cats
    a.cats.forEach((c, i) => {
      const act = new Actor(buildCat(77 + i * 13), this.chars, true);
      act.position.set(c[0], this.navWorld.heightAt(c[0], c[2]), c[2]);
      act.anim = 'sit';
      act.facing = act.targetFacing = i * 2.1;
      this.worldGroup.add(act.root);
      const cat: Cat = { actor: act, home: c, target: null, timer: 3 + i * 2, it: null };
      this.cats.push(cat);
      this.interactables.push(cat.it = {
        key: `cat-${i}`, x: c[0], z: c[2], stand: [c[0], c[2]], pick: [c[0], 0.5, c[2]], r: 1.2, inside: false,
        prompt: () => ['cat', 'Neighbourhood cat', 'Pet the cat'],
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
        prompt: () => this.s.manekis.includes(i) ? ['cat', 'Maneki-neko', 'It waves at you, as always'] : ['sparkle', 'A glinting lucky cat', 'Take a closer look'],
        act: () => this.findManeki(i),
      });
    });
    // vending machines
    a.vending.forEach((v, i) => {
      this.interactables.push({
        key: `vend-${i}`, x: v[0], z: v[2], stand: [v[0], v[2]], pick: [v[0], 1.4, v[2]], r: 1.3, inside: false,
        prompt: () => ['can', 'Vending machine', 'Buy a drink · ¥130'],
        act: () => this.vend(),
      });
    });
    // the hidden door
    const hd = a.hiddenDoor;
    this.interactables.push({
      key: 'door', x: hd.stand[0], z: hd.stand[1], stand: hd.stand, pick: hd.label, r: 1.5, inside: false,
      prompt: () => this.s.manekis.length >= 3 ? ['lantern', 'A door with no sign', 'Step inside'] : ['wall', 'A plain wooden wall', 'Look closer'],
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
    const place = PLACES[rm.kind];
    const [name, jp] = roomName(rm.kind, rm.nth, rm.hotel);
    const buy = rm.spots.find((sp) => sp.kind === 'buy');
    rm.npcs.forEach((n, i) => {
      const keeper = n.role === 'keeper';
      const info = keeper ? keeperOf(rm.kind, rm.nth, n.seed, rm.hotel) : { name: rm.hotel ? 'A guest' : 'Regular', look: randomLook(n.seed) };
      const act = new Actor(buildPerson(info.look), this.chars, false, true); // built when first near
      act.position.set(n.pos[0], n.sit ? n.pos[1] - SIT_DROP : this.navWorld.heightAt(n.pos[0], n.pos[2]), n.pos[2]);
      act.facing = act.targetFacing = n.facing;
      const anim = n.sit ? 'sit' : keeper && (rm.kind === 'izakaya' || rm.kind === 'bakery') ? 'cook' : 'idle';
      act.anim = anim;
      act.root.visible = false;
      this.worldGroup.add(act.root);
      const entry = { actor: act, room: rm, keeper, facing: n.facing, sit: n.sit, anim: anim as 'idle' | 'cook' | 'sit', talk: 0, seed: n.seed, snackT: 4 + Math.random() * 12 };
      this.roomActors.push(entry);
      if (keeper && buy && rm.hotel) {
        // the front desk: check in, or chat with the keeper once you have a key
        const hid = rm.hotel;
        this.interactables.push({
          key: `room-${rm.id}`, x: buy.pos[0], z: buy.pos[2], stand: buy.stand, pick: [n.pos[0], 1.6, n.pos[2]], r: 1.7, inside: false,
          prompt: () => ['bell', name, this.s.hotel?.id === hid ? `Talk to ${info.name}` : `Check in with ${info.name}`],
          act: () => {
            this.faceEachOther(act, n.sit);
            act.anim = 'bow';
            setTimeout(() => { if (act.anim === 'bow') act.anim = anim; }, 1200);
            this.audio.play('clink');
            this.frontDesk(hid, entry);
          },
        });
      } else if (keeper && buy) {
        // the keeper serves from the counter: one stop to chat and buy
        this.interactables.push({
          key: `room-${rm.id}`, x: buy.pos[0], z: buy.pos[2], stand: buy.stand, pick: [n.pos[0], 1.6, n.pos[2]], r: 1.7, inside: false,
          prompt: () => [place.buy[0]?.icon ?? 'chat', name, `Talk to ${info.name}`],
          act: () => {
            this.faceEachOther(act, n.sit);
            this.server = act;
            act.anim = 'bow';
            setTimeout(() => { if (act.anim === 'bow') act.anim = anim; }, 1200);
            this.audio.play('pop');
            const line = place.lines[entry.talk++ % place.lines.length];
            this.ui.shop(name, jp, `${place.label} · ${info.name}`, info.name, line, place.buy, (it) => this.buyThing(it));
          },
        });
      } else {
        const stand: [number, number] = [n.pos[0], n.pos[2]];
        this.interactables.push({
          key: `npc-${rm.id}-${i}`, x: n.pos[0], z: n.pos[2], stand, pick: [n.pos[0], 1.25, n.pos[2]], r: 1.5, inside: false,
          prompt: () => ['chat', keeper ? info.name : 'A regular', keeper ? name : 'Chat'],
          act: () => {
            this.faceEachOther(act, n.sit);
            this.audio.play('pop');
            const lines = keeper && place.lines.length ? place.lines : rm.hotel ? HOTEL_GUEST_LINES : GUEST_LINES;
            const line = lines[(entry.seed + entry.talk++) % lines.length];
            if (!n.sit) act.anim = 'wave';
            this.ui.dialogue(keeper ? info.name : rm.hotel ? 'A guest' : 'A regular', [line], () => { act.anim = anim; act.targetFacing = n.facing; act.headYawTarget = 0; });
          },
        });
      }
    });
    for (const sp of rm.spots) {
      if (sp.kind !== 'gacha') continue;
      this.interactables.push({
        key: `gacha-${rm.id}`, x: sp.pos[0], z: sp.pos[2], stand: sp.stand, pick: [sp.pos[0], 1.0, sp.pos[2]], r: 1.4, inside: false,
        prompt: () => ['capsule', 'Gachapon', `Turn the handle · ¥${GACHA_PRICE}`],
        act: () => this.gacha(sp.pos),
      });
    }
  }

  // ------------------------------------------------------------------ hotels
  /** The lift (or a ryokan's stairs) in every lobby, and the bed, window, kettle and door of every room upstairs. */
  private buildHotels(): void {
    const a = this.w.anchors;
    for (const ha of a.hotels) {
      const info = HOTEL[ha.id];
      const lift = a.rooms.find((r) => r.id === ha.lobby)?.lift;
      if (!info || !lift) continue;
      const stairs = info.theme === 'ryokan';
      const icon = stairs ? 'stairs' : 'lift';
      this.interactables.push({
        key: `lift-${ha.id}`, x: lift.pick[0], z: lift.pick[2], stand: lift.stand, pick: lift.pick, r: 1.5, inside: false,
        prompt: () => {
          const rm = this.booking(ha.id);
          return rm ? [icon, `Room ${roomNo(rm.floor)}`, stairs ? 'Up the stairs' : 'Take the lift up'] : [icon, stairs ? 'Stairs' : 'Lift', 'Guests only'];
        },
        act: () => {
          const rm = this.booking(ha.id);
          if (rm) void this.goUpstairs(ha, rm);
          else { this.audio.play('click'); this.ui.toast('bell', 'Guests only', `Check in at the front desk with ${info.keeper} first.`); }
        },
      });
      for (const rm of ha.rooms) {
        const no = roomNo(rm.floor);
        const near = (st: [number, number], pick: V3) => Math.hypot(st[0] - pick[0], st[1] - pick[2]) + 0.6;
        const it = (key: string, stand: [number, number], pick: V3, prompt: () => [string, string, string], act: () => void, r = near(stand, pick)) =>
          this.interactables.push({ key: `${key}-${rm.id}`, x: pick[0], z: pick[2], stand, pick, r, inside: false, room: rm.id, prompt, act });
        it('hdoor', rm.door.stand, rm.door.pick, () => ['door', `Room ${no}`, 'Back down to the lobby'], () => void this.goDownstairs(), 1.4);
        it('bed', rm.bed.stand, rm.bed.pick, () => {
          const h = this.tod.hour;
          return [rm.type === 'tatami' ? 'futon' : 'bed', ROOM_TYPE[rm.type].name, h >= 17 || h < 6 ? 'Sleep until morning' : 'Take a nap'];
        }, () => { this.player.targetFacing = rm.bed.facing; void this.sleepIn(rm); });
        it('win', rm.window.stand, rm.window.pick, () => ['skyline', 'The window', 'Look out over the city'], () => this.lookOut(rm));
        it('tea', rm.tea.stand, rm.tea.pick, () => ['tea', rm.type === 'tatami' ? 'Tea set' : 'Kettle', 'Make a cup of green tea'], () => {
          this.player.targetFacing = rm.tea.facing;
          this.audio.play('pop');
          this.ui.toast('tea', 'Green tea', rm.type === 'tatami' ? 'The okami left a pot of sencha and two rice crackers. Perfect.' : 'The kettle clicks off. A tea bag from the tray, hot water and a moment to yourself.');
          this.startMeal('tea', null, () => {});
        });
      }
    }
  }

  /** Tonight's room at a hotel, if the booking is there. */
  private booking(hotel: string): HotelRoomAnchor | null {
    const b = this.s.hotel;
    if (!b || b.id !== hotel) return null;
    return this.w.anchors.hotels.find((h) => h.id === hotel)?.rooms.find((r) => r.id === b.room) ?? null;
  }

  private frontDesk(id: string, entry: { talk: number }): void {
    const info = HOTEL[id], ha = this.w.anchors.hotels.find((h) => h.id === id);
    if (!info || !ha) return;
    const line = info.lines[entry.talk++ % info.lines.length];
    const b = this.s.hotel;
    this.ui.hotel(info, line, ha.rooms.map((r) => ({ id: r.id, floor: r.floor, type: r.type, price: r.price })),
      b?.id === id ? b.room : null, b && b.id !== id ? HOTEL[b.id]?.name ?? null : null, (rid) => this.checkIn(ha, rid));
  }

  private checkIn(ha: HotelAnchor, roomId: string): boolean {
    const rm = ha.rooms.find((r) => r.id === roomId);
    if (!rm || this.s.yen < rm.price) return false;
    this.s.yen -= rm.price;
    this.s.hotel = { id: ha.id, room: rm.id };
    this.audio.play('coin');
    setTimeout(() => this.audio.play('ding'), 380);
    const info = HOTEL[ha.id];
    const t = ROOM_TYPE[rm.type];
    this.ui.toast('key', `${t.name} · Room ${roomNo(rm.floor)}`, `Checked in at ${info.name}. Take the ${info.theme === 'ryokan' ? 'stairs' : 'lift'} up whenever you like, and sleep before it gets late.`, true);
    this.player.flash = 1;
    if (this.s.pin?.id === `hotel-${ha.id}`) this.setPin(null);
    this.afterChange();
    return true;
  }

  private async goUpstairs(ha: HotelAnchor, rm: HotelRoomAnchor): Promise<void> {
    const hb = this.w.hotelRooms[rm.id];
    if (!hb || this.upstairs) return;
    let nav = this.roomNavs.get(rm.id);
    if (!nav) this.roomNavs.set(rm.id, (nav = new Nav(hb.nav)));
    const fade = document.getElementById('fade')!;
    this.endMeal();
    this.audio.play('ding');
    fade.classList.add('on');
    await sleep(650);
    this.upstairs = { room: rm, hotel: ha, nav, lm: hb.lightmap };
    this.nav = nav;
    this.path = [];
    this.pending = null;
    const p = this.player.position;
    p.set(rm.spawn[0], rm.y, rm.spawn[1]);
    this.player.facing = this.player.targetFacing = rm.spawn[2];
    if (this.cam.fp) this.cam.fpYaw = rm.spawn[2];
    this.cam.target.copy(p);
    this.cam.snap();
    await sleep(120);
    this.audio.play('door');
    fade.classList.remove('on');
    const info = HOTEL[ha.id];
    if (!this.roomsSeen.has(rm.id)) {
      this.roomsSeen.add(rm.id);
      setTimeout(() => this.ui.toast(ROOM_TYPE[rm.type].icon, `Room ${roomNo(rm.floor)} · ${info.name}`, 'Your room for the night. Try the window, put the kettle on, and the bed is yours whenever you are tired.'), 500);
    }
  }

  private async goDownstairs(): Promise<void> {
    const up = this.upstairs;
    if (!up) return;
    const lift = this.w.anchors.rooms.find((r) => r.id === up.hotel.lobby)?.lift;
    if (!lift) return;
    const fade = document.getElementById('fade')!;
    this.endMeal();
    if (this.windowView) { this.windowView = false; this.setFirstPerson(false, true); }
    this.audio.play('door');
    fade.classList.add('on');
    await sleep(650);
    this.upstairs = null;
    this.nav = this.navWorld;
    this.path = [];
    this.pending = null;
    const p = this.player.position;
    p.set(lift.stand[0], this.navWorld.heightAt(lift.stand[0], lift.stand[1]), lift.stand[1]);
    this.player.facing = this.player.targetFacing = lift.facing + Math.PI;
    if (this.cam.fp) this.cam.fpYaw = this.player.facing;
    this.cam.target.copy(p);
    this.cam.snap();
    await sleep(120);
    this.audio.play('ding');
    fade.classList.remove('on');
    // the morning after: hand the key back
    const b = this.s.hotel;
    if (b?.slept) {
      this.s.hotel = null;
      const info = HOTEL[b.id];
      setTimeout(() => this.ui.toast('suitcase', 'Checked out', `Thank you for staying at ${info?.name ?? 'the hotel'}! Tonight, why not try another one?`), 500);
      this.afterChange();
    }
  }

  /** Lie down: until seven in the morning after dark, or a two-hour nap in the day. */
  private async sleepIn(rm: HotelRoomAnchor): Promise<void> {
    if (this.sleeping) return;
    this.sleeping = true;
    this.path = [];
    this.pending = null;
    this.endMeal();
    const h = this.tod.hour;
    const night = h >= 17 || h < 6;
    const info = HOTEL[rm.hotel];
    // the clock is someone else's when the settings fix it or a co-op leader keeps it
    const follow = !!this.coop && !this.coop.host;
    const keep = this.s.settings.timeOfDay !== null || follow;
    const to = night ? 7 : (h + 2) % 24;
    const sub = keep
      ? follow ? 'Your trip leader keeps the clock, so the city kept its hour.' : 'The time of day is fixed in your settings, so the city kept its hour.'
      : night ? `${info?.name ?? 'The hotel'} · the city is waking up` : 'Two hours later, fresh as a daikon.';
    const first = night && !this.s.stays.includes(rm.hotel);
    await this.ui.sleep(h, keep ? h : to, night ? 'Good morning!' : 'What a lovely nap', sub, () => {
      if (!keep) this.tod.hour = to;
      if (night) {
        if (this.s.hotel?.room === rm.id) this.s.hotel.slept = true;
        if (first) this.s.stays.push(rm.hotel);
      }
    });
    this.sleeping = false;
    if (first) {
      this.audio.play('chime');
      const n = this.s.stays.length;
      this.ui.toast('sunrise', `A night at ${info?.name ?? 'the hotel'}`, rm.type === 'tatami'
        ? 'You slept on a futon on fresh tatami. The okami says the yukata is yours to keep.'
        : `${n} of ${HOTELS.length} hotels slept in. Check out at the lobby whenever you like.`, true);
      this.player.flash = 1;
    }
    this.afterChange();
  }

  /** Stand at the window and look out: first person, facing the street. */
  private lookOut(rm: HotelRoomAnchor): void {
    // step up to the glass (the view switches to first person at the same moment, so the step does not show)
    const p = this.player.position, [wx, wz] = rm.window.stand;
    if (Math.hypot(p.x - wx, p.z - wz) > 0.3 && this.nav.walkable(wx, wz)) p.set(wx, this.nav.heightAt(wx, wz), wz);
    this.path = [];
    this.pending = null;
    this.player.facing = this.player.targetFacing = rm.window.facing;
    if (!this.cam.fp) {
      this.setFirstPerson(true, true);
      this.windowView = true;
    }
    this.cam.fpYaw = rm.window.facing;
    this.cam.fpPitch = -0.1;
    this.audio.play('whoosh');
    this.ui.toast('skyline', `The view from ${roomNo(rm.floor)}`, this.windowView
      ? (this.r.isMobile ? 'Drag to look around. Walk away from the window to step back.' : 'Move the mouse to look around. Walk away from the window to step back.')
      : 'The whole street, right below you.');
  }

  /** The HUD goal while the traveller still needs a bed tonight, and a nudge when the sun starts to set. */
  private hotelGoal(): void {
    const h = this.tod.hour, b = this.s.hotel;
    let g: { icon: string; title: string; sub: string } | null = null;
    if (this.started && !this.inside) {
      if (!b && (h >= 13 || h < 5.5)) {
        const dark = h >= 19 || h < 5.5;
        g = { icon: 'bed', title: dark ? 'Find a hotel for the night' : 'Find a hotel before dark', sub: dark ? `${HOTELS.length} on the map` : 'sunset 19:00' };
      } else if (b && !b.slept && !this.upstairs && (h >= 21 || h < 5)) {
        g = { icon: 'moon', title: `Back to ${HOTEL[b.id]?.name ?? 'your hotel'}`, sub: `room ${roomNo(this.booking(b.id)?.floor ?? 1)}` };
      }
    }
    this.ui.goal(g);
    if (h < 18 && h > 6) this.dusk = false;
    else if (!this.dusk && h >= 18 && h < 19 && this.started && !b) {
      this.dusk = true;
      this.ui.toast('sunset', 'The sun is going down', 'Time to find a bed for the night. The hotels sparkle on your city map (M).', true);
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
    if (it.snack) setTimeout(() => this.startMeal(it.icon, this.server, () => {}), 150);
    this.afterChange();
    return true;
  }

  private gacha(pos: V3): void {
    if (this.s.yen < GACHA_PRICE) { this.audio.play('fail'); this.ui.toast('purse', 'Not enough yen', `A capsule costs ¥${GACHA_PRICE}.`); return; }
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
    if (n < 8) this.ui.toast('daruma', `Daruma ${n} / 8`, n === 1 ? 'A tiny daruma doll with one eye painted in. Someone has hidden these around the shops.' : 'Another one, tucked away where only the curious look.', true);
    else { this.ui.toast('confetti', 'All eight daruma found!', 'Claim your reward in the Food Passport.', true); this.cam.shake = 0.12; }
    this.afterChange();
  }

  private setShelf(open: boolean): void {
    const sec = this.w.anchors.secret;
    if (!sec) return;
    this.shelfClosed.visible = !open;
    this.shelfOpen.visible = open;
    this.navWorld.setBlocked('shelf', sec.gate, !open);
    this.paths.block('shelf', sec.gate, !open);
  }

  private pullBook(): void {
    if (this.s.flags.shelfOpen) { this.audio.play('click'); return; }
    this.s.flags.shelfOpen = true;
    this.audio.play('door');
    this.cam.shake = 0.12;
    this.setShelf(true);
    this.ui.toast('book', 'A hidden room!', 'The bookshelf swings aside. Behind it: a tiny reading room nobody has dusted in years.', true);
    this.afterChange();
  }

  private roomAt(x: number, z: number): RoomAnchor | null {
    for (const rm of this.w.anchors.rooms) {
      const [x0, z0, x1, z1] = rm.rect;
      if (x >= x0 && x <= x1 && z >= z0 && z <= z1) return rm;
    }
    return null;
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
    this.player = new Actor(buildPerson(playerLook(this.s.wear, this.s.profile.color)), this.chars);
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
  /** The slow orbit over the old town behind the title screen. */
  private titleView(): void {
    this.cam.target.set(34, 0, 30);
    this.cam.zoom = 30;
    this.cam.setOrbit(0.05);
    this.cam.snap();
  }

  title(): void {
    this.titleView();
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
    if (this.s.pin) this.setPin(this.s.pin);
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
        'But first things first: I need a bed for tonight. There are seven hotels in town, and the sun sets at seven. Check in before dark!',
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
    this.audio.setVolumes(st.musicVol, st.ambVol, st.sfxVol);
    if (st.perf || !new URLSearchParams(location.search).has('perf')) this.perf.toggle(st.perf);
    this.r.composite.uniforms.uTilt.value = st.tilt && !this.cam.fp ? 0.6 : 0;
    this.tod.dayLength = st.dayLength;
    this.tod.setTarget(st.timeOfDay);
    // view distance: how far first person draws (the haze thickens to meet it) and how far out the iso view zooms
    const tier: Quality = st.quality === 'auto' ? (mobile ? 'medium' : 'high') : st.quality;
    const dist = viewMetres(st.viewDist ?? VIEW_DEFAULT[tier]);
    this.viewDist = dist;
    if (this.streamer) this.streamer.dist = dist;
    // the voxel city fades out at the view distance, but the skyline beyond the map stays visible further
    this.r.persp.far = Math.max(dist + 10, 650);
    this.r.persp.fov = st.fov;
    this.r.persp.updateProjectionMatrix();
    this.cam.maxZoom = 34 + THREE.MathUtils.clamp((dist - 80) / 220, 0, 1) * 46;
    this.cam.zoom = Math.min(this.cam.zoom, this.cam.maxZoom);
  }

  private buy(d: FoodId, _st: StallInfo): boolean {
    const dish = DISHES.find((x) => x.id === d)!;
    if (this.s.yen < dish.price) return false;
    this.s.yen -= dish.price;
    const isNew = !this.s.tasted[d];
    this.eat(d);
    this.audio.play('coin');
    const count = this.s.tasted[d] ?? 1;
    this.startMeal(d, this.server, () => this.ui.savour(d, { isNew, count }));
    return true;
  }

  /**
   * Serve and eat something: the vendor (if any) hands it over, then the traveller eats it bite by bite
   * (game/meal.ts). Walking away finishes it on the spot; a tap or the interact key hurries it along.
   */
  private startMeal(id: string, server: Actor | null, done: () => void): void {
    this.endMeal();
    for (const v of this.vendors) if (v.actor === server) v.waveT = 0;
    this.path = [];
    this.pending = null;
    this.mealZoom = this.cam.zoom;
    const nav = this.nav, pl = this.player;
    this.meal = new Meal(id, {
      scene: this.r.scene,
      shared: this.r.shared,
      audio: this.audio,
      player: pl,
      vendor: server,
      firstPerson: () => this.cam.fp,
      viewYaw: () => (this.cam.fp ? null : this.cam.yaw),
      canStand: (x, z) => nav.canStand(x, z, nav.standHeightVox(pl.position.x, pl.position.z)),
      bubble: (key, text, pos, secs) => this.ui.bubble(key, text, pos, secs),
      fx: (steam, amount, sparkle) => this.particles.meal(steam, amount, sparkle),
    }, done);
  }

  private endMeal(): void {
    if (!this.meal) return;
    this.meal.stop();
    this.meal.dispose();
    this.meal = null;
    if (!this.cam.fp && this.mealZoom) this.cam.zoom = this.mealZoom;
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
    const isNew = !this.s.tasted[d];
    this.eat(d);
    const count = this.s.tasted[d] ?? 1;
    this.startMeal(d, this.server, () => this.ui.savour(d, { isNew, count, cooked: stars, tip }));
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
    this.ui.toast(it?.icon ?? 'coin', `${m.name} claimed`, [r.yen ? `+¥${r.yen.toLocaleString('en-US')}` : '', it ? it.name : '', r.title ? `Title: ${r.title}` : ''].filter(Boolean).join(' · '), true);
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
          this.ui.toast('target', `Mission complete: ${m.name}`, 'Claim your reward in the Food Passport.', true);
        }, 900);
      }
    }
    this.ui.refresh();
    this.save();
  }

  private openStall(st: StallInfo, vendor: Actor, at: [number, number]): void {
    this.server = vendor;
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
    if (n < 3) this.ui.toast('cat', `Lucky cat ${n} / 3`, n === 1 ? 'A tiny maneki-neko, beckoning with its paw. There must be others.' : 'Another one! Its paw points toward Lantern Alley.', true);
    else {
      this.ui.toast('lantern', 'All three lucky cats found!', 'Their paws all point to a nameless passage off Lantern Alley…', true);
      this.setDoor(true);
      this.cam.shake = 0.15;
    }
    this.afterChange();
  }

  private vend(): void {
    if (this.s.yen < 130) { this.audio.play('fail'); this.ui.toast('purse', 'Not enough yen', 'Even a can of tea costs ¥130.'); return; }
    this.s.yen -= 130;
    const drinks = [['tea', 'Hot green tea', 'Clunk! A warm can rolls out. Japanese machines sell hot and cold drinks.'], ['latte', 'Royal milk tea', 'Sweet, creamy and warm. A vending machine classic.'], ['can', 'Ramune soda', 'Pop the marble to open it!'], ['coffee', 'Canned coffee', 'Tokyo runs on canned coffee.']];
    const d = drinks[Math.floor(Math.random() * drinks.length)];
    this.audio.play('coin');
    this.ui.toast(d[0], d[1], d[2]);
    this.afterChange();
    this.startMeal(d[0], null, () => {});
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
    if (!on) {
      this.player.facing = this.player.targetFacing = this.cam.fpYaw;
      if (document.pointerLockElement) document.exitPointerLock();
    }
    try { localStorage.setItem(VIEW_KEY, on ? 'fp' : 'iso'); } catch { /* storage blocked */ }
    if (!quiet) {
      this.audio.play('whoosh');
      if (on) this.ui.toast('eye', 'First-person view', this.r.isMobile
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
    sh.tSolid.value = inside ? this.solidInside : this.solidWorld;
    sh.tOwner.value = inside ? this.cutaway.ownerInside : this.cutaway.ownerWorld;
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
        setTimeout(() => this.ui.toast('door', 'Kakurega · 隠れ家', 'You found the hidden counter. Eight seats, no sign, no menu.', true), 700);
        this.afterChange();
      }
      this.chef.anim = 'bow';
      setTimeout(() => { this.chef.anim = 'cook'; }, 1600);
    } else {
      const hd = a.hiddenDoor;
      this.player.position.set(hd.stand[0] - 0.6, 0, hd.stand[1]);
      this.player.facing = this.player.targetFacing = -Math.PI / 2;
      this.cam.bounds = [WX0 + 2, WZ0 + 2, WX1 - 2, WZ1 - 2];
      this.cam.zoom = this.r.isMobile ? 15 : 17;
      this.r.shared.uBounds.value.set(WX0, WZ0, WX1, WZ1);
    }
    this.player.position.y = this.nav.heightAt(this.player.position.x, this.player.position.z);
    this.cam.target.copy(this.player.position);
    this.cam.snap();
    await sleep(120);
    fade.classList.remove('on');
  }

  /** Interactables in the scene the player is in: the street, the Kakurega, or one hotel room. */
  private usable(it: Interactable): boolean {
    return it.inside === this.inside && (it.room ?? null) === (this.upstairs?.room.id ?? null);
  }

  private interact(): void {
    if (this.ui.advanceDialogue()) return;
    if (this.meal) { this.meal.hurry(); return; }
    if (this.ui.busy || this.sleeping || !this.near) return;
    this.path = [];
    this.near.act();
  }

  // ------------------------------------------------------------------ co-op
  /** Start (or stop, with null) sharing this trip with friends. */
  private setCoop(coop: Coop | null): void {
    if (this.coop && this.coop !== coop) this.coop.leave();
    this.coop = coop;
    for (const id of [...this.remotes.keys()]) this.dropRemote(id);
    this.tod.follower = false;
    this.ui.skyFromLeader = false;
    if (!coop) { this.ui.party('', null); return; }
    this.shareProfile();
    if (this.started) coop.setInWorld(true);
    coop.onPeers = () => this.partyChip();
    coop.onJoin = (p) => {
      if (!this.started) return;
      this.audio.play('chime');
      this.ui.toast('plane', `${p.name} joined the trip!`, p.inWorld ? 'They just landed in Tokyo. Look for their name tag.' : 'They are at the gate and will land any moment.');
    };
    coop.onLeave = (p) => {
      if (this.started) this.ui.toast('wave', `${p.name} left the trip`, 'Their ticket still works if they want to come back.');
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
        this.ui.bubble(`wave-${p.id}`, 'Hi!', [q.x, q.y + 2.05, q.z], 1.6, 'wave');
      }
      this.audio.play('pop');
    } else if (e.k === 'stamp') {
      const d = DISHES.find((x) => x.id === e.dish);
      if (d) this.ui.toast(this.ui.icons[d.id] ?? 'bowl', `${p.name} tasted ${d.name}`, this.s.tasted[d.id] ? 'You have that stamp too. Compare notes!' : 'You haven\'t tried that one yet…');
    } else if (e.k === 'secret') {
      this.ui.toast('lantern', `${p.name} found a hidden counter!`, this.s.hiddenFound ? 'You know the one. Eight seats, no sign.' : 'Somewhere off Lantern Alley… the lucky cats know the way.');
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

  // ------------------------------------------------------------------ pocket map + guide
  /** Where the player is on the city map (inside the hidden restaurant: its door). */
  private mapPos(): [number, number] {
    const p = this.player.position;
    return this.inside ? this.w.anchors.hiddenDoor.stand : this.upstairs ? this.upstairs.hotel.entrance : [p.x, p.z];
  }

  private openCityMap(): void {
    if (!this.started) return;
    // a walk the player set off on (a tap or Guide me) carries on under the map; panels normally cancel it
    const path = this.path, pending = this.pending;
    this.ui.overlay(this.cityMap.open(this.s, this.ui.icons), () => {
      this.cityMap.closed();
      // reached a stall while reading the map: talk to it now
      setTimeout(() => {
        if (this.path.length || !this.pending || this.ui.busy) return;
        const it = this.pending;
        this.pending = null;
        this.near = it;
        it.act();
      }, 0);
    });
    this.path = path;
    this.pending = pending;
  }

  /** Pin a spot (or clear it with null): the beacon, the compass and the route all follow it. */
  private setPin(p: Pin | null): void {
    this.s.pin = p;
    this.save();
    this.route = null;
    this.routeT = 0;
    if (!p) { this.beacon.clear(); return; }
    this.beacon.set(p.x, this.navWorld.heightAt(p.x, p.z), p.z);
    this.reroute();
  }

  private reroute(): void {
    const pin = this.s.pin;
    if (!pin) return;
    const [x, z] = this.mapPos();
    // found off the main thread (a route across town is a big search); the old route shows until it arrives
    const asked = this.paths.find(x, z, pin.x, pin.z, (r) => {
      if (this.s.pin !== pin) return;
      this.route = r;
      // no way there (out over the water, say): just point at it rather than searching again and again
      if (!r) this.routeT = Infinity;
    });
    this.routeT = asked ? 2.5 : 0.2;
  }

  /** Every frame: the HUD compass, the beacon and the tag that points the way. */
  private updateGuide(dt: number): void {
    const pin = this.started ? this.s.pin : null;
    const [px, pz] = this.mapPos();
    const f = this.cam.fwd, fl = Math.hypot(f.x, f.z) || 1, fx = f.x / fl, fz = f.z / fl;
    // clockwise screen angle of a ground direction: the camera's right is (-fz, fx)
    const ang = (dx: number, dz: number) => Math.atan2(-dx * fz + dz * fx, dx * fx + dz * fz);
    let dist = Infinity;
    if (pin) {
      this.routeT -= dt;
      const r = this.route;
      // walk the corners off as they are reached; find the way again when the player wanders off it
      while (r && r.length > 1 && Math.hypot(r[0][0] - px, r[0][1] - pz) < 1.6) r.shift();
      if (this.routeT <= 0 && (!r || (r.length && Math.hypot(r[0][0] - px, r[0][1] - pz) > 9))) this.reroute();
      const route = this.route;
      dist = Math.hypot(pin.x - px, pin.z - pz);
      let walk = dist;
      if (route?.length) {
        walk = 0;
        let ax = px, az = pz;
        for (const [bx, bz] of route) { walk += Math.hypot(bx - ax, bz - az); ax = bx; az = bz; }
      }
      const next = route?.length ? route[0] : [pin.x, pin.z];
      this.walkLeft = walk;
      const here = dist < 3;
      this.ui.compass(ang(0, -1), ang(next[0] - px, next[1] - pz), here ? 'here' : walk < 1000 ? `${Math.max(1, Math.round(walk))} m` : `${(walk / 1000).toFixed(1)} km`);
      if (here && !this.inside && !this.ui.busy) {
        this.audio.play('chime');
        this.ui.toast('pin', pin.name === 'Pinned spot' ? 'You made it' : `You made it to ${pin.name}`, 'Your pin has been taken off the map.');
        this.setPin(null);
      }
    } else this.ui.compass(ang(0, -1), null, '');
    this.beacon.update(dt, dist, !!pin && !this.inside);
    this.placeGuide(this.s.pin ?? null, dist, this.walkLeft);
  }

  /** A small tag over the beacon; when it is off screen the tag waits at the edge, pointing the way. */
  private placeGuide(pin: Pin | null, dist: number, walk: number): void {
    if (!pin || !this.started || this.ui.open || this.inside || dist < 4) {
      if (this.guideEl) this.guideEl.style.display = 'none';
      return;
    }
    let el = this.guideEl;
    if (!el) {
      el = this.guideEl = document.createElement('div');
      el.className = 'guide';
      el.innerHTML = '<span class="gd"><i></i><span class="gn"></span><em></em></span><span class="stem"></span><span class="arr"></span>';
      document.getElementById('labels')!.appendChild(el);
    }
    el.style.display = '';
    const name = pin.name, m = `${Math.round(walk)} m`;
    const gn = el.querySelector('.gn') as HTMLElement, em = el.querySelector('em') as HTMLElement;
    if (gn.textContent !== m) gn.textContent = m;
    if (em.textContent !== name) em.textContent = name;
    const W = window.innerWidth, H = window.innerHeight, mg = 52;
    this.v3.set(pin.x, this.navWorld.heightAt(pin.x, pin.z) + 3.2, pin.z);
    const ok = this.cam.project(this.v3, this.v2);
    let x = this.v2.x, y = this.v2.y;
    if (!ok) { x = W - x; y = H; }
    const edge = !ok || x < mg || x > W - mg || y < mg + 60 || y > H - mg - 40;
    el.classList.toggle('edge', edge);
    if (edge) {
      const cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
      const k = Math.min((W / 2 - mg - 40) / Math.max(1e-3, Math.abs(dx)), (H / 2 - mg - 50) / Math.max(1e-3, Math.abs(dy)));
      x = cx + dx * k; y = cy + dy * k;
      (el.querySelector('.arr') as HTMLElement).style.transform = `rotate(${Math.atan2(dy, dx).toFixed(3)}rad)`;
    }
    el.style.left = `${x.toFixed(1)}px`;
    el.style.top = `${y.toFixed(1)}px`;
  }

  /** Stalls show up on the map once you have walked past them. */
  private discover(): void {
    if (this.inside || !this.started) return;
    const p = this.player.position;
    for (const st of this.w.anchors.stalls) {
      if (this.s.seen.includes(st.id) || STALL[st.id]?.hidden) continue;
      if (Math.hypot(st.vendor[0] - p.x, st.vendor[2] - p.z) > 12) continue;
      this.s.seen.push(st.id);
      this.save();
    }
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
    c.sendState([r2(p.x), r2(p.y), r2(p.z), r2(pl.targetFacing), Math.max(0, ANIMS.indexOf(this.meal ? 'eat' : pl.anim)), r2(pl.speed), this.inside ? 1 : 0, c.host ? r2(this.tod.hour) : -1]);
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
        const actor = new Actor(buildPerson(playerLook(wear, p.color)), this.chars);
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
        // keep the sky in step with the trip leader (their time of day setting wins)
        this.tod.follower = true;
        this.ui.skyFromLeader = true;
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
      if (document.pointerLockElement === canvas && this.cam.fp && !this.ui.busy && !this.meal) this.cam.look(e.movementX * 0.0022, e.movementY * 0.0022);
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
        if (lp.moved && !this.ui.busy && !this.meal) this.cam.look((e.clientX - lp.x) * k, (e.clientY - lp.y) * k);
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
    if (this.meal) { this.meal.hurry(); return; }
    if (this.near) { this.interact(); return; }
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let best: Interactable | null = null, bd = 60;
    for (const it of this.interactables) {
      if (!this.usable(it)) continue;
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
    if (!this.started || this.ui.busy || this.sleeping) return;
    if (this.meal) { this.meal.hurry(); return; }
    // tapped an interactable?
    let best: Interactable | null = null, bd = 46;
    for (const it of this.interactables) {
      if (!this.usable(it)) continue;
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
    const hit = this.cam.pick(x, y, this.nav, undefined, this.upstairs ? this.upstairs.room.y + 3 : 12);
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
    // under the pocket map only a walk already under way carries on
    const mapOpen = this.cityMap.isOpen;
    if ((!this.ui.busy || mapOpen) && this.started && !this.sleeping) {
      const k = this.keys;
      let f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      let rt = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      if (this.joy?.active) { f = -this.joy.y; rt = this.joy.x; }
      if (mapOpen) f = rt = 0;
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
          if (!this.path.length && this.pending && !mapOpen) {
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
    if (this.windowView && speed > 0) { this.windowView = false; this.setFirstPerson(false, true); }
    p.y += (this.nav.heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 14);
    pl.speed = speed;
    if (this.meal && speed > 0) this.endMeal();
    if (this.eatT > 0) { this.eatT -= dt; if (speed > 0) this.eatT = 0; }
    if (this.waveT > 0) { this.waveT -= dt; if (speed > 0) this.waveT = 0; }
    pl.anim = speed > 0 ? (run && speed > PLAYER_SPEED ? 'run' : 'walk') : this.waveT > 0 ? 'wave' : this.eatT > 0 ? 'eat' : 'idle';
    pl.update(dt);
    pl.light(this.upstairs?.lm ?? this.lm);
  }

  private updateCats(dt: number): void {
    for (const c of this.cats) {
      const a = c.actor, p = a.position;
      c.timer -= dt;
      if (c.target) {
        const dx = c.target[0] - p.x, dz = c.target[1] - p.z, d = Math.hypot(dx, dz);
        if (d < 0.08) { c.target = null; a.anim = 'sit'; c.timer = 4 + Math.random() * 8; }
        else { p.x += (dx / d) * 0.55 * dt; p.z += (dz / d) * 0.55 * dt; a.targetFacing = Math.atan2(dx, dz); a.anim = 'walk'; a.speed = 0.55; }
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
      const pl = this.player;
      const friends: [number, number][] = [];
      for (const rm of this.remotes.values()) if (rm.actor.root.visible) friends.push([rm.actor.position.x, rm.actor.position.z]);
      const viewR = this.cam.fp ? Math.min(80, this.viewDist * 0.65) : this.cam.zoom * 1.3 + 8;
      this.crowd.update(dt, this.tod.hour, { x: pl.position.x, z: pl.position.z, speed: pl.speed, running: pl.anim === 'run', eating: this.eatT > 0 || !!this.meal, facing: pl.facing }, friends, viewR);
      this.perf.lap('crowd');
      const threats: Threat[] = [{ x: pl.position.x, z: pl.position.z, speed: pl.speed }];
      for (const [x, z] of friends) threats.push({ x, z, speed: 1 });
      const food: [number, number] | null = (this.eatT > 0 || this.meal) && pl.speed < 0.1 ? [pl.position.x, pl.position.z] : null;
      this.birds.setVisible(true);
      this.birds.update(dt, this.tod.hour, pl.position.x, pl.position.z, viewR, threats, (x, z, r) => this.crowd.nearest(x, z, r), food);
      this.perf.lap('birds');
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
        // their own little habits while nobody is around: a photo, a message, a look at the flowers
        const an = e.actor.anim;
        if (d < 3.2) { if (an === e.habit && an !== 'idle') e.actor.anim = 'idle'; }
        else if (e.habit !== 'idle' && (an === 'idle' || an === e.habit) && (e.habitT -= dt) <= 0) {
          const on = an !== e.habit;
          e.actor.anim = on ? e.habit : 'idle';
          e.habitT = on ? 5 + Math.random() * 6 : 6 + Math.random() * 10;
        }
      }
      // keep cat prompts on the moving cats
      for (const c of this.cats) {
        const it = c.it;
        if (it) { it.x = it.stand[0] = c.actor.position.x; it.z = it.stand[1] = c.actor.position.z; it.pick[0] = it.x; it.pick[2] = it.z; }
      }
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
    } else this.birds.setVisible(false);
    // everyone animated and drawn this frame (one list, reused)
    const all = this.drawn;
    all.length = 0;
    if (this.inside) all.push(this.chef);
    else {
      for (const v of this.vendors) all.push(v.actor);
      for (const e of this.idlers) all.push(e.actor);
      for (const a of this.crowd.visible()) all.push(a);
      for (const c of this.cats) all.push(c.actor);
    }
    // shop keepers and regulars: only the ones near the player are shown and animated
    for (const e of this.roomActors) {
      const q = e.actor.position;
      const d = Math.hypot(pp.x - q.x, pp.z - q.z);
      const on = !this.inside && d < 24;
      e.actor.root.visible = on;
      if (!on) continue;
      all.push(e.actor);
      // regulars nibble at their food now and then
      if (e.sit && (e.snackT -= dt) <= 0) {
        e.snackT = 6 + Math.random() * 14;
        if (e.actor.anim === 'sit') e.actor.anim = 'sitEat';
        else if (e.actor.anim === 'sitEat') e.actor.anim = 'sit';
      }
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
    const near = this.nudgers;
    near.length = 0;
    for (const a of all) {
      a.update(dt);
      const dx = a.position.x - pl.x, dz = a.position.z - pl.z;
      const d2 = dx * dx + dz * dz;
      a.light(this.lm);
      if (d2 < 900) {
        if (!a.noBlob) this.blobs.add(a.position.x, a.position.y + 0.02, a.position.z, a.isCat ? 0.4 : 0.6, 0.45);
        if (d2 < 225) near.push([d2, a]);
      }
    }
    this.blobs.end();
    // you and the nearest few people and cats push plants, noren and low lanterns aside as you pass
    near.sort((p, q) => p[0] - q[0]);
    const nudge = this.r.shared.uNudge.value;
    nudge[0].set(pl.x, pl.y, pl.z, BODY_R);
    for (let i = 1; i < nudge.length; i++) {
      const a = near[i - 1]?.[1];
      if (a) nudge[i].set(a.position.x, a.position.y, a.position.z, a.isCat ? 0.1 : BODY_R);
      else nudge[i].w = 0;
    }
  }

  private updateNear(): void {
    const p = this.player.position;
    let best: Interactable | null = null, bd = Infinity;
    // in first person, prefer what you're looking at
    const fp = this.cam.fp, f = this.cam.fwd, fl = Math.hypot(f.x, f.z) || 1;
    for (const it of this.interactables) {
      if (!this.usable(it)) continue;
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
   * Buildings, landmarks and trees between the camera and the player are lowered as a whole (see
   * game/cutaway.ts). Only chunks that touch a lowered occluder use the more expensive material.
   */
  private updateCutaway(dt: number): void {
    const on = this.started && !this.cam.fp;
    const sh = this.r.shared;
    sh.uCutOn.value = on ? 1 : 0;
    sh.uCamFwd.value.copy(this.cam.fwd);
    this.cutaway.update(dt, this.player.position, this.cam.fwd, this.inside, on, this.upstairs?.room.y ?? 0);
    if (this.inside) return;
    const act = this.cutaway.active;
    for (const c of this.chunks) {
      let cut = false;
      for (let i = 0; i < c.occ.length && !cut; i++) cut = act[c.occ[i]];
      if (cut !== c.cut) { c.cut = cut; c.mesh.material = cut ? this.matCut : this.matWorld; }
    }
    for (const c of this.streamer.resident) {
      let cut = false;
      for (let i = 0; i < c.occ.length && !cut; i++) cut = act[c.occ[i]];
      if (cut !== c.cut) {
        c.cut = cut;
        this.streamer.endFade(c);
        const mat = cut ? this.matCut : this.matWorld;
        // (room contents inside the chunk mesh too)
        for (const m of c.lv) if (m) { m.material = mat; for (const ch of m.children) (ch as THREE.Mesh).material = mat; }
      }
    }
  }

  private updateCamera(dt: number): void {
    const meal = this.meal;
    if (this.cam.fp) {
      this.cam.target.copy(this.player.position);
      this.cam.fpSpeed = this.player.speed;
      if (this.inside !== this.wasInside) this.cam.fpYaw = this.player.facing; // just came through a door
      this.cam.fpBack = meal ? 0.12 : 0;
      if (meal) {
        // look down at your hands, the way you face
        this.cam.turnToward(this.player.facing, dt);
        this.cam.fpPitch += (meal.pitch - this.cam.fpPitch) * (1 - Math.exp(-dt * 3));
      }
    } else if (meal) {
      this.cam.target.copy(meal.focus);
      this.cam.zoom = meal.zoom;
    } else if (this.started) this.cam.target.copy(this.player.position).add(this.v3.set(0, 0.6, 0));
    this.wasInside = this.inside;
    this.cam.update(dt, window.innerWidth / Math.max(1, window.innerHeight), this.r.pixelHeight);
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const raw = now - this.last;
    this.last = now;
    const dt = Math.min(0.05, raw / 1000);
    this.perf.begin(raw);
    const sh = this.r.shared;
    this.syncCoop(dt);
    this.perf.lap('net');
    if (this.covered) return;
    sh.uTime.value += dt;
    // the breeze slowly veers and freshens; gusts and each prop's own swing happen in the shader
    const t = sh.uTime.value;
    const wa = 0.7 + 0.6 * Math.sin(t * 0.011) + 0.2 * Math.sin(t * 0.037);
    sh.uWind.value.set(Math.cos(wa), Math.sin(wa), 0.55 + 0.25 * Math.sin(t * 0.045 + 1) + 0.12 * Math.sin(t * 0.13), 0);
    this.tod.update(dt);
    this.tod.apply(this.r);
    if (this.inside) { sh.uLamp.value = Math.max(sh.uLamp.value, 0.95); sh.uSunColor.value.multiplyScalar(0.35); }
    if (this.started) this.s.playTime += dt;
    this.perf.lap('clock');

    this.meal?.update(dt);
    this.movePlayer(dt);
    this.updateRemotes(dt);
    this.perf.lap('player');
    this.updateNPCs(dt);
    if (this.meal) {
      this.meal.place(dt);
      if (this.meal.finished) this.endMeal();
    }
    this.perf.lap('animation');
    this.updateNear();
    this.updateCamera(dt);
    this.perf.lap('camera');
    this.streamer.update(dt, this.streamView(), !this.inside);
    this.perf.lap('streaming');
    this.updateCutaway(dt);
    this.perf.lap('cutaway');
    const fp = this.cam.fp;
    // in first person the body shows while eating, so the food is seen in your own hands (the camera sits inside the head)
    this.player.root.visible = !fp || !!this.meal;
    const eye = this.r.persp.position;
    // first-person haze, thick enough to hide the far edge of the view distance
    sh.uFog.value.set(eye.x, eye.y, eye.z, fp && !this.inside ? 2.15 / (this.viewDist - 18) : 0);
    if (document.pointerLockElement && (!fp || this.ui.busy)) document.exitPointerLock();
    this.koi.update(sh.uTime.value);
    this.particles.update(this.cam.right, this.cam.up, this.tod.particleLight);
    this.perf.lap('effects');
    this.updateGuide(dt);
    // paint the pocket map a sliver at a time once the trip is under way, so opening it is instant
    if (this.started) this.cityMap.prepare(2);
    this.perf.lap('map/guide');
    const pl = this.player.position;
    this.ui.updateLabels((p) => this.screen(p));
    this.placeTags();
    this.perf.lap('labels');

    // HUD + audio at a calmer rate
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.25;
      const rm = this.inside || this.upstairs ? null : this.roomAt(pl.x, pl.z);
      if (rm !== this.roomHere) {
        this.roomHere = rm;
        if (rm && this.started && !this.s.rooms.includes(rm.id)) { this.s.rooms.push(rm.id); this.afterChange(); }
      }
      this.discover();
      const rn = rm ? roomName(rm.kind, rm.nth, rm.hotel) : null;
      const up = this.upstairs, hi = up && HOTEL[up.hotel.id];
      const z = this.inside ? { name: 'Kakurega · Hidden Counter', jp: '隠れ家' } : up && hi ? { name: `${hi.name} · ${roomNo(up.room.floor)}`, jp: hi.jp } : rn ? { name: rn[0], jp: rn[1] } : zoneAt(pl.x, pl.z) ?? { name: 'Tokyo', jp: '東京' };
      this.hotelGoal();
      this.ui.location(z.name, z.jp, this.tod.label());
      let sizzle = 0;
      if (!this.inside) for (const e of this.w.anchors.emitters) {
        if (e.kind === 'incense') continue;
        const d = Math.hypot(e.pos[0] - pl.x, e.pos[2] - pl.z);
        sizzle = Math.max(sizzle, 1 - d / 7);
      }
      const water = this.inside ? 0 : Math.max(0, 1 - Math.abs(pl.z - 46.5) / 9);
      this.audio.ambience(Math.max(0, sizzle), water, this.tod.night, this.inside);
      this.audio.scene(pl.x, pl.z);
      if (this.started && Math.floor(this.s.playTime) % 10 === 0) this.save();
    }
    this.audio.tick(this.tod.night);
    this.perf.lap('hud/audio');
    // the pocket map covers the screen, so the world can rest under it
    if (!this.cityMap.isOpen) { this.chars.sync(); this.perf.lap('characters'); this.r.render(); }
    if (this.perf.on) this.perf.end({ chunks: this.streamer.resident.size, people: this.drawn.length, scale: this.r.renderScale, quality: this.r.quality });
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
    // ?debug exposes the game for automated screenshots and console poking
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { game: Game }).game = game;
  } catch (e) {
    console.error(e);
    game.ui.loadError('Something went wrong while building Tokyo.');
  }
}

void boot();
