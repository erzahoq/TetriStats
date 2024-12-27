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
            .setColor(0x0099FF)
            .setColor("#81ff7d")
            .setDescription(`
### __Overall Server Statistics__
- Total players: ${formatNumber(data.usercount)}
  - ${formatNumber(data.usercount - data.anoncount)} of those are registered (${Math.round(10000 * ((data.usercount - data.anoncount) / data.usercount)) / 100}%)
  - ${formatNumber(data.rankedcount)} of those are ranked (${Math.round(10000 * (data.rankedcount / data.totalaccounts)) / 100}% of total, ${Math.round(10000 * (data.rankedcount / (data.usercount - data.anoncount))) / 100}% of registered)
  - ${formatNumber(data.anoncount)} of those are anonymous (${Math.round(10000 * (data.anoncount / data.usercount)) / 100}%)
  
- Total games played: ${formatNumber(data.gamesplayed)}
  - ${formatNumber(data.gamesfinished)} were finished (${Math.round(10000 * (data.gamesfinished / data.gamesplayed)) / 100}%)
  - ${formatNumber(data.recordcount)} were saved (${Math.round(10000 * (data.recordcount / data.gamesplayed)) / 100}%)
- That's ${Math.round(data.gamesplayed_delta * 10) / 10} games per second!
  - Or ${formatNumber(Math.round(gamesPlayedOverTime * 60 * 60 * 100) / 100)} per hour.
  
- Total time spent: ${formatNumber(Math.round(secondsToDays(data.gametime) * 10) / 10)} days
  - Or ${formatNumber(Math.round(data.gametime))} seconds.
  - Or ${formatNumber(Math.round(secondsToYears(data.gametime) * 10) / 10)} years.
  
- Total pieces placed: ${formatNumber(data.piecesplaced)}
  - ${Math.round(data.piecesplaced / data.gametime * 100) / 100}/second on average
- Total inputs: ${formatNumber(data.inputs)}
  - ${Math.round(data.inputs / data.gametime * 100) / 100}/second on average`)
            .setTimestamp();

        await interaction.reply({ embeds: [serverEmbed] })
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