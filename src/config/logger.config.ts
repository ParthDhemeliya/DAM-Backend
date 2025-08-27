import winston from 'winston';
import path from 'path';

// Define log levels
const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const logColors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(logColors);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    info => `${info.timestamp} ${info.level}: ${info.message}`
  )
);

// Define file log format (without colors)
const fileLogFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Create the logger
const logger = winston.createLogger({
  levels: logLevels,
  level: process.env.LOG_LEVEL || 'info',
  format: fileLogFormat,
  transports: [
    // Console transport
    new winston.transports.Console({
      format: logFormat,
    }),

    // Error log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Background jobs specific log file
    new winston.transports.File({
      filename: path.join(logsDir, 'background-jobs.log'),
      level: 'info',
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    }),
  ],
});

// Create a stream object for Morgan HTTP logging
export const logStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Create specialized loggers for different components
export const createComponentLogger = (component: string) => {
  return {
    info: (message: string, meta?: any) => {
      logger.info(`[${component}] ${message}`, meta);
    },
    error: (message: string, meta?: any) => {
      logger.error(`[${component}] ${message}`, meta);
    },
    warn: (message: string, meta?: any) => {
      logger.warn(`[${component}] ${message}`, meta);
    },
    debug: (message: string, meta?: any) => {
      logger.debug(`[${component}] ${message}`, meta);
    },
    http: (message: string, meta?: any) => {
      logger.http(`[${component}] ${message}`, meta);
    },
  };
};

// Create specific loggers for background job components
export const backgroundJobLogger = createComponentLogger('BackgroundJobs');
export const thumbnailWorkerLogger = createComponentLogger('ThumbnailWorker');
export const metadataWorkerLogger = createComponentLogger('MetadataWorker');
export const conversionWorkerLogger = createComponentLogger('ConversionWorker');
export const cleanupWorkerLogger = createComponentLogger('CleanupWorker');
export const videoWorkerLogger = createComponentLogger('VideoWorker');
export const queueLogger = createComponentLogger('Queue');

export default logger;
