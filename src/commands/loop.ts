import { SlashCommandBuilder, ChatInputCommandInteraction, GuildMember } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';
import { LoopMode } from '../player/QueueManager';

export default {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Toggle loop mode (track, queue, none)')
        .addStringOption(option =>
            option.setName('mode')
                .setDescription('The loop mode')
                .setRequired(true)
                .addChoices(
                    { name: 'None', value: 'none' },
                    { name: 'Track', value: 'track' },
                    { name: 'Queue', value: 'queue' }
                )
        ),
    execute: async (interaction: ChatInputCommandInteraction, client: YesubassClient) => {
        const member = interaction.member as GuildMember;
        const voiceChannel = member.voice.channel;

        if (!voiceChannel) return interaction.reply({ content: '❌ You must be in a voice channel!', ephemeral: true });

        const player = client.players.get(interaction.guildId!);
        if (!player || !player.queue.current) return interaction.reply({ content: '❌ Nothing is playing!', ephemeral: true });
        
        const mode = interaction.options.getString('mode', true) as LoopMode;
        player.queue.loopMode = mode;

        return interaction.reply(`🔁 Loop mode set to **${mode}**.`);
    }
};
