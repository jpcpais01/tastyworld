/**
 * Renders the lo-fi to mp3 in headless Chromium: npx tsx scripts/music-preview.ts <outDir> [seconds] [city ...]
 * Writes <city>-day.mp3 and <city>-night.mp3 (needs ffmpeg). SOLO=keys|comp|lead|bass|kit|vinyl renders one channel.
 */
import { build } from 'esbuild';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Playwright is installed globally in the dev container, so it is required rather than imported.
const { chromium } = createRequire(import.meta.url)('playwright');
const [out = 'music-preview', secsArg = '100', ...only] = process.argv.slice(2);
const secs = Number(secsArg);
const cities = only.length ? only : ['tokyo', 'amalfi', 'istanbul', 'madeira'];
mkdirSync(out, { recursive: true });
const js = (await build({ entryPoints: ['scripts/music-preview-entry.ts'], bundle: true, write: false, format: 'iife', target: 'es2020' })).outputFiles[0].text;
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage();
await page.setContent('<html><body></body></html>');
await page.addScriptTag({ content: js });
for (const city of cities) for (const [when, night] of [['day', 0], ['night', 1]] as const) {
  const t0 = Date.now();
  const solo = process.env.SOLO ?? '';
  const b64 = await page.evaluate(([c, n, s, o]) => (window as any).renderLofi(c, n, s, o), [city, night, secs, solo] as const);
  const wav = join(out, `${city}-${when}.wav`);
  writeFileSync(wav, Buffer.from(b64, 'base64'));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-b:a', '192k', join(out, `${city}-${when}.mp3`)]);
  if (!process.env.KEEP_WAV) rmSync(wav);
  console.log(`${city} ${when}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
}
await browser.close();
