const { SlashCommandBuilder, EmbedBuilder, InteractionContextType, MessageFlags } = require('discord.js');
const { formatPlaytime } = require('../../helpers/formatters');
module.exports = {
	data: new SlashCommandBuilder()
		.setName('about')
		.setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
		.setDescription('Gives general information about TetriStats.'),
	async execute(interaction) {
		const client = interaction.client; // get client
		const totalServers = client.guilds.cache.size; // number of servers the bot is in
		const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0); // total users across servers

		// Create embed
		const embed = new EmbedBuilder()
			.setDescription(
`### __TetriStats -> About__

- **Details**
  - TetriStats is an open-source Discord bot that fetches stats from TETR.IO!
  - It's designed to provide detailed insights into TETR.IO player statistics, leaderboards, and replay analysis.
  - Whether you're tracking your own performance, comparing rankings, or analyzing gameplay data, TetriStats makes it easy to access real-time TETR.IO information directly within Discord.
  - Using TETR.IO's public API, the bot offers many commands to get player stats, Tetra League rankings, and much more. Ideal for competitive players, streamers, and communities who want quick and reliable access to TETR.IO data.
- **Features**
  - Player statistics tracking
  - Rating deviation increase alerts
  - Tetra League rankings
  - TETR.IO server statistics
  - Detailed user information
- **Stats**
  - In ${totalServers} servers
  - ${totalUsers} users across servers
  - ${formatPlaytime(client.uptime / 1000)} uptime
- **Links**
  - [Github Repository](https://github.com/erzahoq/TetriStats)
  - [Tetra Channel](https://ch.tetr.io/) and [TETR.IO](https://tetr.io)
  - [Add TetriStats](https://discord.com/oauth2/authorize?client_id=1277041428274479124)
- **Credits**
  - Developed by **@erzahoq** and **@monkeyswithpie**
  - Thanks to **osk** and the rest of their team for creating TETR.IO
`)
		/* const embed = new EmbedBuilder()
			.setTitle('📊 TetriStats - TETR.IO Statistics & Analysis')
			.setColor('#0099ff')
			.setDescription(
				'**TetriStats** is an [open source](https://github.com/erzahoq/TetriStats) Discord bot that fetches stats from [TETR.IO](https://tetr.io), created by erz (@lunoryx) and @monkeyswithpie.\n\n' +
				'It\'s designed to provide **detailed insights** into TETR.IO player statistics, leaderboards, and replay analysis. ' +
				'Whether you\'re tracking your own performance, comparing rankings, or analyzing gameplay data, TetriStats makes it ' +
				'easy to access **real-time TETR.IO information** directly within Discord.\n\n' +
				'With  integration into TETR.IO\'s public API, the bot offers many commands to get player stats, ' +
				'Tetra League rankings, and much more. Ideal for **competitive players, streamers, and communities** ' +
				'who want quick and reliable access to TETR.IO data.'
			)
			.addFields(
				{ name: '📌 Features', value: '- Player statistics tracking\n- Tetra League rankings\n- TETR.IO server statistics\n- Detailed user information', inline: false },
				{ name: '📊 Bot Stats', value: `**Servers:** ${totalServers}\n**Users:** ${totalUsers}`, inline: false },
				{ name: '⛓️ Links', value: '[GitHub Repository](https://github.com/erzahoq/TetriStats) • [Tetra Channel](https://ch.tetr.io/) • [Invite TetriStats!](https://discord.com/oauth2/authorize?client_id=1277041428274479124)', inline: false },
				{ name: '🛠️ Credits', value: 'Developed by **erz (@lunoryx)** and **@monkeyswithpie**.\nSpecial thanks to:\n- **osk** for creating **TETR.IO** and providing the public API', inline: false }
			)
			.setFooter({ text: 'Made with ❤ for TETR.IO fans', iconURL: client.user.displayAvatarURL() }); */

		// Reply with embed
		await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
	},
};

