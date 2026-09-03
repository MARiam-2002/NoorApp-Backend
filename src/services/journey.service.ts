import type { ChallengeType } from '@prisma/client';

import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getDayOfYear, getTodayDateOnly } from '../utils/date';
import { isDailyChallengeCompleted } from '../utils/challenge';
import {
  FALLBACK_CHALLENGE,
} from '../shared/constants/fallbacks';
import {
  getDailyChallengeTemplate,
} from './daily-content.service';

const VALID_PRAYER_KEYS = ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA'] as const;
type ValidPrayerKey = typeof VALID_PRAYER_KEYS[number];

const PRAYER_META: Record<ValidPrayerKey, {
  order: number;
  nameAr: string;
  nameEn: string;
  timeHintAr: string;
  timeHintEn: string;
}> = {
  FAJR: {
    order: 1,
    nameAr: 'الفجر',
    nameEn: 'Fajr',
    timeHintAr: 'قبل شروق الشمس',
    timeHintEn: 'Before sunrise',
  },
  DHUHR: {
    order: 2,
    nameAr: 'الظهر',
    nameEn: 'Dhuhr',
    timeHintAr: 'بعد زوال الشمس',
    timeHintEn: 'After midday',
  },
  ASR: {
    order: 3,
    nameAr: 'العصر',
    nameEn: 'Asr',
    timeHintAr: 'بعد الظهر',
    timeHintEn: 'Afternoon',
  },
  MAGHRIB: {
    order: 4,
    nameAr: 'المغرب',
    nameEn: 'Maghrib',
    timeHintAr: 'عند غروب الشمس',
    timeHintEn: 'At sunset',
  },
  ISHA: {
    order: 5,
    nameAr: 'العشاء',
    nameEn: 'Isha',
    timeHintAr: 'بعد مغيب الشفق',
    timeHintEn: 'After twilight',
  },
};

