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
import { UI, GameHooks } from './ui/ui';
import { renderDishIcons } from './ui/icons';

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

const PLAYER_SPEED = 3.3;
const VENDOR_CALLS = ['Irasshaimase!', 'Fresh and hot!', 'Oishii yo!', 'Come, come!', 'Hai, dōzo!', 'Just made!'];

function playerLook(wear: Record<string, boolean>): Look {
  const l: Look = {
    skin: 0xf0c8a8, hair: 0x3b2a20, hairStyle: 'short', top: 0xf2efe7, topStyle: 'tee', accent: 0xd8452f,
    bottom: 0x3f6e9a, shoes: 0xf2efe7, hat: 'cap', hatColor: 0xd8452f, backpack: 0xe3a937,
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

  private worldGroup = new THREE.Group();
  private insideGroup = new THREE.Group();
  private chunks: { mesh: THREE.Mesh; box: THREE.Box3; cut: boolean }[] = [];
  private matWorld!: THREE.ShaderMaterial;
  private matCut!: THREE.ShaderMaterial;
  private doorClosed = new THREE.Group();
  private doorOpen = new THREE.Group();

  player!: Actor;
  private path: [number, number][] = [];
  private pending: Interactable | null = null;
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
  private joy: { id: number; sx: number; sy: number; x: number; y: number; active: boolean; t: number } | null = null;
  private pinch: { d: number } | null = null;
  private pointers = new Map<number, { x: number; y: number }>();
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
    this.cam = new IsoCamera(this.r.camera);
    this.r.scene.add(this.worldGroup, this.insideGroup);
    this.insideGroup.visible = false;
    const hooks: GameHooks = {
      buy: (d, st) => this.buy(d, st),
      cooked: (d, st, stars) => this.cooked(d, st, stars),
      claim: (m) => this.claim(m),
      wearChanged: () => { this.rebuildPlayer(); this.save(); },
      settingsChanged: () => { this.applySettings(); this.save(); },
      reset: () => { resetState(); location.reload(); },
      panel: (open) => { if (open) { this.path = []; this.joy = null; } },
      travel: () => {},
    };
    this.ui = new UI(this.s, this.audio, hooks);
    this.ui.onPrompt = () => this.interact();
    this.ui.onRotate = (d) => this.cam.rotate(d);
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
    this.worldGroup.add(this.doorClosed, this.doorOpen);
    for (const t of w.tagged) this.mesh(t.mesh, this.matWorld, t.tag === 'door-closed' ? this.doorClosed : this.doorOpen);
    for (const md of w.interiorChunks) this.mesh(md, this.matCut, this.insideGroup);
    this.navWorld = new Nav(w.nav);
    this.navInside = new Nav(w.interiorNav);
    this.nav = this.navWorld;
    this.lm = w.lightmap;
    this.setDoor(this.s.manekis.length >= 3);

    this.blobs = new Blobs(this.r.scene, 64);
    this.koi = new Koi(this.worldGroup as unknown as THREE.Scene, this.r, a.koiArea);
    this.particles = new Particles(this.r, a.emitters, a.manekis);
    for (const i of this.s.manekis) this.particles.hideSparkle(i);

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
    this.player = new Actor(buildPerson(playerLook(this.s.wear)), this.r.shared);
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
    this.ui.title(() => this.start());
    this.bindInput();
    requestAnimationFrame((t) => this.frame(t));
  }

  private start(): void {
    this.started = true;
    this.cam.setOrbit(0);
    this.cam.yaw = Math.round((this.cam.yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
    this.cam.zoom = this.r.isMobile ? 15 : 17;
    this.ui.showHud(true);
    this.applySettings();
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
    this.r.composite.uniforms.uTilt.value = st.tilt ? 0.6 : 0;
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
        case 'Escape': this.ui.endDialogue(); this.ui.close(); break;
        case 'Equal': case 'NumpadAdd': this.cam.zoomBy(0.85); break;
        case 'Minus': case 'NumpadSubtract': this.cam.zoomBy(1.18); break;
      }
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());
    canvas.addEventListener('wheel', (e) => { e.preventDefault(); this.cam.zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.start();
      canvas.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const [p1, p2] = [...this.pointers.values()];
        this.pinch = { d: Math.hypot(p1.x - p2.x, p1.y - p2.y) };
        this.joy = null;
      } else if (this.pointers.size === 1) {
        this.joy = { id: e.pointerId, sx: e.clientX, sy: e.clientY, x: 0, y: 0, active: false, t: performance.now() };
      }
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      p.x = e.clientX; p.y = e.clientY;
      if (this.pinch && this.pointers.size >= 2) {
        const [p1, p2] = [...this.pointers.values()];
        const d = Math.hypot(p1.x - p2.x, p1.y - p2.y);
        if (d > 0 && this.pinch.d > 0) this.cam.zoomBy(this.pinch.d / d);
        this.pinch.d = d;
        return;
      }
      const j = this.joy;
      if (j && j.id === e.pointerId) {
        const dx = e.clientX - j.sx, dy = e.clientY - j.sy;
        if (!j.active && Math.hypot(dx, dy) > 14) { j.active = true; this.path = []; this.pending = null; }
        if (j.active) {
          const len = Math.hypot(dx, dy), k = Math.min(1, len / 70) / Math.max(1e-3, len);
          j.x = dx * k; j.y = dy * k;
        }
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      const j = this.joy;
      if (j && j.id === e.pointerId) {
        if (!j.active && performance.now() - j.t < 450 && e.type === 'pointerup') this.tap(e.clientX, e.clientY);
        this.joy = null;
      }
    };
    canvas.addEventListener('pointerup', up);
    canvas.addEventListener('pointercancel', up);
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
    let dx = 0, dz = 0, speed = 0;
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
        speed = PLAYER_SPEED * Math.min(1, Math.hypot(f, rt));
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
          speed = PLAYER_SPEED * (this.path.length === 1 ? Math.min(1, 0.35 + d) : 1);
        }
      }
    }
    if (speed > 0) {
      const hv = this.nav.standHeightVox(p.x, p.z);
      const from = hv === 255 ? 12 : hv;
      const nx = p.x + dx * speed * dt, nz = p.z + dz * speed * dt;
      const follow = this.path.length > 0;
      if (follow || this.nav.canStand(nx, nz, from)) { p.x = nx; p.z = nz; }
      else if (this.nav.canStand(nx, p.z, from)) p.x = nx;
      else if (this.nav.canStand(p.x, nz, from)) p.z = nz;
      else speed = 0;
      if (speed > 0) pl.targetFacing = Math.atan2(dx, dz);
    }
    p.y += (this.nav.heightAt(p.x, p.z) - p.y) * Math.min(1, dt * 14);
    pl.speed = speed / 1.4;
    if (this.eatT > 0) { this.eatT -= dt; if (speed > 0) this.eatT = 0; }
    pl.anim = speed > 0 ? (speed > 2.5 ? 'run' : 'walk') : this.eatT > 0 ? 'eat' : 'idle';
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
    this.blobs.begin();
    const pl = this.player.position;
    this.blobs.add(pl.x, pl.y + 0.02, pl.z, 0.62, 0.5);
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
    for (const it of this.interactables) {
      if (it.inside !== this.inside) continue;
      const d = Math.hypot(it.x - p.x, it.z - p.z);
      if (d < it.r && d < bd) { bd = d; best = it; }
    }
    this.near = best;
    const pr = best && this.started && !this.ui.busy ? best.prompt() : null;
    if (pr && best) this.ui.prompt(best.key + pr[1], pr[0], pr[1], pr[2]);
    else this.ui.prompt('', '', '');
  }

  private updateCutaway(): void {
    const p = this.player.position;
    const sh = this.r.shared;
    sh.uCutPos.value.set(p.x, p.y, p.z);
    sh.uCamFwd.value.copy(this.cam.fwd);
    if (this.inside) return;
    for (const c of this.chunks) {
      const b = c.box;
      const cut = p.x > b.min.x - 5 && p.x < b.max.x + 5 && p.z > b.min.z - 5 && p.z < b.max.z + 5;
      if (cut !== c.cut) { c.cut = cut; c.mesh.material = cut ? this.matCut : this.matWorld; }
    }
  }

  private updateCamera(dt: number): void {
    if (this.started) this.cam.target.copy(this.player.position).add(this.v3.set(0, 0.6, 0));
    this.cam.update(dt, window.innerWidth / Math.max(1, window.innerHeight));
  }

  private frame(now: number): void {
    requestAnimationFrame((t) => this.frame(t));
    const raw = now - this.last;
    this.last = now;
    const dt = Math.min(0.05, raw / 1000);
    const sh = this.r.shared;
    sh.uTime.value += dt;
    this.tod.update(dt);
    this.tod.apply(this.r);
    if (this.inside) { sh.uLamp.value = Math.max(sh.uLamp.value, 0.95); sh.uSunColor.value.multiplyScalar(0.35); }
    if (this.started) this.s.playTime += dt;

    this.movePlayer(dt);
    this.updateNPCs(dt);
    this.updateNear();
    this.updateCamera(dt);
    this.updateCutaway();
    this.koi.update(sh.uTime.value);
    this.particles.update(this.cam.right, this.cam.up, this.tod.particleLight);
    const pl = this.player.position;
    this.ui.updateLabels((p) => this.screen(p), (p) => {
      const d = Math.hypot(p[0] - pl.x, p[2] - pl.z);
      return Math.max(0.0, Math.min(1, 1.6 - d / 14));
    });

    // HUD + audio at a calmer rate
    this.hudT -= dt;
    if (this.hudT <= 0) {
      this.hudT = 0.25;
      const z = this.inside ? { name: 'Kakurega · Hidden Counter', jp: '隠れ家' } : zoneAt(pl.x, pl.z) ?? { name: 'Tokyo', jp: '東京' };
      this.ui.location(z.name, z.jp, this.tod.label());
      let sizzle = 0;
      if (!this.inside) for (const e of this.w.anchors.emitters) {
        if (e.kind === 'incense') continue;
        const d = Math.hypot(e.pos[0] - pl.x, e.pos[2] - pl.z);
        sizzle = Math.max(sizzle, 1 - d / 7);
      }
      const water = this.inside ? 0 : Math.max(0, 1 - Math.abs(pl.z - 46.5) / 9);
      this.audio.ambience(Math.max(0, sizzle), water, this.tod.night);
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
