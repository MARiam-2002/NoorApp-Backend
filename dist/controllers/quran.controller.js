"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateKhatmahHandler = exports.getKhatmahHandler = exports.recordReadingHistoryHandler = exports.listReadingHistoryHandler = exports.updateLastReadHandler = exports.getLastReadHandler = exports.deleteBookmarkHandler = exports.createBookmarkHandler = exports.listBookmarksHandler = exports.listAyahsHandler = exports.getSurahHandler = exports.listSurahsHandler = void 0;
const common_1 = require("../middleware/common");
const config_1 = require("../config");
const response_1 = require("../shared/utils/response");
const quran_service_1 = require("../services/quran.service");
exports.listSurahsHandler = (0, common_1.asyncHandler)(async (_req, res) => {
    const data = await (0, quran_service_1.listSurahs)();
    (0, response_1.sendSuccess)(res, data, 'Surahs retrieved successfully');
});
exports.getSurahHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { surahId } = req.params;
    const data = await (0, quran_service_1.getSurah)(Number(surahId));
    (0, response_1.sendSuccess)(res, data, 'Surah retrieved successfully');
});
exports.listAyahsHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { surahId } = req.params;
    const { page, limit } = req.query;
    const result = await (0, quran_service_1.listAyahs)(Number(surahId), page, limit);
    (0, response_1.sendPaginated)(res, result.items, result.meta, 'Ayahs retrieved successfully');
});
exports.listBookmarksHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const data = await (0, quran_service_1.listBookmarks)(userId);
    (0, response_1.sendSuccess)(res, data, 'Bookmarks retrieved successfully');
});
exports.createBookmarkHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { surahId, ayahNumber, note } = req.body;
    const data = await (0, quran_service_1.createBookmark)(userId, surahId, ayahNumber, note);
    (0, response_1.sendSuccess)(res, data, 'Bookmark created successfully', config_1.HttpStatus.CREATED);
});
exports.deleteBookmarkHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { bookmarkId } = req.params;
    await (0, quran_service_1.deleteBookmark)(userId, bookmarkId);
    (0, response_1.sendSuccess)(res, null, 'Bookmark deleted successfully');
});
exports.getLastReadHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const data = await (0, quran_service_1.getLastRead)(userId);
    (0, response_1.sendSuccess)(res, data, 'Last read position retrieved successfully');
});
exports.updateLastReadHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { surahId, ayahNumber, page } = req.body;
    const data = await (0, quran_service_1.updateLastRead)(userId, surahId, ayahNumber, page);
    (0, response_1.sendSuccess)(res, data, 'Last read position updated successfully');
});
exports.listReadingHistoryHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { page, limit } = req.query;
    const result = await (0, quran_service_1.listReadingHistory)(userId, page, limit);
    (0, response_1.sendPaginated)(res, result.items, result.meta, 'Reading history retrieved successfully');
});
exports.recordReadingHistoryHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { surahId, ayahFrom, ayahTo, page } = req.body;
    const data = await (0, quran_service_1.recordReadingHistory)(userId, surahId, ayahFrom, ayahTo, page);
    (0, response_1.sendSuccess)(res, data, 'Reading session recorded successfully', config_1.HttpStatus.CREATED);
});
exports.getKhatmahHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const data = await (0, quran_service_1.getKhatmah)(userId);
    (0, response_1.sendSuccess)(res, data, 'Khatmah progress retrieved successfully');
});
exports.updateKhatmahHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { surahId, page, pagesRead } = req.body;
    const data = await (0, quran_service_1.updateKhatmah)(userId, surahId, page, pagesRead ?? 1);
    (0, response_1.sendSuccess)(res, data, 'Khatmah progress updated successfully');
});
//# sourceMappingURL=quran.controller.js.map