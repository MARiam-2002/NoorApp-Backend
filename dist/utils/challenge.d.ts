import type { ChallengeType, PrayerName } from '@prisma/client';
type JourneySnapshot = {
    quranPagesRead: number;
    adhkarCompleted: boolean;
    sadaqahAmount: unknown;
};
export declare function isDailyChallengeCompleted(type: ChallengeType, targetValue: number, journey: JourneySnapshot, completedPrayers?: PrayerName[]): boolean;
export {};
//# sourceMappingURL=challenge.d.ts.map