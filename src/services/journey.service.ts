import { ErrorCodes, HttpStatus } from '../config';
import { AppError } from '../lib/errors';
import { prisma } from '../lib/prisma';
import { getTodayDateOnly } from '../utils/date';

async function getOrCreateToday(userId: string, date = getTodayDateOnly()) {
  return prisma.dailyProgress.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date },
    update: {},
  });
}

export async function getTodayJourney(userId: string) {
  const progress = await getOrCreateToday(userId);

  return {
    quranPagesRead: progress.quranPagesRead,
    adhkarCompleted: progress.adhkarCompleted,
    sadaqahAmount: Number(progress.sadaqahAmount),
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
    create: { userId, date, adhkarCompleted: completed },
    update: { adhkarCompleted: completed },
  });

  return { adhkarCompleted: progress.adhkarCompleted };
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

  const progress = await prisma.dailyProgress.findMany({
    where: {
      userId,
      date: { gte: startDate, lte: today },
    },
    orderBy: { date: 'asc' },
  });

  return {
    periodDays: days,
    records: progress.map((p) => ({
      date: p.date.toISOString().slice(0, 10),
      quranPagesRead: p.quranPagesRead,
      adhkarCompleted: p.adhkarCompleted,
      sadaqahAmount: Number(p.sadaqahAmount),
    })),
    summary: {
      totalQuranPages: progress.reduce((sum, p) => sum + p.quranPagesRead, 0),
      adhkarDaysCompleted: progress.filter((p) => p.adhkarCompleted).length,
      totalSadaqah: progress.reduce(
        (sum, p) => sum + Number(p.sadaqahAmount),
        0,
      ),
    },
  };
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
