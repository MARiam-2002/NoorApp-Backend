"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateDailyPrayerSchedule = calculateDailyPrayerSchedule;
exports.getDayOfYear = getDayOfYear;
exports.getTodayDateOnly = getTodayDateOnly;
const adhan_1 = require("adhan");
const timezone_1 = require("../constants/timezone");
const prayer_name_enum_1 = require("../enums/prayer-name.enum");
const prayerLabelsAr = {
    [prayer_name_enum_1.PrayerNameEnum.FAJR]: 'الفجر',
    [prayer_name_enum_1.PrayerNameEnum.DHUHR]: 'الظهر',
    [prayer_name_enum_1.PrayerNameEnum.ASR]: 'العصر',
    [prayer_name_enum_1.PrayerNameEnum.MAGHRIB]: 'المغرب',
    [prayer_name_enum_1.PrayerNameEnum.ISHA]: 'العشاء',
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
        [prayer_name_enum_1.PrayerNameEnum.FAJR]: prayerTimes.fajr,
        [prayer_name_enum_1.PrayerNameEnum.DHUHR]: prayerTimes.dhuhr,
        [prayer_name_enum_1.PrayerNameEnum.ASR]: prayerTimes.asr,
        [prayer_name_enum_1.PrayerNameEnum.MAGHRIB]: prayerTimes.maghrib,
        [prayer_name_enum_1.PrayerNameEnum.ISHA]: prayerTimes.isha,
    };
}
function calculateDailyPrayerSchedule(latitude, longitude, timezone = timezone_1.DefaultTimezone, completedPrayers = [], referenceDate = new Date()) {
    const coordinates = new adhan_1.Coordinates(latitude, longitude);
    const params = adhan_1.CalculationMethod.Egyptian();
    const prayerTimes = new adhan_1.PrayerTimes(coordinates, referenceDate, params);
    const prayerDateMap = getPrayerDateMap(prayerTimes);
    const now = referenceDate.getTime();
    const schedule = prayer_name_enum_1.PrayerOrder.map((name) => {
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
            nameAr: nextPrayerEntry.name === prayer_name_enum_1.PrayerNameEnum.ASR
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
        totalCount: prayer_name_enum_1.PrayerOrder.length,
    };
}
function getDayOfYear(date = new Date()) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date.getTime() - start.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}
function getTodayDateOnly(date = new Date()) {
    return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}
//# sourceMappingURL=prayer-times.js.map