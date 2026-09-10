import { Events, Message, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { YesubassClient } from '../utils/YesubassClient';

export default {
    name: Events.MessageCreate,
    execute: async (message: Message, client: YesubassClient) => {
        if (!message || message.author?.bot) return;

        const content = message.content?.trim().toLowerCase();
        if (!content) return;

        // Check if the user is trying to play music via text message (/play, !play, -play, .play, or p!play)
        const isPlayCommand = 
            content === '/play' || 
            content.startsWith('/play ') ||
            content === '!play' || 
            content.startsWith('!play ') ||
            content === '-play' || 
            content.startsWith('-play ') ||
            content === '.play' || 
            content.startsWith('.play ');

        // Or if the bot was mentioned with the word "play"
        const isBotMentionedWithPlay = client.user && message.mentions.has(client.user) && content.includes('play');

        if (isPlayCommand || isBotMentionedWithPlay) {
            const dashboardUrl = 'https://yesubass-web.vercel.app/dashboard';

            const embed = new EmbedBuilder()
                .setColor('#FF0055')
                .setTitle('🌐 Play Music via Web Dashboard')
                .setDescription(
                    `Hey <@${message.author.id}>, playing music directly through Discord text chat is currently paused.\n\n` +
                    `You can search songs, manage the queue, control audio, and trigger custom soundboard voices exclusively through the **YESUBASS Web Dashboard**!`
                )
                .addFields(
                    { name: 'Dashboard', value: `[👉 Open YESUBASS Web Dashboard](${dashboardUrl})` }
                )
                .setFooter({ text: 'YESUBASS • Web Dashboard Only' })
                .setTimestamp();

            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setLabel('Open Web Dashboard')
                    .setURL(dashboardUrl)
                    .setStyle(ButtonStyle.Link)
            );

            try {
                await message.reply({ embeds: [embed], components: [row] });
            } catch (err) {
                try {
                    if (message.channel && 'send' in message.channel && typeof (message.channel as any).send === 'function') {
                        await (message.channel as any).send({ embeds: [embed], components: [row] });
                    }
                } catch (sendErr) {}
            }
        }
    }
};
