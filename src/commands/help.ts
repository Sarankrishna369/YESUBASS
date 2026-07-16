import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Shows all available commands'),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const commands = client.commands.map(cmd => `**/${cmd.data.name}** - ${cmd.data.description}`);
        
        const embed = new EmbedBuilder()
            .setColor('#FF0055')
            .setTitle('YESUBASS V2 Commands')
            .setDescription(commands.join('\n'))
            .setFooter({ text: 'YESUBASS V2 - Professional Discord Music Bot' })
            .setTimestamp();

        return interaction.reply({ embeds: [embed] });
    }
};
