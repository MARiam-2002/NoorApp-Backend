import winston from 'winston';
import { appConfig, env } from '../config';

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

const consoleFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const metaEntries = { ...meta };
  delete metaEntries.service;
  const metaString = Object.keys(metaEntries).length ? ` ${JSON.stringify(metaEntries)}` : '';
  const output = stack ?? message;
  return `${String(ts)} [${String(level)}]: ${String(output)}${metaString}`;
});

export const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'noor-api' },
  transports: [
    new winston.transports.Console({
      format: appConfig.isProduction
        ? combine(timestamp(), errors({ stack: true }), json())
        : combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            errors({ stack: true }),
            consoleFormat,
          ),
    }),
  ],
});

export const morganStream = {
  write: (message: string): void => {
    logger.http(message.trim());
  },
};
