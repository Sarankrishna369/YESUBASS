import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import { YesubassPlayer } from '../player/PlayerManager';
import { QueuedTrack } from '../player/QueueManager';

export function formatTime(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const m = minutes % 60;
    const s = seconds % 60;
    
    if (hours > 0) {
        return `${hours}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export function buildProgressBar(current: number, total: number, size = 15): string {
    const progress = Math.round((current / total) * size);
    const emptyProgress = size - progress;
    const progressText = '▇'.repeat(Math.max(0, progress - 1)) + '🔘';
    const emptyProgressText = '—'.repeat(Math.max(0, emptyProgress));
    return `[${progressText}${emptyProgressText}]`;
}

export function buildNowPlayingEmbed(player: YesubassPlayer, queuedTrack: QueuedTrack) {
    const track = queuedTrack.track.info;

    const embed = new EmbedBuilder()
        .setColor('#FF0055')
        .setAuthor({ name: 'Now Playing', iconURL: 'https://cdn-icons-png.flaticon.com/512/1384/1384061.png' })
        .setTitle(track.title)
        .setURL(track.uri || null)
        .setDescription(`**Author:** ${track.author}\n**Duration:** ${track.isStream ? '🔴 LIVE' : formatTime(track.length)}`)
        .setThumbnail(track.artworkUrl || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?q=80&w=2070&auto=format&fit=crop')
        .setFooter({ text: `Requested by ${queuedTrack.requester?.username || 'Unknown'}`, iconURL: queuedTrack.requester?.displayAvatarURL() })
        .setTimestamp();

    if (!track.isStream) {
        embed.addFields({ name: 'Progress', value: `${formatTime(0)} ${buildProgressBar(0, track.length)} ${formatTime(track.length)}` });
    }

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId('resume_pause')
            .setLabel('⏯️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('skip')
            .setLabel('⏭️')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('stop')
            .setLabel('⏹️')
            .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
            .setCustomId('loop')
            .setLabel('🔁')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('queue')
            .setLabel('📜')
            .setStyle(ButtonStyle.Secondary)
    );

    return { embeds: [embed], components: [row] };
}
