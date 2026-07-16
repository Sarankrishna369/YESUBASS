import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffles the current queue'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || player.queue.tracks.length === 0) return interaction.reply({ content: '❌ The queue is empty!', ephemeral: true });
        
        player.queue.shuffle();

        return interaction.reply('🔀 Queue has been shuffled.');
    }
};
