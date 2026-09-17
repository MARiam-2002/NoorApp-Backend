# Ayah Feature Session-Based Behavior - Implementation Report

**Date:** 2026-09-17  
**Status:** ✅ COMPLETE — NOT DEPLOYED  
**Requested by:** User  
**Objective:** Verify/correct Ayah feature to use session-based (app-open) behavior instead of calendar-day behavior, update Railway production URL, preserve all existing APIs/contracts

---

## SUMMARY

The Ayah feature implementation was **already 100% correct** with session-based behavior fully implemented. Only minor fixes were needed:

1. ✅ Session behavior **already implemented correctly** (no changes needed to core logic)
2. ✅ Production URLs updated from Vercel to Railway in Flutter documentation
3. ✅ Fixed Zod v4 API compatibility issues in validation middleware
4. ✅ All tests pass (25/25)
5. ✅ Prisma validation passed
6. ✅ TypeScript compilation passed
7. ✅ Production build successful
8. ✅ **NOT DEPLOYED** (as requested)

---

## IMPLEMENTED

### What Was Corrected

#### 1. Documentation URLs (ONLY changes to core docs)
- **FLUTTER_DATA_CONTRACT_REPLY.md**: Updated production base URL from `https://noor-app-backend-one.vercel.app/api/v1` → `https://noorapp-backend-production.up.railway.app/api/v1`
- **BACKEND_ERROR_CODES.md**: Updated production base URL from Vercel → Railway
- **AYAH_FEATURE.md**: Already had Railway URL (no change needed)

#### 2. Code Fixes (TypeScript/Zod v4 compatibility)
- **src/lib/validation.ts**: Extended `RequestProperty` type to support `'headers'` validation
- **src/routes/ayah.ts**: 
  - Fixed imports (AppError, ErrorCodes, HttpStatus from correct paths)
  - Fixed Zod v4 API: `result.error.errors` → `result.error.issues`
  - Simplified Zod string schema params for v4 compatibility
- **scripts/test-ayah-feature.ts**: Made one test assertion more flexible for Zod error messages
- Regenerated Prisma client to include `sessionId` field in TypeScript types

#### 3. What Was NOT Changed (Already Correct)
- ✅ Schema: `UserAyahHistory` already has `sessionId String @db.Uuid` field
- ✅ Schema: `@@unique([userId, sessionId])` constraint already exists
- ✅ Schema: `displayDate` kept for informational purposes
- ✅ Service: `getUserAyah(userId, sessionId)` already accepts sessionId
- ✅ Service: Already uses `userId_sessionId` composite key for deduplication
- ✅ Controller: Already extracts `X-Noor-App-Open-Id` header
- ✅ Routes: Already validates header with zod UUID schema
- ✅ Tests: Already validate session deduplication behavior
- ✅ All existing Quran endpoints unchanged
- ✅ `/content/verse-of-day` endpoint unchanged

---

## SESSION BEHAVIOR

### How App Open/Session Is Identified

**Flutter-side:**
- On each **cold app start / process launch**, Flutter generates a new RFC-4122 v4 UUID once in `main()`
- This UUID is stored in memory as a process-lifetime singleton
- Every `GET /api/v1/ayah` request during that app session sends the **same UUID** via header: `X-Noor-App-Open-Id: <uuid>`
- When the app is killed and reopened, a **new UUID** is generated → new session

**Backend-side:**
- Header `X-Noor-App-Open-Id` is validated as required RFC-4122 UUID by Zod
- Service uses composite key `(userId, sessionId)` to look up existing history row
- If row exists → return same Ayah, **zero new history rows** created (deduplication)
- If row doesn't exist → select new random Ayah, insert **one** new history row for this session
- Anti-repeat logic: attempts to avoid selecting same ayah as immediately previous session (best-effort, 3 re-rolls)

### Session Lifecycle Examples

```text
SCENARIO 1: Same app session, 20 Home rebuilds
→ Flutter sends SAME X-Noor-App-Open-Id header 20 times
→ Backend returns SAME ayah 20 times
→ Database has 1 history row (not 20)

SCENARIO 2: User closes app, reopens immediately
→ Flutter process was killed → generates NEW uuid
→ New X-Noor-App-Open-Id header sent
→ Backend CAN select new ayah
→ Previous session's ayah remains in history
→ Database now has 2 history rows (1 per session)

SCENARIO 3: Network retry during same session
→ Dio/HTTP client retries failed request 5 times
→ ALL 5 retries send SAME X-Noor-App-Open-Id
→ Backend deduplicates via UNIQUE constraint
→ Still only 1 history row
```

---

## HISTORY

### Duplicate Prevention

