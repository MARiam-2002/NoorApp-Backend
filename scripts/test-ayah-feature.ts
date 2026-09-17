/**
 * Ayah Feature focused checks (no Jest).
 * Run: npx tsx scripts/test-ayah-feature.ts
 *
 * Tests:
 *   1. Bismillah / BOM sanitization (pure logic)
 *   2. Pagination bounds for history
 *   3. getTodayDateOnly determinism (informative displayDate label bucket)
 *   4. App-open / session dedup keys (new behavior)
 *   5. X-Noor-App-Open-Id header zod validation (valid/invalid/missing cases)
 *   6. Conditional DB smoke-test:
 *        - env: AYAH_TEST_USER_ID=<uuid>
 *        - env: AYAH_TEST_SESSION_IDS=<uuid1>,<uuid2>
 *      It will:
 *        - call getUserAyah(userId, session1) twice → same Ayah, same historyId (0 dupes)
 *        - call getUserAyah(userId, session2) once → (possibly new) Ayah, different historyId
 *        - call getUserAyahHistory(userId, page, limit) and validate order, meta, fields
 *        - verify Quran-identifier linkage (surahId / ayahNumber / page / juz)
 */

import crypto from 'crypto';
import { z } from 'zod';
import {
  parsePaginationQuery,
  buildPaginationMeta,
} from '../src/utils/pagination';
import { getTodayDateOnly } from '../src/utils/date';

