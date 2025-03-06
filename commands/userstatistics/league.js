const { SlashCommandBuilder} = require('@discordjs/builders');
const { EmbedBuilder, InteractionContextType, ApplicationIntegrationType } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('league')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Displays Tetra League information about a user.')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The Tetr.io username to fetch data for.')
                .setRequired(true)),

    async execute(interaction) {
        const username = interaction.options.getString('username').toLowerCase();
        const apiURL = `https://ch.tetr.io/api/users/${username}/summaries/league`;

        try {
            // Fetch user league data
            const response = await fetch(apiURL);
            const data = await response.json();

            if (!data.success || !data.data) {
                return interaction.reply({ content: `Could not find league data for user **${username}**.`, ephemeral: true });
            }

            const leagueData = data.data;

            //thanks cahgtpt
            //thats how you spell that yep
            // Extract basic stats
            const { apm, pps, vs, tr, glicko, rd } = leagueData;
            const gamesPlayed = leagueData.gamesplayed || 0;
            const gamesWon = leagueData.gameswon || 0;
            const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(2) : 'N/A';

            // Calculate extra stats
            const app = apm / (60 * pps);
            const dss = vs / 100 - apm / 60;
            const dsp = dss / pps;
            const dsapp = dsp + app;
            const vsapm = vs / apm;
            const ge = ((app * dss) / pps) * 2;

            // Create embed with a sleek look
            //i loooove chat gpt
            const embed = new EmbedBuilder()
                .setTitle(`📊 Tetra League Stats: **${username.toUpperCase()}**`)
                .setColor('#ffd230')
                .setDescription(`Here is detailed Tetra League information, including extra calculated stats.\n`)

                // Ranking Section
                .addFields(
                    { name: '🏆 ─── Ranking ───', value: ' ', inline: false }, 
                    { name: '🎖️ **Tetra Rating (TR)**', value: `${tr.toFixed(2)}`, inline: true },
                    { name: '📊 **Glicko Rating**', value: `${glicko.toFixed(2)}`, inline: true },
                    { name: '📉 **Rating Deviation (RD)**', value: `${rd.toFixed(2)}`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false } // Adds spacing between sections
                )

                // Match Stats Section
                .addFields(
                    { name: '🎮 ─── Match Stats ───', value: ' ', inline: false },
                    { name: '🕹️ **Games Played**', value: `${gamesPlayed} games`, inline: true },
                    { name: '🏅 **Games Won**', value: `${gamesWon} games`, inline: true },
                    { name: '📈 **Win Rate**', value: `${winRate}%`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false } // Adds spacing between sections
                )

                // Performance Stats Section
                .addFields(
                    { name: '⚡ ─── Performance Stats ───', value: ' ', inline: false },
                    { name: '🔥 **APM (Actions Per Minute)**', value: `${apm.toFixed(2)} APM`, inline: true },
                    { name: '🧩 **PPS (Pieces Per Second)**', value: `${pps.toFixed(2)} PPS`, inline: true },
                    { name: '⚔️ **VS (Versus Score)**', value: `${vs.toFixed(2)} points`, inline: true },
                    { name: '\u200B', value: '\u200B', inline: false } // Adds spacing between sections
                )

                // Advanced Metrics Section
                .addFields(
                    { name: '🔍 ─── Advanced Metrics ───', value: ' ', inline: false },
                    { name: '📌 **APP (Actions Per Piece)**', value: `${app.toFixed(4)} actions/piece`, inline: true },
                    { name: '⚖️ **DSS (Skill-Speed Difference)**', value: `${dss.toFixed(4)} blocks/sec`, inline: true },
                    { name: '🎯 **DSP (Precision Difference)**', value: `${dsp.toFixed(4)} blocks/sec/piece`, inline: true },
                    { name: '🧮 **DSAPP (Combined Metric)**', value: `${dsapp.toFixed(4)}`, inline: true },
                    { name: '⚔️ **VS/APM Ratio**', value: `${vsapm.toFixed(4)} VS per APM`, inline: true },
                    { name: '♻️ **Garbage Efficiency (GE)**', value: `${ge.toFixed(4)} garbage blocks efficiency`, inline: true }
                )

                .setFooter({ text: 'Data provided by TETR.IO API • TetriStats' })
                .setTimestamp();

            // Send the formatted embed
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching data. Please try again later.', ephemeral: true });
        }
    }
};
