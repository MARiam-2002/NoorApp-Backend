/**
 * Quran memorization (hifz): a plan (scope, direction, daily amount), memorized segments with spaced review,
 * a daily task (new portion + due reviews), progress, self-test questions and an optional daily reminder.
 *
 * Days are counted in the user's profile timezone. Review intervals follow a simple spaced-repetition ladder:
 * each successful review moves the segment up one stage, "again" sends it back to tomorrow.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { logger } from '../lib/logger';
import { CATALOG_SURAHS } from '../data/surahs';
import { getLocalClock, resolveTimezone, normalizeHhmm } from './salawat-reminder.service';
import { evaluateMulkEligibility } from './mulk-reminder.service';
import { sanitizeAyahText, validateQuranAudioSelection } from './quran.service';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { shiftDayKey } from '../shared/utils/hijri';
import { PUSH_TTL_SECONDS } from '../shared/utils/reminder-timing';

type Db = any;

/** Days until the next review for each stage (stage 0 = memorized today → review tomorrow). */
export const HIFZ_REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60, 120] as const;
export const HIFZ_MAX_STAGE = HIFZ_REVIEW_INTERVALS.length - 1;
export type HifzGrade = 'AGAIN' | 'HARD' | 'GOOD' | 'EASY';

const surahInfo = (id: number) => CATALOG_SURAHS.find(s => s.id === id);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

export const hifzPlanInputSchema = z.object({
  fromSurah: z.number().int().min(1).max(114),
  toSurah: z.number().int().min(1).max(114),
  /** BACKWARD = from the end of the Quran (an-Nas, al-Falaq, …), the usual order for beginners. */
  direction: z.enum(['FORWARD', 'BACKWARD']).default('BACKWARD'),
  dailyNewVerses: z.number().int().min(1).max(50).default(5),
  reviewLimit: z.number().int().min(1).max(50).default(10),
  reciterId: z.string().min(1).max(100).nullable().default(null),
  reminderEnabled: z.boolean().default(false),
  reminderTime: hhmm.default('06:00'),
}).strict().refine(v => v.fromSurah <= v.toSurah, { message: 'fromSurah must be before or equal to toSurah', path: ['toSurah'] });
export type HifzPlanInput = z.infer<typeof hifzPlanInputSchema>;

export const hifzSegmentInputSchema = z.object({
  surahId: z.number().int().min(1).max(114),
  fromAyah: z.number().int().min(1).max(286),
  toAyah: z.number().int().min(1).max(286),
}).strict();

export const hifzReviewInputSchema = z.object({ grade: z.enum(['AGAIN', 'HARD', 'GOOD', 'EASY']) }).strict();

export type Segment = { id: string; surahId: number; fromAyah: number; toAyah: number; stage: number; memorizedDay: string; nextReviewDay: string;
  lastReviewedAt: string | null; lastGrade: HifzGrade | null; reviewCount: number; lapses: number };
export type Plan = { fromSurah: number; toSurah: number; direction: 'FORWARD' | 'BACKWARD'; dailyNewVerses: number; reviewLimit: number;
  reciterId: string | null; reminderEnabled: boolean; reminderTime: string; status: 'ACTIVE' | 'PAUSED'; revision: number; startedAt: string };

const dayKey = (d: unknown): string => d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);

function toSegment(r: any): Segment {
  return { id: r.id, surahId: Number(r.surahId), fromAyah: Number(r.fromAyah), toAyah: Number(r.toAyah), stage: Number(r.stage),
    memorizedDay: dayKey(r.memorizedDay), nextReviewDay: dayKey(r.nextReviewDay),
    lastReviewedAt: r.lastReviewedAt ? new Date(r.lastReviewedAt).toISOString() : null, lastGrade: r.lastGrade ?? null,
    reviewCount: Number(r.reviewCount), lapses: Number(r.lapses) };
}
function toPlan(r: any): Plan {
  return { fromSurah: r.fromSurah, toSurah: r.toSurah, direction: r.direction, dailyNewVerses: r.dailyNewVerses, reviewLimit: r.reviewLimit,
    reciterId: r.reciterId ?? null, reminderEnabled: r.reminderEnabled, reminderTime: r.reminderTime, status: r.status,
    revision: r.revision, startedAt: new Date(r.startedAt).toISOString() };
}

