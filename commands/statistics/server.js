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

        const gamesPlayedOverTime = (data.gamesplayed / ((now - apiCreationTimestamp)/1000))

        const serverEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setColor("#81ff7d")
        .setTitle('TETR.IO Server Statistics')
        .setDescription(`   
### Total Accounts: ${formatNumber(data.totalaccounts)}
- Number of Ranked Accounts: ${formatNumber(data.rankedcount)} (${Math.round(10000*(data.rankedcount/data.totalaccounts))/100}%) 
### Online Players: ${formatNumber(data.usercount)}
- Online Registered Players: ${formatNumber(data.usercount - data.anoncount)} (${Math.round(10000*((data.usercount - data.anoncount)/data.usercount))/100}%)
- Online Anonymous Players: ${formatNumber(data.anoncount)} (${Math.round(10000*(data.anoncount/data.usercount))/100}%)
### Games Played: ${formatNumber(data.gamesplayed)}
- Of Which Finished: ${formatNumber(data.gamesfinished)} (${Math.round(10000*(data.gamesfinished/data.gamesplayed))/100}%)
- Game Frequency:
 - Per Second: ${Math.round(data.gamesplayed_delta*10)/10}
 - Per Minute: ${formatNumber(Math.round(data.gamesplayed_delta*60*10)/10)}
 - Per Hour: ${formatNumber(Math.round(gamesPlayedOverTime*60*60*100)/100)}
 - Per Day: ${formatNumber(Math.round(gamesPlayedOverTime*60*60*24*100)/100)}
 - Per Year: ${formatNumber(Math.round(gamesPlayedOverTime*60*60*24*365.25*100)/100)}
- **Total Time Played**: 
 - ${formatNumber(Math.round(data.gametime))} seconds
 - ${formatNumber(Math.round(secondsToDays(data.gametime)*10)/10)} days
 - ${formatNumber(Math.round(secondsToYears(data.gametime)*10)/10)} years
### Pieces Placed: ${formatNumber(data.piecesplaced)}
- Average PPS: ${Math.round(data.piecesplaced/data.gametime*100)/100}
- Inputs: ${formatNumber(data.inputs)}
- Inputs Per Second: ${Math.round(data.inputs/data.gametime*100)/100}


            `)
        .setTimestamp();

        await interaction.reply({embeds: [serverEmbed]}) 
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