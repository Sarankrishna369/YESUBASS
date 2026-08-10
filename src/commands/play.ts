import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { YesubassPlayer } from '../player/PlayerManager';
import { logger } from '../utils/logger';
import { Mutex } from '../utils/Mutex';
import { Node } from 'shoukaku';

async function getLavalinkNode(client: YesubassClient, maxWaitMs = 10000): Promise<Node | undefined> {
    let node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
    if (node) return node;

    // node.state === 0 is CONNECTING
    const isReconnecting = Array.from(client.lavalink.shoukaku.nodes.values()).some(node => node.state === 0);
    if (!isReconnecting) {
        logger.warn('getLavalinkNode: No nodes are currently CONNECTED or CONNECTING. Aborting wait.');
        return undefined;
    }

    logger.info('Lavalink nodes are currently connecting/reconnecting. Waiting up to 10 seconds...');
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
        await new Promise(r => setTimeout(r, 1000));
        node = client.lavalink.shoukaku.options.nodeResolver(client.lavalink.shoukaku.nodes);
        if (node) return node;
    }
    return undefined;
}

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song from YouTube, Spotify, SoundCloud, or a URL')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('The song name or URL to play')
                .setRequired(true)
        ),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const query = interaction.options.getString('query', true);
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel to play music!', ephemeral: true });
        }

        const botVoiceChannel = interaction.guild?.members.me?.voice.channel;
        if (botVoiceChannel && botVoiceChannel.id !== voiceChannel.id) {
            return interaction.reply({ content: '❌ I am already playing in a different voice channel!', ephemeral: true });
        }

        await interaction.deferReply();

        let player = client.players.get(interaction.guildId!);
        
        if (!player) {
            let joinLock = client.joinLocks.get(interaction.guildId!);
            if (!joinLock) {
                joinLock = new Mutex();
                client.joinLocks.set(interaction.guildId!, joinLock);
            }

            const unlock = await joinLock.lock();
            try {
                player = client.players.get(interaction.guildId!);
                if (!player) {
                    const node = await getLavalinkNode(client);
                    if (!node) {
                        return interaction.followUp('❌ No Lavalink nodes are currently available.');
                    }

                    const shoukakuPlayer = await client.lavalink.shoukaku.joinVoiceChannel({
                        guildId: interaction.guildId!,
                        channelId: voiceChannel.id,
                        shardId: 0
                    });
                    player = new YesubassPlayer(client, shoukakuPlayer, interaction.guildId!, interaction.channelId!, voiceChannel.id);
                    client.players.set(interaction.guildId!, player);
                    logger.info(`Prevented race condition during join in guild ${interaction.guildId!}`);
                }
            } catch {
                return interaction.followUp('❌ Failed to join the voice channel.');
            } finally {
                unlock();
            }
        }

        const node = await getLavalinkNode(client);
        if (!node) return interaction.followUp('❌ No Lavalink nodes are currently available.');

        let searchPrefix = 'ytsearch:';
        if (query.startsWith('http://') || query.startsWith('https://')) {
            searchPrefix = '';
        }

        const result = await node.rest.resolve(`${searchPrefix}${query}`);
        if (!result || !result.data) {
            return interaction.followUp('❌ No results found.');
        }

        if (result.loadType === 'playlist') {
            return interaction.followUp('❌ Playlists are not supported in this lightweight version.');
        } else if (result.loadType === 'search' || result.loadType === 'track') {
            const track = result.loadType === 'search' ? result.data[0] : result.data;
            player.queue.add({ track, requester: interaction.user });
            
            if (!player.queue.current) {
                interaction.followUp(`✅ Added **${track.info.title}** to the queue and starting playback!`);
                await player.playNext();
            } else {
                interaction.followUp(`✅ Added **${track.info.title}** to the queue!`);
            }
        } else {
            interaction.followUp('❌ No results found.');
        }
    }
};
