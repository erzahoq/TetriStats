const { SlashCommandBuilder, InteractionContextType } = require('discord.js');
const { database } = require('./../../database.js')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('alerts')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setDescription('Enables or disables alerts from TetriStats.')
        .addBooleanOption(option =>
            option.setName("enabled")
                .setDescription("Enable alerts?")
        ),
    async execute(interaction) {
        const [user, ] = await database.User.findOrCreate({ where: { userId: interaction.user.id } })

        const enabled = interaction.options.getBoolean("enabled") ?? !user.alertsEnabled;

        if (enabled === user.alertsEnabled) {
            return await interaction.reply(`Rating deviation increase alerts are already ${enabled ? "enabled" : "disabled"}.`)
        }
        
        if (enabled) {
            user.alertsEnabled = true;
            const resp = await user.checkAlert();
            if (resp instanceof Error) {
                if (resp.message === "User doesn't have their account linked!") {
                    return await interaction.reply("Your Discord account is not linked to any existing TETR.IO account.\nTo link your Discord account, go to Config -> Account -> Connections -> Discord, then try again. You may need to make it publically visible.")
                }
                return await interaction.reply(`Something went wrong! ${resp.message}`)
            }
        } else {
            user.alertsEnabled = false;    
        }

        await user.save()
        await interaction.reply(`${enabled ? "Enabled" : "Disabled"} rating deviation increase alerts!`)
    },
};