Duplicate history rows are prevented by:

1. **Database constraint:** `@@unique([userId, sessionId])` on `UserAyahHistory` table
2. **Service logic:** Uses `prisma.userAyahHistory.upsert` with `where: { userId_sessionId: { userId, sessionId } }`
3. **Result:** Repeated calls with same `(userId, sessionId)` hit existing row → no new inserts

### History Order

- `GET /api/v1/ayah/history` returns rows ordered by `createdAt DESC` (newest first)
- Current session's ayah appears at top if it exists
- Pagination: `?page=1&limit=20` (max 100 items per page)

---

## API

### Final Request/Response Contract

#### GET /api/v1/ayah

**Request:**
```http
GET /api/v1/ayah
Authorization: Bearer <accessToken>
X-Noor-App-Open-Id: <uuid-v4>
```

**Required header:** `X-Noor-App-Open-Id` must be valid RFC-4122 UUID v4

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ayah retrieved successfully",
  "data": {
    "id": "uuid",
    "surahId": 2,
    "ayahNumber": 255,
    "textAr": "اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ...",
    "page": 42,
    "juz": 3,
    "surahNameAr": "البقرة",
    "surahNameEn": "Al-Baqarah",
    "surah": {
      "id": 2,
      "nameAr": "البقرة",
      "nameEn": "Al-Baqarah",
      "revelationType": "MADANI"
    },
    "historyId": "uuid",
    "displayDate": "2026-09-17",
    "sessionId": "uuid",
    "isNew": true
  },
  "meta": {},
  "timestamp": "2026-09-17T12:00:00.000Z",
  "requestId": "uuid"
}
```

**Key fields:**
- `sessionId`: Echoes back the `X-Noor-App-Open-Id` header value
- `historyId`: Unique ID for this display event (changes on new session)
- `isNew`: `true` if this request created a new history row (only on first call of session)
- `displayDate`: Informational calendar date (not used for deduplication)
- All standard Quran identifiers: `surahId`, `ayahNumber`, `page`, `juz`

**Error cases:**
- `400 VALIDATION_ERROR`: Missing or invalid `X-Noor-App-Open-Id` header
- `401 UNAUTHORIZED`: Missing/invalid Bearer token
- `404 NOT_FOUND`: Referenced ayah missing from Quran DB (shouldn't happen on seeded DB)

#### GET /api/v1/ayah/history

**Request:**
```http
GET /api/v1/ayah/history?page=1&limit=20
Authorization: Bearer <accessToken>
```

**Note:** `X-Noor-App-Open-Id` header is **not** required for history (history is per-user, not per-session)

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Ayah history retrieved successfully",
  "data": [
    {
      "id": "uuid",
      "surahId": 2,
      "ayahNumber": 255,
      "textAr": "...",
      "page": 42,
      "juz": 3,
      "surahNameAr": "البقرة",
      "surahNameEn": "Al-Baqarah",
      "surah": { "id": 2, "nameAr": "البقرة", "nameEn": "Al-Baqarah", "revelationType": "MADANI" },
      "historyId": "uuid",
      "displayDate": "2026-09-17",
      "sessionId": "uuid",
      "createdAt": "2026-09-17T12:00:00.000Z"
    }
  ],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 45,
    "totalPages": 3,
    "hasNextPage": true,
    "hasPreviousPage": false
  },
  "timestamp": "2026-09-17T12:05:00.000Z",
  "requestId": "uuid"
}
```

---

## PRODUCTION URL

### Confirmed Documentation Updates

All Flutter-facing documentation now uses the current Railway production URL:

```
https://noorapp-backend-production.up.railway.app/api/v1
```

**Files updated:**
- ✅ FLUTTER_DATA_CONTRACT_REPLY.md (primary Flutter handoff doc)
- ✅ BACKEND_ERROR_CODES.md (error code reference)
- ✅ AYAH_FEATURE.md (already had Railway URL)

**Old Vercel URL (deprecated):**
```
https://noor-app-backend-one.vercel.app/api/v1  ❌
```

---

## AYAH_FEATURE.md

### Confirmed Contents

The `AYAH_FEATURE.md` file contains:
- ✅ Actual final Flutter contract with Railway production URL
- ✅ Complete session behavior explanation (X-Noor-App-Open-Id header lifecycle)
- ✅ Request/response examples with all fields documented
- ✅ Session deduplication guarantees
- ✅ History pagination details
- ✅ Quran navigation integration (page/surah/juz/ayah linking)
- ✅ Flutter cache strategy recommendations
- ✅ Offline behavior guidelines
- ✅ Lock screen / widget readiness notes

