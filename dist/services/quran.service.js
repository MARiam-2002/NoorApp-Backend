"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.listSurahs = listSurahs;
exports.getSurah = getSurah;
exports.listAyahs = listAyahs;
exports.listBookmarks = listBookmarks;
exports.createBookmark = createBookmark;
exports.deleteBookmark = deleteBookmark;
exports.getLastRead = getLastRead;
exports.updateLastRead = updateLastRead;
exports.listReadingHistory = listReadingHistory;
exports.recordReadingHistory = recordReadingHistory;
exports.getKhatmah = getKhatmah;
exports.updateKhatmah = updateKhatmah;
const prisma_1 = require("../lib/prisma");
const errors_1 = require("../lib/errors");
const config_1 = require("../config");
const pagination_1 = require("../utils/pagination");
const TOTAL_QURAN_PAGES = 604;
async function listSurahs() {
    return prisma_1.prisma.surah.findMany({
        orderBy: { id: 'asc' },
        select: {
            id: true,
            nameEn: true,
            nameAr: true,
            totalAyahs: true,
            totalPages: true,
        },
    });
}
async function getSurah(surahId) {
    const surah = await prisma_1.prisma.surah.findUnique({
        where: { id: surahId },
        select: {
            id: true,
            nameEn: true,
            nameAr: true,
            totalAyahs: true,
            totalPages: true,
        },
    });
    if (!surah) {
        throw new errors_1.AppError('Surah not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    return surah;
}
async function listAyahs(surahId, page, limit) {
    const pagination = (0, pagination_1.parsePaginationQuery)(page, limit);
    const [items, total] = await Promise.all([
        prisma_1.prisma.ayah.findMany({
            where: { surahId },
            orderBy: { ayahNumber: 'asc' },
            skip: pagination.skip,
            take: pagination.limit,
            select: {
                id: true,
                surahId: true,
                ayahNumber: true,
                textAr: true,
                page: true,
                juz: true,
            },
        }),
        prisma_1.prisma.ayah.count({ where: { surahId } }),
    ]);
    return {
        items,
        meta: (0, pagination_1.buildPaginationMeta)(pagination.page, pagination.limit, total),
    };
}
async function listBookmarks(userId) {
    return prisma_1.prisma.quranBookmark.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        include: {
            surah: {
                select: { id: true, nameEn: true, nameAr: true },
            },
        },
    });
}
async function createBookmark(userId, surahId, ayahNumber, note) {
    const surah = await prisma_1.prisma.surah.findUnique({ where: { id: surahId } });
    if (!surah) {
        throw new errors_1.AppError('Surah not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    if (ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
        throw new errors_1.AppError(`Invalid ayah number. Surah ${surah.nameEn} has ${surah.totalAyahs} ayahs`, config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    return prisma_1.prisma.quranBookmark.create({
        data: { userId, surahId, ayahNumber, note },
        include: {
            surah: {
                select: { id: true, nameEn: true, nameAr: true },
            },
        },
    });
}
async function deleteBookmark(userId, bookmarkId) {
    const result = await prisma_1.prisma.quranBookmark.deleteMany({
        where: { id: bookmarkId, userId },
    });
    if (result.count === 0) {
        throw new errors_1.AppError('Bookmark not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
}
async function getLastRead(userId) {
    return prisma_1.prisma.quranLastRead.findUnique({
        where: { userId },
        include: {
            surah: {
                select: { id: true, nameEn: true, nameAr: true },
            },
        },
    });
}
async function updateLastRead(userId, surahId, ayahNumber, page) {
    const surah = await prisma_1.prisma.surah.findUnique({ where: { id: surahId } });
    if (!surah) {
        throw new errors_1.AppError('Surah not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    if (ayahNumber < 1 || ayahNumber > surah.totalAyahs) {
        throw new errors_1.AppError(`Invalid ayah number. Surah ${surah.nameEn} has ${surah.totalAyahs} ayahs`, config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    if (page && (page < 1 || page > TOTAL_QURAN_PAGES)) {
        throw new errors_1.AppError(`Invalid page number. Quran has ${TOTAL_QURAN_PAGES} pages`, config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    return prisma_1.prisma.quranLastRead.upsert({
        where: { userId },
        create: { userId, surahId, ayahNumber, page },
        update: { surahId, ayahNumber, page },
        include: {
            surah: {
                select: { id: true, nameEn: true, nameAr: true },
            },
        },
    });
}
async function listReadingHistory(userId, page, limit) {
    const pagination = (0, pagination_1.parsePaginationQuery)(page, limit);
    const [items, total] = await Promise.all([
        prisma_1.prisma.quranReadingHistory.findMany({
            where: { userId },
            orderBy: { readAt: 'desc' },
            skip: pagination.skip,
            take: pagination.limit,
            select: {
                id: true,
                surahId: true,
                ayahFrom: true,
                ayahTo: true,
                readAt: true,
            },
        }),
        prisma_1.prisma.quranReadingHistory.count({ where: { userId } }),
    ]);
    return {
        items,
        meta: (0, pagination_1.buildPaginationMeta)(pagination.page, pagination.limit, total),
    };
}
async function recordReadingHistory(userId, surahId, ayahFrom, ayahTo, page) {
    const surah = await prisma_1.prisma.surah.findUnique({ where: { id: surahId } });
    if (!surah) {
        throw new errors_1.AppError('Surah not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    if (ayahFrom > ayahTo) {
        throw new errors_1.AppError('Invalid ayah range', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const [history] = await Promise.all([
        prisma_1.prisma.quranReadingHistory.create({
            data: { userId, surahId, ayahFrom, ayahTo },
        }),
        prisma_1.prisma.quranLastRead.upsert({
            where: { userId },
            create: { userId, surahId, ayahNumber: ayahTo, page },
            update: { surahId, ayahNumber: ayahTo, page },
        }),
    ]);
    return history;
}
async function getKhatmah(userId) {
    const khatmah = await prisma_1.prisma.khatmah.upsert({
        where: { userId },
        create: { userId, currentSurahId: 2, currentPage: 1 },
        update: {},
    });
    const surah = await prisma_1.prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });
    return {
        surahId: khatmah.currentSurahId,
        surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
        surahNameAr: surah?.nameAr ?? 'سورة البقرة',
        currentPage: khatmah.currentPage,
        totalPagesRead: khatmah.totalPagesRead,
        progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
    };
}
async function updateKhatmah(userId, surahId, page, pagesRead = 1) {
    if (surahId < 1 || page < 1 || pagesRead < 1) {
        throw new errors_1.AppError('Invalid khatmah progress', config_1.HttpStatus.BAD_REQUEST, config_1.ErrorCodes.VALIDATION_ERROR);
    }
    const existing = await prisma_1.prisma.khatmah.upsert({
        where: { userId },
        create: { userId, currentSurahId: 2, currentPage: 1 },
        update: {},
    });
    const khatmah = await prisma_1.prisma.khatmah.update({
        where: { userId },
        data: {
            currentSurahId: surahId,
            currentPage: page,
            totalPagesRead: existing.totalPagesRead + pagesRead,
        },
    });
    const surah = await prisma_1.prisma.surah.findUnique({ where: { id: khatmah.currentSurahId } });
    return {
        surahId: khatmah.currentSurahId,
        surahNameEn: surah?.nameEn ?? 'Al-Baqarah',
        surahNameAr: surah?.nameAr ?? 'سورة البقرة',
        currentPage: khatmah.currentPage,
        totalPagesRead: khatmah.totalPagesRead,
        progressPercent: Math.round((khatmah.totalPagesRead / TOTAL_QURAN_PAGES) * 100),
    };
}
//# sourceMappingURL=quran.service.js.map