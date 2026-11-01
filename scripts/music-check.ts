/**
 * Checks every city's lo-fi score: melodies fall on whole bars and match their part's length, chords and notes
 * parse, rhythm patterns are one or two bars long. Run: npx tsx scripts/music-check.ts
 */
import { LOFI } from '../src/game/music/tunes';
import { chord, melody } from '../src/game/music/score';

let problems = 0;
const bad = (where: string, what: string) => { problems++; console.log(`  ✗ ${where}: ${what}`); };
const pattern = (where: string, p: string, ok: RegExp) => {
  if (p.length !== 16 && p.length !== 32) bad(where, `pattern is ${p.length} long`);
  if (!ok.test(p)) bad(where, `odd characters in "${p}"`);
};

for (const [city, tunes] of Object.entries(LOFI)) {
  for (const [when, t] of Object.entries(tunes)) {
    const at = `${city} ${when} (${t.title})`;
    console.log(at);
    t.chords.forEach((c, i) => { if (chord(c).some(Number.isNaN)) bad(at, `chord ${i} "${c}"`); });
    pattern(`${at} bass`, t.bass, /^[Rr5ObA.]+$/);
    for (const [name, g] of Object.entries(t.grooves)) for (const [d, p] of Object.entries(g)) pattern(`${at} groove ${name}.${d}`, p!, /^[1-9.]+$/);
    t.parts.forEach((p, i) => {
      const w = `${at} part ${i}`;
      if (p.prog.some((c) => c < 0 || c >= t.chords.length)) bad(w, 'chord index out of range');
      if (p.groove && !t.grooves[p.groove]) bad(w, `no groove "${p.groove}"`);
      if (p.bass) pattern(`${w} bass`, p.bass, /^[Rr5ObA.]+$/);
      for (const c of p.comp) pattern(`${w} ${c.voice}`, c.pat, c.style === 'pick' ? /^[T0-3.]+$/ : c.style === 'strum' ? /^[DUdu.]+$/ : /^[XxP.]+$/);
      for (const l of [p.lead, p.second]) if (l) {
        const m = melody(l.mel);
        m.errors.forEach((e) => bad(`${w} ${l.voice}`, e));
        if (m.bars.length !== p.prog.length) bad(`${w} ${l.voice}`, `${m.bars.length} bars of melody over ${p.prog.length} of chords`);
      }
    });
    if (t.loopFrom >= t.parts.length) bad(at, 'loopFrom past the end');
  }
}
console.log(problems ? `${problems} problem(s)` : 'all scores ok');
process.exit(problems ? 1 : 0);
