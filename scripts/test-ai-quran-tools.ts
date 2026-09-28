/**
 * Noor AI Phase 2: reference parser, exact lookup, citations, deterministic search
 * and discovery against the real `surahs` / `ayahs` tables (read-only, no network).
 * Run: npx tsx scripts/test-ai-quran-tools.ts
 */
import assert from 'node:assert/strict';

const outbound: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  outbound.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  return realFetch(input, init);
}) as typeof fetch;

async function main() {
  const { prisma } = await import('../src/lib/prisma');
  const { AppError } = await import('../src/lib/errors');
  const { loadSurahCatalog } = await import('../src/services/ai/intent/surah-name-index');
  const { parseQuranReference, MAX_REFERENCE_RANGE } = await import('../src/services/ai/intent/quran-reference-parser');
  const { lookupQuranAyahs } = await import('../src/services/ai/tools/quran-lookup.tool');
  const { parseQuranCitations } = await import('../src/services/ai/citations/citation-parser');
  const { validateQuranCitations } = await import('../src/services/ai/citations/citation-validator');
  const { resolveQuranCitations } = await import('../src/services/ai/citations/citation-resolver');
  const { searchQuran } = await import('../src/services/ai/tools/quran-search.tool');
  const { discoverQuran } = await import('../src/services/ai/quran-discovery.service');
  const { stripSurahOpeningBismillahIfNeeded } = await import('../src/services/quran.service');
  const { normalizeArabicForSearch, arabicSkeleton } = await import('../src/shared/utils/arabic-normalize');

  const rawAyah = async (surahId: number, ayahNumber: number) =>
    prisma.ayah.findUniqueOrThrow({ where: { surahId_ayahNumber: { surahId, ayahNumber } } });

  try {
    const catalog = await loadSurahCatalog();
    assert.equal(catalog.byId.size, 114);

    console.log('--- reference parser: valid references ---');
    const valid: Array<[string, number, number, number]> = [
      ['البقرة 255', 2, 255, 255],
      ['البقرة:255', 2, 255, 255],
      ['البقرة 255-257', 2, 255, 257],
      ['البقره 255', 2, 255, 255],
      ['2:255', 2, 255, 255],
      ['2:255-257', 2, 255, 257],
      ['2 255', 2, 255, 255],
      ['2:255–257', 2, 255, 257],
      ['Al-Baqarah 255', 2, 255, 255],
      ['Al Baqarah 255', 2, 255, 255],
      ['al-baqara 255', 2, 255, 255],
      ['Baqarah 255', 2, 255, 255],
      ['Surah Al-Baqarah 255', 2, 255, 255],
      ['سورة البقرة آية 255', 2, 255, 255],
      ['البقرة 255 إلى 257', 2, 255, 257],
      ['  البقرة    255  ', 2, 255, 255],
      ['٢:٢٥٥', 2, 255, 255],
      ['۲:۲۵۵-۲۵۷', 2, 255, 257],
      ['البقرة ٢٥٥', 2, 255, 255],
      ['آل عمران 7', 3, 7, 7],
      ['ال عمران 7', 3, 7, 7],
      ['Aal-i-Imraan 7', 3, 7, 7],
      ["Ali 'Imran 7", 3, 7, 7],
      ['الفاتحة 1', 1, 1, 1],
      ['Al-Fatihah 7', 1, 7, 7],
      ['يس 1', 36, 1, 1],
      ['Yasin 1', 36, 1, 1],
      ['ق 1', 50, 1, 1],
      ['الإخلاص 1', 112, 1, 1],
      ['الاخلاص 1-4', 112, 1, 4],
      ['114:6', 114, 6, 6],
      ['2:1-50', 2, 1, 50],
      ['التوبة 1', 9, 1, 1],
      ['براءة 1', 9, 1, 1],
      ['بني إسرائيل 1', 17, 1, 1],
      ['Bani Israil 1', 17, 1, 1],
      ['تبارك 1', 67, 1, 1],
      ['الملك 1', 67, 1, 1],
      ['عم 1', 78, 1, 1],
      ['حم السجدة 1', 41, 1, 1],
      ['هل أتى 1', 76, 1, 1],
      ['ألم نشرح 1', 94, 1, 1],
      ['تبت 1', 111, 1, 1],
      ['المؤمن 1', 40, 1, 1],
      ['المؤمنون 1', 23, 1, 1],
    ];
    for (const [q, surahId, startAyah, endAyah] of valid) {
      const r = parseQuranReference(q, catalog);
      assert.equal(r.kind, 'reference', `"${q}" should parse, got ${JSON.stringify(r)}`);
      if (r.kind === 'reference') assert.deepEqual(r.reference, { surahId, startAyah, endAyah }, q);
    }

    console.log('--- reference parser: invalid references never guess ---');
    const invalid: Array<[string, string]> = [
      ['2:999', 'AYAH_OUT_OF_RANGE'],
      ['البقرة 999', 'AYAH_OUT_OF_RANGE'],
      ['2:0', 'AYAH_OUT_OF_RANGE'],
      ['1:7-8', 'AYAH_OUT_OF_RANGE'],
      ['999:1', 'INVALID_SURAH_NUMBER'],
      ['0:1', 'INVALID_SURAH_NUMBER'],
      ['115 1', 'INVALID_SURAH_NUMBER'],
      ['unknown 255', 'UNKNOWN_SURAH'],
      ['بقرةة 255', 'UNKNOWN_SURAH'],
      ['2:257-255', 'INVALID_RANGE'],
      [`2:1-${MAX_REFERENCE_RANGE + 1}`, 'RANGE_TOO_LARGE'],
    ];
    for (const [q, reason] of invalid) {
      const r = parseQuranReference(q, catalog);
      assert.equal(r.kind, 'invalid', `"${q}" must be invalid, got ${JSON.stringify(r)}`);
      if (r.kind === 'invalid') assert.equal(r.reason, reason, q);
    }
    for (const q of ['آيات عن الصبر', 'البقرة', '255', '', '   ', 'ما حكم الربا', 'patience']) {
      assert.equal(parseQuranReference(q, catalog).kind, 'not_reference', `"${q}" is not a reference`);
    }

    console.log('--- exact lookup: single ayah, range, canonical text ---');
    const one = await lookupQuranAyahs({ surahId: 2, startAyah: 255, endAyah: 255 });
    assert.ok(one.ok);
    const db255 = await rawAyah(2, 255);
    if (one.ok) {
      assert.equal(one.ayahs.length, 1);
      assert.equal(one.ayahs[0]!.text, db255.textAr, 'text must be the stored Ayah.textAr');
      assert.equal(one.ayahs[0]!.page, db255.page);
      assert.equal(one.ayahs[0]!.juz, db255.juz);
      assert.equal(one.ayahs[0]!.surahNameAr, 'البقرة');
      assert.ok(/[\u064B-\u0652]/.test(one.ayahs[0]!.text), 'display text keeps its diacritics');
    }
    const range = await lookupQuranAyahs({ surahId: 2, startAyah: 255, endAyah: 257 });
    assert.ok(range.ok);
    if (range.ok) {
      assert.deepEqual(range.ayahs.map((a) => a.ayahNumber), [255, 256, 257]);
      for (const a of range.ayahs) assert.equal(a.text, (await rawAyah(2, a.ayahNumber)).textAr);
    }
    const opening = await lookupQuranAyahs({ surahId: 2, startAyah: 1, endAyah: 1 });
    const db21 = await rawAyah(2, 1);
    assert.ok(opening.ok);
    if (opening.ok) {
      assert.equal(opening.ayahs[0]!.text, stripSurahOpeningBismillahIfNeeded(db21), 'same display rule as /quran endpoints');
      assert.notEqual(opening.ayahs[0]!.text, db21.textAr);
      assert.equal(normalizeArabicForSearch(opening.ayahs[0]!.text), 'الم');
    }

    console.log('--- exact lookup: invalid ayah / range, no partial results ---');
    for (const [ref, reason] of [
      [{ surahId: 2, startAyah: 287, endAyah: 287 }, 'AYAH_NOT_FOUND'],
      [{ surahId: 2, startAyah: 285, endAyah: 287 }, 'AYAH_NOT_FOUND'],
      [{ surahId: 115, startAyah: 1, endAyah: 1 }, 'AYAH_NOT_FOUND'],
      [{ surahId: 2, startAyah: 0, endAyah: 0 }, 'INVALID_REFERENCE'],
      [{ surahId: 2, startAyah: 10, endAyah: 5 }, 'INVALID_REFERENCE'],
      [{ surahId: 2, startAyah: 1, endAyah: MAX_REFERENCE_RANGE + 1 }, 'INVALID_REFERENCE'],
    ] as const) {
      const r = await lookupQuranAyahs(ref);
      assert.equal(r.ok, false, JSON.stringify(ref));
      if (!r.ok) assert.equal(r.reason, reason, JSON.stringify(ref));
    }

    console.log('--- citation parser ---');
    const parsed = parseQuranCitations('آية الكرسي [Q:2:255] ثم [Q:2:255-257] و [Q:2] [Q:x:1] [Q:2:255-] [Q:2:255');
    assert.deepEqual(
      parsed.citations.map(({ surahId, startAyah, endAyah }) => ({ surahId, startAyah, endAyah })),
      [{ surahId: 2, startAyah: 255, endAyah: 255 }, { surahId: 2, startAyah: 255, endAyah: 257 }],
    );
    assert.deepEqual(parsed.malformed.map((m) => m.raw), ['[Q:2]', '[Q:x:1]', '[Q:2:255-]', '[Q:2:255']);
    assert.deepEqual(parseQuranCitations('no citations here'), { citations: [], malformed: [] });

    console.log('--- citation validator (database) ---');
    const toValidate = parseQuranCitations('[Q:2:255] [Q:2:255-257] [Q:115:1] [Q:0:1] [Q:2:287] [Q:2:286-287] [Q:2:257-255] [Q:2:1-51]').citations;
    const validation = await validateQuranCitations(toValidate);
    assert.deepEqual(validation.valid.map((c) => c.raw), ['[Q:2:255]', '[Q:2:255-257]']);
    assert.deepEqual(
      validation.invalid.map((i) => [i.citation.raw, i.reason]),
      [
        ['[Q:115:1]', 'INVALID_SURAH'],
        ['[Q:0:1]', 'INVALID_SURAH'],
        ['[Q:2:257-255]', 'INVALID_RANGE'],
        ['[Q:2:1-51]', 'RANGE_TOO_LARGE'],
        ['[Q:2:287]', 'AYAH_NOT_FOUND'],
        ['[Q:2:286-287]', 'AYAH_NOT_FOUND'],
      ],
    );

    console.log('--- citation resolver: text only from PostgreSQL ---');
    const resolution = await resolveQuranCitations('«نص مزيف ليس من القرآن» [Q:2:255] [Q:2:999] [Q:bad]');
    assert.equal(resolution.resolved.length, 1);
    assert.equal(resolution.resolved[0]!.ayahs[0]!.text, db255.textAr);
    assert.ok(!resolution.resolved[0]!.ayahs[0]!.text.includes('مزيف'));
    assert.deepEqual(resolution.invalid.map((i) => i.reason), ['AYAH_NOT_FOUND']);
    assert.deepEqual(resolution.malformed.map((m) => m.raw), ['[Q:bad]']);

    console.log('--- deterministic search ---');
    const containsSkeleton = (text: string, s: string) =>
      normalizeArabicForSearch(text).split(' ').some((w) => arabicSkeleton(w).includes(s));
    const sabr = await searchQuran('آيات عن الصبر', 10);
    assert.ok(sabr.length > 0 && sabr.length <= 10);
    // The Quran writes بِٱلصَّبْرِ, never a bare ٱلصَّبْر, so the best match is an attached-prefix match.
    assert.equal(sabr[0]!.score, 0.9);
    for (const h of sabr) assert.ok(containsSkeleton(h.text, 'صبر'), `${h.surahId}:${h.ayahNumber} lacks صبر`);
    for (let i = 1; i < sabr.length; i += 1) assert.ok(sabr[i - 1]!.score >= sabr[i]!.score, 'sorted by score');
    assert.deepEqual(await searchQuran('آيات عن الصبر', 10), sabr, 'same query → same results');

    const salah = await searchQuran('آيات عن الصلاة', 200);
    assert.ok(salah.some((h) => h.surahId === 2 && h.ayahNumber === 3), 'Uthmani ٱلصَّلَوٰةَ found by الصلاة');
    const jannah = await searchQuran('آيات عن الجنة', 200);
    assert.ok(jannah.some((h) => h.surahId === 2 && h.ayahNumber === 35));
    const ibrahim = await searchQuran('إبراهيم', 200);
    assert.ok(ibrahim.some((h) => h.surahId === 2 && h.ayahNumber === 124), 'Uthmani إِبْرَٰهِۦمَ found');
    const riba = await searchQuran('ما حكم الربا', 50);
    assert.ok(riba.some((h) => h.surahId === 2 && h.ayahNumber === 275));
    for (const h of [...sabr, ...salah]) {
      const db = await rawAyah(h.surahId, h.ayahNumber);
      assert.equal(h.text, stripSurahOpeningBismillahIfNeeded(db), 'search text = canonical display text');
      assert.equal(h.page, db.page);
      assert.equal(h.juz, db.juz);
    }

    console.log('--- search ranking: prefix-stripped matches rank below whole words ---');
    const scoreOf = async (query: string, surahId: number, ayahNumber: number) =>
      (await searchQuran(query, 6236)).find((h) => h.surahId === surahId && h.ayahNumber === ayahNumber)?.score;
    const eid = await searchQuran('عيد', 6236);
    assert.deepEqual(
      eid.filter((h) => h.score === 1).map((h) => `${h.surahId}:${h.ayahNumber}`),
      ['5:114'],
      'only عِيدًا scores 1; بعيد / وعيد never do',
    );
    assert.equal(await scoreOf('عيد', 2, 176), 0.9, 'بَعِيدٍ (2:176) is a prefix-stripped match');
    assert.equal(await scoreOf('تاب', 5, 39), 1, 'تَابَ (5:39) is a whole-word match');
    assert.equal(await scoreOf('تاب', 2, 89), 0.9, 'كِتَٰبٌ (2:89) is not an exact match for تاب');
    assert.equal(await scoreOf('بير', 2, 217), 0.9, 'كَبِيرٌ is not an exact match for بير');
    assert.equal(await scoreOf('ريم', 8, 4), 0.9, 'كَرِيمٌ is not an exact match for ريم');
    assert.equal(await scoreOf('كتاب', 2, 89), 1, 'كِتَٰبٌ');
    assert.equal(await scoreOf('كتاب', 2, 2), 0.9, 'ٱلْكِتَٰبُ');
    assert.equal(await scoreOf('كتاب', 5, 39), 0.875, 'تَابَ only matches after removing ك from the query');
    const kitab = await searchQuran('كتاب', 6236);
    const falseKitab = kitab.findIndex((h) => h.surahId === 5 && h.ayahNumber === 39);
    const trueKitab = kitab.findIndex((h) => h.surahId === 2 && h.ayahNumber === 2);
    assert.ok(trueKitab >= 0 && falseKitab > trueKitab, 'true كتاب matches rank above تاب');
    assert.equal(await scoreOf('فقال', 2, 31), 1, 'فَقَالَ');
    assert.equal(await scoreOf('فقال', 2, 30), 0.875, 'فقال still finds قَالَ');
    assert.equal(await scoreOf('قال', 2, 30), 1, 'قَالَ');
    assert.equal(await scoreOf('قال', 2, 31), 0.9, 'قال still finds فَقَالَ');

    console.log('--- search: tanween alef, dagger-alef spellings, IDF, length tie-break ---');
    assert.equal(await scoreOf('عيد', 5, 114), 1, 'عِيدًا is the whole word عيد');
    assert.deepEqual((await searchQuran('عيد', 1)).map((h) => `${h.surahId}:${h.ayahNumber}`), ['5:114']);
    assert.equal(await scoreOf('إله', 2, 163), 0.9, 'إِلَٰه matches the standard spelling إله');
    assert.equal(await scoreOf('الرحمن', 1, 1), 0.9, 'ٱلرَّحْمَٰن matches the standard spelling الرحمن');
    assert.equal(await scoreOf('هذا', 2, 126), 0.9, 'هَٰذَا matches the standard spelling هذا');
    assert.equal(await scoreOf('الكتاب', 2, 2), 1, 'ٱلْكِتَٰب stays an exact match for الكتاب');
    assert.equal(await scoreOf('الكتب', 2, 2), 0.9, 'dagger-omitted الكتب never scores as an exact match');
    const hayy = (await searchQuran('الحي القيوم', 3)).map((h) => `${h.surahId}:${h.ayahNumber}`).sort();
    assert.deepEqual(hayy, ['20:111', '2:255', '3:2'], 'rare القيوم outweighs common الحي');
    assert.deepEqual((await searchQuran('قل هو الله أحد', 1)).map((h) => `${h.surahId}:${h.ayahNumber}`), ['112:1']);

    assert.deepEqual(await searchQuran('patience', 10), []);
    assert.deepEqual(await searchQuran('unknown', 10), []);
    assert.deepEqual(await searchQuran('آيات عن', 10), []);

    console.log('--- discovery service ---');
    const exact = await discoverQuran('البقرة 255', 10);
    assert.equal(exact.mode, 'exact');
    assert.equal(exact.results.length, 1);
    assert.deepEqual(Object.keys(exact.results[0]!), ['surahId', 'ayahNumber', 'surahNameAr', 'text', 'page', 'juz', 'score']);
    assert.equal(exact.results[0]!.score, 1);
    const exactRange = await discoverQuran('2:255-257', 1);
    assert.equal(exactRange.results.length, 3, 'limit never truncates an exact range');
    const search = await discoverQuran('آيات عن الصبر', 5);
    assert.equal(search.mode, 'search');
    assert.ok(search.results.length <= 5);
    await assert.rejects(discoverQuran('2:999', 10), (err: unknown) => {
      assert.ok(err instanceof AppError);
      assert.equal(err.statusCode, 400);
      assert.equal(err.code, 'VALIDATION_ERROR');
      assert.deepEqual(err.details, { reason: 'AYAH_OUT_OF_RANGE' });
      return true;
    });
    await assert.rejects(discoverQuran('unknown 255', 10), (err: unknown) =>
      err instanceof AppError && (err.details as { reason: string }).reason === 'UNKNOWN_SURAH');

    assert.deepEqual(outbound, [], 'no network calls allowed');
    console.log('ai quran tools: OK');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