/** Surahs of the plan in study order. */
export function planSurahOrder(plan: Pick<Plan, 'fromSurah' | 'toSurah' | 'direction'>): number[] {
  const ids = Array.from({ length: plan.toSurah - plan.fromSurah + 1 }, (_, i) => plan.fromSurah + i);
  return plan.direction === 'BACKWARD' ? ids.reverse() : ids;
}

/** The next unmemorized verses of the plan, at most `limit`, never crossing a surah boundary. */
export function nextPortion(plan: Pick<Plan, 'fromSurah' | 'toSurah' | 'direction'>, segments: Array<Pick<Segment, 'surahId' | 'fromAyah' | 'toAyah'>>, limit: number) {
  if (limit < 1) return null;
  for (const surahId of planSurahOrder(plan)) {
    const total = surahInfo(surahId)!.totalAyahs;
    const ranges = segments.filter(s => s.surahId === surahId).sort((a, b) => a.fromAyah - b.fromAyah);
    let ayah = 1;
    for (const r of ranges) {
      if (r.fromAyah > ayah) break;
      ayah = Math.max(ayah, r.toAyah + 1);
    }
    if (ayah > total) continue;
    const nextCovered = ranges.find(r => r.fromAyah > ayah)?.fromAyah ?? total + 1;
    const toAyah = Math.min(total, ayah + limit - 1, nextCovered - 1);
    return { surahId, nameAr: surahInfo(surahId)!.nameAr, fromAyah: ayah, toAyah, verseCount: toAyah - ayah + 1 };
  }
  return null;
}

/** New stage and next review day after a review. */
export function scheduleReview(stage: number, grade: HifzGrade, today: string) {
  const next = grade === 'AGAIN' ? 0 : grade === 'HARD' ? Math.max(0, stage) : grade === 'GOOD' ? Math.min(HIFZ_MAX_STAGE, stage + 1) : Math.min(HIFZ_MAX_STAGE, stage + 2);
  const base: number = HIFZ_REVIEW_INTERVALS[next] ?? 120;
  const interval = grade === 'AGAIN' ? 1 : grade === 'HARD' ? Math.max(1, Math.ceil(base / 2)) : base;
  return { stage: next, nextReviewDay: shiftDayKey(today, interval), intervalDays: interval };
}

const verseCount = (ss: Array<Pick<Segment, 'fromAyah' | 'toAyah'>>) => ss.reduce((n, s) => n + s.toAyah - s.fromAyah + 1, 0);

async function userDay(db: Db, userId: string, now: Date) {
  const rows = await db.$queryRaw`SELECT "timezone" FROM "users" WHERE "id" = ${userId}`;
  if (!rows[0]) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  const timezone = resolveTimezone(rows[0].timezone);
  return { timezone, today: getLocalClock(now, timezone).dayKey };
}
async function readPlan(db: Db, userId: string): Promise<Plan | null> {
  const rows = await db.$queryRaw`SELECT * FROM "hifz_plans" WHERE "userId" = ${userId}`;
  return rows[0] ? toPlan(rows[0]) : null;
}
async function readSegments(db: Db, userId: string): Promise<Segment[]> {
  const rows = await db.$queryRaw`SELECT * FROM "hifz_segments" WHERE "userId" = ${userId} ORDER BY "surahId", "fromAyah"`;
  return rows.map(toSegment);
}
async function pagesOf(db: Db, surahId: number, fromAyah: number, toAyah: number): Promise<number[]> {
  const rows = await db.$queryRaw`SELECT DISTINCT "page" FROM "ayahs" WHERE "surahId" = ${surahId} AND "ayahNumber" BETWEEN ${fromAyah} AND ${toAyah} AND "page" IS NOT NULL ORDER BY "page"`;
  return rows.map((r: any) => Number(r.page));
}
function withVerseKeys<T extends { surahId: number; fromAyah: number; toAyah: number }>(s: T) {
  return { ...s, nameAr: surahInfo(s.surahId)!.nameAr, firstVerseKey: `${s.surahId}:${s.fromAyah}`, lastVerseKey: `${s.surahId}:${s.toAyah}`, verseCount: s.toAyah - s.fromAyah + 1 };
}

