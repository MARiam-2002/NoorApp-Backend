# Noor AI — Phase 0 Repository Audit

> Date: 2026-09-27 · Scope: read-only inspection of `NoorApp-Backend` · Nothing was implemented, installed, migrated or deployed.
> Every statement below is based on files in this repository (paths and line numbers given). Where something does not exist, it says **not found**.

---

## 1. Current Backend Architecture

| Area | What exists | Where |
|---|---|---|
| Runtime | Node `24.x`, Express `^5.2.1`, TypeScript `^5.8.3` (compiled with `tsc` to `dist/`) | `package.json` |
| Data | Prisma `^6.19.3` + PostgreSQL (Neon, Frankfurt, pooled) | `prisma/schema.prisma`, `src/lib/prisma.ts` |
| Hosting | Railway, Nixpacks, `npm run build` / `npm start`, healthcheck `/api/v1/health` | `railway.json` |
| Legacy target | Vercel handler with an **8.5 s watchdog** (`api/index.js:546`) — incompatible with long streams; production is Railway | `vercel.json`, `api/index.js` |
| Migrations | Custom production auto-migrator applies `prisma/migrations/*/migration.sql` at boot, fire-and-forget | `src/app.ts:18` `runMigrationsIfNeeded()` |
| Layout | `routes/` → `controllers/` (`asyncHandler`) → `services/` (Prisma direct, no repository layer) → `lib/` (infra) → `shared/` (constants, utils, types) | `src/` |
| Naming | kebab-case files with role suffix (`khatmah-plan.service.ts`, `azan-audio.controller.ts`); routers named `xxxRouter` | — |

### 1.1 Middleware order (`src/app.ts:133` `createApp`)
1. `requestIdMiddleware` (echoes / generates `X-Request-ID`) — `src/middleware/common.ts:28`
2. `requestDiagnosticsMiddleware` → `logApiRequestComplete` — `common.ts:43`
3. `applySecurityMiddlewares` — `src/middleware/http.ts`: `trust proxy=1`, `helmet` (CSP), `cors`, **`compression()` global (line 91)**, `hpp`, `cookieParser`
4. `httpLogger` (morgan, path-only, no query/IP/UA)
5. `express.json({ limit: '10mb' })`, `urlencoded` (10 mb)
6. `GET /` landing, `legalRouter` (`/privacy`, `/delete-account`), Swagger
7. `app.use('/api/v1', apiRateLimiter, v1Router)`
8. `notFoundHandler`, `errorHandler`

No HTTP server timeouts are configured (`server.timeout`/`requestTimeout` not set). Outgoing `fetch` calls use per-call timeouts (Quran Foundation 8 s, Qurtubi 10 s).

### 1.2 API versioning
`API_PREFIX = '/api/v1'` (`src/config.ts:4`). `src/routes/index.ts` mounts: `/health`, `/auth`, `/profile`, `/dashboard`, `/prayers`, `/azan`, `/salawat`, `/journey`, `/quran`, `/challenges`, `/content`, `/notifications`, `/tasbih`, `/tasbihs`, `/qibla`, `/adhkar`, `/devices`, `/cron`, `/ayah`, `/stances`, `/nawafel`. **No `/ai` mount exists.**

### 1.3 Response envelope & errors
- `sendSuccess / sendError / sendPaginated / sendCursorPaginated` — `src/shared/utils/response.ts` (success: `{ success, message, data, meta, timestamp, requestId }`; error adds `code`, `blame`, `nextCheck`, `errors`, `details`).
- `AppError(message, statusCode, code, details?)` — `src/lib/errors.ts:3`.
- `ErrorCodes` (`src/config.ts:132`): VALIDATION_ERROR, UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, INTERNAL_SERVER_ERROR, INVALID_CREDENTIALS, USER_NOT_FOUND, EMAIL_ALREADY_EXISTS, INVALID_TOKEN, TOKEN_EXPIRED, REFRESH_TOKEN_REQUIRED, RATE_LIMIT_EXCEEDED, DATABASE_ERROR, TAFSIR_TEMPORARILY_UNAVAILABLE.
- `errorHandler` (`common.ts:101`): ZodError → 400; Prisma P2002/P2025/P2003/P2000 mapping; AppError; JWT errors → 401; production hides stacks; sets `X-Error-Code`.

### 1.4 Authentication
- `authenticate` / `optionalAuthenticate` — `src/middleware/auth.ts:34/64`. HS256 JWT (`src/lib/auth.ts`), one `prisma.user.findUnique` per request, requires `isActive`.
- `req.user = { sub, email, role }` — **no `isGuest`**. Guests = unauthenticated requests.
- `enum UserRole { USER, ADMIN }` exists (`schema.prisma:669`) but **no admin/role middleware exists**; `req.user.role` is never checked.

### 1.5 Rate limiting (`src/middleware/http.ts`)
- `express-rate-limit ^8.6.0`, **default in-memory store** (per process, reset on restart).
- `apiRateLimiter` (line 116): `RATE_LIMIT_WINDOW_MS` (900 000) / `RATE_LIMIT_MAX` (2000), key = hashed bearer token or IP; skips azan/salawat media.
- Auth-specific limiters: login (IP + email, failures only), sign-up, forgot/reset password, delete account.
- Redis: `src/lib/redis.ts` only validates `REDIS_URL` format; no client library; nothing depends on it.

