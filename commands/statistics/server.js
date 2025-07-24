const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
import("node-fetch");

const { formatNumber } = require('../../helpers/functions');


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
        .setDescription(
`### __TETR.IO -> Server Statistics__

- Total of **${formatNumber(data.usercount)} Players**
  - ${formatNumber(data.usercount - data.anoncount)} are registered (*${Math.round(10000 * ((data.usercount - data.anoncount) / data.usercount)) / 100}%*)
  - ${formatNumber(data.rankedcount)} are ranked (*${Math.round(10000 * (data.rankedcount / data.totalaccounts)) / 100}% of total, ${Math.round(10000 * (data.rankedcount / (data.usercount - data.anoncount))) / 100}% of registered*)
  - ${formatNumber(data.anoncount)} are anonymous (*${Math.round(10000 * (data.anoncount / data.usercount)) / 100}%*)
- **${formatNumber(data.gamesplayed)} Games** played
  - ${formatNumber(data.gamesfinished)} were finished (*${Math.round(10000 * (data.gamesfinished / data.gamesplayed)) / 100}%*)
  - ${formatNumber(data.recordcount)} were saved as replays (*${Math.round(10000 * (data.recordcount / data.gamesplayed)) / 100}%*)
  - A total of ${Math.round(data.gamesplayed_delta * 10) / 10} games per second
  - Or ${formatNumber(Math.round(gamesPlayedOverTime * 60 * 60 * 100) / 100)} games per hour
- **${formatNumber(Math.round(secondsToDays(data.gametime) * 10) / 10)} Days** of playtime
  - Or ${formatNumber(Math.round(data.gametime))} seconds
  - Or ${formatNumber(Math.round(secondsToYears(data.gametime) * 10) / 10)} years
- **${formatNumber(data.piecesplaced)} Pieces** placed
  - ${Math.round(data.piecesplaced / data.gametime * 100) / 100} pieces per second on average
  - ${formatNumber(data.inputs)} Inputs (${Math.round(data.inputs / data.piecesplaced * 100) / 100} per piece)
  - ${Math.round(data.inputs / data.gametime * 100) / 100} inputs per second on average
`)
    
      await interaction.reply({ embeds: [serverEmbed] });

    },
};

//these are very important functions yes
function secondsToDays(seconds) {
    const secondsPerDay = 24 * 60 * 60; // 86,400 seconds in a day
    return seconds / secondsPerDay;
}

function secondsToYears(seconds) {
    const secondsPerYear = 365.25 * 24 * 60 * 60; // Approx. 31,557,600 seconds in a year
    return seconds / secondsPerYear;
}