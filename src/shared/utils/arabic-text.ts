/** Strip Arabic diacritics / tatweel / wasla so search can match Uthmani Quran text. */
export function stripArabicDiacritics(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u08E4-\u08FF]/g, '')
    .replace(/\u0640/g, '') // tatweel
    .replace(/\u0671/g, '\u0627') // ٱ → ا
    .replace(/[\u0622\u0623\u0625]/g, '\u0627') // آ أ إ → ا
    .replace(/\u0629/g, '\u0647') // ة → ه (optional soft match)
    .replace(/\s+/g, ' ')
    .trim();
}

/** Characters removed in Postgres translate() for diacritic-insensitive ILIKE. */
export const ARABIC_DIACRITICS_FOR_TRANSLATE =
  'ًٌٍَُِّْٰٕٜۣٓٔٚٛٝٞ۟۠ۡۢۤۥۦۧۨ۩۪ۭ۫۬ۚۖۗۘۙۚۛۜ۝۞ۣ۟۠ۡۢۤۥۦ۪ۭۧۨ۫۬';
