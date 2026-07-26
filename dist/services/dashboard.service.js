"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboard = getDashboard;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const prayer_service_1 = require("./prayer.service");
const date_1 = require("../utils/date");
const challenge_1 = require("../utils/challenge");
const constants_1 = require("../utils/constants");
const DEFAULT_LATITUDE = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;
const TOTAL_QURAN_PAGES = 604;
async function findCompletedPrayers(userId, date = (0, date_1.getTodayDateOnly)()) {
    const records = await prisma_1.prisma.prayerCompletion.findMany({
        where: { userId, date },
        select: { prayer: true },
    });
    return records.map((record) => record.prayer);
}
async function getOrCreateTodayJourney(userId, date = (0, date_1.getTodayDateOnly)()) {
    return prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
    });
}
async function getOrCreateKhatmah(userId) {
    return prisma_1.prisma.khatmah.upsert({
        where: { userId },
        create: { userId, currentSurahId: 2, currentPage: 1 },
        update: {},
        include: { user: false },
    });
}
async function getSurah(surahId) {
    return prisma_1.prisma.surah.findUnique({ where: { id: surahId } });
}
async function getVerseOfTheDay(dayOfYear) {
    return prisma_1.prisma.verseOfTheDay.findFirst({
        where: { dayOfYear },
    });
}
async function getHadithOfTheDay(dayOfYear) {
    return prisma_1.prisma.hadithOfTheDay.findFirst({
        where: { dayOfYear },
    });
}
async function getDailyChallengeTemplate(dayOfYear) {
    return prisma_1.prisma.dailyChallengeTemplate.findFirst({
        where: { dayOfYear },
    });
}
async function getChallengeCompletion(userId, dayOfYear) {
    return prisma_1.prisma.challengeCompletion.findUnique({
        where: { userId_dayOfYear: { userId, dayOfYear } },
    });
}
async function getDashboard(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: {
            id: true,
            username: true,
            points: true,
            timezone: true,
            latitude: true,
            longitude: true,
        },
    });
    if (!user) {
        throw new errors_1.AppError('User not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    const dayOfYear = (0, date_1.getDayOfYear)();
    const [completedPrayers, journey, khatmah, verse, hadith, challengeTemplate, challengeCompletion,] = await Promise.all([
        findCompletedPrayers(userId),
        getOrCreateTodayJourney(userId),
        getOrCreateKhatmah(userId),
        getVerseOfTheDay(dayOfYear),
        getHadithOfTheDay(dayOfYear),
        getDailyChallengeTemplate(dayOfYear),
        getChallengeCompletion(userId, dayOfYear),
    ]);
    const surah = khatmah.currentSurahId ? await getSurah(khatmah.currentSurahId) : null;
    const latitude = user.latitude ?? DEFAULT_LATITUDE;
    const longitude = user.longitude ?? DEFAULT_LONGITUDE;
    const timezone = user.timezone ?? constants_1.DefaultTimezone;
    const prayers = (0, prayer_service_1.calculateDailyPrayerSchedule)(latitude, longitude, timezone, completedPrayers);
    const prayerProgress = prayers.totalCount > 0
        ? Math.round((prayers.completedCount / prayers.totalCount) * 100)
        : 0;
    const challengeCompleted = challengeTemplate
        ? (0, challenge_1.isDailyChallengeCompleted)(challengeTemplate.type, challengeTemplate.targetValue, {
            quranPagesRead: journey.quranPagesRead,
            adhkarCompleted: journey.adhkarCompleted,
            sadaqahAmount: journey.sadaqahAmount,
        }, completedPrayers)
        : false;
    return {
        greeting: {
            username: user.username,
            points: user.points,
        },
        prayers,
        verseOfTheDay: verse
            ? {
                textAr: verse.textAr,
                referenceAr: verse.referenceAr,
                surahNumber: verse.surahNumber,
                ayahNumber: verse.ayahNumber,
            }
            : null,
        hadithOfTheDay: hadith
            ? {
                textAr: hadith.textAr,
                sourceAr: hadith.sourceAr,
            }
            : null,
        dailyJourney: {
            prayer: {
                completed: prayers.completedCount,
                total: prayers.totalCount,
                progress: prayerProgress,
            },
            quran: { pagesRead: journey.quranPagesRead },
            adhkar: { completed: journey.adhkarCompleted },
            sadaqah: { amount: Number(journey.sadaqahAmount) },
        },
        khatmah: surah
            ? {
                surahId: surah.id,
                surahNameEn: surah.nameEn,
                surahNameAr: surah.nameAr,
                currentPage: khatmah.currentPage,
                progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
            }
            : null,
        dailyChallenge: challengeTemplate
            ? {
                titleAr: challengeTemplate.titleAr,
                descriptionAr: challengeTemplate.descriptionAr,
                rewardPoints: challengeTemplate.rewardPoints,
                targetValue: challengeTemplate.targetValue,
                completed: challengeCompleted,
                claimed: Boolean(challengeCompletion?.claimedAt),
            }
            : null,
        utilities: {
            qibla: { enabled: true },
            tasbih: { enabled: true },
        },
    };
}
//# sourceMappingURL=dashboard.service.js.map