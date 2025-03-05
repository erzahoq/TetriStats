const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('info')
		.setDescription('Gives general information about TetriStats.'),
	async execute(interaction) {
		const client = interaction.client; // get client
		const totalServers = client.guilds.cache.size; // number of servers the bot is in
		const totalUsers = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0); // total users across servers

		// Create embed
		const embed = new EmbedBuilder()
			.setTitle('📊 TetriStats - TETR.IO Statistics & Analysis')
			.setColor('#0099ff')
			.setDescription(
				'**TetriStats** is an [open source](https://github.com/erzahoq/TetriStats) Discord bot that fetches stats from [TETR.IO](https://tetr.io), created by @erzahoq and @monkeyswithpie.\n\n' +
				'It is designed to provide **detailed insights** into TETR.IO player statistics, leaderboards, and replay analysis. ' +
				'Whether you\'re tracking your own performance, comparing rankings, or analyzing gameplay data, TetriStats makes it ' +
				'easy to access **real-time TETR.IO information** directly within Discord.\n\n' +
				'With seamless integration into TETR.IO\'s public API, the bot offers various commands to retrieve player stats, ' +
				'Tetra League rankings, and even in-depth **replay breakdowns**. Ideal for **competitive players, streamers, and communities** ' +
				'who want quick and reliable access to TETR.IO data.' //idk why chatgpt formatted this into a bunch of "+"s, but idrc :SILENCE:
			)
			.addFields(
				{ name: '📌 Features', value: '- Player statistics tracking\n- Tetra League rankings\n- TETR.IO server statistics\n- Detailed user information', inline: false },
				{ name: '📊 Bot Stats', value: `**Servers:** ${totalServers}\n**Users:** ${totalUsers}`, inline: false },
				{ name: '⛓️ Links', value: '[GitHub Repository](https://github.com/erzahoq/TetriStats) • [Tetra Channel](https://ch.tetr.io/)', inline: false }
			)
			.setFooter({ text: 'Made with ❤ for TETR.IO fans', iconURL: client.user.displayAvatarURL() });

		// Reply with embed
		await interaction.reply({ embeds: [embed], ephemeral: true });
	},
};