export async function getHifzPlan(userId: string, db: Db = prisma) {
  const plan = await readPlan(db, userId);
  return { plan, scopeVerses: plan ? planSurahOrder(plan).reduce((n, id) => n + surahInfo(id)!.totalAyahs, 0) : 0 };
}

export async function saveHifzPlan(userId: string, input: HifzPlanInput, db: Db = prisma) {
  const v = hifzPlanInputSchema.parse(input);
  if (v.reciterId && validateQuranAudioSelection(1, 1, v.reciterId).reader.riwaya === 'Warsh') {
    throw new AppError('Memorization plans use Hafs verse numbering; choose a Hafs reciter', 400, ErrorCodes.VALIDATION_ERROR);
  }
  await db.$executeRaw`INSERT INTO "hifz_plans" ("userId","fromSurah","toSurah","direction","dailyNewVerses","reviewLimit","reciterId","reminderEnabled","reminderTime","status","revision","updatedAt")
    VALUES (${userId},${v.fromSurah},${v.toSurah},${v.direction},${v.dailyNewVerses},${v.reviewLimit},${v.reciterId},${v.reminderEnabled},${v.reminderTime},'ACTIVE',0,CURRENT_TIMESTAMP)
    ON CONFLICT ("userId") DO UPDATE SET "fromSurah"=EXCLUDED."fromSurah","toSurah"=EXCLUDED."toSurah","direction"=EXCLUDED."direction",
      "dailyNewVerses"=EXCLUDED."dailyNewVerses","reviewLimit"=EXCLUDED."reviewLimit","reciterId"=EXCLUDED."reciterId",
      "reminderEnabled"=EXCLUDED."reminderEnabled","reminderTime"=EXCLUDED."reminderTime","revision"="hifz_plans"."revision"+1,"updatedAt"=CURRENT_TIMESTAMP`;
  return getHifzPlan(userId, db);
}

export async function setHifzPlanStatus(userId: string, status: 'ACTIVE' | 'PAUSED', db: Db = prisma) {
  const n = await db.$executeRaw`UPDATE "hifz_plans" SET "status"=${status},"revision"="revision"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId}`;
  if (!n) throw new AppError('No memorization plan', 404, ErrorCodes.NOT_FOUND);
  return getHifzPlan(userId, db);
}

/** Deletes the plan; memorized segments are kept unless `deleteProgress` is true. */
export async function deleteHifzPlan(userId: string, deleteProgress: boolean, db: Db = prisma) {
  await db.$executeRaw`DELETE FROM "hifz_plans" WHERE "userId"=${userId}`;
  if (deleteProgress) await db.$executeRaw`DELETE FROM "hifz_segments" WHERE "userId"=${userId}`;
  return { deleted: true, progressDeleted: deleteProgress };
}

export async function getHifzToday(userId: string, now = new Date(), db: Db = prisma) {
  const { today, timezone } = await userDay(db, userId, now);
  const plan = await readPlan(db, userId);
  const segments = await readSegments(db, userId);
  const memorizedToday = verseCount(segments.filter(s => s.memorizedDay === today));
  const due = segments.filter(s => s.nextReviewDay <= today).sort((a, b) => a.nextReviewDay.localeCompare(b.nextReviewDay) || a.surahId - b.surahId || a.fromAyah - b.fromAyah);
  const limit = plan?.reviewLimit ?? 10;
  let portion: ReturnType<typeof nextPortion> = null;
  const remaining = plan ? Math.max(0, plan.dailyNewVerses - memorizedToday) : 0;
  if (plan && plan.status === 'ACTIVE') portion = nextPortion(plan, segments, remaining);
  const planComplete = Boolean(plan && nextPortion(plan, segments, 1) === null);
  return {
    day: today, timezone, plan,
    newPortion: portion ? { ...withVerseKeys(portion), pages: await pagesOf(db, portion.surahId, portion.fromAyah, portion.toAyah) } : null,
    newDoneToday: Boolean(plan && remaining === 0),
    memorizedTodayVerses: memorizedToday,
    planComplete,
    reviews: due.slice(0, limit).map(s => ({ ...withVerseKeys(s), segmentId: s.id, stage: s.stage, dueDay: s.nextReviewDay, overdueDays: Math.max(0, Math.round((Date.parse(today) - Date.parse(s.nextReviewDay)) / 86400000)) })),
    reviewsDueTotal: due.length,
  };
}

