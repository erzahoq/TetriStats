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
        
	},
};
