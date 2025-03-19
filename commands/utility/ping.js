const { SlashCommandBuilder } = require('discord.js');

// it's a ping command
// yes i'm commenting in the ping command fuck you
module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with the latency of the bot.'),
	async execute(interaction) {
        let ping = interaction.client.ws.ping;

        if (ping === -1) {
            ping = "infinite ms"
        } else {
            ping = `${Math.floor(ping)}ms`
        }

        //maybe remove this if this is spammming the API becuase people run /ping a lot, but i doubt it
        //if we get banned from tetrio api then we know why :SILENCE:
        const response = await fetch('https://ch.tetr.io/api/general/stats');
        const stats = await response.json(); // Use .json() to parse the response as JSON

        if (!stats.success) {
            return await interaction.reply({
                content: `api servers are down lol\nBot API Latency: ${ping}`
            });
        }

        const data = stats.data;

        const apiCreationTimestamp = 1598576400000;
        const now = Date.now();

        const gamesPlayedOverTime = (data.gamesplayed / ((now - apiCreationTimestamp) / 1000))

        let pingMsgs = [
            "pong!",
            "ping... wait no",
            "pong :3",
            "pang",
            `there are ${stats.usercount} players online!`,
            `there are ${stats.usercount - stats.anoncount} registered players online!`
        ]

		await interaction.reply(`${pingMsgs[Math.random(pingMsgs.length)]}\nBot API Latency: ${ping}`);
	},
};
