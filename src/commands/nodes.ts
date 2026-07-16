import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    data: new SlashCommandBuilder()
        .setName('nodes')
        .setDescription('Displays information about Lavalink nodes (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const nodes = client.lavalink.shoukaku.nodes;
        const player = client.players.get(interaction.guildId!);
        const activeNodeName = player?.player.node.name;

        const embed = new EmbedBuilder()
            .setTitle('📡 Lavalink Nodes Status')
            .setColor('#2F3136')
            .setTimestamp();

        if (nodes.size === 0) {
            embed.setDescription('No Lavalink nodes configured.');
            return interaction.reply({ embeds: [embed] });
        }

        nodes.forEach((node) => {
            const stateMap: Record<number, string> = {
                0: '🟡 Connecting',
                1: '🟢 Connected',
                2: '🟠 Disconnecting',
                3: '🔴 Disconnected',
            };
            
            const stateStr = stateMap[node.state] || '⚫ Unknown';
            const isActive = activeNodeName === node.name;
            const title = `${isActive ? '▶️ ' : ''}${node.name} ${isActive ? '(Active)' : ''}`;
            
            let description = `**Status:** ${stateStr}\n`;
            
            if (node.state === 1 && node.stats) {
                const stats = node.stats;
                const memoryUsed = (stats.memory.used / 1024 / 1024).toFixed(2);
                const memoryAllocated = (stats.memory.allocated / 1024 / 1024).toFixed(2);
                const cpuSystem = (stats.cpu.systemLoad * 100).toFixed(2);
                const cpuLava = (stats.cpu.lavalinkLoad * 100).toFixed(2);
                
                // Shoukaku Node ping property handles rest/websocket ping. Let's try to get a rough ping if available.
                // Node doesn't always expose ping directly in standard types, but it is sometimes on node.rest.ping or we can just skip if it's not typed.
                
                description += `**Players:** ${stats.players} active\n`;
                description += `**Memory:** ${memoryUsed} MB / ${memoryAllocated} MB\n`;
                description += `**CPU Load:** System ${cpuSystem}% | Lavalink ${cpuLava}%\n`;
            } else {
                description += `*No statistics available.*\n`;
            }

            embed.addFields({ name: title, value: description, inline: false });
        });

        return interaction.reply({ embeds: [embed] });
    }
};
