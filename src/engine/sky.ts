import * as THREE from 'three';
import { CITY } from '../world/cityId';
import { FS_VERT, CLOUD_WIND } from './shaders';
import { bakeFuji, type Backdrop } from './fuji';

/**
 * The sky: a small physically based atmosphere (Rayleigh, Mie and ozone, single scattering on a round Earth)
 * rendered into a sky-view table whenever the sun or moon moves, so the composite only looks it up. Real
 * scattering gives a deep zenith, a pale but coloured horizon, sunsets that redden through the air mass, the
 * Earth's shadow and the blue hour after the sun has gone. On top of it the composite draws, nearest first:
 * voxel clouds (a heightfield of cubes drifting on the wind), far voxel mountains baked into a backdrop
 * (Mount Fuji in Tokyo), a blocky sun and moon, and stars that wheel round the pole through the night.
 *
 * The same atmosphere runs on the CPU for a handful of directions each frame: the haze colour every far
 * shader fades into is the sky's own horizon colour in the direction you look, so distance reads as air,
 * not as a pale mist laid over the town.
 */

/** Per-city air: aerosol load (city haze), light pollution, stars, the cloud deck. */
interface Look {
  /** Mie (aerosol) scattering, times the clean-air value: a big city's haze or a sea breeze. */
  mie: number;
  /** City glow on the horizon and the cloud bases at night (linear rgb). */
  glow: [number, number, number];
  /** Share of star cells lit: dark coasts see thousands, a megacity a few hundred. */
  stars: number;
  milkyWay: number;
  /** Cloud deck: base height above the street (m), cube size (m), most layers, cover 0..1, haze distance (m). */
  cloud: { base: number; cell: number; layers: number; cover: number; fade: number };
  /** Far backdrop baked into the sky (voxel mountains), if any. */
  backdrop: 'fuji' | null;
  /** How fast the far backdrop disappears into the air (1/m). */
  farHaze: number;
}

const LOOKS: Record<string, Look> = {
  tokyo: {
    mie: 1.35, glow: [0.03, 0.016, 0.03], stars: 0.0028, milkyWay: 0,
    cloud: { base: 300, cell: 18, layers: 6, cover: 0.3, fade: 5200 }, backdrop: 'fuji', farHaze: 1 / 34000,
  },
  amalfi: {
    mie: 0.75, glow: [0.006, 0.0045, 0.005], stars: 0.011, milkyWay: 1,
    cloud: { base: 1150, cell: 52, layers: 5, cover: 0.22, fade: 15000 }, backdrop: null, farHaze: 1 / 60000,
  },
  istanbul: {
    mie: 1.35, glow: [0.026, 0.017, 0.016], stars: 0.0045, milkyWay: 0,
    cloud: { base: 360, cell: 22, layers: 6, cover: 0.28, fade: 6500 }, backdrop: null, farHaze: 1 / 40000,
  },
};
/** A city without its own entry gets clear coastal air. */
const LOOK: Look = LOOKS[CITY] ?? LOOKS.amalfi;

// ---- atmosphere (shared numbers for the GLSL table and the CPU copy) ----
const R0 = 6360e3, RA = 6460e3, EYE = 40;
const BR = [5.802e-6, 13.558e-6, 33.1e-6];
const BO = [0.65e-6, 1.881e-6, 0.085e-6];
const BM = 3.996e-6;
const HR = 8000, HM = 1200;
const G = 0.78;
const VIEW_STEPS = 28, LIGHT_STEPS = 6;
/** Brightness of the sun and the moon in the table (the moon is far brighter than real, so night has a sky). */
const SUN_I = 9.0, MOON_I = 0.07;
/** Far things fade to the sky this high up (radians), this much darker: soft blue silhouettes, not a white mist. */
const HAZE_EL = 0.07, HAZE_DIM = 0.86;
/** Airglow: a faint sky even on a moonless night. */
const NIGHT_BASE = [0.0018, 0.0032, 0.0095];

const f = (n: number) => n.toExponential(6);
const v3 = (a: number[]) => `vec3(${a.map(f).join(', ')})`;

const ATMO_GLSL = /* glsl */ `
const float R0 = ${f(R0)}, RA = ${f(RA)}, HR = ${f(HR)}, HM = ${f(HM)}, MG = ${G.toFixed(3)};
const vec3 BR = ${v3(BR)}, BO = ${v3(BO)};
const float BM = ${f(BM)};
// ray against a sphere at the origin: near and far hits (far < 0: no hit)
vec2 sphere(vec3 o, vec3 d, float r) {
  float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c;
  if (h < 0.0) return vec2(-1.0);
  h = sqrt(h);
  return vec2(-b - h, -b + h);
}
// rayleigh, mie, ozone densities at a height (m)
vec3 dens(float h) {
  return vec3(exp(-h / HR), exp(-h / HM), max(0.0, 1.0 - abs(h - 25e3) / 15e3));
}
// optical depth (rayleigh, mie, ozone) from p toward the light; the Earth's shadow is total
vec3 lightDepth(vec3 p, vec3 l) {
  vec2 g = sphere(p, l, R0);
  if (g.x > 0.0) return vec3(1e9);
  float t = sphere(p, l, RA).y, ds = t / ${LIGHT_STEPS}.0;
  vec3 od = vec3(0.0);
  for (int i = 0; i < ${LIGHT_STEPS}; i++) od += dens(length(p + l * (ds * (float(i) + 0.5))) - R0);
  return od * ds;
}
`;

