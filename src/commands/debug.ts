import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import os from 'os';

export default {
    data: new SlashCommandBuilder()
        .setName('debug')
        .setDescription('Displays system and bot debug information (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const mem = process.memoryUsage();
        const memRss = (mem.rss / 1024 / 1024).toFixed(2);
        
        const uptime = process.uptime();
        const days = Math.floor(uptime / 86400);
        const hours = Math.floor(uptime / 3600) % 24;
        const minutes = Math.floor(uptime / 60) % 60;
        const uptimeStr = `${days}d ${hours}h ${minutes}m`;

        const cpuLoad = os.loadavg()[0].toFixed(2); // 1 minute load average

        const guildCount = client.guilds.cache.size;
        const activePlayers = client.players.size;

        const player = client.players.get(interaction.guildId!);
        
        const embed = new EmbedBuilder()
            .setTitle('🛠️ System Debug Info')
            .setColor('#2F3136')
            .setTimestamp();

        embed.addFields(
            { name: '🤖 Bot Stats', value: `**Uptime:** ${uptimeStr}\n**Guilds:** ${guildCount}\n**Discord API Ping:** ${client.ws.ping}ms\n**Node.js:** ${process.version}`, inline: true },
            { name: '💻 System Stats', value: `**Memory (RSS):** ${memRss} MB\n**CPU Load (1m):** ${cpuLoad}`, inline: true },
            { name: '🎵 Music Stats', value: `**Total Players:** ${activePlayers}`, inline: false }
        );

        if (player) {
            const shoukakuPlayer = player.player;
            const node = shoukakuPlayer.node;
            const queueCount = player.queue.tracks.length;
            
            // Try to access sessionId from node or connection safely
            const sessionId = (node as any).sessionId || 'Unknown';
            const wsPing = (shoukakuPlayer as any).ping ?? 'Unknown';

            embed.addFields({
                name: '📍 Current Guild Player',
                value: `**Active Node:** ${node.name}\n**Session ID:** ${sessionId}\n**WebSocket Ping:** ${wsPing}${wsPing !== 'Unknown' ? 'ms' : ''}\n**Queue Count:** ${queueCount} tracks`,
                inline: false
            });
        } else {
            embed.addFields({
                name: '📍 Current Guild Player',
                value: 'No active player in this guild.',
                inline: false
            });
        }

        return interaction.reply({ embeds: [embed] });
    }
};
