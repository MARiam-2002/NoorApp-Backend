import { PrayerNameEnum } from '../utils/constants';
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
export declare function getTodayPrayers(userId: string): Promise<DailyPrayerSchedule>;
export declare function markPrayer(userId: string, prayerId: string): Promise<{
    prayer: string;
    completed: boolean;
}>;
export declare function getPrayerSchedule(latitude?: number, longitude?: number, timezone?: string, dateStr?: string): Promise<DailyPrayerSchedule>;
//# sourceMappingURL=prayer.service.d.ts.map