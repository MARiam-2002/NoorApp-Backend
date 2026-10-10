import assert from 'node:assert/strict';
import { env } from '../src/config';
import { prisma } from '../src/lib/prisma';
import { getMushafEditions, getMushafPage, getMushafReaderState, setMushafReaderState, warshBundleSchema } from '../src/services/mushaf.service';

async function main() {
  env.QF_CLIENT_ID = 'mock-client'; env.QF_CLIENT_SECRET = 'mock-secret';
  const originalFetch = global.fetch;
  let providerCalls = 0;
  global.fetch = (async (raw: any) => {
    const url = String(raw);
    assert(!url.startsWith('https://api.quran.com/'), 'No public fallback for edition-specific layout');
    if (url.includes('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }));
    providerCalls++;
    if (url.includes('/pages/lookup')) {
      const p = new URL(url).searchParams.get('page_number');
      return new Response(JSON.stringify({ pages: { [p!]: { first_verse_key: '1:1', last_verse_key: '1:1' } } }));
    }
    const text = url.includes('mushaf=3') ? 'بِسۡمِ اللهِ' : 'بِسْمِ ٱللَّهِ';
    return new Response(JSON.stringify({ verses: [{ verse_key: '1:1', verse_number: 1, text_uthmani: text, text_indopak: text }], pagination: { next_page: null, total_records: 1 } }));
  }) as typeof fetch;
  const query = prisma.$queryRaw; const execute = prisma.$executeRaw;
  let stored: any = null;
  (prisma as any).$queryRaw = async () => stored ? [stored] : [];
  (prisma as any).$executeRaw = async (_parts: any, ...v: any[]) => {
    const rev = v[4];
    if ((!stored && rev !== 0) || (stored && stored.revision !== rev)) return 0;
    stored = { page: v[2], verseKey: v[3], revision: (stored?.revision ?? 0) + 1 }; return 1;
  };
  try {
    assert.equal(getMushafEditions().length, 3);
    assert.equal(getMushafEditions().find(e => e.id === 'warsh-nafi')!.available, false);
    await assert.rejects(getMushafPage('warsh-nafi', 1), (e: any) => e.statusCode === 503);
    await assert.rejects(getMushafPage('indopak-hafs', 605), (e: any) => e.statusCode === 400);
    const [first, duplicate] = await Promise.all([getMushafPage('indopak-hafs', 1), getMushafPage('indopak-hafs', 1)]);
    assert.deepEqual(first, duplicate); assert.equal(providerCalls, 2);
    const madani = await getMushafPage('madani-hafs', 1);
    assert.notEqual(madani.verses[0].text, first.verses[0].text);
    assert.equal((await getMushafReaderState('owner', 'madani-hafs')).revision, 0);
    await assert.rejects(setMushafReaderState('owner', 'madani-hafs', { page: 1, verseKey: '2:1', revision: 0 }), (e: any) => e.statusCode === 400);
    await assert.rejects(setMushafReaderState('owner', 'madani-hafs', { page: 1, verseKey: '1:1', revision: 8 }), (e: any) => e.statusCode === 409);
    const saved = await setMushafReaderState('owner', 'madani-hafs', { page: 1, verseKey: '1:1', revision: 0 });
    assert.equal(saved.revision, 1);
    assert.equal((await setMushafReaderState('owner', 'madani-hafs', { page: 1, verseKey: '1:1', revision: 0 })).revision, 1);
    await assert.rejects(setMushafReaderState('owner', 'madani-hafs', { page: 1, verseKey: null, revision: 0 }), (e: any) => e.statusCode === 409);
    assert.equal(warshBundleSchema.safeParse({ editionId: 'warsh-nafi', pages: [] }).success, false);
    console.log('Mushaf edition regression checks passed (mocked provider and DB; no production writes).');
  } finally { global.fetch = originalFetch; (prisma as any).$queryRaw = query; (prisma as any).$executeRaw = execute; }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