const LUT_FRAG = /* glsl */ `
precision highp float;
${ATMO_GLSL}
uniform vec3 uSun, uMoon, uGlow;
uniform float uMie, uSunI, uMoonI;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  float az = (vUv.x - 0.5) * 6.2831853;
  float s = vUv.y * 2.0 - 1.0;
  float e = sign(s) * s * s * 1.5707963;
  vec3 d = vec3(sin(az) * cos(e), sin(e), cos(az) * cos(e));
  vec3 o = vec3(0.0, R0 + ${EYE.toFixed(1)}, 0.0);
  vec2 ga = sphere(o, d, RA), gg = sphere(o, d, R0);
  bool ground = gg.x > 0.0;
  float tMax = ground ? gg.x : ga.y;
  float ds = tMax / ${VIEW_STEPS}.0;
  float bm = BM * uMie;
  float muS = dot(d, uSun), muM = dot(d, uMoon);
  float pr = 0.0596831; // 3 / (16 pi)
  float prS = pr * (1.0 + muS * muS), prM = pr * (1.0 + muM * muM);
  float k = 0.1193662 * (1.0 - MG * MG) / (2.0 + MG * MG);
  float pmS = k * (1.0 + muS * muS) / pow(1.0 + MG * MG - 2.0 * MG * muS, 1.5);
  float pmM = k * (1.0 + muM * muM) / pow(1.0 + MG * MG - 2.0 * MG * muM, 1.5);
  vec3 od = vec3(0.0), sumS = vec3(0.0), sumM = vec3(0.0);
  for (int i = 0; i < ${VIEW_STEPS}; i++) {
    vec3 p = o + d * (ds * (float(i) + 0.5));
    vec3 dn = dens(length(p) - R0) * ds;
    od += dn * 0.5;
    vec3 tv = BR * od.x + bm * 1.11 * od.y + BO * od.z;
    vec3 ls = lightDepth(p, uSun), lm = lightDepth(p, uMoon);
    vec3 ts = exp(-(tv + BR * ls.x + bm * 1.11 * ls.y + BO * ls.z));
    vec3 tm = exp(-(tv + BR * lm.x + bm * 1.11 * lm.y + BO * lm.z));
    sumS += ts * (BR * dn.x * prS + bm * dn.y * pmS);
    sumM += tm * (BR * dn.x * prM + bm * dn.y * pmM);
    od += dn * 0.5;
  }
  vec3 col = sumS * uSunI + sumM * uMoonI;
  if (ground) {
    // the land past the city: dark ground lit through the air, then hazed by the air in front of it
    vec3 p = o + d * tMax, n = normalize(p);
    vec3 tv = exp(-(BR * od.x + bm * 1.11 * od.y + BO * od.z));
    vec3 ls = lightDepth(p + n, uSun);
    vec3 lit = exp(-(BR * ls.x + bm * 1.11 * ls.y + BO * ls.z)) * max(dot(n, uSun), 0.0) * uSunI;
    col += tv * lit * 0.09 * 0.318;
  }
  // airglow and the city's light dome low on the horizon
  float up = max(e, 0.0);
  col += ${v3(NIGHT_BASE)} + uGlow * (exp(-up * 9.0) * 0.85 + 0.15 * exp(-up * 2.0));
  outColor = vec4(col, 1.0);
}
`;

