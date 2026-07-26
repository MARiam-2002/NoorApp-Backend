"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMyQiblaHandler = exports.calculateQiblaHandler = void 0;
const common_1 = require("../middleware/common");
const response_1 = require("../shared/utils/response");
const qibla_service_1 = require("../services/qibla.service");
exports.calculateQiblaHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const { latitude, longitude } = req.query;
    const data = (0, qibla_service_1.calculateQibla)(Number(latitude), Number(longitude));
    (0, response_1.sendSuccess)(res, data, 'Qibla direction calculated successfully');
});
exports.getMyQiblaHandler = (0, common_1.asyncHandler)(async (req, res) => {
    const userId = req.user.sub;
    const data = await (0, qibla_service_1.getMyQibla)(userId);
    (0, response_1.sendSuccess)(res, data, 'Your Qibla direction retrieved successfully');
});
//# sourceMappingURL=qibla.controller.js.map