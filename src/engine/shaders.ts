// GLSL 3.00 ES shaders (three.js ShaderMaterial with glslVersion = GLSL3).
import { SWAY_ROW } from '../world/sway';

/** People passed to the sway shader so plants and cloth lean away from them. */
export const NUDGES = 8;

export const COMMON = /* glsl */ `
vec3 srgb2lin(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
// first-person haze starts this far from the eye (m)
const float FOG_START = 18.0;
// depth buffer value -> distance along the view axis in metres (orthographic or perspective)
float linZ(float d, vec3 clip) {
  return clip.z > 0.5 ? clip.x * clip.y / (clip.y - d * (clip.y - clip.x)) : clip.x + d * (clip.y - clip.x);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
`;

/**
 * Water wave spectrum, baked into the composite shader as constants: 8 long waves whose directions scatter within
 * about 70 degrees of the wind and whose wavelengths step down by an uneven ratio, so no two are ever in step.
 * Each carries roughly the same slope, like a wind sea; the short chop is noise (see waterNormal),
 * since short sines are what beat into checkers. Sorted long to short so the shader can stop early.
 */
const WAVE_TABLE = (() => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const n = 8, wind = 0.35, rows: string[] = [], phs: string[] = [];
  let k = 1.25;
  for (let i = 0; i < n; i++) {
    // long swell keeps close to the wind; the short chop comes from every side
    const a = wind + (rnd() - 0.5) * (1.6 + 1.6 * i / n) + (i % 2 ? 0.3 : -0.3);
    const slope = 0.036 * (0.75 + 0.5 * rnd()) * (i > 5 ? 0.85 : 1);
    rows.push(`vec4(${Math.cos(a).toFixed(4)}, ${Math.sin(a).toFixed(4)}, ${k.toFixed(4)}, ${slope.toFixed(4)})`);
    phs.push((rnd() * Math.PI * 2).toFixed(4));
    k *= 1.17 + 0.12 * rnd();
  }
  return `const int WAVES = ${n};\nconst vec4 WAVE[${n}] = vec4[${n}](${rows.join(', ')});\nconst float WAVE_PH[${n}] = float[${n}](${phs.join(', ')});`;
})();

const VOXEL_SCALES = `const float SCALES[10] = float[10](0.25, 0.125, 0.0625, 0.075, 0.025, 0.05, 0.1, 0.5, 1.0, 0.0375);`;

/**
 * Rigid sway (see world/sway.ts). Each body rotates as a whole about its pivot: a breeze that leans it
 * downwind and rocks it at its own rate and phase, gusts that roll across town, and a push away from anyone
 * walking through it. Bodies can hang from a parent (a lantern on a swinging wire).
 */
export const SWAY_FN = /* glsl */ `
in float aSway;
uniform highp sampler2D tSway; // 3 texels per body, ${SWAY_ROW} bodies per row
uniform vec4 uWind;            // direction x, z; strength; unused
uniform vec4 uNudge[${NUDGES}];          // people nearby: feet x, y, z and body radius (0 = empty slot); they stand 5.2 radii tall; height is 5.2 radii
// Rodrigues rotation of v about unit axis k
vec3 swayRot(vec3 v, vec3 k, float c, float s) { return v * c + cross(k, v) * s + k * dot(k, v) * (1.0 - c); }
void swayBody(int id, inout vec3 p, inout vec3 n, out int parent) {
  ivec2 at = ivec2((id % ${SWAY_ROW}) * 3, id / ${SWAY_ROW});
  vec4 A = texelFetch(tSway, at, 0);                // pivot, parent id
  vec4 B = texelFetch(tSway, at + ivec2(1, 0), 0);  // hinge axis (0 = free), amplitude
  vec4 C = texelFetch(tSway, at + ivec2(2, 0), 0);  // rate, phase, reach (negative = hangs), push
  parent = int(A.w + 0.5);
  vec3 piv = A.xyz;
  float up = C.z < 0.0 ? -1.0 : 1.0;
  vec2 wd = uWind.xy, side = vec2(-wd.y, wd.x);
  // gusts: broad bands rolling downwind, so neighbours stir together and a moment later the next street over
  float gust = 0.5 + 0.5 * sin(dot(piv.xz, wd) * 0.23 - uTime * 0.85) * sin(dot(piv.xz, side) * 0.11 + uTime * 0.29 + 1.3);
  float w = uWind.z * (0.45 + 0.75 * gust * gust);
  float t = uTime * C.x + C.y;
  float rock = sin(t) + 0.3 * sin(t * 2.31 + 1.1);
  float roll = sin(t * 0.77 + C.y * 1.7);
  // lean vector (xz, radians): steady lean downwind plus a lazy swing along and across it
  vec2 T = B.w * (wd * w * (0.5 + 0.5 * rock) + side * (0.12 + w) * 0.35 * roll);
  if (C.w > 0.0) {
    float reach = abs(C.z);
    float y0 = up > 0.0 ? piv.y : piv.y - reach, y1 = up > 0.0 ? piv.y + reach : piv.y;
    for (int i = 0; i < ${NUDGES}; i++) {
      vec4 a = uNudge[i];
      if (a.w <= 0.0) continue;
      vec2 d = piv.xz - a.xz;
      float dl = length(d);
      float near = 1.0 - smoothstep(a.w * 0.4, a.w + 0.32, dl);
      float over = clamp((min(y1, a.y + a.w * 5.2) - max(y0, a.y)) / 0.12, 0.0, 1.0);
      // fades out right at the pivot so walking under a curtain swings it through instead of flipping it
      T += d / max(dl, a.w * 0.7) * C.w * near * over;
    }
  }
  float ang;
  vec3 k;
  if (dot(B.xyz, B.xyz) > 0.5) {
    // hinge: only the part of the lean across the axis turns it, plus a small swing of its own
    k = B.xyz;
    vec3 across = cross(vec3(0.0, 1.0, 0.0), k);
    ang = -up * dot(T, across.xz) + B.w * 0.35 * (0.25 + w) * rock;
  } else {
    // free: tilt the body's up (or down, when hanging) towards the lean
    ang = length(T);
    if (ang < 1e-5) return;
    vec2 dir = T / ang * up;
    k = vec3(dir.y, 0.0, -dir.x);
  }
  float c = cos(ang), s = sin(ang);
  p = piv + swayRot(p - piv, k, c, s);
  n = swayRot(n, k, c, s);
}
vec3 swayVertex(vec3 p, inout vec3 n) {
  int id = int(aSway + 0.5);
  for (int i = 0; i < 2; i++) {
    if (id <= 0) break;
    int parent;
    swayBody(id - 1, p, n, parent);
    id = parent;
  }
  return p;
}
`;

