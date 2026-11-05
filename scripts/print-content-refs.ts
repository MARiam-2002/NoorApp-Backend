/**
 * Authoring helper: prints verbatim ayat and checks hadith phrases before they go into learning content.
 *   npx tsx scripts/print-content-refs.ts 2:30-33 "b:طوله ستون ذراعا" "m:فصامه موسى شكرا"
 */
import { ayahText } from './lib/quran-lookup';
import { findSahihPhrase } from './lib/sahihayn-lookup';
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('b:') || arg.startsWith('m:')) {
    const [c, phrase] = [arg[0] === 'b' ? 'bukhari' : 'muslim', arg.slice(2)] as const;
    const m = findSahihPhrase(c as any, phrase);
    console.log(`${c} «${phrase}» -> ${m.map(x => x.number).join(', ') || 'NOT FOUND'}`);
    continue;
  }
  const [s, r] = arg.split(':'); const [a, b] = r.split('-').map(Number);
  for (let i = a; i <= (b || a); i++) console.log(`${s}:${i} ${ayahText(Number(s), i)}`);
}
