const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
import("node-fetch");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('server-stats')
        .setDescription('Gets the general statistics of TETR.IO servers.'),
    async execute(interaction) {
        const response = await fetch('https://ch.tetr.io/api/general/stats');
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                ephemeral: true
            });
        }

        const data = stats.data;

        const apiCreationTimestamp = 1598576400000;
        const now = Date.now();

        const gamesPlayedOverTime = (data.gamesplayed / ((now - apiCreationTimestamp) / 1000))

        // massive wall of embed but luckily everything is just a number
        const serverEmbed = new EmbedBuilder()
        .setColor("#81ff7d")
        .setTitle("📊 **TETR.IO Server Statistics**")
        .setDescription("Here are some detailed statistics on the overall TETR.IO server activity.")
        .addFields(
            { name: '👥 __Total Players__', value: `
            **${formatNumber(data.usercount)}** players in total
            **${formatNumber(data.usercount - data.anoncount)}** registered players (*${Math.round(10000 * ((data.usercount - data.anoncount) / data.usercount)) / 100}%*)
            **${formatNumber(data.rankedcount)}** ranked players (*${Math.round(10000 * (data.rankedcount / data.totalaccounts)) / 100}% of total, ${Math.round(10000 * (data.rankedcount / (data.usercount - data.anoncount))) / 100}% of registered*)
            **${formatNumber(data.anoncount)}** anonymous players (*${Math.round(10000 * (data.anoncount / data.usercount)) / 100}%*)
            `, inline: false },

            { name: '🎮 __Games Played__', value: `
            **${formatNumber(data.gamesplayed)}** total games played
            **${formatNumber(data.gamesfinished)}** finished games (*${Math.round(10000 * (data.gamesfinished / data.gamesplayed)) / 100}%*)
            **${formatNumber(data.recordcount)}** replays saved (*${Math.round(10000 * (data.recordcount / data.gamesplayed)) / 100}%*)
            *${Math.round(data.gamesplayed_delta * 10) / 10} games per second!*
            *${formatNumber(Math.round(gamesPlayedOverTime * 60 * 60 * 100) / 100)} games per hour!*
            `, inline: false },

            { name: '⏱️ __Total Time Spent__', value: `
            **${formatNumber(Math.round(secondsToDays(data.gametime) * 10) / 10)}** days of playtime
            *(${formatNumber(Math.round(data.gametime))} seconds)*
            *(${formatNumber(Math.round(secondsToYears(data.gametime) * 10) / 10)} years)*
            `, inline: false },

            { name: '🧩 __Total Pieces & Inputs__', value: `
            **${formatNumber(data.piecesplaced)}** pieces placed
            *(${Math.round(data.piecesplaced / data.gametime * 100) / 100} pieces per second on average)*
            **${formatNumber(data.inputs)}** total inputs
            *(${Math.round(data.inputs / data.gametime * 100) / 100} inputs per second on average)*
            `, inline: false }
        )
        .setFooter({ text: "TETR.IO Server Data • TetriStats" })
        .setTimestamp();

      await interaction.reply({ embeds: [serverEmbed] });

    },
};

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function secondsToDays(seconds) {
    const secondsPerDay = 24 * 60 * 60; // 86,400 seconds in a day
    return seconds / secondsPerDay;
}

function secondsToYears(seconds) {
    const secondsPerYear = 365.25 * 24 * 60 * 60; // Approx. 31,557,600 seconds in a year
    return seconds / secondsPerYear;
}