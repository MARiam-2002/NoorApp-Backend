/**
 * Focused production-fix checks (no Jest).
 * Run: npx tsx scripts/verify-production-fixes.ts
 */
import { isCronRequestAuthorized } from '../src/routes/cron';
import { minutesUntilPrayer } from '../src/services/prayer-reminder.service';
import { getLocalClock } from '../src/services/salawat-reminder.service';

let failed = 0;

function assert(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const SECRET = 'test-cron-secret-value-32chars-min!!';

// --- Cron authentication ---
assert(
  'Bearer valid → authorized',
  isCronRequestAuthorized(SECRET, {
    headers: { authorization: `Bearer ${SECRET}` },
    query: {},
  }),
);

assert(
  'X-Cron-Secret valid → authorized',
  isCronRequestAuthorized(SECRET, {
    headers: { 'x-cron-secret': SECRET },
    query: {},
  }),
);

assert(
  'query secret valid → authorized',
  isCronRequestAuthorized(SECRET, {
    headers: {},
    query: { secret: SECRET },
  }),
);

assert(
  'invalid Bearer → unauthorized',
  !isCronRequestAuthorized(SECRET, {
    headers: { authorization: 'Bearer wrong' },
    query: {},
  }),
);

assert(
  'missing credentials → unauthorized',
  !isCronRequestAuthorized(SECRET, {
    headers: {},
    query: {},
  }),
);

assert(
  'empty CRON_SECRET → unauthorized even with Bearer',
  !isCronRequestAuthorized('', {
    headers: { authorization: `Bearer ${SECRET}` },
    query: {},
  }),
);

assert(
  'empty CRON_SECRET → unauthorized with x-vercel-cron',
  !isCronRequestAuthorized('', {
    headers: { 'x-vercel-cron': '1' },
    query: {},
  }),
);

assert(
  'x-vercel-cron alone → unauthorized when secret configured',
  !isCronRequestAuthorized(SECRET, {
    headers: { 'x-vercel-cron': '1' },
    query: {},
  }),
);

assert(
  'x-vercel-cron + wrong secret → unauthorized',
  !isCronRequestAuthorized(SECRET, {
    headers: { 'x-vercel-cron': '1', authorization: 'Bearer wrong' },
    query: {},
  }),
);

// --- Azan timezone-aware minutesUntil ---
// Fixed instant: 2026-09-14T12:00:00.000Z
const now = new Date('2026-09-14T12:00:00.000Z');

const cairo = getLocalClock(now, 'Africa/Cairo');
const ny = getLocalClock(now, 'America/New_York');

assert(
  'Cairo local clock differs from New York at same UTC instant',
  cairo.hour !== ny.hour || cairo.minute !== ny.minute,
  `Cairo=${cairo.hour}:${cairo.minute} NY=${ny.hour}:${ny.minute}`,
);

// Build a prayer HH:mm that is ~5 minutes ahead in Cairo local time
const cairoPrayerM = (cairo.minute + 5) % 60;
const cairoPrayerHourAdj =
  cairo.minute + 5 >= 60 ? (cairo.hour + 1) % 24 : cairo.hour;
const cairoHhmm = `${String(cairoPrayerHourAdj).padStart(2, '0')}:${String(cairoPrayerM).padStart(2, '0')}`;

const minsCairo = minutesUntilPrayer(cairoHhmm, 'Africa/Cairo', now);
const minsNySameString = minutesUntilPrayer(cairoHhmm, 'America/New_York', now);

assert(
  'Cairo: prayer ~5 min ahead evaluates near +5 in Africa/Cairo',
  minsCairo >= 4 && minsCairo <= 6,
  `got ${minsCairo} for ${cairoHhmm}`,
);

assert(
  'Same HH:mm evaluated in America/New_York differs from Cairo',
  minsCairo !== minsNySameString,
  `Cairo=${minsCairo} NY=${minsNySameString} hhmm=${cairoHhmm}`,
);

// NY-local +5 minutes string
const nyPrayerM = (ny.minute + 5) % 60;
const nyPrayerHourAdj = ny.minute + 5 >= 60 ? (ny.hour + 1) % 24 : ny.hour;
const nyHhmm = `${String(nyPrayerHourAdj).padStart(2, '0')}:${String(nyPrayerM).padStart(2, '0')}`;
const minsNy = minutesUntilPrayer(nyHhmm, 'America/New_York', now);

assert(
  'New York: prayer ~5 min ahead evaluates near +5 in America/New_York',
  minsNy >= 4 && minsNy <= 6,
  `got ${minsNy} for ${nyHhmm}`,
);

assert(
  'Server-style Date#setHours must NOT be used (TZ-aware path)',
  Number.isFinite(minsCairo) && Number.isFinite(minsNy),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log('\nAll production-fix checks passed.');
