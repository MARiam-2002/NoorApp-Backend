import { createHash, createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { env, ErrorCodes } from '../config';
import { AppError } from '../lib/errors';
import { editionIdSchema, type EditionId } from './mushaf.service';
import { readingGoalReader, dayString } from './reading-goal.service';
import { WARSH_CONTENT_VERSION } from './warsh-content.service';
import { dateOnlyFromDayKey, localDayKeyForTimezone } from '../shared/utils/user-local-date';
export const startReadingPlanSchema = z.object({ editionId: editionIdSchema, durationDays: z.number().int().min(7).max(365), expectedPlanId: z.string().max(200).nullable(), requestKey: z.string().uuid() }).strict();
const validDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(d => dayString(dateOnlyFromDayKey(d)) === d, 'Invalid date');
export const adjustmentSchema = z.object({ editionId: editionIdSchema, mode: z.enum(['EXTEND', 'REDISTRIBUTE']), targetEndDate: validDay.optional() }).strict().refine(v => v.mode === 'EXTEND' ? Boolean(v.targetEndDate) : v.targetEndDate === undefined, 'Provide targetEndDate only for EXTEND');
export const applyAdjustmentSchema = z.object({ editionId: editionIdSchema, mode: z.enum(['EXTEND', 'REDISTRIBUTE']), targetEndDate: validDay.optional(), previewToken: z.string().regex(/^[a-f0-9]{64}$/), requestKey: z.string().uuid() }).strict();
export function stableFingerprint(value: unknown): string {
    const sort = (v: any): any => Array.isArray(v) ? v.map(sort) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sort(v[k])])) : v;
    return createHash('sha256').update(JSON.stringify(sort(value))).digest('hex');
}
export const readingConflict = (message: string) => new AppError(message, 409, ErrorCodes.CONFLICT);
export async function readingMutation(userId: string, requestKey: string, input: unknown, mutate: (tx: any) => Promise<any>) {
    const fingerprint = stableFingerprint(input);
    return prisma.$transaction(async (tx) => {
        await tx.$queryRaw `SELECT "id" FROM "users" WHERE "id"=${userId} FOR UPDATE`;
        const prior = await tx.$queryRaw<Array<{
            fingerprint: string;
            result: any;
        }>> `SELECT * FROM "reading_operations" WHERE "userId"=${userId} AND "requestKey"=${requestKey}`;
        if (prior[0]) {
            if (prior[0].fingerprint !== fingerprint)
                throw readingConflict('Request key was used for another operation');
            return prior[0].result;
        }
        const result = await mutate(tx);
        await tx.$executeRaw `INSERT INTO "reading_operations"("userId","requestKey","fingerprint","result") VALUES(${userId},${requestKey},${fingerprint},${JSON.stringify(result)}::jsonb)`;
        return result;
    }, { timeout: 30000 });
}
export async function startReadingPlan(userId: string, input: z.infer<typeof startReadingPlanSchema>) {
    return readingMutation(userId, input.requestKey, { operation: 'START_PLAN', ...input }, async (tx) => {
        const goal = await readingGoalReader.get(userId, input.editionId);
        if (!goal.available && goal.availabilityReason !== 'CONTENT_VERSION_CHANGED')
            throw new AppError('Selected Quran edition unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
        if ((goal.plan?.id ?? null) !== input.expectedPlanId)
            throw readingConflict('Active plan changed; refresh before starting a new cycle');
        const id = randomUUID();
        const started = dateOnlyFromDayKey(goal.date);
        const target = new Date(started.getTime() + (input.durationDays - 1) * 86400000);
        if (input.editionId === 'warsh-nafi') {
            await tx.$executeRaw `UPDATE "warsh_cycles" SET "active"=false WHERE "userId"=${userId} AND "active"=true`;
            await tx.$executeRaw `INSERT INTO "warsh_cycles"("id","userId","contentVersion","requestKey","expectedCycleId","durationDays","startedOn") VALUES(${id},${userId},${WARSH_CONTENT_VERSION},${input.requestKey},${input.expectedPlanId},${input.durationDays},${started}::date)`;
            return { editionId: input.editionId, planId: id, startedOn: goal.date, targetEndDate: dayString(target), newCycle: true, previousProgressPreserved: true };
        }
        await tx.$executeRaw `UPDATE "reading_plans" SET "active"=false WHERE "userId"=${userId} AND "editionId"=${input.editionId} AND "active"=true`;
        await tx.$executeRaw `INSERT INTO "reading_plans"("id","userId","editionId","contentVersion","startedOn","targetEndOn") VALUES(${id},${userId},${input.editionId},${goal.contentVersion},${started}::date,${target}::date)`;
        return { editionId: input.editionId, planId: id, startedOn: goal.date, targetEndDate: dayString(target), newCycle: true, previousProgressPreserved: true };
    });
}
export async function previewReadingAdjustment(userId: string, input: z.infer<typeof adjustmentSchema>) {
    const parsed = adjustmentSchema.parse(input);
    const goal = await readingGoalReader.get(userId, parsed.editionId);
    if (!goal.available)
        throw readingConflict('Current content version must be available before adjusting this plan');
    if (!goal.plan || goal.plan.remaining === 0)
        throw readingConflict('An incomplete active plan is required');
    const end = parsed.mode === 'EXTEND' ? parsed.targetEndDate! : goal.plan.targetEndDate;
    if (end < goal.date || (parsed.mode === 'EXTEND' && end <= goal.plan.targetEndDate))
        throw readingConflict('Choose a future extension date after the existing deadline');
    const duration = Math.round((dateOnlyFromDayKey(end).getTime() - dateOnlyFromDayKey(goal.plan.startedOn).getTime()) / 86400000) + 1;
    if (duration > 365 || duration < 1)
        throw readingConflict('The adjusted cycle must fit within 365 calendar days');
    const days = Math.round((dateOnlyFromDayKey(end).getTime() - dateOnlyFromDayKey(goal.date).getTime()) / 86400000) + 1;
    const target = Math.ceil((goal.plan.remaining + goal.completed) / days);
    const proposal = { editionId: goal.editionId, planId: goal.plan.id, date: goal.date, timezone: goal.timezone, mode: parsed.mode, oldTargetEndDate: goal.plan.targetEndDate, targetEndDate: end, oldDailyTarget: goal.target, dailyTarget: target, unit: goal.unit, remainingInPlan: goal.plan.remaining, completedToday: goal.completed, durationDays: duration };
    const snapshot = stableFingerprint({ userId, proposal, plan: goal.plan });
    const previewToken = createHmac('sha256', env.JWT_SECRET).update('noor-reading-adjustment:' + snapshot).digest('hex');
    return { ...proposal, previewToken };
}
export async function applyReadingAdjustment(userId: string, input: z.infer<typeof applyAdjustmentSchema>) {
    return readingMutation(userId, input.requestKey, { operation: 'ADJUST_PLAN', ...input }, async (tx) => {
        if (input.editionId === 'madani-hafs')
            await tx.$queryRaw `SELECT "id" FROM "khatmah" WHERE "userId"=${userId} FOR UPDATE`;
        const request = { editionId: input.editionId, mode: input.mode, ...(input.targetEndDate ? { targetEndDate: input.targetEndDate } : {}) };
        const preview = await previewReadingAdjustment(userId, request);
        if (preview.previewToken !== input.previewToken)
            throw readingConflict('Progress, date or plan changed. Preview again before confirming.');
        if (input.mode === 'EXTEND') {
            const end = dateOnlyFromDayKey(preview.targetEndDate);
            if (input.editionId === 'warsh-nafi')
                await tx.$executeRaw `UPDATE "warsh_cycles" SET "durationDays"=${preview.durationDays} WHERE "userId"=${userId} AND "id"=${preview.planId} AND "active"=true`;
            else if (preview.planId.startsWith('legacy:')) {
                // Legacy resolver treats the deadline as exclusive: store the following calendar day.
                const exclusive = localMidnight(dayString(new Date(end.getTime() + 86400000)), preview.timezone);
                await tx.$executeRaw `UPDATE "khatmah" SET "planMode"='DURATION_DAYS',"planJuzPerMonth"=NULL,"planTargetEndAt"=${exclusive},"planDurationDays"=${preview.durationDays},"dailyWardPages"=${preview.dailyTarget},"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId}`;
            }
            else
                await tx.$executeRaw `UPDATE "reading_plans" SET "targetEndOn"=${end}::date WHERE "userId"=${userId} AND "id"=${preview.planId} AND "active"=true`;
        }
        return { ...preview, applied: true, progressPreserved: true };
    });
}
/** Convert a calendar deadline into an instant, including DST and UTC date offsets. */
export function localMidnight(day: string, timezone: string) {
    const target = dateOnlyFromDayKey(day).getTime();
    let instant = target;
    const formatter = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' });
    for (let i = 0; i < 5; i++) {
        const p = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(x => [x.type, x.value]));
        const represented = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
        const delta = target - represented;
        if (!delta)
            break;
        instant += delta;
    }
    if (localDayKeyForTimezone(timezone, new Date(instant)) !== day) {
        // Some zones skip midnight when DST starts. Find the first instant of the requested local day.
        let low = target - 36 * 3600000, high = target + 36 * 3600000;
        while (high - low > 1) {
            const middle = Math.floor((low + high) / 2);
            if (localDayKeyForTimezone(timezone, new Date(middle)) < day)
                low = middle;
            else
                high = middle;
        }
        if (localDayKeyForTimezone(timezone, new Date(high)) !== day)
            throw readingConflict('The requested calendar day does not exist in this timezone');
        instant = high;
    }
    return new Date(instant);
}
export async function lookupReadingOperation(userId: string, requestKey: string, input: unknown) {
    const prior = await prisma.$queryRaw<Array<{
        fingerprint: string;
        result: any;
    }>> `SELECT * FROM "reading_operations" WHERE "userId"=${userId} AND "requestKey"=${requestKey}`;
    if (prior[0] && prior[0].fingerprint !== stableFingerprint(input))
        throw readingConflict('Request key was used for another operation');
    return prior[0]?.result;
}
