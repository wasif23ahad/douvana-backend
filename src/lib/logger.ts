import winston from 'winston';
import path from 'path';

const { combine, timestamp, printf, colorize, json } = winston.format;

// Custom format for console logging
const consoleFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} [${level}]: ${message}`;
});

const isProduction = process.env.NODE_ENV === 'production';
const isVercel = process.env.VERCEL === '1';

// Create the logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    isProduction ? json() : consoleFormat
  ),
  transports: [
    new winston.transports.Console({
      format: isProduction 
        ? combine(timestamp(), json()) 
        : combine(colorize(), timestamp({ format: 'HH:mm:ss' }), consoleFormat)
    })
  ],
});

// Only add file transports if NOT in production AND NOT on Vercel
if (!isProduction && !isVercel) {
  logger.add(new winston.transports.File({ 
    filename: path.join('logs', 'error.log'), 
    level: 'error' 
  }));
  logger.add(new winston.transports.File({ 
    filename: path.join('logs', 'combined.log') 
  }));
}

export default logger;