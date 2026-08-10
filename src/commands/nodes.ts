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

        console.log(`[NODES COMMAND] Shoukaku node count: ${nodes.size}`);
        console.log(`[NODES COMMAND] node names: ${Array.from(nodes.values()).map((n) => n.name).join(', ')}`);

        const embed = new EmbedBuilder()
            .setTitle('📡 Lavalink Nodes Status')
            .setColor('#2F3136')
            .setTimestamp();

        if (nodes.size === 0) {
            embed.setDescription('No Lavalink nodes configured.');
            return interaction.reply({ embeds: [embed] });
        }

        nodes.forEach((node) => {
            const stateEmojis: Record<number, string> = {
                0: '🟡 Connecting',
                1: '🟢 Connected',
                2: '🟠 Disconnecting',
                3: '🔴 Disconnected',
            };
            
            const stateStr = `${stateEmojis[node.state] || '⚫ Unknown'} (Raw State: ${node.state})`;
            const isActive = activeNodeName === node.name;
            const title = `${isActive ? '▶️ ' : ''}${node.name} ${isActive ? '(Active)' : ''}`;
            
            let description = `**Status:** ${stateStr}\n`;
            
            if (node.state === 1 && node.stats) {
                const stats = node.stats;
                const memoryUsed = (stats.memory.used / 1024 / 1024).toFixed(2);
                const memoryAllocated = (stats.memory.allocated / 1024 / 1024).toFixed(2);
                const cpuSystem = (stats.cpu.systemLoad * 100).toFixed(2);
                const cpuLava = (stats.cpu.lavalinkLoad * 100).toFixed(2);
                const uptimeHrs = (stats.uptime / 1000 / 60 / 60).toFixed(2);
                
                // Try to safely access ping if available in node.ping or node.rest.ping
                const ping = (node as any).ping || -1;
                
                description += `**Ping:** ${ping >= 0 ? ping + 'ms' : 'Unknown'}\n`;
                description += `**Uptime:** ${uptimeHrs} hours\n`;
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
