import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { dateOnlyFromDayKey, getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import { requireWarsh, warshVerse, WARSH_CONTENT_VERSION, WARSH_TOTAL_VERSES } from './warsh-content.service';

const version = z.literal(WARSH_CONTENT_VERSION);
const key = z.string().regex(/^\d{1,3}:\d{1,3}$/);
export const warshPositionSchema = z.object({ contentVersion: version, verseKey: key, revision: z.number().int().min(0) }).strict();
export const warshBookmarkInputSchema = z.object({ contentVersion: version, verseKey: key, saved: z.boolean(), note: z.string().max(500).default('') }).strict();
export const warshCycleInputSchema = z.object({ contentVersion: version, requestKey: z.string().uuid(), expectedCycleId: z.string().uuid().nullable(), durationDays: z.number().int().min(1).max(365) }).strict();
export const warshCompletionInputSchema = z.object({ contentVersion: version, verseKeys: z.array(key).min(1).max(100).refine(v => new Set(v).size === v.length, 'Duplicate verse keys'), completed: z.boolean(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }).strict();
const conflict = (message: string) => new AppError(message, 409, ErrorCodes.VALIDATION_ERROR);
export async function getWarshPosition(userId: string) {
  requireWarsh();
  const rows = await prisma.$queryRaw<Array<{ verseKey: string; revision: number }>>`SELECT "verseKey","revision" FROM "warsh_reader_states" WHERE "userId"=${userId} AND "contentVersion"=${WARSH_CONTENT_VERSION}`;
  const position = rows[0] ?? { verseKey: '1:1', revision: 0 };
  const verse = warshVerse(position.verseKey);
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, ...position, surah: verse.surah, ayah: verse.ayah };
}
export async function setWarshPosition(userId: string, input: z.infer<typeof warshPositionSchema>) {
  warshVerse(input.verseKey);
  const old = await getWarshPosition(userId);
  if (old.revision === input.revision + 1 && old.verseKey === input.verseKey) return old;
  const rows = await prisma.$queryRaw<Array<{ verseKey: string; revision: number }>>`INSERT INTO "warsh_reader_states" ("userId","contentVersion","verseKey","revision") SELECT ${userId},${WARSH_CONTENT_VERSION},${input.verseKey},1 WHERE ${input.revision}=0 OR EXISTS (SELECT 1 FROM "warsh_reader_states" WHERE "userId"=${userId} AND "contentVersion"=${WARSH_CONTENT_VERSION} AND "revision"=${input.revision}) ON CONFLICT ("userId","contentVersion") DO UPDATE SET "verseKey"=EXCLUDED."verseKey","revision"="warsh_reader_states"."revision"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "warsh_reader_states"."revision"=${input.revision} RETURNING "verseKey","revision"`;
  if (!rows[0]) {
    const now = await getWarshPosition(userId);
    if (now.revision === input.revision + 1 && now.verseKey === input.verseKey) return now;
    throw conflict('Reading position changed; reload before confirming a new write');
  }
  const verse = warshVerse(rows[0].verseKey);
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, ...rows[0], surah: verse.surah, ayah: verse.ayah };
}
export async function getWarshBookmarks(userId: string, afterOrdinal: number, limit: number) {
  requireWarsh();
  const rows = await prisma.$queryRaw<Array<{ verseKey: string; ordinal: number; note: string; updatedAt: Date }>>`SELECT "verseKey","ordinal","note","updatedAt" FROM "warsh_bookmarks" WHERE "userId"=${userId} AND "contentVersion"=${WARSH_CONTENT_VERSION} AND "ordinal">${afterOrdinal} ORDER BY "ordinal" ASC LIMIT ${limit + 1}`;
  const items = rows.slice(0, limit);
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, items, nextAfterOrdinal: rows.length > limit ? items[items.length - 1]!.ordinal : null };
}
export async function setWarshBookmark(userId: string, input: z.infer<typeof warshBookmarkInputSchema>) {
  const verse = warshVerse(input.verseKey);
  if (input.saved) await prisma.$executeRaw`INSERT INTO "warsh_bookmarks" ("userId","contentVersion","verseKey","ordinal","note") VALUES (${userId},${WARSH_CONTENT_VERSION},${verse.key},${verse.ordinal},${input.note}) ON CONFLICT ("userId","contentVersion","verseKey") DO UPDATE SET "note"=EXCLUDED."note","updatedAt"=CURRENT_TIMESTAMP`;
  else await prisma.$executeRaw`DELETE FROM "warsh_bookmarks" WHERE "userId"=${userId} AND "contentVersion"=${WARSH_CONTENT_VERSION} AND "verseKey"=${verse.key}`;
  return { editionId: 'warsh-nafi', ...input };
}
type Cycle = { id: string; contentVersion: string; durationDays: number; startedOn: Date; active: boolean; requestKey: string; expectedCycleId: string | null };
export function buildWarshGoal(cycle: Cycle, completedVerses: number, completedToday: number, dayKey: string, timezone: string) {
  const start = cycle.startedOn.getTime(); const today = dateOnlyFromDayKey(dayKey).getTime();
  const elapsed = Math.max(0, Math.round((today - start) / 86400000));
  const remainingDays = Math.max(1, cycle.durationDays - elapsed);
  const remainingVerses = Math.max(0, WARSH_TOTAL_VERSES - completedVerses);
  // Include already-read unique verses today so the target doesn't shrink with each confirmation.
  const targetVersesToday = remainingVerses === 0 ? completedToday : Math.ceil((remainingVerses + completedToday) / remainingDays);
  return { editionId: 'warsh-nafi', contentVersion: cycle.contentVersion, cycleId: cycle.id, active: cycle.active, unit: 'VERSE', totalVerses: WARSH_TOTAL_VERSES, completedVerses, remainingVerses,
    progress: completedVerses / WARSH_TOTAL_VERSES, status: remainingVerses === 0 ? 'COMPLETED' : elapsed >= cycle.durationDays ? 'OVERDUE' : 'ACTIVE', durationDays: cycle.durationDays,
    startedOn: cycle.startedOn.toISOString().slice(0,10), targetEndDate: new Date(start + (cycle.durationDays - 1) * 86400000).toISOString().slice(0,10),
    dailyGoal: { date: dayKey, timezone, unit: 'VERSE', targetVerses: targetVersesToday, completedVerses: completedToday, remainingVerses: Math.max(0, targetVersesToday - completedToday), completed: remainingVerses === 0 || completedToday >= targetVersesToday } };
}
export async function getWarshCycle(userId: string, cycleId?: string) {
  requireWarsh();
  const local = await getUserLocalCalendarDay(userId);
  const rows = cycleId
    ? await prisma.$queryRaw<Cycle[]>`SELECT * FROM "warsh_cycles" WHERE "userId"=${userId} AND "id"=${cycleId}`
    : await prisma.$queryRaw<Cycle[]>`SELECT * FROM "warsh_cycles" WHERE "userId"=${userId} AND "active"=true`;
  const row = rows[0];
  if (!row) { if (cycleId) throw new AppError('Warsh cycle not found',404,ErrorCodes.NOT_FOUND); return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, cycle: null }; }
  if (row.contentVersion !== WARSH_CONTENT_VERSION) throw conflict('Cycle uses another content version; explicitly start a new cycle');
  const counts = await prisma.$queryRaw<Array<{ total: number; today: number }>>`SELECT COUNT(*)::int AS "total",COUNT(*) FILTER (WHERE "completedOn"=${local.date}::date)::int AS "today" FROM "warsh_completions" WHERE "cycleId"=${row.id}`;
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, cycle: buildWarshGoal(row, counts[0]!.total, counts[0]!.today, local.dayKey, local.timezone) };
}
export async function startWarshCycle(userId: string, input: z.infer<typeof warshCycleInputSchema>) {
  requireWarsh();
  const local = await getUserLocalCalendarDay(userId);
  const cycleId = await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
    const retried = await tx.$queryRaw<Cycle[]>`SELECT * FROM "warsh_cycles" WHERE "userId"=${userId} AND "requestKey"=${input.requestKey}`;
    if (retried[0]) {
      if (retried[0].durationDays !== input.durationDays || retried[0].contentVersion !== input.contentVersion || retried[0].expectedCycleId !== input.expectedCycleId) throw conflict('Request key was already used for a different cycle request');
      return retried[0].id;
    }
    const active = await tx.$queryRaw<Cycle[]>`SELECT * FROM "warsh_cycles" WHERE "userId"=${userId} AND "active"=true`;
    if ((active[0]?.id ?? null) !== input.expectedCycleId) throw conflict('Active cycle changed; refresh and confirm restart');
    if (active[0]) await tx.$executeRaw`UPDATE "warsh_cycles" SET "active"=false WHERE "userId"=${userId} AND "id"=${active[0].id}`;
    const id = randomUUID();
    await tx.$executeRaw`INSERT INTO "warsh_cycles" ("id","userId","contentVersion","requestKey","expectedCycleId","durationDays","startedOn") VALUES (${id},${userId},${input.contentVersion},${input.requestKey},${input.expectedCycleId},${input.durationDays},${local.date}::date)`;
    return id;
  });
  return getWarshCycle(userId, cycleId);
}
export async function setWarshCompletions(userId: string, cycleId: string, input: z.infer<typeof warshCompletionInputSchema>) {
  input.verseKeys.forEach(warshVerse);
  const local = await getUserLocalCalendarDay(userId);
  if (input.date !== local.dayKey) throw conflict('Calendar day changed; refresh the goal before confirming reading');
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
    const rows = await tx.$queryRaw<Cycle[]>`SELECT * FROM "warsh_cycles" WHERE "userId"=${userId} AND "id"=${cycleId}`;
    if (!rows[0]) throw new AppError('Warsh cycle not found',404,ErrorCodes.NOT_FOUND);
    if (!rows[0].active || rows[0].contentVersion !== input.contentVersion) throw conflict('Cycle is inactive or uses a different source version');
    const json = JSON.stringify(input.verseKeys);
    if (input.completed) await tx.$executeRaw`INSERT INTO "warsh_completions" ("cycleId","verseKey","completedOn") SELECT ${cycleId},value,${local.date}::date FROM jsonb_array_elements_text(${json}::jsonb) ON CONFLICT ("cycleId","verseKey") DO NOTHING`;
    else await tx.$executeRaw`DELETE FROM "warsh_completions" WHERE "cycleId"=${cycleId} AND "verseKey" IN (SELECT value FROM jsonb_array_elements_text(${json}::jsonb))`;
  });
  return getWarshCycle(userId, cycleId);
}
export async function getWarshCompletedVerses(userId: string, cycleId: string, surah: number) {
  await getWarshCycle(userId, cycleId);
  const prefix = `${surah}:%`;
  const items = await prisma.$queryRaw<Array<{ verseKey: string; completedOn: Date }>>`SELECT "verseKey","completedOn" FROM "warsh_completions" WHERE "cycleId"=${cycleId} AND "verseKey" LIKE ${prefix} ORDER BY split_part("verseKey",':',2)::int ASC`;
  return { editionId: 'warsh-nafi', contentVersion: WARSH_CONTENT_VERSION, cycleId, surah, items };
}
