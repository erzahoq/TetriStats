const { SlashCommandBuilder } = require('discord.js');
const { database } = require('./../../database.js')

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
            const resp = await user.checkAlert(true);
            if (resp instanceof Error) {
                return await interaction.reply(`Something went wrong! ${resp.message}`)
            }
        } else {
            user.ratingAlert = -1;
        }

        await user.save()
        await interaction.reply(`${enabled ? "Enabled" : "Disabled"} RD increase alerts!`)
	},
};
