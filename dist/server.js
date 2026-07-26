"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("./load-env");
const config_1 = require("./config");
const app_1 = require("./app");
const logger_1 = require("./lib/logger");
const prisma_1 = require("./lib/prisma");
async function bootstrap() {
    const app = await (0, app_1.initializeApp)();
    const server = app.listen(config_1.appConfig.port, () => {
        logger_1.logger.info(`Noor API running on port ${config_1.appConfig.port}`, {
            environment: config_1.appConfig.nodeEnv,
            apiBasePath: (0, config_1.getApiBasePath)(),
            docs: `${(0, config_1.getApiBasePath)()}/docs`,
        });
    });
    const shutdown = (signal) => {
        logger_1.logger.info(`${signal} received. Shutting down gracefully...`);
        server.close(() => {
            void (0, prisma_1.disconnectDatabase)().then(() => {
                logger_1.logger.info('Server closed');
                process.exit(0);
            });
        });
        setTimeout(() => {
            logger_1.logger.error('Forced shutdown after timeout');
            process.exit(1);
        }, 10_000).unref();
    };
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
}
bootstrap().catch((error) => {
    logger_1.logger.error('Failed to start server', { error });
    process.exit(1);
});
//# sourceMappingURL=server.js.map