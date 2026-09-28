/**
 * Noor AI Phase 2: POST /api/v1/ai/quran-discovery over HTTP.
 * Parent: AI disabled → 503 AI_DISABLED. Child (AI_ENABLED=true): deterministic
 * results with a temporary user that is hard-deleted afterwards. No AI provider exists.
 * Run: npx tsx scripts/test-ai-quran-discovery-http.ts
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import type { AddressInfo } from 'node:net';

const ENABLED_CHILD_FLAG = '--enabled-child';

const outbound: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') outbound.push(url);
  return realFetch(input, init);
}) as typeof fetch;

type JsonResponse = { status: number; json: any };

async function post(base: string, body: unknown, token?: string): Promise<JsonResponse> {
  const res = await fetch(`${base}/ai/quran-discovery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

async function runDisabled(): Promise<void> {
  delete process.env.AI_ENABLED;
  const { aiConfig } = await import('../src/config');
  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  assert.equal(aiConfig.enabled, false, 'remove AI_ENABLED from local .env to run this test');

  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  try {
    console.log('--- disabled: POST /ai/quran-discovery → 503 AI_DISABLED ---');
    for (const token of [undefined, 'not-a-real-jwt']) {
      const r = await post(base, { query: 'البقرة 255', limit: 10 }, token);
      assert.equal(r.status, 503);
      assert.equal(r.json.success, false);
      assert.equal(r.json.code, 'AI_DISABLED');
      assert.equal(typeof r.json.requestId, 'string');
    }
    const invalidBody = await post(base, { limit: 999 });
    assert.equal(invalidBody.status, 503, 'flag check runs before validation');

    console.log('--- disabled: existing /quran/search unchanged ---');
    const legacy = await fetch(`${base}/quran/search?q=${encodeURIComponent('الصلاة')}&limit=5`);
    assert.equal(legacy.status, 200);
    assert.equal(((await legacy.json()) as any).success, true);

    assert.deepEqual(outbound, [], 'no outbound requests');
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('--- enabled path (child process with AI_ENABLED=true) ---');
  const child = spawnSync(process.execPath, [...process.execArgv, __filename, ENABLED_CHILD_FLAG], {
    env: { ...process.env, AI_ENABLED: 'true' },
    stdio: 'inherit',
  });
  assert.equal(child.status, 0, 'enabled-mode checks failed');
  console.log('ai quran discovery http: OK');
}

async function runEnabledChild(): Promise<void> {
  const { aiConfig } = await import('../src/config');
  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const { generateAccessToken } = await import('../src/lib/auth');
  const { hardDeleteUserAccount } = await import('../src/services/auth.service');
  assert.equal(aiConfig.enabled, true);

  const stamp = Date.now();
  const user = await prisma.user.create({
    data: { username: `ai_discovery_test_${stamp}`, email: `ai-discovery-${stamp}@noor-test.local`, fullName: 'AI Discovery Test' },
  });
  const token = generateAccessToken({ userId: user.id, email: user.email });
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  try {
    console.log('  [enabled] authentication required');
    const noToken = await post(base, { query: 'البقرة 255' });
    assert.equal(noToken.status, 401);
    assert.equal(noToken.json.code, 'UNAUTHORIZED');

    console.log('  [enabled] status advertises quranDiscovery only');
    const status = await fetch(`${base}/ai/status`, { headers: { Authorization: `Bearer ${token}` } });
    const statusJson = (await status.json()) as any;
    assert.equal(status.status, 200);
    assert.deepEqual(statusJson.data.features, { chat: false, streaming: false, quranDiscovery: true, conversations: false });
    assert.equal(statusJson.data.configured, false);

    console.log('  [enabled] exact: البقرة 255');
    const db255 = await prisma.ayah.findUniqueOrThrow({ where: { surahId_ayahNumber: { surahId: 2, ayahNumber: 255 } } });
    const exact = await post(base, { query: 'البقرة 255', limit: 10 }, token);
    assert.equal(exact.status, 200);
    assert.equal(exact.json.success, true);
    assert.equal(typeof exact.json.requestId, 'string');
    assert.deepEqual(Object.keys(exact.json.data), ['mode', 'results']);
    assert.equal(exact.json.data.mode, 'exact');
    assert.equal(exact.json.data.results.length, 1);
    assert.deepEqual(exact.json.data.results[0], {
      surahId: 2,
      ayahNumber: 255,
      surahNameAr: 'البقرة',
      text: db255.textAr,
      page: db255.page,
      juz: db255.juz,
      score: 1,
    });

    console.log('  [enabled] exact: 2:255-257');
    const range = await post(base, { query: '2:255-257', limit: 10 }, token);
    assert.equal(range.status, 200);
    assert.equal(range.json.data.mode, 'exact');
    assert.deepEqual(range.json.data.results.map((r: any) => r.ayahNumber), [255, 256, 257]);

    console.log('  [enabled] exact: Al-Baqarah 255 (English name)');
    const english = await post(base, { query: 'Al-Baqarah 255' }, token);
    assert.equal(english.status, 200);
    assert.equal(english.json.data.results[0].ayahNumber, 255);

    console.log('  [enabled] search: آيات عن الصبر');
    const search = await post(base, { query: 'آيات عن الصبر', limit: 5 }, token);
    assert.equal(search.status, 200);
    assert.equal(search.json.data.mode, 'search');
    assert.ok(search.json.data.results.length > 0 && search.json.data.results.length <= 5);
    for (const r of search.json.data.results) {
      assert.ok(r.score > 0 && r.score <= 1);
      assert.deepEqual(Object.keys(r), ['surahId', 'ayahNumber', 'surahNameAr', 'text', 'page', 'juz', 'score']);
    }

    console.log('  [enabled] ruling question → ayah list only, no generated answer');
    const ruling = await post(base, { query: 'ما حكم الربا', limit: 5 }, token);
    assert.equal(ruling.status, 200);
    assert.deepEqual(Object.keys(ruling.json.data), ['mode', 'results']);
    assert.equal(ruling.json.data.mode, 'search');

    console.log('  [enabled] invalid references and bodies → 400');
    for (const [body, reason] of [
      [{ query: '2:999' }, 'AYAH_OUT_OF_RANGE'],
      [{ query: 'البقرة 999' }, 'AYAH_OUT_OF_RANGE'],
      [{ query: '999:1' }, 'INVALID_SURAH_NUMBER'],
      [{ query: 'unknown 255' }, 'UNKNOWN_SURAH'],
      [{ query: '2:1-100' }, 'RANGE_TOO_LARGE'],
    ] as const) {
      const r = await post(base, body, token);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.json.code, 'VALIDATION_ERROR');
      assert.deepEqual(r.json.details, { reason }, JSON.stringify(body));
    }
    for (const body of [{}, { query: '' }, { query: '   ' }, { query: 'x'.repeat(201) }, { query: 'الصبر', limit: 51 }, { query: 'الصبر', limit: 0 }, { query: 'الصبر', limit: 'abc' }]) {
      const r = await post(base, body, token);
      assert.equal(r.status, 400, JSON.stringify(body).slice(0, 60));
      assert.equal(r.json.code, 'VALIDATION_ERROR');
    }

    assert.deepEqual(outbound, [], 'no outbound requests (no AI provider, no external Quran API)');
    console.log('  [enabled] OK');
  } finally {
    server.close();
    await hardDeleteUserAccount(user.id, { blockIdentity: false });
    await prisma.$disconnect();
  }
}

(process.argv.includes(ENABLED_CHILD_FLAG) ? runEnabledChild() : runDisabled()).catch((err) => {
  console.error(err);
  process.exit(1);
});
