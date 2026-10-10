import { creditReadingUnits } from './reading-progress.service';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { getMushafPage, editionIdSchema } from './mushaf.service';
import { readingGoalReader, dayString } from './reading-goal.service';
import { readingMutation, readingConflict, lookupReadingOperation } from './reading-plan.service';
import { requireWarsh } from './warsh-content.service';
import { getDailyWird } from './adhkar.service';
import { dateOnlyFromDayKey } from '../shared/utils/user-local-date';
export const sessionStartSchema = z.object({ editionId: editionIdSchema, minutes: z.union([z.literal(5), z.literal(10), z.literal(20)]), includeAdhkar: z.boolean().default(true), includeReflection: z.boolean().default(true), requestKey: z.string().uuid() }).strict();
export const sessionUpdateSchema = z.object({ requestKey: z.string().uuid(), revision: z.number().int().min(0), completedUnits: z.array(z.string().max(20)).max(60).default([]), doneTasks: z.array(z.string().max(40)).max(3).default([]), skippedTasks: z.array(z.literal('reflection')).max(1).default([]), status: z.enum(['ACTIVE', 'PAUSED']).default('ACTIVE') }).strict().refine(v => new Set(v.completedUnits).size === v.completedUnits.length && new Set(v.doneTasks).size === v.doneTasks.length, 'Duplicate confirmations');
type Session = {
    id: string;
    userId: string;
    editionId: string;
    contentVersion: string;
    scope: string;
    day: Date;
    timezone: string;
    minutes: number;
    payload: any;
    confirmedUnits: string[];
    doneTasks: string[];
    skippedTasks: string[];
    status: string;
    revision: number;
    expiresAt: Date;
};
function dto(row: Session) { return { sessionId: row.id, editionId: row.editionId, contentVersion: row.contentVersion, date: dayString(row.day), timezone: row.timezone, minutes: row.minutes, expiresAt: row.expiresAt.toISOString(), revision: row.revision, status: row.status, ...row.payload, confirmedUnits: row.confirmedUnits, doneTasks: row.doneTasks, skippedTasks: row.skippedTasks }; }
export async function getReadingSession(userId: string, id: string) {
    const rows = await prisma.$queryRaw<Session[]> `SELECT * FROM "reading_sessions" WHERE "id"=${id} AND "userId"=${userId}`;
    if (!rows[0])
        throw new AppError('Reading session not found', 404, ErrorCodes.NOT_FOUND);
    return dto(rows[0]);
}
export async function listReadingSessions(userId: string) {
    const rows = await prisma.$queryRaw<Session[]> `SELECT * FROM "reading_sessions" WHERE "userId"=${userId} ORDER BY "createdAt" DESC,"id" DESC LIMIT 20`;
    return { items: rows.map(dto), limit: 20 };
}
export async function startReadingSession(userId: string, input: z.infer<typeof sessionStartSchema>) {
    // Content lookup happens before the write transaction; provider failures never leave partial sessions.
    const replay = await lookupReadingOperation(userId, input.requestKey, { operation: 'START_SESSION', ...input });
    if (replay)
        return replay;
    const goal = await readingGoalReader.get(userId, input.editionId);
    if (!goal.available)
        throw new AppError('Selected edition is unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
    const scope = goal.plan?.id ?? `free:${goal.date}`;
    const previous = await prisma.$queryRaw<Array<{
        unitKey: string;
    }>> `SELECT "unitKey" FROM "reading_units" WHERE "userId"=${userId} AND "editionId"=${input.editionId} AND "contentVersion"=${goal.contentVersion} AND "scope"=${scope}`;
    const done = new Set(previous.map(x => x.unitKey));
    const reflection = input.includeReflection && goal.unit === 'PAGE';
    const reserve = (input.includeAdhkar ? 1 : 0) + (reflection ? 1 : 0);
    const availableMinutes = Math.max(1, input.minutes - reserve);
    const maximum = goal.unit === 'PAGE' ? Math.floor(availableMinutes / 2) : Math.floor(availableMinutes * 3);
    const limit = Math.max(0, Math.min(maximum, goal.remaining));
    let units: string[] = [];
    let references: any[] = [];
    if (goal.unit === 'VERSE') {
        const verses = readingContent.warsh();
        if (goal.plan)
            done.clear();
        if (goal.plan) {
            const completed = await prisma.$queryRaw<Array<{
                verseKey: string;
            }>> `SELECT "verseKey" FROM "warsh_completions" WHERE "cycleId"=${goal.plan.id}`;
            completed.forEach(x => done.add(x.verseKey));
        }
        const start = verses.findIndex(v => v.key === goal.resume?.verseKey);
        units = verses.slice(Math.max(0, start)).filter(v => !done.has(v.key)).slice(0, limit).map(v => v.key);
        if (units.length < limit)
            units.push(...verses.slice(0, Math.max(0, start)).filter(v => !done.has(v.key)).slice(0, limit - units.length).map(v => v.key));
        references = units.map(key => { const v = verses.find(x => x.key === key)!; return { unitKey: key, surah: v.surah, ayah: v.ayah, contentPath: `/quran/warsh/chapters/${v.surah}?fromAyah=${v.ayah}&limit=1` }; });
    }
    else {
        const start = (goal.resume && 'page' in goal.resume ? goal.resume.page : 1);
        const candidates = Array.from({ length: 604 }, (_, i) => String((start - 1 + i) % 604 + 1));
        units = candidates.filter(p => !done.has(p)).slice(0, limit);
        const pages = await Promise.all(units.map(p => readingContent.page(input.editionId, Number(p))));
        references = pages.map(p => ({ unitKey: String(p.page), page: p.page, firstVerseKey: p.verses[0].key, contentPath: `/quran/editions/${input.editionId}/pages/${p.page}` }));
    }
    const tasks: any[] = [];
    if (units.length)
        tasks.push({ id: 'quran', kind: 'QURAN', unit: goal.unit, units, references, estimatedMinutes: goal.unit === 'PAGE' ? units.length * 2 : Math.ceil(units.length / 3), labelAr: 'ورد القرآن', labelEn: 'Quran portion' });
    if (input.includeAdhkar) {
        const wird = await readingContent.dhikr();
        const item = (wird as any).items?.find((i: any) => Number(i.repeatCount) <= 10);
        if (item)
            tasks.push({ id: 'adhkar', kind: 'ADHKAR', estimatedMinutes: 1, labelAr: 'ذكر قصير', labelEn: 'A short dhikr', item: { id: item.id, textAr: item.textArPlain || item.textAr, textEn: item.textEn || '', repeatCount: item.repeatCount, referenceAr: item.referenceAr, referenceEn: item.referenceEn || '' }, countsTowardFullDailyAdhkar: false });
    }
    if (reflection && references[0]) {
        const [surahId, ayahNumber] = references[0].firstVerseKey.split(':').map(Number);
        tasks.push({ id: 'reflection', kind: 'REFLECTION', estimatedMinutes: 1, labelAr: 'معنى آية من وردك', labelEn: 'Understand a verse from your portion', verseKey: references[0].firstVerseKey, contentPath: `/quran/tafsir?surahId=${surahId}&ayahNumber=${ayahNumber}`, requiresSourceAttribution: true, optionalWhenProviderUnavailable: true });
    }
    if (!tasks.length)
        throw readingConflict('Today\'s reading is complete. Choose an Adhkar session or return tomorrow.');
    const payload = { tasks, estimatedMinutes: tasks.reduce((sum, t) => sum + t.estimatedMinutes, 0), timeIsEstimate: true, unit: goal.unit, goalAtStart: { target: goal.target, completed: goal.completed }, offlinePolicy: 'SERVER_ISSUED_SESSION_7_DAYS', globalAdhkarCredit: false };
    return readingMutation(userId, input.requestKey, { operation: 'START_SESSION', ...input }, async (tx) => {
        const current = await readingGoalReader.get(userId, input.editionId);
        if ((current.plan?.id ?? `free:${current.date}`) !== scope || current.contentVersion !== goal.contentVersion || current.date !== goal.date)
            throw readingConflict('Plan or calendar day changed while preparing the session');
        const id = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 86400000);
        await tx.$executeRaw `INSERT INTO "reading_sessions"("id","userId","editionId","contentVersion","scope","day","timezone","minutes","payload","expiresAt") VALUES(${id},${userId},${input.editionId},${goal.contentVersion},${scope},${dateOnlyFromDayKey(goal.date)}::date,${goal.timezone},${input.minutes},${JSON.stringify(payload)}::jsonb,${expiresAt})`;
        const rows = await tx.$queryRaw<Session[]> `SELECT * FROM "reading_sessions" WHERE "id"=${id}`;
        return dto(rows[0]!);
    });
}
export async function updateReadingSession(userId: string, id: string, input: z.infer<typeof sessionUpdateSchema>) {
    return readingMutation(userId, input.requestKey, { operation: 'UPDATE_SESSION', sessionId: id, ...input }, async (tx) => {
        const rows = await tx.$queryRaw<Session[]> `SELECT * FROM "reading_sessions" WHERE "id"=${id} AND "userId"=${userId} FOR UPDATE`;
        const row = rows[0];
        if (!row)
            throw new AppError('Reading session not found', 404, ErrorCodes.NOT_FOUND);
        if (row.revision !== input.revision)
            throw readingConflict('Session changed on another device; reload before saving');
        if (row.expiresAt.getTime() <= Date.now())
            throw readingConflict('Session sync window expired; refresh before recording new reading');
        const current = await readingGoalReader.get(userId, row.editionId as any);
        if (!current.available || current.contentVersion !== row.contentVersion || (current.plan?.id ?? `free:${dayString(row.day)}`) !== row.scope)
            throw readingConflict('Session belongs to another plan or content version');
        const quran = row.payload.tasks.find((t: any) => t.kind === 'QURAN');
        const allowed = new Set<string>(quran?.units ?? []);
        if (input.completedUnits.some(key => !allowed.has(key)))
            throw new AppError('Confirmation outside the offered reading portion', 400, ErrorCodes.VALIDATION_ERROR);
        const confirmable = new Set<string>(row.payload.tasks.filter((t: any) => t.kind !== 'QURAN').map((t: any) => t.id));
        if (input.doneTasks.some(key => !confirmable.has(key)))
            throw new AppError('Unknown session task', 400, ErrorCodes.VALIDATION_ERROR);
        if (input.skippedTasks.some(key => !confirmable.has(key)))
            throw new AppError('Unknown optional task', 400, ErrorCodes.VALIDATION_ERROR);
        const skippedTasks = [...new Set([...row.skippedTasks, ...input.skippedTasks])];
        const confirmedUnits = [...new Set([...row.confirmedUnits, ...input.completedUnits])];
        const doneTasks = [...new Set([...row.doneTasks, ...input.doneTasks])];
        if (quran && quran.units.every((key: string) => confirmedUnits.includes(key)))
            doneTasks.push('quran');
        await creditReadingUnits(tx, userId, { ...row, source: current.source }, input.completedUnits);
        const uniqueDone = [...new Set(doneTasks)];
        const status = row.payload.tasks.every((t: any) => uniqueDone.includes(t.id) || skippedTasks.includes(t.id)) ? 'COMPLETED' : input.status;
        await tx.$executeRaw `UPDATE "reading_sessions" SET "confirmedUnits"=${JSON.stringify(confirmedUnits)}::jsonb,"doneTasks"=${JSON.stringify(uniqueDone)}::jsonb,"skippedTasks"=${JSON.stringify(skippedTasks)}::jsonb,"status"=${status},"revision"="revision"+1,"updatedAt"=CURRENT_TIMESTAMP WHERE "id"=${id}`;
        const updated = await tx.$queryRaw<Session[]> `SELECT * FROM "reading_sessions" WHERE "id"=${id}`;
        return dto(updated[0]!);
    });
}
export const readingContent = { page: getMushafPage, dhikr: getDailyWird, warsh: requireWarsh };
