import * as THREE from 'three';
import type { Renderer } from './renderer';

/**
 * Sun shafts: the light that falls through a great hall's windows (a cathedral's rose, lancets and aisle windows,
 * the ring of windows round a mosque's dome and the coloured lights in its walls), drawn as soft dusty volumes.
 *
 * Each window is a slanted box swept from its glass along the real sun's direction, so the beams turn with the time
 * of day and fade out when the sun leaves that side of the building or sets. The box is drawn by its back faces into
 * the half-resolution particle buffer; every pixel works out how far its view ray runs through the beam (cut by the
 * floor, the rooms the light may reach and the scene's own depth, so a pier or a painting in front hides the light
 * behind it, and nothing is drawn floating in front of a wall) and adds the light along that stretch. The window's
 * panes colour the light: stained glass throws soft coloured light, and where the beam meets the floor, a pew or a
 * wall it leaves the window's pattern on it, spokes of a rose and all.
 *
 * One mesh per hall, eight vertices a window, built once. Only the hall the player is in (or looking into, in first
 * person) is drawn, and a window the sun is not on collapses in the vertex shader. In the iso view the cutaway opens
 * the hall at some height; the beams are cut there too.
 */

/** A floor plan (metres: x0, z0, x1, z1) and the height (m) light reaches in it. */
export type BeamRoom = [number, number, number, number, number];

/** A window the sun can shine through. */
export interface Beam {
  /** Centre of the glass's inner face (m), its width across and height, and its outward normal. */
  x: number; y: number; z: number; w: number; h: number; nx: number; nz: number;
  /**
   * The panes as seen from inside: cols x rows (at most PANE each), row by row from the bottom, left to right along
   * (-nz, nx); each an RGB hex, or -1 where the window is stone (a spoke, a mullion) and lets no light through.
   */
  panes?: { cols: number; rows: number; rgb: number[] };
  /**
   * Where the light may fall, at most two boxes that do not overlap (the hall's own floor plan when left out): an
   * aisle window lights its aisle, and the nave only under the arcade's arches.
   */
  rooms?: BeamRoom[];
}

export interface ShaftHall { rect: [number, number, number, number]; floor: number; beams: Beam[] }

/** Panes per side of a window's tile in the colour atlas. */
export const PANE = 16;
const TILES = 16; // tiles per row of the atlas
const MAX_LEN = 34; // metres a beam may run before it reaches the floor (a low sun)
/** Clear glass, and how far coloured glass is pulled towards it: soft colour, never neon. */
const WARM = [1, 0.93, 0.8];
const SAT = 0.5;

export class Shafts {
  private groups: { mesh: THREE.Mesh; hall: ShaftHall; mat: THREE.ShaderMaterial }[] = [];
  private atlas: THREE.DataTexture;

  constructor(r: Renderer, halls: ShaftHall[]) {
    this.atlas = paneAtlas(halls.flatMap((h) => h.beams));
    let tile = 0;
    for (const hall of halls) {
      if (!hall.beams.length) continue;
      const mat = shaftMaterial(r, this.atlas, hall.floor);
      const mesh = new THREE.Mesh(beamGeometry(hall, tile), mat);
      tile += hall.beams.length;
      mesh.frustumCulled = false;
      mesh.visible = false;
      r.particleScene.add(mesh);
      this.groups.push({ mesh, hall, mat });
    }
  }

  /**
   * Shows the beams of the hall around p (the player). `room` is how high over its floor the iso cutaway opens
   * the hall the player stands in (null when the cutaway is off).
   */
  update(p: THREE.Vector3, fp: boolean, room: number | null): void {
    for (const g of this.groups) {
      const [x0, z0, x1, z1] = g.hall.rect;
      const d = Math.hypot(Math.max(x0 - p.x, 0, p.x - x1), Math.max(z0 - p.z, 0, p.z - z1));
      const inside = d === 0 && p.y > g.hall.floor - 1.5;
      // in first person the beams show through the door as you come near; in the iso view only from inside
      // (from outside a lowered hall is cut at its floor, and its beams would hang in the air)
      g.mesh.visible = fp ? d < 26 : inside;
      g.mat.uniforms.uTop.value = fp || room === null ? 1e4 : g.hall.floor + room;
    }
  }
}

