import { Player } from 'shoukaku';
import { QueueManager, QueuedTrack } from './QueueManager';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';
import { TextChannel } from 'discord.js';
import { buildNowPlayingEmbed } from '../utils/embeds';
import { Mutex } from '../utils/Mutex';

export class YesubassPlayer {
    public player: Player;
    public queue: QueueManager;
    public client: YesubassClient;
    public guildId: string;
    public textChannelId: string;
    public voiceChannelId: string;
    public leaveTimeout: NodeJS.Timeout | null = null;
    public processMutex: Mutex = new Mutex();

    constructor(client: YesubassClient, player: Player, guildId: string, textChannelId: string, voiceChannelId: string) {
        this.client = client;
        this.player = player;
        this.queue = new QueueManager();
        this.guildId = guildId;
        this.textChannelId = textChannelId;
        this.voiceChannelId = voiceChannelId;

        this.setupEvents();
    }

    private setupEvents() {
        this.player.on('start', () => {
            if (this.queue.current) {
                logger.info(`Started playing in ${this.guildId}`);
                this.sendNowPlaying();
            }
        });

        this.player.on('end', async (_data) => {
            if (this.queue.loopTrack && this.queue.current) {
                this.playTrack(this.queue.current);
                return;
            }

            if (this.queue.current && this.queue.loopQueue) {
                this.queue.add({ track: this.queue.current.track, requester: this.queue.current.requester });
            }

            this.queue.current = null;
            await this.playNext();
        });

        this.player.on('closed', (_data) => {
            logger.warn(`Player closed in ${this.guildId}`, _data);
            this.destroy();
        });

        this.player.on('exception', (_data) => {
            logger.error(`Player exception in ${this.guildId}`, _data);
            this.sendMessage('⚠️ **Error:** An exception occurred while playing the track.');
            this.playNext();
        });
    }

    public async playTrack(queuedTrack: QueuedTrack) {
        this.queue.current = queuedTrack;
        await this.player.playTrack({ track: { encoded: queuedTrack.track.encoded } });
    }

    public async playNext() {
        const unlock = await this.processMutex.lock();
        try {
            const next = this.queue.tracks.shift();
            if (next) {
                await this.playTrack(next);
            } else {
                this.sendMessage('Queue ended. Add more songs to keep the party going!');
            }
        } catch (err) {
            logger.error(`Error in playNext for ${this.guildId}`, err);
            this.sendMessage('⚠️ An error occurred while trying to play the next track. Skipping...');
            // Try to recover by playing the next track
            if (this.queue.tracks.length > 0) {
                const recoveryNext = this.queue.tracks.shift();
                if (recoveryNext) await this.playTrack(recoveryNext);
            }
        } finally {
            unlock();
        }
    }

    public async destroy() {
        this.queue.clear();
        await this.client.lavalink.shoukaku.leaveVoiceChannel(this.guildId);
        this.client.players.delete(this.guildId);
    }

    private async sendMessage(content: string) {
        try {
            const channel = await this.client.channels.fetch(this.textChannelId) as TextChannel;
            if (channel) await channel.send(content);
        } catch (err) {
            logger.error(`Could not send message to ${this.textChannelId}`, err);
        }
    }

    private async sendNowPlaying() {
        try {
            const channel = await this.client.channels.fetch(this.textChannelId) as TextChannel;
            if (channel && this.queue.current) {
                const { embeds, components } = buildNowPlayingEmbed(this, this.queue.current);
                await channel.send({ embeds, components });
            }
        } catch (err) {
            logger.error(`Could not send now playing message to ${this.textChannelId}`, err);
        }
    }
}
