import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';

// logs/error, logs/warn, logs/info folders
const logDir = 'logs';
['error', 'warn', 'info'].forEach((folder) => {
  const fullPath = path.join(logDir, folder);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

// JSON file log format
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Colorful console logs
const consoleLogFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ level, message, timestamp, stack }) =>
    stack
      ? `${timestamp} [${level}]: ${message}\n${stack}`
      : `${timestamp} [${level}]: ${message}`
  )
);

// Typed rotating file creator
const dailyRotateTransport = (
  filenamePrefix: string,
  level: string
): DailyRotateFile => {
  return new DailyRotateFile({
    dirname: path.join(logDir, level),
    filename: `${filenamePrefix}-%DATE%.log`,
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d',
    level,
    format: fileLogFormat,
  });
};

const logger = winston.createLogger({
  level: 'info',
  transports: [
    dailyRotateTransport('error', 'error'),
    dailyRotateTransport('warn', 'warn'),
    dailyRotateTransport('combined', 'info'),
    new winston.transports.Console({
      format: consoleLogFormat,
    }),
  ],
  exitOnError: false,
});

export default logger;
