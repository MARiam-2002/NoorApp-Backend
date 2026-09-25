import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes, HttpStatus } from '../config';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import {
  parseHhmm,
  normalizeHhmm,
  resolveTimezone,
} from './salawat-reminder.service';
import { evaluateMulkEligibility } from './mulk-reminder.service';
import { getUserLocalCalendarDay } from '../shared/utils/user-local-date';

export const TOTAL_QURAN_PAGES = 604;
export const TOTAL_JUZ = 30;
export const KHATMAH_REMINDER_DEFAULT_TIME = '21:00';
export const KHATMAH_REMINDER_WINDOW_MINUTES = 12;

export const PLAN_MODE_DURATION = 'DURATION_DAYS';
export const PLAN_MODE_JUZ_MONTH = 'JUZ_PER_MONTH';

const TITLE_AR = 'ختمة القرآن';
const TITLE_EN = 'Quran Khatmah';
const BODY_AR = 'لم تقرأ ورد اليوم من ختمتك';
const BODY_EN = "You haven't read today's khatmah portion yet";

export type StartKhatmahPlanInput =
  | { durationDays: number; juzPerMonth?: never }
  | { juzPerMonth: number; durationDays?: never };

function pagesFromJuz(juz: number): number {
  return Math.max(1, Math.ceil((juz / TOTAL_JUZ) * TOTAL_QURAN_PAGES));
}

/** Initial daily ward from a fixed duration (one full mushaf = 604 pages). */
export function computeDailyWardFromDuration(durationDays: number): number {
  const days = Math.max(1, Math.min(365, Math.floor(durationDays)));
  return Math.max(1, Math.ceil(TOTAL_QURAN_PAGES / days));
}

/** Daily ward from juz-per-month pace. */
export function computeDailyWardFromJuzPerMonth(juzPerMonth: number): number {
  const juz = Math.max(1, Math.min(TOTAL_JUZ, Math.floor(juzPerMonth)));
  const pagesPerMonth = pagesFromJuz(juz);
  return Math.max(1, Math.ceil(pagesPerMonth / 30));
}

