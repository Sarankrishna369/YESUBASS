import { Events, Interaction } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { logger } from '../utils/logger';

export default {
    name: Events.InteractionCreate,
    execute: async (interaction: Interaction, client: YesubassClient) => {
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            const cooldownMap: Record<string, number> = {
                'play': 1000,
                'skip': 500,
                'pause': 500,
                'resume': 500,
                'volume': 1000
            };

            const cooldownTime = cooldownMap[interaction.commandName] || 0;
            if (cooldownTime > 0 && interaction.guildId) {
                const allowed = client.cooldowns.check(interaction.user.id, interaction.guildId, interaction.commandName, cooldownTime);
                if (!allowed) {
                    const timeLeft = (client.cooldowns.getTimeLeft(interaction.user.id, interaction.guildId, interaction.commandName) / 1000).toFixed(1);
                    return interaction.reply({ content: `⏳ Please wait ${timeLeft}s before using \`/${interaction.commandName}\` again.`, ephemeral: true });
                }
            }

            try {
                await command.execute(interaction, client);
            } catch (error) {
                logger.error(`Error executing command ${interaction.commandName}:`, error);
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
                } else {
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
            }
        } else if (interaction.isButton()) {
            const button = client.buttons.get(interaction.customId);
            if (!button) return;

            try {
                await button.execute(interaction, client);
            } catch (error) {
                logger.error(`Error executing button ${interaction.customId}:`, error);
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: 'There was an error while executing this button!', ephemeral: true });
                }
            }
        }
    }
};
