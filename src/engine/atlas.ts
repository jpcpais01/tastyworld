import * as THREE from 'three';
import { ATLAS_PLANES, type Atlas } from '../world/mesher';

/**
 * The texture an atlas mesh reads its light and colours from (see AtlasBlocks in world/mesher.ts), sent to the
 * GPU now: uploading it in the middle of a pass would unbind whatever another sampler had on the unit three
 * uploads through.
 */
export function atlasTexture(r: THREE.WebGLRenderer, a: Atlas): THREE.DataTexture {
  const t = new THREE.DataTexture(a.data, a.width, a.height * ATLAS_PLANES, THREE.RGBAFormat, THREE.UnsignedByteType);
  // corners are blended by the hardware filter; a quad never reads past its own block, so no mipmaps
  t.magFilter = t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  // the GPU keeps its copy
  t.onUpdate = () => { (t.image as { data: unknown }).data = null; };
  r.initTexture(t);
  return t;
}

interface Props { get(o: object): { currentProgram?: { getUniforms(): { map: Record<string, { cache: number[] } | undefined> } }; __webglTexture?: WebGLTexture } }

/**
 * Hands a draw its mesh's atlas. Hundreds of chunks share each material, and marking the material's uniforms
 * dirty for every draw would make three send all of them again, so the texture goes straight to the unit
 * three gave the material's tAtlas sampler. A draw that switches material uploads every uniform anyway,
 * tAtlas (set here first) included, which also covers a program's very first draw.
 */
function bindAtlas(r: THREE.WebGLRenderer, material: THREE.Material, tex: THREE.Texture): void {
  const u = (material as THREE.ShaderMaterial).uniforms?.tAtlas;
  if (!u) return; // a depth pass
  u.value = tex;
  const props = r.properties as unknown as Props;
  const unit = props.get(material).currentProgram?.getUniforms().map.tAtlas?.cache[0];
  const gt = props.get(tex).__webglTexture;
  if (unit === undefined || !gt) return;
  const gl = r.getContext();
  r.state.bindTexture(gl.TEXTURE_2D, gt, gl.TEXTURE0 + unit);
}

/** Makes `mesh` draw with the atlas texture (kept in userData.atlas; whoever disposes the geometry disposes it). */
export function useAtlas(mesh: THREE.Mesh, tex: THREE.Texture): void {
  const before = mesh.onBeforeRender;
  mesh.userData.atlas = tex;
  mesh.onBeforeRender = function (r, scene, camera, geometry, material, group) {
    before.call(this, r, scene, camera, geometry, material, group);
    bindAtlas(r, material, tex);
  };
}
