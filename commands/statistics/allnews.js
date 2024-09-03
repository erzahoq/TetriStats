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

        //get the news info more cleanly
        const data = stats.data.news;

        //initialise message
        let message = "";

        data.forEach(user => {
            userData = user.data;
            console.log(user.type);
            if (user.type === 'leaderboard') {
                message += `[${capitalizeFirstLetter(userData.username)}](https://ch.tetr.io/u/${userData.username}) reached #${userData.rank} in ${userData.gametype}`
            } else if (user.type === 'badge') {
                message += `[${capitalizeFirstLetter(userData.username)}](https://ch.tetr.io/u/${userData.username}) recieved the "${userData.label}" badge`;
            }

            //lazy
            message += "\n";
        });

        interaction.reply(message);



    }
};

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}