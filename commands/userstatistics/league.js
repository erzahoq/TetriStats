const { SlashCommandBuilder } = require('@discordjs/builders');
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

            // Extract Basic Stats
            const { apm, pps, vs, tr, glicko, rd } = leagueData;
            const gamesPlayed = leagueData.gamesplayed || 0;
            const gamesWon = leagueData.gameswon || 0;
            const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(2) : 'N/A';

            // ✅ Updated Calculations
            const actionsPerPieceEfficiency = apm / (pps * 60); // APP
            const downstackSpeed = vs / (100 * pps) - (apm / 60); // DSS
            const downstackPrecision = downstackSpeed / pps; // DSP
            const combinedEfficiencyScore = (downstackPrecision + actionsPerPieceEfficiency) / 2; // DSAPP
            const attackPerActionRatio = vs / apm; // VS/APM
            const garbageConversionRate = vs / apm; // GE (Attack per action)
            const cheeseIndex = (downstackPrecision * 150) + (((attackPerActionRatio - 2) * 50) + (0.6 - actionsPerPieceEfficiency) * 125);
            const weightedAPP = actionsPerPieceEfficiency - 5 * Math.tan((cheeseIndex / -30) + 1);
            const estimatedTR = 25000 / (1 + 10 ** (((1500 - (0.000013 * (((pps * (150 + ((attackPerActionRatio - 1.66) * 35)) + actionsPerPieceEfficiency * 290 + downstackPrecision * 700)) ** 3) - 0.0196 * (((pps * (150 + ((attackPerActionRatio - 1.66) * 35)) + actionsPerPieceEfficiency * 290 + downstackPrecision * 700)) ** 2) + (12.645 * ((pps * (150 + ((attackPerActionRatio - 1.66) * 35)) + actionsPerPieceEfficiency * 290 + downstackPrecision * 700))) - 1005.4)) * Math.PI) / (Math.sqrt(((3 * Math.log(10) ** 2) * 60 ** 2) + (2500 * ((64 * Math.PI ** 2) + (147 * Math.log(10) ** 2)))))));
            const areaScore = apm + (pps * 45) + (vs * 0.444) + (actionsPerPieceEfficiency * 185) + (downstackSpeed * 175) + (downstackPrecision * 450) + (garbageConversionRate * 315);

            // Create embed with improved descriptions
            const embed = new EmbedBuilder()
                .setTitle(`📊 Tetra League Stats: **${escapeUnderscores(username.toUpperCase())}**`)
                .setColor('#ffd230')
                .setDescription(`Here is detailed Tetra League information, including advanced calculated metrics.`)

                .addFields(
                    { name: '🏆 **────────── Ranking ──────────**', value: ' ', inline: false }, 
                    { name: '🎖️ **Tetra Rating (TR)**', value: `${tr.toFixed(2)}`, inline: true },
                    { name: '📊 **Glicko Rating**', value: `${glicko.toFixed(2)}`, inline: true },
                    { name: '📉 **Rating Deviation (RD)**', value: `${rd.toFixed(2)}`, inline: true },
                    { name: '📌 **Estimated TR (Projected)**', value: `${estimatedTR.toFixed(2)}`, inline: true }
                )

                .addFields(
                    { name: '🎮 **────────── Match Stats ──────────**', value: ' ', inline: false },
                    { name: '🕹️ **Total Games Played**', value: `${gamesPlayed} games`, inline: true },
                    { name: '🏅 **Games Won**', value: `${gamesWon} games`, inline: true },
                    { name: '📈 **Win Rate**', value: `${winRate}%`, inline: true }
                )

                .addFields(
                    { name: '⚡ **────────── Gameplay Performance ──────────**', value: ' ', inline: false },
                    { name: '🔥 **Actions Per Minute (APM)**', value: `${apm.toFixed(2)} APM`, inline: true },
                    { name: '🧩 **Pieces Per Second (PPS)**', value: `${pps.toFixed(2)} PPS`, inline: true },
                    { name: '⚔️ **Attack Power (VS Score)**', value: `${vs.toFixed(2)} points`, inline: true }
                )

                .addFields(
                    { name: '🔍 **────────── Advanced Analysis ──────────**', value: ' ', inline: false },
                    { name: '📌 **Overall Efficiency Score (DSAPP)**', value: `${combinedEfficiencyScore.toFixed(3)}`, inline: true },
                    { name: '⚖️ **Attack per Action (VS/APM Ratio)**', value: `${attackPerActionRatio.toFixed(3)} VS per APM`, inline: true },
                    { name: '♻️ **Garbage Efficiency (Conversion Rate)**', value: `${garbageConversionRate.toFixed(3)} VS per action`, inline: true },
                    { name: '🧮 **Cheese Index (Survival Factor)**', value: `${cheeseIndex.toFixed(2)}`, inline: true },
                    { name: '📊 **Weighted APP (Skill Adjusted)**', value: `${weightedAPP.toFixed(3)}`, inline: true },
                    { name: '🏆 **Overall Area Score**', value: `${areaScore.toFixed(2)}`, inline: true }
                )

                .setFooter({ text: 'Data provided by TETR.IO API • TetriStats' })
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching data. Please try again later.', ephemeral: true });
        }
    }
};

function escapeUnderscores(input) {
    return input.replace(/_/g, '\\_');
}
