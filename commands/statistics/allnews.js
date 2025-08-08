const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags } = require('discord.js');
import("node-fetch");

const { convertToTimeFormat, getEmojiOfRank, reformatTimestamp, capitalizeFirstLetter } = require('../../helpers/functions');


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
                message += `- <:news_lblocal:1280356184640983122> [${(userData.username).toUpperCase()}](https://ch.tetr.io/u/${userData.username}) got a new PB in ${gametypeMapping[userData.gametype]}!`

                if (userData.gametype === 'zenith' || userData.gametype === 'zenithex') {
                    message += ` (${Math.round(userData.result * 10) / 10}m)`
                } else {
                    message += ` (${convertToTimeFormat(userData.result)})`
                }
            } else if (user.type === 'supporter') {
                message += `- <:supporter_star:1277300953111855231> [${(userData.username).toUpperCase()}](https://ch.tetr.io/u/${userData.username}) has become a Supporter!`
            } else if (user.type === 'rankup') {
                message += `- ${getEmojiOfRank(userData.rank)} [${(userData.username).toUpperCase()}](https://ch.tetr.io/u/${userData.username}) achieved ${capitalizeFirstLetter(userData.rank) /*me when i reuse code :3*/} rank!`
            } else {
                message += user.type;
            }
            message += ` (${reformatTimestamp(user.ts)})`;

            // Put the message in the page
            pageData[Math.floor(i / itemsPerPage)].push(message);
        }

        // hardcoded pages
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

        // Initial row of buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('allnewspage_0')
                .setLabel('Page 1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true), // Disable the first button initially
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

        // Send the initial message with the first page and buttons
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