import { ButtonInteraction, EmbedBuilder } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { formatTime } from '../utils/embeds';

export default {
    customId: 'queue',
    execute: async (interaction: ButtonInteraction, client: YesubassClient) => {
        const player = client.players.get(interaction.guildId!);
        
        if (!player || !player.queue.current) {
            return interaction.reply({ content: '❌ There is no music playing right now!', ephemeral: true });
        }

        const queue = player.queue.tracks;
        const current = player.queue.current;
        
        const embed = new EmbedBuilder()
            .setColor('#FF0055')
            .setTitle(`🎶 Queue for ${interaction.guild?.name}`)
            .setDescription(`**Now Playing:**\n[${current.track.info.title}](${current.track.info.uri}) - ${formatTime(current.track.info.length)}\n\n**Up Next:**\n${
                queue.length === 0 
                ? 'No songs in queue.' 
                : queue.slice(0, 10).map((t, i) => `**${i + 1}.** [${t.track.info.title}](${t.track.info.uri}) - ${formatTime(t.track.info.length)}`).join('\n')
            }`)
            .setFooter({ text: `Total songs: ${queue.length} | Loop Mode: ${player.queue.loopMode}` })
            .setTimestamp();

        return interaction.reply({ embeds: [embed], ephemeral: true });
    }
};