export async function addHifzSegment(userId: string, input: z.infer<typeof hifzSegmentInputSchema>, now = new Date(), db: Db = prisma) {
  const v = hifzSegmentInputSchema.parse(input);
  const surah = surahInfo(v.surahId)!;
  if (v.toAyah < v.fromAyah || v.toAyah > surah.totalAyahs) throw new AppError('Invalid verse range', 400, ErrorCodes.VALIDATION_ERROR);
  const { today } = await userDay(db, userId, now);
  const run = async (tx: Db) => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`;
    const overlap = await tx.$queryRaw`SELECT "id" FROM "hifz_segments" WHERE "userId"=${userId} AND "surahId"=${v.surahId} AND "fromAyah" <= ${v.toAyah} AND "toAyah" >= ${v.fromAyah} LIMIT 1`;
    if (overlap.length) throw new AppError('Some of these verses are already marked as memorized', 409, ErrorCodes.VALIDATION_ERROR);
    const id = randomUUID();
    const next = shiftDayKey(today, HIFZ_REVIEW_INTERVALS[0]);
    await tx.$executeRaw`INSERT INTO "hifz_segments" ("id","userId","surahId","fromAyah","toAyah","memorizedDay","stage","nextReviewDay","updatedAt")
      VALUES (${id},${userId},${v.surahId},${v.fromAyah},${v.toAyah},${today}::date,0,${next}::date,CURRENT_TIMESTAMP)`;
    return id;
  };
  const id = db === prisma ? await prisma.$transaction(run) : await run(db);
  const rows = await db.$queryRaw`SELECT * FROM "hifz_segments" WHERE "id"=${id}`;
  return withVerseKeys(toSegment(rows[0]));
}

export async function reviewHifzSegment(userId: string, segmentId: string, grade: HifzGrade, now = new Date(), db: Db = prisma) {
  const { today } = await userDay(db, userId, now);
  const rows = await db.$queryRaw`SELECT * FROM "hifz_segments" WHERE "id"=${segmentId} AND "userId"=${userId}`;
  if (!rows[0]) throw new AppError('Segment not found', 404, ErrorCodes.NOT_FOUND);
  const seg = toSegment(rows[0]);
  const s = scheduleReview(seg.stage, grade, today);
  await db.$executeRaw`UPDATE "hifz_segments" SET "stage"=${s.stage},"nextReviewDay"=${s.nextReviewDay}::date,"lastReviewedAt"=${now},"lastGrade"=${grade},
    "reviewCount"="reviewCount"+1,"lapses"="lapses"+${grade === 'AGAIN' ? 1 : 0},"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${segmentId} AND "userId"=${userId}`;
  const updated = await db.$queryRaw`SELECT * FROM "hifz_segments" WHERE "id"=${segmentId}`;
  return { ...withVerseKeys(toSegment(updated[0])), intervalDays: s.intervalDays };
}

export async function deleteHifzSegment(userId: string, segmentId: string, db: Db = prisma) {
  const n = await db.$executeRaw`DELETE FROM "hifz_segments" WHERE "id"=${segmentId} AND "userId"=${userId}`;
  if (!n) throw new AppError('Segment not found', 404, ErrorCodes.NOT_FOUND);
  return { deleted: true };
}

