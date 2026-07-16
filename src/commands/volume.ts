import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Changes the player volume')
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Volume amount (0-200)')
                .setRequired(true)
        ),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        const volume = interaction.options.getInteger('amount', true);
        
        if (volume < 0 || volume > 200) {
            return interaction.reply({ content: '❌ Volume must be between 0 and 200!', ephemeral: true });
        }

        await player.player.update({ volume });

        return interaction.reply(`🔊 Volume set to **${volume}%**.`);
    }
};
