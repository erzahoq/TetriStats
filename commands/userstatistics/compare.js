const { SlashCommandBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('compare')
		.setDescription('Compare two users\' statistics on TETR.IO.')
        .addStringOption((option) =>
            option
                .setName('user1')
                .setDescription('the username/ID to search for')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('user2')
                .setDescription('the username/ID to search for')
                .setRequired(true),
        ),
	async execute(interaction) {
        const user1 = interaction.options.getString('user1').toLowerCase();
        const user2 = interaction.options.getString('user2').toLowerCase();

        await interaction.reply(`${user1}, ${user2}`);
	},
};
 