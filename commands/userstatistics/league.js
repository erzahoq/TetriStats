const {
    SlashCommandBuilder,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    InteractionContextType,
    ApplicationIntegrationType,
    MessageFlags
} = require('discord.js');

const { formatNumber, getLeagueRankColour, getEmojiOfRank, formatUsername, buildPageSelectRow } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');
const { fetchCached } = require('../../helpers/fetch');


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
        const user = await getUser(interaction.options.getString('user').toLowerCase(), interaction); 

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

        // Fetch user league data
        const data = await fetchCached(apiURL);

        if (!data.success || !data.data) {
            return interaction.reply({ content: `Could not find league data for user **${user.username}**.`, flags: MessageFlags.Ephemeral }); // this should like never happen because we checked for it earlier but like just in case
        }

        const leagueData = data.data;
        const past = leagueData.past;

        const currentContainer = createLeagueContainer(leagueData, user);
        const pages = [currentContainer];

        const seasonNumbers = Object.keys(past).map(Number).sort((a, b) => a - b);
        if (past && Object.keys(past).length !== 0) {
            for (const season of seasonNumbers) {
                const seasonData = past[season];
                const thisSeasonContainer = createLeagueContainer(seasonData, user, season);

                pages.push(thisSeasonContainer);
            }
        }

        if (pages.length === 1) {
            await interaction.reply({
                components: pages,
                flags: MessageFlags.IsComponentsV2
            });
            return;
        }

        //paging data
        const key = interaction.id; //this becomes the <key> in league:page-<key>-<index>
        const labels = ['Current', ...seasonNumbers.map(s => `Season ${s}`)];

        for (let i = 0; i < pages.length; i++) {
            pages[i].addActionRowComponents(
                buildPageSelectRow({
                    commandName: 'league',
                    key,
                    labels,
                    activeIndex: i
                })
            );
        }

        interaction.client.pageData.set(key, {
            commandName: 'league',
            ownerId: interaction.user.id,
            pages,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000,
            useComponentsV2: true
        });

        // yes
        await interaction.reply({
            components: [pages[0]],
            flags: MessageFlags.IsComponentsV2
        });
    }
};

