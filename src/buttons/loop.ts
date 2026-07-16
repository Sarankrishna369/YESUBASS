import { ButtonInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    customId: 'loop',
    execute: async (interaction: ButtonInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        if (player.queue.loopQueue) {
            player.queue.setLoopTrack(false);
            player.queue.setLoopQueue(false);
        } else if (player.queue.loopTrack) {
            player.queue.setLoopTrack(false);
            player.queue.setLoopQueue(true);
        } else {
            player.queue.setLoopTrack(true);
            player.queue.setLoopQueue(false);
        } return interaction.reply({ content: `🔁 Loop mode updated.`, ephemeral: true });
    }
};