/** GLSL for the composite: table lookup, sun, moon, stars, voxel clouds, far backdrop. Needs COMMON. */
export const SKY_GLSL = /* glsl */ `
uniform sampler2D tSkyLut;
uniform vec3 uSkySun, uSkyMoon;       // directions of the sun and moon in the sky
uniform vec3 uSunDisc, uMoonDisc;     // their discs' colour, through the air
uniform vec3 uSunHigh, uMoonHigh;     // their light up at the clouds and on the far mountains
uniform vec3 uSkyAmb;                 // light from the whole sky dome
uniform vec3 uSkyGlow;                // the city's light from below, on cloud bases
uniform mat3 uStarRot;
uniform vec4 uStars;                  // density, milky way, visibility, unused
uniform highp sampler2D tCloud;
uniform vec4 uCloudGeo;               // base height, cube size, layers, 1 / haze distance
uniform vec4 uCloudMap;               // threshold, gain, clear wedge (direction x, z) packed in zw
uniform sampler2D tFar;
uniform vec4 uFarRect;                // centre azimuth, 1 / azimuth span, lowest elevation, 1 / elevation span
uniform vec4 uFarAxes;                // forward (x, z), side (x, z) of the backdrop's voxel grid
uniform float uFarHaze;
uniform int uCloudSteps;              // cells a cloud ray may cross (fewer on lower quality)

const float HAZE_V = ${(0.5 + 0.5 * Math.sqrt(HAZE_EL * 2 / Math.PI)).toFixed(5)};
vec3 skyLut(vec3 d) {
  float e = asin(clamp(d.y, -1.0, 1.0));
  float u = atan(d.x, d.z) * 0.15915494 + 0.5;
  vec3 c = texture(tSkyLut, vec2(u, 0.5 + 0.5 * sign(e) * sqrt(abs(e) * 0.63661977))).rgb;
  // below the horizon the land past the city melts into the same blue-grey the city's haze turns to
  if (e < 0.0) c = mix(c, texture(tSkyLut, vec2(u, HAZE_V)).rgb * ${HAZE_DIM.toFixed(3)}, 0.85 * exp(e * 20.0));
  return c;
}
// the colour far things fade to, looking along d: the sky a few degrees up, a shade darker (see Sky.update)
vec3 hazeAt(vec3 d) {
  return texture(tSkyLut, vec2(atan(d.x, d.z) * 0.15915494 + 0.5, max(HAZE_V, 0.5 + 0.5 * sqrt(max(asin(clamp(d.y, 0.0, 1.0)), 0.0) * 0.63661977)))).rgb * ${HAZE_DIM.toFixed(3)};
}

// cloud cubes stacked in a cell (0 = clear sky), and whether it is clear by the far backdrop
float cloudLayers(ivec2 c, float thr) {
  float n = texelFetch(tCloud, c & 511, 0).r;
  return clamp(floor((n - thr) * uCloudMap.y), 0.0, uCloudGeo.z);
}

// voxel clouds: a heightfield of cubes with flat bases (like real cumulus), walked cell by cell.
// Seen from the street only their bases and sides show. Returns colour and coverage, and the hit distance.
vec4 voxelClouds(vec3 ro, vec3 rd, vec3 sky, float tFar, out float tHit) {
  tHit = 1e9;
  if (rd.y < 0.025 || uCloudGeo.y <= 0.0) return vec4(0.0);
  float B = uCloudGeo.x, S = uCloudGeo.y, K = uCloudGeo.z;
  float t0 = (B - ro.y) / rd.y, t1 = (B + K * S - ro.y) / rd.y;
  float tEnd = min(t1, min(tFar, 3.0 / uCloudGeo.w));
  if (t0 > tEnd) return vec4(0.0);
  // the far backdrop's sightline is kept clear past the town: the mountains stay in view on a fine day
  float thr = uCloudMap.x;
  if (uCloudMap.z != 0.0) thr += 0.7 * smoothstep(0.8, 0.93, dot(normalize(rd.xz), uCloudMap.zw)) * smoothstep(400.0, 1400.0, t0);
  vec2 off = uTime * ${CLOUD_WIND};
  vec2 p = (ro.xz + rd.xz * t0 + off) / S;
  ivec2 cell = ivec2(floor(p));
  vec2 dir = rd.xz;
  vec2 stp = vec2(dir.x >= 0.0 ? 1.0 : -1.0, dir.y >= 0.0 ? 1.0 : -1.0);
  vec2 dt = S / max(abs(dir), vec2(1e-6));
  vec2 tm = t0 + (vec2(cell) + max(stp, 0.0) - p) * S / (abs(dir) + 1e-9) * stp;
  float tIn = t0;
  int axis = -1;
  float k = 0.0;
  for (int i = 0; i < 64; i++) {
    if (i >= uCloudSteps) break;
    k = cloudLayers(cell, thr);
    if (k > 0.0 && ro.y + rd.y * tIn < B + k * S) break;
    k = 0.0;
    if (tm.x < tm.y) { tIn = tm.x; tm.x += dt.x; cell.x += int(stp.x); axis = 0; }
    else { tIn = tm.y; tm.y += dt.y; cell.y += int(stp.y); axis = 1; }
    if (tIn > tEnd) break;
  }
  if (k <= 0.0) return vec4(0.0);
  tHit = tIn;
  vec3 hp = ro + rd * tIn;
  vec3 n = axis < 0 ? vec3(0.0, -1.0, 0.0) : axis == 0 ? vec3(-stp.x, 0.0, 0.0) : vec3(0.0, 0.0, -stp.y);
  float thick = k / K;
  float rnd = hash12(vec2(cell) * 0.731);
  // light: the sun and moon on the sides, through the cloud on the bases; the dome and the street below
  vec3 L = uSkySun, M = uSkyMoon;
  vec3 c;
  if (axis < 0) {
    // bases darken with the depth of cloud above them; at sunset the low sun lights them from beneath
    float under = smoothstep(-0.09, 0.02, L.y) * smoothstep(0.32, 0.04, L.y);
    c = uSunHigh * (0.42 * exp(-thick * 2.2) * smoothstep(-0.05, 0.1, L.y) + under * 1.1)
      + uMoonHigh * 0.35 * exp(-thick * 2.0) + uSkyAmb * mix(0.62, 0.36, thick) + uSkyGlow * 2.6;
    // the cube grid shows faintly on the base, a slightly darker seam between cells
    vec2 q = fract((hp.xz + off) / S);
    vec2 e = min(q, 1.0 - q);
    c *= 0.93 + 0.07 * smoothstep(0.0, 0.06, min(e.x, e.y)) + (rnd - 0.5) * 0.06;
  } else {
    float ws = (dot(n, L) + 0.35) / 1.35, wm = (dot(n, M) + 0.35) / 1.35;
    c = uSunHigh * max(ws, 0.0) * 1.05 + uMoonHigh * max(wm, 0.0) * 0.8 + uSkyAmb * 0.8 + uSkyGlow * 1.2;
    // a bright rim on each layer's top edge, as on the voxels in town
    float ly = fract((hp.y - B) / S);
    c *= 0.94 + 0.12 * smoothstep(0.82, 0.97, ly) + (rnd - 0.5) * 0.05;
  }
  // silver lining toward the sun
  c += uSunHigh * pow(max(dot(rd, L), 0.0), 10.0) * 0.55 * (1.0 - thick * 0.6);
  c *= srgb2lin(vec3(0.97, 0.97, 1.0));
  // the air between you and the cloud
  float haze = 1.0 - exp(-tIn * uCloudGeo.w);
  c = mix(c, sky, haze);
  float a = 1.0 - smoothstep(2.0, 3.0, tIn * uCloudGeo.w);
  return vec4(c, a);
}

// far voxel mountains baked into a strip of sky (see fuji.ts): face, material, shade and distance per texel
vec4 farBackdrop(vec3 rd, vec3 sky, out float tHit) {
  tHit = 1e9;
  if (uFarRect.y <= 0.0) return vec4(0.0);
  float da = atan(rd.x, rd.z) - uFarRect.x;
  da -= 6.2831853 * floor(da / 6.2831853 + 0.5);
  vec2 uv = vec2(da * uFarRect.y + 0.5, (asin(clamp(rd.y, -1.0, 1.0)) - uFarRect.z) * uFarRect.w);
  if (uv.x <= 0.0 || uv.x >= 1.0 || uv.y <= 0.0 || uv.y >= 1.0) return vec4(0.0);
  vec4 g = texture(tFar, uv);
  if (g.a < 0.5) return vec4(0.0);
  float code = floor(g.r * 255.0 + 0.5);
  float face = mod(code, 4.0), mat = floor(code / 4.0);
  vec3 fw = vec3(uFarAxes.x, 0.0, uFarAxes.y), sd = vec3(uFarAxes.z, 0.0, uFarAxes.w);
  vec3 n = face < 0.5 ? -fw : face < 1.5 ? -sd : face < 2.5 ? sd : vec3(0.0, 1.0, 0.0);
  vec3 alb = mat < 0.5 ? vec3(0.035, 0.06, 0.04)    // forest
    : mat < 1.5 ? vec3(0.085, 0.06, 0.058)          // volcanic scoria
    : mat < 2.5 ? vec3(0.78, 0.8, 0.86)             // snow
    : vec3(0.07, 0.075, 0.07);                      // the plain and its towns
  float shade = g.g;
  float dl = max(dot(n, uSkySun), 0.0), dm = max(dot(n, uSkyMoon), 0.0);
  vec3 c = alb * (uSunHigh * dl * 1.1 + uMoonHigh * dm + uSkyAmb * (n.y > 0.5 ? 1.0 : 0.62)) * (0.72 + 0.5 * shade);
  tHit = g.b * 64000.0;
  float tr = exp(-tHit * uFarHaze);
  return vec4(c * tr + sky * (1.0 - tr), 1.0);
}

// stars on a cube-mapped grid: tiny square points that wheel round the pole and twinkle low down
vec3 starField(vec3 d, float pa, float vis) {
  if (vis <= 0.0 || d.y < -0.02) return vec3(0.0);
  vec3 s = uStarRot * d;
  vec3 a = abs(s);
  vec2 fc; float face;
  if (a.x >= a.y && a.x >= a.z) { fc = s.yz / a.x; face = s.x > 0.0 ? 0.0 : 1.0; }
  else if (a.y >= a.z) { fc = s.xz / a.y; face = s.y > 0.0 ? 2.0 : 3.0; }
  else { fc = s.xy / a.z; face = s.z > 0.0 ? 4.0 : 5.0; }
  const float N = 420.0;
  vec2 g = (fc * 0.5 + 0.5) * N;
  vec2 cell = floor(g);
  vec2 key = cell + face * 613.7;
  float h = hash12(key);
  float dens = uStars.x;
  vec3 col = vec3(0.0);
  float mw = 0.0;
  if (uStars.y > 0.0) {
    // the Milky Way: a ragged band of faint light in big blocks, and many more stars along it
    float b = dot(s, normalize(vec3(0.42, 0.55, 0.72)));
    mw = exp(-b * b / 0.022) * (0.45 + 0.55 * vnoise(floor(g / 5.0) * 0.21 + face * 9.0)) * uStars.y;
    float blk = hash12(floor(g / 3.0) + face * 51.0);
    col += vec3(0.55, 0.6, 0.78) * 0.0045 * mw * (0.7 + 0.6 * blk);
    dens *= 1.0 + 5.0 * mw;
  }
  if (h > 1.0 - dens) {
    float r = fract(h * 91.7);
    vec2 pos = cell + 0.5 + (vec2(hash12(key + 3.7), hash12(key + 9.1)) - 0.5) * 0.6;
    float px = pa * N * 0.6366;
    vec2 q = abs(g - pos);
    float m = 1.0 - smoothstep(px * 0.55, px * 1.25, max(q.x, q.y));
    float bright = 0.05 + 2.2 * pow(r, 9.0);
    vec3 tint = mix(vec3(1.0, 0.78, 0.55), vec3(0.75, 0.85, 1.0), fract(h * 13.3));
    float tw = 1.0 + 0.45 * sin(uTime * (2.0 + 5.0 * fract(h * 7.1)) + h * 80.0) * smoothstep(0.5, 0.05, d.y);
    col += tint * bright * tw * m;
  }
  return col * vis * smoothstep(-0.02, 0.08, d.y);
}

// a blocky disc of the given angular radius about dir: 1 inside, and the disc-local coordinate
float blockDisc(vec3 d, vec3 dir, float rad, float blocks, out vec2 q) {
  vec3 u = normalize(cross(dir, abs(dir.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0)));
  vec3 v = cross(u, dir);
  q = vec2(dot(d, u), dot(d, v)) / rad;
  vec2 qq = (floor(q * blocks) + 0.5) / blocks;
  q = qq;
  return dot(d, dir) > 0.0 && dot(qq, qq) < 1.0 ? 1.0 : 0.0;
}

// the eye-level sky: ro eye, rd view ray, pa the angle one pixel spans
vec3 skyView(vec3 ro, vec3 rd, float pa) {
  vec3 sky = skyLut(rd);
  vec3 col = sky;
  float lum = dot(sky, vec3(0.2126, 0.7152, 0.0722));
  col += starField(rd, pa, uStars.z * (1.0 - smoothstep(0.004, 0.03, lum)));
  vec2 q;
  // moon: grey blocks with darker seas, a soft glow round it
  float muM = dot(rd, uSkyMoon);
  col += uMoonDisc * 0.03 * exp(-max(0.0, acos(clamp(muM, -1.0, 1.0)) - 0.015) * 22.0);
  if (muM > 0.999 && blockDisc(rd, uSkyMoon, 0.016, 7.0, q) > 0.5) {
    float sea = smoothstep(0.52, 0.6, vnoise(q * 2.3 + 4.1) * 0.7 + vnoise(q * 5.1 + 1.3) * 0.3);
    float lim = 0.78 + 0.22 * sqrt(max(0.0, 1.0 - dot(q, q)));
    col += uMoonDisc * mix(1.0, 0.6, sea) * lim * (0.94 + 0.12 * hash12(floor(q * 7.0) + 2.0));
  }
  // sun: a blocky disc in a bright aureole
  float muS = dot(rd, uSkySun);
  col += uSunDisc * (exp(-(1.0 - muS) * 9000.0) * 0.06 + exp(-(1.0 - muS) * 700.0) * 0.012);
  if (muS > 0.999 && blockDisc(rd, uSkySun, 0.0115, 5.0, q) > 0.5) col += uSunDisc * (0.75 + 0.25 * sqrt(max(0.0, 1.0 - dot(q, q))));
  float tFar, tCloud;
  vec4 far = farBackdrop(rd, sky, tFar);
  col = mix(col, far.rgb, far.a);
  vec4 cl = voxelClouds(ro, rd, sky, tFar, tCloud);
  col = mix(col, cl.rgb, cl.a);
  return col;
}
`;

