/**
 * Noor AI Phase 1 foundation: AI stays OFF by default, /ai/status answers 503
 * AI_DISABLED, existing routes/auth are untouched, and nothing calls an AI provider.
 * Run: npx tsx scripts/test-ai-foundation.ts
 * (re-runs itself once with AI_ENABLED=true to check the enabled path)
 */
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const ENABLED_CHILD_FLAG = '--enabled-child';
const isEnabledChild = process.argv.includes(ENABLED_CHILD_FLAG);

const AI_ENV_KEYS = [
  'AI_ENABLED',
  'AI_PROVIDER',
  'AI_FAST_MODEL',
  'AI_REASONING_MODEL',
  'AI_EMBEDDING_MODEL',
  'AI_MAX_MESSAGE_LENGTH',
  'AI_DAILY_MESSAGE_LIMIT',
  'AI_MAX_STREAM_SECONDS',
];

const CHILD_MODEL_IDS = {
  AI_FAST_MODEL: 'phase1-test-fast-model',
  AI_REASONING_MODEL: 'phase1-test-reasoning-model',
  AI_EMBEDDING_MODEL: 'phase1-test-embedding-model',
};

const AI_HOST_PATTERN =
  /openai\.com|anthropic\.com|generativelanguage\.googleapis\.com|aiplatform\.googleapis\.com|qdrant|fanar\.qa|cohere|mistral\.ai|groq\.com|openrouter\.ai/i;

const outboundRequests: string[] = [];
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const host = new URL(url).hostname;
  if (host !== '127.0.0.1' && host !== 'localhost') outboundRequests.push(url);
  return realFetch(input, init);
}) as typeof fetch;

type JsonResponse = { status: number; json: any };