export async function getHifzProgress(userId: string, now = new Date(), db: Db = prisma) {
  const { today } = await userDay(db, userId, now);
  const plan = await readPlan(db, userId);
  const segments = await readSegments(db, userId);
  const bySurah = new Map<number, number>();
  for (const s of segments) bySurah.set(s.surahId, (bySurah.get(s.surahId) ?? 0) + s.toAyah - s.fromAyah + 1);
  const scope = plan ? planSurahOrder(plan) : [];
  const scopeVerses = scope.reduce((n, id) => n + surahInfo(id)!.totalAyahs, 0);
  const inScope = scope.reduce((n, id) => n + (bySurah.get(id) ?? 0), 0);
  const weekAgo = shiftDayKey(today, -6);
  const strong = segments.filter(s => s.stage >= 3);
  return {
    day: today,
    memorizedVerses: verseCount(segments),
    memorizedSurahs: [...bySurah.entries()].filter(([id, n]) => n === surahInfo(id)!.totalAyahs).map(([id]) => id),
    scopeVerses, scopeMemorizedVerses: inScope,
    scopePercent: scopeVerses ? Math.round((inScope * 1000) / scopeVerses) / 10 : 0,
    versesThisWeek: verseCount(segments.filter(s => s.memorizedDay >= weekAgo)),
    reviewsDue: segments.filter(s => s.nextReviewDay <= today).length,
    strongVerses: verseCount(strong),
    surahs: [...bySurah.entries()].sort((a, b) => a[0] - b[0]).map(([id, n]) => ({ surahId: id, nameAr: surahInfo(id)!.nameAr, totalAyahs: surahInfo(id)!.totalAyahs, memorizedAyahs: n,
      complete: n === surahInfo(id)!.totalAyahs })),
    segments: segments.map(s => ({ ...withVerseKeys(s), segmentId: s.id })),
  };
}

// ---------------------------------------------------------------- self-test

export const hifzTestQuerySchema = z.object({
  surahId: z.coerce.number().int().min(1).max(114).optional(),
  fromAyah: z.coerce.number().int().min(1).max(286).optional(),
  toAyah: z.coerce.number().int().min(1).max(286).optional(),
  count: z.coerce.number().int().min(1).max(20).default(5),
  types: z.string().regex(/^(NEXT_AYAH|COMPLETE_AYAH|WHICH_SURAH)(,(NEXT_AYAH|COMPLETE_AYAH|WHICH_SURAH))*$/).optional(),
  seed: z.coerce.number().int().min(0).max(2_147_483_647).optional(),
}).strict();

export type AyahText = { surahId: number; ayahNumber: number; textAr: string };
export type HifzQuestion = { id: string; type: 'NEXT_AYAH' | 'COMPLETE_AYAH' | 'WHICH_SURAH'; promptAr: string; prompt: string; promptVerseKey: string;
  options: Array<{ id: string; text: string }>; correctOptionId: string; answerVerseKey: string };

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
const words = (t: string) => t.trim().split(/\s+/);

/**
 * Builds questions from the tested verses (`pool`) with distractors from `context` (same surahs and neighbours).
 * Pure and deterministic for a given seed. Option texts are distinct.
 */
