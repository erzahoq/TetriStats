const { SlashCommandBuilder } = require('discord.js');
const { database } = require('./../../dbObjects')

module.exports = {
	data: new SlashCommandBuilder()
		.setName('alerts')
		.setDescription('Enables or disables alerts from TetriStats.')
        .addBooleanOption(option =>
            option.setName("enabled")
            .setDescription("Enable alerts?")
        ),
	async execute(interaction) {
        let user = await database.User.findOne({ where: { userId: interaction.user.id } })
        if (!user) {
            await database.User.create({ userId: interaction.user.id })
        }
        const enabled = interaction.options.getBoolean("enabled") ?? (user.ratingAlert == -1);

        if (enabled) {
            await user.checkAlert(true);
        } else {
            user.ratingAlert = -1;
        }

        await interaction.reply(`${enabled ? "Enabled" : "Disabled"} RD increase alerts!`)
	},
};