// ---- CPU copy of the atmosphere ----
const sph = (ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, r: number): [number, number] => {
  const b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - r * r, h = b * b - c;
  if (h < 0) return [-1, -1];
  const s = Math.sqrt(h);
  return [-b - s, -b + s];
};
function lightDepth(px: number, py: number, pz: number, l: THREE.Vector3, out: number[]): boolean {
  if (sph(px, py, pz, l.x, l.y, l.z, R0)[0] > 0) return false;
  const t = sph(px, py, pz, l.x, l.y, l.z, RA)[1], ds = t / LIGHT_STEPS;
  let r = 0, m = 0, o = 0;
  for (let i = 0; i < LIGHT_STEPS; i++) {
    const s = ds * (i + 0.5);
    const h = Math.hypot(px + l.x * s, py + l.y * s, pz + l.z * s) - R0;
    r += Math.exp(-h / HR); m += Math.exp(-h / HM); o += Math.max(0, 1 - Math.abs(h - 25e3) / 15e3);
  }
  out[0] = r * ds; out[1] = m * ds; out[2] = o * ds;
  return true;
}
const tmpOD = [0, 0, 0];
/** Light of the sun (or moon) of the given intensity reaching height h (m): its colour through the air. */
function transmitted(l: THREE.Vector3, h: number, inten: number, mie: number, out: THREE.Color): THREE.Color {
  if (!lightDepth(0, R0 + h, 0, l, tmpOD)) return out.setRGB(0, 0, 0);
  const bm = BM * mie * 1.11;
  out.setRGB(
    inten * Math.exp(-(BR[0] * tmpOD[0] + bm * tmpOD[1] + BO[0] * tmpOD[2])),
    inten * Math.exp(-(BR[1] * tmpOD[0] + bm * tmpOD[1] + BO[1] * tmpOD[2])),
    inten * Math.exp(-(BR[2] * tmpOD[0] + bm * tmpOD[1] + BO[2] * tmpOD[2])),
  );
  return out;
}