export const VOXEL_VERT = /* glsl */ `
in vec4 aPack;
in vec4 aColor;
in vec4 aLight;
in vec4 aQuad;
uniform float uTime;
#ifdef CHARACTER
#ifdef POSE_TEXTURE
#include <batching_pars_vertex>
// one body per batch instance: its texels hold 13 part rotations (+ shrink), 13 pivots, root offset + flash, light, lamp
// (layout in game/charbatch.ts)
uniform highp sampler2D tPose;
flat out vec4 vCharLight; // sun, sky, highlight, flash
flat out vec3 vCharLamp;
#else
uniform vec3 uPivot[13];
uniform vec3 uRot[13]; // pitch, yaw, roll
uniform vec3 uOffset;
#endif
// skeleton: torso <- head, arms <- forearms <- phone; hips <- thighs <- shins (see PART in characters.ts)
const int PARENT[13] = int[13](-1, 0, 0, 0, 7, 7, -1, -1, 4, 5, 2, 3, 11);
#endif
#ifdef SWAY
${SWAY_FN}
#endif
#ifdef FAR
// the villages on the slopes past the map (engine/fartown.ts): each vertex knows its house's middle and its tile
in vec3 aHome;
uniform vec4 uFarRect; // the map (x0, z0, x1, z1), where the far coast begins
uniform vec3 uCamFwd;
#ifdef FARBASE
uniform int uFine[4]; // tiles drawn by a finer mesh of their own, one bit each: the base mesh leaves them out
#endif
// the far coast's squat (engine/farcoast.ts SQUASH): in the iso view the slopes between the camera and the map
// sink out of the way, and a house on them isn't drawn at all
float farSquash(vec2 xz) {
  if (projectionMatrix[3][3] != 1.0) return 1.0;
  vec2 dir = xz - (uFarRect.xy + uFarRect.zw) * 0.5;
  float l = length(dir);
  if (l < 1.0) return 1.0;
  float camSide = -dot(dir / l, normalize(uCamFwd.xz));
  vec2 o = max(uFarRect.xy - xz, xz - uFarRect.zw);
  return mix(1.0, 0.03, smoothstep(-0.3, 0.25, camSide) * smoothstep(0.0, 24.0, max(0.0, max(o.x, o.y))));
}
#endif
${VOXEL_SCALES}
// What the fragment shader needs is packed tight: a voxel face is a few pixels across, so the city is
// millions of vertices a frame and every value passed along costs. Per face: x = aPack.x (face | scale << 3 |
// seam << 7) | aPack.z (edges | vary << 4) << 8, y = colour rgba8 (unpacked in VOXEL_FRAG); in an ATLAS mesh,
// y is the quad's block in the atlas instead (u | v << 16), which holds its light and colours.
flat out uvec2 vFlat;
flat out vec3 vNormal;
out vec3 vWorld;
#ifdef SWAY
out vec3 vRest; // world position before the sway: shadows are looked up where the cached shadow map drew it
#else
out vec3 vCell; // (swaying meshes are placed in world space, where vRest gives the cell)
#endif
out vec4 vQuad;
#ifndef ATLAS
out vec4 vLight;
out vec2 vAoSky;
#endif

vec3 faceNormal(float f) {
  if (f < 0.5) return vec3(1, 0, 0);
  if (f < 1.5) return vec3(-1, 0, 0);
  if (f < 2.5) return vec3(0, 1, 0);
  if (f < 3.5) return vec3(0, -1, 0);
  if (f < 4.5) return vec3(0, 0, 1);
  return vec3(0, 0, -1);
}
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1, 0, 0, 0, c, s, 0, -s, c); }
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0, -s, 0, 1, 0, s, 0, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0, -s, c, 0, 0, 0, 1); }

void main() {
  // a face kept between two buildings (world/mesher.ts) stays buried unless the cutaway can expose it
  float seam = step(127.5, aPack.x);
#ifndef CUTAWAY
  if (seam > 0.5) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
#endif
#ifdef FAR
  float squat = farSquash(aHome.xy);
#ifdef FARBASE
  int ti = int(aHome.z + 0.5);
  bool finer = ((uFine[ti >> 5] >> (ti & 31)) & 1) != 0;
#else
  bool finer = false;
#endif
  if (squat < 0.6 || finer) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); return; }
#endif
  float pk = aPack.x - seam * 128.0;
  float face = mod(pk, 8.0);
  float sIdx = floor(pk / 8.0 + 0.01);
  vec3 n = faceNormal(face);
#ifdef ATLAS
  uvec4 a8 = uvec4(aLight * 255.0 + 0.5);
  vFlat = uvec2(uint(aPack.x + 0.5) | (uint(aPack.z + 0.5) << 8), a8.x | (a8.y << 8) | (a8.z << 16) | (a8.w << 24));
#else
  uvec4 c8 = uvec4(aColor * 255.0 + 0.5);
  vFlat = uvec2(uint(aPack.x + 0.5) | (uint(aPack.z + 0.5) << 8), c8.r | (c8.g << 8) | (c8.b << 16) | (c8.a << 24));
#endif
#ifndef SWAY
  vCell = position - n * (0.5 * SCALES[int(sIdx)]);
#endif
  vec3 p = position;
#ifdef CHARACTER
#ifdef POSE_TEXTURE
  int body = int(getIndirectIndex(gl_DrawID)) * 32, pw = textureSize(tPose, 0).x;
#define POSE(k) texelFetch(tPose, ivec2((body + (k)) % pw, (body + (k)) / pw), 0)
  vec4 off = POSE(26);
  vCharLight = vec4(POSE(27).xyz, off.w);
  vCharLamp = POSE(28).xyz;
#define ROT(k) POSE(k)
#define PIV(k) POSE(13 + (k)).xyz
#else
  vec4 off = vec4(uOffset, 0.0);
#define ROT(k) vec4(uRot[k], 0.0)
#define PIV(k) uPivot[k]
#endif
  int j = int(aPack.w + 0.5);
  for (int k = 0; k < 4; k++) {
    if (j < 0) break;
    // w shrinks a part to its pivot: a phone put away collapses to a point (nothing to draw)
    vec4 a = ROT(j);
    vec3 pv = PIV(j);
    mat3 R = rotY(a.y) * rotX(a.x) * rotZ(a.z);
    p = R * (p - pv) * (1.0 - a.w) + pv;
    n = R * n;
    j = PARENT[j];
  }
  p += off.xyz;
  vAoSky.y = 1.0;
#elif !defined(ATLAS)
  vAoSky.y = aPack.w / 255.0;
#endif
#ifdef SWAY
  vRest = (modelMatrix * vec4(p, 1.0)).xyz;
  p = swayVertex(p, n);
#endif
#ifdef USE_INSTANCING
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
#elif defined(USE_BATCHING)
  mat4 bm = getBatchingMatrix(getIndirectIndex(gl_DrawID));
  vec4 wp = modelMatrix * bm * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * mat3(bm) * n);
#else
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * n);
#endif
  vWorld = wp.xyz;
#ifdef FAR
  wp.y *= squat;
#endif
  vQuad = aQuad;
#ifndef ATLAS
  vLight = aLight;
  vAoSky.x = aPack.y / 255.0;
#endif
  vec4 vp = viewMatrix * wp;
  // Props (fine voxels) often sit flush on the coarse world, e.g. a sign over window trim, so their faces can be
  // coplanar with world faces and z-fight. Nudge fine voxels a hair towards the camera, along the view ray so the
  // image does not move: relative to distance in perspective, a fixed few millimetres in the ortho view.
  if ((sIdx > 0.5 && sIdx < 6.5) || sIdx > 8.5) { // props and people, not the coarse distance chunks
    if (projectionMatrix[2][3] < -0.5) vp.xyz *= 0.9992;
    else vp.z += 0.005;
  }
  gl_Position = projectionMatrix * vp;
}
`;

/** How the clouds drift (m/s); the sky (engine/sky.ts) and the shadows they cast share it. */
export const CLOUD_WIND = 'vec2(3.2, 1.1)';
/** Shadows the sky's voxel clouds cast on the town: the same cubes, sampled up along the light. */
const CLOUD_SHADOW = /* glsl */ `
float cloudShadow(vec3 w) {
  vec2 q = w.xz + uSunDir.xz / max(uSunDir.y, 0.2) * (uCloudGeo.x - w.y) + uTime * ${CLOUD_WIND};
  float n = texture(tCloud, q / (uCloudGeo.y * 512.0)).r;
  float th = uCloudMap.x + 1.0 / uCloudMap.y;
  return smoothstep(th - 0.02, th + 0.03, n);
}
`;