export function buildHifzQuestions(pool: AyahText[], context: AyahText[], opts: { count: number; types: HifzQuestion['type'][]; seed: number; testedSurahs: number[] }): HifzQuestion[] {
  const r = rng(opts.seed);
  const key = (a: AyahText) => `${a.surahId}:${a.ayahNumber}`;
  const byKey = new Map(context.map(a => [key(a), a]));
  const out: HifzQuestion[] = [];
  const used = new Set<string>();
  const candidates = shuffle(pool, r);
  let attempts = 0;
  while (out.length < opts.count && attempts < opts.count * 20 && candidates.length) {
    attempts++;
    const type = opts.types[attempts % opts.types.length]!; // rotates; a type that cannot use this verse yields to the next
    const a = candidates[Math.floor(attempts / opts.types.length) % candidates.length]!;
    const id = `${type}:${key(a)}`;
    if (used.has(id)) continue;
    let prompt = '', promptAr = '', correct = '', answerKey = '', distract: string[] = [];
    if (type === 'NEXT_AYAH') {
      const next = byKey.get(`${a.surahId}:${a.ayahNumber + 1}`);
      if (!next) continue;
      promptAr = 'ما الآية التالية؟'; prompt = a.textAr; correct = next.textAr; answerKey = key(next);
      distract = shuffle(context.filter(c => c.surahId === a.surahId && c.ayahNumber !== a.ayahNumber && c.ayahNumber !== next.ayahNumber), r).map(c => c.textAr);
      if (distract.length < 3) distract = distract.concat(shuffle(context.filter(c => c.surahId !== a.surahId), r).map(c => c.textAr));
    } else if (type === 'COMPLETE_AYAH') {
      const w = words(a.textAr);
      if (w.length < 6) continue;
      const cut = Math.floor(w.length / 2);
      promptAr = 'أكمل الآية'; prompt = `${w.slice(0, cut).join(' ')} …`; correct = w.slice(cut).join(' '); answerKey = key(a);
      distract = shuffle(context.filter(c => key(c) !== key(a) && words(c.textAr).length >= 6), r).map(c => { const cw = words(c.textAr); return cw.slice(Math.floor(cw.length / 2)).join(' '); });
    } else {
      promptAr = 'من أي سورة هذه الآية؟'; prompt = a.textAr; correct = surahInfo(a.surahId)!.nameAr; answerKey = key(a);
      const near = [...new Set([...opts.testedSurahs, a.surahId - 2, a.surahId - 1, a.surahId + 1, a.surahId + 2, a.surahId + 3])]
        .filter(id => id >= 1 && id <= 114 && id !== a.surahId);
      distract = shuffle(near, r).map(id => surahInfo(id)!.nameAr);
    }
    const options = [correct, ...[...new Set(distract)].filter(t => t !== correct).slice(0, 3)];
    if (options.length < 4) continue;
    used.add(id);
    const shuffled = shuffle(options.map((text, i) => ({ text, correct: i === 0 })), r);
    const qn = out.length + 1;
    out.push({ id: `q${qn}`, type, promptAr, prompt, promptVerseKey: key(a), answerVerseKey: answerKey,
      options: shuffled.map((o, i) => ({ id: `q${qn}o${i + 1}`, text: o.text })),
      correctOptionId: `q${qn}o${shuffled.findIndex(o => o.correct) + 1}` });
  }
  return out;
}

async function ayahTexts(db: Db, surahIds: number[]): Promise<AyahText[]> {
  if (!surahIds.length) return [];
  const rows = await db.$queryRaw`SELECT "surahId","ayahNumber","textAr" FROM "ayahs" WHERE "surahId" = ANY(${surahIds}::int[]) ORDER BY "surahId","ayahNumber"`;
  return rows.map((r: any) => sanitizeAyahText({ surahId: Number(r.surahId), ayahNumber: Number(r.ayahNumber), textAr: String(r.textAr) }));
}

