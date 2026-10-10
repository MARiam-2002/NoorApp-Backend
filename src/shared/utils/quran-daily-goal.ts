export const DEFAULT_DAILY_QURAN_PAGES = 5;
export const QURAN_PLAN_PAGES = 604;

export type QuranPlanRow = {
  planMode: string | null;
  planStartedAt: Date | null;
  planPagesAtStart: number | null;
  planTargetEndAt: Date | null;
  planDurationDays: number | null;
  totalPagesRead: number;
};

function calendarDay(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone, year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const value = (type: string) => Number(parts.find(p => p.type === type)?.value);
  return Date.UTC(value('year'), value('month') - 1, value('day'));
}

/** One goal calculation for dashboard, journey, khatmah and reminders. */
export function resolveQuranDailyGoal(
  row: QuranPlanRow | null,
  pagesReadToday: number,
  now = new Date(),
  timezone = 'Africa/Cairo',
) {
  const pages = Math.max(0, Math.floor(pagesReadToday));
  const active = Boolean(row?.planMode && row.planStartedAt && row.planPagesAtStart != null);
  let target = DEFAULT_DAILY_QURAN_PAGES;
  let daysRemaining: number | null = null;
  let pagesRemaining: number | null = null;
  let targetEndAt: Date | null = null;
  if (active && row && row.planStartedAt && row.planPagesAtStart != null) {
    const read = Math.max(0, row.totalPagesRead - row.planPagesAtStart);
    pagesRemaining = Math.max(0, QURAN_PLAN_PAGES - read);
    targetEndAt = row.planTargetEndAt ?? new Date(row.planStartedAt.getTime() + (row.planDurationDays ?? 30) * 86_400_000);
    daysRemaining = Math.max(1, Math.round((calendarDay(targetEndAt, timezone) - calendarDay(now, timezone)) / 86_400_000));
    // Reconstruct the start-of-day remainder. Reading today must not lower
    // today's target and make the goal complete before the planned portion.
    target = pagesRemaining === 0 ? 0 : Math.ceil(Math.min(QURAN_PLAN_PAGES, pagesRemaining + pages) / daysRemaining);
  }
  const completed = target === 0 || pages >= target;
  return {
    pagesTarget: target, pagesReadToday: pages, completed,
    remainingToday: Math.max(0, target - pages),
    percent: target === 0 ? 100 : Math.min(100, Math.round(pages / target * 100)),
    source: active ? 'khatmah_plan' as const : 'default' as const,
    active, daysRemaining, pagesRemaining, targetEndAt,
  };
}