### 1.6 Logging
- Winston (`src/lib/logger.ts`), JSON in production, `service: 'noor-api'`.
- `logApiRequestComplete` / `logApiError` (`src/lib/api-diagnostics.ts:112/146`): `requestId, userId, method, path (no query), route, statusCode, durationMs, code, blame`. **Request/response bodies are never logged**; no IP/UA/email.
- `withPerfTiming` (`src/lib/perf.ts:7`), push diagnostics (`src/lib/push-diagnostics.ts`).

### 1.7 Validation
- Zod `^4.4.3`. Middleware `validate(schema, 'body'|'query'|'params'|'headers')` — `src/lib/validation.ts:30`.
- Real schemas are defined inline in route files or exported from controllers (e.g. `startKhatmahPlanSchema`, `controllers/khatmah-plan.controller.ts:15`). `src/shared/schemas/*` and `src/shared/validation/*` are mostly unused duplicates.

### 1.8 Streaming / SSE / WebSocket
- **Not found**: `text/event-stream`, `flushHeaders`, `res.write`, `EventSource`, socket.io, `ws`.
- Existing streaming is **file/range only**: `streamAzanMediaHandler` (`controllers/azan-audio.controller.ts:60`), `streamSalawatMediaHandler` (`controllers/salawat.controller.ts`), `sendJsonWithRange` (`src/lib/http-range.ts:28`, used by `GET /quran/full-catalog`, sets `Cache-Control: no-transform`).
- `FLUTTER_AUTO_REFRESH_CONTRACT_2026.md:186` currently tells Flutter "Do **not** open Socket.io / WebSocket / SSE" — the AI endpoint will be the first, explicit exception.

### 1.9 CORS / compression / helmet
- CORS from `CORS_ORIGIN`, `credentials: true`, allowed headers `Content-Type, Authorization, X-Requested-With, X-Request-ID, X-Cron-Secret` (`http.ts:36`).
- **`compression()` is global** (`http.ts:91`). The `compression` package buffers output unless the response sets `Cache-Control: no-transform` (or is filtered out) — an SSE route must do this, otherwise tokens arrive in bursts.
- Helmet CSP applies to HTML pages only; JSON/SSE unaffected.

### 1.10 Environment variables (`src/config.ts:13` zod `envSchema`)
Runtime (`NODE_ENV, PORT, HOST, PUBLIC_APP_ORIGIN`), DB (`DATABASE_URL`), HTTP (`CORS_ORIGIN, RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX`), JWT/bcrypt, Google OAuth, logging/Swagger, mail (`MAIL_*`, `RESEND_API_KEY`, `EMAIL_PROVIDER`), storage, cache (`CACHE_PROVIDER, REDIS_URL`), Quran Foundation (`QF_CLIENT_ID, QF_CLIENT_SECRET, QF_ENV`), Firebase, scheduling (`CRON_SECRET, REMINDER_SCHEDULER_ENABLED`), legal (`LEGAL_*`). Accessed via `import { env, appConfig } from './config'`. **No AI variables exist.**

### 1.11 Tests
- No framework: standalone `tsx` scripts with `node:assert/strict` (`scripts/test-*.ts`); some boot `createApp().listen(0)` and use native `fetch`; some touch the real DB.
- `npm test` chains: production-fixes, phase1-perf, salawat, mulk, nawafel, sadaqah-goal, near-prayer, prayer-global, cleanup-no-fcm.

### 1.12 Scheduling / deployment
- In-process minute scheduler `src/lib/reminder-scheduler.ts` (no distributed lock — assumes one replica) + Railway cron → `POST /api/v1/cron/prayer-reminders` (`src/routes/cron.ts`, `CRON_SECRET`).
- Swagger via JSDoc `@openapi` blocks in route files (`src/lib/swagger.ts`).

---

## 2. Existing Quran Infrastructure

### 2.1 Models (`prisma/schema.prisma`)
| Model | Lines | Relevant fields |
|---|---|---|
| `Surah` (`surahs`) | 282–296 | `id Int` 1–114, `nameAr`, `nameEn`, `totalAyahs`, `totalPages`, `revelationType` |
| `Ayah` (`ayahs`) | 298–311 | `surahId`, `ayahNumber`, **`textAr` (Uthmani, full diacritics)**, `page`, `juz`; `@@unique([surahId, ayahNumber])` — **no plain/normalized column, no translation column** |
| `VerseOfTheDay` | 402–412 | copy of ayah text per day |
| `QuranBookmark`, `QuranLastRead`, `QuranReadingHistory`, `Khatmah`, `UserAyahHistory`, `QuranSajdahCompletion` | 313–400, 629–644 | user state only |
| User reading prefs | 28–32 | `quranReciter`, `quranTafsir` (default `Ibn_Kathir`), `quranTranslation`, `quranFontSize`, `quranAutoScrollEnabled` |

### 2.2 Services / libs
- `src/services/quran.service.ts` — catalog, ayahs, juz, pages, search (`searchQuran` line 506), random ayah, full catalog, reciters/tafsirs/translations catalogs (lines 1485/1516/1546), audio (1578), tafsir (1639), translation (1757), bookmarks, khatmah, sajdah.
- `src/services/ayah.service.ts` — session ayah (`getUserAyah` line 136).
- `src/lib/quran-foundation.ts` — QF OAuth2 client-credentials + public `api.quran.com` fallback.
- `src/lib/qurtubi-qul.ts` — Al-Qurtubi from QUL mirror (jsDelivr / GitHub raw), 6 h in-memory cache.
- `src/lib/quran-catalog.ts`, `src/data/surahs.ts` (`CATALOG_SURAHS`), `src/lib/surah-names.ts` (`resolveSurahNameAr/En`).
- `src/shared/utils/arabic-text.ts` — `stripArabicDiacritics`, `ARABIC_DIACRITICS_FOR_TRANSLATE`.
- `sanitizeAyahText` (`quran.service.ts:43–109`) strips BOM and the Bismillah prefix from ayah 1 at read time (duplicated in `ayah.service.ts`).

