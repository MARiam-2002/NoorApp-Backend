/**
 * Retrieval-only Arabic normalization for the Noor AI Quran discovery layer.
 *
 * Output of these functions is a *search key*. It must never be returned to
 * clients as Quran display text — display text is always the canonical
 * `Ayah.textAr`. This module is independent of `stripArabicDiacritics`
 * (used by `/quran/search`), which is intentionally left unchanged.
 *
 * Rules were derived from the characters actually present in the stored
 * Tanzil Uthmani text (see docs/NOOR_AI_PHASE_2.md).
 */

export const ARABIC_NORMALIZATION_VERSION = 2;

const ALEF = '\u0627';
const DAGGER_ALEF = '\u0670';
const WAW = '\u0648';
const ALEF_MAQSURA = '\u0649';

/** Harakat, tanween, shadda, sukun, maddah/hamza marks, Quranic annotation & waqf marks, extended Arabic marks. */
const REMOVABLE_MARKS = /[\u0610-\u061A\u064B-\u065F\u06D6-\u06ED\u08D3-\u08FF]/g;
const TATWEEL = /\u0640/g;
const INVISIBLES = /[\uFEFF\u200B-\u200F\u202A-\u202E\u2066-\u2069\u00AD]/g;
const ALEF_VARIANTS = /[\u0622\u0623\u0625\u0671\u0672\u0673\u0675]/g;

const ARABIC_LETTERS_RUN = /[\u0621-\u063A\u0641-\u064A]+/g;

/** Map Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits to ASCII. */
export function normalizeArabicDigits(value: string): string {
  return value.replace(/[\u0660-\u0669\u06F0-\u06F9]/g, (ch) => {
    const code = ch.codePointAt(0) ?? 0;
    return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
  });
}

type NormalizeOptions = {
  wawDagger: 'alef' | 'waw';
  dagger: 'alef' | 'omit';
  tanweenAlef: 'keep' | 'drop';
};

const PRIMARY: NormalizeOptions = { wawDagger: 'alef', dagger: 'alef', tanweenAlef: 'keep' };

/** Tanween fath carried by a silent alef: عِيدًا / عيداً (Quranic marks may sit between them). */
const TANWEEN_ALEF = /\u064B[\u06D6-\u06ED]*\u0627|\u0627\u064B/g;

