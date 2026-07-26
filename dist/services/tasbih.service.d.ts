import type { TasbihDhikr } from '@prisma/client';
export declare enum Dhikr {
    SUBHAN_ALLAH = "SUBHAN_ALLAH",
    ALHAMDULILLAH = "ALHAMDULILLAH",
    LA_ILAHA_ILLA_ALLAH = "LA_ILAHA_ILLA_ALLAH",
    ALLAHU_AKBAR = "ALLAHU_AKBAR",
    ASTAGHFIRULLAH = "ASTAGHFIRULLAH",
    LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH = "LA_HAWLA_WA_LA_QUWWATA_ILLA_BILLAH"
}
export declare function getDhikrArName(dhikr: string): string;
export declare function getTodayTasbih(userId: string): Promise<{
    id: string;
    date: Date;
    dhikr: import("@prisma/client").$Enums.TasbihDhikr;
    count: number;
    totalAllTime: number;
}>;
export declare function incrementTasbih(userId: string, amount?: number): Promise<{
    id: string;
    dhikr: import("@prisma/client").$Enums.TasbihDhikr;
    count: number;
    totalAllTime: number;
}>;
export declare function resetTasbih(userId: string): Promise<{
    id: string;
    dhikr: import("@prisma/client").$Enums.TasbihDhikr;
    count: number;
    totalAllTime: number;
}>;
export declare function changeDhikr(userId: string, dhikr: TasbihDhikr): Promise<{
    id: string;
    dhikr: import("@prisma/client").$Enums.TasbihDhikr;
    count: number;
    totalAllTime: number;
}>;
export declare function getTasbihHistory(userId: string, limit?: number): Promise<{
    id: string;
    date: Date;
    dhikr: import("@prisma/client").$Enums.TasbihDhikr;
    count: number;
    totalAllTime: number;
}[]>;
//# sourceMappingURL=tasbih.service.d.ts.map