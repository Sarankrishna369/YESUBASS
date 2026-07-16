import { YesubassClient } from './utils/YesubassClient';
import { logger } from './utils/logger';

const client = new YesubassClient();

client.start().catch((err) => {
    logger.error('Failed to start the bot', err);
});

const gracefulShutdown = async (signal: string) => {
    logger.warn(`Received ${signal}. Starting graceful shutdown...`);
    logger.info('Disconnecting client...');
    client.destroy();
    process.exit(0);
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
