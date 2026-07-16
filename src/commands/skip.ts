import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skips the current song'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) {
            return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });
        }

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ There is no music playing right now!', ephemeral: true });
        }

        if (interaction.guild?.members.me?.voice.channel?.id !== voiceChannel.id) {
            return interaction.reply({ content: '❌ You must be in the same voice channel as me!', ephemeral: true });
        }

        await player.player.stopTrack();
        return interaction.reply('⏭️ Skipped the current track!');
    }
};
