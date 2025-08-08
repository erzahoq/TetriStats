const { SlashCommandBuilder } = require('@discordjs/builders');
const { EmbedBuilder, InteractionContextType, ApplicationIntegrationType, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

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

            // Extract basic stats from current league data
            //
            //
            //
            let { apm, pps, vs, tr, glicko, rd, prev_rank, next_rank, rank, standing, standing_local, decaying, bestrank, percentile, gxe, past } = leagueData;
            const gamesPlayed = leagueData.gamesplayed || 0;
            const gamesWon = leagueData.gameswon || 0;
            const winRate = gamesPlayed > 0 ? ((gamesWon / gamesPlayed) * 100).toFixed(2) : 'N/A';

            const ratingColours = {
                "z": "#7d7d7d",
                "d": "#846b83",
                "d+": "#8a5d8b",
                "c-": "#755188",
                "c": "#733e8f", 
                "c+": "#562a89",
                "b-": "#5550c5",
                "b": "#4f65cb",
                "b+": "#4e99c0",
                "a-": "#45ca7f",
                "a": "#6bcb55",
                "a+": "#4fca18",
                "s-": "#c8b82d",
                "s": "#e8b215",
                "s+": "#ffec0e",
                "ss": "#feaf1b",
                "u": "#ff2713",
                "x": "#fd73fc",
                "x+": "#f018d0"
            }

        
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

            // For current data
            let description = `### __[${escapeUnderscores(user.username).toUpperCase()}](https://ch.tetr.io/u/${user.username}/) -> Tetra League__\n`;
            description += `## ${tr < 0 ? `Currently unranked ${getEmojiOfRank('z')}` : `Currently ranked ${getEmojiOfRank(rank)}`}\n`;

            if (tr < 0) {
                description += `- **Has played ${gamesPlayed}/10 rating games**\n`;
                if (gamesPlayed > 0) {
                    description += `  - Won ${gamesWon} of them (${winRate}%)\n  - ${apm.toFixed(2)} APM | ${pps.toFixed(2)} PPS | ${vs.toFixed(2)} VS score\n`;
                }
                rankBar = `${generateProgressBar("Unranked", gamesPlayed / 10, 10)} ${getEmojiOfRank('z')}`;
                if (bestrank && bestrank !== leagueData.percentile_rank) {
                    description += `  - Has reached ${getEmojiOfRank(bestrank)}\n`;
                }
            } else {
                description += `- **Has ${formatNumber(tr.toFixed(1))} TR**\n`;
                if (rd > 100) {
                    description += `  - Probably around ${getEmojiOfRank(leagueData.percentile_rank)} (Top ${(percentile*100).toFixed(1)}%)\n`;
                    rankBar = false;
                    if (bestrank && bestrank !== leagueData.percentile_rank) {
                        description += `  - Has reached ${getEmojiOfRank(bestrank)}\n`;
                    }
                } else {
                    if (percentile < 0.005) {
                        description += `  - Ranked #${standing} worldwide\n`;
                        if (standing !== 1) {
                            description += `  - Ranked #${standing_local} locally\n`;
                        }
                    } else {
                        description += `  - Ranked #${standing} worldwide (Top ${(percentile*100).toFixed(1)}%)\n  - Ranked #${standing_local} locally\n`;
                    }
                    rankBar = `${getEmojiOfRank(prev_rank)} ${generateProgressBar("Ranked", (leagueData.prev_at - standing) / (leagueData.prev_at - leagueData.next_at), 15)} ${getEmojiOfRank(next_rank)}`;
                    if (bestrank && bestrank !== rank) {
                        description += `  - Has reached ${getEmojiOfRank(bestrank)}\n`;
                    }
                }
                description += `  - Has ${glicko.toFixed(2)} ± ${rd.toFixed(1)} Glicko\n`;
                if (gxe) {
                    description += `  - ${gxe.toFixed(1)}% chance to win against random player\n`;
                }
                if (decaying) {
                    description += `  - Hasn't played in a week; __rating deviation is increasing__\n`;
                }
                description += `- **Has played ${gamesPlayed} game${gamesPlayed === 1 ? '' : 's'}**\n`;
                if (gamesPlayed > 0) {
                    description += `  - Won ${gamesWon} of them (${winRate}%)\n  - ${apm.toFixed(2)} APM | ${pps.toFixed(2)} PPS | ${vs.toFixed(2)} VS score\n`;
                }
            }

            if (rankBar) {
                description += `\n${rankBar}`;
            }


            //past data

            // Check if past is empty
            if (!past || Object.keys(past).length === 0) {
                // Only send current league data, no buttons
                const embed = new EmbedBuilder()
                    .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                    .setDescription(description)
                    .setColor(ratingColours[rank] || '#ff8c57');
                await interaction.reply({
                    embeds: [embed]
                });
            } else {
                // Build pages: first is current, then each season
                const pages = [
                    new EmbedBuilder()
                        .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                        .setDescription(description)
                        .setColor(ratingColours[rank] || '#ff8c57')
                ];

                // Add a page for each season in order
                const seasonNumbers = Object.keys(past).map(Number).sort((a, b) => a - b);
                for (const season of seasonNumbers) {
                    const seasonData = past[season];
                    let pastDescription = `### __[${escapeUnderscores(seasonData.username).toUpperCase()}](https://ch.tetr.io/u/${seasonData.username}/) -> Tetra League -> Season ${season}__\n`;
                    pastDescription += `## ${seasonData.tr < 0 ? `Unranked ${getEmojiOfRank('z')}` : `Ranked ${getEmojiOfRank(seasonData.rank)}`}\n`;
                    if (seasonData.tr < 0) {
                        pastDescription += `- Has played ${seasonData.gamesPlayed}/10 rating games\n`;
                        if (seasonData.gamesplayed > 0) {
                            pastDescription += `  - Won ${seasonData.gameswon} of them (${(100*(seasonData.gameswon/seasonData.gamesplayed)).toFixed(2)}%)\n  - ${seasonData.apm.toFixed(2)} APM | ${seasonData.pps.toFixed(2)} PPS | ${seasonData.vs.toFixed(2)} VS score\n`;
                        }
                        if (seasonData.bestrank) {
                            pastDescription += `  - Has reached ${getEmojiOfRank(seasonData.bestrank)}\n`;
                        }
                    } 
                    else {
                        pastDescription += `- **Had ${formatNumber(seasonData.tr.toFixed(1))} TR**\n`;
                        if (rd > 100) {
                            pastDescription += `  - Unranked\n`;
                            if (seasonData.bestrank) {
                                pastDescription += `  - Has reached ${getEmojiOfRank(seasonData.bestrank)}\n`;
                            }
                        } else {
                            pastDescription += `  - Rank #${seasonData.placement ? seasonData.placement : '?'} worldwide\n`;
                            if (seasonData.bestrank && seasonData.bestrank !== seasonData.rank) {
                                pastDescription += `  - Has reached ${getEmojiOfRank(seasonData.bestrank)}\n`;
                            }
                        }
                        pastDescription += `  - Had ${seasonData.glicko.toFixed(2)} ± ${seasonData.rd.toFixed(1)} Glicko\n`;
                        if (seasonData.gxe) {
                            pastDescription += `  - ${seasonData.gxe.toFixed(1)}% chance to win against random player\n`;
                        }
                        pastDescription += `- **Played ${seasonData.gamesplayed} game${seasonData.gamesplayed === 1 ? '' : 's'}**\n`;
                        if (seasonData.gamesplayed > 0) {
                            pastDescription += `  - Won ${seasonData.gameswon} of them (${(100*(seasonData.gameswon/seasonData.gamesplayed)).toFixed(2)}%)\n  - ${seasonData.apm.toFixed(2)} APM | ${seasonData.pps.toFixed(2)} PPS | ${seasonData.vs.toFixed(2)} VS score\n`;
                        }
                    }


                    pages.push(
                        new EmbedBuilder()
                            .setThumbnail(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                            .setColor(ratingColours[seasonData.rank] || '#ff8c57')
                            .setDescription(pastDescription)
                    );
                }

                // Create dynamic buttons: "Current", then "Season X" for each season
                const buttons = [
                    new ButtonBuilder()
                        .setCustomId('leaguepage_0')
                        .setLabel('Current')
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(true) // Default page
                ];
                for (let i = 0; i < seasonNumbers.length; i++) {
                    buttons.push(
                        new ButtonBuilder()
                            .setCustomId(`leaguepage_${i + 1}`) // +1 because 0 is "Current"
                            .setLabel(`Season ${seasonNumbers[i]}`)
                            .setStyle(ButtonStyle.Primary)
                    );
                }

                const row = new ActionRowBuilder().addComponents(buttons);

                await interaction.reply({
                    embeds: [pages[0]],
                    components: [row]
                });

                // Store pages and button count for later use
                interaction.client.pageData = {
                    ...interaction.client.pageData,
                    [interaction.id]: {
                        pages,
                        currentPage: 0,
                        seasonNumbers // Save for reference if needed
                    }
                };
            }

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
