# Noor AI — Phase 1: AI Foundation

> Status: implemented, **OFF by default**. No AI provider, no Qdrant, no database tables, no religious content.
> Based on `NOOR_AI_PHASE_0_AUDIT.md`.

## 1. What was added

| File | Purpose |
|---|---|
| `src/config.ts` | `aiEnvSchema` (optional AI variables, merged into the existing env schema), `AIConfig` type, `buildAIConfig()`, exported `aiConfig`, new error code `AI_DISABLED` |
| `src/lib/ai/provider.ts` | Provider-neutral `AIProvider` interface (`generate`, `stream`, `embed`), request/result types, model **tiers** (`fast` / `reasoning`) instead of model names, empty provider registry (`hasAIProviderImplementation`) |
| `src/services/ai/ai-status.service.ts` | `getAIStatus(config)` / `isAIConfigured(config)` — secret-free status view |
| `src/middleware/ai.ts` | `requireAIEnabled` — returns `503 AI_DISABLED` while the flag is off |
| `src/controllers/ai.controller.ts` | `getAIStatusHandler` (uses `asyncHandler` + `sendSuccess`) |
| `src/routes/ai.ts` | `aiRouter` with OpenAPI JSDoc for `GET /ai/status` |
| `src/routes/index.ts` | mounts `aiRouter` at `/ai` (additive line) |
| `src/lib/api-diagnostics.ts` | additive blame `FEATURE_DISABLED` for `AI_DISABLED`, logged as `warn` instead of `error` |
| `src/lib/swagger.ts` | additive Swagger tag `AI` |
| `.env.example` | documented AI variables |
| `scripts/test-ai-foundation.ts` | tests (see §7) |
| `package.json` | `test:ai-foundation` script, appended to `npm test` |

Nothing else changed. Existing endpoints, response envelopes, field names, auth, Quran, Tafsir, prayer and notification behaviour are untouched.

## 2. How AI is disabled

- `AI_ENABLED` defaults to `false`.
- `aiRouter.use(requireAIEnabled, authenticate)` — the flag check runs **before** authentication, so while disabled every `/api/v1/ai/*` request (with or without a token) receives `503 AI_DISABLED` with **no database lookup** and without revealing which AI routes exist.
- Every AI variable uses `.catch(default)`: a missing, empty or invalid value falls back to its default and can never stop the API from booting. A typo in `AI_ENABLED` (e.g. `yes`, `TRUE`) resolves to **off**.
- Rollback: set `AI_ENABLED=false` (or delete it) and redeploy/restart — no data to clean up.

## 3. Environment variables (all optional)

| Variable | Default | Valid range | Notes |
|---|---|---|---|
| `AI_ENABLED` | `false` | `true` \| `false` | anything else → `false` |
| `AI_PROVIDER` | `openai` | non-empty string | lower-cased; no implementation exists yet |
| `AI_FAST_MODEL` | `""` | string | model id for the fast tier — set only in env |
| `AI_REASONING_MODEL` | `""` | string | model id for the reasoning tier |
| `AI_EMBEDDING_MODEL` | `""` | string | embedding model id |
| `AI_MAX_MESSAGE_LENGTH` | `1500` | 1–10 000 | characters per user message |
| `AI_DAILY_MESSAGE_LIMIT` | `20` | 1–10 000 | per user per day (enforced from Phase 7) |
| `AI_MAX_STREAM_SECONDS` | `120` | 10–600 | hard cap for a streamed answer (enforced from Phase 8) |

No API key variable is added yet; it will be introduced together with the first provider implementation (Phase 6). Model names are **never** hard-coded in code.

## 4. Endpoint

`GET /api/v1/ai/status` — Swagger tag **AI**.

### Disabled (default) → `503`
```json
{
  "success": false,
  "message": "Noor AI is not available yet",
  "code": "AI_DISABLED",
  "blame": "FEATURE_DISABLED",
  "nextCheck": "Feature is switched off on the server; hide its entry point in the app.",
  "timestamp": "2026-09-28T10:30:00.000Z",
  "requestId": "…"
}
```
Same response for every path under `/api/v1/ai/`, with or without `Authorization`. Header `X-Error-Code: AI_DISABLED`.

### Enabled → requires `Authorization: Bearer <accessToken>`
- No/invalid token → `401 UNAUTHORIZED` / `401 INVALID_TOKEN` (existing auth behaviour).
- Valid token → `200`:
```json
{
  "success": true,
  "message": "Noor AI status retrieved successfully",
  "data": {
    "enabled": true,
    "provider": "openai",
    "configured": false,
    "features": { "chat": false, "streaming": false, "quranDiscovery": false, "conversations": false },
    "limits": { "maxMessageLength": 1500, "dailyMessageLimit": 20, "maxStreamSeconds": 120 }
  },
  "meta": {},
  "timestamp": "…",
  "requestId": "…"
}
```
- `configured` is `true` only when a provider implementation exists **and** all three model tiers are set — always `false` in Phase 1.
- Model ids, API keys, database URLs and any other secrets are never returned.
- `features.*` flip to `true` only when the corresponding phase ships; Flutter must gate UI on them.

## 5. Intentionally NOT implemented

- No AI provider implementation, no AI SDK, no external AI calls.
- No `/ai/chat`, `/ai/quran-discovery`, conversations or usage endpoints.
- No SSE/streaming.
- No Prisma models, no migrations, no AI tables.
- No Qdrant client, collections or embeddings.
- No religious content ingestion, no prompts, no sample answers.
- No per-user quota enforcement (config only).

## 6. How Phase 2 builds on this

> Phase 2 is implemented — see `docs/NOOR_AI_PHASE_2.md`. `features.quranDiscovery` is now `true` whenever AI is enabled.

Phase 2 (Quran exact tools) will add, behind the same flag and router:
1. `src/shared/utils/arabic-normalize.ts` — new normalizer (does not change `stripArabicDiacritics` or `/quran/search`).
2. `src/services/ai/intent/quran-reference-parser.ts` — `البقرة 255`, `2:255`, ranges, surah-name variants.
3. `src/services/ai/tools/quran-lookup.tool.ts` — exact ayah/range from the existing `Ayah` table.
4. `src/services/ai/citations/*` — `[Q:s:a]` parser and resolver (text always from Postgres).
5. `POST /api/v1/ai/quran-discovery` — deterministic, no LLM; sets `features.quranDiscovery: true`.
6. Tests in the same `tsx` + `node:assert` style.

## 7. Tests

`npm run test:ai-foundation` (also part of `npm test`):
1. Defaults with no AI variables (`enabled: false`, limits 1500/20/120).
2. Invalid/empty AI values fall back to defaults (boot never fails).
3. Status payload contains no model ids or secret-like fields; `configured: false`; no provider implementation registered.
4. `GET /ai/status` → `503 AI_DISABLED` (with and without token), standard error envelope, `blame: FEATURE_DISABLED`.
5. Other `/ai/*` paths → `503 AI_DISABLED`.
6. `/health` unchanged (200, `database: connected`, no new fields).
7. `/quran/surahs` unchanged (114 surahs, array).
8. Existing auth unchanged (`401 UNAUTHORIZED` without token, `401 INVALID_TOKEN` with a bad token).
9. No AI dependencies in `package.json`, no AI models in `schema.prisma`, no AI migrations.
10. Every outbound `fetch` is recorded — the test fails on any non-local request (no AI provider called).
11. Re-runs itself with `AI_ENABLED=true`: `/ai/status` requires authentication and existing routes are still unchanged.

The test uses the local `.env` database (read-only queries), like the other HTTP tests. Run it with `AI_ENABLED` unset locally.
