import type { Quality } from './renderer';

/**
 * Which graphics quality "Auto" starts at on this device.
 *
 * Integrated and software GPUs start on Low: they share memory bandwidth with the CPU and choke on the
 * full-screen water and the multisampled HDR target long before the triangle count matters. The stronger
 * integrated chips (Radeon 680M/780M/890M, Intel Arc and Iris Xe) start on Medium and fall to Low on their
 * own if the frame rate says so. Phones keep Medium; everything else starts on High.
 *
 * Once the frame rate has made Auto step down on a GPU, that step is remembered for that GPU, so the next
 * visit starts where it settled instead of stuttering through the drop again.
 */
const KEY = 'tastyworld.autoTier';

let cached: string | null = null;

/** The GPU's name as the browser reports it ('' when hidden). */
export function gpuName(): string {
  if (cached !== null) return cached;
  cached = '';
  try {
    // ask for the same GPU the game will (a laptop with two picks the strong one for 'high-performance')
    const gl = document.createElement('canvas').getContext('webgl2', { powerPreference: 'high-performance' });
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      cached = String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { /* no name: judge by the frame rate alone */ }
  return cached;
}

/** The tier a GPU name suggests, before any frame has been timed. */
export function guessTier(name: string, mobile: boolean): Quality {
  const n = name.toLowerCase();
  if (/swiftshader|llvmpipe|softpipe|software|basic render/.test(n)) return 'low';
  if (mobile) return 'medium';
  // discrete cards first, so "Radeon RX" or "Arc A770" never read as integrated
  if (/geforce|nvidia|quadro|rtx|radeon rx|radeon pro|arc\(tm\) a\d|arc a\d/.test(n)) return 'high';
  if (/radeon\(tm\) (680|780|880|890)m|radeon (680|780|880|890)m|arc\(tm\) graphics|iris\(r\) xe|iris xe/.test(n)) return 'medium';
  if (/intel|uhd|iris|hd graphics|radeon\(tm\) graphics|radeon graphics|vega \d|radeon\(tm\) r\d|mali|adreno|powervr/.test(n)) return 'low';
  return 'high';
}

/** The tier Auto runs at on this device now. */
export function autoTier(mobile: boolean): Quality {
  const name = gpuName();
  const guess = guessTier(name, mobile);
  try {
    const s = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { gpu: string; tier: Quality } | null;
    if (s && s.gpu === name && rank(s.tier) < rank(guess)) return s.tier;
  } catch { /* storage off: the guess stands */ }
  return guess;
}

/** Remember that Auto had to step down to `tier` on this GPU. */
export function rememberTier(tier: Quality): void {
  try { localStorage.setItem(KEY, JSON.stringify({ gpu: gpuName(), tier })); } catch { /* storage off */ }
}

export const rank = (q: Quality) => (q === 'low' ? 0 : q === 'medium' ? 1 : 2);
export const lower = (q: Quality): Quality => (q === 'high' ? 'medium' : 'low');
