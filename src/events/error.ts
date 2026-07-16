import { Events } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default {
    name: Events.Error,
    execute: (error: Error, _client: YesubassClient) => {
        logger.error('Discord Client Error:', error);
    }
};

// Global error handlers to prevent crashing
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
});
