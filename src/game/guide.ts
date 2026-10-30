import * as THREE from 'three';

const BEAM_VERT = /* glsl */ `
out vec2 vUv;
out float vFacing;
void main() {
  vUv = uv;
  vec3 n = normalize(normalMatrix * normal);
  vFacing = abs(n.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const BEAM_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFade;
in vec2 vUv;
in float vFacing;
out vec4 fragColor;
void main() {
  float h = vUv.y;
  float a = pow(1.0 - h, 1.3) * pow(vFacing, 1.2);
  a *= 0.55 + 0.25 * sin(uTime * 2.6 - h * 18.0) + 0.2 * sin(uTime * 1.3 + h * 7.0);
  vec3 c = mix(vec3(1.0, 0.62, 0.22), vec3(1.0, 0.9, 0.6), h);
  fragColor = vec4(c * 3.2, min(1.0, a * 1.3) * uFade);
}`;

const RING_VERT = /* glsl */ `
out vec2 vP;
void main() {
  vP = position.xy;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const RING_FRAG = /* glsl */ `
uniform float uTime;
uniform float uFade;
in vec2 vP;
out vec4 fragColor;
void main() {
  float r = length(vP);
  float a = 0.0;
  for (int i = 0; i < 2; i++) {
    float t = fract(uTime * 0.55 + float(i) * 0.5);
    float rr = 0.35 + t * 1.15;
    a += smoothstep(0.09, 0.0, abs(r - rr)) * (1.0 - t);
  }
  a += smoothstep(0.42, 0.3, r) * 0.35;
  fragColor = vec4(vec3(1.0, 0.7, 0.3) * 2.0, a * uFade);
}`;

/**
 * The on-world guide marker for the pin set on the city map: a tall soft column of warm light you can
 * see over the rooftops, and rings that pulse on the ground where it stands.
 */
export class Beacon {
  readonly group = new THREE.Group();
  private uni = { uTime: { value: 0 }, uFade: { value: 0 } };
  private on = false;

  constructor(scene: THREE.Scene) {
    const blend = {
      transparent: true, depthWrite: false, blending: THREE.CustomBlending,
      blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor,
    } as const;
    const beamGeo = new THREE.CylinderGeometry(0.34, 0.62, 22, 18, 1, true);
    beamGeo.translate(0, 11, 0);
    const beam = new THREE.Mesh(beamGeo, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, uniforms: this.uni, side: THREE.DoubleSide, ...blend }));
    const ringGeo = new THREE.PlaneGeometry(3.4, 3.4);
    ringGeo.rotateX(-Math.PI / 2);
    // the plane's local xy becomes the ground's xz once rotated; keep the shader's coordinates flat
    const ring = new THREE.Mesh(ringGeo, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: RING_VERT.replace('position.xy', 'position.xz'), fragmentShader: RING_FRAG, uniforms: this.uni, ...blend }));
    ring.position.y = 0.04;
    beam.renderOrder = ring.renderOrder = 12;
    beam.frustumCulled = ring.frustumCulled = false;
    this.group.add(beam, ring);
    this.group.visible = false;
    scene.add(this.group);
  }

  set(x: number, y: number, z: number): void {
    this.group.position.set(x, y, z);
    this.on = true;
  }

  clear(): void { this.on = false; }

  /** dist: how far the player is, so the column thins out when you are standing in it. */
  update(dt: number, dist: number, show: boolean): void {
    this.uni.uTime.value += dt;
    const target = this.on && show ? Math.min(1, 0.25 + dist / 10) : 0;
    const f = this.uni.uFade;
    f.value += (target - f.value) * Math.min(1, dt * 4);
    this.group.visible = f.value > 0.01;
  }
}