export const VOXEL_FRAG = /* glsl */ `
precision highp float;
precision highp int;
${COMMON}
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uGroundColor;
uniform vec3 uFogColor;
uniform vec3 uWindowColor;
uniform vec3 uClearGlass[2]; // min, max corner (metres) of glass drawn clear: see game/roomglass.ts
uniform vec3 uClearOut[2];   // min, max corner (metres) of anything not drawn at all: see game/roomglass.ts
uniform float uLamp;
uniform float uNight;
uniform float uEmitDay;
uniform float uTime;
uniform float uCloud;
uniform highp sampler2D tCloud; // the sky's voxel cloud map (engine/sky.ts)
uniform vec4 uCloudGeo;         // base height, cube size, layers, 1 / haze distance
uniform vec4 uCloudMap;         // threshold, gain
${CLOUD_SHADOW}
uniform vec4 uWarm[3];  // covered markets (x0, z0, x1, z1 in metres): lamplit and warm all day under their roofs
uniform vec3 uWarmTop;  // and the height each one's roof stops at
uniform sampler2D tNoise; // value-noise lattice (see latticeNoise in renderer.ts)
// value noise from one filtered fetch: smoothstep-warped coordinates make the bilinear filter do the
// cubic blend that vnoise does with four hashes
float vnoiseT(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  return texture(tNoise, (i + f * f * (3.0 - 2.0 * f) + 0.5) * (1.0 / 64.0)).r;
}
uniform vec4 uBounds; // x0, z0, x1, z1 of the playable map (fade outside)
#ifdef FAR
uniform vec4 uFarRect;
#endif
uniform vec4 uFog;    // first-person eye position and haze density (0 in the iso view)
#ifndef ICON
uniform highp sampler2DShadow tShadow;
uniform mat4 uShadowMat;
uniform vec4 uShadow; // strength (0 = baked only), normal offset (m), one texel in uv, taps
#endif
#ifdef CHARACTER
#ifdef POSE_TEXTURE
flat in vec4 vCharLight;
flat in vec3 vCharLamp;
#define uCharLight vCharLight.xyz
#define uCharLamp vCharLamp
#define uFlash vCharLight.w
#else
uniform vec3 uCharLight; // sun, sky, highlight
uniform vec3 uCharLamp;
uniform float uFlash;
#endif
#endif
#ifdef LODFADE
uniform vec2 uFade; // share of pixels the new level draws (0..1); y = 1 draws the rest (the level going away)
const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
#endif
#ifdef CUTAWAY
uniform vec3 uCamFwd;
uniform float uCutOn;      // 0 or 1: off in first person and on the title screen
uniform sampler2D tHeight; // per column: R top of the solid run from street level, G the layer tSolid starts at (0.25 m units)
uniform vec4 uHeightRect;  // origin x, z and 1 / extent x, z (metres), shared by tHeight and tOwner
uniform highp usampler2D tSolid; // per column: which of the 64 voxel layers from the street up are solid (two words)
uniform sampler2D tOwner;  // per column: occluder id, owner above a split height, shell flag and split (see game/cutaway.ts)
uniform sampler2D tCut;    // per id: shell height near side, shell height far side, inside height, far-side start;
                           // 64 rows on, a great hall's air (middle, half extents); 128 on, its four sides' cut
                           // heights (see game/cutaway.ts)
uniform mat4 uViewProj;
float solidTop(vec2 xz) {
  vec2 uv = (xz - uHeightRect.xy) * uHeightRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -100.0;
  return texture(tHeight, uv).r * 255.0 * 0.25;
}
// whether the voxel just above height h is solid in the column under xz: a section cap is drawn where the cut
// plane runs through wall, also above a hollow room (a hotel floor over its lobby)
bool solidJustAbove(vec2 xz, float h) {
  vec2 uv = (xz - uHeightRect.xy) * uHeightRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return false;
  int l = int(floor(h * 4.0 + 0.08));
  if (l < 0) return false;
  // on a hillside a column's 64 layers start just under the terrain (see solidBase in world/owners.ts)
  l -= int(texture(tHeight, uv).g * 255.0 + 0.5);
  if (l < 0) return true;
  if (l >= 64) return solidTop(xz) > h + 0.02;
  uvec2 w = texelFetch(tSolid, ivec2(uv * vec2(textureSize(tSolid, 0))), 0).rg;
  return (((l < 32 ? w.x : w.y) >> uint(l & 31)) & 1u) == 1u;
}
// cut height at p (the column under p.xz, or the building hanging over it above the split), and the owner id
// (0 = nothing to cut)
float cutAt(vec3 p, vec2 fwdH, out float id) {
  vec2 uv = (p.xz - uHeightRect.xy) * uHeightRect.zw;
  id = 0.0;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x >= 1.0 || uv.y >= 1.0) return 1e4;
  vec4 o = floor(texelFetch(tOwner, ivec2(uv * vec2(textureSize(tOwner, 0))), 0) * 255.0 + 0.5);
  // R + low nibble of G = id, B + high nibble of G = owner above the split, A = shell flag (128) + split
  float gHi = floor(o.g / 16.0);
  float up = o.b + gHi * 256.0;
  float shell = step(127.5, o.a);
  bool over = up > 0.5 && p.y > (o.a - shell * 128.0) * 0.25 + 0.01;
  id = over ? up : o.r + (o.g - gHi * 16.0) * 256.0;
  if (id < 0.5) return 1e4;
  int ii = int(id);
  vec4 c = texelFetch(tCut, ivec2(ii % 64, ii / 64), 0);
  // a great hall (or its bell tower, minarets, court): inside its air the inside height; outside it, whatever
  // stands on one of its four sides (walls, front, portico, apse) is cut at that side's height, as one piece.
  // A corner belongs to both sides and keeps the taller cut.
  vec4 r = texelFetch(tCut, ivec2(ii % 64, ii / 64 + 64), 0);
  if (!over && r.z > 0.0) {
    vec2 q = p.xz - r.xy, ex = abs(q) - r.zw;
    if (ex.x <= 0.0 && ex.y <= 0.0) return c.z;
    vec4 s = texelFetch(tCut, ivec2(ii % 64, ii / 64 + 128), 0);
    float hx = q.x < 0.0 ? s.x : s.y, hz = q.y < 0.0 ? s.z : s.w;
    return ex.x > 0.0 && ex.y > 0.0 ? max(hx, hz) : ex.x > 0.0 ? hx : hz;
  }
  if (!over && shell < 0.5) return c.z;
  return dot(p.xz, fwdH) > c.w ? c.y : c.x;
}
#endif
flat in uvec2 vFlat; // see VOXEL_VERT
flat in vec3 vNormal;
in vec3 vWorld;
#ifdef SWAY
in vec3 vRest;
#else
in vec3 vCell;
#endif
in vec4 vQuad;
#ifdef ATLAS
uniform sampler2D tAtlas; // see AtlasBlocks in world/mesher.ts
#else
in vec4 vLight;
in vec2 vAoSky;
#endif
#ifdef SWAY
uniform mat4 modelMatrix;
#endif
${VOXEL_SCALES}
layout(location = 0) out vec4 outColor;

#ifndef ICON
// Sun visibility from the real-time shadow map (see engine/shadows.ts). w is how much the map has a say:
// it fades out at the map's edge, where the baked sun takes over.
float sunShadow(vec3 n, out float w) {
#ifdef SWAY
  // the static shadow map is cached in the rest pose, so a swaying prop reads it where it rests: its light
  // and shade ride along with it instead of the prop shadowing itself
  vec3 s = (uShadowMat * vec4(vRest + n * uShadow.y, 1.0)).xyz;
#else
  vec3 s = (uShadowMat * vec4(vWorld + n * uShadow.y, 1.0)).xyz;
#endif
  vec2 e = min(s.xy, 1.0 - s.xy);
  w = smoothstep(0.0, 0.03, min(e.x, e.y)) * step(s.z, 1.0) * uShadow.x;
  if (w <= 0.0) return 1.0;
  float t = uShadow.z;
  if (uShadow.w > 4.5) {
    // two rotated rings of hardware PCF taps: a soft ~5 texel penumbra
    float v = texture(tShadow, vec3(s.xy + vec2(0.45, -0.85) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(0.85, 0.45) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(-0.45, 0.85) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(-0.85, -0.45) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(1.75, -0.6) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(0.6, 1.75) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(-1.75, 0.6) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(-0.6, -1.75) * t, s.z));
    return v * 0.125;
  }
  if (uShadow.w > 1.5) {
    float v = texture(tShadow, vec3(s.xy + vec2(-0.7, -0.7) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(0.7, -0.7) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(-0.7, 0.7) * t, s.z))
            + texture(tShadow, vec3(s.xy + vec2(0.7, 0.7) * t, s.z));
    return v * 0.25;
  }
  return texture(tShadow, s);
}
#endif

void main() {
  // unpack the face (VOXEL_VERT)
  uint fx = vFlat.x;
  float face = float(fx & 7u);
  float vScale = SCALES[int((fx >> 3u) & 15u)];
#ifdef ATLAS
  // this voxel's corners, blended where the fragment lies, and its own colour, vary and edges
  ivec2 aSize = textureSize(tAtlas, 0);
  int plane = aSize.y / 3;
  vec2 qSize = floor(vec2(vQuad.x + vQuad.y, vQuad.z + vQuad.w) + 0.5);
  vec2 ql = clamp(vQuad.xz, vec2(0.0), qSize); // (MSAA shades edge pixels a little outside the quad)
  ivec2 org = ivec2(vFlat.y & 65535u, vFlat.y >> 16u);
  vec2 auv = (vec2(org) + ql + 0.5) / vec2(aSize);
  vec4 aL = texture(tAtlas, auv);
  vec2 aSA = texture(tAtlas, auv + vec2(0.0, float(plane) / float(aSize.y))).rg;
  vec2 vox = min(floor(ql), qSize - 1.0);
  ivec2 cellT = org + ivec2(vox);
  vec4 aV = texelFetch(tAtlas, cellT + ivec2(0, plane), 0);
  vec4 vColor = texelFetch(tAtlas, cellT + ivec2(0, plane * 2), 0);
  uint ez = uint(aV.a * 255.0 + 0.5);
  float vVary = aV.b * 255.0 * 0.02;
  vec4 vLight = aL;
  float vAO = aSA.g, vSky = aSA.r;
  // the bevel looks at this voxel's own edges
  vec2 vf = ql - vox;
  vec4 vCellQuad = vec4(vf.x, 1.0 - vf.x, vf.y, 1.0 - vf.y);
#else
  uint ez = fx >> 8u;
  float vVary = float((ez >> 4u) & 15u) * 0.02;
  vec4 vColor = vec4((uvec4(vFlat.y) >> uvec4(0u, 8u, 16u, 24u)) & 255u) / 255.0;
  float vAO = vAoSky.x, vSky = vAoSky.y;
  vec4 vCellQuad = vQuad;
#endif
  vec4 vEdge = vec4(uvec4(ez, ez >> 1u, ez >> 2u, ez >> 3u) & 1u);
#ifdef SWAY
  // swaying meshes are only ever moved, never turned, so the voxel's rest position less the move is its cell
  vec3 vCell = vRest - modelMatrix[3].xyz - (face < 1.5 ? vec3(1.0 - 2.0 * face, 0, 0) : face < 3.5 ? vec3(0, 5.0 - 2.0 * face, 0) : vec3(0, 0, 9.0 - 2.0 * face)) * (0.5 * vScale);
#endif
#ifdef CUTAWAY
  float vSeam = float((fx >> 7u) & 1u);
  // the face's in-plane axes, the directions vQuad measures along (FACE_U / FACE_V in world/mesher.ts)
  vec3 vU = face < 1.5 ? vec3(0.0, 1.0 - face, face) : face < 2.5 ? vec3(0, 0, 1) : face < 4.5 ? vec3(1, 0, 0) : vec3(0, 1, 0);
  vec3 vV = face < 0.5 ? vec3(0, 0, 1) : face < 1.5 ? vec3(0, 1, 0) : face < 2.5 ? vec3(1, 0, 0) : face < 3.5 ? vec3(0, 0, 1) : face < 4.5 ? vec3(0, 1, 0) : vec3(1, 0, 0);
#endif
#ifdef LODFADE
  // level-of-detail swap: old and new meshes split the pixels by a 4x4 ordered dither, so it dissolves instead of popping
  ivec2 bq = ivec2(gl_FragCoord.xy) & 3;
  bool keep = (BAYER[bq.y * 4 + bq.x] + 0.5) / 16.0 < uFade.x;
  if (keep == (uFade.y > 0.5)) discard;
#endif
#ifdef CUTAWAY
  // Whole-object cutaway: anything owned by a lowered occluder is removed above that occluder's cut
  // height. Where the view ray meets solid wall of the same occluder at that height, a section cap is
  // drawn at the true depth, so walls read as cut stone and rooms open up like a dollhouse.
  bool capped = false;
  vec3 capP = vec3(0.0);
  float capH = 0.0;
  if (uCutOn < 0.5 && vSeam > 0.5) discard;
  if (uCutOn > 0.5) {
    vec2 fwdH = normalize(uCamFwd.xz);
    float id;
    // Where the face's own voxels are. With MSAA a pixel only partly covered by a face is still shaded at the
    // pixel centre, a little outside the face: looked up there, the edges of a lowered building's faces read
    // the owner of the column next door (or the building that owns the air above it) and were drawn as thin
    // lines tracing its old outline. Pull the point back inside the face first.
    const float IN = 0.05; // voxels
    vec3 S = vWorld + (vU * (max(0.0, IN - vQuad.x) - max(0.0, IN - vQuad.y)) + vV * (max(0.0, IN - vQuad.z) - max(0.0, IN - vQuad.w))) * vScale;
    if (vSeam > 0.5) {
      // a wall between two buildings only shows where the neighbour across it has been lowered below it
      float idN;
      if (S.y <= cutAt(S + vNormal * 0.06, fwdH, idN)) discard;
    }
    // step a hair into the voxel this face belongs to, so faces on a column boundary pick the right owner
    float h = cutAt(S - vNormal * 0.06, fwdH, id);
    if (vWorld.y > h) {
      vec3 P = vWorld + uCamFwd * ((vWorld.y - h) / max(0.05, -uCamFwd.y));
      float idP;
      float hP = cutAt(P, fwdH, idP);
      if (idP == id && abs(hP - h) < 0.001 && solidJustAbove(P.xz, h)) { capped = true; capP = P; capH = h; }
      else discard;
    }
  }
#endif
  vec3 n = vNormal;
  // per-voxel colour jitter
  ivec3 cell = ivec3(floor(vCell / vScale + 0.001)) + 4096;
  uint h = uint(cell.x) * 73856093u ^ uint(cell.y) * 19349663u ^ uint(cell.z) * 83492791u;
  h = (h ^ (h >> 13u)) * 1274126177u;
  h ^= h >> 16u;
  float rnd = float(h & 65535u) / 65535.0;
  // glass carries vary 0.30 (GLASS_VARY in world/palette.ts), a jitter nothing else uses
  bool glass = vVary > 0.29;
  if (glass) {
    vVary = 0.02;
    // the window glass of the hotel room the player is in is drawn clear here; game/roomglass.ts lays a faint
    // pane over the opening instead, so the street shows through from inside
    vec3 gp = vWorld - vNormal * 0.05;
    if (all(greaterThan(gp, uClearGlass[0])) && all(lessThan(gp, uClearGlass[1]))) discard;
  }
#ifndef CHARACTER
  // and whatever hangs just outside that room's windows (flower boxes, signs, rails) while you look out
  if (all(greaterThan(vWorld, uClearOut[0])) && all(lessThan(vWorld, uClearOut[1]))) discard;
#endif
  vec3 albedo = srgb2lin(vColor.rgb) * (1.0 + (rnd - 0.5) * 2.0 * vVary);

#ifdef CHARACTER
  float sun = uCharLight.x;
  float sky = uCharLight.y;
  vec3 lampL = uCharLamp;
#else
  float sun = vLight.a;
  float sky = vSky;
  vec3 lampL = vLight.rgb * 2.0;
#endif
  float ao = vAO;
  float ndl = max(dot(n, uSunDir), 0.0);
#ifndef ICON
  // the real-time map adds what the bake can't see (props, people, anything that moves) and sharpens the
  // rest; faces turned from the sun, and world faces the bake already has in deep shadow, skip it
#ifdef CHARACTER
  bool lookup = ndl > 0.0 && uShadow.x > 0.0;
#else
  // foliage (emission code 128, see Palette leaf) keeps the bake's soft canopy light: a hard map turns every
  // leafy bump into a speck of shadow
  bool lookup = ndl > 0.0 && uShadow.x > 0.0 && sun > 0.004 && abs(vColor.a * 255.0 - 128.0) > 0.5;
#endif
#ifdef FAR
  lookup = false; // (far past the shadow map: the bake has the sun)
#endif
  if (lookup) {
    float w;
    float v = sunShadow(n, w);
    sun = mix(sun, v, w);
  }
#endif
  // drifting cloud shadows
  float cloud = 1.0;
  if (uCloud > 0.0) cloud = 1.0 - min(0.6, uCloud * 1.9) * cloudShadow(vWorld);
  vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  vec3 direct = uSunColor * ndl * sun * cloud * (0.6 + 0.4 * ao);
  vec3 ambient = hemi * ao * (0.25 + 0.75 * sky);
  float lampOn = uLamp;
#ifndef CHARACTER
  // under the bazaars' vaults the daylight is warm and the shops' lamps burn all day
  for (int i = 0; i < 3; i++) {
    vec4 wb = uWarm[i];
    if (vWorld.x > wb.x && vWorld.x < wb.z && vWorld.z > wb.y && vWorld.z < wb.w && vWorld.y < uWarmTop[i]) {
      ambient = mix(ambient, vec3(dot(ambient, vec3(0.3, 0.55, 0.15))) * vec3(1.3, 1.0, 0.7), 0.85);
      lampOn = max(lampOn, 0.6);
    }
  }
#endif
  vec3 lamp = lampL * lampOn * (0.45 + 0.55 * ao);
  vec3 col = albedo * (direct + ambient + lamp);
#ifndef CHARACTER
  if (glass) {
    // Glass: the pane mirrors the sky (or the dim street where the bake sees little sky), catches the sun, and
    // lets a little of a darker room through. All arithmetic plus the one noise fetch the clouds already use.
    vec3 V = isOrthographic ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : normalize(vWorld - cameraPosition);
    // panes are never quite coplanar: each ~0.75 m tile leans a hair, so a wall of glass breaks its reflection up
    vec3 th = fract(sin(vec3(dot(floor(vCell * 1.33), vec3(12.9898, 78.233, 37.719)))) * vec3(43758.5453, 22578.1459, 19642.3490));
    vec3 gn = normalize(n + (th - 0.5) * 0.1 * (1.0 - abs(n)));
    vec3 R = reflect(V, gn);
    float fres = 0.04 + 0.96 * pow(1.0 - max(dot(-V, gn), 0.0), 5.0);
    float refl = 0.32 + 0.68 * fres; // stronger than physical: from the iso angle true glass mirrors only a few percent
    // clouds in the reflection slide at half the camera's pace, so the glass seems to hold depth as you walk
    vec2 cp = (vWorld.xz + vWorld.y * vec2(0.6, -0.8)) * 0.06 - cameraPosition.xz * 0.03 + R.xz * 1.5 / (abs(R.y) + 0.3)
            + vec2(uTime * 0.012, uTime * 0.006);
    float cl = vnoiseT(cp);
    vec3 skyR = mix(uFogColor, uSkyColor * 1.15, smoothstep(-0.05, 0.6, R.y));
    skyR = mix(skyR, uFogColor * 1.1 + uSunColor * 0.2, smoothstep(0.5, 0.8, cl) * 0.55 * smoothstep(0.0, 0.25, R.y));
    vec3 street = (uGroundColor * 0.55 + uSkyColor * 0.2) * (0.6 + 0.6 * cl);
    vec3 env = mix(street, skyR, smoothstep(-0.12, 0.1, R.y + (cl - 0.5) * 0.25));
    env *= 0.3 + 0.7 * sky; // deep in a lane a pane mirrors walls, not sky
    float sp = max(dot(R, uSunDir), 0.0);
    vec3 glint = uSunColor * (pow(sp, 400.0) * 5.0 + pow(sp, 24.0) * 0.3) * sun * cloud;
    vec3 behind = albedo * (ambient * 0.45 + direct * 0.15 + lamp);
    col = behind * (1.0 - refl) + env * refl + glint;
  }
#endif

  // emission
  float code = vColor.a * 255.0;
  if (code > 127.5) {
    float e = (code - 128.0) / 127.0;
    col += mix(albedo * 2.0, uWindowColor, 0.75) * e * uNight * (0.8 + 0.4 * rnd);
  } else if (code > 0.5) {
    float e = code / 127.0;
    col += albedo * e * mix(uEmitDay, 2.4, uNight);
  }

  // bevel highlight on convex voxel edges
  vec4 d4 = mix(vec4(1e3), vCellQuad, vEdge);
  float d = min(min(d4.x, d4.y), min(d4.z, d4.w));
  float fw = fwidth(vQuad.x + vQuad.z) * 0.7;
  float edge = 1.0 - smoothstep(0.0, 0.16 + fw, d);
  col *= 1.0 + edge * 0.28 * (0.35 + 0.65 * ao);

#ifdef CHARACTER
  col += albedo * uFlash;
#endif
#ifdef FAR
  // the far coast's aerial perspective (engine/farcoast.ts HAZE), so the villages sit in the same air as their slopes
  {
    vec2 o = max(uFarRect.xy - vWorld.xz, vWorld.xz - uFarRect.zw);
    float lift = mix(1.0, 0.7, smoothstep(20.0, 600.0, vWorld.y));
    float a = (1.0 - exp(-max(0.0, max(o.x, o.y)) * 0.0016)) * lift;
    if (uFog.w > 0.0) {
      float fd = max(0.0, distance(vWorld, uFog.xyz) - FOG_START) * uFog.w * 0.12;
      a = max(a, (1.0 - exp(-fd * fd)) * lift);
    }
    col = mix(col, uFogColor * mix(vec3(1.0), vec3(0.88, 0.95, 1.07), a), min(a, 0.92));
  }
#else
  // fade into the haze outside the playable map
  vec2 outside = max(uBounds.xy - vWorld.xz, vWorld.xz - uBounds.zw);
  float fo = smoothstep(0.0, 9.0, max(outside.x, outside.y));
  col = mix(col, uFogColor, fo);
  if (uFog.w > 0.0) {
    float fd = max(0.0, distance(vWorld, uFog.xyz) - FOG_START) * uFog.w;
    col = mix(col, uFogColor, 1.0 - exp(-fd * fd));
  }
#endif
#ifdef CUTAWAY
  if (capped) {
    // section cap: warm cut stone with a darker rim where the wall ends
    float e = 0.0, o = 0.06, th = capH + 0.02;
    e += solidJustAbove(capP.xz + vec2(o, 0.0), capH) ? 0.0 : 1.0;
    e += solidJustAbove(capP.xz - vec2(o, 0.0), capH) ? 0.0 : 1.0;
    e += solidJustAbove(capP.xz + vec2(0.0, o), capH) ? 0.0 : 1.0;
    e += solidJustAbove(capP.xz - vec2(0.0, o), capH) ? 0.0 : 1.0;
    vec3 lightC = uSkyColor * 0.7 + uSunColor * 0.3 + uLamp * vec3(0.35, 0.24, 0.12);
    // colour depends on the cap point only: several fragments along one ray write the same cap, so they must agree
    float grain = fract(sin(dot(floor(capP.xz * 4.0), vec2(12.9898, 78.233))) * 43758.5453);
    col = srgb2lin(vec3(0.84, 0.78, 0.7)) * (0.92 + grain * 0.08) * (0.2 + lightC);
    col *= mix(1.0, 0.62, min(1.0, e));
  } else if (!gl_FrontFacing) {
    // inside of a neighbour's wall, seen through a party wall that was never meshed: shade it flat in
    // its own colour so it reads as the missing wall instead of a hole
    col = albedo * (uSkyColor * 0.55 + uSunColor * 0.2 + lampL * uLamp * 0.5);
    col = mix(col, uFogColor, fo);
  }
  if (capped) {
    vec4 cp = uViewProj * vec4(capP, 1.0);
    gl_FragDepth = cp.z / cp.w * 0.5 + 0.5;
  } else {
    gl_FragDepth = gl_FragCoord.z;
  }
#endif
#ifdef ICON
  col *= 1.15;
  col = clamp((col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14), 0.0, 1.0);
  col = pow(col, vec3(1.0 / 2.2));
#endif
  outColor = vec4(col, 1.0);
}
`;

