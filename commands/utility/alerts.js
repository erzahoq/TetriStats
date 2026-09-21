const { SlashCommandBuilder, InteractionContextType, ContainerBuilder, MessageFlags } = require('discord.js');
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

        const container = new ContainerBuilder()
            .setAccentColor(enabled ? 0x99FF99 : 0xFF9999)
            .addTextDisplayComponents((builder) => {
                return builder.setContent(`### __RD Alerts__`)
            })

        if (enabled === user.alertsEnabled) {
            container.setAccentColor(0x888888)
                .addTextDisplayComponents((builder) => {
                    return builder.setContent(`Rating deviation increase alerts are **already ${enabled ? "enabled" : "disabled"}**.`)
                })
            return await interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
        }
        
        if (enabled) {
            user.alertsEnabled = true;
            const resp = await user.checkAlert();
            if (resp instanceof Error) {
                container.setAccentColor(0xFF0000)

                if (resp.message === "User doesn't have their account linked!") {
                    container.addTextDisplayComponents((builder) => {
                        return builder.setContent("Your Discord account is not linked to any existing TETR.IO account.\nTo link your Discord account, go to Config -> Account -> Connections -> Discord, then try again. You may need to make it publically visible.")
                    })
                } else {
                    container.addTextDisplayComponents((builder) => {
                        return builder.setContent(`Something went wrong! ${resp.message}`)
                    })
                }
                return await interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
            }
        } else {
            user.alertsEnabled = false;    
        }

        container.addTextDisplayComponents((builder) => {
            return builder.setContent(`Rating deviation increase alerts have been **${enabled ? "enabled" : "disabled"}**!`)
        })
        await user.save()
        await interaction.reply({ components: [container], flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 })
    },
};