async function getOrCreateToday(userId: string, date = getTodayDateOnly()) {
  return prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

export async function getTodayJourney(userId: string) {
  const date = getTodayDateOnly();
  const progress = await getOrCreateToday(userId);

  let prayersCompletedRows: Array<{ prayer: any }> = [];
  let prayersCompleted = 0;
  try {
    prayersCompletedRows = await prisma.prayerCompletion.findMany({
      where: { userId, date },
      select: { prayer: true, completedAt: true },
    });
    prayersCompleted = prayersCompletedRows.length;
  } catch {
    // table may not exist yet
  }

  const completedPrayerKeys = new Set(
    prayersCompletedRows.map((r) => String(r.prayer).toUpperCase()),
  );

  const detailedPrayers = VALID_PRAYER_KEYS.map((key) => {
    const meta = PRAYER_META[key];
    const completed = completedPrayerKeys.has(key);
    const row = prayersCompletedRows.find((r) => String(r.prayer).toUpperCase() === key);
    return {
      key,
      order: meta.order,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      timeHintAr: meta.timeHintAr,
      timeHintEn: meta.timeHintEn,
      completed,
      completedAt: completed && 'completedAt' in (row ?? {}) ? (row as any).completedAt : null,
    };
  });

  const totalPrayers = 5;
  const quranGoal = 4;
  const sadaqahGoal = 50;

  const quranProgress = quranGoal > 0 ? Math.min(1, progress.quranPagesRead / quranGoal) : 0;
  const prayerProgress = prayersCompleted / totalPrayers;
  const morningCompleted = progress.morningAdhkarCompleted;
  const eveningCompleted = progress.eveningAdhkarCompleted;
  const overallAdhkar = morningCompleted && eveningCompleted;
  const adhkarPercent = Math.round(((morningCompleted ? 1 : 0) + (eveningCompleted ? 1 : 0)) / 2 * 100);
  const sadaqahAmount = Number(progress.sadaqahAmount);
  const sadaqahProgress = sadaqahGoal > 0 ? Math.min(1, sadaqahAmount / sadaqahGoal) : 0;

  const quranPercent = Math.round(quranProgress * 100);
  const prayerPercent = Math.round(prayerProgress * 100);
  const sadaqahPercent = Math.round(sadaqahProgress * 100);

  const tasks = [
    {
      key: 'quran',
      titleAr: 'قراءة القرآن',
      titleEn: 'Quran Reading',
      captionAr: 'صفحات اليوم: ' + progress.quranPagesRead + ' / ' + quranGoal,
      captionEn: 'Today pages: ' + progress.quranPagesRead + ' / ' + quranGoal,
      labelAr: 'القرآن',
      labelEn: 'Quran',
      done: quranProgress >= 1,
      progress: Math.round(quranProgress * 100) / 100,
    },
    {
      key: 'prayer',
      titleAr: 'الصلوات',
      titleEn: 'Prayers',
      captionAr: 'أتممت ' + prayersCompleted + ' من أصل ' + totalPrayers + ' صلوات',
      captionEn: 'Completed ' + prayersCompleted + ' of ' + totalPrayers + ' prayers',
      labelAr: 'الصلوات',
      labelEn: 'Prayers',
      done: prayersCompleted >= totalPrayers,
      progress: Math.round(prayerProgress * 100) / 100,
      completed: prayersCompleted,
      total: totalPrayers,
    },
    {
      key: 'adhkar',
      titleAr: 'الأذكار',
      titleEn: 'Adhkar',
      captionAr: morningCompleted && eveningCompleted
        ? 'تم أذكار الصباح والمساء ✓'
        : morningCompleted
          ? 'تم أذكار الصباح — باقي أذكار المساء'
          : eveningCompleted
            ? 'تم أذكار المساء — باقي أذكار الصباح'
            : 'باقي أذكار الصباح والمساء',
      captionEn: morningCompleted && eveningCompleted
        ? 'Morning & Evening adhkar complete ✓'
        : morningCompleted
          ? 'Morning done — Evening remaining'
          : eveningCompleted
            ? 'Evening done — Morning remaining'
            : 'Morning & Evening remaining',
      labelAr: 'الأذكار',
      labelEn: 'Adhkar',
      done: overallAdhkar,
    },
    {
      key: 'sadaqah',
      titleAr: 'الصدقة',
      titleEn: 'Sadaqah',
      captionAr: sadaqahAmount > 0
        ? 'صدقة اليوم: ' + sadaqahAmount + ' جنيه'
        : 'صدقة اليوم: 0 جنيه — هدف ' + sadaqahGoal,
      captionEn: sadaqahAmount > 0
        ? 'Today sadaqah: ' + sadaqahAmount + ' EGP'
        : 'Today sadaqah: 0 EGP — target ' + sadaqahGoal,
      labelAr: 'الصدقة',
      labelEn: 'Sadaqah',
      done: sadaqahAmount > 0,
      amount: sadaqahAmount,
    },
  ];

  const overallPercent = Math.round(
    ((quranProgress + prayerProgress + ((morningCompleted ? 1 : 0) + (eveningCompleted ? 1 : 0)) / 2 + sadaqahProgress) / 4) * 100,
  );

  let points = 0;
  let streakDays = 0;
  let dailyChallenge: any = null;
  try {
    const dayOfYear = getDayOfYear();
    const [user, last30Progress, challengeTemplate, challengeCompletion] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { points: true, level: true } }),
      prisma.dailyProgress.findMany({
        where: { userId },
        select: { date: true, quranPagesRead: true, morningAdhkarCompleted: true, eveningAdhkarCompleted: true, sadaqahAmount: true },
      }),
      getDailyChallengeTemplate(dayOfYear).catch(() => null),
      prisma.challengeCompletion.findUnique({
        where: { userId_dayOfYear: { userId, dayOfYear } },
      }).catch(() => null),
    ]);
    points = user?.points ?? 0;
    const level = user?.level ?? 1;

    const datesSet = new Set(
      last30Progress
        .filter((p) => p.quranPagesRead > 0 || p.morningAdhkarCompleted || p.eveningAdhkarCompleted || Number(p.sadaqahAmount) > 0)
        .map((p) => p.date.toISOString().slice(0, 10)),
    );
    const cursor = new Date(date);
    while (datesSet.has(cursor.toISOString().slice(0, 10))) {
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }

    const challengeTemplateSafe = challengeTemplate ?? FALLBACK_CHALLENGE;
    const challengeCompleted = isDailyChallengeCompleted(
      (challengeTemplateSafe.type ?? FALLBACK_CHALLENGE.type) as ChallengeType,
      challengeTemplateSafe.targetValue ?? FALLBACK_CHALLENGE.targetValue,
      {
        quranPagesRead: progress.quranPagesRead,
        adhkarCompleted: morningCompleted && eveningCompleted,
        sadaqahAmount: Number(progress.sadaqahAmount),
      },
      completedPrayerKeys as unknown as any[],
    );
    dailyChallenge = {
      titleAr: challengeTemplateSafe.titleAr ?? FALLBACK_CHALLENGE.titleAr,
      titleEn: challengeTemplateSafe.titleEn ?? FALLBACK_CHALLENGE.titleEn,
      descriptionAr: challengeTemplateSafe.descriptionAr ?? FALLBACK_CHALLENGE.descriptionAr,
      descriptionEn: challengeTemplateSafe.descriptionEn ?? FALLBACK_CHALLENGE.descriptionEn,
      rewardPoints: challengeTemplateSafe.rewardPoints ?? FALLBACK_CHALLENGE.rewardPoints,
      targetValue: challengeTemplateSafe.targetValue ?? FALLBACK_CHALLENGE.targetValue,
      completed: challengeCompleted,
      claimed: Boolean(challengeCompletion?.claimedAt),
    };

    void level;
  } catch { /* */ }

  return {
    date: date.toISOString().slice(0, 10),
    tasks,
    streakDays,
    badges: [],
    points,
    overallPercent,
    dailyChallenge,
    quran: {
      pages: progress.quranPagesRead,
      goal: quranGoal,
      percent: quranPercent,
    },
    adhkar: {
      morningCompleted,
      eveningCompleted,
      overallCompleted: overallAdhkar,
      percent: adhkarPercent,
    },
    sadaqah: {
      amount: sadaqahAmount,
      goal: sadaqahGoal,
      percent: sadaqahPercent,
      currency: 'EGP',
    },
    prayers: {
      completed: prayersCompleted,
      total: totalPrayers,
      percent: prayerPercent,
      detailedPrayers,
    },
    quranPagesRead: progress.quranPagesRead,
    adhkarCompleted: overallAdhkar,
    sadaqahAmount,
    prayersCompleted,
    prayersTotal: totalPrayers,
  };
}

