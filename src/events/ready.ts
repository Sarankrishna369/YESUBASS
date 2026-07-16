import { ActivityType, Events } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default {
    name: Events.ClientReady,
    once: true,
    execute: async (client: YesubassClient) => {
        logger.success(`Logged in as ${client.user?.tag}!`);

        client.user?.setActivity('/play', { type: ActivityType.Listening });

        // Register slash commands automatically
        const commands = client.commands.map(cmd => cmd.data.toJSON());
        try {
            await client.application?.commands.set(commands);
            logger.info('Successfully registered global slash commands.');
        } catch (error) {
            logger.error('Failed to register slash commands:', error);
        }
    }
};
