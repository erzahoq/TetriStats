const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, InteractionContextType, ApplicationIntegrationType, MessageFlags } = require('discord.js');

const { formatNumber, countryCodeToEmoji, getEmojiOfRank, escapeUnderscores } = require('../../helpers/functions');
const { getUser } = require('../../helpers/getuser')

module.exports = {
    data: new SlashCommandBuilder()
        .setName('league')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Displays Tetra League information about a user.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('the TETR.IO username / Discord to fetch data for')
                .setRequired(true),
        ),

    async execute(interaction) {
        const user = await getUser(interaction.options.getString('user').toLowerCase()); 

        if (user === "no such user") {
            return await interaction.reply({
                    content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                    flags: MessageFlags.Ephemeral
            });
        } else if (user === "server error") {
            return await interaction.reply({
                    content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                    flags: MessageFlags.Ephemeral
            });
        }

        const apiURL = `https://ch.tetr.io/api/users/${user._id}/summaries/league`;

        try {
            // Fetch user league data
            const response = await fetch(apiURL);
            const data = await response.json();

            if (!data.success || !data.data) {
                return interaction.reply({ content: `Could not find league data for user **${user.username}**.`, flags: MessageFlags.Ephemeral }); // this should like never happen because we checked for it earlier but like just in case
            }

            const leagueData = data.data;

            // Extract basic stats
            let { apm, pps, vs, tr, glicko, rd, prev_rank, next_rank, rank, standing, standing_local, country, decaying, bestrank, percentile } = leagueData;
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

            let description = `### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}/) -> Tetra League__\n`
            
            if (tr < 0) {
                description += `\n- Currently unranked ${getEmojiOfRank('z')}\n  - ${gamesPlayed}/10 rating games played`
                rankBar = `${generateProgressBar("Unranked", gamesPlayed / 10, 10)} ${getEmojiOfRank('z')}`;
            } 
            else {
                if (rd > 100) {
                    description += `\n- Currently unranked ${getEmojiOfRank(rank)}\n  - Probably around ${getEmojiOfRank(leagueData.percentile_rank)}`
                    rankBar = false;
                } else {
                    if (percentile < 0.005) {
                        description += `\n- Currently ranked ${getEmojiOfRank(rank)}\n  - Ranked #${standing} worldwide\n  - Ranked #${standing_local} in ${countryCodeToEmoji(country)}`
                    } else {
                        description += `\n- Currently ranked ${getEmojiOfRank(rank)}\n  - Ranked #${standing} worldwide (Top ${(percentile*100).toFixed(1)}%)\n  - Ranked #${standing_local} locally`
                    }

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
            interaction.reply({ content: 'An error occurred while fetching data. Please try again later.', flags: MessageFlags.Ephemeral });
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
