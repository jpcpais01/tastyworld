import * as THREE from 'three';
import { makeSharedUniforms, voxelMaterial } from '../engine/renderer';
import { buildFood, FoodId } from '../world/food';
import { Palette } from '../world/palette';
import { meshGrid } from '../world/mesher';
import { geometryFrom } from '../game/actors';
import type { Prop } from '../world/props';
import { buildSouvenir } from '../world/souvenirModels';
import type { Souvenir } from '../data/souvenirs';

/**
 * Renders every dish as a little voxel diorama into a data URL, using the same voxel shader as the world
 * (ICON define = tonemapped, gamma corrected, transparent background). Runs once after loading.
 */
export function renderDishIcons(gl: THREE.WebGLRenderer, ids: FoodId[], size = 160): Record<string, string> {
  return renderPropIcons(gl, ids.map((id) => [id, (pal: Palette) => buildFood(id, pal)]), size);
}

/** Souvenirs as little voxel models on a transparent background (rendered when a shop or the bag first shows them). */
export function renderSouvenirIcons(gl: THREE.WebGLRenderer, items: Souvenir[], size = 160): Record<string, string> {
  return renderPropIcons(gl, items.map((it) => [it.id, (pal: Palette) => buildSouvenir(it.shape, it.cols, pal)]), size);
}

/** Render each voxel prop into a data URL, framed to fit, lit like a sunny afternoon. */
export function renderPropIcons(gl: THREE.WebGLRenderer, list: [string, (pal: Palette) => Prop][], size = 160): Record<string, string> {
  const out: Record<string, string> = {};
  const big = size * 2;
  const rt = new THREE.WebGLRenderTarget(big, big, { depthBuffer: true, type: THREE.UnsignedByteType });
  const shared = makeSharedUniforms();
  shared.uSunDir.value.set(0.55, 0.75, 0.35).normalize();
  shared.uSunColor.value.setRGB(1.25, 1.15, 1.0);
  shared.uSkyColor.value.setRGB(0.62, 0.66, 0.78);
  shared.uGroundColor.value.setRGB(0.42, 0.36, 0.34);
  shared.uBounds.value.set(-1e4, -1e4, 1e4, 1e4);
  shared.uCloud.value = 0;
  shared.uEmitDay.value = 0.8;
  const mat = voxelMaterial(shared, { ICON: 1 });
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 50);
  const pixels = new Uint8Array(big * big * 4);
  const cBig = document.createElement('canvas');
  cBig.width = cBig.height = big;
  const ctxBig = cBig.getContext('2d')!;
  const img = ctxBig.createImageData(big, big);
  const cSmall = document.createElement('canvas');
  cSmall.width = cSmall.height = size;
  const ctx = cSmall.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  const prevTarget = gl.getRenderTarget();
  const prevClear = new THREE.Color();
  gl.getClearColor(prevClear);
  const prevAlpha = gl.getClearAlpha();

  for (const [id, build] of list) {
    const pal = new Palette();
    const prop = build(pal);
    const md = meshGrid({ grid: prop.grid, pal, scale: prop.scale, origin: [0, 0, 0], greedy: true });
    if (!md.vertexCount) continue;
    const geo = geometryFrom(md);
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
    const box = geo.boundingBox!;
    const c = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(0.62, 0.72, 1).normalize();
    cam.position.copy(c).addScaledVector(dir, 10);
    cam.lookAt(c);
    cam.updateMatrixWorld();
    // fit the projected bounding box
    const inv = cam.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
    }
    const half = Math.max(x1 - x0, y1 - y0) * 0.56;
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    cam.left = mx - half; cam.right = mx + half; cam.top = my + half; cam.bottom = my - half;
    cam.updateProjectionMatrix();

    gl.setRenderTarget(rt);
    gl.setClearColor(0x000000, 0);
    gl.clear(true, true, false);
    gl.render(scene, cam);
    gl.readRenderTargetPixels(rt, 0, 0, big, big, pixels);
    // flip vertically into the canvas
    for (let y = 0; y < big; y++) img.data.set(pixels.subarray((big - 1 - y) * big * 4, (big - y) * big * 4), y * big * 4);
    ctxBig.putImageData(img, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.drawImage(cBig, 0, 0, size, size);
    out[id] = cSmall.toDataURL('image/png');
    scene.remove(mesh);
    geo.dispose();
  }
  gl.setRenderTarget(prevTarget);
  gl.setClearColor(prevClear, prevAlpha);
  mat.dispose();
  rt.dispose();
  return out;
}