export async function togglePrayer(
  userId: string,
  prayerKeyRaw: string,
  completed: boolean = true,
) {
  const prayerKey = prayerKeyRaw.trim().toUpperCase() as ValidPrayerKey;
  if (!VALID_PRAYER_KEYS.includes(prayerKey)) {
    throw new AppError(
      `Invalid prayer key: ${prayerKeyRaw}. Must be one of: ${VALID_PRAYER_KEYS.join(', ')}`,
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDateOnly();
  const meta = PRAYER_META[prayerKey];

  if (completed) {
    await prisma.prayerCompletion.upsert({
      where: {
        userId_date_prayer: {
          userId,
          date,
          prayer: prayerKey,
        },
      },
      create: {
        userId,
        date,
        prayer: prayerKey,
      },
      update: {},
    });
  } else {
    try {
      await prisma.prayerCompletion.deleteMany({
        where: { userId, date, prayer: prayerKey },
      });
    } catch {
      // no-op if record doesn't exist
    }
  }

  let completedCount = 0;
  let detailed: Array<{
    key: ValidPrayerKey;
    order: number;
    nameAr: string;
    nameEn: string;
    timeHintAr: string;
    timeHintEn: string;
    completed: boolean;
    completedAt: Date | null;
  }> = [];
  try {
    const rows = await prisma.prayerCompletion.findMany({
      where: { userId, date },
      select: { prayer: true, completedAt: true },
    });
    completedCount = rows.length;
    const completedSet = new Set(rows.map((r) => String(r.prayer).toUpperCase()));
    detailed = VALID_PRAYER_KEYS.map((k) => {
      const m = PRAYER_META[k];
      const row = rows.find((r) => String(r.prayer).toUpperCase() === k);
      return {
        key: k,
        order: m.order,
        nameAr: m.nameAr,
        nameEn: m.nameEn,
        timeHintAr: m.timeHintAr,
        timeHintEn: m.timeHintEn,
        completed: completedSet.has(k),
        completedAt: row ? (row as any).completedAt : null,
      };
    });
  } catch {
    /* ignore */
  }

  const total = 5;
  const percent = Math.round((completedCount / total) * 100);

  return {
    date: date.toISOString().slice(0, 10),
    prayer: {
      key: prayerKey,
      nameAr: meta.nameAr,
      nameEn: meta.nameEn,
      timeHintAr: meta.timeHintAr,
      timeHintEn: meta.timeHintEn,
      completed,
    },
    prayers: {
      completed: completedCount,
      total,
      percent,
      detailedPrayers: detailed,
    },
  };
}

export async function updateQuranPages(userId: string, pages: number) {
  if (pages < 0) {
    throw new AppError(
      'Pages must be zero or greater',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDateOnly();
  const progress = await prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, quranPagesRead: pages },
    update: { quranPagesRead: pages },
  });

  return { quranPagesRead: progress.quranPagesRead };
}

export async function incrementQuranPages(userId: string, pages: number) {
  if (pages <= 0) {
    throw new AppError(
      'Pages must be greater than zero',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDateOnly();
  const current = await getOrCreateToday(userId, date);

  const progress = await prisma.dailyProgress.update({
    where: { id: current.id },
    data: { quranPagesRead: current.quranPagesRead + pages },
  });

  return { quranPagesRead: progress.quranPagesRead };
}

export async function updateAdhkar(userId: string, completed: boolean) {
  const date = getTodayDateOnly();
  const progress = await prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: {
      userId,
      date,
      morningAdhkarCompleted: completed,
      eveningAdhkarCompleted: completed,
      adhkarCompleted: completed,
    },
    update: {
      morningAdhkarCompleted: completed,
      eveningAdhkarCompleted: completed,
      adhkarCompleted: completed,
    },
  });

  const morningCompleted = progress.morningAdhkarCompleted;
  const eveningCompleted = progress.eveningAdhkarCompleted;
  const overallCompleted = morningCompleted && eveningCompleted;
  const percent = Math.round(((morningCompleted ? 1 : 0) + (eveningCompleted ? 1 : 0)) / 2 * 100);

  return {
    morningCompleted,
    eveningCompleted,
    overallCompleted,
    adhkarCompleted: overallCompleted,
    percent,
  };
}

export async function updateSadaqah(userId: string, amount: number) {
  if (amount < 0) {
    throw new AppError(
      'Amount must be zero or greater',
      HttpStatus.BAD_REQUEST,
      ErrorCodes.VALIDATION_ERROR,
    );
  }

  const date = getTodayDateOnly();
  const progress = await prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, sadaqahAmount: amount },
    update: { sadaqahAmount: amount },
  });

  return { sadaqahAmount: Number(progress.sadaqahAmount) };
}

