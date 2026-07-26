"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.morganStream = exports.logger = void 0;
const winston_1 = __importDefault(require("winston"));
const config_1 = require("../config");
const { combine, timestamp, printf, colorize, errors, json } = winston_1.default.format;
const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
    const metaEntries = { ...meta };
    delete metaEntries.service;
    const metaString = Object.keys(metaEntries).length ? ` ${JSON.stringify(metaEntries)}` : '';
    const output = stack ?? message;
    return `${String(ts)} [${String(level)}]: ${String(output)}${metaString}`;
});
exports.logger = winston_1.default.createLogger({
    level: config_1.env.LOG_LEVEL,
    defaultMeta: { service: 'noor-api' },
    transports: [
        new winston_1.default.transports.Console({
            format: config_1.appConfig.isProduction
                ? combine(timestamp(), errors({ stack: true }), json())
                : combine(colorize(), timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), errors({ stack: true }), consoleFormat),
        }),
    ],
});
exports.morganStream = {
    write: (message) => {
        exports.logger.http(message.trim());
    },
};
//# sourceMappingURL=logger.js.map