export declare function listSurahs(): Promise<{
    id: number;
    nameEn: string;
    nameAr: string;
    totalAyahs: number;
    totalPages: number;
}[]>;
export declare function getSurah(surahId: number): Promise<{
    id: number;
    nameEn: string;
    nameAr: string;
    totalAyahs: number;
    totalPages: number;
}>;
export declare function listAyahs(surahId: number, page?: number, limit?: number): Promise<{
    items: {
        id: string;
        surahId: number;
        ayahNumber: number;
        textAr: string;
        page: number | null;
        juz: number | null;
    }[];
    meta: import("../utils/pagination").PaginationMeta;
}>;
export declare function listBookmarks(userId: string): Promise<({
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    id: string;
    createdAt: Date;
    userId: string;
    surahId: number;
    ayahNumber: number;
    note: string | null;
})[]>;
export declare function createBookmark(userId: string, surahId: number, ayahNumber: number, note?: string): Promise<{
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    id: string;
    createdAt: Date;
    userId: string;
    surahId: number;
    ayahNumber: number;
    note: string | null;
}>;
export declare function deleteBookmark(userId: string, bookmarkId: string): Promise<void>;
export declare function getLastRead(userId: string): Promise<({
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    updatedAt: Date;
    userId: string;
    surahId: number;
    ayahNumber: number;
    page: number | null;
}) | null>;
export declare function updateLastRead(userId: string, surahId: number, ayahNumber: number, page?: number): Promise<{
    surah: {
        id: number;
        nameEn: string;
        nameAr: string;
    };
} & {
    updatedAt: Date;
    userId: string;
    surahId: number;
    ayahNumber: number;
    page: number | null;
}>;
export declare function listReadingHistory(userId: string, page?: number, limit?: number): Promise<{
    items: {
        id: string;
        surahId: number;
        ayahFrom: number;
        ayahTo: number;
        readAt: Date;
    }[];
    meta: import("../utils/pagination").PaginationMeta;
}>;
export declare function recordReadingHistory(userId: string, surahId: number, ayahFrom: number, ayahTo: number, page?: number): Promise<{
    id: string;
    userId: string;
    surahId: number;
    ayahFrom: number;
    ayahTo: number;
    readAt: Date;
}>;
export declare function getKhatmah(userId: string): Promise<{
    surahId: number;
    surahNameEn: string;
    surahNameAr: string;
    currentPage: number;
    totalPagesRead: number;
    progressPercent: number;
}>;
export declare function updateKhatmah(userId: string, surahId: number, page: number, pagesRead?: number): Promise<{
    surahId: number;
    surahNameEn: string;
    surahNameAr: string;
    currentPage: number;
    totalPagesRead: number;
    progressPercent: number;
}>;
//# sourceMappingURL=quran.service.d.ts.map