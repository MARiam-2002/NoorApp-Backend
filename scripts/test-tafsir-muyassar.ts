/**
 * Verified «التفسير الميسر»: the data is current (build --check re-verifies every ayah group against tafsir.app),
 * covers all 6236 ayat, the known errors of the old provider copy are gone, and GET /quran/tafsir serves it.
 *
 *   npx tsx scripts/test-tafsir-muyassar.ts
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { CATALOG_SURAHS } from '../src/data/surahs';
import { getMuyassarPassage } from '../src/services/tafsir-muyassar.service';
import { getAyahTafsir } from '../src/services/quran.service';
import { LEARNING_TAFSIR_PASSAGES } from '../src/shared/data/learning-tafsir';

execFileSync('npx', ['tsx', 'scripts/build-tafsir-muyassar.ts', '--check'], { stdio: 'inherit' });

let ayat = 0;
for (const s of CATALOG_SURAHS) for (let a = 1; a <= s.totalAyahs; a++) {
  const p = getMuyassarPassage(s.id, a);
  assert.ok(p && p.surah === s.id && p.fromAyah <= a && a <= p.toAyah, `${s.id}:${a} has its passage`);
  assert.ok(!/الشاملة|معد الكتاب|\[التفسير\]|تسمية السورة/.test(p.textAr), `${s.id}:${a}: no editor note or surah introduction`);
  ayat++;
}
assert.equal(ayat, 6236);
assert.equal(getMuyassarPassage(1, 8), null);

// The errors found in the old provider copy are not here.
assert.ok(getMuyassarPassage(8, 39)!.textAr.includes('فتنة المؤمنين'));
assert.ok(!getMuyassarPassage(6, 99)!.textAr.includes('أخرح'));
assert.ok(getMuyassarPassage(7, 85)!.textAr.includes('الكيل والميزان'));
assert.ok(getMuyassarPassage(13, 15)!.textAr.includes('لعظمة الله'));
assert.ok(getMuyassarPassage(27, 25)!.textAr.includes('فعرشُ الرحمن أعظمُ المخلوقات'));

// One passage per ayah group: Nuh 1–4 are explained together.
const g = getMuyassarPassage(71, 2)!;
assert.deepEqual([g.fromAyah, g.toAyah], [1, 4]);

// The learning content uses the same verified text.
for (const p of Object.values(LEARNING_TAFSIR_PASSAGES)) assert.equal(getMuyassarPassage(p.surah, p.fromAyah)!.textAr, p.textAr);

(async () => {
  for (const id of ['Ibn_Kathir_Muyassar', 'Al_Muyassar', 'ar-tafsir-muyassar']) {
    const r = await getAyahTafsir(71, 2, id);
    assert.equal(r.provider, 'noor_verified', id);
    assert.equal(r.sourceNameAr, 'تفسير الميسر');
    assert.equal(r.resourceId, 16);
    assert.deepEqual([r.groupFromAyah, r.groupToAyah], [1, 4]);
    assert.equal(r.textAr, g.textAr);
  }
  console.log(`tafsir muyassar tests: ALL PASSED (${ayat} ayat, verified copy served by /quran/tafsir)`);
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
