import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Music playback is exclusive to the YESUBASS Web Dashboard')
        .addStringOption(option =>
            option.setName('query')
                .setDescription('Search & playback is managed exclusively via the web dashboard')
                .setRequired(false)
        ),
    execute: async (interaction: ChatInputCommandInteraction, _client: YesubassClient) => {
        const dashboardUrl = 'https://yesubass-web.vercel.app/dashboard';

        const embed = new EmbedBuilder()
            .setColor('#FF0055')
            .setTitle('🌐 Play Music via Web Dashboard')
            .setDescription(
                `Playing music directly via Discord \`/play\` is currently paused.\n\n` +
                `You can search songs, manage the queue, control audio, and trigger custom soundboard voices exclusively from the **YESUBASS Web Dashboard**!`
            )
            .addFields(
                { name: 'Dashboard', value: `[Open YESUBASS Web Dashboard](${dashboardUrl})` }
            )
            .setFooter({ text: 'YESUBASS • Web Dashboard Only' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setLabel('Open Web Dashboard')
                .setURL(dashboardUrl)
                .setStyle(ButtonStyle.Link)
        );

        return interaction.reply({ embeds: [embed], components: [row] });
    }
};
