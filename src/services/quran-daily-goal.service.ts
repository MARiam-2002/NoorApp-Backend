import { prisma } from '../lib/prisma';
import { getUserLocalCalendarDay } from '../shared/utils/user-local-date';
import { resolveQuranDailyGoal } from '../shared/utils/quran-daily-goal';

/** Read-only: a missing plan is a default goal; database errors propagate. */
export async function getDailyQuranGoal(userId: string, pagesReadToday: number, now = new Date()) {
  const [row, localDay] = await Promise.all([
    prisma.khatmah.findUnique({ where: { userId } }),
    getUserLocalCalendarDay(userId, now),
  ]);
  return resolveQuranDailyGoal(row, pagesReadToday, now, localDay.timezone);
}
