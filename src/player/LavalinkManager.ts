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
            nodeResolver: (nodesMap) => {
                const nodesArray = Array.from(nodesMap.values());
                if (nodesArray.length === 0) {
                    logger.warn('nodeResolver: Returning undefined because no nodes are configured in Shoukaku.');
                    return undefined;
                }
                
                // state 1 = CONNECTED
                const availableNodes = nodesArray.filter(node => node.state === 1);
                
                if (availableNodes.length === 0) {
                    const states = nodesArray.map(n => `${n.name} (state: ${n.state})`).join(', ');
                    logger.warn(`nodeResolver: Returning undefined. All nodes are unavailable. Current node states: ${states}`);
                    return undefined;
                }
                
                logger.info(`nodeResolver: Found ${availableNodes.length} healthy node(s)`);
                return availableNodes.sort((a, b) => a.penalties - b.penalties)[0];
            }
        });

        this.shoukaku.on('ready', (name) => {
            logger.success(`Lavalink node ${name} emitted ready event (CONNECTED)!`);
            
            // Recover players that were preserved during a connection drop
            for (const player of client.players.values()) {
                if (player.needsRecovery && player.queue.current) {
                    player.recover();
                }
            }
        });

        this.shoukaku.on('error', (name, error) => {
            logger.error(`Lavalink node ${name} encountered an error:`, error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            logger.warn(`Lavalink node ${name} closed websocket with code ${code}. Reason: ${reason || 'No reason'}`);
        });

        this.shoukaku.on('disconnect', (name, count) => {
            logger.warn(`Lavalink node ${name} triggered disconnect event. Reconnected players moved: ${count}`);
        });

        // Connection Watchdog
        setInterval(() => {
            if (this.shoukaku.nodes.size === 0) return;
            
            let allDisconnected = true;
            for (const node of this.shoukaku.nodes.values()) {
                // state 1 = CONNECTED, state 0 = CONNECTING
                if (node.state === 1 || node.state === 0) {
                    allDisconnected = false;
                    break;
                }
            }

            if (allDisconnected) {
                logger.warn('Watchdog: All Lavalink nodes are completely disconnected. Attempting to trigger manual reconnect...');
                for (const node of this.shoukaku.nodes.values()) {
                    // state 3 = DISCONNECTED, state 2 = DISCONNECTING
                    if (node.state === 3 || node.state === 2) {
                        try {
                            node.connect();
                            logger.info(`Watchdog: Triggered connect() on dead node ${node.name}`);
                        } catch (err) {
                            logger.error(`Watchdog: Failed to trigger connect() on node ${node.name}`, err);
                        }
                    }
                }
            }
        }, 30000);
    }
}
