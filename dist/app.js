"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
exports.initializeApp = initializeApp;
const express_1 = __importDefault(require("express"));
const config_1 = require("./config");
const common_1 = require("./middleware/common");
const prisma_1 = require("./lib/prisma");
const http_1 = require("./middleware/http");
const swagger_1 = require("./lib/swagger");
const routes_1 = require("./routes");
function createApp() {
    const app = (0, express_1.default)();
    app.use(common_1.requestIdMiddleware);
    (0, http_1.applySecurityMiddlewares)(app);
    app.use(http_1.httpLogger);
    app.use(express_1.default.json({ limit: '10mb' }));
    app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
    // Root redirect to documentation
    app.get('/', (_req, res) => {
        res.redirect(`${config_1.appConfig.apiPrefix}/docs`);
    });
    app.use(config_1.appConfig.apiPrefix, http_1.apiRateLimiter, routes_1.v1Router);
    (0, swagger_1.setupSwagger)(app);
    app.use(common_1.notFoundHandler);
    app.use(common_1.errorHandler);
    return app;
}
async function initializeApp() {
    await (0, prisma_1.connectDatabase)();
    return createApp();
}
// Default export - Express app handles all requests
exports.default = createApp;
//# sourceMappingURL=app.js.map