// Fullscreen triangle
export const FS_VERT = /* glsl */ `
out vec2 vUv;
void main() {
  vUv = position.xy * 0.5 + 0.5;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// 13-tap downsample (Jimenez 2014) with optional bright-pass and Karis average on the first level
export const DOWN_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uThreshold;
uniform float uFirst;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
vec3 s(vec2 o) { return texture(tSrc, vUv + o * uTexel).rgb; }
void main() {
  vec3 a = s(vec2(-2, -2)), b = s(vec2(0, -2)), c = s(vec2(2, -2));
  vec3 d = s(vec2(-1, -1)), e = s(vec2(1, -1));
  vec3 f = s(vec2(-2, 0)), g = s(vec2(0, 0)), h = s(vec2(2, 0));
  vec3 i = s(vec2(-1, 1)), j = s(vec2(1, 1));
  vec3 k = s(vec2(-2, 2)), l = s(vec2(0, 2)), m = s(vec2(2, 2));
  vec3 col = (d + e + i + j) * 0.125 + (a + c + k + m) * 0.03125 + (b + f + h + l) * 0.0625 + g * 0.125;
  if (uFirst > 0.5) {
    float br = max(col.r, max(col.g, col.b));
    float soft = clamp(br - uThreshold + 0.5, 0.0, 1.0);
    soft = soft * soft * 0.5;
    float w = max(soft, br - uThreshold) / max(br, 1e-4);
    col *= max(w, 0.0);
    col /= 1.0 + max(col.r, max(col.g, col.b)) * 0.25; // tame fireflies
  }
  outColor = vec4(col, 1.0);
}
`;

