/**
 * Offline static sync checks against the configured DATABASE_URL.
 * Run: npx tsx scripts/test-static-catalog.ts
 */
import assert from 'node:assert/strict';
import {
  QURAN_STATIC_CATALOG_VERSION,
  ADHKAR_STATIC_CATALOG_VERSION,
  QURAN_STATIC_DOWNLOAD_PATH,
  ADHKAR_STATIC_DOWNLOAD_PATH,
} from '../src/shared/constants/static-catalog';
import { getAdhkarStaticMeta, getAdhkarFullCatalog } from '../src/services/adhkar.service';
import { getQuranStaticMeta } from '../src/services/quran.service';
import { getStaticContentManifest } from '../src/services/content-static.service';

async function main() {
  assert.equal(typeof QURAN_STATIC_CATALOG_VERSION, 'number');
  assert.equal(typeof ADHKAR_STATIC_CATALOG_VERSION, 'number');
  assert.equal(QURAN_STATIC_DOWNLOAD_PATH, '/quran/full-catalog');
  assert.equal(ADHKAR_STATIC_DOWNLOAD_PATH, '/adhkar/full-catalog');

  const qMeta = await getQuranStaticMeta();
  assert.equal(qMeta.catalogVersion, QURAN_STATIC_CATALOG_VERSION);
  assert.ok(qMeta.contentHash.includes('quran-v'));
  assert.equal(qMeta.downloadPath, QURAN_STATIC_DOWNLOAD_PATH);
  console.log('quran static-meta OK', qMeta);

  const aMeta = await getAdhkarStaticMeta();
  assert.equal(aMeta.catalogVersion, ADHKAR_STATIC_CATALOG_VERSION);
  assert.ok(aMeta.contentHash.includes('adhkar-v'));
  assert.equal(aMeta.downloadPath, ADHKAR_STATIC_DOWNLOAD_PATH);
  console.log('adhkar static-meta OK', aMeta);

  const pack = await getAdhkarFullCatalog();
  assert.equal(pack.meta.catalogVersion, ADHKAR_STATIC_CATALOG_VERSION);
  assert.ok(pack.categories.length >= 6);
  assert.ok(pack.meta.totalItems > 0);
  const first = pack.categories[0];
  assert.ok(first?.items?.length);
  assert.ok(typeof first.items[0].textAr === 'string' && first.items[0].textAr.length > 0);
  assert.ok('repeatCount' in first.items[0]);
  console.log('adhkar full-catalog OK', pack.meta);

  const manifest = await getStaticContentManifest();
  assert.equal(manifest.quran.catalogVersion, qMeta.catalogVersion);
  assert.equal(manifest.adhkar.catalogVersion, aMeta.catalogVersion);
  console.log('content static-meta OK');

  console.log('static catalog tests: ALL PASSED');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