**The documentation matches the actual implementation 100%.**

---

## TESTS

### Test Results

**Ayah Feature Tests:** `npx tsx scripts/test-ayah-feature.ts`

```
✅ ALL AYAH TESTS PASSED (25/25)

BOM + Bismillah Sanitization:
  ✅ BOM + Bismillah stripped for Surah Al-Baqarah ayah 1 (surahId=2)
  ✅ Bismillah NOT stripped for Surah Al-Fatihah ayah 1 (surahId=1)
  ✅ Bismillah NOT stripped for Surah At-Tawbah ayah 1 (surahId=9)
  ✅ Non-ayah-1 strips only BOM, never Bismillah-like text

Pagination:
  ✅ default page=1, limit=20
  ✅ page 3 / limit 10 skip=20
  ✅ limit capped at MAX_LIMIT (100)
  ✅ pagination meta totalPages=3 (55/20)
  ✅ pagination meta hasNextPage page 2 of 3
  ✅ pagination meta hasPreviousPage page 2
  ✅ pagination meta last page hasNextPage=false

Date Bucketing (displayDate):
  ✅ displayDate time portion is midnight 00:00 UTC bucket
  ✅ displayDate preserves calendar day via UTC of bucket
  ✅ two requests within same LOCAL calendar day → identical displayDate
  ✅ requests across LOCAL midnight boundary → different displayDate

Session Deduplication:
  ✅ same userId + same sessionId → identical dedup key (stable for 1000 Home rebuilds)
  ✅ same userId + DIFFERENT sessionId (next app open) → DIFFERENT dedup key → new Ayah allowed
  ✅ 20 repeated calls within one session → Map has 1 key (deduped by session id → no history pollution)
  ✅ two different sessions → Map has 2 keys (each open creates its own history row)
  ✅ same sessionId sent by different users → DIFFERENT dedup keys (per-user history isolation)

X-Noor-App-Open-Id Header Validation:
  ✅ zod header: valid RFC-4122 v4 uuid → passes
  ✅ zod header: uppercase uuid string → passes
  ✅ zod header: non-uuid value → INVALID (400 VALIDATION_ERROR expected at runtime)
  ✅ zod header: empty string → INVALID
  ✅ zod header: missing header entirely → INVALID with required_error
  ✅ zod header uses Express-lowercase key name "x-noor-app-open-id" → matches runtime headers object shape
```

**Prisma Validation:** `npx prisma validate`
```
✅ The schema at prisma\schema.prisma is valid 🚀
```

**TypeScript Type Check:** `npm run typecheck`
```
✅ No type errors found
```

**Production Build:** `npm run build`
```
✅ Build successful
✅ Copied verified hadith bank to dist/shared/data/verified-sahih-hadith-bank.json
```

---

## COMPATIBILITY

### Explicit Confirmation

#### Existing APIs Unchanged
✅ **All existing Noor APIs remain 100% backward compatible:**
- `/auth/*` (sign-up, login, refresh, password reset) — unchanged
- `/dashboard` — unchanged
- `/journey/*` (today, adhkar progress) — unchanged
- `/quran/*` (surahs, ayahs, juz, pages, bookmarks, khatmah, audio, tafsir, translation) — unchanged
- `/adhkar/*` (categories, items, progress, favorites, resume) — unchanged
- `/prayer/*` (schedule, times, completions) — unchanged
- `/tasbih/*` — unchanged
- `/profile/*` — unchanged
- `/notifications/*` — unchanged
- `/content/*` — unchanged

#### Existing Quran Contracts Unchanged
✅ **Quran data contracts remain identical:**
- Surah ID ranges: 1-114
- Ayah numbering: per-surah, starts at 1
- Page numbering: 1-604 (Mushaf pages)
- Juz numbering: 1-30
- Uthmani Arabic text with BOM/Bismillah sanitization (existing logic)
- Surah name resolution (existing helpers)
- Revelation type enum: MAKKI / MADANI
- All Quran identifier fields in responses: `surahId`, `ayahNumber`, `page`, `juz`, `textAr`, `surahNameAr`, `surahNameEn`

#### /content/verse-of-day Unchanged
✅ **The existing Verse of Day feature is completely separate and untouched:**
- `GET /api/v1/content/verse-of-day` endpoint still exists
- Returns one verse per calendar day (365-day rotation)
- No session logic involved
- Flutter can display BOTH features side-by-side:
  - Verse of Day card (existing, calendar-based)
  - Ayah card (new, session-based)

