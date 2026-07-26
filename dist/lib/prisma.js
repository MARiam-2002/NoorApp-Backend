"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
exports.connectDatabase = connectDatabase;
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const config_1 = require("../config");
const logger_1 = require("./logger");
function createPrismaClient() {
    return new client_1.PrismaClient({
        log: config_1.appConfig.isDevelopment
            ? [
                { emit: 'event', level: 'query' },
                { emit: 'stdout', level: 'error' },
                { emit: 'stdout', level: 'warn' },
            ]
            : [{ emit: 'stdout', level: 'error' }],
    });
}
exports.prisma = globalThis.__prisma ?? createPrismaClient();
if (!config_1.appConfig.isProduction) {
    globalThis.__prisma = exports.prisma;
}
async function connectDatabase() {
    try {
        await exports.prisma.$connect();
        logger_1.logger.info('Database connected successfully');
    }
    catch (error) {
        logger_1.logger.error('Failed to connect to database', { error });
        throw error;
    }
}
async function disconnectDatabase() {
    await exports.prisma.$disconnect();
    logger_1.logger.info('Database disconnected');
}
//# sourceMappingURL=prisma.js.map