const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js');

const { formatISOString, formatUsername, buildPageButtonRows } = require('../../helpers/formatters');
const { getEmoji } = require('../../helpers/emojis');


const itemsPerPage = 15;
const pageCount = 4;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('news-top')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Fetches all the latest top Tetra News.'),
    async execute(interaction) {
        const response = await fetch(`https://ch.tetr.io/api/news/global?limit=${itemsPerPage * pageCount}`);
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }

        //get the news info more cleanly
        const data = stats.data.news;
        
        const gametypeMapping = {
            '40l': '40 Lines',
            'blitz': "Blitz",
            'zenith': 'Quick Play',
            'zenithex': 'Expert Quick Play'
        }

        // Initialize message
        const pageData = [];
        for (let i = 0; i < pageCount; i++) {
            pageData.push([]);
        }

        for (let i = 0; i < data.length; i++) {
            let message = "";  // Reset the message for each user
            const user = data[i];
            const userData = user.data;

            // Handle different types of stuff
            if (user.type === 'leaderboard') {
                let rank = userData.rank;
                if (rank > 4) rank = 4;
                message += `- ${getEmoji(`news_lb${rank}`)} ${formatUsername(userData.username)} reached #${userData.rank} in ${gametypeMapping[userData.gametype]}!`;
            } else if (user.type === 'badge') {
                message += `- ${getEmoji("news_badge")} ${formatUsername(userData.username)} received the "${userData.label}" badge!`;
            }
            message += ` (${formatISOString(user.ts)})`;

            // Put the message in the page
            pageData[Math.floor(i / itemsPerPage)].push(message);
        }

        // hardcoded pages
        const pages = [
            new EmbedBuilder()
                .setColor("#ffc619")
                .setDescription("### __Recent news (top)__\n" + pageData[0].join('\n')),
            new EmbedBuilder()
                .setColor("#ffc619")
                .setDescription("### __Recent news (top)__\n" + pageData[1].join('\n')),
            new EmbedBuilder()
                .setColor("#ffc619")
                .setDescription("### __Recent news (top)__\n" + pageData[2].join('\n')),
            new EmbedBuilder()
                .setColor("#ffc619")
                .setDescription("### __Recent news (top)__\n" + pageData[3].join('\n')),
        ];

        // Realize this is just the same as allnews.js
        // deja vu

        const key = interaction.id;
        const labels = ['Page 1', 'Page 2', 'Page 3', 'Page 4'];

        interaction.client.pageData.set(key, {
            commandName: 'news-top',
            ownerId: interaction.user.id,
            pages,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

        // split into rows of 5
        const rows = buildPageButtonRows({ commandName: "news-top", key, labels });

        // Send the initial message with the first page and buttons
        await interaction.reply({
            embeds: [pages[0]],
            components: rows
        });
    }
};

