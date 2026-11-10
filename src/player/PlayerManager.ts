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
    public lastPosition: number = 0;
    public needsRecovery: boolean = false;
    private isRecovering: boolean = false;
    public soundboardSavedState: { track: QueuedTrack; position: number } | null = null;
    public isPlayingSoundboard: boolean = false;

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
                if (!this.isPlayingSoundboard) {
                    this.sendNowPlaying();
                }
                this.client.emit('playerUpdate', this);
            }
        });

        this.player.on('update', (data: any) => {
            if (data?.state?.position) {
                this.lastPosition = data.state.position;
            }
        });

        this.player.on('end', async (_data: any) => {
            // Ignore replaced events to prevent race conditions during skip or track switching
            if (_data?.reason === 'replaced' || _data?.reason === 'REPLACED') {
                return;
            }

            // Handle soundboard interrupt resume
            if (this.isPlayingSoundboard) {
                this.isPlayingSoundboard = false;
                if (this.soundboardSavedState) {
                    const saved = this.soundboardSavedState;
                    this.soundboardSavedState = null;
                    this.queue.current = saved.track;
                    this.lastPosition = saved.position;
                    logger.info(`[Soundboard] Resuming previous track at ${saved.position}ms in ${this.guildId}`);
                    try {
                        await this.player.playTrack({ 
                            track: { encoded: saved.track.track.encoded },
                            position: saved.position
                        });
                    } catch (e) {
                        logger.error('[Soundboard] Failed to resume track after soundboard:', e);
                    }
                    this.client.emit('playerUpdate', this);
                    return;
                } else {
                    this.queue.current = null;
                    this.lastPosition = 0;
                    await this.playNext();
                    this.client.emit('playerUpdate', this);
                    return;
                }
            }

            if (this.queue.loopTrack && this.queue.current) {
                this.playTrack(this.queue.current);
                return;
            }

            if (this.queue.current && this.queue.loopQueue) {
                this.queue.add({ track: this.queue.current.track, requester: this.queue.current.requester });
            }

            this.queue.current = null;
            this.lastPosition = 0;
            await this.playNext();
            this.client.emit('playerUpdate', this);
        });

        this.player.on('closed', (_data: any) => {
            logger.warn(`Player closed event in ${this.guildId}:`, _data);
            
            // Discord Voice Code 4014: Channel move, region handover, or server routing.
            // Do NOT destroy the player because Discord is maintaining/switching the connection!
            if (_data && _data.code === 4014) {
                logger.info(`Voice region / handover event 4014 in ${this.guildId}. Keeping player alive.`);
                return;
            }

            // Only preserve if it's a confirmed Lavalink issue (abnormal closure)
            const isLavalinkIssue = _data && (_data.code === 1006 || _data.reason === 'Node disconnected');
            
            if (isLavalinkIssue) {
                logger.info(`Lavalink issue detected for ${this.guildId} (Code: ${_data?.code}). Preserving player state for recovery...`);
                this.needsRecovery = true;
                return;
            }

            // Only destroy if the bot is actually no longer in any voice channel in this guild
            const me = this.client.guilds.cache.get(this.guildId)?.members.me;
            if (!me?.voice?.channelId) {
                logger.info(`Bot is confirmed disconnected from voice in ${this.guildId}. Destroying player.`);
                this.destroy();
            } else {
                logger.info(`Bot is still in voice channel ${me.voice.channelId} in ${this.guildId}. Ignoring closed event.`);
            }
        });

        this.player.on('exception', (_data) => {
            logger.error(`Player exception in ${this.guildId}`, _data);
            this.sendMessage('⚠️ **Error:** An exception occurred while playing the track.');
            this.playNext();
            this.client.emit('playerUpdate', this);
        });
    }

    public async playTrack(queuedTrack: QueuedTrack) {
        this.isPlayingSoundboard = false;
        this.soundboardSavedState = null;
        this.queue.current = queuedTrack;
        this.lastPosition = 0;
        await this.player.playTrack({ track: { encoded: queuedTrack.track.encoded } });
        this.client.emit('playerUpdate', this);
    }

    public async playSoundboard(queuedTrack: QueuedTrack) {
        // If currently playing a music track and not already playing soundboard, save state to resume seamlessly
        if (this.queue.current && !this.isPlayingSoundboard) {
            this.soundboardSavedState = {
                track: this.queue.current,
                position: this.lastPosition || this.player.position || 0
            };
        }
        this.isPlayingSoundboard = true;
        this.queue.current = queuedTrack;
        this.lastPosition = 0;
        await this.player.playTrack({ track: { encoded: queuedTrack.track.encoded } });
        this.client.emit('playerUpdate', this);
    }

    public async playNext() {
        const unlock = await this.processMutex.lock();
        try {
            const next = this.queue.tracks.shift();
            if (next) {
                await this.playTrack(next);
            } else {
                this.queue.current = null;
                this.lastPosition = 0;
                await this.player.stopTrack();
                this.sendMessage('Queue ended. Add more songs to keep the party going!');
                this.client.emit('playerUpdate', this);
            }
        } catch (err) {
            logger.error(`Error in playNext for ${this.guildId}`, err);
            this.sendMessage('⚠️ An error occurred while trying to play the next track. Skipping...');
            // Try to recover by playing the next track
            if (this.queue.tracks.length > 0) {
                const recoveryNext = this.queue.tracks.shift();
                if (recoveryNext) await this.playTrack(recoveryNext);
            } else {
                this.queue.current = null;
                this.lastPosition = 0;
                await this.player.stopTrack();
            }
            this.client.emit('playerUpdate', this);
        } finally {
            unlock();
        }
    }

    public async destroy() {
        this.soundboardSavedState = null;
        this.isPlayingSoundboard = false;
        this.queue.clear();
        this.lastPosition = 0;
        await this.client.lavalink.shoukaku.leaveVoiceChannel(this.guildId);
        this.client.players.delete(this.guildId);
        this.client.emit('playerUpdate', this);
    }

    public async recover() {
        if (!this.queue.current) return;
        if (this.isRecovering) {
            logger.warn(`Recover already in progress for ${this.guildId}, skipping duplicate call.`);
            return;
        }
        
        this.isRecovering = true;
        this.needsRecovery = false;
        logger.info(`[RECOVERY START] Attempting to recover player for ${this.guildId}...`);
        try {
            const shoukakuPlayer = await this.client.lavalink.shoukaku.joinVoiceChannel({
                guildId: this.guildId,
                channelId: this.voiceChannelId,
                shardId: 0
            });
            this.player = shoukakuPlayer;
            this.setupEvents(); // Re-bind events to the new player instance
            
            logger.info(`[RECOVERY SUCCESS] Resuming track for ${this.guildId} at position ${this.lastPosition}ms`);
            await this.player.playTrack({ 
                track: { encoded: this.queue.current.track.encoded }, 
                position: this.lastPosition 
            });
        } catch (err) {
            logger.error(`[RECOVERY FAILURE] Failed to recover player for ${this.guildId}`, err);
        } finally {
            this.isRecovering = false;
        }
    }

    private async sendMessage(content: string) {
        if (!this.textChannelId) return;
        try {
            const channel = await this.client.channels.fetch(this.textChannelId) as TextChannel;
            if (channel) await channel.send(content);
        } catch (err) {
            logger.error(`Could not send message to ${this.textChannelId}`, err);
        }
    }

    private async sendNowPlaying() {
        if (!this.textChannelId) return;
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
