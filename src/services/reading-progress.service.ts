import { z } from 'zod';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { editionIdSchema } from './mushaf.service';
import { readingGoalReader } from './reading-goal.service';
import { readingMutation, readingConflict } from './reading-plan.service';
import { warshVerse } from './warsh-content.service';
import { randomUUID } from 'node:crypto';
import { offlineCompletionSchema, type OfflineCompletion } from './continuity-core';
import { creditContinuityDay, prepareReadingContinuity } from './continuity.service';
export const readingConfirmationSchema = z.object({ editionId: editionIdSchema, contentVersion: z.string().min(1).max(200), expectedPlanId: z.string().max(200).nullable(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), unitKeys: z.array(z.string().min(1).max(20)).min(1).max(100).refine(v => new Set(v).size === v.length, 'Duplicate reading units'), requestKey: z.string().uuid(), continuity: offlineCompletionSchema.optional() }).strict();
type Context = {
    editionId: string;
    contentVersion: string;
    scope: string;
    day: Date;
    source: string;
    continuity?: OfflineCompletion;
    continuityBounds?: { originalDayOnly?: boolean; offeredAt?: Date };
};
/** Called only within the owner-locked reading mutation transaction. */
export async function creditReadingUnits(tx: any, userId: string, row: Context, units: string[]) {
    if (!units.length) return 0;
    const continuityDay = await prepareReadingContinuity(tx, userId, row.day.toISOString().slice(0, 10), row.continuity, new Date(), row.continuityBounds);
    const json = JSON.stringify(units);
    const added = await tx.$executeRaw `INSERT INTO "reading_units"("userId","editionId","contentVersion","scope","unitKey","completedOn") SELECT ${userId},${row.editionId},${row.contentVersion},${row.scope},value,${row.day}::date FROM jsonb_array_elements_text(${json}::jsonb) ON CONFLICT DO NOTHING`;
    if (row.editionId === 'warsh-nafi' && !row.scope.startsWith('free:')) {
        const credited = await tx.$executeRaw `INSERT INTO "warsh_completions"("cycleId","verseKey","completedOn") SELECT ${row.scope},value,${row.day}::date FROM jsonb_array_elements_text(${json}::jsonb) ON CONFLICT DO NOTHING`;
        if (credited > 0 && continuityDay) await creditContinuityDay(tx, userId, continuityDay, 'QURAN');
        return credited;
    }
    if (added > 0 && continuityDay) await creditContinuityDay(tx, userId, continuityDay, 'QURAN');
    if (row.editionId === 'madani-hafs' && row.source === 'LEGACY_HAFS' && added > 0) {
        await tx.$executeRaw `INSERT INTO "daily_progress"("id","userId","date","quranPagesRead","updatedAt") VALUES(${randomUUID()},${userId},${row.day}::date,${added},CURRENT_TIMESTAMP) ON CONFLICT ("userId","date") DO UPDATE SET "quranPagesRead"="daily_progress"."quranPagesRead"+EXCLUDED."quranPagesRead","updatedAt"=CURRENT_TIMESTAMP`;
        await tx.$executeRaw `UPDATE "khatmah" SET "totalPagesRead"="totalPagesRead"+${added},"updatedAt"=CURRENT_TIMESTAMP WHERE "userId"=${userId}`;
    }
    return added;
}
export async function confirmReadingUnits(userId: string, input: z.infer<typeof readingConfirmationSchema>) {
    return readingMutation(userId, input.requestKey, { operation: 'CONFIRM_READING', ...input }, async (tx) => {
        const goal = await readingGoalReader.get(userId, input.editionId);
        if (!goal.available)
            throw new AppError('Selected edition is unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
        if (goal.contentVersion !== input.contentVersion || (goal.plan?.id ?? null) !== input.expectedPlanId || goal.date !== input.date)
            throw readingConflict('Plan, source version or local day changed; refresh before confirming');
        for (const key of input.unitKeys) {
            if (goal.unit === 'VERSE')
                warshVerse(key);
            else if (!/^[1-9]\d{0,2}$/.test(key) || Number(key) > 604)
                throw new AppError('Invalid edition page', 400, ErrorCodes.VALIDATION_ERROR);
        }
        const addedUnits = await creditReadingUnits(tx, userId, { editionId: goal.editionId, contentVersion: goal.contentVersion, scope: goal.plan?.id ?? `free:${goal.date}`, day: new Date(goal.date + 'T00:00:00.000Z'), source: goal.source, continuity: input.continuity, continuityBounds: { originalDayOnly: true } }, input.unitKeys);
        return { editionId: goal.editionId, contentVersion: goal.contentVersion, planId: goal.plan?.id ?? null, date: goal.date, unit: goal.unit, confirmedUnits: input.unitKeys, addedUnits };
    });
}
