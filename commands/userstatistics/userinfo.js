const {
    SlashCommandBuilder,
    MessageFlags,
    InteractionContextType,
    ApplicationIntegrationType,
    ContainerBuilder,
    SeparatorBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
} = require("discord.js");

const {
    formatNumber,
    countryCodeToEmoji,
    formatPreciseTime,
    formatLongTime,
    getEmojiOfRank,
    formatISOString,
    calculateLevel,
    formatUsername,
    formatAchievement,
    buildPageSelectRow,
    specialUserContainers,
} = require("../../helpers/formatters");
const { getUser } = require("../../helpers/getuser");
const { getEmoji } = require("../../helpers/emojis");
const { fetchCached } = require("../../helpers/fetch");

module.exports = {
    data: new SlashCommandBuilder()
        .setName("user")
        .setContexts(
            InteractionContextType.BotDM,
            InteractionContextType.Guild,
            InteractionContextType.PrivateChannel,
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription(
            "Get detailed information about a specific user via their TETR.IO (or Discord) username/ID.",
        )
        .addStringOption((option) =>
            option
                .setName("user")
                .setDescription("the TETR.IO username / Discord to search for")
                .setRequired(true),
        ),

    async execute(interaction) {
        const user = await getUser(
            interaction.options.getString("user").toLowerCase(),
            interaction
        ); // calls API only once

        if (user === "no such user") {
            return await interaction.reply({
                content:
                    "No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.",
                flags: MessageFlags.Ephemeral,
            });
        } else if (user === "server error") {
            return await interaction.reply({
                content:
                    "I had an issue accessing the TETR.IO servers! Please try again later.",
                flags: MessageFlags.Ephemeral,
            });
        }

        // fetch from API using the ID
        const stats = await fetchCached(
            `https://ch.tetr.io/api/users/${user._id}`,
        );
        const summary = await fetchCached(
            `https://ch.tetr.io/api/users/${user._id}/summaries`,
        );

        const statData = stats.data;
        const summaryData = summary.data;

        const ach = Array.isArray(summaryData.achievements)
            ? summaryData.achievements
            : [];
        const badges = Array.isArray(statData.badges) ? statData.badges : [];

        // Count all unlocked achievements (ranked + unranked, including ISSUED)
        const unlockedCount = ach.reduce((sum, a) => {
            const unlocked =
                !a.stub &&
                (a.rank === 100 || (typeof a.rank === "number" && a.rank >= 1));
            return sum + (unlocked ? 1 : 0);
        }, 0);

        // Build a summary line for all unlocked achievements
        const medalLine = (() => {
            const counts = { 100: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            for (const a of ach) {
                const unlocked =
                    !a.stub &&
                    (a.rank === 100 ||
                        (typeof a.rank === "number" && a.rank >= 1));
                if (!unlocked) continue;
                if (a.rank === 100) counts[100]++;
                else if (a.rank >= 1 && a.rank <= 5) counts[a.rank]++;
            }
            const order = [100, 1, 2, 3, 4, 5];
            const names = {
                100: "issued",
                1: "bronze",
                2: "silver",
                3: "gold",
                4: "platinum",
                5: "diamond",
            };
            const parts = [];
            for (const k of order) {
                if (counts[k])
                    parts.push(`${getEmoji("ach_" + names[k])} ${counts[k]}`);
            }
            return parts.length ? "\n  - " + parts.join(", ") : "";
        })();

        // TODO : move these to helper file and make them more generic, so they can be used in other commands too
        // ========= anon/bot detection =========
        // these accounts are kinda weird, anon has basically nothing, bot hides records but has some basic info
        const specialUserReply = specialUserContainers(statData, user);
        if (specialUserReply) {
            return await interaction.reply(specialUserReply);
        }
        // ========= end anon/bot detection =========

        const country = countryCodeToEmoji(statData.country);

        const key = interaction.id;
        const commandName = "user";
        const labels = ["Profile", "General", "Gameplay"];

        const profilePage = new ContainerBuilder()
            .setAccentColor(0x86c9fc)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### __${formatUsername(user.username)} -> Quick Look__

- About:
- Account created ${formatISOString(statData.ts)}
- Level ${formatNumber(Math.floor(calculateLevel(statData.xp)))} (${formatNumber(Math.floor(statData.xp))} XP)
- ${country}
- Has ${formatNumber(statData.friend_count)} friends
${statData.supporter ? `  - Has supporter${starConvert(statData.supporter_tier)}${statData.bio ? `\n> -  ${statData.bio}` : ""}` : ""}`),
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(`https://tetr.io/user-content/avatars/${user._id}.jpg`),
                    ),
            )
            .addSeparatorComponents(new SeparatorBuilder())
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(`${formatConnections(statData.connections)}
${formatOldUsernames(statData.oldusernames)}`),
            )
            .addActionRowComponents(
                buildPageSelectRow({
                    commandName,
                    key,
                    labels,
                    activeIndex: 0,
                }),
            );
            

        const generalPage = new ContainerBuilder()
            .setAccentColor(0x80bdff)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### __${formatUsername(user.username)} -> Quick Look -> General__\n
- Has ${unlockedCount} achievements${medalLine}${statData.ar > 0 ? `\n  - Totalling ${statData.ar} Achievement Rating` : ""}${formatBadges(badges)} ${formatDisplayedAchs(statData.achievements, ach)}
${formatGamesPlayed(statData.gamesplayed, statData.gameswon, statData.gametime) || ""}
    `))
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(`https://tetr.io/user-content/avatars/${user._id}.jpg`),
                    ),
            )
            .addActionRowComponents(
                buildPageSelectRow({
                    commandName,
                    key,
                    labels,
                    activeIndex: 1,
                }),
            );

        const gameplayPage = new ContainerBuilder()
            .setAccentColor(0x80bdff)
            .addSectionComponents(
                new SectionBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`### __${formatUsername(user.username)} -> Quick Look -> Gameplay__
${formatLeaguePreview(summaryData, country)} ${formatZenith(summaryData, country)} ${formatZenith(summaryData, country, true)} ${format40Lines(summaryData, country)} ${formatBlitz(summaryData, country)} ${formatZen(summaryData)}`),
                    )
                    .setThumbnailAccessory(
                        new ThumbnailBuilder().setURL(`https://tetr.io/user-content/avatars/${user._id}.jpg`),
                    ),
            )
            .addActionRowComponents(
                buildPageSelectRow({
                    commandName,
                    key,
                    labels,
                    activeIndex: 2,
                }),
            );

        const pageContainers = [profilePage, generalPage, gameplayPage];

        interaction.client.pageData.set(key, {
            commandName,
            ownerId: interaction.user.id,
            pages: pageContainers,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000,
            useComponentsV2: true,
        });

        await interaction.reply({
            flags: MessageFlags.IsComponentsV2,
            components: [pageContainers[0]],
        });
    },
};

