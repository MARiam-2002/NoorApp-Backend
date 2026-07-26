"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTodayJourney = getTodayJourney;
exports.updateQuranPages = updateQuranPages;
exports.incrementQuranPages = incrementQuranPages;
exports.updateAdhkar = updateAdhkar;
exports.updateSadaqah = updateSadaqah;
exports.getJourneyProgress = getJourneyProgress;
exports.getJourneyOverview = getJourneyOverview;
exports.getWeeklyStats = getWeeklyStats;
exports.getMonthlyStats = getMonthlyStats;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const prisma_1 = require("../lib/prisma");
const date_1 = require("../utils/date");
async function getOrCreateToday(userId, date = (0, date_1.getTodayDateOnly)()) {
    return prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
    });
}
async function getTodayJourney(userId) {
    const progress = await getOrCreateToday(userId);
    return {
        quranPagesRead: progress.quranPagesRead,
        adhkarCompleted: progress.adhkarCompleted,
        sadaqahAmount: Number(progress.sadaqahAmount),
    };
}
async function updateQuranPages(userId, pages) {
    if (pages < 0) {
        throw new errors_1.AppError('Pages must be zero or greater', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const date = (0, date_1.getTodayDateOnly)();
    const progress = await prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, quranPagesRead: pages },
        update: { quranPagesRead: pages },
    });
    return { quranPagesRead: progress.quranPagesRead };
}
async function incrementQuranPages(userId, pages) {
    if (pages <= 0) {
        throw new errors_1.AppError('Pages must be greater than zero', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const date = (0, date_1.getTodayDateOnly)();
    const current = await getOrCreateToday(userId, date);
    const progress = await prisma_1.prisma.dailyProgress.update({
        where: { id: current.id },
        data: { quranPagesRead: current.quranPagesRead + pages },
    });
    return { quranPagesRead: progress.quranPagesRead };
}
async function updateAdhkar(userId, completed) {
    const date = (0, date_1.getTodayDateOnly)();
    const progress = await prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, adhkarCompleted: completed },
        update: { adhkarCompleted: completed },
    });
    return { adhkarCompleted: progress.adhkarCompleted };
}
async function updateSadaqah(userId, amount) {
    if (amount < 0) {
        throw new errors_1.AppError('Amount must be zero or greater', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const date = (0, date_1.getTodayDateOnly)();
    const progress = await prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date, sadaqahAmount: amount },
        update: { sadaqahAmount: amount },
    });
    return { sadaqahAmount: Number(progress.sadaqahAmount) };
}
async function getJourneyProgress(userId, days = 7) {
    const today = (0, date_1.getTodayDateOnly)();
    const startDate = new Date(today);
    startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
    const progress = await prisma_1.prisma.dailyProgress.findMany({
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
            totalSadaqah: progress.reduce((sum, p) => sum + Number(p.sadaqahAmount), 0),
        },
    };
}
const TOTAL_QURAN_PAGES = 604;
async function getJourneyOverview(userId) {
    const [user, khatmah, allDailyProgress, challengeCompletions, tasbihLogs] = await Promise.all([
        prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                createdAt: true,
                points: true,
                username: true,
            },
        }),
        prisma_1.prisma.khatmah.findUnique({
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
        prisma_1.prisma.dailyProgress.findMany({
            where: { userId },
        }),
        prisma_1.prisma.challengeCompletion.findMany({
            where: { userId, claimedAt: { not: null } },
        }),
        prisma_1.prisma.tasbihLog.findMany({
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
async function getWeeklyStats(userId) {
    const today = (0, date_1.getTodayDateOnly)();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [dailyProgressList, prayerCompletions] = await Promise.all([
        prisma_1.prisma.dailyProgress.findMany({
            where: {
                userId,
                date: {
                    gte: sevenDaysAgo,
                    lte: today,
                },
            },
            orderBy: { date: 'asc' },
        }),
        prisma_1.prisma.prayerCompletion.findMany({
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
async function getMonthlyStats(userId) {
    const today = (0, date_1.getTodayDateOnly)();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const [dailyProgressList, challengeCompletions] = await Promise.all([
        prisma_1.prisma.dailyProgress.findMany({
            where: {
                userId,
                date: {
                    gte: monthStart,
                    lte: monthEnd,
                },
            },
        }),
        prisma_1.prisma.challengeCompletion.findMany({
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
//# sourceMappingURL=journey.service.js.map