export async function getJourneyProgress(userId: string, days = 7) {
  const today = getTodayDateOnly();
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() - (days - 1));

  const [progress, prayerCompletions] = await Promise.all([
    prisma.dailyProgress.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: today },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.prayerCompletion.findMany({
      where: {
        userId,
        date: { gte: startDate, lte: today },
      },
    }),
  ]);

  const prayersByDate = new Map<string, number>();
  for (const pc of prayerCompletions) {
    const key = pc.date.toISOString().slice(0, 10);
    prayersByDate.set(key, (prayersByDate.get(key) ?? 0) + 1);
  }

  const QURAN_GOAL = 4;
  const SADAQAH_GOAL = 50;
  const TOTAL_PRAYERS = 5;

  const daily = progress.map((p) => {
    const dateStr = p.date.toISOString().slice(0, 10);
    const prayersCompleted = prayersByDate.get(dateStr) ?? 0;
    const quranProgress = QURAN_GOAL > 0 ? Math.min(1, p.quranPagesRead / QURAN_GOAL) : 0;
    const prayerProgress = prayersCompleted / TOTAL_PRAYERS;
    const morningDone = p.morningAdhkarCompleted ?? p.adhkarCompleted;
    const eveningDone = p.eveningAdhkarCompleted ?? p.adhkarCompleted;
    const adhkarCompleted = morningDone && eveningDone;
    const adhkarProgress = ((morningDone ? 1 : 0) + (eveningDone ? 1 : 0)) / 2;
    const sadaqahProgress = SADAQAH_GOAL > 0 ? Math.min(1, Number(p.sadaqahAmount) / SADAQAH_GOAL) : 0;
    const overallPercent = Math.round(
      ((quranProgress + prayerProgress + adhkarProgress + sadaqahProgress) / 4) * 100,
    );

    return {
      date: dateStr,
      quranPages: p.quranPagesRead,
      quranPagesRead: p.quranPagesRead,
      adhkarCompleted,
      morningAdhkarCompleted: morningDone,
      eveningAdhkarCompleted: eveningDone,
      sadaqah: Number(p.sadaqahAmount),
      sadaqahAmount: Number(p.sadaqahAmount),
      prayersCompleted,
      overallPercent,
    };
  });

  const totalPrayersCompleted = prayerCompletions.length;
  const daysStreak = computeDaysStreak(progress, today);

  const summary = {
    totalQuranPages: progress.reduce((sum, p) => sum + p.quranPagesRead, 0),
    adhkarDaysCompleted: progress.filter((p) => {
      const morning = p.morningAdhkarCompleted ?? p.adhkarCompleted;
      const evening = p.eveningAdhkarCompleted ?? p.adhkarCompleted;
      return morning && evening;
    }).length,
    totalSadaqah: progress.reduce(
      (sum, p) => sum + Number(p.sadaqahAmount),
      0,
    ),
    prayersCompletedCount: totalPrayersCompleted,
    daysStreak,
  };

  return {
    periodDays: days,
    daily,
    records: daily,
    summary,
  };
}

