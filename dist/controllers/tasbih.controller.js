"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getHistoryHandler = exports.changeDhikrHandler = exports.resetTodayHandler = exports.incrementHandler = exports.getTodayHandler = void 0;
const common_1 = require("../middleware/common");
const tasbih_service_1 = require("../services/tasbih.service");
exports.getTodayHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const result = await (0, tasbih_service_1.getTodayTasbih)(userId);
    (0, common_1.sendSuccess)(res, {
        ...result,
        dhikrAr: (0, tasbih_service_1.getDhikrArName)(result.dhikr),
    }, 'Today tasbih retrieved successfully');
});
exports.incrementHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { amount } = req.body;
    const result = await (0, tasbih_service_1.incrementTasbih)(userId, amount ?? 1);
    (0, common_1.sendSuccess)(res, {
        ...result,
        dhikrAr: (0, tasbih_service_1.getDhikrArName)(result.dhikr),
    }, 'Tasbih incremented successfully');
});
exports.resetTodayHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const result = await (0, tasbih_service_1.resetTasbih)(userId);
    (0, common_1.sendSuccess)(res, {
        ...result,
        dhikrAr: (0, tasbih_service_1.getDhikrArName)(result.dhikr),
    }, 'Today tasbih reset successfully');
});
exports.changeDhikrHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { dhikr } = req.body;
    const result = await (0, tasbih_service_1.changeDhikr)(userId, dhikr);
    (0, common_1.sendSuccess)(res, {
        ...result,
        dhikrAr: (0, tasbih_service_1.getDhikrArName)(result.dhikr),
    }, 'Dhikr changed successfully');
});
exports.getHistoryHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const { limit } = req.query;
    const history = await (0, tasbih_service_1.getTasbihHistory)(userId, limit ?? 30);
    (0, common_1.sendSuccess)(res, history.map((log) => ({
        ...log,
        dhikrAr: (0, tasbih_service_1.getDhikrArName)(log.dhikr),
    })), 'Tasbih history retrieved successfully');
});
//# sourceMappingURL=tasbih.controller.js.map