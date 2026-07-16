import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pauses the current playing song'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        if (player.player.paused) return interaction.reply({ content: '❌ The player is already paused!', ephemeral: true });

        await player.player.setPaused(true);
        return interaction.reply('⏸️ Paused the current track.');
    }
};