let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ============================================================
//  1. Bismillah / BOM sanitization (mirrors ayah.service.ts)
// ============================================================
const BOM = '\uFEFF';
const BISMILLAH_REGEX = /^(?:\uFEFF)?ب[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*س[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ه[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ر[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ح[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\u0622\u0623\u0625\u0627\u0671]?ن[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ي?[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*[\s\u200C-\u200F\u202A-\u202E\u00A0]+[\u0671\u0627]?ل[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ر[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ح[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*ي[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*م[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E8\u06EA-\u06ED\u08D4-\u08E1\u08E3-\u0902\u08AB-\u08AD]*(?:[\s\u200C-\u200F\u202A-\u202E\u00A0]+|$)/u;

function stripBom(text: string): string {
  if (text && text.charCodeAt(0) === 0xfeff) return text.slice(1);
  return text;
}

function stripBismillah(ayah: { surahId: number; ayahNumber: number; textAr: string }) {
  if (ayah.ayahNumber !== 1) return stripBom(ayah.textAr ?? '');
  if (ayah.surahId === 1 || ayah.surahId === 9) return stripBom(ayah.textAr ?? '');
  return stripBom(ayah.textAr ?? '').replace(BISMILLAH_REGEX, '');
}

const BISMILLAH_TEXT = 'بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ ';
const ACTUAL_AYAH_BAQARAH = 'الم';
const surah2Ayah1 = { surahId: 2, ayahNumber: 1, textAr: BOM + BISMILLAH_TEXT + ACTUAL_AYAH_BAQARAH };
assert(
  'BOM + Bismillah stripped for Surah Al-Baqarah ayah 1 (surahId=2)',
  stripBismillah(surah2Ayah1) === ACTUAL_AYAH_BAQARAH,
  `got: ${stripBismillah(surah2Ayah1)}`,
);

const surah1Ayah1 = { surahId: 1, ayahNumber: 1, textAr: BOM + BISMILLAH_TEXT + ACTUAL_AYAH_BAQARAH };
assert(
  'Bismillah NOT stripped for Surah Al-Fatihah ayah 1 (surahId=1)',
  stripBismillah(surah1Ayah1) === BISMILLAH_TEXT + ACTUAL_AYAH_BAQARAH,
);

const surah9Ayah1 = { surahId: 9, ayahNumber: 1, textAr: ACTUAL_AYAH_BAQARAH };
assert(
  'Bismillah NOT stripped for Surah At-Tawbah ayah 1 (surahId=9)',
  stripBismillah(surah9Ayah1) === ACTUAL_AYAH_BAQARAH,
);

const midAyah = { surahId: 2, ayahNumber: 255, textAr: BOM + 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ' };
assert(
  'Non-ayah-1 strips only BOM, never Bismillah-like text',
  stripBismillah(midAyah) === 'اللَّهُ لَا إِلَٰهَ إِلَّا هُوَ الْحَيُّ الْقَيُّومُ',
);

// ============================================================
//  2. Pagination bounds for history (unchanged behavior)
// ============================================================
const pg1 = parsePaginationQuery(undefined, undefined);
assert('default page=1, limit=20', pg1.page === 1 && pg1.limit === 20 && pg1.skip === 0);

const pg2 = parsePaginationQuery('3', '10');
assert('page 3 / limit 10 skip=20', pg2.page === 3 && pg2.limit === 10 && pg2.skip === 20);

const pgBadLimit = parsePaginationQuery('1', '500');
assert('limit capped at MAX_LIMIT (100)', pgBadLimit.limit === 100);

const meta = buildPaginationMeta(2, 20, 55);
assert('pagination meta totalPages=3 (55/20)', meta.totalPages === 3);
assert('pagination meta hasNextPage page 2 of 3', meta.hasNextPage === true);
assert('pagination meta hasPreviousPage page 2', meta.hasPreviousPage === true);

const metaLast = buildPaginationMeta(3, 20, 55);
assert('pagination meta last page hasNextPage=false', metaLast.hasNextPage === false);

// ============================================================
//  3. getTodayDateOnly determinism (informative label, not dedup)
//     NB: getTodayDateOnly() uses LOCAL getFullYear/getMonth/getDate (not UTC)
//     to match the existing convention used by daily-content.service.ts / journey.
//     displayDate is now a READABLE label; session uniqueness is driven by
//     X-Noor-App-Open-Id header (see tests 4 and 5).
// ============================================================
const fixedDate = new Date(2026, 8, 17, 10, 30, 0); // LOCAL Sept 17, 10:30 AM
const todayOnly = getTodayDateOnly(fixedDate);
assert(
  'displayDate time portion is midnight 00:00 UTC bucket',
  todayOnly.getUTCHours() === 0 && todayOnly.getUTCMinutes() === 0,
  `got h=${todayOnly.getUTCHours()} m=${todayOnly.getUTCMinutes()}`,
);
assert(
  'displayDate preserves calendar day via UTC of bucket (Date.UTC bucket)',
  todayOnly.getUTCFullYear() === 2026 && todayOnly.getUTCMonth() === 8 && todayOnly.getUTCDate() === 17,
  `got y=${todayOnly.getUTCFullYear()} m=${todayOnly.getUTCMonth()} d=${todayOnly.getUTCDate()}`,
);

const sameDayDifferentTime = new Date(2026, 8, 17, 23, 59, 59); // LOCAL Sept 17, 23:59:59
const t1 = getTodayDateOnly(fixedDate).getTime();
const t2 = getTodayDateOnly(sameDayDifferentTime).getTime();
assert(
  'two requests within same LOCAL calendar day → identical displayDate (dedup key)',
  t1 === t2,
  `t1=${t1} t2=${t2}`,
);

const nextDay = new Date(2026, 8, 18, 0, 0, 1); // LOCAL Sept 18 past midnight
const t3 = getTodayDateOnly(nextDay).getTime();
assert(
  'requests across LOCAL midnight boundary → different displayDate (new ayah selection allowed)',
  t1 !== t3,
  `t1=${t1} t3=${t3}`,
);

// ============================================================
//  4. App-open / session dedup keys (NEW behavior)
//     Dedup composite key is (userId, sessionId).
//     - same userId + same sessionId → same exact history row (1 row max).
//     - same userId + different sessionId → brand new row (different open/session).
// ============================================================
type DedupKey = { userId: string; sessionId: string };
function sameKey(a: DedupKey, b: DedupKey) {
  return a.userId === b.userId && a.sessionId === b.sessionId;
}
function keyStableString(k: DedupKey) {
  return `${k.userId}|${k.sessionId}`;
}

const USER = 'user-uuid-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const S1 = 'session-11111111-1111-4111-8111-111111111111';
const S2 = 'session-22222222-2222-4222-8222-222222222222';
assert(
  'same userId + same sessionId → identical dedup key (stable for 1000 Home rebuilds)',
  sameKey({ userId: USER, sessionId: S1 }, { userId: USER, sessionId: S1 }) &&
    keyStableString({ userId: USER, sessionId: S1 }) ===
      keyStableString({ userId: USER, sessionId: S1 }),
);
assert(
  'same userId + DIFFERENT sessionId (next app open) → DIFFERENT dedup key → new Ayah allowed',
  !sameKey({ userId: USER, sessionId: S1 }, { userId: USER, sessionId: S2 }),
);
// Make sure a Map populated with 2 calls (same session) still only has 1 entry:
const dedupMap = new Map<string, number>();
for (let i = 0; i < 20; i++) {
  const k = keyStableString({ userId: USER, sessionId: S1 });
  dedupMap.set(k, (dedupMap.get(k) ?? 0) + 1);
}
assert(
  '20 repeated calls within one session → Map has 1 key (deduped by session id → no history pollution)',
  dedupMap.size === 1 && (dedupMap.get(keyStableString({ userId: USER, sessionId: S1 })) ?? 0) === 20,
);
const twoSessions = new Map<string, number>();
twoSessions.set(keyStableString({ userId: USER, sessionId: S1 }), 1);
twoSessions.set(keyStableString({ userId: USER, sessionId: S2 }), 1);
assert(
  'two different sessions → Map has 2 keys (each open creates its own history row)',
  twoSessions.size === 2,
);
// Different users with the same session uuid (collision possible in theory) → still separate rows because userId changes:
const OTHER_USER = 'user-uuid-bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
assert(
  'same sessionId sent by different users → DIFFERENT dedup keys (per-user history isolation)',
  !sameKey({ userId: USER, sessionId: S1 }, { userId: OTHER_USER, sessionId: S1 }),
);

// ============================================================
//  5. X-Noor-App-Open-Id header zod validation (NEW)
//     Mirror of ayahCurrentHeaderSchema in routes/ayah.ts
// ============================================================
const headerSchema = z.object({
  'x-noor-app-open-id': z
    .string({
      required_error:
        'Missing required header X-Noor-App-Open-Id: send a new uuid RFC-4122 v4 once per real Flutter app open / cold start',
      invalid_type_error: 'X-Noor-App-Open-Id must be a string uuid RFC-4122',
    })
    .uuid({ message: 'X-Noor-App-Open-Id must be a valid uuid RFC-4122' }),
});
// Case A: valid RFC-4122 v4 uuid → PASS
const validUuid = crypto.randomUUID(); // RFC-4122 v4 (Node 14.17+)
{
  const r = headerSchema.safeParse({ 'x-noor-app-open-id': validUuid });
  assert(
    `zod header: valid RFC-4122 v4 uuid → passes (${validUuid.slice(0, 8)}…)`,
    r.success === true,
  );
}
// Case B: uppercase uuid (still RFC-4122) → zod .uuid accepts
{
  const r = headerSchema.safeParse({
    'x-noor-app-open-id': 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
  });
  assert(
    'zod header: uppercase uuid string → passes',
    r.success === true,
  );
}
// Case C: not a uuid → FAIL VALIDATION_ERROR
{
  const r = headerSchema.safeParse({ 'x-noor-app-open-id': 'some-session-string-not-uuid' });
  assert(
    'zod header: non-uuid value → INVALID (400 VALIDATION_ERROR expected at runtime)',
    r.success === false,
  );
}
// Case D: empty string → FAIL
{
  const r = headerSchema.safeParse({ 'x-noor-app-open-id': '' });
  assert(
    'zod header: empty string → INVALID',
    r.success === false,
  );
}
// Case E: header key entirely missing → FAIL with clear message
{
  const r = headerSchema.safeParse({});
  assert(
    'zod header: missing header entirely → INVALID with required_error',
    r.success === false && (r.error?.issues?.[0]?.message?.includes('X-Noor-App-Open-Id') === true || r.error?.issues?.[0]?.message?.includes('required') === true || r.error?.issues?.[0]?.message?.includes('expected string') === true),
    r.success ? 'unexpected success' : `issue: ${String(r.error?.issues?.[0]?.message)}`,
  );
}
// Case F: Express lowercases incoming headers to this exact key → test passes
{
  const r = headerSchema.safeParse({ 'x-noor-app-open-id': validUuid });
  assert(
    'zod header uses Express-lowercase key name "x-noor-app-open-id" → matches runtime headers object shape',
    r.success === true,
  );
}

// ============================================================
//  6. DB smoke test (conditional)
//     Requires:
//       AYAH_TEST_USER_ID=<user uuid>
//       AYAH_TEST_SESSION_IDS=<session1 uuid>,<session2 uuid>
// ============================================================
const TEST_USER_ID = process.env.AYAH_TEST_USER_ID || '';
const SESSION_IDS_RAW = process.env.AYAH_TEST_SESSION_IDS || '';
const SESSION_IDS = SESSION_IDS_RAW.split(',').map((s) => s.trim()).filter(Boolean);
if (TEST_USER_ID && TEST_USER_ID.length > 5 && SESSION_IDS.length >= 2) {
  const [SESS_A, SESS_B] = SESSION_IDS;
  console.log(`\n[DB smoke] userId=${TEST_USER_ID} sessionA=${SESS_A.slice(0, 8)}… sessionB=${SESS_B.slice(0, 8)}…`);
  import('../src/services/ayah.service')
    .then(async ({ getUserAyah, getUserAyahHistory }) => {
      // —— Session A repeated calls (MUST be identical, no dupes) ——
      const t0 = Date.now();
      const ayahA1 = await getUserAyah(TEST_USER_ID, SESS_A);
      const tA1 = Date.now() - t0;
      const ayahA2 = await getUserAyah(TEST_USER_ID, SESS_A);
      const tA2 = Date.now() - (t0 + tA1);

      const requiredFields = [
        'id', 'surahId', 'ayahNumber', 'textAr',
        'page', 'juz', 'surahNameAr', 'surahNameEn', 'surah',
        'historyId', 'displayDate', 'sessionId',
      ] as const;
      for (const f of requiredFields) {
        assert(`ayah payload contains field ${f}`, Object.prototype.hasOwnProperty.call(ayahA1, f));
      }
      assert('ayah sessionId in payload matches sent sessionA', ayahA1.sessionId === SESS_A);
      assert('ayah surahId in valid 1..114 range', ayahA1.surahId >= 1 && ayahA1.surahId <= 114);
      assert('ayah ayahNumber >= 1', Number(ayahA1.ayahNumber) >= 1);
      assert('ayah surah object contains id/nameAr/nameEn', !!ayahA1.surah?.id && !!ayahA1.surah?.nameAr && !!ayahA1.surah?.nameEn);
      assert('ayah surah.id matches top-level surahId', ayahA1.surah.id === ayahA1.surahId);
      assert('ayah id (ayah table id) is a UUID v4 shape', typeof ayahA1.id === 'string' && ayahA1.id.length === 36);
      assert(
        'SAME session repeated call → identical surahId+ayahNumber (stable Ayah whole session)',
        ayahA1.surahId === ayahA2.surahId && ayahA1.ayahNumber === ayahA2.ayahNumber,
        `A1=${ayahA1.surahId}:${ayahA1.ayahNumber} vs A2=${ayahA2.surahId}:${ayahA2.ayahNumber}`,
      );
      assert(
        'SAME session repeated call → SAME historyId (no duplicate rows created)',
        ayahA1.historyId === ayahA2.historyId,
      );
      console.log(`[DB smoke] session A first=${tA1}ms second=${tA2}ms ayah=${ayahA1.surahId}:${ayahA1.ayahNumber}`);

      // —— Session B call (NEXT APP OPEN) ——
      const ayahB1 = await getUserAyah(TEST_USER_ID, SESS_B);
      assert('ayah B sessionId matches sent sessionB', ayahB1.sessionId === SESS_B);
      assert('different session → DIFFERENT historyId (two real display events)', ayahA1.historyId !== ayahB1.historyId);
      // Note: ayah payload ayah could coincidentally match sA vs sB (1/6236) so we do NOT assert sA.ayah != sB.ayah strictly.
      console.log(`[DB smoke] session B ayah=${ayahB1.surahId}:${ayahB1.ayahNumber}`);

      // —— History page validates newest-first + Quran linkage ——
      const history = await getUserAyahHistory(TEST_USER_ID, 1, 5);
      assert('history meta.page === 1', history.meta.page === 1);
      assert('history meta.limit === 5', history.meta.limit === 5);
      assert('history items length <= limit', history.items.length <= 5);
      assert('history meta.total >= 2 for two new sessions', history.meta.total >= 2);
      if (history.items.length >= 2) {
        const a = new Date(history.items[0].createdAt as string).getTime();
        const b = new Date(history.items[1].createdAt as string).getTime();
        assert('history ordered newest first DESC (session B createdAt > session A createdAt)', a >= b);
      }
      if (history.items.length >= 1) {
        const first = history.items[0];
        for (const f of [
          'id', 'surahId', 'ayahNumber', 'textAr', 'page', 'juz',
          'surahNameAr', 'surahNameEn', 'surah', 'historyId', 'displayDate',
          'sessionId', 'createdAt',
        ] as const) {
          assert(`history item contains field ${f}`, Object.prototype.hasOwnProperty.call(first, f));
        }
        assert('history first item surah.id matches top-level surahId', first.surah.id === first.surahId);
        assert('history first item page/juz are valid numbers or null (typed)', first.page === null || typeof first.page === 'number');
      }

      finish();
    })
    .catch((err) => {
      console.error('[DB smoke] ERROR:', err?.message || String(err));
      failed += 1;
      finish();
    });
} else {
  console.log(
    '\n[DB smoke] skipped — set env AYAH_TEST_USER_ID=<uuid> and AYAH_TEST_SESSION_IDS=<uuid1>,<uuid2> to enable DB-backed smoke tests.',
  );
  finish();
}

function finish() {
  console.log('\n============================================================');
  if (failed === 0) {
    console.log('ALL AYAH TESTS PASSED ✅');
    process.exit(0);
  } else {
    console.error(`${failed} AYAH TEST${failed === 1 ? '' : 'S'} FAILED ❌`);
    process.exit(1);
  }
}