// 9-tap tent upsample, additively blended onto the next level up
export const UP_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
uniform float uRadius;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  vec2 o = uTexel * uRadius;
  vec3 c = texture(tSrc, vUv).rgb * 4.0;
  c += (texture(tSrc, vUv + vec2(-o.x, 0)).rgb + texture(tSrc, vUv + vec2(o.x, 0)).rgb + texture(tSrc, vUv + vec2(0, -o.y)).rgb + texture(tSrc, vUv + vec2(0, o.y)).rgb) * 2.0;
  c += texture(tSrc, vUv + vec2(-o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(o.x, -o.y)).rgb + texture(tSrc, vUv + vec2(-o.x, o.y)).rgb + texture(tSrc, vUv + vec2(o.x, o.y)).rgb;
  outColor = vec4(c / 16.0, 1.0);
}
`;

// Half-resolution copy of the scene (for tilt-shift blur)
export const HALF_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D tSrc;
uniform vec2 uTexel;
in vec2 vUv;
layout(location = 0) out vec4 outColor;
void main() {
  vec3 c = texture(tSrc, vUv + uTexel * vec2(-0.5, -0.5)).rgb + texture(tSrc, vUv + uTexel * vec2(0.5, -0.5)).rgb
         + texture(tSrc, vUv + uTexel * vec2(-0.5, 0.5)).rgb + texture(tSrc, vUv + uTexel * vec2(0.5, 0.5)).rgb;
  outColor = vec4(c * 0.25, 1.0);
}
`;

/**
 * Final composite: screen-space volumetric water, bloom, tilt-shift, tone mapping and grading.
 *
 * Water is not geometry. Every pixel whose scene surface lies below the water plane is shaded as water:
 * the view ray is intersected with the plane, the optical path through the water gives Beer-Lambert
 * absorption and in-scattering, the floor gets animated caustics, a few ray-marched samples produce
 * light shafts, and the surface gets refraction, screen-space reflections, fresnel and sun glints.
 */
export const COMPOSITE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tScene;
uniform sampler2D tDepth;
uniform sampler2D tBloom;
uniform sampler2D tHalf;
uniform sampler2D tParticles;
uniform mat4 uInvViewProj;
uniform mat4 uViewProj;
uniform vec3 uCamFwd;
uniform vec2 uRes;
uniform vec3 uClip;     // near, far, perspective
uniform vec4 uFog;      // first-person eye position and haze density
uniform vec3 uFogColor;
uniform float uTime;
uniform float uWaterY;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uWaterDeep;
uniform vec3 uWaterScatter;
uniform float uBloom;
uniform float uExposure;
uniform float uTilt;
uniform float uSSR;
uniform float uShafts;
uniform vec3 uGradeShadow;
uniform vec3 uGradeHigh;
uniform float uSaturation;
uniform float uVignette;
uniform float uFade;
uniform vec4 uWaterBounds;
uniform float uSea;         // 1: open sea (no current, long swell, foam on the beach), 0: Tokyo's canal
uniform sampler2D tShore;   // signed distance to the water's edge (see computeShore)
uniform vec4 uShoreRect;    // origin x, z and 1 / extent x, z (metres)
in vec2 vUv;
layout(location = 0) out vec4 outColor;
//#SKY

