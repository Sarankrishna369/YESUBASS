import { Connectors, NodeOption, Shoukaku } from 'shoukaku';
import { YesubassClient } from '../utils/YesubassClient';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export class LavalinkManager {
    public shoukaku: Shoukaku;

    constructor(client: YesubassClient) {
        const nodes: NodeOption[] = config.lavalink.map((node) => ({
            name: node.name,
            url: node.url,
            auth: node.auth,
            secure: node.secure,
        }));

        this.shoukaku = new Shoukaku(new Connectors.DiscordJS(client), nodes, {
            moveOnDisconnect: true,
            resume: true,
            resumeTimeout: 30,
            reconnectTries: 10,
            restTimeout: 15000,
        });

        this.shoukaku.on('ready', (name) => {
            logger.success(`Lavalink node ${name} is ready and connected!`);
        });

        this.shoukaku.on('error', (name, error) => {
            logger.error(`Lavalink node ${name} encountered an error:`, error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            logger.warn(`Lavalink node ${name} closed with code ${code}. Reason: ${reason || 'No reason'}`);
        });

        this.shoukaku.on('disconnect', (name, count) => {
            logger.warn(`Lavalink node ${name} disconnected. Reconnected players: ${count}`);
        });
    }
}