function normalizeWith(text: string, options: NormalizeOptions): string {
  let out = normalizeArabicDigits(text.normalize('NFKC'))
    .replace(INVISIBLES, '')
    .replace(TATWEEL, '');
  if (options.tanweenAlef === 'drop') out = out.replace(TANWEEN_ALEF, '');
  return out
    // Uthmani وٰ is written ا in standard spelling (ٱلصَّلَوٰة → الصلاة) but وا in words
    // like ٱلسَّمَٰوَٰت → السماوات and وَٰحِد → واحد; both forms are indexed via variants.
    .replace(new RegExp(`${WAW}[\\u064B-\\u0652]*${DAGGER_ALEF}`, 'g'), options.wawDagger === 'alef' ? ALEF : WAW + ALEF)
    // ىٰ (عَلَىٰ, مُوسَىٰ) is standard ى; the dagger alef adds nothing to the spelling.
    .replace(new RegExp(`${ALEF_MAQSURA}[\\u064B-\\u0652]*${DAGGER_ALEF}`, 'g'), ALEF_MAQSURA)
    // Remaining dagger alef is usually a written long ā (ٱلْكِتَٰب → الكتاب), but some standard
    // spellings omit it (ٱلرَّحْمَٰن → الرحمن, إِلَٰه → إله, هَٰذَا → هذا); `omit` produces those.
    .replace(new RegExp(DAGGER_ALEF, 'g'), options.dagger === 'alef' ? ALEF : '')
    // Small yeh inside a word is a real ي (إِبْرَٰهِۦمَ → ابراهيم, ٱلنَّبِيِّۦنَ → النبيين);
    // at a word end it only lengthens a pronoun vowel (بِهِۦ → به) and is removed with the marks.
    .replace(/\u06E6(?=[\u064B-\u0652]*[\u0621-\u064A])/g, '\u064A')
    .replace(REMOVABLE_MARKS, '')
    .replace(ALEF_VARIANTS, ALEF)
    .replace(/\u0649/g, '\u064A') // ى → ي
    .replace(/\u0629/g, '\u0647') // ة → ه
    .replace(/\u0624/g, WAW) // ؤ → و
    .replace(/\u0626/g, '\u064A') // ئ → ي
    .replace(/\u06CC/g, '\u064A') // Persian yeh → ي
    .replace(/\u06A9/g, '\u0643') // Persian kaf → ك
    // Standard spelling never has two alefs in a row; Uthmani ٱلرِّبَوٰا۟ yields one after the rules above.
    .replace(/\u0627{2,}/g, ALEF)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Primary normalized search key for a text (query or ayah). */
export function normalizeArabicForSearch(text: string): string {
  return normalizeWith(text ?? '', PRIMARY);
}

function uniqueVariants(text: string, optionSets: readonly NormalizeOptions[]): string[] {
  return [...new Set(optionSets.map((options) => normalizeWith(text ?? '', options)))];
}

/**
 * Normalized forms of the same written words (primary first): the Uthmani وٰ read as ا or وا,
 * and the silent tanween alef kept or dropped (عِيدًا → عيدا / عيد).
 */
export function arabicSearchVariants(text: string): string[] {
  return uniqueVariants(text, [
    PRIMARY,
    { ...PRIMARY, wawDagger: 'waw' },
    { ...PRIMARY, tanweenAlef: 'drop' },
    { ...PRIMARY, wawDagger: 'waw', tanweenAlef: 'drop' },
  ]);
}

/**
 * Spelling variants with the dagger alef omitted (إِلَٰه → اله, ٱلرَّحْمَٰن → الرحمن). Only a
 * spelling alternative: the same rule also turns ٱلْكِتَٰب into الكتب, so callers must rank
 * these below the forms from `arabicSearchVariants`. Excludes forms already in that list.
 */
export function arabicDaggerOmittedVariants(text: string): string[] {
  const base = new Set(arabicSearchVariants(text));
  return uniqueVariants(text, [
    { ...PRIMARY, dagger: 'omit' },
    { ...PRIMARY, dagger: 'omit', tanweenAlef: 'drop' },
  ]).filter((v) => !base.has(v));
}

/**
 * Consonantal skeleton: removes every ا from an already-normalized word so
 * Uthmani spellings without alef (ٱلصَّٰبِرِين, يَسْـَٔلُون) meet standard spelling.
 */
export function arabicSkeleton(normalizedWord: string): string {
  return normalizedWord.replace(/\u0627/g, '');
}

/** Split a normalized string into Arabic-letter tokens (drops digits, Latin and punctuation). */
export function tokenizeArabic(normalized: string): string[] {
  return normalized.match(ARABIC_LETTERS_RUN) ?? [];
}

const CLITIC_PREFIXES = ['وبال', 'وال', 'فال', 'بال', 'كال', 'ولل', 'فلل', 'لل', 'ال', 'و', 'ف', 'ب', 'ل', 'ك'];
const MIN_STEM_LENGTH = 3;

/**
 * The word plus its forms with common attached prefixes (و ف ب ك ل + ال) removed.
 * A prefix is only stripped when at least three letters remain, so short words are kept whole.
 */
export function arabicPrefixForms(normalizedWord: string): string[] {
  const forms = new Set<string>([normalizedWord]);
  for (const prefix of CLITIC_PREFIXES) {
    if (normalizedWord.startsWith(prefix) && normalizedWord.length - prefix.length >= MIN_STEM_LENGTH) {
      forms.add(normalizedWord.slice(prefix.length));
    }
  }
  return [...forms];
}
