import winston from 'winston';
import path from 'path';
import fs from 'fs';

const logDir = path.join(__dirname, '..', '..', 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}

const { combine, timestamp, printf, colorize } = winston.format;

const myFormat = printf(({ level, message, timestamp, ...metadata }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(metadata).length > 0) {
        msg += ` ${JSON.stringify(metadata)}`;
    }
    return msg;
});

const _logger = winston.createLogger({
    level: 'info',
    format: combine(
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.json()
    ),
    transports: [
        new winston.transports.File({ filename: path.join(logDir, 'error.log'), level: 'error' }),
        new winston.transports.File({ filename: path.join(logDir, 'combined.log') }),
    ],
});

if (process.env.NODE_ENV !== 'production') {
    _logger.add(new winston.transports.Console({
        format: combine(
            colorize(),
            timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
            myFormat
        )
    }));
}

export const logger = {
    info: (message: string, ...args: any[]) => _logger.info(message, ...args),
    error: (message: string, ...args: any[]) => _logger.error(message, ...args),
    warn: (message: string, ...args: any[]) => _logger.warn(message, ...args),
    success: (message: string, ...args: any[]) => _logger.info(`✅ ${message}`, ...args),
};
