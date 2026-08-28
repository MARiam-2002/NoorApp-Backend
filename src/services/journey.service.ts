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
  const date = getTodayDateOnly();
  const progress = await getOrCreateToday(userId);

  let prayersCompleted = 0;
  try {
    prayersCompleted = await prisma.prayerCompletion.count({
      where: { userId, date },
    });
  } catch {
    // table may not exist yet
  }

  const totalPrayers = 5;
  const quranGoal = 4;
  const sadaqahGoal = 50;

  const quranProgress = quranGoal > 0 ? Math.min(1, progress.quranPagesRead / quranGoal) : 0;
  const prayerProgress = prayersCompleted / totalPrayers;
  const adhkarDone = progress.adhkarCompleted;
  const sadaqahAmount = Number(progress.sadaqahAmount);
  const sadaqahProgress = sadaqahGoal > 0 ? Math.min(1, sadaqahAmount / sadaqahGoal) : 0;

  const tasks = [
    { key: 'quran', titleAr: 'قراءة القرآن', done: quranProgress >= 1, progress: Math.round(quranProgress * 100) / 100 },
    { key: 'prayer', titleAr: 'الصلوات', done: prayersCompleted >= totalPrayers, progress: Math.round(prayerProgress * 100) / 100 },
    { key: 'adhkar', titleAr: 'الأذكار', done: adhkarDone },
    { key: 'sadaqah', titleAr: 'الصدقة', done: sadaqahAmount > 0, amount: sadaqahAmount },
  ];

  const overallPercent = Math.round(
    ((quranProgress + prayerProgress + (adhkarDone ? 1 : 0) + sadaqahProgress) / 4) * 100,
  );

  let points = 0;
  let streakDays = 0;
  try {
    const [user, last30Progress] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { points: true } }),
      prisma.dailyProgress.findMany({
        where: { userId },
        select: { date: true, quranPagesRead: true, adhkarCompleted: true, sadaqahAmount: true },
      }),
    ]);
    points = user?.points ?? 0;

    const datesSet = new Set(
      last30Progress
        .filter((p) => p.quranPagesRead > 0 || p.adhkarCompleted || Number(p.sadaqahAmount) > 0)
        .map((p) => p.date.toISOString().slice(0, 10)),
    );
    const cursor = new Date(date);
    while (datesSet.has(cursor.toISOString().slice(0, 10))) {
      streakDays += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  } catch { /* */ }

  return {
    date: date.toISOString().slice(0, 10),
    tasks,
    streakDays,
    badges: [],
    points,
    overallPercent,
    quranPagesRead: progress.quranPagesRead,
    adhkarCompleted: progress.adhkarCompleted,
    sadaqahAmount,
    prayersCompleted,
    prayersTotal: totalPrayers,
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
    const sadaqahProgress = SADAQAH_GOAL > 0 ? Math.min(1, Number(p.sadaqahAmount) / SADAQAH_GOAL) : 0;
    const overallPercent = Math.round(
      ((quranProgress + prayerProgress + (p.adhkarCompleted ? 1 : 0) + sadaqahProgress) / 4) * 100,
    );

    return {
      date: dateStr,
      quranPages: p.quranPagesRead,
      quranPagesRead: p.quranPagesRead,
      adhkarCompleted: p.adhkarCompleted,
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
    adhkarDaysCompleted: progress.filter((p) => p.adhkarCompleted).length,
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
