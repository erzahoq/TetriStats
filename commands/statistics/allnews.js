const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessageFlags } = require('discord.js');
import("node-fetch");

const { convertToTimeFormat, getEmojiOfRank, reformatTimestamp, capitalizeFirstLetter } = require('../../helpers/functions');
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
                message += `- ${getEmoji("news_lblocal")} [${(userData.username).toUpperCase()}](https://ch.tetr.io/u/${userData.username}) got a new PB in ${gametypeMapping[userData.gametype]}!`

                if (userData.gametype === 'zenith' || userData.gametype === 'zenithex') {
                    message += ` (${Math.round(userData.result * 10) / 10}m)`
                } else {
                    message += ` (${convertToTimeFormat(userData.result)})`
                }
            } else if (user.type === 'supporter') {
                message += `- ${getEmoji("supporter_star"/*oops :3*/)} [${(userData.username).toUpperCase()}](https://ch.tetr.io/u/${userData.username}) has become a Supporter!`
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

        const key = interaction.id;
        const labels = ['Page 1', 'Page 2', 'Page 3', 'Page 4'];

        const buttons = labels.map((label, i) =>
        new ButtonBuilder()
            .setCustomId(`news-all:page-${key}-${i}`)
            .setLabel(label)
            .setStyle(ButtonStyle.Primary)
            .setDisabled(i === 0)
        );

        // split into rows of 5
        const rows = [];
        for (let i = 0; i < buttons.length; i++) {
        const rowIndex = Math.floor(i / 5);
        if (!rows[rowIndex]) rows[rowIndex] = new ActionRowBuilder();
        rows[rowIndex].addComponents(buttons[i]);
        }


        // Send the initial message with the first page and buttons
        await interaction.reply({
            embeds: [pages[0]],
            components: rows
        });

        //store the page data for paging i guess
        if (!interaction.client.pageData || !(interaction.client.pageData instanceof Map)) {
            interaction.client.pageData = new Map();
        }

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