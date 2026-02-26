const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { formatPreciseTime, getEmojiOfRank, formatISOString, capitalizeFirstLetter, formatNumber, formatUsername, buildPageButtonRows } = require('../../helpers/formatters');
const { getEmoji } = require('../../helpers/emojis');


//number of things on page (change if you wnat i dont care)
const itemsPerPage = 15;
const pageCount = 4;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('news-all')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Fetches all the latest Tetra News.'),
    async execute(interaction) {
        const response = await fetch(`https://ch.tetr.io/api/news/?limit=${itemsPerPage * pageCount}`);
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            //tetrio servers are down :(
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral
            });
        }

        //get the news info more cleanly
        const data = stats.data.news;

        //types of game
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
            const user = data[i]; //uhhhhh
            const userData = user.data; //get data


            // Handle different types of stuff :3
            if (user.type === 'personalbest') {
                message += `- ${getEmoji("news_lblocal")} ${formatUsername(userData.username)} got a new PB in ${gametypeMapping[userData.gametype]}!`

                if (userData.gametype === 'zenith' || userData.gametype === 'zenithex') {
                    message += ` (${formatNumber(userData.result, 1)}m)`
                } else {
                    message += ` (${formatPreciseTime(userData.result)})`
                }
            } else if (user.type === 'supporter') {
                message += `- ${getEmoji("supporter_star")} ${formatUsername(userData.username)} has become a Supporter!`
            } else if (user.type === 'rankup') {
                message += `- ${getEmojiOfRank(userData.rank)} ${formatUsername(userData.username)} achieved ${capitalizeFirstLetter(userData.rank)} rank!`
            } else if (user.type === 'badge') {
                message += `- ${getEmoji("news_badge")} ${formatUsername(userData.username)} received the "${userData.badge}" badge!`
            } else {
                message += user.type;
            }
            message += ` (${formatISOString(user.ts)})`;

            // Put the message in the page
            pageData[Math.floor(i / itemsPerPage)].push(message);
        }

        const pages = [
            new EmbedBuilder()
                .setColor("#f58484")
                .setDescription("### __News -> Global__\n" + pageData[0].join('\n')),
            new EmbedBuilder()
                .setColor("#f37272")
                .setDescription("### __News -> Global__\n" + pageData[1].join('\n')),
            new EmbedBuilder()
                .setColor("#ec6262")
                .setDescription("### __News -> Global__\n" + pageData[2].join('\n')),
            new EmbedBuilder()
                .setColor("#e44c4c")
                .setDescription("### __News -> Global__\n" + pageData[3].join('\n')),
        ];

        const key = interaction.id;
        const labels = ['Page 1', 'Page 2', 'Page 3', 'Page 4'];

        const rows = buildPageButtonRows({ commandName: "news-all", key, labels })

        await interaction.reply({
            embeds: [pages[0]],
            components: rows
        });

        interaction.client.pageData.set(key, {
            commandName: 'news-all',
            ownerId: interaction.user.id,
            pages,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000
        });

    }
};