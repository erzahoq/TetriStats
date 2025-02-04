const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('alerts')
		.setDescription('Enables or disables alerts from TetriStats.')
        .addBooleanOption(option =>
            option.setName("enabled")
            .setDescription("Enable alerts?")
        ),
	async execute(interaction) {
        
	},
};
