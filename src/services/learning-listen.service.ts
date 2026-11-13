/**
 * «استمع» for learning items (stories, seerah, lessons): the item's own verified content as an ordered listening
 * script. The app speaks `speechAr` with the device's Arabic text-to-speech and plays ayat with the user's reciter
 * through the existing per-verse audio (never text-to-speech for the Quran). Nothing new is written here: every line
 * comes from the learning item, only reshaped for listening.
 */
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { LEARNING_COLLECTIONS_DATA } from '../shared/data/learning-content';

type Seg =
  | { type: 'title'; textAr: string; speechAr: string }
  | { type: 'narration'; textAr: string; speechAr: string }
  | { type: 'ayah'; introSpeechAr: string; surah: number; fromAyah: number; toAyah: number; referenceAr: string; verseKeys: string[] }
  | { type: 'hadith'; textAr: string; speechAr: string; referenceAr: string };

/** Text as it should be read aloud: honorific spelled out, brackets and list markers dropped. */
export function toSpeech(text: string) {
  return text
    .replace(/ﷺ/g, 'صلى الله عليه وسلم')
    .replace(/[«»"()\[\]{}﴿﴾]/g, '')
    .replace(/[—–]/g, '، ')
    .replace(/\s*…\s*/g, '، ')
    .replace(/\s+/g, ' ')
    .trim();
}

const AR_DIGITS = (n: number) => String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));

export function getLearningListen(itemId: string) {
  for (const c of LEARNING_COLLECTIONS_DATA) {
    const item = c.items.find(i => i.id === itemId);
    if (!item) continue;
    const segments: Seg[] = [{ type: 'title', textAr: item.titleAr, speechAr: toSpeech(item.titleAr) }];
    for (const s of item.sections) {
      segments.push({ type: 'title', textAr: s.titleAr, speechAr: toSpeech(s.titleAr) });
      for (const p of s.paragraphsAr) if (p.trim()) segments.push({ type: 'narration', textAr: p, speechAr: toSpeech(p) });
      for (const q of s.quran) {
        segments.push({ type: 'ayah', introSpeechAr: 'قال الله تعالى:', surah: q.surah, fromAyah: q.fromAyah, toAyah: q.toAyah,
          referenceAr: `[${q.surahNameAr}: ${AR_DIGITS(q.fromAyah)}${q.toAyah > q.fromAyah ? `–${AR_DIGITS(q.toAyah)}` : ''}]`,
          verseKeys: q.verses.map(v => v.verseKey) });
      }
      for (const h of s.hadith) {
        const text = h.excerptsAr.map(e => `«${e}»`).join(' … ');
        segments.push({ type: 'hadith', textAr: text, referenceAr: h.sourceAr, speechAr: toSpeech(`جاء في ${h.collectionAr}: ${h.excerptsAr.join('، ')}`) });
      }
      for (const n of s.nawawi) segments.push({ type: 'hadith', textAr: n.textAr, referenceAr: n.sourceAr, speechAr: toSpeech(n.textAr) });
      if (s.reflectionAr?.trim()) segments.push({ type: 'narration', textAr: s.reflectionAr, speechAr: toSpeech(s.reflectionAr) });
    }
    // Rough length so the app can show "١٢ دقيقة": ~13 spoken characters a second, ~9 seconds per recited ayah.
    const speechChars = segments.reduce((a, s) => a + ('speechAr' in s ? s.speechAr.length : s.introSpeechAr.length), 0);
    const ayat = segments.reduce((a, s) => a + (s.type === 'ayah' ? s.toAyah - s.fromAyah + 1 : 0), 0);
    return { itemId: item.id, collectionId: c.id, titleAr: item.titleAr, estimatedSeconds: Math.round(speechChars / 13 + ayat * 9),
      ttsLanguage: 'ar', segments };
  }
  throw new AppError('Item not found', 404, ErrorCodes.NOT_FOUND);
}
