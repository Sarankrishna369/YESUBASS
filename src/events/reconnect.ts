import { Events } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default {
    name: Events.ClientReady, // This will be run on Ready, we'll setup reconnect logic
    once: true,
    async execute(client: YesubassClient) {
        // Voice State Reconnect Logic is usually handled by Kazagumo/Shoukaku automatically,
        // but we can add additional safeguards here if the bot reconnects to Discord Gateway.

        client.on(Events.ShardResume, (id, replayedEvents) => {
            logger.info(`Shard ${id} resumed. Replayed ${replayedEvents} events.`);
            // Shoukaku handles re-sending voice updates to Lavalink.
        });

        client.on(Events.ShardDisconnect, (event, id) => {
            logger.warn(`Shard ${id} disconnected: ${event.reason}`);
        });
    }
};
