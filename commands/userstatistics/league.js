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

            // Extract basic stats
            const { apm, pps, vs, tr, glicko, rd } = leagueData;
            const gamesPlayed = leagueData.gamesplayed || 0;
            const gamesWon = leagueData.gameswon || 0;
            const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(2) : 'N/A';

            // Calculate extra stats
            const app = apm / (60 * pps);
            const agpp = (apm / pps) * (vs / 100); //agression per piece
            const dsr = ((vs / 100) - (apm / 60)) / pps;
            const cpr = (vs / pps) * 10;
            
            // Create the improved embed
            const embed = new EmbedBuilder()
                .setTitle(`Tetra League Stats: **${username.toUpperCase()}**`)
                .setColor('#ffd230')
                .setDescription(`Here is detailed Tetra League information, including extra calculated stats.\n`)

                // Ranking Section
                .addFields(
                    { name: '─── Ranking ───', value: ' ', inline: false }, 
                    { name: '**Tetra Rating**', value: `${tr.toFixed(1)} TR`, inline: true },
                    { name: '**Glicko Rating**', value: `${glicko.toFixed(1)}`, inline: true },
                    { name: '**Rating Deviation**', value: `${rd.toFixed(1)}`, inline: true },
                    { name: '**Rank**', value: `${getEmojiOfRank(leagueData.rank)}`, inline: true },
                )

                // Match Stats Section
                .addFields(
                    { name: '─── Match Stats ───', value: ' ', inline: false },
                    { name: '**Games Played**', value: `${gamesPlayed} games`, inline: true },
                    { name: '**Games Won**', value: `${gamesWon} games`, inline: true },
                    { name: '**Win Rate**', value: `${winRate}%`, inline: true },
                )

                // Performance Stats Section
                .addFields(
                    { name: '─── Performance Stats ───', value: ' ', inline: false },
                    { name: '**Attack Per Minute**', value: `${apm.toFixed(2)} APM`, inline: true },
                    { name: '**Pieces Per Second**', value: `${pps.toFixed(2)} PPS`, inline: true },
                    { name: '**Versus Score**', value: `${vs.toFixed(2)} VS`, inline: true },
                )

                // Advanced Metrics Section
                .addFields(
                    { name: '─── Advanced Metrics ───', value: ' ', inline: false },
                    { name: '**Attack Per Piece**', value: `${app.toFixed(2)} attack/piece`, inline: true },
                    { name: '**Garbage Acceptance Ratio**', value: `${dsr.toFixed(2)} defense score`, inline: true },
                )
                
                .addFields(
                    { name: '🔮 ─── Predicted TR (Estimation) ─── ', value: `-# Coming soon...`, inline: false },
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

function getEmojiOfRank(rank) {
    if (!rank) {
        return "N/A";
    }

    const rankEmojis = {
        "rank_xplus": "1277293685058310288",
        "rank_x": "1277293677873463368",
        "rank_u": "1277293667891286046",
        "rank_ss": "1277293658403770388",
        "rank_splus": "1277293647225819196",
        "rank_s": "1277293636928933888",
        "rank_sminus": "1277293624157278228",
        "rank_aplus": "1277293615114358997",
        "rank_a": "1277293607648231527",
        "rank_aminus": "1277293600438227106",
        "rank_bplus": "1277293592511250553",
        "rank_b": "1277293576895856751",
        "rank_bminus": "1277293566284267581",
        "rank_cplus": "1277293553147449505",
        "rank_c": "1277293540547756115",
        "rank_cminus": "1277293530095685745",
        "rank_dplus": "1277293513616265216",
        "rank_d": "1277293312696516690",
        "rank_z": "1277382169538461746",
        "rank_top": "1278185429656670269"
    }
    let formattedRank = 'rank_' + rank.toLowerCase().replace("+", "plus").replace("-", "minus");
    return `<:${formattedRank}:${rankEmojis[formattedRank]}>`
}