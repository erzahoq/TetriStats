const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
import("node-fetch");

module.exports = {
	data: new SlashCommandBuilder()
		.setName('news-global')
		.setDescription('Fetches all the latest Tetra News.'),
	async execute(interaction) {        
        const response = await fetch('https://ch.tetr.io/api/news/global?limit=10');
        const stats = await response.json(); // Use .json() to parse the response as JSON
        
        if (!stats.success) {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.', 
                ephemeral: true
            });
        }

        const data = stats.data;

        console.log(data)

        interaction.reply(`${data.news.length} items wow :3`)



    }
};
