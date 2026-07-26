export declare function getTodayJourney(userId: string): Promise<{
    quranPagesRead: number;
    adhkarCompleted: boolean;
    sadaqahAmount: number;
}>;
export declare function updateQuranPages(userId: string, pages: number): Promise<{
    quranPagesRead: number;
}>;
export declare function incrementQuranPages(userId: string, pages: number): Promise<{
    quranPagesRead: number;
}>;
export declare function updateAdhkar(userId: string, completed: boolean): Promise<{
    adhkarCompleted: boolean;
}>;
export declare function updateSadaqah(userId: string, amount: number): Promise<{
    sadaqahAmount: number;
}>;
export declare function getJourneyProgress(userId: string, days?: number): Promise<{
    periodDays: number;
    records: {
        date: string;
        quranPagesRead: number;
        adhkarCompleted: boolean;
        sadaqahAmount: number;
    }[];
    summary: {
        totalQuranPages: number;
        adhkarDaysCompleted: number;
        totalSadaqah: number;
    };
}>;
export declare function getJourneyOverview(userId: string): Promise<{
    user: {
        name: string;
        joinedDate: Date;
        totalPoints: number;
    };
    milestones: {
        quranCompletion: {
            pagesRead: number;
            progressPercent: number;
            currentSurah: {
                id: number;
                nameEn: string;
                nameAr: string;
            };
            isCompleted: boolean;
        };
        adhkarConsistency: {
            daysCompleted: number;
            percentage: number;
        };
        tasbeehTally: {
            total: number;
        };
        challengesCompleted: {
            total: number;
        };
    };
    stats: {
        totalDaysActive: number;
        totalQuranPagesRead: number;
        totalChallengesCompleted: number;
        totalTasbih: number;
    };
}>;
export declare function getWeeklyStats(userId: string): Promise<{
    period: {
        from: string | undefined;
        to: string | undefined;
        days: number;
    };
    summary: {
        quranPagesRead: number;
        adhkarDaysCompleted: number;
        prayersCompleted: number;
        daysActive: number;
    };
    daily: {
        date: string | undefined;
        quranPages: number;
        adhkarCompleted: boolean;
    }[];
}>;
export declare function getMonthlyStats(userId: string): Promise<{
    month: {
        month: number;
        year: number;
    };
    summary: {
        quranPagesRead: number;
        adhkarDaysCompleted: number;
        challengesCompleted: number;
        daysActive: number;
    };
}>;
//# sourceMappingURL=journey.service.d.ts.map