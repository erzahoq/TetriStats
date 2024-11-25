const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('performance')
		.setDescription('Generates a detailed performance report for a TETR.IO player.')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The TETR.IO username')
                .setRequired(true)),
	async execute(interaction) {

        //interaction.reply('tba (tetris battle advanced)') //this is truely one of the most battle advanced of all time
        const username = interaction.options.getString('username');

        try {
            // Fetch data from the API
            const data = await getPerformance(username);

            // Calculate stats
            const stats = calculateStats(data);

            // Generate the performance report
            const report = generatePerformanceReport({
                username,
                gamesPlayed: data.userInfo.data.gamesplayed,
                winRate: stats.winRate,
                totalGameTime: formatGameTime(data.userInfo.data.gametime),
                tr: data.leagueInfo.data.tr.toFixed(2),
                trChange: calculateTRChange(data.scoreflow.data),
                apm: data.leagueInfo.data.apm.toFixed(2),
                pps: data.leagueInfo.data.pps.toFixed(2),
                vs: data.leagueInfo.data.vs.toFixed(2),
                avgTimePerGame: stats.avgTimePerGame,
                ipm: stats.ipm,
            });

            // Send the report as a reply
            await interaction.reply(`\`\`\`${report}\`\`\``);

        } catch (error) {
            console.error(error);
            await interaction.reply('Error fetching performance data. Please try again later.');
        }
	},
};

async function getPerformance(username) {
    const baseUrl = "https://ch.tetr.io/api";
    
    // Fetch user data
    const userInfo = await fetch(`${baseUrl}/users/${username}`);
    const leagueInfo = await fetch(`${baseUrl}/users/${username}/summaries/league`);
    const scoreflow = await fetch(`${baseUrl}/labs/leagueflow/${username}`);
    const achievements = await fetch(`${baseUrl}/users/${username}/summaries/achievements`);
    
    return { userInfo: userInfo.data, leagueInfo: leagueInfo.data, scoreflow: scoreflow.data, achievements: achievements.data };
}

function calculateStats(data) {
    const winRate = (data.leagueInfo.data.gameswon / data.leagueInfo.data.gamesplayed) * 100;
    const avgTimePerGame = data.userInfo.data.gametime / data.userInfo.data.gamesplayed;
    const ipm = data.generalStats.inputs / (data.generalStats.gametime / 60);
    
    return {
        winRate: winRate.toFixed(2),
        avgTimePerGame: Math.floor(avgTimePerGame / 60) + "m " + (avgTimePerGame % 60).toFixed(0) + "s",
        ipm: ipm.toFixed(2)
    };
}


//this was chatgpt ill fix this later
function generatePerformanceReport(stats) {
    return `
Performance Report for ${stats.username}

🌟 Core Metrics:
- Total Games Played: ${stats.gamesPlayed}
- Win Rate: ${stats.winRate}%
- Total Game Time: ${stats.totalGameTime}

🎮 Tetra League:
- TR: ${stats.tr} (+${stats.trChange} from last week)
- APM: ${stats.apm} | PPS: ${stats.pps} | VS: ${stats.vs}

📊 Efficiency:
- Average Time Per Game: ${stats.avgTimePerGame}
- Inputs Per Minute: ${stats.ipm} IPM
    `;
}