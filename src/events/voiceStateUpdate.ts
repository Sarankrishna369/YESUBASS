import { Events, VoiceState } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default {
    name: Events.VoiceStateUpdate,
    execute: async (oldState: VoiceState, newState: VoiceState, client: YesubassClient) => {
        const guildId = oldState.guild.id;
        const player = client.players.get(guildId);
        
        if (!player) return;

        // If the bot itself was disconnected
        if (oldState.id === client.user?.id && oldState.channelId && !newState.channelId) {
            logger.info(`Bot was disconnected from voice in ${guildId}`);
            await player.destroy();
            return;
        }

        // Check for inactivity
        if (oldState.channelId === player.voiceChannelId) {
            const channel = oldState.channel;
            if (channel && channel.members.filter(m => !m.user.bot).size === 0) {
                // Wait for a minute before leaving
                player.leaveTimeout = setTimeout(async () => {
                    const currentChannel = client.channels.cache.get(channel.id);
                    if (currentChannel && currentChannel.isVoiceBased() && currentChannel.members.filter(m => !m.user.bot).size === 0) {
                        const currentPlayer = client.players.get(guildId);
                        if (currentPlayer) {
                            logger.info(`Leaving voice channel in ${guildId} due to inactivity.`);
                            await currentPlayer.destroy();
                        }
                    }
                }, 60000); // 1 minute
            }
        }
        
        // Clear timeout if someone joins
        if (newState.channelId === player.voiceChannelId && player.leaveTimeout) {
            const channel = newState.channel;
            if (channel && channel.members.filter(m => !m.user.bot).size > 0) {
                clearTimeout(player.leaveTimeout);
                player.leaveTimeout = null;
                logger.info(`Cancelled inactivity timeout for ${guildId} as a user joined.`);
            }
        }
    }
};
