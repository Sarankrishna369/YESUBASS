import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Removes a specific track from the queue')
        .addIntegerOption(option =>
            option.setName('position')
                .setDescription('The queue position of the track to remove')
                .setRequired(true)
        ),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || player.queue.tracks.length === 0) return interaction.reply({ content: '❌ The queue is empty!', ephemeral: true });
        
        const position = interaction.options.getInteger('position', true);
        
        const removed = player.queue.remove(position - 1); // Queue array is 0-indexed
        
        if (!removed) return interaction.reply({ content: '❌ Invalid position!', ephemeral: true });

        return interaction.reply(`🗑️ Removed **${removed.track.info.title}** from the queue.`);
    }
};
