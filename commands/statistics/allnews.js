const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags } = require('discord.js');
const { formatTime, getEmojiOfRank, formatISOString, capitalizeFirstLetter, formatNumber, formatUsername } = require('../../helpers/formatters');
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
        let pageData = [];
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
                    message += ` (${formatTime(userData.result)})`
                }
            } else if (user.type === 'supporter') {
                message += `- ${getEmoji('supporter_star')} ${formatUsername(userData.username)} has become a Supporter!`
            } else if (user.type === 'rankup') {
                message += `- ${getEmojiOfRank(userData.rank)} ${formatUsername(userData.username)} achieved ${capitalizeFirstLetter(userData.rank)} rank!`
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
                .setDescription("### __Recent news (global)__\n" + pageData[0].join('\n')),
            new EmbedBuilder()
                .setColor("#f37272")
                .setDescription("### __Recent news (global)__\n" + pageData[1].join('\n')),
            new EmbedBuilder()
                .setColor("#ec6262")
                .setDescription("### __Recent news (global)__\n" + pageData[2].join('\n')),
            new EmbedBuilder()
                .setColor("#e44c4c")
                .setDescription("### __Recent news (global)__\n" + pageData[3].join('\n')),
        ];

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('allnewspage_0')
                .setLabel('Page 1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true),
            new ButtonBuilder()
                .setCustomId('allnewspage_1')
                .setLabel('Page 2')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('allnewspage_2')
                .setLabel('Page 3')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('allnewspage_3')
                .setLabel('Page 4')
                .setStyle(ButtonStyle.Primary),
        );

        await interaction.reply({
            embeds: [pages[0]],
            components: [row]
        });

        // Attach pages to the interaction for future reference
        interaction.client.pageData = {
            [interaction.id]: {
                pages,
                currentPage: 0
            }
        };
    }
};