import express from 'express';
import { logger } from './logger';
import { config } from '../config/config';

export function startApiServer() {
    const app = express();

    app.get('/', (req, res) => {
        res.send('YESUBASS V2 is running!');
    });

    app.get('/health', (req, res) => {
        res.status(200).json({ status: 'UP', timestamp: Date.now() });
    });

    app.get('/metrics', (req, res) => {
        const memory = process.memoryUsage();
        res.status(200).json({
            memory: {
                rss: `${Math.round(memory.rss / 1024 / 1024)} MB`,
                heapTotal: `${Math.round(memory.heapTotal / 1024 / 1024)} MB`,
                heapUsed: `${Math.round(memory.heapUsed / 1024 / 1024)} MB`,
            },
            uptime: process.uptime()
        });
    });

    app.listen(config.port, () => {
        logger.success(`Keep-alive server listening on port ${config.port}`);
    });
}