async function getJson(base: string, pathname: string, token?: string): Promise<JsonResponse> {
  const res = await fetch(`${base}${pathname}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  return { status: res.status, json: (await res.json().catch(() => ({}))) as any };
}

function assertNoAIProviderCalls(label: string): void {
  const aiCalls = outboundRequests.filter((u) => AI_HOST_PATTERN.test(u));
  assert.deepEqual(aiCalls, [], `${label}: AI provider was called`);
  assert.deepEqual(outboundRequests, [], `${label}: unexpected outbound requests`);
}

async function assertExistingRoutesUnchanged(base: string): Promise<void> {
  const health = await getJson(base, '/health');
  assert.equal(health.status, 200, `health returned ${health.status}`);
  assert.equal(health.json.success, true);
  assert.equal(health.json.data.status, 'ok');
  assert.equal(health.json.data.database, 'connected');
  assert.equal('ai' in health.json.data, false, 'health payload must not change');

  const surahs = await getJson(base, '/quran/surahs');
  assert.equal(surahs.status, 200, `quran/surahs returned ${surahs.status}`);
  assert.equal(surahs.json.success, true);
  assert.ok(Array.isArray(surahs.json.data), 'quran/surahs data must stay an array');
  assert.equal(surahs.json.data.length, 114);
  assert.equal(surahs.json.data[0].id, 1);

  const noToken = await getJson(base, '/qibla/my-qibla');
  assert.equal(noToken.status, 401);
  assert.equal(noToken.json.code, 'UNAUTHORIZED');

  const badToken = await getJson(base, '/qibla/my-qibla', 'not-a-real-jwt');
  assert.equal(badToken.status, 401);
  assert.equal(badToken.json.code, 'INVALID_TOKEN');
}

async function runDisabled(): Promise<void> {
  for (const key of AI_ENV_KEYS) delete process.env[key];

  const { aiEnvSchema, buildAIConfig, aiConfig, ErrorCodes } = await import('../src/config');
  const { getAIStatus, isAIConfigured } = await import('../src/services/ai/ai-status.service');
  const { hasAIProviderImplementation } = await import('../src/lib/ai/provider');

  console.log('--- defaults with no AI variables ---');
  const defaults = buildAIConfig(aiEnvSchema.parse({}));
  assert.deepEqual({ ...defaults }, {
    enabled: false,
    provider: 'openai',
    fastModel: '',
    reasoningModel: '',
    embeddingModel: '',
    maxMessageLength: 1500,
    dailyMessageLimit: 20,
    maxStreamSeconds: 120,
  });
  assert.equal(aiConfig.enabled, false, 'AI must be OFF (remove AI_ENABLED from local .env to run this test)');
  assert.equal(ErrorCodes.AI_DISABLED, 'AI_DISABLED');

  console.log('--- invalid/empty AI values never block boot ---');
  const messy = buildAIConfig(
    aiEnvSchema.parse({
      AI_ENABLED: 'yes',
      AI_PROVIDER: '  ',
      AI_MAX_MESSAGE_LENGTH: 'abc',
      AI_DAILY_MESSAGE_LIMIT: '',
      AI_MAX_STREAM_SECONDS: '99999',
    }),
  );
  assert.equal(messy.enabled, false);
  assert.equal(messy.provider, 'openai');
  assert.equal(messy.maxMessageLength, 1500);
  assert.equal(messy.dailyMessageLimit, 20);
  assert.equal(messy.maxStreamSeconds, 120);

  console.log('--- status payload exposes no secrets or model ids ---');
  const enabledConfig = buildAIConfig(aiEnvSchema.parse({ AI_ENABLED: 'true', ...CHILD_MODEL_IDS }));
  assert.equal(hasAIProviderImplementation('openai'), false, 'Phase 1 must not ship a provider');
  assert.equal(isAIConfigured(enabledConfig), false);
  const status = getAIStatus(enabledConfig);
  assert.equal(status.enabled, true);
  assert.equal(status.configured, false);
  assert.deepEqual(status.features, { chat: false, streaming: false, quranDiscovery: true, conversations: false });
  assert.equal(getAIStatus(defaults).features.quranDiscovery, false, 'discovery must be off while AI is disabled');
  const serialized = JSON.stringify(status);
  for (const modelId of Object.values(CHILD_MODEL_IDS)) {
    assert.equal(serialized.includes(modelId), false, `model id leaked: ${modelId}`);
  }
  assert.equal(/key|secret|token|password|database|url/i.test(serialized), false, 'sensitive field leaked');

  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;

  try {
    console.log('--- GET /ai/status → 503 AI_DISABLED (with and without token) ---');
    for (const token of [undefined, 'not-a-real-jwt']) {
      const r = await getJson(base, '/ai/status', token);
      assert.equal(r.status, 503);
      assert.equal(r.json.success, false);
      assert.equal(r.json.code, 'AI_DISABLED');
      assert.equal(r.json.blame, 'FEATURE_DISABLED');
      assert.equal(typeof r.json.message, 'string');
      assert.equal(typeof r.json.requestId, 'string');
      assert.equal(typeof r.json.timestamp, 'string');
      assert.equal('data' in r.json, false);
    }

    console.log('--- no other AI routes exist yet ---');
    const chat = await getJson(base, '/ai/chat');
    assert.equal(chat.status, 503);
    assert.equal(chat.json.code, 'AI_DISABLED');

    console.log('--- existing health / Quran / auth unchanged ---');
    await assertExistingRoutesUnchanged(base);

    console.log('--- no AI dependencies, tables or migrations ---');
    const root = process.cwd();
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    const aiDeps = deps.filter((d) =>
      /^(openai|ai|groq-sdk|cohere-ai|llamaindex|langchain)$|^@(anthropic-ai|google\/genai|google\/generative-ai|qdrant|langchain|ai-sdk|mistralai)\b/.test(d),
    );
    assert.deepEqual(aiDeps, []);
    const schema = fs.readFileSync(path.join(root, 'prisma', 'schema.prisma'), 'utf8');
    assert.equal(/model\s+Ai[A-Z]|ai_conversations|ai_messages|ai_usage/.test(schema), false);
    const migrations = fs.readdirSync(path.join(root, 'prisma', 'migrations'));
    assert.equal(migrations.some((m) => /(^|_)ai(_|$)/i.test(m)), false);

    assertNoAIProviderCalls('disabled');
  } finally {
    server.close();
    await prisma.$disconnect();
  }

  console.log('--- enabled path (child process with AI_ENABLED=true) ---');
  const child = spawnSync(process.execPath, [...process.execArgv, __filename, ENABLED_CHILD_FLAG], {
    env: { ...process.env, AI_ENABLED: 'true', ...CHILD_MODEL_IDS },
    stdio: 'inherit',
  });
  assert.equal(child.status, 0, 'enabled-mode checks failed');

  console.log('ai foundation: OK');
}

async function runEnabledChild(): Promise<void> {
  const { aiConfig } = await import('../src/config');
  const { getAIStatus } = await import('../src/services/ai/ai-status.service');
  const { createApp } = await import('../src/app');
  const { prisma } = await import('../src/lib/prisma');

  assert.equal(aiConfig.enabled, true);
  assert.equal(aiConfig.fastModel, CHILD_MODEL_IDS.AI_FAST_MODEL);
  assert.equal(getAIStatus(aiConfig).configured, false);

  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  try {
    console.log('  [enabled] /ai/status requires authentication');
    const noToken = await getJson(base, '/ai/status');
    assert.equal(noToken.status, 401);
    assert.equal(noToken.json.code, 'UNAUTHORIZED');

    const badToken = await getJson(base, '/ai/status', 'not-a-real-jwt');
    assert.equal(badToken.status, 401);
    assert.equal(badToken.json.code, 'INVALID_TOKEN');

    console.log('  [enabled] existing health / Quran / auth unchanged');
    await assertExistingRoutesUnchanged(base);

    assertNoAIProviderCalls('enabled');
    console.log('  [enabled] OK');
  } finally {
    server.close();
    await prisma.$disconnect();
  }
}

(isEnabledChild ? runEnabledChild() : runDisabled()).catch((err) => {
  console.error(err);
  process.exit(1);
});
