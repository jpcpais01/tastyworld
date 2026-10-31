import { meshGrid, mergeMeshes, STRIDE, type MeshData } from './mesher';
import { PROP_SCALE } from './charparts';
import type { CharModel } from './characters';

/** The one mesh a character is drawn with: its body, its joint caps and the prop in its hand. */
export function meshBody(model: CharModel): MeshData {
  const opts = { pal: model.pal, scale: model.scale, origin: model.origin };
  let md = meshGrid({ ...opts, grid: model.grid, parts: model.parts });
  if (model.caps) {
    // shrink the joint caps a hair towards their hinge so they never z-fight the limb they hide in
    const cm = meshGrid({ ...opts, grid: model.caps.grid, parts: model.caps.parts });
    for (let v = 0; v < cm.vertexCount; v++) {
      const c = model.pivots[cm.attrs[v * STRIDE + 3]] ?? [0, 0, 0];
      for (let k = 0; k < 3; k++) cm.positions[v * 3 + k] = c[k] + (cm.positions[v * 3 + k] - c[k]) * 0.96;
    }
    md = mergeMeshes([md, cm]) ?? md;
  }
  if (model.prop) {
    const pm = meshGrid({ pal: model.pal, scale: PROP_SCALE, origin: model.prop.origin, grid: model.prop.grid, parts: model.prop.parts });
    md = mergeMeshes([md, pm]) ?? md;
  }
  return md;
}
