const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
import("node-fetch");

const itemsPerPage = 15;
const pageCount = 4;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('news-top')
        .setDescription('Fetches all the latest top Tetra News.'),
    async execute(interaction) {
        const response = await fetch(`https://ch.tetr.io/api/news/global?limit=${itemsPerPage * pageCount}`);
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                ephemeral: true
            });
        }

        //get the news info more cleanly
        const data = stats.data.news;

        // create mappings for emojis and gametypes
        const leaderboardEmojiMapping = {
            1: '1280337193843425310',
            2: '1280337201745625160',
            3: '1280337209739706428',
            4: '1280337216991662091'
        }
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
            const user = data[i];
            const userData = user.data;

            // Handle different types of stuff
            if (user.type === 'leaderboard') {
                let rank = userData.rank;
                if (rank > 4) rank = 4;
                message += `- <:news_lb${rank}:${leaderboardEmojiMapping[rank]}> [${capitalizeFirstLetter(userData.username)}](https://ch.tetr.io/u/${userData.username}) reached #${userData.rank} in ${gametypeMapping[userData.gametype]}`;
            } else if (user.type === 'badge') {
                message += `- <:news_badge:1280338130989482004> [${capitalizeFirstLetter(userData.username)}](https://ch.tetr.io/u/${userData.username}) received the "${userData.label}" badge`;
            }
            message += ` (${reformatTimestamp(user.ts)})`;

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

        // Initial row of buttons
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('topnewspage_0')
                .setLabel('Page 1')
                .setStyle(ButtonStyle.Primary)
                .setDisabled(true), // Disable the first button initially
            new ButtonBuilder()
                .setCustomId('topnewspage_1')
                .setLabel('Page 2')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('topnewspage_2')
                .setLabel('Page 3')
                .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
                .setCustomId('topnewspage_3')
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

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}


function reformatTimestamp(isoString) {
    if (!isoString) {
        return "Before account creation was tracked"
    }

    // Create a Date object from the ISO string
    const date = new Date(isoString);

    // Return the Unix timestamp by dividing the milliseconds by 1000
    return `<t:${Math.floor(date.getTime() / 1000)}:R>`;
}

