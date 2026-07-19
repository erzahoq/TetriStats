const {
    SlashCommandBuilder,
    MessageFlags,
    ContainerBuilder,
    SectionBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    InteractionContextType,
    ApplicationIntegrationType,
    SeparatorBuilder,
} = require("discord.js");

const { formatUsername, formatAchievement, buildPageSelectRow, getClosestRank, formatAchievementVal, formatNumber, formatISOString, getEmojiOfRank, getNextRank, getLeagueStatThresholds, getLeagueRankColour } = require('../../helpers/formatters');
const { getUser } = require('../../helpers/getuser');
const { getEmoji } = require('../../helpers/emojis');
const { fetchCached } = require('../../helpers/fetch');
const { autocomplete, getChoice } = require('../../helpers/achAutocomplete');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('user-achievements')
        .setContexts(InteractionContextType.BotDM, InteractionContextType.Guild, InteractionContextType.PrivateChannel)
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall)
        .setDescription('Get information about a specific user\'s achievements via their TETR.IO (or Discord) username/ID.')
        .addStringOption((option) =>
            option
                .setName('user')
                .setDescription('the TETR.IO username / Discord to search for')
                .setRequired(true),
        )
        .addStringOption((option) =>
            option
                .setName('achievement')
                .setDescription('the specific achievement to view')
                .setRequired(false)
                .setAutocomplete(true)   
        ),

    async execute(interaction) {
        // Defer reply immediately to avoid timeout
        await interaction.deferReply();

        const user = await getUser(interaction.options.getString('user').toLowerCase());

        if (user === "no such user") {
            return await interaction.editReply({
                content: 'No such user found on TETR.IO! Either the account no longer exists, or this person has not linked their Discord with TETR.IO.',
            });
        } else if (user === "server error") {
            return await interaction.editReply({
                content: 'I had an issue accessing the TETR.IO servers! Please try again later.',
            });
        }

        const username = user.username;

        let achs = await fetchCached(`https://ch.tetr.io/api/users/${user._id}/summaries/achievements`);
        let league = await fetchCached(`https://ch.tetr.io/api/users/${user._id}/summaries/league`);

        achs = achs.data;
        league = league.data;

        const achToViewString = interaction.options.getString('achievement');
        if (achToViewString) {
            const achToView = await getChoice(achToViewString);
            const matchingAch = achs.find(ach => `${ach.k}` === achToView);
            if (!matchingAch) {
                return await interaction.editReply({
                    content: `Achievement \`${achToViewString}\` not found for user ${formatUsername(username)}! They might not have that achievement.`,
                });
            }

            const container = await buildAchievementDetailContainer(
                matchingAch,
                username,
                league,
            );

            return await interaction.editReply({
                flags: MessageFlags.IsComponentsV2,
                components: [container],
            });
        }

        // create a bunch of vars
        const catMap = {
            "general": "General",
            "league": "Tetra League",
            "solo": "Solo",
            "zenith": "Quick Play",
            "legacy": "Legacy",
            "event": "Event"
        }
        const categories = ["general", "league", "solo", "zenith", "legacy", "event"];
        const achList = {};

        const colourMapping = {
            "general": 0x6dc971,
            "league": 0xc51111,
            "solo": 0xff7024,
            "zenith": 0xffc800,
            "legacy": 0xac64ca,
            "event": 0xf892a3
        };

        //magic voodoo sorting raah
        achs.forEach(achievement => {
            // only include earned/ranked achievements
            if (achievement.rank > 0) {
                if (!achList[achievement.category]) {
                    achList[achievement.category] = [];
                }
                achList[achievement.category].push(achievement);
            }
        });

        // now sort each category globally before pagination
        for (const cat of Object.keys(achList)) {
            achList[cat] = sortByAchievementRank(achList[cat]);
        }

        const textPages = [];
        const pageAchsByPageIndex = [];
        const labels = [];


        categories.forEach(cat => {
            if (achList[cat]) { // if the achievement list exists
                const { pageTexts, pageAchs } = paginateAchievements(achList[cat]);

                for (let ind = 0; ind < pageTexts.length; ind++) {
                    textPages.push(
                        new ContainerBuilder()
                            .setAccentColor(colourMapping[cat])
                            .addSectionComponents(
                                new SectionBuilder()
                                    .addTextDisplayComponents(
                                        new TextDisplayBuilder().setContent(
                                            `### __${formatUsername(username)} -> Achievements -> ${catMap[cat]}__\n` +
                                                pageTexts[ind],
                                        ),
                                    )
                                    .setThumbnailAccessory(
                                        new ThumbnailBuilder().setURL(
                                            `https://tetr.io/user-content/avatars/${user._id}.jpg`,
                                        ),
                                    ),
                            ),
                    );

                    pageAchsByPageIndex.push(pageAchs[ind] ?? []);

                    //new logic
                    let label = `${catMap[cat]}`;
                    if (pageTexts.length > 1) label = `${catMap[cat]} (${ind + 1})`;
                    labels.push(label);

                }
            } else {
                if (cat === "event") return; // no text or button if no event achievements
                textPages.push(
                    new ContainerBuilder()
                        .setAccentColor(colourMapping[cat])
                        .addSectionComponents(
                            new SectionBuilder()
                                .addTextDisplayComponents(
                                    new TextDisplayBuilder().setContent(
                                        `### __${formatUsername(username)} -> Achievements -> ${catMap[cat]}__\n` +
                                            `${getEmoji("ach_none")} No ${catMap[cat]} achievements unlocked yet... :(`,
                                    ),
                                )
                                .setThumbnailAccessory(
                                    new ThumbnailBuilder().setURL(
                                        `https://tetr.io/user-content/avatars/${user._id}.jpg`,
                                    ),
                                ),
                        ),
                );
                pageAchsByPageIndex.push([]);

                labels.push(`${catMap[cat]}`);
            }
        })

        const key = interaction.id;
        const commandName = 'userachievements';

        textPages.forEach((container, pageIndex) => {
            container
                .addActionRowComponents(
                    buildAchSelectRow(
                        key,
                        pageIndex,
                        pageAchsByPageIndex[pageIndex] ?? [],
                    ),
                )
                .addSeparatorComponents(new SeparatorBuilder())
                .addActionRowComponents(
                    buildPageSelectRow({
                        commandName,
                        key,
                        labels,
                        activeIndex: pageIndex,
                    }),
                );

        });

        interaction.client.pageData.set(key, {
            commandName,
            ownerId: interaction.user.id,
            pages: textPages,
            labels,
            currentPage: 0,
            ttlMs: 10 * 60 * 1000,
            expiresAt: Date.now() + 10 * 60 * 1000,
            useComponentsV2: true,

            pageAchsByPageIndex,
            username,
            league,
        });

        await interaction.editReply({
            flags: MessageFlags.IsComponentsV2,
            components: [textPages[0]],
        });
    },
    async autocomplete(interaction) {
        return await autocomplete(interaction);
    },
    buildAchievementDetailContainer
};

