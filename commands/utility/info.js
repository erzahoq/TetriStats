const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Gives general information about TetriStats.'),
	async execute(interaction) {

		await interaction.reply({ ephemeral: true, content: 
			`**TetriStats** is an [open source](https://github.com/erzahoq/TetriStats) discord bot that can fetch stats from [tetr.io](https://tetr.io), created by @erzahoq and @monkeyswithpie.
			
			more here maybe` // uhh idk what your plans were, did you want like server count or something? idk you can work on this
		});
	},
};
