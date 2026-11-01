import * as THREE from 'three';
import type { SharedUniforms } from '../engine/renderer';
import type { Pane } from '../world/hotels';

/**
 * Window glass seen from inside a hotel room. The room's own glass voxels are drawn clear (uClearGlass in
 * VOXEL_FRAG), and a few quads lie on the outer face of each opening instead: about 85% clear head on, a cool
 * green-grey body, light caught along the frame edges, a faint smear, the room mirrored faintly by day and as a
 * warm half mirror at night, and more of it at a glancing angle, the way a real pane reads from a room.
 * The quads sit behind the window wall's inner faces, so frames and mullions hide them where they should.
 * While the player looks out (first person), whatever stands just outside the windows is not drawn either
 * (uClearOut), so flower boxes, signs and rails don't stand in the view. Nothing of this exists outside a room.
 */
export class RoomGlass {
  private mesh: THREE.Mesh | null = null;
  /** What stands just outside the windows (flower boxes, signs, rails): hidden while looking out. */
  private out: [THREE.Vector3, THREE.Vector3] | null = null;
  private mat: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene, private shared: SharedUniforms) {
    const u = shared;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSkyColor: u.uSkyColor, uFogColor: u.uFogColor, uSunColor: u.uSunColor, uSunDir: u.uSunDir, uNight: u.uNight, uWindowColor: u.uWindowColor },
      vertexShader: /* glsl */ `
        attribute vec3 aN;
        attribute vec4 aP; // metres along the pane, metres up it, its width, its height
        varying vec3 vW;
        varying vec3 vN;
        varying vec4 vP;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = aN; vP = aP;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSkyColor, uFogColor, uSunColor, uSunDir, uWindowColor;
        uniform float uNight;
        varying vec3 vW;
        varying vec3 vN;
        varying vec4 vP;
        vec3 srgb2lin(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
        void main() {
          vec3 V = isOrthographic ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : normalize(vW - cameraPosition);
          vec3 N = vN * -sign(dot(V, vN)); // the face toward the viewer: the room side
          float c = max(dot(-V, N), 0.0);
          float fres = 0.04 + 0.96 * pow(1.0 - c, 5.0);
          vec3 R = reflect(V, N);
          vec3 T = normalize(vec3(-vN.z, 0.0, vN.x));
          // The room mirrored in the pane: lit ceiling above, darker floor below, one soft broad sheen that
          // follows the reflected direction, so it drifts across the glass as the head moves. By day the bright
          // street outshines it and it is only a hint; after dark the window turns half mirror, warm with lamps.
          vec3 lamp = uWindowColor * 0.55;
          vec3 top_ = mix(uSkyColor * 0.35 + uSunColor * 0.08, lamp, uNight);
          vec3 floor_ = top_ * 0.35;
          vec3 room = mix(floor_, top_, smoothstep(-0.35, 0.35, R.y));
          float sheen = smoothstep(0.55, 1.0, sin(dot(R, T) * 2.6 + R.y * 1.7 + 0.8) * 0.5 + 0.5);
          room *= 1.0 + sheen * 0.9;
          float rk = mix(0.05, 0.22, uNight) + 0.5 * fres + sheen * mix(0.03, 0.06, uNight);
          // the glass itself: a cool green-grey body, a little denser where the eye crosses it at a slant
          vec3 body = srgb2lin(vec3(0.74, 0.86, 0.85)) * (uSkyColor * 0.55 + uSunColor * 0.2 + uWindowColor * 0.1 * uNight);
          float bk = 0.06 + 0.08 * (1.0 - c);
          // light caught along the edges where the pane meets its frame, and a faint wiped smear across it
          float e = min(min(vP.x, vP.z - vP.x), min(vP.y, vP.w - vP.y));
          float rim = exp(-e * 22.0) * 0.16 + exp(-e * 5.0) * 0.03;
          float s = dot(vW, vec3(vN.z, 1.6, -vN.x));
          float streak = smoothstep(0.75, 1.0, sin(s * 2.1) * 0.5 + 0.5) * 0.04 * (0.5 + 0.5 * sin(vP.x * 7.3 + vP.y * 3.1));
          vec3 rimC = mix(uSkyColor + uSunColor * 0.4, lamp * 1.4, uNight);
          // the sun seen through the pane flares a little on it
          float sd = max(dot(V, uSunDir), 0.0);
          vec3 glare = uSunColor * (pow(sd, 48.0) * 0.5 + pow(sd, 8.0) * 0.06) * (1.0 - uNight);
          // premultiplied sum, then back to straight alpha for the ordinary blend
          vec3 P = body * bk + room * rk + rimC * rim + rimC * streak + glare;
          float A = clamp(bk + rk + rim * 0.6 + streak, 0.0, 0.9);
          gl_FragColor = vec4(P / max(A, 1e-3), A);
        }`,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
  }

  /** Shows the panes of the room the player has entered (null when they leave). */
  set(panes: Pane[] | null | undefined): void {
    const box = this.shared.uClearGlass.value;
    if (this.mesh) {
      this.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    box[0].set(1e9, 1e9, 1e9); box[1].set(-1e9, -1e9, -1e9);
    this.out = null;
    this.show(false);
    if (!panes?.length) return;
    // a slab in front of the openings: from a hair outside the glass to 1.3 m out, a little wider than the
    // windows, from a flower box's depth below the sills to just over the lintels
    const lo = new THREE.Vector3(1e9, 1e9, 1e9), hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const p of panes) {
      const tx = (p.x1 - p.x0), tz = (p.z1 - p.z0), tl = Math.hypot(tx, tz) || 1, sx = (tx / tl) * 0.4, sz = (tz / tl) * 0.4;
      for (const [x, z] of [[p.x0 - sx, p.z0 - sz], [p.x1 + sx, p.z1 + sz]]) for (const o of [0.02, 1.3]) {
        lo.min(new THREE.Vector3(x + p.nx * o, p.y0 - 0.7, z + p.nz * o));
        hi.max(new THREE.Vector3(x + p.nx * o, p.y1 + 0.4, z + p.nz * o));
      }
    }
    this.out = [lo, hi];
    panes = panes.filter((p) => !p.open);
    if (!panes.length) return;
    const pos: number[] = [], nrm: number[] = [], par: number[] = [], idx: number[] = [];
    const E = 0.01; // a hair out from the glass voxels' outer face
    for (const p of panes) {
      const ox = p.nx * E, oz = p.nz * E, i = pos.length / 3;
      pos.push(p.x0 + ox, p.y0, p.z0 + oz, p.x1 + ox, p.y0, p.z1 + oz, p.x1 + ox, p.y1, p.z1 + oz, p.x0 + ox, p.y1, p.z0 + oz);
      for (let k = 0; k < 4; k++) nrm.push(p.nx, 0, p.nz);
      const w = Math.hypot(p.x1 - p.x0, p.z1 - p.z0), h = p.y1 - p.y0;
      par.push(0, 0, w, h, w, 0, w, h, w, h, w, h, 0, h, w, h);
      idx.push(i, i + 1, i + 2, i, i + 2, i + 3);
      // the glass voxels behind the pane: one voxel (0.25 m) inward, a little slack round the edges
      const inX = -p.nx * 0.3, inZ = -p.nz * 0.3;
      for (const [x, z] of [[p.x0, p.z0], [p.x1, p.z1], [p.x0 + inX, p.z0 + inZ], [p.x1 + inX, p.z1 + inZ]]) {
        box[0].min(new THREE.Vector3(x - 0.02, p.y0 - 0.02, z - 0.02));
        box[1].max(new THREE.Vector3(x + 0.02, p.y1 + 0.02, z + 0.02));
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('aN', new THREE.Float32BufferAttribute(nrm, 3));
    g.setAttribute('aP', new THREE.Float32BufferAttribute(par, 4));
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.scene.add(this.mesh);
  }

  /** In the iso view the cutaway may lower the window wall, so the panes only hang there in first person. */
  show(on: boolean): void {
    if (this.mesh) this.mesh.visible = on;
    const c = this.shared.uClearOut.value;
    if (on && this.out) { c[0].copy(this.out[0]); c[1].copy(this.out[1]); }
    else { c[0].set(1e9, 1e9, 1e9); c[1].set(-1e9, -1e9, -1e9); }
  }
}
