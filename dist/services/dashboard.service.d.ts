import type { DailyPrayerSchedule } from './prayer.service';
export type DashboardData = {
    greeting: {
        username: string;
        points: number;
    };
    prayers: DailyPrayerSchedule;
    verseOfTheDay: {
        textAr: string;
        referenceAr: string;
        surahNumber: number;
        ayahNumber: number;
    } | null;
    hadithOfTheDay: {
        textAr: string;
        sourceAr: string;
    } | null;
    dailyJourney: {
        prayer: {
            completed: number;
            total: number;
            progress: number;
        };
        quran: {
            pagesRead: number;
        };
        adhkar: {
            completed: boolean;
        };
        sadaqah: {
            amount: number;
        };
    };
    khatmah: {
        surahId: number;
        surahNameEn: string;
        surahNameAr: string;
        currentPage: number;
        progressPercent: number;
    } | null;
    dailyChallenge: {
        titleAr: string;
        descriptionAr: string;
        rewardPoints: number;
        targetValue: number;
        completed: boolean;
        claimed: boolean;
    } | null;
    utilities: {
        qibla: {
            enabled: true;
        };
        tasbih: {
            enabled: true;
        };
    };
};
export declare function getDashboard(userId: string): Promise<DashboardData>;
//# sourceMappingURL=dashboard.service.d.ts.map