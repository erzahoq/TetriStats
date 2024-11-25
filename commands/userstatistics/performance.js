const { SlashCommandBuilder } = require('discord.js');
const axios = require('axios');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('performance')
		.setDescription('Generates a detailed performance report for a TETR.IO player.'),
	async execute(interaction) {

		interaction.reply('tba (tetris battle advanced)')
	},
};

async function getPerformance(username) {
    const baseUrl = "https://ch.tetr.io/api";
    
    // Fetch user data
    const userInfo = await axios.get(`${baseUrl}/users/${username}`);
    const leagueInfo = await axios.get(`${baseUrl}/users/${username}/summaries/league`);
    const scoreflow = await axios.get(`${baseUrl}/labs/leagueflow/${username}`);
    const achievements = await axios.get(`${baseUrl}/users/${username}/summaries/achievements`);
    
    return { userInfo: userInfo.data, leagueInfo: leagueInfo.data, scoreflow: scoreflow.data, achievements: achievements.data };
}