vec3 worldAt(vec2 uv, float depth) {
  vec4 p = uInvViewProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}

// analytic water surface, band-limited against fw (the screen pixel's footprint in p units): each wave fades out
// as it nears a few pixels long, so zoomed-out water calms instead of beating into a moire.
float bandLimit(float k, float fw) { return 1.0 - smoothstep(0.4, 1.3, k * fw); }
// value noise with its analytic gradient (xy) and value (z): one lattice lookup instead of three
vec3 vnoiseD(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f), du = 6.0 * f * (1.0 - f);
  float a = hash12(i), b = hash12(i + vec2(1, 0)), c = hash12(i + vec2(0, 1)), d = hash12(i + vec2(1, 1));
  float k1 = b - a, k2 = c - a, k4 = a - b - c + d;
  return vec3(du * vec2(k1 + k4 * u.y, k2 + k4 * u.x), a + k1 * u.x + k2 * u.y + k4 * u.x * u.y);
}
${WAVE_TABLE}
const vec4 OCT_ROT[4] = vec4[4](vec4(0.8, 0.6, 0.35, -0.2), vec4(-0.28, 0.96, -0.3, 0.5), vec4(0.6, -0.8, 0.6, 0.45), vec4(-0.96, -0.28, -0.5, -0.7));
vec3 waterNormal(vec2 p, float t, float fw) {
  // crests bend: a slow warp keeps every wave from running as a ruled line across the whole sea
  vec2 w = p + (vec2(vnoise(p * 0.11), vnoise(p * 0.11 + 31.7)) - 0.5) * 1.6;
  // two patch masks: one family of waves rises where the other dies down, so the interference never tiles
  float m0 = 0.35 + 1.3 * vnoise(p * 0.07 + vec2(t * 0.02, 5.3));
  float m1 = 0.35 + 1.3 * vnoise(p * 0.07 + vec2(-9.1, t * 0.017));
  vec2 g = vec2(0.0);
  for (int i = 0; i < WAVES; i++) {
    vec4 wv = WAVE[i];
    float bl = bandLimit(wv.z, fw);
    if (bl <= 0.0) break; // sorted long to short: the rest are finer still
    float ph = dot(wv.xy, w) * wv.z + t * sqrt(9.8 * wv.z) * 0.55 + WAVE_PH[i];
    g += wv.xy * (wv.w * bl * ((i & 1) == 0 ? m0 : m1) * cos(ph));
  }
  // chop and capillary ripples: rotated octaves of noise drifting with the wind. Noise has no period and no
  // single direction, so the short scales (where sines would beat into a lattice) stay irregular
  float f = 0.9, amp = 0.085;
  for (int o = 0; o < 4; o++) {
    float r = bandLimit(f * 5.0, fw);
    if (r <= 0.0) break;
    float c = OCT_ROT[o].x, sn = OCT_ROT[o].y;
    vec2 q = mat2(c, -sn, sn, c) * p * f + OCT_ROT[o].zw * t;
    g += mat2(c, sn, -sn, c) * vnoiseD(q).xy * amp * r;
    f *= 2.13; amp *= 0.52;
  }
  return normalize(vec3(-g.x, 1.0, -g.y));
}

// signed distance to the shoreline in metres, positive over open water
float shoreDist(vec2 xz) {
  vec2 uv = (xz - uShoreRect.xy) * uShoreRect.zw;
  // past the map the sea goes on: open water wherever there is water at all
  if (uSea > 0.5 && (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0)) return 8.0;
  return (texture(tShore, uv).r * 255.0 - 128.0) * 0.015625;
}

const vec2 FLOW = vec2(0.3, 0.0); // the canal drifts gently east, m/s

float caustic(vec2 p, float t) {
  vec2 q = p * 1.35;
  float c = 0.0;
  for (int i = 0; i < 2; i++) {
    vec2 w = q + vec2(sin(q.y * 1.7 + t * 0.9), cos(q.x * 1.3 - t * 0.8)) * 0.55;
    float a = abs(sin(w.x * 2.1 + t * 0.6) + sin(w.y * 2.3 - t * 0.7));
    c += pow(max(0.0, 1.0 - a * 0.7), 4.0);
    q = q * 1.7 + 3.1;
  }
  return c;
}

// the sky seen in a reflection: the table, and the far mountains when the ray finds them
vec3 skyColor(vec3 dir) {
  dir.y = max(dir.y, 0.004);
  vec3 s = skyLut(dir);
  float tf;
  vec4 far = farBackdrop(dir, s, tf);
  return mix(s, far.rgb, far.a);
}