function sortByAchievementRank(items) {
    const sortOrder = {
        100: 1, // issued
        5: 2,   // diamond
        4: 3,   // platinum
        3: 4,   // gold
        2: 5,   // silver
        1: 6,   // bronze
        0: 999  // unranked, should be last
    };

    return [...items].sort((a, b) => {
        const aOrder = sortOrder[a.rank] ?? 999;
        const bOrder = sortOrder[b.rank] ?? 999;

        if (aOrder !== bOrder) return aOrder - bOrder;

        //tie-breaker so same-tier achievements stay in a consistent order
        return a.name.localeCompare(b.name);
    });
}

function paginateAchievements(achlist) {
    const pageSize = 15;
    const pageTexts = [];
    const pageAchs = [];

    if (!achlist) return {pageTexts: [], pageAchs: []};

    for (let i = 0; i < achlist.length; i++) {
        const ach = achlist[i];
        const pageIndex = Math.floor(i / pageSize);

        pageTexts[pageIndex] ??= "";
        pageAchs[pageIndex] ??= [];
        pageAchs[pageIndex].push(ach);

        const achText = "\n- " + formatAchievement(ach);
        pageTexts[pageIndex] += achText;
    }
    
    return {pageTexts, pageAchs};
}


function buildAchSelectRow(messageKey, pageIndex, pageAchs) {
    const list = pageAchs ?? [];

    const menu = new StringSelectMenuBuilder()
        .setCustomId(`achselect_${messageKey}`)
        .setMinValues(1)
        .setMaxValues(1);

    if (list.length === 0) {
        menu
            .setPlaceholder("No achievements on this page")
            .setDisabled(true)
            .addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel("No achievements available")
                    .setValue("achd_none") // wait doesnt this just never trigger? nvm
            );
    } else {
        const opts = list.slice(0, 25).map((ach, i) =>
            new StringSelectMenuOptionBuilder()
                .setLabel(ach.name.length > 100 ? ach.name.slice(0, 97) + "..." : ach.name)
                .setValue(`achd_${pageIndex}_${i}`)
        );

        menu
            .setPlaceholder("View an achievement…")
            .setDisabled(false)
            .addOptions(opts);
    }

    return new ActionRowBuilder().addComponents(menu);
}

