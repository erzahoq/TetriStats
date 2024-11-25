const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Gives general information about TetriStats.'),
	async execute(interaction) {

		await interaction.reply(`um\ntoo lazy to write info rn\nill do that later:tm:`);
	},
};
