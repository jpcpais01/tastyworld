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
import { atlasTexture, useAtlas } from './engine/atlas';
import type { MeshData } from './world/mesher';
import { buildPerson, buildCat, buildDog, randomLook, Look, CHAR_FINE } from './world/characters';
import { bikeModel, scooterModel, swanBoatModel, gozzoModel } from './world/vehicles';
import { zoneAt, INTERIOR_ORIGIN, WX0, WZ0, WX1, WZ1 } from './world/layout';
import { Meal } from './game/meal';
import type { FoodId } from './world/food';
import { Nav, PLAYER_REACH } from './game/nav';
import { PathService } from './game/paths';
import { BodyDetails } from './game/details';
import { Actor, Anim, geometryFrom, SIT_DROP } from './game/actors';
import { Crowd } from './game/crowd';
import { CharacterBatch } from './game/charbatch';
import { IsoCamera } from './game/camera';
import { Particles, Blobs, Koi, SkylightBeams } from './game/fx';
import { Birds, type Threat } from './game/birds';
import { Cutaway } from './game/cutaway';
import { solidBase } from './world/owners';
import { Shafts } from './engine/shafts';
import { HALL_ROOM, type HallPose } from './world/sacred';
/** Metres from a great hall within which all of its inside is drawn (see StreamView.halls). */
const HALL_NEAR = 24;
import { Audio } from './game/audio';
import { loadState, saveState, saveNow, resetState, SaveState, viewSetting } from './game/state';
import { DISHES, ALL_DISHES } from './data/dishes';
import { STALL, StallInfo } from './data/stalls';
import { MISSIONS, ITEMS, Mission } from './data/missions';
import { TEXT } from './data/cityText';
import { TIP_PER_STAR } from './data/money';
import { AMALFI, ISTANBUL, HILLSIDE, CITY, isCity, goToCity, perCity, peekResume } from './world/cityId';
import { nightAt, dropLanding } from './ui/arrival';
import { farCoast } from './engine/farcoast';
import { farIstanbul } from './engine/farIstanbul';
import { IDLERS, CAT_LINES } from './data/dialogue';
import { PATCH_NOTES } from './data/patchNotes';
import { PLACES, GUEST_LINES, CAPSULES, GACHA_PRICE, VENDING_PRICE, roomName, keeperOf, Buyable } from './data/places';
import type { RoomAnchor } from './world/interiors';
import type { HotelAnchor, HotelRoomAnchor } from './world/hotels';
import { HOTEL, HOTELS, HOTEL_GUEST_LINES, ROOM_TYPE, roomNo, byStairs } from './data/hotels';
import { UI, GameHooks } from './ui/ui';
import { renderDishIcons } from './ui/icons';
import { PhotoUI, capture } from './ui/photo';
import { album, ALBUM_MAX } from './game/album';
import { Travel } from './ui/travel';
import { endTripCard, summarise, tripLog } from './ui/endtrip';
import { CityMap, type Pin } from './ui/citymap';
import { Beacon } from './game/guide';
import { RoomGlass } from './game/roomglass';
import { DEST, type Destination } from './data/destinations';
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
const RUN_SPEED = 4.8; // the fast pace, a long joystick drag, or a double tap
/** Walking paces that Shift (or the HUD button) cycles through, in m/s. */
const PACES = [1.7, PLAYER_SPEED, RUN_SPEED] as const;
const PACE_KEY = 'tastyworld.pace';
const BODY_R = 0.32; // how wide a person is to the sway shader (a cat is 0.1)
const VIEW_KEY = 'tastyworld.view';
const VENDOR_CALLS = TEXT.vendorCalls;

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

