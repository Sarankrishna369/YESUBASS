import { ButtonInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    customId: 'skip',
    execute: async (interaction: ButtonInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        if (interaction.guild?.members.me?.voice.channel?.id !== voiceChannel.id) {
            return interaction.reply({ content: '❌ You must be in the same voice channel as me!', ephemeral: true });
        }

        await player.player.stopTrack();
        return interaction.reply({ content: '⏭️ Skipped.', ephemeral: true });
    }
};