/** The table's radiance in one direction (the same integral as LUT_FRAG, ground and glow included). */
function radiance(d: THREE.Vector3, sun: THREE.Vector3, moon: THREE.Vector3, sunI: number, moonI: number, mie: number, glow: number[], out: THREE.Color): THREE.Color {
  const oy = R0 + EYE;
  const ga = sph(0, oy, 0, d.x, d.y, d.z, RA), gg = sph(0, oy, 0, d.x, d.y, d.z, R0);
  const ground = gg[0] > 0;
  const tMax = ground ? gg[0] : ga[1], ds = tMax / VIEW_STEPS;
  const bm = BM * mie;
  const muS = d.dot(sun), muM = d.dot(moon);
  const pr = 0.0596831, prS = pr * (1 + muS * muS), prM = pr * (1 + muM * muM);
  const k = 0.1193662 * (1 - G * G) / (2 + G * G);
  const pmS = k * (1 + muS * muS) / Math.pow(1 + G * G - 2 * G * muS, 1.5);
  const pmM = k * (1 + muM * muM) / Math.pow(1 + G * G - 2 * G * muM, 1.5);
  let odR = 0, odM = 0, odO = 0;
  const sS = [0, 0, 0], sM = [0, 0, 0], ls = [0, 0, 0], lm = [0, 0, 0];
  for (let i = 0; i < VIEW_STEPS; i++) {
    const t = ds * (i + 0.5);
    const px = d.x * t, py = oy + d.y * t, pz = d.z * t;
    const h = Math.hypot(px, py, pz) - R0;
    const dr = Math.exp(-h / HR) * ds, dm = Math.exp(-h / HM) * ds, dO = Math.max(0, 1 - Math.abs(h - 25e3) / 15e3) * ds;
    odR += dr * 0.5; odM += dm * 0.5; odO += dO * 0.5;
    const okS = lightDepth(px, py, pz, sun, ls), okM = lightDepth(px, py, pz, moon, lm);
    for (let c = 0; c < 3; c++) {
      const tv = BR[c] * odR + bm * 1.11 * odM + BO[c] * odO;
      const sc = BR[c] * dr;
      if (okS) sS[c] += Math.exp(-(tv + BR[c] * ls[0] + bm * 1.11 * ls[1] + BO[c] * ls[2])) * (sc * prS + bm * dm * pmS);
      if (okM) sM[c] += Math.exp(-(tv + BR[c] * lm[0] + bm * 1.11 * lm[1] + BO[c] * lm[2])) * (sc * prM + bm * dm * pmM);
    }
    odR += dr * 0.5; odM += dm * 0.5; odO += dO * 0.5;
  }
  const up = Math.max(0, Math.asin(Math.max(-1, Math.min(1, d.y))));
  const gl = Math.exp(-up * 9) * 0.85 + 0.15 * Math.exp(-up * 2);
  out.setRGB(
    sS[0] * sunI + sM[0] * moonI + NIGHT_BASE[0] + glow[0] * gl,
    sS[1] * sunI + sM[1] * moonI + NIGHT_BASE[1] + glow[1] * gl,
    sS[2] * sunI + sM[2] * moonI + NIGHT_BASE[2] + glow[2] * gl,
  );
  return out;
}

