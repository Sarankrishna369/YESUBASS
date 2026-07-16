import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { formatTime } from '../utils/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seeks to a specific position in the track')
        .addIntegerOption(option =>
            option.setName('seconds')
                .setDescription('The position in seconds to seek to')
                .setRequired(true)
        ),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        const seconds = interaction.options.getInteger('seconds', true);
        const positionMs = seconds * 1000;
        
        if (positionMs > player.queue.current.track.info.length || positionMs < 0) {
            return interaction.reply({ content: '❌ Invalid position!', ephemeral: true });
        }

        await player.player.seekTo(positionMs);

        return interaction.reply(`⏩ Seeked to **${formatTime(positionMs)}**.`);
    }
};