/** sRGB hex to linear, the light it lets through pulled towards warm clear glass. */
function paneLight(hex: number): [number, number, number] {
  if (hex < 0) return [0, 0, 0];
  const c = [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255].map((v) => Math.pow(v / 255, 2.2));
  const m = Math.max(c[0], c[1], c[2], 1e-3);
  return [0, 1, 2].map((i) => WARM[i] + (c[i] / m - WARM[i]) * SAT) as [number, number, number];
}

/** One PANE x PANE tile per window: the light each pane lets through (alpha: how much). */
function paneAtlas(beams: Beam[]): THREE.DataTexture {
  const rows = Math.max(1, Math.ceil(beams.length / TILES));
  const W = TILES * PANE, H = rows * PANE;
  const data = new Uint8Array(W * H * 4);
  beams.forEach((b, i) => {
    const ox = (i % TILES) * PANE, oy = Math.floor(i / TILES) * PANE;
    const p = b.panes ?? { cols: 1, rows: 1, rgb: [-2] };
    for (let v = 0; v < p.rows; v++) for (let u = 0; u < p.cols; u++) {
      const hex = p.rgb[v * p.cols + u];
      const c = hex === -2 ? WARM : paneLight(hex);
      const o = ((oy + v) * W + ox + u) * 4;
      data[o] = Math.round(c[0] * 255); data[o + 1] = Math.round(c[1] * 255); data[o + 2] = Math.round(c[2] * 255);
      data[o + 3] = hex === -1 ? 0 : 255;
    }
  });
  const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.LinearFilter;
  t.needsUpdate = true;
  return t;
}

