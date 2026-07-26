export declare function getVerseOfDay(dayOfYear?: number): Promise<{
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    id: string;
    dayOfYear: number;
    ayahNumber: number;
    textAr: string;
    surahNumber: number;
    referenceAr: string;
}>;
export declare function getHadithOfDay(dayOfYear?: number): Promise<{
    id: string;
    dayOfYear: number;
    textAr: string;
    sourceAr: string;
}>;
export declare function getDailyChallenge(dayOfYear?: number): Promise<{
    type: import("@prisma/client").$Enums.ChallengeType;
    id: string;
    dayOfYear: number;
    titleAr: string;
    descriptionAr: string;
    targetValue: number;
    rewardPoints: number;
} | null>;
export declare function getVerseOfDayByDay(day: number): Promise<{
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    id: string;
    dayOfYear: number;
    ayahNumber: number;
    textAr: string;
    surahNumber: number;
    referenceAr: string;
}>;
export declare function getHadithOfDayByDay(day: number): Promise<{
    id: string;
    dayOfYear: number;
    textAr: string;
    sourceAr: string;
}>;
export declare function getDailyChallengeByDay(day: number): Promise<{
    type: import("@prisma/client").$Enums.ChallengeType;
    id: string;
    dayOfYear: number;
    titleAr: string;
    descriptionAr: string;
    targetValue: number;
    rewardPoints: number;
} | null>;
//# sourceMappingURL=content.service.d.ts.map