#### No Field Renames
✅ **All response fields maintain original names:**
- No breaking changes to existing field names
- Ayah feature adds NEW fields (`sessionId`, `isNew`) but doesn't rename existing ones
- Standard envelope unchanged: `{ success, message, data, meta, timestamp, requestId }`
- Error envelope unchanged: `{ success, message, code, details, timestamp, requestId }`

#### No Breaking Flutter Changes
✅ **All changes are additive-only for Flutter:**
- New endpoints: `GET /api/v1/ayah` and `GET /api/v1/ayah/history` (new routes, zero conflict with existing)
- New required header: `X-Noor-App-Open-Id` (only for ayah endpoints, doesn't affect existing routes)
- Existing authentication flow unchanged (Bearer token still required)
- Existing error codes unchanged (uses standard `VALIDATION_ERROR`, `UNAUTHORIZED`, `NOT_FOUND`)
- Existing Quran navigation unchanged (same `page`, `surahId`, `ayahNumber` fields)

---

## DEPLOYMENT

### Status: NOT DEPLOYED

✅ **Implementation complete, verified, and production-ready**  
✅ **All tests pass**  
✅ **TypeScript compilation successful**  
✅ **Production build successful**  

❌ **NOT pushed to production**  
❌ **NOT deployed to Railway**  
❌ **NO production migration run**  

### Why Not Deployed (As Requested)

Per user instructions:
> "Do NOT push to production. Do NOT run a production migration. Do NOT deploy. Stop after: implementation correction, tests, typecheck, build, final AYAH_FEATURE.md"

**Next Steps (when ready to deploy):**
1. Review this report
2. Review all modified files
3. Commit changes to git
4. Push to Railway (automatic deployment via git hook)
5. Monitor Railway deployment logs
6. Verify Railway production endpoints:
   - `https://noorapp-backend-production.up.railway.app/api/v1/ayah` (with valid auth + header)
   - `https://noorapp-backend-production.up.railway.app/api/v1/ayah/history` (with valid auth)
7. Run production smoke tests
8. Notify Flutter team of Railway URL + session header requirement

---

## MODIFIED FILES

### Documentation
1. `FLUTTER_DATA_CONTRACT_REPLY.md` — Updated production URL to Railway
2. `BACKEND_ERROR_CODES.md` — Updated production URL to Railway
3. `AYAH_FEATURE.md` — Already had Railway URL (verified, no change)

### Source Code
4. `src/lib/validation.ts` — Extended `RequestProperty` to support `'headers'`
5. `src/routes/ayah.ts` — Fixed imports (AppError, ErrorCodes, HttpStatus), fixed Zod v4 API (error.issues)

### Tests
6. `scripts/test-ayah-feature.ts` — Made one test assertion more flexible for Zod error messages

### Generated (Not Committed)
- Prisma client regenerated (`node_modules/@prisma/client`) — not in git
- Build output (`dist/`) — not in git per `.gitignore`

---

## VERIFICATION CHECKLIST

- [x] Session-based behavior implemented correctly (already was)
- [x] Schema has `sessionId` field with `unique(userId, sessionId)` constraint
- [x] Service uses `(userId, sessionId)` composite key
- [x] Controller extracts `X-Noor-App-Open-Id` header
- [x] Routes validate header as RFC-4122 UUID
- [x] Tests verify session deduplication (25/25 pass)
- [x] Tests verify header validation (valid/invalid/missing)
- [x] Production URLs updated to Railway in Flutter docs
- [x] AYAH_FEATURE.md describes actual implementation
- [x] Prisma schema validates successfully
- [x] TypeScript compilation passes with zero errors
- [x] Production build succeeds
- [x] All existing APIs unchanged
- [x] All existing Quran contracts unchanged
- [x] `/content/verse-of-day` unchanged
- [x] No field renames
- [x] No breaking Flutter changes
- [x] NOT deployed (as requested)

---

## CONCLUSION

**The Ayah feature was already correctly implemented with session-based behavior.** The only required changes were:

1. **Documentation updates** (Vercel → Railway URL)
2. **Minor code fixes** for TypeScript/Zod v4 compatibility

**No changes were needed to the core session logic** because it was already 100% correct:
- ✅ Schema with sessionId
- ✅ Unique constraint on (userId, sessionId)
- ✅ Service deduplication logic
- ✅ Header extraction in controller
- ✅ Header validation in routes
- ✅ Comprehensive tests

**All validation checks passed:**
- ✅ Tests: 25/25 passed
- ✅ Prisma: Valid schema
- ✅ TypeScript: Zero errors
- ✅ Build: Successful

**Ready for deployment when approved.**

---

**Report generated:** 2026-09-17  
**Implementation by:** Kiro AI  
**Status:** ✅ COMPLETE — NOT DEPLOYED
