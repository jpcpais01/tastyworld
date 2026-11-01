// Bundled into a blank page by music-preview.ts: renders a city's lo-fi offline through the game's music chain.
import { Lofi } from '../src/game/music/lofi';
import { LOFI } from '../src/game/music/tunes';
import { impulse } from '../src/game/synth';
import type { CityId } from '../src/world/cityId';

async function renderLofi(city: CityId, night: number, secs: number, solo = '', sr = 44100): Promise<string> {
  const ctx = new OfflineAudioContext(2, Math.ceil(secs * sr), sr);
  // the game's bus: music volume -> tone -> level -> compressor, plus the shared room reverb
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 3; comp.attack.value = 0.01; comp.release.value = 0.25;
  const master = ctx.createGain(); master.gain.value = 0.9; master.connect(comp); comp.connect(ctx.destination);
  const verb = ctx.createConvolver(); verb.buffer = impulse(ctx, 1.6);
  const vg = ctx.createGain(); vg.gain.value = 0.32; verb.connect(vg).connect(master);
  const level = ctx.createGain(); level.gain.value = 0.36; level.connect(master);
  const send = ctx.createGain(); send.gain.value = 0.55; level.connect(send).connect(verb);
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 9000; tone.Q.value = 0.4; tone.connect(level);
  const vol = ctx.createGain(); vol.gain.value = 0.64; vol.connect(tone);
  const music = new Lofi(ctx, vol, LOFI[city]);
  music.prepare(night);
  if (solo) { // mix check: silence every channel but one ('vinyl' for the record alone)
    const m = music as unknown as { ch: Record<string, AudioNode>; vinyl: GainNode };
    for (const [k, n] of Object.entries(m.ch)) if (k !== solo) n.disconnect();
    if (solo !== 'vinyl') m.vinyl.disconnect();
  }
  for (let t = 0; t < secs; t += 0.1) {
    ctx.suspend(t).then(() => { music.tick(ctx.currentTime, night); return ctx.resume(); });
  }
  const buf = await ctx.startRendering();
  const L = buf.getChannelData(0), R = buf.getChannelData(1), n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); out.setUint32(4, 36 + n * 4, true); str(8, 'WAVE'); str(12, 'fmt ');
  out.setUint32(16, 16, true); out.setUint16(20, 1, true); out.setUint16(22, 2, true); out.setUint32(24, sr, true);
  out.setUint32(28, sr * 4, true); out.setUint16(32, 4, true); out.setUint16(34, 16, true); str(36, 'data'); out.setUint32(40, n * 4, true);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
    out.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
  }
  const bytes = new Uint8Array(out.buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
(window as unknown as { renderLofi: typeof renderLofi }).renderLofi = renderLofi;