/** Self-test from a given range, or from everything the user has memorized. Answers are included (self-check). */
export async function getHifzTest(userId: string, raw: unknown, db: Db = prisma) {
  const q = hifzTestQuerySchema.parse(raw);
  let ranges: Array<{ surahId: number; fromAyah: number; toAyah: number }>;
  if (q.surahId) {
    const total = surahInfo(q.surahId)!.totalAyahs;
    const from = q.fromAyah ?? 1, to = q.toAyah ?? total;
    if (from > to || to > total) throw new AppError('Invalid verse range', 400, ErrorCodes.VALIDATION_ERROR);
    ranges = [{ surahId: q.surahId, fromAyah: from, toAyah: to }];
  } else {
    ranges = await readSegments(db, userId);
    if (!ranges.length) throw new AppError('Nothing memorized yet: choose a surah to test', 409, ErrorCodes.VALIDATION_ERROR);
  }
  const tested = [...new Set(ranges.map(r => r.surahId))];
  const context = await ayahTexts(db, tested);
  if (!context.length) throw new AppError('Quran text unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
  const pool = context.filter(a => ranges.some(r => r.surahId === a.surahId && a.ayahNumber >= r.fromAyah && a.ayahNumber <= r.toAyah));
  const types = (q.types?.split(',') ?? ['NEXT_AYAH', 'COMPLETE_AYAH', 'WHICH_SURAH']) as HifzQuestion['type'][];
  const seed = q.seed ?? Math.floor(Math.random() * 2_147_483_647);
  const questions = buildHifzQuestions(pool, context, { count: q.count, types, seed, testedSurahs: tested });
  return { seed, ranges: ranges.map(r => withVerseKeys(r)), questions };
}

// ---------------------------------------------------------------- reminder

const HIFZ_TITLE_AR = 'وردك من الحفظ';
const HIFZ_TITLE_EN = 'Your memorization';
const HIFZ_DEEP_LINK = '/quran/hifz';

/** Cron slice: one reminder per local day at the plan's time, only when there is something to do today. */
export async function runHifzReminders(now = new Date()) {
  let usersScanned = 0, pushesAttempted = 0, pushesSent = 0;
  const skipped: Record<string, number> = {};
  let cursor = '';
  for (;;) {
    const users: any[] = await prisma.$queryRaw`SELECT u."id", u."timezone", p."reminderTime" FROM "users" u JOIN "hifz_plans" p ON p."userId" = u."id"
      WHERE u."isActive" = true AND p."reminderEnabled" = true AND p."status" = 'ACTIVE' AND u."id" > ${cursor}
        AND EXISTS (SELECT 1 FROM "device_tokens" t WHERE t."userId" = u."id") ORDER BY u."id" LIMIT 200`;
    if (!users.length) break;
    cursor = users[users.length - 1].id;
    for (const user of users) {
      usersScanned++;
      try {
        const timeZone = resolveTimezone(user.timezone);
        const reminderTime = normalizeHhmm(user.reminderTime, '06:00');
        const decision = evaluateMulkEligibility({ enabled: true, now, timeZone, reminderTime });
        if (!decision.eligible || !decision.dayKey) { skipped.OUTSIDE_WINDOW = (skipped.OUTSIDE_WINDOW ?? 0) + 1; continue; }
        const today = await getHifzToday(user.id, now);
        if (!today.newPortion && today.reviewsDueTotal === 0) { skipped.NOTHING_DUE = (skipped.NOTHING_DUE ?? 0) + 1; continue; }
        const occurrenceKey = `${decision.dayKey}|HIFZ|${reminderTime}`;
        const claimed = await prisma.$executeRaw`INSERT INTO "hifz_send_logs" ("id","userId","occurrenceKey") VALUES (${randomUUID()},${user.id},${occurrenceKey}) ON CONFLICT DO NOTHING`;
        if (!claimed) { skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1; continue; }
        const parts: string[] = [];
        if (today.newPortion) parts.push(`حفظ جديد: ${today.newPortion.nameAr} ${today.newPortion.fromAyah}–${today.newPortion.toAyah}`);
        if (today.reviewsDueTotal) parts.push(`مراجعة ${today.reviewsDueTotal} ${today.reviewsDueTotal === 1 ? 'مقطع' : 'مقاطع'}`);
        const bodyAr = parts.join(' · ');
        const bodyEn = [today.newPortion ? `New: ${today.newPortion.verseCount} verses` : '', today.reviewsDueTotal ? `${today.reviewsDueTotal} to review` : ''].filter(Boolean).join(' · ');
        const data: Record<string, string> = { type: 'HIFZ_REMINDER', kind: 'hifz_reminder', eventType: 'HIFZ_REMINDER', deepLink: HIFZ_DEEP_LINK,
          dayKey: decision.dayKey, timezone: timeZone, reminderTime, occurrenceKey, dedupeKey: `${user.id}|${occurrenceKey}`, androidChannelId: 'hifz',
          titleAr: HIFZ_TITLE_AR, bodyAr, titleEn: HIFZ_TITLE_EN, bodyEn, source: 'SERVER' };
        pushesAttempted++;
        const result = await sendPushToUser(user.id, { title: HIFZ_TITLE_AR, body: bodyAr, titleAr: HIFZ_TITLE_AR, bodyAr, data, androidChannelId: 'hifz', ttlSeconds: PUSH_TTL_SECONDS.SCHEDULED_REMINDER });
        pushesSent += result.sent;
        await createNotification({ userId: user.id, titleAr: HIFZ_TITLE_AR, titleEn: HIFZ_TITLE_EN, bodyAr, bodyEn, type: 'GENERAL', deepLink: HIFZ_DEEP_LINK, payload: data }).catch(() => null);
      } catch (err) {
        skipped.ERROR = (skipped.ERROR ?? 0) + 1;
        logger.warn('[HifzReminder] failed for user', { userId: user.id, message: (err as Error)?.message });
      }
    }
    if (users.length < 200) break;
  }
  return { usersScanned, pushesAttempted, pushesSent, skipped };
}
