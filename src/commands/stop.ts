import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stops the music and clears the queue'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        const player = client.players.get(interaction.guildId!);
        if (!player) {
            return interaction.reply({ content: '❌ There is no music playing in this server!', ephemeral: true });
        }

        if (interaction.guild?.members.me?.voice.channel?.id !== voiceChannel.id) {
            return interaction.reply({ content: '❌ You must be in the same voice channel as me!', ephemeral: true });
        }

        await player.destroy();
        return interaction.reply('⏹️ Music stopped, queue cleared, and I have left the voice channel.');
    }
};
