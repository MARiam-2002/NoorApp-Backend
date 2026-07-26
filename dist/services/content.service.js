"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getVerseOfDay = getVerseOfDay;
exports.getHadithOfDay = getHadithOfDay;
exports.getDailyChallenge = getDailyChallenge;
exports.getVerseOfDayByDay = getVerseOfDayByDay;
exports.getHadithOfDayByDay = getHadithOfDayByDay;
exports.getDailyChallengeByDay = getDailyChallengeByDay;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const logger_1 = require("../lib/logger");
function getDayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}
async function getVerseOfDay(dayOfYear = getDayOfYear()) {
    let verse = await prisma_1.prisma.verseOfTheDay.findFirst({
        where: { dayOfYear },
        include: {
            surah: {
                select: {
                    id: true,
                    nameEn: true,
                    nameAr: true,
                },
            },
        },
    });
    if (!verse) {
        logger_1.logger.warn('No verse of the day found, returning default', { dayOfYear });
        // Return default verse
        verse = {
            id: 'default-' + dayOfYear,
            dayOfYear,
            surahNumber: 2,
            ayahNumber: 255,
            textAr: 'الله لا إله إلا هو الحي القيوم',
            referenceAr: 'سورة البقرة - آية الكرسي',
            surah: {
                id: 2,
                nameEn: 'Al-Baqarah',
                nameAr: 'سورة البقرة',
            },
        };
    }
    return verse;
}
async function getHadithOfDay(dayOfYear = getDayOfYear()) {
    let hadith = await prisma_1.prisma.hadithOfTheDay.findFirst({
        where: { dayOfYear },
    });
    if (!hadith) {
        logger_1.logger.warn('No hadith of the day found, returning default', { dayOfYear });
        // Return default hadith
        hadith = {
            id: 'default-' + dayOfYear,
            dayOfYear,
            textAr: 'إن الله مع الصابرين',
            sourceAr: 'صحيح البخاري',
        };
    }
    return hadith;
}
async function getDailyChallenge(dayOfYear = getDayOfYear()) {
    return prisma_1.prisma.dailyChallengeTemplate.findFirst({
        where: { dayOfYear },
    });
}
async function getVerseOfDayByDay(day) {
    if (day < 1 || day > 366) {
        throw new errors_1.AppError('Invalid day of year (must be between 1 and 366)', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    return getVerseOfDay(day);
}
async function getHadithOfDayByDay(day) {
    if (day < 1 || day > 366) {
        throw new errors_1.AppError('Invalid day of year (must be between 1 and 366)', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    return getHadithOfDay(day);
}
async function getDailyChallengeByDay(day) {
    if (day < 1 || day > 366) {
        throw new errors_1.AppError('Invalid day of year (must be between 1 and 366)', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    return getDailyChallenge(day);
}
//# sourceMappingURL=content.service.js.map