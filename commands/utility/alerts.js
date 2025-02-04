const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('alerts')
		.setDescription('Enables or disables alerts from TetriStats.'),
	async execute(interaction) {
        
	},
};
