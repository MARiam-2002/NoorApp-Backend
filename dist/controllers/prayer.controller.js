"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getSchedule = exports.markPrayerHandler = exports.getToday = void 0;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const common_1 = require("../middleware/common");
const prayer_service_1 = require("../services/prayer.service");
function sendSuccess(res, data, message, statusCode = config_1.HttpStatus.OK) {
    return res.status(statusCode).json((0, common_1.successResponse)(message, data));
}
exports.getToday = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, prayer_service_1.getTodayPrayers)(userId);
    sendSuccess(res, data, 'Prayer schedule retrieved successfully');
});
exports.markPrayerHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    const data = await (0, prayer_service_1.markPrayer)(userId, id);
    sendSuccess(res, data, 'Prayer status updated successfully');
});
exports.getSchedule = (0, common_1.asyncHandler)(async (req, res) => {
    const { latitude, longitude, timezone, date } = req.query;
    const lat = latitude ? Number(latitude) : undefined;
    const lng = longitude ? Number(longitude) : undefined;
    const data = await (0, prayer_service_1.getPrayerSchedule)(lat, lng, timezone, date);
    sendSuccess(res, data, 'Prayer schedule calculated successfully');
});
//# sourceMappingURL=prayer.controller.js.map