/** How far photo mode lets the camera wander from the traveller (metres). */
const PHOTO_REACH = 16;
/** Istanbul's five calls to prayer (game hours): dawn, noon, afternoon, sunset, night. */
const EZAN = [5.8, 13.1, 16.2, 19.05, 20.6];
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
  /** Veils waiting to lift until the view is streamed in and running smoothly (see settled()). */
  private calm: { t0: number; run: number; done: () => void }[] = [];
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
  /** Scratch for picking who is drawn with a close-up body (see the close-up choice in frame). */
  private fineD2 = new Float64Array(4096);
  private animFrame = 0;
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
  private extras: Actor[] = [];
  /** The faithful and the visitors inside the cathedral and the mosques. */
  private hallPeople: { actor: Actor; pose: HallPose; alt?: HallPose; t: number }[] = [];
  private shafts!: Shafts;
  private hallRects: [number, number, number, number][] = [];
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
  /** The window glass of the hotel room the player is in, clear from inside. */
  private roomGlass!: RoomGlass;
  private dusk = false;
  private doorOpen = new THREE.Group();

  player!: Actor;
  private path: [number, number][] = [];
  private pending: Interactable | null = null;
  private pathRun = false;
  /** Chosen walking pace: 0 slow, 1 normal, 2 fast (index into PACES). */
  private pace = 1;
  private lastTap = { t: 0, x: 0, y: 0 };
  private slideSide = 1;
  /** Vertical speed while dropping off a ledge (m/s, negative is down). */
  private fallV = 0;
  private eatT = 0;
  /** The dish being served and eaten right now, and who is serving at the counter we last spoke at. */
  private meal: Meal | null = null;
  private server: Actor | null = null;
  private mealZoom = 0;
  private crowd!: Crowd;
  private lastToll = -1;
  /** Moves whatever lives beyond the map (Istanbul's ferries), once a frame. */
  private farTick: ((dt: number) => void) | null = null;
  /** Which of the day's calls to prayer last sounded (-2 until the first frame, so loading mid-call stays quiet). */
  private lastEzan = -2;
  private idlers: { actor: Actor; id: string; home: V3; baseFacing: number; talk: number; waved: boolean; habit: Anim; habitT: number }[] = [];
  private vendors: { actor: Actor; stall: StallInfo; ang: number; waveT: number }[] = [];
  private cats: Cat[] = [];
  private chef!: Actor;
  private blobs!: Blobs;
  private koi: Koi | null = null;
  private birds!: Birds;
  private particles!: Particles;
  private beams!: SkylightBeams;
  private interactables: Interactable[] = [];
  private near: Interactable | null = null;
  private notified = new Set<string>();
  private keys = new Set<string>();
  /** look: the drag began during an auto-walk, so it turns the iso view instead of steering; looked: it did turn. */
  private joy: { id: number; sx: number; sy: number; x: number; y: number; active: boolean; run: boolean; t: number; look?: boolean; looked?: boolean } | null = null;
  private pinch: { d: number; a: number; twist: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
  /** First-person look drag (right side of a touch screen, or a mouse drag without pointer lock). */
  private lookPtr: { id: number; x: number; y: number; sx: number; sy: number; t: number; moved: boolean } | null = null;
  private wasInside = false;
  private photo!: PhotoUI;
  /** Photo mode is up: the HUD steps aside, the traveller stands still and the camera is free. */
  private photoOn = false;
  /** Frames left until the shutter reads the canvas (0 = no photo waiting), and the render scale to go back to. */
  private shot = 0;
  private shotScale = 1;
  private photoPtr: { id: number; x: number; y: number; pan: boolean } | null = null;
  private placeName = TEXT.name;
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
    this.roomGlass = new RoomGlass(this.r.scene, this.r.shared);
    this.insideGroup.visible = false;
    const hooks: GameHooks = {
      buy: (d, st) => this.buy(d, st),
      cooked: (d, st, stars) => this.cooked(d, st, stars),
      claim: (m) => this.claim(m),
      wearChanged: () => { this.rebuildPlayer(); this.save(); this.shareProfile(); },
      settingsChanged: () => { this.applySettings(); this.save(); },
      reset: () => { resetState(); location.reload(); },
      panel: (open) => { if (open) { this.path = []; this.joy = null; this.setPhoto(false); } },
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
      home: () => this.goHome(),
      arrivalHour: () => this.tod.hour,
      settled: () => this.settled(),
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
    this.ui.onEndTrip = () => this.endTrip();
    this.ui.onWave = () => this.wave();
    this.ui.onPhoto = () => this.setPhoto(true);
    this.ui.onPace = () => this.cyclePace();
    this.photo = new PhotoUI({
      shutter: () => this.shutter(),
      close: () => this.setPhoto(false),
      view: () => this.setFirstPerson(!this.cam.fp, true),
      album: () => { this.setPhoto(false); this.ui.passport('album'); },
      options: () => this.applyPhotoLook(),
      click: () => this.audio.play('click'),
    });
    this.applySettings();
    window.addEventListener('resize', () => this.r.resize());
  }

  // ------------------------------------------------------------------ loading
  /** Build the city. `boarding`: the page reloaded into it mid-landing, so stream the streets the trip starts in. */
  async load(boarding = false): Promise<void> {
    // each worker builds the whole city but keeps only its strip of chunk rows; fewer on phones to save memory
    const cores = navigator.hardwareConcurrency || 2;
    const parts = Math.max(1, Math.min(this.r.isMobile ? 2 : 4, cores - 1));
    const progress = new Array(parts).fill(0);
    let stage = 'Packing your bags…';
    this.workers = Array.from({ length: parts }, () => new Worker(new URL('./world/worker.ts', import.meta.url), { type: 'module', name: `city:${CITY}` }));
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
    this.ui.loading(0.82, TEXT.loading[0]);
    await sleep(16);
    this.buildScene();
    // stream in what shows first (the title screen, or the street the plane has landed you in) before lifting the curtain
    this.ui.loading(0.86, TEXT.loading[1]);
    if (boarding) this.boardView(); else this.titleView();
    this.updateCamera(0.016);
    const done = this.streamer.ready();
    const tick = setInterval(() => this.streamer.update(0.05, this.streamView()), 50);
    await done;
    clearInterval(tick);
    this.ui.loading(0.97, 'Plating the dishes…');
    await sleep(16);
    // this city's menu, plus whatever was stamped elsewhere (the passport shows those too)
    this.ui.icons = renderDishIcons(this.r.gl, ALL_DISHES.filter((d) => DISHES.includes(d) || this.s.tasted[d.id]).map((d) => d.id));
    this.ui.loading(1, TEXT.loading[2]);
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
    const focus = this.started ? this.player.position : this.cam.target;
    // a great hall the player is in or near is drawn whole, its far end too
    const halls = this.hallRects.filter((r) => Math.hypot(Math.max(r[0] - focus.x, 0, focus.x - r[2]), Math.max(r[1] - focus.z, 0, focus.z - r[3])) < HALL_NEAR);
    return { cam: this.r.view, fp, focus, inner, halls };
  }

  private mesh(md: MeshData, mat: THREE.Material, group: THREE.Group): THREE.Mesh {
    const m = new THREE.Mesh(geometryFrom(md), mat);
    if (md.atlas) useAtlas(m, atlasTexture(this.r.gl, md.atlas));
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
    // the city's meshes keep their light and colours in atlas textures (world/mesher.ts AtlasBlocks)
    this.matWorld = voxelMaterial(sh, { SWAY: 1, ATLAS: 1 }, { tAtlas: { value: null } });
    this.matCut = voxelMaterial(sh, { CUTAWAY: 1, SWAY: 1, ATLAS: 1 }, { tAtlas: { value: null } });
    // double-sided so a neighbour's unmeshed party wall shows its far side instead of a hole
    this.matCut.side = THREE.DoubleSide;
    this.worldGroup.add(this.doorClosed, this.doorOpen, this.shelfClosed, this.shelfOpen);
    // the rest of Tokyo beyond the map, with gaps where the canal and the two avenues carry on
    if (ISTANBUL) {
      // the city beyond the map: Galata and its tower over the Horn, Asia across the Bosphorus, the old city's domes
      const far = farIstanbul(sh, [WX0, WZ0, WX1, WZ1]);
      this.worldGroup.add(far.ground, far.houses, far.ferries);
      this.farTick = far.update;
      this.r.composite.uniforms.uWaterBounds.value.set(-4000, -4000, 4000, 4000);
      this.r.composite.uniforms.uSea.value = 1;
      this.r.camera.far = 1800;
      this.r.camera.updateProjectionMatrix();
    } else if (AMALFI) {
      // the coast beyond the map: the Lattari mountains, Atrani and Ravello, and the open sea to the horizon
      const far = farCoast(sh, [WX0, WZ0, WX1, WZ1]);
      this.worldGroup.add(far.ground, far.houses);
      this.r.composite.uniforms.uWaterBounds.value.set(-4000, -4000, 4000, 4000);
      this.r.composite.uniforms.uSea.value = 1;
      // the iso camera sits 120 m back: let it see the ridges a kilometre and more behind the town
      this.r.camera.far = 1800;
      this.r.camera.updateProjectionMatrix();
    } else {
      // Tokyo Tower closes the view up the north-south avenue, 150 m past the north edge of the map
      // the ring road round the map is kept open only where a street carries on; elsewhere houses close it, and
      // the hill, the shrine wood and the park run on as trees (see world/tokyoEdge.ts for the town's side)
      const far = farCity(sh, [WX0, WZ0, WX1, WZ1], [[-1e4, 39.5, 1e4, 53], [-1e4, -28.5, 1e4, -17.5], [71.5, -1e4, 82.5, 1e4]], 300, [77, WZ0 - 150], {
        open: [[-1e4, -28.5, 1e4, -17.5], [-1e4, 37.5, 1e4, 56], [-1e4, 55.5, 1e4, 65], [WX1 - 1, 8.5, 1e4, 16.5], [-10.5, WZ1 - 1, 0.5, 1e4], [71.5, -1e4, 82.5, 1e4]],
        green: [[-1e4, -46, WX0 + 1, -28.5], [-1e4, 65, WX0 + 1, 1e4], [-1e4, WZ1 - 1, -10.5, 1e4], [0.5, WZ1 - 1, 20, 1e4], [52, WZ1 - 1, 71.5, 1e4], [82.5, WZ1 - 1, 1e4, 1e4], [WX1 - 1, 65, 1e4, 1e4]],
      });
      this.worldGroup.add(far.ground, far.city);
      // the iso camera sits 120 m back: let it see the tower's full height over the rooftops
      this.r.camera.far = 900;
      this.r.camera.updateProjectionMatrix();
      this.r.composite.uniforms.uWaterBounds.value.set(WX0 - 5, WZ0 - 5, WX1 + 5, WZ1 + 5);
    }
    sh.uBounds.value.set(WX0, WZ0, WX1, WZ1);
    this.cam.bounds = [WX0 + 2, WZ0 + 2, WX1 - 2, WZ1 - 2];
    const tagGroups: Record<string, THREE.Group> = { 'door-closed': this.doorClosed, 'door-open': this.doorOpen, 'shelf-closed': this.shelfClosed, 'shelf-open': this.shelfOpen };
    for (const t of w.tagged) {
      const m = this.mesh(t.mesh, this.matWorld, tagGroups[t.tag] ?? this.worldGroup);
      this.chunks.push({ mesh: m, box: m.geometry.boundingBox!.clone(), cut: false, occ: [] });
    }
    for (const md of w.interiorChunks) this.mesh(md, this.matCut, this.insideGroup);
    // R: the solid run from the street, G: the layer each column's solid bits start from (hillside cities)
    const heightTex = (data: Uint8Array, sx: number, sz: number, ground?: Uint8Array | null) => {
      const rg = new Uint8Array(sx * sz * 2);
      for (let c = 0; c < sx * sz; c++) { rg[c * 2] = data[c]; rg[c * 2 + 1] = solidBase(ground, c); }
      const t = new THREE.DataTexture(rg, sx, sz, THREE.RGFormat, THREE.UnsignedByteType);
      t.magFilter = t.minFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      return t;
    };
    this.heightWorld = heightTex(w.height, w.nav.sx, w.nav.sz, w.ground);
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
    this.cutaway = new Cutaway(w.owners, w.nav, w.interiorNav, { height: w.height, solid: w.solid, ground: w.ground ?? undefined }, { height: w.interiorHeight, solid: w.interiorSolid });
    sh.tCut.value = this.cutaway.cut;
    for (const c of this.chunks) c.occ = this.cutaway.touching(c.box.min.x, c.box.min.z, c.box.max.x, c.box.max.z);
    this.streamer = new Streamer(this.workers, this.partOf, w.height, this.worldGroup, () => this.matWorld, this.r.isMobile, this.r.gl);
    this.streamer.dist = this.viewDist;
    this.streamer.fadeMaterial = () => voxelMaterial(sh, { SWAY: 1, LODFADE: 1, ATLAS: 1 }, { uFade: { value: new THREE.Vector2() }, tAtlas: { value: null } });
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
    Actor.details ??= new BodyDetails();
    this.navInside = new Nav(w.interiorNav);
    this.nav = this.navWorld;
    this.lm = w.lightmap;
    this.setDoor(this.s.manekis.length >= 3);

    this.blobs = new Blobs(this.r.scene, 160);
    if (a.koiArea) this.koi = new Koi(this.worldGroup as unknown as THREE.Scene, this.r, a.koiArea);
    this.particles = new Particles(this.r, a.emitters, [...a.manekis, ...a.darumas], a.fireflies, a.petals);
    this.beams = new SkylightBeams(this.r, a.shafts ?? []);
    (a.warm ?? []).slice(0, 3).forEach(([x0, z0, x1, z1, top], i) => { this.r.shared.uWarm.value[i].set(x0, z0, x1, z1); this.r.shared.uWarmTop.value.setComponent(i, top); });
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
      walkTo: (p) => this.walkToPin(p),
      worldMap: () => this.travel.openMap('view'),
      close: () => this.ui.close(),
      click: () => this.audio.play('click'),
    });
    for (const i of this.s.manekis) this.particles.hideSparkle(i);
    for (const i of this.s.darumas) this.particles.hideSparkle(a.manekis.length + i);

    // player
    this.rebuildPlayer();
    this.player.position.set(a.spawn[0], this.navWorld.heightAt(a.spawn[0], a.spawn[2]), a.spawn[2]);
    this.player.facing = this.player.targetFacing = Math.PI * 0.5;

    // vendors
    for (const sa of a.stalls) {
      const st = STALL[sa.id];
      if (!st) continue;
      const act = new Actor(buildPerson(st.vendorLook), this.chars);
      act.position.set(sa.vendor[0], HILLSIDE ? this.ground(sa.stand[0], sa.stand[1]) : this.navWorld.heightAt(sa.vendor[0], sa.vendor[1]), sa.vendor[1]);
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
    const kak = STALL[perCity({ tokyo: 'kakurega', amalfi: 'grotta', istanbul: 'gizli' })];
    this.chef = new Actor(buildPerson(kak.vendorLook), this.chars);
    this.chef.position.set(a.chef[0], 0, a.chef[2]);
    this.chef.facing = this.chef.targetFacing = 0;
    this.chef.anim = 'cook';
    this.insideGroup.add(this.chef.root);
    this.interactables.push({
      key: 'chef', x: a.counterStand[0], z: a.counterStand[1], stand: a.counterStand, pick: [a.chef[0], 1.6, a.chef[2]], r: 1.6, inside: true,
      prompt: () => [perCity({ tokyo: 'sushi', amalfi: 'squid', istanbul: 'pot' }), TEXT.hidden.chef[0], TEXT.hidden.chef[1]],
      act: () => this.openStall(kak, this.chef, [a.chef[0], a.chef[2]]),
    });
    this.interactables.push({
      key: 'exit', x: a.interiorExit[0], z: a.interiorExit[1], stand: a.interiorExit, pick: [a.interiorExit[0], 1.2, a.interiorExit[1]], r: 1.3, inside: true,
      prompt: () => ['door', TEXT.hidden.exit, HILLSIDE ? 'Push the door open' : 'Slide the door open'],
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
      const habit: Anim = ({
        tourist: 'photo', salaryman: 'phone', student: 'phone', florist: 'browse',
        // Amalfi: the painter studies the view, the lemon man checks his crates, the lifeguard stretches, Don Matteo prays
        painter: 'browse', limonaio: 'browse', pescatore: 'browse', lifeguard: 'exercise', priest: 'pray',
        // Istanbul: the imam prays, the carpet man and the auntie size up the street, the angler watches his line
        imam: 'pray', halici: 'browse', teyze: 'browse', olta: 'browse', kaptan: 'phone',
      } as Record<string, Anim>)[id.id] ?? 'idle';
      const entry = { actor: act, id: id.id, home: id.pos, baseFacing: face, talk: 0, waved: false, habit, habitT: 3 + Math.random() * 8 };
      this.idlers.push(entry);
      this.interactables.push({
        key: `idler-${id.id}`, x: id.pos[0], z: id.pos[2], stand: [id.pos[0], id.pos[2]], pick: [id.pos[0], 1.3, id.pos[2]], r: 1.5, inside: false,
        prompt: () => ['chat', info.name, 'Chat'],
        act: () => this.talk(entry),
      });
    }

    // people who keep to one spot: the anglers along the Galata Bridge, a phone out now and then
    (a.extras ?? []).forEach((ex, i) => {
      const act = new Actor(buildPerson(randomLook(ex.seed)), this.chars, false, true);
      act.position.set(ex.pos[0], ex.indoor ? ex.pos[1] : this.navWorld.heightAt(ex.pos[0], ex.pos[2]), ex.pos[2]);
      act.facing = act.targetFacing = ex.face;
      act.anim = i % 6 === 2 ? 'phone' : 'idle';
      act.root.visible = false;
      this.worldGroup.add(act.root);
      this.extras.push(act);
    });

    // in the cathedral and the mosques: the faithful in the pews and on the carpet, visitors looking round
    for (const h of a.halls ?? []) for (const hp of h.people) {
      const act = new Actor(buildPerson(randomLook(hp.seed)), this.chars, false, true);
      act.position.set(hp.pos[0], hp.pose === 'sit' ? hp.pos[1] - SIT_DROP : hp.pos[1], hp.pos[2]);
      act.facing = act.targetFacing = hp.face;
      act.anim = hp.pose;
      act.root.visible = false;
      this.worldGroup.add(act.root);
      this.hallPeople.push({ actor: act, pose: hp.pose, alt: hp.alt, t: 4 + Math.random() * 12 });
    }
    this.hallRects = (a.halls ?? []).map((h) => h.rect);
    // the sun falling through their windows
    this.shafts = new Shafts(this.r, a.halls ?? []);

    // your own footsteps follow the walk cycle, softly
    Actor.onStep = (act, run) => { if (act === this.player) this.audio.step(act.position.x, act.position.z, run); };
    this.audio.setRooms(a.rooms.map((rm) => ({ rect: rm.rect, kind: rm.kind })));
    this.audio.setHalls((a.halls ?? []).map((h) => ({ rect: h.rect, kind: h.kind })));

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
      boat: (seed) => lazy(new Actor(CITY === 'tokyo' ? swanBoatModel(seed) : gozzoModel(seed), this.chars, true, true)),
    });
    this.crowd.router = this.paths;
    for (const id of a.idlers) this.crowd.addObstacle(id.pos[0], id.pos[2]);
    for (const ex of a.extras ?? []) if (!ex.indoor) this.crowd.addObstacle(ex.pos[0], ex.pos[2]);
    for (const h of a.halls ?? []) for (const hp of h.people) if (hp.pose !== 'sit') this.crowd.addObstacle(hp.pos[0], hp.pos[2]);
    const m = this.r.isMobile;
    // Amalfi's streets are stairs: nobody rides them, and the dawn exercises stay in Tokyo; its boats are gozzi out in the bay, and bathers lie on the beach
    // Istanbul's lanes climb in steps and the bazaars are packed: everyone walks, and fishing boats work the strait
    this.crowd.populate(perCity({
      tokyo: m ? { walkers: 200, joggers: 5, dogs: 7, cyclists: 7, couriers: 4, boats: 2, exercise: 6 } : { walkers: 500, joggers: 10, dogs: 14, cyclists: 14, couriers: 8, boats: 3, exercise: 9 },
      amalfi: m ? { walkers: 80, joggers: 2, dogs: 4, cyclists: 0, couriers: 0, boats: 3, exercise: 0, bathers: 16 } : { walkers: 170, joggers: 4, dogs: 7, cyclists: 0, couriers: 0, boats: 4, exercise: 0, bathers: 30 },
      istanbul: m ? { walkers: 320, joggers: 3, dogs: 9, cyclists: 0, couriers: 0, boats: 3, exercise: 0 } : { walkers: 800, joggers: 6, dogs: 16, cyclists: 0, couriers: 0, boats: 4, exercise: 0 },
    }));
    this.crowd.settle(this.tod.hour);
    // pigeons, sparrows, crows and the rest, on the ground, the roofs and the wires
    this.birds = new Birds({ nav: w.nav, height: w.height, solid: w.solid, ground: w.ground, shore: w.shore, lightmap: w.lightmap, anchors: a }, this.chars);

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
        prompt: () => this.s.manekis.includes(i) ? [TEXT.charm.icon, TEXT.charm.one, TEXT.charm.found] : ['sparkle', TEXT.charm.seen, TEXT.charm.hint],
        act: () => this.findManeki(i),
      });
    });
    // vending machines
    a.vending.forEach((v, i) => {
      this.interactables.push({
        key: `vend-${i}`, x: v[0], z: v[2], stand: [v[0], v[2]], pick: [v[0], 1.4, v[2]], r: 1.3, inside: false,
        prompt: () => ['can', 'Vending machine', `Buy a drink · ${TEXT.money(VENDING_PRICE)}`],
        act: () => this.vend(),
      });
    });
    // the hidden door
    const hd = a.hiddenDoor;
    this.interactables.push({
      key: 'door', x: hd.stand[0], z: hd.stand[1], stand: hd.stand, pick: hd.label, r: 1.5, inside: false,
      prompt: () => this.s.manekis.length >= 3 ? ['lantern', ...TEXT.door.open] : ['wall', ...TEXT.door.closed],
      act: () => {
        if (this.s.manekis.length >= 3) void this.teleport(true);
        else {
          this.audio.play('click');
          this.ui.bubble('door-hint', TEXT.door.hint, [hd.label[0], this.ground(hd.stand[0], hd.stand[1]) + 2.2, hd.label[2]], 4);
        }
      },
    });

    // on a hillside every label in the street sits above the ground under its stand, not above sea level
    if (HILLSIDE) for (const it of this.interactables) if (!it.inside && !it.room && !it.key.startsWith('lift-')) it.pick = [it.pick[0], it.pick[1] + this.ground(it.stand[0], it.stand[1]), it.pick[2]];

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
        prompt: () => ['capsule', 'Gachapon', `Turn the handle · ${TEXT.money(GACHA_PRICE)}`],
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
      // Istanbul's hotels are placed by the city builder: they take the name of the street they open onto
      if (!info.street) info.street = zoneAt(ha.entrance[0], ha.entrance[1])?.name ?? TEXT.name;
      const stairs = byStairs(info);
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
        it('win', rm.window.stand, rm.window.pick, () => ['skyline', 'The window', TEXT.tea.view], () => this.lookOut(rm));
        it('tea', rm.tea.stand, rm.tea.pick, () => [TEXT.tea.icon, rm.type === 'tatami' ? 'Tea set' : TEXT.tea.name, TEXT.tea.act], () => {
          this.player.targetFacing = rm.tea.facing;
          this.audio.play('pop');
          this.ui.toast(TEXT.tea.icon, TEXT.tea.title, rm.type === 'tatami' ? 'The okami left a pot of sencha and two rice crackers. Perfect.' : TEXT.tea.text);
          this.startMeal(TEXT.tea.icon, null, () => {});
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
    this.ui.toast('key', `${t.name} · Room ${roomNo(rm.floor)}`, `Checked in at ${info.name}. Take the ${byStairs(info) ? 'stairs' : 'lift'} up whenever you like, and sleep before it gets late.`, true);
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
    this.roomGlass.set(rm.panes);
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
    this.roomGlass.set(null);
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
      : night ? `${info?.name ?? 'The hotel'} · the city is waking up` : TEXT.nap;
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
      const n = this.s.stays.filter((id) => HOTEL[id]).length;
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
    if (!this.w.anchors.hotels.length) return;
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
    if (this.s.yen < GACHA_PRICE) { this.audio.play('fail'); this.ui.toast('purse', 'Not enough money', `A capsule costs ${TEXT.money(GACHA_PRICE)}.`); return; }
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

  /**
   * Who is drawn with a close-up body (twice the voxel detail): the nearest people, as many as the quality
   * tier allows, and only while a fine voxel still spans a pixel or more on screen. Returns the squared
   * distance from the player within which people are chosen; you are always.
   */
  private closeUps(all: Actor[], pl: THREE.Vector3): number {
    Actor.sweepDetail();
    this.player.prefer();
    const FINE_PX = 1.1, h = this.r.pixelHeight;
    let far: number;
    if (this.cam.fp) far = CHAR_FINE * h / (2 * Math.tan(this.r.persp.fov * Math.PI / 360) * FINE_PX);
    else far = CHAR_FINE * h / this.cam.zoom >= FINE_PX ? Infinity : 0;
    const max = this.r.quality === 'low' ? 24 : this.r.quality === 'medium' ? 56 : 96;
    const ds = this.fineD2;
    let n = 0;
    for (const a of all) {
      if (!a.detailed || n >= ds.length) continue;
      const dx = a.position.x - pl.x, dz = a.position.z - pl.z;
      ds[n++] = dx * dx + dz * dz;
    }
    let cut = far * far;
    if (n > max) cut = Math.min(cut, ds.subarray(0, n).sort()[max - 1]);
    return cut;
  }
  private setDoor(open: boolean): void {
    this.doorClosed.visible = !open;
    this.doorOpen.visible = open;
    const hd = this.w.anchors.hiddenDoor;
    if (open && !this.s.hiddenFound) this.ui.label('door', '?', 'marker', [hd.label[0], hd.label[1], hd.label[2]]);
    else this.ui.removeLabel('door');
  }

  /** Height of the walkable ground (m) under a spot in the street: 0 in flat Tokyo. */
  private ground(x: number, z: number): number {
    if (!HILLSIDE) return 0;
    const n = this.navWorld;
    if (n.walkable(x, z)) return n.heightAt(x, z);
    // on a counter, a plinth or in a doorway: the nearest floor round it
    for (const r of [0.4, 0.8, 1.3, 2])
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        if (n.walkable(px, pz)) return n.heightAt(px, pz);
      }
    return n.heightAt(x, z);
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
    if (AMALFI) this.cam.target.set(6, 6, 6);
    else if (ISTANBUL) this.cam.target.set(4, 4, 20);
    else this.cam.target.set(34, 0, 30);
    this.cam.zoom = 30;
    this.cam.setOrbit(0.05);
    this.cam.snap();
  }

  /** The camera as a trip starts, right behind the traveller. It always happens under a veil, so it snaps there. */
  private boardView(): void {
    this.cam.setOrbit(0);
    this.cam.yaw = Math.round((this.cam.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
    this.cam.zoom = this.r.isMobile ? 15 : 17;
    this.cam.target.copy(this.player.position).add(this.v3.set(0, 0.6, 0));
    this.cam.snap();
  }

  /**
   * Resolves once what the camera sees is streamed in and frames come smoothly (shaders compiled, meshes uploaded,
   * the crowd placed): the moment to lift a veil, so the city is never first seen hitching. Gives up waiting after
   * 8 s, whatever the frames do.
   */
  settled(): Promise<void> {
    return new Promise((done) => this.calm.push({ t0: performance.now(), run: 0, done }));
  }

  /** Ten frames in a row under 50 ms with the view streamed in, at least a quarter second after asking. */
  private checkCalm(now: number, raw: number): void {
    const smooth = !this.covered && raw < 50 && this.streamer.settled;
    this.calm = this.calm.filter((c) => {
      c.run = smooth && now - c.t0 > 250 ? c.run + 1 : 0;
      if (c.run < 10 && now - c.t0 < 8000) return true;
      c.done();
      return false;
    });
  }

  title(): void {
    this.titleView();
    this.ui.loaded();
    this.travel.title();
    this.bindInput();
    requestAnimationFrame((t) => this.frame(t));
  }

  private start(dest: Destination, coop: Coop | null): void {
    if (dest.id !== CITY && isCity(dest.id)) {
      // another city is another world to build: save, reload into it, and board as soon as it has loaded
      coop?.leave();
      if (this.started) {
        // flying on from the end of a trip here: that trip is over
        this.setCoop(null);
        this.s.trip = null;
      }
      saveNow(this.s);
      goToCity(dest.id, { board: dest.id, night: nightAt(this.tod.hour) });
      return;
    }
    this.started = true;
    // a new trip starts on landing; coming back to a trip that never ended (a reload) carries on with it
    if (this.s.trip?.city !== CITY) { this.s.trip = tripLog(this.s); this.save(); }
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
    this.boardView();
    this.ui.showHud(true);
    this.applySettings();
    let fp = false;
    try { fp = localStorage.getItem(VIEW_KEY) === 'fp'; } catch { /* storage blocked */ }
    if (fp) this.setFirstPerson(true, true);
    let pace = 1;
    try { pace = Number(localStorage.getItem(PACE_KEY) ?? 1); } catch { /* storage blocked */ }
    this.setPace(PACES[pace] ? pace : 1, false);
    if (!this.s.flags.introSeen) {
      this.s.flags.introSeen = true;
      this.s.flags.lastPatch = PATCH_NOTES[0].version;
      this.save();
      setTimeout(() => this.ui.dialogue('Your travel diary', TEXT.intro), 700);
    } else if (this.s.flags.lastPatch !== PATCH_NOTES[0].version) {
      this.s.flags.lastPatch = PATCH_NOTES[0].version;
      this.save();
      setTimeout(() => this.ui.notes(), 600);
    }
  }

  /** The end-trip button: the trip summary with the two ways out (fly home, or on to another city). */
  private endTrip(): void {
    if (!this.started || this.ui.busy || this.cityMap.isOpen) return;
    if (this.meal || this.sleeping || this.inside) {
      this.ui.toast('depart', 'Not just yet', this.meal ? 'Finish your plate first. The plane can wait.' : this.sleeping ? 'Sleep in. The plane can wait till morning.' : 'Step back out into the street first.');
      return;
    }
    this.setPhoto(false);
    this.path = []; this.pending = null; this.joy = null;
    saveNow(this.s);
    const shell = document.createElement('div');
    shell.className = 'trip-plain endtrip-shell';
    shell.appendChild(endTripCard({
      here: DEST[CITY] ?? DEST.tokyo,
      home: this.travel.home,
      sum: summarise(this.s),
      pics: this.ui.icons,
      crew: this.coop?.peers.size ?? 0,
      click: () => this.audio.play('click'),
      homeward: () => setTimeout(() => this.travel.homeward(), 260),
      onward: () => setTimeout(() => this.travel.openMap('onward'), 260),
      stay: () => this.ui.close(),
    }));
    this.audio.play('whoosh');
    this.ui.overlay(shell, () => {});
  }

  /** The plane home has landed: the trip is over, the save is written, and the home menu is back over the city. */
  private goHome(): void {
    this.setCoop(null);
    if (this.cam.fp) this.setFirstPerson(false, true);
    this.setPhoto(false);
    this.path = []; this.pending = null; this.joy = null;
    this.s.trip = null;
    this.started = false;
    this.ui.showHud(false);
    this.ui.prompt('', '', '');
    // the next trip here lands where trips start
    const a = this.w.anchors;
    this.player.position.set(a.spawn[0], this.navWorld.heightAt(a.spawn[0], a.spawn[2]), a.spawn[2]);
    this.player.facing = this.player.targetFacing = Math.PI * 0.5;
    saveNow(this.s);
    this.titleView();
    this.travel.title();
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
    this.applyPhotoLook();
    this.tod.dayLength = st.dayLength;
    this.tod.setTarget(st.timeOfDay);
    // view distance: how far first person draws (the haze thickens to meet it) and how far out the iso view zooms
    const tier: Quality = st.quality === 'auto' ? (mobile ? 'medium' : 'high') : st.quality;
    const dist = viewSetting(st, tier);
    this.viewDist = dist;
    if (this.streamer) this.streamer.dist = dist;
    // the voxel city fades out at the view distance, but the skyline beyond the map stays visible further
    this.r.persp.far = Math.max(dist + 60, HILLSIDE ? 1700 : 650); // the mountains of the coast stand a kilometre and more away
    this.r.persp.fov = st.fov;
    this.r.persp.updateProjectionMatrix();
    // very far lets the overhead view pull back a little more again (the streamer coarsens the outskirts to match)
    this.cam.maxZoom = 34 + THREE.MathUtils.clamp((dist - 80) / 220, 0, 1) * 46 + THREE.MathUtils.clamp((dist - 300) / 300, 0, 1) * 16;
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
    const tip = stars * TIP_PER_STAR;
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
    this.ui.toast(it?.icon ?? 'coin', `${m.name} claimed`, [r.yen ? `+${TEXT.money(r.yen)}` : '', it ? it.name : '', r.title ? `Title: ${r.title}` : ''].filter(Boolean).join(' · '), true);
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
      this.ui.bubble(`maneki-${i}`, TEXT.charm.bubble, [m[0], this.ground(m[0], m[2]) + 1.1, m[2]]);
      return;
    }
    this.s.manekis.push(i);
    this.particles.hideSparkle(i);
    this.audio.play('chime');
    this.player.flash = 1;
    const n = this.s.manekis.length;
    if (n < 3) this.ui.toast(TEXT.charm.icon, `${TEXT.charm.one} ${n} / 3`, n === 1 ? TEXT.charm.first : TEXT.charm.next, true);
    else {
      this.ui.toast('lantern', TEXT.charm.all, TEXT.charm.allText, true);
      this.setDoor(true);
      this.cam.shake = 0.15;
    }
    this.afterChange();
  }

  private vend(): void {
    if (this.s.yen < VENDING_PRICE) { this.audio.play('fail'); this.ui.toast('purse', 'Not enough money', `Even a can of tea costs ${TEXT.money(VENDING_PRICE)}.`); return; }
    this.s.yen -= VENDING_PRICE;
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
    this.photo.setFirstPerson(on, this.r.isMobile);
    this.applyPhotoLook();
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

  /** Tilt-shift follows the setting, or the photo mode switch while taking pictures; never in first person. */
  private applyPhotoLook(): void {
    const tilt = this.photoOn ? this.photo.opts.focus : this.s.settings.tilt;
    this.r.composite.uniforms.uTilt.value = tilt && !this.cam.fp ? 0.6 : 0;
  }

  /** Open or leave photo mode. */
  private setPhoto(on: boolean): void {
    if (on === this.photoOn) return;
    if (on && (!this.started || this.ui.busy || this.meal || this.sleeping || this.cityMap.isOpen)) return;
    this.photoOn = on;
    this.path = []; this.pending = null; this.joy = null; this.pinch = null; this.lookPtr = null; this.photoPtr = null;
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.toggle('photo-mode', on);
    if (on) {
      this.cam.minZoom = 4;
      this.photo.open(this.cam.fp, this.r.isMobile);
      this.audio.play('whoosh');
    } else {
      this.cam.minZoom = 9;
      this.cam.zoom = THREE.MathUtils.clamp(this.cam.zoom, this.cam.minZoom, this.cam.maxZoom);
      this.cam.settle();
      this.photo.close();
    }
    this.applyPhotoLook();
  }

  /** Press the shutter: the picture is read right after the next frame is drawn (at full resolution). */
  private shutter(): void {
    if (!this.photoOn || this.shot) return;
    this.audio.play('shutter');
    this.photo.flash();
    this.shotScale = this.r.renderScale;
    if (this.r.renderScale < 1) { this.r.renderScale = 1; this.r.resize(); }
    this.shot = 1;
  }

  /** Called straight after a frame is drawn, while the canvas still holds it. */
  private takePhoto(): void {
    const stamp = this.photo.opts.stamp ? { place: this.placeName, clock: this.tod.label() } : null;
    const meta = { t: Date.now(), place: this.placeName, clock: this.tod.label() };
    const shot = capture(this.r.gl.domElement, stamp);
    if (this.shotScale < 1) { this.r.renderScale = this.shotScale; this.r.resize(); }
    void shot.then(async (img) => {
      if (await album.count() >= ALBUM_MAX) {
        this.ui.toast('camera', 'Your album is full', `It holds ${ALBUM_MAX} photos. Delete a few in the passport's Album to make room.`);
        return;
      }
      const photo = { ...meta, ...img };
      const id = await album.add(photo);
      this.photo.showShot({ id, ...photo });
      this.s.photos = (this.s.photos ?? 0) + 1;
      if (HILLSIDE) this.s.flags.photosA = (this.s.flags.photosA ?? 0) + 1;
      this.afterChange();
      this.save();
    }).catch((e) => {
      console.error(e);
      this.ui.toast('camera', 'The photo did not save', 'Your browser would not store it. Try again, or check that site storage is allowed.');
    });
  }

  private requestLook(): void {
    if (this.ui.busy || this.photoOn) return;
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
        setTimeout(() => this.ui.toast('door', `${TEXT.hidden.name.split(' · ')[0]} · ${TEXT.hidden.local}`, TEXT.hidden.found, true), 700);
        this.afterChange();
      }
      this.chef.anim = 'bow';
      setTimeout(() => { this.chef.anim = 'cook'; }, 1600);
    } else {
      const hd = a.hiddenDoor;
      this.player.position.set(hd.stand[0] - (HILLSIDE ? 0 : 0.6), 0, hd.stand[1]);
      this.player.facing = this.player.targetFacing = HILLSIDE ? Math.PI : -Math.PI / 2;
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
      this.ui.toast('plane', `${p.name} joined the trip!`, p.inWorld ? `They just landed in ${TEXT.name}. Look for their name tag.` : 'They are at the gate and will land any moment.');
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
      this.ui.toast('lantern', `${p.name} found a hidden counter!`, this.s.hiddenFound ? TEXT.hidden.friend : TEXT.hidden.friendHint);
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

  /** Pin a spot and walk there on our own, the way a tap on the street walks you to it. */
  private walkToPin(p: Pin): void {
    const cur = this.s.pin;
    if (!cur || Math.hypot(cur.x - p.x, cur.z - p.z) > 0.5 || cur.name !== p.name) this.setPin(p);
    const pin = this.s.pin!;
    if (this.inside || this.upstairs) {
      this.ui.toast('pin', 'Step outside first', 'Your pin is set. Head out and the compass will lead the way.');
      return;
    }
    this.ui.close();
    const go = (r: [number, number][] | null) => {
      if (this.s.pin !== pin || this.inside || this.upstairs) return;
      if (!r?.length) { this.ui.toast('pin', 'No way there on foot', 'Follow the beacon and look for another way round.'); return; }
      this.path = r.map(([x, z]) => [x, z] as [number, number]);
      this.pending = null;
      this.joy = null;
      this.audio.play('click');
    };
    const p0 = this.player.position;
    // across town the search is big, so it runs off the main thread; if the worker is busy, find it here
    if (!this.paths.find(p0.x, p0.z, pin.x, pin.z, go, PLAYER_REACH)) go(this.nav.findPath(p0.x, p0.z, pin.x, pin.z, PLAYER_REACH));
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
    }, PLAYER_REACH);
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
  /** Shift or the HUD pace button: slow, normal, fast and round again. The choice is kept between visits. */
  private cyclePace(): void {
    this.setPace((this.pace + 1) % PACES.length);
  }

  private setPace(i: number, save = true): void {
    this.pace = i;
    this.ui.setPace(i);
    if (save) try { localStorage.setItem(PACE_KEY, String(i)); } catch { /* storage blocked */ }
  }

  private bindInput(): void {
    const canvas = this.r.gl.domElement;
    window.addEventListener('keydown', (e) => {
      if (e.repeat && !['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) return;
      this.keys.add(e.code);
      if (!this.started) return;
      if (this.photoOn) { this.photoKey(e); return; }
      switch (e.code) {
        case 'Space': case 'Enter': case 'KeyF': e.preventDefault(); this.interact(); break;
        case 'KeyQ': this.cam.rotate(-1); break;
        case 'KeyE': this.cam.rotate(1); break;
        case 'KeyP': this.ui.open ? this.ui.close() : this.ui.passport(); break;
        case 'KeyM': this.ui.open ? this.ui.close() : this.ui.map(); break;
        case 'KeyV': if (!this.ui.busy) this.setFirstPerson(!this.cam.fp); break;
        case 'KeyG': if (!this.ui.busy) this.wave(); break;
        case 'ShiftLeft': case 'ShiftRight': if (!this.ui.busy) this.cyclePace(); break;
        case 'KeyC': this.setPhoto(true); break;
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
      if (this.photoOn && !this.cam.fp) { this.photoPointerDown(e); return; }
      if (this.cam.fp) { this.fpPointerDown(e); return; }
      if (this.pointers.size === 2) {
        const [p1, p2] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: Math.atan2(p2.y - p1.y, p2.x - p1.x), twist: 0 };
        this.joy = null;
      } else if (this.pointers.size === 1) {
        this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0, active: false, run: false, t: performance.now(), look: this.path.length > 0 };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const px = p.x, py = p.y;
      p.x = e.clientX; p.y = e.clientY;
      if (this.photoOn && !this.cam.fp) { this.photoPointerMove(e, px, py); return; }
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
        if (j.look) {
          // auto-walking: dragging turns the view around the traveller and the walk carries on
          if (!j.looked && Math.hypot(dx, dy) > 14) j.looked = true;
          if (j.looked && !this.ui.busy) this.cam.walkTurn(-(e.clientX - px) * 0.006);
          return;
        }
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
      if (this.photoPtr?.id === e.pointerId) this.photoPtr = null;
      const lp = this.lookPtr;
      if (lp && lp.id === e.pointerId) {
        this.lookPtr = null;
        if (!lp.moved && performance.now() - lp.t < 450 && e.type === 'pointerup') {
          // a mouse click grabs the pointer for mouse look, a touch tap walks or interacts like in the iso view
          if (this.photoOn) { /* photo mode: a tap only frames the shot */ } else if (e.pointerType === 'mouse') this.requestLook();
          else this.tap(e.clientX, e.clientY);
        }
        return;
      }
      const j = this.joy;
      if (j && j.id === e.pointerId) {
        if (!j.active && !j.looked && performance.now() - j.t < 450 && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
        this.joy = null;
      }
    };
    canvas.addEventListener('contextmenu', (e) => { if (this.photoOn) e.preventDefault(); });
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
  }

  /** Photo mode keys: the shutter, leaving, the view, and turning or moving the camera. */
  private photoKey(e: KeyboardEvent): void {
    switch (e.code) {
      case 'Space': case 'Enter': e.preventDefault(); this.shutter(); break;
      case 'Escape': case 'KeyC': this.setPhoto(false); break;
      case 'KeyV': this.setFirstPerson(!this.cam.fp, true); break;
      case 'KeyQ': if (this.cam.fp) this.cam.rotate(-1); else this.cam.orbitBy(-Math.PI / 4, 0); break;
      case 'KeyE': if (this.cam.fp) this.cam.rotate(1); else this.cam.orbitBy(Math.PI / 4, 0); break;
      case 'Equal': case 'NumpadAdd': this.cam.zoomBy(0.85); break;
      case 'Minus': case 'NumpadSubtract': this.cam.zoomBy(1.18); break;
    }
  }

  /** Photo mode, iso view: one finger or the left button turns and tilts; two fingers, the right button or Shift move the camera. */
  private photoPointerDown(e: PointerEvent): void {
    if (this.pointers.size === 2) {
      const [p1, p2] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y), a: 0, twist: 0 };
      this.photoPtr = null;
    } else if (this.pointers.size === 1) {
      this.photoPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, pan: e.button === 2 || e.shiftKey };
    }
  }

  private photoPointerMove(e: PointerEvent, px: number, py: number): void {
    if (this.pinch && this.pointers.size >= 2) {
      const [p1, p2] = [...this.pointers.values()];
      const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
      if (d > 0 && this.pinch.d > 0) this.cam.zoomBy(this.pinch.d / d);
      this.pinch.d = d;
      // each finger carries half of the move of their midpoint
      this.panCamera((e.clientX - px) / 2, (e.clientY - py) / 2);
      return;
    }
    const pp = this.photoPtr;
    if (!pp || pp.id !== e.pointerId) return;
    const dx = e.clientX - pp.x, dy = e.clientY - pp.y;
    pp.x = e.clientX; pp.y = e.clientY;
    if (pp.pan) this.panCamera(dx, dy);
    else this.cam.orbitBy(-dx * 0.006, dy * 0.004);
  }

  /** Slide the photo camera by a screen drag (pixels), so the world follows the pointer; it stays near the traveller. */
  private panCamera(dx: number, dy: number): void {
    const k = this.cam.zoom / Math.max(1, window.innerHeight);
    const { fwd, right } = this.cam.groundAxes();
    const sinP = Math.max(0.3, Math.sin(this.cam.pitch));
    const pan = this.cam.pan;
    pan.x += -right.x * dx * k + fwd.x * dy * k / sinP;
    pan.z += -right.y * dx * k + fwd.y * dy * k / sinP;
    if (pan.length() > PHOTO_REACH) pan.setLength(PHOTO_REACH);
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
    if (e.clientX < window.innerWidth * 0.45 && !this.joy && !this.photoOn) {
      this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0, active: false, run: false, t: performance.now() };
    } else if (!this.lookPtr) {
      this.lookPtr = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false };
    }
  }

  /** Locked-mouse click: interact with what's in reach, or walk to the thing under the crosshair. */
  private fpUse(): void {
    if (this.photoOn) return;
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
    const path = this.nav.findPath(p.x, p.z, best.stand[0], best.stand[1], PLAYER_REACH);
    if (path) { this.path = path; this.pending = best; this.audio.play('click'); }
  }

  private tap(x: number, y: number): void {
    if (!this.started || this.ui.busy || this.sleeping || this.photoOn) return;
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
      const path = this.nav.findPath(p.x, p.z, best.stand[0], best.stand[1], PLAYER_REACH);
      if (path) { this.path = path; this.pending = best; this.audio.play('click'); }
      return;
    }
    const py0 = this.player.position.y;
    const hit = HILLSIDE && !this.inside && !this.upstairs
      ? this.cam.pick(x, y, this.nav, undefined, Math.min(50, py0 + 24), Math.max(-3, py0 - 24))
      : this.cam.pick(x, y, this.nav, undefined, this.upstairs ? this.upstairs.room.y + 3 : 12);
    if (!hit) return;
    const path = this.nav.findPath(p.x, p.z, hit.x, hit.z, PLAYER_REACH);
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
    if ((!this.ui.busy || mapOpen) && this.started && !this.sleeping && !this.photoOn) {
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
        const pace = this.joy?.active && this.joy.run ? RUN_SPEED : PACES[this.pace];
        run = pace > PLAYER_SPEED;
        speed = pace * Math.min(1, Math.hypot(f, rt));
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
          const pace = this.pathRun ? RUN_SPEED : PACES[this.pace];
          run = pace > PLAYER_SPEED;
          speed = pace * (this.path.length === 1 ? Math.min(1, 0.35 + d) : 1);
        }
      }
    }
    if (!this.path.length) this.cam.endWalk(); // the next auto-walk starts facing its way again
    if (speed > 0) {
      const hv = this.nav.standHeightVox(p.x, p.z);
      const from = hv === 255 ? 12 : hv;
      const step = speed * dt;
      if (this.path.length > 0) {
        p.x += dx * step; p.z += dz * step;
        pl.targetFacing = Math.atan2(dx, dz);
        // the view follows the walking direction, keeping whatever look offset the player has dialled in
        this.cam.autoWalk(pl.targetFacing, dt);
      } else {
        // free movement slides along walls and nudges round corners, chairs and tree trunks
        const m = this.nav.slide(p.x, p.z, dx, dz, step, from, this.slideSide, PLAYER_REACH);
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
    // off a ledge the player falls under gravity and lands with a step; otherwise the feet ease onto the floor
    const floor = this.nav.heightAt(p.x, p.z);
    if (this.fallV < 0 || p.y > floor + 0.35) {
      this.fallV -= 24 * dt;
      p.y += this.fallV * dt;
      if (p.y <= floor) {
        p.y = floor;
        if (this.fallV < -3) this.audio.step(p.x, p.z, true);
        this.fallV = 0;
      }
    } else p.y += (floor - p.y) * Math.min(1, dt * 14);
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
    const viewR = this.cam.fp ? Math.min(80, this.viewDist * 0.65) : this.cam.zoom * 1.3 + 8;
    if (!this.inside) {
      const pl = this.player;
      const friends: [number, number][] = [];
      for (const rm of this.remotes.values()) if (rm.actor.root.visible) friends.push([rm.actor.position.x, rm.actor.position.z]);
      this.crowd.update(dt, this.tod.hour, { x: pl.position.x, z: pl.position.z, speed: pl.speed, running: pl.anim === 'run', eating: this.eatT > 0 || !!this.meal, facing: pl.facing }, friends, viewR);
      this.perf.lap('crowd');
      // up in a hotel room you are no bother to the birds in the street
      const threats: Threat[] = this.upstairs ? [] : [{ x: pl.position.x, z: pl.position.z, speed: pl.speed }];
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
      // cats only near enough to be seen: Istanbul has thirty of them spread over the whole map
      const catR = 40 + this.cam.zoom * 1.6, pp0 = this.player.position;
      for (const c of this.cats) {
        const q = c.actor.position, on = (q.x - pp0.x) ** 2 + (q.z - pp0.z) ** 2 < catR * catR;
        c.actor.root.visible = on;
        if (on) all.push(c.actor);
      }
    }
    // shop keepers and regulars: only the ones near the player are shown and animated
    for (const act of this.extras) {
      const q = act.position;
      const on = !this.inside && !this.upstairs && Math.hypot(pp.x - q.x, pp.z - q.z) < 30;
      act.root.visible = on;
      if (on) all.push(act);
    }
    for (const e of this.hallPeople) {
      const q = e.actor.position;
      const on = !this.inside && !this.upstairs && Math.hypot(pp.x - q.x, pp.z - q.z) < 30;
      e.actor.root.visible = on;
      if (!on) continue;
      all.push(e.actor);
      // now a bow or a look round, then back to what they were doing
      if (e.alt && (e.t -= dt) <= 0) {
        const away = e.actor.anim === e.alt;
        e.actor.anim = away ? e.pose : e.alt;
        e.t = away ? 8 + Math.random() * 14 : 3 + Math.random() * 4;
      }
    }
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
    if (!this.cam.fp && (!this.photoOn || this.photo.opts.me)) this.blobs.add(pl.x, pl.y + 0.02, pl.z, 0.62, 0.5);
    for (const rm of this.remotes.values()) {
      if (!rm.actor.root.visible) continue;
      all.push(rm.actor);
    }
    const near = this.nudgers;
    near.length = 0;
    // animation level of detail: limbs are posed every frame close up, every 2nd or 3rd frame further out
    const full = Math.max(18, viewR * 0.4) ** 2, half = Math.max(30, viewR * 0.75) ** 2;
    const frame = this.animFrame++;
    const fine2 = this.closeUps(all, pl);
    for (const a of all) {
      const dx = a.position.x - pl.x, dz = a.position.z - pl.z;
      const d2 = dx * dx + dz * dz;
      // a little slack for whoever is close-up already, so people at the edge of the choice do not flicker
      if (a.detailed && (d2 <= fine2 || (a.preferred && d2 <= fine2 * 1.3))) a.prefer();
      if (a.step(dt, d2 < full ? 1 : d2 < half ? 2 : 3, frame)) a.light(this.lm);
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
    this.roomGlass.show(this.cam.fp);
    this.cutaway.update(dt, this.player.position, this.cam.fwd, this.inside, on, this.upstairs?.room.y ?? 0);
    this.shafts.update(this.player.position, this.cam.fp, on ? HALL_ROOM : null);
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
    if (this.photoOn && !this.cam.fp) {
      const k = this.keys;
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
      const rt = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);
      // about a screen height every two seconds, whatever the zoom
      if (f || rt) this.panCamera(-rt * dt * window.innerHeight * 0.5, f * dt * window.innerHeight * 0.5 * Math.sin(this.cam.pitch));
    }
    this.wasInside = this.inside;
    this.farTick?.(dt);
    this.cam.update(dt, window.innerWidth / Math.max(1, window.innerHeight), this.r.pixelHeight);
    if (HILLSIDE) this.r.shadows.focusY = this.inside ? 0 : Math.round(this.cam.target.y / 3) * 3;
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const raw = now - this.last;
    this.last = now;
    if (this.calm.length) this.checkCalm(now, raw);
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
    this.player.root.visible = (!fp || !!this.meal) && (!this.photoOn || this.photo.opts.me);
    const eye = this.r.persp.position;
    // first-person haze, thick enough to hide the far edge of the view distance
    sh.uFog.value.set(eye.x, eye.y, eye.z, fp && !this.inside ? 2.15 / (this.viewDist - 18) : 0);
    if (document.pointerLockElement && (!fp || this.ui.busy)) document.exitPointerLock();
    this.koi?.update(sh.uTime.value);
    this.particles.update(this.cam.right, this.cam.up, this.tod.particleLight);
    this.beams.update(sh.uSunDir.value, sh.uSunColor.value, this.inside ? 1 : sh.uNight.value);
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
      // the lemon terraces at the top of the town
      if (AMALFI && this.started && !this.inside && !this.s.flags.climbed && pl.y > 26) {
        this.s.flags.climbed = true;
        this.ui.toast('flower', 'The lemon terraces', 'The whole town below, the sea beyond. Worth every step.', true);
        this.afterChange();
      }
      // the terrace of the Süleymaniye, the whole Horn below
      if (ISTANBUL && this.started && !this.inside && !this.upstairs && !this.s.flags.climbed && pl.y > 12.5) {
        this.s.flags.climbed = true;
        this.ui.toast('skyline', 'The Süleymaniye terrace', 'The Golden Horn below, Galata across it, Asia beyond the Bosphorus. Worth every step.', true);
        this.afterChange();
      }
      const rs = rm?.stall ? STALL[rm.stall] : undefined;
      const rn = rs ? [rs.name, rs.jp] : rm ? roomName(rm.kind, rm.nth, rm.hotel) : null;
      const up = this.upstairs, hi = up && HOTEL[up.hotel.id];
      const z = this.inside ? { name: TEXT.hidden.name, jp: TEXT.hidden.local } : up && hi ? { name: `${hi.name} · ${roomNo(up.room.floor)}`, jp: hi.jp } : rn ? { name: rn[0], jp: rn[1] } : zoneAt(pl.x, pl.z) ?? { name: TEXT.name, jp: TEXT.local };
      this.hotelGoal();
      this.ui.location(z.name, z.jp, this.tod.label());
      this.placeName = z.name;
      let sizzle = 0;
      if (!this.inside) for (const e of this.w.anchors.emitters) {
        if (e.kind === 'incense') continue;
        const d = Math.hypot(e.pos[0] - pl.x, e.pos[2] - pl.z);
        sizzle = Math.max(sizzle, 1 - d / 7);
      }
      const water = this.inside ? 0 : ISTANBUL ? THREE.MathUtils.clamp(1 - Math.min(30 - pl.x, 44 - pl.z) / 18, 0, 1) : AMALFI ? THREE.MathUtils.clamp((pl.x - 22) / 22, 0, 1) : Math.max(0, 1 - Math.abs(pl.z - 46.5) / 9);
      this.audio.ambience(Math.max(0, sizzle), water, this.tod.night, this.inside);
      // Sant'Andrea strikes the hours (not through the small hours)
      const hr = Math.floor(this.tod.hour);
      if (AMALFI && hr !== this.lastToll) {
        if (this.lastToll >= 0 && this.started && hr >= 7 && hr <= 22) {
          const d = Math.hypot(pl.x + 23, pl.z - 14);
          this.audio.toll(hr % 12 || 12, 0.22 * THREE.MathUtils.clamp(1 - d / 160, 0.2, 1));
        }
        this.lastToll = hr;
      }
      // the call to prayer, from the New Mosque first and the Süleymaniye a beat later, five times a day
      if (ISTANBUL) {
        const slot = EZAN.findIndex((t) => this.tod.hour >= t && this.tod.hour < t + 0.25);
        if (slot !== this.lastEzan) {
          if (slot >= 0 && this.lastEzan !== -2 && this.started) {
            const near = (x: number, z: number) => THREE.MathUtils.clamp(1 - Math.hypot(pl.x - x, pl.z - z) / 200, 0.25, 1);
            this.audio.ezan(0.2 * near(6, 10), 0);
            this.audio.ezan(0.12 * near(-137, -15), 2.6);
          }
          this.lastEzan = slot;
        }
      }
      this.audio.scene(pl.x, pl.z);
      if (this.started && Math.floor(this.s.playTime) % 10 === 0) this.save();
    }
    this.audio.tick(this.tod.night);
    this.perf.lap('hud/audio');
    // the pocket map covers the screen, so the world can rest under it
    if (!this.cityMap.isOpen) {
      this.chars.sync(); this.perf.lap('characters'); this.r.render();
      if (this.shot && --this.shot === 0) this.takePhoto();
    }
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
    dropLanding();
    document.getElementById('load-stage')!.textContent = `Your browser needs WebGL 2 to visit ${TEXT.name}. Try a recent Chrome, Safari or Firefox.`;
    return;
  }
  try {
    // a reload into another city mid-landing (boot.ts has the veil back up): build the street the trip starts in
    const resume = peekResume();
    await game.load(!!resume && 'board' in resume);
    game.title();
    // ?debug exposes the game for automated screenshots and console poking
    if (new URLSearchParams(location.search).has('debug')) (window as unknown as { game: Game }).game = game;
  } catch (e) {
    console.error(e);
    dropLanding();
    game.ui.loadError(`Something went wrong while building ${TEXT.name}.`);
  }
}

void boot();