// most of these functions are self-explanatory
// good typo :aysm:

function gamesWonConvert(gamesWon, gamesPlayed) {
    if (
        gamesWon === "Hidden" ||
        gamesPlayed === "Hidden" ||
        gamesPlayed === 0
    ) {
        return gamesWon;
    }

    return `${gamesWon} (${formatNumber((100 * gamesWon) / gamesPlayed, 2)}%)`;
}

function formatBadges(badgelist) {
    if (badgelist.length > 0) {
        return `\n  - As well as ${badgelist.length} badges`;
    }
    return ``;
}

function formatGamesPlayed(gamesplayed, gameswon, gamestime) {
    if (gamesplayed > -1) {
        return `\n- Played ${gamesplayed} games
    - Won ${gamesWonConvert(gameswon, gamesplayed)} of them
    -  ${formatLongTime(gamestime, true)} played (${formatLongTime(gamestime)})`;
    }
    return "\n- Has hidden games played";
}

function starConvert(supporterTier) {
    let supporterString = "";

    for (let i = 1; i < supporterTier; i++) {
        supporterString = supporterString.concat(
            ` ${getEmoji("supporter_star")}`,
        );
    }
    return supporterString;
}

function formatConnections(connections) {
    const connectionTypes = [
        "Discord",
        "Twitch",
        "Twitter",
        "Reddit",
        "Youtube",
        "Steam",
    ];
    const formattedList = [];

    connectionTypes.forEach((connection) => {
        if (connections[connection.toLowerCase()]) {
            const username =
                connections[connection.toLowerCase()].display_username ||
                connections[connection.toLowerCase()].username;
            formattedList.push(`  - ${connection}: ${username}`);
        }
    });

    if (formattedList.length === 0) {
        return "";
    }

    return (
        `\n\n- ${formattedList.length} connections\n` + formattedList.join("\n")
    );
}