export function computeDurationFromJuzPerMonth(juzPerMonth: number): number {
  const daily = computeDailyWardFromJuzPerMonth(juzPerMonth);
  return Math.max(1, Math.ceil(TOTAL_QURAN_PAGES / daily));
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

async function ensureKhatmahRow(userId: string) {
  return prisma.khatmah.upsert({
    where: { userId },
    create: { userId, currentSurahId: 2, currentPage: 1, totalPagesRead: 0 },
    update: {},
  });
}

async function getPagesReadToday(userId: string): Promise<number> {
  const { date } = await getUserLocalCalendarDay(userId);
  const row = await prisma.dailyProgress.findUnique({
    where: { userId_date: { userId, date } },
    select: { quranPagesRead: true },
  });
  return row?.quranPagesRead ?? 0;
}

function buildPlanDto(input: {
  row: {
    planMode: string | null;
    planDurationDays: number | null;
    planJuzPerMonth: number | null;
    planStartedAt: Date | null;
    planTargetEndAt: Date | null;
    planPagesAtStart: number | null;
    dailyWardPages: number | null;
    totalPagesRead: number;
  };
  pagesReadToday: number;
  now?: Date;
}) {
  const { row, pagesReadToday } = input;
  const now = input.now ?? new Date();

  if (!row.planMode || row.planStartedAt == null || row.planPagesAtStart == null) {
    return {
      active: false as const,
      mode: null,
      durationDays: null,
      juzPerMonth: null,
      startedAt: null,
      targetEndAt: null,
      pagesGoal: TOTAL_QURAN_PAGES,
      pagesReadInPlan: 0,
      pagesRemaining: TOTAL_QURAN_PAGES,
      daysRemaining: null,
      dailyWardPages: null,
      todayWard: null,
      labelAr: 'لا توجد خطة ختمة نشطة',
      labelEn: 'No active khatmah plan',
      ctaAr: 'ختمة جديدة',
      ctaEn: 'New khatmah',
    };
  }

  const pagesReadInPlan = Math.max(0, row.totalPagesRead - row.planPagesAtStart);
  const pagesRemaining = Math.max(0, TOTAL_QURAN_PAGES - pagesReadInPlan);
  const targetEnd = row.planTargetEndAt ?? addDays(row.planStartedAt, row.planDurationDays ?? 30);
  const daysRemaining = Math.max(1, daysBetweenUtc(now, targetEnd) || 1);

  // Soft catch-up: redistribute remaining pages over remaining days.
  const softDaily = Math.max(1, Math.ceil(pagesRemaining / daysRemaining));
  const dailyWardPages = pagesRemaining === 0 ? 0 : softDaily;

  const todayTarget = dailyWardPages;
  const completed = pagesReadToday >= todayTarget && todayTarget > 0;
  const remainingToday = Math.max(0, todayTarget - pagesReadToday);

  return {
    active: true as const,
    mode: row.planMode,
    durationDays: row.planDurationDays,
    juzPerMonth: row.planJuzPerMonth,
    startedAt: row.planStartedAt.toISOString(),
    targetEndAt: targetEnd.toISOString(),
    pagesGoal: TOTAL_QURAN_PAGES,
    pagesReadInPlan: Math.min(pagesReadInPlan, TOTAL_QURAN_PAGES),
    pagesRemaining,
    daysRemaining,
    dailyWardPages,
    progress:
      TOTAL_QURAN_PAGES > 0
        ? Math.round((Math.min(pagesReadInPlan, TOTAL_QURAN_PAGES) / TOTAL_QURAN_PAGES) * 100) / 100
        : 0,
    todayWard: {
      pagesTarget: todayTarget,
      pagesReadToday,
      completed: pagesRemaining === 0 ? true : completed,
      remainingToday: pagesRemaining === 0 ? 0 : remainingToday,
      missed: pagesRemaining > 0 && pagesReadToday < todayTarget,
      labelAr: 'ورد اليوم',
      labelEn: "Today's portion",
      captionAr:
        pagesRemaining === 0
          ? 'أحسنت! أكملت ختمتك'
          : `${pagesReadToday} من ${todayTarget} صفحة اليوم`,
      captionEn:
        pagesRemaining === 0
          ? 'Well done! Khatmah complete'
          : `${pagesReadToday} of ${todayTarget} pages today`,
    },
    labelAr: 'خطة الختمة',
    labelEn: 'Khatmah plan',
    ctaAr: 'متابعة القراءة',
    ctaEn: 'Continue reading',
    presets: {
      durationDays: [15, 30, 60, 90],
      juzPerMonth: [10, 15, 30],
    },
  };
}

export async function getKhatmahPlan(userId: string) {
  const row = await ensureKhatmahRow(userId);
  const pagesReadToday = await getPagesReadToday(userId);
  return buildPlanDto({ row, pagesReadToday });
}

export async function startKhatmahPlan(userId: string, input: StartKhatmahPlanInput) {
  const hasDays = typeof (input as any).durationDays === 'number';
  const hasJuz = typeof (input as any).juzPerMonth === 'number';
  if (hasDays === hasJuz) {
    throw new AppError(
      'Provide exactly one of durationDays or juzPerMonth',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  let mode: string;
  let durationDays: number;
  let juzPerMonth: number | null = null;
  let dailyWardPages: number;

  if (hasDays) {
    const d = Number((input as any).durationDays);
    if (!Number.isInteger(d) || d < 7 || d > 365) {
      throw new AppError(
        'durationDays must be an integer 7..365',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    mode = PLAN_MODE_DURATION;
    durationDays = d;
    dailyWardPages = computeDailyWardFromDuration(d);
  } else {
    const j = Number((input as any).juzPerMonth);
    if (!Number.isInteger(j) || j < 1 || j > TOTAL_JUZ) {
      throw new AppError(
        'juzPerMonth must be an integer 1..30',
        HttpStatus.BAD_REQUEST,
        ErrorCodes.VALIDATION_ERROR,
      );
    }
    mode = PLAN_MODE_JUZ_MONTH;
    juzPerMonth = j;
    dailyWardPages = computeDailyWardFromJuzPerMonth(j);
    durationDays = computeDurationFromJuzPerMonth(j);
  }

  const existing = await ensureKhatmahRow(userId);
  const now = new Date();
  const planPagesAtStart = existing.totalPagesRead;
  const planTargetEndAt = addDays(now, durationDays);

  await prisma.khatmah.update({
    where: { userId },
    data: {
      planMode: mode,
      planDurationDays: durationDays,
      planJuzPerMonth: juzPerMonth,
      planStartedAt: now,
      planTargetEndAt,
      planPagesAtStart,
      dailyWardPages,
    },
  });

  return getKhatmahPlan(userId);
}

export async function clearKhatmahPlan(userId: string) {
  await ensureKhatmahRow(userId);
  await prisma.khatmah.update({
    where: { userId },
    data: {
      planMode: null,
      planDurationDays: null,
      planJuzPerMonth: null,
      planStartedAt: null,
      planTargetEndAt: null,
      planPagesAtStart: null,
      dailyWardPages: null,
    },
  });
  return getKhatmahPlan(userId);
}

export type KhatmahReminderPrefsDto = {
  enabled: boolean;
  time: string;
  eventType: 'KHATMAH';
  titleAr: string;
  bodyAr: string;
  titleEn: string;
  bodyEn: string;
  androidChannelId: string;
  usesCustomVoice: false;
  deepLink: string;
};

export async function getKhatmahReminderPreferences(userId: string): Promise<KhatmahReminderPrefsDto> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { khatmahReminderEnabled: true, khatmahReminderTime: true },
  });
  if (!user) {
    throw new AppError('User not found', HttpStatus.NOT_FOUND, ErrorCodes.NOT_FOUND);
  }
  return {
    enabled: Boolean(user.khatmahReminderEnabled),
    time: normalizeHhmm(user.khatmahReminderTime, KHATMAH_REMINDER_DEFAULT_TIME),
    eventType: 'KHATMAH',
    titleAr: TITLE_AR,
    bodyAr: BODY_AR,
    titleEn: TITLE_EN,
    bodyEn: BODY_EN,
    androidChannelId: 'khatmah',
    usesCustomVoice: false,
    deepLink: '/quran/khatmah',
  };
}

export async function updateKhatmahReminderPreferences(
  userId: string,
  patch: { enabled?: boolean; time?: string },
): Promise<KhatmahReminderPrefsDto> {
  const data: { khatmahReminderEnabled?: boolean; khatmahReminderTime?: string } = {};
  if (typeof patch.enabled === 'boolean') data.khatmahReminderEnabled = patch.enabled;
  if (patch.time != null) {
    if (!parseHhmm(patch.time)) {
      throw new AppError('time must be HH:mm', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
    }
    data.khatmahReminderTime = patch.time;
  }
  if (Object.keys(data).length === 0) {
    throw new AppError('No preference fields to update', HttpStatus.BAD_REQUEST, ErrorCodes.VALIDATION_ERROR);
  }
  await prisma.user.update({ where: { id: userId }, data });
  return getKhatmahReminderPreferences(userId);
}

async function claimOccurrence(userId: string, key: string): Promise<boolean> {
  try {
    await prisma.khatmahSendLog.create({ data: { userId, occurrenceKey: key } });
    return true;
  } catch (err: any) {
    if (err?.code === 'P2002') return false;
    throw err;
  }
}

/**
 * FCM backup: users with reminder ON + active plan + today's ward incomplete,
 * within ±window of local reminder time.
 */
export async function runKhatmahReminders(
  now = new Date(),
  windowMinutes = KHATMAH_REMINDER_WINDOW_MINUTES,
): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  skipped: Record<string, number>;
}> {
  let usersScanned = 0;
  let pushesAttempted = 0;
  let pushesSent = 0;
  const skipped: Record<string, number> = {};

  let cursor: string | undefined;
  for (;;) {
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        khatmahReminderEnabled: true,
        deviceTokens: { some: {} },
        khatmah: { planMode: { not: null } },
      },
      select: {
        id: true,
        timezone: true,
        khatmahReminderEnabled: true,
        khatmahReminderTime: true,
        khatmah: true,
      },
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]?.id;
    usersScanned += users.length;

    for (const user of users) {
      try {
        const timeZone = resolveTimezone(user.timezone);
        const reminderTime = normalizeHhmm(user.khatmahReminderTime, KHATMAH_REMINDER_DEFAULT_TIME);
        const windowHit = evaluateMulkEligibility({
          enabled: user.khatmahReminderEnabled,
          now,
          timeZone,
          reminderTime,
          windowMinutes,
        });
        if (!windowHit.eligible || !windowHit.dayKey) {
          skipped[windowHit.reason ?? 'SKIP'] = (skipped[windowHit.reason ?? 'SKIP'] ?? 0) + 1;
          continue;
        }

        const pagesReadToday = await getPagesReadToday(user.id);
        const plan = buildPlanDto({
          row: user.khatmah as any,
          pagesReadToday,
          now,
        });
        if (!plan.active || !plan.todayWard) {
          skipped.NO_PLAN = (skipped.NO_PLAN ?? 0) + 1;
          continue;
        }
        if (plan.pagesRemaining === 0) {
          skipped.COMPLETE = (skipped.COMPLETE ?? 0) + 1;
          continue;
        }
        if (!plan.todayWard.missed) {
          skipped.WARD_DONE = (skipped.WARD_DONE ?? 0) + 1;
          continue;
        }

        const occurrenceKey = `${windowHit.dayKey}|KHATMAH|${reminderTime}`;
        const claimed = await claimOccurrence(user.id, occurrenceKey);
        if (!claimed) {
          skipped.DUPLICATE = (skipped.DUPLICATE ?? 0) + 1;
          continue;
        }

        const dayKey = windowHit.dayKey;
        const dedupeKey = `${dayKey}|${user.id}|KHATMAH|KHATMAH|${occurrenceKey}`;
        const fcmData: Record<string, string> = {
          type: 'KHATMAH',
          kind: 'khatmah_ward_reminder',
          eventType: 'KHATMAH',
          eventKey: 'KHATMAH',
          soundType: 'KHATMAH',
          androidChannelId: 'khatmah',
          source: 'FCM_BACKUP',
          locale: 'ar',
          timezone: timeZone,
          dayKey,
          reminderTime,
          occurrenceKey,
          dedupeKey,
          deepLink: '/quran/khatmah',
          pagesTarget: String(plan.todayWard.pagesTarget),
          pagesReadToday: String(plan.todayWard.pagesReadToday),
          titleAr: TITLE_AR,
          bodyAr: BODY_AR,
          titleEn: TITLE_EN,
          bodyEn: BODY_EN,
        };

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: TITLE_AR,
          body: BODY_AR,
          titleAr: TITLE_AR,
          bodyAr: BODY_AR,
          data: fcmData,
          androidChannelId: 'khatmah',
        });
        pushesSent += result.sent;

        await createNotification({
          userId: user.id,
          titleAr: TITLE_AR,
          titleEn: TITLE_EN,
          bodyAr: BODY_AR,
          bodyEn: BODY_EN,
          type: 'KHATMAH' as any,
          deepLink: '/quran/khatmah',
          payload: {
            type: 'KHATMAH',
            eventType: 'KHATMAH',
            dayKey,
            dedupeKey,
            pagesTarget: plan.todayWard.pagesTarget,
            pagesReadToday: plan.todayWard.pagesReadToday,
          },
        }).catch(() => null);
      } catch (err) {
        logger.warn('[Cron] Khatmah reminder failed for user', {
          userId: user.id,
          message: (err as Error)?.message,
        });
        skipped.ERROR = (skipped.ERROR ?? 0) + 1;
      }
    }

    if (users.length < 200) break;
  }

  return { usersScanned, pushesAttempted, pushesSent, skipped };
}