function beamGeometry(hall: ShaftHall, tile0: number): THREE.BufferGeometry {
  // per vertex: its corner of the unit beam (a across, b up, s along: 0 at the glass, 1 at the far end), and per
  // window its centre, half extents and normal, its tile in the atlas, and the rooms its light may reach
  const corner: number[] = [], centre: number[] = [], ext: number[] = [], tile: number[] = [], roomA: number[] = [], roomB: number[] = [], roomY: number[] = [], idx: number[] = [];
  const all: BeamRoom = [hall.rect[0], hall.rect[1], hall.rect[2], hall.rect[3], 1e4];
  hall.beams.forEach((b, i) => {
    const v0 = corner.length / 3;
    const t = tile0 + i;
    const p = b.panes ?? { cols: 1, rows: 1 };
    const ra = b.rooms?.[0] ?? all, rb = b.rooms?.[1] ?? [1, 1, 0, 0, 0];
    for (const s of [0, 1]) for (const bb of [-1, 1]) for (const a of [-1, 1]) {
      corner.push(a, bb, s);
      centre.push(b.x, b.y, b.z);
      ext.push(b.w / 2, b.h / 2, b.nx, b.nz);
      tile.push((t % TILES) * PANE, Math.floor(t / TILES) * PANE, p.cols, p.rows);
      // the rooms, never past the hall's own walls
      roomA.push(Math.max(ra[0], all[0]), Math.max(ra[1], all[1]), Math.min(ra[2], all[2]), Math.min(ra[3], all[3]));
      roomB.push(Math.max(rb[0], all[0]), Math.max(rb[1], all[1]), Math.min(rb[2], all[2]), Math.min(rb[3], all[3]));
      roomY.push(ra[4], rb[4]);
    }
    // the six faces of the box (the material draws the back ones)
    const q = (a: number, b2: number, c: number, d: number) => idx.push(v0 + a, v0 + b2, v0 + c, v0 + a, v0 + c, v0 + d);
    q(0, 1, 3, 2); q(4, 6, 7, 5); q(0, 4, 5, 1); q(2, 3, 7, 6); q(0, 2, 6, 4); q(1, 5, 7, 3);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(corner, 3));
  g.setAttribute('aCentre', new THREE.Float32BufferAttribute(centre, 3));
  g.setAttribute('aExt', new THREE.Float32BufferAttribute(ext, 4));
  g.setAttribute('aTile', new THREE.Float32BufferAttribute(tile, 4));
  g.setAttribute('aRoomA', new THREE.Float32BufferAttribute(roomA, 4));
  g.setAttribute('aRoomB', new THREE.Float32BufferAttribute(roomB, 4));
  g.setAttribute('aRoomY', new THREE.Float32BufferAttribute(roomY, 2));
  g.setIndex(idx);
  return g;
}

function shaftMaterial(r: Renderer, atlas: THREE.DataTexture, floor: number): THREE.ShaderMaterial {
  const u = r.shared;
  return new THREE.ShaderMaterial({
    glslVersion: THREE.GLSL3,
    uniforms: {
      uSunDir: u.uSunDir, uSunColor: u.uSunColor, uNight: u.uNight, uTime: u.uTime, tNoise: u.tNoise,
      tDepth: r.particleDepth, tScene: r.particleColor, uClip: r.clip,
      tPanes: { value: atlas }, uAtlas: { value: new THREE.Vector2(atlas.image.width, atlas.image.height) },
      uFloor: { value: floor }, uTop: { value: 1e4 }, 
    },
    vertexShader: /* glsl */ `
      in vec3 aCentre;
      in vec4 aExt;
      in vec4 aTile;
      in vec4 aRoomA;
      in vec4 aRoomB;
      in vec2 aRoomY;
      uniform vec3 uSunDir;
      uniform float uFloor;
      out vec3 vW;
      out vec4 vClip;
      flat out vec3 vC;
      flat out mat3 vInv;
      flat out vec4 vTile;
      flat out vec4 vRoomA;
      flat out vec4 vRoomB;
      flat out vec2 vRoomY;
      flat out float vLit;
      void main() {
        // light travels away from the sun; a sun on the other side of the wall, or under the horizon, lights nothing
        vec3 d = -normalize(uSunDir);
        vec2 n = aExt.zw;
        vLit = smoothstep(0.02, 0.22, dot(uSunDir.xz, n)) * smoothstep(0.03, 0.2, uSunDir.y);
        // the box: across the window, up it, and along the light until the top of the window reaches the floor
        float len = min(${MAX_LEN.toFixed(1)}, (aCentre.y + aExt.y - uFloor) / max(0.03, -d.y)) + 0.5;
        mat3 M = mat3(vec3(-n.y, 0.0, n.x) * aExt.x, vec3(0.0, aExt.y, 0.0), d * len);
        vW = aCentre + M * position;
        vC = aCentre; vInv = inverse(M); vTile = aTile;
        vRoomA = aRoomA; vRoomB = aRoomB; vRoomY = aRoomY;
        // a window out of the sun draws nothing
        vClip = projectionMatrix * viewMatrix * vec4(vW, 1.0);
        gl_Position = vLit < 0.003 ? vec4(2.0, 2.0, 2.0, 1.0) : vClip;
      }`,
    fragmentShader: /* glsl */ `
      precision highp float;
      uniform vec3 uSunColor;
      uniform vec3 uSunDir;
      uniform float uNight;
      uniform float uTime;
      uniform float uTop;
      uniform float uFloor;
      uniform vec3 uClip;
      uniform vec2 uAtlas;
      uniform sampler2D tNoise;
      uniform sampler2D tDepth;
      uniform sampler2D tScene;
      uniform sampler2D tPanes;
      in vec3 vW;
      in vec4 vClip;
      flat in vec3 vC;
      flat in mat3 vInv;
      flat in vec4 vTile;
      flat in vec4 vRoomA;
      flat in vec4 vRoomB;
      flat in vec2 vRoomY;
      flat in float vLit;
      layout(location = 0) out vec4 outColor;

      float linZ(float d) { return uClip.z > 0.5 ? uClip.x * uClip.y / (uClip.y - d * (uClip.y - uClip.x)) : uClip.x + d * (uClip.y - uClip.x); }

      // where a ray (o, 1/r) is inside the box lo..hi
      vec2 slab(vec3 o, vec3 ir, vec3 lo, vec3 hi) {
        vec3 a = (lo - o) * ir, b = (hi - o) * ir;
        vec3 mn = min(a, b), mx = max(a, b);
        return vec2(max(max(mn.x, mn.y), mn.z), min(min(mx.x, mx.y), mx.z));
      }
      vec3 inv(vec3 v) { return 1.0 / ((vec3(greaterThanEqual(v, vec3(0.0))) * 2.0 - 1.0) * max(abs(v), vec3(1e-6))); }

      // the light the window lets through at (a, b) across it
      vec4 pane(vec2 ab) {
        vec2 t = clamp((ab * 0.5 + 0.5) * vTile.zw, vec2(0.5), vTile.zw - 0.5);
        return texture(tPanes, (vTile.xy + t) / uAtlas);
      }
      // how much light at a point of the beam (q: across, up, along): soft at its edges, thinning as it falls
      float edge(vec2 ab) {
        vec2 e = smoothstep(vec2(1.0), vec2(0.7), abs(ab));
        return e.x * e.y;
      }

      void main() {
        if (vLit < 0.003) discard;
        vec3 fwd = -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]);
        bool persp = uClip.z > 0.5;
        // the view ray: from the eye, or (iso) from the camera's plane straight along its view; t is metres along it
        vec3 R = persp ? normalize(vW - cameraPosition) : fwd;
        vec3 O = persp ? cameraPosition : vW - fwd * dot(vW - cameraPosition, fwd);
        // the scene behind this pixel
        vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
        float dz = texture(tDepth, suv).r;
        float tScn = dz < 1.0 ? linZ(dz) / (persp ? dot(R, fwd) : 1.0) : 1e5;

        // the ray in the beam's own space, and the stretch of it inside the beam
        vec3 bo = vInv * (O - vC), br = vInv * R;
        vec2 tb = slab(bo, inv(br), vec3(-1.0, -1.0, 0.0), vec3(1.0));
        tb.x = max(tb.x, persp ? uClip.x : 0.0);
        tb.y = min(tb.y, tScn);
        // and inside the rooms its light reaches (above the floor, under the cutaway's cut)
        vec3 ir = inv(R);
        float top = min(uTop, 1e4);
        vec2 ta = slab(O, ir, vec3(vRoomA.x, uFloor, vRoomA.y), vec3(vRoomA.z, min(top, vRoomY.x), vRoomA.w));
        vec2 tc = slab(O, ir, vec3(vRoomB.x, uFloor, vRoomB.y), vec3(vRoomB.z, min(top, vRoomY.y), vRoomB.w));
        ta = vec2(max(ta.x, tb.x), min(ta.y, tb.y));
        tc = vec2(max(tc.x, tb.x), min(tc.y, tb.y));

        float day = vLit * (1.0 - uNight);
        vec3 sun = uSunColor * day;
        vec3 acc = vec3(0.0);
        // dust drifting through the light: two layers of slow noise, sampled at a few points along the stretch
        for (int k = 0; k < 2; k++) {
          vec2 tt = k == 0 ? ta : tc;
          float L = tt.y - tt.x;
          if (L <= 0.0) continue;
          vec3 sum = vec3(0.0);
          for (int j = 0; j < 3; j++) {
            float t = tt.x + L * (float(j) + 0.5) / 3.0;
            vec3 q = bo + br * t;
            vec3 w = O + R * t;
            vec2 qd = w.xz * 0.35 + w.y * vec2(0.21, -0.17);
            float n1 = texture(tNoise, qd * 0.25 + vec2(uTime * 0.004, uTime * 0.003)).r;
            float n2 = texture(tNoise, qd * 0.9 - vec2(uTime * 0.007, -uTime * 0.005)).r;
            vec4 c = pane(q.xy);
            sum += c.rgb * c.a * edge(q.xy) * (1.0 - q.z * 0.6) * (0.55 + 1.2 * n1 * n2);
          }
          acc += sum / 3.0 * L;
        }
        // the light builds up along the ray but never past a soft glow
        float lum = max(max(acc.r, acc.g), max(acc.b, 1e-4));
        vec3 col = sun * acc / lum * 0.16 * (1.0 - exp(-lum * 1.2));

        // where the beam lands (the floor, a pew, a wall turned to the sun) it leaves the window's light on it
        vec3 P = O + R * tScn;
        vec3 nrm = cross(dFdx(P), dFdy(P));
        if (dz < 1.0 && dot(nrm, nrm) > 1e-12) {
          nrm = normalize(nrm);
          if (dot(nrm, R) > 0.0) nrm = -nrm;
          vec3 qs = vInv * (P - vC);
          bool inA = P.x > vRoomA.x && P.z > vRoomA.y && P.x < vRoomA.z && P.z < vRoomA.w && P.y < vRoomY.x;
          bool inB = P.x > vRoomB.x && P.z > vRoomB.y && P.x < vRoomB.z && P.z < vRoomB.w && P.y < vRoomY.y;
          if (all(lessThan(abs(qs.xy), vec2(1.0))) && qs.z > 0.0 && qs.z < 1.0 && (inA || inB) && P.y < top && P.y > uFloor - 0.3) {
            vec4 c = pane(qs.xy);
            vec3 base = texture(tScene, suv).rgb;
            col += base * sun * c.rgb * c.a * edge(qs.xy) * max(dot(nrm, normalize(uSunDir)), 0.0) * 2.2 * (1.0 - qs.z * 0.4);
          }
        }
        outColor = vec4(col, 0.0);
      }`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    side: THREE.BackSide,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
  });
}
