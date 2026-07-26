"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChallengeByDay = getChallengeByDay;
exports.getTodayChallenge = getTodayChallenge;
exports.getAllChallenges = getAllChallenges;
exports.claimChallenge = claimChallenge;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const prisma_1 = require("../lib/prisma");
const date_1 = require("../utils/date");
function isDailyChallengeCompleted(type, targetValue, journey, completedPrayers = []) {
    switch (type) {
        case 'QURAN_PAGES':
            return journey.quranPagesRead >= targetValue;
        case 'ADHKAR':
            return journey.adhkarCompleted;
        case 'SADAQAH':
            return Number(journey.sadaqahAmount) >= targetValue;
        case 'PRAYER':
            return completedPrayers.length >= targetValue;
        default:
            return false;
    }
}
async function getOrCreateToday(userId, date = (0, date_1.getTodayDateOnly)()) {
    return prisma_1.prisma.dailyProgress.upsert({
        where: { userId_date: { userId, date } },
        create: { userId, date },
        update: {},
    });
}
async function findCompletedPrayers(userId, date = (0, date_1.getTodayDateOnly)()) {
    const records = await prisma_1.prisma.prayerCompletion.findMany({
        where: { userId, date },
        select: { prayer: true },
    });
    return records.map((record) => record.prayer);
}
async function getChallengeByDay(userId, dayOfYear) {
    const template = await prisma_1.prisma.dailyChallengeTemplate.findFirst({
        where: { dayOfYear },
    });
    const completion = await prisma_1.prisma.challengeCompletion.findUnique({
        where: { userId_dayOfYear: { userId, dayOfYear } },
    });
    if (!template) {
        return null;
    }
    const journey = await getOrCreateToday(userId);
    const completedPrayers = await findCompletedPrayers(userId);
    return {
        id: String(dayOfYear),
        dayOfYear,
        titleAr: template.titleAr,
        descriptionAr: template.descriptionAr,
        type: template.type,
        targetValue: template.targetValue,
        rewardPoints: template.rewardPoints,
        completed: isDailyChallengeCompleted(template.type, template.targetValue, journey, completedPrayers),
        claimed: Boolean(completion?.claimedAt),
    };
}
async function getTodayChallenge(userId) {
    return getChallengeByDay(userId, (0, date_1.getDayOfYear)());
}
async function getAllChallenges(userId) {
    const todayDay = (0, date_1.getDayOfYear)();
    const today = await getChallengeByDay(userId, todayDay);
    return {
        current: today,
        dayOfYear: todayDay,
    };
}
async function claimChallenge(userId, dayOfYearStr) {
    const dayOfYear = Number(dayOfYearStr);
    const template = await prisma_1.prisma.dailyChallengeTemplate.findFirst({
        where: { dayOfYear },
    });
    if (!template) {
        throw new errors_1.AppError('No challenge available for this day', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    const journey = await getOrCreateToday(userId);
    const completedPrayers = await findCompletedPrayers(userId);
    const isCompleted = isDailyChallengeCompleted(template.type, template.targetValue, journey, completedPrayers);
    if (!isCompleted) {
        throw new errors_1.AppError('Challenge requirements not met yet', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const existingCompletion = await prisma_1.prisma.challengeCompletion.findUnique({
        where: { userId_dayOfYear: { userId, dayOfYear } },
    });
    if (existingCompletion?.claimedAt) {
        throw new errors_1.AppError('Challenge reward already claimed', config_1.HttpStatus.CONFLICT, config_1.ErrorCodes.CONFLICT);
    }
    const [updatedCompletion] = await prisma_1.prisma.$transaction([
        prisma_1.prisma.challengeCompletion.upsert({
            where: { userId_dayOfYear: { userId, dayOfYear } },
            create: {
                userId,
                dayOfYear,
                completedAt: new Date(),
                claimedAt: new Date(),
            },
            update: {
                completedAt: new Date(),
                claimedAt: new Date(),
            },
        }),
        prisma_1.prisma.user.update({
            where: { id: userId },
            data: { points: { increment: template.rewardPoints } },
        }),
    ]);
    return {
        id: String(dayOfYear),
        rewardPoints: template.rewardPoints,
        claimed: true,
        claimedAt: updatedCompletion.claimedAt,
    };
}
//# sourceMappingURL=challenge.service.js.map