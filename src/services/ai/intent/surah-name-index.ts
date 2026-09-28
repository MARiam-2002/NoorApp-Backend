import { prisma } from '../../../lib/prisma';
import { resolveSurahNameAr, resolveSurahNameEn } from '../../../lib/surah-names';
import { normalizeArabicForSearch } from '../../../shared/utils/arabic-normalize';

export type SurahCatalogEntry = {
  id: number;
  /** Display name, resolved exactly like the existing Quran endpoints. */
  nameAr: string;
  totalAyahs: number;
};

export type SurahCatalog = {
  byId: ReadonlyMap<number, SurahCatalogEntry>;
  byArabicKey: ReadonlyMap<string, number>;
  byEnglishKey: ReadonlyMap<string, number>;
};

export type SurahRow = { id: number; nameAr: string; nameEn: string; totalAyahs: number };

/**
 * Widely used traditional names that differ from the stored name. Only added when the key is
 * not already a canonical name of any surah, so an alias can never override the database.
 */
const ALTERNATIVE_SURAH_NAMES: Readonly<Record<number, { ar: readonly string[]; en: readonly string[] }>> = {
  9: { ar: ['براءة'], en: ["Bara'ah"] },
  17: { ar: ['بني إسرائيل'], en: ['Bani Israil'] },
  35: { ar: ['الملائكة'], en: [] },
  40: { ar: ['المؤمن'], en: ["Al-Mu'min"] },
  41: { ar: ['حم السجدة'], en: ['Ha-Mim Sajdah'] },
  47: { ar: ['القتال'], en: [] },
  67: { ar: ['تبارك'], en: ['Tabarak'] },
  76: { ar: ['الدهر', 'هل أتى'], en: ['Ad-Dahr'] },
  78: { ar: ['عم'], en: [] },
  94: { ar: ['الانشراح', 'ألم نشرح'], en: ['Al-Inshirah'] },
  111: { ar: ['تبت', 'اللهب'], en: ['Al-Lahab'] },
  112: { ar: ['التوحيد'], en: [] },
};

const ARABIC_DEFINITE_ARTICLE = 'ال';
const ENGLISH_ARTICLE = /^(al|an|ar|as|at|ad|adh|az|ash|ath|aal)[-\s]+/;

export function arabicSurahKeys(name: string): string[] {
  const compact = normalizeArabicForSearch(name).replace(/\s+/g, '');
  if (!compact) return [];
  const keys = new Set<string>([compact]);
  if (compact.startsWith(ARABIC_DEFINITE_ARTICLE) && compact.length > ARABIC_DEFINITE_ARTICLE.length + 1) {
    keys.add(compact.slice(ARABIC_DEFINITE_ARTICLE.length));
  }
  return [...keys];
}

/**
 * Transliteration-tolerant key: "Al-Baqarah", "Al Baqara", "baqara" → "baqara".
 * Only spelling noise is removed (article, punctuation, doubled letters, o/u, e/i, final h).
 */
export function englishSurahKey(name: string): string {
  return name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/['’‘`ʿʾ]/g, '')
    .trim()
    .replace(ENGLISH_ARTICLE, '')
    .replace(/[^a-z]/g, '')
    .replace(/(.)\1+/g, '$1')
    .replace(/o/g, 'u')
    .replace(/e/g, 'i')
    .replace(/([ai])h$/, '$1');
}

function addKey(target: Map<string, Set<number>>, key: string, id: number): void {
  if (!key) return;
  const ids = target.get(key) ?? new Set<number>();
  ids.add(id);
  target.set(key, ids);
}

/** Keys shared by more than one surah are dropped so a name never resolves by guesswork. */
function uniqueOnly(source: Map<string, Set<number>>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [key, ids] of source) {
    const [only] = ids;
    if (ids.size === 1 && only != null) out.set(key, only);
  }
  return out;
}

export function buildSurahCatalog(rows: readonly SurahRow[]): SurahCatalog {
  const byId = new Map<number, SurahCatalogEntry>();
  const arabic = new Map<string, Set<number>>();
  const english = new Map<string, Set<number>>();

  for (const row of rows) {
    const nameAr = resolveSurahNameAr(row.id, row.nameAr);
    byId.set(row.id, { id: row.id, nameAr, totalAyahs: row.totalAyahs });
    for (const key of arabicSurahKeys(row.nameAr)) addKey(arabic, key, row.id);
    for (const key of arabicSurahKeys(nameAr)) addKey(arabic, key, row.id);
    const englishKey = englishSurahKey(row.nameEn);
    if (englishKey.length >= 2) addKey(english, englishKey, row.id);
    const displayEnglishKey = englishSurahKey(resolveSurahNameEn(row.id, null));
    if (displayEnglishKey.length >= 2) addKey(english, displayEnglishKey, row.id);
  }

  const arabicAliases = new Map<string, Set<number>>();
  const englishAliases = new Map<string, Set<number>>();
  for (const [idText, names] of Object.entries(ALTERNATIVE_SURAH_NAMES)) {
    const id = Number(idText);
    if (!byId.has(id)) continue;
    for (const name of names.ar) {
      for (const key of arabicSurahKeys(name)) if (!arabic.has(key)) addKey(arabicAliases, key, id);
    }
    for (const name of names.en) {
      const key = englishSurahKey(name);
      if (key.length >= 2 && !english.has(key)) addKey(englishAliases, key, id);
    }
  }

  return {
    byId,
    byArabicKey: new Map([...uniqueOnly(arabic), ...uniqueOnly(arabicAliases)]),
    byEnglishKey: new Map([...uniqueOnly(english), ...uniqueOnly(englishAliases)]),
  };
}

export function resolveSurahIdByName(catalog: SurahCatalog, name: string): number | null {
  if (/[\u0600-\u06FF]/.test(name)) {
    for (const key of arabicSurahKeys(name)) {
      const id = catalog.byArabicKey.get(key);
      if (id != null) return id;
    }
    return null;
  }
  const key = englishSurahKey(name);
  return key.length >= 2 ? catalog.byEnglishKey.get(key) ?? null : null;
}

let catalogPromise: Promise<SurahCatalog> | null = null;

/** Surah catalog from the `surahs` table, cached for the process lifetime (static data). */
export function loadSurahCatalog(): Promise<SurahCatalog> {
  if (!catalogPromise) {
    catalogPromise = prisma.surah
      .findMany({
        orderBy: { id: 'asc' },
        select: { id: true, nameAr: true, nameEn: true, totalAyahs: true },
      })
      .then((rows) => {
        if (rows.length === 0) throw new Error('Surah catalog is empty');
        return buildSurahCatalog(rows);
      })
      .catch((err) => {
        catalogPromise = null;
        throw err;
      });
  }
  return catalogPromise;
}
