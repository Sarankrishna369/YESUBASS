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
        console.log(`[LAVALINK CONFIG] Node count: ${config.lavalink.length}`);
        console.log(`[LAVALINK CONFIG] Node names: ${config.lavalink.map(n => n.name).join(', ')}`);
        
        console.log('[SHOUKAKU INIT] Input node count:', nodes.length);
        console.log('[SHOUKAKU INIT] Input node names:', nodes.map(n => n.name).join(', '));
        console.log('[SHOUKAKU INIT] Node URLs:', nodes.map(n => n.url).join(', '));

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

        console.log('[SHOUKAKU INIT] Internal node count (sync check):', this.shoukaku.nodes.size);
        console.log('[SHOUKAKU INIT] Internal node names (sync check):', Array.from(this.shoukaku.nodes.values()).map(n => n.name).join(', '));

        this.shoukaku.on('ready', (name) => {
            console.log(`[LAVALINK READY] ${name}`);
            logger.success(`Lavalink node ${name} emitted ready event (CONNECTED)!`);
            console.log(`[SHOUKAKU LIFECYCLE] Node ${name} is now in shoukaku.nodes. Current size: ${this.shoukaku.nodes.size}`);
            
            // Recover players that were preserved during a connection drop
            for (const player of client.players.values()) {
                if (player.needsRecovery && player.queue.current) {
                    player.recover();
                }
            }
        });

        this.shoukaku.on('error', (name, error) => {
            console.log(`[LAVALINK ERROR] ${name}: ${error.message || error}`);
            logger.error(`Lavalink node ${name} encountered an error:`, error);
        });

        this.shoukaku.on('close', (name, code, reason) => {
            console.log(`[LAVALINK CLOSE] ${name} code=${code} reason=${reason || 'No reason'}`);
            logger.warn(`Lavalink node ${name} closed websocket with code ${code}. Reason: ${reason || 'No reason'}`);
        });

        this.shoukaku.on('disconnect', (name, count) => {
            console.log(`[LAVALINK DISCONNECT] ${name}`);
            logger.warn(`Lavalink node ${name} triggered disconnect event. Reconnected players moved: ${count}`);
        });

        this.shoukaku.on('debug', (name, info) => {
            console.log(`[LAVALINK DEBUG] ${name}: ${info}`);
            // console.log(`[SHOUKAKU DEBUG] ${name}: ${info}`);
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