### 2.3 Endpoints (under `/api/v1`)
| Method + path | Auth | Source |
|---|---|---|
| GET `/quran/surahs`, `/quran/surahs/:surahId`, `/quran/surahs/:surahId/ayahs` | public | DB |
| GET `/quran/juz`, `/quran/juz/:n/surahs`, `/quran/juz/:n/ayahs`, `/quran/pages/:page` | public | DB |
| GET `/quran/search?q&page&limit` | public | DB (see 2.4) |
| GET `/quran/ayahs/random`, `/quran/static-meta`, `/quran/full-catalog` (Range) | public | DB |
| GET `/quran/reciters`, `/quran/tafsirs`, `/quran/translations` | public | hardcoded catalogs |
| GET `/quran/audio` | public | QF recitations → everyayah fallback |
| GET `/quran/tafsir` | public | QUL (Qurtubi) / QF; 503 `TAFSIR_TEMPORARILY_UNAVAILABLE` |
| GET `/quran/translation` | public | QF |
| GET `/quran/sajdah-verses`, `/my-progress`, PATCH toggle | mixed | constant + DB |
| bookmarks, last-read, reading-history, khatmah (+plan), import-local | bearer | DB |
| GET `/ayah`, `/ayah/history` | bearer | DB |
| GET `/content/verse-of-day`, `/content/hadith-of-day`, `/content/static-meta` | public | DB + hadith bank |

### 2.4 Existing Quran search — findings relevant to AI
`searchQuran` (`quran.service.ts:506–616`): query normalized with `stripArabicDiacritics`; DB side uses `translate(...)` + `ILIKE '%q%'` (full table scan, no trigram/tsvector/GIN index).
- **Normalization mismatch**: query maps `ة → ه` and removes tatweel, DB side does not → queries containing `ة` (e.g. "رحمة") can miss matches.
- **Uthmani orthography gap**: stored text is Uthmani (`ٱلصَّلَوٰةَ`, `ٱلزَّكَوٰةَ`); after diacritic removal it becomes `الصلوه`, which will never match the everyday spelling `الصلاة`. Exact/keyword retrieval for AI needs an imla'i (simple) search representation, not just diacritic stripping.
- These are **not** changed in this phase; the AI will use its own normalized index and must not alter `/quran/search` behaviour.

---

## 3. Existing Religious Data

| Content | Stored locally? | Where | Origin |
|---|---|---|---|
| **Quran text** (6 236 ayahs, Uthmani, diacritics) | **Yes, permanently** (DB `ayahs`) + `prisma/data/quran-uthmani.json` (2.1 MB, tracked) | `prisma/seed.ts` `loadAyahs` (line 195) | alquran.cloud edition `quran-uthmani` (Tanzil) |
| Surah metadata | Yes | DB `surahs`, `src/data/surahs.ts`, `prisma/data/surahs.json` | alquran.cloud + hardcoded pages |
| **Tafsir** (7 sources) | **No** — fetched per request, not cached (except Qurtubi 6 h in memory) | `quran-foundation.ts`, `qurtubi-qul.ts` | QF resource ids 14, 15, 16, 90, 91, 94, 169; Qurtubi QUL resource 23 |
| **Translations** (7) | **No** | QF | QF resources |
| Ayah audio | No (URLs) | QF / everyayah | — |
| **Hadith of the Day bank** | **Yes** — `src/shared/data/verified-sahih-hadith-bank.json` (2.3 MB, tracked) + DB `hadiths_of_the_day` (366 rows) | `src/shared/constants/curated-hadiths.ts`, `daily-content.service.ts:96` | built by `scripts/build-verified-hadith-bank.py` from `fawazahmed0/hadith-api@1` Arabic Bukhari/Muslim editions ("derived from sunnah.com collection texts") |
| Hadith bank fields | — | — | `collection, collectionAr, hadithNumber, book, bookHadith, textAr, sourceAr` — **no per-hadith grade** (authenticity = Sahihayn policy), **matn extracts only** (45–240 chars, isnad removed), 4 754 entries, Bukhari + Muslim only |
| Raw hadith editions (ara/eng Bukhari & Muslim) | Local files, **git-ignored** | `prisma/data/hadith/*` | fawazahmed0 |
| Adhkar (100 items, "Hisnul Muslim") | Yes (DB `dhikr_items`, seed `ADHKAR_DATA` lines 411–1350) | `prisma/seed.ts` | in-repo, with `referenceAr` |
| Stances (80 scenarios with rulings + `sourceAr`) | Yes (constant + DB) | `src/shared/constants/stance-situations.ts` | authored in-house |
| Sajdah verses (15) | Yes (constant) | `src/shared/constants/sajdah-verses.ts` | — |
| Nawafel catalog | Yes (constant, titles only) | `src/shared/constants/nawafel.ts` | — |

**Not found**: any Tafsir/Translation/Hadith-collection/Citation Prisma model; any stored tafsir text; any fatwa content; any tsvector/search column.

Attribution in repo: `assets/ATTRIBUTION.md` covers **audio only**. **No Tanzil attribution, no fawazahmed0 license statement** was found. `QURAN_TRANSLATION_SOURCE_AUDIT_2026.md` already flags QF content as "needs verification/licensing" and notes no written license grant exists in the repo.

