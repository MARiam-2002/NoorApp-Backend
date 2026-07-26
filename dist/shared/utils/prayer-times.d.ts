import { PrayerNameEnum } from '../enums/prayer-name.enum';
export type PrayerScheduleItem = {
    name: PrayerNameEnum;
    nameAr: string;
    time: string;
    timestamp: Date;
    completed: boolean;
};
export type NextPrayerInfo = {
    name: PrayerNameEnum;
    nameAr: string;
    time: string;
    timestamp: Date;
    countdownSeconds: number;
};
export type DailyPrayerSchedule = {
    date: string;
    timezone: string;
    nextPrayer: NextPrayerInfo | null;
    schedule: PrayerScheduleItem[];
    completedCount: number;
    totalCount: number;
};
export declare function calculateDailyPrayerSchedule(latitude: number, longitude: number, timezone?: string, completedPrayers?: PrayerNameEnum[], referenceDate?: Date): DailyPrayerSchedule;
export declare function getDayOfYear(date?: Date): number;
export declare function getTodayDateOnly(date?: Date): Date;
//# sourceMappingURL=prayer-times.d.ts.map