//small and cute league function (will purr at you if it gets the chance)
function formatLeaguePreview(statistics, country) {
    const leagueStats = statistics?.league;

    if (!leagueStats) {
        return "";
    }

    const gamesPlayed = leagueStats.gamesplayed;
    const gamesWon = leagueStats.gameswon;
    const ratingDeviation = leagueStats.rd;
    const rawRating = leagueStats.tr;
    const rank = leagueStats.rank;
    const estRank = leagueStats.percentile_rank;

    const hasGamesPlayed = Number.isFinite(gamesPlayed);
    const hasGamesWon = Number.isFinite(gamesWon);
    const hasRating = Number.isFinite(rawRating);
    const hasRank = typeof rank === "string" && rank.length > 0;

    // Hide the entire section when the user has no usable league data
    if (!hasGamesPlayed && !hasRating && !hasRank) {
        return "";
    }

    let rating;

    if (hasRating && rawRating < 0) {
        rating = `${hasGamesPlayed ? gamesPlayed : 0}/10 rating games`;
    } else if (hasRating) {
        rating = `${formatNumber(rawRating, 2)} TR`;
    } else {
        rating = "Unrated";
    }

    let standing = "";

    if (
        hasGamesPlayed &&
        gamesPlayed > 0 &&
        hasRank &&
        leagueStats.bestrank &&
        rank !== leagueStats.bestrank
    ) {
        standing += `\n  - Has reached ${getEmojiOfRank(leagueStats.bestrank)}`;
    }

    if (
        Number.isFinite(ratingDeviation) &&
        ratingDeviation > 100 &&
        estRank
    ) {
        standing += `\n  - Probably around ${getEmojiOfRank(estRank)}`;
    }

    if (Number.isFinite(leagueStats.standing) && leagueStats.standing > 0) {
        standing += `\n  - Ranked #${formatNumber(leagueStats.standing)} ${formatCountry(
            leagueStats.standing_local,
            country,
        )}`;
    }

    if (
        hasGamesPlayed &&
        hasGamesWon &&
        gamesPlayed > 0
    ) {
        const winRate = (gamesWon / gamesPlayed) * 100;

        standing += `\n  - Won ${gamesWon}/${gamesPlayed} games (${formatNumber(winRate, 2)}%)`;
    }

    if (Number.isFinite(leagueStats.vs)) {
        standing += `\n  - ${formatNumber(leagueStats.vs, 2)} VS score`;
    }

    const rankText = hasRank ? `, ${getEmojiOfRank(rank)}` : "";

    return `\n- ${getEmoji("league")} **${rating}**${rankText}${standing}`;
}

function format40Lines(statistics, country) {
    if (statistics["40l"].record) {
        const flStatistics = statistics["40l"];
        const results = flStatistics.record.results;
        return `\n- ${getEmoji("40lines")} **40 Lines in ${formatPreciseTime(results.stats.finaltime)}**
    - Ranked #${formatNumber(flStatistics.rank)} ${formatCountry(flStatistics.rank_local, country)}
    - [Submitted ${formatISOString(flStatistics.record.ts)}](https://tetr.io/#R:${flStatistics.record.replayid})
    - ${formatNumber(results.aggregatestats.pps, 2)} PPS | ${formatNumber(results.stats.finesse.faults)} finesse faults`;
    }
    return "";
}

