"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDailyPrayerSchedule = calculateDailyPrayerSchedule;
exports.getTodayPrayers = getTodayPrayers;
exports.markPrayer = markPrayer;
exports.getPrayerSchedule = getPrayerSchedule;
const adhan_1 = require("adhan");
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const prisma_1 = require("../lib/prisma");
const constants_1 = require("../utils/constants");
const date_1 = require("../utils/date");
const DEFAULT_LATITUDE = 30.0444;
const DEFAULT_LONGITUDE = 31.2357;
const prayerLabelsAr = {
    [constants_1.PrayerNameEnum.FAJR]: 'الفجر',
    [constants_1.PrayerNameEnum.DHUHR]: 'الظهر',
    [constants_1.PrayerNameEnum.ASR]: 'العصر',
    [constants_1.PrayerNameEnum.MAGHRIB]: 'المغرب',
    [constants_1.PrayerNameEnum.ISHA]: 'العشاء',
};
function formatTime(date, timezone) {
    return new Intl.DateTimeFormat('en-GB', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: timezone,
    }).format(date);
}
function getPrayerDateMap(prayerTimes) {
    return {
        [constants_1.PrayerNameEnum.FAJR]: prayerTimes.fajr,
        [constants_1.PrayerNameEnum.DHUHR]: prayerTimes.dhuhr,
        [constants_1.PrayerNameEnum.ASR]: prayerTimes.asr,
        [constants_1.PrayerNameEnum.MAGHRIB]: prayerTimes.maghrib,
        [constants_1.PrayerNameEnum.ISHA]: prayerTimes.isha,
    };
}
function calculateDailyPrayerSchedule(latitude, longitude, timezone = constants_1.DefaultTimezone, completedPrayers = [], referenceDate = new Date()) {
    const coordinates = new adhan_1.Coordinates(latitude, longitude);
    const params = adhan_1.CalculationMethod.Egyptian();
    const prayerTimes = new adhan_1.PrayerTimes(coordinates, referenceDate, params);
    const prayerDateMap = getPrayerDateMap(prayerTimes);
    const now = referenceDate.getTime();
    const schedule = constants_1.PrayerOrder.map((name) => {
        const timestamp = prayerDateMap[name];
        return {
            name,
            nameAr: prayerLabelsAr[name],
            time: formatTime(timestamp, timezone),
            timestamp,
            completed: completedPrayers.includes(name),
        };
    });
    const nextPrayerEntry = schedule.find((item) => item.timestamp.getTime() > now) ?? schedule[0] ?? null;
    const nextPrayer = nextPrayerEntry
        ? {
            name: nextPrayerEntry.name,
            nameAr: nextPrayerEntry.name === constants_1.PrayerNameEnum.ASR
                ? 'صلاة العصر'
                : `صلاة ${nextPrayerEntry.nameAr}`,
            time: nextPrayerEntry.time,
            timestamp: nextPrayerEntry.timestamp,
            countdownSeconds: Math.max(0, Math.floor((nextPrayerEntry.timestamp.getTime() - now) / 1000)),
        }
        : null;
    return {
        date: referenceDate.toISOString().slice(0, 10),
        timezone,
        nextPrayer,
        schedule,
        completedCount: completedPrayers.length,
        totalCount: constants_1.PrayerOrder.length,
    };
}
async function findCompletedPrayers(userId, date = (0, date_1.getTodayDateOnly)()) {
    const records = await prisma_1.prisma.prayerCompletion.findMany({
        where: { userId, date },
        select: { prayer: true },
    });
    return records.map((record) => record.prayer);
}
async function togglePrayer(userId, prayer, date = (0, date_1.getTodayDateOnly)()) {
    const existing = await prisma_1.prisma.prayerCompletion.findUnique({
        where: {
            userId_date_prayer: { userId, date, prayer },
        },
    });
    if (existing) {
        await prisma_1.prisma.prayerCompletion.delete({
            where: { id: existing.id },
        });
        return false;
    }
    await prisma_1.prisma.prayerCompletion.create({
        data: { userId, date, prayer },
    });
    return true;
}
async function getTodayPrayers(userId) {
    const user = await prisma_1.prisma.user.findUnique({
        where: { id: userId },
        select: { latitude: true, longitude: true, timezone: true },
    });
    if (!user) {
        throw new errors_1.AppError('User not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    const completed = await findCompletedPrayers(userId);
    return calculateDailyPrayerSchedule(user.latitude ?? DEFAULT_LATITUDE, user.longitude ?? DEFAULT_LONGITUDE, user.timezone ?? constants_1.DefaultTimezone, completed);
}
async function markPrayer(userId, prayerId) {
    if (!Object.values(constants_1.PrayerNameEnum).includes(prayerId)) {
        throw new errors_1.AppError('Invalid prayer name', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const completed = await togglePrayer(userId, prayerId);
    return { prayer: prayerId, completed };
}
async function getPrayerSchedule(latitude, longitude, timezone, dateStr) {
    const lat = latitude ?? DEFAULT_LATITUDE;
    const lng = longitude ?? DEFAULT_LONGITUDE;
    const tz = timezone ?? constants_1.DefaultTimezone;
    const refDate = dateStr ? new Date(dateStr) : new Date();
    return calculateDailyPrayerSchedule(lat, lng, tz, [], refDate);
}
//# sourceMappingURL=prayer.service.js.map