/** The value-noise cloud map: 512 x 512 cells of 0..255, broad clusters with ragged edges. */
function cloudMap(): { tex: THREE.DataTexture; sorted: Uint8Array } {
  const N = 512, data = new Uint8Array(N * N);
  let seed = 90127;
  const lat = (n: number) => {
    const a = new Float32Array(n * n);
    for (let i = 0; i < a.length; i++) a[i] = (seed = (seed * 16807) % 2147483647) / 2147483647;
    return a;
  };
  const octs = [[16, 0.55], [32, 0.27], [64, 0.13], [128, 0.05]].map(([n, w]) => ({ n, w, a: lat(n) }));
  for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
    let v = 0;
    for (const o of octs) {
      const fx = (x / N) * o.n, fz = (z / N) * o.n;
      const ix = Math.floor(fx), iz = Math.floor(fz), tx = fx - ix, tz = fz - iz;
      const ux = tx * tx * (3 - 2 * tx), uz = tz * tz * (3 - 2 * tz);
      const g = (i: number, j: number) => o.a[((j % o.n) * o.n) + (i % o.n)];
      v += o.w * ((g(ix, iz) * (1 - ux) + g(ix + 1, iz) * ux) * (1 - uz) + (g(ix, iz + 1) * (1 - ux) + g(ix + 1, iz + 1) * ux) * uz);
    }
    data[z * N + x] = Math.max(0, Math.min(255, Math.round(((v - 0.5) * 1.9 + 0.5) * 255)));
  }
  const tex = new THREE.DataTexture(data, N, N, THREE.RedFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.magFilter = tex.minFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  const sorted = data.slice().sort();
  return { tex, sorted };
}

