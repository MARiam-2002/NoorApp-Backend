/**
 * Offline adhkar pack scopes. Released apps validate the pack as exactly 14 categories with consistent totals
 * (lib/core/static_content/adhkar_pack_validator.dart); the default pack must pass that, and `?categories=all` must
 * carry every category with its own hash. Uses the seeded test database.
 *
 *   ADHKAR_TEST_DB=true npx tsx scripts/test-adhkar-pack-scope.ts
 */
import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { getAdhkarFullCatalog, getAdhkarStaticMeta, LEGACY_PACK_CATEGORY_KEYS, parseAdhkarPackScope } from '../src/services/adhkar.service';
import { getStaticContentManifest } from '../src/services/content-static.service';

if (process.env.ADHKAR_TEST_DB !== 'true') {
  console.log('SKIP adhkar pack scope test (set ADHKAR_TEST_DB=true with a seeded test database)');
  process.exit(0);
}

/** The released app's checks, line for line. */
function releasedAppValidator(pack: Awaited<ReturnType<typeof getAdhkarFullCatalog>>) {
  const m = pack.meta;
  assert.ok(m.catalogVersion > 0 && m.contentHash.length > 0);
  assert.equal(pack.categories.length, 14, 'Expected 14 categories');
  assert.equal(m.totalCategories, 14);
  let items = 0;
  let prevSort = -1;
  for (const c of pack.categories as any[]) {
    assert.ok(c.id && c.key && String(c.nameAr).trim());
    assert.ok(c.sortOrder >= prevSort, 'sorted by sortOrder');
    prevSort = c.sortOrder;
    let prevOrder = -1;
    for (const it of c.items) {
      assert.ok(it.id && String(it.textAr).trim() && it.repeatCount >= 1);
      assert.ok(it.orderInCategory >= prevOrder, `${c.key} ordered`);
      prevOrder = it.orderInCategory;
      items++;
    }
    if (c.totalItems > 0) assert.equal(c.items.length, c.totalItems, `${c.key} totalItems`);
  }
  assert.ok(m.totalItems > 0);
  assert.equal(items, m.totalItems);
}

async function main() {
  assert.equal(parseAdhkarPackScope(undefined), 'legacy');
  assert.equal(parseAdhkarPackScope('all'), 'all');
  assert.equal(parseAdhkarPackScope('ALL'), 'legacy');

  const legacy = await getAdhkarFullCatalog();
  releasedAppValidator(legacy);
  assert.deepEqual(legacy.categories.map((c: any) => c.key).sort(), [...LEGACY_PACK_CATEGORY_KEYS].sort());
  assert.equal(legacy.meta.scope, 'legacy');

  const all = await getAdhkarFullCatalog('all');
  for (const c of all.categories as any[]) assert.ok(!/^اذكار/.test(c.nameAr), `${c.key}: «أذكار» is spelled with hamza`);
  assert.ok(all.categories.length > 14, `all scope has ${all.categories.length} categories`);
  assert.equal(all.meta.totalItems, all.categories.reduce((n: number, c: any) => n + c.items.length, 0));
  assert.notEqual(all.meta.contentHash, legacy.meta.contentHash);
  assert.match(all.meta.downloadPath, /\?categories=all$/);

  // The probe matches the pack of the same scope, so a client never re-downloads forever or compares across scopes.
  const [mLegacy, mAll] = await Promise.all([getAdhkarStaticMeta(), getAdhkarStaticMeta('all')]);
  assert.equal(mLegacy.contentHash, legacy.meta.contentHash);
  assert.equal(mAll.contentHash, all.meta.contentHash);
  const manifest = await getStaticContentManifest();
  assert.equal(manifest.adhkar.contentHash, legacy.meta.contentHash);
  assert.equal(manifest.adhkarAll.contentHash, all.meta.contentHash);

  console.log(`adhkar pack scope tests: ALL PASSED (default ${legacy.meta.totalCategories} categories / ${legacy.meta.totalItems} items passes the released app's validator; all = ${all.meta.totalCategories} / ${all.meta.totalItems})`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