---

## 4. Existing User Data That Could Become AI Tools (future, read-only)

| Candidate tool | Existing function | Deterministic? | Caveat |
|---|---|---|---|
| Prayer times for user/location/date | `getPrayerSchedule`, `calculateDailyPrayerSchedule`, `computePrayerInstantsAround`, `resolvePrayerTimezone` (`src/services/prayer.service.ts`) | Yes (local `adhan`, 14 methods, high-latitude/polar/Ramadan rules) | `getTodayPrayers(userId)` does not pass madhab |
| Next prayer / countdown | `calculateDailyPrayerSchedule().nextPrayer` | Yes | — |
| Qibla direction | `calculateQibla(lat,lng)`, `getMyQibla(userId)` (`qibla.service.ts`) | Yes | needs saved coordinates |
| Khatmah progress & today's ward | `getKhatmahPlan`, `getKhatmahWithStats` + pure `computeDailyWardFrom*` (`khatmah-plan.service.ts`, `quran.service.ts`) | Yes | **`getKhatmah`/`getKhatmahPlan` upsert** the Khatmah row |
| Last read / bookmarks | `getLastRead`, `listBookmarks` (`quran.service.ts`) | Yes | bookmark `note` is free user text → treat as private, do not send to LLM by default |
| Journey / streaks / weekly stats | `getJourneyProgress`, `getWeeklyStats`, `getJourneyOverview` (`journey.service.ts`) | Yes | **`getTodayJourney` upserts** `DailyProgress` |
| Prayer completions today | `PrayerCompletion` model | Yes | worship data is sensitive (privacy inventory) |
| Hijri date | `formatArabicDateInfo` (`src/utils/date.ts`), Umm al-Qura via `Intl` | Yes | uses server weekday, not user timezone |
| Reminder settings (salawat, mulk, duha, qiyam, khatmah) | profile preference getters | Yes | — |

**Rule for later**: AI tools must call **pure / read-only queries**, never the "get" functions that upsert (`getTodayJourney`, `getKhatmah`, `getKhatmahPlan`, `getTodayTasbih`, `getHadithOfTheDay`, `getUserAyah`).
**Not found**: zakat, nisab, inheritance/faraid calculators (would be new, deterministic code reviewed by a scholar); Hijri↔Gregorian conversion utility.

---

## 5. Existing AI Infrastructure

**None exists.** Evidence:
- No AI SDKs in `package.json` / `package-lock.json` (no `openai`, `@anthropic-ai/sdk`, `@google/genai`, `@qdrant/js-client-rest`, `langchain`, `llamaindex`, `ai`, `pgvector`).
- No AI env vars in `src/config.ts` or `.env.example`.
- No vector columns / `extensions` / `Unsupported("vector")` in `prisma/schema.prisma`.
- No chat/conversation/prompt/moderation code; no SSE/WebSocket.
- Keyword hits were false positives: "AI" in author credits and "QUL / Tarteel AI" (data source attribution, `qurtubi-qul.ts:20`); `prompt: 'consent'` (Google OAuth, `auth.service.ts:600`); "completion" = worship completion models; "streaming" = audio range streaming; `faye-websocket` = transitive dependency of firebase-admin.
- `docs/BACKEND-PRIVACY-DATA-INVENTORY.md:158/222/292` and the privacy policy (`src/routes/legal.ts`) explicitly state no AI/LLM processing of user data.

---

## 6. Missing Components

