const {
    SlashCommandBuilder,
    InteractionContextType,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
} = require("discord.js");
const { getEmoji } = require("../../helpers/emojis");

const { formatLongTime } = require("../../helpers/formatters");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("about")
        .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
        )
        .setDescription("Gives general information about TetriStats."),

    async execute(interaction) {
        const client = interaction.client; // get client
        const totalServers = client.guilds.cache.size; // number of servers the bot is in
        const totalUsers = client.guilds.cache.reduce(
            (acc, guild) => acc + guild.memberCount,
            0,
        ); // total users across servers

        // Create container
        const container = new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `### __TetriStats -> About__`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${getEmoji("top")}**Stats**
${getEmoji("mid")}In ${totalServers} servers
${getEmoji("mid")}${totalUsers} users across servers
${getEmoji("mid")}${formatLongTime(client.uptime / 1000)} uptime`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${getEmoji("top")}**Links**
${getEmoji("mid")}[Github Repository](https://github.com/erzahoq/TetriStats)
${getEmoji("mid")}[Tetra Channel](https://ch.tetr.io/) and [TETR.IO](https://tetr.io)
${getEmoji("mid")}[Add TetriStats](https://discord.com/oauth2/authorize?client_id=1277041428274479124)`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `${getEmoji("top")}**Credits**
${getEmoji("mid")}Developed by **@erzahoq** and **@monkeyswithpie**
${getEmoji("mid")}Thanks to **osk** and the rest of their team for creating TETR.IO`,
                ),
            );

        await interaction.reply({
            components: [container],
            flags:
                MessageFlags.IsComponentsV2 |
                MessageFlags.Ephemeral,
        });
    },
};