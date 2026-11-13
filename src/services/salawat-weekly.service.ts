/**
 * «مجلس الصلاة على النبي ﷺ» — every week from Thursday Maghrib to Friday Maghrib (the user's local time).
 * Everyone's salawat during the window add up to one shared total for the week. There is deliberately no ranking or
 * leaderboard (same rule as continuity: leaderboard false, no points): the user sees their own count, the shared
 * total and how many took part.
 *
 * Counting happens in the app (the existing tasbih counter in salawat mode); the app sends batches with a batchId so
 * retries are never counted twice.
 */
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { buildAzanPreferencesFromUser } from './azan.service';
import { computePrayerInstantsAround } from './prayer.service';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';

type Db = any;
export const SALAWAT_WEEKLY_LIMITS = { maxBatch: 1000, maxPerWeek: 100000, fallbackMaghrib: '18:00' } as const;

/** Evidence shown on the screen; both texts are checked word for word by scripts/test-salawat-weekly.ts. */
export const SALAWAT_WEEKLY_EVIDENCE = [
  { id: 'friday', leadAr: 'قال رسول الله ﷺ عن يوم الجمعة:', textAr: 'فَأَكْثِرُوا عَلَىَّ مِنَ الصَّلاَةِ فِيهِ فَإِنَّ صَلاَتَكُمْ مَعْرُوضَةٌ عَلَىَّ',
    collection: 'abudawud' as const, number: 1047, referenceAr: 'رواه أبو داود (1047) وصححه الألباني' },
  { id: 'tenfold', leadAr: 'قال رسول الله ﷺ:', textAr: 'مَنْ صَلَّى عَلَىَّ وَاحِدَةً صَلَّى اللَّهُ عَلَيْهِ عَشْرًا',
    collection: 'muslim' as const, number: 408, referenceAr: 'رواه مسلم (408)' },
];

