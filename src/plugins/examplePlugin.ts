import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default (client: YesubassClient) => {
    logger.info('Initializing Example Plugin...');

    client.on('messageCreate', (message) => {
        if (message.content === '!ping') {
            message.reply('Pong! (From Plugin)');
        }
    });
};
