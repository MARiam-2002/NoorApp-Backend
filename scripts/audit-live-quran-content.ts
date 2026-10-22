import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { ADHKAR_CATALOG_ITEMS } from '../src/shared/data/adhkar-catalog';
import { stripSurahOpeningBismillahIfNeeded } from '../src/services/quran.service';

// Read-only comparison of public production content. No account, DB or push calls.
const normalize = (text: string) => text.normalize('NFC').replace(/\ufeff/g, '').replace(/\s+/g, ' ').trim();
async function get(path: string) {
  const r = await fetch(`https://noorapp-backend-production.up.railway.app/api/v1${path}`, {signal: AbortSignal.timeout(45_000)});
  assert.ok(r.ok, `Public catalog returned HTTP ${r.status}`);
  const body: any = await r.json();
  assert.equal(body.success, true);
  return body.data;
}
async function main() {
  const source = JSON.parse(readFileSync('prisma/data/quran-uthmani.json', 'utf8'));
  const expected = new Map<string, string>();
  for (const s of source.surahs) for (const a of s.ayahs) {
    expected.set(`${s.number}:${a.numberInSurah}`, normalize(stripSurahOpeningBismillahIfNeeded({
      surahId: s.number, ayahNumber: a.numberInSurah, textAr: a.text,
    })));
  }
  assert.equal(expected.size, 6236);
  const [quran, adhkar] = await Promise.all([get('/quran/full-catalog'), get('/adhkar/full-catalog')]);
  assert.equal(quran.surahs.length, 114);
  assert.equal(new Set(quran.surahs.map((s: any) => s.id)).size, 114);
  assert.equal(adhkar.categories.length, 14);
  assert.equal(new Set(adhkar.categories.map((c: any) => c.key)).size, 14);
  const seen = new Set<string>();
  const differences: any[] = [];
  for (const s of quran.surahs) for (const a of s.ayahs) {
    const key = `${s.id}:${a.ayahNumber}`;
    assert.ok(!seen.has(key), `Duplicate verse ${key}`); seen.add(key);
    if (normalize(a.textAr) !== expected.get(key)) differences.push({ kind: 'quran', key, actual: a.textAr, expected: expected.get(key) });
  }
  assert.equal(seen.size, 6236);
  let adhkarCount = 0;
  for (const category of adhkar.categories) {
    const items = ADHKAR_CATALOG_ITEMS[category.key as keyof typeof ADHKAR_CATALOG_ITEMS];
    assert.ok(items, `Unexpected adhkar category ${category.key}`);
    assert.equal(category.items.length, items.length);
    for (const item of category.items) {
      adhkarCount++;
      const target = items.find(x => x.orderInCategory === item.orderInCategory);
      if (!target || normalize(item.textAr) !== normalize(target.textAr)) differences.push({kind: 'adhkar', key: `${category.key}:${item.orderInCategory}`, actual: item.textAr, expected: target?.textAr});
    }
  }
  assert.equal(adhkarCount, 93);
  const report = { checkedAt: new Date().toISOString(), quranVersesCompared: seen.size, adhkarItemsCompared: adhkarCount,
    comparison: 'NFC + whitespace/BOM only; verse opening basmalah follows documented API presentation. Diacritics are preserved.',
    limitation: 'Equality to the checked-in source is not independent certification of that source, religious references, Warsh assets, or cached Flutter rendering.', differences };
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2));
  console.log(JSON.stringify({quranVersesCompared: seen.size, adhkarItemsCompared: adhkarCount, differences: differences.length}));
  assert.equal(differences.length, 0, 'Production content differs; inspect report before making any edits');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
