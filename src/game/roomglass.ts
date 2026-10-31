import * as THREE from 'three';
import type { SharedUniforms } from '../engine/renderer';
import type { Pane } from '../world/hotels';

/**
 * Window glass seen from inside a hotel room. The room's own glass voxels are drawn clear (uClearGlass in
 * VOXEL_FRAG), and a few quads lie on the outer face of each opening instead: about 90% clear head on, a faint
 * cool tint, a soft streak, and more reflection at a glancing angle, the way a real pane reads from a room.
 * The quads sit behind the window wall's inner faces, so frames and mullions hide them where they should.
 * Nothing of this exists outside a room.
 */
export class RoomGlass {
  private mesh: THREE.Mesh | null = null;
  private mat: THREE.ShaderMaterial;

  constructor(private scene: THREE.Scene, private shared: SharedUniforms) {
    const u = shared;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uSkyColor: u.uSkyColor, uFogColor: u.uFogColor, uSunColor: u.uSunColor, uSunDir: u.uSunDir, uNight: u.uNight, uWindowColor: u.uWindowColor },
      vertexShader: /* glsl */ `
        attribute vec3 aN;
        varying vec3 vW;
        varying vec3 vN;
        void main() {
          vec4 w = modelMatrix * vec4(position, 1.0);
          vW = w.xyz; vN = aN;
          gl_Position = projectionMatrix * viewMatrix * w;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uSkyColor, uFogColor, uSunColor, uSunDir, uWindowColor;
        uniform float uNight;
        varying vec3 vW;
        varying vec3 vN;
        vec3 srgb2lin(vec3 c) { return c * (c * (c * 0.305306011 + 0.682171111) + 0.012522878); }
        void main() {
          vec3 V = isOrthographic ? -vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : normalize(vW - cameraPosition);
          float c = abs(dot(V, vN));
          float fres = 0.04 + 0.96 * pow(1.0 - c, 5.0);
          // what the pane gives back from inside: the room, warm under its lamps at night, dim by day
          vec3 room = uSkyColor * 0.25 + uWindowColor * 0.18 * uNight;
          vec3 tint = srgb2lin(vec3(0.82, 0.9, 0.92)) * (uSkyColor * 0.6 + uSunColor * 0.25);
          // one soft diagonal smear across the pane
          float s = dot(vW, vec3(vN.z, 1.6, -vN.x));
          float streak = smoothstep(0.75, 1.0, sin(s * 2.1) * 0.5 + 0.5) * 0.035;
          float a = 0.08 + streak + 0.55 * fres;
          vec3 col = mix(tint, room, clamp(fres * 1.6, 0.0, 1.0));
          gl_FragColor = vec4(col, a);
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
    if (!panes?.length) return;
    const pos: number[] = [], nrm: number[] = [], idx: number[] = [];
    const E = 0.01; // a hair out from the glass voxels' outer face
    for (const p of panes) {
      const ox = p.nx * E, oz = p.nz * E, i = pos.length / 3;
      pos.push(p.x0 + ox, p.y0, p.z0 + oz, p.x1 + ox, p.y0, p.z1 + oz, p.x1 + ox, p.y1, p.z1 + oz, p.x0 + ox, p.y1, p.z0 + oz);
      for (let k = 0; k < 4; k++) nrm.push(p.nx, 0, p.nz);
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
    g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
    this.scene.add(this.mesh);
  }

  /** In the iso view the cutaway may lower the window wall, so the panes only hang there in first person. */
  show(on: boolean): void {
    if (this.mesh) this.mesh.visible = on;
  }
}
