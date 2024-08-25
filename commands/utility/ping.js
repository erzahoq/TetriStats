const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('ping')
		.setDescription('Replies with the latency of the bot.'),
	async execute(interaction) {
        let ping = interaction.client.ws.ping

        if (ping === -1) {
            ping = "infinite ms"
        } else {
            ping = `${Math.floor(ping)}ms`
        }

		await interaction.reply(`Bot API Latency: ${ping}`);
	},
};
