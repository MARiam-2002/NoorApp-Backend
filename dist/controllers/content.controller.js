"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDailyChallengeHandler = exports.getHadithOfDayHandler = exports.getVerseOfDayHandler = void 0;
const config_1 = require("../config");
const common_1 = require("../middleware/common");
const content_service_1 = require("../services/content.service");
function sendSuccess(res, data, message, statusCode = config_1.HttpStatus.OK) {
    return res.status(statusCode).json((0, common_1.successResponse)(message, data));
}
exports.getVerseOfDayHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { day } = req.query;
    const dayNum = day ? Number(day) : undefined;
    const data = dayNum ? await (0, content_service_1.getVerseOfDayByDay)(dayNum) : await (0, content_service_1.getVerseOfDay)();
    sendSuccess(res, data, 'Verse of the day retrieved successfully');
});
exports.getHadithOfDayHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { day } = req.query;
    const dayNum = day ? Number(day) : undefined;
    const data = dayNum ? await (0, content_service_1.getHadithOfDayByDay)(dayNum) : await (0, content_service_1.getHadithOfDay)();
    sendSuccess(res, data, 'Hadith of the day retrieved successfully');
});
exports.getDailyChallengeHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { day } = req.query;
    const dayNum = day ? Number(day) : undefined;
    const data = dayNum ? await (0, content_service_1.getDailyChallengeByDay)(dayNum) : await (0, content_service_1.getDailyChallenge)();
    sendSuccess(res, data, 'Daily challenge retrieved successfully');
});
//# sourceMappingURL=content.controller.js.map