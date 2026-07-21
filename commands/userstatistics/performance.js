const {
    SlashCommandBuilder,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    MessageFlags,
    InteractionContextType,
    ApplicationIntegrationType
} = require('discord.js');

const { getEmojiOfRank, getLeagueRankColour, formatUsername, buildPageSelectRow, addStatComparisonField } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { fetchCached } = require('../../helpers/fetch');


const getAltitude = (res) => Number(res?.stats?.zenith?.altitude ?? -Infinity);

// sometimes new records for the week are better than the career best, so pick the best of the two
const pickBestZenithResults = (summaryObj) => {
    if (!summaryObj) return null;
    const current = summaryObj.record?.results || null;       // this week
    const best = summaryObj.best?.record?.results || null; // career best

    if (current && !best) return current;
    if (!current && best) return best;
    if (!current && !best) return null;

    return getAltitude(current) > getAltitude(best) ? current : best;
};

module.exports = {
    data: new SlashCommandBuilder()
        .setName('performance')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Get information about the performance of a user via their TETR.IO (or Discord) username/ID.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('the TETR.IO username / Discord to search for')
                .setRequired(true),
        ),

    async execute(interaction) {
        const user = await getUser(interaction.options.getString('user').toLowerCase());

        if (user === 'no such user') {
            return await interaction.reply({
                content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
                flags: MessageFlags.Ephemeral,
            });
        } else if (user === 'server error') {
            return await interaction.reply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
                flags: MessageFlags.Ephemeral,
            });
        }

        let userStats = await fetchCached(`https://ch.tetr.io/api/users/${user._id}/summaries`);
        userStats = userStats.data;

        delete userStats.zen;
        delete userStats.achievements;

        const leagueData = userStats.league;
        const linesData = userStats['40l'].record?.results;
        const blitzData = userStats.blitz.record?.results;

        const zenithData = pickBestZenithResults(userStats.zenith);
        const zenithExData = pickBestZenithResults(userStats.zenithex);

        const userLeagueRank = leagueData?.rank ?? null;

        const leagueContainer = getContainer(user.username, 'Tetra League', user._id, !leagueData || leagueData.played === 0, userLeagueRank, leagueData?.percentile_rank);
        const linesContainer = getContainer(user.username, '40 Lines', user._id, !linesData || linesData.played === 0, userLeagueRank, leagueData?.percentile_rank);
        const blitzContainer = getContainer(user.username, 'Blitz', user._id, !blitzData || blitzData.played === 0, userLeagueRank, leagueData?.percentile_rank);
        const quickplayContainer = getContainer(user.username, 'Quick Play', user._id, !zenithData, userLeagueRank, leagueData?.percentile_rank);
        const quickplayExContainer = getContainer(user.username, 'Expert Quick Play', user._id, !zenithExData, userLeagueRank, leagueData?.percentile_rank);

        // Prefer percentile_rank if the user is unranked ('z') or rank is missing
        const effectiveRank = (leagueData?.rank && leagueData.rank !== 'z')
            ? leagueData.rank
            : (leagueData?.percentile_rank || null);


        // add all the embed fields

        if (leagueData) {
            await addStatComparisonField(leagueContainer, 'league/pps', 'Pieces Per Second', leagueData.pps, effectiveRank, { decimals: 3 });
            await addStatComparisonField(leagueContainer, 'league/apm', 'Attack Per Minute', leagueData.apm, effectiveRank);
            await addStatComparisonField(leagueContainer, 'league/vs', 'VS score', leagueData.vs, effectiveRank);
        }

        if (linesData) {
            await addStatComparisonField(linesContainer, 'sprint/time', '', linesData.stats.finaltime, effectiveRank, { lowerIsBetter: true, isTime: true });
            await addStatComparisonField(linesContainer, 'sprint/pps', 'Pieces Per Second', linesData.aggregatestats.pps, effectiveRank, { decimals: 3 });
            if (Number(linesData.stats.piecesplaced) > 0) {
                await addStatComparisonField(linesContainer, 'sprint/kpp', 'Keys Per Piece', linesData.stats.inputs / linesData.stats.piecesplaced, effectiveRank, { decimals: 3, lowerIsBetter: true });
            }
            if (Number(linesData.stats.finaltime) > 0) {
                await addStatComparisonField(linesContainer, 'sprint/kps', 'Keys Per Second', linesData.stats.inputs / (linesData.stats.finaltime / 1000), effectiveRank, { decimals: 3 });
            }
            if (linesData.stats.finesse !== undefined && Number(linesData.stats.piecesplaced) > 0) {
                await addStatComparisonField(linesContainer, 'sprint/finesse', 'Finesse', (linesData.stats.finesse.perfectpieces / linesData.stats.piecesplaced), effectiveRank, { isPercentage: true });
            }
        }

        if (blitzData) {
            await addStatComparisonField(blitzContainer, 'blitz/score', 'Score', blitzData.stats.score, effectiveRank, { decimals: 0 });
            await addStatComparisonField(blitzContainer, 'blitz/pps', 'Pieces Per Second', blitzData.aggregatestats.pps, effectiveRank, { decimals: 3 });
            if (Number(blitzData.stats.piecesplaced) > 0) {
                await addStatComparisonField(blitzContainer, 'blitz/spp', 'Score Per Piece', blitzData.stats.score / blitzData.stats.piecesplaced, effectiveRank);
            }
            if (blitzData.stats.finesse !== undefined && Number(blitzData.stats.piecesplaced) > 0) {
                await addStatComparisonField(blitzContainer, 'blitz/finesse', 'Finesse', (blitzData.stats.finesse.perfectpieces / blitzData.stats.piecesplaced), effectiveRank, { isPercentage: true });
            }
        }

        if (zenithData) {
            await addStatComparisonField(quickplayContainer, 'zenith/height', 'Meters', zenithData.stats.zenith.altitude, effectiveRank);
            await addStatComparisonField(quickplayContainer, 'zenith/pps', 'Pieces Per Second', zenithData.aggregatestats.pps, effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayContainer, 'zenith/apm', 'Attack Per Minute', zenithData.aggregatestats.apm, effectiveRank);
            await addStatComparisonField(quickplayContainer, 'zenith/climbSpeed', 'Average Climb Speed', zenithData.stats.zenith.rank, effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayContainer, 'zenith/btb', 'Highest Back-to-Back', zenithData.stats.topbtb, effectiveRank, { decimals: 0 });
            await addStatComparisonField(quickplayContainer, 'zenith/app', 'Attack Per Piece', (zenithData.stats.garbage.attack/zenithData.stats.piecesplaced), effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayContainer, 'zenith/finesse', 'Finesse', (zenithData.stats.finesse.perfectpieces / zenithData.stats.piecesplaced), effectiveRank, { isPercentage: true });
        }

        if (zenithExData) {
            await addStatComparisonField(quickplayExContainer, 'zenithEx/height', 'Meters', zenithExData.stats.zenith.altitude, effectiveRank);
            await addStatComparisonField(quickplayExContainer, 'zenithEx/pps', 'Pieces Per Second', zenithExData.aggregatestats.pps, effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayExContainer, 'zenithEx/apm', 'Attack Per Minute', zenithExData.aggregatestats.apm, effectiveRank);
            await addStatComparisonField(quickplayExContainer, 'zenithEx/climbSpeed', 'Average Climb Speed', zenithExData.stats.zenith.rank, effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayExContainer, 'zenithEx/btb', 'Highest Back-to-Back', zenithExData.stats.topbtb, effectiveRank, { decimals: 0 });
            await addStatComparisonField(quickplayExContainer, 'zenithEx/app', 'Attack Per Piece', (zenithExData.stats.garbage.attack/zenithExData.stats.piecesplaced), effectiveRank, { decimals: 3 });
            await addStatComparisonField(quickplayExContainer, 'zenithEx/finesse', 'Finesse', (zenithExData.stats.finesse.perfectpieces / zenithExData.stats.piecesplaced), effectiveRank, { isPercentage: true });
        }

        const playedLeague = !!(leagueData && (
            Number(leagueData.played) > 0 ||
            leagueData.pps ||
            leagueData.apm ||
            leagueData.vs
        ));

        const played40L = !!(linesData && (Number(linesData.played) > 0 || Number(linesData?.stats?.finaltime) > 0));
        const playedBlitz = !!(blitzData && (Number(blitzData.played) > 0 || Number(blitzData?.stats?.score) > 0));

        // For zenith/zenithex results objects, use altitude > 0 as the signal of a meaningful run
        const playedZenith = !!(zenithData && (Number(zenithData?.stats?.zenith?.altitude) > 0));
        const playedZenithEx = !!(zenithExData && (Number(zenithExData?.stats?.zenith?.altitude) > 0));

        const modes = [
            { label: 'Tetra League', container: leagueContainer, played: playedLeague },
            { label: '40 Lines', container: linesContainer, played: played40L },
            { label: 'Blitz', container: blitzContainer, played: playedBlitz },
            { label: 'Quick Play', container: quickplayContainer, played: playedZenith },
            { label: 'Expert Quick Play', container: quickplayExContainer, played: playedZenithEx },
        ];

        const availableModes = modes.filter(m => m.played);

        // if they've played literally nothing, show a clean "new player" embed with no buttons
        if (availableModes.length === 0) {
            const newUserContainer = new ContainerBuilder()
                .addSectionComponents(
                    new SectionBuilder()
                        .addTextDisplayComponents(
                            new TextDisplayBuilder()
                                .setContent(
                                    `### __${formatUsername(user.username)} -> Performance__\n` +
                                    `No recorded games yet.`
                                )
                        )
                        .setThumbnailAccessory(
                            new ThumbnailBuilder()
                                .setURL(`https://tetr.io/user-content/avatars/${user._id}.jpg`)
                        )
                );

            return await interaction.reply({
                flags: MessageFlags.IsComponentsV2,
                components: [newUserContainer]
            });
        }

        // otherwise, build labels and embeds from the available modes
        const buttonLabels = availableModes.map(m => m.label);
        const containers = availableModes.map(m => m.container);

        const pages = containers;
        const labels = buttonLabels;

        const key = interaction.id;

        for (let i = 0; i < pages.length; i++) {
            pages[i].addActionRowComponents(
                buildPageSelectRow({
                    commandName: 'performance',
                    key,
                    labels,
                    activeIndex: i
                })
            );
        }

        // store session
        interaction.client.pageData.set(key, {
            commandName: 'performance',
            ownerId: interaction.user.id,
            pages,
            labels,
            currentPage: 0,
            useComponentsV2: true,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [pages[0]],
        });

    },
};

function getContainer(username, mode, userId, recordNotExists, userRank, userPercentile) {
    let statusLine;
    if (recordNotExists) {
        statusLine = `Hasn't played any ${mode} games yet!`;
    } else if (userRank && userRank !== 'z') {
        statusLine = `-# Ranked ${getEmojiOfRank(userRank)}`;
    } else if (typeof userPercentile === 'string' && userPercentile && userPercentile !== 'z') {
        statusLine = `-# Unranked ~ Around ${getEmojiOfRank(userPercentile)}`;
    } else {
        statusLine = `-# Unranked`;
    }

    const container = new ContainerBuilder()
        .setAccentColor(
            userRank === 'z' && userPercentile
                ? getLeagueRankColour(userPercentile)
                : getLeagueRankColour(userRank)
        )
        .addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder()
                        .setContent(
                            `### __${formatUsername(username)} -> Performance -> ${mode}__\n${statusLine}`
                        )
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder()
                        .setURL(`https://tetr.io/user-content/avatars/${userId}.jpg`)
                )
        );

    return container;
}