vec3 aces(vec3 x) {
  const float a = 2.51, b = 0.03, c = 2.43, d = 0.59, e = 0.14;
  return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
  vec2 uv = vUv;
  float depth = texture(tDepth, uv).r;
  vec3 col = texture(tScene, uv).rgb;
  vec3 wpos = worldAt(uv, depth);

  // per-pixel view ray (constant for the iso camera, fans out in first person)
  vec3 near = worldAt(uv, 0.0);
  vec3 rd = normalize(worldAt(uv, 1.0) - near);
  if (depth >= 0.99999) {
    if (uClip.z > 0.5) {
      // eye-level sky (engine/sky.ts): the angle one pixel spans sizes the stars
      vec3 rdx = normalize(worldAt(uv + vec2(1.0 / uRes.x, 0.0), 1.0) - worldAt(uv + vec2(1.0 / uRes.x, 0.0), 0.0));
      col = skyView(near, rd, length(rdx - rd));
    } else {
      // the iso view looks down: the haze at the foot, the sky a little way up at the top
      vec3 up = normalize(vec3(uCamFwd.x, 0.0, uCamFwd.z) + vec3(0.0, 0.45, 0.0));
      col = mix(uFogColor, skyLut(up), smoothstep(0.1, 1.1, uv.y));
    }
  } else if (wpos.y < uWaterY - 0.004 && wpos.x > uWaterBounds.x && wpos.x < uWaterBounds.z && wpos.z > uWaterBounds.y && wpos.z < uWaterBounds.w
      && shoreDist(near.xz + rd.xz * ((uWaterY - near.y) / rd.y)) > -1.5) { // (only real water: not the floor under a chunk still streaming in)
    float tPlane = (uWaterY - near.y) / rd.y;
    vec3 sp = near + rd * tPlane;
    // shoreline field: distance and its gradient (points away from the bank, into open water)
    float sd = shoreDist(sp.xz);
    vec2 sg = vec2(shoreDist(sp.xz + vec2(0.12, 0.0)) - sd, shoreDist(sp.xz + vec2(0.0, 0.12)) - sd) / 0.12;
    sg /= max(length(sg), 1e-3);
    float dEdge = max(sd, 0.0);
    // waves drift downstream; the banks see slack water and small waves lapping in toward the stone
    vec2 flow = FLOW * (1.0 - uSea);
    // the sea: a longer swell rolling in towards the beach, and no current lines
    // (the swell's crests bend and come in sets, so it never reads as ruled lines from up high)
    vec2 warp = uSea * vec2(vnoise(sp.xz * 0.045), vnoise(sp.xz * 0.045 + 17.3)) * 7.0;
    // metres per screen pixel at the water surface, from the projection (derivatives are not to be trusted
    // inside this branch); every high-frequency term below is band-limited against it
    vec4 c0 = uViewProj * vec4(sp, 1.0), c1 = uViewProj * vec4(sp + vec3(1.0, 0.0, 0.0), 1.0), c2 = uViewProj * vec4(sp + vec3(0.0, 0.0, 1.0), 1.0);
    vec2 s0 = c0.xy / c0.w;
    float ppm = max(length((c1.xy / c1.w - s0) * uRes), length((c2.xy / c2.w - s0) * uRes)) * 0.5;
    float mpp = 1.0 / max(ppm, 1e-3);
    vec3 nrm = waterNormal(mix(sp.xz - flow * uTime, sp.xz * 0.55 + warp, uSea), uTime * mix(1.0, 0.8, uSea), mpp * mix(1.0, 0.55, uSea));
    float flowLine = vnoise(vec2((sp.x - flow.x * uTime * 1.3) * 0.9, sp.z * 5.5));
    nrm.z += (flowLine - 0.5) * 0.06 * (1.0 - uSea) * bandLimit(5.5 * 6.2832, mpp);
    nrm.xz *= 1.0 + 0.5 * uSea;
    // how much of the surface detail survives at this zoom (1 close up, 0 far out)
    float detail = bandLimit(5.9, mpp * mix(1.0, 0.55, uSea));
    if (uSea > 0.5) {
      float sets = 0.55 + 0.9 * vnoise(sp.xz * 0.025 + vec2(uTime * 0.012, 0.0));
      nrm.xz *= sets * mix(0.45, 1.0, detail);
    }
    float lapA = exp(-dEdge * 2.2) * 0.09 * bandLimit(13.0, mpp);
    nrm.xz += sg * cos(dEdge * 13.0 + uTime * 2.4) * lapA;
    nrm = normalize(nrm);
    // refraction
    vec2 ruv = uv + nrm.xz * 0.035 * clamp(uWaterY - wpos.y, 0.0, 1.0) * vec2(1.0, uRes.x / uRes.y) * 0.6;
    float rdepth = texture(tDepth, ruv).r;
    vec3 rpos = worldAt(ruv, rdepth);
    if (rpos.y > uWaterY || rdepth >= 0.99999) { ruv = uv; rpos = wpos; }
    vec3 floorCol = texture(tScene, ruv).rgb;
    // soften the blocky bed: deeper floor reads through a slightly blurred, wobbling lens
    floorCol = mix(floorCol, texture(tHalf, ruv).rgb, clamp((uWaterY - rpos.y) * 0.45, 0.0, 0.7));
    float pathLen = max(0.0, length(rpos - sp));
    float vDepth = max(0.0, uWaterY - rpos.y);
    // caustics on the floor
    vec2 cpos = rpos.xz + uSunDir.xz / max(uSunDir.y, 0.2) * vDepth;
    float cs = caustic(cpos, uTime) * exp(-vDepth * 0.9) * length(uSunColor) * 0.55;
    floorCol *= 1.0 + cs;
    // absorption + scattering
    // the canal is green and murky; the Tyrrhenian is clear and turns ultramarine as it deepens
    vec3 absorb = mix(vec3(0.55, 0.16, 0.10) * 1.15, vec3(0.5, 0.12, 0.055), uSea);
    vec3 trans = exp(-absorb * pathLen);
    vec3 scatterLight = uWaterScatter * (0.35 + 0.65 * clamp(length(uSunColor), 0.0, 1.5));
    vec3 under = floorCol * trans + scatterLight * (1.0 - exp(-pathLen * 0.85));
    vec3 deep = mix(uWaterDeep, uWaterDeep * vec3(0.5, 0.95, 1.55) + vec3(0.0, 0.004, 0.012), uSea);
    // the open sea is never one flat colour: broad, slow patches of deeper and lighter blue
    deep *= 1.0 + uSea * (vnoise(sp.xz * 0.018 + vec2(uTime * 0.004, 0.0)) - 0.5) * 0.35;
    under = mix(under, deep, 1.0 - exp(-pathLen * mix(0.45, 0.3, uSea)));
    // volumetric light shafts: march through the water column
    if (uShafts > 0.0) {
      float shaft = 0.0;
      for (int i = 0; i < 6; i++) {
        float f = (float(i) + hash12(uv * uRes + float(i))) / 6.0;
        vec3 q = mix(sp, rpos, f);
        float dq = uWaterY - q.y;
        vec2 surf = q.xz + uSunDir.xz / max(uSunDir.y, 0.2) * dq;
        shaft += caustic(surf * 0.7, uTime * 0.8) * exp(-dq * 1.2);
      }
      under += uSunColor * uWaterScatter * shaft / 6.0 * min(pathLen, 2.0) * 0.6 * uShafts;
    }
    // reflection
    vec3 refl = reflect(rd, nrm);
    vec3 rcol = skyColor(refl);
    float hitW = 0.0;
    if (uSSR > 0.0) {
      float stepLen = 0.25;
      vec3 rp = sp;
      for (int i = 0; i < 14; i++) {
        rp += refl * stepLen;
        stepLen *= 1.32;
        vec4 clip = uViewProj * vec4(rp, 1.0);
        vec2 suv = clip.xy / clip.w * 0.5 + 0.5;
        if (suv.x < 0.0 || suv.y < 0.0 || suv.x > 1.0 || suv.y > 1.0) break;
        float sd = texture(tDepth, suv).r;
        float rz = clip.z / clip.w * 0.5 + 0.5;
        if (sd < rz && linZ(rz, uClip) - linZ(sd, uClip) < (uClip.z > 0.5 ? 1.2 : 8.0)) {
          vec3 hp = worldAt(suv, sd);
          if (hp.y > uWaterY - 0.05) {
            vec2 edgeF = smoothstep(vec2(0.0), vec2(0.08), suv) * smoothstep(vec2(0.0), vec2(0.08), 1.0 - suv);
            hitW = edgeF.x * edgeF.y * (1.0 - float(i) / 14.0);
            rcol = mix(rcol, texture(tScene, suv).rgb, hitW);
          }
          break;
        }
      }
    }
    float cosT = clamp(dot(-rd, nrm), 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
    fres = clamp(fres * 2.2 + 0.18 + hitW * 0.25, 0.0, 0.85);
    vec3 water = mix(under, rcol, fres);
    // sun glint
    vec3 hv = normalize(uSunDir - rd);
    float specN = max(dot(nrm, hv), 0.0);
    float spec = pow(specN, mix(70.0, 220.0, detail)) * mix(1.2, 3.0, detail) + pow(specN, 30.0) * 0.12;
    water += uSunColor * spec;
    float slow = smoothstep(0.0, 1.6, dEdge);
    vec3 lightF = uSunColor * (0.35 + 0.65 * max(uSunDir.y, 0.0)) + uSkyHorizon * 0.6 + uSkyTop * 0.25;
    // cherry petals floating downstream
    vec2 pp = (sp.xz - flow * uTime * (0.4 + 0.6 * slow)) * 2.3;
    vec2 cell = floor(pp);
    float hp = hash12(cell);
    if (uSea > 0.5) {
      // surf: a ribbon of foam where the swell breaks on the pebbles, pulled back and forth
      float run = dEdge * 6.0 - uTime * 1.1 + vnoise(sp.xz * 0.4) * 3.0;
      float foam = exp(-dEdge * 2.6) * smoothstep(0.55, 0.95, sin(run) * 0.5 + 0.5 + (vnoise(sp.xz * 3.0 + uTime * 0.3) - 0.5) * 0.6);
      foam += exp(-dEdge * 9.0) * 0.6 * vnoise(sp.xz * 4.0 - uTime * 0.5);
      water = mix(water, clamp(lightF, 0.08, 1.6) * 0.95, clamp(foam, 0.0, 0.85) * smoothstep(0.0, 0.25, dEdge));
    } else if (hp > 0.9) {
      vec2 f = fract(pp) - 0.5 - (vec2(hash12(cell + 7.1), hash12(cell + 3.3)) - 0.5) * 0.5;
      float a = hp * 40.0 + uTime * 0.4;
      f = mat2(cos(a), -sin(a), sin(a), cos(a)) * f;
      float pet = smoothstep(0.075, 0.05, length(f * vec2(1.0, 1.9)));
      water = mix(water, srgb2lin(vec3(0.96, 0.74, 0.82)) * clamp(lightF, 0.08, 1.4), pet * smoothstep(0.05, 0.3, dEdge) * 0.9);
    }
    if (uFog.w > 0.0) {
      float fd = max(0.0, distance(sp, uFog.xyz) - FOG_START) * uFog.w;
      water = mix(water, uFogColor, 1.0 - exp(-fd * fd));
    }
    col = water;
  } else if (wpos.y < uWaterY + 0.4 && wpos.x > uWaterBounds.x && wpos.x < uWaterBounds.z && wpos.z > uWaterBounds.y && wpos.z < uWaterBounds.w) {
    // wet stone just above the waterline, with a waterline that rises and falls with the lapping
    float sdw = shoreDist(wpos.xz);
    float top = uWaterY + 0.09 + 0.045 * sin(wpos.x * 2.3 + wpos.z * 1.7 + uTime * 1.2) + 0.05 * vnoise(wpos.xz * 5.0 + uTime * 0.2);
    float wet = smoothstep(top + 0.035, top - 0.035, wpos.y) * smoothstep(-0.35, -0.04, sdw);
    col *= mix(1.0, 0.58, wet);
  }

  // aerial perspective: the town's first-person haze went to one colour (the horizon where the camera looks);
  // give each pixel the horizon of its own direction, warm toward a low sun and cool away from it. Only what
  // really went into the haze is retinted: far shaders haze in their own ways, so it is judged by the colour
  if (uFog.w > 0.0 && depth < 0.99999) {
    float fd = max(0.0, length(wpos - near) - FOG_START) * uFog.w;
    float fa = (1.0 - exp(-fd * fd)) * (1.0 - smoothstep(0.06, 0.3, length(col - uFogColor) / max(length(uFogColor), 1e-3)));
    if (fa > 0.01) col = max(col + (hazeAt(rd) - uFogColor) * fa, 0.0);
  }

  // tilt-shift miniature blur
  if (uTilt > 0.0) {
    float band = smoothstep(0.18, 0.62, abs(uv.y - 0.5) * 2.0) * uTilt;
    if (band > 0.01) {
      vec2 o = band * 2.2 / uRes;
      vec3 b = texture(tHalf, uv + vec2(o.x, o.y)).rgb + texture(tHalf, uv + vec2(-o.x, o.y)).rgb + texture(tHalf, uv + vec2(o.x, -o.y)).rgb + texture(tHalf, uv + vec2(-o.x, -o.y)).rgb;
      vec3 blurred = b * 0.25;
      if (depth >= 0.99999 || wpos.y >= uWaterY - 0.004) col = mix(col, blurred, band * 0.85);
    }
  }

  // particles (premultiplied, half resolution)
  vec4 pc = texture(tParticles, uv);
  col = col * (1.0 - pc.a) + pc.rgb;

  col += texture(tBloom, uv).rgb * uBloom;
  col *= uExposure;
  col = aces(col);
  // grading
  float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
  col = mix(vec3(luma), col, uSaturation);
  col *= mix(uGradeShadow, uGradeHigh, smoothstep(0.0, 0.8, luma));
  vec2 vc = uv - 0.5;
  col *= 1.0 - dot(vc, vc) * uVignette;
  col = pow(max(col, 0.0), vec3(1.0 / 2.2));
  col += (hash12(uv * uRes + fract(uTime) * 61.0) - 0.5) / 255.0;
  col *= uFade;
  outColor = vec4(col, 1.0);
}
`;

// Instanced soft particles (steam, smoke, petals, fireflies) rendered into a half-res premultiplied buffer.
export const PARTICLE_VERT = /* glsl */ `
in vec4 aSeed;      // x: phase, y: speed, z: size, w: kind
in vec3 aOrigin;
uniform float uTime;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uWind;
uniform float uNight;
out vec2 vUv;
out float vAlpha;
out vec3 vTint;
out float vKind;
out vec4 vClip;
void main() {
  float kind = aSeed.w;
  float life;
  vec3 p = aOrigin;
  float size = aSeed.z;
  vTint = vec3(1.0);
  if (kind < 0.5) { // steam
    life = fract(uTime * aSeed.y * 0.35 + aSeed.x);
    p += vec3(sin(aSeed.x * 40.0 + uTime) * 0.12 * life, life * 1.3, cos(aSeed.x * 23.0 + uTime * 0.7) * 0.12 * life) + uWind * life * 0.6;
    size *= 0.4 + life * 1.4;
    vAlpha = smoothstep(0.0, 0.15, life) * (1.0 - life) * 0.32;
    vTint = vec3(1.0, 0.98, 0.95);
  } else if (kind < 1.5) { // grill smoke
    life = fract(uTime * aSeed.y * 0.25 + aSeed.x);
    p += vec3(sin(aSeed.x * 31.0 + uTime * 0.8) * 0.25 * life, life * 2.2, cos(aSeed.x * 17.0) * 0.2 * life) + uWind * life * 1.2;
    size *= 0.5 + life * 2.2;
    vAlpha = smoothstep(0.0, 0.2, life) * (1.0 - life) * 0.28;
    vTint = vec3(0.72, 0.7, 0.68);
  } else if (kind < 2.5) { // incense
    life = fract(uTime * aSeed.y * 0.18 + aSeed.x);
    p += vec3(sin(life * 6.0 + aSeed.x * 9.0) * 0.18 * life, life * 2.8, cos(life * 5.0 + aSeed.x * 7.0) * 0.18 * life) + uWind * life;
    size *= 0.35 + life * 1.8;
    vAlpha = smoothstep(0.0, 0.25, life) * (1.0 - life) * 0.26;
    vTint = vec3(0.85, 0.85, 0.88);
  } else if (kind < 3.5) { // sakura petal: drifts in a box and wraps
    life = fract(uTime * aSeed.y * 0.05 + aSeed.x);
    vec3 box = vec3(72.0, 7.0, 18.0);
    vec3 q = aOrigin + vec3(uTime * 0.55 * aSeed.y + sin(uTime * 0.8 + aSeed.x * 30.0) * 0.8, -life * box.y, uTime * 0.18 + cos(uTime * 0.6 + aSeed.x * 21.0) * 0.6);
    q.x = mod(q.x, box.x);
    q.z = 36.0 + mod(q.z - 36.0, box.z);
    q.y = 0.05 + mod(q.y, box.y);
    p = q;
    vAlpha = smoothstep(0.0, 0.08, life) * smoothstep(0.0, 0.3, p.y) * 0.95;
    vTint = mix(vec3(1.0, 0.72, 0.8), vec3(1.0, 0.86, 0.9), fract(aSeed.x * 13.0));
    size *= 0.85 + 0.3 * sin(uTime * 4.0 + aSeed.x * 50.0);
  } else if (kind > 4.5) { // sparkle around a lucky cat
    life = fract(uTime * aSeed.y * 0.6 + aSeed.x);
    p += vec3(0.0, life * 0.5, 0.0);
    vAlpha = sin(life * 3.14159) * (0.6 + 0.4 * sin(uTime * 9.0 + aSeed.x * 30.0));
    vTint = vec3(1.0, 0.85, 0.4) * 3.0;
    size *= 0.6 + sin(life * 3.14159) * 0.8;
  } else { // firefly
    life = fract(uTime * 0.1 + aSeed.x);
    p += vec3(sin(uTime * 0.7 * aSeed.y + aSeed.x * 40.0) * 1.5, sin(uTime * 1.1 + aSeed.x * 20.0) * 0.4, cos(uTime * 0.5 * aSeed.y + aSeed.x * 33.0) * 1.2);
    float blink = pow(max(0.0, sin(uTime * 2.0 * aSeed.y + aSeed.x * 60.0)), 3.0);
    vAlpha = blink * uNight;
    vTint = vec3(0.75, 1.0, 0.45) * 3.0;
  }
  vKind = kind;
  vUv = position.xy + 0.5;
  vec3 wp = p + (uCamRight * position.x + uCamUp * position.y) * size;
  vClip = projectionMatrix * viewMatrix * vec4(wp, 1.0);
  gl_Position = vClip;
}
`;

export const PARTICLE_FRAG = /* glsl */ `
precision highp float;
${COMMON}
uniform sampler2D tDepth;
uniform vec3 uLight;
uniform vec3 uClip;
in vec2 vUv;
in float vAlpha;
in vec3 vTint;
in float vKind;
in vec4 vClip;
layout(location = 0) out vec4 outColor;
void main() {
  vec2 c = vUv - 0.5;
  float d = dot(c, c) * 4.0;
  float a;
  if (vKind > 2.5 && vKind < 3.5) {
    // petal: little ellipse
    vec2 q = vec2(c.x * 1.6, c.y);
    a = smoothstep(0.25, 0.18, length(q));
  } else if (vKind > 4.5) {
    // four-point star
    vec2 q = abs(c) * 2.0;
    a = max(smoothstep(0.12, 0.0, q.x * q.y * 6.0) * smoothstep(1.0, 0.2, q.x + q.y), exp(-d * 9.0));
  } else {
    a = exp(-d * 2.6) * (1.0 - smoothstep(0.7, 1.0, d));
  }
  a *= vAlpha;
  // soft depth fade against the scene
  vec2 suv = vClip.xy / vClip.w * 0.5 + 0.5;
  float sd = texture(tDepth, suv).r;
  float pz = vClip.z / vClip.w * 0.5 + 0.5;
  float lz = linZ(pz, uClip);
  a *= clamp((linZ(sd, uClip) - lz) * 2.25, 0.0, 1.0);
  // in first person, don't let a puff of steam fill the screen
  if (uClip.z > 0.5) a *= smoothstep(0.35, 1.3, lz);
  vec3 col = vTint * (vKind > 3.5 ? vec3(1.0) : uLight);
  if (vKind > 4.5) { outColor = vec4(col * a, a * 0.5); return; }
  outColor = vec4(col * a, a);
}
`;

export const BLOB_VERT = /* glsl */ `
in vec4 aBlob; // x, y, z, strength
in float aRadius;
out vec2 vUv;
out float vStrength;
void main() {
  vUv = position.xz * 2.0;
  vStrength = aBlob.w;
  vec3 wp = aBlob.xyz + vec3(position.x * aRadius, 0.02, position.z * aRadius);
  gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
}
`;

export const BLOB_FRAG = /* glsl */ `
precision highp float;
in vec2 vUv;
in float vStrength;
layout(location = 0) out vec4 outColor;
void main() {
  float d = length(vUv);
  float a = smoothstep(1.0, 0.2, d) * vStrength;
  outColor = vec4(0.0, 0.0, 0.0, a);
}
`;