function formatBlitz(statistics, country) {
    if (statistics.blitz.record) {
        const blStatistics = statistics.blitz;
        return `\n- ${getEmoji("blitz")} **${formatNumber(blStatistics.record.results.stats.score)} points in Blitz**
    - Ranked #${formatNumber(blStatistics.rank)} ${formatCountry(blStatistics.rank_local, country)}
    - [Submitted ${formatISOString(blStatistics.record.ts)}](https://tetr.io/#R:${blStatistics.record.replayid})
    - ${formatNumber(blStatistics.record.results.aggregatestats.pps, 2)} PPS | ${formatNumber(blStatistics.record.results.stats.score / blStatistics.record.results.stats.piecesplaced, 2)} Points/Piece`;
    }
    return "";
}

function formatZenith(statistics, country, expert = false) {
    const zenithVer = expert ? "zenithex" : "zenith";
    const zenithVerLong = expert ? "Quick Play EXPERT" : "Quick Play";
    let zenithText = "";
    const zStatistics = statistics[zenithVer];

    if (statistics[zenithVer].record) {
        zenithText = `
- ${getEmoji("quickplay")} **${formatNumber(zStatistics.record.results.stats.zenith.altitude, 2)}m in ${zenithVerLong}**
    - Ranked #${formatNumber(zStatistics.rank)} ${formatCountry(zStatistics.rank_local, country)}
    - [Submitted ${formatISOString(zStatistics.record.ts)}](https://tetr.io/#R:${zStatistics.record.replayid})
    - ${formatNumber(zStatistics.record.results.aggregatestats.pps, 2)} PPS | ${formatNumber(zStatistics.record.results.aggregatestats.apm, 2)} APM
    - Floor ${zStatistics.record.results.stats.zenith.floor} | ${zStatistics.record.results.stats.kills} KOs | Reached ${zStatistics.record.results.stats.topbtb - 1} B2B`;
        if (statistics[zenithVer].best.record) {
            zenithText += `
  - All-time best is ${formatNumber(zStatistics.best.record.results.stats.zenith.altitude, 2)}m (#${formatNumber(zStatistics.best.rank)})`;
        }
    } else if (statistics[zenithVer].best.record) {
        zenithText = `\n- ${getEmoji("quickplay")} Hasn't played ${zenithVerLong} this week
    - All-time best is ${formatNumber(zStatistics.best.record.results.stats.zenith.altitude, 2)}m
    - Ranked #${formatNumber(zStatistics.best.rank)}
    - [Submitted ${formatISOString(zStatistics.best.record.ts)}](https://tetr.io/#R:${zStatistics.best.record.replayid})`;
    }

    return zenithText;
}

function formatZen(statistics) {
    if (statistics.zen) {
        const zenStatistics = statistics.zen;
        return `\n- ${getEmoji("zen")} **Level ${zenStatistics.level} in Zen**
    - ${formatNumber(Math.round(zenStatistics.score))} points`;
    }
    return "";
}

function formatDisplayedAchs(displayed = [], all = []) {
    let displayCase = "\n  - Displayed achievements:";

    all.forEach((achievement) => {
        if (displayed.includes(achievement.k)) {
            displayCase += `\n    - ` + formatAchievement(achievement);
        }
    });

    if (displayCase !== "\n  - Displayed achievements:") return displayCase;
    return "";
}

function formatCountry(localRank, country) {
    if (localRank > 0) return `(#${formatNumber(localRank)} ${country})`;
    return "";
}

function formatOldUsernames(usernameArray = []) {
    if (!Array.isArray(usernameArray) || usernameArray.length === 0) {
        return "";
    }

    const validUsernames = usernameArray
        .filter((entry) => entry && typeof entry === "object")
        .map((entry) => entry.username)
        .filter(
            (username) =>
                typeof username === "string" && username.trim().length > 0,
        );

    if (validUsernames.length === 0) {
        return "";
    }

    let usernames = `- Previous usernames:`;
    const limit = Math.min(validUsernames.length, 5);

    for (let i = 0; i < limit; i++) {
        usernames = usernames + `\n - ${validUsernames[i]}`;
    }

    return usernames;
}