async function buildAchievementDetailContainer(ach, username, league) {
    const lowerIsBetter = (ach.vt === 2 || ach.vt === 3); // time-like
    const closestRank = await getClosestRank(ach.v, `achievements/${ach.n}`, { lowerIsBetter });
    
    const achievementMapping = {
        100: 'issued',
        1: 'bronze',
        2: 'silver',
        3: 'gold',
        4: 'platinum',
        5: 'diamond',
        0: 'none'
    };

    const accentColor =
    getLeagueRankColour(closestRank?.rank) ?? 0xffffff;


    const title = ach.category
        ? `### __${formatUsername(username)} -> Achievements -> ${ach.name}__`
        : "";

    let achText = ""

    //ok this is the same achtext shit
    const displayVal = formatAchievementVal(ach, ach.v, ach.a);
    achText += `\n` + getEmoji("ach_" + achievementMapping[ach.rank])

    if (ach.vt !== 5) {
        achText += ` **${displayVal}**${ach.object ? ` ${ach.object}` : ""}\n`; //shows the main info
    } else {
        achText += ach.object ? ` **${ach.object}** \n` : `\n`;
    }

    if (ach.vt === 5) { // if it's issued
        achText += `Issue ${ach.pos}/${ach.total}` 
    } else {
        if (ach.pos < 100) { // if you're in the top 100 players
            achText += `**#${ach.pos + 1}** in the world`
        }
        else {
            let precision = 2;
            const achPercentile = ach.pos / ach.total * 100
            if (achPercentile < 0.01) precision = 3;

            achText += `**#${ach.pos + 1}** in the world (Top ${formatNumber(achPercentile, precision)}%)` // literally just one extra point of precision
        } 
    }

    //duo achievement
    if (ach.x?.ally) {
        const allyUsername = ach.x.ally.username;
        achText += `\n With ${formatUsername(allyUsername)}`;
    }

    //league rank stuff
    let rank = null;
    if (league?.rank && league.rank !== "z") {
        rank = league.rank;
    } else if (league?.percentile_rank && league.percentile_rank !== "z") {
        rank = league.percentile_rank;
    }


    achText += `\nAchieved ${formatISOString(new Date(ach.t).toISOString(), true)}`

    //if its not issued:
    if (ach.rank !== 100 && closestRank) {
        //show closest rank and data
        achText += `\n\n**Performance**\nClosest rank is ${getEmojiOfRank(closestRank.rank)}, with`;

        const deltaText = formatAchievementDelta(closestRank.delta, ach);
        const sign = closestRank.delta > 0 ? 'less' : closestRank.delta < 0 ? 'more' : '';
        if (deltaText && closestRank.delta !== 0) {
            achText += ` ${deltaText} ${sign}`;
        }

        const nextRank = getNextRank(closestRank.rank);

        const thresholds = await getLeagueStatThresholds(`achievements/${ach.n}`);

        if (nextRank) {
            const rawNext = thresholds?.[nextRank];
            if (rawNext !== undefined && isFinite(Number(rawNext))) {
                const displayV =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -ach.v : ach.v;
                const nextDisplay =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -rawNext : rawNext;

                const need = lowerIsBetter
                    ? (displayV - nextDisplay)
                    : (nextDisplay - displayV);

                if (need > 0) {
                    const needText = formatAchievementDelta(need, ach);
                    if (needText) {
                        achText += `\n${getEmojiOfRank(nextRank)} rank has ${needText} more`;
                    }
                }
            }
        }

        if (rank && rank !== nextRank) {
            const rankNext = thresholds?.[rank];
            if (rankNext !== undefined && isFinite(Number(rankNext))) {
                const displayV =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -ach.v : ach.v;
                const rankNextDisplay =
                    (ach.vt === 3 || ach.vt === 5 || ach.vt === 6) ? -rankNext : rankNext;

                const need = lowerIsBetter
                    ? (displayV - rankNextDisplay)
                    : (rankNextDisplay - displayV);

                if (need > 0) {
                    const needText = formatAchievementDelta(need, ach);
                    if (needText) {
                        achText += `\n${getEmojiOfRank(rank)} rank has ${needText} more`;
                    }
                }
            }
        }
    }


    //check for attributes and format
    if (ach.art > -1) achText += "\n" //sorry (???)
    if (ach.art === 0) {
        achText += `\n${getEmoji('au')} **UNRANKED** / This achievement does not contribute to your Achievement Rating.`
    } else if (ach.art === 2) {
        achText += `\n${getEmoji('ac')} **COMPETITIVE** / This achievement grants extra Achievement Rating to those who place in its Top 100 leaderboard.`
    }
    if (ach.hidden) {
        achText += `\n${getEmoji('ah')} **HIDDEN** / This achievement is only visible to the worthy.`
    }
    if (ach.event) {
        const eventName = ach.event;
        let extraText = '';
        if (ach.category === 'legacy') extraText = " It is no longer available."
        let currentText = 'is part';
        if (ach.category === 'legacy') currentText = "was part"
        achText += `\n${getEmoji('ae')} **EVENT** / This achievement ${currentText} of the ${eventName} event.${extraText}`;
    }

    if (ach.desc) {
        achText += `\n-# *${ach.desc}*`;
    }

    const content = `${title}\n${achText}`.trim() || "No extra info available.";

    return new ContainerBuilder().setAccentColor(accentColor).addTextDisplayComponents(
        new TextDisplayBuilder().setContent(content)
    );



};

//stupid vt again aysm
function formatAchievementDelta(delta, ach) {
    if (delta === null || delta === undefined || !isFinite(Number(delta))) return null;

    //vt = ISSUE or NONE, meaning delta is meaningless
    if (ach.vt === 0 || ach.vt === 5) return null;

    const d = Number(delta);
    const abs = Math.abs(d);

    switch (ach.vt) {
    //TIME (ms, lower is better)
        case 2:
            //TIME_INV (stored negative, but delta already normalized)
            // eslint-disable-next-line no-fallthrough
        case 3:
            return `${formatNumber(abs / 1000, 2)}s`;

            //FLOOR / altitude (meters)
        case 4:
            return `${formatNumber(abs, 1)}m`;

            //NUMBER_INV (stored negative, display positive)
        case 6:
            return `${formatNumber(abs, 0)}`;

            //NUMBER (plain numeric)
        case 1:
        default:
            return `${formatNumber(abs, 0)}`;
    }
}