const lum = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

// ---- the sky's clock: where the sun and moon stand ----
/** The town's light comes from a fixed direction (the bake and the shadows rely on it); the sun and moon rise
 * and set on that bearing so the sky never contradicts the shading. Latitude 35 degrees, spring sun. */
const LAT = 35 * Math.PI / 180;
const LIGHT_AZ = Math.atan2(0.62, -0.4);
function body(hour: number, noon: number, decl: number, az: number, out: THREE.Vector3): THREE.Vector3 {
  const H = (hour - noon) * Math.PI / 12;
  const se = Math.sin(LAT) * Math.sin(decl) + Math.cos(LAT) * Math.cos(decl) * Math.cos(H);
  const e = Math.asin(se);
  return out.set(Math.sin(az) * Math.cos(e), se, Math.cos(az) * Math.cos(e));
}

/** Uniforms the sky adds to the composite; shared ones (clouds) go into every voxel material too. */
export function skyUniforms() {
  return {
    tSkyLut: { value: null as THREE.Texture | null },
    uSkySun: { value: new THREE.Vector3(0, 1, 0) }, uSkyMoon: { value: new THREE.Vector3(0, -1, 0) },
    uSunDisc: { value: new THREE.Color() }, uMoonDisc: { value: new THREE.Color() },
    uSunHigh: { value: new THREE.Color() }, uMoonHigh: { value: new THREE.Color() },
    uSkyAmb: { value: new THREE.Color() }, uSkyGlow: { value: new THREE.Color() },
    uStarRot: { value: new THREE.Matrix3() }, uStars: { value: new THREE.Vector4() },
    tFar: { value: null as THREE.Texture | null },
    uFarRect: { value: new THREE.Vector4(0, 0, 0, 1) }, uFarAxes: { value: new THREE.Vector4(1, 0, 0, 1) },
    uFarHaze: { value: LOOK.farHaze },
    uCloudSteps: { value: 56 },
  };
}
export function cloudUniforms() {
  return {
    tCloud: { value: null as THREE.Texture | null },
    uCloudGeo: { value: new THREE.Vector4(LOOK.cloud.base, LOOK.cloud.cell, LOOK.cloud.layers, 1 / LOOK.cloud.fade) },
    uCloudMap: { value: new THREE.Vector4(0.6, 20, 0, 0) },
  };
}

type SkyU = ReturnType<typeof skyUniforms>;
type CloudU = ReturnType<typeof cloudUniforms>;
interface Shared { uFogColor: THREE.IUniform<THREE.Color>; uNight: THREE.IUniform<number> }

export class Sky {
  hour = 12;
  private rt = new THREE.WebGLRenderTarget(128, 64, {
    type: THREE.HalfFloatType, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false,
  });
  readonly lutMat: THREE.ShaderMaterial;
  private sun = new THREE.Vector3();
  private moon = new THREE.Vector3();
  private lastHour = -99;
  private lastAz = 1e9;
  private lastNight = -1;
  private cover: Uint8Array;
  private glow = [0, 0, 0];
  private c = new THREE.Color();
  private d = new THREE.Vector3();
  private dirty = true;
  private noonLum: number | undefined;
  readonly backdrop: Backdrop | null;
  /** Horizon colours round the compass (16 bearings), refreshed with the table. */
  private ring: THREE.Color[] = Array.from({ length: 16 }, () => new THREE.Color());

