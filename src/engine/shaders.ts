// GLSL 3.00 ES shaders (three.js ShaderMaterial with glslVersion = GLSL3).

export const COMMON = /* glsl */ `
vec3 srgb2lin(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), u.x), mix(hash12(i + vec2(0, 1)), hash12(i + vec2(1, 1)), u.x), u.y);
}
`;

const VOXEL_SCALES = `const float SCALES[8] = float[8](0.25, 0.125, 0.0625, 0.075, 0.025, 0.05, 0.1, 0.5);`;

export const VOXEL_VERT = /* glsl */ `
in vec4 aPack;
in vec4 aColor;
in vec4 aLight;
in vec4 aQuad;
uniform float uTime;
#ifdef CHARACTER
uniform vec3 uPivot[8];
uniform vec2 uRot[8];
uniform float uBob;
#endif
#ifdef SWAY
uniform float uSway;
#endif
${VOXEL_SCALES}
flat out vec3 vNormal;
flat out vec4 vEdge;
flat out float vScale;
flat out float vVary;
out vec3 vWorld;
out vec3 vCell;
out vec4 vColor;
out vec4 vLight;
out vec4 vQuad;
out float vAO;
out float vSky;

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

void main() {
  float face = mod(aPack.x, 8.0);
  float sIdx = floor(aPack.x / 8.0 + 0.01);
  vScale = SCALES[int(sIdx)];
  vec3 n = faceNormal(face);
  float edges = mod(aPack.z, 16.0);
  vVary = floor(aPack.z / 16.0 + 0.01) * 0.02;
  vEdge = vec4(mod(edges, 2.0), mod(floor(edges / 2.0), 2.0), mod(floor(edges / 4.0), 2.0), floor(edges / 8.0));
  vCell = position - n * (0.5 * vScale);
  vec3 p = position;
#ifdef CHARACTER
  int part = int(aPack.w + 0.5);
  if (part > 0) {
    mat3 R = rotY(uRot[part].y) * rotX(uRot[part].x);
    p = R * (p - uPivot[part]) + uPivot[part];
    n = R * n;
  }
  p.y += uBob;
  vSky = 1.0;
#else
  vSky = aPack.w / 255.0;
#endif
#ifdef SWAY
  // hanging things sway gently around their top
  float h = clamp((uSway - p.y) * 0.6, 0.0, 1.0);
  p.x += sin(uTime * 1.3 + p.z * 0.7) * 0.03 * h;
#endif
#ifdef USE_INSTANCING
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * n);
#else
  vec4 wp = modelMatrix * vec4(p, 1.0);
  vNormal = normalize(mat3(modelMatrix) * n);
#endif
  vWorld = wp.xyz;
  vColor = aColor;
  vLight = aLight;
  vQuad = aQuad;
  vAO = aPack.y / 255.0;
  gl_Position = projectionMatrix * viewMatrix * wp;
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
uniform float uLamp;
uniform float uNight;
uniform float uEmitDay;
uniform float uTime;
uniform float uCloud;
uniform vec4 uBounds; // x0, z0, x1, z1 of the playable map (fade outside)
#ifdef CHARACTER
uniform vec3 uCharLight; // sun, sky, highlight
uniform vec3 uCharLamp;
uniform float uFlash;
#endif
#ifdef CUTAWAY
uniform vec3 uCutPos;      // player feet
uniform vec3 uCamFwd;
uniform float uCutRadius;  // radius of the sliced area around the player (m)
uniform float uCutH;       // world height of the slicing plane
uniform float uCutOn;      // 0..1 fade
uniform sampler2D tHeight; // per-column top of the solid run that starts at street level (0.25 m units)
uniform vec4 uHeightRect;  // origin x, z and 1 / extent x, z (metres)
uniform mat4 uViewProj;
float solidTop(vec2 xz) {
  vec2 uv = (xz - uHeightRect.xy) * uHeightRect.zw;
  if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return -100.0;
  return texture(tHeight, uv).r * 255.0 * 0.25;
}
#endif
flat in vec3 vNormal;
flat in vec4 vEdge;
flat in float vScale;
flat in float vVary;
in vec3 vWorld;
in vec3 vCell;
in vec4 vColor;
in vec4 vLight;
in vec4 vQuad;
in float vAO;
in float vSky;
layout(location = 0) out vec4 outColor;

float bayer4(vec2 p) {
  ivec2 q = ivec2(mod(p, 4.0));
  int i = q.x + q.y * 4;
  int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
  return (float(m[i]) + 0.5) / 16.0;
}

void main() {
#ifdef CUTAWAY
  // Slice everything between the camera and the player's surroundings down to a plane just above
  // the street. Where the view ray enters solid building mass at that plane, draw a section cap;
  // where it does not, discard so the street behind shows through.
  bool capped = false;
  vec3 capP = vec3(0.0);
  if (uCutOn > 0.001 && vWorld.y > uCutH) {
    vec3 P = vWorld + uCamFwd * ((vWorld.y - uCutH) / max(0.05, -uCamFwd.y));
    // radius is measured where the ray meets the plane (what the fragment hides); front/back is measured
    // at the fragment itself, so facades behind the player are never touched
    vec2 rel = P.xz - uCutPos.xz;
    float along = dot(vWorld.xz - uCutPos.xz, normalize(uCamFwd.xz));
    float k = uCutOn * (1.0 - smoothstep(uCutRadius * 0.82, uCutRadius, length(rel))) * (1.0 - smoothstep(0.15, 0.75, along));
    if (k > bayer4(gl_FragCoord.xy)) {
      if (solidTop(P.xz) > uCutH + 0.04) { capped = true; capP = P; }
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
  // drifting cloud shadows
  float cloud = 1.0;
  if (uCloud > 0.0) {
    vec2 cp = vWorld.xz * 0.045 + vec2(uTime * 0.012, uTime * 0.006);
    cloud = 1.0 - uCloud * smoothstep(0.45, 0.75, vnoise(cp) * 0.65 + vnoise(cp * 2.3) * 0.35);
  }
  vec3 hemi = mix(uGroundColor, uSkyColor, n.y * 0.5 + 0.5);
  vec3 direct = uSunColor * ndl * sun * cloud * (0.6 + 0.4 * ao);
  vec3 ambient = hemi * ao * (0.25 + 0.75 * sky);
  vec3 lamp = lampL * uLamp * (0.45 + 0.55 * ao);
  vec3 col = albedo * (direct + ambient + lamp);

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
  vec4 d4 = mix(vec4(1e3), vQuad, vEdge);
  float d = min(min(d4.x, d4.y), min(d4.z, d4.w));
  float fw = fwidth(vQuad.x + vQuad.z) * 0.7;
  float edge = 1.0 - smoothstep(0.0, 0.16 + fw, d);
  col *= 1.0 + edge * 0.28 * (0.35 + 0.65 * ao);

#ifdef CHARACTER
  col += albedo * uFlash;
#endif
  // fade into the haze outside the playable map
  vec2 outside = max(uBounds.xy - vWorld.xz, vWorld.xz - uBounds.zw);
  float fo = smoothstep(0.0, 9.0, max(outside.x, outside.y));
  col = mix(col, uFogColor, fo);
#ifdef CUTAWAY
  if (capped) {
    // section cap: dark poché with faint voxel grid and a warm outline along the walls
    float e = 0.0, o = 0.07, th = uCutH + 0.04;
    e += step(solidTop(capP.xz + vec2(o, 0.0)), th);
    e += step(solidTop(capP.xz - vec2(o, 0.0)), th);
    e += step(solidTop(capP.xz + vec2(0.0, o)), th);
    e += step(solidTop(capP.xz - vec2(0.0, o)), th);
    vec2 gq = abs(fract(capP.xz * 4.0) - 0.5);
    float grid = step(0.44, max(gq.x, gq.y));
    vec3 lightC = uSkyColor * 0.55 + uSunColor * 0.22 + uLamp * vec3(0.25, 0.16, 0.08);
    vec3 base = srgb2lin(vec3(0.3, 0.26, 0.28)) * (1.0 + grid * 0.35 + (rnd - 0.5) * 0.06);
    col = base * (0.35 + lightC);
    col = mix(col, srgb2lin(vec3(0.98, 0.86, 0.68)) * (0.45 + lightC * 0.6), min(1.0, e) * 0.9);
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
 * light shafts, and the surface gets refraction, screen-space reflections, fresnel, foam and sun glints.
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
in vec2 vUv;
layout(location = 0) out vec4 outColor;

vec3 worldAt(vec2 uv, float depth) {
  vec4 p = uInvViewProj * vec4(uv * 2.0 - 1.0, depth * 2.0 - 1.0, 1.0);
  return p.xyz / p.w;
}

// analytic water surface: sum of directional waves with derivatives
vec3 waterNormal(vec2 p, float t) {
  vec2 g = vec2(0.0);
  vec4 dirs[5];
  dirs[0] = vec4(normalize(vec2(1.0, 0.3)), 1.6, 0.035);
  dirs[1] = vec4(normalize(vec2(-0.6, 1.0)), 2.3, 0.025);
  dirs[2] = vec4(normalize(vec2(0.8, -0.9)), 3.7, 0.016);
  dirs[3] = vec4(normalize(vec2(-1.0, -0.2)), 5.9, 0.010);
  dirs[4] = vec4(normalize(vec2(0.2, 1.0)), 9.1, 0.006);
  for (int i = 0; i < 5; i++) {
    float k = dirs[i].z;
    float ph = dot(dirs[i].xy, p) * k + t * sqrt(9.8 * k) * 0.55;
    g += dirs[i].xy * k * dirs[i].w * cos(ph);
  }
  // fine ripples
  vec2 q = p * 3.0 + vec2(t * 0.4, -t * 0.3);
  float e = 0.03;
  float n0 = vnoise(q), nx = vnoise(q + vec2(e, 0.0)), nz = vnoise(q + vec2(0.0, e));
  g += vec2(nx - n0, nz - n0) / e * 0.012;
  return normalize(vec3(-g.x, 1.0, -g.y));
}

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

vec3 skyColor(vec3 dir) {
  float t = clamp(dir.y * 0.8 + 0.25, 0.0, 1.0);
  return mix(uSkyHorizon, uSkyTop, t);
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

  if (depth >= 0.99999) {
    // background haze gradient
    col = mix(uSkyHorizon, uSkyTop, smoothstep(-0.2, 1.2, uv.y));
  } else if (wpos.y < uWaterY - 0.004 && wpos.x > uWaterBounds.x && wpos.x < uWaterBounds.z && wpos.z > uWaterBounds.y && wpos.z < uWaterBounds.w) {
    vec3 rd = normalize(uCamFwd);
    vec3 near = worldAt(uv, 0.0);
    float tPlane = (uWaterY - near.y) / rd.y;
    vec3 sp = near + rd * tPlane;
    vec3 nrm = waterNormal(sp.xz, uTime);
    // refraction
    vec2 ruv = uv + nrm.xz * 0.035 * clamp(uWaterY - wpos.y, 0.0, 1.0) * vec2(1.0, uRes.x / uRes.y) * 0.6;
    float rdepth = texture(tDepth, ruv).r;
    vec3 rpos = worldAt(ruv, rdepth);
    if (rpos.y > uWaterY || rdepth >= 0.99999) { ruv = uv; rpos = wpos; }
    vec3 floorCol = texture(tScene, ruv).rgb;
    float pathLen = max(0.0, length(rpos - sp));
    float vDepth = max(0.0, uWaterY - rpos.y);
    // caustics on the floor
    vec2 cpos = rpos.xz + uSunDir.xz / max(uSunDir.y, 0.2) * vDepth;
    float cs = caustic(cpos, uTime) * exp(-vDepth * 0.9) * length(uSunColor) * 0.55;
    floorCol *= 1.0 + cs;
    // absorption + scattering
    vec3 absorb = vec3(0.55, 0.16, 0.10) * 1.15;
    vec3 trans = exp(-absorb * pathLen);
    vec3 scatterLight = uWaterScatter * (0.35 + 0.65 * clamp(length(uSunColor), 0.0, 1.5));
    vec3 under = floorCol * trans + scatterLight * (1.0 - exp(-pathLen * 0.85));
    under = mix(under, uWaterDeep, 1.0 - exp(-pathLen * 0.35));
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
        if (sd < rz && rz - sd < 0.02) {
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
    float spec = pow(max(dot(nrm, hv), 0.0), 220.0) * 3.0 + pow(max(dot(nrm, hv), 0.0), 30.0) * 0.12;
    water += uSunColor * spec;
    // shoreline foam
    float foamN = vnoise(sp.xz * 4.0 + vec2(uTime * 0.25, uTime * 0.18)) * 0.6 + vnoise(sp.xz * 9.0 - uTime * 0.3) * 0.4;
    float foam = smoothstep(0.28, 0.0, vDepth + (foamN - 0.5) * 0.25) * smoothstep(0.35, 0.65, foamN + 0.25);
    water = mix(water, vec3(0.92, 0.95, 0.97) * (0.35 + 0.65 * clamp(length(uSunColor) + 0.3, 0.0, 1.2)), foam * 0.75);
    col = water;
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
uniform sampler2D tDepth;
uniform vec3 uLight;
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
  if (pz > sd + 0.0004) a = 0.0;
  else a *= clamp((sd - pz) * 900.0, 0.0, 1.0);
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
