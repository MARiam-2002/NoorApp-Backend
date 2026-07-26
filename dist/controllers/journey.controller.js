"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSadaqahHandler = exports.updateAdhkarHandler = exports.incrementQuranPagesHandler = exports.updateQuranPagesHandler = exports.getProgress = exports.getToday = void 0;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const common_1 = require("../middleware/common");
const journey_service_1 = require("../services/journey.service");
function sendSuccess(res, data, message, statusCode = config_1.HttpStatus.OK) {
    return res.status(statusCode).json((0, common_1.successResponse)(message, data));
}
exports.getToday = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, journey_service_1.getTodayJourney)(userId);
    sendSuccess(res, data, 'Daily journey retrieved successfully');
});
exports.getProgress = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { days } = req.query;
    const daysNum = days ? Number(days) : 7;
    const data = await (0, journey_service_1.getJourneyProgress)(userId, daysNum);
    sendSuccess(res, data, 'Journey progress retrieved successfully');
});
exports.updateQuranPagesHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { pages } = req.body;
    const data = await (0, journey_service_1.updateQuranPages)(userId, pages);
    sendSuccess(res, data, 'Quran pages updated successfully');
});
exports.incrementQuranPagesHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { pages } = req.body;
    const data = await (0, journey_service_1.incrementQuranPages)(userId, pages);
    sendSuccess(res, data, 'Quran pages incremented successfully');
});
exports.updateAdhkarHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { completed } = req.body;
    const data = await (0, journey_service_1.updateAdhkar)(userId, completed);
    sendSuccess(res, data, 'Adhkar status updated successfully');
});
exports.updateSadaqahHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { amount } = req.body;
    const data = await (0, journey_service_1.updateSadaqah)(userId, amount);
    sendSuccess(res, data, 'Sadaqah updated successfully');
});
//# sourceMappingURL=journey.controller.js.map