  constructor(private shared: Shared, private sky: SkyU, private clouds: CloudU, private skyTop: THREE.Color, private skyHorizon: THREE.Color) {
    this.rt.texture.wrapS = THREE.RepeatWrapping;
    this.lutMat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: FS_VERT, fragmentShader: LUT_FRAG, depthTest: false, depthWrite: false,
      uniforms: {
        uSun: { value: this.sun }, uMoon: { value: this.moon }, uGlow: { value: new THREE.Vector3() }, uMie: { value: LOOK.mie },
        uSunI: { value: SUN_I }, uMoonI: { value: MOON_I },
      },
    });
    sky.tSkyLut.value = this.rt.texture;
    const cm = cloudMap();
    clouds.tCloud.value = cm.tex;
    this.cover = cm.sorted;
    this.backdrop = LOOK.backdrop === 'fuji' ? bakeFuji() : null;
    if (this.backdrop) {
      const b = this.backdrop;
      sky.tFar.value = b.tex;
      sky.uFarRect.value.set(b.az, 1 / b.azSpan, b.el0, 1 / b.elSpan);
      sky.uFarAxes.value.set(b.fwd[0], b.fwd[1], b.side[0], b.side[1]);
    }
  }

  /** Cloud cover for the hour: fair-weather cumulus build through the day, thin out at night. */
  private coverAt(h: number, t: number): number {
    const day = Math.exp(-((h - 14.5) ** 2) / 30);
    return Math.min(0.6, Math.max(0.05, LOOK.cloud.cover * (0.7 + 0.45 * day) + 0.06 * Math.sin(t * 0.0021)));
  }

  /**
   * Move the sun and moon to the clock, redraw the table when they have moved, and set the haze colour to the
   * sky's horizon in the direction the camera looks.
   */
  update(time: number, camFwd: THREE.Vector3, render: (m: THREE.ShaderMaterial, t: THREE.WebGLRenderTarget) => void): void {
    const s = this.sky, night = this.shared.uNight.value;
    if (Math.abs(this.hour - this.lastHour) > 0.004 || Math.abs(night - this.lastNight) > 0.01 || this.dirty) {
      this.dirty = false;
      this.lastHour = this.hour;
      this.lastNight = night;
      body(this.hour, 12.25, 13.6 * Math.PI / 180, LIGHT_AZ, this.sun);
      body(this.hour, 0.6, 4 * Math.PI / 180, LIGHT_AZ + 0.55, this.moon);
      // the city's glow is its lights: it comes on with the lamps
      const g = LOOK.glow;
      for (let i = 0; i < 3; i++) this.glow[i] = g[i] * night;
      (this.lutMat.uniforms.uGlow.value as THREE.Vector3).set(this.glow[0], this.glow[1], this.glow[2]);
      // the eye adapts: as the sun goes down the sky dims far less than it really does, until night takes over
      const noon = this.noonLum ??= lum(radiance(this.d.set(0, 1, 0), body(12.25, 12.25, 13.6 * Math.PI / 180, LIGHT_AZ, new THREE.Vector3()), this.moon, SUN_I, 0, LOOK.mie, [0, 0, 0], this.c));
      const now = lum(radiance(this.d.set(0, 1, 0), this.sun, this.moon, SUN_I, 0, LOOK.mie, [0, 0, 0], this.c));
      const sunI = SUN_I * Math.min(4, Math.max(1, Math.pow(noon / Math.max(now, 1e-9), 0.5)));
      this.lutMat.uniforms.uSunI.value = sunI;
      render(this.lutMat, this.rt);
      s.uSkySun.value.copy(this.sun);
      s.uSkyMoon.value.copy(this.moon);
      transmitted(this.sun, EYE, SUN_I * 3.2, LOOK.mie, s.uSunDisc.value);
      transmitted(this.moon, EYE, 0.85, LOOK.mie, s.uMoonDisc.value);
      // the light up at the cloud base and on the far mountains (still sunlit a little after sunset in town)
      transmitted(this.sun, LOOK.cloud.base + 300, SUN_I * 0.15, LOOK.mie, s.uSunHigh.value);
      transmitted(this.moon, LOOK.cloud.base + 300, 0.018, LOOK.mie, s.uMoonHigh.value);
      radiance(this.d.set(0, 1, 0), this.sun, this.moon, sunI, MOON_I, LOOK.mie, this.glow, this.skyTop);
      const amb = s.uSkyAmb.value.copy(this.skyTop).multiplyScalar(1.1);
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        const ce = Math.cos(HAZE_EL);
        radiance(this.d.set(Math.sin(a) * ce, Math.sin(HAZE_EL), Math.cos(a) * ce), this.sun, this.moon, sunI, MOON_I, LOOK.mie, this.glow, this.ring[i]);
      }
      this.skyHorizon.setRGB(0, 0, 0);
      for (const r of this.ring) this.skyHorizon.r += r.r / 16, this.skyHorizon.g += r.g / 16, this.skyHorizon.b += r.b / 16;
      amb.add(this.c.copy(this.skyHorizon).multiplyScalar(0.9));
      s.uSkyGlow.value.setRGB(this.glow[0], this.glow[1], this.glow[2]);
      // stars: visible as the sky darkens; they turn about the pole, a little more each hour
      s.uStars.value.set(LOOK.stars, LOOK.milkyWay, 1, 0);
      const pole = new THREE.Vector3(0, Math.sin(LAT), -Math.cos(LAT));
      s.uStarRot.value.setFromMatrix4(new THREE.Matrix4().makeRotationAxis(pole, -this.hour * Math.PI / 12 + 1.3));
      this.lastAz = 1e9;
    }
    // haze: the horizon toward where the camera looks, read off the ring
    let az = Math.atan2(camFwd.x, camFwd.z);
    if (camFwd.x * camFwd.x + camFwd.z * camFwd.z < 1e-6) az = 0;
    if (Math.abs(az - this.lastAz) > 0.002) {
      this.lastAz = az;
      const u = ((az / (Math.PI * 2)) * 16 + 16) % 16, i0 = Math.floor(u), t = u - i0;
      this.shared.uFogColor.value.copy(this.ring[i0]).lerp(this.ring[(i0 + 1) % 16], t).multiplyScalar(HAZE_DIM);
    }
    // cloud cover drifts with the hours
    const thr = this.cover[Math.min(this.cover.length - 1, Math.floor((1 - this.coverAt(this.hour, time)) * this.cover.length))] / 255;
    // gain: from the edge of a cloud to its thickest middle is about a third of the noise's range
    const gain = LOOK.cloud.layers / 0.26;
    const fw = this.backdrop?.fwd ?? [0, 0];
    this.clouds.uCloudMap.value.set(thr - 1 / gain, gain, fw[0], fw[1]);
  }

  /** Force a redraw next frame (city glow or quality changed). */
  invalidate(): void { this.dirty = true; }
}
