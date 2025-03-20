const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, InteractionContextType, ApplicationIntegrationType, Embed } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('league')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Displays Tetra League information about a user.')
        .addStringOption(option => 
            option.setName('username')
                .setDescription('The TETR.IO username to fetch data for.')
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
            let { apm, pps, vs, tr, glicko, rd, prev_rank, next_rank, rank, standing, standing_local, country, decaying, bestrank } = leagueData;
            const gamesPlayed = leagueData.gamesplayed || 0;
            const gamesWon = leagueData.gameswon || 0;
            const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(2) : 'N/A';

            // Calculate extra stats

            // assuming that VS = ((LinesSent + GarbageCleared) / Pieces) * PPS * 100
            // which also simplifies to VS =  (LinesSent + GarbageCleared) * 100 / Sec
            const attackPerPiece = apm / (60 * pps); // formula simplifies to `Attack / PiecesDropped`
            // const vsPieceEfficiency = (vs / pps); // formula simplifies to `(LinesSent + GarbageCleared) * 100 / PiecesDropped`
            const garbageAcceptanceRatio = ((vs / 100) - (apm / 60)) / pps; // formula simplifies to `(GarbageCleared - LinesCancelled) / PiecesDropped`
            const efficiencySpeedRelianceRatio = (3 * attackPerPiece) / (pps) // this one doesn't simplify into something understandable, but it makes sense
            // const generalPieceEfficiency = vs / (100 * apm) // formula simplifies to `60(LinesSent + GarbageCleared) / Attack`

            // const agpp = (apm / pps) * (vs / 100); //agression per piece
            // const dsr = ((vs / 100) - (apm / 60)) / pps;
            // const cpr = (vs / pps) * 10;

            let rankBar;

            if (!next_rank && prev_rank === 'x') {
                next_rank = 'top'
            }
            if (!prev_rank && next_rank === 'd+') {
                prev_rank = "d"
            }

            let description = `### __[${username.toUpperCase()}](https://ch.tetr.io/u/${username}/) -> Tetra League__\n`
            
            if (tr < 0) {
                description += `\n- Currently unranked ${getEmojiOfRank('z')}\n  - ${gamesPlayed}/10 rating games played`
                rankBar = `${generateProgressBar("Unranked", gamesPlayed / 10, 10)} ${getEmojiOfRank('z')}`;
            } 
            else {
                if (rd > 100) {
                    description += `\n- Currently unranked ${getEmojiOfRank(rank)}\n  - Probably around ${getEmojiOfRank(leagueData.percentile_rank)}`
                    rankBar = false;
                } else {
                    description += `\n- Currently ranked ${getEmojiOfRank(rank)}\n  - Ranked #${standing} in the world\n  - Locally ranked #${standing_local}`
                    rankBar = `${getEmojiOfRank(prev_rank)} ${generateProgressBar("Ranked", (leagueData.prev_at - standing) / (leagueData.prev_at - leagueData.next_at), 15)} ${getEmojiOfRank(next_rank)}`;
                }

                if ((rank != bestrank && rd <= 100) || (leagueData.estRank != bestrank && rd > 100)) {
                    description += `\n  - Has reached ${getEmojiOfRank(bestrank)}`
                }

                description += `\n  - Has ${formatNumber(tr.toFixed(1))} TR\n  - Has ${glicko.toFixed(2)} ± ${rd.toFixed(1)} Glicko`
                
                if (decaying) {
                    description += `\n  - Hasn't played in a week; rating deviation is increasing`
                }
            }

            description += `\n- Has played ${gamesPlayed} game${gamesPlayed === 1 ? '' : 's'}`

            if (gamesPlayed > 0) {
                description += `
  - Won ${gamesWon} of them (${winRate}%)
  - ${apm.toFixed(2)} APM
  - ${pps.toFixed(2)} PPS
  - ${vs.toFixed(2)} VS score
                `
            }
            
            if (rankBar) {
                description += `\n\n${rankBar}`
            }

            const embed = new EmbedBuilder()
                .setDescription(description)
                .setColor('#ffd230')

            // Send the formatted embed
            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            interaction.reply({ content: 'An error occurred while fetching data. Please try again later.', ephemeral: true });
        }
    }
};

function generateProgressBar(barType, progress, length = 14) {
    let startSymbol = "<:bar_start:1277463580513669160>"
    let endSymbol = "<:bar_end:1277463565036683264>"

    if (barType === "Unranked") { // this is when there's no rank
        startSymbol = "<:bar_start_rankless:1277779429199712317>"
    }

    // Ensure the progress is within the 0-1 range
    progress = Math.max(0, Math.min(progress, 1));
    if (progress === 1) { // this is for when the player is #1 in the world (wow)
        endSymbol = "<:bar_end_full:1278896013502976000>"
    }

    // Calculate the position of the "!" marker
    const position = Math.round(progress * length);

    // Generate the progress bar
    const bar = Array.from({ length: length }, (_, i) => (i === position ? "<:bar_half:1277463557016916010>" : (i < position ? "<:bar_full:1277463587249586269>" : "<:bar_empty:1277463572863254589>"))).join("");

    // Return the complete progress bar with symbols
    return `${startSymbol}${bar}${endSymbol}`;
}

function countryCodeToEmoji(countryCode) {
    if (countryCode === 'XM') return ("<:flag_xm:1310891739078328374>");
    if (!countryCode) return ("❔"); //if a country isn't set i guess
    const codePoints = countryCode
        .toUpperCase() // Make sure the code is uppercase
        .split('')     // Split the letters
        .map(char => 127397 + char.charCodeAt()); // Convert to regional indicator symbol

    return String.fromCodePoint(...codePoints);
}

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

function formatNumber(num) {
    const numStr = num.toString();
    return numStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}