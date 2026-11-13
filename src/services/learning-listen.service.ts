/**
 * «استمع» for learning items: an ordered listening script built only from published sources.
 *
 * - Stories, seerah, aqeedah, al-asma al-husna and an-Nawawi's Forty (mode SOURCES): the ayat are recited by the user's
 *   reciter, then «التفسير الميسر» (King Fahd Complex) for exactly those ayat is read, then the hadith from Sahih
 *   al-Bukhari / Sahih Muslim / an-Nawawi's Forty word for word. Noor's own retelling is not read.
 * - Fiqh and tajweed lessons (mode LESSON) also need their explanation; those lines are marked `editorial: true` so the
 *   app labels them «صياغة تعليمية من نور». Fiqh ayat are followed by the tafsir; tajweed ayat are rule examples only.
 *
 * The app speaks `speechAr` with the device's Arabic text-to-speech. Ayat are always played with the reciter through the
 * existing per-verse audio — never by text-to-speech — and Quran words quoted inside the tafsir are dropped from
 * `speechAr` (they stay in `textAr`), because the reciter has just recited them.
 */
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { LEARNING_COLLECTIONS_DATA } from '../shared/data/learning-content';
import { LEARNING_TAFSIR_BY_BLOCK, LEARNING_TAFSIR_PASSAGES, LEARNING_TAFSIR_SOURCE } from '../shared/data/learning-tafsir';

type Seg =
  | { type: 'title'; textAr: string; speechAr: string }
  | { type: 'narration'; textAr: string; speechAr: string; editorial: true }
  | { type: 'ayah'; introSpeechAr: string; surah: number; fromAyah: number; toAyah: number; referenceAr: string; verseKeys: string[] }
  | { type: 'tafsir'; textAr: string; speechAr: string; surah: number; fromAyah: number; toAyah: number; sourceAr: string }
  | { type: 'hadith'; textAr: string; speechAr: string; referenceAr: string };

export const LISTEN_MODE: Record<string, 'SOURCES' | 'LESSON'> = {
  'prophet-stories': 'SOURCES', seerah: 'SOURCES', aqeedah: 'SOURCES', 'asma-husna': 'SOURCES', 'nawawi-forty': 'SOURCES',
  fiqh: 'LESSON', tajweed: 'LESSON',
};
/** Collections whose ayat are followed by the tafsir (tajweed cites ayat only as examples of a rule). */
const WITH_TAFSIR = new Set(['prophet-stories', 'seerah', 'aqeedah', 'asma-husna', 'nawawi-forty', 'fiqh']);

/** Text as it should be read aloud: honorific spelled out, brackets, dashes and list markers dropped. */
export function toSpeech(text: string) {
  return text
    .replace(/ﷺ/g, 'صلى الله عليه وسلم')
    .replace(/\s-([^-\n]{1,60})-(?=\s|[،.؛:]|$)/g, '، $1،')
    .replace(/[«»"()\[\]{}﴿﴾]/g, '')
    .replace(/[—–]/g, '، ')
    .replace(/\s*…\s*/g, '، ')
    .replace(/\s+([،.؛:])/g, '$1')
    .replace(/([،؛:])\s*([،.؛:])/g, '$2')
    .replace(/^[،\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Tafsir read aloud: Quran wording quoted inside it (between ﴿ ﴾) is left to the reciter, never text-to-speech. */
export function tafsirSpeech(text: string) {
  return toSpeech(text.replace(/﴿[^﴾]*﴾/g, ' '));
}

const AR_DIGITS = (n: number) => String(n).replace(/[0-9]/g, d => String.fromCharCode(0x0660 + Number(d)));

export function getLearningListen(itemId: string) {
  for (const c of LEARNING_COLLECTIONS_DATA) {
    const item = c.items.find(i => i.id === itemId);
    if (!item) continue;
    const mode = LISTEN_MODE[c.id] ?? 'LESSON';
    const segments: Seg[] = [{ type: 'title', textAr: item.titleAr, speechAr: toSpeech(item.titleAr) }];
    const spokenPassages = new Set<string>();
    for (const s of item.sections) {
      segments.push({ type: 'title', textAr: s.titleAr, speechAr: toSpeech(s.titleAr) });
      if (mode === 'LESSON') {
        for (const p of s.paragraphsAr) if (p.trim()) segments.push({ type: 'narration', textAr: p, speechAr: toSpeech(p), editorial: true });
      }
      for (const q of s.quran) {
        segments.push({ type: 'ayah', introSpeechAr: 'قال الله تعالى:', surah: q.surah, fromAyah: q.fromAyah, toAyah: q.toAyah,
          referenceAr: `[${q.surahNameAr}: ${AR_DIGITS(q.fromAyah)}${q.toAyah > q.fromAyah ? `–${AR_DIGITS(q.toAyah)}` : ''}]`,
          verseKeys: q.verses.map(v => v.verseKey) });
        if (!WITH_TAFSIR.has(c.id)) continue;
        for (const key of LEARNING_TAFSIR_BY_BLOCK[`${q.surah}:${q.fromAyah}-${q.toAyah}`] ?? []) {
          if (spokenPassages.has(key)) continue; // the same ayah group was already explained earlier in this item
          spokenPassages.add(key);
          const p = LEARNING_TAFSIR_PASSAGES[key]!;
          segments.push({ type: 'tafsir', textAr: p.textAr, speechAr: tafsirSpeech(p.textAr), surah: p.surah, fromAyah: p.fromAyah,
            toAyah: p.toAyah, sourceAr: LEARNING_TAFSIR_SOURCE.sourceAr });
        }
      }
      for (const h of s.hadith) {
        const text = h.excerptsAr.map(e => `«${e}»`).join(' … ');
        segments.push({ type: 'hadith', textAr: text, referenceAr: h.sourceAr, speechAr: toSpeech(`جاء في ${h.collectionAr}: ${h.excerptsAr.join('، ')}`) });
      }
      for (const n of s.nawawi) segments.push({ type: 'hadith', textAr: n.textAr, referenceAr: n.sourceAr, speechAr: toSpeech(n.textAr) });
      if (mode === 'LESSON' && s.reflectionAr?.trim()) {
        segments.push({ type: 'narration', textAr: s.reflectionAr, speechAr: toSpeech(s.reflectionAr), editorial: true });
      }
    }
    // Rough length for "١٢ دقيقة": ~13 spoken characters a second, ~9 seconds per recited ayah.
    const speechChars = segments.reduce((a, s) => a + ('speechAr' in s ? s.speechAr.length : s.introSpeechAr.length), 0);
    const ayat = segments.reduce((a, s) => a + (s.type === 'ayah' ? s.toAyah - s.fromAyah + 1 : 0), 0);
    const sourcesAr = [
      'القرآن الكريم بصوت القارئ الذي اخترته',
      ...(segments.some(s => s.type === 'tafsir') ? [LEARNING_TAFSIR_SOURCE.sourceAr] : []),
      ...(segments.some(s => s.type === 'hadith') ? ['صحيح البخاري وصحيح مسلم والأربعون النووية — بنصها'] : []),
      ...(mode === 'LESSON' ? ['شرح الدرس: صياغة تعليمية من نور'] : []),
    ];
    return { itemId: item.id, collectionId: c.id, titleAr: item.titleAr, mode, sourcesAr,
      estimatedSeconds: Math.round(speechChars / 13 + ayat * 9), ttsLanguage: 'ar', segments };
  }
  throw new AppError('Item not found', 404, ErrorCodes.NOT_FOUND);
}