type Loc = { latitude: number | null; longitude: number | null; timezone: string | null; azanPreferences: unknown; prayerCalculationMethod: string | null; city: string | null };
const addDays = (day: string, n: number) => new Date(Date.parse(day + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** Local Maghrib of `day` as an instant; falls back to 18:00 local when the location is unknown. */
function maghribOf(loc: Loc, day: string, timeZone: string): { at: Date; estimated: boolean } {
  if (loc.latitude != null && loc.longitude != null && Number.isFinite(loc.latitude) && Number.isFinite(loc.longitude)) {
    const azan = buildAzanPreferencesFromUser(loc as any);
    const m = computePrayerInstantsAround({ latitude: loc.latitude, longitude: loc.longitude, timezone: loc.timezone, method: azan.calculationMethod,
      madhab: azan.madhab, locationSource: 'profile', now: new Date(day + 'T12:00:00Z') }).instants.find(i => i.key === 'MAGHRIB' && i.date === day);
    if (m) return { at: m.timestamp, estimated: false };
  }
  // 18:00 local: find the UTC instant whose local clock reads day 18:00.
  const guess = new Date(day + 'T18:00:00Z');
  const c = getLocalClock(guess, timeZone);
  const diffMin = (Date.parse(`${c.dayKey}T${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}:00Z`) - guess.getTime()) / 60000;
  return { at: new Date(guess.getTime() - diffMin * 60000), estimated: true };
}

/**
 * The gathering that is open at `now`, or the next one. weekKey = the Friday (local date).
 * Thursday Maghrib opens it; Friday Maghrib closes it.
 */
export function salawatWindow(loc: Loc, now = new Date()) {
  const timeZone = resolveTimezone(loc.timezone);
  const today = getLocalClock(now, timeZone).dayKey;
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay(); // 0 Sunday … 4 Thursday, 5 Friday
  const build = (friday: string) => {
    const open = maghribOf(loc, addDays(friday, -1), timeZone), close = maghribOf(loc, friday, timeZone);
    return { weekKey: friday, opensAt: open.at.toISOString(), closesAt: close.at.toISOString(), estimatedTimes: open.estimated || close.estimated,
      isOpen: now >= open.at && now < close.at, timezone: timeZone };
  };
  const thisFriday = addDays(today, (5 - weekday + 7) % 7);
  const w = build(thisFriday);
  // After Friday Maghrib the next gathering is next week's.
  return now >= new Date(w.closesAt) ? build(addDays(thisFriday, 7)) : w;
}

const totals = new Map<string, { at: number; total: number; participants: number }>();
async function communityTotal(weekKey: string, db: Db, fresh = false) {
  const hit = totals.get(weekKey);
  if (!fresh && hit && Date.now() - hit.at < 30000) return hit;
  const rows: any[] = await db.$queryRaw`SELECT COALESCE(SUM("count"),0)::bigint AS total, COUNT(*) FILTER (WHERE "count" > 0)::int AS participants
    FROM "salawat_weekly_counts" WHERE "weekKey"=${weekKey}::date`;
  const v = { at: Date.now(), total: Number(rows[0].total), participants: Number(rows[0].participants) };
  totals.set(weekKey, v);
  return v;
}

async function loadLoc(db: Db, userId: string): Promise<Loc> {
  const rows: any[] = await db.$queryRaw`SELECT "timezone","latitude","longitude","city","azanPreferences","prayerCalculationMethod" FROM "users" WHERE "id"=${userId}`;
  if (!rows.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  return rows[0];
}

const dto = (w: ReturnType<typeof salawatWindow>, c: { total: number; participants: number }) => ({
  ...w, communityTotal: c.total, participants: c.participants,
  evidence: SALAWAT_WEEKLY_EVIDENCE.map(({ id, leadAr, textAr, referenceAr }) => ({ id, leadAr, textAr, referenceAr })),
  titleAr: 'مجلس الصلاة على النبي ﷺ', subtitleAr: 'من مغرب الخميس إلى مغرب الجمعة',
});

/** Public: the window for a timezone (no location → 18:00) and the shared total of that week. */
export async function getSalawatWeeklyPublic(timezone: string | undefined, now = new Date(), db: Db = prisma) {
  const w = salawatWindow({ latitude: null, longitude: null, timezone: timezone ?? null, azanPreferences: {}, prayerCalculationMethod: null, city: null }, now);
  return dto(w, await communityTotal(w.weekKey, db));
}

/** Signed in: window from the user's location, their count this week and the last four weeks. */
export async function getSalawatWeeklyMine(userId: string, now = new Date(), db: Db = prisma) {
  const w = salawatWindow(await loadLoc(db, userId), now);
  const rows: any[] = await db.$queryRaw`SELECT "weekKey"::text AS "weekKey","count" FROM "salawat_weekly_counts" WHERE "userId"=${userId} ORDER BY "weekKey" DESC LIMIT 5`;
  const mine = rows.find(r => String(r.weekKey).slice(0, 10) === w.weekKey);
  return { ...dto(w, await communityTotal(w.weekKey, db)), myCount: mine ? Number(mine.count) : 0,
    history: rows.filter(r => String(r.weekKey).slice(0, 10) !== w.weekKey).slice(0, 4).map(r => ({ weekKey: String(r.weekKey).slice(0, 10), count: Number(r.count) })) };
}

export const salawatCountSchema = z.object({
  batchId: z.string().uuid(),
  count: z.number().int().min(1).max(SALAWAT_WEEKLY_LIMITS.maxBatch),
}).strict();

/** Adds a batch while the gathering is open. Same batchId again → no change. Above the weekly cap the extra is not added. */
export async function addSalawatCount(userId: string, raw: unknown, now = new Date(), db: Db = prisma) {
  const v = salawatCountSchema.parse(raw);
  const run = async (tx: Db) => {
    const w = salawatWindow(await loadLoc(tx, userId), now);
    if (!w.isOpen) throw new AppError(`The gathering opens at ${w.opensAt}`, 409, ErrorCodes.CONFLICT, { weekKey: w.weekKey, opensAt: w.opensAt, closesAt: w.closesAt });
    const fresh = await tx.$executeRaw`INSERT INTO "salawat_weekly_batches" ("userId","batchId") VALUES (${userId},${v.batchId}) ON CONFLICT DO NOTHING`;
    let capped = false;
    if (fresh === 1) {
      const rows: any[] = await tx.$queryRaw`INSERT INTO "salawat_weekly_counts" ("userId","weekKey","count","updatedAt")
        VALUES (${userId},${w.weekKey}::date,LEAST(${v.count}::int,${SALAWAT_WEEKLY_LIMITS.maxPerWeek}::int),CURRENT_TIMESTAMP)
        ON CONFLICT ("userId","weekKey") DO UPDATE SET "count"=LEAST("salawat_weekly_counts"."count"+${v.count}::int,${SALAWAT_WEEKLY_LIMITS.maxPerWeek}::int),"updatedAt"=CURRENT_TIMESTAMP
        RETURNING "count"`;
      capped = Number(rows[0].count) >= SALAWAT_WEEKLY_LIMITS.maxPerWeek;
    }
    const mine: any[] = await tx.$queryRaw`SELECT "count" FROM "salawat_weekly_counts" WHERE "userId"=${userId} AND "weekKey"=${w.weekKey}::date`;
    const c = await communityTotal(w.weekKey, tx, true);
    return { weekKey: w.weekKey, closesAt: w.closesAt, myCount: mine.length ? Number(mine[0].count) : 0, duplicate: fresh !== 1, capped,
      communityTotal: c.total, participants: c.participants };
  };
  return db === prisma ? prisma.$transaction(run) : run(db);
}

/** Housekeeping: idempotency rows older than 30 days are no longer needed. */
export async function pruneSalawatBatches(db: Db = prisma) {
  return db.$executeRaw`DELETE FROM "salawat_weekly_batches" WHERE "createdAt" < now() - interval '30 days'`;
}
