/** Shared helpers for the «التفسير الميسر» builds (scripts/build-tafsir-muyassar.ts, scripts/build-learning-tafsir.ts). */

/**
 * The ayah tafsir without the surah introduction («تسمية السورة / من مقاصد السورة») that some copies put before the
 * first ayah: after «[التفسير]» when it is marked, otherwise the last paragraph (the introduction is bullet points).
 */
export function tafsirBody(s: string) {
  const t = s.normalize('NFC').trim();
  if (t.includes('[التفسير]')) return t.split('[التفسير]').pop()!.replace(/^[\s*]+/, '').trim();
  if (/^[\s*]*تسمية السورة/.test(t)) {
    const last = t.split(/\n+/).map(x => x.trim()).filter(Boolean).pop()!;
    if (/^[•*]|مقاصد السورة|تسمية السورة/.test(last)) throw new Error(`Cannot separate the introduction from the tafsir: ${t.slice(0, 60)}`);
    return last;
  }
  return t;
}

/** Letters only: vowels, punctuation, spacing and hamza seats removed, so two copies compare by their words. */
export function lettersKey(s: string) {
  return s.normalize('NFC')
    .replace(/ﷺ/g, ' صلى الله عليه وسلم ')
    .replace(/[ً-ْٰـ۟ۡۥۦ]/g, '')
    .replace(/[إأآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/[ؤئ]/g, 'ء')
    .replace(/[^ء-ي ]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/ما لكم/g, 'مالكم').replace(/لا بد/g, 'لابد').replace(/السماوات/g, 'السموات');
}

/** Editor notes and introductions that must never reach the app. */
export const EDITOR_NOTES = /الشاملة|معد الكتاب|\[التفسير\]|تسمية السورة|مقاصد السورة/;
