const {
    SlashCommandBuilder,
    InteractionContextType,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
} = require("discord.js");

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
                    `**Details**
- TetriStats is an open-source Discord bot that fetches stats from TETR.IO!
- It's designed to provide detailed insights into TETR.IO player statistics, leaderboards, and replay analysis.`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Features**
- Player statistics tracking
- Average league predictions for statistics and achievements
- Rating deviation increase alerts
- Tetra League rankings
- TETR.IO server statistics
- Detailed user information`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Stats**
- In ${totalServers} servers
- ${totalUsers} users across servers
- ${formatLongTime(client.uptime / 1000)} uptime`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Links**
- [Github Repository](https://github.com/erzahoq/TetriStats)
- [Tetra Channel](https://ch.tetr.io/) and [TETR.IO](https://tetr.io)
- [Add TetriStats](https://discord.com/oauth2/authorize?client_id=1277041428274479124)`,
                ),
            )
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `**Credits**
- Developed by **@erzahoq** and **@monkeyswithpie**
- Thanks to **osk** and the rest of their team for creating TETR.IO`,
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