function createLeagueContainer(leagueData, user, past = 0) {
    const { apm, pps, vs, tr, glicko, rd, rank, standing, standing_local: localStanding, decaying, bestrank, percentile, gxe } = leagueData;
    let { prev_rank: prevRank, next_rank: nextRank } = leagueData;
    const gamesPlayed = leagueData.gamesplayed || 0;
    const gamesWon = leagueData.gameswon || 0;
    const winRate = gamesPlayed > 0 ? formatNumber((gamesWon / gamesPlayed) * 100, 2) : 'N/A';

    /* EXTRA STATS AREA
    currently unused but could be added later if we wanted extra details or whatever

    // assuming that VS = ((LinesSent + GarbageCleared) / Pieces) * PPS * 100
    // which also simplifies to VS =  (LinesSent + GarbageCleared) * 100 / Sec

    const attackPerPiece = apm / (60 * pps); // formula simplifies to `Attack / PiecesDropped`
    const vsPieceEfficiency = (vs / pps); // formula simplifies to `(LinesSent + GarbageCleared) * 100 / PiecesDropped`
    const garbageAcceptanceRatio = ((vs / 100) - (apm / 60)) / pps; // formula simplifies to `(GarbageCleared - LinesCancelled) / PiecesDropped`
    const efficiencySpeedRelianceRatio = (3 * attackPerPiece) / (pps) // this one doesn't simplify into something understandable, but it makes sense
    const generalPieceEfficiency = vs / (100 * apm) // formula simplifies to `60(LinesSent + GarbageCleared) / Attack`

    const agpp = (apm / pps) * (vs / 100); //agression per piece
    const dsr = ((vs / 100) - (apm / 60)) / pps;
    const cpr = (vs / pps) * 10;

    */

    let rankBar;

    if (!nextRank && prevRank === 'x') {
        nextRank = 'top'
    }
    if (!prevRank && nextRank === 'd+') {
        prevRank = "d"
    }

    const Currently = past ? `Was` : `Currently`;
    const Has = past ? `Had` : `Has`;

    let description = `### __${formatUsername(user.username)} -> Tetra League${past ? ` -> Season ${past}` : ""}__\n`;
    description += `## ${tr < 0 || rank === "z" ? `${Currently} unranked ${getEmojiOfRank('z')}` : `${Currently} ranked ${getEmojiOfRank(rank)}`}\n`;

    if (tr < 0) {
        description += `- **${Has} played ${gamesPlayed}/10 rating games**\n`;
        if (gamesPlayed > 0) {
            description += `  - Won ${gamesWon} of them (${winRate}%)\n  - ${formatNumber(apm, 2)} APM | ${formatNumber(pps, 2)} PPS | ${formatNumber(vs, 2)} VS score\n`;
        }
        rankBar = `${generateProgressBar("Unranked", gamesPlayed / 10, 10)} ${getEmojiOfRank('z')}`;
        if (bestrank && bestrank !== leagueData.percentile_rank) {
            description += `  - ${Has} reached ${getEmojiOfRank(bestrank)}\n`;
        }
    } else {
        description += `- **${Has} ${formatNumber(tr, 1)} TR**\n`;
        if (rd > 100) {
            if (!past) {            
                description += `  - Around ${getEmojiOfRank(leagueData.percentile_rank)} (Top ${formatNumber(percentile * 100, 1)}%)\n`;
            }
            rankBar = false;
            if (bestrank && bestrank !== leagueData.percentile_rank) {
                description += `  - ${Has} reached ${getEmojiOfRank(bestrank)}\n`;
            }
        } else {
            if (percentile < 0.005) {
                description += `  - Ranked #${standing} worldwide\n`;
                if (standing !== 1) {
                    description += `  - Ranked #${localStanding} locally\n`;
                }
            } else {
                description += `  - Ranked #${standing} worldwide (Top ${formatNumber(percentile * 100, 1)}%)\n  - Ranked #${localStanding} locally\n`;
            }
            rankBar = `${getEmojiOfRank(prevRank)} ${generateProgressBar("Ranked", (leagueData.prev_at - standing) / (leagueData.prev_at - leagueData.next_at), 15)} ${getEmojiOfRank(nextRank)}`;
            if (bestrank && bestrank !== rank) {
                description += `  - ${Has} reached ${getEmojiOfRank(bestrank)}\n`;
            }
        }
        description += `  - ${Has} ${formatNumber(glicko, 2)} ± ${formatNumber(rd, 1)} Glicko\n`;
        if (gxe) {
            description += `  - ${formatNumber(gxe, 1)}% chance to win against random player\n`;
        }
        if (decaying) {
            description += `  - ${Has}n't played in a week; __rating deviation is increasing__\n`;
        }
        description += `- **${Has} played ${formatNumber(gamesPlayed)} game${gamesPlayed === 1 ? '' : 's'}**\n`;
        if (gamesPlayed > 0) {
            description += `  - Won ${formatNumber(gamesWon)} of them (${winRate}%)\n  - ${formatNumber(apm, 2)} APM | ${formatNumber(pps, 2)} PPS | ${formatNumber(vs, 2)} VS score\n`;
        }
    }

    if (rankBar && !past) description += `\n${rankBar}`;

    const container = new ContainerBuilder()
        .setAccentColor(getLeagueRankColour(rank) || 0xff8c57)
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(new TextDisplayBuilder().setContent(description))
                .setThumbnailAccessory(new ThumbnailBuilder().setURL(`https://tetr.io/user-content/avatars/${user._id}.jpg`))
        );
    
    return container;
}

function generateProgressBar(barType, progress, length = 14) {
    let startSymbol = getEmoji("bar_start");
    let endSymbol = getEmoji("bar_end");

    if (barType === "Unranked") { // this is when there's no rank
        startSymbol = getEmoji("bar_start_rankless");
    }

    // Ensure the progress is within the 0-1 range
    progress = Math.max(0, Math.min(progress, 1));
    if (progress === 1) { // this is for when the player is #1 in the world (wow)
        endSymbol = getEmoji("bar_end_full")
    }

    // Calculate the position of the "!" marker
    const position = Math.round(progress * length);

    // Generate the progress bar
    const bar = Array.from({ length: length }, (_, i) => (i === position ? getEmoji("bar_half") : (i < position ? getEmoji('bar_full') : getEmoji('bar_empty')))).join("");

    // Return the complete progress bar with symbols
    return `${startSymbol}${bar}${endSymbol}`;
}