1. AI configuration (env schema entries, feature flag) and provider abstraction (fast / reasoning / embedding models, all env-driven).
2. `/api/v1/ai/*` routes, controllers, Zod schemas, OpenAPI docs, new error codes.
3. Intent router (reference parser for `البقرة 255`, `2:255`, surah-name variants; classification of personal-fatwa / out-of-scope).
4. Quran exact-lookup tool and reference resolver (`[Q:s:a]`, ranges) over the existing `Ayah` table.
5. Arabic normalization module for retrieval (consistent both sides; imla'i search form for Uthmani text).
6. Licensed, permanently storable tafsir and hadith corpora + ingestion scripts (chunking, versioning, checksums).
7. Qdrant client, collections, payload indexes, hybrid (dense + sparse) retrieval with RRF.
8. Evidence gate (relevance validation with calibrated scores — RRF ranks alone are not calibrated).
9. Prompt/policy layer (system prompt as a reviewed religious artifact), generation with reference-only output.
10. Citation validator + source-text resolver (backend inserts Quran/tafsir/hadith text).
11. Conversation + message persistence, usage metering, per-user quotas (DB-backed; current limiter is in-memory per process).
12. SSE transport (compression bypass, heartbeat, client-abort handling, provider cancellation).
13. Safety: prompt-injection handling, refusal templates, sensitive-topic routing, optional moderation.
14. Retention job + conversation deletion endpoints; privacy policy, Data Safety, inventory updates.
15. Evaluation harness (labeled Arabic dataset, regression tests in the existing `tsx` + `node:assert` style).
16. Religious review process (sign-off on prompt, refusal policy and eval answers).
17. Source registry with license/attribution metadata; Tanzil attribution in app/legal pages.

---

## 7. Proposed Folder Structure (fits current conventions)

The repo is organized by layer (`routes/controllers/services/lib`), not by module. Keep that, grouping AI internals in sub-folders:

```
src/
  routes/ai.ts                          # aiRouter, JSDoc @openapi, mounted at /ai in routes/index.ts
  controllers/ai.controller.ts          # asyncHandler handlers + exported Zod schemas
  services/ai/
    ai-chat.service.ts                  # orchestrator (router → tools → gate → LLM → citations)
    ai-conversation.service.ts          # conversations/messages CRUD, deletion, retention
    ai-usage.service.ts                 # quotas + metering (DB-backed)
    intent/
      intent-router.ts                  # deterministic rules first, fast model fallback
      quran-reference-parser.ts         # "البقرة 255", "2:255", ranges, surah aliases
    tools/
      quran-lookup.tool.ts              # exact ayah/range from Ayah table
      quran-discovery.tool.ts           # keyword + semantic ayah discovery
      tafsir-retrieval.tool.ts
      hadith-retrieval.tool.ts
      prayer-times.tool.ts              # wraps pure prayer.service functions
      khatmah-progress.tool.ts          # read-only queries (no upserts)
    retrieval/
      hybrid-search.ts                  # dense + sparse prefetch, RRF
      evidence-gate.ts
    citations/
      citation-parser.ts                # [Q:2:255] [T:ibn_kathir:2:255] [H:bukhari:1]
      citation-validator.ts             # only retrieved refs allowed
      source-resolver.ts                # canonical text from DB/corpus
    safety/
      policy.ts                         # refusal texts, fatwa/out-of-scope handling
      prompt-injection.ts
    prompts/
      system-prompt.ar.ts               # versioned, reviewed
  lib/
    ai/
      provider.ts                       # AIProvider interface (chat, stream, embed)
      openai.provider.ts                # first implementation (or other, env-selected)
    qdrant.ts                           # client + collection names/aliases
  shared/
    utils/arabic-normalize.ts           # NEW; does not change stripArabicDiacritics
    constants/ai-sources.ts             # source registry: id, edition, license, attribution, storageAllowed
scripts/
  ai-ingest-quran.ts                    # build Quran search/semantic index from DB
  ai-ingest-tafsir.ts                   # only licensed corpora
  ai-ingest-hadith.ts
  test-ai-quran-reference-parser.ts     # tsx + node:assert, added to npm test (no network)
  test-ai-citation-validator.ts
  test-ai-arabic-normalize.ts
  eval-ai.ts                            # offline evaluation runner (manual, not in npm test)
```

---

## 8. Proposed Prisma Changes (future — schema NOT modified)

All models `onDelete: Cascade` from `User`, so the existing `DELETE /auth/me` → `hardDeleteUserAccount` flow removes AI data automatically.

```prisma
model AiConversation {
  id            String      @id @default(uuid())
  userId        String
  title         String?     // derived from first question, max 120 chars
  createdAt     DateTime    @default(now())
  updatedAt     DateTime    @updatedAt
  lastMessageAt DateTime    @default(now())
  user          User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  messages      AiMessage[]
  @@index([userId, lastMessageAt])
  @@map("ai_conversations")
}

model AiMessage {
  id               String         @id @default(uuid())
  conversationId   String
  role             String         // user | assistant
  content          String         // user text, or assistant text with [1] markers
  citations        Json?          // backend-built citation objects
  intent           String?        // quran_lookup | quran_discovery | tafsir | hadith | prayer_tool | fatwa_redirect | out_of_scope
  status           String         // answered | refused_insufficient_evidence | refused_policy | error
  model            String?        // resolved model id (from env)
  promptVersion    String?
  inputTokens      Int?
  cachedTokens     Int?
  outputTokens     Int?
  latencyMs        Int?
  createdAt        DateTime       @default(now())
  conversation     AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  @@index([conversationId, createdAt])
  @@map("ai_messages")
}

model AiUsageDaily {
  id            String   @id @default(uuid())
  userId        String
  day           String   // YYYY-MM-DD in user's timezone (reuse getUserLocalCalendarDay)
  messages      Int      @default(0)
  inputTokens   Int      @default(0)
  outputTokens  Int      @default(0)
  costMicroUsd  Int      @default(0)
  user          User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  @@unique([userId, day])
  @@map("ai_usage_daily")
}

// Optional, recommended for quality loop:
model AiFeedback {
  id        String   @id @default(uuid())
  userId    String
  messageId String
  rating    Int      // 1 | -1
  reason    String?  // wrong_source | wrong_answer | should_refuse | other
  createdAt DateTime @default(now())
  @@unique([userId, messageId])
  @@map("ai_feedback")
}
```

Not proposed as tables (kept in code / Qdrant, matching how catalogs are handled today): source registry (`shared/constants/ai-sources.ts`), corpus chunks (Qdrant payload + ingestion manifests). A Postgres corpus table would only be needed if licensed tafsir/hadith text must be served from our DB — decide after licensing (§12).

---

## 9. Proposed API Contract (draft — NOT implemented)

All routes: `authenticate` (no guest AI in v1), dedicated AI limiter + daily quota, feature flag `AI_ENABLED`. Standard envelope for JSON responses.

### 9.1 `POST /api/v1/ai/chat`
Request:
```json
{
  "conversationId": "uuid | null",
  "message": "ما معنى آية الكرسي؟",
  "stream": true,
  "context": { "surahId": 2, "ayahNumber": 255 },
  "preferences": { "tafsirIds": ["ibn_kathir"], "language": "ar" }
}
```
Validation: `message` 1–1500 chars; `context` optional (from "Ask about this ayah" in the reader); `tafsirIds` limited to the licensed registry.

**Non-stream (`stream:false`)** → `200` envelope:
```json
{
  "success": true,
  "data": {
    "conversationId": "…", "messageId": "…",
    "status": "answered",
    "intent": "tafsir",
    "answer": "آية الكرسي … [1] … [2]",
    "citations": [
      { "citationId": 1, "sourceType": "quran", "sourceName": "القرآن الكريم", "reference": "البقرة: 255",
        "surahId": 2, "ayahNumber": 255, "text": "<canonical text from Ayah table>" },
      { "citationId": 2, "sourceType": "tafsir", "sourceId": "ibn_kathir", "sourceName": "تفسير ابن كثير",
        "reference": "البقرة: 255", "surahId": 2, "ayahNumber": 255, "excerpt": "<licensed excerpt>",
        "attribution": "…" }
    ],
    "disclaimer": "هذه إجابة معرفية من مصادر معتمدة وليست فتوى.",
    "usage": { "remainingToday": 17 }
  }
}
```
Refusal (still `200`, `status: "refused_insufficient_evidence"`):
`"answer": "لا أملك معلومات موثوقة كافية للإجابة عن هذا السؤال من المصادر المعتمدة لدي."`, `citations: []`.
Personal fatwa: `status: "refused_policy"`, `intent: "fatwa_redirect"`, answer points to an approved institution (no ruling).

**Stream (`stream:true`)** → `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`:
```
event: meta       data: {"conversationId":"…","messageId":"…","intent":"tafsir"}
event: status     data: {"stage":"retrieving"}        // retrieving | validating | generating
event: citation   data: {<citation object>}           // emitted when a reference is validated
event: delta      data: {"text":"آية الكرسي … [1]"}    // text with numeric markers only; raw [Q:…] never leaves the backend
event: done       data: {"status":"answered","citations":[…],"usage":{"remainingToday":17}}
event: error      data: {"code":"AI_PROVIDER_UNAVAILABLE","message":"…"}
: ping                                                  // heartbeat every 15 s
```
The backend buffers model output until each reference token is complete, validates it, then emits `citation` + `delta`. Invalid references are dropped; above a threshold the whole answer fails closed to the refusal message.

Errors (envelope): `401 UNAUTHORIZED`, `400 VALIDATION_ERROR`, `429 AI_QUOTA_EXCEEDED` / `RATE_LIMIT_EXCEEDED`, `503 AI_DISABLED` / `AI_PROVIDER_UNAVAILABLE` (new, additive codes).

### 9.2 `GET /api/v1/ai/conversations?cursor&limit`
Cursor-paginated (`sendCursorPaginated`): `[{ id, title, lastMessageAt, createdAt }]`.

### 9.3 `GET /api/v1/ai/conversations/:id`
`{ id, title, messages: [{ id, role, content, status, citations, createdAt }] }` — only the owner's conversation (404 otherwise).

### 9.4 `DELETE /api/v1/ai/conversations/:id` and `DELETE /api/v1/ai/conversations` (recommended additions for privacy)
Hard delete, `204`.

### 9.5 `GET /api/v1/ai/usage`
`{ day, messagesUsed, dailyLimit, remaining, resetsAt }`.

### 9.6 `POST /api/v1/ai/quran-discovery`
Deterministic, **no free-text generation** — safest first shippable feature.
Request `{ "query": "آيات عن الصبر" | "البقرة 255" | "2:255-257", "limit": 10 }`.
Response `{ "mode": "exact" | "search", "results": [{ "surahId", "ayahNumber", "surahNameAr", "text", "page", "juz", "score" }] }` with text always from the `Ayah` table.

---

## 10. Qdrant Integration Plan (no account/collections created)

| Collection | Points | Payload (indexed fields in **bold**) | Stored text? |
|---|---|---|---|
| `quran` | 6 236 (one per ayah; id = surah*1000+ayah) | **surahId**, **ayahNumber**, **juz**, page, surahNameAr, `searchText` (normalized imla'i form), `embeddingModel`, `normVersion` | Only normalized search text; display text always from Postgres `Ayah` |
| `tafsir` | chunks per ayah/range (≈300–800 tokens) | **sourceId**, **surahId**, ayahFrom, ayahTo, chunkIndex, edition, licenseId, attribution, `embeddingModel`, `normVersion`, checksum | Only if license permits permanent storage (§12) |
| `hadith` | one per hadith | **collection**, hadithNumber, book, bookHadith, **grade**, gradeSource, sourceAr, licenseId | Only if license permits |

- **Vectors per point**: named `dense` (env `AI_EMBEDDING_MODEL`, dimensions from env; evaluate full vs reduced dims) + named `sparse` (BM25 with IDF modifier). Because Qdrant's default BM25 is English-tuned, apply **our own Arabic normalization before indexing and at query time** and disable language-specific stemming/stopwords (or use the multilingual tokenizer) — decided by evaluation.
- **Arabic normalization (one function, same both sides)**: NFKC; remove harakat, Quranic annotation marks (U+06D6–06ED), U+0670 superscript alef, U+08E4–08FF; remove tatweel; `ٱ آ أ إ → ا`; `ى → ي`; `ة → ه`; collapse spaces. For Quran, index an **imla'i/simple text form** (e.g. Tanzil *simple-clean*, same license family as the stored Uthmani text — verify) so `الصلاة` matches `ٱلصَّلَوٰةَ`.
- **Hybrid retrieval**: Query API with two prefetches (dense top 20, sparse top 20) → **RRF** fusion → top ~20 → evidence gate → top 5–8 to the LLM. Payload filters (e.g. `sourceId` from user's tafsir choice, `surahId` from context).
- **Quran**: exact reference → Postgres (no vectors). Topic questions → `quran` hybrid search. Vector results never replace an explicit reference.
- **Evidence gate**: RRF scores are rank-based and not calibrated, so sufficiency cannot be thresholded on them. Use a relevance judgement per candidate (fast model with strict JSON verdicts, or a reranker) + minimum count of supporting passages; otherwise refuse.
- **Reindexing**: collection aliases (`tafsir` → `tafsir_v1`), deterministic point ids, `embeddingModel`/`normVersion` in payload, Batch embedding for ingestion.
- **Region**: same region as Neon (EU/Frankfurt). Railway service currently runs in `sfo` → cross-Atlantic latency on every retrieval; moving Railway to EU is recommended before AI.

---

## 11. Security & Privacy Requirements

| Topic | Current state | Required |
|---|---|---|
| API keys | QF/Firebase secrets only in env via zod schema | Add AI/Qdrant keys to `envSchema` (optional, feature disabled when missing); never returned to Flutter; never logged |
| Rate limiting | Global in-memory `apiRateLimiter` (2000/15 min) | Dedicated AI limiter (per user, short window) **plus DB-backed daily quota** (`AiUsageDaily`) — in-memory counters reset on deploy |
| Usage limits | none | Per-user daily messages + token budget; global monthly spend cap with kill switch (`AI_ENABLED=false`) |
| Prompt injection | n/a | Retrieved text wrapped as quoted data; system policy not overridable; model can only output references from the retrieved set; validator rejects anything else; no tool arguments taken from retrieved text |
| Logging | Bodies never logged (good) | Keep: log `requestId, userId, intent, status, token counts, latency, model` — **never message text or retrieved passages** |
| Conversation deletion | account deletion cascades | Per-conversation + delete-all endpoints; cascade from User |
| Retention | n/a | Auto-purge after N days (e.g. `AI_RETENTION_DAYS`) via existing cron route pattern |
| Provider data use | n/a | Use provider settings where API data is not used for training; evaluate EU data residency; record provider as processor |
| Privacy policy (`src/routes/legal.ts`) | States no AI; processors table has no AI provider | Add AI data category (questions, answers, optional context), provider in §12 table, transfers §19, retention §15/§16, delete-account page list |
| Privacy inventory | `docs/BACKEND-PRIVACY-DATA-INVENTORY.md` says "AI / LLM user data: Not found" | Update §1.7, §2, §6 |
| Google Play Data Safety | Current answers assume no AI | Declare user-generated content (AI questions) collected, purpose app functionality, processed by a service provider, deletable; religious questions treated as sensitive |
| Flutter | — | Do not send AI message text to Firebase Analytics/Crashlytics |

---

## 12. Source Licensing Blocker

**Do not ingest any corpus into Qdrant until its row below is cleared.** Nothing external has been copied into the repo by this audit.

| Source | Currently | Permanent storage / embedding | Status |
|---|---|---|---|
| Quran text (Tanzil via alquran.cloud, stored in `ayahs` + `prisma/data/quran-uthmani.json`) | Stored | Tanzil text is distributed for verbatim copying with attribution and no modification — **verify current Tanzil terms and add the required attribution/link (none exists in the repo today)**. Normalized search copies must be derived for indexing only, never displayed | **Likely OK after attribution — verify** |
| Imla'i/simple Quran search text | Not stored | Same as above if taken from Tanzil | Verify with Tanzil terms |
| Tafsir via **Quran Foundation API** (Ibn Kathir 14, Tabari 15, Muyassar 16, Qurtubi fallback 90, Saadi 91, Baghawi 94, Ibn Kathir EN 169) | Live fetch, not stored | QF Developer Terms limit storage (documented short-term storage limit unless Content Sync or written license) and forbid redistribution as datasets → **embedding QF tafsir into Qdrant is not permitted without written permission** | **BLOCKED — needs QF written license / Content Sync approval** |
| Al-Qurtubi via QUL / `spa5k/tafsir_api` | Live fetch, 6 h memory cache | Classical wording public domain (per `qurtubi-qul.ts:19`); packaging credited as MIT — **verify the repository license file and QUL terms** | Verify |
| Other classical tafsir (Tabari, Ibn Kathir, Baghawi) from a non-QF source | Not present | Classical wording generally public domain, but **specific digital editions may carry rights** | Verify per edition |
| Al-Saadi, Al-Muyassar (modern works), Ibn Kathir English abridgement | Via QF | Modern editions/translations are likely copyrighted | **Requires permission** |
| Translations (QF) | Live fetch | Same QF terms | **BLOCKED for storage** |
| Hadith bank (`verified-sahih-hadith-bank.json`, fawazahmed0/hadith-api, sunnah.com-derived) | Stored (tracked in git) | **No license statement found in repo**; upstream derivation from sunnah.com requires verification. Also: matn extracts only, no per-hadith grade | **Verify license before AI use**; for AI a complete licensed dataset with collection/number/grade is needed |
| Adhkar ("Hisnul Muslim" compilation, seeded) | Stored | Texts are du'a/hadith, but compilation/translations may be protected | Verify (not in AI v1 scope) |
| Stances rulings (in-house) | Stored | Owned content, but **not an approved fatwa source** | Exclude from AI evidence |
| Fatwa (e.g. Dar al-Ifta) | Not present | Requires written permission | Out of scope this phase |

---

## 13. Implementation Order (small, reversible phases; everything behind `AI_ENABLED=false`)

| Phase | Scope | Exit criteria |
|---|---|---|
| **1 — AI foundation** | env schema entries (optional), feature flag, `AIProvider` interface (no calls in tests), `/ai` router skeleton returning `503 AI_DISABLED`, new error codes, OpenAPI stubs | `npm test` + typecheck green; no behaviour change for existing routes |
| **2 — Quran exact tools** | reference parser (Arabic/English surah names, `2:255`, ranges), `quran-lookup.tool`, citation parser/resolver for `[Q:…]`, new `arabic-normalize.ts`, `POST /ai/quran-discovery` (exact + DB keyword search on a normalized form) | parser/normalizer unit tests; zero LLM; text only from `Ayah` |
| **3 — Knowledge ingestion** | only **cleared** sources (§12); source registry with license/attribution; ingestion scripts with manifests/checksums | written license evidence per source |
| **4 — Qdrant retrieval** | client, collections via script, hybrid dense+sparse RRF, EU region | retrieval eval on labeled set (Recall@k) |
| **5 — Evidence validation** | relevance judge/reranker, sufficiency rules, refusal path | unanswerable set refused ≥ target |
| **6 — LLM generation** | reviewed system prompt (versioned), reference-only output, model routing fast/reasoning from env, citation validator | 0 fabricated Quran text; 100% citations ∈ retrieved set on eval |
| **7 — Conversations & usage** | Prisma models (§8) + migration, quotas, `GET /ai/usage`, conversations CRUD + delete | cascade delete verified |
| **8 — SSE** | `text/event-stream` with `no-transform` (compression bypass), heartbeat, client-abort → provider abort, event schema §9 | streams smoothly on Railway; aborted requests stop billing |
| **9 — Safety** | prompt-injection tests, fatwa redirect, sensitive topics, retention job, logging audit | red-team set passes; logs contain no message text |
| **10 — Testing & evaluation** | `scripts/test-ai-*.ts` in `npm test` (offline), `scripts/eval-ai.ts` (manual, paid), 300–500 labeled questions + public Arabic Islamic QA benchmarks | religious reviewer sign-off |
| **11 — Flutter integration** | handoff doc: chat screen, SSE client, citation chips → open ayah in mushaf, "Ask about this ayah", feedback, disclaimer, usage UI; privacy policy + Data Safety updated **before** release | end-to-end on production with flag on for testers only |

---

## 14. Risks

| Type | Risk | Mitigation |
|---|---|---|
| Religious | Misquoted/invented ayah or hadith | Model outputs references only; backend inserts canonical text; validator fails closed |
| Religious | Misattribution / wrong tafsir source | Citations must match retrieved chunk ids; source registry |
| Religious | Personal fatwa, sectarian/madhhab bias, sensitive topics (divorce, inheritance, takfir) | Intent routing to refusal/redirect; reviewed system prompt; scholar review of eval set |
| Religious | Hadith bank has no per-hadith grade and only matn extracts | Do not present as full hadith text; require complete graded dataset for hadith RAG |
| Licensing | QF tafsir/translations cannot be stored/embedded without permission | §12 gate; Quran-only first release |
| Licensing | Missing Tanzil / hadith-source attribution today | Add attribution before AI launch |
| Technical | Uthmani vs imla'i spelling breaks keyword search; existing `/quran/search` `ة` mismatch | Separate AI normalization + imla'i search form; leave existing endpoint untouched |
| Technical | Global `compression()` buffers SSE | `Cache-Control: no-transform` on SSE responses |
| Technical | In-memory rate limits and scheduler assume a single replica | DB-backed quotas; revisit before scaling replicas |
| Technical | Railway `sfo` ↔ Neon/Qdrant Frankfurt latency | Move service to EU |
| Technical | Some "get" services write (upserts) | AI tools use pure read queries only |
| Technical | No request timeout on server; long streams | Per-stream max duration + heartbeat; provider timeouts |
| Privacy | Religious questions are sensitive personal data sent to a third-party provider | Policy/Data Safety updates, no-training setting, retention, deletion, no content in logs |
| Cost | Unbounded usage / expensive model on every question | Fast model default, reasoning model only by rule, per-user quotas, monthly cap, prompt caching, Batch for ingestion |
| Vendor | Model names/prices change | All model ids in env; provider interface |

---

## 15. Final Recommendation

Based only on what exists in this repository:

1. **Start with Phase 1 + Phase 2 only.** The one religious corpus that is already stored permanently, canonical and well-indexed by `(surahId, ayahNumber)` is the **Quran** (`Ayah` table). A deterministic **Quran exact lookup + Quran discovery** (`POST /ai/quran-discovery`) can be built with **no LLM, no Qdrant, no external calls and no new licensing exposure** beyond adding Tanzil attribution. It also delivers the reference parser, normalizer and citation resolver that every later phase depends on.
2. **Do not ingest tafsir yet.** All tafsir except Al-Qurtubi comes from Quran Foundation under terms that do not allow permanent storage/embedding without permission. Obtain written permission (or Content Sync approval) or source verifiably licensed editions first.
3. **Do not use the current hadith bank for AI answers yet**: verify its license and replace/augment it with a complete dataset that preserves collection, number and grade.
4. **First LLM feature (after Phases 3–6)**: tafsir questions restricted to cleared sources, with the model returning only `[Q:…]`/`[T:…]` references and the backend inserting all religious text.
5. **Before any public release**: update the privacy policy, privacy inventory and Google Play Data Safety; add conversation deletion and retention; move Railway to EU; obtain religious review of the system prompt and evaluation set.