function computeDaysStreak(progress: Array<{ date: Date }>, today: Date): number {
  if (progress.length === 0) return 0;
  const datesSet = new Set(
    progress.map((p) => p.date.toISOString().slice(0, 10)),
  );
  let streak = 0;
  const cursor = new Date(today);
  while (datesSet.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

const TOTAL_QURAN_PAGES = 604;

export async function getJourneyOverview(userId: string) {
  const [user, khatmah, allDailyProgress, challengeCompletions, tasbihLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        points: true,
        username: true,
      },
    }),
    prisma.khatmah.findUnique({
      where: { userId },
      include: {
        currentSurah: {
          select: {
            id: true,
            nameEn: true,
            nameAr: true,
          },
        },
      },
    }),
    prisma.dailyProgress.findMany({
      where: { userId },
    }),
    prisma.challengeCompletion.findMany({
      where: { userId, claimedAt: { not: null } },
    }),
    prisma.tasbihLog.findMany({
      where: { userId },
    }),
  ]);

  const totalQuranPagesRead = allDailyProgress.reduce((sum, day) => sum + day.quranPagesRead, 0);
  const totalAdhkarDays = allDailyProgress.filter((day) => day.adhkarCompleted).length;
  const khatmahProgress = khatmah
    ? Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100)
    : 0;
  const totalTasbih = tasbihLogs.reduce((sum, log) => sum + log.totalAllTime, 0);

  return {
    user: {
      name: user?.username || 'مستخدم',
      joinedDate: user?.createdAt || new Date(),
      totalPoints: user?.points || 0,
    },
    milestones: {
      quranCompletion: {
        pagesRead: khatmah?.totalPagesRead || 0,
        progressPercent: khatmahProgress,
        currentSurah: khatmah?.currentSurah || { id: 1, nameEn: 'Al-Fatihah', nameAr: 'الفاتحة' },
        isCompleted: khatmahProgress >= 100,
      },
      adhkarConsistency: {
        daysCompleted: totalAdhkarDays,
        percentage: allDailyProgress.length > 0 ? Math.round((totalAdhkarDays / allDailyProgress.length) * 100) : 0,
      },
      tasbeehTally: {
        total: totalTasbih,
      },
      challengesCompleted: {
        total: challengeCompletions.length,
      },
    },
    stats: {
      totalDaysActive: allDailyProgress.length,
      totalQuranPagesRead,
      totalChallengesCompleted: challengeCompletions.length,
      totalTasbih,
    },
  };
}

export async function getWeeklyStats(userId: string) {
  const today = getTodayDateOnly();
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [dailyProgressList, prayerCompletions] = await Promise.all([
    prisma.dailyProgress.findMany({
      where: {
        userId,
        date: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
      orderBy: { date: 'asc' },
    }),
    prisma.prayerCompletion.findMany({
      where: {
        userId,
        date: {
          gte: sevenDaysAgo,
          lte: today,
        },
      },
    }),
  ]);

  const totalQuran = dailyProgressList.reduce((sum, day) => sum + day.quranPagesRead, 0);
  const adhkarDays = dailyProgressList.filter((day) => day.adhkarCompleted).length;
  const prayersCompleted = prayerCompletions.length;

  return {
    period: {
      from: sevenDaysAgo.toISOString().split('T')[0],
      to: today.toISOString().split('T')[0],
      days: 7,
    },
    summary: {
      quranPagesRead: totalQuran,
      adhkarDaysCompleted: adhkarDays,
      prayersCompleted,
      daysActive: dailyProgressList.length,
    },
    daily: dailyProgressList.map((day) => ({
      date: day.date.toISOString().split('T')[0],
      quranPages: day.quranPagesRead,
      adhkarCompleted: day.adhkarCompleted,
    })),
  };
}

export async function getMonthlyStats(userId: string) {
  const today = getTodayDateOnly();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const [dailyProgressList, challengeCompletions] = await Promise.all([
    prisma.dailyProgress.findMany({
      where: {
        userId,
        date: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
    }),
    prisma.challengeCompletion.findMany({
      where: {
        userId,
      },
    }),
  ]);

  const totalQuran = dailyProgressList.reduce((sum, day) => sum + day.quranPagesRead, 0);
  const adhkarDays = dailyProgressList.filter((day) => day.adhkarCompleted).length;
  const challengesCompleted = challengeCompletions.filter((c) => c.claimedAt).length;

  return {
    month: {
      month: today.getMonth() + 1,
      year: today.getFullYear(),
    },
    summary: {
      quranPagesRead: totalQuran,
      adhkarDaysCompleted: adhkarDays,
      challengesCompleted,
      daysActive: dailyProgressList.length,
    },
  };
}
