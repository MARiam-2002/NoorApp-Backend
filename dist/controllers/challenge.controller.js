"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getToday = exports.claimToday = exports.claimChallengeHandler = exports.getChallengeById = exports.getChallenges = void 0;
const config_1 = require("../config");
const errors_1 = require("../lib/errors");
const common_1 = require("../middleware/common");
const challenge_service_1 = require("../services/challenge.service");
function sendSuccess(res, data, message, statusCode = config_1.HttpStatus.OK) {
    return res.status(statusCode).json((0, common_1.successResponse)(message, data));
}
exports.getChallenges = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, challenge_service_1.getAllChallenges)(userId);
    sendSuccess(res, data, 'Challenges retrieved successfully');
});
exports.getChallengeById = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    const data = await (0, challenge_service_1.getChallengeByDay)(userId, Number(id));
    if (!data) {
        throw new errors_1.AppError('Challenge not found', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    sendSuccess(res, data, 'Challenge retrieved successfully');
});
exports.claimChallengeHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const { id } = req.params;
    const data = await (0, challenge_service_1.claimChallenge)(userId, id);
    sendSuccess(res, data, 'Challenge reward claimed successfully');
});
exports.claimToday = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const today = await (0, challenge_service_1.getTodayChallenge)(userId);
    if (!today) {
        throw new errors_1.AppError('No challenge available today', config_1.HttpStatus.NOT_FOUND, config_1.ErrorCodes.NOT_FOUND);
    }
    const data = await (0, challenge_service_1.claimChallenge)(userId, today.dayOfYear.toString());
    sendSuccess(res, data, 'Challenge reward claimed successfully');
});
exports.getToday = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user?.sub;
    if (!userId) {
        throw new errors_1.AppError('Authentication required', config_1.HttpStatus.UNAUTHORIZED, config_1.ErrorCodes.UNAUTHORIZED);
    }
    const data = await (0, challenge_service_1.getTodayChallenge)(userId);
    sendSuccess(res, data, 'Daily challenge retrieved successfully');
});
//# sourceMappingURL=challenge.controller.js.map