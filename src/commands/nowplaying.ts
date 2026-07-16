import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { buildNowPlayingEmbed } from '../utils/embeds';

export default {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Shows the currently playing song'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const player = client.players.get(interaction.guildId!);
        
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ There is no music playing right now!', ephemeral: true });
        }

        const { embeds, components } = buildNowPlayingEmbed(player, player.queue.current);

        return interaction.reply({ embeds, components });
    }
};
