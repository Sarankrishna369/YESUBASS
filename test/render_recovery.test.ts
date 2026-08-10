import { YesubassClient } from '../src/utils/YesubassClient';
import { LavalinkManager } from '../src/player/LavalinkManager';
import { YesubassPlayer } from '../src/player/PlayerManager';
import { QueueManager } from '../src/player/QueueManager';

// Mock Shoukaku
jest.mock('shoukaku', () => {
    const EventEmitter = require('events');
    class MockNode extends EventEmitter {
        name = 'TestNode';
        state = 0; // 0 = CONNECTING
        connect = jest.fn().mockImplementation(() => {
            this.state = 0;
        });
    }
    class MockPlayer extends EventEmitter {
        node = new MockNode();
        playTrack = jest.fn().mockResolvedValue(undefined);
    }
    class MockShoukaku extends EventEmitter {
        nodes = new Map();
        options = {
            nodeResolver: () => Array.from(this.nodes.values()).find(n => n.state === 1)
        };
        constructor() {
            super();
            const node = new MockNode();
            this.nodes.set('TestNode', node);
        }
        joinVoiceChannel = jest.fn().mockResolvedValue(new MockPlayer());
        leaveVoiceChannel = jest.fn();
    }
    return {
        Shoukaku: MockShoukaku,
        Connectors: { DiscordJS: class {} }
    };
});

describe('Render Recovery Integration Test', () => {
    let client: any;
    let manager: LavalinkManager;

    beforeEach(() => {
        jest.useFakeTimers();
        client = new YesubassClient();
        manager = new LavalinkManager(client);
        client.lavalink = manager;
        
        // Mock text channel fetch for messages
        client.channels = {
            fetch: jest.fn().mockResolvedValue({ send: jest.fn() })
        };
    });

    afterEach(() => {
        jest.clearAllTimers();
        jest.useRealTimers();
    });

    it('simulates the full Lavalink recovery pipeline', async () => {
        const states: number[] = [0]; // starts at CONNECTING (0)
        
        const testNode = manager.shoukaku.nodes.get('TestNode') as any;
        
        // Proxy state property to record transitions
        let _state = testNode.state;
        Object.defineProperty(testNode, 'state', {
            get: () => _state,
            set: (v) => {
                if (states[states.length - 1] !== v) states.push(v);
                _state = v;
            }
        });

        try {
            // Stage 1 & 2: Bot starts & Discord Connects (mocked via client init)
            // Stage 3: Lavalink connects
            testNode.state = 1; // CONNECTED
            (manager.shoukaku.emit as any)('ready', 'TestNode');
            if (testNode.state !== 1) throw new Error('Stage 3 Failed: Node did not become CONNECTED');

            // Stage 4: Play a song
            const mockPlayer = new YesubassPlayer(client, await client.lavalink.shoukaku.joinVoiceChannel({} as any), 'guild1', 'text1', 'voice1');
            client.players.set('guild1', mockPlayer);
            await mockPlayer.playTrack({ track: { encoded: 'base64' } as any, requester: {} as any });
            
            // Simulate position update
            (mockPlayer.player.emit as any)('update', { state: { position: 15000 } });
            if (mockPlayer.lastPosition !== 15000) throw new Error('Stage 4 Failed: Position was not tracked properly');

            // Stage 5: Disconnect Lavalink
            testNode.state = 3; // DISCONNECTED
            (manager.shoukaku.emit as any)('close', 'TestNode', 1006, 'Abnormal closure');
            if (testNode.state !== 3) throw new Error('Stage 5 Failed: Node did not become DISCONNECTED');

            // Mock player close due to Lavalink crash
            (mockPlayer.player.emit as any)('closed', { code: 1006, reason: 'Node disconnected' });
            if (!client.players.has('guild1')) throw new Error('Stage 5 Failed: Queue was destroyed incorrectly');

            // Stage 6: Watchdog detects failure
            jest.advanceTimersByTime(30000);
            if (testNode.connect.mock.calls.length === 0) throw new Error('Stage 6 Failed: Watchdog did not call node.connect()');
            if (testNode.state !== 0) throw new Error('Stage 6 Failed: Node did not transition to CONNECTING');

            // Stage 7: Reconnect Lavalink
            testNode.state = 1; // CONNECTED
            (manager.shoukaku.emit as any)('ready', 'TestNode');

            // Await next tick for promises to resolve
            await Promise.resolve();

            // Stage 8: Verify node state changes
            const expectedStates = [0, 1, 3, 0, 1]; // CONNECTING, CONNECTED, DISCONNECTED, CONNECTING, CONNECTED
            if (JSON.stringify(states) !== JSON.stringify(expectedStates)) {
                throw new Error(`Stage 8 Failed: State transition mismatch. Expected ${expectedStates}, got ${states}`);
            }

            // Stage 9: Verify resume and /play works again
            const playTrackMock = mockPlayer.player.playTrack as jest.Mock;
            if (playTrackMock.mock.calls.length < 2) {
                throw new Error('Stage 9 Failed: player.recover() did not call playTrack again');
            }
            
            const resumeArgs = playTrackMock.mock.calls[1][0];
            if (resumeArgs.position !== 15000) {
                throw new Error(`Stage 9 Failed: Playback did not resume at the correct position (Expected 15000, got ${resumeArgs.position})`);
            }

        } catch (error: any) {
            console.error(error.message);
            throw error; // Fail the test
        }
    });
});
