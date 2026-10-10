import { prisma } from '../lib/prisma';
import { getMushafPreference, getMushafEditions, getMushafReaderState, type EditionId } from './mushaf.service';
import { getWarshCycle, getWarshPosition } from './warsh-reader.service';
import { getDailyQuranGoal } from './quran-daily-goal.service';
import { getUserLocalCalendarDay, localDayKeyForTimezone } from '../shared/utils/user-local-date';
export type ReadingPlan = {
    id: string;
    userId: string;
    editionId: EditionId;
    contentVersion: string;
    startedOn: Date;
    targetEndOn: Date;
    active: boolean;
};
export const dayString = (date: Date) => date.toISOString().slice(0, 10);
export function portionGoal(remaining: number, today: number, days: number) {
    const target = remaining === 0 ? today : Math.ceil((remaining + today) / Math.max(1, days));
    return { target, completed: today, remaining: Math.max(0, target - today), percent: target === 0 ? 100 : Math.min(100, Math.round(today / target * 100)), done: target === 0 || today >= target };
}
export async function getReadingGoal(userId: string, requestedEdition?: EditionId) {
    const local = await getUserLocalCalendarDay(userId);
    const selected = requestedEdition ?? (await getMushafPreference(userId)).editionId;
    const definition = getMushafEditions().find(e => e.id === selected)!;
    const common = { editionId: selected, contentVersion: definition.contentVersion, unit: selected === 'warsh-nafi' ? 'VERSE' : 'PAGE', date: local.dayKey, timezone: local.timezone, available: definition.available, availabilityReason: definition.availabilityReason };
    if (!definition.available)
        return { ...common, target: 0, completed: 0, remaining: 0, percent: 0, done: false, source: 'UNAVAILABLE', plan: null, resume: null };
    if (selected === 'warsh-nafi') {
        const [cycle, state] = await Promise.all([getWarshCycle(userId), getWarshPosition(userId)]);
        if (cycle.cycle) {
            const c = cycle.cycle;
            return { ...common, target: c.dailyGoal.targetVerses, completed: c.dailyGoal.completedVerses, remaining: c.dailyGoal.remainingVerses, percent: c.dailyGoal.targetVerses === 0 ? 100 : Math.min(100, Math.round(c.dailyGoal.completedVerses / c.dailyGoal.targetVerses * 100)), done: c.dailyGoal.completed, source: 'WARSH_CYCLE', plan: { id: c.cycleId, status: c.status, total: 6214, completed: c.completedVerses, remaining: c.remainingVerses, startedOn: c.startedOn, targetEndDate: c.targetEndDate }, resume: state };
        }
        const count = await prisma.$queryRaw<Array<{
            n: number;
        }>> `SELECT COUNT(*)::int AS n FROM "reading_units" WHERE "userId"=${userId} AND "editionId"=${selected} AND "contentVersion"=${definition.contentVersion} AND "completedOn"=${local.date}::date`;
        const completed = count[0]!.n;
        return { ...common, target: 15, completed, remaining: Math.max(0, 15 - completed), percent: Math.min(100, Math.round(completed / 15 * 100)), done: completed >= 15, source: 'DEFAULT', plan: null, resume: state };
    }
    const [plans, resume] = await Promise.all([prisma.$queryRaw<ReadingPlan[]> `SELECT * FROM "reading_plans" WHERE "userId"=${userId} AND "editionId"=${selected} AND "active"=true`, getMushafReaderState(userId, selected)]);
    const plan = plans[0];
    if (plan) {
        const counts = await prisma.$queryRaw<Array<{
            total: number;
            today: number;
        }>> `SELECT COUNT(*)::int AS total,COUNT(*) FILTER (WHERE "completedOn"=${local.date}::date)::int AS today FROM "reading_units" WHERE "userId"=${userId} AND "editionId"=${selected} AND "contentVersion"=${plan.contentVersion} AND "scope"=${plan.id}`;
        const completed = Math.min(604, counts[0]!.total);
        const remaining = 604 - completed;
        const days = Math.round((plan.targetEndOn.getTime() - local.date.getTime()) / 86400000) + 1;
        return { ...common, ...portionGoal(remaining, counts[0]!.today, days), source: 'EDITION_PLAN', ...(plan.contentVersion !== definition.contentVersion ? { available: false, availabilityReason: 'CONTENT_VERSION_CHANGED', done: false } : {}), plan: { id: plan.id, status: remaining === 0 ? 'COMPLETED' : days <= 0 ? 'OVERDUE' : 'ACTIVE', total: 604, completed, remaining, startedOn: dayString(plan.startedOn), targetEndDate: dayString(plan.targetEndOn) }, resume };
    }
    if (selected === 'madani-hafs') {
        const [row, today] = await Promise.all([prisma.khatmah.findUnique({ where: { userId } }), prisma.dailyProgress.findUnique({ where: { userId_date: { userId, date: local.date } }, select: { quranPagesRead: true } })]);
        const goal = await getDailyQuranGoal(userId, today?.quranPagesRead ?? 0);
        const plan = goal.active && row?.planStartedAt ? { id: `legacy:${row.id}:${row.planStartedAt.toISOString()}`, status: goal.pagesRemaining === 0 ? 'COMPLETED' : goal.targetEndAt! <= new Date() ? 'OVERDUE' : 'ACTIVE', total: 604, completed: 604 - (goal.pagesRemaining ?? 604), remaining: goal.pagesRemaining ?? 604, startedOn: localDayKeyForTimezone(local.timezone, row.planStartedAt), targetEndDate: localDayKeyForTimezone(local.timezone, new Date(goal.targetEndAt!.getTime() - 86400000)) } : null;
        return { ...common, target: goal.pagesTarget, completed: goal.pagesReadToday, remaining: goal.remainingToday, percent: goal.percent, done: goal.completed, source: 'LEGACY_HAFS', plan, resume };
    }
    const count = await prisma.$queryRaw<Array<{
        n: number;
    }>> `SELECT COUNT(*)::int AS n FROM "reading_units" WHERE "userId"=${userId} AND "editionId"=${selected} AND "contentVersion"=${definition.contentVersion} AND "completedOn"=${local.date}::date`;
    const completed = count[0]!.n;
    return { ...common, target: 5, completed, remaining: Math.max(0, 5 - completed), percent: Math.min(100, Math.round(completed / 5 * 100)), done: completed >= 5, source: 'DEFAULT', plan: null, resume };
}
export const readingGoalReader = { get: getReadingGoal };
