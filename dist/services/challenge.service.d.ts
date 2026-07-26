export declare function getChallengeByDay(userId: string, dayOfYear: number): Promise<{
    id: string;
    dayOfYear: number;
    titleAr: string;
    descriptionAr: string;
    type: import("@prisma/client").$Enums.ChallengeType;
    targetValue: number;
    rewardPoints: number;
    completed: boolean;
    claimed: boolean;
} | null>;
export declare function getTodayChallenge(userId: string): Promise<{
    id: string;
    dayOfYear: number;
    titleAr: string;
    descriptionAr: string;
    type: import("@prisma/client").$Enums.ChallengeType;
    targetValue: number;
    rewardPoints: number;
    completed: boolean;
    claimed: boolean;
} | null>;
export declare function getAllChallenges(userId: string): Promise<{
    current: {
        id: string;
        dayOfYear: number;
        titleAr: string;
        descriptionAr: string;
        type: import("@prisma/client").$Enums.ChallengeType;
        targetValue: number;
        rewardPoints: number;
        completed: boolean;
        claimed: boolean;
    } | null;
    dayOfYear: number;
}>;
export declare function claimChallenge(userId: string, dayOfYearStr: string): Promise<{
    id: string;
    rewardPoints: number;
    claimed: boolean;
    claimedAt: Date | null;
}>;
//# sourceMappingURL=challenge.service.d.ts.map